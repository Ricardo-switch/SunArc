/**
 * Het advies bij de auto (besluit 259, stap 4; schetsen Wand-Auto en
 * Thuis-Tel-Auto-Advies). Het staat er alleen als het iets zegt.
 *
 * - **Zon.** Laadt de auto en is er meer zon over dan hij neemt, dan de
 *   hoogste stroom die nog op eigen zon past (`meer`). Komt er stroom van het
 *   net en past een lagere stroom wel op zon, dan die (`minder`). Zit de kabel
 *   erin zonder te laden en is er zon genoeg voor de laagste stroom, dan dat
 *   (`start`). Nooit boven wat de laadpaal kan (zonder opgave 6 tot 16 A), en
 *   nooit boven de ruimte op de zekering, per fase gemeten.
 * - **Goedkoop.** Alleen met een prijs per uur: het goedkoopste blok van de
 *   komende dag, zo lang als de auto nodig heeft tot zijn laadgrens (zonder
 *   accu drie uur), en alleen als het echt goedkoper is dan nu.
 *
 * SunArc stuurt hier niets: het advies zegt wat kan. Met de hand laden komt in
 * stap 5 (docs/auto-en-laadpaal.md).
 */

import type { LaadDag } from './laaddag.js';
import type { Auto } from './opslag.js';

/** De netspanning per fase, zoals de rekenregels hem nemen (W = A × 230 × fasen). */
export const VOLT = 230;
/** Zonder opgave van de laadpaal: de gewone laagste en hoogste laadstroom. */
const MIN_A = 6;
const MAX_A = 16;
/** Goedkoop is pas iets waard als het zoveel per kWh scheelt met nu. */
const GOEDKOOP_SCHEELT = 0.05;
const UUR = 3_600_000;

/** De prijs van één uur, in de munt per kWh. */
export interface UurPrijs {
  readonly vanMs: number;
  readonly prijs: number;
}

/** Een fase van de aansluiting: wat er nu loopt, en de zekering met en zonder marge. */
export interface FaseNu {
  readonly stroomA: number;
  readonly zekeringA: number;
  readonly grensA: number;
}

export interface ZonAdvies {
  readonly soort: 'meer' | 'minder' | 'start';
  /** Bij `meer` en `start`: de zon die over is in kW; bij `minder`: wat er van het net komt. */
  readonly kW: number;
  /** De stroom per fase nu, of null als hij niet laadt. */
  readonly nuA: number | null;
  /** De stroom per fase die op zon past. */
  readonly metA: number;
  readonly fasen: number;
  /** Wat er met die stroom per fase overblijft op de zekering, in A; null zonder meting per fase. */
  readonly overA: number | null;
  /** De zekering, voor de zin erbij. */
  readonly zekering: { readonly fasen: number; readonly ampere: number } | null;
}

export interface GoedkoopAdvies {
  readonly van: string;
  readonly tot: string;
  /** Het gemiddelde in dat blok, per kWh. */
  readonly prijs: number;
  readonly prijsNu: number | null;
  readonly uren: number;
  /** Tot hoeveel procent hij in dat blok komt; null zonder lading of accu. */
  readonly totPct: number | null;
  /** Wat dat ongeveer kost; null zonder lading of accu. */
  readonly kosten: number | null;
  /** Laadt hij nu op zon en is hij vóór dat blok al vol, dan is het vandaag niet nodig. */
  readonly nietNodig: boolean;
}

export interface LaadAdvies {
  readonly zon: ZonAdvies | null;
  readonly goedkoop: GoedkoopAdvies | null;
  /** De balk van de dag in het blad Laden (besluit 279); main zet hem erbij. */
  readonly dag?: LaadDag | null;
}

export interface AdviesContext {
  readonly nuMs: number;
  /** Het netvermogen in W, positief van het net; null zonder slimme meter. */
  readonly netW: number | null;
  /** De fasen van de aansluiting, alleen als ze alle gemeten zijn. */
  readonly fasen: readonly FaseNu[] | null;
  /** De prijzen per uur, van nu vooruit; leeg zonder prijs per uur. */
  readonly prijzen: readonly UurPrijs[];
  /** De prijs van nu per kWh, of null. */
  readonly prijsNu: number | null;
}

const rond1 = (x: number) => Math.round(x * 10) / 10;

/** Op hoeveel fasen hij laadt: wat er nu stroom krijgt, anders wat de laadpaal meet. */
function fasenVan(a: Auto): number {
  const aan = (a.stroomA ?? []).filter((x) => x >= 0.5).length;
  return a.laadt && aan > 0 ? aan : Math.max(1, a.stroomA?.length ?? 1);
}

/** Het advies bij één auto. */
export function laadAdvies(a: Auto, c: AdviesContext): LaadAdvies {
  return { zon: zonAdvies(a, c), goedkoop: goedkoopAdvies(a, c) };
}

