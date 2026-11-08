/*
 * Meldingen van de thuisaccu (besluit 276): hij zegt niets meer, hij meldt een
 * fout, of hij is vol terwijl de zon naar het net gaat.
 */
import { describe, expect, it } from 'vitest';

import type { HaEntityState } from '../src/adapters/homeassistant/client.js';
import type { HaDevice, HaRegistryEntity } from '../src/adapters/homeassistant/discovery.js';
import { wat, type AccuBel, type MeldingenBron } from '../src/web/meldingen.js';
import { accusNu } from '../src/web/opslag.js';
import { groepVan } from '../src/web/push.js';

const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);
const accu = (x: Partial<AccuBel> = {}): AccuBel => ({ id: 'sessy', naam: 'Sessy', pct: 70, fout: null, stilSindsMs: null, ...x });
const bron = (lijst: AccuBel[], terugW: number | null = 0): MeldingenBron => ({
  nu: T0, zonderRuimte: [], volgen: [], batterijen: [], filters: [], meters: [], versie: null, winterdagen: null,
  accus: { lijst, terugW, dag: '2026-11-07' },
});
const ids = (b: MeldingenBron) => wat(b).map((m) => m.id);

describe('meldingen van de thuisaccu (besluit 276)', () => {
  it('zegt niets bij een accu die gewoon werkt', () => {
    expect(ids(bron([accu()]))).toEqual([]);
    expect(ids({ ...bron([]), accus: null })).toEqual([]);
  });

  it('meldt een accu die al een half uur niets zegt', () => {
    expect(ids(bron([accu({ stilSindsMs: T0 - 10 * 60_000 })]))).toEqual([]);
    const m = wat(bron([accu({ stilSindsMs: T0 - 31 * 60_000 })]));
    expect(m.map((x) => [x.id, x.titel])).toEqual([[`accu-stil:sessy:${T0 - 31 * 60_000}`, 'Sessy zegt niets meer']]);
    expect(m[0]!.en.titel).toBe('Sessy has gone quiet');
    expect(m[0]!.actie?.href).toBe('apparaten.html#batterij');
    expect(groepVan(m[0]!.soort)).toBe('onderhoud');
  });

  it('meldt een fout van de accu', () => {
    expect(wat(bron([accu({ fout: 'fault' })])).map((x) => [x.titel, x.tekst])).toEqual([['Fout bij Sessy', 'De accu meldt een fout (fault). Kijk in de app van de accu.']]);
  });

  it('meldt vol met zon over, één keer per dag', () => {
    expect(ids(bron([accu({ pct: 100 })], 800))).toEqual(['accu-vol:sessy:2026-11-07']);
    // Vol maar niets naar het net, of net niet vol: niet.
    expect(ids(bron([accu({ pct: 100 })], 200))).toEqual([]);
    expect(ids(bron([accu({ pct: 95 })], 800))).toEqual([]);
    expect(ids(bron([accu({ pct: 100 })], null))).toEqual([]);
  });

  it('leest uit Home Assistant een fout en sinds wanneer hij stil is', () => {
    const sessy: HaDevice = { id: 'sessy', area_id: null, name: 'Sessy', manufacturer: 'Charged', model: 'Sessy' };
    const maak = (lading: string, vermogen: string, stand: string) => {
      const m = [
        { id: 'sensor.sessy_soc', klasse: 'battery', staat: lading, eenheid: '%' },
        { id: 'sensor.sessy_power', klasse: 'power', staat: vermogen, eenheid: 'W', naam: 'Sessy battery power' },
        { id: 'sensor.sessy_system_state', klasse: null, staat: stand, eenheid: '', naam: 'Sessy system state' },
      ];
      const entities: HaRegistryEntity[] = m.map((x) => ({ entity_id: x.id, device_id: 'sessy', platform: 'sessy', original_device_class: x.klasse, original_name: x.naam ?? null }));
      const states = new Map<string, HaEntityState>(m.map((x) => [x.id, { entity_id: x.id, state: x.staat, attributes: { ...(x.eenheid ? { unit_of_measurement: x.eenheid } : {}), ...(x.naam ? { friendly_name: x.naam } : {}) }, last_changed: '2026-11-07T11:00:00Z', last_updated: '' }]));
      return accusNu({ devices: [sessy], entities }, states, null, null)[0]!;
    };
    expect(maak('70', '500', 'running')).toMatchObject({ fout: null, stilSindsMs: null });
    expect(maak('70', '500', 'fault')).toMatchObject({ fout: 'fault' });
    expect(maak('70', '500', 'no_fault')).toMatchObject({ fout: null });
    expect(maak('unavailable', 'unavailable', 'running')).toMatchObject({ stilSindsMs: Date.parse('2026-11-07T11:00:00Z') });
    // Zegt het vermogen nog iets, dan is hij niet stil.
    expect(maak('unavailable', '500', 'running')).toMatchObject({ stilSindsMs: null });
  });
});
