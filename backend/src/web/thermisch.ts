/**
 * Hoe je huis warmte vasthoudt (besluit 231): het eerste deel van het
 * thermisch model (stap D, besluit 46), geleerd uit het beslislogboek.
 *
 * Per kwartier per zone de temperatuur, buiten, de zon en wat de apparaten
 * deden. Daaruit, per zone:
 *
 * - **Afkoelen:** stukken van minstens drie uur zonder zon en zonder dat er iets
 *   verwarmt of koelt. Newton: de helling is −k maal het verschil met buiten. Over
 *   het hele stuk gemeten, want per kwartier is de meter te grof (0,05°).
 * - **Zon:** overdag, niets aan: wat er na het afkoelen overblijft, per kW van
 *   de panelen.
 * - **Elk apparaat:** kwartieren waarin alleen dat apparaat iets deed: wat er na
 *   het afkoelen en de zon overblijft, per stand (verwarmen of koelen).
 *
 * Een apparaat doet iets als het op verwarmen staat met een doel boven de kamer,
 * of op koelen met een doel eronder. Of de ketel werkelijk brandt, ziet het
 * logboek niet; een warmer die zo geen merkbare warmte geeft, heet nog
 * onduidelijk in plaats van een getal dat niet klopt.
 *
 * Alleen wereldbeeld, geen beleid (besluit 46): de regeling gebruikt het nog
 * niet. Het rekent elke nacht één keer op de achtergrond, en bewaart de
 * uitkomst naast het logboek.
 */

