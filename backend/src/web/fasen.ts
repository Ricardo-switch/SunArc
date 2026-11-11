/**
 * De fasekaart (besluit 302, schets Wand-Fasekaart en Tel-Fasekaart; testerronde
 * stap 7): hoeveel stroom er nu op elke fase loopt tegen de zekering, de dag per
 * kwartier en de piek van vandaag.
 *
 * Alleen lezen. De stroom van nu komt uit het laatste besluit (dezelfde fasen
 * als de arbiter, besluit 78); de dag uit de historie van Home Assistant van de
 * stroommeters per fase. Zonder stroommeter per fase zegt de kaart alleen het
 * totaal tegen wat de aansluiting samen kan.
 */

/** Eén meting: wanneer en hoeveel ampère. */
export interface FasePunt {
  readonly ms: number;
  readonly a: number;
}

export interface FaseNu {
  readonly id: string;
  /** De stroom nu in A, of null als de meter niets zegt. */
  readonly nuA: number | null;
  /** Gemeten, of geschat uit het netvermogen. */
  readonly bron: 'gemeten' | 'geschat' | 'onbekend';
  /** De zekering op deze fase. */
  readonly zekeringA: number;
  /** Het hoogste van vandaag, en wanneer. */
  readonly piekA: number | null;
  readonly piekMs: number | null;
  /** Per kwartier vanaf middernacht het hoogste, null voor wat nog moet komen of onbekend is. */
  readonly dag: readonly (number | null)[];
}

export type FasenView =
  | {
      readonly meters: true;
      readonly margeA: number;
      readonly fasen: readonly FaseNu[];
      /** Middernacht van vandaag, voor de as van de dag. */
      readonly dagStartMs: number;
      readonly nuMs: number;
    }
  | {
      readonly meters: false;
      /** Wat de bewoner bij Energie opgaf, of null. */
      readonly zekering: { readonly fasen: 1 | 3; readonly ampere: number } | null;
      /** Het netvermogen nu in W (afname positief), of null. */
      readonly netW: number | null;
      readonly margeA: number;
    };

export const KWARTIEREN = 96;
const KWARTIER = 15 * 60_000;

/**
 * De metingen per entiteit uit `history/history_during_period` (minimal_response,
 * zonder attributen): `s` is de stand, `lu` of `lc` de tijd in seconden. Wat
 * geen getal is (unavailable, unknown), laten we weg. De stroom telt als
 * grootte: een meter die teruglevering negatief geeft, telt even zwaar.
 */
export function faseHistorie(antwoord: unknown): Map<string, FasePunt[]> {
  const uit = new Map<string, FasePunt[]>();
  if (typeof antwoord !== 'object' || antwoord == null) return uit;
  for (const [id, rij] of Object.entries(antwoord as Record<string, unknown>)) {
    if (!Array.isArray(rij)) continue;
    const punten: FasePunt[] = [];
    for (const x of rij as Record<string, unknown>[]) {
      const s = x?.['s'] ?? x?.['state'];
      const a = typeof s === 'string' || typeof s === 'number' ? Number(s) : NaN;
      const t = typeof x?.['lu'] === 'number' ? x['lu'] : typeof x?.['lc'] === 'number' ? x['lc'] : typeof x?.['last_changed'] === 'string' ? Date.parse(x['last_changed']) / 1000 : NaN;
      if (Number.isFinite(a) && Number.isFinite(t)) punten.push({ ms: (t as number) * 1000, a: Math.abs(a) });
    }
    punten.sort((p, q) => p.ms - q.ms);
    uit.set(id, punten);
  }
  return uit;
}

/**
 * Het hoogste per kwartier vanaf `startMs`, tot `nuMs`. Een meter geeft alleen
 * een nieuwe stand als hij verandert: de stand van vóór een kwartier geldt dus
 * ook aan het begin ervan. Kwartieren na nu, of zonder enige meting ervoor,
 * zijn null.
 */
export function kwartierMax(punten: readonly FasePunt[], startMs: number, nuMs: number): (number | null)[] {
  const uit: (number | null)[] = Array.from({ length: KWARTIEREN }, () => null);
  let i = 0;
  let laatst: number | null = null;
  while (i < punten.length && punten[i]!.ms <= startMs) laatst = punten[i++]!.a;
  for (let k = 0; k < KWARTIEREN; k++) {
    const van = startMs + k * KWARTIER;
    if (van > nuMs) break;
    const tot = Math.min(van + KWARTIER, nuMs + 1);
    let max = laatst;
    while (i < punten.length && punten[i]!.ms < tot) {
      laatst = punten[i++]!.a;
      max = max == null ? laatst : Math.max(max, laatst);
    }
    uit[k] = max;
  }
  return uit;
}

/** Het hoogste van vandaag en wanneer; de stand van vóór middernacht telt als om middernacht. */
export function piekVan(punten: readonly FasePunt[], startMs: number, nuMs: number): { readonly a: number; readonly ms: number } | null {
  let piek: { a: number; ms: number } | null = null;
  let voor: FasePunt | null = null;
  for (const p of punten) {
    if (p.ms > nuMs) break;
    if (p.ms < startMs) {
      voor = p;
      continue;
    }
    if (!piek || p.a > piek.a) piek = { a: p.a, ms: p.ms };
  }
  if (voor && (!piek || voor.a > piek.a)) piek = { a: voor.a, ms: startMs };
  return piek;
}

export interface FasenInvoer {
  /** De aansluiting uit de configuratie, of null zonder stroommeters per fase. */
  readonly grid: { readonly phases: readonly { readonly id: string; readonly current: string; readonly maxA: number }[]; readonly marginA: number } | null;
  /** De fasen uit het laatste besluit. */
  readonly nu: readonly { readonly id: string; readonly currentA: number | null; readonly bron: 'gemeten' | 'geschat' | 'onbekend' }[] | null;
  /** De metingen van vandaag per entiteit (uit faseHistorie). */
  readonly historie: ReadonlyMap<string, readonly FasePunt[]>;
  readonly dagStartMs: number;
  readonly nuMs: number;
  /** Zonder stroommeters: de zekering die de bewoner opgaf, en het netvermogen. */
  readonly zekering: { readonly fasen: 1 | 3; readonly ampere: number } | null;
  readonly netW: number | null;
}

/** De kaart en het blad in één antwoord. */
export function fasenView(i: FasenInvoer): FasenView {
  if (!i.grid || i.grid.phases.length === 0) return { meters: false, zekering: i.zekering, netW: i.netW, margeA: 2 };
  const fasen = i.grid.phases.map((p): FaseNu => {
    const e = i.nu?.find((x) => x.id === p.id);
    const nuA = e?.currentA ?? null;
    // De stand van nu telt mee in de dag: de historie loopt een paar minuten achter.
    const punten = [...(i.historie.get(p.current) ?? []), ...(nuA != null && e?.bron === 'gemeten' ? [{ ms: i.nuMs, a: nuA }] : [])];
    const piek = piekVan(punten, i.dagStartMs, i.nuMs);
    return { id: p.id, nuA, bron: e?.bron ?? 'onbekend', zekeringA: p.maxA, piekA: piek?.a ?? null, piekMs: piek?.ms ?? null, dag: kwartierMax(punten, i.dagStartMs, i.nuMs) };
  });
  return { meters: true, margeA: i.grid.marginA, fasen, dagStartMs: i.dagStartMs, nuMs: i.nuMs };
}
