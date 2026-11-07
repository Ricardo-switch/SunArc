/**
 * Wat stroom en gas kosten, zoals een Nederlands contract het zegt (besluit 110).
 *
 * Een contract kent een normaal- en een daltarief, of één tarief; vaste posten
 * per dag, maand of jaar (vaste leveringskosten, netbeheer, en de vermindering
 * energiebelasting als aftrek); en voor teruglevering het salderen tot 2027,
 * daarna een vergoeding en terugleverkosten per kWh. Dit bestand rekent het
 * uit; het weet niets van meters of Home Assistant.
 *
 * Welke kWh dal is: bij voorkeur zegt de meter het (tarief 1 en tarief 2 van de
 * slimme meter). Anders de tijden van het daltarief: op werkdagen van 23 tot 7
 * uur (in Noord-Brabant en Limburg van 21 tot 7), en het hele weekend en de
 * feestdagen.
 *
 * Buiten Nederland (besluit 178): eigen daltijden, met of zonder het weekend en
 * zonder de Nederlandse feestdagen, en geen salderen.
 */

import type { Lang } from './assistant.js';
import { valutaTeken } from './valuta.js';

export type DalRegio = 'nl' | 'zuid' | 'eigen';

/** Eigen daltijden (besluit 178): van welk uur tot welk uur, en of het weekend helemaal dal is. */
export interface DalEigen {
  readonly van: number;
  readonly tot: number;
  readonly weekend: boolean;
}
export type VastPer = 'dag' | 'maand' | 'jaar';
export type VastSoort = 'stroom' | 'gas';

export interface VastePost {
  readonly naam: string;
  /** Euro; negatief voor een aftrek, zoals de vermindering energiebelasting. */
  readonly bedrag: number;
  readonly per: VastPer;
  readonly soort: VastSoort;
}

export interface Tarieven {
  /** Euro per kWh van het net, alles erin; bij dubbel tarief het normaaltarief. */
  readonly stroom: number | null;
  /** Het daltarief; null is één tarief. */
  readonly stroomDal?: number | null;
  /** Waar het huis staat, voor de tijden van het daltarief. */
  readonly dalUren?: DalRegio;
  /** De tijden bij `dalUren: 'eigen'` (besluit 178). */
  readonly dalEigen?: DalEigen | null;
  /** Of er gesaldeerd wordt (tot 2027, zoals in Nederland); false is nooit (besluit 178). Weg is wel. */
  readonly salderen?: boolean;
  /** Wat je krijgt voor wat je over een jaar meer teruglevert dan je verbruikt (zolang er gesaldeerd wordt). */
  readonly teruglevering: number | null;
  /** Vanaf 2027, als het salderen stopt. */
  readonly vanaf2027?: { readonly vergoeding: number | null; readonly kosten: number | null };
  /** Euro per m³ gas. */
  readonly gas: number | null;
  /** De vaste posten van het contract. */
  readonly vast?: readonly VastePost[];
  /**
   * De startdatum van het contract, "2025-03-15" (besluit 116). Het jaar van
   * Opbrengst en de jaarafrekening lopen dan van die dag tot dezelfde dag een
   * jaar later; zonder datum is het een kalenderjaar.
   */
  readonly contractStart?: string | null;
  /** Oud: alle vaste kosten samen per maand. Geldt alleen zolang er geen vaste posten zijn. */
  readonly vastPerMaand: number | null;
  /**
   * Een prijs per uur of kwartier (testerronde, november 2026), zoals
   * Zonneplan, Tibber of Frank: de entiteit met de prijs van nu, en per meter de
   * kostenteller die Home Assistant zelf bijhoudt met die prijs. Dan rekent
   * Opbrengst met die tellers in plaats van met één vaste prijs.
   */
  readonly dynamisch?: Dynamisch | null;
}

