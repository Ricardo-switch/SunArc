/*
 * Daken en panelen (besluit 254, stap 1): elk dakvlak apart.
 *
 * Een huis heeft niet één dak met twee kanten: een hoofddak met meer vlakken,
 * een uitbouw met een plat dak (oost-west, zoals idee #121), een garage,
 * panelen op de grond. Elk vlak heeft een letter, een plek, een opstelling,
 * een richting, een helling, een aantal panelen en de Wp per paneel, en de
 * meter (omvormer, string of micro-omvormers) die zijn opbrengst meet.
 *
 * Wat de bewoner bewaarde, staat bij de antwoorden (`daken`). Zonder dat
 * volgen de vlakken uit wat er al was: de ligging van het hoofddak (gemeten,
 * bevestigd, de configuratie of een schatting) en de panelen op de garage,
 * carport of het tuinhuis (besluit 187). Die tellen sindsdien mee.
 */
import type { Geometry, GeometrySource, SolarPlane } from '../core/model.js';

export const DAK_PLEKKEN = ['hoofddak', 'dwarskap', 'uitbouw', 'garage', 'carport', 'tuinhuis', 'grond', 'gevel'] as const;
export type DakPlek = (typeof DAK_PLEKKEN)[number];

/**
 * Hoe de panelen liggen: `schuin` op een schuin dak, `rek` op rekken naar één
 * kant (plat dak of de grond), `oostwest` in ruggen met de helft naar elke
 * kant, `plat` plat liggend.
 */
export const OPSTELLINGEN = ['schuin', 'rek', 'oostwest', 'plat'] as const;
export type Opstelling = (typeof OPSTELLINGEN)[number];

/** Waar de richting en de helling vandaan komen; dezelfde woorden als de configuratie. */
export type VlakBron = GeometrySource;
const VLAK_BRONNEN: readonly VlakBron[] = ['bewoner', 'gemeten', 'schatting'];

export interface DakVlak {
  /** A tot Z, vast zolang het vlak bestaat. */
  readonly letter: string;
  readonly plek: DakPlek;
  readonly opstelling: Opstelling;
  /** Waar het vlak naartoe kijkt; bij oost-west de eerste kant, de tweede kijkt er tegenover. */
  readonly azimuthDeg: number;
  /** 0 is plat, 90 staat rechtop. */
  readonly tiltDeg: number;
  /** De panelen op dit vlak; bij oost-west op de eerste kant. */
  readonly aantal: number;
  /** Bij oost-west de panelen op de andere kant. */
  readonly aantal2?: number;
  readonly wpPerPaneel: number;
  /** De sensor die de opbrengst van dit vlak meet, of null als de bewoner het niet weet. */
  readonly meter: string | null;
  readonly bron: VlakBron;
  /**
   * Op welk gebouw en welk dakvlak het ligt (stap 2): het gebouw en de richting
   * van dat dakvlak, null bij een plat dak. Weg: SunArc zoekt het zelf, naar
   * de plek en de richting.
   */
  readonly gebouw?: string;
  readonly kant?: number | null;
  /** Een eigen naam (Ricardo, 5 november 2026), zoals "Voorkant" of "Garage achter"; weg: de plek, met de richting erbij. */
  readonly naam?: string;
}

/** Wat voor gebouw (stap 2); `grond` is een rek in de tuin. */
export const GEBOUW_SOORTEN = ['hoofdhuis', 'uitbouw', 'garage', 'carport', 'tuinhuis', 'grond', 'anders'] as const;
export type GebouwSoort = (typeof GEBOUW_SOORTEN)[number];
export const DAKVORMEN = ['zadel', 'schild', 'lessenaar', 'plat'] as const;
export type Dakvorm = (typeof DAKVORMEN)[number];

/** Een punt in meters vanaf de plek van het huis in Home Assistant: x naar het oosten, y naar het noorden. */
export type Xy = readonly [number, number];

