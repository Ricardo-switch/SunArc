/**
 * Schakelaars (besluit 293, gebouwd in 297): een relais in de muur of achter
 * een apparaat, zoals een Shelly 1 mini, een klik-aan-klik-uit-ontvanger via
 * RFXCOM of de knoppen van een IR-afstandsbediening. In Home Assistant is dat
 * een `switch.` zonder meter en zonder naam die op een stekker lijkt, dus de
 * stekkers (besluit 264) vonden ze niet (issues 157 en 161).
 *
 * De bewoner kiest bij Apparaat toevoegen wat hij aanzet. Een lamp komt bij
 * het licht van zijn kamer, de rest bij Apparaten › Schakelaars. Met de hand
 * aan en uit mag alleen als de bewoner dat koos, door dezelfde smalle deur als
 * een stekker (`switch.turn_on` en `turn_off` op die ene schakelaar).
 *
 * Wat geen apparaat is, blijft weg: instellingen (een kinderslot, een lampje,
 * de jetstand van een airco), software (Adaptive Lighting, AdGuard, de NAS, de
 * router) en wat het huis al anders kent (een stekker, een boiler, een
 * laadpaal). Daarom alleen koppelingen die echte schakelaars leveren.
 */
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HaEntityState } from '../adapters/homeassistant/client.js';
import type { HaDevice, HaRegistryEntity } from '../adapters/homeassistant/discovery.js';
import { PLUG_MAX_W, type FoundHeatStore } from './buffers-vinden.js';
import type { LosseLaadpaal } from './opslag.js';

/** Wat er aan een schakelaar hangt. Een lamp komt bij Licht, de rest bij Schakelaars. */
export const SCHAKELAAR_WAT = ['lamp', 'kachel', 'ventilator', 'pomp', 'boiler', 'fietslader', 'anders'] as const;
export type SchakelaarWat = (typeof SCHAKELAAR_WAT)[number];

/** Wat de bewoner bij Apparaat toevoegen koos, per apparaat in Home Assistant. */
export interface SchakelaarKeuze {
  readonly wat: SchakelaarWat;
  /** De naam in de app; leeg is de naam uit Home Assistant. */
  readonly naam: string;
  /** De kamer uit de indeling, of null: dan het gebied uit Home Assistant, of zonder kamer. */
  readonly kamer: string | null;
  /** Alleen kijken, of ook met de hand aan en uit. */
  readonly mag: 'kijken' | 'hand';
  /** Bij meer knoppen (een IR-afstandsbediening): de naam per knop. */
  readonly knoppen?: Readonly<Record<string, string>>;
  /** Wat hij vraagt als hij aan staat, in W, door de bewoner ingevuld (besluit 298); alleen zonder eigen meter. */
  readonly vermogenW?: number;
  /**
   * De slimme stekker die erbij hoort (besluit 300), op zijn id: de kachel in
   * het tuinhuis gaat aan en uit met IR, en de stekker geeft de stroom en meet.
   */
  readonly stekker?: string;
}

export interface SchakelaarKeuzes {
  readonly apparaten: Readonly<Record<string, SchakelaarKeuze>>;
  /** "Dit is geen apparaat": dan staat hij niet meer bij Nieuw gevonden. */
  readonly geen: readonly string[];
  /** Laadpalen uit losse sensoren (besluit 301), zoals een NexBlue via Modbus. */
  readonly laadpalen?: Readonly<Record<string, LosseLaadpaal>>;
}

export const GEEN_KEUZES: SchakelaarKeuzes = { apparaten: {}, geen: [] };

/** Een sensor om bij een laadpaal uit losse sensoren te kiezen (besluit 301). */
export interface LosseSensor {
  readonly id: string;
  readonly naam: string;
  /** Waar hij op lijkt: een vermogen, een stroom, een totaal in kWh, of een stand. */
  readonly soort: 'vermogen' | 'stroom' | 'energie' | 'stand';
  readonly staat: string;
  readonly eenheid: string;
}

