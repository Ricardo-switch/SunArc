/*
 * Het huis: een indeling voorstellen (22 november 2026, opgesplitst uit web/house.ts).
 *
 * Wat een kamer is uit zijn naam, de soort en of hij buiten ligt, de eerste indeling uit Home Assistant, en het
 * huis voordat het is ingericht.
 */
import { STANDAARD_DAGDELEN } from '../config/standaard.js';
import type { HaEntityState } from '../adapters/homeassistant/client.js';
import type { HaArea, HaFloor } from '../adapters/homeassistant/discovery.js';
import type { SiteConfig } from '../core/model.js';
import { ROOM_TYPES, STANDARD_FLOORS, floorOrder, type FloorId, type Layout, type LayoutKnown, type LayoutOutside, type LayoutRoom, type RoomType } from './layout.js';
import { type HouseDevice, type HouseRegisters, type HouseReport, OUTSIDE, buildHouse, collect } from './house.js';

/** Hoe een kamer van een soort in een apparaatnaam heet: de hal heet vaak "Entree" in de indeling. */
const SOORT_WOORDEN: Partial<Record<RoomType, readonly string[]>> = {
  hal: ['hal', 'gang', 'overloop', 'entree', 'trap'],
  toilet: ['toilet', 'wc'],
  wasruimte: ['wasruimte', 'washok'],
};
/** Woorden die een kamer niet van een andere onderscheiden. */
const ALGEMEEN_WOORD = new Set(['kamer', 'de', 'het', 'van', 'en', 'boven', 'beneden', 'achter', 'voor', ...ROOM_TYPES]);

/**
 * Een kamer uit de naam van het apparaat (besluit 157): "Bewegingssensor entree"
 * hoort in de Entree. Hele woorden, en bij twee kamers de langste naam: dan wint
 * "Slaapkamer Daan" van "Slaapkamer".
 *
 * Staat de hele kamernaam er niet in, dan nog (30 oktober 2026, "Spot 1 Matts"):
 * een woord dat alleen in de naam van die ene kamer staat ("Matts" bij
 * "Slaapkamer Matts"), of het woord voor de soort van een kamer als er maar één
 * kamer van die soort is ("Spot 1 hal" bij de Entree, die een hal is).
 */
export function roomForName(naam: string, rooms: readonly LayoutRoom[]): string | null {
  const plat = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const woorden = ` ${plat(naam)} `;
  const heel = (w: string) => woorden.includes(` ${w} `);
  const raak = rooms
    .map((r) => ({ r, n: plat(r.naam) }))
    .filter(({ n }) => n.length >= 3 && heel(n))
    .sort((a, b) => b.n.length - a.n.length);
  if (raak[0]) return raak[0].r.id;
  // Een onderscheidend woord: alleen in de naam van deze kamer, en geen soort van kamer.
  const woordenVan = rooms.map((r) => ({ r, w: plat(r.naam).split(' ').filter((x) => x.length >= 3 && !ALGEMEEN_WOORD.has(x)) }));
  const telling = new Map<string, number>();
  for (const { w } of woordenVan) for (const x of new Set(w)) telling.set(x, (telling.get(x) ?? 0) + 1);
  const eigen = woordenVan.filter(({ w }) => w.some((x) => telling.get(x) === 1 && heel(x)));
  if (eigen.length === 1) return eigen[0]!.r.id;
  // De soort: "hal" bij de enige kamer die een hal is.
  for (const [soort, lijst] of Object.entries(SOORT_WOORDEN) as [RoomType, readonly string[]][]) {
    if (!lijst.some(heel)) continue;
    const vanSoort = rooms.filter((r) => r.soort === soort);
    if (vanSoort.length === 1) return vanSoort[0]!.id;
  }
  return null;
}

