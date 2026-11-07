/*
 * Het huis van boven (besluit 254, stap 2a): de gebouwen met hun omtrek, de
 * dakvlakken uit de dakvorm, en op welk dakvlak elk vlak met panelen ligt.
 *
 * Alles in meters vanaf de plek van het huis in Home Assistant, x naar het
 * oosten en y naar het noorden. De dakvlakken volgen uit de kleinste
 * rechthoek om de omtrek: een zadeldak heeft er twee, een schilddak vier, een
 * lessenaar en een plat dak één. Zonder kaart staat het hoofdhuis als blok in
 * de richting van de voorgevel, en krijgen een uitbouw, garage, carport,
 * tuinhuis of rek op de grond een blok op een gangbare plek.
 *
 * De tekening verandert niets aan de berekening: die rekent met de richting
 * en de helling van elk vlak (daken.ts).
 */
import { panelenVan, type DakPlek, type DakVlak, type Daken, type Dakvorm, type Gebouw, type GebouwSoort, type Xy } from './daken.js';

const RAD = Math.PI / 180;
const norm = (deg: number) => ((deg % 360) + 360) % 360;
const hoekVerschil = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
/** Het verschil tussen twee assen, op 180° na. */
const asVerschil = (a: number, b: number) => Math.min(hoekVerschil(a, b), hoekVerschil(a, b + 180));
const richting = (deg: number): Xy => [Math.sin(deg * RAD), Math.cos(deg * RAD)];
const rond = (n: number) => Math.round(n * 100) / 100;

export interface Rechthoek {
  readonly midden: Xy;
  /** De lange as, 0 tot 180°. */
  readonly asDeg: number;
  readonly lengte: number;
  readonly breedte: number;
}

/**
 * De kleinste rechthoek om de omtrek, per graad gezocht. De lengte is de
 * langste kant, of met `voorAs` de kant die het dichtst bij die as ligt: dan
 * wisselen lengte en breedte niet om als de breedte groter wordt (issue 149).
 */
export function rechthoekOm(omtrek: readonly Xy[], voorAs?: number): Rechthoek {
  let beste: { a: number; opp: number; s: [number, number]; t: [number, number] } | null = null;
  for (let a = 0; a < 180; a++) {
    const u = richting(a);
    const p = richting(a + 90);
    let s0 = Infinity;
    let s1 = -Infinity;
    let t0 = Infinity;
    let t1 = -Infinity;
    for (const [x, y] of omtrek) {
      const s = x * u[0] + y * u[1];
      const t = x * p[0] + y * p[1];
      s0 = Math.min(s0, s);
      s1 = Math.max(s1, s);
      t0 = Math.min(t0, t);
      t1 = Math.max(t1, t);
    }
    const opp = (s1 - s0) * (t1 - t0);
    if (beste == null || opp < beste.opp - 1e-6) beste = { a, opp, s: [s0, s1], t: [t0, t1] };
  }
  const b = beste!;
  const u = richting(b.a);
  const p = richting(b.a + 90);
  const sm = (b.s[0] + b.s[1]) / 2;
  const tm = (b.t[0] + b.t[1]) / 2;
  const midden: Xy = [u[0] * sm + p[0] * tm, u[1] * sm + p[1] * tm];
  const l = b.s[1] - b.s[0];
  const w = b.t[1] - b.t[0];
  const langs = voorAs == null ? l >= w : asVerschil(voorAs, b.a) <= asVerschil(voorAs, b.a + 90);
  return langs ? { midden, asDeg: b.a, lengte: l, breedte: w } : { midden, asDeg: (b.a + 90) % 180, lengte: w, breedte: l };
}

/**
 * De as die de bewoner als lengte koos: een blok dat hij op maat zette is een
 * rechthoek waarvan de eerste rand langs de lengte loopt. Andere gebouwen
 * houden de langste kant als lengte.
 */
export function maatAs(g: Pick<Gebouw, 'omtrek' | 'bron'>): number | undefined {
  if (g.bron !== 'bewoner' || g.omtrek.length !== 4) return undefined;
  const [a, b] = g.omtrek as [Xy, Xy];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (Math.hypot(dx, dy) < 0.1) return undefined;
  return norm(Math.atan2(dx, dy) / RAD) % 180;
}

