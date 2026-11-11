import { describe, expect, it } from 'vitest';
import type { HaEntityState } from '../src/adapters/homeassistant/client.js';
import type { HaDevice, HaRegistryEntity } from '../src/adapters/homeassistant/discovery.js';
import { ladenView, metLosseLaadpalen } from '../src/web/opslag.js';
import { GEEN_KEUZES, leesLosseLaadpaal, losseSensoren, metLaadpaal } from '../src/web/schakelaars.js';

/*
 * Een laadpaal uit losse sensoren (besluit 301, issue 160): een NexBlue Edge Max
 * via Modbus heeft in Home Assistant geen apparaat, alleen sensoren.
 */
const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): [string, HaEntityState] => [entity_id, { entity_id, state, attributes, last_changed: '', last_updated: '' } as HaEntityState];
const states = new Map<string, HaEntityState>([
  st('sensor.nexblue_power', '1400', { unit_of_measurement: 'W', device_class: 'power' }),
  st('sensor.nexblue_current_l1', '6', { unit_of_measurement: 'A', device_class: 'current' }),
  st('sensor.nexblue_energy_total', '1284', { unit_of_measurement: 'kWh', device_class: 'energy' }),
  st('sensor.nexblue_charging_state', 'Charging', {}),
  st('sensor.buiten', '7', { unit_of_measurement: '°C', device_class: 'temperature' }),
  st('sensor.p1_vermogen', '300', { unit_of_measurement: 'W', device_class: 'power' }),
]);
const entities: HaRegistryEntity[] = [
  { entity_id: 'sensor.nexblue_power', device_id: null, platform: 'modbus' },
  { entity_id: 'sensor.nexblue_current_l1', device_id: null, platform: 'modbus' },
  { entity_id: 'sensor.nexblue_energy_total', device_id: null, platform: 'modbus' },
  { entity_id: 'sensor.buiten', device_id: null, platform: 'buienradar' },
  // Op een apparaat: geen losse sensor.
  { entity_id: 'sensor.p1_vermogen', device_id: 'p1', platform: 'homewizard' },
];
const devices: HaDevice[] = [{ id: 'p1', area_id: null, name: 'P1-meter' }];

describe('een laadpaal uit losse sensoren (besluit 301)', () => {
  it('geeft de sensoren zonder apparaat met hun soort, ook als ze niet in de registers staan', () => {
    const s = losseSensoren(entities, states);
    expect(s.map((x) => [x.id, x.soort])).toEqual([
      ['sensor.nexblue_charging_state', 'stand'],
      ['sensor.nexblue_current_l1', 'stroom'],
      ['sensor.nexblue_energy_total', 'energie'],
      ['sensor.nexblue_power', 'vermogen'],
    ]);
  });

  it('toont een Modbus-register zonder eenheid ook, als ander getal (melding 164)', () => {
    const met = new Map(states);
    met.set('sensor.nexblue_register_40100', { entity_id: 'sensor.nexblue_register_40100', state: '2', attributes: {}, last_changed: '', last_updated: '' } as never);
    expect(losseSensoren(entities, met).find((x) => x.id === 'sensor.nexblue_register_40100')?.soort).toBe('overig');
    // Een temperatuur heeft een eenheid: dat is geen laadpaal, die blijft weg.
    expect(losseSensoren(entities, met).some((x) => x.id === 'sensor.buiten')).toBe(false);
  });

  it('maakt er een laadpaal van die Energie › Auto en laadpaal kent', () => {
    const l = leesLosseLaadpaal({ id: 'losse-nexblue', naam: 'NexBlue Edge Max', sensoren: ['sensor.nexblue_power', 'sensor.nexblue_current_l1', 'sensor.nexblue_charging_state'] });
    expect(l.ok).toBe(true);
    if (!l.ok || l.laadpaal === 'weg') return;
    const keuzes = metLaadpaal(GEEN_KEUZES, l.id, l.laadpaal);
    const reg = metLosseLaadpalen({ devices, entities }, keuzes.laadpalen);
    const v = ladenView(reg, states, null);
    const paal = v.apparaten.find((a) => a.id === 'losse-nexblue');
    expect(paal).toMatchObject({ naam: 'NexBlue Edge Max', rol: 'laadpaal', aan: true });
    expect(paal!.wat).toEqual(expect.arrayContaining(['vermogen', 'stroom']));
    // Weghalen haalt hem weg.
    expect(metLaadpaal(keuzes, 'losse-nexblue', 'weg').laadpalen).toEqual({});
  });

  it('weigert wat niet klopt', () => {
    expect(leesLosseLaadpaal({ id: 'nexblue', naam: 'x', sensoren: ['sensor.a'] }).ok).toBe(false);
    expect(leesLosseLaadpaal({ id: 'losse-x', naam: '', sensoren: ['sensor.a'] }).ok).toBe(false);
    expect(leesLosseLaadpaal({ id: 'losse-x', naam: 'x', sensoren: [] }).ok).toBe(false);
    expect(leesLosseLaadpaal({ id: 'losse-x', naam: 'x', sensoren: ['switch.a'] }).ok).toBe(false);
  });
});
