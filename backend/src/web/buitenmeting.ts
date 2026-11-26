/**
 * De buitentemperatuur die de dienst gebruikt (besluit 354).
 *
 * Bij het tweede proefhuis is de buitenmeter de buitenunit van een airco. Over
 * drie dagen naast het weerbericht: gemiddeld 0,7° warmer, de tweede airco
 * 0,2°. Maar de meter valt vaak een paar minuten terug op precies 0,0 en
 * springt dan terug, en hij kan wegvallen. Een buitenunit in de zomerzon kan
 * graden te hoog meten. Daarom:
 *
 * 1. **Storingen eruit.** Weg of onleesbaar, of precies 0,0 terwijl hij net
 *    nog een graad of meer van nul af zat: dat is geen meting. Dan geldt de
 *    laatste goede waarde nog een kwartier.
 * 2. **De rustigste meter.** Hangen er meer airco's met een buitenmeter, dan
 *    telt de meter met de minste storingen in het laatste etmaal.
 * 3. **Het weer als controle.** Wijkt de meter langer dan een uur meer dan 3°
 *    af van het weer, dan neemt de dienst het weer, tot het verschil weer 2° of
 *    minder is. Zonder meetwaarde neemt hij ook het weer.
 *
 * Zuiver op de klok na die de aanroeper meegeeft; te toetsen zonder Home
 * Assistant.
 */

/** Een buitenmeter: de entiteit, en hoe de bewoner hem kent. */
export interface BuitenMeter {
  readonly id: string;
  readonly naam: string;
}

export interface BuitenKeuze {
  /** De buitentemperatuur, of null als er niets is. */
  readonly c: number | null;
  readonly bron: 'meter' | 'weer' | null;
  /** De meter die telt, ook als het weer het overnam. */
  readonly meter: BuitenMeter | null;
  /** Gezet zolang de meter te ver van het weer zit en het weer het overnam. */
  readonly afwijkend: { readonly naam: string; readonly sindsMs: number } | null;
}

const MINUUT = 60_000;
/** Zo veel graden van het weer is te veel. */
export const AFWIJKING_C = 3;
/** Zo lang moet de afwijking duren. */
export const AFWIJKING_NA_MS = 60 * MINUUT;
/** Pas bij zo weinig verschil telt de meter weer. */
export const TERUG_C = 2;
/** Zo lang geldt de laatste goede waarde nog na een storing. */
export const VASTHOUDEN_MS = 15 * MINUUT;
/** Over zo'n venster tellen de storingen per meter. */
export const RUST_VENSTER_MS = 24 * 60 * MINUUT;

/** Is dit een meting, of een storing? Null bij een storing. */
export function leesMeter(ruw: string | null | undefined, vorige: { readonly c: number; readonly tMs: number } | null, nowMs: number): number | null {
  if (ruw == null || ruw.trim() === '') return null;
  const c = Number(ruw);
  if (!Number.isFinite(c)) return null;
  // Precies 0,0 vlak na een waarde die een graad of meer van nul af zat: de meter viel even weg.
  if (c === 0 && vorige != null && nowMs - vorige.tMs <= 60 * MINUUT && Math.abs(vorige.c) >= 1) return null;
  return c;
}

export class Buitenmeting {
  readonly #laatste = new Map<string, { c: number; tMs: number }>();
  readonly #storingen = new Map<string, number[]>();
  readonly #inStoring = new Set<string>();
  #gekozen: string | null = null;
  #afwijkSindsMs: number | null = null;
  #opWeer = false;

  /**
   * Eén ronde: de meters met hun ruwe toestand (in volgorde van voorkeur) en
   * het weer van nu.
   */
  meet(nowMs: number, meters: readonly (BuitenMeter & { readonly ruw: string | null | undefined })[], weerC: number | null): BuitenKeuze {
    const kandidaten: { meter: BuitenMeter; c: number; storingen: number }[] = [];
    for (const m of meters) {
      const vorige = this.#laatste.get(m.id) ?? null;
      const c = leesMeter(m.ruw, vorige, nowMs);
      const lijst = (this.#storingen.get(m.id) ?? []).filter((t) => nowMs - t <= RUST_VENSTER_MS);
      if (c == null) {
        // Elke storing één keer, hoe vaak de dienst ook kijkt.
        if (!this.#inStoring.has(m.id)) lijst.push(nowMs);
        this.#inStoring.add(m.id);
      } else {
        this.#inStoring.delete(m.id);
        this.#laatste.set(m.id, { c, tMs: nowMs });
      }
      this.#storingen.set(m.id, lijst);
      const geldig = c ?? (vorige != null && nowMs - vorige.tMs <= VASTHOUDEN_MS ? vorige.c : null);
      if (geldig != null) kandidaten.push({ meter: { id: m.id, naam: m.naam }, c: geldig, storingen: lijst.length });
    }
    const minst = Math.min(...kandidaten.map((k) => k.storingen));
    const rustig = kandidaten.filter((k) => k.storingen === minst);
    const keus = rustig.find((k) => k.meter.id === this.#gekozen) ?? rustig[0] ?? null;
    if (keus) this.#gekozen = keus.meter.id;

    if (keus == null) {
      this.#afwijkSindsMs = null;
      this.#opWeer = false;
      return { c: weerC, bron: weerC == null ? null : 'weer', meter: null, afwijkend: null };
    }
    if (weerC != null) {
      const verschil = Math.abs(keus.c - weerC);
      if (this.#opWeer) {
        if (verschil <= TERUG_C) {
          this.#opWeer = false;
          this.#afwijkSindsMs = null;
        }
      } else if (verschil > AFWIJKING_C) {
        this.#afwijkSindsMs ??= nowMs;
        if (nowMs - this.#afwijkSindsMs >= AFWIJKING_NA_MS) this.#opWeer = true;
      } else {
        this.#afwijkSindsMs = null;
      }
    }
    if (this.#opWeer && weerC != null) {
      return { c: weerC, bron: 'weer', meter: keus.meter, afwijkend: { naam: keus.meter.naam, sindsMs: this.#afwijkSindsMs ?? nowMs } };
    }
    return { c: keus.c, bron: 'meter', meter: keus.meter, afwijkend: null };
  }
}
