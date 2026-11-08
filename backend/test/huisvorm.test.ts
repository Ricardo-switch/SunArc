/**
 * Je huis op maat (besluit 288, stap 1): de kamers als vakken, de maat van de
 * etages, de zones als lijn en de plek van een apparaat.
 */

import { describe, expect, it } from 'vitest';

import { kaderVan, leesEtageMaten, leesPlattegronden, leesPlek, leesVak, leesZoneGrenzen, lijnOp, murenIn, naarKaart, ruimtesIn, uitKaart, vakkenIn, type Vak } from '../src/web/huisvorm.js';
import { validateLayout, type LayoutKnown } from '../src/web/layout.js';

const alles = () => true;
const huis = { u: 0, v: 0, breed: 10, diep: 8.4 };

/** De schets #hal: een hal rechts erin, de woonkamer als U eromheen. */
const halRechts: Vak = { as: 'v', op: 3, a: { kamer: 'woonkamer' }, b: { as: 'v', op: 2.6, a: { as: 'u', op: 7.6, a: { kamer: 'woonkamer' }, b: { kamer: 'hal' } }, b: { kamer: 'woonkamer' } } };

describe('een vak lezen', () => {
  it('leest lijnen en vakken, en rondt af op centimeters', () => {
    const v = leesVak({ as: 'u', op: 3.004, a: { kamer: 'hal' }, b: { naam: '  Toilet ' } }, alles);
    expect(v).toEqual({ as: 'u', op: 3, a: { kamer: 'hal' }, b: { naam: 'Toilet' } });
  });

  it('laat een kamer die hier niet kan staan weg, zodat bewaren blijft werken', () => {
    expect(leesVak({ kamer: 'weg' }, (k) => k === 'hal')).toEqual({});
    expect(leesVak({ kamer: 'weg', naam: 'Overloop' }, () => false)).toEqual({ naam: 'Overloop' });
  });

  it('weigert een lijn die niet klopt', () => {
    expect(leesVak({ as: 'x', op: 3, a: {}, b: {} }, alles)).toHaveProperty('fout');
    expect(leesVak({ as: 'u', op: -1, a: {}, b: {} }, alles)).toHaveProperty('fout');
    expect(leesVak({ as: 'u', op: 2, a: {} }, alles)).toHaveProperty('fout');
    expect(leesVak('hal', alles)).toHaveProperty('fout');
  });

  it('houdt het aantal vakken en de diepte binnen de grens', () => {
    let diep: unknown = {};
    for (let i = 0; i < 12; i++) diep = { as: 'u', op: 1, a: diep, b: {} };
    expect(leesVak(diep, alles)).toHaveProperty('fout');
    let breed: unknown = {};
    for (let i = 0; i < 41; i++) breed = { as: 'u', op: 1, a: breed, b: {} };
    expect(leesVak(breed, alles)).toHaveProperty('fout');
  });
});

describe('de vakken en ruimtes', () => {
  it('geeft elk vak zijn rechthoek', () => {
    const v = vakkenIn({ as: 'u', op: 3, a: { as: 'v', op: 5.4, a: { kamer: 'hal' }, b: { naam: 'Toilet' } }, b: { kamer: 'woonkamer' } }, huis);
    expect(v.map((x) => [x.pad, x.r])).toEqual([
      ['aa', { u: 0, v: 0, breed: 3, diep: 5.4 }],
      ['ab', { u: 0, v: 5.4, breed: 3, diep: 3 }],
      ['b', { u: 3, v: 0, breed: 7, diep: 8.4 }],
    ]);
  });

  it('houdt een lijn binnen het vak', () => {
    expect(lijnOp(12, 10)).toBe(9.7);
    expect(lijnOp(0.1, 10)).toBe(0.3);
    expect(lijnOp(0.2, 0.4)).toBe(0.2);
  });

  it('maakt van vakken met dezelfde kamer één ruimte: de woonkamer als U om de hal', () => {
    const r = ruimtesIn(vakkenIn(halRechts, huis));
    const woon = r.find((x) => x.kamer === 'woonkamer');
    expect(woon?.vakken).toHaveLength(3);
    expect(woon?.m2).toBe(77.8);
    expect(r.find((x) => x.kamer === 'hal')?.m2).toBe(6.2);
  });

  it('zet alleen muren tussen verschillende ruimtes', () => {
    const m = murenIn(vakkenIn(halRechts, huis));
    // Alleen om de hal: links, voor en achter. Tussen de delen van de woonkamer niet.
    expect(m).toHaveLength(3);
    expect(m).toContainEqual([7.6, 3, 7.6, 5.6]);
    expect(m).toContainEqual([7.6, 3, 10, 3]);
    expect(m).toContainEqual([7.6, 5.6, 10, 5.6]);
  });

  it('houdt vakken met een eigen naam los, ook als ze naast elkaar liggen', () => {
    const r = ruimtesIn(vakkenIn({ as: 'u', op: 5, a: { naam: 'Overloop' }, b: { naam: 'Overloop' } }, huis));
    expect(r).toHaveLength(2);
  });
});

