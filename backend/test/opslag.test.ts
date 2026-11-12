/**
 * De thuisbatterij en de auto herkennen in Home Assistant (besluit 182): per
 * apparaat, op wat het meet en wie het levert.
 */

import { describe, expect, it } from 'vitest';

import type { HaEntityState } from '../src/adapters/homeassistant/client.js';
import type { HaDevice, HaRegistryEntity } from '../src/adapters/homeassistant/discovery.js';
import { accuView, autoApparaten, laadBedieningen, laadMeters, ladenView, leesAccu, leesLaden, vindOpslag, type AccuKeuze, type LadenKeuze } from '../src/web/opslag.js';

type Meting = { id: string; klasse?: string; staat: string; eenheid?: string; naam?: string; platform: string; apparaat: string; extra?: Record<string, unknown>; sinds?: string };

function registers(apparaten: HaDevice[], metingen: Meting[]) {
  const entities: HaRegistryEntity[] = metingen.map((m) => ({ entity_id: m.id, device_id: m.apparaat, platform: m.platform, original_device_class: m.klasse ?? null, original_name: m.naam ?? null }));
  const states = new Map<string, HaEntityState>(
    metingen.map((m) => [m.id, { entity_id: m.id, state: m.staat, attributes: { ...(m.eenheid ? { unit_of_measurement: m.eenheid } : {}), ...(m.naam ? { friendly_name: m.naam } : {}), ...(m.extra ?? {}) }, last_changed: m.sinds ?? '', last_updated: '' }]),
  );
  return { reg: { devices: apparaten, entities }, states };
}
function huis(apparaten: HaDevice[], metingen: Meting[], keuze: LadenKeuze | null = null, nu?: Date) {
  const { reg, states } = registers(apparaten, metingen);
  return vindOpslag(reg, states, keuze, nu);
}
const geenKeuze = { plek: null, paalPlek: null, accuKWh: null, laadpaal: null, paalNaam: null, paalStroomA: null, laadgrens: null, stroomA: null, volOm: null, thuis: null, kabelSinds: null, wegSinds: null, fout: null };

const knop: HaDevice = { id: 'knop', area_id: null, name: 'Knop hal', manufacturer: 'IKEA', model: 'STYRBAR' };
const knopBatterij: Meting = { id: 'sensor.knop_batterij', klasse: 'battery', staat: '80', eenheid: '%', platform: 'zha', apparaat: 'knop' };

describe('de thuisbatterij en de auto (besluit 182)', () => {
  it('vindt niets in een huis zonder, ook niet de batterij van een knop', () => {
    expect(huis([knop], [knopBatterij])).toEqual({ batterij: null, auto: null, autos: [] });
  });

  it('herkent een thuisbatterij, met laden en leveren uit het vermogen', () => {
    const sessy: HaDevice = { id: 'sessy', area_id: null, name: 'Sessy', manufacturer: 'Charged', model: 'Sessy' };
    const met = (w: string) => huis([knop, sessy], [
      knopBatterij,
      { id: 'sensor.sessy_state_of_charge', klasse: 'battery', staat: '78', eenheid: '%', platform: 'sessy', apparaat: 'sessy' },
      { id: 'sensor.sessy_power', klasse: 'power', staat: w, eenheid: 'W', naam: 'Sessy battery power', platform: 'sessy', apparaat: 'sessy' },
    ]);
    expect(met('1800').batterij).toEqual({ id: 'sessy', naam: 'De batterij', pct: 78, vermogenW: 1800, stand: 'laadt' });
    expect(met('-900').batterij).toMatchObject({ vermogenW: -900, stand: 'levert' });
    expect(met('12').batterij).toMatchObject({ stand: 'rust' });
    expect(met('unavailable').batterij).toMatchObject({ pct: 78, vermogenW: null, stand: null });
    expect(met('1800').auto).toBeNull();
  });

  it('leest apart laden en ontladen, en een Powerwall die leveren positief noemt', () => {
    const accu: HaDevice = { id: 'accu', area_id: null, name: 'Thuisbatterij', manufacturer: 'Huawei', model: 'LUNA2000' };
    const twee = huis([accu], [
      { id: 'sensor.luna_soc', klasse: 'battery', staat: '54', eenheid: '%', platform: 'huawei_solar', apparaat: 'accu' },
      { id: 'sensor.luna_charge_power', klasse: 'power', staat: '0', eenheid: 'kW', naam: 'Battery charge power', platform: 'huawei_solar', apparaat: 'accu' },
      { id: 'sensor.luna_discharge_power', klasse: 'power', staat: '0.9', eenheid: 'kW', naam: 'Battery discharge power', platform: 'huawei_solar', apparaat: 'accu' },
    ]);
    expect(twee.batterij).toMatchObject({ pct: 54, vermogenW: -900, stand: 'levert' });
    const pw: HaDevice = { id: 'pw', area_id: null, name: 'Powerwall', manufacturer: 'Tesla', model: 'Powerwall 2' };
    const powerwall = huis([pw], [
      { id: 'sensor.powerwall_charge', klasse: 'battery', staat: '90', eenheid: '%', platform: 'powerwall', apparaat: 'pw' },
      { id: 'sensor.powerwall_battery_power', klasse: 'power', staat: '1.2', eenheid: 'kW', naam: 'Powerwall Battery Power', platform: 'powerwall', apparaat: 'pw' },
    ]);
    expect(powerwall.batterij).toMatchObject({ vermogenW: -1200, stand: 'levert' });
    expect(powerwall.auto).toBeNull();
  });

  it('herkent een auto met zijn lading, bereik, stekker en laden', () => {
    const tesla: HaDevice = { id: 'tesla', area_id: null, name: 'Tesla Model 3', manufacturer: 'Tesla', model: 'Model 3' };
    const op = huis([tesla], [
      { id: 'sensor.model_3_battery', klasse: 'battery', staat: '62', eenheid: '%', platform: 'teslemetry', apparaat: 'tesla' },
      { id: 'sensor.model_3_range', klasse: 'distance', staat: '280', eenheid: 'km', naam: 'Battery range', platform: 'teslemetry', apparaat: 'tesla' },
      { id: 'sensor.model_3_charger_power', klasse: 'power', staat: '3.2', eenheid: 'kW', naam: 'Charger power', platform: 'teslemetry', apparaat: 'tesla' },
      { id: 'binary_sensor.model_3_charge_cable', klasse: 'plug', staat: 'on', platform: 'teslemetry', apparaat: 'tesla' },
      { id: 'binary_sensor.model_3_charging', klasse: 'battery_charging', staat: 'on', platform: 'teslemetry', apparaat: 'tesla' },
    ]);
    expect(op.auto).toEqual({ id: 'tesla', naam: 'Tesla Model 3', pct: 62, aangesloten: true, laadt: true, vermogenW: 3200, bereikKm: 280, ...geenKeuze });
    // Een auto is geen thuisbatterij, ook al heeft hij een lading in procenten.
    expect(op.batterij).toBeNull();
  });

  it('neemt een laadpaal zonder auto in Home Assistant als de auto', () => {
    const easee: HaDevice = { id: 'easee', area_id: null, name: 'Easee Home', manufacturer: 'Easee', model: 'Home' };
    const paal = (status: string, w: string) => huis([easee], [
      { id: 'sensor.easee_status', staat: status, naam: 'Easee status', platform: 'easee', apparaat: 'easee' },
      { id: 'sensor.easee_power', klasse: 'power', staat: w, eenheid: 'kW', naam: 'Easee power', platform: 'easee', apparaat: 'easee' },
    ]).auto;
    expect(paal('charging', '7.4')).toEqual({ id: 'easee', naam: 'De auto', pct: null, aangesloten: true, laadt: true, vermogenW: 7400, bereikKm: null, ...geenKeuze, paalNaam: 'Easee Home' });
    expect(paal('disconnected', '0')).toMatchObject({ aangesloten: false, laadt: false });
    expect(paal('awaiting_start', '0')).toMatchObject({ aangesloten: true, laadt: false });
    // Een fout van de laadpaal (besluit 263): voor de bel.
    expect(paal('error', '0')).toMatchObject({ fout: 'error' });
    expect(paal('charging', '7.4')).toMatchObject({ fout: null });
  });
});

