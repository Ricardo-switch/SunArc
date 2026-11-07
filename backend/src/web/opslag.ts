/*
 * De thuisbatterij, de auto's en de laadpalen (besluit 182, schets
 * Thuis-Tel-Kaarten; meerdere sinds besluit 259): wat de app ervan laat zien,
 * alleen lezen. Tot besluit 182 sloeg de app ze bewust over, bij de batterijen
 * van kleine apparaten (besluit 127); nu krijgen ze een eigen kaart op Thuis
 * en bij Apparaten, als het huis ze heeft.
 *
 * Home Assistant kent geen vaste soort voor een thuisbatterij, een auto of een
 * laadpaal. Herkennen gaat daarom per apparaat, per rol, op wat het meet en
 * wie het levert (docs/auto-en-laadpaal.md):
 *
 *  - **een auto:** een apparaat met een actieradius (`distance`), of van een
 *    koppeling voor auto's (Tesla, Volkswagen, Kia, Nissan, ...);
 *  - **een laadpaal:** een apparaat van een koppeling voor laadpalen (Easee,
 *    Zaptec, Wallbox, ...). Zonder auto in Home Assistant is de laadpaal de
 *    auto: hij weet of er een auto aan hangt en of die laadt;
 *  - **evcc:** de laadpunten van evcc (HACS). Die regelen zelf het laden; ze
 *    tellen niet als auto of laadpaal, maar de app zegt dat evcc er is;
 *  - **een thuisbatterij:** een apparaat met een lading in procenten dat
 *    energie opslaat (`energy_storage`), of van een koppeling of een type
 *    voor thuisbatterijen (Powerwall, Sessy, Marstek, ...), en geen auto.
 *
 * Wat de app vond, kan de bewoner bij Energie › Auto en laadpaal uitzetten,
 * en hij kan zelf een ander apparaat kiezen als auto of laadpaal (besluit
 * 259, stap 1). Per auto vult hij de accu in, aan welke laadpaal hij laadt en
 * waar hij in de tekening staat; dat staat in `aansluiting.json`.
 *
 * Wat een batterij doet, volgt uit het vermogen: wat er naar de batterij gaat
 * is laden, wat eruit komt is leveren. Niet elke koppeling telt even: een
 * vermogen met "discharge" of "ontlaad" in de naam is leveren, en een paar
 * merken tellen omgekeerd (`LEVEREN_POSITIEF`). Weet de app het niet zeker,
 * dan zegt hij alleen het percentage.
 */

import type { HaEntityState } from '../adapters/homeassistant/client.js';
import type { HaDevice, HaRegistryEntity } from '../adapters/homeassistant/discovery.js';

export interface Thuisbatterij {
  readonly id: string;
  readonly naam: string;
  /** De lading in procenten, of null als het apparaat het niet zegt. */
  readonly pct: number | null;
  /** Het vermogen in watt: positief is laden, negatief is leveren aan het huis. */
  readonly vermogenW: number | null;
  readonly stand: 'laadt' | 'levert' | 'rust' | null;
}

/** Waar een auto in de tekening staat (besluit 259, idee 123). */
export const AUTO_PLEKKEN = ['oprit', 'carport', 'garage'] as const;
export type AutoPlek = (typeof AUTO_PLEKKEN)[number];
export type LaadRol = 'auto' | 'laadpaal';

export interface Auto {
  readonly id: string;
  readonly naam: string;
  readonly pct: number | null;
  /** Of er een kabel in zit; null als niets het meet. */
  readonly aangesloten: boolean | null;
  readonly laadt: boolean | null;
  /** Het laadvermogen in watt, of null. */
  readonly vermogenW: number | null;
  /** Het bereik in kilometers, of null. */
  readonly bereikKm: number | null;
  /** Waar hij in de tekening staat, als de bewoner het koos; null: zoals de indeling zegt. */
  readonly plek: AutoPlek | null;
  /** De accu in kWh, als de bewoner hem invulde. */
  readonly accuKWh: number | null;
  /** De laadpaal waar hij aan laadt, of null. */
  readonly laadpaal: string | null;
  /*
   * Voor de pagina Auto (besluit 259, stap 2): alleen wat Home Assistant
   * meet, of wat er eerlijk uit volgt.
   */
  /** De naam van de laadpaal, of null zonder laadpaal. */
  readonly paalNaam: string | null;
  /** De laagste en hoogste stroom van de laadpaal in A, als hij die kent. */
  readonly paalStroomA: { readonly min: number; readonly max: number } | null;
  /** De laadgrens in procenten, zoals ingesteld in de auto of de laadpaal. */
  readonly laadgrens: number | null;
  /** De stroom per fase in A, gemeten; null als niets het meet. */
  readonly stroomA: readonly number[] | null;
  /** Hoe laat hij op de laadgrens is (ISO): van de auto zelf, of berekend uit de accu en het vermogen. */
  readonly volOm: string | null;
  /** Of de auto thuis is, uit zijn plek in Home Assistant; null als niets het zegt. */
  readonly thuis: boolean | null;
  /** Sinds wanneer de kabel erin zit (ISO), of sinds wanneer de auto weg is. */
  readonly kabelSinds: string | null;
  readonly wegSinds: string | null;
  /** Wat de laadpaal zegt bij een fout, zoals "error" of "faulted"; null zonder fout (stap 6). */
  readonly fout: string | null;
}

/**
 * Energie › Thuisaccu (besluit 271, issue 145): per accu welke sensor wat is.
 * Weg of null: wat de app zelf vond. Elk is een entiteit uit Home Assistant.
 */
export interface AccuInstelling {
  /** De lading in procenten. */
  readonly lading?: string | null;
  /** Het vermogen van nu, in W of kW. */
  readonly vermogen?: string | null;
  /** Wat plus betekent bij het vermogen: laden (zoals de meeste) of leveren (zoals een Powerwall). */
  readonly teken?: AccuTeken | null;
  /** Hoeveel hij in totaal laadde en leverde, in kWh. */
  readonly geladen?: string | null;
  readonly geleverd?: string | null;
}

export const ACCU_TEKENS = ['laden', 'leveren'] as const;
export type AccuTeken = (typeof ACCU_TEKENS)[number];
export const ACCU_ROLLEN = ['lading', 'vermogen', 'geladen', 'geleverd'] as const;
export type AccuRol = (typeof ACCU_ROLLEN)[number];

/** De keuzes bij Energie › Thuisaccu (besluit 271), in `aansluiting.json`. */
export interface AccuKeuze {
  /** Per apparaat aan of uit; weg is aan, voor wat de app vond. */
  readonly aan: Readonly<Record<string, boolean>>;
  /** Apparaten die de bewoner zelf als accu koos, zoals een apparaat van Homey. */
  readonly zelf: readonly string[];
  readonly instelling: Readonly<Record<string, AccuInstelling>>;
}

/** Een accu op de pagina Energie › Thuisaccu (besluit 271). */
export interface AccuApparaat {
  readonly id: string;
  readonly naam: string;
  readonly merk: string | null;
  readonly aan: boolean;
  /** Zelf gekozen: de app vond hem niet vanzelf. */
  readonly zelf: boolean;
  /** Welke sensor nu welke rol heeft: gekozen, of wat de app zelf vond. */
  readonly sensoren: Readonly<Record<AccuRol, string | null>>;
  /** Welke rollen de bewoner zelf koos. */
  readonly gekozen: readonly AccuRol[];
  readonly teken: AccuTeken;
  /** Apart laden en ontladen, zoals een Huawei: dan doet het teken er niet toe. */
  readonly ontlaadVermogen: string | null;
  /** Wat hij nu doet, met het teken toegepast: plus is laden. */
  readonly pct: number | null;
  readonly vermogenW: number | null;
}

