/*
 * Wat niet klopt, als melding met een knop (besluit 314): wat de bewoner koos
 * en de regeling niet kon overnemen, wat mislukte, en wat van buiten niet
 * binnenkomt. De feiten, de woorden, en hoe de bel ze bewaart.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { SiteConfig } from '../src/core/model.js';
import type { ConnectionAnswers } from '../src/web/aansluiting.js';
import { KloptRegister, WEER_NA_MS, kloptMelding, kloptVast, verwarmtMeeMet, type KloptFeit } from '../src/web/klopt.js';
import type { LayoutRoom } from '../src/web/layout.js';
import { MeldingenStore, type MeldingenBron } from '../src/web/meldingen.js';

const UUR = 3_600_000;
const T0 = Date.UTC(2026, 10, 15, 10, 0, 0);

const config = (rollen: Record<string, 'primary' | 'assist'>, zones: Record<string, string[]>) =>
  ({
    actuators: Object.entries(rollen).map(([id, role]) => ({ id, name: id, role })),
    zones: Object.entries(zones).map(([id, actuatorIds]) => ({ id, name: id === 'zolder' ? 'Wasruimte' : 'Woonkamer', actuatorIds })),
  }) as unknown as SiteConfig;
const antwoorden = (zekering: unknown, fasen: number) => ({ zekering, fasen: Array.from({ length: fasen }, (_, i) => ({ id: `sensor.fase_${i + 1}` })) }) as unknown as ConnectionAnswers;
const gewoon = config({ nest: 'primary', 'ac-zolder': 'assist' }, { woonkamer: ['nest'], zolder: ['nest', 'ac-zolder'] });
const vast = (o: Partial<Parameters<typeof kloptVast>[0]> = {}) => kloptVast({ answers: null, configFasen: 0, regelingNiet: [], config: gewoon, kamerVanZone: () => null, ...o });

describe('wat niet klopt: wat de bewoner koos en de regeling niet kon overnemen (besluit 314)', () => {
  it('meldt de zekering zonder stroommeters per fase, zoals bij de testers', () => {
    expect(vast({ answers: antwoorden({ fasen: 3, ampere: 25 }, 0) })).toEqual([{ soort: 'zekering', fasen: 3, ampere: 25, meters: 0 }]);
    const m = kloptMelding({ soort: 'zekering', fasen: 3, ampere: 25, meters: 0 }, 'nl', T0);
    expect(m).toMatchObject({
      id: 'klopt:zekering',
      soort: 'klopt',
      titel: 'De zekering telt nog niet mee',
      tekst: 'Je koos 3 × 25 A, maar er is geen stroommeter per fase gevonden. Zonder die meters bewaakt SunArc de zekering niet.',
      actie: { label: 'Kies de meters', href: 'energie.html#meters' },
      klaar: { titel: 'De zekering telt weer mee', tekst: 'De stroommeters per fase zijn er.' },
    });
    expect(m.laat).toBeUndefined();
    // Eén of twee meters waar er drie nodig zijn.
    expect(kloptMelding({ soort: 'zekering', fasen: 3, ampere: 25, meters: 1 }, 'nl', T0).tekst).toContain('er is één stroommeter per fase gevonden');
    expect(kloptMelding({ soort: 'zekering', fasen: 3, ampere: 25, meters: 2 }, 'nl', T0).tekst).toContain('er zijn 2 stroommeters per fase gevonden');
  });

  it('meldt de zekering niet als de meters er zijn, als de configuratie ze al noemt, of zonder keuze', () => {
    expect(vast({ answers: antwoorden({ fasen: 3, ampere: 25 }, 3) })).toEqual([]);
    expect(vast({ answers: antwoorden({ fasen: 3, ampere: 25 }, 0), configFasen: 3 })).toEqual([]);
    expect(vast({ answers: antwoorden('weetniet', 0) })).toEqual([]);
    expect(vast({ answers: antwoorden(null, 0) })).toEqual([]);
    // Eén fase gekozen, en er zijn er meer gevonden: de eerste telt.
    expect(vast({ answers: antwoorden({ fasen: 1, ampere: 35 }, 3) })).toEqual([]);
  });

  it('meldt een apparaat dat op zon moet helpen zonder vermogen, met de weg naar de kamer', () => {
    const feiten = vast({ regelingNiet: [{ id: 'climate.zolder', naam: 'Airco zolder', kamerId: 'zolder', kamer: 'Zolder', waarom: 'vermogen' }] });
    expect(feiten).toEqual([{ soort: 'vermogen', id: 'climate.zolder', naam: 'Airco zolder', kamerId: 'zolder', kamer: 'Zolder' }]);
    expect(kloptMelding(feiten[0]!, 'nl', T0)).toMatchObject({
      id: 'klopt:vermogen:climate.zolder',
      titel: 'Airco zolder helpt nog niet op zon',
      actie: { label: 'Vul het vermogen in', href: 'comfort.html#zolder' },
      klaar: { titel: 'Airco zolder helpt op zon' },
    });
    expect(kloptMelding({ soort: 'kanNiet', id: 'climate.x', naam: 'Kachel', kamerId: 'hal', kamer: 'Hal' }, 'nl', T0).titel).toBe('Kachel doet nog niet mee');
    const geen = kloptMelding({ soort: 'geenKlimaat', id: 'switch.x', naam: 'Stekker', kamerId: 'hal', kamer: 'Hal' }, 'nl', T0);
    expect([geen.titel, geen.tekst, geen.laat]).toEqual(['Stekker kan geen kamer regelen', 'Het staat bij de hal als verwarming of koeling, maar het is geen klimaatapparaat.', true]);
  });

  it('meldt een kamer waar alleen iets op zon helpt, met Laat zo: het mag een keuze zijn', () => {
    const alleen = config({ nest: 'primary', 'ac-zolder': 'assist' }, { woonkamer: ['nest'], zolder: ['ac-zolder'] });
    const feiten = vast({ config: alleen, kamerVanZone: (z) => (z === 'zolder' ? 'kamer-zolder' : null) });
    expect(feiten).toEqual([{ soort: 'alleenHelpt', zoneId: 'zolder', kamer: 'Wasruimte', kamerId: 'kamer-zolder', meeMet: null }]);
    expect(kloptMelding(feiten[0]!, 'nl', T0)).toMatchObject({
      id: 'klopt:zone:zolder',
      titel: 'Niets houdt de wasruimte op temperatuur',
      actie: { label: 'Kies wat regelt', href: 'comfort.html#kamer-zolder' },
      laat: true,
    });
    // Verwarmt de kamer mee met een thermostaat van een andere kamer, dan zegt de melding dat.
    const mee = vast({ config: alleen, kamerVanZone: (z) => (z === 'zolder' ? 'kamer-zolder' : null), meeMet: (z) => (z === 'zolder' ? 'Nest (beneden)' : null) });
    expect(mee).toEqual([{ soort: 'alleenHelpt', zoneId: 'zolder', kamer: 'Wasruimte', kamerId: 'kamer-zolder', meeMet: 'Nest (beneden)' }]);
    expect(kloptMelding(mee[0]!, 'nl', T0)).toMatchObject({
      id: 'klopt:zone:zolder',
      titel: 'De wasruimte verwarmt mee met Nest (beneden)',
      tekst: 'SunArc kan deze kamer niet apart verwarmen. Wat er verder hangt, helpt alleen als er zon over is.',
      laat: true,
    });
    expect(kloptMelding(mee[0]!, 'en', T0).titel).not.toMatch(/verwarmt|kamer/);
    // Zonder kamer in de indeling gaat de knop naar Regeling.
    expect(kloptMelding({ soort: 'alleenHelpt', zoneId: 'zolder', kamer: 'Wasruimte', kamerId: null }, 'nl', T0).actie.href).toBe('comfort.html');
    // Een zone zonder apparaten is geen melding.
    expect(vast({ config: config({ nest: 'primary' }, { woonkamer: ['nest'], zolder: [] }) })).toEqual([]);
  });
});

describe('wat niet klopt: wat mislukte en wat niet binnenkomt (besluit 314)', () => {
  it('houdt het eerste moment, en haalt het weg als het daarna lukt of na een tijd', () => {
    const r = new KloptRegister();
    r.meld({ soort: 'terug', id: 'klimaat', naam: 'Een airco of thermostaat', sindsMs: T0 });
    r.meld({ soort: 'terug', id: 'klimaat', naam: 'Een airco of thermostaat', sindsMs: T0 + 60_000 });
    expect(r.lijst(T0 + 120_000)).toEqual([{ soort: 'terug', id: 'klimaat', naam: 'Een airco of thermostaat', sindsMs: T0 }]);
    r.gelukt('terug', 'klimaat');
    expect(r.lijst(T0 + 180_000)).toEqual([]);
    // Een geplande taak blijft een dag staan, niet langer.
    r.meld({ soort: 'gepland', id: 'Lamp aan', tekst: 'Lamp aan', sindsMs: T0 }, 24 * UUR);
    expect(r.lijst(T0 + 23 * UUR)).toHaveLength(1);
    expect(r.lijst(T0 + 25 * UUR)).toEqual([]);
  });

  it('meldt het weer pas na zes uur zonder verwachting, en niet meer zodra die er weer is', () => {
    const r = new KloptRegister();
    r.weer(false, T0);
    r.weer(false, T0 + UUR);
    expect(r.lijst(T0 + WEER_NA_MS - 1)).toEqual([]);
    expect(r.lijst(T0 + WEER_NA_MS)).toEqual([{ soort: 'weer', sindsMs: T0 }]);
    expect(kloptMelding({ soort: 'weer', sindsMs: T0 }, 'nl', T0 + 7 * UUR)).toMatchObject({
      id: 'bron:weer',
      soort: 'bron',
      titel: 'Geen weersverwachting',
      tekst: 'De weerbron geeft al 7 uur geen verwachting. De zon van morgen en het laadadvies kloppen dan minder goed.',
      actie: { label: 'Kies een weerbron', href: 'functies.html#weer' },
    });
    r.weer(true, T0 + 8 * UUR);
    expect(r.lijst(T0 + 9 * UUR)).toEqual([]);
  });

  it('zegt wat mislukte in gewone woorden, in beide talen, zonder ik en zonder interne code', () => {
    const feiten: KloptFeit[] = [
      { soort: 'zekering', fasen: 3, ampere: 25, meters: 0 },
      { soort: 'vermogen', id: 'climate.zolder', naam: 'Airco zolder', kamerId: 'zolder', kamer: 'Zolder' },
      { soort: 'geenKlimaat', id: 'switch.x', naam: 'Stekker', kamerId: 'hal', kamer: 'Hal' },
      { soort: 'kanNiet', id: 'climate.x', naam: 'Kachel', kamerId: 'hal', kamer: 'Hal' },
      { soort: 'alleenHelpt', zoneId: 'zolder', kamer: 'Wasruimte', kamerId: null },
      { soort: 'terug', id: 'klimaat', naam: 'Een airco of thermostaat', sindsMs: T0 },
      { soort: 'opZon', id: 'stekker', naam: 'Een stekker', sindsMs: T0 },
      { soort: 'gepland', id: 'x', tekst: 'Lamp aan om 18:00', sindsMs: T0 },
      { soort: 'weer', sindsMs: T0 },
    ];
    const ids = new Set<string>();
    for (const f of feiten) {
      for (const lang of ['nl', 'en'] as const) {
        const m = kloptMelding(f, lang, T0 + 7 * UUR);
        const alles = `${m.titel} ${m.tekst} ${m.actie.label} ${m.klaar?.titel ?? ''} ${m.klaar?.tekst ?? ''}`;
        expect(alles, `${f.soort} ${lang}`).not.toMatch(/undefined|null|\b[a-z]+_[a-z_]+\b|;/);
        if (lang === 'nl') expect(alles, f.soort).not.toMatch(/\bik\b|\bwarmt\b|\bopwarmt\b/i);
        expect(m.actie.href).toMatch(/^[a-z-]+\.html/);
        ids.add(m.id);
      }
    }
    // Elk onderwerp zijn eigen id, in beide talen hetzelfde.
    expect(ids.size).toBe(feiten.length);
    expect(kloptMelding(feiten[5]!, 'nl', T0).titel).toBe('Een airco of thermostaat staat nog met de hand');
    expect(kloptMelding(feiten[6]!, 'nl', T0).titel).toBe('Een stekker ging niet aan op zon');
    expect(kloptMelding(feiten[7]!, 'nl', T0).tekst).toBe('“Lamp aan om 18:00” lukte niet.');
    expect(kloptMelding(feiten[0]!, 'en', T0).titel).toBe('The main fuse does not count yet');
  });
});

describe('wat niet klopt in de bel (besluit 314)', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
  });
  const store = async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hems-klopt-'));
    dirs.push(dir);
    return new MeldingenStore({ logDir: dir });
  };
  const leeg = (o: Partial<MeldingenBron> = {}): MeldingenBron => ({ nu: T0, zonderRuimte: [], volgen: [], batterijen: [], filters: [], meters: [], versie: null, winterdagen: null, klopt: [], ...o });
  const zekering: KloptFeit = { soort: 'zekering', fasen: 3, ampere: 25, meters: 0 };
  const kamer: KloptFeit = { soort: 'alleenHelpt', zoneId: 'zolder', kamer: 'Wasruimte', kamerId: 'zolder' };

  it('telt mee in wat aandacht vraagt, en schuift naar Eerder zodra het klopt', async () => {
    const s = await store();
    s.bij(leeg({ klopt: [zekering, kamer] }));
    const nu = s.lijst(T0).actief;
    expect(nu.map((m) => [m.soort, m.titel, m.laat ?? false])).toEqual(expect.arrayContaining([
      ['klopt', 'De zekering telt nog niet mee', false],
      ['klopt', 'Niets houdt de wasruimte op temperatuur', true],
    ]));
    expect(nu).toHaveLength(2);
    // In het Engels dezelfde melding.
    expect(s.lijst(T0, 'en').actief.map((m) => m.titel)).toContain('The main fuse does not count yet');
    // De meters zijn gekozen: de zekering is klaar en staat bij Eerder, de kamer staat er nog.
    s.bij(leeg({ nu: T0 + UUR, klopt: [kamer] }));
    const later = s.lijst(T0 + UUR);
    expect(later.actief.map((m) => m.titel)).toEqual(['Niets houdt de wasruimte op temperatuur']);
    expect(later.eerder.map((m) => m.titel)).toEqual(['De zekering telt weer mee']);
  });

  it('laat staan wat er stond als de dienst het nog niet weet, net na het starten', async () => {
    const s = await store();
    s.bij(leeg({ klopt: [zekering] }));
    s.bij(leeg({ nu: T0 + 60_000, klopt: null }));
    expect(s.lijst(T0 + 60_000).actief.map((m) => m.titel)).toEqual(['De zekering telt nog niet mee']);
  });

  it('haalt een melding weg met Laat zo tot het voorbij is, en houdt sinds wanneer het speelt', async () => {
    const s = await store();
    s.bij(leeg({ klopt: [kamer] }));
    s.bij(leeg({ nu: T0 + 2 * UUR, klopt: [kamer] }));
    expect(s.lijst(T0 + 2 * UUR).actief[0]!.sindsMs).toBe(T0);
    expect(s.verwijder('klopt:zone:zolder')).toBe(true);
    s.bij(leeg({ nu: T0 + 3 * UUR, klopt: [kamer] }));
    expect(s.lijst(T0 + 3 * UUR).actief).toEqual([]);
  });

  it('neemt het moment van een mislukte poging over, en laat hem stil verdwijnen', async () => {
    const s = await store();
    const terug: KloptFeit = { soort: 'terug', id: 'klimaat', naam: 'Een airco of thermostaat', sindsMs: T0 - UUR };
    s.bij(leeg({ klopt: [terug] }));
    expect(s.lijst(T0).actief.map((m) => [m.soort, m.sindsMs])).toEqual([['mislukt', T0 - UUR]]);
    s.bij(leeg({ nu: T0 + UUR, klopt: [] }));
    expect(s.lijst(T0 + UUR)).toEqual({ actief: [], eerder: [] });
  });
});

describe('een zone die meeverwarmt met de radiator van zijn kamer (zones als deel van de kamer, 18 november 2026)', () => {
  // Zoals bij Ricardo: de zithoek een eigen regeling met alleen de airco op zon; de radiator van de woonkamer volgt de Nest.
  const cfg = ({
    actuators: [{ id: 'nest', name: 'Nest (beneden)', role: 'primary', ref: { id: 'climate.beneden' } }, { id: 'ac-woonkamer', name: 'Airco woonkamer', role: 'assist', ref: { id: 'climate.air_conditioning_woonkamer' } }],
    zones: [{ id: 'woonkamer', name: 'Woonkamer', actuatorIds: ['nest'] }, { id: 'beneden-zithoek', name: 'Woonkamer · Zithoek', actuatorIds: ['ac-woonkamer'] }],
  }) as unknown as SiteConfig;
  const woonkamer = (zone?: string): LayoutRoom =>
    ({
      id: 'beneden',
      naam: 'Woonkamer',
      etage: 'bg',
      regelzone: 'woonkamer',
      haGebied: null,
      rollen: { nest: 'houdt' },
      zones: [{ id: 'zithoek', naam: 'Zithoek', rollen: { 'ac-woonkamer': 'zon' }, regelzone: 'beneden-zithoek' }, { id: 'keuken', naam: 'Keuken', rollen: {}, regelzone: null }],
      bronnen: [{ id: 'radiator', soorten: ['radiator'], aan: 'thermostaat', apparaat: 'nest', ...(zone ? { zone } : {}) }],
    }) as unknown as LayoutRoom;

  it('noemt de Nest als de radiator in de hele kamer of in de zone hangt', () => {
    expect(verwarmtMeeMet('beneden-zithoek', cfg, [woonkamer()])).toBe('Nest (beneden)');
    expect(verwarmtMeeMet('beneden-zithoek', cfg, [woonkamer('zithoek')])).toBe('Nest (beneden)');
  });

  it('niet als de radiator in een andere zone hangt', () => {
    expect(verwarmtMeeMet('beneden-zithoek', cfg, [woonkamer('keuken')])).toBeNull();
  });
});