describe('meer auto’s en laadpalen, en wat de bewoner koos (besluit 259)', () => {
  const tesla: HaDevice = { id: 'tesla', area_id: null, name: 'Model 3', manufacturer: 'Tesla', model: 'Model 3' };
  const kia: HaDevice = { id: 'kia', area_id: null, name: 'EV6', manufacturer: 'Kia', model: 'EV6' };
  const easee: HaDevice = { id: 'easee', area_id: null, name: 'Easee Home', manufacturer: 'Easee', model: 'Home' };
  const micra: HaDevice = { id: 'micra', area_id: null, name: 'MICRA', manufacturer: 'Nissan', model: 'MICRA' };
  const metingen: Meting[] = [
    { id: 'sensor.model_3_battery', klasse: 'battery', staat: '62', eenheid: '%', platform: 'teslemetry', apparaat: 'tesla' },
    { id: 'sensor.model_3_range', klasse: 'distance', staat: '280', eenheid: 'km', naam: 'Battery range', platform: 'teslemetry', apparaat: 'tesla' },
    { id: 'number.model_3_charge_limit', staat: '80', eenheid: '%', naam: 'Charge limit', platform: 'teslemetry', apparaat: 'tesla' },
    { id: 'device_tracker.model_3_location', staat: 'home', platform: 'teslemetry', apparaat: 'tesla' },
    { id: 'climate.model_3_climate', staat: 'off', platform: 'teslemetry', apparaat: 'tesla' },
    { id: 'sensor.ev6_battery', klasse: 'battery', staat: '40', eenheid: '%', platform: 'kia_uvo', apparaat: 'kia' },
    { id: 'binary_sensor.ev6_plugged_in', klasse: 'plug', staat: 'off', platform: 'kia_uvo', apparaat: 'kia' },
    { id: 'sensor.easee_status', staat: 'charging', naam: 'Easee status', platform: 'easee', apparaat: 'easee' },
    { id: 'sensor.easee_power', klasse: 'power', staat: '7.4', eenheid: 'kW', naam: 'Easee power', platform: 'easee', apparaat: 'easee' },
    { id: 'sensor.easee_session_energy', klasse: 'energy', staat: '12', eenheid: 'kWh', naam: 'Session energy', platform: 'easee', apparaat: 'easee' },
    { id: 'number.easee_dynamic_charger_limit', staat: '16', eenheid: 'A', naam: 'Dynamic charger limit', platform: 'easee', apparaat: 'easee', extra: { min: 6, max: 32 } },
    { id: 'switch.easee_charger_enabled', staat: 'on', naam: 'Charger enabled', platform: 'easee', apparaat: 'easee' },
    { id: 'sensor.knop_batterij', klasse: 'battery', staat: '80', eenheid: '%', platform: 'zha', apparaat: 'knop' },
  ];

  it('bedient Easee via de eigen dienst, met de stroom uit de sensoren (besluit 277)', () => {
    const echt = metingen.filter((m) => m.apparaat !== 'kia' && !/^(number|switch)\.easee/.test(m.id));
    const keuze: LadenKeuze = { aan: {}, rol: {}, instelling: {}, bedienen: { easee: true } };
    // De sensoren voor de stroom staan in Home Assistant standaard uit: dan geen stroom van nu, en tot 32 A.
    const zonder = registers([tesla, easee], echt);
    expect(laadBedieningen(zonder.reg, zonder.states, keuze)[0]).toEqual({
      auto: 'tesla',
      apparaat: 'easee',
      stroom: { id: 'sensor.easee_easee_dynamic_charger_limit', min: 6, max: 32, stap: 1, nuA: null, easee: 'easee' },
      pauze: { soort: 'easee', apparaat: 'easee' },
      mag: true,
      evcc: false,
    });
    // Aangezet: de stroom van nu, en de grens van de laadpaal.
    const met = registers([tesla, easee], [
      ...echt,
      { id: 'sensor.easee_dynamic_charger_limit', klasse: 'current', staat: '10', eenheid: 'A', naam: 'Dynamic charger limit', platform: 'easee', apparaat: 'easee' },
      { id: 'sensor.easee_max_charger_limit', klasse: 'current', staat: '16', eenheid: 'A', naam: 'Max charger limit', platform: 'easee', apparaat: 'easee' },
      { id: 'switch.easee_smart_charging', staat: 'off', naam: 'Smart charging', platform: 'easee', apparaat: 'easee' },
    ]);
    expect(laadBedieningen(met.reg, met.states, keuze)[0]).toMatchObject({
      stroom: { id: 'sensor.easee_dynamic_charger_limit', min: 6, max: 16, nuA: 10, easee: 'easee' },
      pauze: { soort: 'easee', apparaat: 'easee' },
    });
    expect(ladenView(met.reg, met.states, keuze).apparaten.find((x) => x.id === 'easee')).toMatchObject({ kanBedienen: true, bedienen: true });
    // Een Equalizer van Easee is geen laadpaal om te bedienen.
    const eq: HaDevice = { ...easee, model: 'Equalizer' };
    const eqReg = registers([tesla, eq], echt);
    expect(laadBedieningen(eqReg.reg, eqReg.states, keuze)[0]).toMatchObject({ stroom: null, pauze: null, mag: false });
  });

  it('vindt de stand van een laadpunt van evcc, en of SunArc hem mag zetten (besluit 278)', () => {
    const evcc: HaDevice = { id: 'evcc', area_id: null, name: 'Garage', manufacturer: 'evcc', model: 'Loadpoint' };
    const stand = (opties: string[], staat = 'pv'): Meting => ({ id: 'select.evcc_garage_mode', staat, platform: 'evcc_intg', apparaat: 'evcc', extra: { options: opties } });
    const keuze: LadenKeuze = { aan: {}, rol: {}, instelling: {}, bedienen: { evcc: true } };
    const r = registers([tesla, easee, evcc], [...metingen.filter((m) => m.apparaat !== 'kia'), stand(['off', 'pv', 'minpv', 'now'])]);
    expect(laadBedieningen(r.reg, r.states, keuze)[0]).toMatchObject({
      mag: false,
      evcc: true,
      evccStand: { id: 'select.evcc_garage_mode', apparaat: 'evcc', opties: ['off', 'pv', 'minpv', 'now'], nu: 'pv' },
      evccMag: true,
    });
    expect(laadBedieningen(r.reg, r.states, null)[0]).toMatchObject({ evccMag: false });
    expect(ladenView(r.reg, r.states, keuze).evcc).toEqual([{ id: 'evcc', naam: 'Garage', kanBedienen: true, bedienen: true }]);
    // Met een slimme stand ook; een andere keuzelijst van evcc (bijvoorbeeld de fasen) is geen stand.
    const slim = registers([tesla, easee, evcc], [...metingen.filter((m) => m.apparaat !== 'kia'), stand(['off', 'smart', 'now'], 'smart')]);
    expect(laadBedieningen(slim.reg, slim.states, keuze)[0]).toMatchObject({ evccStand: { opties: ['off', 'smart', 'now'], nu: 'smart' } });
    const fasen = registers([tesla, easee, evcc], [...metingen.filter((m) => m.apparaat !== 'kia'), { ...stand(['0', '1', '3'], '3'), id: 'select.evcc_garage_phases' }]);
    expect(laadBedieningen(fasen.reg, fasen.states, keuze)[0]).toMatchObject({ evccStand: null, evccMag: false });
    expect(ladenView(fasen.reg, fasen.states, keuze).evcc).toEqual([{ id: 'evcc', naam: 'Garage', kanBedienen: false, bedienen: false }]);
  });

  it('weet per auto wat SunArc met de hand mag bedienen (besluit 262)', () => {
    // Een laadpaal met een getal voor de stroom en een laadschakelaar (zoals Wallbox).
    const alsWallbox = (m: Meting): Meting => (m.apparaat === 'easee' ? { ...m, platform: 'wallbox' } : m);
    const { reg, states } = registers([tesla, easee], metingen.filter((m) => m.apparaat !== 'kia').map(alsWallbox));
    const keuze: LadenKeuze = { aan: {}, rol: {}, instelling: {}, bedienen: { easee: true } };
    expect(laadBedieningen(reg, states, keuze)).toEqual([
      {
        auto: 'tesla',
        apparaat: 'easee',
        stroom: { id: 'number.easee_dynamic_charger_limit', min: 6, max: 32, stap: 1, nuA: 16 },
        pauze: { soort: 'schakelaar', id: 'switch.easee_charger_enabled', omgekeerd: false },
        mag: true,
        evcc: false,
      },
    ]);
    // Zonder toestemming bij Energie mag het niet; Energie ziet dat hij het kan.
    expect(laadBedieningen(reg, states, null)[0]).toMatchObject({ mag: false });
    expect(ladenView(reg, states, keuze).apparaten.find((x) => x.id === 'easee')).toMatchObject({ kanBedienen: true, bedienen: true });
    // Met evcc in huis bedient SunArc de laadpaal niet zelf.
    const evcc: HaDevice = { id: 'evcc', area_id: null, name: 'Garage', manufacturer: 'evcc', model: 'Loadpoint' };
    const met = registers([tesla, easee, evcc], [...metingen.filter((m) => m.apparaat !== 'kia').map(alsWallbox), { id: 'select.evcc_garage_mode', staat: 'pv', platform: 'evcc_intg', apparaat: 'evcc' }]);
    expect(laadBedieningen(met.reg, met.states, keuze)[0]).toMatchObject({ mag: false, evcc: true });
    // Een pauzeknop die aan is als hij stilstaat, en een paar knoppen.
    const knoppen = registers([easee], [
      { id: 'switch.wallbox_pause', staat: 'off', naam: 'Pause', platform: 'wallbox', apparaat: 'easee' },
      { id: 'sensor.easee_power', klasse: 'power', staat: '0', eenheid: 'W', platform: 'wallbox', apparaat: 'easee' },
    ]);
    expect(laadBedieningen(knoppen.reg, knoppen.states)[0]!.pauze).toEqual({ soort: 'schakelaar', id: 'switch.wallbox_pause', omgekeerd: true });
    const paar = registers([easee], [
      { id: 'button.ohme_pause_charge', staat: 'unknown', naam: 'Pause charge', platform: 'wallbox', apparaat: 'easee' },
      { id: 'button.ohme_resume_charge', staat: 'unknown', naam: 'Resume charge', platform: 'wallbox', apparaat: 'easee' },
      { id: 'button.ohme_restart', staat: 'unknown', naam: 'Restart', platform: 'wallbox', apparaat: 'easee' },
      { id: 'sensor.easee_power', klasse: 'power', staat: '0', eenheid: 'W', platform: 'wallbox', apparaat: 'easee' },
    ]);
    expect(laadBedieningen(paar.reg, paar.states)[0]!.pauze).toEqual({ soort: 'knoppen', pauze: 'button.ohme_pause_charge', hervat: 'button.ohme_resume_charge' });
    // Bewaren: alleen ja telt, per apparaat.
    expect(leesLaden({ aan: {}, rol: {}, instelling: {}, bedienen: { easee: true, kia: false } })).toEqual({ keuze: { aan: {}, rol: {}, instelling: {}, bedienen: { easee: true } } });
    expect(leesLaden({ bedienen: { easee: 'ja' } })).toEqual({ fout: 'auto en laadpaal: bedienen is per apparaat ja of nee' });
  });

  it('vindt twee auto’s en een laadpaal, met wat elk meet en kan', () => {
    const { reg, states } = registers([tesla, kia, easee, knop], metingen);
    const v = ladenView(reg, states, null);
    expect(v.apparaten.map((x) => [x.id, x.rol, x.aan, x.zelf])).toEqual([
      ['kia', 'auto', true, false],
      ['tesla', 'auto', true, false],
      ['easee', 'laadpaal', true, false],
    ]);
    expect(v.apparaten.find((x) => x.id === 'tesla')!.wat).toEqual(['lading', 'bereik', 'laadgrens', 'thuis']);
    expect(v.apparaten.find((x) => x.id === 'kia')!.wat).toEqual(['lading', 'kabel']);
    const paal = v.apparaten.find((x) => x.id === 'easee')!;
    expect(paal).toMatchObject({ merk: 'Easee', stroomA: { min: 6, max: 32 } });
    expect(paal.wat).toEqual(['vermogen', 'sessie', 'stand', 'stroomZetten', 'pauzeren']);
    // De knop meet een batterij: die is te kiezen, maar niet gevonden als auto.
    expect(v.kandidaten).toEqual([{ id: 'knop', naam: 'Knop hal' }]);
  });

  it('koppelt een auto aan de enige laadpaal, of aan de gekozen', () => {
    const zonder = huis([tesla, kia, easee], metingen);
    expect(zonder.autos.map((a) => [a.id, a.laadpaal, a.vermogenW])).toEqual([
      ['kia', 'easee', 7400],
      ['tesla', 'easee', 7400],
    ]);
    const keuze: LadenKeuze = { aan: { kia: false }, rol: {}, instelling: { tesla: { accuKWh: 75, laadpaal: 'easee', plek: 'garage' } } };
    const met = huis([tesla, kia, easee], metingen, keuze);
    expect(met.autos).toHaveLength(1);
    expect(met.auto).toMatchObject({ id: 'tesla', naam: 'Model 3', pct: 62, laadt: true, plek: 'garage', accuKWh: 75, laadpaal: 'easee', paalPlek: null });
    // De laadpaal heeft een eigen plek (issue 164): die komt bij de auto, ook als de auto zelf een andere heeft.
    const paalKeuze: LadenKeuze = { ...keuze, instelling: { ...keuze.instelling, easee: { accuKWh: null, laadpaal: null, plek: 'carport' } } };
    expect(huis([tesla, kia, easee], metingen, paalKeuze).auto).toMatchObject({ plek: 'garage', paalPlek: 'carport' });
  });

  it('neemt een zelf gekozen apparaat als auto, en zet een laadpaal zonder auto in zijn plek', () => {
    const vreemd: HaDevice = { id: 'vreemd', area_id: null, name: 'Mijn wagen', manufacturer: 'Onbekend', model: 'X' };
    const m: Meting[] = [{ id: 'sensor.wagen_soc', klasse: 'battery', staat: '55', eenheid: '%', platform: 'mqtt', apparaat: 'vreemd' }];
    expect(huis([vreemd], m).auto).toBeNull();
    const zelf = huis([vreemd], m, { aan: {}, rol: { vreemd: 'auto' }, instelling: {} });
    expect(zelf.auto).toMatchObject({ id: 'vreemd', naam: 'Mijn wagen', pct: 55 });
    const { reg, states } = registers([vreemd], m);
    expect(ladenView(reg, states, { aan: {}, rol: { vreemd: 'auto' }, instelling: {} }).apparaten[0]).toMatchObject({ zelf: true, rol: 'auto' });
    const paal = huis([easee], metingen.filter((x) => x.apparaat === 'easee'), { aan: {}, rol: {}, instelling: { easee: { accuKWh: null, laadpaal: null, plek: 'carport' } } });
    expect(paal.auto).toMatchObject({ id: 'easee', naam: 'De auto', plek: 'carport', accuKWh: null });
  });

  it('kent evcc apart: zijn laadpunt is geen auto', () => {
    const lp: HaDevice = { id: 'lp1', area_id: null, name: 'Laadpunt garage', manufacturer: 'evcc', model: 'Loadpoint' };
    const m: Meting[] = [
      { id: 'sensor.evcc_lp1_vehicle_soc', klasse: 'battery', staat: '50', eenheid: '%', platform: 'evcc_intg', apparaat: 'lp1' },
      { id: 'sensor.evcc_lp1_vehicle_range', klasse: 'distance', staat: '200', eenheid: 'km', naam: 'Vehicle range', platform: 'evcc_intg', apparaat: 'lp1' },
    ];
    const { reg, states } = registers([lp], m);
    expect(ladenView(reg, states, null)).toMatchObject({ apparaten: [], evcc: [{ id: 'lp1', naam: 'Laadpunt garage' }] });
    expect(huis([lp], m).auto).toBeNull();
  });

  it('herkent een Nissan via NissanConnect als auto, voor zijn klimaat (melding 132)', () => {
    const { reg, states } = registers([micra, knop], [
      { id: 'climate.micra_climate', staat: 'off', platform: 'nissan_connect', apparaat: 'micra' },
      { id: 'sensor.micra_battery', klasse: 'battery', staat: '70', eenheid: '%', platform: 'nissan_connect', apparaat: 'micra' },
      knopBatterij,
    ]);
    expect([...autoApparaten(reg, states)]).toEqual(['micra']);
  });

  it('ziet een iBeacon, Proximity of een afstand alleen niet als auto (6 november 2026)', () => {
    const beacon: HaDevice = { id: 'beacon', area_id: null, name: 'CARe 0882', manufacturer: 'ibeacon', model: 'iBeacon' };
    const tag: HaDevice = { id: 'tag', area_id: null, name: 'WSBC001006142U 7D04', manufacturer: null, model: null };
    const prox: HaDevice = { id: 'prox', area_id: null, name: 'Thuis', manufacturer: null, model: null };
    const losse: HaDevice = { id: 'losse', area_id: null, name: 'Afstandsmeter', manufacturer: 'Onbekend', model: 'X' };
    const m: Meting[] = [
      { id: 'sensor.care_0882_estimated_distance', klasse: 'distance', staat: '2.1', eenheid: 'm', naam: 'Estimated distance', platform: 'ibeacon', apparaat: 'beacon' },
      { id: 'device_tracker.care_0882', staat: 'home', platform: 'ibeacon', apparaat: 'beacon' },
      { id: 'sensor.care_0882_battery', klasse: 'battery', staat: '90', eenheid: '%', platform: 'ibeacon', apparaat: 'beacon' },
      { id: 'sensor.wsbc_estimated_distance', klasse: 'distance', staat: '4', eenheid: 'm', naam: 'Estimated distance', platform: 'ibeacon', apparaat: 'tag' },
      { id: 'sensor.thuis_distance', klasse: 'distance', staat: '12', eenheid: 'km', naam: 'Thuis Ricardo distance', platform: 'proximity', apparaat: 'prox' },
      { id: 'sensor.thuis_direction', staat: 'stationary', naam: 'Thuis Ricardo direction of travel', platform: 'proximity', apparaat: 'prox' },
      { id: 'sensor.losse_distance', klasse: 'distance', staat: '30', eenheid: 'cm', naam: 'Distance', platform: 'esphome', apparaat: 'losse' },
    ];
    const { reg, states } = registers([beacon, tag, prox, losse], m);
    expect(ladenView(reg, states, null).apparaten).toEqual([]);
    expect(huis([beacon, tag, prox, losse], m).autos).toEqual([]);
    expect(autoApparaten(reg, states).size).toBe(0);
  });

  it('herkent een auto van een onbekende koppeling aan een bereik met een lading', () => {
    const wagen: HaDevice = { id: 'wagen', area_id: null, name: 'Zoe', manufacturer: 'Iemand', model: 'Z' };
    const m: Meting[] = [
      { id: 'sensor.zoe_battery_autonomy', klasse: 'distance', staat: '240', eenheid: 'km', naam: 'Battery autonomy', platform: 'mqtt', apparaat: 'wagen' },
      { id: 'sensor.zoe_battery_level', klasse: 'battery', staat: '70', eenheid: '%', platform: 'mqtt', apparaat: 'wagen' },
    ];
    expect(huis([wagen], m).auto).toMatchObject({ id: 'wagen', pct: 70, bereikKm: 240 });
    // Alleen een bereik, zonder lading of laden: geen auto.
    expect(huis([wagen], m.slice(0, 1)).auto).toBeNull();
  });

  it('neemt een laadpaal van een bekend merk pas als hij iets meet wat bij laden hoort', () => {
    const naam: HaDevice = { id: 'stekker', area_id: null, name: 'Wallbox lamp', manufacturer: 'IKEA', model: 'TRADFRI' };
    expect(huis([naam], [{ id: 'light.wallbox_lamp', staat: 'on', platform: 'hue', apparaat: 'stekker' }]).auto).toBeNull();
  });

  it('leest wat de pagina stuurt, en weigert wat niet klopt', () => {
    expect(leesLaden(null)).toEqual({ keuze: null });
    expect(leesLaden({ aan: {}, rol: {}, instelling: {} })).toEqual({ keuze: null });
    expect(leesLaden({ aan: { kia: false }, instelling: { tesla: { accuKWh: 75.04, plek: 'garage' } } })).toEqual({
      keuze: { aan: { kia: false }, rol: {}, instelling: { tesla: { accuKWh: 75, laadpaal: null, plek: 'garage' } } },
    });
    expect(leesLaden({ rol: { x: 'fiets' } })).toHaveProperty('fout');
    expect(leesLaden({ instelling: { x: { accuKWh: 900 } } })).toHaveProperty('fout');
    expect(leesLaden({ instelling: { x: { plek: 'dak' } } })).toHaveProperty('fout');
    expect(leesLaden({ aan: { 'kapot id met spaties': true } })).toHaveProperty('fout');
  });
});

