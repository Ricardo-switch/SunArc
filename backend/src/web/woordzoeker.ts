/**
 * De woordzoeker van de assistent (besluit 115): een vraag in eigen woorden,
 * zonder taalmodel. Hij zoekt woorden en kamernamen in de tekst en kiest:
 *
 * - een vraag over het huis, die de vaste vragen van de assistent beantwoorden
 *   ("wat doe je nu", "waarom de zolder", "hoeveel zon", "koel de zolder");
 * - een vraag over de app ("waar vul ik de prijzen in?"), met een kort antwoord
 *   en een knop naar de pagina waar het kan;
 * - of niets, en dan een paar voorbeelden van wat wel kan.
 *
 * Alles hier is vast en getest; de tekst van de bewoner wordt niet bewaard en
 * niet gelogd.
 */

import type { SiteConfig } from '../core/model.js';
import type { Lang, Question, Wish } from './assistant.js';
import { perTaal } from '../taal/index.js';

/** Losse zinnen van dit bestand, per taal (besluit 344). */
const TAAL_ZIN = perTaal('woordzoekerZin');

/** Hoe lang een vraag mag zijn. */
export const MAX_TEKST = 200;

export interface Verwijzing {
  readonly href: string;
  readonly label: string;
}

export type Begrepen =
  | { readonly soort: 'huis'; readonly vraag: Question }
  | { readonly soort: 'app'; readonly onderwerp: string; readonly antwoord: string; readonly link: Verwijzing }
  | { readonly soort: 'onbekend'; readonly antwoord: string; readonly gesproken: string; readonly voorbeelden: readonly string[] };

