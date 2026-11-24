/**
 * Instappunt van de schaduwmodus.
 *
 *   npm run shadow
 *
 * Leest `.env` uit de projectmap wanneer die er is; variabelen die al in de
 * shell staan winnen daarvan. Verbindt daarna met Home Assistant, laat de
 * arbiter meedenken op de echte toestand, en schrijft zijn besluiten naar de
 * console en een NDJSON-logboek. Er gaat niets terug naar Home Assistant: de
 * client wordt zonder schrijfrechten aangemaakt, en een `callService` zou daar
 * op stuklopen.
 */
import { paneelVan } from './web/push.js';
import { inHouse, snelInHuis } from './web/inhuis.js';
import { type WandMelding } from './web/klaarzetten-functies.js';
import { kiesTaal } from './web/stem.js';
import { InHuis, bevestigViaRest, maakViaWebsocket, type Stroom } from './web/stem-in-huis.js';
import { rollenUitConfig, type RegelingNiet } from './web/regeling.js';
import { KloptRegister } from './web/klopt.js';
import { VERSIE } from './version.js';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { SiteConfig } from './core/model.js';
import { HaClient, type HaEntityState, type HandMag } from './adapters/homeassistant/client.js';
import {
  fetchRegistries,
  type HaArea,
  type HaCoreConfig,
  type HaDevice,
  type HaFloor,
  type HaRegistryEntity,
} from './adapters/homeassistant/discovery.js';
import { buildHouse, knownForLayout, type HouseRegisters } from './web/house.js';
import { LayoutStore, herstelMeedoen, withLayoutNames, type Layout } from './web/layout.js';
import { noteSensors } from './web/meten.js';
import { configUitDeApp } from './web/config-uit-app.js';
import { ComfortStore, type Comfort, type ComfortView } from './web/comfort.js';
import { HelpenDag } from './web/helpen.js';
import { BewonersStore, GEEN_BEWONERS, comfortVanBewoner, vasthoudenVoorbij, zonderVasthoudenVan, type Bewoners, type Wie } from './web/bewoners.js';

import { UitstelStore } from './web/uitstel.js';
import { BufferStore, cheapWindows } from './web/warmtebuffers.js';
import { SceneColorStore, colorsFromLamps } from './web/scene-colors.js';
import { ScenePictures } from './web/scene-pictures.js';
import { EnergyStore } from './web/energy.js';
import { zetValuta } from './web/valuta.js';
import { httpBase } from './web/camera.js';
import { Pauze } from './web/taalmodel.js';
import { Teller } from './web/brein.js';
import { spraakKeuzes, type SpraakKeuze } from './web/functies.js';
import { aanKerenHistorie, alleCameraMelders, alleCamerasNu, camerasNu, laatsteAanUitHistorie } from './web/cameras.js';
import { FunctiesStore, aangebeld, functiesGevonden, functiesVoorstel, volledig, type Functies, type FunctiesGevonden } from './web/functies.js';
import { accusNu, accuView, ladenView } from './web/opslag.js';
import { laadMag } from './web/laadhand.js';
import { stekkerMag } from './web/stekkerhand.js';
import { ConnectionStore, SensorPace, connectionView, findAppliances, findPhaseMeters, findPhases, findPowers, metOpZonVanNu, withConnection } from './web/aansluiting.js';
import { sunPosition } from './core/sun.js';

import { inNederland } from './web/bag3d.js';
import { lampSchakelaars, schakelaarsMag } from './web/schakelaars.js';
import { alarmSensoren, vindRookmelders } from './web/rookmelders.js';
import { eigenUpdate, updateView, type UpdateView } from './web/bijwerken.js';
import type { DeferrableStateCode } from './core/decision.js';
import { CoverSwitch } from './web/covers.js';
import type { Lang } from './web/assistant.js';
import { LightSwitch } from './web/lights.js';
import { SessionStore, haBeheerders, homeAssistantLogin, type Access, type HaAccount } from './web/auth.js';
import { ShadowRunner, type LiveSnapshot } from './adapters/homeassistant/shadow.js';
import { defaultStrategies } from './index.js';
import { WebServer, versionFromEnv, type AlarmMelder } from './web/server.js';
import { DivergenceCache } from './web/divergence.js';
import { configFingerprint, recordRun } from './adapters/runs.js';
import { Onboarding } from './web/onboarding.js';
import { laadWekmodellen, type Wekmodellen } from './web/wekwoord.js';
import { BRUG_ENTITEITEN, MODUS_OPTIES } from './web/klimaatbrug.js';
import { HAND_KLIMAAT, HAND_KNOPPEN } from './web/hand.js';
import { Voorbeeld } from './web/voorbeeld.js';
import { Witgoed } from './web/witgoed.js';
import { Verstaan } from './web/verstaan.js';
import { configBijStart } from './start/config-bij-start.js';
import { webOpties } from './start/web-opties.js';
import { loadedFrom, startup, asAddon, url, token, tickSeconds, logDir, webPort, webDir, voorbeeldProces, inHuisMetDeuren } from './start/begin.js';
import { maakWeer } from './start/weer.js';
import { maakHerinneringen } from './start/herinneringen.js';
import { maakLigging } from './start/ligging.js';
import { maakAssistent } from './start/assistent.js';
import { maakOpbrengst } from './start/opbrengst.js';
import { maakMeldingen } from './start/meldingen.js';
import { maakBediening } from './start/bediening.js';
import { maakHuisNu } from './start/huis-nu.js';
import { maakGegevens } from './start/gegevens.js';


const strategies = defaultStrategies();

// De configuratie wordt bij het starten gelezen én gecontroleerd (start/config-bij-start.ts): een fout erin is een
// opstartfout met een aanwijzing. Daarover de aansluiting en meten met uit de app.
const bijStart = await configBijStart(startup, strategies, logDir);
let site = bijStart.site;
const { connectionStore, answersAtStart, baseConfig, layoutAtStart } = bijStart;
/** De antwoorden waarmee de regeling nu rekent: bij het starten, en op zon van nu (besluit 290). */
let answersInGebruik = answersAtStart;
let connectionApplied = bijStart.connectionApplied;

/*
 * Comfort uit de app (besluit 130): de temperaturen per kamer en de dagdelen,
 * over alles hierboven. Bij het starten, en daarna meteen als de bewoner iets
 * verandert: dan neemt de regeling het over zonder herstart.
 */
const comfortStore = logDir !== '' ? new ComfortStore(logDir) : null;
await comfortStore?.load();
/* Bewoners (besluit 147): wie hier woont, op volgorde, met elk een eigen comfort of dat van de hoofdgebruiker. */
const bewonersStore = logDir !== '' ? new BewonersStore(logDir) : null;
await bewonersStore?.load();
/**
 * De prijzen voor Helpen bij de cv (besluit 292): uit Energie › Prijzen, met de
 * prijs van nu bij een prijs per uur. Leeg tot de meters en prijzen geladen zijn.
 */
let prijzenVoorHelpen: () => { gas: number | null; stroom: number | null } = () => ({ gas: null, stroom: null });
/*
 * Wat niet klopt, als melding in de bel (besluit 314): wat de regeling niet kon
 * overnemen uit de laatste keer dat de configuratie is opgebouwd, hoeveel
 * stroommeters per fase de configuratie zelf noemt, en het register voor wat
 * mislukt. Het logboek krijgt het ook nog.
 */
const klopt = new KloptRegister();
let regelingNiet: readonly RegelingNiet[] = [];
const fasenIn = (raw: Record<string, unknown>): number => {
  const grid = typeof raw['grid'] === 'object' && raw['grid'] != null ? (raw['grid'] as Record<string, unknown>) : null;
  return Array.isArray(grid?.['phases']) ? (grid['phases'] as unknown[]).length : 0;
};
let basisFasen = 0;
if (site) {
  try {
    basisFasen = fasenIn(JSON.parse(await readFile(site.source, 'utf-8')) as Record<string, unknown>);
  } catch {
    // Niet te lezen: dan telt alleen wat de app over de meters weet.
  }
}
/** De ruwe configuratie met alles wat de app erover legt, en comfort zoals gegeven. */
async function configWithComfort(comfort: Comfort | null, bewoners: Bewoners = bewonersStore?.current ?? GEEN_BEWONERS): Promise<{ ok: true; config: SiteConfig; toegevoegd: string[] } | { ok: false; reden: string }> {
  if (!site) return { ok: false, reden: 'er is geen configuratie' };
  const base = JSON.parse(await readFile(site.source, 'utf-8')) as Record<string, unknown>;
  basisFasen = fasenIn(base);
  // De stapel zelf staat in config-uit-app.ts; hier de stand van nu.
  return configUitDeApp(base, {
    aansluiting: answersInGebruik,
    aansluitingToegevoegd: connectionApplied,
    // Meten met (besluit 123) uit de indeling van nu: de regeling neemt een andere sensor meteen over (138).
    layout: layoutNu?.() ?? layoutAtStart,
    state: (id) => allStates.get(id),
    vermogenSensor,
    comfort,
    bewoners,
    occupancy: site.config.occupancy,
    strategieen: strategies.ids,
    // Helpen bij de cv (besluit 292): de thermostaat van de ketel uit Energie › Verwarming, en de prijzen.
    // Gas alleen bij een cv-ketel: bij een warmtepomp of stadsverwarming vergelijkt het niet met gas.
    helpen: (() => {
      const vw = connectionStore?.current?.verwarming;
      const p = prijzenVoorHelpen();
      const gasKetel = vw?.soort == null || vw.soort === 'cv' || vw.soort === 'hybride' || vw.soort === 'weetniet';
      return { thermostaat: vw?.thermostaat ?? null, stroom: p.stroom, gas: gasKetel ? p.gas : null };
    })(),
    waarschuw: (t) => console.warn(t),
    niet: (lijst) => {
      regelingNiet = lijst;
    },
  });
}
/** De indeling van nu, zodra de opslag er is; daarvoor die van het starten. */
let layoutNu: (() => Layout | null) | null = null;
if (site && (comfortStore?.current || (bewonersStore?.current.volgorde.length ?? 0) > 0 || (layoutAtStart?.kamers ?? []).some((k) => k.rollen || (k.bronnen ?? []).some((b) => b.opZon)))) {
  try {
    const met = await configWithComfort(comfortStore?.current ?? null);
    if (met.ok) {
      site = { ...site, config: met.config };
      for (const t of met.toegevoegd) console.log(`Uit de app (comfort.json, indeling.json): ${t}`);
    } else {
      console.warn(`Comfort uit de app niet overgenomen: ${met.reden}`);
    }
  } catch {
    // Niet te lezen: dan zoals de configuratie zegt.
  }
}

