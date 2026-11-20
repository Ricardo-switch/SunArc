/**
 * Klaarzetten per niveau (besluit 246): per functie de stappen, die zichzelf
 * afvinken aan wat SunArc ziet; de wand meldt zelf hoe Fully staat.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { klaarzetten, type KlaarInput } from '../src/web/klaarzetten.js';
import { klaarFuncties, wolkenVan, type KlaarExtra } from '../src/web/klaarzetten-functies.js';
import { addOnInfo, type InHuisStand } from '../src/web/stem-in-huis.js';
import { registers, states } from './house-fixture.js';

const input: KlaarInput = {
  locatie: true,
  registers,
  states,
  netMeter: true,
  zon: { heeft: true, intervalS: 30 },
  energieDashboard: true,
  apparatenOpZon: 1,
  cameras: 1,
  deurbel: true,
  rookmelders: 0,
  spraak: [],
  addOn: true,
  eigenPoort: false,
};
const inHuis: InHuisStand = {
  addons: [
    { id: 'whisper', slug: 'core_whisper', staat: 'aan' },
    { id: 'piper', slug: 'core_piper', staat: 'aan' },
    { id: 'openwakeword', slug: 'core_openwakeword', staat: 'nee' },
  ],
  assistent: null,
  bezig: false,
  fout: null,
};
const extra: KlaarExtra = {
  addOn: true,
  eigenPoort: false,
  eigenSlug: 'be80ef2d_hems_climate',
  inHuis,
  whisperModel: 'base-int8',
  tailscale: null,
  wand: null,
  heeftWand: true,
  schermUit: true,
  wekker: null,
  wolken: [],
  spraak: [],
  tijd: () => '10:14',
};
const punten = klaarzetten(input);
const functie = (x: Partial<KlaarExtra> = {}, lang: 'nl' | 'en' = 'nl') => (id: string) => klaarFuncties(punten, { ...extra, ...x }, lang).find((f) => f.id === id)!;
const stap = (f: ReturnType<ReturnType<typeof functie>>, id: string) => f.stappen.find((s) => s.id === id)!;

describe('klaarzetten per niveau (besluit 246)', () => {
  it('zet elke functie op een niveau, de losse app alleen in de add-on', () => {
    const lijst = klaarFuncties(punten, extra);
    expect(lijst.filter((f) => f.niveau === 'iedereen').map((f) => f.id)).toEqual(['huis', 'klimaat', 'energie', 'licht', 'witgoed', 'weer', 'assistent', 'wand']);
    expect(lijst.filter((f) => f.niveau === 'gevorderd').map((f) => f.id)).toEqual(['taalmodel', 'cloud']);
    expect(lijst.filter((f) => f.niveau === 'expert').map((f) => f.id)).toEqual(['telefoon']);
    expect(klaarFuncties(punten, { ...extra, addOn: false }).some((f) => f.niveau === 'expert')).toBe(false);
  });

  it('vinkt de assistent in huis af aan de add-ons, en noemt wat nog moet', () => {
    const a = functie()('assistent');
    expect(stap(a, 'whisper').stand).toBe('klaar');
    expect(stap(a, 'model')).toMatchObject({ stand: 'open', zin: expect.stringContaining('base-int8'), ha: '/hassio/addon/core_whisper/info' });
    expect(stap(a, 'wekwoord')).toMatchObject({ stand: 'open', ha: '/hassio/addon/core_openwakeword/info' });
    // Whisper en Piper staan er: de spraakassistent kan met één tik.
    expect(stap(a, 'spraakassistent')).toMatchObject({ stand: 'open', doe: 'spraakassistent' });
    expect(a).toMatchObject({ klaar: 2, van: 5, zin: 'Nog 3 stappen' });
    // Small-int8 is goed; kan SunArc het model niet lezen, dan telt de stap niet mee.
    expect(stap(functie({ whisperModel: 'small-int8' })('assistent'), 'model').stand).toBe('klaar');
    expect(stap(functie({ whisperModel: undefined })('assistent'), 'model').stand).toBe('onbekend');
    expect(functie({ whisperModel: undefined })('assistent').van).toBe(4);
    // Zonder Piper nog geen knop voor de spraakassistent.
    const zonderPiper = { ...inHuis, addons: inHuis.addons.map((x) => (x.id === 'piper' ? { ...x, staat: 'nee' as const } : x)) };
    expect(stap(functie({ inHuis: zonderPiper })('assistent'), 'spraakassistent')).toMatchObject({ stand: 'open', doe: null, zin: 'Eerst Whisper en Piper.' });
  });

  it('zegt in het Engels "Hey house"', () => {
    const a = functie({}, 'en')('assistent');
    expect(stap(a, 'wekwoord').titel).toBe('openWakeWord hears "Hey house"');
    expect(a.wat).toContain('Hey house');
  });

  it('neemt wat de wand zelf meldt over Fully Kiosk, en noemt alleen open wat echt mist', () => {
    // Nog niet gemeld (zoals na een herstart): niets open; scherm uit staat aan, dus klaar.
    const niets = functie()('wand');
    expect(stap(niets, 'fully').stand).toBe('kan');
    expect(niets).toMatchObject({ klaar: 1, van: 1, zin: 'Fully Kiosk en scherm uit' });
    // Fully gemeld, de camera gekozen als wekker maar hij kijkt niet mee: één stap open.
    const gemeld = functie({ wand: { fully: true, js: true, camera: false, ms: 0 }, wekker: 'fully' })('wand');
    expect(stap(gemeld, 'fully')).toMatchObject({ stand: 'klaar', zin: expect.stringContaining('10:14') });
    expect(stap(gemeld, 'js').stand).toBe('klaar');
    expect(stap(gemeld, 'beweging')).toMatchObject({ stand: 'open', app: 'jij.html#uit' });
    expect(gemeld.zin).toBe('Nog 1 stap');
    // Geen wekker gekozen: de camera hoeft niet. Scherm uit niet gekozen: ook geen tekort.
    const keuze = functie({ wand: { fully: true, js: true, camera: false, ms: 0 }, schermUit: false })('wand');
    expect(keuze.stappen.filter((s) => s.stand === 'open')).toEqual([]);
    // De koppeling met de pagina uit: dat mist wel.
    expect(stap(functie({ wand: { fully: true, js: false, camera: null, ms: 0 } })('wand'), 'js').stand).toBe('open');
    // De camera kijkt mee, of een melder in huis wekt hem.
    expect(stap(functie({ wand: { fully: true, js: true, camera: true, ms: 0 }, wekker: 'fully' })('wand'), 'beweging').stand).toBe('klaar');
    expect(stap(functie({ wand: { fully: true, js: true, camera: false, ms: 0 }, wekker: 'binary_sensor.gang' })('wand'), 'beweging').stand).toBe('klaar');
    // Zonder tablet aan de muur hoeft er niets.
    expect(functie({ heeftWand: false })('wand')).toMatchObject({ van: 0 });
  });

  it('ziet een dienst in de cloud aan zijn platform, en een spraakassistent die hem gebruikt', () => {
    expect(wolkenVan([{ entity_id: 'stt.home_assistant_cloud', platform: 'cloud' }, { entity_id: 'tts.google_cloud', platform: 'google_cloud' }, { entity_id: 'light.x', platform: 'hue' }])).toEqual(['cloud', 'google']);
    const c = functie({ wolken: ['google'], spraak: [{ id: 'p', naam: 'Wolk', wekwoord: null, spraakNaarTekst: true, taal: 'nl', voorkeur: false, wolk: true }] })('cloud');
    expect(c).toMatchObject({ klaar: 2, van: 2 });
    expect(stap(c, 'wolk').zin).toContain('Google Cloud');
  });

  it('noemt de losse app via Tailscale; de eigen poort opent de instellingen van de add-on', () => {
    const t = functie()('telefoon');
    expect(stap(t, 'tailscale').stand).toBe('onbekend');
    expect(stap(t, 'poort')).toMatchObject({ stand: 'open', ha: '/hassio/addon/be80ef2d_hems_climate/config' });
    expect(stap(functie({ eigenPoort: true })('telefoon'), 'tailscale').stand).toBe('klaar');
  });

  it('noemt nooit een entity-ID in een zin', () => {
    const alles = klaarFuncties(punten, { ...extra, wekker: 'binary_sensor.gang', wolken: ['cloud'] }).flatMap((f) => [f.zin, f.wat, ...f.stappen.map((s) => s.zin)]);
    for (const zin of alles) expect(zin).not.toMatch(/\b[a-z_]+\.[a-z0-9_]{3,}\b/);
  });
});

describe('lezen bij de Supervisor (besluit 246, hassio_api met de standaardrol)', () => {
  const antwoord = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it('leest de stand en de instellingen van een add-on, en alleen met GET', async () => {
    const gevraagd: { url: string; method: string | undefined }[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      gevraagd.push({ url, method: init?.method });
      return new Response(JSON.stringify({ result: 'ok', data: { state: 'started', options: { model: 'small-int8' } } }));
    }) as unknown as typeof fetch;
    expect(await addOnInfo('http://supervisor', 't', 'core_whisper', undefined, f)).toEqual({ er: true, draait: true, opties: { model: 'small-int8' } });
    expect(gevraagd).toEqual([{ url: 'http://supervisor/addons/core_whisper/info', method: undefined }]);
  });

  it('ziet een add-on uit de winkel die er niet staat', async () => {
    expect(await addOnInfo('http://supervisor', 't', 'a0d7b954_tailscale', undefined, antwoord(200, { result: 'ok', data: { state: 'unknown' } }))).toMatchObject({ er: false, draait: false });
  });

  it('zegt waarom het niet mag, en geeft dan niets', async () => {
    const redenen: string[] = [];
    expect(await addOnInfo('http://supervisor', 't', 'core_whisper', (r) => redenen.push(r), antwoord(403, { result: 'error', message: 'Forbidden' }))).toBeNull();
    expect(redenen).toEqual(['403: Forbidden']);
    // Een rare naam vraagt niets.
    expect(await addOnInfo('http://supervisor', 't', '../core', undefined, antwoord(200, {}))).toBeNull();
  });

  it('vraagt alleen de standaardrol: geen manager of admin, want die kosten het beveiligingscijfer', () => {
    const config = readFileSync(new URL('../../addon/config.yaml', import.meta.url), 'utf-8');
    expect(config).toMatch(/^hassio_api: true$/m);
    expect(config).not.toMatch(/^hassio_role:/m);
  });
});