/** Kleine letters, zonder accenten en leestekens; woorden met één spatie ertussen. */
export function gewoon(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9,]+/g, ' ')
    .replace(/,(?!\d)|(?<!\d),/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Een woord met een sterretje is een begin ("prijs*" past op prijzen); een
 * woord met een spatie is een stukje zin; de rest moet precies kloppen.
 */
function telt(woorden: readonly string[], tekst: string, los: readonly string[]): number {
  let n = 0;
  for (const w of woorden) {
    if (w.includes(' ')) {
      if (` ${tekst} `.includes(` ${w} `)) n += 1;
    } else if (w.endsWith('*')) {
      const begin = w.slice(0, -1);
      if (los.some((t) => t.startsWith(begin))) n += 1;
    } else if (los.includes(w)) n += 1;
  }
  return n;
}

/* --------------------------------------------------------- over de app */

interface Onderwerp {
  readonly id: string;
  readonly href: string;
  /** Sterke woorden tellen dubbel. */
  readonly sterk: readonly string[];
  readonly zwak: readonly string[];
}
/** Wat de assistent zegt per onderwerp, en de tekst op de knop (besluit 344: in de taalbestanden). */
const ONDERWERP_TEKST = perTaal('onderwerpen');

const ONDERWERPEN: readonly Onderwerp[] = [
  {
    id: 'indeling',
    href: 'jehuis.html',
    sterk: ['indeling', 'plattegrond', 'etage*', 'verdieping*', 'buitenruimte*', 'layout', 'floor', 'floors', 'floor plan', 'outdoor space*'],
    zwak: ['kamer toevoegen', 'kamers', 'ruimte*', 'tuin', 'oprit', 'terras', 'balkon', 'voortuin', 'zolder toevoegen', 'kelder', 'rooms', 'add a room', 'garden', 'driveway', 'patio', 'balcony', 'basement'],
  },
  {
    id: 'prijzen',
    href: 'energie.html#prijzen',
    sterk: ['prijs*', 'prijzen', 'tarief*', 'daltarief', 'dal', 'normaal tarief', 'netbeheer*', 'vastrecht', 'vaste kosten', 'contract', 'energieprijs*', 'stroomprijs*', 'gasprijs*', 'teruglever*', 'energiebelasting', 'price*', 'tariff*', 'off peak', 'peak rate', 'standing charge*', 'fixed costs', 'net metering', 'feed in', 'energy tax'],
    zwak: ['kosten', 'meter', 'meters', 'kwh', 'gas', 'stroom', 'energie', 'leverancier', 'rekening', 'electricity', 'supplier', 'bill', 'energy'],
  },
  {
    id: 'aansluiting',
    href: 'energie.html#aansluiting',
    sterk: ['zekering*', 'hoofdzekering*', 'aansluiting', 'fase*', 'ampere', 'omvormer', 'ligging', 'fuse*', 'connection', 'main fuse', 'phase*', 'amp*', 'inverter'],
    zwak: ['panelen', 'zonnepanelen', 'dak', 'dakvlak*', 'netaansluiting', 'panels', 'solar panels', 'roof'],
  },
  {
    // Alle batterijen en filters, ook als niets bijna leeg is (besluit 131).
    id: 'batterijen',
    href: 'thuis.html#batterijen',
    sterk: ['batterij', 'batterijen', 'batterijtje', 'filter', 'filters', 'battery', 'batteries'],
    zwak: ['leeg', 'vervangen', 'vol', 'empty', 'replace', 'flat', 'full'],
  },
  {
    id: 'comfort',
    href: 'comfort.html',
    // Smal: "hoe warm is het op zolder" is een vraag over het huis, geen instelling.
    sterk: ['comfort', 'dagdeel', 'dagdelen', 'nachttemperatuur', 'vakantie', 'part of the day', 'night temperature', 'holiday'],
    zwak: ['temperatuur', 'instellen', 'temperature'],
  },
  {
    id: 'functies',
    href: 'functies.html',
    // Het weer zelf is een vraag over morgen (besluit 142); hier alleen waar het vandaan komt.
    sterk: ['camera*', 'deurbel*', 'bel', 'aanbellen', 'buienradar', 'weerdienst', 'weerbron', 'functie*', 'doorbell', 'weather source', 'feature*'],
    zwak: ['beeld', 'videodeurbel', 'lampen bedienen', 'licht bedienen', 'weer', 'weather', 'video', 'light control'],
  },
  {
    id: 'inrichten',
    href: 'inrichten.html',
    sterk: ['inrichten', 'wizard', 'installeren', 'installatie', 'opzetten', 'beginnen', 'eerste keer', 'setup', 'set up', 'install*', 'getting started', 'first time'],
    zwak: ['stappen', 'begin', 'steps', 'start'],
  },
  {
    id: 'inloggen',
    href: 'toegang.html',
    sterk: ['inloggen', 'inlog*', 'aanmelden', 'uitloggen', 'wachtwoord', 'login', 'log in', 'sign in', 'log out', 'sign out', 'password'],
    zwak: ['account', 'toegang', 'access'],
  },
  {
    id: 'opbrengst',
    href: 'opbrengst.html',
    sterk: ['opbrengst', 'bespaard', 'besparing', 'bespaar*', 'verdiend', 'verdien*', 'terugverdien*', 'savings', 'saved', 'saving', 'earned', 'pay back', 'payback'],
    zwak: ['oplevert', 'oplevering', 'geld', 'euro', 'money', 'yield'],
  },
  {
    id: 'vandaag',
    href: 'vandaag.html',
    sterk: ['verbruik*', 'grafiek', 'tijdlijn', 'usage', 'consumption', 'graph', 'chart', 'timeline'],
    zwak: ['vandaag', 'today'],
  },
  {
    id: 'apparaten',
    href: 'apparaten.html',
    sterk: ['apparaten', 'alle apparaten', 'devices', 'all devices'],
    zwak: ['lijst', 'overzicht', 'list', 'overview'],
  },
  /*
   * De laadpaal en de boiler: "waarom laadt de auto niet
   * sneller", "waar stel ik de laadpaal in" en "waarom zie ik de boiler niet"
   * gingen naar wat het huis nu doet.
   */
  {
    id: 'laadpaal',
    href: 'toevoegen.html#auto',
    sterk: ['laadpaal*', 'laadpunt*', 'laadt', 'laden', 'opladen', 'auto', 'elektrische auto', 'wallbox', 'charger', 'charging', 'charge', 'car', 'ev'],
    zwak: ['sneller', 'langzaam', 'trager', 'snel', 'harder', 'stroom', 'ampere', 'faster', 'slow', 'slower', 'amps'],
  },
  {
    id: 'boiler',
    href: 'apparaten.html',
    sterk: ['boiler*', 'warm water', 'warmwater', 'warmwaterboiler', 'water heater', 'hot water', 'jacuzzi', 'hottub', 'hot tub'],
    zwak: ['tank', 'douche', 'water', 'shower'],
  },
  {
    id: 'bedienen',
    href: 'thuis.html',
    sterk: ['bedien*', 'lamp aan', 'lamp uit', 'licht aan', 'licht uit', 'aanzetten', 'uitzetten', 'scene*', 'operate', 'switch on', 'switch off'],
    zwak: ['lamp', 'lampen', 'licht', 'screen', 'screens', 'thermostaat', 'lights', 'light', 'blinds', 'thermostat'],
  },
  {
    id: 'schakelen',
    href: 'huis-kan.html',
    sterk: ['schaduw*', 'meekijken', 'echt schakelen', 'echt regelen', 'zelf regelen', 'bewijs', 'leert', 'leren', 'shadow', 'watching', 'really switch', 'take over', 'learn*'],
    zwak: ['slim', 'slimme', 'smart'],
  },
];

/**
 * Woorden die zeggen dat het om de app gaat: waar of hoe iets moet. "Hoe" alleen
 * telt niet: "hoe warm is het" en "hoe wordt het weer" gaan over het huis.
 */
const HULP = ['waar', 'hoe stel', 'hoe pas', 'hoe voeg', 'hoe zet', 'hoe kan', 'hoe moet', 'hoe werkt', 'hoe doe', 'hoe vul', 'instel*', 'invul*', 'aanpas*', 'wijzig*', 'verander*', 'toevoeg*', 'voeg', 'verwijder*', 'vind', 'vinden', 'kan ik', 'moet ik', 'where', 'how do', 'how can', 'how to', 'change', 'set', 'add', 'enter', 'edit', 'remove', 'find', 'configure', 'can i', 'do i'];

/* -------------------------------------------------------- over het huis */

const NU = ['nu', 'momenteel', 'op dit moment', 'wat doe je', 'wat doe', 'wat gebeurt', 'gebeurt er', 'bezig', 'now', 'doing', 'right now', 'currently', 'happening', 'status'];
const STRAKS = ['straks', 'later', 'wanneer', 'vanavond', 'vannacht', 'morgen', 'zo meteen', 'gaat doen', 'ga je', 'gaan', 'plan*', 'tonight', 'tomorrow', 'next', 'going to', 'will you', 'when'];
const ZON = ['zon', 'zonnig', 'zonne*', 'zonnestroom', 'opgewekt', 'opwek*', 'zonuren', 'sun', 'sunny', 'solar', 'generated', 'produced', 'panels'];
/** Het weer en de zon van morgen (besluit 142). */
const MORGEN = ['morgen', 'overmorgen', 'regen', 'regent', 'regenen', 'bui', 'buien', 'weer', 'weersverwachting', 'weerbericht', 'tomorrow', 'rain', 'raining', 'shower*', 'weather', 'forecast'];
/** Wat iets kost (besluit 142). */
const KOSTEN = ['kost', 'kosten', 'kostte', 'kostten', 'geld', 'euro', 'cost', 'costs', 'costing', 'money', 'euros', 'how much do', 'how much does', 'how much did'];
/** Het sluipverbruik (besluit 192). */
const SLUIP = ['sluipverbruik', 'sluip*', 'sluimer*', 'standby', 'stand by', 'basislast', 'nachtverbruik', 'verbruik vannacht', 'nachts verbruik', 'baseload', 'base load', 'phantom*', 'vampire', 'idle power', 'overnight use', 'night use'];
/** Of er iemand thuis is, wat er terugging, en of een apparaat draait. */
const THUIS = ['iemand thuis', 'wie is thuis', 'wie is er thuis', 'wie zijn er thuis', 'wie zijn thuis', 'niemand thuis', 'is er iemand', 'anyone home', 'anybody home', 'someone home', 'somebody home', 'who is home', 'who is at home', 'nobody home'];
const TERUG = ['teruggeleverd', 'terugleveren', 'teruglevering', 'terug geleverd', 'terug naar het net', 'terug het net', 'exported', 'export', 'fed back', 'fed in', 'back to the grid', 'sent back'];
const DRAAIT = ['draait', 'draaien', 'draaide', 'aan het draaien', 'klaar', 'bezig', 'running', 'done', 'finished', 'still on'];
/** Waar een opdracht zonder kamer over gaat: alleen klimaat; licht en schermen zijn van de opdrachten (besluit 148). */
const KLIMAAT = ['airco', 'aircos', 'airco’s', 'airconditioning', 'ac', 'verwarming', 'kachel', 'cv', 'warmtepomp', 'heater', 'heating', 'heat pump', 'air conditioner', 'air conditioning', 'aircon'];
const NIET_KLIMAAT = ['licht', 'lichten', 'lamp', 'lampen', 'lampje', 'scène', 'scene', 'scherm', 'schermen', 'zonnescherm', 'rolluik', 'gordijn', 'light', 'lights', 'screen', 'blind', 'blinds', 'awning', 'tv', 'muziek', 'music'];
const MACHINES = ['wasmachine', 'vaatwasser', 'vaatwasmachine', 'droger', 'wasdroger', 'washing machine', 'washer', 'dishwasher', 'dryer', 'tumble dryer'];

const WAAROM = ['waarom', 'hoe komt', 'warm', 'warmer', 'koud', 'kouder', 'heet', 'temperatuur', 'graden', 'wacht', 'why', 'how come', 'hot', 'cold', 'colder', 'temperature', 'degrees', 'waiting'];

/**
 * Een gevoel over de warmte (besluit 209): "het is koud in de woonkamer", "ik
 * heb het warm", "het mag wat warmer". Geen vraag: "waarom is het koud?" en
 * "is het koud op zolder?" blijven vragen.
 */
const KOUD = /\b(koud|kil|fris|frisjes|koukleum\w*|ijskoud|bevries\w*|brr+|cold|chilly|freezing)\b/;
const WARM_GEVOEL = /\b(heet|benauwd|broeierig|plakkerig|bloedheet|snikheet|warm|hot|stuffy|sweltering|too warm)\b/;
const WARMER = /\b(warmer|opwarmen|warm maken|warm zetten|maak het warm|maak het wat warm|warm it up)\b/;
const KOELER = /\b(koeler|kouder|afkoelen|cooler|colder)\b/;
export function gevoelWens(tekst: string): Wish | null {
  if (/^(waarom|hoe|wat|welke|is|zijn|wordt|why|how|what|which|is|are|will)\b/.test(tekst)) return null;
  if (WARMER.test(tekst)) return 'verwarmen';
  if (KOELER.test(tekst)) return 'koelen';
  if (KOUD.test(tekst)) return 'verwarmen';
  if (WARM_GEVOEL.test(tekst)) return 'koelen';
  return null;
}

/** Koel, verwarm of zet uit; null als er geen wens in staat. */
function wensIn(los: readonly string[], tekst: string): Wish | null {
  if (los.some((t) => t.startsWith('koel') || t === 'cool' || t === 'cooling')) return 'koelen';
  // "Warm de zolder op", niet "ik heb het warm op zolder" (besluit 209): dan staat "op" aan het eind.
  if (los.some((t) => t.startsWith('verwarm') || t === 'heat' || t === 'heating') || /\bwarm\b.* op$/.test(tekst) || ` ${tekst} `.includes(' warm up ')) return 'verwarmen';
  const zet = los.includes('zet') || los.includes('doe') || los.includes('turn') || los.includes('switch');
  if (zet && (los.includes('uit') || los.includes('off'))) return 'uit';
  // "Zet de airco aan": aan zonder meer.
  if (zet && (los.includes('aan') || los.includes('on'))) return 'aan';
  return gevoelWens(tekst);
}

/** Een getal met hooguit een decimaal, zoals 22 of 21,5. */
function getalIn(los: readonly string[]): number | null {
  for (const t of los) {
    const m = /^(\d{1,2})(?:[.,](\d))?$/.exec(t.replace(/graden$/, ''));
    if (m) return Number(`${m[1]}.${m[2] ?? '0'}`);
  }
  return null;
}

/**
 * Andere namen voor een kamer: "living room" en "attic"
 * vonden de woonkamer en de zolder niet, en dan ging het antwoord over iets
 * anders. Alleen als er precies één kamer bij past: bij twee slaapkamers raadt
 * hij niet.
 */
const OOK: readonly (readonly [RegExp, readonly string[]])[] = [
  [/woon|living|lounge/, ['woonkamer', 'huiskamer', 'zitkamer', 'living room', 'living', 'lounge', 'sitting room']],
  [/zolder|attic|loft/, ['zolder', 'attic', 'loft']],
  [/slaap|bedroom/, ['slaapkamer', 'bedroom']],
  [/badkamer|bathroom/, ['badkamer', 'bathroom']],
  [/keuken|kitchen/, ['keuken', 'kitchen']],
  [/^(hal|gang)$|hallway/, ['hal', 'gang', 'hall', 'hallway']],
];
function ookNamen(config: SiteConfig, z: SiteConfig['zones'][number]): string[] {
  const past = (re: RegExp, x: SiteConfig['zones'][number]) => re.test(gewoon(x.name)) || re.test(x.id);
  return OOK.filter(([re]) => past(re, z) && config.zones.filter((x) => past(re, x)).length === 1).flatMap(([, w]) => w);
}

/** De kamer die in de tekst staat; bij twee de langste naam. */
/** De kamer na "in de" of "op" aan het eind van een vraag (besluit 341), zonder "nu" erachter: "slaapkamer". */
export function kamerWoord(tekst: string): string | null {
  const kaal = ` ${tekst} `.replace(/ (nu|nou|now|op dit moment|right now|vandaag|today) $/, ' ').trimEnd();
  const m = / (?:in|op|on) (?:de |het |the )?([a-z0-9]+(?: [a-z0-9]+){0,2})$/.exec(kaal);
  return m ? m[1]! : null;
}

function kamerIn(config: SiteConfig, tekst: string): string | null {
  let beste: { id: string; lengte: number } | null = null;
  for (const z of config.zones) {
    for (const naam of [z.name, z.id, ...ookNamen(config, z)]) {
      const n = gewoon(naam.replace(/[-_]+/g, ' '));
      if (n !== '' && ` ${tekst} `.includes(` ${n} `) && (beste == null || n.length > beste.lengte)) {
        beste = { id: z.id, lengte: n.length };
      }
    }
  }
  return beste?.id ?? null;
}

/* ---------------------------------------------------------------- ruis en klaar */

/** Wat de spraakherkenning van een geluid maakt, geen zin: "(noise)", "[Muziek]", "...". */
const RUIS_WOORDEN = new Set(['noise', 'ruis', 'muziek', 'music', 'geluid', 'stilte', 'silence', 'blank audio', 'applaus', 'applause', 'gelach', 'laughter', 'hoest', 'cough', 'inaudible', 'onverstaanbaar', 'achtergrondgeluid', 'background noise']);
/** Wat Whisper verzint bij stilte, van de ondertitels waarmee hij leerde. */
const RUIS_ZINNEN = ['ondertiteld door', 'ondertiteling', 'amara org', 'bedankt voor het kijken', 'bedankt voor het luisteren', 'abonneer', 'thanks for watching', 'subtitles by'];

/**
 * Ruis: alleen geluid, geen woorden. Eerst ging dat door als
 * een vraag; dan stond er "noise" bovenin en zei het huis dat het je niet kon
 * helpen. Nu telt het als niets gezegd.
 */
export function isRuis(ruw: string): boolean {
  const t = ruw.trim();
  // Alles tussen haakjes is een geluid, geen zin.
  if (/^[[(*][^\])*]*[\])*]?\.?$/.test(t)) return true;
  const g = gewoon(t);
  if (g === '') return true;
  return RUIS_WOORDEN.has(g) || RUIS_ZINNEN.some((z) => ` ${g} `.includes(` ${z} `));
}