/** Een sensor om uit te kiezen bij Energie › Thuisaccu: een lading, een vermogen of een totaal in kWh. */
export interface AccuSensor {
  readonly id: string;
  readonly naam: string;
  readonly soort: 'lading' | 'vermogen' | 'energie';
  /** Het apparaat waar hij onder staat, of null. */
  readonly apparaat: string | null;
  readonly staat: number | null;
  readonly eenheid: string;
}

/** Energie › Thuisaccu (besluit 271): wat gevonden is, en wat er te kiezen is. */
export interface AccuView {
  readonly apparaten: readonly AccuApparaat[];
  /** Andere apparaten die een lading of een vermogen met energie meten, om zelf te kiezen. */
  readonly kandidaten: readonly { readonly id: string; readonly naam: string }[];
  readonly sensoren: readonly AccuSensor[];
}

export interface Opslag {
  readonly batterij: Thuisbatterij | null;
  /** De eerste auto, voor de kaart op Thuis en bij Apparaten; null zonder auto of laadpaal. */
  readonly auto: Auto | null;
  /** Alle auto's (besluit 259); een laadpaal zonder auto telt als auto. */
  readonly autos: readonly Auto[];
}

/** Per auto wat de bewoner invulde (besluit 259). */
export interface AutoInstelling {
  readonly accuKWh: number | null;
  readonly laadpaal: string | null;
  readonly plek: AutoPlek | null;
  /**
   * Kabel vergeten (stap 6, besluit 263): om hoe laat de app 's avonds kijkt,
   * en onder welk % hij aan de kabel moet; `pct` null is uit. Weg is 21:00 en 50%.
   */
  readonly kabel?: { readonly om: string; readonly pct: number | null };
}

/** Kabel vergeten zonder keuze: om negen uur 's avonds, onder de helft. */
export const KABEL_STANDAARD = { om: '21:00', pct: 50 } as const;
export const KABEL_PCT = [30, 50, 70] as const;

/** De keuzes bij Energie › Auto en laadpaal (besluit 259), in `aansluiting.json`. */
export interface LadenKeuze {
  /** Per apparaat aan of uit; weg is aan, voor wat de app vond. */
  readonly aan: Readonly<Record<string, boolean>>;
  /** Apparaten die de bewoner zelf koos, of waarvan hij de rol verbeterde. */
  readonly rol: Readonly<Record<string, LaadRol>>;
  /** Per auto of laadpaal de accu, de laadpaal en de plek. */
  readonly instelling: Readonly<Record<string, AutoInstelling>>;
  /** Per apparaat of SunArc het met de hand mag bedienen (stap 5, besluit 262); weg is nee. */
  readonly bedienen?: Readonly<Record<string, boolean>>;
}

/** Wat een auto of laadpaal in Home Assistant meet of kan (docs/auto-en-laadpaal.md). */
export const LAAD_WAT = ['lading', 'bereik', 'laadgrens', 'kabel', 'laadt', 'thuis', 'vermogen', 'stroom', 'sessie', 'stand', 'stroomZetten', 'pauzeren'] as const;
export type LaadWat = (typeof LAAD_WAT)[number];

export interface LaadApparaat {
  readonly id: string;
  readonly naam: string;
  readonly rol: LaadRol;
  /** Het merk of de koppeling, zoals "Tesla" of "Easee". */
  readonly merk: string | null;
  readonly wat: readonly LaadWat[];
  readonly aan: boolean;
  /** Zelf gekozen: de app vond hem niet vanzelf. */
  readonly zelf: boolean;
  /** Bij een laadpaal: de laagste en hoogste stroom die hij kent, in A. */
  readonly stroomA: { readonly min: number; readonly max: number } | null;
  /** Of SunArc hem met de hand kan bedienen: een stroom in A om te zetten, of pauzeren (stap 5). */
  readonly kanBedienen: boolean;
  /** Of de bewoner het toeliet (besluit 262); weg is nee. */
  readonly bedienen: boolean;
}

/** Hoe SunArc een laadpaal (of een auto) pauzeert en weer laat laden (stap 5, besluit 262). */
export type LaadPauze =
  /** Een schakelaar: aan is laden, of bij een pauzeknop aan is pauze. */
  | { readonly soort: 'schakelaar'; readonly id: string; readonly omgekeerd: boolean }
  | { readonly soort: 'knoppen'; readonly pauze: string; readonly hervat: string };

/** Wat er aan een auto te bedienen is, en waarmee (stap 5, besluit 262). */
export interface LaadBediening {
  readonly auto: string;
  /** Het apparaat met de knoppen: de laadpaal, anders de auto zelf. */
  readonly apparaat: string | null;
  /** De hoogste laadstroom in A: het getal in Home Assistant, met zijn bereik en stap. */
  readonly stroom: { readonly id: string; readonly min: number; readonly max: number; readonly stap: number; readonly nuA: number | null } | null;
  readonly pauze: LaadPauze | null;
  /** Of het mag: de bewoner zette het aan bij Energie, en evcc regelt het niet. */
  readonly mag: boolean;
  /** evcc regelt het laden; dan bedient SunArc de laadpaal niet zelf. */
  readonly evcc: boolean;
}

/** Energie › Auto en laadpaal (besluit 259): wat gevonden is, en wat er nog te kiezen is. */
export interface LadenView {
  readonly apparaten: readonly LaadApparaat[];
  /** Andere apparaten die iets meten wat bij laden hoort, om zelf te kiezen. */
  readonly kandidaten: readonly { readonly id: string; readonly naam: string }[];
  /** De laadpunten van evcc, als evcc er is. */
  readonly evcc: readonly { readonly id: string; readonly naam: string }[];
  readonly instelling: Readonly<Record<string, AutoInstelling>>;
}

const AUTO_KOPPELING = /^(tesla_fleet|teslemetry|tessie|tesla_custom|volkswagencarnet|volkswagen_we_connect_id|renault|kia_uvo|hyundai|bmw_connected_drive|mercedes_me|mbapi2020|polestar_api|nissan_leaf|nissan_connect|audiconnect|skodaconnect|myskoda|peugeot|stellantis|toyota|volvo|volvo_cars|ford|fordpass|mg_saic|byd|smart_hashtag|lynkco)$/;
const AUTO_MERK = /\b(volkswagen|renault|kia|hyundai|polestar|bmw|mercedes|audi|skoda|škoda|nissan|peugeot|toyota|volvo|ford|mg|cupra|lynk)\b/i;
const LAADPAAL_KOPPELING = /^(easee|zaptec|wallbox|alfen_wallbox|peblar|ohme|myenergi|go_echarger|goecharger|openevse|nrgkick|tesla_wall_connector|ocpp|evse_load_balancer|smappee)$/;
const LAADPAAL_MERK = /\b(easee|zaptec|wallbox|alfen|peblar|ohme|zappi|go-e|openevse|nrgkick|wall connector)\b/i;
/**
 * Koppelingen die een afstand of een plek meten maar nooit een auto of een
 * laadpaal zijn (6 november 2026): een iBeacon meet hoe ver de telefoon is,
 * Proximity hoe ver iemand van huis is. Eerst telde elke afstand als auto.
 */