/**
 * Een gebouw van boven (besluit 254, stap 2): de omtrek, de dakvorm en de nok.
 * Bij een zadel- of schilddak is `nokDeg` de richting van de nok, bij een
 * lessenaar de kant waar het dak naartoe kijkt; bij plat telt hij niet.
 */
export interface Gebouw {
  readonly id: string;
  readonly soort: GebouwSoort;
  /**
   * `kaart`: de omtrek uit de kaart (ook als de bewoner hem verschoof of
   * draaide); `schatting`: een blok op een gangbare plek; `bewoner`: een blok
   * dat de bewoner zelf neerzette of op maat maakte (stap 2b).
   */
  readonly bron: 'kaart' | 'schatting' | 'bewoner';
  readonly omtrek: readonly Xy[];
  readonly dakvorm: Dakvorm;
  readonly nokDeg: number;
  /** Uit welke kaart de omtrek kwam (5 november 2026): 3D BAG of OpenStreetMap, voor de naamsvermelding. */
  readonly kaart?: 'bag3d' | 'osm';
  /**
   * Wie de dakvorm gaf (issue 143): de bewoner, of de kaart (3D BAG meet het
   * dak). Weg: een voorstel, dat de vlakken erop volgt.
   */
  readonly dakBron?: 'bewoner' | 'kaart';
  /**
   * De hoogte (besluit 288, Je huis): tot de goot en tot de nok in meters
   * boven de grond, en het aantal bouwlagen. Uit 3D BAG of van de bewoner;
   * weg: geschat uit de etages.
   */
  readonly hoogteGoot?: number;
  readonly hoogteNok?: number;
  readonly lagen?: number;
}

export interface Daken {
  readonly vlakken: readonly DakVlak[];
  /** Waar de voorkant naartoe kijkt; voor de gevels. Null: zoals de ligging hem vond. */
  readonly voorgevelDeg: number | null;
  /** Wat de omvormer hooguit levert; null als het niet bekend is. */
  readonly omvormerW: number | null;
  /** De gebouwen van boven (stap 2). Weg: SunArc zet ze zelf neer. */
  readonly gebouwen?: readonly Gebouw[];
  /** De gebouwen eromheen uit de kaart, om aan te tikken wat erbij hoort. */
  readonly omgeving?: readonly (readonly Xy[])[];
  /** Wat elke omvormer hooguit levert, als de bewoner het invulde (stap 4), in W per sensor. */
  readonly grenzen?: Readonly<Record<string, number>>;
  /** Wat de kaarten over het huis zeiden, de laatste keer dat de bewoner keek (6 november 2026). */
  readonly kaartStand?: KaartStand;
  /**
   * De dakvlakken van het hoofdhuis uit 3D BAG (6 november 2026), als het huis
   * daaruit getekend is: richting, helling en oppervlak, gemeten met een laser.
   * De pagina zet ze naast de meting, met Neem over.
   */
  readonly kaartDak?: readonly KaartDakvlak[];
}

export interface KaartDakvlak {
  readonly azimuthDeg: number;
  readonly tiltDeg: number;
  readonly m2: number;
}

function leesKaartDak(x: unknown): KaartDakvlak[] | null {
  if (!Array.isArray(x) || x.length > 24) return null;
  const uit: KaartDakvlak[] = [];
  for (const v of x) {
    const r = (typeof v === 'object' && v != null ? v : {}) as Record<string, unknown>;
    if (!getal(r['azimuthDeg'], 0, 360) || !getal(r['tiltDeg'], 0, 90) || !getal(r['m2'], 0, 5000)) return null;
    uit.push({ azimuthDeg: r['azimuthDeg'] as number, tiltDeg: r['tiltDeg'] as number, m2: r['m2'] as number });
  }
  return uit;
}

/**
 * Wat kan bij jouw huis (Ricardo, 6 november 2026): per kaart of hij het huis
 * kent (`huis`), alleen de wijk (`wijk`), niets (`niets`), geen antwoord gaf
 * (`fout`), of daar niet komt (`buiten`: 3D BAG buiten Nederland). Alleen
 * deze woorden en de dag; geen plek en geen vormen.
 */