/* ------------------------------------------------------- bijna goed verstaan */

/** Hoeveel letters er anders zijn tussen twee woorden (Levenshtein). */
export function afstand(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let vorige = d[0]!;
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const nu = d[j]!;
      d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, vorige + (a[i - 1] === b[j - 1] ? 0 : 1));
      vorige = nu;
    }
  }
  return d[b.length]!;
}

/** De eerste letter zoals je hem hoort: s en z, f en v klinken aan het begin hetzelfde. */
const beginKlank = (w: string): string => ({ z: 's', v: 'f' })[w[0] ?? ''] ?? w[0] ?? '';

/** Woorden die er altijd bij horen, naast de namen uit het huis. */
const VASTE_WOORDEN = ['woonkamer', 'slaapkamer', 'keuken', 'zolder', 'badkamer', 'zithoek', 'screens', 'verwarming', 'lampen', 'verlichting', 'sfeerverlichting', 'thuis', 'vanavond', 'warmer', 'kouder', 'koud', 'aanzetten', 'uitzetten'];

/**
 * Gewone woorden die dicht bij een naam liggen, en die het huis dus nooit
 * rechtzet: "zonder" is geen zolder, "kijken" en "komen" zijn geen keuken
 * (gevonden met alle woorden uit de teksten van de app).
 */
