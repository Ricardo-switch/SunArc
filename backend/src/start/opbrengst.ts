/**
 * Wat er was (uit main.ts): de historie uit Home Assistant, de laadbeurten van de auto en de
 * opbrengst per dak (besluiten 102, 263, 261). Alleen verhuisd.
 */
import { Historie, somPerVak } from '../web/historie.js';
import { Laadbeurten } from '../web/laadbeurten.js';
import { laadMeters } from '../web/opslag.js';
import { type Achter, metMeting, opbrengstPerVlak, aanvullenUitMeter } from '../web/meten-vlakken.js';
import { type PowerRow } from '../web/today.js';
import { type DakVlak, panelenVan } from '../web/daken.js';
import type { MaakOpbrengstNodig } from '../main.js';

export function maakOpbrengst(nodig: MaakOpbrengstNodig) {
  const {
    allStates, client, connectionStore, energyStore, laadReg, vlakMetingNu,
  } = nodig;
  // Vandaag uit de statistiek van Home Assistant (historie.ts).
  const historie = new Historie({
    config: () => nodig.siteConfig,
    vraag: (type, velden) => client.query<Record<string, { start: number | string; mean?: number | null }[]>>(type, velden),
  });
  const historieVan = (vanMs: number, totMs: number) => historie.van(vanMs, totMs);

  // De laadbeurten van een auto (besluit 259, stap 3): de meter van zijn laadvermogen en het net, met de prijzen van Energie.
  const laadbeurten = new Laadbeurten({
    config: () => nodig.siteConfig,
    meter: (auto) => (nodig.houseRegisters ? (laadMeters(laadReg(nodig.houseRegisters), allStates, connectionStore?.current?.laden ?? null).find((m) => m.auto === auto)?.vermogen ?? null) : null),
    prijzen: () => energyStore?.current?.prijzen ?? null,
    eenheid: (id) => {
      const e = allStates.get(id)?.attributes['unit_of_measurement'];
      return typeof e === 'string' ? e : null;
    },
    vraag: (type, velden) => client.query<Record<string, { start: number | string; mean?: number | null }[]>>(type, velden),
  });

  /**
   * De opbrengst per dakvlak over een periode (besluit 254, stap 5): per uur wat
   * elke meter gemiddeld mat, uit de statistiek van Home Assistant, verdeeld naar
   * de heldere lucht per vlak. Een half uur bewaard per periode.
   */
  const dakenOpbrengstBewaard = new Map<string, { at: number; uit: { vlakken: { letter: string; plek: string; naam: string | null; azimuthDeg: number; opstelling: string; aantal: number; kWh: number }[]; achter: Achter | null } }>();
  async function dakenOpbrengst(vanMs: number, totMs: number): Promise<{ vlakken: { letter: string; plek: string; naam: string | null; azimuthDeg: number; opstelling: string; aantal: number; kWh: number }[]; achter: Achter | null } | null> {
    const a = connectionStore?.current;
    const ids = nodig.siteConfig?.solarProduction ? [nodig.siteConfig.solarProduction.id, ...(nodig.siteConfig.solarExtra ?? []).map((p) => p.id)] : [];
    if (!a?.daken?.vlakken.length || !nodig.location || !ids.length) return null;
    const d = metMeting(a.daken, vlakMetingNu()?.perLetter ?? {});
    const tot = Math.min(totMs, Date.now());
    const sleutel = JSON.stringify([vanMs, tot - (tot % 1_800_000), d.vlakken]);
    const b = dakenOpbrengstBewaard.get(sleutel);
    if (b && Date.now() - b.at < 1_800_000) return b.uit;
    const raw = await client.query<Record<string, { start: number | string; mean?: number | null }[]>>('recorder/statistics_during_period', {
      start_time: new Date(vanMs).toISOString(),
      end_time: new Date(tot).toISOString(),
      statistic_ids: ids,
      period: 'hour',
      types: ['mean'],
      units: { power: 'W' },
    });
    const reeks = (id: string): PowerRow[] => (raw?.[id] ?? [])
      .filter((r) => typeof r.mean === 'number' && Number.isFinite(r.mean))
      .map((r) => ({ startMs: typeof r.start === 'number' ? r.start : Date.parse(r.start), meanW: r.mean as number }));
    const groepen = new Map<string, DakVlak[]>();
    for (const v of d.vlakken) {
      const id = v.meter ?? (ids.length === 1 ? ids[0]! : '');
      groepen.set(id, [...(groepen.get(id) ?? []), v]);
    }
    // Eén meter voor alle vlakken: de uren van vóór de omvormer uit de zonnemeter in kWh.
    const meters = energyStore?.current?.zon ?? [];
    let kwhPerUur = new Map<number, number>();
    if (groepen.size === 1 && meters.length) {
      const kwh = await client.query<Record<string, { start: number | string; change?: number | null }[]>>('recorder/statistics_during_period', {
        start_time: new Date(vanMs).toISOString(),
        end_time: new Date(tot).toISOString(),
        statistic_ids: [...meters],
        period: 'hour',
        types: ['change'],
        units: { energy: 'kWh' },
      });
      kwhPerUur = new Map();
      for (const id of meters) {
        for (const r of kwh?.[id] ?? []) {
          if (typeof r.change !== 'number' || !Number.isFinite(r.change)) continue;
          const t = typeof r.start === 'number' ? r.start : Date.parse(r.start);
          kwhPerUur.set(t, (kwhPerUur.get(t) ?? 0) + Math.max(0, r.change));
        }
      }
    }
    const kWh = opbrengstPerVlak(
      [...groepen].map(([id, vlakken]) => {
        const rows = id ? reeks(id) : somPerVak(ids.map(reeks), [], true);
        return { vlakken, rows: kwhPerUur.size ? aanvullenUitMeter(rows, kwhPerUur) : rows };
      }),
      nodig.location,
    );
    const uit = { vlakken: d.vlakken.map((v) => ({ letter: v.letter, plek: v.plek, naam: v.naam ?? null, azimuthDeg: v.azimuthDeg, opstelling: v.opstelling, aantal: panelenVan(v), kWh: kWh[v.letter] ?? 0 })), achter: vlakMetingNu()?.achter ?? null };
    dakenOpbrengstBewaard.set(sleutel, { at: Date.now(), uit });
    return uit;
  }
  return { dakenOpbrengst, historieVan, laadbeurten };
}
