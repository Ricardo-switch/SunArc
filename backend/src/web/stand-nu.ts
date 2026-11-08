/**
 * De stand van het huis met wat er meespeelt (besluit 286, schetsen
 * Wand-Thuis-Stand en Tel-Thuis-Stand).
 *
 * Thuis zei alleen "Automatisch", of de stand die in Home Assistant gekozen
 * was. Wat de regeling verder wist, stond nergens: dat de airco bijspringt, dat
 * iets met de hand gaat, dat het huis vanzelf op Afwezig ging, of dat het na de
 * nacht nog Dag is omdat er licht brandt. Hier staat dat in woorden, met de dag
 * als balk voor het blad. De pagina tekent alleen.
 *
 * Eén melding tegelijk in de knop (wand) en de regel (telefoon), het
 * belangrijkste eerst: met de hand, bijspringen, vakantie, afwezig, licht. Het
 * blad noemt ze allemaal.
 */

import type { Mode, SiteConfig, Zone } from '../core/model.js';
import { HEAT_ASSIST_DEFAULTS } from '../core/strategies/heatAssist.js';
import { cap, inSentence, withArticle, type DecisionView, type Lang } from './assistant.js';
import { clockIn, partsIn } from './today.js';

export type StandSoort = 'hand' | 'bijspringen' | 'vakantie' | 'afwezig' | 'licht';

export interface StandMelding {
  readonly soort: StandSoort;
  readonly wat: string;
  readonly hoe: string;
  /** "sinds 10:02", "tot 12:00", "16°"; leeg als er niets bij hoort. */
  readonly waarde: string;
}

export interface StandDeel {
  readonly van: number;
  readonly tot: number;
  readonly stand: 'voorverwarmen' | 'dag' | 'nacht';
  readonly naam: string;
  /** "20,5°", of "niet" als de kamer dan niet verwarmd wordt. */
  readonly temp: string;
}

export interface ResidentStand {
  readonly stand: Mode;
  readonly naam: string;
  /** Het eerste wat er meespeelt: de kleur van de stip. Null zonder melding. */
  readonly soort: StandSoort | null;
  /** In de knop op de wand, na de naam: "de airco springt bij", of "tot 22:00". */
  readonly knop: string;
  /** Op de telefoon naast de begroeting: "De airco springt bij", of "Dag tot 22:00". */
  readonly kort: string;
  /** In het blad naast de naam: "uit de dagdelen · om 22:00 nacht". */
  readonly onder: string;
  readonly meldingen: readonly StandMelding[];
  readonly noot: string | null;
  /** De dag als balk: de dagdelen met de graden van één kamer, of één stand de hele dag. */
  readonly balk: {
    readonly kamer: string | null;
    readonly delen: readonly StandDeel[];
    /** Afwezig of vakantie: de hele dag hetzelfde, met de graden. */
    readonly plat: { readonly naam: string; readonly temp: string } | null;
    /** Er brandt nog licht: de dag loopt door tot nu (een uur van de dag). */
    readonly verlengdTot: number | null;
    /** Nu, als uur van de dag met breuk (10,25 is kwart over tien). */
    readonly nu: number;
    readonly uitleg: string;
  };
}

/** Met de hand vanuit de app (besluit 235): wat de pagina Apparaten zette. */
export interface StandHand {
  readonly id: string;
  readonly modus: 'verwarmen' | 'koelen' | 'aan';
  readonly gezet?: number;
  readonly totMs: number;
  readonly totDoel?: boolean;
}

export interface StandOpties {
  readonly shadow?: boolean;
  readonly hand?: readonly StandHand[];
  /** De naam van een apparaat bij zijn entiteit, voor wat met de hand gaat. */
  readonly naamVan?: (id: string) => string | null;
  /** De lampen van de langere avond die nu branden, met hun naam; pas gevraagd als het nodig is. */
  readonly lampenAan?: () => readonly string[];
  /** Of de stand uit Home Assistant komt; anders kiest SunArc hem zelf. */
  readonly kiesInHa?: boolean;
  /** Wanneer elke melding begon; de dienst houdt het bij tussen de besluiten. */
  readonly geheugen?: Map<string, number>;
}