const NOOIT_RECHTZETTEN = new Set([
  'zonder', 'kijken', 'komen', 'kopen', 'koper', 'stuk', 'waarmee', 'verwachting', 'kleine', 'koude', 'warme', 'warmere',
  'zitten', 'zetten', 'zeker', 'zelf', 'zoals', 'solar', 'kosten', 'koelen', 'kouden', 'woont', 'wonen', 'warmte', 'verwarmen',
]);

/**
 * Wat Whisper (small-int8) vast verkeerd hoort, en niet op klank te vangen is
 * (besluit 233): gemeten op 1 november 2026 met twintig zinnen van het huis in
 * drie stemmen. Een echt woord ("schreeuwen", "hier") alleen waar het de naam
 * moet zijn; de rest bestaat niet in het Nederlands.
 */
const VERHOORD: readonly (readonly [RegExp, string])[] = [
  [/\b(het|de|kleine|grote) schreeuwen\b/g, '$1 screen'],
  [/\bsk(?:rii|rie|ree)n\b/g, 'screen'],
  [/\bsk(?:rii|rie|ree)(?:n?s|z)\b/g, 'screens'],
  [/\b(?:ijko|ayrko|airko|eirko|ayacot)\b/g, 'airco'],
  [/\bjaken zee\b/g, 'jacuzzi'],
  [/\bplafond hier\b/g, 'plafonniere'],
  [/\bboodschap en lijst\b/g, 'boodschappenlijst'],
  [/\bmorgenzonig\b/g, 'morgen zonnig'],
  [/\bzonig\b/g, 'zonnig'],
  [/\bkoust\b/g, 'koudst'],
  [/\bsezon\b/g, 'de zon'],
  [/\bwel ?te ?r[au]st[eu]?n?e?\b/g, 'welterusten'],
];

