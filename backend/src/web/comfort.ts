/**
 * Comfort uit de app (besluit 130): per kamer hoe warm of koel, per dagdeel,
 * en de uren van de dagdelen. Tot nu toe stond dat alleen in de configuratie;
 * nu zet de bewoner het zelf, in `comfort.json` naast de dataset.
 *
 * Net als de aansluiting (103) en Meten met (123) legt de dienst het over de
 * configuratie, en het resultaat moet door het eigen schema. Anders dan die
 * twee gaat het meteen in: de regeling neemt de nieuwe waarden over zolang ze
 * dezelfde entiteiten volgt (`ShadowRunner.setConfig`). Er gaat niets naar
 * Home Assistant; dit zijn doelen voor de regeling, geen opdrachten.
 *
 * Wat de app zegt, gaat voor wat het bestand zegt: de app is waar je het
 * instelt. Wat de app niet noemt, blijft zoals het bestand het zegt.
 */

import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { SiteConfig } from '../core/model.js';
import { zonePriorityFor } from '../core/voorrang.js';
import { STANDAARD_DAGDELEN, STANDAARD_KOEL, STANDAARD_PLAFOND_BOVEN, STANDAARD_WARM } from '../config/standaard.js';
import { HEAT_ASSIST_DEFAULTS } from '../core/strategies/heatAssist.js';

export const COMFORT_FILE = 'comfort.json';

/**
 * De dagdelen die de bewoner per kamer zet. Voorverwarmen heeft een eigen
 * temperatuur, alleen voor verwarmen (besluit 282); zet de app er niets, dan
 * volgt het de dag, zoals voor die tijd.
 */
export const COMFORT_MODES = ['dag', 'voorverwarmen', 'nacht', 'afwezig', 'vakantie'] as const;
export type ComfortMode = (typeof COMFORT_MODES)[number];

/**
 * De doelen van een kamer voor de configuratie: elk dagdeel dat de app noemt,
 * en voorverwarmen gelijk aan de dag als de app voorverwarmen niet noemt.
 * Anders verwarmt het 's ochtends naar een oud doel.
 */
export function doelenVanKamer(modi: ComfortRoom['modi'], setpoints: Record<string, unknown>): Record<string, unknown> {
  const uit = { ...setpoints };
  for (const m of COMFORT_MODES) {
    const pair = modi[m];
    if (pair == null) continue;
    uit[m] = { ...(pair.heat != null ? { heat: pair.heat } : {}), ...(pair.cool != null && m !== 'voorverwarmen' ? { cool: pair.cool } : {}) };
  }
  if (modi.voorverwarmen == null && modi.dag?.heat != null) uit['voorverwarmen'] = { heat: modi.dag.heat };
  return uit;
}

/** Grenzen voor de keuzes in de app, binnen wat het schema toestaat (5 tot 35). */
export const COMFORT_RANGE = { verwarmen: { min: 5, max: 28 }, koelen: { min: 16, max: 32 }, plafond: { min: 20, max: 32 } } as const;
/** Tussen verwarmen en koelen houdt de app minstens zoveel ruimte. */
export const COMFORT_GAP_C = 1;
/** Voorrang: eerst, daarna, laatst. */
export const PRIORITIES = [1, 2, 3] as const;
/** Hoeveel verder dan het doel het op zon mag (besluit 133); 0 is niet. */
export const OP_ZON_KEUZES = [0, 0.5, 1, 2] as const;

export interface ComfortPair {
  /** Verwarmen onder deze temperatuur; null is niet verwarmen. */
  readonly heat: number | null;
  /** Koelen boven deze temperatuur; null is niet koelen. */
  readonly cool: number | null;
}

