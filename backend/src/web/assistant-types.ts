/*
 * De assistent: de vormen van vraag en antwoord (opgesplitst uit web/assistant.ts).
 *
 * De talen, de soorten vragen en wensen, een vraag, een feit, een antwoord, wat de assistent van het huis weet, en
 * de stand van een kamer.
 */
import type { Command, Intent, RejectedIntent } from '../core/decision.js';
import type { SluipRapport } from './sluipverbruik.js';
import type { Explanation } from '../core/decision.js';
import type { SiteConfig } from '../core/model.js';
import type { TodayReport } from './today.js';

/** Wat de assistent van een besluit nodig heeft; `LiveSnapshot` voldoet. */
export interface DecisionView {
  readonly atMs: number;
  readonly explanation: Explanation;
  readonly commands: readonly Command[];
  readonly accepted: readonly Intent[];
  readonly rejected: readonly RejectedIntent[];
  /** Wat de apparaten werkelijk deden, als `cool@22`, op actuator-id. */
  readonly observed: Readonly<Record<string, string>>;
  /** Wat een apparaat zegt dat het nu doet (`hvac_action`), als het dat zegt. */
  readonly observedAction?: Readonly<Record<string, string>>;
  /**
   * Waar de zon staat: op, nog niet op, of vandaag niet meer
   * genoeg ('s middags lager dan 10°). Zonder ligging weg: dan zoals het was.
   */
  readonly zonNu?: ZonNu;
}

export type ZonNu = 'op' | 'nog' | 'weg';

