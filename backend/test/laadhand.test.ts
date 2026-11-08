import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isLaadCall } from '../src/adapters/homeassistant/client.js';
import { LAAD_BESTAND, Laadhand, laadMag, type LaadDeur } from '../src/web/laadhand.js';
import type { Auto, LaadBediening } from '../src/web/opslag.js';

const t0 = Date.parse('2026-11-07T11:00:00Z');

const autoVan = (x: Partial<Auto> = {}): Auto => ({
  id: 'tesla', naam: 'Model 3', pct: 64, aangesloten: true, laadt: true, vermogenW: 4140, bereikKm: 312, plek: null, accuKWh: 75, laadpaal: 'easee',
  paalNaam: 'Easee Home', paalStroomA: { min: 6, max: 16 }, laadgrens: 80, stroomA: [6, 6, 6], volOm: null, thuis: true, kabelSinds: null, wegSinds: null, fout: null, ...x,
});
const bedieningVan = (x: Partial<LaadBediening> = {}): LaadBediening => ({
  auto: 'tesla', apparaat: 'easee', stroom: { id: 'number.easee_stroom', min: 6, max: 16, stap: 1, nuA: 6 }, pauze: { soort: 'schakelaar', id: 'switch.easee_laden', omgekeerd: false }, mag: true, evcc: false, ...x,
});

/** Een nagebootst Home Assistant: de standen, en wat er gezet is. */
function deur(o: { auto?: () => Auto; bediening?: () => LaadBediening; zekeringA?: number | null; map?: string | null } = {}) {
  const standen = new Map<string, string>([['number.easee_stroom', '6'], ['switch.easee_laden', 'on']]);
  const gedaan: string[] = [];
  let nu = t0;
  const d: LaadDeur = {
    state: (id) => (standen.has(id) ? { state: standen.get(id)! } : undefined),
    zetStroom: async (id, a) => {
      gedaan.push(`${id}=${a}`);
      standen.set(id, String(a));
    },
    schakel: async (id, aan) => {
      gedaan.push(`${id} ${aan ? 'aan' : 'uit'}`);
      standen.set(id, aan ? 'on' : 'off');
    },
    druk: async (id) => void gedaan.push(`${id} gedrukt`),
    auto: () => (o.auto ?? (() => autoVan()))(),
    bediening: () => {
      const b = (o.bediening ?? (() => bedieningVan()))();
      // Wat er nu op het getal staat, zoals Home Assistant het zegt.
      return b.stroom ? { ...b, stroom: { ...b.stroom, nuA: Number(standen.get(b.stroom.id)) } } : b;
    },
    zekeringA: () => (o.zekeringA === undefined ? 20 : o.zekeringA),
    nu: () => nu,
    map: o.map ?? null,
  };
  return { d, standen, gedaan, later: (ms: number) => (nu += ms) };
}

