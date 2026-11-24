/**
 * De gevels opmeten op de kaart. De meting uit de
 * opbrengst (besluit 157) gaf hier 92°, een kompas binnen tegen de muur 77°:
 * staal in de muur trekt een kompas opzij. De omtrek van het huis in
 * OpenStreetMap komt in Nederland uit de BAG, en is op de meter nauwkeurig.
 *
 * Alleen als de bewoner erom vraagt, met één knop, eenmalig en alleen lezen.
 * Sinds besluit 254 (stap 2a) gaat niet de plek van het huis naar
 * OpenStreetMap (Overpass), maar een vak van ongeveer 450 bij 400 meter op een
 * vast raster: OpenStreetMap ziet de wijk, niet het huis. SunArc kiest daarna
 * zelf het gebouw waar de plek uit Home Assistant in ligt. Het antwoord is een
 * voorstel; de bewoner kiest het, zoals bij Aanpassen.
 *
 * `gevelsUitOmtrek` is zuiver: de omtrek in, de richtingen van de gevels uit.
 */

/** Een punt van de omtrek, in graden. */
export interface Punt {
  readonly lat: number;
  readonly lon: number;
}

export interface KaartGevels {
  /** De richting van elke gevel naar buiten, de langste eerst, met de lengte in meters. */
  readonly gevels: readonly { readonly richtingDeg: number; readonly lengteM: number }[];
  /** De hoofdas: de twee richtingen waar de meeste muur naar kijkt, tegenover elkaar. */
  readonly as: readonly [number, number];
}

