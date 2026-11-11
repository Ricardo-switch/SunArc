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

import { Integratie } from './web/integratie.js';
import { AssistentAan, oudeWegViaRest, voegToeViaFlow } from './web/assistent-aan.js';
import { PushStore, alsMelding, ontvangersVan, paneelVan, proefTekst, teSturen, telefoonVan, vindTelefoons, type Telefoon } from './web/push.js';
import { hostname } from 'node:os';
import { loadDotEnv, tokenComplaint } from './env.js';
import { inHouse, snelInHuis } from './web/inhuis.js';
import { klaarzetten, type KlaarPunt } from './web/klaarzetten.js';
import { klaarFuncties, wolkenVan, type WandMelding } from './web/klaarzetten-functies.js';
import { Stem, kiesTaal } from './web/stem.js';
import { InHuis, addOnInfo, bevestigViaRest, maakViaWebsocket, type AddOnInfo, type Stroom } from './web/stem-in-huis.js';
import { rollenUitConfig } from './web/regeling.js';
import { MeldingenStore } from './web/meldingen.js';
import { meldingenBron } from './web/meldingen-bron.js';
import { VERSIE } from './version.js';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';


import { ConfigError, loadSiteConfig } from './config/load.js';
import { parseSiteConfig } from './config/schema.js';
import type { SiteConfig } from './core/model.js';
import { HaClient, type HaEntityState } from './adapters/homeassistant/client.js';
import {
  fetchRegistries,
  type HaArea,
  type HaCoreConfig,
  type HaDevice,
  type HaFloor,
  type HaRegistryEntity,
} from './adapters/homeassistant/discovery.js';
import { buildHouse, houseBeforeSetup, knownForLayout, proposeLayout, type HouseRegisters } from './web/house.js';
import { LayoutStore, herstelMeedoen, withLayoutNames, type Layout } from './web/layout.js';
import { noteSensors, readLayoutFile, withMeasurement } from './web/meten.js';
import { configUitDeApp } from './web/config-uit-app.js';
import { bijspringenView, ComfortStore, controleerBijspringen, controleerComfort, type Comfort, type ComfortRoom, type ComfortView } from './web/comfort.js';
import { controleerHelpen, HelpenDag, helpenView } from './web/helpen.js';
import { BewonersStore, GEEN_BEWONERS, bewonersView, comfortVanBewoner, gastStand, persoonsAccount, herken as herkenBewoner, hoofdVan, leesActie, namenVoorExport, personenUit, profielenVan, vasthoudenVoorbij, voerUit, zonderVasthoudenVan, type Bewoners, type Wie } from './web/bewoners.js';
import { BACKUP_DIR, OPNIEUW_STARTEN, beginOpnieuw, bewaarBackup, bewaardeBackups, leesBackup, maakBackup, zetTerug } from './web/gegevens.js';
import { entiteitenLijst, type AnalyseExtra } from './web/export.js';
import { UitstelStore } from './web/uitstel.js';
import { BufferStore, cheapWindows } from './web/warmtebuffers.js';
import { VoorkeurenStore } from './web/voorkeuren.js';
import { SceneColorStore, colorsFromLamps } from './web/scene-colors.js';
import { ScenePictures } from './web/scene-pictures.js';
import { EnergyStore } from './web/energy.js';
import { partsIn, startOfLocalDay, zonedMidnight, type PowerRow } from './web/today.js';
import { faseHistorie, fasenView, type FasePunt, type FasenView } from './web/fasen.js';
import { WeatherLog, dagenUitUren, type EntityForecast } from './web/weather.js';
import { Historie, somPerVak } from './web/historie.js';
import { zetValuta } from './web/valuta.js';
import { apparaatGegevens } from './web/apparaat-gegevens.js';
import { Sluipverbruik, jaarPrijs, sluipVoorBel } from './web/sluipverbruik.js';
import { verwachtingVan, weerNaamVan } from './web/weerbron.js';
import { OPEN_METEO, OpenMeteo } from './web/open-meteo.js';
import { httpBase } from './web/camera.js';
import { Pauze, WACHT_MS } from './web/taalmodel.js';
import { Teller } from './web/brein.js';
import { Herinneringen, type Herinnering } from './web/tedoen.js';
import { volgendeMoment } from './web/gepland.js';
import type { TeDoenDienst } from './web/routes/tedoen.js';
import { spraakKeuzes, type SpraakKeuze } from './web/functies.js';
import { cameraMelders, camerasNu, laatsteAanUitHistorie } from './web/cameras.js';
import { FunctiesStore, aangebeld, functiesGevonden, functiesVoorstel, getoondeCameras, volledig, type Functies, type FunctiesGevonden } from './web/functies.js';
import { accusNu, accuView, KABEL_STANDAARD, laadBedieningen, laadMeters, ladenView, metLosseLaadpalen, vindOpslag } from './web/opslag.js';
import { Laadhand, laadMag } from './web/laadhand.js';
import { Stekkerhand, stekkerMag, type StekkerBekend, type StekkerTot } from './web/stekkerhand.js';
import { StekkerZon } from './web/stekkerzon.js';
import { Laadbeurten } from './web/laadbeurten.js';
import { laadAdvies, prijzenVooruit, type LaadAdvies } from './web/laadadvies.js';
import { ConnectionStore, SensorPace, connectionView, findAppliances, findPhases, findPowers, metOpZonVanNu, withConnection, type Applied, type ConnectionAnswers } from './web/aansluiting.js';
import { clearSkyOnPlaneWm2, sunPosition } from './core/sun.js';
import { laadDag, zonVerwachtW } from './web/laaddag.js';
import { clearSkyW } from './web/sun.js';
import { hoofddakPlat, panelenVan, type DakVlak } from './web/daken.js';
import { inNederland } from './web/bag3d.js';
import { aanvullenUitMeter, achterblijven, meetVlakken, metMeting, opbrengstPerVlak, verdeelDag, type Achter, type MeterGroep, type VlakStand, type Verdeling } from './web/meten-vlakken.js';
import { findHeatStores, findPlugs, type FoundHeatStore } from './web/buffers-vinden.js';
import { GEEN_KEUZES, SchakelaarStore, kinderslotVan, lampSchakelaars, leesLosseLaadpaal, leesSchakelaarKeuze, losseSensoren, metKeuze, metLaadpaal, schakelaarViews, schakelaarsMag, schakelaarsOpZon, vindSchakelaars, type GevondenSchakelaar, type SchakelaarKeuzes } from './web/schakelaars.js';
import { kiesLigging, meetLigging, omvormerUitType, type Meting, type PanelenAntwoord } from './web/ligging.js';
import { alarmSensoren, vindRookmelders } from './web/rookmelders.js';
import { eigenUpdate, updateView, type UpdateView } from './web/bijwerken.js';
import { haEnergySource } from './adapters/homeassistant/energy.js';
import type { DeferrableStateCode } from './core/decision.js';
import { CoverSwitch } from './web/covers.js';
import type { Lang } from './web/assistant.js';
import { LightSwitch } from './web/lights.js';
import { SessionStore, haBeheerders, homeAssistantLogin, leesOfMaakSleutel, type Access, type HaAccount } from './web/auth.js';
import { ShadowRunner, type LiveSnapshot } from './adapters/homeassistant/shadow.js';
import { defaultStrategies } from './index.js';
import { WebServer, defaultWebDir, versionFromEnv, type AlarmMelder } from './web/server.js';
import { readStartup } from './startup.js';
import { DivergenceCache } from './web/divergence.js';
import { configFingerprint, recordRun } from './adapters/runs.js';
import { Onboarding } from './web/onboarding.js';
import { FeedbackLog } from './web/feedback.js';
import { laadWekmodellen, type Wekmodellen } from './web/wekwoord.js';
import { BRUG_ENTITEITEN, KlimaatBrug, MODUS_OPTIES } from './web/klimaatbrug.js';
import { HAND_KLIMAAT, HAND_KNOPPEN, Handbediening } from './web/hand.js';
import { Voorbeeld } from './web/voorbeeld.js';
import { Witgoed } from './web/witgoed.js';
import { voerStapUit, type GeplandeDeuren } from './web/gepland-uit.js';
import { kiesVerstaan, Verstaan } from './web/verstaan.js';
import { installeerLogboek } from './web/logboek.js';

// De laatste waarschuwingen en fouten, om te delen bij een melding (4 november 2026).
installeerLogboek();


const packageRoot = resolve(dirname(new URL(import.meta.url).pathname), '..');
const candidates = [resolve(process.cwd(), '.env'), join(packageRoot, '.env')];
const loadedFrom = candidates.find((file) => loadDotEnv(file));

function fail(problems: readonly string[]): never {
  console.error('Kan de schaduwmodus niet starten.');
  console.error('');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('');
  console.error(
    loadedFrom
      ? `Gelezen uit: ${loadedFrom}`
      : `Geen .env gevonden. Gezocht in:\n  ${candidates.join('\n  ')}`,
  );
  console.error('');
  console.error('Verwacht:');
  console.error('  HA_URL    basis-URL van Home Assistant, zonder pad');
  console.error('            bijvoorbeeld http://homeassistant.local:8123');
  console.error('  HA_TOKEN  long-lived access token');
  console.error('            HA → klik je naam linksonder → tabblad Beveiliging');
  console.error('            → onderaan "Langlopende toegangstokens" → Aanmaken');
  console.error('');
  console.error('Optioneel:');
  console.error('  SHADOW_TICK_SECONDS   hartslag in seconden (standaard 30)');
  console.error('  SHADOW_MIN_INTERVAL_SECONDS');
  console.error('                        ondergrens tussen evaluaties (standaard 15)');
  console.error('  SHADOW_WATCHDOG_MINUTES');
  console.error('                        afsluiten na zoveel minuten zonder besluit,');
  console.error('                        zodat de omgeving kan herstarten (standaard 10)');
  console.error('  HEMS_CONFIG           pad naar het configuratiebestand');
  console.error('  HEMS_SITE             naam in config/sites (zonder .json)');
  console.error('  SHADOW_LOG_DIR        map voor het beslislogboek');
  console.error('                        (standaard data/shadow)');
  console.error('  HEMS_WEB_PORT         poort voor de read-only webweergave;');
  console.error('                        weglaten betekent: geen weergave, en dan');
  console.error('                        luistert deze dienst nergens op');
  console.error('  HEMS_WEB_HOST         adres om aan te binden (standaard 0.0.0.0)');
  console.error('  HEMS_WEB_DIR          map met de gebouwde frontend');
  console.error('');
  console.error('Alleen de configuratie nakijken, zonder Home Assistant:');
  console.error('  node dist/main.js --check-config');
  console.error('');
  console.error('Kijken wat er in huis staat en een configuratie voorstellen:');
  console.error('  node dist/main.js --discover [pad naar het nieuwe bestand]');
  console.error('');
  console.error('Meten of deze machine de analyse aankan:');
  console.error('  node dist/main.js --make-winter 180 <bronmap> <doelmap>');
  console.error('  node dist/main.js --benchmark <doelmap>');
  process.exit(1);
}

/*
 * Alleen de configuratie nakijken en stoppen.
 *
 * Bestaat zodat de uitrol de drááiende configuratie kan toetsen tegen het
 * nínuwe image, vóórdat de container wordt omgewisseld. Die configuratie hoort
 * bij de installatie en wordt niet met git meegestuurd (besluit 21), dus een
 * schemawijziging kan hem ongeldig maken zonder dat iemand het merkt.
 *
 * Dat is precies wat er op 10 september 2026 gebeurde: `mode`, `timers` en `sun`
 * werden verplicht, de NAS had de oude configuratie, en de container kwam in een
 * herstartlus terecht. Zie besluit 33.
 *
 * Vóór de tokencontrole, want hiervoor is geen Home Assistant nodig.
 */
/*
 * Prestatiemeting, zonder Home Assistant.
 *
 * Draait binnen het uitgerolde image, zodat je op de Pi precies meet wat daar
 * straks draait — en niet wat er op je werkstation onder een andere Node en een
 * andere schijf gebeurt. Zie besluit 34.
 */
/*
 * Een logboek van winterformaat nabouwen uit de dagen die er al zijn.
 *
 * Ook als vlag, en om dezelfde reden als `--benchmark`: op een Pi met HAOS staat
 * geen npm en geen tsx. Wat in het image zit kun je daar draaien.
 */
if (process.argv.includes('--make-winter')) {
  const i = process.argv.indexOf('--make-winter');
  const days = Number(process.argv[i + 1] ?? 180);
  const source = resolve(process.argv[i + 2] ?? process.env['SHADOW_LOG_DIR'] ?? 'data/shadow');
  const target = resolve(process.argv[i + 3] ?? 'data/bench');
  const { makeWinter } = await import('./web/makeWinter.js');
  process.exit(await makeWinter(days, source, target));
}

if (process.argv.includes('--benchmark')) {
  const i = process.argv.indexOf('--benchmark');
  const dir = process.argv[i + 1] ?? process.env['SHADOW_LOG_DIR'] ?? 'data/shadow';
  const { benchmark } = await import('./web/benchmark.js');
  process.exit(await benchmark(resolve(dir)));
}

if (process.argv.includes('--check-config')) {
  try {
    const site = await loadSiteConfig({
      explicitPath: process.env['HEMS_CONFIG'],
      siteId: process.env['HEMS_SITE'],
      knownStrategies: defaultStrategies().ids,
    });
    console.log(`Configuratie in orde: ${site.source}`);
    for (const warning of site.warnings) console.log(warning);
    process.exit(0);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.format());
      process.exit(1);
    }
    throw error;
  }
}

/*
 * Alles wat de omgeving zegt over hoe deze dienst draait, op één plek en getest
 * (besluit 55): add-on of niet, de verbinding, de weergave, de schrijfdeur en
 * de tijden. Hier wordt alleen nog uitgevoerd.
 */
const startup = readStartup(process.env);
const { asAddon } = startup;
const { url, token } = startup.ha;
if (startup.haProblems.length > 0) fail(startup.haProblems);
if (startup.errors.length > 0) {
  console.error('Kan de schaduwmodus niet starten:');
  console.error('');
  for (const error of startup.errors) console.error(`  ${error}`);
  process.exit(1);
}


const complaint = asAddon ? null : tokenComplaint(token!);
if (complaint) {
  console.error('Het token in HA_TOKEN klopt niet:');
  console.error(`  ${complaint}.`);
  console.error('');
  console.error('Maak een nieuw token aan en plak het in één keer:');
  console.error('  Home Assistant → je naam linksonder → tabblad Beveiliging');
  console.error('  → onderaan "Langlopende toegangstokens" → Token aanmaken');
  console.error('');
  console.error('Let op bij het plakken:');
  console.error('  - alles op één regel, geen regeleinde erin');
  console.error('  - geen aanhalingstekens en geen spaties eromheen');
  console.error('  - het token is ongeveer 180 tekens en begint met "eyJ"');
  console.error('');
  console.error('Doorgaan heeft geen zin; Home Assistant zou dit weigeren.');
  process.exit(1);
}

/*
 * Ontdekken gaat vóór het inlezen van de configuratie.
 *
 * Dat is de hele reden dat deze vlag bestaat: wie hem gebruikt heeft nog geen
 * configuratie. Zou hij ná `loadSiteConfig` staan, dan zou de opdracht die je
 * helpt aan een configuratie te komen alleen werken als je er al een had.
 */
if (process.argv.includes('--discover')) {
  const i = process.argv.indexOf('--discover');
  const arg = process.argv[i + 1];
  const target = arg != null && !arg.startsWith('--') ? resolve(arg) : null;
  const { discoverCli } = await import('./adapters/homeassistant/discoverCli.js');
  process.exit(await discoverCli({ url: url!, token: token!, target }));
}

const { tickSeconds, logDir } = startup;

/*
 * De webweergave staat standaard uit.
 *
 * Deze dienst houdt het HA-token vast en draait maanden onbewaakt. Luisteren
 * is dus een keuze die je maakt, niet iets wat je overkomt door hem te
 * starten. De compose op de NAS zet de poort; een losse `npm run shadow`
 * blijft dicht.
 */