export const KAART_STANDEN = ['huis', 'wijk', 'niets', 'fout', 'buiten'] as const;
export type KaartStandWoord = (typeof KAART_STANDEN)[number];
export interface KaartStand {
  readonly osm: KaartStandWoord;
  readonly bag3d: KaartStandWoord;
  /** De dag van het kijken, YYYY-MM-DD. */
  readonly datum: string;
}

function leesKaartStand(x: unknown): KaartStand | null {
  if (typeof x !== 'object' || x == null || Array.isArray(x)) return null;
  const r = x as Record<string, unknown>;
  const woord = (v: unknown) => (KAART_STANDEN.includes(v as KaartStandWoord) ? (v as KaartStandWoord) : null);
  const osm = woord(r['osm']);
  const bag3d = woord(r['bag3d']);
  const datum = typeof r['datum'] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r['datum']) ? r['datum'] : null;
  return osm && bag3d && datum ? { osm, bag3d, datum } : null;
}

/** Panelen op een ander dak (besluit 187), zoals bij de antwoorden. */
export type EldersAantal = Partial<Record<'garage' | 'carport' | 'tuinhuis', number>>;

export const MAX_VLAKKEN = 26;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const norm = (deg: number) => ((deg % 360) + 360) % 360;
const hoekVerschil = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** Wattpiek van een vlak: alle panelen, bij oost-west beide kanten. */
export function piekVan(v: DakVlak): number {
  return (v.aantal + (v.opstelling === 'oostwest' ? (v.aantal2 ?? 0) : 0)) * v.wpPerPaneel;
}

export function panelenVan(v: DakVlak): number {
  return v.aantal + (v.opstelling === 'oostwest' ? (v.aantal2 ?? 0) : 0);
}

/** De vlakken zoals de berekening ze kent; oost-west wordt twee vlakken. */
export function zonnevlakken(d: Daken): SolarPlane[] {
  const uit: SolarPlane[] = [];
  for (const v of d.vlakken) {
    const id = `vlak-${v.letter.toLowerCase()}`;
    const kanten: [number, number, string][] =
      v.opstelling === 'oostwest' ? [[v.azimuthDeg, v.aantal, id], [v.azimuthDeg + 180, v.aantal2 ?? 0, `${id}-2`]] : [[v.azimuthDeg, v.aantal, id]];
    for (const [az, n, kantId] of kanten) {
      const peakW = Math.round(n * v.wpPerPaneel);
      if (peakW > 0) uit.push({ id: kantId, azimuthDeg: Math.round(norm(az)), tiltDeg: Math.round(v.tiltDeg), peakW, source: v.bron, ...(v.meter ? { inverter: v.meter } : {}) });
    }
  }
  return uit;
}

/* ------------------------------------------------------------ lezen */

const getal = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const heel = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/**
 * De daken zoals de pagina of het bestand ze geeft. Null of zonder vlakken:
 * niet bewaard, dan volgen ze uit wat er al was.
 */
/** Een omtrek in meters: 3 tot 200 punten, binnen 500 meter van het huis. */
function leesOmtrek(x: unknown): Xy[] | null {
  if (!Array.isArray(x) || x.length < 3 || x.length > 200) return null;
  const uit: Xy[] = [];
  for (const p of x) {
    if (!Array.isArray(p) || p.length !== 2 || !getal(p[0], -500, 500) || !getal(p[1], -500, 500)) return null;
    uit.push([Math.round((p[0] as number) * 100) / 100, Math.round((p[1] as number) * 100) / 100]);
  }
  return uit;
}

