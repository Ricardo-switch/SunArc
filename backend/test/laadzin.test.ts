import { describe, expect, it } from 'vitest';
import { herkenLaden, isLadenZin, ladenAutos, type LaadAuto } from '../src/web/laadzin.js';
import { terugVan } from '../src/web/brein.js';
import { bedienbaar } from '../src/web/opdracht.js';
import type { LaadStand } from '../src/web/laadhand.js';
import type { Auto } from '../src/web/opslag.js';

const TZ = 'Europe/Amsterdam';
// Zondag 8 november 2026, 13:20 in Nederland.
const nu = Date.parse('2026-11-08T12:20:00Z');

const tesla: LaadAuto = { id: 'tesla', naam: 'Model 3', mag: true, stroom: { min: 6, max: 16 }, zekeringA: 20, pauze: true, evcc: null, actief: false };
const evcc: LaadAuto = { ...tesla, stroom: null, pauze: false, evcc: ['off', 'pv', 'minpv', 'now'] };
const stap = (r: ReturnType<typeof herkenLaden>) => (r?.ok ? r.deel.stappen[0] : null);
const zin = (r: ReturnType<typeof herkenLaden>) => (r?.ok ? r.deel.antwoord : (r?.antwoord ?? null));

describe('laden met een zin (besluit 280)', () => {
  it('herkent een stroom met een eind', () => {
    const r = herkenLaden('Laad de auto met 10 ampère tot zes uur', [tesla], 'nl', nu, TZ);
    expect(stap(r)).toEqual({ pad: 'api/laden', body: { auto: 'tesla', stroomA: 10, tot: 'tijd', totMs: Date.parse('2026-11-08T17:00:00Z') } });
    expect(zin(r)).toBe('De Model 3 laadt met 10 ampère, tot 18:00.');
    expect(r?.ok && r.deel.gedaan).toEqual([{ soort: 'laden', waarde: '10 A', uitleg: 'Model 3, tot 18:00' }]);
    expect(stap(herkenLaden('laad met 8 A tot 80%', [tesla], 'nl', nu, TZ))?.body).toEqual({ auto: 'tesla', stroomA: 8, tot: 'pct', pct: 80 });
    expect(stap(herkenLaden('laad met 8 ampère een uur lang', [tesla], 'nl', nu, TZ))?.body).toEqual({ auto: 'tesla', stroomA: 8, tot: 'uur' });
    expect(stap(herkenLaden('laad met 8 ampère tot 21:30', [tesla], 'nl', nu, TZ))?.body).toMatchObject({ tot: 'tijd', totMs: Date.parse('2026-11-08T20:30:00Z') });
    // Zonder eind: tot de kabel eruit gaat; snel is de hoogste stroom die past.
    expect(stap(herkenLaden('laad de auto snel', [tesla], 'nl', nu, TZ))?.body).toEqual({ auto: 'tesla', stroomA: 16, tot: 'kabel' });
    expect(stap(herkenLaden('charge the car at 12 amps until 80 percent', [tesla], 'en', nu, TZ))?.body).toEqual({ auto: 'tesla', stroomA: 12, tot: 'pct', pct: 80 });
    expect(zin(herkenLaden('charge the car at 12 amps', [tesla], 'en', nu, TZ))).toBe('The Model 3 charges at 12 amps, until the cable comes out.');
  });

  it('pauzeert, laadt weer en geeft het terug aan de laadpaal', () => {
    expect(stap(herkenLaden('pauzeer het laden tot 7 uur', [tesla], 'nl', nu, TZ))?.body).toMatchObject({ auto: 'tesla', pauze: true, tot: 'tijd' });
    expect(zin(herkenLaden('pauzeer het laden', [tesla], 'nl', nu, TZ))).toBe('Het laden van de Model 3 staat stil, tot de kabel eruit gaat.');
    const bezig = { ...tesla, actief: true };
    expect(stap(herkenLaden('laad de auto weer', [bezig], 'nl', nu, TZ))?.body).toEqual({ auto: 'tesla', terug: true });
    expect(stap(herkenLaden('laat de laadpaal weer zelf kiezen', [bezig], 'nl', nu, TZ))?.body).toEqual({ auto: 'tesla', terug: true });
    expect(zin(herkenLaden('laat de laadpaal weer zelf kiezen', [tesla], 'nl', nu, TZ))).toBe('De Model 3 laadt al zoals de laadpaal kiest.');
    expect(stap(herkenLaden('pause charging', [tesla], 'en', nu, TZ))?.body).toMatchObject({ pauze: true, tot: 'kabel' });
  });

  it('zet met evcc de stand', () => {
    expect(stap(herkenLaden('laad de auto snel tot 18:00', [evcc], 'nl', nu, TZ))?.body).toMatchObject({ auto: 'tesla', stand: 'now', tot: 'tijd' });
    expect(zin(herkenLaden('laad de auto snel', [evcc], 'nl', nu, TZ))).toBe('De Model 3 laadt op Snel, tot de kabel eruit gaat.');
    expect(stap(herkenLaden('laad op zon', [evcc], 'nl', nu, TZ))?.body).toMatchObject({ stand: 'pv' });
    expect(stap(herkenLaden('laad op min + zon', [evcc], 'nl', nu, TZ))?.body).toMatchObject({ stand: 'minpv' });
    expect(stap(herkenLaden('zet laden uit tot morgen 7 uur', [evcc], 'nl', nu, TZ))?.body).toMatchObject({ stand: 'off', tot: 'tijd' });
    expect(stap(herkenLaden('charge on solar', [evcc], 'en', nu, TZ))?.body).toMatchObject({ stand: 'pv' });
    expect(zin(herkenLaden('laad met 10 ampère', [evcc], 'nl', nu, TZ))).toBe('Met evcc kies je de stand: Uit, Zon, Min + zon, Snel.');
  });

  it('zegt eerlijk wat niet kan, en vraagt welke auto', () => {
    expect(zin(herkenLaden('laad met 20 ampère', [tesla], 'nl', nu, TZ))).toBe('De laadpaal kan 6 tot 16 ampère.');
    expect(zin(herkenLaden('laad met 16 ampère', [{ ...tesla, zekeringA: 12 }], 'nl', nu, TZ))).toBe('Meer dan 12 ampère past nu niet op je zekering.');
    expect(zin(herkenLaden('laad met 8 ampère', [{ ...tesla, mag: false }], 'nl', nu, TZ))).toContain('Energie › Auto en laadpaal');
    expect(zin(herkenLaden('laad op zon', [tesla], 'nl', nu, TZ))).toContain('kiest de laadpaal zelf');
    const twee = [tesla, { ...tesla, id: 'kia', naam: 'EV6' }];
    const vraag = herkenLaden('laad met 8 ampère', twee, 'nl', nu, TZ);
    expect(vraag).toEqual({ ok: false, antwoord: 'Welke auto: Model 3 of EV6?', keuze: [{ label: 'Model 3', tekst: 'laad met 8 ampère Model 3' }, { label: 'EV6', tekst: 'laad met 8 ampère EV6' }] });
    expect(stap(herkenLaden('laad de EV6 met 8 ampère', twee, 'nl', nu, TZ))?.body).toMatchObject({ auto: 'kia' });
  });

  it('laat vragen en andere zinnen liggen', () => {
    expect(isLadenZin('doe het licht uit')).toBe(false);
    expect(herkenLaden('hoe laat is de auto vol met laden', [tesla], 'nl', nu, TZ)).toBeNull();
    expect(herkenLaden('laadt de auto nu', [tesla], 'nl', nu, TZ)).toBeNull();
    expect(herkenLaden('laad de auto', [tesla], 'nl', nu, TZ)).toBeNull();
    expect(herkenLaden('laad met 8 ampère', [], 'nl', nu, TZ)).toBeNull();
  });

  it('haalt de auto’s uit de standen van het blad, en "doe maar terug" geeft het terug', () => {
    const standen: LaadStand[] = [
      { auto: 'tesla', stroom: { min: 6, max: 16, stap: 1, nuA: 6 }, pauze: true, mag: true, evcc: false, zekeringA: 20, evccStand: null, evccMag: false, actief: null },
      { auto: 'kia', stroom: null, pauze: false, mag: false, evcc: true, zekeringA: null, evccStand: { opties: ['off', 'smart', 'now'], nu: 'smart' }, evccMag: true, actief: null },
    ];
    const autos = [{ id: 'tesla', naam: 'Model 3' }, { id: 'kia', naam: 'EV6' }] as unknown as Auto[];
    expect(ladenAutos(standen, autos)).toEqual([
      tesla,
      { id: 'kia', naam: 'EV6', mag: true, stroom: null, zekeringA: null, pauze: false, evcc: ['off', 'smart', 'now'], actief: false },
    ]);
    const leeg = bedienbaar(null, { licht: false, scenes: false, schermen: false });
    expect(terugVan([{ pad: 'api/laden', body: { auto: 'tesla', stroomA: 10, tot: 'uur' } }], leeg)).toEqual([{ pad: 'api/laden', body: { auto: 'tesla', terug: true } }]);
    expect(terugVan([{ pad: 'api/laden', body: { auto: 'tesla', terug: true } }], leeg)).toBeNull();
  });
});
