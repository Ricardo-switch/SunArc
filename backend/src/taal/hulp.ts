/** Kleine hulpjes voor de zinnen in de taalbestanden (besluit 344). */
import { KAMERWOORDEN } from '../web/kamerwoorden.js';

/** Een getal met het juiste woord erachter: "1 stap", "3 stappen". */
export const telling = (n: number, een: string, meer: string): string => `${n} ${n === 1 ? een : meer}`;

/** De eerste letter een hoofdletter. */
export const hoofdletter = (s: string): string => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;

/** Namen achter elkaar: "a, b en c". `en` is het verbindingswoord met spaties, zoals " en " of " and ". */
export function lijst(namen: readonly string[], en: string): string {
  return namen.length <= 1 ? (namen[0] ?? '') : `${namen.slice(0, -1).join(', ')}${en}${namen.at(-1)}`;
}

/**
 * Een naam midden in een zin. Alleen de eerste letter gaat klein, en alleen als
 * het eerste woord een gewoon woord is: "Slaapkamer Daan" wordt "slaapkamer
 * Daan" en "Nest (beneden)" blijft "Nest (beneden)". Een merk of een naam
 * houdt zijn hoofdletter.
 */
export const COMMON = new RegExp(
  `^(${[...Object.keys(KAMERWOORDEN), 'airco', 'thermostaat', 'lamp', 'screen', 'zonnescherm', 'droger', 'wasmachine', 'vaatwasser', 'verwarming', 'vloerverwarming', 'radiator', 'ventilatie', 'warmtepomp', 'boiler', 'voorgevel', 'achtergevel', 'zijgevel', 'gevel'].join('|')})\\b`,
  'i',
);

export function inSentence(name: string): string {
  return COMMON.test(name) ? name.charAt(0).toLowerCase() + name.slice(1) : name;
}