const GEEN_AUTO_KOPPELING = /^(ibeacon|proximity|bermuda|private_ble_device|bluetooth_le_tracker|ble_monitor|espresense|mqtt_room|room_assistant|mobile_app|owntracks|life360|google_maps|icloud|icloud3|find_my|tile|homekit_controller|browser_mod|waze_travel_time|google_travel_time|here_travel_time|places|zone|person|sun|met|buienradar|openweathermap)$/;
/** Een sensor met het bereik van een auto: niet een afstand, maar hoe ver hij nog kan rijden. */
const BEREIK = /range|bereik|actieradius|autonomy|reichweite|autonomie/;
/** Een afstand die geen bereik is, zoals een geschatte afstand of een kilometerstand. */
const GEEN_BEREIK = /estimated|geschat|odometer|kilometerstand|mileage|distance.?to|afstand/;
/** evcc uit HACS (`evcc_intg`): laadpunten die zelf het laden regelen. */
const EVCC_KOPPELING = /^evcc/;
const BATTERIJ_KOPPELING = /^(powerwall|tesla_gateway|sessy|marstek|zendure|zendure_ha|victron|huawei_solar|sungrow|goodwe|solaredge|enphase_envoy|growatt_server|ecoflow|ecoflow_cloud|anker_solix|sonnen|sonnenbatterie|fronius|byd)$/;
const BATTERIJ_TYPE = /\b(batter(y|ij)|accu|powerwall|luna|storage|opslag|sessy|venus|solarbank|delta|sonnen)\b/i;
/** Merken die het vermogen van de batterij positief noemen als hij levert. */
const LEVEREN_POSITIEF = /^(powerwall|tesla_gateway|ecoflow|ecoflow_cloud)$/;
/** Onder dit vermogen doet hij niets: een paar watt is ruis. */
const RUST_W = 40;
/** Een laadgrens: tot hoe vol de auto laadt. */
const LAADGRENS = /charge.?limit|target.?soc|charge.?target|laadgrens|max.?soc|limit.?soc|soc.?limit/;
/** Een stroom die een grens is en geen meting, zoals de dynamische grens van een Easee. */
const GEEN_METING = /max|limit|offered|dynamic|allowed|grens|setpoint|target|circuit/;
/** Klaar om: een tijdstip of een resterende duur van de auto. */
const KLAAR_TIJD = /charg|laad|ready|klaar|full|vol\b|end|eind|finish/;
const KLAAR_DUUR = /remaining|resterend|time.?to|tijd.?tot|until|left|charg(e|ing).?(time|duration)|laadtijd/;
/** Een duur die al voorbij is, zoals hoe lang de laadbeurt al duurt. */
const GEEN_KLAAR = /elapsed|session|sessie|spent|verstreken|last|laatste/;
/** Het getal voor de hoogste laadstroom, zoals de dynamische stroom of "charging amps". */
const STROOM_ZET = /dynamic|charg|laad|current|stroom|amp/;
const GEEN_STROOM_ZET = /circuit|fallback|offline|fase|phase|min/;
/** Een schakelaar of knop om te laden of te pauzeren; niet het klimaat, de klep of een schema van de auto. */
const LAAD_KNOP = /charg|laad|pause|pauze|resume|hervat/;
const GEEN_LAAD_KNOP = /climat|klimaat|heat|verwarm|defrost|sentry|cabin|lock|slot|seat|stoel|steering|stuur|light|licht|port|klep|update|smart|schedul|gepland|precondition|boost|restart|reboot|herstart/;
/** Klassen die bij laden horen: een apparaat zonder geen ervan is geen kandidaat. */
const LAAD_KLASSEN = new Set(['battery', 'distance', 'power', 'current', 'energy', 'plug', 'battery_charging']);

const getal = (s: HaEntityState | undefined): number | null => {
  if (!s || s.state === '' || s.state === 'unknown' || s.state === 'unavailable') return null;
  const n = Number(s.state);
  return Number.isFinite(n) ? n : null;
};
/** Een vermogen in watt, ook als het in kW staat. */
const watt = (s: HaEntityState | undefined): number | null => {
  const n = getal(s);
  if (n == null) return null;
  const eenheid = String(s?.attributes['unit_of_measurement'] ?? 'W');
  return eenheid === 'kW' ? n * 1000 : eenheid === 'MW' ? n * 1e6 : n;
};

interface Apparaat {
  readonly device: HaDevice;
  readonly entiteiten: readonly HaRegistryEntity[];
  readonly platform: string;
}

type Registers = { readonly devices: readonly HaDevice[]; readonly entities: readonly HaRegistryEntity[] };

/** Per apparaat zijn entiteiten, en de hulpjes om te lezen wat ze meten. */
function lezer(registers: Registers, states: ReadonlyMap<string, HaEntityState>) {
  const klasse = (e: HaRegistryEntity) => e.device_class ?? e.original_device_class ?? (states.get(e.entity_id)?.attributes['device_class'] as string | undefined) ?? null;
  const perApparaat = new Map<string, HaRegistryEntity[]>();
  for (const e of registers.entities) {
    if (!e.device_id || e.disabled_by) continue;
    perApparaat.set(e.device_id, [...(perApparaat.get(e.device_id) ?? []), e]);
  }
  const apparaten: Apparaat[] = registers.devices.flatMap((d) => {
    const entiteiten = perApparaat.get(d.id) ?? [];
    return entiteiten.length ? [{ device: d, entiteiten, platform: entiteiten.find((e) => e.platform)?.platform ?? '' }] : [];
  });
  const merk = (a: Apparaat) => `${a.device.manufacturer ?? ''} ${a.device.model ?? ''} ${a.device.name ?? ''}`;
  const heeft = (a: Apparaat, k: string) => a.entiteiten.some((e) => klasse(e) === k);
  const naamVan = (e: HaRegistryEntity) => `${e.entity_id} ${e.name ?? e.original_name ?? ''} ${String(states.get(e.entity_id)?.attributes['friendly_name'] ?? '')}`.toLowerCase();
  /** De lading in procenten: een sensor met de klasse batterij. */
  const pctVan = (a: Apparaat): number | null => {
    for (const e of a.entiteiten) {
      if (!e.entity_id.startsWith('sensor.') || klasse(e) !== 'battery') continue;
      const s = states.get(e.entity_id);
      const n = getal(s);
      if (n != null && n >= 0 && n <= 100 && s?.attributes['unit_of_measurement'] === '%') return n;
    }
    return null;
  };
  const isEvcc = (a: Apparaat) => EVCC_KOPPELING.test(a.platform);
  /** Nooit een auto of laadpaal: evcc, of een koppeling voor plek en afstand. */
  const nooit = (a: Apparaat) => isEvcc(a) || GEEN_AUTO_KOPPELING.test(a.platform);
  /** Een bereik in km of mijl, met een naam die bij een auto past. */
  const heeftBereik = (a: Apparaat) =>
    a.entiteiten.some((e) => e.entity_id.startsWith('sensor.') && klasse(e) === 'distance' && BEREIK.test(naamVan(e)) && !GEEN_BEREIK.test(naamVan(e)));
  /** Iets wat alleen een auto meet: laden of een kabel erin. */
  const laadTeken = (a: Apparaat) => heeft(a, 'battery_charging') || heeft(a, 'plug');
  /*
   * Een auto (6 november 2026, strenger): een koppeling voor auto's, of een
   * bereik samen met een lading of laden, of een automerk met een lading en
   * een bereik of laden. Een afstand alleen is geen auto meer.
   */
  const isAuto = (a: Apparaat) =>
    !nooit(a) &&
    (AUTO_KOPPELING.test(a.platform) ||
      (heeftBereik(a) && (pctVan(a) != null || laadTeken(a))) ||
      (AUTO_MERK.test(merk(a)) && !BATTERIJ_TYPE.test(merk(a)) && pctVan(a) != null && (heeftBereik(a) || laadTeken(a))));
  /** Een laadpaal: een koppeling voor laadpalen, of een merk van laadpalen dat een vermogen, stroom of energie meet. */
  const isLaadpaal = (a: Apparaat) =>
    !nooit(a) && (LAADPAAL_KOPPELING.test(a.platform) || (LAADPAAL_MERK.test(merk(a)) && (heeft(a, 'power') || heeft(a, 'current') || heeft(a, 'energy'))));
  const isBatterij = (a: Apparaat) =>
    !isEvcc(a) && !isAuto(a) && !isLaadpaal(a) && pctVan(a) != null && (heeft(a, 'energy_storage') || BATTERIJ_KOPPELING.test(a.platform) || BATTERIJ_TYPE.test(merk(a)));
  return { klasse, apparaten, merk, heeft, naamVan, pctVan, isEvcc, isAuto, isLaadpaal, isBatterij };
}

