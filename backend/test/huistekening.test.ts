/**
 * Je huis tekenen (besluit 308, stap 1): wat de tekentafel bewaart, en de vorm
 * waarop hij tekent. Een kamer die verdwijnt of verhuist, mag het bewaren nooit
 * blokkeren.
 */
import { describe, expect, it } from 'vitest';

import { leesDaken, leesKapellen, type Daken, type DakVlak, type Gebouw, type Xy } from '../src/web/daken.js';
import { bijfuncties, bronVanDaken, bronVorm, dakenMetBron, dakkapellen, DEEL, erfOm, erfRuimteOk, HUIS_OP_ERF, leesOpeningen, verschuifOpeningen, gebouwDak, gebouwErbij, gebouwWeg, huisUitTekening, kaartVernieuwd, gebouwKapel, kapelVanBewoner, scheefDak, eenPapier, etageHoogtes, lagenOnderDak, leesEtage, leesPlek, leesTekening, leesZoneLijn, tekenSoort, tekenVorm, verschuif, WONING_MAAT, woningUitKaart, zoneVanPlek } from '../src/web/huistekening.js';
import { hoortBijVan } from '../src/web/house.js';
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
    // Buiten wordt sinds 19 november 2026 ook getekend; de slaapkamer staat niet op de begane grond, dus daar is het een vak zonder naam.
    expect(r.layout.plattegrond).toEqual({ bg: [{ kamer: 'woonkamer', vakken: [[0, 0, 6, 8]] }, { kamer: 'hal', vakken: [[6, 0, 2, 8]] }, { vakken: [[8, 0, 2, 8]] }], e1: [{ kamer: 'slaapkamer', vakken: [[0, 0, 10, 8]] }], buiten: [{ vakken: [[0, 0, 1, 1]] }] });
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
    expect(r.layout.plattegrond).toEqual({ bg: [{ kamer: 'woonkamer', vakken: [[0, 0, 6, 8]] }, { vakken: [[6, 0, 2, 8]] }, { kamer: 'slaapkamer', vakken: [[8, 0, 2, 8]] }], e1: [{ vakken: [[0, 0, 10, 8]] }], buiten: [{ vakken: [[0, 0, 1, 1]] }] });
    expect(r.layout.kamers.find((k) => k.id === 'woonkamer')?.zoneLijn).toBeUndefined();
    expect(r.layout.apparaten['nest']?.plek).toBeUndefined();
  });

  it('weigert een tekening die niet kan, met een reden', () => {
    const r = validateLayout(indeling({ plattegrond: { bg: [{ vakken: [[0, 0, 0, 1]] }] } }), known);
    expect(r).toEqual({ ok: false, reden: expect.stringContaining('plattegrond bg') });
  });
});

/*
 * Buiten als eigen tekening (19 november 2026, schets Wand-Huis-Buiten): het
 * erf om de gebouwen, het huis als vast vak, en een deel van een ruimte buiten
 * als eigen vak (`kamer~zone`).
 */
