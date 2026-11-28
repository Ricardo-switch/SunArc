/*
 * Het versienummer van SunArc (besluit 131), en wat er per versie nieuw
 * is, in gewone taal voor de app.
 *
 * Het eerste getal gaat omhoog bij een grote stap: 1.0 is de dag dat het huis
 * zelf regelt (stap B, besluit 64). Het tweede bij iets nieuws, het derde bij
 * een reparatie. Dit bestand is de bron: package.json van de dienst en van de
 * weergave hebben hetzelfde nummer, en een test houdt dat zo. Elke versie
 * krijgt in git een markering `v<nummer>`.
 */

import { readFileSync } from 'node:fs';

export const VERSIE = '0.253.0';

/**
 * Melden staat uit: tot de opknapbeurt van januari klaar is,
 * komen er geen nieuwe meldingen bij. De knop Meld een probleem blijft staan en
 * zegt waarom, met een dankwoord aan de testers. Weer aan: zet dit op false.
 * Alleen voor de add-on, dus voor de testers: op een eigen server (de NAS van
 * Ricardo) blijft melden aan, zodat hij op de wand kan blijven melden.
 */
export const MELDEN_PAUZE = true;

export interface Nieuw {
  readonly versie: string;
  /** De dag van de versie, als YYYY-MM-DD. */
  readonly datum: string;
  /** Wat er nieuw bij kwam: een functie die er nog niet was. */
  readonly nieuw?: readonly string[];
  /** Wat beter werkt of er beter uitziet. */
  readonly beter?: readonly string[];
  /** Wat niet goed ging en nu wel. */
  readonly opgelost?: readonly string[];
  /**
   * Hetzelfde in het Engels (besluit 185), met evenveel regels per soort. Een
   * test eist het bij elke versie die de app laat zien; een oudere heeft het
   * niet, en daar toont de app het Nederlands.
   */
  readonly en?: Pick<Nieuw, 'nieuw' | 'beter' | 'opgelost'>;
  /**
   * Wat er met meldingen uit de app gebeurde (testerronde, november 2026): per
   * meldcode de uitkomst. De app vergelijkt het met de codes op het toestel en
   * zegt het alleen tegen wie meldde; er gaat niets het huis uit.
   */
  readonly meldingen?: readonly MeldingUitkomst[];
}

export interface MeldingUitkomst {
  /** De meldcode uit het issue, zoals SA-7F3K. */
  readonly code: string;
  readonly uitkomst: 'opgelost' | 'instelling' | 'later' | 'dubbel' | 'afgewezen' | 'geenreactie';
  /** Een korte uitleg, in het Nederlands en het Engels. */
  readonly tekst?: string;
  readonly tekstEn?: string;
  /** Een plek in de app, zoals energie.html#meters, bij een instelling. */
  readonly href?: string;
  /** Het nummer van het issue: "Werkt nog niet" opent dat issue om te reageren. */
  readonly issue?: number;
}

/** Wat er nieuw is, in de taal van de app: de Engelse regels als die er zijn. */
export function nieuwInTaal(lijst: readonly Nieuw[], lang: 'nl' | 'en'): Omit<Nieuw, 'en'>[] {
  return lijst.map(({ en, meldingen, ...n }) => {
    // De uitkomsten van meldingen in de taal van de app, met de Engelse uitleg als die er is.
    const m = meldingen?.map(({ tekstEn, ...u }) => ({ ...u, ...(lang === 'en' && tekstEn ? { tekst: tekstEn } : {}) }));
    const basis = lang === 'en' && en ? { versie: n.versie, datum: n.datum, ...en } : n;
    return m?.length ? { ...basis, meldingen: m } : basis;
  });
}

/** De eerste regel van een versie: wat nieuw is, anders wat beter is, anders wat opgelost is. */
export function eersteVan(n: Pick<Nieuw, 'nieuw' | 'beter' | 'opgelost'>): string {
  return n.nieuw?.[0] ?? n.beter?.[0] ?? n.opgelost?.[0] ?? '';
}

/** Zoveel versies terug laat de app zien (besluit 133). */
export const TERUGKIJKEN = 10;

/**
 * De versies die op main kwamen, de nieuwste eerst: de tags
 * `v<versie>`, plus de versie van een open PR beta → main. De changelog zet
 * alles wat alleen op beta stond onder de uitgave die het naar main bracht, zo
 * ziet wie bijwerkt één overzicht sinds de vorige uitgave. Bij een PR naar
 * main komt de bovenste versie erbij. Oudere versies staan elk apart.
 */
export const OP_MAIN: readonly string[] = [
  '0.178.2', '0.178.1', '0.175.1', '0.172.1', '0.157.1', '0.156.1', '0.150.0', '0.144.2', '0.142.0', '0.137.0', '0.134.0', '0.131.2', '0.130.0', '0.129.3', '0.129.2', '0.121.2', '0.121.0', '0.120.0', '0.119.0', '0.118.0',
  '0.117.1', '0.117.0', '0.116.0', '0.115.2', '0.115.1', '0.115.0',
];

/**
 * De nieuwste versie eerst. Per versie kort en voor de bewoner, het belangrijkste eerst. De lijst staat sinds 24 november
 * 2026 (besluit 340) als gegevens in nieuw.json naast dit bestand, niet meer als code; een test houdt de vorm van elke
 * versie bij. Bij een nieuwe versie komt er bovenaan een regel bij.
 */
export const NIEUW: readonly Nieuw[] = JSON.parse(readFileSync(new URL('./nieuw.json', import.meta.url), 'utf-8')) as Nieuw[];
