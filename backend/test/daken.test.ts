/**
 * Daken en panelen (besluit 254, stap 1): elk vlak apart, lezen wat de pagina
 * stuurt, de vlakken uit wat er al was, en wat de berekening ervan krijgt.
 */

import { describe, expect, it } from 'vitest';

import type { Geometry } from '../src/core/model.js';
import { connectionView, validateConnection, type FoundPower } from '../src/web/aansluiting.js';
import { dakenUitOud, hoofddakPlat, leesDaken, piekVan, zonnevlakken, type DakVlak, type Daken } from '../src/web/daken.js';
import { dakenNu, kiesLigging, type LiggingInput, type Meting } from '../src/web/ligging.js';
import { exampleSite } from './site.js';

const vlak = (x: Partial<DakVlak> = {}): DakVlak => ({
  letter: 'A',
  plek: 'hoofddak',
  opstelling: 'schuin',
  azimuthDeg: 180,
  tiltDeg: 40,
  aantal: 14,
  wpPerPaneel: 410,
  meter: null,
  bron: 'bewoner',
  ...x,
});

// Idee #121: 48 panelen op een plat dak, de helft oost en de helft west op 10°.
const wendy: Daken = {
  vlakken: [vlak({ letter: 'A', plek: 'uitbouw', opstelling: 'oostwest', azimuthDeg: 90, tiltDeg: 10, aantal: 24, aantal2: 24, wpPerPaneel: 430 })],
  voorgevelDeg: 180,
  omvormerW: null,
};

const basis: LiggingInput = { configuratie: undefined, dak: null, meting: null, panelen: null, voorkantZon: null, omvormerGevonden: null };

describe('een vlak', () => {
  it('telt bij oost-west beide kanten', () => {
    expect(piekVan(wendy.vlakken[0]!)).toBe(48 * 430);
  });

  it('wordt bij oost-west twee vlakken voor de berekening, tegenover elkaar', () => {
    const p = zonnevlakken(wendy);
    expect(p).toEqual([
      { id: 'vlak-a', azimuthDeg: 90, tiltDeg: 10, peakW: 24 * 430, source: 'bewoner' },
      { id: 'vlak-a-2', azimuthDeg: 270, tiltDeg: 10, peakW: 24 * 430, source: 'bewoner' },
    ]);
  });

  it('laat een kant zonder panelen weg', () => {
    const d: Daken = { ...wendy, vlakken: [{ ...wendy.vlakken[0]!, aantal2: 0 }] };
    expect(zonnevlakken(d).map((p) => p.id)).toEqual(['vlak-a']);
  });
});