const client: HaClient = new HaClient({
  url: url!,
  token: token!,
  // Schaduwmodus: expliciet geen schrijfrechten.
  allowWrites: false,
  // Behalve lampen aan en uit vanuit de app, als dat mag (besluit 97). De client
  // laat dan precies light.turn_on en light.turn_off op lampen door, niets anders.
  allowLights: startup.lights.enabled,
  // Scènes horen bij het licht (besluit 100): dezelfde schakelaar, een eigen deur.
  allowScenes: startup.lights.enabled,
  // Schermen open, dicht, stop of een stand, voor de bewoner (besluit 121). De
  // regeling stuurt hier niets doorheen.
  allowCovers: startup.screens.enabled,
  // Een AI-taak om een tekst vragen (besluit 148): de assistent in eigen woorden.
  // Er verandert niets in het huis; welke taak, kiest de bewoner bij Functies.
  allowAiTask: true,
  // Geluid laten uitschrijven, tot tekst en niet verder (besluit 150): de microfoon en "Hé huis".
  allowListen: true,
  // De eigen add-on bijwerken (21 oktober 2026): update.install op zijn eigen update-entiteit, alleen in de add-on.
  allowUpdate: () => (version.installatie === 'add-on' ? (eigenUpdate(allStates.values())?.entity_id ?? null) : null),
  // Een melding naar de telefoon van een bewoner (besluit 183): alleen notify.mobile_app_…, en alleen
  // in de add-on; de NAS kijkt mee en blijft stil, anders kwam elke melding dubbel.
  allowNotify: inHuisMetDeuren,
  // Te doen (besluit 216): iets op een lijst van Home Assistant zetten of afvinken, op een tik of zin
  // van de bewoner. Alleen in de add-on, zoals de meldingen: de NAS kijkt mee.
  allowTodo: inHuisMetDeuren,
  // De klimaatbrug (besluit 210): alleen de knoppen van het oude systeem, als de brug aan staat
  // of er nog iets terug moet. Alleen in de add-on (zie `klimaatBrug`).
  allowKnoppen: (): { readonly entiteiten: readonly string[]; readonly opties: readonly string[] } =>
    klimaatAan() || (klimaatBrug?.terugzetten.length ?? 0) > 0 || (handbediening?.terugzetten.length ?? 0) > 0 ? { entiteiten: [...new Set([...BRUG_ENTITEITEN, ...HAND_KNOPPEN])], opties: MODUS_OPTIES } : { entiteiten: [], opties: [] },
  // Klimaat met de hand (besluit 235): de airco's op verwarmen en de stekkers, als de brug aan staat of er nog iets terug moet.
  // Witgoed starten (ronde 5, besluit 238): alleen de startknop van een droger of vaatwasser, alleen met de deuren open (add-on of HEMS_DEUREN, besluit 309).
  allowStart: (): readonly string[] => witgoed?.knoppen() ?? [],
  // Laden met de hand (besluit 262): de laadpalen die de bewoner aanzette, en wat er nog terug moet. Alleen in de add-on.
  allowLaden: () => (laadhand ? laadMag(laadBedieningenNu(), laadhand.terugzetten) : { stroom: [], schakelaars: [], knoppen: [], easee: [], selects: [] }),
  // De slimme stekkers die de bewoner toeliet (besluit 265) gaan door dezelfde deur, los van de klimaatbrug.
  allowHand: (): HandMag => {
    // Zolang de dienst nog opstart, bestaat `stekkerhand` nog niet: dan geen stekkers.
    const stekkers = (() => {
      try {
        // En wat SunArc op zon aanzette (besluit 267): dat moet ook weer uit kunnen.
        return inHuisMetDeuren ? [...new Set([...stekkerMag(stekkersBekend(), stekkerhand.terugzetten), ...stekkerZon.eigen])] : [];
      } catch {
        return [];
      }
    })();
    const klimaat = klimaatAan() || (handbediening?.terugzetten.length ?? 0) > 0
      ? { klimaat: [...new Set([...HAND_KLIMAAT, ...handKnoppen().map((k) => k.id), ...(handbediening?.terugzetten ?? []).filter((t) => t.thermostaat).map((t) => t.id)])], schakelaars: [...handSchakelaars().map((s) => s.id), ...(handbediening?.terugzetten ?? []).filter((t) => t.modus === 'aan').map((t) => t.id)] }
      : { klimaat: [], schakelaars: [] };
    // Drogen en ventileren (besluit 319): dezelfde airco's als verwarmen met de hand, en wat er nog terug moet.
    const standen = klimaat.klimaat.length ? [...new Set([...HAND_KLIMAAT, ...(handbediening?.terugzetten ?? []).filter((t) => t.hvac).map((t) => t.id)])] : [];
    // Klimaat buiten de regeling, zoals het tuinhuis (besluit 319): los van de klimaatbrug, alleen met de deuren open.
    const los = (() => {
      try {
        return inHuisMetDeuren && handbediening ? Object.fromEntries(losKlimaat().map((k) => [k.id, k.voorinstellingen])) : {};
      } catch {
        return {};
      }
    })();
    // Schakelaars die de bewoner met de hand toeliet (besluit 297): dezelfde deur, alleen met de deuren open (add-on of HEMS_DEUREN, besluit 309).
    const relais = (() => {
      try {
        return inHuisMetDeuren ? schakelaarsMag(vindSchakelaarsNu(), schakelaarKeuzes()) : [];
      } catch {
        return [];
      }
    })();
    // Een kinderslot op een thermostaat of witgoed (besluit 299): dezelfde deur, alleen met de deuren open (add-on of HEMS_DEUREN, besluit 309).
    const sloten = (() => {
      try {
        return inHuisMetDeuren ? Object.values(kinderslotten()).map((s) => s.id) : [];
      } catch {
        return [];
      }
    })();
    return { klimaat: klimaat.klimaat, schakelaars: [...new Set([...klimaat.schakelaars, ...stekkers, ...relais, ...sloten])], standen, los };
  },
});

// De twee verwijzen naar elkaar: de runner duwt besluiten naar de weergave, de
// weergave haalt de laatste stand bij de runner op. Vandaar eerst een lege doos
// en pas daarna vullen — een van beide moet als eerste bestaan.
let web: WebServer | null = null;

/*
 * De laatst ontvangen toestand van Home Assistant.
 *
 * Zonder configuratie is er geen runner die een winkeltje bijhoudt, en de
 * onboarding heeft die toestanden nodig om te weten wat een apparaat kan.
 * Eén extra luisteraar op hetzelfde `ready`-signaal kost niets en werkt in
 * beide standen hetzelfde.
 */
/** Welke code er draait (besluit 54); gaat naar /api/health en runs.ndjson. */
const version = versionFromEnv(process.env);

/*
 * Bijwerken vanuit de app (21 oktober 2026): alleen in de add-on. Wat er nieuw
 * is, vraagt de dienst één keer per nieuwe versie aan Home Assistant.
 */
let releaseNotes: { versie: string; tekst: string | null } | null = null;
async function updateNu(magBijwerken: boolean, lang: Lang = 'nl'): Promise<UpdateView> {
  const s = version.installatie === 'add-on' ? eigenUpdate(allStates.values()) : null;
  const nieuwste = typeof s?.attributes['latest_version'] === 'string' ? (s.attributes['latest_version'] as string) : null;
  if (s && s.state === 'on' && nieuwste && releaseNotes?.versie !== nieuwste) {
    const tekst = await client.query<string | null>('update/release_notes', { entity_id: s.entity_id }).catch(() => null);
    releaseNotes = { versie: nieuwste, tekst: typeof tekst === 'string' ? tekst : null };
  }
  return updateView(VERSIE, s, releaseNotes?.versie === nieuwste ? releaseNotes.tekst : null, magBijwerken, lang);
}

let lastStates: readonly HaEntityState[] = [];

/*
 * De ligging van het huis, voor de stand van de zon (besluit 93).
 *
 * Eén decimaal, ongeveer tien kilometer: genoeg voor de zon, niet genoeg om het
 * huis te vinden (besluit 90). Alleen in het geheugen; hij gaat niet naar het
 * logboek, de export of de console.
 */
let location: { latDeg: number; lonDeg: number } | null = null;
const round1 = (n: number) => Math.round(n * 10) / 10;

/*
 * Het huis als navigatie (ONTWERP §4): lampen en zonwering per ruimte.
 *
 * De regeling volgt alleen de entiteiten uit de configuratie; voor het huis
 * houdt dit kaartje de stand van alle lampen en screens bij, uit dezelfde
 * stroom. De registers (etages, ruimtes, apparaten) worden bij elke verbinding
 * en daarna elk kwartier opnieuw gelezen: zo komt een verhuisde lamp vanzelf
 * mee. Alleen lezen.
 */
const houseStates = new Map<string, HaEntityState>();
/** Telt elke verandering in `houseStates`, zodat het huis weet wanneer het opnieuw moet (zie houseReport). */
let huisVersie = 0;
// Alle standen, voor de namen van meters en een prijs uit een entiteit (besluit 102).
const allStates = new Map<string, HaEntityState>();

