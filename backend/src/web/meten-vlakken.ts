/*
 * De meting per dakvlak (besluit 254, stap 4). De meting van besluit 157 kent
 * hooguit één vlak, of twee tegenover elkaar. Hier begint hij bij de vlakken
 * die de bewoner invulde, per meter (omvormer): voor elk vlak zoekt hij binnen
 * 60° van de ingevulde richting de richting en de helling die het best bij de
 * heldere momenten passen. De verhouding tussen de vlakken staat vast: het
 * aantal panelen maal de Wp. Wat niet duidelijk beter past dan de invoer,
 * blijft de invoer: twee vlakken die bijna dezelfde kant op kijken, zijn uit
 * één meter niet uit elkaar te halen.
 *
 * Daarnaast het verdelen: wat één meter meet, per vlak naar wat elk vlak bij
 * heldere lucht zou leveren.
 */
import { clearSkyOnPlaneWm2, sunPosition, type SunPosition } from '../core/sun.js';
import { panelenVan, piekVan, type DakVlak, type Daken } from './daken.js';
import { beoordeel, bovenkant, goedGenoeg, type Beoordeling } from './ligging.js';
import type { Location } from './sun.js';
import { partsIn, type PowerRow } from './today.js';

const norm = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;

/** Hoe ver de helling mag gaan, per opstelling. */
const BEREIK: Record<DakVlak['opstelling'], readonly [number, number]> = { schuin: [10, 60], rek: [5, 40], oostwest: [0, 25], plat: [0, 0] };
/** Tot zo ver van de ingevulde richting. */
const ZOEK_AZ = 60;
/** Zoveel beter moet het passen dan de invoer, anders blijft de invoer. */
const BETER = 0.01;

export interface VlakStand {
  readonly azimuthDeg: number;
  readonly tiltDeg: number;
}

export interface MeterMeting {
  /** Per letter wat de meting vond. */
  readonly vlakken: Readonly<Record<string, VlakStand>>;
  readonly fout: number;
  /** Wat de meter bij heldere lucht haalt, in Wp. */
  readonly peakW: number;
}

/** De vlakken van een vlak voor het model: oost-west zijn er twee, met elk hun deel. */
function stukken(v: DakVlak, s: VlakStand): { azimuthDeg: number; tiltDeg: number; w: number }[] {
  if (v.opstelling === 'oostwest') {
    return [
      { azimuthDeg: s.azimuthDeg, tiltDeg: s.tiltDeg, w: v.aantal * v.wpPerPaneel },
      { azimuthDeg: norm(s.azimuthDeg + 180), tiltDeg: s.tiltDeg, w: (v.aantal2 ?? 0) * v.wpPerPaneel },
    ].filter((x) => x.w > 0);
  }
  return [{ azimuthDeg: s.azimuthDeg, tiltDeg: s.tiltDeg, w: piekVan(v) }];
}

/** Het model voor heldere lucht van een stel vlakken, per W/m² wattpiek. */
function modelVan(vlakken: readonly DakVlak[], stand: readonly VlakStand[]): (sun: SunPosition) => number {
  const delen = vlakken.flatMap((v, i) => stukken(v, stand[i]!));
  const som = delen.reduce((s, d) => s + d.w, 0) || 1;
  return (sun) => delen.reduce((s, d) => s + (clearSkyOnPlaneWm2(sun, d) * d.w) / som, 0);
}

/**
 * Meet de vlakken op één meter uit zijn opbrengst, of null zonder heldere dag
 * of als niets goed genoeg past. `omvormerW`: wat de omvormer hooguit levert.
 */
