/**
 * De assistent in Home Assistant (uit main.ts, 23 november 2026; besluiten 177, 202, 241): de sleutel, de integratie
 * SunArc, de add-ons voor spraak, en wat Klaarzetten nog mist. Alleen verhuisd.
 */
import { logDir, webPort } from './begin.js';
import { leesOfMaakSleutel } from '../web/auth.js';
import { join } from 'node:path';
import { Integratie } from '../web/integratie.js';
import { hostname } from 'node:os';
import { AssistentAan, voegToeViaFlow, oudeWegViaRest } from '../web/assistent-aan.js';
import { type Lang } from '../web/assistant.js';
import { type KlaarPunt, klaarzetten } from '../web/klaarzetten.js';
import { findAppliances } from '../web/aansluiting.js';
import { vindRookmelders } from '../web/rookmelders.js';
import { type AddOnInfo, addOnInfo } from '../web/stem-in-huis.js';
import type { MaakAssistentNodig } from '../main.js';

export async function maakAssistent(nodig: MaakAssistentNodig) {
  const {
    allStates, baseConfig, client, eigenPoort, functiesKeuzes, solarPace, version, vindBuffers,
  } = nodig;
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
    const nu = nodig.siteConfig ?? baseConfig;
    const grid = nu?.power.gridPower;
    const netWaarde = grid ? Number(allStates.get(grid.id)?.state) : Number.NaN;
    const gevonden = functiesKeuzes();
    return klaarzetten({
      locatie: nodig.location != null,
      registers: nodig.houseRegisters,
      states: allStates,
      netMeter: Number.isFinite(netWaarde),
      zon: { heeft: nu?.solarProduction != null && Number.isFinite(Number(allStates.get(nu.solarProduction.id)?.state)), intervalS: solarPace.intervalS },
      energieDashboard: (prefs?.energy_sources ?? []).some((b) => b.type === 'grid'),
      apparatenOpZon: nodig.houseRegisters ? findAppliances(allStates, nodig.houseRegisters.entities, nodig.houseRegisters.devices).length + vindBuffers().length : 0,
      cameras: new Set((gevonden?.cameras ?? []).map((c) => c.naam)).size,
      deurbel: (gevonden?.melders ?? []).length > 0,
      rookmelders: nodig.houseRegisters ? vindRookmelders(nodig.houseRegisters.entities, nodig.houseRegisters.devices, allStates).length : 0,
      spraak: nodig.spraakLijst,
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
  return { addOnStand, assistentAan, integratie, integratieStand, klaarPunten, sleutel, supervisorToken };
}