describe('buiten als eigen tekening', () => {
  it('legt het erf om de gebouwen: 3 m opzij, 6 m voor en 12 m achter het huis, en 3 m om een gebouw dat verder staat', () => {
    expect(erfOm([{ soort: 'hoofdhuis', u: 0, v: 0, b: 10, d: 8 }])).toEqual({ u: -3, v: -6, b: 16, d: 26 });
    // Een tuinhuis achterin, 20 m van de straat: het erf loopt tot 3 m erachter, niet 12 m.
    expect(erfOm([{ soort: 'hoofdhuis', u: 0, v: 0, b: 10, d: 8 }, { soort: 'tuinhuis', u: 2, v: 20, b: 3, d: 2 }])).toEqual({ u: -3, v: -6, b: 16, d: 31 });
    expect(erfOm([])).toBeNull();
    // Een buurhuis tegen de rechtergevel (twee-onder-een-kap): de erfgrens ligt daar tegen het huis; links blijft de strook.
    const buur = [{ punten: [[10, 0], [16, 0], [16, 8], [10, 8]] as [number, number][] }];
    expect(erfOm([{ soort: 'hoofdhuis', u: 0, v: 0, b: 10, d: 8 }], buur)).toEqual({ u: -3, v: -6, b: 13, d: 26 });
    // Een garage links en de buur rechts: links tot de garage plus de strook, rechts tegen het huis.
    expect(erfOm([{ soort: 'hoofdhuis', u: 0, v: 0, b: 10, d: 8 }, { soort: 'garage', u: -2.5, v: 2, b: 2.5, d: 8 }], buur)).toMatchObject({ u: -5.5, b: 15.5 });
    // Een woning tegen de garage (Ricardo, 20 november 2026): ook daar strak tegen de garage.
    const links = [{ punten: [[-9, 0], [-2.5, 0], [-2.5, 10], [-9, 10]] as [number, number][] }];
    expect(erfOm([{ soort: 'hoofdhuis', u: 0, v: 0, b: 10, d: 8 }, { soort: 'garage', u: -2.5, v: 2, b: 2.5, d: 8 }], [...buur, ...links])).toMatchObject({ u: -2.5, b: 12.5 });
    // Een kleine schuur tegen de gevel is geen buurhuis.
    expect(erfOm([{ soort: 'hoofdhuis', u: 0, v: 0, b: 10, d: 8 }], [{ punten: [[10, 0], [12.5, 0], [12.5, 8], [10, 8]] }])).toEqual({ u: -3, v: -6, b: 16, d: 26 });
    // Een gebouw verder weg raakt niets.
    expect(erfOm([{ soort: 'hoofdhuis', u: 0, v: 0, b: 10, d: 8 }], [{ punten: [[14, 0], [18, 0], [18, 8], [14, 8]] }])).toEqual({ u: -3, v: -6, b: 16, d: 26 });
  });

  it('kent op het erf het huis, een ruimte buiten en een deel ervan', () => {
    const kamers = [{ id: 'tuin', etage: 'buiten', zones: [{ id: 'terras' }, { id: 'border' }] }, { id: 'woonkamer', etage: 'bg', zones: [] }];
    expect(erfRuimteOk(HUIS_OP_ERF, kamers, 'buiten')).toBe(true);
    expect(erfRuimteOk('tuin', kamers, 'buiten')).toBe(true);
    expect(erfRuimteOk(`tuin${DEEL}terras`, kamers, 'buiten')).toBe(true);
    expect(erfRuimteOk(`tuin${DEEL}zwembad`, kamers, 'buiten')).toBe(false);
    expect(erfRuimteOk('woonkamer', kamers, 'buiten')).toBe(false);
    expect(erfRuimteOk(`tuin${DEEL}terras${DEEL}x`, kamers, 'buiten')).toBe(false);
  });

  it('bewaart de tekening van buiten met het huis en de delen, en een plek buiten', () => {
    const buitenKamers = [...indeling().kamers, { id: 'tuin', naam: 'Tuin', etage: 'buiten', zones: [{ id: 'terras', naam: 'Terras' }], regelzone: null, haGebied: null }];
    const plattegrond = { buiten: [{ kamer: HUIS_OP_ERF, vakken: [[3, 6, 10, 8]] }, { kamer: 'tuin', vakken: [[0, 0, 16, 6]] }, { kamer: `tuin${DEEL}terras`, vakken: [[3, 14, 10, 4]] }, { kamer: 'woonkamer', vakken: [[0, 20, 2, 2]] }] };
    const r = validateLayout(indeling({ kamers: buitenKamers, plattegrond, apparaten: { nest: { kamer: 'woonkamer', zone: null }, 'light.sfeerverlichting': { kamer: 'tuin', zone: 'terras', plek: { etage: 'buiten', u: 5, v: 15 } } } }), known);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // De woonkamer hoort niet buiten: daar is het een vak zonder naam.
    expect(r.layout.plattegrond?.['buiten']).toEqual([{ kamer: HUIS_OP_ERF, vakken: [[3, 6, 10, 8]] }, { kamer: 'tuin', vakken: [[0, 0, 16, 6]] }, { kamer: `tuin${DEEL}terras`, vakken: [[3, 14, 10, 4]] }, { vakken: [[0, 20, 2, 2]] }]);
    expect(r.layout.apparaten['light.sfeerverlichting']).toEqual({ kamer: 'tuin', zone: 'terras', plek: { etage: 'buiten', u: 5, v: 15 } });
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
    expect(tekenVorm([], null, 'rij')).toEqual({ maat: { breed: 5.4, diep: 9 }, blokken: [{ id: 'hoofd', soort: 'hoofdhuis', u: 0, v: 0, b: 5.4, d: 9, dak: 'zadel', nokLangs: 'x' }], nul: { u: 0, v: 0 }, bron: 'woning', uDeg: null, omgeving: [] });
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
        // Sinds 0.185.0 telt een tuinhuis van de kaart mee, ook los in de tuin; een geschat tuinhuis niet, en verder dan 30 meter ook niet.
        blok('tuinhuis', 'tuinhuis', 0, 20, 3, 23),
        { ...blok('schuur', 'tuinhuis', 12, 0, 14, 2), bron: 'schatting' },
        blok('ver', 'garage', 50, 0, 54, 6),
      ],
      180,
      null,
    );
    expect(v.bron).toBe('gebouwen');
    expect(v.maat).toEqual({ breed: 13.4, diep: 23 });
    expect(v.nul).toEqual({ u: 3.4, v: 0 });
    // De voorgevel op het zuiden: v loopt naar het noorden, de garage komt links (u = 0).
    expect(v.blokken).toEqual([
      { id: 'hoofd', soort: 'hoofdhuis', u: 3.4, v: 0, b: 10, d: 8.4, dak: 'zadel', nokLangs: 'x' },
      { id: 'garage', soort: 'garage', u: 0, v: 1, b: 3.4, d: 6.2, dak: 'zadel', nokLangs: 'x' },
      { id: 'uitbouw', soort: 'uitbouw', u: 8.8, v: 8.4, b: 4.6, d: 3.2, dak: 'zadel', nokLangs: 'x' },
      { id: 'tuinhuis', soort: 'tuinhuis', u: 3.4, v: 20, b: 3, d: 3, dak: 'zadel', nokLangs: 'x' },
    ]);
    // De nok loopt naar het oosten, en u ook: langs de voorgevel.
    expect(v.uDeg).toBe(90);
  });

  it('geeft de gebouwen eromheen in dezelfde assen, met hun plek in de lijst', () => {
    const v = tekenVorm([blok('huis', 'hoofdhuis', 0, 0, 10, 8.4), blok('garage', 'garage', -3.4, 1, 0, 7.2)], 180, null, [
      [[12, 0], [14, 0], [14, 2], [12, 2]],
      [[1, 1]],
    ]);
    // Het tweede is geen omtrek en valt weg; het eerste houdt zijn plek 0, ook al schuift alles 3,4 m op.
    expect(v.omgeving).toEqual([{ i: 0, punten: [[15.4, 0], [17.4, 0], [17.4, 2], [15.4, 2]] }]);
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

  it('een meter die beweging ziet is een bewegingsmelder; alleen temperatuur blijft een meter', () => {
    expect(tekenSoort({ soort: 'meter', meting: { beweging: { nu: false } } })).toBe('beweging');
    expect(tekenSoort({ soort: 'meter', meting: {} })).toBe('meter');
    expect(tekenSoort({ soort: 'meter' })).toBe('meter');
  });

  it('één apparaat, één bolletje: de camera is het hoofd, twee lampen aan één relais blijven los', () => {
    const entities = [
      { entity_id: 'camera.oprit', device_id: 'reolink' },
      { entity_id: 'light.oprit_schijnwerper', device_id: 'reolink' },
      { entity_id: 'binary_sensor.oprit_beweging', device_id: 'reolink' },
      { entity_id: 'light.relais_1', device_id: 'shelly' },
      { entity_id: 'light.relais_2', device_id: 'shelly' },
      { entity_id: 'light.los', device_id: null },
    ];
    const found = [
      { device: { id: 'light.oprit_schijnwerper', soort: 'licht' as const } },
      { device: { id: 'camera.oprit', soort: 'camera' as const } },
      { device: { id: 'binary_sensor.oprit_beweging', soort: 'meter' as const } },
      { device: { id: 'light.relais_1', soort: 'licht' as const } },
      { device: { id: 'light.relais_2', soort: 'licht' as const } },
      { device: { id: 'light.los', soort: 'licht' as const } },
    ];
    expect(Object.fromEntries(hoortBijVan(found, entities))).toEqual({ 'light.oprit_schijnwerper': 'camera.oprit', 'binary_sensor.oprit_beweging': 'camera.oprit' });
  });

  it('een bijfunctie staat alleen onder zijn hoofd als dat hoofd er is; een verborgen camera laat zijn lamp los', () => {
    expect(Object.fromEntries(bijfuncties([{ id: 'camera.oprit' }, { id: 'light.schijnwerper', hoortBij: 'camera.oprit' }]))).toEqual({ 'light.schijnwerper': 'camera.oprit' });
    expect(bijfuncties([{ id: 'light.schijnwerper', hoortBij: 'camera.oprit' }]).size).toBe(0);
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

/*
 * Stap 4 (Vorm): de bronnen van de buitenkant. Kiezen doet wat Daken en
 * panelen doet; alle bronnen liggen op één ruitjespapier; de hoogte per etage
 * is een schatting uit goot en nok.
 */
describe('je huis tekenen: de bronnen bij Vorm (stap 4)', () => {
  const blok = (x0: number, y0: number, x1: number, y1: number): Xy[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const vlak = (extra: Partial<DakVlak> = {}): DakVlak => ({ letter: 'A', plek: 'hoofddak', opstelling: 'schuin', azimuthDeg: 180, tiltDeg: 40, aantal: 10, wpPerPaneel: 400, meter: null, bron: 'bewoner', ...extra });
  const daken = (gebouwen: Gebouw[], vlakken: DakVlak[] = []): Daken => ({ vlakken, voorgevelDeg: 180, omvormerW: null, gebouwen });
  const huis: Gebouw = { id: 'huis', soort: 'hoofdhuis', bron: 'schatting', omtrek: blok(-5, -4, 5, 4), dakvorm: 'zadel', nokDeg: 90 };
  const garage: Gebouw = { id: 'garage', soort: 'garage', bron: 'schatting', omtrek: blok(5, -4, 8, 2), dakvorm: 'plat', nokDeg: 0 };
  const schuur: Gebouw = { id: 'schuur', soort: 'tuinhuis', bron: 'bewoner', omtrek: blok(0, 8, 3, 10), dakvorm: 'zadel', nokDeg: 0 };
  const kaart = { stand: 'huis', hoofdhuis: blok(-6, -4, 6, 4), omgeving: [blok(20, 0, 25, 5)], dak: { dakvorm: 'schild' as const, nokDeg: 90, vlakken: [{ azimuthDeg: 180, tiltDeg: 44, m2: 50 }] }, hoogte: { goot: 6.2, nok: 9.7, lagen: 3 } };

  it('zegt welke bron het huis nu tekent', () => {
    expect(bronVanDaken([huis])).toBe('zelf');
    expect(bronVanDaken([{ ...huis, bron: 'kaart', kaart: 'bag3d' }])).toBe('bag3d');
    expect(bronVanDaken([{ ...huis, bron: 'kaart' }])).toBe('osm');
    expect(bronVanDaken([])).toBe('zelf');
  });

  it('kiest een kaart zoals Daken: de omtrek, uit 3D BAG ook het dak en de hoogte, geschatte blokken weg', () => {
    const d = dakenMetBron(daken([huis, garage, schuur], [vlak({ gebouw: 'huis', kant: 180 }), vlak({ letter: 'B', plek: 'garage', gebouw: 'garage', kant: null })]), 'bag3d', kaart)!;
    const h = d.gebouwen!.find((g) => g.soort === 'hoofdhuis')!;
    expect(h).toMatchObject({ id: 'huis', bron: 'kaart', kaart: 'bag3d', dakvorm: 'schild', dakBron: 'kaart', hoogteGoot: 6.2, hoogteNok: 9.7, lagen: 3 });
    expect(h.omtrek).toEqual(kaart.hoofdhuis);
    // De geschatte garage valt weg, het tuinhuis van de bewoner blijft; de vlakken op wat anders ligt raken los.
    expect(d.gebouwen!.map((g) => g.id)).toEqual(['huis', 'schuur']);
    expect(d.vlakken.map((v) => v.gebouw ?? null)).toEqual([null, null]);
    expect(d.omgeving).toHaveLength(1);
    expect(d.kaartDak).toEqual([{ azimuthDeg: 180, tiltDeg: 44, m2: 50 }]);
    // De plattegrond: alleen de omtrek; de hoogte en het dak uit 3D BAG gaan weg.
    const osm = dakenMetBron(d, 'osm', { stand: 'huis', hoofdhuis: blok(-5, -4, 5, 4) })!;
    const h2 = osm.gebouwen!.find((g) => g.soort === 'hoofdhuis')!;
    expect(h2).toMatchObject({ bron: 'kaart', kaart: 'osm' });
    expect(h2.hoogteGoot).toBeUndefined();
    expect(osm.kaartDak).toBeUndefined();
    // Een kaart die het huis niet kent: niets te kiezen.
    expect(dakenMetBron(d, 'osm', { stand: 'wijk' })).toBeNull();
    // De plattegrond met de 3D-kaart erbij (13 november 2026): de omtrek van OpenStreetMap, het dak, de hoogte en de dakvlakken van 3D BAG.
    const samen = dakenMetBron(d, 'osm', { stand: 'huis', hoofdhuis: blok(-5, -4, 5, 4) }, kaart)!;
    const h3 = samen.gebouwen!.find((g) => g.soort === 'hoofdhuis')!;
    expect(h3).toMatchObject({ kaart: 'osm', dakvorm: 'schild', hoogteGoot: 6.2, hoogteNok: 9.7 });
    expect(h3.omtrek).toEqual(blok(-5, -4, 5, 4));
    expect(samen.kaartDak).toEqual([{ azimuthDeg: 180, tiltDeg: 44, m2: 50 }]);
    expect(dakenMetBron(d, 'bag3d', null)).toBeNull();
  });

  it('zonder kaart blijft alleen wat de bewoner zelf neerzette, zoals Zonder kaart bij Daken', () => {
    const d = dakenMetBron(daken([{ ...huis, bron: 'kaart', kaart: 'osm' }, schuur], [vlak({ gebouw: 'huis', kant: 180 })]), 'zelf', null)!;
    expect(d.gebouwen!.map((g) => g.id)).toEqual(['schuur']);
    expect(d.vlakken[0]!.gebouw).toBeUndefined();
    expect(d.omgeving).toEqual([]);
  });

  it('legt alle bronnen en de tekening op één ruitjespapier, met de hoek van het hoofdhuis op dezelfde plek', () => {
    const p = eenPapier(
      { bag3d: [{ id: 'hoofd', soort: 'hoofdhuis', u: 0, v: 0, b: 10, d: 8 }, { id: 'garage', soort: 'garage', u: -3, v: 1, b: 3, d: 6 }], zelf: [{ id: 'hoofd', soort: 'hoofdhuis', u: 0, v: 0, b: 10, d: 9 }] },
      { bg: [{ kamer: 'woonkamer', vakken: [[0, -0.5, 10, 9.5]] }] },
    );
    expect(p.nul).toEqual({ u: 3, v: 0.5 });
    expect(p.maat).toEqual({ breed: 13, diep: 9.5 });
    expect(p.blokken['bag3d']![1]).toMatchObject({ u: 0, v: 1.5 });
    expect(p.blokken['zelf']![0]).toMatchObject({ u: 3, v: 0.5 });
  });

  it('schat de hoogte per etage: de zolder onder het dak, de rest deelt de goot, een kelder 2,5 m', () => {
    const etages = [{ id: 'e2', naam: 'Zolder' }, { id: 'e1', naam: 'Eerste' }, { id: 'bg', naam: 'Begane grond' }, { id: 'kelder', naam: 'Kelder' }];
    expect(lagenOnderDak(etages)).toBe(2);
    expect(etageHoogtes(etages, 6.2, 9.7)).toEqual([3.5, 3.1, 3.1, 2.5]);
    // Zonder zolder: alle etages onder de goot.
    expect(etageHoogtes([{ id: 'e1', naam: 'Eerste' }, { id: 'bg', naam: 'Beneden' }], 5.6, 5.6)).toEqual([2.8, 2.8]);
    expect(etageHoogtes([{ id: 'bg', naam: 'Beneden' }], 2.8, 5.8)).toEqual([2.8]);
  });
});

/*
 * Stap 5 (Huis in 3D): de nok hoeft niet in het midden. Uit de dakvlakken van
 * 3D BAG volgt waar hij ligt en hoe hoog de goot aan elke kant is.
 */
describe('je huis tekenen: deuren, ramen en de trap (0.187.0)', () => {
  it('leest de deuren en ramen per etage, en weigert wat niet kan', () => {
    const goed = leesOpeningen({ bg: [{ id: 'o1', soort: 'raam', as: 'v', op: 0, van: 1.04, tot: 2.2 }], weg: [{ id: 'o1', soort: 'deur', as: 'u', op: 0, van: 0, tot: 1 }] }, (e) => e === 'bg');
    expect(goed).toEqual({ openingen: { bg: [{ id: 'o1', soort: 'raam', as: 'v', op: 0, van: 1, tot: 2.2 }] } });
    expect(leesOpeningen({ bg: [{ id: 'o1', soort: 'luik', as: 'v', op: 0, van: 0, tot: 1 }] }, () => true)).toMatchObject({ fout: expect.any(String) });
    expect(leesOpeningen({ bg: [{ id: 'o1', soort: 'deur', as: 'v', op: 0, van: 0, tot: 0.1 }] }, () => true)).toMatchObject({ fout: expect.any(String) });
    expect(leesOpeningen({ bg: [{ id: 'o1', soort: 'deur', as: 'v', op: 0, van: 0, tot: 1 }, { id: 'o1', soort: 'deur', as: 'v', op: 0, van: 2, tot: 3 }] }, () => true)).toMatchObject({ fout: expect.any(String) });
  });

  it('schuift ze mee naar de hoek van het hele huis en terug', () => {
    const o = { bg: [{ id: 'o1', soort: 'deur' as const, as: 'u' as const, op: 2, van: 1, tot: 2 }, { id: 'o2', soort: 'raam' as const, as: 'v' as const, op: 0, van: 3, tot: 4.2 }] };
    const heen = verschuifOpeningen(o, 3.4, 1);
    expect(heen).toEqual({ bg: [{ id: 'o1', soort: 'deur', as: 'u', op: 5.4, van: 2, tot: 3 }, { id: 'o2', soort: 'raam', as: 'v', op: 1, van: 6.4, tot: 7.6 }] });
    expect(verschuifOpeningen(heen, -3.4, -1)).toEqual(o);
  });

  it('een trap houdt zijn richting, een andere ruimte niet', () => {
    expect(leesEtage([{ naam: 'Trap', soort: 'trap', omhoog: 'n', vakken: [[0, 0, 1, 3]] }, { naam: 'Hal', soort: 'hal', omhoog: 'n', vakken: [[1, 0, 2, 3]] }], () => false)).toEqual({
      ruimtes: [{ naam: 'Trap', soort: 'trap', omhoog: 'n', vakken: [[0, 0, 1, 3]] }, { naam: 'Hal', soort: 'hal', vakken: [[1, 0, 2, 3]] }],
    });
  });
});

describe('je huis tekenen: een dakkapel uit 3D BAG', () => {
  // Het huis van Ricardo, vereenvoudigd: 9,9 m diep van oost naar west, 5,6 m breed, de voorgevel op het oosten.
  const huis: Gebouw = { id: 'huis', soort: 'hoofdhuis', bron: 'kaart', kaart: 'bag3d', omtrek: [[0, 0], [9.9, 0], [9.9, 5.6], [0, 5.6]], dakvorm: 'zadel', nokDeg: 0 };
  const v = tekenVorm([huis], 90, null);
  const blok = v.blokken[0]!;
  // Het platte dakje van de dakkapel ligt aan de westkant, 1,5 tot 3,5 m van de achtergevel.
  const kapel = { azimuthDeg: 92, tiltDeg: 5.2, m2: 4.9, vorm: [[1.5, 1.5], [3.5, 1.5], [3.5, 4], [1.5, 4]] as Xy[], hoog: [8, 8.1] as const };

  it('legt hem aan de kant waar het vlak echt ligt, niet waar het naar wijst', () => {
    expect(v.kader).toBeTruthy();
    // Het vlak wijst naar het oosten (92°), maar ligt aan de westkant: achter (kant 1).
    expect(dakkapellen(blok, [kapel], v.kader!)).toEqual([{ kant: 1, van: 1.5, tot: 4, voor: 1.5, achter: 3.5, boven: 8.1 }]);
  });

  it('gokt niet: een vlak zonder plek, een schuin vlak of een plat dak geeft niets', () => {
    const { vorm: _v, ...zonder } = kapel;
    expect(dakkapellen(blok, [zonder], v.kader!)).toEqual([]);
    expect(dakkapellen(blok, [{ ...kapel, tiltDeg: 44 }], v.kader!)).toEqual([]);
    expect(dakkapellen({ ...blok, dak: 'plat' }, [kapel], v.kader!)).toEqual([]);
  });
});

describe('je huis tekenen: een gebouw erbij bij Vorm (0.185.0)', () => {
  const blok = (x0: number, y0: number, x1: number, y1: number): Xy[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const huis: Gebouw = { id: 'huis', soort: 'hoofdhuis', bron: 'kaart', kaart: 'bag3d', omtrek: blok(-5, -4, 5, 4), dakvorm: 'zadel', nokDeg: 90 };
  const tuinhuisVorm = blok(-2, 7, 1, 10);
  const daken = (extra: Partial<Daken> = {}): Daken => ({ vlakken: [], voorgevelDeg: 180, omvormerW: null, gebouwen: [huis], omgeving: [tuinhuisVorm], ...extra });

  it('wijst een gebouw van de kaart aan: het komt erbij en is weg uit de omgeving', () => {
    const uit = gebouwErbij(daken(), 0, 'tuinhuis')!;
    expect(uit.id).toBe('tuinhuis');
    const g = uit.daken.gebouwen!.find((x) => x.id === 'tuinhuis')!;
    expect(g).toMatchObject({ soort: 'tuinhuis', bron: 'kaart', kaart: 'bag3d', dakvorm: 'zadel' });
    expect(g.omtrek).toEqual(tuinhuisVorm);
    expect(uit.daken.omgeving).toEqual([]);
    // Het staat daarna in de vorm om op te tekenen, los achter het huis.
    expect(bronVorm(uit.daken, 180, null, 2).blokken.map((b) => b.soort)).toEqual(['hoofdhuis', 'tuinhuis']);
  });

  it('een tweede van dezelfde soort krijgt een eigen naam; een geschat blok krijgt de omtrek', () => {
    const al: Gebouw = { id: 'tuinhuis', soort: 'tuinhuis', bron: 'bewoner', omtrek: blok(6, 0, 8, 2), dakvorm: 'zadel', nokDeg: 0 };
    expect(gebouwErbij(daken({ gebouwen: [huis, al] }), 0, 'tuinhuis')!.id).toBe('tuinhuis-2');
    const geschat: Gebouw = { id: 'garage', soort: 'garage', bron: 'schatting', omtrek: blok(5, -4, 8, 2), dakvorm: 'plat', nokDeg: 0 };
    const uit = gebouwErbij(daken({ gebouwen: [huis, geschat] }), 0, 'garage')!;
    expect(uit.id).toBe('garage');
    expect(uit.daken.gebouwen!.find((x) => x.id === 'garage')).toMatchObject({ bron: 'kaart', omtrek: tuinhuisVorm });
  });

  it('weigert wat er niet is', () => {
    expect(gebouwErbij(daken(), 3, 'tuinhuis')).toBeNull();
    expect(gebouwWeg(daken(), 'huis')).toBeNull();
    expect(gebouwWeg(daken(), 'niets')).toBeNull();
  });

  it('haalt een gebouw weer weg: wat van de kaart kwam, staat weer in de omgeving', () => {
    const erbij = gebouwErbij(daken(), 0, 'carport')!;
    const weg = gebouwWeg(erbij.daken, erbij.id)!;
    expect(weg.gebouwen!.map((g) => g.id)).toEqual(['huis']);
    expect(weg.omgeving).toEqual([tuinhuisVorm]);
  });

  it('zet het dak van een gebouw: de dakvorm blijft van de bewoner, de vlakken erop zoekt SunArc opnieuw (stap 4)', () => {
    const vlak = { letter: 'A', gebouw: 'huis', kant: 90 } as unknown as DakVlak;
    const uit = gebouwDak(daken({ vlakken: [vlak] }), 'hoofd', { dakvorm: 'plat' })!;
    expect(uit.gebouwen![0]).toMatchObject({ id: 'huis', dakvorm: 'plat', dakBron: 'bewoner' });
    expect(uit.vlakken[0]).not.toHaveProperty('gebouw');
    // De nok een kwart: een zadeldak blijft onder de 180, een lessenaar draait helemaal rond.
    expect(gebouwDak(daken(), 'hoofd', { nok: true })!.gebouwen![0]!.nokDeg).toBe(0);
    const les = daken({ gebouwen: [{ ...huis, dakvorm: 'lessenaar', nokDeg: 300 }] });
    expect(gebouwDak(les, 'huis', { nok: true })!.gebouwen![0]!.nokDeg).toBe(30);
    expect(gebouwDak(daken(), 'niets', { nok: true })).toBeNull();
  });

  it('maakt van een zelf getekend huis het dak: de begane grond is de omtrek, en een andere hoek schuift mee (stap 4)', () => {
    const { kaart: _kaart, ...zonderKaart } = huis;
    const geschat: Gebouw = { ...zonderKaart, bron: 'schatting' };
    const zelf = daken({ gebouwen: [geschat] });
    // De straat in het zuiden: u loopt naar het oosten, v naar het noorden, vanaf de hoek linksvoor.
    const uit = huisUitTekening(zelf, { e1: [{ vakken: [[0, 0, 6, 8]] }], bg: [{ vakken: [[0, 0, 4, 8]] }, { vakken: [[4, 0, 6, 8]] }] }, ['bg', 'e1'])!;
    expect(uit).toMatchObject({ u0: 0, v0: 0 });
    expect(uit.daken.gebouwen![0]).toMatchObject({ id: 'huis', bron: 'bewoner', dakvorm: 'zadel', omtrek: [[-5, -4], [5, -4], [5, 4], [-5, 4]] });
    expect(uit.daken.gebouwen![0]).not.toHaveProperty('kaart');
    // Al zo: niets te doen.
    expect(huisUitTekening(uit.daken, { bg: [{ vakken: [[0, 0, 10, 8]] }] }, ['bg', 'e1'])).toBeNull();
    // De linkermuur een meter naar buiten getrokken: de hoek schuift een meter.
    const breder = huisUitTekening(uit.daken, { bg: [{ vakken: [[-1, 0, 11, 8]] }] }, ['bg', 'e1'])!;
    expect(breder).toMatchObject({ u0: -1, v0: 0 });
    expect(breder.daken.gebouwen![0]!.omtrek[0]).toEqual([-6, -4]);
    // Een huis uit de kaart, of nog niets getekend: niets.
    expect(huisUitTekening(daken(), { bg: [{ vakken: [[0, 0, 10, 8]] }] }, ['bg'])).toBeNull();
    expect(huisUitTekening(zelf, {}, ['bg', 'e1'])).toBeNull();
  });
});

describe('je huis tekenen: het dak voor het huis in 3D (stap 5)', () => {
  // Een huis van 9,8 bij 5,6 m met de straat in het oosten: u loopt naar het noorden, achter is het westen.
  const huis = { id: 'hoofd', soort: 'hoofdhuis' as const, u: 0, v: 0, b: 9.8, d: 5.6, dak: 'zadel' as const, nokLangs: 'x' as const };
  it('legt de nok waar de dakvlakken van boven gezien elkaar raken, met de goot per kant', () => {
    const vlakken = [{ azimuthDeg: 93, tiltDeg: 44, m2: 37.5 * 9.8 / 7.194 }, { azimuthDeg: 272, tiltDeg: 44, m2: 18.5 * 9.8 / 7.194 }];
    expect(scheefDak(huis, vlakken, 0, 9.2, 3.9)).toEqual({ nokVan0: 3.8, goot0: 5.6, goot1: 7.4 });
  });
  it('zegt niets bij een plat dak, zonder vlakken of met maar één kant', () => {
    expect(scheefDak({ ...huis, dak: 'plat' }, [{ azimuthDeg: 93, tiltDeg: 44, m2: 30 }], 0, 9.2, 3.9)).toBeNull();
    expect(scheefDak(huis, [], 0, 9.2, 3.9)).toBeNull();
    expect(scheefDak(huis, [{ azimuthDeg: 93, tiltDeg: 44, m2: 30 }], 0, 9.2, 3.9)).toBeNull();
    expect(scheefDak(huis, [{ azimuthDeg: 93, tiltDeg: 44, m2: 30 }], null, 9.2, 3.9)).toBeNull();
  });
  it('een lessenaar is hoog aan de kant waar hij niet naartoe kijkt', () => {
    expect(scheefDak({ ...huis, dak: 'lessenaar' }, [{ azimuthDeg: 270, tiltDeg: 15, m2: 50 }], 0, 6, 4)).toEqual({ nokVan0: 0, goot0: 6, goot1: 4 });
  });
});

describe('opnieuw kijken bij dezelfde kaart (stap 4 punt 3)', () => {
  const huis: Gebouw = { id: 'huis', soort: 'hoofdhuis', bron: 'kaart', kaart: 'bag3d', dakBron: 'kaart', omtrek: [[0, 0], [10, 0], [10, 8], [0, 8]], dakvorm: 'zadel', nokDeg: 0 };
  // Gekozen vóór 0.186: de dakvlakken zonder vorm en hoogte, geen hoogte van de goot.
  const oud: Daken = { vlakken: [], gebouwen: [huis], kaartDak: [{ azimuthDeg: 92, tiltDeg: 44, m2: 30 }] } as unknown as Daken;
  const vlak = { azimuthDeg: 92, tiltDeg: 44, m2: 30, vorm: [[0, 0], [5, 0], [5, 8], [0, 8]] as Xy[], hoog: [3.9, 9.2] as [number, number] };
  const bag = { stand: 'huis', hoofdhuis: [[0, 0], [10, 0], [10, 8], [0, 8]] as Xy[], dak: { dakvorm: 'zadel' as const, nokDeg: 2, vlakken: [vlak] }, hoogte: { goot: 2.1, nok: 9.1, lagen: 3 } };

  it('vult de dakvlakken en de ontbrekende hoogtes aan', () => {
    const nu = kaartVernieuwd(oud, 'bag3d', { osm: null, bag3d: bag })!;
    expect(nu.kaartDak).toEqual([vlak]);
    expect(nu.gebouwen![0]).toMatchObject({ hoogteGoot: 2.1, hoogteNok: 9.1, lagen: 3, nokDeg: 2, omtrek: huis.omtrek });
  });

  it('laat staan wat de bewoner koos, en een hoogte die er al is', () => {
    const eigen: Daken = { ...oud, gebouwen: [{ ...huis, dakBron: 'bewoner', dakvorm: 'schild', nokDeg: 90, hoogteGoot: 3 }] } as Daken;
    const nu = kaartVernieuwd(eigen, 'bag3d', { osm: null, bag3d: bag })!;
    expect(nu.gebouwen![0]).toMatchObject({ dakvorm: 'schild', nokDeg: 90, hoogteGoot: 3, hoogteNok: 9.1 });
  });

  it('doet niets zonder kaart, zonder 3D BAG of als alles er al is', () => {
    expect(kaartVernieuwd(oud, 'zelf', { osm: null, bag3d: bag })).toBeNull();
    expect(kaartVernieuwd(oud, 'bag3d', { osm: null, bag3d: { stand: 'geen' } })).toBeNull();
    const al = kaartVernieuwd(oud, 'bag3d', { osm: null, bag3d: bag })!;
    expect(kaartVernieuwd(al, 'bag3d', { osm: null, bag3d: bag })).toBeNull();
  });
});

describe('de dakkapellen van de bewoner (stap 4 punt 3, Je huis › Dak)', () => {
  const huis: Gebouw = { id: 'huis', soort: 'hoofdhuis', bron: 'bewoner', omtrek: [[0, 0], [10, 0], [10, 8], [0, 8]], dakvorm: 'zadel', nokDeg: 0 };
  const d: Daken = { vlakken: [], voorgevelDeg: 180, omvormerW: null, gebouwen: [huis] };

  it('leest hooguit vier dakkapellen met een kant, van, tot en diep', () => {
    expect(leesKapellen([{ kant: 1, van: 1.04, tot: 4, diep: 2, etage: 'e2' }])).toEqual([{ kant: 1, van: 1, tot: 4, diep: 2, etage: 'e2' }]);
    expect(leesKapellen([{ kant: 2, van: 1, tot: 4, diep: 2 }])).toBeNull();
    expect(leesKapellen([{ kant: 0, van: 1, tot: 1.3, diep: 2 }])).toBeNull();
    expect(leesKapellen(Array.from({ length: 5 }, () => ({ kant: 0, van: 0, tot: 1, diep: 1 })))).toBeNull();
    expect(leesKapellen([])).toEqual([]);
  });

  it('bewaart ze bij het hoofdhuis, en ze komen terug na het lezen', () => {
    const nu = gebouwKapel(d, { dakkapellen: [{ kant: 1, van: 2, tot: 5, diep: 2 }] })!;
    expect(nu.gebouwen![0]!.dakkapellen).toEqual([{ kant: 1, van: 2, tot: 5, diep: 2 }]);
    const terug = leesDaken(JSON.parse(JSON.stringify(nu)));
    expect('daken' in terug && terug.daken?.gebouwen?.[0]?.dakkapellen).toEqual([{ kant: 1, van: 2, tot: 5, diep: 2 }]);
    expect(gebouwKapel(d, { kaartKapel: 'nee' })!.gebouwen![0]!.kaartKapel).toBe('nee');
  });

  it('tekent die van de bewoner op het dak, met de voorkant net achter de goot', () => {
    expect(kapelVanBewoner({ kant: 0, van: 1, tot: 3.5, diep: 2, etage: 'e2' })).toEqual({ kant: 0, van: 1, tot: 3.5, voor: 0.3, achter: 2.3, etage: 'e2' });
    const v = bronVorm(gebouwKapel(d, { dakkapellen: [{ kant: 1, van: 2, tot: 5, diep: 2 }] })!, 180, 'vrijstaand', 2);
    const hoofd = v.blokken.find((b) => b.soort === 'hoofdhuis')!;
    expect(hoofd.dakkapellen).toEqual([{ kant: 1, van: 2, tot: 5, voor: 0.3, achter: 2.3 }]);
    expect(hoofd.kapelBron).toBe('bewoner');
    // Leeg is ook een keus van de bewoner: geen dakkapel.
    const leeg = bronVorm(gebouwKapel(d, { dakkapellen: [] })!, 180, 'vrijstaand', 2).blokken.find((b) => b.soort === 'hoofdhuis')!;
    expect(leeg.dakkapellen).toBeUndefined();
  });
});

describe('wat voor huis volgens de kaart (20 november 2026)', () => {
  const huis = [{ soort: 'hoofdhuis', u: 0, v: 0, b: 5.6, d: 9.9 }];
  const vak = (u: number, v: number, b: number, d: number) => ({ punten: [[u, v], [u + b, v], [u + b, v + d], [u, v + d]] as [number, number][] });

  it('ziet een twee-onder-een-kap, een hoekhuis, een tussenwoning en een vrijstaand huis', () => {
    expect(woningUitKaart(huis, [vak(5.6, 0, 5.6, 9.9)])).toEqual({ soort: 'tweekap', buren: ['rechts'] });
    expect(woningUitKaart(huis, [vak(5.6, 0, 5.6, 9.9), vak(11.2, 0, 5.6, 9.9)])).toEqual({ soort: 'hoek', buren: ['rechts'] });
    expect(woningUitKaart(huis, [vak(-5.6, 0, 5.6, 9.9), vak(5.6, 0, 5.6, 9.9)])).toEqual({ soort: 'rij', buren: ['links', 'rechts'] });
    expect(woningUitKaart(huis, [vak(9, 0, 6, 9)])).toEqual({ soort: 'vrijstaand', buren: [] });
  });

  it('telt een buurhuis dat alleen de achterhoek raakt niet als buur achter, en een schuurtje of geen kaart nergens', () => {
    // Het buurhuis rechts is dieper: zijn hoek ligt bij de achtermuur, maar zijn muur loopt er niet langs.
    expect(woningUitKaart(huis, [vak(5.6, -1, 6, 13)])).toEqual({ soort: 'tweekap', buren: ['rechts'] });
    // Een schuurtje van 6 m² is geen woning.
    expect(woningUitKaart(huis, [vak(5.6, 2, 2, 3)])).toEqual({ soort: 'vrijstaand', buren: [] });
    expect(woningUitKaart(huis, [])).toBeNull();
  });

  it('bewaart de muren tegen de buren in de indeling, en weigert een onbekende kant', () => {
    const goed = validateLayout(indeling({ woning: 'tweekap', buren: ['rechts', 'links', 'rechts'] }), known);
    expect(goed.ok && goed.layout.buren).toEqual(['links', 'rechts']);
    expect(validateLayout(indeling({ buren: ['voor'] }), known).ok).toBe(false);
  });

  it('bewaart bij een appartement de verdieping en wat erboven ligt, als hele getallen', () => {
    const goed = validateLayout(indeling({ woning: 'appartement', buren: ['links', 'rechts'], verdieping: 3, erboven: 0 }), known);
    expect(goed.ok && [goed.layout.verdieping, goed.layout.erboven]).toEqual([3, 0]);
    const zonder = validateLayout(indeling({ woning: 'appartement' }), known);
    expect(zonder.ok && 'verdieping' in zonder.layout).toBe(false);
    expect(validateLayout(indeling({ verdieping: -1 }), known).ok).toBe(false);
    expect(validateLayout(indeling({ erboven: 1.5 }), known).ok).toBe(false);
    expect(validateLayout(indeling({ erboven: '2' }), known).ok).toBe(false);
  });
});

describe('deuren en ramen met richting (20 november 2026)', () => {
  it('bewaart de nieuwe soorten met scharnier, kant en schuifrichting, en laat wat niet klopt weg', () => {
    const uit = leesOpeningen(
      {
        bg: [
          { id: 'o1', soort: 'achterdeur', as: 'v', op: 9.9, van: 1, tot: 2, scharnier: 'tot', kant: -1 },
          { id: 'o2', soort: 'schuifpui', as: 'v', op: 9.9, van: 2.2, tot: 5.4, schuift: 'van' },
          { id: 'o3', soort: 'dubbel', as: 'u', op: 3.6, van: 4, tot: 5.6, kant: 2, scharnier: 'midden' },
        ],
      },
      () => true,
    );
    expect(uit).toEqual({
      openingen: {
        bg: [
          { id: 'o1', soort: 'achterdeur', as: 'v', op: 9.9, van: 1, tot: 2, scharnier: 'tot', kant: -1 },
          { id: 'o2', soort: 'schuifpui', as: 'v', op: 9.9, van: 2.2, tot: 5.4, schuift: 'van' },
          // Een kant van 2 of een scharnier in het midden bestaat niet: dan geldt wat de tekening kiest.
          { id: 'o3', soort: 'dubbel', as: 'u', op: 3.6, van: 4, tot: 5.6 },
        ],
      },
    });
  });
});
