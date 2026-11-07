/**
 * Het Energie-dashboard en de statistiek van Home Assistant, voor Opbrengst
 * (besluit 102). Alleen leesopdrachten, via de witte lijst van de client.
 */

import { isPrijsPerKwh, meterRole, type EnergySource, type MeterOption, type PrijsSensor } from '../../web/energy.js';
import type { HaClient, HaEntityState } from './client.js';

interface StatisticId {
  readonly statistic_id: string;
  readonly name?: string | null;
  readonly unit_class?: string | null;
  readonly has_sum?: boolean;
}

interface StatisticRow {
  readonly start: number | string;
  readonly change?: number | null;
}

const toMs = (v: number | string) => (typeof v === 'number' ? v : Date.parse(v));

/**
 * `state` zoekt de stand van nu van een entiteit: voor de naam van een meter
 * (de statistiek geeft er meestal geen) en een prijs uit een entiteit.
 */
export function haEnergySource(
  client: HaClient,
  state: (entityId: string) => HaEntityState | undefined = () => undefined,
  /** De integratie van een entiteit, uit het register: voor de rol van een meter. */
  platform: (entityId: string) => string | null = () => null,
  /** Alle entiteiten van nu: om sensoren met een prijs per kWh te vinden. */
  alle: () => Iterable<HaEntityState> = () => [],
  /** De omvormers met hun vermogen van nu, waarmee de regeling rekent (5 november 2026). */
  omvormers: () => readonly string[] = () => [],
): EnergySource {
  const friendly = (id: string) => {
    const n = state(id)?.attributes['friendly_name'];
    return typeof n === 'string' && n.trim() ? n.trim() : null;
  };
  return {
    entityNumber(entityId) {
      const v = Number(state(entityId)?.state);
      return Number.isFinite(v) ? v : null;
    },
    prijsSensoren(): readonly PrijsSensor[] {
      const lijst: PrijsSensor[] = [];
      for (const s of alle()) {
        if (!s.entity_id.startsWith('sensor.') || !isPrijsPerKwh(s.attributes['unit_of_measurement'])) continue;
        const v = Number(s.state);
        lijst.push({ id: s.entity_id, naam: friendly(s.entity_id) ?? s.entity_id, prijs: s.state !== '' && Number.isFinite(v) ? v : null });
      }
      // De prijs van nu eerst (niet de prijs van morgen of het gemiddelde), dan op naam.
      const nu = (x: PrijsSensor) => (/current|huidig|now|nu\b|actue/i.test(`${x.id} ${x.naam}`) ? 0 : 1);
      return lijst.sort((a, b) => nu(a) - nu(b) || a.naam.localeCompare(b.naam, 'nl')).slice(0, 5);
    },
    async kostenTellers() {
      try {
        const info = await client.query<{ cost_sensors?: unknown }>('energy/info');
        const k = info?.cost_sensors;
        if (k == null || typeof k !== 'object' || Array.isArray(k)) return null;
        return Object.fromEntries(Object.entries(k as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'));
      } catch {
        return null;
      }
    },
    async prefs() {
      try {
        return await client.query<unknown>('energy/get_prefs');
      } catch {
        // Niet ingericht: Home Assistant antwoordt dan met een fout.
        return null;
      }
    },
    async meters(): Promise<readonly MeterOption[]> {
      const list = await client.query<StatisticId[]>('recorder/list_statistic_ids', { statistic_type: 'sum' });
      return list
        .filter((s) => s.has_sum !== false && (s.unit_class === 'energy' || s.unit_class === 'volume'))
        .map((s): MeterOption => {
          const naam = s.name?.trim() || friendly(s.statistic_id) || s.statistic_id;
          const soort = s.unit_class === 'volume' ? 'volume' : 'energy';
          return { id: s.statistic_id, naam, soort, rol: meterRole(s.statistic_id, naam, soort, platform(s.statistic_id)) };
        })
        .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
    },
    // Opgewekt uit het vermogen van de omvormers: het gemiddelde per uur of dag maal de uren.
    async opgewekt(startMs, endMs, period) {
      const ids = omvormers();
      if (ids.length === 0) return null;
      const raw = await client.query<Record<string, { start: number | string; mean?: number | null }[]>>('recorder/statistics_during_period', {
        start_time: new Date(startMs).toISOString(),
        end_time: new Date(endMs).toISOString(),
        statistic_ids: [...ids],
        period,
        types: ['mean'],
        units: { power: 'W' },
      });
      const uren = period === 'hour' ? 1 : 24;
      const som = new Map<number, number>();
      for (const id of ids) {
        for (const r of raw?.[id] ?? []) {
          if (typeof r.mean !== 'number' || !Number.isFinite(r.mean)) continue;
          const t = toMs(r.start);
          som.set(t, (som.get(t) ?? 0) + (Math.max(0, r.mean) * uren) / 1000);
        }
      }
      if (som.size === 0) return null;
      return [...som].sort((a, b) => a[0] - b[0]).map(([t, kwh]) => ({ startMs: t, change: kwh }));
    },
    async changes(ids, startMs, endMs, period) {
      if (ids.length === 0) return {};
      const raw = await client.query<Record<string, StatisticRow[]>>('recorder/statistics_during_period', {
        start_time: new Date(startMs).toISOString(),
        end_time: new Date(endMs).toISOString(),
        statistic_ids: [...ids],
        period,
        types: ['change'],
        // Alles in kWh en m³, ook een omvormer die in Wh telt.
        units: { energy: 'kWh', volume: 'm³' },
      });
      return Object.fromEntries(
        Object.entries(raw ?? {}).map(([id, rows]) => [
          id,
          rows.filter((r) => typeof r.change === 'number' && Number.isFinite(r.change)).map((r) => ({ startMs: toMs(r.start), change: r.change as number })),
        ]),
      );
    },
  };
}
