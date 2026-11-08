/**
 * Het enige instappunt van de kern.
 *
 * `decide` is puur: gelijke invoer geeft gelijke uitvoer, er wordt niets
 * gelezen dat niet in `state` staat en niets geschreven dat niet in
 * `Decision.commands` terugkomt. Daarom kan de replay-harness hem voeden met
 * opgenomen historie en de uitkomst vergelijken met wat de YAML-versie destijds
 * werkelijk deed.
 */

import { arbitrate } from './arbiter.js';
import { deferrableClaims, deferrableDecisions } from './deferrable.js';
import { heatStoreClaims, heatStoreDecisions } from './warmtebuffer.js';
import { buildContext } from './context.js';
import type { DecisionContext } from './context.js';
import type {
  AccuSchaduw,
  Decision,
  Explanation,
  Intent,
  ZoneExplanation,
} from './decision.js';
import { isHandsOff } from './model.js';
import { activeOverrides } from './override.js';
import type { SiteConfig } from './model.js';
import type { StrategyRegistry } from './strategy.js';
import type { SystemState } from './state.js';

export interface DecideOptions {
  readonly config: SiteConfig;
  readonly state: SystemState;
  readonly strategies: StrategyRegistry;
}

/**
 * Bij een onbetrouwbaar kritiek meetpunt schakelen alle assist-apparaten terug.
 * De primary blijft met rust: een CV-ketel uitzetten omdat een zoldersensor
 * wegvalt is gevaarlijker dan hem te laten doorlopen.
 */
function failsafeIntents(ctx: DecisionContext): Intent[] {
  const intents: Intent[] = [];
  for (const zone of ctx.config.zones) {
    for (const actuatorId of zone.actuatorIds) {
      const actuator = ctx.config.actuators.find((a) => a.id === actuatorId);
      if (!actuator || actuator.role !== 'assist') continue;
      intents.push({
        strategyId: 'failsafe',
        zoneId: zone.id,
        actuatorId,
        action: 'off',
        priority: 0,
        budgetW: 0,
        reason: 'failsafe_unreliable_input',
      });
    }
  }
  return intents;
}

function explain(
  ctx: DecisionContext,
  budget: Explanation['budget'],
  state: SystemState,
): Explanation {
  const perZone: ZoneExplanation[] = ctx.zones.map((d) => ({
    zoneId: d.zone.id,
    temperatureC: d.temperatureC,
    // Rechtstreeks uit de toestand: de context is wat de regeling gebruikt, en
    // dit is uitdrukkelijk geen invoer voor de regeling.
    humidityPct: (() => {
      const h = state.zones[d.zone.id]?.humidityPct;
      return h?.ok ? h.value : null;
    })(),
    targetC: d.demand === 'cool' ? d.coolTargetC : d.heatTargetC,
    heatTargetC: d.heatTargetC,
    coolTargetC: d.coolTargetC,
    demand: d.demand,
    reason:
      d.temperatureC == null
        ? 'failsafe_unreliable_input'
        : d.demand === 'heat'
          ? 'zone_below_setpoint'
          : d.demand === 'cool'
            ? 'zone_above_setpoint'
            : 'zone_satisfied',
  }));

  return {
    mode: ctx.mode,
    modeSource: ctx.modeSource,
    occupied: ctx.occupied,
    budget,
    failsafe: { active: ctx.failsafeActive, unreliable: ctx.unreliableInputs },
    perZone,
    // Rechtstreeks uit de toestand en niet uit de context: de context is wat de
    // regeling gebruikt, en dit is uitdrukkelijk geen invoer voor de regeling
    // (besluit 30). Het gaat alleen mee het logboek in.
    outdoorTemperatureC: state.outdoorTemperatureC.ok
      ? state.outdoorTemperatureC.value
      : null,
    solarProductionW: state.solarProductionW.ok ? state.solarProductionW.value : null,
    ...(() => {
      const overrides = activeOverrides(state);
      return overrides.length > 0 ? { overrides } : {};
    })(),
    // De stroom per fase, alleen als er een aansluiting is (besluit 78), zodat
    // het logboek zonder aansluiting niet verandert.
    ...(ctx.phases.length > 0
      ? {
          phases: ctx.phases.map((p) => ({
            id: p.id,
            currentA: p.currentA == null ? null : Math.round(p.currentA * 10) / 10,
            limitA: p.limitA,
            bron: p.bron,
          })),
        }
      : {}),
    // Welk comfort er gold (besluit 147), alleen met profielen.
    ...(ctx.profile ? { profile: ctx.profile } : {}),
  };
}

/** Onder dit vermogen rekent de schaduw van de accu niet: een paar watt is ruis (besluit 274). */
const ACCU_SCHADUW_W = 100;

/**
 * Het besluit, met de thuisaccu in de schaduw erbij (besluit 274): laadt de accu
 * met zon, dan rekent de regeling nog eens alsof dat zon over was, en zet in de
 * uitleg wat hij dan anders zou doen. Het echte besluit verandert niet.
 */
