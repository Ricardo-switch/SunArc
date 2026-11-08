/**
 * De balk van de dag in het blad Laden (besluit 279; schets Tel-Auto #dag en
 * #dag-avond). De komende 24 uur per uur: de zon die naar verwachting over is
 * voor de auto, de prijs, de goedkoopste uren uit het advies, en wanneer de
 * auto op zijn laadgrens is. Het blad tekent het; een tik kiest "Tot hh:00".
 *
 * De zon is een schatting: wat de panelen bij een heldere lucht leveren, maal
 * het deel van de heldere lucht dat Open-Meteo dat uur verwacht, min wat het
 * huis zonder de auto ongeveer gebruikt. Zonder ligging of verwachting geen
 * zon; zonder prijs per uur geen prijzen; zonder allebei geen balk.
 */

import type { GoedkoopAdvies, UurPrijs } from './laadadvies.js';
import { VOLT } from './laadadvies.js';
import type { Auto } from './opslag.js';

const UUR = 3_600_000;
export const DAG_UREN = 24;

export interface LaadDagUur {
  readonly vanMs: number;
  /** De stroom per fase die naar verwachting op zon past; null zonder verwachting. */
  readonly zonA: number | null;
  /** De prijs per kWh; null zonder prijs per uur. */
  readonly prijs: number | null;
  /** Een van de goedkoopste uren uit het advies. */
  readonly goedkoop: boolean;
}

export interface LaadDag {
  /** Het eerste uur: het hele uur van nu. */
  readonly vanMs: number;
  readonly nuMs: number;
  readonly uren: readonly LaadDagUur[];
  /** Wanneer de auto op zijn laadgrens is, als hij laadt; anders null. */
  readonly volOmMs: number | null;
  readonly laadgrens: number | null;
}

export interface DagContext {
  readonly nuMs: number;
  readonly prijzen: readonly UurPrijs[];
  readonly goedkoop: GoedkoopAdvies | null;
  /** Wat de panelen naar verwachting leveren rond dat moment, in W; null zonder verwachting. */
  readonly zonW: (ms: number) => number | null;
  /** Wat het huis zonder de auto ongeveer gebruikt, in W. */
  readonly huisW: number;
}

const rond1 = (x: number) => Math.round(x * 10) / 10;

/** Op hoeveel fasen hij laadt: wat er nu stroom krijgt, anders wat de laadpaal meet. */
function fasenVan(a: Auto): number {
  const aan = (a.stroomA ?? []).filter((x) => x >= 0.5).length;
  return a.laadt && aan > 0 ? aan : Math.max(1, a.stroomA?.length ?? 1);
}

/** De komende 24 uur voor één auto, of null als er niets te tekenen is. */
export function laadDag(a: Auto, c: DagContext): LaadDag | null {
  if (a.thuis === false) return null;
  const vanMs = Math.floor(c.nuMs / UUR) * UUR;
  const perA = VOLT * fasenVan(a);
  const prijs = new Map(c.prijzen.map((p) => [p.vanMs, p.prijs]));
  const gVan = c.goedkoop ? Date.parse(c.goedkoop.van) : NaN;
  const gTot = c.goedkoop ? Date.parse(c.goedkoop.tot) : NaN;
  const uren: LaadDagUur[] = Array.from({ length: DAG_UREN }, (_, i) => {
    const t = vanMs + i * UUR;
    const w = c.zonW(t + UUR / 2);
    return {
      vanMs: t,
      zonA: w == null ? null : rond1(Math.max(0, w - c.huisW) / perA),
      prijs: prijs.get(t) ?? null,
      goedkoop: Number.isFinite(gVan) && t >= gVan && t < gTot,
    };
  });
  const metZon = uren.some((u) => u.zonA != null);
  const metPrijs = uren.some((u) => u.prijs != null);
  if (!metZon && !metPrijs) return null;
  const vol = a.laadt && a.volOm ? Date.parse(a.volOm) : NaN;
  return {
    vanMs,
    nuMs: c.nuMs,
    uren,
    volOmMs: Number.isFinite(vol) && vol > c.nuMs && vol < vanMs + DAG_UREN * UUR ? vol : null,
    laadgrens: a.laadgrens,
  };
}

/**
 * Wat de panelen naar verwachting leveren: bij een heldere lucht (`helderW`),
 * maal het deel van de heldere lucht op de grond dat Open-Meteo verwacht. De
 * verwachting is per uur het gemiddelde over het uur ervoor, dus het uur van
 * `ms` staat op de plek van het uur erna.
 */
export function zonVerwachtW(
  ms: number,
  uren: { readonly vanMs: number; readonly zonWm2: readonly (number | null)[] } | null,
  helderW: (ms: number) => number,
  helderGrondWm2: (ms: number) => number,
): number | null {
  if (!uren) return null;
  const i = Math.floor((ms - uren.vanMs) / UUR) + 1;
  const ghi = uren.zonWm2[i];
  if (ghi == null || i < 0) return null;
  const grond = helderGrondWm2(ms);
  if (grond < 20) return 0;
  return Math.round(helderW(ms) * Math.min(1, Math.max(0, ghi / grond)));
}
