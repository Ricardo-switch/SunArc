/**
 * De onboarding achter de weergave.
 *
 * Fase 6e stap 4. Stap 3 kan een installatie ontdekken, maar het antwoord
 * kwam in de terminal terecht — en wie een add-on installeert opent geen
 * terminal. Hier komt datzelfde voorstel op de pagina, met de twijfelgevallen
 * als keuzes, en wordt het na bevestiging weggeschreven.
 *
 * **Dit is de eerste plek waar de weergave iets schrijft.** Besluit 23 zei dat
 * dat een eigen besluit vraagt; zie besluit 42. De korte versie: schrijven mag
 * alleen wanneer we weten wie het vraagt, en dat weten we alleen achter
 * Ingress. Die grens ligt niet hier maar in `main.ts` — deze module wordt
 * simpelweg niet aangemaakt wanneer hij niet mag bestaan.
 *
 * **Wat er hier níet gebeurt.** De pagina stuurt geen JSON. Ze stuurt
 * antwoorden op vragen die deze kant heeft gesteld, en wat die antwoorden
 * betekenen voor de configuratie staat in `discovery.ts`. Zou de pagina de
 * configuratie zelf samenstellen, dan zou de vorm ervan op twee plekken
 * moeten kloppen — precies wat besluit 29 uit `mapping.ts` heeft gesloopt.
 */

import { access, mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  discover,
  applyChoices,
  type Choice,
  type Registers,
  type Proposal,
} from '../adapters/homeassistant/discovery.js';
import { parseSiteConfig } from '../config/schema.js';
import type { Lang } from './assistant.js';
import { perTaal } from '../taal/index.js';

/**
 * De vragen bij het begin in het Engels (besluit 185). De ontdekking stelt ze
 * in het Nederlands; hier krijgen ze per vaste id hun Engelse woorden. Een
 * vraag die hier niet staat, blijft zoals hij is.
 */
const VRAGEN_EN: Readonly<Record<string, { readonly vraag: (c: Choice) => string; readonly toelichting: string }>> = {
  outdoorTemperature: {
    vraag: () => 'Which sensor measures the outdoor temperature?',
    toelichting: 'The control does not use it; it goes into the log so the dataset is complete. You may skip this.',
  },
  zoneTemperatuur: {
    vraag: (c) => `Which thermometer applies to ${c.naam ?? c.zoneId ?? 'this room'}?`,
    toelichting: 'The control works on this, so it must be the room and not a device.',
  },
  dubbelApparaat: {
    vraag: () => 'Which of these two controls this device?',
    toelichting: 'They look like the same device through two integrations. Keeping both means commanding the same device twice; the other is left out.',
  },
  gridPower: {
    vraag: () => 'Which sensor measures what comes from the grid?',
    toelichting: 'It should go negative when you export. If it does not, the whole surplus is wrong. Without a meter, pv-surplus does not take part.',
  },
  solarProduction: {
    vraag: () => 'Which sensor measures what your panels deliver?',
    toelichting: 'The control does not use it. It goes into the log as a measure of sunlight, so that later it can be worked out how much the sun warms a room. You may skip this.',
  },
};

/** De keuzes in de taal van de app: dezelfde opties, de vraag en de uitleg in die taal. */
export function keuzesInTaal(keuzes: readonly Choice[], lang: Lang): Choice[] {
  if (lang === 'nl') return [...keuzes];
  return keuzes.map((c) => {
    const en = VRAGEN_EN[c.soort === 'veld' ? c.id : c.soort];
    if (!en) return c;
    return { ...c, vraag: en.vraag(c), ...(c.toelichting != null ? { toelichting: en.toelichting } : {}) };
  });
}

export interface OnboardingOptions {
  /** Waar de registers vandaan komen. Async, want dit gaat over de socket. */
  readonly registers: () => Promise<Registers>;
  /** De map waar `<id>.json` terechtkomt. */
  readonly sitesDir: string;
  /** Welke strategieën bestaan, voor de controle. */
  readonly knownStrategies: readonly string[];
}

/** Wat het bewaren zegt als het niet lukt, per taal (besluit 185). De pagina toont `reden`. */
const MISLUKT = perTaal('onboarding');

export type SaveResult =
  | { readonly ok: true; readonly pad: string; readonly weggelaten?: readonly string[] }
  | { readonly ok: false; readonly reden: string; readonly problemen: readonly string[] };

export class Onboarding {
  readonly #options: OnboardingOptions;
  /**
   * Het laatst uitgedeelde voorstel.
   *
   * De antwoorden verwijzen ernaar met een id, dus we moeten weten welke
   * vragen we hebben gesteld. Opnieuw ontdekken bij het opslaan zou kunnen
   * betekenen dat er inmiddels andere vragen zijn — en dan landt een antwoord
   * op de verkeerde vraag.
   */
  #latest: Proposal | null = null;

