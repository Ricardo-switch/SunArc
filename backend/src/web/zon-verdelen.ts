/**
 * De zon verdelen (besluit 343, issue 137): één lijst voor wie de zon krijgt die over is, kamers, apparaten op zon,
 * boiler, jacuzzi, stekkers en de laadpaal, in de volgorde die de bewoner sleept. Per plek het vermogen (gemeten of
 * opgegeven) en wat hij nu krijgt. De volgorde staat in comfort.json (voorrang.zon); de regeling krijgt daaruit wat
 * ze kent (de laadpaal nog niet). De marge en wat de bewoner met de hand kiest (nu eerst, vandaag overslaan, uit de
 * lijst) staan in zonverdelen.json; de regeling gebruikt ze pas als SunArc zelf regelt. Tot dan laat dit zien wat het
 * zou doen.
 */
import { readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { DecisionView } from './assistant-types.js';
import type { SiteConfig } from '../core/model.js';
import type { ZonPlek } from './comfort.js';

export const ZONVERDELEN_FILE = 'zonverdelen.json';
/** Wat de laadpaal minstens vraagt: 6 A op één fase. */
export const LAADPAAL_MIN_W = 1380;

export interface ZonMarge {
  /** Zoveel moet er meer over zijn dan een apparaat vraagt, in W. */
  readonly extraW: number;
  /** Minstens zo lang aan en uit, in minuten. */
  readonly minuten: number;
}
export type ZonHand = { readonly soort: 'eerst'; readonly totMs: number | null } | { readonly soort: 'overslaan'; readonly datum: string };
export interface ZonKeuzes {
  readonly versie: 1;
  readonly marge: ZonMarge;
  /** Per plek (soort:id) wat de bewoner met de hand koos. */
  readonly hand: Readonly<Record<string, ZonHand>>;
  /** Plekken die niet meedoen (soort:id). */
  readonly uit: readonly string[];
}
export const STANDAARD_KEUZES: ZonKeuzes = { versie: 1, marge: { extraW: 200, minuten: 10 }, hand: {}, uit: [] };
export const MARGE_BEREIK = { extraW: { min: 0, max: 2000, stap: 50 }, minuten: { min: 0, max: 60, stap: 5 } } as const;

export type ZonSoort = 'kamer' | 'apparaat' | 'buffer' | 'laadpaal';
export interface ZonAuto {
  readonly id: string;
  /** De naam van de laadpaal, anders die van de auto. */
  readonly naam: string;
  /** Of de auto aan een laadpaal hangt die SunArc kent. */
  readonly laadpaal: boolean;
  /** Wat de laadpaal minstens vraagt, in W, als hij zijn laagste stroom kent. */
  readonly minW: number | null;
  readonly aangesloten: boolean | null;
  readonly laadt: boolean | null;
  readonly vermogenW: number | null;
}
export interface ZonItem {
  readonly sleutel: string;
  readonly soort: ZonSoort;
  readonly id: string;
  readonly naam: string;
  readonly icoon: string;
  readonly vermogenW: number | null;
  readonly bron: 'gemeten' | 'opgegeven' | null;
  /** Wat hij nu krijgt, in W. */
  readonly krijgtW: number;
  /** `draait`: aangezet door iemand anders dan de zon; `net`: gaat aan van het net (uiterlijke start, ondergrens). */
  readonly stand: 'zon' | 'laadt' | 'draait' | 'net' | 'wacht' | 'klaar' | 'rust' | 'overgeslagen';
  /** Bij wacht: hoeveel er nog te weinig over is, in W. */
  readonly tekortW: number | null;
  readonly eerst: { readonly totMs: number | null } | null;
}
export interface ZonVerdelenView {
  /** Wat er nu te verdelen is, in W; null zonder besluit. */
  readonly overW: number | null;
  readonly restW: number | null;
  readonly lijst: readonly ZonItem[];
  readonly uit: readonly ZonItem[];
  readonly marge: ZonMarge;
  readonly bereik: typeof MARGE_BEREIK;
}

export const sleutelVan = (p: { soort: string; id: string }): string => `${p.soort}:${p.id}`;

/** De volgorde: wat bewaard is, dan wat er nog bij hoort (eerst de kamers en apparaten zoals de regeling, dan de laadpalen). */
export function volgordeVan(bewaard: readonly ZonPlek[] | undefined, gewoon: readonly ZonPlek[], autos: readonly ZonAuto[]): ZonPlek[] {
  const laadpalen: ZonPlek[] = autos.filter((a) => a.laadpaal).map((a) => ({ soort: 'laadpaal', id: a.id }));
  const bestaat = new Set([...gewoon, ...laadpalen].map(sleutelVan));
  const uit: ZonPlek[] = [];
  for (const p of [...(bewaard ?? []), ...gewoon, ...laadpalen]) if (bestaat.has(sleutelVan(p)) && !uit.some((x) => sleutelVan(x) === sleutelVan(p))) uit.push(p);
  return uit;
}

export interface ZonBron {
  readonly config: SiteConfig;
  readonly snapshot: DecisionView | null;
  readonly volgorde: readonly ZonPlek[];
  readonly autos: readonly ZonAuto[];
  readonly keuzes: ZonKeuzes;
  /** Wat de meter (een entiteit) nu meet, in W, of null. */
  readonly gemeten: (entiteit: string) => number | null;
  readonly nowMs: number;
  readonly vandaag: string;
}

export function zonVerdelenView(b: ZonBron): ZonVerdelenView {
  const { config, snapshot, keuzes } = b;
  const e = snapshot?.explanation ?? null;
  const opZon = new Set((snapshot?.accepted ?? []).filter((i) => i.strategyId === 'pv-surplus').map((i) => i.actuatorId));
  const actuators = config.actuators;
  const stukken = b.volgorde.map((p): Omit<ZonItem, 'tekortW' | 'eerst'> & { wacht: boolean } | null => {
    const sleutel = sleutelVan(p);
    const over = keuzes.hand[sleutel]?.soort === 'overslaan' && (keuzes.hand[sleutel] as { datum: string }).datum === b.vandaag;
    const basis = { sleutel, soort: p.soort as ZonSoort, id: p.id };
    if (p.soort === 'kamer') {
      const z = config.zones.find((x) => x.id === p.id);
      if (!z) return null;
      const helpers = actuators.filter((a) => z.actuatorIds.includes(a.id) && (a.role === 'assist' || a.onSurplus));
      // Wat de meter zegt telt alleen als hij iets trekt: uit meet hij niets, en dan is het opgegeven vermogen beter.
      const meet = helpers.map((a) => {
        const w = a.power.sensor ? b.gemeten(a.power.sensor.id) : null;
        return w != null && w > 50 ? w : null;
      });
      const gemeten = meet.some((w) => w != null);
      const vermogen = helpers.reduce((s, a, i) => s + (meet[i] ?? a.power.estimatedW), 0) || null;
      const krijgt = helpers.filter((a) => opZon.has(a.id)).reduce((s, a, i) => s + (meet[i] ?? a.power.estimatedW), 0);
      const pz = e?.perZone.find((x) => x.zoneId === z.id);
      const stand = over ? 'overgeslagen' : krijgt > 0 ? 'zon' : pz?.demand === 'none' ? 'rust' : 'wacht';
      return { ...basis, naam: z.name, icoon: helpers.some((a) => a.capabilities.canCool) ? 'airco' : 'klimaat', vermogenW: vermogen, bron: vermogen == null ? null : gemeten ? 'gemeten' : 'opgegeven', krijgtW: krijgt, stand, wacht: stand === 'wacht' };
    }
    if (p.soort === 'apparaat') {
      const d = (config.deferrables ?? []).find((x) => x.id === p.id);
      if (!d) return null;
      const x = e?.deferrables?.find((y) => y.id === d.id);
      // Alleen een start op zon telt als zon; wat al draait, zette iemand anders aan.
      const zon = x?.state === 'would_start' && x.reason === 'surplus_available';
      const stand = over ? 'overgeslagen' : zon ? 'zon' : x?.state === 'running' ? 'draait' : x?.state === 'would_start' ? 'net' : x?.state === 'waiting' ? 'wacht' : 'rust';
      return { ...basis, naam: d.name, icoon: 'witgoed', vermogenW: d.estimatedW || null, bron: d.estimatedW ? 'opgegeven' : null, krijgtW: zon ? d.estimatedW : 0, stand, wacht: stand === 'wacht' };
    }
    if (p.soort === 'buffer') {
      const h = (config.heatStores ?? []).find((x) => x.id === p.id);
      if (!h) return null;
      const x = e?.heatStores?.find((y) => y.id === h.id);
      const gemeten = x?.powerW != null && x.powerW > 50 ? x.powerW : null;
      const vermogen = gemeten ?? (h.estimatedW || null);
      const zon = x?.state === 'would_heat' && x.reason === 'surplus_available';
      const stand = over ? 'overgeslagen' : zon ? 'zon' : x?.state === 'would_heat' ? 'net' : x?.state === 'full' ? 'klaar' : x?.state === 'waiting' ? 'wacht' : 'rust';
      return { ...basis, naam: h.name, icoon: h.kind === 'jacuzzi' ? 'jacuzzi' : h.kind === 'stekker' ? 'stekker' : 'boiler', vermogenW: vermogen, bron: vermogen == null ? null : gemeten != null ? 'gemeten' : 'opgegeven', krijgtW: zon ? (vermogen ?? 0) : 0, stand, wacht: stand === 'wacht' };
    }
    const a = b.autos.find((x) => x.id === p.id);
    if (!a || !a.laadpaal) return null;
    const laadt = a.laadt === true && (a.vermogenW ?? 0) > 50;
    const stand = over ? 'overgeslagen' : laadt ? 'laadt' : a.aangesloten === false ? 'rust' : 'wacht';
    return { ...basis, naam: a.naam, icoon: 'laadpaal', vermogenW: laadt ? a.vermogenW : (a.minW ?? LAADPAAL_MIN_W), bron: laadt ? 'gemeten' : 'opgegeven', krijgtW: laadt ? (a.vermogenW ?? 0) : 0, stand, wacht: stand === 'wacht' };
  });
  const alle = stukken.filter((x): x is NonNullable<typeof x> => x != null);
  // Nu eerst gaat bovenaan, in de volgorde van de lijst; een verlopen keuze telt niet meer.
  const eerstVan = (s: string) => {
    const h = keuzes.hand[s];
    return h?.soort === 'eerst' && (h.totMs == null || h.totMs > b.nowMs) ? { totMs: h.totMs } : null;
  };
  const uitSet = new Set(keuzes.uit);
  const mee = alle.filter((x) => !uitSet.has(x.sleutel));
  const geordend = [...mee.filter((x) => eerstVan(x.sleutel)), ...mee.filter((x) => !eerstVan(x.sleutel))];
  // Wat de laadpaal trekt, regelt SunArc (nog) niet: het zit niet in wat de regeling te verdelen heeft, dus erbij.
  const laden = geordend.reduce((s, x) => s + (x.stand === 'laadt' ? x.krijgtW : 0), 0);
  const overW = e ? Math.max(0, e.budget.availableW) + laden : null;
  const gegeven = geordend.reduce((s, x) => s + (x.stand === 'zon' || x.stand === 'laadt' ? x.krijgtW : 0), 0);
  const restW = overW == null ? null : Math.max(0, overW - gegeven);
  const af = ({ wacht, ...x }: (typeof alle)[number]): ZonItem => ({
    ...x,
    tekortW: wacht && restW != null && x.vermogenW != null ? Math.max(0, Math.round(x.vermogenW + keuzes.marge.extraW - restW)) : null,
    eerst: eerstVan(x.sleutel),
  });
  return { overW, restW, lijst: geordend.map(af), uit: alle.filter((x) => uitSet.has(x.sleutel)).map(af), marge: keuzes.marge, bereik: MARGE_BEREIK };
}

/* -------------------------------------------------------------- bewaren */

export type ZonBody = { readonly volgorde?: readonly ZonPlek[]; readonly marge?: ZonMarge; readonly hand?: Readonly<Record<string, ZonHand | null>>; readonly uit?: readonly string[] };

/** Leest wat de app stuurt; `bekend` zegt welke plekken er zijn. */
export function leesZonBody(body: unknown, bekend: ReadonlySet<string>): { ok: true; body: ZonBody } | { ok: false; reden: string } {
  if (typeof body !== 'object' || body == null) return { ok: false, reden: 'verwacht een object' };
  const b = body as Record<string, unknown>;
  const uit: { volgorde?: ZonPlek[]; marge?: ZonMarge; hand?: Record<string, ZonHand | null>; uit?: string[] } = {};
  if (b['volgorde'] !== undefined) {
    const v = b['volgorde'];
    const goed = Array.isArray(v) && v.every((p) => typeof p === 'object' && p != null && bekend.has(sleutelVan(p as ZonPlek))) && new Set((v as ZonPlek[]).map(sleutelVan)).size === v.length;
    if (!goed) return { ok: false, reden: 'de volgorde is een lijst van bekende plekken, elk één keer' };
    uit.volgorde = (v as ZonPlek[]).map((p) => ({ soort: p.soort, id: p.id }));
  }
  if (b['marge'] !== undefined) {
    const m = b['marge'] as Record<string, unknown>;
    const binnen = (x: unknown, r: { min: number; max: number }) => typeof x === 'number' && Number.isFinite(x) && x >= r.min && x <= r.max;
    if (!binnen(m?.['extraW'], MARGE_BEREIK.extraW) || !binnen(m?.['minuten'], MARGE_BEREIK.minuten)) return { ok: false, reden: 'de marge is 0 tot 2000 W en 0 tot 60 minuten' };
    uit.marge = { extraW: Math.round(m['extraW'] as number), minuten: Math.round(m['minuten'] as number) };
  }
  if (b['hand'] !== undefined) {
    const h = b['hand'] as Record<string, unknown>;
    if (typeof h !== 'object' || h == null) return { ok: false, reden: 'met de hand is per plek een keuze' };
    uit.hand = {};
    for (const [s, w] of Object.entries(h)) {
      if (!bekend.has(s)) return { ok: false, reden: `onbekende plek: ${s}` };
      const x = w as Record<string, unknown> | null;
      if (x == null) uit.hand[s] = null;
      else if (x['soort'] === 'eerst' && (x['totMs'] == null || typeof x['totMs'] === 'number')) uit.hand[s] = { soort: 'eerst', totMs: (x['totMs'] as number | null | undefined) ?? null };
      else if (x['soort'] === 'overslaan' && typeof x['datum'] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x['datum'])) uit.hand[s] = { soort: 'overslaan', datum: x['datum'] };
      else return { ok: false, reden: `met de hand bij ${s}: eerst of overslaan` };
    }
  }
  if (b['uit'] !== undefined) {
    const u = b['uit'];
    if (!Array.isArray(u) || !u.every((s) => typeof s === 'string' && bekend.has(s))) return { ok: false, reden: 'uit de lijst is een lijst van bekende plekken' };
    uit.uit = [...new Set(u as string[])];
  }
  return { ok: true, body: uit };
}

