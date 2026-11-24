/**
 * Bijwerken vanuit de app. In de add-on ziet de app zelf
 * dat er een nieuwe versie klaarstaat: Home Assistant heeft voor elke add-on
 * een `update.`-entiteit, met de versie die er is en de nieuwste. Dan staat er
 * een melding; een tik geeft wat er nieuw is en een knop Bijwerken.
 *
 * Wat er nieuw is, komt uit `addon/CHANGELOG.md`. Dat bestand maakt
 * `changelog()` uit `NIEUW` in version.ts (een test houdt ze gelijk); de
 * Supervisor leest het van GitHub, en Home Assistant geeft het als
 * releasenotes van de nieuwste versie (`update/release_notes`). Zo kent de app
 * ook wat er in een versie staat die hij zelf nog niet heeft.
 *
 * Bijwerken is een smalle schrijfdeur: `update.install` op de eigen
 * `update.`-entiteit, verder niets, en alleen voor de beheerder. Alleen in de
 * add-on; de NAS rolt zichzelf uit (besluit 152). Alles hier is zuiver.
 */

import type { HaEntityState } from '../adapters/homeassistant/client.js';
import type { Nieuw } from '../version.js';
import type { Lang } from './assistant.js';

/** De naam van de add-on, zoals Home Assistant hem als titel van de update geeft. */
export const ADDON_NAAM = 'SunArc';
/** Tot versie 0.94.0 heette de add-on Smart Climate (besluit 222); een oude update herkent hij ook. */
const NAMEN: readonly unknown[] = [ADDON_NAAM, 'Smart Climate'];

/** De update-entiteit van de eigen add-on, of null. */
export function eigenUpdate(states: Iterable<HaEntityState>): HaEntityState | null {
  for (const s of states) {
    if (!/^update\.[a-z0-9_]+$/.test(s.entity_id)) continue;
    if (NAMEN.includes(s.attributes['title'])) return s;
  }
  return null;
}

/** Is versie a nieuwer dan b? Versies als 0.46.1. */
export function nieuwer(a: string, b: string): boolean {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x !== y) return x > y;
  }
  return false;
}

type Soort = 'nieuw' | 'beter' | 'opgelost';
/**
 * De kopjes per taal (besluit 185). Home Assistant toont het bestand aan
 * iedereen hetzelfde; daarom staan beide talen erin, eerst Nederlands en dan
 * onder *English* het Engels. De app leest het deel in de taal van wie kijkt.
 */
const KOPPEN: Readonly<Record<Lang, readonly (readonly [Soort, string])[]>> = {
  nl: [['nieuw', 'Nieuw'], ['beter', 'Beter'], ['opgelost', 'Opgelost']],
  en: [['nieuw', 'New'], ['beter', 'Improved'], ['opgelost', 'Fixed']],
};
const DATUM = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** De regels van een versie onder hun kopjes, in één taal. */
function blok(n: Pick<Nieuw, Soort>, lang: Lang): string[] {
  const regels: string[] = [];
  for (const [k, kop] of KOPPEN[lang]) {
    const lijst = n[k] ?? [];
    if (lijst.length) regels.push('', `**${kop}**`, '', ...lijst.map((x) => `- ${x}`));
  }
  return regels;
}

/** Wat nieuw, beter en opgelost is in een reeks versies, samen onder één kopje per soort; dezelfde regel één keer. */
export function samen(lijst: readonly Partial<Record<Soort, readonly string[]>>[]): Record<Soort, string[]> {
  const uit: Record<Soort, string[]> = { nieuw: [], beter: [], opgelost: [] };
  for (const [k] of KOPPEN.nl) uit[k] = [...new Set(lijst.flatMap((n) => n[k] ?? []))];
  return uit;
}

/**
 * De versies per uitgave op main. Wat alleen op beta stond,
 * hoort bij de uitgave die het naar main bracht: wie van main bijwerkt, ziet
 * één overzicht van alles sinds de vorige uitgave in plaats van een lange
 * lijst versies. Versies van vóór de oudste in `opMain` staan elk apart.
 */
export function perUitgave(nieuw: readonly Nieuw[], opMain: readonly string[]): Nieuw[][] {
  const main = new Set(opMain);
  const oudste = opMain.reduce<string | null>((o, v) => (o == null || nieuwer(o, v) ? v : o), null);
  const groepen: Nieuw[][] = [];
  for (const n of nieuw) {
    const eigen = main.has(n.versie) || oudste == null || nieuwer(oudste, n.versie);
    const laatste = groepen.at(-1);
    // Een uitgave begint bij zijn eigen versie; een versie alleen op beta hoort bij de uitgave erboven
    // (bovenaan, nog niet op main: dan vormen ze samen de volgende uitgave).
    if (eigen || !laatste) groepen.push([n]);
    else laatste.push(n);
  }
  return groepen;
}

