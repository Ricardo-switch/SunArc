/**
 * Een slimme stekker als apparaat op zon (besluit 264, issue 136).
 *
 * De stekker komt uit het huis van de bewoner: een SONOFF-stekker via
 * Zigbee2MQTT voor de verwarming van het tuinhuis, met vermogen en kWh, en een
 * lampje en een beveiliging als instellingen. SunArc vindt hem, zegt het bij
 * de bel, en kijkt mee wanneer hij aan kan op zon.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { HaEntityState } from '../src/adapters/homeassistant/client.js';
import type { HaDevice, HaRegistryEntity } from '../src/adapters/homeassistant/discovery.js';
import { parseSiteConfig } from '../src/config/schema.js';
import { decide } from '../src/core/decide.js';
import type { HeatStoreExplanation } from '../src/core/decision.js';
import type { HeatStore, SiteConfig } from '../src/core/model.js';
import type { SystemState } from '../src/core/state.js';
import { unavailable, value } from '../src/core/state.js';
import { defaultStrategies } from '../src/index.js';
import { validateConnection, withConnection, type ConnectionAnswers } from '../src/web/aansluiting.js';
import { residentBuffers } from '../src/web/buffers-bewoner.js';
import { findHeatStores, findPlugs, type FoundHeatStore } from '../src/web/buffers-vinden.js';
import { wat, type MeldingenBron } from '../src/web/meldingen.js';
import { exampleSite, exampleSitePath } from './site.js';

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): HaEntityState =>
  ({ entity_id, state, attributes, last_changed: '', last_updated: '' }) as HaEntityState;
const ent = (entity_id: string, device_id: string, extra: Partial<HaRegistryEntity> = {}): HaRegistryEntity => ({ entity_id, device_id, platform: 'mqtt', ...extra });

/* ------------------------------------------------- het huis, zoals HA het geeft */

const P = 'smart_plug_verwarming_tuinhuis';
const kwh = { state_class: 'total_increasing', unit_of_measurement: 'kWh', device_class: 'energy' };
const devices: HaDevice[] = [
  { id: 'plug', area_id: null, name: 'Smart plug - verwarming tuinhuis', model: 'Zigbee smart plug', manufacturer: 'SONOFF' },
  { id: 'spiegel', area_id: 'badkamer', name: 'Spiegel badkamer', model: 'Aubess Smart Switch 1-gang', manufacturer: 'Tuya' },
  { id: 'airco', area_id: null, name: 'Air Conditioning woonkamer' },
  { id: 'easee', area_id: null, name: 'Easee Home', model: 'Charger' },
  { id: 'lamp', area_id: null, name: 'Shelly tuinlamp' },
] as HaDevice[];
const entities: HaRegistryEntity[] = [
  ent(`switch.${P}`, 'plug'),
  ent(`switch.${P}_network_indicator`, 'plug', { entity_category: 'config' }),
  ent(`switch.${P}_outlet_control_protect`, 'plug', { entity_category: 'config' }),
  ent(`select.${P}_power_on_behavior`, 'plug', { entity_category: 'config' }),
  ent(`sensor.${P}_power`, 'plug'),
  ent(`sensor.${P}_energy`, 'plug'),
  ent(`sensor.${P}_energy_today`, 'plug'),
  ent(`sensor.${P}_energy_month`, 'plug'),
  ent(`update.${P}`, 'plug', { entity_category: 'config' }),
  // Een relais in de muur dat zich als stopcontact meldt, zonder meter: geen stekker.
  ent('switch.spiegel_badkamer_schakelaar_1', 'spiegel', { platform: 'tuya' }),
  // De aan-knop van een airco, met een meter: geen stekker.
  ent('climate.air_conditioning_woonkamer', 'airco'),
  ent('switch.air_conditioning_woonkamer_power', 'airco'),
  ent('sensor.air_conditioning_woonkamer_power', 'airco'),
  // Een laadpaal met een schakelaar en een meter: geen stekker.
  ent('switch.easee_home_enabled', 'easee'),
  ent('sensor.easee_home_power', 'easee'),
  // Een lamp met een eigen meter: een lamp, geen stekker.
  ent('light.tuinlamp', 'lamp'),
  ent('switch.tuinlamp_relais', 'lamp'),
  ent('sensor.tuinlamp_power', 'lamp'),
];
function staten(plugW = 0, aan = false): Map<string, HaEntityState> {
  return new Map([
    [`switch.${P}`, st(`switch.${P}`, aan ? 'on' : 'off', { friendly_name: 'Smart plug - verwarming tuinhuis' })],
    [`switch.${P}_network_indicator`, st(`switch.${P}_network_indicator`, 'on')],
    [`switch.${P}_outlet_control_protect`, st(`switch.${P}_outlet_control_protect`, 'off')],
    [`select.${P}_power_on_behavior`, st(`select.${P}_power_on_behavior`, 'off')],
    [`sensor.${P}_power`, st(`sensor.${P}_power`, String(plugW), { state_class: 'measurement', unit_of_measurement: 'W', device_class: 'power' })],
    [`sensor.${P}_energy`, st(`sensor.${P}_energy`, '0', kwh)],
    [`sensor.${P}_energy_today`, st(`sensor.${P}_energy_today`, '0', kwh)],
    [`sensor.${P}_energy_month`, st(`sensor.${P}_energy_month`, '0', kwh)],
    [`update.${P}`, st(`update.${P}`, 'off')],
    ['switch.spiegel_badkamer_schakelaar_1', st('switch.spiegel_badkamer_schakelaar_1', 'off', { device_class: 'outlet' })],
    ['climate.air_conditioning_woonkamer', st('climate.air_conditioning_woonkamer', 'off')],
    ['switch.air_conditioning_woonkamer_power', st('switch.air_conditioning_woonkamer_power', 'off', { device_class: 'switch' })],
    ['sensor.air_conditioning_woonkamer_power', st('sensor.air_conditioning_woonkamer_power', '0', { unit_of_measurement: 'W', device_class: 'power' })],
    ['switch.easee_home_enabled', st('switch.easee_home_enabled', 'on')],
    ['sensor.easee_home_power', st('sensor.easee_home_power', '0', { unit_of_measurement: 'kW', device_class: 'power' })],
    ['light.tuinlamp', st('light.tuinlamp', 'off')],
    ['switch.tuinlamp_relais', st('switch.tuinlamp_relais', 'off')],
    ['sensor.tuinlamp_power', st('sensor.tuinlamp_power', '0', { unit_of_measurement: 'W', device_class: 'power' })],
  ]);
}

