/**
 * Helpen bij de cv in de configuratie (besluit 292): de ketel, de airco's die
 * helpen, wat de bewoner koos en de prijzen.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseSiteConfig } from '../src/config/schema.js';
import { defaultStrategies } from '../src/index.js';
import { helpenNu, ketels, withCvHelp } from '../src/web/helpen.js';
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