/**
 * De sensoren zonder apparaat in Home Assistant, zoals die van Modbus (besluit
 * 301): een vermogen, een stroom, een totaal in kWh, of een stand in woorden.
 */
export function losseSensoren(entities: readonly HaRegistryEntity[], states: ReadonlyMap<string, HaEntityState>): LosseSensor[] {
  const uit: LosseSensor[] = [];
  const ids = new Set(entities.filter((e) => !e.device_id && !e.disabled_by && e.entity_id.startsWith('sensor.')).map((e) => e.entity_id));
  // Wat in de registers niet staat (Modbus in YAML zonder unique_id) telt ook.
  for (const id of states.keys()) if (id.startsWith('sensor.') && !entities.some((e) => e.entity_id === id)) ids.add(id);
  for (const id of ids) {
    const s = states.get(id);
    if (!s) continue;
    const eenheid = String(s.attributes['unit_of_measurement'] ?? '');
    const klasse = String(s.attributes['device_class'] ?? '');
    const soort = klasse === 'power' || /^k?W$/.test(eenheid) ? 'vermogen' : klasse === 'current' || eenheid === 'A' ? 'stroom' : klasse === 'energy' || /^[kM]?Wh$/.test(eenheid) ? 'energie' : !eenheid && Number.isNaN(Number(s.state)) && !/^(unknown|unavailable)$/.test(s.state) ? 'stand' : null;
    if (!soort) continue;
    uit.push({ id, naam: String(s.attributes['friendly_name'] ?? id).slice(0, 80), soort, staat: s.state, eenheid });
  }
  return uit.sort((a, b) => a.id.localeCompare(b.id)).slice(0, 400);
}

/** Een laadpaal uit losse sensoren, nagelopen: een naam en hooguit acht sensoren. */
export function leesLosseLaadpaal(body: unknown): { readonly ok: true; readonly id: string; readonly laadpaal: LosseLaadpaal | 'weg' } | { readonly ok: false; readonly reden: string } {
  if (typeof body !== 'object' || body == null || Array.isArray(body)) return { ok: false, reden: 'verwacht een object' };
  const b = body as Record<string, unknown>;
  const id = b['id'];
  if (typeof id !== 'string' || !/^losse-[a-z0-9-]{1,40}$/.test(id)) return { ok: false, reden: 'id begint met losse-' };
  if (b['weg'] === true) return { ok: true, id, laadpaal: 'weg' };
  const naam = typeof b['naam'] === 'string' ? b['naam'].trim().slice(0, 60) : '';
  if (!naam) return { ok: false, reden: 'geef de laadpaal een naam' };
  const sensoren = b['sensoren'];
  if (!Array.isArray(sensoren) || sensoren.length < 1 || sensoren.length > 8 || !sensoren.every((x) => typeof x === 'string' && /^sensor\.[a-z0-9_]+$/.test(x))) return { ok: false, reden: 'kies een tot acht sensoren' };
  return { ok: true, id, laadpaal: { naam, sensoren: [...new Set(sensoren as string[])] } };
}

/** Een laadpaal uit losse sensoren erbij, of weg. */
export function metLaadpaal(keuzes: SchakelaarKeuzes, id: string, l: LosseLaadpaal | 'weg'): SchakelaarKeuzes {
  const { [id]: _weg, ...rest } = keuzes.laadpalen ?? {};
  return { ...keuzes, laadpalen: l === 'weg' ? rest : { ...rest, [id]: l } };
}

/** Een knop van een schakelaar: zijn `switch.`, met of hij een code kent (IR) en of hij aan staat. */
export interface SchakelaarKnop {
  readonly id: string;
  readonly naam: string;
  /** Bij een IR-afstandsbediening: of er een code geleerd is; null als het apparaat dat niet zegt. */
  readonly code: boolean | null;
  readonly aan: boolean | null;
}