describe('een slimme stekker vinden (besluit 264)', () => {
  it('vindt de stekker van het tuinhuis, met zijn vermogen en zijn kWh-meter, en verder niets', () => {
    expect(findPlugs(staten(), entities, devices)).toEqual([
      {
        id: 'stekker-smart-plug-verwarming-tuinhuis',
        naam: 'Smart plug - verwarming tuinhuis',
        soort: 'stekker',
        control: 'switch',
        actuator: `switch.${P}`,
        power: `sensor.${P}_power`,
        // De stand, niet die van vandaag of deze maand.
        energy: `sensor.${P}_energy`,
        estimatedW: 1000,
        minC: 0,
        sunC: 0,
        heatRateCPerHour: 1,
      },
    ]);
    // Geen boiler of jacuzzi: de stekker telt niet dubbel.
    expect(findHeatStores(staten(), entities, devices)).toEqual([]);
  });

  it('neemt wat hij nu trekt als hij aan staat, en slaat over wat de regeling al bedient', () => {
    expect(findPlugs(staten(1450, true), entities, devices)[0]?.estimatedW).toBe(1450);
    expect(findPlugs(staten(), entities, devices, new Set([`switch.${P}`]))).toEqual([]);
  });

  it('vindt een stekker zonder meter aan zijn naam', () => {
    const d = [{ id: 'k', area_id: null, name: 'Stekker kerstboom' }] as HaDevice[];
    const e = [ent('switch.kerstboom', 'k')];
    expect(findPlugs(new Map([['switch.kerstboom', st('switch.kerstboom', 'off')]]), e, d)).toMatchObject([{ id: 'stekker-stekker-kerstboom', naam: 'Stekker kerstboom', estimatedW: 1000 }]);
    expect(findPlugs(new Map([['switch.kerstboom', st('switch.kerstboom', 'off')]]), e, d)[0]?.power).toBeUndefined();
  });
});

/* ------------------------------------------------- op zon zetten en bewaren */