describe('wat de pagina Auto laat zien (besluit 259, stap 2)', () => {
  const tesla: HaDevice = { id: 'tesla', area_id: null, name: 'Model 3', manufacturer: 'Tesla', model: 'Model 3' };
  const easee: HaDevice = { id: 'easee', area_id: null, name: 'Easee Home', manufacturer: 'Easee', model: 'Home' };
  const nu = new Date('2026-11-06T12:02:00Z');
  const auto: Meting[] = [
    { id: 'sensor.model_3_battery', klasse: 'battery', staat: '60', eenheid: '%', platform: 'teslemetry', apparaat: 'tesla' },
    { id: 'sensor.model_3_range', klasse: 'distance', staat: '300', eenheid: 'km', naam: 'Battery range', platform: 'teslemetry', apparaat: 'tesla' },
    { id: 'number.model_3_charge_limit', staat: '80', eenheid: '%', naam: 'Charge limit', platform: 'teslemetry', apparaat: 'tesla' },
    { id: 'binary_sensor.model_3_charge_cable', klasse: 'plug', staat: 'on', platform: 'teslemetry', apparaat: 'tesla', sinds: '2026-11-06T10:20:00Z' },
    { id: 'device_tracker.model_3_location', staat: 'home', platform: 'teslemetry', apparaat: 'tesla' },
  ];
  const paal: Meting[] = [
    { id: 'sensor.easee_status', staat: 'charging', naam: 'Easee status', platform: 'easee', apparaat: 'easee' },
    { id: 'sensor.easee_power', klasse: 'power', staat: '4.1', eenheid: 'kW', naam: 'Easee power', platform: 'easee', apparaat: 'easee' },
    { id: 'sensor.easee_current_l1', klasse: 'current', staat: '6.02', eenheid: 'A', naam: 'Current L1', platform: 'easee', apparaat: 'easee' },
    { id: 'sensor.easee_current_l3', klasse: 'current', staat: '5.9', eenheid: 'A', naam: 'Current L3', platform: 'easee', apparaat: 'easee' },
    { id: 'sensor.easee_current_l2', klasse: 'current', staat: '6', eenheid: 'A', naam: 'Current L2', platform: 'easee', apparaat: 'easee' },
    // Een grens, geen meting: telt niet als stroom.
    { id: 'sensor.easee_dynamic_circuit_current_p1', klasse: 'current', staat: '16', eenheid: 'A', naam: 'Dynamic circuit current P1', platform: 'easee', apparaat: 'easee' },
    { id: 'number.easee_dynamic_charger_limit', staat: '16', eenheid: 'A', naam: 'Dynamic charger limit', platform: 'easee', apparaat: 'easee', extra: { min: 6, max: 16 } },
  ];

  it('geeft de laadgrens, de stroom per fase, de kabel en de laadpaal', () => {
    const a = huis([tesla, easee], [...auto, ...paal], null, nu).auto!;
    expect(a).toMatchObject({ laadgrens: 80, stroomA: [6, 6, 5.9], thuis: true, kabelSinds: '2026-11-06T10:20:00Z', wegSinds: null, paalNaam: 'Easee Home', paalStroomA: { min: 6, max: 16 }, vermogenW: 4100, laadt: true });
    // Zonder accu weet de app niet hoe laat hij vol is.
    expect(a.volOm).toBeNull();
  });

  it('geeft per auto de meter van zijn laadvermogen, voor de laadbeurten (stap 3)', () => {
    const { reg, states } = registers([tesla, easee], [...auto, ...paal]);
    expect(laadMeters(reg, states)).toEqual([{ auto: 'tesla', vermogen: 'sensor.easee_power' }]);
    // Zonder laadpaal en zonder laadvermogen in de auto: geen meter.
    const alleen = registers([tesla], auto);
    expect(laadMeters(alleen.reg, alleen.states)).toEqual([{ auto: 'tesla', vermogen: null }]);
  });

  it('rekent uit hoe laat hij vol is, of neemt de tijd van de auto zelf', () => {
    const keuze: LadenKeuze = { aan: {}, rol: {}, instelling: { tesla: { accuKWh: 75, laadpaal: null, plek: null } } };
    // (80 − 60)% van 75 kWh = 15 kWh, met 4,1 kW: 3 uur 40, naar boven op vijf minuten.
    expect(huis([tesla, easee], [...auto, ...paal], keuze, nu).auto!.volOm).toBe('2026-11-06T15:45:00.000Z');
    const zelf: Meting = { id: 'sensor.model_3_time_to_full_charge', klasse: 'duration', staat: '95', eenheid: 'min', naam: 'Time to full charge', platform: 'teslemetry', apparaat: 'tesla' };
    expect(huis([tesla, easee], [...auto, zelf, ...paal], keuze, nu).auto!.volOm).toBe('2026-11-06T13:37:00.000Z');
    // Laadt hij niet, dan geen tijd.
    const rust = paal.map((m) => (m.id === 'sensor.easee_status' ? { ...m, staat: 'connected' } : m.id === 'sensor.easee_power' ? { ...m, staat: '0' } : m));
    expect(huis([tesla, easee], [...auto, ...rust], keuze, nu).auto!.volOm).toBeNull();
  });

  it('leest een Nissan MICRA zoals in melding 132: lading, bereik, laden en de laadtijd die over is', () => {
    const micra: HaDevice = { id: 'micra', area_id: null, name: 'MICRA', manufacturer: 'Nissan', model: '2025 MICRA' };
    const m = (id: string, klasse: string | undefined, staat: string, naam: string, eenheid?: string): Meting => ({ id, ...(klasse ? { klasse } : {}), staat, naam, ...(eenheid ? { eenheid } : {}), platform: 'nissan_connect', apparaat: 'micra' });
    const a = huis([micra], [
      m('climate.micra_climate', undefined, 'off', 'Climate'),
      m('binary_sensor.micra_charging', 'battery_charging', 'on', 'Charging'),
      m('binary_sensor.micra_plugged_in', 'plug', 'on', 'Plugged In'),
      m('sensor.micra_last_updated', 'timestamp', '2026-11-05T18:03:22.382000+00:00', 'Last Updated'),
      m('sensor.micra_range', 'distance', '287', 'Range', 'km'),
      m('sensor.micra_battery_level', 'battery', '99', 'Battery Level', '%'),
      m('sensor.micra_charge_time', 'duration', '0.0666666666666667', 'Charge Time', 'h'),
      m('sensor.micra_odometer', 'distance', '13883.0', 'Odometer', 'km'),
      m('device_tracker.micra_location', undefined, 'home', 'Location'),
      m('sensor.micra_internal_temperature', 'temperature', '18.0', 'Internal Temperature', '°C'),
    ], null, nu).auto!;
    expect(a).toMatchObject({ id: 'micra', pct: 99, bereikKm: 287, laadt: true, aangesloten: true, thuis: true, laadgrens: null, volOm: '2026-11-06T12:06:00.000Z' });
  });

  it('zegt dat de auto weg is, en sinds wanneer', () => {
    const weg = auto.map((m) => (m.id.startsWith('device_tracker.') ? { ...m, staat: 'not_home', sinds: '2026-11-06T07:10:00Z' } : m.id.startsWith('binary_sensor.') ? { ...m, staat: 'off' } : m));
    expect(huis([tesla], weg, null, nu).auto).toMatchObject({ thuis: false, wegSinds: '2026-11-06T07:10:00Z', kabelSinds: null, aangesloten: false });
  });
});

