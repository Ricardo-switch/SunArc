/**
 * De configuratie bij het starten (uit main.ts, 23 november 2026): het bestand lezen en controleren, en daarover wat de
 * app eraan toevoegt dat bij het starten al vaststaat: de aansluiting (besluit 103) en meten met (besluit 123). Comfort
 * en bewoners komen daarna in main.ts, omdat die bij elke wijziging opnieuw gaan.
 */
import { readFile } from 'node:fs/promises';
import { ConfigError, loadSiteConfig } from '../config/load.js';
import { parseSiteConfig } from '../config/schema.js';
import { ConnectionStore, withConnection, type Applied } from '../web/aansluiting.js';
import { regelKamers } from '../web/layout.js';
import { noteSensors, readLayoutFile, withMeasurement } from '../web/meten.js';
import type { readStartup } from '../startup.js';
import type { defaultStrategies } from '../index.js';

export interface ConfigBijStart {
  /** De configuratie met de aansluiting en meten met erover, of niets in een lege installatie. */
  readonly site: Awaited<ReturnType<typeof loadSiteConfig>> | undefined;
  /** De configuratie zoals het bestand zegt, zonder wat de app eraan toevoegt. */
  readonly baseConfig: NonNullable<Awaited<ReturnType<typeof loadSiteConfig>>>['config'] | null;
  readonly connectionStore: ConnectionStore | null;
  readonly answersAtStart: Awaited<ReturnType<ConnectionStore['load']>> | null;
  readonly connectionApplied: Pick<Applied, 'toegevoegd' | 'overgeslagen'>;
  readonly layoutAtStart: Awaited<ReturnType<typeof readLayoutFile>>;
}

export async function configBijStart(startup: ReturnType<typeof readStartup>, strategies: ReturnType<typeof defaultStrategies>, logDir: string): Promise<ConfigBijStart> {
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
      const metMeten = withMeasurement(metAansluiting, layoutAtStart ? { kamers: regelKamers(layoutAtStart.kamers) } : null);
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
  return { site, baseConfig, connectionStore, answersAtStart, connectionApplied, layoutAtStart };
}
