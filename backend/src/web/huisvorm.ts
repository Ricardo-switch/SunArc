/*
 * Je huis op maat (besluit 288, stap 1): de vorm van de kamers op elke etage,
 * de maat van de etages, de zones als lijn in een kamer, en de plek van een
 * apparaat. Alleen opslag en meetkunde; de pagina's komen in de volgende
 * stappen (schets Wand-Huis-Ontwerp).
 *
 * De kamers op een etage zijn vakken in elk gebouw. Een vak deel je met één
 * lijn in tweeën, dwars of overlangs; zo sluiten de kamers altijd op elkaar
 * aan, zonder gaten of overlap. Vakken met dezelfde kamer zijn samen één
 * ruimte: zo loopt een woonkamer als een L of een U om een hal heen. Een vak
 * kan ook een eigen naam hebben zonder kamer in Home Assistant, zoals het
 * toilet of de overloop, of leeg zijn.
 *
 * Elk gebouw heeft zijn eigen assen: `u` van links naar rechts langs de
 * voorgevel (zoals je er vanaf de straat naar kijkt), `v` van voor naar
 * achter, in meters vanaf de linker voorhoek. Zo schuift de indeling mee als
 * de bewoner het gebouw verschuift of draait (Daken en panelen, Huisontwerp).
 */
import type { Gebouw, Xy } from './daken.js';
import { maatAs, rechthoekOm } from './daken-tekening.js';

export type As = 'u' | 'v';

/** Een vak zonder lijn: een kamer uit de indeling, een eigen naam, of leeg. */
export interface VakBlad {
  readonly kamer?: string;
  readonly naam?: string;
}
/** Een vak met een lijn: `op` meter vanaf de linkerkant (u) of de voorkant (v); `a` ervoor, `b` erachter. */
export interface VakSnede {
  readonly as: As;
  readonly op: number;
  readonly a: Vak;
  readonly b: Vak;
}
export type Vak = VakBlad | VakSnede;
export const isSnede = (v: Vak): v is VakSnede => 'as' in v;

/** De vakken van één etage, per gebouw (op het id uit Daken en panelen). */
export type Plattegrond = Readonly<Record<string, Vak>>;

/** De maat van een etage: hoe hoog, en op welke gebouwen hij ligt. Weg: zoals SunArc het schat. */
export interface EtageMaat {
  readonly hoogte?: number;
  readonly op?: readonly string[];
}

/** Waar een apparaat in zijn kamer staat: in welk gebouw, in meters langs u en v. */
export interface Plek {
  readonly gebouw: string;
  readonly u: number;
  readonly v: number;
}

export const GEBOUW_ID = /^[a-z]{2,12}(-\d{1,2})?$/;
const MAX_DIEPTE = 10;
const MAX_VAKKEN = 40;
const MAX_OP = 100;
const MAX_GEBOUWEN = 12;
export const HOOGTE_MIN = 1.5;
export const HOOGTE_MAX = 8;
/** Het kleinste vak dat een lijn overlaat, in meters. */
export const MIN_VAK = 0.3;

/** Op centimeters, zonder min-nul. */
const rond = (n: number) => Math.round(n * 100) / 100 + 0;
const getal = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
const obj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x != null && !Array.isArray(x);

function naamVan(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/\s+/g, ' ');
  return t.length >= 1 && t.length <= 30 ? t : null;
}

/**
 * Leest een vak. Een kamer die hier niet (meer) kan staan, valt weg en laat
 * het vak leeg: een kamer weghalen of verhuizen mag het bewaren nooit
 * blokkeren. Een lijn die niet klopt, weigert wel.
 */
