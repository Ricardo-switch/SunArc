/**
 * Wat niet klopt, als melding met een knop (besluit 314).
 *
 * De dienst schreef dit alleen naar het logboek. In elk logboek dat een tester
 * meestuurde stond zes keer "Uit de app niet overgenomen: 3 × 25 A, maar 0
 * stroommeters per fase gevonden": de app wist een week dat er iets niet klopte
 * en zei het tegen niemand. Drie groepen horen bij de bewoner:
 *
 *   1. Je koos iets, en SunArc kon het niet overnemen (`klopt`): de zekering
 *      zonder stroommeters per fase, een apparaat dat op zon moet helpen zonder
 *      vermogen, een kamer waar niets op temperatuur houdt.
 *   2. SunArc deed iets, en het lukte niet (`mislukt`): terugzetten na met de
 *      hand, aanzetten op zon, een geplande taak.
 *   3. Iets van buiten komt niet binnen (`bron`): de weersverwachting, pas na
 *      zes uur, zodat een korte storing geen melding geeft.
 *
 * Wat over de server gaat (de deuren open, lezen zonder inlog) is voor wie de
 * server beheert en blijft in het logboek.
 *
 * Hier de feiten en de woorden, zuiver en te toetsen. Groep 1 volgt elke ronde
 * uit de keuzes van nu, dus de melding gaat vanzelf weg als de keuze klopt.
 * Groep 2 en 3 zijn gebeurtenissen: de dienst meldt ze bij het register, en ze
 * gaan weg als het daarna wel lukt of na een tijd.
 */

import type { SiteConfig } from '../core/model.js';
import type { ConnectionAnswers } from './aansluiting.js';
import { cap, withArticle, type Lang } from './assistant.js';
import type { RegelingNiet } from './regeling.js';
import { regelKamers, type LayoutRoom } from './layout.js';

export type KloptFeit =
  | { readonly soort: 'zekering'; readonly fasen: number; readonly ampere: number; readonly meters: number }
  | ({ readonly soort: 'vermogen' | 'geenKlimaat' | 'kanNiet' } & Omit<RegelingNiet, 'waarom'>)
  /** `meeMet`: de thermostaat in een andere kamer die deze kamer mee verwarmt, of null. */
  | { readonly soort: 'alleenHelpt'; readonly zoneId: string; readonly kamer: string; readonly kamerId: string | null; readonly meeMet?: string | null }
  | { readonly soort: 'terug' | 'opZon'; readonly id: string; readonly naam: string; readonly sindsMs: number }
  | { readonly soort: 'gepland'; readonly id: string; readonly tekst: string; readonly sindsMs: number }
  | { readonly soort: 'weer'; readonly sindsMs: number };

/** De melding zoals de bel hem bewaart, zonder de tijden. */
export interface KloptMelding {
  readonly id: string;
  readonly soort: 'klopt' | 'mislukt' | 'bron';
  readonly aandacht: true;
  readonly titel: string;
  readonly tekst: string;
  readonly actie: { readonly label: string; readonly href: string };
  /** Een keuze die mag blijven: dan staat er *Laat zo* bij. */
  readonly laat?: true;
  readonly klaar?: { readonly titel: string; readonly tekst: string };
  readonly sindsMs?: number;
}

export interface KloptVast {
  readonly answers: ConnectionAnswers | null;
  /** Hoeveel stroommeters per fase de configuratie zelf al noemt. */
  readonly configFasen: number;
  readonly regelingNiet: readonly RegelingNiet[];
  readonly config: SiteConfig;
  /** De kamer in de indeling die bij een zone hoort, voor de knop. */
  readonly kamerVanZone: (zoneId: string) => string | null;
  /**
   * De thermostaat in een andere kamer die deze kamer mee verwarmt, zoals een
   * radiator op de cv die de Nest beneden volgt. Dan wordt de kamer wel
   * verwarmd, alleen niet apart.
   */
  readonly meeMet?: (zoneId: string) => string | null;
}

