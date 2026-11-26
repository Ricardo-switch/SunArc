/**
 * De assistent die uitlegt (ONTWERP §7, fase 1).
 *
 * Een vaste set vragen met antwoorden die een sjabloon zijn over het laatste
 * besluit. Geen taalmodel: wat hier staat is altijd waar, want elk getal in een
 * antwoord komt uit het besluit, de configuratie, het dagoverzicht of de vraag
 * zelf, en staat met zijn bron in `feiten` (besluit 88). Een test bewijst dat er
 * geen ander getal in de tekst staat.
 *
 * Leest alleen. Ook "zet de zolder op 21" verandert niets: tijdens de schaduw
 * zegt de assistent wat hij zou doen, en dat hij nog niet mag schakelen.
 *
 * Het eerste stuk van het bewonerscontract (besluit 76): de uitleg per kamer
 * wordt hier uitgerekend en getest, niet in een pagina. De teksten staan op
 * één plek, in het Nederlands en het Engels (besluit 86).
 */

import type { Explanation } from '../core/decision.js';
import { actuatorsOf, isHandsOff } from '../core/model.js';
import type { Actuator, Mode, SiteConfig, Zone } from '../core/model.js';
import { startOfLocalDay } from './today.js';
import { COMMON, inSentence } from '../taal/hulp.js';
import { valutaTeken } from './valuta.js';
import { residentBuffers } from './buffers-bewoner.js';
import { gewoon } from './woordzoeker.js';
import { type Answer, type AskContext, type DecisionView, type Fact, LANGS, type Lang, type Parsed, QUESTION_KINDS, type Question, type RoomKind, type RoomStatus, type Wish, type ZonNu } from './assistant-types.js';
import { perTaal } from '../taal/index.js';
import { komma } from '../taal/getal.js';

/** Losse zinnen van dit bestand, per taal (besluit 344). */
const TAAL_ZIN = perTaal('antwoord');
/** De antwoorden per vraag (besluit 353): elke zin uit het taalbestand. */
const ZIN = perTaal('vraag');
// Uit assistant-kort.ts (opgesplitst op 22 november 2026); wie dit bestand importeert, krijgt die namen ook.
export * from './assistant-kort.js';
// Uit assistant-types.ts (opgesplitst op 22 november 2026); wie dit bestand importeert, krijgt die namen ook.
export * from './assistant-types.js';
/** Waar de zon nu staat, uit de hoogte en de richting: voor de middag nog, erna weg als hij laag is. */
export function zonNuVan(elevationDeg: number, azimuthDeg: number): ZonNu {
  const middag = azimuthDeg > 180;
  if (middag && elevationDeg < 10) return 'weg';
  if (!middag && elevationDeg < 3) return 'nog';
  return 'op';
}

/** "De zon staat nu op de voorgevel." Zonder getallen: de gevels hebben namen. */
function facadeSentence(zoninval: AskContext['zoninval'], lang: Lang): string | null {
  if (zoninval == null || !zoninval.boven) return null;
  const list = zoninval.gevels.map((n) => withArticle(n, lang));
  if (list.length === 0) {
    return TAAL_ZIN[lang].zonNergens;
  }
  const joined = list.join(TAAL_ZIN[lang].verbind);
  return TAAL_ZIN[lang].zonOp(joined);
}

