/*
 * Je huis tekenen (besluit 308, stap 1): wat de tekentafel bewaart, en de vorm
 * waarop hij tekent.
 *
 * Een etage is ruitjespapier van 10 cm; elk ruitje hoort bij één ruimte of
 * ligt buiten (frontend/kit/huistekenen.js). Bewaard wordt per etage een lijst
 * ruimtes, elk met de rechthoeken waaruit hij bestaat, in meters. Een ruimte
 * is een kamer uit de indeling, een eigen naam zonder kamer (hal, toilet,
 * trap), of een vak zonder naam. De boom van lijnen uit besluit 288 vervalt:
 * een muur schuiven verandert alleen de twee ruimtes ernaast.
 *
 * Daarbij per kamer de zonelijn (een stippellijn langs u of v, geen muur) en
 * per apparaat een plek. Alles in meters vanaf de linker voorhoek van het
 * hoofdhuis, zoals je er vanaf de straat naar kijkt: u naar rechts langs de
 * voorgevel, v naar achter. Zo blijft een tekening staan als er links een
 * garage bij komt.
 *
 * Een kamer die verdwijnt of naar een andere etage verhuist, maakt het
 * bewaren nooit onmogelijk: zijn vak blijft, zonder kamer.
 */
import type { Daken, Dakvorm, DakVlak, EigenKapel, Gebouw, GebouwSoort, KaartDakvlak, WegGebouw, Xy } from './daken.js';
import { maatAs, rechthoekOm, tekening as dakTekening } from './daken-tekening.js';

export type As = 'u' | 'v';

/** Een rechthoek in meters: [u, v, breed, diep]. */
export type Vak = readonly [u: number, v: number, breed: number, diep: number];

/** Een ruimte op een etage: een kamer, een eigen naam (met een soort), of niets. */
export interface TekenRuimte {
  readonly kamer?: string;
  readonly naam?: string;
  readonly soort?: EigenSoort;
  /** Bij een trap (0.187.0): naar welke kant hij omhoog gaat. n is naar achter, z naar de straat, w links, o rechts. */
  readonly omhoog?: TrapRichting;
  readonly vakken: readonly Vak[];
}
export const TRAP_RICHTINGEN = ['n', 'z', 'o', 'w'] as const;

/*
 * Buiten als eigen tekening (stap 3, 19 november 2026): het erf is een etage
 * (`buiten`). Het huis ligt erop als één vast vak, `HUIS_OP_ERF`. Een deel van
 * een ruimte buiten (het terras in de tuin) is een eigen vak: `kamer~zone`.
 * Zo heeft de tuin zoveel delen als hij zones heeft, elk met zijn eigen vorm.
 */
export const HUIS_OP_ERF = '@huis';
export const DEEL = '~';
/** Een ruimte op het erf: het huis, een ruimte buiten, of een deel ervan (`kamer~zone`). */
export function erfRuimteOk(id: string, kamers: readonly { readonly id: string; readonly etage: string; readonly zones: readonly { readonly id: string }[] }[], buiten: string): boolean {
  if (id === HUIS_OP_ERF) return true;
  const [kamer, zone, rest] = id.split(DEEL);
  if (rest !== undefined) return false;
  const k = kamers.find((x) => x.id === kamer && x.etage === buiten);
  return !!k && (zone === undefined || k.zones.some((z) => z.id === zone));
}
/**
 * Het erf om de gebouwen heen, als er nog niets getekend is: 3 m opzij van
 * alles, 6 m voor het huis naar de straat en 12 m erachter, en altijd 3 m om
 * een gebouw dat al verder staat (een tuinhuis achterin).
 */
