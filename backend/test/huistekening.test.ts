/**
 * Je huis tekenen (besluit 308, stap 1): wat de tekentafel bewaart, en de vorm
 * waarop hij tekent. Een kamer die verdwijnt of verhuist, mag het bewaren nooit
 * blokkeren.
 */
import { describe, expect, it } from 'vitest';

import type { Gebouw, Xy } from '../src/web/daken.js';
import { leesEtage, leesPlek, leesTekening, leesZoneLijn, tekenSoort, tekenVorm, verschuif, WONING_MAAT, zoneVanPlek } from '../src/web/huistekening.js';
import { validateLayout, type LayoutKnown } from '../src/web/layout.js';

const known: LayoutKnown = {
  deviceIds: new Set(['nest', 'light.sfeerverlichting']),
  zoneIds: new Set(['woonkamer']),
  gevelIds: new Set(),
};

const indeling = (extra: Record<string, unknown> = {}) => ({
  versie: 1,
  etages: {},
  kamers: [
    { id: 'woonkamer', naam: 'Woonkamer', etage: 'bg', zones: [{ id: 'keuken', naam: 'Keuken' }, { id: 'zit', naam: 'Zithoek' }], regelzone: 'woonkamer', haGebied: null },
    { id: 'hal', naam: 'Hal', etage: 'bg', zones: [], regelzone: null, haGebied: null },
    { id: 'slaapkamer', naam: 'Slaapkamer', etage: 'e1', zones: [], regelzone: null, haGebied: null },
  ],
  apparaten: { nest: { kamer: 'woonkamer', zone: null } },
  ...extra,
});

describe('de tekening lezen', () => {
  it('bewaart per ruimte de rechthoeken op 10 cm, met een kamer, een eigen naam of niets', () => {
    const r = leesEtage(
      [
        { kamer: 'woonkamer', vakken: [[0, 0, 6.04, 8.4], [6, 4, 4, 4.4]] },
        { naam: '  Meter   kast ', soort: 'berging', vakken: [[6, 0, 1, 1.2]] },
        { naam: 'Trap', soort: 'raket', vakken: [[7, 0, 1.2, 1.4]] },
        { vakken: [[8.2, 0, 1.8, 4]] },
      ],
      (k) => k === 'woonkamer',
    );
    expect(r).toEqual({
      ruimtes: [
        { kamer: 'woonkamer', vakken: [[0, 0, 6, 8.4], [6, 4, 4, 4.4]] },
        { naam: 'Meter kast', soort: 'berging', vakken: [[6, 0, 1, 1.2]] },
        { naam: 'Trap', vakken: [[7, 0, 1.2, 1.4]] },
        { vakken: [[8.2, 0, 1.8, 4]] },
      ],
    });
  });

  it('laat een kamer die hier niet (meer) staat los, en houdt het vak; twee keer dezelfde kamer: de eerste', () => {
    const r = leesEtage(
      [
        { kamer: 'weg', vakken: [[0, 0, 2, 2]] },
        { kamer: 'hal', vakken: [[2, 0, 2, 2]] },
        { kamer: 'hal', vakken: [[4, 0, 2, 2]] },
      ],
      (k) => k === 'hal',
    );
    expect(r).toEqual({ ruimtes: [{ vakken: [[0, 0, 2, 2]] }, { kamer: 'hal', vakken: [[2, 0, 2, 2]] }, { vakken: [[4, 0, 2, 2]] }] });
  });

  it('weigert wat geen tekening kan zijn', () => {
    for (const fout of ['x', [{ vakken: [] }], [{ vakken: [[0, 0, 2]] }], [{ vakken: [[0, 0, -1, 2]] }], [{ vakken: [[500, 0, 1, 1]] }], Array.from({ length: 81 }, () => ({ vakken: [[0, 0, 1, 1]] }))]) {
      expect('fout' in leesEtage(fout, () => true), JSON.stringify(fout).slice(0, 60)).toBe(true);
    }
    expect('fout' in leesEtage([{ vakken: Array.from({ length: 401 }, () => [0, 0, 1, 1]) }], () => true)).toBe(true);
  });

  it('laat een etage die er niet meer is weg, zonder te weigeren', () => {
    expect(leesTekening({ bg: [{ vakken: [[0, 0, 1, 1]] }], weg: [{ vakken: [[0, 0, 1, 1]] }] }, (e) => e === 'bg', () => false)).toEqual({ tekening: { bg: [{ vakken: [[0, 0, 1, 1]] }] } });
  });

  it('houdt een zonelijn alleen bij twee of meer zones, en een plek alleen op een etage die er is', () => {
    expect(leesZoneLijn({ as: 'u', op: 4.03 }, 2)).toEqual({ as: 'u', op: 4 });
    expect(leesZoneLijn({ as: 'u', op: 4 }, 1)).toBeNull();
    expect(leesZoneLijn({ as: 'x', op: 4 }, 2)).toBeNull();
    expect(leesPlek({ etage: 'bg', u: 1.234, v: 2 }, () => true)).toEqual({ etage: 'bg', u: 1.23, v: 2 });
    expect(leesPlek({ etage: 'weg', u: 1, v: 2 }, (e) => e === 'bg')).toBeNull();
    expect(leesPlek({ etage: 'bg', u: 'een' }, () => true)).toEqual({ fout: expect.any(String) });
    expect(leesPlek(null, () => true)).toBeNull();
  });
});

