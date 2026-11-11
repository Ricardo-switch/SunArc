/**
 * Heat-assist: de warmtepomp helpt de hoofdverwarming.
 *
 * De regel komt uit de YAML-versie: stookt de ketel al een tijd onafgebroken en
 * loopt de zone nog steeds meetbaar achter, dan springt de airco bij, want die
 * haalt zijn warmte goedkoper uit de buitenlucht dan de ketel uit gas.
 *
 * De startvertraging is het hart ervan. Zonder die eis zou de airco meestarten
 * bij elke korte warmtevraag, wat juist duurder uitpakt: een warmtepomp die om
 * de tien minuten aanslaat verliest meer aan opstarten dan hij aan rendement
 * wint. Daarom telt niet of de ketel áán staat, maar of hij daadwerkelijk
 * staat te stoken — `producing`, niet `action`.
 *
 * Anders dan pv-surplus vraagt deze strategie geen vermogensbudget: bijstoken
 * gebeurt omdat het huis koud is, niet omdat de zon schijnt. Wel verliest hij
 * van comfort, zodat de primary altijd voorgaat.
 */

import type { DecisionContext } from '../context.js';
import type { Intent } from '../decision.js';
import { actuatorById, type CvHelp } from '../model.js';
import { minutesSinceChange, producingMinutes } from '../state.js';
import type { Strategy } from '../strategy.js';

export interface HeatAssistOptions {
  /**
   * Hoe lang de hoofdverwarming onafgebroken moet stoken voordat de airco
   * bijspringt. Kwam overeen met `input_number.airco_assist_start_na_min`.
   */
  readonly startDelayMinutes: number;
  /**
   * Hoeveel de zone minstens onder het doel moet zitten. Kwam overeen met
   * `input_number.airco_assist_delta_min`.
   */
  readonly minShortfallC: number;
}

/**
 * Overgenomen van het eerste huis, en bewust zo gelaten als algemene
 * standaard (besluit 204): vijf minuten en een halve graad is voorzichtig
 * genoeg voor een huis dat de app nog niet kent.
 */
export const HEAT_ASSIST_DEFAULTS: HeatAssistOptions = {
  startDelayMinutes: 5,
  minShortfallC: 0.5,
};

/**
 * Modi waarin bijstoken niet aan de orde is.
 *
 * Voorverwarmen hoort erbij (besluit 281), net als in de YAML-versie, die de
 * assist alleen in de dagstand toeliet. Een airco piept bij het aanslaan, en
 * om zes uur 's ochtends maakt dat de slapers wakker. Voorverwarmen doet dan
 * alleen de ketel.
 */
const PASSIVE_MODES = new Set(['nacht', 'vakantie', 'afwezig', 'voorverwarmen']);

/** Helpen bij de cv (besluit 292): lange beurten sparen de pomp. */
export const CV_HELP_DEFAULTS = { minRunMinutes: 30, minRestMinutes: 15 } as const;

/** Hoeveel kWh warmte een ketel uit een m³ gas haalt (besluit 289). */
export const KETEL_KWH_PER_M3 = 8.8;

/**
 * Hoeveel kWh warmte een airco per kWh stroom geeft, per buitentemperatuur
 * (besluit 289): een tabel tot de app het van de eigen airco's geleerd heeft.
 * Daartussen rechte lijnen; erbuiten de rand.
 */
const COP_TABEL: readonly (readonly [number, number])[] = [
  [-15, 1.75],
  [-7, 2.2],
  [0, 2.8],
  [7, 3.5],
  [15, 4.2],
];

export function copBij(buitenC: number): number {
  const eerste = COP_TABEL[0]!;
  const laatste = COP_TABEL[COP_TABEL.length - 1]!;
  if (buitenC <= eerste[0]) return eerste[1];
  if (buitenC >= laatste[0]) return laatste[1];
  for (let i = 1; i < COP_TABEL.length; i++) {
    const [t1, c1] = COP_TABEL[i]!;
    const [t0, c0] = COP_TABEL[i - 1]!;
    if (buitenC <= t1) return c0 + ((buitenC - t0) / (t1 - t0)) * (c1 - c0);
  }
  return laatste[1];
}

/**
 * Wat een kWh warmte nu kost, van de airco en van de ketel, in euro. Null
 * zolang de prijzen of de buitentemperatuur er niet zijn: dan vergelijkt de
 * regel niet, en helpt de airco zoals eerder.
 */
export function warmtePrijs(help: CvHelp, buitenC: number | null): { readonly airco: number; readonly ketel: number; readonly cop: number } | null {
  if (help.gasEurPerM3 == null || help.electricityEurPerKwh == null || buitenC == null) return null;
  const cop = copBij(buitenC);
  return { airco: help.electricityEurPerKwh / cop, ketel: help.gasEurPerM3 / KETEL_KWH_PER_M3, cop };
}

