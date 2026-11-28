/**
 * De avond verlengen (besluit 356): alleen een lamp die al brandde voor de
 * nacht begon, houdt het dag, en hooguit tot drie uur.
 */

import { describe, expect, it } from 'vitest';

import { scheduledMode } from '../src/core/context.js';
import type { SystemState } from '../src/core/state.js';
import { unavailable, value } from '../src/core/state.js';
import { exampleSite } from './site.js';

// Zaterdag 28 november 2026, wintertijd: Amsterdam is UTC+1.
const om = (hhmm: string, dag = 28) => Date.parse(`2026-11-${String(dag).padStart(2, '0')}T${hhmm}:00+01:00`);

function modus(nu: number, lampen: SystemState['lights']) {
  return scheduledMode(exampleSite, { nowMs: nu, lights: lampen } as SystemState, true);
}

describe('de avond verlengen (besluit 356)', () => {
  it('een lamp die om tien uur nog brandt, houdt het dag', () => {
    expect(modus(om('23:30', 27), { 'light.sfeerverlichting': value(true, om('19:00', 27)) })).toBe('dag');
  });

  it('is nacht zodra alle lampen uit zijn', () => {
    expect(modus(om('23:30', 27), { 'light.sfeerverlichting': value(false, om('23:10', 27)) })).toBe('nacht');
  });

  it('een lamp die later weer aangaat, haalt de dag niet terug', () => {
    expect(modus(om('23:30', 27), { 'light.sfeerverlichting': value(true, om('23:20', 27)) })).toBe('nacht');
  });

  it('vroeg in de ochtend het licht aan is geen dag (zoals om 05:45 voor een vroege dienst)', () => {
    expect(modus(om('05:46'), { 'light.sfeerverlichting': value(true, om('05:45')) })).toBe('nacht');
  });

  it('hooguit tot drie uur, ook als de lamp blijft branden', () => {
    const lamp = { 'light.woonkamer_plafonniere': value(true, om('21:00', 27)) };
    expect(modus(om('02:59'), lamp)).toBe('dag');
    expect(modus(om('03:00'), lamp)).toBe('nacht');
  });

  it('één lamp van voor de nacht is genoeg, ook als een andere later aanging', () => {
    expect(
      modus(om('00:15'), {
        'light.sfeerverlichting': value(true, om('00:05')),
        'light.woonkamer_plafonniere': value(true, om('20:00', 27)),
      }),
    ).toBe('dag');
  });

  it('een lamp waarvan onbekend is wanneer hij aanging, of die onbekend is, verlengt niet', () => {
    expect(modus(om('23:30', 27), { 'light.sfeerverlichting': value(true, 0) })).toBe('nacht');
    expect(modus(om('23:30', 27), { 'light.sfeerverlichting': unavailable<boolean>() })).toBe('nacht');
  });

  it('overdag en bij voorverwarmen verandert er niets', () => {
    expect(modus(om('06:30'), { 'light.sfeerverlichting': value(true, om('06:10')) })).toBe('voorverwarmen');
    expect(modus(om('12:00'), {})).toBe('dag');
  });
});