/**
 * De auto's in Home Assistant, herkend aan wat ze meten (melding 132): hun
 * klimaatregeling hoort bij de auto, niet bij het huis.
 */
export function autoApparaten(registers: Registers, states: ReadonlyMap<string, HaEntityState>): Set<string> {
  const l = lezer(registers, states);
  return new Set(l.apparaten.filter(l.isAuto).map((a) => a.device.id));
}

const naamVanApparaat = (d: HaDevice) => d.name_by_user?.trim() || d.name?.trim() || d.model?.trim() || d.id;

/** Wat de app van een auto of laadpaal weet (besluit 259). */
function watVan(a: Apparaat, l: ReturnType<typeof lezer>, states: ReadonlyMap<string, HaEntityState>): { wat: LaadWat[]; stroomA: LaadApparaat['stroomA'] } {
  const wat = new Set<LaadWat>();
  let stroomA: LaadApparaat['stroomA'] = null;
  for (const e of a.entiteiten) {
    const k = l.klasse(e);
    const n = l.naamVan(e);
    const d = e.entity_id.split('.')[0];
    const s = states.get(e.entity_id);
    const eenheid = String(s?.attributes['unit_of_measurement'] ?? '');
    if (d === 'sensor' && k === 'battery' && eenheid === '%') wat.add('lading');
    if (d === 'sensor' && k === 'distance' && BEREIK.test(n) && !GEEN_BEREIK.test(n)) wat.add('bereik');
    if ((d === 'number' || d === 'sensor') && LAADGRENS.test(n)) wat.add('laadgrens');
    if (d === 'binary_sensor' && k === 'plug') wat.add('kabel');
    if (d === 'binary_sensor' && k === 'battery_charging') wat.add('laadt');
    if (d === 'device_tracker') wat.add('thuis');
    if (d === 'sensor' && k === 'power') wat.add('vermogen');
    if (d === 'sensor' && k === 'current') wat.add('stroom');
    if (d === 'sensor' && k === 'energy' && /session|sessie/.test(n)) wat.add('sessie');
    if (d === 'sensor' && k !== 'power' && k !== 'current' && k !== 'energy' && /status|state|stand/.test(n)) wat.add('stand');
    if (d === 'number' && eenheid === 'A') {
      wat.add('stroomZetten');
      const min = Number(s?.attributes['min']);
      const max = Number(s?.attributes['max']);
      if (Number.isFinite(min) && Number.isFinite(max) && max > min && max <= 80) stroomA = { min, max };
    }
    if ((d === 'switch' || d === 'button') && /charg|laad|pause|resume|start|stop/.test(n)) wat.add('pauzeren');
  }
  return { wat: LAAD_WAT.filter((w) => wat.has(w)), stroomA };
}

/** De auto's en laadpalen: wat de app vond en wat de bewoner zelf koos (besluit 259). */
function laadApparaten(l: ReturnType<typeof lezer>, states: ReadonlyMap<string, HaEntityState>, keuze: LadenKeuze | null, alsAccu: ReadonlySet<string> = new Set()): { lijst: (LaadApparaat & { readonly bron: Apparaat })[]; evcc: Apparaat[] } {
  const rolZelf = keuze?.rol ?? {};
  const lijst: (LaadApparaat & { readonly bron: Apparaat })[] = [];
  for (const a of l.apparaten) {
    // Wat de bewoner zelf als thuisaccu koos (besluit 271), is geen auto of laadpaal.
    if (alsAccu.has(a.device.id) && rolZelf[a.device.id] == null) continue;
    const gevonden: LaadRol | null = l.isAuto(a) ? 'auto' : l.isLaadpaal(a) ? 'laadpaal' : null;
    const rol = rolZelf[a.device.id] ?? gevonden;
    if (!rol) continue;
    const { wat, stroomA } = watVan(a, l, states);
    lijst.push({
      id: a.device.id,
      naam: naamVanApparaat(a.device),
      rol,
      merk: a.device.manufacturer?.trim() || a.platform || null,
      wat,
      aan: keuze?.aan[a.device.id] ?? true,
      zelf: gevonden == null,
      stroomA: rol === 'laadpaal' ? stroomA : null,
      kanBedienen: wat.includes('stroomZetten') || wat.includes('pauzeren'),
      bedienen: keuze?.bedienen?.[a.device.id] === true,
      bron: a,
    });
  }
  // Auto's eerst, dan de laadpalen; zo staat het ook op de pagina.
  lijst.sort((x, y) => (x.rol === y.rol ? 0 : x.rol === 'auto' ? -1 : 1) || x.naam.localeCompare(y.naam, 'nl'));
  return { lijst, evcc: l.apparaten.filter(l.isEvcc) };
}

/** De thuisbatterij en de auto's in Home Assistant, met de keuzes van de bewoner (besluit 259, 271). */
export function vindOpslag(registers: Registers, states: ReadonlyMap<string, HaEntityState>, keuze: LadenKeuze | null = null, nu: Date = new Date(), accuKeuze: AccuKeuze | null = null): Opslag {
  return opslagMet(registers, states, keuze, nu, accuKeuze).opslag;
}

/** Een accu met de sensoren die gelden: gekozen, of wat de app vond (besluit 271). */
interface AccuBron {
  readonly bron: Apparaat;
  readonly zelf: boolean;
  readonly aan: boolean;
  readonly sensoren: Record<AccuRol, string | null>;
  readonly gekozen: AccuRol[];
  readonly teken: AccuTeken;
  readonly ontlaadVermogen: string | null;
  readonly pct: number | null;
  readonly vermogenW: number | null;
}

/**
 * De accu's: wat de app vond en wat de bewoner zelf koos (besluit 271). Wat
 * hij als auto of laadpaal koos, is geen accu. Per accu geldt een gekozen
 * sensor boven wat de app vond.
 */
