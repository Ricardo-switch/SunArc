/**
 * De warmtebuffers van de bewoner (besluit 186): "klaar om" bij de jacuzzi, en
 * wat de dienst onthoudt omdat Home Assistant het niet zegt.
 *
 * Een smalle deur, zoals bij de droger (besluit 101): hij bewaart alleen
 * `warmtebuffers.json` naast de dataset, en er gaat niets naar Home Assistant.
 *
 * - **Klaar om:** per buffer wanneer en hoe warm. Voorbij is weg.
 * - **Legionella:** wanneer de boiler voor het laatst warm genoeg was. Dat
 *   moet een herstart overleven, anders is de week na elke update opnieuw vol.
 * - **Vol:** wanneer een boiler zonder temperatuur voor het laatst vol was.
 * - **Aan:** wanneer een stekker aan was (besluit 267), de laatste twee dagen:
 *   daaruit volgt hoe lang hij nog moet voor zijn minimum.
 *
 * En de goedkoopste uren voor de kern: de daluren van het contract, als het er
 * een met een daltarief is. Dynamische prijzen komen met stap E.
 */

import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { HeatStoreExplanation } from '../core/decision.js';
import type { SiteConfig } from '../core/model.js';
import type { HeatStoreExtra } from '../core/state.js';
import { HEATING_W } from '../core/warmtebuffer.js';
import { isDal, type Tarieven } from './tarief.js';
import { nextLocalTime } from './today.js';

export const BUFFERS_FILE = 'warmtebuffers.json';

const WINDOW_MS = 10 * 60_000;
/** Verder vooruit kiezen kan niet: een week. */
const MAX_AHEAD_MS = 7 * 24 * 3_600_000;
/** Zo ver vooruit kijkt de kern naar de goedkoopste uren. */
const CHEAP_AHEAD_MS = 36 * 3_600_000;
/** Zo lang onthoudt hij wanneer een stekker aan was: genoeg voor het minimum van een dag. */
const AAN_BEWAREN_MS = 48 * 3_600_000;
const DAG_MS = 24 * 3_600_000;

type Stuk = { readonly van: number; readonly tot: number };

/** Hoe lang hij aan was tussen `van` en `tot`, uit de stukken en wat nu nog loopt. */
export function aanTussen(stukken: readonly Stuk[], sinds: number | null, van: number, tot: number): number {
  const alle = sinds != null ? [...stukken, { van: sinds, tot }] : stukken;
  return alle.reduce((n, s) => n + Math.max(0, Math.min(s.tot, tot) - Math.max(s.van, van)), 0);
}

interface Bewaard {
  readonly klaarOm: Readonly<Record<string, { readonly atMs: number; readonly targetC: number }>>;
  readonly legionella: Readonly<Record<string, number>>;
  readonly vol: Readonly<Record<string, number>>;
  /** Wat een stekker trok toen hij aan was (besluit 264), in W. */
  readonly vermogen?: Readonly<Record<string, number>>;
  /** Wanneer een stekker aan was (besluit 267): afgesloten stukken, en sinds wanneer hij nu aan is. */
  readonly aan?: Readonly<Record<string, readonly Stuk[]>>;
  readonly aanSinds?: Readonly<Record<string, number>>;
}

export interface BufferOptions {
  readonly logDir: string;
  readonly config: SiteConfig;
  /** Na een wijziging door de bewoner: zodat de dienst meteen opnieuw beslist. */
  readonly onChange?: () => void;
  readonly now?: () => number;
  readonly perTenMinutes?: number;
}

export type BufferResult =
  | { readonly ok: true; readonly id: string; readonly klaarOm: { readonly atMs: number; readonly targetC: number } | null }
  | { readonly ok: false; readonly status: number; readonly reden: string };