describe('laden met de hand (besluit 262)', () => {
  it('zet de stroom tot een uur, en zet hem daarna terug', async () => {
    const h = deur();
    const l = new Laadhand(h.d);
    const uit = await l.zet('tesla', { stroomA: 8, tot: 'uur' });
    expect(uit).toMatchObject({ ok: true, terug: { stroom: { id: 'number.easee_stroom', gezet: 8, was: 6 }, totMs: t0 + 3_600_000 } });
    expect(h.gedaan).toEqual(['number.easee_stroom=8']);
    expect((await l.stand('tesla'))?.actief).toEqual({ stroomA: 8, pauze: false, tot: 'uur', totMs: t0 + 3_600_000, pct: null });
    expect(await l.ronde()).toEqual([]);
    h.later(3_600_000);
    expect(await l.ronde()).toEqual(['number.easee_stroom terug naar 6 A']);
    expect(h.standen.get('number.easee_stroom')).toBe('6');
    expect(l.terugzetten).toEqual([]);
  });

  it('blijft binnen de laadpaal en de zekering, en alleen als het mag', async () => {
    const l = new Laadhand(deur({ zekeringA: 9 }).d);
    expect(await l.zet('tesla', { stroomA: 18, tot: 'uur' })).toEqual({ ok: false, reden: 'de laadpaal kan 6 tot 16 A' });
    expect(await l.zet('tesla', { stroomA: 10, tot: 'uur' })).toEqual({ ok: false, reden: 'meer dan 9 A past nu niet op je zekering' });
    const niet = new Laadhand(deur({ bediening: () => bedieningVan({ mag: false }) }).d);
    expect(await niet.zet('tesla', { stroomA: 8, tot: 'uur' })).toMatchObject({ ok: false, reden: expect.stringContaining('Energie › Auto en laadpaal') });
    const evcc = new Laadhand(deur({ bediening: () => bedieningVan({ mag: false, evcc: true }) }).d);
    expect(await evcc.zet('tesla', { stroomA: 8, tot: 'uur' })).toEqual({ ok: false, reden: 'evcc regelt het laden; zet het in evcc' });
    const weg = new Laadhand(deur({ auto: () => autoVan({ aangesloten: false, laadt: false }) }).d);
    expect(await weg.zet('tesla', { stroomA: 8, tot: 'uur' })).toEqual({ ok: false, reden: 'de auto hangt niet aan de laadpaal' });
  });

  it('laat wie zelf iets verzette winnen', async () => {
    const h = deur();
    const l = new Laadhand(h.d);
    await l.zet('tesla', { stroomA: 10, tot: 'uur' });
    // In de app van de laadpaal zelf op 12 A gezet.
    h.standen.set('number.easee_stroom', '12');
    h.later(3_600_000);
    expect(await l.ronde()).toEqual([]);
    expect(h.standen.get('number.easee_stroom')).toBe('12');
  });

  it('stopt bij het % en als de kabel eruit gaat, nooit boven de laadgrens', async () => {
    let pct = 64;
    let kabel = true;
    const h = deur({ auto: () => autoVan({ pct, aangesloten: kabel }) });
    const l = new Laadhand(h.d);
    expect(await l.zet('tesla', { stroomA: 8, tot: 'pct', pct: 85 })).toEqual({ ok: false, reden: 'boven de laadgrens van de auto (80%) gaat niet' });
    expect(await l.zet('tesla', { stroomA: 8, tot: 'pct', pct: 70 })).toMatchObject({ ok: true, terug: { pct: 70 } });
    pct = 69;
    expect(await l.ronde()).toEqual([]);
    pct = 70;
    expect(await l.ronde()).toEqual(['number.easee_stroom terug naar 6 A']);
    // Voor de bel (besluit 263): klaar op het %.
    expect(l.klaar).toEqual([{ auto: 'tesla', tot: 'pct', pct: 70, ms: t0 }]);
    await l.zet('tesla', { stroomA: 9, tot: 'kabel' });
    kabel = false;
    expect(await l.ronde()).toEqual(['number.easee_stroom terug naar 6 A']);
    // De kabel eruit hoeft geen melding.
    expect(l.klaar).toHaveLength(1);
  });

  it('pauzeert tot een tijd, en laat hem daarna weer laden', async () => {
    const h = deur();
    const l = new Laadhand(h.d);
    expect(await l.zet('tesla', { pauze: true, tot: 'pct', pct: 70 })).toEqual({ ok: false, reden: 'pauzeren gaat tot een tijd of tot de kabel eruit gaat' });
    await l.zet('tesla', { pauze: true, tot: 'tijd', totMs: t0 + 2 * 3_600_000 });
    expect(h.standen.get('switch.easee_laden')).toBe('off');
    h.later(2 * 3_600_000);
    expect(await l.ronde()).toEqual(['tesla laadt weer']);
    expect(h.standen.get('switch.easee_laden')).toBe('on');
    // Terug nu: ook zonder te wachten.
    await l.zet('tesla', { stroomA: 7, tot: 'kabel' });
    expect(await l.terugNu('tesla')).toBe(true);
    expect(h.standen.get('number.easee_stroom')).toBe('6');
  });

  it('onthoudt wat terug moet, ook na een herstart', async () => {
    const map = await mkdtemp(join(tmpdir(), 'laadhand-'));
    const h = deur({ map });
    await new Laadhand(h.d).zet('tesla', { stroomA: 8, tot: 'uur' });
    expect(JSON.parse(await readFile(join(map, LAAD_BESTAND), 'utf8')).terug).toHaveLength(1);
    const opnieuw = new Laadhand(h.d);
    h.later(3_600_000);
    expect(await opnieuw.ronde()).toEqual(['number.easee_stroom terug naar 6 A']);
  });
});