describe('een plat dak op het hoofdhuis (issue 131)', () => {
  it('volgt de dakvorm van het hoofdhuis, anders de vlakken, anders het oude antwoord', () => {
    const huis = (dakvorm: 'plat' | 'zadel') => ({ id: 'huis', soort: 'hoofdhuis' as const, bron: 'schatting' as const, omtrek: [[0, 0], [10, 0], [10, 9], [0, 9]] as [number, number][], dakvorm, nokDeg: 0 });
    expect(hoofddakPlat({ vlakken: [], voorgevelDeg: 180, omvormerW: null, gebouwen: [huis('plat')] }, null)).toBe(true);
    expect(hoofddakPlat({ vlakken: [], voorgevelDeg: 180, omvormerW: null, gebouwen: [huis('zadel')] }, 'plat')).toBe(false);
    expect(hoofddakPlat({ vlakken: [vlak({ opstelling: 'oostwest', aantal2: 4 })], voorgevelDeg: 180, omvormerW: null }, null)).toBe(true);
    expect(hoofddakPlat({ vlakken: [vlak()], voorgevelDeg: 180, omvormerW: null }, 'plat')).toBe(false);
    expect(hoofddakPlat(null, 'plat')).toBe(true);
    expect(hoofddakPlat(null, 'voorkant')).toBe(false);
  });

  it('volgt de vlakken als de dakvorm een voorstel was, en het antwoord bij Inrichten (issue 143)', () => {
    const huis = (dakvorm: 'plat' | 'zadel', dakBron?: 'bewoner' | 'kaart') => ({ id: 'huis', soort: 'hoofdhuis' as const, bron: 'schatting' as const, omtrek: [[0, 0], [10, 0], [10, 9], [0, 9]] as [number, number][], dakvorm, nokDeg: 0, ...(dakBron ? { dakBron } : {}) });
    // Eerst een schuin vlak bewaard (voorstel zadel), daarna op rekken: plat.
    const rek = [vlak({ opstelling: 'rek', tiltDeg: 15 })];
    expect(hoofddakPlat({ vlakken: rek, voorgevelDeg: 180, omvormerW: null, gebouwen: [huis('zadel')] }, null)).toBe(true);
    // Wat de bewoner of 3D BAG gaf, blijft.
    expect(hoofddakPlat({ vlakken: rek, voorgevelDeg: 180, omvormerW: null, gebouwen: [huis('zadel', 'bewoner')] }, null)).toBe(false);
    expect(hoofddakPlat({ vlakken: [vlak()], voorgevelDeg: 180, omvormerW: null, gebouwen: [huis('plat', 'kaart')] }, null)).toBe(true);
    // Een puntdak uit 3D BAG, maar alle panelen op het hoofddak op rekken: plat (issue 150).
    expect(hoofddakPlat({ vlakken: rek, voorgevelDeg: 180, omvormerW: null, gebouwen: [huis('zadel', 'kaart')] }, null)).toBe(true);
    expect(hoofddakPlat({ vlakken: [vlak()], voorgevelDeg: 180, omvormerW: null, gebouwen: [huis('zadel', 'kaart')] }, null)).toBe(false);
    // Zonder vlakken op het hoofddak: plat dak bij Inrichten.
    expect(hoofddakPlat({ vlakken: [], voorgevelDeg: 180, omvormerW: null, gebouwen: [huis('zadel')] }, null, true)).toBe(true);
    expect(hoofddakPlat(null, 'voorkant', true)).toBe(true);
  });

  it('leest een blok dat de bewoner zelf neerzette (stap 2b)', () => {
    const g = { id: 'tuinhuis', soort: 'tuinhuis', bron: 'bewoner', omtrek: [[0, 0], [3, 0], [3, 3], [0, 3]], dakvorm: 'zadel', nokDeg: 0 };
    const r = leesDaken({ vlakken: [vlak()], voorgevelDeg: 180, omvormerW: null, gebouwen: [g] });
    expect('daken' in r && r.daken?.gebouwen?.[0]?.bron).toBe('bewoner');
    expect(leesDaken({ vlakken: [vlak()], voorgevelDeg: 180, omvormerW: null, gebouwen: [{ ...g, bron: 'buurman' }] })).toHaveProperty('fout');
  });

  it('leest wie de dakvorm gaf, en laat iets anders weg', () => {
    const g = { id: 'huis', soort: 'hoofdhuis', bron: 'kaart', omtrek: [[0, 0], [10, 0], [10, 9]], dakvorm: 'plat', nokDeg: 0 };
    const r = leesDaken({ vlakken: [vlak()], voorgevelDeg: 180, omvormerW: null, gebouwen: [{ ...g, dakBron: 'bewoner' }] });
    expect('daken' in r && r.daken?.gebouwen?.[0]?.dakBron).toBe('bewoner');
    const x = leesDaken({ vlakken: [vlak()], voorgevelDeg: 180, omvormerW: null, gebouwen: [{ ...g, dakBron: 'buurman' }] });
    expect('daken' in x && x.daken?.gebouwen?.[0]).not.toHaveProperty('dakBron');
  });
});