function leesGebouwen(x: unknown): Gebouw[] | { fout: string } {
  if (x == null) return [];
  if (!Array.isArray(x) || x.length > 12) return { fout: 'de gebouwen zijn tot 12 stuks' };
  const ids = new Set<string>();
  const uit: Gebouw[] = [];
  for (const g of x) {
    const r = (typeof g === 'object' && g != null && !Array.isArray(g) ? g : {}) as Record<string, unknown>;
    const id = r['id'];
    const omtrek = leesOmtrek(r['omtrek']);
    if (typeof id !== 'string' || !/^[a-z]{2,12}(-\d{1,2})?$/.test(id) || ids.has(id)) return { fout: 'elk gebouw heeft een eigen naam' };
    ids.add(id);
    if (!GEBOUW_SOORTEN.includes(r['soort'] as GebouwSoort) || !DAKVORMEN.includes(r['dakvorm'] as Dakvorm) || !['kaart', 'schatting', 'bewoner'].includes(r['bron'] as string) || !getal(r['nokDeg'], 0, 360) || !omtrek) {
      return { fout: `gebouw ${id}: een soort, een dakvorm, de nok en een omtrek in meters` };
    }
    const kaart = r['kaart'] === 'bag3d' || r['kaart'] === 'osm' ? r['kaart'] : null;
    const dakBron = r['dakBron'] === 'bewoner' || r['dakBron'] === 'kaart' ? r['dakBron'] : null;
    // De hoogte (besluit 288): een goot van 1 tot 40 meter, een nok niet lager dan de goot, 1 tot 20 lagen.
    const goot = r['hoogteGoot'] == null ? null : getal(r['hoogteGoot'], 1, 40) ? Math.round((r['hoogteGoot'] as number) * 10) / 10 : undefined;
    const nok = r['hoogteNok'] == null ? null : getal(r['hoogteNok'], 1, 60) && (goot == null || (r['hoogteNok'] as number) >= goot) ? Math.round((r['hoogteNok'] as number) * 10) / 10 : undefined;
    const lagen = r['lagen'] == null ? null : Number.isInteger(r['lagen']) && getal(r['lagen'], 1, 20) ? (r['lagen'] as number) : undefined;
    if (goot === undefined || nok === undefined || lagen === undefined) return { fout: `gebouw ${id}: de goot is 1 tot 40 meter, de nok niet lager, en 1 tot 20 lagen` };
    uit.push({ id, soort: r['soort'] as GebouwSoort, bron: r['bron'] as Gebouw['bron'], omtrek, dakvorm: r['dakvorm'] as Dakvorm, nokDeg: r['nokDeg'] as number, ...(kaart && r['bron'] === 'kaart' ? { kaart } : {}), ...(dakBron ? { dakBron } : {}), ...(goot != null ? { hoogteGoot: goot } : {}), ...(nok != null ? { hoogteNok: nok } : {}), ...(lagen != null ? { lagen } : {}) });
  }
  return uit;
}

