import { describe, expect, it } from 'vitest';
import { laadAdvies, prijzenVooruit, type AdviesContext } from '../src/web/laadadvies.js';
import type { Auto } from '../src/web/opslag.js';

const UUR = 3_600_000;
const nu = Date.parse('2026-11-07T12:20:00Z');

const auto = (x: Partial<Auto> = {}): Auto => ({
  id: 'tesla',
  naam: 'Model 3',
  pct: 64,
  aangesloten: true,
  laadt: true,
  vermogenW: 4140,
  bereikKm: 312,
  plek: 'garage',
  paalPlek: null,
  accuKWh: 75,
  laadpaal: 'easee',
  paalNaam: 'Easee Home',
  paalStroomA: { min: 6, max: 16 },
  laadgrens: 80,
  stroomA: [6, 6, 6],
  volOm: null,
  thuis: true,
  kabelSinds: null,
  wegSinds: null,
  fout: null,
  ...x,
});
const ctx = (x: Partial<AdviesContext> = {}): AdviesContext => ({ nuMs: nu, netW: null, fasen: null, prijzen: [], prijsNu: null, ...x });
const fasen = (a: number) => [1, 2, 3].map(() => ({ stroomA: a, zekeringA: 25, grensA: 23 }));

describe('het advies bij de auto (besluit 259, stap 4)', () => {
  it('zegt hoeveel meer er op zon kan, binnen de laadpaal en de zekering', () => {
    // 1,8 kW terug: 4,14 + 1,8 kW = 5,94 kW op drie fasen is 8 A.
    const z = laadAdvies(auto(), ctx({ netW: -1800, fasen: fasen(7) })).zon;
    expect(z).toMatchObject({ soort: 'meer', kW: 1.8, nuA: 6, metA: 8, fasen: 3, zekering: { fasen: 3, ampere: 25 } });
    // Op elke fase 7 A, met 2 A meer voor de auto: 16 A over op de zekering.
    expect(z?.overA).toBe(16);
    // Veel zon over: niet boven de laadpaal.
    expect(laadAdvies(auto(), ctx({ netW: -20_000 })).zon?.metA).toBe(16);
    // Een volle fase: niet boven de zekering met zijn marge.
    expect(laadAdvies(auto(), ctx({ netW: -20_000, fasen: fasen(20) })).zon?.metA).toBe(9);
  });

  it('zegt niets als het niets zegt', () => {
    // Alles gaat al naar de auto.
    expect(laadAdvies(auto(), ctx({ netW: -100 })).zon).toBeNull();
    // Zonder slimme meter, of als de auto weg is.
    expect(laadAdvies(auto(), ctx()).zon).toBeNull();
    expect(laadAdvies(auto({ thuis: false, laadt: false }), ctx({ netW: -3000 })).zon).toBeNull();
    // Zonder stroom per fase weet het niet met hoeveel hij laadt.
    expect(laadAdvies(auto({ stroomA: null }), ctx({ netW: -3000 })).zon).toBeNull();
  });

  it('zegt een lagere stroom als die wel op zon past', () => {
    // 1,4 kW van het net bij 3 × 8 A (5,5 kW): op zon past 3 × 6 A.
    const z = laadAdvies(auto({ vermogenW: 5520, stroomA: [8, 8, 8] }), ctx({ netW: 1400 })).zon;
    expect(z).toMatchObject({ soort: 'minder', kW: 1.4, nuA: 8, metA: 6 });
    // Past zelfs de laagste stroom niet op zon, dan niets.
    expect(laadAdvies(auto({ vermogenW: 5520, stroomA: [8, 8, 8] }), ctx({ netW: 4000 })).zon).toBeNull();
  });

  it('zegt dat hij kan beginnen als de kabel erin zit en er zon genoeg is', () => {
    const stil = auto({ laadt: false, vermogenW: 0, stroomA: [0, 0, 0] });
    expect(laadAdvies(stil, ctx({ netW: -4500 })).zon).toMatchObject({ soort: 'start', kW: 4.5, nuA: null, metA: 6, fasen: 3 });
    // Te weinig voor 3 × 6 A, of al op de laadgrens.
    expect(laadAdvies(stil, ctx({ netW: -2500 })).zon).toBeNull();
    expect(laadAdvies({ ...stil, pct: 80 }, ctx({ netW: -4500 })).zon).toBeNull();
  });

  it('vindt het goedkoopste blok, zo lang als hij nodig heeft', () => {
    // Nu 12:00 UTC € 0,30; vannacht van 02:00 tot 05:00 € 0,14.
    const prijzen = Array.from({ length: 30 }, (_, i) => {
      const van = Date.parse('2026-11-07T12:00:00Z') + i * UUR;
      const uur = new Date(van).getUTCHours();
      return { vanMs: van, prijs: uur >= 2 && uur < 5 ? 0.14 : uur >= 1 && uur < 6 ? 0.2 : 0.3 };
    });
    // 16% van 75 kWh is 12 kWh; met 3 × 16 A (11 kW) twee uur.
    const g = laadAdvies(auto({ laadt: false, stroomA: [0, 0, 0] }), ctx({ prijzen, prijsNu: 0.3 })).goedkoop;
    expect(g).toMatchObject({ van: '2026-11-08T02:00:00.000Z', tot: '2026-11-08T04:00:00.000Z', prijs: 0.14, prijsNu: 0.3, uren: 2, totPct: 80, kosten: 1.68, nietNodig: false });
    // Zonder accu drie uur, zonder einddoel.
    const zonder = laadAdvies(auto({ accuKWh: null, laadt: false }), ctx({ prijzen, prijsNu: 0.3 })).goedkoop;
    expect(zonder).toMatchObject({ van: '2026-11-08T02:00:00.000Z', tot: '2026-11-08T05:00:00.000Z', uren: 3, totPct: null, kosten: null });
    // Scheelt het weinig, of is hij al vol, dan niets.
    expect(laadAdvies(auto(), ctx({ prijzen, prijsNu: 0.17 })).goedkoop).toBeNull();
    expect(laadAdvies(auto({ pct: 80 }), ctx({ prijzen, prijsNu: 0.3 })).goedkoop).toBeNull();
    // Laadt hij op zon en is hij vóór die tijd vol, dan is het vandaag niet nodig.
    const opZon = laadAdvies(auto({ volOm: '2026-11-07T16:05:00Z' }), ctx({ netW: -200, prijzen, prijsNu: 0.3 })).goedkoop;
    expect(opZon?.nietNodig).toBe(true);
  });
});

