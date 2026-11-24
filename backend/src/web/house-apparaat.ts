/*
 * Het huis: een apparaat en zijn stand (opgesplitst uit web/house.ts).
 *
 * Uit de stand in Home Assistant wat een lamp, scherm, klimaatapparaat, witgoed, stekker, warmtebuffer, camera,
 * rookmelder of meter nu doet, in de woorden van de app.
 */
import { rookmelderNu } from './rookmelders.js';
import type { HaEntityState } from '../adapters/homeassistant/client.js';
import type { HeatStore } from '../core/model.js';
import type { HeatStoreExplanation } from '../core/decision.js';
import { type Lang } from './assistant.js';
import { type HouseClimate, type HouseDevice, type HouseReading, type HuisStekker, type StandCode } from './house-types.js';
import { WOORDEN, decimaal, standNaOpdracht } from './house.js';
import { perTaal } from '../taal/index.js';

/** Losse zinnen van dit bestand, per taal (besluit 344). */
const TAAL_ZIN = perTaal('apparaatZin');

function readingText(r: HouseReading, lang: Lang): string {
  const parts = [r.temperatuurC == null ? null : `${decimaal(r.temperatuurC, lang)}°`, r.vochtPct == null ? null : `${Math.round(r.vochtPct)}%`];
  return parts.filter(Boolean).join(' · ') || WOORDEN[lang].geenMeting;
}

/** De stand van een klimaatapparaat in Home Assistant (`hvac_mode`), als code. */
const MODUS_CODE: Readonly<Record<string, StandCode>> = { cool: 'koelen', heat: 'verwarmen', heat_cool: 'automatisch', auto: 'automatisch', dry: 'drogen', fan_only: 'ventileren' };

/** Kleurstanden voor een echte kleur, niet alleen wit (besluit 100). */
const HUE_MODES: ReadonlySet<string> = new Set(['hs', 'xy', 'rgb', 'rgbw', 'rgbww']);

/** Wat een lamp in wit en kleur kan, uit Home Assistant. */
function lightAbilities(state: HaEntityState | undefined, modes: readonly string[]): NonNullable<HouseDevice['licht']> {
  const a = state?.attributes ?? {};
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const anyColor = modes.some((m) => COLOR_MODES.has(m));
  const minK = num(a['min_color_temp_kelvin']) ?? (anyColor ? 2200 : null);
  const maxK = num(a['max_color_temp_kelvin']) ?? (anyColor ? 6500 : null);
  const hs = Array.isArray(a['hs_color']) && a['color_mode'] !== 'color_temp' ? (a['hs_color'] as unknown[]).map(num) : null;
  return {
    wit: minK != null && maxK != null ? { minK: Math.round(minK), maxK: Math.round(maxK) } : null,
    kleur: modes.some((m) => HUE_MODES.has(m)),
    kelvin: a['color_mode'] === 'color_temp' ? num(a['color_temp_kelvin']) : null,
    tint: hs && hs[0] != null && hs[1] != null ? [Math.round(hs[0]), Math.round(hs[1])] : null,
  };
}

/** Kleurstanden waarmee Home Assistant ook een kleurtemperatuur kan zetten. */
const COLOR_MODES: ReadonlySet<string> = new Set(['color_temp', 'hs', 'xy', 'rgb', 'rgbw', 'rgbww']);

