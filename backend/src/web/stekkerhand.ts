/**
 * Een slimme stekker met de hand (besluit 265, na besluit 264): aan of uit,
 * altijd met een eind, zoals klimaat (235) en laden met de hand (262).
 *
 * - **Wie:** alleen een stekker die de bewoner bij Regeling › Op zon toeliet
 *   ("SunArc mag hem aan- en uitzetten"); weg is nee. Alleen in de add-on (en
 *   het voorbeeldhuis); de NAS kijkt mee en laat het blad zonder knoppen zien.
 * - **Wat:** `switch.turn_on` of `turn_off` op die ene schakelaar, door de deur
 *   van met de hand (`isHandCall`, de lijst `schakelaars`).
 * - **Hoe lang:** altijd met een eind, hooguit een dag.
 * - **Daarna:** terug zoals hij was, maar alleen als hij nog staat zoals de app
 *   hem zette: wie intussen zelf schakelde, wint. Wat terug moet staat in
 *   `stekkerhand.json`, zodat een herstart het niet vergeet.
 */

import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { StekkerZonStand } from './stekkerzon.js';
import { nextLocalTime } from './today.js';

export const STEKKER_BESTAND = 'stekkerhand.json';
/** Hooguit zo lang met de hand: een dag. */
export const STEKKER_MAX_MS = 24 * 3_600_000;

/** Een stekker die het huis kent, met of de bewoner hem toeliet. */
export interface StekkerBekend {
  /** Het id van de stekker in de app (`stekker-…`). */
  readonly id: string;
  readonly naam: string;
  /** De schakelaar in Home Assistant. */
  readonly actuator: string;
  readonly power?: string;
  readonly mag: boolean;
}

/** Wat er op het eind terug moet. */
export interface StekkerTerug {
  readonly id: string;
  readonly actuator: string;
  /** Wat de app zette. */
  readonly aan: boolean;
  /** Hoe hij daarvoor stond; null als Home Assistant het niet wist. */
  readonly was: boolean | null;
  readonly totMs: number;
  readonly sindsMs: number;
}

export interface StekkerStand {
  readonly id: string;
  readonly naam: string;
  /** Staat hij nu aan; null als Home Assistant het niet weet. */
  readonly aan: boolean | null;
  /** Wat hij nu trekt, in W, als hij een meter heeft. */
  readonly vermogenW: number | null;
  /** Mag SunArc hem schakelen (toegelaten en in de add-on). */
  readonly mag: boolean;
  /** Toegelaten bij Regeling, ook als de deur er hier niet is. */
  readonly toegelaten: boolean;
  readonly actief: { readonly aan: boolean; readonly totMs: number } | null;
  /** Op zon, echt geschakeld (besluit 267): of SunArc hem schakelt, hem aanzette, of met rust laat. */
  readonly zon?: StekkerZonStand;
  /** Zijn minimum per dag (besluit 267), en hoe lang hij daarvoor al aan was, in minuten; weg zonder minimum. */
  readonly minimum?: { readonly minuten: number; readonly klok: string };
  readonly gehadMin?: number;
}

interface Toestand {
  readonly state: string;
}

export interface StekkerDeur {
  readonly state: (id: string) => Toestand | undefined;
  readonly schakel: (id: string, aan: boolean) => Promise<void>;
  readonly stekkers: () => readonly StekkerBekend[];
  /** De tijdzone van het huis, voor "tot 22:00". */
  readonly tijdzone?: () => string;
  readonly nu?: () => number;
  readonly map: string | null;
}

/**
 * Tot wanneer, zoals de pagina het vraagt: een aantal minuten, een klok
 * ("22:00", de eerstvolgende keer), of een tijd in epoch-ms. De dienst rekent
 * het zelf uit, zodat een telefoon met een andere klok niets uitmaakt.
 */
export type StekkerTot = { readonly duurMin: number } | { readonly klok: string } | { readonly totMs: number };

export type StekkerUitkomst = { readonly ok: true; readonly terug: StekkerTerug } | { readonly ok: false; readonly reden: string };

const aanUit = (s: Toestand | undefined): boolean | null => (s?.state === 'on' ? true : s?.state === 'off' ? false : null);

/** De schakelaars die door de deur mogen: toegelaten, of nog iets terug te zetten. */
export function stekkerMag(stekkers: readonly StekkerBekend[], terug: readonly StekkerTerug[]): string[] {
  return [...new Set([...stekkers.filter((s) => s.mag).map((s) => s.actuator), ...terug.map((t) => t.actuator)])];
}

export class Stekkerhand {
  readonly #d: StekkerDeur;
  #terug: StekkerTerug[] = [];
  #geladen = false;

  constructor(d: StekkerDeur) {
    this.#d = d;
  }