describe('Energie › Thuisaccu: zelf kiezen, ook uit losse sensoren (besluit 271, issue 145)', () => {
  // Drie Marstek-accu's via Homey, zoals in issue 145: één apparaat met losse sensoren.
  const homey: HaDevice = { id: 'homey', area_id: null, name: 'Laadplan Controller', manufacturer: 'Athom', model: 'Homey Pro' };
  const sensoren = (w = '-800'): Meting[] => [
    { id: 'sensor.laadplan_controller_battery', klasse: 'battery', staat: '64', eenheid: '%', platform: 'homey', apparaat: 'homey' },
    { id: 'sensor.laadplan_controller_power', klasse: 'power', staat: w, eenheid: 'W', platform: 'homey', apparaat: 'homey' },
    { id: 'sensor.laadplan_controller_charged_energy', klasse: 'energy', staat: '812.4', eenheid: 'kWh', platform: 'homey', apparaat: 'homey' },
    { id: 'sensor.laadplan_controller_discharged_energy', klasse: 'energy', staat: '734', eenheid: 'kWh', platform: 'homey', apparaat: 'homey' },
  ];
  const view = (keuze: AccuKeuze | null, laden: LadenKeuze | null = null, w?: string) => {
    const { reg, states } = registers([knop, homey], [knopBatterij, ...sensoren(w)]);
    return accuView(reg, states, keuze, laden);
  };
  const zelf: AccuKeuze = { aan: {}, zelf: ['homey'], instelling: {} };

  it('vindt de accu van Homey niet vanzelf, maar biedt hem aan om te kiezen', () => {
    const v = view(null);
    expect(v.apparaten).toEqual([]);
    expect(v.kandidaten).toEqual([{ id: 'homey', naam: 'Laadplan Controller' }]);
    // Een knop met een batterijtje is geen accu om te kiezen; de sensoren van Homey staan klaar.
    expect(v.sensoren.filter((x) => x.apparaat === 'homey').map((x) => x.soort).sort()).toEqual(['energie', 'energie', 'lading', 'vermogen']);
    expect(huis([homey], sensoren()).batterij).toBeNull();
  });

  it('neemt hem als accu als de bewoner hem kiest, met zijn sensoren en het goede teken', () => {
    const [a] = view(zelf).apparaten;
    expect(a).toMatchObject({
      id: 'homey',
      naam: 'Laadplan Controller',
      zelf: true,
      aan: true,
      teken: 'laden',
      pct: 64,
      vermogenW: -800,
      sensoren: {
        lading: 'sensor.laadplan_controller_battery',
        vermogen: 'sensor.laadplan_controller_power',
        geladen: 'sensor.laadplan_controller_charged_energy',
        geleverd: 'sensor.laadplan_controller_discharged_energy',
      },
      gekozen: [],
    });
    const { reg, states } = registers([homey], sensoren());
    expect(vindOpslag(reg, states, null, new Date(), zelf).batterij).toEqual({ id: 'homey', naam: 'De batterij', pct: 64, vermogenW: -800, stand: 'levert' });
    // Niet meer te kiezen: hij staat er al.
    expect(view(zelf).kandidaten).toEqual([]);
  });

  it('draait het teken om als plus leveren is, en neemt gekozen sensoren boven wat hij vond', () => {
    const om: AccuKeuze = { aan: {}, zelf: ['homey'], instelling: { homey: { teken: 'leveren', geladen: 'sensor.laadplan_controller_discharged_energy' } } };
    const [a] = view(om, null, '800').apparaten;
    expect(a).toMatchObject({ teken: 'leveren', vermogenW: -800, gekozen: ['geladen'] });
    expect(a!.sensoren.geladen).toBe('sensor.laadplan_controller_discharged_energy');
  });

  it('laat een uitgezette accu weg op Thuis, en een gekozen accu weg bij Auto en laadpaal', () => {
    const { reg, states } = registers([homey], sensoren());
    expect(vindOpslag(reg, states, null, new Date(), { ...zelf, aan: { homey: false } }).batterij).toBeNull();
    expect(ladenView(reg, states, null).kandidaten).toEqual([{ id: 'homey', naam: 'Laadplan Controller' }]);
    expect(ladenView(reg, states, null, zelf).kandidaten).toEqual([]);
    // Wat de bewoner als auto koos, is geen accu.
    expect(view(zelf, { aan: {}, rol: { homey: 'auto' }, instelling: {} }).apparaten).toEqual([]);
  });

  it('vindt bij een Sessy vanzelf de lading en het vermogen', () => {
    const sessy: HaDevice = { id: 'sessy', area_id: null, name: 'Sessy', manufacturer: 'Charged', model: 'Sessy' };
    const { reg, states } = registers([sessy], [
      { id: 'sensor.sessy_state_of_charge', klasse: 'battery', staat: '78', eenheid: '%', platform: 'sessy', apparaat: 'sessy' },
      { id: 'sensor.sessy_power', klasse: 'power', staat: '1800', eenheid: 'W', naam: 'Sessy battery power', platform: 'sessy', apparaat: 'sessy' },
    ]);
    expect(accuView(reg, states, null).apparaten).toEqual([
      expect.objectContaining({ id: 'sessy', zelf: false, pct: 78, vermogenW: 1800, sensoren: { lading: 'sensor.sessy_state_of_charge', vermogen: 'sensor.sessy_power', geladen: null, geleverd: null } }),
    ]);
  });

  it('leest wat de pagina stuurt, en weigert wat niet klopt', () => {
    expect(leesAccu(null)).toEqual({ keuze: null });
    expect(leesAccu({ aan: {}, zelf: [], instelling: {} })).toEqual({ keuze: null });
    expect(leesAccu({ zelf: ['homey', 'homey'], instelling: { homey: { vermogen: 'sensor.laadplan_controller_power', teken: 'leveren', lading: null } } })).toEqual({
      keuze: { aan: {}, zelf: ['homey'], instelling: { homey: { vermogen: 'sensor.laadplan_controller_power', teken: 'leveren' } } },
    });
    expect(leesAccu({ instelling: { homey: { vermogen: 'switch.iets' } } })).toHaveProperty('fout');
    expect(leesAccu({ instelling: { homey: { teken: 'soms' } } })).toHaveProperty('fout');
    expect(leesAccu({ zelf: 'homey' })).toHaveProperty('fout');
  });
});