export function lightOf(id: string, state: HaEntityState | undefined, name: string, lang: Lang): HouseDevice {
  const w = WOORDEN[lang];
  const on = state?.state === 'on';
  const b = state?.attributes['brightness'];
  const pct = on && typeof b === 'number' ? Math.round((b / 255) * 100) : null;
  const weg = state == null || state.state === 'unavailable' || state.state === 'unknown';
  const stand = weg ? w.onbereikbaar : on ? (pct == null ? w.aan : w.aanPct(pct)) : w.uit;
  const standCode: StandCode = weg ? 'geen-verbinding' : on ? 'aan' : 'uit';
  // Wat de lamp kan, uit Home Assistant; een uitgezette lamp zonder toestand kan alleen aan en uit.
  const modes = state?.attributes['supported_color_modes'];
  const list = Array.isArray(modes) ? modes.filter((m): m is string => typeof m === 'string') : [];
  const dimbaar = list.some((m) => m !== 'onoff') || typeof b === 'number';
  const kleurtemp = list.some((m) => COLOR_MODES.has(m));
  return { id, naam: name, haNaam: name, soort: 'licht', stand, standCode, aan: on, helderheidPct: pct, positiePct: null, actuatorId: null, zone: null, groepen: [], dimbaar, kleurtemp, licht: lightAbilities(state, list), meting: null, klimaat: null, meetKamer: false };
}

/** Kan dit scherm naar een stand (SUPPORT_SET_POSITION, bit 4)? */
const COVER_SET_POSITION = 4;

export function coverOf(id: string, state: HaEntityState | undefined, name: string, lang: Lang): HouseDevice {
  const w = WOORDEN[lang].scherm;
  const p = state?.attributes['current_position'];
  const pos = typeof p === 'number' ? p : null;
  const features = Number(state?.attributes['supported_features'] ?? 0);
  // Somfy RTS (en elk scherm dat zijn stand niet terugmeldt): Home Assistant
  // zegt "assumed_state", of kent geen stand en geen open of dicht.
  const terugmelding = state != null && state.attributes['assumed_state'] !== true && (pos != null || state.state === 'open' || state.state === 'closed' || state.state === 'opening' || state.state === 'closing');
  // Een zonnescherm (besluit 128): open is uitgevouwen, dicht is ingeklapt.
  const zonnescherm = state?.attributes['device_class'] === 'awning';
  // Zonder terugmelding onthoudt Home Assistant soms de laatste opdracht.
  const laatste: 'open' | 'dicht' | null = !terugmelding && state?.state === 'open' ? 'open' : !terugmelding && state?.state === 'closed' ? 'dicht' : null;
  const scherm = { terugmelding, standKiezen: terugmelding && (features & COVER_SET_POSITION) !== 0, ...(zonnescherm ? { zonnescherm } : {}), ...(laatste ? { laatste } : {}) };
  // Open en dicht; een zonnescherm is dan uitgevouwen en ingeklapt.
  const heel = (open: boolean) => (zonnescherm ? (open ? w.uitgevouwen : w.ingeklapt) : open ? w.open : w.dicht);
  let stand: string;
  let standCode: StandCode;
  if (state == null || state.state === 'unavailable') [stand, standCode] = [WOORDEN[lang].geenVerbinding, 'geen-verbinding'];
  else if (!terugmelding) [stand, standCode] = laatste ? [standNaOpdracht(laatste, zonnescherm, lang), 'na-opdracht'] : [w.zonderTerugmelding, 'zonder-terugmelding'];
  else if (state.state === 'opening') [stand, standCode] = [zonnescherm ? w.vouwtUit : w.gaatOpen, 'gaat-open'];
  else if (state.state === 'closing') [stand, standCode] = [zonnescherm ? w.klaptIn : w.gaatDicht, 'gaat-dicht'];
  else if (pos == null) [stand, standCode] = state.state === 'closed' ? [heel(false), 'dicht'] : [heel(true), 'open'];
  else if (pos >= 100) [stand, standCode] = [heel(true), 'open'];
  else if (pos <= 0) [stand, standCode] = [heel(false), 'dicht'];
  else [stand, standCode] = [zonnescherm ? w.pctUitgevouwen(pos) : w.pctDicht(100 - pos), 'deels'];
  // "Aan": een screen hangt (deels) voor het raam, een zonnescherm is (deels) uit.
  const down = zonnescherm ? (pos != null ? pos > 0 : state?.state === 'open') : pos != null ? pos < 100 : state?.state === 'closed';
  return { id, naam: name, haNaam: name, soort: 'screen', stand, standCode, aan: terugmelding && down, helderheidPct: null, positiePct: terugmelding ? pos : null, actuatorId: null, zone: null, groepen: [], dimbaar: false, kleurtemp: false, meting: null, klimaat: null, meetKamer: false, scherm };
}

