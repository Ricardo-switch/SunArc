/**
 * Klaarzetten per niveau (besluit 246, schets Wand-Klaarzetten): per functie
 * wat er nodig is, en wat SunArc al ziet. Drie niveaus: voor iedereen (alles
 * blijft in huis), gevorderd (een dienst buiten je huis) en expert (je eigen
 * netwerk). Een stap vinkt zichzelf af zodra SunArc hem ziet.
 *
 * SunArc installeert en verandert hier niets: een stap opent de juiste pagina
 * in Home Assistant, of een pagina in de app. Alleen de spraakassistent maken
 * gaat met een tik, langs de deur van besluit 203.
 *
 * Alleen tellen en namen van diensten, nooit een entity-ID in de zin (besluit 45).
 */

import type { Lang } from './assistant.js';
import type { KlaarPunt } from './klaarzetten.js';
import type { InHuisStand } from './stem-in-huis.js';
import type { SpraakKeuze } from './functies.js';
import { perTaal } from '../taal/index.js';

export type Niveau = 'iedereen' | 'gevorderd' | 'expert';

/** Klaar, nog te doen, kan erbij (niet nodig), of niet te zien vanuit SunArc. */
export type StapStand = 'klaar' | 'open' | 'kan' | 'onbekend';

export interface KlaarStap {
  readonly id: string;
  readonly titel: string;
  readonly zin: string;
  readonly stand: StapStand;
  /** Een pagina in Home Assistant, als pad voor zijn navigatie. */
  readonly ha: string | null;
  /** Of een pagina in de app. */
  readonly app: string | null;
  /** Wat SunArc na een tik zelf doet; alleen de spraakassistent (besluit 203). */
  readonly doe: 'spraakassistent' | null;
}

export interface KlaarFunctie {
  readonly id: string;
  readonly niveau: Niveau;
  readonly titel: string;
  /** Wat de functie doet, boven de stappen. */
  readonly wat: string;
  /** Onder de naam in de lijst: wat er staat, of hoeveel er nog open is. */
  readonly zin: string;
  readonly stappen: readonly KlaarStap[];
  /** Hoeveel er klaar is van wat telt (klaar en open); kan erbij en onbekend tellen niet. */
  readonly klaar: number;
  readonly van: number;
  /** Bij de cloud: welke routes er al staan. */
  readonly wolken?: readonly Wolk[];
}

/** Wat de wand zelf over Fully Kiosk meldt (besluit 246). */
export interface WandMelding {
  /** De pagina draait in Fully Kiosk Browser. */
  readonly fully: boolean;
  /** De JavaScript-interface van Fully staat aan. */
  readonly js: boolean;
  /** De camera kijkt mee voor beweging; null als Fully het niet zegt. */
  readonly camera: boolean | null;
  readonly ms: number;
}

/** Een diensten-platform voor verstaan of stem buiten huis. */
export type Wolk = 'cloud' | 'google' | 'openai';

export interface KlaarExtra {
  readonly addOn: boolean;
  readonly eigenPoort: boolean;
  /** De naam van deze add-on bij de Supervisor, voor de pagina met zijn instellingen. */
  readonly eigenSlug: string | null;
  /** Helemaal in huis (besluit 203); null buiten de add-on. */
  readonly inHuis: InHuisStand | null;
  /** Het model van Whisper; undefined als SunArc het niet kan lezen. */
  readonly whisperModel: string | null | undefined;
  /** Of de Tailscale-add-on draait; null als SunArc het niet kan lezen. */
  readonly tailscale: boolean | null;
  /** Wat de wand het laatst meldde, of null. */
  readonly wand: WandMelding | null;
  /** Of er een scherm aan de wand is (een account voor de wand, of een melding). */
  readonly heeftWand: boolean;
  /** Functies › Scherm: uit 's nachts of als niemand thuis is, en wat hem wekt. */
  readonly schermUit: boolean;
  readonly wekker: string | null;
  /** De diensten buiten huis die verstaan of een stem geven. */
  readonly wolken: readonly Wolk[];
  readonly spraak: readonly SpraakKeuze[];
  /** Hoe laat het is, voor "gezien om". */
  readonly tijd: (ms: number) => string;
}

/** Modellen van Whisper die huiswoorden als "screen" en "zolder" slecht verstaan. */
const KLEIN_MODEL = /^(tiny|base)(-int8)?$|^auto$/;
const TAILSCALE = 'a0d7b954_tailscale';

const WOORDEN = perTaal('klaarFuncties');

const stap = (id: string, titel: string, zin: string, stand: StapStand, ha: string | null = null, app: string | null = null, doe: KlaarStap['doe'] = null): KlaarStap => ({ id, titel, zin, stand, ha, app, doe });

