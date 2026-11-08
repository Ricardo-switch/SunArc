/**
 * Laden met de hand (besluit 262, stap 5 van besluit 259; schets Wand-Auto en
 * Tel-Auto, het blad Laden). Zoals klimaat met de hand (besluit 235):
 *
 * - **Wat:** de hoogste laadstroom per fase in A, of pauzeren. Alleen bij een
 *   laadpaal (of auto) die de bewoner bij Energie aanzette voor bedienen, en
 *   niet als evcc het laden regelt.
 * - **Grenzen:** nooit buiten het bereik van het getal in Home Assistant, en
 *   nooit boven wat er op de zekering past (de pagina geeft die grens mee uit
 *   de stroom per fase; zonder meting de zekering zelf).
 * - **Hoe lang:** altijd met een eind: een uur, tot een tijd, tot een % (nooit
 *   boven de laadgrens van de auto), of tot de kabel eruit gaat. Hooguit twee
 *   dagen.
 * - **Daarna:** terug naar de stroom van daarvoor en weer laden, maar alleen
 *   als het nog staat zoals de app het zette: wie intussen zelf iets verzette,
 *   wint. Wat terug moet staat in `laadhand.json`, zodat een herstart het niet
 *   vergeet.
 *
 * De stroom gaat met de hand niet vanzelf omlaag bij een wolk; dat is B.
 */

import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Auto, LaadBediening, LaadPauze } from './opslag.js';

export const LAAD_BESTAND = 'laadhand.json';
/** Hooguit zo lang met de hand. */
export const LAAD_MAX_MS = 48 * 3_600_000;

export type LaadTot = 'uur' | 'tijd' | 'pct' | 'kabel';
export type EaseeDienst = 'set_charger_dynamic_limit' | 'action_command';
/** Zo lang mag de levensduur bij Easee hooguit zijn, in minuten (18 uur). */
export const EASEE_TTL_MAX = 1080;
/** Zo lang voor het eind van de levensduur zet SunArc hem opnieuw, als het met de hand langer duurt. */
const EASEE_VERNIEUW_MS = 30 * 60_000;

/** Wat er op het eind terug moet, per auto. */
export interface LaadTerug {
  readonly auto: string;
  readonly tot: LaadTot;
  readonly totMs: number;
  /** Bij `pct`: tot hoeveel procent. */
  readonly pct?: number;
  /**
   * De stroom die de app zette, en wat er daarvoor stond. Bij Easee (besluit
   * 277) ook het apparaat en tot wanneer de levensduur loopt die Easee zelf
   * bewaakt: valt SunArc stil, dan gaat de laadpaal op die tijd vanzelf terug.
   */
  readonly stroom?: { readonly id: string; readonly gezet: number; readonly was: number; readonly easee?: string; readonly vangnetMs?: number };
  /** De app pauzeerde het laden. */
  readonly pauze?: LaadPauze;
  readonly sindsMs: number;
}

interface Toestand {
  readonly state: string;
}

export interface LaadDeur {
  readonly state: (id: string) => Toestand | undefined;
  readonly zetStroom: (id: string, a: number) => Promise<void>;
  readonly schakel: (id: string, aan: boolean) => Promise<void>;
  readonly druk: (id: string) => Promise<void>;
  /** De eigen dienst van Easee op een apparaat (besluit 277). */
  readonly easee?: (apparaat: string, dienst: EaseeDienst, data: Readonly<Record<string, unknown>>) => Promise<void>;
  readonly auto: (id: string) => Auto | null;
  readonly bediening: (id: string) => LaadBediening | null;
  /** De hoogste stroom per fase die nu op de zekering past, of null zonder aansluiting. */
  readonly zekeringA?: (id: string) => number | null;
  readonly nu?: () => number;
  readonly map: string | null;
}

export interface LaadVraag {
  readonly stroomA?: number;
  readonly pauze?: boolean;
  readonly tot: LaadTot;
  /** Bij `tijd`: tot wanneer; bij `uur` rekent de dienst het zelf. */
  readonly totMs?: number;
  readonly pct?: number;
}

export type LaadUitkomst = { readonly ok: true; readonly terug: LaadTerug } | { readonly ok: false; readonly reden: string };

