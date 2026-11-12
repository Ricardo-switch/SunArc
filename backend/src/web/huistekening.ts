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
import type { Gebouw, Xy } from './daken.js';
import { maatAs, rechthoekOm } from './daken-tekening.js';

export type As = 'u' | 'v';

/** Een rechthoek in meters: [u, v, breed, diep]. */
export type Vak = readonly [u: number, v: number, breed: number, diep: number];

/** Een ruimte op een etage: een kamer, een eigen naam (met een soort), of niets. */
export interface TekenRuimte {
  readonly kamer?: string;
  readonly naam?: string;
  readonly soort?: EigenSoort;
  readonly vakken: readonly Vak[];
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
    uit.push({ ...(naam ? { naam, ...(soort ? { soort } : {}) } : {}), vakken });
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

/** Een gebouw als rechthoek in de assen van het hoofdhuis, in meters vanaf de linker voorhoek van het hele huis. */
export interface Blok {
  readonly id: string;
  readonly soort: 'hoofdhuis' | 'uitbouw' | 'garage';
  readonly u: number;
  readonly v: number;
  readonly b: number;
  readonly d: number;
}

export interface TekenVorm {
  /** De rechthoek om het hele huis. */
  readonly maat: { readonly breed: number; readonly diep: number };
  readonly blokken: readonly Blok[];
  /** Waar de linker voorhoek van het hoofdhuis ligt, in de maat: de tekening wordt daarvandaan bewaard. */
  readonly nul: { readonly u: number; readonly v: number };
  /** Waar de vorm vandaan komt: de gebouwen van Daken en panelen, of een rechthoek uit het woningtype. */
  readonly bron: 'gebouwen' | 'woning';
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
interface Kader {
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
export function tekenVorm(gebouwen: readonly Gebouw[], voorgevelDeg: number | null, woning: string | null | undefined): TekenVorm {
  const hoofd = gebouwen.find((g) => g.soort === 'hoofdhuis');
  if (!hoofd || hoofd.bron === 'schatting' || hoofd.omtrek.length < 3) {
    const [b, d] = WONING_MAAT[woning ?? 'vrijstaand'] ?? WONING_MAAT['vrijstaand']!;
    return { maat: { breed: b, diep: d }, blokken: [{ id: 'hoofd', soort: 'hoofdhuis', u: 0, v: 0, b, d }], nul: { u: 0, v: 0 }, bron: 'woning' };
  }
  const k = kaderVan(hoofd, voorgevelDeg);
  const ruw: { id: string; soort: Blok['soort']; u: number; v: number; b: number; d: number }[] = [{ id: 'hoofd', soort: 'hoofdhuis', u: 0, v: 0, b: k.breed, d: k.diep }];
  for (const g of gebouwen) {
    if (g === hoofd || (g.soort !== 'uitbouw' && g.soort !== 'garage') || g.omtrek.length < 3) continue;
    const punten = g.omtrek.map((p) => uitKaart(k, p));
    const u0 = Math.min(...punten.map((p) => p[0]));
    const v0 = Math.min(...punten.map((p) => p[1]));
    const blok = { id: g.id === 'hoofd' ? `${g.id}-2` : g.id, soort: g.soort, u: u0, v: v0, b: Math.max(...punten.map((p) => p[0])) - u0, d: Math.max(...punten.map((p) => p[1])) - v0 };
    if (blok.b < 1 || blok.d < 1) continue;
    if (afstand(blok, ruw[0]!) > 1) continue;
    ruw.push(blok);
  }
  // Alles op ruitjes, met de linker voorhoek van het hele huis op nul.
  const u0 = Math.min(...ruw.map((r) => r.u));
  const v0 = Math.min(...ruw.map((r) => r.v));
  const blokken = ruw.map((r) => ({ id: r.id, soort: r.soort, u: ruitje(r.u - u0), v: ruitje(r.v - v0), b: ruitje(r.b), d: ruitje(r.d) }));
  return {
    maat: { breed: Math.max(...blokken.map((r) => ruitje(r.u + r.b))), diep: Math.max(...blokken.map((r) => ruitje(r.v + r.d))) },
    blokken,
    nul: { u: ruitje(-u0), v: ruitje(-v0) },
    bron: 'gebouwen',
  };
}

/** De tekening van de hoek van het hoofdhuis naar die van het hele huis (`teken`), of terug (`bewaar`). */
export function verschuif(t: Readonly<Record<string, readonly TekenRuimte[]>>, du: number, dv: number): Record<string, TekenRuimte[]> {
  return Object.fromEntries(Object.entries(t).map(([e, lijst]) => [e, lijst.map((r) => ({ ...r, vakken: r.vakken.map(([u, v, b, d]) => [ruitje(u + du), ruitje(v + dv), b, d] as const) }))]));
}
