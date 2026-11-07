/**
 * Een boiler of jacuzzi vinden in Home Assistant (besluit 186), zoals de droger
 * bij de zon en je aansluiting (besluit 103).
 *
 * - **Een jacuzzi:** een thermostaat of boiler die zo heet, zoals de Intex
 *   PureSpa via de koppeling Intex Spa (`climate.`) of via Tuya Local
 *   (`water_heater.`).
 * - **Een boiler met temperatuur:** een `water_heater.`, zoals een
 *   warmtepompboiler of een elektrische boiler met eigen koppeling.
 * - **Een boiler aan een stekker:** een schakelaar die zo heet, met de meter
 *   van hetzelfde apparaat.
 * - **Een zonne-boilerregelaar:** een getal dat het vermogen zet, zoals een
 *   AC·THOR of PEEC.
 *
 * - **Een slimme stekker** (besluit 264): een schakelaar van een apparaat dat
 *   een stekker heet (in de naam of het model), of dat zijn eigen vermogen
 *   meet, en verder niets anders is: geen airco, lamp, laadpaal of droger. Wat
 *   erachter zit, zegt de naam.
 *
 * Wat hij trekt en hoe snel hij verwarmt, is een schatting per soort; het huis
 * leert het daarna zelf. Een voorstel: de bewoner kiest of hij op zon mag.
 */

import type { HaEntityState } from '../adapters/homeassistant/client.js';
import type { HaDevice, HaRegistryEntity } from '../adapters/homeassistant/discovery.js';
import type { HeatStore } from '../core/model.js';

export interface FoundHeatStore {
  readonly id: string;
  readonly naam: string;
  readonly soort: HeatStore['kind'];
  readonly control: HeatStore['control'];
  readonly actuator: string;
  readonly temperature?: { readonly id: string; readonly attribute?: string };
  readonly power?: string;
  readonly estimatedW: number;
  readonly minC: number;
  readonly sunC: number;
  readonly heatRateCPerHour: number;
  readonly legionellaC?: number;
  /** De kWh-meter van hetzelfde apparaat, als die er is: voor Opbrengst (besluit 264). */
  readonly energy?: string;
}

