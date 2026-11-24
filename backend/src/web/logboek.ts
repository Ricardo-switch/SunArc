/**
 * Het logboek om te delen: de laatste waarschuwingen en
 * fouten van de dienst, zelf bijgehouden. Zo werkt het ook op de NAS en
 * zonder add-on, en hoeft een tester niet in Home Assistant te zoeken.
 *
 * Wat erin staat, gaat alleen mee als de melder het zelf meestuurt, na het te
 * hebben gezien. Namen van entiteiten blijven staan (anders is een fout niet
 * te vinden); IP-adressen, tokens, wachtwoorden en e-mail gaan er altijd uit.
 */

export interface LogRegel {
  readonly ms: number;
  readonly niveau: 'waarschuwing' | 'fout';
  readonly tekst: string;
}

const MAX = 100;
const MAX_TEKST = 600;
const regels: LogRegel[] = [];
let aan = false;

/** Haalt weg wat nooit in een melding hoort: adressen, sleutels en e-mail. */
export function schoon(tekst: string): string {
  return (
    tekst
      // Sleutels: een Bearer-token, een JWT, of een lange reeks letters en cijfers.
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [weg]')
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[sleutel]')
      .replace(/\b(token|access_token|password|wachtwoord|secret|api_key|apikey)(["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, '$1$2[weg]')
      .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[sleutel]')
      // Een gebruiker en wachtwoord in een adres.
      .replace(/(\w+:\/\/)[^\s/@:]+:[^\s/@]+@/g, '$1[weg]@')
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[e-mail]')
      // IP-adressen, vier getallen of IPv6 met dubbele punten.
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip]')
      .replace(/\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/gi, '[ip]')
  );
}

/** Een regel bijhouden; de oudste valt eraf boven de honderd. */
export function bewaarRegel(niveau: LogRegel['niveau'], delen: readonly unknown[], ms = Date.now()): void {
  const tekst = delen
    .map((d) => (d instanceof Error ? `${d.message}${d.stack ? `\n${d.stack.split('\n').slice(1, 4).join('\n')}` : ''}` : typeof d === 'string' ? d : safeJson(d)))
    .join(' ')
    .trim();
  if (!tekst) return;
  regels.push({ ms, niveau, tekst: schoon(tekst).slice(0, MAX_TEKST) });
  if (regels.length > MAX) regels.splice(0, regels.length - MAX);
}

function safeJson(d: unknown): string {
  try {
    return JSON.stringify(d) ?? String(d);
  } catch {
    return String(d);
  }
}

/**
 * Vangt console.warn en console.error op, naast wat ze al deden: de regel
 * gaat nog steeds naar het logboek van de add-on.
 */
export function installeerLogboek(): void {
  if (aan) return;
  aan = true;
  const warn = console.warn.bind(console);
  const error = console.error.bind(console);
  console.warn = (...delen: unknown[]) => {
    bewaarRegel('waarschuwing', delen);
    warn(...delen);
  };
  console.error = (...delen: unknown[]) => {
    bewaarRegel('fout', delen);
    error(...delen);
  };
}

/** De regels, de nieuwste onderaan. */
export function logboek(): readonly LogRegel[] {
  return [...regels];
}

/** Voor de tests: leeg beginnen. */
export function leegLogboek(): void {
  regels.length = 0;
}
