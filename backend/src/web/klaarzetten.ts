/**
 * Klaarzetten in Home Assistant (besluit 179): wat een huis in Home Assistant
 * nodig heeft voor de functies van SunArc, en of het er staat. Bij Wat
 * je huis kan, per groep, met waar je het in Home Assistant regelt.
 *
 * Alleen tellen, nooit een entity-ID in de zin (besluit 45). Wat de regeling
 * nodig heeft, is `mist` als het ontbreekt; wat een functie erbij geeft, is
 * `optioneel`.
 */

import type { HaEntityState } from '../adapters/homeassistant/client.js';
import type { Lang } from './assistant.js';
import type { HouseRegisters } from './house.js';
import type { SpraakKeuze } from './functies.js';
import { perTaal } from '../taal/index.js';

export type KlaarGroep = 'basis' | 'klimaat' | 'energie' | 'bewoners' | 'gemak' | 'praten' | 'wand';

export interface KlaarPunt {
  readonly id: string;
  readonly groep: KlaarGroep;
  readonly titel: string;
  readonly stand: 'klaar' | 'mist' | 'optioneel';
  /** Wat er staat, of wat er nog moet. */
  readonly zin: string;
  /** Waar in Home Assistant, als pad voor de navigatie van Home Assistant, en in woorden. */
  readonly pad: string | null;
  readonly waar: string;
}

export interface KlaarInput {
  /** Of Home Assistant een locatie heeft. */
  readonly locatie: boolean;
  readonly registers: HouseRegisters | null;
  readonly states: ReadonlyMap<string, HaEntityState>;
  /** Of de netmeter in de configuratie een getal geeft. */
  readonly netMeter: boolean;
  /** De zonnesensor: of hij er is, en hoe vaak hij een nieuwe waarde geeft. */
  readonly zon: { readonly heeft: boolean; readonly intervalS: number | null };
  /** Of het Energie-dashboard een netmeter heeft. */
  readonly energieDashboard: boolean;
  readonly apparatenOpZon: number;
  readonly cameras: number;
  readonly deurbel: boolean;
  readonly rookmelders: number;
  readonly spraak: readonly SpraakKeuze[];
  /** De add-on, met of zonder eigen poort in Tailscale (besluit 160). */
  readonly addOn: boolean;
  readonly eigenPoort: boolean;
}

const PAD = {
  algemeen: '/config/general',
  ruimtes: '/config/areas/dashboard',
  personen: '/config/person',
  integraties: '/config/integrations/dashboard',
  energie: '/config/energy',
  spraak: '/config/voice-assistants/assistants',
  addons: '/hassio/dashboard',
} as const;


/**
 * De woorden van Klaarzetten, per taal (besluit 185). Engels is Brits; de
 * plekken in Home Assistant heten zoals in de Engelse Home Assistant.
 */
const WOORDEN = perTaal('klaarzetten');

