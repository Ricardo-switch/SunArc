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
 * blad noemt ze allemaal. Sinds besluit 287 ook welke knop in Home Assistant
 * het huis op Handmatig zet ("Handmatig koelen"), en sinds wanneer het vakantie is.
 */

import type { Mode, SiteConfig, Zone } from '../core/model.js';
import { HEAT_ASSIST_DEFAULTS } from '../core/strategies/heatAssist.js';
import { cap, inSentence, withArticle, type DecisionView, type Lang } from './assistant.js';
import { clockIn, partsIn } from './today.js';
import { perTaal } from '../taal/index.js';

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
  readonly modus: 'verwarmen' | 'koelen' | 'drogen' | 'ventilator' | 'aan';
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
  /**
   * Een entiteit in Home Assistant: zijn stand, zijn naam, en sinds wanneer hij
   * zo staat. Voor de knop die Handmatig maakt, en sinds wanneer het vakantie is.
   */
  readonly toestand?: (entityId: string) => { readonly state: string; readonly naam: string | null; readonly sindsMs: number | null } | null;
}

const W = perTaal('standNu');


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
  // Kijkt SunArc mee en verwarmt de airco niet echt, dan is dit wat SunArc zou doen. Dat staat
  // in de strook op Thuis (besluit 313), niet in de stand: de stand zegt wat er echt speelt.
  const zou = shadow && !bij.every((i) => (snap.observed[i.actuatorId] ?? '').startsWith('heat'));
  if (bij.length && !zou) {
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
  // Sinds wanneer, uit Home Assistant: vandaag de klok, anders de dag ("ma 3 nov").
  const sindsTekst = (ms: number): string => {
    const d = partsIn(ms, tz);
    return d.y === p.y && d.m === p.m && d.d === p.d ? klokVan(ms) : w.dag(ms, tz);
  };
  // Handmatig door een knop in Home Assistant (zoals "Handmatig koelen"): zeg welke, en sinds wanneer.
  const handKnop = e.mode === 'handmatig' ? (config.mode?.handsOffWhen ?? []).find((b) => o.toestand?.(b.ref.id)?.state === b.state) : undefined;
  let knopMelding: (typeof meldingen)[number] | null = null;
  if (handKnop) {
    const t = o.toestand!(handKnop.ref.id)!;
    const koel = /koel|cool/i.test(handKnop.state);
    knopMelding = {
      soort: 'hand',
      wat: koel ? w.koelWat : handKnop.state,
      hoe: w.knopHoe(t.naam, handKnop.state),
      waarde: t.sindsMs != null ? w.sinds(sindsTekst(t.sindsMs)) : '',
      knop: koel ? w.koelKnop : w.knopKnop(handKnop.state),
      kort: koel ? w.koelKort : handKnop.state,
    };
    meldingen.push(knopMelding);
  }
  if (e.mode === 'vakantie') {
    const sleutel = 'vakantie';
    actief.add(sleutel);
    // Home Assistant kent geen einddatum voor vakantie, wel sinds wanneer de stand zo staat.
    const vanaf = config.mode ? (o.toestand?.(config.mode.select.id)?.sindsMs ?? null) : null;
    const d = vanaf != null ? sindsTekst(vanaf) : null;
    meldingen.push({
      soort: 'vakantie',
      wat: w.vakWat,
      hoe: d ? `${cap(w.sinds(d))}. ${w.vakHoe(kiesInHa)}` : w.vakHoe(kiesInHa),
      waarde: temp(hoofd, 'vakantie'),
      knop: d ? w.sinds(d) : kiesInHa ? w.gekozenHa : w.gekozen,
      kort: d ? w.vakKortSinds(d) : w.vakKort,
    });
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
  const onder = licht ? w.onderLicht(klok(s.nightFromHour)) : auto && e.mode === 'afwezig' ? w.onderNiemand : auto ? w.onderAuto(klok(volgende.uur), w.stand[volgende.stand].toLowerCase()) : handKnop ? w.knopOnder(handKnop.state) : kiesInHa ? w.gekozenHa : w.gekozen;

  let noot: string | null = null;
  if (knopMelding && eerste === knopMelding) noot = w.knopNoot;
  else if (eerste?.soort === 'hand') noot = w.handNoot;
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