export function meetVlakken(rows: readonly PowerRow[], vlakken: readonly DakVlak[], location: Location, omvormerW?: number | null): MeterMeting | null {
  if (!vlakken.length) return null;
  const boven = bovenkant(rows, location, omvormerW);
  if (!boven) return null;
  const aantal = vlakken.reduce((s, v) => s + panelenVan(v), 0);
  const laag = Math.max(boven.maxW * 0.9, aantal * 250);
  const hoog = Math.min(boven.maxW * 4, aantal * 550);
  const invoer: VlakStand[] = vlakken.map((v) => ({ azimuthDeg: norm(v.azimuthDeg), tiltDeg: Math.round(v.tiltDeg) }));
  const score = (st: readonly VlakStand[]) => beoordeel(boven.punten, modelVan(vlakken, st), laag, hoog);
  const beter = (a: Beoordeling | null, b: Beoordeling | null) => a != null && (b == null || a.fout < b.fout);

  let stand = [...invoer];
  let huidig = score(stand);
  const rondes = vlakken.length > 8 ? 1 : 3;
  for (let ronde = 0; ronde < rondes; ronde++) {
    vlakken.forEach((v, i) => {
      // Plat liggend: geen richting en geen helling om te zoeken.
      if (v.opstelling === 'plat') return;
      const [t0, t1] = BEREIK[v.opstelling];
      const probeer = (az: number, tilt: number) => {
        const st = stand.map((x, j) => (j === i ? { azimuthDeg: norm(az), tiltDeg: tilt } : x));
        const r = score(st);
        if (beter(r, huidig)) {
          stand = st;
          huidig = r;
        }
      };
      const a0 = invoer[i]!.azimuthDeg;
      for (let d = -ZOEK_AZ; d <= ZOEK_AZ; d += 5) for (let t = t0; t <= t1; t += 5) probeer(a0 + d, t);
      // Fijner rond de beste.
      const b = stand[i]!;
      for (let d = -4; d <= 4; d++) {
        for (let t = Math.max(t0, b.tiltDeg - 4); t <= Math.min(t1, b.tiltDeg + 4); t++) {
          if (Math.abs(((b.azimuthDeg + d - a0 + 540) % 360) - 180) <= ZOEK_AZ) probeer(b.azimuthDeg + d, t);
        }
      }
    });
  }
  if (huidig == null || !goedGenoeg(huidig)) return null;
  // Wat niet duidelijk beter past dan de invoer, blijft de invoer.
  vlakken.forEach((_v, i) => {
    const terug = stand.map((x, j) => (j === i ? invoer[i]! : x));
    const r = score(terug);
    if (r != null && huidig != null && r.fout <= huidig.fout * (1 + BETER)) {
      stand = terug;
      huidig = r;
    }
  });
  return {
    vlakken: Object.fromEntries(vlakken.map((v, i) => [v.letter, stand[i]!])),
    fout: Math.round(huidig.fout * 1000) / 1000,
    peakW: Math.round(huidig.peakW / 10) * 10,
  };
}

/* ------------------------------------------------------------ verdelen */

export interface Verdeling {
  /** `JJJJ-MM-DD`, lokale tijd. */
  readonly datum: string;
  readonly letters: readonly string[];
  /** Per kwartier: het uur (lokaal, 9.25 is kwart over negen) en per letter de W. */
  readonly punten: readonly (readonly number[])[];
}

/**
 * Wat één meter mat op de laatste hele dag, verdeeld over zijn vlakken naar
 * wat elk vlak bij heldere lucht zou leveren. Null zonder zo'n dag.
 */
export function verdeelDag(rows: readonly PowerRow[], vlakken: readonly DakVlak[], location: Location, timeZone: string, nuMs: number): Verdeling | null {
  if (!vlakken.length) return null;
  const dagVan = (ms: number) => {
    const d = partsIn(ms, timeZone);
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  };
  const vandaag = dagVan(nuMs);
  const dagen = [...new Set(rows.map((r) => dagVan(r.startMs)))].filter((d) => d < vandaag).sort();
  const datum = dagen.at(-1);
  if (!datum) return null;
  const opDag = rows.filter((r) => dagVan(r.startMs) === datum && Number.isFinite(r.meanW));
  const model = vlakken.map((v) => modelVan([v], [{ azimuthDeg: v.azimuthDeg, tiltDeg: v.tiltDeg }]));
  const gewicht = vlakken.map((v) => piekVan(v));
  const kwartieren = new Map<number, { som: number[]; n: number }>();
  for (const r of opDag) {
    const t = r.startMs + 150_000;
    const sun = sunPosition(t, location.latDeg, location.lonDeg);
    const helder = model.map((m, i) => m(sun) * gewicht[i]!);
    const totaal = helder.reduce((s, x) => s + x, 0);
    const delen = totaal > 0 ? helder.map((x) => x / totaal) : vlakken.map(() => 1 / vlakken.length);
    const d = partsIn(r.startMs, timeZone);
    const q = d.h * 4 + Math.floor(d.mi / 15);
    const k = kwartieren.get(q) ?? { som: vlakken.map(() => 0), n: 0 };
    delen.forEach((x, i) => (k.som[i]! += Math.max(0, r.meanW) * x));
    k.n += 1;
    kwartieren.set(q, k);
  }
  const punten = [...kwartieren]
    .sort((a, b) => a[0] - b[0])
    .map(([q, k]) => [q / 4, ...k.som.map((s) => Math.round(s / k.n))])
    .filter((p) => p.slice(1).some((w) => w > 15));
  return punten.length ? { datum, letters: vlakken.map((v) => v.letter), punten } : null;
}