export interface Dakvlakje {
  /** Waar het dakvlak naartoe kijkt, of null bij een plat dak. */
  readonly kant: number | null;
  readonly punten: readonly Xy[];
}

export interface GebouwVanBoven {
  readonly dakvlakken: readonly Dakvlakje[];
  /** De nok als lijn, of null. */
  readonly nok: readonly [Xy, Xy] | null;
  /** De nok (of bij een lessenaar de kant) zoals hij op de rechthoek valt. */
  readonly nokDeg: number;
}

/** De dakvlakken van een gebouw uit zijn dakvorm, op de rechthoek om de omtrek. */
export function vanBoven(g: Pick<Gebouw, 'omtrek' | 'dakvorm' | 'nokDeg'>): GebouwVanBoven {
  const r = rechthoekOm(g.omtrek);
  const pt = (o: Xy, a: number, as: Xy, b: number, dw: Xy): Xy => [rond(o[0] + a * as[0] + b * dw[0]), rond(o[1] + a * as[1] + b * dw[1])];
  const c = r.midden;
  if (g.dakvorm === 'plat' || g.dakvorm === 'lessenaar') {
    const u = richting(r.asDeg);
    const p = richting(r.asDeg + 90);
    const l = r.lengte / 2;
    const w = r.breedte / 2;
    const punten = [pt(c, -l, u, -w, p), pt(c, l, u, -w, p), pt(c, l, u, w, p), pt(c, -l, u, w, p)];
    if (g.dakvorm === 'plat') return { dakvlakken: [{ kant: null, punten }], nok: null, nokDeg: norm(g.nokDeg) };
    // Een lessenaar kijkt naar een van de vier kanten van de rechthoek.
    const kant = [r.asDeg, r.asDeg + 90, r.asDeg + 180, r.asDeg + 270].map(norm).sort((a, b) => hoekVerschil(a, g.nokDeg) - hoekVerschil(b, g.nokDeg))[0]!;
    return { dakvlakken: [{ kant, punten }], nok: null, nokDeg: kant };
  }
  // Zadel- en schilddak: de nok langs de as van de rechthoek die het dichtst bij de gekozen nok ligt.
  const langs = asVerschil(g.nokDeg, r.asDeg) <= asVerschil(g.nokDeg, r.asDeg + 90);
  const n = langs ? r.asDeg : (r.asDeg + 90) % 180;
  const N = richting(n);
  const P = richting(n + 90);
  const l = (langs ? r.lengte : r.breedte) / 2;
  const w = (langs ? r.breedte : r.lengte) / 2;
  const p = (a: number, b: number) => pt(c, a, N, b, P);
  if (g.dakvorm === 'zadel') {
    return {
      dakvlakken: [
        { kant: norm(n + 90), punten: [p(-l, 0), p(l, 0), p(l, w), p(-l, w)] },
        { kant: norm(n + 270), punten: [p(-l, 0), p(l, 0), p(l, -w), p(-l, -w)] },
      ],
      nok: [p(-l, 0), p(l, 0)],
      nokDeg: n,
    };
  }
  const k = Math.max(0, l - w);
  return {
    dakvlakken: [
      { kant: norm(n + 90), punten: [p(-k, 0), p(k, 0), p(l, w), p(-l, w)] },
      { kant: norm(n + 270), punten: [p(-k, 0), p(k, 0), p(l, -w), p(-l, -w)] },
      { kant: norm(n), punten: [p(k, 0), p(l, w), p(l, -w)] },
      { kant: norm(n + 180), punten: [p(-k, 0), p(-l, w), p(-l, -w)] },
    ],
    nok: [p(-k, 0), p(k, 0)],
    nokDeg: n,
  };
}

/* ------------------------------------------------------------ gebouwen neerzetten */