/** De soorten van Home Assistant, die in een id staan maar geen woord in je huis zijn. */
const HA_SOORT = new Set(['light', 'lights', 'cover', 'switch', 'scene', 'sensor', 'climate', 'media', 'player', 'binary', 'input', 'number', 'select', 'button', 'group', 'script', 'automation']);

/**
 * Een woord zoals het klinkt: "th" is een t, "oe" een u,
 * "ou", "au" en "eu" een o, "ij" en "ei" een i, lange klinkers kort, s een z,
 * f een v, een d aan het eind een t, en geen h. Zo is "sitoek" de zithoek en
 * "koot" koud: wat een sneller Whisper-model ervan maakte.
 */
export function klank(w: string): string {
  return w
    .replace(/ch/g, 'g')
    .replace(/th/g, 't')
    .replace(/ph/g, 'f')
    .replace(/ck|q/g, 'k')
    .replace(/c(?=[aou]|$)/g, 'k')
    .replace(/c/g, 's')
    .replace(/ij|ei|y/g, 'i')
    .replace(/au|ou|eu/g, 'o')
    .replace(/oe/g, 'u')
    .replace(/ee/g, 'e')
    .replace(/aa/g, 'a')
    .replace(/oo/g, 'o')
    .replace(/uu/g, 'u')
    .replace(/s/g, 'z')
    .replace(/f/g, 'v')
    .replace(/dt$|d$/g, 't')
    .replace(/h/g, '')
    .replace(/(.)\1+/g, '$1');
}

