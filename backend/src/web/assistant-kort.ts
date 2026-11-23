/*
 * De assistent: kort per kamer (22 november 2026, opgesplitst uit web/assistant.ts).
 *
 * De korte zin per kamer voor een bewoner (wat er nu gebeurt), zoals op Thuis en de wand.
 */
import type { ReasonCode, BlockCode } from '../core/decision.js';
import { actuatorsOf } from '../core/model.js';
import type { SiteConfig, Zone } from '../core/model.js';
import { type DecisionView, type Lang, type RoomKind } from './assistant-types.js';
import { roomStatus } from './assistant.js';

/* ------------------------------------------------- de stand per kamer, kort */

/*
 * Het bewonerscontract (76, 94): per kamer de soort, een korte stand voor de
 * kaart ("Wacht op meer zon"), de lange zin van de assistent, en wat het echte
 * apparaat doet. Uitgerekend in de dienst, zodat de pagina alleen toont.
 */

export const SHORT = {
  nl: {
    failsafe: 'Storing: veilig gezet',
    taken: 'Jij hebt het overgenomen',
    takenUntil: (t: string) => `Jij hebt het tot ${t}`,
    run: { cool: 'Koelt', heat: 'Verwarmt' },
    // Tijdens de schaduw doet het apparaat het niet echt: "zou" (besluit 124).
    wouldRun: { cool: 'Zou koelen', heat: 'Zou verwarmen' },
    onSun: ' op zon',
    parked: 'Staat klaar om verder te gaan',
    noMeasurement: 'Geen meting',
    waitSun: 'Wacht op meer zon',
    // De zon is nog niet op, of komt vandaag niet meer (25 oktober 2026).
    waitSunOp: 'Op zon zodra hij op is',
    waitSunMorgen: 'Morgen weer op zon',
    wait: (why: string) => `Wacht: ${why}`,
    ok: 'Op temperatuur',
    idle: 'Niets te doen',
    idleWhy: (why: string) => `Niets te doen: ${why}`,
    off: 'uit',
    block: {
      min_run_not_elapsed: 'draait nog even door',
      min_rest_not_elapsed: 'pauzeert even na het uitgaan',
      stabilisation_active: 'wacht tot het verbruik stabiel is',
      settling_after_switch: 'is net van stand gewisseld',
      insufficient_power_budget: 'te weinig zon over',
      start_threshold_not_met: 'net te weinig zon om te starten',
      capability_missing: 'het apparaat kan dit niet',
      setpoint_out_of_range: 'doel buiten bereik van het apparaat',
      superseded_by_higher_priority: 'een andere kamer ging voor',
      no_change_needed: 'niets te veranderen',
      resident_override: 'jij hebt het overgenomen',
      insufficient_current_budget: 'de hoofdzekering zou te zwaar belast worden',
    } satisfies Record<BlockCode, string>,
    reason: {
      zone_below_setpoint: 'onder het doel',
      zone_above_setpoint: 'boven het doel',
      zone_satisfied: 'op temperatuur',
      buffering_free_energy: 'zon over, dus alvast op voorraad',
      surplus_available: 'er is zon over',
      surplus_insufficient: 'te weinig zon over',
      importing_from_grid: 'het huis haalt stroom van het net',
      outside_active_hours: 'buiten de actieve uren',
      mode_excludes_action: 'past niet bij deze modus',
      nobody_home: 'niemand thuis',
      failsafe_unreliable_input: 'een meting is onbetrouwbaar',
    } satisfies Record<ReasonCode, string>,
    // Ook de standen die een thermostaat in Home Assistant zelf kent (0.190.1): anders stond er "heat_cool naar 18°".
    action: { cool: 'koelen', heat: 'verwarmen', standby: 'geparkeerd', off: 'uit', heat_cool: 'verwarmen of koelen', auto: 'automatisch', dry: 'drogen', fan_only: 'ventileren' } as Record<string, string>,
    towards: 'naar',
  },
  en: {
    failsafe: 'Fault: put in a safe state',
    taken: 'You took it over',
    takenUntil: (t: string) => `You have it until ${t}`,
    run: { cool: 'Cooling', heat: 'Heating' },
    wouldRun: { cool: 'Would cool', heat: 'Would heat' },
    onSun: ' on solar',
    parked: 'Parked, ready to resume',
    noMeasurement: 'No measurement',
    waitSun: 'Waiting for more sun',
    waitSunOp: 'On solar once the sun is up',
    waitSunMorgen: 'On solar again tomorrow',
    wait: (why: string) => `Waiting: ${why}`,
    ok: 'At temperature',
    idle: 'Nothing to do',
    idleWhy: (why: string) => `Nothing to do: ${why}`,
    off: 'off',
    block: {
      min_run_not_elapsed: 'must finish its minimum run time',
      min_rest_not_elapsed: 'must rest for a moment',
      stabilisation_active: 'waiting for the power use to settle',
      settling_after_switch: 'settling after a switch',
      insufficient_power_budget: 'too little solar to spare',
      start_threshold_not_met: 'just too little solar to start',
      capability_missing: 'the unit cannot do this',
      setpoint_out_of_range: 'target outside the unit range',
      superseded_by_higher_priority: 'another room came first',
      no_change_needed: 'nothing to change',
      resident_override: 'you took it over',
      insufficient_current_budget: 'the main fuse would be overloaded',
    } satisfies Record<BlockCode, string>,
    reason: {
      zone_below_setpoint: 'below target',
      zone_above_setpoint: 'above target',
      zone_satisfied: 'at temperature',
      buffering_free_energy: 'storing free solar as cooling or heat',
      surplus_available: 'solar to spare',
      surplus_insufficient: 'too little solar to spare',
      importing_from_grid: 'the house is drawing from the grid',
      outside_active_hours: 'outside active hours',
      mode_excludes_action: 'does not fit this mode',
      nobody_home: 'nobody home',
      failsafe_unreliable_input: 'a measurement is unreliable',
    } satisfies Record<ReasonCode, string>,
    action: { cool: 'cooling', heat: 'heating', standby: 'parked', off: 'off', heat_cool: 'heating or cooling', auto: 'automatic', dry: 'drying', fan_only: 'fan only' } as Record<string, string>,
    towards: 'at',
  },
} as const;