export interface ComfortRoom {
  readonly modi: Readonly<Partial<Record<ComfortMode, ComfortPair>>>;
  /** Nooit warmer dan; null is geen plafond. Weg is zoals het bestand. */
  readonly nooitWarmerC?: number | null;
  /** 1 eerst, 2 daarna, 3 laatst. */
  readonly voorrang?: number;
  /** Op zon mag het zoveel graden verder dan het doel (besluit 133); 0 is niet. Weg is zoals het bestand. */
  readonly opZonC?: number;
}

/** Een plek in de lijst Op zon (besluit 176): een kamer die op zon verwarmt of koelt, een apparaat op zon, of een boiler of jacuzzi (besluit 186). */
export interface ZonPlek {
  readonly soort: 'kamer' | 'apparaat' | 'buffer';
  readonly id: string;
}

/** Hoe een plek in de lijst Op zon in de configuratie heet. */
const ZON_KIND = { kamer: 'zone', apparaat: 'deferrable', buffer: 'heatStore' } as const;

/** Voorrang per richting (besluit 134): de zones op volgorde, de eerste gaat voor. */
export interface ComfortVoorrang {
  readonly koelen: readonly string[];
  readonly verwarmen: readonly string[];
  /** Op zon (besluit 176): kamers en apparaten door elkaar; weg is eerst de kamers, dan de apparaten. */
  readonly zon?: readonly ZonPlek[];
}

export interface Comfort {
  readonly versie: 1;
  /** Het comfort van het huis: dat van de hoofdgebruiker, en van wie hem volgt (besluit 147). */
  readonly kamers: Readonly<Record<string, ComfortRoom>>;
  /** Een eigen comfort per bewoner (besluit 147): alleen de doelen en het plafond per kamer. */
  readonly profielen?: Readonly<Record<string, Readonly<Record<string, ComfortRoom>>>>;
  readonly voorrang?: ComfortVoorrang;
  readonly dagdelen?: { readonly voorverwarmen: number; readonly dag: number; readonly nacht: number };
  /**
   * Bijspringen per zone (besluit 283), van het huis: gezet bij Regeling ›
   * Klimaat. Weg is: aan, met de standaard van heat-assist.
   */
  readonly bijspringen?: Readonly<Record<string, Bijspringen>>;
}

/** Of de airco in een zone de hoofdverwarming helpt, en wanneer (besluit 283). */
export interface Bijspringen {
  readonly aan: boolean;
  /** Na zoveel minuten onafgebroken stoken. */
  readonly naMin: number;
  /** Vanaf zoveel graden onder het doel. */
  readonly vanafC: number;
}

/** De keuzes in de app: minuten in hele minuten, graden in tienden. */
export const BIJSPRINGEN_BEREIK = { naMin: { min: 1, max: 30 }, vanafC: { min: 0.1, max: 2 } } as const;

/* ------------------------------------------------------------- de weergave */

export interface ComfortRoomView {
  readonly id: string;
  readonly naam: string;
  readonly kanVerwarmen: boolean;
  readonly kanKoelen: boolean;
  readonly modi: Readonly<Record<ComfortMode, ComfortPair>>;
  readonly nooitWarmerC: number | null;
  readonly voorrang: number;
  /** Of de bewoner deze kamer in de app zette (anders: het bestand). */
  readonly uitApp: boolean;
  /**
   * Wanneer het aan- en uitgaat (besluit 133): verwarmen gaat aan onder doel
   * min `aan`, en uit bij doel plus `uit`; koelen andersom.
   */
  readonly hysterese: { readonly aan: number; readonly uit: number };
  /** Op zon mag het zoveel verder dan het doel; 0 is niet. */
  readonly opZonC: number;
  /** Wat er op zon kan: verwarmen, koelen. Alleen een assist of een apparaat dat ook op zon mag. */
  readonly opZon: { readonly verwarmen: boolean; readonly koelen: boolean };
  /** Of het hoofdapparaat zelf koelt, van het net; anders koelt het van het net pas boven nooit warmer dan. */
  readonly koeltVanNet: boolean;
  /**
   * Wat de apparaten in de kamer kunnen (28 oktober 2026): van de laagste tot
   * de hoogste stand, voor verwarmen en koelen apart; null als niets het kan.
   * Een doel daarbuiten weigert de dienst, dus de app blijft erbinnen.
   */
  readonly haalbaar: { readonly verwarmen: readonly [number, number] | null; readonly koelen: readonly [number, number] | null };
}