  #nu(): number {
    return this.#d.nu?.() ?? Date.now();
  }

  get terugzetten(): readonly StekkerTerug[] {
    return [...this.#terug];
  }

  /** Per stekker wat het blad nodig heeft; `deur` zegt of hier geschakeld kan worden. */
  async standen(deur = true): Promise<StekkerStand[]> {
    await this.#laad();
    return this.#d.stekkers().map((s) => {
      const t = this.#terug.find((x) => x.id === s.id);
      const w = s.power ? Number(this.#d.state(s.power)?.state) : NaN;
      return {
        id: s.id,
        naam: s.naam,
        aan: aanUit(this.#d.state(s.actuator)),
        vermogenW: Number.isFinite(w) ? Math.round(w) : null,
        mag: deur && s.mag,
        toegelaten: s.mag,
        actief: t ? { aan: t.aan, totMs: t.totMs } : null,
      };
    });
  }

  /** Tot wanneer in epoch-ms, of null als het niet te lezen is. */
  totMsVan(tot: StekkerTot): number | null {
    const nu = this.#nu();
    if ('duurMin' in tot) return Number.isFinite(tot.duurMin) && tot.duurMin >= 1 ? nu + Math.round(tot.duurMin) * 60_000 : null;
    if ('klok' in tot) return /^([01]\d|2[0-3]):[0-5]\d$/.test(tot.klok) ? nextLocalTime(nu + 60_000, tot.klok, this.#d.tijdzone?.() ?? 'Europe/Amsterdam') : null;
    return Number.isFinite(tot.totMs) ? tot.totMs : null;
  }

  /** Aan of uit tot een tijd. Staat er al iets met de hand, dan blijft "hoe hij was" van de eerste keer. */
  async zet(id: string, aan: boolean, wanneer: StekkerTot | number): Promise<StekkerUitkomst> {
    const totMs = this.totMsVan(typeof wanneer === 'number' ? { totMs: wanneer } : wanneer) ?? Number.NaN;
    await this.#laad();
    const s = this.#d.stekkers().find((x) => x.id === id);
    if (!s) return { ok: false, reden: 'die stekker kent SunArc niet' };
    if (!s.mag) return { ok: false, reden: 'zet bij Regeling › Op zon aan dat SunArc deze stekker mag bedienen' };
    const nu = this.#nu();
    if (!(Number.isFinite(totMs) && totMs > nu && totMs <= nu + STEKKER_MAX_MS)) return { ok: false, reden: 'tot wanneer ligt in de komende 24 uur' };
    const eerder = this.#terug.find((x) => x.id === id);
    const was = eerder ? eerder.was : aanUit(this.#d.state(s.actuator));
    await this.#d.schakel(s.actuator, aan);
    const terug: StekkerTerug = { id, actuator: s.actuator, aan, was, totMs, sindsMs: nu };
    this.#terug = [...this.#terug.filter((x) => x.id !== id), terug];
    await this.#bewaar();
    return { ok: true, terug };
  }

  /** Nu terug zoals hij was, op verzoek van de bewoner. */
  async terugNu(id: string): Promise<boolean> {
    await this.#laad();
    const t = this.#terug.find((x) => x.id === id);
    if (!t) return false;
    await this.#zetTerug(t);
    this.#terug = this.#terug.filter((x) => x !== t);
    await this.#bewaar();
    return true;
  }

  /** Elke minuut: wat voorbij zijn tijd is, terug. */
  async ronde(): Promise<string[]> {
    await this.#laad();
    const nu = this.#nu();
    const klaar = this.#terug.filter((t) => t.totMs <= nu);
    if (!klaar.length) return [];
    const gedaan: string[] = [];
    for (const t of klaar) {
      try {
        const g = await this.#zetTerug(t);
        if (g) gedaan.push(g);
      } catch {
        continue;
      }
      this.#terug = this.#terug.filter((x) => x !== t);
    }
    await this.#bewaar();
    return gedaan;
  }

  /** Terug, maar alleen als hij nog staat zoals de app hem zette: wie zelf schakelde, wint. */
  async #zetTerug(t: StekkerTerug): Promise<string | null> {
    const nu = aanUit(this.#d.state(t.actuator));
    const doel = t.was ?? !t.aan;
    if (nu !== t.aan || doel === t.aan) return null;
    await this.#d.schakel(t.actuator, doel);
    return `${t.actuator} ${doel ? 'aan' : 'uit'}`;
  }

  async #laad(): Promise<void> {
    if (this.#geladen) return;
    this.#geladen = true;
    if (this.#d.map == null) return;
    try {
      const j = JSON.parse(await readFile(join(this.#d.map, STEKKER_BESTAND), 'utf8')) as { terug?: unknown };
      if (Array.isArray(j?.terug)) {
        this.#terug = j.terug.filter(
          (t): t is StekkerTerug =>
            typeof t === 'object' && t != null && typeof (t as StekkerTerug).id === 'string' && typeof (t as StekkerTerug).actuator === 'string' && (t as StekkerTerug).actuator.startsWith('switch.') && typeof (t as StekkerTerug).aan === 'boolean' && Number.isFinite((t as StekkerTerug).totMs),
        );
      }
    } catch {
      // Nog niets bewaard.
    }
  }

  async #bewaar(): Promise<void> {
    if (this.#d.map == null) return;
    const pad = join(this.#d.map, STEKKER_BESTAND);
    await writeFile(`${pad}.tmp`, `${JSON.stringify({ versie: 1, terug: this.#terug }, null, 2)}\n`);
    await rename(`${pad}.tmp`, pad);
  }
}
