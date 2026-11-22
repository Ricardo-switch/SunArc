/**
 * De valuta van het huis (testerronde, november 2026): uit Home Assistant, met
 * de euro als standaard. Een tester buiten de eurozone zag overal een €.
 */

import { readFile } from 'node:fs/promises';

import { afterEach, describe, expect, it } from 'vitest';

import { valuta, valutaTeken, zetValuta } from '../src/web/valuta.js';

afterEach(() => zetValuta('EUR'));

describe('de valuta', () => {
  it('is de euro tot Home Assistant iets anders zegt, en neemt alleen een code van drie letters', () => {
    expect([valuta(), valutaTeken('nl'), valutaTeken('en')]).toEqual(['EUR', '€', '€']);
    zetValuta('usd');
    zetValuta(null);
    zetValuta('EURO');
    expect(valuta()).toBe('EUR');
    zetValuta('USD');
    expect([valuta(), valutaTeken('nl'), valutaTeken('en')]).toEqual(['USD', '$', '$']);
    zetValuta('CHF');
    expect(valutaTeken('en')).toBe('CHF');
  });

  it('staat in de app nergens meer als vast euroteken', async () => {
    // De bedragen gaan via taal.valuta() of {valuta} in de teksten; alleen het merkteken in opbrengst.js en de uitleg in taal.js mogen het noemen.
    for (const pad of ['huis-kan.js', 'inrichten.js', 'inrichten-huis.js', 'inrichten-klimaat.js', 'inrichten-energie.js', 'inrichten-voorstellen.js', 'inrichten-tekenen.js', 'instellingen.js', 'opbrengst.js', 'sluipverbruik.js', 'thuis.js', 'thuis-kaarten.js']) {
      const code = await readFile(new URL(`../../frontend/src/${pad}`, import.meta.url), 'utf-8');
      const regels = code.split('\n').filter((r) => r.includes('€') && !r.includes("kosten: '€'") && !r.includes("eenheid === '€'"));
      expect(regels, pad).toEqual([]);
    }
    for (const taal of ['nl', 'en']) {
      expect(await readFile(new URL(`../../frontend/kit/teksten.${taal}.js`, import.meta.url), 'utf-8')).not.toContain('€');
    }
  });
});
