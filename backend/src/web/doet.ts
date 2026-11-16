/**
 * Wat SunArc doet, vast op Thuis (besluit 313).
 *
 * De kop van Thuis zegt wat er in huis gebeurt. Dit is het andere deel: wat
 * SunArc zelf zou doen, zolang het meekijkt. Per kamer wat er nu in huis
 * gebeurt naast wat SunArc zou doen, en één zin voor de strook:
 *
 *   1. wat het nu anders zou doen      "Zou de badkamer nu niet verwarmen"
 *   2. anders, waar het op wacht       "Zou de zolder verwarmen na een pauze"
 *   3. anders                          "Zou nu hetzelfde doen"
 *
 * *Gelijk* is: nu dezelfde kant op. Allebei verwarmen, allebei koelen of
 * allebei niets. Een kamer die wacht (op zon, op een pauze) doet nu niets. Een
 * kamer die de bewoner met de hand heeft overgenomen of die geen meting heeft,
 * telt niet mee.
 *
 * De strook is er alleen zolang SunArc meekijkt (16 november 2026). Regelt
 * SunArc zelf, dan is wat het doet hetzelfde als wat er gebeurt, en zeggen de
 * kop en de stand bovenin het al. Zonder kamers die meedoen is er ook geen
 * strook.
 *
 * De twee vakken per kamer lezen als hele zinnetjes (16 november 2026): "Nest
 * (beneden) staat op 20° en staat stil", en onder de kop "SunArc zou":
 * "Verwarmen naar 20° met Nest (beneden)", "Niets doen", "Hetzelfde doen".
 */

import type { Actuator, SiteConfig, Zone } from '../core/model.js';
import { cap, withArticle, type DecisionView, type Lang } from './assistant.js';

type Kant = 'heat' | 'cool';
type Wanneer = 'pauze' | 'zon' | 'nog' | 'morgen' | 'zo' | 'beurt' | 'zekering';

export interface ResidentDoetKamer {
  readonly zoneId: string;
  readonly naam: string;
  readonly temperatureC: number | null;
  /** Wat er nu in huis gebeurt: "Warmtepomp verwarmt naar 20,5°", "Airco zolder staat uit". */
  readonly echt: string;
  /** Wat SunArc zou doen, als vervolg op "SunArc zou": "Verwarmen naar 20° met Nest (beneden)". */
  readonly zou: string;
  /** Nu dezelfde kant op; null als de kamer niet meetelt. */
  readonly gelijk: boolean | null;
}

export interface ResidentDoet {
  readonly stand: 'kijkt';
  /** De zin van de strook. */
  readonly zin: string;
  /** Hoeveel kamers gelijk zijn, van hoeveel die meetellen. */
  readonly gelijk: number;
  readonly van: number;
  readonly kamers: readonly ResidentDoetKamer[];
}

