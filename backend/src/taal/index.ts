/**
 * De zinnen van de dienst per taal (besluit 344): één bestand per taal, `nl.ts` en `en.ts`, per onderwerp. Een bestand
 * van de dienst haalt zijn tabel met `perTaal('weer')` en kiest dan `[lang]`, zoals het eerder een eigen tabel deed.
 * Een nieuwe taal is één bestand erbij (`de.ts`, met het type `Teksten`), hier in `TALEN`, en in `LANGS`
 * (assistant-types.ts); de typecontrole zegt wat er nog mist.
 *
 * De tabel wordt pas bij gebruik opgezocht (een getter): een taalbestand mag zo een hulpje gebruiken uit het bestand
 * dat hem weer leest, zonder dat de volgorde van laden ertoe doet.
 */
import type { Lang } from '../web/assistant-types.js';
import { nl } from './nl.js';
import { en } from './en.js';

/** Wat elke taal moet hebben: de vorm van het Nederlands, met gewone tekst in plaats van precies die woorden. */
type Verbreed<T> = T extends string ? string : T extends (...a: infer A) => infer R ? (...a: A) => Verbreed<R> : T extends object ? { readonly [K in keyof T]: Verbreed<T[K]> } : T;
export type Teksten = Verbreed<typeof nl>;

const TALEN: Readonly<Record<Lang, () => Teksten>> = { nl: () => nl, en: () => en };

/** De tabel van één onderwerp, per taal: `perTaal('weer')[lang].zon`. */
export function perTaal<K extends keyof Teksten>(onderwerp: K): Readonly<Record<Lang, Teksten[K]>> {
  const uit = {} as Record<Lang, Teksten[K]>;
  // De talen hier vast, niet uit TALEN: zo mag een bestand dit al aanroepen terwijl de taalbestanden nog laden.
  for (const lang of ['nl', 'en'] as const satisfies readonly Lang[]) Object.defineProperty(uit, lang, { get: () => TALEN[lang]()[onderwerp], enumerable: true });
  return uit;
}