const RAD = Math.PI / 180;
const norm = (d: number) => ((Math.round(d) % 360) + 360) % 360;
const verschil = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** Ligt het punt binnen de omtrek? */
export function binnen(p: Punt, omtrek: readonly Punt[]): boolean {
  let in_ = false;
  for (let i = 0, j = omtrek.length - 1; i < omtrek.length; j = i++) {
    const a = omtrek[i]!;
    const b = omtrek[j]!;
    if (a.lat > p.lat !== b.lat > p.lat && p.lon < ((b.lon - a.lon) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lon) in_ = !in_;
  }
  return in_;
}

/** De gevels uit de omtrek: per muur de richting naar buiten, en de hoofdas van het huis. */
export function gevelsUitOmtrek(omtrek: readonly Punt[]): KaartGevels | null {
  const pts = omtrek.length > 1 && omtrek[0]!.lat === omtrek.at(-1)!.lat && omtrek[0]!.lon === omtrek.at(-1)!.lon ? omtrek.slice(0, -1) : omtrek;
  if (pts.length < 3) return null;
  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const xy = pts.map((p) => ({ x: p.lon * 111_320 * Math.cos(lat0 * RAD), y: p.lat * 110_540 }));
  // Met de klok mee of ertegenin: dan weet je welke kant buiten is.
  const oppervlak = xy.reduce((s, p, i) => {
    const q = xy[(i + 1) % xy.length]!;
    return s + p.x * q.y - q.x * p.y;
  }, 0);
  if (oppervlak === 0) return null;
  const gevels: { richtingDeg: number; lengteM: number }[] = [];
  for (let i = 0; i < xy.length; i++) {
    const p = xy[i]!;
    const q = xy[(i + 1) % xy.length]!;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const lengte = Math.hypot(dx, dy);
    if (lengte < 0.5) continue;
    // De loodlijn naar buiten: rechts van de richting als de omtrek tegen de klok in loopt.
    const nx = oppervlak > 0 ? dy : -dy;
    const ny = oppervlak > 0 ? -dx : dx;
    gevels.push({ richtingDeg: norm(Math.atan2(nx, ny) / RAD), lengteM: Math.round(lengte * 10) / 10 });
  }
  if (!gevels.length) return null;
  // De hoofdas: per richting (op 180° na) hoeveel meter muur, binnen 10°.
  let beste = { deg: 0, m: -1 };
  for (const g of gevels) {
    const m = gevels.filter((h) => Math.min(verschil(h.richtingDeg, g.richtingDeg), verschil(h.richtingDeg, g.richtingDeg + 180)) <= 10).reduce((s, h) => s + h.lengteM, 0);
    if (m > beste.m) beste = { deg: g.richtingDeg, m };
  }
  // Het gewogen gemiddelde van de muren op die as, naar dezelfde kant gedraaid.
  const op = gevels.filter((h) => Math.min(verschil(h.richtingDeg, beste.deg), verschil(h.richtingDeg, beste.deg + 180)) <= 10);
  let sx = 0;
  let sy = 0;
  for (const h of op) {
    const d = verschil(h.richtingDeg, beste.deg) <= 10 ? h.richtingDeg : h.richtingDeg + 180;
    sx += Math.sin(d * RAD) * h.lengteM;
    sy += Math.cos(d * RAD) * h.lengteM;
  }
  const as = norm(Math.atan2(sx, sy) / RAD);
  return { gevels: [...gevels].sort((a, b) => b.lengteM - a.lengteM), as: [as, norm(as + 180)] };
}

/**
 * De voorkant uit de kaart: van de vier richtingen van het huis (de hoofdas en
 * haaks erop) die het dichtst bij wat het huis al denkt, zoals de meting.
 */
export function voorkantUitKaart(k: KaartGevels, nuDeg: number): number {
  const kandidaten = [k.as[0], k.as[1], norm(k.as[0] + 90), norm(k.as[0] + 270)];
  return kandidaten.sort((a, b) => verschil(a, nuDeg) - verschil(b, nuDeg))[0]!;
}

/** Het raster: vakken van 0,004° noord-zuid bij 0,006° oost-west, ongeveer 450 bij 400 meter. */
const CEL = { lat: 0.004, lon: 0.006 } as const;
/** Zoveel erbij aan elke kant, zodat een huis op de rand van het vak heel blijft. */
const RAND = { lat: 0.0006, lon: 0.0009 } as const;

/** Het vak van het raster waar de plek in ligt; dat, en niet de plek, gaat naar OpenStreetMap. */
export function kaartVak(lat: number, lon: number): { zuid: number; west: number; noord: number; oost: number; sleutel: string } {
  const z = Math.floor(lat / CEL.lat) * CEL.lat;
  const w = Math.floor(lon / CEL.lon) * CEL.lon;
  const r = (n: number) => Number(n.toFixed(4));
  return { zuid: r(z - RAND.lat), west: r(w - RAND.lon), noord: r(z + CEL.lat + RAND.lat), oost: r(w + CEL.lon + RAND.lon), sleutel: `${r(z)},${r(w)}` };
}

/**
 * De vraag aan Overpass: alle gebouwen in het vak, met hun omtrek; sinds ronde
 * 2 ook de straten en de adressen in hetzelfde vak, om de
 * straat van je adres onder te zetten. Nog steeds het vak, niet de plek.
 */
export const overpassVraag = (lat: number, lon: number) => {
  const v = kaartVak(lat, lon);
  const vak = `(${v.zuid},${v.west},${v.noord},${v.oost})`;
  return `[out:json][timeout:50];(way${vak}["building"];way${vak}["highway"~"^(residential|living_street|unclassified|tertiary|secondary|primary|trunk|pedestrian)$"];node${vak}["addr:street"];);out geom;`;
};

interface OsmElement {
  readonly type?: string;
  readonly lat?: number;
  readonly lon?: number;
  readonly geometry?: readonly Punt[];
  readonly tags?: Readonly<Record<string, string>>;
}
const elementenVan = (antwoord: unknown): readonly OsmElement[] => (antwoord as { elements?: OsmElement[] })?.elements ?? [];

/** Staan er in het antwoord gebouwen? Zo niet, dan kent de kaart de wijk niet. */
export const heeftGebouwen = (antwoord: unknown) => omtrekkenVan(antwoord).length > 0;

/** De omtrekken van de gebouwen uit een antwoord van Overpass (geen straten, geen adressen). */
const omtrekkenVan = (antwoord: unknown): Punt[][] =>
  elementenVan(antwoord).filter((e) => !e.tags?.['highway'] && e.type !== 'node').map((e) => (e.geometry ?? []) as Punt[]).filter((g) => g.length >= 4);

const afstandM = (g: readonly Punt[], p: Punt) => {
  const m = g.reduce((s, q) => ({ lat: s.lat + q.lat / g.length, lon: s.lon + q.lon / g.length }), { lat: 0, lon: 0 });
  return Math.hypot((m.lat - p.lat) * 110_540, (m.lon - p.lon) * 111_320 * Math.cos(p.lat * RAD));
};

/** Het gebouw waar het huis in ligt, of anders het dichtstbijzijnde binnen 40 meter. */
export function kiesGebouw(antwoord: unknown, p: Punt): readonly Punt[] | null {
  const omtrekken = omtrekkenVan(antwoord);
  const erin = omtrekken.find((g) => binnen(p, g));
  if (erin) return erin;
  const dichtst = [...omtrekken].sort((a, b) => afstandM(a, p) - afstandM(b, p))[0];
  return dichtst && afstandM(dichtst, p) <= 40 ? dichtst : null;
}

/** Een omtrek in meters vanaf de plek: x naar het oosten, y naar het noorden. */
export function naarMeters(omtrek: readonly Punt[], p: Punt): [number, number][] {
  const pts = omtrek.length > 1 && omtrek[0]!.lat === omtrek.at(-1)!.lat && omtrek[0]!.lon === omtrek.at(-1)!.lon ? omtrek.slice(0, -1) : omtrek;
  return pts.map((q) => [Math.round((q.lon - p.lon) * 111_320 * Math.cos(p.lat * RAD) * 100) / 100, Math.round((q.lat - p.lat) * 110_540 * 100) / 100]);
}

/**
 * Het huis en de gebouwen eromheen (besluit 254, stap 2a), in meters vanaf de
 * plek: tot 20 gebouwen binnen 35 meter, de dichtstbijzijnde eerst. Daaruit
 * tikt de bewoner wat erbij hoort; de rest van het vak blijft weg.
 */
export function huisEnOmgeving(antwoord: unknown, p: Punt): { huis: [number, number][]; omgeving: [number, number][][] } | null {
  const huis = kiesGebouw(antwoord, p);
  if (!huis) return null;
  const omgeving = omtrekkenVan(antwoord)
    .filter((g) => g !== huis && afstandM(g, p) <= 35)
    .sort((a, b) => afstandM(a, p) - afstandM(b, p))
    .slice(0, 20)
    .map((g) => naarMeters(g, p));
  return { huis: naarMeters(huis, p), omgeving };
}

/** Vraagt Overpass om de gebouwen in het vak van de plek; het antwoord zoals het komt. */
export async function haalKaart(lat: number, lon: number, doe: typeof fetch = fetch): Promise<unknown> {
  const res = await doe('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'SmartClimate (github.com/Ricardo-switch/SunArc)' },
    body: `data=${encodeURIComponent(overpassVraag(lat, lon))}`,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  return res.json();
}

/** Vraagt Overpass om de omtrek van het huis; null als hij er niet is. */
export async function haalOmtrek(lat: number, lon: number, doe: typeof fetch = fetch): Promise<readonly Punt[] | null> {
  return kiesGebouw(await haalKaart(lat, lon, doe), { lat, lon });
}

/* ------------------------------------------------------------------ ronde 2: labels en straten */

/** Wat de plattegrond van het huis zelf weet (buiten Nederland is er geen 3D-kaart): de lagen, de hoogte en het dak. */
export interface OsmLabels {
  readonly lagen: number | null;
  /** De hoogte tot de nok (`height`), en tot de goot als `roof:height` erbij staat. */
  readonly nok: number | null;
  readonly goot: number | null;
  readonly dak: 'zadel' | 'schild' | 'lessenaar' | 'plat' | null;
}

const DAKEN: Readonly<Record<string, OsmLabels['dak']>> = { flat: 'plat', gabled: 'zadel', hipped: 'schild', 'half-hipped': 'schild', pyramidal: 'schild', skillion: 'lessenaar', lean_to: 'lessenaar' };
const meter = (x: string | undefined, min: number, max: number): number | null => {
  if (x == null || /'|ft/.test(x)) return null;
  const n = Number.parseFloat(x.replace(',', '.'));
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 10) / 10 : null;
};

/** De labels van het gebouw waar het huis in ligt: `building:levels`, `height`, `roof:height`, `roof:shape`. Null zonder huis. */
export function labelsVan(antwoord: unknown, p: Punt): OsmLabels | null {
  const huis = kiesGebouw(antwoord, p);
  const e = huis ? elementenVan(antwoord).find((x) => x.geometry === huis) : null;
  if (!e) return null;
  const t = e.tags ?? {};
  const lagen = meter(t['building:levels'], 1, 20);
  const nok = meter(t['height'], 2, 80);
  const dakHoog = meter(t['roof:height'], 0, 30);
  const dak = DAKEN[t['roof:shape'] ?? ''] ?? null;
  const goot = nok != null && dakHoog != null ? Math.round((nok - dakHoog) * 10) / 10 : nok != null && dak === 'plat' ? nok : null;
  return { lagen: lagen != null ? Math.round(lagen) : null, nok, goot: goot != null && goot >= 1 ? goot : null, dak };
}

/**
 * Een straat bij het huis: waar hij ligt (de richting vanaf het midden van het
 * huis, 0 is het noorden), hoe ver, en of het de straat van het adres is. De
 * naam gaat niet mee: bewaard worden alleen richtingen en afstanden, zoals bij
 * de vormen (besluit 254).
 */
export interface StraatBij {
  readonly richtingDeg: number;
  readonly afstand: number;
  readonly adres: boolean;
}

/** Het dichtstbijzijnde punt van een lijn bij nul, in meters. */
function dichtstBij(lijn: readonly (readonly [number, number])[]): [number, number] | null {
  let best: [number, number] | null = null;
  for (let i = 0; i + 1 < lijn.length; i++) {
    const [a, b] = [lijn[i]!, lijn[i + 1]!];
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / l2)) : 0;
    const q: [number, number] = [a[0] + t * dx, a[1] + t * dy];
    if (!best || Math.hypot(...q) < Math.hypot(...best)) best = q;
  }
  return best;
}

