/**
 * Het huis van boven (besluit 254, stap 2a): de rechthoek om de omtrek, de
 * dakvlakken uit de dakvorm, de blokken zonder kaart en op welk dakvlak elk
 * vlak ligt.
 */

import { describe, expect, it } from 'vitest';

import { dakvormVoorstel, gebouwenNu, inBlokken, oppervlak, panelenOp, plaatsVlakken, rechthoekOm, tekening, vanBoven } from '../src/web/daken-tekening.js';
import type { DakVlak, Daken, Gebouw, Xy } from '../src/web/daken.js';

/** Een rechthoek van `l` bij `w` meter met de lange kant langs `asDeg`, om `m`. */
function rechthoek(l: number, w: number, asDeg: number, m: Xy = [0, 0]): Xy[] {
  const r = (d: number): Xy => [Math.sin((d * Math.PI) / 180), Math.cos((d * Math.PI) / 180)];
  const u = r(asDeg);
  const p = r(asDeg + 90);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) => [m[0] + (a! * l * u[0]) / 2 + (b! * w * p[0]) / 2, m[1] + (a! * l * u[1]) / 2 + (b! * w * p[1]) / 2] as Xy);
}

const vlak = (x: Partial<DakVlak> = {}): DakVlak => ({ letter: 'A', plek: 'hoofddak', opstelling: 'schuin', azimuthDeg: 180, tiltDeg: 40, aantal: 10, wpPerPaneel: 400, meter: null, bron: 'bewoner', ...x });
const gebouw = (x: Partial<Gebouw> = {}): Gebouw => ({ id: 'huis', soort: 'hoofdhuis', bron: 'kaart', omtrek: rechthoek(10, 8, 90), dakvorm: 'zadel', nokDeg: 90, ...x });

describe('de rechthoek om de omtrek', () => {
  it('vindt de lange as en de maat, ook gedraaid', () => {
    const r = rechthoekOm(rechthoek(12, 7, 30, [5, -3]));
    expect(r.asDeg).toBe(30);
    expect(r.lengte).toBeCloseTo(12, 1);
    expect(r.breedte).toBeCloseTo(7, 1);
    expect(r.midden[0]).toBeCloseTo(5, 1);
    expect(r.midden[1]).toBeCloseTo(-3, 1);
  });
});

describe('de dakvlakken uit de dakvorm', () => {
  it('geeft een zadeldak twee dakvlakken haaks op de nok', () => {
    const b = vanBoven(gebouw());
    expect(b.dakvlakken.map((d) => d.kant)).toEqual([180, 0]);
    expect(b.nok).not.toBeNull();
  });

  it('legt de nok op de as van de rechthoek die het dichtst bij de keuze ligt', () => {
    expect(vanBoven(gebouw({ nokDeg: 80 })).nokDeg).toBe(90);
    expect(vanBoven(gebouw({ nokDeg: 10 })).nokDeg).toBe(0);
    expect(vanBoven(gebouw({ nokDeg: 10 })).dakvlakken.map((d) => d.kant)).toEqual([90, 270]);
  });

  it('geeft een schilddak vier dakvlakken, een lessenaar en een plat dak één', () => {
    expect(vanBoven(gebouw({ dakvorm: 'schild' })).dakvlakken.map((d) => d.kant)).toEqual([180, 0, 90, 270]);
    expect(vanBoven(gebouw({ dakvorm: 'lessenaar', nokDeg: 170 })).dakvlakken.map((d) => d.kant)).toEqual([180]);
    expect(vanBoven(gebouw({ dakvorm: 'plat' })).dakvlakken.map((d) => d.kant)).toEqual([null]);
  });
});

