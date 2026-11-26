/**
 * Later uitvoeren (besluit 218): een opdracht met een tijd bewaren in plaats
 * van meteen doen, zeggen wat er gepland staat, en de laatste annuleren. De
 * tijd leest `gepland.ts`, de opdracht de woordzoeker; de dienst voert hem op
 * het tijdstip zelf uit (main.ts).
 */

import type { Lang } from '../assistant.js';
import type { Visitor } from '../auth.js';
import { deelVan, herkenDelen, samen, type Stap } from '../brein.js';
import type { Diensten } from '../diensten.js';
import { isAnnuleer, isGeplandVraag, leesPlanTijd, type Herhaal, type Moment, type PlanTijd } from '../gepland.js';
import { klok } from '../klimaatbrug.js';
import { herkenOpdracht, type Bedienbaar, type Herkend } from '../opdracht.js';
import type { Herinnering, Herinneringen } from '../tedoen.js';
import { uitspraak } from '../uitspraak.js';
import { dagWoord } from './tedoen.js';
import { perTaal } from '../../taal/index.js';

/**
 * Wat de assistent later kan doen: licht, scènes en schermen. Klimaat met de hand
 * en witgoed plan je bij Nieuw in Vast en gepland (besluit 240), waar je het
 * apparaat, de temperatuur en hoe lang zelf kiest.
 */
const ZEG_MAG = new Set(['api/licht', 'api/scene', 'api/scherm']);
/** Een zin die iets wil laten doen, en geen vraag: dan beantwoordt het taalmodel hem niet vrij (besluit 224). */
const VRAAG = /^(waarom|wanneer|hoe|wat|welke|staat|staan|is|zijn|why|when|how|what|which)\b/;
const BEDIEN = /\b(lamp|lampen|licht|lichten|verlichting|spots?|plafonniere|scene|sfeer|screens?|schermen?|zonnescherm|rolluik|dicht|open|aan|uit|zakken|omlaag|omhoog|neer|light|lights|blinds?|close|on|off|lower|raise)\b/;

/** De zinnen per taal (besluit 353). */
const ZIN = perTaal('gepland');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "na zonsondergang", "10 minuten voor zonsondergang", "een kwartier na zonsopkomst". */
export function zonZin(zon: 'onder' | 'op', minuten: number, lang: Lang): string {
  const z = ZIN[lang];
  if (minuten === 0) return z.precies[zon];
  return `${z.duur(Math.abs(minuten))} ${minuten < 0 ? z.voor : z.na} ${z.zon[zon]}`;
}

/** "om 21:43", "morgen om 07:00", "na zonsondergang, om 17:21", "10 minuten voor zonsondergang, om 16:49". */
export function wanneerZin(ms: number, zon: PlanTijd['zon'], nuMs: number, tz: string, lang: Lang, minuten = 0): string {
  const dag = dagWoord(ms, nuMs, tz, lang);
  const vandaag = dag === ZIN[lang].vandaag;
  const tijd = `${ZIN[lang].om} ${klok(ms, tz)}`;
  if (zon) return `${vandaag ? '' : `${dag} `}${zonZin(zon, minuten, lang)}, ${tijd}`;
  return `${vandaag ? '' : `${dag} `}${tijd}`;
}

/** "elke dag", "elke werkdag", "in het weekend", "elke maandag en woensdag"; leeg bij één keer (besluit 234). */
export function herhaalZin(h: Herhaal | undefined, lang: Lang): string {
  if (!h || h.soort === 'een') return '';
  const z = ZIN[lang];
  if (h.soort === 'dag' || h.soort === 'werkdagen' || h.soort === 'weekend') return z.herhaal[h.soort];
  const namen = (h.dagen ?? []).map((d) => z.dagen[d - 1]).filter(Boolean) as string[];
  const lijst = namen.length <= 1 ? (namen[0] ?? '') : `${namen.slice(0, -1).join(', ')} ${z.en} ${namen.at(-1)}`;
  return `${z.elke} ${lijst}`;
}

/** Het moment op een dag, zonder dag: "om 07:00", "10 minuten voor zonsondergang". */
export function momentZin(m: Moment, lang: Lang): string {
  if (m.soort === 'zon') return zonZin(m.zon, m.minuten, lang);
  return `${ZIN[lang].om} ${String(m.uur).padStart(2, '0')}:${String(m.minuut).padStart(2, '0')}`;
}

/** Wat de keuze zegt als je doorvraagt: de tijd erbij, zodat hij gepland blijft. */
function tijdWoorden(p: PlanTijd, nuMs: number, tz: string, lang: Lang): string {
  const dag = dagWoord(p.ms, nuMs, tz, lang);
  const vandaag = dag === ZIN[lang].vandaag;
  const vaak = herhaalZin(p.herhaal, lang);
  if (vaak) return `${vaak} ${momentZin(p.moment, lang)}`;
  if (p.zon) return `${vandaag ? '' : `${dag} `}${zonZin(p.zon, p.moment.soort === 'zon' ? p.moment.minuten : 0, lang)}`;
  return `${vandaag ? '' : `${dag} `}${ZIN[lang].om} ${klok(p.ms, tz)}`;
}

/** Het antwoord voor de pagina: alleen tekst, er gaat nu niets naar een deur. */
function antwoord(tekst: string, lang: Lang, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { vraag: 'tedoen', taal: lang, kamer: null, antwoord: tekst, feiten: [], gesproken: uitspraak(tekst, lang), ...extra };
}

