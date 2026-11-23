/*
 * De indeling van het huis lezen: de velden (22 november 2026, opgesplitst uit config/schema.ts).
 *
 * Problemen verzamelen met hun pad, en een veld lezen en controleren: tekst, getal, ja/nee, een keuze uit een
 * lijst, een blok, een lijst, een verwijzing naar een entiteit, een meetpunt en de doeltemperaturen.
 */
import { MODES, type DeviceRef, type MeasurementPoint, type Mode, type SetpointPair } from '../core/model.js';
import { STANDAARD_WARM } from './standaard.js';

export interface ConfigProblem {
  /** Waar het zit, in puntnotatie: `zones[1].setpoints.dag.heat`. */
  readonly path: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

/** Verzamelt problemen met hun pad, zodat er niet bij de eerste fout gestopt hoeft te worden. */
export class Problems {
  readonly #items: ConfigProblem[] = [];

  error(path: string, message: string): void {
    this.#items.push({ path, message, severity: 'error' });
  }

  warn(path: string, message: string): void {
    this.#items.push({ path, message, severity: 'warning' });
  }

  get errors(): ConfigProblem[] {
    return this.#items.filter((p) => p.severity === 'error');
  }

  get warnings(): ConfigProblem[] {
    return this.#items.filter((p) => p.severity === 'warning');
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function join(path: string, key: string | number): string {
  return typeof key === 'number' ? `${path}[${key}]` : path ? `${path}.${key}` : key;
}

/** Leest een verplicht tekstveld. */
export function str(
  p: Problems,
  obj: Record<string, unknown>,
  path: string,
  key: string,
): string | null {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    p.error(join(path, key), v === undefined ? 'ontbreekt' : 'moet een niet-lege tekst zijn');
    return null;
  }
  return v;
}

interface NumOptions {
  min?: number;
  max?: number;
  integer?: boolean;
  optional?: boolean;
}

export function num(
  p: Problems,
  obj: Record<string, unknown>,
  path: string,
  key: string,
  opts: NumOptions = {},
): number | null {
  const v = obj[key];
  if (v === undefined) {
    if (!opts.optional) p.error(join(path, key), 'ontbreekt');
    return null;
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    p.error(join(path, key), 'moet een getal zijn');
    return null;
  }
  if (opts.integer && !Number.isInteger(v)) {
    p.error(join(path, key), 'moet een geheel getal zijn');
    return null;
  }
  if (opts.min !== undefined && v < opts.min) {
    p.error(join(path, key), `moet minstens ${opts.min} zijn, is ${v}`);
    return null;
  }
  if (opts.max !== undefined && v > opts.max) {
    p.error(join(path, key), `mag hoogstens ${opts.max} zijn, is ${v}`);
    return null;
  }
  return v;
}

export function bool(
  p: Problems,
  obj: Record<string, unknown>,
  path: string,
  key: string,
): boolean | null {
  const v = obj[key];
  if (typeof v !== 'boolean') {
    p.error(join(path, key), v === undefined ? 'ontbreekt' : 'moet true of false zijn');
    return null;
  }
  return v;
}

export function oneOf<T extends string>(
  p: Problems,
  obj: Record<string, unknown>,
  path: string,
  key: string,
  allowed: readonly T[],
): T | null {
  const v = obj[key];
  if (typeof v !== 'string' || !allowed.includes(v as T)) {
    p.error(
      join(path, key),
      v === undefined
        ? `ontbreekt — kies uit ${allowed.join(', ')}`
        : `"${String(v)}" kan niet; kies uit ${allowed.join(', ')}`,
    );
    return null;
  }
  return v as T;
}

/*
 * Hieronder de tegenhangers van `str`, `num`, `bool` en `oneOf` die niet
 * klagen maar terugvallen.
 *
 * Ze bestaan sinds fase 6e stap 2. Daarvoor was bijna elk veld verplicht, wat
 * verdedigbaar leek — hoe explicieter de configuratie, hoe minder verrassingen.
 * Maar het maakte de drempel onneembaar: een nieuwe gebruiker moest 158
 * waarden aanleveren voordat er iets startte, en de meeste daarvan zijn keuzes
 * waar hij nog geen mening over heeft.
 *
 * De regel die we aanhouden: een standaardwaarde mag, zolang fout zijn
 * ongevaarlijk of behoudend is. Een verkeerd geraden schakelband kost comfort;
 * een verkeerd geraden `canHeat` laat de regeling verwarmen met een apparaat
 * dat dat niet kan. Die tweede soort blijft verplicht.
 *
 * Een fout blijft een fout: staat het veld er wél maar deugt het niet, dan is
 * dat geen reden om stilletjes iets anders te doen.
 */

/** Een tekstveld dat mag ontbreken en dan terugvalt. */
export function strOr(
  p: Problems,
  obj: Record<string, unknown>,
  path: string,
  key: string,
  fallback: string,
): string {
  if (obj[key] === undefined) return fallback;
  return str(p, obj, path, key) ?? fallback;
}

export function numOr(
  p: Problems,
  obj: Record<string, unknown>,
  path: string,
  key: string,
  fallback: number,
  opts: NumOptions = {},
): number {
  if (obj[key] === undefined) return fallback;
  return num(p, obj, path, key, opts) ?? fallback;
}

export function boolOr(
  p: Problems,
  obj: Record<string, unknown>,
  path: string,
  key: string,
  fallback: boolean,
): boolean {
  if (obj[key] === undefined) return fallback;
  return bool(p, obj, path, key) ?? fallback;
}

export function oneOfOr<T extends string>(
  p: Problems,
  obj: Record<string, unknown>,
  path: string,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  if (obj[key] === undefined) return fallback;
  return oneOf(p, obj, path, key, allowed) ?? fallback;
}

/** Een blok dat mag ontbreken. Geeft een leeg object terug in plaats van null. */
export function blockOf(
  p: Problems,
  value: unknown,
  path: string,
): Record<string, unknown> | null {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    p.error(path, 'moet een object zijn');
    return null;
  }
  return value;
}

export function arr(
  p: Problems,
  obj: Record<string, unknown>,
  path: string,
  key: string,
  { minLength = 0 } = {},
): unknown[] | null {
  const v = obj[key];
  if (!Array.isArray(v)) {
    p.error(join(path, key), v === undefined ? 'ontbreekt' : 'moet een lijst zijn');
    return null;
  }
  if (v.length < minLength) {
    p.error(join(path, key), `moet minstens ${minLength} item(s) bevatten`);
    return null;
  }
  return v;
}

/**
 * Een verwijzing naar een apparaat mag kort ("climate.beneden", gebruikt dan
 * `defaultAdapter`) of volledig ({adapter, id}). De korte vorm scheelt bij
 * handmatig schrijven en bij het genereren vanuit een wizard.
 */
export function ref(
  p: Problems,
  value: unknown,
  path: string,
  defaultAdapter: string,
): DeviceRef | null {
  if (typeof value === 'string') {
    if (value.trim() === '') {
      p.error(path, 'mag niet leeg zijn');
      return null;
    }
    return { adapter: defaultAdapter, id: value };
  }
  if (isRecord(value)) {
    const adapter = str(p, value, path, 'adapter');
    const id = str(p, value, path, 'id');
    return adapter && id ? { adapter, id } : null;
  }
  p.error(path, 'moet een tekst zijn of een object met adapter en id');
  return null;
}

/**
 * Een meetpunt: net als `ref`, maar de waarde mag ook in een attribuut staan.
 *
 *   "sensor.woonkamer_temperatuur"
 *   { "id": "climate.thermostaat_badkamer", "attribute": "current_temperature" }
 *
 * De korte vorm blijft precies wat hij was. In de lange vorm is `adapter`
 * optioneel geworden — wie een attribuut opgeeft wil zelden ook nog een andere
 * adapter noemen, en de standaard klopt bijna altijd.
 */
export function measurementPoint(
  p: Problems,
  value: unknown,
  path: string,
  defaultAdapter: string,
): MeasurementPoint | null {
  if (!isRecord(value) || value['attribute'] === undefined) {
    return ref(p, value, path, defaultAdapter);
  }
  const id = str(p, value, path, 'id');
  const attribute = str(p, value, path, 'attribute');
  const adapter = value['adapter'] === undefined ? defaultAdapter : str(p, value, path, 'adapter');
  if (!id || !attribute || !adapter) return null;
  return { adapter, id, attribute };
}

export function refList(
  p: Problems,
  values: readonly unknown[],
  path: string,
  defaultAdapter: string,
): DeviceRef[] {
  const out: DeviceRef[] = [];
  values.forEach((v, i) => {
    const r = ref(p, v, join(path, i), defaultAdapter);
    if (r) out.push(r);
  });
  return out;
}

/*
 * Waar een zone naartoe regelt wanneer het bestand niets zegt.
 *
 * Alleen verwarmen. Een koeldrempel raden is de gevaarlijke richting: dan zou
 * een airco kunnen gaan draaien omdat wij een getal hebben verzonnen. Wie wil
 * koelen zegt dat zelf.
 *
 * `handmatig` blijft met opzet leeg — daar heeft de bewoner het stuur.
 *
 * De getallen zijn de standaard voor een nieuw huis (besluit 204).
 */
const DEFAULT_SETPOINTS: Readonly<Record<Mode, SetpointPair>> = {
  dag: { heat: STANDAARD_WARM.dag },
  nacht: { heat: STANDAARD_WARM.nacht },
  voorverwarmen: { heat: STANDAARD_WARM.voorverwarmen },
  afwezig: { heat: STANDAARD_WARM.afwezig },
  vakantie: { heat: STANDAARD_WARM.vakantie },
  handmatig: {},
};

export interface SetpointOutcome {
  readonly points: Record<Mode, SetpointPair>;
  /** Welke modi uit de standaardwaarden komen in plaats van uit het bestand. */
  readonly filled: ReadonlySet<Mode>;
}

export function setpoints(
  p: Problems,
  value: unknown,
  path: string,
): SetpointOutcome | null {
  if (value === undefined) {
    p.warn(
      path,
      'ontbreekt; er wordt alleen verwarmd, volgens ' +
        `dag ${DEFAULT_SETPOINTS.dag.heat} / nacht ${DEFAULT_SETPOINTS.nacht.heat} / ` +
        `afwezig ${DEFAULT_SETPOINTS.afwezig.heat} / vakantie ${DEFAULT_SETPOINTS.vakantie.heat} °C`,
    );
    return { points: { ...DEFAULT_SETPOINTS }, filled: new Set(MODES) };
  }
  if (!isRecord(value)) {
    p.error(path, 'moet een object zijn');
    return null;
  }
  const filled = new Set<Mode>();
  for (const key of Object.keys(value)) {
    if (!(MODES as readonly string[]).includes(key)) {
      p.error(join(path, key), `"${key}" is geen bekende modus; kies uit ${MODES.join(', ')}`);
    }
  }
  const out = {} as Record<Mode, SetpointPair>;
  for (const mode of MODES) {
    const raw = value[mode];
    if (raw === undefined) {
      // Een deels ingevulde tabel aanvullen in plaats van afkeuren. Wie drie
      // modi heeft bedacht is niet van plan de andere drie te verbieden.
      out[mode] = { ...DEFAULT_SETPOINTS[mode] };
      filled.add(mode);
      continue;
    }
    if (!isRecord(raw)) {
      p.error(join(path, mode), 'moet een object zijn met heat en/of cool');
      continue;
    }
    const pair: { heat?: number; cool?: number } = {};
    const heat = num(p, raw, join(path, mode), 'heat', { min: 5, max: 35, optional: true });
    const cool = num(p, raw, join(path, mode), 'cool', { min: 5, max: 35, optional: true });
    if (heat != null) pair.heat = heat;
    if (cool != null) pair.cool = cool;
    if (pair.heat != null && pair.cool != null && pair.heat >= pair.cool) {
      p.error(
        join(path, mode),
        `verwarmen tot ${pair.heat} en koelen vanaf ${pair.cool} laat geen ruimte; ` +
          'de koeldrempel hoort boven de verwarmdrempel te liggen',
      );
    }
    out[mode] = pair;
  }
  return { points: out, filled };
}
