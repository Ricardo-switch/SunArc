/**
 * Zelf bijstellen herkennen in de schaduw (besluit 355): een nieuwe stand zonder
 * opdracht van de oude regeling ervoor is de bewoner.
 */

import { describe, expect, it } from 'vitest';

import { klimaatOpdrachtUit } from '../src/adapters/homeassistant/client.js';
import { OPDRACHT_VENSTER_MS, SchaduwIngrepen } from '../src/adapters/schaduw-ingrepen.js';
import { parseSavedState } from '../src/adapters/state-file.js';
import { exampleSite } from './site.js';

const at = (iso: string) => Date.parse(iso);
// Zaterdag 3 oktober 2026, 14:00 in Amsterdam; de nacht begint om 22:00 (20:00 UTC).
const T0 = at('2026-10-03T12:00:00Z');
const NACHT = at('2026-10-03T20:00:00Z');
const MIN = 60_000;

const heat = (c: number) => ({ action: 'heat' as const, setpointC: c });
const off = { action: 'off' as const, setpointC: null };

function nieuw(): SchaduwIngrepen {
  return new SchaduwIngrepen(() => exampleSite);
}

describe('zelf bijstellen in de schaduw (besluit 355)', () => {
  it('de eerste stand is alleen een beginpunt', () => {
    const i = nieuw();
    expect(i.zie('nest', heat(21), T0)).toBeNull();
    expect(i.overrides(T0)).toEqual({});
  });

  it('een nieuwe stand vlak na een opdracht van de oude regeling is de regeling', () => {
    const i = nieuw();
    i.zie('nest', heat(20), T0);
    i.opdracht('nest', T0 + MIN);
    expect(i.zie('nest', heat(19), T0 + MIN + 5_000)).toBeNull();
    expect(i.overrides(T0 + 2 * MIN)).toEqual({});
  });

  it('een nieuwe stand zonder opdracht is de bewoner, tot het volgende dagdeel', () => {
    const i = nieuw();
    i.zie('nest', heat(20), T0);
    const u = i.zie('nest', heat(20.9), T0 + 10 * MIN);
    expect(u).toEqual({ soort: 'begint', ingreep: { sinceMs: T0 + 10 * MIN, untilMs: NACHT, stand: heat(20.9) } });
    expect(i.overrides(T0 + 11 * MIN)).toEqual({ nest: { sinceMs: T0 + 10 * MIN, untilMs: NACHT } });
    // Op het volgende dagdeel is hij voorbij.
    expect(i.overrides(NACHT)).toEqual({});
    expect(i.ingreep('nest', NACHT)).toBeNull();
  });

  it('een opdracht van lang geleden telt niet meer', () => {
    const i = nieuw();
    i.zie('nest', heat(20), T0);
    i.opdracht('nest', T0);
    expect(i.zie('nest', heat(21), T0 + OPDRACHT_VENSTER_MS + 1)?.soort).toBe('begint');
  });

  it('afronding is geen bijstelling', () => {
    const i = nieuw();
    i.zie('nest', heat(20), T0);
    expect(i.zie('nest', heat(20.1), T0 + MIN)).toBeNull();
  });

  it('houdt de stand van de bewoner vast als de oude regeling hem intussen verzet', () => {
    const i = nieuw();
    i.zie('nest', heat(20), T0);
    i.zie('nest', heat(21), T0 + MIN);
    i.opdracht('nest', T0 + 30 * MIN);
    expect(i.zie('nest', heat(20), T0 + 30 * MIN + 3_000)).toBeNull();
    expect(i.ingreep('nest', T0 + 31 * MIN)?.stand).toEqual(heat(21));
  });

  it('een tweede bijstelling is de nieuwe stand, en de tijd begint opnieuw', () => {
    const i = nieuw();
    i.zie('nest', heat(20), T0);
    i.zie('nest', heat(21), T0 + MIN);
    const u = i.zie('nest', heat(20.5), T0 + 20 * MIN);
    expect(u).toEqual({ soort: 'bijgesteld', ingreep: { sinceMs: T0 + MIN, untilMs: NACHT, stand: heat(20.5) } });
  });

  it('zelf uitzetten beëindigt de ingreep', () => {
    const i = nieuw();
    i.zie('nest', heat(20), T0);
    i.zie('nest', heat(21), T0 + MIN);
    expect(i.zie('nest', off, T0 + 5 * MIN)).toEqual({ soort: 'uitgezet' });
    expect(i.overrides(T0 + 6 * MIN)).toEqual({});
  });

  it('na een onbekende stand, of na herverbinden, begint het opnieuw', () => {
    const i = nieuw();
    i.zie('nest', heat(20), T0);
    i.zie('nest', null, T0 + MIN);
    expect(i.zie('nest', heat(21), T0 + 2 * MIN)).toBeNull();
    i.vergeetStanden();
    expect(i.zie('nest', heat(22), T0 + 3 * MIN)).toBeNull();
    expect(i.overrides(T0 + 3 * MIN)).toEqual({});
  });

  it('gaat mee over een herstart', () => {
    const i = nieuw();
    i.zie('nest', heat(20), T0);
    i.zie('nest', heat(21), T0 + MIN);
    const tekst = JSON.stringify({ version: 1, savedAtMs: T0, mode: null, timers: { stabilisation: { endsAtMs: null }, manualOverride: { endsAtMs: null } }, actuators: {}, ingrepen: i.snapshot() });
    const terug = parseSavedState(tekst);
    if (typeof terug === 'string') throw new Error(terug);
    const j = nieuw();
    j.restore(terug.ingrepen ?? {});
    expect(j.overrides(T0 + 2 * MIN)).toEqual({ nest: { sinceMs: T0 + MIN, untilMs: NACHT } });
  });

  it('een bestand van vóór dit besluit, of een onleesbare ingreep, is geen reden om niet te starten', () => {
    const basis = { version: 1, savedAtMs: T0, mode: null, timers: { stabilisation: { endsAtMs: null }, manualOverride: { endsAtMs: null } }, actuators: {} };
    const oud = parseSavedState(JSON.stringify(basis));
    expect(typeof oud).not.toBe('string');
    expect((oud as { ingrepen?: unknown }).ingrepen).toBeUndefined();
    const kapot = parseSavedState(JSON.stringify({ ...basis, ingrepen: { nest: { sinceMs: 'gisteren' }, ac: { sinceMs: T0, untilMs: null, stand: heat(19) } } }));
    expect(typeof kapot).not.toBe('string');
    expect((kapot as { ingrepen?: unknown }).ingrepen).toEqual({ ac: { sinceMs: T0, untilMs: null, stand: heat(19) } });
  });
});

