/**
 * Het begin van de dienst (uit main.ts): het logboek voor meldingen, `.env`, de vlaggen die zonder
 * Home Assistant draaien (--make-winter, --benchmark, --check-config), de omgeving (besluit 55), het token, --discover,
 * en wat daaruit volgt voor de rest: de poort, de map van de weergave en of de deuren open staan. main.ts importeert
 * dit als eerste eigen stuk, na de modules; het draait dus op hetzelfde moment als toen het daar stond.
 */

import { installeerLogboek } from '../web/logboek.js';
import { resolve, dirname, join } from 'node:path';
import { loadDotEnv, tokenComplaint } from '../env.js';
import { loadSiteConfig, ConfigError } from '../config/load.js';
import { defaultStrategies } from '../index.js';
import { readStartup } from '../startup.js';
import { defaultWebDir } from '../web/server.js';

// De laatste waarschuwingen en fouten, om te delen bij een melding.
installeerLogboek();


// De map van het pakket (backend/): dit bestand staat in src/start of dist/start, twee mappen dieper.
const packageRoot = resolve(dirname(new URL(import.meta.url).pathname), '..', '..');
const candidates = [resolve(process.cwd(), '.env'), join(packageRoot, '.env')];
export const loadedFrom = candidates.find((file) => loadDotEnv(file));

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
  const { makeWinter } = await import('../web/makeWinter.js');
  process.exit(await makeWinter(days, source, target));
}

if (process.argv.includes('--benchmark')) {
  const i = process.argv.indexOf('--benchmark');
  const dir = process.argv[i + 1] ?? process.env['SHADOW_LOG_DIR'] ?? 'data/shadow';
  const { benchmark } = await import('../web/benchmark.js');
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
export const startup = readStartup(process.env);
export const { asAddon } = startup;
export const { url, token } = startup.ha;
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
  const { discoverCli } = await import('../adapters/homeassistant/discoverCli.js');
  process.exit(await discoverCli({ url: url!, token: token!, target }));
}

export const { tickSeconds, logDir } = startup;

/*
 * De webweergave staat standaard uit.
 *
 * Deze dienst houdt het HA-token vast en draait maanden onbewaakt. Luisteren
 * is dus een keuze die je maakt, niet iets wat je overkomt door hem te
 * starten. De compose op de NAS zet de poort; een losse `npm run shadow`
 * blijft dicht.
 */
export const webPort = startup.web.port;
export const webDir = startup.web.dir ?? defaultWebDir(packageRoot);

/*
 * Het voorbeeldhuis (besluit 237) draait deze dienst in een eigen proces, op een
 * nagemaakt Home Assistant. De deuren die in de add-on open staan (meldingen,
 * lijsten, de klimaatbrug, met de hand) staan daar ook open: ze gaan naar het
 * nagemaakte huis. Op een eigen server zet `HEMS_DEUREN=1` ze open (besluit 309).
 */
export const voorbeeldProces = process.env['HEMS_VOORBEELD'] === '1';
export const inHuisMetDeuren = startup.deuren.enabled || voorbeeldProces;