/** Op welk soort gebouw een vlak met deze plek ligt; aan de gevel tekent hij nog niet. */
export const SOORT_VAN_PLEK: Readonly<Record<DakPlek, GebouwSoort | null>> = {
  hoofddak: 'hoofdhuis',
  dwarskap: 'hoofdhuis',
  uitbouw: 'uitbouw',
  garage: 'garage',
  carport: 'carport',
  tuinhuis: 'tuinhuis',
  grond: 'grond',
  gevel: null,
};

/**
 * Waar een blok staat zonder kaart, ten opzichte van het hoofdhuis: van links
 * naar rechts gezien vanaf de straat (u) en van de voorgevel naar achteren (v),
 * in meters vanaf de rand van het huis.
 */
const PLEK_BLOK: Partial<Record<GebouwSoort, (hw: number, voor: number, achter: number) => [number, number, number, number]>> = {
  uitbouw: (_hw, _v, a) => [-3, 3, a, a + 4],
  garage: (hw, v) => [hw + 0.6, hw + 3.8, -v, -v + 6],
  carport: (hw, v) => [-hw - 3.8, -hw - 0.6, -v, -v + 5.5],
  tuinhuis: (hw, _v, a) => [hw - 3.5, hw - 0.5, a + 9, a + 12],
  grond: (hw, _v, a) => [-hw + 0.5, -hw + 6.5, a + 6, a + 8],
};

/** Een voorstel voor de dakvorm, uit het soort gebouw en de vlakken die erop liggen. */
export function dakvormVoorstel(soort: GebouwSoort, vlakken: readonly DakVlak[], voorgevelDeg: number, huisPlat = false): { dakvorm: Dakvorm; nokDeg: number } {
  const schuin = vlakken.filter((v) => v.opstelling === 'schuin');
  if (soort === 'hoofdhuis' || soort === 'tuinhuis') {
    // Een schuin vlak: de nok loopt haaks op waar het naartoe kijkt.
    if (schuin.length) return { dakvorm: 'zadel', nokDeg: norm(schuin[0]!.azimuthDeg + 90) % 180 };
    // Zonder vlakken: wat de bewoner bij Inrichten zei over het dak van het huis.
    if (vlakken.length || (soort === 'hoofdhuis' && huisPlat)) return { dakvorm: 'plat', nokDeg: norm(voorgevelDeg + 90) % 180 };
    return { dakvorm: 'zadel', nokDeg: norm(voorgevelDeg + 90) % 180 };
  }
  if (schuin.length) return { dakvorm: 'lessenaar', nokDeg: norm(schuin[0]!.azimuthDeg) };
  return { dakvorm: 'plat', nokDeg: norm(voorgevelDeg + 90) % 180 };
}

/** Een rechthoek als omtrek: van links naar rechts (u) en van voor naar achter (v) in het huis. */
function blok(midden: Xy, voorDeg: number, u0: number, u1: number, v0: number, v1: number): Xy[] {
  // Rechts, gezien vanaf de straat: wie naar het huis kijkt, kijkt tegen de voorgevel in.
  const R = richting(voorDeg - 90);
  const F = richting(voorDeg);
  const pos = (u: number, v: number): Xy => [rond(midden[0] + u * R[0] - v * F[0]), rond(midden[1] + u * R[1] - v * F[1])];
  return [pos(u0, v0), pos(u1, v0), pos(u1, v1), pos(u0, v1)];
}

/**
 * De gebouwen voor de tekening: wat de bewoner bewaarde, en wat nog mist. Zonder
 * hoofdhuis een blok van 10 bij 9 meter met de voorgevel naar de voorkant; voor
 * een vlak op de garage, de uitbouw of elders zonder gebouw een blok ernaast.
 */