/**
 * Helpen bij de cv (besluit 292), voor het hele huis: elke airco die helpt
 * kijkt naar zijn eigen kamer. Hij begint als de ketel al een tijd stookt, zijn
 * kamer te koud is en hij goedkoper is; hij stopt pas als zijn kamer op
 * temperatuur is, ook als de ketel al stopte. Eenmaal aan blijft hij minstens
 * een half uur aan, en daarna een kwartier uit: dat spaart de pomp.
 */
function cvHelpIntents(ctx: DecisionContext, help: CvHelp): Intent[] {
  const ketelStookt = help.boilerIds.some((id) => {
    const s = ctx.state.actuators[id];
    return s != null && producingMinutes(s, ctx.nowMs) >= help.startDelayMinutes;
  });
  const buiten = ctx.state.outdoorTemperatureC.ok ? ctx.state.outdoorTemperatureC.value : null;
  const prijs = warmtePrijs(help, buiten);
  const goedkoper = prijs == null || prijs.airco < prijs.ketel;
  const uit = new Set(help.off ?? []);
  const intents: Intent[] = [];
  for (const actuator of ctx.config.actuators) {
    if (actuator.role !== 'assist' || !actuator.capabilities.canHeat || uit.has(actuator.id)) continue;
    const eigen = ctx.zones.find((z) => z.zone.actuatorIds.includes(actuator.id));
    if (!eigen || eigen.temperatureC == null || eigen.heatTargetC == null) continue;
    const s = ctx.state.actuators[actuator.id];
    if (!s) continue;
    const tekort = eigen.heatTargetC - eigen.temperatureC;
    const minuten = minutesSinceChange(s, ctx.nowMs);
    const verwarmt = s.action.ok && s.action.value === 'heat';
    let helpt: boolean;
    if (verwarmt) {
      // Doorgaan tot zijn kamer op temperatuur is, en eenmaal aan minstens zijn halve uur.
      helpt = tekort > 1e-9 || minuten < help.minRunMinutes;
    } else {
      helpt = minuten >= help.minRestMinutes && ketelStookt && tekort >= help.minShortfallC - 1e-9 && goedkoper;
    }
    if (!helpt) continue;
    intents.push({
      strategyId: 'heat-assist',
      zoneId: eigen.zone.id,
      actuatorId: actuator.id,
      action: 'heat',
      setpointC: eigen.heatTargetC,
      priority: 15,
      budgetW: 0,
      reason: 'zone_below_setpoint',
    });
  }
  return intents;
}

export function createHeatAssist(
  options: Partial<HeatAssistOptions> = {},
): Strategy {
  const { startDelayMinutes, minShortfallC } = {
    ...HEAT_ASSIST_DEFAULTS,
    ...options,
  };

  return {
    id: 'heat-assist',
    priority: 15,

    propose(ctx: DecisionContext): Intent[] {
      if (PASSIVE_MODES.has(ctx.mode)) return [];
      // Helpen bij de cv voor het hele huis (besluit 292), als de app het instelde.
      if (ctx.config.cvHelp) return cvHelpIntents(ctx, ctx.config.cvHelp);

      const intents: Intent[] = [];

      for (const derived of ctx.zones) {
        const { zone, temperatureC, heatTargetC, demand } = derived;
        if (temperatureC == null || heatTargetC == null) continue;
        if (demand !== 'heat') continue;

        // Per zone uit de app (besluit 283): uit, of eigen drempels; weg is de standaard.
        const eigen = zone.heatAssist;
        if (eigen && !eigen.enabled) continue;
        const delay = eigen?.startDelayMinutes ?? startDelayMinutes;
        const shortfall = eigen?.minShortfallC ?? minShortfallC;

        // Stookt de hoofdverwarming van deze zone al lang genoeg?
        //
        // Rapporteert het apparaat niet of het levert, dan gebeurt hier niets.
        // Dat is met opzet: aannemen dat een ingeschakelde ketel ook brandt zou
        // de airco laten meestarten op elke korte vraag, precies wat de
        // startvertraging moet voorkomen.
        const primarySettled = zone.actuatorIds.some((id) => {
          const actuator = actuatorById(ctx.config, id);
          if (actuator.role !== 'primary') return false;
          const s = ctx.state.actuators[id];
          if (!s) return false;
          return producingMinutes(s, ctx.nowMs) >= delay;
        });
        if (!primarySettled) continue;

        if (heatTargetC - temperatureC < shortfall - 1e-9) continue;

        for (const actuatorId of zone.actuatorIds) {
          const actuator = actuatorById(ctx.config, actuatorId);
          if (actuator.role !== 'assist') continue;
          if (!actuator.capabilities.canHeat) continue;

          intents.push({
            strategyId: 'heat-assist',
            zoneId: zone.id,
            actuatorId,
            action: 'heat',
            setpointC: heatTargetC,
            priority: 15,
            budgetW: 0,
            reason: 'zone_below_setpoint',
          });
        }
      }

      return intents;
    },
  };
}

/** De standaardvariant, met de drempels uit de YAML-versie. */
export const heatAssist: Strategy = createHeatAssist();
