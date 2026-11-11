/**
 * Helpen bij de cv (besluit 292): de airco's helpen de ketel, elk voor zijn
 * eigen kamer. Wat de app erover weet, gaat als `cvHelp` in de configuratie:
 * de thermostaat die de ketel aanzet, wanneer een airco begint, welke airco's
 * meedoen, en de prijzen van gas en stroom om te vergelijken.
 *
 * Zuiver: de configuratie en de keuzes erin, de configuratie eruit. Het
 * resultaat gaat daarna door het eigen schema.
 */

import type { Decision } from '../core/decision.js';
import type { CvHelp, SiteConfig } from '../core/model.js';
import { CV_HELP_DEFAULTS, HEAT_ASSIST_DEFAULTS, warmtePrijs } from '../core/strategies/heatAssist.js';
import type { Bijspringen } from './comfort.js';
import { partsIn, startOfLocalDay } from './today.js';

/** Wat de bewoner bij Regeling › Helpen bij de cv koos, van het huis. */
export interface Helpen {
  /** Per airco aan of uit; weg is aan. */
  readonly aan?: Readonly<Record<string, boolean>>;
  /** Na zoveel minuten onafgebroken stoken van de ketel. */
  readonly naMin: number;
  /** Vanaf zoveel graden onder het doel van de eigen kamer. */
  readonly vanafC: number;
}

export interface HelpenKeuze {
  /** De thermostaat van de ketel uit Energie › Verwarming; null is het voorstel, "geen" is er geen. */
  readonly thermostaat: string | null;
  /** Euro per m³ gas en per kWh stroom, uit Energie › Prijzen; null is onbekend. */
  readonly gas: number | null;
  readonly stroom: number | null;
}

type Rij = Record<string, unknown>;

const refVan = (a: Rij): string | null => (typeof a['ref'] === 'string' ? a['ref'] : typeof (a['ref'] as Rij | undefined)?.['id'] === 'string' ? ((a['ref'] as Rij)['id'] as string) : null);
const kan = (a: Rij, wat: 'canHeat' | 'canCool'): boolean => (a['capabilities'] as Rij | undefined)?.[wat] === true;

/** De airco's die kunnen helpen: de rol assist, en verwarmen. */
export function helpers(raw: Rij): Rij[] {
  const actuators = Array.isArray(raw['actuators']) ? (raw['actuators'] as Rij[]) : [];
  return actuators.filter((a) => a['role'] === 'assist' && kan(a, 'canHeat'));
}

/**
 * De thermostaten die de ketel aanzetten. Gekozen bij Energie › Verwarming,
 * en anders zoals het was: de hoofdverwarming in een kamer waar een airco
 * helpt (besluit 283).
 */
export function ketels(raw: Rij, thermostaat: string | null): string[] {
  if (thermostaat === 'geen') return [];
  const actuators = Array.isArray(raw['actuators']) ? (raw['actuators'] as Rij[]) : [];
  if (thermostaat) {
    const gekozen = actuators.filter((a) => a['id'] === thermostaat || refVan(a) === thermostaat).map((a) => String(a['id']));
    if (gekozen.length) return gekozen;
  }
  const zones = Array.isArray(raw['zones']) ? (raw['zones'] as Rij[]) : [];
  const hulp = new Set(helpers(raw).map((a) => String(a['id'])));
  const ids = zones
    .filter((z) => Array.isArray(z['actuatorIds']) && (z['actuatorIds'] as string[]).some((id) => hulp.has(id)))
    .flatMap((z) => z['actuatorIds'] as string[])
    .filter((id) => {
      const a = actuators.find((x) => x['id'] === id);
      return a != null && a['role'] === 'primary' && kan(a, 'canHeat') && !kan(a, 'canCool');
    });
  return [...new Set(ids)];
}

/**
 * Wat er geldt: wat de bewoner koos, en anders wat hij bij bijspringen per
 * kamer koos (besluit 283), en anders de standaard.
 */