export function klaarzetten(i: KlaarInput, lang: Lang = 'nl'): KlaarPunt[] {
  const w = WOORDEN[lang];
  const r = i.registers;
  const st = (id: string) => i.states.get(id);
  const actief = (r?.entities ?? []).filter((e) => !e.disabled_by && i.states.has(e.entity_id));
  const van = (domein: string) => actief.filter((e) => e.entity_id.startsWith(`${domein}.`));
  const klasse = (e: { entity_id: string }) => String(st(e.entity_id)?.attributes['device_class'] ?? '');
  const deviceArea = new Map((r?.devices ?? []).map((d) => [d.id, d.area_id]));
  const inRuimte = (e: { area_id?: string | null; device_id?: string | null }) => (e.area_id ?? (e.device_id ? deviceArea.get(e.device_id) : null)) != null;
  const punt = (id: string, groep: KlaarGroep, titel: string, ok: boolean, nodig: boolean, klaar: string, mist: string, pad: keyof typeof PAD | null): KlaarPunt => ({
    id,
    groep,
    titel,
    stand: ok ? 'klaar' : nodig ? 'mist' : 'optioneel',
    zin: ok ? klaar : mist,
    pad: pad ? PAD[pad] : null,
    waar: pad ? w.waar[pad] : '',
  });

  // De basis.
  const etages = r?.floors.length ?? 0;
  const ruimtes = r?.areas.length ?? 0;
  const bedienbaar = [...van('climate'), ...van('light'), ...van('cover')];
  const zonder = bedienbaar.filter((e) => !inRuimte(e)).length;
  const personen = [...i.states.values()].filter((s) => s.entity_id.startsWith('person.'));
  const metAccount = personen.filter((s) => typeof s.attributes['user_id'] === 'string' && s.attributes['user_id'] !== '').length;
  const metTelefoon = personen.filter((s) => Array.isArray(s.attributes['device_trackers']) && (s.attributes['device_trackers'] as unknown[]).length > 0).length;

  // Klimaat.
  const klimaat = van('climate').length;
  const temperaturen = van('sensor').filter((e) => klasse(e) === 'temperature' && inRuimte(e)).length;

  // Gemak en de wand.
  const lampen = van('light').length;
  const schermen = van('cover').length;
  const beweging = van('binary_sensor').filter((e) => ['motion', 'occupancy', 'presence'].includes(klasse(e))).length;
  const weer = van('weather').length;
  const taalmodellen = van('ai_task').length;
  const metStt = i.spraak.filter((s) => s.spraakNaarTekst);
  const metWekwoord = i.spraak.filter((s) => s.wekwoord);
  const heHuis = metWekwoord.some((s) => s.wekwoord === 'he_huis');

  return [
    punt('locatie', 'basis', w.locatie[0], i.locatie, true, w.locatie[1], w.locatie[2], 'algemeen'),
    punt(
      'ruimtes', 'basis', w.ruimtes.titel, etages > 0 && ruimtes > 0, true,
      zonder ? w.ruimtes.klaarZonder(ruimtes, etages, zonder) : w.ruimtes.klaar(ruimtes, etages),
      ruimtes === 0 ? w.ruimtes.geen : w.ruimtes.geenEtage,
      'ruimtes',
    ),
    punt(
      'personen', 'bewoners', w.personen.titel, metAccount > 0, true,
      metAccount === personen.length ? w.personen.klaar(personen.length) : w.personen.klaarZonder(personen.length, personen.length - metAccount),
      personen.length === 0 ? w.personen.geen : w.personen.geenAccount,
      'personen',
    ),
    punt('telefoon', 'bewoners', w.telefoon.titel, metTelefoon > 0, true, w.telefoon.klaar(metTelefoon, personen.length), w.telefoon.mist, 'personen'),
    punt('klimaat', 'klimaat', w.klimaat.titel, klimaat > 0, true, w.klimaat.klaar(klimaat), w.klimaat.mist, 'integraties'),
    punt('temperatuur', 'klimaat', w.temperatuur.titel, temperaturen > 0, true, w.temperatuur.klaar(temperaturen), w.temperatuur.mist, 'ruimtes'),
    punt('netmeter', 'energie', w.netmeter[0], i.netMeter, true, w.netmeter[1], w.netmeter[2], 'integraties'),
    punt(
      'omvormer', 'energie', w.omvormer.titel, i.zon.heeft, false,
      i.zon.intervalS != null && i.zon.intervalS > 120 ? w.omvormer.traag(Math.round(i.zon.intervalS / 60)) : w.omvormer.klaar,
      w.omvormer.mist,
      'integraties',
    ),
    punt('energiedashboard', 'energie', w.energiedashboard[0], i.energieDashboard, false, w.energiedashboard[1], w.energiedashboard[2], 'energie'),
    punt('opzon', 'energie', w.opzon.titel, i.apparatenOpZon > 0, false, w.opzon.klaar(i.apparatenOpZon), w.opzon.mist, 'integraties'),
    punt('lampen', 'gemak', w.lampen.titel, lampen > 0, false, w.lampen.klaar(lampen), w.lampen.mist, 'integraties'),
    punt('schermen', 'gemak', w.schermen.titel, schermen > 0, false, w.schermen.klaar(schermen), w.schermen.mist, 'integraties'),
    punt('cameras', 'gemak', w.cameras.titel, i.cameras > 0, false, w.cameras.klaar(i.cameras, i.deurbel), w.cameras.mist, 'integraties'),
    punt('rookmelders', 'gemak', w.rookmelders.titel, i.rookmelders > 0, false, w.rookmelders.klaar(i.rookmelders), w.rookmelders.mist, 'integraties'),
    punt('weer', 'gemak', w.weer.titel, weer > 0, false, w.weer.klaar(weer), w.weer.mist, 'integraties'),
    punt('spraak', 'praten', w.spraak.titel, metStt.length > 0, false, w.spraak.klaar(metStt.map((s) => s.naam).join(', ')), w.spraak.mist, 'spraak'),
    punt(
      'wekwoord', 'praten', w.wekwoord.titel, metWekwoord.length > 0, false,
      heHuis ? w.wekwoord.heHuis : w.wekwoord.bij(metWekwoord.map((s) => s.naam).join(', ')),
      i.addOn ? w.wekwoord.addOn : w.wekwoord.mist,
      'spraak',
    ),
    punt('taalmodel', 'praten', w.taalmodel.titel, taalmodellen > 0, false, w.taalmodel.klaar(taalmodellen), w.taalmodel.mist, 'integraties'),
    punt('beweging', 'wand', w.beweging.titel, beweging > 0, false, w.beweging.klaar(beweging), w.beweging.mist, 'integraties'),
    ...(i.addOn ? [punt('tailscale', 'wand', w.tailscale[0], i.eigenPoort, false, w.tailscale[1], w.tailscale[2], 'addons')] : []),
  ];
}
