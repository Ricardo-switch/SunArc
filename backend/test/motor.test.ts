/*
 * De motor › Vandaag (23 november 2026): per kwartier wat de motor zou doen, wat er gebeurde en wat de oude regeling
 * deed, en één ronde terugkijken, uit het beslislogboek.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { motorDag, motorRonde } from '../src/web/motor.js';

const TZ = 'Europe/Amsterdam';
/** Een moment in de wintertijd van Amsterdam (UTC+1). */
const om = (dag: string, uur: number, min = 0, sec = 0) => Date.parse(`${dag}T${String(uur).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}+01:00`);
let dir = '';

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'motor-'));
  const gisteren = [
    // De avond ervoor: de motor wil de airco uit; dat geldt bij middernacht nog.
    { t: om('2026-11-21', 23, 50), changed: true, mode: 'nacht', accepted: [{ actuatorId: 'ac', action: 'off' }], commands: [], rejected: [], obs: { ac: 'off' }, legacy: 'Zon is onder', budget: { gridPowerW: 200 } },
  ];
  const vandaag = [
    { t: om('2026-11-22', 0, 5), changed: false, mode: 'nacht', budget: { gridPowerW: 190 } },
    // 08:00: de motor zou de airco aanzetten op zon; de oude regeling doet het al.
    { t: om('2026-11-22', 8, 0), changed: true, mode: 'dag', accepted: [{ actuatorId: 'ac', action: 'heat', strategyId: 'pv-surplus' }], commands: [{ kind: 'setAction', actuatorId: 'ac', action: 'heat' }], rejected: [{ intent: { actuatorId: 'bad', action: 'heat' }, blockedBy: 'insufficient_power_budget' }], obs: { ac: 'heat@21' }, legacy: 'PV-verwarmen actief: Woonkamer', zonW: 900, budget: { gridPowerW: -100 } },
    { t: om('2026-11-22', 8, 0, 15), changed: false, mode: 'dag', zonW: 920, budget: { gridPowerW: -120 } },
    { t: om('2026-11-22', 8, 0, 30), changed: false, mode: 'dag', zonW: 940, budget: { gridPowerW: -140 } },
  ];
  await writeFile(join(dir, 'decisions-2026-11-21.ndjson'), `${gisteren.map((x) => JSON.stringify(x)).join('\n')}\n`);
  await writeFile(join(dir, 'decisions-2026-11-22.ndjson'), `${vandaag.map((x) => JSON.stringify(x)).join('\n')}\nkapot{\n`);
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('De motor › Vandaag', () => {
  it('vat elk kwartier samen, met wat de motor van gisteren nog wilde', async () => {
    const d = (await motorDag(dir, '2026-11-22', TZ))!;
    expect(d.kwartieren).toHaveLength(96);
    expect(d.apparaten).toEqual(['ac']);
    // 00:05: het besluit van 23:50 de avond ervoor geldt nog.
    expect(d.kwartieren[0]).toMatchObject({ rondes: 1, netW: 190, oud: false, apparaten: { ac: { zou: 'off', zouDraaien: false, draaide: false } } });
    // 08:00: aan op zon, en de oude regeling deed het ook.
    expect(d.kwartieren[32]).toMatchObject({ rondes: 3, zonW: 920, netW: -120, oud: true, apparaten: { ac: { zou: 'heat', zouDraaien: true, draaide: true } } });
    expect(d.kwartieren[33]).toBeNull();
    expect(await motorDag(dir, '2026-11-25', TZ)).toBeNull();
  });

  it('geeft één ronde met het besluit dat toen gold, en de rondes ervoor en erna', async () => {
    const r = (await motorRonde(dir, om('2026-11-22', 8, 0, 20), TZ))!;
    expect(r.tMs).toBe(om('2026-11-22', 8, 0, 15));
    expect([r.n, r.van]).toEqual([2, 3]);
    expect(r.vorigeMs).toBe(om('2026-11-22', 8, 0));
    expect(r.volgendeMs).toBe(om('2026-11-22', 8, 0, 30));
    // Een korte ronde: de waarneming en de uitleg van de oude regeling van ervoor gelden nog.
    expect(r.meet).toMatchObject({ zonW: 920, obs: { ac: 'heat@21' }, legacy: 'PV-verwarmen actief: Woonkamer' });
    expect(r.besluit).toMatchObject({ vanMs: om('2026-11-22', 8, 0), accepted: [{ actuatorId: 'ac', action: 'heat' }], rejected: [{ blockedBy: 'insufficient_power_budget' }], commands: [] });
    // Voor de eerste ronde van de dag: het besluit van de avond ervoor.
    const vroeg = (await motorRonde(dir, om('2026-11-22', 0, 1), TZ))!;
    expect(vroeg.tMs).toBe(om('2026-11-22', 0, 5));
    expect(vroeg.besluit).toMatchObject({ vanMs: om('2026-11-21', 23, 50), accepted: [{ actuatorId: 'ac', action: 'off' }] });
    expect(await motorRonde(dir, om('2026-11-25', 8), TZ)).toBeNull();
  });
});