describe('Easee via de eigen dienst (besluit 277)', () => {
  const easeeBediening = (nuA: number | null = null): LaadBediening =>
    bedieningVan({ stroom: { id: 'sensor.easee_dynamic_charger_limit', min: 6, max: 16, stap: 1, nuA, easee: 'dev1' }, pauze: { soort: 'easee', apparaat: 'dev1' } });
  function easeeDeur(o: { sensor?: boolean } = {}) {
    const diensten: string[] = [];
    let staat: number | null = o.sensor ? 16 : null;
    let nu = t0;
    const d: LaadDeur = {
      state: (id) => (id === 'sensor.easee_dynamic_charger_limit' && staat != null ? { state: String(staat) } : undefined),
      zetStroom: async () => {
        throw new Error('geen getal bij Easee');
      },
      schakel: async () => undefined,
      druk: async () => undefined,
      easee: async (apparaat, dienst, data) => {
        diensten.push(`${apparaat} ${dienst} ${JSON.stringify(data)}`);
        if (dienst === 'set_charger_dynamic_limit' && o.sensor) staat = data['current'] as number;
      },
      auto: () => autoVan(),
      bediening: () => easeeBediening(staat),
      zekeringA: () => 20,
      nu: () => nu,
      map: null,
    };
    return { d, diensten, later: (ms: number) => (nu += ms), zelf: (a: number) => (staat = a) };
  }

  it('zet de stroom met een levensduur tot het eind, en zet hem daarna terug', async () => {
    const h = easeeDeur({ sensor: true });
    const l = new Laadhand(h.d);
    expect(await l.zet('tesla', { stroomA: 10, tot: 'uur' })).toMatchObject({ ok: true, terug: { stroom: { gezet: 10, was: 16, easee: 'dev1', vangnetMs: t0 + 3_600_000 } } });
    expect(h.diensten).toEqual(['dev1 set_charger_dynamic_limit {"current":10,"time_to_live":60}']);
    h.later(3_600_000);
    expect(await l.ronde()).toEqual(['tesla terug naar 16 A']);
    expect(h.diensten.at(-1)).toBe('dev1 set_charger_dynamic_limit {"current":16,"time_to_live":0}');
  });

  it('zonder sensor gaat hij terug naar de grens van de laadpaal', async () => {
    const h = easeeDeur();
    const l = new Laadhand(h.d);
    expect(await l.zet('tesla', { stroomA: 8, tot: 'kabel' })).toMatchObject({ ok: true, terug: { stroom: { gezet: 8, was: 16, vangnetMs: t0 + 1080 * 60_000 } } });
    expect(h.diensten).toEqual(['dev1 set_charger_dynamic_limit {"current":8,"time_to_live":1080}']);
    expect(await l.terugNu('tesla')).toBe(true);
    expect(h.diensten.at(-1)).toBe('dev1 set_charger_dynamic_limit {"current":16,"time_to_live":0}');
  });

  it('vernieuwt de levensduur als het met de hand langer duurt, tenzij iemand zelf iets verzette', async () => {
    const h = easeeDeur({ sensor: true });
    const l = new Laadhand(h.d);
    await l.zet('tesla', { stroomA: 10, tot: 'kabel' });
    h.later(17 * 3_600_000 + 40 * 60_000);
    await l.ronde();
    expect(h.diensten).toHaveLength(2);
    expect(h.diensten[1]).toBe('dev1 set_charger_dynamic_limit {"current":10,"time_to_live":1080}');
    // In de app van Easee op 12 A gezet: niet meer vernieuwen, en op het eind niet terug.
    h.zelf(12);
    h.later(17 * 3_600_000 + 40 * 60_000);
    await l.ronde();
    expect(h.diensten).toHaveLength(2);
  });

  it('pauzeert en hervat met de opdracht van Easee', async () => {
    const h = easeeDeur();
    const l = new Laadhand(h.d);
    expect(await l.zet('tesla', { pauze: true, tot: 'uur' })).toMatchObject({ ok: true });
    expect(h.diensten).toEqual(['dev1 action_command {"action_command":"pause"}']);
    expect(await l.terugNu('tesla')).toBe(true);
    expect(h.diensten.at(-1)).toBe('dev1 action_command {"action_command":"resume"}');
  });

  it('de deur laat alleen de stroom, de levensduur en pauze of hervat op dat apparaat door', () => {
    const mag = laadMag([easeeBediening()], []);
    expect(mag.easee).toEqual([{ apparaat: 'dev1', min: 6, max: 16, pauze: true }]);
    const zet = (service: string, data: Record<string, unknown>, target: Record<string, unknown> = {}) => isLaadCall('easee', service, data, target, mag);
    expect(zet('set_charger_dynamic_limit', { device_id: 'dev1', current: 10, time_to_live: 60 })).toBe(true);
    expect(zet('set_charger_dynamic_limit', { device_id: 'dev1', current: 20, time_to_live: 60 })).toBe(false);
    expect(zet('set_charger_dynamic_limit', { device_id: 'dev1', current: 10, time_to_live: 2000 })).toBe(false);
    expect(zet('set_charger_dynamic_limit', { device_id: 'dev1', current: 10 })).toBe(false);
    expect(zet('set_charger_dynamic_limit', { device_id: 'dev2', current: 10, time_to_live: 60 })).toBe(false);
    expect(zet('set_charger_dynamic_limit', { device_id: 'dev1', current: 10, time_to_live: 60 }, { entity_id: 'x' })).toBe(false);
    expect(zet('action_command', { device_id: 'dev1', action_command: 'pause' })).toBe(true);
    expect(zet('action_command', { device_id: 'dev1', action_command: 'resume' })).toBe(true);
    expect(zet('action_command', { device_id: 'dev1', action_command: 'reboot' })).toBe(false);
    expect(zet('set_charger_max_limit', { device_id: 'dev1', current: 10 })).toBe(false);
    expect(zet('set_circuit_dynamic_limit', { device_id: 'dev1', current_p1: 10 })).toBe(false);
    // Niet toegelaten: niets.
    const niet = laadMag([{ ...easeeBediening(), mag: false }], []);
    expect(isLaadCall('easee', 'action_command', { device_id: 'dev1', action_command: 'pause' }, {}, niet)).toBe(false);
  });
});

