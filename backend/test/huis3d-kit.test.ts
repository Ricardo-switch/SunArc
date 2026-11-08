/**
 * Het huis in 3D op echte maat (plan na besluit 288): de rekenkern in de kit,
 * met het dak, waar een zolder nog ruimte heeft, en wat de tekening opbouwt.
 */

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

type Gebouw = { id: string; soort: string; breed: number; diep: number; m: object; dakvorm: string; nokAs?: string; goot: number; nok?: number | undefined; gootAchter?: number | undefined; nokOp?: number | undefined };
type Kit = {
  dakHoogte: (g: Gebouw, u: number, v: number) => number;
  bruikbaar: (g: Gebouw, z: number) => { u0: number; u1: number; v0: number; v1: number };
  dakVlakken: (g: Gebouw) => { kant: string; punten: number[][] }[];
  bouw: (model: object) => { gebouwen: unknown[]; vloeren: { etage: string; kamer: string | null }[]; muren: unknown[]; namen: { kamer: string | null; m2: number }[] };
  teken: (model: object, opts?: object) => string;
};

function laad(): Kit {
  const ruimte: Record<string, unknown> = {};
  for (const f of ['huisvorm.js', 'huis3d.js']) runInNewContext(readFileSync(new URL(`../../frontend/kit/${f}`, import.meta.url), 'utf-8'), ruimte);
  return ruimte['huis3d'] as Kit;
}
const kit = laad();
const ID = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
// Een huis zoals dat van Ricardo: de nok op 3,75 m van de voorgevel, achter een lagere goot.
const huis: Gebouw = { id: 'huis', soort: 'hoofdhuis', breed: 5.6, diep: 9.84, m: ID, dakvorm: 'zadel', nokAs: 'u', goot: 5.6, gootAchter: 3.9, nok: 9.2, nokOp: 3.75 };

describe('het huis in 3D', () => {
  it('rekent het dak: de goot voor, de nok, en de goot achter', () => {
    expect(kit.dakHoogte(huis, 2, 0)).toBeCloseTo(5.6);
    expect(kit.dakHoogte(huis, 2, 3.75)).toBeCloseTo(9.2);
    expect(kit.dakHoogte(huis, 2, 9.84)).toBeCloseTo(3.9);
    expect(kit.dakHoogte({ ...huis, dakvorm: 'plat', goot: 2.7 }, 1, 1)).toBe(2.7);
    // Een schilddak loopt ook aan de korte kanten schuin op.
    const schild = { ...huis, dakvorm: 'schild', gootAchter: undefined, nokOp: undefined, breed: 10, diep: 8, goot: 6, nok: 10 };
    expect(kit.dakHoogte(schild, 0, 4)).toBeCloseTo(6);
    expect(kit.dakHoogte(schild, 5, 4)).toBeCloseTo(10);
    expect(kit.dakVlakken(schild)).toHaveLength(4);
  });

  it('weet waar een zolder nog ruimte heeft onder het schuine dak', () => {
    const r = kit.bruikbaar(huis, 5.9);
    expect(r.v0).toBeCloseTo((0.3 / 3.6) * 3.75, 2);
    expect(r.v1).toBeCloseTo(3.75 + (3.3 / 5.3) * (9.84 - 3.75), 2);
    expect(kit.bruikbaar(huis, 10).v1).toBe(0);
    expect(kit.bruikbaar({ ...huis, dakvorm: 'plat' }, 2).v1).toBe(9.84);
  });

  it('bouwt de vloeren, de muren en één naam per ruimte uit de vakken', () => {
    const model = {
      gebouwen: [huis],
      etages: [
        { id: 'bg', van: 0, tot: 2.8, op: ['huis'] },
        { id: 'zolder', van: 5.6, tot: 9.2, dak: true, op: ['huis'] },
      ],
      bomen: {
        bg: { huis: { as: 'v', op: 7.5, a: { as: 'v', op: 5.5, a: { kamer: 'woonkamer' }, b: { as: 'u', op: 2.2, a: { kamer: 'hal' }, b: { kamer: 'woonkamer' } } }, b: { kamer: 'keuken' } } },
        zolder: { huis: { kamer: 'zolder' } },
      },
      kamers: { woonkamer: { naam: 'Woonkamer' }, hal: { naam: 'Hal' }, keuken: { naam: 'Keuken' }, zolder: { naam: 'Zolder' } },
    };
    const b = kit.bouw(model);
    expect(b.vloeren.filter((v) => v.etage === 'bg')).toHaveLength(4);
    // De woonkamer als L om de hal: één naam, met de oppervlakte van beide delen.
    const woon = b.namen.find((n) => n.kamer === 'woonkamer')!;
    expect(woon.m2).toBeCloseTo(5.6 * 7.5 - 2.2 * 2, 1);
    expect(b.namen.filter((n) => n.kamer === 'woonkamer')).toHaveLength(1);
    // Muren alleen tussen verschillende ruimtes.
    expect(b.muren.length).toBeGreaterThan(0);
    const svg = kit.teken(model, { breedte: 600, hoogte: 400 });
    expect(svg).toContain('class="sc-huis3d"');
    expect(svg.match(/>Woonkamer</g)).toHaveLength(1);
  });
});
