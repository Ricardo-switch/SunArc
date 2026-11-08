/*
 * De stand van het huis met wat er meespeelt (besluit 286): de knop op de wand,
 * de regel op de telefoon, de meldingen en de dag als balk.
 */
import { describe, expect, it } from 'vitest';

import { exampleSite as config } from './site.js';
import type { Explanation } from '../src/core/decision.js';
import type { DecisionView } from '../src/web/assistant.js';
import { standNu } from '../src/web/stand-nu.js';

/** Zondag 8 november 2026 in Nederland (wintertijd, UTC+1). */
const om = (uur: number, min = 0) => Date.UTC(2026, 10, 8, uur - 1, min);

function view(atMs: number, e: Partial<Explanation> = {}, over: Partial<DecisionView> = {}): DecisionView {
  return {
    atMs,
    explanation: {
      mode: 'dag',
      modeSource: 'schedule',
      occupied: true,
      budget: { availableW: 0, allocatedW: 0, surplusW: 0, reclaimableW: 0, gridPowerW: 900 },
      failsafe: { active: false, unreliable: [] },
      perZone: [
        { zoneId: 'woonkamer', temperatureC: 20.4, humidityPct: null, targetC: 20, heatTargetC: 20, demand: 'none', reason: 'zone_satisfied' },
        { zoneId: 'badkamer', temperatureC: 19, humidityPct: null, targetC: 18, heatTargetC: 18, demand: 'none', reason: 'zone_satisfied' },
        { zoneId: 'zolder', temperatureC: 17, humidityPct: null, targetC: 18, heatTargetC: 18, demand: 'heat', reason: 'zone_below_setpoint' },
      ],
      outdoorTemperatureC: -1,
      solarProductionW: 0,
      ...e,
    },
    commands: [],
    accepted: [],
    rejected: [],
    observed: { nest: 'heat@20', badkamer: 'off@18', 'ac-woonkamer': 'off', 'ac-zolder': 'off' },
    ...over,
  };
}

/** Een geheugen van een dienst die al eerder keek, zodat hij weet wanneer iets begon. */
const vers = () => new Map([['__start', 0]]);

const bijspringen = { strategyId: 'heat-assist', zoneId: 'woonkamer', actuatorId: 'ac-woonkamer', action: 'heat' as const, setpointC: 20, priority: 15, budgetW: 0, reason: 'zone_below_setpoint' as const };
const koud = { perZone: [{ zoneId: 'woonkamer', temperatureC: 19.6, humidityPct: null, targetC: 20, heatTargetC: 20, demand: 'heat' as const, reason: 'zone_below_setpoint' as const }] };