/** Groep 1: wat de bewoner koos en de regeling niet kon overnemen, uit de keuzes van nu. */
export function kloptVast(i: KloptVast): KloptFeit[] {
  const uit: KloptFeit[] = [];
  const fuse = i.answers?.zekering;
  if (fuse != null && fuse !== 'weetniet' && i.configFasen !== fuse.fasen) {
    const meters = i.answers?.fasen.length ?? 0;
    if (Math.min(meters, fuse.fasen) !== fuse.fasen) uit.push({ soort: 'zekering', fasen: fuse.fasen, ampere: fuse.ampere, meters });
  }
  for (const n of i.regelingNiet) uit.push({ soort: n.waarom, id: n.id, naam: n.naam, kamerId: n.kamerId, kamer: n.kamer });
  for (const z of i.config.zones) {
    const rollen = z.actuatorIds.map((id) => i.config.actuators.find((a) => a.id === id)).filter((a) => a != null);
    if (rollen.length > 0 && rollen.every((a) => a.role === 'assist')) uit.push({ soort: 'alleenHelpt', zoneId: z.id, kamer: z.name, kamerId: i.kamerVanZone(z.id), meeMet: i.meeMet?.(z.id) ?? null });
  }
  return uit;
}

const UUR = 3_600_000;
/** Zo lang moet de weersverwachting ontbreken voor het een melding is. */
export const WEER_NA_MS = 6 * UUR;

/**
 * Groep 2 en 3: wat de dienst meldt als iets mislukt. Hetzelfde onderwerp
 * houdt zijn eerste tijdstip; lukt het daarna wel, dan gaat het weg. Niet
 * bewaard: na een herstart begint het leeg, en dat is goed, want wat nog
 * steeds mislukt, meldt zich opnieuw.
 */
export class KloptRegister {
  readonly #feiten = new Map<string, { feit: KloptFeit; totMs: number }>();
  #weerSindsMs: number | null = null;

  /** Iets lukte niet; `duurMs` is hoe lang de melding hooguit blijft staan. */
  meld(feit: Extract<KloptFeit, { soort: 'terug' | 'opZon' | 'gepland' }>, duurMs = 12 * UUR): void {
    const sleutel = `${feit.soort}:${feit.id}`;
    const was = this.#feiten.get(sleutel)?.feit;
    this.#feiten.set(sleutel, { feit: was && 'sindsMs' in was ? { ...feit, sindsMs: was.sindsMs } : feit, totMs: feit.sindsMs + duurMs });
  }

  /** Het lukte daarna wel. */
  gelukt(soort: 'terug' | 'opZon' | 'gepland', id: string): void {
    this.#feiten.delete(`${soort}:${id}`);
  }

  /** De weersverwachting kwam niet binnen, of juist wel. */
  weer(ok: boolean, nu: number): void {
    if (ok) this.#weerSindsMs = null;
    else this.#weerSindsMs ??= nu;
  }