function accuBronnen(l: ReturnType<typeof lezer>, states: ReadonlyMap<string, HaEntityState>, laden: LadenKeuze | null, keuze: AccuKeuze | null): AccuBron[] {
  const { klasse, naamVan } = l;
  const zelf = new Set(keuze?.zelf ?? []);
  const lijst: AccuBron[] = [];
  for (const a of l.apparaten) {
    if (laden?.rol[a.device.id] != null) continue;
    const gevonden = l.isBatterij(a);
    if (!gevonden && !zelf.has(a.device.id)) continue;
    const ins = keuze?.instelling[a.device.id] ?? {};
    const sensoren = (k: string) => a.entiteiten.filter((e) => e.entity_id.startsWith('sensor.') && klasse(e) === k);
    // De lading: een sensor met de klasse batterij in procenten.
    const ladingVan = sensoren('battery').find((e) => states.get(e.entity_id)?.attributes['unit_of_measurement'] === '%')?.entity_id ?? null;
    // Het vermogen: bij voorkeur van de batterij zelf, niet dat van de panelen of het net.
    const p = sensoren('power');
    const eigen = p.filter((e) => /batter|accu|charge|laad/.test(naamVan(e)));
    const laad = eigen.find((e) => /(?<!dis)charg|(?<!ont)laad/.test(naamVan(e)) && !/discharg|ontlaad/.test(naamVan(e)));
    const ontlaad = eigen.find((e) => /discharg|ontlaad/.test(naamVan(e)));
    const gevondenVermogen = laad?.entity_id ?? (ontlaad ? null : (eigen[0] ?? (p.length === 1 ? p[0] : undefined))?.entity_id ?? null);
    // Totaal geladen en geleverd in kWh, aan de naam.
    const e = sensoren('energy');
    const uit = /discharg|ontla|export|output|geleverd|delivered|from.?batt|uit\b/;
    const geleverdVan = e.find((x) => uit.test(naamVan(x)))?.entity_id ?? null;
    const geladenVan = e.find((x) => !uit.test(naamVan(x)) && /charg|laad|import|input|to.?batt|in\b/.test(naamVan(x)))?.entity_id ?? null;
    const sensorenNu: Record<AccuRol, string | null> = {
      lading: ins.lading ?? ladingVan,
      vermogen: ins.vermogen ?? gevondenVermogen,
      geladen: ins.geladen ?? geladenVan,
      geleverd: ins.geleverd ?? geleverdVan,
    };
    const gekozen = ACCU_ROLLEN.filter((r) => ins[r] != null);
    const teken: AccuTeken = ins.teken ?? (LEVEREN_POSITIEF.test(a.platform) ? 'leveren' : 'laden');
    // Apart laden en ontladen alleen zolang de bewoner geen vermogen koos.
    const ontlaadVermogen = ins.vermogen == null && ontlaad ? ontlaad.entity_id : null;
    let w: number | null = null;
    if (ontlaadVermogen) {
      w = (sensorenNu.vermogen ? (watt(states.get(sensorenNu.vermogen)) ?? 0) : 0) - (watt(states.get(ontlaadVermogen)) ?? 0);
    } else if (sensorenNu.vermogen) {
      const n = watt(states.get(sensorenNu.vermogen));
      w = n == null ? null : teken === 'leveren' ? -n : n;
    }
    const lading = sensorenNu.lading ? getal(states.get(sensorenNu.lading)) : null;
    lijst.push({
      bron: a,
      zelf: !gevonden,
      aan: keuze?.aan[a.device.id] ?? true,
      sensoren: sensorenNu,
      gekozen,
      teken,
      ontlaadVermogen,
      pct: lading != null && lading >= 0 && lading <= 100 ? lading : null,
      vermogenW: w == null ? null : Math.round(w) || 0,
    });
  }
  return lijst;
}

/** Een accu die aan staat, met wat hij nu doet en zijn sensoren (besluit 272). */
export interface AccuNu {
  readonly id: string;
  readonly naam: string;
  readonly pct: number | null;
  /** Plus is laden, min is leveren aan het huis. */
  readonly vermogenW: number | null;
  readonly sensoren: Readonly<Record<AccuRol, string | null>>;
}

/** De accu's die aan staan (besluit 272): voor het verbruik van nu en de tellers in Opbrengst. */
export function accusNu(registers: Registers, states: ReadonlyMap<string, HaEntityState>, laden: LadenKeuze | null, keuze: AccuKeuze | null): AccuNu[] {
  return accuBronnen(lezer(registers, states), states, laden, keuze)
    .filter((b) => b.aan)
    .map((b) => ({ id: b.bron.device.id, naam: naamVanApparaat(b.bron.device), pct: b.pct, vermogenW: b.vermogenW, sensoren: b.sensoren }));
}

/** De sensoren om uit te kiezen: een lading in %, een vermogen, of een totaal in kWh (besluit 271). */
function accuSensoren(registers: Registers, states: ReadonlyMap<string, HaEntityState>, klasse: (e: HaRegistryEntity) => string | null): AccuSensor[] {
  const uit: AccuSensor[] = [];
  for (const e of registers.entities) {
    if (e.disabled_by || !e.entity_id.startsWith('sensor.')) continue;
    const k = klasse(e);
    const s = states.get(e.entity_id);
    const eenheid = String(s?.attributes['unit_of_measurement'] ?? '');
    const soort = k === 'battery' && eenheid === '%' ? 'lading' : k === 'power' ? 'vermogen' : k === 'energy' ? 'energie' : null;
    if (!soort) continue;
    const naam = String(s?.attributes['friendly_name'] ?? e.name ?? e.original_name ?? e.entity_id);
    uit.push({ id: e.entity_id, naam, soort, apparaat: e.device_id ?? null, staat: getal(s), eenheid });
  }
  return uit.sort((a, b) => a.naam.localeCompare(b.naam, 'nl')).slice(0, 800);
}

/** Energie › Thuisaccu (besluit 271): de accu's, de apparaten om zelf te kiezen, en de sensoren. */
export function accuView(registers: Registers, states: ReadonlyMap<string, HaEntityState>, keuze: AccuKeuze | null, laden: LadenKeuze | null = null): AccuView {
  const l = lezer(registers, states);
  const bronnen = accuBronnen(l, states, laden, keuze);
  const al = new Set(bronnen.map((b) => b.bron.device.id));
  // Kiezen kan uit apparaten die een vermogen of energie meten, met een lading in % of allebei; geen knopje
  // met een batterij, geen auto, laadpaal of evcc.
  const kandidaten = l.apparaten
    .filter((a) => !al.has(a.device.id) && laden?.rol[a.device.id] == null && !l.isEvcc(a) && !l.isAuto(a) && !l.isLaadpaal(a))
    .filter((a) => (l.heeft(a, 'power') || l.heeft(a, 'energy')) && (l.pctVan(a) != null || (l.heeft(a, 'power') && l.heeft(a, 'energy'))))
    .map((a) => ({ id: a.device.id, naam: naamVanApparaat(a.device) }))
    .sort((x, y) => x.naam.localeCompare(y.naam, 'nl'))
    .slice(0, 300);
  return {
    apparaten: bronnen
      .map((b) => ({
        id: b.bron.device.id,
        naam: naamVanApparaat(b.bron.device),
        merk: b.bron.device.manufacturer?.trim() || b.bron.platform || null,
        aan: b.aan,
        zelf: b.zelf,
        sensoren: b.sensoren,
        gekozen: b.gekozen,
        teken: b.teken,
        ontlaadVermogen: b.ontlaadVermogen,
        pct: b.pct,
        vermogenW: b.vermogenW,
      }))
      .sort((x, y) => Number(x.zelf) - Number(y.zelf) || x.naam.localeCompare(y.naam, 'nl')),
    kandidaten,
    sensoren: accuSensoren(registers, states, l.klasse),
  };
}

/** Een entiteit uit Home Assistant, zoals de pagina hem stuurt. */
const ENTITEIT = /^sensor\.[a-z0-9_]{1,160}$/;

/**
 * Leest de keuzes van Energie › Thuisaccu (besluit 271) zoals de pagina ze
 * stuurt: alleen vormen. Wat Home Assistant niet kent, telt nergens mee.
 */