/** Per AI-taak een pauze na "gebruik op" of "te druk" (besluit 148). */
const pauzes = new Map<string, Pauze>();
function pauzeVan(id: string): Pauze {
  let p = pauzes.get(id);
  if (!p) pauzes.set(id, (p = new Pauze()));
  return p;
}
/**
 * Hoeveel vragen er per dag naar het model gaan en hoe snel het antwoordt
 * (besluit 213). De dag in de tijdzone van het huis.
 */
const modelTeller = new Teller({
  map: logDir !== '' ? logDir : null,
  dag: () => new Intl.DateTimeFormat('en-CA', { timeZone: siteConfig?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone }).format(new Date()),
});
let houseRegisters: HouseRegisters | null = null;
/** Wat de thuisaccu's samen nu doen, in W: plus is laden (besluit 272, 274); null zonder accu. */
function accuNuW(): number | null {
  if (!houseRegisters) return null;
  const w = accusNu(laadReg(houseRegisters), allStates, connectionStore?.current?.laden ?? null, connectionStore?.current?.accu ?? null).map((a) => a.vermogenW).filter((x): x is number => x != null);
  return w.length ? w.reduce((s, x) => s + x, 0) : null;
}
/** De stroommeter bij hetzelfde apparaat in Home Assistant, zoals bij een airco (besluit 138). */
function vermogenSensor(entityId: string): string | null {
  const device = houseRegisters?.entities.find((e) => e.entity_id === entityId)?.device_id;
  if (!device) return null;
  const meter = houseRegisters!.entities.find(
    (e) => e.device_id === device && e.entity_id.startsWith('sensor.') && !e.disabled_by && allStates.get(e.entity_id)?.attributes['device_class'] === 'power',
  );
  return meter?.entity_id ?? null;
}
async function readHouseRegisters(): Promise<void> {
  const [floors, areas, devices, entities] = await Promise.all([
    client.query<HaFloor[]>('config/floor_registry/list').catch(() => [] as HaFloor[]),
    client.query<HaArea[]>('config/area_registry/list'),
    client.query<HaDevice[]>('config/device_registry/list'),
    client.query<HaRegistryEntity[]>('config/entity_registry/list'),
  ]);
  // De groepen van Zigbee2MQTT (besluit 221), alleen als er lampen van Zigbee2MQTT zijn: Home Assistant noemt hun lampen niet.
  const zigbee = entities.some((e) => e.platform === 'mqtt' && e.entity_id.startsWith('light.') && /_light_zigbee2mqtt$/.test(e.unique_id ?? ''));
  const zigbeeGroepen = zigbee ? await client.leesZigbeeGroepen().catch(() => []) : [];
  houseRegisters = { floors, areas, devices, entities, zigbeeGroepen };
  // Ging er al een rookmelder af voor de dienst startte: dan ook (21 oktober 2026).
  setTimeout(() => web?.alarm(alarmNu()), 2_000).unref?.();
}
// Hoe vaak de zonnesensor een nieuwe waarde geeft (besluit 89), overdag gemeten.
const solarPace = new SensorPace();
/*
 * Camera's en de deurbel (besluit 109): wat de bewoner vastlegde, of anders het
 * voorstel uit wat Home Assistant heeft. Het voorstel wordt opnieuw bepaald als
 * de registers veranderen, niet bij elke toestand: er komen er duizenden per uur.
 */
const functiesStore = logDir !== '' ? new FunctiesStore(logDir) : null;
await functiesStore?.load();
/** De spraakassistenten in Home Assistant (besluit 150), bij het verbinden en elke vijf minuten. */
let spraakLijst: SpraakKeuze[] = [];
async function spraakBij(): Promise<void> {
  try {
    spraakLijst = spraakKeuzes(await client.query('assist_pipeline/pipeline/list'));
  } catch {
    // Geen spraakassistenten (of een oudere Home Assistant): dan kan de microfoon niet.
  }
}
client.on('ready', () => void spraakBij());
setInterval(() => void spraakBij(), 5 * 60_000).unref();
/*
 * Witgoed starten (ronde 5, besluit 238): de startknop van een droger of
 * vaatwasser, op het moment dat de regeling zegt, of op een tik. Alleen in de
 * add-on (en het voorbeeldhuis), net als met de hand.
 */
let witgoed: Witgoed | null = null;

/** Wat bediening.ts uit main.ts gebruikt: wat vastligt gewoon, wat kan wijzigen als getter. */
const maakBedieningNodig = {
  allStates, client, connectionStore, klopt,
  get functiesKeuzes() {
    return functiesKeuzes;
  },
  get functiesNu() {
    return functiesNu;
  },
  get houseRegisters() {
    return houseRegisters;
  },
  get houseReport() {
    return houseReport;
  },
  get huisNu() {
    return huisNu;
  },
  get layoutNu() {
    return layoutNu;
  },
  get siteConfig() {
    return siteConfig;
  },
  get zekeringVoor() {
    return zekeringVoor;
  },
};
export type MaakBedieningNodig = typeof maakBedieningNodig;
const { handKnoppen, handSchakelaars, handbediening, kinderslotten, klimaatAan, klimaatBrug, laadBedieningenNu, laadReg, laadhand, losKlimaat, schakelaarKeuzes, schakelaarStore, stekkerZon, stekkerhand, stekkersBekend, stekkersVoorHuis, vindBuffers, vindBuffersHa, vindSchakelaarsNu } = await maakBediening(maakBedieningNodig);
/*
 * Het wekwoord in de dienst (besluit 208): `wekwoord/` naast `dist`, in de
 * add-on, op de NAS en in de repository. Zonder de modellen hoort
 * Home Assistant het wekwoord, zoals eerst.
 */
const wekmodellen: Wekmodellen | null = (() => {
  // Via fileURLToPath: `packageRoot` houdt op Windows de %20 van een spatie.
  const wortel = fileURLToPath(new URL('..', import.meta.url));
  const mappen = [process.env['HEMS_WEKWOORD_DIR'], join(wortel, 'wekwoord')].filter((m): m is string => !!m);
  for (const map of mappen) {
    if (!existsSync(join(map, 'he_huis.onnx'))) continue;
    try {
      const t = performance.now();
      const m = laadWekmodellen(map);
      console.log(`  wekwoord          he_huis, zelf gehoord (${Math.round(performance.now() - t)} ms om te laden)`);
      return m;
    } catch (error) {
      console.warn(`[wekwoord] ${map}: ${(error as Error).message}; Home Assistant hoort het wekwoord`);
      return null;
    }
  }
  return null;
})();
/** Het wekwoord van de dienst, tenzij de gekozen spraakassistent een ander wekwoord heeft. */
/** Uitschrijven in huis (besluit 211): je zin rechtstreeks naar Whisper. */
const verstaan = new Verstaan({ base: httpBase(url!), token: token! });
const wekwoordNu = (): Wekmodellen | null => {
  if (!wekmodellen) return null;
  const f = functiesNu();
  const gekozen = f ? volledig(f, functiesKeuzes()).praten.spraak : null;
  const assistent = spraakLijst.find((s) => (gekozen ? s.id === gekozen : s.voorkeur));
  return assistent?.wekwoord && assistent.wekwoord !== wekmodellen.naam ? null : wekmodellen;
};
let gevondenVoor: HouseRegisters | null = null;
let gevondenNu: FunctiesGevonden | null = null;
const functiesKeuzes = (): FunctiesGevonden | null => {
  if (!houseRegisters) return null;
  if (gevondenVoor !== houseRegisters || gevondenNu == null) {
    gevondenNu = functiesGevonden(houseRegisters.entities, houseRegisters.devices, allStates);
    gevondenVoor = houseRegisters;
  }
  // De spraakassistenten (besluit 150) komen apart: die vraagt de dienst Home Assistant zelf.
  return { ...gevondenNu, spraakassistenten: spraakLijst, klimaatBrug: klimaatBrug?.beschikbaar ?? false };
};

/**
 * De andere beelden van dezelfde camera, het lichtste eerst (21 oktober 2026):
 * gaf het gekozen beeld van de deurbel niets, dan bleef het scherm zwart.
 */
const reserveBeelden = (camera: string): string[] => {
  const groep = functiesKeuzes()?.cameras.find((c) => c.beelden.some((b) => b.id === camera));
  return (groep?.beelden ?? []).filter((b) => b.id !== camera).sort((a, b) => Number(b.voorkeur) - Number(a.voorkeur)).map((b) => b.id);
};

const functiesNu = (): Functies | null => {
  if (functiesStore?.current) return functiesStore.current;
  const g = functiesKeuzes();
  return g ? functiesVoorstel(g) : null;
};
/** Wanneer er het laatst werd aangebeld, voor de kaart op Thuis (besluit 182); null tot het gebeurt. */
let aangebeldMs: number | null = null;
/** De deurbel als kaart: het beeld, de naam, en wanneer; anders wanneer de melder het laatst iets deed. */
const deurbelNu = () => {
  const f = functiesNu();
  if (!f?.deurbel.aan || !f.deurbel.camera) return null;
  const camera = f.deurbel.camera;
  const naam = functiesKeuzes()?.cameras.find((c) => c.beelden.some((b) => b.id === camera))?.naam ?? 'Deurbel';
  const melder = f.deurbel.melder ? allStates.get(f.deurbel.melder) : undefined;
  // Een gebeurtenis (event.…) heeft het moment als stand; een melder zijn laatste wissel.
  const uitMelder = melder ? Date.parse(melder.entity_id.startsWith('event.') ? melder.state : melder.last_changed) : NaN;
  return { camera, naam, laatsteMs: aangebeldMs ?? (Number.isFinite(uitMelder) ? uitMelder : null), reserve: reserveBeelden(camera) };
};
/*
 * De kaart Camera's (besluit 201): wanneer elke bewegingsmelder van een camera
 * het laatst aanging. Eén keer uit de historie van de laatste twee dagen (en
 * opnieuw als de melders veranderen), daarna wat de dienst zelf ziet.
 */
