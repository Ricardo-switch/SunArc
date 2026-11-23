/**
 * Van onbetrouwbare JSON naar een gevalideerde `SiteConfig`.
 *
 * Twee dingen maken dit meer dan een typecast.
 *
 * Ten eerste: er wordt niet geworpen bij de eerste fout. Een
 * onboarding-wizard die één probleem per keer meldt is onbruikbaar; je wilt
 * alles in één keer zien. Daarom levert de parser een lijst.
 *
 * Ten tweede: naast de vorm wordt ook de samenhang gecontroleerd. Een zone die
 * verwijst naar een actuator die niet bestaat is syntactisch prima JSON en
 * functioneel een storing om drie uur 's nachts. Dat soort fouten hoort hier
 * gevonden te worden, met een zin die zegt wat eraan mankeert.
 *
 * Bewust zonder validatiebibliotheek: de foutmeldingen zijn hier het product,
 * de verwijzingscontroles moeten sowieso met de hand, en een dienst die in een
 * container bij mensen thuis draait heeft baat bij een korte lijst
 * afhankelijkheden. Die afweging is omkeerbaar — het raakt alleen dit bestand.
 */

import { GEOMETRY_SOURCES, MODES, HEAT_STORE_CONTROLS, HEAT_STORE_KINDS, type Actuator, type CvHelp, type HeatStore, type ComfortProfile, type ProfileHold, type ProfileZone, type Facade, type Geometry, type GridLimits, type GridPhase, type Deferrable, type SunSlot, type SolarPlane, type DeviceRef, type MeasurementPoint, type Mode, type SetpointPair, type SiteConfig, type Zone } from '../core/model.js';
import { CV_HELP_DEFAULTS, HEAT_ASSIST_DEFAULTS } from '../core/strategies/heatAssist.js';
import { STANDAARD_DAGDELEN } from './standaard.js';
import { type ConfigProblem, Problems, arr, blockOf, isRecord, join, measurementPoint, num, numOr, oneOf, oneOfOr, ref, refList, str, strOr } from './schema-velden.js';
import { actuator, checkCoherence, zone } from './schema-delen.js';
// Uit schema-delen.ts (opgesplitst op 22 november 2026); wie dit bestand importeert, krijgt die namen ook.
export * from './schema-delen.js';
// Uit schema-velden.ts (opgesplitst op 22 november 2026); wie dit bestand importeert, krijgt die namen ook.
export * from './schema-velden.js';

/** De schemaversie die deze code begrijpt. */
export const SCHEMA_VERSION = 1;

export type ConfigResult =
  | { readonly ok: true; readonly config: SiteConfig; readonly warnings: readonly ConfigProblem[] }
  | { readonly ok: false; readonly problems: readonly ConfigProblem[] };

export interface ParseOptions {
  /** Strategie-ID's die deze build kent, voor de verwijzingscontrole. */
  readonly knownStrategies?: readonly string[];
}