describe('opdrachten aan klimaatapparaten lezen (besluit 355)', () => {
  const ev = (data: Record<string, unknown>, context: Record<string, unknown>) => ({ event_type: 'call_service', data, context });

  it('uit een automatisering', () => {
    expect(
      klimaatOpdrachtUit(ev({ domain: 'climate', service: 'set_temperature', service_data: { entity_id: 'climate.beneden', temperature: 19 } }, { id: 'a', parent_id: 'b', user_id: null })),
    ).toEqual({ service: 'set_temperature', entiteiten: ['climate.beneden'], doorAutomatisering: true });
  });

  it('uit een automatisering die op de klok start: geen parent_id, ook geen gebruiker', () => {
    expect(
      klimaatOpdrachtUit(ev({ domain: 'climate', service: 'set_temperature', service_data: { entity_id: 'climate.beneden', temperature: 20 } }, { id: 'a', parent_id: null, user_id: null }))?.doorAutomatisering,
    ).toBe(true);
    expect(klimaatOpdrachtUit(ev({ domain: 'climate', service: 'turn_off', service_data: { entity_id: 'climate.beneden' } }, {}))?.doorAutomatisering).toBe(true);
  });

  it('van een bewoner in een dashboard, met de entiteiten als lijst of in het doel', () => {
    expect(
      klimaatOpdrachtUit(ev({ domain: 'climate', service: 'set_hvac_mode', service_data: { entity_id: ['climate.a', 'climate.b'] }, target: { entity_id: 'climate.c' } }, { id: 'a', parent_id: null, user_id: 'u' })),
    ).toEqual({ service: 'set_hvac_mode', entiteiten: ['climate.a', 'climate.b', 'climate.c'], doorAutomatisering: false });
  });

  it('negeert alles wat geen klimaat is', () => {
    expect(klimaatOpdrachtUit(ev({ domain: 'light', service: 'turn_on', service_data: { entity_id: 'light.hal' } }, { parent_id: 'b' }))).toBeNull();
    expect(klimaatOpdrachtUit({ event_type: 'state_changed', data: {} })).toBeNull();
    expect(klimaatOpdrachtUit(ev({ domain: 'climate', service: 'reload' }, {}))).toBeNull();
  });
});
