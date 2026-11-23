/*
 * De indeling van het huis lezen: de onderdelen (22 november 2026, opgesplitst uit config/schema.ts).
 *
 * Een klimaatapparaat, wat erop gemonteerd is, een zone, en of alles samen klopt.
 */
import { MODES, type Actuator, type ActuatorRole, type MeasurementPoint, type Mode, type SetpointPair, type ThermalMass, type Zone } from '../core/model.js';
import { HEAT_ASSIST_DEFAULTS } from '../core/strategies/heatAssist.js';
import { Problems, type SetpointOutcome, arr, blockOf, bool, boolOr, isRecord, join, measurementPoint, num, numOr, oneOfOr, ref, setpoints, str, strOr } from './schema-velden.js';

const THERMAL_MASS: readonly ThermalMass[] = ['low', 'medium', 'high'];
const ROLES: readonly ActuatorRole[] = ['primary', 'assist'];

export function actuator(
  p: Problems,
  value: unknown,
  path: string,
  defaultAdapter: string,
): Actuator | null {
  if (!isRecord(value)) {
    p.error(path, 'moet een object zijn');
    return null;
  }
  const id = str(p, value, path, 'id');
  // Zonder naam is de id de naam. Een label is geen reden om niet te starten.
  const name = strOr(p, value, path, 'name', id ?? '');
  const refValue = ref(p, value['ref'], join(path, 'ref'), defaultAdapter);
  // `primary` is de behoudende aanname: het apparaat regelt zijn zone gewoon.
  // `assist` is de bijzondere rol — opportunistisch meedraaien op overschot —
  // en die kies je bewust.
  const role = oneOfOr(p, value, path, 'role', ROLES, 'primary');

  const capsRaw = value['capabilities'];
  let capabilities: Actuator['capabilities'] | null = null;
  if (!isRecord(capsRaw)) {
    p.error(join(path, 'capabilities'), 'ontbreekt of is geen object');
  } else {
    const cPath = join(path, 'capabilities');
    const canHeat = bool(p, capsRaw, cPath, 'canHeat');
    const canCool = bool(p, capsRaw, cPath, 'canCool');
    // Het bereik begrenst wat we naar het apparaat zouden sturen. Ontbreekt
    // het, dan nemen we de ruimste band die dit schema überhaupt toestaat: het
    // apparaat kapt zelf af, en te ruim raden kost hooguit een genegeerde
    // opdracht. Te krap raden zou juist regelruimte weggooien.
    const rangeRaw = capsRaw['setpointRange'];
    let min: number | null = rangeRaw === undefined ? 5 : null;
    let max: number | null = rangeRaw === undefined ? 35 : null;
    if (rangeRaw === undefined) {
      p.warn(
        join(cPath, 'setpointRange'),
        'ontbreekt; er wordt gerekend met 5-35 °C, wat ruimer is dan de meeste apparaten aankunnen',
      );
    }
    const range = rangeRaw === undefined ? null : arr(p, capsRaw, cPath, 'setpointRange');
    if (range) {
      if (range.length !== 2) {
        p.error(join(cPath, 'setpointRange'), 'moet precies twee getallen bevatten: [min, max]');
      } else {
        const [a, b] = range;
        if (typeof a !== 'number' || typeof b !== 'number') {
          p.error(join(cPath, 'setpointRange'), 'moet twee getallen bevatten');
        } else if (a >= b) {
          p.error(join(cPath, 'setpointRange'), `min ${a} moet kleiner zijn dan max ${b}`);
        } else {
          min = a;
          max = b;
        }
      }
    }
    let standby: { heat: number; cool: number } | undefined;
    const standbyRaw = capsRaw['standby'];
    if (standbyRaw !== undefined) {
      if (!isRecord(standbyRaw)) {
        p.error(join(cPath, 'standby'), 'moet een object zijn met heat en cool');
      } else {
        const sPath = join(cPath, 'standby');
        const h = num(p, standbyRaw, sPath, 'heat', { min: 5, max: 35 });
        const c = num(p, standbyRaw, sPath, 'cool', { min: 5, max: 35 });
        if (h != null && c != null) {
          if (h >= c) {
            p.error(
              sPath,
              `standby verwarmen op ${h} en koelen op ${c} klopt niet; ` +
                'verwarmen hoort naar beneden geduwd te worden en koelen naar boven',
            );
          } else {
            standby = { heat: h, cool: c };
            if (min != null && max != null && (h < min || c > max)) {
              p.error(
                sPath,
                `standby ${h}/${c} valt buiten het bereik ${min}-${max} van het apparaat`,
              );
            }
          }
        }
      }
    }
    if (canHeat != null && canCool != null && min != null && max != null) {
      if (!canHeat && !canCool) {
        p.error(cPath, 'een apparaat dat niet kan verwarmen en niet kan koelen doet niets');
      }
      capabilities = {
        canHeat,
        canCool,
        setpointRange: [min, max],
        ...(standby ? { standby } : {}),
      };
    }
  }

  /*
   * Het vermogen mag ontbreken — behalve bij een assist-apparaat.
   *
   * Voor een `primary` doet het niet mee: comfort vraagt `budgetW: 0` en wordt
   * nooit door het budget tegengehouden. Voor een `assist` is het de hele
   * grondslag: `pv-surplus` verdeelt overschot en een apparaat dat 0 W claimt
   * past altijd, hoe weinig er ook over is. Dat is de gevaarlijke richting, en
   * daarom blijft het daar verplicht.
   */
  const pPath = join(path, 'power');
  const powerRaw = blockOf(p, value['power'], pPath);
  let power: Actuator['power'] | null = null;
  if (powerRaw) {
    const given = powerRaw['estimatedW'] !== undefined;
    if (!given && role === 'assist') {
      p.error(
        join(pPath, 'estimatedW'),
        'ontbreekt; een assist-apparaat verdeelt overschot en een apparaat ' +
          'zonder vermogen past altijd, hoe weinig er ook over is',
      );
    } else {
      const estimatedW = numOr(p, powerRaw, pPath, 'estimatedW', 0, { min: 0, max: 50_000 });
      const sensorRaw = powerRaw['sensor'];
      const sensor =
        sensorRaw === undefined ? null : ref(p, sensorRaw, join(pPath, 'sensor'), defaultAdapter);
      // Het typeplaatje (besluit 178): voor de hoofdzekering, los van het budget.
      const ratedW = powerRaw['ratedW'] === undefined ? null : num(p, powerRaw, pPath, 'ratedW', { min: 1, max: 50_000 });
      power = { estimatedW, ...(sensor ? { sensor } : {}), ...(ratedW != null ? { ratedW } : {}) };
    }
  }

  // Draaitijden beschermen het apparaat tegen klapperen. Ontbreken ze, dan
  // zijn deze waarden gebruikelijk en aan de veilige kant.
  const tPath = join(path, 'timing');
  const timingRaw = blockOf(p, value['timing'], tPath);
  let timing: Actuator['timing'] | null = null;
  if (timingRaw) {
    timing = {
      minRunMinutes: numOr(p, timingRaw, tPath, 'minRunMinutes', 10, { min: 0, max: 240 }),
      minRestMinutes: numOr(p, timingRaw, tPath, 'minRestMinutes', 5, { min: 0, max: 240 }),
      settleMinutes: numOr(p, timingRaw, tPath, 'settleMinutes', 2, { min: 0, max: 60 }),
    };
  }

  // Ook op zon (besluit 132): net als een assist alleen met een vermogen, anders past hij altijd.
  const onSurplusRaw = value['onSurplus'];
  let onSurplus = false;
  if (onSurplusRaw !== undefined) {
    if (typeof onSurplusRaw !== 'boolean') p.error(join(path, 'onSurplus'), 'is waar of onwaar');
    else onSurplus = onSurplusRaw;
  }
  if (onSurplus && power && power.estimatedW <= 0) {
    p.error(join(join(path, 'power'), 'estimatedW'), 'ontbreekt; een apparaat dat op zon mag, verdeelt overschot en heeft een vermogen nodig');
  }

  if (!id || !name || !refValue || !role || !capabilities || !power || !timing) return null;
  return { id, name, ref: refValue, role, capabilities, power, timing, ...(onSurplus ? { onSurplus: true } : {}) };
}