/** Wat het huis nu kent: de sleutels die een indeling mag gebruiken. */
export function knownForLayout(
  config: SiteConfig,
  registers: HouseRegisters,
  states: ReadonlyMap<string, HaEntityState>,
  /**
   * Wat het huis buiten Home Assistant om als apparaat kent: de lampen achter
   * een schakelaar (besluit 297). Zonder deze ids gooide het bewaren hun kamer
   * stil weg (melding 163).
   */
  extra: readonly string[] = [],
): LayoutKnown {
  const { found, successors } = collect(config, registers, states, null);
  return {
    deviceIds: new Set([...found.map((f) => f.device.id), ...extra]),
    zoneIds: new Set(config.zones.map((z) => z.id)),
    gevelIds: new Set((config.geometry?.facades ?? []).map((f) => f.id)),
    opvolgers: successors,
  };
}

/** Een id dat de indeling accepteert, uit een gebied van Home Assistant. */
function slug(text: string, taken: ReadonlySet<string>): string {
  const base =
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 36) || 'kamer';
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
  return id;
}

/**
 * Een voorstel voor de soort van een kamer zonder eigen keuze (besluit 119),
 * uit de naam, de zones, de etage en wat er staat. De keuze van de bewoner gaat
 * altijd voor; dit is alleen het begin. Null als niets iets zegt.
 */
export function roomTypeFromNames(room: Pick<LayoutRoom, 'naam' | 'zones' | 'etage'>, devices: readonly Pick<HouseDevice, 'naam' | 'soort'>[] = []): RoomType | null {
  const n = room.naam.toLowerCase().trim();
  const zegt = (re: RegExp) => re.test(n);
  // Een kamer met een keuken en een zithoek als zones is een woonkamer met open keuken; een gekozen soort gaat voor de naam.
  const zone = (soort: RoomType, re: RegExp) => room.zones.some((z) => (z.soort ? z.soort === soort : re.test(z.naam.toLowerCase())));
  if (zone('keuken', /keuken|kitchen/) && zone('woonkamer', /woon|zit|lounge|living|bank|tv/)) return 'woonkeuken';
  if (zegt(/woonkeuken|open keuken|leefkeuken/)) return 'woonkeuken';
  // Bijkeuken, kelder en garage hebben een eigen soort (besluit 166).
  if (zegt(/bijkeuken/)) return 'bijkeuken';
  if (zegt(/wasruimte|washok|wasplaats|laundry|stookhok|technische ruimte|cv-ruimte/)) return 'wasruimte';
  if (zegt(/keuken|kitchen/)) return 'keuken';
  if (zegt(/logeer|gast|guest/)) return 'logeerkamer';
  if (zegt(/kinder|baby|speelkamer|jongenskamer|meisjeskamer|tienerkamer|nursery|kids/)) return 'kinderkamer';
  // "Slaapkamer" alleen, of die van de ouders: een tweepersoonsbed. Met een naam erachter: een kind.
  if (zegt(/^(hoofd|ouder|grote |master )?slaapkamer$|master|ouderslaapkamer|bedroom$/)) return 'slaapkamer';
  if (zegt(/slaapkamer|slaap|bedroom/)) return 'kinderkamer';
  if (zegt(/^(toilet|wc)\b|toilet|^wc /)) return 'toilet';
  if (zegt(/bad|douche|bathroom|shower/)) return 'badkamer';
  if (zegt(/eetkamer|eethoek|dining/)) return 'eetkamer';
  if (zegt(/woon|zitkamer|zithoek|living|lounge|tv-kamer|tv kamer|serre|huiskamer|salon/)) return 'woonkamer';
  if (zegt(/trapkast|meterkast|kast onder de trap/)) return 'berging';
  if (zegt(/^(hal|gang|overloop|entree|portaal|vide|trap|trappenhuis|hall|landing|hallway)\b/)) return 'hal';
  if (zegt(/werk|kantoor|studeer|hobby|office|studio|bureau|game|thuiswerk|atelier|knutsel/)) return 'werkkamer';
  if (zegt(/garage/)) return 'garage';
  if (zegt(/kelder|basement/)) return 'kelder';
  if (zegt(/zolder|vliering|berg|opslag|schuur|attic|storage/)) return 'berging';
  // Een kelder zonder naam die iets zegt, is een kelder.
  if (room.etage === 'kelder') return 'kelder';
  if (devices.some((d) => d.soort === 'apparaat' && /was|droog|droger/i.test(d.naam))) return 'wasruimte';
  return null;
}