const isGetal = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export class BufferStore {
  readonly #path: string;
  readonly #options: BufferOptions;
  readonly #now: () => number;
  readonly #limit: number;
  #recent: number[] = [];
  /** De configuratie van nu: op zon gaat meteen in (besluit 290). */
  #config: SiteConfig;
  #current: Bewaard = { klaarOm: {}, legionella: {}, vol: {} };

  constructor(options: BufferOptions) {
    this.#options = options;
    this.#config = options.config;
    this.#path = join(options.logDir, BUFFERS_FILE);
    this.#now = options.now ?? Date.now;
    this.#limit = options.perTenMinutes ?? 30;
  }

  /** Een apparaat op zon erbij of eraf, zonder herstart (besluit 290). */
  setConfig(next: SiteConfig): void {
    this.#config = next;
  }

  async load(): Promise<void> {
    try {
      const raw = JSON.parse(await readFile(this.#path, 'utf-8')) as Record<string, unknown>;
      if (raw?.['versie'] !== 1) return;
      const known = new Set((this.#config.heatStores ?? []).map((h) => h.id));
      const tijden = (v: unknown) =>
        Object.fromEntries(Object.entries(typeof v === 'object' && v != null ? v : {}).filter((e): e is [string, number] => known.has(e[0]) && isGetal(e[1])));
      const klaarOm = Object.fromEntries(
        Object.entries(typeof raw['klaarOm'] === 'object' && raw['klaarOm'] != null ? raw['klaarOm'] : {}).filter(
          (e): e is [string, { atMs: number; targetC: number }] => known.has(e[0]) && typeof e[1] === 'object' && e[1] != null && isGetal(e[1].atMs) && isGetal(e[1].targetC),
        ),
      );
      const aanRaw = typeof raw['aan'] === 'object' && raw['aan'] != null ? (raw['aan'] as Record<string, unknown>) : {};
      const aan = Object.fromEntries(
        Object.entries(aanRaw).flatMap(([id, v]): [string, Stuk[]][] =>
          known.has(id) && Array.isArray(v) ? [[id, v.filter((s): s is Stuk => typeof s === 'object' && s != null && isGetal(s.van) && isGetal(s.tot) && s.tot >= s.van)]] : [],
        ),
      );
      this.#current = { klaarOm, legionella: tijden(raw['legionella']), vol: tijden(raw['vol']), vermogen: tijden(raw['vermogen']), aan, aanSinds: tijden(raw['aanSinds']) };
    } catch {
      this.#current = { klaarOm: {}, legionella: {}, vol: {} };
    }
  }

  /** Per buffer wat de kern van de dienst krijgt. */
  get extra(): Readonly<Record<string, HeatStoreExtra>> {
    return Object.fromEntries(
      (this.#config.heatStores ?? []).map((h) => [
        h.id,
        {
          readyBy: this.#current.klaarOm[h.id] ?? null,
          legionellaAtMs: this.#current.legionella[h.id] ?? null,
          lastFullMs: this.#current.vol[h.id] ?? null,
          learnedW: this.#current.vermogen?.[h.id] ?? null,
          minimum: this.#minimum(h),
        },
      ]),
    );
  }

  /** Het minimum van een stekker (besluit 267): wanneer het uiterlijk moet, en hoe lang hij nog moet. */
  #minimum(h: NonNullable<SiteConfig['heatStores']>[number]): { atMs: number; remainingMs: number } | null {
    if (h.kind !== 'stekker' || h.minimum == null) return null;
    const t = this.#now();
    const atMs = nextLocalTime(t, h.minimum.by, this.#config.timezone);
    const gehad = aanTussen(this.#current.aan?.[h.id] ?? [], this.#current.aanSinds?.[h.id] ?? null, atMs - DAG_MS, t);
    return { atMs, remainingMs: Math.max(0, h.minimum.minutes * 60_000 - gehad) };
  }

  /** Hoe lang een stekker aan was in de 24 uur voor zijn minimum, in minuten; voor het blad. */
  aanGehad(id: string): number | null {
    const h = (this.#config.heatStores ?? []).find((x) => x.id === id);
    if (h?.kind !== 'stekker' || h.minimum == null) return null;
    const t = this.#now();
    const atMs = nextLocalTime(t, h.minimum.by, this.#config.timezone);
    return Math.floor(aanTussen(this.#current.aan?.[h.id] ?? [], this.#current.aanSinds?.[h.id] ?? null, atMs - DAG_MS, t) / 60_000);
  }

  /** `{ id, klaarOm: epoch-ms, doelC? }` zet klaar om, `klaarOm: null` haalt het weg. */
  async set(body: unknown): Promise<BufferResult> {
    if (typeof body !== 'object' || body == null || Array.isArray(body)) return { ok: false, status: 400, reden: 'verwacht { id, klaarOm }' };
    const b = body as Record<string, unknown>;
    const id = b['id'];
    const h = (this.#config.heatStores ?? []).find((x) => x.id === id);
    if (typeof id !== 'string' || h == null) return { ok: false, status: 404, reden: 'dat apparaat kent SunArc niet als warmtebuffer' };
    if (h.kind === 'stekker') return { ok: false, status: 400, reden: 'een stekker heeft geen klaar om' };
    const t = this.#now();
    const klaarOm = b['klaarOm'];
    if (klaarOm !== null && (!isGetal(klaarOm) || klaarOm <= t || klaarOm > t + MAX_AHEAD_MS)) {
      return { ok: false, status: 400, reden: 'klaarOm is een tijd in de komende week (epoch-ms), of null' };
    }
    const doel = b['doelC'] ?? h.sunC;
    const max = h.kind === 'jacuzzi' ? 40 : h.sunC;
    if (!isGetal(doel) || doel < h.minC || doel > max) return { ok: false, status: 400, reden: `doelC ligt tussen ${h.minC} en ${max}` };

    this.#recent = this.#recent.filter((x) => t - x < WINDOW_MS);
    if (this.#recent.length >= this.#limit) return { ok: false, status: 429, reden: 'even te veel achter elkaar; probeer het zo weer' };
    this.#recent.push(t);

    const rest = Object.fromEntries(Object.entries(this.#current.klaarOm).filter(([k]) => k !== id));
    const nieuw = klaarOm === null ? null : { atMs: klaarOm, targetC: doel };
    await this.#save({ ...this.#current, klaarOm: nieuw ? { ...rest, [id]: nieuw } : rest });
    this.#options.onChange?.();
    return { ok: true, id, klaarOm: nieuw };
  }

  /**
   * Na elk besluit: onthoud wanneer de boiler warm genoeg was tegen legionella,
   * en wanneer een boiler zonder temperatuur vol was. Klaar om dat voorbij is,
   * vervalt.
   */
  async observe(explanations: readonly HeatStoreExplanation[] | undefined): Promise<void> {
    const t = this.#now();
    const legionella = { ...this.#current.legionella };
    const vol = { ...this.#current.vol };
    const vermogen = { ...this.#current.vermogen };
    const aan: Record<string, readonly Stuk[]> = { ...this.#current.aan };
    const aanSinds: Record<string, number> = { ...this.#current.aanSinds };
    let changed = false;
    for (const e of explanations ?? []) {
      const h = (this.#config.heatStores ?? []).find((x) => x.id === e.id);
      if (h == null) continue;
      // Hooguit eens per uur bijwerken: anders schrijft elk besluit het bestand.
      if (h.legionellaC != null && e.temperatureC != null && e.temperatureC >= h.legionellaC && t - (legionella[h.id] ?? 0) > 3_600_000) {
        legionella[h.id] = t;
        changed = true;
      }
      if (h.temperature == null && e.state === 'full' && t - (vol[h.id] ?? 0) > 3_600_000) {
        vol[h.id] = t;
        changed = true;
      }
      // Een stekker die aan is en iets trekt (besluit 264): dat is zijn vermogen.
      // Alleen een verschil van meer dan een tiende: anders schrijft elk besluit het bestand.
      if (h.kind === 'stekker' && e.heating && e.powerW != null && e.powerW > HEATING_W) {
        const was = vermogen[h.id];
        if (was == null || Math.abs(e.powerW - was) > was * 0.1) {
          vermogen[h.id] = e.powerW;
          changed = true;
        }
      }
      // Wanneer een stekker aan was (besluit 267): alleen bij een wissel, dus zelden schrijven.
      if (h.kind === 'stekker') {
        const sinds = aanSinds[h.id];
        if (e.heating && sinds == null) {
          aanSinds[h.id] = t;
          changed = true;
        } else if (!e.heating && sinds != null) {
          aan[h.id] = [...(aan[h.id] ?? []).filter((s) => s.tot > t - AAN_BEWAREN_MS), { van: sinds, tot: t }];
          delete aanSinds[h.id];
          changed = true;
        }
      }
    }
    const klaarOm = Object.fromEntries(Object.entries(this.#current.klaarOm).filter(([, k]) => k.atMs > t));
    if (Object.keys(klaarOm).length !== Object.keys(this.#current.klaarOm).length) changed = true;
    if (changed) await this.#save({ klaarOm, legionella, vol, vermogen, aan, aanSinds });
  }

  #writing: Promise<void> = Promise.resolve();

  #save(next: Bewaard): Promise<void> {
    // Eerst naast het bestand schrijven, dan omwisselen, zoals bij de droger.
    this.#current = next;
    const text = `${JSON.stringify({ versie: 1, ...next }, null, 2)}\n`;
    const tmp = `${this.#path}.nieuw`;
    this.#writing = this.#writing.catch(() => {}).then(async () => {
      await writeFile(tmp, text, 'utf-8');
      await rename(tmp, this.#path);
    });
    return this.#writing;
  }
}

/**
 * De goedkoopste uren van de komende anderhalve dag: de daluren, als het
 * contract een daltarief heeft. Per heel uur, aaneengesloten uren samen.
 */
export function cheapWindows(nowMs: number, timezone: string, prijzen: Pick<Tarieven, 'stroomDal' | 'dalUren' | 'dalEigen'> | null): { fromMs: number; toMs: number }[] {
  if (prijzen?.stroomDal == null) return [];
  const uur = 3_600_000;
  const out: { fromMs: number; toMs: number }[] = [];
  for (let t = Math.floor(nowMs / uur) * uur; t < nowMs + CHEAP_AHEAD_MS; t += uur) {
    if (!isDal(t, timezone, prijzen.dalUren ?? 'nl', prijzen.dalEigen ?? null)) continue;
    const last = out.at(-1);
    if (last && last.toMs === t) last.toMs = t + uur;
    else out.push({ fromMs: t, toMs: t + uur });
  }
  return out;
}