describe('de prijzen per uur uit een prijs-entiteit', () => {
  const vandaag = Date.parse('2026-11-07T00:00:00Z');
  it('leest Nord Pool en maakt van kwartieren uren', () => {
    const raw = (dag: number) => Array.from({ length: 96 }, (_, i) => ({ start: new Date(dag + i * 900_000).toISOString(), end: new Date(dag + (i + 1) * 900_000).toISOString(), value: i < 4 ? 0.1 + i * 0.02 : 0.25 }));
    const p = prijzenVooruit({ raw_today: raw(vandaag), raw_tomorrow: raw(vandaag + 24 * UUR), unit: 'EUR/kWh' }, '0.25', 'EUR/kWh', nu);
    expect(p).toHaveLength(48);
    expect(p[0]).toEqual({ vanMs: vandaag, prijs: expect.closeTo(0.13, 6) });
  });

  it('volgt de schaal van de prijs van nu', () => {
    // Zonneplan: de lijst in tienmiljoensten, de entiteit in euro.
    const forecast = Array.from({ length: 12 }, (_, i) => ({ datetime: new Date(vandaag + 12 * UUR + i * UUR).toISOString(), electricity_price: 2_337_000 + i * 10_000 }));
    const p = prijzenVooruit({ forecast }, '0.2337', '€/kWh', nu);
    expect(p[0]!.prijs).toBeCloseTo(0.2337, 4);
    // ENTSO-e in €/MWh.
    const prices = Array.from({ length: 6 }, (_, i) => ({ time: new Date(vandaag + 12 * UUR + i * UUR).toISOString(), price: 120 + i }));
    expect(prijzenVooruit({ prices }, '120', '€/MWh', nu)[1]!.prijs).toBeCloseTo(0.121, 6);
  });

  it('negeert wat geen prijslijst is', () => {
    expect(prijzenVooruit({ friendly_name: 'Prijs', icon: 'mdi:cash', options: ['a', 'b'] }, '0.3', '€/kWh', nu)).toEqual([]);
    expect(prijzenVooruit(null, '0.3', '€/kWh', nu)).toEqual([]);
  });
});
