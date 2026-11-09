/**
 * Het huis uit 3D BAG (Ricardo, 5 november 2026), naast OpenStreetMap. TU
 * Delft en 3DGI maken van elk gebouw in de BAG een 3D-model uit de
 * hoogtemetingen van het AHN: de omtrek, en elk dakvlak met zijn richting en
 * helling. Alleen in Nederland; daarbuiten blijft OpenStreetMap.
 *
 * Privacy zoals bij OpenStreetMap (besluit 254, stap 2a): niet het huis gaat
 * naar buiten, maar een heel kaartvak van 3D BAG (0,5 tot 2 km breed, 200 tot
 * 1.900 gebouwen). SunArc vraagt de vakken van fijn naar grof tot er één
 * bestaat, en zoekt daarin zelf het gebouw waar de plek uit Home Assistant in
 * ligt. Bewaard worden alleen vormen in meters vanaf die plek.
 *
 * Het kaartvak is CityJSON (gzip), met de omtrek in LoD 0 en de dakvlakken in
 * LoD 2.2. De vakken volgen een vast raster in het Nederlandse stelsel (RD):
 * cellen van 250 meter vanaf (13600, 306900), per niveau twee keer zo groot.
 * Gevonden door de sessie "Huisschets op basis van omtrek" in de index van
 * 3D BAG (versie 2025.09.03). Licentie CC BY 4.0: "© 3DBAG by tudelft3d and
 * 3DGI", met een link, en erbij dat de vorm aangepast is.
 */

import { gunzipSync } from 'node:zlib';

import type { Dakvorm, Xy } from './daken.js';

/** De versie van 3D BAG; de link naar "de nieuwste" werkte niet, alleen een link met de versie erin. */
export const BAG3D_VERSIE = 'v20250903';
const HOST = 'https://3dbag.fsn1.your-objectstorage.com';

/** Ruim om Nederland heen; daarbuiten vraagt SunArc 3D BAG niets. */
export const inNederland = (lat: number, lon: number) => lat > 50.7 && lat < 53.7 && lon > 3.2 && lon < 7.3;

/** Van graden (WGS84) naar het Nederlandse stelsel in meters (RD), op ongeveer een meter (Schreutelkamp en Strang van Hees). */
export function naarRd(lat: number, lon: number): [number, number] {
  const f = 0.36 * (lat - 52.1551744);
  const l = 0.36 * (lon - 5.38720621);
  const R: [number, number, number][] = [[0, 1, 190094.945], [1, 1, -11832.228], [2, 1, -114.221], [0, 3, -32.391], [1, 0, -0.705], [3, 1, -2.34], [1, 3, -0.608], [0, 2, -0.008], [2, 3, 0.148]];
  const S: [number, number, number][] = [[1, 0, 309056.544], [0, 2, 3638.893], [2, 0, 73.077], [1, 2, -157.984], [3, 0, 59.788], [0, 1, 0.433], [2, 2, -6.439], [1, 1, -0.032], [0, 4, 0.092], [1, 4, -0.054]];
  const som = (t: [number, number, number][]) => t.reduce((s, [p, q, c]) => s + c * f ** p * l ** q, 0);
  return [155000 + som(R), 463000 + som(S)];
}

/** De kaartvakken waar een punt in ligt, van fijn (ongeveer 500 m) naar grof. */
export function vakSleutels(x: number, y: number): string[] {
  return ([[10, 2], [9, 4], [8, 8], [7, 16], [6, 32], [5, 64], [3, 256]] as const).map(([z, s]) => {
    const xi = Math.floor(Math.floor((x - 13600) / 250) / s) * s;
    const yi = Math.floor(Math.floor((y - 306900) / 250) / s) * s;
    return `${z}-${xi}-${yi}`;
  });
}

export const vakAdres = (sleutel: string) => {
  const [z, x, y] = sleutel.split('-');
  return `${HOST}/${BAG3D_VERSIE}/tiles/${z}/${x}/${y}/${sleutel}.city.json.gz`;
};