/**
 * De daken met de meting erin (gemeten volgt vanzelf): een vlak dat gemeten
 * of geschat is, neemt de richting en de helling van de meting over; wat de
 * bewoner zelf instelde, blijft staan (daar staat de meting als voorstel bij).
 */
export function metMeting(d: Daken, gemeten: Readonly<Record<string, VlakStand>>): Daken {
  if (!Object.keys(gemeten).length) return d;
  return {
    ...d,
    vlakken: d.vlakken.map((v) => {
      const m = gemeten[v.letter];
      return m && v.bron !== 'bewoner' ? { ...v, azimuthDeg: m.azimuthDeg, tiltDeg: m.tiltDeg, bron: 'gemeten' as const } : v;
    }),
  };
}

/* ------------------------------------------------------------ per vlak (stap 5) */

/** Een meter met zijn vlakken (zoals de berekening ze kent) en zijn opbrengst. */
export interface MeterGroep {
  /** De sensor, of '' voor alle omvormers samen. */
  readonly id: string;
  readonly vlakken: readonly DakVlak[];
  readonly rows: readonly PowerRow[];
  readonly grensW: number | null;
}

/** Per vlak zijn deel van wat de meter nu meet, naar de heldere lucht per vlak. */
function delenNu(vlakken: readonly DakVlak[], sun: SunPosition): number[] {
  const helder = vlakken.map((v) => modelVan([v], [{ azimuthDeg: v.azimuthDeg, tiltDeg: v.tiltDeg }])(sun) * piekVan(v));
  const som = helder.reduce((s, x) => s + x, 0);
  return som > 0 ? helder.map((x) => x / som) : vlakken.map(() => 1 / vlakken.length);
}

/**
 * Wat elk vlak nu levert (stap 5): wat zijn meter meet, verdeeld naar de
 * heldere lucht per vlak; en wat het bij heldere lucht zou leveren, met het
 * rendement van een gewone dag (85%). Null als de meter niets zegt.
 */
export function nuPerVlak(groepen: readonly { readonly vlakken: readonly DakVlak[]; readonly meterW: number | null }[], sun: SunPosition): Record<string, { readonly w: number | null; readonly helderW: number }> {
  const uit: Record<string, { w: number | null; helderW: number }> = {};
  for (const g of groepen) {
    const delen = delenNu(g.vlakken, sun);
    g.vlakken.forEach((v, i) => {
      const helderW = Math.round((modelVan([v], [{ azimuthDeg: v.azimuthDeg, tiltDeg: v.tiltDeg }])(sun) / 1000) * piekVan(v) * 0.85);
      uit[v.letter] = { w: g.meterW == null ? null : Math.round(Math.max(0, g.meterW) * delen[i]!), helderW: Math.max(0, helderW) };
    });
  }
  return uit;
}

/**
 * De uren zonder vermogen van de omvormer, aangevuld uit de zonnemeter in kWh
 * per uur: het vermogen staat er vaak pas sinds de omvormer
 * gekoppeld is, de zonnemeter al veel langer.
 */
export function aanvullenUitMeter(rows: readonly PowerRow[], kwhPerUur: ReadonlyMap<number, number>): PowerRow[] {
  const er = new Set(rows.map((r) => r.startMs));
  const erbij = [...kwhPerUur].filter(([t, kwh]) => !er.has(t) && kwh > 0).map(([t, kwh]) => ({ startMs: t, meanW: kwh * 1000 }));
  return [...rows, ...erbij].sort((a, b) => a.startMs - b.startMs);
}

/**
 * De opbrengst per vlak over een periode (stap 5): per uur wat de meter
 * gemiddeld mat, verdeeld naar de heldere lucht per vlak, opgeteld in kWh.
 */
