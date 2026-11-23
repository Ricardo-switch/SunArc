/**
 * Sluipverbruik (besluit 192): wat het huis 's nachts gebruikt als er niets
 * draait. Per nacht het laagste uurgemiddelde van het net tussen 01:00 en
 * 05:00, uit de uurstatistiek van Home Assistant; die gaat terug tot de eerste
 * dag van de slimme meter. Je gewone nacht is het gemiddelde van de vijf
 * laagste van de laatste 30 nachten; een nacht 50 W of meer daarboven valt op.
 *
 * Zonder eigen meter per apparaat noemt de app geen oorzaak (besluit 88): wat
 * de bewoner zelf zegt, bewaart de app per nacht (besluit 335). Een nieuwe hoge
 * nacht met ongeveer hetzelfde extra als nachten waar hij iets zei, krijgt dat
 * als vraag ("Weer de pc?"), en daarvoor komt geen melding.
 *
 * Alleen lezen uit Home Assistant. Het rekenen is zuiver en te toetsen; de
 * klasse haalt de statistiek en onthoudt wat ze al heeft.
 */

import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { SiteConfig } from '../core/model.js';

/** Zoveel watt boven je gewone nacht valt een nacht op (gekozen 24 oktober 2026). */
export const GRENS_W = 50;
/** Het venster van de nacht, in uren van de plaatselijke klok: van 01:00 tot 05:00. */
export const VAN_UUR = 1;
export const TOT_UUR = 5;
/** Over zoveel nachten telt je gewone nacht, en de laagste zoveel daarvan. */
export const VENSTER_NACHTEN = 30;
export const LAAGSTE = 5;
/** Zoveel van de laatste 30 nachten vallen op, niet per se op rij, voor "vaak meer dan gewoon" (29 oktober 2026). */
export const VAAK_NACHTEN = 8;
/**
 * Bij een contract met dag en nacht: zoveel van de uren valt in het daltarief
 * (doordeweeks 23:00–07:00, het weekend helemaal), om een jaar te rekenen.
 */
export const DAL_DEEL = 88 / 168;

export interface Nacht {
  /** De dag waarop de nacht eindigt, als `JJJJ-MM-DD`. */
  readonly dag: string;
  readonly w: number;
}

export interface SluipRapport {
  /** De laatste hele nacht. */
  readonly vannacht: Nacht;
  /** Het gemiddelde van de vijf laagste van de laatste 30 nachten. */
  readonly gewoonW: number;
  readonly bovenW: number;
  readonly hoog: boolean;
  readonly gemiddeldW: number;
  /** Dezelfde maand een jaar eerder, gemiddeld; null als die er niet is. */
  readonly vorigJaar: { readonly maand: string; readonly w: number } | null;
  /** Zoveel kWh in een jaar, als elke nacht was als vannacht. */
  readonly perJaarKwh: number;
  readonly perJaarEuro: number | null;
  /** Wat het per jaar scheelt als het weer je gewone nacht wordt; alleen bij een hoge nacht. */
  readonly scheelt: { readonly kwh: number; readonly euro: number | null } | null;
  /** De prijs per kWh waarmee gerekend is, of null zonder prijs. */
  readonly prijs: number | null;
  /**
   * Alle nachten, de oudste eerst, met of ze opvielen, wat de bewoner over die nacht zei (besluit 335), en bij een
   * hoge nacht zonder antwoord wat het lijkt te zijn: dezelfde reden als nachten met ongeveer hetzelfde extra.
   */
  readonly nachten: readonly (Nacht & { readonly hoog: boolean; readonly reden?: SluipReden; readonly herkend?: SluipHerkend })[];
  /** Per maand het gemiddelde per nacht, de oudste eerst. */
  readonly maanden: readonly { readonly maand: string; readonly w: number; readonly hoog: boolean }[];
  readonly laagste: Nacht;
  /** De reeks hoge nachten tot en met vannacht; null als vannacht gewoon was. */
  readonly reeks: { readonly sinds: string; readonly nachten: number } | null;
  /** Zoveel van de laatste 30 nachten vielen op. */
  readonly hoogIn30: number;
  /**
   * Vaak meer dan gewoon (29 oktober 2026): een op de vier van de laatste 30
   * nachten valt op, niet per se op rij. Met hoeveel watt die nachten erboven
   * liggen, en sinds wanneer; null als dat niet zo is.
   */
  readonly vaak: { readonly nachten: number; readonly meerW: number; readonly sinds: string } | null;
  /** Wat de bewoner eerder zei, het vaakst eerst: knoppen om een nacht met één tik te benoemen (besluit 335). */
  readonly antwoorden: readonly string[];
  /** Van de hoge nachten in de laatste 30: per reden hoeveel, het vaakst eerst. */
  readonly redenen: readonly { readonly tekst: string; readonly nachten: number }[];
  /** Zoveel hoge nachten in de laatste 30 hebben nog geen reden en lijken ook nergens op. */
  readonly zonderReden: number;
}

