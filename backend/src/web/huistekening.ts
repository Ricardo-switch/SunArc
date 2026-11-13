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
import type { Daken, Dakvorm, DakVlak, Gebouw, Xy } from './daken.js';
import { maatAs, rechthoekOm, tekening as dakTekening } from './daken-tekening.js';

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

/**
 * Wat een apparaat in de tekening is (stap 3): het icoon, en waar het staat
 * zolang het geen eigen plek heeft (een airco aan de achterwand, een lamp in
 * het midden). Een klimaatapparaat dat kan koelen is een airco, anders een
 * thermostaat.
 */
export type TekenSoort = 'airco' | 'thermostaat' | 'licht' | 'screen' | 'meter' | 'camera' | 'rookmelder' | 'boiler' | 'jacuzzi' | 'stekker';

export function tekenSoort(a: { readonly soort: string; readonly klimaat?: { readonly kanKoelen: boolean } | null; readonly warmte?: { readonly soort: string }; readonly radiatorknop?: unknown }): TekenSoort {
  if (a.radiatorknop) return 'thermostaat';
  if (a.soort === 'klimaat') return a.klimaat?.kanKoelen ? 'airco' : 'thermostaat';
  if (a.soort === 'licht' || a.soort === 'screen' || a.soort === 'meter' || a.soort === 'camera' || a.soort === 'rookmelder') return a.soort;
  if (a.warmte?.soort === 'boiler' || a.warmte?.soort === 'jacuzzi') return a.warmte.soort;
  return 'stekker';
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
  const ruw: { id: string; soort: BlokSoort; u: number; v: number; b: number; d: number; dak: Dakvorm; nokLangs: 'x' | 'y' }[] = [{ id: 'hoofd', soort: 'hoofdhuis', u: 0, v: 0, b: k.breed, d: k.diep, dak: hoofd.dakvorm, nokLangs: langs(hoofd) }];
  for (const g of gebouwen) {
    // Een uitbouw of garage, en sinds 0.185.0 alles wat de bewoner op de kaart aanwees: ook een carport of tuinhuis los in de tuin.
    if (g === hoofd || !(ERBIJ_SOORTEN as readonly string[]).includes(g.soort) || g.omtrek.length < 3) continue;
    if (g.soort !== 'uitbouw' && g.soort !== 'garage' && g.bron === 'schatting') continue;
    const punten = g.omtrek.map((p) => uitKaart(k, p));
    const u0 = Math.min(...punten.map((p) => p[0]));
    const v0 = Math.min(...punten.map((p) => p[1]));
    const blok = { id: g.id === 'hoofd' ? `${g.id}-2` : g.id, soort: g.soort as BlokSoort, u: u0, v: v0, b: Math.max(...punten.map((p) => p[0])) - u0, d: Math.max(...punten.map((p) => p[1])) - v0, dak: g.dakvorm, nokLangs: langs(g) };
    if (blok.b < 1 || blok.d < 1) continue;
    // Een geschat blok alleen tegen het huis; wat van de kaart komt of de bewoner neerzette tot 30 meter verderop.
    if (afstand(blok, ruw[0]!) > (g.bron === 'schatting' ? 1 : 30)) continue;
    ruw.push(blok);
  }
  // Alles op ruitjes, met de linker voorhoek van het hele huis op nul.
  const u0 = Math.min(...ruw.map((r) => r.u));
  const v0 = Math.min(...ruw.map((r) => r.v));
  const blokken = ruw.map((r) => ({ id: r.id, soort: r.soort, u: ruitje(r.u - u0), v: ruitje(r.v - v0), b: ruitje(r.b), d: ruitje(r.d), dak: r.dak, nokLangs: r.nokLangs }));
  // De gebouwen eromheen in dezelfde assen, met hun plek in de lijst (die gaat mee als je er een aanwijst).
  const om = omgeving.flatMap((o, i) => (o.length < 3 ? [] : [{ i, punten: o.map((p) => uitKaart(k, p)).map(([u, v]) => [ruitje(u - u0), ruitje(v - v0)] as const) }]));
  return {
    maat: { breed: Math.max(...blokken.map((r) => ruitje(r.u + r.b))), diep: Math.max(...blokken.map((r) => ruitje(r.v + r.d))) },
    blokken,
    nul: { u: ruitje(-u0), v: ruitje(-v0) },
    bron: 'gebouwen',
    uDeg,
    omgeving: om,
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
  readonly dak?: { readonly dakvorm: Dakvorm; readonly nokDeg: number; readonly vlakken: readonly { readonly azimuthDeg: number; readonly tiltDeg: number; readonly m2: number }[] };
  readonly hoogte?: { readonly goot: number | null; readonly nok: number | null; readonly lagen: number | null };
}

/** Welke bron het huis bij Daken en panelen nu tekent. */
export function bronVanDaken(gebouwen: readonly Gebouw[]): VormBron {
  const h = gebouwen.find((g) => g.soort === 'hoofdhuis');
  return h?.bron === 'kaart' ? (h.kaart ?? 'osm') : 'zelf';
}

/** Alleen wat een gebouw is, zonder wat de tekening erbij rekende (maat, dakvlakken). */
export const kaalGebouw = (g: Gebouw): Gebouw => {
  const { id, soort, bron, omtrek, dakvorm, nokDeg, kaart, dakBron, hoogteGoot, hoogteNok, lagen } = g;
  return { id, soort, bron, omtrek, dakvorm, nokDeg, ...(kaart ? { kaart } : {}), ...(dakBron ? { dakBron } : {}), ...(hoogteGoot != null ? { hoogteGoot } : {}), ...(hoogteNok != null ? { hoogteNok } : {}), ...(lagen != null ? { lagen } : {}) };
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
export function dakenMetBron(d: Daken, bron: VormBron, kaart: KaartHuis | null): Daken | null {
  const oud = d.gebouwen ?? [];
  const { kaartDak: _k, ...rest } = d;
  if (bron === 'zelf') {
    return { ...rest, vlakken: losVan(d.vlakken, oud.filter((g) => g.bron !== 'bewoner').map((g) => g.id)), gebouwen: oud.filter((g) => g.bron === 'bewoner'), omgeving: [] };
  }
  const omtrek = kaart?.stand === 'huis' ? kaart.hoofdhuis : undefined;
  if (!kaart || !omtrek || omtrek.length < 3) return null;
  const weg = oud.filter((g) => g.soort !== 'hoofdhuis' && g.bron === 'schatting').map((g) => g.id);
  const dak = bron === 'bag3d' && kaart.dak ? { dakvorm: kaart.dak.dakvorm, nokDeg: kaart.dak.nokDeg, dakBron: 'kaart' as const } : {};
  const h = bron === 'bag3d' ? kaart.hoogte : undefined;
  const hoogte = { ...(h?.goot != null ? { hoogteGoot: h.goot } : {}), ...(h?.nok != null ? { hoogteNok: h.nok } : {}), ...(h?.lagen != null ? { lagen: h.lagen } : {}) };
  const huisId = oud.find((g) => g.soort === 'hoofdhuis')?.id ?? 'huis';
  const nieuwHuis = (g: Gebouw | null): Gebouw => {
    const basis: Gebouw = g ?? { id: huisId, soort: 'hoofdhuis', bron: 'kaart', omtrek: [], dakvorm: 'zadel', nokDeg: 0 };
    const { hoogteGoot: _g, hoogteNok: _n, lagen: _l, ...zonder } = basis;
    return { ...zonder, ...dak, ...hoogte, omtrek: omtrek.map((p) => [p[0], p[1]] as Xy), bron: 'kaart', kaart: bron };
  };
  const zonderWeg = oud.filter((g) => !weg.includes(g.id));
  const gebouwen = zonderWeg.some((g) => g.soort === 'hoofdhuis') ? zonderWeg.map((g) => (g.soort === 'hoofdhuis' ? nieuwHuis(g) : g)) : [nieuwHuis(null), ...zonderWeg];
  const kaartDak = bron === 'bag3d' && kaart.dak?.vlakken.length ? { kaartDak: kaart.dak.vlakken.slice(0, 24).map(({ azimuthDeg, tiltDeg, m2 }) => ({ azimuthDeg, tiltDeg, m2 })) } : {};
  return { ...rest, vlakken: losVan(d.vlakken, [...weg, ...(kaart.dak && bron === 'bag3d' ? [huisId] : [])]), gebouwen, omgeving: (kaart.omgeving ?? []).map((o) => o.map((p) => [p[0], p[1]] as Xy)), ...kaartDak };
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
  const uitBag = hoofd?.bron === 'kaart' && hoofd.kaart === 'bag3d' && hoofd.hoogteGoot != null;
  const geschat = m1(2.8 * Math.max(1, lagen));
  const nok = uitBag && hoofd.hoogteNok != null ? hoofd.hoogteNok : dakvorm === 'plat' ? geschat : m1(geschat + 3);
  // Het dak van het hoofdhuis: uit de dakvlakken van 3D BAG ligt de nok soms niet in het midden, met de goot aan de ene kant lager.
  const dak = (b: Blok): Blok => {
    if (b.soort !== 'hoofdhuis') return { ...b, ...bijDak(b, 2.8) };
    const scheef = uitBag ? scheefDak(b, d.kaartDak ?? [], v.uDeg, nok, hoofd.hoogteGoot!) : null;
    return { ...b, nok, ...(scheef ?? { goot0: uitBag ? hoofd.hoogteGoot! : geschat, goot1: uitBag ? hoofd.hoogteGoot! : geschat }) };
  };
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
  };
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
    if (i < 0 || x.tiltDeg < 5) continue;
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

/** Een gebouw weer weg (niet het hoofdhuis). Wat van de kaart kwam, staat daarna weer grijs om het huis. Null als het er niet is. */
export function gebouwWeg(d: Daken, id: string): Daken | null {
  const dt = dakTekening(d);
  const gebouwen = d.gebouwen ?? dt.gebouwen.map(kaalGebouw);
  const g = gebouwen.find((x) => x.id === id);
  if (!g || g.soort === 'hoofdhuis') return null;
  const terug = g.bron === 'kaart' ? [g.omtrek.map((p) => [p[0], p[1]] as Xy)] : [];
  return { ...d, vlakken: losVan(d.vlakken, [id]), gebouwen: gebouwen.filter((x) => x.id !== id), omgeving: [...dt.omgeving.map((o) => o.map((p) => [p[0], p[1]] as Xy)), ...terug].slice(0, 20) };
}
