/**
 * Een fase uit het vermogen (23 november 2026). Een HomeWizard P1 zet zijn
 * stroom per fase in Home Assistant standaard uit, het vermogen per fase niet:
 * bij de ouders van Ricardo zag SunArc daardoor geen enkele fase. Nu telt het
 * vermogen op die fase als er geen stroommeter is, en kiest de bewoner per fase
 * zelf een meter.
 */

import { describe, expect, it } from 'vitest';

import type { HaEntityState } from '../src/adapters/homeassistant/client.js';
import { buildSystemState } from '../src/adapters/homeassistant/mapping.js';
import { parseSiteConfig } from '../src/config/schema.js';
import type { SiteConfig } from '../src/core/model.js';
import { fasenMetKeuze, findPhaseMeters, findPhases, validateConnection } from '../src/web/aansluiting.js';
import { fasenView } from '../src/web/fasen.js';
import { defaultStrategies } from '../src/index.js';
import { exampleSite } from './site.js';

function st(entity_id: string, state: string, attributes: Record<string, unknown> = {}): HaEntityState {
  return { entity_id, state, attributes, last_changed: '', last_updated: '' };
}

/** Zoals bij de ouders: het vermogen per fase, de stroom staat uit; en de laadpaal met zijn eigen stroom per fase. */
const OUDERS = [
  st('sensor.meterkast_p1_meter_vermogen', '944', { device_class: 'power', unit_of_measurement: 'W', friendly_name: 'P1 Meter Vermogen' }),
  ...[1, 2, 3].map((n) => st(`sensor.meterkast_p1_meter_vermogen_fase_${n}`, String([895, 22, 27][n - 1]), { device_class: 'power', unit_of_measurement: 'W', friendly_name: `P1 Meter Vermogen fase ${n}` })),
  ...[1, 2, 3].map((n) => st(`sensor.meterkast_p1_meter_spanningsdips_gedetecteerd_fase_${n}`, '1', { friendly_name: `P1 Meter Spanningsdips gedetecteerd fase ${n}` })),
  ...[1, 2, 3].map((n) => st(`sensor.oprit_laadpaal_stroom_fase${n}`, '0.02', { device_class: 'current', unit_of_measurement: 'A', friendly_name: `Laadpaal Stroom fase${n}` })),
  ...[1, 2, 3].map((n) => st(`sensor.meterkast_zaptec_sense_beschikbare_stroom_fase${n}`, '25', { device_class: 'current', unit_of_measurement: 'A', friendly_name: `Zaptec sense Beschikbare stroom fase${n}` })),
];

describe('een fase uit het vermogen', () => {
  it('neemt het vermogen per fase van de netmeter als er geen stroommeter is, niet de laadpaal', () => {
    expect(findPhases(OUDERS)).toEqual([1, 2, 3].map((n) => ({ id: `L${n}`, power: `sensor.meterkast_p1_meter_vermogen_fase_${n}` })));
  });

  it('een stroommeter op de netmeter gaat voor het vermogen', () => {
    const met = [...OUDERS, st('sensor.p1_meter_stroom_fase_1', '3.9', { device_class: 'current', unit_of_measurement: 'A', friendly_name: 'P1 Meter Stroom fase 1' })];
    expect(findPhases(met)[0]).toEqual({ id: 'L1', current: 'sensor.p1_meter_stroom_fase_1' });
  });

  it('noemt per fase alle meters om uit te kiezen, die van de netmeter eerst', () => {
    const lijst = findPhaseMeters(OUDERS);
    expect(lijst.filter((m) => m.fase === 1).map((m) => [m.id, m.eenheid])).toEqual([
      ['sensor.meterkast_p1_meter_vermogen_fase_1', 'W'],
      ['sensor.oprit_laadpaal_stroom_fase1', 'A'],
      ['sensor.meterkast_zaptec_sense_beschikbare_stroom_fase1', 'A'],
    ]);
    // De dalen en pieken van de spanning zijn geen meter.
    expect(lijst.some((m) => /spanningsdips/.test(m.id))).toBe(false);
    expect(lijst.find((m) => m.id === 'sensor.meterkast_p1_meter_vermogen_fase_1')?.waarde).toBe(895);
  });

  it('de keuze van de bewoner gaat voor; een meter die weg is, telt niet', () => {
    const meters = findPhaseMeters(OUDERS);
    const gevonden = findPhases(OUDERS);
    expect(fasenMetKeuze(gevonden, { L2: 'sensor.oprit_laadpaal_stroom_fase2' }, meters)[1]).toEqual({ id: 'L2', current: 'sensor.oprit_laadpaal_stroom_fase2' });
    expect(fasenMetKeuze(gevonden, { L1: 'sensor.bestaat_niet' }, meters)[0]).toEqual(gevonden[0]);
  });

  it('bewaart de keuze per fase, en weigert een meter van een andere fase', () => {
    const found = { fasen: findPhases(OUDERS), apparaten: [], faseMeters: findPhaseMeters(OUDERS) };
    const goed = validateConnection({ panelen: { ligging: null }, zekering: { fasen: 3, ampere: 25 }, faseKeuze: { L3: 'sensor.oprit_laadpaal_stroom_fase3' } }, found);
    expect(goed.ok).toBe(true);
    if (!goed.ok) return;
    expect(goed.answers.faseKeuze).toEqual({ L3: 'sensor.oprit_laadpaal_stroom_fase3' });
    expect(goed.answers.fasen.map((f) => f.current ?? f.power)).toEqual(['sensor.meterkast_p1_meter_vermogen_fase_1', 'sensor.meterkast_p1_meter_vermogen_fase_2', 'sensor.oprit_laadpaal_stroom_fase3']);
    const fout = validateConnection({ panelen: { ligging: null }, zekering: { fasen: 3, ampere: 25 }, faseKeuze: { L1: 'sensor.oprit_laadpaal_stroom_fase2' } }, found);
    expect(fout.ok).toBe(false);
    // Leeg is weer wat de dienst vond.
    const leeg = validateConnection({ panelen: { ligging: null }, zekering: { fasen: 3, ampere: 25 }, faseKeuze: { L3: '' } }, found, goed.answers);
    expect(leeg.ok && leeg.answers.faseKeuze).toBe(undefined);
  });
});

