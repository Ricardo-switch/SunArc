/**
 * De plattegrond in de kit (besluit 288, stap 5): dezelfde vakken als de dienst
 * rekent, een ruimte erin, de indelingen, en de assen van een gebouw.
 */

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { kaderVan, leesVak, ruimtesIn, vakkenIn, type Vak } from '../src/web/huisvorm.js';

type Kit = {
  vakkenIn: (v: unknown, r: object) => { vakken: { r: { u: number; v: number; breed: number; diep: number }; blad: { kamer?: string }; pad: string }[]; lijnen: unknown[] };
  ruimteErin: (v: unknown, r: object, wand: string, b: number, d: number, nieuw?: object) => Vak;
  ruimtePad: (wand: string) => string;
  knoop: (boom: unknown, pad: string) => unknown;
  vervang: (boom: unknown, pad: string, nieuw: unknown) => unknown;
  indelingen: (kamers: { id: string; soort: string }[], gebouwen: { id: string; soort: string; breed: number; diep: number }[]) => { naam: string; bomen: Record<string, Vak> }[];
  kaderUitMaat: (maat: object, voorgevel: number) => { O: number[]; U: number[]; V: number[]; breed: number; diep: number };
  plattegrond: (model: object, opts?: object) => string;
};

function laadKit(): Kit {
  const bron = readFileSync(new URL('../../frontend/kit/huisvorm.js', import.meta.url), 'utf-8');
  const ruimte: Record<string, unknown> = {};
  runInNewContext(bron, { window: ruimte });
  return ruimte['huisvorm'] as Kit;
}
const kit = laadKit();
const huis = { u: 0, v: 0, breed: 10, diep: 8.4 };

describe('de plattegrond in de kit', () => {
  it('rekent dezelfde vakken als de dienst', () => {
    const boom: Vak = { as: 'u', op: 3, a: { as: 'v', op: 5.4, a: { kamer: 'hal' }, b: { naam: 'Toilet' } }, b: { kamer: 'woonkamer' } };
    const app = kit.vakkenIn(boom, huis).vakken.map((v) => [v.pad, v.r]);
    const dienst = vakkenIn(boom, huis).map((v) => [v.pad, v.r]);
    expect(app).toEqual(dienst);
  });

  it('zet een ruimte erin, en wat over is blijft de kamer eromheen (een U)', () => {
    const boom = kit.ruimteErin({ kamer: 'woonkamer' }, huis, 'rechts', 2.4, 2.6, {});
    expect(leesVak(boom, () => true)).toEqual(boom);
    expect(kit.knoop(boom, kit.ruimtePad('rechts'))).toEqual({});
    const woon = ruimtesIn(vakkenIn(boom, huis)).find((r) => r.kamer === 'woonkamer')!;
    expect(woon.vakken).toHaveLength(3);
    expect(woon.m2).toBeCloseTo(84 - 2.6 * 2.4, 1);
    for (const wand of ['voor', 'achter', 'links']) {
      const b = kit.ruimteErin({ kamer: 'woonkamer' }, huis, wand, 2.4, 2.6, { naam: 'Hal' });
      expect(kit.knoop(b, kit.ruimtePad(wand))).toEqual({ naam: 'Hal' });
    }
  });

  it('geeft indelingen die de dienst aanneemt, met elke kamer erin', () => {
    const kamers = [{ id: 'woonkamer', soort: 'woonkamer' }, { id: 'keuken', soort: 'keuken' }, { id: 'hal', soort: 'hal' }, { id: 'toilet', soort: 'toilet' }];
    const lijst = kit.indelingen(kamers, [{ id: 'huis', soort: 'hoofdhuis', breed: 10, diep: 8.4 }, { id: 'uitbouw', soort: 'uitbouw', breed: 5.8, diep: 3.2 }]);
    expect(lijst.map((x) => x.naam)).toEqual(['naast', 'rijen', 'halOpzij', 'gang']);
    for (const x of lijst) {
      const geplaatst = new Set<string>();
      for (const [id, boom] of Object.entries(x.bomen)) {
        expect(leesVak(boom, () => true)).toEqual(boom);
        const r = id === 'huis' ? huis : { u: 0, v: 0, breed: 5.8, diep: 3.2 };
        for (const v of vakkenIn(boom, r)) if ('kamer' in v.blad && v.blad.kamer) geplaatst.add(v.blad.kamer);
      }
      expect([...geplaatst].sort()).toEqual(['hal', 'keuken', 'toilet', 'woonkamer']);
      // De keuken in de uitbouw.
      expect(x.bomen['uitbouw']).toEqual({ kamer: 'keuken' });
    }
  });

  it('legt de assen van een gebouw net als de dienst', () => {
    const omtrek = [[0, 0], [10, 0], [10, 8], [0, 8]] as [number, number][];
    for (const voorgevel of [180, 90, 0, 270]) {
      const dienst = kaderVan({ omtrek, bron: 'kaart' }, voorgevel);
      const app = kit.kaderUitMaat({ midden: [5, 4], asDeg: 90, lengte: 10, breedte: 8 }, voorgevel);
      expect([app.breed, app.diep]).toEqual([dienst.breed, dienst.diep]);
      expect(app.O.map((n) => Math.round(n * 100) / 100 + 0)).toEqual([...dienst.oorsprong]);
    }
  });

  it('tekent één naam per ruimte, zonder muur tussen delen van dezelfde kamer', () => {
    const boom = kit.ruimteErin({ kamer: 'woonkamer' }, huis, 'rechts', 2.4, 2.6, { naam: 'Trap' });
    const svg = kit.plattegrond({ gebouwen: [{ id: 'huis', breed: 10, diep: 8.4, m: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, boom, actief: true }], kamers: { woonkamer: { naam: 'Woonkamer', soort: 'woonkamer' } }, tekst: { leeg: 'Nog leeg' } });
    expect(svg.match(/>Woonkamer</g)).toHaveLength(1);
    expect(svg.match(/data-vak="huis:/g)).toHaveLength(4);
    // Muren alleen om de trap: drie stukken.
    expect(svg.match(/<line x1="[^"]+" y1="[^"]+" x2="[^"]+" y2="[^"]+" stroke="#c9d3dc"/g)).toHaveLength(3);
  });
});
