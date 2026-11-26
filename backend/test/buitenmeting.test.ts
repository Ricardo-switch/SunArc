/*
 * De buitentemperatuur die de dienst gebruikt (besluit 354): storingen eruit,
 * de rustigste buitenmeter, en het weer als controle. De voorbeelden komen uit
 * het tweede proefhuis: twee airco's met elk een buitenunit, die af en toe
 * even op precies 0,0 terugvallen.
 */
import { describe, expect, it } from 'vitest';

import { buitenunitMeters, type HaRegistryEntity } from '../src/adapters/homeassistant/discovery.js';
import type { HaEntityState } from '../src/adapters/homeassistant/client.js';
import { withBuiten } from '../src/adapters/homeassistant/shadow.js';
import type { SystemState } from '../src/core/state.js';
import { value } from '../src/core/state.js';
import { Buitenmeting, leesMeter } from '../src/web/buitenmeting.js';
import { KloptRegister, kloptMelding } from '../src/web/klopt.js';

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 26, 6, 0, 0);
const WK = { id: 'sensor.woonkamer_airco_woonkamer_buitentemperatuur', naam: 'Airco woonkamer' };
const SK = { id: 'sensor.slaapkamer_airco_slaapkamer_buitentemperatuur', naam: 'Airco slaapkamer' };

describe('een meting of een storing', () => {
  it('precies 0,0 vlak na een graad of meer van nul af is een storing', () => {
    expect(leesMeter('0.0', { c: -1.2, tMs: T0 }, T0 + 5 * MIN)).toBeNull();
    expect(leesMeter('0.0', { c: 2.2, tMs: T0 }, T0 + 5 * MIN)).toBeNull();
  });

  it('rond het vriespunt is 0,0 gewoon een meting', () => {
    expect(leesMeter('0.0', { c: 0.5, tMs: T0 }, T0 + 5 * MIN)).toBe(0);
    expect(leesMeter('0.0', null, T0)).toBe(0);
    // Na een uur zonder meting weet de dienst niet meer waar hij vandaan kwam.
    expect(leesMeter('0.0', { c: -2, tMs: T0 }, T0 + 61 * MIN)).toBe(0);
  });

  it('weg of onleesbaar is geen meting', () => {
    for (const ruw of ['unavailable', 'unknown', '', undefined, null]) expect(leesMeter(ruw, null, T0)).toBeNull();
    expect(leesMeter('-1.5', null, T0)).toBe(-1.5);
  });
});

describe('de buitenmeting', () => {
  it('houdt de laatste goede waarde een kwartier vast bij een storing', () => {
    const b = new Buitenmeting();
    expect(b.meet(T0, [{ ...WK, ruw: '-1.2' }], -1.9).c).toBe(-1.2);
    expect(b.meet(T0 + 5 * MIN, [{ ...WK, ruw: '0.0' }], -1.9)).toMatchObject({ c: -1.2, bron: 'meter' });
    expect(b.meet(T0 + 10 * MIN, [{ ...WK, ruw: 'unavailable' }], -1.9)).toMatchObject({ c: -1.2, bron: 'meter' });
    // Langer weg: dan het weer.
    expect(b.meet(T0 + 20 * MIN, [{ ...WK, ruw: 'unavailable' }], -1.9)).toMatchObject({ c: -1.9, bron: 'weer', meter: null });
    expect(b.meet(T0 + 21 * MIN, [{ ...WK, ruw: '-1.0' }], -1.9)).toMatchObject({ c: -1, bron: 'meter' });
  });

  it('zonder meter en zonder weer is er geen buitentemperatuur', () => {
    expect(new Buitenmeting().meet(T0, [{ ...WK, ruw: 'unavailable' }], null)).toEqual({ c: null, bron: null, meter: null, afwijkend: null });
  });

  it('neemt van twee airco’s de meter met de minste storingen', () => {
    const b = new Buitenmeting();
    // De slaapkamer valt drie keer weg, de woonkamer niet.
    for (let i = 0; i < 6; i++) {
      const t = T0 + i * 10 * MIN;
      b.meet(t, [{ ...SK, ruw: i % 2 ? '0.0' : '-1.5' }, { ...WK, ruw: '-1.0' }], -1.9);
    }
    const k = b.meet(T0 + 60 * MIN, [{ ...SK, ruw: '-1.5' }, { ...WK, ruw: '-1.0' }], -1.9);
    expect(k).toMatchObject({ c: -1, bron: 'meter', meter: WK });
  });

  it('bij gelijke storingen blijft hij bij de meter van de configuratie', () => {
    const k = new Buitenmeting().meet(T0, [{ ...WK, ruw: '1.0' }, { ...SK, ruw: '0.7' }], 0.6);
    expect(k.meter).toEqual(WK);
  });

  it('neemt het weer pas als de meter een uur meer dan 3° afwijkt, en geeft het terug bij 2° of minder', () => {
    const b = new Buitenmeting();
    // Zon op de buitenunit: 6° te warm.
    expect(b.meet(T0, [{ ...WK, ruw: '12' }], 6).bron).toBe('meter');
    expect(b.meet(T0 + 59 * MIN, [{ ...WK, ruw: '12' }], 6).bron).toBe('meter');
    const over = b.meet(T0 + 60 * MIN, [{ ...WK, ruw: '12' }], 6);
    expect(over).toMatchObject({ c: 6, bron: 'weer', meter: WK, afwijkend: { naam: 'Airco woonkamer', sindsMs: T0 } });
    // 2,5° verschil: nog steeds het weer.
    expect(b.meet(T0 + 90 * MIN, [{ ...WK, ruw: '8.5' }], 6).bron).toBe('weer');
    expect(b.meet(T0 + 100 * MIN, [{ ...WK, ruw: '7.5' }], 6)).toMatchObject({ c: 7.5, bron: 'meter', afwijkend: null });
  });

  it('een korte afwijking telt niet: de klok begint opnieuw', () => {
    const b = new Buitenmeting();
    b.meet(T0, [{ ...WK, ruw: '10' }], 5);
    b.meet(T0 + 40 * MIN, [{ ...WK, ruw: '6' }], 5);
    expect(b.meet(T0 + 70 * MIN, [{ ...WK, ruw: '10' }], 5).bron).toBe('meter');
  });

  it('zonder weer blijft de meter tellen', () => {
    const b = new Buitenmeting();
    b.meet(T0, [{ ...WK, ruw: '12' }], 6);
    b.meet(T0 + 60 * MIN, [{ ...WK, ruw: '12' }], 6);
    expect(b.meet(T0 + 61 * MIN, [{ ...WK, ruw: '12' }], null)).toMatchObject({ c: 12, bron: 'meter' });
  });
});