export function leesVak(x: unknown, kamerOk: (id: string) => boolean, diepte = 0, teller = { n: 0 }): Vak | { fout: string } {
  if (!obj(x)) return { fout: 'een vak is een object' };
  if (diepte > MAX_DIEPTE) return { fout: `hooguit ${MAX_DIEPTE} lijnen in elkaar` };
  if (x['as'] !== undefined) {
    if (x['as'] !== 'u' && x['as'] !== 'v') return { fout: 'een lijn loopt langs u of v' };
    if (!getal(x['op'], 0.01, MAX_OP)) return { fout: `een lijn ligt tussen 0 en ${MAX_OP} meter` };
    const a = leesVak(x['a'], kamerOk, diepte + 1, teller);
    if ('fout' in a) return a;
    const b = leesVak(x['b'], kamerOk, diepte + 1, teller);
    if ('fout' in b) return b;
    return { as: x['as'], op: rond(x['op']), a, b };
  }
  teller.n++;
  if (teller.n > MAX_VAKKEN) return { fout: `hooguit ${MAX_VAKKEN} vakken per gebouw` };
  const kamer = typeof x['kamer'] === 'string' && kamerOk(x['kamer']) ? x['kamer'] : null;
  if (kamer) return { kamer };
  const naam = naamVan(x['naam']);
  return naam ? { naam } : {};
}

/** De plattegronden per etage en per gebouw; `kamerOp(etage, kamer)` zegt of die kamer op die etage staat. */
export function leesPlattegronden(x: unknown, etageOk: (id: string) => boolean, kamerOp: (etage: string, kamer: string) => boolean): { plattegrond: Record<string, Plattegrond> } | { fout: string } {
  if (!obj(x)) return { fout: 'plattegrond is een object per etage' };
  const uit: Record<string, Plattegrond> = {};
  for (const [etage, per] of Object.entries(x)) {
    if (!etageOk(etage)) return { fout: `plattegrond: onbekende etage "${etage}"` };
    if (!obj(per) || Object.keys(per).length > MAX_GEBOUWEN) return { fout: `plattegrond ${etage}: per gebouw een vak, hooguit ${MAX_GEBOUWEN}` };
    const gebouwen: Record<string, Vak> = {};
    for (const [gebouw, vak] of Object.entries(per)) {
      if (!GEBOUW_ID.test(gebouw)) return { fout: `plattegrond ${etage}: onbekend gebouw "${gebouw}"` };
      const v = leesVak(vak, (k) => kamerOp(etage, k));
      if ('fout' in v) return { fout: `plattegrond ${etage}, ${gebouw}: ${v.fout}` };
      gebouwen[gebouw] = v;
    }
    if (Object.keys(gebouwen).length) uit[etage] = gebouwen;
  }
  return { plattegrond: uit };
}

/** De maat per etage: een hoogte van 1,5 tot 8 meter, en de gebouwen waar hij op ligt. */
export function leesEtageMaten(x: unknown, etageOk: (id: string) => boolean): { maten: Record<string, EtageMaat> } | { fout: string } {
  if (!obj(x)) return { fout: 'etageMaten is een object per etage' };
  const uit: Record<string, EtageMaat> = {};
  for (const [etage, m] of Object.entries(x)) {
    if (!etageOk(etage)) return { fout: `etageMaten: onbekende etage "${etage}"` };
    if (!obj(m)) return { fout: `etageMaten ${etage} is een object` };
    const h = m['hoogte'];
    if (h !== undefined && h !== null && !getal(h, HOOGTE_MIN, HOOGTE_MAX)) return { fout: `etage ${etage}: de hoogte is ${HOOGTE_MIN} tot ${HOOGTE_MAX} meter` };
    const op = m['op'];
    if (op !== undefined && op !== null && (!Array.isArray(op) || op.length > MAX_GEBOUWEN || op.some((g) => typeof g !== 'string' || !GEBOUW_ID.test(g)) || new Set(op).size !== op.length)) {
      return { fout: `etage ${etage}: op is een lijst van gebouwen` };
    }
    const maat: EtageMaat = { ...(typeof h === 'number' ? { hoogte: Math.round(h * 10) / 10 } : {}), ...(Array.isArray(op) ? { op: op as string[] } : {}) };
    if (Object.keys(maat).length) uit[etage] = maat;
  }
  return { maten: uit };
}

