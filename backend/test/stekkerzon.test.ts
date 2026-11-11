/**
 * Een slimme stekker op zon met een minimum, en echt geschakeld (besluit 267).
 */

import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
import { metOpZonVanNu, validateConnection, withConnection } from '../src/web/aansluiting.js';
import { residentBuffers } from '../src/web/buffers-bewoner.js';
import { findPlugs } from '../src/web/buffers-vinden.js';
import { StekkerZon, NIET_SNEL_MS, STEKKERZON_BESTAND } from '../src/web/stekkerzon.js';
import { aanTussen, BufferStore } from '../src/web/warmtebuffers.js';
import { nextLocalTime } from '../src/web/today.js';
import { exampleSite, exampleSitePath } from './site.js';

const UUR = 3_600_000;
const MIN = 60_000;
// 12:00 UTC is 13:00 in Amsterdam (november).
const NOW = Date.UTC(2026, 10, 7, 12, 0, 0);
// 22:00 in Amsterdam is 21:00 UTC.
const TIEN = Date.UTC(2026, 10, 7, 21, 0, 0);

const stekker: HeatStore = {
  id: 'pomp',
  name: 'Vijverpomp',
  kind: 'stekker',
  control: 'switch',
  actuator: { adapter: 'homeassistant', id: 'switch.pomp' },
  power: { adapter: 'homeassistant', id: 'sensor.pomp_power' },
  estimatedW: 500,
  minC: 0,
  sunC: 0,
  heatRateCPerHour: 1,
  minimum: { minutes: 120, by: '22:00' },
};
const cfg: SiteConfig = { ...exampleSite, deferrables: [], heatStores: [stekker] };

const actuator = (nu: number) => ({
  action: value('off' as const, nu),
  setpointC: unavailable<number>(),
  powerW: value(0, nu),
  lastChangeMs: nu - UUR,
  producing: unavailable<boolean>('missing'),
  producingSinceMs: null,
});

function state(nu: number, gridPowerW: number, plug: { on: boolean; powerW: number }, minimum: { atMs: number; remainingMs: number } | null): SystemState {
  return {
    nowMs: nu,
    modeOverride: null,
    outdoorTemperatureC: unavailable<number>('missing'),
    solarProductionW: unavailable<number>('missing'),
    occupancy: { ricardo: value(true, nu) },
    zones: { woonkamer: { temperatureC: value(21, nu) }, badkamer: { temperatureC: value(20, nu) }, zolder: { temperatureC: value(21, nu) } },
    actuators: { nest: actuator(nu), badkamer: actuator(nu), 'ac-woonkamer': actuator(nu), 'ac-zolder': actuator(nu) },
    power: { gridPowerW: value(gridPowerW, nu) },
    timers: { stabilisation: { endsAtMs: null }, manualOverride: { endsAtMs: null } },
    lights: {},
    sunAboveHorizon: value(true, nu),
    inputHealth: Object.fromEntries(exampleSite.criticalInputs.map((r) => [r.id, true])),
    heatStores: {
      pomp: { temperatureC: unavailable<number>('missing'), powerW: value(plug.powerW, nu), on: value(plug.on, nu), learnedW: 500, minimum },
    },
  };
}

const uitleg = (s: SystemState): HeatStoreExplanation | undefined => decide({ config: cfg, state: s, strategies: defaultStrategies() }).explanation.heatStores?.find((h) => h.id === 'pomp');

