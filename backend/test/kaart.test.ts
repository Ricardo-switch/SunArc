/*
 * De gevels opmeten op de kaart (21 oktober 2026): uit de omtrek van het huis
 * in OpenStreetMap de richting van elke muur naar buiten, de hoofdas, en de
 * voorkant die het dichtst bij de meting ligt.
 */
import { describe, expect, it } from 'vitest';

import { binnen, gevelsUitOmtrek, huisEnOmgeving, kaartVak, kiesGebouw, labelsVan, overpassVraag, stratenBij, voorkantUitKaart, type Punt } from '../src/web/kaart.js';

const LAT = 51.5;
const LON = 5.0;
/** Een rechthoek van `breed` bij `diep` meter, met de voorkant naar `voorDeg`, vanuit het midden. */
function huis(voorDeg: number, breed = 6, diep = 10, lat = LAT, lon = LON): Punt[] {
  const r = (voorDeg * Math.PI) / 180;
  // Naar voren (de voorkant) en opzij, in meters oost en noord.
  const voor = { x: Math.sin(r), y: Math.cos(r) };
  const zij = { x: Math.cos(r), y: -Math.sin(r) };
  const hoek = (a: number, b: number) => {
    const x = voor.x * a + zij.x * b;
    const y = voor.y * a + zij.y * b;
    return { lat: lat + y / 110_540, lon: lon + x / (111_320 * Math.cos((lat * Math.PI) / 180)) };
  };
  const p = [hoek(diep / 2, -breed / 2), hoek(diep / 2, breed / 2), hoek(-diep / 2, breed / 2), hoek(-diep / 2, -breed / 2)];
  return [...p, p[0]!];
}

describe('de gevels op de kaart (21 oktober 2026)', () => {
  it('vindt de richting van elke muur naar buiten, de klok mee of ertegenin', () => {
    for (const omtrek of [huis(92), [...huis(92)].reverse()]) {
      const g = gevelsUitOmtrek(omtrek)!;
      expect(g.gevels.map((x) => x.richtingDeg).sort((a, b) => a - b)).toEqual([2, 92, 182, 272]);
      // De lange muren zijn de zijmuren: die van een rijtjeshuis.
      expect([...g.as].sort((a, b) => a - b)).toEqual([2, 182]);
    }
  });

  it('kiest de voorkant die het dichtst bij de meting ligt, ook haaks op de hoofdas', () => {
    const g = gevelsUitOmtrek(huis(92))!;
    expect(voorkantUitKaart(g, 92)).toBe(92);
    expect(voorkantUitKaart(g, 77)).toBe(92);
    expect(voorkantUitKaart(g, 260)).toBe(272);
    expect(voorkantUitKaart(gevelsUitOmtrek(huis(135, 12, 8))!, 150)).toBe(135);
  });

  it('neemt het gebouw waar het huis in ligt, en anders het dichtstbijzijnde', () => {
    const eigen = huis(92);
    const buren = huis(92, 6, 10, LAT, LON + 0.0001);
    expect(binnen({ lat: LAT, lon: LON }, eigen)).toBe(true);
    expect(binnen({ lat: LAT, lon: LON }, buren)).toBe(false);
    const antwoord = { elements: [{ geometry: buren }, { geometry: eigen }] };
    expect(kiesGebouw(antwoord, { lat: LAT, lon: LON })).toBe(eigen);
    expect(kiesGebouw(antwoord, { lat: LAT + 0.0002, lon: LON + 0.0001 })).toBe(buren);
    expect(kiesGebouw({ elements: [] }, { lat: LAT, lon: LON })).toBeNull();
    // Verder dan 40 meter is het niet ons huis.
    expect(kiesGebouw(antwoord, { lat: LAT + 0.002, lon: LON })).toBeNull();
  });

  it('vraagt OpenStreetMap om een vak van het raster, niet om de plek van het huis (besluit 254)', () => {
    const vraag = overpassVraag(LAT + 0.00123, LON + 0.00234);
    // Twee huizen in hetzelfde vak geven dezelfde vraag.
    expect(overpassVraag(LAT + 0.0031, LON + 0.0011)).toBe(vraag);
    expect(vraag).not.toContain('around');
    expect(vraag).not.toContain(String(LAT + 0.00123));
    const v = kaartVak(LAT + 0.00123, LON + 0.00234);
    expect(v.noord - v.zuid).toBeCloseTo(0.0052, 6);
    expect(LAT + 0.00123).toBeGreaterThan(v.zuid);
    expect(LAT + 0.00123).toBeLessThan(v.noord);
  });

  it('geeft het huis en de gebouwen eromheen in meters vanaf de plek', () => {
    const eigen = huis(92);
    const buren = huis(92, 6, 10, LAT, LON + 0.0001);
    const ver = huis(92, 6, 10, LAT + 0.003, LON);
    const uit = huisEnOmgeving({ elements: [{ geometry: ver }, { geometry: buren }, { geometry: eigen }] }, { lat: LAT, lon: LON })!;
    expect(uit.omgeving).toHaveLength(1);
    // Het eigen huis ligt om de plek heen.
    const xs = uit.huis.map((p) => p[0]);
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(Math.max(...xs)).toBeGreaterThan(0);
  });
});

