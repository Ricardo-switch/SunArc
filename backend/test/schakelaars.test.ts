import { describe, expect, it } from 'vitest';
import type { HaEntityState } from '../src/adapters/homeassistant/client.js';
import type { HaDevice, HaRegistryEntity } from '../src/adapters/homeassistant/discovery.js';
import { GEEN_KEUZES, lampSchakelaars, leesSchakelaarKeuze, metKeuze, schakelaarViews, schakelaarsMag, vindSchakelaars } from '../src/web/schakelaars.js';

/*
 * Schakelaars (besluit 297), met wat er in een echt huis stond (11 november
 * 2026): een IR-afstandsbediening met zes knoppen waarvan twee een code
 * hebben, een Tuya-schakelaar in de muur, een Shelly 1 mini en klik-aan-klik-uit
 * via RFXCOM; en wat geen apparaat is: Adaptive Lighting, AdGuard, het kinderslot
 * van de droger, de knop van de Zigbee-brug en een radiatorknop.
 */
const devices: HaDevice[] = [
  { id: 'ir', area_id: null, name: 'Heater tuinhuis', manufacturer: 'HOBEIAN', model: 'Smart IR remote switch' },
  { id: 'spiegel', area_id: 'badkamer', name: 'Spiegel badkamer', manufacturer: 'Tuya', model: 'Aubess Smart Switch 1-gang' },
  { id: 'shelly', area_id: 'schuur', name: 'Shelly 1 mini Gen3', manufacturer: 'Shelly', model: 'Shelly 1 Mini Gen3' },
  { id: 'kaku', area_id: null, name: 'AC 0x01a2b3c4:1', model: 'AC' },
  { id: 'al', area_id: null, name: 'Adaptive Lighting Woonkamer' },
  { id: 'adguard', area_id: null, name: 'AdGuard Home' },
  { id: 'droger', area_id: 'wasruimte', name: 'Droger', manufacturer: 'Bosch', model: 'WTX87MWIN' },
  { id: 'brug', area_id: null, name: 'Zigbee2MQTT Bridge', model: 'Bridge' },
  { id: 'trv', area_id: 'zolder', name: 'Sonoff thermostaat', model: 'SONOFF Zigbee thermostatic radiator valve' },
  { id: 'plug', area_id: 'tuinhuis', name: 'Smart plug verwarming tuinhuis', model: 'Zigbee smart plug' },
];
const e = (entity_id: string, device_id: string, platform: string, extra: Partial<HaRegistryEntity> = {}): HaRegistryEntity => ({ entity_id, device_id, platform, ...extra });
const entities: HaRegistryEntity[] = [
  ...[1, 2, 3, 4, 5, 6].map((n) => e(`switch.heater_tuinhuis_switch${n}`, 'ir', 'mqtt')),
  ...[1, 2, 3, 4, 5, 6].map((n) => e(`select.heater_tuinhuis_switch${n}_on`, 'ir', 'mqtt')),
  e('infrared.heater_tuinhuis_ir_emitter', 'ir', 'mqtt'),
  e('sensor.heater_tuinhuis_temperature', 'ir', 'mqtt'),
  e('switch.spiegel_badkamer_schakelaar_1', 'spiegel', 'tuya'),
  e('switch.shelly1minig3_schuur', 'shelly', 'shelly'),
  e('switch.ac_0x01a2b3c4_1', 'kaku', 'rfxtrx'),
  e('switch.adaptive_lighting_woonkamer', 'al', 'adaptive_lighting'),
  e('switch.adguard_protection', 'adguard', 'adguard'),
  e('switch.droger_kinderslot', 'droger', 'home_connect'),
  e('switch.zigbee2mqtt_bridge_permit_join', 'brug', 'mqtt'),
  e('climate.sonoff_thermostaat', 'trv', 'mqtt'),
  e('switch.sonoff_thermostaat_child_lock', 'trv', 'mqtt', { entity_category: 'config' }),
  e('switch.smart_plug_verwarming_tuinhuis', 'plug', 'mqtt'),
  e('sensor.smart_plug_verwarming_tuinhuis_power', 'plug', 'mqtt', { device_class: 'power' }),
];
const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): [string, HaEntityState] => [entity_id, { entity_id, state, attributes, last_changed: '', last_updated: '' } as HaEntityState];
const states = new Map<string, HaEntityState>([
  ...entities.map((x) => st(x.entity_id, x.entity_id.startsWith('switch.') ? 'off' : '1')),
  ...[1, 2, 3, 4, 5, 6].map((n) => st(`select.heater_tuinhuis_switch${n}_on`, n <= 2 ? 'registered' : 'unregistered')),
  st('switch.ac_0x01a2b3c4_1', 'on', { assumed_state: true }),
]);