const webPort = startup.web.port;
const webDir = startup.web.dir ?? defaultWebDir(packageRoot);

/*
 * Het voorbeeldhuis (besluit 237) draait deze dienst in een eigen proces, op een
 * nagemaakt Home Assistant. De deuren die alleen in de add-on open staan
 * (meldingen, lijsten, de klimaatbrug, met de hand) staan daar ook open: ze gaan
 * naar het nagemaakte huis.
 */
const voorbeeldProces = process.env['HEMS_VOORBEELD'] === '1';
const inHuisMetDeuren = Boolean(process.env['SUPERVISOR_TOKEN']) || voorbeeldProces;

const strategies = defaultStrategies();

// De configuratie wordt hier gelezen én gecontroleerd. Een fout erin is een
// opstartfout met een aanwijzing, niet een storing die zich pas 's nachts laat
// zien wanneer de regeling iets onmogelijks probeert.
let site: Awaited<ReturnType<typeof loadSiteConfig>> | undefined;
try {
  site = await loadSiteConfig({
    explicitPath: startup.configPath ?? undefined,
    siteId: startup.siteId ?? undefined,
    knownStrategies: strategies.ids,
  });
} catch (error) {
  /*
   * Ontbreken is iets anders dan kapot zijn.
   *
   * Een configuratie die er staat maar niet deugt blijft een opstartfout: die
   * moet je repareren, en stilzwijgend doorstarten zou de fout verbergen tot
   * hij 's nachts opduikt (besluit 33). Maar er helemaal géén hebben is de
   * normale toestand van een verse installatie, en daar hoort de onboarding
   * bij en geen foutmelding.
   *
   * Alleen achter Ingress: daar heeft Home Assistant vastgesteld wie er kijkt.
   * Zonder die zekerheid is een pagina die configuratie wegschrijft iets wat
   * je niet aan je netwerk hangt (besluit 42).
   */
  if (error instanceof ConfigError && error.kind === 'ontbreekt' && startup.onboarding.enabled) {
    console.log('─'.repeat(64));
    console.log('  NOG GEEN INSTALLATIE INGESTELD');
    console.log('─'.repeat(64));
    console.log('  Er is geen configuratie gevonden, dus er wordt nog niets geregeld.');
    console.log('  Open het paneel SunArc in Home Assistant; daar staat wat');
    console.log('  er in huis is gevonden en kun je het bevestigen.');
    console.log('─'.repeat(64));
  } else if (error instanceof ConfigError) {
    console.error(error.format());
    process.exit(1);
  } else {
    throw error;
  }
}

/*
 * De zon en je aansluiting (besluit 103): de antwoorden uit de app vullen de
 * configuratie aan waar die zwijgt, zoals de zekering en apparaten op zon. Bij
 * het starten, en alleen als het resultaat door het eigen schema komt; anders
 * draait de dienst zoals het bestand zegt. Wat het bestand noemt, gaat voor.
 */
const connectionStore = logDir !== '' ? new ConnectionStore(logDir) : null;
const answersAtStart = (await connectionStore?.load()) ?? null;
/** De antwoorden waarmee de regeling nu rekent: bij het starten, en op zon van nu (besluit 290). */
let answersInGebruik = answersAtStart;
const baseConfig = site?.config ?? null;
let connectionApplied: Pick<Applied, 'toegevoegd' | 'overgeslagen'> = { toegevoegd: [], overgeslagen: [] };
if (site && answersAtStart) {
  try {
    const applied = withConnection(JSON.parse(await readFile(site.source, 'utf-8')) as Record<string, unknown>, answersAtStart);
    const checked = applied.toegevoegd.length > 0 ? parseSiteConfig(applied.raw, { knownStrategies: strategies.ids }) : null;
    if (checked == null) connectionApplied = applied;
    else if (checked.ok) {
      site = { ...site, config: checked.config };
      connectionApplied = applied;
    } else {
      const first = checked.problems[0];
      connectionApplied = {
        toegevoegd: [],
        overgeslagen: [...applied.overgeslagen, `de antwoorden passen niet in de configuratie (${first ? `${first.path}: ${first.message}` : 'onbekend'})`],
      };
    }
  } catch {
    // Het bestand was net te lezen; lukt het nu niet, dan zoals het was.
  }
  for (const t of connectionApplied.toegevoegd) console.log(`Uit de app (aansluiting.json): ${t}`);
  for (const t of connectionApplied.overgeslagen) console.warn(`Uit de app niet overgenomen: ${t}`);
}

/*
 * Meten met (besluit 123): de sensoren die de bewoner per kamer koos, na de
 * aansluiting. Ook hier: alleen als het resultaat door het schema komt. Daarna
 * in het logboek welke sensoren per zone meetellen, als dat anders is dan de
 * vorige start.
 */