describe('de plattegrond: labels en straten (ronde 2 versie 2)', () => {
  // Meters oost en noord van de plek naar graden.
  const pt = (x: number, y: number): Punt => ({ lat: LAT + y / 110_540, lon: LON + x / (111_320 * Math.cos((LAT * Math.PI) / 180)) });
  const eigen = huis(90);
  const straat = (naam: string, a: [number, number], b: [number, number], soort = 'residential') => ({ type: 'way', tags: { highway: soort, name: naam }, geometry: [pt(...a), pt(...b)] });

  it('vraagt ook de straten en de adressen, nog steeds alleen het vak', () => {
    const vraag = overpassVraag(LAT, LON);
    expect(vraag).toContain('"highway"');
    expect(vraag).toContain('"addr:street"');
    expect(vraag).not.toContain('around');
  });

  it('leest de lagen, de hoogte en het dak van het huis zelf', () => {
    const antwoord = { elements: [{ type: 'way', geometry: eigen, tags: { building: 'house', 'building:levels': '2', height: '7,5', 'roof:shape': 'gabled', 'roof:height': '3' } }] };
    expect(labelsVan(antwoord, { lat: LAT, lon: LON })).toEqual({ lagen: 2, nok: 7.5, goot: 4.5, dak: 'zadel' });
    // Zonder labels: niets bekend; voet telt niet.
    const kaal = { elements: [{ type: 'way', geometry: eigen, tags: { building: 'house', height: "25'" } }] };
    expect(labelsVan(kaal, { lat: LAT, lon: LON })).toEqual({ lagen: null, nok: null, goot: null, dak: null });
  });

  it('vindt de straten erbij, de straat van het adres, en telt een straat niet als gebouw', () => {
    const adres = { type: 'node', lat: LAT, lon: LON, tags: { 'addr:street': 'Lindelaan', 'addr:housenumber': '3' } };
    const antwoord = {
      elements: [
        { type: 'way', geometry: eigen, tags: { building: 'house' } },
        adres,
        // De Lindelaan 20 m oost van het huis, noord-zuid; de Beukenweg 34 m noord, oost-west; een verre weg telt niet.
        straat('Lindelaan', [20, -60], [20, 60]),
        straat('Lindelaan', [20, 60], [21, 120]),
        straat('Beukenweg', [-60, 34], [60, 34]),
        straat('Snelweg', [-60, -90], [60, -90], 'primary'),
      ],
    };
    const s = stratenBij(antwoord, { lat: LAT, lon: LON });
    expect(s).toEqual([{ richtingDeg: 90, afstand: 20, adres: true }, { richtingDeg: 0, afstand: 34, adres: false }]);
    expect(huisEnOmgeving(antwoord, { lat: LAT, lon: LON })!.omgeving).toHaveLength(0);
  });
});