/** Wiens comfort het is (besluit 147), en of je het mag aanpassen. */
export interface ComfortVan {
  readonly id: string | null;
  readonly naam: string | null;
  readonly hoofd: boolean;
  /** Volgt de hoofdgebruiker: aanpassen maakt het een eigen comfort. */
  readonly volgt: boolean;
  readonly hoofdNaam: string | null;
  readonly magAanpassen: boolean;
  /** De bewoners om tussen te kiezen, als je dat mag. */
  readonly bewoners: readonly { readonly id: string; readonly naam: string }[];
}

export interface ComfortView {
  /** Wiens comfort dit is (besluit 147); weg zonder bewoners. */
  readonly van?: ComfortVan;
  readonly kamers: readonly ComfortRoomView[];
  /** Wie voorgaat bij weinig zon, per richting (besluit 134): alleen kamers die het kunnen. */
  readonly voorrang: ComfortVoorrang & { readonly zon: readonly ZonPlek[] };
  /** De apparaten op zon (besluit 176), met hun naam, voor de lijst Op zon. */
  readonly apparatenOpZon: readonly { readonly id: string; readonly naam: string }[];
  readonly dagdelen: { readonly voorverwarmen: number; readonly dag: number; readonly nacht: number };
  readonly bereik: typeof COMFORT_RANGE;
  /** De standaard voor een nieuw huis (besluit 204), voor "terug naar standaard" en een nieuw doel. */
  readonly standaard: typeof STANDAARD_VIEW;
}

/** De standaard zoals de app hem krijgt (besluit 204). */
const STANDAARD_VIEW = { warm: STANDAARD_WARM, koel: STANDAARD_KOEL, dagdelen: STANDAARD_DAGDELEN, plafondBoven: STANDAARD_PLAFOND_BOVEN } as const;

/** Van de laagste tot de hoogste stand die een van deze apparaten kan, of null zonder apparaat. */
function haalbaarVan(devices: readonly { readonly capabilities: { readonly setpointRange: readonly [number, number] } }[]): [number, number] | null {
  if (!devices.length) return null;
  return [Math.min(...devices.map((a) => a.capabilities.setpointRange[0])), Math.max(...devices.map((a) => a.capabilities.setpointRange[1]))];
}