/**
 * Wat Whisper bijna goed verstond, recht gezet (besluit 211): "wonkamer" is de
 * woonkamer, "slabkamer" de slaapkamer, "zoldeer" de zolder, "zette" is "zet
 * de". Alleen naar een naam uit het huis of een vast woord, en alleen als het
 * er heel dicht bij ligt: één letter bij woorden vanaf zes letters, twee vanaf
 * negen, en met dezelfde eerste letter. Geeft de gewone tekst terug (kleine
 * letters, zonder leestekens).
 */
export function verbeter(ruw: string, namen: readonly string[]): string {
  const woordenschat = new Set<string>(VASTE_WOORDEN);
  // Een naam die nog een id is ("light.hal") geeft geen woord: "licht" klinkt als light.
  for (const n of namen) for (const w of gewoon(n).split(' ')) if (w.length >= 5 && !HA_SOORT.has(w)) woordenschat.add(w);
  const lijst = [...woordenschat];
  const woorden = VERHOORD.reduce((t, [vorm, wordt]) => t.replace(vorm, wordt), gewoon(ruw))
    .replace(/\bzette\b/g, 'zet de')
    // "Set de zithoek aan": aan het begin is het zet, en "doet de" is doe de.
    .replace(/^set\b/, 'zet')
    .replace(/^doet (de|het)\b/, 'doe $1')
    .split(' ')
    .filter((w) => w !== '');
  return woorden
    .map((w) => {
      if (w.length < 4 || woordenschat.has(w) || NOOIT_RECHTZETTEN.has(w) || /\d/.test(w)) return w;
      const mag = w.length >= 9 ? 2 : 1;
      let beste: { w: string; d: number } | null = null;
      for (const k of lijst) {
        // Dezelfde eerste letter: "wandkamer" mag geen badkamer worden (dan liever niet begrepen).
        // Een s of z en een f of v tellen als dezelfde: Whisper hoort "solder" voor zolder.
        if (w.length < 6 || beginKlank(k) !== beginKlank(w) || Math.abs(k.length - w.length) > mag) continue;
        const d = afstand(w, k);
        if (d <= mag && (beste == null || d < beste.d)) beste = { w: k, d };
      }
      if (beste) return beste.w;
      // Op klank: gelijk, of één klank anders bij een naam van vijf klanken of meer.
      const kw = klank(w);
      for (const k of lijst) {
        if (beginKlank(k) !== beginKlank(w)) continue;
        const kk = klank(k);
        const d = kw === kk ? 0 : kk.length >= 5 ? afstand(kw, kk) : 9;
        if (d <= 1 && (beste == null || d < beste.d)) beste = { w: k, d };
      }
      return beste?.w ?? w;
    })
    .join(' ');
}

/**
 * Woorden waar een zin niet op eindigt (besluit 208): "zet de lamp in de".
 * Bewust zonder "aan", "uit", "op", "open" en "dicht": daar eindigt een
 * opdracht juist wél op; en zonder "het", "wat" en "dan" ("hoe warm is het",
 * "doe dat dan").
 */
const HALF_EINDE = new Set([
  'de', 'een', 'en', 'of', 'om', 'naar', 'van', 'met', 'bij', 'voor', 'tot', 'als', 'maar', 'in', 'zet', 'doe', 'maak',
  'the', 'a', 'an', 'and', 'or', 'to', 'with', 'for', 'at', 'turn', 'set', 'make',
]);

/**
 * Een gesproken zin die nog niet af is (besluit 208): je hield even je adem in
 * en de microfoon stopte. Dan luistert het huis door en plakt het vervolg
 * erachter, in plaats van te antwoorden op een halve vraag. Alleen bij een
 * zin van meer dan één woord: "Hé huis, de…" is geen begin van iets.
 */
export function isHalf(ruw: string): boolean {
  // Een punt zegt niets: Whisper zet er bijna altijd een achter, ook bij een halve zin.
  const woorden = gewoon(ruw).split(' ').filter((w) => w !== '');
  return woorden.length >= 2 && HALF_EINDE.has(woorden.at(-1)!);
}

/** Woorden die er bij het afsluiten omheen staan: "oké", "top", "hé huis". */
const VULWOORDEN = new Set(['oke', 'ok', 'okay', 'oké', 'okee', 'prima', 'top', 'super', 'mooi', 'fijn', 'goed', 'hoor', 'huis', 'he', 'hey', 'hee', 'nou', 'heel', 'erg', 'alright', 'great', 'fine', 'perfect']);
/** Wat het gesprek afsluit, na de vulwoorden. Leeg ("oké") ook. */
const AFSLUITERS = new Set([
  '', 'bedankt', 'dank je', 'dank je wel', 'dankjewel', 'dank u', 'dank u wel', 'dankuwel', 'thanks', 'thank you', 'merci',
  'nee', 'nee dank je', 'nee dank je wel', 'nee dankjewel', 'nee bedankt', 'nee hoor', 'no', 'no thanks', 'no thank you',
  'dat was het', 'dat was alles', 'dat is alles', 'dat is het', 'dat was t', 'verder niks', 'verder niets', 'niks', 'niets', 'niks meer', 'niets meer', 'laat maar',
  'klaar', 'tot ziens', 'tot zo', 'doei', 'dag', 'later', 'welterusten', 'slaap lekker', 'thats all', 'thats it', 'nothing', 'goodbye', 'bye', 'good night',
]);