export function climateOf(
  actuatorId: string,
  name: string,
  observed: string | undefined,
  info: { meting: HouseReading | null; klimaat: HouseClimate | null } = { meting: null, klimaat: null },
  lang: Lang = 'nl',
): HouseDevice {
  const w = WOORDEN[lang];
  const [mode = '', sp] = (observed ?? '').split('@');
  const code = MODUS_CODE[mode];
  const word = w.modus[mode];
  const setpoint = sp == null ? NaN : Number(sp);
  const stand =
    mode === 'off'
      ? w.uit
      : word == null
        ? w.onbekend
        : Number.isFinite(setpoint)
          ? w.naar(word, decimaal(setpoint, lang))
          : word;
  return {
    id: actuatorId,
    naam: name,
    haNaam: name,
    soort: 'klimaat',
    stand,
    standCode: mode === 'off' ? 'uit' : (code ?? 'onbekend'),
    aan: word != null,
    helderheidPct: null,
    positiePct: null,
    actuatorId,
    zone: null,
    groepen: [],
    dimbaar: false,
    kleurtemp: false,
    meting: info.meting,
    klimaat: info.klimaat,
    meetKamer: false,
  };
}

const APPARAAT_CODE: Readonly<Record<string, StandCode>> = { running: 'draait', would_start: 'zou-starten', waiting: 'klaargezet', not_ready: 'uit' };

/** Een uitstelbaar apparaat (besluit 98): de droger, met zijn stand van nu. */
export function applianceOf(id: string, name: string, state: string | undefined, lang: Lang): HouseDevice {
  return {
    id,
    naam: name,
    haNaam: name,
    soort: 'apparaat',
    witgoed: true,
    stand: WOORDEN[lang].apparaat[state ?? ''] ?? WOORDEN[lang].meldtNogNiets,
    standCode: APPARAAT_CODE[state ?? ''] ?? 'meldt-niets',
    aan: state === 'running',
    helderheidPct: null,
    positiePct: null,
    actuatorId: null,
    zone: null,
    groepen: [],
    dimbaar: false,
    kleurtemp: false,
    meting: null,
    klimaat: null,
    meetKamer: false,
  };
}

/** Een slimme stekker die (nog) niet op zon staat (besluit 318): aan of uit, zonder temperatuur. */
export function stekkerOf(s: HuisStekker, state: HaEntityState | undefined, lang: Lang): HouseDevice {
  const aan = state?.state === 'on';
  return {
    id: s.id,
    naam: s.naam,
    haNaam: s.naam,
    soort: 'apparaat',
    stand: state == null || state.state === 'unavailable' ? WOORDEN[lang].meldtNogNiets : aan ? WOORDEN[lang].stekker['stookt']! : TAAL_ZIN[lang].uit,
    standCode: aan ? 'draait' : 'uit',
    aan,
    helderheidPct: null,
    positiePct: null,
    actuatorId: null,
    zone: null,
    groepen: [],
    dimbaar: false,
    kleurtemp: false,
    meting: null,
    klimaat: null,
    meetKamer: false,
    warmte: { soort: 'stekker', tempC: null, doelC: null, minC: 0, zonC: 0, opZon: false, vermogenW: null },
  };
}