export function opbrengstPerVlak(groepen: readonly { readonly vlakken: readonly DakVlak[]; readonly rows: readonly PowerRow[] }[], location: Location, uurMs = 3_600_000): Record<string, number> {
  const uit: Record<string, number> = {};
  for (const g of groepen) {
    for (const v of g.vlakken) uit[v.letter] = 0;
    for (const r of g.rows) {
      if (!Number.isFinite(r.meanW) || r.meanW <= 0) continue;
      const sun = sunPosition(r.startMs + uurMs / 2, location.latDeg, location.lonDeg);
      const delen = delenNu(g.vlakken, sun);
      g.vlakken.forEach((v, i) => (uit[v.letter]! += (r.meanW * delen[i]! * uurMs) / 3_600_000 / 1000));
    }
  }
  return Object.fromEntries(Object.entries(uit).map(([l, k]) => [l, Math.round(k * 10) / 10]));
}

export type Wanneer = 'ochtend' | 'middag' | 'avond' | 'dag';

/** Een vlak dat achterblijft (stap 5), met wanneer en hoeveel. */
export interface Achter {
  /** Het vlak, of null als het niet aan één vlak ligt. */
  readonly letter: string | null;
  /** De meter waar het om gaat ('' is alle omvormers samen). */
  readonly meter: string;
  readonly wanneer: Wanneer;
  /** Hoeveel minder, in procent. */
  readonly minderPct: number;
  /**
   * `true`: vergeleken met een vlak met een eigen meter, per paneel. `false`:
   * één meter; SunArc ziet alleen wanneer het hele dak minder geeft, en noemt
   * het vlak dat dan de zon heeft ("waarschijnlijk").
   */
  readonly eigenMeter: boolean;
  /** Het vlak waarmee het vergeleken is, bij eigen meters. */
  readonly vergelijk: string | null;
  /** Op hoeveel verschillende zonnige dagen het te zien was. */
  readonly dagen: number;
  /** De bovenkant van die meter per tijdstip: het uur, gemeten en verwacht, in W. */
  readonly lijn: readonly (readonly [number, number, number])[];
}

const WINDOW: Record<Exclude<Wanneer, 'dag'>, (az: number) => boolean> = {
  ochtend: (az) => az < 140,
  middag: (az) => az >= 140 && az <= 220,
  avond: (az) => az > 220,
};
const mediaan = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : NaN;
};