/** Wat de bewoner over één nacht zei (besluit 335): wat er draaide, of dat hij het niet weet. */
export interface SluipReden {
  readonly tekst: string | null;
  readonly weetNiet: boolean;
}
/** Wat een hoge nacht lijkt te zijn: de reden van nachten met ongeveer hetzelfde extra, en dat extra. */
export interface SluipHerkend {
  readonly tekst: string;
  readonly meerW: number;
}
/** Alles wat de bewoner zei, per nacht; `oud` is het antwoord bij het patroon van voor besluit 335, nu een voorstel. */
export interface SluipRedenen {
  readonly nachten: Readonly<Record<string, SluipReden>>;
  readonly oud: string | null;
}
/** Zoveel watt (of een kwart van het extra, als dat meer is) mag een nacht afwijken om op een reden te lijken. */
export const HERKEN_W = 30;

type Rij = { readonly start: number | string; readonly mean?: number | null };

/** Een moment in de plaatselijke klok: de dag en het uur. */
function plaatselijk(ms: number, timeZone: string): { dag: string; uur: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return { dag: `${p['year']}-${p['month']}-${p['day']}`, uur: Number(p['hour']) };
}

/**
 * Per nacht het laagste uurgemiddelde tussen 01:00 en 05:00. Alleen een hele
 * nacht: vandaag telt pas na 05:00, en een nacht met minder dan twee uren of
 * een negatief uur (stroom terug naar het net, zoals met een batterij) niet.
 */
export function nachtenUit(rijen: readonly Rij[], timeZone: string, nuMs: number): Nacht[] {
  const nu = plaatselijk(nuMs, timeZone);
  const per = new Map<string, number[]>();
  for (const r of rijen) {
    if (typeof r.mean !== 'number' || !Number.isFinite(r.mean)) continue;
    const ms = typeof r.start === 'number' ? r.start : Date.parse(r.start);
    if (!Number.isFinite(ms)) continue;
    const { dag, uur } = plaatselijk(ms, timeZone);
    if (uur < VAN_UUR || uur >= TOT_UUR) continue;
    per.set(dag, [...(per.get(dag) ?? []), r.mean]);
  }
  const uit: Nacht[] = [];
  for (const [dag, w] of per) {
    if (dag > nu.dag || (dag === nu.dag && nu.uur < TOT_UUR)) continue;
    if (w.length < 2 || w.some((x) => x < 0)) continue;
    uit.push({ dag, w: Math.round(Math.min(...w)) });
  }
  return uit.sort((a, b) => a.dag.localeCompare(b.dag));
}

const gemiddeld = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const DAG_MS = 86_400_000;

/**
 * Vaak meer dan gewoon. Hier wisselde het huis sinds augustus 2026 tussen
 * 190 en 340 W, en zei de app "Vannacht gewoon": hij keek alleen naar een
 * reeks op rij. Sinds wanneer: de maanden terug zolang er een op de vier
 * nachten opviel; de lopende maand telt pas mee met een week erin.
 */
