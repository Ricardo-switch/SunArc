/** Kleine hulpjes voor de zinnen in de taalbestanden (besluit 344). */
import { KAMERWOORDEN, metLidwoord } from '../web/kamerwoorden.js';

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

/** Woorden die een apparaat zijn en geen eigen naam: die krijgen een lidwoord. */
const DING = /^(lamp|lampen|plafonniere|plafonnière|spot|spots|spotjes|hanglamp|staande lamp|bureaulamp|leeslamp|ledstrip|led strip|verlichting|sfeerverlichting|licht|screen|screens|zonnescherm|rolluik|markies|luifel|border)\b/i;

/** "de plafonnière", "het screen woonkamer", of een eigen naam zoals hij is. */
export function dingNaam(naam: string): string {
  if (!DING.test(naam)) return naam;
  const klein = naam.charAt(0).toLowerCase() + naam.slice(1);
  return `${/^(screen|licht|rolluik|zonnescherm|scherm)/i.test(naam) ? 'het' : 'de'} ${klein}`;
}

/** "in de keuken", "in het kantoor", of "beneden" zoals het is. */
export function kamerZin(kamer: string): string {
  return /^(beneden|boven|buiten|binnen)$/i.test(kamer) ? kamer.toLowerCase() : `in ${DING.test(kamer) ? dingNaam(kamer) : metLidwoord(kamer)}`;
}