/** De plek van een apparaat, of null als er geen is. */
export function leesPlek(x: unknown): Plek | null | { fout: string } {
  if (x == null) return null;
  if (!obj(x) || typeof x['gebouw'] !== 'string' || !GEBOUW_ID.test(x['gebouw']) || !getal(x['u'], -MAX_OP, MAX_OP) || !getal(x['v'], -MAX_OP, MAX_OP)) {
    return { fout: 'een plek is een gebouw met u en v in meters' };
  }
  return { gebouw: x['gebouw'], u: rond(x['u']), v: rond(x['v']) };
}

/**
 * De lijnen tussen de zones van een kamer: langs één as, oplopend, één minder
 * dan er zones zijn. Klopt het niet (er kwam een zone bij of af), dan valt
 * het weg en staan de zones weer als lijst.
 */
export function leesZoneGrenzen(as: unknown, grenzen: unknown, zones: number): { zoneAs: As; zoneGrenzen: number[] } | null {
  if ((as !== 'u' && as !== 'v') || !Array.isArray(grenzen) || zones < 2 || grenzen.length !== zones - 1) return null;
  if (grenzen.some((g, i) => !getal(g, -MAX_OP, MAX_OP) || (i > 0 && g <= (grenzen[i - 1] as number)))) return null;
  return { zoneAs: as, zoneGrenzen: grenzen.map((g) => rond(g as number)) };
}

/* ------------------------------------------------------------------ meetkunde */

/** Een rechthoek in de assen van een gebouw. */
export interface Rect {
  readonly u: number;
  readonly v: number;
  readonly breed: number;
  readonly diep: number;
}
export interface VakIn {
  readonly r: Rect;
  readonly blad: VakBlad;
  /** Waar het vak in de boom zit: a en b vanaf de top, zoals "ab". */
  readonly pad: string;
}

/** Een lijn houdt aan weerszijden minstens `MIN_VAK` over; in een te klein vak ligt hij in het midden. */
export function lijnOp(op: number, lengte: number): number {
  if (lengte < 2 * MIN_VAK) return lengte / 2;
  return Math.min(Math.max(op, MIN_VAK), lengte - MIN_VAK);
}

/** Alle vakken zonder lijn, met hun rechthoek. */
export function vakkenIn(vak: Vak, r: Rect, pad = ''): VakIn[] {
  if (!isSnede(vak)) return [{ r, blad: vak, pad }];
  if (vak.as === 'u') {
    const op = lijnOp(vak.op, r.breed);
    return [...vakkenIn(vak.a, { ...r, breed: op }, `${pad}a`), ...vakkenIn(vak.b, { ...r, u: r.u + op, breed: r.breed - op }, `${pad}b`)];
  }
  const op = lijnOp(vak.op, r.diep);
  return [...vakkenIn(vak.a, { ...r, diep: op }, `${pad}a`), ...vakkenIn(vak.b, { ...r, v: r.v + op, diep: r.diep - op }, `${pad}b`)];
}

/** Een ruimte: alle vakken met dezelfde kamer, of één vak met een eigen naam of leeg. */
export interface Ruimte {
  readonly kamer: string | null;
  readonly naam: string | null;
  readonly vakken: readonly VakIn[];
  readonly m2: number;
}
const sleutel = (v: VakIn) => (v.blad.kamer != null ? `k:${v.blad.kamer}` : `p:${v.pad}`);

export function ruimtesIn(vakken: readonly VakIn[]): Ruimte[] {
  const per = new Map<string, VakIn[]>();
  for (const v of vakken) {
    const k = sleutel(v);
    per.set(k, [...(per.get(k) ?? []), v]);
  }
  return [...per.values()].map((vs) => ({
    kamer: vs[0]!.blad.kamer ?? null,
    naam: vs[0]!.blad.naam ?? null,
    vakken: vs,
    m2: Math.round(vs.reduce((t, v) => t + v.r.breed * v.r.diep, 0) * 10) / 10,
  }));
}