/*
 * Ingevulde setpoints binnen bereik van de apparaten brengen.
 *
 * De standaardwaarden zijn vaste getallen — vakantie op 12 °C — maar of die
 * haalbaar zijn hangt af van wat er in de kamer hangt. Een airco die pas bij
 * 16 begint, haalt 12 nooit, en de samenhangscontrole wees zo'n configuratie
 * terecht af. Die controle is goed; het waren de standaardwaarden die niet
 * wisten waar ze terechtkwamen.
 *
 * Twee dingen gebeuren hier, en allebei alleen voor wat wij zelf hebben
 * ingevuld. Wat de bewoner opschrijft blijft staan en mag gerust een fout
 * opleveren: dan is er iets anders aan de hand dan een gok van ons.
 *
 *  - een verwarmingsdoel dat buiten het bereik valt wordt erin geschoven;
 *  - een verwarmingsdoel in een zone die niet kan verwarmen verdwijnt. Er
 *    blijft dan niets over, en de zone doet niets — wat eerlijker is dan
 *    een koeldoel verzinnen dat wij hebben bedacht.
 */
function fitted(
  p: Problems,
  parsed: SetpointOutcome,
  path: string,
  actuatorIds: readonly string[],
  actuators: ReadonlyMap<string, Actuator>,
): Record<Mode, SetpointPair> {
  const inZone = actuatorIds.map((id) => actuators.get(id)).filter((a): a is Actuator => a != null);
  if (inZone.length === 0 || parsed.filled.size === 0) return parsed.points;

  const canHeat = inZone.filter((a) => a.capabilities.canHeat);
  const out = { ...parsed.points };

  if (canHeat.length === 0) {
    let removed = 0;
    for (const mode of parsed.filled) {
      if (out[mode].heat != null) {
        out[mode] = { ...out[mode] };
        delete (out[mode] as { heat?: number }).heat;
        removed += 1;
      }
    }
    if (removed > 0) {
      p.warn(
        join(path, 'setpoints'),
        'geen enkel apparaat in deze zone kan verwarmen, dus de ingevulde ' +
          'verwarmingsdoelen zijn weggelaten. Zet zelf een koeldoel als je wilt ' +
          'dat hier iets gebeurt — koelen verzinnen wij niet.',
      );
    }
    return out;
  }

  const lowest = Math.min(...canHeat.map((a) => a.capabilities.setpointRange[0]));
  const highest = Math.max(...canHeat.map((a) => a.capabilities.setpointRange[1]));
  let shifted = 0;
  for (const mode of parsed.filled) {
    const heat = out[mode].heat;
    if (heat == null) continue;
    const inside = Math.min(highest, Math.max(lowest, heat));
    if (inside !== heat) {
      out[mode] = { ...out[mode], heat: inside };
      shifted += 1;
    }
  }
  if (shifted > 0) {
    p.warn(
      join(path, 'setpoints'),
      shifted === 1
        ? `één ingevuld verwarmingsdoel viel buiten het bereik ${lowest}-${highest} °C ` +
          'van de apparaten en is erin geschoven'
        : `${shifted} ingevulde verwarmingsdoelen vielen buiten het bereik ` +
          `${lowest}-${highest} °C van de apparaten en zijn erin geschoven`,
    );
  }
  return out;
}