/**
 * Een voorstel voor een buitenruimte zonder eigen keuze (besluit 109): de soort
 * uit de naam, een auto op een oprit, en een tuinhuis als een zone of een
 * apparaat zo heet.
 */
export function outsideFromNames(room: Pick<LayoutRoom, 'naam' | 'zones'>, devices: readonly Pick<HouseDevice, 'naam'>[]): LayoutOutside {
  const n = room.naam;
  const soort: LayoutOutside['soort'] = /voordeur|front door/i.test(n)
    ? 'voordeur'
    : /carport/i.test(n)
    ? 'carport'
    : /oprit/i.test(n)
      ? 'oprit'
      : /voortuin/i.test(n)
        ? 'voortuin'
        : /zijtuin/i.test(n)
          ? 'zijtuin'
          : /dakterras/i.test(n)
            ? 'dakterras'
            : /terras|veranda/i.test(n)
              ? 'terras'
              : /balkon/i.test(n)
                ? 'balkon'
                : /tuinhuis|schuur/i.test(n)
                  ? 'tuinhuis'
                  : /garage/i.test(n)
                    ? 'garage'
                    : 'tuin';
  const huisje = /tuinhuis|schuur|berging|huisje/i;
  // Een deel dat een tuinhuis is (besluit 167), of zo heet, of een apparaat dat zo heet.
  const metHuisje = room.zones.some((z) => z.soort === 'tuinhuis' || z.soort === 'overstek' || huisje.test(z.naam)) || devices.some((d) => huisje.test(d.naam));
  return { soort, auto: soort === 'oprit' || soort === 'carport', tuinhuis: (soort === 'tuin' || soort === 'zijtuin') && metHuisje };
}

/**
 * Het voorstel uit Home Assistant (95): elk gebied met iets erin wordt een kamer,
 * op de etage die bij het niveau hoort, en een gebied zonder etage op de begane
 * grond, of buiten als de naam daarop wijst. Een regelgebied hoort bij het gebied
 * waar zijn thermometer en apparaten het vaakst hangen.
 */
export function proposeLayout(
  config: SiteConfig,
  registers: HouseRegisters,
  states: ReadonlyMap<string, HaEntityState>,
): Layout {
  const { found, areaOf } = collect(config, registers, states, null);
  const floorById = new Map(registers.floors.map((f) => [f.floor_id, f]));
  /*
   * Elk niveau zijn eigen etage (testerronde, november 2026): eerst werd alles
   * vanaf niveau 2 de tweede verdieping, en zag een huis met een zolder op
   * niveau 3 er een etage te weinig. Onder de begane grond is de kelder
   * (besluit 187). Een etage zonder niveau krijgt een eigen id met zijn naam.
   */
  const ownIds = new Set<string>();
  const floorId = (f: HaFloor): FloorId => {
    if (f.level != null) return f.level < 0 ? 'kelder' : (['bg', 'e1', 'e2', 'e3'][f.level] ?? `e${Math.min(f.level, 99)}`);
    const id = slug(`etage-${f.floor_id || f.name}`, ownIds);
    ownIds.add(id);
    return id;
  };
  const idPerFloor = new Map(registers.floors.map((f) => [f.floor_id, floorId(f)]));
  const floorOf = (area: HaArea): FloorId => {
    // Een tuin of oprit is buiten, ook als Home Assistant hem op de begane grond zet.
    if (OUTSIDE.test(area.name)) return 'buiten';
    const f = area.floor_id ? floorById.get(area.floor_id) : undefined;
    return f ? idPerFloor.get(f.floor_id)! : 'bg';
  };

  // De naam van een etage komt van de etage in Home Assistant; de eerste op een niveau telt.
  const etages: Partial<Record<FloorId, string>> = {};
  for (const f of registers.floors) {
    const id = idPerFloor.get(f.floor_id)!;
    if (f.name.trim() !== '' && etages[id] == null) etages[id] = f.name.trim().slice(0, 40);
  }

  const zoneArea = new Map<string, string>();
  for (const zone of config.zones) {
    const votes = new Map<string, number>();
    const ids = [zone.temperature.id, ...zone.actuatorIds.map((id) => config.actuators.find((a) => a.id === id)?.ref.id)];
    for (const id of ids) {
      const area = id ? areaOf(id) : null;
      if (area) votes.set(area, (votes.get(area) ?? 0) + 1);
    }
    const best = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) zoneArea.set(zone.id, best[0]);
  }

  const used = new Set(found.map((f) => f.haArea).filter((a): a is string => a != null));
  const taken = new Set<string>();
  const claimed = new Set<string>();
  const kamers: LayoutRoom[] = [];
  for (const area of registers.areas) {
    const zone = config.zones.find((z) => zoneArea.get(z.id) === area.area_id && !claimed.has(z.id)) ?? null;
    if (!used.has(area.area_id) && zone == null) continue;
    const id = slug(area.area_id || area.name, taken);
    taken.add(id);
    if (zone) claimed.add(zone.id);
    kamers.push({ id, naam: area.name.trim(), etage: floorOf(area), zones: [], regelzone: zone?.id ?? null, haGebied: area.area_id });
  }
  // Een etage buiten de vaste vijf (een derde verdieping en hoger, of zonder niveau): dan een eigen volgorde.
  const volgorde = floorOrderFrom(kamers, registers.floors, idPerFloor);
  // Alleen namen van etages die er echt in staan: een naam bij een lege etage maakt de indeling ongeldig zodra er een volgorde komt.
  const inHuis = new Set(floorOrder({ ...(volgorde ? { volgorde } : {}), kamers }));
  const eigenNamen = Object.fromEntries(Object.entries(etages).filter(([id]) => inHuis.has(id)));
  return { versie: 1, ...(volgorde ? { volgorde } : {}), etages: eigenNamen, kamers, apparaten: {} };
}