const bewegingAan = new Map<string, number>();
/** Per melder de momenten dat hij aanging, van gisteren en vandaag: om bij Apparaten te tellen hoe vaak (20 november 2026). */
const bewegingKeren = new Map<string, number[]>();
const nogEenKeer = (id: string, ms: number) => {
  const sinds = ms - 2 * 86_400_000;
  bewegingKeren.set(id, [...(bewegingKeren.get(id) ?? []).filter((x) => x >= sinds), ms]);
};
let bewegingGeladen = '';
let bewegingMelders: { van: FunctiesGevonden | null; f: Functies | null; ids: ReadonlySet<string> } = { van: null, f: null, ids: new Set() };
const camMelders = (): ReadonlySet<string> => {
  const f = functiesNu();
  // Opnieuw als wat er gevonden of gekozen is verandert; niet bij elke toestand.
  if (bewegingMelders.van !== gevondenNu || bewegingMelders.f !== f) {
    const g = functiesKeuzes();
    // Alle camera's en de deurbel (20 november 2026): Apparaten telt ook die niet op Thuis staan.
    bewegingMelders = { van: gevondenNu, f, ids: new Set(f ? alleCameraMelders(f, g) : []) };
  }
  return bewegingMelders.ids;
};
async function bewegingHistorie(): Promise<void> {
  const ids = [...camMelders()];
  const sleutel = ids.join(',');
  if (!ids.length || sleutel === bewegingGeladen) return;
  bewegingGeladen = sleutel;
  try {
    const antwoord = await client.query('history/history_during_period', { start_time: new Date(Date.now() - 2 * 86_400_000).toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
    for (const [id, ms] of laatsteAanUitHistorie(antwoord)) if (ms > (bewegingAan.get(id) ?? 0)) bewegingAan.set(id, ms);
    for (const [id, keren] of aanKerenHistorie(antwoord)) bewegingKeren.set(id, [...new Set([...keren, ...(bewegingKeren.get(id) ?? [])])].sort((a, b) => a - b));
  } catch {
    // Zonder historie (een oudere Home Assistant): dan vanaf nu.
    bewegingGeladen = '';
  }
}
// Bij het verbinden alvast, zodat de kaart het meteen weet; de registers zijn er dan net.
client.on('ready', () => setTimeout(() => void bewegingHistorie(), 5_000).unref());
const camerasLijst = () => {
  const f = functiesNu();
  if (!f) return [];
  void bewegingHistorie();
  return camerasNu(f, functiesKeuzes(), allStates, bewegingAan, deurbelNu()?.laatsteMs ?? null);
};
/** Alle camera's voor Apparaten, met hoe vaak ze vandaag iets zagen en er werd aangebeld. */
const camerasAlle = () => {
  const f = functiesNu();
  if (!f) return [];
  void bewegingHistorie();
  const vanaf = new Date();
  vanaf.setHours(0, 0, 0, 0);
  const bel = f.deurbel.aan && f.deurbel.melder ? (bewegingKeren.get(f.deurbel.melder) ?? []) : [];
  return alleCamerasNu(f, functiesKeuzes(), allStates, bewegingAan, deurbelNu()?.laatsteMs ?? null, bewegingKeren, bel, vanaf.getTime());
};
client.on('stateChanged', (state: HaEntityState) => {
  // Een camera ziet beweging (besluit 201): onthouden wanneer, voor de kaart Camera's.
  if (state.entity_id.startsWith('binary_sensor.') && state.state === 'on' && allStates.get(state.entity_id)?.state !== 'on' && camMelders().has(state.entity_id)) {
    bewegingAan.set(state.entity_id, Date.now());
    nogEenKeer(state.entity_id, Date.now());
  }
  // Aanbellen: de melder van de deurbel gaat af. Dan toont elke open pagina het beeld.
  const f = functiesNu();
  if (f && aangebeld(f, state, allStates.get(state.entity_id))) {
    aangebeldMs = Date.now();
    // Een gebeurtenis telt hier; een melder telde hierboven al (20 november 2026).
    if (!state.entity_id.startsWith('binary_sensor.')) nogEenKeer(state.entity_id, Date.now());
    const camera = f.deurbel.camera!;
    const naam = functiesKeuzes()?.cameras.find((c) => c.beelden.some((b) => b.id === camera))?.naam ?? 'Deurbel';
    web?.ring(camera, naam, { seconden: f.deurbel.seconden, schermAan: f.deurbel.schermAan, reserve: reserveBeelden(camera) });
  }
  // Een rookmelder ziet rook, koolmonoxide of hitte, of niet meer (21 oktober 2026): elk open scherm.
  if (houseRegisters && state.entity_id.startsWith('binary_sensor.') && state.state !== allStates.get(state.entity_id)?.state && alarmSensoren(vindRookmelders(houseRegisters.entities, houseRegisters.devices, allStates)).has(state.entity_id)) {
    // Na deze ronde: dan kent het huis de nieuwe stand al.
    setTimeout(() => {
      web?.alarm(alarmNu());
      // Meteen bij Meldingen, niet pas over een minuut.
      meldingenRonde();
    }, 0);
  }
  // Een nieuwe versie van de add-on (besluit 171): meteen bij Meldingen, niet pas na een minuut.
  if (state.entity_id.startsWith('update.') && state.state !== allStates.get(state.entity_id)?.state) setTimeout(() => meldingenRonde(), 0);
  // De wand wekken (besluit 164): de gekozen bewegingsmelder ziet iemand.
  if (voorkeuren?.melders().includes(state.entity_id) && state.state === 'on' && allStates.get(state.entity_id)?.state !== 'on') web?.wek('beweging');
  if (inHouse(state)) {
    houseStates.set(state.entity_id, state);
    huisVersie++;
    // Live naar de open pagina's (21 oktober 2026): wat je bedient of ziet bewegen meteen.
    web?.huisVeranderd(snelInHuis(state));
  }
  // Wie er thuis is (besluit 169): de rondjes op Thuis.
  if (state.entity_id.startsWith('person.') || siteConfig?.occupancy.some((o) => o.ref.id === state.entity_id)) web?.bewonersVeranderd();
  allStates.set(state.entity_id, state);
  const solar = baseConfig?.solarProduction;
  if (solar && state.entity_id === solar.id) {
    solarPace.note(Date.now(), Number(solar.attribute ? state.attributes[solar.attribute] : state.state));
  }
});
setInterval(() => void readHouseRegisters().catch(() => {}), 15 * 60_000).unref();

client.on('ready', (states: HaEntityState[]) => {
  lastStates = states;
  for (const s of states) {
    if (inHouse(s)) houseStates.set(s.entity_id, s);
    huisVersie++;
    allStates.set(s.entity_id, s);
  }
  void readHouseRegisters()
    .then(() => {
      // Een apparaat uit Home Assistant in de regeling (besluit 138) kan pas met zijn stand erbij.
      if ((layoutNu?.()?.kamers ?? []).some((k) => Object.entries(k.rollen ?? {}).some(([id, r]) => r !== 'kijken' && id.startsWith('climate.')))) void herlaadUitDeApp('de verbinding');
    })
    .catch(() => {
      // Zonder registers is er geen huis te tonen; de volgende verbinding opnieuw.
    });
  // De ligging en, sinds de testerronde (november 2026), de valuta: bij elke verbinding.
  {
    client
      .query<HaCoreConfig>('get_config')
      .then((c) => {
        zetValuta(c.currency);
        if (location == null && typeof c.latitude === 'number' && typeof c.longitude === 'number') {
          location = { latDeg: round1(c.latitude), lonDeg: round1(c.longitude) };
        }
      })
      .catch(() => {
        // Zonder ligging valt alleen de zoninval weg; volgende verbinding opnieuw.
      });
  }
});

/*
 * "Klaar voor" bij de droger (besluit 101): alleen met een logmap, want het
 * bestand staat naast de dataset, en alleen als er een uitstelbaar apparaat is.
 * Vóór de dienst, zodat die het bij elk besluit kan lezen.
 */
const uitstelStore: UitstelStore | null =
  logDir !== '' && site
    ? new UitstelStore({
        logDir,
        config: site.config,
        status: (id): DeferrableStateCode | null => runner?.latest?.explanation.deferrables?.find((d) => d.id === id)?.state ?? null,
        onChange: () => runner?.nudge('uitstel'),
      })
    : null;
await uitstelStore?.load();

/* Klaar om, legionella en vol bij de boiler en de jacuzzi (besluit 186): naast de dataset. */
const bufferStore: BufferStore | null =
  logDir !== '' && site
    ? new BufferStore({ logDir, config: site.config, onChange: () => runner?.nudge('klaarom') })
    : null;
await bufferStore?.load();

/* Wat de airco's vandaag hielpen bij de cv (besluit 292). */
const helpenDag = new HelpenDag(() => siteConfig?.timezone ?? 'Europe/Amsterdam');

/* Meters en prijzen voor Opbrengst (besluit 102): naast de dataset, dus alleen met een logmap. */
const energyStore = logDir !== '' ? new EnergyStore(logDir) : null;
await energyStore?.load();
prijzenVoorHelpen = () => {
  const p = energyStore?.current?.prijzen;
  const nu = p?.dynamisch?.prijsEntiteit ? Number(allStates.get(p.dynamisch.prijsEntiteit)?.state) : Number.NaN;
  return { gas: p?.gas ?? null, stroom: p?.stroom ?? (Number.isFinite(nu) ? nu : null) };
};

const runner: ShadowRunner | null =
  site == null
    ? null
    : new ShadowRunner({
        config: site.config,
        strategies,
        client,
        tickSeconds,
        minIntervalSeconds: startup.minIntervalSeconds,
        watchdogMinutes: startup.watchdogMinutes,
        logDir,
        ...(uitstelStore ? { readyBy: () => uitstelStore.readyBy } : {}),
        // De goedkoopste uren zijn de daluren van het contract, als het er een heeft.
        ...(bufferStore && site
          ? { warmte: (nowMs: number) => ({ extra: bufferStore.extra, cheapWindows: cheapWindows(nowMs, site.config.timezone, energyStore?.current?.prijzen ?? null) }) }
          : {}),
        // De thuisaccu in de schaduw (besluit 274): wat hij met zon laadt, telt daar als zon over.
        accu: accuNuW,
        ...(webPort == null
          ? {}
          : {
              onDecision: (snapshot: LiveSnapshot) => {
                // Een eindtijd vervalt als het programma klaar is of de deur openging.
                void uitstelStore?.prune(snapshot.explanation.deferrables);
                void bufferStore?.observe(snapshot.explanation.heatStores);
                // Helpen bij de cv (besluit 292): wat de airco's vandaag hielpen.
                // De dagbalk (besluit 303): of de ketel stookt, of het stil moet, en welke airco zelf verwarmt.
                {
                  const doet = snapshot.observedAction ?? {};
                  const ketel = (siteConfig?.cvHelp?.boilerIds ?? []).some((id) => doet[id] === 'heating');
                  const warm = new Set(Object.keys(doet).filter((id) => doet[id] === 'heating'));
                  const stil = snapshot.explanation.mode === 'nacht' || snapshot.explanation.mode === 'voorverwarmen';
                  helpenDag.observe(snapshot.atMs, new Set(snapshot.accepted.filter((i) => i.strategyId === 'heat-assist').map((i) => i.actuatorId)), { ketel, stil, warm });
                }
                // Wat de regeling zou starten, start SunArc nu echt (besluit 238).
                void witgoed?.opBesluit(snapshot).catch(() => []);
                // En een stekker op zon (besluit 267).
                void stekkerZon.opBesluit(snapshot.explanation.heatStores).then(
                  (gedaan) => {
                    klopt.gelukt('opZon', 'stekker');
                    gedaan.forEach((g) => console.log(`[stekker op zon] ${g}`));
                  },
                  (e: unknown) => {
                    klopt.meld({ soort: 'opZon', id: 'stekker', naam: 'Een stekker', sindsMs: Date.now() }, 6 * 3_600_000);
                    console.warn(`[stekker op zon] lukte niet: ${(e as Error).message}`);
                  },
                );
                web?.publish(snapshot);
                // De stand van de kamers in het huis hangt aan het besluit.
                web?.huisVeranderd(false);
              },
            }),
      });

// De analyse over de logboeken. Alleen zinvol wanneer er ook gelogd wordt —
// zonder logboek valt er niets terug te kijken.
const analyse = webPort == null || logDir === '' ? null : new DivergenceCache({ logDir });

/*
 * De onboarding bestaat alleen achter Ingress.
 *
 * Dit is de schakelaar uit besluit 42, en hij staat hier en niet in de server:
 * de server weet niet waar hij draait, `main.ts` wel. Zonder Supervisor is er
 * geen inlog voor de pagina, en dan hoort er geen route te bestaan die
 * bestanden wegschrijft — ook niet een die niemand aanroept.
 */
/*
 * Buiten de add-on kan het ook, maar dan moet je het zeggen.
 *
 * Dezelfde vorm als `HEMS_WEB_PORT`: luisteren is een keuze die je maakt, niet
 * iets wat je overkomt. Zonder deze schakelaar zou de onboarding alleen achter
 * Ingress bestaan en dus nergens uit te proberen zijn — en een deur die je niet
 * kunt testen, test je op de draaiende dienst.
 *
 * Wie hem aanzet zonder inlog ervoor, zet een pagina op zijn netwerk die
 * bestanden wegschrijft. Vandaar de waarschuwing bij het starten.
 */
if (startup.onboarding.withoutIngress) {
  console.warn('LET OP: de onboarding staat aan zonder Ingress ervoor.');
  // Met de inlog van besluit 99 vraagt hij een beheerder; open is hij voor iedereen.
  console.warn(
    startup.access.kind === 'open'
      ? '  Deze weergave staat open (HEMS_OPEN). Doe dit alleen op een machine'
      : '  Alleen een beheerder in Home Assistant kan hem gebruiken. Doe dit toch alleen',
  );
  console.warn(startup.access.kind === 'open' ? '  waar je zelf bij bent, en zet HEMS_ONBOARDING daarna weer uit.' : '  als je hem nodig hebt, en zet HEMS_ONBOARDING daarna weer uit.');
}

const onboarding =
  startup.onboarding.enabled
    ? new Onboarding({
        registers: () => fetchRegistries(client, lastStates),
        sitesDir: startup.sitesDir ?? join(process.cwd(), 'config', 'sites'),
        knownStrategies: strategies.ids,
      })
    : null;

// Na het laden; comfort uit de app (besluit 130) kan hem later vervangen.
let siteConfig = site?.config ?? null;
witgoed = inHuisMetDeuren
  ? new Witgoed({
      config: () => siteConfig,
      entiteiten: () => houseRegisters?.entities ?? null,
      state: (id) => allStates.get(id),
      druk: (knop) => client.callService('button', 'press', {}, { entity_id: knop }),
      aan: () => inHuisMetDeuren,
      write: (r) => console.log(r),
    })
  : null;

/*
 * De indeling van het huis (besluit 96): alleen als er gelogd wordt, want hij
 * staat naast de dataset, en alleen met een configuratie.
 */
const layoutStore: LayoutStore | null =
  logDir !== '' && siteConfig
    ? new LayoutStore({
        logDir,
        // Met de lampen achter een schakelaar (besluit 297): anders bleef hun kamer niet bewaard (melding 163).
        known: () => (houseRegisters ? knownForLayout(siteConfig!, houseRegisters, houseStates, [...lampSchakelaars(vindSchakelaarsNu(), schakelaarKeuzes()).map((r) => r.id), ...stekkersVoorHuis().map((s) => s.id)]) : null),
        // Een bron die op zon mag (besluit 132): de regeling neemt het meteen over, net als comfort.
        onSaved: () => void herlaadUitDeApp('de indeling'),
      })
    : null;
layoutNu = () => layoutStore?.current ?? layoutAtStart;
/*
 * De eenmalige overstap (besluit 138): wat het bestand per zone zegt, komt als
 * rollen in de indeling. Daarna is de app de plek; het bestand houdt alleen
 * wat de app nog niet kent.
 */
async function rollenOvernemen(l: Layout | null): Promise<void> {
  if (!l || !site || l.kamers.some((k) => k.rollen !== undefined)) return;
  const base = JSON.parse(await readFile(site.source, 'utf-8')) as Record<string, unknown>;
  const raw = answersInGebruik && connectionApplied.toegevoegd.length ? withConnection(base, answersInGebruik).raw : base;
  const over = await layoutStore!.overnemen((x) => ({
    ...x,
    kamers: x.kamers.map((k) => {
      const rollen = rollenUitConfig(raw, k.regelzone);
      return rollen ? { ...k, rollen } : k;
    }),
  }));
  if (over) console.log(`Uit het bestand naar de app (besluit 138): ${over.kamers.filter((k) => k.rollen).map((k) => k.naam).join(', ')}`);
}
// Daarna het herstel van "Geregeld als" (besluit 142), ook voor wat al bewaard staat; na elkaar, zodat de een de ander niet overschrijft.
void layoutStore?.load().then(rollenOvernemen).then(async () => {
  const hersteld = await layoutStore!.overnemen((x) => ({ ...x, kamers: herstelMeedoen(x.kamers) }));
  if (hersteld) console.log(`Hersteld (besluit 142): ${hersteld.kamers.filter((k) => k.meedoenMet).map((k) => `${k.naam} doet mee met ${hersteld.kamers.find((x) => x.id === k.meedoenMet)?.naam}`).join(', ')}`);
});

/** Alles uit de app opnieuw over de configuratie, en de regeling neemt het over als het kan. */
async function herlaadUitDeApp(waarom: string): Promise<void> {
  try {
    const met = await configWithComfort(comfortStore?.current ?? null);
    if (!met.ok) return console.warn(`Na ${waarom}: niet overgenomen, ${met.reden}`);
    // Met de stand van nu kan de regeling ook andere sensoren en apparaten meteen volgen (besluit 138).
    if (runner && !runner.setConfig(met.config, allStates.values())) return console.warn(`Na ${waarom}: de regeling neemt het over na de volgende start`);
    siteConfig = met.config;
    if (logDir !== '') await noteSensors(logDir, met.config, Date.now()).catch(() => false);
  } catch {
    // Niet te lezen: dan blijft het zoals het was.
  }
}

/**
 * Op zon aan of uit gaat meteen in (besluit 290): na het bewaren bij Regeling ›
 * Op zon rekent de regeling met wat er nu op zon staat, zonder herstart. Neemt
 * de regeling het niet over, dan blijft het zoals het was en zegt de pagina dat
 * het na de volgende start ingaat.
 */
async function opZonMeteen(): Promise<void> {
  const nu = connectionStore?.current;
  if (!site || !nu) return;
  const vorig = { answers: answersInGebruik, applied: connectionApplied };
  const proef = metOpZonVanNu(answersInGebruik, nu);
  // Niets anders op zon: wel de thermostaat van de ketel voor Helpen bij de cv (besluit 292).
  if (JSON.stringify(proef) === JSON.stringify(answersInGebruik)) return herlaadUitDeApp('de aansluiting');
  try {
    const applied = withConnection(JSON.parse(await readFile(site.source, 'utf-8')) as Record<string, unknown>, proef);
    answersInGebruik = proef;
    connectionApplied = { toegevoegd: applied.toegevoegd, overgeslagen: applied.overgeslagen };
    const met = await configWithComfort(comfortStore?.current ?? null);
    if (!met.ok) throw new Error(met.reden);
    if (runner && !runner.setConfig(met.config, allStates.values())) throw new Error('de regeling nam het niet over');
    siteConfig = met.config;
    uitstelStore?.setConfig(met.config);
    bufferStore?.setConfig(met.config);
    console.log(`Op zon meteen overgenomen: ${(met.config.deferrables ?? []).length} apparaten, ${(met.config.heatStores ?? []).length} buffers en stekkers`);
  } catch (e) {
    answersInGebruik = vorig.answers;
    connectionApplied = vorig.applied;
    console.warn(`Op zon gaat in na de volgende start: ${(e as Error).message}`);
  }
}

/* De kleuren van de Hue-scènes, zoals de lampen ze lieten zien (besluit 100). */
const sceneColors = logDir !== '' ? new SceneColorStore(logDir) : null;
await sceneColors?.load();
// Plaatjes die de bewoner zelf in logs/scene-plaatjes/ zette; elke tien minuten opnieuw gelezen.
const scenePictures = logDir !== '' ? new ScenePictures(logDir) : null;
await scenePictures?.refresh();
if (scenePictures) setInterval(() => void scenePictures.refresh(), 10 * 60_000).unref();

/** Wat ligging.ts uit main.ts gebruikt: wat vastligt gewoon, wat kan wijzigen als getter. */
const maakLiggingNodig = {
  client, connectionStore,
  get houseRegisters() {
    return houseRegisters;
  },
  get location() {
    return location;
  },
  get siteConfig() {
    return siteConfig;
  },
};
export type MaakLiggingNodig = typeof maakLiggingNodig;
const { grenzenGevonden, metLigging, metingNu, omvormerGevonden, vlakMetingNu } = maakLigging(maakLiggingNodig);

/** De configuratie zoals de app hem laat zien: met de namen en de volgorde uit de indeling (besluit 131). */
const webConfig = () => (siteConfig ? metLigging(withLayoutNames(siteConfig, layoutStore?.current ?? null)) : null);

/** Waar een tik op de melding naartoe gaat: SunArc in de app van Home Assistant. */
let paneelPad: string | null = null;
/** De naam van deze add-on bij de Supervisor, voor de pagina met zijn instellingen (besluit 246). */
let eigenSlug: string | null = null;
if (version.installatie === 'add-on' && process.env['SUPERVISOR_TOKEN']) {
  void fetch('http://supervisor/addons/self/info', { headers: { authorization: `Bearer ${process.env['SUPERVISOR_TOKEN']}` } })
    .then((r) => (r.ok ? (r.json() as Promise<{ data?: { slug?: string } }>) : null))
    .then((info) => {
      paneelPad = paneelVan(info?.data?.slug);
      eigenSlug = typeof info?.data?.slug === 'string' ? info.data.slug : null;
    })
    .catch(() => undefined);
}

/** Wat meldingen.ts uit main.ts gebruikt: wat vastligt gewoon, wat kan wijzigen als getter. */
const maakMeldingenNodig = {
  allStates, analyse, bewonersStore, client, connectionStore, energyStore, klopt, laadReg, laadhand, layoutStore,
  metingNu, runner, version, vindBuffersHa, vlakMetingNu, webConfig,
  get basisFasen() {
    return basisFasen;
  },
  get houseRegisters() {
    return houseRegisters;
  },
  get houseReport() {
    return houseReport;
  },
  get huisNu() {
    return huisNu;
  },
  get layoutNu() {
    return layoutNu;
  },
  get paneelPad() {
    return paneelPad;
  },
  get regelingNiet() {
    return regelingNiet;
  },
  get siteConfig() {
    return siteConfig;
  },
  get web() {
    return web;
  },
};
export type MaakMeldingenNodig = typeof maakMeldingenNodig;
const { meldingen, meldingenRonde, proefmelding, sluipverbruik, telefoonDeur, telefoons, voorkeuren } = await maakMeldingen(maakMeldingenNodig);

/** Wat herinneringen.ts uit main.ts gebruikt: wat vastligt gewoon, wat kan wijzigen als getter. */
const maakHerinneringenNodig = {
  allStates, bewonersStore, client, functiesKeuzes, functiesNu, handKnoppen, handbediening, klimaatAan, klopt, runner,
  stekkerhand, telefoonDeur, telefoons, voorkeuren,
  get coverSwitch() {
    return coverSwitch;
  },
  get lightSwitch() {
    return lightSwitch;
  },
  get location() {
    return location;
  },
  get paneelPad() {
    return paneelPad;
  },
  get siteConfig() {
    return siteConfig;
  },
  get witgoed() {
    return witgoed;
  },
};
export type MaakHerinneringenNodig = typeof maakHerinneringenNodig;
const { teDoen } = maakHerinneringen(maakHerinneringenNodig);

/** Wat opbrengst.ts uit main.ts gebruikt: wat vastligt gewoon, wat kan wijzigen als getter. */
const maakOpbrengstNodig = {
  allStates, client, connectionStore, energyStore, laadReg, vlakMetingNu,
  get houseRegisters() {
    return houseRegisters;
  },
  get location() {
    return location;
  },
  get siteConfig() {
    return siteConfig;
  },
};
export type MaakOpbrengstNodig = typeof maakOpbrengstNodig;
const { dakenOpbrengst, historieVan, laadbeurten } = maakOpbrengst(maakOpbrengstNodig);

/** Welke rookmelders nu iets zien, met hun kamer (21 oktober 2026). */
function alarmNu(): AlarmMelder[] {
  const h = houseReport();
  return (h?.etages ?? []).flatMap((e) => e.ruimtes.flatMap((r) => r.apparaten.filter((d) => d.soort === 'rookmelder').map((d) => ({ id: d.id, naam: d.naam, kamer: r.naam, gevaar: d.rookmelder?.gevaar ?? null, sindsMs: d.rookmelder?.sindsMs ?? null }))));
}

/** Wat huis-nu.ts uit main.ts gebruikt: wat vastligt gewoon, wat kan wijzigen als getter. */
const maakHuisNuNodig = {
  allStates, client, connectionStore, energyStore, functiesStore, houseStates, laadReg, layoutStore, runner,
  sceneColors, scenePictures, schakelaarKeuzes, schakelaarStore, sluipverbruik, stekkersVoorHuis, vindSchakelaarsNu,
  webConfig,
  get houseRegisters() {
    return houseRegisters;
  },
  get huisVersie() {
    return huisVersie;
  },
  get location() {
    return location;
  },
  get openMeteo() {
    return openMeteo;
  },
  get siteConfig() {
    return siteConfig;
  },
};
export type MaakHuisNuNodig = typeof maakHuisNuNodig;
const { fasenNuView, huisNu, laadadviezen, zekeringVoor } = maakHuisNu(maakHuisNuNodig);

/** Het huis, met de stand in woorden in de taal van de app; zonder taal Nederlands. */
const houseReport = (lang: Lang = 'nl'): ReturnType<typeof buildHouse> | null => {
  const h = huisNu(lang);
  // Met de laatste opdracht bij een scherm zonder terugmelding (besluit 128).
  return coverSwitch ? coverSwitch.withLast(h, lang) : h;
};

/*
 * Gaat een scène aan (zijn stand is het tijdstip), dan kijken we zes tellen
 * later naar de lampen van zijn Hue-groep, of anders van zijn ruimte, en
 * onthouden hun kleuren. Alleen lezen.
 */
client.on('stateChanged', (state: HaEntityState) => {
  if (!sceneColors || !state.entity_id.startsWith('scene.') || !Number.isFinite(Date.parse(state.state))) return;
  setTimeout(() => {
    const house = houseReport();
    const room = house?.etages.flatMap((f) => f.ruimtes).find((r) => r.scenes.some((sc) => sc.id === state.entity_id));
    const scene = room?.scenes.find((sc) => sc.id === state.entity_id);
    if (!room || !scene) return;
    const lower = (x: string) => x.trim().toLowerCase();
    const group = scene.groep ? lower(scene.groep) : null;
    const own = group ? room.apparaten.filter((d) => lower(d.haNaam) === group || d.groepen.some((g) => lower(g) === group)) : [];
    void sceneColors.remember(state.entity_id, colorsFromLamps(own.length > 0 ? own : room.apparaten)).catch(() => {});
  }, 6_000).unref?.();
});

/*
 * Licht bedienen (besluit 97): alleen de lampen die het huis toont, en alleen
 * aan en uit. SunArc regelt het licht niet (92); dit is een knop.
 */
/*
 * De deuren van de add-on op een eigen server (besluit 309): dezelfde regels,
 * maar zonder Ingress ervoor. Twee installaties met open deuren op hetzelfde Home
 * Assistant bedienen elkaars apparaten en sturen meldingen dubbel.
 */
if (startup.deuren.enabled && !startup.asAddon) {
  console.warn('LET OP: de deuren van de add-on staan open op deze server (HEMS_DEUREN=1).');
  console.warn('  Met de hand bedienen, schakelaars, stekkers, laden, witgoed, lijsten en meldingen op de telefoon werken hier.');
  console.warn('  Zet ze nooit in twee installaties tegelijk open op hetzelfde Home Assistant.');
  if (startup.deuren.withoutLogin) console.warn('  Zonder inlog (HEMS_OPEN=1) kan iedereen die deze weergave opent, bedienen.');
}
if (startup.lights.withoutIngress) {
  console.warn('LET OP: licht bedienen staat aan zonder Ingress ervoor.');
  console.warn('  Iedereen die deze weergave kan openen, kan je lampen schakelen.');
  console.warn('  Zet HEMS_LIGHTS=0 als je dat niet wilt.');
}
const lightSwitch = startup.lights.enabled
  ? new LightSwitch({
      house: houseReport,
      call: async (service, entityIds, data) => {
        // Een lamp achter een schakelaar (besluit 297) is een `switch.`: die gaat los aan of uit, zonder helderheid.
        const lampen = entityIds.filter((id) => id.startsWith('light.'));
        const relais = entityIds.filter((id) => id.startsWith('switch.'));
        if (lampen.length) await client.callService('light', service, data, { entity_id: lampen });
        for (const id of relais) await client.callService('switch', service, {}, { entity_id: id });
      },
      callScene: (sceneId) => client.callService('scene', 'turn_on', {}, { entity_id: sceneId }),
    })
  : null;

/*
 * Schermen bedienen (besluit 121): alleen schermen die het huis toont, één per
 * opdracht. Een knop voor de bewoner; de regeling doet niets met schermen.
 */
const coverSwitch = startup.screens.enabled
  ? new CoverSwitch({
      house: houseReport,
      call: (service, entityId, data) => client.callService('cover', service, data, { entity_id: entityId }),
    })
  : null;

/*
 * Wie mag bedienen (besluit 99). Op de NAS een eigen inlog via Home Assistant;
 * de sessies staan naast de dataset, alleen als vingerafdruk.
 */
let access: Access;
if (startup.access.kind === 'sessions') {
  const loginUrl = startup.access.haLoginUrl ?? url ?? '';
  access = {
    kind: 'sessions',
    store: new SessionStore({ logDir: logDir === '' ? null : logDir }),
    login: homeAssistantLogin(loginUrl),
    hosts: startup.access.hosts,
    lokaalLezen: startup.lokaalLezen,
  };
  if (startup.lokaalLezen) {
    console.warn('LET OP: lezen zonder inlog van binnen deze server staat aan (HEMS_LOKAAL_LEZEN=1).');
    console.warn('  Alleen GET van 127.0.0.1, zoals via docker exec; bedienen vraagt altijd een inlog.');
  }
} else {
  // Achter Ingress vraagt de dienst Home Assistant wie er beheerder is (besluit 161).
  access = startup.access.kind === 'ingress' ? { kind: 'ingress', beheerders: haBeheerders(() => client.query<HaAccount[]>('config/auth/list')) } : { kind: 'open' };
  if (startup.access.kind === 'open') {
    console.warn('LET OP: HEMS_OPEN=1. Iedereen die deze weergave kan openen, kan bedienen.');
  }
}

/*
 * De eigen poort van de add-on (besluit 160): de app los op de telefoon, via
 * Tailscale, met een eigen inlog via Home Assistant zoals op de NAS. De
 * browser gaat naar het adres dat de bewoner opgaf, de dienst zelf naar Home
 * Assistant in het netwerk van de add-ons.
 */
const eigenPoort: { port: number; access: Access } | null = startup.eigenPoort
  ? {
      port: startup.eigenPoort.port,
      access: {
        kind: 'sessions',
        store: new SessionStore({ logDir: logDir === '' ? null : logDir }),
        login: homeAssistantLogin(startup.eigenPoort.haLoginUrl, fetch, startup.eigenPoort.haDienstUrl),
      },
    }
  : null;

/** Wat weer.ts uit main.ts gebruikt: wat vastligt gewoon, wat kan wijzigen als getter. */
const maakWeerNodig = {
  allStates, baseConfig, client, functiesKeuzes, functiesNu, klopt,
  get houseRegisters() {
    return houseRegisters;
  },
  get location() {
    return location;
  },
  get site() {
    return site;
  },
  get web() {
    return web;
  },
};
export type MaakWeerNodig = typeof maakWeerNodig;
const { forecastNow, openMeteo, weatherLog, weerNaam, weerZone } = maakWeer(maakWeerNodig);

/**
 * Wiens comfort (besluit 147): dat van de gevraagde bewoner, anders van wie er
 * kijkt, anders van de hoofdgebruiker. Wie volgt, ziet dat van de
 * hoofdgebruiker; aanpassen maakt het een eigen comfort.
 */
function comfortVoor(wie: Wie, gevraagd: string | null): { id: string | null; view: ComfortView } {
  return comfortVanBewoner(webConfig()!, comfortStore?.current ?? null, bewonersStore?.current ?? GEEN_BEWONERS, wie, gevraagd);
}

/** Wat assistent.ts uit main.ts gebruikt: wat vastligt gewoon, wat kan wijzigen als getter. */
const maakAssistentNodig = {
  allStates, baseConfig, client, eigenPoort, functiesKeuzes, solarPace, version, vindBuffers,
  get houseRegisters() {
    return houseRegisters;
  },
  get location() {
    return location;
  },
  get siteConfig() {
    return siteConfig;
  },
  get spraakLijst() {
    return spraakLijst;
  },
};
export type MaakAssistentNodig = typeof maakAssistentNodig;
const { addOnStand, assistentAan, integratie, integratieStand, klaarPunten, sleutel, supervisorToken } = await maakAssistent(maakAssistentNodig);
/*
 * Wat de wand het laatst over Fully Kiosk meldde (besluit 246). Bewaard naast
 * het logboek: na een herstart of update zei Klaarzetten anders dat de wand
 * nog niet was ingesteld, tot hij zich weer meldde (2 november 2026).
 */
const WAND_BESTAND = logDir !== '' ? join(logDir, 'wand-melding.json') : null;
let wandMelding: WandMelding | null = WAND_BESTAND
  ? await readFile(WAND_BESTAND, 'utf-8').then(
      (x) => {
        const w = JSON.parse(x) as Partial<WandMelding>;
        return typeof w.fully === 'boolean' && typeof w.js === 'boolean' && typeof w.ms === 'number' ? { fully: w.fully, js: w.js, camera: typeof w.camera === 'boolean' ? w.camera : null, ms: w.ms } : null;
      },
      () => null,
    )
  : null;

/*
 * Helemaal in huis (besluit 203): Whisper, Piper en openWakeWord bevestigen en
 * er een spraakassistent van maken. Alleen in de add-on, via de Supervisor, na
 * een tik van de beheerder; lezen gaat wel via HaClient.
 */
const stemInHuis = version.installatie === 'add-on' && supervisorToken && functiesStore
  ? new InHuis({
      entiteiten: () => [...allStates.values()].filter((s) => /^(stt|tts|wake_word)\./.test(s.entity_id)).map((s) => ({ id: s.entity_id, naam: String(s.attributes['friendly_name'] ?? '') })),
      stromen: () => client.query<Stroom[]>('config_entries/flow/progress'),
      bevestig: (flowId) => bevestigViaRest('http://supervisor/core/api', supervisorToken, flowId),
      assistenten: async () => {
        await spraakBij();
        return spraakLijst.map((s) => ({ id: s.id, naam: s.naam, wekwoord: s.wekwoord }));
      },
      wekwoorden: async (entiteit) => ((await client.query<{ wake_words?: { id: string }[] }>('wake_word/info', { entity_id: entiteit })).wake_words ?? []).map((w) => w.id),
      stemVoor: async (entiteit, lang) => {
        const r = await client.query<{ providers?: { engine_id: string; supported_languages?: string[] }[] }>('tts/engine/list');
        const taal = kiesTaal(r.providers?.find((p) => p.engine_id === entiteit)?.supported_languages ?? [], lang);
        const stemmen = taal ? ((await client.query<{ voices?: { voice_id: string }[] | null }>('tts/engine/voices', { engine_id: entiteit, language: taal })).voices ?? []) : [];
        return { taal, voice: stemmen[0]?.voice_id ?? null };
      },
      maak: async (a) => {
        const id = await maakViaWebsocket('ws://supervisor/core/websocket', supervisorToken, a);
        await spraakBij();
        return id;
      },
      kies: async (id) => {
        const g = functiesKeuzes();
        const huidig = functiesStore.current ?? (g ? functiesVoorstel(g) : null);
        if (!huidig) throw new Error('de functies zijn nog niet gelezen');
        const nu = volledig(huidig, g);
        await functiesStore.save({ ...nu, praten: { ...nu.praten, spraak: id, stem: 'huis' } });
      },
      wacht: (ms) => new Promise((klaar) => setTimeout(klaar, ms)),
    })
  : null;

// "Toch die van" voorbij (besluit 147): opruimen, zodat hij later niet vanzelf terugkomt.
if (bewonersStore) {
  setInterval(() => {
    const snap = runner?.latest;
    if (!vasthoudenVoorbij(bewonersStore.current, snap ? { atMs: snap.atMs, reden: snap.explanation.profile?.reason ?? null } : null)) return;
    void bewonersStore.save(zonderVasthoudenVan(bewonersStore.current)).then(() => herlaadUitDeApp('toch die van is voorbij'));
  }, 60_000).unref();
}

/** Wat gegevens.ts uit main.ts gebruikt: wat vastligt gewoon, wat kan wijzigen als getter. */
const maakGegevensNodig = {
  allStates, analyse, bewonersStore, client, functiesNu, onboarding, runner, strategies, version,
  get houseRegisters() {
    return houseRegisters;
  },
  get site() {
    return site;
  },
  get voorbeeld() {
    return voorbeeld;
  },
  get web() {
    return web;
  },
};
export type MaakGegevensNodig = typeof maakGegevensNodig;
const { gegevens, herstart, zoekUpdates } = maakGegevens(maakGegevensNodig);

/*
 * Het voorbeeldhuis (besluit 237): een eigen proces, pas als iemand het opent.
 * Niet in dat proces zelf, en alleen met een gebouwde voorbeeldstart ernaast.
 */
const voorbeeldScript = join(dirname(fileURLToPath(import.meta.url)), 'voorbeeld', 'start.js');
const voorbeeld = !voorbeeldProces && webPort != null && existsSync(voorbeeldScript) ? new Voorbeeld({ script: voorbeeldScript, webDir, write: (r) => console.warn(r) }) : null;

/**
 * Wat de opties van de webserver gebruiken (start/web-opties.ts). Wat vastligt staat er gewoon in; wat in main.ts nog
 * kan wijzigen, als getter, zodat de webserver altijd de stand van nu ziet.
 */
const mainStand = {
  WAND_BESTAND, accuNuW, addOnStand, allStates, analyse, assistentAan, baseConfig, bewonersStore, bufferStore,
  camerasAlle, camerasLijst, client, comfortStore, comfortVoor, configWithComfort, connectionStore, coverSwitch,
  dakenOpbrengst, deurbelNu, eigenPoort, energyStore, fasenNuView, forecastNow, functiesKeuzes, functiesNu,
  functiesStore, gegevens, handKnoppen, handSchakelaars, handbediening, helpenDag, herlaadUitDeApp, herstart,
  historieVan, houseReport, houseStates, huisNu, integratie, integratieStand, kinderslotten, klaarPunten, klimaatAan,
  klimaatBrug, laadReg, laadadviezen, laadbeurten, laadhand, layoutStore, lightSwitch, losKlimaat, meldingen,
  modelTeller, onboarding, openMeteo, pauzeVan, proefmelding, reserveBeelden, runner, scenePictures, schakelaarKeuzes,
  schakelaarStore, sleutel, sluipverbruik, stekkerZon, stekkerhand, stemInHuis, teDoen, telefoons, uitstelStore,
  updateNu, version, verstaan, vindSchakelaarsNu, voorbeeld, voorkeuren, weatherLog, webConfig, weerNaam, weerZone,
  wekwoordNu, zoekUpdates,
  get access() {
    return access;
  },
  get connectionDoor() {
    return connectionDoor;
  },
  get eigenSlug() {
    return eigenSlug;
  },
  get houseRegisters() {
    return houseRegisters;
  },
  get location() {
    return location;
  },
  get site() {
    return site;
  },
  get siteConfig() {
    return siteConfig;
  },
  set siteConfig(waarde: typeof siteConfig) {
    siteConfig = waarde;
  },
  get spraakLijst() {
    return spraakLijst;
  },
  get wandMelding() {
    return wandMelding;
  },
  set wandMelding(waarde: typeof wandMelding) {
    wandMelding = waarde;
  },
  get witgoed() {
    return witgoed;
  },
};
export type MainStand = typeof mainStand;

if (webPort != null) {
  web = new WebServer(webOpties(mainStand, webPort));
}

function connectionDoor(store: ConnectionStore, base: NonNullable<typeof baseConfig>) {
  // De stroommeters en apparaten zoekt de dienst zelf; de pagina noemt nooit een entiteit.
  const found = () => ({
    fasen: findPhases(allStates.values()),
    apparaten: houseRegisters ? findAppliances(allStates, houseRegisters.entities, houseRegisters.devices) : [],
    // De boiler en de jacuzzi (besluit 186), en de slimme stekkers (besluit 264).
    buffers: vindBuffers(),
    // Hoe de panelen liggen (besluit 157): om "klopt" te kunnen bewaren.
    meting: metingNu(),
    omvormerGevonden: omvormerGevonden(),
    // De netmeter en de omvormers om uit te kiezen (testerronde, november 2026).
    vermogens: findPowers(allStates.values()),
    // Per fase een meter om uit te kiezen (23 november 2026).
    faseMeters: findPhaseMeters(allStates.values()),
  });
  const solarId = base.solarProduction?.id ?? null;
  return {
    store,
    found,
    naBewaren: opZonMeteen,
    view: (lang?: Lang) =>
      connectionView({
        base,
        found: found(),
        applied: connectionApplied,
        answersAtStart: answersInGebruik,
        answers: store.current,
        meting: metingNu(),
        omvormerGevonden: omvormerGevonden(),
        // De omtrek uit de kaart kan zodra Home Assistant de plek gaf (besluit 254).
        kaart: location != null,
        // Plat dak bij Inrichten (issue 143): het voorstel voor het hoofdhuis zonder vlakken.
        huisPlat: layoutNu?.()?.dak === 'geen',
        // Wat kan bij jouw huis (6 november 2026): 3D BAG alleen in Nederland, in huis nagegaan.
        nederland: location ? inNederland(location.latDeg, location.lonDeg) : false,
        // De meting per dakvlak en de grens per omvormer (stap 4); de zon van nu voor elk vlak nu (stap 5).
        vlakMeting: vlakMetingNu(),
        zonNu: location ? sunPosition(Date.now(), location.latDeg, location.lonDeg) : null,
        grenzen: grenzenGevonden(),
        // Auto en laadpaal (besluit 259): wat Home Assistant heeft, met de keuzes van nu.
        laden: houseRegisters ? ladenView(laadReg(houseRegisters), allStates, store.current?.laden ?? null, store.current?.accu ?? null) : null,
        // Energie › Thuisaccu (besluit 271): de accu's, met de sensoren om uit te kiezen.
        accu: houseRegisters ? accuView(laadReg(houseRegisters), allStates, store.current?.accu ?? null, store.current?.laden ?? null) : null,
        inGebruik: {
          netmeter: siteConfig?.power.gridPower ? { afname: siteConfig.power.gridPower.id, terug: siteConfig.power.gridExport?.id ?? null } : null,
          omvormers: siteConfig?.solarProduction ? [siteConfig.solarProduction.id, ...(siteConfig.solarExtra ?? []).map((p) => p.id)] : [],
        },
        solar: solarId
          ? {
              naam: String(allStates.get(solarId)?.attributes['friendly_name'] ?? 'je zonnesensor'),
              intervalS: solarPace.intervalS,
              platform: houseRegisters?.entities.find((e) => e.entity_id === solarId)?.platform ?? null,
            }
          : null,
      }, lang),
  };
}

console.log('─'.repeat(64));
console.log('  SCHADUWMODUS — de arbiter denkt mee, maar schakelt niets');
console.log('─'.repeat(64));
console.log(
  `  Home Assistant   ${url}${asAddon ? '  (via de Supervisor, geen eigen token)' : ''}`,
);
console.log(`  configuratie     ${site?.source ?? 'nog geen — wachtend op de onboarding'}`);
if (site) {
  console.log(
    `  installatie      ${site.config.id} — ${site.config.zones.length} zones, ${site.config.actuators.length} apparaten`,
  );
}
console.log(`  instellingen     ${loadedFrom ?? 'uit de omgeving'}`);
console.log(`  hartslag         ${tickSeconds} s`);
console.log(`  min. interval    ${startup.minIntervalSeconds} s tussen twee evaluaties`);
console.log(
  `  bewaking         ${startup.watchdogMinutes > 0 ? `afsluiten na ${startup.watchdogMinutes} min zonder besluit` : 'uit'}`,
);
console.log(`  logboek          ${logDir}/decisions-JJJJ-MM-DD.ndjson`);
console.log(`  schrijfrechten   ${client.writesAllowed ? 'AAN' : client.lightsAllowed ? 'alleen licht aan/uit (besluit 97)' : 'uit'}`);
console.log(
  `  webweergave      ${
    webPort == null
      ? 'uit — deze dienst luistert nergens op'
      : `poort ${webPort}, ${onboarding ? 'lezen plus de onboarding' : 'alleen lezen'}`
  }`,
);
console.log('─'.repeat(64));

if (site && site.warnings.length > 0) {
  console.log('  Let op in de configuratie:');
  for (const warning of site.warnings) console.log(warning);
  console.log('─'.repeat(64));
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log('\nafsluiten…');
    runner?.stop();
    analyse?.stop();
    voorbeeld?.stop();
    void web?.stop().finally(() => process.exit(0));
    if (web == null) process.exit(0);
  });
}