/** Wat het blad Laden van een auto nodig heeft. */
export interface LaadStand {
  readonly auto: string;
  readonly stroom: { readonly min: number; readonly max: number; readonly stap: number; readonly nuA: number | null } | null;
  readonly pauze: boolean;
  readonly mag: boolean;
  readonly evcc: boolean;
  /** De hoogste stroom die nu op de zekering past, of null. */
  readonly zekeringA: number | null;
  readonly actief: { readonly stroomA: number | null; readonly pauze: boolean; readonly tot: LaadTot; readonly totMs: number; readonly pct: number | null } | null;
}

const getal = (s: Toestand | undefined): number | null => {
  const n = Number(s?.state);
  return s != null && s.state !== '' && Number.isFinite(n) ? n : null;
};

/** Staat het laden nu stil? Bij een schakelaar uit zijn stand; bij knoppen weten we het niet. */
function gepauzeerd(p: LaadPauze, state: (id: string) => Toestand | undefined): boolean | null {
  if (p.soort !== 'schakelaar') return null;
  const s = state(p.id)?.state;
  if (s !== 'on' && s !== 'off') return null;
  return p.omgekeerd ? s === 'on' : s === 'off';
}

export class Laadhand {
  readonly #d: LaadDeur;
  #terug: LaadTerug[] = [];
  #geladen = false;
  /** Wat net klaar is op de tijd of het %, voor de bel (besluit 263); de kabel eruit hoeft geen melding. */
  #klaar: { auto: string; tot: 'uur' | 'tijd' | 'pct'; pct: number | null; ms: number }[] = [];

  constructor(d: LaadDeur) {
    this.#d = d;
  }