describe('de assen van een gebouw', () => {
  const blok = { omtrek: [[0, 0], [10, 0], [10, 8], [0, 8]] as [number, number][], bron: 'kaart' as const };

  it('legt u langs de voorgevel en v naar achter, vanaf de linker voorhoek', () => {
    // De voorgevel kijkt naar het zuiden: je staat op straat en kijkt naar het noorden, rechts is het oosten.
    const k = kaderVan(blok, 180);
    expect(k.breed).toBe(10);
    expect(k.diep).toBe(8);
    expect(k.oorsprong).toEqual([0, 0]);
    expect(naarKaart(k, 10, 8).map((n) => Math.round(n * 100) / 100)).toEqual([10, 8]);
  });

  it('draait mee met een voorgevel naar het oosten', () => {
    const k = kaderVan(blok, 90);
    expect(k.breed).toBe(8);
    expect(k.diep).toBe(10);
    // De linker voorhoek ligt dan in het zuidoosten.
    expect(k.oorsprong).toEqual([10, 0]);
    const [u, v] = uitKaart(k, naarKaart(k, 2.5, 4));
    expect([Math.round(u * 100) / 100, Math.round(v * 100) / 100]).toEqual([2.5, 4]);
  });
});

describe('de rest van stap 1', () => {
  it('leest de maat van een etage', () => {
    const m = leesEtageMaten({ e1: { hoogte: 2.84, op: ['huis'] }, bg: {} }, alles);
    expect(m).toEqual({ maten: { e1: { hoogte: 2.8, op: ['huis'] } } });
    expect(leesEtageMaten({ e1: { hoogte: 12 } }, alles)).toHaveProperty('fout');
    expect(leesEtageMaten({ e1: { op: ['huis', 'huis'] } }, alles)).toHaveProperty('fout');
    expect(leesEtageMaten({ kelder: {} }, (e) => e !== 'kelder')).toHaveProperty('fout');
  });

  it('leest een plattegrond per etage en gebouw', () => {
    const p = leesPlattegronden({ bg: { huis: { kamer: 'hal' } } }, alles, (e, k) => e === 'bg' && k === 'hal');
    expect(p).toEqual({ plattegrond: { bg: { huis: { kamer: 'hal' } } } });
    expect(leesPlattegronden({ bg: { Huis: {} } }, alles, alles)).toHaveProperty('fout');
  });

  it('leest de plek van een apparaat', () => {
    expect(leesPlek({ gebouw: 'huis', u: 9.333, v: 7.6 })).toEqual({ gebouw: 'huis', u: 9.33, v: 7.6 });
    expect(leesPlek(null)).toBeNull();
    expect(leesPlek({ gebouw: 'huis', u: 'midden', v: 1 })).toHaveProperty('fout');
  });

  it('leest de lijnen tussen zones, en laat ze weg als ze niet meer kloppen', () => {
    expect(leesZoneGrenzen('v', [4.3], 2)).toEqual({ zoneAs: 'v', zoneGrenzen: [4.3] });
    expect(leesZoneGrenzen('v', [4.3], 3)).toBeNull();
    expect(leesZoneGrenzen('v', [5, 4], 3)).toBeNull();
    expect(leesZoneGrenzen('x', [4], 2)).toBeNull();
  });
});

describe('de indeling bewaart het', () => {
  const known: LayoutKnown = { deviceIds: new Set(['light.hal', 'light.sfeer']), zoneIds: new Set(['woonkamer']) };
  const basis = {
    versie: 1,
    etages: {},
    kamers: [
      { id: 'woonkamer', naam: 'Woonkamer', etage: 'bg', zones: [{ id: 'zit', naam: 'Zithoek' }, { id: 'eet', naam: 'Eethoek' }], zoneAs: 'v', zoneGrenzen: [4.3], regelzone: 'woonkamer', haGebied: null },
      { id: 'hal', naam: 'Hal', etage: 'bg', zones: [], regelzone: null, haGebied: null },
      { id: 'slaap', naam: 'Slaapkamer', etage: 'e1', zones: [], regelzone: null, haGebied: null },
    ],
    apparaten: { 'light.hal': { kamer: 'hal', zone: null, plek: { gebouw: 'huis', u: 8.8, v: 4.3 } } },
    plattegrond: { bg: { huis: halRechts, garage: { naam: 'Garage' } }, e1: { huis: { as: 'u', op: 5, a: { kamer: 'hal' }, b: { kamer: 'slaap' } } } },
    etageMaten: { bg: { hoogte: 2.8, op: ['huis', 'garage'] } },
  };

  it('bewaart vakken, zones, plekken en maten', () => {
    const r = validateLayout(basis, known);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layout.plattegrond?.['bg']?.['huis']).toEqual(halRechts);
    expect(r.layout.kamers[0]).toMatchObject({ zoneAs: 'v', zoneGrenzen: [4.3] });
    expect(r.layout.apparaten['light.hal']?.plek).toEqual({ gebouw: 'huis', u: 8.8, v: 4.3 });
    expect(r.layout.etageMaten).toEqual({ bg: { hoogte: 2.8, op: ['huis', 'garage'] } });
    // De hal staat beneden, dus boven valt hij uit zijn vak.
    expect(r.layout.plattegrond?.['e1']?.['huis']).toEqual({ as: 'u', op: 5, a: {}, b: { kamer: 'slaap' } });
  });

  it('laat zonder de nieuwe velden alles zoals het was', () => {
    const { plattegrond: _p, etageMaten: _m, ...oud } = basis;
    const r = validateLayout(oud, known);
    expect(r.ok && r.layout).not.toHaveProperty('plattegrond');
    expect(r.ok && r.layout).not.toHaveProperty('etageMaten');
  });

  it('weigert een plattegrond voor buiten of een onbekende etage', () => {
    expect(validateLayout({ ...basis, plattegrond: { buiten: { huis: {} } } }, known).ok).toBe(false);
    expect(validateLayout({ ...basis, plattegrond: { vliering: { huis: {} } } }, known).ok).toBe(false);
    expect(validateLayout({ ...basis, apparaten: { 'light.hal': { kamer: 'hal', zone: null, plek: { gebouw: 'huis' } } } }, known).ok).toBe(false);
  });
});