/** De melder voor op afstand starten: dan is het witgoed, geen stekker. */
const REMOTE = /remote.?(control.?)?start|op.?afstand|fernstart/i;
const SPA = /spa|jacuzzi|hot.?tub|whirlpool|bubbelbad|bubbel|intex/i;
const BOILER = /boiler|geyser|water.?heater|warm.?water|tapwater|dhw/i;
const DIVERTER = /ac.?thor|elwa|my.?pv|peec|diverter/i;
/** Merken en woorden van warmtepompboilers: die trekken weinig en verwarmen langzaam. */
const WARMTEPOMP = /heat.?pump|warmtepomp|explorer|nuos|aquarea|altherma|ecotech|lyos|vitocal|aerotermo|thermo/i;

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function findHeatStores(
  states: ReadonlyMap<string, HaEntityState>,
  entities: readonly HaRegistryEntity[],
  devices: readonly HaDevice[],
): FoundHeatStore[] {
  const out: FoundHeatStore[] = [];
  const used = new Set<string>();
  const doneDevices = new Set<string>();
  const live = entities.filter((e) => !e.disabled_by && states.has(e.entity_id));
  // Eerst wat een temperatuur heeft, dan de schakelaars: een boiler met beide telt één keer.
  const volgorde = (e: HaRegistryEntity) => (/^(water_heater|climate)\./.test(e.entity_id) ? 0 : 1);
  for (const e of [...live].sort((a, b) => volgorde(a) - volgorde(b))) {
    const domain = e.entity_id.split('.')[0]!;
    if (!['water_heater', 'climate', 'switch', 'number'].includes(domain)) continue;
    if (e.device_id && doneDevices.has(e.device_id)) continue;
    const device = devices.find((d) => d.id === e.device_id);
    const deviceName = device?.name_by_user ?? device?.name ?? '';
    const label = `${deviceName} ${e.entity_id} ${e.original_name ?? ''} ${e.platform ?? ''} ${device?.model ?? ''}`;
    const mine = e.device_id ? live.filter((x) => x.device_id === e.device_id) : [e];
    const state = states.get(e.entity_id)!;

    let gevonden: Omit<FoundHeatStore, 'id' | 'naam' | 'power'> | null = null;
    if ((domain === 'climate' || domain === 'water_heater') && (SPA.test(label) || e.platform === 'intex_spa')) {
      gevonden = { soort: 'jacuzzi', control: 'setpoint', actuator: e.entity_id, temperature: { id: e.entity_id, attribute: 'current_temperature' }, estimatedW: 2200, minC: 30, sunC: 38, heatRateCPerHour: 1.5 };
    } else if (domain === 'water_heater') {
      const wp = WARMTEPOMP.test(label);
      const heeftTemp = typeof state.attributes['current_temperature'] === 'number';
      gevonden = {
        soort: 'boiler',
        control: heeftTemp ? 'setpoint' : 'switch',
        actuator: e.entity_id,
        ...(heeftTemp ? { temperature: { id: e.entity_id, attribute: 'current_temperature' } } : {}),
        estimatedW: wp ? 500 : 2000,
        minC: 50,
        sunC: 65,
        heatRateCPerHour: wp ? 6 : 10,
        ...(heeftTemp ? { legionellaC: 60 } : {}),
      };
    } else if (domain === 'switch' && BOILER.test(label)) {
      const temp = mine.find((x) => x.entity_id.startsWith('sensor.') && (x.device_class ?? x.original_device_class ?? states.get(x.entity_id)?.attributes['device_class']) === 'temperature');
      gevonden = {
        soort: 'boiler',
        control: 'switch',
        actuator: e.entity_id,
        ...(temp ? { temperature: { id: temp.entity_id } } : {}),
        estimatedW: 2000,
        minC: 50,
        sunC: 65,
        heatRateCPerHour: 10,
      };
    } else if (domain === 'number' && DIVERTER.test(label)) {
      const temp = mine.find((x) => x.entity_id.startsWith('sensor.') && (x.device_class ?? x.original_device_class ?? states.get(x.entity_id)?.attributes['device_class']) === 'temperature');
      gevonden = {
        soort: 'boiler',
        control: 'diverter',
        actuator: e.entity_id,
        ...(temp ? { temperature: { id: temp.entity_id } } : {}),
        estimatedW: 3000,
        minC: 50,
        sunC: 65,
        heatRateCPerHour: 10,
        ...(temp ? { legionellaC: 60 } : {}),
      };
    }
    if (gevonden == null) continue;
    if (e.device_id) doneDevices.add(e.device_id);

    const power = mine.find((x) => {
      if (!x.entity_id.startsWith('sensor.')) return false;
      const s = states.get(x.entity_id);
      return (x.device_class ?? x.original_device_class ?? s?.attributes['device_class']) === 'power' || /^k?W$/.test(String(s?.attributes['unit_of_measurement'] ?? ''));
    });
    const standaard = gevonden.soort === 'jacuzzi' ? 'Jacuzzi' : 'Boiler';
    const naam = device?.name_by_user?.trim() || standaard;
    let id = slug(gevonden.soort) || 'buffer';
    for (let i = 2; used.has(id); i++) id = `${gevonden.soort}-${i}`;
    used.add(id);
    out.push({ id, naam, ...gevonden, ...(power ? { power: power.entity_id } : {}) });
  }
  return out;
}

/* ------------------------------------------------- slimme stekkers (264) */

const PLUG = /plug|stekker|stopcontact|outlet|socket|wandcontactdoos/i;
/** Wat geen stekker is, ook al meet het zijn vermogen. */
const GEEN_STEKKER = /charg|laad|wallbox|easee|zappi|evse|airco|air.?condition|heat.?pump|warmtepomp|omvormer|inverter|accu|battery|batterij/i;
/** Een apparaat met een van deze is iets anders dan een stekker. */
const ANDER_DOMEIN = /^(climate|light|fan|water_heater|media_player|cover|vacuum|lock|humidifier|lawn_mower|valve|camera|alarm_control_panel)\./;
/** Een kWh-meter die telt per dag, maand of jaar: niet de stand. */
const PERIODE = /today|yesterday|vandaag|gisteren|week|month|maand|year|jaar|daily|monthly/i;

const klasseVan = (x: HaRegistryEntity, states: ReadonlyMap<string, HaEntityState>) => x.device_class ?? x.original_device_class ?? (states.get(x.entity_id)?.attributes['device_class'] as string | undefined) ?? null;
const eenheid = (id: string, states: ReadonlyMap<string, HaEntityState>) => String(states.get(id)?.attributes['unit_of_measurement'] ?? '');

/** Een slimme stekker is hooguit 16 A op 230 V. */
export const PLUG_MAX_W = 3_680;
/** Wat een stekker vraagt als we het niet weten: een kachel of ontvochtiger. */
export const PLUG_W = 1_000;

/**
 * De slimme stekkers (besluit 264): per apparaat één, met zijn eigen meter als
 * die er is. `bekend` zijn de schakelaars die het huis al anders kent, zoals
 * een boiler of de stekkers van de regeling; die slaat hij over.
 */