const gevonden = (): FoundHeatStore[] => findPlugs(staten(), entities, devices);
const leeg = { panelen: { ligging: null, aantal: null, voorkant: null, achterkant: null }, zekering: null, tarief: null };

describe('een stekker op zon zetten (besluit 264)', () => {
  it('komt als warmte bewaren in de configuratie, zonder graden, en die is geldig', () => {
    const check = validateConnection({ ...leeg, opZon: { 'stekker-smart-plug-verwarming-tuinhuis': true } }, { fasen: [], apparaten: [], buffers: gevonden() });
    expect(check.ok).toBe(true);
    const answers = (check as { answers: ConnectionAnswers }).answers;
    const raw = JSON.parse(readFileSync(exampleSitePath, 'utf-8')) as Record<string, unknown>;
    const applied = withConnection(raw, answers);
    expect(applied.toegevoegd).toContain('Smart plug - verwarming tuinhuis op zon');
    expect((applied.raw['heatStores'] as Record<string, unknown>[])[0]).toEqual({
      id: 'stekker-smart-plug-verwarming-tuinhuis',
      name: 'Smart plug - verwarming tuinhuis',
      kind: 'stekker',
      control: 'switch',
      actuator: `switch.${P}`,
      power: `sensor.${P}_power`,
      estimatedW: 1000,
    });
    const parsed = parseSiteConfig(applied.raw, { knownStrategies: defaultStrategies().ids });
    expect(parsed.ok && parsed.config.heatStores?.[0]).toMatchObject({ kind: 'stekker', minC: 0, sunC: 0, estimatedW: 1000 });
  });

  it('bewaart het vermogen dat de bewoner opgaf, en houdt het als de pagina het niet meestuurt', () => {
    const found = { fasen: [], apparaten: [], buffers: gevonden() };
    const id = 'stekker-smart-plug-verwarming-tuinhuis';
    const eerst = validateConnection({ ...leeg, opZon: { [id]: true }, vermogen: { [id]: 1800 } }, found);
    expect(eerst.ok && eerst.answers.buffers?.[0]?.opgegevenW).toBe(1800);
    const daarna = validateConnection({ ...leeg, opZon: { [id]: true } }, found, eerst.ok ? eerst.answers : null);
    expect(daarna.ok && daarna.answers.buffers?.[0]?.opgegevenW).toBe(1800);
    const raw = JSON.parse(readFileSync(exampleSitePath, 'utf-8')) as Record<string, unknown>;
    expect(daarna.ok && (withConnection(raw, daarna.answers).raw['heatStores'] as { estimatedW: number }[])[0]?.estimatedW).toBe(1800);
    // Leeg is weer weg; buiten 50 tot 3680 W of bij iets anders dan een stekker niet.
    const weg = validateConnection({ ...leeg, opZon: { [id]: true }, vermogen: { [id]: null } }, found, eerst.ok ? eerst.answers : null);
    expect(weg.ok && weg.answers.buffers?.[0]?.opgegevenW).toBeUndefined();
    expect(validateConnection({ ...leeg, vermogen: { [id]: 5000 } }, found).ok).toBe(false);
    expect(validateConnection({ ...leeg, vermogen: { droger: 800 } }, found).ok).toBe(false);
  });

  it('een stekker in de configuratie heeft geen temperatuur en gaat aan en uit', () => {
    const raw = JSON.parse(readFileSync(exampleSitePath, 'utf-8')) as Record<string, unknown>;
    const fout = parseSiteConfig({ ...raw, heatStores: [{ id: 's', name: 'S', kind: 'stekker', control: 'setpoint', actuator: 'switch.s', temperature: 'sensor.t' }] }, { knownStrategies: defaultStrategies().ids });
    expect(fout.ok).toBe(false);
  });
});

/* ------------------------------------------------------------- de kern */

// 12:00 UTC is 14:00 in Amsterdam.
const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);
const UUR = 3_600_000;

const stekker: HeatStore = {
  id: 'tuinhuis',
  name: 'Smart plug - verwarming tuinhuis',
  kind: 'stekker',
  control: 'switch',
  actuator: { adapter: 'homeassistant', id: `switch.${P}` },
  power: { adapter: 'homeassistant', id: `sensor.${P}_power` },
  estimatedW: 1000,
  minC: 0,
  sunC: 0,
  heatRateCPerHour: 1,
};
const cfg: SiteConfig = { ...exampleSite, deferrables: [], heatStores: [stekker] };

