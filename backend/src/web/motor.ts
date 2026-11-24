/**
 * De motor (kwaliteitsronde stap 4 punt 4; schets design/app2/Wand-Motor.html): de rondes van een
 * dag uit het beslislogboek, voor De motor › Vandaag.
 *
 * Eén regel blijft: hier wordt niets nagerekend. Wat er staat, is wat de kern in elke ronde meegaf; dit bestand
 * zoekt het op en vat het per kwartier samen.
 *
 * - `motorDag` geeft per kwartier van een dag: hoeveel rondes, de zon en het net gemiddeld, per apparaat wat de motor
 *   zou laten doen (voortgedragen over de korte rondes, zoals de terugblik dat ook doet) en of het apparaat echt
 *   draaide, en of de oude regeling iets deed.
 * - `motorRonde` geeft één ronde, de dichtstbijzijnde op of voor een moment: wat de kern toen mat, en het besluit dat
 *   gold (dat van de laatste ronde waarin het wijzigde), met de vorige en volgende ronde om te bladeren.
 */

import { stat } from 'node:fs/promises';
import { basename } from 'node:path';

import { arbiterRunning, findLogFiles, linesOf, newReaderCarry, observedRunning, readMoments } from '../divergence/read.js';

/** Een dag in de plaatselijke klok, en het kwartier van een moment. */
function plaatselijk(ms: number, timeZone: string): { dag: string; kw: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return { dag: `${p['year']}-${p['month']}-${p['day']}`, kw: Number(p['hour']) * 4 + Math.floor(Number(p['minute']) / 15) };
}

export interface MotorKwartier {
  readonly kw: number;
  readonly rondes: number;
  /** Gemiddeld over de rondes, in W; null zonder meting. */
  readonly zonW: number | null;
  /** Het net gemiddeld, in W; negatief is terug. */
  readonly netW: number | null;
  /**
   * Per apparaat: wat de motor het meest wilde (`heat`, `cool`, `off`, of null zonder voorstel), of het volgens de
   * motor zou draaien, en of het echt draaide (de meeste rondes van het kwartier).
   */
  readonly apparaten: Readonly<Record<string, { readonly zou: string | null; readonly zouDraaien: boolean; readonly draaide: boolean }>>;
  /** Deed de oude regeling iets (zijn uitleg zegt "actief")? */
  readonly oud: boolean;
}

export interface MotorDag {
  readonly dag: string;
  /** 96 kwartieren; null waar het logboek niets heeft. */
  readonly kwartieren: readonly (MotorKwartier | null)[];
  /** De apparaten die in de dag voorkomen. */
  readonly apparaten: readonly string[];
}

/** Het dagbestand van een dag, en dat van de dag ervoor (voor wat de motor bij middernacht al wilde). */
async function bestanden(logDir: string, dag: string): Promise<{ eerder: string | null; deze: string | null }> {
  const alle = await findLogFiles(logDir).catch(() => [] as string[]);
  const dagVan = (p: string) => /decisions-(\d{4}-\d{2}-\d{2})/.exec(basename(p))?.[1] ?? '';
  const deze = alle.find((p) => dagVan(p) === dag) ?? null;
  const eerder = alle.filter((p) => dagVan(p) < dag).at(-1) ?? null;
  return { eerder, deze };
}

const DAG_CACHE = new Map<string, { sleutel: string; dag: MotorDag }>();

/** Per kwartier van een dag wat de motor zou doen, wat er gebeurde en wat de oude regeling deed; null zonder logboek. */
export async function motorDag(logDir: string, dag: string, timeZone: string): Promise<MotorDag | null> {
  const { eerder, deze } = await bestanden(logDir, dag);
  if (!deze) return null;
  const st = await stat(deze).catch(() => null);
  const sleutel = `${deze}|${st?.mtimeMs ?? 0}|${st?.size ?? 0}`;
  const cache = DAG_CACHE.get(`${logDir}|${dag}`);
  if (cache?.sleutel === sleutel) return cache.dag;

  // De dag ervoor alleen om te weten wat de motor bij middernacht wilde.
  const carry = newReaderCarry();
  if (eerder) for await (const m of readMoments([eerder], carry)) void m;
  type Telling = { rondes: number; zon: number[]; net: number[]; oud: number; app: Map<string, { zou: Map<string, number>; zouDraaien: number; draaide: number }> };
  const per: (Telling | null)[] = Array.from({ length: 96 }, () => null);
  const apparaten = new Set<string>();
  for await (const m of readMoments([deze], carry)) {
    const p = plaatselijk(m.tMs, timeZone);
    if (p.dag !== dag) continue;
    const t: Telling = (per[p.kw] ??= { rondes: 0, zon: [], net: [], oud: 0, app: new Map() } satisfies Telling);
    t.rondes++;
    if (m.solarW != null) t.zon.push(m.solarW);
    t.net.push(m.budget.gridPowerW);
    if (m.legacy && /actief/i.test(m.legacy)) t.oud++;
    for (const id of new Set([...Object.keys(m.observed), ...Object.keys(m.arbiterAction)])) {
      apparaten.add(id);
      const a = t.app.get(id) ?? { zou: new Map(), zouDraaien: 0, draaide: 0 };
      const zou = m.arbiterAction[id] ?? '';
      a.zou.set(zou, (a.zou.get(zou) ?? 0) + 1);
      if (arbiterRunning(m, id)) a.zouDraaien++;
      if (observedRunning(m.observed[id])) a.draaide++;
      t.app.set(id, a);
    }
  }
  const gem = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
  const kwartieren = per.map((t, kw) => {
    if (!t) return null;
    const app: Record<string, { zou: string | null; zouDraaien: boolean; draaide: boolean }> = {};
    for (const [id, a] of t.app) {
      const zou = [...a.zou].sort((x, y) => y[1] - x[1])[0]?.[0] ?? '';
      app[id] = { zou: zou || null, zouDraaien: a.zouDraaien * 2 >= t.rondes, draaide: a.draaide * 2 >= t.rondes };
    }
    return { kw, rondes: t.rondes, zonW: gem(t.zon), netW: gem(t.net), apparaten: app, oud: t.oud * 2 >= t.rondes };
  });
  const uit = { dag, kwartieren, apparaten: [...apparaten].sort() };
  DAG_CACHE.set(`${logDir}|${dag}`, { sleutel, dag: uit });
  return uit;
}