describe('de gebouwen zonder kaart', () => {
  const daken = (vlakken: DakVlak[], voorgevelDeg: number | null = 180): Daken => ({ vlakken, voorgevelDeg, omvormerW: null });

  it('zet het hoofdhuis neer met de nok langs de straat', () => {
    const [huis] = gebouwenNu(daken([]));
    expect(huis).toMatchObject({ id: 'huis', soort: 'hoofdhuis', bron: 'schatting', dakvorm: 'zadel' });
    expect(vanBoven(huis!).dakvlakken.map((d) => d.kant).sort()).toEqual([0, 180]);
  });

  it('stelt de nok haaks op een schuin vlak voor, en een plat dak bij panelen op rekken', () => {
    expect(dakvormVoorstel('hoofdhuis', [vlak({ azimuthDeg: 90 })], 180)).toEqual({ dakvorm: 'zadel', nokDeg: 0 });
    expect(dakvormVoorstel('hoofdhuis', [vlak({ opstelling: 'rek' })], 180).dakvorm).toBe('plat');
    expect(dakvormVoorstel('garage', [vlak({ plek: 'garage', azimuthDeg: 200 })], 180)).toEqual({ dakvorm: 'lessenaar', nokDeg: 200 });
    expect(dakvormVoorstel('garage', [], 180).dakvorm).toBe('plat');
  });

  it('zet de garage rechts naast het huis, gezien vanaf de straat', () => {
    const g = gebouwenNu(daken([vlak(), vlak({ letter: 'B', plek: 'garage', opstelling: 'rek', tiltDeg: 15 })]));
    expect(g.map((x) => x.id)).toEqual(['huis', 'garage']);
    // Voorgevel naar het zuiden: wie vanaf de straat kijkt, heeft het oosten rechts.
    const garage = rechthoekOm(g[1]!.omtrek);
    expect(garage.midden[0]).toBeGreaterThan(5);
  });

  it('houdt wat de bewoner bewaarde', () => {
    const eigen = gebouw({ omtrek: rechthoek(9, 7, 45), bron: 'kaart' });
    expect(gebouwenNu({ ...daken([vlak()]), gebouwen: [eigen] })[0]).toBe(eigen);
  });

  it('laat een voorgestelde dakvorm de vlakken volgen, maar niet wat de bewoner koos (issue 143)', () => {
    const rek = [vlak({ opstelling: 'rek', tiltDeg: 15 })];
    expect(gebouwenNu({ ...daken(rek), gebouwen: [gebouw({ bron: 'schatting' })] })[0]?.dakvorm).toBe('plat');
    expect(gebouwenNu({ ...daken(rek), gebouwen: [gebouw({ dakBron: 'bewoner' })] })[0]?.dakvorm).toBe('zadel');
    expect(gebouwenNu({ ...daken([vlak()]), gebouwen: [gebouw({ dakvorm: 'plat' })] })[0]?.dakvorm).toBe('zadel');
  });

  it('geeft het huis zonder vlakken een plat dak als Inrichten dat zegt', () => {
    expect(gebouwenNu(daken([]), { huisPlat: true })[0]?.dakvorm).toBe('plat');
    expect(gebouwenNu(daken([]))[0]?.dakvorm).toBe('zadel');
    expect(gebouwenNu({ ...daken([]), gebouwen: [gebouw()] }, { huisPlat: true })[0]?.dakvorm).toBe('plat');
  });
});

describe('blokken van de bewoner (stap 2b)', () => {
  it('geeft elk gebouw zijn maat mee, om op maat te maken', () => {
    const tk = tekening({ vlakken: [vlak()], voorgevelDeg: 180, omvormerW: null, gebouwen: [gebouw({ omtrek: rechthoek(12, 7, 30, [2, 1]), bron: 'bewoner' })] });
    const m = tk.gebouwen[0]!.maat;
    expect(m.lengte).toBeCloseTo(12, 1);
    expect(m.breedte).toBeCloseTo(7, 1);
    expect(m.asDeg).toBe(30);
    expect(m.midden[0]).toBeCloseTo(2, 1);
  });

  it('wisselt lengte en breedte niet om als de breedte groter wordt (issue 149)', () => {
    // Het huis 6 lang langs 90° en 11 breed: zo zet de stapper het neer, met de eerste rand langs de lengte.
    const tk = tekening({ vlakken: [vlak()], voorgevelDeg: 180, omvormerW: null, gebouwen: [gebouw({ omtrek: rechthoek(6, 11, 90), bron: 'bewoner' })] });
    const m = tk.gebouwen[0]!.maat;
    expect(m.lengte).toBeCloseTo(6, 1);
    expect(m.breedte).toBeCloseTo(11, 1);
    expect(m.asDeg).toBe(90);
    // Een gebouw uit de kaart houdt de langste kant als lengte.
    const kaart = tekening({ vlakken: [vlak()], voorgevelDeg: 180, omvormerW: null, gebouwen: [gebouw({ omtrek: rechthoek(6, 11, 90), bron: 'kaart' })] }).gebouwen[0]!.maat;
    expect(kaart.lengte).toBeCloseTo(11, 1);
    expect(kaart.asDeg).toBe(0);
  });

  it('houdt een blok van de bewoner, ook zonder vlakken erop', () => {
    const tuin = gebouw({ id: 'tuinhuis', soort: 'tuinhuis', bron: 'bewoner', omtrek: rechthoek(3, 3, 0, [0, -15]), dakvorm: 'zadel' });
    const g = gebouwenNu({ vlakken: [vlak()], voorgevelDeg: 180, omvormerW: null, gebouwen: [gebouw(), tuin] });
    expect(g.find((x) => x.id === 'tuinhuis')).toMatchObject({ bron: 'bewoner', dakvorm: 'zadel' });
  });
});

