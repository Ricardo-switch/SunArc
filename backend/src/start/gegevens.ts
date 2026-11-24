/**
 * Back-up, herstel en opnieuw beginnen (uit main.ts, 24 november 2026; besluit 151), en zoeken naar een nieuwe versie
 * van de add-on. Alleen verhuisd, niets veranderd.
 */
import { startup, logDir } from './begin.js';
import { join } from 'node:path';
import { eigenUpdate } from '../web/bijwerken.js';
import { OPNIEUW_STARTEN, maakBackup, leesBackup, bewaarBackup, zetTerug, beginOpnieuw, BACKUP_DIR, bewaardeBackups } from '../web/gegevens.js';
import { type AnalyseExtra, entiteitenLijst } from '../web/export.js';
import { VERSIE } from '../version.js';
import { namenVoorExport, GEEN_BEWONERS, personenUit, type Wie, hoofdVan } from '../web/bewoners.js';
import { parseSiteConfig } from '../config/schema.js';
import type { MaakGegevensNodig } from '../main.js';

export function maakGegevens(nodig: MaakGegevensNodig) {
  const {
    allStates, analyse, bewonersStore, client, functiesNu, onboarding, runner, strategies, version,
  } = nodig;
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
    nodig.voorbeeld?.stop();
    void (nodig.web?.stop() ?? Promise.resolve()).finally(() => process.exit(OPNIEUW_STARTEN));
  }
  /** De instellingen en de apparaten voor de export (besluit 151), en welke namen eruit moeten. */
  async function analyseVoorExport(): Promise<AnalyseExtra> {
    const nu = await maakBackup(logDir, nodig.site?.source ?? null, VERSIE);
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
        'entiteiten.json': `${JSON.stringify(entiteitenLijst(nodig.houseRegisters, allStates, bronnen), null, 2)}\n`,
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
          backup: () => maakBackup(logDir, nodig.site?.source ?? null, VERSIE),
          herstel: async (body: unknown) => {
            const gelezen = leesBackup(body, (c) => {
              const r = parseSiteConfig(c, { knownStrategies: strategies.ids });
              return r.ok ? null : `${r.problems[0]?.path ?? ''} ${r.problems[0]?.message ?? ''}`.trim();
            });
            if (!gelezen.ok) return { ok: false as const, status: 400, reden: gelezen.reden };
            try {
              // Eerst wat er nu is, zodat terugzetten zelf ook terug kan.
              await bewaarBackup(logDir, await maakBackup(logDir, nodig.site?.source ?? null, VERSIE));
              stilzetten();
              // In de add-on is de configuratie van de app zelf, net als bij opnieuw beginnen (besluit 151).
              const uit = await zetTerug(logDir, gelezen.backup, { configPad: nodig.site?.source ?? null, sitesDir, vervang: onboarding != null });
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
              const naam = await bewaarBackup(logDir, await maakBackup(logDir, nodig.site?.source ?? null, VERSIE));
              stilzetten();
              const weg = await beginOpnieuw(logDir, { configPad: nodig.site?.source ?? null, configWeg: onboarding != null });
              console.log(`Opnieuw begonnen (besluit 151): ${weg.length} bestanden weg; de back-up staat in ${BACKUP_DIR}/${naam}`);
              return { ok: true as const, backup: naam, weg };
            } catch (error) {
              console.error(`Opnieuw beginnen mislukt: ${String(error)}`);
              herstart();
              return { ok: false as const, status: 500, reden: 'opnieuw beginnen lukte niet helemaal; SunArc start opnieuw' };
            }
          },
          configWeg: onboarding != null && nodig.site != null,
          bewaard: () => bewaardeBackups(logDir),
          analyse: analyseVoorExport,
          herstart,
        };
  return { gegevens, herstart, zoekUpdates };
}