/** Hoe het huis afscheid neemt, met wat afwisseling (besluit 225). De eerste is de gewone. */
const AFSCHEID = perTaal('afscheid');

/**
 * "Oké bedankt" of "dat was het": het gesprek is klaar. Het
 * huis zegt iets terug en luistert niet verder. Null als het geen afsluiter is.
 * Welke variant, wisselt per uur (besluit 225).
 */
export function afsluiter(ruw: string, lang: Lang, nuMs: number = Date.now()): string | null {
  const woorden = gewoon(ruw).split(' ').filter((w) => w !== '');
  if (woorden.length === 0 || woorden.length > 6) return null;
  const rest = woorden.filter((w) => !VULWOORDEN.has(w)).join(' ');
  if (!AFSLUITERS.has(rest)) return null;
  const a = AFSCHEID[lang];
  const kies = (lijst: readonly string[]) => lijst[Math.floor(nuMs / 3_600_000) % lijst.length]!;
  if (/welterusten|slaap lekker|good night/.test(rest)) return kies(a.slaap);
  if (/tot ziens|tot zo|doei|^dag$|later|goodbye|bye/.test(rest)) return kies(a.dag);
  if (/dank|bedankt|thank|merci/.test(rest)) return kies(a.dank);
  return kies(a.rest);
}

/* ---------------------------------------------------------------- kiezen */

/** Wat je kunt vragen; elk voorbeeld verstaat de woordzoeker zelf (een test houdt dat zo). */
export function voorbeelden(_config: SiteConfig, lang: Lang): string[] {
  return lang === 'nl'
    ? ['Wat doe je nu?', 'Hoe warm is het overal?', 'Wat wordt het weer morgen?', 'Wat kosten de airco’s?', 'Waar vul ik de prijzen in?']
    : ['What are you doing now?', 'How warm is it everywhere?', 'What is the weather tomorrow?', 'What do the air conditioners cost?', 'Where do I enter the prices?'];
}