/** Een boiler of jacuzzi (besluit 186): de temperatuur en wat hij doet. */
export function bufferOf(h: HeatStore, e: HeatStoreExplanation | undefined, lang: Lang): HouseDevice {
  const { id, name } = h;
  const w = h.kind === 'stekker' ? WOORDEN[lang].stekker : WOORDEN[lang].buffer;
  const wat = e == null ? WOORDEN[lang].meldtNogNiets : e.heating ? w['stookt']! : (w[e.state] ?? e.state);
  const temp = e?.temperatureC != null ? Math.round(e.temperatureC) : null;
  return {
    id,
    naam: name,
    haNaam: name,
    soort: 'apparaat',
    stand: temp != null ? `${temp}° · ${wat}` : wat,
    standCode: e == null ? 'meldt-niets' : e.heating ? 'draait' : e.state === 'would_heat' ? 'zou-starten' : e.state === 'waiting' ? 'klaargezet' : 'uit',
    aan: e?.heating ?? false,
    helderheidPct: null,
    positiePct: null,
    actuatorId: null,
    zone: null,
    groepen: [],
    dimbaar: false,
    kleurtemp: false,
    meting: null,
    klimaat: null,
    meetKamer: false,
    warmte: {
      soort: h.kind,
      tempC: temp,
      doelC: e?.targetC != null ? Math.round(e.targetC) : null,
      minC: h.minC,
      zonC: h.sunC,
      opZon: e != null && (e.state === 'waiting' || e.reason === 'surplus_available'),
      vermogenW: e?.powerW != null ? Math.round(e.powerW) : null,
    },
  };
}

/** Een camera om te bekijken (besluit 106); de stand zegt alleen of hij bereikbaar is. */
export function cameraOf(id: string, name: string, bereikbaar: boolean, lang: Lang): HouseDevice {
  return {
    id,
    naam: name,
    haNaam: name,
    soort: 'camera',
    stand: bereikbaar ? WOORDEN[lang].live : WOORDEN[lang].nietBereikbaar,
    standCode: bereikbaar ? 'live' : 'geen-verbinding',
    aan: false,
    helderheidPct: null,
    positiePct: null,
    actuatorId: null,
    zone: null,
    groepen: [],
    dimbaar: false,
    kleurtemp: false,
    meting: null,
    klimaat: null,
    meetKamer: false,
  };
}

/** Een rookmelder: wat hij ziet, in woorden; alleen lezen. */
export function rookmelderOf(id: string, name: string, nu: ReturnType<typeof rookmelderNu>, lang: Lang): HouseDevice {
  const w = WOORDEN[lang];
  const [stand, standCode]: [string, StandCode] = !nu.bereikbaar
    ? [w.geenVerbinding, 'geen-verbinding']
    : nu.gevaar
      ? [w.gezien[nu.gevaar], 'gevaar']
      : nu.batterijProbleem
        ? [w.batterijVervangen, 'batterij']
        : [w.allesGoed, 'goed'];
  return {
    id,
    naam: name,
    haNaam: name,
    soort: 'rookmelder',
    stand,
    standCode,
    aan: nu.gevaar != null,
    helderheidPct: null,
    positiePct: null,
    actuatorId: null,
    zone: null,
    groepen: [],
    dimbaar: false,
    kleurtemp: false,
    meting: null,
    klimaat: null,
    meetKamer: false,
    rookmelder: { gevaar: nu.gevaar, sindsMs: nu.sindsMs, batterijProbleem: nu.batterijProbleem, vervangenVoor: nu.vervangenVoor, getestOp: nu.getestOp },
  };
}

/** Een meter: een sensor in een kamer die temperatuur en luchtvochtigheid geeft. */
export function meterOf(id: string, name: string, meting: HouseReading, meetKamer: boolean, lang: Lang): HouseDevice {
  return {
    id,
    naam: name,
    haNaam: name,
    soort: 'meter',
    stand: readingText(meting, lang),
    standCode: meting.temperatuurC == null && meting.vochtPct == null ? 'geen-meting' : 'meting',
    aan: false,
    helderheidPct: null,
    positiePct: null,
    actuatorId: null,
    zone: null,
    groepen: [],
    dimbaar: false,
    kleurtemp: false,
    meting,
    klimaat: null,
    meetKamer,
  };
}