const WOORD = {
  nl: {
    doen: { heat: 'verwarmen', cool: 'koelen' },
    doet: { heat: 'verwarmt', cool: 'koelt' },
    wanneer: { pauze: 'na een pauze', zon: 'zodra er zon over is', nog: 'als de zon op is', morgen: 'morgen op zon', zo: 'over een paar minuten', beurt: 'na een andere kamer', zekering: 'zodra de zekering ruimte heeft' },
    // De zin van de strook.
    zouNu: (kamer: string, doen: string) => `Zou nu ${kamer} ${doen}`,
    zouNiet: (kamer: string, doen: string) => `Zou ${kamer} nu niet ${doen}`,
    zouVeel: (n: number) => `Zou het in ${n} kamers anders doen`,
    zouStraks: (kamers: string, doen: string, wanneer: Wanneer, hoe: string) => (wanneer === 'morgen' ? `Zou ${kamers} ${hoe} ${doen}` : `Zou ${kamers} ${doen} ${hoe}`),
    zelfde: 'Zou nu hetzelfde doen',
    storing: 'Staat stil door een storing',
    nKamers: (n: number) => `${n} kamers`,
    en: ' en ',
    // Nu in huis, per apparaat een zinnetje.
    bezig: (naam: string, doet: string, doel: string | null) => `${naam} ${doet}${doel != null ? ` naar ${doel}°` : ''}`,
    stil: (naam: string, doel: string | null) => (doel != null ? `${naam} staat op ${doel}° en staat stil` : `${naam} staat aan en staat stil`),
    uit: (naam: string) => `${naam} staat uit`,
    allesUit: 'Alles staat uit',
    // Onder de kop "SunArc zou".
    hetzelfde: 'Hetzelfde doen',
    naar: (doen: string, doel: string | null, met: string | null) => cap(`${doen}${doel != null ? ` naar ${doel}°` : ''}${met ? ` met ${met}` : ''}`),
    wachten: (doen: string, wanneer: Wanneer, hoe: string) => (wanneer === 'morgen' ? `Wachten, en ${hoe} ${doen}` : `Wachten, en ${doen} ${hoe}`),
    genoeg: { heat: 'Niets doen, het is er warm genoeg', cool: 'Niets doen, het is er koel genoeg' },
    niets: 'Niets doen',
    hand: 'Niets, je bedient het met de hand',
    geenMeting: 'Niets, er is geen meting',
  },
  en: {
    doen: { heat: 'heat', cool: 'cool' },
    doet: { heat: 'heats', cool: 'cools' },
    wanneer: { pauze: 'after a pause', zon: 'as soon as there is solar to spare', nog: 'once the sun is up', morgen: 'on solar tomorrow', zo: 'in a few minutes', beurt: 'after another room', zekering: 'once the main fuse has room' },
    zouNu: (kamer: string, doen: string) => `Would ${doen} ${kamer} now`,
    zouNiet: (kamer: string, doen: string) => `Would not ${doen} ${kamer} now`,
    zouVeel: (n: number) => `Would do ${n} rooms differently`,
    zouStraks: (kamers: string, doen: string, _wanneer: Wanneer, hoe: string) => `Would ${doen} ${kamers} ${hoe}`,
    zelfde: 'Would do the same now',
    storing: 'Stopped because of a fault',
    nKamers: (n: number) => `${n} rooms`,
    en: ' and ',
    bezig: (naam: string, doet: string, doel: string | null) => `${naam} ${doet}${doel != null ? ` to ${doel}°` : ''}`,
    stil: (naam: string, doel: string | null) => (doel != null ? `${naam} is set to ${doel}° and is idle` : `${naam} is on and is idle`),
    uit: (naam: string) => `${naam} is off`,
    allesUit: 'Everything is off',
    hetzelfde: 'Do the same',
    naar: (doen: string, doel: string | null, met: string | null) => cap(`${doen}${doel != null ? ` to ${doel}°` : ''}${met ? ` with ${met}` : ''}`),
    wachten: (doen: string, _wanneer: Wanneer, hoe: string) => `Wait, and ${doen} ${hoe}`,
    genoeg: { heat: 'Do nothing, it is warm enough there', cool: 'Do nothing, it is cool enough there' },
    niets: 'Do nothing',
    hand: 'Nothing, you control it by hand',
    geenMeting: 'Nothing, there is no measurement',
  },
} as const;

const graden = (n: number, lang: Lang) => {
  const s = String(Math.round(n * 10) / 10);
  return lang === 'nl' ? s.replace('.', ',') : s;
};

const UIT = new Set(['', 'off', 'onbekend', 'unavailable', 'unknown']);

/** Wat één apparaat nu echt doet: staat het aan, is het bezig, en naar welk doel. */
function apparaatNu(snap: DecisionView, id: string, tempC: number | null): { aan: boolean; bezig: Kant | null; doelC: number | null } {
  const [stand = '', sp] = (snap.observed[id] ?? '').split('@');
  const getal = sp == null ? NaN : Number(sp);
  const doelC = Number.isFinite(getal) ? getal : null;
  const aan = !UIT.has(stand);
  const doet = snap.observedAction?.[id];
  if (doet === 'heating') return { aan: true, bezig: 'heat', doelC };
  if (doet === 'cooling') return { aan: true, bezig: 'cool', doelC };
  // Zegt het apparaat wat het doet, en is dat iets anders, dan staat het stil.
  if (doet != null) return { aan, bezig: null, doelC };
  if (stand !== 'heat' && stand !== 'cool') return { aan, bezig: null, doelC };
  // Het zegt het niet: dan is het bezig als zijn doel nog niet gehaald is.
  if (doelC == null || tempC == null) return { aan, bezig: stand, doelC };
  return { aan, bezig: (stand === 'heat' ? doelC > tempC : doelC < tempC) ? stand : null, doelC };
}

