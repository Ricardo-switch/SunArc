/**
 * De boiler en de jacuzzi voor het scherm Apparaten (besluit 186): wat hij nu
 * zou doen in een kop en een zin, de temperatuur en het doel, en de keuzes voor
 * "klaar om". Kant-en-klaar van de dienst, zodat de pagina dun blijft.
 */

import type { HeatStoreExplanation, HeatStoreStateCode } from '../core/decision.js';
import type { HeatStore, SiteConfig } from '../core/model.js';
import type { Lang } from './assistant.js';
import { clockIn, nextLocalTime, startOfLocalDay } from './today.js';

export interface ResidentBuffer {
  readonly id: string;
  readonly naam: string;
  readonly soort: HeatStore['kind'];
  readonly stand: HeatStoreStateCode;
  /** Stookt hij nu, gemeten of aan de schakelaar. */
  readonly stookt: boolean;
  /** Op zon, van het net, of geen van beide: voor de kleur. */
  readonly bron: 'zon' | 'net' | null;
  /** "Verwarmt op zon". */
  readonly kop: string;
  readonly zin: string;
  /** De watertemperatuur van nu; null zonder meter. */
  readonly temperatuurC: number | null;
  /** Waar hij nu heen wil, of null. */
  readonly doelC: number | null;
  readonly ondergrensC: number;
  readonly zonC: number;
  /** Klaar om, als de bewoner het koos: "vr 20:00" en hoe warm. */
  readonly klaarOm: { readonly tekst: string; readonly atMs: number; readonly doelC: number } | null;
  /** Tijden voor klaar om; alleen bij een jacuzzi. */
  readonly keuzes: readonly { readonly tekst: string; readonly waarde: number }[];
  /** Wat hij nu trekt, in W, als hij een eigen meter heeft (een stekker, besluit 264). */
  readonly vermogenW: number | null;
  /** Het minimum per dag van een stekker (besluit 267): hoe lang en vóór wanneer, en hoe lang hij nog moet. */
  readonly minimum: { readonly minuten: number; readonly klok: string; readonly nogMin: number } | null;
}

/** Een slimme stekker (besluit 264): aan op zon, uit zonder; geen graden. */
const STEKKER = {
  nl: {
    kop: { aan: 'Aan op zon', zouAan: 'Zou nu aangaan', zouUit: 'Zou nu uitgaan', wachtZon: 'Wacht op zon', niets: 'Aan, vraagt niets', minimum: 'Aan voor zijn minimum', zouMinimum: 'Zou nu aangaan voor zijn minimum' },
    aan: 'Er is genoeg zon over om hem aan te laten.',
    zouAan: 'Er is genoeg zon over voor hem.',
    zouUit: 'Er is te weinig zon over: hij haalt nu stroom van het net.',
    wachtZon: (kw: string | null) => (kw ? `Hij gaat aan zodra er ${kw} kW zon over is.` : 'Hij gaat aan zodra er zon over is.'),
    niets: 'Hij staat aan, maar trekt nu niets.',
    onbekend: 'Home Assistant geeft hem nu niet door.',
    // Het minimum per dag (besluit 267).
    minimum: (duur: string, by: string) => `Zo staat hij vóór ${by} toch ${duur} aan, ook zonder zon.`,
    anders: (latest: string, duur: string, by: string) => `Komt die niet, dan gaat hij om ${latest} aan: zo staat hij vóór ${by} toch ${duur} aan.`,
    gehaald: (duur: string, by: string) => `Zijn ${duur} vóór ${by} heeft hij al.`,
    duur: (min: number) => (min % 60 === 0 ? `${min / 60} uur` : min > 60 ? `${(min / 60).toLocaleString('nl-NL', { maximumFractionDigits: 2 })} uur` : `${min} minuten`),
  },
  en: {
    kop: { aan: 'On with solar', zouAan: 'Would switch on now', zouUit: 'Would switch off now', wachtZon: 'Waiting for sun', niets: 'On, draws nothing', minimum: 'On for its minimum', zouMinimum: 'Would switch on now for its minimum' },
    aan: 'There is enough solar to spare to leave it on.',
    zouAan: 'There is enough solar to spare for it.',
    zouUit: 'Not enough solar to spare: it is drawing from the grid now.',
    wachtZon: (kw: string | null) => (kw ? `It switches on as soon as ${kw} kW of solar is to spare.` : 'It switches on as soon as there is solar to spare.'),
    niets: 'It is on, but draws nothing right now.',
    onbekend: 'Home Assistant is not reporting it right now.',
    minimum: (duur: string, by: string) => `That way it is still on for ${duur} before ${by}, even without sun.`,
    anders: (latest: string, duur: string, by: string) => `If none comes, it switches on at ${latest}: that way it is still on for ${duur} before ${by}.`,
    gehaald: (duur: string, by: string) => `It already had its ${duur} before ${by}.`,
    duur: (min: number) => (min % 60 === 0 ? `${min / 60} ${min === 60 ? 'hour' : 'hours'}` : min > 60 ? `${(min / 60).toLocaleString('en-GB', { maximumFractionDigits: 2 })} hours` : `${min} minutes`),
  },
} as const;

