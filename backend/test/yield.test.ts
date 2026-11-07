/**
 * Opbrengst om terug te kijken (besluit 102): meters en prijzen in de app, met
 * een import uit het Energie-dashboard, en de cijfers per periode uit de
 * statistiek van Home Assistant.
 */

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { HaClient } from '../src/adapters/homeassistant/client.js';
import { accuInPrefs, EnergyStore, importFromPrefs, isPrijsPerKwh, metTellersUitHA, meterRole, pricesInPrefs, validateEnergy, type EnergySettings, type EnergySource } from '../src/web/energy.js';
import { haEnergySource } from '../src/adapters/homeassistant/energy.js';
import { partsIn, zonedMidnight } from '../src/web/today.js';
import { periodRange, verdeel, yearStartOf, yieldReport } from '../src/web/yield.js';
import { goedkoopVandaag } from '../src/web/routes/opbrengst.js';
import { residentFlows } from '../src/web/resident.js';
import type { DecisionView } from '../src/web/assistant.js';

const TZ = 'Europe/Amsterdam';

/** Een dag in september: wat elke meter per uur telt, op het lokale uur. */
const HOURLY: Record<string, (h: number) => number> = {
  'sensor.afname': (h) => (h >= 10 && h < 17 ? 0 : 0.4),
  'sensor.terug': (h) => (h >= 10 && h < 17 ? 1 : 0),
  'sensor.zon': (h) => (h >= 10 && h < 17 ? 2 : 0),
  'sensor.airco': (h) => (h === 12 || h === 13 ? 0.5 : h === 20 ? 0.2 : 0),
  'sensor.gas': (h) => (h === 7 ? 0.2 : 0),
  // De kostentellers van Home Assistant bij een prijs per uur (testerronde, november 2026): 's nachts een negatieve prijs.
  'sensor.afname_cost': (h) => (h >= 10 && h < 17 ? 0 : 0.4) * (h < 7 ? -0.05 : 0.3),
  'sensor.terug_compensation': (h) => (h >= 10 && h < 17 ? 1 : 0) * 0.1,
  // De gaskosten zoals Home Assistant ze telt (issue 128): 0,2 m³ om 7 uur tegen 1,90.
  'sensor.gas_cost': (h) => (h === 7 ? 0.2 * 1.9 : 0),
  // Een thuisaccu (besluit 272): laadt van 10 tot 13 uur, levert 's avonds van 19 tot 22 uur.
  'sensor.accu_geladen': (h) => (h >= 10 && h < 13 ? 0.5 : 0),
  'sensor.accu_geleverd': (h) => (h >= 19 && h < 22 ? 0.4 : 0),
};
const daily = (id: string) => Array.from({ length: 24 }, (_, h) => HOURLY[id]!(h)).reduce((a, b) => a + b, 0);

/**
 * Een nep-Home Assistant: elke dag hetzelfde, maar een jaar eerder 80%. Per uur,
 * dag, week of maand, zoals de statistiek dat geeft.
 */
function fakeSource(): EnergySource & { calls: string[] } {
  const calls: string[] = [];
  const scale = (ms: number) => (partsIn(ms, TZ).y < 2026 ? 0.8 : 1);
  return {
    calls,
    async prefs() {
      return null;
    },
    async meters() {
      return [];
    },
    async changes(ids, startMs, endMs, period) {
      calls.push(period);
      const out: Record<string, { startMs: number; change: number }[]> = {};
      for (const id of ids) {
        // Een statistiek die Home Assistant niet heeft, komt niet terug.
        if (!HOURLY[id]) continue;
        const rows: { startMs: number; change: number }[] = [];
        if (period === 'hour') {
          for (let t = startMs; t < endMs; t += 3_600_000) rows.push({ startMs: t, change: HOURLY[id]!(partsIn(t, TZ).h) * scale(t) });
        } else {
          // Een rij per dag, week of maand, op middernacht in de tijdzone.
          let p = partsIn(startMs + 3 * 3_600_000, TZ);
          let t = zonedMidnight(p.y, p.m, p.d, TZ);
          while (t < endMs) {
            p = partsIn(t + 3 * 3_600_000, TZ);
            const next = period === 'day' ? zonedMidnight(p.y, p.m, p.d + 1, TZ) : period === 'week' ? zonedMidnight(p.y, p.m, p.d + 7, TZ) : zonedMidnight(p.y, p.m + 1, 1, TZ);
            const days = Math.round((next - t) / 86_400_000);
            rows.push({ startMs: t, change: daily(id) * days * scale(t) });
            t = next;
          }
        }
        out[id] = rows;
      }
      return out;
    },
  };
}

const SETTINGS: EnergySettings = {
  versie: 1,
  bron: 'zelf',
  net: { afname: ['sensor.afname'], teruglevering: ['sensor.terug'] },
  zon: ['sensor.zon'],
  gas: 'sensor.gas',
  apparaten: [{ id: 'sensor.airco', naam: 'Airco woonkamer' }],
  prijzen: { stroom: 0.25, teruglevering: null, gas: 1.3, vastPerMaand: null },
};

