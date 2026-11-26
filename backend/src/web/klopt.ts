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
import { withArticle, type Lang } from './assistant.js';
import type { RegelingNiet } from './regeling.js';
import { regelKamers, type LayoutRoom } from './layout.js';
import { perTaal } from '../taal/index.js';

export type KloptFeit =
  | { readonly soort: 'zekering'; readonly fasen: number; readonly ampere: number; readonly meters: number }
  | ({ readonly soort: 'vermogen' | 'geenKlimaat' | 'kanNiet' } & Omit<RegelingNiet, 'waarom'>)
  /** `meeMet`: de thermostaat in een andere kamer die deze kamer mee verwarmt, of null. */
  | { readonly soort: 'alleenHelpt'; readonly zoneId: string; readonly kamer: string; readonly kamerId: string | null; readonly meeMet?: string | null }
  | { readonly soort: 'terug' | 'opZon'; readonly id: string; readonly naam: string; readonly sindsMs: number }
  | { readonly soort: 'gepland'; readonly id: string; readonly tekst: string; readonly sindsMs: number }
  | { readonly soort: 'weer'; readonly sindsMs: number }
  /** De buitenmeter zit al een uur te ver van het weer, en het weer nam het over (besluit 354). */
  | { readonly soort: 'buiten'; readonly naam: string; readonly sindsMs: number };

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
  #buiten: Extract<KloptFeit, { soort: 'buiten' }> | null = null;

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

  /** Of het weer de buitenmeter overnam (besluit 354); null als de meter weer telt. */
  buiten(afwijkend: { readonly naam: string; readonly sindsMs: number } | null): void {
    this.#buiten = afwijkend ? { soort: 'buiten', naam: afwijkend.naam, sindsMs: afwijkend.sindsMs } : null;
  }

  lijst(nu: number): KloptFeit[] {
    for (const [k, v] of this.#feiten) if (v.totMs <= nu) this.#feiten.delete(k);
    const uit = [...this.#feiten.values()].map((v) => v.feit);
    if (this.#weerSindsMs != null && nu - this.#weerSindsMs >= WEER_NA_MS) uit.push({ soort: 'weer', sindsMs: this.#weerSindsMs });
    if (this.#buiten) uit.push(this.#buiten);
    return uit;
  }
}

const WOORD = perTaal('klopt');

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
    case 'buiten':
      return { id: 'bron:buiten', soort: 'bron', aandacht: true, titel: w.buiten.titel(f.naam), tekst: w.buiten.tekst, actie: { label: w.bekijk, href: 'motor.html' }, klaar: paar(w.buiten.klaar(f.naam)), sindsMs: f.sindsMs };
  }
}

/**
 * De thermostaat die een kamer mee verwarmt: een radiator of
 * vloer die een thermostaat in een andere kamer volgt. Bij een zone met een
 * eigen regeling (zones als deel van de kamer) ook de
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
