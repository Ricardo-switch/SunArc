/**
 * De valuta van het huis (testerronde, november 2026). Home Assistant weet
 * hem (`get_config`, `currency`); zolang dat nog niet gelezen is, of er niets
 * staat, is het de euro. Voor de bedragen die de dienst zelf zegt, zoals de
 * assistent en de kostenregels, en voor de app via `api/site`.
 */

import type { Lang } from './assistant.js';
import { perTaal } from '../taal/index.js';

/** Losse zinnen van dit bestand, per taal (besluit 344). */
const TAAL_ZIN = perTaal('algemeen');

let code = 'EUR';

/** De valuta uit Home Assistant onthouden; alleen een code van drie letters. */
export function zetValuta(c: unknown): void {
  if (typeof c === 'string' && /^[A-Z]{3}$/.test(c)) code = c;
}

/** De code van nu, zoals EUR. */
export const valuta = (): string => code;

/** Het teken in de taal van de app: €, $ of CHF. */
export function valutaTeken(lang: Lang = 'nl'): string {
  try {
    return new Intl.NumberFormat(TAAL_ZIN[lang].locale, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((d) => d.type === 'currency')?.value ?? code;
  } catch {
    return code;
  }
}