// De indeling zoals hij bij het starten was: comfort (besluit 130) bouwt erop voort.
let layoutAtStart: Awaited<ReturnType<typeof readLayoutFile>> = null;
if (site && logDir !== '') {
  try {
    layoutAtStart = await readLayoutFile(logDir);
    const base = JSON.parse(await readFile(site.source, 'utf-8')) as Record<string, unknown>;
    const metAansluiting = answersAtStart && connectionApplied.toegevoegd.length ? withConnection(base, answersAtStart).raw : base;
    const metMeten = withMeasurement(metAansluiting, layoutAtStart);
    if (metMeten.toegevoegd.length) {
      const checked = parseSiteConfig(metMeten.raw, { knownStrategies: strategies.ids });
      if (checked.ok) {
        site = { ...site, config: checked.config };
        for (const t of metMeten.toegevoegd) console.log(`Uit de app (indeling.json): ${t}`);
      } else {
        console.warn(`Meten met uit de app niet overgenomen: ${checked.problems[0]?.path ?? ''} ${checked.problems[0]?.message ?? ''}`);
      }
    }
  } catch {
    // Niet te lezen: dan meet elke zone zoals de configuratie zegt.
  }
  if (site) await noteSensors(logDir, site.config, Date.now()).catch(() => false);
}

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
/** De ruwe configuratie met alles wat de app erover legt, en comfort zoals gegeven. */
async function configWithComfort(comfort: Comfort | null, bewoners: Bewoners = bewonersStore?.current ?? GEEN_BEWONERS): Promise<{ ok: true; config: SiteConfig; toegevoegd: string[] } | { ok: false; reden: string }> {
  if (!site) return { ok: false, reden: 'er is geen configuratie' };
  const base = JSON.parse(await readFile(site.source, 'utf-8')) as Record<string, unknown>;
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

const client = new HaClient({
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
  // Witgoed starten (ronde 5, besluit 238): alleen de startknop van een droger of vaatwasser, alleen in de add-on.
  allowStart: (): readonly string[] => witgoed?.knoppen() ?? [],
  // Laden met de hand (besluit 262): de laadpalen die de bewoner aanzette, en wat er nog terug moet. Alleen in de add-on.
  allowLaden: () => (laadhand ? laadMag(laadBedieningenNu(), laadhand.terugzetten) : { stroom: [], schakelaars: [], knoppen: [], easee: [], selects: [] }),
  // De slimme stekkers die de bewoner toeliet (besluit 265) gaan door dezelfde deur, los van de klimaatbrug.
  allowHand: (): { readonly klimaat: readonly string[]; readonly schakelaars: readonly string[] } => {
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
    // Schakelaars die de bewoner met de hand toeliet (besluit 297): dezelfde deur, alleen in de add-on.
    const relais = (() => {
      try {
        return inHuisMetDeuren ? schakelaarsMag(vindSchakelaarsNu(), schakelaarKeuzes()) : [];
      } catch {
        return [];
      }
    })();
    // Een kinderslot op een thermostaat of witgoed (besluit 299): dezelfde deur, alleen in de add-on.
    const sloten = (() => {
      try {
        return inHuisMetDeuren ? Object.values(kinderslotten()).map((s) => s.id) : [];
      } catch {
        return [];
      }
    })();
    return { klimaat: klimaat.klimaat, schakelaars: [...new Set([...klimaat.schakelaars, ...stekkers, ...relais, ...sloten])] };
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
 * De klimaatbrug (besluit 210): tot stap B de knoppen van het oude systeem,
 * als de bewoner dat bij Functies aanzet. Alleen in de add-on: de NAS kijkt
 * mee en blijft eraf, anders zou een opdracht twee keer gaan. Elke minuut zet
 * hij terug wat voorbij zijn tijd is, ook als de brug intussen uit ging.
 */
const klimaatBrug: KlimaatBrug | null = inHuisMetDeuren
  ? new KlimaatBrug({
      state: (id) => allStates.get(id),
      zet: (knop, waarde): Promise<void> => client.callService('input_number', 'set_value', { value: waarde }, { entity_id: knop }),
      kies: (select, optie): Promise<void> => client.callService('input_select', 'select_option', { option: optie }, { entity_id: select }),
      map: logDir !== '' ? logDir : null,
    })
  : null;
function klimaatAan(): boolean {
  const f = klimaatBrug ? functiesNu() : null;
  return f != null && volledig(f, functiesKeuzes()).praten.klimaat;
}
/*
 * Klimaat met de hand (besluit 235): elk apparaat via zijn knop, de airco's op
 * warm ook zelf, en een stekker met een warmtebron die niet in de regeling zit.
 * Alleen in de add-on en als de brug aan staat, net als de klimaatbrug.
 */
/*
 * Witgoed starten (ronde 5, besluit 238): de startknop van een droger of
 * vaatwasser, op het moment dat de regeling zegt, of op een tik. Alleen in de
 * add-on (en het voorbeeldhuis), net als met de hand.
 */
let witgoed: Witgoed | null = null;

const handbediening: Handbediening | null = inHuisMetDeuren
  ? new Handbediening({
      state: (id) => allStates.get(id),
      zet: (knop, waarde): Promise<void> => client.callService('input_number', 'set_value', { value: waarde }, { entity_id: knop }),
      kies: (select, optie): Promise<void> => client.callService('input_select', 'select_option', { option: optie }, { entity_id: select }),
      klimaat: async (id, stand): Promise<void> => {
        if (stand === 'uit') return client.callService('climate', 'turn_off', {}, { entity_id: id });
        await client.callService('climate', 'set_hvac_mode', { hvac_mode: 'heat' }, { entity_id: id });
        await client.callService('climate', 'set_temperature', { temperature: stand.warm }, { entity_id: id });
      },
      schakel: (id, aan): Promise<void> => client.callService('switch', aan ? 'turn_on' : 'turn_off', {}, { entity_id: id }),
      temperatuur: (id, c): Promise<void> => client.callService('climate', 'set_temperature', { temperature: c }, { entity_id: id }),
      map: logDir !== '' ? logDir : null,
    })
  : null;
/** Wat er per auto met de hand te bedienen is (besluit 262). */
function laadBedieningenNu() {
  return houseRegisters ? laadBedieningen(laadReg(houseRegisters), allStates, connectionStore?.current?.laden ?? null) : [];
}
/*
 * Laden met de hand (besluit 262, stap 5 van besluit 259): de hoogste
 * laadstroom of pauzeren, met een eind. Alleen in de add-on (en het
 * voorbeeldhuis), zoals klimaat met de hand; de NAS kijkt mee.
 */
const laadhand: Laadhand | null = inHuisMetDeuren
  ? new Laadhand({
      state: (id) => allStates.get(id),
      zetStroom: (id, a): Promise<void> => client.callService('number', 'set_value', { value: a }, { entity_id: id }),
      schakel: (id, aan): Promise<void> => client.callService('switch', aan ? 'turn_on' : 'turn_off', {}, { entity_id: id }),
      druk: (id): Promise<void> => client.callService('button', 'press', {}, { entity_id: id }),
      easee: (apparaat, dienst, data): Promise<void> => client.callService('easee', dienst, { device_id: apparaat, ...data }, {}),
      kies: (id, optie): Promise<void> => client.callService('select', 'select_option', { option: optie }, { entity_id: id }),
      auto: (id) => huisNu('nl')?.opslag?.autos.find((a) => a.id === id) ?? null,
      bediening: (id) => laadBedieningenNu().find((b) => b.auto === id) ?? null,
      zekeringA: (id) => zekeringVoor(id),
      map: logDir !== '' ? logDir : null,
    })
  : null;
/*
 * Een slimme stekker met de hand (besluit 265): aan of uit met een eind,
 * alleen de stekkers die de bewoner toeliet. Schakelen alleen in de add-on;
 * elders kijkt het blad mee.
 */
function stekkersBekend(): StekkerBekend[] {
  // Toegelaten in het blad, of op zon: op zon is zelf de toestemming (besluit 290).
  const mag = new Set((connectionStore?.current?.buffers ?? []).filter((b) => b.bedienen === true || (b.soort === 'stekker' && b.opZon)).map((b) => b.id));
  return vindBuffers()
    .filter((b) => b.soort === 'stekker')
    .map((b) => ({ id: b.id, naam: b.naam, actuator: b.actuator, ...(b.power ? { power: b.power } : {}), mag: mag.has(b.id) }));
}
const stekkerhand = new Stekkerhand({
  state: (id) => allStates.get(id),
  schakel: (id, aan): Promise<void> => client.callService('switch', aan ? 'turn_on' : 'turn_off', {}, { entity_id: id }),
  stekkers: stekkersBekend,
  tijdzone: () => siteConfig?.timezone ?? 'Europe/Amsterdam',
  map: inHuisMetDeuren && logDir !== '' ? logDir : null,
});
/*
 * Een stekker op zon, echt geschakeld (besluit 267): wat de regeling zegt, zet
 * SunArc door, alleen bij een stekker die op zon staat en die de bewoner
 * toeliet, en alleen in de add-on.
 */
const stekkerZon = new StekkerZon({
  state: (id) => allStates.get(id),
  schakel: (id, aan): Promise<void> => client.callService('switch', aan ? 'turn_on' : 'turn_off', {}, { entity_id: id }),
  stekkers: stekkersBekend,
  opZon: () => new Set((siteConfig?.heatStores ?? []).filter((h) => h.kind === 'stekker').map((h) => h.id)),
  metDeHand: () => new Set(stekkerhand.terugzetten.map((t) => t.id)),
  aan: () => inHuisMetDeuren,
  tijdzone: () => siteConfig?.timezone ?? 'Europe/Amsterdam',
  map: inHuisMetDeuren && logDir !== '' ? logDir : null,
  write: (r) => console.log(r),
});
if (inHuisMetDeuren) {
  setInterval(() => {
    stekkerhand.ronde().then(
      (gedaan) => gedaan.forEach((g) => console.log(`[stekker met de hand] ${g}`)),
      (e: unknown) => console.warn(`[stekker met de hand] terugzetten lukte niet: ${(e as Error).message}`),
    );
  }, 60_000).unref();
}
if (laadhand) {
  setInterval(() => {
    laadhand.ronde().then(
      (gedaan) => gedaan.forEach((g) => console.log(`[laden met de hand] ${g}`)),
      (e: unknown) => console.warn(`[laden met de hand] terugzetten lukte niet: ${(e as Error).message}`),
    );
  }, 60_000).unref();
}
/**
 * De boiler en de jacuzzi (besluit 186) en de slimme stekkers (besluit 264),
 * zoals ze nu in Home Assistant staan. Een schakelaar die de regeling al
 * bedient, is geen losse stekker.
 */
function vindBuffersHa(): FoundHeatStore[] {
  if (!houseRegisters) return [];
  const buffers = findHeatStores(allStates, houseRegisters.entities, houseRegisters.devices);
  const bekend = new Set([...(siteConfig?.actuators ?? []).map((a) => a.ref.id), ...buffers.map((b) => b.actuator)]);
  return [...buffers, ...findPlugs(allStates, houseRegisters.entities, houseRegisters.devices, bekend)];
}
/** Met de schakelaars die op zon kunnen (besluit 304): die doen mee als een stekker. */
function vindBuffers(): FoundHeatStore[] {
  const ha = vindBuffersHa();
  if (!houseRegisters) return ha;
  const bekend = new Set([...(siteConfig?.actuators ?? []).map((a) => a.ref.id), ...ha.map((b) => b.actuator)]);
  // Bij het opstarten bestaat het bestand met de keuzes nog niet: dan alleen wat Home Assistant heeft.
  let keuzes: SchakelaarKeuzes;
  try {
    keuzes = schakelaarKeuzes();
  } catch {
    return ha;
  }
  return [...ha, ...schakelaarsOpZon(vindSchakelaars(allStates, houseRegisters.entities, houseRegisters.devices, bekend), keuzes)];
}
/*
 * Schakelaars (besluit 297): een relais zoals een Shelly 1 mini, klik-aan-klik-uit
 * of de knoppen van een IR-afstandsbediening. Wat het huis al kent (de regeling,
 * een boiler, een stekker), telt niet mee. De keuzes staan in een eigen bestand.
 */
const schakelaarStore = logDir !== '' ? new SchakelaarStore(logDir) : null;
await schakelaarStore?.load();
const schakelaarKeuzes = (): SchakelaarKeuzes => schakelaarStore?.current ?? GEEN_KEUZES;
/**
 * De registers met de laadpalen uit losse sensoren erbij (besluit 301), voor
 * alles over laden en de thuisaccu. Zolang de keuzes nog niet geladen zijn: zonder.
 */
function laadReg<R extends { readonly devices: readonly HaDevice[]; readonly entities: readonly HaRegistryEntity[] }>(r: R): R {
  let laadpalen;
  try {
    laadpalen = schakelaarStore?.current?.laadpalen;
  } catch {
    laadpalen = undefined;
  }
  return metLosseLaadpalen(r, laadpalen);
}
function vindSchakelaarsNu(): GevondenSchakelaar[] {
  if (!houseRegisters) return [];
  const bekend = new Set([...(siteConfig?.actuators ?? []).map((a) => a.ref.id), ...vindBuffersHa().map((b) => b.actuator)]);
  return vindSchakelaars(allStates, houseRegisters.entities, houseRegisters.devices, bekend);
}
/**
 * De kinderslotten (besluit 299), per klimaatapparaat (op zijn `climate.`) en
 * per witgoed (op zijn id uit de configuratie): het slot op hetzelfde apparaat
 * in Home Assistant.
 */
function kinderslotten(): Record<string, { readonly id: string; readonly aan: boolean }> {
  if (!houseRegisters) return {};
  const uit: Record<string, { readonly id: string; readonly aan: boolean }> = {};
  for (const e of houseRegisters.entities) {
    if (!e.entity_id.startsWith('climate.')) continue;
    const s = kinderslotVan(e.entity_id, houseRegisters.entities, allStates);
    if (s) uit[e.entity_id] = s;
  }
  for (const d of siteConfig?.deferrables ?? []) {
    const s = kinderslotVan(d.remoteStart.id, houseRegisters.entities, allStates);
    if (s) uit[d.id] = s;
  }
  return uit;
}

/** De radiatorknoppen buiten de regeling (besluit 126), met hun kamer: die zet de hand direct (besluit 235). */
function handKnoppen(): { id: string; naam: string; kamer: string }[] {
  const regeling = new Set((siteConfig?.actuators ?? []).map((a) => a.ref.id));
  return (houseReport()?.etages ?? []).flatMap((e) => e.ruimtes.flatMap((r) => r.apparaten.filter((a) => a.radiatorknop && a.id.startsWith('climate.') && !regeling.has(a.id)).map((a) => ({ id: a.id, naam: a.naam, kamer: r.naam }))));
}
/** De stekkers met een warmtebron die niet in de regeling zitten (besluit 235). */
function handSchakelaars(): { id: string; kamer: string; naam: string; aan: boolean }[] {
  const regeling = new Set((siteConfig?.actuators ?? []).map((a) => a.ref.id));
  return (layoutNu?.()?.kamers ?? []).flatMap((k) =>
    (k.bronnen ?? [])
      .filter((b) => b.aan !== 'hand' && b.apparaat?.startsWith('switch.') && !regeling.has(b.apparaat))
      .map((b) => ({ id: b.apparaat!, kamer: k.naam ?? k.id, naam: String(allStates.get(b.apparaat!)?.attributes['friendly_name'] ?? b.apparaat), aan: allStates.get(b.apparaat!)?.state === 'on' })),
  );
}
if (klimaatBrug) {
  setInterval(() => {
    klimaatBrug.ronde().then(
      (gedaan) => gedaan.forEach((g) => console.log(`[klimaatbrug] ${g}`)),
      (e: unknown) => console.warn(`[klimaatbrug] terugzetten lukte niet: ${(e as Error).message}`),
    );
    handbediening?.ronde().then(
      (gedaan) => gedaan.forEach((g) => console.log(`[met de hand] ${g}`)),
      (e: unknown) => console.warn(`[met de hand] terugzetten lukte niet: ${(e as Error).message}`),
    );
  }, 60_000).unref();
}
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
let bewegingGeladen = '';
let bewegingMelders: { van: FunctiesGevonden | null; f: Functies | null; ids: ReadonlySet<string> } = { van: null, f: null, ids: new Set() };
const camMelders = (): ReadonlySet<string> => {
  const f = functiesNu();
  // Opnieuw als wat er gevonden of gekozen is verandert; niet bij elke toestand.
  if (bewegingMelders.van !== gevondenNu || bewegingMelders.f !== f) {
    const g = functiesKeuzes();
    bewegingMelders = { van: gevondenNu, f, ids: new Set(f ? cameraMelders(f, g) : []) };
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
client.on('stateChanged', (state: HaEntityState) => {
  // Een camera ziet beweging (besluit 201): onthouden wanneer, voor de kaart Camera's.
  if (state.entity_id.startsWith('binary_sensor.') && state.state === 'on' && allStates.get(state.entity_id)?.state !== 'on' && camMelders().has(state.entity_id)) bewegingAan.set(state.entity_id, Date.now());
  // Aanbellen: de melder van de deurbel gaat af. Dan toont elke open pagina het beeld.
  const f = functiesNu();
  if (f && aangebeld(f, state, allStates.get(state.entity_id))) {
    aangebeldMs = Date.now();
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
  if (state.entity_id === voorkeuren?.melder() && state.state === 'on' && allStates.get(state.entity_id)?.state !== 'on') web?.wek('beweging');
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
                  (gedaan) => gedaan.forEach((g) => console.log(`[stekker op zon] ${g}`)),
                  (e: unknown) => console.warn(`[stekker op zon] lukte niet: ${(e as Error).message}`),
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
const layoutStore =
  logDir !== '' && siteConfig
    ? new LayoutStore({
        logDir,
        // Met de lampen achter een schakelaar (besluit 297): anders bleef hun kamer niet bewaard (melding 163).
        known: () => (houseRegisters ? knownForLayout(siteConfig!, houseRegisters, houseStates, lampSchakelaars(vindSchakelaarsNu(), schakelaarKeuzes()).map((r) => r.id)) : null),
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

/*
 * Hoe de panelen liggen (besluit 157): de opbrengst van de afgelopen tien
 * dagen, per vijf minuten uit de statistiek van Home Assistant (zo lang bewaart
 * hij die), om de drie uur opnieuw. De meting rekent opnieuw als de antwoorden
 * over het dak veranderen. Alleen lezen, met dezelfde vraag als Opbrengst.
 */
let liggingRijen: { at: number; rijen: PowerRow[] } | null = null;
/** Dezelfde tien dagen per omvormer, voor de meting per dakvlak (besluit 254, stap 4). */
let liggingPerId = new Map<string, PowerRow[]>();
async function leesLigging(): Promise<void> {
  // Met meer omvormers de som (testerronde, november 2026); een meetpunt met een attribuut heeft geen statistiek.
  const punten = siteConfig?.solarProduction ? [siteConfig.solarProduction, ...(siteConfig.solarExtra ?? [])] : [];
  if (!punten.length || punten.some((p) => p.attribute)) return;
  const ids = punten.map((p) => p.id);
  const nu = Date.now();
  const raw = await client.query<Record<string, { start: number | string; mean?: number | null }[]>>('recorder/statistics_during_period', {
    start_time: new Date(nu - 10 * 86_400_000).toISOString(),
    end_time: new Date(nu).toISOString(),
    statistic_ids: ids,
    period: '5minute',
    types: ['mean'],
    units: { power: 'W' },
  });
  const reeks = (id: string) => (raw?.[id] ?? [])
    .filter((r) => typeof r.mean === 'number' && Number.isFinite(r.mean))
    .map((r) => ({ startMs: typeof r.start === 'number' ? r.start : Date.parse(r.start), meanW: r.mean as number }));
  // Alleen vakken waarin elke omvormer iets gaf: anders lijkt het dak minder sterk.
  liggingPerId = new Map(ids.map((id) => [id, reeks(id)]));
  liggingRijen = { at: nu, rijen: somPerVak(ids.map(reeks), [], true) };
}
// Eerst kort na het verbinden, daarna om de drie uur; mislukt het, dan over tien minuten opnieuw.
setInterval(() => {
  if (liggingRijen == null || Date.now() - liggingRijen.at > 3 * 3_600_000) void leesLigging().catch(() => {});
}, 10 * 60_000).unref();
setTimeout(() => void leesLigging().catch(() => {}), 45_000).unref();

/** De omvormer uit zijn typenummer: van het apparaat van de zonnesensor, of de enige die er is. */
function omvormerGevonden(): number | null {
  const regs = houseRegisters;
  if (!regs) return null;
  const id = siteConfig?.solarProduction?.id;
  const device = id ? regs.entities.find((e) => e.entity_id === id)?.device_id : null;
  const eigen = device ? omvormerUitType(regs.devices.find((d) => d.id === device)?.model) : null;
  if (eigen != null) return eigen;
  const alle = [...new Set(regs.devices.map((d) => omvormerUitType(d.model)).filter((w): w is number => w != null))];
  return alle.length === 1 ? alle[0]! : null;
}

/** Wat elke omvormer hooguit levert, uit het typenummer van zijn apparaat (besluit 254, stap 4). */
function grenzenGevonden(): Record<string, number> {
  const regs = houseRegisters;
  if (!regs) return {};
  const uit: Record<string, number> = {};
  for (const p of siteConfig?.solarProduction ? [siteConfig.solarProduction, ...(siteConfig.solarExtra ?? [])] : []) {
    const device = regs.entities.find((e) => e.entity_id === p.id)?.device_id;
    const w = device ? omvormerUitType(regs.devices.find((d) => d.id === device)?.model) : null;
    if (w != null) uit[p.id] = w;
  }
  return uit;
}

/**
 * De meting per dakvlak (besluit 254, stap 4): per meter zijn vlakken uit zijn
 * eigen opbrengst. Vlakken zonder meter horen bij de enige omvormer, of, als
 * geen enkel vlak een meter heeft, bij alle omvormers samen. Bewaard tot er
 * iets verandert.
 */
let vlakMetingBewaard: { sleutel: string; uit: { perLetter: Record<string, VlakStand>; verdeling: Record<string, Verdeling>; achter: Achter | null } } | null = null;
function vlakMetingNu(): { perLetter: Record<string, VlakStand>; verdeling: Record<string, Verdeling>; achter: Achter | null } | null {
  const d = connectionStore?.current?.daken;
  const cfg = siteConfig;
  if (!d?.vlakken.length || !location || !cfg || !liggingRijen) return null;
  const ids = [...liggingPerId.keys()];
  const grenzen = grenzenGevonden();
  const sleutel = JSON.stringify([liggingRijen.at, location, d.vlakken, d.grenzen ?? null, grenzen]);
  if (vlakMetingBewaard?.sleutel === sleutel) return vlakMetingBewaard.uit;
  const zonderMeter = d.vlakken.every((v) => v.meter == null);
  const groepen = new Map<string, DakVlak[]>();
  for (const v of d.vlakken) {
    const id = v.meter ?? (ids.length === 1 ? ids[0]! : zonderMeter ? '' : null);
    if (id == null || (id !== '' && !liggingPerId.has(id))) continue;
    groepen.set(id, [...(groepen.get(id) ?? []), v]);
  }
  const perLetter: Record<string, VlakStand> = {};
  const verdeling: Record<string, Verdeling> = {};
  const meterGroepen: MeterGroep[] = [];
  for (const [id, vlakken] of groepen) {
    const rijen = id === '' ? liggingRijen.rijen : liggingPerId.get(id)!;
    const grens = id === '' ? omvormerGevonden() : (d.grenzen?.[id] ?? grenzen[id] ?? (ids.length === 1 ? (d.omvormerW ?? omvormerGevonden()) : null));
    const m = meetVlakken(rijen, vlakken, location, grens);
    if (m) Object.assign(perLetter, m.vlakken);
    // Verdelen met de stand waar de berekening mee rekent.
    const nu = metMeting({ ...d, vlakken }, perLetter).vlakken;
    const v = verdeelDag(rijen, nu, location, cfg.timezone, Date.now());
    if (v) verdeling[id || 'samen'] = v;
    meterGroepen.push({ id, vlakken: nu, rows: rijen, grensW: grens });
  }
  // Een vlak dat achterblijft (stap 5): per meter, en per deel van de dag.
  const achter = achterblijven(meterGroepen, location, cfg.timezone);
  vlakMetingBewaard = { sleutel, uit: { perLetter, verdeling, achter } };
  return vlakMetingBewaard.uit;
}

let metingBewaard: { sleutel: string; meting: Meting | null } | null = null;
/** De ligging gemeten uit de opbrengst, of null zonder heldere dag; bewaard tot er iets verandert. */
/**
 * Wat de meting over het dak mag aannemen. Met bewaarde daken (besluit 254)
 * zoekt hij vrij, één vlak of twee tegenover elkaar, met het aantal panelen op
 * het hoofddak: anders stuurt wat de bewoner bij een vlak invulde de meting,
 * en kan hij niet meer zeggen dat het anders ligt.
 */
function metingPanelen(a: ConnectionAnswers | null): PanelenAntwoord {
  const hoofd = (a?.daken?.vlakken ?? []).filter((v) => v.plek === 'hoofddak' || v.plek === 'dwarskap');
  if (hoofd.length) return { ligging: null, aantal: Math.min(200, hoofd.reduce((s, v) => s + panelenVan(v), 0)), voorkant: null, achterkant: null };
  return a?.panelen ?? { ligging: null, aantal: null, voorkant: null, achterkant: null };
}

function metingNu(): Meting | null {
  const r = liggingRijen;
  const cfg = siteConfig;
  if (!r || !location || !cfg) return null;
  const a = connectionStore?.current ?? null;
  const panelen = metingPanelen(a);
  const omvormerW = a?.dak?.omvormerW ?? omvormerGevonden();
  const sleutel = JSON.stringify([r.at, location, panelen, omvormerW]);
  if (metingBewaard?.sleutel !== sleutel) metingBewaard = { sleutel, meting: meetLigging(r.rijen, location, panelen, { timeZone: cfg.timezone, omvormerW }) };
  return metingBewaard.meting;
}

/**
 * De ligging die geldt, over de configuratie: wat de bewoner bevestigde gaat
 * voor (zoals de zekering, besluit 117), dan het bestand, dan de meting, dan
 * een schatting. De regeling leest hem niet (93), dus dit kan zonder herstart.
 */
let liggingBewaard: { sleutel: string; gekozen: ReturnType<typeof kiesLigging> } | null = null;
function metLigging(c: SiteConfig): SiteConfig {
  const a = connectionStore?.current ?? null;
  const input = {
    configuratie: c.geometry,
    dak: a?.dak ?? null,
    meting: metingNu(),
    panelen: a?.panelen ?? null,
    voorkantZon: a?.voorkantZon ?? null,
    omvormerGevonden: omvormerGevonden(),
    // Daken en panelen (besluit 254): elk vlak apart, en de andere daken tellen mee; gemeten volgt de meting (stap 4).
    daken: a?.daken ? metMeting(a.daken, vlakMetingNu()?.perLetter ?? {}) : null,
    elders: a?.elders ?? null,
    grenzen: grenzenGevonden(),
  };
  // Hetzelfde object zolang er niets verandert: de weercache kijkt ernaar.
  const sleutel = JSON.stringify(input);
  if (liggingBewaard?.sleutel !== sleutel) liggingBewaard = { sleutel, gekozen: kiesLigging(input) };
  const gekozen = liggingBewaard.gekozen;
  if (gekozen == null) {
    if (c.geometry == null) return c;
    const { geometry: _weg, ...zonder } = c;
    return zonder;
  }
  return gekozen.geometry === c.geometry ? c : { ...c, geometry: gekozen.geometry };
}

/** De configuratie zoals de app hem laat zien: met de namen en de volgorde uit de indeling (besluit 131). */
const webConfig = () => (siteConfig ? metLigging(withLayoutNames(siteConfig, layoutStore?.current ?? null)) : null);

/*
 * Meldingen in de app (besluit 136): elke minuut uit wat de dienst weet, naar
 * een eigen bestand naast de dataset. Niets naar Home Assistant.
 */
// Het sluipverbruik (besluit 192): de nachten uit dezelfde statistiek, met de prijs van Energie.
const sluipverbruik = new Sluipverbruik({
  config: () => siteConfig,
  vraag: (type, velden) => client.query<Record<string, { start: number | string; mean?: number | null }[]>>(type, velden),
  prijs: () => jaarPrijs(energyStore?.current?.prijzen ?? null),
  ...(logDir !== '' ? { logDir } : {}),
});
await sluipverbruik.load();
// Elk half uur de nachten bij, zodat de bel de ochtend erna weet of de nacht opviel.
setTimeout(() => void sluipverbruik.rapport().catch(() => null), 20_000).unref();
setInterval(() => void sluipverbruik.rapport().catch(() => null), 30 * 60_000).unref();
const meldingen = logDir !== '' ? new MeldingenStore({ logDir }) : null;
// Thuis naar eigen smaak (besluit 162): kaarten en favorieten, naast de dataset.
const voorkeuren = logDir !== '' ? new VoorkeurenStore(logDir) : null;
await voorkeuren?.load();
await meldingen?.load();
/** Wat de bel van de auto's weet (besluit 263): de auto's met hun keuze voor kabel vergeten, en de klok van het huis. */
function autoBel(timeZone: string): Pick<Parameters<typeof meldingenBron>[0], 'autos' | 'handKlaar'> {
  const autos = huisNu('nl')?.opslag?.autos ?? [];
  if (!autos.length) return {};
  const nu = Date.now();
  const p = partsIn(nu, timeZone);
  const q = partsIn(zonedMidnight(p.y, p.m, p.d, timeZone) - 12 * 3_600_000, timeZone);
  const dag = (x: { y: number; m: number; d: number }) => `${x.y}-${String(x.m).padStart(2, '0')}-${String(x.d).padStart(2, '0')}`;
  const minuut = (uu: string) => Number(uu.slice(0, 2)) * 60 + Number(uu.slice(3, 5));
  const instelling = connectionStore?.current?.laden?.instelling ?? {};
  return {
    autos: {
      minuut: p.h * 60 + p.mi,
      dag: dag(p),
      gisteren: dag(q),
      lijst: autos.map((a) => {
        // Weg is 21:00 en 50%; null is uit. Zonder lading in procenten kan het niet.
        const k = instelling[a.id]?.kabel === undefined ? KABEL_STANDAARD : instelling[a.id]!.kabel!;
        return {
          id: a.id,
          naam: a.naam,
          pct: a.pct,
          grens: a.laadgrens,
          aangesloten: a.aangesloten,
          thuis: a.thuis,
          fout: a.fout,
          kabelSindsMs: a.kabelSinds ? Date.parse(a.kabelSinds) : null,
          kabel: k.pct != null && a.pct != null ? { om: minuut(k.om), pct: k.pct } : null,
        };
      }),
    },
    handKlaar: (laadhand?.klaar ?? []).map((k) => ({ ...k, naam: autos.find((a) => a.id === k.auto)?.naam ?? k.auto })),
  };
}
/** Wat de bel van de thuisaccu's weet (besluit 276); null zonder accu. */
function accuBel(cfg: SiteConfig): NonNullable<Parameters<typeof meldingenBron>[0]['accus']> | null {
  if (!houseRegisters) return null;
  const lijst = accusNu(laadReg(houseRegisters), allStates, connectionStore?.current?.laden ?? null, connectionStore?.current?.accu ?? null);
  if (!lijst.length) return null;
  const p = partsIn(Date.now(), cfg.timezone);
  const e = runner?.latest?.explanation;
  const netW = e && cfg.power.gridPower ? e.budget.gridPowerW : null;
  return {
    lijst: lijst.map((a) => ({ id: a.id, naam: a.naam, pct: a.pct, fout: a.fout, stilSindsMs: a.stilSindsMs })),
    terugW: netW == null ? null : Math.max(0, -netW),
    dag: `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`,
  };
}
/** Wat de bel van de slimme stekkers weet (besluit 264); null zolang de registers er niet zijn. */
function stekkerBel(cfg: SiteConfig): NonNullable<Parameters<typeof meldingenBron>[0]['stekkers']> | null {
  if (!houseRegisters) return null;
  const inRegeling = new Set((cfg.heatStores ?? []).map((h) => h.actuator.id));
  const gekozen = new Set((connectionStore?.current?.buffers ?? []).filter((b) => b.opZon).map((b) => b.actuator));
  const meters = energyStore?.current ? new Set(energyStore.current.apparaten.map((a) => a.id)) : null;
  // Een schakelaar op zon (besluit 304) is niet gevonden maar ingesteld: geen melding.
  return vindBuffersHa()
    .filter((b) => b.soort === 'stekker')
    .map((b) => ({ id: b.id, naam: b.naam, opZon: inRegeling.has(b.actuator) || gekozen.has(b.actuator), meter: b.energy ?? null, meterErin: meters == null || (b.energy != null && meters.has(b.energy)) }));
}
function meldingenRonde(): void {
  const cfg = siteConfig;
  const h = cfg ? houseReport() : null;
  if (!meldingen || !cfg || !h || allStates.size === 0) return;
  // Wat de bel weet (meldingen-bron.ts); null als Home Assistant zelf weg is.
  const bron = meldingenBron({
    nu: Date.now(),
    config: cfg,
    huis: h,
    states: allStates,
    addOn: version.installatie === 'add-on',
    // Met bewaarde daken (besluit 254) is er niets meer te bevestigen.
    panelenVoorstel: connectionStore?.current?.dak == null && !connectionStore?.current?.daken?.vlakken.length && metingNu() != null,
    // Een vlak dat op minstens drie zonnige dagen achterbleef (stap 5).
    dakAchter: (() => {
      const a = vlakMetingNu()?.achter;
      return a && a.dagen >= 3 ? { letter: a.letter, wanneer: a.wanneer, minderPct: a.minderPct, eigenMeter: a.eigenMeter } : null;
    })(),
    winterdagen: analyse?.latest?.dataset?.seizoenen?.find((s) => s.seizoen === 'winter')?.dagen ?? null,
    profiel: runner?.latest?.explanation.profile ?? null,
    hoofd: bewonersStore ? hoofdVan(bewonersStore.current) : null,
    sluip: sluipVoorBel(sluipverbruik.laatste(), Date.now(), cfg.timezone),
    // De auto (besluit 263): vol, een fout, kabel vergeten, en laden met de hand dat klaar is.
    ...autoBel(cfg.timezone),
    // De thuisaccu (besluit 276): stil, een fout, of vol terwijl de zon naar het net gaat.
    accus: accuBel(cfg),
    // De slimme stekkers (besluit 264): gevonden, en zijn meter bij Energie.
    stekkers: stekkerBel(cfg),
  });
  if (bron == null) return;
  meldingen.bij(bron);
  void meldingen.bewaar().catch(() => undefined);
  void pushRonde().catch(() => undefined);
  // Live naar de open pagina's (21 oktober 2026): eerst zag je een nieuwe melding pas bij een andere tab.
  const vinger = JSON.stringify(meldingen.lijst(Date.now()).actief.map((m) => [m.id, m.titel, m.tekst]));
  if (vinger !== meldingenVinger) {
    meldingenVinger = vinger;
    web?.meldingenVeranderd();
  }
}
/** Wat de open pagina's als laatste aan meldingen hoorden; verandert het, dan zegt de dienst het. */
let meldingenVinger: string | null = null;

/*
 * Meldingen op de telefoon (besluit 183): na elke ronde van de bel kijken wat
 * er naar welke telefoon moet. Alleen in de add-on (zie allowNotify).
 */
const pushStore = logDir !== '' && version.installatie === 'add-on' ? new PushStore(logDir) : null;
await pushStore?.load();
let telefoonsVoor: HouseRegisters | null = null;
let telefoonsNu: Telefoon[] = [];
/** De telefoons met de app van Home Assistant; opnieuw als de registers veranderen. */
const telefoons = (): Telefoon[] => {
  if (!houseRegisters) return [];
  if (telefoonsVoor !== houseRegisters) {
    telefoonsNu = vindTelefoons(houseRegisters, allStates);
    telefoonsVoor = houseRegisters;
  }
  return telefoonsNu;
};
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
let pushBezig = false;
async function pushRonde(): Promise<void> {
  if (!pushStore || !voorkeuren || !bewonersStore || !meldingen || pushBezig) return;
  pushBezig = true;
  try {
    const ontvangers = ontvangersVan(bewonersStore.current, voorkeuren, telefoons());
    const nu = Date.now();
    const l = meldingen.lijst(nu);
    const { berichten, verstuurd } = teSturen([...l.actief, ...l.eerder], ontvangers, pushStore.verstuurd, nu, siteConfig?.timezone ?? 'Europe/Amsterdam');
    for (const m of berichten) {
      try {
        const v = alsMelding(m, paneelPad);
        await client.callService('notify', m.dienst, v, {});
      } catch (error) {
        console.warn(`Melding naar ${m.dienst} lukte niet: ${(error as Error).message}`);
      }
    }
    await pushStore.save(verstuurd);
  } finally {
    pushBezig = false;
  }
}
/** Een proefmelding naar je eigen telefoon (besluit 183), vanaf Jij. */
async function proefmelding(userId: string | null): Promise<{ ok: true; naam: string } | { ok: false; status: number; reden: string }> {
  if (version.installatie !== 'add-on') return { ok: false, status: 409, reden: 'meldingen op de telefoon gaan alleen vanuit de add-on' };
  if (!userId || !voorkeuren) return { ok: false, status: 403, reden: 'log in met je eigen account' };
  const t = telefoonVan(userId, voorkeuren.meldingen(userId), telefoons());
  if (!t) return { ok: false, status: 404, reden: 'geen telefoon met de app van Home Assistant gevonden' };
  try {
    await client.callService('notify', t.dienst, alsMelding({ dienst: t.dienst, ...proefTekst(voorkeuren.taal(userId)), tag: 'smart-climate-proef', dringend: false, stil: false }, paneelPad), {});
    return { ok: true, naam: t.naam };
  } catch (error) {
    return { ok: false, status: 502, reden: (error as Error).message };
  }
}
if (meldingen) {
  setTimeout(meldingenRonde, 30_000).unref();
  setInterval(meldingenRonde, 60_000).unref();
}

/*
 * Te doen (besluit 216): de herinneringen in een eigen bestand, en op het
 * tijdstip een melding naar de telefoon van wie hem vroeg (alleen in de
 * add-on). De wand vraagt zelf wat er speelt en zegt het hardop.
 */
const herinneringen = new Herinneringen({
  map: logDir !== '' ? logDir : null,
  // Vast en gepland (besluit 234): na elke keer het volgende moment, op de klok en de zon van hier.
  volgende: (o, vanMs) => (o.moment && o.herhaal ? volgendeMoment(o.moment, o.herhaal, vanMs, siteConfig?.timezone ?? 'Europe/Amsterdam', location) : null),
});
const teDoenKeus = () => {
  const f = functiesNu();
  return volledig(f ?? functiesVoorstel(functiesKeuzes() ?? { cameras: [], melders: [] }), functiesKeuzes()).tedoen;
};
const bewonerNaam = (account: string): string | null => {
  const b = bewonersStore?.current;
  const id = b?.volgorde.find((x) => b.bewoners[x]?.haUser === account && !b.bewoners[x]?.gast);
  return id ? (b!.bewoners[id]!.naam ?? null) : null;
};
const teDoen: TeDoenDienst = {
  keus: teDoenKeus,
  herinneringen,
  leesAgendas: (ids, van, tot) => client.leesAgendas(ids, van, tot),
  leesLijsten: (ids) => client.leesLijsten(ids),
  lijst: async (id, item, actie) => {
    if (actie === 'opruimen') await client.callService('todo', 'remove_completed_items', {}, { entity_id: id });
    else if (actie === 'toevoegen') await client.callService('todo', 'add_item', { item }, { entity_id: id });
    else await client.callService('todo', 'update_item', { item, status: actie === 'klaar' ? 'completed' : 'needs_action' }, { entity_id: id });
  },
  agendaVan: (account) => voorkeuren?.agenda(account) ?? { aan: true, ids: [] },
  naamVan: bewonerNaam,
  // Wie er thuis is, zoals de regeling het ziet (besluit 219): hun eigen agenda's staan dan op de wand.
  thuis: () => {
    const b = bewonersStore?.current;
    if (!b) return [];
    return (runner?.latest?.explanation.profile?.home ?? []).flatMap((id) => {
      const x = b.bewoners[id];
      return x && !x.gast && x.haUser ? [{ account: x.haUser, naam: x.naam ?? '' }] : [];
    });
  },
  namen: (ids) => Object.fromEntries(ids.map((id) => [id, String(allStates.get(id)?.attributes['friendly_name'] ?? id)])),
  agendas: () =>
    [...allStates.values()]
      .filter((s) => /^calendar\.[a-z0-9_]+$/.test(s.entity_id) && s.state !== 'unavailable')
      .map((s) => ({ id: s.entity_id, naam: String(s.attributes['friendly_name'] ?? s.entity_id) }))
      .sort((a, b) => a.naam.localeCompare(b.naam, 'nl')),
};
/**
 * Een geplande opdracht uitvoeren (besluit 218): dezelfde deuren als de
 * pagina, binnen wat bij Functies aan staat. Wat niet mag of niet lukt, komt
 * in het logboek.
 */
async function voerGeplandUit(h: Herinnering): Promise<void> {
  const f = functiesNu();
  const vol = f ? volledig(f, functiesKeuzes()) : null;
  const mag = vol?.licht.bedienen !== false;
  // Klimaat met de hand en witgoed (besluit 240): dezelfde deuren als besluit 235 en 238.
  const hand = handbediening && klimaatAan() ? handbediening : null;
  const deuren: GeplandeDeuren = {
    licht: lightSwitch && mag ? (b) => lightSwitch.switch(b) : null,
    scene: lightSwitch?.scenesEnabled && mag ? (b) => lightSwitch.scene(b) : null,
    scherm: coverSwitch && vol?.schermen.bedienen !== false ? (b) => coverSwitch.move(b) : null,
    hand: hand
      ? {
          zet: (id, modus, doelC, totMs, totDoel) => hand.zet(id, modus, doelC, totMs, totDoel),
          zetKnop: (id, doelC, totMs, totDoel) => hand.zetKnop(id, doelC, totMs, totDoel),
          schakelAan: (id, totMs) => hand.schakelAan(id, totMs),
          isKnop: (id) => handKnoppen().some((k) => k.id === id),
        }
      : null,
    witgoed: witgoed ? (id) => witgoed!.nuStarten(id) : null,
    // Een slimme stekker op een vaste tijd (besluit 266): dezelfde deur als met de hand (265).
    stekker: inHuisMetDeuren ? async (id, aan, tot) => {
      const r = await stekkerhand.zet(id, aan, tot);
      return r.ok ? { ok: true } : { ok: false, reden: r.reden };
    } : null,
    tz: siteConfig?.timezone ?? 'Europe/Amsterdam',
  };
  for (const s of h.opdracht?.stappen ?? []) {
    const r = await voerStapUit(s, deuren);
    if (r == null) console.warn(`[gepland] ${s.pad} staat niet aan; "${h.tekst}" niet gedaan`);
    else if (!r.ok) console.warn(`[gepland] "${h.tekst}" lukte niet: ${r.reden ?? ''}`);
  }
}

let herinnerBezig = false;
async function herinnerRonde(): Promise<void> {
  if (herinnerBezig) return;
  herinnerBezig = true;
  try {
    const alles = await herinneringen.ronde();
    // Geplande opdrachten voert de dienst zelf uit; ze gaan niet als melding naar een telefoon.
    // Overslaan als niemand thuis is (besluit 234): alleen wie dat bij de opdracht koos.
    const niemand = runner?.latest?.explanation.occupied === false;
    for (const g of alles.filter((x) => x.opdracht)) {
      if (g.opdracht?.overslaanWeg && niemand) {
        console.log(`[gepland] "${g.tekst}" overgeslagen: niemand thuis`);
        continue;
      }
      await voerGeplandUit(g).catch((error: unknown) => console.warn(`[gepland] ${(error as Error).message}`));
    }
    const nieuw = alles.filter((x) => !x.opdracht);
    // Een melding naar de telefoon van wie hem vroeg; een herinnering voor het huis alleen op de wand.
    if (version.installatie !== 'add-on' || !voorkeuren) return;
    for (const h of nieuw) {
      if (h.voor == null) continue;
      const t = telefoonVan(h.voor, voorkeuren.meldingen(h.voor), telefoons());
      if (!t) continue;
      const nl = voorkeuren.taal(h.voor) !== 'en';
      try {
        await client.callService('notify', t.dienst, alsMelding({ dienst: t.dienst, titel: nl ? 'Te doen' : 'To do', tekst: h.tekst, tag: `smart-climate-tedoen-${h.id}`, dringend: true, stil: false }, paneelPad), {});
      } catch (error) {
        console.warn(`Herinnering naar ${t.dienst} lukte niet: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    console.warn(`[te doen] ${(error as Error).message}`);
  } finally {
    herinnerBezig = false;
  }
}
setInterval(() => void herinnerRonde(), 15_000).unref();

// Vandaag uit de statistiek van Home Assistant (17 oktober 2026, historie.ts).
const historie = new Historie({
  config: () => siteConfig,
  vraag: (type, velden) => client.query<Record<string, { start: number | string; mean?: number | null }[]>>(type, velden),
});
const historieVan = (vanMs: number, totMs: number) => historie.van(vanMs, totMs);

// De laadbeurten van een auto (besluit 259, stap 3): de meter van zijn laadvermogen en het net, met de prijzen van Energie.
const laadbeurten = new Laadbeurten({
  config: () => siteConfig,
  meter: (auto) => (houseRegisters ? (laadMeters(laadReg(houseRegisters), allStates, connectionStore?.current?.laden ?? null).find((m) => m.auto === auto)?.vermogen ?? null) : null),
  prijzen: () => energyStore?.current?.prijzen ?? null,
  eenheid: (id) => {
    const e = allStates.get(id)?.attributes['unit_of_measurement'];
    return typeof e === 'string' ? e : null;
  },
  vraag: (type, velden) => client.query<Record<string, { start: number | string; mean?: number | null }[]>>(type, velden),
});

/**
 * De opbrengst per dakvlak over een periode (besluit 254, stap 5): per uur wat
 * elke meter gemiddeld mat, uit de statistiek van Home Assistant, verdeeld naar
 * de heldere lucht per vlak. Een half uur bewaard per periode.
 */
const dakenOpbrengstBewaard = new Map<string, { at: number; uit: { vlakken: { letter: string; plek: string; naam: string | null; azimuthDeg: number; opstelling: string; aantal: number; kWh: number }[]; achter: Achter | null } }>();
async function dakenOpbrengst(vanMs: number, totMs: number): Promise<{ vlakken: { letter: string; plek: string; naam: string | null; azimuthDeg: number; opstelling: string; aantal: number; kWh: number }[]; achter: Achter | null } | null> {
  const a = connectionStore?.current;
  const ids = siteConfig?.solarProduction ? [siteConfig.solarProduction.id, ...(siteConfig.solarExtra ?? []).map((p) => p.id)] : [];
  if (!a?.daken?.vlakken.length || !location || !ids.length) return null;
  const d = metMeting(a.daken, vlakMetingNu()?.perLetter ?? {});
  const tot = Math.min(totMs, Date.now());
  const sleutel = JSON.stringify([vanMs, tot - (tot % 1_800_000), d.vlakken]);
  const b = dakenOpbrengstBewaard.get(sleutel);
  if (b && Date.now() - b.at < 1_800_000) return b.uit;
  const raw = await client.query<Record<string, { start: number | string; mean?: number | null }[]>>('recorder/statistics_during_period', {
    start_time: new Date(vanMs).toISOString(),
    end_time: new Date(tot).toISOString(),
    statistic_ids: ids,
    period: 'hour',
    types: ['mean'],
    units: { power: 'W' },
  });
  const reeks = (id: string): PowerRow[] => (raw?.[id] ?? [])
    .filter((r) => typeof r.mean === 'number' && Number.isFinite(r.mean))
    .map((r) => ({ startMs: typeof r.start === 'number' ? r.start : Date.parse(r.start), meanW: r.mean as number }));
  const groepen = new Map<string, DakVlak[]>();
  for (const v of d.vlakken) {
    const id = v.meter ?? (ids.length === 1 ? ids[0]! : '');
    groepen.set(id, [...(groepen.get(id) ?? []), v]);
  }
  // Eén meter voor alle vlakken: de uren van vóór de omvormer uit de zonnemeter in kWh (5 november 2026).
  const meters = energyStore?.current?.zon ?? [];
  let kwhPerUur = new Map<number, number>();
  if (groepen.size === 1 && meters.length) {
    const kwh = await client.query<Record<string, { start: number | string; change?: number | null }[]>>('recorder/statistics_during_period', {
      start_time: new Date(vanMs).toISOString(),
      end_time: new Date(tot).toISOString(),
      statistic_ids: [...meters],
      period: 'hour',
      types: ['change'],
      units: { energy: 'kWh' },
    });
    kwhPerUur = new Map();
    for (const id of meters) {
      for (const r of kwh?.[id] ?? []) {
        if (typeof r.change !== 'number' || !Number.isFinite(r.change)) continue;
        const t = typeof r.start === 'number' ? r.start : Date.parse(r.start);
        kwhPerUur.set(t, (kwhPerUur.get(t) ?? 0) + Math.max(0, r.change));
      }
    }
  }
  const kWh = opbrengstPerVlak(
    [...groepen].map(([id, vlakken]) => {
      const rows = id ? reeks(id) : somPerVak(ids.map(reeks), [], true);
      return { vlakken, rows: kwhPerUur.size ? aanvullenUitMeter(rows, kwhPerUur) : rows };
    }),
    location,
  );
  const uit = { vlakken: d.vlakken.map((v) => ({ letter: v.letter, plek: v.plek, naam: v.naam ?? null, azimuthDeg: v.azimuthDeg, opstelling: v.opstelling, aantal: panelenVan(v), kWh: kWh[v.letter] ?? 0 })), achter: vlakMetingNu()?.achter ?? null };
  dakenOpbrengstBewaard.set(sleutel, { at: Date.now(), uit });
  return uit;
}

/** Welke rookmelders nu iets zien, met hun kamer (21 oktober 2026). */
function alarmNu(): AlarmMelder[] {
  const h = houseReport();
  return (h?.etages ?? []).flatMap((e) => e.ruimtes.flatMap((r) => r.apparaten.filter((d) => d.soort === 'rookmelder').map((d) => ({ id: d.id, naam: d.naam, kamer: r.naam, gevaar: d.rookmelder?.gevaar ?? null, sindsMs: d.rookmelder?.sindsMs ?? null }))));
}

/*
 * Het huis één keer uitrekenen per verandering (21 oktober 2026). Bij een paar
 * duizend entiteiten kost het tientallen milliseconden op de Pi, en elk open
 * scherm vraagt het om de paar tellen, net als de lampen, de schermen en het
 * rookalarm. Opnieuw zodra Home Assistant iets in het huis meldt of een van de
 * bronnen verandert, en anders hooguit om de tien tellen: de kleuren van de
 * scènes en de meting van de ligging veranderen zonder dat iets hier het ziet.
 */
const HUIS_HOOGUIT_MS = 10_000;
/** Per taal (besluit 185): de stand en de samenvatting staan erin in woorden. */
const huisBewaard = new Map<Lang, { sleutel: readonly unknown[]; atMs: number; huis: ReturnType<typeof buildHouse> | null }>();
const huisNu = (lang: Lang) => {
  const sleutel = [huisVersie, houseRegisters, siteConfig, runner?.latest, layoutStore?.current, functiesStore?.current, connectionStore?.current, schakelaarStore?.current];
  const b = huisBewaard.get(lang);
  if (b && Date.now() - b.atMs < HUIS_HOOGUIT_MS && b.sleutel.every((x, i) => x === sleutel[i])) return b.huis;
  const huis = siteConfig && houseRegisters
    ? buildHouse(
        webConfig()!,
        houseRegisters,
        houseStates,
        runner?.latest ?? null,
        layoutStore?.current ?? null,
        sceneColors ? (id, naam) => sceneColors.colors(id, naam) : undefined,
        scenePictures ? (naam) => scenePictures.pictureFor(naam) : undefined,
        // Alleen de camera's die de bewoner koos; zonder keuze het voorstel (elke camera).
        functiesStore?.current ? getoondeCameras(functiesStore.current) : null,
        // Wanneer een batterij of filter een melding geeft (besluit 149).
        functiesStore?.current?.meldingen,
        lang,
        // Lampen achter een schakelaar (besluit 297): bij het licht van hun kamer.
        lampSchakelaars(vindSchakelaarsNu(), schakelaarKeuzes()),
      )
    : null;
  // Een plat dak op het hoofdhuis (issue 131): zoals de bewoner het opgaf bij Daken en panelen of Inrichten (143).
  const a = connectionStore?.current;
  // Ook zonder bekende ligging (geen voorgevel): dan alleen dat het dak plat is, anders bleef het een puntdak.
  const isPlat = huis != null && hoofddakPlat(a?.daken, a?.panelen?.ligging, layoutStore?.current?.dak === 'geen');
  const plat0 = !isPlat || !huis ? huis : huis.ligging ? { ...huis, ligging: { ...huis.ligging, plat: true } } : { ...huis, dakPlat: true };
  // De auto's en laadpalen met de keuzes bij Energie (besluit 259), uit alle standen: een kabel of bereik telt niet als iets in huis.
  const plat = plat0 && houseRegisters ? { ...plat0, opslag: vindOpslag(laadReg(houseRegisters), allStates, a?.laden ?? null, new Date(), a?.accu ?? null) } : plat0;
  huisBewaard.set(lang, { sleutel, atMs: Date.now(), huis: plat });
  return plat;
};
/**
 * Het advies per auto (besluit 259, stap 4): uit het net en de stroom per fase
 * van het laatste besluit, en de prijzen per uur uit de prijs-entiteit van
 * Energie. Alleen lezen.
 */
/** De fasen van de aansluiting uit het laatste besluit, alleen als ze alle gemeten zijn. */
const fasenNu = () => {
  const e = runner?.latest?.explanation ?? null;
  const grid = siteConfig?.grid;
  return e?.phases && grid && e.phases.length > 0 && e.phases.every((p) => p.bron === 'gemeten' && p.currentA != null)
    ? e.phases.map((p) => ({ stroomA: p.currentA!, zekeringA: grid.phases.find((g) => g.id === p.id)?.maxA ?? p.limitA + grid.marginA, grensA: p.limitA }))
    : null;
};
/**
 * De hoogste stroom per fase die er met de hand voor een auto op de zekering
 * past (besluit 262): wat hij nu neemt plus de ruimte op de drukste fase; zonder
 * meting per fase de zekering min de marge; zonder aansluiting de zekering
 * die de bewoner bij Energie opgaf, min 2 A; zonder zekering niets.
 */
function zekeringVoor(id: string): number | null {
  const grid = siteConfig?.grid;
  if (!grid || !grid.phases.length) {
    // Zonder stroommeters per fase komt de zekering niet in de regeling (logboek bij issue 149 t/m 153), maar hij geldt wel.
    const z = connectionStore?.current?.zekering;
    return z && z !== 'weetniet' ? Math.max(6, z.ampere - 2) : null;
  }
  const fasen = fasenNu();
  if (!fasen) return Math.min(...grid.phases.map((p) => p.maxA - grid.marginA));
  const a = huisNu('nl')?.opslag?.autos.find((x) => x.id === id);
  const nuA = a?.laadt ? Math.max(0, ...(a.stroomA ?? [])) : 0;
  // Nooit boven de zekering zelf: bij teruglevering loopt er op een fase soms minder dan de auto neemt.
  return Math.floor(Math.min(nuA + Math.min(...fasen.map((f) => f.grensA - f.stroomA)), ...fasen.map((f) => f.grensA)));
}
/**
 * De fasekaart (besluit 302): de stroom per fase nu, en de dag uit de historie
 * van Home Assistant. Die historie hooguit elke vijf minuten opnieuw; de stand
 * van nu komt elke keer uit het laatste besluit.
 */
let faseDag: { startMs: number; opMs: number; punten: Map<string, FasePunt[]> } = { startMs: 0, opMs: 0, punten: new Map() };
async function fasenNuView(): Promise<FasenView> {
  const grid = siteConfig?.grid ?? null;
  const nuMs = Date.now();
  const startMs = startOfLocalDay(nuMs, siteConfig?.timezone ?? 'Europe/Amsterdam');
  const e = runner?.latest?.explanation ?? null;
  const ids = grid?.phases.map((p) => p.current.id) ?? [];
  if (ids.length && (faseDag.startMs !== startMs || nuMs - faseDag.opMs > 5 * 60_000)) {
    try {
      // Vanaf een uur voor middernacht: de stand van toen geldt ook om middernacht.
      const antwoord = await client.query('history/history_during_period', { start_time: new Date(startMs - 3_600_000).toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
      faseDag = { startMs, opMs: nuMs, punten: faseHistorie(antwoord) };
    } catch {
      // Zonder historie: alleen de stand van nu; over vijf minuten weer.
      faseDag = faseDag.startMs === startMs ? { ...faseDag, opMs: nuMs } : { startMs, opMs: nuMs, punten: new Map() };
    }
  }
  const z = connectionStore?.current?.zekering;
  return fasenView({
    grid: grid ? { phases: grid.phases.map((p) => ({ id: p.id, current: p.current.id, maxA: p.maxA })), marginA: grid.marginA } : null,
    nu: e?.phases?.map((p) => ({ id: p.id, currentA: p.currentA, bron: p.bron })) ?? null,
    historie: faseDag.punten,
    dagStartMs: startMs,
    nuMs,
    zekering: z && z !== 'weetniet' ? z : null,
    netW: e && siteConfig?.power.gridPower ? e.budget.gridPowerW : null,
  });
}
const laadadviezen = (): Record<string, LaadAdvies> => {
  const autos = huisNu('nl')?.opslag?.autos ?? [];
  if (!autos.length || !siteConfig) return {};
  const e = runner?.latest?.explanation ?? null;
  const netW = e && siteConfig.power.gridPower ? e.budget.gridPowerW : null;
  const fasen = fasenNu();
  const nuMs = Date.now();
  const prijsId = energyStore?.current?.prijzen.dynamisch?.prijsEntiteit ?? null;
  const prijsStaat = prijsId ? allStates.get(prijsId) : undefined;
  const eenheid = typeof prijsStaat?.attributes['unit_of_measurement'] === 'string' ? (prijsStaat.attributes['unit_of_measurement'] as string) : null;
  const prijzen = prijsStaat ? prijzenVooruit(prijsStaat.attributes, prijsStaat.state, eenheid, nuMs) : [];
  const nu = prijsStaat ? Number(prijsStaat.state) : NaN;
  const prijsNu = Number.isFinite(nu) ? nu / (/mwh/i.test(eenheid ?? '') ? 1000 : /ct|cent/i.test(eenheid ?? '') ? 100 : 1) : null;
  // De balk van de dag (besluit 279): de zon die naar verwachting over is, de prijs en de goedkoopste uren.
  const g = siteConfig.geometry;
  const plek = location;
  const zonW = (ms: number): number | null =>
    g && plek && g.solarPlanes.length
      ? zonVerwachtW(
          ms,
          openMeteo.latest?.uren ?? null,
          (t) => clearSkyW(g, plek, t, null),
          (t) => clearSkyOnPlaneWm2(sunPosition(t, plek.latDeg, plek.lonDeg), { azimuthDeg: 180, tiltDeg: 0 }),
        )
      : null;
  // Het huis zonder de auto overdag: ruwweg twee keer het sluipverbruik, minstens 300 W.
  const huisW = Math.max(300, 2 * (sluipverbruik.laatste()?.gewoonW ?? 200));
  return Object.fromEntries(
    autos.map((a) => {
      const advies = laadAdvies(a, { nuMs, netW, fasen, prijzen, prijsNu });
      return [a.id, { ...advies, dag: laadDag(a, { nuMs, prijzen, goedkoop: advies.goedkoop, zonW, huisW }) }];
    }),
  );
};

/** Het huis, met de stand in woorden in de taal van de app; zonder taal Nederlands. */
const houseReport = (lang: Lang = 'nl') => {
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
  };
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

/*
 * Het weer van de komende dagen (besluit 105). Elke tien minuten de zonkans
 * van morgen bewaren, ook als niemand kijkt: na die dag legt het huis hem naast
 * wat de panelen werkelijk haalden.
 */
const weatherLog = logDir === '' ? null : new WeatherLog(logDir);
/*
 * Waar het weer vandaan komt (besluit 111): Buienradar, of een weerentiteit
 * van Home Assistant, zoals de bewoner koos. Van een weerentiteit volgt de
 * dienst de dagverwachting; die komt alleen via een abonnement.
 */
// Zonder configuratie de tijdzone van de dienst; in de add-on is dat die van Home Assistant (run.sh).
const weerZone: string = baseConfig?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
let entityForecast: { entity: string | null; days: EntityForecast[] } = { entity: null, days: [] };
client.on('forecast', (entity, lijst, soort) => {
  // Geeft de entiteit uren of halve dagen, dan maakt de dienst er zelf dagen van.
  const days = soort === 'daily' ? (lijst as EntityForecast[]) : dagenUitUren(lijst as EntityForecast[], weerZone);
  entityForecast = { entity, days };
});
const weerBron = (): string | null => {
  const f = functiesNu();
  return f ? volledig(f, functiesKeuzes()).weer.bron : null;
};
const volgWeer = () => {
  const bron = weerBron();
  client.followForecast(bron?.startsWith('weather.') ? bron : null).catch((e: unknown) => console.warn(`Verwachting van ${bron} niet te volgen: ${(e as Error).message}`));
};
setInterval(volgWeer, 60_000).unref();
setTimeout(volgWeer, 15_000).unref();
/*
 * Open-Meteo (besluit 127): het weer zonder Home Assistant. Elk uur de
 * verwachting per uur bewaren voor het thermisch model, tenzij de bewoner dat
 * bij Functies uitzette; en de dagverwachting als hij Open-Meteo als weerbron
 * koos. Alleen de ligging op één decimaal gaat de deur uit.
 */
const openMeteo = new OpenMeteo({ location: () => location, timeZone: weerZone, logDir: logDir === '' ? null : logDir });
const haalWeer = () => {
  const f = functiesNu();
  const w = f ? volledig(f, functiesKeuzes()).weer : null;
  if (w == null || (!w.uren && w.bron !== OPEN_METEO)) return;
  openMeteo.refresh(w.uren).catch((e: unknown) => console.warn(`Weer van Open-Meteo niet opgehaald: ${(e as Error).message}`));
};
setInterval(haalWeer, 5 * 60_000).unref();
setTimeout(haalWeer, 20_000).unref();
// De naam en de dagverwachting van de gekozen bron (weerbron.ts).
const weerNaam = (): string => weerNaamVan(weerBron(), allStates);
const forecastNow = () =>
  verwachtingVan(weerBron(), { openMeteo: openMeteo.latest?.dagen ?? null, entities: houseRegisters?.entities ?? null, states: allStates, entiteit: entityForecast, nu: Date.now(), zone: weerZone });
if (weatherLog && site) {
  const timeZone = site.config.timezone;
  const noteTomorrow = () => {
    // Met de weergave rekent die ook de verwachting van morgen uit en bewaart hem.
    if (web) {
      web.weatherNow().catch((e: unknown) => console.warn(`Weer van morgen niet bewaard: ${(e as Error).message}`));
      return;
    }
    const morgen = forecastNow().find((f) => f.offset === 1);
    if (morgen?.zonkansPct == null) return;
    const p = partsIn(Date.now(), timeZone);
    const d = partsIn(zonedMidnight(p.y, p.m, p.d + 1, timeZone) + 12 * 3_600_000, timeZone);
    const day = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    weatherLog.note(day, morgen.zonkansPct).catch((e: unknown) => console.warn(`Zonkans van morgen niet bewaard: ${(e as Error).message}`));
  };
  setInterval(noteTomorrow, 10 * 60_000).unref();
  setTimeout(noteTomorrow, 60_000).unref();
}

/**
 * Wiens comfort (besluit 147): dat van de gevraagde bewoner, anders van wie er
 * kijkt, anders van de hoofdgebruiker. Wie volgt, ziet dat van de
 * hoofdgebruiker; aanpassen maakt het een eigen comfort.
 */
function comfortVoor(wie: Wie, gevraagd: string | null): { id: string | null; view: ComfortView } {
  return comfortVanBewoner(webConfig()!, comfortStore?.current ?? null, bewonersStore?.current ?? GEEN_BEWONERS, wie, gevraagd);
}

/*
 * De sleutel voor de assistent van Home Assistant (besluit 147): de hele app
 * vraagt een inlog, en de vraag van de assistent komt zonder mens erachter.
 * Eén keer gemaakt, in de logmap; bij Instellingen › App en toegang te zien.
 */
const sleutel = logDir !== '' ? await leesOfMaakSleutel(join(logDir, 'sleutel-assistent.txt')) : null;
/*
 * De integratie neerzetten voor wie geen HACS heeft (besluit 184): de map zit
 * in het image, en gaat na een tik naar custom_components in de configuratie
 * van Home Assistant (`/homeassistant` in de add-on). Bij het starten de nieuwe
 * versie, als de add-on hem eerder neerzette.
 */
const integratie = version.installatie === 'add-on' ? new Integratie('/app/integratie/sunarc', '/homeassistant') : null;
void integratie?.bijwerken().catch(() => false);
/**
 * Hoe de integratie erbij staat, met de versie die Home Assistant nu geladen
 * heeft, en of hij is toegevoegd (dan pas werkt hij). Na "Nieuw apparaat
 * gevonden" en Toevoegen vraagt Home Assistant nog om Verzenden; wie dat mist,
 * heeft de integratie wel, maar Assist nog niet (22 oktober 2026).
 */
async function integratieStand() {
  const stand = await integratie!.stand();
  let geladen: string | null = null;
  try {
    const m = await client.query<{ version?: string }>('manifest/get', { integration: 'sunarc' });
    geladen = typeof m?.version === 'string' ? m.version : null;
  } catch {
    // Niet geladen: nog niet herstart, of hij staat er niet.
  }
  let toegevoegd: boolean | null = null;
  try {
    const lijst = await client.query<unknown[]>('config_entries/get', { domain: 'sunarc' });
    toegevoegd = Array.isArray(lijst) && lijst.length > 0;
  } catch {
    // Onbekend: dan zegt de app er niets over.
  }
  // De koppeling onder de oude naam (tot 2 november 2026): de knop haalt hem weg na het toevoegen.
  const oudeKoppeling = (await oudeKoppelingen()).length > 0;
  return { ...stand, geladen, toegevoegd, oudeKoppeling };
}

/** De config entries van de integratie onder haar oude naam, smart_climate. */
async function oudeKoppelingen(): Promise<string[]> {
  try {
    const lijst = await client.query<{ entry_id?: unknown }[]>('config_entries/get', { domain: 'smart_climate' });
    return Array.isArray(lijst) ? lijst.map((x) => x.entry_id).filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/*
 * De integratie in Home Assistant (besluit 184): de add-on meldt zich aan bij
 * de Supervisor, met zijn adres in het netwerk van Home Assistant en de
 * sleutel. Home Assistant toont dan "Nieuw apparaat gevonden: SunArc",
 * als de integratie er staat. Alleen in de add-on.
 */
if (sleutel && version.installatie === 'add-on' && webPort != null && process.env['SUPERVISOR_TOKEN']) {
  void fetch('http://supervisor/discovery', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env['SUPERVISOR_TOKEN']}`, 'content-type': 'application/json' },
    body: JSON.stringify({ service: 'sunarc', config: { host: hostname(), port: webPort, sleutel } }),
  })
    .then((r) => {
      if (!r.ok) console.warn(`Aanmelden bij Home Assistant voor de integratie lukte niet (${r.status}).`);
    })
    .catch((error: unknown) => console.warn(`Aanmelden bij Home Assistant voor de integratie lukte niet: ${(error as Error).message}`));
}

/*
 * De assistent met één knop (besluit 202): neerzetten, Home Assistant
 * herstarten en de integratie toevoegen. Alleen in de add-on, met de sleutel
 * en de weg via de Supervisor; herstarten en toevoegen gaan niet via HaClient
 * (die schrijft alleen licht, scènes en schermen), maar hier, na een tik.
 */
const supervisorToken = process.env['SUPERVISOR_TOKEN'] ?? '';
/** Of de verbinding met Home Assistant er nu is: valt weg bij het herstarten, en komt terug met 'ready'. */
let haVerbonden = true;
client.on('ready', () => (haVerbonden = true));
client.on('disconnected', () => (haVerbonden = false));
const assistentAan = integratie && sleutel && webPort != null && supervisorToken
  ? new AssistentAan({
      zetNeer: () => integratie.zetNeer(),
      geladen: async () => {
        const s = await integratieStand();
        return s.geladen != null && s.geladen === s.nieuw;
      },
      toegevoegd: async () => (await integratieStand()).toegevoegd === true,
      herstart: async () => {
        // Home Assistant kijkt eerst of de configuratie klopt; tijdens het herstarten valt de verbinding weg.
        await fetch('http://supervisor/core/api/services/homeassistant/restart', { method: 'POST', headers: { authorization: `Bearer ${supervisorToken}`, 'content-type': 'application/json' }, body: '{}' }).catch(() => null);
      },
      wachtOpHerstart: () =>
        new Promise<void>((klaar, mis) => {
          const tot = Date.now() + 6 * 60_000;
          let weg = false;
          const kijk = async () => {
            if (Date.now() > tot) return mis(new Error('Home Assistant kwam niet terug na het herstarten'));
            // Eerst weg (de verbinding valt), dan terug met de integratie geladen.
            if (!weg && haVerbonden) return setTimeout(() => void kijk(), 1_000);
            weg = true;
            const s = haVerbonden ? await integratieStand().catch(() => null) : null;
            if (s?.geladen != null) return klaar();
            setTimeout(() => void kijk(), 3_000);
          };
          setTimeout(() => void kijk(), 2_000);
        }),
      voegToe: () => voegToeViaFlow('http://supervisor/core/api', supervisorToken, `http://${hostname()}:${webPort}`, sleutel),
      oudeKoppeling: async () => (await oudeKoppelingen()).length > 0,
      oudeWeg: async () => oudeWegViaRest('http://supervisor/core/api', supervisorToken, await oudeKoppelingen()),
      nu: () => Date.now(),
    })
  : null;

/** Klaarzetten in Home Assistant (besluit 179): tellen wat er staat, nooit een entiteit noemen. */
async function klaarPunten(lang?: Lang): Promise<KlaarPunt[]> {
  const prefs = (await client.query<{ energy_sources?: { type?: string }[] }>('energy/get_prefs').catch(() => null)) ?? null;
  // De instellingen zoals ze gelden, met wat de bewoner in de app koos (issue 144): niet alleen het bestand.
  const nu = siteConfig ?? baseConfig;
  const grid = nu?.power.gridPower;
  const netWaarde = grid ? Number(allStates.get(grid.id)?.state) : Number.NaN;
  const gevonden = functiesKeuzes();
  return klaarzetten({
    locatie: location != null,
    registers: houseRegisters,
    states: allStates,
    netMeter: Number.isFinite(netWaarde),
    zon: { heeft: nu?.solarProduction != null && Number.isFinite(Number(allStates.get(nu.solarProduction.id)?.state)), intervalS: solarPace.intervalS },
    energieDashboard: (prefs?.energy_sources ?? []).some((b) => b.type === 'grid'),
    apparatenOpZon: houseRegisters ? findAppliances(allStates, houseRegisters.entities, houseRegisters.devices).length + vindBuffers().length : 0,
    cameras: new Set((gevonden?.cameras ?? []).map((c) => c.naam)).size,
    deurbel: (gevonden?.melders ?? []).length > 0,
    rookmelders: houseRegisters ? vindRookmelders(houseRegisters.entities, houseRegisters.devices, allStates).length : 0,
    spraak: spraakLijst,
    addOn: version.installatie === 'add-on',
    eigenPoort: eigenPoort != null,
  }, lang);
}

/*
 * Klaarzetten per niveau (besluit 246): hoe Whisper en Tailscale ervoor staan,
 * gelezen bij de Supervisor (hassio_api, alleen lezen). Hooguit eens per vijf minuten;
 * undefined is nog niet gelezen of niet toegestaan.
 */
const addOnRedenen = new Set<string>();
let addOnsGelezen: { ms: number; whisper: AddOnInfo | null | undefined; tailscale: AddOnInfo | null } = { ms: 0, whisper: undefined, tailscale: null };
async function addOnStand(): Promise<typeof addOnsGelezen> {
  if (version.installatie !== 'add-on' || !supervisorToken || Date.now() - addOnsGelezen.ms < 5 * 60_000) return addOnsGelezen;
  const [whisper, tailscale] = await Promise.all(
    ['core_whisper', 'a0d7b954_tailscale'].map((slug) =>
      addOnInfo('http://supervisor', supervisorToken, slug, (reden) => {
        // Eén keer per reden in het logboek: zo is op de Pi te zien waarom lezen niet mag (2 november 2026).
        if (addOnRedenen.has(reden)) return;
        addOnRedenen.add(reden);
        console.warn(`Klaarzetten: ${slug} niet te lezen bij de Supervisor (${reden})`);
      }),
    ),
  );
  // Niet te lezen: undefined, zodat de stap zegt wat je zelf kiest. Er niet: null.
  addOnsGelezen = { ms: Date.now(), whisper: whisper == null ? undefined : whisper.er ? whisper : null, tailscale: tailscale ?? null };
  return addOnsGelezen;
}
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

/*
 * Back-up, herstel en opnieuw beginnen (besluit 151): alleen met een logmap,
 * en alleen voor de hoofdgebruiker. Zolang er niemand woont, een beheerder in
 * Home Assistant: anders kan niemand een back-up terugzetten op een nieuw huis.
 */
const sitesDir = startup.sitesDir ?? join(process.cwd(), 'config', 'sites');
/** Stopt met rekenen en schrijven, vóór het terugzetten of weghalen. */
function stilzetten(): void {
  runner?.stop();
  analyse?.stop();
}
/*
 * Zoeken naar updates (testerronde, november 2026). Home Assistant ziet een
 * nieuwe versie pas als de Supervisor de add-on-winkel opnieuw leest; anders
 * moest de bewoner bij Instellingen › Updates zelf zoeken. De eigen
 * update-entiteit laten verversen doet dat: een verversing die niet uit de
 * eigen planning komt, laat Home Assistant de winkel opnieuw lezen. Op een tik
 * van de beheerder, en vanzelf elke drie uur. Alleen in de add-on.
 */
async function zoekUpdates(): Promise<{ ok: boolean; reden?: string }> {
  const s = eigenUpdate(allStates.values());
  if (!s) return { ok: false, reden: 'Home Assistant kent de update van SunArc nog niet' };
  try {
    await client.callService('homeassistant', 'update_entity', {}, { entity_id: s.entity_id });
    return { ok: true };
  } catch (e) {
    return { ok: false, reden: (e as Error).message };
  }
}
if (version.installatie === 'add-on') {
  setInterval(() => void zoekUpdates().then((u) => u.ok || console.warn(`Zoeken naar updates: ${u.reden}`)), 3 * 3_600_000).unref();
}

/** Stopt de dienst; `run.sh` en Docker starten hem opnieuw. */
function herstart(): void {
  console.log('SunArc start opnieuw (besluit 151).');
  setTimeout(() => process.exit(OPNIEUW_STARTEN), 3_000);
  voorbeeld?.stop();
  void (web?.stop() ?? Promise.resolve()).finally(() => process.exit(OPNIEUW_STARTEN));
}
/** De instellingen en de apparaten voor de export (besluit 151), en welke namen eruit moeten. */
async function analyseVoorExport(): Promise<AnalyseExtra> {
  const nu = await maakBackup(logDir, site?.source ?? null, VERSIE);
  const bronnen: Record<string, unknown> = { configuratie: nu.configuratie?.inhoud ?? null, ...nu.bestanden, 'functies-nu': functiesNu() };
  const leesmij = [
    '# Export voor de analyse',
    '',
    `SunArc ${VERSIE} (${version.installatie}), gemaakt op ${new Date().toISOString()}.`,
    '',
    '- `decisions-*.ndjson`: per dag elk besluit van de arbiter, met de uitleg.',
    '- `history-*.ndjson`: per dag de ruwe standen waarmee een besluit opnieuw te nemen is.',
    '- `runs.ndjson`: welke versie wanneer draaide. `gevoel.ndjson`: wat bewoners aangaven.',
    '- `analyse/instellingen.json`: de configuratie en alles wat in de app is ingesteld of geleerd.',
    '- `analyse/entiteiten.json`: alle entiteiten uit Home Assistant met apparaat, ruimte en etage;',
    '  `gebruikt` zegt waar SunArc ze gebruikt, als pad in de configuratie of een instelling.',
    '',
    'Namen van bewoners zijn vervangen door "Bewoner 1", "Bewoner 2" (in een id `bewoner_1`).',
    'Een ligging (latitude, longitude) staat er niet in.',
    '',
  ].join('\n');
  return {
    bestanden: {
      'LEESMIJ.md': leesmij,
      'instellingen.json': `${JSON.stringify({ app: VERSIE, installatie: version.installatie, gemaakt: nu.gemaakt, configuratie: nu.configuratie, bestanden: nu.bestanden, functiesNu: functiesNu() }, null, 2)}\n`,
      'entiteiten.json': `${JSON.stringify(entiteitenLijst(houseRegisters, allStates, bronnen), null, 2)}\n`,
    },
    vervang: namenVoorExport(bewonersStore?.current ?? GEEN_BEWONERS, personenUit(allStates.values())),
  };
}
const gegevens =
  logDir === ''
    ? null
    : {
        hoofd: (wie: Wie) => {
          const hoofd = bewonersStore ? hoofdVan(bewonersStore.current) : null;
          return hoofd ? wie.userId != null && wie.userId === hoofd.haUser : wie.beheerder;
        },
        backup: () => maakBackup(logDir, site?.source ?? null, VERSIE),
        herstel: async (body: unknown) => {
          const gelezen = leesBackup(body, (c) => {
            const r = parseSiteConfig(c, { knownStrategies: strategies.ids });
            return r.ok ? null : `${r.problems[0]?.path ?? ''} ${r.problems[0]?.message ?? ''}`.trim();
          });
          if (!gelezen.ok) return { ok: false as const, status: 400, reden: gelezen.reden };
          try {
            // Eerst wat er nu is, zodat terugzetten zelf ook terug kan.
            await bewaarBackup(logDir, await maakBackup(logDir, site?.source ?? null, VERSIE));
            stilzetten();
            // In de add-on is de configuratie van de app zelf, net als bij opnieuw beginnen (besluit 151).
            const uit = await zetTerug(logDir, gelezen.backup, { configPad: site?.source ?? null, sitesDir, vervang: onboarding != null });
            console.log(`Back-up teruggezet (besluit 151): ${uit.bestanden.join(', ') || 'geen bestanden'}; configuratie ${uit.configuratie}`);
            return { ok: true as const, bestanden: uit.bestanden, configuratie: uit.configuratie };
          } catch (error) {
            // Halverwege mis: opnieuw starten met wat er staat, want de regeling staat al stil.
            console.error(`Terugzetten mislukt: ${String(error)}`);
            herstart();
            return { ok: false as const, status: 500, reden: 'terugzetten lukte niet helemaal; SunArc start opnieuw' };
          }
        },
        opnieuw: async () => {
          try {
            const naam = await bewaarBackup(logDir, await maakBackup(logDir, site?.source ?? null, VERSIE));
            stilzetten();
            const weg = await beginOpnieuw(logDir, { configPad: site?.source ?? null, configWeg: onboarding != null });
            console.log(`Opnieuw begonnen (besluit 151): ${weg.length} bestanden weg; de back-up staat in ${BACKUP_DIR}/${naam}`);
            return { ok: true as const, backup: naam, weg };
          } catch (error) {
            console.error(`Opnieuw beginnen mislukt: ${String(error)}`);
            herstart();
            return { ok: false as const, status: 500, reden: 'opnieuw beginnen lukte niet helemaal; SunArc start opnieuw' };
          }
        },
        configWeg: onboarding != null && site != null,
        bewaard: () => bewaardeBackups(logDir),
        analyse: analyseVoorExport,
        herstart,
      };

/*
 * Het voorbeeldhuis (besluit 237): een eigen proces, pas als iemand het opent.
 * Niet in dat proces zelf, en alleen met een gebouwde voorbeeldstart ernaast.
 */
const voorbeeldScript = join(dirname(fileURLToPath(import.meta.url)), 'voorbeeld', 'start.js');
const voorbeeld = !voorbeeldProces && webPort != null && existsSync(voorbeeldScript) ? new Voorbeeld({ script: voorbeeldScript, webDir, write: (r) => console.warn(r) }) : null;

if (webPort != null) {
  web = new WebServer({
    access,
    ...(voorbeeld ? { voorbeeld } : {}),
    ...(witgoed ? { witgoed } : {}),
    ...(eigenPoort ? { eigenPoort } : {}),
    ...(gegevens ? { gegevens } : {}),
    port: webPort,
    host: startup.web.host,
    webDir,
    config: site?.config ?? null,
    latest: () => runner?.latest ?? null,
    ...(analyse ? { divergence: () => analyse.latest } : {}),
    // Alleen wanneer er werkelijk gelogd wordt; anders geen exportknop.
    ...(logDir === '' ? {} : { logDir }),
    ...(onboarding
      ? {
          onboarding,
          // Het welkom in een leeg huis (besluit 154): het huis uit Home Assistant, en na het opslaan opnieuw starten.
          welkomHuis: () => (siteConfig == null && houseRegisters ? houseBeforeSetup(houseRegisters, houseStates, Intl.DateTimeFormat().resolvedOptions().timeZone) : null),
          naOnboarding: herstart,
        }
      : {}),
    location: () => location,
    // De precieze plek alleen na een tik op de kaart (besluit 254); niet bewaard.
    exacteLocatie: () =>
      client.query<HaCoreConfig>('get_config').then((c) => (typeof c.latitude === 'number' && typeof c.longitude === 'number' ? { latDeg: c.latitude, lonDeg: c.longitude } : null)),
    historie: historieVan,
    laadbeurten: (auto: string) => laadbeurten.van(auto),
    laadadvies: laadadviezen,
    // De fasekaart (besluit 302): alleen lezen.
    fasen: fasenNuView,
    // De thuisaccu's (besluit 272): wat ze nu doen, en hun tellers voor Opbrengst.
    accu: {
      nuW: accuNuW,
      meters: () => {
        const lijst = houseRegisters ? accusNu(laadReg(houseRegisters), allStates, connectionStore?.current?.laden ?? null, connectionStore?.current?.accu ?? null) : [];
        return {
          geladen: lijst.flatMap((a) => (a.sensoren.geladen ? [a.sensoren.geladen] : [])),
          geleverd: lijst.flatMap((a) => (a.sensoren.geleverd ? [a.sensoren.geleverd] : [])),
        };
      },
    },
    // Laden met de hand (besluit 262): alleen in de add-on; de NAS laat het blad zonder knoppen zien.
    ...(laadhand
      ? {
          laden: {
            standen: async () => (await Promise.all((huisNu('nl')?.opslag?.autos ?? []).map((a) => laadhand.stand(a.id)))).filter((x) => x != null),
            zet: (id: string, v: Parameters<Laadhand['zet']>[1]) => laadhand.zet(id, v),
            terug: (id: string) => laadhand.terugNu(id),
          },
        }
      : {}),
    // Een slimme stekker met de hand (besluit 265): de stand overal, schakelen alleen in de add-on.
    // Een laadpaal uit losse sensoren (besluit 301): de keuzes in het eigen bestand van de schakelaars.
    losseLaadpalen: {
      lijst: () => ({ laadpalen: schakelaarStore?.current?.laadpalen ?? {}, sensoren: houseRegisters ? losseSensoren(houseRegisters.entities, allStates) : [] }),
      bewaar: async (body: unknown) => {
        if (!schakelaarStore) return { ok: false as const, reden: 'er is geen map om de keuze te bewaren' };
        const l = leesLosseLaadpaal(body);
        if (!l.ok) return l;
        await schakelaarStore.save(metLaadpaal(schakelaarStore.current, l.id, l.laadpaal));
        return { ok: true as const };
      },
    },
    // Het kinderslot in het blad (besluit 299): zien overal, zetten alleen in de add-on.
    kinderslot: {
      lijst: () => kinderslotten(),
      ...(inHuisMetDeuren
        ? {
            zet: async (slot: string, aan: boolean) => {
              if (!Object.values(kinderslotten()).some((s) => s.id === slot)) return { ok: false as const, reden: 'dat is geen kinderslot dat het huis kent' };
              try {
                await client.callService('switch', aan ? 'turn_on' : 'turn_off', {}, { entity_id: slot });
                return { ok: true as const };
              } catch (e) {
                return { ok: false as const, reden: `Home Assistant nam het niet aan: ${(e as Error).message}` };
              }
            },
          }
        : {}),
    },
    schakelaars: {
      lijst: () => schakelaarViews(vindSchakelaarsNu(), schakelaarKeuzes(), allStates),
      bewaar: async (body) => {
        if (!schakelaarStore) return { ok: false as const, reden: 'er is geen map om de keuze te bewaren' };
        const k = leesSchakelaarKeuze(body);
        if (!k.ok) return k;
        if (!vindSchakelaarsNu().some((g) => g.id === k.id) && k.keuze !== 'weg') return { ok: false as const, reden: 'die schakelaar kent het huis niet' };
        await schakelaarStore.save(metKeuze(schakelaarStore.current, k.id, k.keuze));
        return { ok: true as const };
      },
      // Met de hand aan of uit (besluit 297): alleen in de add-on, alleen een knop die de bewoner toeliet.
      ...(inHuisMetDeuren
        ? {
            zet: async (knop: string, aan: boolean) => {
              if (!schakelaarsMag(vindSchakelaarsNu(), schakelaarKeuzes()).includes(knop)) return { ok: false as const, reden: 'deze schakelaar mag SunArc niet bedienen' };
              try {
                await client.callService('switch', aan ? 'turn_on' : 'turn_off', {}, { entity_id: knop });
                return { ok: true as const };
              } catch (e) {
                return { ok: false as const, reden: `Home Assistant nam het niet aan: ${(e as Error).message}` };
              }
            },
          }
        : {}),
    },
    stekkers: {
      standen: async () =>
        (await stekkerhand.standen(inHuisMetDeuren)).map((s) => {
          const gehad = bufferStore?.aanGehad(s.id) ?? null;
          const min = (siteConfig?.heatStores ?? []).find((h) => h.id === s.id)?.minimum;
          return { ...s, zon: stekkerZon.stand(s.id), ...(min ? { minimum: { minuten: min.minutes, klok: min.by } } : {}), ...(gehad != null ? { gehadMin: gehad } : {}) };
        }),
      ...(inHuisMetDeuren ? { zet: (id: string, aan: boolean, tot: StekkerTot) => stekkerhand.zet(id, aan, tot), terug: (id: string) => stekkerhand.terugNu(id), uit: (id: string) => stekkerhand.uitNu(id) } : {}),
    },
    dakenOpbrengst,
    sluipverbruik,
    house: houseReport,
    ...(lightSwitch ? { lights: lightSwitch } : {}),
    ...(coverSwitch ? { covers: coverSwitch } : {}),
    ...(klimaatBrug ? { klimaat: { brug: klimaatBrug, aan: klimaatAan } } : {}),
    ...(handbediening ? { hand: { hand: handbediening, aan: klimaatAan, schakelaars: handSchakelaars, knoppen: handKnoppen } } : {}),
    verstaanInHuis: () => kiesVerstaan([...allStates.keys()]),
    ...(layoutStore && siteConfig
      ? {
          layout: {
            store: layoutStore,
            proposal: () => (houseRegisters ? proposeLayout(siteConfig!, houseRegisters, houseStates) : null),
          },
        }
      : {}),
    // Gevoel en toelichting (besluit 84): alleen als er gelogd wordt, want ze
    // horen bij de dataset, en alleen naar een eigen bestand in de logmap.
    ...(logDir !== '' && site
      ? { feedback: new FeedbackLog({ logDir, zoneIds: () => (siteConfig ?? site.config).zones.map((z) => z.id) }) }
      : {}),
    ...(uitstelStore ? { uitstel: uitstelStore } : {}),
    ...(bufferStore ? { buffers: bufferStore } : {}),
    ...(meldingen ? { meldingen } : {}),
    ...(voorkeuren ? { voorkeuren } : {}),
    deurbel: deurbelNu,
    cameras: camerasLijst,
    // Meldingen op de telefoon (besluit 183): welke telefoons er zijn, en een proefmelding.
    telefoons: (userId: string | null) => telefoons().map((t) => ({ id: t.id, naam: t.naam, eigen: userId != null && t.account === userId })),
    proefmelding,
    ...(integratie ? { integratie: { stand: integratieStand, zetNeer: () => integratie.zetNeer(), ...(assistentAan ? { aanzetten: { stand: () => assistentAan.stand, start: () => void assistentAan.start() } } : {}) } } : {}),
    ...(stemInHuis ? { stemInHuis: { stand: () => stemInHuis.stand(), start: (lang: Lang) => void stemInHuis.start(lang) } } : {}),
    // Het profiel (besluit 181): de bewoners op volgorde en wiens comfort geldt, voor de wand en de kleuren.
    ...(voorkeuren && bewonersStore
      ? {
          profielen: (userId: string | null) => profielenVan(bewonersStore.current, runner?.latest?.explanation.profile?.id ?? null, userId),
        }
      : {}),
    ...(scenePictures ? { scenePicturesDir: scenePictures.dir } : {}),
    // De zon en je aansluiting (besluit 103): alleen met een logmap en een configuratie.
    ...(connectionStore && baseConfig ? { connection: connectionDoor(connectionStore, baseConfig) } : {}),
    // Wat de app laat zien, heet zoals in de indeling (besluit 131).
    configNow: webConfig,
    ...(comfortStore && siteConfig
      ? {
          comfort: {
            view: (wie: Wie, bewoner: string | null) => comfortVoor(wie, bewoner).view,
            save: async (body: unknown, wie: Wie, bewoner: string | null) => {
              const doel = comfortVoor(wie, bewoner);
              if (!doel.view.van?.magAanpassen && doel.view.van != null) return { ok: false as const, status: 403, reden: 'alleen je eigen comfort, of als hoofdgebruiker' };
              const check = controleerComfort(body, siteConfig!);
              if (!check.ok) return { ok: false as const, status: 400, reden: check.reden };
              const huidig = comfortStore.current;
              const b = bewonersStore?.current ?? GEEN_BEWONERS;
              let comfort: Comfort;
              let bewoners = b;
              if (doel.id == null || doel.id === hoofdVan(b)?.id) {
                // Het comfort van het huis, van de hoofdgebruiker; de eigen comforts blijven.
                // Bijspringen (besluit 283) komt van Regeling, niet van deze pagina: dat blijft ook.
                comfort = { ...check.comfort, ...(huidig?.profielen ? { profielen: huidig.profielen } : {}), ...(huidig?.bijspringen ? { bijspringen: huidig.bijspringen } : {}), ...(huidig?.helpen ? { helpen: huidig.helpen } : {}) };
              } else {
                // Een eigen comfort (besluit 147): alleen de doelen en het plafond per kamer.
                const eigen: Record<string, ComfortRoom> = Object.fromEntries(Object.entries(check.comfort.kamers).map(([k, v]) => [k, { modi: v.modi, ...(v.nooitWarmerC !== undefined ? { nooitWarmerC: v.nooitWarmerC } : {}) }]));
                comfort = { ...(huidig ?? { versie: 1, kamers: {} }), profielen: { ...huidig?.profielen, [doel.id]: eigen } };
                bewoners = { ...b, bewoners: { ...b.bewoners, [doel.id]: { ...b.bewoners[doel.id]!, comfort: 'eigen' } } };
              }
              const met = await configWithComfort(comfort, bewoners);
              if (!met.ok) return { ok: false as const, status: 400, reden: `past niet in de regeling: ${met.reden}` };
              if (runner && !runner.setConfig(met.config, allStates.values())) return { ok: false as const, status: 409, reden: 'de regeling kon het niet overnemen; het gaat in na de volgende start' };
              await comfortStore.save(comfort);
              if (bewoners !== b) await bewonersStore!.save(bewoners);
              siteConfig = met.config;
              return { ok: true as const, view: comfortVoor(wie, doel.id).view };
            },
          },
          // Helpen bij de cv (besluit 292): van het huis, net als bijspringen.
          helpen: {
            view: () => helpenView(siteConfig!, runner?.latest ?? null, helpenDag, Date.now()),
            save: async (body: unknown) => {
              const check = controleerHelpen(body, siteConfig!);
              if (!check.ok) return { ok: false as const, status: 400, reden: check.reden };
              const huidig = comfortStore.current ?? { versie: 1 as const, kamers: {} };
              const comfort: Comfort = { ...huidig, helpen: check.waarde };
              const met = await configWithComfort(comfort);
              if (!met.ok) return { ok: false as const, status: 400, reden: `past niet in de regeling: ${met.reden}` };
              if (runner && !runner.setConfig(met.config, allStates.values())) return { ok: false as const, status: 409, reden: 'de regeling kon het niet overnemen; het gaat in na de volgende start' };
              await comfortStore.save(comfort);
              siteConfig = met.config;
              return { ok: true as const, view: helpenView(met.config, runner?.latest ?? null, helpenDag, Date.now()) };
            },
          },
          // Bijspringen per kamer (besluit 283): van het huis, dus wie het comfort van het huis mag aanpassen.
          bijspringen: {
            view: () => bijspringenView(siteConfig!),
            // Wie mag, toetst de route: de beheerder, net als de rest van Regeling.
            save: async (body: unknown) => {
              const check = controleerBijspringen(body, siteConfig!);
              if (!check.ok) return { ok: false as const, status: 400, reden: check.reden };
              const huidig = comfortStore.current ?? { versie: 1 as const, kamers: {} };
              const comfort: Comfort = { ...huidig, bijspringen: { ...huidig.bijspringen, [check.zone]: check.waarde } };
              const met = await configWithComfort(comfort);
              if (!met.ok) return { ok: false as const, status: 400, reden: `past niet in de regeling: ${met.reden}` };
              if (runner && !runner.setConfig(met.config, allStates.values())) return { ok: false as const, status: 409, reden: 'de regeling kon het niet overnemen; het gaat in na de volgende start' };
              await comfortStore.save(comfort);
              siteConfig = met.config;
              return { ok: true as const, view: bijspringenView(met.config) };
            },
          },
        }
      : {}),
    ...(bewonersStore && siteConfig
      ? {
          bewoners: {
            view: (wie: Wie) => bewonersView(bewonersStore.current, wie, siteConfig!.occupancy, (id) => allStates.get(id), runner?.latest?.explanation.profile ?? null),
            actie: async (body: unknown, wie: Wie & { readonly naam: string }) => {
              const a = leesActie(body);
              if (a == null) return { ok: false as const, status: 400, reden: 'dat is geen actie die de app kent' };
              const thuis = runner?.latest?.explanation.profile?.home ?? [];
              const bronAccount = (id: string) => { const o = siteConfig!.occupancy.find((x) => x.id === id); return o ? persoonsAccount(o, (e) => allStates.get(e)) : null; };
              const uit = voerUit(bewonersStore.current, comfortStore?.current ?? null, a, wie, siteConfig!.occupancy, thuis, Date.now(), bronAccount);
              if (!uit.ok) return uit;
              const comfort = uit.comfort !== undefined ? uit.comfort : (comfortStore?.current ?? null);
              const met = await configWithComfort(comfort, uit.bewoners);
              if (!met.ok) return { ok: false as const, status: 400, reden: `past niet in de regeling: ${met.reden}` };
              if (runner && !runner.setConfig(met.config, allStates.values())) return { ok: false as const, status: 409, reden: 'de regeling kon het niet overnemen; het gaat in na de volgende start' };
              if (uit.comfort !== undefined && uit.comfort != null) await comfortStore?.save(uit.comfort);
              await bewonersStore.save(uit.bewoners);
              siteConfig = met.config;
              return { ok: true as const, view: bewonersView(uit.bewoners, wie, siteConfig.occupancy, (id) => allStates.get(id), runner?.latest?.explanation.profile ?? null) };
            },
            herken: async (account: { readonly userId: string; readonly naam: string }) => {
              const r = herkenBewoner(bewonersStore.current, account, personenUit(allStates.values()), siteConfig!.occupancy, Date.now());
              if (r.soort === 'vraag') return 'vraag' as const;
              // Zonder persoon in Home Assistant een gast (besluit 151); de hoofdgebruiker kan er een bewoner van maken.
              if (r.soort === 'gast') {
                await bewonersStore.save(r.bewoners);
                return 'gast' as const;
              }
              if (r.soort !== 'bewoner' || !r.nieuw) return null;
              await bewonersStore.save(r.bewoners);
              await herlaadUitDeApp('een nieuwe bewoner');
              return 'welkom' as const;
            },
            // Een gast (besluit 147): thuis volgens zijn aanwezigheid in Home Assistant.
            gast: (userId: string | null) => gastStand(bewonersStore.current, userId, siteConfig!.occupancy, (id) => allStates.get(id)),
          },
        }
      : {}),
    ...(sleutel ? { sleutel } : {}),
    // Klaarzetten in Home Assistant (besluit 179): tellen wat er staat, nooit een entiteit noemen.
    klaarzetten: (lang?: Lang) => klaarPunten(lang),
    // Klaarzetten per niveau (besluit 246): per functie de stappen, met wat de wand zelf meldt.
    klaarFuncties: async (punten: readonly KlaarPunt[], lang?: Lang) => {
      const [inHuis, addons] = await Promise.all([stemInHuis ? stemInHuis.stand().catch(() => null) : null, addOnStand()]);
      const niemand = voorkeuren?.niemand() ?? null;
      const taal = lang ?? 'nl';
      return klaarFuncties(punten, {
        addOn: version.installatie === 'add-on',
        eigenPoort: eigenPoort != null,
        eigenSlug,
        inHuis,
        whisperModel: addons.whisper === undefined ? undefined : addons.whisper == null ? null : typeof addons.whisper.opties['model'] === 'string' ? addons.whisper.opties['model'] : null,
        tailscale: addons.tailscale == null ? null : addons.tailscale.draait,
        wand: wandMelding,
        heeftWand: wandMelding != null || Object.keys(bewonersStore?.current.schermen ?? {}).length > 0,
        schermUit: niemand != null && (niemand.nacht || niemand.weg),
        wekker: niemand?.melder ?? null,
        wolken: wolkenVan(houseRegisters?.entities ?? []),
        spraak: spraakLijst,
        tijd: (ms) => new Intl.DateTimeFormat(taal === 'en' ? 'en-GB' : 'nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: weerZone }).format(new Date(ms)),
      }, lang);
    },
    // De wand meldt zelf of hij in Fully Kiosk draait (besluit 246); bewaard naast het logboek.
    wandMeldt: (m: Omit<WandMelding, 'ms'>) => {
      wandMelding = { ...m, ms: Date.now() };
      if (WAND_BESTAND) void writeFile(WAND_BESTAND, `${JSON.stringify(wandMelding)}\n`, 'utf-8').catch(() => undefined);
    },
    // In de add-on stelt Home Assistant de vraag rechtstreeks aan de add-on, op zijn naam in het netwerk (besluit 177).
    ...(sleutel && version.installatie === 'add-on' && webPort != null ? { sleutelAdres: `http://${hostname()}:${webPort}/api/vraag` } : {}),
    ...(weatherLog ? { weather: { forecast: forecastNow, log: weatherLog, bron: weerNaam, uren: () => openMeteo.latest?.uren ?? null } } : {}),
    // De stem van het huis (besluit 141): Piper in Home Assistant; er wordt niets geschakeld.
    stem: new Stem({
      base: httpBase(url!),
      token: token!,
      // De stem die de bewoner koos bij Functies (besluit 212); null is vanzelf.
      keuze: () => {
        const f = functiesNu();
        return f ? volledig(f, functiesKeuzes()).praten.stemKeuze : null;
      },
      stemmen: () => [...allStates.keys()].filter((id) => id.startsWith('tts.')),
      // Welke talen en stemmen Piper heeft: lezen, zoals de registers.
      talen: async (stem) => {
        const r = await client.query<{ providers?: { engine_id: string; supported_languages?: string[] }[] }>('tts/engine/list');
        return r.providers?.find((p) => p.engine_id === stem)?.supported_languages ?? [];
      },
      stemmenVoor: async (stem, taal) => (await client.query<{ voices?: { voice_id: string; name: string }[] | null }>('tts/engine/voices', { engine_id: stem, language: taal })).voices ?? [],
    }),
    // Bijwerken vanuit de app (21 oktober 2026): alleen in de add-on.
    ...(version.installatie === 'add-on'
      ? {
          bijwerken: {
            view: updateNu,
            installeer: async () => {
              const s = eigenUpdate(allStates.values());
              if (!s || s.state !== 'on') return { ok: false, reden: 'er staat geen nieuwe versie klaar' };
              if (s.attributes['in_progress'] === true) return { ok: true };
              // Niet wachten: de Supervisor start de add-on opnieuw, en dan valt de verbinding weg.
              void client.callService('update', 'install', {}, { entity_id: s.entity_id }).catch((e: unknown) => console.warn(`Bijwerken: ${(e as Error).message}`));
              return { ok: true };
            },
            zoek: zoekUpdates,
          },
        }
      : {}),
    // Opnieuw starten (testerronde, november 2026): een keuze bij Energie gaat pas bij de start in.
    herstart,
    // Deel apparaatgegevens (testerronde, november 2026): alleen het soort apparaat, geen namen.
    apparaatGegevens: (id) => (houseRegisters ? apparaatGegevens(id, allStates, houseRegisters.entities, houseRegisters.devices) : null),
    // De stand (besluit 287): welke knop het huis op Handmatig zet, en sinds wanneer het vakantie is.
    toestand: (id) => {
      const s = allStates.get(id);
      if (!s) return null;
      const naam = s.attributes['friendly_name'];
      const sinds = Date.parse(s.last_changed);
      return { state: s.state, naam: typeof naam === 'string' ? naam : null, sindsMs: Number.isFinite(sinds) ? sinds : null };
    },
    // De camera's bekijken (besluit 106): alleen lezen, alleen met inlog.
    camera: {
      base: httpBase(url!),
      token: token!,
      // De camera's die de app toont, en die van de deurbel (besluit 109).
      ids: () => {
        const f = functiesNu();
        return new Set(f ? [...getoondeCameras(f), ...(f.deurbel.aan && f.deurbel.camera ? [f.deurbel.camera, ...reserveBeelden(f.deurbel.camera)] : [])] : []);
      },
    },
    ...(functiesStore ? { functies: { store: functiesStore, gevonden: functiesKeuzes } } : {}),
    // Licht bedienen aan of uit in de app (besluit 111), binnen wat HEMS_LIGHTS toestaat.
    lichtAan: () => {
      const f = functiesNu();
      return f ? volledig(f, functiesKeuzes()).licht.bedienen : true;
    },
    // Schermen bedienen aan of uit in de app (besluit 121), binnen wat HEMS_SCREENS toestaat.
    schermenAan: () => {
      const f = functiesNu();
      return f ? volledig(f, functiesKeuzes()).schermen.bedienen : true;
    },
    // Praten met je stem (besluit 150): geluid naar Home Assistant, tot tekst.
    luisteren: {
      start: (opts) => client.listen(opts),
      pipeline: () => {
        const f = functiesNu();
        return f ? volledig(f, functiesKeuzes()).praten.spraak : null;
      },
      wekwoord: wekwoordNu,
      // Rechtstreeks uitschrijven met Whisper in huis (besluit 211); zonder spraak naar tekst in huis via de spraakassistent.
      uitschrijven: () => {
        const e = kiesVerstaan([...allStates.keys()]);
        return e ? (pcm, lang) => verstaan.tekst(e, pcm, lang) : null;
      },
    },
    // Praten met je huis (besluit 148): de AI-taak die bij Functies gekozen is, standaard uit.
    // Te doen (besluit 216): herinneringen, de lijsten en agenda's van Home Assistant.
    tedoen: teDoen,
    praten: {
      model: () => {
        const f = functiesNu();
        const id = f ? volledig(f, functiesKeuzes()).praten.taalmodel : null;
        return id && allStates.has(id) ? pauzeVan(id).om(modelTeller.om((opdracht, velden) => client.generateData(id, opdracht, velden))) : null;
      },
      proef: (id) => pauzeVan(id).om(modelTeller.om((opdracht, velden) => client.generateData(id, opdracht, velden))),
      // Hoeveel vragen en hoe snel (besluit 213), voor Functies.
      teller: () => modelTeller.stand(),
      // Te traag voor eigen woorden: dan meteen het vaste antwoord, in plaats van wachten.
      eigenWoorden: () => modelTeller.eigenWoordenNu(WACHT_MS),
      // Na "gebruik op" of "te druk" even niet vragen, per AI-taak (besluit 148).
      pauze: (id) => pauzeVan(id).stand,
      bedienen: () => {
        const f = functiesNu();
        return f ? volledig(f, functiesKeuzes()).praten.bedienen : true;
      },
    },
    // Opbrengst (besluit 102): meters en prijzen naast de dataset, de cijfers uit Home Assistant.
    ...(energyStore ? {
          energy: {
            store: energyStore,
            naBewaren: () => herlaadUitDeApp('andere prijzen'),
            source: haEnergySource(
              client,
              (id) => allStates.get(id),
              (id) => houseRegisters?.entities.find((e) => e.entity_id === id)?.platform ?? null,
              () => allStates.values(),
              // Opgewekt uit de omvormers (5 november 2026); een meetpunt met een attribuut heeft geen statistiek.
              () => (siteConfig?.solarProduction ? [siteConfig.solarProduction, ...(siteConfig.solarExtra ?? [])].filter((p) => !p.attribute).map((p) => p.id) : []),
            ),
          },
        } : {}),
    version,
  });
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