const actuator = () => ({
  action: value('off' as const, NOW),
  setpointC: unavailable<number>(),
  powerW: value(0, NOW),
  lastChangeMs: NOW - UUR,
  producing: unavailable<boolean>('missing'),
  producingSinceMs: null,
});

function state(gridPowerW: number, plug: { on: boolean; powerW?: number; learnedW?: number | null }, o: { stabilising?: boolean; cheap?: boolean } = {}): SystemState {
  return {
    nowMs: NOW,
    modeOverride: null,
    outdoorTemperatureC: unavailable<number>('missing'),
    solarProductionW: unavailable<number>('missing'),
    occupancy: { ricardo: value(true, NOW) },
    zones: { woonkamer: { temperatureC: value(21, NOW) }, badkamer: { temperatureC: value(20, NOW) }, zolder: { temperatureC: value(21, NOW) } },
    actuators: { nest: actuator(), badkamer: actuator(), 'ac-woonkamer': actuator(), 'ac-zolder': actuator() },
    power: { gridPowerW: value(gridPowerW, NOW) },
    timers: { stabilisation: { endsAtMs: o.stabilising ? NOW + 120_000 : null }, manualOverride: { endsAtMs: null } },
    lights: {},
    sunAboveHorizon: value(true, NOW),
    inputHealth: Object.fromEntries(exampleSite.criticalInputs.map((r) => [r.id, true])),
    ...(o.cheap ? { cheapWindows: [{ fromMs: NOW - UUR, toMs: NOW + UUR }] } : {}),
    heatStores: {
      tuinhuis: {
        temperatureC: unavailable<number>('missing'),
        ...(plug.powerW != null ? { powerW: value(plug.powerW, NOW) } : {}),
        on: value(plug.on, NOW),
        learnedW: plug.learnedW ?? null,
      },
    },
  };
}

const uitleg = (s: SystemState, c: SiteConfig = cfg): HeatStoreExplanation | undefined => decide({ config: c, state: s, strategies: defaultStrategies() }).explanation.heatStores?.find((h) => h.id === 'tuinhuis');

describe('de stekker op zon, meekijkend (besluit 264)', () => {
  it('zou aangaan als er genoeg zon over is, en wacht anders, met wat hij vraagt', () => {
    expect(uitleg(state(-1200, { on: false, powerW: 0 }))).toEqual({ id: 'tuinhuis', state: 'would_heat', reason: 'surplus_available', heating: false, powerW: 0, needW: 1000 });
    expect(uitleg(state(-700, { on: false, powerW: 0 }))).toMatchObject({ state: 'waiting', reason: 'surplus_insufficient', needW: 1000 });
  });

  it('vraagt wat hij de laatste keer trok, niet de schatting', () => {
    expect(uitleg(state(-1200, { on: false, powerW: 0, learnedW: 1800 }))).toMatchObject({ state: 'waiting', reason: 'surplus_insufficient', needW: 1800 });
    expect(uitleg(state(-1900, { on: false, powerW: 0, learnedW: 1800 }))).toMatchObject({ state: 'would_heat', needW: 1800 });
  });

  it('blijft aan bij een wolkje: een vijfde van zijn vermogen mag van het net komen', () => {
    // Hij trekt 1.500 W; 250 W van het net is binnen de marge (300 W plus de 50 W tolerantie).
    expect(uitleg(state(250, { on: true, powerW: 1500 }))).toMatchObject({ state: 'would_heat', reason: 'surplus_available', heating: true });
    // 400 W van het net is te veel: hij zou uitgaan.
    expect(uitleg(state(400, { on: true, powerW: 1500 }))).toMatchObject({ state: 'waiting', reason: 'surplus_insufficient', heating: true });
    // Uit start hij daar niet op: dan moet de hele 1.500 W er zijn.
    expect(uitleg(state(-1000, { on: false, powerW: 0, learnedW: 1500 }))).toMatchObject({ state: 'waiting', reason: 'surplus_insufficient' });
  });

  it('nooit van het net, ook niet in de goedkoopste uren; aan zonder iets te trekken is "vraagt niets"', () => {
    expect(uitleg(state(400, { on: false, powerW: 0 }, { cheap: true }))).toMatchObject({ state: 'waiting', reason: 'surplus_insufficient' });
    expect(uitleg(state(-2000, { on: true, powerW: 2 }))).toMatchObject({ state: 'full', reason: 'target_reached' });
  });

  it('geeft geen opdracht: SunArc kijkt alleen mee', () => {
    const d = decide({ config: cfg, state: state(-3000, { on: false, powerW: 0 }), strategies: defaultStrategies() });
    expect(d.commands).toEqual([]);
  });
});