describe('lezen', () => {
  it('leest wat de kaarten zeiden, alleen met bekende woorden en een dag (6 november 2026)', () => {
    const r = leesDaken({ vlakken: [vlak()], voorgevelDeg: 180, omvormerW: null, kaartStand: { osm: 'wijk', bag3d: 'buiten', datum: '2026-11-06' } });
    expect('daken' in r && r.daken?.kaartStand).toEqual({ osm: 'wijk', bag3d: 'buiten', datum: '2026-11-06' });
    expect(leesDaken({ vlakken: [vlak()], voorgevelDeg: 180, omvormerW: null, kaartStand: { osm: 'ja', bag3d: 'huis', datum: '2026-11-06' } })).toHaveProperty('fout');
    expect(leesDaken({ vlakken: [vlak()], voorgevelDeg: 180, omvormerW: null, kaartStand: { osm: 'huis', bag3d: 'huis', datum: 'gisteren' } })).toHaveProperty('fout');
  });

  it('neemt een goed vlak over en vult de bron aan', () => {
    const { bron: _weg, ...zonder } = vlak();
    const r = leesDaken({ vlakken: [zonder], voorgevelDeg: 180, omvormerW: null });
    expect('daken' in r && r.daken?.vlakken[0]?.bron).toBe('bewoner');
  });

  it('neemt een eigen naam over, zonder spaties eromheen, en hooguit 30 tekens (5 november 2026)', () => {
    const r = leesDaken({ vlakken: [{ ...vlak(), naam: '  Garage   achter ' }], voorgevelDeg: 180, omvormerW: null });
    expect('daken' in r && r.daken?.vlakken[0]?.naam).toBe('Garage achter');
    const leeg = leesDaken({ vlakken: [{ ...vlak(), naam: ' ' }], voorgevelDeg: 180, omvormerW: null });
    expect('daken' in leeg && leeg.daken?.vlakken[0]).not.toHaveProperty('naam');
    expect(leesDaken({ vlakken: [{ ...vlak(), naam: 'x'.repeat(31) }], voorgevelDeg: 180, omvormerW: null })).toHaveProperty('fout');
  });

  it('zonder vlakken is niet bewaard', () => {
    expect(leesDaken({ vlakken: [] })).toEqual({ daken: null });
    expect(leesDaken(null)).toEqual({ daken: null });
  });

  it('weigert dubbele letters, een onbekende plek en een rare meter', () => {
    expect(leesDaken({ vlakken: [vlak(), vlak()] })).toHaveProperty('fout');
    expect(leesDaken({ vlakken: [{ ...vlak(), plek: 'kelder' }] })).toHaveProperty('fout');
    expect(leesDaken({ vlakken: [vlak({ meter: 'switch.omvormer' })] })).toHaveProperty('fout');
    expect(leesDaken({ vlakken: [vlak({ aantal: 0 })] })).toHaveProperty('fout');
  });

  it('staat oost-west met één lege kant toe, maar niet helemaal leeg', () => {
    expect(leesDaken({ vlakken: [{ ...wendy.vlakken[0]!, aantal: 0, aantal2: 6 }] })).toHaveProperty('daken');
    expect(leesDaken({ vlakken: [{ ...wendy.vlakken[0]!, aantal: 0, aantal2: 0 }] })).toHaveProperty('fout');
  });

  it('blijft bij de antwoorden als de pagina hem niet meestuurt', () => {
    const found = { fasen: [], apparaten: [] };
    const eerst = validateConnection({ panelen: { ligging: 'plat', aantal: 48 }, daken: wendy }, found);
    expect(eerst.ok).toBe(true);
    const daarna = validateConnection({ panelen: { ligging: 'plat', aantal: 48 } }, found, eerst.ok ? eerst.answers : null);
    expect(daarna.ok && daarna.answers.daken).toEqual(wendy);
    const weg = validateConnection({ panelen: { ligging: 'plat', aantal: 48 }, daken: null }, found, eerst.ok ? eerst.answers : null);
    expect(weg.ok && weg.answers.daken).toBeUndefined();
  });
});

describe('uit wat er al was', () => {
  const zuid: Geometry = {
    facades: [{ id: 'voorgevel', name: 'Voorgevel', azimuthDeg: 180, zoneIds: [], source: 'gemeten' }],
    solarPlanes: [{ id: 'dak-zuid', azimuthDeg: 180, tiltDeg: 40, peakW: 5600, source: 'gemeten' }],
  };

  it('geeft het hoofddak een vlak met het aantal van de bewoner', () => {
    const d = dakenUitOud({ geometry: zuid, aantal: 14, plat: false, elders: null, gemetenTotaal: false });
    expect(d.vlakken).toHaveLength(1);
    expect(d.vlakken[0]).toMatchObject({ letter: 'A', plek: 'hoofddak', opstelling: 'schuin', azimuthDeg: 180, aantal: 14, wpPerPaneel: 400, bron: 'gemeten' });
    expect(d.voorgevelDeg).toBe(180);
  });

  it('maakt van twee platte vlakken tegenover elkaar één vlak oost-west', () => {
    const ow: Geometry = {
      facades: [],
      solarPlanes: [
        { id: 'dak-oost', azimuthDeg: 92, tiltDeg: 10, peakW: 10_000, source: 'gemeten' },
        { id: 'dak-west', azimuthDeg: 271, tiltDeg: 10, peakW: 10_000, source: 'gemeten' },
      ],
    };
    const d = dakenUitOud({ geometry: ow, aantal: 48, plat: true, elders: null, gemetenTotaal: false });
    expect(d.vlakken).toHaveLength(1);
    expect(d.vlakken[0]).toMatchObject({ opstelling: 'oostwest', azimuthDeg: 92, aantal: 24, aantal2: 24 });
    expect(piekVan(d.vlakken[0]!)).toBeCloseTo(20_000);
  });

  it('geeft de garage een eigen vlak, en haalt zijn deel van een meting van alles af', () => {
    const d = dakenUitOud({ geometry: zuid, aantal: 14, plat: false, elders: { garage: 6 }, gemetenTotaal: true });
    expect(d.vlakken.map((v) => [v.letter, v.plek, v.aantal])).toEqual([['A', 'hoofddak', 14], ['B', 'garage', 6]]);
    // De meting zag 5600 Wp voor alle 20 panelen: 280 Wp per paneel.
    expect(piekVan(d.vlakken[0]!) + piekVan(d.vlakken[1]!)).toBeCloseTo(5600);
    expect(d.vlakken[1]).toMatchObject({ opstelling: 'rek', azimuthDeg: 180, bron: 'schatting' });
  });
});