describe('een stekker met een minimum per dag (besluit 267)', () => {
  it('wacht op zon zolang het nog kan, en zegt wanneer hij anders aangaat', () => {
    const e = uitleg(state(NOW, 200, { on: false, powerW: 0 }, { atMs: TIEN, remainingMs: 2 * UUR }));
    // Twee uur voor 22:00, met een half uur ruimte: om 19:30.
    expect(e).toMatchObject({ state: 'waiting', reason: 'surplus_insufficient', readyByMs: TIEN, latestStartMs: TIEN - 2.5 * UUR, minimumLeftMin: 120 });
  });

  it('gaat op het laatst van het net aan, en blijft dan aan tot hij het heeft', () => {
    const laatst = TIEN - 2.5 * UUR;
    expect(uitleg(state(laatst - MIN, 200, { on: false, powerW: 0 }, { atMs: TIEN, remainingMs: 2 * UUR }))).toMatchObject({ state: 'waiting' });
    expect(uitleg(state(laatst, 200, { on: false, powerW: 0 }, { atMs: TIEN, remainingMs: 2 * UUR }))).toMatchObject({ state: 'would_heat', reason: 'ready_by', heating: false });
    // Hij staat aan en het net levert alles: door, ook als hij net iets voor zijn laatste moment is.
    expect(uitleg(state(laatst + 10 * MIN, 700, { on: true, powerW: 500 }, { atMs: TIEN, remainingMs: 2 * UUR - 20 * MIN }))).toMatchObject({ state: 'would_heat', reason: 'ready_by', heating: true });
    // Heeft hij het, dan weer alleen op zon.
    expect(uitleg(state(laatst + 2 * UUR, 700, { on: true, powerW: 500 }, { atMs: TIEN, remainingMs: 0 }))).toMatchObject({ state: 'waiting', reason: 'surplus_insufficient' });
  });

  it('op zon gaat hij gewoon aan, ook met een minimum; en ook op het laatst eerst op zon', () => {
    expect(uitleg(state(NOW, -900, { on: false, powerW: 0 }, { atMs: TIEN, remainingMs: 2 * UUR }))).toMatchObject({ state: 'would_heat', reason: 'surplus_available' });
    const laatst = TIEN - 2.5 * UUR;
    expect(uitleg(state(laatst, -900, { on: false, powerW: 0 }, { atMs: TIEN, remainingMs: 2 * UUR }))).toMatchObject({ state: 'would_heat', reason: 'surplus_available' });
    expect(uitleg(state(laatst + 10 * MIN, -300, { on: true, powerW: 500 }, { atMs: TIEN, remainingMs: 2 * UUR - 10 * MIN }))).toMatchObject({ state: 'would_heat', reason: 'surplus_available', heating: true });
  });

  it('de kaart zegt het in gewone woorden', () => {
    const wacht = uitleg(state(NOW, 200, { on: false, powerW: 0 }, { atMs: TIEN, remainingMs: 2 * UUR }))!;
    const [k] = residentBuffers(cfg, [wacht], NOW);
    expect(k?.zin).toBe('Hij gaat aan zodra er 0,5 kW zon over is. Komt die niet, dan gaat hij om 19:30 aan: zo staat hij vóór 22:00 toch 2 uur aan.');
    expect(k?.minimum).toEqual({ minuten: 120, klok: '22:00', nogMin: 120 });
    const net = uitleg(state(TIEN - 2 * UUR, 700, { on: true, powerW: 500 }, { atMs: TIEN, remainingMs: UUR }))!;
    expect(residentBuffers(cfg, [net], NOW)[0]).toMatchObject({ kop: 'Aan voor zijn minimum', bron: 'net' });
    const klaar = uitleg(state(NOW, 200, { on: false, powerW: 0 }, { atMs: TIEN, remainingMs: 0 }))!;
    expect(residentBuffers(cfg, [klaar], NOW)[0]?.zin).toContain('Zijn 2 uur vóór 22:00 heeft hij al.');
  });
});

describe('hoe lang een stekker aan was (besluit 267)', () => {
  it('telt de stukken in het venster, en wat nu nog loopt', () => {
    expect(aanTussen([{ van: 0, tot: 10 }, { van: 20, tot: 30 }], 40, 5, 50)).toBe(5 + 10 + 10);
  });

  it('onthoudt wanneer hij aan was, ook na een herstart, en rekent het minimum uit', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'stekkerzon-'));
    let nu = NOW;
    const store = new BufferStore({ logDir: dir, config: cfg, now: () => nu });
    await store.load();
    expect(store.extra['pomp']?.minimum).toEqual({ atMs: TIEN, remainingMs: 2 * UUR });
    const e = (heating: boolean): HeatStoreExplanation => ({ id: 'pomp', state: heating ? 'would_heat' : 'waiting', reason: 'surplus_available', heating });
    await store.observe([e(true)]);
    nu += 45 * MIN;
    await store.observe([e(false)]);
    nu += 15 * MIN;
    await store.observe([e(true)]);
    nu += 30 * MIN;
    expect(store.extra['pomp']?.minimum).toEqual({ atMs: TIEN, remainingMs: 45 * MIN });
    expect(store.aanGehad('pomp')).toBe(75);
    const opnieuw = new BufferStore({ logDir: dir, config: cfg, now: () => nu });
    await opnieuw.load();
    expect(opnieuw.extra['pomp']?.minimum?.remainingMs).toBe(45 * MIN);
    // Na 22:00 begint een nieuwe dag: de minuut erna telt al voor morgen.
    nu = TIEN + MIN;
    await opnieuw.observe([e(false)]);
    expect(opnieuw.extra['pomp']?.minimum).toEqual({ atMs: TIEN + 24 * UUR, remainingMs: 2 * UUR - MIN });
  });
});