/** Een stap uit Klaarzetten in Home Assistant (besluit 179): wat ontbreekt en niet nodig is, kan erbij. */
const uitPunt = (p: KlaarPunt | undefined): KlaarStap[] => (p ? [stap(p.id, p.titel, p.zin, p.stand === 'klaar' ? 'klaar' : p.stand === 'mist' ? 'open' : 'kan', p.stand === 'klaar' ? null : p.pad)] : []);

export function klaarFuncties(punten: readonly KlaarPunt[], x: KlaarExtra, lang: Lang = 'nl'): KlaarFunctie[] {
  const w = WOORDEN[lang];
  const s = w.s;
  const p = (id: string) => punten.find((q) => q.id === id);
  const functie = (id: string, niveau: Niveau, [titel, wat, rust]: readonly [string, string, string], stappen: readonly KlaarStap[]): KlaarFunctie => {
    const tel = stappen.filter((q) => q.stand === 'klaar' || q.stand === 'open');
    const klaar = tel.filter((q) => q.stand === 'klaar').length;
    const open = tel.length - klaar;
    // Niets dat telt (alles kan erbij): geen vinkje, want er staat ook niets.
    return { id, niveau, titel, wat, zin: open ? w.nog(open) : tel.length ? rust : w.kan, stappen, klaar, van: tel.length };
  };

  // De assistent in huis: in de add-on de drie add-ons en de spraakassistent (besluit 203); daarbuiten wat Home Assistant zegt.
  const ih = x.inHuis;
  const addon = (id: string) => ih?.addons.find((a) => a.id === id);
  const staat = (id: string): StapStand => (addon(id)?.staat === 'aan' ? 'klaar' : 'open');
  const pagina = (id: string) => `/hassio/addon/${addon(id)?.slug ?? `core_${id}`}/info`;
  const zinVan = (id: string, [, klaar, open]: readonly string[]) => (addon(id)?.staat === 'aan' ? klaar! : addon(id)?.staat === 'gevonden' ? s.gevonden : open!);
  const model = x.whisperModel;
  const owvAan = addon('openwakeword')?.staat === 'aan';
  const wekwoord = ih?.assistent?.wekwoord != null || x.spraak.some((q) => q.wekwoord);
  const kanMaken = ih != null && ['whisper', 'piper'].every((id) => addon(id)?.staat !== 'nee');
  const assistent = ih
    ? [
        stap('whisper', s.whisper[0], zinVan('whisper', s.whisper), staat('whisper'), staat('whisper') === 'klaar' ? null : pagina('whisper')),
        model === undefined
          ? stap('model', s.model.titel, s.model.onbekend, 'onbekend', pagina('whisper'))
          : model == null
            ? stap('model', s.model.titel, s.model.onbekend, 'kan', pagina('whisper'))
            : KLEIN_MODEL.test(model)
              ? stap('model', s.model.titel, s.model.open(model), 'open', pagina('whisper'))
              : stap('model', s.model.titel, s.model.klaar(model), 'klaar'),
        stap('piper', s.piper[0], zinVan('piper', s.piper), staat('piper'), staat('piper') === 'klaar' ? null : pagina('piper')),
        stap('wekwoord', s.owv.titel, wekwoord ? s.owv.klaar : owvAan ? s.owv.kies : s.owv.add, wekwoord ? 'klaar' : 'open', wekwoord ? null : owvAan ? '/config/voice-assistants/assistants' : pagina('openwakeword')),
        stap('spraakassistent', s.maak[0], ih.assistent ? s.maak[1] : kanMaken ? s.maak[2] : s.maak[3], ih.assistent ? 'klaar' : 'open', null, null, ih.assistent || ih.bezig || !kanMaken ? null : 'spraakassistent'),
      ]
    : [...uitPunt(p('spraak')), ...uitPunt(p('wekwoord'))];

  /*
   * De wand: wat hij zelf meldt (besluit 246), en Functies › Scherm. Open is
   * alleen wat de wand zelf zegt dat mist: de koppeling met
   * de pagina, of de camera als die de wand moet wekken. Nog niet gemeld, geen
   * wekker of het scherm aan laten is een keuze, geen tekort.
   */
  const m = x.wand;
  const tijd = m ? x.tijd(m.ms) : '';
  const fully = m?.fully === true;
  const beweging: StapStand = x.wekker != null && x.wekker !== 'fully' ? 'klaar' : x.wekker === 'fully' ? (!fully || m?.camera == null ? 'onbekend' : m.camera ? 'klaar' : 'open') : 'kan';
  const wand = !x.heeftWand
    ? [stap('fully', s.fully.titel, w.geenWand, 'kan')]
    : fully
      ? [
          stap('fully', s.fully.titel, s.fully.klaar(tijd), 'klaar'),
          stap('js', s.js[0], m?.js ? s.js[1] : s.js[2], m?.js ? 'klaar' : 'open'),
          stap('beweging', s.camera.titel, beweging === 'klaar' ? s.camera[x.wekker === 'fully' ? 'fully' : 'melder'] : s.camera.open, beweging, null, beweging === 'klaar' ? null : 'jij.html#uit'),
          stap('uit', s.uit[0], x.schermUit ? s.uit[1] : s.uit[2], x.schermUit ? 'klaar' : 'kan', null, x.schermUit ? null : 'jij.html#uit'),
        ]
      : [
          stap('fully', s.fully.titel, m ? s.fully.anders(tijd) : s.fully.nogNiet, 'kan'),
          stap('uit', s.uit[0], x.schermUit ? s.uit[1] : s.uit[2], x.schermUit ? 'klaar' : 'kan', null, x.schermUit ? null : 'jij.html#uit'),
        ];

  // De cloud: welke dienst er al staat, en of een spraakassistent hem gebruikt.
  const wolkNamen = x.wolken.map((q) => w.wolk[q]).join(', ');
  const naarWolk = x.spraak.some((q) => q.wolk === true);
  const cloud = [
    stap('wolk', s.wolk.titel, x.wolken.length ? s.wolk.klaar(wolkNamen) : s.wolk.open, x.wolken.length ? 'klaar' : 'open'),
    stap('naarWolk', s.naarWolk[0], naarWolk ? s.naarWolk[1] : s.naarWolk[2], naarWolk ? 'klaar' : 'open', naarWolk ? null : '/config/voice-assistants/assistants'),
  ];

  // De losse app (besluit 108 en 160): alleen in de add-on.
  const tsStand: StapStand = x.tailscale === true || x.eigenPoort ? 'klaar' : x.tailscale === false ? 'open' : 'onbekend';
  const tel = [
    stap('tailscale', s.ts.titel, tsStand === 'klaar' ? s.ts.klaar : tsStand === 'open' ? s.ts.open : s.ts.onbekend, tsStand, tsStand === 'klaar' ? null : `/hassio/addon/${TAILSCALE}/info`),
    stap('poort', s.poort[0], x.eigenPoort ? s.poort[1] : s.poort[2], x.eigenPoort ? 'klaar' : 'open', x.eigenPoort || !x.eigenSlug ? null : `/hassio/addon/${x.eigenSlug}/config`),
    // Of het op een telefoon staat, kan SunArc niet zien.
    stap('optel', s.opTel[0], s.opTel[1], 'onbekend', null, 'jij.html#startscherm'),
  ];

  return [
    functie('huis', 'iedereen', w.huis, [...uitPunt(p('locatie')), ...uitPunt(p('ruimtes')), ...uitPunt(p('personen')), ...uitPunt(p('telefoon'))]),
    functie('klimaat', 'iedereen', w.klimaat, [...uitPunt(p('klimaat')), ...uitPunt(p('temperatuur'))]),
    functie('energie', 'iedereen', w.energie, [...uitPunt(p('netmeter')), ...uitPunt(p('omvormer')), ...uitPunt(p('energiedashboard'))]),
    functie('licht', 'iedereen', w.licht, [...uitPunt(p('lampen')), ...uitPunt(p('schermen'))]),
    functie('witgoed', 'iedereen', w.witgoed, uitPunt(p('opzon'))),
    functie('weer', 'iedereen', w.weer, uitPunt(p('weer'))),
    functie('assistent', 'iedereen', w.assistent, assistent),
    functie('wand', 'iedereen', w.wand, wand),
    functie('taalmodel', 'gevorderd', w.taalmodel, uitPunt(p('taalmodel'))),
    { ...functie('cloud', 'gevorderd', w.cloud, cloud), wolken: x.wolken },
    ...(x.addOn ? [functie('telefoon', 'expert', w.tel, tel)] : []),
  ];
}

/** De diensten buiten huis die als spraak naar tekst of stem in Home Assistant staan, aan hun platform. */
export function wolkenVan(entiteiten: readonly { readonly entity_id: string; readonly platform?: string | null }[]): Wolk[] {
  const uit = new Set<Wolk>();
  for (const e of entiteiten) {
    if (!/^(stt|tts)\./.test(e.entity_id)) continue;
    const p = e.platform ?? '';
    if (p === 'cloud') uit.add('cloud');
    else if (p === 'google_cloud') uit.add('google');
    else if (p.startsWith('openai')) uit.add('openai');
  }
  return [...uit];
}