/** Wat de apparaten van de kamer nu echt doen: verwarmen, koelen of niets. */
function echtNu(snap: DecisionView, zone: Zone, tempC: number | null): Kant | null {
  for (const id of zone.actuatorIds) {
    const { bezig } = apparaatNu(snap, id, tempC);
    if (bezig) return bezig;
  }
  return null;
}

/** "Nu in huis": per apparaat dat aan staat een zinnetje, anders dat het uit staat. */
function inHuis(config: SiteConfig, snap: DecisionView, zone: Zone, tempC: number | null, lang: Lang): string {
  const w = WOORD[lang];
  const apparaten = zone.actuatorIds.map((id) => config.actuators.find((a) => a.id === id)).filter((a): a is Actuator => a != null);
  const zinnen: string[] = [];
  for (const a of apparaten) {
    const nu = apparaatNu(snap, a.id, tempC);
    if (!nu.aan) continue;
    const doel = nu.doelC != null ? graden(nu.doelC, lang) : null;
    zinnen.push(nu.bezig ? w.bezig(cap(a.name), w.doet[nu.bezig], doel) : w.stil(cap(a.name), doel));
  }
  if (zinnen.length) return zinnen.join('. ');
  return apparaten.length === 1 ? w.uit(cap(apparaten[0]!.name)) : w.allesUit;
}

/** Waar een kamer op wacht, uit waarom het voorstel is afgewezen of niet gedaan. */
function wachtOp(code: string | undefined, zonNu: DecisionView['zonNu']): Wanneer | null {
  switch (code) {
    case 'min_rest_not_elapsed':
      return 'pauze';
    case 'stabilisation_active':
    case 'settling_after_switch':
      return 'zo';
    case 'insufficient_power_budget':
    case 'start_threshold_not_met':
    case 'surplus_insufficient':
    case 'importing_from_grid':
      return zonNu === 'weg' ? 'morgen' : zonNu === 'nog' ? 'nog' : 'zon';
    case 'superseded_by_higher_priority':
      return 'beurt';
    case 'insufficient_current_budget':
      return 'zekering';
    default:
      return null;
  }
}

interface Wens {
  readonly zone: Zone;
  readonly tempC: number | null;
  /** Wat SunArc nu wil. */
  readonly nu: Kant | null;
  readonly doelC: number | null;
  /** Het apparaat waarmee SunArc dat zou doen. */
  readonly metId: string | null;
  /** Wat SunArc wil zodra het kan. */
  readonly straks: { readonly kant: Kant; readonly wanneer: Wanneer } | null;
  readonly echt: Kant | null;
  /** Telt mee voor gelijk of anders. */
  readonly telt: boolean;
  readonly hand: boolean;
}

function wensVan(snap: DecisionView, zone: Zone): Wens {
  const e = snap.explanation;
  const ids = new Set(zone.actuatorIds);
  const pz = e.perZone.find((z) => z.zoneId === zone.id);
  const tempC = pz?.temperatureC ?? null;
  const echt = echtNu(snap, zone, tempC);
  const hand = (e.overrides ?? []).some((o) => ids.has(o.actuatorId));
  const loopt = snap.accepted.find((i) => ids.has(i.actuatorId) && (i.action === 'heat' || i.action === 'cool'));
  let nu: Kant | null = loopt ? (loopt.action as Kant) : null;
  // SunArc gaat nog even door tot net voorbij het doel (de marge tegen aan en uit). Is het
  // doel al gehaald en gebeurt er in huis niets, dan is dat geen verschil om te melden.
  if (nu && echt == null && pz) {
    const doel = nu === 'heat' ? (pz.heatTargetC ?? pz.targetC) : (pz.coolTargetC ?? pz.targetC);
    if (tempC != null && doel != null && (nu === 'heat' ? tempC >= doel : tempC <= doel)) nu = null;
  }
  // SunArc zou stoppen, maar het apparaat moet zijn minimale draaitijd nog afmaken: dan
  // draait het ook bij SunArc nu nog door, net als in huis.
  const draaitDoor = snap.rejected.some((r) => ids.has(r.intent.actuatorId) && (r.intent.action === 'off' || r.intent.action === 'standby') && r.blockedBy === 'min_run_not_elapsed');
  if (!nu && echt && draaitDoor) nu = echt;
  let straks: Wens['straks'] = null;
  if (!nu && !loopt && pz && pz.demand !== 'none') {
    const af = snap.rejected.find((r) => r.intent.zoneId === zone.id && (r.intent.action === 'heat' || r.intent.action === 'cool'));
    const wanneer = wachtOp(af?.blockedBy ?? pz.reason, snap.zonNu);
    if (wanneer) straks = { kant: pz.demand, wanneer };
  }
  return { zone, tempC, nu, doelC: nu && loopt?.setpointC != null ? loopt.setpointC : null, metId: nu && loopt ? loopt.actuatorId : null, straks, echt, telt: !hand && tempC != null, hand };
}