export function leesDaken(raw: unknown): { daken: Daken | null } | { fout: string } {
  if (raw == null) return { daken: null };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { fout: 'onbekende daken' };
  const r = raw as Record<string, unknown>;
  const lijst = r['vlakken'];
  if (!Array.isArray(lijst) || lijst.length > MAX_VLAKKEN) return { fout: `de daken zijn tot ${MAX_VLAKKEN} vlakken` };
  const gebouwen = leesGebouwen(r['gebouwen']);
  if ('fout' in gebouwen) return gebouwen;
  const omgevingRaw = r['omgeving'] ?? [];
  const omgeving = Array.isArray(omgevingRaw) && omgevingRaw.length <= 20 ? omgevingRaw.map(leesOmtrek) : null;
  if (!omgeving || omgeving.some((o) => o == null)) return { fout: 'de omgeving is tot 20 gebouwen met een omtrek in meters' };
  if (lijst.length === 0 && gebouwen.length === 0) return { daken: null };
  const grenzenRaw = r['grenzen'] ?? {};
  if (typeof grenzenRaw !== 'object' || Array.isArray(grenzenRaw) || Object.entries(grenzenRaw as object).some(([k, w]) => !/^sensor\.[a-z0-9_]{1,160}$/.test(k) || !getal(w, 100, 100_000))) {
    return { fout: 'de grens per omvormer is 100 tot 100.000 W' };
  }
  const grenzen = grenzenRaw as Record<string, number>;
  const kaartStand = r['kaartStand'] == null ? null : leesKaartStand(r['kaartStand']);
  if (r['kaartStand'] != null && !kaartStand) return { fout: 'wat de kaarten zeiden: osm en bag3d met een stand, en de dag' };
  const kaartDak = r['kaartDak'] == null ? null : leesKaartDak(r['kaartDak']);
  if (r['kaartDak'] != null && !kaartDak) return { fout: 'het dak uit de kaart: tot 24 vlakken met richting, helling en oppervlak' };
  const voorgevel = r['voorgevelDeg'] ?? null;
  if (voorgevel !== null && !getal(voorgevel, 0, 360)) return { fout: 'de voorkant is 0 tot 360°' };
  const omvormerW = r['omvormerW'] ?? null;
  if (omvormerW !== null && !getal(omvormerW, 100, 100_000)) return { fout: 'de omvormer is 100 tot 100.000 W' };
  const letters = new Set<string>();
  const vlakken: DakVlak[] = [];
  for (const x of lijst) {
    if (typeof x !== 'object' || x == null || Array.isArray(x)) return { fout: 'een vlak is een object' };
    const v = x as Record<string, unknown>;
    const letter = v['letter'];
    if (typeof letter !== 'string' || letter.length !== 1 || !LETTERS.includes(letter) || letters.has(letter)) return { fout: 'elk vlak heeft een eigen letter van A tot Z' };
    letters.add(letter);
    if (!DAK_PLEKKEN.includes(v['plek'] as DakPlek)) return { fout: `onbekende plek voor vlak ${letter}` };
    if (!OPSTELLINGEN.includes(v['opstelling'] as Opstelling)) return { fout: `onbekende opstelling voor vlak ${letter}` };
    if (!getal(v['azimuthDeg'], 0, 360) || !getal(v['tiltDeg'], 0, 90)) return { fout: `vlak ${letter}: de richting is 0 tot 360°, de helling 0 tot 90°` };
    const ow = v['opstelling'] === 'oostwest';
    const aantal2 = ow ? (v['aantal2'] ?? 0) : null;
    if (!heel(v['aantal'], ow ? 0 : 1, 200) || (ow && !heel(aantal2, 0, 200)) || (ow && (v['aantal'] as number) + (aantal2 as number) < 1)) {
      return { fout: `vlak ${letter}: het aantal panelen is een heel getal van 1 tot 200` };
    }
    if (!getal(v['wpPerPaneel'], 50, 1000)) return { fout: `vlak ${letter}: een paneel is 50 tot 1000 Wp` };
    const meter = v['meter'] ?? null;
    if (meter !== null && (typeof meter !== 'string' || !/^sensor\.[a-z0-9_]{1,160}$/.test(meter))) return { fout: `vlak ${letter}: de meter is een sensor uit Home Assistant` };
    const bron = v['bron'] ?? 'bewoner';
    if (!VLAK_BRONNEN.includes(bron as VlakBron)) return { fout: `vlak ${letter}: onbekende bron` };
    const gebouw = v['gebouw'];
    const kant = v['kant'];
    if (gebouw != null && (typeof gebouw !== 'string' || !gebouwen.some((g) => g.id === gebouw))) return { fout: `vlak ${letter}: onbekend gebouw` };
    if (kant != null && !getal(kant, 0, 360)) return { fout: `vlak ${letter}: de kant is 0 tot 360°` };
    const naamRaw = v['naam'] ?? null;
    if (naamRaw !== null && (typeof naamRaw !== 'string' || naamRaw.trim().length > 30)) return { fout: `vlak ${letter}: de naam is hooguit 30 tekens` };
    const naam = typeof naamRaw === 'string' ? naamRaw.trim().replace(/\s+/g, ' ') : '';
    vlakken.push({
      letter,
      plek: v['plek'] as DakPlek,
      opstelling: v['opstelling'] as Opstelling,
      azimuthDeg: norm(v['azimuthDeg'] as number),
      tiltDeg: v['tiltDeg'] as number,
      aantal: v['aantal'] as number,
      ...(ow ? { aantal2: aantal2 as number } : {}),
      wpPerPaneel: v['wpPerPaneel'] as number,
      meter: meter as string | null,
      bron: bron as VlakBron,
      ...(typeof gebouw === 'string' ? { gebouw, kant: (kant as number | null | undefined) ?? null } : {}),
      ...(naam ? { naam } : {}),
    });
  }
  return {
    daken: {
      vlakken,
      voorgevelDeg: voorgevel as number | null,
      omvormerW: omvormerW as number | null,
      ...(gebouwen.length ? { gebouwen } : {}),
      ...(omgeving.length ? { omgeving: omgeving as Xy[][] } : {}),
      ...(Object.keys(grenzen).length ? { grenzen: { ...grenzen } } : {}),
      ...(kaartStand ? { kaartStand } : {}),
      ...(kaartDak?.length ? { kaartDak } : {}),
    },
  };
}