export interface GevondenSchakelaar {
  /** Het apparaat in Home Assistant. */
  readonly id: string;
  readonly naam: string;
  /** De koppeling, zoals "shelly", "rfxtrx" of "mqtt". */
  readonly koppeling: string;
  readonly merk: string | null;
  readonly model: string | null;
  /** Het gebied in Home Assistant, of null. */
  readonly gebied: string | null;
  /** De knoppen met een code (of alle, als het apparaat geen codes kent). */
  readonly knoppen: readonly SchakelaarKnop[];
  /** Hoeveel knoppen er zijn zonder geleerde code; die blijven weg. */
  readonly zonderCode: number;
  /** De sensor met zijn vermogen, of null zonder meter. */
  readonly meet: string | null;
  /** Een temperatuur op hetzelfde apparaat, zoals bij een IR-afstandsbediening met sensor (besluit 300). */
  readonly temperatuur: string | null;
  /** Zegt hij niet terug of hij aan staat (klik-aan-klik-uit, IR)? Dan is de stand wat SunArc het laatst stuurde. */
  readonly aanname: boolean;
  /** Een IR-afstandsbediening. */
  readonly ir: boolean;
}

/** Koppelingen die echte schakelaars leveren. Software en instellingen staan hier niet in. */
const HARDWARE = new Set(['shelly', 'rfxtrx', 'mqtt', 'zha', 'tuya', 'localtuya', 'tasmota', 'esphome', 'sonoff', 'tplink', 'deconz', 'zwave_js', 'matter', 'homekit_controller', 'xiaomi_miio', 'broadlink', 'switchbot', 'meross_lan', 'nexa', 'kaku', 'hue', 'tradfri', 'fibaro', 'zigbee2mqtt']);
/** Een `switch.` die een instelling is, ook zonder vaste rol in Home Assistant. */
const INSTELLING = /child.?lock|kinderslot|permit.?join|indicator|_led\b|led_|backlight|display|jet.?mode|pre.?release|power.?on.?behavio|do.?not.?disturb|auto.?off|overload|calibrat|_lock$|silent/i;
/** Een apparaat met een van deze is iets anders dan een schakelaar. */
const ANDER_DOMEIN = /^(climate|light|fan|water_heater|media_player|cover|vacuum|lock|humidifier|lawn_mower|valve|camera|alarm_control_panel)\./;
/** Een brug of coördinator is geen apparaat in huis. */
const BRUG = /bridge|coordinator|gateway|hub\b/i;

const klasseVan = (x: HaRegistryEntity, states: ReadonlyMap<string, HaEntityState>) => x.device_class ?? x.original_device_class ?? (states.get(x.entity_id)?.attributes['device_class'] as string | undefined) ?? null;
const eenheid = (id: string, states: ReadonlyMap<string, HaEntityState>) => String(states.get(id)?.attributes['unit_of_measurement'] ?? '');

/**
 * De schakelaars in Home Assistant die het huis nog niet anders kent. `bekend`
 * zijn de schakelaars van stekkers, boilers, laadpalen en de regeling.
 */