export function leesAccu(raw: unknown): { keuze: AccuKeuze | null } | { fout: string } {
  if (raw == null) return { keuze: null };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { fout: 'thuisaccu: verwacht een object' };
  const r = raw as Record<string, unknown>;
  const obj = (v: unknown) => (v == null ? {} : typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
  const aanRaw = obj(r['aan']);
  const insRaw = obj(r['instelling']);
  const zelfRaw = r['zelf'] ?? [];
  if (!aanRaw || !insRaw || !Array.isArray(zelfRaw)) return { fout: 'thuisaccu: aan en instelling zijn per apparaat, zelf is een lijst' };
  if (Object.keys(aanRaw).length > 40 || Object.keys(insRaw).length > 20 || zelfRaw.length > 10) return { fout: 'thuisaccu: te veel apparaten' };
  const aan: Record<string, boolean> = {};
  for (const [id, v] of Object.entries(aanRaw)) {
    if (!ID.test(id) || typeof v !== 'boolean') return { fout: 'thuisaccu: aan is per apparaat ja of nee' };
    aan[id] = v;
  }
  if (zelfRaw.some((x) => typeof x !== 'string' || !ID.test(x))) return { fout: 'thuisaccu: zelf is een lijst van apparaten' };
  const zelf = [...new Set(zelfRaw as string[])];
  const instelling: Record<string, AccuInstelling> = {};
  for (const [id, v] of Object.entries(insRaw)) {
    const i = obj(v);
    if (!ID.test(id) || !i) return { fout: 'thuisaccu: onbekende instelling' };
    const uit: Record<string, string> = {};
    for (const rol of ACCU_ROLLEN) {
      const s = i[rol] ?? null;
      if (s === null) continue;
      if (typeof s !== 'string' || !ENTITEIT.test(s)) return { fout: `thuisaccu: ${rol} is een sensor uit Home Assistant` };
      uit[rol] = s;
    }
    const teken = i['teken'] ?? null;
    if (teken !== null && !ACCU_TEKENS.includes(teken as AccuTeken)) return { fout: 'thuisaccu: plus is laden of leveren' };
    const ins = { ...uit, ...(teken ? { teken: teken as AccuTeken } : {}) };
    if (Object.keys(ins).length) instelling[id] = ins;
  }
  if (!Object.keys(aan).length && !zelf.length && !Object.keys(instelling).length) return { keuze: null };
  return { keuze: { aan, zelf, instelling } };
}

/** Per auto de meter van zijn laadvermogen, voor de laadbeurten uit de statistiek (besluit 259, stap 3). */
export interface LaadMeter {
  readonly auto: string;
  /** De sensor met het laadvermogen; null als niets het meet. */
  readonly vermogen: string | null;
}

/** De meters van de auto's: dezelfde keuze als de pagina Auto, zonder de standen. */
export function laadMeters(registers: Registers, states: ReadonlyMap<string, HaEntityState>, keuze: LadenKeuze | null = null): LaadMeter[] {
  return opslagMet(registers, states, keuze, new Date()).meters;
}

/** Wat er per auto met de hand te bedienen is (stap 5, besluit 262): de laadpaal eerst, anders de auto. */
export function laadBedieningen(registers: Registers, states: ReadonlyMap<string, HaEntityState>, keuze: LadenKeuze | null = null): LaadBediening[] {
  return opslagMet(registers, states, keuze, new Date()).bedieningen;
}

function opslagMet(registers: Registers, states: ReadonlyMap<string, HaEntityState>, keuze: LadenKeuze | null, nu: Date, accuKeuze: AccuKeuze | null = null): { opslag: Opslag; meters: LaadMeter[]; bedieningen: LaadBediening[] } {
  const meters: LaadMeter[] = [];
  const bedieningen: LaadBediening[] = [];
  const evccErIs = l0(registers, states);
  const l = lezer(registers, states);
  const { klasse, naamVan, pctVan } = l;
  const vermogens = (a: Apparaat) => a.entiteiten.filter((e) => e.entity_id.startsWith('sensor.') && klasse(e) === 'power');
  const aanUit = (a: Apparaat, k: string): boolean | null => {
    const e = a.entiteiten.find((x) => x.entity_id.startsWith('binary_sensor.') && klasse(x) === k);
    const s = e ? states.get(e.entity_id) : undefined;
    return s == null || s.state === 'unavailable' || s.state === 'unknown' ? null : s.state === 'on';
  };

  /* ---- de thuisbatterij: de eerste die aan staat (besluit 271) ---- */
  // Wat de bewoner als auto of laadpaal koos, is geen thuisbatterij.
  const accu = accuBronnen(l, states, keuze, accuKeuze).find((b) => b.aan) ?? null;
  let batterij: Thuisbatterij | null = null;
  if (accu) {
    const w = accu.vermogenW;
    const stand = w == null ? null : w > RUST_W ? 'laadt' : w < -RUST_W ? 'levert' : 'rust';
    batterij = { id: accu.bron.device.id, naam: accu.bron.device.name_by_user || 'De batterij', pct: accu.pct, vermogenW: w, stand };
  }

  /* ---- de auto's, met hun laadpaal; een laadpaal zonder auto is de auto ---- */
  const { lijst } = laadApparaten(l, states, keuze, new Set(accuKeuze?.zelf ?? []));
  const wagens = lijst.filter((x) => x.aan && x.rol === 'auto');
  const palen = lijst.filter((x) => x.aan && x.rol === 'laadpaal');
  const instelling = (id: string): AutoInstelling => keuze?.instelling[id] ?? { accuKWh: null, laadpaal: null, plek: null };
  /** De laadpaal van een auto: de gekozen, of de enige als er één is. */
  const paalVan = (id: string) => {
    const gekozen = instelling(id).laadpaal;
    return palen.find((p) => p.id === gekozen) ?? (palen.length === 1 && gekozen == null ? palen[0]! : null);
  };

  type Gevonden = (typeof lijst)[number];
  const maak = (wagenItem: Gevonden | null, paalItem: Gevonden | null, naam: string): Auto => {
    const wagen = wagenItem?.bron ?? null;
    const paal = paalItem?.bron ?? null;
    const bron = [wagen, paal].filter((x): x is Apparaat => x != null);
    const eerst = <T>(f: (a: Apparaat) => T | null): T | null => {
      for (const a of bron) {
        const v = f(a);
        if (v != null) return v;
      }
      return null;
    };
    // Het laadvermogen: van de laadpaal, anders een laadvermogen van de auto.
    const laadMeter = (a: Apparaat) => vermogens(a).find((x) => a === paal || /charg|laad/.test(naamVan(x))) ?? null;
    const laadW = eerst((a) => {
      const e = laadMeter(a);
      return e ? watt(states.get(e.entity_id)) : null;
    });
    /** De stand van een laadpaal als woord, zoals "charging" of "connected". */
    const status = paal
      ? paal.entiteiten
          .filter((e) => e.entity_id.startsWith('sensor.') && klasse(e) !== 'power' && /status|state|stand|mode/.test(naamVan(e)))
          .map((e) => String(states.get(e.entity_id)?.state ?? '').toLowerCase())
          .find((s) => /charg|laad|connect|disconnect|awaiting|ready|available|idle|paused|completed|vol/.test(s)) ?? null
      : null;
    // Een fout van de laadpaal (stap 6): een stand met error, fault, fout of storing.
    const fout = paal
      ? paal.entiteiten
          .filter((e) => e.entity_id.startsWith('sensor.') && klasse(e) !== 'power' && /status|state|stand|mode/.test(naamVan(e)))
          .map((e) => String(states.get(e.entity_id)?.state ?? '').toLowerCase())
          .find((s) => /error|fault|fout|storing/.test(s) && !/no.?error|geen/.test(s)) ?? null
      : null;
    const laadtStatus = status == null ? null : /^(charging|laden|laadt)$|charging/.test(status) && !/not.?charging|discharg/.test(status);
    const losStatus = status == null ? null : /disconnect|available|idle|niet aangesloten|vrij/.test(status);
    const laadt = eerst((a) => aanUit(a, 'battery_charging')) ?? laadtStatus ?? (laadW == null ? null : laadW > 200);
    const aangesloten = eerst((a) => aanUit(a, 'plug')) ?? (losStatus == null ? null : !losStatus) ?? (laadt ? true : null);
    const bereik = wagen
      ? (() => {
          const e = wagen.entiteiten.find((x) => x.entity_id.startsWith('sensor.') && klasse(x) === 'distance' && BEREIK.test(naamVan(x)) && !GEEN_BEREIK.test(naamVan(x)));
          const s = e ? states.get(e.entity_id) : undefined;
          const n = getal(s);
          if (n == null) return null;
          return String(s?.attributes['unit_of_measurement'] ?? 'km') === 'mi' ? Math.round(n * 1.609) : Math.round(n);
        })()
      : null;
    const id = (wagen ?? paal)!.device.id;
    const ins = instelling(id);
    const pct = eerst(pctVan);
    const vermogenW = laadW == null ? null : Math.round(laadW);

    /* ---- voor de pagina Auto (stap 2) ---- */
    // De laadgrens: een getal of sensor in procenten, van de auto en anders van de laadpaal.
    const laadgrens = eerst((a) => {
      for (const e of a.entiteiten) {
        if (!/^(number|sensor)\./.test(e.entity_id) || !LAADGRENS.test(naamVan(e))) continue;
        const s = states.get(e.entity_id);
        const n = getal(s);
        const eenheid = String(s?.attributes['unit_of_measurement'] ?? '%');
        if (n != null && n > 0 && n <= 100 && eenheid === '%') return Math.round(n);
      }
      return null;
    });
    // De stroom per fase: gemeten, geen grens; van de laadpaal, anders van de auto.
    const stroomA = eerst((a) => {
      const metingen = a.entiteiten
        .filter((e) => e.entity_id.startsWith('sensor.') && klasse(e) === 'current' && !GEEN_METING.test(naamVan(e)))
        .map((e) => ({ fase: /(?:^|[\s_.-])(?:l|p|phase|fase)[\s_]*([123])(?![0-9])/.exec(naamVan(e))?.[1] ?? null, a: getal(states.get(e.entity_id)) }))
        .filter((x): x is { fase: string | null; a: number } => x.a != null && x.a >= 0 && x.a < 100);
      const perFase = metingen.filter((x) => x.fase != null).sort((x, y) => x.fase!.localeCompare(y.fase!));
      const lijst = perFase.length ? perFase.slice(0, 3) : metingen.slice(0, 1);
      return lijst.length ? lijst.map((x) => Math.round(x.a * 10) / 10) : null;
    });
    // De plek van de auto: thuis of weg, uit zijn device_tracker.
    const tracker = wagen?.entiteiten.find((e) => e.entity_id.startsWith('device_tracker.'));
    const plekStaat = tracker ? states.get(tracker.entity_id) : undefined;
    const thuis = !plekStaat || plekStaat.state === 'unknown' || plekStaat.state === 'unavailable' ? null : plekStaat.state === 'home';
    const kabel = bron.flatMap((a) => a.entiteiten).find((x) => x.entity_id.startsWith('binary_sensor.') && klasse(x) === 'plug');
    const kabelStaat = kabel ? states.get(kabel.entity_id) : undefined;
    const volOm = laadt ? klaarOm(wagen, pct, laadgrens, ins.accuKWh, vermogenW) : null;
    meters.push({ auto: id, vermogen: eerst((a) => laadMeter(a)?.entity_id ?? null) });
    // Bedienen (stap 5): het apparaat met een stroom om te zetten of een pauze, de laadpaal eerst.
    const metKnop = bron.map((a) => ({ a, ...bedieningVan(a) })).find((x) => x.stroom || x.pauze) ?? null;
    bedieningen.push({
      auto: id,
      apparaat: metKnop?.a.device.id ?? null,
      stroom: metKnop?.stroom ?? null,
      pauze: metKnop?.pauze ?? null,
      mag: !evccErIs && metKnop != null && keuze?.bedienen?.[metKnop.a.device.id] === true,
      evcc: evccErIs,
    });
    return {
      id,
      naam,
      pct,
      aangesloten,
      laadt,
      vermogenW,
      bereikKm: bereik,
      plek: ins.plek,
      accuKWh: wagen ? ins.accuKWh : null,
      laadpaal: paal && wagen ? paal.device.id : null,
      paalNaam: paalItem?.naam ?? null,
      paalStroomA: paalItem?.stroomA ?? null,
      laadgrens,
      stroomA,
      volOm,
      thuis,
      kabelSinds: kabelStaat?.state === 'on' ? kabelStaat.last_changed || null : null,
      wegSinds: thuis === false ? plekStaat?.last_changed || null : null,
      fout,
    };
  };

  /**
   * Hoe laat de auto op zijn laadgrens is (docs/auto-en-laadpaal.md): zegt de
   * auto het zelf, dan dat; anders (grens − lading) × accu / vermogen, op vijf
   * minuten. Zonder accu, lading of vermogen: niet.
   */
  function klaarOm(wagen: Apparaat | null, pct: number | null, grens: number | null, accuKWh: number | null, w: number | null): string | null {
    for (const e of wagen?.entiteiten ?? []) {
      if (!e.entity_id.startsWith('sensor.')) continue;
      const k = klasse(e);
      const n = naamVan(e);
      const s = states.get(e.entity_id);
      if (k === 'timestamp' && KLAAR_TIJD.test(n)) {
        const t = Date.parse(s?.state ?? '');
        if (Number.isFinite(t) && t > nu.getTime() && t - nu.getTime() < 3 * 86_400_000) return new Date(t).toISOString();
      }
      // Ook de laadtijd van NissanConnect: wat er nog over is (melding 132).
      if (k === 'duration' && KLAAR_TIJD.test(n) && KLAAR_DUUR.test(n) && !GEEN_KLAAR.test(n)) {
        const d = getal(s);
        const eenheid = String(s?.attributes['unit_of_measurement'] ?? 'min');
        const ms = d == null ? null : d * (eenheid === 'h' ? 3_600_000 : eenheid === 's' ? 1000 : eenheid === 'd' ? 86_400_000 : 60_000);
        if (ms != null && ms > 0 && ms < 3 * 86_400_000) return new Date(nu.getTime() + ms).toISOString();
      }
    }
    const doel = grens ?? 100;
    if (pct == null || accuKWh == null || w == null || w < 500 || pct >= doel) return null;
    const uren = (((doel - pct) / 100) * accuKWh) / (w / 1000);
    if (uren > 72) return null;
    const vijf = 5 * 60_000;
    return new Date(Math.ceil((nu.getTime() + uren * 3_600_000) / vijf) * vijf).toISOString();
  }

  /** De stroom om te zetten en hoe hij pauzeert, van één apparaat. */
  function bedieningVan(a: Apparaat): { stroom: LaadBediening['stroom']; pauze: LaadPauze | null } {
    const getallen = a.entiteiten.filter((e) => e.entity_id.startsWith('number.') && String(states.get(e.entity_id)?.attributes['unit_of_measurement'] ?? '') === 'A');
    const nummer = getallen.find((e) => STROOM_ZET.test(naamVan(e)) && !GEEN_STROOM_ZET.test(naamVan(e))) ?? (getallen.length === 1 ? getallen[0] : undefined);
    let stroom: LaadBediening['stroom'] = null;
    if (nummer) {
      const s = states.get(nummer.entity_id);
      const min = Number(s?.attributes['min']);
      const max = Number(s?.attributes['max']);
      const stap = Number(s?.attributes['step'] ?? 1) || 1;
      // Onder 6 A laadt bijna geen auto; een getal dat bij 0 begint, begint hier bij 6.
      if (Number.isFinite(min) && Number.isFinite(max) && max > min && max <= 80) stroom = { id: nummer.entity_id, min: max >= 6 ? Math.max(min, 6) : min, max, stap, nuA: getal(s) };
    }
    const knop = (e: HaRegistryEntity) => LAAD_KNOP.test(naamVan(e)) && !GEEN_LAAD_KNOP.test(naamVan(e));
    const schakelaar = a.entiteiten.find((e) => e.entity_id.startsWith('switch.') && knop(e));
    let pauze: LaadPauze | null = null;
    if (schakelaar) {
      const n = naamVan(schakelaar);
      pauze = { soort: 'schakelaar', id: schakelaar.entity_id, omgekeerd: /pause|pauze/.test(n) && !/resume|hervat/.test(n) };
    } else {
      const knoppen = a.entiteiten.filter((e) => e.entity_id.startsWith('button.') && (knop(e) || /stop|start/.test(naamVan(e))) && !GEEN_LAAD_KNOP.test(naamVan(e)));
      const p = knoppen.find((e) => /pause|pauze|stop/.test(naamVan(e)));
      const h = knoppen.find((e) => /resume|hervat|start/.test(naamVan(e)) && e !== p);
      if (p && h) pauze = { soort: 'knoppen', pauze: p.entity_id, hervat: h.entity_id };
    }
    return { stroom, pauze };
  }

  const autos: Auto[] = wagens.length
    ? wagens.map((w) => maak(w, paalVan(w.id) ?? null, w.naam))
    : palen.map((p) => maak(null, p, palen.length === 1 ? 'De auto' : p.naam));
  return { opslag: { batterij, auto: autos[0] ?? null, autos }, meters, bedieningen };
}

/** Is evcc er? Dan regelt evcc het laden. */
function l0(registers: Registers, states: ReadonlyMap<string, HaEntityState>): boolean {
  const l = lezer(registers, states);
  return l.apparaten.some(l.isEvcc);
}

/** Energie › Auto en laadpaal (besluit 259): gevonden, zelf gekozen, evcc, en wat er nog te kiezen is. */
export function ladenView(registers: Registers, states: ReadonlyMap<string, HaEntityState>, keuze: LadenKeuze | null, accuKeuze: AccuKeuze | null = null): LadenView {
  const l = lezer(registers, states);
  const alsAccu = new Set(accuKeuze?.zelf ?? []);
  const { lijst, evcc } = laadApparaten(l, states, keuze, alsAccu);
  const al = new Set([...lijst.map((x) => x.id), ...evcc.map((a) => a.device.id), ...alsAccu]);
  // Kiezen kan uit apparaten die iets meten wat bij laden hoort; geen thuisbatterij.
  const kandidaten = l.apparaten
    .filter((a) => !al.has(a.device.id) && !l.isBatterij(a) && a.entiteiten.some((e) => LAAD_KLASSEN.has(l.klasse(e) ?? '')))
    .map((a) => ({ id: a.device.id, naam: naamVanApparaat(a.device) }))
    .sort((x, y) => x.naam.localeCompare(y.naam, 'nl'))
    .slice(0, 300);
  return {
    apparaten: lijst.map(({ bron: _b, ...x }) => x),
    kandidaten,
    evcc: evcc.map((a) => ({ id: a.device.id, naam: naamVanApparaat(a.device) })),
    instelling: keuze?.instelling ?? {},
  };
}

const ID = /^[A-Za-z0-9_.:-]{1,64}$/;

/**
 * Leest de keuzes zoals de pagina ze stuurt (besluit 259): alleen vormen, geen
 * entiteiten. Een onbekend apparaat kan geen kwaad: wat Home Assistant niet
 * kent, telt nergens mee.
 */
export function leesLaden(raw: unknown): { keuze: LadenKeuze | null } | { fout: string } {
  if (raw == null) return { keuze: null };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { fout: 'auto en laadpaal: verwacht een object' };
  const r = raw as Record<string, unknown>;
  const obj = (v: unknown) => (v == null ? {} : typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
  const aanRaw = obj(r['aan']);
  const rolRaw = obj(r['rol']);
  const insRaw = obj(r['instelling']);
  const bedRaw = obj(r['bedienen']);
  if (!aanRaw || !rolRaw || !insRaw || !bedRaw) return { fout: 'auto en laadpaal: aan, rol, instelling en bedienen zijn per apparaat' };
  if (Object.keys(bedRaw).length > 20) return { fout: 'auto en laadpaal: te veel apparaten' };
  const bedienen: Record<string, boolean> = {};
  for (const [id, v] of Object.entries(bedRaw)) {
    if (!ID.test(id) || typeof v !== 'boolean') return { fout: 'auto en laadpaal: bedienen is per apparaat ja of nee' };
    if (v) bedienen[id] = true;
  }
  if (Object.keys(aanRaw).length > 40 || Object.keys(rolRaw).length > 20 || Object.keys(insRaw).length > 20) return { fout: 'auto en laadpaal: te veel apparaten' };
  const aan: Record<string, boolean> = {};
  for (const [id, v] of Object.entries(aanRaw)) {
    if (!ID.test(id) || typeof v !== 'boolean') return { fout: 'auto en laadpaal: aan is per apparaat ja of nee' };
    aan[id] = v;
  }
  const rol: Record<string, LaadRol> = {};
  for (const [id, v] of Object.entries(rolRaw)) {
    if (!ID.test(id) || (v !== 'auto' && v !== 'laadpaal')) return { fout: 'auto en laadpaal: een apparaat is een auto of een laadpaal' };
    rol[id] = v;
  }
  const instelling: Record<string, AutoInstelling> = {};
  for (const [id, v] of Object.entries(insRaw)) {
    const i = obj(v);
    if (!ID.test(id) || !i) return { fout: 'auto en laadpaal: onbekende instelling' };
    const accu = i['accuKWh'] ?? null;
    if (accu !== null && (typeof accu !== 'number' || !Number.isFinite(accu) || accu < 5 || accu > 250)) return { fout: 'de accu is 5 tot 250 kWh' };
    const paal = i['laadpaal'] ?? null;
    if (paal !== null && (typeof paal !== 'string' || !ID.test(paal))) return { fout: 'de laadpaal is een apparaat uit Home Assistant' };
    const plek = i['plek'] ?? null;
    if (plek !== null && !AUTO_PLEKKEN.includes(plek as AutoPlek)) return { fout: 'de auto staat op de oprit, onder de carport of in de garage' };
    // Kabel vergeten (besluit 263): een tijd en een %, of uit.
    const k = i['kabel'];
    let kabel: AutoInstelling['kabel'];
    if (k !== undefined && k !== null) {
      const ko = obj(k);
      const om = ko?.['om'];
      const pct = ko?.['pct'] ?? null;
      if (!ko || typeof om !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(om)) return { fout: 'kabel vergeten: om is een tijd als 21:00' };
      if (pct !== null && !KABEL_PCT.includes(pct as (typeof KABEL_PCT)[number])) return { fout: `kabel vergeten: onder ${KABEL_PCT.join(', ')}%, of uit` };
      kabel = { om, pct: pct as number | null };
    }
    instelling[id] = { accuKWh: accu === null ? null : Math.round((accu as number) * 10) / 10, laadpaal: paal as string | null, plek: plek as AutoPlek | null, ...(kabel ? { kabel } : {}) };
  }
  if (!Object.keys(aan).length && !Object.keys(rol).length && !Object.keys(instelling).length && !Object.keys(bedienen).length) return { keuze: null };
  return { keuze: { aan, rol, instelling, ...(Object.keys(bedienen).length ? { bedienen } : {}) } };
}