describe('de stand van het huis (besluit 286)', () => {
  it('zonder iets bijzonders: de stand en tot wanneer, met de dag als balk', () => {
    const s = standNu(config, view(om(10, 15)), 'nl', { geheugen: new Map() });
    expect(s).toMatchObject({ stand: 'dag', naam: 'Dag', soort: null, knop: 'tot 22:00', kort: 'Dag tot 22:00', onder: 'uit de dagdelen · om 22:00 nacht', meldingen: [] });
    expect(s.noot).toBe('Niets bijzonders: het huis volgt de dagdelen.');
    expect(s.balk.kamer).toBe('de woonkamer');
    expect(s.balk.nu).toBe(10.25);
    expect(s.balk.delen.map((d) => [d.van, d.tot, d.naam, d.temp])).toEqual([
      [0, 6, 'Nacht', 'niet'],
      [6, 8, 'Voorverwarmen', '19°'],
      [8, 22, 'Dag', '20°'],
      [22, 24, 'Nacht', 'niet'],
    ]);
    expect(s.balk.uitleg).toBe('Voorverwarmen 6:00, dag 8:00, nacht 22:00. De graden van de woonkamer.');
  });

  it('de airco springt bij, met sinds wanneer en hoeveel te koud; in de schaduw "zou" tot hij echt verwarmt', () => {
    const geheugen = vers();
    const echt = standNu(config, view(om(10, 2), koud, { accepted: [bijspringen], observed: { 'ac-woonkamer': 'heat@20' } }), 'nl', { geheugen });
    expect(echt).toMatchObject({ soort: 'bijspringen', knop: 'de airco springt bij', kort: 'De airco springt bij' });
    expect(echt.meldingen[0]).toEqual({ soort: 'bijspringen', wat: 'De airco woonkamer springt bij in de woonkamer', hoe: 'De verwarming houdt het niet bij: het is 0,4° te koud.', waarde: 'sinds 10:02' });
    expect(echt.noot).toContain('na 5 minuten stoken en vanaf 0,5° te koud');
    // Een kwartier later: nog steeds sinds 10:02.
    expect(standNu(config, view(om(10, 17), koud, { accepted: [bijspringen], observed: { 'ac-woonkamer': 'heat@20' } }), 'nl', { geheugen }).meldingen[0]!.waarde).toBe('sinds 10:02');
    const zou = standNu(config, view(om(10, 20), koud, { accepted: [bijspringen] }), 'nl', { geheugen: new Map() });
    expect(zou.knop).toBe('de airco zou bijspringen');
    expect(standNu(config, view(om(10, 20), koud, { accepted: [bijspringen] }), 'nl', { geheugen: new Map(), shadow: false }).knop).toBe('de airco springt bij');
  });

  it('na de nacht nog Dag als er licht brandt, met de lamp en de dag die doorloopt', () => {
    const s = standNu(config, view(om(22, 40)), 'nl', { geheugen: new Map(), lampenAan: () => ['Sfeerverlichting'] });
    expect(s).toMatchObject({ soort: 'licht', knop: 'er brandt nog licht', kort: 'Nog Dag: er brandt licht', onder: 'langer dan 22:00 · daarna nacht' });
    expect(s.meldingen[0]).toMatchObject({ wat: 'Sfeerverlichting brandt nog', hoe: 'Gaat het uit, dan wordt het Nacht.' });
    expect(s.balk.verlengdTot).toBeCloseTo(22.67, 2);
  });

  it('vanzelf afwezig: niemand thuis, de hele dag hetzelfde, en de airco springt niet bij', () => {
    const s = standNu(config, view(om(22, 40), { mode: 'afwezig', occupied: false }), 'nl', { geheugen: new Map() });
    expect(s).toMatchObject({ soort: 'afwezig', knop: 'niemand thuis', kort: 'Niemand thuis', onder: 'vanzelf · niemand thuis' });
    expect(s.meldingen[0]).toMatchObject({ wat: 'Iedereen is weg', waarde: '16°' });
    expect(s.balk.plat).toEqual({ naam: 'Afwezig', temp: '16°' });
    expect(s.noot).toBe('De airco springt niet bij zolang deze stand geldt.');
  });

  it('vakantie en een andere stand uit Home Assistant heten gekozen', () => {
    const vak = standNu(config, view(om(22, 40), { mode: 'vakantie', modeSource: 'override' }), 'nl', { geheugen: new Map() });
    expect(vak).toMatchObject({ soort: 'vakantie', knop: 'gekozen in Home Assistant', kort: 'Vakantie' });
    expect(vak.meldingen[0]).toMatchObject({ wat: 'Zo zuinig mogelijk', waarde: '12°' });
    const nacht = standNu(config, view(om(15), { mode: 'nacht', modeSource: 'override' }), 'nl', { geheugen: new Map() });
    expect(nacht).toMatchObject({ soort: null, knop: 'gekozen in Home Assistant', kort: 'Nacht, gekozen', onder: 'gekozen in Home Assistant' });
  });

  it('wat al speelde toen de dienst begon te kijken, krijgt geen sinds', () => {
    const geheugen = new Map<string, number>();
    const eerst = standNu(config, view(om(22, 40)), 'nl', { geheugen });
    expect(eerst.meldingen[0]!.waarde).toBe('');
    expect(standNu(config, view(om(22, 50)), 'nl', { geheugen }).meldingen[0]!.waarde).toBe('');
    // Gaat het licht uit en weer aan, dan weet hij het begin wel.
    standNu(config, view(om(23), { mode: 'nacht' }), 'nl', { geheugen });
    expect(standNu(config, view(om(23, 5)), 'nl', { geheugen }).meldingen[0]!.waarde).toBe('sinds 23:05');
  });

  it('met de hand gaat voor: uit de app en de Nest die iemand zelf bediende, en daarna bijspringen', () => {
    const s = standNu(config, view(om(10, 15), { ...koud, overrides: [{ actuatorId: 'nest', sinceMs: om(10), untilMs: om(13) }] }, { accepted: [bijspringen], observed: { 'ac-woonkamer': 'heat@20' } }), 'nl', {
      geheugen: vers(),
      hand: [{ id: 'climate.air_conditioning_zolder', modus: 'verwarmen', gezet: 21, totMs: om(12) }],
    });
    expect(s).toMatchObject({ soort: 'hand', knop: 'airco zolder met de hand', kort: 'Airco zolder tot 12:00' });
    expect(s.meldingen.map((m) => [m.soort, m.wat, m.waarde])).toEqual([
      ['hand', 'Airco zolder met de hand', 'tot 12:00'],
      ['hand', 'Nest (beneden) met de hand', 'tot 13:00'],
      ['bijspringen', 'De airco woonkamer springt bij in de woonkamer', 'sinds 10:15'],
    ]);
    expect(s.meldingen[0]!.hoe).toBe('Op 21°, daarna weer zoals het was.');
  });

  it('Handmatig door "Handmatig koelen" in Home Assistant: zegt welke knop, en sinds wanneer (besluit 287)', () => {
    const toestand = (id: string) => (id === 'input_select.koel_strategie' ? { state: 'Handmatig koelen', naam: 'Koel strategie', sindsMs: om(14, 20) } : null);
    const s = standNu(config, view(om(15), { mode: 'handmatig', modeSource: 'override' }), 'nl', { geheugen: vers(), toestand });
    expect(s).toMatchObject({ soort: 'hand', knop: 'koelen met de hand', kort: 'Koelen met de hand', onder: 'door "Handmatig koelen" in Home Assistant' });
    expect(s.meldingen[0]).toEqual({ soort: 'hand', wat: 'Koelen met de hand', hoe: 'In Home Assistant staat "Koel strategie" op "Handmatig koelen". Zolang regelt het huis niets.', waarde: 'sinds 14:20' });
    expect(s.noot).toBe('Zet je hem in Home Assistant terug, dan regelt het huis weer zelf.');
    // Gewoon Handmatig gekozen, zonder die knop: zoals eerst.
    const gekozen = standNu(config, view(om(15), { mode: 'handmatig', modeSource: 'override' }), 'nl', { geheugen: vers(), toestand: () => ({ state: 'Automatisch', naam: null, sindsMs: null }) });
    expect(gekozen).toMatchObject({ soort: null, knop: 'gekozen in Home Assistant', kort: 'Handmatig, gekozen' });
  });

  it('vakantie zegt sinds wanneer, uit Home Assistant; een einddatum kent Home Assistant niet (besluit 287)', () => {
    const toestand = (id: string) => (id === 'input_select.verwarming_modus' ? { state: 'vakantie', naam: 'Verwarming modus', sindsMs: Date.UTC(2026, 10, 3, 8) } : null);
    const s = standNu(config, view(om(22, 40), { mode: 'vakantie', modeSource: 'override' }), 'nl', { geheugen: vers(), toestand });
    expect(s).toMatchObject({ soort: 'vakantie', knop: 'sinds di 3 nov', kort: 'Vakantie sinds di 3 nov' });
    expect(s.meldingen[0]!.hoe).toBe('Sinds di 3 nov. Tot je hem in Home Assistant terugzet.');
    // Vandaag begonnen: de klok.
    const vandaag = standNu(config, view(om(22, 40), { mode: 'vakantie', modeSource: 'override' }), 'nl', { geheugen: vers(), toestand: () => ({ state: 'vakantie', naam: null, sindsMs: om(9, 5) }) });
    expect(vandaag.knop).toBe('sinds 09:05');
    expect(standNu(config, view(om(22, 40), { mode: 'vakantie', modeSource: 'override' }), 'en', { geheugen: vers(), toestand }).kort).toBe('Holiday since Tue 3 Nov');
  });

  it('in het Engels', () => {
    const s = standNu(config, view(om(10, 15)), 'en', { geheugen: new Map() });
    expect(s).toMatchObject({ naam: 'Day', knop: 'until 22:00', kort: 'Day until 22:00' });
    expect(standNu(config, view(om(22, 40), { mode: 'afwezig', occupied: false }), 'en', { geheugen: new Map() }).kort).toBe('Nobody home');
  });
});