export function gebouwenNu(d: Daken, o: { huisPlat?: boolean } = {}): Gebouw[] {
  const voor = d.voorgevelDeg ?? 180;
  const bewaard = d.gebouwen ?? [];
  const vlakkenOp = (soort: GebouwSoort) => d.vlakken.filter((v) => (v.gebouw ? bewaard.find((g) => g.id === v.gebouw)?.soort === soort : SOORT_VAN_PLEK[v.plek] === soort));
  // Op een bewaard gebouw: wat ernaar wijst, en zonder aanwijzing wat bij zijn plek hoort (het eerste gebouw van die soort).
  const opGebouw = (g: Gebouw) => d.vlakken.filter((v) => (v.gebouw ? v.gebouw === g.id : SOORT_VAN_PLEK[v.plek] === g.soort && bewaard.find((x) => x.soort === g.soort) === g));
  // Een voorgestelde dakvorm volgt de vlakken erop (issue 143); wat de bewoner of 3D BAG gaf, blijft.
  const uit: Gebouw[] = bewaard.map((g) => {
    if (g.dakBron) return g;
    const op = opGebouw(g);
    if (!op.length && !(g.soort === 'hoofdhuis' && o.huisPlat)) return g;
    const v = dakvormVoorstel(g.soort, op, voor, o.huisPlat);
    return v.dakvorm === g.dakvorm ? g : { ...g, ...v };
  });
  if (!uit.some((g) => g.soort === 'hoofdhuis')) {
    uit.unshift({ id: 'huis', soort: 'hoofdhuis', bron: 'schatting', omtrek: blok([0, 0], voor, -5, 5, -4.5, 4.5), ...dakvormVoorstel('hoofdhuis', vlakkenOp('hoofdhuis'), voor, o.huisPlat) });
  }
  const huis = uit.find((g) => g.soort === 'hoofdhuis')!;
  // De maat van het huis langs de voorgevel en naar achteren, vanuit zijn midden.
  const r = rechthoekOm(huis.omtrek);
  const R = richting(voor - 90);
  const F = richting(voor);
  const langs = (p: Xy, as: Xy) => (p[0] - r.midden[0]) * as[0] + (p[1] - r.midden[1]) * as[1];
  const hw = Math.max(...huis.omtrek.map((p) => Math.abs(langs(p, R))));
  const vv = Math.max(...huis.omtrek.map((p) => langs(p, F)));
  const aa = Math.max(...huis.omtrek.map((p) => -langs(p, F)));
  for (const soort of ['uitbouw', 'garage', 'carport', 'tuinhuis', 'grond'] as const) {
    const op = d.vlakken.filter((v) => !v.gebouw && SOORT_VAN_PLEK[v.plek] === soort);
    if (!op.length || uit.some((g) => g.soort === soort)) continue;
    const [u0, u1, v0, v1] = PLEK_BLOK[soort]!(hw, vv, aa);
    uit.push({ id: soort, soort, bron: 'schatting', omtrek: blok(r.midden, voor, u0, u1, v0, v1), ...dakvormVoorstel(soort, op, voor) });
  }
  return uit;
}

/* ------------------------------------------------------------ vlakken op de tekening */

export interface VlakPlaats {
  readonly gebouw: string | null;
  /** Het dakvlak waar het op ligt: zijn richting, of null bij een plat dak. */
  readonly kant: number | null;
  /** Staat het in de tekening? Niet als geen dakvlak die kant op kijkt. */
  readonly getekend: boolean;
}

/**
 * Op welk dakvlak elk vlak ligt (vanzelf, tik om te wisselen): wat de bewoner
 * aanwees, anders het gebouw bij de plek en het dakvlak dat dezelfde kant op
 * kijkt. Een schuin vlak dat meer dan 60° afwijkt, staat er niet in.
 */
export function plaatsVlakken(vlakken: readonly DakVlak[], gebouwen: readonly Gebouw[]): Record<string, VlakPlaats> {
  const boven = new Map(gebouwen.map((g) => [g.id, vanBoven(g)]));
  const uit: Record<string, VlakPlaats> = {};
  for (const v of vlakken) {
    const aangewezen = v.gebouw ? gebouwen.filter((g) => g.id === v.gebouw) : [];
    const soort = SOORT_VAN_PLEK[v.plek];
    const kandidaten = aangewezen.length ? aangewezen : soort ? gebouwen.filter((g) => g.soort === soort) : [];
    let beste: { g: Gebouw; kant: number | null; af: number } | null = null;
    for (const g of kandidaten) {
      for (const dv of boven.get(g.id)!.dakvlakken) {
        // Aangewezen: het dakvlak dat het dichtst bij de gekozen kant ligt; anders bij de richting van het vlak.
        const doel = aangewezen.length && v.kant !== undefined ? v.kant : v.azimuthDeg;
        const af = dv.kant == null ? (doel == null || v.opstelling !== 'schuin' ? 0 : 90) : doel == null ? 90 : hoekVerschil(dv.kant, doel);
        if (beste == null || af < beste.af) beste = { g, kant: dv.kant, af };
      }
    }
    if (beste == null) uit[v.letter] = { gebouw: null, kant: null, getekend: false };
    else uit[v.letter] = { gebouw: beste.g.id, kant: beste.kant, getekend: aangewezen.length > 0 || v.opstelling !== 'schuin' || beste.af <= 60 };
  }
  return uit;
}