export function vindSchakelaars(
  states: ReadonlyMap<string, HaEntityState>,
  entities: readonly HaRegistryEntity[],
  devices: readonly HaDevice[],
  bekend: ReadonlySet<string> = new Set(),
): GevondenSchakelaar[] {
  const live = entities.filter((e) => !e.disabled_by && states.has(e.entity_id));
  const perApparaat = new Map<string, HaRegistryEntity[]>();
  for (const e of live) if (e.device_id) perApparaat.set(e.device_id, [...(perApparaat.get(e.device_id) ?? []), e]);
  const uit: GevondenSchakelaar[] = [];
  for (const [deviceId, mine] of perApparaat) {
    if (mine.some((x) => ANDER_DOMEIN.test(x.entity_id))) continue;
    const schakelaars = mine.filter((x) => x.entity_id.startsWith('switch.') && !x.entity_category && !x.hidden_by && !INSTELLING.test(x.entity_id));
    if (!schakelaars.length || !HARDWARE.has(schakelaars[0]!.platform ?? '')) continue;
    if (schakelaars.some((x) => bekend.has(x.entity_id))) continue;
    const device = devices.find((d) => d.id === deviceId);
    const naam = (device?.name_by_user?.trim() || device?.name?.trim() || String(states.get(schakelaars[0]!.entity_id)?.attributes['friendly_name'] ?? '').trim() || schakelaars[0]!.entity_id).slice(0, 60);
    if (BRUG.test(`${naam} ${device?.model ?? ''}`)) continue;
    const ir = mine.some((x) => x.entity_id.startsWith('infrared.') || /learn_ir|ir_code/.test(x.entity_id)) || /\bir\b|infra/i.test(`${device?.model ?? ''}`);
    // Een IR-afstandsbediening zegt per knop of er een code geleerd is (Zigbee2MQTT: select.…_switch1_on).
    const knoppen = schakelaars.map((x): SchakelaarKnop => {
      const code = states.get(`select.${x.entity_id.slice('switch.'.length)}_on`)?.state;
      const s = states.get(x.entity_id);
      return {
        id: x.entity_id,
        naam: String(s?.attributes['friendly_name'] ?? x.original_name ?? x.entity_id),
        code: code == null ? null : code === 'registered',
        aan: s?.state === 'on' ? true : s?.state === 'off' ? false : null,
      };
    });
    const metCode = knoppen.filter((k) => k.code !== false);
    if (!metCode.length) continue;
    const meet = mine.find((x) => x.entity_id.startsWith('sensor.') && (klasseVan(x, states) === 'power' || /^k?W$/.test(eenheid(x.entity_id, states))))?.entity_id ?? null;
    const temperatuur = mine.find((x) => x.entity_id.startsWith('sensor.') && klasseVan(x, states) === 'temperature')?.entity_id ?? null;
    const platform = schakelaars[0]!.platform ?? '';
    uit.push({
      id: deviceId,
      naam,
      koppeling: platform,
      merk: device?.manufacturer ?? null,
      model: device?.model ?? null,
      gebied: device?.area_id ?? schakelaars[0]!.area_id ?? null,
      knoppen: metCode,
      zonderCode: knoppen.length - metCode.length,
      meet,
      temperatuur,
      aanname: ir || platform === 'rfxtrx' || schakelaars.some((x) => states.get(x.entity_id)?.attributes['assumed_state'] === true),
      ir,
    });
  }
  return uit.sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}

/** Een kinderslot: een `switch.` op het apparaat, ook onder zijn instellingen (besluit 299). */
const KINDERSLOT = /child.?lock|kinderslot|kindersicherung/i;

/**
 * Het kinderslot van het apparaat waar deze entiteit bij hoort (besluit 299),
 * zoals `switch.thermostaat_badkamer_kinderslot` (Tuya) bij de thermostaat, of
 * `switch.droger_kinderslot` (Home Connect) bij de droger; null zonder.
 */
export function kinderslotVan(entityId: string, entities: readonly HaRegistryEntity[], states: ReadonlyMap<string, HaEntityState>): { readonly id: string; readonly aan: boolean } | null {
  const apparaat = entities.find((e) => e.entity_id === entityId)?.device_id;
  if (!apparaat) return null;
  const slot = entities.find((e) => e.device_id === apparaat && e.entity_id.startsWith('switch.') && !e.disabled_by && KINDERSLOT.test(`${e.entity_id} ${e.original_name ?? ''}`) && states.has(e.entity_id));
  return slot ? { id: slot.entity_id, aan: states.get(slot.entity_id)?.state === 'on' } : null;
}

/** Hoe de app een schakelaar laat zien: wat hij vond, met wat de bewoner koos. */
export interface SchakelaarView extends GevondenSchakelaar {
  readonly keuze: SchakelaarKeuze | null;
  /**
   * Wat hij nu vraagt, in W (besluit 298): uit zijn eigen meter, anders wat de
   * bewoner invulde zolang een knop aan staat; null als dat niet te zeggen is.
   */
  readonly nuW: number | null;
  /** De temperatuur van nu op het apparaat zelf, of null (besluit 300). */
  readonly temperatuurC: number | null;
  /** Kan hij op zon (besluit 304)? Dan zijn id bij Regeling › Op zon; anders null. */
  readonly opZonId: string | null;
}