describe('de eerstvolgende keer dat het een tijd is', () => {
  it('is na 22:00 morgen, niet overmorgen', () => {
    const tz = 'Europe/Amsterdam';
    expect(nextLocalTime(Date.UTC(2026, 10, 9, 22, 0), '22:00', tz)).toBe(Date.UTC(2026, 10, 10, 21, 0));
    expect(nextLocalTime(Date.UTC(2026, 10, 9, 22, 30), '00:00', tz)).toBe(Date.UTC(2026, 10, 9, 23, 0));
    expect(nextLocalTime(Date.UTC(2026, 10, 9, 5, 0), '22:00', tz)).toBe(Date.UTC(2026, 10, 9, 21, 0));
    // Rond de zomertijd: de dag van 23 uur en die van 25 uur.
    expect(nextLocalTime(Date.UTC(2026, 2, 28, 22, 30), '22:00', tz)).toBe(Date.UTC(2026, 2, 29, 20, 0));
    expect(nextLocalTime(Date.UTC(2026, 9, 24, 21, 30), '22:00', tz)).toBe(Date.UTC(2026, 9, 25, 21, 0));
  });
});

/* ------------------------------------------------ echt schakelen */

function huis(o: { mag?: boolean; opZon?: boolean; stand?: string; hand?: boolean; aan?: boolean; map?: string | null } = {}) {
  const toestand = new Map<string, string>([['switch.pomp', o.stand ?? 'off']]);
  const geschakeld: [string, boolean][] = [];
  let nu = NOW;
  const maak = () =>
    new StekkerZon({
      state: (id) => (toestand.has(id) ? { state: toestand.get(id)! } : undefined),
      schakel: async (id, aan) => {
        geschakeld.push([id, aan]);
        toestand.set(id, aan ? 'on' : 'off');
      },
      stekkers: () => [{ id: 'pomp', naam: 'Vijverpomp', actuator: 'switch.pomp', mag: o.mag ?? true }],
      opZon: () => new Set(o.opZon === false ? [] : ['pomp']),
      metDeHand: () => new Set(o.hand ? ['pomp'] : []),
      aan: () => o.aan ?? true,
      nu: () => nu,
      map: o.map ?? null,
    });
  return { z: maak(), maak, toestand, geschakeld, verder: (ms: number) => (nu += ms) };
}
const besluit = (state: HeatStoreExplanation['state'], reason: HeatStoreExplanation['reason'] = 'surplus_available', heating = false): HeatStoreExplanation[] => [{ id: 'pomp', state, reason, heating }];