describe('de kaart van de stekker (besluit 264)', () => {
  const kaart = (e: HeatStoreExplanation, lang: 'nl' | 'en' = 'nl') => residentBuffers(cfg, [e], NOW, lang)[0]!;
  it('zegt zonder graden wat hij zou doen', () => {
    expect(kaart({ id: 'tuinhuis', state: 'would_heat', reason: 'surplus_available', heating: false, needW: 1000 })).toMatchObject({ soort: 'stekker', kop: 'Zou nu aangaan', bron: 'zon', temperatuurC: null, keuzes: [] });
    expect(kaart({ id: 'tuinhuis', state: 'would_heat', reason: 'surplus_available', heating: true, powerW: 1480 })).toMatchObject({ kop: 'Aan op zon', vermogenW: 1480 });
    expect(kaart({ id: 'tuinhuis', state: 'waiting', reason: 'surplus_insufficient', heating: false, needW: 1800 }).zin).toBe('Hij gaat aan zodra er 1,8 kW zon over is.');
    expect(kaart({ id: 'tuinhuis', state: 'waiting', reason: 'surplus_insufficient', heating: true, powerW: 1500 })).toMatchObject({ kop: 'Zou nu uitgaan' });
    expect(kaart({ id: 'tuinhuis', state: 'full', reason: 'target_reached', heating: false }, 'en')).toMatchObject({ kop: 'On, draws nothing' });
  });
});

/* ------------------------------------------------------------ de bel */

describe('de bel bij een stekker (besluit 264)', () => {
  const bron = (stekkers: NonNullable<MeldingenBron['stekkers']>): MeldingenBron => ({ nu: NOW, zonderRuimte: [], volgen: [], batterijen: [], filters: [], meters: [], versie: null, winterdagen: null, stekkers });
  const id = 'stekker-smart-plug-verwarming-tuinhuis';
  const naam = 'Smart plug - verwarming tuinhuis';

  it('meldt een gevonden stekker en zijn meter, elk met een eigen weg', () => {
    const m = wat(bron([{ id, naam, opZon: false, meter: `sensor.${P}_energy`, meterErin: false }]));
    expect(m.map((x) => [x.id, x.titel, x.actie?.href])).toEqual([
      [`stekker:${id}`, `Stekker gevonden: ${naam}`, 'regeling.html#opzon'],
      [`stekker-meter:sensor.${P}_energy`, `Meter van ${naam} toevoegen`, 'energie.html#meters'],
    ]);
    expect(m[1]?.en.titel).toBe(`Add the meter of ${naam}`);
  });

  it('niets meer als hij op zon staat en zijn meter erbij is, of als hij geen meter heeft', () => {
    expect(wat(bron([{ id, naam, opZon: true, meter: `sensor.${P}_energy`, meterErin: true }]))).toEqual([]);
    expect(wat(bron([{ id, naam, opZon: true, meter: null, meterErin: false }]))).toEqual([]);
  });
});

describe('de meters van een stekker bij Energie (besluit 264)', () => {
  it('ziet gisteren en deze maand als een teller die opnieuw begint, de stand als apparaat', async () => {
    const { meterRole } = await import('../src/web/energy.js');
    expect(meterRole(`sensor.${P}_energy`, 'Smart plug - verwarming tuinhuis Energie', 'energy')).toBe('apparaat');
    for (const id of ['energy_today', 'energy_yesterday', 'energy_month']) expect(meterRole(`sensor.${P}_${id}`, 'Smart plug - verwarming tuinhuis Energie', 'energy')).toBe('periode');
  });
});

/* ---------------------------------------- met de hand (besluit 265) */