/** Wat er nu geldt: de configuratie zoals de dienst hem gebruikt, met wat de app zette. */
export function comfortView(config: SiteConfig, comfort: Comfort | null): ComfortView {
  const kamers = config.zones.map((z): ComfortRoomView => {
    const devices = z.actuatorIds.map((id) => config.actuators.find((a) => a.id === id)).filter((a) => a != null);
    const modi = Object.fromEntries(COMFORT_MODES.map((m) => [m, { heat: z.setpoints[m]?.heat ?? null, cool: z.setpoints[m]?.cool ?? null }])) as Record<ComfortMode, ComfortPair>;
    return {
      id: z.id,
      naam: z.name,
      kanVerwarmen: devices.some((a) => a.capabilities.canHeat),
      kanKoelen: devices.some((a) => a.capabilities.canCool),
      modi,
      nooitWarmerC: z.comfortMaxC ?? null,
      voorrang: Math.max(1, Math.min(3, z.priority)),
      uitApp: comfort?.kamers[z.id] != null,
      hysterese: { aan: z.hysteresis.onDelta, uit: z.hysteresis.offDelta },
      opZonC: z.buffering.enabled ? z.buffering.bandC : 0,
      opZon: {
        verwarmen: devices.some((a) => a.capabilities.canHeat && (a.role === 'assist' || a.onSurplus === true)),
        koelen: devices.some((a) => a.capabilities.canCool && (a.role === 'assist' || a.onSurplus === true)),
      },
      koeltVanNet: devices.some((a) => a.role === 'primary' && a.capabilities.canCool),
      haalbaar: { verwarmen: haalbaarVan(devices.filter((a) => a.capabilities.canHeat)), koelen: haalbaarVan(devices.filter((a) => a.capabilities.canCool)) },
    };
  });
  const s = config.schedule;
  const opVolgorde = (actie: 'heat' | 'cool', kan: (k: ComfortRoomView) => boolean) =>
    config.zones
      .filter((z) => { const k = kamers.find((x) => x.id === z.id); return k != null && kan(k); })
      .map((z, i) => ({ id: z.id, p: zonePriorityFor(z, actie), i }))
      .sort((a, b) => a.p - b.p || a.i - b.i)
      .map((x) => x.id);
  /*
   * Op zon (besluit 176): de kamers die op zon iets doen en de apparaten op zon.
   * Zoals de configuratie het zegt; wat er niet in staat achteraan, eerst de
   * kamers en dan de apparaten, zoals de regeling het dan ook doet.
   */
  const apparatenOpZon = [...(config.deferrables ?? []), ...(config.heatStores ?? [])].map((d) => ({ id: d.id, naam: d.name }));
  const alleOpZon: ZonPlek[] = [
    ...kamers.filter((k) => k.opZon.verwarmen || k.opZon.koelen).map((k) => ({ soort: 'kamer' as const, id: k.id })),
    ...(config.deferrables ?? []).map((a) => ({ soort: 'apparaat' as const, id: a.id })),
    ...(config.heatStores ?? []).map((a) => ({ soort: 'buffer' as const, id: a.id })),
  ];
  const plekVan = (z: ZonPlek) => (config.sunOrder ?? []).findIndex((s) => s.id === z.id && s.kind === ZON_KIND[z.soort]);
  const zon = alleOpZon
    .map((z, i) => ({ z, p: plekVan(z), i }))
    .sort((a, b) => (a.p < 0 ? Infinity : a.p) - (b.p < 0 ? Infinity : b.p) || a.i - b.i)
    .map((x) => x.z);
  const voorrang = { koelen: opVolgorde('cool', (k) => k.kanKoelen), verwarmen: opVolgorde('heat', (k) => k.kanVerwarmen), zon };
  return { kamers, voorrang, apparatenOpZon, dagdelen: { voorverwarmen: s.preheatFromHour, dag: s.dayFromHour, nacht: s.nightFromHour }, bereik: COMFORT_RANGE, standaard: STANDAARD_VIEW };
}

/**
 * Het eigen comfort van een bewoner (besluit 147), als weergave: de zones met
 * zijn doelen en plafond erover. Voorrang, op zon en de dagdelen zijn van het
 * huis; die blijven zoals ze zijn.
 */
export function comfortViewVoorProfiel(config: SiteConfig, kamers: Readonly<Record<string, ComfortRoom>>): ComfortView {
  const zones = config.zones.map((z) => {
    const k = kamers[z.id];
    if (k == null) return z;
    const setpoints = doelenVanKamer(k.modi, z.setpoints) as typeof z.setpoints;
    const { comfortMaxC: _plafond, ...rest } = z;
    const plafond = k.nooitWarmerC === undefined ? z.comfortMaxC : k.nooitWarmerC;
    return { ...rest, setpoints, ...(plafond != null ? { comfortMaxC: plafond } : {}) };
  });
  return comfortView({ ...config, zones }, { versie: 1, kamers });
}

/* -------------------------------------------------------- over het bestand */

/**
 * Legt comfort over de ruwe configuratie (de JSON van het bestand). Geeft
 * de nieuwe ruwe configuratie en wat er veranderde, in gewone woorden.
 */