describe('een dag terugkijken', () => {
  it('rekent zon, net, gas en de apparaten uit, met zon per apparaat per uur', async () => {
    const now = Date.UTC(2026, 9, 7, 12);
    const r = (await yieldReport(fakeSource(), SETTINGS, 'dag', '2026-09-15', TZ, now))!;
    expect(r.periode).toMatchObject({ label: 'Dinsdag 15 september', vorige: '2026-09-14', volgende: '2026-09-16' });
    // 17 uur × 0,4 van het net, en 7 uur 1 kWh zelf gebruikt.
    expect(r.stroom).toEqual({ verbruikKwh: 13.8, eigenZonKwh: 7, vanNetKwh: 6.8, terugKwh: 7, eigenZonPct: 51, vorigeKwh: 13.8 });
    expect(r.zon).toMatchObject({ opgewektKwh: 14, zelfKwh: 7, terugKwh: 7, zelfPct: 50 });
    expect(r.gas).toEqual({ m3: 0.2, kwh: 2, vorigeM3: 0.2 });
    // De airco draaide twee uur op zon en een uur 's avonds op het net.
    expect(r.apparaten).toEqual([
      { id: 'sensor.airco', naam: 'Airco woonkamer', kwh: 1.2, zonKwh: 1, netKwh: 0.2, kosten: 0.05 },
      { id: 'rest', naam: 'Rest van het huis', kwh: 12.6, zonKwh: 6, netKwh: 6.6, kosten: 1.65, rest: true },
    ]);
    // De sankey telt op: zon is zelf gebruikt plus terug, net is van het net.
    const from = (src: string) => r.stromen.filter((s) => s.van === src).reduce((a, s) => a + s.kwh, 0);
    expect(from('zon')).toBeCloseTo(14);
    expect(from('net')).toBeCloseTo(6.8);
    expect(r.perBucket).toHaveLength(24);
    expect(r.perBucket[12]).toEqual({ label: '12', zonKwh: 1, netKwh: 0, gasM3: 0 });
    // Kosten: van het net min terug (gesaldeerd tegen dezelfde prijs) plus gas.
    expect(r.kosten.regels.map((x) => [x.naam, x.euro])).toEqual([
      ['Stroom van het net', 1.7],
      ['Teruggeleverd', -1.75],
      ['Gas', 0.26],
      ['Vaste kosten', null],
    ]);
    expect(r.kosten.totaal).toBe(0.21);
    expect(r.kosten.regels.map((x) => x.uitleg)).toEqual(['6,8 kWh × € 0,25', '7 kWh, gesaldeerd tegen je stroomprijs', '0,2 m³ × € 1,30', 'nog niet ingesteld']);
  });

  it('houdt zelf gebruikt plus terug gelijk aan opgewekt, ook als de zonnemeter een uur achterloopt', async () => {
    // De zonnemeter telt een uur later dan de meter van het net (opgelost 15 oktober).
    const bron = fakeSource();
    const echt = bron.changes.bind(bron);
    bron.changes = async (ids, startMs, endMs, period) => {
      const uit = await echt(ids, startMs, endMs, period);
      const zon = uit['sensor.zon'];
      return zon ? { ...uit, 'sensor.zon': zon.map((r) => ({ ...r, change: HOURLY['sensor.zon']!(partsIn(r.startMs, TZ).h - 1) })) } : uit;
    };
    const r = (await yieldReport(bron, SETTINGS, 'dag', '2026-09-15', TZ, Date.UTC(2026, 9, 7, 12)))!;
    expect(r.zon).toMatchObject({ opgewektKwh: 14, zelfKwh: 7, terugKwh: 7, zelfPct: 50 });
    const from = (src: string) => r.stromen.filter((s) => s.van === src).reduce((a, s) => a + s.kwh, 0);
    expect(from('zon')).toBeCloseTo(14);
  });

  it('neemt opgewekt uit de omvormer als de zonnemeter te weinig zegt (5 november 2026)', async () => {
    // De zonnemeter telt maar een kwart; de omvormer geeft per uur wat er echt was.
    const bron = fakeSource();
    const echt = bron.changes.bind(bron);
    bron.changes = async (ids, startMs, endMs, period) => {
      const uit = await echt(ids, startMs, endMs, period);
      const zon = uit['sensor.zon'];
      return zon ? { ...uit, 'sensor.zon': zon.map((r) => ({ ...r, change: r.change / 4 })) } : uit;
    };
    const zonder = (await yieldReport(bron, SETTINGS, 'dag', '2026-09-15', TZ, Date.UTC(2026, 9, 7, 12)))!;
    expect(zonder.zon!.opgewektKwh).toBe(3.5);
    bron.opgewekt = async (startMs, endMs) => {
      const rows: { startMs: number; change: number }[] = [];
      for (let t = startMs; t < endMs; t += 3_600_000) rows.push({ startMs: t, change: HOURLY['sensor.zon']!(partsIn(t, TZ).h) });
      return rows;
    };
    const r = (await yieldReport(bron, SETTINGS, 'dag', '2026-09-15', TZ, Date.UTC(2026, 9, 7, 12)))!;
    expect(r.zon).toMatchObject({ opgewektKwh: 14, zelfKwh: 7, terugKwh: 7, zelfPct: 50 });
  });

  it('vult uren zonder omvormer aan uit de zonnemeter: het vermogen staat er pas sinds de koppeling (5 november 2026)', async () => {
    // De omvormer heeft pas vanaf 12 uur een statistiek; daarvoor telt de zonnemeter.
    const bron = fakeSource();
    bron.opgewekt = async (startMs, endMs) => {
      const rows: { startMs: number; change: number }[] = [];
      for (let t = startMs; t < endMs; t += 3_600_000) if (partsIn(t, TZ).h >= 12) rows.push({ startMs: t, change: HOURLY['sensor.zon']!(partsIn(t, TZ).h) });
      return rows;
    };
    const r = (await yieldReport(bron, SETTINGS, 'dag', '2026-09-15', TZ, Date.UTC(2026, 9, 7, 12)))!;
    expect(r.zon).toMatchObject({ opgewektKwh: 14, zelfKwh: 7, terugKwh: 7, zelfPct: 50 });
  });

  it('zonder zonnepanelen geen zon, en alles van het net', async () => {
    const r = (await yieldReport(fakeSource(), { ...SETTINGS, zon: [], net: { afname: ['sensor.afname'], teruglevering: [] } }, 'dag', '2026-09-15', TZ, Date.UTC(2026, 9, 7)))!;
    expect(r.zon).toBeNull();
    expect(r.stroom).toMatchObject({ verbruikKwh: 6.8, eigenZonKwh: 0, eigenZonPct: null });
    expect(r.apparaten[0]).toMatchObject({ zonKwh: 0, netKwh: 1.2 });
  });
});

describe('panelen zonder slimme meter (besluit 196)', () => {
  const ZONDER = { ...SETTINGS, net: { afname: [], teruglevering: [] } };

  it('schat per uur wat je zelf gebruikte: eerst de apparaten met een meter en een gewoon huis, de rest naar het net', async () => {
    const r = (await yieldReport(fakeSource(), ZONDER, 'dag', '2026-09-15', TZ, Date.UTC(2026, 9, 7)))!;
    expect(r.geschat).toBe(true);
    expect(r.heeft.net).toBe(false);
    // Zeven zonuren van 2 kWh; vijf uur 0,4 (een gewoon huis), twee uur 0,4 + 0,5 airco.
    expect(r.zon).toMatchObject({ opgewektKwh: 14, zelfKwh: 3.8, terugKwh: 10.2, zelfPct: 27, bespaardEuro: 0.95 });
    // De airco draaide op zon; 's avonds is het net onbekend, dus alleen de zon in het schema.
    expect(r.apparaten[0]).toMatchObject({ zonKwh: 1, netKwh: 0.2 });
    expect(r.stromen.filter((s) => s.van === 'net')).toEqual([]);
    const zon = r.stromen.filter((s) => s.van === 'zon').reduce((a, s) => a + s.kwh, 0);
    expect(zon).toBeCloseTo(14);
  });

  it('rekent ook een jaar per uur, anders viel de zon weg tegen het verbruik van de hele dag', async () => {
    const bron = fakeSource();
    await yieldReport(bron, ZONDER, 'jaar', '2026-09-15', TZ, Date.UTC(2026, 9, 7));
    expect(bron.calls[0]).toBe('hour');
    const metMeter = fakeSource();
    await yieldReport(metMeter, SETTINGS, 'jaar', '2026-09-15', TZ, Date.UTC(2026, 9, 7));
    expect(metMeter.calls[0]).toBe('day');
  });

  it('zegt op Thuis wat er geschat over is, en geen net', () => {
    const snap = { atMs: 0, explanation: { solarProductionW: 1500, budget: { gridPowerW: 0, reclaimableW: 300, allocatedW: 0 } }, commands: [], accepted: [], rejected: [], observed: {} } as unknown as DecisionView;
    expect(residentFlows(snap, false)).toEqual({ zonKw: 1.5, netKw: null, verbruikKw: null, aircoKw: 0.3, huisKw: null, geplandKw: 0, overKw: 0.8, geschat: true });
    expect(residentFlows(snap)).toMatchObject({ netKw: 0, verbruikKw: 1.5 });
  });

  it('telt de thuisaccu mee in het verbruik van nu (besluit 272)', () => {
    const snap = { atMs: 0, explanation: { solarProductionW: 3000, budget: { gridPowerW: -500, reclaimableW: 0, allocatedW: 0 } }, commands: [], accepted: [], rejected: [], observed: {} } as unknown as DecisionView;
    // 3 kW zon, 0,5 terug, 1,5 in de accu: het huis gebruikt 1 kW.
    expect(residentFlows(snap, true, 1500)).toMatchObject({ zonKw: 3, netKw: -0.5, verbruikKw: 1, accuKw: 1.5 });
    // 's Avonds: 0,2 van het net en 1 kW uit de accu.
    const avond = { ...snap, explanation: { solarProductionW: 0, budget: { gridPowerW: 200, reclaimableW: 0, allocatedW: 0 } } } as unknown as DecisionView;
    expect(residentFlows(avond, true, -1000)).toMatchObject({ verbruikKw: 1.2, accuKw: -1 });
    // Zonder accu staat er niets van.
    expect(residentFlows(snap)).not.toHaveProperty('accuKw');
  });
});