/** Wat een schakelaar nu vraagt: de meter, of het ingevulde vermogen als hij aan staat. */
export function nuVermogenW(g: GevondenSchakelaar, k: SchakelaarKeuze | null, states: ReadonlyMap<string, HaEntityState>): number | null {
  if (g.meet) {
    const s = states.get(g.meet);
    const n = Number(s?.state);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * (String(s?.attributes['unit_of_measurement'] ?? '') === 'kW' ? 1000 : 1));
  }
  // Met een stekker erbij meet de stekker (besluit 300): die telt al mee, niet dubbel.
  if (k?.stekker) return null;
  if (k?.vermogenW == null) return null;
  return g.knoppen.some((x) => states.get(x.id)?.state === 'on') ? k.vermogenW : 0;
}

export function schakelaarViews(gevonden: readonly GevondenSchakelaar[], keuzes: SchakelaarKeuzes, states: ReadonlyMap<string, HaEntityState> = new Map()): SchakelaarView[] {
  return gevonden.filter((g) => !keuzes.geen.includes(g.id)).map((g) => {
    const keuze = keuzes.apparaten[g.id] ?? null;
    const c = g.temperatuur ? Number(states.get(g.temperatuur)?.state) : NaN;
    return { ...g, keuze, nuW: nuVermogenW(g, keuze, states), temperatuurC: Number.isFinite(c) ? c : null, opZonId: keuze && kanOpZon(g, keuze) ? relaisId(g.id) : null };
  });
}

/** De naam van een knop in de app: wat de bewoner koos, anders de naam van het apparaat (en bij meer knoppen een nummer). */
export function knopNaam(g: GevondenSchakelaar, k: SchakelaarKeuze, knop: SchakelaarKnop, i: number): string {
  const eigen = k.knoppen?.[knop.id]?.trim();
  if (eigen) return eigen;
  const basis = k.naam.trim() || g.naam;
  return g.knoppen.length > 1 ? `${basis} ${i + 1}` : basis;
}

/** Het id van een schakelaar op zon (besluit 304): op het apparaat, zodat een andere naam hem niet van zon haalt. */
export const relaisId = (apparaat: string): string => `relais-${apparaat.replace(/[^a-z0-9]/gi, '').slice(0, 24).toLowerCase()}`;

/**
 * Schakelaars die op zon kunnen (besluit 304): zonder eigen meter, met een
 * vermogen dat de bewoner invulde, met één knop, geen lamp, geen IR en geen
 * stekker erbij (die stekker kan zelf op zon). Ze doen mee als een slimme
 * stekker ([264]): ze staan bij Regeling › Op zon, en daar is op zon zelf de
 * toestemming ([290]), met dezelfde deur naar Home Assistant.
 */
export function kanOpZon(g: GevondenSchakelaar, k: SchakelaarKeuze): boolean {
  return k.wat !== 'lamp' && !k.stekker && k.vermogenW != null && !g.meet && !g.ir && g.knoppen.length === 1;
}

export function schakelaarsOpZon(gevonden: readonly GevondenSchakelaar[], keuzes: SchakelaarKeuzes): FoundHeatStore[] {
  const uit: FoundHeatStore[] = [];
  for (const g of gevonden) {
    const k = keuzes.apparaten[g.id];
    if (!k || !kanOpZon(g, k) || k.vermogenW == null) continue;
    uit.push({
      id: relaisId(g.id),
      naam: (k.naam || g.naam).slice(0, 60),
      soort: 'stekker',
      control: 'switch',
      actuator: g.knoppen[0]!.id,
      estimatedW: Math.max(50, Math.min(PLUG_MAX_W, Math.round(k.vermogenW))),
      minC: 0,
      sunC: 0,
      heatRateCPerHour: 1,
    });
  }
  return uit;
}