export function withComfort(raw: Record<string, unknown>, comfort: Comfort | null): { raw: Record<string, unknown>; toegevoegd: string[] } {
  if (comfort == null) return { raw, toegevoegd: [] };
  const toegevoegd: string[] = [];
  const zones = Array.isArray(raw['zones']) ? (raw['zones'] as Record<string, unknown>[]) : [];
  const nieuweZones = zones.map((zone) => {
    const id = String(zone['id'] ?? '');
    const kamer = comfort.kamers[id];
    if (kamer == null) return zone;
    const setpoints = doelenVanKamer(kamer.modi, (zone['setpoints'] as Record<string, unknown> | undefined) ?? {});
    const uit: Record<string, unknown> = { ...zone, setpoints };
    if (kamer.nooitWarmerC !== undefined) {
      if (kamer.nooitWarmerC == null) delete uit['comfortMaxC'];
      else uit['comfortMaxC'] = kamer.nooitWarmerC;
    }
    if (kamer.voorrang != null) uit['priority'] = kamer.voorrang;
    // Op zon (besluit 133): de buffer van de zone.
    if (kamer.opZonC != null) uit['buffering'] = { ...((zone['buffering'] as Record<string, unknown> | undefined) ?? {}), enabled: kamer.opZonC > 0, bandC: kamer.opZonC };
    toegevoegd.push(`comfort van ${String(zone['name'] ?? id)}`);
    return uit;
  }).map((zone) => {
    // Bijspringen per zone (besluit 283): los van het comfort van de kamer.
    const b = comfort.bijspringen?.[String(zone['id'] ?? '')];
    return b ? { ...zone, heatAssist: { enabled: b.aan, startDelayMinutes: b.naMin, minShortfallC: b.vanafC } } : zone;
  });
  if (comfort.bijspringen && Object.keys(comfort.bijspringen).length) toegevoegd.push('bijspringen per kamer');
  // Voorrang per richting (besluit 134): de plek in de lijst wordt de voorrang.
  const metVoorrang = comfort.voorrang
    ? nieuweZones.map((zone) => {
        const id = String(zone['id'] ?? '');
        const k = comfort.voorrang!.koelen.indexOf(id);
        const w = comfort.voorrang!.verwarmen.indexOf(id);
        if (k < 0 && w < 0) return zone;
        return { ...zone, priorityByAction: { ...(w >= 0 ? { heat: w + 1 } : {}), ...(k >= 0 ? { cool: k + 1 } : {}) } };
      })
    : nieuweZones;
  if (comfort.voorrang) toegevoegd.push('de voorrang bij koelen en verwarmen');
  const out: Record<string, unknown> = { ...raw, zones: metVoorrang };
  // Op zon (besluit 176): kamers en apparaten in één volgorde voor de regeling.
  if (comfort.voorrang?.zon) {
    out['sunOrder'] = comfort.voorrang.zon.map((z) => ({ kind: ZON_KIND[z.soort], id: z.id }));
    toegevoegd.push('de volgorde op zon');
  }
  /*
   * De app wint (besluit 143). Tijdens het meekijken las de regeling de doelen
   * live uit de helpers van het oude systeem (`migration.setpoints`); die
   * overschreven wat de bewoner in de app zette. Een kamer met comfort uit de
   * app rekent nu met dat comfort; de helpers tellen alleen nog voor de rest.
   */
  const mig = raw['migration'] as Record<string, unknown> | undefined;
  const sp = mig?.['setpoints'] as Record<string, unknown> | undefined;
  if (sp && Object.keys(sp).some((z) => comfort.kamers[z] != null)) {
    out['migration'] = { ...mig, setpoints: Object.fromEntries(Object.entries(sp).filter(([z]) => comfort.kamers[z] == null)) };
    toegevoegd.push('comfort uit de app gaat voor de helpers van het oude systeem');
  }
  if (comfort.dagdelen) {
    const schedule = { ...((raw['schedule'] as Record<string, unknown> | undefined) ?? {}) };
    schedule['preheatFromHour'] = comfort.dagdelen.voorverwarmen;
    schedule['dayFromHour'] = comfort.dagdelen.dag;
    schedule['nightFromHour'] = comfort.dagdelen.nacht;
    out['schedule'] = schedule;
    toegevoegd.push('de dagdelen');
  }
  return { raw: out, toegevoegd };
}