export function helpenNu(helpen: Helpen | null | undefined, bijspringen: Readonly<Record<string, Bijspringen>> | undefined, raw: Rij): Helpen {
  if (helpen) return helpen;
  const lijst = Object.entries(bijspringen ?? {});
  const eerste = lijst.find(([, b]) => b.aan)?.[1] ?? lijst[0]?.[1];
  const zones = Array.isArray(raw['zones']) ? (raw['zones'] as Rij[]) : [];
  const aan: Record<string, boolean> = {};
  for (const [zone, b] of lijst) {
    if (b.aan) continue;
    const z = zones.find((x) => x['id'] === zone);
    const ids = z && Array.isArray(z['actuatorIds']) ? (z['actuatorIds'] as string[]) : [];
    for (const id of ids) aan[id] = false;
  }
  return {
    ...(Object.keys(aan).length ? { aan } : {}),
    naMin: eerste?.naMin ?? HEAT_ASSIST_DEFAULTS.startDelayMinutes,
    vanafC: eerste?.vanafC ?? HEAT_ASSIST_DEFAULTS.minShortfallC,
  };
}

/** Legt `cvHelp` over de configuratie, als er een ketel is en een airco die kan helpen. */
export function withCvHelp(raw: Rij, helpen: Helpen, keuze: HelpenKeuze): { raw: Rij; toegevoegd: string[] } {
  if (raw['cvHelp'] !== undefined) return { raw, toegevoegd: [] };
  const hulp = helpers(raw);
  const boilerIds = ketels(raw, keuze.thermostaat);
  if (!hulp.length || !boilerIds.length) return { raw, toegevoegd: [] };
  const off = hulp.map((a) => String(a['id'])).filter((id) => helpen.aan?.[id] === false);
  const geldig = (v: number | null, max: number) => (v != null && Number.isFinite(v) && v > 0 && v <= max ? v : null);
  const gas = geldig(keuze.gas, 10);
  const stroom = geldig(keuze.stroom, 5);
  return {
    raw: {
      ...raw,
      cvHelp: {
        boilerIds,
        startDelayMinutes: helpen.naMin,
        minShortfallC: helpen.vanafC,
        ...(off.length ? { off } : {}),
        ...(gas != null ? { gasEurPerM3: gas } : {}),
        ...(stroom != null ? { electricityEurPerKwh: stroom } : {}),
      },
    },
    toegevoegd: [`helpen bij de cv: ${hulp.length - off.length} van ${hulp.length} airco's`],
  };
}

/* ------------------------------------------------------------ de weergave */

/** De keuzes in de app: minuten in hele minuten, graden in tienden. */
export const HELPEN_BEREIK = { naMin: { min: 1, max: 30 }, vanafC: { min: 0.1, max: 2 } } as const;

export interface HelpenAirco {
  readonly id: string;
  readonly naam: string;
  /** De kamer waar hij naar kijkt: zijn eigen. */
  readonly kamer: string | null;
  readonly kamerC: number | null;
  readonly doelC: number | null;
  /** Of hij mag helpen. */
  readonly aan: boolean;
  /** Wat hij nu doet: helpt, klaar (zijn kamer is op temperatuur na een beurt), wacht, of uit. */
  readonly stand: 'helpt' | 'klaar' | 'wacht' | 'uit';
  /** Sinds wanneer hij helpt, of wanneer hij klaar was. */
  readonly sindsMs: number | null;
  readonly vandaag: { readonly keer: number; readonly minuten: number };
}

export interface HelpenKosten {
  /** Euro per kWh warmte. */
  readonly airco: number;
  readonly ketel: number;
  /** kWh warmte per kWh stroom bij deze buitentemperatuur. */
  readonly cop: number;
  readonly buitenC: number;
  /** Bij welke buitentemperatuur ze even duur zijn. */
  readonly gelijkBijC: number | null;
  readonly gas: number;
  readonly stroom: number;
}