export function findPlugs(
  states: ReadonlyMap<string, HaEntityState>,
  entities: readonly HaRegistryEntity[],
  devices: readonly HaDevice[],
  bekend: ReadonlySet<string> = new Set(),
): FoundHeatStore[] {
  const out: FoundHeatStore[] = [];
  const used = new Set<string>();
  const live = entities.filter((e) => !e.disabled_by && states.has(e.entity_id));
  const perApparaat = new Map<string, HaRegistryEntity[]>();
  for (const e of live) if (e.device_id) perApparaat.set(e.device_id, [...(perApparaat.get(e.device_id) ?? []), e]);
  for (const [deviceId, mine] of perApparaat) {
    if (mine.some((x) => ANDER_DOMEIN.test(x.entity_id) || (x.entity_id.startsWith('binary_sensor.') && REMOTE.test(x.entity_id)))) continue;
    // De schakelaar zelf: geen instelling (lampje, kinderslot) maar het stopcontact.
    const schakelaars = mine.filter((x) => x.entity_id.startsWith('switch.') && !x.entity_category && !x.hidden_by);
    if (schakelaars.length !== 1) continue;
    const sw = schakelaars[0]!;
    if (bekend.has(sw.entity_id)) continue;
    const device = devices.find((d) => d.id === deviceId);
    const naam = (device?.name_by_user?.trim() || device?.name?.trim() || String(states.get(sw.entity_id)?.attributes['friendly_name'] ?? '').trim() || sw.entity_id).slice(0, 60);
    const label = `${naam} ${device?.model ?? ''} ${device?.manufacturer ?? ''} ${sw.entity_id}`;
    if (GEEN_STEKKER.test(label) || SPA.test(label) || BOILER.test(label)) continue;
    const power = mine.find((x) => x.entity_id.startsWith('sensor.') && (klasseVan(x, states) === 'power' || /^k?W$/.test(eenheid(x.entity_id, states))));
    // Een stekker heet zo, of meet zijn eigen vermogen. Alleen `outlet` is te weinig:
    // Tuya noemt elk relais zo, ook een schakelaar in de muur (7 november 2026, Spiegel badkamer).
    if (!PLUG.test(label) && !power) continue;
    const kwh = mine.filter((x) => x.entity_id.startsWith('sensor.') && (klasseVan(x, states) === 'energy' || /^[kMW]?Wh$/.test(eenheid(x.entity_id, states))));
    const energy = kwh.find((x) => !PERIODE.test(x.entity_id) && states.get(x.entity_id)?.attributes['state_class'] !== 'measurement') ?? null;
    // Staat hij nu aan en trekt hij iets, dan is dat zijn vermogen; anders een schatting tot de dienst het ziet.
    const nu = power ? Number(states.get(power.entity_id)?.state) * (eenheid(power.entity_id, states) === 'kW' ? 1000 : 1) : NaN;
    const estimatedW = Number.isFinite(nu) && nu > 50 ? Math.min(PLUG_MAX_W, Math.round(nu)) : PLUG_W;
    let id = `stekker-${slug(naam)}`.slice(0, 40).replace(/-+$/, '');
    for (let i = 2; used.has(id); i++) id = `${id.slice(0, 37)}-${i}`;
    used.add(id);
    out.push({
      id,
      naam,
      soort: 'stekker',
      control: 'switch',
      actuator: sw.entity_id,
      ...(power ? { power: power.entity_id } : {}),
      ...(energy ? { energy: energy.entity_id } : {}),
      estimatedW,
      minC: 0,
      sunC: 0,
      heatRateCPerHour: 1,
    });
  }
  return out;
}

/** Een gevonden buffer zoals hij in de configuratie komt (besluit 186). */
export function heatStoreConfig(b: FoundHeatStore): Record<string, unknown> {
  return {
    id: b.id,
    name: b.naam,
    kind: b.soort,
    control: b.control,
    actuator: b.actuator,
    ...(b.temperature ? { temperature: b.temperature.attribute ? { id: b.temperature.id, attribute: b.temperature.attribute } : b.temperature.id } : {}),
    ...(b.power ? { power: b.power } : {}),
    estimatedW: b.estimatedW,
    // Een stekker heeft geen graden (besluit 264).
    ...(b.soort === 'stekker' ? {} : { minC: b.minC, sunC: b.sunC, heatRateCPerHour: b.heatRateCPerHour }),
    ...(b.legionellaC != null ? { legionellaC: b.legionellaC } : {}),
  };
}