/* ------------------------------------------------------------ controleren */

export type ComfortCheck = { readonly ok: true; readonly comfort: Comfort } | { readonly ok: false; readonly reden: string };

const halve = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.round(v * 2) === v * 2;

/** Alleen kamers die de configuratie kent, en waarden die de regeling aankan. */
export function controleerComfort(body: unknown, config: SiteConfig): ComfortCheck {
  if (typeof body !== 'object' || body == null || Array.isArray(body)) return { ok: false, reden: 'verwacht een object' };
  const b = body as Record<string, unknown>;
  const kamersIn = b['kamers'];
  if (typeof kamersIn !== 'object' || kamersIn == null || Array.isArray(kamersIn)) return { ok: false, reden: 'kamers hoort een object te zijn' };
  const kamers: Record<string, ComfortRoom> = {};
  for (const [id, waarde] of Object.entries(kamersIn as Record<string, unknown>)) {
    const zone = config.zones.find((z) => z.id === id);
    if (zone == null) return { ok: false, reden: `die kamer kent de regeling niet: ${id}` };
    if (typeof waarde !== 'object' || waarde == null) return { ok: false, reden: `${zone.name}: verwacht een object` };
    const w = waarde as Record<string, unknown>;
    const modiIn = (w['modi'] ?? {}) as Record<string, unknown>;
    const modi: Partial<Record<ComfortMode, ComfortPair>> = {};
    for (const [m, p] of Object.entries(modiIn)) {
      if (!(COMFORT_MODES as readonly string[]).includes(m)) return { ok: false, reden: `${m} is geen dagdeel` };
      const pair = (p ?? {}) as Record<string, unknown>;
      const heat = pair['heat'] ?? null;
      const cool = pair['cool'] ?? null;
      if (m === 'voorverwarmen' && cool !== null) return { ok: false, reden: `${zone.name}, voorverwarmen: dat is alleen verwarmen` };
      if (heat !== null && (!halve(heat) || heat < COMFORT_RANGE.verwarmen.min || heat > COMFORT_RANGE.verwarmen.max)) {
        return { ok: false, reden: `${zone.name}, ${m}: verwarmen gaat van ${COMFORT_RANGE.verwarmen.min} tot ${COMFORT_RANGE.verwarmen.max}°, in halve graden` };
      }
      if (cool !== null && (!halve(cool) || cool < COMFORT_RANGE.koelen.min || cool > COMFORT_RANGE.koelen.max)) {
        return { ok: false, reden: `${zone.name}, ${m}: koelen gaat van ${COMFORT_RANGE.koelen.min} tot ${COMFORT_RANGE.koelen.max}°, in halve graden` };
      }
      if (heat !== null && cool !== null && (cool as number) - (heat as number) < COMFORT_GAP_C) {
        return { ok: false, reden: `${zone.name}, ${m}: koelen hoort minstens ${COMFORT_GAP_C}° boven verwarmen te liggen` };
      }
      modi[m as ComfortMode] = { heat: heat as number | null, cool: cool as number | null };
    }
    const kamer: { -readonly [K in keyof ComfortRoom]: ComfortRoom[K] } = { modi };
    if (w['nooitWarmerC'] !== undefined) {
      const v = w['nooitWarmerC'];
      if (v !== null && (!halve(v) || v < COMFORT_RANGE.plafond.min || v > COMFORT_RANGE.plafond.max)) {
        return { ok: false, reden: `${zone.name}: nooit warmer dan gaat van ${COMFORT_RANGE.plafond.min} tot ${COMFORT_RANGE.plafond.max}°` };
      }
      kamer.nooitWarmerC = v as number | null;
    }
    if (w['voorrang'] !== undefined) {
      if (!(PRIORITIES as readonly unknown[]).includes(w['voorrang'])) return { ok: false, reden: `${zone.name}: voorrang is 1, 2 of 3` };
      kamer.voorrang = w['voorrang'] as number;
    }
    if (w['opZonC'] !== undefined && w['opZonC'] !== null) {
      if (!(OP_ZON_KEUZES as readonly unknown[]).includes(w['opZonC'])) return { ok: false, reden: `${zone.name}: op zon is ${OP_ZON_KEUZES.join(', ')} graden` };
      kamer.opZonC = w['opZonC'] as number;
    }
    kamers[id] = kamer;
  }
  // Voorrang per richting (besluit 134): bekende zones, elk hooguit één keer.
  let voorrang: ComfortVoorrang | undefined;
  if (b['voorrang'] !== undefined && b['voorrang'] !== null) {
    const v = b['voorrang'] as Record<string, unknown>;
    const lijst = (x: unknown) => Array.isArray(x) && x.every((id) => typeof id === 'string' && config.zones.some((z) => z.id === id)) && new Set(x).size === x.length;
    if (!lijst(v['koelen']) || !lijst(v['verwarmen'])) return { ok: false, reden: 'voorrang is per richting een lijst van kamers, elk één keer' };
    voorrang = { koelen: v['koelen'] as string[], verwarmen: v['verwarmen'] as string[] };
    // Op zon (besluit 176): bekende kamers en apparaten, elk één keer.
    if (v['zon'] !== undefined && v['zon'] !== null) {
      const zon = v['zon'];
      const bekend = (x: unknown): x is ZonPlek => {
        if (typeof x !== 'object' || x == null) return false;
        const { soort, id } = x as Record<string, unknown>;
        return (
          (soort === 'kamer' && config.zones.some((z) => z.id === id)) ||
          (soort === 'apparaat' && (config.deferrables ?? []).some((d) => d.id === id)) ||
          (soort === 'buffer' && (config.heatStores ?? []).some((h) => h.id === id))
        );
      };
      if (!Array.isArray(zon) || !zon.every(bekend) || new Set(zon.map((z) => `${z.soort}:${z.id}`)).size !== zon.length) {
        return { ok: false, reden: 'op zon is een lijst van kamers en apparaten, elk één keer' };
      }
      voorrang = { ...voorrang, zon: zon.map((z) => ({ soort: z.soort, id: z.id })) };
    }
  }
  let dagdelen: Comfort['dagdelen'];
  if (b['dagdelen'] !== undefined && b['dagdelen'] !== null) {
    const d = b['dagdelen'] as Record<string, unknown>;
    const uur = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 23;
    if (!uur(d['voorverwarmen']) || !uur(d['dag']) || !uur(d['nacht'])) return { ok: false, reden: 'de dagdelen zijn hele uren van 0 tot 23' };
    const [v, dg, n] = [d['voorverwarmen'] as number, d['dag'] as number, d['nacht'] as number];
    if (!(v < dg && dg < n)) return { ok: false, reden: 'voorverwarmen begint voor de dag, en de dag voor de nacht' };
    dagdelen = { voorverwarmen: v, dag: dg, nacht: n };
  }
  return { ok: true, comfort: { versie: 1, kamers, ...(voorrang ? { voorrang } : {}), ...(dagdelen ? { dagdelen } : {}) } };
}

