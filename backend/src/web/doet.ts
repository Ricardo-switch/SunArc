/**
 * Wat SunArc doet, vast op Thuis (besluit 313).
 *
 * De kop van Thuis zegt wat er in huis gebeurt. Dit is het andere deel: wat
 * SunArc zelf doet. Zolang het meekijkt, is dat per kamer wat het zou doen
 * naast wat er echt gebeurt, en één zin voor de strook:
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
 * Zonder kamers die meedoen zegt de strook wat de apparaten op zon doen; is er
 * ook daarvan niets, dan is er geen strook.
 */

import type { Zone, SiteConfig } from '../core/model.js';
import { SHORT, cap, withArticle, type DecisionView, type Lang, type ResidentRoom } from './assistant.js';

type Kant = 'heat' | 'cool';
type Wanneer = 'pauze' | 'zon' | 'nog' | 'morgen' | 'zo' | 'beurt' | 'zekering';

export interface ResidentDoetKamer {
  readonly zoneId: string;
  readonly naam: string;
  readonly temperatureC: number | null;
  /** Wat er nu in huis gebeurt: "Warmtepomp verwarmen naar 20,5°", "Uit". */
  readonly echt: string;
  /** Wat SunArc zou doen (of doet, als het regelt). */
  readonly zou: string;
  /** Nu dezelfde kant op; null als de kamer niet meetelt. */
  readonly gelijk: boolean | null;
}

export interface ResidentDoet {
  /** `zon`: geen kamer doet mee, alleen apparaten op zon. */
  readonly stand: 'kijkt' | 'regelt' | 'zon';
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
    zouNu: (kamer: string, doen: string) => `Zou nu ${kamer} ${doen}`,
    zouNiet: (kamer: string, doen: string) => `Zou ${kamer} nu niet ${doen}`,
    zouVeel: (n: number) => `Zou het in ${n} kamers anders doen`,
    zouStraks: (kamers: string, doen: string, wanneer: Wanneer, hoe: string) => (wanneer === 'morgen' ? `Zou ${kamers} ${hoe} ${doen}` : `Zou ${kamers} ${doen} ${hoe}`),
    zelfde: 'Zou nu hetzelfde doen',
    straks: (kamers: string, doet: string, hoe: string) => `${cap(doet)} ${kamers} ${hoe}`,
    bezig: 'Houdt je huis op temperatuur',
    rust: 'Niets te doen',
    storing: 'Staat stil door een storing',
    nKamers: (n: number) => `${n} kamers`,
    en: ' en ',
    stil: ', staat stil',
    uit: 'Uit',
    hetzelfde: 'Hetzelfde',
    naar: (doen: string, doel: string | null) => cap(doel != null ? `${doen} naar ${doel}°` : doen),
    nogNiets: (doet: string, hoe: string) => `Nog niets, ${doet} ${hoe}`,
    genoeg: { heat: 'Niets, het is er warm genoeg', cool: 'Niets, het is er koel genoeg' },
    ookNiets: 'Ook niets',
    niets: 'Niets nodig',
    hand: 'Met de hand',
    geenMeting: 'Geen meting',
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
    straks: (kamers: string, doet: string, hoe: string) => `${cap(doet)} ${kamers} ${hoe}`,
    bezig: 'Keeps your house at temperature',
    rust: 'Nothing to do',
    storing: 'Stopped because of a fault',
    nKamers: (n: number) => `${n} rooms`,
    en: ' and ',
    stil: ', idle',
    uit: 'Off',
    hetzelfde: 'The same',
    naar: (doen: string, doel: string | null) => cap(doel != null ? `${doen} to ${doel}°` : doen),
    nogNiets: (doet: string, hoe: string) => `Nothing yet, ${doet} ${hoe}`,
    genoeg: { heat: 'Nothing, it is warm enough there', cool: 'Nothing, it is cool enough there' },
    ookNiets: 'Nothing either',
    niets: 'Nothing needed',
    hand: 'By hand',
    geenMeting: 'No measurement',
  },
} as const;

const graden = (n: number, lang: Lang) => {
  const s = String(Math.round(n * 10) / 10);
  return lang === 'nl' ? s.replace('.', ',') : s;
};