describe('een stekker met de hand (besluit 265)', async () => {
  const { Stekkerhand, stekkerMag, STEKKER_MAX_MS } = await import('../src/web/stekkerhand.js');
  const { isHandCall } = await import('../src/adapters/homeassistant/client.js');
  const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);

  function huis(mag = true, stand = 'off') {
    const toestand = new Map<string, string>([[`switch.${P}`, stand], [`sensor.${P}_power`, '0']]);
    const geschakeld: [string, boolean][] = [];
    let nu = T0;
    const h = new Stekkerhand({
      state: (id) => (toestand.has(id) ? { state: toestand.get(id)! } : undefined),
      schakel: async (id, aan) => {
        geschakeld.push([id, aan]);
        toestand.set(id, aan ? 'on' : 'off');
      },
      stekkers: () => [{ id: 'stekker-tuinhuis', naam: 'Tuinhuis', actuator: `switch.${P}`, power: `sensor.${P}_power`, mag }],
      nu: () => nu,
      map: null,
    });
    return { h, toestand, geschakeld, verder: (ms: number) => (nu += ms) };
  }

  it('zet hem aan tot een tijd, en daarna weer uit', async () => {
    const { h, geschakeld, verder } = huis();
    const uit = await h.zet('stekker-tuinhuis', true, T0 + UUR);
    expect(uit).toMatchObject({ ok: true, terug: { aan: true, was: false, totMs: T0 + UUR } });
    expect((await h.standen())[0]).toMatchObject({ aan: true, mag: true, actief: { aan: true, totMs: T0 + UUR } });
    verder(30 * 60_000);
    expect(await h.ronde()).toEqual([]);
    verder(31 * 60_000);
    expect(await h.ronde()).toEqual([`switch.${P} uit`]);
    expect(geschakeld).toEqual([[`switch.${P}`, true], [`switch.${P}`, false]]);
    expect(h.terugzetten).toEqual([]);
  });

  it('wie intussen zelf schakelde, wint; en uit tot een tijd zet hem daarna weer aan', async () => {
    const zelf = huis();
    await zelf.h.zet('stekker-tuinhuis', true, T0 + UUR);
    zelf.toestand.set(`switch.${P}`, 'off');
    zelf.verder(2 * UUR);
    expect(await zelf.h.ronde()).toEqual([]);
    const uit = huis(true, 'on');
    await uit.h.zet('stekker-tuinhuis', false, T0 + UUR);
    uit.verder(2 * UUR);
    expect(await uit.h.ronde()).toEqual([`switch.${P} aan`]);
  });

  it('alleen als de bewoner hem toeliet, met een eind binnen een dag; en de standen zonder deur kijken mee', async () => {
    expect(await huis(false).h.zet('stekker-tuinhuis', true, T0 + UUR)).toMatchObject({ ok: false });
    const { h } = huis();
    expect(await h.zet('stekker-tuinhuis', true, T0 + STEKKER_MAX_MS + 60_000)).toMatchObject({ ok: false });
    expect(await h.zet('stekker-tuinhuis', true, T0 - 1)).toMatchObject({ ok: false });
    expect(await h.zet('iets-anders', true, T0 + UUR)).toMatchObject({ ok: false });
    expect((await h.standen(false))[0]).toMatchObject({ mag: false, toegelaten: true });
  });

  it('rekent het eind zelf uit: minuten, of de eerstvolgende keer dat het die tijd is', async () => {
    const { h } = huis();
    expect(h.totMsVan({ duurMin: 30 })).toBe(T0 + 30 * 60_000);
    // 12:00 UTC is 13:00 in Amsterdam: 22:00 is vanavond, 08:00 morgen.
    expect(h.totMsVan({ klok: '22:00' })).toBe(Date.UTC(2026, 10, 7, 21, 0, 0));
    expect(h.totMsVan({ klok: '08:00' })).toBe(Date.UTC(2026, 10, 8, 7, 0, 0));
    expect(h.totMsVan({ klok: '25:00' })).toBeNull();
    expect(await h.zet('stekker-tuinhuis', true, { klok: '22:00' })).toMatchObject({ ok: true, terug: { totMs: Date.UTC(2026, 10, 7, 21, 0, 0) } });
  });

  it('de deur laat alleen aan en uit door op een toegelaten stekker', () => {
    const lijst = stekkerMag([{ id: 'a', naam: 'A', actuator: `switch.${P}`, mag: true }, { id: 'b', naam: 'B', actuator: 'switch.b', mag: false }], []);
    expect(lijst).toEqual([`switch.${P}`]);
    const mag = { klimaat: [], schakelaars: lijst };
    expect(isHandCall('switch', 'turn_on', {}, { entity_id: `switch.${P}` }, mag)).toBe(true);
    expect(isHandCall('switch', 'turn_off', {}, { entity_id: `switch.${P}` }, mag)).toBe(true);
    expect(isHandCall('switch', 'toggle', {}, { entity_id: `switch.${P}` }, mag)).toBe(false);
    expect(isHandCall('switch', 'turn_on', {}, { entity_id: 'switch.b' }, mag)).toBe(false);
    expect(isHandCall('switch', 'turn_on', { brightness: 1 }, { entity_id: `switch.${P}` }, mag)).toBe(false);
  });

  it('bewaart de toestemming per stekker, en houdt hem als de pagina hem niet meestuurt', () => {
    const found = { fasen: [], apparaten: [], buffers: gevonden() };
    const id = 'stekker-smart-plug-verwarming-tuinhuis';
    const ja = validateConnection({ ...leeg, bedienen: { [id]: true } }, found);
    expect(ja.ok && ja.answers.buffers?.[0]?.bedienen).toBe(true);
    const blijft = validateConnection({ ...leeg }, found, ja.ok ? ja.answers : null);
    expect(blijft.ok && blijft.answers.buffers?.[0]?.bedienen).toBe(true);
    const nee = validateConnection({ ...leeg, bedienen: { [id]: false } }, found, ja.ok ? ja.answers : null);
    expect(nee.ok && nee.answers.buffers?.[0]?.bedienen).toBeUndefined();
    expect(validateConnection({ ...leeg, bedienen: { [id]: 'ja' } }, found).ok).toBe(false);
  });
});