export interface ResidentRoom {
  readonly zoneId: string;
  readonly soort: RoomKind;
  /** De korte stand voor de kaart. */
  readonly kort: string;
  /** De zin van de assistent, met de getallen. */
  readonly zin: string;
  /** Wat de apparaten van de kamer werkelijk doen, of "uit". */
  readonly echt: string;
  /** Het apparaat dat draait volgens het besluit, voor de stromen in de tekening. */
  readonly actuatorId: string | null;
  /**
   * Doet het echte apparaat al wat het besluit wil (besluit 188)? Dan zegt de
   * kamer in de schaduw "Verwarmt" in plaats van "Zou verwarmen": dat klopt met
   * wat er in huis gebeurt, ook al regelt de oude regeling het.
   */
  readonly klopt: boolean;
  /** De bewoner nam de kamer met de hand over: dat is echt, ook als SunArc meekijkt (besluit 313). */
  readonly hand?: boolean;
}

function shortStatusOf(
  config: SiteConfig,
  snap: DecisionView,
  zone: Zone,
  lang: Lang,
  shadow = true,
): { soort: RoomKind; kort: string; actuatorId: string | null; klopt?: boolean; hand?: boolean } {
  const w = SHORT[lang];
  const e = snap.explanation;
  const ids = new Set(zone.actuatorIds);
  const pz = e.perZone.find((z) => z.zoneId === zone.id);
  if (e.failsafe.active) return { soort: 'bad', kort: w.failsafe, actuatorId: null };
  const taken = (e.overrides ?? []).find((o) => ids.has(o.actuatorId));
  if (taken) {
    if (taken.untilMs == null) return { soort: 'wait', kort: w.taken, actuatorId: null, hand: true };
    const t = new Intl.DateTimeFormat(lang === 'nl' ? 'nl-NL' : 'en-GB', {
      timeZone: config.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(taken.untilMs);
    return { soort: 'wait', kort: w.takenUntil(t), actuatorId: null, hand: true };
  }
  const mine = snap.accepted.filter((i) => ids.has(i.actuatorId));
  const running = mine.find((i) => i.action === 'cool' || i.action === 'heat');
  // Wat een apparaat van de kamer zegt dat het echt doet (1 november 2026): verwarmt of koelt
  // het, dan staat dat er, ook als SunArc het anders zou doen.
  const echtBezig = shadow ? zone.actuatorIds.map((id) => ({ id, doet: snap.observedAction?.[id] })).find((x) => x.doet === 'heating' || x.doet === 'cooling') : undefined;
  const echtActie = echtBezig ? (echtBezig.doet === 'heating' ? ('heat' as const) : ('cool' as const)) : null;
  if (running && (running.action === 'cool' || running.action === 'heat')) {
    const onSun = running.strategyId === 'pv-surplus';
    // Doet het apparaat het al echt (de oude regeling), dan geen "zou" (besluit 188). Zegt het
    // apparaat wat het doet, dan moet het ook echt stoken of koelen: een Nest op "verwarmen
    // naar 20°" die stil staat, verwarmt niet (25 oktober 2026, de wand zei het wel).
    const doet = snap.observedAction?.[running.actuatorId];
    const klopt = (snap.observed[running.actuatorId] ?? '').split('@')[0] === running.action && (doet == null || doet === (running.action === 'heat' ? 'heating' : 'cooling'));
    if (shadow && !klopt && echtBezig && echtActie) return { soort: echtActie, kort: w.run[echtActie], actuatorId: echtBezig.id, klopt: true };
    // SunArc zou nog even doorgaan tot net boven het doel (de marge tegen aan en uit), maar
    // in huis gebeurt niets en het doel is al gehaald: dan is de kamer op temperatuur, niet
    // fris (1 november 2026: "De woonkamer is fris" bij 20,2° en doel 20°).
    const doel = running.action === 'heat' ? (pz?.heatTargetC ?? null) : (pz?.coolTargetC ?? null);
    const gehaald = pz?.temperatureC != null && doel != null && (running.action === 'heat' ? pz.temperatureC >= doel : pz.temperatureC <= doel);
    if (shadow && !klopt && gehaald) return { soort: 'ok', kort: w.ok, actuatorId: null };
    return { soort: running.action, kort: `${(shadow && !klopt ? w.wouldRun : w.run)[running.action]}${onSun ? w.onSun : ''}`, actuatorId: running.actuatorId, klopt: !shadow || klopt };
  }
  if (echtBezig && echtActie) return { soort: echtActie, kort: w.run[echtActie], actuatorId: echtBezig.id, klopt: true };
  if (mine.some((i) => i.action === 'standby')) return { soort: 'wait', kort: w.parked, actuatorId: null };
  const wanting = pz != null && pz.demand !== 'none';
  const blocked = snap.rejected.find((r) => r.intent.zoneId === zone.id);
  if (blocked && wanting) {
    const zon = snap.zonNu === 'weg' ? w.waitSunMorgen : snap.zonNu === 'nog' ? w.waitSunOp : w.waitSun;
    const kort = blocked.blockedBy === 'insufficient_power_budget' ? zon : w.wait(w.block[blocked.blockedBy]);
    return { soort: 'wait', kort, actuatorId: null };
  }
  if (pz == null || pz.temperatureC == null) return { soort: 'bad', kort: w.noMeasurement, actuatorId: null };
  if (pz.reason === 'zone_satisfied') {
    return pz.targetC == null ? { soort: 'idle', kort: w.idle, actuatorId: null } : { soort: 'ok', kort: w.ok, actuatorId: null };
  }
  if (wanting) return { soort: 'idle', kort: w.idleWhy(w.reason[pz.reason]), actuatorId: null };
  return { soort: 'idle', kort: w.idle, actuatorId: null };
}

/** "Airco woonkamer koelen naar 22°", of "uit" als niets van de kamer aan staat. */
function realShort(config: SiteConfig, snap: DecisionView, zone: Zone, lang: Lang): string {
  const w = SHORT[lang];
  const parts: string[] = [];
  for (const a of actuatorsOf(config, zone)) {
    const [state = '', sp] = (snap.observed[a.id] ?? '').split('@');
    if (state === '' || state === 'off' || state === 'onbekend' || state === 'unavailable' || state === 'unknown') continue;
    const word = w.action[state] ?? state;
    const n = sp == null ? NaN : Number(sp);
    const at = Number.isFinite(n) ? ` ${w.towards} ${lang === 'nl' ? String(Math.round(n * 10) / 10).replace('.', ',') : String(Math.round(n * 10) / 10)}°` : '';
    parts.push(`${a.name} ${word}${at}`);
  }
  return parts.length === 0 ? w.off : parts.join(', ');
}

export function residentRooms(config: SiteConfig, snap: DecisionView, lang: Lang = 'nl', shadow = true): ResidentRoom[] {
  return config.zones.map((zone) => {
    const s = shortStatusOf(config, snap, zone, lang, shadow);
    return {
      zoneId: zone.id,
      soort: s.soort,
      kort: s.kort,
      zin: roomStatus(config, snap, zone, lang, shadow).zin,
      echt: realShort(config, snap, zone, lang),
      actuatorId: s.actuatorId,
      klopt: s.klopt === true,
      ...(s.hand ? { hand: true } : {}),
    };
  });
}