/** Wat de apparaten van de kamer nu echt doen: verwarmen, koelen of niets. */
function echtNu(snap: DecisionView, zone: Zone, tempC: number | null): Kant | null {
  for (const id of zone.actuatorIds) {
    const doet = snap.observedAction?.[id];
    if (doet === 'heating') return 'heat';
    if (doet === 'cooling') return 'cool';
    // Zegt het apparaat wat het doet, en is dat iets anders, dan staat het stil.
    if (doet != null) continue;
    const [stand = '', sp] = (snap.observed[id] ?? '').split('@');
    if (stand !== 'heat' && stand !== 'cool') continue;
    // Het zegt het niet: dan is het bezig als zijn doel nog niet gehaald is.
    const doel = sp == null ? NaN : Number(sp);
    if (!Number.isFinite(doel) || tempC == null) return stand;
    if (stand === 'heat' ? doel > tempC : doel < tempC) return stand;
  }
  return null;
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
  return { zone, tempC, nu, doelC: nu && loopt?.setpointC != null ? loopt.setpointC : null, straks, echt, telt: !hand && tempC != null, hand };
}

const namen = (lijst: readonly string[], lang: Lang) => (lijst.length <= 1 ? (lijst[0] ?? '') : `${lijst.slice(0, -1).join(', ')}${WOORD[lang].en}${lijst[lijst.length - 1]}`);

/** Wat SunArc in de kolom "SunArc zou" zegt over één kamer. */
function zouTekst(k: Wens, lang: Lang, shadow: boolean): string {
  const w = WOORD[lang];
  if (k.hand) return w.hand;
  if (k.tempC == null) return w.geenMeting;
  if (k.nu) return shadow && k.echt === k.nu ? w.hetzelfde : w.naar(w.doen[k.nu], k.doelC != null ? graden(k.doelC, lang) : null);
  if (k.straks) return w.nogNiets(w.doet[k.straks.kant], w.wanneer[k.straks.wanneer]);
  if (!shadow) return w.niets;
  return k.echt ? w.genoeg[k.echt] : w.ookNiets;
}

/** De zin van de strook zolang SunArc meekijkt. */
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

/** De zin van de strook als SunArc zelf regelt. */
function zinRegelt(wensen: readonly Wens[], lang: Lang): string {
  const w = WOORD[lang];
  const eerste = wensen.find((k) => k.straks);
  if (eerste?.straks) return w.straks(withArticle(eerste.zone.name, lang), w.doet[eerste.straks.kant], w.wanneer[eerste.straks.wanneer]);
  return wensen.some((k) => k.nu) ? w.bezig : w.rust;
}

export function residentDoet(
  config: SiteConfig,
  snap: DecisionView,
  kamers: readonly ResidentRoom[],
  lang: Lang = 'nl',
  shadow = true,
  opZon: readonly { readonly naam: string; readonly kop: string }[] = [],
): ResidentDoet | null {
  const w = WOORD[lang];
  if (config.zones.length === 0) {
    const eerste = opZon[0];
    return eerste ? { stand: 'zon', zin: `${eerste.naam} ${eerste.kop.charAt(0).toLowerCase()}${eerste.kop.slice(1)}`, gelijk: 0, van: 0, kamers: [] } : null;
  }
  const stand = shadow ? 'kijkt' : 'regelt';
  if (snap.explanation.failsafe.active) return { stand, zin: w.storing, gelijk: 0, van: 0, kamers: [] };
  const wensen = config.zones.map((zone) => wensVan(snap, zone));
  const uit = SHORT[lang].off;
  const rijen = wensen.map((k): ResidentDoetKamer => {
    const echt = kamers.find((r) => r.zoneId === k.zone.id)?.echt ?? uit;
    return {
      zoneId: k.zone.id,
      naam: k.zone.name,
      temperatureC: k.tempC,
      // Staat een apparaat in een stand maar doet het niets, dan staat dat erbij.
      echt: echt === uit ? w.uit : `${cap(echt)}${k.echt == null ? w.stil : ''}`,
      zou: zouTekst(k, lang, shadow),
      gelijk: shadow && k.telt ? k.nu === k.echt : null,
    };
  });
  const tellen = rijen.filter((r) => r.gelijk != null);
  return {
    stand,
    zin: shadow ? zinKijkt(wensen, lang) : zinRegelt(wensen, lang),
    gelijk: tellen.filter((r) => r.gelijk).length,
    van: tellen.length,
    kamers: rijen,
  };
}