/** De lampen achter een schakelaar: elke knop is een lamp, in de kamer die de bewoner koos. */
export function lampSchakelaars(gevonden: readonly GevondenSchakelaar[], keuzes: SchakelaarKeuzes): { readonly id: string; readonly naam: string; readonly kamer: string | null; readonly gebied: string | null; readonly via: string }[] {
  return gevonden.flatMap((g) => {
    const k = keuzes.apparaten[g.id];
    if (!k || k.wat !== 'lamp' || keuzes.geen.includes(g.id)) return [];
    return g.knoppen.map((knop, i) => ({ id: knop.id, naam: knopNaam(g, k, knop, i), kamer: k.kamer, gebied: g.gebied, via: g.model ?? g.naam }));
  });
}

/** De knoppen die SunArc met de hand aan en uit mag zetten: de bewoner koos "met de hand". */
export function schakelaarsMag(gevonden: readonly GevondenSchakelaar[], keuzes: SchakelaarKeuzes): string[] {
  return gevonden.flatMap((g) => {
    const k = keuzes.apparaten[g.id];
    return k && k.mag === 'hand' && !keuzes.geen.includes(g.id) ? g.knoppen.map((x) => x.id) : [];
  });
}

/**
 * Een keuze uit de app, nagelopen. `{ id, geen: true }` is "Dit is geen
 * apparaat"; `{ id, weg: true }` haalt de keuze weg.
 */
export function leesSchakelaarKeuze(body: unknown):
  | { readonly ok: true; readonly id: string; readonly keuze: SchakelaarKeuze | 'geen' | 'weg' }
  | { readonly ok: false; readonly reden: string } {
  if (typeof body !== 'object' || body == null || Array.isArray(body)) return { ok: false, reden: 'verwacht een object' };
  const b = body as Record<string, unknown>;
  const id = b['id'];
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) return { ok: false, reden: 'id is het apparaat in Home Assistant' };
  if (b['geen'] === true) return { ok: true, id, keuze: 'geen' };
  if (b['weg'] === true) return { ok: true, id, keuze: 'weg' };
  const wat = b['wat'];
  if (typeof wat !== 'string' || !(SCHAKELAAR_WAT as readonly string[]).includes(wat)) return { ok: false, reden: `wat is een van ${SCHAKELAAR_WAT.join(', ')}` };
  const naam = typeof b['naam'] === 'string' ? b['naam'].trim().slice(0, 60) : '';
  const kamer = b['kamer'] == null ? null : typeof b['kamer'] === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(b['kamer']) ? b['kamer'] : undefined;
  if (kamer === undefined) return { ok: false, reden: 'kamer is een kamer uit de indeling, of null' };
  const mag = b['mag'] === 'hand' ? 'hand' : b['mag'] === 'kijken' || b['mag'] == null ? 'kijken' : undefined;
  if (mag === undefined) return { ok: false, reden: 'mag is kijken of hand' };
  const knoppenRaw = b['knoppen'];
  let knoppen: Record<string, string> | undefined;
  if (knoppenRaw != null) {
    if (typeof knoppenRaw !== 'object' || Array.isArray(knoppenRaw)) return { ok: false, reden: 'knoppen is een object' };
    knoppen = {};
    for (const [k, v] of Object.entries(knoppenRaw as Record<string, unknown>)) {
      if (!/^switch\.[a-z0-9_]+$/.test(k) || typeof v !== 'string') return { ok: false, reden: 'knoppen: per switch. een naam' };
      if (v.trim()) knoppen[k] = v.trim().slice(0, 60);
    }
  }
  // Het vermogen als hij aan staat (besluit 298): een heel getal in W, van 1 tot 10 kW; leeg is weg.
  const w = b['vermogenW'];
  if (w != null && w !== '' && !(typeof w === 'number' && Number.isInteger(w) && w >= 1 && w <= 10_000)) return { ok: false, reden: 'vermogenW is een heel getal van 1 tot 10.000 W' };
  const vermogenW = typeof w === 'number' ? w : undefined;
  // De stekker erbij (besluit 300): het id van een stekker, of leeg.
  const st = b['stekker'];
  if (st != null && st !== '' && !(typeof st === 'string' && /^[a-z0-9_-]{1,40}$/.test(st))) return { ok: false, reden: 'stekker is het id van een stekker' };
  const stekker = typeof st === 'string' && st ? st : undefined;
  return { ok: true, id, keuze: { wat: wat as SchakelaarWat, naam, kamer, mag, ...(knoppen && Object.keys(knoppen).length ? { knoppen } : {}), ...(vermogenW != null ? { vermogenW } : {}), ...(stekker ? { stekker } : {}) } };
}