/** Per meter: hoe hij tegen zijn vlakken afsteekt, en of een deel van de dag achterblijft. */
function meterOordeel(g: MeterGroep, location: Location, timeZone: string) {
  const boven = bovenkant(g.rows, location, g.grensW);
  if (!boven || !g.vlakken.length) return null;
  const stand = g.vlakken.map((v) => ({ azimuthDeg: v.azimuthDeg, tiltDeg: v.tiltDeg }));
  const model = modelVan(g.vlakken, stand);
  const r = beoordeel(boven.punten, model, 0, Infinity);
  if (!r) return null;
  const piek = g.vlakken.reduce((s, v) => s + piekVan(v), 0);
  const pts = boven.punten.map((p) => ({ p, m: model(p.sun) }));
  const mmax = Math.max(...pts.map((x) => x.m));
  const goed = pts.filter((x) => x.m >= 0.25 * mmax && x.p.sun.elevationDeg > 10).map((x) => ({ ...x, q: x.p.w / ((x.m * r.peakW) / 1000) }));
  const uurVan = (t: number) => {
    const d = partsIn(t, timeZone);
    return d.h + d.mi / 60;
  };
  const dagVan = (t: number) => {
    const d = partsIn(t, timeZone);
    return `${d.y}-${d.m}-${d.d}`;
  };
  const per = (Object.keys(WINDOW) as Exclude<Wanneer, 'dag'>[]).map((w) => {
    const in_ = goed.filter((x) => WINDOW[w](x.p.sun.azimuthDeg));
    return { w, in_, med: in_.length >= 6 ? mediaan(in_.map((x) => x.q)) : NaN };
  });
  const ref = Math.max(...per.map((x) => x.med).filter(Number.isFinite));
  let tekort: { w: Exclude<Wanneer, 'dag'>; pct: number; dagen: number; letter: string | null } | null = null;
  for (const x of per) {
    if (!Number.isFinite(x.med) || !(x.med < 0.75 * ref)) continue;
    const pct = Math.round((1 - x.med / ref) * 100);
    if (tekort && pct <= tekort.pct) continue;
    // Het vlak dat in dat deel van de dag de meeste zon heeft.
    const aandeel = g.vlakken.map((_v, i) => x.in_.reduce((s, y) => s + delenNu(g.vlakken, y.p.sun)[i]!, 0));
    const beste = aandeel.indexOf(Math.max(...aandeel));
    // Op hoeveel zonnige dagen: dagen waarop het beste deel van de dag helder was en dit deel achterbleef.
    const refW = per.find((y) => y.med === ref)!.w;
    const perDag = new Map<string, { win: number[]; ref: number[] }>();
    for (const row of g.rows) {
      if (!(row.meanW > 0)) continue;
      const sun = sunPosition(row.startMs + 150_000, location.latDeg, location.lonDeg);
      const m = model(sun);
      if (m < 0.25 * mmax || sun.elevationDeg <= 10) continue;
      const q = row.meanW / ((m * r.peakW) / 1000);
      const dag = perDag.get(dagVan(row.startMs)) ?? { win: [], ref: [] };
      if (WINDOW[x.w](sun.azimuthDeg)) dag.win.push(q);
      else if (WINDOW[refW](sun.azimuthDeg)) dag.ref.push(q);
      perDag.set(dagVan(row.startMs), dag);
    }
    const dagen = [...perDag.values()].filter((d) => d.win.length >= 3 && d.ref.length >= 3 && mediaan(d.ref) >= 0.8 * ref && mediaan(d.win) < 0.8 * mediaan(d.ref)).length;
    tekort = { w: x.w, pct, dagen, letter: g.vlakken.length === 1 ? g.vlakken[0]!.letter : (g.vlakken[beste]?.letter ?? null) };
  }
  const lijn = [...boven.punten]
    .map((p): [number, number, number] => [Math.round(uurVan(p.t) * 100) / 100, Math.round(p.w), Math.round((model(p.sun) * r.peakW) / 1000)])
    .sort((a, b) => a[0] - b[0]);
  return { ratio: r.peakW / Math.max(1, piek), tekort, lijn };
}

/**
 * Blijft er een vlak achter (stap 5)? Met een eigen meter per vlak: per paneel
 * vergeleken met het beste (18% minder of meer telt). Met één meter: blijft het
 * dak in een deel van de dag op zonnige dagen een kwart of meer achter bij de
 * rest van de dag, dan het vlak dat dan de zon heeft. Null als alles klopt.
 */
export function achterblijven(groepen: readonly MeterGroep[], location: Location, timeZone: string): Achter | null {
  const oordelen = groepen.map((g) => ({ g, o: meterOordeel(g, location, timeZone) })).filter((x): x is { g: MeterGroep; o: NonNullable<ReturnType<typeof meterOordeel>> } => x.o != null);
  if (oordelen.length >= 2) {
    const beste = oordelen.reduce((a, b) => (b.o.ratio > a.o.ratio ? b : a));
    const slechtste = oordelen.reduce((a, b) => (b.o.ratio < a.o.ratio ? b : a));
    if (slechtste !== beste && slechtste.o.ratio < 0.82 * beste.o.ratio) {
      return {
        letter: slechtste.g.vlakken.length === 1 ? slechtste.g.vlakken[0]!.letter : (slechtste.o.tekort?.letter ?? null),
        meter: slechtste.g.id,
        wanneer: slechtste.o.tekort?.w ?? 'dag',
        minderPct: Math.round((1 - slechtste.o.ratio / beste.o.ratio) * 100),
        eigenMeter: true,
        vergelijk: beste.g.vlakken.length === 1 ? beste.g.vlakken[0]!.letter : null,
        dagen: slechtste.o.tekort?.dagen ?? 0,
        lijn: slechtste.o.lijn,
      };
    }
  }
  const metTekort = oordelen.filter((x) => x.o.tekort).sort((a, b) => b.o.tekort!.pct - a.o.tekort!.pct)[0];
  if (!metTekort) return null;
  const t = metTekort.o.tekort!;
  return { letter: t.letter, meter: metTekort.g.id, wanneer: t.w, minderPct: t.pct, eigenMeter: false, vergelijk: null, dagen: t.dagen, lijn: metTekort.o.lijn };
}
