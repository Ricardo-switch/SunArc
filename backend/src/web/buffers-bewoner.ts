/**
 * De boiler en de jacuzzi voor het scherm Apparaten (besluit 186): wat hij nu
 * zou doen in een kop en een zin, de temperatuur en het doel, en de keuzes voor
 * "klaar om". Kant-en-klaar van de dienst, zodat de pagina dun blijft.
 */

import type { HeatStoreExplanation, HeatStoreStateCode } from '../core/decision.js';
import type { HeatStore, SiteConfig } from '../core/model.js';
import type { Lang } from './assistant.js';
import { clockIn, nextLocalTime, startOfLocalDay } from './today.js';
import { perTaal } from '../taal/index.js';
import { komma } from '../taal/getal.js';

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
const STEKKER = perTaal('stekker');

// Met de hand een komma: Node in de add-on (Alpine) kent alleen Engelse getallen, en gaf "0.8 kW".
const kwTekst = (w: number | undefined, lang: Lang) => (w == null ? null : komma((Math.round(w / 100) / 10).toFixed(1), lang));

const WOORDEN = perTaal('buffers');

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