describe('de tekening in de indeling', () => {
  const tekening = {
    bg: [
      { kamer: 'woonkamer', vakken: [[0, 0, 6, 8]] },
      { kamer: 'hal', vakken: [[6, 0, 2, 8]] },
      { kamer: 'slaapkamer', vakken: [[8, 0, 2, 8]] },
    ],
    e1: [{ kamer: 'slaapkamer', vakken: [[0, 0, 10, 8]] }],
    buiten: [{ vakken: [[0, 0, 1, 1]] }],
  };

  it('bewaart de ruimtes, de zonelijn en de plek', () => {
    const r = validateLayout(indeling({ plattegrond: tekening, kamers: indeling().kamers.map((k) => (k.id === 'woonkamer' ? { ...k, zoneLijn: { as: 'v', op: 4 } } : k)), apparaten: { nest: { kamer: 'woonkamer', zone: null, plek: { etage: 'bg', u: 0.2, v: 7.8 } } } }), known);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Buiten wordt niet getekend; de slaapkamer staat niet op de begane grond, dus daar is het een vak zonder naam.
    expect(r.layout.plattegrond).toEqual({ bg: [{ kamer: 'woonkamer', vakken: [[0, 0, 6, 8]] }, { kamer: 'hal', vakken: [[6, 0, 2, 8]] }, { vakken: [[8, 0, 2, 8]] }], e1: [{ kamer: 'slaapkamer', vakken: [[0, 0, 10, 8]] }] });
    expect(r.layout.kamers.find((k) => k.id === 'woonkamer')?.zoneLijn).toEqual({ as: 'v', op: 4 });
    expect(r.layout.apparaten['nest']?.plek).toEqual({ etage: 'bg', u: 0.2, v: 7.8 });
  });

  it('blijft bewaren als een kamer weg is, verhuist, of een zone kwijt is', () => {
    const kamers = indeling()
      .kamers.filter((k) => k.id !== 'hal')
      .map((k) => (k.id === 'woonkamer' ? { ...k, zones: [{ id: 'keuken', naam: 'Keuken' }], zoneLijn: { as: 'u', op: 3 } } : k.id === 'slaapkamer' ? { ...k, etage: 'bg' } : k));
    const r = validateLayout(indeling({ kamers, plattegrond: tekening, apparaten: { nest: { kamer: 'woonkamer', zone: null, plek: { etage: 'e7', u: 1, v: 1 } } } }), known);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layout.plattegrond).toEqual({ bg: [{ kamer: 'woonkamer', vakken: [[0, 0, 6, 8]] }, { vakken: [[6, 0, 2, 8]] }, { kamer: 'slaapkamer', vakken: [[8, 0, 2, 8]] }], e1: [{ vakken: [[0, 0, 10, 8]] }] });
    expect(r.layout.kamers.find((k) => k.id === 'woonkamer')?.zoneLijn).toBeUndefined();
    expect(r.layout.apparaten['nest']?.plek).toBeUndefined();
  });

  it('weigert een tekening die niet kan, met een reden', () => {
    const r = validateLayout(indeling({ plattegrond: { bg: [{ vakken: [[0, 0, 0, 1]] }] } }), known);
    expect(r).toEqual({ ok: false, reden: expect.stringContaining('plattegrond bg') });
  });
});