  constructor(options: OnboardingOptions) {
    this.#options = options;
  }

  async proposal(): Promise<Proposal> {
    const registers = await this.#options.registers();
    this.#latest = discover(registers);
    this.#namen = namenVoor(this.#latest, registers);
    return this.#latest;
  }

  /**
   * De namen uit Home Assistant bij de keuzes van het laatste voorstel: de
   * bewoner ziet nooit een entity-ID (besluit 45), ook niet in het welkom
   * (besluit 154).
   */
  namen(): Readonly<Record<string, string>> {
    return this.#namen;
  }

  #namen: Readonly<Record<string, string>> = {};

  /**
   * Welke configuraties er al staan.
   *
   * De weergave laat dit zien vóórdat er iets te klikken valt, en `opslaan`
   * weigert eropaf. Zie de uitleg daar: dit is het lek dat op 11 september
   * 2026 de add-on stillegde.
   */
  async existing(): Promise<string[]> {
    try {
      return (await readdir(this.#options.sitesDir))
        .filter((f) => f.endsWith('.json'))
        .sort();
    } catch {
      return [];
    }
  }

  async save(answers: Readonly<Record<string, string | null>>, lang: Lang = 'nl'): Promise<SaveResult> {
    const w = MISLUKT[lang];
    const proposal = this.#latest;
    if (proposal == null) {
      return {
        ok: false,
        reden: w.geenVoorstel,
        problemen: [],
      };
    }

    /*
     * Staat er al een configuratie, dan is deze installatie niet vers.
     *
     * De eerste versie keek alleen of het bestand dat wij zouden schrijven al
     * bestond. Dat beschermde dat ene bestand, maar niet de installatie: naast
     * `huis-cornelissen.json` verscheen `mijn-huis.json`, en de lader weigert
     * dan te kiezen — met een add-on die niet meer startte als gevolg.
     *
     * De onboarding is er voor een lege installatie. Wie er al een heeft en
     * opnieuw wil beginnen, zet het oude bestand zelf opzij. Dat is één
     * handeling, en het maakt zichtbaar wat er gebeurt.
     */
    const alreadyPresent = await this.existing();
    if (alreadyPresent.length > 0) {
      return {
        ok: false,
        reden: w.alEen,
        problemen: [...alreadyPresent.map((f) => w.staatIn(f, this.#options.sitesDir)), '', ...w.opnieuw],
      };
    }

    const config = applyChoices(proposal, answers);

    // Toetsen vóór schrijven. Een bestand dat de dienst niet kan lezen is
    // erger dan geen bestand: dan start hij niet meer, en de melding komt in
    // een logboek terecht dat niemand openslaat (besluit 33).
    const toets = (c: Record<string, unknown>) => parseSiteConfig(c, { knownStrategies: this.#options.knownStrategies });
    const checked = toets(config);
    let weggelaten: readonly string[] = [];
    if (!checked.ok) {
      /*
       * Een huis dat SunArc niet helemaal begrijpt, mag toch beginnen (4
       * november 2026): een tester bleef hangen op "zo niet bruikbaar". Wat
       * de toets afkeurt en weg kan (een apparaat, een zone, een bewoner, een
       * losse sensor), laat SunArc weg; de rest gaat door, en wat wegbleef
       * staat in het logboek en op het scherm. Kan het niet zo, dan blijft het
       * zoals het was.
       */
      const gesnoeid = snoeiVoorstel(config, toets);
      if (!gesnoeid) {
        return {
          ok: false,
          reden: w.nietBruikbaar,
          problemen: checked.problems.map((p) =>
            p.path === '' ? p.message : `${p.path}: ${p.message}`,
          ),
        };
      }
      for (const k of Object.keys(config)) delete config[k];
      Object.assign(config, gesnoeid.config);
      weggelaten = gesnoeid.weggelaten;
    }

    const name = String(config['id'] ?? 'installatie');
    const path = join(this.#options.sitesDir, `${name}.json`);

    // Het slot hierboven dekt dit al af — geen enkele .json in de map betekent
    // ook dit bestand niet. Toch nog een keer kijken, want tussen de controle
    // en het schrijven zit tijd, en een bestaande configuratie overschrijven
    // is het ergste wat deze code kan doen.
    const exists = await access(path).then(
      () => true,
      () => false,
    );
    if (exists) {
      return {
        ok: false,
        reden: w.bestaatAl(path),
        problemen: [w.verplaats],
      };
    }

    await mkdir(this.#options.sitesDir, { recursive: true });
    await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
    return { ok: true, pad: path, ...(weggelaten.length ? { weggelaten } : {}) };
  }
}

/** Losse velden van het voorstel die weg mogen: zonder werkt SunArc ook. */
const LOS = ['power', 'sun', 'outdoorTemperature', 'solarProduction', 'occupancy'] as const;
const LIJST = /^(actuators|zones|occupancy)\[(\d+)\]/;

/**
 * Laat weg wat de toets afkeurt, en toetst opnieuw, tot het voorstel door de
 * toets komt (hooguit tien rondes). Een apparaat gaat ook uit zijn zone, en
 * een zone zonder apparaten valt mee weg. Null als een bezwaar nergens bij
 * hoort dat weg kan, of als er na tien rondes nog bezwaren zijn.
 */
export function snoeiVoorstel(
  begin: Record<string, unknown>,
  toets: (c: Record<string, unknown>) => ReturnType<typeof parseSiteConfig>,
): { config: Record<string, unknown>; weggelaten: string[] } | null {
  const config = structuredClone(begin);
  const weggelaten: string[] = [];
  const naam = (x: Record<string, unknown> | undefined) => String(x?.['name'] ?? x?.['ref'] ?? x?.['id'] ?? '?');
  for (let ronde = 0; ronde < 10; ronde++) {
    const uit = toets(config);
    if (uit.ok) return { config, weggelaten };
    const weg = { actuators: new Set<number>(), zones: new Set<number>(), occupancy: new Set<number>() };
    const velden = new Set<string>();
    const reden = new Map<string, string>();
    // Alleen fouten; een waarschuwing houdt niets tegen.
    for (const p of uit.problems.filter((x) => x.severity === 'error')) {
      const m = LIJST.exec(p.path);
      if (m) {
        weg[m[1] as keyof typeof weg].add(Number(m[2]));
        reden.set(`${m[1]}[${m[2]}]`, p.message);
        continue;
      }
      const veld = LOS.find((v) => p.path === v || p.path.startsWith(`${v}.`) || p.path.startsWith(`${v}[`));
      if (!veld) return null;
      velden.add(veld);
      reden.set(veld, p.message);
    }
    const lijst = (k: 'actuators' | 'zones' | 'occupancy') => (config[k] as Record<string, unknown>[] | undefined) ?? [];
    // De apparaten, en hun id uit elke zone.
    const wegIds = new Set<string>();
    for (const i of weg.actuators) {
      const a = lijst('actuators')[i];
      wegIds.add(String(a?.['id']));
      weggelaten.push(`apparaat ${naam(a)}: ${reden.get(`actuators[${i}]`)}`);
    }
    for (const i of weg.zones) weggelaten.push(`zone ${naam(lijst('zones')[i])}: ${reden.get(`zones[${i}]`)}`);
    for (const i of weg.occupancy) weggelaten.push(`bewoner ${naam(lijst('occupancy')[i])}: ${reden.get(`occupancy[${i}]`)}`);
    if ('actuators' in config) config['actuators'] = lijst('actuators').filter((_, i) => !weg.actuators.has(i));
    if ('zones' in config) {
      config['zones'] = lijst('zones')
        .filter((_, i) => !weg.zones.has(i))
        .map((z) => ({ ...z, actuatorIds: ((z['actuatorIds'] as string[] | undefined) ?? []).filter((id) => !wegIds.has(id)) }))
        .filter((z) => {
          if ((z['actuatorIds'] as string[]).length > 0) return true;
          weggelaten.push(`zone ${naam(z)}: zonder apparaat`);
          return false;
        });
    }
    if ('occupancy' in config && weg.occupancy.size) config['occupancy'] = lijst('occupancy').filter((_, i) => !weg.occupancy.has(i));
    for (const v of velden) {
      delete config[v];
      weggelaten.push(`${v}: ${reden.get(v)}`);
    }
  }
  return toets(config).ok ? { config, weggelaten } : null;
}

/** Per optie van een keuze de naam zoals Home Assistant hem toont. */
function namenVoor(proposal: Proposal, registers: Registers): Record<string, string> {
  const ids = new Set(proposal.keuzes.flatMap((k) => k.opties));
  const uit: Record<string, string> = {};
  for (const id of ids) {
    const staat = registers.states.find((s) => s.entity_id === id)?.attributes['friendly_name'];
    const register = registers.entities.find((e) => e.entity_id === id);
    const naam = typeof staat === 'string' && staat.trim() ? staat : register?.name ?? register?.original_name;
    if (naam) uit[id] = naam;
  }
  return uit;
}