import { readFile, rename, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import type { SiteConfig } from '../core/model.js';
import { findLogFiles, readMoments } from '../divergence/read.js';
import { partsIn } from './today.js';

const KWARTIER = 15 * 60_000;
/** Zoveel dagen terug: een huis verandert (de ventilatie), en lezen kost tijd. */
export const TERUG_DAGEN = 180;
/** Een rustig stuk is minstens zo lang, in kwartieren. */
const RUST_MIN = 12;
/** Minder zon dan dit telt als geen zon, in kW. */
const GEEN_ZON = 0.02;
/** Een kwartier met zon telt vanaf dit vermogen, in kW. */
const ZON_VANAF = 0.3;
/** Zoveel kwartieren voordat een apparaat een getal krijgt. */
const APPARAAT_MIN = 8;
/** Een warmer moet minstens zoveel graden per uur doen om als bekend te tellen, een koeler evenveel omlaag. */
const MERKBAAR = 0.2;
/** Het bestand met de uitkomst, naast het logboek. */
export const THERMISCH_FILE = 'thermisch.json';

/** Hoe zeker, van 0 tot 4 streepjes. */
export type Zeker = 0 | 1 | 2 | 3 | 4;
const zeker = (n: number, treden: readonly [number, number, number, number]): Zeker => treden.filter((t) => n >= t).length as Zeker;

export interface ThermischApparaat {
  readonly id: string;
  readonly naam: string;
  readonly stand: 'verwarmt' | 'koelt';
  /** Graden per uur bovenop afkoelen en zon; null zolang het niet merkbaar of te weinig gezien is. */
  readonly perUur: number | null;
  readonly kwartieren: number;
  readonly zeker: Zeker;
}

export interface ThermischZone {
  readonly id: string;
  readonly naam: string;
  /** Afkoelen per uur per graad verschil met buiten; null zonder rustige stukken. */
  readonly k: number | null;
  /** Tijdconstante in uren (1/k). */
  readonly tauUur: number | null;
  readonly rustUren: number;
  /** Graden per uur per kW van de panelen; null zonder zonnige kwartieren. */
  readonly zonPerKw: number | null;
  readonly zonKwartieren: number;
  readonly zeker: { readonly afkoelen: Zeker; readonly zon: Zeker };
  readonly apparaten: readonly ThermischApparaat[];
}

export interface ThermischRapport {
  readonly versie: 1;
  /** De dag waarop het is uitgerekend, JJJJ-MM-DD, in de tijdzone van het huis (tot 6 november 2026 UTC). */
  readonly dag: string;
  /** Vanaf wanneer er gemeten is. */
  readonly sindsMs: number | null;
  readonly dagen: number;
  readonly zones: readonly ThermischZone[];
  /** Leert nog tot elke zone zijn afkoelen kent en een warmer die iets merkbaars doet. */
  readonly stand: 'leert' | 'werkt';
}

/** Wat het leren van een moment nodig heeft. */
export interface ThermischMoment {
  readonly tMs: number;
  readonly zones: readonly { readonly id: string; readonly temperatureC: number | null }[];
  readonly observed: Readonly<Record<string, string>>;
  readonly outdoorC: number | null;
  readonly solarW: number | null;
}

/**
 * Eén kwartier, al samengevat: per zone hoe vaak elke
 * temperatuur voorkwam (voor de mediaan), buiten en de zon als som en aantal,
 * en welke standen elk apparaat had. Zo blijft er per kwartier een handvol
 * getallen over in plaats van elk moment: op de NAS liep het bewaren van een
 * half miljoen momenten uit het geheugen.
 */
interface Kwartier {
  readonly T: Map<string, Map<number, number>>;
  buitenSom: number;
  buitenN: number;
  zonSom: number;
  zonN: number;
  readonly obs: Map<string, Set<string>>;
}

/** Doet het apparaat iets bij deze kamertemperatuur: `verwarmt`, `koelt`, `iets` (onbekend wat) of null. */
function doet(waarde: string, T: number): 'verwarmt' | 'koelt' | 'iets' | null {
  const [stand, doelRuw] = waarde.split('@');
  if (stand === 'off' || stand === 'onbekend' || stand === 'unavailable' || stand === 'unknown') return null;
  const doel = doelRuw == null ? NaN : Number(doelRuw);
  // Verwarmen en koelen met één doel (een vloerthermostaat op auto): alleen verwarmen ligt voor de hand.
  if (stand === 'heat' || stand === 'heat_cool' || stand === 'auto') return Number.isFinite(doel) && doel <= T + 0.3 ? null : 'verwarmt';
  if (stand === 'cool') return Number.isFinite(doel) && doel >= T - 0.3 ? null : 'koelt';
  return stand === 'fan_only' || stand === 'dry' ? null : 'iets';
}

/** De mediaan uit hoe vaak elke waarde voorkwam; null zonder waarden. */
function mediaanVan(tel: ReadonlyMap<number, number> | undefined): number | null {
  if (!tel?.size) return null;
  let n = 0;
  for (const c of tel.values()) n += c;
  const waarden = [...tel.keys()].sort((a, b) => a - b);
  // De waarde op plek i (vanaf 0) in de gesorteerde reeks.
  const op = (i: number) => {
    let tot = 0;
    for (const w of waarden) {
      tot += tel.get(w)!;
      if (i < tot) return w;
    }
    return waarden.at(-1)!;
  };
  return n % 2 ? op((n - 1) / 2) : (op(n / 2 - 1) + op(n / 2)) / 2;
}
const gem = (l: readonly number[]) => l.reduce((a, b) => a + b, 0) / l.length;

/** De dag in de tijdzone van het huis, JJJJ-MM-DD; zonder tijdzone de UTC-dag. */
export function dagIn(ms: number, timeZone?: string): string {
  if (!timeZone) return new Date(ms).toISOString().slice(0, 10);
  const p = partsIn(ms, timeZone);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/**
 * Telt momenten op per kwartier terwijl het logboek gelezen wordt (6 november
 * 2026), zodat er nooit een half jaar aan momenten tegelijk in het geheugen
 * staat. Daarna leert `leer` eruit, net als `leerThermisch`.
 */
export class ThermischKwartieren {
  readonly #kw = new Map<number, Kwartier>();

  voeg(m: ThermischMoment): void {
    const q = Math.floor(m.tMs / KWARTIER);
    let k = this.#kw.get(q);
    if (!k) this.#kw.set(q, (k = { T: new Map(), buitenSom: 0, buitenN: 0, zonSom: 0, zonN: 0, obs: new Map() }));
    for (const z of m.zones) {
      if (z.temperatureC == null) continue;
      const tel = k.T.get(z.id) ?? k.T.set(z.id, new Map()).get(z.id)!;
      tel.set(z.temperatureC, (tel.get(z.temperatureC) ?? 0) + 1);
    }
    if (m.outdoorC != null) {
      k.buitenSom += m.outdoorC;
      k.buitenN++;
    }
    if (m.solarW != null) {
      k.zonSom += m.solarW;
      k.zonN++;
    }
    for (const id in m.observed) (k.obs.get(id) ?? k.obs.set(id, new Set()).get(id)!).add(m.observed[id]!);
  }

  /** Hoeveel kwartieren er zijn. */
  get grootte(): number {
    return this.#kw.size;
  }

  leer(zones: readonly ThermischZoneIn[], nowMs: number, timeZone?: string): ThermischRapport {
    return leerUit(this.#kw, zones, nowMs, timeZone);
  }
}

/** Leert uit momenten in tijdsvolgorde. */
export function leerThermisch(
  momenten: Iterable<ThermischMoment>,
  zones: readonly ThermischZoneIn[],
  nowMs: number,
  timeZone?: string,
): ThermischRapport {
  const kw = new ThermischKwartieren();
  for (const m of momenten) kw.voeg(m);
  return kw.leer(zones, nowMs, timeZone);
}

function leerUit(kw: ReadonlyMap<number, Kwartier>, zones: readonly ThermischZoneIn[], nowMs: number, timeZone?: string): ThermischRapport {
  const qs = [...kw.keys()].sort((a, b) => a - b);
  const dag = dagIn(nowMs, timeZone);
  const leeg: ThermischRapport = { versie: 1, dag, sindsMs: null, dagen: 0, zones: [], stand: 'leert' };
  if (qs.length < 2) return leeg;
  const tempIn = (q: number, z: string) => mediaanVan(kw.get(q)?.T.get(z));

  const uit: ThermischZone[] = [];
  for (const zone of zones) {
    // Per paar opeenvolgende kwartieren: de helling, het verschil met buiten, de zon en wie wat deed.
    const stappen: { q: number; helling: number; dT: number; zonKw: number; doen: Map<string, string> }[] = [];
    for (let i = 1; i < qs.length; i++) {
      const a = qs[i - 1]!;
      const b = qs[i]!;
      if (b - a !== 1) continue;
      const ta = tempIn(a, zone.id);
      const tb = tempIn(b, zone.id);
      const ka = kw.get(a)!;
      const kb = kw.get(b)!;
      const buitenN = ka.buitenN + kb.buitenN;
      if (ta == null || tb == null || buitenN === 0) continue;
      const T = (ta + tb) / 2;
      const zonN = ka.zonN + kb.zonN;
      const doen = new Map<string, string>();
      for (const id of new Set([...ka.obs.keys(), ...kb.obs.keys()])) {
        const wat = new Set([...(ka.obs.get(id) ?? []), ...(kb.obs.get(id) ?? [])].map((v) => doet(v, T)).filter((x) => x != null));
        if (wat.size) doen.set(id, wat.size === 1 ? [...wat][0]! : 'iets');
      }
      const buiten = (ka.buitenSom + kb.buitenSom) / buitenN;
      stappen.push({ q: a, helling: (tb - ta) * 4, dT: T - buiten, zonKw: zonN ? (ka.zonSom + kb.zonSom) / zonN / 1000 : 0, doen });
    }

    // Afkoelen: rustige stukken, de helling over het hele stuk.
    const stukken: (typeof stappen)[] = [];
    let cur: typeof stappen = [];
    for (const s of stappen) {
      const rustig = s.doen.size === 0 && s.zonKw < GEEN_ZON;
      if (rustig && (cur.length === 0 || s.q === cur.at(-1)!.q + 1)) cur.push(s);
      else {
        if (cur.length >= RUST_MIN) stukken.push(cur);
        cur = rustig ? [s] : [];
      }
    }
    if (cur.length >= RUST_MIN) stukken.push(cur);
    let teller = 0;
    let noemer = 0;
    let rustUren = 0;
    for (const s of stukken) {
      const t0 = tempIn(s[0]!.q, zone.id)!;
      const t1 = tempIn(s.at(-1)!.q + 1, zone.id)!;
      const uren = s.length / 4;
      const dT = gem(s.map((x) => x.dT));
      teller += -((t1 - t0) / uren) * dT * uren;
      noemer += dT * dT * uren;
      rustUren += uren;
    }
    const k = noemer > 0 && teller > 0 ? teller / noemer : null;

    // Zon: niets aan, wel zon.
    const zonnig = stappen.filter((s) => s.doen.size === 0 && s.zonKw > ZON_VANAF);
    const zTeller = k == null ? 0 : zonnig.reduce((t, s) => t + (s.helling + k * s.dT) * s.zonKw, 0);
    const zNoemer = zonnig.reduce((t, s) => t + s.zonKw * s.zonKw, 0);
    const zonPerKw = k != null && zNoemer > 0 ? zTeller / zNoemer : null;

    // Elk apparaat van de zone, per stand: alleen dat apparaat deed iets.
    const apparaten: ThermischApparaat[] = [];
    for (const a of zone.apparaten) {
      for (const stand of ['verwarmt', 'koelt'] as const) {
        // Wat het apparaat kan, ook als het nog niet gezien is: dan zegt de app dat.
        if (!(stand === 'verwarmt' ? a.verwarmen : a.koelen)) continue;
        const rest = k == null ? [] : stappen.filter((s) => s.doen.size === 1 && s.doen.get(a.id) === stand).map((s) => s.helling + k * s.dT - (zonPerKw ?? 0) * s.zonKw);
        const v = rest.length >= APPARAAT_MIN ? gem(rest) : null;
        const merkbaar = v != null && (stand === 'verwarmt' ? v >= MERKBAAR : v <= -MERKBAAR / 2);
        apparaten.push({ id: a.id, naam: a.naam, stand, perUur: merkbaar ? r2(v) : null, kwartieren: rest.length, zeker: merkbaar ? zeker(rest.length, [8, 40, 160, 480]) : 0 });
      }
    }

    uit.push({
      id: zone.id,
      naam: zone.naam,
      k: k == null ? null : Math.round(k * 10_000) / 10_000,
      tauUur: k == null ? null : Math.round(1 / k),
      rustUren: Math.round(rustUren),
      zonPerKw: zonPerKw == null ? null : r2(zonPerKw),
      zonKwartieren: zonnig.length,
      zeker: { afkoelen: k == null ? 0 : zeker(rustUren, [24, 72, 168, 336]), zon: zonPerKw == null ? 0 : zeker(zonnig.length, [16, 80, 320, 1000]) },
      apparaten,
    });
  }

  const gemeten = uit.filter((z) => z.k != null);
  const klaar = gemeten.length > 0 && gemeten.every((z) => z.zeker.afkoelen >= 3 && z.apparaten.some((a) => a.stand === 'verwarmt' && a.zeker >= 2));
  return {
    versie: 1,
    dag,
    sindsMs: qs[0]! * KWARTIER,
    dagen: Math.round((qs.at(-1)! - qs[0]!) / 96),
    zones: gemeten,
    stand: klaar ? 'werkt' : 'leert',
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Een zone zoals het leren hem nodig heeft: zijn apparaten, en wat die kunnen. */
export interface ThermischZoneIn {
  readonly id: string;
  readonly naam: string;
  readonly apparaten: readonly { readonly id: string; readonly naam: string; readonly verwarmen: boolean; readonly koelen: boolean }[];
}

/** De zones van het huis met hun apparaten, zoals de configuratie ze noemt. */
export function thermischZones(config: SiteConfig): ThermischZoneIn[] {
  return config.zones.map((z) => ({
    id: z.id,
    naam: z.name,
    apparaten: z.actuatorIds.flatMap((id) => {
      const a = config.actuators.find((x) => x.id === id);
      return a ? [{ id: a.id, naam: a.name, verwarmen: a.capabilities.canHeat, koelen: a.capabilities.canCool }] : [];
    }),
  }));
}

const DAG_VAN = /(\d{4}-\d{2}-\d{2})\.ndjson(\.gz)?$/;

/** Zo lang na het opstarten kijkt het voor het eerst of er gerekend moet worden: het opstarten gaat voor. */
export const EERSTE_KEER_MS = 2 * 60_000;
/** Daarna kijkt het elk uur. */
export const ELK_UUR_MS = 60 * 60_000;
/** Een rapport van gisteren wordt pas vanaf dit uur (in de tijdzone van het huis) vernieuwd: 's nachts, als het rustig is. */
export const NACHT_UUR = 3;

/**
 * Leert één keer per dag uit het logboek, en bewaart het naast het logboek
 * zodat een herstart het niet opnieuw hoeft te lezen.
 *
 * Sinds 6 november 2026 rekent het op de achtergrond (`achtergrond`): kort na
 * het opstarten als er nog niets is, en verder elke nacht. Een pagina die
 * vraagt krijgt meteen wat er bewaard is (`bewaard`), ook als dat van gisteren
 * is, en wacht nooit op het lezen van een half jaar logboek.
 */
export class ThermischLeer {
  readonly #logDir: string;
  readonly #now: () => number;
  #rapport: ThermischRapport | null = null;
  #laden: Promise<void> | null = null;
  #bezig: Promise<ThermischRapport | null> | null = null;
  #klok: ReturnType<typeof setTimeout> | null = null;

  constructor(options: { logDir: string; now?: () => number }) {
    this.#logDir = options.logDir;
    this.#now = options.now ?? Date.now;
  }

  get current(): ThermischRapport | null {
    return this.#rapport;
  }

  /** Of er nu gerekend wordt. */
  get rekent(): boolean {
    return this.#bezig != null;
  }

  /** Wat er bewaard is, uit het geheugen of van schijf; rekent niet. */
  async bewaard(): Promise<ThermischRapport | null> {
    this.#laden ??= (async () => {
      try {
        const r = JSON.parse(await readFile(join(this.#logDir, THERMISCH_FILE), 'utf-8')) as ThermischRapport;
        if (r.versie === 1 && this.#rapport == null) this.#rapport = r;
      } catch {
        // Nog niet bewaard: dan komt het van de eerste berekening.
      }
    })();
    await this.#laden;
    return this.#rapport;
  }

  /**
   * Moet er gerekend worden? Zonder rapport altijd; een rapport van een
   * eerdere dag pas vanaf `NACHT_UUR`, zodat het 's nachts gebeurt.
   */
  nodig(timeZone?: string): boolean {
    const r = this.#rapport;
    if (r == null) return true;
    const nu = this.#now();
    if (r.dag === dagIn(nu, timeZone)) return false;
    const uur = timeZone ? partsIn(nu, timeZone).h : new Date(nu).getUTCHours();
    return uur >= NACHT_UUR;
  }

  /** Het rapport van vandaag; rekent als het er nog niet is, één keer tegelijk. */
  async bijwerken(config: SiteConfig): Promise<ThermischRapport | null> {
    await this.bewaard();
    if (this.#rapport?.dag === dagIn(this.#now(), config.timezone)) return this.#rapport;
    return this.#reken(config);
  }

  /** Rekent opnieuw, ook als er al een rapport van vandaag is; één keer tegelijk. */
  #reken(config: SiteConfig): Promise<ThermischRapport | null> {
    this.#bezig ??= this.#lees(config).finally(() => {
      this.#bezig = null;
    });
    return this.#bezig;
  }

  /**
   * Op de achtergrond: na `eersteMs` en daarna elke `elkeMs` kijken of er
   * gerekend moet worden (`nodig`). De klok houdt de dienst niet open; `stop`
   * zet hem stil. Hoe lang het duurde of wat er misging komt bij `meld`; na een
   * fout probeert het het de volgende keer opnieuw.
   */
  achtergrond(config: () => SiteConfig | null, opties: { eersteMs?: number; elkeMs?: number; meld?: (tekst: string) => void } = {}): void {
    this.stop();
    const elke = opties.elkeMs ?? ELK_UUR_MS;
    const kijk = async () => {
      try {
        const c = config();
        await this.bewaard();
        if (c != null && this.nodig(c.timezone)) {
          const begin = Date.now();
          const r = await this.#reken(c);
          opties.meld?.(`warmte vasthouden uitgerekend in ${Math.round((Date.now() - begin) / 1000)} s, ${r?.dagen ?? 0} dagen`);
        }
      } catch (error) {
        opties.meld?.(`warmte vasthouden niet uitgerekend: ${String(error)}`);
      } finally {
        if (this.#klok != null) this.#plan(kijk, elke);
      }
    };
    this.#plan(kijk, opties.eersteMs ?? EERSTE_KEER_MS);
  }

  #plan(fn: () => Promise<void>, ms: number): void {
    this.#klok = setTimeout(() => void fn(), ms);
    this.#klok.unref?.();
  }

  stop(): void {
    if (this.#klok != null) clearTimeout(this.#klok);
    this.#klok = null;
  }

  async #lees(config: SiteConfig): Promise<ThermischRapport | null> {
    const bestand = join(this.#logDir, THERMISCH_FILE);
    const vanaf = new Date(this.#now() - TERUG_DAGEN * 86_400_000).toISOString().slice(0, 10);
    const bestanden = (await findLogFiles(this.#logDir)).filter((p) => (DAG_VAN.exec(basename(p))?.[1] ?? '') >= vanaf);
    // Per kwartier optellen terwijl het leest: nooit een half jaar momenten tegelijk in het geheugen.
    const kw = new ThermischKwartieren();
    for await (const m of readMoments(bestanden)) kw.voeg(m);
    const rapport = kw.leer(thermischZones(config), this.#now(), config.timezone);
    this.#rapport = rapport;
    const tijdelijk = `${bestand}.tmp`;
    await writeFile(tijdelijk, JSON.stringify(rapport), 'utf-8');
    await rename(tijdelijk, bestand);
    return rapport;
  }
}