/** Leest een vraag in eigen woorden. */
export function begrijp(ruw: string, config: SiteConfig, lang: Lang): Begrepen {
  const tekst = gewoon(ruw.slice(0, MAX_TEKST));
  const los = tekst === '' ? [] : tekst.split(' ');

  // De app: sterke woorden tellen dubbel, en "waar" of "hoe" geeft een duwtje.
  const hulp = telt(HULP, tekst, los) > 0;
  let app: { o: Onderwerp; score: number } | null = null;
  for (const o of ONDERWERPEN) {
    const sterk = telt(o.sterk, tekst, los);
    const zwak = telt(o.zwak, tekst, los);
    if (sterk + zwak === 0) continue;
    const score = sterk * 2 + zwak + (hulp ? 1 : 0);
    if (app == null || score > app.score) app = { o, score };
  }

  // Het huis: een kamer, een wens, of een van de vaste vragen.
  const kamer = kamerIn(config, tekst);
  const waarom = telt(WAAROM, tekst, los);
  const wens = wensIn(los, tekst);
  const huis: { vraag: Question; score: number }[] = [];
  // Zonder kamer zoekt de assistent zelf de kamer die het kan, of vraagt welke.
  const klimaat = telt(KLIMAAT, tekst, los) > 0;
  const nietKlimaat = telt(NIET_KLIMAAT, tekst, los) > 0;
  const gevoel = gevoelWens(tekst) != null && !nietKlimaat;
  if (wens != null && !los.includes('waarom') && !los.includes('why') && !((wens === 'aan' || wens === 'uit') && nietKlimaat) && (kamer != null || klimaat || gevoel)) {
    // Een gevoel wint van de vraag waarom (besluit 209): "het is koud in de woonkamer" is een wens.
    huis.push({ vraag: { kind: 'doe', kamer: kamer ?? '', wens, temperatuurC: getalIn(los) }, score: kamer != null ? 4 + (gevoel ? 2 : 0) : gevoel ? 6 : 3 });
  }
  if (kamer != null) huis.push({ vraag: { kind: 'waarom', kamer }, score: 2 + waarom });
  const straks = telt(STRAKS, tekst, los);
  if (straks) huis.push({ vraag: { kind: 'straks' }, score: 2 * straks });
  const zon = telt(ZON, tekst, los);
  if (zon) huis.push({ vraag: { kind: 'zon' }, score: 2 * zon });
  // Wat het huis vandaag deed, en hoe warm het overal is (besluit 141).
  const vandaag = telt(['vandaag gedaan', 'wat deed je', 'heb je gedaan', 'vandaag besloten', 'besloten', 'today did', 'what did you do', 'what have you done', 'did you do', 'decided'], tekst, los);
  if (vandaag) huis.push({ vraag: { kind: 'vandaag' }, score: 3 * vandaag });
  const overal = telt(['overal', 'alle kamers', 'elke kamer', 'in huis', 'everywhere', 'every room', 'all rooms', 'in the house', 'whole house'], tekst, los);
  if (overal && kamer == null && telt(['warm', 'koud', 'temperatuur', 'graden', 'temperature', 'hot', 'cold', 'degrees'], tekst, los)) huis.push({ vraag: { kind: 'warm' }, score: 5 });
  // "Hoe warm is het in de slaapkamer" voor een kamer zonder regeling (besluit 341): de assistent zoekt hem in de indeling.
  else if (kamer == null && telt(['hoe warm', 'hoe koud', 'hoeveel graden', 'welke temperatuur', 'how warm', 'how cold', 'what temperature', 'how many degrees'], tekst, los)) {
    const plek = kamerWoord(tekst);
    huis.push({ vraag: plek ? { kind: 'warm', kamer: plek } : { kind: 'warm' }, score: 4 });
  }
  // Wat de boiler of de jacuzzi nu doet (besluit 341); "waarom zie ik de boiler niet" blijft een vraag over de app.
  const water = telt(['boiler*', 'warm water', 'warmwater', 'water heater', 'hot water', 'jacuzzi', 'hottub', 'hot tub', 'bubbelbad'], tekst, los);
  if (water && !telt(['zie', 'zien', 'niet', 'see', 'not', 'waar', 'where'], tekst, los)) huis.push({ vraag: { kind: 'boiler', naam: tekst.match(/jacuzzi|hot ?tub|bubbelbad|boilerw*|warm ?water|water heater|hot water/)?.[0] ?? '' }, score: 5 });
  // Het weer van morgen, en wat iets kost (besluit 142).
  const morgen = telt(MORGEN, tekst, los);
  // Het weer zonder morgen erbij gaat over vandaag (besluit 166): "wat voor weer wordt het vandaag?".
  const overMorgen = telt(['morgen', 'overmorgen', 'tomorrow'], tekst, los) > 0;
  if (morgen && kamer == null) huis.push({ vraag: { kind: overMorgen ? 'morgen' : 'weer' }, score: 3 * morgen });
  const kosten = telt(KOSTEN, tekst, los);
  if (kosten) huis.push({ vraag: { kind: 'kosten' }, score: 3 * kosten });
  const sluip = telt(SLUIP, tekst, los);
  if (sluip) huis.push({ vraag: { kind: 'sluip' }, score: 6 * sluip });
  const thuis = telt(THUIS, tekst, los);
  if (thuis) huis.push({ vraag: { kind: 'thuis' }, score: 5 * thuis });
  const terug = telt(TERUG, tekst, los);
  if (terug) huis.push({ vraag: { kind: 'terug' }, score: 4 * terug });
  // Een apparaat dat op zon wacht, bij zijn naam of een gewone naam; wat het kost, blijft kosten.
  const machine = (config.deferrables ?? []).map((a) => gewoon(a.name)).find((n) => n !== '' && ` ${tekst} `.includes(` ${n} `)) ?? MACHINES.find((m) => ` ${tekst} `.includes(` ${m} `)) ?? null;
  if (machine != null && !kosten) huis.push({ vraag: { kind: 'draait', apparaat: machine }, score: 3 + 2 * telt(DRAAIT, tekst, los) });
  const nu = telt(NU, tekst, los);
  // "Waarom staat de airco aan?" zonder kamer gaat over wat hij nu doet.
  if (nu || (waarom && kamer == null)) huis.push({ vraag: { kind: 'nu' }, score: Math.max(1, 2 * nu - 1) });
  const beste = huis.sort((a, b) => b.score - a.score)[0];

  // Een hulpvraag over de app wint van het huis; anders telt de hoogste.
  if (app != null && (hulp || beste == null || app.score > beste.score)) {
    const t = ONDERWERP_TEKST[lang][app.o.id as keyof (typeof ONDERWERP_TEKST)['nl']];
    return { soort: 'app', onderwerp: app.o.id, antwoord: t.antwoord, link: { href: app.o.href, label: t.label } };
  }
  if (beste != null) return { soort: 'huis', vraag: beste.vraag };
  const vb = voorbeelden(config, lang);
  // Hardop zijn er geen knoppen: dan noemt de zin zelf twee voorbeelden (besluit 166).
  const twee = vb.slice(0, 2).map((t) => `"${t.replace(/\?$/, '')}"`);
  return {
    soort: 'onbekend',
    antwoord:
      TAAL_ZIN[lang].datBegrijpIkNog,
    gesproken: TAAL_ZIN[lang].datBegrijpIkNog2(twee.join(' of '), twee.join(' or ')),
    voorbeelden: vb,
  };
}