/** Haalt het kaartvak van de plek; null als er geen is. Gooit bij een fout van de verbinding. */
export async function haalBagVak(lat: number, lon: number, doe: typeof fetch = fetch): Promise<CityJson | null> {
  const [x, y] = naarRd(lat, lon);
  for (const k of vakSleutels(x, y)) {
    const res = await doe(vakAdres(k), { headers: { 'user-agent': 'SunArc (github.com/Ricardo-switch/SunArc)' }, signal: AbortSignal.timeout(60_000) });
    if (res.status === 404 || res.status === 403) continue;
    if (!res.ok) throw new Error(`3D BAG ${res.status}`);
    const b = Buffer.from(await res.arrayBuffer());
    // Gzip, tenzij de verbinding het al uitpakte.
    const tekst = b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b).toString('utf8') : b.toString('utf8');
    return JSON.parse(tekst) as CityJson;
  }
  return null;
}

/* ------------------------------------------------------------ lezen */

/** Wat SunArc uit CityJSON leest. */
export interface CityJson {
  readonly transform: { readonly scale: readonly number[]; readonly translate: readonly number[] };
  readonly vertices: readonly (readonly number[])[];
  readonly CityObjects: Readonly<Record<string, CityObject>>;
}
interface CityObject {
  readonly type: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly children?: readonly string[];
  readonly geometry?: readonly Geometrie[];
}
interface Geometrie {
  readonly type: string;
  readonly lod: string;
  readonly boundaries: unknown;
  readonly semantics?: { readonly surfaces: readonly Readonly<Record<string, unknown>>[]; readonly values: unknown };
}

/** Een dakvlak uit 3D BAG: richting, helling en oppervlak. */
export interface BagDakvlak {
  readonly azimuthDeg: number;
  readonly tiltDeg: number;
  readonly m2: number;
}

/** Het dak van een gebouw, zoals SunArc het tekent: de vorm, de nok, en de helling van de schuine vlakken. */
export interface BagDak {
  readonly dakvorm: Dakvorm;
  readonly nokDeg: number;
  readonly hellingDeg: number | null;
  readonly vlakken: readonly BagDakvlak[];
}

const norm = (d: number) => ((Math.round(d) % 360) + 360) % 360;
const hoekVerschil = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const rond = (n: number) => Math.round(n * 100) / 100;

/** Elke buitenrand van een MultiSurface of Solid, met zijn plek in de semantiek. */
function ringen(g: Geometrie): { i: number; ring: readonly number[] }[] {
  const b = g.boundaries as number[][][] | number[][][][];
  const vlakken = (g.type === 'Solid' ? (b as number[][][][])[0] : (b as number[][][])) ?? [];
  return vlakken.map((v, i) => ({ i, ring: v[0] ?? [] }));
}

function oppervlak3d(p: readonly (readonly number[])[]): number {
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (let k = 0; k < p.length; k++) {
    const a = p[k]!;
    const b = p[(k + 1) % p.length]!;
    sx += a[1]! * b[2]! - a[2]! * b[1]!;
    sy += a[2]! * b[0]! - a[0]! * b[2]!;
    sz += a[0]! * b[1]! - a[1]! * b[0]!;
  }
  return 0.5 * Math.hypot(sx, sy, sz);
}

function binnenRing(x: number, y: number, r: readonly Xy[]): boolean {
  let erin = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [ax, ay] = r[i]!;
    const [bx, by] = r[j]!;
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) erin = !erin;
  }
  return erin;
}

const middenVan = (r: readonly Xy[]): Xy => [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length];

/**
 * De dakvorm uit de dakvlakken: weinig schuin is plat; twee grote vlakken
 * tegenover elkaar een zadeldak (met ook vlakken opzij een schilddak); één
 * schuine kant een lessenaar. De nok loopt haaks op het grootste schuine vlak.
 */
export function dakUitVlakken(vlakken: readonly BagDakvlak[]): BagDak {
  const schuin = vlakken.filter((v) => v.tiltDeg >= 10).sort((a, b) => b.m2 - a.m2);
  const totaal = vlakken.reduce((s, v) => s + v.m2, 0);
  const schuinM2 = schuin.reduce((s, v) => s + v.m2, 0);
  const helling = schuinM2 > 0 ? Math.round(schuin.reduce((s, v) => s + v.tiltDeg * v.m2, 0) / schuinM2) : null;
  const eerste = schuin[0];
  if (!eerste || schuinM2 < 0.25 * totaal) return { dakvorm: 'plat', nokDeg: 0, hellingDeg: null, vlakken };
  const groot = (v: BagDakvlak) => v.m2 >= 0.3 * eerste.m2;
  const tegenover = schuin.some((v) => v !== eerste && groot(v) && hoekVerschil(v.azimuthDeg, eerste.azimuthDeg + 180) <= 30);
  const opzij = schuin.some((v) => v !== eerste && groot(v) && hoekVerschil(v.azimuthDeg, eerste.azimuthDeg + 90) <= 30) && schuin.some((v) => v !== eerste && groot(v) && hoekVerschil(v.azimuthDeg, eerste.azimuthDeg - 90) <= 30);
  if (tegenover) return { dakvorm: opzij ? 'schild' : 'zadel', nokDeg: norm(eerste.azimuthDeg + 90) % 180, hellingDeg: helling, vlakken };
  return { dakvorm: 'lessenaar', nokDeg: norm(eerste.azimuthDeg), hellingDeg: helling, vlakken };
}