describe('een dag met een thuisaccu (besluit 272)', () => {
  const MET = { ...SETTINGS, accu: { geladen: ['sensor.accu_geladen'], geleverd: ['sensor.accu_geleverd'], bron: 'sensoren' as const } };

  it('rekent wat de accu laadde en leverde mee in het verbruik en de eigen zon', async () => {
    const r = (await yieldReport(fakeSource(), MET, 'dag', '2026-09-15', TZ, Date.UTC(2026, 9, 7, 12)))!;
    // 13,8 zonder accu; 1,5 kWh ging de accu in, 1,2 kwam eruit.
    expect(r.stroom).toMatchObject({ verbruikKwh: 13.5, vanNetKwh: 6.8, terugKwh: 7, eigenZonKwh: 6.7, eigenZonPct: 50 });
    // Wat de zon niet terugleverde blijft 7 kWh, ook al ging een deel de accu in.
    expect(r.zon).toMatchObject({ zelfKwh: 7, zelfPct: 50 });
    expect(r.accu).toEqual({ geladenKwh: 1.5, geleverdKwh: 1.2, uitZonKwh: 1.5, uitNetKwh: 0, bron: 'sensoren' });
    // De airco draaide om 20 uur half op de accu.
    expect(r.apparaten[0]).toMatchObject({ id: 'sensor.airco', kwh: 1.2, zonKwh: 1.1, netKwh: 0.1, accuKwh: 0.1 });
    // De sankey telt op: zon is zelf plus terug, uit de accu is wat hij leverde, naar de accu wat hij laadde.
    const van = (src: string) => r.stromen.filter((s) => s.van === src).reduce((a, s) => a + s.kwh, 0);
    const naar = (doel: string) => r.stromen.filter((s) => s.naar === doel).reduce((a, s) => a + s.kwh, 0);
    expect(van('zon')).toBeCloseTo(14, 0);
    expect(van('accu')).toBeCloseTo(1.2, 1);
    expect(naar('naarAccu')).toBeCloseTo(1.5, 1);
    // Zonder accu-tellers alles zoals eerst.
    const zonder = (await yieldReport(fakeSource(), SETTINGS, 'dag', '2026-09-15', TZ, Date.UTC(2026, 9, 7, 12)))!;
    expect(zonder.accu).toBeNull();
    expect(zonder.stroom.verbruikKwh).toBe(13.8);
  });

  it('neemt de accu uit het Energie-dashboard van Home Assistant', () => {
    const prefs = { energy_sources: [{ type: 'grid', flow_from: [], flow_to: [] }, { type: 'battery', stat_energy_from: 'sensor.sessy_geleverd', stat_energy_to: 'sensor.sessy_geladen', stat_rate: 'sensor.sessy_power' }] };
    expect(accuInPrefs(prefs)).toEqual({ geladen: ['sensor.sessy_geladen'], geleverd: ['sensor.sessy_geleverd'], bron: 'dashboard' });
    expect(accuInPrefs({ energy_sources: [{ type: 'solar', stat_energy_from: 'sensor.zon' }] })).toBeNull();
    expect(accuInPrefs(null)).toBeNull();
  });
});

describe('de goedkope uren van vandaag (besluit 196)', () => {
  const prijzen = { stroom: 0.28, stroomDal: 0.24, dalUren: 'nl' as const };
  it('geeft per uur of het daluur is, ook op de dag met 25 uur', () => {
    // Zondag 25 oktober 2026: de wintertijd, en het weekend is helemaal dal.
    const zondag = goedkoopVandaag(TZ, prijzen, Date.UTC(2026, 9, 25, 10));
    expect(zondag.dal).toHaveLength(25);
    expect(zondag.dal.every(Boolean)).toBe(true);
    // Maandag: 's nachts tot 07:00 en vanaf 23:00.
    const maandag = goedkoopVandaag(TZ, prijzen, Date.UTC(2026, 9, 26, 10));
    expect(maandag.dal.map((d, h) => (d ? h : null)).filter((h) => h != null)).toEqual([0, 1, 2, 3, 4, 5, 6, 23]);
    expect(maandag).toMatchObject({ normaal: 0.28, dalPrijs: 0.24 });
    // Zonder daltarief niets.
    expect(goedkoopVandaag(TZ, { stroom: 0.28, stroomDal: null }, Date.UTC(2026, 9, 26, 10)).dal).toEqual([]);
  });
});