/** Het midden van een omtrek. */
export const middenVan = (omtrek: readonly Xy[]): Xy => [omtrek.reduce((s, p) => s + p[0], 0) / omtrek.length, omtrek.reduce((s, p) => s + p[1], 0) / omtrek.length];

/** Ligt het punt binnen de omtrek? */
export function binnenOmtrek(p: Xy, omtrek: readonly Xy[]): boolean {
  let erin = false;
  for (let i = 0, j = omtrek.length - 1; i < omtrek.length; j = i++) {
    const a = omtrek[i]!;
    const b = omtrek[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) erin = !erin;
  }
  return erin;
}

/* ------------------------------------------------------------ omtrek in blokken */

/** De oppervlakte van een omtrek, in m². */
export function oppervlak(omtrek: readonly Xy[]): number {
  let s = 0;
  for (let i = 0; i < omtrek.length; i++) {
    const a = omtrek[i]!;
    const b = omtrek[(i + 1) % omtrek.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

/**
 * Een omtrek in blokken (5 november 2026): OpenStreetMap heeft het huis met
 * een aangebouwde garage of uitbouw vaak als één gebouw. Is de omtrek geen
 * rechthoek, dan in rechthoeken langs zijn as, de grootste eerst: dat is het
 * huis, de rest zijn delen om aan te tikken. Null als het al een rechthoek is.
 */
export function inBlokken(omtrek: readonly Xy[]): { hoofd: Xy[]; rest: Xy[][] } | null {
  const r = rechthoekOm(omtrek);
  if (oppervlak(omtrek) >= 0.9 * r.lengte * r.breedte) return null;
  const U = richting(r.asDeg);
  const V = richting(r.asDeg + 90);
  const uv: Xy[] = omtrek.map((p) => [p[0] * U[0] + p[1] * U[1], p[0] * V[0] + p[1] * V[1]]);
  // De lijnen van het raster: elke hoek, wat dicht bij elkaar ligt samen.
  const lijnen = (waarden: number[]) => {
    const uit: number[] = [];
    for (const w of [...waarden].sort((a, b) => a - b)) if (!uit.length || w - uit.at(-1)! > 0.4) uit.push(w);
    return uit;
  };
  const us = lijnen(uv.map((p) => p[0]));
  const vs = lijnen(uv.map((p) => p[1]));
  const nI = us.length - 1;
  const nJ = vs.length - 1;
  if (nI < 1 || nJ < 1 || nI > 40 || nJ > 40) return null;
  const vrij = Array.from({ length: nI }, (_, i) => Array.from({ length: nJ }, (_, j) => binnenOmtrek([(us[i]! + us[i + 1]!) / 2, (vs[j]! + vs[j + 1]!) / 2], uv)));
  const blokken: Xy[][] = [];
  for (let n = 0; n < 5; n++) {
    // Telling per hoek, om snel te zien of een rechthoek van vakjes helemaal vrij is.
    const som = Array.from({ length: nI + 1 }, () => new Array<number>(nJ + 1).fill(0));
    for (let i = 0; i < nI; i++) for (let j = 0; j < nJ; j++) som[i + 1]![j + 1] = (vrij[i]![j] ? 1 : 0) + som[i]![j + 1]! + som[i + 1]![j]! - som[i]![j]!;
    const telling = (i0: number, j0: number, i1: number, j1: number) => som[i1 + 1]![j1 + 1]! - som[i0]![j1 + 1]! - som[i1 + 1]![j0]! + som[i0]![j0]!;
    let beste: { i0: number; j0: number; i1: number; j1: number; opp: number } | null = null;
    for (let i0 = 0; i0 < nI; i0++) {
      for (let j0 = 0; j0 < nJ; j0++) {
        for (let i1 = i0; i1 < nI; i1++) {
          for (let j1 = j0; j1 < nJ; j1++) {
            if (telling(i0, j0, i1, j1) !== (i1 - i0 + 1) * (j1 - j0 + 1)) break;
            const opp = (us[i1 + 1]! - us[i0]!) * (vs[j1 + 1]! - vs[j0]!);
            if (beste == null || opp > beste.opp) beste = { i0, j0, i1, j1, opp };
          }
        }
      }
    }
    // Kleiner dan 6 m² is een stoep of een erker: geen eigen blok.
    if (beste == null || beste.opp < 6) break;
    for (let i = beste.i0; i <= beste.i1; i++) for (let j = beste.j0; j <= beste.j1; j++) vrij[i]![j] = false;
    const terug = (u: number, v: number): Xy => [rond(u * U[0] + v * V[0]), rond(u * U[1] + v * V[1])];
    const [u0, u1, v0, v1] = [us[beste.i0]!, us[beste.i1 + 1]!, vs[beste.j0]!, vs[beste.j1 + 1]!];
    blokken.push([terug(u0, v0), terug(u1, v0), terug(u1, v1), terug(u0, v1)]);
  }
  if (blokken.length < 2) return null;
  return { hoofd: blokken[0]!, rest: blokken.slice(1) };
}

/* ------------------------------------------------------------ de panelen zelf */

/** Een paneel van boven: 1 meter breed, 1,7 meter lang, op de helling korter. */
const PANEEL = { breed: 1.0, lang: 1.7, tussen: 0.04, rand: 0.3 } as const;

/**
 * Zoveel panelen als er zijn, in rijen op het dakvlak (5 november 2026): niet
 * het hele dakvlak vol. Vanaf de nok naar beneden; een rij die niet vol is,
 * in het midden. Meer vlakken op één dakvlak delen de rijen, op letter.
 */
export function panelenOp(dv: Dakvlakje, vlakken: readonly DakVlak[]): Record<string, Xy[][]> {
  const eerste = vlakken[0];
  if (!eerste) return {};
  const kant = dv.kant ?? eerste.azimuthDeg;
  const K = richting(kant);
  const A = richting(kant + 90);
  const ak = dv.punten.map((p): Xy => [p[0] * A[0] + p[1] * A[1], p[0] * K[0] + p[1] * K[1]]);
  const a0 = Math.min(...ak.map((p) => p[0])) + PANEEL.rand;
  const a1 = Math.max(...ak.map((p) => p[0])) - PANEEL.rand;
  const k0 = Math.min(...ak.map((p) => p[1])) + PANEEL.rand;
  const k1 = Math.max(...ak.map((p) => p[1])) - PANEEL.rand;
  const cos = Math.cos((eerste.tiltDeg * Math.PI) / 180);
  // Op rekken staan de rijen uit elkaar, voor de schaduw; oost-west zijn twee panelen per rug.
  const diep = eerste.opstelling === 'oostwest' ? 2 * PANEEL.lang * cos : PANEEL.lang * cos;
  const stap = diep + (eerste.opstelling === 'rek' ? 0.8 : PANEEL.tussen);
  const perVak = eerste.opstelling === 'oostwest' ? 2 : 1;
  const rijen: [number, number][][] = [];
  for (let k = k0; k + diep <= k1 + 1e-6; k += stap) {
    const rij: [number, number][] = [];
    for (let a = a0; a + PANEEL.breed <= a1 + 1e-6; a += PANEEL.breed + PANEEL.tussen) {
      const hoeken: Xy[] = [[a, k], [a + PANEEL.breed, k], [a + PANEEL.breed, k + diep], [a, k + diep]];
      if (hoeken.every((h) => binnenOmtrek(h, ak))) rij.push([a, k]);
    }
    if (rij.length) rijen.push(rij);
  }
  const nodig = vlakken.map((v) => Math.ceil(panelenVan(v) / perVak));
  let over = nodig.reduce((s, n) => s + n, 0);
  const vakken: [number, number][] = [];
  for (const rij of rijen) {
    if (over <= 0) break;
    const n = Math.min(over, rij.length);
    const van = Math.floor((rij.length - n) / 2);
    vakken.push(...rij.slice(van, van + n));
    over -= n;
  }
  const naarWereld = (a: number, k: number): Xy => [rond(a * A[0] + k * K[0]), rond(a * A[1] + k * K[1])];
  const uit: Record<string, Xy[][]> = {};
  let i = 0;
  vlakken.forEach((v, j) => {
    uit[v.letter] = vakken.slice(i, i + nodig[j]!).map(([a, k]) => [naarWereld(a, k), naarWereld(a + PANEEL.breed, k), naarWereld(a + PANEEL.breed, k + diep), naarWereld(a, k + diep)]);
    i += nodig[j]!;
  });
  return uit;
}

export interface Tekening {
  /** Elk gebouw met zijn dakvlakken, en zijn maat: de rechthoek eromheen (stap 2b, om op maat te maken). */
  readonly gebouwen: readonly (Gebouw & GebouwVanBoven & { readonly maat: Rechthoek })[];
  /** De gebouwen eromheen die nog niet bij het huis horen. */
  readonly omgeving: readonly (readonly Xy[])[];
  readonly plaats: Readonly<Record<string, VlakPlaats>>;
  /** Per vlak zijn panelen van boven, zoveel als er zijn. */
  readonly panelen: Readonly<Record<string, readonly (readonly Xy[])[]>>;
}

/** De kleinste afstand tussen de hoeken van twee omtrekken, in meters. */
const afstandTussen = (a: readonly Xy[], b: readonly Xy[]) => Math.min(...a.flatMap((p) => b.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))));

/**
 * Alles wat de pagina nodig heeft om het huis van boven te tekenen. Een
 * gebouw uit de kaart dat geen rechthoek is, wordt het grootste blok; de rest
 * komt grijs ernaast, om aan te tikken. Van de omgeving alleen wat binnen 12
 * meter van het huis staat, hooguit acht.
 */
export function tekening(d: Daken, o: { huisPlat?: boolean } = {}): Tekening {
  const delen: Xy[][] = [];
  const gebouwen = gebouwenNu(d, o).map((g) => {
    if (g.bron !== 'kaart') return g;
    const b = inBlokken(g.omtrek);
    if (!b) return g;
    delen.push(...b.rest);
    return { ...g, omtrek: b.hoofd };
  });
  const huis = gebouwen.find((g) => g.soort === 'hoofdhuis')!;
  const vrij = (o: readonly Xy[]) => !gebouwen.some((g) => binnenOmtrek(middenVan(o), g.omtrek));
  const buren = (d.omgeving ?? [])
    .filter((o) => vrij(o) && !delen.some((x) => binnenOmtrek(middenVan(x), o)))
    .map((o) => ({ o, af: afstandTussen(o, huis.omtrek) }))
    .filter((x) => x.af <= 12)
    .sort((a, b) => a.af - b.af)
    .slice(0, 8)
    .map((x) => x.o);
  const plaats = plaatsVlakken(d.vlakken, gebouwen);
  const boven = gebouwen.map((g) => ({ ...g, ...vanBoven(g), maat: rechthoekOm(g.omtrek, maatAs(g)) }));
  const panelen: Record<string, Xy[][]> = {};
  for (const g of boven) {
    for (const dv of g.dakvlakken) {
      const op = d.vlakken.filter((v) => plaats[v.letter]?.getekend && plaats[v.letter]?.gebouw === g.id && plaats[v.letter]?.kant === dv.kant);
      Object.assign(panelen, panelenOp(dv, op));
    }
  }
  return { gebouwen: boven, omgeving: [...delen.filter(vrij), ...buren], plaats, panelen };
}