export function zone(
  p: Problems,
  value: unknown,
  path: string,
  defaultAdapter: string,
  /** Positie in de lijst, als terugval voor `priority`. */
  order: number,
  /** De al gelezen apparaten, om ingevulde setpoints haalbaar te houden. */
  actuators: ReadonlyMap<string, Actuator>,
): Zone | null {
  if (!isRecord(value)) {
    p.error(path, 'moet een object zijn');
    return null;
  }
  const id = str(p, value, path, 'id');
  const name = strOr(p, value, path, 'name', id ?? '');
  const temperature = measurementPoint(p, value['temperature'], join(path, 'temperature'), defaultAdapter);
  // Meer sensoren voor één zone (besluit 123): de gemiddelde temperatuur.
  const temperaturesRaw = value['temperatures'];
  let temperatures: MeasurementPoint[] | null = null;
  if (temperaturesRaw !== undefined) {
    if (!Array.isArray(temperaturesRaw) || temperaturesRaw.length === 0 || temperaturesRaw.length > 6) {
      p.error(join(path, 'temperatures'), 'moet een lijst van 1 tot 6 meetpunten zijn');
    } else {
      temperatures = [];
      temperaturesRaw.forEach((t, i) => {
        const m = measurementPoint(p, t, join(join(path, 'temperatures'), i), defaultAdapter);
        if (m) temperatures!.push(m);
      });
    }
  }
  const humidityRaw = value['humidity'];
  const humidity =
    humidityRaw === undefined
      ? null
      : measurementPoint(p, humidityRaw, join(path, 'humidity'), defaultAdapter);

  const idsRaw = arr(p, value, path, 'actuatorIds', { minLength: 1 });
  const actuatorIds: string[] = [];
  idsRaw?.forEach((v, i) => {
    if (typeof v !== 'string' || v.trim() === '') {
      p.error(join(join(path, 'actuatorIds'), i), 'moet een actuator-id zijn');
    } else {
      actuatorIds.push(v);
    }
  });

  // Zonder opgegeven volgorde telt de volgorde in het bestand. Dat is wat een
  // lezer ook zou aannemen.
  const priority = numOr(p, value, path, 'priority', order, {
    min: 1,
    max: 999,
    integer: true,
  });
  // Voorrang per richting (besluit 134); weg is `priority`.
  const pbaRaw = value['priorityByAction'];
  let priorityByAction: { heat?: number; cool?: number } | undefined;
  if (pbaRaw !== undefined) {
    const pPath = join(path, 'priorityByAction');
    const blok = blockOf(p, pbaRaw, pPath);
    if (blok) {
      const heat = blok['heat'] === undefined ? undefined : numOr(p, blok, pPath, 'heat', priority ?? order, { min: 1, max: 999, integer: true });
      const cool = blok['cool'] === undefined ? undefined : numOr(p, blok, pPath, 'cool', priority ?? order, { min: 1, max: 999, integer: true });
      priorityByAction = { ...(heat != null ? { heat } : {}), ...(cool != null ? { cool } : {}) };
    }
  }
  // `medium` raakt niemand hard: het bepaalt hoe ver vooruit er geladen mag
  // worden, en dat staat standaard toch uit.
  const thermalMass = oneOfOr(p, value, path, 'thermalMass', THERMAL_MASS, 'medium');

  // Een gebruikelijke schakelband. Verkeerd geraden kost comfort, geen
  // veiligheid — precies het soort keuze dat een standaardwaarde verdient.
  const hPath = join(path, 'hysteresis');
  const hystRaw = blockOf(p, value['hysteresis'], hPath);
  let hysteresis: Zone['hysteresis'] | null = null;
  if (hystRaw) {
    const onDelta = numOr(p, hystRaw, hPath, 'onDelta', 0.3, { min: 0, max: 5 });
    const offDelta = numOr(p, hystRaw, hPath, 'offDelta', 0.2, { min: 0, max: 5 });
    {
      if (onDelta + offDelta === 0) {
        p.error(
          hPath,
          'een band van nul graden laat het apparaat klapperen; geef onDelta of offDelta een waarde',
        );
      } else {
        hysteresis = { onDelta, offDelta };
        if (onDelta + offDelta < 0.2) {
          p.warn(hPath, `een band van ${onDelta + offDelta} °C is erg smal en kan tot vaak schakelen leiden`);
        }
      }
    }
  }

  /*
   * Het comfortplafond (besluit 50). Geen standaardwaarde: koelen op netstroom
   * is een keuze en niet iets om voor iemand aan te nemen. Weglaten houdt het
   * gedrag zoals het was.
   */
  const comfortMaxC = num(p, value, path, 'comfortMaxC', {
    min: 5,
    max: 35,
    optional: true,
  });

  // Voorladen staat standaard uit. Aanzetten is een keuze, geen aanname.
  const bPath = join(path, 'buffering');
  const bufRaw = blockOf(p, value['buffering'], bPath);
  let buffering: Zone['buffering'] | null = null;
  if (bufRaw) {
    const enabled = boolOr(p, bufRaw, bPath, 'enabled', false);
    const bandC = numOr(p, bufRaw, bPath, 'bandC', 0, { min: 0, max: 5 });
    {
      buffering = { enabled, bandC };
      if (enabled && bandC === 0) {
        p.warn(bPath, 'buffering staat aan maar de band is nul, dus er wordt niets voorgeladen');
      }
    }
  }

  // Bijspringen per zone (besluit 283); weg is de standaard van heat-assist.
  const haPath = join(path, 'heatAssist');
  const haRaw = value['heatAssist'] === undefined ? null : blockOf(p, value['heatAssist'], haPath);
  const heatAssist: Zone['heatAssist'] | null = haRaw
    ? {
        enabled: boolOr(p, haRaw, haPath, 'enabled', true),
        startDelayMinutes: numOr(p, haRaw, haPath, 'startDelayMinutes', HEAT_ASSIST_DEFAULTS.startDelayMinutes, { min: 0, max: 120 }),
        minShortfallC: numOr(p, haRaw, haPath, 'minShortfallC', HEAT_ASSIST_DEFAULTS.minShortfallC, { min: 0.1, max: 5 }),
      }
    : null;

  const parsed = setpoints(p, value['setpoints'], join(path, 'setpoints'));
  const points = parsed == null ? null : fitted(p, parsed, path, actuatorIds, actuators);

  /*
   * Een plafond onder het koeldoel is tegenstrijdig.
   *
   * Het plafond is de grens die comfort desnoods op netstroom verdedigt; het
   * koeldoel is waar op eigen stroom naartoe geladen wordt. Ligt het plafond
   * eronder, dan zou de zuinige regel strenger zijn dan de dure — en dan koelt
   * hij altijd op netstroom, wat precies niet de bedoeling is. Een waarschuwing
   * en geen fout: de installatie werkt, hij kost alleen geld.
   */
  if (comfortMaxC != null && points != null) {
    for (const [mode, pair] of Object.entries(points)) {
      if (pair.cool != null && comfortMaxC <= pair.cool) {
        p.warn(
          join(path, 'comfortMaxC'),
          `${comfortMaxC} ligt niet boven het koeldoel van ${pair.cool} in modus ${mode}; ` +
            'het plafond hoort losser te staan dan het doel, anders koelt hij altijd op netstroom',
        );
      }
    }
  }

  if (
    !id ||
    !name ||
    !temperature ||
    actuatorIds.length === 0 ||
    priority == null ||
    !thermalMass ||
    !hysteresis ||
    !buffering ||
    !points
  ) {
    return null;
  }
  return {
    id,
    name,
    temperature,
    ...(temperatures && temperatures.length ? { temperatures } : {}),
    ...(humidity ? { humidity } : {}),
    actuatorIds,
    priority,
    ...(priorityByAction && Object.keys(priorityByAction).length ? { priorityByAction } : {}),
    thermalMass,
    hysteresis,
    buffering,
    setpoints: points,
    ...(comfortMaxC == null ? {} : { comfortMaxC }),
    ...(heatAssist ? { heatAssist } : {}),
  };
}