/* ------------------------------------------------------------ bijspringen */

/** Bijspringen per zone zoals de app het toont (besluit 283). */
export interface BijspringenZone extends Bijspringen {
  readonly zoneId: string;
  /** De airco's die bijspringen, op naam. */
  readonly apparaten: readonly string[];
}

/**
 * De zones waar bijspringen kan: een hoofdverwarming die stookt en een
 * airco die mag helpen, allebei met verwarmen. Met wat er nu geldt.
 */
export interface BijspringenView {
  readonly zones: readonly BijspringenZone[];
  readonly bereik: typeof BIJSPRINGEN_BEREIK;
  readonly standaard: Bijspringen;
}

export function bijspringenView(config: SiteConfig): BijspringenView {
  const standaard = { aan: true, naMin: HEAT_ASSIST_DEFAULTS.startDelayMinutes, vanafC: HEAT_ASSIST_DEFAULTS.minShortfallC };
  const zones = config.zones.flatMap((z): BijspringenZone[] => {
    const devices = z.actuatorIds.map((id) => config.actuators.find((a) => a.id === id)).filter((a) => a != null);
    const helpers = devices.filter((a) => a.role === 'assist' && a.capabilities.canHeat);
    if (!helpers.length || !devices.some((a) => a.role === 'primary' && a.capabilities.canHeat)) return [];
    const h = z.heatAssist;
    return [{ zoneId: z.id, apparaten: helpers.map((a) => a.name), aan: h?.enabled ?? standaard.aan, naMin: h?.startDelayMinutes ?? standaard.naMin, vanafC: h?.minShortfallC ?? standaard.vanafC }];
  });
  return { zones, bereik: BIJSPRINGEN_BEREIK, standaard };
}