function leesKeuzes(raw: unknown): SchakelaarKeuzes {
  if (typeof raw !== 'object' || raw == null) return GEEN_KEUZES;
  const r = raw as Record<string, unknown>;
  const apparaten: Record<string, SchakelaarKeuze> = {};
  for (const [id, v] of Object.entries((r['apparaten'] as Record<string, unknown>) ?? {})) {
    const k = leesSchakelaarKeuze({ ...(v as object), id });
    if (k.ok && typeof k.keuze === 'object') apparaten[id] = k.keuze;
  }
  const geen = Array.isArray(r['geen']) ? r['geen'].filter((x): x is string => typeof x === 'string') : [];
  const laadpalen: Record<string, LosseLaadpaal> = {};
  for (const [id, v] of Object.entries((r['laadpalen'] as Record<string, unknown>) ?? {})) {
    const l = leesLosseLaadpaal({ ...(v as object), id });
    if (l.ok && typeof l.laadpaal === 'object') laadpalen[id] = l.laadpaal;
  }
  return { apparaten, geen, ...(Object.keys(laadpalen).length ? { laadpalen } : {}) };
}

/** Een keuze verwerkt in de keuzes, zonder de rest te veranderen. */
export function metKeuze(keuzes: SchakelaarKeuzes, id: string, keuze: SchakelaarKeuze | 'geen' | 'weg'): SchakelaarKeuzes {
  const { [id]: _weg, ...apparaten } = keuzes.apparaten;
  const geen = keuzes.geen.filter((x) => x !== id);
  const blijft = keuzes.laadpalen ? { laadpalen: keuzes.laadpalen } : {};
  if (keuze === 'weg') return { apparaten, geen, ...blijft };
  if (keuze === 'geen') return { apparaten, geen: [...geen, id], ...blijft };
  return { apparaten: { ...apparaten, [id]: keuze }, geen, ...blijft };
}

const BESTAND = 'schakelaars.json';

/** De keuzes in een eigen bestand naast de andere, zodat de rest van de aansluiting er niet van verandert. */
export class SchakelaarStore {
  readonly #pad: string;
  #nu: SchakelaarKeuzes = GEEN_KEUZES;
  #schrijven: Promise<void> = Promise.resolve();

  constructor(map: string) {
    this.#pad = join(map, BESTAND);
  }

  async load(): Promise<SchakelaarKeuzes> {
    try {
      this.#nu = leesKeuzes(JSON.parse(await readFile(this.#pad, 'utf-8')));
    } catch {
      this.#nu = GEEN_KEUZES;
    }
    return this.#nu;
  }

  get current(): SchakelaarKeuzes {
    return this.#nu;
  }

  async save(keuzes: SchakelaarKeuzes): Promise<void> {
    this.#nu = keuzes;
    const tekst = `${JSON.stringify(keuzes, null, 2)}\n`;
    const tmp = `${this.#pad}.nieuw`;
    this.#schrijven = this.#schrijven.catch(() => {}).then(async () => {
      await writeFile(tmp, tekst, 'utf-8');
      await rename(tmp, this.#pad);
    });
    await this.#schrijven;
  }
}
