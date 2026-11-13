/**
 * Je huis tekenen (besluit 308, stap 1): wat de tekentafel bewaart, en de vorm
 * waarop hij tekent. Een kamer die verdwijnt of verhuist, mag het bewaren nooit
 * blokkeren.
 */
import { describe, expect, it } from 'vitest';

import type { Daken, DakVlak, Gebouw, Xy } from '../src/web/daken.js';
import { bronVanDaken, bronVorm, dakenMetBron, gebouwErbij, gebouwWeg, scheefDak, eenPapier, etageHoogtes, lagenOnderDak, leesEtage, leesPlek, leesTekening, leesZoneLijn, tekenSoort, tekenVorm, verschuif, WONING_MAAT, zoneVanPlek } from '../src/web/huistekening.js';
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
