/*
 * Alleen airco's als warmtebron (besluit 342, issue 170): bij het kiezen houdt in elke kamer zonder iets dat de kamer op
 * temperatuur houdt de eerste airco de kamer; wat al houdt, en kamers zonder airco, blijven zoals ze zijn.
 */
import { describe, expect, it } from 'vitest';
import { aircosHouden } from '../src/web/alleen-airco.js';
import type { HouseReport } from '../src/web/house-types.js';
import type { Layout } from '../src/web/layout.js';

const airco = (id: string, rol: string) => ({ id: `climate.${id}`, actuatorId: id, soort: 'klimaat', klimaat: { rol, kanKoelen: true, kanVerwarmen: true } });
const radiator = (id: string, rol: string) => ({ id: `climate.${id}`, actuatorId: id, soort: 'klimaat', klimaat: { rol, kanKoelen: false, kanVerwarmen: true } });
const huis = {
  etages: [
    {
      ruimtes: [
        { id: 'woonkamer', apparaten: [airco('ac-woon', 'zon'), airco('ac-woon2', 'zon')] },
        { id: 'zolder', apparaten: [airco('ac-zolder', 'houdt')] },
        { id: 'badkamer', apparaten: [radiator('rad-bad', 'zon')] },
        { id: 'hal', apparaten: [] },
      ],
    },
  ],
} as unknown as HouseReport;
const kamer = (id: string, extra: Record<string, unknown> = {}) => ({ id, naam: id, etage: 'bg', zones: [], ...extra });
const layout = { versie: 1, etages: {}, kamers: [kamer('woonkamer'), kamer('zolder'), kamer('badkamer'), kamer('hal')], apparaten: {} } as unknown as Layout;

describe('alleen airco\'s (besluit 342)', () => {
  it('laat in elke kamer zonder iets dat houdt de eerste airco de kamer houden', () => {
    const next = aircosHouden(layout, huis);
    expect(next?.kamers.find((k) => k.id === 'woonkamer')?.rollen).toEqual({ 'ac-woon': 'houdt', 'ac-woon2': 'zon' });
    // Wat al houdt, een kamer zonder airco en een lege kamer blijven zoals ze waren.
    expect(next?.kamers.find((k) => k.id === 'zolder')?.rollen).toBeUndefined();
    expect(next?.kamers.find((k) => k.id === 'badkamer')?.rollen).toBeUndefined();
    expect(next?.kamers.find((k) => k.id === 'hal')?.rollen).toBeUndefined();
  });

  it('houdt een keuze van de bewoner aan, en verandert niets als er niets te doen is', () => {
    const al = { ...layout, kamers: layout.kamers.map((k) => (k.id === 'woonkamer' ? { ...k, rollen: { 'ac-woon2': 'houdt' } } : k)) } as Layout;
    expect(aircosHouden(al, huis)).toBeNull();
    expect(aircosHouden(null, huis)).toBeNull();
    expect(aircosHouden(layout, null)).toBeNull();
  });
});
