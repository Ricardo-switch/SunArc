/**
 * Laden met de hand met een zin (besluit 280): "laad de auto met 10 ampère tot
 * zes uur", "pauzeer het laden", "laad weer", "laat de laadpaal zelf kiezen",
 * en met evcc "laad snel" of "laad op zon". Net als bij licht en schermen
 * schakelt dit bestand zelf niets: het maakt een stap voor de deur
 * `/api/laden`, en de pagina stuurt hem, met dezelfde regels als het blad
 * Laden. Alleen voor een auto waarvan de bewoner bij Energie toeliet dat
 * SunArc de laadpaal (of de stand van evcc) mag bedienen.
 */

import type { Lang } from './assistant.js';
import type { Deel } from './brein.js';
import { klok } from './klimaatbrug.js';
import type { LaadStand } from './laadhand.js';
import type { Optie } from './opdracht.js';
import type { Auto } from './opslag.js';
import { leesTijd } from './tedoen.js';

/** Een auto zoals de assistent hem kan laden. */
export interface LaadAuto {
  readonly id: string;
  readonly naam: string;
  /** De bewoner liet het toe (de laadpaal, of de stand van evcc). */
  readonly mag: boolean;
  readonly stroom: { readonly min: number; readonly max: number } | null;
  readonly zekeringA: number | null;
  readonly pauze: boolean;
  /** Met evcc: de standen die evcc kent; anders null. */
  readonly evcc: readonly string[] | null;
  /** Er loopt iets met de hand. */
  readonly actief: boolean;
}

export type LaadHerkend = { readonly ok: true; readonly deel: Deel } | { readonly ok: false; readonly antwoord: string; readonly keuze?: readonly Optie[] };

/** De auto's met wat ze kunnen, uit de standen van het blad en de auto's van het huis. */
export function ladenAutos(standen: readonly LaadStand[], autos: readonly Auto[]): LaadAuto[] {
  return standen.flatMap((s) => {
    const a = autos.find((x) => x.id === s.auto);
    if (!a) return [];
    const evcc = s.evcc && s.evccStand ? s.evccStand.opties : null;
    return [
      {
        id: s.auto,
        naam: a.naam,
        mag: evcc ? s.evccMag : s.mag && (s.stroom != null || s.pauze),
        stroom: evcc ? null : s.stroom ? { min: s.stroom.min, max: s.stroom.max } : null,
        zekeringA: s.zekeringA,
        pauze: !evcc && s.pauze,
        evcc,
        actief: s.actief != null,
      },
    ];
  });
}