/** Een gebouw uit 3D BAG, in meters vanaf de plek: x naar het oosten, y naar het noorden. */
export interface BagGebouw {
  readonly omtrek: Xy[];
  readonly dak: BagDak;
  readonly afstand: number;
}

/**
 * De gebouwen uit het kaartvak binnen 35 meter van de plek, het dichtstbij
 * eerst; het huis is het gebouw waar de plek in ligt, of anders het dichtste
 * binnen 40 meter. `x` en `y`: de plek in RD.
 */
export function bagHuisEnOmgeving(cj: CityJson, x: number, y: number): { huis: BagGebouw; omgeving: BagGebouw[] } | null {
  const t = cj.transform;
  const punt = (i: number): number[] => {
    const v = cj.vertices[i]!;
    return [v[0]! * t.scale[0]! + t.translate[0]! - x, v[1]! * t.scale[1]! + t.translate[1]! - y, v[2]! * t.scale[2]! + t.translate[2]!];
  };
  const alle: (BagGebouw & { erin: boolean })[] = [];
  for (const o of Object.values(cj.CityObjects)) {
    if (o.type !== 'Building') continue;
    const g0 = o.geometry?.find((g) => g.lod === '0');
    const ring = g0 ? ringen(g0)[0]?.ring : null;
    if (!ring || ring.length < 3) continue;
    const omtrek = ring.map((i) => {
      const p = punt(i);
      return [rond(p[0]!), rond(p[1]!)] as Xy;
    });
    const m = middenVan(omtrek);
    const afstand = Math.hypot(m[0], m[1]);
    if (afstand > 60) continue;
    const vlakken: BagDakvlak[] = [];
    for (const kind of o.children ?? []) {
      for (const g of cj.CityObjects[kind]?.geometry ?? []) {
        if (g.lod !== '2.2' || !g.semantics) continue;
        const waarden = g.semantics.values as number[] | number[][];
        for (const { i, ring: r } of ringen(g)) {
          const si = g.type === 'Solid' ? (waarden as number[][])[0]?.[i] : (waarden as number[])[i];
          const s = si == null ? null : g.semantics.surfaces[si];
          if (s?.['type'] !== 'RoofSurface') continue;
          const az = s['b3_azimut'];
          const tilt = s['b3_hellingshoek'];
          const m2 = oppervlak3d(r.map(punt));
          if (typeof tilt === 'number' && m2 > 0.5) vlakken.push({ azimuthDeg: typeof az === 'number' ? norm(az) : 0, tiltDeg: Math.round(tilt * 10) / 10, m2: Math.round(m2 * 10) / 10 });
        }
      }
    }
    alle.push({ omtrek, dak: dakUitVlakken(vlakken), afstand: Math.round(afstand * 10) / 10, erin: binnenRing(0, 0, omtrek) });
  }
  const huis = alle.find((g) => g.erin) ?? [...alle].sort((a, b) => a.afstand - b.afstand).find((g) => g.afstand <= 40);
  if (!huis) return null;
  const zonder = ({ erin: _e, ...g }: BagGebouw & { erin: boolean }): BagGebouw => g;
  const omgeving = alle.filter((g) => g !== huis && g.afstand <= 35).sort((a, b) => a.afstand - b.afstand).slice(0, 20).map(zonder);
  return { huis: zonder(huis), omgeving };
}

/** Ligt het midden van een omtrek binnen een van deze? Om dubbele gebouwen uit OpenStreetMap weg te laten. */
export const alBinnen = (o: readonly Xy[], in_: readonly (readonly Xy[])[]) => {
  const [mx, my] = middenVan(o);
  return in_.some((r) => binnenRing(mx, my, r));
};