describe('schakelaars vinden (besluit 297)', () => {
  const gevonden = vindSchakelaars(states, entities, devices, new Set(['switch.smart_plug_verwarming_tuinhuis']));
  const op = (id: string) => gevonden.find((g) => g.id === id);

  it('vindt de echte schakelaars, en niets wat software, een instelling of al bekend is', () => {
    expect(gevonden.map((g) => g.id).sort()).toEqual(['ir', 'kaku', 'shelly', 'spiegel']);
  });

  it('geeft bij een IR-afstandsbediening alleen de knoppen met een code', () => {
    expect(op('ir')!.knoppen.map((k) => k.id)).toEqual(['switch.heater_tuinhuis_switch1', 'switch.heater_tuinhuis_switch2']);
    expect(op('ir')!.zonderCode).toBe(4);
    expect(op('ir')!.ir).toBe(true);
    expect(op('ir')!.aanname).toBe(true);
  });

  it('weet dat klik-aan-klik-uit zijn stand niet terugzegt, en een Shelly wel', () => {
    expect(op('kaku')!.aanname).toBe(true);
    expect(op('kaku')!.knoppen[0]!.aan).toBe(true);
    expect(op('shelly')!.aanname).toBe(false);
    expect(op('shelly')!.meet).toBeNull();
    expect(op('shelly')!.gebied).toBe('schuur');
  });

  it('bewaart een keuze, maakt van een lamp een lamp in zijn kamer, en laat alleen met de hand toe wat mag', () => {
    const lamp = leesSchakelaarKeuze({ id: 'shelly', wat: 'lamp', naam: 'Lamp schuur', kamer: 'schuur', mag: 'hand' });
    const kachel = leesSchakelaarKeuze({ id: 'ir', wat: 'kachel', naam: 'Kachel tuinhuis', kamer: null, mag: 'kijken', knoppen: { 'switch.heater_tuinhuis_switch1': 'Aan en uit' } });
    expect(lamp.ok && kachel.ok).toBe(true);
    if (!lamp.ok || !kachel.ok) return;
    let k = metKeuze(GEEN_KEUZES, lamp.id, lamp.keuze);
    k = metKeuze(k, kachel.id, kachel.keuze);
    k = metKeuze(k, 'spiegel', 'geen');
    expect(lampSchakelaars(gevonden, k)).toEqual([{ id: 'switch.shelly1minig3_schuur', naam: 'Lamp schuur', kamer: 'schuur', gebied: 'schuur', via: 'Shelly 1 Mini Gen3' }]);
    expect(schakelaarsMag(gevonden, k)).toEqual(['switch.shelly1minig3_schuur']);
    expect(schakelaarViews(gevonden, k).map((v) => v.id).sort()).toEqual(['ir', 'kaku', 'shelly']);
    expect(schakelaarViews(gevonden, k).find((v) => v.id === 'ir')!.keuze!.knoppen).toEqual({ 'switch.heater_tuinhuis_switch1': 'Aan en uit' });
    // Weg haalt de keuze weg, ook "geen apparaat".
    expect(metKeuze(k, 'spiegel', 'weg').geen).toEqual([]);
  });

  it('weigert een keuze die niet klopt', () => {
    expect(leesSchakelaarKeuze({ id: 'shelly', wat: 'raket' }).ok).toBe(false);
    expect(leesSchakelaarKeuze({ id: 'shelly', wat: 'lamp', mag: 'alles' }).ok).toBe(false);
    expect(leesSchakelaarKeuze({ id: 'shelly', wat: 'lamp', knoppen: { 'light.x': 'a' } }).ok).toBe(false);
    expect(leesSchakelaarKeuze({ id: '../etc', wat: 'lamp' }).ok).toBe(false);
  });
});