/* ------------------------------------------------------------ uit wat er al was */

/** Waar panelen op een ander dak liggen, zolang de bewoner het niet zei. */
const ELDERS: Record<keyof EldersAantal, { opstelling: Opstelling; tiltDeg: number }> = {
  garage: { opstelling: 'rek', tiltDeg: 15 },
  carport: { opstelling: 'schuin', tiltDeg: 10 },
  tuinhuis: { opstelling: 'schuin', tiltDeg: 25 },
};

export interface OudeDaken {
  /** De ligging van het hoofddak zoals hij nu geldt, of null. */
  readonly geometry: Geometry | null;
  /** Het aantal panelen op het huis, als de bewoner het zei. */
  readonly aantal: number | null;
  /** Lag het dak plat (de kant "plat" in Inrichten)? */
  readonly plat: boolean;
  readonly elders: EldersAantal | null;
  /**
   * De wattpiek van het hoofddak komt uit de meting van alle panelen samen
   * (ook die op de garage): dan gaat het deel van de andere daken eraf.
   */
  readonly gemetenTotaal: boolean;
}

/** Een aantal over de vlakken verdeeld naar hun wattpiek, elk minstens één. */
function verdeel(totaal: number, delen: readonly number[]): number[] {
  const som = delen.reduce((s, d) => s + d, 0) || 1;
  const ruw = delen.map((d) => (totaal * d) / som);
  const uit = ruw.map((x) => Math.max(1, Math.floor(x)));
  let rest = totaal - uit.reduce((s, n) => s + n, 0);
  const volgorde = ruw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0 && volgorde.length; k++, rest--) uit[volgorde[k % volgorde.length]![1]]! += 1;
  return uit;
}

/**
 * De vlakken uit wat er al was (besluit 254: vanzelf vlakken). Het hoofddak
 * krijgt de vlakken van de ligging; twee bijna platte vlakken tegenover
 * elkaar zijn één vlak oost-west. De garage, de carport en het tuinhuis
 * krijgen een eigen vlak, gericht als het zonnigste vlak van het huis.
 */