/** `addon/CHANGELOG.md` uit `NIEUW`: per uitgave op main de datum en wat nieuw, beter en opgelost is, in het Nederlands en (als het er is) in het Engels. */
export function changelog(nieuw: readonly Nieuw[], opMain: readonly string[] = []): string {
  const delen = perUitgave(nieuw, opMain).map((g) => {
    const kop = g[0]!;
    const datum = DATUM.format(Date.parse(`${kop.datum}T12:00:00Z`));
    const reeks = g.length > 1 ? ` · ${g.at(-1)!.versie} – ${kop.versie}` : '';
    const regels = [`## ${kop.versie}`, '', `*${datum}${reeks}*`, ...blok(samen(g), 'nl')];
    // Engels als een versie het heeft; een versie zonder Engels geeft dan zijn Nederlands.
    if (g.some((n) => n.en)) regels.push('', '*English*', ...blok(samen(g.map((n) => n.en ?? n)), 'en'));
    return regels.join('\n');
  });
  return `# Wat is er nieuw · What is new\n\n${delen.join('\n\n')}\n`;
}

export interface Notitie {
  readonly versie: string;
  readonly nieuw: readonly string[];
  readonly beter: readonly string[];
  readonly opgelost: readonly string[];
  /** Dezelfde regels in het Engels, als de versie die heeft. */
  readonly en?: { readonly nieuw: readonly string[]; readonly beter: readonly string[]; readonly opgelost: readonly string[] };
}

/** Leest de changelog terug, per versie en per taal; wat het niet herkent, slaat het over. */
export function leesChangelog(md: string): Notitie[] {
  type Regels = { nieuw: string[]; beter: string[]; opgelost: string[] };
  const leeg = (): Regels => ({ nieuw: [], beter: [], opgelost: [] });
  const uit: (Regels & { versie: string; en?: Regels })[] = [];
  let soort: Soort | null = null;
  let engels = false;
  for (const ruw of md.split(/\r?\n/)) {
    const regel = ruw.trim();
    const v = /^##\s+v?(\d+\.\d+\.\d+)\b/.exec(regel);
    if (v) {
      uit.push({ versie: v[1]!, ...leeg() });
      soort = null;
      engels = false;
      continue;
    }
    if (/^\*english\*$/i.test(regel)) {
      engels = true;
      soort = null;
      continue;
    }
    const kop = /^\*\*(\w+)\*\*$/.exec(regel);
    if (kop) {
      const woord = kop[1]!.toLowerCase();
      const gevonden = [...KOPPEN.nl, ...KOPPEN.en].find(([, k]) => k.toLowerCase() === woord);
      soort = gevonden ? gevonden[0] : null;
      continue;
    }
    const punt = /^[-*]\s+(.+)$/.exec(regel);
    const laatste = uit.at(-1);
    if (!punt || !soort || !laatste) continue;
    if (engels) (laatste.en ??= leeg())[soort].push(punt[1]!);
    else laatste[soort].push(punt[1]!);
  }
  return uit;
}

/** Een notitie in de taal van de app: het Engels als het er is, anders het Nederlands. */
export function notitieInTaal(n: Notitie, lang: Lang): Notitie {
  const { en, ...nl } = n;
  return lang === 'en' && en ? { versie: n.versie, ...en } : nl;
}

export interface UpdateView {
  /** Staat er een nieuwere versie klaar? */
  readonly beschikbaar: boolean;
  readonly nu: string;
  readonly nieuwste: string | null;
  /** Wordt er nu bijgewerkt? */
  readonly bezig: boolean;
  /** Wat er nieuw is sinds de versie van nu: één overzicht, onder de nieuwste versie. */
  readonly notities: readonly Notitie[];
  /** Mag wie kijkt bijwerken (de beheerder)? */
  readonly magBijwerken: boolean;
}

/** Wat de app laat zien: uit de update-entiteit en de releasenotes van de nieuwste versie, in de taal van de app. */
export function updateView(nu: string, s: HaEntityState | null, releaseNotes: string | null, magBijwerken: boolean, lang: Lang = 'nl'): UpdateView {
  const nieuwste = typeof s?.attributes['latest_version'] === 'string' ? (s.attributes['latest_version'] as string).replace(/^v/, '') : null;
  const beschikbaar = s?.state === 'on' && nieuwste != null && nieuwer(nieuwste, nu);
  const los = beschikbaar && releaseNotes ? leesChangelog(releaseNotes).filter((n) => nieuwer(n.versie, nu) && !nieuwer(n.versie, nieuwste!)).map((n) => notitieInTaal(n, lang)) : [];
  // Eén overzicht van alles sinds de versie van nu, ook als er uitgaven tussen zitten.
  const notities: Notitie[] = los.length > 1 ? [{ versie: los[0]!.versie, ...samen(los) }] : los;
  return { beschikbaar, nu, nieuwste, bezig: s?.attributes['in_progress'] === true, notities, magBijwerken };
}
