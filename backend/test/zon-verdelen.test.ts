/**
 * De zon verdelen (besluit 343): één lijst voor wie de zon krijgt die over is. De volgorde gaat zoals Op zon naar de
 * regeling, zonder de laadpaal; de marge en wat de bewoner met de hand kiest worden bewaard en getoond.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseSiteConfig } from '../src/config/schema.js';
import { defaultStrategies } from '../src/index.js';
import { controleerComfort, withComfort } from '../src/web/comfort.js';
import type { DecisionView } from '../src/web/assistant-types.js';
import { leesZonBody, STANDAARD_KEUZES, volgordeVan, ZonVerdelenStore, zonVerdelenView, type ZonAuto, type ZonBron } from '../src/web/zon-verdelen.js';
import { exampleSite, exampleSitePath } from './site.js';

const raw = JSON.parse(readFileSync(exampleSitePath, 'utf-8')) as Record<string, unknown>;
const opties = { knownStrategies: defaultStrategies().ids };
const gewoon = [
  { soort: 'kamer', id: 'woonkamer' },
  { soort: 'kamer', id: 'zolder' },
  { soort: 'apparaat', id: 'droger' },
] as const;
const auto: ZonAuto = { id: 'auto-1', naam: 'Laadpaal', laadpaal: true, minW: null, aangesloten: true, laadt: false, vermogenW: null };

const besluit = (overW: number, droger = 'waiting') =>
  ({
    atMs: 0,
    accepted: [{ strategyId: 'pv-surplus', actuatorId: 'ac-woonkamer' }],
    rejected: [],
    commands: [],
    observed: {},
    explanation: {
      budget: { availableW: overW, allocatedW: 900, surplusW: overW, reclaimableW: 0, gridPowerW: -overW },
      perZone: [
        { zoneId: 'woonkamer', demand: 'none' },
        { zoneId: 'zolder', demand: 'none' },
      ],
      deferrables: [{ id: 'droger', state: droger }],
      heatStores: [],
    },
  }) as unknown as DecisionView;

const bron = (over: Partial<ZonBron> = {}): ZonBron => ({
  config: exampleSite,
  snapshot: besluit(2400),
  volgorde: volgordeVan(undefined, gewoon, [auto]),
  autos: [auto],
  keuzes: STANDAARD_KEUZES,
  gemeten: () => null,
  nowMs: 1_000_000,
  vandaag: '2026-11-24',
  ...over,
});

describe('de volgorde', () => {
  it('zet eerst wat bewaard is, dan de rest zoals de regeling, en de laadpaal achteraan', () => {
    expect(volgordeVan(undefined, gewoon, [auto]).map((p) => `${p.soort}:${p.id}`)).toEqual(['kamer:woonkamer', 'kamer:zolder', 'apparaat:droger', 'laadpaal:auto-1']);
    const bewaard = [
      { soort: 'laadpaal', id: 'auto-1' },
      { soort: 'apparaat', id: 'droger' },
      { soort: 'kamer', id: 'weg' },
    ] as const;
    expect(volgordeVan(bewaard, gewoon, [auto]).map((p) => `${p.soort}:${p.id}`)).toEqual(['laadpaal:auto-1', 'apparaat:droger', 'kamer:woonkamer', 'kamer:zolder']);
  });

  it('laat een auto zonder laadpaal weg', () => {
    expect(volgordeVan(undefined, gewoon, [{ ...auto, laadpaal: false }])).toHaveLength(3);
  });

  it('neemt de laadpaal op in comfort, maar de regeling krijgt hem nog niet', () => {
    const zon = [{ soort: 'laadpaal', id: 'auto-1' }, { soort: 'apparaat', id: 'droger' }, { soort: 'kamer', id: 'zolder' }];
    const c = controleerComfort({ kamers: {}, voorrang: { koelen: ['zolder', 'woonkamer'], verwarmen: ['woonkamer', 'zolder'], zon } }, exampleSite);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const parsed = parseSiteConfig(withComfort(raw, c.comfort).raw, opties);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.config.sunOrder).toEqual([{ kind: 'deferrable', id: 'droger' }, { kind: 'zone', id: 'zolder' }]);
  });
});

describe('wie krijgt de zon', () => {
  it('zegt per plek wat hij krijgt, en wat de wachtenden tekortkomen', () => {
    const v = zonVerdelenView(bron());
    expect(v.overW).toBe(2400);
    const per = Object.fromEntries(v.lijst.map((x) => [x.sleutel, x]));
    expect(per['kamer:woonkamer']).toMatchObject({ stand: 'zon', krijgtW: 900, vermogenW: 900, bron: 'opgegeven' });
    expect(v.restW).toBe(1500);
    // De droger vraagt 600 W, met 200 W marge: er is genoeg, hij wacht op iets anders.
    expect(per['apparaat:droger']).toMatchObject({ stand: 'wacht', tekortW: 0 });
    // De laadpaal vraagt minstens 1380 W, met marge 1580: 80 W te weinig.
    expect(per['laadpaal:auto-1']).toMatchObject({ stand: 'wacht', tekortW: 80, naam: 'Laadpaal' });
  });

  it('noemt een droger die al draait geen zon', () => {
    const per = (state: string) => zonVerdelenView(bron({ snapshot: besluit(2400, state) })).lijst.find((x) => x.id === 'droger')!;
    expect(per('running')).toMatchObject({ stand: 'draait', krijgtW: 0 });
  });

  it('telt wat de laadpaal nu laadt erbij', () => {
    const v = zonVerdelenView(bron({ autos: [{ ...auto, laadt: true, vermogenW: 1600 }] }));
    expect(v.overW).toBe(4000);
    expect(v.restW).toBe(1500);
    expect(v.lijst.find((x) => x.soort === 'laadpaal')).toMatchObject({ stand: 'laadt', krijgtW: 1600, bron: 'gemeten' });
  });

  it('gebruikt wat de meter zegt als het apparaat iets trekt', () => {
    const config = { ...exampleSite, actuators: exampleSite.actuators.map((a) => (a.id === 'ac-woonkamer' ? { ...a, power: { ...a.power, sensor: { adapter: 'ha', id: 'sensor.airco' } } } : a)) };
    const v = zonVerdelenView(bron({ config, gemeten: (e) => (e === 'sensor.airco' ? 640 : null) }));
    expect(v.lijst[0]).toMatchObject({ vermogenW: 640, krijgtW: 640, bron: 'gemeten' });
  });

  it('zet Nu eerst bovenaan zolang het geldt, en laat Uit de lijst apart', () => {
    const keuzes = { ...STANDAARD_KEUZES, hand: { 'apparaat:droger': { soort: 'eerst' as const, totMs: 2_000_000 }, 'kamer:zolder': { soort: 'overslaan' as const, datum: '2026-11-24' } }, uit: ['laadpaal:auto-1'] };
    const v = zonVerdelenView(bron({ keuzes }));
    expect(v.lijst.map((x) => x.sleutel)).toEqual(['apparaat:droger', 'kamer:woonkamer', 'kamer:zolder']);
    expect(v.lijst[0]!.eerst).toEqual({ totMs: 2_000_000 });
    expect(v.lijst[2]!.stand).toBe('overgeslagen');
    expect(v.uit.map((x) => x.sleutel)).toEqual(['laadpaal:auto-1']);
    // Verlopen: dan gewoon weer op zijn plek, en morgen telt overslaan niet meer.
    const later = zonVerdelenView(bron({ keuzes, nowMs: 3_000_000, vandaag: '2026-11-25' }));
    expect(later.lijst.map((x) => x.sleutel)).toEqual(['kamer:woonkamer', 'kamer:zolder', 'apparaat:droger']);
    expect(later.lijst[1]!.stand).not.toBe('overgeslagen');
  });

  it('zonder besluit weet hij niet wat er over is', () => {
    const v = zonVerdelenView(bron({ snapshot: null }));
    expect(v.overW).toBeNull();
    expect(v.lijst.every((x) => x.tekortW == null)).toBe(true);
  });
});

describe('bewaren', () => {
  const bekend = new Set(['kamer:woonkamer', 'apparaat:droger', 'laadpaal:auto-1']);
  it('neemt alleen bekende plekken en een marge binnen het bereik aan', () => {
    expect(leesZonBody({ marge: { extraW: 300, minuten: 15 } }, bekend).ok).toBe(true);
    expect(leesZonBody({ marge: { extraW: 5000, minuten: 15 } }, bekend).ok).toBe(false);
    expect(leesZonBody({ volgorde: [{ soort: 'kamer', id: 'woonkamer' }, { soort: 'kamer', id: 'woonkamer' }] }, bekend).ok).toBe(false);
    expect(leesZonBody({ volgorde: [{ soort: 'kamer', id: 'kelder' }] }, bekend).ok).toBe(false);
    expect(leesZonBody({ hand: { 'apparaat:droger': { soort: 'eerst', totMs: null } } }, bekend).ok).toBe(true);
    expect(leesZonBody({ hand: { 'apparaat:droger': { soort: 'overslaan', datum: 'morgen' } } }, bekend).ok).toBe(false);
    expect(leesZonBody({ uit: ['kamer:kelder'] }, bekend).ok).toBe(false);
  });

  let map: string | null = null;
  afterEach(async () => {
    if (map) await rm(map, { recursive: true, force: true });
    map = null;
  });

  it('bewaart de keuzes en leest ze terug; null haalt een keuze met de hand weg', async () => {
    map = await mkdtemp(join(tmpdir(), 'zonverdelen-'));
    const store = new ZonVerdelenStore(map);
    await store.load();
    expect(store.current).toEqual(STANDAARD_KEUZES);
    await store.save(store.met({ marge: { extraW: 300, minuten: 15 }, hand: { 'apparaat:droger': { soort: 'eerst', totMs: null } }, uit: ['laadpaal:auto-1'] }));
    const weer = new ZonVerdelenStore(map);
    await weer.load();
    expect(weer.current).toEqual({ versie: 1, marge: { extraW: 300, minuten: 15 }, hand: { 'apparaat:droger': { soort: 'eerst', totMs: null } }, uit: ['laadpaal:auto-1'] });
    expect(weer.met({ hand: { 'apparaat:droger': null } }).hand).toEqual({});
  });
});