function vaakVan(nachten: readonly Nacht[], hoge: readonly Nacht[], gewoonW: number, isHoog: (w: number) => boolean): SluipRapport['vaak'] {
  if (hoge.length < VAAK_NACHTEN) return null;
  // De middelste hoge nacht: een enkele uitschieter (hier 1.237 W op 25 oktober) maakt het anders 50 W meer.
  const rij = hoge.map((x) => x.w).sort((x, y) => x - y);
  const midden = rij.length % 2 ? rij[(rij.length - 1) / 2]! : (rij[rij.length / 2 - 1]! + rij[rij.length / 2]!) / 2;
  const meerW = Math.round((midden - gewoonW) / 10) * 10;
  const perMaand = new Map<string, { hoog: number; alle: number }>();
  for (const n of nachten) {
    const m = perMaand.get(n.dag.slice(0, 7)) ?? { hoog: 0, alle: 0 };
    m.alle++;
    if (isHoog(n.w)) m.hoog++;
    perMaand.set(n.dag.slice(0, 7), m);
  }
  let sinds = hoge[0]!.dag;
  const lijst = [...perMaand].reverse();
  for (const [i, [maand, m]] of lijst.entries()) {
    if (i === 0 && m.alle < 7) continue;
    if (m.hoog * 4 < m.alle) break;
    sinds = `${maand}-01`;
  }
  return { nachten: hoge.length, meerW, sinds };
}

const midden = (xs: readonly number[]): number => {
  const r = [...xs].sort((a, b) => a - b);
  return r.length % 2 ? r[(r.length - 1) / 2]! : (r[r.length / 2 - 1]! + r[r.length / 2]!) / 2;
};

/**
 * Per reden het gewone extra van zijn nachten (de middelste), en zo nodig het oude antwoord bij het patroon met het
 * extra van dat patroon. Een tekst telt zonder hoofdletters: "Pc" en "pc" zijn dezelfde.
 */
function handtekeningen(nachten: readonly Nacht[], redenen: SluipRedenen, gewoonW: number, vaak: SluipRapport['vaak']): SluipHerkend[] {
  const per = new Map<string, { tekst: string; extra: number[] }>();
  for (const n of nachten) {
    const tekst = redenen.nachten[n.dag]?.tekst;
    if (!tekst || n.w - gewoonW < GRENS_W) continue;
    const sl = tekst.toLowerCase();
    const r = per.get(sl) ?? { tekst, extra: [] };
    r.extra.push(n.w - gewoonW);
    per.set(sl, r);
  }
  const uit = [...per.values()].map((r) => ({ tekst: r.tekst, meerW: Math.round(midden(r.extra)) }));
  if (redenen.oud && vaak && !per.has(redenen.oud.toLowerCase())) uit.push({ tekst: redenen.oud, meerW: vaak.meerW });
  return uit;
}

/** Waar een hoge nacht op lijkt: de reden met het dichtstbijzijnde extra, binnen 30 W of een kwart; anders null. */
function herken(extra: number, lijst: readonly SluipHerkend[]): SluipHerkend | null {
  let beste: SluipHerkend | null = null;
  for (const h of lijst) {
    const af = Math.abs(extra - h.meerW);
    if (af > Math.max(HERKEN_W, h.meerW * 0.25)) continue;
    if (!beste || af < Math.abs(extra - beste.meerW)) beste = h;
  }
  return beste;
}