/** De keuzes naast de dataset, in zonverdelen.json. */
export class ZonVerdelenStore {
  readonly #pad: string;
  #huidig: ZonKeuzes = STANDAARD_KEUZES;
  constructor(logDir: string) {
    this.#pad = join(logDir, ZONVERDELEN_FILE);
  }
  get current(): ZonKeuzes {
    return this.#huidig;
  }
  async load(): Promise<void> {
    try {
      const raw = JSON.parse(await readFile(this.#pad, 'utf-8')) as Record<string, unknown>;
      if (raw['versie'] !== 1) return;
      const m = raw['marge'] as ZonMarge | undefined;
      this.#huidig = {
        versie: 1,
        marge: m && typeof m.extraW === 'number' && typeof m.minuten === 'number' ? { extraW: m.extraW, minuten: m.minuten } : STANDAARD_KEUZES.marge,
        hand: typeof raw['hand'] === 'object' && raw['hand'] != null ? (raw['hand'] as Record<string, ZonHand>) : {},
        uit: Array.isArray(raw['uit']) ? (raw['uit'] as unknown[]).filter((s): s is string => typeof s === 'string') : [],
      };
    } catch {
      // Nog niets bewaard: de standaard.
    }
  }
  async save(next: ZonKeuzes): Promise<void> {
    const tijdelijk = `${this.#pad}.tmp`;
    await writeFile(tijdelijk, `${JSON.stringify(next, null, 2)}\n`);
    await rename(tijdelijk, this.#pad);
    this.#huidig = next;
  }
  /** De keuzes met wat de app stuurt erover; een hand-keuze van null haalt hem weg. */
  met(body: ZonBody): ZonKeuzes {
    const hand: Record<string, ZonHand> = { ...this.#huidig.hand };
    for (const [s, w] of Object.entries(body.hand ?? {})) {
      if (w == null) delete hand[s];
      else hand[s] = w;
    }
    return { versie: 1, marge: body.marge ?? this.#huidig.marge, hand, uit: body.uit ?? this.#huidig.uit };
  }
}