  lijst(nu: number): KloptFeit[] {
    for (const [k, v] of this.#feiten) if (v.totMs <= nu) this.#feiten.delete(k);
    const uit = [...this.#feiten.values()].map((v) => v.feit);
    if (this.#weerSindsMs != null && nu - this.#weerSindsMs >= WEER_NA_MS) uit.push({ soort: 'weer', sindsMs: this.#weerSindsMs });
    return uit;
  }
}

const WOORD = {
  nl: {
    bekijk: 'Bekijk',
    zekering: {
      titel: 'De zekering telt nog niet mee',
      tekst: (fasen: number, ampere: number, meters: number) =>
        `Je koos ${fasen} × ${ampere} A, maar er ${meters === 0 ? 'is geen stroommeter' : meters === 1 ? 'is één stroommeter' : `zijn ${meters} stroommeters`} per fase gevonden. Zonder die meters bewaakt SunArc de zekering niet.`,
      actie: 'Kies de meters',
      klaar: ['De zekering telt weer mee', 'De stroommeters per fase zijn er.'],
    },
    vermogen: {
      titel: (naam: string) => `${cap(naam)} helpt nog niet op zon`,
      tekst: 'Je koos helpt op zon, maar daarvoor is zijn vermogen nodig. Tot dan doet hij niet mee.',
      actie: 'Vul het vermogen in',
      klaar: (naam: string) => [`${cap(naam)} helpt op zon`, 'Het vermogen is ingevuld.'],
    },
    geenKlimaat: {
      titel: (naam: string) => `${cap(naam)} kan geen kamer regelen`,
      tekst: (kamer: string) => `Het staat bij ${kamer} als verwarming of koeling, maar het is geen klimaatapparaat.`,
      actie: 'Kies iets anders',
    },
    kanNiet: {
      titel: (naam: string) => `${cap(naam)} doet nog niet mee`,
      tekst: 'Home Assistant zegt niet of het kan verwarmen of koelen. Is het apparaat bereikbaar?',
    },
    alleenHelpt: {
      titel: (kamer: string) => `Niets houdt ${kamer} op temperatuur`,
      tekst: 'Wat er hangt, helpt alleen als er zon over is. Zonder zon wordt de kamer niet verwarmd of gekoeld.',
      // Er hangt een radiator of vloer die een thermostaat in een andere kamer volgt (16 november 2026).
      titelMee: (kamer: string, met: string) => `${cap(kamer)} verwarmt mee met ${met}`,
      tekstMee: 'SunArc kan deze kamer niet apart verwarmen. Wat er verder hangt, helpt alleen als er zon over is.',
      actie: 'Kies wat regelt',
    },
    terug: {
      titel: (naam: string) => `${cap(naam)} staat nog met de hand`,
      tekst: 'Met de hand was voorbij, maar terugzetten lukte niet. Zet het apparaat zelf terug.',
    },
    opZon: {
      titel: (naam: string) => `${cap(naam)} ging niet aan op zon`,
      tekst: 'Er was zon over, maar Home Assistant nam het aanzetten niet aan. SunArc probeert het opnieuw.',
    },
    gepland: { titel: 'Een geplande taak is niet gedaan', tekst: (wat: string) => `“${wat}” lukte niet.` },
    weer: {
      titel: 'Geen weersverwachting',
      tekst: (uren: number) => `De weerbron geeft al ${uren} uur geen verwachting. De zon van morgen en het laadadvies kloppen dan minder goed.`,
      actie: 'Kies een weerbron',
      klaar: ['De weersverwachting is er weer', 'De weerbron geeft weer een verwachting.'],
    },
  },
  en: {
    bekijk: 'View',
    zekering: {
      titel: 'The main fuse does not count yet',
      tekst: (fasen: number, ampere: number, meters: number) =>
        `You chose ${fasen} × ${ampere} A, but ${meters === 0 ? 'no current meter' : meters === 1 ? 'one current meter' : `${meters} current meters`} per phase ${meters === 1 || meters === 0 ? 'was' : 'were'} found. Without those meters SunArc does not guard the fuse.`,
      actie: 'Choose the meters',
      klaar: ['The main fuse counts again', 'The current meters per phase are there.'],
    },
    vermogen: {
      titel: (naam: string) => `${cap(naam)} does not help on solar yet`,
      tekst: 'You chose helps on solar, but that needs its power. Until then it does not take part.',
      actie: 'Enter the power',
      klaar: (naam: string) => [`${cap(naam)} helps on solar`, 'The power has been entered.'],
    },
    geenKlimaat: {
      titel: (naam: string) => `${cap(naam)} cannot control a room`,
      tekst: (kamer: string) => `It is listed under ${kamer} as heating or cooling, but it is not a climate device.`,
      actie: 'Choose something else',
    },
    kanNiet: {
      titel: (naam: string) => `${cap(naam)} does not take part yet`,
      tekst: 'Home Assistant does not say whether it can heat or cool. Is the device reachable?',
    },
    alleenHelpt: {
      titel: (kamer: string) => `Nothing keeps ${kamer} at temperature`,
      tekst: 'What is there only helps when there is solar to spare. Without sun the room is not heated or cooled.',
      titelMee: (kamer: string, met: string) => `${cap(kamer)} heats along with ${met}`,
      tekstMee: 'SunArc cannot heat this room separately. What else is there only helps when there is solar to spare.',
      actie: 'Choose what controls',
    },
    terug: {
      titel: (naam: string) => `${cap(naam)} is still set by hand`,
      tekst: 'By hand had ended, but setting it back failed. Set the device back yourself.',
    },
    opZon: {
      titel: (naam: string) => `${cap(naam)} did not switch on with solar`,
      tekst: 'There was solar to spare, but Home Assistant did not accept switching on. SunArc will try again.',
    },
    gepland: { titel: 'A planned task was not done', tekst: (wat: string) => `“${wat}” failed.` },
    weer: {
      titel: 'No weather forecast',
      tekst: (uren: number) => `The weather source has given no forecast for ${uren} hours. Tomorrow's sun and the charging advice are less accurate then.`,
      actie: 'Choose a weather source',
      klaar: ['The weather forecast is back', 'The weather source gives a forecast again.'],
    },
  },
} as const;

const paar = (p: readonly [string, string] | readonly string[]) => ({ titel: p[0]!, tekst: p[1]! });
const naarKamer = (kamerId: string | null) => (kamerId ? `comfort.html#${encodeURIComponent(kamerId)}` : 'comfort.html');

/** Een feit als melding, in één taal. */
export function kloptMelding(f: KloptFeit, lang: Lang, nu: number): KloptMelding {
  const w = WOORD[lang];
  switch (f.soort) {
    case 'zekering':
      return { id: 'klopt:zekering', soort: 'klopt', aandacht: true, titel: w.zekering.titel, tekst: w.zekering.tekst(f.fasen, f.ampere, f.meters), actie: { label: w.zekering.actie, href: 'energie.html#meters' }, klaar: paar(w.zekering.klaar) };
    case 'vermogen':
      return { id: `klopt:vermogen:${f.id}`, soort: 'klopt', aandacht: true, titel: w.vermogen.titel(f.naam), tekst: w.vermogen.tekst, actie: { label: w.vermogen.actie, href: naarKamer(f.kamerId) }, klaar: paar(w.vermogen.klaar(f.naam)) };
    case 'geenKlimaat':
      return { id: `klopt:geenklimaat:${f.id}`, soort: 'klopt', aandacht: true, titel: w.geenKlimaat.titel(f.naam), tekst: w.geenKlimaat.tekst(withArticle(f.kamer, lang)), actie: { label: w.geenKlimaat.actie, href: naarKamer(f.kamerId) }, laat: true };
    case 'kanNiet':
      return { id: `klopt:kanniet:${f.id}`, soort: 'klopt', aandacht: true, titel: w.kanNiet.titel(f.naam), tekst: w.kanNiet.tekst, actie: { label: w.bekijk, href: naarKamer(f.kamerId) } };
    case 'alleenHelpt':
      return { id: `klopt:zone:${f.zoneId}`, soort: 'klopt', aandacht: true, titel: f.meeMet ? w.alleenHelpt.titelMee(withArticle(f.kamer, lang), f.meeMet) : w.alleenHelpt.titel(withArticle(f.kamer, lang)), tekst: f.meeMet ? w.alleenHelpt.tekstMee : w.alleenHelpt.tekst, actie: { label: w.alleenHelpt.actie, href: naarKamer(f.kamerId) }, laat: true };
    case 'terug':
      return { id: `mislukt:terug:${f.id}`, soort: 'mislukt', aandacht: true, titel: w.terug.titel(f.naam), tekst: w.terug.tekst, actie: { label: w.bekijk, href: 'apparaten.html' }, sindsMs: f.sindsMs };
    case 'opZon':
      return { id: `mislukt:opzon:${f.id}`, soort: 'mislukt', aandacht: true, titel: w.opZon.titel(f.naam), tekst: w.opZon.tekst, actie: { label: w.bekijk, href: 'apparaten.html' }, sindsMs: f.sindsMs };
    case 'gepland':
      return { id: `mislukt:gepland:${f.id}`, soort: 'mislukt', aandacht: true, titel: w.gepland.titel, tekst: w.gepland.tekst(f.tekst), actie: { label: w.bekijk, href: 'gepland.html' }, sindsMs: f.sindsMs };
    case 'weer':
      return { id: 'bron:weer', soort: 'bron', aandacht: true, titel: w.weer.titel, tekst: w.weer.tekst(Math.floor((nu - f.sindsMs) / UUR)), actie: { label: w.weer.actie, href: 'functies.html#weer' }, klaar: paar(w.weer.klaar), sindsMs: f.sindsMs };
  }
}

/**
 * De thermostaat die een kamer mee verwarmt (16 november 2026): een radiator of
 * vloer die een thermostaat in een andere kamer volgt. Bij een zone met een
 * eigen regeling (zones als deel van de kamer, 18 november 2026) ook de
 * radiator van de kamer waar de zone bij hoort, in die zone of in de hele kamer.
 * De naam van dat apparaat, of null.
 */
export function verwarmtMeeMet(zoneId: string, config: SiteConfig, kamers: readonly LayoutRoom[]): string | null {
  const eigen = new Set(config.zones.find((z) => z.id === zoneId)?.actuatorIds ?? []);
  const kamer = regelKamers(kamers).find((k) => k.regelzone === zoneId);
  const ouder = kamers.find((k) => k.zones.some((z) => z.regelzone === zoneId));
  const zone = ouder?.zones.find((z) => z.regelzone === zoneId);
  const vanOuder = (ouder?.bronnen ?? []).filter((b) => !b.zone || b.zone === zone?.id);
  for (const b of [...(kamer?.bronnen ?? []), ...vanOuder]) {
    if (!b.apparaat) continue;
    const a = config.actuators.find((x) => x.id === b.apparaat || x.ref.id === b.apparaat);
    if (a && !eigen.has(a.id)) return a.name;
  }
  return null;
}