/** Het verslag bij de nachten, of null met minder dan een week. */
export function sluipRapport(nachten: readonly Nacht[], prijs: number | null, redenen: SluipRedenen = { nachten: {}, oud: null }): SluipRapport | null {
  if (nachten.length < 7) return null;
  const laatste30 = nachten.slice(-VENSTER_NACHTEN);
  const gewoonW = Math.round(gemiddeld([...laatste30].map((n) => n.w).sort((a, b) => a - b).slice(0, LAAGSTE)));
  const isHoog = (w: number) => w >= gewoonW + GRENS_W;
  const vannacht = nachten[nachten.length - 1]!;
  const bovenW = vannacht.w - gewoonW;
  const hoog = isHoog(vannacht.w);
  const maandMap = new Map<string, number[]>();
  for (const n of nachten) maandMap.set(n.dag.slice(0, 7), [...(maandMap.get(n.dag.slice(0, 7)) ?? []), n.w]);
  const maanden = [...maandMap].map(([maand, w]) => {
    const g = Math.round(gemiddeld(w));
    return { maand, w: g, hoog: isHoog(g) };
  });
  const maandNu = vannacht.dag.slice(0, 7);
  const vorigeMaand = `${Number(maandNu.slice(0, 4)) - 1}${maandNu.slice(4)}`;
  const vorig = maanden.find((m) => m.maand === vorigeMaand);
  let sinds: string | null = null;
  let n = 0;
  for (let i = nachten.length - 1; i >= 0 && isHoog(nachten[i]!.w); i--) {
    sinds = nachten[i]!.dag;
    n++;
  }
  const reeks = sinds ? { sinds, nachten: n } : null;
  const hogeIn30 = laatste30.filter((x) => isHoog(x.w));
  const vaak = vaakVan(nachten, hogeIn30, gewoonW, isHoog);
  const kwh = (w: number) => Math.round((w * 8760) / 1000);
  const euro = (k: number) => (prijs == null ? null : Math.round(k * prijs));
  const perJaarKwh = kwh(vannacht.w);
  // Per nacht wat de bewoner zei, en bij een hoge nacht zonder antwoord waar hij op lijkt (besluit 335).
  const lijst = handtekeningen(nachten, redenen, gewoonW, vaak);
  const metReden = nachten.map((x) => {
    const reden = redenen.nachten[x.dag];
    const hoogN = isHoog(x.w);
    const herkend = !reden && hoogN ? herken(x.w - gewoonW, lijst) : null;
    return { ...x, hoog: hoogN, ...(reden ? { reden } : {}), ...(herkend ? { herkend } : {}) };
  });
  const laatsteMet = metReden.slice(-VENSTER_NACHTEN).filter((x) => x.hoog);
  const telling = new Map<string, { tekst: string; nachten: number }>();
  for (const x of laatsteMet) {
    if (!x.reden?.tekst) continue;
    const sl = x.reden.tekst.toLowerCase();
    telling.set(sl, { tekst: telling.get(sl)?.tekst ?? x.reden.tekst, nachten: (telling.get(sl)?.nachten ?? 0) + 1 });
  }
  const alle = new Map<string, { tekst: string; n: number }>();
  for (const r of Object.values(redenen.nachten)) {
    if (!r.tekst) continue;
    const sl = r.tekst.toLowerCase();
    alle.set(sl, { tekst: alle.get(sl)?.tekst ?? r.tekst, n: (alle.get(sl)?.n ?? 0) + 1 });
  }
  if (redenen.oud && !alle.has(redenen.oud.toLowerCase())) alle.set(redenen.oud.toLowerCase(), { tekst: redenen.oud, n: 0 });
  return {
    vannacht,
    gewoonW,
    bovenW,
    hoog,
    gemiddeldW: Math.round(gemiddeld(laatste30.map((x) => x.w))),
    vorigJaar: vorig ? { maand: vorig.maand, w: vorig.w } : null,
    perJaarKwh,
    perJaarEuro: euro(perJaarKwh),
    scheelt: hoog ? { kwh: kwh(bovenW), euro: euro(kwh(bovenW)) } : null,
    prijs,
    nachten: metReden,
    maanden,
    laagste: nachten.reduce((a, b) => (b.w < a.w ? b : a)),
    reeks,
    hoogIn30: hogeIn30.length,
    vaak,
    antwoorden: [...alle.values()].sort((a, b) => b.n - a.n).slice(0, 6).map((x) => x.tekst),
    redenen: [...telling.values()].sort((a, b) => b.nachten - a.nachten),
    zonderReden: laatsteMet.filter((x) => !x.reden && !x.herkend).length,
  };
}