describe('de smalle deur van laden (besluit 262)', () => {
  const mag = laadMag([bedieningVan()], [{ auto: 'tesla', tot: 'uur', totMs: t0, stroom: { id: 'number.tesla_amps', gezet: 8, was: 0 }, sindsMs: t0 }]);
  it('laat alleen de stroom binnen het bereik, de laadschakelaar en niets anders door', () => {
    expect(isLaadCall('number', 'set_value', { value: 8 }, { entity_id: 'number.easee_stroom' }, mag)).toBe(true);
    expect(isLaadCall('number', 'set_value', { value: 20 }, { entity_id: 'number.easee_stroom' }, mag)).toBe(false);
    expect(isLaadCall('number', 'set_value', { value: 8 }, { entity_id: 'number.iets_anders' }, mag)).toBe(false);
    expect(isLaadCall('number', 'set_value', { value: 8, extra: 1 }, { entity_id: 'number.easee_stroom' }, mag)).toBe(false);
    expect(isLaadCall('switch', 'turn_off', {}, { entity_id: 'switch.easee_laden' }, mag)).toBe(true);
    expect(isLaadCall('switch', 'toggle', {}, { entity_id: 'switch.easee_laden' }, mag)).toBe(false);
    expect(isLaadCall('switch', 'turn_off', {}, { entity_id: 'switch.boiler' }, mag)).toBe(false);
    expect(isLaadCall('switch', 'turn_off', {}, { entity_id: 'switch.easee_laden', device_id: 'x' }, mag)).toBe(false);
    // Wat terug moet, mag terug: ook naar 0 A, zoals het stond.
    expect(isLaadCall('number', 'set_value', { value: 0 }, { entity_id: 'number.tesla_amps' }, mag)).toBe(true);
    // Een laadpaal die niet mag, gaat er niet door.
    const niet = laadMag([bedieningVan({ mag: false })], []);
    expect(isLaadCall('number', 'set_value', { value: 8 }, { entity_id: 'number.easee_stroom' }, niet)).toBe(false);
  });
});
