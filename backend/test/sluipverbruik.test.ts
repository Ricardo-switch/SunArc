import { describe, expect, it } from 'vitest';

import { GRENS_W, jaarPrijs, leesReden, leesRedenen, nachtenUit, sluipRapport, sluipVoorBel, type Nacht } from '../src/web/sluipverbruik.js';
import { wat, type MeldingenBron } from '../src/web/meldingen.js';
import { groepVan, STANDAARD_MELDINGEN } from '../src/web/push.js';

const TZ = 'Europe/Amsterdam';
/** Een uur in de plaatselijke klok van Amsterdam (zomertijd: UTC+2). */
const uur = (dag: string, u: number) => Date.parse(`${dag}T${String(u).padStart(2, '0')}:00:00+02:00`);

/** Nachten vanaf een dag, met deze watts. */
function nachten(van: string, watts: readonly number[]): Nacht[] {
  const start = Date.parse(`${van}T12:00:00Z`);
  return watts.map((w, i) => ({ dag: new Date(start + i * 86_400_000).toISOString().slice(0, 10), w }));
}

describe('het sluipverbruik (besluit 192)', () => {
  it('neemt per nacht het laagste uur tussen 01:00 en 05:00, in de plaatselijke klok', () => {
    const rijen = [
      { start: uur('2026-10-20', 0), mean: 90 }, // voor het venster
      { start: uur('2026-10-20', 1), mean: 220 },
      { start: uur('2026-10-20', 2), mean: 190 },
      { start: uur('2026-10-20', 3), mean: 200.4 },
      { start: uur('2026-10-20', 4), mean: 210 },
      { start: uur('2026-10-20', 5), mean: 80 }, // na het venster
      { start: new Date(uur('2026-10-21', 1)).toISOString(), mean: 300 },
      { start: uur('2026-10-21', 2), mean: 310 },
    ];
    expect(nachtenUit(rijen, TZ, uur('2026-10-21', 12))).toEqual([
      { dag: '2026-10-20', w: 190 },
      { dag: '2026-10-21', w: 300 },
    ]);
  });

  it('telt de nacht van vandaag pas na 05:00, en niet met één uur of stroom terug', () => {
    const rijen = [
      { start: uur('2026-10-19', 1), mean: 200 }, // maar één uur
      { start: uur('2026-10-20', 1), mean: 150 },
      { start: uur('2026-10-20', 2), mean: -40 }, // terug naar het net: geen sluipverbruik
      { start: uur('2026-10-21', 1), mean: 180 },
      { start: uur('2026-10-21', 2), mean: 170 },
    ];
    expect(nachtenUit(rijen, TZ, uur('2026-10-21', 4))).toEqual([]);
    expect(nachtenUit(rijen, TZ, uur('2026-10-21', 6))).toEqual([{ dag: '2026-10-21', w: 170 }]);
  });

  it('kent je gewone nacht, een hoge nacht, de reeks en wat het scheelt', () => {
    // 20 gewone nachten rond 180 W, dan 10 nachten op 300 W.
    const n = nachten('2026-09-25', [...Array.from({ length: 20 }, (_, i) => 175 + (i % 5) * 5), ...Array.from({ length: 10 }, () => 300)]);
    const r = sluipRapport(n, 0.25)!;
    // De vijf laagste: vier keer 175 en één keer 180.
    expect(r.gewoonW).toBe(176);
    expect(r.vannacht).toEqual({ dag: '2026-10-24', w: 300 });
    expect(r.bovenW).toBe(124);
    expect(r.hoog).toBe(true);
    expect(r.reeks).toEqual({ sinds: '2026-10-15', nachten: 10 });
    expect(r.hoogIn30).toBe(10);
    expect(r.perJaarKwh).toBe(Math.round((300 * 8760) / 1000));
    expect(r.perJaarEuro).toBe(Math.round(r.perJaarKwh * 0.25));
    expect(r.scheelt).toEqual({ kwh: Math.round((124 * 8760) / 1000), euro: Math.round(Math.round((124 * 8760) / 1000) * 0.25) });
    expect(r.laagste.w).toBe(175);
    expect(r.maanden.map((m) => m.maand)).toEqual(['2026-09', '2026-10']);
  });

  it('noemt een gewone nacht gewoon, zonder reeks en zonder wat het scheelt', () => {
    const n = nachten('2026-09-25', [...Array.from({ length: 29 }, () => 180), 180 + GRENS_W - 1]);
    const r = sluipRapport(n, null)!;
    expect(r.hoog).toBe(false);
    expect(r.reeks).toBeNull();
    expect(r.scheelt).toBeNull();
    expect(r.perJaarEuro).toBeNull();
  });

  it('heeft minstens een week nodig', () => {
    expect(sluipRapport(nachten('2026-10-18', [180, 180, 180, 180, 180, 180]), 0.25)).toBeNull();
  });

  it('vergelijkt met dezelfde maand een jaar eerder', () => {
    const n = [...nachten('2025-10-01', Array.from({ length: 31 }, () => 200)), ...nachten('2026-10-01', Array.from({ length: 24 }, () => 280))];
    expect(sluipRapport(n, null)!.vorigJaar).toEqual({ maand: '2025-10', w: 200 });
  });

  it('rekent met het daltarief voor zijn deel van de uren', () => {
    expect(jaarPrijs({ stroom: 0.3, stroomDal: null })).toBe(0.3);
    expect(jaarPrijs({ stroom: null })).toBeNull();
    expect(jaarPrijs({ stroom: 0.3, stroomDal: 0.2 })).toBeCloseTo(0.3 * (80 / 168) + 0.2 * (88 / 168), 6);
  });

  it('ziet vaak meer dan gewoon, ook als het niet op rij is', () => {
    // Zoals hier sinds augustus 2026: om de andere nacht zo'n 150 W meer.
    const w = Array.from({ length: 75 }, (_, i) => (i < 15 ? 185 : i % 2 ? 340 : 190));
    const n = nachten('2026-08-01', w);
    const r = sluipRapport(n, null)!;
    expect(r.gewoonW).toBe(190);
    expect(r.hoog).toBe(false);
    expect(r.reeks).toBeNull();
    expect(r.vaak).toEqual({ nachten: 15, meerW: 150, sinds: '2026-08-01' });
    // Een gewone maand ertussen: daarna is het een ander patroon.
    expect(sluipRapport(nachten('2026-08-01', Array.from({ length: 30 }, () => 185)), null)!.vaak).toBeNull();
  });

  /*
   * Een reden per nacht (besluit 335, 23 november 2026). Eerst gold één antwoord voor het hele patroon sinds augustus
   * ("Jij zei: Pc"), ook voor nachten waar iets anders draaide. Nu per nacht, met de eerdere antwoorden als knoppen,
   * en een nieuwe hoge nacht met ongeveer hetzelfde extra krijgt die reden als vraag, zonder melding.
   */
  it('bewaart wat de bewoner zegt per nacht, en telt per reden (besluit 335)', () => {
    const n = nachten('2026-10-01', [...Array.from({ length: 20 }, () => 180), 310, 180, 305, 180, 600, 180, 180, 180, 180, 180]);
    const redenen = { nachten: { '2026-10-21': { tekst: 'Pc', weetNiet: false }, '2026-10-25': { tekst: 'Droger', weetNiet: false }, '2026-10-22': { tekst: null, weetNiet: true } }, oud: null };
    const r = sluipRapport(n, null, redenen)!;
    expect(r.nachten.find((x) => x.dag === '2026-10-21')).toMatchObject({ w: 310, hoog: true, reden: { tekst: 'Pc', weetNiet: false } });
    expect(r.nachten.find((x) => x.dag === '2026-10-22')).toMatchObject({ hoog: false, reden: { tekst: null, weetNiet: true } });
    // De nacht van 23 oktober heeft zo'n 125 W meer, net als de pc (130 W): de vraag "Weer de pc?".
    expect(r.nachten.find((x) => x.dag === '2026-10-23')).toMatchObject({ hoog: true, herkend: { tekst: 'Pc', meerW: 130 } });
    expect(r.nachten.find((x) => x.dag === '2026-10-23')!.reden).toBeUndefined();
    expect(r.antwoorden).toEqual(['Pc', 'Droger']);
    expect(r.redenen).toEqual([{ tekst: 'Pc', nachten: 1 }, { tekst: 'Droger', nachten: 1 }]);
    expect(r.zonderReden).toBe(0);
    // Een gewone nacht wordt niet herkend.
    expect(r.nachten.find((x) => x.dag === '2026-10-24')!.herkend).toBeUndefined();
  });

  it('herkent alleen wat er genoeg op lijkt, en zonder Pc te typen uit het oude antwoord (besluit 335)', () => {
    const n = nachten('2026-10-01', [...Array.from({ length: 20 }, () => 180), 310, 180, 250, 180, 400]);
    const r = sluipRapport(n, null, { nachten: { '2026-10-21': { tekst: 'pc', weetNiet: false } }, oud: null })!;
    // 70 W meer is te ver van 130 W (meer dan 30 W en meer dan een kwart); 220 W ook.
    expect(r.nachten.find((x) => x.dag === '2026-10-23')!.herkend).toBeUndefined();
    expect(r.nachten.find((x) => x.dag === '2026-10-25')!.herkend).toBeUndefined();
    expect(r.zonderReden).toBe(2);
    // Het antwoord van voor besluit 335 bij het patroon wordt een voorstel, met het extra van het patroon.
    const w = Array.from({ length: 75 }, (_, i) => (i < 15 ? 185 : i % 2 ? 340 : 190));
    const p = sluipRapport([...nachten('2026-08-01', w), { dag: '2026-10-15', w: 335 }], null, leesRedenen({ versie: 1, toelichting: { sinds: '2026-08-01', tekst: 'Pc', weetNiet: false, vaak: true } }))!;
    expect(p.antwoorden).toEqual(['Pc']);
    expect(p.nachten.at(-1)).toMatchObject({ w: 335, herkend: { tekst: 'Pc', meerW: 150 } });
    expect(p.redenen).toEqual([]);
  });

  it('meldt een nacht met een reden, of die op een reden lijkt, niet (besluit 335)', () => {
    const n = nachten('2026-09-25', [...Array.from({ length: 20 }, () => 180), 310, 180, 180, 180, 180, 180, 180, 180, 180, 305]);
    const nu = uur('2026-10-24', 9);
    expect(sluipVoorBel(sluipRapport(n, null)!, nu, TZ)).not.toBeNull();
    expect(sluipVoorBel(sluipRapport(n, null, { nachten: { '2026-10-15': { tekst: 'Pc', weetNiet: false } }, oud: null })!, nu, TZ)).toBeNull();
    expect(sluipVoorBel(sluipRapport(n, null, { nachten: { '2026-10-24': { tekst: null, weetNiet: true } }, oud: null })!, nu, TZ)).toBeNull();
  });

  it('leest wat de bewoner over een nacht stuurt, en wat er bewaard stond', () => {
    expect(leesReden({ dag: '2026-10-15', tekst: '  de pc  ' })).toEqual({ ok: true, dag: '2026-10-15', reden: { tekst: 'de pc', weetNiet: false } });
    expect(leesReden({ dag: '2026-10-15', weetNiet: true })).toEqual({ ok: true, dag: '2026-10-15', reden: { tekst: null, weetNiet: true } });
    expect(leesReden({ dag: '2026-10-15', wis: true })).toEqual({ ok: true, dag: '2026-10-15', reden: null });
    expect(leesReden({ dag: '15 oktober', tekst: 'x' }).ok).toBe(false);
    expect(leesReden({ dag: '2026-10-15' }).ok).toBe(false);
    expect(leesReden({ dag: '2026-10-15', weetNiet: 'ja' }).ok).toBe(false);
    expect(leesRedenen({ versie: 2, nachten: { '2026-10-15': { tekst: 'Pc' }, kapot: { tekst: 'x' } }, oud: 'Pc' })).toEqual({ nachten: { '2026-10-15': { tekst: 'Pc', weetNiet: false } }, oud: 'Pc' });
    expect(leesRedenen({ versie: 1, toelichting: { sinds: '2026-10-15', tekst: null, weetNiet: true } })).toEqual({ nachten: {}, oud: null });
    expect(leesRedenen(null)).toEqual({ nachten: {}, oud: null });
  });

  it('meldt een hoge nacht van vandaag of gisteren, en een oude niet meer', () => {
    const n = nachten('2026-09-25', [...Array.from({ length: 20 }, () => 180), ...Array.from({ length: 10 }, () => 300)]);
    const r = sluipRapport(n, null);
    expect(sluipVoorBel(r, uur('2026-10-24', 9), TZ)).toEqual({ dag: '2026-10-24', w: 300, gewoonW: 180, bovenW: 120, nachten: 10 });
    expect(sluipVoorBel(r, uur('2026-10-25', 3), TZ)?.dag).toBe('2026-10-24');
    expect(sluipVoorBel(r, uur('2026-10-26', 9), TZ)).toBeNull();
  });

  it('staat bij de bel met het wat en het hoeveel, zonder apparaat, en gaat de ochtend erna naar de telefoon', () => {
    const bron = { nu: 0, zonderRuimte: [], volgen: [], batterijen: [], filters: [], meters: [], versie: null, winterdagen: null, sluip: { dag: '2026-10-24', w: 304, gewoonW: 185, bovenW: 119, nachten: 1 } } satisfies MeldingenBron;
    const [m] = wat(bron);
    expect(m).toMatchObject({ id: 'sluip', soort: 'sluip', aandacht: true, titel: 'Vannacht 119 W meer dan gewoon', tekst: '304 W tegen je gewone 185 W. Staat er iets aan?', actie: { href: 'sluipverbruik.html' } });
    expect(m!.en.titel).toBe('Last night 119 W more than usual');
    expect(wat({ ...bron, sluip: { ...bron.sluip, nachten: 10 } })[0]!.titel).toBe('Al 10 nachten meer dan gewoon');
    expect(wat({ ...bron, sluip: null })).toEqual([]);
    expect(groepVan('sluip')).toBe('sluip');
    expect(STANDAARD_MELDINGEN.sluip).toBe(true);
  });
});