describe('de configuratie en de regeling met een fase in W', () => {
  const metFasen = (phases: unknown[]) => parseSiteConfig({ ...(JSON.parse(JSON.stringify(exampleSite)) as Record<string, unknown>), grid: { phases, marginA: 2 } }, { knownStrategies: defaultStrategies().ids });

  it('neemt power in plaats van current aan, maar niet allebei of geen van beide', () => {
    const goed = metFasen([{ id: 'L1', power: 'sensor.p1_vermogen_fase_1', maxA: 25 }]);
    expect(goed.ok).toBe(true);
    if (goed.ok) expect(goed.config.grid?.phases[0]).toMatchObject({ id: 'L1', power: { id: 'sensor.p1_vermogen_fase_1' }, maxA: 25 });
    expect(metFasen([{ id: 'L1', current: 'sensor.a', power: 'sensor.w', maxA: 25 }]).ok).toBe(false);
    expect(metFasen([{ id: 'L1', maxA: 25 }]).ok).toBe(false);
  });

  it('rekent de stroom uit het vermogen: |W| / V, en 230 V zonder spanningsmeter', () => {
    const r = metFasen([
      { id: 'L1', power: 'sensor.w1', maxA: 25 },
      { id: 'L2', power: 'sensor.w2', voltage: 'sensor.v2', maxA: 25 },
      { id: 'L3', current: 'sensor.a3', maxA: 25 },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const getallen: Record<string, number> = { 'sensor.w1': 2300, 'sensor.w2': -1150, 'sensor.v2': 230, 'sensor.a3': 4 };
    const bron = {
      state: () => null,
      number: (id: string) => getallen[id] ?? null,
      bool: () => null,
      attr: () => null,
      attrNumber: () => null,
      changedAt: () => null,
      hvacAction: () => null,
      hvacActionSince: () => null,
    };
    const fasen = buildSystemState(r.config as SiteConfig, bron, Date.UTC(2026, 10, 23, 12)).power.phases!;
    expect(fasen['L1']!.currentA).toMatchObject({ ok: true, value: 10 });
    expect(fasen['L2']!.currentA).toMatchObject({ ok: true, value: 5 });
    expect(fasen['L3']!.currentA).toMatchObject({ ok: true, value: 4 });
  });

  it('de fasekaart zet de dag van een meter in W om naar A', () => {
    const START = Date.UTC(2026, 10, 23);
    const v = fasenView({
      grid: { phases: [{ id: 'L1', current: 'sensor.w1', watt: true, maxA: 25 }], marginA: 2 },
      nu: [{ id: 'L1', currentA: 4, bron: 'gemeten' }],
      historie: new Map([['sensor.w1', [{ ms: START + 60_000, a: 2300 }]]]),
      dagStartMs: START,
      nuMs: START + 30 * 60_000,
      zekering: null,
      netW: null,
    });
    expect(v.meters && v.fasen[0]!.piekA).toBe(10);
  });
});