export function decide(options: DecideOptions): Decision {
  const besluit = decideKern(options);
  const accuZonW = options.state.power.accuZonW ?? 0;
  if (accuZonW < ACCU_SCHADUW_W) return besluit;
  const { state } = options;
  const grid = state.power.gridPowerW;
  const { accuZonW: _weg, ...power } = state.power;
  const alsZon = decideKern({ ...options, state: { ...state, power: { ...power, gridPowerW: grid.ok ? { ...grid, value: grid.value - accuZonW } : grid } } });
  return { ...besluit, explanation: { ...besluit.explanation, accu: verschilMetAccu(besluit, alsZon, accuZonW) } };
}

/** Wat de schaduw met de accu anders doet dan het echte besluit (besluit 274). */
function verschilMetAccu(echt: Decision, schaduw: Decision, zonW: number): AccuSchaduw {
  const acties = (d: Decision) => new Map(d.commands.flatMap((c) => (c.kind === 'setAction' ? [[c.actuatorId, c.action] as const] : [])));
  const nu = acties(echt);
  const zou = acties(schaduw);
  const aan = (a: string | undefined) => a === 'heat' || a === 'cool';
  // Zou aangaan, of zou aanblijven waar het echte besluit hem uitzet.
  const apparaten = [...new Set([...zou].filter(([id, a]) => aan(a) && !aan(nu.get(id))).map(([id]) => id).concat([...nu].filter(([id, a]) => a === 'off' && !zou.has(id)).map(([id]) => id)))];
  const startEcht = new Set([...(echt.explanation.deferrables ?? []).filter((d) => d.state === 'would_start').map((d) => d.id), ...(echt.explanation.heatStores ?? []).filter((h) => h.state === 'would_heat').map((h) => h.id)]);
  const opZon = [...(schaduw.explanation.deferrables ?? []).filter((d) => d.state === 'would_start').map((d) => d.id), ...(schaduw.explanation.heatStores ?? []).filter((h) => h.state === 'would_heat').map((h) => h.id)].filter((id) => !startEcht.has(id));
  return { zonW: Math.round(zonW), apparaten: apparaten.sort(), opZon: opZon.sort() };
}

function decideKern({ config, state, strategies }: DecideOptions): Decision {
  const ctx = buildContext(config, state);

  // Handen af. Geen voorstellen, dus ook geen afschakelronde: de arbiter laat
  // alles staan zoals de bewoner het heeft achtergelaten.
  //
  // Behalve wanneer de failsafe aanstaat. Een onbetrouwbare sensor is geen
  // voorkeur maar een storing, en de assist-apparaten moeten dan terug — ook
  // als de bewoner net had gezegd dat de regeling zich er niet mee moest
  // bemoeien. Het oude systeem deed dat ook zo, en terecht.
  if (isHandsOff(ctx.mode) && !ctx.failsafeActive) {
    return {
      atMs: ctx.nowMs,
      commands: [],
      proposed: [],
      accepted: [],
      rejected: [],
      explanation: withDeferrables(
        explain(ctx, {
          availableW: ctx.availableW,
          allocatedW: 0,
          surplusW: ctx.surplusW,
          reclaimableW: ctx.reclaimableW,
          gridPowerW: ctx.gridPowerW,
        }, state),
        deferrableDecisions(ctx, 0, []),
        (d) => heatStoreDecisions(ctx, 0, [], d),
      ),
    };
  }

  const proposed: Intent[] = ctx.failsafeActive
    ? failsafeIntents(ctx)
    : strategies
        .resolve(config.enabledStrategies)
        .flatMap((s) => s.propose(ctx));

  // Met een volgorde op zon vragen de apparaten hun deel op hun plek (besluit 176); zonder alles zoals het was.
  const sunClaims = config.sunOrder && config.sunOrder.length > 0 && !ctx.failsafeActive ? [...deferrableClaims(ctx), ...heatStoreClaims(ctx)] : [];
  const { accepted, rejected, commands, budget, claims } = arbitrate(proposed, ctx, sunClaims);

  return {
    atMs: ctx.nowMs,
    commands,
    proposed,
    accepted,
    rejected,
    // De droger krijgt wat de airco's overlaten (besluiten 85 en 98).
    // De boiler en de jacuzzi daarna (besluit 186).
    explanation: withDeferrables(
      explain(ctx, budget, state),
      deferrableDecisions(ctx, budget.allocatedW, commands, sunClaims.length > 0 ? claims : undefined),
      (d) => heatStoreDecisions(ctx, budget.allocatedW, commands, d, sunClaims.length > 0 ? claims : undefined),
    ),
  };
}

/** Alleen als er uitstelbare apparaten of warmtebuffers zijn, zodat het logboek anders niet verandert. */
function withDeferrables(
  e: Explanation,
  list: Explanation['deferrables'],
  buffers: (deferrables: NonNullable<Explanation['deferrables']>) => NonNullable<Explanation['heatStores']>,
): Explanation {
  const warmte = buffers(list ?? []);
  return {
    ...e,
    ...(list && list.length > 0 ? { deferrables: list } : {}),
    ...(warmte.length > 0 ? { heatStores: warmte } : {}),
  };
}