const kwTekst = (w: number | undefined, lang: Lang) => (w == null ? null : (Math.round(w / 100) / 10).toLocaleString(lang === 'nl' ? 'nl-NL' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

const WOORDEN = {
  nl: {
    kop: {
      zon: 'Zou nu opwarmen op zon',
      onder: 'Zou nu bijwarmen',
      klaarOm: 'Zou nu beginnen voor klaar om',
      goedkoop: 'Zou nu beginnen, goedkope uren',
      legionella: 'Zou nu naar 60° gaan',
      wachtZon: 'Wacht op zon',
      wacht: 'Wacht even',
      warm: 'Warm genoeg',
      vol: 'Vol',
      onbekend: 'Niet te lezen',
    },
    zon: (doel: number | null) => (doel != null ? `Er is zon over: hij zou nu verwarmen naar ${doel}°.` : 'Er is zon over: hij zou nu aangaan tot hij vol is.'),
    onder: (min: number) => `Onder ${min}°: hij zou nu bijwarmen, ook zonder zon.`,
    klaarOm: (by: string, doel: number) => `Anders is hij om ${by} niet op ${doel}°. Daarom zou hij nu beginnen, ook zonder zon.`,
    goedkoop: (by: string | null, doel: number | null) =>
      by && doel != null ? `Nu zijn de goedkoopste uren, en om ${by} is hij dan op ${doel}°.` : 'Nu zijn de goedkoopste uren: hij zou nu een keer vol gaan.',
    legionella: (c: number) => `Eens per week naar ${c}° tegen legionella. Er was deze week geen zon voor, dus nu in de goedkoopste uren.`,
    wachtZon: (zon: number | null, min: number, latest: string | null, by: string | null) =>
      latest && by
        ? `Hij verwarmt zodra er zon over is. Komt die niet, dan begint hij om ${latest}, op tijd voor ${by}.`
        : zon != null
          ? `Hij verwarmt zodra er zon over is, tot ${zon}°. Minstens ${min}° houdt hij altijd vast.`
          : 'Hij gaat aan zodra er zon over is, tot hij vol is.',
    stabilisatie: 'Er startte net iets anders. Over een paar minuten kijkt het huis opnieuw.',
    failsafe: 'Een meter is even niet te lezen; de regeling wacht.',
    handmatig: 'De regeling staat op handmatig.',
    zekering: 'De hoofdzekering kan er nu niet nog een bij hebben.',
    warm: (t: number, min: number) => `${t}°: warm genoeg. Minstens ${min}° houdt hij vast.`,
    vol: (t: number | null) => (t != null ? `${t}°: vol tot de zon weer schijnt.` : 'Vol: hij trekt niets meer.'),
    onbekend: 'Home Assistant geeft nu geen temperatuur door.',
    vanavond: 'Vanavond',
    morgen: 'Morgen',
    locale: 'nl-NL',
  },
  en: {
    kop: {
      zon: 'Would heat on solar now',
      onder: 'Would top up now',
      klaarOm: 'Would start now for ready at',
      goedkoop: 'Would start now, cheap hours',
      legionella: 'Would go to 60° now',
      wachtZon: 'Waiting for sun',
      wacht: 'Waiting a moment',
      warm: 'Warm enough',
      vol: 'Full',
      onbekend: 'Cannot be read',
    },
    zon: (doel: number | null) => (doel != null ? `There is solar to spare: it would heat to ${doel}° now.` : 'There is solar to spare: it would switch on until it is full.'),
    onder: (min: number) => `Below ${min}°: it would top up now, even without sun.`,
    klaarOm: (by: string, doel: number) => `Otherwise it will not be ${doel}° by ${by}. So it would start now, even without sun.`,
    goedkoop: (by: string | null, doel: number | null) =>
      by && doel != null ? `These are the cheapest hours, and by ${by} it will be ${doel}°.` : 'These are the cheapest hours: it would fill up once now.',
    legionella: (c: number) => `Once a week to ${c}° against legionella. There was no sun for it this week, so now in the cheapest hours.`,
    wachtZon: (zon: number | null, min: number, latest: string | null, by: string | null) =>
      latest && by
        ? `It heats as soon as there is solar to spare. If none comes, it starts at ${latest}, in time for ${by}.`
        : zon != null
          ? `It heats as soon as there is solar to spare, up to ${zon}°. It always keeps at least ${min}°.`
          : 'It switches on as soon as there is solar to spare, until it is full.',
    stabilisatie: 'Something else just started. The house looks again in a few minutes.',
    failsafe: 'A meter cannot be read right now; control is waiting.',
    handmatig: 'Control is set to manual.',
    zekering: 'The main fuse cannot take another one right now.',
    warm: (t: number, min: number) => `${t}°: warm enough. It keeps at least ${min}°.`,
    vol: (t: number | null) => (t != null ? `${t}°: full until the sun shines again.` : 'Full: it draws nothing anymore.'),
    onbekend: 'Home Assistant is not reporting a temperature right now.',
    vanavond: 'Tonight',
    morgen: 'Tomorrow',
    locale: 'en-GB',
  },
} as const;

const graden = (c: number) => Math.round(c * 10) / 10;

/** "vr 20:00": de dag en de tijd, of alleen de tijd als het vandaag is. */
function dagTijd(ms: number, nowMs: number, config: SiteConfig, lang: Lang): string {
  const tijd = clockIn(ms, config.timezone);
  if (startOfLocalDay(ms, config.timezone) === startOfLocalDay(nowMs, config.timezone)) return tijd;
  const dag = new Intl.DateTimeFormat(WOORDEN[lang].locale, { timeZone: config.timezone, weekday: 'short' }).format(ms).replace('.', '');
  return `${dag} ${tijd}`;
}

/** Klaar om: vanavond, morgen en overmorgen om 20:00, wat nog kan. */
function keuzes(config: SiteConfig, nowMs: number, lang: Lang): { tekst: string; waarde: number }[] {
  const w = WOORDEN[lang];
  const eerste = nextLocalTime(nowMs, '20:00', config.timezone);
  const vandaag = startOfLocalDay(eerste, config.timezone) === startOfLocalDay(nowMs, config.timezone);
  const tijden = [0, 1, 2].map((n) => nextLocalTime(eerste + n * 24 * 3_600_000 - 60_000, '20:00', config.timezone));
  return tijden.map((ms, i) => ({
    waarde: ms,
    tekst: i === 0 && vandaag ? w.vanavond : (i === 0 && !vandaag) || (i === 1 && vandaag) ? w.morgen : dagTijd(ms, nowMs, config, lang),
  }));
}

export function residentBuffers(config: SiteConfig, list: readonly HeatStoreExplanation[], nowMs: number, lang: Lang = 'nl'): ResidentBuffer[] {
  const w = WOORDEN[lang];
  return (config.heatStores ?? []).flatMap((h): ResidentBuffer[] => {
    const e = list.find((x) => x.id === h.id);
    if (!e) return [];
    const temp = e.temperatureC != null ? graden(e.temperatureC) : null;
    const by = e.readyByMs != null ? dagTijd(e.readyByMs, nowMs, config, lang) : null;
    const latest = e.latestStartMs != null ? clockIn(e.latestStartMs, config.timezone) : null;
    const doel = e.targetC ?? null;
    let kop: string;
    let zin: string;
    let bron: ResidentBuffer['bron'] = null;
    const st = STEKKER[lang];
    if (h.kind === 'stekker') {
      // Het minimum per dag (besluit 267): hoe lang, vóór wanneer, en of hij het al had.
      const duur = h.minimum ? st.duur(h.minimum.minutes) : null;
      const erbij = h.minimum && duur ? (e.latestStartMs != null ? ` ${st.anders(clockIn(e.latestStartMs, config.timezone), duur, h.minimum.by)}` : e.minimumLeftMin == null ? ` ${st.gehaald(duur, h.minimum.by)}` : '') : '';
      if (e.state === 'unknown') [kop, zin] = [w.kop.onbekend, st.onbekend];
      else if (e.state === 'full') [kop, zin] = [st.kop.niets, st.niets];
      else if (e.state === 'would_heat' && e.reason === 'ready_by') {
        bron = 'net';
        [kop, zin] = [e.heating ? st.kop.minimum : st.kop.zouMinimum, st.minimum(duur ?? '', h.minimum?.by ?? '')];
      } else if (e.state === 'would_heat') {
        bron = 'zon';
        [kop, zin] = e.heating ? [st.kop.aan, st.aan] : [st.kop.zouAan, st.zouAan];
      } else if (e.reason === 'surplus_insufficient') [kop, zin] = e.heating ? [st.kop.zouUit, st.zouUit] : [st.kop.wachtZon, `${st.wachtZon(kwTekst(e.needW, lang))}${erbij}`];
      else if (e.reason === 'stabilisation_active') [kop, zin] = [w.kop.wacht, w.stabilisatie];
      else if (e.reason === 'failsafe_unreliable_input') [kop, zin] = [w.kop.wacht, w.failsafe];
      else if (e.reason === 'mode_excludes_action') [kop, zin] = [w.kop.wacht, w.handmatig];
      else [kop, zin] = [w.kop.wacht, w.zekering];
    } else if (e.state === 'unknown') [kop, zin] = [w.kop.onbekend, w.onbekend];
    else if (e.state === 'full') [kop, zin] = h.kind === 'jacuzzi' && temp != null ? [w.kop.warm, w.warm(temp, h.minC)] : [w.kop.vol, w.vol(temp)];
    else if (e.state === 'would_heat') {
      bron = e.reason === 'surplus_available' ? 'zon' : 'net';
      if (e.reason === 'surplus_available') [kop, zin] = [w.kop.zon, w.zon(doel)];
      else if (e.reason === 'below_minimum') [kop, zin] = [w.kop.onder, w.onder(h.minC)];
      else if (e.reason === 'ready_by') [kop, zin] = [w.kop.klaarOm, w.klaarOm(by ?? '', doel ?? h.sunC)];
      else if (e.reason === 'legionella_due') [kop, zin] = [w.kop.legionella.replace('60', String(h.legionellaC ?? 60)), w.legionella(h.legionellaC ?? 60)];
      else [kop, zin] = [w.kop.goedkoop, w.goedkoop(by, doel)];
    } else if (e.reason === 'surplus_insufficient') [kop, zin] = [w.kop.wachtZon, w.wachtZon(h.temperature ? h.sunC : null, h.minC, latest, by)];
    else if (e.reason === 'stabilisation_active') [kop, zin] = [w.kop.wacht, w.stabilisatie];
    else if (e.reason === 'failsafe_unreliable_input') [kop, zin] = [w.kop.wacht, w.failsafe];
    else if (e.reason === 'mode_excludes_action') [kop, zin] = [w.kop.wacht, w.handmatig];
    else [kop, zin] = [w.kop.wacht, w.zekering];
    return [
      {
        id: h.id,
        naam: h.name,
        soort: h.kind,
        stand: e.state,
        stookt: e.heating,
        bron,
        kop,
        zin,
        temperatuurC: temp,
        doelC: doel,
        ondergrensC: h.minC,
        zonC: h.sunC,
        klaarOm: e.readyByMs != null && by ? { tekst: by, atMs: e.readyByMs, doelC: doel ?? h.sunC } : null,
        keuzes: h.kind === 'jacuzzi' ? keuzes(config, nowMs, lang) : [],
        vermogenW: e.powerW ?? null,
        minimum: h.kind === 'stekker' && h.minimum ? { minuten: h.minimum.minutes, klok: h.minimum.by, nogMin: e.minimumLeftMin ?? 0 } : null,
      },
    ];
  });
}