function zonAdvies(a: Auto, c: AdviesContext): ZonAdvies | null {
  if (c.netW == null || a.thuis === false) return null;
  const min = a.paalStroomA?.min ?? MIN_A;
  const max = a.paalStroomA?.max ?? MAX_A;
  const fasen = fasenVan(a);
  const perA = VOLT * fasen;
  // Wat er op elke fase nog bij kan (de veilige kant: de auto kan op elke fase zitten).
  const ruimte = c.fasen?.length ? Math.min(...c.fasen.map((f) => f.grensA - f.stroomA)) : null;
  // Nooit boven de zekering zelf, ook als er op een fase minder loopt dan de auto neemt.
  const grens = c.fasen?.length ? Math.min(...c.fasen.map((f) => f.grensA)) : Infinity;
  const over = c.fasen?.length ? Math.min(...c.fasen.map((f) => f.zekeringA - f.stroomA)) : null;
  const zekering = c.fasen?.length ? { fasen: c.fasen.length, ampere: Math.max(...c.fasen.map((f) => f.zekeringA)) } : null;
  const vol = a.pct != null && a.pct >= (a.laadgrens ?? 100) - 1;

  if (a.laadt) {
    const gemeten = (a.stroomA ?? []).filter((x) => x >= 0.5);
    if (!gemeten.length || a.vermogenW == null || a.vermogenW <= 0) return null;
    const nuA = Math.round(Math.max(...gemeten));
    // Wat de auto op zon kan nemen: wat hij nu neemt, plus wat er teruggaat (of min wat er van het net komt).
    const zonA = Math.floor((a.vermogenW - c.netW) / perA + 0.1);
    const kap = Math.min(max, grens, ruimte != null ? Math.floor(nuA + ruimte) : Infinity);
    if (c.netW < 0 && zonA >= nuA + 1) {
      const metA = Math.min(zonA, kap);
      if (metA < nuA + 1) return null;
      return { soort: 'meer', kW: rond1(-c.netW / 1000), nuA, metA, fasen, overA: over != null ? Math.floor(over - (metA - nuA)) : null, zekering };
    }
    if (c.netW >= perA / 2 && zonA < nuA && zonA >= min) {
      return { soort: 'minder', kW: rond1(c.netW / 1000), nuA, metA: zonA, fasen, overA: over != null ? Math.floor(over + (nuA - zonA)) : null, zekering };
    }
    return null;
  }
  if (a.aangesloten !== true || vol || c.netW >= 0) return null;
  const zonA = Math.floor(-c.netW / perA + 0.1);
  const metA = Math.min(zonA, max, grens, ruimte != null ? Math.floor(ruimte) : Infinity);
  if (metA < min) return null;
  return { soort: 'start', kW: rond1(-c.netW / 1000), nuA: null, metA, fasen, overA: over != null ? Math.floor(over - metA) : null, zekering };
}

function goedkoopAdvies(a: Auto, c: AdviesContext): GoedkoopAdvies | null {
  if (c.prijzen.length === 0) return null;
  const grens = a.laadgrens ?? 100;
  if (a.pct != null && a.pct >= grens - 1) return null;
  const uurNu = Math.floor(c.nuMs / UUR) * UUR;
  const uren = new Map(c.prijzen.filter((p) => p.vanMs >= uurNu && p.vanMs < uurNu + 24 * UUR).map((p) => [p.vanMs, p.prijs]));
  const prijsNu = c.prijsNu ?? uren.get(uurNu) ?? null;
  if (prijsNu == null) return null;

  // Hoe lang hij nodig heeft tot de laadgrens, met de hoogste stroom van de laadpaal.
  const fasen = fasenVan(a);
  const kW = ((a.paalStroomA?.max ?? MAX_A) * VOLT * fasen) / 1000;
  const nodigKWh = a.pct != null && a.accuKWh != null ? ((grens - a.pct) / 100) * a.accuKWh : null;
  const n = nodigKWh != null ? Math.max(1, Math.min(8, Math.ceil(nodigKWh / kW))) : 3;

  // Het goedkoopste aaneengesloten blok van n uur, het vroegste bij gelijke prijs.
  let beste: { van: number; prijs: number } | null = null;
  for (const van of [...uren.keys()].sort((x, y) => x - y)) {
    let som = 0;
    let heel = true;
    for (let i = 0; i < n; i++) {
      const p = uren.get(van + i * UUR);
      if (p == null) {
        heel = false;
        break;
      }
      som += p;
    }
    if (heel && (beste == null || som / n < beste.prijs - 1e-9)) beste = { van, prijs: som / n };
  }
  if (beste == null || prijsNu - beste.prijs < GOEDKOOP_SCHEELT) return null;
  // Begint het goedkoopste blok nu, dan is er niets te wachten.
  if (beste.van <= uurNu) return null;

  const geladen = nodigKWh != null ? Math.min(nodigKWh, n * kW) : null;
  const totPct = geladen != null && a.pct != null && a.accuKWh ? Math.min(grens, Math.round(a.pct + (geladen / a.accuKWh) * 100)) : null;
  const opZon = a.laadt === true && c.netW != null && c.netW <= 50;
  const nietNodig = opZon && a.volOm != null && Date.parse(a.volOm) <= beste.van;
  return {
    van: new Date(beste.van).toISOString(),
    tot: new Date(beste.van + n * UUR).toISOString(),
    prijs: Math.round(beste.prijs * 1000) / 1000,
    prijsNu: Math.round(prijsNu * 1000) / 1000,
    uren: n,
    totPct,
    kosten: geladen != null ? Math.round(geladen * beste.prijs * 100) / 100 : null,
    nietNodig,
  };
}