export const LANGS = ['nl', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export const QUESTION_KINDS = ['nu', 'waarom', 'straks', 'zon', 'doe', 'vandaag', 'warm', 'weer', 'morgen', 'kosten', 'sluip', 'thuis', 'terug', 'draait', 'boiler'] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

/** `aan` zonder meer: koelen of verwarmen, naar wat de kamer nodig heeft. */
export type Wish = 'koelen' | 'verwarmen' | 'drogen' | 'uit' | 'aan';

export type Question =
  | { readonly kind: 'nu' }
  | { readonly kind: 'waarom'; readonly kamer: string }
  | { readonly kind: 'straks' }
  | { readonly kind: 'zon' }
  /** Wat het huis vandaag deed (besluit 141). */
  | { readonly kind: 'vandaag' }
  /** Hoe warm het overal is (besluit 141), of in één kamer die SunArc niet regelt (besluit 341). */
  | { readonly kind: 'warm'; readonly kamer?: string }
  /** Wat de boiler of de jacuzzi nu doet (besluit 341); zonder naam allemaal. */
  | { readonly kind: 'boiler'; readonly naam?: string }
  /** Het weer en de zon van vandaag (besluit 166). */
  | { readonly kind: 'weer' }
  /** Het weer en de zon van morgen (besluit 142). */
  | { readonly kind: 'morgen' }
  /** Wat de apparaten met een meter deze maand kostten (besluit 142). */
  | { readonly kind: 'kosten' }
  /** Het sluipverbruik: wat het huis 's nachts gebruikt (besluit 192). */
  | { readonly kind: 'sluip' }
  /** Of er iemand thuis is, wat er terugging naar het net, en of een apparaat draait. */
  | { readonly kind: 'thuis' }
  | { readonly kind: 'terug' }
  | { readonly kind: 'draait'; readonly apparaat: string }
  | {
      readonly kind: 'doe';
      /** Leeg als er geen kamer in de vraag stond ("zet de airco aan"). */
      readonly kamer: string;
      readonly wens: Wish;
      readonly temperatuurC: number | null;
    };

/** Een getal in het antwoord, precies zoals het er staat, met waar het vandaan komt. */
export interface Fact {
  readonly bron: string;
  readonly tekst: string;
}

export interface Answer {
  readonly vraag: QuestionKind;
  readonly taal: Lang;
  /** De kamer waar het over ging, als zone-id, of null. */
  readonly kamer: string | null;
  readonly antwoord: string;
  readonly feiten: readonly Fact[];
  /**
   * Zo zeggen, niet in eigen woorden: een kamer die er niet
   * is of nog geen besluit. Het model zette er een sfeerzinnetje achter, zoals
   * "Laten we het gezellig houden in huis".
   */
  readonly letterlijk?: true;
  /** Een vraag terug met keuzes om op te tikken of te zeggen (besluit 209). */
  readonly keuze?: readonly { readonly label: string; readonly tekst: string }[];
  /** Een opdracht voor een deur (besluit 210): de pagina stuurt hem, zoals bij licht. */
  readonly opdracht?: { readonly pad: string; readonly body: Readonly<Record<string, unknown>> };
  /** Wat er verandert, als kaartjes onder het antwoord. */
  readonly gedaan?: readonly { readonly soort: string; readonly waarde: string; readonly uitleg: string }[];
}

/**
 * De klimaatbrug (besluit 210), voor de assistent: voor een kamer en een wens
 * de opdracht met zijn antwoord, een reden waarom het niet kan, of null als de
 * brug niet over die kamer of wens gaat (dan zegt het huis wat het zou doen).
 */
export type BrugVraag = (
  wens: 'verwarmen' | 'koelen',
  zoneId: string,
  temperatuurC: number | null,
  lang: Lang,
) =>
  | { readonly ok: true; readonly antwoord: string; readonly feiten: readonly Fact[]; readonly opdracht: NonNullable<Answer['opdracht']>; readonly gedaan: NonNullable<Answer['gedaan']> }
  | { readonly ok: false; readonly antwoord: string }
  | null;

export interface AskContext {
  readonly config: SiteConfig;
  /**
   * De kamers uit de indeling met hun temperatuur (besluit 341): ook een kamer die SunArc niet regelt, met een
   * meter erin. Alleen bij de vraag hoe warm het in een kamer is.
   */
  readonly kamers?: readonly { readonly naam: string; readonly temperatuurC: number | null; readonly geregeld: boolean }[] | null;
  readonly snapshot: DecisionView | null;
  /** Het dagoverzicht, of null waar er niet gelogd wordt. */
  readonly today: TodayReport | null;
  readonly nowMs: number;
  /** Tijdens de schaduw zegt de assistent "ik zou", niet "ik doe". */
  readonly shadow: boolean;
  readonly lang: Lang;
  /**
   * Of de zon op is en op welke gevels hij staat, op naam (besluit 93). Weg of
   * null als de ligging van het huis niet bekend is; dan zegt de assistent er
   * niets over.
   */
  readonly zoninval?: { readonly boven: boolean; readonly gevels: readonly string[] } | null;
  /**
   * Wat het weer verwacht voor de zon van vandaag (besluit 141): wat er al
   * was, wat er samen verwacht wordt, en wat de dag ervoor werd verwacht. Weg
   * of null zonder weerbron.
   */
  readonly weer?: {
    readonly opgewektKwh: number;
    readonly verwachtKwh: number | null;
    readonly voorafKwh: number | null;
    /**
     * Het weer van de rest van vandaag (besluit 166): wat Buienradar nu zegt,
     * en uit de uren de warmste en koudste temperatuur en de grootste regenkans.
     */
    readonly vandaag?: {
      readonly tekst: string | null;
      readonly minC: number | null;
      readonly maxC: number | null;
      readonly regenkansPct: number | null;
    } | null;
    /** Morgen (besluit 142): de verwachting van het weer en van je dak. */
    readonly morgen?: {
      readonly tekst: string | null;
      readonly minC: number | null;
      readonly maxC: number | null;
      readonly regenkansPct: number | null;
      readonly verwachtKwh: number | null;
    } | null;
  } | null;
  /**
   * Wat de apparaten met een eigen meter deze maand gebruikten en kostten
   * (besluit 142), uit Opbrengst. Alleen het deel van het net kost geld.
   */
  readonly kosten?: {
    readonly maand: string;
    readonly apparaten: readonly { readonly id: string; readonly naam: string; readonly kwh: number; readonly zonKwh: number; readonly euro: number | null }[];
    /**
     * Het hele huis deze maand, uit de slimme meter: stroom
     * met de teruglevering ervan af, gas, en alles met de vaste kosten. Null
     * waar een prijs ontbreekt.
     */
    readonly huis?: {
      readonly stroomEuro: number | null;
      readonly gasEuro: number | null;
      readonly totaalEuro: number | null;
      readonly vanNetKwh: number;
      readonly terugKwh: number;
    };
  } | null;
  /** Het sluipverbruik (besluit 192), uit de nachten van de slimme meter. */
  readonly sluip?: SluipRapport | null;
  /** De klimaatbrug (besluit 210): weg of null als hij uit staat. */
  readonly brug?: BrugVraag | null;
}

export type Parsed =
  | { readonly ok: true; readonly question: Question; readonly lang: Lang }
  | { readonly ok: false; readonly reden: string };

/* ---------------------------------------------------- de stand van een kamer */

/** Soorten: cool, heat, wait, ok, idle, bad — dezelfde als op de wand. */
export type RoomKind = 'cool' | 'heat' | 'wait' | 'ok' | 'idle' | 'bad';

export interface RoomStatus {
  readonly kind: RoomKind;
  readonly zin: string;
  readonly feiten: readonly Fact[];
}