export interface Dynamisch {
  readonly prijsEntiteit: string | null;
  /** De kostentellers bij de afname, zoals `sensor.p1_afname_cost`. */
  readonly afname: readonly string[];
  /** De vergoeding bij de teruglevering, zoals `sensor.p1_terug_compensation`. */
  readonly terug: readonly string[];
  /**
   * De kostenteller van het gas (issue 128): bij Zonneplan, Tibber en Frank
   * verschilt ook de gasprijs per dag. Zonder teller telt gas tegen de prijs bij
   * Contract en prijzen.
   */
  readonly gas?: string | null;
}

/** Het salderen stopt op 1 januari 2027, middernacht in Nederland. */
export const SALDEREN_TOT_MS = Date.UTC(2026, 11, 31, 23, 0, 0);

const DAG_MS = 86_400_000;

/* ---------------------------------------------------------------- daltijden */

/** Eén opmaak per tijdzone: een jaar per uur is 8760 keer, en een nieuwe opmaak is traag. */
const opmaak = new Map<string, Intl.DateTimeFormat>();
function delen(ms: number, tz: string): { y: number; m: number; d: number; h: number; wd: number } {
  let f = opmaak.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23', weekday: 'short' });
    opmaak.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p['weekday'] ?? '');
  return { y: Number(p['year']), m: Number(p['month']), d: Number(p['day']), h: Number(p['hour']), wd };
}

/** Eerste paasdag (Gregoriaans, Meeus/Jones/Butcher), als [maand, dag]. */
function pasen(y: number): [number, number] {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const maand = Math.floor((h + l - 7 * m + 114) / 31);
  const dag = ((h + l - 7 * m + 114) % 31) + 1;
  return [maand, dag];
}

/** De feestdagen waarop het daltarief de hele dag geldt. */
export function isFeestdag(y: number, m: number, d: number): boolean {
  const [pm, pd] = pasen(y);
  const paas = Date.UTC(y, pm - 1, pd);
  const dag = Date.UTC(y, m - 1, d);
  const naPasen = Math.round((dag - paas) / DAG_MS);
  // Tweede paasdag, Hemelvaart, tweede pinksterdag.
  if (naPasen === 1 || naPasen === 39 || naPasen === 50) return true;
  // Nieuwjaar, Koningsdag (op zondag een dag eerder), eerste en tweede kerstdag.
  const koningsdag = new Date(Date.UTC(y, 3, 27)).getUTCDay() === 0 ? 26 : 27;
  return (m === 1 && d === 1) || (m === 4 && d === koningsdag) || (m === 12 && (d === 25 || d === 26));
}

/** Geldt op dit moment het daltarief? */
export function isDal(ms: number, tz: string, regio: DalRegio = 'nl', eigen: DalEigen | null = null): boolean {
  const p = delen(ms, tz);
  if (regio === 'eigen' && eigen) {
    if (eigen.weekend && (p.wd === 0 || p.wd === 6)) return true;
    // Over middernacht (23 tot 7) of binnen een dag (1 tot 6).
    return eigen.van > eigen.tot ? p.h >= eigen.van || p.h < eigen.tot : p.h >= eigen.van && p.h < eigen.tot;
  }
  if (p.wd === 0 || p.wd === 6 || isFeestdag(p.y, p.m, p.d)) return true;
  return p.h < 7 || p.h >= (regio === 'zuid' ? 21 : 23);
}

/** Welk deel van [van, tot) in het daltarief valt, per uur geteld. */
export function dalAandeel(van: number, tot: number, tz: string, regio: DalRegio = 'nl', eigen: DalEigen | null = null): number {
  if (tot <= van) return 0;
  let dal = 0;
  let alle = 0;
  for (let t = van; t < tot; t += 3_600_000) {
    alle += 1;
    if (isDal(t, tz, regio, eigen)) dal += 1;
  }
  return alle ? dal / alle : 0;
}

/**
 * Telt deze meter het daltarief? Een slimme meter heeft twee telwerken; in
 * Nederland is tarief 1 het lage (dal) en tarief 2 het normale.
 */