describe('een stekker op zon, echt geschakeld (besluit 267)', () => {
  it('zet hem aan op zon en weer uit als de zon wegvalt', async () => {
    const { z, geschakeld, verder } = huis();
    expect(await z.opBesluit(besluit('would_heat'))).toEqual(['switch.pomp aan op zon']);
    expect(z.stand('pomp')).toMatchObject({ schakelt: true, vanSunArc: true });
    expect(z.eigen).toEqual(['switch.pomp']);
    // Niet steeds aan en uit: binnen tien minuten blijft hij aan.
    verder(5 * MIN);
    expect(await z.opBesluit(besluit('waiting', 'surplus_insufficient', true))).toEqual([]);
    verder(NIET_SNEL_MS);
    expect(await z.opBesluit(besluit('waiting', 'surplus_insufficient', true))).toEqual(['switch.pomp uit']);
    expect(geschakeld).toEqual([['switch.pomp', true], ['switch.pomp', false]]);
    expect(z.eigen).toEqual([]);
  });

  it('voor zijn minimum ook van het net', async () => {
    const { z } = huis();
    expect(await z.opBesluit(besluit('would_heat', 'ready_by'))).toEqual(['switch.pomp aan voor zijn minimum']);
  });

  it('wat de bewoner zelf aanzette, laat hij aan', async () => {
    const { z, geschakeld } = huis({ stand: 'on' });
    expect(await z.opBesluit(besluit('waiting', 'surplus_insufficient', true))).toEqual([]);
    expect(geschakeld).toEqual([]);
  });

  it('zette de bewoner hem uit, dan tot middernacht met rust', async () => {
    const { z, toestand, verder } = huis();
    await z.opBesluit(besluit('would_heat'));
    verder(30 * MIN);
    toestand.set('switch.pomp', 'off');
    expect(await z.opBesluit(besluit('would_heat'))).toEqual([]);
    expect(z.stand('pomp').rustTot).toBe(Date.UTC(2026, 10, 7, 23, 0));
    verder(UUR);
    expect(await z.opBesluit(besluit('would_heat'))).toEqual([]);
    // Na middernacht weer.
    verder(10 * UUR);
    expect(await z.opBesluit(besluit('would_heat'))).toEqual(['switch.pomp aan op zon']);
  });

  it('niet zonder toestemming, niet buiten de add-on, niet als hij niet op zon staat, en niet met de hand', async () => {
    for (const o of [{ mag: false }, { aan: false }, { opZon: false }, { hand: true }]) {
      const { z, geschakeld } = huis(o);
      expect(await z.opBesluit(besluit('would_heat'))).toEqual([]);
      expect(geschakeld).toEqual([]);
      expect(z.stand('pomp').schakelt).toBe('hand' in o);
    }
  });

  it('laat de bewoner hem niet meer toe, dan gaat wat SunArc aanzette meteen uit', async () => {
    const o: { mag: boolean } = { mag: true };
    const h = huis(o);
    await h.z.opBesluit(besluit('would_heat'));
    o.mag = false;
    // Niet wachten op de tien minuten; de deur laat hem door, want SunArc zette hem aan.
    h.verder(MIN);
    expect(h.z.eigen).toEqual(['switch.pomp']);
    expect(await h.z.opBesluit(besluit('would_heat', 'surplus_available', true))).toEqual(['switch.pomp uit']);
    expect(h.z.eigen).toEqual([]);
  });

  it('van zon gehaald (besluit 290), dan gaat wat SunArc aanzette uit, ook zonder besluit over hem', async () => {
    const o: { opZon: boolean } = { opZon: true };
    const h = huis(o);
    await h.z.opBesluit(besluit('would_heat'));
    o.opZon = false;
    h.verder(MIN);
    // Niet meer in de configuratie: het besluit noemt hem niet meer.
    expect(await h.z.opBesluit(undefined)).toEqual(['switch.pomp uit']);
    expect(h.z.eigen).toEqual([]);
    expect(h.geschakeld).toEqual([['switch.pomp', true], ['switch.pomp', false]]);
  });

  it('van zon gehaald terwijl hij al uit stond: dan alleen vergeten', async () => {
    const o: { opZon: boolean } = { opZon: true };
    const h = huis(o);
    await h.z.opBesluit(besluit('would_heat'));
    o.opZon = false;
    // Binnen de tien minuten zelf uitgezet, en dan van zon gehaald.
    h.toestand.set('switch.pomp', 'off');
    expect(await h.z.opBesluit(undefined)).toEqual([]);
    expect(h.z.eigen).toEqual([]);
  });

  it('onthoudt wat hij aanzette, ook na een herstart', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'stekkerzon-'));
    const h = huis({ map: dir });
    await h.z.opBesluit(besluit('would_heat'));
    expect(JSON.parse(await readFile(join(dir, STEKKERZON_BESTAND), 'utf8'))).toMatchObject({ versie: 1, eigen: { pomp: { actuator: 'switch.pomp' } } });
    h.verder(NIET_SNEL_MS);
    const na = h.maak();
    expect(await na.opBesluit(besluit('waiting', 'surplus_insufficient', true))).toEqual(['switch.pomp uit']);
  });
});

/* ------------------------------------------------ de aansluiting */

const P = 'smart_plug_verwarming_tuinhuis';
const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): HaEntityState => ({ entity_id, state, attributes, last_changed: '', last_updated: '' }) as HaEntityState;
const devices: HaDevice[] = [{ id: 'd1', name: 'Smart plug - verwarming tuinhuis', model: 'Smart Plug' } as HaDevice];
const entities: HaRegistryEntity[] = [
  { entity_id: `switch.${P}`, device_id: 'd1', platform: 'mqtt' },
  { entity_id: `sensor.${P}_power`, device_id: 'd1', platform: 'mqtt' },
];
const staten = new Map<string, HaEntityState>([
  [`switch.${P}`, st(`switch.${P}`, 'off', { friendly_name: 'Smart plug - verwarming tuinhuis' })],
  [`sensor.${P}_power`, st(`sensor.${P}_power`, '0', { unit_of_measurement: 'W', device_class: 'power' })],
]);
const leeg = { panelen: { ligging: null, aantal: null, voorkant: null, achterkant: null }, zekering: null, tarief: null };