const W = {
  nl: {
    stand: { dag: 'Dag', nacht: 'Nacht', voorverwarmen: 'Voorverwarmen', afwezig: 'Afwezig', vakantie: 'Vakantie', handmatig: 'Handmatig' } as Record<Mode, string>,
    tot: (k: string) => `tot ${k}`,
    sinds: (k: string) => `sinds ${k}`,
    gekozenHa: 'gekozen in Home Assistant',
    gekozen: 'gekozen',
    kortGekozen: (s: string) => `${s}, gekozen`,
    kortTot: (s: string, k: string) => `${s} tot ${k}`,
    onderAuto: (k: string, s: string) => `uit de dagdelen · om ${k} ${s}`,
    onderLicht: (k: string) => `langer dan ${k} · daarna nacht`,
    onderNiemand: 'vanzelf · niemand thuis',
    niet: 'niet',
    graden: (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')}°`,
    uitleg: (p: number, d: number, n: number, kamer: string | null) => `Voorverwarmen ${p}:00, dag ${d}:00, nacht ${n}:00.${kamer ? ` De graden van ${kamer}.` : ''}`,
    uitlegPlat: 'Geldt de hele dag.',
    // Met de hand
    handKnop: (n: string) => `${inSentence(n)} met de hand`,
    handKort: (n: string, k: string) => `${n} tot ${k}`,
    handWat: (n: string) => `${n} met de hand`,
    handHoe: (doel: string | null, totDoel: boolean) => (doel ? `Op ${doel}, ` : 'Aan, ') + (totDoel ? 'tot het doel er is; daarna weer zoals het was.' : 'daarna weer zoals het was.'),
    zelfHoe: 'Iemand bediende hem zelf.',
    handNoot: 'Wat met de hand gaat, wint van de stand tot het eind.',
    // Bijspringen
    bijKnop: (meer: boolean, zou: boolean) => (zou ? (meer ? "de airco's zouden bijspringen" : 'de airco zou bijspringen') : meer ? "de airco's springen bij" : 'de airco springt bij'),
    bijWat: (n: string, kamer: string, zou: boolean) => `${n} ${zou ? 'zou bijspringen' : 'springt bij'} in ${kamer}`,
    bijHoe: (te: string | null) => (te ? `De verwarming houdt het niet bij: het is ${te} te koud.` : 'De verwarming houdt het niet bij.'),
    bijNoot: (min: number, te: string) => `Hij springt bij na ${min} minuten stoken en vanaf ${te} te koud, bij Regeling › Klimaat. In de nacht, bij voorverwarmen, afwezig en vakantie niet.`,
    nietBij: 'De airco springt niet bij zolang deze stand geldt.',
    // Vakantie en afwezig
    vakWat: 'Zo zuinig mogelijk',
    vakHoe: (ha: boolean) => (ha ? 'Tot je hem in Home Assistant terugzet.' : 'Tot je hem terugzet.'),
    vakKort: 'Vakantie',
    afwKnop: 'niemand thuis',
    afwKort: 'Niemand thuis',
    afwWat: 'Iedereen is weg',
    afwHoe: 'Is iemand terug, dan weer de dagdelen.',
    afwGekozenWat: 'Afwezig gekozen',
    // Licht
    lichtKnop: 'er brandt nog licht',
    lichtKort: 'Nog Dag: er brandt licht',
    lichtWat: (lampen: readonly string[]) => (lampen.length ? `${lijst(lampen, ' en ')} ${lampen.length > 1 ? 'branden' : 'brandt'} nog` : 'Er brandt nog licht'),
    lichtHoe: 'Gaat het uit, dan wordt het Nacht.',
    lichtNoot: 'Welke lampen de dag langer maken, staat in de configuratie van het huis.',
    gewoonNoot: 'Niets bijzonders: het huis volgt de dagdelen.',
  },
  en: {
    stand: { dag: 'Day', nacht: 'Night', voorverwarmen: 'Preheating', afwezig: 'Away', vakantie: 'Holiday', handmatig: 'Manual' } as Record<Mode, string>,
    tot: (k: string) => `until ${k}`,
    sinds: (k: string) => `since ${k}`,
    gekozenHa: 'chosen in Home Assistant',
    gekozen: 'chosen',
    kortGekozen: (s: string) => `${s}, chosen`,
    kortTot: (s: string, k: string) => `${s} until ${k}`,
    onderAuto: (k: string, s: string) => `from the parts of the day · ${s} at ${k}`,
    onderLicht: (k: string) => `longer than ${k} · then night`,
    onderNiemand: 'by itself · nobody home',
    niet: 'off',
    graden: (n: number) => `${Math.round(n * 10) / 10}°`,
    uitleg: (p: number, d: number, n: number, kamer: string | null) => `Preheating ${p}:00, day ${d}:00, night ${n}:00.${kamer ? ` The degrees of ${kamer}.` : ''}`,
    uitlegPlat: 'Applies all day.',
    handKnop: (n: string) => `${n} by hand`,
    handKort: (n: string, k: string) => `${n} until ${k}`,
    handWat: (n: string) => `${n} by hand`,
    handHoe: (doel: string | null, totDoel: boolean) => (doel ? `At ${doel}, ` : 'On, ') + (totDoel ? 'until the target is reached; then back as it was.' : 'then back as it was.'),
    zelfHoe: 'Someone set it themselves.',
    handNoot: 'What runs by hand wins over the mode until it ends.',
    bijKnop: (meer: boolean, zou: boolean) => (zou ? (meer ? 'the air conditioners would help out' : 'the air conditioner would help out') : meer ? 'the air conditioners help out' : 'the air conditioner helps out'),
    bijWat: (n: string, kamer: string, zou: boolean) => `${n} ${zou ? 'would help out' : 'helps out'} in ${kamer}`,
    bijHoe: (te: string | null) => (te ? `The heating cannot keep up: it is ${te} too cold.` : 'The heating cannot keep up.'),
    bijNoot: (min: number, te: string) => `It helps out after ${min} minutes of heating and from ${te} too cold, under Control › Climate. Not at night, while preheating, away or on holiday.`,
    nietBij: 'The air conditioner does not help out in this mode.',
    vakWat: 'As economical as possible',
    vakHoe: (ha: boolean) => (ha ? 'Until you set it back in Home Assistant.' : 'Until you set it back.'),
    vakKort: 'Holiday',
    afwKnop: 'nobody home',
    afwKort: 'Nobody home',
    afwWat: 'Everyone is out',
    afwHoe: 'Once someone is back, the parts of the day again.',
    afwGekozenWat: 'Away chosen',
    lichtKnop: 'a light is still on',
    lichtKort: 'Still Day: a light is on',
    lichtWat: (lampen: readonly string[]) => (lampen.length ? `${lijst(lampen, ' and ')} ${lampen.length > 1 ? 'are' : 'is'} still on` : 'A light is still on'),
    lichtHoe: 'Once it goes off, it becomes Night.',
    lichtNoot: 'Which lights make the day longer is set in the house configuration.',
    gewoonNoot: 'Nothing special: the house follows the parts of the day.',
  },
} as const;

function lijst(namen: readonly string[], en: string): string {
  return namen.length <= 1 ? (namen[0] ?? '') : `${namen.slice(0, -1).join(', ')}${en}${namen.at(-1)}`;
}

/** Wanneer de klok de stand verandert, vanaf dit uur: het eerstvolgende dagdeel. */
function volgendeWissel(config: SiteConfig, uur: number): { readonly uur: number; readonly stand: 'voorverwarmen' | 'dag' | 'nacht' } {
  const s = config.schedule;
  const wissels = [
    { uur: s.preheatFromHour, stand: 'voorverwarmen' as const },
    { uur: s.dayFromHour, stand: 'dag' as const },
    { uur: s.nightFromHour, stand: 'nacht' as const },
  ];
  return wissels.sort((a, b) => ((a.uur - uur + 24) % 24 || 24) - ((b.uur - uur + 24) % 24 || 24))[0]!;
}

const klok = (uur: number) => `${String(uur).padStart(2, '0')}:00`;

/** Wanneer de dienst voor het eerst keek; wat hij toen al zag, begon eerder en hoe laat weet hij niet. */
const START = '__start';

/**
 * Het begin van een melding: wanneer de dienst hem eerst zag. Speelde hij al
 * toen de dienst begon te kijken (na een herstart), dan null: dan zegt de app
 * geen "sinds". Wat niet meer speelt, vergeet standNu.
 */
function sindsVan(geheugen: Map<string, number>, sleutel: string, nuMs: number): number | null {
  if (!geheugen.has(START)) geheugen.set(START, nuMs);
  const was = geheugen.get(sleutel) ?? nuMs;
  geheugen.set(sleutel, was);
  return was === geheugen.get(START) ? null : was;
}

const GEHEUGEN = new Map<string, number>();

export function standNu(config: SiteConfig, snap: DecisionView, lang: Lang = 'nl', o: StandOpties = {}): ResidentStand {
  const w = W[lang];
  const e = snap.explanation;
  const tz = config.timezone;
  const p = partsIn(snap.atMs, tz);
  const nu = p.h + p.mi / 60;
  const s = config.schedule;
  const auto = e.modeSource === 'schedule';
  const naam = w.stand[e.mode] ?? e.mode;
  const geheugen = o.geheugen ?? GEHEUGEN;
  const shadow = o.shadow ?? true;
  const kiesInHa = o.kiesInHa ?? config.mode != null;
  const klokVan = (ms: number) => clockIn(ms, tz);
  const meldingen: (StandMelding & { readonly knop: string; readonly kort: string })[] = [];
  const actief = new Set<string>();

  // Met de hand vanuit de app, en wat iemand zelf bediende (de Nest met zijn timer).
  const handIds = new Set<string>();
  for (const h of o.hand ?? []) {
    if (h.totMs <= snap.atMs) continue;
    handIds.add(h.id);
    const n = o.naamVan?.(h.id) ?? config.actuators.find((a) => a.ref.id === h.id)?.name ?? h.id;
    const tot = klokVan(h.totMs);
    meldingen.push({ soort: 'hand', wat: w.handWat(n), hoe: w.handHoe(h.gezet != null && h.modus !== 'aan' ? w.graden(h.gezet) : null, h.totDoel === true), waarde: w.tot(tot), knop: w.handKnop(n), kort: w.handKort(n, tot) });
  }
  for (const ov of e.overrides ?? []) {
    const a = config.actuators.find((x) => x.id === ov.actuatorId);
    if (!a || handIds.has(a.ref.id)) continue;
    const tot = ov.untilMs != null ? klokVan(ov.untilMs) : null;
    meldingen.push({ soort: 'hand', wat: w.handWat(a.name), hoe: w.zelfHoe, waarde: tot ? w.tot(tot) : '', knop: w.handKnop(a.name), kort: tot ? w.handKort(a.name, tot) : w.handWat(a.name) });
  }

  // Bijspringen: de regel heat-assist zet een airco aan omdat de verwarming het niet bijhoudt.
  const bij = snap.accepted.filter((i) => i.strategyId === 'heat-assist');
  if (bij.length) {
    // In de schaduw "zou", tenzij de airco echt al verwarmt (besluit 124).
    const zou = shadow && !bij.every((i) => (snap.observed[i.actuatorId] ?? '').startsWith('heat'));
    for (const i of bij) {
      const zone = config.zones.find((z) => z.id === i.zoneId);
      const a = config.actuators.find((x) => x.id === i.actuatorId);
      const pz = e.perZone.find((z) => z.zoneId === i.zoneId);
      const te = pz?.temperatureC != null && pz.heatTargetC != null && pz.heatTargetC > pz.temperatureC ? w.graden(pz.heatTargetC - pz.temperatureC) : null;
      const sleutel = `bij:${i.actuatorId}`;
      actief.add(sleutel);
      const sinds = sindsVan(geheugen, sleutel, snap.atMs);
      const apparaat = lang === 'nl' ? cap(`de ${inSentence(a?.name ?? 'airco')}`) : `The ${a?.name ?? 'air conditioner'}`;
      meldingen.push({ soort: 'bijspringen', wat: w.bijWat(apparaat, withArticle(zone?.name ?? i.zoneId, lang), zou), hoe: w.bijHoe(te), waarde: sinds != null ? w.sinds(klokVan(sinds)) : '', knop: w.bijKnop(bij.length > 1, zou), kort: cap(w.bijKnop(bij.length > 1, zou)) });
    }
  }

  // Vakantie en afwezig.
  const temp = (z: Zone | undefined, m: Mode): string => {
    const t = z?.setpoints[m]?.heat;
    return t != null ? w.graden(t) : w.niet;
  };
  const hoofd = kamerVoorBalk(config, bij.map((i) => i.zoneId));
  if (e.mode === 'vakantie') {
    const sleutel = 'vakantie';
    actief.add(sleutel);
    meldingen.push({ soort: 'vakantie', wat: w.vakWat, hoe: w.vakHoe(kiesInHa), waarde: temp(hoofd, 'vakantie'), knop: kiesInHa ? w.gekozenHa : w.gekozen, kort: w.vakKort });
  } else if (e.mode === 'afwezig') {
    const sleutel = 'afwezig';
    actief.add(sleutel);
    const sinds = sindsVan(geheugen, sleutel, snap.atMs);
    if (auto) meldingen.push({ soort: 'afwezig', wat: w.afwWat, hoe: sinds != null ? `${cap(w.sinds(klokVan(sinds)))}. ${w.afwHoe}` : w.afwHoe, waarde: temp(hoofd, 'afwezig'), knop: w.afwKnop, kort: w.afwKort });
    else meldingen.push({ soort: 'afwezig', wat: w.afwGekozenWat, hoe: w.vakHoe(kiesInHa), waarde: temp(hoofd, 'afwezig'), knop: kiesInHa ? w.gekozenHa : w.gekozen, kort: w.kortGekozen(naam) });
  }

  // Nog Dag terwijl het nacht is: er brandt een lamp van de langere avond.
  const inNacht = nu >= s.nightFromHour || nu < s.preheatFromHour;
  const licht = auto && e.mode === 'dag' && inNacht;
  if (licht) {
    const sleutel = 'licht';
    actief.add(sleutel);
    const sinds = sindsVan(geheugen, sleutel, snap.atMs);
    meldingen.push({ soort: 'licht', wat: w.lichtWat(o.lampenAan?.() ?? []), hoe: w.lichtHoe, waarde: sinds != null ? w.sinds(klokVan(sinds)) : '', knop: w.lichtKnop, kort: w.lichtKort });
  }
  // Wat niet meer speelt, vergeten.
  for (const k of [...geheugen.keys()]) if (k !== START && !actief.has(k)) geheugen.delete(k);

  const eerste = meldingen[0] ?? null;
  const volgende = volgendeWissel(config, p.h);
  const knop = eerste?.knop ?? (auto ? w.tot(klok(volgende.uur)) : kiesInHa ? w.gekozenHa : w.gekozen);
  const kort = eerste?.kort ?? (auto ? w.kortTot(naam, klok(volgende.uur)) : w.kortGekozen(naam));
  const onder = licht ? w.onderLicht(klok(s.nightFromHour)) : auto && e.mode === 'afwezig' ? w.onderNiemand : auto ? w.onderAuto(klok(volgende.uur), w.stand[volgende.stand].toLowerCase()) : kiesInHa ? w.gekozenHa : w.gekozen;

  let noot: string | null = null;
  if (eerste?.soort === 'hand') noot = w.handNoot;
  else if (eerste?.soort === 'bijspringen') {
    const z = config.zones.find((x) => x.id === bij[0]!.zoneId);
    noot = w.bijNoot(z?.heatAssist?.startDelayMinutes ?? HEAT_ASSIST_DEFAULTS.startDelayMinutes, w.graden(z?.heatAssist?.minShortfallC ?? HEAT_ASSIST_DEFAULTS.minShortfallC));
  } else if (eerste?.soort === 'vakantie' || eerste?.soort === 'afwezig') noot = heeftBijspringen(config) ? w.nietBij : null;
  else if (eerste?.soort === 'licht') noot = w.lichtNoot;
  else if (auto) noot = w.gewoonNoot;

  // De dag als balk, met de graden van de kamer waar het om gaat; nu het doel van nu.
  const pz = hoofd ? e.perZone.find((z) => z.zoneId === hoofd.id) : undefined;
  const tempDeel = (m: 'voorverwarmen' | 'dag' | 'nacht'): string => (m === e.mode && pz?.heatTargetC != null ? w.graden(pz.heatTargetC) : temp(hoofd, m));
  const delen: StandDeel[] = [];
  const deel = (van: number, tot: number, m: 'voorverwarmen' | 'dag' | 'nacht') => {
    if (tot > van) delen.push({ van, tot, stand: m, naam: w.stand[m], temp: tempDeel(m) });
  };
  if (s.preheatFromHour <= s.dayFromHour && s.dayFromHour <= s.nightFromHour) {
    deel(0, s.preheatFromHour, 'nacht');
    deel(s.preheatFromHour, s.dayFromHour, 'voorverwarmen');
    deel(s.dayFromHour, s.nightFromHour, 'dag');
    deel(s.nightFromHour, 24, 'nacht');
  }
  const plat = e.mode === 'afwezig' || e.mode === 'vakantie' || e.mode === 'handmatig' ? { naam, temp: e.mode === 'handmatig' ? '' : temp(hoofd, e.mode) } : null;
  const kamer = hoofd ? withArticle(hoofd.name, lang) : null;

  return {
    stand: e.mode,
    naam,
    soort: eerste?.soort ?? null,
    knop,
    kort,
    onder,
    meldingen: meldingen.map(({ soort, wat, hoe, waarde }) => ({ soort, wat, hoe, waarde })),
    noot,
    balk: {
      kamer,
      delen,
      plat,
      verlengdTot: licht && nu >= s.nightFromHour ? nu : null,
      nu: Math.round(nu * 100) / 100,
      uitleg: plat ? w.uitlegPlat : w.uitleg(s.preheatFromHour, s.dayFromHour, s.nightFromHour, kamer),
    },
  };
}

/** De kamer voor de balk: waar de airco bijspringt, anders de eerste die kan verwarmen. */
function kamerVoorBalk(config: SiteConfig, bij: readonly string[]): Zone | undefined {
  const kan = (z: Zone) => z.actuatorIds.some((id) => config.actuators.find((a) => a.id === id)?.capabilities.canHeat);
  return config.zones.find((z) => bij.includes(z.id)) ?? config.zones.find(kan) ?? config.zones[0];
}

/** Of er een kamer is waar een airco kan bijspringen. */
function heeftBijspringen(config: SiteConfig): boolean {
  return config.zones.some((z) => z.heatAssist?.enabled !== false && z.actuatorIds.some((id) => { const a = config.actuators.find((x) => x.id === id); return a?.role === 'assist' && a.capabilities.canHeat; }));
}
