/*
 * De assistent: kort per kamer (opgesplitst uit web/assistant.ts).
 *
 * De korte zin per kamer voor een bewoner (wat er nu gebeurt), zoals op Thuis en de wand.
 */
import { actuatorsOf } from '../core/model.js';
import type { SiteConfig, Zone } from '../core/model.js';
import { type DecisionView, type Lang, type RoomKind } from './assistant-types.js';
import { roomStatus } from './assistant.js';
import { perTaal } from '../taal/index.js';
import { komma } from '../taal/getal.js';

/** Losse zinnen van dit bestand, per taal (besluit 344). */
const TAAL_ZIN = perTaal('algemeen');

/* ------------------------------------------------- de stand per kamer, kort */

/*
 * Het bewonerscontract (76, 94): per kamer de soort, een korte stand voor de
 * kaart ("Wacht op meer zon"), de lange zin van de assistent, en wat het echte
 * apparaat doet. Uitgerekend in de dienst, zodat de pagina alleen toont.
 */

export const SHORT = perTaal('kort');

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
    const t = new Intl.DateTimeFormat(TAAL_ZIN[lang].locale, {
      timeZone: config.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(taken.untilMs);
    return { soort: 'wait', kort: w.takenUntil(t), actuatorId: null, hand: true };
  }
  const mine = snap.accepted.filter((i) => ids.has(i.actuatorId));
  const running = mine.find((i) => i.action === 'cool' || i.action === 'heat');
  // Wat een apparaat van de kamer zegt dat het echt doet: verwarmt of koelt
  // het, dan staat dat er, ook als SunArc het anders zou doen.
  const echtBezig = shadow ? zone.actuatorIds.map((id) => ({ id, doet: snap.observedAction?.[id] })).find((x) => x.doet === 'heating' || x.doet === 'cooling') : undefined;
  const echtActie = echtBezig ? (echtBezig.doet === 'heating' ? ('heat' as const) : ('cool' as const)) : null;
  if (running && (running.action === 'cool' || running.action === 'heat')) {
    const onSun = running.strategyId === 'pv-surplus';
    // Doet het apparaat het al echt (de oude regeling), dan geen "zou" (besluit 188). Zegt het
    // apparaat wat het doet, dan moet het ook echt stoken of koelen: een Nest op "verwarmen
    // naar 20°" die stil staat, verwarmt niet (de wand zei het wel).
    const doet = snap.observedAction?.[running.actuatorId];
    const klopt = (snap.observed[running.actuatorId] ?? '').split('@')[0] === running.action && (doet == null || doet === (running.action === 'heat' ? 'heating' : 'cooling'));
    if (shadow && !klopt && echtBezig && echtActie) return { soort: echtActie, kort: w.run[echtActie], actuatorId: echtBezig.id, klopt: true };
    // SunArc zou nog even doorgaan tot net boven het doel (de marge tegen aan en uit), maar
    // in huis gebeurt niets en het doel is al gehaald: dan is de kamer op temperatuur, niet
    // fris ("De woonkamer is fris" bij 20,2° en doel 20°).
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
    const at = Number.isFinite(n) ? ` ${w.towards} ${komma(String(Math.round(n * 10) / 10), lang)}°` : '';
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