/** De prijs per kWh voor een heel jaar: het daltarief voor zijn deel van de uren, als het er is. */
export function jaarPrijs(prijzen: { readonly stroom: number | null; readonly stroomDal?: number | null } | null | undefined): number | null {
  const p = prijzen?.stroom ?? null;
  if (p == null) return null;
  const dal = prijzen?.stroomDal ?? null;
  return dal == null ? p : p * (1 - DAL_DEEL) + dal * DAL_DEEL;
}

export const SLUIP_FILE = 'sluipverbruik.json';
export const MAX_TOELICHTING = 80;

/** Wat de bewoner over een nacht stuurt (besluit 335): `{ dag, tekst }`, `{ dag, weetNiet: true }` of `{ dag, wis: true }`. */
export function leesReden(x: unknown): { ok: true; dag: string; reden: SluipReden | null } | { ok: false; reden: string } {
  if (typeof x !== 'object' || x == null) return { ok: false, reden: 'geef dag, en tekst, weetNiet of wis' };
  const r = x as Record<string, unknown>;
  if (typeof r['dag'] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r['dag'])) return { ok: false, reden: 'dag is een dag als 2026-10-15' };
  if (r['wis'] === true) return { ok: true, dag: r['dag'], reden: null };
  const tekst = r['tekst'] == null ? null : typeof r['tekst'] === 'string' ? r['tekst'].trim().slice(0, MAX_TOELICHTING) : undefined;
  if (tekst === undefined) return { ok: false, reden: 'tekst is een korte zin' };
  if (r['weetNiet'] !== undefined && typeof r['weetNiet'] !== 'boolean') return { ok: false, reden: 'weetNiet is ja of nee' };
  const weetNiet = r['weetNiet'] === true;
  if (!tekst && !weetNiet) return { ok: false, reden: 'geef tekst, weetNiet of wis' };
  return { ok: true, dag: r['dag'], reden: { tekst: tekst || null, weetNiet: weetNiet && !tekst } };
}

/** Wat er bewaard staat: versie 2 per nacht; versie 1 (één antwoord bij een reeks of het patroon) wordt het voorstel. */
export function leesRedenen(raw: unknown): SluipRedenen {
  const r = (typeof raw === 'object' && raw != null ? raw : {}) as Record<string, unknown>;
  const nachten: Record<string, SluipReden> = {};
  if (typeof r['nachten'] === 'object' && r['nachten'] != null) {
    for (const [dag, v] of Object.entries(r['nachten'] as Record<string, unknown>)) {
      const l = leesReden({ ...(v as object), dag });
      if (l.ok && l.reden) nachten[dag] = l.reden;
    }
  }
  const oudV1 = (r['toelichting'] as { tekst?: unknown } | undefined)?.tekst;
  const oud = typeof r['oud'] === 'string' ? r['oud'] : typeof oudV1 === 'string' && oudV1.trim() ? oudV1.trim().slice(0, MAX_TOELICHTING) : null;
  return { nachten, oud };
}

export interface SluipOpties {
  readonly config: () => SiteConfig | null;
  /** Een vraag aan Home Assistant: hier `recorder/statistics_during_period`. */
  readonly vraag: (type: string, velden: Record<string, unknown>) => Promise<Record<string, Rij[]> | null>;
  /** De prijs per kWh, of null. */
  readonly prijs: () => number | null;
  /** Waar wat de bewoner zei staat; zonder logmap alleen in het geheugen. */
  readonly logDir?: string;
  readonly nu?: () => number;
}

/** Zo ver terug vraagt de eerste keer: genoeg voor de meter van de meeste huizen. */
const TERUG_MS = 3 * 365 * 86_400_000;
/** Zo vaak opnieuw kijken naar de laatste nachten. */
const OPNIEUW_MS = 30 * 60_000;

export class Sluipverbruik {
  readonly #o: SluipOpties;
  #nachten: Nacht[] = [];
  #gehaald = 0;
  #bezig: Promise<void> | null = null;
  #redenen: SluipRedenen = { nachten: {}, oud: null };

  constructor(o: SluipOpties) {
    this.#o = o;
  }

