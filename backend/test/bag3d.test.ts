/**
 * Het huis uit 3D BAG (5 november 2026): de omrekening naar RD, de kaartvakken,
 * de dakvorm uit de dakvlakken, en het huis met de buren uit een nagemaakt
 * kaartvak in CityJSON.
 */

import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { alBinnen, bagHuisEnOmgeving, dakUitVlakken, haalBagVak, inNederland, naarRd, vakAdres, vakSleutels, type CityJson } from '../src/web/bag3d.js';

describe('3D BAG', () => {
  it('rekent naar RD: de toren van Amersfoort is het nulpunt', () => {
    expect(naarRd(52.1551744, 5.38720621).map(Math.round)).toEqual([155000, 463000]);
    // Utrecht, Domtoren: ongeveer (136 000, 456 000).
    const [x, y] = naarRd(52.0907, 5.1214);
    expect(Math.abs(x - 136_700)).toBeLessThan(500);
    expect(Math.abs(y - 455_900)).toBeLessThan(500);
    expect(inNederland(52.09, 5.12)).toBe(true);
    expect(inNederland(50.85, 4.35)).toBe(true); // Brussel ligt in het vak om Nederland; 3D BAG heeft er dan geen vak.
    expect(inNederland(48.85, 2.35)).toBe(false);
  });

  it('kent de kaartvakken van fijn naar grof, met een vast adres', () => {
    const k = vakSleutels(...naarRd(52.0907, 5.1214));
    expect(k[0]).toBe('10-492-594');
    expect(k.at(-1)).toBe('3-256-512');
    expect(vakAdres('10-492-594')).toBe('https://3dbag.fsn1.your-objectstorage.com/v20250903/tiles/10/492/594/10-492-594.city.json.gz');
  });

  it('maakt van dakvlakken een dakvorm met de nok', () => {
    expect(dakUitVlakken([{ azimuthDeg: 93, tiltDeg: 44, m2: 40 }, { azimuthDeg: 272, tiltDeg: 43, m2: 38 }])).toMatchObject({ dakvorm: 'zadel', nokDeg: 3, hellingDeg: 44 });
    expect(dakUitVlakken([{ azimuthDeg: 180, tiltDeg: 30, m2: 40 }, { azimuthDeg: 0, tiltDeg: 30, m2: 40 }, { azimuthDeg: 90, tiltDeg: 30, m2: 20 }, { azimuthDeg: 270, tiltDeg: 30, m2: 20 }]).dakvorm).toBe('schild');
    expect(dakUitVlakken([{ azimuthDeg: 200, tiltDeg: 15, m2: 30 }])).toMatchObject({ dakvorm: 'lessenaar', nokDeg: 200 });
    expect(dakUitVlakken([{ azimuthDeg: 0, tiltDeg: 1, m2: 60 }, { azimuthDeg: 180, tiltDeg: 30, m2: 5 }]).dakvorm).toBe('plat');
  });

  // Een nagemaakt vak: het huis met een zadeldak rond (1000, 2000), en een buur 12 meter oostelijk.
  const vak = (): CityJson => {
    const v: number[][] = [];
    const punt = (x: number, y: number, z: number) => v.push([x * 1000, y * 1000, z * 1000]) - 1;
    const huis = (ox: number, id: string) => {
      const g = [punt(ox - 4, 1995, 0), punt(ox + 4, 1995, 0), punt(ox + 4, 2005, 0), punt(ox - 4, 2005, 0)];
      // Twee dakvlakken: naar het oosten en naar het westen, nok noord-zuid.
      const oost = [punt(ox, 1995, 9), punt(ox + 4, 1995, 5), punt(ox + 4, 2005, 5), punt(ox, 2005, 9)];
      const west = [punt(ox - 4, 1995, 5), punt(ox, 1995, 9), punt(ox, 2005, 9), punt(ox - 4, 2005, 5)];
      return {
        [id]: { type: 'Building', attributes: {}, children: [`${id}-0`], geometry: [{ type: 'MultiSurface', lod: '0', boundaries: [[g]] }] },
        [`${id}-0`]: {
          type: 'BuildingPart',
          geometry: [{ type: 'Solid', lod: '2.2', boundaries: [[[g], [oost], [west]]], semantics: { surfaces: [{ type: 'GroundSurface' }, { type: 'RoofSurface', b3_azimut: 90, b3_hellingshoek: 45 }, { type: 'RoofSurface', b3_azimut: 270, b3_hellingshoek: 45 }], values: [[0, 1, 2]] } }],
        },
      };
    };
    return { transform: { scale: [0.001, 0.001, 0.001], translate: [0, 0, 0] }, vertices: v, CityObjects: { ...huis(1000, 'NL.IMBAG.Pand.1'), ...huis(1012, 'NL.IMBAG.Pand.2') } };
  };

  it('vindt het huis waar de plek in ligt, met zijn dak, en de buur ernaast', () => {
    const r = bagHuisEnOmgeving(vak(), 1001, 2001)!;
    expect(r.huis.omtrek).toEqual([[-5, -6], [3, -6], [3, 4], [-5, 4]]);
    expect(r.huis.dak).toMatchObject({ dakvorm: 'zadel', nokDeg: 0, hellingDeg: 45 });
    expect(r.huis.dak.vlakken.map((x) => x.m2)).toEqual([56.6, 56.6]);
    expect(r.omgeving).toHaveLength(1);
    expect(r.omgeving[0]!.omtrek[0]).toEqual([7, -6]);
    // Een gebouw uit OpenStreetMap op dezelfde plek telt niet dubbel; een tuinhuis verderop wel.
    expect(alBinnen([[-4, -5], [2, -5], [2, 3], [-4, 3]], [r.huis.omtrek])).toBe(true);
    expect(alBinnen([[-4, 20], [-1, 20], [-1, 23], [-4, 23]], [r.huis.omtrek])).toBe(false);
  });

  it('haalt het fijnste vak dat er is, en pakt het uit', async () => {
    const gevraagd: string[] = [];
    const doe = (async (url: string) => {
      gevraagd.push(url.split('/').pop()!);
      // Het fijnste vak bestaat hier niet; het tweede wel.
      if (gevraagd.length === 1) return new Response('', { status: 404 });
      return new Response(gzipSync(Buffer.from(JSON.stringify(vak()))), { status: 200 });
    }) as unknown as typeof fetch;
    const cj = await haalBagVak(52.0907, 5.1214, doe);
    expect(gevraagd).toEqual(['10-492-594.city.json.gz', '9-492-592.city.json.gz']);
    expect(Object.keys(cj!.CityObjects)).toHaveLength(4);
  });
});