/* ---------------------------------------------------- prijzen per uur */

const TIJD = ['start', 'start_time', 'startsAt', 'starts_at', 'from', 'time', 'datetime', 'date_time', 'start_date', 'begin', 'timestamp'];
const WAARDE = ['price_tax_included', 'price_including_vat', 'value_inc_vat', 'total', 'per_kwh', 'price', 'value', 'electricity_price', 'tariff'];

/** Het tijdstip van een vak: een ISO-tijd, of seconden of milliseconden sinds 1970. */
function tijdVan(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x > 1e12 ? x : x * 1000;
  if (typeof x !== 'string' || x.length < 10) return null;
  const ms = Date.parse(x);
  return Number.isFinite(ms) ? ms : null;
}

function getal(x: unknown): number | null {
  const n = typeof x === 'string' ? Number(x) : x;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** De vakken uit één lijst van een attribuut, of niets als het geen prijslijst is. */
function vakkenUit(lijst: unknown): { vanMs: number; waarde: number }[] {
  if (!Array.isArray(lijst)) return [];
  const uit: { vanMs: number; waarde: number }[] = [];
  for (const v of lijst) {
    if (v == null || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    const tk = TIJD.find((k) => k in o);
    const wk = WAARDE.find((k) => getal(o[k]) != null);
    const t = tk ? tijdVan(o[tk]) : null;
    const w = wk ? getal(o[wk]) : null;
    if (t != null && w != null) uit.push({ vanMs: t, waarde: w });
  }
  return uit.length >= 4 ? uit : [];
}

/** Hoe een getal van de entiteit naar de munt per kWh gaat, uit zijn eenheid. */
function deelVan(eenheid: string | null): number {
  const e = (eenheid ?? '').toLowerCase();
  if (/mwh/.test(e)) return 1000;
  if (/ct|cent/.test(e)) return 100;
  return 1;
}

/**
 * De prijzen per uur uit de attributen van een prijs-entiteit: Nord Pool
 * (`raw_today`, `raw_tomorrow`), ENTSO-e en EnergyZero (`prices`,
 * `prices_today`), Frank Energie (`prices`), Zonneplan (`forecast`), Amber
 * (`forecasts`) en wat er verder zo uitziet: een lijst met per vak een tijd en
 * een prijs. Vakken van een kwartier worden een uur. De schaal volgt uit de
 * prijs van nu: Zonneplan geeft de lijst in tienmiljoensten, Nord Pool soms
 * in centen.
 */
export function prijzenVooruit(attributen: Readonly<Record<string, unknown>> | null | undefined, staat: unknown, eenheid: string | null, nuMs: number): UurPrijs[] {
  if (!attributen) return [];
  const gezien = new Map<number, number>();
  for (const [, waarde] of Object.entries(attributen)) {
    for (const v of vakkenUit(waarde)) if (!gezien.has(v.vanMs)) gezien.set(v.vanMs, v.waarde);
  }
  if (gezien.size === 0) return [];
  const vakken = [...gezien.entries()].sort((x, y) => x[0] - y[0]);

  // De schaal: wat het vak van nu het dichtst bij de prijs van nu brengt.
  const nu = getal(staat);
  const nuEuro = nu != null ? nu / deelVan(eenheid) : null;
  const vakNu = [...vakken].reverse().find(([t]) => t <= nuMs)?.[1] ?? vakken[Math.floor(vakken.length / 2)]![1];
  let schaal = 1 / deelVan(eenheid);
  if (nuEuro != null && Math.abs(nuEuro) > 1e-6 && Math.abs(vakNu) > 1e-9) {
    const kandidaten = [1, 0.01, 0.001, 1e-7];
    schaal = kandidaten.reduce((b, k) => (Math.abs(Math.log(Math.abs((vakNu * k) / nuEuro))) < Math.abs(Math.log(Math.abs((vakNu * b) / nuEuro))) ? k : b), 1);
  }

  // Per uur het gemiddelde van zijn vakken.
  const perUur = new Map<number, { som: number; n: number }>();
  for (const [t, w] of vakken) {
    const uur = Math.floor(t / UUR) * UUR;
    const u = perUur.get(uur) ?? { som: 0, n: 0 };
    u.som += w * schaal;
    u.n += 1;
    perUur.set(uur, u);
  }
  return [...perUur.entries()].map(([vanMs, u]) => ({ vanMs, prijs: u.som / u.n }));
}