/** Leest en controleert een configuratie. Werpt niet; geeft alle problemen terug. */
export function parseSiteConfig(
  input: unknown,
  options: ParseOptions = {},
): ConfigResult {
  const p = new Problems();
  const knownStrategies = options.knownStrategies ?? [];

  if (!isRecord(input)) {
    return {
      ok: false,
      problems: [{ path: '', message: 'de configuratie moet een JSON-object zijn', severity: 'error' }],
    };
  }

  const version = input['schemaVersion'];
  if (version === undefined) {
    // Ontbreken is iets anders dan afwijken. Zonder nummer nemen we aan dat
    // het bestand bij deze versie hoort; staat er een ánder nummer, dan weten
    // we juist zeker dat het niet klopt.
    p.warn('schemaVersion', `ontbreekt; er wordt gelezen alsof het ${SCHEMA_VERSION} is`);
  } else if (version !== SCHEMA_VERSION) {
    p.error(
      'schemaVersion',
      `is ${String(version)}, maar deze versie leest ${SCHEMA_VERSION}. ` +
        'Werk het bestand bij of gebruik een passende versie van de software.',
    );
  }

  // De naam van de installatie is een label: hij staat in het logboek en boven
  // de weergave. Geen reden om te weigeren.
  const id = strOr(p, input, '', 'id', 'installatie');
  const timezone = str(p, input, '', 'timezone');
  if (timezone != null) {
    // Een tikfout in de tijdzone zou de dagindeling uren verschuiven zonder één
    // foutmelding. Hier vangen is veel goedkoper dan het in de winterdata
    // terugvinden.
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: timezone });
    } catch {
      p.error(
        'timezone',
        `"${timezone}" is geen bekende tijdzone; gebruik een IANA-naam zoals Europe/Amsterdam`,
      );
    }
  }
  const defaultAdapter = typeof input['defaultAdapter'] === 'string'
    ? (input['defaultAdapter'] as string)
    : 'homeassistant';

  // Een huis zonder slimme verwarming of airco (besluit 194): dan geen apparaten en geen zones,
  // en doet de app de rest (licht, schermen, energie, op zon, de assistent).
  const actuatorsRaw = input['actuators'] === undefined ? [] : arr(p, input, '', 'actuators');
  const actuators = (actuatorsRaw ?? [])
    .map((v, i) => actuator(p, v, `actuators[${i}]`, defaultAdapter))
    .filter((a): a is Actuator => a != null);

  const zonesRaw = input['zones'] === undefined ? [] : arr(p, input, '', 'zones');
  const zones = (zonesRaw ?? [])
    .map((v, i) =>
      zone(p, v, `zones[${i}]`, defaultAdapter, i + 1, new Map(actuators.map((a) => [a.id, a]))),
    )
    .filter((z): z is Zone => z != null);

  /*
   * Het hele vermogensblok mag weg.
   *
   * Zonder slimme meter valt `pv-surplus` weg — verderop wordt die dan ook
   * werkelijk uitgezet in plaats van hem stil niets te laten doen. De drempels
   * blijven bestaan met gebruikelijke waarden, want `stopImportW` en
   * `stabilisationMinutes` worden ook buiten die strategie gelezen.
   */
  type Power = SiteConfig['power'];
  let power: Power | null = null;
  const powerRaw = blockOf(p, input['power'], 'power');
  if (powerRaw) {
    const gridRaw = powerRaw['gridPower'];
    const gridPower =
      gridRaw === undefined ? null : ref(p, gridRaw, 'power.gridPower', defaultAdapter);
    const exportRaw = powerRaw['gridExport'];
    const gridExport =
      exportRaw === undefined ? null : ref(p, exportRaw, 'power.gridExport', defaultAdapter);
    if (gridExport && !gridPower) p.error('power.gridExport', 'teruglevering zonder afname; noem eerst gridPower');
    const startSurplusW = numOr(p, powerRaw, 'power', 'startSurplusW', 1000, { min: 0, max: 50_000 });
    const stopImportW = numOr(p, powerRaw, 'power', 'stopImportW', 50, { min: 0, max: 50_000 });
    const resumeSurplusW = numOr(p, powerRaw, 'power', 'resumeSurplusW', 600, { min: 0, max: 50_000 });
    const stabilisationMinutes = numOr(p, powerRaw, 'power', 'stabilisationMinutes', 5, {
      min: 0,
      max: 120,
    });
    {
      if (resumeSurplusW > startSurplusW) {
        p.error(
          'power.resumeSurplusW',
          `hervatten bij ${resumeSurplusW} W terwijl starten pas bij ${startSurplusW} W mag, ` +
            'is tegenstrijdig; hervatten hoort de lagere drempel te zijn',
        );
      } else {
        power = {
          ...(gridPower ? { gridPower } : {}),
          ...(gridPower && gridExport ? { gridExport } : {}),
          startSurplusW,
          stopImportW,
          resumeSurplusW,
          stabilisationMinutes,
        };
      }
    }
  }

  // Geen aanwezigheidsbronnen is een geldige installatie: dan geldt het huis
  // als bewoond (zie context.ts). Dat is de comfortabele kant om te raden.
  const occupancyRaw =
    input['occupancy'] === undefined ? null : arr(p, input, '', 'occupancy');
  const occupancy: { id: string; ref: DeviceRef }[] = [];
  const seenOccupancy = new Set<string>();
  occupancyRaw?.forEach((v, i) => {
    const path = `occupancy[${i}]`;
    if (!isRecord(v)) {
      p.error(path, 'moet een object zijn met id en ref');
      return;
    }
    const oid = str(p, v, path, 'id');
    const oref = ref(p, v['ref'], join(path, 'ref'), defaultAdapter);
    if (oid && seenOccupancy.has(oid)) p.error(join(path, 'id'), `"${oid}" komt twee keer voor`);
    if (oid) seenOccupancy.add(oid);
    if (oid && oref) occupancy.push({ id: oid, ref: oref });
  });
  if (occupancy.length === 0 && occupancyRaw != null) {
    p.warn('occupancy', 'zonder aanwezigheidsbronnen staat het huis altijd op afwezig');
  }

  // Comfort per bewoner (besluit 147): profielen op volgorde, met bekende
  // aanwezigheidsbronnen en zones, en doelen binnen wat het schema toestaat.
  const profiles: ComfortProfile[] = [];
  const profilesRaw = input['profiles'] === undefined ? null : arr(p, input, '', 'profiles');
  const zoneIdsKnown = new Set(zones.map((z) => z.id));
  profilesRaw?.forEach((v, i) => {
    const path = `profiles[${i}]`;
    if (!isRecord(v)) {
      p.error(path, 'moet een object zijn met id, name, occupancyIds en zones');
      return;
    }
    const pid = str(p, v, path, 'id');
    const pname = str(p, v, path, 'name');
    if (pid && profiles.some((x) => x.id === pid)) p.error(join(path, 'id'), `"${pid}" komt twee keer voor`);
    const ids = Array.isArray(v['occupancyIds']) ? v['occupancyIds'] : [];
    if (!ids.every((x) => typeof x === 'string' && seenOccupancy.has(x))) p.error(join(path, 'occupancyIds'), 'alleen aanwezigheidsbronnen uit occupancy');
    const zonesIn = isRecord(v['zones']) ? v['zones'] : {};
    const pz: Record<string, ProfileZone> = {};
    for (const [zid, zv] of Object.entries(zonesIn)) {
      const zpath = join(join(path, 'zones'), zid);
      if (!zoneIdsKnown.has(zid)) {
        p.error(zpath, 'die zone bestaat niet');
        continue;
      }
      if (!isRecord(zv)) continue;
      const sp: Partial<Record<Mode, SetpointPair>> = {};
      for (const [m, pair] of Object.entries(isRecord(zv['setpoints']) ? zv['setpoints'] : {})) {
        if (!(MODES as readonly string[]).includes(m) || !isRecord(pair)) {
          p.error(join(zpath, m), `"${m}" is geen bekende modus`);
          continue;
        }
        const geldig = (t: unknown) => t === undefined || (typeof t === 'number' && t >= 5 && t <= 35);
        if (!geldig(pair['heat']) || !geldig(pair['cool'])) {
          p.error(join(zpath, m), 'heat en cool liggen tussen 5 en 35 °C');
          continue;
        }
        sp[m as Mode] = { ...(typeof pair['heat'] === 'number' ? { heat: pair['heat'] } : {}), ...(typeof pair['cool'] === 'number' ? { cool: pair['cool'] } : {}) };
      }
      const max = zv['comfortMaxC'];
      if (max !== undefined && max !== null && !(typeof max === 'number' && max >= 15 && max <= 40)) p.error(join(zpath, 'comfortMaxC'), 'ligt tussen 15 en 40 °C');
      pz[zid] = { ...(Object.keys(sp).length ? { setpoints: sp } : {}), ...(max === null ? { comfortMaxC: null } : typeof max === 'number' ? { comfortMaxC: max } : {}) };
    }
    if (pid && pname) profiles.push({ id: pid, name: pname, occupancyIds: ids as string[], zones: pz });
  });
  let profileHold: ProfileHold | undefined;
  if (isRecord(input['profileHold'])) {
    const h = input['profileHold'];
    const home = Array.isArray(h['home']) ? h['home'].filter((x): x is string => typeof x === 'string') : [];
    if (typeof h['id'] === 'string' && profiles.some((x) => x.id === h['id'])) profileHold = { id: h['id'], home };
  }

  // Een dagritme dat voor de meeste huishoudens klopt. Wie er anders in staat
  // zet het zelf, maar niemand hoeft erover na te denken om te kunnen starten.
  type Schedule = SiteConfig['schedule'];
  let schedule: Schedule | null = null;
  const scheduleRaw = blockOf(p, input['schedule'], 'schedule');
  if (scheduleRaw) {
    // De standaard voor een nieuw huis (besluit 204): 6, 7 en 22 uur.
    const preheatFromHour = numOr(p, scheduleRaw, 'schedule', 'preheatFromHour', STANDAARD_DAGDELEN.voorverwarmen, {
      min: 0,
      max: 23,
      integer: true,
    });
    const dayFromHour = numOr(p, scheduleRaw, 'schedule', 'dayFromHour', STANDAARD_DAGDELEN.dag, {
      min: 0,
      max: 23,
      integer: true,
    });
    const nightFromHour = numOr(p, scheduleRaw, 'schedule', 'nightFromHour', STANDAARD_DAGDELEN.nacht, {
      min: 0,
      max: 23,
      integer: true,
    });
    const lightsRaw =
      scheduleRaw['eveningExtensionLights'] === undefined
        ? []
        : (arr(p, scheduleRaw, 'schedule', 'eveningExtensionLights') ?? []);
    const lights = refList(p, lightsRaw, 'schedule.eveningExtensionLights', defaultAdapter);
    {
      if (!(preheatFromHour < dayFromHour && dayFromHour < nightFromHour)) {
        p.error(
          'schedule',
          `de uren moeten oplopen: voorverwarmen (${preheatFromHour}) vóór dag (${dayFromHour}) vóór nacht (${nightFromHour})`,
        );
      } else {
        schedule = {
          preheatFromHour,
          dayFromHour,
          nightFromHour,
          eveningExtensionLights: lights,
        };
      }
    }
  }

  /*
   * Welke strategieën meedoen.
   *
   * Ontbreekt de lijst, dan doen ze allemaal mee. Dat is de aanname die past
   * bij "ik heb dit nog niet ingesteld": je wilt dat het werkt, niet dat het
   * niets doet.
   *
   * Verderop gaat `pv-surplus` er weer uit wanneer er geen slimme meter is.
   * Dat is het verschil tussen degraderen en stilvallen: zonder die stap zou
   * de strategie blijven staan en elke ronde een budget van vijftig watt
   * verdelen, wat nergens genoeg voor is — zonder dat iemand het merkt.
   */
  const strategiesRaw =
    input['enabledStrategies'] === undefined
      ? null
      : arr(p, input, '', 'enabledStrategies', { minLength: 1 });
  const enabledStrategies: string[] = [];
  if (input['enabledStrategies'] === undefined) {
    enabledStrategies.push(...knownStrategies);
  } else {
    strategiesRaw?.forEach((v, i) => {
      if (typeof v !== 'string') p.error(`enabledStrategies[${i}]`, 'moet een tekst zijn');
      else enabledStrategies.push(v);
    });
  }

  // Zonder opgegeven meetpunten valt de failsafe nooit aan. Dat is geen
  // verzwakking: de failsafe schakelt assist-apparaten terug wanneer een
  // meetpunt wegvalt, en zonder opgave weten we niet welke dat zouden zijn.
  const criticalRaw =
    input['criticalInputs'] === undefined ? null : arr(p, input, '', 'criticalInputs');
  const criticalInputs = refList(p, criticalRaw ?? [], 'criticalInputs', defaultAdapter);

  // ---- modusbron ------------------------------------------------------------
  let mode: SiteConfig['mode'] | null = null;
  const modeRaw = input['mode'];
  if (modeRaw === undefined) {
    // Geen fout sinds fase 6e: bij een verse installatie bestaan die knoppen
    // in Home Assistant niet, en ze aanmaken zou schrijven zijn (besluit 15).
    // De dienst houdt de modus dan zelf bij.
    p.warn(
      'mode',
      'ontbreekt; de modus wordt dan intern bijgehouden en er is geen knop ' +
        'in Home Assistant die hem verzet',
    );
  } else if (!isRecord(modeRaw)) {
    p.error('mode', 'moet een object zijn');
  } else {
    const select = ref(p, modeRaw['select'], 'mode.select', defaultAdapter);
    const automatic = str(p, modeRaw, 'mode', 'automatic');

    const aliases: Record<string, Mode> = {};
    const aliasRaw = modeRaw['aliases'];
    if (!isRecord(aliasRaw)) {
      p.error('mode.aliases', 'ontbreekt of is geen object');
    } else {
      for (const [state, target] of Object.entries(aliasRaw)) {
        if (typeof target !== 'string' || !(MODES as readonly string[]).includes(target)) {
          p.error(
            join('mode.aliases', state),
            `"${String(target)}" is geen bekende modus; kies uit ${MODES.join(', ')}`,
          );
          continue;
        }
        aliases[state] = target as Mode;
      }
    }

    const handsOffWhen: { ref: DeviceRef; state: string }[] = [];
    const handsRaw = modeRaw['handsOffWhen'];
    if (handsRaw !== undefined) {
      if (!Array.isArray(handsRaw)) {
        p.error('mode.handsOffWhen', 'moet een lijst zijn');
      } else {
        handsRaw.forEach((v, i) => {
          const path = `mode.handsOffWhen[${i}]`;
          if (!isRecord(v)) {
            p.error(path, 'moet een object zijn met ref en state');
            return;
          }
          const r = ref(p, v['ref'], join(path, 'ref'), defaultAdapter);
          const st = str(p, v, path, 'state');
          if (r && st) handsOffWhen.push({ ref: r, state: st });
        });
      }
    }

    if (select && automatic) {
      // Een modus-keuze die nergens naar "handmatig" kan wijzen is verdacht:
      // dan kan de bewoner de regeling nooit loslaten. Waarschuwing en geen
      // fout, want een woning zonder die knop mag bestaan.
      const knowsManual =
        Object.values(aliases).includes('handmatig') || handsOffWhen.length > 0;
      if (!knowsManual) {
        p.warn(
          'mode',
          'geen enkele stand vertaalt naar "handmatig" en er is geen handsOffWhen; ' +
            'de bewoner kan de regeling dan nergens loslaten',
        );
      }
      mode = { select, automatic, aliases, handsOffWhen };
    }
  }

  // ---- timers en zon --------------------------------------------------------
  let timers: SiteConfig['timers'] | null = null;
  const timersRaw = input['timers'];
  if (timersRaw === undefined) {
    // Ook geen fout meer. De kern vraagt met een commando om een timer; die
    // vraag kan de dienst zelf beantwoorden. Zie adapters/own-state.ts.
    p.warn(
      'timers',
      'ontbreekt; de stabilisatietimer wordt dan intern bijgehouden en gaat ' +
        'bij een herstart verloren',
    );
  } else if (!isRecord(timersRaw)) {
    p.error('timers', 'moet een object zijn');
  } else {
    // Per timer optioneel (besluit 39 en 60). Wat ontbreekt, houdt de dienst
    // zelf bij; `manualOverride` leest de kern op dit moment niet eens uit.
    const optionalRef = (key: 'stabilisation' | 'manualOverride'): DeviceRef | null =>
      timersRaw[key] === undefined
        ? null
        : ref(p, timersRaw[key], `timers.${key}`, defaultAdapter);
    const stabilisation = optionalRef('stabilisation');
    const manualOverride = optionalRef('manualOverride');
    if (stabilisation || manualOverride) {
      timers = {
        ...(stabilisation ? { stabilisation } : {}),
        ...(manualOverride ? { manualOverride } : {}),
      };
    }
  }

  // Alleen `pv-surplus` leest de zon, om 's nachts niet op een spookoverschot
  // te reageren. Zonder die strategie doet hij niets, dus hij mag ontbreken.
  const sunRaw = input['sun'];
  const sun = sunRaw === undefined ? null : ref(p, sunRaw, 'sun', defaultAdapter);

  const outdoorRaw = input['outdoorTemperature'];
  const outdoorTemperature =
    outdoorRaw === undefined ? null : ref(p, outdoorRaw, 'outdoorTemperature', defaultAdapter);
  if (outdoorRaw === undefined) {
    // Geen fout: een woning zonder buitensensor moet kunnen draaien. Wel
    // melden, want zonder hem is de dataset niet compleet voor fase 7
    // (besluit 30) en dat merk je pas een winter later.
    p.warn(
      'outdoorTemperature',
      'ontbreekt; de buitentemperatuur wordt dan niet in het beslislogboek ' +
        'vastgelegd en de dataset is niet compleet voor fase 7',
    );
  }

  // Alleen vastleggen, niets beslist erop (besluit 65).
  const recordOnlyRaw = input['recordOnly'];
  let recordOnly: DeviceRef[] | null = null;
  if (recordOnlyRaw !== undefined) {
    if (!Array.isArray(recordOnlyRaw)) {
      p.error('recordOnly', 'moet een lijst met entiteiten zijn');
    } else {
      recordOnly = refList(p, recordOnlyRaw, 'recordOnly', defaultAdapter);
    }
  }

  // Uitstelbare apparaten, zoals de droger (besluit 98). Optioneel.
  const deferrables: Deferrable[] = [];
  const deferrablesRaw = input['deferrables'];
  if (deferrablesRaw !== undefined) {
    if (!Array.isArray(deferrablesRaw)) {
      p.error('deferrables', 'moet een lijst zijn');
    } else {
      const seenDeferrable = new Set<string>();
      deferrablesRaw.forEach((d, i) => {
        const path = join('deferrables', i);
        if (!isRecord(d)) {
          p.error(path, 'moet een object zijn');
          return;
        }
        const id = str(p, d, path, 'id');
        if (id && seenDeferrable.has(id)) p.error(join(path, 'id'), `apparaat "${id}" staat er twee keer`);
        if (id) seenDeferrable.add(id);
        const name = str(p, d, path, 'name');
        const remoteStart = d['remoteStart'] === undefined ? (p.error(join(path, 'remoteStart'), 'ontbreekt'), null) : ref(p, d['remoteStart'], join(path, 'remoteStart'), defaultAdapter);
        const operationState = d['operationState'] === undefined ? null : ref(p, d['operationState'], join(path, 'operationState'), defaultAdapter);
        const programDuration = d['programDuration'] === undefined ? null : ref(p, d['programDuration'], join(path, 'programDuration'), defaultAdapter);
        // De resterende tijd en de voortgang (besluit 167). Niet genoemd, maar wel de
        // duur van Home Connect Alt: dan de broers van die sensor, met dezelfde naam ervoor.
        const hca = programDuration && /_bsh_common_option_estimatedtotalprogramtime$/.test(programDuration.id) ? programDuration.id.replace(/estimatedtotalprogramtime$/, '') : null;
        const remainingTime = d['remainingTime'] !== undefined ? ref(p, d['remainingTime'], join(path, 'remainingTime'), defaultAdapter) : hca ? { ...programDuration!, id: `${hca}remainingprogramtime` } : null;
        const programProgress = d['programProgress'] !== undefined ? ref(p, d['programProgress'], join(path, 'programProgress'), defaultAdapter) : hca ? { ...programDuration!, id: `${hca}programprogress` } : null;
        const estimatedW = num(p, d, path, 'estimatedW', { min: 50, max: 10_000 });
        const latestStart = strOr(p, d, path, 'latestStart', '15:00');
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(latestStart)) p.error(join(path, 'latestStart'), 'moet een tijd zijn als "15:00"');
        if (id && name && remoteStart && estimatedW != null) {
          deferrables.push({
            id,
            name,
            remoteStart,
            estimatedW,
            latestStart,
            ...(operationState ? { operationState } : {}),
            ...(programDuration ? { programDuration } : {}),
            ...(remainingTime ? { remainingTime } : {}),
            ...(programProgress ? { programProgress } : {}),
          });
        }
      });
    }
  }

  // Helpen bij de cv (besluit 292). Optioneel; weg is bijspringen per zone (283).
  let cvHelp: CvHelp | null = null;
  if (input['cvHelp'] !== undefined) {
    const raw = blockOf(p, input['cvHelp'], 'cvHelp');
    if (raw) {
      const known = new Set(actuators.map((a) => a.id));
      const ids = (key: string, verplicht: boolean): string[] => {
        const lijst = raw[key] === undefined && !verplicht ? [] : arr(p, raw, 'cvHelp', key);
        if (!lijst) return [];
        const uit: string[] = [];
        lijst.forEach((x, i) => {
          if (typeof x !== 'string' || !known.has(x)) p.error(join(join('cvHelp', key), i), 'is geen apparaat uit de lijst');
          else uit.push(x);
        });
        return uit;
      };
      const boilerIds = ids('boilerIds', true);
      const off = ids('off', false);
      const prijs = (key: string, max: number): number | undefined => (raw[key] === undefined || raw[key] === null ? undefined : (num(p, raw, 'cvHelp', key, { min: 0, max }) ?? undefined));
      const gas = prijs('gasEurPerM3', 10);
      const stroom = prijs('electricityEurPerKwh', 5);
      cvHelp = {
        boilerIds,
        startDelayMinutes: numOr(p, raw, 'cvHelp', 'startDelayMinutes', HEAT_ASSIST_DEFAULTS.startDelayMinutes, { min: 0, max: 120 }),
        minShortfallC: numOr(p, raw, 'cvHelp', 'minShortfallC', HEAT_ASSIST_DEFAULTS.minShortfallC, { min: 0.1, max: 5 }),
        minRunMinutes: numOr(p, raw, 'cvHelp', 'minRunMinutes', CV_HELP_DEFAULTS.minRunMinutes, { min: 0, max: 240 }),
        minRestMinutes: numOr(p, raw, 'cvHelp', 'minRestMinutes', CV_HELP_DEFAULTS.minRestMinutes, { min: 0, max: 240 }),
        ...(off.length ? { off } : {}),
        ...(gas !== undefined ? { gasEurPerM3: gas } : {}),
        ...(stroom !== undefined ? { electricityEurPerKwh: stroom } : {}),
      };
    }
  }

  // Warmtebuffers, zoals een boiler of een jacuzzi (besluit 186). Optioneel.
  const heatStores: HeatStore[] = [];
  const heatStoresRaw = input['heatStores'];
  if (heatStoresRaw !== undefined) {
    if (!Array.isArray(heatStoresRaw)) {
      p.error('heatStores', 'moet een lijst zijn');
    } else {
      const seenStore = new Set<string>();
      heatStoresRaw.forEach((h, i) => {
        const path = join('heatStores', i);
        if (!isRecord(h)) {
          p.error(path, 'moet een object zijn');
          return;
        }
        const id = str(p, h, path, 'id');
        if (id && seenStore.has(id)) p.error(join(path, 'id'), `buffer "${id}" staat er twee keer`);
        if (id) seenStore.add(id);
        const name = str(p, h, path, 'name');
        const kind = oneOf(p, h, path, 'kind', HEAT_STORE_KINDS);
        const control = oneOf(p, h, path, 'control', HEAT_STORE_CONTROLS);
        const actuator = h['actuator'] === undefined ? (p.error(join(path, 'actuator'), 'ontbreekt'), null) : ref(p, h['actuator'], join(path, 'actuator'), defaultAdapter);
        const temperature = h['temperature'] === undefined ? null : measurementPoint(p, h['temperature'], join(path, 'temperature'), defaultAdapter);
        const power = h['power'] === undefined ? null : ref(p, h['power'], join(path, 'power'), defaultAdapter);
        // Wat een jacuzzi en een boiler meestal doen: de Intex trekt 2,2 kW en wint 1,5 tot 2,5° per uur.
        // Een stekker (besluit 264) kent geen temperatuur: de graden staan op nul en tellen niet.
        const stekker = kind === 'stekker';
        const std = kind === 'jacuzzi' ? { w: 2200, min: 30, zon: 38, rate: 1.5 } : stekker ? { w: 1000, min: 0, zon: 0, rate: 1 } : { w: 2000, min: 50, zon: 65, rate: 8 };
        const estimatedW = numOr(p, h, path, 'estimatedW', std.w, { min: 50, max: stekker ? 3_700 : 10_000 });
        const minC = stekker ? 0 : numOr(p, h, path, 'minC', std.min, { min: 5, max: 70 });
        const sunC = stekker ? 0 : numOr(p, h, path, 'sunC', std.zon, { min: 10, max: 85 });
        if (sunC < minC) p.error(join(path, 'sunC'), `moet minstens de ondergrens (${minC}) zijn`);
        if (kind === 'jacuzzi' && sunC > 40) p.error(join(path, 'sunC'), 'een jacuzzi gaat niet boven 40°');
        const heatRateCPerHour = numOr(p, h, path, 'heatRateCPerHour', std.rate, { min: 0.1, max: 60 });
        const legionellaC = h['legionellaC'] === undefined ? null : num(p, h, path, 'legionellaC', { min: 55, max: 75 });
        if (legionellaC != null && kind !== 'boiler') p.error(join(path, 'legionellaC'), 'alleen bij een boiler');
        if (control === 'setpoint' && temperature == null) p.error(join(path, 'temperature'), 'een doeltemperatuur zonder meting kan niet');
        if (stekker && control !== 'switch') p.error(join(path, 'control'), 'een stekker gaat aan en uit (switch)');
        if (stekker && temperature != null) p.error(join(path, 'temperature'), 'een stekker heeft geen temperatuur');
        // Een minimum per dag (besluit 267): minuten, en de tijd waarvoor.
        let minimum: { minutes: number; by: string } | null = null;
        const minRaw = h['minimum'];
        if (minRaw !== undefined) {
          const m = minRaw as Record<string, unknown> | null;
          if (!stekker) p.error(join(path, 'minimum'), 'alleen bij een stekker');
          else if (typeof m !== 'object' || m == null || Array.isArray(m)) p.error(join(path, 'minimum'), 'moet een object zijn');
          else {
            const minutes = num(p, m, join(path, 'minimum'), 'minutes', { min: 15, max: 1200 });
            const by = m['by'];
            if (typeof by !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(by)) p.error(join(join(path, 'minimum'), 'by'), 'een tijd als "22:00"');
            else if (minutes != null) minimum = { minutes: Math.round(minutes), by };
          }
        }
        if (id && name && kind && control && actuator) {
          heatStores.push({
            id,
            name,
            kind,
            control,
            actuator,
            estimatedW,
            minC,
            sunC,
            heatRateCPerHour,
            ...(temperature ? { temperature } : {}),
            ...(power ? { power } : {}),
            ...(legionellaC != null ? { legionellaC } : {}),
            ...(minimum ? { minimum } : {}),
          });
        }
      });
    }
  }

  // De volgorde op zon (besluit 176): zones en uitstelbare apparaten door elkaar. Optioneel.
  const sunOrder: SunSlot[] = [];
  const sunOrderRaw = input['sunOrder'];
  if (sunOrderRaw !== undefined) {
    if (!Array.isArray(sunOrderRaw)) {
      p.error('sunOrder', 'moet een lijst zijn');
    } else {
      const gezien = new Set<string>();
      sunOrderRaw.forEach((s, i) => {
        const path = join('sunOrder', i);
        if (!isRecord(s) || (s['kind'] !== 'zone' && s['kind'] !== 'deferrable' && s['kind'] !== 'heatStore') || typeof s['id'] !== 'string') {
          p.error(path, 'moet { kind: "zone", "deferrable" of "heatStore", id } zijn');
          return;
        }
        const kind = s['kind'];
        const id = s['id'];
        const bestaat = kind === 'zone' ? zones.some((z) => z.id === id) : kind === 'heatStore' ? heatStores.some((h) => h.id === id) : deferrables.some((d) => d.id === id);
        if (!bestaat) p.error(path, `${kind === 'zone' ? 'zone' : kind === 'heatStore' ? 'buffer' : 'apparaat'} "${id}" bestaat niet`);
        else if (gezien.has(`${kind}:${id}`)) p.error(path, `"${id}" staat er twee keer`);
        else {
          gezien.add(`${kind}:${id}`);
          sunOrder.push({ kind, id });
        }
      });
    }
  }

  // De aansluiting: stroom per fase tegen de hoofdzekering (besluit 78).
  // Optioneel; zonder blijft het alleen een vermogensbudget.
  let grid: GridLimits | null = null;
  const gridRawBlock = input['grid'];
  if (gridRawBlock !== undefined) {
    if (!isRecord(gridRawBlock)) {
      p.error('grid', 'moet een object zijn');
    } else {
      const phasesRaw = arr(p, gridRawBlock, 'grid', 'phases', { minLength: 1 });
      const phases: GridPhase[] = [];
      const seen = new Set<string>();
      (phasesRaw ?? []).forEach((f, i) => {
        const path = join('grid.phases', i);
        if (!isRecord(f)) {
          p.error(path, 'moet een object zijn');
          return;
        }
        const id = str(p, f, path, 'id');
        if (id && seen.has(id)) p.error(join(path, 'id'), `fase "${id}" staat er twee keer`);
        if (id) seen.add(id);
        // De stroom (A), of anders het vermogen (W) op die fase (23 november 2026); één van de twee.
        if (f['current'] === undefined && f['power'] === undefined) p.error(join(path, 'current'), 'ontbreekt (of power, het vermogen op deze fase)');
        if (f['current'] !== undefined && f['power'] !== undefined) p.error(join(path, 'power'), 'kies current of power, niet allebei');
        const current = f['current'] === undefined ? null : ref(p, f['current'], join(path, 'current'), defaultAdapter);
        const power = f['power'] === undefined ? null : ref(p, f['power'], join(path, 'power'), defaultAdapter);
        const voltage = f['voltage'] === undefined ? null : ref(p, f['voltage'], join(path, 'voltage'), defaultAdapter);
        const maxA = num(p, f, path, 'maxA', { min: 6, max: 250 });
        if (id && (current || power) && maxA != null) phases.push({ id, ...(current ? { current } : { power: power! }), maxA, ...(voltage ? { voltage } : {}) });
      });
      if (phases.length === 2 || phases.length > 3) p.error('grid.phases', 'een aansluiting heeft één of drie fasen');
      const marginA = numOr(p, gridRawBlock, 'grid', 'marginA', 2, { min: 0, max: 50 });
      if (phases.some((ph) => ph.maxA - marginA <= 0)) p.error('grid.marginA', 'de marge is groter dan de zekering');
      grid = { phases, marginA };
    }
  }

  // Hoe het huis en de panelen liggen (besluit 93). Optioneel, en zonder valt
  // alleen de zoninval weg; de regeling leest het niet.
  let geometry: Geometry | null = null;
  const geoRaw = input['geometry'];
  if (geoRaw !== undefined) {
    if (!isRecord(geoRaw)) {
      p.error('geometry', 'moet een object zijn');
    } else {
      const zoneIds = new Set(zones.map((z) => z.id));
      const facades: Facade[] = [];
      const facadesRaw = geoRaw['facades'] === undefined ? [] : arr(p, geoRaw, 'geometry', 'facades');
      (facadesRaw ?? []).forEach((f, i) => {
        const path = join('geometry.facades', i);
        if (!isRecord(f)) {
          p.error(path, 'moet een object zijn');
          return;
        }
        const id = str(p, f, path, 'id');
        const name = str(p, f, path, 'name');
        const azimuthDeg = num(p, f, path, 'azimuthDeg', { min: 0, max: 360 });
        const source = oneOfOr(p, f, path, 'source', GEOMETRY_SOURCES, 'schatting');
        const zs = f['zoneIds'] === undefined ? [] : arr(p, f, path, 'zoneIds');
        const ids: string[] = [];
        (zs ?? []).forEach((z, j) => {
          if (typeof z !== 'string' || !zoneIds.has(z)) {
            p.error(join(join(path, 'zoneIds'), j), `"${String(z)}" is geen zone`);
          } else ids.push(z);
        });
        if (id && name && azimuthDeg != null) facades.push({ id, name, azimuthDeg, zoneIds: ids, source });
      });
      const planes: SolarPlane[] = [];
      const planesRaw = geoRaw['solarPlanes'] === undefined ? [] : arr(p, geoRaw, 'geometry', 'solarPlanes');
      (planesRaw ?? []).forEach((f, i) => {
        const path = join('geometry.solarPlanes', i);
        if (!isRecord(f)) {
          p.error(path, 'moet een object zijn');
          return;
        }
        const id = str(p, f, path, 'id');
        const azimuthDeg = num(p, f, path, 'azimuthDeg', { min: 0, max: 360 });
        const tiltDeg = num(p, f, path, 'tiltDeg', { min: 0, max: 90 });
        const peakW = num(p, f, path, 'peakW', { min: 1 });
        const source = oneOfOr(p, f, path, 'source', GEOMETRY_SOURCES, 'schatting');
        if (id && azimuthDeg != null && tiltDeg != null && peakW != null) {
          planes.push({ id, azimuthDeg, tiltDeg, peakW, source });
        }
      });
      const inverterMaxW = num(p, geoRaw, 'geometry', 'inverterMaxW', { min: 1, optional: true });
      geometry = {
        facades,
        solarPlanes: planes,
        ...(inverterMaxW != null ? { inverterMaxW } : {}),
      };
    }
  }

  // Dezelfde behandeling voor de opbrengst van de zonnepanelen (besluit 47).
  const solarRaw = input['solarProduction'];
  const solarProduction =
    solarRaw === undefined ? null : measurementPoint(p, solarRaw, 'solarProduction', defaultAdapter);
  // Meer omvormers (testerronde, november 2026): een lijst meetpunten, opgeteld.
  const extraRaw = input['solarExtra'];
  const solarExtra: MeasurementPoint[] = [];
  if (extraRaw !== undefined) {
    if (!Array.isArray(extraRaw)) p.error('solarExtra', 'moet een lijst zijn');
    else if (solarProduction == null) p.error('solarExtra', 'meer omvormers zonder de eerste; noem eerst solarProduction');
    else extraRaw.forEach((x, i) => {
      const point = measurementPoint(p, x, `solarExtra.${i}`, defaultAdapter);
      if (point) solarExtra.push(point);
    });
  }
  if (solarRaw === undefined) {
    p.warn(
      'solarProduction',
      'ontbreekt; zonder de eigen opbrengst is er geen maat voor instraling, ' +
        'en kan het thermische model van fase 7 niet uitrekenen hoeveel de zon ' +
        'een kamer verwarmt',
    );
  }

  let migration: SiteConfig['migration'];
  const migrationRaw = input['migration'];
  if (migrationRaw !== undefined) {
    if (!isRecord(migrationRaw)) {
      p.error('migration', 'moet een object zijn');
    } else {
      const legacyRaw = migrationRaw['legacyExplanation'];
      const legacyExplanation =
        legacyRaw === undefined
          ? null
          : ref(p, legacyRaw, 'migration.legacyExplanation', defaultAdapter);

      // De helpers waarin de bewoner zijn setpoints zet in het oude systeem.
      // Per zone, per modus, verwarmen en/of koelen. Wat ontbreekt houdt de
      // waarde uit de configuratie zelf — dat is de betere terugval dan een
      // vast getal in de code, want die kon van de configuratie afwijken.
      let setpoints: NonNullable<SiteConfig['migration']>['setpoints'];
      const setpointsRaw = migrationRaw['setpoints'];
      if (setpointsRaw !== undefined) {
        if (!isRecord(setpointsRaw)) {
          p.error('migration.setpoints', 'moet een object zijn met een ingang per zone');
        } else {
          const result: Record<string, Partial<Record<Mode, { heat?: DeviceRef; cool?: DeviceRef }>>> =
            {};
          for (const [zoneId, perMode] of Object.entries(setpointsRaw)) {
            const zPath = join('migration.setpoints', zoneId);
            if (!zones.some((z) => z.id === zoneId)) {
              p.error(zPath, `verwijst naar zone "${zoneId}" die niet bestaat`);
              continue;
            }
            if (!isRecord(perMode)) {
              p.error(zPath, 'moet een object zijn met een ingang per modus');
              continue;
            }
            const modes: Partial<Record<Mode, { heat?: DeviceRef; cool?: DeviceRef }>> = {};
            for (const [mode, directions] of Object.entries(perMode)) {
              const mPath = join(zPath, mode);
              if (!(MODES as readonly string[]).includes(mode)) {
                p.error(mPath, `"${mode}" is geen bekende modus`);
                continue;
              }
              if (!isRecord(directions)) {
                p.error(mPath, 'moet een object zijn met heat en/of cool');
                continue;
              }
              const heat =
                directions['heat'] === undefined
                  ? null
                  : ref(p, directions['heat'], join(mPath, 'heat'), defaultAdapter);
              const cool =
                directions['cool'] === undefined
                  ? null
                  : ref(p, directions['cool'], join(mPath, 'cool'), defaultAdapter);
              if (heat || cool) {
                modes[mode as Mode] = { ...(heat ? { heat } : {}), ...(cool ? { cool } : {}) };
              }
            }
            if (Object.keys(modes).length > 0) result[zoneId] = modes;
          }
          if (Object.keys(result).length > 0) setpoints = result;
        }
      }

      let migrationPower: NonNullable<SiteConfig['migration']>['power'];
      const mPowerRaw = migrationRaw['power'];
      if (mPowerRaw !== undefined) {
        if (!isRecord(mPowerRaw)) {
          p.error('migration.power', 'moet een object zijn');
        } else {
          const start =
            mPowerRaw['startSurplusW'] === undefined
              ? null
              : ref(p, mPowerRaw['startSurplusW'], 'migration.power.startSurplusW', defaultAdapter);
          const stop =
            mPowerRaw['stopImportW'] === undefined
              ? null
              : ref(p, mPowerRaw['stopImportW'], 'migration.power.stopImportW', defaultAdapter);
          if (start || stop) {
            migrationPower = {
              ...(start ? { startSurplusW: start } : {}),
              ...(stop ? { stopImportW: stop } : {}),
            };
          }
        }
      }

      migration = {
        ...(legacyExplanation ? { legacyExplanation } : {}),
        ...(setpoints ? { setpoints } : {}),
        ...(migrationPower ? { power: migrationPower } : {}),
      };
    }
  }

  /*
   * Degraderen in plaats van stilvallen.
   *
   * `pv-surplus` is de enige strategie die vermogen claimt, en de enige die
   * een netmeting nodig heeft. Zonder meter zou hij blijven draaien op een
   * gridPowerW van nul: een budget van `stopImportW`, vijftig watt, waar niets
   * op start. Dat is geen werkende regeling maar een stille.
   *
   * Hetzelfde voor de zon: die staat in dienst van dezelfde strategie.
   */
  const hasMeter = power?.gridPower != null;
  if (!hasMeter && enabledStrategies.includes('pv-surplus')) {
    const i = enabledStrategies.indexOf('pv-surplus');
    enabledStrategies.splice(i, 1);
    p.warn(
      'power.gridPower',
      'ontbreekt; zonder netmeting valt pv-surplus weg. Comfort en heat-assist ' +
        'werken gewoon door — die vragen geen vermogen.',
    );
  }
  if (hasMeter && sun == null && enabledStrategies.includes('pv-surplus')) {
    p.warn(
      'sun',
      'ontbreekt; pv-surplus kan dan bij nacht niet zien dat een gemeten ' +
        'overschot niet van de zon komt',
    );
  }

  checkCoherence(p, { zones, actuators, enabledStrategies }, knownStrategies);

  /*
   * Wat er echt niet zonder kan.
   *
   * Drie dingen. Een tijdzone, want zonder die verschuift de hele dagindeling
   * zonder dat iemand het merkt. Minstens één zone, want anders is er niets om
   * te regelen. En minstens één apparaat, want anders is er niets om mee te
   * regelen. Al het andere heeft hierboven een terugval gekregen.
   *
   * `power` en `schedule` staan er nog wel bij, maar die zijn nu altijd
   * gevuld — ze kunnen alleen nog null zijn wanneer er een échte fout in
   * stond, en dan staat die fout al in `errors`.
   */
  const errors = p.errors;
  // Zonder zones en apparaten is het een huis zonder slimme regeling (besluit 194): dat mag.
  const incomplete = !timezone || !power || !schedule;

  if (errors.length > 0 || incomplete) {
    const problems: ConfigProblem[] =
      errors.length > 0
        ? errors
        : [{ path: '', message: 'de configuratie is onvolledig', severity: 'error' }];
    return { ok: false, problems };
  }

  return {
    ok: true,
    config: {
      id,
      timezone,
      zones,
      actuators,
      power: power as Power,
      occupancy,
      ...(profiles.length > 0 ? { profiles } : {}),
      ...(profileHold ? { profileHold } : {}),
      schedule: schedule as Schedule,
      enabledStrategies,
      criticalInputs,
      ...(mode ? { mode } : {}),
      ...(timers ? { timers } : {}),
      ...(sun ? { sun } : {}),
      ...(outdoorTemperature ? { outdoorTemperature } : {}),
      ...(solarProduction ? { solarProduction } : {}),
      ...(solarProduction && solarExtra.length ? { solarExtra } : {}),
      ...(geometry ? { geometry } : {}),
      ...(grid ? { grid } : {}),
      ...(deferrables.length > 0 ? { deferrables } : {}),
      ...(heatStores.length > 0 ? { heatStores } : {}),
      ...(cvHelp ? { cvHelp } : {}),
      ...(sunOrder.length > 0 ? { sunOrder } : {}),
      ...(recordOnly && recordOnly.length > 0 ? { recordOnly } : {}),
      ...(migration ? { migration } : {}),
    },
    warnings: p.warnings,
  };
}

/** Zet problemen om naar regels die je aan een mens kunt laten zien. */
export function formatProblems(problems: readonly ConfigProblem[]): string[] {
  return problems.map((p) => `  ${p.path === '' ? '(configuratie)' : p.path}: ${p.message}`);
}