/**
 * De volgorde van boven naar beneden als een kamer op een etage buiten de vaste
 * vijf staat, of null. Op niveau; een etage zonder niveau bovenaan als hij op
 * een zolder lijkt, onderaan als hij op een kelder lijkt, en anders boven de
 * begane grond.
 */
function floorOrderFrom(kamers: readonly LayoutRoom[], floors: readonly HaFloor[], idPerFloor: ReadonlyMap<string, FloorId>): FloorId[] | null {
  const used = new Set(kamers.map((k) => k.etage).filter((e) => e !== 'buiten'));
  if ([...used].every((id) => STANDARD_FLOORS.some((s) => s.id === id))) return null;
  const rang = (id: FloorId): number => {
    if (id === 'kelder') return -1;
    if (id === 'bg') return 0;
    const n = /^e(\d+)$/.exec(id);
    if (n) return Number(n[1]);
    const f = floors.find((x) => idPerFloor.get(x.floor_id) === id);
    const naam = f?.name ?? id;
    return /zolder|vliering|attic|loft|dak|roof/i.test(naam) ? 1000 : /kelder|souterrain|basement|cellar/i.test(naam) ? -2 : 0.5;
  };
  return [...new Set(['e2', 'e1', 'bg', ...used])].sort((a, b) => rang(b) - rang(a)).slice(0, 10);
}

/**
 * Het huis vóór er een configuratie is (besluit 154): wat Home Assistant kent,
 * zonder regeling. Voor het welkom in een leeg huis, dat het huis laat groeien
 * terwijl je leest. Geen zone en geen apparaat in de regeling, dus alles in het
 * huis komt uit de registers.
 */
export function houseBeforeSetup(registers: HouseRegisters, states: ReadonlyMap<string, HaEntityState>, timezone: string): HouseReport {
  const leeg: SiteConfig = {
    id: 'nog-niet-ingericht',
    timezone,
    zones: [],
    actuators: [],
    power: { gridPower: { adapter: 'homeassistant', id: 'sensor.nog_niet_ingericht' }, startSurplusW: 0, stopImportW: 0, resumeSurplusW: 0, stabilisationMinutes: 0 },
    occupancy: [],
    schedule: { preheatFromHour: STANDAARD_DAGDELEN.voorverwarmen, dayFromHour: STANDAARD_DAGDELEN.dag, nightFromHour: STANDAARD_DAGDELEN.nacht, eveningExtensionLights: [] },
    enabledStrategies: [],
    criticalInputs: [],
  };
  return buildHouse(leeg, registers, states, null);
}