describe('welke buitenmeters', () => {
  const reg = (entity_id: string, device_id: string | null, extra: Partial<HaRegistryEntity> = {}): HaRegistryEntity => ({ entity_id, device_id, ...extra });
  const entities = [
    reg('climate.woonkamer_airco_woonkamer', 'd1'),
    reg(WK.id, 'd1', { original_device_class: 'temperature', original_name: 'Buitentemperatuur' }),
    reg('sensor.woonkamer_airco_woonkamer_binnentemperatuur', 'd1', { original_device_class: 'temperature' }),
    reg('climate.slaapkamer_airco_slaapkamer', 'd2'),
    reg(SK.id, 'd2', { original_device_class: 'temperature', original_name: 'Buitentemperatuur' }),
    reg('sensor.buiten_temperatuur', 'd3', { original_device_class: 'temperature' }),
  ];
  const states = new Map<string, HaEntityState>(
    [
      ['climate.woonkamer_airco_woonkamer', 'Airco woonkamer'],
      ['climate.slaapkamer_airco_slaapkamer', 'Airco slaapkamer'],
    ].map(([id, naam]) => [id!, { entity_id: id!, state: 'heat', attributes: { friendly_name: naam } } as unknown as HaEntityState]),
  );

  it('bij de buitenunit van een airco ook die van de andere airco’s, met de naam van de airco', () => {
    expect(buitenunitMeters(entities, states, WK.id)).toEqual([WK, SK]);
  });

  it('een gewone buitensensor blijft alleen', () => {
    expect(buitenunitMeters(entities, states, 'sensor.buiten_temperatuur').map((m) => m.id)).toEqual(['sensor.buiten_temperatuur']);
  });
});

describe('in de regeling en de bel', () => {
  const state = { nowMs: T0, outdoorTemperatureC: value(1, T0) } as unknown as SystemState;

  it('vervangt de buitentemperatuur alleen als de dienst er een koos', () => {
    expect(withBuiten(state, undefined)).toBe(state);
    expect(withBuiten(state, -1.9).outdoorTemperatureC).toEqual(value(-1.9, T0));
    expect(withBuiten(state, null).outdoorTemperatureC.ok).toBe(false);
  });

  it('meldt in de bel zolang het weer het overnam', () => {
    const r = new KloptRegister();
    r.buiten({ naam: 'Airco woonkamer', sindsMs: T0 });
    const f = r.lijst(T0 + 2 * 60 * MIN);
    expect(f).toEqual([{ soort: 'buiten', naam: 'Airco woonkamer', sindsMs: T0 }]);
    const m = kloptMelding(f[0]!, 'nl', T0);
    expect(m).toMatchObject({ id: 'bron:buiten', soort: 'bron', titel: 'De buitentemperatuur van Airco woonkamer wijkt af', actie: { href: 'motor.html' } });
    expect(kloptMelding(f[0]!, 'en', T0).titel).toBe('The outdoor temperature of Airco woonkamer is off');
    r.buiten(null);
    expect(r.lijst(T0 + 3 * 60 * MIN)).toEqual([]);
  });
});