export function raadDal(id: string): boolean {
  return /(?:tarief|tariff|tarif)[ _-]?1(?![0-9])|_t1(?![0-9a-z])|\blaag\b|\blow\b|dal[ _-]?tarief|(?:^|[^a-z])dal(?:[^a-z]|$)/i.test(id);
}

/* ---------------------------------------------------------------- de kosten */

export interface Gebruik {
  readonly afNormaal: number;
  readonly afDal: number;
  /** Teruggeleverd zolang er gesaldeerd wordt. */
  readonly terugNormaal: number;
  readonly terugDal: number;
  /** Teruggeleverd vanaf 2027. */
  readonly terugNa: number;
  readonly gasM3: number;
  /** Hoe lang de periode is, in dagen. */
  readonly dagen: number;
  /** Een heel jaar: dan telt wat je meer teruglevert dan je verbruikt apart. */
  readonly heelJaar: boolean;
}

export interface KostenRegel {
  /** Wat voor regel het is, als vaste code (besluit 185): de naam verschilt per taal. */
  readonly soort: 'stroom' | 'normaal' | 'dal' | 'terug' | 'terug-na' | 'gas' | 'vast';
  readonly naam: string;
  readonly uitleg: string;
  readonly euro: number | null;
}

export interface Kosten {
  readonly regels: readonly KostenRegel[];
  /** Stroom, teruglevering en gas samen; null zonder enige prijs. */
  readonly variabel: number | null;
  /** De vaste posten samen; null als ze niet ingesteld zijn. */
  readonly vast: number | null;
  /** Wat een kWh van het net gemiddeld kostte, voor de kosten per apparaat. */
  readonly stroomPerKwh: number | null;
  /**
   * Welke regels deels geschat zijn (issue 128): Home Assistant telde de
   * kosten een deel van de tijd niet, en dat deel telt tegen je gemiddelde.
   */
  readonly geschat?: readonly ('stroom' | 'terug' | 'gas')[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const komma = (s: string, lang: Lang) => (lang === 'nl' ? s.replace('.', ',') : s);
/** Een prijs zoals op het contract: tot vijf decimalen, minstens twee. */
const eur = (n: number, lang: Lang) => `${valutaTeken(lang)} ${komma(Math.abs(n) < 10 ? n.toFixed(5).replace(/0{1,3}$/, '') : n.toFixed(2), lang)}`;
const kwh = (n: number, lang: Lang) => `${komma(String(Math.round(n * 10) / 10), lang)} kWh`;
const m3 = (n: number, lang: Lang) => `${komma(String(r2(n)), lang)} m³`;

/** De namen en uitleg van de kostenregels, per taal (besluit 185). Engels is Brits. */
const WOORDEN = {
  nl: {
    stroom: 'Stroom van het net',
    normaal: 'Stroom normaal',
    dal: 'Stroom dal',
    terug: 'Teruggeleverd',
    terugNa: 'Teruggeleverd, zonder salderen',
    gas: 'Gas',
    vastStroom: 'Vaste kosten stroom',
    vastGas: 'Vaste kosten gas',
    vast: 'Vaste kosten',
    geenPrijs: (wat: string) => `${wat}, prijs nog niet ingesteld`,
    keer: (wat: string, prijs: string) => `${wat} × ${prijs}`,
    gesaldeerdGeenPrijs: (wat: string) => `${wat}, gesaldeerd; prijs nog niet ingesteld`,
    gesaldeerdBoven: (gesaldeerd: string, boven: string, prijs: string) => `${gesaldeerd} gesaldeerd, ${boven} boven je verbruik × ${prijs}`,
    gesaldeerd: (wat: string) => `${wat}, gesaldeerd tegen je stroomprijs`,
    geenVergoeding: (wat: string, vanaf2027: boolean) => `${wat}, vergoeding${vanaf2027 ? ' vanaf 2027' : ''} nog niet ingesteld`,
    vergoeding: (wat: string, prijs: string, kosten: string | null) => `${wat} × ${prijs} vergoeding${kosten ? `, min ${kosten} kosten` : ''}`,
    perMaand: (prijs: string) => `${prijs} per maand`,
    nietIngesteld: 'nog niet ingesteld',
    uurprijs: (wat: string) => `${wat}, met de prijs van elk uur, zoals Home Assistant telt`,
    zoalsHa: (wat: string) => `${wat}, zoals Home Assistant telt`,
    deels: (uitleg: string, open: string) => `${uitleg}; ${open} geschat tegen je gemiddelde`,
    boven: (uitleg: string, boven: string, prijs: string) => `${uitleg}; ${boven} boven je verbruik × ${prijs}`,
  },
  en: {
    stroom: 'Electricity from the grid',
    normaal: 'Electricity, normal rate',
    dal: 'Electricity, off-peak',
    terug: 'Exported',
    terugNa: 'Exported, without net metering',
    gas: 'Gas',
    vastStroom: 'Fixed costs electricity',
    vastGas: 'Fixed costs gas',
    vast: 'Fixed costs',
    geenPrijs: (wat: string) => `${wat}, price not set yet`,
    keer: (wat: string, prijs: string) => `${wat} × ${prijs}`,
    gesaldeerdGeenPrijs: (wat: string) => `${wat}, net metered; price not set yet`,
    gesaldeerdBoven: (gesaldeerd: string, boven: string, prijs: string) => `${gesaldeerd} net metered, ${boven} above your use × ${prijs}`,
    gesaldeerd: (wat: string) => `${wat}, net metered at your electricity price`,
    geenVergoeding: (wat: string, vanaf2027: boolean) => `${wat}, payment${vanaf2027 ? ' from 2027' : ''} not set yet`,
    vergoeding: (wat: string, prijs: string, kosten: string | null) => `${wat} × ${prijs} payment${kosten ? `, minus ${kosten} costs` : ''}`,
    perMaand: (prijs: string) => `${prijs} a month`,
    nietIngesteld: 'not set yet',
    uurprijs: (wat: string) => `${wat}, at the price of each hour, as Home Assistant counts`,
    zoalsHa: (wat: string) => `${wat}, as Home Assistant counts`,
    deels: (uitleg: string, open: string) => `${uitleg}; ${open} estimated at your average`,
    boven: (uitleg: string, boven: string, prijs: string) => `${uitleg}; ${boven} above your use × ${prijs}`,
  },
} satisfies Record<Lang, unknown>;

/**
 * Wat de kostentellers van Home Assistant telden, over de uren (of dagen)
 * waarin ze telden (issue 128). Null: geen teller, of hij telde in die tijd
 * nog niet. Met de kWh en m³ van precies die uren.
 */
export interface Tellers {
  readonly af: number | null;
  readonly afKwh: number;
  readonly terug: number | null;
  readonly terugKwh: number;
  readonly gas: number | null;
  readonly gasM3: number;
}

/** Wat Home Assistant niet telde: het gebruik van de andere uren. */
export type Open = Pick<Gebruik, 'afNormaal' | 'afDal' | 'terugNormaal' | 'terugDal' | 'terugNa' | 'gasM3'>;

const KLEIN = 1e-9;
const somVan = (regels: readonly KostenRegel[]) => (regels.some((r) => r.euro == null) ? null : regels.reduce((t, r) => t + r.euro!, 0));

/**
 * De kosten bij een prijs per uur (testerronde, november 2026; mengvorm,
 * issue 128): stroom, teruglevering en gas zoals de kostentellers van Home
 * Assistant ze telden. De uren waarin Home Assistant nog niet telde, tellen
 * tegen je gemiddelde (dat van de uren die hij wel telde, anders de prijs bij
 * Contract en prijzen) en heten dan deels geschat. Wat
 * Home Assistant niet kent, komt uit de app: de vaste posten, en over een heel
 * jaar wat je boven je verbruik teruglevert, tegen de vergoeding. Zonder
 * teller precies `kostenVan`.
 *
 * `g` is het gebruik over de hele periode, `open` het deel zonder teller.
 */
export function kostenMetTellers(
  p: Tarieven,
  g: Gebruik,
  open: Open,
  t: Tellers,
  heeft: { readonly net: boolean; readonly terug: boolean; readonly gas: boolean },
  lang: Lang = 'nl',
): Kosten {
  if (t.af == null && t.terug == null && t.gas == null) return kostenVan(p, g, heeft, lang);
  const w = WOORDEN[lang];
  const afGemiddeld = t.af != null && t.afKwh > KLEIN ? t.af / t.afKwh : null;
  const gasGemiddeld = t.gas != null && t.gasM3 > KLEIN ? t.gas / t.gasM3 : null;
  // Het deel zonder teller, tegen je gemiddelde: dat van de uren die Home Assistant wel telde,
  // anders de prijs bij Contract en prijzen. De vaste posten over de hele periode.
  const prijzen: Tarieven = {
    ...p,
    ...(t.af != null ? { stroom: afGemiddeld ?? p.stroom, stroomDal: null } : {}),
    gas: gasGemiddeld ?? p.gas,
  };
  const k = kostenVan(prijzen, { ...open, dagen: g.dagen, heelJaar: false }, heeft, lang);
  const van = (soorten: readonly KostenRegel['soort'][]) => k.regels.filter((r) => soorten.includes(r.soort));
  const geschat: ('stroom' | 'terug' | 'gas')[] = [];
  const regels: KostenRegel[] = [];

  // Stroom van het net.
  const openAf = open.afNormaal + open.afDal;
  if (t.af != null) {
    const deels = openAf > KLEIN;
    const rest = deels ? somVan(van(['stroom', 'normaal', 'dal'])) : 0;
    if (deels) geschat.push('stroom');
    const uitleg = w.uurprijs(kwh(t.afKwh, lang));
    regels.push({ soort: 'stroom', naam: w.stroom, uitleg: deels ? w.deels(uitleg, kwh(openAf, lang)) : uitleg, euro: rest == null ? null : r2(t.af + rest) });
  } else regels.push(...van(['stroom', 'normaal', 'dal']));

  // Teruglevering: zolang er gesaldeerd wordt de regel `terug`, daarna apart.
  const openTerug = open.terugNormaal + open.terugDal;
  let terugKwh = openTerug;
  if (t.terug != null) {
    const deels = openTerug > KLEIN;
    const rest = deels ? somVan(van(['terug'])) : 0;
    if (deels) geschat.push('terug');
    terugKwh = t.terugKwh + openTerug;
    const uitleg = w.uurprijs(kwh(t.terugKwh, lang));
    regels.push({ soort: 'terug', naam: w.terug, uitleg: deels ? w.deels(uitleg, kwh(openTerug, lang)) : uitleg, euro: rest == null ? null : r2(-t.terug + rest) });
    regels.push(...van(['terug-na']));
  } else regels.push(...van(['terug', 'terug-na']));

  // Over een heel jaar: wat je meer teruglevert dan je verbruikt, krijg je tegen de vergoeding, niet tegen de prijs van het uur.
  const boven = g.heelJaar && p.salderen !== false && p.teruglevering != null ? Math.max(0, g.terugNormaal + g.terugDal - (g.afNormaal + g.afDal)) : 0;
  const i = regels.findIndex((r) => r.soort === 'terug');
  const terugRegel = i >= 0 ? regels[i]! : null;
  if (boven > KLEIN && terugRegel?.euro != null && terugKwh > KLEIN) {
    const perKwh = -terugRegel.euro / terugKwh;
    const minder = Math.max(0, perKwh - p.teruglevering!) * Math.min(boven, terugKwh);
    regels[i] = { ...terugRegel, uitleg: w.boven(terugRegel.uitleg, kwh(boven, lang), eur(p.teruglevering!, lang)), euro: r2(terugRegel.euro + minder) };
  }

  // Gas.
  if (t.gas != null) {
    const deels = open.gasM3 > KLEIN;
    const rest = deels ? somVan(van(['gas'])) : 0;
    if (deels) geschat.push('gas');
    const uitleg = w.zoalsHa(m3(t.gasM3, lang));
    regels.push({ soort: 'gas', naam: w.gas, uitleg: deels ? w.deels(uitleg, m3(open.gasM3, lang)) : uitleg, euro: rest == null ? null : r2(t.gas + rest) });
  } else regels.push(...van(['gas']));

  regels.push(...van(['vast']));
  const heeftBedrag = regels.some((r) => r.soort !== 'vast' && r.euro != null);
  const variabel = regels.filter((r) => r.soort !== 'vast').reduce((som, r) => som + (r.euro ?? 0), 0);
  const af = g.afNormaal + g.afDal;
  const stroomEuro = regels.find((r) => r.soort === 'stroom')?.euro ?? null;
  return {
    regels,
    variabel: heeftBedrag ? r2(variabel) : null,
    vast: k.vast,
    stroomPerKwh: t.af != null && stroomEuro != null && af > KLEIN ? stroomEuro / af : (afGemiddeld ?? k.stroomPerKwh),
    ...(geschat.length ? { geschat } : {}),
  };
}

/**
 * Welke regels gebruik hadden maar geen bedrag (issue 128): die tellen in het
 * totaal als nul, en dat moet erbij staan. Eerst stroom, dan teruglevering, dan gas.
 */
export function zonderPrijs(regels: readonly KostenRegel[]): ('stroom' | 'terug' | 'gas')[] {
  const uit: ('stroom' | 'terug' | 'gas')[] = [];
  const mist = (soorten: readonly KostenRegel['soort'][]) => regels.some((r) => soorten.includes(r.soort) && r.euro == null);
  if (mist(['stroom', 'normaal', 'dal'])) uit.push('stroom');
  if (mist(['terug', 'terug-na'])) uit.push('terug');
  if (mist(['gas'])) uit.push('gas');
  return uit;
}

/** Een vaste post over een periode van zoveel dagen. */
export function vastOver(post: VastePost, dagen: number): number {
  if (post.per === 'dag') return post.bedrag * dagen;
  if (post.per === 'maand') return (post.bedrag * dagen) / 30.4375;
  return (post.bedrag * dagen) / 365.25;
}

export function kostenVan(p: Tarieven, u: Gebruik, heeft: { readonly net: boolean; readonly terug: boolean; readonly gas: boolean }, lang: Lang = 'nl'): Kosten {
  const w = WOORDEN[lang];
  const regels: KostenRegel[] = [];
  const dubbel = p.stroomDal != null;
  const normaal = p.stroom;
  const dal = dubbel ? p.stroomDal! : p.stroom;
  let variabel: number | null = null;
  const tel = (euro: number | null) => {
    if (euro != null) variabel = (variabel ?? 0) + euro;
    return euro == null ? null : r2(euro);
  };

  // Stroom van het net.
  const af = u.afNormaal + u.afDal;
  if (heeft.net) {
    if (!dubbel) {
      regels.push({ soort: 'stroom', naam: w.stroom, uitleg: normaal == null ? w.geenPrijs(kwh(af, lang)) : w.keer(kwh(af, lang), eur(normaal, lang)), euro: tel(normaal == null ? null : af * normaal) });
    } else {
      regels.push({ soort: 'normaal', naam: w.normaal, uitleg: normaal == null ? w.geenPrijs(kwh(u.afNormaal, lang)) : w.keer(kwh(u.afNormaal, lang), eur(normaal, lang)), euro: tel(normaal == null ? null : u.afNormaal * normaal) });
      regels.push({ soort: 'dal', naam: w.dal, uitleg: w.keer(kwh(u.afDal, lang), eur(dal!, lang)), euro: tel(u.afDal * dal!) });
    }
  }
  const afEuro = normaal == null ? null : u.afNormaal * normaal + u.afDal * (dal ?? normaal);

  // Teruglevering: salderen tegen het eigen tarief, wat er over een jaar meer
  // terugging dan je verbruikte tegen de vergoeding, en vanaf 2027 apart.
  const terugVoor = u.terugNormaal + u.terugDal;
  if (heeft.terug && terugVoor + u.terugNa > 0) {
    if (terugVoor > 0) {
      if (normaal == null) {
        regels.push({ soort: 'terug', naam: w.terug, uitleg: w.gesaldeerdGeenPrijs(kwh(terugVoor, lang)), euro: null });
      } else {
        const tegenTarief = u.terugNormaal * normaal + u.terugDal * (dal ?? normaal);
        const gemiddeld = tegenTarief / terugVoor;
        const boven = u.heelJaar && p.teruglevering != null ? Math.max(0, terugVoor - af) : 0;
        if (boven > 0) {
          const gesaldeerd = terugVoor - boven;
          regels.push({ soort: 'terug', naam: w.terug, uitleg: w.gesaldeerdBoven(kwh(gesaldeerd, lang), kwh(boven, lang), eur(p.teruglevering!, lang)), euro: tel(-(gesaldeerd * gemiddeld + boven * p.teruglevering!)) });
        } else {
          regels.push({ soort: 'terug', naam: w.terug, uitleg: w.gesaldeerd(kwh(terugVoor, lang)), euro: tel(-tegenTarief) });
        }
      }
    }
    if (u.terugNa > 0) {
      const v = p.vanaf2027?.vergoeding ?? null;
      const k = p.vanaf2027?.kosten ?? 0;
      regels.push({
        soort: 'terug-na',
        naam: w.terugNa,
        uitleg: v == null ? w.geenVergoeding(kwh(u.terugNa, lang), p.salderen !== false) : w.vergoeding(kwh(u.terugNa, lang), eur(v, lang), k ? eur(k, lang) : null),
        euro: tel(v == null ? null : u.terugNa * (k - v)),
      });
    }
  }

  // Gas.
  if (heeft.gas) regels.push({ soort: 'gas', naam: w.gas, uitleg: p.gas == null ? w.geenPrijs(m3(u.gasM3, lang)) : w.keer(m3(u.gasM3, lang), eur(p.gas, lang)), euro: tel(p.gas == null ? null : u.gasM3 * p.gas) });

  // Vaste posten, per soort; zonder posten de oude vaste kosten per maand.
  let vast: number | null = null;
  const posten = p.vast ?? [];
  if (posten.length) {
    for (const soort of ['stroom', 'gas'] as const) {
      const hier = posten.filter((x) => x.soort === soort);
      if (!hier.length) continue;
      const som = hier.reduce((t, x) => t + vastOver(x, u.dagen), 0);
      vast = (vast ?? 0) + som;
      regels.push({ soort: 'vast', naam: soort === 'stroom' ? w.vastStroom : w.vastGas, uitleg: hier.map((x) => x.naam).join(', '), euro: r2(som) });
    }
  } else if (p.vastPerMaand != null) {
    vast = (p.vastPerMaand * u.dagen) / 30.4375;
    regels.push({ soort: 'vast', naam: w.vast, uitleg: w.perMaand(eur(p.vastPerMaand, lang)), euro: r2(vast) });
  } else {
    regels.push({ soort: 'vast', naam: w.vast, uitleg: w.nietIngesteld, euro: null });
  }

  return {
    regels,
    variabel: variabel == null ? null : r2(variabel),
    vast: vast == null ? null : r2(vast),
    stroomPerKwh: afEuro == null || af <= 0 ? normaal : afEuro / af,
  };
}