const kaal = (s: string) =>
  ` ${s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.,!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;

/** Gaat de zin over laden? Dan kijkt deze woordzoeker eerst. */
export function isLadenZin(ruw: string): boolean {
  return /\b(laad|laden|opladen|laadpaal|laadstroom|charge|charging|charger|evcc)\b/.test(kaal(ruw));
}

const STAND_NL: Readonly<Record<string, string>> = { off: 'Uit', pv: 'Zon', minpv: 'Min + zon', now: 'Snel', smart: 'Slim' };
const STAND_EN: Readonly<Record<string, string>> = { off: 'Off', pv: 'Solar', minpv: 'Min + solar', now: 'Fast', smart: 'Smart' };

type Tot = { readonly tot: 'uur' | 'kabel' } | { readonly tot: 'tijd'; readonly totMs: number } | { readonly tot: 'pct'; readonly pct: number };

/** Tot wanneer: een %, een uur, de kabel, of een tijd ("tot zes uur", "tot 18:00", "over twee uur"); anders tot de kabel eruit gaat. */
function totVan(t: string, nuMs: number, tz: string): Tot {
  const pct = /\btot (\d{2,3}) ?(%|procent|percent)/.exec(t) ?? /\b(?:to|until) (\d{2,3}) ?(%|percent)/.exec(t);
  if (pct) return { tot: 'pct', pct: Number(pct[1]) };
  if (/\b(kabel|cable|unplug|unplugged)\b/.test(t)) return { tot: 'kabel' };
  if (/\b(een|1|één) uur( lang)?\b(?! ?:)/.test(t.replace(/\btot (een|1) uur\b/, '')) || /\bfor (an|one|1) hour\b/.test(t)) return { tot: 'uur' };
  const tijd = /\b(tot|until|till) (.+)$/.exec(t);
  if (tijd) {
    const m = leesTijd(`om ${tijd[2]}`, nuMs, tz);
    if (m && m.ms > nuMs) return { tot: 'tijd', totMs: m.ms };
  }
  const over = leesTijd(t, nuMs, tz);
  if (over && /\b(over|in) /.test(t) && over.ms > nuMs) return { tot: 'tijd', totMs: over.ms };
  return { tot: 'kabel' };
}

function totZin(x: Tot, tz: string, nl: boolean): string {
  if (x.tot === 'uur') return nl ? 'een uur lang' : 'for an hour';
  if (x.tot === 'kabel') return nl ? 'tot de kabel eruit gaat' : 'until the cable comes out';
  if (x.tot === 'pct') return nl ? `tot ${x.pct}%` : `until ${x.pct}%`;
  if (x.tot === 'tijd') return nl ? `tot ${klok(x.totMs, tz)}` : `until ${klok(x.totMs, tz)}`;
  return nl ? 'tot de kabel eruit gaat' : 'until the cable comes out';
}

/** "de Model 3", of "de auto" zoals hij heet. */
function wie(naam: string, nl: boolean): string {
  if (/^(de|het|the) /i.test(naam)) return nl ? naam.replace(/^(The|the) /, 'de ') : naam.replace(/^(De|de|Het|het) /, 'the ');
  return nl ? `de ${naam}` : `the ${naam}`;
}
const hoofd = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Welke auto: de enige, of de auto die genoemd wordt; anders een vraag terug. */
function welke(ruw: string, t: string, autos: readonly LaadAuto[], nl: boolean): LaadAuto | LaadHerkend {
  if (autos.length === 1) return autos[0]!;
  const genoemd = autos.filter((a) => {
    const n = kaal(a.naam).trim();
    return n.length >= 2 && t.includes(` ${n} `);
  });
  if (genoemd.length === 1) return genoemd[0]!;
  return {
    ok: false,
    antwoord: nl ? `Welke auto: ${autos.map((a) => a.naam).join(' of ')}?` : `Which car: ${autos.map((a) => a.naam).join(' or ')}?`,
    keuze: autos.map((a) => ({ label: a.naam, tekst: `${ruw.trim()} ${a.naam}` })),
  };
}

/**
 * Een zin over laden als stap voor `/api/laden`, een zin waarom het niet kan,
 * of null als het geen opdracht over laden is.
 */
export function herkenLaden(ruw: string, autos: readonly LaadAuto[], lang: Lang, nuMs: number, tz: string): LaadHerkend | null {
  if (!isLadenZin(ruw) || !autos.length) return null;
  const t = kaal(ruw);
  const nl = lang === 'nl';
  // Een vraag ("hoe laat is de auto vol?", "laadt de auto?") is geen opdracht.
  if (/^\s*(hoe|wanneer|waarom|hoeveel|wat|is|laadt|when|why|how|what|is|does)\b/.test(t)) return null;

  const terug = /\b(laat de laadpaal (weer )?zelf|laadpaal (weer )?zelf (laten )?kiezen|terug naar de laadpaal|terug naar evcc|stop met laden met de hand|niet meer met de hand|back to the charger|back to evcc|let the charger decide|stop charging by hand)\b/.test(t);
  const hervat = /\b(hervat|weer laden|laad (\w+ )*weer|ga (weer )?laden|resume|start charging again)\b/.test(t);
  const pauze = /\b(pauzeer|pauze|pause|stop (met )?laden|stop charging|niet laden|laad niet)\b/.test(t);
  const amp = /\b(\d{1,2}) ?(a|amp|amps|ampere|ampère)\b/.exec(t);
  const snel = /\b(snel|fast|zo snel mogelijk|vol gas|as fast as possible)\b/.test(t);
  const minZon = /\b(min ?\+? ?zon|minimaal (en |plus )?zon|min (plus )?solar|min ?\+ ?solar)\b/.test(t);
  const opZon = !minZon && /\b(op zon|met zon|zon|solar|op eigen zon)\b/.test(t);
  const slim = /\b(slim|smart)\b/.test(t);
  const uit = /\b(laden uit|zet (\w+ )*laden uit|charging off|turn (\w+ )*charging off)\b/.test(t);
  if (!terug && !hervat && !pauze && !amp && !snel && !opZon && !minZon && !slim && !uit) return null;

  const gekozen = welke(ruw, t, autos, nl);
  if ('ok' in gekozen) return gekozen;
  const a = gekozen;
  const naam = wie(a.naam, nl);
  if (!a.mag) {
    return {
      ok: false,
      antwoord: nl
        ? `Zet bij Energie › Auto en laadpaal aan dat SunArc ${a.evcc ? 'de stand van evcc mag zetten' : 'de laadpaal mag bedienen'}. Dan kan het ook met een zin.`
        : `In Energy › Car and charger, allow SunArc to ${a.evcc ? 'set the evcc mode' : 'control the charger'}. Then it works with a sentence too.`,
    };
  }
  const stap = (body: Record<string, unknown>, antwoord: string, waarde: string, uitleg: string): LaadHerkend => ({
    ok: true,
    deel: { antwoord, feiten: [], stappen: [{ pad: 'api/laden', body: { auto: a.id, ...body } }], gedaan: [{ soort: 'laden', waarde, uitleg }], ruimte: null, beweegt: null, vervolg: [] },
  });
  const totBody = (x: Tot) => ({ tot: x.tot, ...(x.tot === 'tijd' ? { totMs: x.totMs } : {}), ...(x.tot === 'pct' ? { pct: x.pct } : {}) });

  // Terug naar de laadpaal of evcc; "laad weer" na een pauze met de hand ook.
  if (terug || (hervat && a.actief && !amp)) {
    if (!a.actief) return { ok: false, antwoord: nl ? `${hoofd(naam)} laadt al zoals de laadpaal kiest.` : `${hoofd(naam)} already charges the way the charger chooses.` };
    return stap(
      { terug: true },
      a.evcc ? (nl ? `evcc staat weer zoals daarvoor voor ${naam}.` : `evcc is back as it was for ${naam}.`) : nl ? `De laadpaal kiest weer zelf voor ${naam}.` : `The charger decides again for ${naam}.`,
      nl ? 'Zelf' : 'Itself',
      a.naam,
    );
  }
  if (hervat && !amp && !snel) return { ok: false, antwoord: nl ? `Er staat niets met de hand stil bij ${naam}.` : `Nothing is paused by hand for ${naam}.` };

  const x = totVan(t, nuMs, tz);
  const tot = totZin(x, tz, nl);

  // Met evcc: de stand.
  if (a.evcc) {
    const stand = uit && a.evcc.includes('off') ? 'off' : snel ? 'now' : minZon && a.evcc.includes('minpv') ? 'minpv' : opZon && a.evcc.includes('pv') ? 'pv' : (slim || opZon) && a.evcc.includes('smart') ? 'smart' : pauze && a.evcc.includes('off') ? 'off' : null;
    if (!stand) {
      const namen = a.evcc.map((s) => (nl ? STAND_NL : STAND_EN)[s] ?? s);
      return { ok: false, antwoord: nl ? `Met evcc kies je de stand: ${namen.join(', ')}.` : `With evcc you choose the mode: ${namen.join(', ')}.` };
    }
    const woord = (nl ? STAND_NL : STAND_EN)[stand]!;
    const antwoord = stand === 'off'
      ? nl ? `Laden staat uit voor ${naam}, ${tot}.` : `Charging is off for ${naam}, ${tot}.`
      : nl ? `${hoofd(naam)} laadt op ${woord}, ${tot}.` : `${hoofd(naam)} charges on ${woord}, ${tot}.`;
    return stap({ stand, ...totBody(x) }, antwoord, woord, `${a.naam}, ${tot}`);
  }

  if (pauze) {
    if (!a.pauze) return { ok: false, antwoord: nl ? 'Deze laadpaal kan niet pauzeren.' : 'This charger cannot pause.' };
    if (x.tot === 'pct') return { ok: false, antwoord: nl ? 'Pauzeren gaat tot een tijd of tot de kabel eruit gaat.' : 'Pausing goes until a time or until the cable comes out.' };
    return stap({ pauze: true, ...totBody(x) }, nl ? `Het laden van ${naam} staat stil, ${tot}.` : `Charging ${naam} is paused, ${tot}.`, nl ? 'Pauze' : 'Paused', `${a.naam}, ${tot}`);
  }
  if (!a.stroom) return { ok: false, antwoord: nl ? 'De stroom van deze laadpaal is niet in te stellen.' : 'The current of this charger cannot be set.' };
  const hoogste = Math.min(a.stroom.max, a.zekeringA ?? Infinity);
  if (opZon) return { ok: false, antwoord: nl ? 'Laden op zon kiest de laadpaal zelf. Met de hand kies je een stroom, bijvoorbeeld "laad met 8 ampère".' : 'Charging on solar is up to the charger. By hand you choose a current, for example "charge at 8 amps".' };
  const n = amp ? Number(amp[1]) : Math.floor(hoogste);
  if (n < a.stroom.min || n > a.stroom.max) return { ok: false, antwoord: nl ? `De laadpaal kan ${a.stroom.min} tot ${a.stroom.max} ampère.` : `The charger can do ${a.stroom.min} to ${a.stroom.max} amps.` };
  if (a.zekeringA != null && n > a.zekeringA) return { ok: false, antwoord: nl ? `Meer dan ${Math.floor(a.zekeringA)} ampère past nu niet op je zekering.` : `More than ${Math.floor(a.zekeringA)} amps does not fit your main fuse right now.` };
  return stap({ stroomA: n, ...totBody(x) }, nl ? `${hoofd(naam)} laadt met ${n} ampère, ${tot}.` : `${hoofd(naam)} charges at ${n} amps, ${tot}.`, `${n} A`, `${a.naam}, ${tot}`);
}