/** Een muur binnen een gebouw: van (u1, v1) naar (u2, v2). */
export type Muur = readonly [number, number, number, number];
const bij = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const overlap = (a1: number, a2: number, b1: number, b2: number): [number, number] | null => (Math.max(a1, b1) < Math.min(a2, b2) - 1e-6 ? [Math.max(a1, b1), Math.min(a2, b2)] : null);

/** De muren tussen verschillende ruimtes; tussen vakken van dezelfde kamer staat er geen. */
export function murenIn(vakken: readonly VakIn[]): Muur[] {
  const uit: Muur[] = [];
  for (const a of vakken) {
    for (const b of vakken) {
      if (a === b || sleutel(a) === sleutel(b)) continue;
      if (bij(a.r.u + a.r.breed, b.r.u)) {
        const o = overlap(a.r.v, a.r.v + a.r.diep, b.r.v, b.r.v + b.r.diep);
        if (o) uit.push([b.r.u, o[0], b.r.u, o[1]]);
      }
      if (bij(a.r.v + a.r.diep, b.r.v)) {
        const o = overlap(a.r.u, a.r.u + a.r.breed, b.r.u, b.r.u + b.r.breed);
        if (o) uit.push([o[0], b.r.v, o[1], b.r.v]);
      }
    }
  }
  return uit.map((m) => m.map(rond) as unknown as Muur);
}

/** De assen van een gebouw op de kaart: de linker voorhoek, de richting van u en v, en de maat. */
export interface Kader {
  readonly oorsprong: Xy;
  readonly uAs: Xy;
  readonly vAs: Xy;
  readonly breed: number;
  readonly diep: number;
}

const RAD = Math.PI / 180;
const richting = (deg: number): Xy => [Math.sin(deg * RAD), Math.cos(deg * RAD)];

/**
 * De assen van een gebouw, op de rechthoek om zijn omtrek. De voorgevel kijkt
 * naar `voorgevelDeg` (0 is het noorden); wie op straat naar het huis kijkt,
 * kijkt de andere kant op, en u loopt dan naar rechts. Zonder voorgevel: het
 * zuiden.
 */
export function kaderVan(g: Pick<Gebouw, 'omtrek' | 'bron'>, voorgevelDeg: number | null): Kader {
  const r = rechthoekOm(g.omtrek, maatAs(g));
  const kijk = ((voorgevelDeg ?? 180) + 180) % 360;
  const rechts = (kijk + 90) % 360;
  // Welke as van de rechthoek ligt het dichtst bij "naar rechts"?
  const verschil = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
  const kandidaten = [r.asDeg, r.asDeg + 90, r.asDeg + 180, r.asDeg + 270];
  const uDeg = kandidaten.reduce((best, a) => (verschil(a, rechts) < verschil(best, rechts) ? a : best));
  const langs = ((uDeg - r.asDeg) % 180 + 180) % 180 < 1;
  const breed = langs ? r.lengte : r.breedte;
  const diep = langs ? r.breedte : r.lengte;
  const uAs = richting(uDeg);
  const vAs = richting(uDeg - 90);
  const oorsprong: Xy = [r.midden[0] - (uAs[0] * breed) / 2 - (vAs[0] * diep) / 2, r.midden[1] - (uAs[1] * breed) / 2 - (vAs[1] * diep) / 2];
  return { oorsprong: [rond(oorsprong[0]), rond(oorsprong[1])], uAs, vAs, breed: rond(breed), diep: rond(diep) };
}

/** Van de assen van een gebouw naar de kaart, en terug. */
export const naarKaart = (k: Kader, u: number, v: number): Xy => [k.oorsprong[0] + k.uAs[0] * u + k.vAs[0] * v, k.oorsprong[1] + k.uAs[1] * u + k.vAs[1] * v];
export function uitKaart(k: Kader, p: Xy): [number, number] {
  const dx = p[0] - k.oorsprong[0];
  const dy = p[1] - k.oorsprong[1];
  return [dx * k.uAs[0] + dy * k.uAs[1], dx * k.vAs[0] + dy * k.vAs[1]];
}
