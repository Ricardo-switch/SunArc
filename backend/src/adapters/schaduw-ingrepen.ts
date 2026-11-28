/**
 * Herkent in de schaduw dat de bewoner zelf een apparaat bijstelt (besluit 355).
 *
 * Besluit 74 zegt: wie zelf ingrijpt, wordt met rust gelaten tot het volgende
 * dagdeel. De herkenner daarvoor (`override-detector.ts`) vergelijkt het
 * apparaat met de laatste opdracht van SunArc, en in de schaduw gaat er geen
 * opdracht uit. Dus herkende de schaduw niets, en zette hij in zijn eigen
 * boekhouding gewoon 20 graden terug als iemand de Nest op 21 had gezet. In de
 * voorproef van november stond de Nest zo 30% van de dagtijd hoger dan SunArc
 * hem zou houden, en leek SunArc 0,6 graden kouder dan hij werkelijk zou zijn.
 *
 * In de schaduw stuurt de oude regeling de apparaten. Die doet dat vanuit
 * automatiseringen en scripts in Home Assistant, en zo'n opdracht heeft geen
 * gebruiker. Een bewoner aan het apparaat zelf geeft in Home Assistant geen
 * opdracht; een bewoner in een dashboard of in de app geeft er een met zijn
 * gebruiker. Daarom: verandert de stand van een apparaat zonder dat er kort
 * daarvoor een opdracht uit een automatisering voor kwam, dan stelde iemand
 * hem zelf bij.
 *
 * Wat er dan gebeurt, is wat besluit 74 voor echt schakelen zegt:
 * - Het apparaat telt als overgenomen tot het volgende dagdeel; de arbiter laat
 *   het met rust (`SystemState.residentOverrides`).
 * - De eigen boekhouding van de schaduw krijgt de stand van de bewoner, en
 *   houdt die vast, ook als de oude regeling hem intussen verandert. Zo had
 *   SunArc het apparaat laten staan.
 * - Zet de bewoner het apparaat zelf uit, dan is de ingreep voorbij en gaat de
 *   regeling verder vanaf uit (49b).
 * Een nieuwe bijstelling tijdens een ingreep geldt als nieuwe stand en begint
 * de tijd opnieuw.
 *
 * Wat dit niet ziet: een apparaat dat uit zichzelf een andere stand kiest
 * (een eigen schema in de Nest), telt als de bewoner. En stelt iemand het
 * apparaat bij binnen drie minuten na een opdracht van de oude regeling, dan
 * telt dat als de regeling. Beide zijn zeldzaam en zichtbaar in het logboek.
 */

import type { SiteConfig } from '../core/model.js';
import { overrideEndMs } from '../core/override.js';
import type { DeviceSetting, ResidentOverride } from '../core/override.js';

/** Zo lang na een opdracht van de oude regeling hoort een nieuwe stand bij die opdracht. */
export const OPDRACHT_VENSTER_MS = 3 * 60_000;

/** Kleinere verschillen in setpoint zijn afronding, geen bijstelling. */
const SETPOINT_MARGE_C = 0.25;

/** Een lopende ingreep: tot wanneer, en de stand die de bewoner koos. */
export interface SchaduwIngreep extends ResidentOverride {
  readonly stand: DeviceSetting;
}

/** Wat een waarneming betekende, voor het logboek. */
export type IngreepUitkomst =
  | { readonly soort: 'begint' | 'bijgesteld'; readonly ingreep: SchaduwIngreep }
  | { readonly soort: 'uitgezet' };

function zelfde(a: DeviceSetting, b: DeviceSetting): boolean {
  if (a.action !== b.action) return false;
  if (a.action === 'off') return true;
  if (a.setpointC == null || b.setpointC == null) return a.setpointC === b.setpointC;
  return Math.abs(a.setpointC - b.setpointC) < SETPOINT_MARGE_C;
}

export class SchaduwIngrepen {
  readonly #config: () => Pick<SiteConfig, 'timezone' | 'schedule'>;
  /** De laatst geziene stand van elk echt apparaat. */
  readonly #gezien = new Map<string, DeviceSetting>();
  /** Wanneer de oude regeling voor het laatst een opdracht gaf, per apparaat. */
  readonly #opdracht = new Map<string, number>();
  #ingrepen = new Map<string, SchaduwIngreep>();

  constructor(config: () => Pick<SiteConfig, 'timezone' | 'schedule'>) {
    this.#config = config;
  }

  /** Na (her)verbinden: de volgende stand is weer een beginpunt. */
  vergeetStanden(): void {
    this.#gezien.clear();
  }

  /** Een opdracht uit een automatisering of script voor dit apparaat. */
  opdracht(actuatorId: string, atMs: number): void {
    this.#opdracht.set(actuatorId, atMs);
  }

  /**
   * Een nieuwe stand van het echte apparaat; null als hij nu onbekend is.
   *
   * De eerste stand na het opstarten, en de eerste na een onbekende stand, is
   * alleen een beginpunt: daar valt niets aan te zien.
   */
  zie(actuatorId: string, stand: DeviceSetting | null, atMs: number): IngreepUitkomst | null {
    this.#verloop(actuatorId, atMs);
    const vorige = this.#gezien.get(actuatorId);
    if (stand == null) {
      this.#gezien.delete(actuatorId);
      return null;
    }
    this.#gezien.set(actuatorId, stand);
    if (vorige == null || zelfde(vorige, stand)) return null;

    const opdracht = this.#opdracht.get(actuatorId);
    if (opdracht != null && atMs - opdracht <= OPDRACHT_VENSTER_MS) return null;

    // Zelf uitgezet: geen ingreep (meer); de regeling gaat verder vanaf uit.
    if (stand.action === 'off') {
      this.#ingrepen.delete(actuatorId);
      return { soort: 'uitgezet' };
    }
    const lopend = this.#ingrepen.get(actuatorId);
    const ingreep: SchaduwIngreep = {
      sinceMs: lopend?.sinceMs ?? atMs,
      untilMs: overrideEndMs('nextDayPart', atMs, this.#config()),
      stand,
    };
    this.#ingrepen.set(actuatorId, ingreep);
    return { soort: lopend ? 'bijgesteld' : 'begint', ingreep };
  }

  /** De lopende ingreep op dit apparaat, of null. */
  ingreep(actuatorId: string, nowMs: number): SchaduwIngreep | null {
    this.#verloop(actuatorId, nowMs);
    return this.#ingrepen.get(actuatorId) ?? null;
  }

  /** De ingrepen die nu gelden, voor `SystemState.residentOverrides`. */
  overrides(nowMs: number): Readonly<Record<string, ResidentOverride>> {
    const uit: Record<string, ResidentOverride> = {};
    for (const id of [...this.#ingrepen.keys()]) {
      const i = this.ingreep(id, nowMs);
      if (i) uit[id] = { sinceMs: i.sinceMs, untilMs: i.untilMs };
    }
    return uit;
  }

  #verloop(actuatorId: string, nowMs: number): void {
    const i = this.#ingrepen.get(actuatorId);
    if (i && i.untilMs != null && i.untilMs <= nowMs) this.#ingrepen.delete(actuatorId);
  }

  /** Om te bewaren over een herstart heen (besluit 62). */
  snapshot(): Record<string, SchaduwIngreep> {
    return Object.fromEntries(this.#ingrepen);
  }

  restore(saved: Readonly<Record<string, SchaduwIngreep>>): void {
    this.#ingrepen = new Map(Object.entries(saved));
  }
}
