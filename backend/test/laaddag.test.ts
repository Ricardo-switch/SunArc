import { describe, expect, it } from 'vitest';
import { laadDag, zonVerwachtW } from '../src/web/laaddag.js';
import type { Auto } from '../src/web/opslag.js';

const UUR = 3_600_000;
const nu = Date.parse('2026-11-08T13:20:00Z');
const van = Date.parse('2026-11-08T13:00:00Z');

const autoVan = (x: Partial<Auto> = {}): Auto => ({
  id: 'tesla', naam: 'Model 3', pct: 64, aangesloten: true, laadt: true, vermogenW: 4140, bereikKm: 312, plek: null, paalPlek: null, accuKWh: 75, laadpaal: 'easee',
  paalNaam: 'Easee Home', paalStroomA: { min: 6, max: 16 }, laadgrens: 80, stroomA: [6, 6, 6], volOm: '2026-11-08T15:20:00Z', thuis: true, kabelSinds: null, wegSinds: null, fout: null, ...x,
});

describe('de balk van de dag (besluit 279)', () => {
  it('geeft per uur de zon over in A per fase, de prijs, de goedkoopste uren en vol om', () => {
    // 6 kW tot 18:00, daarna niets; het huis 500 W; drie fasen.
    const zonW = (ms: number) => (ms < van + 5 * UUR ? 6000 : 0);
    const prijzen = Array.from({ length: 30 }, (_, i) => ({ vanMs: van + i * UUR, prijs: i >= 13 && i < 16 ? 0.14 : 0.3 }));
    const goedkoop = { van: new Date(van + 13 * UUR).toISOString(), tot: new Date(van + 16 * UUR).toISOString(), prijs: 0.14, prijsNu: 0.3, uren: 3, totPct: 80, kosten: 2, nietNodig: false };
    const d = laadDag(autoVan(), { nuMs: nu, prijzen, goedkoop, zonW, huisW: 500 })!;
    expect(d.vanMs).toBe(van);
    expect(d.uren).toHaveLength(24);
    // (6000 − 500) / (230 × 3) ≈ 8,0 A.
    expect(d.uren[0]).toEqual({ vanMs: van, zonA: 8, prijs: 0.3, goedkoop: false });
    expect(d.uren[6]!.zonA).toBe(0);
    expect(d.uren.filter((u) => u.goedkoop).map((u) => u.vanMs)).toEqual([13, 14, 15].map((i) => van + i * UUR));
    expect(d.volOmMs).toBe(Date.parse('2026-11-08T15:20:00Z'));
    expect(d.laadgrens).toBe(80);
  });

  it('zonder zon of prijs alleen het andere, zonder allebei niets; niet als de auto weg is', () => {
    const geenZon = () => null;
    const prijzen = [{ vanMs: van, prijs: 0.3 }];
    expect(laadDag(autoVan(), { nuMs: nu, prijzen, goedkoop: null, zonW: geenZon, huisW: 500 })?.uren[0]).toEqual({ vanMs: van, zonA: null, prijs: 0.3, goedkoop: false });
    expect(laadDag(autoVan(), { nuMs: nu, prijzen: [], goedkoop: null, zonW: geenZon, huisW: 500 })).toBeNull();
    expect(laadDag(autoVan({ thuis: false }), { nuMs: nu, prijzen, goedkoop: null, zonW: () => 1000, huisW: 500 })).toBeNull();
    // Laadt hij niet, dan geen vol om.
    expect(laadDag(autoVan({ laadt: false }), { nuMs: nu, prijzen, goedkoop: null, zonW: geenZon, huisW: 500 })?.volOmMs).toBeNull();
  });

  it('rekent de verwachting om naar de panelen, met het uur erna uit Open-Meteo', () => {
    const uren = { vanMs: van, zonWm2: [100, 300, 600, null] };
    // Het uur van 13:00 staat op de plek van 14:00 (gemiddeld over het uur ervoor): 300 van 600 helder = de helft.
    expect(zonVerwachtW(van + UUR / 2, uren, () => 4000, () => 600)).toBe(2000);
    expect(zonVerwachtW(van + UUR + UUR / 2, uren, () => 4000, () => 500)).toBe(4000);
    // Nacht: geen heldere lucht, dan niets; geen verwachting: null.
    expect(zonVerwachtW(van + UUR / 2, uren, () => 0, () => 5)).toBe(0);
    expect(zonVerwachtW(van + 2 * UUR + UUR / 2, uren, () => 4000, () => 600)).toBeNull();
    expect(zonVerwachtW(van, null, () => 4000, () => 600)).toBeNull();
  });
});