export interface HelpenView {
  readonly aircos: readonly HelpenAirco[];
  /** De thermostaten die de ketel aanzetten, op naam. */
  readonly ketel: readonly string[];
  readonly naMin: number;
  readonly vanafC: number;
  readonly minRunMinutes: number;
  readonly minRestMinutes: number;
  readonly bereik: typeof HELPEN_BEREIK;
  /** Null zonder prijzen of buitentemperatuur. */
  readonly kosten: HelpenKosten | null;
}

/** Bij welke buitentemperatuur de airco even duur is als de ketel; null als dat niet tussen −30° en 20° ligt. */
export function gelijkBij(help: CvHelp): number | null {
  for (let t = 20; t >= -30; t -= 0.5) {
    const p = warmtePrijs(help, t);
    if (p && p.airco >= p.ketel) return t;
  }
  return null;
}

/**
 * Wat de airco's vandaag hielpen (besluit 292), bij elk besluit bijgewerkt.
 * In het geheugen: na een herstart begint de dag opnieuw te tellen.
 */
export class HelpenDag {
  #dag = '';
  readonly #stukken = new Map<string, [number, number | null][]>();
  readonly #tz: () => string;

  constructor(tz: () => string) {
    this.#tz = tz;
  }

  /** Welke airco's nu helpen, volgens het laatste besluit. */
  observe(nowMs: number, helpend: ReadonlySet<string>): void {
    const p = partsIn(nowMs, this.#tz());
    const dag = `${p.y}-${p.m}-${p.d}`;
    if (dag !== this.#dag) {
      // Wat over middernacht doorloopt, telt vanaf middernacht.
      const open = this.#dag === '' ? [] : [...this.#stukken].filter(([, s]) => s.at(-1)?.[1] === null).map(([id]) => id);
      this.#dag = dag;
      this.#stukken.clear();
      const middernacht = startOfLocalDay(nowMs, this.#tz());
      for (const id of open) this.#stukken.set(id, [[middernacht, null]]);
    }
    for (const id of helpend) {
      const s = this.#stukken.get(id) ?? [];
      const laatste = s.at(-1);
      if (!laatste || laatste[1] !== null) s.push([nowMs, null]);
      this.#stukken.set(id, s);
    }
    for (const [id, s] of this.#stukken) {
      const laatste = s.at(-1);
      if (laatste && laatste[1] === null && !helpend.has(id)) laatste[1] = nowMs;
    }
  }

  vandaag(id: string, nowMs: number): { keer: number; minuten: number; sindsMs: number | null; klaarMs: number | null } {
    const s = this.#stukken.get(id) ?? [];
    const minuten = Math.round(s.reduce((n, [a, b]) => n + ((b ?? nowMs) - a), 0) / 60_000);
    const laatste = s.at(-1);
    return { keer: s.length, minuten, sindsMs: laatste && laatste[1] === null ? laatste[0] : null, klaarMs: laatste?.[1] ?? null };
  }
}

/** Helpen bij de cv zoals de pagina het toont: per airco zijn kamer, wat hij doet en wat hij vandaag deed. */
export function helpenView(config: SiteConfig, latest: Pick<Decision, 'accepted' | 'explanation'> | null, dag: HelpenDag | null, nowMs: number): HelpenView {
  const help = config.cvHelp;
  const helpend = new Set((latest?.accepted ?? []).filter((i) => i.strategyId === 'heat-assist').map((i) => i.actuatorId));
  const uit = new Set(help?.off ?? []);
  const aircos = config.actuators
    .filter((a) => a.role === 'assist' && a.capabilities.canHeat)
    .map((a): HelpenAirco => {
      const zone = config.zones.find((z) => z.actuatorIds.includes(a.id));
      const z = latest?.explanation.perZone.find((x) => x.zoneId === zone?.id);
      const v = dag?.vandaag(a.id, nowMs) ?? { keer: 0, minuten: 0, sindsMs: null, klaarMs: null };
      const aan = help != null && !uit.has(a.id);
      const stand = !aan ? 'uit' : helpend.has(a.id) ? 'helpt' : v.klaarMs != null ? 'klaar' : 'wacht';
      return {
        id: a.id,
        naam: a.name,
        kamer: zone?.name ?? null,
        kamerC: z?.temperatureC ?? null,
        doelC: z?.heatTargetC ?? null,
        aan,
        stand,
        sindsMs: stand === 'helpt' ? v.sindsMs : stand === 'klaar' ? v.klaarMs : null,
        vandaag: { keer: v.keer, minuten: v.minuten },
      };
    });
  const buiten = latest?.explanation.outdoorTemperatureC ?? null;
  const prijs = help ? warmtePrijs(help, buiten) : null;
  const kosten: HelpenKosten | null =
    help && prijs && buiten != null && help.gasEurPerM3 != null && help.electricityEurPerKwh != null
      ? { ...prijs, buitenC: buiten, gelijkBijC: gelijkBij(help), gas: help.gasEurPerM3, stroom: help.electricityEurPerKwh }
      : null;
  return {
    aircos,
    ketel: (help?.boilerIds ?? []).map((id) => config.actuators.find((a) => a.id === id)?.name ?? id),
    naMin: help?.startDelayMinutes ?? HEAT_ASSIST_DEFAULTS.startDelayMinutes,
    vanafC: help?.minShortfallC ?? HEAT_ASSIST_DEFAULTS.minShortfallC,
    minRunMinutes: help?.minRunMinutes ?? CV_HELP_DEFAULTS.minRunMinutes,
    minRestMinutes: help?.minRestMinutes ?? CV_HELP_DEFAULTS.minRestMinutes,
    bereik: HELPEN_BEREIK,
    kosten,
  };
}

/** Wat de pagina stuurt: `{ naMin, vanafC, aan: { [airco]: ja of nee } }`. */
export function controleerHelpen(body: unknown, config: SiteConfig): { ok: true; waarde: Helpen } | { ok: false; reden: string } {
  if (typeof body !== 'object' || body == null || Array.isArray(body)) return { ok: false, reden: 'verwacht een object' };
  const b = body as Record<string, unknown>;
  const { naMin: m, vanafC: c } = HELPEN_BEREIK;
  const naMin = b['naMin'];
  const vanafC = b['vanafC'];
  if (typeof naMin !== 'number' || !Number.isInteger(naMin) || naMin < m.min || naMin > m.max) return { ok: false, reden: `na ${m.min} tot ${m.max} minuten, in hele minuten` };
  if (typeof vanafC !== 'number' || Math.abs(Math.round(vanafC * 10) - vanafC * 10) > 1e-9 || vanafC < c.min || vanafC > c.max) return { ok: false, reden: `vanaf ${c.min} tot ${c.max} graden, in tienden` };
  const kan = new Set(config.actuators.filter((a) => a.role === 'assist' && a.capabilities.canHeat).map((a) => a.id));
  const aanRaw = b['aan'] ?? {};
  if (typeof aanRaw !== 'object' || aanRaw == null || Array.isArray(aanRaw)) return { ok: false, reden: 'aan is per airco ja of nee' };
  const aan: Record<string, boolean> = {};
  for (const [id, v] of Object.entries(aanRaw)) {
    if (!kan.has(id)) return { ok: false, reden: `geen airco die kan helpen: ${id}` };
    if (typeof v !== 'boolean') return { ok: false, reden: `aan is ja of nee (${id})` };
    aan[id] = v;
  }
  return { ok: true, waarde: { ...(Object.keys(aan).length ? { aan } : {}), naMin, vanafC: Math.round(vanafC * 10) / 10 } };
}
