/**
 * Een slimme stekker op zon, en echt geschakeld (besluit 267, na 264 en 265).
 *
 * Wat de regeling bij een stekker zegt (aan op zon, of op het laatst van het
 * net voor zijn minimum), zet SunArc hier echt door, met dezelfde deur als met
 * de hand (265): `switch.turn_on` of `turn_off` op die ene schakelaar.
 *
 * - **Wie:** alleen een stekker die op zon staat én die de bewoner toeliet
 *   ("SunArc mag hem aan- en uitzetten"). Alleen in de add-on (en het
 *   voorbeeldhuis); de NAS kijkt mee.
 * - **Aan:** als de regeling zegt dat hij aan zou gaan en hij uit staat.
 * - **Uit:** alleen wat SunArc zelf aanzette, zodra de regeling zegt dat hij
 *   wacht. Wat de bewoner zelf aanzette, blijft aan.
 * - **Wie zelf schakelt, wint:** zet iemand een stekker uit die SunArc aanzette,
 *   dan laat SunArc hem tot middernacht met rust. Staat hij met de hand of op
 *   een vaste tijd, dan doet SunArc niets tot die voorbij is.
 * - **Niet steeds aan en uit:** per stekker hooguit eens per tien minuten.
 *
 * Wat SunArc aanzette en welke stekkers rust hebben, staat in
 * `stekkerzon.json`, zodat een herstart het niet vergeet.
 */

import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { HeatStoreExplanation } from '../core/decision.js';
import type { StekkerBekend } from './stekkerhand.js';
import { nextLocalTime } from './today.js';

export const STEKKERZON_BESTAND = 'stekkerzon.json';
/** Per stekker hooguit eens per zo lang schakelen. */
export const NIET_SNEL_MS = 10 * 60_000;
/** Zo lang na een schakeling kan Home Assistant nog de oude stand geven. */
const NA_SCHAKELEN_MS = 2 * 60_000;

interface Toestand {
  readonly state: string;
}

export interface StekkerZonDeur {
  readonly state: (id: string) => Toestand | undefined;
  readonly schakel: (id: string, aan: boolean) => Promise<void>;
  /** De stekkers die het huis kent, met of de bewoner ze toeliet. */
  readonly stekkers: () => readonly StekkerBekend[];
  /** De stekkers die op zon staan (in de regeling). */
  readonly opZon: () => ReadonlySet<string>;
  /** De stekkers die nu met de hand of op een vaste tijd staan. */
  readonly metDeHand: () => ReadonlySet<string>;
  /** Of hier geschakeld mag worden: alleen in de add-on. */
  readonly aan: () => boolean;
  readonly tijdzone?: () => string;
  readonly nu?: () => number;
  readonly map: string | null;
  readonly write?: (regel: string) => void;
}

/** Per stekker, voor de kaart en het blad. */
export interface StekkerZonStand {
  /** SunArc schakelt hem op zon. */
  readonly schakelt: boolean;
  /** SunArc zette hem aan. */
  readonly vanSunArc: boolean;
  /** Tot wanneer SunArc hem met rust laat, omdat iemand hem zelf uitzette. */
  readonly rustTot: number | null;
}

const aanUit = (s: Toestand | undefined): boolean | null => (s?.state === 'on' ? true : s?.state === 'off' ? false : null);

export class StekkerZon {
  readonly #d: StekkerZonDeur;
  /** Wat SunArc aanzette: id → sinds wanneer. */
  #eigen = new Map<string, { readonly actuator: string; readonly sinds: number }>();
  /** Rust tot: id → epoch-ms. */
  #rust = new Map<string, number>();
  /** Wanneer SunArc hem voor het laatst schakelde (niet bewaard: na een herstart mag het weer). */
  readonly #laatst = new Map<string, number>();
  #geladen = false;

  constructor(d: StekkerZonDeur) {
    this.#d = d;
  }

