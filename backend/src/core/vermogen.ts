/**
 * Wat een apparaat trekt, en of het terug te winnen is (besluit 178).
 */

import type { Actuator } from './model.js';

/** Wat een start van dit apparaat aan stroom trekt: het typeplaatje, anders de schatting (besluit 178). */
export function trekW(actuator: Pick<Actuator, 'power'>): number {
  return actuator.power.ratedW ?? actuator.power.estimatedW;
}

/**
 * Schakelt de regeling dit apparaat terug als de zon wegvalt (besluit 178)? Een
 * bijspringer, of een apparaat dat op zon mag; comfort laat de regeling aan.
 * Alleen hun verbruik is ruimte die terug te winnen is.
 */
export function terugschakelbaar(actuator: Pick<Actuator, 'role' | 'onSurplus'>): boolean {
  return actuator.role === 'assist' || actuator.onSurplus === true;
}

/** Wat `comfortHoudtAan` van een zone nodig heeft. */
export interface ZoneVraag {
  readonly zone: { readonly actuatorIds: readonly string[] };
  readonly demand: 'heat' | 'cool' | 'none';
  readonly heatTargetC: number | null;
  readonly coolTargetC: number | null;
}

/**
 * Houdt comfort dit apparaat nu aan (besluit 357)? Een hoofdapparaat dat ook op
 * zon mag, zoals een badkamer, verwarmt vaak gewoon omdat de kamer te koud is.
 * Dan schakelt de regeling het niet terug als de zon wegvalt, dus is zijn
 * verbruik geen ruimte voor een ander. Dezelfde regel als in comfort.
 */
export function comfortHoudtAan(
  actuator: Pick<Actuator, 'id' | 'role' | 'capabilities'>,
  zones: readonly ZoneVraag[],
): boolean {
  if (actuator.role !== 'primary') return false;
  return zones.some(
    (z) =>
      z.zone.actuatorIds.includes(actuator.id) &&
      ((z.demand === 'heat' && actuator.capabilities.canHeat && z.heatTargetC != null) ||
        (z.demand === 'cool' && actuator.capabilities.canCool && z.coolTargetC != null)),
  );
}