describe('het minimum bewaren (besluit 267)', () => {
  it('komt in de configuratie, blijft als de pagina het niet stuurt, en kan weer weg', () => {
    const found = { fasen: [], apparaten: [], buffers: findPlugs(staten, entities, devices) };
    const id = found.buffers[0]!.id;
    const ja = validateConnection({ ...leeg, opZon: { [id]: true }, minimum: { [id]: { minuten: 120, klok: '22:00' } } }, found);
    expect(ja.ok && ja.answers.buffers?.[0]?.minimum).toEqual({ minuten: 120, klok: '22:00' });
    const raw = JSON.parse(readFileSync(exampleSitePath, 'utf-8')) as Record<string, unknown>;
    const applied = withConnection(raw, ja.ok ? ja.answers : (null as never));
    expect((applied.raw['heatStores'] as Record<string, unknown>[])[0]?.['minimum']).toEqual({ minutes: 120, by: '22:00' });
    const parsed = parseSiteConfig(applied.raw, { knownStrategies: defaultStrategies().ids });
    expect(parsed.ok && parsed.config.heatStores?.[0]?.minimum).toEqual({ minutes: 120, by: '22:00' });
    const blijft = validateConnection({ ...leeg, opZon: { [id]: true } }, found, ja.ok ? ja.answers : null);
    expect(blijft.ok && blijft.answers.buffers?.[0]?.minimum).toEqual({ minuten: 120, klok: '22:00' });
    const weg = validateConnection({ ...leeg, opZon: { [id]: true }, minimum: { [id]: null } }, found, ja.ok ? ja.answers : null);
    expect(weg.ok && weg.answers.buffers?.[0]?.minimum).toBeUndefined();
    for (const fout of [{ minuten: 7, klok: '22:00' }, { minuten: 120, klok: '25:00' }, { minuten: 900, klok: '22:00' }, 'twee uur']) {
      expect(validateConnection({ ...leeg, minimum: { [id]: fout } }, found).ok).toBe(false);
    }
  });

  it('alleen een stekker kent een minimum', () => {
    const raw = JSON.parse(readFileSync(exampleSitePath, 'utf-8')) as Record<string, unknown>;
    const boiler = { id: 'b', name: 'Boiler', kind: 'boiler', control: 'switch', actuator: 'switch.b', minimum: { minutes: 60, by: '22:00' } };
    expect(parseSiteConfig({ ...raw, heatStores: [boiler] }, { knownStrategies: defaultStrategies().ids }).ok).toBe(false);
  });
});

describe('op zon gaat meteen in (besluit 290)', () => {
  it('neemt op zon van nu over, en laat de zekering zoals bij het starten', () => {
    const found = { fasen: [], apparaten: [], buffers: findPlugs(staten, entities, devices) };
    const id = found.buffers[0]!.id;
    const start = validateConnection({ ...leeg, zekering: { fasen: 1, ampere: 35 }, opZon: { [id]: true } }, found);
    const nu = validateConnection({ ...leeg, zekering: { fasen: 3, ampere: 25 }, opZon: { [id]: false } }, found);
    if (!start.ok || !nu.ok) throw new Error('niet geldig');
    const samen = metOpZonVanNu(start.answers, nu.answers);
    expect(samen.zekering).toEqual({ fasen: 1, ampere: 35 });
    expect(samen.buffers?.[0]?.opZon).toBe(false);
    // Van zon gehaald: dan komt hij niet meer in de configuratie.
    const raw = JSON.parse(readFileSync(exampleSitePath, 'utf-8')) as Record<string, unknown>;
    expect(withConnection(raw, start.answers).raw['heatStores']).toHaveLength(1);
    expect(withConnection(raw, samen).raw['heatStores']).toBeUndefined();
    // Zonder antwoorden bij het starten: alleen op zon, geen zekering.
    expect(metOpZonVanNu(null, nu.answers).zekering).toBeNull();
  });
});