/** Eén zone uit wat de pagina stuurt: `{ zone, aan, naMin, vanafC }`. */
export function controleerBijspringen(body: unknown, config: SiteConfig): { ok: true; zone: string; waarde: Bijspringen } | { ok: false; reden: string } {
  if (typeof body !== 'object' || body == null || Array.isArray(body)) return { ok: false, reden: 'verwacht een object' };
  const b = body as Record<string, unknown>;
  const zone = b['zone'];
  if (typeof zone !== 'string' || !bijspringenView(config).zones.some((z) => z.zoneId === zone)) return { ok: false, reden: 'in die kamer kan niets bijspringen' };
  if (typeof b['aan'] !== 'boolean') return { ok: false, reden: 'aan is ja of nee' };
  const naMin = b['naMin'];
  const vanafC = b['vanafC'];
  const { naMin: m, vanafC: c } = BIJSPRINGEN_BEREIK;
  if (typeof naMin !== 'number' || !Number.isInteger(naMin) || naMin < m.min || naMin > m.max) return { ok: false, reden: `na ${m.min} tot ${m.max} minuten, in hele minuten` };
  if (typeof vanafC !== 'number' || Math.abs(Math.round(vanafC * 10) - vanafC * 10) > 1e-9 || vanafC < c.min || vanafC > c.max) return { ok: false, reden: `vanaf ${c.min} tot ${c.max} graden, in tienden` };
  return { ok: true, zone, waarde: { aan: b['aan'], naMin, vanafC } };
}

/* -------------------------------------------------------------- bewaren */

export class ComfortStore {
  readonly #path: string;
  #current: Comfort | null = null;
  #writing: Promise<void> = Promise.resolve();

  constructor(logDir: string) {
    this.#path = join(logDir, COMFORT_FILE);
  }

  async load(): Promise<Comfort | null> {
    try {
      const raw = JSON.parse(await readFile(this.#path, 'utf-8')) as { versie?: unknown };
      this.#current = raw?.versie === 1 ? (raw as Comfort) : null;
    } catch {
      this.#current = null;
    }
    return this.#current;
  }

  get current(): Comfort | null {
    return this.#current;
  }

  async save(c: Comfort): Promise<void> {
    this.#current = c;
    const text = `${JSON.stringify(c, null, 2)}\n`;
    const tmp = `${this.#path}.nieuw`;
    this.#writing = this.#writing.catch(() => {}).then(async () => {
      await writeFile(tmp, text, 'utf-8');
      await rename(tmp, this.#path);
    });
    await this.#writing;
  }
}