  #nu(): number {
    return this.#d.nu?.() ?? Date.now();
  }

  /** De schakelaars die SunArc aanzette: die moeten door de deur, ook als de bewoner hem intussen niet meer toeliet. */
  get eigen(): readonly string[] {
    return [...this.#eigen.values()].map((e) => e.actuator);
  }

  stand(id: string): StekkerZonStand {
    const s = this.#d.stekkers().find((x) => x.id === id);
    const rust = this.#rust.get(id) ?? null;
    return {
      schakelt: this.#d.aan() && s?.mag === true && this.#d.opZon().has(id),
      vanSunArc: this.#eigen.has(id),
      rustTot: rust != null && rust > this.#nu() ? rust : null,
    };
  }

  /** Bij elk besluit: wat de regeling bij een stekker zegt, echt doen. Geeft terug wat er geschakeld is. */
  async opBesluit(lijst: readonly HeatStoreExplanation[] | undefined): Promise<string[]> {
    await this.#laad();
    const nu = this.#nu();
    const gedaan: string[] = [];
    let veranderd = false;
    for (const [id, tot] of this.#rust) {
      if (tot <= nu) {
        this.#rust.delete(id);
        veranderd = true;
      }
    }
    const stekkers = this.#d.stekkers();
    const opZon = this.#d.opZon();
    const hand = this.#d.metDeHand();
    for (const e of lijst ?? []) {
      const s = stekkers.find((x) => x.id === e.id);
      if (!s) continue;
      if (hand.has(s.id)) continue;
      const staat = aanUit(this.#d.state(s.actuator));
      if (staat == null) continue;
      const eigen = this.#eigen.get(s.id);
      // Iemand zette hem uit nadat SunArc hem aanzette: tot middernacht met rust.
      if (eigen && !staat && nu - eigen.sinds > NA_SCHAKELEN_MS && nu - (this.#laatst.get(s.id) ?? 0) > NA_SCHAKELEN_MS) {
        this.#eigen.delete(s.id);
        this.#rust.set(s.id, nextLocalTime(nu, '00:00', this.#d.tijdzone?.() ?? 'Europe/Amsterdam'));
        veranderd = true;
        this.#d.write?.(`[stekker op zon] ${s.actuator} zelf uitgezet: tot middernacht met rust`);
        continue;
      }
      const mag = this.#d.aan() && s.mag && opZon.has(s.id);
      const rustig = nu - (this.#laatst.get(s.id) ?? 0) >= NIET_SNEL_MS;
      // Niet meer toegelaten of niet meer op zon: wat SunArc aanzette, gaat uit.
      const uit = eigen && staat && (!mag || e.state === 'waiting');
      if (uit && (rustig || !mag)) {
        if (!this.#d.aan()) continue;
        if (await this.#schakel(s.actuator, false, s.id, nu)) {
          this.#eigen.delete(s.id);
          veranderd = true;
          gedaan.push(`${s.actuator} uit`);
        }
        continue;
      }
      if (!mag || eigen || staat || this.#rust.has(s.id) || !rustig) continue;
      if (e.state !== 'would_heat') continue;
      if (await this.#schakel(s.actuator, true, s.id, nu)) {
        this.#eigen.set(s.id, { actuator: s.actuator, sinds: nu });
        veranderd = true;
        gedaan.push(`${s.actuator} aan${e.reason === 'ready_by' ? ' voor zijn minimum' : ' op zon'}`);
      }
    }
    if (veranderd) await this.#bewaar();
    return gedaan;
  }

  async #schakel(actuator: string, aan: boolean, id: string, nu: number): Promise<boolean> {
    this.#laatst.set(id, nu);
    try {
      await this.#d.schakel(actuator, aan);
      return true;
    } catch (e) {
      this.#d.write?.(`[stekker op zon] ${actuator} ${aan ? 'aan' : 'uit'} lukte niet: ${(e as Error).message}`);
      return false;
    }
  }

  async #laad(): Promise<void> {
    if (this.#geladen) return;
    this.#geladen = true;
    if (this.#d.map == null) return;
    try {
      const j = JSON.parse(await readFile(join(this.#d.map, STEKKERZON_BESTAND), 'utf8')) as { eigen?: unknown; rust?: unknown };
      for (const [id, v] of Object.entries(typeof j.eigen === 'object' && j.eigen != null ? j.eigen : {})) {
        const e = v as { actuator?: unknown; sinds?: unknown };
        if (typeof e?.actuator === 'string' && e.actuator.startsWith('switch.') && typeof e.sinds === 'number') this.#eigen.set(id, { actuator: e.actuator, sinds: e.sinds });
      }
      for (const [id, v] of Object.entries(typeof j.rust === 'object' && j.rust != null ? j.rust : {})) {
        if (typeof v === 'number' && Number.isFinite(v)) this.#rust.set(id, v);
      }
    } catch {
      // Nog niets bewaard.
    }
  }

  async #bewaar(): Promise<void> {
    if (this.#d.map == null) return;
    const pad = join(this.#d.map, STEKKERZON_BESTAND);
    const inhoud = { versie: 1, eigen: Object.fromEntries(this.#eigen), rust: Object.fromEntries(this.#rust) };
    await writeFile(`${pad}.tmp`, `${JSON.stringify(inhoud, null, 2)}\n`);
    await rename(`${pad}.tmp`, pad);
  }
}