  async load(): Promise<void> {
    if (!this.#o.logDir) return;
    try {
      this.#redenen = leesRedenen(JSON.parse(await readFile(join(this.#o.logDir, SLUIP_FILE), 'utf-8')));
    } catch {
      this.#redenen = { nachten: {}, oud: null };
    }
  }

  /** De nachten bijwerken als het tijd is; de eerste keer alles, daarna de laatste dagen. */
  async #bij(): Promise<void> {
    const nu = (this.#o.nu ?? Date.now)();
    if (nu - this.#gehaald < OPNIEUW_MS) return;
    const config = this.#o.config();
    const grid = config?.power.gridPower;
    if (!config || !grid || ('attribute' in grid && grid.attribute)) return;
    const van = this.#nachten.length ? nu - 4 * 86_400_000 : nu - TERUG_MS;
    const raw = await this.#o.vraag('recorder/statistics_during_period', {
      start_time: new Date(van).toISOString(),
      end_time: new Date(nu).toISOString(),
      statistic_ids: [grid.id],
      period: 'hour',
      types: ['mean'],
      units: { power: 'W' },
    });
    if (raw == null) return;
    const nieuw = nachtenUit(raw[grid.id] ?? [], config.timezone, nu);
    const dagen = new Set(nieuw.map((n) => n.dag));
    this.#nachten = [...this.#nachten.filter((n) => !dagen.has(n.dag)), ...nieuw].sort((a, b) => a.dag.localeCompare(b.dag));
    this.#gehaald = nu;
  }

  /** Het verslag van nu; haalt eerst de nachten als het tijd is. */
  async rapport(): Promise<SluipRapport | null> {
    this.#bezig ??= this.#bij().finally(() => {
      this.#bezig = null;
    });
    await this.#bezig.catch(() => undefined);
    return this.laatste();
  }

  /** Het verslag met wat er al is, zonder te vragen; voor de bel en de assistent. */
  laatste(): SluipRapport | null {
    return sluipRapport(this.#nachten, this.#o.prijs(), this.#redenen);
  }

  /** Wat de bewoner over een nacht zei (besluit 335), of weg met null. */
  async zeg(dag: string, reden: SluipReden | null): Promise<void> {
    const nachten = { ...this.#redenen.nachten };
    if (reden) nachten[dag] = reden;
    else delete nachten[dag];
    this.#redenen = { nachten, oud: this.#redenen.oud };
    if (!this.#o.logDir) return;
    const pad = join(this.#o.logDir, SLUIP_FILE);
    await writeFile(`${pad}.nieuw`, `${JSON.stringify({ versie: 2, nachten, oud: this.#redenen.oud })}\n`, 'utf-8');
    await rename(`${pad}.nieuw`, pad);
  }
}

/**
 * Voor de bel (besluit 79): de hoge nacht die net voorbij is, of null. Alleen
 * als de laatste nacht van vandaag of gisteren is: tot de nieuwe nacht er is
 * (na 05:00) blijft de melding staan, en een oude nacht meldt niets meer.
 */
export function sluipVoorBel(r: SluipRapport | null, nuMs: number, timeZone: string): SluipBel | null {
  if (!r || !r.hoog || !r.reeks) return null;
  // Een nacht met een reden, of die lijkt op een reden die de bewoner al gaf: geen melding (besluit 335).
  const laatste = r.nachten.at(-1);
  if (laatste?.reden || laatste?.herkend) return null;
  const vandaag = plaatselijk(nuMs, timeZone).dag;
  const gisteren = plaatselijk(nuMs - 86_400_000, timeZone).dag;
  if (r.vannacht.dag !== vandaag && r.vannacht.dag !== gisteren) return null;
  return { dag: r.vannacht.dag, w: r.vannacht.w, gewoonW: r.gewoonW, bovenW: r.bovenW, nachten: r.reeks.nachten };
}
export interface SluipBel {
  readonly dag: string;
  readonly w: number;
  readonly gewoonW: number;
  readonly bovenW: number;
  /** Zoveel hoge nachten op rij, tot en met deze. */
  readonly nachten: number;
}