/* ---------------------------------- vaste tijden (besluit 266) */

describe('een stekker op een vaste tijd (besluit 266)', async () => {
  const { leesStap } = await import('../src/web/gepland.js');
  const { voerStapUit } = await import('../src/web/gepland-uit.js');

  it('een geplande stap is aan of uit, voor een vaste duur of tot een klok', () => {
    expect(leesStap({ pad: 'api/stekker', body: { id: 'stekker-tuinhuis', aan: true, duurMin: 120 } })).toMatchObject({ pad: 'api/stekker' });
    expect(leesStap({ pad: 'api/stekker', body: { id: 'stekker-tuinhuis', aan: false, klok: '22:00' } })).toMatchObject({ pad: 'api/stekker' });
    expect(typeof leesStap({ pad: 'api/stekker', body: { id: 'stekker-tuinhuis', aan: true, duurMin: 7 } })).toBe('string');
    expect(typeof leesStap({ pad: 'api/stekker', body: { id: 'switch.tuinhuis', aan: true, duurMin: 60 } })).toBe('string');
    expect(typeof leesStap({ pad: 'api/stekker', body: { id: 'stekker-tuinhuis', duurMin: 60 } })).toBe('string');
  });

  it('voert hem uit door de deur van met de hand, en niets zonder die deur', async () => {
    const gedaan: unknown[] = [];
    const deur = { tz: 'Europe/Amsterdam', stekker: async (id: string, aan: boolean, tot: unknown) => (gedaan.push([id, aan, tot]), { ok: true }) };
    expect(await voerStapUit({ pad: 'api/stekker', body: { id: 'stekker-tuinhuis', aan: true, duurMin: 60 } }, deur)).toEqual({ ok: true });
    expect(await voerStapUit({ pad: 'api/stekker', body: { id: 'stekker-tuinhuis', aan: false, klok: '22:00' } }, deur)).toEqual({ ok: true });
    expect(gedaan).toEqual([['stekker-tuinhuis', true, { duurMin: 60 }], ['stekker-tuinhuis', false, { klok: '22:00' }]]);
    expect(await voerStapUit({ pad: 'api/stekker', body: { id: 'stekker-tuinhuis', aan: true, duurMin: 60 } }, { tz: 'Europe/Amsterdam', stekker: null })).toBeNull();
  });
});
