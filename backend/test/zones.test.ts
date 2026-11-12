/*
 * Een zone apart regelen (besluit 306): in één ruimte twee zones, elk met een
 * radiatorknop en een eigen regeling. De indeling bewaart het per zone, en de
 * regeling ziet elke zone als een eigen kamer met een eigen regelgebied.
 */
import { describe, expect, it } from 'vitest';

import type { HaEntityState } from '../src/adapters/homeassistant/client.js';
import { parseSiteConfig } from '../src/config/schema.js';
import { defaultStrategies } from '../src/index.js';
import { regelKamers, validateLayout, withLayoutNames, type LayoutKnown } from '../src/web/layout.js';
import { withMeasurement } from '../src/web/meten.js';
import { rollenUitConfig, withRegeling } from '../src/web/regeling.js';
import { exampleSite } from './site.js';

const raw = () => JSON.parse(JSON.stringify(exampleSite)) as Record<string, unknown>;
const parse = (r: Record<string, unknown>) => parseSiteConfig(r, { knownStrategies: defaultStrategies().ids });

const knop = (id: string, naam: string, temp: number): HaEntityState => ({
  entity_id: id,
  state: 'heat',
  attributes: { friendly_name: naam, hvac_modes: ['off', 'heat'], min_temp: 5, max_temp: 30, current_temperature: temp },
  last_changed: '2026-11-12T10:00:00Z',
  last_updated: '2026-11-12T10:00:00Z',
});
const knoppen = [knop('climate.knop_zithoek', 'Radiatorknop zithoek', 20.6), knop('climate.knop_keuken', 'Radiatorknop keuken', 18.9)];
const ha = { state: (id: string) => knoppen.find((k) => k.entity_id === id) };

const known: LayoutKnown = {
  deviceIds: new Set(['nest', 'ac-woonkamer', 'ac-zolder', 'badkamer', 'climate.knop_zithoek', 'climate.knop_keuken']),
  zoneIds: new Set(['woonkamer', 'badkamer', 'zolder']),
  gevelIds: new Set(),
  opvolgers: new Map(),
};

/** De woonkamer met Zithoek en Keuken; de keuken met een eigen regeling, of allebei. */
function indeling(keukenEigen: boolean, zithoekEigen = false) {
  return {
    versie: 1,
    etages: {},
    kamers: [
      {
        id: 'woonkamer',
        naam: 'Woonkamer',
        etage: 'bg',
        regelzone: 'woonkamer',
        haGebied: null,
        rollen: rollenUitConfig(raw(), 'woonkamer'),
        zones: [
          { id: 'zithoek', naam: 'Zithoek', ...(zithoekEigen ? { rollen: { 'climate.knop_zithoek': 'houdt' } } : {}) },
          { id: 'keuken', naam: 'Keuken', ...(keukenEigen ? { rollen: { 'climate.knop_keuken': 'houdt' } } : {}) },
        ],
      },
      { id: 'badkamer', naam: 'Badkamer', etage: 'e1', regelzone: 'badkamer', haGebied: null, zones: [] },
      { id: 'zolder', naam: 'Zolder', etage: 'e2', regelzone: 'zolder', haGebied: null, zones: [] },
    ],
    apparaten: {},
  };
}

describe('een zone apart regelen (besluit 306)', () => {
  it('bewaart een eigen regeling per zone, met een eigen regelgebied', () => {
    const v = validateLayout(indeling(true), known);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const zones = v.layout.kamers[0]!.zones;
    expect(zones[1]).toMatchObject({ id: 'keuken', rollen: { 'climate.knop_keuken': 'houdt' }, regelzone: 'woonkamer-keuken' });
    expect(zones[0]!.rollen).toBeUndefined();
    // Nog eens bewaren houdt hetzelfde regelgebied.
    const opnieuw = validateLayout(v.layout, known);
    expect(opnieuw.ok && opnieuw.layout.kamers[0]!.zones[1]!.regelzone).toBe('woonkamer-keuken');
    // Alleen kijken: geen eigen regelgebied.
    const kijken = validateLayout({ ...indeling(false), kamers: [{ ...indeling(false).kamers[0]!, zones: [{ id: 'keuken', naam: 'Keuken', rollen: { 'climate.knop_keuken': 'kijken' } }] }, ...indeling(false).kamers.slice(1)] }, known);
    expect(kijken.ok && kijken.layout.kamers[0]!.zones[0]!.regelzone).toBeNull();
  });

  it('weigert een zone met een onbekend apparaat te laten meten', () => {
    const k = indeling(true);
    const fout = { ...k, kamers: [{ ...k.kamers[0]!, zones: [{ id: 'keuken', naam: 'Keuken', rollen: { 'climate.knop_keuken': 'houdt' }, meten: ['sensor.bestaat_niet'] }] }, ...k.kamers.slice(1)] };
    expect(validateLayout(fout, known)).toMatchObject({ ok: false });
  });

  it('maakt van elke zone met een eigen regeling een kamer voor de regeling', () => {
    const v = validateLayout(indeling(true, true), known);
    if (!v.ok) throw new Error(v.reden);
    const kamers = regelKamers(v.layout.kamers);
    expect(kamers.map((k) => [k.id, k.naam, k.regelzone])).toEqual([
      ['woonkamer', 'Woonkamer', 'woonkamer'],
      ['woonkamer~zithoek', 'Woonkamer · Zithoek', 'woonkamer-zithoek'],
      ['woonkamer~keuken', 'Woonkamer · Keuken', 'woonkamer-keuken'],
      ['badkamer', 'Badkamer', 'badkamer'],
      ['zolder', 'Zolder', 'zolder'],
    ]);
  });

  it('de regeling krijgt per zone een eigen regelgebied met de knop, die met zijn eigen meter meet', () => {
    const v = validateLayout(indeling(true), known);
    if (!v.ok) throw new Error(v.reden);
    const kamers = regelKamers(v.layout.kamers);
    const kamerVan = (id: string) => (id === 'climate.knop_keuken' ? 'woonkamer~keuken' : null);
    const uit = withRegeling(raw(), kamers, { ...ha, kamerVan });
    const gemeten = withMeasurement(uit.raw, { kamers }).raw;
    const zones = gemeten['zones'] as Record<string, unknown>[];
    const keuken = zones.find((z) => z['id'] === 'woonkamer-keuken')!;
    expect(keuken).toMatchObject({ name: 'Woonkamer · Keuken', actuatorIds: ['climate.knop_keuken'], temperature: { id: 'climate.knop_keuken', attribute: 'current_temperature' } });
    // De woonkamer zelf houdt zijn eigen apparaten.
    expect(zones.find((z) => z['id'] === 'woonkamer')!['actuatorIds']).toEqual(expect.arrayContaining(['nest']));
    const p = parse(gemeten);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    // De naam in de app komt uit de indeling: "Woonkamer · Keuken".
    expect(withLayoutNames(p.config, v.layout).zones.find((z) => z.id === 'woonkamer-keuken')?.name).toBe('Woonkamer · Keuken');
  });
});