describe('meer accu’s, met hun maat (besluit 275)', () => {
  const nu = new Date('2026-11-07T12:00:00Z');
  const sessy: HaDevice = { id: 'sessy', area_id: null, name: 'Sessy', manufacturer: 'Charged', model: 'Sessy' };
  const zendure: HaDevice = { id: 'zendure', area_id: null, name: 'Zendure', manufacturer: 'Zendure', model: 'SolarFlow' };
  const metingen = (sessyW: string, zendureW: string): Meting[] => [
    { id: 'sensor.sessy_soc', klasse: 'battery', staat: '50', eenheid: '%', platform: 'sessy', apparaat: 'sessy' },
    { id: 'sensor.sessy_power', klasse: 'power', staat: sessyW, eenheid: 'W', naam: 'Sessy battery power', platform: 'sessy', apparaat: 'sessy' },
    { id: 'sensor.zendure_soc', klasse: 'battery', staat: '80', eenheid: '%', platform: 'zendure_ha', apparaat: 'zendure' },
    { id: 'sensor.zendure_power', klasse: 'power', staat: zendureW, eenheid: 'W', naam: 'Zendure battery power', platform: 'zendure_ha', apparaat: 'zendure' },
  ];
  const maat = (s: number | null, z: number | null): AccuKeuze => ({ aan: {}, zelf: [], instelling: { ...(s ? { sessy: { maatKWh: s } } : {}), ...(z ? { zendure: { maatKWh: z } } : {}) } });

  it('telt twee accu’s samen, met elk een eigen regel', () => {
    const { reg, states } = registers([sessy, zendure], metingen('1000', '500'));
    const o = vindOpslag(reg, states, null, nu, maat(10, 2.5));
    expect(o.batterijen?.map((b) => [b.naam, b.pct, b.vermogenW, b.stand])).toEqual([['Sessy', 50, 1000, 'laadt'], ['Zendure', 80, 500, 'laadt']]);
    // Samen: 12,5 kWh, de lading naar hun maat (5 + 2 = 7 kWh is 56%), 1,5 kW laden.
    expect(o.batterij).toMatchObject({ naam: 'De batterijen', pct: 56, vermogenW: 1500, stand: 'laadt', maatKWh: 12.5, nogKWh: 7 });
    // Zonder alle maten: het gemiddelde, en geen kWh.
    const zonder = vindOpslag(reg, states, null, nu, maat(10, null));
    expect(zonder.batterij).toEqual({ id: 'sessy', naam: 'De batterijen', pct: 65, vermogenW: 1500, stand: 'laadt' });
    // Eén accu uit: dan is de ander de accu, zonder lijst.
    const een = vindOpslag(reg, states, null, nu, { ...maat(10, 2.5), aan: { zendure: false } });
    expect(een.batterijen).toBeUndefined();
    expect(een.batterij).toMatchObject({ id: 'sessy', pct: 50, maatKWh: 10, nogKWh: 5 });
  });

  it('zegt met de maat hoe laat hij vol is, en hoe lang hij het huis nog voedt', () => {
    const { reg, states } = registers([sessy], metingen('2500', '0').slice(0, 2));
    // De helft van 10 kWh met 2,5 kW: over twee uur vol.
    expect(vindOpslag(reg, states, null, nu, maat(10, null)).batterij).toMatchObject({ volOm: '2026-11-07T14:00:00.000Z', urenNog: null });
    const levert = registers([sessy], metingen('-1000', '0').slice(0, 2));
    // 5 kWh met 1 kW naar het huis: nog vijf uur.
    expect(vindOpslag(levert.reg, levert.states, null, nu, maat(10, null)).batterij).toMatchObject({ volOm: null, urenNog: 5 });
    // Zonder maat geen van beide.
    expect(vindOpslag(reg, states, null, nu).batterij).not.toHaveProperty('volOm');
  });

  it('neemt de maat aan tussen 1 en 200 kWh', () => {
    expect(leesAccu({ instelling: { sessy: { maatKWh: 10.04 } } })).toEqual({ keuze: { aan: {}, zelf: [], instelling: { sessy: { maatKWh: 10 } } } });
    expect(leesAccu({ instelling: { sessy: { maatKWh: 900 } } })).toHaveProperty('fout');
    expect(leesAccu({ instelling: { sessy: { maatKWh: 'tien' } } })).toHaveProperty('fout');
  });
});