describe('de vorm om op te tekenen', () => {
  // Een huis met de voorgevel op het zuiden: x naar het oosten, y naar het noorden.
  const blok = (id: string, soort: Gebouw['soort'], x0: number, y0: number, x1: number, y1: number): Gebouw => ({
    id,
    soort,
    bron: 'kaart',
    omtrek: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Xy[],
    dakvorm: 'zadel',
    nokDeg: 90,
  });

  it('zonder gebouwen een rechthoek uit het woningtype', () => {
    expect(tekenVorm([], null, 'rij')).toEqual({ maat: { breed: 5.4, diep: 9 }, blokken: [{ id: 'hoofd', soort: 'hoofdhuis', u: 0, v: 0, b: 5.4, d: 9 }], nul: { u: 0, v: 0 }, bron: 'woning' });
    expect(tekenVorm([{ ...blok('huis', 'hoofdhuis', -5, -4.5, 5, 4.5), bron: 'schatting' }], 180, null).maat).toEqual({ breed: WONING_MAAT['vrijstaand']![0], diep: WONING_MAAT['vrijstaand']![1] });
  });

  it('het hoofdhuis met een garage links en een uitbouw achter, in de assen van het hoofdhuis', () => {
    const v = tekenVorm(
      [
        blok('huis', 'hoofdhuis', 0, 0, 10, 8.4),
        // De garage staat links (het westen), tegen het huis aan.
        blok('garage', 'garage', -3.4, 1, 0, 7.2),
        // De uitbouw achter (het noorden).
        blok('uitbouw', 'uitbouw', 5.4, 8.4, 10, 11.6),
        // Een tuinhuis en een losse schuur tellen niet mee.
        blok('tuinhuis', 'tuinhuis', 0, 20, 3, 23),
        blok('anders', 'garage', 20, 0, 24, 6),
      ],
      180,
      null,
    );
    expect(v.bron).toBe('gebouwen');
    expect(v.maat).toEqual({ breed: 13.4, diep: 11.6 });
    expect(v.nul).toEqual({ u: 3.4, v: 0 });
    // De voorgevel op het zuiden: v loopt naar het noorden, de garage komt links (u = 0).
    expect(v.blokken).toEqual([
      { id: 'hoofd', soort: 'hoofdhuis', u: 3.4, v: 0, b: 10, d: 8.4 },
      { id: 'garage', soort: 'garage', u: 0, v: 1, b: 3.4, d: 6.2 },
      { id: 'uitbouw', soort: 'uitbouw', u: 8.8, v: 8.4, b: 4.6, d: 3.2 },
    ]);
  });

  it('schuift een tekening van de hoek van het hoofdhuis naar die van het hele huis, en terug', () => {
    const t = { bg: [{ kamer: 'hal', vakken: [[0, 0, 2.4, 8.4]] as const }] };
    const heen = verschuif(t, 3.4, 0);
    expect(heen).toEqual({ bg: [{ kamer: 'hal', vakken: [[3.4, 0, 2.4, 8.4]] }] });
    expect(verschuif(heen, -3.4, 0)).toEqual(t);
  });
});

describe('de apparaten in de tekening (stap 3)', () => {
  it('een klimaatapparaat dat kan koelen is een airco, anders een thermostaat; een stekker zonder soort', () => {
    expect(tekenSoort({ soort: 'klimaat', klimaat: { kanKoelen: true } })).toBe('airco');
    expect(tekenSoort({ soort: 'klimaat', klimaat: { kanKoelen: false } })).toBe('thermostaat');
    expect(tekenSoort({ soort: 'klimaat', klimaat: { kanKoelen: true }, radiatorknop: {} })).toBe('thermostaat');
    expect(tekenSoort({ soort: 'licht' })).toBe('licht');
    expect(tekenSoort({ soort: 'rookmelder' })).toBe('rookmelder');
    expect(tekenSoort({ soort: 'apparaat', warmte: { soort: 'boiler' } })).toBe('boiler');
    expect(tekenSoort({ soort: 'apparaat', warmte: { soort: 'stekker' } })).toBe('stekker');
    expect(tekenSoort({ soort: 'apparaat' })).toBe('stekker');
  });

  it('een plek ligt in de zone aan zijn kant van de lijn; zonder lijn, met drie zones of op een andere etage: geen', () => {
    const zones = [{ id: 'keuken' }, { id: 'zit' }];
    const kamer = { etage: 'bg', zones, zoneLijn: { as: 'u' as const, op: 4 } };
    expect(zoneVanPlek(kamer, { etage: 'bg', u: 3.9, v: 2 })).toBe('keuken');
    expect(zoneVanPlek(kamer, { etage: 'bg', u: 4, v: 2 })).toBe('zit');
    expect(zoneVanPlek({ ...kamer, zoneLijn: { as: 'v', op: 5 } }, { etage: 'bg', u: 9, v: 6 })).toBe('zit');
    expect(zoneVanPlek({ etage: 'bg', zones }, { etage: 'bg', u: 1, v: 1 })).toBeNull();
    expect(zoneVanPlek({ ...kamer, zones: [...zones, { id: 'eet' }] }, { etage: 'bg', u: 1, v: 1 })).toBeNull();
    expect(zoneVanPlek(kamer, { etage: 'e1', u: 1, v: 1 })).toBeNull();
  });
});