/** "a, b en c". */
function joinList(items: readonly string[], lang: Lang): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${TAAL_ZIN[lang].enWoord} ${items.at(-1)}`;
}

/**
 * Wat er nog aan zon komt (besluit 141): vandaag als er nog iets komt, en
 * anders wat er morgen van je dak verwacht wordt (besluit 142).
 */
function restSentence(f: Facts, weer: AskContext['weer'], lang: Lang): string | null {
  if (weer == null) return null;
  const rest = weer.verwachtKwh == null ? 0 : Math.max(0, weer.verwachtKwh - weer.opgewektKwh);
  if (rest >= 0.05) {
    const r = f.energy('weer.rest', rest * 1000);
    return TAAL_ZIN[lang].komtVandaagNogOngeveer(r);
  }
  const m = weer.morgen;
  if (m?.verwachtKwh != null) {
    const k = f.energy('weer.morgen.verwacht', m.verwachtKwh * 1000);
    return TAAL_ZIN[lang].vandaagKomtWeinigZon(k);
  }
  if (weer.verwachtKwh == null) return null;
  return TAAL_ZIN[lang].vandaagKomtWeinigZon2;
}

/** "Beneden" blijft "Beneden"; "de wasruimte" wordt "in de wasruimte". */
const BIJWOORD = /^(beneden|boven|binnen|buiten|overal|downstairs|upstairs)$/i;
/** Waar een kamer uit de indeling is: "in de slaapkamer", "op zolder", "in Kamer van Sam". */
function plekNaam(naam: string, lang: Lang): string {
  if (BIJWOORD.test(naam.trim())) return naam.trim();
  return `${ZIN[lang].voorzetsel(naam)} ${withArticle(naam, lang)}`;
}

function plekVan(zone: Zone, lang: Lang): string {
  if (BIJWOORD.test(zone.name.trim())) return zone.name.trim();
  return `${ZIN[lang].voorzetsel(zone.name)} ${zoneName(zone, lang)}`;
}

/* ---------------------------------------------------------------- vragen */

const WISHES: Readonly<Record<string, Wish>> = {
  koelen: 'koelen',
  koel: 'koelen',
  cool: 'koelen',
  verwarmen: 'verwarmen',
  verwarm: 'verwarmen',
  warm: 'verwarmen',
  heat: 'verwarmen',
  uit: 'uit',
  off: 'uit',
  // Drogen (besluit 129): een airco die de lucht droger maakt, zonder doel.
  drogen: 'drogen',
  droog: 'drogen',
  dry: 'drogen',
  aan: 'aan',
  on: 'aan',
};

/**
 * Leest een vraag uit de querystring:
 * `v=nu|waarom|straks|zon|doe`, `kamer=`, `wens=koelen|verwarmen|uit`,
 * `temperatuur=21,5`, `taal=nl|en`.
 */
export function parseQuestion(params: URLSearchParams): Parsed {
  const rawLang = (params.get('taal') ?? 'nl').toLowerCase();
  if (!(LANGS as readonly string[]).includes(rawLang)) {
    return { ok: false, reden: `taal moet een van ${LANGS.join(', ')} zijn` };
  }
  const lang = rawLang as Lang;
  const v = (params.get('v') ?? '').toLowerCase();
  const kamer = (params.get('kamer') ?? '').trim();

  switch (v) {
    case 'nu':
    case 'straks':
    case 'zon':
    case 'vandaag':
    case 'weer':
    case 'morgen':
    case 'kosten':
    case 'sluip':
    case 'thuis':
    case 'terug':
      return { ok: true, lang, question: { kind: v } };
    case 'draait':
      return { ok: true, lang, question: { kind: 'draait', apparaat: (params.get('apparaat') ?? '').trim() } };
    case 'warm':
      return { ok: true, lang, question: kamer ? { kind: 'warm', kamer } : { kind: 'warm' } };
    case 'boiler': {
      const naam = (params.get('naam') ?? '').trim();
      return { ok: true, lang, question: naam ? { kind: 'boiler', naam } : { kind: 'boiler' } };
    }
    case 'waarom':
      if (kamer === '') return { ok: false, reden: 'waarom vraagt een kamer' };
      return { ok: true, lang, question: { kind: 'waarom', kamer } };
    case 'doe': {
      if (kamer === '') return { ok: false, reden: 'doe vraagt een kamer' };
      const wens = WISHES[(params.get('wens') ?? '').trim().toLowerCase()];
      if (wens == null) return { ok: false, reden: 'wens moet koelen, verwarmen, drogen, uit of aan zijn' };
      const raw = (params.get('temperatuur') ?? '').trim().replace(',', '.');
      let temperatuurC: number | null = null;
      if (raw !== '') {
        const n = Number(raw);
        if (!Number.isFinite(n)) return { ok: false, reden: 'temperatuur is geen getal' };
        temperatuurC = n;
      }
      return { ok: true, lang, question: { kind: 'doe', kamer, wens, temperatuurC } };
    }
    default:
      return { ok: false, reden: `v moet een van ${QUESTION_KINDS.join(', ')} zijn` };
  }
}

/** Zoekt de kamer bij wat iemand zei: het id, de naam, of een deel ervan. */
export function findZone(config: SiteConfig, said: string): Zone | undefined {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/^(de|het|the)\s+/, '')
      .trim();
  const wanted = norm(said);
  if (wanted === '') return undefined;
  return (
    config.zones.find((z) => norm(z.id) === wanted || norm(z.name) === wanted) ??
    config.zones.find((z) => norm(z.name).includes(wanted) || wanted.includes(norm(z.name)))
  );
}

/* ------------------------------------------------------------- opmaak */

/** Houdt bij welke getallen er in het antwoord staan. */
class Facts {
  readonly list: Fact[] = [];
  readonly #lang: Lang;
  readonly #timeZone: string;

  constructor(lang: Lang, timeZone: string) {
    this.#lang = lang;
    this.#timeZone = timeZone;
  }

  #num(n: number): string {
    const r = Math.round(n * 10) / 10;
    const s = Number.isInteger(r) ? String(r) : r.toFixed(1);
    return komma(s, this.#lang);
  }

  /** Neemt de feiten over van een zin die in het antwoord komt. */
  merge(other: Facts): void {
    this.list.push(...other.list);
  }

  #add(bron: string, tekst: string): string {
    this.list.push({ bron, tekst });
    return tekst;
  }

  temp(bron: string, c: number): string {
    return this.#add(bron, `${this.#num(c)}°`);
  }

  /** Vermogen zonder teken; de zin zegt de richting. */
  power(bron: string, w: number): string {
    const a = Math.abs(w);
    return this.#add(bron, a < 1000 ? `${Math.round(a / 10) * 10} W` : `${this.#num(a / 1000)} kW`);
  }

  energy(bron: string, wh: number): string {
    const a = Math.abs(wh);
    return this.#add(bron, a < 1000 ? `${Math.round(a / 10) * 10} Wh` : `${this.#num(a / 1000)} kWh`);
  }

  /** Watt precies, zoals op het scherm Sluipverbruik: "304 W". */
  watt(bron: string, w: number): string {
    return this.#add(bron, `${Math.round(Math.abs(w))} W`);
  }

  /** Een aantal, zoals "13 keer". */
  count(bron: string, n: number): string {
    return this.#add(bron, String(Math.round(n)));
  }

  pct(bron: string, p: number): string {
    return this.#add(bron, `${Math.round(p)}%`);
  }

  /** Een bedrag: "€ 0,45", in de valuta van het huis. */
  euro(bron: string, n: number): string {
    const s = (Math.round(n * 100) / 100).toFixed(2);
    return this.#add(bron, `${valutaTeken(this.#lang)} ${komma(s, this.#lang)}`);
  }

  /** Een duur in gewone woorden: "25 minuten", "1,5 uur". */
  duration(bron: string, ms: number): string {
    const min = Math.round(ms / 60_000);
    if (min < 60) return this.#add(bron, ZIN[this.#lang].minuten(Math.max(1, min)));
    return this.#add(bron, ZIN[this.#lang].uren(this.#num(min / 60)));
  }

  time(bron: string, ms: number): string {
    const t = new Intl.DateTimeFormat(TAAL_ZIN[this.#lang].locale, {
      timeZone: this.#timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(ms);
    return this.#add(bron, t);
  }
}

/* ------------------------------------------------------------- teksten */

const WORDS = perTaal('assistent');

// Een naam midden in een zin staat sinds besluit 344 bij de taal (taal/hulp.ts): de taalbestanden gebruiken hem ook.
export { inSentence } from '../taal/hulp.js';

/**
 * Een naam in een zin: "Zolder" wordt "de zolder", maar een eigen naam zoals
 * "Beneden" of "Kamer van Sam" blijft zoals hij is (besluit 131). De kamers
 * heten zoals in de indeling, dus het kan allebei.
 */
export function withArticle(name: string, lang: Lang): string {
  if (!COMMON.test(name)) return name;
  // Een kamer met zijn eigen lidwoord ("het kantoor"); een apparaat of gevel met "de".
  return ZIN[lang].metLidwoord(name);
}

function zoneName(zone: Zone, lang: Lang): string {
  return withArticle(zone.name, lang);
}

function deviceName(actuator: Actuator, lang: Lang): string {
  // Een apparaat altijd met lidwoord: "de Nest", "de airco woonkamer".
  return TAAL_ZIN[lang].hetApparaat(inSentence(actuator.name), actuator.name);
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Wat de meetpunten zijn die de failsafe onbetrouwbaar vond, in woorden. */
function unreliableWords(config: SiteConfig, ids: readonly string[], lang: Lang): string {
  const words = new Set<string>();
  for (const id of ids) {
    const zone = config.zones.find((z) => z.temperature.id === id);
    if (zone) words.add(TAAL_ZIN[lang].temperatuurIn(zoneName(zone, lang)));
    else if (config.power.gridPower?.id === id || config.power.gridExport?.id === id) words.add(TAAL_ZIN[lang].slimmeMeter);
    else if (config.solarProduction?.id === id || (config.solarExtra ?? []).some((p) => p.id === id)) words.add(TAAL_ZIN[lang].zonnepanelen);
    else words.add(TAAL_ZIN[lang].meting);
  }
  return [...words].join(TAAL_ZIN[lang].verbind2);
}

/** "het is er 24,3° en het doel is 24°" — of minder, als er iets ontbreekt. */
function tempClause(f: Facts, zone: Zone, e: Explanation, lang: Lang): string {
  const pz = e.perZone.find((z) => z.zoneId === zone.id);
  const parts: string[] = [];
  if (pz?.temperatureC != null) {
    const t = f.temp(`zone.${zone.id}.temperatuur`, pz.temperatureC);
    parts.push(TAAL_ZIN[lang].hetIsEr(t));
  }
  if (pz?.targetC != null) {
    const t = f.temp(`zone.${zone.id}.doel`, pz.targetC);
    parts.push(TAAL_ZIN[lang].doelIs(t));
  }
  return parts.join(TAAL_ZIN[lang].verbind3);
}

/** Wat er van het net komt of teruggaat, als losse zin. */
function gridSentence(f: Facts, e: Explanation, lang: Lang): string | null {
  const g = e.budget.gridPowerW;
  if (!Number.isFinite(g)) return null;
  if (Math.abs(g) < 50) return TAAL_ZIN[lang].gaatNuBijnaNiets;
  const p = f.power('budget.netvermogen', g);
  if (g < 0) return TAAL_ZIN[lang].gaatNuTerugNaar(p, cap(p));
  return TAAL_ZIN[lang].huisHaaltNuVan(p);
}

/**
 * De panelen en het net in één zin (besluit 142): "Je panelen leveren 1,2 kW,
 * en 300 W gaat terug naar het net." Zonder zon alleen het net.
 */
function powerSentence(f: Facts, e: Explanation, lang: Lang, withSun: boolean): string | null {
  const zon = e.solarProductionW;
  if (!withSun || zon == null || zon <= 0) return gridSentence(f, e, lang);
  const p = f.power('zon.vermogen', zon);
  const g = e.budget.gridPowerW;
  if (!Number.isFinite(g)) return TAAL_ZIN[lang].panelenLeverenNu(p);
  if (Math.abs(g) < 50) return TAAL_ZIN[lang].panelenLeverenNuPrecies(p);
  const q = f.power('budget.netvermogen', g);
  if (g < 0) return TAAL_ZIN[lang].panelenLeverenNuEn(p, q);
  return TAAL_ZIN[lang].panelenLeverenNuHuis(p, q);
}

/**
 * De stand van één kamer, in één zin. Volgt dezelfde voorrang als de wand: een
 * storing, dan een ingreep van de bewoner, dan wat draait, wat wacht en wat
 * niets nodig heeft.
 */
export function roomStatus(
  config: SiteConfig,
  snap: DecisionView,
  zone: Zone,
  lang: Lang,
  shadow: boolean,
): RoomStatus {
  const f = new Facts(lang, config.timezone);
  // In de app (de kamer, de wand): geen ik-vorm, SunArc doet (besluit 316). De assistent zelf spreekt wel als ik.
  const s = statusOf(config, snap, zone, lang, shadow, f, true, false);
  // Wat een apparaat van de kamer echt doet: verwarmt of koelt het, dan zegt de
  // zin dat ook, want in de schaduw regelt de oude regeling en kan dat anders zijn dan SunArc zou doen.
  const echt = shadow ? zone.actuatorIds.map((id) => ({ a: config.actuators.find((x) => x.id === id), doet: snap.observedAction?.[id] })).filter((x) => x.a && (x.doet === 'heating' || x.doet === 'cooling')) : [];
  const erbij = echt.map(({ a, doet }) => (TAAL_ZIN[lang].apparaatNu(cap(deviceName(a!, lang)), doet === 'heating' ? 'verwarmt' : 'koelt', doet === 'heating' ? 'heating' : 'cooling')));
  return { ...s, zin: [s.zin, ...erbij].join(' '), feiten: f.list };
}

/*
 * De zinnen zijn kort en vertellen eerst het antwoord (besluit 142): "In de
 * wasruimte is het 22,3°, precies goed." Daarna hooguit één of twee zinnen
 * met wat er speelt.
 */
function statusOf(
  config: SiteConfig,
  snap: DecisionView,
  zone: Zone,
  lang: Lang,
  shadow: boolean,
  f: Facts,
  // "Wat doe je nu?" noemt het net één keer voor het hele huis.
  withGrid = true,
  // De assistent spreekt als ik; in de app staat er SunArc (besluit 316).
  ik = true,
): { kind: RoomKind; zin: string } {
  const w = WORDS[lang];
  const e = snap.explanation;
  const zn = zoneName(zone, lang);
  const plek = plekVan(zone, lang);
  const ids = new Set(zone.actuatorIds);
  const pz = e.perZone.find((z) => z.zoneId === zone.id);

  if (e.failsafe.active) {
    const what = unreliableWords(config, e.failsafe.unreliable, lang);
    return {
      kind: 'bad',
      zin: ZIN[lang].veilig(ik, what),
    };
  }

  const taken = (e.overrides ?? []).find((o) => ids.has(o.actuatorId));
  if (taken) {
    const dev = config.actuators.find((a) => a.id === taken.actuatorId);
    const dn = dev ? deviceName(dev, lang) : zn;
    if (taken.untilMs == null) {
      return {
        kind: 'wait',
        zin: ZIN[lang].zelfInHanden(dn, ik),
      };
    }
    const t = f.time(`ingreep.${taken.actuatorId}.tot`, taken.untilMs);
    return {
      kind: 'wait',
      zin: ZIN[lang].zelfInHandenTot(dn, t, ik),
    };
  }

  const mine = snap.accepted.filter((i) => ids.has(i.actuatorId));
  const running = mine.find((i) => i.action === 'cool' || i.action === 'heat');
  if (running && (running.action === 'cool' || running.action === 'heat')) {
    const a = running.action;
    const onSun = running.strategyId === 'pv-surplus';
    const temps = tempClause(f, zone, e, lang);
    let sun = '';
    if (onSun && e.solarProductionW != null && e.solarProductionW > 0) {
      const p = f.power('zon.vermogen', e.solarProductionW);
      sun = TAAL_ZIN[lang].panelenLeverenDusDat(p);
    }
    const head = ZIN[lang].draait({ schaduw: shadow, ik, zn, doen: w.infinitive[a], doet: w.doing[a], opZon: onSun });
    return {
      kind: a,
      zin: [`${head}${temps ? `: ${temps}` : ''}.`, sun].filter((s) => s !== '').join(' '),
    };
  }

  const parked = mine.find((i) => i.action === 'standby');
  if (parked) {
    const dev = config.actuators.find((a) => a.id === parked.actuatorId);
    const dn = dev ? deviceName(dev, lang) : zn;
    return {
      kind: 'wait',
      zin: ZIN[lang].evenStil(dn, shadow, ik, w.reason[parked.reason]),
    };
  }

  if (pz == null || pz.temperatureC == null) {
    return {
      kind: 'bad',
      zin: ik ? TAAL_ZIN[lang].geenTempIk(plek, zn) : TAAL_ZIN[lang].geenTemp(plek, zn),
    };
  }

  if (pz.demand !== 'none') {
    const temps = tempClause(f, zone, e, lang);
    const a = pz.demand;
    const blocked = snap.rejected.find((r) => r.intent.zoneId === zone.id && r.intent.action === a);
    // Niets tegengehouden en alleen hulpapparaten: dan wacht het op zon. Eerst stond hier de reden van de vraag
    // zelf ("omdat het er kouder is dan het doel"), en dat is geen reden om te wachten.
    const ids = zone.actuatorIds;
    const alleenZon = !blocked && ids.length > 0 && ids.every((id) => config.actuators.find((x) => x.id === id)?.role === 'assist');
    const why = blocked ? w.block[blocked.blockedBy] : alleenZon ? w.alleenZon[a] : w.reason[pz.reason];
    const sunBlock =
      blocked?.blockedBy === 'insufficient_power_budget' || blocked?.blockedBy === 'start_threshold_not_met';
    const grid = sunBlock && withGrid ? gridSentence(f, e, lang) : null;
    // De redenen zijn bijzinnen ("er te weinig zon over is"); na "omdat" staan ze goed.
    const head =
      TAAL_ZIN[lang].wilDatWachtNog(cap(zn), w.infinitive[a], temps, why);
    return { kind: 'wait', zin: grid ? `${head} ${grid}` : head };
  }

  // Geen vraag: de kamer zit tussen het doel voor verwarmen en dat voor koelen.
  const t = f.temp(`zone.${zone.id}.temperatuur`, pz.temperatureC);
  const heatC = pz.heatTargetC ?? (pz.coolTargetC === undefined ? pz.targetC : null);
  const coolC = pz.coolTargetC ?? null;
  if (heatC == null && coolC == null) {
    return {
      kind: 'idle',
      zin: ZIN[lang].geenDoel(plek, t, ik),
    };
  }
  const head = ZIN[lang].goed(plek, t, heatC != null && coolC != null ? 'beide' : heatC != null ? 'warm' : 'koel');
  // Wanneer het huis ingrijpt; alleen als die zin er ook komt, tellen de doelen als feit.
  const wanneerZin = (): string => {
    const h = heatC == null ? null : f.temp(`zone.${zone.id}.doelVerwarmen`, heatC);
    const c = coolC == null ? null : f.temp(`zone.${zone.id}.doelKoelen`, coolC);
    return ZIN[lang].ingrijpen({ h, c, schaduw: shadow, ik });
  };
  // Op zon zou het nog verder mogen (besluit 133), maar er is te weinig over (besluit 141).
  const opZon = snap.rejected.find((r) => r.intent.zoneId === zone.id && (r.blockedBy === 'insufficient_power_budget' || r.blockedBy === 'start_threshold_not_met') && r.intent.budgetW > 0 && (r.intent.action === 'cool' || r.intent.action === 'heat'));
  let zon = '';
  if (opZon) {
    const a = opZon.intent.action as 'cool' | 'heat';
    const doel = opZon.intent.setpointC != null ? f.temp(`zone.${zone.id}.opZonDoel`, opZon.intent.setpointC) : null;
    const vraagt = f.power(`opzon.${opZon.intent.actuatorId}.vraagt`, opZon.intent.budgetW);
    const over = Math.max(0, e.budget?.surplusW ?? 0);
    const rest = over >= 50 ? f.power('zon.over', over) : null;
    zon = ZIN[lang].opZonNog({ ik, doen: w.infinitive[a], doel, vraagt, over: rest });
  }
  return { kind: 'ok', zin: [head, zon || wanneerZin()].join(' ') };
}

/** Wat de apparaten van de kamer echt doen, zolang de schaduw meekijkt. */
function realSentence(f: Facts, config: SiteConfig, snap: DecisionView, zone: Zone, lang: Lang): string {
  const w = WORDS[lang];
  const known: string[] = [];
  const unknown: string[] = [];
  for (const a of actuatorsOf(config, zone)) {
    const [state = '', sp] = (snap.observed[a.id] ?? '').split('@');
    const word = w.observed[state];
    const dn = deviceName(a, lang);
    if (word == null) {
      unknown.push(dn);
      continue;
    }
    const n = sp == null ? NaN : Number(sp);
    const setpoint = state !== 'off' && Number.isFinite(n) ? f.temp(`apparaat.${a.id}.setpoint`, n) : null;
    known.push(ZIN[lang].staatOp(dn, state === 'off', word, setpoint));
  }
  const out: string[] = [];
  if (known.length > 0) out.push(TAAL_ZIN[lang].nuStaat(joinList(known, lang)));
  if (unknown.length > 0) {
    const names = joinList(unknown, lang);
    out.push(TAAL_ZIN[lang].hoeStaatWeetIk(names));
  }
  return out.join(' ');
}

/* --------------------------------------------------------------- antwoorden */

function unknownRoom(config: SiteConfig, said: string, lang: Lang): string {
  const names = joinList(config.zones.map((z) => inSentence(z.name)), lang);
  return TAAL_ZIN[lang].kenIkNietAls(said, names);
}

function noDecision(lang: Lang): string {
  return TAAL_ZIN[lang].ikBenNetOpgestart;
}

/** Het volgende uur waarop de klok de stand verandert, met die stand. */
function nextScheduleChange(config: SiteConfig, nowMs: number): { atMs: number; mode: Mode } {
  const { preheatFromHour, dayFromHour, nightFromHour } = config.schedule;
  const marks: { hour: number; mode: Mode }[] = [
    { hour: preheatFromHour, mode: 'voorverwarmen' },
    { hour: dayFromHour, mode: 'dag' },
    { hour: nightFromHour, mode: 'nacht' },
  ];
  const midnight = startOfLocalDay(nowMs, config.timezone);
  const candidates = [0, 1].flatMap((d) =>
    marks.map((m) => ({
      // Een dag later via de volgende middernacht, zodat zomertijd geen uur scheelt.
      atMs: (d === 0 ? midnight : startOfLocalDay(midnight + 30 * 3_600_000, config.timezone)) + m.hour * 3_600_000,
      mode: m.mode,
    })),
  );
  return candidates.filter((c) => c.atMs > nowMs).sort((a, b) => a.atMs - b.atMs)[0]!;
}

/*
 * De antwoorden (besluit 142): eerst het antwoord, dan hooguit twee zinnen
 * met wat er speelt. Warm en inhoudelijk, met de cijfers die het huis heeft;
 * "ik kijk alleen mee" zegt de assistent alleen als je vraagt wat hij doet.
 */
export function ask(question: Question, ctx: AskContext): Answer {
  const { config, snapshot, lang, shadow } = ctx;
  const z = ZIN[lang];
  const f = new Facts(lang, config.timezone);
  const done = (antwoord: string, kamer: string | null = null): Answer => ({
    vraag: question.kind,
    taal: lang,
    kamer,
    antwoord: antwoord.replace(/\s+/g, ' ').trim(),
    feiten: f.list,
  });
  const letterlijk = (antwoord: string, kamer: string | null = null): Answer => ({ ...done(antwoord, kamer), letterlijk: true });

  switch (question.kind) {
    case 'nu': {
      if (snapshot == null) return letterlijk(noDecision(lang));
      const e = snapshot.explanation;
      const out: string[] = [];
      if (isHandsOff(e.mode)) {
        out.push(z.handmatig);
      } else {
        // Elke kamer met eigen feiten: alleen wat in het antwoord komt, telt mee.
        const statuses = config.zones.map((z) => {
          const own = new Facts(lang, config.timezone);
          return { ...statusOf(config, snapshot, z, lang, shadow, own, false), own };
        });
        const said = e.failsafe.active
          ? // Bij een storing zegt elke kamer hetzelfde; één keer is genoeg.
            statuses.slice(0, 1)
          : statuses.filter((s) => s.kind !== 'ok' && s.kind !== 'idle');
        // Zonder slimme regeling (besluit 194) zijn er geen kamers om iets te willen.
        if (said.length === 0) out.push(ctx.config.zones.length === 0 ? z.rustigNiets : z.rustig);
        for (const s of said) {
          out.push(s.zin);
          f.merge(s.own);
        }
      }
      // Een kamer die op zon draait, noemde de panelen al.
      const saidSun = f.list.some((x) => x.bron === 'zon.vermogen');
      const power = powerSentence(f, e, lang, !saidSun);
      if (power) out.push(power);
      // Wiens comfort er geldt (besluit 147), alleen als het niet dat van de hoofdgebruiker is.
      const profiel = snapshot.explanation.profile;
      const hoofd = config.profiles?.[0];
      if (profiel && hoofd && (profiel.id !== hoofd.id || profiel.reason === 'gekozen')) {
        out.push(profiel.reason === 'gekozen' ? z.comfortGekozen(profiel.name) : z.comfortWeg(profiel.name, hoofd.name));
      }
      if (shadow) out.push(z.schaduw);
      return done(out.join(' '));
    }

    case 'waarom': {
      const zone = findZone(config, question.kamer);
      if (zone == null) return letterlijk(unknownRoom(config, question.kamer, lang));
      if (snapshot == null) return letterlijk(noDecision(lang), zone.id);
      const status = statusOf(config, snapshot, zone, lang, shadow, f);
      const real = shadow ? realSentence(f, config, snapshot, zone, lang) : '';
      return done(`${status.zin} ${real}`, zone.id);
    }

    case 'straks': {
      const out: string[] = [];
      const e = snapshot?.explanation;
      // Eerst wat op zon wacht, net als de kaart Straks op Thuis: daar tik je vandaan.
      const wacht = (snapshot?.rejected ?? []).find((r) => r.blockedBy === 'insufficient_power_budget' && r.intent.budgetW > 0 && (r.intent.action === 'cool' || r.intent.action === 'heat'));
      const wachtZone = wacht ? config.zones.find((z) => z.id === wacht.intent.zoneId) : undefined;
      if (wacht && wachtZone) {
        const a = wacht.intent.action as 'cool' | 'heat';
        const vraagt = f.power(`opzon.${wacht.intent.actuatorId}.vraagt`, wacht.intent.budgetW);
        const over = Math.max(0, e?.budget?.availableW ?? 0);
        const nu = over >= 50 ? f.power('budget.beschikbaar', over) : null;
        out.push(z.wachtOpZon(zoneName(wachtZone, lang), WORDS[lang].infinitive[a], vraagt, nu));
      }
      for (const o of e?.overrides ?? []) {
        if (o.untilMs == null || o.untilMs <= ctx.nowMs) continue;
        const dev = config.actuators.find((a) => a.id === o.actuatorId);
        if (!dev) continue;
        const t = f.time(`ingreep.${o.actuatorId}.tot`, o.untilMs);
        out.push(z.jijTot(deviceName(dev, lang), t));
      }
      if (e?.modeSource === 'override') {
        out.push(z.standMetHand(WORDS[lang].mode[e.mode]));
      } else {
        const next = nextScheduleChange(config, ctx.nowMs);
        const t = f.time(`schema.${next.mode}`, next.atMs);
        const later = next.mode === 'nacht' && config.schedule.eveningExtensionLights.length > 0;
        out.push(z.straksStand(t, WORDS[lang].mode[next.mode], later));
      }
      const rest = restSentence(f, ctx.weer, lang);
      out.push(rest ?? z.geenZonWeer);
      return done(out.join(' '));
    }

    case 'zon': {
      const t = ctx.today;
      const facade = facadeSentence(ctx.zoninval, lang);
      // "Hoeveel zon komt er nog": eerst wat er nog komt, dan wat er al was.
      if (question.vooruit) {
        const rest = restSentence(f, ctx.weer, lang);
        const al = t != null && t.zonWh >= 5 ? TAAL_ZIN[lang].totNuToe(f.energy('vandaag.zonWh', t.zonWh)) : null;
        return done([rest ?? TAAL_ZIN[lang].geenVerwachting, al, facade].filter((x): x is string => x != null && x !== '').join(' '));
      }
      if (t == null) return done([ZIN[lang].geenDag, facade ?? ''].join(' '));
      const out: string[] = [];
      const vooraf = ctx.weer?.voorafKwh ?? null;
      if (t.zonWh < 5) {
        out.push(z.bijnaNiets);
      } else {
        const zon = f.energy('vandaag.zonWh', t.zonWh);
        // Naast wat er vanochtend verwacht werd (besluit 137).
        let naast = '';
        if (vooraf != null && vooraf > 0) {
          const v = f.energy('weer.vooraf', vooraf * 1000);
          const r = t.zonWh / 1000 / vooraf;
          naast = z.naast(r, v);
        }
        out.push(z.leverden(zon, naast));
        if (t.netTerugWh >= 5) {
          const zelf = f.pct('vandaag.zelfPct', Math.max(0, Math.min(100, ((t.zonWh - t.netTerugWh) / t.zonWh) * 100)));
          const terug = f.energy('vandaag.netTerugWh', t.netTerugWh);
          out.push(z.zelfGebruikt(zelf, terug));
        } else {
          out.push(z.allesZelf);
        }
      }
      const now = snapshot?.explanation.solarProductionW;
      const best = t.kwartieren
        .filter((k): k is typeof k & { zonW: number } => k.zonW != null)
        .reduce<{ tMs: number; zonW: number } | null>((m, k) => (m == null || k.zonW > m.zonW ? k : m), null);
      const onder = ctx.zoninval != null && !ctx.zoninval.boven;
      if (now != null && now > 0) {
        const p = f.power('zon.vermogen', now);
        out.push(facade ? `${z.nuLeveren(p)} ${facade}` : z.nuLeveren(p));
      } else if (best && best.zonW > 0) {
        const p = f.power('vandaag.piekW', best.zonW);
        const at = f.time('vandaag.piekTijd', best.tMs);
        out.push(z.meesteWas(p, at, onder));
      }
      // Hooguit drie zinnen; alleen wat erin komt, telt als feit.
      if (out.length < 3) {
        const own = new Facts(lang, config.timezone);
        const rest = restSentence(own, ctx.weer, lang);
        if (rest) {
          out.push(rest);
          f.merge(own);
        }
      }
      return done(out.join(' '));
    }

    case 'vandaag': {
      const t = ctx.today;
      if (t == null) return done(ZIN[lang].geenDag);
      const out: string[] = [];
      const duur = (spans: readonly { vanMs: number; totMs: number }[]) => spans.reduce((s, x) => s + Math.max(0, x.totMs - x.vanMs), 0);
      const lijst = (key: 'smartClimate' | 'huidig') =>
        t.apparaten
          .map((a) => ({ a, ms: duur(a[key]), dev: config.actuators.find((x) => x.id === a.actuatorId) }))
          .filter((x) => x.dev && x.ms >= 60_000)
          .sort((x, y) => y.ms - x.ms)
          .slice(0, 3)
          .map((x) => `${deviceName(x.dev!, lang)} ${f.duration(`vandaag.${key}.${x.a.actuatorId}`, x.ms)}`);
      const zou = lijst('smartClimate');
      const echt = lijst('huidig');
      if (zou.length === 0 && echt.length === 0) {
        out.push(z.rustigeDag);
      } else {
        if (zou.length) out.push(z.lietDraaien(shadow, joinList(zou, lang)));
        out.push(echt.length ? z.echtAan(joinList(echt, lang)) : z.echtNiets);
      }
      if (t.zonWh >= 50) {
        const zon = f.energy('vandaag.zonWh', t.zonWh);
        const zelf = f.pct('vandaag.zelfPct', Math.max(0, Math.min(100, ((t.zonWh - t.netTerugWh) / t.zonWh) * 100)));
        out.push(z.zonZelf(zon, zelf));
      }
      return done(out.join(' '));
    }

    case 'warm': {
      // Eén kamer, ook een die SunArc niet regelt (besluit 341): de meter in die kamer uit de indeling.
      const gevraagd = question.kamer ? gewoon(question.kamer) : '';
      const vooraf: string[] = [];
      if (gevraagd) {
        // Dezelfde woorden, zonder "van" en lidwoorden: "slaapkamer" vindt alle slaapkamers, "slaapkamer van Mylan" die ene.
        const woorden = (x: string): string[] => gewoon(x).split(' ').filter((w) => w !== '' && !['van', 'de', 'het', 'the', 'of'].includes(w));
        const v = woorden(question.kamer ?? '');
        const passend = (ctx.kamers ?? [])
          .map((k) => ({ k, n: woorden(k.naam) }))
          .filter(({ n }) => n.length > 0 && v.length > 0 && (n.every((w) => v.includes(w)) || v.every((w) => n.includes(w))))
          .map(({ k, n }) => ({ k, raak: n.filter((w) => v.includes(w)).length }));
        // De kamer met de meeste woorden uit de vraag wint: "slaapkamer van Mylan" is niet de slaapkamer.
        const meest = Math.max(0, ...passend.map((p) => p.raak));
        const gevonden = passend.filter((p) => p.raak === meest).map((p) => p.k);
        const met = gevonden.filter((k): k is typeof k & { temperatuurC: number } => k.temperatuurC != null);
        if (gevonden.length && !met.length) {
          const plek = plekNaam(gevonden[0]!.naam, lang);
          return done(z.geenThermometer(plek));
        }
        if (met.length) {
          const delen = met.map((k) => ({ plek: plekNaam(k.naam, lang), naam: k.naam, c: f.temp(`kamer.${gewoon(k.naam).replace(/ /g, '-')}.temperatuur`, k.temperatuurC) }));
          const out = [`${joinList(z.temperaturen(delen), lang)}.`];
          if (met.every((k) => !k.geregeld)) {
            out.push(z.nietGeregeld(met.length > 1));
          }
          return done(out.join(' '));
        }
        // Een kamer die het huis niet kent: dat zeggen, en dan hoe warm het overal is.
        vooraf.push(z.kamerOnbekend(question.kamer ?? ''));
      }
      if (snapshot == null) return letterlijk(noDecision(lang));
      const e = snapshot.explanation;
      const delen = config.zones
        .map((z) => ({ z, c: e.perZone.find((p) => p.zoneId === z.id)?.temperatureC ?? null }))
        .filter((x): x is { z: Zone; c: number } => x.c != null)
        .map((x) => ({ z: x.z, plek: plekVan(x.z, lang), naam: zoneName(x.z, lang), c: f.temp(`zone.${x.z.id}.temperatuur`, x.c) }));
      const out: string[] = [...vooraf];
      // "Beneden is het 21,7°, in de badkamer 19° en in de wasruimte 21,7°."
      if (delen.length === 0) out.push(z.nergensTemp);
      else out.push(`${joinList(z.zoneTemperaturen(delen), lang)}.`);
      // Wie er iets wil, in één zin; zonder getallen, die staan er al.
      const willen = delen
        .map((d) => ({ d, s: statusOf(config, snapshot, d.z, lang, shadow, new Facts(lang, config.timezone)) }))
        .filter((x) => x.s.kind === 'heat' || x.s.kind === 'cool' || x.s.kind === 'wait');
      if (delen.length > 1 && willen.length === 0) out.push(z.overalGoed);
      else if (willen.length > 0) {
        const namen = joinList(willen.map((x) => zoneName(x.d.z, lang)), lang);
        out.push(z.willenNog(namen, willen.length > 1));
      }
      if (e.outdoorTemperatureC != null) {
        const b = f.temp('buiten.temperatuur', e.outdoorTemperatureC);
        out.push(z.buiten(b));
      }
      return done(out.join(' '));
    }

    case 'boiler': {
      // Wat de boiler of de jacuzzi nu doet (besluit 341), met dezelfde woorden als in de app.
      const soorten = (config.heatStores ?? []).filter((h) => h.kind !== 'stekker');
      if (soorten.length === 0) return done(z.geenBoiler);
      if (snapshot == null) return letterlijk(noDecision(lang));
      const gevraagd = question.naam ? gewoon(question.naam) : '';
      const alle = residentBuffers(config, snapshot.explanation.heatStores ?? [], ctx.nowMs, lang).filter((b) => b.soort !== 'stekker');
      const opNaam = alle.filter((b) => gevraagd !== '' && ` ${gewoon(b.naam)} `.includes(` ${gevraagd} `));
      const opSoort = alle.filter((b) => (b.soort === 'jacuzzi' ? /jacuzzi|hot ?tub|bubbelbad/ : /boiler|warm ?water|water heater|hot water/).test(gevraagd));
      const lijst = opNaam.length ? opNaam : opSoort.length ? opSoort : alle;
      if (lijst.length === 0) return done(z.boilerOnleesbaar);
      const out = lijst.map((b) => {
        const e = snapshot.explanation.heatStores?.find((x) => x.id === b.id);
        const naam = cap(withArticle(b.naam, lang));
        const kop = b.kop.charAt(0).toLowerCase() + b.kop.slice(1);
        const temp = e?.temperatureC != null ? f.temp(`boiler.${b.id}.temperatuur`, e.temperatureC) : null;
        // Begint de zin van de app met de temperatuur (vol, warm genoeg), dan is die zin het hele antwoord.
        if (b.temperatuurC != null && b.zin.startsWith(`${b.temperatuurC}°:`)) return z.boilerVol(naam, b.zin);
        return z.boiler(naam, temp, kop, b.zin);
      });
      return done(out.join(' '));
    }

    case 'weer': {
      // Vandaag (besluit 166): het weer van de rest van de dag, en wat er van je dak komt.
      const w = ctx.weer;
      const v = w?.vandaag;
      const geen = z.geenWeerVandaag;
      if (w == null) return done(geen);
      const out: string[] = [];
      const wat = v?.tekst ? z.weerKlein(v.tekst) : null;
      const max = v?.maxC == null ? null : f.temp('weer.vandaag.maxC', v.maxC);
      const min = v?.minC == null || max == null || v.minC === v.maxC ? null : f.temp('weer.vandaag.minC', v.minC);
      const temp = max && min ? z.tussen(min, max) : max ? z.rond(max) : null;
      if (wat || temp) out.push(z.weerVandaag([wat, temp].filter(Boolean).join(', ')));
      if (v?.regenkansPct != null) {
        if (v.regenkansPct >= 30) {
          const r = f.pct('weer.vandaag.regenkans', v.regenkansPct);
          out.push(z.regenkans(r));
        } else out.push(z.droog);
      }
      if (w.verwachtKwh != null) {
        const k = f.energy('weer.vandaag.verwacht', w.verwachtKwh * 1000);
        const al = w.opgewektKwh >= 0.1 ? f.energy('weer.vandaag.opgewekt', w.opgewektKwh * 1000) : null;
        out.push(z.panelenVandaag(k, al));
      }
      return done(out.length ? out.join(' ') : geen);
    }

    case 'morgen': {
      const m = ctx.weer?.morgen;
      const geen = z.geenWeerMorgen;
      if (m == null) return done(geen);
      const out: string[] = [];
      const wat = m.tekst ? z.weerKlein(m.tekst) : null;
      const max = m.maxC == null ? null : f.temp('weer.morgen.maxC', m.maxC);
      const min = m.minC == null || max == null ? null : f.temp('weer.morgen.minC', m.minC);
      const temp = max && min ? z.tussen(min, max) : max ? z.totMax(max) : null;
      if (wat || temp) out.push(z.weerMorgen([wat, temp].filter(Boolean).join(', ')));
      if (m.regenkansPct != null) {
        if (m.regenkansPct >= 30) {
          const r = f.pct('weer.morgen.regenkans', m.regenkansPct);
          out.push(z.regenkans(r));
        } else out.push(z.droog);
      }
      if (m.verwachtKwh != null) {
        const k = f.energy('weer.morgen.verwacht', m.verwachtKwh * 1000);
        out.push(z.panelenMorgen(k));
      }
      return done(out.length ? out.join(' ') : geen);
    }

    case 'sluip': {
      // Het wat en het hoeveel, geen apparaat (besluit 88).
      const s = ctx.sluip;
      if (s == null) {
        return done(z.sluipOnbekend);
      }
      const w = f.watt('sluip.vannacht', s.vannacht.w);
      const gewoon = f.watt('sluip.gewoon', s.gewoonW);
      if (!s.hoog) {
        const gem = f.watt('sluip.gemiddeld', s.gemiddeldW);
        return done(z.sluipGewoon(w, gewoon, gem));
      }
      const boven = f.watt('sluip.boven', s.bovenW);
      const out = [z.sluipHoog(w, gewoon, boven)];
      if (s.reeks && s.reeks.nachten > 1) {
        const datum = new Date(`${s.reeks.sinds}T12:00:00Z`).toLocaleDateString(TAAL_ZIN[lang].locale, { day: 'numeric', month: 'long', timeZone: 'UTC' });
        out.push(z.sluipSinds(datum));
      }
      if (s.scheelt?.euro != null) out.push(z.sluipJaar(f.euro('sluip.scheelt', s.scheelt.euro)));
      else if (s.scheelt) out.push(z.sluipJaarKwh(f.energy('sluip.scheelt', s.scheelt.kwh * 1000)));
      // Wat de bewoner over deze nacht zei, of waar hij op lijkt (besluit 335).
      const laatste = s.nachten.at(-1);
      if (laatste?.reden?.tekst) out.push(z.jijZei(laatste.reden.tekst));
      else if (laatste?.herkend) out.push(z.lijktWeer(laatste.herkend.tekst));
      return done(out.join(' '));
    }

    case 'kosten': {
      // "Wat kost stroom nu": de prijs van dit moment, niet de maand.
      if (question.nu) {
        const p = ctx.prijsNu;
        if (p == null) return done(TAAL_ZIN[lang].geenPrijs);
        const prijs = TAAL_ZIN[lang].prijsNu[p.soort](f.euro('prijs.nu', p.euroPerKwh));
        const zon = snapshot?.explanation.solarProductionW ?? 0;
        return done(zon >= 200 ? `${prijs} ${TAAL_ZIN[lang].zonIsGratis}` : prijs);
      }
      const k = ctx.kosten;
      const met = (k?.apparaten ?? []).filter((a) => a.euro != null && a.kwh > 0).sort((a, b) => b.euro! - a.euro!);
      // Eerst het hele huis: "wat kost de stroom" noemde alleen de airco's.
      const h = k?.huis;
      const huis: string[] = [];
      if (k != null && h != null && h.stroomEuro != null) {
        const stroom = f.euro('kosten.huis.stroom', h.stroomEuro);
        const gas = h.gasEuro != null ? f.euro('kosten.huis.gas', h.gasEuro) : null;
        huis.push(z.kostenHuis(k.maand, stroom, gas, h.terugKwh >= 0.5));
        if (h.totaalEuro != null && h.totaalEuro > h.stroomEuro + (h.gasEuro ?? 0) + 0.5) {
          const totaal = f.euro('kosten.huis.totaal', h.totaalEuro);
          huis.push(z.metVast(totaal));
        }
      }
      if (huis.length > 0 && met.length === 0) return done(huis.join(' '));
      if (k == null || met.length === 0) {
        return done(z.kostenOnbekend);
      }
      const delen = met.slice(0, 3).map((a) => {
        const naam = z.deNaam(a.naam);
        return { id: a.id, naam, kwhRuw: a.kwh, euro: f.euro(`kosten.${a.id}.euro`, a.euro!), zonDeel: a.kwh > 0 ? a.zonKwh / a.kwh : 0 };
      });
      const out: string[] = [...huis];
      if (delen.length === 1) {
        const d = delen[0]!;
        const kwh = f.energy(`kosten.${d.id}.kwh`, d.kwhRuw * 1000);
        out.push(z.kostte(d.naam, k.maand, d.euro, kwh));
      } else {
        const wat = joinList(delen.map((d) => `${d.naam} ${d.euro}`), lang);
        out.push(huis.length ? z.daarvan(wat) : z.inMaand(k.maand, wat));
      }
      const zuinig = delen.filter((d) => d.zonDeel >= 0.6).map((d) => d.naam);
      if (zuinig.length) out.push(z.eigenZon(joinList(zuinig, lang), zuinig.length > 1));
      out.push(huis.length ? z.alleenNetApparaten : z.alleenNet);
      return done(out.join(' '));
    }

    case 'thuis': {
      if (snapshot == null) return letterlijk(noDecision(lang));
      if (config.occupancy.length === 0) {
        return done(z.geenAanwezigheid);
      }
      // Met bewoners op naam, na de rust van tien minuten (besluit 147); anders alleen of er iemand is.
      const p = snapshot.explanation.profile;
      const namen = p ? p.home.map((id) => config.profiles?.find((x) => x.id === id)?.name).filter((n): n is string => n != null) : [];
      if (namen.length > 0) {
        return done(z.zijnThuis(joinList(namen, lang), namen.length > 1));
      }
      return done(snapshot.explanation.occupied ? z.iemandThuis : z.niemandThuis);
    }

    case 'terug': {
      const t = ctx.today;
      const h = ctx.kosten?.huis;
      if (t == null && h == null) return done(ZIN[lang].geenDag);
      const out: string[] = [];
      if (t != null) {
        out.push(t.netTerugWh >= 5 ? z.terugVandaag(f.energy('vandaag.netTerugWh', t.netTerugWh)) : z.nietsTerug);
      }
      if (h != null && ctx.kosten != null && h.terugKwh >= 0.5) {
        const m = f.energy('kosten.huis.terugKwh', h.terugKwh * 1000);
        out.push(z.terugMaand(ctx.kosten.maand, m));
      }
      return done(out.join(' '));
    }

    case 'draait': {
      // De apparaten die op zon wachten (besluit 98): alleen die ziet het huis draaien.
      const lijst = config.deferrables ?? [];
      const gewoon = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const gevraagd = question.apparaat;
      const dit = lijst.filter((a) => gevraagd === '' || gewoon(a.name).includes(gewoon(gevraagd)) || gewoon(gevraagd).includes(gewoon(a.name)) || a.id === gevraagd);
      if (dit.length === 0) {
        const ken = joinList(lijst.map((a) => z.deNaam(a.name)), lang);
        return letterlijk(z.zieNiet(gevraagd, lijst.length ? ken : null));
      }
      if (snapshot == null) return letterlijk(noDecision(lang));
      const zinnen = dit.map((a) => {
        const naam = z.deNaam(a.name);
        const x = snapshot.explanation.deferrables?.find((d) => d.id === a.id);
        if (x == null || x.state === 'unknown') return z.nietTeLezen(naam);
        if (x.doneSinceMs != null) return z.isKlaar(naam);
        if (x.state === 'running') {
          const min = x.remainingMin != null && x.remainingMin > 0 ? f.count(`apparaat.${a.id}.nogMin`, x.remainingMin) : null;
          return z.draaitNog(naam, min);
        }
        if (x.state === 'waiting' || x.state === 'would_start') return z.wachtZon(naam);
        return z.draaitNiet(naam);
      });
      return done(zinnen.join(' '));
    }

    case 'doe': {
      const wait = z.wacht(shadow);
      // Geen kamer in de vraag: met één kamer die het kan, die; anders vragen welke.
      let zone: Zone | undefined;
      if (question.kamer === '') {
        const kan = config.zones.filter((z) => actuatorsOf(config, z).some((a) => question.wens === 'koelen' || question.wens === 'drogen' ? a.capabilities.canCool : question.wens === 'verwarmen' ? a.capabilities.canHeat : true));
        if (kan.length !== 1) {
          const plekken = kan.map((z) => zoneName(z, lang));
          const welke = plekken.length > 1 ? `${plekken.slice(0, -1).join(', ')} ${z.of} ${plekken.at(-1)}` : plekken.join('');
          if (kan.length === 0) return letterlijk(wait);
          // Als keuzes (besluit 209): de zin die de woordzoeker dan zelf verstaat.
          const werkwoord = question.wens === 'verwarmen' || question.wens === 'koelen' ? z.gebod[question.wens] : null;
          const keuze = werkwoord && kan.length <= 4 ? kan.map((z) => ({ label: cap(z.name), tekst: `${werkwoord} ${z.name}` })) : undefined;
          return { ...letterlijk(z.welkeKamer(welke)), ...(keuze ? { keuze } : {}) };
        }
        zone = kan[0];
      } else zone = findZone(config, question.kamer);
      if (zone == null) return letterlijk(unknownRoom(config, question.kamer, lang));
      const w = WORDS[lang];
      const devices = actuatorsOf(config, zone);
      const zn = zoneName(zone, lang);

      if (question.wens === 'uit') {
        const names = joinList(devices.map((a) => deviceName(a, lang)), lang);
        return done(z.danUit(names, wait), zone.id);
      }

      // Aan zonder meer: wat de kamer nodig heeft, of wat het apparaat alleen kan.
      let wens = question.wens;
      if (wens === 'aan') {
        const pz = snapshot?.explanation.perZone.find((p) => p.zoneId === zone.id);
        const kanWarm = devices.some((a) => a.capabilities.canHeat);
        const kanKoel = devices.some((a) => a.capabilities.canCool);
        const buiten = snapshot?.explanation.outdoorTemperatureC ?? null;
        const kouder = pz?.temperatureC != null && pz.targetC != null ? pz.temperatureC < pz.targetC : buiten != null ? buiten < 15 : true;
        wens = kanWarm && (!kanKoel || kouder) ? 'verwarmen' : 'koelen';
      }
      // Via de knoppen van het oude systeem (besluit 210), als de brug aan staat en over deze kamer gaat.
      if ((wens === 'verwarmen' || wens === 'koelen') && ctx.brug) {
        const b = ctx.brug(wens, zone.id, question.temperatuurC, lang);
        if (b?.ok) return { vraag: 'doe', taal: lang, kamer: zone.id, antwoord: b.antwoord, feiten: b.feiten, opdracht: b.opdracht, gedaan: b.gedaan };
        if (b) return letterlijk(b.antwoord, zone.id);
      }
      const heat = wens === 'verwarmen';
      // Drogen kan wat kan koelen: een airco.
      const able = devices.filter((a) => (heat ? a.capabilities.canHeat : a.capabilities.canCool));
      // Verwarmen eerst met wat de basiswarmte levert; koelen kan alleen een airco.
      const device = able.find((a) => a.role === 'primary') ?? able[0];
      if (device == null) {
        return done(z.geenApparaat(zn, w.wish[wens]), zone.id);
      }
      const dn = deviceName(device, lang);
      let target = '';
      // Drogen heeft geen doel.
      if (question.temperatuurC != null && wens !== 'drogen') {
        const [min, max] = device.capabilities.setpointRange;
        if (question.temperatuurC < min || question.temperatuurC > max) {
          const asked = f.temp('vraag.temperatuur', question.temperatuurC);
          const lo = f.temp(`apparaat.${device.id}.minimum`, min);
          const hi = f.temp(`apparaat.${device.id}.maximum`, max);
          return done(z.buitenBereik(asked, dn, lo, hi), zone.id);
        }
        target = f.temp('vraag.temperatuur', question.temperatuurC);
      }
      return done(z.danZetten(dn, w.wish[wens], target, wait), zone.id);
    }
  }
}