describe('wat de berekening krijgt', () => {
  const meting: Meting = { vlakken: [{ azimuthDeg: 180, tiltDeg: 38, peakW: 5600, kant: null }], peakW: 5600, fout: 0.1, dag: { datum: '2026-06-01', kWh: 30, punten: [] } };
  const panelen = { ligging: 'voorkant' as const, aantal: 14, voorkant: null, achterkant: null };

  it('blijft zonder andere daken precies zoals het was', () => {
    const zonder = kiesLigging({ ...basis, meting, panelen });
    expect(kiesLigging({ ...basis, meting, panelen, elders: {} })).toEqual(zonder);
  });

  it('telt de garage mee zonder dubbel te tellen', () => {
    const g = kiesLigging({ ...basis, meting, panelen, elders: { garage: 6 } })!;
    expect(g.geometry.solarPlanes).toHaveLength(2);
    expect(g.geometry.solarPlanes.reduce((s, p) => s + p.peakW, 0)).toBeCloseTo(5600, -1);
  });

  it('rekent met de bewaarde daken, ook boven een bevestigd dak', () => {
    const g = kiesLigging({ ...basis, meting, panelen, daken: wendy })!;
    expect(g.bron).toBe('app');
    expect(g.geometry.solarPlanes.map((p) => p.azimuthDeg)).toEqual([90, 270]);
    expect(g.geometry.facades.find((f) => f.id === 'voorgevel')?.azimuthDeg).toBe(180);
  });

  it('laat de pagina zien waar de berekening mee rekent', () => {
    const i = { ...basis, meting, panelen, elders: { garage: 6 } };
    const nu = dakenNu(i);
    expect(nu.bewaard).toBe(false);
    expect(zonnevlakken(nu.daken)).toEqual(kiesLigging(i)!.geometry.solarPlanes);
    expect(dakenNu({ ...i, daken: wendy })).toEqual({ daken: wendy, bewaard: true });
  });
});

describe('de meters op de pagina', () => {
  const vermogens: FoundPower[] = [
    { id: 'sensor.solaredge_i1_ac_power', naam: 'Solaredge I1 AC Power', w: 1200, rol: 'zon' },
    { id: 'sensor.solaredge_i1_dc_power', naam: 'Solaredge I1 DC Power', w: 1250, rol: 'zon' },
    { id: 'sensor.power_production_next_hour', naam: 'Solar production forecast Estimated power production - in 1 hour', w: 900, rol: 'zon' },
    { id: 'sensor.pv_overschot', naam: 'PV overschot (W)', w: 300, rol: 'zon' },
    { id: 'sensor.solaredge_opslagvermogen', naam: 'solaredge Opslagvermogen', w: 0, rol: 'zon' },
  ];
  const found = { fasen: [], apparaten: [], vermogens };
  const view = (body: Record<string, unknown>) => {
    const checked = validateConnection(body, found);
    if (!checked.ok) throw new Error(checked.reden);
    return connectionView({ base: exampleSite, found, applied: { toegevoegd: [], overgeslagen: [] }, answersAtStart: null, answers: checked.answers, solar: null }).daken;
  };

  it('kiest alleen uit de omvormers die bij Omvormers en meters gekozen zijn', () => {
    const d = view({ panelen: { ligging: 'voorkant', aantal: 6 }, omvormers: ['sensor.solaredge_i1_ac_power'] });
    expect(d.meters.map(({ id, naam }) => ({ id, naam }))).toEqual([{ id: 'sensor.solaredge_i1_ac_power', naam: 'Solaredge I1 AC Power' }]);
    // Ook niet een meter die een vlak eerder kreeg.
    const oud = view({ panelen: { ligging: 'voorkant', aantal: 6 }, omvormers: ['sensor.solaredge_i1_ac_power'], daken: { vlakken: [vlak({ meter: 'sensor.solaredge_i1_dc_power' })] } });
    expect(oud.meters.map((m) => m.id)).toEqual(['sensor.solaredge_i1_ac_power']);
  });

  it('geeft bij één omvormer elk vlak die omvormer, tot de bewoner bewaart', () => {
    const d = view({ panelen: { ligging: 'beide', voorkant: 6, achterkant: 6 }, omvormers: ['sensor.solaredge_i1_ac_power'] });
    expect(d.bewaard).toBe(false);
    expect(d.vlakken.length).toBeGreaterThan(0);
    expect(d.vlakken.every((v) => v.meter === 'sensor.solaredge_i1_ac_power')).toBe(true);
    const bewaard = view({ panelen: { ligging: 'voorkant', aantal: 6 }, omvormers: ['sensor.solaredge_i1_ac_power'], daken: { vlakken: [vlak()] } });
    expect(bewaard.vlakken[0]?.meter).toBeNull();
  });
});
