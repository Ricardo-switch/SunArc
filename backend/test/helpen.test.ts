/**
 * Helpen bij de cv in de configuratie (besluit 292): de ketel, de airco's die
 * helpen, wat de bewoner koos en de prijzen.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseSiteConfig } from '../src/config/schema.js';
import { defaultStrategies } from '../src/index.js';
import { HelpenDag, helpenNu, ketels, withCvHelp } from '../src/web/helpen.js';
import { exampleSitePath } from './site.js';

const raw = () => JSON.parse(readFileSync(exampleSitePath, 'utf-8')) as Record<string, unknown>;
const geen = { thermostaat: null, gas: null, stroom: null };

describe('helpen bij de cv in de configuratie (besluit 292)', () => {
  it('neemt de ketel uit de kamer waar een airco helpt, of de gekozen thermostaat', () => {
    expect(ketels(raw(), null)).toEqual(['nest']);
    expect(ketels(raw(), 'climate.thermostaat_badkamer')).toEqual(['badkamer']);
    expect(ketels(raw(), 'badkamer')).toEqual(['badkamer']);
    expect(ketels(raw(), 'geen')).toEqual([]);
  });

  it('zet cvHelp erin, en de regeling leest het', () => {
    const uit = withCvHelp(raw(), { naMin: 5, vanafC: 0.3, aan: { 'ac-zolder': false } }, { thermostaat: null, gas: 1.37, stroom: 0.27 });
    expect(uit.toegevoegd).toEqual(["helpen bij de cv: 1 van 2 airco's"]);
    const c = parseSiteConfig(uit.raw, { knownStrategies: defaultStrategies().ids });
    expect(c.ok && c.config.cvHelp).toEqual({ boilerIds: ['nest'], startDelayMinutes: 5, minShortfallC: 0.3, minRunMinutes: 30, minRestMinutes: 15, off: ['ac-zolder'], gasEurPerM3: 1.37, electricityEurPerKwh: 0.27 });
  });

  it('zonder ketel niet', () => {
    expect(withCvHelp(raw(), { naMin: 5, vanafC: 0.3 }, { ...geen, thermostaat: 'geen' }).raw['cvHelp']).toBeUndefined();
  });

  it('neemt over wat bij bijspringen per kamer stond (besluit 283)', () => {
    expect(helpenNu(null, { woonkamer: { aan: true, naMin: 7, vanafC: 0.3 } }, raw())).toEqual({ naMin: 7, vanafC: 0.3 });
    expect(helpenNu(null, { woonkamer: { aan: false, naMin: 5, vanafC: 0.5 } }, raw())).toEqual({ aan: { nest: false, 'ac-woonkamer': false }, naMin: 5, vanafC: 0.5 });
    expect(helpenNu(null, undefined, raw())).toEqual({ naMin: 5, vanafC: 0.5 });
    expect(helpenNu({ naMin: 10, vanafC: 1 }, { woonkamer: { aan: true, naMin: 7, vanafC: 0.3 } }, raw())).toEqual({ naMin: 10, vanafC: 1 });
  });

  it('een ongeldig apparaat in cvHelp is een fout', () => {
    const r = { ...raw(), cvHelp: { boilerIds: ['bestaat-niet'] } };
    expect(parseSiteConfig(r, { knownStrategies: defaultStrategies().ids }).ok).toBe(false);
  });
});

describe('de dagbalk in het blad van de airco (besluit 303)', () => {
  // 11 november 2026, middernacht in Amsterdam.
  const M = Date.UTC(2026, 10, 10, 23, 0);
  const u = (uur: number) => M + uur * 3_600_000;
  const geen = new Set<string>();
  const zolder = new Set(['ac-zolder']);

  it('houdt de ketel, de airco, de stille uren en kort uit bij', () => {
    const d = new HelpenDag(() => 'Europe/Amsterdam');
    d.observe(u(5), geen, { ketel: false, stil: true, warm: geen });
    d.observe(u(7), geen, { ketel: true, stil: false, warm: geen });
    d.observe(u(7.25), zolder, { ketel: true, stil: false, warm: zolder });
    // Hij gaat zelf even uit terwijl hij helpt: pendelen.
    d.observe(u(7.5), zolder, { ketel: false, stil: false, warm: geen });
    d.observe(u(7.6), zolder, { ketel: false, stil: false, warm: zolder });
    d.observe(u(8.25), geen, { ketel: false, stil: false, warm: geen });
    const b = d.balk('ac-zolder', u(9));
    expect(b.vanMs).toBe(M);
    expect(b.stil).toEqual([[u(5), u(7)]]);
    expect(b.ketel).toEqual([[u(7), u(7.5)]]);
    expect(b.airco).toEqual([[u(7.25), u(8.25)]]);
    expect(b.kort).toEqual([u(7.5)]);
    // Een uur geholpen, waarvan drie kwartier toen de ketel al stopte.
    expect(b.langerMin).toBe(45);
    expect(d.vandaag('ac-zolder', u(9))).toMatchObject({ keer: 1, minuten: 60 });
  });

  it('een nieuwe dag begint leeg, wat doorloopt vanaf middernacht', () => {
    const d = new HelpenDag(() => 'Europe/Amsterdam');
    d.observe(u(23.5), zolder, { ketel: true, stil: true, warm: zolder });
    d.observe(u(24.5), zolder, { ketel: true, stil: true, warm: zolder });
    const b = d.balk('ac-zolder', u(25));
    expect(b.vanMs).toBe(u(24));
    expect(b.airco).toEqual([[u(24), null]]);
    expect(b.ketel).toEqual([[u(24), null]]);
    expect(b.kort).toEqual([]);
  });
});