export function erfOm(
  blokken: readonly { readonly soort: string; readonly u: number; readonly v: number; readonly b: number; readonly d: number }[],
  omgeving: readonly { readonly punten: readonly (readonly [number, number])[] }[] = [],
): { u: number; v: number; b: number; d: number } | null {
  if (!blokken.length) return null;
  const huis = blokken.filter((x) => x.soort === 'hoofdhuis');
  const kern = huis.length ? huis : blokken;
  let u0 = Math.min(...blokken.map((x) => x.u)) - 3;
  const v0 = Math.min(Math.min(...kern.map((x) => x.v)) - 6, Math.min(...blokken.map((x) => x.v)) - 3);
  let u1 = Math.max(...blokken.map((x) => x.u + x.b)) + 3;
  /*
   * Een buurhuis vast aan het huis (20 november 2026, Ricardo: een
   * twee-onder-een-kap staat tegen de erfgrens): staat een gebouw van de kaart
   * tegen het buitenste gebouw aan een kant (het huis, of de garage ernaast:
   * Ricardo, ook links tegen de garage), dan ligt de erfgrens daar strak
   * tegenaan, zonder strook ertussen. Alleen een woning (vanaf 40 m²) telt:
   * een grijze garage of schuur is geen buur.
   */
  const opp = (pp: readonly (readonly [number, number])[]) => Math.abs(pp.reduce((t, p, i) => { const q = pp[(i + 1) % pp.length]!; return t + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  const [links, rechts] = [Math.min(...blokken.map((x) => x.u)), Math.max(...blokken.map((x) => x.u + x.b))];
  const tegen = (b: (typeof blokken)[number], kant: 1 | -1) => {
    const rand = kant === 1 ? b.u + b.b : b.u;
    return omgeving.some((o) => opp(o.punten) >= 40 && o.punten.some(([u, v]) => Math.abs(u - rand) <= 0.8 && v >= b.v - 0.5 && v <= b.v + b.d + 0.5) && o.punten.some(([u]) => (u - rand) * kant > 1));
  };
  if (blokken.some((b) => b.u + b.b >= rechts - 0.1 && tegen(b, 1))) u1 = rechts;
  if (blokken.some((b) => b.u <= links + 0.1 && tegen(b, -1))) u0 = links;
  const v1 = Math.max(Math.max(...kern.map((x) => x.v + x.d)) + 12, Math.max(...blokken.map((x) => x.v + x.d)) + 3);
  return { u: m1(u0), v: m1(v0), b: m1(u1 - u0), d: m1(v1 - v0) };
}

/** Een kant van het huis, van de straat af gezien. */
export const BUUR_KANTEN = ['links', 'rechts', 'achter'] as const;
export type BuurKant = (typeof BUUR_KANTEN)[number];

/**
 * Wat voor huis het volgens de kaart is (schets Wand-Huis-Woning, 20 november
 * 2026): welke muren van het hoofdhuis tegen een buurhuis staan, met dezelfde
 * regel als de erfgrens (een woning vanaf 40 m², binnen 0,8 m van de muur).
 * Een muur links of rechts maakt een twee-onder-een-kap, of een hoekhuis als
 * het buurhuis aan zijn andere kant zelf weer tegen een huis staat; twee een
 * tussenwoning. Een garage tegen een buurhuis telt niet: hij is geen woning.
 * Null zonder gebouwen eromheen (geen kaart): dan valt er niets voor te stellen.
 */
export function woningUitKaart(
  blokken: readonly { readonly soort: string; readonly u: number; readonly v: number; readonly b: number; readonly d: number }[],
  omgeving: readonly { readonly punten: readonly (readonly [number, number])[] }[] = [],
): { soort: 'vrijstaand' | 'tweekap' | 'hoek' | 'rij'; buren: BuurKant[] } | null {
  const huis = blokken.filter((x) => x.soort === 'hoofdhuis');
  if (!huis.length || !omgeving.length) return null;
  const u0 = Math.min(...huis.map((x) => x.u));
  const u1 = Math.max(...huis.map((x) => x.u + x.b));
  const v0 = Math.min(...huis.map((x) => x.v));
  const v1 = Math.max(...huis.map((x) => x.v + x.d));
  const opp = (pp: readonly (readonly [number, number])[]) => Math.abs(pp.reduce((t, p, i) => { const q = pp[(i + 1) % pp.length]!; return t + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  const woningen = omgeving.filter((o) => opp(o.punten) >= 40);
  /*
   * Een muur van het buurhuis langs de muur van het huis, over minstens een
   * meter: een hoek die net de achterkant raakt (een buurhuis dat dieper is)
   * telt niet. `as` 0 is een muur op u = rand (links of rechts), 1 op v = rand.
   */
  const langs = (o: (typeof woningen)[number], as: 0 | 1, rand: number, a: number, b: number) =>
    o.punten.some((p, i) => {
      const q = o.punten[(i + 1) % o.punten.length]!;
      if (Math.abs(p[as] - rand) > 0.8 || Math.abs(q[as] - rand) > 0.8) return false;
      const lo = Math.max(Math.min(p[1 - as]!, q[1 - as]!), a);
      const hi = Math.min(Math.max(p[1 - as]!, q[1 - as]!), b);
      return hi - lo >= 1;
    });
  /** Het buurhuis dat tegen een muur staat, en verder dan een meter erbuiten ligt. */
  const tegenU = (lijst: typeof woningen, rand: number, kant: 1 | -1, va: number, vb: number) => lijst.find((o) => langs(o, 0, rand, va, vb) && o.punten.some(([u]) => (u - rand) * kant > 1));
  const links = tegenU(woningen, u0, -1, v0, v1);
  const rechts = tegenU(woningen, u1, 1, v0, v1);
  const achter = woningen.some((o) => langs(o, 1, v1, u0, u1) && o.punten.some(([, v]) => v - v1 > 1));
  const buren: BuurKant[] = [...(links ? ['links' as const] : []), ...(rechts ? ['rechts' as const] : []), ...(achter ? ['achter' as const] : [])];
  if (links && rechts) return { soort: 'rij', buren };
  const buur = links ?? rechts;
  if (!buur) return { soort: 'vrijstaand', buren };
  // Staat het buurhuis aan zijn andere kant zelf weer tegen een huis, dan is dit het eind van een rij.
  const bu = buur.punten.map(([u]) => u);
  const bv = buur.punten.map(([, v]) => v);
  const verder = links ? tegenU(woningen.filter((o) => o !== buur), Math.min(...bu), -1, Math.min(...bv), Math.max(...bv)) : tegenU(woningen.filter((o) => o !== buur), Math.max(...bu), 1, Math.min(...bv), Math.max(...bv));
  return { soort: verder ? 'hoek' : 'tweekap', buren };
}
export type TrapRichting = (typeof TRAP_RICHTINGEN)[number];

/**
 * Een deur, raam of de voordeur (0.187.0, keuze Ricardo: op de muur bij
 * Kamers). Hij ligt op een muurlijn: bij `as` u op u = `op`, van..tot langs
 * v; bij `as` v op v = `op`, van..tot langs u. In meters vanaf de linker
 * voorhoek van het hoofdhuis, zoals de vakken. Het id is per etage.
 */
export interface Opening {
  readonly id: string;
  readonly soort: OpeningSoort;
  readonly as: As;
  readonly op: number;
  readonly van: number;
  readonly tot: number;
  /**
   * Deuren en ramen (schets Wand-Huis-Deuren, 20 november 2026): bij een deur
   * aan welk eind het scharnier zit (weg: van), naar welke kant hij draait (1
   * naar een hogere u of v, -1 naar een lagere; weg: de kamer in), en bij een
   * schuifpui naar welk eind hij schuift (weg: van).
   */
  readonly scharnier?: 'van' | 'tot';
  readonly kant?: 1 | -1;
  readonly schuift?: 'van' | 'tot';
}
/** Sinds 20 november 2026 ook de achterdeur, openslaande deuren (dubbel) en de schuifpui. */
export const OPENING_SOORTEN = ['deur', 'raam', 'voordeur', 'achterdeur', 'dubbel', 'schuifpui'] as const;
export type OpeningSoort = (typeof OPENING_SOORTEN)[number];
const MAX_OPENINGEN = 60;

/** De deuren en ramen per etage; wat niet klopt, laat het bewaren mislukken; een etage die er niet meer is valt weg. */
export function leesOpeningen(x: unknown, etageOk: (id: string) => boolean): { openingen: Record<string, Opening[]> } | { fout: string } {
  if (!obj(x)) return { fout: 'openingen is een object per etage' };
  const uit: Record<string, Opening[]> = {};
  for (const [etage, lijst] of Object.entries(x)) {
    if (!etageOk(etage)) continue;
    if (!Array.isArray(lijst) || lijst.length > MAX_OPENINGEN) return { fout: `openingen ${etage}: een lijst van hooguit ${MAX_OPENINGEN}` };
    const gehad = new Set<string>();
    const e: Opening[] = [];
    for (const o of lijst) {
      if (!obj(o) || typeof o['id'] !== 'string' || !/^o\d{1,4}$/.test(o['id']) || gehad.has(o['id'])) return { fout: `openingen ${etage}: elk een eigen id (o1, o2, …)` };
      if (!OPENING_SOORTEN.includes(o['soort'] as OpeningSoort) || (o['as'] !== 'u' && o['as'] !== 'v')) return { fout: `openingen ${etage}: een ${OPENING_SOORTEN.join(', ')} op as u of v` };
      if (!getal(o['op'], -MAX_M, MAX_M) || !getal(o['van'], -MAX_M, MAX_M) || !getal(o['tot'], -MAX_M, MAX_M) || (o['tot'] as number) - (o['van'] as number) < 0.3 || (o['tot'] as number) - (o['van'] as number) > 6) return { fout: `openingen ${etage}: op, van en tot in meters, tussen 30 cm en 6 m breed` };
      gehad.add(o['id']);
      const eind = (w: unknown) => (w === 'van' || w === 'tot' ? w : undefined);
      const scharnier = eind(o['scharnier']);
      const schuift = eind(o['schuift']);
      const kant = o['kant'] === 1 || o['kant'] === -1 ? o['kant'] : undefined;
      e.push({ id: o['id'], soort: o['soort'] as OpeningSoort, as: o['as'], op: ruitje(o['op']), van: ruitje(o['van']), tot: ruitje(o['tot']), ...(scharnier ? { scharnier } : {}), ...(kant ? { kant } : {}), ...(schuift ? { schuift } : {}) });
    }
    if (e.length) uit[etage] = e;
  }
  return { openingen: uit };
}

/** De openingen van de hoek van het hoofdhuis naar die van het hele huis (`du`, `dv`), of terug. */
export function verschuifOpeningen(o: Readonly<Record<string, readonly Opening[]>>, du: number, dv: number): Record<string, Opening[]> {
  return Object.fromEntries(Object.entries(o).map(([e, lijst]) => [e, lijst.map((x) => (x.as === 'u' ? { ...x, op: ruitje(x.op + du), van: ruitje(x.van + dv), tot: ruitje(x.tot + dv) } : { ...x, op: ruitje(x.op + dv), van: ruitje(x.van + du), tot: ruitje(x.tot + du) }))]));
}

/** De soorten van een ruimte zonder kamer: wat de tekentafel aanbiedt, en wat een kamer kan zijn. */
export const EIGEN_SOORTEN = ['hal', 'toilet', 'overloop', 'trap', 'berging', 'badkamer', 'wasruimte', 'garage', 'kelder', 'keuken', 'bijkeuken'] as const;
export type EigenSoort = (typeof EIGEN_SOORTEN)[number];

/** De zonelijn van een kamer: waar zijn zones op elkaar aansluiten. */
export interface ZoneLijn {
  readonly as: As;
  readonly op: number;
}

/** Waar een apparaat staat: op welke etage, in meters. Weg: de tekening kiest een plek. */
export interface Plek {
  readonly etage: string;
  readonly u: number;
  readonly v: number;
}

/**
 * Wat een apparaat in de tekening is (stap 3): het icoon, en waar het staat
 * zolang het geen eigen plek heeft (een airco aan de achterwand, een lamp in
 * het midden). Een klimaatapparaat dat kan koelen is een airco, anders een
 * thermostaat.
 */
export type TekenSoort = 'airco' | 'thermostaat' | 'licht' | 'screen' | 'meter' | 'beweging' | 'camera' | 'rookmelder' | 'boiler' | 'jacuzzi' | 'witgoed' | 'radiator' | 'stekker';

/**
 * Een meter die beweging ziet, is in de tekening een bewegingsmelder (20
 * november 2026): de temperatuur die hij ook meet, is een bijfunctie in zijn
 * blad. Geen thermometer meer voor de melder in de hal.
 */
export function tekenSoort(a: { readonly soort: string; readonly witgoed?: true; readonly klimaat?: { readonly kanKoelen: boolean } | null; readonly warmte?: { readonly soort: string }; readonly radiatorknop?: unknown; readonly meting?: { readonly beweging?: unknown } | null }): TekenSoort {
  // Een radiatorknop is in de tekening een radiator met de knop eraan (22 november 2026, besluit 333).
  if (a.radiatorknop) return 'radiator';
  if (a.soort === 'klimaat') return a.klimaat?.kanKoelen ? 'airco' : 'thermostaat';
  if (a.soort === 'meter' && a.meting?.beweging) return 'beweging';
  if (a.soort === 'licht' || a.soort === 'screen' || a.soort === 'meter' || a.soort === 'camera' || a.soort === 'rookmelder') return a.soort;
  if (a.warmte?.soort === 'boiler' || a.warmte?.soort === 'jacuzzi') return a.warmte.soort;
  // De droger en ander witgoed (22 november 2026): geen stekker, en geen klimaat.
  if (a.witgoed) return 'witgoed';
  return 'stekker';
}

/**
 * Eén apparaat, één bolletje (20 november 2026): per bijfunctie het hoofd,
 * alleen als dat hoofd zelf in de tekening staat. Is de camera verborgen, dan
 * staat zijn schijnwerper weer los.
 */
export function bijfuncties(apparaten: readonly { readonly id: string; readonly hoortBij?: string | undefined }[]): Map<string, string> {
  const ids = new Set(apparaten.map((a) => a.id));
  const hoofden = new Set(apparaten.filter((a) => !a.hoortBij || !ids.has(a.hoortBij)).map((a) => a.id));
  return new Map(apparaten.filter((a) => a.hoortBij && hoofden.has(a.hoortBij)).map((a) => [a.id, a.hoortBij as string]));
}

/**
 * In welke zone een plek ligt: aan welke kant van de stippellijn (besluit
 * 308). De eerste zone ligt links of voor de lijn. Null zonder lijn, met meer
 * dan twee zones, of op een andere etage.
 */
export function zoneVanPlek(kamer: { readonly etage: string; readonly zones: readonly { readonly id: string }[]; readonly zoneLijn?: ZoneLijn }, plek: Plek): string | null {
  const lijn = kamer.zoneLijn;
  if (!lijn || kamer.zones.length !== 2 || plek.etage !== kamer.etage) return null;
  return kamer.zones[(lijn.as === 'u' ? plek.u : plek.v) < lijn.op ? 0 : 1]!.id;
}

const MAX_RUIMTES = 80;
const MAX_VAKKEN = 400;
/** Verder dan dit van de hoek van het hoofdhuis tekent niemand een huis. */
const MAX_M = 120;

/** Op 10 cm: de maat van een ruitje. Zonder min-nul. */
const ruitje = (n: number) => Math.round(n * 10) / 10 + 0;
const getal = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
const obj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x != null && !Array.isArray(x);

function naamVan(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/\s+/g, ' ');
  return t.length >= 1 && t.length <= 30 ? t : null;
}

function leesVak(x: unknown): Vak | null {
  if (!Array.isArray(x) || x.length !== 4) return null;
  const [u, v, b, d] = x as unknown[];
  if (!getal(u, -MAX_M, MAX_M) || !getal(v, -MAX_M, MAX_M) || !getal(b, 0.05, MAX_M) || !getal(d, 0.05, MAX_M)) return null;
  return [ruitje(u), ruitje(v), ruitje(b), ruitje(d)];
}

/**
 * De ruimtes van één etage. `kamerOp(kamer)` zegt of die kamer op deze etage
 * staat; anders valt de kamer weg en blijft het vak. Staat een kamer twee keer
 * op de etage, dan houdt de eerste hem.
 */
export function leesEtage(x: unknown, kamerOp: (kamer: string) => boolean): { ruimtes: TekenRuimte[] } | { fout: string } {
  if (!Array.isArray(x) || x.length > MAX_RUIMTES) return { fout: `een etage is een lijst van hooguit ${MAX_RUIMTES} ruimtes` };
  const uit: TekenRuimte[] = [];
  const gehad = new Set<string>();
  let n = 0;
  for (const r of x) {
    if (!obj(r) || !Array.isArray(r['vakken']) || r['vakken'].length === 0) return { fout: 'een ruimte heeft een lijst vakken' };
    n += r['vakken'].length;
    if (n > MAX_VAKKEN) return { fout: `hooguit ${MAX_VAKKEN} vakken per etage` };
    const vakken: Vak[] = [];
    for (const v of r['vakken']) {
      const vak = leesVak(v);
      if (!vak) return { fout: `een vak is [u, v, breed, diep] in meters, tot ${MAX_M} meter` };
      vakken.push(vak);
    }
    const kamer = typeof r['kamer'] === 'string' && kamerOp(r['kamer']) && !gehad.has(r['kamer']) ? r['kamer'] : null;
    if (kamer) {
      gehad.add(kamer);
      uit.push({ kamer, vakken });
      continue;
    }
    const naam = naamVan(r['naam']);
    const soort = EIGEN_SOORTEN.includes(r['soort'] as EigenSoort) ? (r['soort'] as EigenSoort) : null;
    // Een trap houdt zijn richting.
    const omhoog = soort === 'trap' && TRAP_RICHTINGEN.includes(r['omhoog'] as TrapRichting) ? (r['omhoog'] as TrapRichting) : null;
    uit.push({ ...(naam ? { naam, ...(soort ? { soort } : {}), ...(omhoog ? { omhoog } : {}) } : {}), vakken });
  }
  return { ruimtes: uit };
}

/**
 * De tekening van alle etages. `etageOk` zegt of een etage binnen bestaat;
 * een etage die er niet meer is, valt weg (net als een kamer).
 */
export function leesTekening(x: unknown, etageOk: (id: string) => boolean, kamerOp: (etage: string, kamer: string) => boolean): { tekening: Record<string, TekenRuimte[]> } | { fout: string } {
  if (!obj(x)) return { fout: 'plattegrond is een object per etage' };
  const uit: Record<string, TekenRuimte[]> = {};
  for (const [etage, lijst] of Object.entries(x)) {
    if (!etageOk(etage)) continue;
    const e = leesEtage(lijst, (k) => kamerOp(etage, k));
    if ('fout' in e) return { fout: `plattegrond ${etage}: ${e.fout}` };
    if (e.ruimtes.length) uit[etage] = e.ruimtes;
  }
  return { tekening: uit };
}

/** De zonelijn van een kamer met minstens twee zones; wat niet klopt, valt weg. */
export function leesZoneLijn(x: unknown, zones: number): ZoneLijn | null {
  if (zones < 2 || !obj(x) || (x['as'] !== 'u' && x['as'] !== 'v') || !getal(x['op'], -MAX_M, MAX_M)) return null;
  return { as: x['as'], op: ruitje(x['op']) };
}

/** De plek van een apparaat; op een etage die er niet meer is valt hij weg (null). */
export function leesPlek(x: unknown, etageOk: (id: string) => boolean): Plek | null | { fout: string } {
  if (x == null) return null;
  if (!obj(x) || typeof x['etage'] !== 'string' || !getal(x['u'], -MAX_M, MAX_M) || !getal(x['v'], -MAX_M, MAX_M)) return { fout: 'een plek is een etage met u en v in meters' };
  if (!etageOk(x['etage'])) return null;
  return { etage: x['etage'], u: Math.round(x['u'] * 100) / 100 + 0, v: Math.round(x['v'] * 100) / 100 + 0 };
}

/* ------------------------------------------------------------------ de vorm om op te tekenen */

/** Wat een blok kan zijn: het hoofdhuis, wat ertegenaan staat, en wat de bewoner op de kaart aanwees (ook los in de tuin). */
export const BLOK_SOORTEN = ['hoofdhuis', 'uitbouw', 'garage', 'carport', 'tuinhuis', 'anders'] as const;
export type BlokSoort = (typeof BLOK_SOORTEN)[number];
/** Wat je bij Je huis › Vorm op de kaart kunt aanwijzen (0.185.0), net als bij Daken en panelen. */
export const ERBIJ_SOORTEN = ['uitbouw', 'garage', 'carport', 'tuinhuis', 'anders'] as const;
export type ErbijSoort = (typeof ERBIJ_SOORTEN)[number];

/** Een gebouw van de kaart dat er nog niet bij hoort: grijs om het huis, om aan te tikken. `i` is zijn plek in de omgeving zoals Daken die tekent. */
export interface OmgevingVorm {
  readonly i: number;
  readonly punten: readonly (readonly [number, number])[];
}

/** Een gebouw als rechthoek in de assen van het hoofdhuis, in meters vanaf de linker voorhoek van het hele huis. */
export interface Blok {
  readonly id: string;
  readonly soort: BlokSoort;
  readonly u: number;
  readonly v: number;
  readonly b: number;
  readonly d: number;
  /**
   * Het dak (stap 5, het huis in 3D): de vorm, en of de nok langs u (`x`, langs
   * de voorgevel) of langs v (`y`, naar achter) loopt. Bij een lessenaar loopt
   * de bovenkant zo.
   */
  readonly dak?: Dakvorm;
  readonly nokLangs?: 'x' | 'y';
  /**
   * Hoe hoog: de nok, en de goot aan de lage kant van de dwarsas (`goot0`: voor
   * of links) en de hoge kant (`goot1`: achter of rechts), en waar de nok ligt,
   * gemeten vanaf kant 0. Weg: de nok in het midden, de goot van het huis.
   */
  readonly nok?: number;
  readonly goot0?: number;
  readonly goot1?: number;
  readonly nokVan0?: number;
  /**
   * Dakkapellen (13 november 2026, Ricardo: "er is een dakkapel op de kaart"):
   * per stuk de kant van het dak (0: voor of links, 1: achter of rechts) en
   * hoe breed hij is. Uit 3D BAG: een klein, bijna plat dakvlak dat dezelfde
   * kant op kijkt als een schuine kant van het dak.
   */
  readonly dakkapellen?: readonly Dakkapel[];
  /** Van wie de dakkapellen zijn (stap 4 punt 3): de bewoner, of 3D BAG; met `kapelVraag` vraagt Je huis of die van de kaart klopt. */
  readonly kapelBron?: 'bewoner' | 'kaart';
  readonly kapelVraag?: boolean;
  /** Een afdak voor of achter het hoofdhuis (ronde 2), uit de dakdelen van 3D BAG; alleen bij het hoofdhuis. */
  readonly afdak?: Afdak;
  /** Op maat getrokken (ronde 2): de maat zoals de kaart hem zag, langs de assen van het huis. */
  readonly kaartMaat?: { readonly b: number; readonly d: number };
}

/**
 * Een afdak (ronde 2, 20 november 2026, het afdak van Ricardo): een lager
 * dakdeel over (bijna) de hele breedte van het hoofdhuis, voor of achter, op
 * de begane grond. `diep` vanaf de gevel in meters, `laag` en `hoog` de
 * hoogte aan de buitenkant en tegen het huis; `plat` als het niet schuin ligt.
 */
export interface Afdak {
  readonly kant: 'voor' | 'achter';
  readonly diep: number;
  readonly laag: number;
  readonly hoog: number;
  readonly plat: boolean;
}

/**
 * Het afdak uit de dakvlakken van 3D BAG: een vlak dat 0,4 tot 3,5 m diep
 * tegen de voor- of achtergevel ligt, minstens 60% van de breedte, en lager dan
 * de goot aan die kant. Meer stukken aan dezelfde kant tellen samen. `b` is het
 * hoofdhuis op nul, `kader` zijn assen op de kaart. Null: geen afdak.
 */
export function afdakUitKaart(b: Blok, vlakken: readonly KaartDakvlak[], kader: Kader): Afdak | null {
  const kanten: Record<'voor' | 'achter', { v0: number; v1: number; laag: number; hoog: number; plat: boolean }[]> = { voor: [], achter: [] };
  for (const x of vlakken) {
    if (!x.vorm || x.vorm.length < 3 || !x.hoog) continue;
    const pp = x.vorm.map((p) => uitKaart(kader, p));
    const [us, vs] = [pp.map((p) => p[0]), pp.map((p) => p[1])];
    const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
    const um = (u0 + u1) / 2;
    if (um < b.u || um > b.u + b.b || u1 - u0 < 0.6 * b.b || v1 - v0 < 0.4 || v1 - v0 > 3.5) continue;
    const voor = v0 < b.v + 0.5 && v1 < b.v + b.d / 2;
    const achter = v1 > b.v + b.d - 0.5 && v0 > b.v + b.d / 2;
    if (!voor && !achter) continue;
    // Lager dan de goot aan die kant: anders is het het dak van het huis zelf.
    const langs = b.nokLangs !== 'y';
    const goot = langs ? (voor ? b.goot0 : b.goot1) : Math.min(b.goot0 ?? 99, b.goot1 ?? 99);
    if (goot == null || x.hoog[1] > goot - 0.8) continue;
    kanten[voor ? 'voor' : 'achter'].push({ v0, v1, laag: x.hoog[0], hoog: x.hoog[1], plat: x.tiltDeg < 5 });
  }
  const kant = kanten.voor.length ? 'voor' : kanten.achter.length ? 'achter' : null;
  if (!kant) return null;
  const delen = kanten[kant];
  const diep = kant === 'voor' ? Math.max(...delen.map((x) => x.v1)) - b.v : b.v + b.d - Math.min(...delen.map((x) => x.v0));
  return { kant, diep: m1(Math.min(3.5, Math.max(0.4, diep))), laag: m1(Math.min(...delen.map((x) => x.laag))), hoog: m1(Math.max(...delen.map((x) => x.hoog))), plat: delen.every((x) => x.plat) };
}

export interface TekenVorm {
  /** De rechthoek om het hele huis. */
  readonly maat: { readonly breed: number; readonly diep: number };
  readonly blokken: readonly Blok[];
  /** Waar de linker voorhoek van het hoofdhuis ligt, in de maat: de tekening wordt daarvandaan bewaard. */
  readonly nul: { readonly u: number; readonly v: number };
  /** Waar de vorm vandaan komt: de gebouwen van Daken en panelen, of een rechthoek uit het woningtype. */
  readonly bron: 'gebouwen' | 'woning';
  /** De richting van u op de kaart (0 is het noorden); null zonder gebouwen. */
  readonly uDeg: number | null;
  /** De gebouwen van de kaart eromheen die er nog niet bij horen, in dezelfde assen als de blokken. */
  readonly omgeving: readonly OmgevingVorm[];
  /** Van de kaart naar de assen van het hoofdhuis (zijn linker voorhoek is nul); null zonder kaart. */
  readonly kader?: Kader | null;
}

/** De maat van een basishuis per woningtype, breed langs de straat bij diep: gangbare maten, geschat. */
export const WONING_MAAT: Readonly<Record<string, readonly [number, number]>> = {
  vrijstaand: [10, 9],
  tweekap: [7, 9],
  hoek: [6, 9],
  rij: [5.4, 9],
  appartement: [8, 10],
};

const RAD = Math.PI / 180;
const richting = (deg: number): Xy => [Math.sin(deg * RAD), Math.cos(deg * RAD)];

/** De assen van een gebouw op de kaart: de linker voorhoek, de richting van u en v, en de maat. */
export interface Kader {
  readonly oorsprong: Xy;
  readonly uAs: Xy;
  readonly vAs: Xy;
  readonly breed: number;
  readonly diep: number;
}

/**
 * De assen van een gebouw, op de rechthoek om zijn omtrek (uit de branch
 * je-huis, besluit 288). De voorgevel kijkt naar `voorgevelDeg` (0 is het
 * noorden); wie op straat naar het huis kijkt, kijkt de andere kant op, en u
 * loopt dan naar rechts. Zonder voorgevel: het zuiden.
 */
export function kaderVan(g: Pick<Gebouw, 'omtrek' | 'bron'>, voorgevelDeg: number | null): Kader {
  const r = rechthoekOm(g.omtrek, maatAs(g));
  const kijk = ((voorgevelDeg ?? 180) + 180) % 360;
  const rechts = (kijk + 90) % 360;
  const verschil = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
  const kandidaten = [r.asDeg, r.asDeg + 90, r.asDeg + 180, r.asDeg + 270];
  const uDeg = kandidaten.reduce((best, a) => (verschil(a, rechts) < verschil(best, rechts) ? a : best));
  const langs = (((uDeg - r.asDeg) % 180) + 180) % 180 < 1;
  const breed = langs ? r.lengte : r.breedte;
  const diep = langs ? r.breedte : r.lengte;
  const uAs = richting(uDeg);
  const vAs = richting(uDeg - 90);
  const oorsprong: Xy = [r.midden[0] - (uAs[0] * breed) / 2 - (vAs[0] * diep) / 2, r.midden[1] - (uAs[1] * breed) / 2 - (vAs[1] * diep) / 2];
  return { oorsprong, uAs, vAs, breed, diep };
}

/** Een punt op de kaart in de assen van een gebouw. */
export function uitKaart(k: Kader, p: Xy): [number, number] {
  const dx = p[0] - k.oorsprong[0];
  const dy = p[1] - k.oorsprong[1];
  return [dx * k.uAs[0] + dy * k.uAs[1], dx * k.vAs[0] + dy * k.vAs[1]];
}

/** Hoe ver twee rechthoeken van elkaar liggen, in meters; 0 als ze raken of overlappen. */
const afstand = (a: { u: number; v: number; b: number; d: number }, b: { u: number; v: number; b: number; d: number }) =>
  Math.hypot(Math.max(0, a.u - (b.u + b.b), b.u - (a.u + a.b)), Math.max(0, a.v - (b.v + b.d), b.v - (a.v + a.d)));

/**
 * De vorm om op te tekenen (besluit 308): het hoofdhuis uit Daken en panelen,
 * met een uitbouw of garage die ertegenaan staat (hooguit een meter ertussen),
 * elk als rechthoek in de assen van het hoofdhuis. Een gebouw dat schuin staat
 * wordt de rechthoek eromheen (nog niet in de schets). Een carport, tuinhuis
 * of rek staat buiten en telt niet mee. Is het hoofdhuis zelf nog een
 * schatting, dan een rechthoek uit het woningtype.
 */
export function tekenVorm(gebouwen: readonly Gebouw[], voorgevelDeg: number | null, woning: string | null | undefined, omgeving: readonly (readonly Xy[])[] = []): TekenVorm {
  const hoofd = gebouwen.find((g) => g.soort === 'hoofdhuis');
  if (!hoofd || hoofd.bron === 'schatting' || hoofd.omtrek.length < 3) {
    const [b, d] = WONING_MAAT[woning ?? 'vrijstaand'] ?? WONING_MAAT['vrijstaand']!;
    return { maat: { breed: b, diep: d }, blokken: [{ id: 'hoofd', soort: 'hoofdhuis', u: 0, v: 0, b, d, dak: 'zadel', nokLangs: 'x' }], nul: { u: 0, v: 0 }, bron: 'woning', uDeg: null, omgeving: [] };
  }
  const k = kaderVan(hoofd, voorgevelDeg);
  const uDeg = ((Math.atan2(k.uAs[0], k.uAs[1]) / RAD) % 360 + 360) % 360;
  // Langs de voorgevel of naar achter: bij een zadel- of schilddak de nok, bij een lessenaar de bovenkant (haaks op waar hij naartoe kijkt).
  const verschil = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
  const langs = (g: Gebouw): 'x' | 'y' => {
    const r = g.dakvorm === 'lessenaar' ? g.nokDeg + 90 : g.nokDeg;
    return Math.min(verschil(r, uDeg), verschil(r, uDeg + 180)) <= 45 ? 'x' : 'y';
  };
  const ruw: { id: string; soort: BlokSoort; u: number; v: number; b: number; d: number; dak: Dakvorm; nokLangs: 'x' | 'y'; kaartMaat?: { b: number; d: number } }[] = [{ id: 'hoofd', soort: 'hoofdhuis', u: 0, v: 0, b: k.breed, d: k.diep, dak: hoofd.dakvorm, nokLangs: langs(hoofd) }];
  for (const g of gebouwen) {
    // Een uitbouw of garage, en sinds 0.185.0 alles wat de bewoner op de kaart aanwees: ook een carport of tuinhuis los in de tuin.
    if (g === hoofd || !(ERBIJ_SOORTEN as readonly string[]).includes(g.soort) || g.omtrek.length < 3) continue;
    if (g.soort !== 'uitbouw' && g.soort !== 'garage' && g.bron === 'schatting') continue;
    const punten = g.omtrek.map((p) => uitKaart(k, p));
    const u0 = Math.min(...punten.map((p) => p[0]));
    const v0 = Math.min(...punten.map((p) => p[1]));
    // Op maat getrokken (ronde 2): de maat van de kaart gaat mee, voor de min en plus en Maat van de kaart.
    const km = g.kaartOmtrek?.map((p) => uitKaart(k, p));
    const kaartMaat = km ? { b: ruitje(Math.max(...km.map((p) => p[0])) - Math.min(...km.map((p) => p[0]))), d: ruitje(Math.max(...km.map((p) => p[1])) - Math.min(...km.map((p) => p[1]))) } : undefined;
    const blok = { id: g.id === 'hoofd' ? `${g.id}-2` : g.id, soort: g.soort as BlokSoort, u: u0, v: v0, b: Math.max(...punten.map((p) => p[0])) - u0, d: Math.max(...punten.map((p) => p[1])) - v0, dak: g.dakvorm, nokLangs: langs(g), ...(kaartMaat ? { kaartMaat } : {}) };
    if (blok.b < 1 || blok.d < 1) continue;
    // Een geschat blok alleen tegen het huis; wat van de kaart komt of de bewoner neerzette tot 30 meter verderop.
    if (afstand(blok, ruw[0]!) > (g.bron === 'schatting' ? 1 : 30)) continue;
    ruw.push(blok);
  }
  // Alles op ruitjes, met de linker voorhoek van het hele huis op nul.
  const u0 = Math.min(...ruw.map((r) => r.u));
  const v0 = Math.min(...ruw.map((r) => r.v));
  const blokken = ruw.map((r) => ({ id: r.id, soort: r.soort, u: ruitje(r.u - u0), v: ruitje(r.v - v0), b: ruitje(r.b), d: ruitje(r.d), dak: r.dak, nokLangs: r.nokLangs, ...(r.kaartMaat ? { kaartMaat: r.kaartMaat } : {}) }));
  // De gebouwen eromheen in dezelfde assen, met hun plek in de lijst (die gaat mee als je er een aanwijst).
  const om = omgeving.flatMap((o, i) => (o.length < 3 ? [] : [{ i, punten: o.map((p) => uitKaart(k, p)).map(([u, v]) => [ruitje(u - u0), ruitje(v - v0)] as const) }]));
  return {
    maat: { breed: Math.max(...blokken.map((r) => ruitje(r.u + r.b))), diep: Math.max(...blokken.map((r) => ruitje(r.v + r.d))) },
    blokken,
    nul: { u: ruitje(-u0), v: ruitje(-v0) },
    bron: 'gebouwen',
    uDeg,
    omgeving: om,
    kader: k,
  };
}

/** De tekening van de hoek van het hoofdhuis naar die van het hele huis (`teken`), of terug (`bewaar`). */
export function verschuif(t: Readonly<Record<string, readonly TekenRuimte[]>>, du: number, dv: number): Record<string, TekenRuimte[]> {
  return Object.fromEntries(Object.entries(t).map(([e, lijst]) => [e, lijst.map((r) => ({ ...r, vakken: r.vakken.map(([u, v, b, d]) => [ruitje(u + du), ruitje(v + dv), b, d] as const) }))]));
}

/* ------------------------------------------------------------------ de bronnen bij Vorm (stap 4) */

/**
 * Waar de buitenkant vandaan komt, zoals bij Daken en panelen (besluit 261):
 * de 3D-kaart van Nederland, OpenStreetMap, of zonder kaart (`zelf`: een
 * rechthoek uit het woningtype, of wat de bewoner bij Daken zelf tekende).
 */
export type VormBron = 'bag3d' | 'osm' | 'zelf';
export const VORM_BRONNEN: readonly VormBron[] = ['bag3d', 'osm', 'zelf'];

/** Wat een kaart over het huis zei, zoals `kaartBronnen` het geeft. */
export interface KaartHuis {
  readonly stand: string;
  readonly hoofdhuis?: readonly (readonly [number, number])[];
  readonly omgeving?: readonly (readonly (readonly [number, number])[])[];
  readonly dak?: { readonly dakvorm: Dakvorm; readonly nokDeg: number; readonly vlakken: readonly KaartDakvlak[] };
  readonly hoogte?: { readonly goot: number | null; readonly nok: number | null; readonly lagen: number | null };
  /** Uit OpenStreetMap (ronde 2 versie 2): wat het gebouw zelf zegt, voor een huis zonder 3D-kaart; en de straten erbij. */
  readonly labels?: { readonly lagen: number | null; readonly nok: number | null; readonly goot: number | null; readonly dak: Dakvorm | null };
  readonly straten?: readonly { readonly richtingDeg: number; readonly afstand: number; readonly adres: boolean }[];
}

/** Welke bron het huis bij Daken en panelen nu tekent. */
export function bronVanDaken(gebouwen: readonly Gebouw[]): VormBron {
  const h = gebouwen.find((g) => g.soort === 'hoofdhuis');
  return h?.bron === 'kaart' ? (h.kaart ?? 'osm') : 'zelf';
}

/** Alleen wat een gebouw is, zonder wat de tekening erbij rekende (maat, dakvlakken). */
export const kaalGebouw = (g: Gebouw): Gebouw => {
  const { id, soort, bron, omtrek, dakvorm, nokDeg, kaart, dakBron, hoogteGoot, hoogteNok, lagen, dakkapellen, kaartKapel, kaartOmtrek, afdak } = g;
  return { id, soort, bron, omtrek, dakvorm, nokDeg, ...(kaart ? { kaart } : {}), ...(dakBron ? { dakBron } : {}), ...(hoogteGoot != null ? { hoogteGoot } : {}), ...(hoogteNok != null ? { hoogteNok } : {}), ...(lagen != null ? { lagen } : {}), ...(dakkapellen ? { dakkapellen } : {}), ...(kaartKapel ? { kaartKapel } : {}), ...(kaartOmtrek ? { kaartOmtrek } : {}), ...(afdak ? { afdak } : {}) };
};

/** Weg met de verwijzing naar een gebouw dat er niet meer is of anders ligt, zoals bij Daken. */
const losVan = (vlakken: readonly DakVlak[], ids: readonly string[]): DakVlak[] =>
  vlakken.map((v) => {
    if (!v.gebouw || !ids.includes(v.gebouw)) return v;
    const { gebouw: _g, kant: _k, ...rest } = v;
    return rest;
  });

/**
 * De daken met een andere bron voor de buitenkant (besluit 308: kiezen kan bij
 * Daken en panelen en bij Je huis, en geldt op allebei). Precies wat Daken
 * doet: een kaart geeft het hoofdhuis zijn omtrek (uit 3D BAG ook het dak en de
 * hoogte), geschatte blokken ernaast vallen weg, en de vlakken op wat anders
 * ligt raken los van hun gebouw. Zonder kaart blijft alleen wat de bewoner
 * zelf neerzette. Null als de kaart het huis niet (meer) kent.
 */
export function dakenMetBron(d: Daken, bron: VormBron, kaart: KaartHuis | null, bag: KaartHuis | null = null): Daken | null {
  const oud = d.gebouwen ?? [];
  const { kaartDak: _k, ...rest } = d;
  if (bron === 'zelf') {
    return { ...rest, vlakken: losVan(d.vlakken, oud.filter((g) => g.bron !== 'bewoner').map((g) => g.id)), gebouwen: oud.filter((g) => g.bron === 'bewoner'), omgeving: [] };
  }
  const omtrek = kaart?.stand === 'huis' ? kaart.hoofdhuis : undefined;
  if (!kaart || !omtrek || omtrek.length < 3) return null;
  const weg = oud.filter((g) => g.soort !== 'hoofdhuis' && g.bron === 'schatting').map((g) => g.id);
  // De plattegrond met de 3D-kaart erbij (Ricardo, 13 november 2026: combineren in plaats van gokken): de omtrek
  // van OpenStreetMap, het dak, de hoogte en de dakvlakken van 3D BAG als die het huis ook kent.
  const metDak = bron === 'bag3d' ? kaart : bron === 'osm' && bag?.stand === 'huis' ? bag : null;
  // Buiten Nederland (ronde 2 versie 2): zonder 3D-kaart wat de plattegrond zelf van het huis zegt.
  const lab = !metDak && bron === 'osm' ? kaart.labels : undefined;
  const dak = metDak?.dak ? { dakvorm: metDak.dak.dakvorm, nokDeg: metDak.dak.nokDeg, dakBron: 'kaart' as const } : lab?.dak ? { dakvorm: lab.dak, dakBron: 'kaart' as const } : {};
  const h = metDak?.hoogte ?? (lab ? { goot: lab.goot ?? (lab.nok != null && lab.lagen != null ? Math.min(lab.nok - 0.5, Math.round(lab.lagen * 28) / 10) : null), nok: lab.nok, lagen: lab.lagen } : undefined);
  const hoogte = { ...(h?.goot != null ? { hoogteGoot: h.goot } : {}), ...(h?.nok != null ? { hoogteNok: h.nok } : {}), ...(h?.lagen != null ? { lagen: h.lagen } : {}) };
  const huisId = oud.find((g) => g.soort === 'hoofdhuis')?.id ?? 'huis';
  const nieuwHuis = (g: Gebouw | null): Gebouw => {
    const basis: Gebouw = g ?? { id: huisId, soort: 'hoofdhuis', bron: 'kaart', omtrek: [], dakvorm: 'zadel', nokDeg: 0 };
    const { hoogteGoot: _g, hoogteNok: _n, lagen: _l, ...zonder } = basis;
    return { ...zonder, ...dak, ...hoogte, omtrek: omtrek.map((p) => [p[0], p[1]] as Xy), bron: 'kaart', kaart: bron };
  };
  const zonderWeg = oud.filter((g) => !weg.includes(g.id));
  const gebouwen = zonderWeg.some((g) => g.soort === 'hoofdhuis') ? zonderWeg.map((g) => (g.soort === 'hoofdhuis' ? nieuwHuis(g) : g)) : [nieuwHuis(null), ...zonderWeg];
  const kaartDak = kaartDakVan(metDak);
  // Wat de bewoner weghaalde omdat het er niet meer staat, komt ook van een verse kaart niet terug (ronde 2).
  const omgeving = (kaart.omgeving ?? []).map((o) => o.map((p) => [p[0], p[1]] as Xy)).filter((o) => !isWeg(d, o));
  return { ...rest, vlakken: losVan(d.vlakken, [...weg, ...(metDak?.dak ? [huisId] : [])]), gebouwen, omgeving, ...kaartDak };
}

/** De dakvlakken van 3D BAG zoals ze bewaard worden: hooguit 24, elk met zijn vorm en hoogtes. */
function kaartDakVan(metDak: KaartHuis | null): { kaartDak?: KaartDakvlak[] } {
  return metDak?.dak?.vlakken.length ? { kaartDak: metDak.dak.vlakken.slice(0, 24).map(({ azimuthDeg, tiltDeg, m2, vorm, hoog }) => ({ azimuthDeg, tiltDeg, m2, ...(vorm ? { vorm: vorm.slice(0, 16).map((p) => [p[0], p[1]] as Xy) } : {}), ...(hoog ? { hoog } : {}) })) } : {};
}

/**
 * Opnieuw kijken bij dezelfde kaart (stap 4 punt 3, 20 november 2026): een
 * huis dat zijn kaart koos vóór 0.186 had dakvlakken zonder vorm en hoogte, en
 * geen hoogte van de goot; daardoor geen scheef dak en geen dakkapel. Opnieuw
 * kijken vult dat aan uit 3D BAG: de dakvlakken, en de hoogtes van het
 * hoofdhuis die nog ontbreken. Wat de bewoner koos (de omtrek, een dakvorm of
 * nok die hij zelf zette) blijft. Null als er niets te vernieuwen is.
 */
export function kaartVernieuwd(d: Daken, bron: VormBron, kaarten: { readonly osm: KaartHuis | null; readonly bag3d: KaartHuis | null }): Daken | null {
  if (bron === 'zelf') return null;
  const bag = kaarten.bag3d?.stand === 'huis' ? kaarten.bag3d : null;
  if (!bag) return bron === 'osm' ? labelsVernieuwd(d, kaarten.osm) : null;
  const huis = (d.gebouwen ?? []).find((g) => g.soort === 'hoofdhuis' && g.bron === 'kaart');
  if (!huis) return null;
  const { kaartDak } = kaartDakVan(bag);
  const h = bag.hoogte;
  const dak = huis.dakBron === 'bewoner' || !bag.dak ? {} : { dakvorm: bag.dak.dakvorm, nokDeg: bag.dak.nokDeg, dakBron: 'kaart' as const };
  const nieuwHuis: Gebouw = {
    ...huis,
    ...dak,
    ...(huis.hoogteGoot == null && h?.goot != null ? { hoogteGoot: h.goot } : {}),
    ...(huis.hoogteNok == null && h?.nok != null ? { hoogteNok: h.nok } : {}),
    ...(huis.lagen == null && h?.lagen != null ? { lagen: h.lagen } : {}),
  };
  const nieuw: Daken = { ...d, gebouwen: (d.gebouwen ?? []).map((g) => (g === huis ? nieuwHuis : g)), ...(kaartDak ? { kaartDak } : {}) };
  return JSON.stringify(nieuw) === JSON.stringify(d) ? null : nieuw;
}

/** Wat een bron van het huis maakt: de gebouwen in de assen van het hoofdhuis, en de hoogte. */
export interface BronVorm {
  /** In meters vanaf de linker voorhoek van het hoofdhuis. */
  readonly blokken: readonly Blok[];
  /** Goot en nok in meters boven de grond; gemeten uit 3D BAG, anders geschat uit de etages. */
  readonly goot: number;
  /** De goot aan de lage kant, als het dak scheef ligt; daar lopen de dichte muren tot. */
  readonly gootLaag?: number;
  readonly nok: number;
  readonly gemeten: boolean;
  readonly dakvorm: Dakvorm;
  /** Zonder kaart: was het hoofdhuis door de bewoner getekend (en geen rechthoek uit het woningtype)? */
  readonly zelfGetekend: boolean;
  /** De gebouwen van de kaart eromheen, nog niet aangewezen; in dezelfde assen als de blokken. */
  readonly omgeving: readonly OmgevingVorm[];
  /** Wat de bewoner weghaalde omdat het er niet meer staat (ronde 2): de plek in de lijst, de soort en de maat, voor Terug. */
  readonly weg?: readonly { readonly n: number; readonly soort: GebouwSoort | null; readonly b: number; readonly d: number }[];
  /** Het afdak dat 3D BAG ziet, maar dat er volgens de bewoner niet is (ronde 2): voor Terug. */
  readonly afdakWeg?: Afdak;
  /** Een huis uit de plattegrond zonder 3D-kaart (ronde 2 versie 2): wat de plattegrond weet; null is geschat. */
  readonly kaartWeet?: { readonly lagen: number | null; readonly goot: number | null; readonly nok: number | null; readonly dak: Dakvorm | null };
}

const m1 = (n: number) => Math.round(n * 10) / 10 + 0;

/**
 * De vorm van één bron: de gebouwen zoals Daken ze dan tekent, als blokken in
 * de assen van het hoofdhuis. `lagen`: hoeveel etages onder het dak, om de
 * hoogte te schatten als 3D BAG hem niet geeft (2,8 m per etage, de nok 3 m
 * hoger, bij een plat dak even hoog).
 */
export function bronVorm(d: Daken, voorgevelDeg: number | null, woning: string | null | undefined, lagen: number): BronVorm {
  const dt = dakTekening(d);
  const gebouwen = dt.gebouwen;
  const v = tekenVorm(gebouwen, voorgevelDeg, woning, dt.omgeving);
  const hoofd = gebouwen.find((g) => g.soort === 'hoofdhuis');
  const dakvorm = hoofd?.dakvorm ?? 'zadel';
  const uitBag = hoofd?.bron === 'kaart' && hoofd.hoogteGoot != null;
  const geschat = m1(2.8 * Math.max(1, lagen));
  const nok = uitBag && hoofd.hoogteNok != null ? hoofd.hoogteNok : dakvorm === 'plat' ? geschat : m1(geschat + 3);
  // Het dak van het hoofdhuis: uit de dakvlakken van 3D BAG ligt de nok soms niet in het midden, met de goot aan de ene kant lager.
  const dak = (b: Blok): Blok => {
    if (b.soort !== 'hoofdhuis') return { ...b, ...bijDak(b, 2.8) };
    const scheef = uitBag ? scheefDak(b, d.kaartDak ?? [], v.uDeg, nok, hoofd.hoogteGoot!) : null;
    // De dakkapellen (stap 4 punt 3): die van de bewoner gelden; anders wat 3D BAG vindt, tenzij de bewoner zei dat die niet klopt.
    const uitKaart = uitBag && v.kader ? dakkapellen({ ...b, ...(scheef ?? {}) }, d.kaartDak ?? [], v.kader) : [];
    const eigen = hoofd?.dakkapellen;
    const kapellen = eigen ? eigen.map(kapelVanBewoner) : hoofd?.kaartKapel === 'nee' ? [] : uitKaart;
    const wie = eigen ? { kapelBron: 'bewoner' as const } : kapellen.length ? { kapelBron: 'kaart' as const, ...(hoofd?.kaartKapel !== 'ja' ? { kapelVraag: true } : {}) } : {};
    const metDak: Blok = { ...b, nok, ...(scheef ?? { goot0: uitBag ? hoofd.hoogteGoot! : geschat, goot1: uitBag ? hoofd.hoogteGoot! : geschat }), ...(kapellen.length ? { dakkapellen: kapellen } : {}), ...wie };
    // Het afdak voor of achter (ronde 2): een eigen stuk met zijn eigen dak, tenzij de bewoner zei dat het er niet is.
    const afdak = uitBag && v.kader ? afdakUitKaart(metDak, d.kaartDak ?? [], v.kader) : null;
    if (afdak && hoofd?.afdak === 'nee') afdakWeg = afdak;
    return afdak && hoofd?.afdak !== 'nee' ? { ...metDak, afdak } : metDak;
  };
  let afdakWeg: Afdak | null = null;
  const blokken = v.blokken.map((b) => dak({ ...b, u: m1(b.u - v.nul.u), v: m1(b.v - v.nul.v) }));
  const h = blokken.find((b) => b.soort === 'hoofdhuis');
  // De goot voor de etages is de hoge kant: daaronder liggen de etages heel.
  const goot = h?.goot0 != null && h.goot1 != null ? Math.max(h.goot0, h.goot1) : uitBag ? hoofd.hoogteGoot! : geschat;
  return {
    blokken,
    goot,
    ...(h?.goot0 != null && h.goot1 != null && h.goot0 !== h.goot1 ? { gootLaag: Math.min(h.goot0, h.goot1) } : {}),
    nok,
    gemeten: uitBag,
    dakvorm,
    zelfGetekend: v.bron === 'gebouwen' && hoofd?.bron === 'bewoner',
    omgeving: v.omgeving.map((o) => ({ i: o.i, punten: o.punten.map(([u, w]) => [m1(u - v.nul.u), m1(w - v.nul.v)] as const) })),
    ...(d.weg?.length ? { weg: d.weg.map((w, n) => ({ n, soort: w.soort ?? null, ...wegMaat(w, v.kader ?? null) })) } : {}),
    ...(afdakWeg ? { afdakWeg } : {}),
    ...(hoofd?.bron === 'kaart' && hoofd.kaart === 'osm' && !d.kaartDak?.length ? { kaartWeet: { lagen: hoofd.lagen ?? null, goot: hoofd.hoogteGoot ?? null, nok: hoofd.hoogteNok ?? null, dak: hoofd.dakBron === 'kaart' ? hoofd.dakvorm : null } } : {}),
  };
}

/** De maat van wat weg is, langs de assen van het huis (of van de kaart, zonder huis). */
function wegMaat(w: WegGebouw, k: Kader | null): { b: number; d: number } {
  const pp = k ? w.omtrek.map((p) => uitKaart(k, p)) : w.omtrek;
  const [us, vs] = [pp.map((p) => p[0]), pp.map((p) => p[1])];
  return { b: m1(Math.max(...us) - Math.min(...us)), d: m1(Math.max(...vs) - Math.min(...vs)) };
}

/* ------------------------------------------------------------------ op maat en weg (ronde 2, 20 november 2026) */

const middenVan = (o: readonly Xy[]): Xy => [o.reduce((n, p) => n + p[0], 0) / o.length, o.reduce((n, p) => n + p[1], 0) / o.length];
/** Ligt deze omtrek op de plek van iets dat de bewoner weghaalde? Het midden binnen 1,5 m. */
export function isWeg(d: Daken, o: readonly Xy[]): boolean {
  const m = middenVan(o);
  return (d.weg ?? []).some((w) => {
    const n = middenVan(w.omtrek);
    return Math.hypot(n[0] - m[0], n[1] - m[1]) <= 1.5;
  });
}

/**
 * Een gebouw op maat (keuze Ricardo 20 november 2026: het tuinhuis van de kaart
 * is 1,8 x 3,3 m, het echte 7 x 3 m). `vak` is de rechthoek in meters vanaf de
 * linker voorhoek van het hoofdhuis; null zet de maat van de kaart terug. Wat
 * de bewoner trekt, blijft: het gebouw is daarna van de bewoner, met de omtrek
 * van de kaart ernaast. Null als het gebouw er niet is.
 */
export function gebouwMaat(d: Daken, id: string, vak: { readonly u: number; readonly v: number; readonly b: number; readonly d: number } | null): Daken | null {
  const dt = dakTekening(d);
  const gebouwen = d.gebouwen ?? dt.gebouwen.map(kaalGebouw);
  // De assen van het hoofdhuis zoals Je huis het tekent: opgeknipt uit het gebouw van de kaart (zonder de garage ernaast).
  const hoofd = dt.gebouwen.find((g) => g.soort === 'hoofdhuis');
  const g = gebouwen.find((x) => x.id === id);
  if (!hoofd || !g || g.soort === 'hoofdhuis' || hoofd.omtrek.length < 3) return null;
  let nieuw: Gebouw;
  if (vak == null) {
    if (!g.kaartOmtrek) return null;
    const { kaartOmtrek, ...rest } = g;
    const kaart = gebouwen.find((x) => x.soort === 'hoofdhuis')?.kaart;
    nieuw = { ...rest, omtrek: kaartOmtrek, bron: 'kaart', ...(kaart ? { kaart } : {}) };
  } else {
    if (![vak.u, vak.v, vak.b, vak.d].every((n) => Number.isFinite(n)) || vak.b < 1 || vak.d < 1 || vak.b > 40 || vak.d > 40 || Math.abs(vak.u) > 60 || Math.abs(vak.v) > 60) return null;
    const k = kaderVan(hoofd, d.voorgevelDeg);
    const r2 = (n: number): number => Math.round(n * 100) / 100 + 0;
    const P = (u: number, v: number): Xy => [r2(k.oorsprong[0] + u * k.uAs[0] + v * k.vAs[0]), r2(k.oorsprong[1] + u * k.uAs[1] + v * k.vAs[1])];
    const { kaart: _k, ...rest } = g;
    nieuw = { ...rest, bron: 'bewoner', omtrek: [P(vak.u, vak.v), P(vak.u + vak.b, vak.v), P(vak.u + vak.b, vak.v + vak.d), P(vak.u, vak.v + vak.d)], ...(g.kaartOmtrek || g.bron !== 'kaart' ? {} : { kaartOmtrek: g.omtrek }) };
  }
  return { ...d, vlakken: losVan(d.vlakken, [id]), gebouwen: gebouwen.map((x) => (x === g ? nieuw : x)) };
}

/**
 * Bestaat niet meer (keuze Ricardo 20 november 2026): een gebouw dat erbij
 * hoorde (`id`) of een grijs gebouw van de kaart (`i`, zijn plek in de
 * omgeving) gaat weg en blijft weg, ook als de kaart het nog ziet. Onder
 * Weggehaald staat het met Terug. Null als het er niet is.
 */
export function gebouwBestaatNiet(d: Daken, wat: { readonly id: string } | { readonly i: number }): Daken | null {
  const dt = dakTekening(d);
  const gebouwen = d.gebouwen ?? dt.gebouwen.map(kaalGebouw);
  const omgeving = dt.omgeving.map((o) => o.map((p) => [p[0], p[1]] as Xy));
  let weg: WegGebouw;
  let nieuw: Daken;
  if ('id' in wat) {
    const g = gebouwen.find((x) => x.id === wat.id);
    if (!g || g.soort === 'hoofdhuis') return null;
    weg = { omtrek: g.kaartOmtrek ?? g.omtrek, soort: g.soort };
    nieuw = { ...d, vlakken: losVan(d.vlakken, [g.id]), gebouwen: gebouwen.filter((x) => x !== g), omgeving };
  } else {
    const o = omgeving[wat.i];
    if (!Number.isInteger(wat.i) || !o || o.length < 3) return null;
    weg = { omtrek: o };
    nieuw = { ...d, gebouwen, omgeving: omgeving.filter((_x, n) => n !== wat.i) };
  }
  return { ...nieuw, weg: [...(d.weg ?? []), weg].slice(-20) };
}

/** Terug wat weg was (`n`: de plek in de lijst Weggehaald): grijs op de kaart, om opnieuw aan te wijzen. Null als het er niet is. */
export function gebouwTerug(d: Daken, n: number): Daken | null {
  const w = d.weg?.[n];
  if (!Number.isInteger(n) || !w) return null;
  const dt = dakTekening(d);
  const weg = d.weg!.filter((_x, i) => i !== n);
  const { weg: _w, ...rest } = d;
  return { ...rest, ...(weg.length ? { weg } : {}), omgeving: [...dt.omgeving.map((o) => o.map((p) => [p[0], p[1]] as Xy)), w.omtrek.map((p) => [p[0], p[1]] as Xy)].slice(0, 20) };
}

/** Het afdak van de kaart: `nee` als het er niet is, `ja` zet het terug. Null zonder hoofdhuis. */
export function gebouwAfdak(d: Daken, keuze: 'ja' | 'nee'): Daken | null {
  const dt = dakTekening(d);
  const gebouwen = d.gebouwen ?? dt.gebouwen.map(kaalGebouw);
  const hoofd = gebouwen.find((g) => g.soort === 'hoofdhuis');
  if (!hoofd) return null;
  const { afdak: _a, ...zonder } = hoofd;
  const nieuw: Gebouw = keuze === 'nee' ? { ...zonder, afdak: 'nee' } : zonder;
  return { ...d, gebouwen: gebouwen.map((g) => (g === hoofd ? nieuw : g)) };
}

/** Een garage of uitbouw: de goot op de hoogte van de begane grond, een schuin dak op 35°. */
function bijDak(b: Blok, goot: number): Pick<Blok, 'nok' | 'goot0' | 'goot1'> {
  const breed = b.nokLangs === 'y' ? b.b : b.d;
  const nok = b.dak === 'plat' ? goot : b.dak === 'lessenaar' ? m1(goot + 1) : m1(goot + (breed / 2) * Math.tan(35 * (Math.PI / 180)));
  return { nok, goot0: goot, goot1: goot };
}

/**
 * Waar de nok ligt en hoe hoog de goot aan elke kant is, uit de dakvlakken
 * van 3D BAG: van boven gezien is elk dakvlak zo breed als zijn oppervlak maal
 * de cosinus van de helling, dus de verhouding tussen de twee kanten zegt waar
 * de nok ligt; de helling zegt dan hoe ver de goot onder de nok ligt. Null
 * als het dak dat niet zegt (plat, of geen vlakken aan beide kanten).
 */
export function scheefDak(b: Blok, vlakken: readonly { readonly azimuthDeg: number; readonly tiltDeg: number; readonly m2: number }[], uDeg: number | null, nok: number, gootMin: number): Pick<Blok, 'goot0' | 'goot1' | 'nokVan0'> | null {
  if (uDeg == null || b.dak === 'plat' || !vlakken.length) return null;
  // Kant 1 ligt achter (nok langs u) of rechts (nok naar achter); kant 0 er tegenover.
  const richting1 = b.nokLangs === 'y' ? uDeg : uDeg - 90;
  const verschil = (a: number, c: number) => Math.abs(((a - c + 540) % 360) - 180);
  const breed = b.nokLangs === 'y' ? b.b : b.d;
  const kant = [{ w: 0, tan: 0, n: 0 }, { w: 0, tan: 0, n: 0 }];
  for (const x of vlakken) {
    const i = verschil(x.azimuthDeg, richting1) <= 45 ? 1 : verschil(x.azimuthDeg, richting1 + 180) <= 45 ? 0 : -1;
    if (i < 0 || x.tiltDeg < 15) continue;
    const t = x.tiltDeg * (Math.PI / 180);
    const w = x.m2 * Math.cos(t);
    kant[i]!.w += w;
    kant[i]!.tan += w * Math.tan(t);
    kant[i]!.n += w;
  }
  const [k0, k1] = kant as [{ w: number; tan: number; n: number }, { w: number; tan: number; n: number }];
  if (b.dak === 'lessenaar') {
    // Eén vlak: de hoge kant is waar hij niet naartoe kijkt.
    if (!k0.w && !k1.w) return null;
    return k1.w >= k0.w ? { nokVan0: 0, goot0: nok, goot1: m1(Math.max(1.5, gootMin)) } : { nokVan0: m1(breed), goot0: m1(Math.max(1.5, gootMin)), goot1: nok };
  }
  if (!k0.w || !k1.w) return null;
  const van0 = (breed * k0.w) / (k0.w + k1.w);
  const goot = (afstand: number, k: { tan: number; n: number }) => m1(Math.min(nok, Math.max(1.5, nok - afstand * (k.tan / k.n))));
  return { nokVan0: m1(van0), goot0: goot(van0, k0), goot1: goot(breed - van0, k1) };
}

/**
 * De dakkapellen van een schuin dak uit de dakvlakken van 3D BAG: een vlak
 * van 1,5 tot 15 m² met een helling onder 15° dat dezelfde kant op kijkt als
 * een kant van het dak. Zo breed als zijn oppervlak gedeeld door twee meter
 * diepte, tussen 1,2 m en de breedte van het dak min een meter.
 */
export function dakkapellen(b: Blok, vlakken: readonly KaartDakvlak[], kader: Kader): Dakkapel[] {
  if (b.dak === 'plat' || b.dak === 'lessenaar') return [];
  const haaks = b.nokLangs === 'y';
  // a langs de nok, c er dwars op; kant 0 is de kant met de kleinste c (voor of links).
  const [a0, a1, c0, c1] = haaks ? [b.v, b.v + b.d, b.u, b.u + b.b] : [b.u, b.u + b.b, b.v, b.v + b.d];
  const cr = c0 + (b.nokVan0 ?? (c1 - c0) / 2);
  const uit: Dakkapel[] = [];
  for (const x of vlakken) {
    if (x.tiltDeg >= 15 || x.m2 < 1.5 || x.m2 > 15 || !x.vorm || x.vorm.length < 3) continue;
    const pp = x.vorm.map((p) => uitKaart(kader, p)).map(([u, v]) => (haaks ? [v, u] : [u, v]) as [number, number]);
    const [as, cs] = [pp.map((p) => p[0]), pp.map((p) => p[1])];
    const [amin, amax, cmin, cmax] = [Math.min(...as), Math.max(...as), Math.min(...cs), Math.max(...cs)];
    const cm = (cmin + cmax) / 2;
    // Alleen wat op dit dak ligt, en niet over de nok heen.
    if ((amin + amax) / 2 < a0 || (amin + amax) / 2 > a1 || cm < c0 || cm > c1) continue;
    const kant: 0 | 1 = cm < cr ? 0 : 1;
    // De voorkant van de dakkapel is de kant van de goot, de achterkant raakt het dak richting de nok.
    const [voor, achter] = kant === 0 ? [cmin, cmax] : [cmax, cmin];
    uit.push({ kant, van: m1(Math.max(0, amin - a0)), tot: m1(Math.min(a1 - a0, amax - a0)), voor: m1(Math.abs(voor - (kant === 0 ? c0 : c1))), achter: m1(Math.abs(achter - (kant === 0 ? c0 : c1))), ...(x.hoog ? { boven: x.hoog[1] } : {}) });
  }
  return uit.slice(0, 4);
}

/**
 * Een dakkapel op een kant van het dak (0 voor of links, 1 achter of rechts):
 * van..tot langs de nok vanaf het begin van het dak, en hoe ver de voorkant
 * en de achterkant van de goot af liggen; `boven` is de hoogte van zijn
 * dakje boven de grond. Alles in meters, uit waar 3D BAG het vlak legt.
 */
export interface Dakkapel {
  readonly kant: 0 | 1;
  readonly van: number;
  readonly tot: number;
  readonly voor: number;
  readonly achter: number;
  readonly boven?: number;
  /** De etage waar hij op staat, als de bewoner hem neerzette. */
  readonly etage?: string;
}

/** Een dakkapel van de bewoner als dakkapel van het blok: de voorkant 0,3 m achter de goot. */
export const kapelVanBewoner = (k: EigenKapel): Dakkapel => ({ kant: k.kant, van: k.van, tot: k.tot, voor: 0.3, achter: m1(0.3 + k.diep), ...(k.etage ? { etage: k.etage } : {}) });

/**
 * De dakkapellen van het hoofdhuis zetten (stap 4 punt 3, Je huis › Dak):
 * `dakkapellen` is de hele lijst van de bewoner (ook leeg: geen); `kaartKapel`
 * is ja of nee op de dakkapel die 3D BAG vond. Null als er geen hoofdhuis is.
 */
export function gebouwKapel(d: Daken, wat: { readonly dakkapellen?: readonly EigenKapel[]; readonly kaartKapel?: 'ja' | 'nee' }): Daken | null {
  const gebouwen = d.gebouwen ?? dakTekening(d).gebouwen.map(kaalGebouw);
  const g = gebouwen.find((x) => x.soort === 'hoofdhuis');
  if (!g) return null;
  const nieuw: Gebouw = { ...g, ...(wat.dakkapellen ? { dakkapellen: wat.dakkapellen } : {}), ...(wat.kaartKapel ? { kaartKapel: wat.kaartKapel } : {}) };
  return { ...d, gebouwen: gebouwen.map((x) => (x === g ? nieuw : x)) };
}

/**
 * Alle bronnen op één ruitjespapier (de tekentafel wisselt van bron zonder dat
 * een kamer verschuift): de hoek van het hoofdhuis ligt bij elke bron op
 * dezelfde plek, `nul`, en de maat is wat alle bronnen en de tekening samen
 * nodig hebben.
 */
export function eenPapier(
  vormen: Readonly<Record<string, readonly Blok[]>>,
  tekening: Readonly<Record<string, readonly TekenRuimte[]>>,
): { nul: { u: number; v: number }; maat: { breed: number; diep: number }; blokken: Record<string, Blok[]> } {
  const rechthoeken = [...Object.values(vormen).flatMap((l) => l.map((b) => [b.u, b.v, b.b, b.d] as const)), ...Object.values(tekening).flatMap((l) => l.flatMap((r) => r.vakken))];
  if (!rechthoeken.length) return { nul: { u: 0, v: 0 }, maat: { breed: 1, diep: 1 }, blokken: {} };
  const u0 = Math.min(...rechthoeken.map((r) => r[0]));
  const v0 = Math.min(...rechthoeken.map((r) => r[1]));
  return {
    nul: { u: m1(-u0), v: m1(-v0) },
    maat: { breed: m1(Math.max(...rechthoeken.map((r) => r[0] + r[2])) - u0), diep: m1(Math.max(...rechthoeken.map((r) => r[1] + r[3])) - v0) },
    blokken: Object.fromEntries(Object.entries(vormen).map(([id, l]) => [id, l.map((b) => ({ ...b, u: m1(b.u - u0), v: m1(b.v - v0) }))])),
  };
}

/** Is de bovenste etage een zolder onder het dak? Van boven naar beneden, met de namen. */
export function heeftZolder(etages: readonly { readonly id: string; readonly naam: string }[]): boolean {
  const top = etages[0];
  return etages.length >= 2 && top != null && top.id !== 'bg' && (/zolder|attic|loft/i.test(top.id) || /zolder|attic|loft/i.test(top.naam));
}

/** Hoeveel etages onder het dak boven de grond liggen: om de goot te schatten. */
export function lagenOnderDak(etages: readonly { readonly id: string; readonly naam: string }[]): number {
  const bg = etages.findIndex((e) => e.id === 'bg');
  const boven = bg >= 0 ? bg + 1 : etages.length;
  return Math.max(1, boven - (heeftZolder(etages) ? 1 : 0));
}

/**
 * De hoogte per etage, geschat uit de goot en de nok van het hoofdhuis: een
 * zolder bovenin is nok min goot, de etages daaronder delen de goot, en een
 * kelder is 2,5 m. Van boven naar beneden.
 */
export function etageHoogtes(etages: readonly { readonly id: string; readonly naam: string }[], goot: number, nok: number): number[] {
  const bg = etages.findIndex((e) => e.id === 'bg');
  const onderGrond = (i: number) => bg >= 0 && i > bg;
  const zolder = heeftZolder(etages);
  const per = m1(Math.min(4, Math.max(2.2, goot / lagenOnderDak(etages))));
  return etages.map((_, i) => (onderGrond(i) ? 2.5 : zolder && i === 0 ? m1(Math.min(8, Math.max(1.5, nok - goot))) : per));
}

/* ------------------------------------------------------------------ een gebouw erbij of weg (0.185.0) */

/**
 * Een gebouw van de kaart erbij, zoals bij Daken en panelen (Ricardo, 13
 * november 2026: ook bij Je huis › Vorm, en het geldt op allebei). `i` is de
 * plek in de omgeving zoals Daken die tekent. Een geschat blok van dezelfde
 * soort krijgt die omtrek; anders komt er een gebouw bij. Null als het gebouw
 * er niet (meer) is.
 */
export function gebouwErbij(d: Daken, i: number, soort: ErbijSoort): { daken: Daken; id: string } | null {
  const dt = dakTekening(d);
  const omtrek = dt.omgeving[i];
  if (!Number.isInteger(i) || !omtrek || omtrek.length < 3) return null;
  const gebouwen: Gebouw[] = (d.gebouwen ?? dt.gebouwen.map(kaalGebouw)).map((g) => ({ ...g }));
  const geschat = gebouwen.findIndex((g) => g.soort === soort && g.bron === 'schatting');
  const kaart = gebouwen.find((g) => g.soort === 'hoofdhuis')?.kaart;
  const vorm = omtrek.map((p) => [p[0], p[1]] as Xy);
  let id: string;
  if (geschat >= 0) {
    id = gebouwen[geschat]!.id;
    gebouwen[geschat] = { ...gebouwen[geschat]!, omtrek: vorm, bron: 'kaart' };
  } else {
    id = soort;
    for (let n = 2; gebouwen.some((g) => g.id === id); n++) id = `${soort}-${n}`;
    gebouwen.push({ id, soort, bron: 'kaart', omtrek: vorm, dakvorm: soort === 'tuinhuis' || soort === 'anders' ? 'zadel' : 'plat', nokDeg: 0, ...(kaart ? { kaart } : {}) });
  }
  const omgeving = dt.omgeving.filter((_o, n) => n !== i).map((o) => o.map((p) => [p[0], p[1]] as Xy));
  return { daken: { ...d, vlakken: losVan(d.vlakken, geschat >= 0 ? [id] : []), gebouwen, omgeving }, id };
}

/**
 * De dakvorm van een gebouw, of de nok een kwart gedraaid (stap 4, keuze
 * Ricardo 19 november 2026: het dak teken je in Je huis, Zonnepanelen legt de
 * panelen erop). `id` is het blok zoals Je huis het tekent: `hoofd` is het
 * hoofdhuis. Wat de bewoner kiest, blijft (issue 143); de vlakken die erop
 * lagen, zoekt SunArc opnieuw. Null als het gebouw er niet is.
 */
export function gebouwDak(d: Daken, id: string, wat: { readonly dakvorm?: Dakvorm; readonly nok?: boolean }): Daken | null {
  const dt = dakTekening(d);
  const gebouwen = d.gebouwen ?? dt.gebouwen.map(kaalGebouw);
  // Een ander gebouw dat 'hoofd' heet, tekent Je huis als 'hoofd-2'.
  const g = id === 'hoofd' ? gebouwen.find((x) => x.soort === 'hoofdhuis') : (gebouwen.find((x) => x.id === id) ?? (id === 'hoofd-2' ? gebouwen.find((x) => x.id === 'hoofd') : undefined));
  if (!g) return null;
  const norm = (n: number): number => ((Math.round(n) % 360) + 360) % 360;
  const nieuw: Gebouw = wat.dakvorm
    ? { ...g, dakvorm: wat.dakvorm, dakBron: 'bewoner' }
    : { ...g, nokDeg: g.dakvorm === 'lessenaar' ? norm(g.nokDeg + 90) : (g.nokDeg + 90) % 180, dakBron: g.dakBron ?? 'bewoner' };
  return { ...d, vlakken: losVan(d.vlakken, [g.id]), gebouwen: gebouwen.map((x) => (x === g ? nieuw : x)) };
}

/**
 * Het dak bij een zelf getekend huis (stap 4, keuze Ricardo 19 november 2026:
 * Zonnepanelen legt de panelen op het dak uit Je huis). Zonder kaart is de
 * buitenkant zoals Vorm hem toont, die van de begane grond, de omtrek van het
 * hoofdhuis, van de bewoner. `tekening` is per etage in meters vanaf de hoek
 * van het hoofdhuis van nu; `etages` in de volgorde om te zoeken (de begane
 * grond eerst, dan wat er wel getekend is). Ligt de nieuwe hoek
 * ergens anders, dan zegt `u0`/`v0` hoeveel: de tekening schuift dan mee.
 * Null als er niets te doen is (een huis uit de kaart, nog niets getekend, of
 * het klopt al).
 */
export function huisUitTekening(d: Daken, tekening: unknown, etages: readonly string[]): { daken: Daken; u0: number; v0: number } | null {
  const dt = dakTekening(d);
  const gebouwen = d.gebouwen ?? dt.gebouwen.map(kaalGebouw);
  const hoofd = gebouwen.find((g) => g.soort === 'hoofdhuis');
  if (!hoofd || hoofd.bron === 'kaart' || tekening == null || typeof tekening !== 'object') return null;
  const vakVan = (x: unknown): number[] | null => (Array.isArray(x) && x.length === 4 && x.every((n) => typeof n === 'number' && Number.isFinite(n)) ? (x as number[]) : null);
  const vakkenVan = (lijst: unknown): number[][] => (Array.isArray(lijst) ? lijst.flatMap((r) => (r && typeof r === 'object' && Array.isArray((r as { vakken?: unknown }).vakken) ? ((r as { vakken: unknown[] }).vakken.map(vakVan).filter((v) => v != null) as number[][]) : [])) : []);
  const vakken = etages.map((e) => vakkenVan((tekening as Record<string, unknown>)[e])).find((l) => l.length);
  if (!vakken) return null;
  const u0 = ruitje(Math.min(...vakken.map((v) => v[0]!)));
  const v0 = ruitje(Math.min(...vakken.map((v) => v[1]!)));
  const u1 = ruitje(Math.max(...vakken.map((v) => v[0]! + v[2]!)));
  const v1 = ruitje(Math.max(...vakken.map((v) => v[1]! + v[3]!)));
  if (u1 - u0 < 2 || v1 - v0 < 2) return null;
  const k = kaderVan(hoofd, d.voorgevelDeg);
  const r2 = (n: number): number => Math.round(n * 100) / 100 + 0;
  const P = (u: number, v: number): Xy => [r2(k.oorsprong[0] + u * k.uAs[0] + v * k.vAs[0]), r2(k.oorsprong[1] + u * k.uAs[1] + v * k.vAs[1])];
  const omtrek = [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
  const zelfde = hoofd.bron === 'bewoner' && hoofd.omtrek.length === 4 && omtrek.every((p, i) => Math.hypot(p[0] - hoofd.omtrek[i]![0], p[1] - hoofd.omtrek[i]![1]) < 0.05);
  if (zelfde) return null;
  const { kaart: _kaart, ...rest } = hoofd;
  const nieuw: Gebouw = { ...rest, bron: 'bewoner', omtrek };
  return { daken: { ...d, vlakken: losVan(d.vlakken, [hoofd.id]), gebouwen: gebouwen.map((g) => (g === hoofd ? nieuw : g)) }, u0, v0 };
}

/** Een gebouw weer weg (niet het hoofdhuis). Wat van de kaart kwam, staat daarna weer grijs om het huis. Null als het er niet is. */
export function gebouwWeg(d: Daken, id: string): Daken | null {
  const dt = dakTekening(d);
  const gebouwen = d.gebouwen ?? dt.gebouwen.map(kaalGebouw);
  const g = gebouwen.find((x) => x.id === id);
  if (!g || g.soort === 'hoofdhuis') return null;
  // Ook een gebouw dat de bewoner op maat trok, komt met de maat van de kaart terug in het grijs (ronde 2).
  const terug = g.kaartOmtrek ? [g.kaartOmtrek.map((p) => [p[0], p[1]] as Xy)] : g.bron === 'kaart' ? [g.omtrek.map((p) => [p[0], p[1]] as Xy)] : [];
  return { ...d, vlakken: losVan(d.vlakken, [id]), gebouwen: gebouwen.filter((x) => x.id !== id), omgeving: [...dt.omgeving.map((o) => o.map((p) => [p[0], p[1]] as Xy)), ...terug].slice(0, 20) };
}

/* ------------------------------------------------------------------ ronde 2 versie 2: de plattegrond buiten Nederland, en de straat */

/** Opnieuw kijken bij de plattegrond zonder 3D-kaart: wat het gebouw zegt, alleen waar nog niets stond; een dak van de bewoner blijft. */
function labelsVernieuwd(d: Daken, osm: KaartHuis | null): Daken | null {
  const lab = osm?.stand === 'huis' ? osm.labels : undefined;
  const huis = (d.gebouwen ?? []).find((g) => g.soort === 'hoofdhuis' && g.bron === 'kaart');
  if (!lab || !huis) return null;
  const nieuwHuis: Gebouw = {
    ...huis,
    ...(lab.dak && huis.dakBron !== 'bewoner' ? { dakvorm: lab.dak, dakBron: 'kaart' as const } : {}),
    ...(huis.hoogteNok == null && lab.nok != null ? { hoogteNok: lab.nok } : {}),
    ...(huis.hoogteGoot == null && lab.goot != null ? { hoogteGoot: lab.goot } : {}),
    ...(huis.lagen == null && lab.lagen != null ? { lagen: lab.lagen } : {}),
  };
  const nieuw: Daken = { ...d, gebouwen: (d.gebouwen ?? []).map((g) => (g === huis ? nieuwHuis : g)) };
  return JSON.stringify(nieuw) === JSON.stringify(d) ? null : nieuw;
}

export type StraatKant = 'voor' | 'links' | 'rechts' | 'achter';

/** De assen van het hoofdhuis zoals Je huis ze tekent; null zonder hoofdhuis met een omtrek. */
function assenVan(d: Daken): Kader | null {
  // Zoals Je huis tekent: het hoofdhuis opgeknipt uit het gebouw van de kaart.
  const hoofd = dakTekening(d).gebouwen.find((g) => g.soort === 'hoofdhuis');
  return hoofd && hoofd.omtrek.length >= 3 ? kaderVan(hoofd, d.voorgevelDeg) : null;
}

/** Aan welke kant van het huis een richting ligt, zoals de tekening hem nu toont: de straat staat onder (voor). */
export function kantVan(k: Kader, richtingDeg: number): StraatKant {
  const r = richting(richtingDeg);
  const u = r[0] * k.uAs[0] + r[1] * k.uAs[1];
  const v = r[0] * k.vAs[0] + r[1] * k.vAs[1];
  return Math.abs(u) > Math.abs(v) ? (u > 0 ? 'rechts' : 'links') : v > 0 ? 'achter' : 'voor';
}

/** De straten bij het huis met de kant waar ze nu liggen. Leeg zonder straten of hoofdhuis. */
export function stratenMetKant(d: Daken): { kant: StraatKant; afstand: number; adres: boolean }[] {
  const k = assenVan(d);
  return k ? (d.straten ?? []).map((s) => ({ kant: kantVan(k, s.richtingDeg), afstand: s.afstand, adres: s.adres })) : [];
}

/**
 * De straat aan een kant van het huis zetten (ronde 2 versie 2, keuze Ricardo
 * 20 november 2026: de straat van het adres onder, met Klopt dit?). `voor`
 * bevestigt wat er staat; een andere kant draait de voorkant daarheen: de
 * voorgevel kijkt dan die kant op, en de tekening draait mee. Null zonder
 * hoofdhuis.
 */
export function straatKies(d: Daken, kant: StraatKant): Daken | null {
  const k = assenVan(d);
  if (!k) return null;
  if (kant === 'voor') return { ...d, straatBevestigd: true };
  // De voorgevel kijkt van het huis af: voor is -v, achter +v, links -u, rechts +u.
  const as: Xy = kant === 'achter' ? k.vAs : kant === 'rechts' ? k.uAs : kant === 'links' ? [-k.uAs[0], -k.uAs[1]] : [-k.vAs[0], -k.vAs[1]];
  const deg = Math.round(((Math.atan2(as[0], as[1]) / RAD) % 360 + 360) % 360);
  return { ...d, voorgevelDeg: deg, straatBevestigd: true };
}