/**
 * De straten bij het huis (ronde 2): elke straat met een naam binnen 45 meter
 * van het midden van het huis, de dichtstbijzijnde eerst, hooguit vier; de
 * straat van het adres (een adrespunt in het huis, of het adres op het
 * gebouw) krijgt `adres`.
 */
export function stratenBij(antwoord: unknown, p: Punt): StraatBij[] {
  const huis = kiesGebouw(antwoord, p);
  if (!huis) return [];
  const els = elementenVan(antwoord);
  // Het midden van het huis; een omtrek die rond is (het eerste punt nog eens aan het eind) telt dat punt één keer.
  const rond = huis.length > 1 && huis[0]!.lat === huis.at(-1)!.lat && huis[0]!.lon === huis.at(-1)!.lon ? huis.slice(0, -1) : huis;
  const midden = rond.reduce((s, q) => ({ lat: s.lat + q.lat / rond.length, lon: s.lon + q.lon / rond.length }), { lat: 0, lon: 0 });
  const eigen = els.find((x) => x.geometry === huis);
  const adres = eigen?.tags?.['addr:street'] ?? els.find((x) => x.type === 'node' && x.tags?.['addr:street'] && x.lat != null && x.lon != null && binnen({ lat: x.lat, lon: x.lon }, huis))?.tags?.['addr:street'] ?? null;
  const per = new Map<string, [number, number]>();
  for (const e of els) {
    const naam = e.tags?.['name'];
    if (!e.tags?.['highway'] || !naam || !e.geometry || e.geometry.length < 2) continue;
    const q = dichtstBij(e.geometry.map((g) => [(g.lon - midden.lon) * 111_320 * Math.cos(midden.lat * RAD), (g.lat - midden.lat) * 110_540] as [number, number]));
    if (!q || Math.hypot(...q) > 45) continue;
    const al = per.get(naam);
    if (!al || Math.hypot(...q) < Math.hypot(...al)) per.set(naam, q);
  }
  return [...per.entries()]
    .sort((a, b) => Math.hypot(...a[1]) - Math.hypot(...b[1]))
    .slice(0, 4)
    .map(([naam, q]) => ({ richtingDeg: norm((Math.atan2(q[0], q[1]) * 180) / Math.PI), afstand: Math.round(Math.hypot(...q)), adres: naam === adres }));
}