describe('een maand, en vergelijken', () => {
  it('geeft twaalf maanden met dezelfde maand een jaar eerder ernaast', async () => {
    const source = fakeSource();
    const r = (await yieldReport(source, SETTINGS, 'maand', '2026-09-20', TZ, Date.UTC(2026, 8, 25)))!;
    expect(r.periode).toMatchObject({ datum: '2026-09-01', label: 'September 2026', vorige: '2026-08-01', volgende: null, vorigeNaam: 'augustus' });
    expect(r.perBucket).toHaveLength(30);
    expect(r.zon?.besteDag).toEqual({ label: 'dinsdag 1 september', kwh: 14 });
    const stroom = r.vergelijk.stroom;
    expect(stroom.map((p) => p.label)).toEqual(['okt', 'nov', 'dec', 'jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep']);
    // September: 30 dagen van 13,8 kWh; een jaar eerder 80%.
    expect(stroom.at(-1)).toEqual({ label: 'sep', nu: 414, jaarEerder: 331.2 });
    expect(r.stroom.vorigeKwh).toBe(stroom.at(-2)!.nu);
    expect(r.vergelijk.gas.at(-1)).toEqual({ label: 'sep', nu: 6, jaarEerder: 4.8 });
    // Augustus had 31 dagen, september 30; een jaar eerder 80%.
    expect(r.verschil.stroom).toEqual({ vorige: { dan: 427.8, pct: -3 }, jaar: { dan: 331.2, pct: 25 } });
    expect(source.calls).toEqual(['hour', 'month']);
  });

  it('geeft oktober, met de wintertijd erin, één vak per dag', async () => {
    const r = (await yieldReport(fakeSource(), SETTINGS, 'maand', '2026-10-08', TZ, Date.UTC(2026, 9, 8, 12)))!;
    expect(r.perBucket.map((b) => b.label)).toEqual(Array.from({ length: 31 }, (_, i) => String(i + 1)));
  });

  it('noemt de periode, de vakken en de vergelijking in de taal van de app (besluit 185)', async () => {
    const r = (await yieldReport(fakeSource(), SETTINGS, 'maand', '2026-09-20', TZ, Date.UTC(2026, 8, 25), 'en'))!;
    expect(r.periode).toMatchObject({ label: 'September 2026', vorigeNaam: 'August' });
    expect(r.zon?.besteDag).toEqual({ label: 'Tuesday 1 September', kwh: 14 });
    expect(r.vergelijk.stroom.map((p) => p.label)).toEqual(['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']);
    expect(r.apparaten.at(-1)).toMatchObject({ id: 'rest', naam: 'Rest of the house' });
    expect(r.kosten.regels.find((x) => x.soort === 'vast')?.naam).toMatch(/^Fixed costs/);
    expect(periodRange('week', '2026-10-01', TZ, undefined, 'en')).toMatchObject({ label: 'Week 40 · 28 September – 4 October', prevName: 'last week' });
    expect(periodRange('dag', '2026-10-22', TZ, undefined, 'en')).toMatchObject({ label: 'Thursday 22 October', prevName: 'the day before' });
    expect(periodRange('jaar', '2026-06-01', TZ, yearStartOf('2024-03-15'), 'en')).toMatchObject({ label: '15 March 2026 – 14 March 2027', prevName: '2025/26' });
    // Een week: de vakken heten naar de dag.
    const week = (await yieldReport(fakeSource(), SETTINGS, 'week', '2026-09-16', TZ, Date.UTC(2026, 8, 25), 'en'))!;
    expect(week.perBucket.map((b) => b.label)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
  });

  it('kent dag, week, maand en jaar in de tijdzone van het huis, ook rond de wintertijd', () => {
    expect(periodRange('week', '2026-10-01', TZ)).toMatchObject({ label: 'Week 40 · 28 september – 4 oktober', prev: '2026-09-21', next: '2026-10-05' });
    const dst = periodRange('dag', '2026-10-25', TZ)!;
    expect(dst.endMs - dst.startMs).toBe(25 * 3_600_000);
    expect(periodRange('jaar', '2026-06-01', TZ)).toMatchObject({ label: '2026', startMs: Date.UTC(2025, 11, 31, 23) });
    expect(periodRange('maand', '2026-02-30', TZ)).toBeNull();
  });

  it('laat het jaar beginnen op de startdatum van het contract (besluit 116)', () => {
    const start = yearStartOf('2024-03-15');
    // 1 juni 2026 valt in het contractjaar van 15 maart 2026.
    expect(periodRange('jaar', '2026-06-01', TZ, start)).toMatchObject({
      label: '15 maart 2026 – 14 maart 2027',
      startMs: Date.UTC(2026, 2, 14, 23),
      endMs: Date.UTC(2027, 2, 14, 23),
      prev: '2025-03-15',
      next: '2027-03-15',
      prevName: '2025/26',
    });
    // Vóór 15 maart hoort een dag bij het jaar ervoor.
    expect(periodRange('jaar', '2026-03-14', TZ, start)).toMatchObject({ prev: '2024-03-15' });
    // Zonder datum: het kalenderjaar; een 29 februari wordt 1 maart.
    expect(yearStartOf(null)).toEqual({ m: 1, d: 1 });
    expect(yearStartOf('2024-02-29')).toEqual({ m: 3, d: 1 });
  });

  it('zegt vanaf wanneer er gemeten is, en telt de vaste kosten alleen over die dagen', async () => {
    const vol = fakeSource();
    // Home Assistant heeft pas historie vanaf 1 maart 2026.
    const vanaf = Date.UTC(2026, 1, 28, 23);
    const laat: EnergySource = {
      ...vol,
      async changes(ids, startMs, endMs, period) {
        const rows = await vol.changes(ids, startMs, endMs, period);
        return Object.fromEntries(Object.entries(rows).map(([id, r]) => [id, r.filter((x) => x.startMs >= vanaf)]));
      },
    };
    const settings = { ...SETTINGS, prijzen: { ...SETTINGS.prijzen, vast: [{ naam: 'Netbeheer', bedrag: 1, per: 'dag' as const, soort: 'stroom' as const }] } };
    const r = (await yieldReport(laat, settings, 'jaar', '2026-06-01', TZ, Date.UTC(2027, 0, 5)))!;
    expect(r.dekking).toEqual({ vanaf: '2026-03-01', dagen: 306, vanDagen: 365 });
    expect(r.kosten.regels.find((x) => x.naam === 'Vaste kosten stroom')?.euro).toBe(306);
    // Een hele gemeten periode heeft geen dekking nodig.
    expect((await yieldReport(fakeSource(), settings, 'maand', '2026-09-20', TZ, Date.UTC(2026, 9, 1)))!.dekking).toBeNull();
  });

  it('telt de grafiek van een contractjaar vanaf zijn eigen maand', async () => {
    const r = (await yieldReport(fakeSource(), { ...SETTINGS, prijzen: { ...SETTINGS.prijzen, contractStart: '2025-07-01' } }, 'jaar', '2026-09-15', TZ, Date.UTC(2026, 8, 20)))!;
    expect(r.periode.label).toBe('1 juli 2026 – 30 juni 2027');
    expect(r.perBucket.map((b) => b.label).slice(0, 3)).toEqual(['jul', 'aug', 'sep']);
    expect(r.vergelijk.stroom.at(-1)?.label).toBe('2026/27');
  });
});

describe('meters en prijzen in de app', () => {
  const prefs = {
    energy_sources: [
      {
        type: 'grid',
        flow_from: [
          { stat_energy_from: 'sensor.p1_meter_energy_import_tariff_1', number_energy_price: 0.27 },
          { stat_energy_from: 'sensor.p1_meter_energy_import_tariff_2', entity_energy_price: 'sensor.prijs' },
        ],
        flow_to: [{ stat_energy_to: 'sensor.p1_meter_energy_export_tariff_1', number_energy_price: null }],
      },
      { type: 'solar', stat_energy_from: 'sensor.solaredge_lifetime_energy' },
      { type: 'gas', stat_energy_from: 'sensor.gas_meter_gas', number_energy_price: 1.25 },
      { type: 'battery', stat_energy_from: 'sensor.accu_uit', stat_energy_to: 'sensor.accu_in' },
    ],
    device_consumption: [{ stat_consumption: 'sensor.airconditioning_woonkamer_energie_kwh' }, { stat_consumption: 'sensor.samsung_oled_energie', name: 'Tv' }],
  };

  it('neemt het Energie-dashboard van Home Assistant over, met namen uit de statistiek', () => {
    const s = importFromPrefs(prefs, [{ id: 'sensor.airconditioning_woonkamer_energie_kwh', naam: 'Airco woonkamer energie', soort: 'energy' }]);
    expect(s).toEqual({
      versie: 1,
      bron: 'home-assistant',
      net: {
        afname: ['sensor.p1_meter_energy_import_tariff_1', 'sensor.p1_meter_energy_import_tariff_2'],
        teruglevering: ['sensor.p1_meter_energy_export_tariff_1'],
        // Tarief 1 van de slimme meter is het daltarief (besluit 110).
        dal: ['sensor.p1_meter_energy_import_tariff_1', 'sensor.p1_meter_energy_export_tariff_1'],
      },
      zon: ['sensor.solaredge_lifetime_energy'],
      gas: 'sensor.gas_meter_gas',
      apparaten: [
        { id: 'sensor.airconditioning_woonkamer_energie_kwh', naam: 'Airco woonkamer energie' },
        { id: 'sensor.samsung_oled_energie', naam: 'Tv' },
      ],
      // Tarief 2 heeft een prijs uit een entiteit: dan de kostentellers van beide tarieven (testerronde, november 2026).
      prijzen: { stroom: 0.27, teruglevering: null, gas: 1.25, vastPerMaand: null, dynamisch: { prijsEntiteit: 'sensor.prijs', afname: ['sensor.p1_meter_energy_import_tariff_1_cost', 'sensor.p1_meter_energy_import_tariff_2_cost'], terug: [], gas: 'sensor.gas_meter_gas_cost' } },
    });
    expect(importFromPrefs(null)).toBeNull();
    expect(importFromPrefs({ energy_sources: 'x' })).toBeNull();
  });

  it('raadt de rol van een meter, zodat elke lijst eerst toont wat past', () => {
    // De meters van dit huis, zoals Home Assistant ze op 7 oktober gaf.
    const cases: [string, string, string | null, string][] = [
      ['sensor.p1_meter_energy_import_tariff_1', 'P1 Meter Energie import tarief 1', 'homewizard', 'afname'],
      ['sensor.p1_meter_energy_export_tariff_2', 'P1 Meter Energie export tarief 2', 'homewizard', 'teruglevering'],
      ['sensor.solaredge_produced_energy', 'SolarEdge Produced energy', 'solaredge', 'zon'],
      ['sensor.solaredge_lifetime_energy', 'SolarEdge Lifetime energy', 'solaredge', 'zon'],
      ['sensor.solaredge_self_consumed_energy', 'SolarEdge Self consumed energy', 'solaredge', 'periode'],
      ['sensor.solaredge_imported_energy', 'SolarEdge Imported energy', 'solaredge', 'periode'],
      ['sensor.airconditioning_woonkamer_energie_kwh', 'Airco woonkamer totaal (kWh)', 'integration', 'apparaat'],
      ['sensor.samsung_oled_power_energy', 'Samsung_OLED Power energy', 'smartthings', 'apparaat'],
      ['sensor.samsung_oled_energie_bespaard', 'Samsung_OLED Energie bespaard', 'smartthings', 'periode'],
      ['sensor.gratis_airco_kwh_maand', 'Gratis airco stroom deze maand (kWh)', 'utility_meter', 'periode'],
      ['sensor.airconditioning_totaal_energie', "Airco's gecombineerd totaal (kWh)", 'template', 'periode'],
      ['sensor.energy_production_today', 'Energy production today', 'forecast_solar', 'periode'],
    ];
    for (const [id, naam, platform, rol] of cases) expect(meterRole(id, naam, 'energy', platform), naam).toBe(rol);
    expect(meterRole('sensor.gas_meter_gas', 'Gas meter Gas', 'volume', 'homewizard')).toBe('gas');
  });

  it('zegt per meter waar het dashboard zijn prijs vandaan haalt', () => {
    const p = { energy_sources: [{ type: 'grid', flow_from: [{ stat_energy_from: 'sensor.a', stat_cost: 'sensor.a_kosten', number_energy_price: null, entity_energy_price: null }], flow_to: [{ stat_energy_to: 'sensor.t', number_energy_price: 0.09 }] }] };
    expect(pricesInPrefs(p)).toEqual([
      { soort: 'afname', meter: 'sensor.a', prijs: null, prijsEntiteit: null, kostenMeter: 'sensor.a_kosten', kostenIsMeter: false },
      { soort: 'teruglevering', meter: 'sensor.t', prijs: 0.09, prijsEntiteit: null, kostenMeter: null, kostenIsMeter: false },
    ]);
  });

  it('leest de nieuwe opbouw van het dashboard: een netbron per tarief, met de prijs van teruglevering apart', () => {
    // Zoals Home Assistant het op 7 oktober in dit huis gaf, met prijzen erbij.
    const p = {
      energy_sources: [
        {
          type: 'grid',
          stat_energy_from: 'sensor.p1_meter_energy_import_tariff_2',
          stat_cost: 'sensor.p1_meter_energy_import_tariff_2',
          entity_energy_price: null,
          number_energy_price: null,
          stat_energy_to: 'sensor.p1_meter_energy_export_tariff_1',
          stat_compensation: 'sensor.p1_meter_energy_export_tariff_1',
          number_energy_price_export: 0.07,
        },
        { type: 'grid', stat_energy_from: 'sensor.p1_meter_energy_import_tariff_1', number_energy_price: 0.27, stat_energy_to: 'sensor.p1_meter_energy_export_tariff_2' },
        { type: 'gas', stat_energy_from: 'sensor.gas_meter_gas', stat_cost: 'sensor.gas_meter_gas' },
      ],
    };
    const s = importFromPrefs(p)!;
    expect(s.net).toEqual({
      afname: ['sensor.p1_meter_energy_import_tariff_2', 'sensor.p1_meter_energy_import_tariff_1'],
      teruglevering: ['sensor.p1_meter_energy_export_tariff_1', 'sensor.p1_meter_energy_export_tariff_2'],
      dal: ['sensor.p1_meter_energy_import_tariff_1', 'sensor.p1_meter_energy_export_tariff_1'],
    });
    expect(s.prijzen).toEqual({ stroom: 0.27, teruglevering: 0.07, gas: null, vastPerMaand: null });
    const why = pricesInPrefs(p);
    expect(why.filter((x) => x.kostenIsMeter).map((x) => x.soort)).toEqual(['afname', 'teruglevering', 'gas']);
    expect(why.find((x) => x.meter === 'sensor.p1_meter_energy_export_tariff_1')?.prijs).toBe(0.07);
  });

  it('neemt een prijs uit een entiteit over met de stand van nu', () => {
    const only = { energy_sources: [{ type: 'grid', flow_from: [{ stat_energy_from: 'sensor.afname', entity_energy_price: 'input_number.stroomprijs' }] }, { type: 'gas', stat_energy_from: 'sensor.gas', entity_energy_price: 'input_number.gasprijs' }] };
    const prices: Record<string, number> = { 'input_number.stroomprijs': 0.2899, 'input_number.gasprijs': 1.31 };
    expect(importFromPrefs(only, [], (id) => prices[id] ?? null)?.prijzen).toEqual({ stroom: 0.2899, teruglevering: null, gas: 1.31, vastPerMaand: null, dynamisch: { prijsEntiteit: 'input_number.stroomprijs', afname: ['sensor.afname_cost'], terug: [], gas: 'sensor.gas_cost' } });
  });

  it('bewaart alleen meters en redelijke bedragen, en houdt ze over een herstart', async () => {
    expect(validateEnergy({ ...SETTINGS, zon: ['geen meter'] })).toMatchObject({ ok: false });
    expect(validateEnergy({ ...SETTINGS, prijzen: { stroom: 25 } })).toMatchObject({ ok: false });
    expect(validateEnergy({ ...SETTINGS, apparaten: [{ id: 'sensor.x', naam: '' }] })).toMatchObject({ ok: false });
    expect(validateEnergy({ ...SETTINGS, prijzen: { ...SETTINGS.prijzen, contractStart: '2025-02-30' } })).toMatchObject({ ok: false });
    expect(validateEnergy({ ...SETTINGS, prijzen: { ...SETTINGS.prijzen, contractStart: '2025-03-15' } })).toMatchObject({ ok: true, settings: { prijzen: { contractStart: '2025-03-15' } } });
    const dir = await mkdtemp(join(tmpdir(), 'hems-energie-'));
    const store = new EnergyStore(dir);
    expect(await store.load()).toBeNull();
    const saved = await store.save(SETTINGS);
    expect(saved).toMatchObject({ ok: true, settings: { ...SETTINGS, prijzen: SETTINGS.prijzen } });
    const again = new EnergyStore(dir);
    expect(await again.load()).toEqual(saved.ok ? saved.settings : null);
  });

  it('leest uit Home Assistant alleen wat op de lijst staat, en geeft nergens anders velden aan mee', async () => {
    const client = new HaClient({ url: 'http://127.0.0.1:1', token: 'x' });
    await expect(client.query('call_service', { domain: 'light' })).rejects.toThrow(/niet op de lijst/);
    await expect(client.query('get_config', { extra: 1 })).rejects.toThrow(/geen velden/);
    await expect(client.query('energy/get_prefs', { extra: 1 })).rejects.toThrow(/geen velden/);
  });
});

describe('zonder salderen (besluit 178)', () => {
  it('telt teruglevering dan meteen zonder salderen, ook voor 2027', () => {
    const van = Date.UTC(2026, 5, 1);
    const tot = Date.UTC(2026, 5, 2);
    const met = verdeel(SETTINGS, 10, null, 4, null, van, tot, 'Europe/Amsterdam');
    expect(met.terugNa).toBe(0);
    const zonder = verdeel({ ...SETTINGS, prijzen: { ...SETTINGS.prijzen, salderen: false } }, 10, null, 4, null, van, tot, 'Europe/Amsterdam');
    expect(zonder).toMatchObject({ terugNormaal: 0, terugDal: 0, terugNa: 4 });
  });

  it('bewaart eigen daltijden en geen salderen, en weigert wat niet klopt', () => {
    const p = SETTINGS.prijzen;
    expect(validateEnergy({ ...SETTINGS, prijzen: { ...p, dalUren: 'eigen', dalEigen: { van: 22, tot: 6, weekend: false }, salderen: false } })).toMatchObject({ ok: true, settings: { prijzen: { dalUren: 'eigen', dalEigen: { van: 22, tot: 6, weekend: false }, salderen: false } } });
    expect(validateEnergy({ ...SETTINGS, prijzen: { ...p, dalUren: 'eigen', dalEigen: { van: 6, tot: 6, weekend: false } } })).toMatchObject({ ok: false });
    expect(validateEnergy({ ...SETTINGS, prijzen: { ...p, dalUren: 'eigen' } })).toMatchObject({ ok: false });
    expect(validateEnergy({ ...SETTINGS, prijzen: { ...p, salderen: 'ja' } })).toMatchObject({ ok: false });
  });
});

describe('een prijs per uur (testerronde, november 2026)', () => {
  it('neemt bij een prijs-entiteit de kostentellers van Home Assistant over', () => {
    const prefs = { energy_sources: [{ type: 'grid', flow_from: [{ stat_energy_from: 'sensor.afname', entity_energy_price: 'sensor.zonneplan_current_electricity_tariff', stat_cost: null }], flow_to: [{ stat_energy_to: 'sensor.terug', entity_energy_price: 'sensor.zonneplan_current_electricity_tariff' }] }] };
    const v = importFromPrefs(prefs, [], () => 0.23)!;
    expect(v.prijzen.stroom).toBe(0.23);
    expect(v.prijzen.dynamisch).toEqual({ prijsEntiteit: 'sensor.zonneplan_current_electricity_tariff', afname: ['sensor.afname_cost'], terug: ['sensor.terug_compensation'] });
    // Bewaren laat hem staan; een vaste prijs heeft er geen.
    const ok = validateEnergy(v);
    expect(ok.ok && ok.settings.prijzen.dynamisch).toEqual(v.prijzen.dynamisch);
    expect(importFromPrefs({ energy_sources: [{ type: 'grid', flow_from: [{ stat_energy_from: 'sensor.afname', number_energy_price: 0.25 }] }] })!.prijzen.dynamisch).toBeUndefined();
  });

  // Issue 119: een eigen kostensensor (zoals Tibber er een geeft) telt al per uur, ook zonder prijs erbij.
  it('neemt een eigen kostensensor over, ook zonder prijs', () => {
    const prefs = { energy_sources: [{ type: 'grid', stat_energy_from: 'sensor.tibber_afname', stat_cost: 'sensor.tibber_kosten', stat_energy_to: 'sensor.tibber_terug', stat_compensation: 'sensor.tibber_opbrengst' }] };
    const v = importFromPrefs(prefs)!;
    expect(v.prijzen.dynamisch).toEqual({ prijsEntiteit: null, afname: ['sensor.tibber_kosten'], terug: ['sensor.tibber_opbrengst'] });
    expect(validateEnergy(v).ok).toBe(true);
    // Twee tarieven, maar maar één met een teller: dan rekent Opbrengst zelf, zoals eerst.
    const half = { energy_sources: [{ type: 'grid', flow_from: [{ stat_energy_from: 'sensor.t1', stat_cost: 'sensor.t1_kosten' }, { stat_energy_from: 'sensor.t2' }] }] };
    expect(importFromPrefs(half)!.prijzen.dynamisch).toBeUndefined();
  });

  it('vindt de sensoren met een prijs per kWh, de prijs van nu eerst', () => {
    expect(['€/kWh', 'EUR/kWh', ' eur / kwh', 'SEK/kWh', '$/kWh'].every(isPrijsPerKwh)).toBe(true);
    expect(['ct/kWh', 'kWh', 'W', '€', '€/m³', null].some(isPrijsPerKwh)).toBe(false);
    const staat = (entity_id: string, state: string, unit: string, naam: string) => ({ entity_id, state, attributes: { unit_of_measurement: unit, friendly_name: naam }, last_changed: '', last_updated: '' });
    const alle = [
      staat('sensor.zonneplan_gemiddelde_prijs', '0.21', '€/kWh', 'Zonneplan gemiddelde prijs'),
      staat('sensor.zonneplan_current_electricity_tariff', '0.2311', '€/kWh', 'Zonneplan huidige stroomprijs'),
      staat('sensor.stroomprijs_cent', '23', 'ct/kWh', 'Stroomprijs in cent'),
      staat('sensor.p1_vermogen', '210', 'W', 'P1 vermogen'),
      staat('input_number.prijs', '0.25', '€/kWh', 'Vaste prijs'),
    ];
    const bron = haEnergySource({} as HaClient, (id) => alle.find((s) => s.entity_id === id), () => null, () => alle);
    expect(bron.prijsSensoren!()).toEqual([
      { id: 'sensor.zonneplan_current_electricity_tariff', naam: 'Zonneplan huidige stroomprijs', prijs: 0.2311 },
      { id: 'sensor.zonneplan_gemiddelde_prijs', naam: 'Zonneplan gemiddelde prijs', prijs: 0.21 },
    ]);
  });

  it('rekent de stroom en de teruglevering zoals Home Assistant ze telde, ook met een negatieve prijs', async () => {
    const dyn = { ...SETTINGS, prijzen: { ...SETTINGS.prijzen, dynamisch: { prijsEntiteit: 'sensor.prijs', afname: ['sensor.afname_cost'], terug: ['sensor.terug_compensation'] } } };
    const r = (await yieldReport(fakeSource(), dyn, 'dag', '2026-09-15', TZ, Date.UTC(2026, 9, 7, 12)))!;
    const stroom = r.kosten.regels.find((x) => x.soort === 'stroom')!;
    const terug = r.kosten.regels.find((x) => x.soort === 'terug')!;
    // Zeven nachturen 0,4 kWh tegen -0,05, tien uren tegen 0,30; zeven uren 1 kWh terug tegen 0,10.
    expect(stroom.euro).toBeCloseTo(1.06, 2);
    expect(stroom.uitleg).toContain('met de prijs van elk uur');
    expect(terug.euro).toBeCloseTo(-0.7, 2);
    // Het gas blijft met zijn eigen prijs.
    expect(r.kosten.regels.find((x) => x.soort === 'gas')!.euro).toBeCloseTo(0.26, 2);
  });

  /*
   * Issue 126: bij een prijs per uur is een vaste stroomprijs niet nodig. Telt
   * Home Assistant de teruglevering niet per uur, dan telt die gesaldeerd
   * tegen de gemiddelde uurprijs van de periode, niet als "prijs ontbreekt".
   */
  it('rekent zonder vaste stroomprijs, en de teruglevering tegen de gemiddelde uurprijs', async () => {
    const dyn = { ...SETTINGS, prijzen: { ...SETTINGS.prijzen, stroom: null, gas: null, dynamisch: { prijsEntiteit: 'sensor.prijs', afname: ['sensor.afname_cost'], terug: [] } } };
    const r = (await yieldReport(fakeSource(), dyn, 'dag', '2026-09-15', TZ, Date.UTC(2026, 9, 7, 12)))!;
    expect(r.heeft.prijzen).toBe(true);
    expect(r.kosten.regels.find((x) => x.soort === 'stroom')!.euro).toBeCloseTo(1.06, 2);
    // 1,06 euro voor 6,8 kWh van het net: gemiddeld 0,156 per kWh, en 7 kWh terug.
    const terug = r.kosten.regels.find((x) => x.soort === 'terug')!;
    expect(terug.euro).toBeCloseTo(-(7 * 1.06) / 6.8, 2);
    expect(r.kosten.totaal).toBeCloseTo(1.06 - (7 * 1.06) / 6.8, 2);
    // Ook de vergelijking met eerdere dagen rekent met de tellers, niet met alleen het gas.
    expect(r.vergelijk.kosten.at(-1)!.nu).toBeCloseTo(1.06 - (7 * 1.06) / 6.8, 1);
  });
});

/*
 * Issue 128 (Erik, Zonneplan): Opbrengst gaf € 15,27 waar Home Assistant € 7,51
 * zei. Bij een prijs per uur vond SunArc de kostentellers niet, en zonder vaste
 * stroomprijs telden stroom en teruglevering stil als nul; het gas telde tegen
 * één vaste prijs, terwijl Home Assistant de gasprijs van elke dag nam.
 */
describe('kosten zoals Home Assistant ze telt (issue 128)', () => {
  const nu = Date.UTC(2026, 9, 7, 12);

  it('zegt wat er zonder prijs als nul telt, in plaats van het stil weg te laten', async () => {
    const kwijt = { ...SETTINGS, prijzen: { ...SETTINGS.prijzen, stroom: null, dynamisch: { prijsEntiteit: 'sensor.prijs', afname: ['sensor.weg_cost'], terug: [] } } };
    const r = (await yieldReport(fakeSource(), kwijt, 'dag', '2026-09-15', TZ, nu))!;
    expect(r.kosten.regels.find((x) => x.soort === 'stroom')!.euro).toBeNull();
    // Alleen het gas telt, en de pagina zegt dat stroom en teruglevering ontbreken.
    expect(r.kosten.totaal).toBeCloseTo(0.26, 2);
    expect(r.kosten.zonderPrijs).toEqual(['stroom', 'terug']);
    // Met de tellers ontbreekt er niets.
    const goed = { ...SETTINGS, prijzen: { ...SETTINGS.prijzen, dynamisch: { prijsEntiteit: 'sensor.prijs', afname: ['sensor.afname_cost'], terug: ['sensor.terug_compensation'] } } };
    expect((await yieldReport(fakeSource(), goed, 'dag', '2026-09-15', TZ, nu))!.kosten.zonderPrijs).toEqual([]);
  });

  it('telt bij een prijs per uur ook het gas zoals Home Assistant het telt', async () => {
    const dyn = { ...SETTINGS, prijzen: { ...SETTINGS.prijzen, gas: 3.2, dynamisch: { prijsEntiteit: 'sensor.prijs', afname: ['sensor.afname_cost'], terug: ['sensor.terug_compensation'], gas: 'sensor.gas_cost' } } };
    const r = (await yieldReport(fakeSource(), dyn, 'dag', '2026-09-15', TZ, nu))!;
    const gas = r.kosten.regels.find((x) => x.soort === 'gas')!;
    // 0,2 m³ tegen 1,90 uit Home Assistant, niet tegen de 3,20 bij Contract en prijzen.
    expect(gas.euro).toBeCloseTo(0.38, 2);
    expect(gas.uitleg).toBe('0,2 m³, zoals Home Assistant telt');
    expect(r.kosten.totaal).toBeCloseTo(1.06 - 0.7 + 0.38, 2);
    expect(r.vergelijk.kosten.at(-1)!.nu).toBeCloseTo(1.06 - 0.7 + 0.38, 1);
    // Ook zonder gasprijs in de app.
    const zonder = { ...dyn, prijzen: { ...dyn.prijzen, gas: null } };
    expect((await yieldReport(fakeSource(), zonder, 'dag', '2026-09-15', TZ, nu))!.kosten.zonderPrijs).toEqual([]);
  });

  it('neemt de namen van de kostentellers zoals Home Assistant ze geeft', () => {
    const prefs = {
      energy_sources: [
        { type: 'grid', stat_energy_from: 'sensor.afname', entity_energy_price: 'sensor.zonneplan_current_electricity_tariff', stat_energy_to: 'sensor.terug', entity_energy_price_export: 'sensor.zonneplan_current_electricity_tariff' },
        { type: 'gas', stat_energy_from: 'sensor.gas', entity_energy_price: 'sensor.zonneplan_current_gas_tariff' },
      ],
    };
    const kosten = { 'sensor.afname': 'sensor.afname_cost_2', 'sensor.terug': 'sensor.terug_compensation', 'sensor.gas': 'sensor.gas_cost' };
    expect(importFromPrefs(prefs, [], () => 0.23, kosten)!.prijzen.dynamisch).toEqual({
      prijsEntiteit: 'sensor.zonneplan_current_electricity_tariff',
      afname: ['sensor.afname_cost_2'],
      terug: ['sensor.terug_compensation'],
      gas: 'sensor.gas_cost',
    });
    // Maakt Home Assistant er geen (zoals bij een externe statistiek), dan is er geen prijs per uur om over te nemen.
    expect(importFromPrefs(prefs, [], () => 0.23, { 'sensor.gas': 'sensor.gas_cost' })!.prijzen.dynamisch).toBeUndefined();
    // De gasprijs is niet de stroomprijs: alleen een gasprijs uit een entiteit maakt geen prijs per uur.
    const alleenGas = { energy_sources: [{ type: 'gas', stat_energy_from: 'sensor.gas', entity_energy_price: 'sensor.zonneplan_current_gas_tariff' }, { type: 'grid', stat_energy_from: 'sensor.afname', number_energy_price: 0.25 }] };
    expect(importFromPrefs(alleenGas, [], () => 1.3)!.prijzen.dynamisch).toBeUndefined();
  });

  it('werkt bewaarde tellers bij met wat Home Assistant nu heeft', async () => {
    const oud = { ...SETTINGS, prijzen: { ...SETTINGS.prijzen, dynamisch: { prijsEntiteit: 'sensor.prijs', afname: ['sensor.afname_cost'], terug: [] } } };
    const prefs = { energy_sources: [{ type: 'grid', stat_energy_from: 'sensor.afname', entity_energy_price: 'sensor.prijs', stat_energy_to: 'sensor.terug', entity_energy_price_export: 'sensor.prijs' }, { type: 'gas', stat_energy_from: 'sensor.gas', entity_energy_price: 'sensor.gasprijs' }] };
    const bron = (kosten: Record<string, string> | null): EnergySource => ({ ...fakeSource(), prefs: async () => prefs, kostenTellers: async () => kosten });
    const nieuw = await metTellersUitHA(bron({ 'sensor.afname': 'sensor.afname_cost_2', 'sensor.terug': 'sensor.terug_compensation', 'sensor.gas': 'sensor.gas_cost' }), oud);
    expect(nieuw.prijzen.dynamisch).toEqual({ prijsEntiteit: 'sensor.prijs', afname: ['sensor.afname_cost_2'], terug: ['sensor.terug_compensation'], gas: 'sensor.gas_cost' });
    // Een ander gas in de app dan in het dashboard: dan niet de gasteller van het dashboard.
    const anderGas = await metTellersUitHA(bron({ 'sensor.afname': 'sensor.afname_cost', 'sensor.gas': 'sensor.gas_cost' }), { ...oud, gas: 'sensor.ander_gas' });
    expect(anderGas.prijzen.dynamisch?.gas).toBeUndefined();
    // Vindt Home Assistant niets, of geeft hij een fout, dan blijft wat bewaard is.
    expect((await metTellersUitHA(bron({}), oud)).prijzen.dynamisch).toEqual(oud.prijzen.dynamisch);
    expect((await metTellersUitHA({ ...bron(null), prefs: async () => Promise.reject(new Error('weg')) }, oud)).prijzen.dynamisch).toEqual(oud.prijzen.dynamisch);
    // Zonder prijs per uur verandert er niets.
    expect(await metTellersUitHA(bron(null), SETTINGS)).toBe(SETTINGS);
  });

  it('bewaart de gasteller, en weigert er een die geen entiteit is', () => {
    const dyn = { prijsEntiteit: 'sensor.prijs', afname: ['sensor.afname_cost'], terug: [], gas: 'sensor.gas_cost' };
    const ok = validateEnergy({ ...SETTINGS, prijzen: { ...SETTINGS.prijzen, dynamisch: dyn } });
    expect(ok.ok && ok.settings.prijzen.dynamisch).toEqual(dyn);
    expect(validateEnergy({ ...SETTINGS, prijzen: { ...SETTINGS.prijzen, dynamisch: { ...dyn, gas: 'geen entiteit' } } }).ok).toBe(false);
  });

  /** Home Assistant telt de kosten pas vanaf `vanMs`: de kostentellers hebben daarvoor geen rijen. */
  const telVanaf = (vanMs: number): EnergySource => {
    const bron = fakeSource();
    return {
      ...bron,
      async changes(ids, startMs, endMs, period) {
        const uit = await bron.changes(ids, startMs, endMs, period);
        return Object.fromEntries(Object.entries(uit).map(([id, rijen]) => [id, /_cost|_compensation/.test(id) ? rijen.filter((r) => r.startMs >= vanMs) : rijen]));
      },
    };
  };
  const perUur = { ...SETTINGS, prijzen: { ...SETTINGS.prijzen, stroom: null, dynamisch: { prijsEntiteit: 'sensor.prijs', afname: ['sensor.afname_cost'], terug: ['sensor.terug_compensation'] } } };

  it('telt de uren waarin Home Assistant nog niet telde tegen het gemiddelde, en zegt dat het deels geschat is', async () => {
    // Pas vanaf 12 uur 's middags: 's ochtends 7 uur × 0,4 kWh tegen -0,05 en 3 uur tegen 0,30 vallen erbuiten.
    const r = (await yieldReport(telVanaf(zonedMidnight(2026, 9, 15, TZ) + 12 * 3_600_000), perUur, 'dag', '2026-09-15', TZ, nu))!;
    const stroom = r.kosten.regels.find((x) => x.soort === 'stroom')!;
    // Geteld: 7 avonduren × 0,4 kWh tegen 0,30 = 0,84 voor 2,8 kWh; de andere 4 kWh tegen dat gemiddelde (0,30).
    expect(stroom.euro).toBeCloseTo(0.84 + 4 * 0.3, 2);
    expect(stroom.uitleg).toBe('2,8 kWh, met de prijs van elk uur, zoals Home Assistant telt; 4 kWh geschat tegen je gemiddelde');
    // De teruglevering telde Home Assistant vanaf 12 uur helemaal (10 tot 17 uur: 5 van de 7 uren); de rest gesaldeerd tegen 0,30.
    const terug = r.kosten.regels.find((x) => x.soort === 'terug')!;
    expect(terug.euro).toBeCloseTo(-(5 * 0.1) - 2 * 0.3, 2);
    expect(r.kosten.geschat).toEqual(['stroom', 'terug']);
    expect(r.kosten.zonderPrijs).toEqual([]);
    // Telt Home Assistant de hele dag, dan is er niets geschat.
    expect((await yieldReport(fakeSource(), perUur, 'dag', '2026-09-15', TZ, nu))!.kosten.geschat).toEqual([]);
  });

  it('rekent een maand waarin Home Assistant halverwege begon te tellen ook in de vergelijking zo', async () => {
    const r = (await yieldReport(telVanaf(zonedMidnight(2026, 9, 16, TZ)), perUur, 'maand', '2026-09-01', TZ, nu))!;
    expect(r.kosten.geschat).toContain('stroom');
    // Dezelfde maand in de vergelijking: per dag geteld of geschat, niet alleen de helft die Home Assistant telde.
    expect(r.vergelijk.kosten.at(-1)!.nu).toBeCloseTo(r.kosten.totaal!, 0);
    // Augustus telde Home Assistant nog niet: helemaal tegen de prijs bij Contract en prijzen, en zonder die prijs geen bedrag.
    expect(r.vergelijk.kosten.at(-2)!.nu).toBeCloseTo(daily('sensor.gas') * 31 * 1.3, 1);
  });

  it('telt over een heel jaar wat je boven je verbruik teruglevert tegen de vergoeding', async () => {
    const jaar = { ...perUur, prijzen: { ...perUur.prijzen, teruglevering: 0.05 } };
    const r = (await yieldReport(fakeSource(), jaar, 'jaar', '2026-09-15', TZ, nu))!;
    const terug = r.kosten.regels.find((x) => x.soort === 'terug')!;
    // Per dag 6,8 kWh van het net en 7 terug: 0,2 kWh boven je verbruik, tegen 0,05 in plaats van 0,10.
    expect(terug.euro).toBeCloseTo(-(0.7 * 365) + 0.2 * 365 * 0.05, 1);
    expect(terug.uitleg).toContain('73 kWh boven je verbruik × € 0,05');
  });

  it('leest de kostentellers uit energy/info', async () => {
    const client = { query: async (type: string) => (type === 'energy/info' ? { cost_sensors: { 'sensor.afname': 'sensor.afname_cost', 'sensor.raar': 3 } } : null) } as unknown as HaClient;
    expect(await haEnergySource(client).kostenTellers!()).toEqual({ 'sensor.afname': 'sensor.afname_cost' });
    const kapot = { query: async () => Promise.reject(new Error('onbekend')) } as unknown as HaClient;
    expect(await haEnergySource(kapot).kostenTellers!()).toBeNull();
  });
});

