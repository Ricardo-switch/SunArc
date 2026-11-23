/**
 * De ligging van de panelen en wat ze opleveren (uit main.ts, 23 november 2026; besluiten 254-261): de rijen van de
 * omvormers, per vlak gemeten, en de ligging die de app laat zien. Alleen verhuisd.
 */
import { type PowerRow } from '../web/today.js';
import { somPerVak } from '../web/historie.js';
import { omvormerUitType, type Meting, type PanelenAntwoord, meetLigging, kiesLigging } from '../web/ligging.js';
import { type VlakStand, type Verdeling, type Achter, type MeterGroep, meetVlakken, metMeting, verdeelDag, achterblijven } from '../web/meten-vlakken.js';
import { type DakVlak, panelenVan } from '../web/daken.js';
import { type ConnectionAnswers } from '../web/aansluiting.js';
import { type SiteConfig } from '../core/model.js';
import type { MaakLiggingNodig } from '../main.js';

export function maakLigging(nodig: MaakLiggingNodig) {
  const {
    client, connectionStore,
  } = nodig;
  /*
   * Hoe de panelen liggen (besluit 157): de opbrengst van de afgelopen tien
   * dagen, per vijf minuten uit de statistiek van Home Assistant (zo lang bewaart
   * hij die), om de drie uur opnieuw. De meting rekent opnieuw als de antwoorden
   * over het dak veranderen. Alleen lezen, met dezelfde vraag als Opbrengst.
   */
  let liggingRijen: { at: number; rijen: PowerRow[] } | null = null;
  /** Dezelfde tien dagen per omvormer, voor de meting per dakvlak (besluit 254, stap 4). */
  let liggingPerId = new Map<string, PowerRow[]>();
  async function leesLigging(): Promise<void> {
    // Met meer omvormers de som (testerronde, november 2026); een meetpunt met een attribuut heeft geen statistiek.
    const punten = nodig.siteConfig?.solarProduction ? [nodig.siteConfig.solarProduction, ...(nodig.siteConfig.solarExtra ?? [])] : [];
    if (!punten.length || punten.some((p) => p.attribute)) return;
    const ids = punten.map((p) => p.id);
    const nu = Date.now();
    const raw = await client.query<Record<string, { start: number | string; mean?: number | null }[]>>('recorder/statistics_during_period', {
      start_time: new Date(nu - 10 * 86_400_000).toISOString(),
      end_time: new Date(nu).toISOString(),
      statistic_ids: ids,
      period: '5minute',
      types: ['mean'],
      units: { power: 'W' },
    });
    const reeks = (id: string) => (raw?.[id] ?? [])
      .filter((r) => typeof r.mean === 'number' && Number.isFinite(r.mean))
      .map((r) => ({ startMs: typeof r.start === 'number' ? r.start : Date.parse(r.start), meanW: r.mean as number }));
    // Alleen vakken waarin elke omvormer iets gaf: anders lijkt het dak minder sterk.
    liggingPerId = new Map(ids.map((id) => [id, reeks(id)]));
    liggingRijen = { at: nu, rijen: somPerVak(ids.map(reeks), [], true) };
  }
  // Eerst kort na het verbinden, daarna om de drie uur; mislukt het, dan over tien minuten opnieuw.
  setInterval(() => {
    if (liggingRijen == null || Date.now() - liggingRijen.at > 3 * 3_600_000) void leesLigging().catch(() => {});
  }, 10 * 60_000).unref();
  setTimeout(() => void leesLigging().catch(() => {}), 45_000).unref();

  /** De omvormer uit zijn typenummer: van het apparaat van de zonnesensor, of de enige die er is. */
  function omvormerGevonden(): number | null {
    const regs = nodig.houseRegisters;
    if (!regs) return null;
    const id = nodig.siteConfig?.solarProduction?.id;
    const device = id ? regs.entities.find((e) => e.entity_id === id)?.device_id : null;
    const eigen = device ? omvormerUitType(regs.devices.find((d) => d.id === device)?.model) : null;
    if (eigen != null) return eigen;
    const alle = [...new Set(regs.devices.map((d) => omvormerUitType(d.model)).filter((w): w is number => w != null))];
    return alle.length === 1 ? alle[0]! : null;
  }

  /** Wat elke omvormer hooguit levert, uit het typenummer van zijn apparaat (besluit 254, stap 4). */
  function grenzenGevonden(): Record<string, number> {
    const regs = nodig.houseRegisters;
    if (!regs) return {};
    const uit: Record<string, number> = {};
    for (const p of nodig.siteConfig?.solarProduction ? [nodig.siteConfig.solarProduction, ...(nodig.siteConfig.solarExtra ?? [])] : []) {
      const device = regs.entities.find((e) => e.entity_id === p.id)?.device_id;
      const w = device ? omvormerUitType(regs.devices.find((d) => d.id === device)?.model) : null;
      if (w != null) uit[p.id] = w;
    }
    return uit;
  }

  /**
   * De meting per dakvlak (besluit 254, stap 4): per meter zijn vlakken uit zijn
   * eigen opbrengst. Vlakken zonder meter horen bij de enige omvormer, of, als
   * geen enkel vlak een meter heeft, bij alle omvormers samen. Bewaard tot er
   * iets verandert.
   */
  let vlakMetingBewaard: { sleutel: string; uit: { perLetter: Record<string, VlakStand>; verdeling: Record<string, Verdeling>; achter: Achter | null } } | null = null;
  function vlakMetingNu(): { perLetter: Record<string, VlakStand>; verdeling: Record<string, Verdeling>; achter: Achter | null } | null {
    const d = connectionStore?.current?.daken;
    const cfg = nodig.siteConfig;
    if (!d?.vlakken.length || !nodig.location || !cfg || !liggingRijen) return null;
    const ids = [...liggingPerId.keys()];
    const grenzen = grenzenGevonden();
    const sleutel = JSON.stringify([liggingRijen.at, nodig.location, d.vlakken, d.grenzen ?? null, grenzen]);
    if (vlakMetingBewaard?.sleutel === sleutel) return vlakMetingBewaard.uit;
    const zonderMeter = d.vlakken.every((v) => v.meter == null);
    const groepen = new Map<string, DakVlak[]>();
    for (const v of d.vlakken) {
      const id = v.meter ?? (ids.length === 1 ? ids[0]! : zonderMeter ? '' : null);
      if (id == null || (id !== '' && !liggingPerId.has(id))) continue;
      groepen.set(id, [...(groepen.get(id) ?? []), v]);
    }
    const perLetter: Record<string, VlakStand> = {};
    const verdeling: Record<string, Verdeling> = {};
    const meterGroepen: MeterGroep[] = [];
    for (const [id, vlakken] of groepen) {
      const rijen = id === '' ? liggingRijen.rijen : liggingPerId.get(id)!;
      const grens = id === '' ? omvormerGevonden() : (d.grenzen?.[id] ?? grenzen[id] ?? (ids.length === 1 ? (d.omvormerW ?? omvormerGevonden()) : null));
      const m = meetVlakken(rijen, vlakken, nodig.location, grens);
      if (m) Object.assign(perLetter, m.vlakken);
      // Verdelen met de stand waar de berekening mee rekent.
      const nu = metMeting({ ...d, vlakken }, perLetter).vlakken;
      const v = verdeelDag(rijen, nu, nodig.location, cfg.timezone, Date.now());
      if (v) verdeling[id || 'samen'] = v;
      meterGroepen.push({ id, vlakken: nu, rows: rijen, grensW: grens });
    }
    // Een vlak dat achterblijft (stap 5): per meter, en per deel van de dag.
    const achter = achterblijven(meterGroepen, nodig.location, cfg.timezone);
    vlakMetingBewaard = { sleutel, uit: { perLetter, verdeling, achter } };
    return vlakMetingBewaard.uit;
  }

  let metingBewaard: { sleutel: string; meting: Meting | null } | null = null;
  /** De ligging gemeten uit de opbrengst, of null zonder heldere dag; bewaard tot er iets verandert. */
  /**
   * Wat de meting over het dak mag aannemen. Met bewaarde daken (besluit 254)
   * zoekt hij vrij, één vlak of twee tegenover elkaar, met het aantal panelen op
   * het hoofddak: anders stuurt wat de bewoner bij een vlak invulde de meting,
   * en kan hij niet meer zeggen dat het anders ligt.
   */
  function metingPanelen(a: ConnectionAnswers | null): PanelenAntwoord {
    const hoofd = (a?.daken?.vlakken ?? []).filter((v) => v.plek === 'hoofddak' || v.plek === 'dwarskap');
    if (hoofd.length) return { ligging: null, aantal: Math.min(200, hoofd.reduce((s, v) => s + panelenVan(v), 0)), voorkant: null, achterkant: null };
    return a?.panelen ?? { ligging: null, aantal: null, voorkant: null, achterkant: null };
  }

  function metingNu(): Meting | null {
    const r = liggingRijen;
    const cfg = nodig.siteConfig;
    if (!r || !nodig.location || !cfg) return null;
    const a = connectionStore?.current ?? null;
    const panelen = metingPanelen(a);
    const omvormerW = a?.dak?.omvormerW ?? omvormerGevonden();
    const sleutel = JSON.stringify([r.at, nodig.location, panelen, omvormerW]);
    if (metingBewaard?.sleutel !== sleutel) metingBewaard = { sleutel, meting: meetLigging(r.rijen, nodig.location, panelen, { timeZone: cfg.timezone, omvormerW }) };
    return metingBewaard.meting;
  }

  /**
   * De ligging die geldt, over de configuratie: wat de bewoner bevestigde gaat
   * voor (zoals de zekering, besluit 117), dan het bestand, dan de meting, dan
   * een schatting. De regeling leest hem niet (93), dus dit kan zonder herstart.
   */
  let liggingBewaard: { sleutel: string; gekozen: ReturnType<typeof kiesLigging> } | null = null;
  function metLigging(c: SiteConfig): SiteConfig {
    const a = connectionStore?.current ?? null;
    const input = {
      configuratie: c.geometry,
      dak: a?.dak ?? null,
      meting: metingNu(),
      panelen: a?.panelen ?? null,
      voorkantZon: a?.voorkantZon ?? null,
      omvormerGevonden: omvormerGevonden(),
      // Daken en panelen (besluit 254): elk vlak apart, en de andere daken tellen mee; gemeten volgt de meting (stap 4).
      daken: a?.daken ? metMeting(a.daken, vlakMetingNu()?.perLetter ?? {}) : null,
      elders: a?.elders ?? null,
      grenzen: grenzenGevonden(),
    };
    // Hetzelfde object zolang er niets verandert: de weercache kijkt ernaar.
    const sleutel = JSON.stringify(input);
    if (liggingBewaard?.sleutel !== sleutel) liggingBewaard = { sleutel, gekozen: kiesLigging(input) };
    const gekozen = liggingBewaard.gekozen;
    if (gekozen == null) {
      if (c.geometry == null) return c;
      const { geometry: _weg, ...zonder } = c;
      return zonder;
    }
    return gekozen.geometry === c.geometry ? c : { ...c, geometry: gekozen.geometry };
  }
  return { grenzenGevonden, metLigging, metingNu, omvormerGevonden, vlakMetingNu };
}