if (web) {
  try {
    const port = await web.start();
    console.log(`  weergave luistert op http://localhost:${port}/`);
    console.log(`  frontend uit     ${webDir}`);
    if (web.eigenPoort != null) console.log(`  eigen poort      ${web.eigenPoort}, alleen via Tailscale (https://….ts.net)`);
    if (analyse) {
      // Meteen beginnen, zodat de tijdlijn er staat voordat iemand kijkt.
      analyse.start();
      console.log(`  logboekanalyse   elk kwartier over ${logDir}`);
    }
    console.log('─'.repeat(64));
  } catch (error) {
    // Een bezette poort is een opstartfout, geen reden om zonder venster door
    // te draaien: dan denk je dat het dashboard kapot is terwijl de dienst
    // gewoon nooit is gaan luisteren (besluit 7).
    console.error(`Kan niet luisteren op poort ${webPort}: ${String(error)}`);
    process.exit(1);
  }
}

if (runner) {
  /*
   * Welke versie en welke configuratie vanaf nu beslissen (besluit 66). Vóór
   * het eerste besluit, zodat elk besluit onder een regel in dit bestand valt.
   * Lukt het niet, dan beslist de dienst toch: zonder herkomst is de dataset
   * minder waard, zonder dienst is hij er helemaal niet.
   */
  if (logDir !== '' && site) {
    try {
      await recordRun(logDir, {
        t: Date.now(),
        commit: version.commit,
        built: version.gebouwd,
        config: configFingerprint(site.config),
        site: site.config.id,
      });
    } catch (error) {
      console.error(`Kon de start niet vastleggen in runs.ndjson: ${String(error)}`);
    }
  }
  runner.start();
  // Helpen bij de cv (besluit 292): ook zonder iets uit de app, en met de prijzen die er bij het starten nog niet waren.
  void herlaadUitDeApp('helpen bij de cv');
} else {
  // Geen configuratie, dus niets om te beslissen. Wel verbinden: de onboarding
  // heeft de registers nodig, en die komen over deze socket.
  client.connect();
}
