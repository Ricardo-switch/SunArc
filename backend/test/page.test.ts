/**
 * De echte pagina in een echte browser (besluit 69).
 *
 * De webtests controleren wat de server stuurt; deze controleert wat een
 * browser ervan maakt. Bij het hernoemen van besluit 59 bleek hoe dun die grens
 * is: de pagina leest de sleutels van de API letterlijk (`dekking`, `versie`,
 * `versies`), en niets anders bewaakte dat beide kanten dezelfde gebruiken.
 *
 * De server draait in dit proces, met de gebouwde weergave uit `backend/web`
 * en gegevens die lijken op wat de NAS stuurt: een echt besluit van de arbiter
 * over een minuut uit de vaste replay, en een terugblik over drie dagen logboek
 * met twee versies. De browser is headless Chromium via Playwright.
 *
 * Alleen met `HEMS_PAGE_TEST=1`: de rest van de suite heeft geen browser nodig.
 * De CI zet hem aan in een eigen taak. Lokaal kan het met de Edge die er al
 * staat: `HEMS_PAGE_TEST=1 HEMS_PAGE_BROWSER=msedge npx vitest run test/page.test.ts`.
 *
 * Faalt een weergavetest, dan bewaart hij een Playwright-trace in
 * `test-results/`: elke stap met een schermafdruk, de netwerkverzoeken en de
 * console. De CI bewaart die map dan als artefact; openen kan op
 * trace.playwright.dev, of met `npx playwright show-trace`.
 */

import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContextOptions, type Page } from 'playwright';

import type { LiveSnapshot } from '../src/adapters/homeassistant/shadow.js';
import { recordRun } from '../src/adapters/runs.js';
import { decide } from '../src/core/decide.js';
import { Cursor, configAt, loadHistory, snapshot } from '../src/replay/reconstruct.js';
import { DivergenceCache } from '../src/web/divergence.js';
import { MeldingenStore } from '../src/web/meldingen.js';
import { changelog, updateView } from '../src/web/bijwerken.js';
import { FeedbackLog } from '../src/web/feedback.js';
import { WebServer } from '../src/web/server.js';
import { buildHouse, knownForLayout, proposeLayout } from '../src/web/house.js';
import { LayoutStore } from '../src/web/layout.js';
import { FunctiesStore, functiesGevonden } from '../src/web/functies.js';
import { LightSwitch } from '../src/web/lights.js';
import { UitstelStore } from '../src/web/uitstel.js';
import { STANDAARD_TEL, VoorkeurenStore } from '../src/web/voorkeuren.js';
import { accuView, type Opslag } from '../src/web/opslag.js';
import { WeatherLog } from '../src/web/weather.js';
import { EnergyStore, importFromPrefs, type EnergySource } from '../src/web/energy.js';
import { THERMISCH_FILE, type ThermischRapport } from '../src/web/thermisch.js';
import { ConnectionStore, connectionView, type FoundAppliance, type FoundPhase, type FoundPower } from '../src/web/aansluiting.js';
import { naarRd, type CityJson } from '../src/web/bag3d.js';

/** Wat het thermisch model zou hebben geleerd (besluit 231): twee kamers, de woonkamer zekerder dan de zolder. */
const THERMISCH_VOORBEELD = (nu: number): ThermischRapport => ({
  versie: 1,
  dag: new Date(nu).toISOString().slice(0, 10),
  sindsMs: Date.parse('2026-09-05T15:00:00Z'),
  dagen: 56,
  stand: 'leert',
  zones: [
    { id: 'woonkamer', naam: 'Woonkamer', k: 0.0082, tauUur: 122, rustUren: 555, zonPerKw: 0.28, zonKwartieren: 910, zeker: { afkoelen: 4, zon: 3 }, apparaten: [
      { id: 'nest', naam: 'Nest', stand: 'verwarmt', perUur: null, kwartieren: 181, zeker: 0 },
      { id: 'airco-woonkamer', naam: 'Airco woonkamer', stand: 'verwarmt', perUur: 1.02, kwartieren: 16, zeker: 1 },
      { id: 'airco-woonkamer', naam: 'Airco woonkamer', stand: 'koelt', perUur: -0.39, kwartieren: 294, zeker: 3 },
    ] },
    { id: 'zolder', naam: 'Zolder', k: 0.0102, tauUur: 98, rustUren: 541, zonPerKw: 0.29, zonKwartieren: 879, zeker: { afkoelen: 4, zon: 3 }, apparaten: [
      { id: 'airco-zolder', naam: 'Airco zolder', stand: 'verwarmt', perUur: null, kwartieren: 0, zeker: 0 },
      { id: 'airco-zolder', naam: 'Airco zolder', stand: 'koelt', perUur: -0.59, kwartieren: 63, zeker: 2 },
    ] },
  ],
});

/**
 * Een Home Assistant met een Energie-dashboard (besluit 102): net, zon, gas en
 * een airco, elke dag hetzelfde, een jaar eerder 80%.
 */
const ENERGY_SOURCE: EnergySource = {
  prefs: async () => ({
    energy_sources: [
      { type: 'grid', flow_from: [{ stat_energy_from: 'sensor.afname', number_energy_price: 0.25 }], flow_to: [{ stat_energy_to: 'sensor.terug' }] },
      { type: 'solar', stat_energy_from: 'sensor.zon' },
      { type: 'gas', stat_energy_from: 'sensor.gas', number_energy_price: 1.3 },
    ],
    device_consumption: [{ stat_consumption: 'sensor.airco', name: 'Airco woonkamer' }],
  }),
  meters: async () => [
    { id: 'sensor.afname', naam: 'P1 afname', soort: 'energy', rol: 'afname' },
    { id: 'sensor.terug', naam: 'P1 teruglevering', soort: 'energy', rol: 'teruglevering' },
    { id: 'sensor.zon', naam: 'SolarEdge opgewekt', soort: 'energy', rol: 'zon' },
    { id: 'sensor.airco', naam: 'Airco woonkamer energie', soort: 'energy', rol: 'apparaat' },
    { id: 'sensor.tv', naam: 'Tv energie', soort: 'energy', rol: 'apparaat' },
    { id: 'sensor.p1_totaal', naam: 'P1 import totaal', soort: 'energy', rol: 'afname' },
    { id: 'sensor.gas', naam: 'Gasmeter', soort: 'volume', rol: 'gas' },
  ],
  changes: async (ids, startMs, endMs, period) => {
    const hourly: Record<string, (h: number) => number> = {
      'sensor.afname': (h) => (h >= 10 && h < 17 ? 0 : 0.4),
      'sensor.terug': (h) => (h >= 10 && h < 17 ? 1 : 0),
      'sensor.zon': (h) => (h >= 10 && h < 17 ? 2 : 0),
      'sensor.airco': (h) => (h === 12 || h === 13 ? 0.5 : 0),
      'sensor.gas': (h) => (h === 7 ? 0.2 : 0),
    };
    const scale = (t: number) => (new Date(t).getUTCFullYear() < 2026 ? 0.8 : 1);
    const step = period === 'hour' ? 3_600_000 : 86_400_000;
    return Object.fromEntries(
      // Een statistiek die Home Assistant niet heeft, komt niet terug (issue 128).
      ids.filter((id) => hourly[id]).map((id) => {
        const rows = [];
        for (let t = startMs; t < endMs; t += step) {
          const h = (new Date(t).getUTCHours() + 2) % 24;
          const v = period === 'hour' ? hourly[id]!(h) : Array.from({ length: 24 }, (_, x) => hourly[id]!(x)).reduce((a, b) => a + b, 0);
          rows.push({ startMs: t, change: v * scale(t) });
        }
        return [id, rows];
      }),
    );
  },
};
import { SessionStore } from '../src/web/auth.js';
import { BewonersStore, GEEN_BEWONERS, alsScherm, bewonersView, comfortVanBewoner, gastStand, herken, leesActie, personenUit, profielenVan, voegToe, voerUit, type Bewoners } from '../src/web/bewoners.js';
import { registers as houseRegisters, states as houseStates } from './house-fixture.js';
import { klaarzetten } from '../src/web/klaarzetten.js';
import { klaarFuncties } from '../src/web/klaarzetten-functies.js';
import { Sluipverbruik } from '../src/web/sluipverbruik.js';
import { CoverSwitch } from '../src/web/covers.js';
import type { HouseBattery, HouseReport } from '../src/web/house.js';

/** Schermopdrachten die de nagemaakte Home Assistant kreeg (besluit 121). */
const coverCalls: string[] = [];
/** Bijwerken vanuit de app (21 oktober 2026): of er een versie klaarstaat, en hoe vaak er op Bijwerken getikt is. */
const updateNu = { klaar: false, installeer: 0, zoek: 0, herstart: 0 };
let meldingenStore: MeldingenStore;
/** Batterijen die een test erbij zet (besluit 122); leeg is: wat het huis zegt. */
let extraBatterijen: HouseBattery[] = [];
/** De integratie in Home Assistant (besluit 184), zoals de nagebootste add-on hem ziet. */
let integratieNu: { kan: boolean; staat: 'nee' | 'add-on' | 'anders'; versie: string | null; nieuw: string | null; oud: 'nee' | 'add-on' | 'rest' | 'anders'; geladen: string | null; toegevoegd: boolean | null } = { kan: true, staat: 'nee', versie: null, nieuw: VERSIE, oud: 'nee', geladen: null, toegevoegd: null };
/** De proefmeldingen die de app vroeg (besluit 183), per account. */
const proefmeldingen: (string | null)[] = [];
/** Een thuisbatterij en een auto die een test erbij zet (besluit 182); null is: wat het huis zegt. */
let extraOpslag: Opslag | null = null;
/** Laden met de hand (besluit 262): wat de pagina stuurde, en wat er nu met de hand loopt. */
const ladenGestuurd: unknown[] = [];
let ladenActief: { stroomA: number | null; pauze: boolean; tot: 'uur' | 'tijd' | 'pct' | 'kabel'; totMs: number; pct: number | null } | null = null;
/** De plek van het testhuis voor de kaart (5 november 2026), in Utrecht. */
const KAART_PLEK = { lat: 52.0907, lon: 5.1214 } as const;
/** Een nagemaakt kaartvak van 3D BAG rond die plek: het huis met een zadeldak (nok noord-zuid), en een buur 12 meter oostelijk. */
function nepBagVak(): CityJson {
  const [X, Y] = naarRd(KAART_PLEK.lat, KAART_PLEK.lon);
  const v: number[][] = [];
  const punt = (x: number, y: number, z: number) => v.push([Math.round((X + x) * 1000), Math.round((Y + y) * 1000), z * 1000]) - 1;
  const huis = (ox: number, id: string) => {
    const g = [punt(ox - 4, -5, 0), punt(ox + 4, -5, 0), punt(ox + 4, 5, 0), punt(ox - 4, 5, 0)];
    const oost = [punt(ox, -5, 9), punt(ox + 4, -5, 5), punt(ox + 4, 5, 5), punt(ox, 5, 9)];
    const west = [punt(ox - 4, -5, 5), punt(ox, -5, 9), punt(ox, 5, 9), punt(ox - 4, 5, 5)];
    return {
      [id]: { type: 'Building', attributes: {}, children: [`${id}-0`], geometry: [{ type: 'MultiSurface', lod: '0', boundaries: [[g]] }] },
      [`${id}-0`]: {
        type: 'BuildingPart',
        geometry: [{ type: 'Solid', lod: '2.2', boundaries: [[[g], [oost], [west]]], semantics: { surfaces: [{ type: 'GroundSurface' }, { type: 'RoofSurface', b3_azimut: 90, b3_hellingshoek: 45 }, { type: 'RoofSurface', b3_azimut: 270, b3_hellingshoek: 45 }], values: [[0, 1, 2]] } }],
      },
    };
  };
  return { transform: { scale: [0.001, 0.001, 0.001], translate: [0, 0, 0] }, vertices: v, CityObjects: { ...huis(0, 'NL.IMBAG.Pand.1'), ...huis(12, 'NL.IMBAG.Pand.2') } };
}

/** De deurbel als kaart (besluit 182); null is: geen deurbel. */
let extraDeurbel: { camera: string; naam: string; laatsteMs: number | null; reserve?: string[] } | null = null;
/** Nog een camera naast de deurbel, voor de kaart Camera's (besluit 201); hij ziet nu een persoon. */
let extraOprit = false;
const metBatterijen = (h: HouseReport): HouseReport => ({ ...(extraBatterijen.length ? { ...h, batterijen: extraBatterijen } : h), ...(extraOpslag ? { opslag: extraOpslag } : {}) });
import { onUsablePort } from './ports.js';
import { exampleSite, exampleSitePath } from './site.js';
import { readFileSync } from 'node:fs';
import { parseSiteConfig } from '../src/config/schema.js';
import { defaultStrategies } from '../src/index.js';
import { NIEUW, VERSIE, eersteVan } from '../src/version.js';
import { comfortView, controleerComfort, withComfort, type Comfort } from '../src/web/comfort.js';
import type { SiteConfig } from '../src/core/model.js';

/* Comfort (besluit 130): in het geheugen, met hetzelfde schema als de dienst. */
const rauweConfig = JSON.parse(readFileSync(exampleSitePath, 'utf-8')) as Record<string, unknown>;
let comfortNu: Comfort | null = null;
let configNu: SiteConfig = exampleSite;
const comfortDeur = {
  view: () => comfortView(configNu, comfortNu),
  save: async (body: unknown) => {
    const c = controleerComfort(body, configNu);
    if (!c.ok) return { ok: false as const, status: 400, reden: c.reden };
    const checked = parseSiteConfig(withComfort(rauweConfig, c.comfort).raw, { knownStrategies: defaultStrategies().ids });
    if (!checked.ok) return { ok: false as const, status: 400, reden: checked.problems[0]?.message ?? 'past niet' };
    comfortNu = c.comfort;
    configNu = checked.config;
    return { ok: true as const, view: comfortView(configNu, comfortNu) };
  },
};

const ENABLED = process.env['HEMS_PAGE_TEST'] === '1';
const WEB_DIR = fileURLToPath(new URL('../web', import.meta.url));
const FIXTURE = fileURLToPath(new URL('./fixtures/replay-2026-08-26.ndjson.gz', import.meta.url));

/** Een echt besluit: 26 augustus om 13:00, uit de vaste replay. */
async function liveSnapshot(): Promise<LiveSnapshot> {
  const history = await loadHistory(FIXTURE);
  const cursor = new Cursor(history);
  const t = Date.parse('2026-08-26T11:00:00Z');
  cursor.advanceTo(t);
  const config = configAt(exampleSite, cursor);
  const decision = decide({
    config,
    state: snapshot(config, cursor, t),
    strategies: defaultStrategies(),
  });
  const observed: Record<string, string> = {};
  for (const a of config.actuators) {
    const s = cursor.state(a.ref.id);
    const setpoint = cursor.attrNumber(a.ref.id, 'temperature');
    observed[a.id] = s == null ? 'onbekend' : setpoint == null ? s : `${s}@${setpoint}`;
  }
  return {
    atMs: t,
    trigger: 'hartslag',
    changed: true,
    explanation: decision.explanation,
    commands: decision.commands,
    accepted: decision.accepted,
    rejected: decision.rejected,
    observed,
    legacy: null,
  };
}

const DAYS = ['2026-09-28', '2026-09-29', '2026-09-30'];

/** Drie dagen logboek, één record per minuut, met afwijkingen erin. */
async function writeLogs(dir: string): Promise<void> {
  for (const [d, day] of DAYS.entries()) {
    const lines: string[] = [];
    const start = Date.parse(`${day}T00:00:00Z`);
    for (let m = 0; m < 1440; m += 1) {
      const t = start + m * 60_000;
      const sunny = m > 600 && m < 900;
      const legacyOn = sunny && m % 120 < 80;
      const full = m % 10 === 0;
      lines.push(
        JSON.stringify({
          t,
          changed: full,
          mode: 'dag',
          budget: {
            availableW: sunny ? 1500 : 0,
            allocatedW: sunny ? 900 : 0,
            surplusW: sunny ? 1500 : 0,
            reclaimableW: legacyOn ? 900 : 0,
            gridPowerW: sunny ? -800 : 300 + d * 10,
          },
          zonesT: [['woonkamer', 23.5, sunny ? 'cool' : 'none', null]],
          obs: { 'ac-woonkamer': legacyOn ? 'cool@22' : 'off', 'ac-zolder': 'off' },
          buitenC: 16,
          zonW: sunny ? 1500 : 0,
          ...(full
            ? {
                accepted: sunny ? [{ actuatorId: 'ac-woonkamer', action: 'cool', strategyId: 'pv-surplus' }] : [],
                commands: [],
                rejected: [],
              }
            : {}),
        }),
      );
    }
    await writeFile(join(dir, `decisions-${day}.ndjson`), `${lines.join('\n')}\n`, 'utf-8');
  }
  // Twee versies, elk midden op een dag, zodat de markering op die rij valt.
  await recordRun(dir, { t: Date.parse('2026-09-28T12:00:00Z'), commit: 'aaaaaaa', built: null, config: 'c1', site: 'huis-cornelissen' });
  await recordRun(dir, { t: Date.parse('2026-09-30T12:00:00Z'), commit: 'bbbbbbb', built: null, config: 'c1', site: 'huis-cornelissen' });
}

describe.skipIf(!ENABLED)('de pagina in een browser (besluit 69)', () => {
  let dir: string;
  let server: WebServer;
  let browser: Browser;
  let page: Page;
  let live: LiveSnapshot;
  let baseUrl: string;
  let layoutStore: LayoutStore;
  let uitstel: UitstelStore;
  let energyStore: EnergyStore;
  let connStore: ConnectionStore;
  let accuHuis: { reg: Parameters<typeof accuView>[0]; states: Parameters<typeof accuView>[1] };
  let functiesStore: FunctiesStore;
  const sessions = new SessionStore();
  let sessionId = '';
  /** Bewoners (besluit 147), met een echt bestand. */
  let bewonersStore: BewonersStore;
  const startBewoners: Bewoners = alsScherm(GEEN_BEWONERS, { userId: 'u', naam: 'Test' }, Date.now());
  /** Waar het inloggen van Home Assistant staat; een test kan er een nagemaakt Home Assistant op een andere site van maken. */
  let haInlog = 'http://ha.local/';
  /** De echte fetch: hieronder krijgt elke vraag aan de testdienst de inlog mee. */
  const echteFetch = globalThis.fetch;
  let stopCamera: () => Promise<void> = async () => {};
  /** Hoeveel live-beelden de nagemaakte Home Assistant nu geeft. */
  let liveOpen = 0;
  const pageErrors: string[] = [];
  const lightCalls: string[] = [];
  const lightData: Record<string, unknown>[] = [];
  const sceneCalls: string[] = [];
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];

  beforeAll(async () => {
    expect(existsSync(join(WEB_DIR, 'app.js')), 'eerst de weergave bouwen: npm run build in frontend/').toBe(true);

    dir = await mkdtemp(join(tmpdir(), 'hems-page-'));
    await writeLogs(dir);
    // Hoe het huis warmte vasthoudt (besluit 231): wat het van vandaag al heeft uitgerekend.
    await writeFile(join(dir, THERMISCH_FILE), JSON.stringify(THERMISCH_VOORBEELD(Date.now())));
    const review = new DivergenceCache({ logDir: dir, write: () => {}, now: () => Date.parse('2026-10-01T00:30:00Z') });
    await review.refresh();
    live = await liveSnapshot();
    // De droger staat klaar, met een programma van 2 u 48 (besluit 101).
    live = { ...live, explanation: { ...live.explanation, deferrables: [{ id: 'droger', state: 'waiting', reason: 'surplus_insufficient', durationMin: 168 }] } };
    layoutStore = new LayoutStore({ logDir: dir, known: () => knownForLayout(exampleSite, houseRegisters, houseStates) });
    uitstel = new UitstelStore({ logDir: dir, config: exampleSite, status: () => 'waiting' });
    energyStore = new EnergyStore(dir);
    // De zon en je aansluiting (besluit 103): de droger staat in de configuratie, een vaatwasser is nieuw.
    connStore = new ConnectionStore(dir);
    functiesStore = new FunctiesStore(dir);
    bewonersStore = new BewonersStore(dir);
    // De testgebruiker is een scherm (besluit 147): anders vraagt elke pagina eerst "wie ben je?".
    await bewonersStore.save(startBewoners);
    // Drie Marstek-accu's via Homey (issue 145): één apparaat met losse sensoren, niet vanzelf herkend.
    accuHuis = (() => {
      const meting = (id: string, klasse: string, staat: string, eenheid: string, naam: string) => ({ id, klasse, staat, eenheid, naam });
      const m = [
        meting('sensor.laadplan_controller_battery', 'battery', '64', '%', 'Laadplan Controller battery'),
        meting('sensor.laadplan_controller_power', 'power', '800', 'W', 'Laadplan Controller power'),
        meting('sensor.laadplan_controller_charged_energy', 'energy', '812.4', 'kWh', 'Laadplan Controller charged energy'),
        meting('sensor.laadplan_controller_discharged_energy', 'energy', '734', 'kWh', 'Laadplan Controller discharged energy'),
      ];
      return {
        reg: {
          devices: [{ id: 'homey', area_id: null, name: 'Laadplan Controller', manufacturer: 'Athom', model: 'Homey Pro' }],
          entities: m.map((x) => ({ entity_id: x.id, device_id: 'homey', platform: 'homey', original_device_class: x.klasse, original_name: x.naam })),
        },
        states: new Map(m.map((x) => [x.id, { entity_id: x.id, state: x.staat, attributes: { unit_of_measurement: x.eenheid, friendly_name: x.naam, device_class: x.klasse }, last_changed: '', last_updated: '' }])),
      };
    })();
    const connFound = {
      fasen: [{ id: 'L1', current: 'sensor.p1_meter_current_phase_1' }] as FoundPhase[],
      apparaten: [
        { id: 'droger', naam: 'Droger', soort: 'droger', remoteStart: 'binary_sensor.droger_remote', estimatedW: 700 },
        { id: 'vaatwasser', naam: 'Vaatwasser', soort: 'vaatwasser', remoteStart: 'binary_sensor.vaatwasser_remote', estimatedW: 1800 },
      ] as FoundAppliance[],
      // De netmeter en de omvormers om uit te kiezen (testerronde, november 2026).
      vermogens: [
        { id: 'sensor.p1_meter_power', naam: 'P1-meter vermogen', w: -800, rol: 'net' },
        { id: 'sensor.solaredge_ac_power', naam: 'SolarEdge vermogen', w: 2400, rol: 'zon' },
      ] as FoundPower[],
    };

    // Een nagemaakte Home Assistant voor het camerabeeld: een klein grijs plaatje,
    // en live een stroom van plaatjes zoals `camera_proxy_stream` die geeft.
    const frame = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAkAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDCooorQAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP//Z', 'base64');
    const haCamera = createServer((req, res) => {
      // Een deurbel zoals hier (21 oktober 2026): het scherpe beeld geeft niets, het
      // vloeiende wel een plaatje, maar zijn live stroom blijft leeg.
      if (req.url?.includes('deurbel_duidelijk') && !req.url.includes('camera_proxy_stream')) {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('500: Internal Server Error');
        return;
      }
      if (req.url?.includes('deurbel_') && req.url.includes('camera_proxy_stream')) {
        res.writeHead(200, { 'content-type': 'multipart/x-mixed-replace; boundary=frame' });
        return;
      }
      if (req.url?.includes('camera_proxy_stream')) {
        liveOpen += 1;
        res.writeHead(200, { 'content-type': 'multipart/x-mixed-replace; boundary=frame' });
        const kop = Buffer.from(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`);
        const tik = setInterval(() => res.write(Buffer.concat([kop, frame, Buffer.from('\r\n')])), 100);
        req.on('close', () => {
          clearInterval(tik);
          liveOpen -= 1;
        });
        return;
      }
      res.writeHead(200, { 'content-type': 'image/jpeg' });
      res.end(frame);
    });
    await new Promise<void>((r) => haCamera.listen(0, '127.0.0.1', () => r()));
    const haCameraPort = (haCamera.address() as { port: number }).port;
    stopCamera = () =>
      new Promise<void>((r) => {
        haCamera.closeAllConnections();
        haCamera.close(() => r());
      });

    // Niet zomaar poort 0: Chromium weigert dezelfde poorten. Zie ports.ts.
    let port: number;
    ({ server, port } = await onUsablePort(
      async () => {
        const server = new WebServer({
          port: 0,
          host: '127.0.0.1',
          webDir: WEB_DIR,
          config: exampleSite,
          configNow: () => configNu,
          // Wiens comfort (besluit 147): dat van wie er kijkt, of van wie er gevraagd wordt.
          comfort: { view: (wie, bewoner) => comfortVanBewoner(configNu, comfortNu, bewonersStore.current, wie, bewoner).view, save: comfortDeur.save },
          latest: () => live,
          divergence: () => review.latest,
          logDir: dir,
          feedback: new FeedbackLog({ logDir: dir, zoneIds: exampleSite.zones.map((z) => z.id) }),
          // Meldingen (besluit 136): één apparaat dat al twee uur niet reageert.
          meldingen: (meldingenStore = (() => {
            const m = new MeldingenStore({ logDir: dir });
            m.bij({ nu: Date.now(), zonderRuimte: [], volgen: [{ id: 'switch.droger', naam: 'De droger', kamer: 'Zolder', kamerId: 'zolder', onbereikbaarSindsMs: Date.now() - 2 * 3_600_000 }], batterijen: [], filters: [], meters: [], versie: null, winterdagen: null });
            return m;
          })()),
          // Bijwerken (21 oktober 2026): een Home Assistant die een nieuwere versie klaar heeft.
          bijwerken: {
            view: async (mag: boolean) =>
              updateView(VERSIE, updateNu.klaar ? { entity_id: 'update.smart_climate_update', state: 'on', attributes: { title: 'SunArc', latest_version: '9.9.9', in_progress: updateNu.installeer > 0 }, last_changed: '', last_updated: '' } : null, changelog([{ versie: '9.9.9', datum: '2026-10-22', nieuw: ['Iets nieuws voor de wand'], opgelost: ['Een fout weg'] }]), mag),
            installeer: async () => {
              if (!updateNu.klaar) return { ok: false, reden: 'er staat geen nieuwe versie klaar' };
              updateNu.installeer += 1;
              return { ok: true };
            },
            // Zoeken naar updates (testerronde, november 2026): telt alleen.
            zoek: async () => {
              updateNu.zoek += 1;
              return { ok: true };
            },
          },
          // Opnieuw starten (testerronde, november 2026): telt alleen.
          herstart: () => {
            updateNu.herstart += 1;
          },
          // Thuis naar eigen smaak (besluit 162): kaarten en favorieten, in de tijdelijke map.
          voorkeuren: new VoorkeurenStore(dir),
          deurbel: () => extraDeurbel,
          // De kaart Camera's (besluit 201): de deurbel, en zo nodig de oprit die nu een persoon ziet.
          cameras: () => [
            ...(extraDeurbel ? [{ id: extraDeurbel.camera, naam: extraDeurbel.naam, reserve: extraDeurbel.reserve ?? [], deurbel: true, aangebeldMs: extraDeurbel.laatsteMs, melders: true, nu: null, sindsMs: null, laatsteMs: null, laatsteSoort: null }] : []),
            ...(extraOprit ? [{ id: 'camera.camera_oprit_vloeiend', naam: 'Camera oprit', reserve: [], deurbel: false, aangebeldMs: null, melders: true, nu: 'persoon' as const, sindsMs: Date.now() - 20_000, laatsteMs: Date.now() - 20_000, laatsteSoort: 'persoon' as const }] : []),
          ],
          // Het sluipverbruik (besluit 192): 45 dagen uurstatistiek, de laatste vijf nachten 120 W hoger.
          sluipverbruik: new Sluipverbruik({
            config: () => configNu,
            prijs: () => 0.25,
            logDir: dir,
            vraag: async () => {
              const nu = Math.floor(Date.now() / 3_600_000) * 3_600_000;
              return { 'sensor.p1_meter_power': Array.from({ length: 45 * 24 }, (_, k) => ({ start: nu - k * 3_600_000, mean: (k < 5 * 24 ? 300 : 180) + (Math.floor(k / 24) % 4) * 3 })) };
            },
          }),
          // Laden met de hand (besluit 262): de Easee mag, van 6 tot 16 A, en kan pauzeren.
          laden: {
            standen: async () => [{ auto: 'tesla', stroom: { min: 6, max: 16, stap: 1, nuA: ladenActief?.stroomA ?? 5 }, pauze: true, mag: true, evcc: false, zekeringA: 20, actief: ladenActief }],
            zet: async (auto: string, v: { stroomA?: number; pauze?: boolean; tot: 'uur' | 'tijd' | 'pct' | 'kabel'; totMs?: number; pct?: number }) => {
              ladenGestuurd.push({ auto, ...v });
              ladenActief = { stroomA: v.stroomA ?? null, pauze: v.pauze === true, tot: v.tot, totMs: Date.now() + 3_600_000, pct: v.pct ?? null };
              return { ok: true as const, terug: { auto, tot: v.tot, totMs: ladenActief.totMs, sindsMs: Date.now() } };
            },
            terug: async (auto: string) => {
              ladenGestuurd.push({ auto, terug: true });
              ladenActief = null;
              return true;
            },
          },
          // Het advies bij de Tesla (besluit 259, stap 4): meer op zon, en de goedkoopste uren over twee dagen.
          laadadvies: () => {
            const van = Math.floor(Date.now() / 3_600_000) * 3_600_000 + 40 * 3_600_000;
            return {
              tesla: {
                zon: { soort: 'meer', kW: 1.8, nuA: 5, metA: 8, fasen: 3, overA: 16, zekering: { fasen: 3, ampere: 25 } },
                goedkoop: { van: new Date(van).toISOString(), tot: new Date(van + 3 * 3_600_000).toISOString(), prijs: 0.14, prijsNu: 0.3, uren: 3, totPct: 80, kosten: 4.6, nietNodig: false },
              },
            };
          },
          // De laadbeurten van de Tesla (besluit 259, stap 3): een die nu loopt, en twee van eerder deze week.
          laadbeurten: async (auto: string) => {
            if (auto !== 'tesla') return null;
            const nu = Date.now();
            const iso = (ms: number) => new Date(ms).toISOString();
            return {
              dagen: 7,
              beurten: [
                { van: iso(nu - 80 * 60_000), tot: iso(nu), bezig: true, kWh: 4.2, zonKWh: 3, kosten: 0.31 },
                { van: iso(nu - 2 * 86_400_000), tot: iso(nu - 2 * 86_400_000 + 4 * 3_600_000), bezig: false, kWh: 22.1, zonKWh: 2.6, kosten: 5.27 },
                { van: iso(nu - 3 * 86_400_000), tot: iso(nu - 3 * 86_400_000 + 3 * 3_600_000), bezig: false, kWh: 15, zonKWh: 0, kosten: 3.75 },
              ],
              kWh: 41.3,
              zonKWh: 5.6,
              kosten: 9.33,
              perUur: false,
              statistiek: true,
            };
          },
          // De integratie neerzetten (besluit 184): nagebootst, zonder map.
          integratie: {
            stand: async () => integratieNu,
            zetNeer: async () => {
              integratieNu = { ...integratieNu, staat: 'add-on', versie: integratieNu.nieuw };
              return { ok: true as const, stand: integratieNu };
            },
          },
          // Meldingen op de telefoon (besluit 183): een nagebootste telefoon, en onthouden wat er gestuurd werd.
          telefoons: () => [{ id: 'd-pixel', naam: 'Pixel 8', eigen: true }, { id: 'd-ipad', naam: 'iPad keuken', eigen: false }],
          proefmelding: async (userId) => {
            proefmeldingen.push(userId);
            return { ok: true as const, naam: 'Pixel 8' };
          },
          profielen: (userId) => profielenVan(bewonersStore.current, live.explanation.profile?.id ?? null, userId),
          // Het kleine huis uit house-fixture, met de deur voor de indeling (besluit 96).
          house: () => metBatterijen(buildHouse(exampleSite, houseRegisters, houseStates, live, layoutStore.current)),
          layout: { store: layoutStore, proposal: () => proposeLayout(exampleSite, houseRegisters, houseStates) },
          // Licht bedienen (besluit 97), met een Home Assistant die alleen onthoudt wat er kwam.
          lights: new LightSwitch({
            house: () => buildHouse(exampleSite, houseRegisters, houseStates, live, layoutStore.current),
            call: async (service, ids, data) => {
              lightCalls.push(`${service} ${ids.join(',')}`);
              lightData.push(data);
            },
            // Scènes (besluit 100): alleen onthouden welke.
            callScene: async (id) => void sceneCalls.push(id),
          }),
          // Schermen bedienen (besluit 121): alleen onthouden wat er kwam.
          covers: new CoverSwitch({
            house: () => buildHouse(exampleSite, houseRegisters, houseStates, live, layoutStore.current),
            call: async (service, id, data) => void coverCalls.push(`${service} ${id}${data['position'] != null ? ` ${String(data['position'])}` : ''}`),
          }),
          version: { nummer: VERSIE, installatie: 'server', commit: 'bbbbbbb', gebouwd: '2026-09-30T12:00:00Z' },
          // De camera (besluit 106): een nagemaakte Home Assistant die een plaatje geeft.
          camera: { base: `http://127.0.0.1:${haCameraPort}`, token: 'test', ids: () => new Set(['camera.camera_oprit_vloeiend', 'camera.deurbel_duidelijk', 'camera.deurbel_vloeiend']) },
          // Camera's en de deurbel als instelling (besluit 109).
          functies: { store: functiesStore, gevonden: () => functiesGevonden(houseRegisters.entities, houseRegisters.devices, houseStates) },
          // Het weer (besluit 105): twee dagen van een nagemaakte Buienradar.
          weather: {
            forecast: () => [
              { offset: 0, maxC: null, minC: null, regenkansPct: null, zonkansPct: null, soort: 'bewolkt', tekst: 'Zwaar bewolkt' },
              { offset: 1, maxC: 17, minC: 10, regenkansPct: 90, zonkansPct: 10, soort: 'regen', tekst: 'Zwaar bewolkt en regen' },
              { offset: 2, maxC: 18, minC: 7, regenkansPct: 30, zonkansPct: 50, soort: 'half', tekst: null },
            ],
            log: new WeatherLog(dir),
          },
          uitstel,
          energy: { store: energyStore, source: ENERGY_SOURCE },
          // Klaarzetten in Home Assistant (besluit 179): het kleine huis, zonder locatie.
          klaarzetten: async () => klaarzetten({ locatie: false, registers: houseRegisters, states: houseStates, netMeter: true, zon: { heeft: true, intervalS: 30 }, energieDashboard: true, apparatenOpZon: 0, cameras: 1, deurbel: false, rookmelders: 0, spraak: [], addOn: true, eigenPoort: false }),
          // Klaarzetten per niveau (besluit 246): een wand in Fully zonder camera, Whisper op base-int8.
          klaarFuncties: async (punten) =>
            klaarFuncties(punten, {
              addOn: true,
              eigenPoort: false,
              eigenSlug: 'abc_sunarc',
              inHuis: { addons: [{ id: 'whisper', slug: 'core_whisper', staat: 'aan' }, { id: 'piper', slug: 'core_piper', staat: 'aan' }, { id: 'openwakeword', slug: 'core_openwakeword', staat: 'nee' }], assistent: null, bezig: false, fout: null },
              whisperModel: 'base-int8',
              tailscale: null,
              wand: { fully: true, js: true, camera: false, ms: 0 },
              heeftWand: true,
              schermUit: true,
              wekker: 'fully',
              wolken: [],
              spraak: [],
              tijd: () => '10:14',
            }),
          wandMeldt: () => undefined,
          connection: {
            store: connStore,
            found: () => connFound,
            view: () =>
              connectionView({
                base: exampleSite,
                found: connFound,
                applied: { toegevoegd: [], overgeslagen: [] },
                answersAtStart: null,
                answers: connStore.current,
                solar: { naam: 'Zonnepanelen', intervalS: 61, platform: 'solaredge_modbus_multi' },
                kaart: true,
                nederland: true,
                // Energie › Thuisaccu (besluit 271): een accu via Homey met losse sensoren, zoals issue 145.
                accu: accuView(accuHuis.reg, accuHuis.states, connStore.current?.accu ?? null),
              }),
          },
          // De kaart (besluit 254 en 5 november 2026): een nagemaakte plek, OpenStreetMap en 3D BAG; er gaat niets naar buiten.
          exacteLocatie: async () => ({ latDeg: KAART_PLEK.lat, lonDeg: KAART_PLEK.lon }),
          kaartAntwoord: async () => ({ elements: [{ geometry: [[15, -3], [15, 1], [18, 1], [18, -3], [15, -3]].map(([n, o]) => ({ lat: KAART_PLEK.lat + n! / 110_540, lon: KAART_PLEK.lon + o! / (111_320 * Math.cos((KAART_PLEK.lat * Math.PI) / 180)) })) }] }),
          bagVak: async () => nepBagVak(),
          // De inlog van besluit 99, met een nep-Home Assistant; de browser krijgt
          // hieronder een sessie als beheerder, zodat de deuren echt op slot zitten.
          access: { kind: 'sessions', store: sessions, login: { authorizeUrl: (_origin, state) => `${haInlog}?state=${state}`, identify: async () => ({ userId: 'u', naam: 'Test', isAdmin: true }) } },
          // Bewoners (besluit 147): dezelfde deur als de dienst, met wie er geldt uit het laatste besluit.
          bewoners: {
            view: (wie) => bewonersView(bewonersStore.current, wie, exampleSite.occupancy, (id) => houseStates.get(id), live.explanation.profile ?? null),
            actie: async (body, wie) => {
              const a = leesActie(body);
              if (a == null) return { ok: false as const, status: 400, reden: 'onbekende actie' };
              const uit = voerUit(bewonersStore.current, comfortNu, a, wie, exampleSite.occupancy, live.explanation.profile?.home ?? [], Date.now());
              if (!uit.ok) return uit;
              await bewonersStore.save(uit.bewoners);
              return { ok: true as const, view: bewonersView(uit.bewoners, wie, exampleSite.occupancy, (id) => houseStates.get(id), live.explanation.profile ?? null) };
            },
            herken: async (account) => {
              const r = herken(bewonersStore.current, account, personenUit(houseStates.values()), exampleSite.occupancy, Date.now());
              if (r.soort === 'vraag') return 'vraag' as const;
              if (r.soort !== 'bewoner' || !r.nieuw) return null;
              await bewonersStore.save(r.bewoners);
              return 'welkom' as const;
            },
            gast: (userId) => gastStand(bewonersStore.current, userId, exampleSite.occupancy, (id) => houseStates.get(id)),
          },
          sleutel: 'test-sleutel-voor-de-assistent-12345',
          // De ligging, zoals Home Assistant hem geeft: op één decimaal (besluit 93).
          location: () => ({ latDeg: 52.1, lonDeg: 5.1 }),
          write: () => {},
        });
        return { server, port: await server.start() };
      },
      (s) => s.port,
      (s) => s.server.stop(),
    ));
    baseUrl = `http://127.0.0.1:${port}`;
    sessionId = await sessions.create({ userId: 'u', naam: 'Test', rol: 'beheerder' });

    const channel = process.env['HEMS_PAGE_BROWSER'];
    browser = await chromium.launch(channel ? { channel } : {});
    /*
     * De hele app vraagt een inlog (besluit 147). Elk nieuw venster krijgt de
     * inlog van de beheerder, tenzij een test juist zonder wil kijken
     * (`zonderInlog: true`); en elke vraag aan de testdienst ook.
     */
    const nieuwVenster = browser.newContext.bind(browser);
    browser.newContext = (async (o?: BrowserContextOptions & { zonderInlog?: boolean }) => {
      const { zonderInlog, ...rest } = o ?? {};
      // Nederlands, tenzij een test anders vraagt: Automatisch kiest sinds besluit 185 ook Engels uit de browser.
      const c = await nieuwVenster({ locale: 'nl-NL', ...rest });
      if (!zonderInlog) await c.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
      return c;
    }) as typeof browser.newContext;
    browser.newPage = (async (o?: BrowserContextOptions & { zonderInlog?: boolean }) => {
      const c = await browser.newContext(o);
      const p = await c.newPage();
      p.on('close', () => void c.close());
      return p;
    }) as typeof browser.newPage;
    globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
      const adres = input instanceof Request ? input.url : String(input);
      if (!adres.startsWith(baseUrl)) return echteFetch(input, init);
      const kop = new Headers(init?.headers);
      if (!kop.has('cookie')) kop.set('cookie', `hems_sessie=${sessionId}`);
      return echteFetch(input, { ...init, headers: kop });
    }) as typeof fetch;
    // De wand slaapt en rust niet midden in een test (besluit 164); de test van de nachtstand zet het zelf aan.
    await fetch(`${baseUrl}/api/voorkeuren`, { method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl }, body: JSON.stringify({ plek: 'wand', niemand: { nacht: false, rustMin: 0, weg: false } }) });
    // UTC, net als de rest van de suite in de CI: de tijdlijn en de
    // versiemarkering rekenen dan in dezelfde dagen.
    const context = await browser.newContext({ timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    page = await context.newPage();
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('response', (r) => {
      if (r.status() >= 400) failedResponses.push(`${r.status()} ${new URL(r.url()).pathname}`);
    });
    await page.goto(`http://127.0.0.1:${port}/`);
    // Klaar als de laatste stap van het laden, de exportknop, er staat.
    await page.locator('#dataset-export').waitFor({ state: 'visible' });
  }, 60_000);

  afterAll(async () => {
    globalThis.fetch = echteFetch;
    await browser?.close();
    await stopCamera();
    await server?.stop();
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('laadt zonder fouten', () => {
    expect(pageErrors).toEqual([]);
    // De onboarding staat buiten de add-on uit en antwoordt dan met 503. Dat
    // is de enige verwachte fout, en de browser meldt hem als laadfout.
    expect(failedResponses).toEqual(['503 /api/onboarding']);
    expect(consoleErrors.filter((t) => !t.includes('503'))).toEqual([]);
  });

  it('toont het live besluit', async () => {
    // De modus van het besluit, als woord en niet als code.
    expect((await page.locator('#modus').textContent())?.toLowerCase()).toBe(live.explanation.mode);
    expect(await page.locator('#zones').textContent()).toContain('Woonkamer');
    expect(await page.locator('#budget-net').textContent()).toMatch(/\d W/);
    expect((await page.locator('#apparaten').textContent())?.trim()).not.toBe('');
  });

  it('toont de terugblik, met de tijdlijn en de versies', async () => {
    await page.locator('#tab-terugblik').click();
    expect(await page.locator('#stat-eens').textContent()).toMatch(/%/);
    const timeline = (await page.locator('#tijdlijn').textContent()) ?? '';
    for (const day of DAYS) expect(timeline).toContain(day);
    expect(timeline).toContain('▲ aaaaaaa');
    expect(timeline).toContain('▲ bbbbbbb');
  });

  it('toont de dataset en de exportknop', async () => {
    expect(await page.locator('#dataset-export').textContent()).toContain('Exporteren · 3 dagen');
    expect(await page.locator('#dataset-pct').textContent()).toMatch(/\d+%/);
    // Het zonplafond is een cijfer over de dataset: hier, niet in de app.
    await page.locator('#dataset-zon').waitFor({ state: 'visible' });
    expect(await page.locator('#dataset-zon').textContent()).toMatch(/zonplafond (geleerd uit \d+ dagen|nog geschat) · factor \d,\d\d/);
  });

  /*
   * Zon en aansluiting in ontwerp 2 (besluiten 103 en 104): wat de configuratie
   * vastlegt gaat voor, en de antwoorden gaan door de eigen deur. De pagina haalt
   * niets van buiten, ook de lettertypen niet.
   */
  it('toont Energie en Regeling, en bewaart meteen wat je kiest (besluit 130)', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    const outside: string[] = [];
    await context.route(
      (url) => !url.href.startsWith(baseUrl),
      (route) => {
        outside.push(route.request().url());
        return route.abort();
      },
    );
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    // Rechtstreeks naar het deel van Energie; de oude doorverwijzing is weg sinds besluit 142.
    await p.goto(`${baseUrl}/energie.html#panelen`);
    const wand = p.locator('#wand');
    // Daken en panelen (besluit 254): de vlakken als kaartjes, met het huis van boven ernaast.
    await wand.locator('.dk h3', { hasText: 'Waar de panelen liggen' }).waitFor();
    await wand.locator('svg.dk-boven .dk-gebouw').first().waitFor();
    expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
    // De eerste keer een eigen rondleiding (besluit 254): zes stops op de pagina (ook Wat kan bij jouw huis, 261), dan Klaar; daarna niet meer.
    const rond = p.locator('.rl-kaart');
    await rond.locator('h2', { hasText: 'Je huis van boven' }).waitFor({ timeout: 5_000 });
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-rond-daken1.png') });
    for (const kop of ['Elk vlak apart', 'Van boven of het huis', 'Je huis, met de panelen erop', 'Een vlak erbij', 'Wat kan bij jouw huis', 'Omvormers en meters']) {
        await rond.locator('[data-rl-volgende]').click();
      await rond.locator('h2', { hasText: kop }).waitFor();
      if (process.env.HEMS_PAGE_SHOT) await p.waitForTimeout(500).then(() => p.screenshot({ path: process.env.HEMS_PAGE_SHOT!.replace('.png', `-rond-${kop.split(' ')[0]}.png`) }));
    }
    await rond.locator('[data-rl-klaar]').click();
    await rond.waitFor({ state: 'detached' });
    expect(await p.evaluate(() => localStorage.getItem('sc-rond-daken-gezien'))).toBe('1');
    // Het vraagteken bovenin laat hem opnieuw zien (Ricardo, 5 november 2026); de stop bij het huis zette de wissel om, en weer terug.
    await wand.locator('svg.dk-boven').waitFor();
    await wand.locator('[data-dak-uitleg]').click();
    await rond.locator('h2', { hasText: 'Je huis van boven' }).waitFor({ timeout: 5_000 });
    await rond.locator('[data-rl-overslaan]').click();
    await rond.waitFor({ state: 'detached' });
    // De wissel naar het huis in 3D, en terug.
    await wand.locator('[data-dak-zicht="huis"]').click();
    await wand.locator('[data-pan-podium] svg.sc-huis').waitFor();
    await wand.locator('[data-dak-zicht="boven"]').click();
    // Het hoofdhuis: een andere dakvorm kiezen.
    await wand.locator('svg.dk-boven [data-dak-gebouw="huis"]').click();
    await wand.locator('[data-dak-dakvorm="schild"]').click();
    await expect.poll(() => connStore.current?.daken?.gebouwen?.find((g) => g.id === 'huis')?.dakvorm, { timeout: 5_000 }).toBe('schild');
    await wand.locator('[data-dak-scherm="alle"]').click();
    // Een vlak erbij: eerst wat voor dak, dan hoe ze liggen.
    // Een naam per vlak (Ricardo, 5 november 2026): zonder eigen naam de richting erbij, en een eigen naam bewaar je met het vlak.
    await wand.locator('[data-dak-open="B"] b', { hasText: 'Hoofddak west' }).waitFor();
    await wand.locator('[data-dak-open="A"]').click();
    await wand.locator('[data-dak-naam]').fill('Voorkant');
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-daknaam.png') });
    await wand.locator('[data-dak-naam]').press('Tab');
    await wand.locator('[data-dak-bewaar]').click();
    await expect.poll(() => connStore.current?.daken?.vlakken.find((v) => v.letter === 'A'), { timeout: 5_000 }).toMatchObject({ naam: 'Voorkant', bron: 'schatting' });
    await wand.locator('[data-dak-open="A"] b', { hasText: 'Voorkant' }).waitFor();
    // B is nu het enige hoofddak zonder eigen naam: dan gewoon Hoofddak.
    expect(await wand.locator('[data-dak-open="B"] b').first().textContent()).toBe('Hoofddak');
    await wand.locator('[data-dak-scherm="erbij"]').click();
    await wand.locator('[data-dak-plek="uitbouw"]').click();
    await wand.locator('[data-dak-opstel="oostwest"][aria-pressed="true"]').waitFor();
    await wand.locator('[data-dak-stap="aantal"][data-d="1"]').click();
    await wand.locator('[data-dak-stap="aantal2"][data-d="1"]').click();
    expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
    await wand.locator('[data-dak-bewaar]').click();
    await wand.locator('.dk-vlak', { hasText: 'Uitbouw' }).waitFor();
    await expect.poll(() => connStore.current?.daken?.vlakken.find((v) => v.plek === 'uitbouw'), { timeout: 5_000 }).toMatchObject({ opstelling: 'oostwest', azimuthDeg: 90, aantal: 5, aantal2: 5, bron: 'bewoner' });
    // Wat bij welke meter hoort, en terug.
    await wand.locator('[data-dak-scherm="meters"]').click();
    await wand.locator('.dk h3', { hasText: 'Wat bij welke meter hoort' }).waitFor();
    expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
    await wand.locator('[data-dak-scherm="alle"]').click();
    // De kaart is experimenteel (5 november 2026): eerst de melding, dan het huis uit 3D BAG met de bron, en Zonder kaart terug.
    await wand.locator('[data-dak-kaart]').click();
    const venster = p.locator('.kk-venster');
    await venster.locator('h2', { hasText: 'Je huis uit de kaart' }).waitFor();
    expect(await venster.textContent()).toContain('nooit je adres of je huis');
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-kaartmelding.png') });
    await venster.locator('[data-kk-dicht]').first().click();
    await venster.waitFor({ state: 'detached' });
    await wand.locator('[data-dak-kaart]').click();
    // Zolang de kaarten nog antwoorden, zegt elke kaart dat hij zoekt (7 november 2026).
    await p.route('**/api/daken-kaart', async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });
    await venster.locator('[data-kk-kaart]').click();
    const wk = wand.locator('.wk');
    await expect.poll(() => wk.locator('.wk-regel .wk-bezig').count(), { timeout: 2_000 }).toBe(2);
    expect(await wk.locator('.wk-regel', { hasText: 'Plattegrond' }).textContent()).toContain('Zoekt de omtrek van je huis');
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-kaartzoekt.png') });
    // Wat kan bij jouw huis (6 november 2026): eerst zien wat de kaarten vonden, dan zelf kiezen.
    await wk.locator('.wk-regel', { hasText: '3D-kaart van Nederland' }).locator('[data-dak-bron="bag3d"]').waitFor({ timeout: 5_000 });
    await p.unroute('**/api/daken-kaart');
    expect(await wk.locator('.wk-regel', { hasText: 'Plattegrond' }).textContent()).toContain('Je huis staat erin');
    expect(await wk.locator('.wk-regel', { hasText: 'Zelf tekenen' }).textContent()).toContain('In gebruik');
    await expect.poll(() => connStore.current?.daken?.kaartStand, { timeout: 5_000 }).toMatchObject({ osm: 'huis', bag3d: 'huis' });
    expect(connStore.current?.daken?.gebouwen?.find((g) => g.soort === 'hoofdhuis')?.bron ?? 'schatting').toBe('schatting');
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-watkan.png') });
    expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
    await wk.locator('[data-dak-bron="bag3d"]').click();
    await wand.locator('.kk-balk a[href="https://docs.3dbag.nl/en/copyright"]').waitFor({ timeout: 5_000 });
    expect(await wk.locator('.wk-regel', { hasText: '3D-kaart van Nederland' }).textContent()).toContain('In gebruik');
    // Het tuinhuis staat niet in 3D BAG, wel in OpenStreetMap: die bron staat er dan ook bij.
    await wand.locator('.kk-balk a[href="https://www.openstreetmap.org/copyright"]').waitFor();
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-kaartbalk.png') });
    await expect.poll(() => connStore.current?.daken?.gebouwen?.find((g) => g.soort === 'hoofdhuis'), { timeout: 5_000 }).toMatchObject({ bron: 'kaart', kaart: 'bag3d', dakvorm: 'zadel', nokDeg: 0 });
    expect(connStore.current?.daken?.omgeving).toHaveLength(2);
    // De helling uit de 3D-kaart naast de meting (6 november 2026): bij vlak A, met Neem over.
    await expect.poll(() => connStore.current?.daken?.kaartDak?.length ?? 0, { timeout: 5_000 }).toBeGreaterThan(1);
    await wand.locator('[data-dak-open="A"]').click();
    const kaartDak = wand.locator('.dk-kaartdak');
    expect(await kaartDak.textContent()).toContain('De 3D-kaart zegt 90°, helling 45°');
    await kaartDak.locator('[data-dak-neemkaart]').click();
    await wand.locator('.dk-kaartdak', { hasText: 'Klopt met de 3D-kaart' }).waitFor();
    await wand.locator('[data-dak-bewaar]').click();
    await expect.poll(() => connStore.current?.daken?.vlakken.find((v) => v.letter === 'A'), { timeout: 5_000 }).toMatchObject({ azimuthDeg: 90, tiltDeg: 45, bron: 'bewoner' });
    await wand.locator('[data-dak-zonderkaart]').click();
    await p.locator('.kk-venster [data-kk-zonder]').click();
    await expect.poll(() => connStore.current?.daken?.gebouwen ?? [], { timeout: 5_000 }).toEqual([]);
    expect(connStore.current?.daken?.kaartDak).toBeUndefined();
    await wand.locator('.wk-regel.aan', { hasText: 'Zelf tekenen' }).waitFor({ timeout: 5_000 });
    if (process.env.HEMS_PAGE_SHOT) await p.waitForTimeout(400).then(() => p.screenshot({ path: process.env.HEMS_PAGE_SHOT!.replace('.png', '-zelf.png') }));
    expect(connStore.current?.daken?.vlakken.some((v) => v.plek === 'uitbouw')).toBe(true);
    // Stap 2b (6 november 2026): het huis slepen, op maat maken, en een blok erbij en weer weg.
    // De ingang (7 november 2026): Teken je huis bij Zelf tekenen, en de tip in de tekening.
    expect(await wand.locator('.dk-noot').textContent()).toContain('Tik op de naam van een gebouw');
    await wand.locator('.wk-regel.aan [data-dak-gebouw="huis"]', { hasText: 'Teken je huis' }).click();
    const romp = wand.locator('.dk-gebouw[data-dak-sleep="huis"] .dk-romp');
    await romp.waitFor();
    // De pagina kan net opnieuw tekenen (het antwoord op het vorige bewaren): wacht tot het blok stil staat.
    await expect.poll(async () => (await romp.boundingBox()) != null, { timeout: 5_000 }).toBe(true);
    await p.waitForTimeout(300);
    const rb = (await romp.boundingBox())!;
    await p.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);
    await p.mouse.down();
    await p.mouse.move(rb.x + rb.width / 2 + 40, rb.y + rb.height / 2, { steps: 6 });
    await p.mouse.up();
    const huisNu = () => connStore.current?.daken?.gebouwen?.find((g) => g.id === 'huis');
    await expect.poll(() => huisNu()?.bron, { timeout: 5_000 }).toBe('bewoner');
    const oost = (g: { omtrek: readonly (readonly [number, number])[] } | undefined) => (g ? g.omtrek.reduce((x, q) => x + q[0], 0) / g.omtrek.length : 0);
    expect(oost(huisNu())).toBeGreaterThan(1);
    // Na het slepen geen vlak erbij: het loslaten was geen tik op een dakvlak.
    await wand.locator('.dk-maat').waitFor();
    const lang = (await wand.locator('[data-dak-maat="lengte"]').first().locator('xpath=..').locator('b').textContent())!;
    await wand.locator('[data-dak-maat="lengte"][data-d="1"]').click();
    await expect.poll(async () => wand.locator('[data-dak-maat="lengte"]').first().locator('xpath=..').locator('b').textContent(), { timeout: 5_000 }).not.toBe(lang);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-blok.png') });
    expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
    await wand.locator('[data-dak-scherm="alle"]').first().click();
    await wand.locator('[data-dak-scherm="erbij"]').click();
    await wand.locator('[data-dak-blok]').click();
    await wand.locator('[data-dak-erbijgebouw="tuinhuis"]').click();
    await expect.poll(() => connStore.current?.daken?.gebouwen?.find((g) => g.soort === 'tuinhuis'), { timeout: 5_000 }).toMatchObject({ bron: 'bewoner' });
    await wand.locator('[data-dak-blokweg]').click();
    await expect.poll(() => connStore.current?.daken?.gebouwen?.some((g) => g.soort === 'tuinhuis'), { timeout: 5_000 }).toBe(false);
    // De zekering uit de configuratie staat voorgekozen, en is te wijzigen (besluit 117).
    await wand.locator('[data-delen] .deel', { hasText: 'Aansluiting' }).click();
    await wand.locator('[data-vorm] h2', { hasText: 'Aansluiting' }).waitFor();
    const zekering = wand.locator('button[aria-pressed="true"]', { hasText: '1 × 35 A' });
    expect(await wand.textContent()).toContain('uit de configuratie van het huis');
    await zekering.click();
    // De verwarming (besluit 122): wat het is en de aanvoertemperatuur.
    await wand.locator('[data-delen] .deel', { hasText: 'Verwarming' }).click();
    await wand.locator('[data-vorm] h2', { hasText: 'Verwarming' }).waitFor();
    await wand.locator('[aria-label="Verwarming"] button', { hasText: 'Cv-ketel' }).click();
    await wand.locator('[data-aanvoer]').fill('60');
    await wand.locator('[data-aanvoer]').press('Tab');
    await expect.poll(() => connStore.current, { timeout: 5_000 }).toMatchObject({ verwarming: { soort: 'cv', aanvoerC: 60 }, zekering: { fasen: 1, ampere: 35 } });
    // De daken bleven staan toen de aansluiting en de verwarming bewaarden.
    expect(connStore.current?.daken?.vlakken.some((v) => v.plek === 'uitbouw')).toBe(true);
    await wand.locator('[data-bewaard]', { hasText: 'Bewaard' }).waitFor();
    // Apparaten op zon staan bij Regeling.
    await p.goto(`${baseUrl}/regeling.html#opzon`);
    // Elk apparaat een schakelaar, ook de droger uit de configuratie (besluit 167).
    await wand.locator('[aria-label="Vaatwasser op zon"][role="switch"]').click();
    await expect.poll(() => connStore.current?.apparaten, { timeout: 5_000 }).toMatchObject([{ id: 'droger', opZon: false }, { id: 'vaatwasser', opZon: true }]);
    await wand.locator('[data-bewaard]', { hasText: 'Bewaard' }).waitFor();
    const droger = wand.locator('[aria-label="Droger op zon"][role="switch"]');
    expect(await droger.getAttribute('aria-checked')).toBe('true');
    await droger.click();
    await expect.poll(() => connStore.current?.opZonUit, { timeout: 5_000 }).toEqual(['droger']);
    expect(await droger.getAttribute('aria-checked')).toBe('false');
    // De verwarming bleef staan toen Regeling bewaarde.
    expect(connStore.current).toMatchObject({ verwarming: { soort: 'cv', aanvoerC: 60 } });
    // De eigen lettertypen zijn geladen, en er ging niets naar buiten.
    const fonts = await p.evaluate("document.fonts.ready.then(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replaceAll('\"', '')))");
    expect(fonts).toEqual(expect.arrayContaining(['Figtree', 'Bricolage Grotesque']));
    expect(outside).toEqual([]);
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Een groep instellingen op de telefoon (besluit 163, schets
   * Instellingen-Tel-Groep): de delen onder elkaar, geen rij om opzij te
   * schuiven, wat mist bovenaan; een deel opent als eigen scherm, met terug
   * naar de groep en onderaan Vorige en Volgende.
   */
  it('toont een groep instellingen op de telefoon als lijst, en een deel als eigen scherm', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const shot = async (naam: string) => {
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', `-${naam}.png`) });
    };
    await p.goto(`${baseUrl}/energie.html`);
    const tel = p.locator('#tel');
    const delen = tel.locator('[data-delen] .deel');
    await delen.first().waitFor();
    // Onder elkaar en binnen de breedte: niets om opzij te schuiven.
    expect(await tel.locator('[data-delen]').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const links = await delen.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    expect(new Set(links).size).toBe(1);
    expect(await p.evaluate<boolean>('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
    expect(await tel.locator('[data-vorm]').isVisible()).toBe(false);
    // Wat mist staat bovenaan.
    const mist = await delen.evaluateAll((els) => els.map((e) => e.classList.contains('mist')));
    expect(mist).toEqual([...mist].sort((a, b) => Number(b) - Number(a)));
    await shot('lijst');
    // Een deel als eigen scherm, met terug naar de groep.
    await delen.filter({ hasText: 'Aansluiting' }).click();
    await tel.locator('[data-vorm] h2', { hasText: 'Aansluiting' }).waitFor();
    expect(await tel.locator('[data-delen]').isVisible()).toBe(false);
    expect(await tel.locator('[data-terug]').textContent()).toBe('‹ Energie');
    await shot('deel');
    // Geen Volgende meer (besluit 227); een ander deel vervangt het adres, en terug gaat in één stap naar de lijst.
    expect(await tel.locator('[data-verder] a').count()).toBe(0);
    await p.evaluate("location.replace('#meters')");
    await expect.poll(() => new URL(p.url()).hash).toBe('#meters');
    await tel.locator('[data-terug]').click();
    await tel.locator('[data-terug]', { hasText: '‹ Instellingen' }).waitFor();
    expect(new URL(p.url()).hash).toBe('');
    expect(await delen.first().isVisible()).toBe(true);
    // Rechtstreeks op een deel: terug gaat ook naar de lijst, met de kopjes.
    await p.goto(`${baseUrl}/comfort.html#dagdelen`);
    await tel.locator('[data-vorm] h2', { hasText: 'Dagdelen' }).waitFor();
    await tel.locator('[data-terug]').click();
    await tel.locator('[data-delen] h4', { hasText: 'Kamers' }).waitFor();
    await shot('comfort');
    // De kolommen van de wand staan op de telefoon onder elkaar.
    await p.goto(`${baseUrl}/energie.html#prijzen`);
    await tel.locator('[data-vorm] h2', { hasText: 'Contract en prijzen' }).waitFor();
    expect(await p.evaluate<boolean>('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
    await shot('prijzen');
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Een groep op de wand (besluit 163, schets Wand-Instellingen-Groep): geen
   * kolom met uitleg meer; die zit achter "Waarvoor is dit?". Onderaan door
   * naar het volgende deel, en de wand scrolt niet.
   */
  it('toont op de wand de uitleg achter Waarvoor is dit, en door naar het volgende deel', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const shot = async (naam: string) => {
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', `-${naam}.png`) });
    };
    await p.goto(`${baseUrl}/energie.html#aansluiting`);
    const wand = p.locator('#wand');
    await wand.locator('[data-vorm] h2', { hasText: 'Aansluiting' }).waitFor();
    const naast = wand.locator('[data-naast]');
    expect(await naast.isVisible()).toBe(false);
    await shot('wand');
    await wand.locator('[data-waarvoor]').click();
    await naast.locator('h3', { hasText: 'Waarvoor dit nodig is' }).waitFor();
    await shot('wand-hulp');
    await p.keyboard.press('Escape');
    expect(await naast.isVisible()).toBe(false);
    await wand.locator('[data-delen] .deel[href="#meters"]').click();
    await expect.poll(() => new URL(p.url()).hash).toBe('#meters');
    expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
    await p.goto(`${baseUrl}/energie.html#prijzen`);
    await wand.locator('[data-vorm] h2', { hasText: 'Contract en prijzen' }).waitFor();
    await shot('wand-prijzen');
    await p.goto(`${baseUrl}/comfort.html`);
    await wand.locator('[data-vorm] .bovenrij').waitFor();
    await shot('wand-comfort');
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Op de wand past elk deel van elke groep in zijn vak, zonder te scrollen
   * (besluit 163). Alleen de lijst met versies mag schuiven.
   */
  it('laat elk deel van elke groep op de wand passen zonder te scrollen', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const teVol: string[] = [];
    for (const pagina of ['comfort', 'energie', 'regeling', 'functies', 'toegang']) {
      await p.goto(`${baseUrl}/${pagina}.html`);
      await p.locator('#wand [data-delen] .deel').first().waitFor();
      await p.waitForTimeout(300);
      const ids = await p.locator('#wand [data-delen] .deel').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
      // Alleen de delen op deze pagina; Bewoners opent zijn eigen pagina (besluit 227).
      for (const id of ids.filter((x) => x.startsWith('#') && x !== '#versie')) {
        await p.goto(`${baseUrl}/${pagina}.html${id}`);
        await p.locator('#wand [data-vorm] h2').first().waitFor();
        await p.waitForTimeout(200);
        const over = await p.locator('#wand [data-vorm]').evaluate((v) => v.scrollHeight - v.clientHeight);
        if (over > 2) teVol.push(`${pagina}${id}: ${over}px`);
      }
    }
    expect(teVol).toEqual([]);
    await context.close();
  }, 60_000);

  /*
   * Energie › Thuisaccu (besluit 271, issue 145): een accu via Homey zelf
   * kiezen, zien welke sensor wat is, het teken omdraaien, en dat het bewaard
   * wordt. Op de wand zonder te scrollen.
   */
  it('kiest bij Energie › Thuisaccu een accu van Homey, met zijn sensoren en het teken', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const wand = p.locator('#wand');
    await p.goto(`${baseUrl}/energie.html#accu`);
    await wand.locator('[data-vorm] h2', { hasText: 'Thuisaccu' }).waitFor();
    expect(await wand.locator('[data-delen] .deel[href="#accu"]').textContent()).toContain('niets gevonden');
    expect(await wand.locator('[data-vorm] .ld-leeg').textContent()).toContain('Nog geen thuisaccu gevonden');
    // Zelf kiezen: het apparaat van Homey.
    await wand.locator('[data-accu-kies]').selectOption('homey');
    const rij = wand.locator('.ld-rij', { hasText: 'Laadplan Controller' });
    await rij.waitFor();
    expect(await rij.textContent()).toContain('Zelf gekozen · lading, vermogen, geladen en geleverd');
    await expect.poll(() => connStore.current?.accu?.zelf).toEqual(['homey']);
    expect(await wand.locator('[data-delen] .deel[href="#accu"]').textContent()).toContain('1 accu');
    // De sensoren die hij vond, met wat ze nu zeggen.
    expect(await wand.locator('[data-accu-sensor="lading"]').inputValue()).toBe('sensor.laadplan_controller_battery');
    expect(await wand.locator('.ac-sensor', { hasText: 'Hoe vol' }).textContent()).toContain('64%');
    expect(await wand.locator('[data-accu-sensor="geleverd"]').inputValue()).toBe('sensor.laadplan_controller_discharged_energy');
    expect(await wand.locator('.ac-nu').textContent()).toContain('Nu 0,8 kW: de accu laadt.');
    // Plus is leveren: dan levert hij.
    await wand.locator('[data-accu="teken"][data-waarde="leveren"]').click();
    await expect.poll(() => wand.locator('.ac-nu').textContent()).toContain('Nu −0,8 kW: de accu levert aan het huis.');
    await expect.poll(() => connStore.current?.accu?.instelling['homey']?.teken).toBe('leveren');
    // Een andere sensor kiezen wordt bewaard.
    await wand.locator('[data-accu-sensor="geladen"]').selectOption('sensor.laadplan_controller_discharged_energy');
    await expect.poll(() => connStore.current?.accu?.instelling['homey']?.geladen).toBe('sensor.laadplan_controller_discharged_energy');
    // De wand scrolt niet.
    expect(await wand.locator('[data-vorm]').evaluate((v) => v.scrollHeight - v.clientHeight)).toBeLessThanOrEqual(2);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-energie-accu.png') });
    // Weghalen: dan is hij weer te kiezen.
    await wand.locator('[data-accu="weg"]').click();
    await wand.locator('[data-accu-kies]').waitFor();
    await expect.poll(() => connStore.current?.accu ?? null).toBeNull();
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Meters en prijzen in ontwerp 2 (besluiten 102 en 104): overnemen uit het
   * Energie-dashboard, de meters die bij een rol passen eerst, en bewaren.
   */
  it('toont de meters en prijzen bij Energie, neemt de meters over en bewaart', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/energie.html#meters`);
    const wand = p.locator('#wand');
    await wand.locator('.deelvraag', { hasText: 'In je Energie-dashboard staan' }).waitFor();
    expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
    await wand.locator('[data-overnemen]').click();
    await wand.locator('.meterchips button', { hasText: 'SolarEdge opgewekt' }).waitFor();
    await expect.poll(() => energyStore.current?.zon, { timeout: 5_000 }).toEqual(['sensor.zon']);
    // Apparaat erbij: eerst wat een apparaat is (de tv), de P1-meter pas onder "Andere meters".
    const groepen = await wand.locator('select[aria-label="Apparaat erbij"] optgroup').evaluateAll((gs) => gs.map((g) => [g.getAttribute('label'), [...g.querySelectorAll('option')].map((o) => o.textContent)]));
    expect(groepen).toEqual([
      ['Past hierbij', ['Tv energie']],
      ['Andere meters', ['P1 import totaal']],
    ]);
    // De prijzen zoals op een contract (besluit 110): normaal en dal, en een vaste post per jaar.
    await wand.locator('[data-delen] .deel', { hasText: 'Contract en prijzen' }).click();
    await wand.locator('[data-vorm] h2', { hasText: 'Contract en prijzen' }).waitFor();
    await wand.locator('[data-kies="stroomtarief"]', { hasText: 'Normaal en dal' }).click();
    await wand.locator('[data-prijs="stroomDal"]').waitFor();
    await wand.locator('[data-prijs="stroom"]').fill('0.27142');
    await wand.locator('[data-prijs="stroom"]').press('Tab');
    await wand.locator('[data-prijs="stroomDal"]').fill('0.269');
    await wand.locator('[data-prijs="stroomDal"]').press('Tab');
    await wand.locator('[data-vast-erbij]', { hasText: 'Vermindering energiebelasting' }).click();
    await wand.locator('[data-vast="bedrag"]').last().fill('628.96');
    await wand.locator('[data-vast="bedrag"]').last().press('Tab');
    await wand.locator('[data-vast="per"]').last().selectOption('jaar');
    await expect.poll(() => energyStore.current?.prijzen, { timeout: 5_000 }).toMatchObject({ stroom: 0.27142, stroomDal: 0.269, vast: [{ naam: 'Vermindering energiebelasting', bedrag: -628.96, per: 'jaar', soort: 'stroom' }] });
    // Regels per land (besluit 178): eigen daltijden en geen salderen.
    await wand.locator('[data-kies="dalUren"]', { hasText: 'Eigen tijden' }).click();
    await wand.locator('[data-daleigen="van"]').selectOption('22');
    await wand.locator('[data-kies="dalWeekend"]', { hasText: 'Weekend als doordeweeks' }).click();
    await wand.locator('[data-kies="salderen"]', { hasText: 'Geen salderen' }).click();
    await expect.poll(() => energyStore.current?.prijzen, { timeout: 5_000 }).toMatchObject({ dalUren: 'eigen', dalEigen: { van: 22, tot: 7, weekend: false }, salderen: false });
    // Zonder salderen geen vergoeding boven je verbruik.
    expect(await wand.locator('[data-prijs="teruglevering"]').count()).toBe(0);
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Zonder verbinding (besluit 82): de laatste stand, grijs, met sinds wanneer,
   * en niets om op te drukken. Komt de verbinding terug, dan is het weg.
   */
  /*
   * Een tablet zonder de balken van het systeem is breder dan 16:10 (de Tab
   * A9+: 1280 × 728). De wand groeit dan mee in de breedte: geen lege rand.
   */
  it('vult op een breed scherm de hele breedte, zonder te scrollen', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 728 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    for (const pagina of ['thuis.html', 'kamer.html', 'opbrengst.html', 'indeling.html']) {
      await p.goto(`${baseUrl}/${pagina}`);
      await p.locator('#wand main').waitFor();
      const r = await p.evaluate<{ links: number; rechts: number; boven: number; onder: number }>("(() => { const b = document.getElementById('wand').getBoundingClientRect(); return { links: b.left, rechts: innerWidth - b.right, boven: b.top, onder: innerHeight - b.bottom }; })()");
      expect(Math.abs(r.links), `${pagina} links`).toBeLessThan(1);
      expect(Math.abs(r.rechts), `${pagina} rechts`).toBeLessThan(1);
      expect(Math.abs(r.boven), `${pagina} boven`).toBeLessThan(1);
      expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1'), `${pagina} scrolt`).toBe(true);
    }
    await context.close();
  }, 30_000);

  /* Meten met (besluit 123): een sensor aan- en weer uitzetten bij Indeling. */
  it('kiest bij Indeling met welke sensor een kamer meet', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const huis = (await (await fetch(`${baseUrl}/api/huis`)).json()) as HouseReport;
    const kamer = huis.etages.flatMap((e) => e.ruimtes).find((r) => r.apparaten.some((d) => d.meting?.temperatuurC != null))!;
    const bron = kamer.apparaten.find((d) => d.meting?.temperatuurC != null)!;
    // Meten met staat bij Verwarmen en koelen (besluit 167).
    await p.goto(`${baseUrl}/indeling.html#${encodeURIComponent(kamer.id)}/warmte`);
    const chip = p.locator(`#wand [data-meten="${bron.id}"]`);
    await chip.click({ timeout: 10_000 });
    await expect.poll(() => layoutStore.current?.kamers.find((k) => k.id === kamer.id)?.meten).toEqual([bron.id]);
    await p.locator(`#wand [data-meten="${bron.id}"][aria-pressed="true"]`).click({ timeout: 5000 });
    await expect.poll(() => layoutStore.current?.kamers.find((k) => k.id === kamer.id)?.meten ?? null).toBeNull();
    expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Verwarmen en koelen per kamer (besluit 132): wat er hangt toevoegen, een
   * thermostaat aanvullen met vermogen, en op zon aanzetten.
   */
  it('legt bij Indeling vast wat er in een kamer verwarmt, en zet het op zon', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const huis = (await (await fetch(`${baseUrl}/api/huis`)).json()) as HouseReport;
    // Een kamer met een regeling en een thermostaat die alleen verwarmt.
    const kamer = huis.etages.flatMap((e) => e.ruimtes).find((r) => r.zoneId && r.apparaten.some((d) => d.soort === 'klimaat' && d.actuatorId && d.klimaat?.kanVerwarmen && !d.klimaat.kanKoelen))!;
    const thermo = kamer.apparaten.find((d) => d.soort === 'klimaat' && d.actuatorId && !d.klimaat?.kanKoelen)!;
    await p.goto(`${baseUrl}/indeling.html#${encodeURIComponent(kamer.id)}/warmte`);
    const blad = p.locator('#wand [data-blad]');
    await blad.locator('[data-kamertab="warmte"][aria-selected="true"]').waitFor({ timeout: 10_000 });
    // Een thermostaat die alleen verwarmt, is de thermostaat van de cv-ketel (besluit 167). Wat eraan hangt, kies je ook daar (issue 140).
    const ketel = huis.etages.flatMap((e) => e.ruimtes).flatMap((r) => r.apparaten).find((d) => d.soort === 'klimaat' && !d.radiatorknop && d.klimaat?.kanVerwarmen && !d.klimaat.kanKoelen)!;
    expect(ketel.actuatorId).toBe(thermo.actuatorId);
    await blad.locator('.bron', { hasText: 'Thermostaat van de cv-ketel' }).waitFor({ timeout: 10_000 });
    expect(await blad.locator(`[data-bron-nieuw="${thermo.actuatorId}"]`).count()).toBe(1);
    // Een radiator op de cv: aan met de thermostaat van de ketel, zonder een apparaat te kiezen.
    await blad.locator('[data-bron-nieuw=""]').click();
    await blad.locator('[data-bron-soort="radiator"]').click();
    await blad.locator('[data-bron-aan="thermostaat"]').waitFor();
    expect(await blad.locator('[data-bron-aan]').allTextContents()).toEqual([`Met de thermostaat van de cv (${thermo.naam})`, 'Met een slimme radiatorknop', 'Met de hand']);
    await blad.locator('[data-bron-aan="thermostaat"]').click();
    expect(await blad.locator('[data-bron-apparaat]').count()).toBe(0);
    await blad.locator('[data-bron-bewaar]').click();
    const bronnen = () => layoutStore.current?.kamers.find((k) => k.id === kamer.id)?.bronnen ?? null;
    await expect.poll(bronnen).toEqual([expect.objectContaining({ soorten: ['radiator'], aan: 'thermostaat', apparaat: thermo.actuatorId })]);
    // Elektrisch, met een thermostaat uit Home Assistant en een vermogen.
    await blad.locator('[data-bron-nieuw=""]').click();
    await blad.locator('[data-bron-soort="vloer"]').click();
    await blad.locator('[data-bron-vloer="elektrisch"]').click();
    await blad.locator('[data-bron-soort="paneel"]').click();
    await blad.locator('[data-bron-aan="thermostaat"]').click();
    await blad.locator('[data-bron-apparaat]').selectOption(thermo.actuatorId!);
    await blad.locator('[data-bron-w]').fill('1150');
    await blad.locator('[data-bron-bewaar]').click();
    await expect.poll(() => bronnen()?.[1]).toEqual(expect.objectContaining({ soorten: ['vloer-elektrisch', 'paneel'], aan: 'thermostaat', apparaat: thermo.actuatorId, vermogenW: 1150 }));
    // Op zon: meteen in de regeling.
    await blad.locator(`[data-bron-zon="${bronnen()?.[1]?.id}"]`).click();
    await expect.poll(() => bronnen()?.[1]?.opZon).toBe(true);
    // Een kachel met de hand: geen vermogen, wel een idee.
    await blad.locator('[data-bron-nieuw=""]').click();
    await blad.locator('[data-bron-soort="kachel"]').click();
    await blad.locator('[data-bron-aan="hand"]').click();
    expect(await blad.locator('[data-bron-w]').count()).toBe(0);
    await blad.locator('[data-bron-bewaar]').click();
    await expect.poll(() => bronnen()?.length).toBe(3);
    await blad.locator('.bron .idee').first().waitFor();
    expect(bronnen()?.[2]).toEqual(expect.objectContaining({ soorten: ['kachel'], aan: 'hand' }));
    expect(bronnen()?.[2]?.vermogenW).toBeUndefined();
    // Weer weghalen.
    await blad.locator(`[data-bron-open="${bronnen()?.[2]?.id}"]`).click();
    await blad.locator('[data-bron-weg]').click();
    await expect.poll(() => bronnen()?.length).toBe(2);
    expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * De regeling per kamer (besluit 138): bij Verwarmen en koelen per apparaat
   * wat de regeling ermee doet, en bovenaan waarmee de kamer meet.
   */
  it('kiest bij Indeling per apparaat wat de regeling ermee doet', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const huis = (await (await fetch(`${baseUrl}/api/huis`)).json()) as HouseReport;
    // Een kamer met een airco die op zon helpt.
    const kamer = huis.etages.flatMap((e) => e.ruimtes).find((r) => r.zoneId && r.apparaten.some((d) => d.klimaat?.rol === 'zon'))!;
    const airco = kamer.apparaten.find((d) => d.klimaat?.rol === 'zon')!;
    await p.goto(`${baseUrl}/indeling.html#${encodeURIComponent(kamer.id)}/warmte`);
    const blad = p.locator('#wand [data-blad]');
    // Meten met en de regeling staan hier, bij Verwarmen en koelen (besluit 167).
    await blad.locator('[data-actie="regeling"]').waitFor({ timeout: 10_000 });
    expect(await blad.textContent()).toContain('Meten met');
    expect(kamer.meetMet.length).toBeGreaterThan(0);
    const keuze = blad.locator(`[data-rol="${airco.actuatorId}"]`);
    expect(await keuze.inputValue()).toBe('zon');
    await blad.locator('.rolzin').first().waitFor();
    await keuze.selectOption('houdt');
    const rollen = () => layoutStore.current?.kamers.find((k) => k.id === kamer.id)?.rollen ?? null;
    await expect.poll(rollen).toEqual(expect.objectContaining({ [airco.actuatorId!]: 'houdt' }));
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT });
    // Terug zoals het was, voor de andere tests.
    await blad.locator(`[data-rol="${airco.actuatorId}"]`).selectOption('zon');
    await expect.poll(() => rollen()?.[airco.actuatorId!]).toBe('zon');
    expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
    // Het overzicht bij Regeling: per kamer wat er regelt, met een tik naar de kamer.
    await p.goto(`${baseUrl}/regeling.html#klimaat`);
    const rij = p.locator('#wand .kamerrij', { hasText: kamer.naam });
    await rij.waitFor({ timeout: 10_000 });
    expect(await rij.textContent()).toContain('helpt op zon');
    expect(await rij.getAttribute('href')).toBe(`indeling.html#${encodeURIComponent(kamer.id)}/warmte`);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-regeling.png') });
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Inrichten op de telefoon, staand (28 oktober 2026): geen welkom onder de
   * stap, en Terug, Later en Volgende bij elke stap onderin, kort of lang.
   */
  it('houdt op de telefoon bij elke stap van Inrichten de knoppen onderin, zonder welkom eronder', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'UTC', locale: 'nl-NL', hasTouch: true, isMobile: true });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    for (const stap of ['woning', 'stem', 'warmte', 'ha', 'functies']) {
      await p.goto(`${baseUrl}/inrichten.html#${stap}`);
      const kaart = p.locator('#tel [data-kaart]');
      await kaart.locator('h1').waitFor({ timeout: 10_000 });
      await kaart.locator('.voet [data-volgende], .voet .knop').first().waitFor();
      expect(await p.locator('#tel [data-welkom]').isVisible(), stap).toBe(false);
      // Als de stap klaar is met opbouwen (de gegevens komen na de eerste tekening).
      await expect.poll(() => kaart.locator('.voet').evaluate((v) => Math.round(v.getBoundingClientRect().bottom)), { message: stap, timeout: 5_000 }).toBeGreaterThanOrEqual(842);
      expect(await kaart.locator('.voet').evaluate((v) => Math.round(v.getBoundingClientRect().bottom)), stap).toBeLessThanOrEqual(846);
    }
    expect(fouten).toEqual([]);
    await context.close();
  }, 60_000);

  /*
   * Inrichten op de wand (4 november 2026): bij Meter van nu viel Volgende
   * onder de kaart weg en schoof er niets. Nu schuift de inhoud, en blijven de
   * knoppen bij elke stap binnen de kaart en aan te tikken.
   */
  it('houdt op de wand bij elke stap van Inrichten de knoppen binnen de kaart', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const stappen = ['woning', 'huis', 'buiten', 'bewoners', 'apparaten', 'meten', 'warmte', 'apparaat', 'dag', 'comfort', 'afwezig', 'zekering', 'vermogen', 'zon', 'ligging', 'opzon', 'prijzen', 'functies', 'wand', 'ha', 'stem', 'account', 'klaar'];
    for (const stap of stappen) {
      await p.goto(`${baseUrl}/inrichten.html#${stap}`);
      const kaart = p.locator('#wand [data-kaart]');
      await kaart.locator('h1').waitFor({ timeout: 10_000 });
      const knop = kaart.locator('.voet .knop, .voet .zachtknop').last();
      await knop.waitFor();
      // De gegevens komen na de eerste tekening: even laten opbouwen.
      await p.waitForTimeout(300);
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', `-inr-${stap}.png`) });
      // Zoals bij een huis met veel meters: de inhoud langer dan de kaart.
      const maat = await kaart.evaluate((k) => {
        const lang = k.ownerDocument.createElement('div');
        lang.style.cssText = 'flex: none; height: 900px';
        k.querySelector(':scope > .midden')!.append(lang);
        const voet = k.querySelector(':scope > .voet')!.getBoundingClientRect();
        const rand = k.getBoundingClientRect();
        const knoppen = [...k.querySelectorAll(':scope > .voet .knop, :scope > .voet .zachtknop')].map((b) => {
          const r = b.getBoundingClientRect();
          const raak = k.ownerDocument.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!raak && (raak === b || b.contains(raak));
        });
        return { onder: Math.round(voet.bottom - rand.bottom), knoppen };
      });
      expect(maat.onder, stap).toBeLessThanOrEqual(0);
      expect(maat.knoppen.every(Boolean), stap).toBe(true);
    }
    expect(fouten).toEqual([]);
    await context.close();
  }, 120_000);

  /*
   * De eerste start (4 november 2026): kwam het voorstel niet door de toets,
   * dan zag een tester alleen "zo niet bruikbaar". Nu staat erbij wat er mis is.
   */
  it('zegt bij de eerste start wat SunArc wegliet', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const huis = await (await fetch(`${baseUrl}/api/huis`, { headers: { cookie: `hems_sessie=${sessionId}` } })).json();
    await context.route(`${baseUrl}/api/onboarding*`, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ json: { ok: true, pad: '/config/sites/mijn-huis.json', weggelaten: ['apparaat Kapotte kachel: kan niets', 'zone Zolder: zonder apparaat'] } })
        : route.fulfill({ json: { huis, keuzes: [], bestaande: [] } }),
    );
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/begin.html`);
    await p.locator('[data-inrichten]').first().click({ timeout: 15_000 });
    const zin = p.locator('[data-weggelaten]').first();
    await zin.waitFor({ timeout: 10_000 });
    expect(await zin.innerText()).toContain('Wat SunArc nog niet begrijpt, liet hij weg (2).');
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  it('zegt bij de eerste start wat er mis is als het voorstel niet bruikbaar is', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const huis = await (await fetch(`${baseUrl}/api/huis`, { headers: { cookie: `hems_sessie=${sessionId}` } })).json();
    // Het adres naar GitHub opvangen, en een logboek met één regel.
    await context.addInitScript("window.geopend = []; window.open = (url) => { window.geopend.push(url); return null; };");
    await context.route(`${baseUrl}/api/logboek*`, (route) => route.fulfill({ json: { regels: [{ ms: Date.UTC(2026, 10, 4, 12), niveau: 'waarschuwing', tekst: 'Eerste start niet opgeslagen: zones.0.climate.0: onbekende adapter' }] } }));
    await context.route(`${baseUrl}/api/onboarding*`, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 422, json: { ok: false, reden: 'De configuratie is zo niet bruikbaar.', problemen: ['zones.0.climate.0: onbekende adapter', 'outdoorTemperature: geen sensor'] } })
        : route.fulfill({ json: { huis, keuzes: [], bestaande: [] } }),
    );
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/begin.html`);
    await p.locator('[data-inrichten]').first().click({ timeout: 15_000 });
    const lijst = p.locator('.fout-lijst').first();
    await lijst.waitFor({ timeout: 10_000 });
    expect(await lijst.innerText()).toContain('zones.0.climate.0: onbekende adapter');
    expect(await p.locator('.fout').first().innerText()).toBe('De configuratie is zo niet bruikbaar.');

    // Meld dit: het meldblad met de fout erin, en het logboek mee naar GitHub.
    await p.locator('.meld-dit').first().click();
    const blad = p.locator('[data-meldpop]');
    await blad.locator('[data-meldlog]').waitFor({ timeout: 10_000 });
    expect(await blad.locator('[data-meldwat]').inputValue()).toContain('zones.0.climate.0: onbekende adapter');
    expect(await blad.locator('[data-meldlog]').isChecked()).toBe(true);
    await blad.locator('[data-meldpop-stuur]').click();
    await expect.poll(() => p.evaluate<number>('window.geopend.length')).toBe(1);
    const url = new URL((await p.evaluate<string[]>('window.geopend'))[0]!);
    expect(url.searchParams.get('logboek')).toBe('2026-11-04 12:00:00 LET OP Eerste start niet opgeslagen: zones.0.climate.0: onbekende adapter');

    // Bij Versie: het logboek zelf lezen.
    await p.goto(`${baseUrl}/toegang.html#versie`);
    await p.locator('#wand [data-logboek] summary').click();
    await expect.poll(() => p.locator('#wand [data-logboek-tekst]').innerText(), { timeout: 8000 }).toContain('onbekende adapter');
    expect(fouten).toEqual([]);
    await context.close();
  }, 50_000);

  /*
   * Een oude pagina uit de opslag (4 november 2026): een geïnstalleerde app
   * die Android terugzet, draaide de oude code door tot je de cache wiste.
   * Nu ziet hij aan de stempel van basis.js dat hij oud is, en laadt één keer.
   */
  it('laadt een oude pagina uit de opslag één keer opnieuw', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    // De pagina zelf gewoon; de pagina zoals de server hem nu geeft, met een nieuwere stempel.
    let geladen = 0;
    await context.route(`${baseUrl}/vandaag.html`, async (route) => {
      const res = await route.fetch();
      if (route.request().resourceType() === 'document') {
        geladen += 1;
        return route.fulfill({ response: res });
      }
      return route.fulfill({ response: res, body: (await res.text()).replace(/basis\.js\?v=[0-9a-f]+/, 'basis.js?v=deadbeef') });
    });
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/vandaag.html`);
    await expect.poll(() => geladen, { timeout: 10_000 }).toBe(2);
    // En daarna niet nog eens, ook al blijft de stempel anders.
    await p.waitForTimeout(3000);
    expect(geladen).toBe(2);
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Dag of nacht zonder zonnestand (4 november 2026): gaf de dienst geen zon,
   * dan toonde Thuis nacht, ook om twee uur 's middags. Nu de klok.
   */
  it('toont overdag dag, ook als de dienst geen zonnestand geeft', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    await context.route(`${baseUrl}/api/zon*`, (route) => route.fulfill({ status: 503, json: { wachten: 'de ligging van het huis komt van Home Assistant zodra die verbonden is' } }));
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.clock.setFixedTime(new Date('2026-11-04T13:00:00Z'));
    await p.goto(`${baseUrl}/thuis.html`);
    const luchtNu = "[...document.body.classList].find((c) => c.startsWith('lucht-')) ?? null";
    await expect.poll(() => p.evaluate<string | null>(luchtNu), { timeout: 10_000 }).not.toBeNull();
    const lucht = await p.evaluate<string | null>(luchtNu);
    expect(lucht).not.toBe('lucht-nacht');
    expect(await p.evaluate<string>('app.tijdVanDeDag(null)')).toBe('dag');
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Etages op de telefoon (28 oktober 2026): vanuit elke etage naar elke andere.
   * Vanaf Buiten kon het naar de eerste verdieping, vanuit de rest niet.
   */
  it('wisselt op de telefoon vanuit elke etage naar elke andere', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'UTC', locale: 'nl-NL', hasTouch: true, isMobile: true });
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const huis = (await (await fetch(`${baseUrl}/api/huis`)).json()) as HouseReport;
    const etages = huis.etages.filter((e) => e.ruimtes.length);
    expect(etages.length).toBeGreaterThanOrEqual(3);
    await p.goto(`${baseUrl}/kamer.html#${encodeURIComponent(etages[0]!.ruimtes[0]!.id)}`);
    const rij = p.locator('#tel [data-etages]');
    await rij.locator('button').first().waitFor({ timeout: 10_000 });
    for (const van of etages) {
      for (const naar of etages) {
        if (naar.id === van.id) continue;
        await rij.locator(`[data-etage="${naar.id}"]`).tap({ timeout: 3_000 });
        await expect.poll(() => rij.locator(`[data-etage="${naar.id}"]`).getAttribute('aria-pressed'), { timeout: 3_000 }).toBe('true');
        await rij.locator(`[data-etage="${van.id}"]`).tap({ timeout: 3_000 });
        await expect.poll(() => rij.locator(`[data-etage="${van.id}"]`).getAttribute('aria-pressed'), { timeout: 3_000 }).toBe('true');
      }
    }
    expect(fouten).toEqual([]);
    await context.close();
  }, 60_000);

  /* Sensoren in de kamer (15 oktober 2026): wat ze meten, hun batterij, en beweging nu. */
  it('toont de bewegingsmelder in de kamer, met beweging nu', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const huis = (await (await fetch(`${baseUrl}/api/huis`)).json()) as HouseReport;
    const kamer = huis.etages.flatMap((e) => e.ruimtes).find((r) => r.apparaten.some((d) => d.meting?.beweging?.nu))!;
    await p.goto(`${baseUrl}/kamer.html#${encodeURIComponent(kamer.id)}`);
    const rij = p.locator('#wand .meterrij', { hasText: 'Beweging, nu' });
    await rij.waitFor({ timeout: 10_000 });
    await p.locator('#wand .beweegt').first().waitFor();
    expect(await p.locator('#wand .sc-beweging').count()).toBeGreaterThan(0);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-beweging.png') });
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Hoe voelt het (besluit 134): tikken kan zonder inlog, er komt meteen een
   * antwoord, en na drie keer hetzelfde in hetzelfde dagdeel een voorstel.
   */
  it('noteert hoe het voelt zonder inlog, en stelt na een paar keer iets voor', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/thuis.html`);
    const kaart = p.locator('#wand [data-gevoel]');
    await kaart.locator('[data-gevoel-tik="te_koud"]').waitFor({ timeout: 10_000 });
    for (let i = 0; i < 3; i++) {
      await kaart.locator('[data-gevoel-tik="te_koud"]').click();
      await kaart.locator('.gevoelantwoord', { hasText: 'Genoteerd: te koud' }).waitFor();
    }
    // Zonder inlog bewaard, met de temperatuur van toen; en het blijft op Thuis.
    expect(new URL(p.url()).pathname).toBe('/thuis.html');
    // De temperatuur van toen staat erbij als de dienst die had; in de CI soms niet.
    expect(await kaart.locator('.gevoelantwoord').textContent()).toMatch(/^Genoteerd: te koud( bij \d+(,\d)?°)?\./);
    // Overdag in de test: drie keer te koud geeft een voorstel, als er overdag verwarmd wordt.
    const voorstel = kaart.locator('.gevoelvoorstel', { hasText: 'Voortaan anders?' });
    if (await voorstel.count()) expect(await voorstel.textContent()).toContain('3 keer te koud');
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Meertalig (besluit 185, stap 8): Engels gekozen bij Jij zet Thuis in het
   * Engels, met de uitleg van de dienst, getallen met een punt en <html
   * lang="en">. En de toegankelijkheidscontrole van besluit 86 op Thuis: axe,
   * WCAG 2 A en AA.
   */
  it('kiest bij Automatisch Engels in een Engelse browser, en Nederlands in een Nederlandse (besluit 185)', async () => {
    for (const [locale, taal, kop] of [['en-GB', 'en', 'Home'], ['nl-NL', 'nl', 'Thuis']] as const) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale });
      await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
      await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
      const p = await context.newPage();
      try {
        await p.goto(`${baseUrl}/thuis.html`);
        expect(await p.evaluate(() => (globalThis as unknown as { document: { documentElement: { lang: string } } }).document.documentElement.lang)).toBe(taal);
        expect(await p.evaluate(() => (globalThis as unknown as { taal: { t: (k: string) => string } }).taal.t('nav.thuis'))).toBe(kop);
      } finally {
        await context.close();
      }
    }
  });

  /*
   * Zon, dak en kompas (besluit 205): het dak volgt het huis (hier de nok langs
   * de straat, met een dakvlak van glas), en bij Zonnepanelen loopt de zon zijn
   * ring van vandaag met de tijd van opkomst. Bij Weergave kan de ring uit.
   */
  it('tekent het dak zoals het huis ligt, en bij Zonnepanelen de ring van de zon (besluit 205)', async () => {
    const huis = (await (await fetch(`${baseUrl}/api/huis`)).json()) as HouseReport;
    expect(huis.ligging).toEqual({ voorgevelDeg: 97, nok: 'langs', hellingDeg: 47 });
    const zon = (await (await fetch(`${baseUrl}/api/zon`)).json()) as { baan: unknown[] };
    expect(zon.baan.length).toBeGreaterThan(30);
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => {
      localStorage.setItem('sc-rondleiding-gezien', '1');
      localStorage.setItem('sc-rond-daken-gezien', '1');
    });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const zet = (aan: boolean) => p.evaluate(`fetch('api/voorkeuren', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plek: 'tel', weergave: { zonnebaan: ${aan} } }) }).then((r) => r.status)`);
    try {
      const wand = p.locator('#wand');
      const svg = wand.locator('[data-pan-podium] svg.sc-huis');
      // Naar het huis bij Daken en panelen (besluit 254): de wissel van boven naar het huis.
      const naarHuis = async () => {
        await wand.locator('[data-dak-zicht="huis"]').click({ timeout: 10_000 });
        await svg.waitFor({ timeout: 10_000 });
      };
      await p.goto(`${baseUrl}/energie.html#panelen`);
      await naarHuis();
      // De opkomst met een pijl omhoog, bij het begin van de ring.
      await expect.poll(() => svg.locator('text', { hasText: '↑' }).count(), { timeout: 10_000 }).toBe(1);
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-zonring.png') });
      // Uit bij Weergave: geen ring meer.
      expect(await zet(false)).toBe(200);
      await p.reload();
      await naarHuis();
      await p.waitForTimeout(500);
      expect(await svg.locator('text', { hasText: '↑' }).count()).toBe(0);
      // Ook de stippelboog van Thuis gaat dan weg; de zon zelf blijft.
      const boog = (uit: boolean) =>
        p.evaluate(`(() => {
          document.documentElement.classList.toggle('sc-geen-zonnebaan', ${uit});
          const el = document.createElement('div');
          document.body.append(el);
          huis.teken(el, { tijd: 'dag', etages: [{ naam: 'Begane grond', kamers: [{ id: 'wk', naam: 'Woonkamer', apparaten: [] }] }], zon: { stand: 0.4, aandeel: 0.5 } }, { breedte: 860, hoogte: 612 });
          const n = el.querySelectorAll('[stroke-dasharray="2 7"]').length;
          el.remove();
          return n;
        })()`);
      expect(await boog(true)).toBe(0);
      expect(await boog(false)).toBe(1);
      expect(fouten).toEqual([]);
    } finally {
      await zet(true);
      await context.close();
    }
  }, 40_000);

  it('opent buiten een blad naast het huis: lampen per deel, zones in de tuin en alles buiten uit (besluit 206)', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    try {
      await p.goto(`${baseUrl}/thuis.html`);
      await p.locator('#wand svg.sc-huis .sc-tik').first().waitFor();
      const blad = p.locator('#weer-wand');
      // Een tik op de oprit: het blad, en je blijft op Thuis.
      await p.locator('#wand .sc-tik[aria-label="Oprit"]').click();
      await expect.poll(() => blad.isVisible()).toBe(true);
      expect(await blad.locator('h2').textContent()).toBe('Oprit');
      expect(new URL(p.url()).pathname).toBe('/thuis.html');
      // De oprit licht op in het huis, met een stippellijn.
      await expect.poll(() => p.locator('#wand svg.sc-huis [stroke-dasharray="7 5"]').count()).toBeGreaterThan(0);
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-oprit.png') });
      // Een lamp schakelen: alleen licht, via dezelfde deur als de knoppen in een kamer.
      const voor = lightCalls.length;
      await blad.locator('[data-bb-lamp="light.oprit"]').click();
      await expect.poll(() => lightCalls.slice(voor)).toEqual([expect.stringMatching(/^turn_(on|off) light\.oprit$/)]);
      // Alles buiten: per deel, en alles in één keer uit.
      await blad.locator('[data-bb-open="alles"]').click();
      await expect.poll(() => blad.locator('h2').textContent()).toBe('Alles buiten');
      expect(await blad.locator('.bb-sectie').allTextContents()).toEqual(['Voor het huis', 'In de tuin']);
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-buiten.png') });
      const uit = blad.locator('[data-bb-buiten]');
      if (await uit.isEnabled()) {
        const n = lightCalls.length;
        await uit.click();
        await expect.poll(() => lightCalls.length).toBe(n + 1);
        expect(lightCalls.at(-1)).toMatch(/^turn_off .*light\.oprit/);
      }
      // Geen knop Buiten in de kopregel (0.90.1): buiten tik je aan op het huis, zoals een kamer.
      expect(await p.locator('#wand [data-alles-buiten]').count()).toBe(0);
      await p.keyboard.press('Escape');
      await expect.poll(() => blad.isVisible()).toBe(false);

      // De tuin in zones: de lampen van de border in hun kleur, het overstek bij het tuinhuis, en elke zone om op te tikken.
      const achtertuin = {
        id: 'achtertuin',
        naam: 'Achtertuin',
        buiten: { soort: 'tuin', auto: false, tuinhuis: true },
        zones: [{ id: 'b', naam: 'Border', soort: 'border' }, { id: 'o', naam: 'Overstek', soort: 'overstek' }, { id: 't', naam: 'Terras' }],
        apparaten: [
          { id: 'light.roos', soort: 'licht', naam: 'Spot roos', aan: true, zone: 'b', licht: { tint: [330, 60] } },
          { id: 'light.buxus', soort: 'licht', naam: 'Spot buxus', aan: false, zone: 'b' },
          { id: 'light.overstek', soort: 'licht', naam: 'Spots', aan: true, zone: 'o' },
          { id: 'light.terras', soort: 'licht', naam: 'Terraslamp', aan: true, zone: 't' },
        ],
      };
      const tuin = (await p.evaluate(`huismodel.buiten([${JSON.stringify(achtertuin)}]).tuin`)) as Record<string, unknown>;
      expect(tuin['borderLampen']).toEqual([{ aan: true, kleur: 'hsl(330 60% 70%)' }, { aan: false, kleur: '#FFD9A0' }]);
      expect(tuin['overstekAan']).toBe(true);
      expect(tuin['terrasAan']).toBe(true);
      expect(tuin['lampen']).toEqual([]);
      expect(tuin['zones']).toEqual({ border: { id: 'b', naam: 'Border' }, overstek: { id: 'o', naam: 'Overstek' }, terras: { id: 't', naam: 'Terras' } });
      const zones = (await p.evaluate(`(() => {
        const el = document.createElement('div');
        document.body.append(el);
        huis.teken(el, { etages: [{ naam: 'Begane grond', kamers: [{ id: 'wk', naam: 'Woonkamer', apparaten: [] }] }], tuin: { ...${JSON.stringify(tuin)}, zone: 'border' } }, { breedte: 860, hoogte: 612, tik: true });
        const uit = [...el.querySelectorAll('.sc-tik[data-zone]')].map((x) => x.getAttribute('data-kamer') + '::' + x.getAttribute('data-zone'));
        el.remove();
        return uit;
      })()`)) as string[];
      expect(zones.sort()).toEqual(['achtertuin::b', 'achtertuin::o', 'achtertuin::t']);
      expect(fouten).toEqual([]);
    } finally {
      await context.close();
    }
  }, 40_000);

  it('toont Thuis in het Engels als je dat bij Jij kiest, en haalt de toegankelijkheidscontrole', async () => {
    const zet = (taal: string) => fetch(`${baseUrl}/api/voorkeuren`, { method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl }, body: JSON.stringify({ plek: 'tel', taal }) });
    // Een bewoner op zijn eigen telefoon: een scherm, zoals de wand, volgt zijn eigen account.
    const bewonersWas = bewonersStore.current;
    await bewonersStore.save(voegToe(GEEN_BEWONERS, { userId: 'u', naam: 'Test' }, null, Date.now()));
    expect((await zet('en')).status).toBe(200);
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    try {
      // De eerste keer kent de pagina de keuze nog niet: hij haalt hem op en laadt zich opnieuw in het Engels.
      await p.goto(`${baseUrl}/thuis.html`);
      await expect.poll(() => p.evaluate(() => (globalThis as unknown as { document: { documentElement: { lang: string } } }).document.documentElement.lang), { timeout: 10_000 }).toBe('en');
      const wand = p.locator('#wand');
      await wand.locator('[data-gevoel-tik="te_koud"]').waitFor({ timeout: 10_000 });
      await expect.poll(() => wand.locator('[data-kop]').textContent(), { timeout: 10_000 }).not.toMatch(/^(Loading|Even laden)$/);
      const tekst = (await wand.innerText()).replace(/\s+/g, ' ');
      for (const engels of ['Favourites', 'How does it feel now?', 'Too cold', 'What are you doing now?', 'Put the lights']) expect(tekst).toContain(engels);
      for (const nl of ['Favorieten', 'Hoe voelt het', 'Te koud', 'Kijkt mee', 'Goedemorgen', 'Goedemiddag', 'Goedenavond', 'Wat doe je nu', 'Zet hier lampen']) expect(tekst).not.toContain(nl);
      // De datum bovenin in het Engels, welke dag het ook is.
      expect(tekst).not.toMatch(/maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag/);
      // Het menu, de uitleg van de dienst, en getallen en tijden in het Engels.
      expect(await p.locator('#balk').innerText()).toMatch(/Home[\s\S]*Today[\s\S]*Devices/);
      expect(await wand.locator('[data-kop]').textContent()).not.toBe('Het huis');
      expect(await p.evaluate(() => (globalThis as unknown as { taal: { getal: (n: number) => string } }).taal.getal(20.5))).toBe('20.5');
      expect(await p.evaluate(() => (globalThis as unknown as { taal: { klok: (ms: number) => string } }).taal.klok(Date.UTC(2026, 9, 22, 22, 5)))).toBe('22:05');
      // Een tik: het antwoord in het Engels.
      await wand.locator('[data-gevoel-tik="te_koud"]').click();
      await wand.locator('.gevoelantwoord', { hasText: 'Noted: too cold' }).waitFor();

      // De toegankelijkheidscontrole (besluit 86): de wand van Thuis, WCAG 2 A en AA.
      await p.addScriptTag({ path: createRequire(import.meta.url).resolve('axe-core/axe.min.js') });
      const fout = await p.evaluate(async () => {
        const axe = (globalThis as unknown as { axe: { run: (ctx: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
        const r = await axe.run('#wand', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
        return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);
      });
      expect(fout).toEqual([]);

      // Stap 9 (besluit 185): de meldingen, Aanpassen en de rondleiding op Thuis ook in het Engels.
      await p.locator('#balk [data-meldbel]').click();
      await p.locator('[data-meldblad] h2', { hasText: 'Notifications' }).waitFor();
      expect(await p.locator('[data-meldblad]').innerText()).toMatch(/Maintenance/);
      await p.keyboard.press('Escape');
      if (await p.locator('[data-meldblad]').isVisible()) await p.locator('[data-meldblad] [data-meld-sluit]').click();
      await wand.locator('[data-aanpassen]').click();
      await p.locator('[data-bewerkkop]', { hasText: 'You are customising' }).waitFor();
      expect(await p.locator('[data-bewerkkop]').innerText()).toMatch(/\+ Card[\s\S]*Done/);
      await p.locator('[data-bewerkkop] [data-klaar]').click();
      await wand.locator('[data-uitleg]').click();
      await p.locator('.rl-kaart', { hasText: 'This is your house' }).waitFor();
      expect(await p.locator('.rl-kaart').innerText()).toMatch(/Skip[\s\S]*Next/);

      // Stap 9, deel 2: Kamer, Vandaag, Apparaten, Opbrengst en Assistent in het Engels, met de controle van besluit 86.
      await p.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
      const paginas: [string, RegExp][] = [
        ['kamer.html', /House[\s\S]*(Climate|Lights|Sensors)/],
        ['vandaag.html', /Yesterday[\s\S]*Today[\s\S]*Tomorrow/],
        ['apparaten.html', /Devices[\s\S]*(Add a device|No sun|to spare)/],
        ['opbrengst.html', /Day[\s\S]*Week[\s\S]*Month[\s\S]*Year/],
        ['assistent.html', /How can I help you|What can I do for you|Go ahead, I am listening/],
        // Deel 3: Instellingen en de pagina's erachter.
        ['instellingen.html', /Settings[\s\S]*What your house can do/],
        ['jij.html', /How the app looks[\s\S]*Theme and colour/],
        ['comfort.html', /Comfort[\s\S]*What is this for\?/],
        ['regeling.html', /Control[\s\S]*Climate[\s\S]*Appliances on solar/],
        ['energie.html', /Energy setup[\s\S]*Roofs and panels[\s\S]*Connection[\s\S]*Meters/],
        ['functies.html', /Features[\s\S]*Cameras[\s\S]*Doorbell[\s\S]*Lights and screens/],
        ['toegang.html', /Residents and access[\s\S]*Version/],
        ['bewoners.html', /Who lives here, in order/],
        // Deel 4: Wat je huis kan, Indeling, Inrichten en het begin.
        ['huis-kan.html', /What your house can do[\s\S]*Comfort[\s\S]*What the house learns first[\s\S]*On solar/],
        ['voortgang.html', /How far your house is[\s\S]*Fully working/],
        ['indeling.html', /Rooms and layout[\s\S]*(Add a floor|Name of the floor)/],
        ['inrichten.html', /Welcome[\s\S]*home\.[\s\S]*Always says why/],
        ['inrichten.html#warmte', /What heats and cools\?/],
        ['inrichten.html#apparaat', /What each device can do/],
        ['inrichten.html#klaar', /Your house is set up/],
      ];
      for (const [pagina, tekst] of paginas) {
        await p.goto(`${baseUrl}/${pagina}`);
        await expect.poll(() => wand.innerText(), { timeout: 10_000 }).toMatch(tekst);
        await p.addScriptTag({ path: createRequire(import.meta.url).resolve('axe-core/axe.min.js') });
        const opPagina = await p.evaluate(async () => {
          const axe = (globalThis as unknown as { axe: { run: (ctx: unknown, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
          const r = await axe.run('#wand', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
          return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);
        });
        expect(opPagina, pagina).toEqual([]);
        // Om te zien of de Engelse zinnen passen: HEMS_PAGE_SHOTS=<map> maakt per pagina een afdruk.
        if (process.env.HEMS_PAGE_SHOTS) await p.screenshot({ path: `${process.env.HEMS_PAGE_SHOTS}/${pagina.replace('.html', '').replace('#', '-')}-en.png` });
      }
      // De film in het Engels: het eerste beeld, pauzeren en overslaan.
      await p.locator('#wand [data-kaart] button', { hasText: 'Play' }).click();
      const film = p.locator('.film');
      await film.locator('[data-film-huis] svg.sc-huis').waitFor({ timeout: 10_000 });
      expect(await film.getAttribute('aria-label')).toBe('The film of your house');
      expect(await film.locator('[data-film-opnieuw]').textContent()).toBe('Play again');
      await film.locator('[data-film-pauze]').click();
      expect(await film.locator('[data-film-pauze]').getAttribute('aria-label')).toBe('Continue playing');
      expect(await film.locator('[data-film-klaar]').innerText()).toBe('Skip');
      await film.locator('[data-film-klaar]').click();
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT });
      expect(fouten).toEqual([]);
    } finally {
      await zet('auto');
      await bewonersStore.save(bewonersWas);
      await context.close();
    }
  }, 80_000);

  /* Meldingen (besluit 136): de bel met een getal, het blad, Onderhoud, en na een update wat er nieuw is. */
  it('toont meldingen achter de bel, Onderhoud, en na een update wat er nieuw is', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addInitScript(() => {
      localStorage.setItem('sc-rondleiding-gezien', '1');
      // Een oudere versie gezien: dan komt er één keer de pop-up.
      if (!sessionStorage.getItem('al')) {
        localStorage.setItem('sc-versie-gezien', '0.0.1');
        sessionStorage.setItem('al', '1');
      }
    });
    // Weghalen vraagt een bewoner, zoals Negeer (besluit 136).
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/vandaag.html`);
    // Wat is er nieuw, één keer.
    const pop = p.locator('[data-nieuwpop]');
    await pop.waitFor({ timeout: 10_000 });
    expect(await pop.textContent()).toContain(`Wat is er nieuw in ${VERSIE}`);
    // Eén overzicht sinds de versie die je eerder zag, ook wat in een eerdere versie kwam (6 november 2026).
    expect(await pop.textContent()).toContain(eersteVan(NIEUW[1]!));
    expect(await pop.locator('.soort.opgelost').count()).toBeLessThanOrEqual(1);
    expect(await p.locator('[data-nieuw-dicht]').textContent()).toBe('Oké');
    await p.locator('[data-nieuw-dicht]').click();
    expect(await pop.count()).toBe(0);
    // De bel met een getal, op elke pagina.
    const bel = p.locator('#wand [data-meldbel]');
    await expect.poll(() => bel.locator('[data-meldaantal]').textContent(), { timeout: 10_000 }).toBe('1');
    await bel.click();
    const blad = p.locator('[data-meldblad]');
    await blad.locator('.melding', { hasText: 'De droger reageert niet meer' }).waitFor();
    // Gelezen (15 oktober): het getal is weg, de melding staat er nog.
    expect(await bel.locator('[data-meldaantal]').isHidden()).toBe(true);
    await blad.locator('[data-meld-onderhoud]').click();
    await blad.locator('h2', { hasText: 'Onderhoud' }).waitFor();
    // Een melding weghalen met het kruisje: het getal verdwijnt (aangevuld 15 oktober).
    await blad.locator('[data-meld-terug]').click();
    await blad.locator('.melding', { hasText: 'De droger reageert niet meer' }).locator('[data-meld-weg]').click();
    await blad.locator('.stil', { hasText: 'Alles werkt' }).waitFor();
    expect(await bel.locator('[data-meldaantal]').isHidden()).toBe(true);
    await blad.locator('[data-meld-sluit]').click();
    expect(await blad.isHidden()).toBe(true);
    // De volgende keer geen pop-up meer.
    await p.reload();
    await bel.waitFor();
    await p.waitForTimeout(1600);
    expect(await pop.count()).toBe(0);
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Bijwerken vanuit de app (21 oktober 2026): een melding als er een nieuwe
   * versie klaarstaat; een tik geeft wat er nieuw is en de knop Bijwerken.
   */
  it('meldt een nieuwe versie, met wat er nieuw is en een knop Bijwerken', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addInitScript(() => {
      localStorage.setItem('sc-rondleiding-gezien', '1');
    });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const bron = { nu: Date.now(), zonderRuimte: [], volgen: [], batterijen: [], filters: [], meters: [], versie: null, winterdagen: null };
    updateNu.klaar = true;
    meldingenStore.bij({ ...bron });
    try {
      await p.goto(`${baseUrl}/vandaag.html`);
      // Wat is er nieuw na een eigen update hoort hier niet: die is al gezien.
      await p.evaluate((v) => localStorage.setItem('sc-versie-gezien', v), VERSIE);
      await p.reload();
      await p.locator('#wand [data-meldbel]').click({ timeout: 5_000 });
      const blad = p.locator('[data-meldblad]');
      await blad.waitFor();
      expect(await blad.locator('.melding', { hasText: 'Versie 9.9.9 staat klaar' }).count()).toBe(0);
      // Live (21 oktober 2026): de dienst zegt dat er een melding bij kwam, en de open lijst toont hem zonder te herladen.
      meldingenStore.bij({ ...bron, update: { nieuw: '9.9.9', nu: VERSIE } });
      server.meldingenVeranderd();
      await blad.locator('.melding', { hasText: 'Versie 9.9.9 staat klaar' }).click({ timeout: 5_000 });
      const pop = p.locator('[data-nieuwpop]');
      await pop.locator('h2', { hasText: 'Versie 9.9.9 staat klaar' }).waitFor({ timeout: 5_000 });
      expect(await pop.textContent()).toContain('Iets nieuws voor de wand');
      expect(await pop.textContent()).toContain('Een fout weg');
      expect(await pop.textContent()).toContain(`Je hebt ${VERSIE}`);
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT });
      await pop.locator('[data-bijwerken]').click({ timeout: 5_000 });
      await expect.poll(() => updateNu.installeer).toBe(1);
      await pop.locator('[data-bijwerk-zin]', { hasText: 'wordt bijgewerkt' }).waitFor({ timeout: 5_000 });
      expect(await pop.locator('.knop-licht').isDisabled()).toBe(true);
      await pop.locator('[data-nieuw-dicht]').click({ timeout: 5_000 });
      expect(await pop.count()).toBe(0);
      expect(fouten).toEqual([]);
    } finally {
      updateNu.klaar = false;
      updateNu.installeer = 0;
      meldingenStore.bij({ ...bron, nu: Date.now() });
      await context.close();
    }
  }, 30_000);

  /* Schermen (besluit 121) en batterijen (besluit 122). */
  it('bedient een scherm vanuit Kamer, en meldt een lege batterij op Thuis', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const huis = (await (await fetch(`${baseUrl}/api/huis`)).json()) as HouseReport & { schermenBedienen: boolean };
    expect(huis.schermenBedienen).toBe(true);
    const kamer = huis.etages.flatMap((e) => e.ruimtes).find((r) => r.apparaten.some((d) => d.id === 'cover.screen'))!;
    await p.goto(`${baseUrl}/kamer.html#${encodeURIComponent(kamer.id)}/cover.screen`);
    const wand = p.locator('#wand');
    // Een io-screen (schets Wand-Bedienen): Open, Half, de stand van nu en Dicht.
    await wand.locator('[data-scherm]').first().waitFor({ timeout: 10_000 });
    expect(await wand.locator('[data-scherm]').allTextContents()).toEqual(['Open', 'Half', '60%', 'Dicht']);
    await wand.locator('[data-scherm="stand:100"]').click({ timeout: 10_000 });
    await expect.poll(() => coverCalls.at(-1)).toBe('set_cover_position cover.screen 0');
    // Home Assistant meldt de nieuwe stand hier nooit: het doek blijft toch dicht staan (besluit 129).
    await p.waitForTimeout(1500);
    expect(await wand.locator('[data-standtekst]').textContent()).toBe('100%');
    // De greep slepen: helemaal omhoog is open.
    const doek = wand.locator('[data-schermsleep]');
    const vak = (await doek.boundingBox())!;
    const greep = (await wand.locator('[data-greep] rect').boundingBox())!;
    await p.mouse.move(greep.x + greep.width / 2, greep.y + greep.height / 2);
    await p.mouse.down();
    await p.mouse.move(greep.x + greep.width / 2, vak.y + 4, { steps: 6 });
    await p.mouse.up();
    await expect.poll(() => coverCalls.at(-1)).toBe('set_cover_position cover.screen 100');
    if (process.env.HEMS_PAGE_SHOT) await wand.locator('.blad').screenshot({ path: process.env.HEMS_PAGE_SHOT });
    expect(await wand.textContent()).toContain('De regeling doet er niets mee');

    // Een batterij onder de 10%: een pil op Thuis; een tik opent de lijst (besluit 127).
    extraBatterijen = [
      { id: 'd-knop', naam: 'Knop bank', pct: 7, kamer: kamer.naam, kamerId: kamer.id, leeg: true },
      { id: 'd-dimmer', naam: 'Hue dimmer switch', pct: 64, kamer: null, kamerId: null, leeg: false },
    ];
    await p.goto(`${baseUrl}/thuis.html`);
    // Onderhoud staat alleen bij de bel (besluit 226): geen sleutel meer op Thuis.
    await wand.locator('[data-kop]').waitFor({ timeout: 10_000 });
    expect(await wand.locator('[data-onderhoud-knop]').count()).toBe(0);
    // De hele lijst blijft achter het weer.
    await p.evaluate("location.hash = '#batterijen'; location.reload()");
    const lijst = wand.locator('#weer-wand');
    await expect.poll(() => lijst.isVisible()).toBe(true);
    expect(await lijst.getAttribute('aria-label')).toBe('Batterijen');
    const rijen = await lijst.locator('.accu').allTextContents();
    expect(rijen).toHaveLength(2);
    expect(rijen[0]).toMatch(/Knop bank\s*7%/);
    expect(rijen[1]).toMatch(/Hue dimmer switch\s*64%\s*Nog in geen kamer/);
    expect(await lijst.locator('a.accu').getAttribute('href')).toBe(`kamer.html#${encodeURIComponent(kamer.id)}`);
    await lijst.locator('.sluit').click();
    await expect.poll(() => lijst.isVisible()).toBe(false);
    extraBatterijen = [];
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Het schermtoetsenbord (besluit 124): de wand houdt zijn maat en schuift
   * omhoog tot het veld zichtbaar is; daarna staat alles weer op zijn plek. En
   * een te volle kolom schuift binnen zijn vak.
   */
  /*
   * Comfort (besluit 130): per kamer een balk per dagdeel. Een greep slepen
   * bewaart meteen, en de dienst rekent ermee.
   */
  /*
   * Met een vinger (21 oktober 2026): alleen het bolletje slepen verandert de
   * temperatuur, en het gaat mee tot je loslaat. Daarna doet een tik op de
   * balk of ergens anders niets. Eerst werd het bolletje onder de vinger
   * vervangen; dan bleef het slepen aan en sprong het naar elke volgende tik.
   */
  /*
   * Terug naar standaard (besluit 204): een kamer met één knop, en het hele huis
   * pas na "zeker?". De standaard is zuinig: 20° overdag, 16° 's nachts.
   */
  it('zet een kamer en het hele huis terug naar de standaard (besluit 204)', async () => {
    const was = comfortNu;
    const wasConfig = configNu;
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const shot = async (naam: string) => {
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', `-${naam}.png`) });
    };
    try {
      const zone = exampleSite.zones.find((z) => z.setpoints.dag?.heat != null)!;
      await p.goto(`${baseUrl}/comfort.html#${zone.id}`);
      const wand = p.locator('#wand');
      const knop = wand.locator('[data-standaard-kamer]');
      await knop.waitFor({ timeout: 10_000 });
      await shot('std-kamer');
      await knop.click();
      await expect.poll(() => comfortNu?.kamers[zone.id]?.modi.nacht?.heat, { timeout: 5_000 }).toBe(16);
      expect(comfortNu?.kamers[zone.id]?.modi.dag?.heat).toBe(20);
      expect(comfortNu?.kamers[zone.id]?.modi.afwezig?.heat).toBe(15);
      await expect.poll(() => knop.count()).toBe(0);
      // Het hele huis: eerst vragen, dan alles, ook de dagdelen.
      await p.goto(`${baseUrl}/comfort.html#standaard`);
      await wand.locator('[data-vorm] h2', { hasText: 'Terug naar standaard' }).waitFor();
      expect(await wand.locator('[data-vorm]').textContent()).toContain('16°');
      await wand.locator('[data-standaard-alles="vraag"]').click();
      await wand.locator('[data-standaard-alles="ja"]').waitFor();
      await shot('std-zeker');
      await wand.locator('[data-standaard-alles="ja"]').click();
      await wand.locator('[data-vorm]', { hasText: 'Alles staat op de standaard.' }).waitFor({ timeout: 5_000 });
      await expect.poll(() => comfortNu?.dagdelen, { timeout: 5_000 }).toEqual({ voorverwarmen: 6, dag: 7, nacht: 22 });
      for (const z of exampleSite.zones) expect(comfortNu?.kamers[z.id]?.nooitWarmerC ?? null).toBeNull();
      // Binnen wat de apparaten kunnen: de badkamerthermostaat begint bij 16°, dus weg wordt daar 16° in plaats van 15°.
      expect(comfortNu?.kamers['badkamer']?.modi.afwezig?.heat).toBe(16);
      expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
      expect(fouten).toEqual([]);
    } finally {
      comfortNu = was;
      configNu = wasConfig;
      await context.close();
    }
  }, 40_000);

  /* Terug naar standaard bij Functies (per onderdeel) en bij Jij (het uiterlijk), besluit 204. */
  it('zet een onderdeel van Functies en het uiterlijk bij Jij terug naar de standaard (besluit 204)', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/functies.html#meldingen`);
    const vk0 = await p.evaluate(`fetch('api/voorkeuren').then((r) => r.json())`) as { tel: { thema: string; kleur: string; weergave: Record<string, boolean> } };
    const f0 = await p.evaluate(`fetch('api/functies').then((r) => r.json())`) as { instellingen: unknown; voorstel: { meldingen: { batterij: number } } };
    const post = (pad: string, body: unknown) => p.evaluate(`fetch('${pad}', { method: 'POST', headers: { 'content-type': 'application/json' }, body: ${JSON.stringify(JSON.stringify(body))} }).then((r) => r.status)`);
    try {
      const wand = p.locator('#wand');
      await wand.locator('[data-kies="drempelBatterij"]').first().waitFor({ timeout: 10_000 });
      // Anders dan het voorstel: dan staat de knop er.
      await wand.locator('[data-kies="drempelBatterij"][data-waarde="30"]').click();
      const knop = wand.locator('[data-standaard-deel="meldingen"]');
      await knop.waitFor();
      await knop.click();
      await expect.poll(async () => (await p.evaluate(`fetch('api/functies').then((r) => r.json())`) as { instellingen: { meldingen: { batterij: number } } }).instellingen.meldingen.batterij, { timeout: 5_000 }).toBe(f0.voorstel.meldingen.batterij);
      await expect.poll(() => knop.count()).toBe(0);
      // Jij: een ander thema, en terug.
      expect(await post('api/voorkeuren', { plek: 'tel', thema: 'licht' })).toBe(200);
      await p.goto(`${baseUrl}/jij.html`);
      const terug = p.locator('#wand [data-std-uiterlijk], [data-jij] [data-std-uiterlijk]').first();
      await terug.waitFor({ timeout: 10_000 });
      await terug.click();
      await expect.poll(async () => (await p.evaluate(`fetch('api/voorkeuren').then((r) => r.json())`) as { tel: { thema: string } }).tel.thema, { timeout: 5_000 }).toBe('donker');
      await expect.poll(() => p.locator('[data-std-uiterlijk]').count()).toBe(0);
      expect(fouten).toEqual([]);
    } finally {
      await post('api/voorkeuren', { plek: 'tel', thema: vk0.tel.thema, kleur: vk0.tel.kleur, weergave: vk0.tel.weergave });
      if (f0.instellingen) await post('api/functies', f0.instellingen);
      await context.close();
    }
  }, 40_000);

  it('sleept comfort met een vinger, en een tik ergens anders verandert niets', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const zone = exampleSite.zones[0]!;
    await p.goto(`${baseUrl}/comfort.html#${zone.id}`);
    const wand = p.locator('#wand');
    const greep = wand.locator('[data-modus="dag"] [data-greep="heat"]');
    await greep.waitFor({ timeout: 10_000 });
    const cdp = await context.newCDPSession(p);
    const raak = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const waarde = () => greep.getAttribute('aria-valuenow').then(Number);
    const voor = await waarde();
    const vak = (await wand.locator('[data-modus="dag"] .schaal').boundingBox())!;
    const g = (await greep.boundingBox())!;
    // Net naast het midden pakken, en twee graden naar links schuiven (de balk is 20 graden breed).
    const x0 = g.x + g.width / 2 + 4;
    const y = g.y + g.height / 2;
    // Het bolletje onder de vinger blijft hetzelfde: op Android gaan bewegen en loslaten naar dat ene bolletje.
    await greep.evaluate((el) => ((globalThis as unknown as { __greep: unknown }).__greep = el));
    await raak('touchStart', x0, y);
    for (let i = 1; i <= 8; i++) await raak('touchMove', x0 - (vak.width * 0.1 * i) / 8, y);
    // Tijdens het slepen gaat het bolletje mee, zonder te springen.
    await expect.poll(waarde).toBe(voor - 2);
    expect(await p.evaluate(() => (globalThis as unknown as { __greep: { isConnected: boolean } }).__greep.isConnected)).toBe(true);
    await raak('touchEnd', 0, 0);
    await expect.poll(() => comfortNu?.kamers[zone.id]?.modi.dag?.heat, { timeout: 5_000 }).toBe(voor - 2);
    // Een tik op de balk, en een tik ergens anders: niets verandert.
    for (const [x, yy] of [[vak.x + vak.width * 0.9, vak.y + vak.height / 2], [vak.x + 40, vak.y - 120]] as const) {
      await raak('touchStart', x, yy);
      await raak('touchEnd', 0, 0);
    }
    await p.waitForTimeout(900);
    expect(await waarde()).toBe(voor - 2);
    expect(comfortNu?.kamers[zone.id]?.modi.dag?.heat).toBe(voor - 2);
    expect(fouten).toEqual([]);
    await context.close();
  }, 20_000);

  it('zet comfort per kamer met een greep, en bewaart meteen', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const zone = exampleSite.zones[0]!;
    await p.goto(`${baseUrl}/comfort.html#${zone.id}`);
    const wand = p.locator('#wand');
    await wand.locator('[data-delen] .deel').first().waitFor({ timeout: 10_000 });
    const delen = await wand.locator('[data-delen] .deel b').allTextContents();
    expect(delen).toEqual([...exampleSite.zones.map((z) => z.name), 'Dagdelen', 'Voorrang', 'Afwezig en vakantie', 'Terug naar standaard']);
    // De verwarmgreep van overdag een stuk naar rechts.
    const greep = wand.locator('[data-modus="dag"] [data-greep="heat"]');
    const vak = (await wand.locator('[data-modus="dag"] .schaal').boundingBox())!;
    const g = (await greep.boundingBox())!;
    await p.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await p.mouse.down();
    // 10 tot 30 graden over de balk: naar 75% is 25°, maar koelen ligt erboven, dus een graad eronder.
    await p.mouse.move(vak.x + vak.width * 0.5, g.y + g.height / 2, { steps: 5 });
    await p.mouse.up();
    await expect.poll(() => comfortNu?.kamers[zone.id]?.modi.dag?.heat, { timeout: 5_000 }).toBe(20);
    expect(configNu.zones[0]!.setpoints.dag.heat).toBe(20);
    await expect.poll(() => wand.locator('[data-bewaard]').textContent()).toContain('Bewaard');
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT });
    // Met de pijltjes een halve graad omhoog.
    await wand.locator('[data-modus="dag"] [data-greep="heat"]').focus();
    await p.keyboard.press('ArrowRight');
    await expect.poll(() => comfortNu?.kamers[zone.id]?.modi.dag?.heat, { timeout: 5_000 }).toBe(20.5);
    // Een tik op de regel: wanneer het aan- en uitgaat (besluit 133).
    await wand.locator('[data-modus="dag"] [data-uitleg$=":heat"]').click();
    expect(await wand.locator('[data-modus="dag"] .regel small').first().textContent()).toMatch(/^Aan onder .*, uit bij /);
    // Per kamer alleen overdag en 's nachts; op zon mag het 2 graden verder.
    expect(await wand.locator('[data-vorm] [data-modus]').evaluateAll((els) => els.map((e) => e.getAttribute('data-modus')))).toEqual(['dag', 'nacht']);
    const opZon = wand.locator('[data-opzon="2"]');
    if (await opZon.count()) {
      await opZon.click();
      await expect.poll(() => comfortNu?.kamers[zone.id]?.opZonC, { timeout: 5_000 }).toBe(2);
      expect(configNu.zones[0]!.buffering).toMatchObject({ enabled: true, bandC: 2 });
    }
    // Afwezig en vakantie in hun eigen deel, per kamer te kiezen.
    await wand.locator('[data-delen] .deel', { hasText: 'Afwezig en vakantie' }).click();
    await wand.locator('[data-vorm] [data-modus="vakantie"]').waitFor();
    expect(await wand.locator('[data-afwezig-kamer]').count()).toBe(exampleSite.zones.length);
    // Voorrang (besluit 134): bij koelen de tweede kamer omhoog.
    await wand.locator('[data-delen] .deel', { hasText: 'Voorrang' }).click();
    await wand.locator('[data-vorm] .rang').first().waitFor();
    const koelVoor = configNu.zones.filter((z) => comfortView(configNu, null).voorrang.koelen.includes(z.id));
    if (koelVoor.length > 1) {
      const tweede = comfortView(configNu, comfortNu).voorrang.koelen[1]!;
      await wand.locator(`[data-schuif="koelen:${tweede}:-1"]`).click();
      await expect.poll(() => comfortNu?.voorrang?.koelen[0], { timeout: 5_000 }).toBe(tweede);
      expect(configNu.zones.find((z) => z.id === tweede)?.priorityByAction?.cool).toBe(1);
    }
    // Op zon (besluit 176): de droger staat achteraan; omhoog, en de regeling krijgt de volgorde.
    const zonRijen = wand.locator('[data-vorm] .rang', { hasText: 'Op zon' }).locator('.r');
    const zonLijst = comfortView(configNu, comfortNu).voorrang.zon;
    expect(await zonRijen.count()).toBe(zonLijst.length);
    expect(await zonRijen.last().textContent()).toContain('Droger');
    // Nog niets gekozen: de regeling heeft geen volgorde op zon.
    expect(configNu.sunOrder).toBeUndefined();
    await wand.locator(`[data-schuif="zon:${zonLijst.length - 1}:-1"]`).click();
    await expect.poll(() => configNu.sunOrder?.at(-2), { timeout: 5_000 }).toEqual({ kind: 'deferrable', id: 'droger' });
    expect(await zonRijen.nth(zonLijst.length - 2).textContent()).toContain('Droger');
    expect(await wand.locator('[data-delen] .deel', { hasText: 'Voorrang' }).textContent()).not.toContain('droger eerst');
    // Past op de wand zonder te scrollen.
    expect(await p.evaluate<boolean>('document.scrollingElement.scrollHeight <= innerHeight + 1')).toBe(true);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-voorrang.png') });
    // De dagdelen: overdag een uur later.
    await wand.locator('[data-delen] .deel', { hasText: /^\s*Dagdelen/ }).click();
    await wand.locator('[data-uur="dag:1"]').click();
    await expect.poll(() => configNu.schedule.dayFromHour, { timeout: 5_000 }).toBe(exampleSite.schedule.dayFromHour + 1);
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  it('houdt de maat bij een schermtoetsenbord, en laat volle kolommen schuiven', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/assistent.html`);
    const veld = p.locator('#wand [data-vrij] input');
    await veld.waitFor();
    const schaal = () => p.evaluate<string>("getComputedStyle(document.documentElement).getPropertyValue('--wandschaal').trim()");
    const voor = await schaal();
    await veld.focus();
    // Het toetsenbord komt: het scherm is nog 430 hoog.
    await p.setViewportSize({ width: 1280, height: 430 });
    await expect.poll(async () => (await veld.boundingBox())!.y + (await veld.boundingBox())!.height, { timeout: 5000 }).toBeLessThanOrEqual(430);
    expect(await schaal()).toBe(voor);
    // Het toetsenbord gaat weg.
    await veld.evaluate((el) => (el as unknown as { blur: () => void }).blur());
    await p.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(() => p.evaluate<string>("getComputedStyle(document.documentElement).getPropertyValue('--toetsschuif').trim()")).toBe('0px');
    expect(await schaal()).toBe(voor);
    // Een groep achter het tandwiel: elk vak schuift zelf, de pagina niet (besluit 130).
    await p.goto(`${baseUrl}/energie.html#prijzen`);
    await p.locator('#wand [data-vorm] h2').first().waitFor();
    const vakken = await p.evaluate<string[]>("['[data-delen]', '[data-vorm]', '[data-naast]'].map((s) => getComputedStyle(document.querySelector('#wand ' + s)).overflowY)");
    expect(vakken.every((o) => o === 'auto')).toBe(true);
    await p.goto(`${baseUrl}/thuis.html`);
    expect(await p.evaluate<string>("getComputedStyle(document.querySelector('#wand .rechts')).overflowY")).toBe('auto');
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /* Een liggende telefoon krijgt de wand van de tablet, staand de telefoon (besluit 120). */
  it('toont op een liggende telefoon de tabletweergave, en staand de telefoon', async () => {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    for (const pagina of ['thuis.html', 'kamer.html', 'opbrengst.html']) {
      await p.goto(`${baseUrl}/${pagina}`);
      await p.locator('#wand main').waitFor();
      expect(await p.evaluate<boolean>("document.documentElement.classList.contains('tel-stand')"), pagina).toBe(false);
      expect(await p.locator('#wand').isVisible(), pagina).toBe(true);
      const r = await p.evaluate<{ links: number; rechts: number; boven: number; onder: number }>("(() => { const b = document.getElementById('wand').getBoundingClientRect(); return { links: b.left, rechts: innerWidth - b.right, boven: b.top, onder: innerHeight - b.bottom }; })()");
      // Binnen het scherm, en het vult de hoogte.
      expect(r.links, `${pagina} links`).toBeGreaterThanOrEqual(-1);
      expect(r.rechts, `${pagina} rechts`).toBeGreaterThanOrEqual(-1);
      expect(Math.abs(r.boven), `${pagina} boven`).toBeLessThan(1);
      expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1'), `${pagina} scrolt`).toBe(true);
    }
    // Draai je hem rechtop, dan de telefoon.
    await p.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => p.evaluate<boolean>("document.documentElement.classList.contains('tel-stand')")).toBe(true);
    await context.close();
  }, 30_000);

  /*
   * Camera's en deurbel (besluit 109): het voorstel uit Home Assistant, een
   * ander beeld kiezen, en opslaan in het eigen bestand.
   */
  it('stelt de camera\u2019s en de deurbel in, en bewaart meteen', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/instellingen.html`);
    await p.locator('#wand a.tegel[href="functies.html"]').click();
    const wand = p.locator('#wand');
    await wand.locator('.regelrij', { hasText: 'Camera oprit' }).waitFor();
    expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
    // Het voorstel: het vloeiende beeld. Nu het scherpe.
    expect(await wand.locator('[aria-label="Beeld van Camera oprit"] button[aria-pressed="true"]').textContent()).toBe('Vloeiend');
    await wand.locator('[aria-label="Beeld van Camera oprit"] button', { hasText: 'Scherp' }).click();
    await expect.poll(() => functiesStore.current?.cameras, { timeout: 5_000 }).toEqual({ aan: true, lijst: ['camera.camera_oprit_duidelijk'] });
    // Licht: de installatie staat het toe, dus bedienen staat aan; hier op alleen kijken (besluit 111).
    await wand.locator('[data-delen] .deel', { hasText: 'Licht en screens' }).click();
    await wand.locator('[data-vorm] h2', { hasText: 'Licht en screens' }).waitFor();
    expect(await wand.locator('[aria-label="Licht bedienen"] button[aria-pressed="true"]').textContent()).toBe('Bedienen in de app');
    await wand.locator('[aria-label="Licht bedienen"] button', { hasText: 'Alleen kijken' }).click();
    await expect.poll(() => functiesStore.current?.licht, { timeout: 5_000 }).toEqual({ bedienen: false });
    // Meldingen (besluit 149): een batterij al onder de 20%, een filter nooit.
    await wand.locator('[data-delen] .deel', { hasText: 'Meldingen' }).click();
    await wand.locator('[aria-label="Batterij bijna leeg onder"] button', { hasText: '20%' }).click();
    await wand.locator('[aria-label="Filter bijna vol onder"] button', { hasText: 'Nooit' }).click();
    await expect.poll(() => functiesStore.current?.meldingen, { timeout: 5_000 }).toEqual({ batterij: 20, filter: null });
    expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
    // Zonder deurbel in Home Assistant zegt de pagina dat.
    await wand.locator('[data-delen] .deel', { hasText: 'Deurbel' }).click();
    await wand.locator('[data-vorm] h2', { hasText: 'Deurbel' }).waitFor();
    expect(await wand.textContent()).toContain('Geen deurbel gevonden');
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Inrichten in één keer (besluit 139): over het hele scherm, de stappen
   * bovenaan, links het huis en rechts één vraag. Van Instellingen naar
   * Inrichten, en zonder van pagina te wisselen door alle stappen.
   */
  it('loopt in één pagina door het inrichten', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const shot = async (naam: string) => {
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', `-${naam}.png`) });
    };
    await p.goto(`${baseUrl}/instellingen.html`);
    await p.locator('#wand a[href="inrichten.html"]').click();
    const kaart = p.locator('#wand [data-kaart]');
    // Groot welkom (besluit 200): over het hele scherm, het huis bouwt zich op en de labels hangen eraan.
    const welkom = p.locator('#wand [data-welkom]');
    await welkom.locator('h1', { hasText: 'Welkom' }).waitFor({ timeout: 10_000 });
    await welkom.locator('.wk-label[data-lijst="apparaten"]').waitFor({ timeout: 10_000 });
    expect(await p.locator('#wand .bovenbalk').isVisible()).toBe(false);
    // Ook hier een kruisje naar Thuis (4 november 2026): de balk met het kruisje staat er niet.
    expect(await welkom.locator('.wk-sluit').isVisible()).toBe(true);
    expect(await welkom.locator('.wk-sluit').getAttribute('href')).toBe('thuis.html');
    await p.waitForTimeout(800);
    // Acht hoofdstukken met hun stappen (besluit 190).
    expect(await p.locator('#wand [data-stappen] .stap').count()).toBe(8);
    expect(await p.locator('#wand [data-stappen] .stipjes i').count()).toBe(23);
    expect(await p.locator('#wand #balk').count()).toBe(0);
    await shot('welkom');
    // De getallen tikken open tot een lijst, en weer terug (besluit 158).
    await welkom.locator('[data-lijst="apparaten"]').click();
    await kaart.locator('.waar', { hasText: 'wat er gevonden is' }).waitFor();
    expect(await kaart.locator('.rij').count()).toBeGreaterThan(0);
    await shot('welkom-lijst');
    await kaart.locator('button[data-lijst=""]').click();
    await welkom.locator('h1', { hasText: 'Welkom' }).waitFor();
    await welkom.locator('a', { hasText: 'Begin' }).click();
    // Wat voor huis (besluit 190): vijf soorten, elk met een klein huis erin.
    await kaart.locator('h1', { hasText: 'Wat voor huis is het?' }).waitFor();
    expect(await kaart.locator('.tegel').count()).toBe(5);
    await kaart.locator('.tegel [data-mini] svg').first().waitFor();
    await kaart.locator('[data-woning="hoek"]').click();
    await kaart.locator('[data-woning="hoek"][aria-pressed="true"]').waitFor({ timeout: 5000 });
    await shot('woning');
    await kaart.locator('[data-volgende]').click();
    await kaart.locator('h1', { hasText: 'Klopt de indeling?' }).waitFor();
    // Een kamer aantikken: de naam, de etage en de zones, elk met zijn naam erboven.
    await kaart.locator('[data-kamer]').first().click();
    await kaart.locator('[data-naam]').waitFor();
    expect(await kaart.locator('.veldlabel > span', { hasText: 'Etage' }).count()).toBe(1);
    await kaart.locator('[data-nieuwezone]').waitFor();
    // Verplaatsen (besluit 166): links en rechts in het vak, en de kamers in het huis zijn aan te tikken.
    await kaart.locator('[data-kamer] + [data-kamer]').first().click();
    await kaart.locator('[data-schuifkamer]').first().waitFor({ timeout: 5000 });
    expect(await kaart.locator('[data-schuifkamer]').count()).toBe(2);
    expect(await p.locator('#wand [data-podium="wand"] .sc-tik').count()).toBeGreaterThan(0);
    await shot('huis');
    // Een etage erbij (testerronde, november 2026): eerst kon dat pas later bij Indeling.
    await kaart.locator('[data-inr-etage-open]').click();
    await kaart.locator('[data-inr-etage="e3"]').click();
    await kaart.locator('.etagekop', { hasText: '3e verdieping' }).waitFor({ timeout: 5000 });
    expect(await kaart.locator('.zacht', { hasText: 'Nog geen kamers' }).count()).toBe(1);
    // Weer zonder eigen volgorde, zodat de tests hierna het gewone huis zien.
    const metDak = (await (await fetch(`${baseUrl}/api/indeling`, { headers: { cookie: `hems_sessie=${sessionId}` } })).json()) as { indeling: Record<string, unknown> };
    const { volgorde: _v, ...zonderDak } = metDak.indeling;
    await fetch(`${baseUrl}/api/indeling`, { method: 'POST', headers: { cookie: `hems_sessie=${sessionId}`, origin: baseUrl, 'content-type': 'application/json' }, body: JSON.stringify(zonderDak) });
    await p.reload();
    await kaart.locator('h1', { hasText: 'Klopt de indeling?' }).waitFor();
    // Onderaan overal Terug, Later en Volgende; Volgende bewaart het voorstel als eigen indeling.
    expect(await kaart.locator('[data-terug]').count()).toBe(1);
    expect(await kaart.locator('[data-later]').count()).toBe(1);
    await kaart.locator('[data-volgende]').click();
    await p.waitForURL(/#apparaten$/);
    await kaart.locator('.waar', { hasText: '1. Je huis · Per kamer' }).waitFor();
    // Alles in de stap zelf (besluit 166): een apparaat aantikken geeft verplaatsen en weghalen.
    expect(await kaart.locator('[data-bekijk]').count()).toBe(0);
    await kaart.locator('[data-apparaat]').first().click();
    await kaart.locator('[data-verplaats]').waitFor({ timeout: 5000 });
    await shot('apparaten');
    await kaart.locator('[data-volgende]').click();
    await p.waitForURL(/#buiten$/);
    await kaart.locator('h1', { hasText: 'Wat is er rond je huis?' }).waitFor();
    // Elk deel rond het huis apart aan of uit (besluit 158), met garage en carport (besluit 166), de jacuzzi (besluit 190)
    // en de border (6 november 2026), die alleen kan met een achtertuin.
    expect(await kaart.locator('[data-rond]').count()).toBe(11);
    const border = kaart.locator('[data-rond="border"]');
    const tuinAan = (await kaart.locator('[data-rond="tuin"]').getAttribute('aria-checked')) === 'true';
    expect(await border.isDisabled()).toBe(!tuinAan);
    expect(await kaart.locator('[data-bsoort]').count()).toBe(0);
    await expect.poll(async () => p.evaluate<number>('document.querySelectorAll("#wand .stap .stipjes i.al").length')).toBe(3);
    await shot('buiten');
    await kaart.locator('[data-volgende]').click();
    // Wie woont hier (besluit 147): wie al ingelogd is, en de code om anderen te laten inloggen.
    await kaart.locator('h1', { hasText: 'Wie woont hier?' }).waitFor();
    await kaart.locator('.qr svg').waitFor();
    await shot('bewoners');
    await kaart.locator('[data-volgende]').click();
    await kaart.locator('h1', { hasText: 'Wat verwarmt en koelt er?' }).waitFor();
    expect(await kaart.locator('[data-rol]').count()).toBeGreaterThan(0);
    // Drie knoppen per apparaat, zoals de schets (besluit 146).
    const seg = kaart.locator('[data-rol]').first();
    const doel = (await seg.locator('[aria-pressed="true"]').getAttribute('data-rolwaarde')) === 'zon' ? 'kijken' : 'zon';
    await seg.locator(`[data-rolwaarde="${doel}"]`).click();
    await kaart.locator(`[data-rol] [data-rolwaarde="${doel}"][aria-pressed="true"]`).first().waitFor({ timeout: 5000 });
    await shot('warmte');
    // Vloerverwarming (0.92.0): eerst op water of elektrisch; elektrisch gaat aan met een thermostaat naar keuze.
    await kaart.locator('[data-erbij]').first().click();
    await kaart.locator('[data-toevoeg-soort="vloer"]').click();
    await kaart.locator('[data-toevoeg-vloer="elektrisch"]').waitFor();
    expect(await kaart.locator('[data-toevoeg-aan]').count()).toBe(0);
    await kaart.locator('[data-toevoeg-vloer="elektrisch"]').click();
    await kaart.locator('[data-toevoeg-aan="thermostaat"]').click();
    const welke = kaart.locator('select[data-toevoeg-apparaat]');
    await welke.waitFor();
    expect(await welke.locator('option').count()).toBeGreaterThan(1);
    expect(await kaart.locator('[data-toevoeg-bewaar]').isDisabled()).toBe(true);
    await kaart.locator('[data-toevoeg-annuleer]').click();
    await expect.poll(() => kaart.locator('[data-toevoeg-soort]').count()).toBe(0);
    await kaart.locator('[data-volgende]').click();
    // Wat elk apparaat kan (besluit 197): per apparaat de punten, met de rol onderaan.
    await kaart.locator('h1', { hasText: 'Wat elk apparaat kan' }).waitFor();
    expect(await kaart.locator('.kapp').count()).toBeGreaterThan(0);
    expect(await kaart.locator('.klos .kpunt').count()).toBeGreaterThan(0);
    await shot('apparaat');
    await kaart.locator('[data-volgende]').click();
    await kaart.locator('h1', { hasText: 'Welke thermometer telt per kamer?' }).waitFor();
    await shot('meten');
    await kaart.locator('[data-volgende]').click();
    // Je dag (6 november 2026): drie grepen, en een uur later gaat meteen naar de dienst.
    await kaart.locator('h1', { hasText: 'Hoe ziet je dag eruit?' }).waitFor();
    expect(await kaart.locator('[data-dg-greep]').count()).toBe(3);
    const comfortNu = async () => (await (await fetch(`${baseUrl}/api/comfort`, { headers: { cookie: `hems_sessie=${sessionId}` } })).json()) as { dagdelen: { nacht: number }; kamers: { id: string; kanVerwarmen: boolean; modi: { nacht: { heat: number | null } } }[] };
    const nachtWas = (await comfortNu()).dagdelen.nacht;
    await kaart.locator(`[data-dg="nacht:${nachtWas < 23 ? 1 : -1}"]`).click();
    await expect.poll(async () => (await comfortNu()).dagdelen.nacht, { timeout: 5000 }).toBe(nachtWas < 23 ? nachtWas + 1 : nachtWas - 1);
    await shot('dag');
    await kaart.locator('[data-volgende]').click();
    await kaart.locator('h1', { hasText: 'Hoe warm wil je het?' }).waitFor();
    // Per kamer overdag en 's nachts, elk getal aan te tikken (6 november 2026).
    await kaart.locator('.cf-tabel').waitFor();
    const kamer = (await comfortNu()).kamers.find((k) => k.kanVerwarmen);
    if (kamer) {
      const was = kamer.modi.nacht.heat;
      await kaart.locator(`[data-cf="${kamer.id}|nacht|heat"]`).click();
      await kaart.locator(`[data-cf="${kamer.id}|nacht|heat"][aria-pressed="true"]`).waitFor({ timeout: 5000 });
      await kaart.locator('[data-cf-stap="-0.5"]').click();
      await expect.poll(async () => (await comfortNu()).kamers.find((k) => k.id === kamer.id)?.modi.nacht.heat, { timeout: 5000 }).not.toBe(was);
    }
    await shot('comfort');
    await kaart.locator('[data-volgende]').click();
    // Afwezig en vakantie (besluit 190): een halve graad per tik.
    await kaart.locator('h1', { hasText: 'Als niemand thuis is' }).waitFor();
    expect(await kaart.locator('[data-afw]').count()).toBeGreaterThanOrEqual(4);
    await shot('afwezig');
    await kaart.locator('[data-volgende]').click();
    await kaart.locator('h1', { hasText: 'Hoe zwaar is je aansluiting?' }).waitFor();
    // "Weet ik niet" (een tester, november 2026): geen uitgeschakelde lijst, wel een zin; daarna kan een fase gewoon.
    await kaart.locator('[data-zekering="weetniet"]').click();
    await kaart.locator('.tip', { hasText: 'hoofdschakelaar' }).waitFor({ timeout: 5000 });
    expect(await kaart.locator('[data-ampere]').count()).toBe(0);
    // Eerst de fasen, dan de ampère in een vak.
    await kaart.locator('[data-fasen="3"]').click();
    await kaart.locator('[data-fasen="3"][aria-pressed="true"]').waitFor({ timeout: 5000 });
    await kaart.locator('[data-ampere]').selectOption('40');
    await expect.poll(async () => ((await (await fetch(`${baseUrl}/api/aansluiting`, { headers: { cookie: `hems_sessie=${sessionId}` } })).json()) as { antwoorden?: { zekering?: unknown } }).antwoorden?.zekering, { timeout: 5000 }).toEqual({ fasen: 3, ampere: 40 });
    await shot('zekering');
    await kaart.locator('[data-volgende]').click();
    // De netmeter en de omvormers (testerronde, november 2026): een keuzelijst met wat elke sensor nu zegt.
    await kaart.locator('h1', { hasText: 'Wat meet het vermogen van nu?' }).waitFor();
    await kaart.locator('[data-netmeter="afname"]').waitFor();
    await shot('vermogen');
    await kaart.locator('[data-volgende]').click();
    // De korte stap Daken (besluit 254, stap 3): plekken aantikken, bij het hoofddak de kanten; elke plek wordt een vlak.
    await kaart.locator('h1', { hasText: 'Waar liggen je panelen?' }).waitFor();
    await shot('daken-vraag');
    // Wat SunArc al afleidt staat er: het hoofddak met twee kanten. Drie kanten en terug, dan de garage erbij.
    await kaart.locator('[data-kort-kanten="3"]').click();
    await kaart.locator('input[data-kort-kant="2"]').waitFor({ timeout: 5000 });
    await kaart.locator('[data-kort-kanten="2"]').click();
    await expect.poll(() => kaart.locator('input[data-kort-kant]').count(), { timeout: 5000 }).toBe(2);
    await kaart.locator('[data-kort-plek="garage"]').click();
    await kaart.locator('input[data-kort-n="garage"]').waitFor({ timeout: 5000 });
    // Wat er al stond (een eerdere test bewaarde een uitbouw) blijft; het hoofddak heeft twee kanten, de garage is er geschat bij.
    const dakVlakken = async () => ((await (await fetch(`${baseUrl}/api/aansluiting`, { headers: { cookie: `hems_sessie=${sessionId}` } })).json()) as { antwoorden?: { daken?: { vlakken: { plek: string; bron: string }[] } | null } }).antwoorden?.daken?.vlakken.map((v) => `${v.plek}:${v.bron}`);
    await expect.poll(async () => (await dakVlakken())?.filter((v) => v.startsWith('hoofddak:')).length, { timeout: 5000 }).toBe(2);
    expect(await dakVlakken()).toContain('garage:schatting');
    // Ook met alle plekken aan valt niets buiten de kaart: de wand schuift nooit.
    while ((await kaart.locator('button[data-kort-plek]').count()) > 0) {
      const voor = await kaart.locator('button[data-kort-plek]').count();
      await kaart.locator('button[data-kort-plek]').first().click();
      await expect.poll(() => kaart.locator('button[data-kort-plek]').count(), { timeout: 5000 }).toBeLessThan(voor);
    }
    expect(await kaart.locator('.midden').evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(2);
    await shot('zon');
    await kaart.locator('[data-volgende]').click();
    // Hoe ze liggen: de vlakken, nog geschat tot de meting ze vindt; Aanpassen gaat naar Daken en panelen.
    await kaart.locator('.waar', { hasText: '5. Energie · Hoe ze liggen' }).waitFor();
    expect(await kaart.locator('.kp-vlak').count()).toBeGreaterThanOrEqual(3);
    await kaart.locator('a[href="energie.html#panelen"]', { hasText: 'Aanpassen' }).waitFor();
    await kaart.locator('[data-volgende], [data-lig-klopt]').first().waitFor();
    await shot('ligging');
    await kaart.locator('[data-volgende], [data-lig-klopt]').first().click();
    // Op zon (besluit 190): elk apparaat met een schakelaar.
    await kaart.locator('h1', { hasText: 'Wat mag er op zon?' }).waitFor();
    await shot('opzon');
    await kaart.locator('[data-volgende]').click();
    await kaart.locator('h1', { hasText: 'Wat betaal je?' }).waitFor();
    // Eerst het contract, dan de velden die erbij horen (besluit 158).
    await kaart.locator('[data-contract="dagnacht"]').click();
    await kaart.locator('[data-prijs="stroomDal"]').waitFor({ timeout: 5000 });
    await shot('prijzen');
    await kaart.locator('[data-volgende]').click();
    await kaart.locator('h1', { hasText: 'Wat mag de app doen?' }).waitFor();
    expect(await kaart.locator('.schakel').count()).toBeGreaterThan(0);
    await shot('functies');
    await kaart.locator('[data-volgende]').click();
    // Een eigen account voor de wand (besluit 202): waarom, en hoe.
    await kaart.locator('h1', { hasText: 'Een eigen account voor de wand' }).waitFor();
    await shot('account');
    await kaart.locator('[data-volgende]').click();
    // De wand (besluit 190): de kaarten om aan of uit te zetten, en de wand in het klein.
    await kaart.locator('h1', { hasText: 'Hoe ziet de wand eruit?' }).waitFor();
    expect(await kaart.locator('[data-wkaart]').count()).toBe(12);
    await kaart.locator('.wandje [data-mini] svg.sc-huis').waitFor();
    await shot('wand');
    await kaart.locator('[data-volgende]').click();
    // Klaarzetten (besluit 190): wat er in Home Assistant klaar moet staan.
    await kaart.locator('h1', { hasText: 'Staat alles klaar?' }).waitFor();
    await shot('ha');
    await kaart.locator('[data-volgende]').click();
    // Hoe praat je huis (besluit 203): het apparaat staat voorop; helemaal in huis kan ook.
    await kaart.locator('h1', { hasText: 'Hoe praat je huis?' }).waitFor();
    expect(await kaart.locator('[data-stembron="apparaat"]').getAttribute('aria-pressed')).toBe('true');
    expect(await kaart.locator('[data-stemverstaan]').getAttribute('aria-checked')).toBe('true');
    await shot('stem');
    await kaart.locator('[data-stembron="huis"]').click();
    await expect.poll(() => kaart.locator('[data-stembron="huis"]').getAttribute('aria-pressed')).toBe('true');
    // Buiten de add-on: wat je zelf in Home Assistant doet.
    expect(await kaart.textContent()).toContain('Instellingen › Spraakassistenten');
    await kaart.locator('[data-stembron="apparaat"]').click();
    await expect.poll(() => kaart.locator('[data-stembron="apparaat"]').getAttribute('aria-pressed')).toBe('true');
    await kaart.locator('[data-volgende]').click();
    await kaart.locator('h1', { hasText: 'Je huis staat erin' }).waitFor();
    await shot('klaar');
    // De film als trailer (besluit 200): je eigen huis, pauzeren, het geluid uit en overslaan.
    await kaart.locator('button', { hasText: 'Speel af' }).click();
    const film = p.locator('.film');
    await film.locator('[data-film-huis] svg.sc-huis').waitFor({ timeout: 10_000 });
    await shot('film-0');
    await film.locator('[data-film-pauze]').click();
    expect(await film.locator('[data-film-pauze]').getAttribute('aria-label')).toBe('Verder afspelen');
    await film.locator('[data-film-geluid]').click();
    expect(await film.locator('[data-film-geluid]').getAttribute('aria-pressed')).toBe('false');
    await film.locator('[data-film-klaar]').click();
    await p.waitForURL(/thuis\.html#rondleiding$/);
    // Elk beeld, los afgespeeld.
    await p.goto(`${baseUrl}/inrichten.html#klaar`);
    await kaart.locator('h1', { hasText: 'Je huis staat erin' }).waitFor();
    await p.evaluate(`film.speel({}).then((f) => (window.__film = f))`);
    await p.waitForFunction('window.__film != null');
    const aantal = await p.evaluate<number>('window.__film.aantal');
    const soorten = await p.evaluate<string[]>('window.__film.soorten');
    expect(aantal).toBeGreaterThanOrEqual(3);
    // Acht shots van twee maten en een slot van vier; wat geen cijfer heeft, valt weg.
    const lengte = await p.evaluate<number>('window.__film.lengteS');
    expect(lengte).toBeGreaterThan(15);
    expect(lengte).toBeLessThan(45);
    expect(soorten[0]).toBe('opkomst');
    expect(soorten[1]).toBe('huis');
    expect(soorten.at(-1)).toBe('slot');
    for (let i = 0; i < aantal; i++) {
      await p.evaluate(`window.__film.pauze(true); window.__film.naar(${i}); window.__film.pauze(false)`);
      await p.waitForTimeout(1300);
      // Elk shot zijn eigen stuk, en nooit iets leegs.
      const tekst = (await p.locator('.film').innerText()) ?? '';
      expect(tekst).not.toMatch(/undefined|NaN|null/);
      if (soorten[i] === 'apparaten') expect(await p.locator('.film .film-kaart').count()).toBeGreaterThan(0);
      else if (soorten[i] === 'assistent') expect(((await p.locator('.film .film-ass .zegt').textContent()) ?? '').trim()).not.toBe('');
      else if (soorten[i] === 'slot') expect(await p.locator('.film [data-film-thuis]').isVisible()).toBe(true);
      else if (soorten[i] !== 'opkomst') expect(((await p.locator('.film .film-woord .groot').textContent()) ?? '').trim()).not.toBe('');
      await shot(`film-${i}`);
    }
    // Nog een keer: terug naar het begin.
    await p.locator('.film [data-film-opnieuw]').click();
    await p.waitForTimeout(300);
    expect(await p.locator('.film [data-film-slot]').isVisible()).toBe(false);
    await p.evaluate('window.__film.stop(); window.__film = null');
    // De muziek bouwt op: stil begin, voller in de opbouw, het hardst in de drop, en hij kraakt nergens.
    const luid = await p.evaluate<{ intro: number; opbouw: number; drop: number; slot: number; piek: number }>(`(async () => {
      // Zoals de trailer met alle shots: de drop op het getal van de maand.
      const plan = { intro: 4, drop: 12, slot: 14, eind: 18 };
      const buf = await film.opname(plan);
      const kan = buf.getChannelData(0);
      const rms = (vanMaat, totMaat) => {
        const a = Math.floor(vanMaat * film.MAAT * buf.sampleRate), b = Math.floor(totMaat * film.MAAT * buf.sampleRate);
        let s = 0;
        for (let i = a; i < b; i++) s += kan[i] * kan[i];
        return Math.sqrt(s / (b - a));
      };
      let piek = 0;
      for (let i = 0; i < kan.length; i++) piek = Math.max(piek, Math.abs(kan[i]));
      return { intro: rms(0, 4), opbouw: rms(4, 11), drop: rms(12, 14), slot: rms(14, 17), piek };
    })()`);
    expect(luid.intro).toBeGreaterThan(0.005);
    expect(luid.opbouw).toBeGreaterThan(luid.intro);
    expect(luid.drop).toBeGreaterThan(luid.opbouw);
    expect(luid.piek).toBeLessThan(0.96);
    console.log('muziek', JSON.stringify(luid));
    expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
    // Op de telefoon: alles onder elkaar, binnen het scherm.
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(`${baseUrl}/inrichten.html#warmte`);
    await p.locator('#tel [data-kaart] h1', { hasText: 'Wat verwarmt en koelt er?' }).waitFor();
    expect(await p.evaluate<boolean>('document.documentElement.scrollWidth <= innerWidth + 1')).toBe(true);
    await shot('telefoon');
    expect(fouten).toEqual([]);
    await context.close();
  }, 40_000);

  /*
   * De assistent gaat aan bij Klaar (besluit 202): geen knop bij Klaarzetten,
   * Home Assistant herstart terwijl de film speelt, en de rondleiding wacht tot
   * hij terug is. De add-on is hier nagebootst met een route.
   */
  it('zet de assistent aan terwijl de film speelt, en wacht dan op Home Assistant (besluit 202)', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const shot = async (naam: string) => {
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', `-${naam}.png`) });
    };
    const rust = { bezig: false, stap: null as string | null, klaar: [] as string[], fout: null, herstartMs: null as number | null };
    let stand = { kan: true, staat: 'nee', versie: null as string | null, nieuw: VERSIE, geladen: null as string | null, toegevoegd: null as boolean | null, aanzetten: rust };
    let aangezet = 0;
    let vragenNa = 0;
    await context.route(`${baseUrl}/api/integratie`, async (route) => {
      if (route.request().method() === 'POST') {
        aangezet += 1;
        stand = { ...stand, staat: 'add-on', versie: VERSIE, aanzetten: { bezig: true, stap: 'herstarten', klaar: ['neerzetten'], fout: null, herstartMs: Date.now() } };
      } else if (stand.aanzetten.bezig && ++vragenNa >= 2) {
        // Na twee keer vragen is Home Assistant terug en is SunArc toegevoegd.
        stand = { ...stand, geladen: VERSIE, toegevoegd: true, aanzetten: { ...rust, klaar: ['neerzetten', 'herstarten', 'toevoegen'] } };
      }
      await route.fulfill({ status: route.request().method() === 'POST' ? 202 : 200, contentType: 'application/json', body: JSON.stringify(stand) });
    });
    try {
      // Klaarzetten: geen knop, wel wat er gaat gebeuren.
      await p.goto(`${baseUrl}/inrichten.html#ha`);
      const kaart = p.locator('#wand [data-kaart]');
      await kaart.locator('.asblok', { hasText: 'Gaat vanzelf aan bij Klaar' }).waitFor({ timeout: 10_000 });
      expect(await kaart.locator('[data-assistent-aan]').count()).toBe(0);
      await shot('klaarzetten');
      // Klaar (na Hoe praat je huis): Speel af zet hem aan zodra de film zijn cijfers heeft.
      await kaart.locator('[data-volgende]').click();
      await kaart.locator('h1', { hasText: 'Hoe praat je huis?' }).waitFor();
      await kaart.locator('[data-volgende]').click();
      await kaart.locator('h1', { hasText: 'Je huis staat erin' }).waitFor();
      await kaart.locator('button', { hasText: 'Speel af' }).click();
      const film = p.locator('.film');
      await film.locator('[data-film-huis] svg.sc-huis').waitFor({ timeout: 10_000 });
      await expect.poll(() => aangezet).toBe(1);
      // Na de film (hier overgeslagen) wacht de rondleiding met de voortgang in beeld.
      await film.locator('[data-film-klaar]').click();
      const wacht = p.locator('.aswacht');
      await wacht.locator('p', { hasText: 'Daarna begint de rondleiding.' }).waitFor();
      expect(await wacht.textContent()).toContain('Home Assistant herstart');
      await shot('wacht');
      await p.waitForURL(/thuis\.html#rondleiding$/, { timeout: 15_000 });
      expect(aangezet).toBe(1);
      expect(fouten).toEqual([]);
    } finally {
      await context.close();
    }
  }, 40_000);

  /*
   * Helemaal in huis (besluit 203): per add-on of hij erin staat, en de
   * spraakassistent maken met één tik. De add-on is nagebootst met een route.
   */
  /*
   * Te doen (besluit 216, schetsen Wand-Te-doen en Tel-Te-doen): de kaart op
   * Thuis, het blad na een tik, en het moment als een herinnering speelt. De
   * dienst is nagebootst met een route.
   */
  it('toont Te doen: de kaart op Thuis, de eigen tab, en het moment op de wand (besluit 216 en 217)', async () => {
    // De browser in UTC, net als de dagen hieronder: na middernacht in Amsterdam was "morgen" anders vandaag.
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'nl-NL', timezoneId: 'UTC' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    p.on('dialog', (d) => {
      fouten.push(`melding: ${d.message()}`);
      void d.dismiss();
    });
    const shot = async (naam: string) => {
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', `-${naam}.png`) });
    };
    // Een vaste klok, midden op de dag: herinneringen en wat het huis later doet, vallen dan vandaag.
    const nu = Date.UTC(2026, 10, 5, 12, 0);
    await p.clock.setFixedTime(new Date(nu));
    const dag = (n: number) => {
      const d = new Date(nu);
      d.setUTCHours(0, 0, 0, 0);
      return d.getTime() + n * 86_400_000;
    };
    const herinnering = { id: 'h1', tekst: 'Container buiten zetten', ms: nu + 20 * 60_000, voor: null, naam: null, status: 'wacht', gemaakt: nu, eigen: false };
    let speelt: unknown[] = [];
    let leeg = false;
    const gestuurd: unknown[] = [];
    await context.route(`${baseUrl}/api/te-doen**`, async (route) => {
      if (route.request().method() === 'POST') {
        gestuurd.push(route.request().postDataJSON());
        return route.fulfill({ json: { ok: true } });
      }
      if (route.request().url().includes('alleen=nu')) return route.fulfill({ json: { speelt } });
      if (leeg) return route.fulfill({ json: { aan: true, herinneringen: [], lijsten: [], afspraken: [], speelt: [] } });
      return route.fulfill({
        json: {
          aan: true,
          bewoner: false,
          herinneringen: [herinnering],
          // Wat het huis later doet (besluit 218).
          gepland: [{ id: 'g1', tekst: 'Doe de screens dicht', ms: nu + 3 * 3_600_000, voor: null, naam: null, status: 'wacht', gemaakt: nu, opdracht: { stappen: [], zon: 'onder' } }],
          lijsten: [
            { soort: 'boodschappen', id: 'todo.shopping_list', naam: 'Boodschappenlijst', items: [{ uid: '1', tekst: 'Melk', klaar: false }, { uid: '2', tekst: 'Brood', klaar: false }, { uid: '3', tekst: 'Eieren', klaar: false }, { uid: '4', tekst: 'Koffiebonen', klaar: false }, { uid: '5', tekst: 'Bananen', klaar: true }] },
            { soort: 'todo', id: 'todo.to_do', naam: 'To-do', items: [{ uid: '6', tekst: 'Dakgoot', klaar: false }] },
          ],
          afspraken: [
            { startMs: dag(1), heleDag: true, tekst: 'GFT', bron: 'afval', agenda: 'calendar.afval', afval: 'gft' },
            { startMs: dag(3) + 16.75 * 3_600_000, heleDag: false, tekst: 'Zwemles', bron: 'gezin', agenda: 'calendar.gezin' },
            { startMs: dag(8), heleDag: true, tekst: 'PMD', bron: 'afval', agenda: 'calendar.afval', afval: 'pmd' },
          ],
          speelt,
          agendas: { 'calendar.afval': 'Afvalbeheer', 'calendar.gezin': 'Gezin' },
        },
      });
    });
    try {
      await p.goto(`${baseUrl}/thuis.html`);
      const kaart = p.locator('#wand [data-tedoen]');
      await kaart.waitFor({ state: 'visible', timeout: 10_000 });
      expect(await kaart.locator('.td-rij').count()).toBe(3);
      expect(await kaart.textContent()).toContain('Morgen GFT');
      expect(await kaart.textContent()).toContain('melk, brood, eieren en nog 1');
      await shot('tedoen-kaart');
      // De kaart opent de tab (besluit 217): herinneringen, de agenda van twee weken, en beide lijsten.
      await kaart.click();
      await p.waitForURL(/tedoen\.html$/);
      const tab = p.locator('#wand [data-td-pagina]');
      await tab.locator('.td-item').first().waitFor({ timeout: 10_000 });
      expect(await p.locator('#balk [data-tab="tedoen"][aria-current="page"]').count()).toBe(1);
      expect(await tab.locator('.td-her').count()).toBe(1);
      // Vandaag, morgen (GFT), de zwemles en de PMD over acht dagen.
      expect(await tab.locator('.tdp-dag').count()).toBe(4);
      // De agenda's ingeklapt tot één regel (besluit 245), en open met hun kleur.
      expect(await tab.locator('.tdp-bronnen').count()).toBe(0);
      await tab.locator('[data-td-agendas]').click();
      expect(await tab.locator('.tdp-bronnen').textContent()).toContain('Gezin');
      expect(await tab.locator('.tdp-dag', { hasText: 'PMD' }).count()).toBe(1);
      // Drie kolommen (besluit 245): de lijsten als tabbladen onder de herinneringen.
      expect(await tab.locator('.tdp-drie > section').count()).toBe(3);
      expect(await tab.locator('.tdp-lijst').count()).toBe(1);
      expect(await tab.locator('.tdp-tabs [data-td-lijsttab]').count()).toBe(2);
      // Een scherm aan de wand heeft geen eigen agenda's (besluit 218): geen knop ernaartoe.
      expect(await tab.locator('a[href="jij.html#agenda"]').count()).toBe(0);
      // Vast en gepland als eigen kolom (besluit 244): de boog, de taak met zijn tijd, en alles naar de eigen pagina.
      expect(await tab.locator('.td-vast .td-taak').count()).toBe(1);
      expect(await tab.locator('.td-vast .td-taak').textContent()).toMatch(/^\d\d:\d\dDoe de screens dicht/);
      expect(await tab.locator('.td-vast .td-boog svg').count()).toBe(1);
      expect(await tab.locator('.td-gepland').getAttribute('href')).toBe('gepland.html');
      // + Nieuw: een herinnering of een taak, of zeg het.
      await tab.locator('[data-td-keuzeknop]').click();
      expect(await tab.locator('.td-keuze [data-td-keuze]').count()).toBe(2);
      expect(await tab.locator('.td-keuze [data-td-zeg] input').count()).toBe(1);
      await shot('tedoen-nieuw');
      await tab.locator('[data-td-keuze="herinnering"]').click();
      expect(await tab.locator('.td-keuze').count()).toBe(0);
      expect(await p.evaluate<boolean>("document.activeElement?.closest('form')?.hasAttribute('data-td-nieuw') === true")).toBe(true);
      await p.waitForTimeout(500);
      await shot('tedoen-tab');
      // Afvinken op uid: een naam kan vaker op de lijst staan.
      await tab.locator('.td-item', { hasText: 'Melk' }).click();
      await expect.poll(() => gestuurd.length).toBe(1);
      expect(gestuurd[0]).toEqual({ actie: 'klaar', lijst: 'boodschappen', item: 'Melk', uid: '1' });
      await tab.locator('[data-td-lijsttab="todo"]').click();
      await tab.locator('[data-td-erbij][data-td-lijst="todo"] input').fill('Kaas');
      await tab.locator('[data-td-erbij][data-td-lijst="todo"] input').press('Enter');
      await expect.poll(() => gestuurd.length).toBe(2);
      expect(gestuurd[1]).toEqual({ actie: 'toevoegen', lijst: 'todo', item: 'Kaas' });
      // Een geplande opdracht weghalen gaat via Aanpassen op Vast en gepland (besluit 234).
      // De afgevinkte weghalen: eerst vraagt de knop het, de tweede tik doet het.
      await tab.locator('[data-td-lijsttab="boodschappen"]').click();
      await tab.locator('[data-td-opruim="boodschappen"]').click();
      await expect.poll(() => tab.locator('[data-td-opruim="boodschappen"]').textContent()).toBe('Zeker? 1 weg');
      expect(gestuurd).toHaveLength(2);
      await tab.locator('[data-td-opruim="boodschappen"]').click();
      await expect.poll(() => gestuurd.length).toBe(3);
      expect(gestuurd[2]).toEqual({ actie: 'opruimen', lijst: 'boodschappen' });
      await p.goto(`${baseUrl}/thuis.html`);
      await kaart.waitFor({ state: 'visible', timeout: 10_000 });
      // Het moment: de herinnering speelt, de wand toont hem met Gedaan.
      speelt = [{ ...herinnering, status: 'nu', ms: nu }];
      await p.evaluate('window.tedoen.kijk()');
      const moment = p.locator('.td-moment');
      await moment.waitFor({ timeout: 10_000 });
      expect(await moment.locator('h2').textContent()).toBe('Container buiten zetten');
      await shot('tedoen-moment');
      await moment.locator('[data-td-gedaan]').click();
      await expect.poll(() => gestuurd.at(-1)).toEqual({ actie: 'gedaan', id: 'h1' });
      await expect.poll(() => p.locator('.td-moment').count()).toBe(0);
      // Niets te doen: de kaart blijft staan, zodat je bij je lijsten kunt (30 oktober 2026).
      leeg = true;
      await p.evaluate('window.tedoen.laad()');
      await expect.poll(() => kaart.locator('.td-rij').count()).toBe(1);
      expect(await kaart.isVisible()).toBe(true);
      expect(await kaart.textContent()).toContain('Niets te doen');
      // Instellingen › Assistent › Te doen (besluit 217): keuzelijsten; het oude adres gaat er vanzelf heen.
      await context.route(`${baseUrl}/api/functies`, async (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        const echt = (await (await route.fetch()).json()) as { gevonden: Record<string, unknown> };
        echt.gevonden['lijsten'] = [{ id: 'todo.shopping_list', naam: 'Boodschappenlijst' }, { id: 'todo.to_do', naam: 'To-do' }];
        echt.gevonden['agendas'] = ['Afvalbeheer Dar', 'Agenda', 'F1 - Race Season calendar', 'Feestdagen in nederland', 'Formula 1', 'Gezin', 'Parro agenda', 'Ric060589@gmail.com', 'Verjaardagen', 'Werkplek'].map((naam, i) => ({ id: `calendar.a${i}`, naam }));
        await route.fulfill({ json: echt });
      });
      await p.goto(`${baseUrl}/functies.html#tedoen`);
      await p.waitForURL(/functies\.html\?groep=assistent#tedoen$/);
      await p.locator('#wand [data-tedoen-keus]').first().waitFor({ timeout: 10_000 });
      expect(await p.locator('#wand h1').first().textContent()).toBe('Assistent');
      expect(await p.locator('#wand [data-delen] .deel').count()).toBe(3);
      expect(await p.locator('#wand [data-tedoen-keus]').count()).toBe(4);
      expect(await p.locator('#wand [data-vorm] a[href="jij.html#agenda"]').count()).toBe(1);
      await shot('tedoen-functies');
      // De telefoon: zes tabs, alleen iconen, de gekozen tab met zijn naam.
      await p.setViewportSize({ width: 390, height: 844 });
      await p.goto(`${baseUrl}/tedoen.html`);
      await p.locator('#tel .tabs a').first().waitFor({ timeout: 10_000 });
      expect(await p.locator('#tel .tabs a').count()).toBe(6);
      expect(await p.locator('#tel .tabs a span:visible').count()).toBe(1);
      expect(await p.locator('#tel .tabs a[aria-current="page"]').textContent()).toBe('Te doen');
      expect(await p.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
      await shot('tedoen-tel');
      expect(fouten).toEqual([]);
    } finally {
      await context.close();
    }
  }, 40_000);

  it('maakt de spraakassistent helemaal in huis, met de add-ons op een rij (besluit 203)', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const shot = async (naam: string) => {
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', `-${naam}.png`) });
    };
    const addons = (w: string, pi: string, o: string) => [
      { id: 'whisper', slug: 'core_whisper', staat: w },
      { id: 'piper', slug: 'core_piper', staat: pi },
      { id: 'openwakeword', slug: 'core_openwakeword', staat: o },
    ];
    let stand: Record<string, unknown> = { addons: addons('gevonden', 'aan', 'nee'), assistent: null, bezig: false, fout: null };
    let gemaakt = 0;
    let vragenNa = 0;
    await context.route(`${baseUrl}/api/stem-in-huis`, async (route) => {
      if (route.request().method() === 'POST') {
        gemaakt += 1;
        stand = { ...stand, bezig: true };
      } else if (stand['bezig'] && ++vragenNa >= 2) {
        stand = { addons: addons('aan', 'aan', 'nee'), assistent: { id: 'p1', wekwoord: null }, bezig: false, fout: null };
      }
      await route.fulfill({ status: route.request().method() === 'POST' ? 202 : 200, contentType: 'application/json', body: JSON.stringify(stand) });
    });
    try {
      await p.goto(`${baseUrl}/inrichten.html#stem`);
      const kaart = p.locator('#wand [data-kaart]');
      const huis = kaart.locator('.stemkeuze', { hasText: 'Helemaal in huis' });
      // De add-ons staan onder de keuze, als die gekozen is.
      await huis.locator('[data-stembron="huis"]').click();
      await huis.locator('.addon', { hasText: 'Whisper' }).waitFor({ timeout: 10_000 });
      expect(await huis.locator('.addon', { hasText: 'Whisper' }).textContent()).toContain('Gevonden');
      expect(await huis.locator('.addon', { hasText: 'Piper' }).textContent()).toContain('Staat erin');
      // Buiten Home Assistant geen knop naar de add-on, wel waar het moet.
      expect(await huis.locator('.addon', { hasText: 'openWakeWord' }).textContent()).toContain('Installeer in Home Assistant');
      await shot('inhuis');
      await huis.locator('[data-inhuis-maak]').click();
      await huis.locator('.mini.klaar', { hasText: 'nog zonder "Hé huis"' }).waitFor({ timeout: 15_000 });
      expect(gemaakt).toBe(1);
      expect(await p.evaluate<boolean>('document.scrollingElement.scrollHeight <= innerHeight + 1')).toBe(true);
      await shot('inhuis-klaar');
      // Functies › Stem en luisteren (besluit 212): links de stem, ernaast het luisteren; geen spraakassistenten meer.
      await p.goto(`${baseUrl}/functies.html#stem`);
      await p.locator('#wand [data-vorm] [data-stem-kies]').first().waitFor({ timeout: 10_000 });
      expect(await p.locator('#wand [data-vorm] [data-stem-kies="apparaat"]').count()).toBe(1);
      expect(await p.locator('#wand [data-vorm] .stemrechts [data-hier]').count()).toBe(2);
      expect(await p.locator('#wand [data-kies="spraak"]').count()).toBe(0);
      expect(await p.locator('#wand [data-kies="stemBron"]').count()).toBe(0);
      await shot('stem');
      // Zoals in een huis met Google Cloud en Piper: zes stemmen van Google en de stemmen in huis, en het past.
      const hd = (naam: string, geslacht: string) => ({ id: `tts.google_cloud|nl-NL-Chirp3-HD-${naam}`, naam, geslacht, soort: 'hd', kenmerk: { nl: 'helder', en: 'clear' } });
      await context.route(`${baseUrl}/api/stemmen**`, (route) =>
        route.fulfill({
          json: {
            gekozen: 'tts.google_cloud|nl-NL-Chirp3-HD-Kore',
            nu: 'tts.google_cloud',
            voorbeeld: { nl: 'Hallo, ik ben je huis.', en: 'Hello, I am your house.' },
            opties: [
              ...['Kore', 'Aoede', 'Leda', 'Zephyr', 'Sulafat', 'Achernar'].map((n) => hd(n, 'vrouw')),
              ...['Charon', 'Puck', 'Orus'].map((n) => hd(n, 'man')),
              { id: 'tts.piper|nl_BE-nathalie-medium', naam: 'Nathalie', geslacht: 'vrouw', soort: 'huis', kenmerk: { nl: 'Vlaams', en: 'Flemish' } },
              { id: 'apparaat', naam: 'Dit apparaat', geslacht: null, soort: 'apparaat', kenmerk: { nl: 'werkt overal', en: 'works everywhere' } },
            ],
          },
        }),
      );
      await p.reload();
      await p.locator('#wand [data-stem-kies="tts.google_cloud|nl-NL-Chirp3-HD-Kore"][aria-pressed="true"]').waitFor({ timeout: 10_000 });
      expect(await p.locator('#wand [data-vorm] [data-stem-kies]').count()).toBe(8);
      await p.locator('#wand [data-kies="stemGeslacht"]', { hasText: 'Man' }).click();
      await expect.poll(() => p.locator('#wand [data-vorm] [data-stem-kies]').count()).toBe(4);
      await p.locator('#wand [data-kies="stemGeslacht"]', { hasText: 'Vrouw' }).click();
      await shot('stem-hd');
      await context.unroute(`${baseUrl}/api/stemmen**`);
      // Praten met je huis (besluit 213, schets Wand-Instellingen-Praten): het brein links, bedienen rechts, en het past.
      await context.route(`${baseUrl}/api/functies`, async (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        const echt = (await (await route.fetch()).json()) as { gevonden: Record<string, unknown>; voorstel: { praten?: Record<string, unknown> }; instellingen?: { praten?: Record<string, unknown> } | null };
        echt.gevonden['taalmodellen'] = [{ id: 'ai_task.google_ai_task', naam: 'Google AI Task' }, { id: 'ai_task.openai_ai_task', naam: 'OpenAI AI Task' }];
        echt.gevonden['klimaatBrug'] = true;
        const praten = { ...(echt.instellingen?.praten ?? echt.voorstel.praten ?? {}), taalmodel: 'ai_task.google_ai_task', bedienen: true, klimaat: true };
        if (echt.instellingen) echt.instellingen.praten = praten;
        else echt.voorstel.praten = praten;
        await route.fulfill({ json: echt });
      });
      await context.route(`${baseUrl}/api/praten/teller`, (route) =>
        route.fulfill({
          json: {
            vandaag: '2026-10-30',
            wachtMs: 5000,
            eigenWoorden: false,
            dagen: [
              { dag: '2026-10-30', vragen: 14, fouten: 1, gemiddeldMs: 7800, langsteMs: 12_400 },
              { dag: '2026-10-29', vragen: 31, fouten: 2, gemiddeldMs: 12_100, langsteMs: 56_700 },
              { dag: '2026-10-27', vragen: 6, fouten: 0, gemiddeldMs: 2100, langsteMs: 3100 },
            ],
          },
        }),
      );
      // Alleen een andere hash laadt niet opnieuw: herladen, met de nagebootste gegevens.
      await p.goto(`${baseUrl}/functies.html#praten`);
      await p.reload();
      await p.locator('#wand [data-vorm] .breingetal').first().waitFor({ timeout: 10_000 });
      expect(await p.locator('#wand [data-vorm] .breinkaart').count()).toBe(3);
      expect(await p.locator('#wand [data-vorm] .breinkaart[aria-pressed="true"]').textContent()).toContain('Gemini');
      expect(await p.locator('#wand [data-vorm] .breinpil').textContent()).toBe('Te traag');
      expect(await p.locator('#wand [data-vorm] .breinweek .staaf').count()).toBe(7);
      expect(await p.locator('#wand [data-vorm] [data-kies="pratenKlimaat"][role="switch"]').getAttribute('aria-checked')).toBe('true');
      await shot('praten');
      const pratenRuimte = await p.locator('#wand [data-vorm]').evaluate((v) => v.scrollHeight - v.clientHeight);
      expect(pratenRuimte).toBeLessThanOrEqual(2);
      // Een schakelaar zet het uit, en het blijft zo na tekenen.
      await p.locator('#wand [data-vorm] [data-kies="pratenKlimaat"]').click();
      await expect.poll(() => p.locator('#wand [data-vorm] [data-kies="pratenKlimaat"]').getAttribute('aria-checked')).toBe('false');
      await context.unroute(`${baseUrl}/api/functies`);
      await context.unroute(`${baseUrl}/api/praten/teller`);
      // Het past, met ruimte over: lettertypes tekenen in de CI iets anders (28 oktober 2026, 8 pixels).
      const ruimte = await p.locator('#wand [data-vorm]').evaluate((v) => {
        const proef = v.ownerDocument.createElement('div');
        proef.style.cssText = 'height: 20px; flex: none';
        v.append(proef);
        const over = v.scrollHeight - v.clientHeight;
        proef.remove();
        return over;
      });
      expect(ruimte).toBeLessThanOrEqual(2);
      await p.goto(`${baseUrl}/inrichten.html#stem`);
      // Terug naar de standaard, voor de tests hierna.
      await kaart.locator('[data-stembron="apparaat"]').click();
      await expect.poll(() => kaart.locator('[data-stembron="apparaat"]').getAttribute('aria-pressed')).toBe('true');
      expect(fouten).toEqual([]);
    } finally {
      await context.close();
    }
  }, 40_000);

  it('toont het sluipverbruik onder Opbrengst (besluit 192)', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    // De ingang op Opbrengst, met vannacht erop; de rest van Opbrengst blijft hetzelfde.
    await p.goto(`${baseUrl}/opbrengst.html`);
    const ingang = p.locator('#wand .sluipingang');
    await ingang.waitFor({ timeout: 10_000 });
    expect(await ingang.textContent()).toMatch(/Sluipverbruik[\s\S]*W/);
    await ingang.click();
    await p.waitForURL(/sluipverbruik\.html$/);
    const wand = p.locator('#wand');
    await wand.locator('h1', { hasText: 'gebruikt je huis' }).waitFor({ timeout: 10_000 });
    // Dertig nachten als staafjes, en de hoge in oranje; hoeveel hangt af van hoe laat het is (de nacht van vandaag telt pas na 05:00).
    const sluip = (await (await fetch(`${baseUrl}/api/sluipverbruik`)).json()) as { nachten: { hoog: boolean }[] };
    expect(await wand.locator('[data-midden] svg rect:not(.raak)').count()).toBe(30);
    expect(await wand.locator('[data-midden] svg rect[fill="#ff7a4d"]').count()).toBe(sluip.nachten.slice(-30).filter((n) => n.hoog).length);
    expect(sluip.nachten.slice(-30).filter((n) => n.hoog).length).toBeGreaterThanOrEqual(4);
    // Een staaf aantikken (29 oktober 2026): onderaan die nacht, met hoeveel boven of onder je gewone nacht; nog eens tikken haalt het weg.
    const staaf = wand.locator('[data-midden] [data-staaf]').last();
    await staaf.click();
    await wand.locator('.onderregel .staafinfo', { hasText: /W.*je gewone nacht/ }).waitFor({ timeout: 5000 });
    expect(await wand.locator('[data-midden] [data-staaf][aria-pressed="true"]').count()).toBe(1);
    await wand.locator('[data-midden] [data-staaf]').last().click();
    await wand.locator('.onderregel .staafinfo').waitFor({ state: 'detached', timeout: 5000 });
    await wand.locator('.opgevallen', { hasText: 'Opgevallen' }).waitFor();
    // Wat de bewoner zegt (besluit 88): het weet het niet, en de app houdt het in de gaten.
    await wand.locator('[data-weet-niet]').click();
    await wand.locator('.opgevallen', { hasText: 'in de gaten' }).waitFor({ timeout: 5000 });
    // Per maand.
    await wand.locator('[data-blik="maanden"]').click();
    await wand.locator('h2', { hasText: 'Per maand' }).waitFor();
    expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
    // Op de telefoon: onder elkaar, binnen het scherm.
    await p.setViewportSize({ width: 390, height: 844 });
    await p.reload();
    await p.locator('#tel h1', { hasText: 'gebruikt je huis' }).waitFor({ timeout: 10_000 });
    expect(await p.evaluate<boolean>('document.documentElement.scrollWidth <= innerWidth + 1')).toBe(true);
    // Een nacht boven de 1.000 W (28 oktober 2026): het hele getal op de as, ook de eerste cijfer.
    await context.route(`${baseUrl}/api/sluipverbruik`, async (route) => {
      const r = await route.fetch();
      const j = (await r.json()) as { nachten: { w: number; hoog: boolean }[] };
      j.nachten[j.nachten.length - 1]!.w = 1250;
      j.nachten[j.nachten.length - 1]!.hoog = true;
      await route.fulfill({ response: r, json: j });
    });
    await p.reload();
    const as = p.locator('#tel svg text[text-anchor="end"]', { hasText: '1.200' });
    await as.first().waitFor({ timeout: 10_000 });
    expect(await as.first().evaluate((x) => (x as unknown as { getBBox(): { x: number } }).getBBox().x)).toBeGreaterThanOrEqual(0);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-sluip-tel.png') });
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  it('laat Daken en panelen op de telefoon de tekening vrij: de kaart eronder, het vraagteken rechts (5 november 2026)', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => {
      localStorage.setItem('sc-rondleiding-gezien', '1');
      localStorage.setItem('sc-rond-daken-gezien', '1');
    });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/energie.html#panelen`);
    const tel = p.locator('#tel');
    const boven = tel.locator('svg.dk-boven');
    await boven.waitFor({ timeout: 10_000 });
    // Het vraagteken rechts in de kop.
    const kop = await tel.locator('.pan-kop').boundingBox();
    const vraag = await tel.locator('[data-dak-uitleg]').boundingBox();
    expect(kop!.x + kop!.width - (vraag!.x + vraag!.width)).toBeLessThan(4);
    // De kaart: de melding als blad, daarna de balk onder de tekening, niet erover.
    await tel.locator('[data-dak-kaart]').click();
    await p.locator('.kk-venster [data-kk-kaart]').click();
    await tel.locator('[data-dak-bron="bag3d"]').click();
    const balk = tel.locator('.kk-balk');
    await balk.waitFor({ timeout: 5_000 });
    const b = await boven.boundingBox();
    expect((await balk.boundingBox())!.y).toBeGreaterThanOrEqual(b!.y + b!.height - 1);
    expect(b!.height).toBeGreaterThan(200);
    expect(await p.evaluate<boolean>('document.documentElement.scrollWidth <= innerWidth + 1')).toBe(true);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-daken-tel.png'), fullPage: true });
    // En weer zonder kaart, zoals het was.
    await tel.locator('[data-dak-zonderkaart]').click();
    await p.locator('.kk-venster [data-kk-zonder]').click();
    await tel.locator('[data-dak-kaart]').waitFor({ timeout: 5_000 });
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  it('toont bij Opbrengst Nu: het huis van dit moment, live (5 november 2026)', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    // De stromen van nu vast: 2,4 kW zon, 0,8 kW terug, het huis 1,6 kW; daarna 3,0 kW zon.
    let zonKw = 2.4;
    await context.route(`${baseUrl}/api/state`, async (route) => {
      const r = await route.fetch();
      const j = (await r.json()) as { bewoner?: { stromen?: unknown } };
      if (j.bewoner) j.bewoner.stromen = { zonKw, netKw: 1.6 - zonKw, verbruikKw: 1.6, aircoKw: 0, huisKw: 1.6, geplandKw: 0 };
      await route.fulfill({ response: r, json: j });
    });
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/opbrengst.html`);
    const wand = p.locator('#wand');
    await wand.locator('[data-soort="nu"]').click();
    await wand.locator('.livelabel').waitFor({ timeout: 10_000 });
    await wand.locator('h1', { hasText: 'Nu 2,4 kW van je eigen dak' }).waitFor({ timeout: 10_000 });
    // Het stroombeeld van nu: terug naar het net, en Nu aan rechts.
    await wand.locator('[data-sankey] svg text', { hasText: 'Naar het net' }).waitFor();
    expect(await wand.locator('[data-sankey]').textContent()).toContain('0,80 kW');
    await wand.locator('[data-apparaten] h2', { hasText: 'Nu aan' }).waitFor();
    expect(await wand.locator('[data-perdag]').isHidden()).toBe(true);
    expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-opbrengst-nu.png') });
    // Live: binnen een paar tellen het nieuwe getal, zonder iets te doen.
    zonKw = 3;
    await wand.locator('h1', { hasText: 'Nu 3,0 kW van je eigen dak' }).waitFor({ timeout: 10_000 });
    // Terug naar een maand: dan weer de periode, en geen live meer.
    await wand.locator('[data-soort="maand"]').click();
    await wand.locator('.livelabel').waitFor({ state: 'detached', timeout: 10_000 });
    expect(await wand.locator('[data-perdag]').isHidden()).toBe(false);
    // Op de telefoon: dezelfde delen onder elkaar, binnen de breedte.
    await p.setViewportSize({ width: 390, height: 844 });
    await p.reload();
    await p.locator('#tel [data-soort="nu"]').click();
    await p.locator('#tel .livelabel').waitFor({ timeout: 10_000 });
    await p.locator('#tel [data-telinhoud] h2', { hasText: 'Waar je stroom nu heen gaat' }).waitFor();
    expect(await p.evaluate<boolean>('document.documentElement.scrollWidth <= innerWidth + 1')).toBe(true);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-opbrengst-nu-tel.png'), fullPage: true });
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * De thuisaccu in Opbrengst (besluit 272): wat hij laadde en leverde onder de
   * panelen, en in het stroombeeld uit en naar de accu. De som zelf staat in
   * yield.test.ts; hier hoe de pagina hem toont.
   */
  it('toont bij Opbrengst wat de thuisaccu laadde en leverde', async () => {
    if (energyStore.current == null) await energyStore.save(importFromPrefs(await ENERGY_SOURCE.prefs(), await ENERGY_SOURCE.meters()));
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    await context.route((url) => url.pathname === '/api/opbrengst', async (route) => {
      const r = await route.fetch();
      const j = (await r.json()) as { stromen?: { van: string; naar: string; kwh: number }[]; accu?: unknown };
      if (j.stromen) {
        j.accu = { geladenKwh: 31, geleverdKwh: 27.5, uitZonKwh: 29, uitNetKwh: 2, bron: 'dashboard' };
        j.stromen = [...j.stromen, { van: 'accu', naar: 'rest', kwh: 27.5 }, { van: 'zon', naar: 'naarAccu', kwh: 29 }, { van: 'net', naar: 'naarAccu', kwh: 2 }];
      }
      await route.fulfill({ response: r, json: j });
    });
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/opbrengst.html`);
    const wand = p.locator('#wand');
    await wand.locator('.accuregel').waitFor({ timeout: 10_000 });
    expect(await wand.locator('.accuregel').textContent()).toBe('De accu laadde 31,0 kWh, waarvan 29,0 kWh uit de zon, en leverde 27,5 kWh aan het huis.');
    await wand.locator('[data-sankey] svg text', { hasText: 'Uit de accu' }).waitFor();
    await wand.locator('[data-sankey] svg text', { hasText: 'Naar de accu' }).waitFor();
    expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-opbrengst-accu.png') });
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  it('toont zonder verbinding de laatste stand, grijs', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    await p.goto(`${baseUrl}/thuis.html`);
    await p.locator('#wand svg.sc-huis').first().waitFor();
    // Echt geen verbinding meer: anders haalt een vraag die nog onderweg was de balk weer weg.
    await context.route((url) => url.pathname.startsWith('/api/'), (route) => route.abort());
    // Zetten en kijken in één keer: de live-stroom van vóór het afsluiten kan
    // nog een bericht brengen dat de pagina weer online maakt (17 oktober 2026).
    await expect.poll(() => p.evaluate<string>(`(() => {
      app.offline(Date.now());
      const balk = document.querySelector('.geenverbinding');
      if (!balk || !balk.textContent.includes('De regeling loopt gewoon door') || !balk.getClientRects().length) return 'geen balk';
      return getComputedStyle(document.querySelector('#wand main')).pointerEvents;
    })()`), { timeout: 20_000 }).toBe('none');
    await p.evaluate('app.online()');
    expect(await p.locator('.geenverbinding').count()).toBe(0);
    await context.close();
  }, 40_000);

  /*
   * Thuis in ontwerp 2 (besluit 104): het huis uit de tekenmotor van de schets,
   * met de gegevens van de dienst. De wand past altijd op het scherm, zonder
   * scrollen; de telefoon heeft dezelfde inhoud onder elkaar.
   */
  for (const [stand, viewport] of [
    ['wand', { width: 1340, height: 800 }],
    ['telefoon', { width: 390, height: 844 }],
  ] as const) {
    it(`toont Thuis van ontwerp 2 op de ${stand}`, async () => {
      const context = await browser.newContext({ viewport, timezoneId: 'UTC', locale: 'nl-NL' });
      await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
      // De rondleiding is al gezien; die heeft hieronder een eigen test.
      await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
      const p = await context.newPage();
      const fouten: string[] = [];
      p.on('pageerror', (e) => fouten.push(e.message));
      await p.goto(`${baseUrl}/thuis.html`);
      const zichtbaar = stand === 'wand' ? '#wand' : '#tel';
      await p.locator(`${zichtbaar} [data-kop]`).filter({ hasNotText: 'Even laden' }).waitFor();
      // Het huis is getekend, met de kamers uit de indeling.
      await p.locator(`${zichtbaar} svg.sc-huis`).waitFor();
      const stateNu = (await (await fetch(`${baseUrl}/api/state`)).json()) as { bewoner: { kop: { titel: string } } };
      expect(await p.locator(`${zichtbaar} [data-kop]`).textContent()).toBe(stateNu.bewoner.kop.titel);
      if (stand === 'wand') {
        expect(await p.locator('#wand .sc-kamer').count()).toBeGreaterThan(0);
        // Ook buiten is aan te tikken: de oprit en de tuin openen hun kamer.
        const tikbaar = await p.locator('#wand .sc-tik').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
        expect(tikbaar).toEqual(expect.arrayContaining(['Oprit', 'Tuin']));
        // Nooit scrollen aan de muur, en de hele wand binnen het scherm.
        expect(await p.evaluate('document.scrollingElement.scrollHeight <= innerHeight && document.scrollingElement.scrollWidth <= innerWidth')).toBe(true);
        const vak = await p.locator('#wand').boundingBox();
        expect(vak && vak.x >= -1 && vak.y >= -1 && vak.x + vak.width <= viewport.width + 1 && vak.y + vak.height <= viewport.height + 1).toBe(true);
      } else {
        expect(await p.evaluate('document.scrollingElement.scrollWidth <= innerWidth')).toBe(true);
      }
      // Het weer (besluit 105): de knop met de temperatuur opent de komende dagen.
      const knop = p.locator(`${zichtbaar} [data-buiten]`);
      // Dicht tot erop getikt wordt.
      expect(await p.locator(`${zichtbaar} [data-weer]`).isVisible()).toBe(false);
      await knop.and(p.locator(':enabled')).waitFor({ timeout: 5000 });
      await knop.click();
      const blad = p.locator(`${zichtbaar} [data-weer]`);
      await blad.waitFor({ timeout: 5000 });
      expect(await blad.textContent()).toContain('Morgen');
      expect(await blad.textContent()).toContain('90% regen');
      expect(await blad.locator('.rij').count()).toBe(3);
      await p.keyboard.press('Escape');
      await blad.waitFor({ state: 'hidden', timeout: 5000 });
      // Ook dicht door ernaast te tikken, en door nog eens op de knop te tikken.
      await knop.click();
      await blad.waitFor({ timeout: 5000 });
      await p.locator(`${zichtbaar} [data-kop]`).click({ force: true });
      await blad.waitFor({ state: 'hidden', timeout: 5000 });
      await knop.click();
      await blad.waitFor({ timeout: 5000 });
      // Op de telefoon ligt het donkere vlak over de knop; een tik daar sluit het ook.
      await knop.click({ force: true });
      await blad.waitFor({ state: 'hidden', timeout: 5000 });
      expect(fouten).toEqual([]);
      await context.close();
    }, 20_000);
  }

  /*
   * Thuis op de telefoon, opnieuw (besluit 159, schets Thuis-Tel): de Assistent
   * in een vraagbalk die altijd boven de tabs staat, ook na schuiven; de knoppen
   * bovenin op één regel, met de stand naast de begroeting; de kamers in één
   * kaart; en daaronder Straks, het apparaat, Hoe voelt het en Vandaag. De
   * microfoon in de balk opent de Assistent, die dan meteen luistert.
   */
  it('toont Thuis op de telefoon met de Assistent altijd in beeld', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    // Een microfoon zonder microfoon: alleen bijhouden dat erom gevraagd is.
    await context.addInitScript({
      // Verstaan via de browser (besluit 203) telt ook: dan vraagt de browser zelf om de microfoon.
      content: "window.__micGevraagd = false; if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => { window.__micGevraagd = true; return Promise.reject(new Error('geen microfoon in de test')); }; window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { window.__micGevraagd = true; setTimeout(() => this.onend && this.onend(), 0); } stop() {} abort() {} };",
    });
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/thuis.html`);
    await p.locator('#tel [data-kop]').filter({ hasNotText: 'Even laden' }).waitFor();
    await p.locator('#tel svg.sc-huis').waitFor();

    type Vak = { top: number; bottom: number; left: number; right: number };
    // Waar iets in beeld staat; null als het er niet is of verborgen.
    const vak = (sel: string) =>
      p.evaluate<Vak | null>(`(() => {
        const el = document.querySelector(${JSON.stringify(sel)});
        if (!el || (!el.offsetParent && getComputedStyle(el).position !== 'fixed')) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      })()`);

    // De vraagbalk bij openen in beeld, binnen het scherm en boven de tabs.
    const balk = (await vak('#tel .vraagbalk'))!;
    const tabs = (await vak('#tel .tabs'))!;
    expect(balk.top).toBeGreaterThan(0);
    expect(balk.bottom).toBeLessThanOrEqual(tabs.top);
    expect(balk.left).toBeGreaterThanOrEqual(0);
    expect(balk.right).toBeLessThanOrEqual(390);
    expect(await p.locator('#tel .vraagbalk .typ').getAttribute('href')).toBe('assistent.html#typ');
    expect(await p.locator('#tel .vraagbalk [data-mic]').getAttribute('href')).toBe('assistent.html#praat');

    // Bovenin één regel: de klok en de knoppen; de stand staat bij de begroeting.
    const knoppen = '#tel .kopregel > span:last-child :is(.telknop, .weerknop):visible';
    const regel = await p.locator(knoppen).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(regel.length).toBeGreaterThanOrEqual(3);
    expect(new Set(regel).size).toBe(1);
    // Grote letters op de telefoon: nog steeds één regel, binnen het scherm; de klok wordt kleiner.
    await p.addStyleTag({ content: '#tel .boven { font-size: 26px; } #tel .tijd { font-size: 64px; }' });
    await expect.poll(async () => new Set(await p.locator(knoppen).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))).size).toBe(1);
    await expect.poll(() => p.locator('#tel .kopregel').evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    expect(await p.locator('#tel .kopregel [data-tandwiel]').evaluate((e) => e.getBoundingClientRect().right)).toBeLessThanOrEqual(390);
    expect(await p.locator('#tel .kopregel [data-modus]').count()).toBe(0);
    expect(await p.locator('#tel .groetregel [data-modus]').count()).toBe(1);

    // De kamers in één kaart, een regel per kamer met een temperatuur, elk naar zijn kamer.
    const huis = (await (await fetch(`${baseUrl}/api/huis`)).json()) as { etages: { ruimtes: { id: string; zoneId?: string; temperatuurC?: number | null }[] }[] };
    const metTemperatuur = huis.etages.flatMap((e) => e.ruimtes).filter((r) => r.zoneId && r.temperatuurC != null);
    expect(metTemperatuur.length).toBeGreaterThan(0);
    const kamers = p.locator('#tel [data-kamers] > a');
    expect(await kamers.count()).toBe(metTemperatuur.length);
    expect(await kamers.first().getAttribute('href')).toBe(`kamer.html#${encodeURIComponent(metTemperatuur[0]!.id)}`);

    // Wat nu speelt bovenaan (besluit 226): Straks en het apparaat, dan de kamers, Hoe voelt het, Vandaag.
    const volgorde = ['[data-straks]', '[data-apparaatkaart]', '[data-kaart="kamers"]', '[data-gevoel-kaart]', 'a[href="vandaag.html"]'];
    const tops: number[] = [];
    for (const sel of volgorde) {
      const v = await vak(`#tel .inhoud > ${sel}`);
      if (v) tops.push(v.top);
    }
    expect(tops.length).toBeGreaterThanOrEqual(3);
    expect([...tops].sort((a, b) => a - b)).toEqual(tops);
    await p.locator('#tel [data-gevoel] [data-gevoel-tik]').first().waitFor();
    await p.locator('#tel [data-dag] svg').waitFor();

    // Helemaal naar beneden: de balk blijft staan, en Vandaag komt er helemaal boven.
    await p.evaluate('window.scrollTo(0, document.scrollingElement.scrollHeight)');
    await expect.poll(() => p.evaluate<number>('scrollY')).toBeGreaterThan(0);
    const balkOnder = (await vak('#tel .vraagbalk'))!;
    expect(Math.round(balkOnder.top)).toBe(Math.round(balk.top));
    const laatste = (await vak('#tel .inhoud > a[href="vandaag.html"]'))!;
    expect(laatste.bottom).toBeLessThanOrEqual(balkOnder.top);
    expect(await p.evaluate('document.scrollingElement.scrollWidth <= innerWidth')).toBe(true);

    // De microfoon: de Assistent vraagt meteen om de microfoon, en het adres is weer schoon.
    await p.locator('#tel .vraagbalk [data-mic]').click();
    await p.waitForURL(/assistent\.html/);
    await expect.poll(() => p.evaluate<boolean>('window.__micGevraagd')).toBe(true);
    expect(await p.evaluate<string>('location.hash')).toBe('');
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Thuis naar eigen smaak (besluit 162, schetsen Thuis-Tel-Eigen en
   * Wand-Thuis-Eigen): op de telefoon een kaart schuiven aan de greep,
   * verbergen met het oog en er een bij zetten; favorieten kiezen en met één
   * tik schakelen; en de wand, waar de kolom zelf schuift, die de hoofdgebruiker aanpast.
   * Alles staat daarna bij de dienst, en komt terug na opnieuw laden.
   */
  /*
   * Favorieten met pagina's (21 oktober 2026, schets Wand-Favorieten): meer dan
   * vier, vier per pagina met stipjes; een screen schakelt met één tik, en een
   * lamp heeft de naam van zijn kamer eronder. Vasthouden opent de kamer.
   */
  it('toont favorieten op pagina’s van vier, met een screen en de kamer erbij', async () => {
    type Huis = { etages: { ruimtes: { id: string; naam: string; apparaten: { id: string; soort: string }[] }[] }[] };
    const huisNu = (await (await fetch(`${baseUrl}/api/huis`)).json()) as Huis;
    const ruimtes = huisNu.etages.flatMap((e) => e.ruimtes);
    const lampen = ruimtes.flatMap((r) => r.apparaten.filter((d) => d.soort === 'licht').map((d) => ({ ...d, kamer: r })));
    expect(lampen.length).toBeGreaterThanOrEqual(4);
    const favorieten = [{ soort: 'scherm', id: 'cover.screen' }, ...lampen.slice(0, 4).map((d) => ({ soort: 'lamp', id: d.id }))];
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    try {
      await p.goto(`${baseUrl}/thuis.html`);
      const bewaard = await p.evaluate(async (f) => (await fetch('api/voorkeuren', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plek: 'tel', favorieten: f }) })).status, favorieten);
      expect(bewaard).toBe(200);
      await p.reload();
      const kaart = p.locator('#tel [data-kaart="favorieten"]');
      await expect.poll(() => kaart.locator('.favpagina').count()).toBe(2);
      expect(await kaart.locator('[data-stipjes] i').count()).toBe(2);
      // Een lamp zegt in welke kamer hij hangt.
      const lamp = kaart.locator(`[data-tegel="${lampen[0]!.id}"]`);
      expect(await lamp.textContent()).toContain(lampen[0]!.kamer.naam);
      // Het screen: één tik, en het gaat open of dicht.
      const voor = coverCalls.length;
      await kaart.locator('[data-tegel="cover.screen"]').click();
      await expect.poll(() => coverCalls.length).toBe(voor + 1);
      expect(coverCalls.at(-1)).toMatch(/^(open_cover|close_cover) cover\.screen$/);
      // Opzij schuiven: de tweede pagina, en het tweede stipje.
      await kaart.locator('[data-favpaginas]').evaluate((el) => el.scrollTo({ left: el.clientWidth }));
      await expect.poll(() => kaart.locator('[data-stipjes] i').nth(1).getAttribute('class')).toBe('aan');
      // Thuis tekent opnieuw (elke minuut, of als er iets verandert): de tweede pagina blijft staan (21 oktober 2026).
      await p.evaluate('dispatchEvent(new Event("weergave"))');
      await p.waitForTimeout(400);
      expect(await kaart.locator('[data-favpaginas]').evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      expect(await kaart.locator('[data-stipjes] i').nth(1).getAttribute('class')).toBe('aan');
      // Vasthouden opent de lamp in zijn kamer, en schakelt hem niet.
      const lichtVoor = lightCalls.length;
      const laatste = kaart.locator(`[data-tegel="${lampen[3]!.id}"]`);
      const b = (await laatste.boundingBox())!;
      await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await p.mouse.down();
      await p.waitForURL(/kamer\.html#/, { timeout: 3_000 });
      await p.mouse.up();
      expect(decodeURIComponent(new URL(p.url()).hash)).toBe(`#${lampen[3]!.kamer.id}/${lampen[3]!.id}`);
      expect(lightCalls.length).toBe(lichtVoor);
      // Op de telefoon staat het blad van de lamp onder de tekening: de pagina gaat er meteen naartoe (21 oktober 2026).
      const lampBlad = p.locator('#tel [data-blad]');
      await lampBlad.locator('[data-terug]').waitFor();
      await expect.poll(() => lampBlad.evaluate((el) => el.getBoundingClientRect().top < el.ownerDocument.documentElement.clientHeight / 2), { timeout: 3_000 }).toBe(true);
      expect(fouten).toEqual([]);
    } finally {
      await fetch(`${baseUrl}/api/voorkeuren`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plek: 'tel', favorieten: [] }) }).catch(() => null);
      await context.close();
    }
  }, 30_000);

  it('past Thuis aan op de telefoon en de wand, met favorieten (besluit 162)', async () => {
    type Voorkeuren = { tel: { kaarten: string[]; favorieten: { id: string }[] }; wand: { kaarten: string[]; breed: string[]; magAanpassen: boolean } };
    const voorkeuren = async () => (await (await fetch(`${baseUrl}/api/voorkeuren`)).json()) as Voorkeuren;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const volgorde = () => p.locator('#tel [data-kaarten] > [data-kaart]:not([data-uit])').evaluateAll((els) => els.map((e) => e.getAttribute('data-kaart')));
    try {
      await p.goto(`${baseUrl}/thuis.html`);
      await p.locator('#tel [data-kop]').filter({ hasNotText: 'Even laden' }).waitFor();
      expect((await volgorde()).slice(0, 2)).toEqual(['kamers', 'favorieten']);

      // Favorieten kiezen: nog leeg, dus een knop Kiezen; een lamp en een scène.
      await p.locator('#tel [data-kaart="favorieten"] [data-fav-kies]').click();
      const blad = p.locator('[data-kiesblad]');
      await blad.waitFor();
      // Per kamer, de lampen eerst; de scènes ingeklapt eronder (besluit 168).
      expect(await blad.locator('[data-fav-soort="scene"]').first().isVisible()).toBe(false);
      await blad.locator('[data-fav-soort="lamp"]').first().click();
      const kamerMetScenes = blad.locator('[data-fav-kamer]').first();
      await kamerMetScenes.locator('summary').click();
      await kamerMetScenes.locator('[data-fav-soort="scene"]').first().click();
      // Na het tekenen blijft hij open.
      expect(await kamerMetScenes.getAttribute('open')).not.toBeNull();
      expect(await blad.locator('[data-fav-teller]').textContent()).toContain('2 van 12');
      // Bovenin de gekozen favorieten als tegels zoals op de kaart, met een greep (21 oktober 2026).
      const voorbeeld = blad.locator('[data-favchip]');
      expect(await voorbeeld.count()).toBe(2);
      expect(await voorbeeld.first().locator('.tegel').count()).toBe(1);
      const eerste = await voorbeeld.first().getAttribute('data-favchip');
      // De tweede aan zijn greep naar de plek van de eerste.
      const van = (await voorbeeld.nth(1).locator('[data-favgreep]').boundingBox())!;
      const naar = (await voorbeeld.first().boundingBox())!;
      await p.mouse.move(van.x + van.width / 2, van.y + van.height / 2);
      await p.mouse.down();
      for (let i = 1; i <= 8; i++) await p.mouse.move(van.x + ((naar.x + 20 - van.x) * i) / 8, van.y + ((naar.y + naar.height / 2 - van.y) * i) / 8);
      await p.mouse.up();
      await expect.poll(() => voorbeeld.nth(1).getAttribute('data-favchip')).toBe(eerste);
      // En terug met de pijltjes.
      await voorbeeld.nth(1).focus();
      await p.keyboard.press('ArrowLeft');
      await expect.poll(() => voorbeeld.first().getAttribute('data-favchip')).toBe(eerste);
      await blad.locator('[data-fav-klaar]').click();
      await blad.waitFor({ state: 'hidden' });
      await expect.poll(async () => (await voorkeuren()).tel.favorieten.length).toBe(2);
      const tegels = p.locator('#tel [data-kaart="favorieten"] [data-tegel]');
      await expect.poll(() => tegels.count()).toBe(2);
      // Eén tik: de lamp schakelt, via dezelfde deur als in een kamer.
      const lampId = (await voorkeuren()).tel.favorieten[0]!.id;
      const voor = lightCalls.length;
      const lamp = tegels.and(p.locator('[data-soort="lamp"]'));
      const was = await lamp.getAttribute('aria-pressed');
      await lamp.click();
      await expect.poll(() => lightCalls.slice(voor).join('|')).toContain(was === 'true' ? 'turn_off' : 'turn_on');
      expect(lightCalls.slice(voor).join('|')).toContain(lampId);
      expect(await lamp.getAttribute('aria-pressed')).toBe(String(was !== 'true'));
      const scenesVoor = sceneCalls.length;
      await tegels.and(p.locator('[data-soort="scene"]')).click();
      await expect.poll(() => sceneCalls.length).toBe(scenesVoor + 1);

      // Aanpassen: een greep en een oog op elke kaart.
      await p.locator('#tel [data-aanpassen]').click();
      expect(await p.evaluate<boolean>("document.body.classList.contains('aanpassen')")).toBe(true);
      await p.locator('#tel [data-bewerkbalk]').waitFor();
      // Hoe voelt het naar boven slepen, boven de kamers.
      // Zoals een duim: de greep pakken, naar boven, en aan de rand schuift de pagina mee.
      const greep = p.locator('#tel [data-kaart="gevoel"] [data-greep]');
      await greep.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      const g = (await greep.boundingBox())!;
      const x = g.x + g.width / 2;
      await p.mouse.move(x, g.y + g.height / 2);
      await p.mouse.down();
      for (let i = 1; i <= 10; i++) await p.mouse.move(x, g.y + g.height / 2 - ((g.y - 40) * i) / 10);
      for (let i = 0; i < 60; i++) await p.mouse.move(x, 40 - (i % 2));
      await p.mouse.up();
      await expect.poll(async () => (await voorkeuren()).tel.kaarten[0]).toBe('gevoel');
      expect((await volgorde())[0]).toBe('gevoel');
      // Met de pijltjes kan het ook: Vandaag één omhoog.
      const lijst = await volgorde();
      await p.locator('#tel [data-kaart="vandaag"] [data-greep]').focus();
      await p.keyboard.press('ArrowUp');
      const verwacht = [...lijst];
      const iv = verwacht.indexOf('vandaag');
      [verwacht[iv - 1], verwacht[iv]] = [verwacht[iv]!, verwacht[iv - 1]!];
      await expect.poll(async () => (await voorkeuren()).tel.kaarten).toEqual(verwacht);
      // In de bewerkstand doet een kaart zelf niets.
      await p.locator('#tel [data-kaart="vandaag"] .kaart-kop h2').click();
      await p.locator('#tel [data-kaart="vandaag"] [data-oog]').click();
      await p.waitForTimeout(300);
      expect(new URL(p.url()).pathname).toBe('/thuis.html');
      // Vandaag is verborgen met het oog; via + Kaart komt het weer van morgen erbij.
      await expect.poll(async () => (await voorkeuren()).tel.kaarten.includes('vandaag')).toBe(false);
      expect(await p.locator('#tel [data-kaart="vandaag"]').isVisible()).toBe(false);
      await p.locator('#tel [data-kaart-erbij]').click();
      await blad.waitFor();
      expect(await blad.locator('[data-erbij]').evaluateAll((els) => els.map((e) => e.getAttribute('data-erbij')))).toEqual(expect.arrayContaining(['vandaag', 'morgen']));
      await blad.locator('[data-erbij="morgen"]').click();
      await expect.poll(async () => (await voorkeuren()).tel.kaarten.at(-1)).toBe('morgen');
      await p.locator('#tel [data-bewerkbalk] [data-klaar]').click();
      expect(await p.evaluate<boolean>("document.body.classList.contains('aanpassen')")).toBe(false);
      await p.locator('#tel [data-kaart="morgen"]').waitFor();
      // Na opnieuw laden staat alles nog zo.
      await p.reload();
      await p.locator('#tel [data-kop]').filter({ hasNotText: 'Even laden' }).waitFor();
      await expect.poll(async () => (await volgorde())[0]).toBe('gevoel');
      expect(await p.locator('#tel [data-kaart="vandaag"]').isVisible()).toBe(false);
      expect(await p.locator('#tel [data-kaart="morgen"]').isVisible()).toBe(true);

      // De wand, met het potlood voor wie hem mag aanpassen.
      await p.setViewportSize({ width: 1340, height: 800 });
      await expect.poll(() => p.evaluate<boolean>("document.documentElement.classList.contains('tel-stand')")).toBe(false);
      expect((await voorkeuren()).wand.magAanpassen).toBe(true);
      await p.locator('#wand [data-aanpassen]').click();
      await p.locator('#wand [data-bewerkkop]').waitFor();
      // De greep is alleen een icoon; geen vakken en geen pijltjes meer (besluit 167).
      expect((await p.locator('#wand [data-kaart="vandaag"] [data-greep]').textContent())?.trim()).toBe('');
      expect(await p.locator('#wand .kaartpijl').count()).toBe(0);
      // Twee kolommen, elke kaart smal of breed (besluit 187): Vandaag smal, en weer breed.
      await p.locator('#wand [data-kaart="vandaag"] [data-maat-zet="smal"]').click();
      await expect.poll(async () => (await voorkeuren()).wand.breed.includes('vandaag')).toBe(false);
      expect(await p.locator('#wand [data-kaart="vandaag"]').getAttribute('class')).toContain('smal');
      await p.locator('#wand [data-kaart="vandaag"] [data-maat-zet="breed"]').click();
      await expect.poll(async () => (await voorkeuren()).wand.breed.includes('vandaag')).toBe(true);
      // Favorieten en Morgen staan er nog niet: een vak om er een te kiezen.
      expect(await p.locator('#wand [data-vrijvak]').isVisible()).toBe(true);
      await p.locator('#wand [data-kaart="gevoel"] [data-oog]').click();
      await p.locator('#wand [data-vrijvak]').click();
      await blad.waitFor();
      expect(await blad.textContent()).toContain('Een nieuwe kaart komt onderaan');
      await blad.locator('[data-erbij="favorieten"]').click();
      await expect.poll(async () => (await voorkeuren()).wand.kaarten).toEqual(['tedoen', 'vandaag', 'apparaat', 'favorieten']);
      await p.locator('#wand [data-bewerkkop] [data-klaar]').click();
      // De wand heeft zijn eigen favorieten: nog geen, dus een knop om te kiezen. Ook
      // met Straks erbij staat hij er: de kolom schuift zelf.
      await p.locator('#wand [data-kaart="favorieten"] [data-fav-kies]').waitFor({ state: 'attached' });
      await expect.poll(() => p.locator('#wand [data-kaart="favorieten"]').isVisible()).toBe(true);
      expect(await p.evaluate("getComputedStyle(document.querySelector('#wand .rechts')).overflowY")).toBe('auto');
      // De wand zelf schuift nooit.
      expect(await p.evaluate('document.scrollingElement.scrollHeight <= innerHeight')).toBe(true);
      expect(fouten).toEqual([]);
    } finally {
      // Terug zoals het was, voor de tests hierna.
      const terug = (body: unknown) => fetch(`${baseUrl}/api/voorkeuren`, { method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl }, body: JSON.stringify(body) });
      await terug({ plek: 'tel', kaarten: ['kamers', 'favorieten', 'straks', 'tedoen', 'apparaat', 'gevoel', 'vandaag'], favorieten: [] });
      await terug({ plek: 'wand', kaarten: ['tedoen', 'vandaag', 'gevoel', 'apparaat'], breed: ['tedoen', 'favorieten', 'vandaag', 'gevoel'], favorieten: [] });
      await context.close();
    }
  }, 60_000);

  /*
   * Het scherm aan de wand als niemand kijkt (besluiten 164 en 165, schets
   * Wand-Nacht): na vijf minuten zonder iemand het always-on display, de
   * dagstand of na zonsondergang de avondstand; 's nachts uit na de tijd zonder
   * beweging; beweging zet het display weer aan, een tik, aanbellen en
   * "Hé huis" openen de app; op een kijkpagina terug naar Thuis; en de
   * hoofdgebruiker stelt het in bij het potlood. Het testaccount is bij
   * Bewoners een scherm.
   */
  it('laat de wand slapen en rusten als niemand kijkt, en wekt hem (besluiten 164 en 165)', async () => {
    type Niemand = { nacht: boolean; van: string; tot: string; rustMin: number; aanMin: number; weg: boolean; dag: boolean; avond: boolean; melder: string | null };
    const niemand = async () => ((await (await fetch(`${baseUrl}/api/voorkeuren`)).json()) as { wand: { niemand: Niemand } }).wand.niemand;
    const zet = (body: Partial<Niemand>) => fetch(`${baseUrl}/api/voorkeuren`, { method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl }, body: JSON.stringify({ plek: 'wand', niemand: body }) });
    await zet({ nacht: true, van: '23:00', tot: '07:00', rustMin: 5, aanMin: 1, weg: false, melder: null });
    // De dagstand vanaf het einde van de nacht (07:00) tot de zonsondergang van de dienst, daarna de avondstand (besluit 168). Om 14:10, in UTC.
    const onderMs = ((await (await fetch(`${baseUrl}/api/zon`)).json()) as { dag?: { onderMs?: number | null } }).dag?.onderMs ?? null;
    const onder = onderMs == null ? 19 * 60 : new Date(onderMs).getUTCHours() * 60 + new Date(onderMs).getUTCMinutes();
    const aanStand = 14 * 60 + 10 < onder ? 'dag' : 'avond';
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const laag = p.locator('#wand [data-niemand]');
    const stand = () => p.evaluate<string | null>("(() => { const el = document.querySelector('#wand [data-niemand]'); return !el || el.hidden ? null : el.dataset.stand ?? null; })()").catch(() => null);
    const shot = (naam: string) => (process.env.HEMS_PAGE_SHOT ? p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', `-${naam}.png`) }) : null);
    const geladen = () => p.locator('#wand [data-kop]').filter({ hasNotText: 'Even laden' }).waitFor();
    // Een nieuwe versie staat klaar (21 oktober 2026): die staat ook op het display.
    const meldBron = { nu: Date.now(), zonderRuimte: [], volgen: [], batterijen: [], filters: [], meters: [], versie: null, winterdagen: null };
    updateNu.klaar = true;
    meldingenStore.bij({ ...meldBron, update: { nieuw: '9.9.9', nu: VERSIE } });
    try {
      // Overdag: na vijf minuten niemand het always-on display.
      await p.clock.setFixedTime(new Date('2026-10-19T14:05:00Z'));
      await p.goto(`${baseUrl}/thuis.html`);
      await geladen();
      await p.clock.setFixedTime(new Date('2026-10-19T14:08:00Z'));
      await p.waitForTimeout(5_500);
      expect(await stand()).toBe(null);
      await p.clock.setFixedTime(new Date('2026-10-19T14:10:30Z'));
      await expect.poll(stand, { timeout: 10_000 }).toBe(aanStand);
      expect(await laag.locator('[data-nk-tijd]').textContent()).toBe('14:10');
      // Het logo voluit rechtsboven (ronde 5), los van de klok, met een tik naar Over deze app.
      const merk = await laag.locator('.merkje').boundingBox();
      const klokVak = await laag.locator('[data-nk-tijd]').boundingBox();
      expect(merk!.x).toBeGreaterThan(klokVak!.x + klokVak!.width);
      expect(merk!.y).toBeLessThan(klokVak!.y);
      expect(await laag.locator('.merkje').getAttribute('href')).toBe('over.html');
      expect(await laag.locator('[data-nk-huis] svg.sc-huis').count()).toBe(1);
      // Zonder getallen op het huis.
      expect(await laag.locator('[data-nk-huis] .sc-label').count()).toBe(0);
      if (aanStand === 'dag') expect(await laag.locator('[data-nk-kop]').textContent()).toBe(await p.locator('#wand [data-kop]').textContent());
      else expect(await laag.locator('[data-nk-rustig]').textContent()).toMatch(/^(Alles rustig|.+ (koelt|verwarmt))[.,]/);
      await shot(aanStand);
      // Beweging houdt het display aan; het opent de app niet.
      server.wek('beweging');
      await p.waitForTimeout(300);
      expect(await stand()).toBe(aanStand);
      // De nieuwe versie staat erop; een tik daarop opent de app met wat er nieuw is en Bijwerken.
      const update = laag.locator('[data-nk-update]');
      expect(await update.textContent()).toContain('Versie 9.9.9 staat klaar');
      await update.click();
      expect(await stand()).toBe(null);
      expect(await p.locator('#wand [data-kop]').isVisible()).toBe(true);
      await p.locator('[data-nieuwpop] h2', { hasText: 'Versie 9.9.9 staat klaar' }).waitFor({ timeout: 5_000 });
      await p.locator('[data-nieuw-dicht]').click();
      updateNu.klaar = false;
      meldingenStore.bij({ ...meldBron, nu: Date.now() });

      // 's Nachts: na een minuut zonder beweging gaat het scherm uit.
      await p.clock.setFixedTime(new Date('2026-10-19T23:48:00Z'));
      await p.reload();
      await geladen();
      expect(await stand()).toBe(null);
      await p.clock.setFixedTime(new Date('2026-10-19T23:49:30Z'));
      await expect.poll(stand, { timeout: 10_000 }).toBe('uit');
      expect(await p.evaluate<string>("getComputedStyle(document.querySelector('#wand [data-niemand]')).backgroundColor")).toBe('rgb(0, 0, 0)');
      await shot('uit');
      // Beweging zet het display aan, en na een minuut zonder beweging weer uit.
      // Om tien voor twaalf is dat de avondstand.
      server.wek('beweging');
      await expect.poll(stand).toBe('avond');
      await p.clock.setFixedTime(new Date('2026-10-19T23:51:00Z'));
      await expect.poll(stand, { timeout: 10_000 }).toBe('uit');
      // Een tik op het zwarte scherm opent de app.
      await laag.click();
      expect(await stand()).toBe(null);

      // Aanbellen en "Hé huis" openen de app.
      await p.clock.setFixedTime(new Date('2026-10-19T23:53:00Z'));
      await expect.poll(stand, { timeout: 10_000 }).toBe('uit');
      server.ring('camera.voordeur', 'Deurbel', { seconden: 30, schermAan: true });
      await expect.poll(stand).toBe(null);
      await p.locator('.aanbel [data-bel-dicht]').click();
      await p.clock.setFixedTime(new Date('2026-10-19T23:55:00Z'));
      await expect.poll(stand, { timeout: 10_000 }).toBe('uit');
      await p.evaluate("dispatchEvent(new CustomEvent('sc-wek', { detail: 'stem' }))");
      expect(await stand()).toBe(null);

      // Op een kijkpagina gaat de wand terug naar Thuis.
      await p.clock.setFixedTime(new Date('2026-10-20T14:00:00Z'));
      await p.goto(`${baseUrl}/vandaag.html`);
      await p.waitForLoadState('domcontentloaded');
      await p.waitForTimeout(500);
      await p.clock.setFixedTime(new Date('2026-10-20T14:10:00Z'));
      await p.waitForURL(/thuis\.html$/, { timeout: 15_000 });
      await expect.poll(stand, { timeout: 10_000 }).toBe(aanStand);
      await laag.click();

      // Instellen bij Functies, onder Weergave (besluit 167): het potlood heeft het niet meer.
      await p.locator('#wand [data-aanpassen]').click();
      expect(await p.locator('#wand [data-bewerkkop] [data-niemand-kies]').count()).toBe(0);
      await p.locator('#wand [data-bewerkkop] [data-klaar]').click();
      await p.clock.setFixedTime(new Date('2026-10-20T14:12:00Z'));
      await p.goto(`${baseUrl}/functies.html#aod`);
      const blad = p.locator('#wand [data-vorm]');
      await blad.locator('h2', { hasText: 'Always-on display' }).waitFor();
      expect(await p.locator('#wand [data-delen] h4').allTextContents()).toContain('Weergave');
      // De schakelaar: uit, en de minuten worden grijs.
      expect(await blad.locator('[data-nk-aod]').getAttribute('aria-checked')).toBe('true');
      await blad.locator('[data-nk-rust="15"]').click();
      await expect.poll(async () => (await niemand()).rustMin).toBe(15);
      expect(await blad.locator('[data-nk-zin]').textContent()).toContain('15 minuten');
      await shot('kiezen');
      await blad.locator('[data-nk-aod]').click();
      await expect.poll(async () => (await niemand()).rustMin).toBe(0);
      expect(await blad.locator('[data-nk-rust="5"]').isDisabled()).toBe(true);
      await blad.locator('[data-nk-aod]').click();
      await expect.poll(async () => (await niemand()).rustMin).toBe(5);
      // Dagstand en avondstand (besluit 168): zet je er een uit, dan neemt de andere het over; de laatste blijft aan.
      expect(await blad.locator('[data-nk-dagzin]').textContent()).toMatch(/^\d\d:\d\d tot zonsondergang/);
      await blad.locator('[data-nk-avond]').click();
      await expect.poll(async () => (await niemand()).avond).toBe(false);
      expect(await blad.locator('[data-nk-dag]').isDisabled()).toBe(true);
      expect(await blad.locator('[data-nk-dagzin]').textContent()).toContain('De hele tijd');
      await blad.locator('[data-nk-avond]').click();
      await expect.poll(async () => (await niemand()).avond).toBe(true);
      // Scherm uit: wanneer, en na hoeveel minuten zonder beweging.
      await p.goto(`${baseUrl}/functies.html#uit`);
      await blad.locator('h2', { hasText: 'Scherm uit' }).waitFor();
      await blad.locator('[data-nk-aan="5"]').click();
      await expect.poll(async () => (await niemand()).aanMin).toBe(5);
      if (!(await niemand()).weg) await blad.locator('[data-nk-weg]').click();
      await expect.poll(async () => (await niemand()).weg).toBe(true);
      await blad.locator('[data-nk-aan="30"]').click();
      await expect.poll(async () => (await niemand()).aanMin).toBe(30);
      // De bewegingsmelder uit het huis: die in de hal.
      await blad.locator('[data-nk-beweging]').click();
      await expect.poll(async () => (await niemand()).melder).toBe('binary_sensor.bewegingssensor_hal_beweging');
      expect(await blad.locator('[data-nk-melder]').inputValue()).toBe('binary_sensor.bewegingssensor_hal_beweging');
      if (!(await niemand()).nacht) await blad.locator('[data-nk-nacht]').click();
      await expect.poll(async () => (await niemand()).nacht).toBe(true);
      await blad.locator('[data-nk-van]').fill('22:30');
      await expect.poll(async () => (await niemand()).van).toBe('22:30');
      expect(await blad.locator('[data-nk-zin]').textContent()).toContain('Van 22:30 tot');
      await blad.locator('[data-nk-nacht]').click();
      await expect.poll(async () => (await niemand()).nacht).toBe(false);
      expect(await blad.locator('[data-nk-van]').isDisabled()).toBe(true);
      // De wand schuift nooit.
      expect(await p.evaluate('document.scrollingElement.scrollHeight <= innerHeight')).toBe(true);
      expect(fouten).toEqual([]);
    } finally {
      // Terug zoals de andere tests hem verwachten: niet slapen, niet rusten, geen nieuwe versie.
      await zet({ nacht: false, van: '23:00', tot: '07:00', rustMin: 0, aanMin: 5, weg: false, melder: null });
      updateNu.klaar = false;
      meldingenStore.bij({ ...meldBron, nu: Date.now() });
      await context.close();
    }
  }, 120_000);

  /*
   * De wand in Fully Kiosk (29 oktober 2026): 's nachts het scherm echt uit,
   * de camera van de wand als bewegingsmelder, en het scherm dat Fully zelf
   * aanzet toont de klok in plaats van een zwarte pagina. Fully voert zijn
   * gebeurtenissen uit in de bovenste pagina; die bereiken de app via een
   * BroadcastChannel.
   */
  it('wekt de wand met de camera van Fully Kiosk, en zet het scherm echt uit', async () => {
    const zet = (body: Record<string, unknown>) => fetch(`${baseUrl}/api/voorkeuren`, { method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl }, body: JSON.stringify({ plek: 'wand', niemand: body }) });
    await zet({ nacht: true, van: '23:00', tot: '07:00', rustMin: 5, aanMin: 1, weg: false, melder: 'fully' });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    await context.addInitScript(() => {
      localStorage.setItem('sc-rondleiding-gezien', '1');
      const w = globalThis as unknown as { fully: Record<string, unknown> };
      const f = { log: [] as string[], binds: {} as Record<string, string> };
      w.fully = Object.assign(f, {
        turnScreenOff: () => f.log.push('uit'),
        turnScreenOn: () => f.log.push('aan'),
        setScreenBrightness: (b: number) => f.log.push(`helder ${b}`),
        bind: (e: string, code: string) => void (f.binds[e] = code),
        isMotionDetectionRunning: () => true,
      });
    });
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const stand = () => p.evaluate<string | null>("(() => { const el = document.querySelector('#wand [data-niemand]'); return !el || el.hidden ? null : el.dataset.stand ?? null; })()").catch(() => null);
    const log = () => p.evaluate<string[]>('window.fully.log');
    // Wat Fully doet bij een gebeurtenis: de code van bind() uitvoeren, in de bovenste pagina.
    const fully = (e: string) => p.evaluate(`(0, eval)(window.fully.binds[${JSON.stringify(e)}])`);
    try {
      await p.clock.setFixedTime(new Date('2026-10-19T23:48:00Z'));
      await p.goto(`${baseUrl}/thuis.html`);
      await p.locator('#wand [data-kop]').filter({ hasNotText: 'Even laden' }).waitFor();
      await expect.poll(() => p.evaluate<string[]>('Object.keys(window.fully.binds)')).toEqual(expect.arrayContaining(['onMotion', 'screenOn']));
      // Na een minuut zonder beweging: het scherm echt uit, met de tekst dat beweging het weer aanzet.
      await p.clock.setFixedTime(new Date('2026-10-19T23:49:30Z'));
      await expect.poll(stand, { timeout: 10_000 }).toBe('uit');
      expect(await log()).toContain('uit');
      expect(await p.locator('#wand [data-niemand] .nk-uit').textContent()).toContain('Beweging');
      // De camera ziet iemand: het scherm aan, met de klok van de avond.
      await fully('onMotion');
      await expect.poll(stand).toBe('avond');
      expect((await log()).at(-2)).toBe('aan');
      await p.clock.setFixedTime(new Date('2026-10-19T23:51:00Z'));
      await expect.poll(stand, { timeout: 10_000 }).toBe('uit');
      // Een melder uit het huis gekozen: de camera wekt niet meer, maar zet Fully het scherm zelf aan, dan de klok.
      await zet({ melder: 'binary_sensor.bewegingssensor_hal_beweging' });
      await p.reload();
      await p.locator('#wand [data-kop]').filter({ hasNotText: 'Even laden' }).waitFor();
      await p.clock.setFixedTime(new Date('2026-10-19T23:53:00Z'));
      await expect.poll(stand, { timeout: 10_000 }).toBe('uit');
      await fully('onMotion');
      await p.waitForTimeout(300);
      expect(await stand()).toBe('uit');
      await fully('screenOn');
      await expect.poll(stand).toBe('avond');
      // Bij Functies › Scherm uit: de camera als keuze, en wat Fully op dit scherm doet.
      await p.clock.setFixedTime(new Date('2026-10-20T14:00:00Z'));
      await p.goto(`${baseUrl}/functies.html#uit`);
      const blad = p.locator('#wand [data-vorm]');
      await blad.locator('h2', { hasText: 'Scherm uit' }).waitFor();
      await blad.locator('[data-nk-melder]').selectOption('fully');
      await expect.poll(async () => ((await (await fetch(`${baseUrl}/api/voorkeuren`)).json()) as { wand: { niemand: { melder: string | null } } }).wand.niemand.melder).toBe('fully');
      await blad.locator('.uitleg', { hasText: 'de camera kijkt mee' }).waitFor();
      expect(fouten).toEqual([]);
    } finally {
      await zet({ nacht: false, van: '23:00', tot: '07:00', rustMin: 0, aanMin: 5, weg: false, melder: null });
      await context.close();
    }
  }, 60_000);

  /*
   * Weergave per account (besluit 164, schets Thuis-Tel-Eigen #weergave en
   * #eenvoudig): eenvoudig zonder getallen op het huis en Vandaag in één zin,
   * grotere letters, minder beweging; bewaard bij de dienst, ook na opnieuw
   * laden en op een andere pagina. Op de wand alleen minder beweging.
   */
  it('kiest eenvoudig, grotere letters en minder beweging (besluit 164)', async () => {
    type Weergave = { eenvoudig: boolean; groteLetters: boolean; minderBeweging: boolean };
    const weergave = async () => ((await (await fetch(`${baseUrl}/api/voorkeuren`)).json()) as { tel: { weergave: Weergave } }).tel.weergave;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const klasse = (k: string) => p.evaluate<boolean>(`document.documentElement.classList.contains('${k}')`);
    const stijl = (sel: string, eig: string) => p.evaluate<string>(`getComputedStyle(document.querySelector(${JSON.stringify(sel)})).${eig}`);
    const shot = (naam: string, vol = false) => (process.env.HEMS_PAGE_SHOT ? p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', `-${naam}.png`), fullPage: vol }) : null);
    try {
      await p.goto(`${baseUrl}/thuis.html`);
      await p.locator('#tel [data-kop]').filter({ hasNotText: 'Even laden' }).waitFor();
      // Uitgebreid: kW op het huis (als er zon is) en de grafiek van vandaag.
      await p.locator('#podium-tel svg.sc-huis').waitFor();
      const labelsVoor = await p.locator('#podium-tel .sc-label').count();
      expect(await p.locator('#tel [data-kaart="vandaag"] [data-dag] svg').isVisible()).toBe(true);
      const kopVoor = await stijl('#tel .titel .kop-1', 'fontSize');

      // Weergave, onderaan Thuis naast Thuis aanpassen.
      await p.locator('#tel [data-weergave]').click();
      const blad = p.locator('[data-kiesblad]');
      await blad.waitFor();
      expect(await blad.locator('[data-wg-eenvoudig="false"]').getAttribute('aria-checked')).toBe('true');
      await shot('weergave');
      await blad.locator('[data-wg-eenvoudig="true"]').click();
      await blad.locator('[data-wg-schakel="groteLetters"]').click();
      await blad.locator('[data-wg-schakel="minderBeweging"]').click();
      await expect.poll(weergave).toEqual({ eenvoudig: true, groteLetters: true, minderBeweging: true, seizoen: true, weer: true, feestdagen: true, zonnebaan: true });
      expect(await blad.locator('[data-wg-schakel="groteLetters"]').getAttribute('aria-checked')).toBe('true');
      await blad.locator('[data-blad-dicht]').click();
      await blad.waitFor({ state: 'hidden' });
      expect([await klasse('sc-eenvoudig'), await klasse('sc-groot'), await klasse('sc-stil')]).toEqual([true, true, true]);

      // Eenvoudig: geen getallen op het huis, Vandaag in een zin; Thuis aanpassen weg, Weergave blijft.
      await expect.poll(() => p.locator('#podium-tel .sc-label').count()).toBe(0);
      expect(await p.locator('#tel [data-kaart="vandaag"] [data-dag]').isVisible()).toBe(false);
      expect(await p.locator('#tel [data-dag-eenvoudig]').textContent()).toMatch(/^Je panelen gaven/);
      expect(await p.locator('#tel .aanpasrij [data-aanpassen]').isVisible()).toBe(false);
      expect(await p.locator('#tel [data-weergave]').isVisible()).toBe(true);
      // Grotere letters: de kop van 32 naar 36.
      expect(kopVoor).toBe('32px');
      expect(await stijl('#tel .titel .kop-1', 'fontSize')).toBe('36px');
      // Minder beweging: de bol ademt niet.
      expect(await stijl('#tel .vraagbalk .bol', 'animationName')).toBe('none');
      await shot('eenvoudig');
      await shot('eenvoudig-vol', true);

      // Na opnieuw laden, zonder wat de browser onthield: de dienst weet het.
      await p.evaluate(() => localStorage.removeItem('sc-weergave'));
      await p.reload();
      await p.locator('#tel [data-kop]').filter({ hasNotText: 'Even laden' }).waitFor();
      await expect.poll(() => klasse('sc-eenvoudig')).toBe(true);
      // Op een andere pagina ook: Instellingen, met de weg naar Weergave via Jij (besluit 181).
      await p.goto(`${baseUrl}/instellingen.html`);
      await expect.poll(() => klasse('sc-groot')).toBe(true);
      await p.locator('#tel [data-jijregel]').click();
      await p.waitForURL(/jij\.html/);
      await p.locator('#tel a[href="thuis.html#weergave"]').click();
      await p.waitForURL(/thuis\.html/);
      await blad.waitFor();
      expect(await blad.getAttribute('aria-label')).toBe('Weergave');
      await blad.locator('[data-wg-eenvoudig="false"]').click();
      await expect.poll(async () => (await weergave()).eenvoudig).toBe(false);
      await blad.locator('[data-blad-dicht]').click();
      await expect.poll(() => p.locator('#podium-tel .sc-label').count()).toBe(labelsVoor);
      expect(await p.locator('#tel [data-kaart="vandaag"] [data-dag] svg').isVisible()).toBe(true);

      // De wand: de letters blijven zoals ze waren, want de wand schuift nooit.
      await p.setViewportSize({ width: 1280, height: 800 });
      await expect.poll(() => klasse('tel-stand')).toBe(false);
      expect(await stijl('#wand .titel .kop-1', 'fontSize')).toBe('46px');
      expect(await p.evaluate('document.scrollingElement.scrollHeight <= innerHeight')).toBe(true);
      expect(fouten).toEqual([]);
    } finally {
      await fetch(`${baseUrl}/api/voorkeuren`, { method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl }, body: JSON.stringify({ plek: 'tel', weergave: { eenvoudig: false, groteLetters: false, minderBeweging: false, seizoen: true, weer: true, feestdagen: true } }) });
      await context.close();
    }
  }, 60_000);

  /*
   * Het lichte thema en je eigen kleur (besluit 181, schetsen Thuis-Tel-Licht
   * en Instellingen-Tel-Jij): op de telefoon elke pagina licht, met tekst die
   * leesbaar blijft; de wand blijft donker. Gekozen bij Jij, bewaard bij de
   * dienst en meteen goed bij het laden.
   */
  it('zet de telefoon licht, met je eigen kleur, en laat de wand donker (besluit 181)', async () => {
    const zet = (wat: object) => fetch(`${baseUrl}/api/voorkeuren`, { method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl }, body: JSON.stringify({ plek: 'tel', ...wat }) });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    /** Tekst die tegen zijn achtergrond wegvalt: minder dan 3:1, met de achtergrond als effen kleur over de pagina. */
    const slecht = (stand = '#tel') => p.evaluate<string[]>(`(() => {
      const kleur = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const d = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: d[0], g: d[1], b: d[2], a: d.length > 3 ? d[3] : 1 }; };
      const over = (v, a) => ({ r: v.r * v.a + a.r * (1 - v.a), g: v.g * v.a + a.g * (1 - v.a), b: v.b * v.a + a.b * (1 - v.a), a: 1 });
      const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
      const grond = (el) => { const lagen = []; for (let e = el; e; e = e.parentElement) { const st = getComputedStyle(e); const c = kleur(st.backgroundColor); if (c && c.a > 0) { lagen.push(c); if (c.a >= 1) break; } } let b = { r: 233, g: 239, b: 246, a: 1 }; for (const l of lagen.reverse()) b = over(l, b); return b; };
      const uit = [];
      document.querySelectorAll('${stand} *').forEach((el) => {
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
        const r = el.getBoundingClientRect(); const st = getComputedStyle(el);
        if (!r.width || !r.height || st.visibility === 'hidden' || Number(st.opacity) < 0.5 || el.closest('svg, [hidden], [aria-hidden="true"]')) return;
        const b = grond(el); const t = kleur(st.color); if (!b || !t) return;
        const v = over(t, b); const L1 = lum(v), L2 = lum(b);
        const k = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        if (k < 3) uit.push(el.tagName.toLowerCase() + '.' + [...el.classList].join('.') + ' "' + el.textContent.trim().slice(0, 30) + '" ' + k.toFixed(1));
      });
      return uit;
    })()`);
    // Een bewoner op zijn eigen apparaat, geen scherm: een eerdere test kan het account als scherm hebben gezet.
    const bewonersWas = bewonersStore.current;
    await bewonersStore.save(voegToe(GEEN_BEWONERS, { userId: 'u', naam: 'Test' }, null, Date.now()));
    try {
      expect((await zet({ thema: 'licht', kleur: 'violet' })).ok).toBe(true);
      // Instellingen › Jij: het profiel, met het thema en de kleur die je koos.
      await p.goto(`${baseUrl}/jij.html`);
      await p.locator('#tel [data-thema-open]').waitFor();
      expect(await p.evaluate('document.documentElement.classList.contains("sc-licht")')).toBe(true);
      expect(await p.evaluate('document.documentElement.dataset.kleur')).toBe('violet');
      await p.locator('#tel [data-thema-open]').click();
      await p.locator('[data-blad] [data-thema="donker"]').click();
      await expect.poll(() => p.evaluate('document.documentElement.classList.contains("sc-licht")')).toBe(false);
      await p.locator('[data-blad] [data-thema="licht"]').click();
      await p.locator('[data-blad] [data-kies-kleur="framboos"]').click();
      await expect.poll(() => p.evaluate('document.documentElement.dataset.kleur')).toBe('framboos');
      await p.locator('[data-blad] [data-blad-dicht]').click();
      await zet({ kleur: 'violet' });

      // De controle zelf: lichtgele tekst op wit valt weg.
      await p.evaluate(`document.querySelector('#tel').insertAdjacentHTML('beforeend', '<p id="proef" style="color: #f7b548; background: #fff">proef</p>')`);
      expect((await slecht()).some((x) => x.includes('"proef"'))).toBe(true);
      const huisNu = (await (await fetch(`${baseUrl}/api/huis`)).json()) as { etages: { ruimtes: { id: string; apparaten: unknown[] }[] }[] };
      const vol = huisNu.etages.flatMap((e) => e.ruimtes).sort((x, y) => y.apparaten.length - x.apparaten.length)[0]!;
      const paginas = ['thuis.html', 'vandaag.html', 'apparaten.html', 'opbrengst.html', 'assistent.html', `kamer.html#${encodeURIComponent(vol.id)}`, 'instellingen.html', 'jij.html', 'comfort.html', 'energie.html', 'functies.html', 'regeling.html', 'huis-kan.html', 'klaarzetten.html', 'voortgang.html', 'toegang.html', 'bewoners.html', 'indeling.html', 'inrichten.html'];
      const weg: string[] = [];
      for (const pagina of paginas) {
        await p.goto(`${baseUrl}/${pagina}`);
        await p.waitForTimeout(1200);
        // Meteen licht, uit wat de pagina onthield: de dienst bevestigt het.
        expect(await p.evaluate('document.documentElement.classList.contains("sc-licht")'), pagina).toBe(true);
        weg.push(...(await slecht()).map((x) => `${pagina}: ${x}`));
        if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', `-licht-${pagina.replace(/\.html.*/, '')}.png`), fullPage: true });
      }
      expect(weg).toEqual([]);

      // Breed, op je eigen apparaat (een telefoon liggend, een tablet): ook licht. Alleen een scherm, zoals de wand, blijft donker.
      await p.setViewportSize({ width: 1280, height: 800 });
      const wandWeg: string[] = [];
      for (const pagina of paginas) {
        await p.goto(`${baseUrl}/${pagina}`);
        await p.waitForTimeout(1200);
        expect(await p.evaluate('document.documentElement.classList.contains("tel-stand")'), pagina).toBe(false);
        expect(await p.evaluate('document.documentElement.classList.contains("sc-licht")'), pagina).toBe(true);
        wandWeg.push(...(await slecht('#wand')).map((x) => `${pagina}: ${x}`));
        if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', `-licht-breed-${pagina.replace(/\.html.*/, '')}.png`) });
      }
      expect(wandWeg).toEqual([]);
      expect(fouten).toEqual([]);
    } finally {
      await zet({ thema: 'donker', kleur: 'lucht' });
      await bewonersStore.save(bewonersWas);
      await context.close();
    }
  }, 120_000);

  /*
   * Vier kaarten om te kiezen (besluit 182, schets Thuis-Tel-Kaarten): de
   * auto, de thuisbatterij, deze maand en de deurbel. Wat het huis niet heeft,
   * staat er niet en wordt niet aangeboden.
   */
  it('toont de auto, de batterij, deze maand en de deurbel als kaart (besluit 182)', async () => {
    const zet = (kaarten: readonly string[]) => fetch(`${baseUrl}/api/voorkeuren`, { method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl }, body: JSON.stringify({ plek: 'tel', kaarten }) });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    extraOpslag = {
      batterij: { id: 'sessy', naam: 'De batterij', pct: 54, vermogenW: -900, stand: 'levert' },
      auto: { id: 'tesla', naam: 'Tesla Model 3', pct: 62, aangesloten: true, laadt: true, vermogenW: 3200, bereikKm: 280, plek: 'garage', accuKWh: 75, laadpaal: 'easee', paalNaam: 'Easee Home', paalStroomA: { min: 6, max: 16 }, laadgrens: 80, stroomA: [4.6, 4.6, 4.7], volOm: null, thuis: true, kabelSinds: null, wegSinds: null, fout: null },
      autos: [],
    };
    extraOpslag = { ...extraOpslag, autos: [extraOpslag.auto!] };
    // Een half uur geleden, maar niet voor middernacht (UTC, zoals de browser hier): dan zegt de kaart "Laatst aangebeld" met de dag.
    const nu = Date.now();
    extraDeurbel = { camera: 'camera.deurbel_duidelijk', naam: 'Deurbel', laatsteMs: Math.max(nu - 30 * 60_000, nu - (nu % 86_400_000)), reserve: ['camera.deurbel_vloeiend'] };
    extraOprit = true;
    try {
      expect((await zet([...STANDAARD_TEL, 'auto', 'batterij', 'maand', 'deurbel'])).ok).toBe(true);
      await p.goto(`${baseUrl}/thuis.html`);
      const kaart = (id: string) => p.locator(`#tel [data-kaart="${id}"]`);
      await expect.poll(() => kaart('auto').textContent(), { timeout: 10_000 }).toContain('62%');
      expect(await kaart('auto').textContent()).toContain('Laadt, 3,2 kW · 280 km');
      // De auto als meter (besluit 259, stap 2), en een tik opent de pagina Auto.
      expect(await kaart('auto').getAttribute('href')).toBe('auto.html');
      expect(await kaart('auto').locator('.kvol .autometer svg').count()).toBe(1);
      // Het advies (stap 4): een eigen kaart direct boven de auto, naar de pagina van die auto.
      const advies = p.locator('#tel [data-laadadvies]');
      await expect.poll(() => advies.textContent()).toContain('Er kan meer op zon');
      expect(await advies.textContent()).toContain('1,8 kW zon over');
      expect(await advies.textContent()).toContain('Tesla Model 3 laadt met 5 A. Met 8 A gaat het sneller');
      expect(await advies.locator('.koplink').getAttribute('href')).toBe('auto.html#tesla');
      // Met één tik (besluit 262): de Easee mag, dus Laad met 8 A, tot de kabel eruit gaat; en Meer keuzes opent het blad.
      expect(await advies.locator('.kijk').getAttribute('href')).toBe('auto.html?laden#tesla');
      await advies.locator('[data-laden-snel]').click();
      await expect.poll(() => advies.locator('[data-laden-snel]').textContent()).toBe('Laadt met 8 A');
      expect(ladenGestuurd).toEqual([{ auto: 'tesla', stroomA: 8, tot: 'kabel' }]);
      expect(await advies.evaluate((el) => el.nextElementSibling?.getAttribute('data-kaart'))).toBe('auto');
      expect(await kaart('batterij').textContent()).toContain('Levert 0,9 kW aan het huis');
      // Deze maand: met meters wat er opgewekt en zelf gebruikt is (na de test van Opbrengst), zonder wat er nodig is.
      await expect.poll(() => kaart('maand').textContent()).toMatch(/kWh opgewekt.*zelf gebruikt|Kies eerst je meters/);
      // De kaart Camera's (besluit 201): de oprit die nu een persoon ziet vooraan, dan de deurbel met wanneer er werd aangebeld.
      await expect.poll(() => kaart('deurbel').locator('.kvol .cambeeld img').count()).toBe(2);
      expect(await kaart('deurbel').locator('.kvol .camnaam').allTextContents()).toEqual(['Camera oprit', 'Deurbel']);
      expect(await kaart('deurbel').locator('.kvol .camzin').allTextContents()).toEqual(['Persoon, nu', expect.stringMatching(/^Aangebeld om \d\d:\d\d$/)]);
      expect(await kaart('deurbel').locator('.kvol .cambeeld.nu').count()).toBe(1);
      expect(await kaart('deurbel').locator('.camnu').textContent()).toBe('Persoon bij Camera oprit');
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-kaarten.png'), fullPage: true });
      // In het licht: de tekst in de tint van het lichte thema (besluit 181).
      await fetch(`${baseUrl}/api/voorkeuren`, { method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl }, body: JSON.stringify({ plek: 'tel', thema: 'licht' }) });
      await p.reload();
      await expect.poll(() => kaart('batterij').textContent()).toContain('54%');
      expect(await p.evaluate('getComputedStyle(document.querySelector("#tel [data-kaart=batterij] small")).color')).toBe('rgb(90, 75, 209)');
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-kaarten-licht.png'), fullPage: true });
      await fetch(`${baseUrl}/api/voorkeuren`, { method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl }, body: JSON.stringify({ plek: 'tel', thema: 'donker' }) });
      await p.reload();
      await expect.poll(() => kaart('deurbel').locator('.kvol .cambeeld img').count()).toBe(2);
      // Een tik op de deurbel: het live beeld groot, met de andere camera's eronder om te wisselen.
      await kaart('deurbel').locator('.cambeeld.bel').click();
      await p.locator('.aanbel', { hasText: 'Deurbel · Aangebeld om' }).waitFor();
      expect(await p.locator('.aanbel [data-bel-wissel]').count()).toBe(2);
      await p.locator('.aanbel [data-bel-wissel="0"]').click();
      await p.locator('.aanbel', { hasText: 'Camera oprit · Persoon, nu' }).waitFor();
      expect(await p.locator('.aanbel [data-bel-wissel="0"]').getAttribute('aria-pressed')).toBe('true');
      await p.locator('.aanbel [data-bel-dicht]').click();
      // Kiezen (besluit 201): alleen de deurbel, en dan staat alleen die op de kaart.
      await kaart('deurbel').locator('[data-cam-kies]').click();
      await p.locator('[data-kiesblad] [data-cam-keus="camera.camera_oprit_vloeiend"]').click();
      await p.locator('[data-kiesblad] [data-cam-klaar]').click();
      await expect.poll(() => kaart('deurbel').locator('.kvol .cambeeld').count()).toBe(1);
      expect((await (await fetch(`${baseUrl}/api/voorkeuren`)).json() as { tel: { cameras: string[] } }).tel.cameras).toEqual(['camera.deurbel_duidelijk']);
      // Een tik op de auto: de pagina Auto (besluit 259, stap 2), met de lading, de laadgrens en de laadpaal.
      await kaart('auto').click();
      await p.waitForURL(/auto\.html$/);
      const held = p.locator('#tel .held');
      await expect.poll(() => held.textContent(), { timeout: 10_000 }).toContain('62%');
      expect(await held.textContent()).toContain('3,2 kW3 × 5 A');
      expect(await held.textContent()).toContain('280 km bereik');
      expect(await held.textContent()).toContain('80%');
      expect(await held.textContent()).toContain('Easee Home, in de garage');
      // Tijdens het laden staat deze laadbeurt waar anders de accu staat (stap 3).
      await expect.poll(() => held.textContent()).toContain('Deze laadbeurt4,2 kWh · € 0,31');
      expect(await held.textContent()).toContain('71% eigen zon');
      expect(await p.locator('#tel .fase').count()).toBe(3);
      expect(await p.locator('#tel .kaart:not(.beurten) .kan').textContent()).toBe('Laden met 6 tot 16 A.');
      // De laadbeurten van de week: samen, en per beurt, de nieuwste eerst.
      const beurtenKaart = p.locator('#tel .beurten');
      expect(await beurtenKaart.locator('.som').textContent()).toMatch(/41,3 kWh.*€ 9,33.*14%/s);
      expect(await beurtenKaart.locator('.beurt').count()).toBe(3);
      expect(await beurtenKaart.locator('.beurt').first().textContent()).toMatch(/Vandaag.*– nu.*4,2 kWh.*€ 0,31/s);
      expect(await beurtenKaart.locator('.kan').textContent()).toContain('Eigen zon telt als gratis');
      // Laden met de hand (besluit 262): wat er nu loopt, en het blad met de stroom, hoe lang en terug.
      const regel = p.locator('#tel [data-laden-open]');
      expect(await regel.textContent()).toContain('Met de hand · 8 A tot de kabel eruit gaat');
      await regel.click();
      const laadBlad = p.locator('[data-ladenlaag]');
      await laadBlad.waitFor();
      expect(await laadBlad.locator('.getal b').textContent()).toBe('8A');
      expect(await laadBlad.textContent()).toContain('Op je zekering past nu tot 20 A per fase voor de auto.');
      expect(await laadBlad.locator('.hand-onder').textContent()).toContain('Terug naar de laadpaal');
      await laadBlad.locator('[data-laden-stroom="1"]').click();
      await laadBlad.locator('[data-laden-tot="pct"]').click();
      expect(await laadBlad.locator('.tot-pct b').textContent()).toBe('75%');
      await laadBlad.locator('[data-laden-pct="5"]').click();
      expect(await laadBlad.locator('[data-laden-pct="5"]').isDisabled()).toBe(true);
      await laadBlad.locator('[data-laden-zet]').click();
      await expect.poll(() => ladenGestuurd.length).toBe(2);
      expect(ladenGestuurd[1]).toEqual({ auto: 'tesla', stroomA: 9, tot: 'pct', pct: 80 });
      await expect.poll(() => laadBlad.count()).toBe(0);
      await expect.poll(() => regel.textContent()).toContain('Met de hand · 9 A tot 80%');
      await regel.click();
      await laadBlad.locator('[data-laden-terug]').click();
      await expect.poll(() => ladenGestuurd.length).toBe(3);
      expect(ladenGestuurd[2]).toEqual({ auto: 'tesla', terug: true });
      await expect.poll(() => regel.textContent()).toContain('De laadpaal kiest zelf · 5 A');
      // Het advies onder de auto: zon met de ruimte op de zekering, en de goedkoopste uren met hoe ver hij komt.
      const adviesAuto = p.locator('#tel .advies');
      expect(await adviesAuto.locator('.zon').textContent()).toContain('Met 8 A in plaats van 5 A laadt de auto sneller, nog steeds op eigen zon. Er blijft 16 A over op je zekering van 3 × 25 A.');
      expect(await adviesAuto.locator('.goedkoop').textContent()).toMatch(/Goedkoopst morgen \d\d:00–\d\d:00.*€ 0,14 per kWh, de helft van nu\. Genoeg om tot 80% te laden, voor ongeveer € 4,60\./s);
      // De wand scrolt nooit (besluit 104): rechts de laadpaal op drie fasen en zoveel beurten als er passen.
      const wand = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
      await wand.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
      const w = await wand.newPage();
      await w.goto(`${baseUrl}/auto.html`);
      await expect.poll(() => w.locator('#wand .beurten .beurt').count(), { timeout: 10_000 }).toBeGreaterThan(0);
      expect(await w.evaluate('(() => { const r = document.querySelector("[data-rechts]"); return r.scrollHeight <= r.clientHeight + 1; })()')).toBe(true);
      // Op de wand staat Laden als rij in de kaart van de laadpaal (besluit 262).
      expect(await w.locator('#wand .ladenrij').textContent()).toContain('Laden');
      // Links de auto met het advies eronder, ook zonder te scrollen.
      await expect.poll(() => w.locator('#wand .advies > div').count()).toBe(2);
      expect(await w.evaluate('(() => { const h = document.querySelector("[data-held]"); return h.scrollHeight <= h.clientHeight + 1; })()')).toBe(true);
      expect(await w.locator('#wand .instellen').getAttribute('href')).toBe('energie.html#auto');
      await wand.close();
      // In het menu licht Apparaten op; de weg terug gaat daarheen.
      expect(await p.locator('#tabs [aria-current="page"]').count()).toBe(1);
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-auto.png'), fullPage: true });
      // Bij Apparaten: de kaart van de auto, met de batterij ernaast; een tik op de auto opent zijn pagina.
      await p.goto(`${baseUrl}/apparaten.html#auto`);
      const autoKaart = p.locator('#tel [data-lading="auto"]');
      await expect.poll(() => autoKaart.getAttribute('href')).toBe('auto.html#tesla');
      await expect.poll(() => autoKaart.textContent()).toContain('Tesla Model 3');
      expect(await autoKaart.textContent()).toContain('Nog 280 km rijden.');
      expect(await p.locator('#tel [data-lading="batterij"]').textContent()).toContain('Levert aan het huis');
      await expect.poll(() => autoKaart.evaluate((el) => el.getBoundingClientRect().top < el.ownerDocument.documentElement.clientHeight && el.getBoundingClientRect().bottom > 0)).toBe(true);
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-apparaten-auto.png') });
      await p.goto(`${baseUrl}/thuis.html`);

      // Zonder auto en deurbel: die kaarten staan er niet, en worden niet aangeboden.
      extraOpslag = { batterij: extraOpslag!.batterij, auto: null, autos: [] };
      extraDeurbel = null;
      extraOprit = false;
      expect((await zet(STANDAARD_TEL)).ok).toBe(true);
      await p.reload();
      await p.locator('#tel [data-aanpassen]').click();
      await p.locator('#tel [data-kaart-erbij]').click();
      const blad = p.locator('[data-kiesblad]');
      await blad.locator('[data-erbij="batterij"]').waitFor();
      expect(await blad.locator('[data-erbij="maand"]').count()).toBe(1);
      expect(await blad.locator('[data-erbij="auto"]').count()).toBe(0);
      expect(await blad.locator('[data-erbij="deurbel"]').count()).toBe(0);
      expect(fouten).toEqual([]);
    } finally {
      extraOpslag = null;
      extraDeurbel = null;
      extraOprit = false;
      await zet(STANDAARD_TEL);
      await context.close();
    }
  }, 60_000);

  /*
   * Meldingen op je telefoon (besluit 183, schets Instellingen-Tel-Meldingen):
   * bij Jij, met de vier soorten, de telefoon, de nachtrust en een proefmelding.
   */
  it('kiest bij Jij welke meldingen naar je telefoon gaan (besluit 183)', async () => {
    const meldingen = async () => ((await (await fetch(`${baseUrl}/api/voorkeuren`)).json()) as { tel: { meldingen: Record<string, unknown> } }).tel.meldingen;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const bewonersWas = bewonersStore.current;
    await bewonersStore.save(voegToe(GEEN_BEWONERS, { userId: 'u', naam: 'Test' }, null, Date.now()));
    try {
      await p.goto(`${baseUrl}/jij.html`);
      const regel = p.locator('#tel a[href="jij.html#meldingen"]');
      await expect.poll(() => regel.textContent()).toContain('Naar Pixel 8');
      await regel.click();
      await p.locator('#tel h1', { hasText: 'Meldingen op je telefoon' }).waitFor();
      expect(await p.locator('#tel .terugje').textContent()).toBe('‹ Jij');
      // Standaard: rook en de regeling aan, de rest uit.
      const schakel = (k: string) => p.locator(`#tel [data-melding="${k}"]`);
      expect(await schakel('rook').getAttribute('aria-checked')).toBe('true');
      expect(await schakel('regeling').getAttribute('aria-checked')).toBe('true');
      expect(await schakel('onderhoud').getAttribute('aria-checked')).toBe('false');
      await schakel('onderhoud').click();
      await expect.poll(async () => (await meldingen())['onderhoud']).toBe(true);
      // Een andere telefoon, en een andere nachtrust.
      await p.locator('#tel [data-melding-telefoon]').selectOption('d-ipad');
      await expect.poll(async () => (await meldingen())['telefoon']).toBe('d-ipad');
      await p.locator('#tel [data-melding-tijd="van"]').fill('22:30');
      await expect.poll(async () => (await meldingen())['van']).toBe('22:30');
      // Een proefmelding.
      const voor = proefmeldingen.length;
      await p.locator('#tel [data-proef]').click();
      await expect.poll(() => p.locator('#tel [data-proef-zin]').textContent()).toBe('Verstuurd naar Pixel 8.');
      expect(proefmeldingen.length).toBe(voor + 1);
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-meldingen.png'), fullPage: true });
      expect(fouten).toEqual([]);
    } finally {
      await fetch(`${baseUrl}/api/voorkeuren`, { method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl }, body: JSON.stringify({ plek: 'tel', meldingen: { onderhoud: false, telefoon: null, van: '23:00' } }) });
      await bewonersStore.save(bewonersWas);
      await context.close();
    }
  }, 60_000);

  /*
   * De integratie neerzetten voor wie geen HACS heeft (besluit 184): een knop
   * bij Sleutel voor de assistent, en daarna "herstart Home Assistant".
   */
  it('zet de integratie in Home Assistant met een knop, voor wie geen HACS heeft (besluit 184)', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    integratieNu = { kan: true, staat: 'nee', versie: null, nieuw: VERSIE, oud: 'nee', geladen: null, toegevoegd: null };
    try {
      await p.goto(`${baseUrl}/toegang.html#assistent`);
      const knop = p.locator('#wand [data-integratie]');
      await knop.waitFor();
      // Geen YAML meer in de uitleg.
      expect(await p.locator('#wand [data-vorm]').textContent()).not.toMatch(/secrets\.yaml|rest_command|configuration\.yaml/);
      // Adres en sleutel ingeklapt (2 november 2026): met de add-on niet nodig.
      expect(await p.locator('#wand [data-sleutel]').isVisible()).toBe(false);
      await knop.click();
      await p.locator('#wand [data-vorm]', { hasText: 'neergezet door de add-on' }).waitFor();
      expect(await p.locator('#wand [data-vorm]').textContent()).toContain('Herstart Home Assistant');
      // Via HACS: de add-on blijft eraf.
      integratieNu = { kan: true, staat: 'anders', versie: VERSIE, nieuw: VERSIE, oud: 'nee', geladen: VERSIE, toegevoegd: false };
      await p.reload();
      await p.locator('#wand [data-vorm]', { hasText: 'via HACS' }).waitFor();
      expect(await p.locator('#wand [data-integratie]').count()).toBe(0);
      // Geladen maar nog niet toegevoegd (22 oktober 2026): zeg wat er nog moet.
      expect(await p.locator('#wand [data-vorm]').textContent()).toContain('Nog niet toegevoegd');
      // Toegevoegd: dan is de sleutel niet meer nodig en verdwijnt het deel (besluit 227).
      integratieNu = { ...integratieNu, toegevoegd: true };
      await p.reload();
      await p.locator('#wand [data-delen] .deel').first().waitFor();
      await expect.poll(() => p.locator('#wand [data-delen] .deel[href="#assistent"]').count()).toBe(0);
      expect(fouten).toEqual([]);
    } finally {
      integratieNu = { kan: true, staat: 'nee', versie: null, nieuw: VERSIE, oud: 'nee', geladen: null, toegevoegd: null };
      await context.close();
    }
  }, 60_000);

  /*
   * Apparaten in ontwerp 2 (besluit 104; schets Wand-Apparaten): de droger die
   * klaarstaat met "klaar voor" (besluit 101), de vaatwasser die gevonden is
   * maar niet op zon staat, en waar de stroom nu heen gaat.
   */
  for (const [stand, viewport] of [
    ['wand', { width: 1340, height: 800 }],
    ['telefoon', { width: 390, height: 844 }],
  ] as const) {
    it(`toont Apparaten van ontwerp 2 op de ${stand}`, async () => {
      const context = await browser.newContext({ viewport, timezoneId: 'UTC', locale: 'nl-NL' });
      await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
      await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
      const p = await context.newPage();
      const fouten: string[] = [];
      p.on('pageerror', (e) => fouten.push(e.message));
      await p.goto(`${baseUrl}/apparaten.html`);
      const z = stand === 'wand' ? '#wand' : '#tel';
      const droger = p.locator(`${z} .app`, { hasText: 'Droger' });
      await droger.waitFor();
      await p.locator(`${z} .app`, { hasText: 'Vaatwasser' }).filter({ hasText: 'Niet op zon' }).waitFor();
      await p.locator(`${z} [data-verdeling] h2`).waitFor();
      // Het nu (besluit 140): elk klimaatapparaat als kaart naar zijn kamer, en geen grafiek van de dag meer.
      const klimaatKaart = p.locator(`${z} a.app[href^="kamer.html#"]`);
      await klimaatKaart.first().waitFor();
      expect(await klimaatKaart.first().textContent()).toMatch(/Vandaag/);
      expect(await p.locator(`${z} [data-dag]`).count()).toBe(0);
      // De navigatie wijst Apparaten aan.
      expect(await p.locator(`${stand === 'wand' ? '#balk' : '#tabs'} [aria-current="page"]`).textContent()).toBe('Apparaten');
      if (stand === 'wand') {
        expect(await p.evaluate('document.scrollingElement.scrollHeight <= innerHeight && document.scrollingElement.scrollWidth <= innerWidth')).toBe(true);
        // Alles binnen de wand: de body scrolt niet, dus wat eronder valt is gewoon weg.
        const wand = await p.locator('#wand').boundingBox();
        const onder = await p.locator('#wand [data-verdeling]').boundingBox();
        expect(onder && wand && onder.y + onder.height <= wand.y + wand.height + 1).toBe(true);
      } else {
        expect(await p.evaluate('document.scrollingElement.scrollWidth <= innerWidth')).toBe(true);
      }
      // Uiterlijk klaar kiest de bewoner in het blad van de droger (besluit 238), en terug naar geen haast.
      const blad = p.locator('[data-hand] .hand-blad');
      await droger.click();
      await blad.locator('h2', { hasText: 'Droger' }).waitFor();
      expect(await blad.locator('.hand-tijd b').textContent()).toBe('Geen haast');
      await blad.locator('[data-wg-stap="1"]').click();
      expect(await blad.locator('.hand-tijd span').textContent()).toMatch(/uiterlijk om \d\d:\d\d/);
      await blad.locator('[data-wg-bewaar]').click();
      await expect.poll(() => Object.keys(uitstel.readyBy)).toEqual(['droger']);
      // Terug naar geen haast: de bovenste stap, en bewaren.
      await droger.click();
      await blad.locator('[data-wg-stap="1"]').waitFor();
      while (await blad.locator('[data-wg-stap="-1"]').isEnabled()) await blad.locator('[data-wg-stap="-1"]').click();
      expect(await blad.locator('.hand-tijd b').textContent()).toBe('Geen haast');
      await blad.locator('[data-wg-bewaar]').click();
      await expect.poll(() => uitstel.readyBy).toEqual({});
      expect(fouten).toEqual([]);
      await context.close();
    }, 30_000);
  }

  /*
   * De rondleiding (besluit 139, 144 en 217): dertien stops op de echte pagina's en
   * dan Klaar, de eerste keer vanzelf, daarna achter het vraagteken op Thuis.
   */
  it('loopt de rondleiding langs alle tabbladen en een kamer, en daarna achter het vraagteken', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const shot = async (naam: string) => {
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', `-${naam}.png`) });
    };
    await p.goto(`${baseUrl}/thuis.html`);
    const kaart = p.locator('.rl-kaart');
    const volgende = async (kop: string, naam: string) => {
      await kaart.filter({ hasText: kop }).waitFor({ timeout: 10_000 });
      await p.waitForTimeout(450);
      await shot(naam);
      await kaart.locator('[data-rl-volgende]').click();
    };
    await volgende('Dit is je huis', 'rl-1');
    await volgende('Tik op een kamer', 'rl-2');
    await p.waitForURL(/kamer\.html$/);
    await volgende('De kamer van dichtbij', 'rl-3');
    await p.waitForURL(/thuis\.html$/);
    await volgende('Hoe voelt het?', 'rl-4');
    await p.waitForURL(/vandaag\.html$/);
    await volgende('Wat er vandaag gebeurt', 'rl-5');
    await volgende('Gisteren en morgen', 'rl-6');
    await p.waitForURL(/tedoen\.html$/);
    await volgende('Wat er te doen is', 'rl-7');
    await p.waitForURL(/apparaten\.html$/);
    await volgende('Wat elk apparaat nu doet', 'rl-8');
    await p.waitForURL(/opbrengst\.html$/);
    await volgende('Wat je panelen opleverden', 'rl-9');
    await p.waitForURL(/assistent\.html$/);
    await volgende('Vraag het je huis', 'rl-10');
    await p.waitForURL(/thuis\.html$/);
    await volgende('De bel', 'rl-11');
    await p.waitForURL(/instellingen\.html$/);
    await volgende('Het tandwiel', 'rl-12');
    await p.waitForURL(/huis-kan\.html$/);
    await volgende('Hoe ver het huis is', 'rl-13');
    await p.waitForURL(/thuis\.html$/);
    await kaart.filter({ hasText: 'Klaar' }).locator('[data-rl-klaar]').waitFor();
    await shot('rl-klaar');
    await kaart.locator('[data-rl-klaar]').click();
    await kaart.waitFor({ state: 'detached' });
    expect(await p.evaluate('localStorage.getItem("sc-rondleiding-gezien")')).toBe('1');
    // Gezien: na herladen niet vanzelf, wel achter het vraagteken; Escape stopt.
    await p.reload();
    await p.locator('#wand [data-kop]').filter({ hasNotText: 'Even laden' }).waitFor();
    await p.waitForTimeout(900);
    expect(await kaart.count()).toBe(0);
    await p.locator('#wand [data-uitleg]').click();
    await kaart.filter({ hasText: 'Dit is je huis' }).waitFor();
    await p.keyboard.press('Escape');
    await kaart.waitFor({ state: 'detached' });
    // Op de telefoon: de kaart over de breedte, binnen het scherm.
    await p.setViewportSize({ width: 390, height: 844 });
    await p.locator('#tel [data-uitleg]').click();
    await kaart.filter({ hasText: 'Dit is je huis' }).waitFor();
    await volgende('Dit is je huis', 'rl-tel-1');
    await kaart.filter({ hasText: 'Tik op een kamer' }).waitFor();
    const vak = (await kaart.boundingBox())!;
    expect(vak.x).toBeGreaterThanOrEqual(0);
    expect(vak.x + vak.width).toBeLessThanOrEqual(390);
    await p.waitForTimeout(450);
    await shot('rl-tel-2');
    expect(fouten).toEqual([]);
    await context.close();
  }, 60_000);

  /*
   * Vandaag in ontwerp 2 (schetsen Wand-Vandaag en Vandaag): de tijdlijn, wat
   * er gebeurde en wat er verwacht wordt, en wisselen naar gisteren en morgen.
   */
  for (const [stand, viewport] of [
    ['wand', { width: 1340, height: 800 }],
    ['telefoon', { width: 390, height: 844 }],
  ] as const) {
    it(`toont Vandaag van ontwerp 2 op de ${stand}, ook gisteren en morgen`, async () => {
      const context = await browser.newContext({ viewport, timezoneId: 'UTC', locale: 'nl-NL' });
      await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
      const p = await context.newPage();
      const fouten: string[] = [];
      p.on('pageerror', (e) => fouten.push(e.message));
      await p.goto(`${baseUrl}/vandaag.html`);
      const z = stand === 'wand' ? '#wand' : '#tel';
      if (stand === 'wand') {
        await p.locator('#wand [data-tijdlijn] svg').waitFor();
        await p.locator('#wand [data-momentkaart] h2').waitFor();
        expect(await p.evaluate('document.scrollingElement.scrollHeight <= innerHeight')).toBe(true);
        const onder = await p.locator('#wand .kaarten').boundingBox();
        const wand = await p.locator('#wand').boundingBox();
        expect(onder && wand && onder.y + onder.height <= wand.y + wand.height + 1).toBe(true);
      } else {
        await p.locator('#tel [data-zonkaart] svg').waitFor();
      }
      // Verwacht naast echt (besluit 137): het getal van vandaag, en bij gisteren hoe het klopte.
      if (stand === 'wand') expect(await p.locator('#wand [data-tijdlijn] svg').textContent()).toContain('tot nu toe');
      await p.locator(`${z} [data-dag="gisteren"]`).click();
      await p.locator(`${z} h1`, { hasText: 'Gisteren' }).waitFor();
      await p.locator(stand === 'wand' ? '#wand [data-verwacht]' : '#tel [data-klopte]', { hasText: 'Zo klopte de verwachting' }).waitFor();
      await p.locator(`${z} [data-dag="morgen"]`).click();
      await p.locator(`${z} h1`, { hasText: 'Morgen' }).waitFor();
      expect(await p.locator(`${stand === 'wand' ? '#balk' : '#tabs'} [aria-current="page"]`).textContent()).toBe('Vandaag');
      expect(fouten).toEqual([]);
      await context.close();
    }, 20_000);
  }

  /*
   * Opbrengst in ontwerp 2 (schetsen Wand-Opbrengst en Opbrengst): de cijfers,
   * of de weg naar de meters, en wisselen van periode.
   */
  it('toont Opbrengst van ontwerp 2, en wisselt van periode', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/opbrengst.html`);
    await p.locator('#wand [data-titel]').filter({ hasNotText: 'Even laden' }).waitFor();
    expect(await p.evaluate('document.scrollingElement.scrollHeight <= innerHeight')).toBe(true);
    await p.locator('#wand [data-soort="jaar"]').click();
    await p.locator('#wand [data-soort="jaar"][aria-pressed="true"]').waitFor();
    // Vergelijken, en een tik op een staaf zegt wat erin zit.
    const vergelijk = p.locator('#wand [data-blik="vergelijk"]');
    if (await vergelijk.count()) {
      await vergelijk.click();
      await p.locator('#wand [data-blik="vergelijk"][aria-pressed="true"]').waitFor();
      await p.locator('#wand [data-staaf]').first().click();
      await p.locator('#wand .detail').filter({ hasNotText: 'Tik op een staaf' }).waitFor();
    }
    expect(await p.locator('#balk [aria-current="page"]').textContent()).toBe('Opbrengst');
    expect(fouten).toEqual([]);
    await context.close();
  }, 20_000);

  /*
   * De assistent in ontwerp 2 (schets Wand-Assistent): een vraag uit het adres
   * wordt meteen gesteld, en de knoppen stellen een volgende.
   */
  it('stelt de vraag uit het adres meteen, praat, en vraagt of het nog iets kan doen (besluit 141)', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const shot = async (naam: string) => {
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', `-${naam}.png`) });
    };
    // Het begin: een begroeting en vragen die nu ergens over gaan.
    await p.goto(`${baseUrl}/assistent.html`);
    await p.locator('#wand [data-zegt]', { hasText: /Waarmee kan ik je helpen\?|Wat kan ik voor je doen\?|Zeg het maar\./ }).waitFor({ timeout: 10_000 });
    await p.locator('#wand [data-sug]').first().waitFor();
    expect(await p.locator('#wand [data-sug]').count()).toBeGreaterThanOrEqual(3);
    expect(await p.locator('#wand [data-suggesties]').textContent()).not.toMatch(/de beneden|de Beneden/);
    await shot('as-begin');
    // Een vraag uit het adres: hij praat, met de woorden die meekomen; Stop maakt het af.
    await p.goto(`${baseUrl}/assistent.html#nu`);
    await p.locator('#wand .jij', { hasText: 'Wat doe je nu?' }).waitFor({ timeout: 10_000 });
    await p.locator('body[data-stand="praat"]').waitFor();
    await shot('as-praat');
    await p.locator('#wand [data-stop]').click();
    await p.locator('#wand .klein-zegt', { hasText: 'Kan ik je nog ergens mee helpen?' }).waitFor();
    // Een vervolgvraag, en dan "Nee, dank je".
    await p.locator('#wand [data-sug]').first().click();
    await p.locator('body[data-stand="praat"]').waitFor();
    await p.locator('#wand [data-stop]').click();
    await p.locator('#wand [data-eerder]', { hasText: 'Wat doe je nu?' }).waitFor();
    // Geen ruwe codes bij de feiten.
    expect(((await p.locator('#wand .feiten').textContent().catch(() => '')) ?? '').replace(/kWh|kW/g, '')).not.toMatch(/[a-z][A-Z]|_/);
    await shot('as-verder');
    await p.locator('#wand [data-nee]').click();
    await p.locator('#wand [data-zegt]', { hasText: /als je me nodig hebt|als er iets is/ }).waitFor();
    expect(await p.evaluate('document.scrollingElement.scrollHeight <= innerHeight')).toBe(true);
    expect(fouten).toEqual([]);
    await context.close();
  }, 40_000);

  /* Een vraag in eigen woorden (besluit 115): over de app komt er een knop bij. */
  /*
   * De inrichting van een kamer (besluit 119): elke soort, in drie breedtes,
   * met en zonder apparaten, op een gewone etage en onder het dak. De tekening
   * geeft met `controle` elk meubel en apparaat als blok; geen meubel mag door
   * een apparaat, een ander meubel, een muur of het dak.
   */
  it('laat de zon ook van de garage stromen als er op het huis en de garage panelen liggen (issue 151)', async () => {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/manifest.webmanifest`);
    await p.setContent(`<!doctype html><body><script src="${baseUrl}/kit/iconen.js"></script><script src="${baseUrl}/kit/huis.js"></script></body>`);
    await p.waitForFunction('window.huis != null');
    const telling = await p.evaluate(() => {
      const w = globalThis as unknown as { huis: { svg: (m: unknown, o: unknown) => string } };
      const etages = [{ naam: 'bg', kamers: [{ id: 'w', naam: 'Woonkamer', gewicht: 1, inrichting: 'woonkamer', apparaten: [] }] }, { naam: 'dak', dak: true, kamers: [] }];
      const tel = (zon: Record<string, number>, garage: Record<string, unknown>) => {
        const svg = w.huis.svg({ tijd: 'dag', etages, zon: { aandeel: 0.8, ...zon }, garage, stromen: [{ van: 'zon', naar: 'huis', sterkte: 0.8 }] }, { breedte: 700, hoogte: 520 });
        return (svg.match(/class="sc-stroom"/g) ?? []).length;
      };
      return {
        allebei: tel({ panelen: 8 }, { panelen: 6 }),
        achterEnGarage: tel({ panelen: 0, panelenLinks: 8 }, { panelen: 6 }),
        alleenHuis: tel({ panelen: 8 }, {}),
        alleenGarage: tel({ panelen: 0 }, { panelen: 6 }),
      };
    });
    await context.close();
    expect(fouten).toEqual([]);
    expect(telling).toEqual({ allebei: 2, achterEnGarage: 2, alleenHuis: 1, alleenGarage: 1 });
  });

  it('richt elke soort kamer in zonder dat een meubel ergens doorheen steekt', async () => {
    const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/manifest.webmanifest`);
    await p.setContent(`<!doctype html><body style="margin:0;background:#0b1424"><div id="uit" style="display:grid;grid-template-columns:repeat(2,700px)"></div><script src="${baseUrl}/kit/iconen.js"></script><script src="${baseUrl}/kit/huis.js"></script></body>`);
    await p.waitForFunction('window.huis != null');
    type Blok = { kamer?: string; wat: string; soort?: string; x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; ruimte: [number, number]; plafond?: number };
    const uitkomst = await p.evaluate(() => {
      const w = globalThis as unknown as { huis: { svg: (m: unknown, o: unknown) => string }; document: { getElementById: (id: string) => { innerHTML: string } } };
      const soorten = ['woonkamer', 'woonkeuken', 'keuken', 'eetkamer', 'slaapkamer', 'kinderkamer', 'logeerkamer', 'badkamer', 'toilet', 'hal', 'werkkamer', 'wasruimte', 'berging', 'leeg'];
      const apparaten = [
        [],
        [{ soort: 'radiator', aan: false }, { soort: 'lamp', aan: true, x: 0.35 }],
        [{ soort: 'airco', aan: true, naam: 'a' }, { soort: 'lamp', aan: false, x: 0.35 }, { soort: 'lamp', aan: false, x: 0.72 }],
        [{ soort: 'cv', aan: true }, { soort: 'radiator', aan: true }],
      ];
      const kamer = (soort: string, i: number, gewicht: number, apps: unknown[]) => ({ id: `${soort}-${i}`, naam: soort, gewicht, inrichting: soort, temp: '20,0°', apparaten: apps });
      const per: Record<string, unknown[]> = {};
      const html: string[] = [];
      for (const soort of soorten) {
        const model = {
          tijd: 'dag',
          etages: [
            { naam: 'bg', kamers: [kamer(soort, 0, 0.55, apparaten[0]!), kamer(soort, 1, 1.0, apparaten[1]!), kamer(soort, 2, 1.4, apparaten[2]!)] },
            { naam: 'e1', kamers: [kamer(soort, 3, 1.4, apparaten[3]!), kamer(soort, 4, 0.8, [{ soort: 'droger', aan: true }])] },
            // Ook een zolderkamer tegen de buitenmuur met een radiator (21 oktober 2026).
            { naam: 'dak', dak: true, kamers: [kamer(soort, 7, 0.8, apparaten[1]!), kamer(soort, 5, 1, apparaten[2]!), kamer(soort, 6, 1, apparaten[1]!)] },
          ],
        };
        const svg = w.huis.svg(model, { breedte: 700, hoogte: 520, meubels: true, controle: true });
        html.push(svg);
        const desc = /<desc class="sc-controle">(.*?)<\/desc>/s.exec(svg)?.[1] ?? '[]';
        per[soort] = JSON.parse(desc.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
      }
      // Eén verdieping zonder dak erboven: een hal zonder trap.
      const plat = w.huis.svg({ tijd: 'dag', zonderDak: true, etages: [{ naam: 'bg', kamers: [kamer('hal', 9, 1, [])] }] }, { breedte: 700, hoogte: 520, meubels: true, controle: true });
      const vlak = JSON.parse((/<desc class="sc-controle">(.*?)<\/desc>/s.exec(plat)?.[1] ?? '[]').replace(/&quot;/g, '"'));
      // Ingezoomd op één etage zegt de pagina zelf dat er een etage boven is.
      const los = w.huis.svg({ tijd: 'dag', zonderDak: true, etages: [{ naam: 'bg', erBoven: true, kamers: [kamer('hal', 8, 1, [])] }] }, { breedte: 700, hoogte: 520, meubels: true, controle: true });
      const metTrap = JSON.parse((/<desc class="sc-controle">(.*?)<\/desc>/s.exec(los)?.[1] ?? '[]').replace(/&quot;/g, '"'));
      w.document.getElementById('uit').innerHTML = html.map((x) => `<div style="width:700px;height:520px">${x}</div>`).join('');
      return { per, vlak, metTrap };
    });
    const overlap = (a: Blok, b: Blok, marge = 0.01) =>
      a.x0 < b.x1 - marge && b.x0 < a.x1 - marge && a.y0 < b.y1 - marge && b.y0 < a.y1 - marge && a.z0 < b.z1 - marge && b.z0 < a.z1 - marge;
    const problemen: string[] = [];
    for (const [soort, lijst] of Object.entries(uitkomst.per) as [string, Blok[]][]) {
      const meubels = lijst.filter((b) => b.wat === 'meubel');
      const apps = lijst.filter((b) => b.wat === 'apparaat');
      if (soort !== 'leeg' && meubels.length === 0) problemen.push(`${soort}: geen enkel meubel`);
      if (soort === 'leeg' && meubels.length > 0) problemen.push('leeg: toch meubels');
      for (const m of meubels) {
        const naam = `${m.kamer} (${m.x0.toFixed(2)}–${m.x1.toFixed(2)})`;
        if (m.x0 < m.ruimte[0] - 1e-6 || m.x1 > m.ruimte[1] + 1e-6) problemen.push(`${naam}: door de zijmuur`);
        if (m.y0 < -1e-6 || m.y1 > 1.5 + 1e-6) problemen.push(`${naam}: buiten de kamer`);
        if (m.plafond != null && m.z1 > m.plafond + 1e-6) problemen.push(`${naam}: door het plafond of dak`);
        for (const a of apps) {
          // Een trap mag onder een hanglamp door: die hangt in het trapgat.
          if (a.kamer !== m.kamer || (a.soort === 'lamp' && soort === 'hal')) continue;
          if (overlap(m, a)) problemen.push(`${naam}: door ${a.soort}`);
        }
        for (const n of meubels) if (n !== m && n.kamer === m.kamer && overlap(m, n) && m.x0 <= n.x0) problemen.push(`${naam}: door een ander meubel`);
      }
    }
    // Een radiator onder het dak steekt er niet doorheen (21 oktober 2026).
    for (const [soort, lijst] of Object.entries(uitkomst.per) as [string, Blok[]][]) {
      for (const a of lijst.filter((b) => b.wat === 'apparaat' && b.soort === 'radiator' && b.plafond != null)) {
        if (a.z1 > a.plafond! + 1e-6) problemen.push(`${soort}: de radiator in ${a.kamer} steekt door het dak`);
      }
    }
    // Een airco hangt nooit voor het raam (besluit 131).
    for (const [soort, lijst] of Object.entries(uitkomst.per) as [string, Blok[]][]) {
      for (const a of lijst.filter((b) => b.wat === 'apparaat' && b.soort === 'airco')) {
        for (const r of lijst.filter((b) => b.wat === 'raam' && b.kamer === a.kamer)) {
          if (a.y0 < 0.3 && a.x0 < r.x1 && r.x0 < a.x1 && a.z0 < r.z1 && r.z0 < a.z1) problemen.push(`${soort}: de airco in ${a.kamer} hangt voor het raam`);
        }
      }
    }
    expect(problemen).toEqual([]);
    // Witgoed maakt een wasruimte; een hal zonder etage erboven heeft geen trap.
    expect((uitkomst.per['slaapkamer'] as Blok[]).some((b) => b.kamer === 'slaapkamer-4' && b.wat === 'meubel' && b.x1 - b.x0 > 0.5)).toBe(false);
    expect((uitkomst.vlak as Blok[]).filter((b) => b.wat === 'meubel')).toEqual([]);
    expect((uitkomst.metTrap as Blok[]).filter((b) => b.wat === 'meubel').length).toBeGreaterThan(0);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT, fullPage: true });
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /* Een open keuken met zones (22 oktober 2026): de keuken staat onder de zone die Keuken heet, ook rechts. */
  it('zet bij een open keuken de keuken onder de zone Keuken en de zithoek onder de andere', async () => {
    const p = await browser.newPage();
    await p.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    await p.goto(`${baseUrl}/manifest.webmanifest`);
    await p.setContent(`<!doctype html><body><script src="${baseUrl}/kit/iconen.js"></script><script src="${baseUrl}/kit/huis.js"></script></body>`);
    await p.waitForFunction('window.huis != null');
    const midden = await p.evaluate(() => {
      const w = globalThis as unknown as { huis: { svg: (m: unknown, o: unknown) => string } };
      return [['Zithoek', 'Keuken'], ['Keuken', 'Zithoek']].map((zones) => {
        const svg = w.huis.svg({ tijd: 'dag', etages: [{ naam: 'bg', kamers: [{ id: 'beneden', naam: 'Beneden', gewicht: 1.4, inrichting: 'woonkeuken', zones, apparaten: [] }] }] }, { breedte: 700, hoogte: 520, meubels: true, controle: true });
        const blokken = JSON.parse((/<desc class="sc-controle">(.*?)<\/desc>/s.exec(svg)?.[1] ?? '[]').replace(/&quot;/g, '"')) as { wat: string; deel?: string; x0: number; x1: number }[];
        const van = (deel: string) => {
          const m = blokken.filter((b) => b.wat === 'meubel' && b.deel === deel);
          return m.reduce((s, b) => s + (b.x0 + b.x1) / 2, 0) / m.length;
        };
        return { keuken: van('keuken'), zithoek: van('woonkamer') };
      });
    });
    expect(midden[0]!.keuken).toBeGreaterThan(midden[0]!.zithoek);
    expect(midden[1]!.keuken).toBeLessThan(midden[1]!.zithoek);
    await p.close();
  });

  it('beantwoordt een getypte vraag, met een knop naar de pagina', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/assistent.html#typ`);
    const veld = p.locator('#wand [data-vrij] input');
    await expect.poll(() => p.evaluate('document.activeElement?.closest("#wand [data-vrij]") != null')).toBe(true);
    await veld.fill('Waar vul ik de prijzen in?');
    await veld.press('Enter');
    await p.locator('#wand .jij', { hasText: 'Waar vul ik de prijzen in?' }).waitFor();
    await p.locator('#wand [data-stop]').click();
    const knop = p.locator('#wand .verder a', { hasText: 'Naar Contract en prijzen' });
    await knop.waitFor();
    expect(await knop.getAttribute('href')).toBe('energie.html#prijzen');
    expect(await veld.inputValue()).toBe('');
    // Niets herkend: voorbeelden om op te tikken.
    await veld.fill('banaan');
    await veld.press('Enter');
    await p.locator('#wand [data-stop]').click();
    await p.locator('#wand [data-sug]', { hasText: 'Waar vul ik de prijzen in?' }).click();
    await p.locator('#wand [data-stop]').click();
    await p.locator('#wand .verder a', { hasText: 'Naar Contract en prijzen' }).waitFor();
    expect(await p.evaluate('document.scrollingElement.scrollHeight <= innerHeight')).toBe(true);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT });
    expect(fouten).toEqual([]);
    await context.close();
  }, 20_000);

  /*
   * Instellingen en Wat je huis kan (schetsen Instellingen, Wand-Leren en
   * Wand-Huis-groeit): wie stuurt, wat het huis weet, en de stappen.
   */
  /*
   * De zon op zijn boog (16 oktober 2026): ook als de tekening laag is en de
   * boog omlaag moet, staat de zon op de stippellijn, bij elke stand.
   */
  it('zet de zon in de tekening altijd op zijn boog', async () => {
    const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await p.goto(`${baseUrl}/thuis.html`);
    await p.waitForFunction('window.huis != null');
    const afwijkingen = await p.evaluate<number[]>(`(() => {
      const uit = [];
      const doos = document.createElement('div');
      document.body.append(doos);
      const etages = [{ naam: 'Begane grond', kamers: [{ naam: 'Woonkamer', apparaten: [] }] }, { dak: true, kamers: [{ naam: 'Zolder', apparaten: [] }] }];
      for (const hoogte of [612, 420, 300, 220]) {
        for (const stand of [0.05, 0.2, 0.5, 0.8, 0.95]) {
          huis.teken(doos, { tijd: 'dag', zon: { stand, hoogte: 0.6, aandeel: 0.5, panelen: 8 }, etages, net: true, labels: [] }, { breedte: 860, hoogte });
          const [x0, y0, rx, ry, , , , x1] = doos.querySelector('path[stroke-dasharray="2 7"]').getAttribute('d').match(/-?[0-9.]+/g).map(Number);
          const zon = doos.querySelector('circle[fill="#FFD27A"]');
          const sx = Number(zon.getAttribute('cx'));
          const sy = Number(zon.getAttribute('cy'));
          uit.push(Math.abs(((sx - (x0 + x1) / 2) / rx) ** 2 + ((sy - y0) / ry) ** 2 - 1));
        }
      }
      return uit;
    })()`);
    await p.close();
    expect(Math.max(...afwijkingen)).toBeLessThan(0.01);
  });

  /*
   * Vegen op de tablet (16 oktober 2026): elke lijst die kan schuiven, schuift
   * met de vinger, ook als de vinger op een regel landt die je kunt slepen. Een
   * echte veeg via Chrome zelf, op elke pagina van de wand.
   */
  it('laat op de tablet elke schuivende lijst met de vinger schuiven', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, isMobile: true, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const cdp = await context.newCDPSession(p);
    const huisNu = (await (await fetch(`${baseUrl}/api/huis`)).json()) as { etages: { ruimtes: { id: string; apparaten: unknown[] }[] }[] };
    const vol = huisNu.etages.flatMap((e) => e.ruimtes).sort((x, y) => y.apparaten.length - x.apparaten.length)[0]!;
    const paginas = ['thuis.html', 'vandaag.html', 'apparaten.html', 'opbrengst.html', `kamer.html#${encodeURIComponent(vol.id)}`, `indeling.html#${encodeURIComponent(vol.id)}`, 'instellingen.html', 'comfort.html', 'energie.html', 'functies.html', 'regeling.html', 'huis-kan.html', 'klaarzetten.html', 'voortgang.html', 'toegang.html', 'inrichten.html#warmte'];
    const vast: string[] = [];
    let geveegd = 0;
    for (const pagina of paginas) {
      await p.goto(`${baseUrl}/${pagina}`);
      // Een open stroom houdt het netwerk nooit stil: gewoon even laten tekenen.
      await p.waitForTimeout(1500);
      // Alles wat kan schuiven en meer inhoud heeft dan past, met een punt erop dat zichtbaar is.
      const lijsten = await p.evaluate<{ sel: string; x: number; y: number }[]>(`(() => {
        const uit = [];
        document.querySelectorAll('#wand *').forEach((el, i) => {
          const st = getComputedStyle(el);
          if (!/(auto|scroll)/.test(st.overflowY) || el.scrollHeight <= el.clientHeight + 24) return;
          const r = el.getBoundingClientRect();
          if (r.width < 60 || r.height < 80) return;
          const x = r.left + r.width / 2;
          const y = r.top + Math.min(r.height * 0.6, r.height - 30);
          const raak = document.elementFromPoint(x, y);
          if (!raak || !el.contains(raak)) return;
          el.dataset.veegtest = String(i);
          uit.push({ sel: '[data-veegtest="' + i + '"]', x, y });
        });
        return uit;
      })()`);
      for (const l of lijsten) {
        const voor = await p.locator(l.sel).evaluate((el) => el.scrollTop);
        // Vinger neer, omhoog vegen, los: zoals op het scherm zelf.
        const x = Math.round(l.x);
        const y = Math.round(l.y);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 14 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await p.waitForTimeout(250);
        // Tekent de pagina tijdens het vegen opnieuw, dan is de lijst weg: dat telt ook als vast.
        const na = await p.locator(l.sel).evaluate((el) => el.scrollTop, undefined, { timeout: 2_000 }).catch(() => -1);
        geveegd++;
        if (na <= voor) vast.push(`${pagina}: ${l.sel}`);
      }
    }
    // En slepen met de vinger blijft werken: een apparaat zijwaarts naar een andere kamer.
    await p.goto(`${baseUrl}/indeling.html#${encodeURIComponent(vol.id)}`);
    await p.waitForTimeout(1500);
    const rij = p.locator('#wand [data-blad] .app').first();
    await rij.scrollIntoViewIfNeeded();
    await p.waitForTimeout(300);
    const appId = (await rij.getAttribute('data-app'))!;
    const andere = p.locator(`#wand .sc-tik[data-kamer]:not([data-kamer="${vol.id}"]):not([data-kamer="__nieuw"])`).first();
    const naarKamer = (await andere.getAttribute('data-kamer'))!;
    const van = (await rij.boundingBox())!;
    const naar = (await andere.boundingBox())!;
    const [x0, y0] = [Math.round(van.x + 30), Math.round(van.y + van.height / 2)];
    const [x1, y1] = [Math.round(naar.x + naar.width / 2), Math.round(naar.y + naar.height / 2)];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= 16; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(x0 + ((x1 - x0) * i) / 16), y: Math.round(y0 + ((y1 - y0) * Math.max(0, i - 4)) / 12) }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => layoutStore.current?.apparaten[appId]?.kamer, { timeout: 5000 }).toBe(naarKamer);
    await p.locator('#wand [data-ongedaan]').click({ timeout: 5000 });
    await expect.poll(() => layoutStore.current?.apparaten[appId]?.kamer ?? vol.id, { timeout: 5000 }).toBe(vol.id);
    await context.close();
    expect(geveegd).toBeGreaterThan(0);
    expect(vast).toEqual([]);
  }, 90_000);

  /*
   * Vegen op de telefoon (18 oktober 2026): waar je de vinger ook neerzet, de
   * pagina schuift mee. In Inrichten hield een lijst met een eigen schuifvak de
   * vinger vast, zodat alleen vegen naast de kaart werkte.
   */
  it('laat op de telefoon elke pagina schuiven, waar je de vinger ook neerzet', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const cdp = await context.newCDPSession(p);
    const huisNu = (await (await fetch(`${baseUrl}/api/huis`)).json()) as { etages: { ruimtes: { id: string; apparaten: unknown[] }[] }[] };
    const vol = huisNu.etages.flatMap((e) => e.ruimtes).sort((x, y) => y.apparaten.length - x.apparaten.length)[0]!;
    const paginas = ['thuis.html', 'vandaag.html', 'apparaten.html', 'opbrengst.html', 'assistent.html', `kamer.html#${encodeURIComponent(vol.id)}`, `indeling.html#${encodeURIComponent(vol.id)}`, 'instellingen.html', 'comfort.html', 'energie.html', 'functies.html', 'regeling.html', 'huis-kan.html', 'klaarzetten.html', 'voortgang.html', 'toegang.html', 'bewoners.html', 'inrichten.html#warmte', 'inrichten.html#welkom'];
    const vast: string[] = [];
    let geveegd = 0;
    for (const pagina of paginas) {
      await p.goto(`${baseUrl}/${pagina}`);
      await p.waitForTimeout(1500);
      // In Inrichten de lijst met alle apparaten: die was het langst.
      if (pagina === 'inrichten.html#welkom') {
        await p.locator('#tel [data-welkom] [data-lijst="apparaten"]').click();
        await p.waitForTimeout(500);
      }
      if (!(await p.evaluate<boolean>('document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight + 120'))) continue;
      for (const deel of [0.3, 0.5, 0.7]) {
        // Een punt op de inhoud, niet op de tabs onderin en niet op iets dat je zelf trekt (een schuif, het kleurwiel).
        const punt = await p.evaluate<{ x: number; y: number; wat: string } | null>(`(() => {
          document.scrollingElement.scrollTop = 0;
          document.querySelectorAll('[data-veegketen]').forEach((el) => el.removeAttribute('data-veegketen'));
          const x = Math.round(innerWidth / 2), y = Math.round(innerHeight * ${deel});
          const raak = document.elementFromPoint(x, y);
          if (!raak || !raak.closest('#tel') || raak.closest('.tabs')) return null;
          // Ook niet op een apparaat in de bak van Indeling: dat sleep je omhoog naar een kamer (alleen opzij schuift de bak, pan-x).
          for (let el = raak; el; el = el.parentElement) if (getComputedStyle(el).touchAction === 'none' || getComputedStyle(el).touchAction === 'pan-x') return null;
          // Alles waarin de vinger landt: één daarvan moet schuiven.
          for (let el = raak; el; el = el.parentElement) el.setAttribute('data-veegketen', '');
          const wat = [];
          for (let el = raak; el && el !== document.body; el = el.parentElement) wat.unshift(el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : ''));
return { x, y, wat: wat.slice(-3).join(' > ') };
        })()`);
        if (!punt) continue;
        // Een vorige veeg kan nog uitlopen: eerst stil bovenaan.
        await expect
          .poll(async () => {
            const nu = await p.evaluate<number>('document.scrollingElement.scrollTop');
            await p.evaluate('document.scrollingElement.scrollTop = 0');
            await p.waitForTimeout(150);
            return nu === 0 && (await p.evaluate<number>('document.scrollingElement.scrollTop')) === 0;
          }, { timeout: 5000 })
          .toBe(true);
        const stand = () => p.evaluate<number>("Math.max(...[...document.querySelectorAll('[data-veegketen]')].map((el) => el.scrollTop))");
        const voor = await stand();
        // Staat de pagina al onderaan (een gesprek blijft bij het laatste), dan de andere kant op.
        const omlaag = voor > 0 && (await p.evaluate<boolean>('document.scrollingElement.scrollTop >= document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight - 10'));
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: punt.x, y: punt.y }] });
        for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: punt.x, y: punt.y + (omlaag ? i : -i) * 14 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await p.waitForTimeout(250);
        const na = await stand();
        geveegd++;
        if (na === voor) vast.push(`${pagina} op ${Math.round(deel * 100)}%: ${punt.wat}`);
      }
    }
    await context.close();
    expect(geveegd).toBeGreaterThan(5);
    expect(vast).toEqual([]);
  }, 120_000);

  it('toont Instellingen in acht tegels, met Inrichten, en daarvandaan Wat je huis kan (besluit 130 en 217)', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/instellingen.html`);
    await p.locator('#wand [data-groepen] .tegel').first().waitFor();
    expect(await p.locator('#wand [data-groepen] .tegel h3').allTextContents()).toEqual(['Je huis', 'Comfort', 'Energie', 'Regeling', 'Functies', 'Assistent', 'Bewoners en toegang', 'Inrichten']);
    expect(await p.locator('#balk [aria-current="page"]').getAttribute('aria-label')).toBe('Instellingen');
    expect(await p.evaluate('document.scrollingElement.scrollHeight <= innerHeight')).toBe(true);
    // Zoeken: "zekering" vindt de aansluiting bij Energie.
    await p.locator('#wand [data-zoek]').fill('zekering');
    await p.locator('#wand [data-gevonden] a', { hasText: 'Hoofdzekering' }).waitFor();
    expect(await p.locator('#wand [data-gevonden] a').first().getAttribute('href')).toBe('energie.html#aansluiting');
    // Meervoud, een hoofdletter, en ook wat niet in de vaste lijst staat: een kamer van dit huis (besluit 132).
    await p.locator('#wand [data-zoek]').fill('Batterijen');
    await p.locator('#wand [data-gevonden] a', { hasText: 'Batterijen en filters' }).waitFor();
    const eenKamer = (((await (await fetch(`${baseUrl}/api/huis`)).json()) as HouseReport).etages[0]?.ruimtes[0]?.naam) ?? '';
    await p.locator('#wand [data-zoek]').fill(eenKamer.toLowerCase());
    await p.locator('#wand [data-gevonden] a', { hasText: eenKamer }).first().waitFor();
    await p.locator('#wand [data-zoek]').press('Escape');
    await p.locator('#wand a.kan').click();
    await p.locator('#wand h1', { hasText: 'Wat je huis kan' }).waitFor();
    await p.locator('#wand svg.sc-huis').first().waitFor();
    // Zes groepen (besluit 187): wat het huis eerst leert apart, en de kosten ook.
    expect(await p.locator('#wand [data-vakken] .vak h3').allTextContents()).toEqual(['Comfort', 'Wat het huis eerst leert', 'Op zon', 'Kosten', 'Gemak', 'Overzicht']);
    // Een tik opent het blad, met wat het is en wanneer het werkt.
    await p.locator('#wand [data-vakken] .regel', { hasText: 'Thuisbatterij' }).click();
    await p.locator('#wand [data-blad]', { hasText: 'Wanneer het werkt' }).waitFor();
    await p.locator('#wand [data-blad] [data-sluit]').click();
    await expect.poll(() => p.locator('#wand [data-blad]').isHidden()).toBe(true);
    // Klaarzetten in Home Assistant (besluit 179): de knop zegt wat er mist, en opent de lijst per groep.
    const lijstMist = async () => ((await (await fetch(`${baseUrl}/api/klaarzetten`, { headers: { cookie: `hems_sessie=${sessionId}` } })).json()) as { punten: { stand: string }[] }).punten.filter((x) => x.stand === 'mist').length;
    const knop = p.locator('#wand [data-klaarknop] button');
    const mist = await lijstMist();
    expect(await knop.textContent()).toContain(`${mist} mist`);
    await knop.click();
    const lijst = p.locator('#wand [data-blad]');
    await lijst.locator('h2', { hasText: 'Klaarzetten in Home Assistant' }).waitFor();
    expect(await lijst.locator('.klaargroep h4').allTextContents()).toEqual(['De basis', 'Klimaat', 'Zon en energie', 'Bewoners', 'Gemak', 'Praten met je huis', 'De wand en je telefoon']);
    expect(await lijst.locator('.klaarregel.mist').count()).toBe(mist);
    expect(await lijst.locator('.klaarregel.mist').first().textContent()).toContain('Locatie en tijdzone');
    // Buiten Home Assistant staat erbij waar het is, zonder knop.
    expect(await lijst.locator('.klaarregel.mist small').first().textContent()).toBe('Instellingen › Systeem › Algemeen');
    expect(await lijst.locator('[data-ha-pad]').count()).toBe(0);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-klaarzetten.png') });
    await lijst.locator('[data-sluit]').click();
    expect(await p.evaluate('document.scrollingElement.scrollHeight <= innerHeight')).toBe(true);
    expect(fouten).toEqual([]);
    await context.close();
  }, 20_000);

  /*
   * Geen twee beelden met dezelfde naam voor een kleurverloop, masker of
   * patroon (2 november 2026): een pagina tekent veel op de wand én op de
   * telefoon, en met dezelfde naam pakte de telefoon het verloop uit het
   * verborgen wanddeel. Dan viel het stil weg, zoals de boog op Te doen.
   */
  it('geeft elk kleurverloop, masker en patroon een eigen naam', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const dubbel: string[] = [];
    for (const pagina of ['thuis.html', 'vandaag.html', 'tedoen.html', 'apparaten.html', 'opbrengst.html', 'instellingen.html', 'huis-kan.html', 'voortgang.html', 'klaarzetten.html', 'gepland.html']) {
      await p.goto(`${baseUrl}/${pagina}`);
      await p.waitForTimeout(1200);
      const namen = await p.evaluate<string[]>("[...document.querySelectorAll('svg :is(linearGradient, radialGradient, clipPath, mask, pattern, filter)[id]')].map((e) => e.id)");
      const gezien = new Set<string>();
      for (const n of namen) (gezien.has(n) ? dubbel.push(`${pagina}: ${n}`) : gezien.add(n));
    }
    expect(dubbel).toEqual([]);
    await context.close();
  }, 40_000);

  /*
   * Klaarzetten per niveau (besluit 246, schets Wand-Klaarzetten): per niveau
   * de functies met hun ring, rechts de stappen; op de telefoon in een blad.
   */
  it('toont Klaarzetten per niveau, met stappen die zichzelf afvinken', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/klaarzetten.html#assistent`);
    const stappen = p.locator('#wand [data-stappen]');
    await stappen.locator('h2', { hasText: 'De assistent in huis' }).waitFor();
    expect(await p.locator('#wand [data-niveaus] a b').allTextContents()).toEqual(['Voor iedereen', 'Gevorderd', 'Expert']);
    // Whisper draait, op base-int8: die stap is aan de beurt, met een weg naar Home Assistant.
    expect(await stappen.locator('.kz-rij li.klaar b').first().textContent()).toBe('Whisper verstaat wat je zegt');
    expect(await stappen.locator('.kz-rij li.nu b').textContent()).toBe('Whisper op small-int8');
    expect(await stappen.locator('[data-kz-doe="spraakassistent"]').count()).toBe(1);
    // De wand meldde Fully zonder camera: één stap open.
    await p.locator('#wand [data-functies] a', { hasText: 'De wand' }).click();
    await stappen.locator('h2', { hasText: 'De wand' }).waitFor();
    expect(await stappen.locator('.kz-rij li.open').count()).toBe(1);
    expect(await stappen.locator('.kz-rij li.nu b').textContent()).toBe('Wakker op beweging');
    // Expert: de losse app via Tailscale.
    await p.locator('#wand [data-niveaus] a', { hasText: 'Expert' }).click();
    await stappen.locator('h2', { hasText: 'Losse app op je telefoon' }).waitFor();
    expect(await p.evaluate('document.scrollingElement.scrollHeight <= innerHeight')).toBe(true);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-klaarzetten-niveau.png') });
    // Bij Functies op de wand rechts in de lijst hoeveel er nog open is; de wand scrolt niet.
    await p.goto(`${baseUrl}/functies.html?groep=assistent#stem`);
    await p.locator('#wand [data-delen] .deel .nog', { hasText: 'nog 3 stappen' }).first().waitFor();
    expect(await p.locator('#wand .kz-nog').count()).toBe(0);
    // Alleen bij Stem en luisteren (4 november 2026): bij Praten leek het anders dezelfde pagina.
    expect(await p.locator('#wand [data-delen] .deel .nog').count()).toBe(1);
    // Op de telefoon de lijst, en de stappen in een blad van onderen.
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(`${baseUrl}/klaarzetten.html`);
    await p.locator('#tel [data-functies] a', { hasText: 'De wand' }).click();
    await p.locator('#tel [data-stappen] h2', { hasText: 'De wand' }).waitFor();
    await p.locator('#tel [data-stappen] [data-sluit]').click();
    await expect.poll(() => p.locator('#tel [data-stappen]').isHidden()).toBe(true);
    // Op de telefoon staan de stappen zelf bij het deel.
    await p.goto(`${baseUrl}/functies.html?groep=assistent#stem`);
    await p.locator('#tel .kz-nog header', { hasText: 'Nog 3 stappen voor "Hé huis"' }).waitFor();
    await p.goto(`${baseUrl}/functies.html?groep=assistent#praten`);
    await p.locator('#tel h2', { hasText: 'Het brein' }).waitFor();
    expect(await p.locator('#tel .kz-nog').count()).toBe(0);
    expect(fouten).toEqual([]);
    await context.close();
  }, 25_000);

  /*
   * Hoe ver je huis is (schets Wand-Voortgang): de zonnewaaier met een straal
   * voor alles wat er in Home Assistant is, zonder wat er nog bij kan. Open
   * vanaf de kaart bij Instellingen en vanaf Wat je huis kan.
   */
  it('toont Hoe ver je huis is als zonnewaaier, met een blad per straal', async () => {
    // Zonder beweging: dan staan de stralen meteen, ook op de schermafdrukken.
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL', reducedMotion: 'reduce' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const shot = (naam: string, vol = false) => (process.env.HEMS_PAGE_SHOT ? p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', `-${naam}.png`), fullPage: vol }) : null);
    // Bij Instellingen opent de kleine waaier op de kaart meteen de pagina.
    await p.goto(`${baseUrl}/instellingen.html`);
    await p.locator('#wand a.kan .kanwaaier .straal').first().waitFor();
    await shot('voortgang-instellingen');
    await p.locator('#wand a.kan .kanwaaier').click();
    await p.waitForURL(/voortgang\.html$/);
    await p.locator('#wand h1', { hasText: 'Hoe ver je huis is' }).waitFor();
    await p.locator('#wand [data-waaier] .straal').first().waitFor();
    // Een straal per onderwerp, net zoveel als regels in de lijst op de telefoon; wat er nog bij kan, staat er niet.
    const stralen = await p.locator('#wand [data-waaier] .straal').count();
    expect(stralen).toBeGreaterThan(0);
    expect(await p.locator('#tel [data-lijst] .rij').count()).toBe(stralen);
    expect(await p.locator('#tel [data-lijst]').textContent()).not.toContain('Thuisbatterij');
    expect(await p.locator('#wand [data-waaier] .zongetal').textContent()).toMatch(/^\d+%$/);
    expect(await p.locator('#wand [data-legenda]').textContent()).toContain('Werkt');
    expect(await p.evaluate('document.scrollingElement.scrollHeight <= innerHeight')).toBe(true);
    await shot('voortgang');
    // Een tik op een straal opent het blad met de vier treden; Escape sluit het.
    await p.locator('#wand [data-waaier] .straal').first().click();
    const blad = p.locator('#wand [data-blad]');
    await blad.locator('h4', { hasText: 'Hoe ver' }).waitFor();
    expect(await blad.locator('.trede').count()).toBe(4);
    expect(await p.locator('#wand [data-samen]').isHidden()).toBe(true);
    await shot('voortgang-blad');
    await p.keyboard.press('Escape');
    await expect.poll(() => p.locator('#wand [data-paneel-blad]').isHidden()).toBe(true);
    // Op de telefoon: de waaier zonder namen, de lijst eronder, en het blad van onderen.
    await p.setViewportSize({ width: 390, height: 844 });
    await p.locator('#tel [data-waaier] .straal').first().waitFor();
    expect(await p.locator('#tel [data-waaier] .straal text').count()).toBe(0);
    await shot('voortgang-tel', true);
    await p.locator('#tel [data-lijst] .rij').first().click();
    await p.locator('#tel [data-blad] .trede').first().waitFor();
    await shot('voortgang-tel-blad');
    await p.locator('#tel [data-blad] [data-sluit]').click();
    await expect.poll(() => p.locator('#tel [data-blad]').isHidden()).toBe(true);
    // Op Wat je huis kan staat de knop ernaartoe, met de kleine waaier.
    await p.setViewportSize({ width: 1340, height: 800 });
    await p.goto(`${baseUrl}/huis-kan.html`);
    const knop = p.locator('#wand [data-voortgangknop] a.voortgangknop');
    await knop.locator('.straal').first().waitFor();
    expect(await knop.getAttribute('href')).toBe('voortgang.html');
    expect(await knop.textContent()).toContain('Hoe ver je huis is');
    await shot('voortgang-huiskan');
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Een thuisbatterij op je eigen uren (besluit 230): het blad zegt welke maat
   * past, wat er dan nog van het net kwam, en wanneer hij had bijgesprongen.
   */
  it('zegt bij de thuisbatterij welke maat past en wanneer hij bijspringt', async () => {
    if (energyStore.current == null) await energyStore.save(importFromPrefs(await ENERGY_SOURCE.prefs(), await ENERGY_SOURCE.meters()));
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/huis-kan.html#batterij`);
    const som = p.locator('.som', { hasText: 'Past bij je huis' }).first();
    await som.locator('.uren i.aan').first().waitFor();
    expect(await som.textContent()).toMatch(/Past bij je huis\s*7,5 kWh[\s\S]*afgelopen jaar kwam er [\d.]+ kWh van het net[\s\S]*nog [\d.]+ kWh van het net/);
    // Hij springt bij in de uren dat er van het net kwam, niet als de zon schijnt.
    const aan = await som.locator('.uren i').evaluateAll((l) => l.map((i) => i.classList.contains('aan')));
    expect(aan.slice(10, 15).some(Boolean)).toBe(false);
    expect(aan.slice(18, 24).every(Boolean)).toBe(true);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-batterij.png') });
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Zoeken naar updates en opnieuw starten (testerronde, november 2026): bij
   * Versie, voor de beheerder. Zoeken geeft daarna hetzelfde venster als de
   * melding; opnieuw starten een venster met even geduld.
   */
  it('zoekt naar updates en start opnieuw vanuit Versie', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const was = { zoek: updateNu.zoek, herstart: updateNu.herstart };
    // Zoeken staat er alleen in de add-on; deze dienst draait als server.
    await context.route(`${baseUrl}/api/versie`, async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, json: { ...((await res.json()) as object), installatie: 'add-on' } });
    });
    try {
      await p.goto(`${baseUrl}/toegang.html#versie`);
      // Steunen (4 november 2026): een kop koffie bij Versie en op Over deze app, nooit als melding.
      await p.locator('#wand a.knop-koffie[href="https://paypal.me/sunarc"]').waitFor({ timeout: 8000 });
      await p.locator('#wand [data-zoek-update]').click();
      await p.locator('[data-nieuwpop]', { hasText: 'Je hebt de nieuwste versie' }).waitFor({ timeout: 8000 });
      expect(updateNu.zoek).toBe(was.zoek + 1);
      await p.locator('[data-nieuw-dicht]').click();
      await p.locator('#wand [data-herstart]').click();
      await p.locator('[data-herstart-pop]', { hasText: 'SunArc start opnieuw' }).waitFor({ timeout: 5000 });
      await expect.poll(() => updateNu.herstart, { timeout: 5000 }).toBe(was.herstart + 1);
      await p.goto(`${baseUrl}/over.html`);
      await p.locator('a.knop-koffie', { hasText: 'Trakteer op een kop koffie' }).first().waitFor();
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-over.png'), fullPage: true });
      expect(fouten).toEqual([]);
    } finally {
      await context.close();
    }
  }, 30_000);

  /*
   * Meld een probleem (testerronde, november 2026): vanuit het menu een blad,
   * een vooraf ingevuld issue op GitHub met een meldcode, en na een update de
   * uitkomst van je eigen melding.
   */
  it('meldt een probleem met een meldcode, en zegt na een update wat ermee gebeurde', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    // Het adres naar GitHub opvangen in plaats van een venster te openen.
    await context.addInitScript("localStorage.setItem('sc-rondleiding-gezien', '1'); window.geopend = []; window.open = (url) => { window.geopend.push(url); return null; }; window.klembord = null; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (x) => { window.klembord = x; } } });");
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    try {
      if (process.env.HEMS_PAGE_SHOT) {
        await p.goto(`${baseUrl}/apparaten.html`);
        await p.locator('#wand .meld-app').first().waitFor();
        await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-apparaten.png') });
      }
      await p.goto(`${baseUrl}/vandaag.html`);
      await p.locator('#wand .balk [data-meld-probleem]').click();
      const blad = p.locator('[data-meldpop]');
      await blad.locator('h2', { hasText: 'Meld een probleem' }).waitFor();
      await blad.locator('[data-meldwat]').fill('De airco zegt koelen terwijl hij uit staat');
      await blad.locator('[data-meldpop-stuur]').click();
      await blad.locator('h2', { hasText: 'Dank je wel' }).waitFor();
      const [url] = await p.evaluate<string[]>('window.geopend');
      expect(url).toMatch(/^https:\/\/github\.com\/Ricardo-switch\/SunArc\/issues\/new\?template=melding\.yml&title=/);
      const velden = new URL(url!).searchParams;
      expect(velden.get('wat')).toBe('De airco zegt koelen terwijl hij uit staat');
      expect(velden.get('meldcode')).toMatch(/^SA-[A-Z2-9]{4}$/);
      const code = velden.get('meldcode');
      expect(await p.evaluate<string>("JSON.parse(localStorage.getItem('sc-meldingen'))[0].code")).toBe(code);
      await blad.locator('[data-meldpop-dicht]').click();

      // Na een update: de nieuwe versie noemt de code, en de app zegt het één keer.
      await p.evaluate("localStorage.setItem('sc-versie-gezien', '0.0.1')");
      await context.route(`${baseUrl}/api/versie*`, async (route) => {
        const res = await route.fetch();
        const v = (await res.json()) as { nieuw: Record<string, unknown>[] };
        v.nieuw[0] = { ...v.nieuw[0], meldingen: [{ code, uitkomst: 'opgelost', issue: 119 }] };
        await route.fulfill({ response: res, json: v });
      });
      await p.reload();
      await p.locator('[data-nieuwpop]', { hasText: `Je melding ${code} is opgelost in` }).waitFor({ timeout: 8000 });
      expect(await p.evaluate<string>("JSON.parse(localStorage.getItem('sc-meldingen'))[0].uitkomst")).toBe('opgelost');

      // Werkt nog niet (4 november 2026): een blad, dan het issue zelf, met de tekst op het klembord.
      await p.locator('[data-nieuwpop] [data-meldnietgoed]').click();
      await blad.locator('h2', { hasText: 'Werkt nog niet' }).waitFor();
      await blad.locator('[data-meldwat]').fill('Hij zegt nog steeds koelen');
      await blad.locator('[data-meldpop-stuur]').click();
      await blad.locator('h2', { hasText: 'Plak je tekst in het issue' }).waitFor();
      expect((await p.evaluate<string[]>('window.geopend')).at(-1)).toBe('https://github.com/Ricardo-switch/SunArc/issues/119');
      const klembord = await p.evaluate<string>('window.klembord');
      expect(klembord).toMatch(/^Werkt nog niet in \d+\.\d+\.\d+ \(meldcode SA-[A-Z2-9]{4}\)\./);
      expect(klembord).toContain(`(meldcode ${code})`);
      expect(klembord).toContain('Hij zegt nog steeds koelen');
      expect(await p.evaluate<string>("JSON.parse(localStorage.getItem('sc-meldingen'))[0].bevestigd")).toBe('nietGoed');
      await blad.locator('[data-meldpop-dicht]').click();

      // Bij Over › Versie: je meldingen met hun stand, en later alsnog Werkt nu.
      await p.goto(`${baseUrl}/toegang.html#versie`);
      const lijst = p.locator('#wand .jouw-meldingen');
      await lijst.locator('li', { hasText: code! }).locator('text=werkt nog niet, in je issue gezet').waitFor({ timeout: 8000 });
      await lijst.locator('[data-meldwerkt]').click();
      await lijst.locator('text=Fijn, bedankt.').waitFor();
      expect(await p.evaluate<string>("JSON.parse(localStorage.getItem('sc-meldingen'))[0].bevestigd")).toBe('werkt');
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-jouw-meldingen.png') });
      expect(fouten).toEqual([]);
    } finally {
      await context.close();
    }
  }, 50_000);

  /*
   * Een prijs per uur (testerronde, november 2026): rekent Home Assistant met
   * een prijs-entiteit, dan zegt Energie › Prijzen het, en neemt één tik hem
   * over; daarna staat de prijs van nu erbij.
   */
  it('neemt bij Prijzen de uurprijs van Home Assistant over', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    if (energyStore.current == null) await energyStore.save(importFromPrefs(await ENERGY_SOURCE.prefs(), await ENERGY_SOURCE.meters()));
    const dynamisch = { prijsEntiteit: 'sensor.zonneplan_current_electricity_tariff', afname: ['sensor.p1_afname_cost'], terug: [] };
    await context.route(`${baseUrl}/api/energie*`, async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const res = await route.fetch();
      const v = (await res.json()) as { voorstel: { prijzen: Record<string, unknown> } | null; instellingen: unknown };
      const voorstel = v.voorstel ?? (v.instellingen as typeof v.voorstel);
      await route.fulfill({ response: res, json: { ...v, voorstel: { ...voorstel, prijzen: { ...voorstel!.prijzen, dynamisch } }, prijsNu: 0.2345 } });
    });
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    try {
      await p.goto(`${baseUrl}/energie.html#prijzen`);
      await p.locator('#wand [data-uurprijs]').click();
      await expect.poll(() => energyStore.current?.prijzen.dynamisch ?? null, { timeout: 5000 }).toEqual(dynamisch);
      await p.locator('#wand', { hasText: 'Prijs per uur uit Home Assistant, nu € 0,23 per kWh' }).first().waitFor({ timeout: 5000 });
      // Het soort contract gaat mee (issue 119).
      await expect.poll(() => connStore.current?.tarief ?? null, { timeout: 5000 }).toBe('dynamisch');
      // Toch een vaste prijs: dan weer zonder.
      await p.locator('#wand [data-uurprijs-uit]').click();
      await expect.poll(() => energyStore.current?.prijzen.dynamisch ?? null, { timeout: 5000 }).toBeNull();
      await expect.poll(() => connStore.current?.tarief ?? null, { timeout: 5000 }).toBe('vast');
      expect(fouten).toEqual([]);
    } finally {
      await context.close();
    }
  }, 30_000);

  /*
   * Issue 119: "Per uur" kiezen deed niets. Nu neemt het de uurprijs van Home
   * Assistant over; kent Home Assistant die nog niet, dan zegt Prijzen wat er
   * mist en welke sensor de prijs al geeft.
   */
  it('neemt bij Per uur de uurprijs over, of zegt wat er mist', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    if (energyStore.current == null) await energyStore.save(importFromPrefs(await ENERGY_SOURCE.prefs(), await ENERGY_SOURCE.meters()));
    const tariefWas = connStore.current?.tarief ?? null;
    const dynamisch = { prijsEntiteit: 'sensor.zonneplan_current_electricity_tariff', afname: ['sensor.p1_afname_cost'], terug: [] };
    // Eerst zonder prijs per uur in Home Assistant, wel met een sensor die hem geeft.
    let kent = false;
    await context.route(`${baseUrl}/api/energie*`, async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const res = await route.fetch();
      const v = (await res.json()) as { voorstel: { prijzen: Record<string, unknown> } | null; instellingen: unknown };
      const voorstel = v.voorstel ?? (v.instellingen as typeof v.voorstel);
      const prijzen = { ...voorstel!.prijzen };
      if (kent) prijzen['dynamisch'] = dynamisch;
      else delete prijzen['dynamisch'];
      await route.fulfill({ response: res, json: { ...v, voorstel: { ...voorstel, prijzen }, prijsNu: kent ? 0.2345 : null, prijsSensoren: kent ? [] : [{ id: 'sensor.zonneplan_current_electricity_tariff', naam: 'Zonneplan huidige stroomprijs', prijs: 0.2311 }] } });
    });
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const contract = (w: string) => p.locator(`#wand [data-kies="contract"][data-waarde='"${w}"']`);
    try {
      await p.goto(`${baseUrl}/energie.html#prijzen`);
      await contract('vast').click();
      await contract('dynamisch').click();
      const mist = p.locator('#wand [data-uurprijs-mist]');
      await mist.waitFor({ timeout: 5000 });
      expect(await mist.innerText()).toContain('Zonneplan huidige stroomprijs (nu € 0,23 per kWh)');
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-uurprijs-mist.png') });
      await expect.poll(() => connStore.current?.tarief ?? null, { timeout: 5000 }).toBe('dynamisch');
      expect(energyStore.current?.prijzen.dynamisch ?? null).toBeNull();
      // Daarna in Home Assistant gezet: opnieuw kijken, en dan neemt Per uur hem over.
      kent = true;
      await p.locator('#wand [data-uurprijs-opnieuw]').click();
      await p.locator('#wand [data-uurprijs]').waitFor({ timeout: 5000 });
      await contract('vast').click();
      await contract('dynamisch').click();
      await expect.poll(() => energyStore.current?.prijzen.dynamisch ?? null, { timeout: 5000 }).toEqual(dynamisch);
      await p.locator('#wand', { hasText: 'Prijs per uur uit Home Assistant, nu € 0,23 per kWh' }).first().waitFor({ timeout: 5000 });
      // Een vaste prijs zet hem weer uit.
      await contract('vast').click();
      await expect.poll(() => energyStore.current?.prijzen.dynamisch ?? null, { timeout: 5000 }).toBeNull();
      expect(fouten).toEqual([]);
    } finally {
      await context.close();
      if (connStore.current) await connStore.save({ ...connStore.current, tarief: tariefWas });
    }
  }, 40_000);

  /*
   * Issue 126: met een prijs per uur vroeg Prijzen nog om een vaste stroomprijs
   * (bij één tarief en bij normaal en dal), en teruglevering bleef een vast
   * bedrag. Nu is de stroomprijs een gemiddelde dat mag ontbreken, en telt
   * teruglevering per uur als Home Assistant dat doet.
   */
  it('vraagt bij een prijs per uur niet om een vaste stroomprijs of dalprijs', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    if (energyStore.current == null) await energyStore.save(importFromPrefs(await ENERGY_SOURCE.prefs(), await ENERGY_SOURCE.meters()));
    const energieWas = energyStore.current!;
    const tariefWas = connStore.current?.tarief ?? null;
    // Zoals bij de melder: nog geen stroomprijs, en geen prijs per uur bewaard.
    const { dynamisch: _weg, ...zonder } = energieWas.prijzen;
    await energyStore.save({ ...energieWas, prijzen: { ...zonder, stroom: null, stroomDal: null } });
    const dynamisch = { prijsEntiteit: 'sensor.zonneplan_current_electricity_tariff', afname: ['sensor.p1_afname_cost'], terug: ['sensor.p1_terug_compensation'] };
    await context.route(`${baseUrl}/api/energie*`, async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const res = await route.fetch();
      const v = (await res.json()) as { voorstel: { prijzen: Record<string, unknown> } | null; instellingen: unknown };
      const voorstel = v.voorstel ?? (v.instellingen as typeof v.voorstel);
      await route.fulfill({ response: res, json: { ...v, voorstel: { ...voorstel, prijzen: { ...voorstel!.prijzen, dynamisch } }, prijsNu: 0.2345 } });
    });
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const wand = (sel: string) => p.locator(`#wand ${sel}`);
    try {
      await p.goto(`${baseUrl}/energie.html#prijzen`);
      await wand(`[data-kies="contract"][data-waarde='"vast"']`).click();
      // Normaal en dal gekozen, de dalprijs nog leeg: dat hield het bewaren van Per uur tegen.
      await wand(`[data-kies="stroomtarief"][data-waarde='"dubbel"']`).click();
      await wand(`[data-kies="contract"][data-waarde='"dynamisch"']`).click();
      await expect.poll(() => energyStore.current?.prijzen.dynamisch ?? null, { timeout: 5000 }).toEqual(dynamisch);
      await expect.poll(() => connStore.current?.tarief ?? null, { timeout: 5000 }).toBe('dynamisch');
      await wand(':text("Prijs per uur uit Home Assistant")').first().waitFor({ timeout: 5000 });
      // Geen vraag om een vaste prijs: geen melding, geen rood veld, geen normaal en dal.
      expect(await wand(':text("Zonder stroomprijs")').count()).toBe(0);
      expect(await wand('[data-prijs="stroom"].leeg').count()).toBe(0);
      expect(await wand('[data-kies="stroomtarief"]').count()).toBe(0);
      expect(await wand('[data-prijs="stroomDal"]').count()).toBe(0);
      expect(energyStore.current?.prijzen.stroomDal ?? null).toBeNull();
      // Teruglevering telt per uur, zoals Home Assistant: geen vaste bedragen.
      await wand(':text("Teruglevering telt ook met de prijs van elk uur")').first().waitFor({ timeout: 5000 });
      expect(await wand('[data-prijs="teruglevering"]').count()).toBe(0);
      expect(await wand('[data-prijs="vanaf2027.vergoeding"]').count()).toBe(0);
      // Het overzicht zegt niet meer dat de prijs ontbreekt.
      expect(await p.locator('#wand', { hasText: 'stroomprijs ontbreekt' }).count()).toBe(0);
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-uurprijs-126.png') });
      expect(fouten).toEqual([]);
    } finally {
      await context.close();
      await energyStore.save(energieWas);
      if (connStore.current) await connStore.save({ ...connStore.current, tarief: tariefWas });
    }
  }, 40_000);

  /*
   * Issue 128: met een prijs per uur telde Opbrengst stroom en teruglevering
   * stil als nul als Home Assistant de kosten niet telde. Nu zegt Prijzen dat,
   * vraagt Prijzen geen gasprijs als Home Assistant het gas telt, en zegt
   * Opbrengst wat er zonder prijs in het totaal ontbreekt.
   */
  it('zegt wat Home Assistant niet telt, en wat er in de kosten ontbreekt', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    if (energyStore.current == null) await energyStore.save(importFromPrefs(await ENERGY_SOURCE.prefs(), await ENERGY_SOURCE.meters()));
    const energieWas = energyStore.current!;
    const dynamisch = { prijsEntiteit: 'sensor.zonneplan_current_electricity_tariff', afname: ['sensor.p1_afname_cost'], terug: [] };
    await energyStore.save({ ...energieWas, prijzen: { ...energieWas.prijzen, stroom: null, dynamisch } });
    // Eerst telt Home Assistant de kosten niet; daarna wel, ook die van het gas.
    let inHA: Record<string, unknown> | null = null;
    await context.route(`${baseUrl}/api/energie*`, async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const res = await route.fetch();
      const v = (await res.json()) as { voorstel: { prijzen: Record<string, unknown> } | null; instellingen: unknown };
      const voorstel = v.voorstel ?? (v.instellingen as typeof v.voorstel);
      const prijzen = { ...voorstel!.prijzen };
      if (inHA) prijzen['dynamisch'] = inHA;
      else delete prijzen['dynamisch'];
      await route.fulfill({ response: res, json: { ...v, voorstel: { ...voorstel, prijzen }, prijsNu: 0.2345 } });
    });
    // Opbrengst zoals bij Erik: alleen het gas had een prijs.
    await context.route(`${baseUrl}/api/opbrengst?*`, async (route) => {
      const res = await route.fetch();
      const v = (await res.json()) as { kosten: Record<string, unknown> };
      await route.fulfill({ response: res, json: { ...v, kosten: { ...v.kosten, totaal: 15.27, zonderPrijs: ['stroom', 'terug'], geschat: ['gas'] } } });
    });
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const wand = (sel: string) => p.locator(`#wand ${sel}`);
    try {
      await p.goto(`${baseUrl}/energie.html#prijzen`);
      const mist = wand('[data-uurkosten-mist]');
      await mist.waitFor({ timeout: 5000 });
      expect(await mist.innerText()).toContain('Home Assistant telt de kosten van je stroom niet');
      expect(await wand('[data-gas-per-uur]').count()).toBe(0);
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-uurkosten-mist.png') });
      // In Home Assistant gezet: opnieuw kijken, dan is de melding weg en telt het gas zoals Home Assistant.
      inHA = { ...dynamisch, gas: 'sensor.gas_cost' };
      // Ook bij teruglevering staat er een, want Home Assistant telt die hier niet per uur.
      await wand('[data-uurkosten-mist] [data-uurprijs-opnieuw]').click();
      await wand('[data-gas-per-uur]').waitFor({ timeout: 5000 });
      expect(await wand('[data-uurkosten-mist]').count()).toBe(0);
      expect(await wand('[data-prijs="gas"]').count()).toBe(0);
      await wand(':text("Prijs per uur uit Home Assistant")').first().waitFor({ timeout: 5000 });
      // Opbrengst zegt wat er in het totaal ontbreekt.
      await p.goto(`${baseUrl}/opbrengst.html`);
      await p.locator('#wand', { hasText: 'deels geschat, zonder stroom, zonder teruglevering' }).first().waitFor({ timeout: 10_000 });
      expect(fouten).toEqual([]);
    } finally {
      await context.close();
      await energyStore.save(energieWas);
    }
  }, 40_000);

  /*
   * De valuta van het huis (testerronde, november 2026): zegt Home Assistant
   * dollar, dan staan de bedragen en de prijsvelden in dollar.
   */
  it('toont de valuta uit Home Assistant in plaats van de euro', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'en-GB' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => {
      localStorage.setItem('sc-rondleiding-gezien', '1');
      localStorage.setItem('sc-taal', 'en');
    });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    await context.route(`${baseUrl}/api/site`, async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, json: { ...((await res.json()) as object), valuta: 'USD' } });
    });
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    try {
      await p.goto(`${baseUrl}/energie.html#prijzen`);
      await p.locator('#wand', { hasText: '$ per kWh' }).first().waitFor({ timeout: 10_000 });
      expect(await p.locator('#wand [data-vorm]').first().textContent()).not.toContain('€');
      expect(fouten).toEqual([]);
    } finally {
      await context.close();
    }
  }, 30_000);

  /*
   * Een betatester (november 2026): de thuisbatterij stond op Thuis, maar Wat
   * je huis kan zei "Batterij nodig". Nu kijkt SunArc er zichtbaar mee.
   */
  it('noemt een thuisbatterij die er al is niet meer "Batterij nodig"', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    extraOpslag = { batterij: { id: 'sessy', naam: 'De batterij', pct: 21, vermogenW: null, stand: 'rust' }, auto: null, autos: [] };
    try {
      await p.goto(`${baseUrl}/huis-kan.html`);
      await p.getByText('21% vol; SunArc kijkt mee en stuurt hem niet').first().waitFor();
      expect(await p.getByText('Batterij nodig').count()).toBe(0);
      expect(await p.locator('body').textContent()).not.toContain('undefined');
      expect(fouten).toEqual([]);
    } finally {
      extraOpslag = null;
      await context.close();
    }
  }, 30_000);

  /*
   * Hoe je huis warmte vasthoudt (besluit 231): een regel onder Leren, en een
   * blad met een dag zonder verwarming en per kamer wat het weet.
   */
  it('laat onder Leren zien hoe het huis warmte vasthoudt', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    // Het voorbeeld rechtstreeks, met de datum van nu: over middernacht rekende de dienst opnieuw, uit een leeg logboek.
    await context.route(`${baseUrl}/api/thermisch`, (route) => route.fulfill({ json: THERMISCH_VOORBEELD(Date.now()) }));
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/huis-kan.html`);
    const regel = p.locator('#wand .vak.leren .regel', { hasText: 'Hoe je huis warmte vasthoudt' });
    await regel.waitFor();
    expect(await regel.textContent()).toContain('kent het afkoelen, wacht op het stoken');
    expect(await p.locator('#wand .vak.leren .regel', { hasText: 'Op tijd warm of koel' }).textContent()).toContain('begint zodra het huis het stoken kent');
    await regel.click();
    const blad = p.locator('.thermisch').first();
    await blad.locator('.lijn').first().waitFor();
    expect(await blad.locator('.lijn').count()).toBe(2);
    const tekst = (await blad.textContent()) ?? '';
    // Acht uur bij 10° verschil: 0,0082 × 10 × 8 = 0,66.
    expect(tekst).toMatch(/−0,7°\s*in een nacht/);
    expect(tekst).toMatch(/Airco koelt\s*−0,4°/);
    expect(tekst).toMatch(/Nest verwarmt\s*nog onduidelijk/);
    expect(tekst).toMatch(/Airco verwarmt\s*nog niet gezien/);
    expect(await p.locator('.blad', { hasText: 'Wat het nog nodig heeft' }).first().textContent()).toContain('Nest: het verwarmen is nog niet te zien');
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-thermisch.png') });
    // Past op de wand zonder te scrollen.
    expect(await p.evaluate<boolean>("(() => { const b = [...document.querySelectorAll('.blad')].find((e) => e.offsetParent); const knop = b.querySelector('.onder a').getBoundingClientRect(); return knop.bottom <= b.getBoundingClientRect().bottom && knop.bottom <= innerHeight; })()")).toBe(true);
    // Op de telefoon de kamers onder elkaar.
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(`${baseUrl}/huis-kan.html#thermisch`);
    const tel = p.locator('#tel .thermisch');
    await tel.locator('.lijn').first().waitFor();
    const kolommen = await p.evaluate<number>("getComputedStyle(document.querySelector('#tel .thermisch .kamers')).gridTemplateColumns.split(' ').length");
    expect(kolommen).toBe(1);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-thermisch-tel.png'), fullPage: true });
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Over deze app (1 november 2026): het logo in de balk en naast de klok op
   * Thuis staand brengt je hier, met het logo groot en voluit.
   */
  it('opent Over deze app met een tik op het logo', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/thuis.html`);
    // Staand: het logo links naast de klok.
    const merk = p.locator('#tel .kloklinks .merkje');
    await merk.waitFor();
    expect((await merk.boundingBox())!.x).toBeLessThan((await p.locator('#tel .kloklinks [data-tijd]').boundingBox())!.x);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-logo-thuis-tel.png') });
    await merk.click();
    await p.waitForURL(/over\.html$/);
    const tel = p.locator('#tel [data-over]');
    await tel.locator('.versie', { hasText: VERSIE }).waitFor();
    expect(await tel.locator('.woord').textContent()).toBe('SunArc');
    expect(await tel.locator('.arc').textContent()).toBe('Autonomous Residential Climate');
    expect(await tel.textContent()).toContain('AGPL-3.0');
    if (process.env.HEMS_PAGE_SHOT) {
      // Na de overgang tussen de pagina's.
      await p.waitForTimeout(800);
      await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-over-tel.png') });
    }
    // Op de wand: het logo in de balk gaat ook hierheen, en alles past zonder te scrollen.
    await p.setViewportSize({ width: 1280, height: 800 });
    await p.goto(`${baseUrl}/vandaag.html`);
    const balkLogo = p.locator('#balk a.logo');
    await balkLogo.waitFor();
    expect(await balkLogo.getAttribute('href')).toBe('over.html');
    await balkLogo.click();
    await p.waitForURL(/over\.html$/);
    await p.locator('#wand [data-over] .versie', { hasText: VERSIE }).waitFor();
    expect(await p.evaluate<boolean>('document.scrollingElement.scrollHeight <= innerHeight')).toBe(true);
    if (process.env.HEMS_PAGE_SHOT) {
      // Na de overgang tussen de pagina's.
      await p.waitForTimeout(800);
      await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-over-wand.png') });
    }
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Vast en gepland (besluit 234): de dag als boog, de lijst met een
   * schakelaar, en Aanpassen met wanneer, hoe vaak en overslaan.
   */
  it('toont Vast en gepland, en past een opdracht aan', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    // Een vaste klok, 11:00 in Amsterdam: na 23:20 viel "over 40 minuten" op morgen, en dan stond er vandaag geen opdracht op de boog.
    const nu = Date.UTC(2026, 10, 5, 10, 0);
    await p.clock.setFixedTime(new Date(nu));
    const scherm = [{ pad: 'api/scherm', body: { id: 'cover.screen', actie: 'dicht' } }];
    const licht = [{ pad: 'api/licht', body: { id: 'light.badkamer', aan: true } }];
    const gepland = [
      { id: 'g1', tekst: 'Screens dicht', ms: nu + 40 * 60_000, voor: null, naam: null, status: 'wacht', gemaakt: nu, opdracht: { stappen: scherm, zon: 'onder', moment: { soort: 'zon', zon: 'onder', minuten: -10 }, herhaal: { soort: 'dag' }, aan: true } },
      { id: 'g2', tekst: 'Badkamer licht aan', ms: nu + 30 * 3_600_000, voor: null, naam: null, status: 'wacht', gemaakt: nu, opdracht: { stappen: licht, zon: null, moment: { soort: 'tijd', uur: 7, minuut: 0 }, herhaal: { soort: 'werkdagen' }, aan: false } },
    ];
    const gestuurd: Record<string, unknown>[] = [];
    await context.route(`${baseUrl}/api/te-doen**`, async (route) => {
      if (route.request().method() === 'POST') {
        gestuurd.push(route.request().postDataJSON() as Record<string, unknown>);
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: { aan: true, herinneringen: [], gepland, lijsten: [], afspraken: [], speelt: [], agendas: {} } });
    });
    // Op Te doen een eigen kolom (besluit 244), met alles naar de eigen pagina.
    await p.goto(`${baseUrl}/tedoen.html`);
    const regel = p.locator('#wand .td-gepland');
    await regel.waitFor({ timeout: 10_000 });
    expect(await p.locator('#wand .td-vast .td-taak').count()).toBe(2);
    expect(await p.locator('#wand .td-vast .td-taak.uit').textContent()).toContain('Badkamer licht aan');
    // Pauzeren kan daar ook.
    await p.locator('#wand .td-vast .td-taak', { hasText: 'Screens dicht' }).locator('[data-td-gp-aan]').click();
    await expect.poll(() => gestuurd.length).toBe(1);
    expect(gestuurd.shift()).toEqual({ actie: 'aanpassen', id: 'g1', aan: false });
    // Weghalen met × (7 november 2026), na een vraag.
    p.once('dialog', (d) => void d.accept());
    await p.locator('#wand .td-vast .td-taak', { hasText: 'Badkamer licht aan' }).locator('[data-td-gp-weg]').click();
    await expect.poll(() => gestuurd.length).toBe(1);
    expect(gestuurd.shift()).toEqual({ actie: 'annuleer', id: 'g2' });
    await regel.click();
    await p.waitForURL(/gepland\.html$/);
    const wand = p.locator('#wand [data-gp]');
    await wand.locator('.gp-regel').first().waitFor();
    // De boog met de opdracht van vandaag, en de lijst: vandaag nog, en gepauzeerd daarna.
    expect(await wand.locator('.gp-dag svg circle[stroke-width="2.5"]').count()).toBeGreaterThanOrEqual(1);
    expect(await wand.locator('.gp-regel', { hasText: 'Screens dicht' }).textContent()).toContain('Elke dag, 10 min voor zonsondergang');
    expect(await wand.locator('.gp-regel.uit', { hasText: 'Badkamer licht aan' }).textContent()).toContain('gepauzeerd');
    // Pauzeren met de schakelaar.
    await wand.locator('.gp-regel', { hasText: 'Screens dicht' }).locator('[data-gp-aan]').click();
    await expect.poll(() => gestuurd.length).toBe(1);
    expect(gestuurd[0]).toEqual({ actie: 'aanpassen', id: 'g1', aan: false });
    // Aanpassen: wanneer, hoe vaak, overslaan.
    await wand.locator('.gp-regel', { hasText: 'Screens dicht' }).click();
    const blad = wand.locator('.gp-blad');
    await blad.waitFor();
    expect(await blad.locator('.gp-stapper b').textContent()).toBe('10 min ervoor');
    await blad.locator('[data-gp-min="-5"]').click();
    expect(await blad.locator('.gp-stapper b').textContent()).toBe('15 min ervoor');
    await blad.locator('[data-gp-herhalen]').click();
    await blad.locator('[data-gp-herhaal="werkdagen"]').click();
    expect(await blad.locator('[data-gp-herhalen]').textContent()).toContain('Werkdagen');
    await blad.locator('[data-gp-weg]').click();
    expect(await p.evaluate<boolean>('document.scrollingElement.scrollHeight <= innerHeight')).toBe(true);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-gepland-aanpassen.png') });
    await blad.locator('[data-gp-bewaar]').click();
    await expect.poll(() => gestuurd.length).toBe(2);
    expect(gestuurd[1]).toEqual({ actie: 'aanpassen', id: 'g1', aan: true, overslaanWeg: true, moment: { soort: 'zon', zon: 'onder', minuten: -15 }, herhaal: { soort: 'werkdagen' } });
    // Kies dagen: dan pas de zeven dagen.
    await wand.locator('.gp-regel', { hasText: 'Badkamer licht aan' }).click();
    await blad.locator('[data-gp-herhalen]').click();
    expect(await blad.locator('.gp-dagen').count()).toBe(0);
    await blad.locator('[data-gp-herhaal="dagen"]').click();
    expect(await blad.locator('.gp-dagen button').count()).toBe(7);
    await p.keyboard.press('Escape');
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-gepland.png') });
    // Op de telefoon onder elkaar, en Aanpassen van onderen.
    await p.setViewportSize({ width: 390, height: 844 });
    const tel = p.locator('#tel [data-gp]');
    await tel.locator('.gp-regel').first().waitFor();
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-gepland-tel.png') });
    await tel.locator('.gp-regel').first().click();
    await tel.locator('.gp-blad [data-gp-bewaar]').waitFor();
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-gepland-tel-aanpassen.png') });
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Nieuw (besluit 240): zeg het, of kies het zelf in vier stappen; op de
   * telefoon één stap per scherm. Klimaat met de hand op een tijd.
   */
  it('maakt bij Vast en gepland een nieuwe opdracht, zelf gekozen of gezegd', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const nu = Date.now();
    const gestuurd: Record<string, unknown>[] = [];
    await context.route(`${baseUrl}/api/te-doen**`, async (route) => {
      if (route.request().method() === 'POST') {
        const b = route.request().postDataJSON() as Record<string, unknown>;
        gestuurd.push(b);
        if (b['actie'] === 'voorproef') return route.fulfill({ json: { ok: true, momenten: [1, 2, 3, 4, 5, 6, 7].map((d) => nu + d * 86_400_000) } });
        return route.fulfill({ json: { ok: true, id: 'g9', ms: nu + 86_400_000 } });
      }
      return route.fulfill({ json: { aan: true, herinneringen: [], gepland: [], lijsten: [], afspraken: [], speelt: [], agendas: {} } });
    });
    await context.route(`${baseUrl}/api/huis**`, (route) =>
      route.fulfill({ json: { etages: [{ id: 'beneden', naam: 'Beneden', ruimtes: [{ id: 'woonkamer', naam: 'Woonkamer', apparaten: [{ id: 'light.bank', naam: 'Lamp bank', soort: 'licht' }, { id: 'cover.screen', naam: 'Screen', soort: 'screen', scherm: { standKiezen: true } }], scenes: [{ id: 'scene.avond', naam: 'Avond' }] }] }] } }),
    );
    await context.route(`${baseUrl}/api/hand**`, (route) =>
      route.fulfill({ json: { aan: true, apparaten: [{ id: 'climate.zolder', naam: 'Airco zolder', kamer: 'Zolder', modi: [{ modus: 'verwarmen', doelC: 20, min: 16, max: 30, stap: 0.5, niet: null }, { modus: 'koelen', doelC: 23, min: 16, max: 30, stap: 0.5, niet: null }] }], schakelaars: [], nu } }),
    );
    await context.route(`${baseUrl}/api/witgoed**`, (route) => route.fulfill({ json: { apparaten: [{ id: 'droger', naam: 'Droger', kan: true, reden: null, gestartMs: null }] } }));
    await context.route(`${baseUrl}/api/vraag**`, (route) =>
      route.fulfill({ json: { vraag: 'tedoen', taal: 'nl', antwoord: 'Zo: elke dag 10 minuten voor zonsondergang, doe de screens dicht.', voorstel: { tekst: 'Doe de screens dicht', wat: 'doe de screens dicht', stappen: [{ pad: 'api/scherm', body: { id: 'cover.screen', actie: 'dicht' } }], moment: { soort: 'zon', zon: 'onder', minuten: -10 }, herhaal: { soort: 'dag' }, ms: nu + 3_600_000 } } }),
    );
    await p.goto(`${baseUrl}/gepland.html`);
    await p.locator('#wand [data-gp-nieuw]').click();
    const wiz = p.locator('#wand .tk-blad');
    const zin = wiz.locator('.tk-zin');
    // Wat (besluit 244): per kamer, meerdere tegelijk; de airco zonder kamer onder Overig.
    await wiz.locator('[data-pl-kies="licht:light.bank"]').click();
    await wiz.locator('[data-pl-kies="klimaat:climate.zolder"]').click();
    // De scène staat niet meer bij Wat (besluit 268): de lamp en het screen.
    expect(await wiz.locator('.tk-kamer', { hasText: 'Woonkamer' }).locator('[data-pl-kies]').count()).toBe(2);
    expect(await zin.textContent()).toBe('Op een moment gaat de lamp bank aan en gaat de airco zolder verwarmen naar 20°.');
    await wiz.locator('[data-pl-verder]').click();
    // Wanneer: om 06:30, op werkdagen.
    await wiz.locator('[data-pl-tijd]').fill('06:30');
    await wiz.locator('[data-pl-tijd]').dispatchEvent('change');
    await wiz.locator('[data-pl-herhaal="werkdagen"]').click();
    await expect.poll(() => wiz.locator('.tk-rechts .tk-komend > div').count()).toBe(4);
    await wiz.locator('[data-pl-verder]').click();
    // Hoe: de airco een halve graad hoger.
    await wiz.locator('[data-pl-doel="1"]').click();
    expect(await zin.textContent()).toBe('Elke werkdag om 06:30 gaat de lamp bank aan en gaat de airco zolder verwarmen naar 20,5°.');
    // Een scène bij de lampen (besluit 268): die start in plaats van de lamp; Aan zet het terug.
    await wiz.locator('[data-pl-scene]').selectOption('scene.avond');
    expect(await zin.textContent()).toContain('start de scène Avond');
    await wiz.locator('[data-pl-hoe="licht:aan:1"]').click();
    expect(await zin.textContent()).toBe('Elke werkdag om 06:30 gaat de lamp bank aan en gaat de airco zolder verwarmen naar 20,5°.');
    // Een stuk van de zin opent zijn keuze.
    await zin.locator('[data-pl-stuk="wanneer"]').click();
    expect(await wiz.locator('.tk-paneel').getAttribute('data-stuk')).toBe('wanneer');
    await wiz.locator('[data-pl-verder]').click();
    await wiz.locator('[data-pl-verder]').click();
    expect(await wiz.locator('.tk-paneel').getAttribute('data-stuk')).toBe('klaar');
    expect(await p.evaluate<boolean>('document.scrollingElement.scrollHeight <= innerHeight')).toBe(true);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-gepland-nieuw.png') });
    await wiz.locator('[data-pl-verder]').click();
    await expect.poll(() => gestuurd.some((b) => b['actie'] === 'plan')).toBe(true);
    expect(gestuurd.find((b) => b['actie'] === 'plan')).toEqual({
      actie: 'plan',
      tekst: 'Lamp bank aan, airco zolder verwarmen tot 20,5°',
      stappen: [
        { pad: 'api/licht', body: { doel: 'lamp', id: 'light.bank', aan: true } },
        { pad: 'api/hand', body: { id: 'climate.zolder', modus: 'verwarmen', doelC: 20.5, tot: 'doel' } },
      ],
      moment: { soort: 'tijd', uur: 6, minuut: 30 },
      herhaal: { soort: 'werkdagen' },
      overslaanWeg: false,
      aan: true,
    });
    await expect.poll(() => p.locator('[data-pl]').count()).toBe(0);
    // Zeg het: een voorstel van de dienst, en meteen naar Klaar.
    await p.locator('#wand [data-gp-nieuw]').click();
    await wiz.locator('.tk-onder [data-pl-stuk="zeg"]').click();
    await wiz.locator('[data-pl-zeg] input').fill('doe elke dag tien minuten voor zonsondergang de screens dicht');
    await wiz.locator('.tk-maak').click();
    await expect.poll(() => wiz.locator('.tk-rechts .tk-komend > div').count()).toBe(4);
    expect(await zin.textContent()).toBe('Elke dag 10 min voor zonsondergang: doe de screens dicht.');
    await p.keyboard.press('Escape');
    // Op de telefoon: van onderen, alles onder elkaar, zonder de kolom rechts.
    await p.setViewportSize({ width: 390, height: 844 });
    await p.locator('#tel [data-gp-nieuw]').click();
    const tel = p.locator('#tel .tk-blad');
    await tel.locator('[data-pl-kies]').first().waitFor();
    expect(await tel.locator('.tk-rechts').count()).toBe(0);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-gepland-nieuw-tel.png') });
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Klimaat met de hand (besluit 235): een knop op Apparaten opent de laag met
   * de apparaten en het blad; de zolder warm gaat direct, met een eindtijd.
   */
  it('bedient een klimaatapparaat vanaf zijn kaart bij Apparaten, ook tot het doel (besluit 238)', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const nu = Date.now();
    const modus = (m: string, doel: number, via: string, niet: string | null = null) => ({ modus: m, doelC: doel, standaardC: doel, min: 16, max: 25, stap: 0.5, via, niet });
    const hand = {
      aan: true,
      nu,
      dagdeelTotMs: nu + 5 * 3_600_000,
      apparaten: [
        { id: 'climate.beneden', actuatorId: 'nest', naam: 'Nest beneden', kamer: 'Woonkamer', zoneId: 'woonkamer', modi: [modus('verwarmen', 20, 'knop')], hvac: 'heat', nuC: 19.6, actief: { modus: 'verwarmen', doelC: 21, totMs: nu + 5 * 3_600_000 } },
        { id: 'climate.air_conditioning_zolder', actuatorId: 'ac-zolder', naam: 'Airco zolder', kamer: 'Zolder', zoneId: 'zolder', modi: [modus('verwarmen', 19, 'direct'), modus('koelen', 24, 'knop', 'koelstrategie')], hvac: 'off', nuC: 17.8, actief: null },
      ],
      schakelaars: [],
    };
    const gestuurd: Record<string, unknown>[] = [];
    await context.route(`${baseUrl}/api/hand`, async (route) => {
      if (route.request().method() === 'POST') {
        gestuurd.push(route.request().postDataJSON() as Record<string, unknown>);
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: hand });
    });
    await p.goto(`${baseUrl}/apparaten.html`);
    // De knop Met de hand en de lijst zijn weg; een tik op de kaart opent het blad.
    expect(await p.locator('[data-hand-open]').count()).toBe(0);
    const zolder = p.locator('#wand .app[data-klimaat="climate.air_conditioning_zolder"]');
    await zolder.waitFor({ timeout: 10_000 });
    // Wat met de hand staat, in zonkleur op de kaart.
    expect(await p.locator('#wand .app[data-klimaat="climate.beneden"]').textContent()).toMatch(/met de hand op 21° · tot \d\d:\d\d/i);
    await zolder.click();
    const laag = p.locator('[data-hand]');
    await laag.locator('.hand-blad').waitFor();
    expect(await laag.locator('.hand-blad h2').textContent()).toBe('Airco zolder');
    expect(await zolder.getAttribute('class')).toContain('gekozen');
    expect(await laag.locator('.hand-hoe').textContent()).toContain('alleen met zon of als hulp');
    await laag.locator('[data-hand-doel="1"]').click();
    expect(await laag.locator('.hand-wijzer').textContent()).toContain('19,5°');
    // Tot het doel: terug zodra het er is, uiterlijk aan het eind van het dagdeel.
    await laag.locator('[data-hand-tot="doel"]').click();
    expect(await laag.locator('.hand-hoe').textContent()).toContain('Tot het 19,5° is');
    expect(await p.evaluate<boolean>('document.scrollingElement.scrollHeight <= innerHeight')).toBe(true);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-blad.png') });
    await laag.locator('[data-hand-zet]').click();
    await expect.poll(() => gestuurd.length).toBe(1);
    expect(gestuurd[0]).toMatchObject({ id: 'climate.air_conditioning_zolder', modus: 'verwarmen', doelC: 19.5, totDoel: true });
    expect(Number(gestuurd[0]!['totMs']) - nu).toBeGreaterThan(4 * 3_600_000);
    // Koelen kan niet zolang de koelstrategie uit staat.
    await zolder.click();
    await laag.locator('[data-hand-modus="koelen"]').click();
    expect(await laag.locator('.hand-hoe').textContent()).toContain('Koelen staat in je regeling uit');
    expect(await laag.locator('[data-hand-zet]').isDisabled()).toBe(true);
    await p.keyboard.press('Escape');
    expect(await laag.count()).toBe(0);
    // Op de telefoon: het blad van onderen, over de hele breedte; ook op een telefoon breder dan
    // 390, waar de klasse tel uit kit.css het blad eerst 390 breed hield (2 november 2026).
    await p.setViewportSize({ width: 430, height: 932 });
    await p.locator('#tel .app[data-klimaat="climate.beneden"]').click();
    await p.locator('.hand-laag.op-tel .hand-blad').waitFor();
    expect(await p.locator('.hand-laag.op-tel .hand-terug').textContent()).toBe('Terug naar je regeling');
    expect(await p.locator('.hand-laag.op-tel').evaluate((e) => Math.round(e.getBoundingClientRect().width))).toBe(430);
    expect(await p.locator('.hand-laag.op-tel .hand-vel').evaluate((e) => Math.round(e.getBoundingClientRect().width))).toBe(430);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-blad-tel.png') });
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  it('is als app te installeren: een manifest met iconen, en een service worker', async () => {
    const res = await fetch(`${baseUrl}/manifest.webmanifest`);
    expect(res.headers.get('content-type')).toContain('application/manifest+json');
    const m = (await res.json()) as { start_url: string; display: string; icons: { src: string; sizes: string }[] };
    expect(m).toMatchObject({ start_url: 'thuis.html', display: 'standalone' });
    for (const icoon of m.icons) expect((await fetch(`${baseUrl}/${icoon.src}`)).headers.get('content-type')).toBe('image/png');
    expect((await fetch(`${baseUrl}/sw.js`)).status).toBe(200);
    const thuis = await (await fetch(`${baseUrl}/thuis.html`)).text();
    expect(thuis).toContain('rel="manifest"');
  });

  /*
   * Aanbellen (besluit 107): elke open pagina toont het beeld van de deurbel,
   * en sluit het weer.
   */
  it('toont het beeld van de deurbel als er wordt aangebeld', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    await p.goto(`${baseUrl}/opbrengst.html`);
    // Bellen tot de pagina het laat zien: een kijker van een eerdere test kan
    // nog als open tellen terwijl de stroom van deze pagina er nog niet is.
    await expect
      .poll(async () => {
        server.ring('camera.camera_oprit_vloeiend', 'Camera oprit');
        return p.locator('.aanbel', { hasText: 'Er wordt aangebeld' }).count();
      }, { timeout: 10_000 })
      .toBeGreaterThan(0);
    await expect.poll(() => p.evaluate<number>("document.querySelector('.aanbel img')?.naturalWidth ?? 0")).toBeGreaterThan(0);
    // Het hele beeld past in het vak, niets valt eronder weg.
    const past = await p.evaluate<boolean>("(() => { const v = document.querySelector('.aanbel-beeld').getBoundingClientRect(); const i = document.querySelector('.aanbel img').getBoundingClientRect(); return i.bottom <= v.bottom + 1 && i.right <= v.right + 1 && i.height > 0; })()");
    expect(past).toBe(true);
    await p.locator('.aanbel [data-bel-dicht]').click();
    await p.locator('.aanbel').waitFor({ state: 'detached' });
    // Geeft het gekozen beeld niets en blijft live leeg, dan toch beeld: een plaatje
    // van het volgende beeld van dezelfde camera, en daarna elke seconde een nieuw.
    server.ring('camera.deurbel_duidelijk', 'Deurbel', { seconden: 30, schermAan: true, reserve: ['camera.deurbel_vloeiend'] });
    await expect.poll(() => p.evaluate<number>("document.querySelector('.aanbel img')?.naturalWidth ?? 0")).toBeGreaterThan(0);
    const eerste = await p.evaluate<string>("document.querySelector('.aanbel img').src");
    await expect.poll(() => p.evaluate<string>("document.querySelector('.aanbel img')?.src ?? ''"), { timeout: 9_000 }).not.toBe(eerste);
    await p.locator('.aanbel [data-bel-dicht]').click();
    await p.locator('.aanbel').waitFor({ state: 'detached' });
    // Rook (21 oktober 2026, schets Wand-Rook): op elke pagina, met de kamer en
    // wat de andere melders zien. Sluiten houdt hem weg tot er iets nieuws is;
    // ziet niemand meer iets, dan gaat hij vanzelf weg.
    const melders = [
      { id: 'binary_sensor.rook_keuken', naam: 'Rookmelder keuken', kamer: 'Keuken', gevaar: 'rook' as const, sindsMs: Date.UTC(2026, 9, 21, 10, 41) },
      { id: 'binary_sensor.rook_entree', naam: 'Rookmelder entree', kamer: 'Entree', gevaar: null, sindsMs: null },
    ];
    server.alarm(melders);
    const alarm = p.locator('.alarmlaag');
    await alarm.locator('h1', { hasText: 'Rook in de keuken' }).waitFor();
    expect(await alarm.textContent()).toContain('Entree');
    expect(await alarm.textContent()).toContain('bel 112');
    await alarm.locator('[data-alarm-dicht]').click();
    await alarm.waitFor({ state: 'detached' });
    server.alarm(melders);
    await p.waitForTimeout(300);
    expect(await alarm.count()).toBe(0);
    // Nu ook koolmonoxide in de entree: dan weer.
    server.alarm([melders[0]!, { ...melders[1]!, gevaar: 'co', sindsMs: Date.UTC(2026, 9, 21, 10, 43) }]);
    await alarm.waitFor();
    server.alarm(melders.map((m) => ({ ...m, gevaar: null, sindsMs: null })));
    await alarm.waitFor({ state: 'detached' });
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Kamer in ontwerp 2 (besluit 104; schetsen Wand-Kamer en Wand-Bedienen): de
   * etage met de gekozen kamer, het blad met wat erin is, en per apparaat een
   * blad. Klimaat zegt wat het huis zou doen; een lamp schakelt echt.
   */
  it('toont Kamer van ontwerp 2, met het blad van een klimaatapparaat en een lamp die schakelt', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const huisNu = (await (await fetch(`${baseUrl}/api/huis`)).json()) as { etages: { ruimtes: { id: string; zoneId: string | null; apparaten: { id: string; soort: string }[] }[] }[] };
    const kamers = huisNu.etages.flatMap((e) => e.ruimtes);
    const metKlimaat = kamers.find((r) => r.zoneId && r.apparaten.some((d) => d.soort === 'klimaat'))!;
    const metLamp = kamers.find((r) => r.apparaten.some((d) => d.soort === 'licht'))!;

    await p.goto(`${baseUrl}/kamer.html#${encodeURIComponent(metKlimaat.id)}`);
    await p.locator('#wand [data-blad] .bladkop').waitFor();
    // Het huis met tikvlakken, en de wand zonder scrollen.
    await p.locator('#wand svg.sc-huis .sc-tik').first().waitFor();
    expect(await p.evaluate('document.scrollingElement.scrollHeight <= innerHeight')).toBe(true);
    // De etages naast elkaar van beneden naar boven, buiten achteraan (besluit 131).
    const naast = await p.locator('#wand [data-etages] button').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-etage')));
    const binnen = huisNu.etages.map((e) => (e as unknown as { id: string }).id).filter((id) => id !== 'buiten' && naast.includes(id));
    expect(naast.filter((id) => id !== 'buiten')).toEqual([...binnen].reverse());
    if (naast.includes('buiten')) expect(naast.at(-1)).toBe('buiten');
    // Een klimaatapparaat: het blad zegt wat het huis zou doen, en schakelt niets.
    await p.locator('#wand [data-blad] .rij[data-open]').first().click();
    await p.locator('#wand [data-blad] .doelrij').waitFor();
    await p.locator('#wand [data-blad] [data-doel="0.5"]').click();
    await p.locator('#wand [data-blad] [data-wens]').first().click();
    await p.locator('#wand [data-gezegd]').filter({ hasText: 'zou' }).waitFor();
    await p.locator('#wand [data-blad] [data-terug]').click();
    await p.locator('#wand [data-blad] .bladkop').waitFor();

    // De camera op de oprit: het beeld, want deze browser is ingelogd. Eerst
    // tot een beeld van een eerdere test (de deurbel) dicht is: op een trage
    // CI duurde dat langer dan vijf tellen (17 oktober 2026).
    await expect.poll(() => liveOpen, { timeout: 15_000 }).toBe(0);
    const oprit = kamers.find((r) => r.apparaten.some((d) => d.soort === 'camera'))!;
    await p.goto(`${baseUrl}/kamer.html#${encodeURIComponent(oprit.id)}/camera.camera_oprit_vloeiend`);
    await p.locator('#wand .camerabeeld img').waitFor();

    // In het blad van de oprit blijft het live beeld staan, ook als het huis ververst.
    await p.goto(`${baseUrl}/kamer.html#${encodeURIComponent(oprit.id)}`);
    await p.locator('#wand .camerabeeld[data-gestart] img').waitFor();
    await p.waitForTimeout(2500);
    expect(await p.evaluate<number>("document.querySelector('#wand .camerabeeld img')?.naturalWidth ?? 0")).toBeGreaterThan(0);
    // Precies één: het beeld van deze kamer, en geen achtergebleven stroom van het blad ervoor.
    await expect.poll(() => liveOpen, { timeout: 5_000 }).toBe(1);
    // Een andere kamer: het beeld stopt.
    await p.goto(`${baseUrl}/kamer.html#${encodeURIComponent(metKlimaat.id)}`);
    await expect.poll(() => liveOpen).toBe(0);

    // Een lamp: de schakelaar gaat via de deur naar Home Assistant.
    const voor = lightCalls.length;
    await p.goto(`${baseUrl}/kamer.html#${encodeURIComponent(metLamp.id)}`);
    const schakel = p.locator('#wand [data-blad] [data-schakel]').first();
    const was = await schakel.getAttribute('aria-checked');
    await schakel.click();
    await expect.poll(() => lightCalls.length).toBeGreaterThan(voor);
    // Home Assistant meldt de nieuwe stand hier nooit: de schakelaar blijft toch
    // staan op wat je koos, en springt niet terug (besluit 128).
    await p.waitForTimeout(1500);
    expect(await p.locator('#wand [data-blad] [data-schakel]').first().getAttribute('aria-checked')).toBe(String(was !== 'true'));

    // Scènes pas bij een lamp, en dan alleen die erbij horen, elke naam één keer.
    const metSfeer = kamers.find((r) => r.apparaten.some((d) => d.id === 'light.sfeerverlichting'))!;
    await p.goto(`${baseUrl}/kamer.html#${encodeURIComponent(metSfeer.id)}`);
    await p.locator('#wand [data-blad] .bladkop').waitFor();
    expect(await p.locator('#wand [data-blad] .scene').count()).toBe(0);
    await p.goto(`${baseUrl}/kamer.html#${encodeURIComponent(metSfeer.id)}/light.sfeerverlichting`);
    await p.locator('#wand [data-blad] .scene').first().waitFor();
    const namen = await p.locator('#wand [data-blad] .scene').allTextContents();
    expect(new Set(namen).size).toBe(namen.length);
    // Een scène kiezen gaat door de deur van de scènes (besluit 100).
    const scenesVoor = sceneCalls.length;
    await p.locator('#wand [data-blad] .scene').first().click();
    await expect.poll(() => sceneCalls.length).toBeGreaterThan(scenesVoor);
    expect(fouten).toEqual([]);
    await context.close();
  }, 40_000);

  /*
   * Kamers en indeling in ontwerp 2 (besluit 104; schets Wand-Indeling): een
   * kamer kiezen en hernoemen, een apparaat naar een andere kamer slepen, en
   * alles weer ongedaan maken. Alles via de deur van de indeling (besluit 96).
   */
  it('deelt het huis in op de wand: kiezen, hernoemen, slepen en ongedaan maken', async () => {
    const context = await browser.newContext({ viewport: { width: 1340, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    type Kamer = { id: string; naam: string; etage: string };
    const info = (await (await fetch(`${baseUrl}/api/indeling`)).json()) as { indeling: { kamers: Kamer[] } | null; voorstel: { kamers: Kamer[] } };
    const kamers = (info.indeling ?? info.voorstel).kamers;
    const huisNu = (await (await fetch(`${baseUrl}/api/huis`)).json()) as { etages: { ruimtes: { id: string; apparaten: { id: string }[] }[] }[] };
    const metApparaat = huisNu.etages.flatMap((e) => e.ruimtes).filter((r) => r.apparaten.length > 0);
    // Een kamer met een apparaat, en een andere kamer op dezelfde etage (niet buiten).
    const a = kamers.find((k) => k.etage !== 'buiten' && metApparaat.some((r) => r.id === k.id) && kamers.some((x) => x.etage === k.etage && x.id !== k.id && !/tuin|oprit/i.test(x.naam)))!;
    const b = kamers.find((x) => x.etage === a.etage && x.id !== a.id && !/tuin|oprit/i.test(x.naam))!;

    await p.goto(`${baseUrl}/indeling.html#${encodeURIComponent(a.id)}`);
    await p.locator('#wand [data-actie="kamernaam"]').waitFor({ timeout: 10_000 });
    // Als groep, net als Energie (besluit 193): de vier etages met Buiten, Nog in te delen en Verborgen, en de etage van de kamer gekozen.
    expect(await p.locator('#wand [data-delen] .deel:not(.erbij)').count()).toBe(6);
    expect(new URL(p.url()).hash).toBe(`#${encodeURIComponent(a.etage)}`);
    expect(await p.locator('#wand [data-delen] .deel.nu').getAttribute('href')).toBe(`#${encodeURIComponent(a.etage)}`);
    // De wand scrolt niet.
    expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);

    // Hernoemen, en ongedaan maken.
    await p.locator('#wand [data-actie="kamernaam"]').fill('Testkamer');
    await p.locator('#wand [data-actie="kamernaam"]').press('Tab');
    // Wachten op wat bewaard is, niet op een melding die alweer weg kan zijn;
    // en met een eigen grens, zodat een hapering zegt waar hij zat.
    const kort = { timeout: 5000 };
    await expect.poll(() => layoutStore.current?.kamers.find((k) => k.id === a.id)?.naam, kort).toBe('Testkamer');
    await p.locator('#wand [data-ongedaan]').click(kort);
    await expect.poll(() => layoutStore.current?.kamers.find((k) => k.id === a.id)?.naam, kort).toBe(a.naam);

    // Een apparaat uit het blad naar de andere kamer in het huis slepen.
    const rij = p.locator('#wand [data-blad] .app').first();
    const id = (await rij.getAttribute('data-app'))!;
    // Na "Ongedaan maken" tekent het blad zich opnieuw: wachten tot de rij stilstaat.
    await rij.hover({ position: { x: 20, y: 10 }, ...kort });
    let van: { x: number; y: number; width: number; height: number } | null = null;
    await expect.poll(async () => (van = await rij.boundingBox()), kort).not.toBeNull();
    van = van!;
    const naar = (await p.locator(`#wand .sc-tik[data-kamer="${b.id}"]`).boundingBox())!;
    await p.mouse.down();
    await p.mouse.move(van.x - 40, van.y + 10, { steps: 4 });
    await p.mouse.move(naar.x + naar.width / 2, naar.y + naar.height / 2, { steps: 8 });
    await p.mouse.up();
    await expect.poll(() => layoutStore.current?.apparaten[id]?.kamer, kort).toBe(b.id);
    // Na het neerzetten staat de andere kamer open.
    await expect.poll(() => p.locator('#wand [data-actie="kamernaam"]').inputValue(), kort).toBe(b.naam);
    await p.locator('#wand [data-ongedaan]').click(kort);
    await expect.poll(() => layoutStore.current?.apparaten[id]?.kamer ?? a.id, kort).toBe(a.id);

    // Zones met een soort, schuiven, en een kamer naar links of rechts (besluit 145).
    // Alleen het hekje wisselen opent de kamer niet, en opnieuw laden kon net te laat zijn: dan had de
    // pagina het adres al naar de etage gezet (CI, 28 oktober 2026). Daarom eerst weg, dan vers erheen.
    await p.goto('about:blank');
    await p.goto(`${baseUrl}/indeling.html#${encodeURIComponent(a.id)}`);
    await p.waitForLoadState('networkidle');
    await expect.poll(() => p.locator('#wand [data-actie="kamernaam"]').inputValue(), kort).toBe(a.naam);
    const zonesVan = () => layoutStore.current?.kamers.find((k) => k.id === a.id)?.zones ?? [];
    const voorZones = zonesVan().length;
    for (const naam of ['Keukenhoek', 'Bij het raam']) {
      await p.locator('#wand [data-nieuwe-zone]').fill(naam, kort);
      await p.locator('#wand [data-nieuwe-zone]').press('Tab');
      await expect.poll(() => zonesVan().some((z) => z.naam === naam), kort).toBe(true);
    }
    const raam = zonesVan().find((z) => z.naam === 'Bij het raam')!;
    await p.locator(`#wand [data-zone-soort="${raam.id}"]`).selectOption('woonkamer', kort);
    await expect.poll(() => zonesVan().find((z) => z.id === raam.id)?.soort, kort).toBe('woonkamer');
    await p.locator(`#wand [data-zone-schuif="-1"][data-zone="${raam.id}"]`).click(kort);
    await expect.poll(() => zonesVan().at(-2)?.id, kort).toBe(raam.id);
    const plek = () => (layoutStore.current?.kamers ?? []).filter((k) => k.etage === a.etage).findIndex((k) => k.id === a.id);
    const plekVoor = plek();
    const schuif = plekVoor === 0 ? '1' : '-1';
    await p.locator(`#wand [data-kamer-schuif="${schuif}"]`).click(kort);
    await expect.poll(plek, kort).toBe(plekVoor + Number(schuif));
    if (process.env.HEMS_PAGE_SHOT) {
      await p.locator(`#wand [data-zone-soort="${raam.id}"]`).scrollIntoViewIfNeeded();
      await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-zones.png') });
    }
    // En alles weer terug.
    // Elke stap even laten bewaren: vijf klikken vlak achter elkaar lieten er soms één vallen (CI, 24 oktober 2026).
    for (let n = 0; n < 5; n++) {
      await p.locator('#wand [data-ongedaan]').click(kort);
      await p.waitForTimeout(250);
    }
    await expect.poll(() => zonesVan().length, kort).toBe(voorZones);
    await expect.poll(plek, kort).toBe(plekVoor);

    // De gevel van een scherm kiezen (besluit 145).
    const metScreen = huisNu.etages.flatMap((e) => e.ruimtes).find((r) => r.apparaten.some((x) => x.id === 'cover.screen'))!;
    await p.goto('about:blank');
    await p.goto(`${baseUrl}/indeling.html#${encodeURIComponent(metScreen.id)}`);
    await p.waitForLoadState('networkidle');
    await p.locator('#wand .app[data-app="cover.screen"]').click(kort);
    await p.locator('#wand [data-app-gevel]').selectOption('achtergevel', kort);
    await p.locator('#wand [data-app-bewaar="cover.screen"]').click(kort);
    await expect.poll(() => layoutStore.current?.apparaten['cover.screen']?.gevel, kort).toBe('achtergevel');
    const huisNa = (await (await fetch(`${baseUrl}/api/huis`)).json()) as { etages: { ruimtes: { apparaten: { id: string; scherm?: { gevel?: { id: string; gekozen: boolean } } }[] }[] }[] };
    expect(huisNa.etages.flatMap((e) => e.ruimtes).flatMap((r) => r.apparaten).find((x) => x.id === 'cover.screen')?.scherm?.gevel).toMatchObject({ id: 'achtergevel', gekozen: true });
    await p.locator('#wand [data-ongedaan]').click(kort);
    await expect.poll(() => layoutStore.current?.apparaten['cover.screen']?.gevel, kort).toBeUndefined();

    // Een etage toevoegen, verschuiven en weer weghalen (besluit 112).
    await p.locator('#wand [data-delen] .deel.erbij').click(kort);
    await p.locator('#wand [data-etage-vast]', { hasText: 'Kelder' }).click(kort);
    await expect.poll(() => layoutStore.current?.volgorde?.at(-1), kort).toBe('kelder');
    await p.locator('#wand [data-delen] .deel.nu', { hasText: 'Kelder' }).waitFor(kort);
    await p.locator('#wand [data-etage-schuif="-1"]').click(kort);
    await expect.poll(() => layoutStore.current?.volgorde?.at(-2), kort).toBe('kelder');
    await p.locator('#wand [data-etage-weg]').click(kort);
    await expect.poll(() => layoutStore.current?.volgorde?.includes('kelder'), kort).toBe(false);

    // Een buitenruimte: kiezen wat het is, uit een eigen lijst zoals binnen (besluiten 109 en 167).
    const tuin = (layoutStore.current?.kamers ?? kamers).find((k) => k.etage === 'buiten' && !/oprit/i.test(k.naam))!;
    await p.goto(`${baseUrl}/indeling.html#${encodeURIComponent(tuin.id)}`);
    // De pagina tekent opnieuw zodra alles binnen is; eerst rustig laten worden, en
    // kiest het toch net tijdens het tekenen, dan nog eens (in de CI eens misgegaan).
    await p.waitForLoadState('networkidle');
    const soortNu = () => layoutStore.current?.kamers.find((k) => k.id === tuin.id)?.buiten?.soort;
    const lijst = p.locator('#wand [data-actie="buitensoort"]');
    // Op een drukke CI-machine duurt het tekenen soms langer dan vijf tellen (30 oktober 2026).
    await lijst.waitFor({ timeout: 15_000 });
    expect(await lijst.locator('option').allTextContents()).toEqual(expect.arrayContaining(['Achtertuin', 'Zijtuin', 'Carport', 'Dakterras', 'Tuinhuis of schuur']));
    expect(await lijst.locator('option').allTextContents()).not.toContain('Slaapkamer');
    await expect
      .poll(async () => {
        if (soortNu() !== 'terras') await lijst.selectOption('terras', { timeout: 1500 }).catch(() => undefined);
        return soortNu();
      }, { timeout: 10_000 })
      .toBe('terras');
    await expect.poll(() => lijst.inputValue(), kort).toBe('terras');
    // De zones buiten hebben hun eigen lijst: een border, een tuinhuis.
    await p.locator('#wand [data-nieuwe-zone]').fill('Border');
    await p.locator('#wand [data-nieuwe-zone]').press('Tab');

    const zoneLijst = p.locator('#wand [data-zone-soort="border"]');
    await zoneLijst.waitFor(kort);
    expect(await zoneLijst.locator('option').first().textContent()).toBe('Uit de naam: Border');
    expect(await zoneLijst.locator('option').allTextContents()).not.toContain('Zithoek');
    await zoneLijst.selectOption('tuinhuis');
    await expect.poll(() => layoutStore.current?.kamers.find((k) => k.id === tuin.id)?.zones.find((z) => z.naam === 'Border')?.soort, kort).toBe('tuinhuis');
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Kamers en indeling als groep (besluit 193): op de telefoon eerst de lijst,
   * een etage als eigen scherm met terug naar de lijst. Bij Buiten wat er rond
   * het huis is, zoals bij Inrichten: de garage en de carport gaan aan en staan
   * in de tekening, ook zonder dak.
   */
  it('opent Kamers en indeling op de telefoon met een keuzepagina, en zet buiten een garage en carport aan', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const voor = layoutStore.current ? structuredClone(layoutStore.current) : null;
    const kort = { timeout: 5000 };
    const tel = p.locator('#tel');
    await p.goto(`${baseUrl}/indeling.html`);
    // Eerst alleen de lijst.
    const lijst = tel.locator('[data-delen]');
    await lijst.locator('.deel', { hasText: 'Begane grond' }).waitFor({ timeout: 10_000 });
    expect(await tel.locator('[data-vorm]').isVisible()).toBe(false);
    expect(await lijst.locator('.deel.erbij').count()).toBe(1);
    // Een etage opent als eigen scherm, met de tekening en het blad.
    await lijst.locator('.deel', { hasText: 'Begane grond' }).click();
    await tel.locator('[data-deelkop]', { hasText: 'Begane grond' }).waitFor(kort);
    expect(await lijst.isVisible()).toBe(false);
    await tel.locator('#podium-tel svg.sc-huis').waitFor(kort);
    await tel.locator('[data-blad] [data-actie="etagenaam"]').waitFor(kort);
    expect(await tel.locator('[data-terug]').textContent()).toContain('Kamers en indeling');
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-indeling-tel.png'), fullPage: true });
    // Terug naar de lijst.
    await tel.locator('[data-terug]').click();
    await lijst.waitFor({ state: 'visible', ...kort });

    // Buiten: wat er rond het huis is.
    await lijst.locator('.deel', { hasText: 'Buiten' }).click();
    const rond = () => layoutStore.current?.rond;
    const schakel = (w: string) => tel.locator(`[data-blad] [data-rond="${w}"]`);
    await schakel('garage').waitFor(kort);
    for (const w of ['oprit', 'garage', 'carport']) {
      if ((await schakel(w).getAttribute('aria-checked')) !== 'true') {
        await schakel(w).click(kort);
        await expect.poll(() => rond()?.[w as 'oprit'], kort).toBe(true);
        await tel.locator(`[data-blad] [data-rond="${w}"][aria-checked="true"]`).waitFor(kort);
      }
    }
    expect(rond()).toMatchObject({ oprit: true, garage: true, carport: true });
    if (process.env.HEMS_PAGE_SHOT) {
      await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-indeling-tel-buiten.png'), fullPage: true });
      // En op de wand: Buiten, en Nog in te delen.
      const wand = await context.newPage();
      await wand.setViewportSize({ width: 1280, height: 800 });
      for (const deel of ['buiten', 'los', 'bg']) {
        await wand.goto(`${baseUrl}/indeling.html#${deel}`);
        await wand.waitForLoadState('networkidle');
        await wand.waitForTimeout(400);
        await wand.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', `-indeling-wand-${deel}.png`) });
      }
      await wand.close();
    }
    // In de lijst zegt Buiten wat er aan staat.
    await tel.locator('[data-terug]').click();
    expect(await lijst.locator('.deel', { hasText: 'Buiten' }).textContent()).toMatch(/garage/i);

    // Een garage aanvinken zet hem op zijn vaste plek; een ruimte erbij maken hoeft niet meer (28 oktober 2026).
    const basis = structuredClone(layoutStore.current!);
    await layoutStore.save({ ...basis, rond: { ...basis.rond!, garage: false } });
    const huisNu = (await (await fetch(`${baseUrl}/api/huis`)).json()) as HouseReport;
    expect(huisNu.rond?.garage).toBe(false);
    await p.goto('about:blank');
    await p.goto(`${baseUrl}/indeling.html#buiten`);
    await tel.locator('[data-blad] [data-rond="garage"]').click({ timeout: 10_000 });
    await expect.poll(() => rond()?.garage, kort).toBe(true);
    // Geen keuzelijst meer met de ruimte uit Home Assistant, en geen veld voor een nieuwe ruimte.
    expect(await tel.locator('[data-blad] select[data-bkoppel], [data-blad] [data-nieuwe-kamer]').count()).toBe(0);
    expect(fouten).toEqual([]);
    if (voor) await layoutStore.save(voor);
    await context.close();
  }, 30_000);

  /*
   * Buiten als echte plekken (besluit 269, issues 152 en 153): de voordeur is er
   * altijd, en elk deel rond het huis dat aan staat kan apparaten hebben, ook
   * zonder gebied in Home Assistant. De app maakt de plek aan als je hem opent
   * of er een apparaat heen zet. Op Thuis opent een tik op de voordeur zijn blad.
   */
  it('maakt buiten plekken voor apparaten, ook zonder gebied in Home Assistant, met de voordeur (besluit 269)', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const kort = { timeout: 5000 };
    // Zonder eigen indeling (deze test alleen): het voorstel uit Home Assistant.
    const start = layoutStore.current ? structuredClone(layoutStore.current) : null;
    const voor = start ?? ((await (await fetch(`${baseUrl}/api/indeling`)).json()) as { voorstel: NonNullable<typeof start> }).voorstel;
    // Een garage die aan staat, maar zonder ruimte; en nog geen voordeur.
    const weg = new Set(voor.kamers.filter((k) => k.etage === 'buiten' && (k.buiten?.soort === 'garage' || k.buiten?.soort === 'voordeur' || /garage|voordeur/i.test(k.naam))).map((k) => k.id));
    const rondAlles = { oprit: true, auto: false, voortuin: false, tuin: true, terras: false, balkon: false, tuinhuis: false, garage: true, carport: false, schuur: false, jacuzzi: false, border: false, allebei: false };
    const opgeslagen = await layoutStore.save({
      ...voor,
      rond: { ...rondAlles, ...voor.rond, garage: true },
      kamers: voor.kamers.filter((k) => !weg.has(k.id)),
      apparaten: Object.fromEntries(Object.entries(voor.apparaten).filter(([, a]) => !weg.has(a.kamer))),
    });
    expect(opgeslagen).toMatchObject({ ok: true });
    try {
      await p.goto(`${baseUrl}/indeling.html#buiten`);
      const deur = p.locator('#wand [data-blad] [data-plek="voordeur"]');
      await deur.waitFor({ timeout: 15_000 });
      expect(await p.locator('#wand [data-blad] [data-plek="garage"]').count()).toBe(1);
      expect(await p.locator('#wand [data-blad]').textContent()).toContain('Heeft Home Assistant er een gebied voor');
      // De voordeur openen maakt de plek aan, zonder gebied in Home Assistant.
      await deur.click();
      const plek = (soort: string) => layoutStore.current?.kamers.find((k) => k.buiten?.soort === soort);
      await expect.poll(() => plek('voordeur')?.naam, kort).toBe('Voordeur');
      expect(plek('voordeur')).toMatchObject({ etage: 'buiten', haGebied: null, zones: [] });
      await expect.poll(() => p.locator('#wand [data-actie="kamernaam"]').inputValue(kort), kort).toBe('Voordeur');

      // Een apparaat naar de garage, die nog geen ruimte had: binnen en buiten staan apart.
      const huis = (await (await fetch(`${baseUrl}/api/huis`)).json()) as HouseReport;
      const kamer = huis.etages.filter((e) => e.id !== 'buiten').flatMap((e) => e.ruimtes).find((r) => r.apparaten.length > 0)!;
      const dev = kamer.apparaten[0]!;
      await p.goto(`${baseUrl}/indeling.html#${encodeURIComponent(kamer.id)}`);
      await p.waitForLoadState('networkidle');
      await p.locator(`#wand [data-blad] [data-app="${dev.id}"]`).first().click({ timeout: 15_000 });
      const keuze = p.locator('#wand [data-app-kamer]');
      await keuze.waitFor(kort);
      expect(await keuze.locator('optgroup').evaluateAll((g) => g.map((x) => x.getAttribute('label')))).toEqual(['Binnen', 'Buiten']);
      expect(await keuze.locator('optgroup[label="Buiten"] option').allTextContents()).toEqual(expect.arrayContaining(['Voordeur', 'Garage']));
      await keuze.selectOption('plek:garage');
      await p.locator('#wand [data-app-bewaar]').click(kort);
      await expect.poll(() => plek('garage')?.naam, kort).toBe('Garage');
      await expect.poll(() => layoutStore.current?.apparaten[dev.id]?.kamer, kort).toBe(plek('garage')!.id);

      // Op Thuis: een tik op de voordeur opent zijn blad.
      await p.goto(`${baseUrl}/thuis.html`);
      const tik = p.locator(`svg .sc-tik[data-kamer="${plek('voordeur')!.id}"]`).locator('visible=true').first();
      await tik.waitFor({ timeout: 15_000 });
      await tik.click({ force: true });
      await p.locator('.weerkop h2', { hasText: 'Voordeur' }).locator('visible=true').first().waitFor(kort);
      expect(fouten).toEqual([]);
    } finally {
      if (start) await layoutStore.save(start);
      await context.close();
    }
  }, 45_000);

  /*
   * De thuisaccu op zijn plek (besluit 270, idee 123): aan de gevel, in de
   * garage, of binnen in een kamer. Bij Buiten kies je het; in de garage staat
   * hij op Thuis ook in het blad van de garage.
   */
  it('zet de thuisaccu in de garage of binnen, en toont hem in het blad van de garage (besluit 270)', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const kort = { timeout: 5000 };
    const start = layoutStore.current ? structuredClone(layoutStore.current) : null;
    const voor = start ?? ((await (await fetch(`${baseUrl}/api/indeling`)).json()) as { voorstel: NonNullable<typeof start> }).voorstel;
    const rondAlles = { oprit: true, auto: false, voortuin: false, tuin: true, terras: false, balkon: false, tuinhuis: false, garage: true, carport: false, schuur: false, jacuzzi: false, border: false, allebei: false };
    const { accu: _weg, ...zonder } = voor;
    expect(await layoutStore.save({ ...zonder, rond: { ...rondAlles, ...voor.rond, garage: true } })).toMatchObject({ ok: true });
    extraOpslag = { batterij: { id: 'sessy', naam: 'Sessy', pct: 64, vermogenW: 1200, stand: 'laadt' }, auto: null, autos: [] };
    try {
      await p.goto(`${baseUrl}/indeling.html#buiten`);
      const keuze = p.locator('#wand [data-blad] [data-actie="accuplek"]');
      await keuze.waitFor({ timeout: 15_000 });
      expect(await keuze.inputValue()).toBe('gevel');
      expect(await p.locator('#wand [data-blad] label[for="accuplek"]').textContent()).toBe('Waar staat Sessy?');
      await keuze.selectOption('garage');
      await expect.poll(() => layoutStore.current?.accu, kort).toEqual({ plek: 'garage', kamer: null });

      // De garage als plek, en op Thuis zijn blad met de accu.
      await p.locator('#wand [data-blad] [data-plek="garage"]').click(kort);
      const garage = () => layoutStore.current?.kamers.find((k) => k.buiten?.soort === 'garage');
      await expect.poll(() => garage()?.id, kort).toBeTruthy();
      await p.goto(`${baseUrl}/thuis.html`);
      const tik = p.locator(`svg .sc-tik[data-kamer="${garage()!.id}"]`).locator('visible=true').first();
      await tik.waitFor({ timeout: 15_000 });
      await tik.click({ force: true });
      const vak = p.locator('.bb-auto', { hasText: 'Sessy' }).locator('visible=true').first();
      await vak.waitFor(kort);
      expect(await vak.textContent()).toContain('64%');
      expect(await vak.textContent()).toContain('laadt');

      // Binnen: in een kamer die bestaat.
      const huis = (await (await fetch(`${baseUrl}/api/huis`)).json()) as HouseReport;
      const kamer = huis.etages.filter((e) => e.id !== 'buiten').flatMap((e) => e.ruimtes)[0]!;
      await p.goto(`${baseUrl}/indeling.html#buiten`);
      await keuze.waitFor({ timeout: 15_000 });
      await keuze.selectOption(`binnen:${kamer.id}`);
      await expect.poll(() => layoutStore.current?.accu, kort).toEqual({ plek: 'binnen', kamer: kamer.id });
      expect(((await (await fetch(`${baseUrl}/api/huis`)).json()) as HouseReport).accu).toEqual({ plek: 'binnen', kamer: kamer.id });
      // Een kamer die niet bestaat, of buiten, neemt de dienst niet aan.
      expect(await layoutStore.save({ ...layoutStore.current!, accu: { plek: 'binnen', kamer: 'bestaat-niet' } })).toMatchObject({ ok: false });
      expect(fouten).toEqual([]);
    } finally {
      extraOpslag = null;
      if (start) await layoutStore.save(start);
      await context.close();
    }
  }, 45_000);

  /*
   * De stromen van en naar de thuisaccu (besluit 273): op Thuis een lijn naar
   * de accu als hij laadt en eruit als hij levert, met een label; ook als hij
   * binnen staat. Bij Opbrengst › Nu Naar de accu en Uit de accu.
   */
  it('tekent de stromen van en naar de thuisaccu, op Thuis en bij Opbrengst Nu (besluit 273)', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    // Eerst laadt hij 1,5 kW met zon; daarna levert hij 1 kW 's avonds.
    let stromen: Record<string, unknown> = { zonKw: 3, netKw: -0.5, verbruikKw: 1, aircoKw: 0, huisKw: 1, geplandKw: 0, accuKw: 1.5 };
    await context.route(`${baseUrl}/api/state`, async (route) => {
      const r = await route.fetch();
      const j = (await r.json()) as { bewoner?: { stromen?: unknown } };
      if (j.bewoner) j.bewoner.stromen = stromen;
      await route.fulfill({ response: r, json: j });
    });
    let binnen: { plek: 'binnen'; kamer: string } | null = null;
    await context.route(`${baseUrl}/api/huis`, async (route) => {
      const r = await route.fetch();
      const j = (await r.json()) as HouseReport;
      await route.fulfill({ response: r, json: binnen ? { ...j, accu: binnen } : j });
    });
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    extraOpslag = { batterij: { id: 'sessy', naam: 'Sessy', pct: 64, vermogenW: 1500, stand: 'laadt' }, auto: null, autos: [] };
    const huisSvg = p.locator('#wand svg.sc-huis').first();
    // Een stroom is een stippellijn; 's avonds zonder beweging, dus zonder zijn klasse.
    const lijnIn = (kleur: string) => huisSvg.locator(`polyline[stroke-dasharray="1 11"][stroke="${kleur}"]`).count();
    try {
      await p.goto(`${baseUrl}/thuis.html`);
      await huisSvg.locator('text', { hasText: 'de accu laadt' }).waitFor({ timeout: 15_000 });
      expect(await huisSvg.textContent()).toContain('1,5 kW');
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-thuis-accu-laadt.png') });
      // Hij levert: een ijsblauwe lijn uit de accu.
      stromen = { zonKw: 0, netKw: 0.2, verbruikKw: 1.2, aircoKw: 0, huisKw: 1.2, geplandKw: 0, accuKw: -1 };
      extraOpslag = { batterij: { id: 'sessy', naam: 'Sessy', pct: 40, vermogenW: -1000, stand: 'levert' }, auto: null, autos: [] };
      await p.reload();
      await huisSvg.locator('text', { hasText: 'uit de accu' }).waitFor({ timeout: 15_000 });
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-thuis-accu-levert.png') });
      expect(await lijnIn('#6FD3FF')).toBeGreaterThan(0);
      // Binnen in een kamer: de lijn komt uit de kast in die kamer.
      const huis = (await (await fetch(`${baseUrl}/api/huis`)).json()) as HouseReport;
      binnen = { plek: 'binnen', kamer: huis.etages.filter((e) => e.id !== 'buiten').flatMap((e) => e.ruimtes)[0]!.id };
      await p.reload();
      await huisSvg.locator('text', { hasText: 'uit de accu' }).waitFor({ timeout: 15_000 });
      expect(await lijnIn('#6FD3FF')).toBeGreaterThan(0);
      if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-thuis-accu-binnen.png') });
      // Opbrengst › Nu: uit de accu als bron.
      await p.goto(`${baseUrl}/opbrengst.html`);
      const wand = p.locator('#wand');
      await wand.locator('[data-soort="nu"]').click();
      await wand.locator('[data-sankey] svg text', { hasText: 'Uit de accu' }).waitFor({ timeout: 10_000 });
      // En als hij laadt: naar de accu als bestemming.
      stromen = { zonKw: 3, netKw: -0.5, verbruikKw: 1, aircoKw: 0, huisKw: 1, geplandKw: 0, accuKw: 1.5 };
      await wand.locator('[data-sankey] svg text', { hasText: 'Naar de accu' }).waitFor({ timeout: 10_000 });
      expect(await wand.locator('[data-sankey]').textContent()).toContain('1,5 kW');
      expect(fouten).toEqual([]);
    } finally {
      extraOpslag = null;
      await context.close();
    }
  }, 60_000);

  /*
   * Het blad van een stekker (7 november 2026, op de wand): Zet uit is meteen
   * uit, zonder hoe lang of eindtijd. Tot hoe laat is een keuzelijst per
   * kwartier: een klok vroeg op een Android-wand eerst om het toetsenbord.
   */
  it('zet een stekker meteen uit, en kiest de tijd uit een lijst', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'UTC', locale: 'nl-NL' });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    const fouten: string[] = [];
    p.on('pageerror', (e) => fouten.push(e.message));
    const kort = { timeout: 5000 };
    const gestuurd: unknown[] = [];
    await p.route('**/api/stekker', async (route) => {
      if (route.request().method() === 'POST') {
        gestuurd.push(route.request().postDataJSON());
        await route.fulfill({ json: { ok: true } });
        return;
      }
      await route.fulfill({ json: { aan: true, stekkers: [{ id: 'tuinhuis', naam: 'Tuinhuis', aan: true, vermogenW: 900, mag: true, toegelaten: true, actief: null }] } });
    });
    await p.goto(`${baseUrl}/apparaten.html`);
    await p.waitForFunction(() => typeof (globalThis as unknown as { hand?: unknown }).hand === 'object');
    await p.evaluate(() => (globalThis as unknown as { hand: { openStekker: (id: string) => Promise<void> } }).hand.openStekker('tuinhuis'));
    const blad = p.locator('[data-hand]');
    // Hij staat aan: het blad begint bij Zet uit, zonder hoe lang en zonder balk.
    await blad.locator('[data-st-aan="uit"][aria-pressed="true"]').waitFor(kort);
    expect(await blad.locator('[data-st-tot]').count()).toBe(0);
    expect(await blad.locator('[data-st-zet]').textContent()).toBe('Zet uit');
    expect(await blad.textContent()).toContain('Gaat meteen uit');
    await blad.locator('[data-st-zet]').click();
    await expect.poll(() => gestuurd.length, kort).toBe(1);
    expect(gestuurd[0]).toEqual({ id: 'tuinhuis', aan: false, meteen: true });

    // Aan tot een tijd: een keuzelijst, geen klok. Eerst is het blad dicht.
    await blad.waitFor({ state: 'detached', ...kort });
    await p.evaluate(() => (globalThis as unknown as { hand: { openStekker: (id: string) => Promise<void> } }).hand.openStekker('tuinhuis'));
    await blad.locator('[data-st-aan="aan"]').click(kort);
    await blad.locator('[data-st-tot="tijd"]').click(kort);
    const tijd = blad.locator('select[data-st-tijd]');
    await tijd.waitFor(kort);
    expect(await blad.locator('input[type="time"]').count()).toBe(0);
    expect(await tijd.locator('option').count()).toBeGreaterThanOrEqual(96);
    await tijd.selectOption('23:45');
    await expect.poll(() => blad.locator('[data-st-zet]').textContent(), kort).toBe('Zet aan tot 23:45');
    await blad.locator('[data-st-zet]').click();
    await expect.poll(() => gestuurd.length, kort).toBe(2);
    expect(gestuurd[1]).toEqual({ id: 'tuinhuis', aan: true, klok: '23:45' });
    expect(fouten).toEqual([]);
    await context.close();
  }, 30_000);

  /*
   * Inloggen via Home Assistant op een andere site (16 oktober 2026): na het
   * inloggen kom je echt binnen. Het cookie is SameSite=Strict, en ging bij een
   * doorverwijzing vanaf de site van Home Assistant niet mee: dan stond je
   * weer bij het inloggen.
   */
  it('laat je na het inloggen bij Home Assistant echt binnen, ook vanaf een andere site', async () => {
    // Het nagemaakte Home Assistant, op localhost: voor de browser een andere site dan 127.0.0.1.
    const ha = createServer((req, res) => {
      const state = new URL(req.url ?? '/', 'http://localhost').searchParams.get('state') ?? '';
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<script>location.href = ${JSON.stringify(`${baseUrl}/auth/callback?code=abc&state=`)} + ${JSON.stringify(state)};</script>`);
    });
    await new Promise<void>((r) => ha.listen(0, 'localhost', () => r()));
    const vorige = haInlog;
    haInlog = `http://localhost:${(ha.address() as { port: number }).port}/`;
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, zonderInlog: true } as BrowserContextOptions);
    await context.route((url) => !url.href.startsWith(baseUrl) && url.hostname !== 'localhost', (route) => route.abort());
    const p = await context.newPage();
    try {
      await p.goto(`${baseUrl}/vandaag.html`);
      await p.waitForURL(/\/inloggen\.html/);
      await p.locator('a', { hasText: 'Inloggen met Home Assistant' }).click();
      await p.waitForURL(/\/vandaag\.html$/, { timeout: 15_000 });
      await p.waitForTimeout(800);
      expect(new URL(p.url()).pathname).toBe('/vandaag.html');
    } finally {
      // Ook als het misgaat: anders gaat de volgende test naar dit nagemaakte Home Assistant.
      await context.close();
      haInlog = vorige;
      ha.close();
    }
  }, 30_000);

  /*
   * De app vanaf het startscherm (23 oktober 2026): Android opent hem als
   * kwam je van buiten, en dan gaat het strikte cookie niet mee. Je bent wel
   * ingelogd; de inlogpagina ziet dat en gaat meteen door, zonder Home
   * Assistant.
   */
  it('laat wie al ingelogd is meteen door als de app van buiten opent, zonder opnieuw in te loggen', async () => {
    const buiten = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<a id="open" href="${baseUrl}/vandaag.html">open</a>`);
    });
    await new Promise<void>((r) => buiten.listen(0, 'localhost', () => r()));
    const sessie = await sessions.create({ userId: 'u', naam: 'Test', rol: 'beheerder' });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, zonderInlog: true } as BrowserContextOptions);
    await context.addCookies([{ name: 'hems_sessie', value: sessie, url: baseUrl, sameSite: 'Strict', httpOnly: true }]);
    await context.route((url) => !url.href.startsWith(baseUrl) && url.hostname !== 'localhost', (route) => route.abort());
    const p = await context.newPage();
    const naarHa: string[] = [];
    p.on('request', (r) => { if (new URL(r.url()).pathname === '/auth/login') naarHa.push(r.url()); });
    try {
      // Een andere site opent de app: de dienst ziet het cookie niet en stuurt naar het inloggen.
      await p.goto(`http://localhost:${(buiten.address() as { port: number }).port}/`);
      await p.click('#open');
      await p.waitForURL(/\/vandaag\.html$/, { timeout: 10_000 });
      await p.waitForTimeout(500);
      expect(new URL(p.url()).pathname).toBe('/vandaag.html');
      expect(naarHa).toEqual([]);
    } finally {
      await context.close();
      buiten.close();
    }
  }, 30_000);

  it('stuurt wie niet is ingelogd naar het inloggen, en van daar naar Home Assistant (besluit 99 en 147)', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, zonderInlog: true } as BrowserContextOptions);
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    // De hele app vraagt een inlog: een pagina gaat naar het inloggen, met de weg terug.
    await p.goto(`${baseUrl}/toegang.html`);
    await p.waitForURL(/\/inloggen\.html\?terug=%2Ftoegang\.html$/);
    const inlog = p.locator('a', { hasText: 'Inloggen met Home Assistant' });
    await inlog.waitFor();
    // Zonder te volgen: de dienst stuurt door naar het inlogscherm van Home Assistant.
    const go = p.waitForRequest((r) => new URL(r.url()).pathname === '/auth/login');
    await inlog.click();
    expect(new URL((await go).url()).searchParams.get('terug')).toBe('/toegang.html');
    await context.close();
  }, 20_000);

  /*
   * Bewoners (besluit 147): de eerste inlog als scherm en als bewoner, de
   * pagina Bewoners, Thuis met de begroeting en het comfort dat geldt, en
   * Comfort van een ander.
   */
  it('laat bewoners binnen bij hun eerste inlog, en toont wie er thuis is en wiens comfort geldt', async () => {
    const shot = async (pp: Page, naam: string) => {
      if (process.env.HEMS_PAGE_SHOT) await pp.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', `-${naam}.png`) });
    };
    const kort = { timeout: 5000 };
    await bewonersStore.save(GEEN_BEWONERS);

    // De wand: een account zonder persoon kiest "Dit is een scherm" en wordt geen bewoner.
    const wandSessie = await sessions.create({ userId: 'u-wand', naam: 'Wand', rol: 'bewoner' });
    const wand = await browser.newContext({ viewport: { width: 1280, height: 800 }, zonderInlog: true } as BrowserContextOptions);
    await wand.addCookies([{ name: 'hems_sessie', value: wandSessie, url: baseUrl }]);
    await wand.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const w = await wand.newPage();
    await w.goto(`${baseUrl}/welkom.html?terug=%2Fthuis.html#vraag`);
    await w.locator('h1', { hasText: 'Woon je hier, of is dit een scherm?' }).waitFor();
    await shot(w, 'welkom-vraag');
    await w.locator('[data-keus="scherm"]').click();
    await w.locator('[data-verder]').click();
    await w.waitForURL(/\/thuis\.html$/);
    expect(bewonersStore.current.schermen['u-wand']?.naam).toBe('Wand');
    expect(bewonersStore.current.volgorde).toEqual([]);
    // Een scherm blijft donker, ook als zijn account licht kiest (besluit 181).
    expect(await w.evaluate(`fetch('api/voorkeuren', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plek: 'tel', thema: 'licht' }) }).then((r) => r.ok)`)).toBe(true);
    await w.reload();
    await w.waitForTimeout(800);
    await w.reload();
    expect(await w.evaluate('document.documentElement.classList.contains("sc-licht")')).toBe(false);

    // De beheerder ("Test") woont hier: hij kiest wat hem volgt, en wordt de eerste, dus hoofdgebruiker.
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await ctx.newPage();
    await p.goto(`${baseUrl}/welkom.html?terug=%2Fbewoners.html#vraag`);
    await p.locator('[data-keus="bewoner"]').click();
    await p.locator('[data-verder]').click();
    await p.locator('h1', { hasText: 'Welke sensor ziet of je thuis bent?' }).waitFor();
    await p.locator('[data-bron="ricardo"]').click();
    await p.locator('[data-klaar]').click();
    await p.locator('h1', { hasText: 'Welkom, Test' }).waitFor();
    // Klopt iets niet (besluit 158): open, met de weg naar Bewoners.
    await p.locator('details.nietgoed summary').click();
    await p.locator('details.nietgoed a[href="bewoners.html"]').waitFor();
    await shot(p, 'welkom');
    await p.locator('[data-naam]').fill('Ricardo');
    await p.locator('[data-klopt]').click();
    await p.waitForURL(/\/bewoners\.html$/);
    await expect.poll(() => bewonersStore.current.bewoners['test']?.naam, kort).toBe('Ricardo');
    expect(bewonersStore.current.bewoners['test']).toMatchObject({ aanwezigheid: 'ricardo', comfort: 'volgt' });

    // Noor logt later in; zij volgt eerst Ricardo.
    await bewonersStore.save(voegToe(bewonersStore.current, { userId: 'u-noor', naam: 'Noor Cornelissen' }, 'noor', Date.now()));
    await p.reload();
    const wandL = p.locator('#wand');
    await wandL.locator('[data-lijst] [data-rij]').nth(1).waitFor();
    expect(await wandL.locator('[data-lijst] [data-rij] b').allTextContents()).toEqual(['Ricardo (jij)', 'Noor']);
    await wandL.locator('[data-kies="noor"]').click();
    await wandL.locator('[data-blad] h2', { hasText: 'Noor' }).waitFor();
    await wandL.locator('[data-blad] [data-comfort="eigen"]').click();
    await expect.poll(() => bewonersStore.current.bewoners['noor']?.comfort, kort).toBe('eigen');
    /*
     * De volgorde met het greepje en de pijltjes: Noor omhoog maakt haar
     * hoofdgebruiker; en weer terug. De lijst tekent zichzelf opnieuw na elk
     * antwoord van de dienst, en een toets die net dan valt, gaat naar een rij
     * die er niet meer is. Dus opnieuw drukken tot de dienst het heeft: de
     * nieuwe volgorde komt uit wat er op het scherm staat, en bovenaan doet
     * omhoog niets, dus nog eens drukken geeft hetzelfde.
     */
    const omhoog = async (id: string, verwacht: string[]) => {
      await expect
        .poll(async () => {
          if (JSON.stringify(bewonersStore.current.volgorde) !== JSON.stringify(verwacht)) {
            await wandL.locator(`[data-greep="${id}"]`).focus();
            await p.keyboard.press('ArrowUp');
          }
          return bewonersStore.current.volgorde;
        }, kort)
        .toEqual(verwacht);
    };
    await omhoog('noor', ['noor', 'test']);
    await omhoog('test', ['test', 'noor']);
    await shot(p, 'bewoners');
    expect(await p.evaluate<boolean>('document.documentElement.scrollHeight <= innerHeight + 1')).toBe(true);
    // Op de telefoon: alles onder elkaar, niets zijwaarts buiten beeld.
    await p.setViewportSize({ width: 390, height: 844 });
    await p.locator('#tel [data-lijst] [data-rij]').nth(1).waitFor();
    expect(await p.evaluate<boolean>('document.documentElement.scrollWidth <= innerWidth + 1')).toBe(true);
    // De labels onder de naam, niet ernaast over de tekst heen (21 oktober 2026).
    const rij = p.locator('#tel [data-lijst] [data-rij]').first();
    // De lijst kan net opnieuw getekend worden (live, 21 oktober 2026): wachten tot de naam er staat.
    let naamVak: { y: number; height: number } | null = null;
    await expect.poll(async () => (naamVak = await rij.locator('b').first().boundingBox()), kort).not.toBeNull();
    naamVak = naamVak!;
    const labelVak = await rij.locator('.labels').boundingBox();
    if (labelVak) expect(labelVak.y).toBeGreaterThanOrEqual(naamVak.y + naamVak.height - 1);
    expect(naamVak.height).toBeLessThan(40);
    await shot(p, 'bewoners-tel');
    await p.setViewportSize({ width: 1280, height: 800 });

    // Thuis: Ricardo is weg, Noor is thuis. De begroeting noemt wie er ingelogd is; bovenin de rondjes (besluit 169):
    // Noor licht op en wordt gevolgd, Ricardo is grijs. Geen kaart meer.
    const voor = live;
    live = { ...live, explanation: { ...live.explanation, profile: { id: 'noor', name: 'Noor', reason: 'thuis', home: ['noor'] } } };
    // De rondjes volgen Home Assistant meteen (besluit 170): daar is Noor thuis en Ricardo weg.
    const persoon = (entity_id: string, state: string) => ({ entity_id, state, attributes: { friendly_name: entity_id }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString() });
    const ricardoWas = houseStates.get('person.ricardo_cornelissen');
    houseStates.set('person.noor', persoon('person.noor', 'home'));
    houseStates.set('person.ricardo_cornelissen', persoon('person.ricardo_cornelissen', 'not_home'));
    await p.goto(`${baseUrl}/thuis.html`);
    await wandL.locator('[data-groet]', { hasText: 'Ricardo' }).waitFor();
    const wie = wandL.locator('[data-wie]');
    await wie.locator('i.geldt', { hasText: 'N' }).waitFor(kort);
    expect(await wie.locator('i.afwezig').count()).toBe(1);
    expect(await wandL.locator('[data-geldt]').count()).toBe(0);
    // Live (21 oktober 2026): Ricardo komt thuis, de dienst zegt het, en Thuis ziet het zonder te herladen.
    houseStates.set('person.ricardo_cornelissen', persoon('person.ricardo_cornelissen', 'home'));
    server.bewonersVeranderd();
    await expect.poll(() => wie.locator('i.afwezig').count(), kort).toBe(0);
    houseStates.set('person.ricardo_cornelissen', persoon('person.ricardo_cornelissen', 'not_home'));
    server.bewonersVeranderd();
    await expect.poll(() => wie.locator('i.afwezig').count(), kort).toBe(1);
    // Een tik: het blad met iedereen; vanzelf staat aan, en Ricardo kiezen houdt zijn comfort vast.
    await wie.click();
    const wieBlad = p.locator('[data-kiesblad]');
    await wieBlad.locator('h2', { hasText: 'Wiens comfort geldt?' }).waitFor(kort);
    await wieBlad.locator('[data-wie-kies=""][aria-checked="true"]').waitFor(kort);
    expect(await wieBlad.locator('[data-wie-kies="test"]').textContent()).toContain('weg');
    await shot(p, 'thuis-geldt');
    await wieBlad.locator('[data-wie-kies="test"]').click();
    await expect.poll(() => bewonersStore.current.vasthouden, kort).toMatchObject({ id: 'test', home: ['noor'] });
    await wieBlad.locator('[data-blad-dicht]').click();
    // Op de telefoon rechts van de begroeting, op één regel, zonder kaart eronder.
    await p.setViewportSize({ width: 390, height: 844 });
    await p.locator('#tel [data-wie] i').first().waitFor(kort);
    expect(await p.evaluate<boolean>('document.documentElement.scrollWidth <= innerWidth + 1')).toBe(true);
    // De begroeting blijft op één regel, ook met de stand ernaast.
    const groetHoog = await p.locator('#tel [data-groet]').evaluate((el) => el.getBoundingClientRect().height);
    expect(groetHoog).toBeLessThan(26);
    await shot(p, 'thuis-tel-wie');
    // Ieder zijn eigen kleur op volgorde (besluit 181): Noor is de tweede, dus framboos.
    expect(await p.locator('#tel [data-wie] i', { hasText: 'N' }).getAttribute('data-kleur')).toBe('framboos');
    // In het licht een lichte ring tussen de bollen, geen donkere.
    const thema = (t: string) => p.evaluate(`fetch('api/voorkeuren', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plek: 'tel', thema: '${t}' }) }).then((r) => r.ok)`);
    expect(await thema('licht')).toBe(true);
    await p.reload();
    await p.locator('#tel [data-wie] i').first().waitFor(kort);
    expect(await p.evaluate('document.documentElement.classList.contains("sc-licht")')).toBe(true);
    expect(await p.evaluate('getComputedStyle(document.querySelector("#tel [data-wie] i")).boxShadow')).toContain('rgb(228, 234, 242)');
    // Je naam in je eigen kleur: lucht, in het licht de donkere tint.
    expect(await p.evaluate('getComputedStyle(document.querySelector("#tel [data-groet] b")).color')).toBe('rgb(11, 111, 164)');
    await shot(p, 'thuis-tel-wie-licht');
    expect(await thema('donker')).toBe(true);
    await p.setViewportSize({ width: 1280, height: 800 });

    // Comfort van Noor, bekeken door de hoofdgebruiker: met de keuze wiens comfort.
    await p.goto(`${baseUrl}/comfort.html?bewoner=noor`);
    await wandL.locator('[data-titel]', { hasText: 'Comfort van Noor' }).waitFor();
    expect(await wandL.locator('[data-wie] option').count()).toBe(2);
    await shot(p, 'comfort-noor');

    // Een gast (besluit 147): Noor wordt gast. Ze staat dan bij Schermen en gasten, niet in de volgorde.
    await p.goto(`${baseUrl}/bewoners.html#noor`);
    await wandL.locator('[data-blad] [data-gast="ja"]').click();
    await expect.poll(() => bewonersStore.current.bewoners['noor']?.gast, kort).toBe(true);
    expect(bewonersStore.current.volgorde).toEqual(['test']);
    await wandL.locator('[data-schermen] .gastrij', { hasText: 'Noor' }).waitFor();
    await shot(p, 'bewoners-gast');
    // Home Assistant weer zoals het was: Noor is er niet.
    houseStates.delete('person.noor');
    if (ricardoWas) houseStates.set('person.ricardo_cornelissen', ricardoWas);
    else houseStates.delete('person.ricardo_cornelissen');
    // Als gast: bedienen alleen thuis, en verder niets.
    const gastSessie = await sessions.create({ userId: 'u-noor', naam: 'Noor Cornelissen', rol: 'beheerder' });
    const alsGast = (pad: string, body: unknown) => fetch(`${baseUrl}${pad}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: baseUrl, cookie: `hems_sessie=${gastSessie}` }, body: JSON.stringify(body) });
    const lamp = { doel: 'huis', id: null, aan: false };
    const weg = await alsGast('/api/licht', lamp);
    expect(weg.status).toBe(403);
    expect(((await weg.json()) as { fout: string }).fout).toMatch(/thuis/);
    expect((await alsGast('/api/comfort', { kamers: {} })).status).toBe(403);
    expect((await alsGast('/api/bewoners', { actie: 'naam', id: 'noor', naam: 'N' })).status).toBe(403);
    houseStates.set('person.noor', { entity_id: 'person.noor', state: 'home', attributes: { friendly_name: 'Noor' }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString() });
    try {
      expect((await alsGast('/api/licht', lamp)).status).not.toBe(403);
    } finally {
      houseStates.delete('person.noor');
    }
    expect((await fetch(`${baseUrl}/api/export`, { headers: { cookie: `hems_sessie=${gastSessie}` } })).status).toBe(403);

    // Een scherm beheren (besluit 149): de wand een andere naam geven, en weghalen.
    await p.goto(`${baseUrl}/bewoners.html`);
    await wandL.locator('[data-schermen] [data-kies="scherm:u-wand"]').click();
    const schermNaam = wandL.locator('[data-blad] [data-schermnaam]');
    await schermNaam.waitFor();
    await shot(p, 'bewoners-scherm');
    await schermNaam.fill('Tablet hal');
    await schermNaam.evaluate((el) => (el as unknown as { blur: () => void }).blur());
    await expect.poll(() => bewonersStore.current.schermen['u-wand']?.naam, kort).toBe('Tablet hal');
    expect(bewonersStore.current.schermen['u-wand']?.haNaam).toBe('Wand');
    p.once('dialog', (d) => void d.accept());
    await wandL.locator('[data-blad] [data-schermweg]').click();
    await expect.poll(() => bewonersStore.current.schermen['u-wand'], kort).toBeUndefined();

    // De inlogpagina, voor wie nog niet is ingelogd: alleen een huis als silhouet en de knop.
    const buiten = await browser.newContext({ viewport: { width: 1280, height: 800 }, zonderInlog: true } as BrowserContextOptions);
    await buiten.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const b = await buiten.newPage();
    await b.goto(`${baseUrl}/thuis.html`);
    await b.locator('a', { hasText: 'Inloggen met Home Assistant' }).waitFor();
    expect(await b.locator('body').textContent()).not.toMatch(/Ricardo|Noor|kWh/);
    await shot(b, 'inloggen');
    await buiten.close();

    live = voor;
    await bewonersStore.save(startBewoners);
    await wand.close();
    await ctx.close();
  }, 60_000);

  /*
   * Volledig scherm in Home Assistant (besluit 155). Een nagemaakte Home
   * Assistant op een eigen adres, met de app in een iframe onder
   * /api/hassio_ingress/, zoals de Supervisor hem toont. Hij schrijft op welke
   * berichten de app stuurt, en of het hele scherm gevraagd wordt.
   */
  it('vraagt in Home Assistant per apparaat volledig scherm, en gaat met één knop terug', async () => {
    const HA = 'http://ha.test';
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
    await context.route(
      (url) => url.href.startsWith(HA),
      async (route) => {
        const pad = new URL(route.request().url()).pathname;
        const ingress = /^\/api\/hassio_ingress\/abc(\/.*)$/.exec(pad);
        if (!ingress) {
          return route.fulfill({
            contentType: 'text/html',
            body: `<!doctype html><html><body style="margin:0"><iframe id="app" src="/api/hassio_ingress/abc/thuis.html" style="width:1280px;height:800px;border:0"></iframe>
              <script>
                window.berichten = [];
                window.schermVraag = 0;
                addEventListener('message', (e) => { if (e.source === document.getElementById('app').contentWindow) berichten.push(e.data); });
                document.documentElement.requestFullscreen = () => { window.schermVraag += 1; return Promise.resolve(); };
                // De app van Home Assistant: die leest de kleur van de statusbalk bij theme-update.
                window.extern = [];
                const ha = document.createElement('home-assistant');
                ha.hass = { auth: { external: { fireMessage: (m) => extern.push(m.type) } } };
                document.body.append(ha);
              </script></body></html>`,
          });
        }
        // De live-stroom eindigt nooit, en die wacht een doorgegeven vraag af.
        if (ingress[1]!.startsWith('/api/events')) return route.abort();
        const antwoord = await route.fetch({ url: `${baseUrl}${ingress[1]}${new URL(route.request().url()).search}`, headers: { ...route.request().headers(), cookie: `hems_sessie=${sessionId}` } });
        return route.fulfill({ response: antwoord });
      },
    );
    await context.route((url) => !url.href.startsWith(baseUrl) && !url.href.startsWith(HA), (route) => route.abort());
    const p = await context.newPage();
    await p.goto(`${HA}/`);
    const app = p.frameLocator('#app');
    await app.locator('#wand svg.sc-huis').first().waitFor();
    const berichten = () => p.evaluate<{ type: string; kioskMode?: boolean; path?: string }[]>('window.berichten');
    // Standaard aan (besluit 202): meteen de kioskstand, en de knop terug naar Home Assistant.
    await expect.poll(berichten).toContainEqual({ type: 'home-assistant/subscribe-properties', kioskMode: true });
    await app.locator('#balk [data-naar-ha]').waitFor();

    // Bij Functies › Weergave › Dit scherm aanzetten (besluit 167): meteen de kioskstand, het hele scherm en de knop.
    const frame = p.frames().find((f) => f.url().includes('/api/hassio_ingress/'))!;
    await frame.goto(`${HA}/api/hassio_ingress/abc/functies.html#scherm`);
    const vorm = app.locator('#wand [data-vorm]');
    await vorm.locator('h2', { hasText: 'Dit scherm' }).waitFor();
    expect(await vorm.locator('[data-volledig]').getAttribute('aria-checked')).toBe('true');
    // Uitzetten: de balken van Home Assistant terug, en geen knop.
    await vorm.locator('[data-volledig]').click();
    await expect.poll(() => vorm.locator('[data-volledig]').getAttribute('aria-checked')).toBe('false');
    await expect.poll(() => app.locator('#balk [data-naar-ha]').count()).toBe(0);
    await vorm.locator('[data-volledig]').click();
    await expect.poll(() => berichten().then((b) => b.filter((x) => x.kioskMode != null).at(-1)?.kioskMode)).toBe(true);
    expect(await p.evaluate<number>('window.schermVraag')).toBeGreaterThan(0);
    await expect.poll(() => vorm.locator('[data-volledig]').getAttribute('aria-checked')).toBe('true');
    // De statusbalk in de kleur van de app, en de app van Home Assistant hoort het.
    const statusbalk = () => p.evaluate<string>("document.documentElement.style.getPropertyValue('--app-header-background-color')");
    await expect.poll(statusbalk).toBe('#0b1424');
    expect(await p.evaluate<string[]>('window.extern')).toContain('theme-update');
    await app.locator('#balk [data-naar-ha]').waitFor();
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-volledig-scherm.png') });

    // Een andere pagina van de app: hij vraagt het opnieuw, en de knop staat er.
    const voor = (await berichten()).length;
    await frame.goto(`${HA}/api/hassio_ingress/abc/vandaag.html`);
    await app.locator('#balk [data-naar-ha]').waitFor();
    await expect.poll(async () => (await berichten()).length).toBeGreaterThan(voor);
    if (process.env.HEMS_PAGE_SHOT) await p.screenshot({ path: process.env.HEMS_PAGE_SHOT.replace('.png', '-volledig-menu.png') });

    // Achter het vak de lucht: tot een andere pagina er staat zie je die, geen zwart.
    expect(await p.evaluate<string>('document.getElementById("app").style.backgroundImage')).toContain('gradient');

    // De terugknop van Android zet het hele scherm uit: bij de volgende tik vraagt de app het weer.
    const tikken = async () => {
      const al = await p.evaluate<number>('window.schermVraag');
      await frame.evaluate('document.body.click()');
      return (await p.evaluate<number>('window.schermVraag')) - al;
    };
    expect(await tikken()).toBe(1);
    expect(await tikken()).toBe(0);
    await p.evaluate('document.dispatchEvent(new Event("fullscreenchange"))');
    expect(await tikken()).toBe(1);

    // Een telefoon nooit het hele scherm van de browser, ook liggend: alleen de kioskstand,
    // zodat hij eruitziet als de app van de NAS, met de statusbalk erboven (versie 0.34.3).
    const telefoon = (aan: boolean) =>
      frame.evaluate(aan ? "Object.defineProperty(screen, 'width', { value: 390, configurable: true }); Object.defineProperty(screen, 'height', { value: 844, configurable: true })" : 'delete screen.width; delete screen.height');
    await telefoon(true);
    await p.evaluate('document.dispatchEvent(new Event("fullscreenchange"))');
    expect(await tikken()).toBe(0);
    await telefoon(false);

    // Naar Home Assistant: je blijft in de app, het volledige scherm en de kioskstand gaan uit,
    // en je kiest in Home Assistant zelf waar je heen gaat. Op de telefoon naast het tandwiel.
    await frame.goto(`${HA}/api/hassio_ingress/abc/thuis.html`);
    await app.locator('#wand svg.sc-huis').first().waitFor();
    expect(await app.locator('#tel [data-naar-ha]').count()).toBe(1);
    const naVoor = (await berichten()).length;
    await app.locator('#balk [data-naar-ha]').click();
    await expect.poll(async () => (await berichten()).slice(naVoor)).toContainEqual({ type: 'home-assistant/unsubscribe-properties' });
    expect((await berichten()).some((b) => b.type === 'home-assistant/navigate')).toBe(false);
    await app.locator('#balk [data-weer-volledig]').waitFor();
    expect(await statusbalk()).toBe('');

    // Een andere pagina laat het zo, tot je met dezelfde knop weer volledig scherm kiest.
    const naPauze = (await berichten()).length;
    await frame.goto(`${HA}/api/hassio_ingress/abc/vandaag.html`);
    await app.locator('#balk [data-weer-volledig]').waitFor();
    expect((await berichten()).slice(naPauze)).not.toContainEqual({ type: 'home-assistant/subscribe-properties', kioskMode: true });
    const scherm = await p.evaluate<number>('window.schermVraag');
    await app.locator('#balk [data-weer-volledig]').click();
    await expect.poll(async () => (await berichten()).slice(naPauze)).toContainEqual({ type: 'home-assistant/subscribe-properties', kioskMode: true });
    expect(await p.evaluate<number>('window.schermVraag')).toBe(scherm + 1);
    await app.locator('#balk [data-naar-ha]').waitFor();
    expect(await statusbalk()).toBe('#0b1424');

    // Ga je in Home Assistant ergens anders heen, dan krijgt de statusbalk het thema terug.
    await p.evaluate("history.pushState(null, '', '/lovelace/0'); dispatchEvent(new Event('location-changed'))");
    expect(await statusbalk()).toBe('');

    // Weer uit op dit apparaat: de knop is weg.
    await frame.goto(`${HA}/api/hassio_ingress/abc/functies.html#scherm`);
    await vorm.locator('[data-volledig][aria-checked="true"]').click();
    await expect.poll(() => app.locator('[data-naar-ha-knop]').count()).toBe(0);


    // Buiten Home Assistant bestaat de keuze niet.
    const q = await context.newPage();
    await context.addCookies([{ name: 'hems_sessie', value: sessionId, url: baseUrl }]);
    await q.goto(`${baseUrl}/functies.html`);
    await q.locator('#wand [data-vorm] h2').first().waitFor();
    expect(await q.locator('#wand').textContent()).not.toContain('Dit scherm');
    await context.close();
  }, 40_000);

  /* Een versienummer, en wat er nieuw is (besluit 131). */
  it('toont de versie en wat er nieuw is', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    await p.goto(`${baseUrl}/toegang.html#versie`);
    const vorm = p.locator('#wand [data-vorm]');
    await vorm.locator('h2', { hasText: `Versie ${VERSIE}` }).waitFor();
    expect(await vorm.locator('.nieuw').first().textContent()).toContain(`Versie ${VERSIE}`);
    // Alleen de nieuwste open (besluit 133), en hooguit tien.
    expect(await vorm.locator('details.nieuw[open]').count()).toBe(1);
    expect(await vorm.locator('details.nieuw').count()).toBeLessThanOrEqual(10);
    expect(await vorm.locator('details.nieuw[open] .soort').count()).toBeGreaterThan(0);
    expect(await vorm.textContent()).not.toMatch(/NAS/);
    await context.close();
  }, 20_000);

  it('brengt je vanuit Inrichten terug op dezelfde stap, ook na Home Assistant (besluit 227)', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.route((url) => !url.href.startsWith(baseUrl), (route) => route.abort());
    const p = await context.newPage();
    // Een andere pagina vanuit een stap: de terugknop zegt Inrichten en gaat naar die stap.
    await p.goto(`${baseUrl}/inrichten.html#warmte`);
    await p.waitForTimeout(800);
    await p.evaluate("app.onthoudInrichten('app', 'warmte')");
    await p.goto(`${baseUrl}/toegang.html#versie`);
    const terug = p.locator('#wand a.terugje').first();
    await expect.poll(() => terug.textContent()).toBe('‹ Inrichten');
    expect(await terug.getAttribute('href')).toBe('inrichten.html#warmte');
    // Weer in Inrichten: elders weer gewoon naar Instellingen.
    await p.goto(`${baseUrl}/inrichten.html#warmte`);
    await p.waitForTimeout(800);
    await p.goto(`${baseUrl}/toegang.html#versie`);
    await expect.poll(() => p.locator('#wand a.terugje').first().getAttribute('href')).toBe('instellingen.html');
    // Naar Home Assistant en terug: de app opent weer op de stap, niet op Thuis.
    await p.goto(`${baseUrl}/inrichten.html#stem`);
    await p.waitForTimeout(800);
    await p.evaluate("app.onthoudInrichten('ha', 'stem')");
    await p.goto(`${baseUrl}/thuis.html`);
    await p.waitForURL(/inrichten\.html#stem$/);
    // Een keer: daarna opent Thuis gewoon.
    await p.goto(`${baseUrl}/thuis.html`);
    await p.waitForTimeout(800);
    expect(new URL(p.url()).pathname).toBe('/thuis.html');
    await context.close();
  }, 30_000);
});