export function dakenUitOud(o: OudeDaken): Daken {
  const planes = o.geometry?.solarPlanes.filter((p) => p.peakW > 0) ?? [];
  const elders = (Object.keys(ELDERS) as (keyof EldersAantal)[]).filter((p) => (o.elders?.[p] ?? 0) > 0);
  const eldersN = elders.reduce((s, p) => s + (o.elders?.[p] ?? 0), 0);
  const schaal = o.gemetenTotaal && o.aantal && eldersN ? o.aantal / (o.aantal + eldersN) : 1;

  // Twee bijna platte vlakken tegenover elkaar: één vlak oost-west.
  type Groep = { planes: SolarPlane[]; ow: boolean };
  const groepen: Groep[] =
    planes.length === 2 && planes.every((p) => p.tiltDeg < 20) && hoekVerschil(planes[0]!.azimuthDeg, planes[1]!.azimuthDeg + 180) <= 15
      ? [{ planes: [...planes], ow: true }]
      : planes.map((p) => ({ planes: [p], ow: false }));
  const aantallen = o.aantal ? verdeel(o.aantal, planes.map((p) => p.peakW)) : planes.map((p) => Math.max(1, Math.round(p.peakW / 400)));
  const nVan = (p: SolarPlane) => aantallen[planes.indexOf(p)]!;
  const totaalPiek = planes.reduce((s, p) => s + p.peakW, 0) * schaal;
  const totaalN = planes.reduce((s, p) => s + nVan(p), 0);
  const gemWp = totaalN ? totaalPiek / totaalN : 400;

  const vlakken: DakVlak[] = [];
  const letter = () => LETTERS[vlakken.length]!;
  for (const g of groepen) {
    const [a, b] = g.planes;
    const n = nVan(a!);
    const n2 = b ? nVan(b) : 0;
    const piek = g.planes.reduce((s, p) => s + p.peakW, 0) * schaal;
    vlakken.push({
      letter: letter(),
      plek: 'hoofddak',
      opstelling: g.ow ? 'oostwest' : o.plat || a!.tiltDeg < 10 ? 'rek' : 'schuin',
      azimuthDeg: norm(a!.azimuthDeg),
      tiltDeg: a!.tiltDeg,
      aantal: n,
      ...(g.ow ? { aantal2: n2 } : {}),
      wpPerPaneel: piek / (n + n2),
      meter: null,
      bron: a!.source,
    });
  }
  // Het zonnigste vlak: het dichtst bij het zuiden.
  const zuid = [...planes].sort((x, y) => hoekVerschil(x.azimuthDeg, 180) - hoekVerschil(y.azimuthDeg, 180))[0];
  for (const p of elders) {
    vlakken.push({
      letter: letter(),
      plek: p,
      opstelling: ELDERS[p].opstelling,
      azimuthDeg: norm(zuid?.azimuthDeg ?? 180),
      tiltDeg: ELDERS[p].tiltDeg,
      aantal: o.elders![p]!,
      wpPerPaneel: gemWp,
      meter: null,
      bron: 'schatting',
    });
  }
  return {
    vlakken,
    voorgevelDeg: o.geometry?.facades.find((f) => f.id === 'voorgevel')?.azimuthDeg ?? null,
    omvormerW: o.geometry?.inverterMaxW ?? null,
  };
}

/**
 * Heeft het hoofdhuis een plat dak (issue 131)? Zoals de bewoner het opgaf: de
 * dakvorm van het hoofdhuis als de bewoner of 3D BAG hem gaf, anders de
 * vlakken van het hoofddak (allemaal op rekken, oost-west of plat), anders de
 * voorgestelde dakvorm, het antwoord "plat dak" bij Inrichten of het oude
 * antwoord. Een voorgestelde dakvorm bleef eerst staan als de vlakken
 * veranderden (issue 143): dan bleef Thuis een puntdak tonen. Liggen alle
 * panelen op het hoofddak op rekken, oost-west of plat, dan gaan die voor een
 * puntdak uit 3D BAG (issue 150): zo liggen panelen alleen op een plat dak.
 * Koos de bewoner bij Inrichten of Kamers en indeling "plat dak", dan gaat
 * dat voor alles (Ricardo, 7 november 2026: het bleef een puntdak).
 */
export function hoofddakPlat(daken: Daken | null | undefined, ligging: string | null | undefined, inrichtenPlat = false): boolean {
  const huis = daken?.gebouwen?.find((g) => g.soort === 'hoofdhuis');
  const hoofd = (daken?.vlakken ?? []).filter((v) => v.plek === 'hoofddak');
  const allesPlat = hoofd.length > 0 && hoofd.every((v) => v.opstelling !== 'schuin');
  if (inrichtenPlat) return true;
  if (huis?.dakBron === 'kaart' && allesPlat) return true;
  if (huis?.dakBron) return huis.dakvorm === 'plat';
  if (hoofd.length) return allesPlat;
  if (huis) return huis.dakvorm === 'plat';
  return ligging === 'plat';
}

export const heeftElders = (e: EldersAantal | null | undefined) => Object.values(e ?? {}).some((n) => (n ?? 0) > 0);