/** Wat er in één ronde gemeten werd, zoals het in het logboek staat (korte rondes aangevuld met wat ervoor gold). */
export interface MotorRonde {
  readonly tMs: number;
  /** Om te bladeren: de ronde ervoor en erna op dezelfde dag, of null. */
  readonly vorigeMs: number | null;
  readonly volgendeMs: number | null;
  /** De hoeveelste ronde van zijn kwartier, en hoeveel het kwartier er heeft. */
  readonly n: number;
  readonly van: number;
  readonly meet: Readonly<Record<string, unknown>>;
  /** Het besluit dat gold: uit de laatste ronde waarin het wijzigde, op of voor deze. */
  readonly besluit: { readonly vanMs: number | null; readonly accepted: readonly unknown[]; readonly rejected: readonly unknown[]; readonly commands: readonly unknown[] };
}

/** Velden die een korte ronde weglaat en die tot ze wijzigen blijven gelden. */
const VOORT = ['legacy', 'obs', 'doet', 'zones'] as const;

/** Eén ronde op of voor `tMs` (in de dag van dat moment), of null als die dag geen logboek heeft. */
export async function motorRonde(logDir: string, tMs: number, timeZone: string): Promise<MotorRonde | null> {
  const dag = plaatselijk(tMs, timeZone).dag;
  const { eerder, deze } = await bestanden(logDir, dag);
  if (!deze) return null;
  const regels: Record<string, unknown>[] = [];
  let laatsteBesluit: Record<string, unknown> | null = null;
  const voort: Record<string, unknown> = {};
  // De dag ervoor: alleen het laatste besluit en wat voortgedragen wordt.
  if (eerder) {
    for await (const regel of linesOf(eerder)) {
      try {
        const r = JSON.parse(regel) as Record<string, unknown>;
        if (r['changed'] === true) laatsteBesluit = r;
        for (const k of VOORT) if (r[k] != null) voort[k] = r[k];
      } catch {
        // Een afgekapte regel.
      }
    }
  }
  for await (const regel of linesOf(deze)) {
    try {
      const r = JSON.parse(regel) as Record<string, unknown>;
      if (typeof r['t'] === 'number') regels.push(r);
    } catch {
      // Een afgekapte regel.
    }
  }
  if (!regels.length) return null;
  let i = -1;
  for (let j = 0; j < regels.length; j++) if ((regels[j]!['t'] as number) <= tMs) i = j;
  if (i < 0) i = 0;
  for (let j = 0; j <= i; j++) {
    const r = regels[j]!;
    if (r['changed'] === true) laatsteBesluit = r;
    for (const k of VOORT) if (r[k] != null) voort[k] = r[k];
  }
  const r = regels[i]!;
  const t = r['t'] as number;
  const kw = plaatselijk(t, timeZone).kw;
  const inKwartier = regels.filter((x) => plaatselijk(x['t'] as number, timeZone).kw === kw && plaatselijk(x['t'] as number, timeZone).dag === dag);
  const meet: Record<string, unknown> = { ...voort, ...r };
  for (const k of ['commands', 'accepted', 'rejected']) delete meet[k];
  return {
    tMs: t,
    vorigeMs: i > 0 ? (regels[i - 1]!['t'] as number) : null,
    volgendeMs: i + 1 < regels.length ? (regels[i + 1]!['t'] as number) : null,
    n: inKwartier.findIndex((x) => x === r) + 1,
    van: inKwartier.length,
    meet,
    besluit: {
      vanMs: (laatsteBesluit?.['t'] as number | undefined) ?? null,
      accepted: (laatsteBesluit?.['accepted'] as unknown[] | undefined) ?? [],
      rejected: (laatsteBesluit?.['rejected'] as unknown[] | undefined) ?? [],
      commands: r['changed'] === true ? ((r['commands'] as unknown[] | undefined) ?? []) : [],
    },
  };
}