describe('de vlakken op de tekening', () => {
  const huis = gebouw();

  it('legt een vlak op het dakvlak dat dezelfde kant op kijkt', () => {
    expect(plaatsVlakken([vlak({ azimuthDeg: 175 })], [huis])).toEqual({ A: { gebouw: 'huis', kant: 180, getekend: true } });
  });

  it('tekent een schuin vlak niet als geen dakvlak die kant op kijkt', () => {
    expect(plaatsVlakken([vlak({ plek: 'dwarskap', azimuthDeg: 90 })], [huis]).A?.getekend).toBe(false);
  });

  it('volgt het dakvlak dat de bewoner aanwees', () => {
    expect(plaatsVlakken([vlak({ azimuthDeg: 175, gebouw: 'huis', kant: 0 })], [huis]).A).toEqual({ gebouw: 'huis', kant: 0, getekend: true });
  });

  it('legt panelen op rekken op een plat dak, en zonder gebouw nergens', () => {
    const plat = gebouw({ id: 'garage', soort: 'garage', dakvorm: 'plat' });
    expect(plaatsVlakken([vlak({ plek: 'garage', opstelling: 'rek' })], [huis, plat]).A).toEqual({ gebouw: 'garage', kant: null, getekend: true });
    expect(plaatsVlakken([vlak({ plek: 'gevel', azimuthDeg: 180 })], [huis]).A).toEqual({ gebouw: null, kant: null, getekend: false });
  });

  it('laat de omgeving weg die al een gebouw is', () => {
    const t = tekening({ vlakken: [vlak()], voorgevelDeg: 180, omvormerW: null, gebouwen: [huis], omgeving: [rechthoek(4, 4, 0), rechthoek(4, 4, 0, [12, 0])] });
    expect(t.omgeving).toHaveLength(1);
    expect(t.gebouwen[0]!.dakvlakken).toHaveLength(2);
  });
});

describe('een omtrek in blokken en de panelen zelf (5 november 2026)', () => {
  // Een huis van 10 bij 8 met een garage van 4 bij 6 ertegenaan: in de kaart één gebouw.
  const metGarage: Xy[] = [[-5, -4], [5, -4], [5, -1], [9, -1], [9, 5], [5, 5], [5, 4], [-5, 4]];

  it('laat een rechthoek heel', () => {
    expect(inBlokken(rechthoek(10, 8, 30))).toBeNull();
  });

  it('maakt van huis met garage twee blokken, het grootste eerst', () => {
    const b = inBlokken(metGarage)!;
    expect(oppervlak(b.hoofd)).toBeCloseTo(80, 0);
    expect(b.rest).toHaveLength(1);
    expect(oppervlak(b.rest[0]!)).toBeCloseTo(24, 0);
  });

  it('tekent het huis als blok en zet de garage grijs ernaast, om aan te tikken', () => {
    const t = tekening({ vlakken: [vlak()], voorgevelDeg: 180, omvormerW: null, gebouwen: [gebouw({ omtrek: metGarage })] });
    expect(oppervlak(t.gebouwen[0]!.omtrek)).toBeCloseTo(80, 0);
    expect(t.omgeving).toHaveLength(1);
  });

  it('tekent zoveel panelen als er zijn, binnen het dakvlak', () => {
    const dv = vanBoven(gebouw()).dakvlakken.find((x) => x.kant === 180)!;
    const p = panelenOp(dv, [vlak({ aantal: 6 }), vlak({ letter: 'B', aantal: 3 })]);
    expect(p.A).toHaveLength(6);
    expect(p.B).toHaveLength(3);
    // Alle hoeken op het dakvlak aan de zuidkant (y onder de nok).
    expect(p.A!.flat().every((q) => q[1] <= 0.01 && q[1] >= -4.01)).toBe(true);
  });

  it('houdt van de omgeving alleen wat dichtbij staat, hooguit acht', () => {
    const ver = Array.from({ length: 12 }, (_, i) => rechthoek(4, 4, 0, [9 + i * 0.1, 0]));
    const t = tekening({ vlakken: [vlak()], voorgevelDeg: 180, omvormerW: null, gebouwen: [gebouw()], omgeving: [...ver, rechthoek(4, 4, 0, [60, 0])] });
    expect(t.omgeving).toHaveLength(8);
  });
});