/** Controles die pas kunnen als alle onderdelen gelezen zijn. */
export function checkCoherence(
  p: Problems,
  config: {
    zones: readonly Zone[];
    actuators: readonly Actuator[];
    enabledStrategies: readonly string[];
  },
  knownStrategies: readonly string[],
): void {
  const seenActuators = new Set<string>();
  config.actuators.forEach((a, i) => {
    if (seenActuators.has(a.id)) {
      p.error(`actuators[${i}].id`, `"${a.id}" komt meer dan één keer voor`);
    }
    seenActuators.add(a.id);
  });

  const seenZones = new Set<string>();
  config.zones.forEach((z, i) => {
    if (seenZones.has(z.id)) {
      p.error(`zones[${i}].id`, `"${z.id}" komt meer dan één keer voor`);
    }
    seenZones.add(z.id);
  });

  const claimed = new Map<string, string>();
  config.zones.forEach((z, zi) => {
    z.actuatorIds.forEach((id, ai) => {
      const path = `zones[${zi}].actuatorIds[${ai}]`;
      const found = config.actuators.find((a) => a.id === id);
      if (!found) {
        const near = [...seenActuators].filter(
          (k) => k.startsWith(id.slice(0, 3)) || id.startsWith(k.slice(0, 3)),
        );
        p.error(
          path,
          `zone "${z.id}" verwijst naar actuator "${id}", die niet bestaat` +
            (near.length > 0 ? `. Bedoelde je ${near.map((n) => `"${n}"`).join(' of ')}?` : ''),
        );
        return;
      }
      const other = claimed.get(id);
      if (other && other !== z.id) {
        p.error(path, `actuator "${id}" hoort al bij zone "${other}"`);
      }
      claimed.set(id, z.id);

    });

    // Een setpoint dat geen enkel apparaat kan halen wordt door de arbiter
    // afgewezen, en dan gebeurt er stilletjes niets.
    //
    // Let op de formulering: geen énkel apparaat. Een zone mag apparaten met
    // verschillende bereiken bevatten, en dan hoeft niet ieder van hen elk doel
    // te kunnen halen. De woonkamer heeft een ketel die tot 12 °C zakt en een
    // airco die bij 16 °C ophoudt; in vakantiestand is 12 °C precies de
    // bedoeling, en krijgt de airco geen opdracht. Alleen als niemand het kan,
    // is het een fout.
    const devices = z.actuatorIds
      .map((id) => config.actuators.find((a) => a.id === id))
      .filter((a): a is Actuator => a != null);

    for (const mode of MODES) {
      const pair = z.setpoints[mode];
      for (const [kind, target] of [
        ['heat', pair.heat],
        ['cool', pair.cool],
      ] as const) {
        if (target == null) continue;
        const capable = devices.filter((a) =>
          kind === 'heat' ? a.capabilities.canHeat : a.capabilities.canCool,
        );
        if (capable.length === 0) {
          p.error(
            `zones[${zi}].setpoints.${mode}.${kind}`,
            `zone "${z.id}" heeft geen apparaat dat kan ${kind === 'heat' ? 'verwarmen' : 'koelen'}`,
          );
          continue;
        }
        const reachable = capable.filter((a) => {
          const [lo, hi] = a.capabilities.setpointRange;
          return target >= lo && target <= hi;
        });
        if (reachable.length === 0) {
          const ranges = capable
            .map((a) => `"${a.name}" (${a.capabilities.setpointRange.join('-')})`)
            .join(', ');
          p.error(
            `zones[${zi}].setpoints.${mode}.${kind}`,
            `${target} °C is voor geen enkel apparaat in deze zone haalbaar: ${ranges}`,
          );
        }
      }
    }

    const roles = z.actuatorIds
      .map((id) => config.actuators.find((a) => a.id === id))
      .filter((a): a is Actuator => a != null);
    if (roles.length > 0 && roles.every((a) => a.role === 'assist')) {
      p.warn(
        `zones[${zi}]`,
        `zone "${z.id}" heeft alleen assist-apparaten; comfort regelt deze zone dan niet`,
      );
    }
  });

  for (const actuator of config.actuators) {
    if (!claimed.has(actuator.id)) {
      p.warn(
        'actuators',
        `actuator "${actuator.id}" hoort bij geen enkele zone en wordt dus nooit aangestuurd`,
      );
    }
  }

  config.enabledStrategies.forEach((id, i) => {
    if (!knownStrategies.includes(id)) {
      p.error(
        `enabledStrategies[${i}]`,
        `strategie "${id}" bestaat niet; beschikbaar zijn ${knownStrategies.join(', ')}`,
      );
    }
  });
  const seenStrategies = new Set<string>();
  config.enabledStrategies.forEach((id, i) => {
    if (seenStrategies.has(id)) {
      p.error(`enabledStrategies[${i}]`, `"${id}" staat er twee keer in`);
    }
    seenStrategies.add(id);
  });
}