/** Wat er gepland staat, als zin. */
function geplandZin(lijst: readonly Herinnering[], nuMs: number, tz: string, lang: Lang): string {
  const z = ZIN[lang];
  if (!lijst.length) return z.niets;
  const regels = lijst.slice(0, 4).map((g) => {
    const vaak = herhaalZin(g.opdracht?.herhaal, lang);
    const minuten = g.opdracht?.moment?.soort === 'zon' ? g.opdracht.moment.minuten : 0;
    return `${vaak ? `${vaak}, ` : ''}${wanneerZin(g.ms, g.opdracht?.zon ?? null, nuMs, tz, lang, minuten)}: ${g.tekst.charAt(0).toLowerCase()}${g.tekst.slice(1)}`;
  });
  return z.lijst(regels.join('; '), lijst.length > 4 ? z.meer(lijst.length - 4) : '');
}

/**
 * Een zin over later: een opdracht met een tijd ("zet over vijf minuten de
 * lamp in de keuken aan"), "wat staat er gepland", of "annuleer". Null als
 * het daar niet over gaat; dan gaat de zin de gewone weg.
 */
export async function planZin(
  d: Diensten,
  store: Herinneringen,
  tekst: string,
  lijst: Bedienbaar,
  wie: Visitor | null,
  tz: string,
  lang: Lang,
  laatsteScherm: string | null,
  naamVan: (account: string) => string | null,
  nuMs = Date.now(),
  denkLater: ((rest: string) => Promise<{ readonly stappen: readonly Stap[] } | { readonly vraag: Extract<Herkend, { ok: false }> } | null>) | null = null,
  /** Alleen een voorstel (Zeg het in Nieuw, besluit 240): niets bewaren, de wizard laat het eerst zien. */
  alleenVoorstel = false,
): Promise<Record<string, unknown> | null> {
  if (isGeplandVraag(tekst)) return antwoord(geplandZin(await store.gepland(), nuMs, tz, lang), lang);
  if (isAnnuleer(tekst)) {
    const laatste = [...(await store.gepland())].sort((a, b) => b.gemaakt - a.gemaakt)[0];
    if (!laatste) return antwoord(ZIN[lang].nietsAnnuleren, lang);
    await store.klaar(laatste.id);
    return antwoord(ZIN[lang].geannuleerd(laatste.tekst), lang);
  }
  const p = leesPlanTijd(tekst, nuMs, tz, d.options.location?.() ?? null);
  if (p == null || p.rest === '') return null;
  const rest = p.rest.replace(/^(?:kun je|kan je|wil je|wilt u|can you|could you|please) /, '');
  // Doorvragen (welke screen?): de keuzes houden de tijd vast.
  const doorvraag = (h: Extract<Herkend, { ok: false }>) => {
    const bij = tijdWoorden(p, nuMs, tz, lang);
    return antwoord(h.antwoord, lang, h.keuze ? { keuze: h.keuze.map((k) => ({ ...k, tekst: `${k.tekst} ${bij}` })) } : {});
  };
  // Wat er moet gebeuren: één opdracht, of meer in één zin.
  let stappen: readonly Stap[];
  const delen = herkenDelen(rest, lijst, lang, laatsteScherm);
  if (delen) stappen = samen(delen.map(deelVan)).stappen;
  else {
    const h = herkenOpdracht(rest, lijst, lang, laatsteScherm);
    if (h == null) {
      // Een opdracht met een tijd die de woordzoeker niet leest (besluit 224): het
      // taalmodel zegt alleen wát, de tijd houden we hier. Lukt dat niet, dan een
      // vast antwoord, en nooit een zin van het model met een eigen tijd.
      if (!BEDIEN.test(rest) || VRAAG.test(rest)) return null;
      const doen = denkLater ? await denkLater(rest).catch(() => null) : null;
      if (doen && 'vraag' in doen) return doorvraag(doen.vraag);
      if (!doen?.stappen.length) {
        const wanneer = tijdWoorden(p, nuMs, tz, lang);
        return antwoord(ZIN[lang].geenWat(wanneer), lang);
      }
      stappen = doen.stappen;
    } else if (!h.ok) return doorvraag(h);
    else stappen = deelVan(h.opdracht).stappen;
  }
  if (!stappen.length || !stappen.every((s) => ZEG_MAG.has(s.pad))) {
    return antwoord(ZIN[lang].alleenLicht, lang);
  }
  const label = cap(rest);
  if (alleenVoorstel) {
    const vaakNu = herhaalZin(p.herhaal, lang);
    const wanneer = vaakNu ? `${vaakNu} ${momentZin(p.moment, lang)}` : tijdWoorden(p, nuMs, tz, lang);
    return antwoord(ZIN[lang].voorstel(wanneer, rest), lang, { voorstel: { tekst: label, wat: rest, stappen, moment: p.moment, herhaal: p.herhaal, ms: p.ms } });
  }
  const account = wie?.userId ?? null;
  const naam = account ? naamVan(account) : null;
  const g = await store.voeg({ tekst: label, ms: p.ms, voor: naam ? account : null, naam, opdracht: { stappen, zon: p.zon, moment: p.moment, herhaal: p.herhaal, aan: true } });
  const minuten = p.moment.soort === 'zon' ? p.moment.minuten : 0;
  const vaak = herhaalZin(p.herhaal, lang);
  // Steeds (besluit 234): wat hij vastlegde, en wanneer de eerste keer is.
  const eerste = `${dagWoord(g.ms, nuMs, tz, lang)} ${ZIN[lang].om} ${klok(g.ms, tz)}`;
  const zin = vaak ? ZIN[lang].steeds(`${vaak} ${momentZin(p.moment, lang)}`, rest, eerste) : ZIN[lang].eenKeer(wanneerZin(g.ms, p.zon, nuMs, tz, lang, minuten), rest);
  return antwoord(zin, lang, { feiten: [{ bron: 'tedoen.tijd', tekst: klok(g.ms, tz) }], gepland: { id: g.id, ms: g.ms } });
}