  #nu(): number {
    return this.#d.nu?.() ?? Date.now();
  }

  /** Wat er nog terug moet. */
  get terugzetten(): readonly LaadTerug[] {
    return [...this.#terug];
  }

  /** Wat het afgelopen uur vanzelf klaar was, op de tijd of het %. */
  get klaar(): readonly { readonly auto: string; readonly tot: 'uur' | 'tijd' | 'pct'; readonly pct: number | null; readonly ms: number }[] {
    const nu = this.#nu();
    return this.#klaar.filter((k) => nu - k.ms < 3_600_000);
  }

  async stand(id: string): Promise<LaadStand | null> {
    await this.#laad();
    const b = this.#d.bediening(id);
    if (!b) return null;
    const t = this.#terug.find((x) => x.auto === id);
    return {
      auto: id,
      stroom: b.stroom ? { min: b.stroom.min, max: b.stroom.max, stap: b.stroom.stap, nuA: b.stroom.nuA } : null,
      pauze: b.pauze != null,
      mag: b.mag,
      evcc: b.evcc,
      zekeringA: this.#d.zekeringA?.(id) ?? null,
      actief: t ? { stroomA: t.stroom?.gezet ?? null, pauze: t.pauze != null, tot: t.tot, totMs: t.totMs, pct: t.pct ?? null } : null,
    };
  }

  /** Met de hand: een stroom of pauzeren, tot het eind dat de bewoner koos. */
  async zet(id: string, v: LaadVraag): Promise<LaadUitkomst> {
    await this.#laad();
    const b = this.#d.bediening(id);
    const a = this.#d.auto(id);
    if (!b || !a) return { ok: false, reden: 'die auto is er niet' };
    if (b.evcc) return { ok: false, reden: 'evcc regelt het laden; zet het in evcc' };
    if (!b.mag) return { ok: false, reden: 'zet bij Energie › Auto en laadpaal eerst aan dat SunArc de laadpaal mag bedienen' };
    if (a.thuis === false || a.aangesloten === false) return { ok: false, reden: 'de auto hangt niet aan de laadpaal' };
    const nu = this.#nu();
    const eind = this.#eind(v, a, nu);
    if ('reden' in eind) return { ok: false, reden: eind.reden };
    const eerder = this.#terug.find((x) => x.auto === id);

    let stroom: LaadTerug['stroom'];
    let pauze: LaadPauze | undefined;
    if (v.pauze) {
      if (!b.pauze) return { ok: false, reden: 'deze laadpaal kan niet pauzeren' };
      if (v.tot === 'pct') return { ok: false, reden: 'pauzeren gaat tot een tijd of tot de kabel eruit gaat' };
      await this.#pauzeer(b.pauze, true);
      pauze = b.pauze;
      // Een stroom die al met de hand stond, blijft staan tot het eind.
      stroom = eerder?.stroom;
    } else {
      if (!b.stroom) return { ok: false, reden: 'de stroom van deze laadpaal is niet in te stellen' };
      const s = b.stroom;
      const n = v.stroomA;
      if (typeof n !== 'number' || !Number.isFinite(n)) return { ok: false, reden: 'stroomA is een getal in A' };
      const doel = Math.round(n / s.stap) * s.stap;
      if (doel < s.min || doel > s.max) return { ok: false, reden: `de laadpaal kan ${s.min} tot ${s.max} A` };
      const zekering = this.#d.zekeringA?.(id) ?? null;
      if (zekering != null && doel > zekering) return { ok: false, reden: `meer dan ${Math.floor(zekering)} A past nu niet op je zekering` };
      // Zegt Easee niet waar hij op staat (de sensor staat standaard uit), dan stond hij op zijn grens.
      const was = eerder?.stroom?.was ?? s.nuA ?? (s.easee ? s.max : null);
      if (was == null) return { ok: false, reden: 'Home Assistant zegt niet op welke stroom de laadpaal nu staat' };
      if (s.easee) {
        const vangnetMs = await this.#easeeStroom(s.easee, doel, eind.totMs, nu);
        stroom = { id: s.id, gezet: doel, was, easee: s.easee, vangnetMs };
      } else {
        if (s.nuA !== doel) await this.#d.zetStroom(s.id, doel);
        stroom = { id: s.id, gezet: doel, was };
      }
      // Was hij met de hand gepauzeerd, dan laadt hij nu weer.
      if (eerder?.pauze) await this.#pauzeer(eerder.pauze, false);
    }
    const terug: LaadTerug = {
      auto: id,
      tot: v.tot,
      totMs: eind.totMs,
      ...(v.tot === 'pct' ? { pct: eind.pct! } : {}),
      ...(stroom ? { stroom } : {}),
      ...(pauze ? { pauze } : {}),
      sindsMs: eerder?.sindsMs ?? nu,
    };
    this.#terug = [...this.#terug.filter((x) => x.auto !== id), terug];
    await this.#bewaar();
    return { ok: true, terug };
  }

  /** Tot wanneer: een uur, een tijd, een % (met een uiterste tijd), of de kabel. */
  #eind(v: LaadVraag, a: Auto, nu: number): { totMs: number; pct?: number } | { reden: string } {
    if (v.tot === 'uur') return { totMs: nu + 3_600_000 };
    if (v.tot === 'kabel') return { totMs: nu + LAAD_MAX_MS };
    if (v.tot === 'tijd') {
      const t = v.totMs;
      if (typeof t !== 'number' || !(t > nu && t <= nu + LAAD_MAX_MS)) return { reden: 'tot wanneer ligt in de komende twee dagen' };
      return { totMs: t };
    }
    if (v.tot === 'pct') {
      const p = v.pct;
      if (typeof p !== 'number' || !Number.isFinite(p) || p < 10 || p > 100) return { reden: 'tot een % is 10 tot 100' };
      if (a.pct == null) return { reden: 'hoe vol de auto is, zegt hij niet; kies een tijd of de kabel' };
      const grens = a.laadgrens ?? 100;
      if (p > grens) return { reden: `boven de laadgrens van de auto (${grens}%) gaat niet` };
      if (p <= a.pct) return { reden: `de auto staat al op ${Math.round(a.pct)}%` };
      return { totMs: nu + LAAD_MAX_MS / 2, pct: Math.round(p) };
    }
    return { reden: 'tot is uur, tijd, pct of kabel' };
  }

  async #pauzeer(p: LaadPauze, stil: boolean): Promise<void> {
    if (p.soort === 'schakelaar') await this.#d.schakel(p.id, p.omgekeerd ? stil : !stil);
    else if (p.soort === 'easee') await this.#easee(p.apparaat, 'action_command', { action_command: stil ? 'pause' : 'resume' });
    else await this.#d.druk(stil ? p.pauze : p.hervat);
  }

  async #easee(apparaat: string, dienst: EaseeDienst, data: Readonly<Record<string, unknown>>): Promise<void> {
    if (!this.#d.easee) throw new Error('Easee bedienen kan hier niet');
    await this.#d.easee(apparaat, dienst, data);
  }

  /**
   * De stroom bij Easee, met een levensduur tot het eind (hooguit 18 uur). Geeft
   * terug tot wanneer Easee hem vasthoudt; daarna valt hij vanzelf terug.
   */
  async #easeeStroom(apparaat: string, a: number, totMs: number, nu: number): Promise<number> {
    const minuten = Math.max(1, Math.min(EASEE_TTL_MAX, Math.ceil((totMs - nu) / 60_000)));
    await this.#easee(apparaat, 'set_charger_dynamic_limit', { current: a, time_to_live: minuten });
    return nu + minuten * 60_000;
  }

  /**
   * Duurt het met de hand langer dan de levensduur bij Easee, dan zet SunArc
   * hem op tijd opnieuw; maar alleen als hij nog staat zoals de app hem zette.
   */
  async #vernieuwEasee(nu: number): Promise<boolean> {
    let anders = false;
    const lijst: LaadTerug[] = [];
    for (const t of this.#terug) {
      const s = t.stroom;
      if (!s?.easee || s.vangnetMs == null || t.totMs <= s.vangnetMs || s.vangnetMs - nu > EASEE_VERNIEUW_MS) {
        lijst.push(t);
        continue;
      }
      const staat = getal(this.#d.state(s.id));
      if (staat != null && staat !== s.gezet) {
        lijst.push(t);
        continue;
      }
      try {
        const vangnetMs = await this.#easeeStroom(s.easee, s.gezet, t.totMs, nu);
        lijst.push({ ...t, stroom: { ...s, vangnetMs } });
        anders = true;
      } catch {
        lijst.push(t);
      }
    }
    this.#terug = lijst;
    return anders;
  }

  /** Terug naar de laadpaal: nu meteen, voor deze auto. */
  async terugNu(id: string): Promise<boolean> {
    await this.#laad();
    const t = this.#terug.find((x) => x.auto === id);
    if (!t) return false;
    await this.#zetTerug(t, true);
    this.#terug = this.#terug.filter((x) => x !== t);
    await this.#bewaar();
    return true;
  }

  /** Elke minuut: wat klaar is, terug. Klaar is de tijd, het %, of de kabel eruit. */
  async ronde(): Promise<string[]> {
    await this.#laad();
    const nu = this.#nu();
    if (await this.#vernieuwEasee(nu)) await this.#bewaar();
    const klaar = this.#terug.filter((t) => {
      if (t.totMs <= nu) return true;
      const a = this.#d.auto(t.auto);
      if (!a) return false;
      if (a.thuis === false || a.aangesloten === false) return true;
      return t.tot === 'pct' && t.pct != null && a.pct != null && a.pct >= t.pct;
    });
    if (!klaar.length) return [];
    const gedaan: string[] = [];
    for (const t of klaar) {
      try {
        gedaan.push(...(await this.#zetTerug(t)));
      } catch {
        // Volgende ronde opnieuw.
        continue;
      }
      this.#terug = this.#terug.filter((x) => x !== t);
      // Op de tijd of het %: een melding; kabel eruit of de auto weg niet.
      const a = this.#d.auto(t.auto);
      const weg = a != null && (a.thuis === false || a.aangesloten === false);
      if (!weg && t.tot !== 'kabel') this.#klaar = [...this.#klaar.filter((k) => nu - k.ms < 3_600_000), { auto: t.auto, tot: t.tot, pct: t.tot === 'pct' ? (t.pct ?? null) : null, ms: nu }];
    }
    await this.#bewaar();
    return gedaan;
  }

  /** Terug, maar alleen wat nog staat zoals de app het zette; met `altijd` (de bewoner vraagt het) ook anders. */
  async #zetTerug(t: LaadTerug, altijd = false): Promise<string[]> {
    const gedaan: string[] = [];
    if (t.stroom?.easee) {
      // Bij Easee zonder sensor weten we niet wat er staat: dan terug naar wat er was, zonder levensduur.
      const nu = getal(this.#d.state(t.stroom.id));
      if ((altijd || nu == null || nu === t.stroom.gezet) && nu !== t.stroom.was) {
        await this.#easee(t.stroom.easee, 'set_charger_dynamic_limit', { current: t.stroom.was, time_to_live: 0 });
        gedaan.push(`${t.auto} terug naar ${t.stroom.was} A`);
      }
    } else if (t.stroom) {
      const nu = getal(this.#d.state(t.stroom.id));
      if ((altijd || nu === t.stroom.gezet) && nu !== t.stroom.was) {
        await this.#d.zetStroom(t.stroom.id, t.stroom.was);
        gedaan.push(`${t.stroom.id} terug naar ${t.stroom.was} A`);
      }
    }
    if (t.pauze) {
      const stil = gepauzeerd(t.pauze, this.#d.state);
      // Bij knoppen weet alleen de auto of hij stilstaat: hervatten als hij niet laadt en de kabel erin zit.
      const a = this.#d.auto(t.auto);
      const hervat = stil === true || (stil == null && (altijd || (a?.laadt === false && a.aangesloten === true)));
      if (hervat) {
        await this.#pauzeer(t.pauze, false);
        gedaan.push(`${t.auto} laadt weer`);
      }
    }
    return gedaan;
  }

  async #laad(): Promise<void> {
    if (this.#geladen) return;
    this.#geladen = true;
    if (this.#d.map == null) return;
    try {
      const j: unknown = JSON.parse(await readFile(join(this.#d.map, LAAD_BESTAND), 'utf8'));
      const lijst = (j as { terug?: unknown })?.terug;
      if (Array.isArray(lijst)) {
        this.#terug = lijst.filter(
          (t): t is LaadTerug =>
            typeof t === 'object' && t != null && typeof (t as LaadTerug).auto === 'string' && Number.isFinite((t as LaadTerug).totMs) && ['uur', 'tijd', 'pct', 'kabel'].includes((t as LaadTerug).tot),
        );
      }
    } catch {
      // Nog niets bewaard.
    }
  }

  async #bewaar(): Promise<void> {
    if (this.#d.map == null) return;
    const pad = join(this.#d.map, LAAD_BESTAND);
    await writeFile(`${pad}.tmp`, `${JSON.stringify({ versie: 1, terug: this.#terug }, null, 2)}\n`);
    await rename(`${pad}.tmp`, pad);
  }
}

/* ------------------------------------------------------------ de smalle deur */

/** Wat de smalle deur van laden doorlaat (besluit 262). */
export interface LaadMag {
  readonly stroom: readonly { readonly id: string; readonly min: number; readonly max: number }[];
  readonly schakelaars: readonly string[];
  readonly knoppen: readonly string[];
  /** Easee (besluit 277): per apparaat het bereik van de stroom, en of pauzeren mag. */
  readonly easee: readonly EaseeMag[];
}

export interface EaseeMag {
  readonly apparaat: string;
  /** Het bereik van de stroom, of null als alleen pauzeren mag. */
  readonly min: number | null;
  readonly max: number | null;
  readonly pauze: boolean;
}

/** De entiteiten van de laadpalen die mogen, en wat er nog terug moet. */
export function laadMag(bedieningen: readonly LaadBediening[], terug: readonly LaadTerug[]): LaadMag {
  const stroom = new Map<string, { id: string; min: number; max: number }>();
  const schakelaars = new Set<string>();
  const knoppen = new Set<string>();
  const easee = new Map<string, EaseeMag>();
  const eenEasee = (apparaat: string): EaseeMag => easee.get(apparaat) ?? { apparaat, min: null, max: null, pauze: false };
  const bereik = (id: string, easeeVan: string | undefined, ...waarden: number[]) => {
    if (easeeVan) {
      const was = eenEasee(easeeVan);
      easee.set(easeeVan, { ...was, min: Math.min(...waarden, was.min ?? Infinity), max: Math.max(...waarden, was.max ?? -Infinity) });
      return;
    }
    const was = stroom.get(id);
    stroom.set(id, { id, min: Math.min(...waarden, was?.min ?? Infinity), max: Math.max(...waarden, was?.max ?? -Infinity) });
  };
  const pauze = (p: LaadPauze) => {
    if (p.soort === 'schakelaar') schakelaars.add(p.id);
    else if (p.soort === 'easee') easee.set(p.apparaat, { ...eenEasee(p.apparaat), pauze: true });
    else [p.pauze, p.hervat].forEach((k) => knoppen.add(k));
  };
  for (const b of bedieningen) {
    if (!b.mag) continue;
    if (b.stroom) bereik(b.stroom.id, b.stroom.easee, b.stroom.min, b.stroom.max);
    if (b.pauze) pauze(b.pauze);
  }
  // Wat terug moet, mag ook als het bedienen intussen uit ging: terug naar wat er stond, ook onder 6 A.
  for (const t of terug) {
    if (t.stroom) bereik(t.stroom.id, t.stroom.easee, t.stroom.was, t.stroom.gezet);
    if (t.pauze) pauze(t.pauze);
  }
  return { stroom: [...stroom.values()], schakelaars: [...schakelaars], knoppen: [...knoppen], easee: [...easee.values()] };
}