const namen = (lijst: readonly string[], lang: Lang) => (lijst.length <= 1 ? (lijst[0] ?? '') : `${lijst.slice(0, -1).join(', ')}${WOORD[lang].en}${lijst[lijst.length - 1]}`);

/** Wat er onder de kop "SunArc zou" staat voor één kamer. */
function zouTekst(config: SiteConfig, k: Wens, lang: Lang): string {
  const w = WOORD[lang];
  if (k.hand) return w.hand;
  if (k.tempC == null) return w.geenMeting;
  if (k.nu) {
    if (k.echt === k.nu) return w.hetzelfde;
    const met = k.metId ? config.actuators.find((a) => a.id === k.metId)?.name : null;
    return w.naar(w.doen[k.nu], k.doelC != null ? graden(k.doelC, lang) : null, met ? withArticle(met, lang) : null);
  }
  if (k.straks) return w.wachten(w.doen[k.straks.kant], k.straks.wanneer, w.wanneer[k.straks.wanneer]);
  return k.echt ? w.genoeg[k.echt] : w.niets;
}

/** De zin van de strook. */
function zinKijkt(wensen: readonly Wens[], lang: Lang): string {
  const w = WOORD[lang];
  const naam = (k: Wens) => withArticle(k.zone.name, lang);
  const anders = wensen.filter((k) => k.telt && k.nu !== k.echt);
  if (anders.length > 1) return w.zouVeel(anders.length);
  const een = anders[0];
  if (een) return een.nu ? w.zouNu(naam(een), w.doen[een.nu]) : w.zouNiet(naam(een), w.doen[een.echt!]);
  const eerste = wensen.find((k) => k.telt && k.straks);
  if (eerste?.straks) {
    const { kant, wanneer } = eerste.straks;
    const mee = wensen.filter((k) => k.telt && k.straks?.kant === kant && k.straks.wanneer === wanneer);
    const wie = mee.length > 2 ? w.nKamers(mee.length) : namen(mee.map(naam), lang);
    return w.zouStraks(wie, w.doen[kant], wanneer, w.wanneer[wanneer]);
  }
  return w.zelfde;
}

export function residentDoet(config: SiteConfig, snap: DecisionView, lang: Lang = 'nl', shadow = true): ResidentDoet | null {
  // Alleen zolang SunArc meekijkt, en alleen als er kamers meedoen.
  if (!shadow || config.zones.length === 0) return null;
  const w = WOORD[lang];
  if (snap.explanation.failsafe.active) return { stand: 'kijkt', zin: w.storing, gelijk: 0, van: 0, kamers: [] };
  const wensen = config.zones.map((zone) => wensVan(snap, zone));
  const rijen = wensen.map((k): ResidentDoetKamer => ({
    zoneId: k.zone.id,
    naam: k.zone.name,
    temperatureC: k.tempC,
    echt: inHuis(config, snap, k.zone, k.tempC, lang),
    zou: zouTekst(config, k, lang),
    gelijk: k.telt ? k.nu === k.echt : null,
  }));
  const tellen = rijen.filter((r) => r.gelijk != null);
  return { stand: 'kijkt', zin: zinKijkt(wensen, lang), gelijk: tellen.filter((r) => r.gelijk).length, van: tellen.length, kamers: rijen };
}
