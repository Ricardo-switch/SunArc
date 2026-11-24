/**
 * Het huis zoals de app het ziet (uit main.ts): één keer uitgerekend per verandering, de fasen en de
 * zekering (besluit 338), en het laadadvies per auto (besluit 263). Alleen verhuisd, niets veranderd.
 */
import { type Lang } from '../web/assistant.js';
import { buildHouse } from '../web/house.js';
import { getoondeCameras } from '../web/functies.js';
import { lampSchakelaars } from '../web/schakelaars.js';
import { hoofddakPlat } from '../web/daken.js';
import { vindOpslag } from '../web/opslag.js';
import { type FasePunt, type FasenView, faseHistorie, fasenView } from '../web/fasen.js';
import { startOfLocalDay } from '../web/today.js';
import { type LaadAdvies, prijzenVooruit, laadAdvies } from '../web/laadadvies.js';
import { zonVerwachtW, laadDag } from '../web/laaddag.js';
import { clearSkyW } from '../web/sun.js';
import { clearSkyOnPlaneWm2, sunPosition } from '../core/sun.js';
import type { MaakHuisNuNodig } from '../main.js';

export function maakHuisNu(nodig: MaakHuisNuNodig) {
  const {
    allStates, client, connectionStore, energyStore, functiesStore, houseStates, laadReg, layoutStore, runner,
    sceneColors, scenePictures, schakelaarKeuzes, schakelaarStore, sluipverbruik, stekkersVoorHuis, vindSchakelaarsNu,
    webConfig,
  } = nodig;
  /*
   * Het huis één keer uitrekenen per verandering. Bij een paar
   * duizend entiteiten kost het tientallen milliseconden op de Pi, en elk open
   * scherm vraagt het om de paar tellen, net als de lampen, de schermen en het
   * rookalarm. Opnieuw zodra Home Assistant iets in het huis meldt of een van de
   * bronnen verandert, en anders hooguit om de tien tellen: de kleuren van de
   * scènes en de meting van de ligging veranderen zonder dat iets hier het ziet.
   */
  const HUIS_HOOGUIT_MS = 10_000;
  /** Per taal (besluit 185): de stand en de samenvatting staan erin in woorden. */
  const huisBewaard = new Map<Lang, { sleutel: readonly unknown[]; atMs: number; huis: ReturnType<typeof buildHouse> | null }>();
  const huisNu = (lang: Lang): ReturnType<typeof buildHouse> | null => {
    const sleutel = [nodig.huisVersie, nodig.houseRegisters, nodig.siteConfig, runner?.latest, layoutStore?.current, functiesStore?.current, connectionStore?.current, schakelaarStore?.current];
    const b = huisBewaard.get(lang);
    if (b && Date.now() - b.atMs < HUIS_HOOGUIT_MS && b.sleutel.every((x, i) => x === sleutel[i])) return b.huis;
    const huis = nodig.siteConfig && nodig.houseRegisters
      ? buildHouse(
          webConfig()!,
          nodig.houseRegisters,
          houseStates,
          runner?.latest ?? null,
          layoutStore?.current ?? null,
          sceneColors ? (id, naam) => sceneColors.colors(id, naam) : undefined,
          scenePictures ? (naam) => scenePictures.pictureFor(naam) : undefined,
          // Alleen de camera's die de bewoner koos; zonder keuze het voorstel (elke camera).
          functiesStore?.current ? getoondeCameras(functiesStore.current) : null,
          // Wanneer een batterij of filter een melding geeft (besluit 149).
          functiesStore?.current?.meldingen,
          lang,
          // Lampen achter een schakelaar (besluit 297): bij het licht van hun kamer.
          lampSchakelaars(vindSchakelaarsNu(), schakelaarKeuzes()),
          // De slimme stekkers (besluit 318): een apparaat met een kamer, ook niet op zon.
          stekkersVoorHuis(),
        )
      : null;
    // Een plat dak op het hoofdhuis (issue 131): zoals de bewoner het opgaf bij Daken en panelen of Inrichten (143).
    const a = connectionStore?.current;
    // Ook zonder bekende ligging (geen voorgevel): dan alleen dat het dak plat is, anders bleef het een puntdak.
    const isPlat = huis != null && hoofddakPlat(a?.daken, a?.panelen?.ligging, layoutStore?.current?.dak === 'geen');
    const plat0 = !isPlat || !huis ? huis : huis.ligging ? { ...huis, ligging: { ...huis.ligging, plat: true } } : { ...huis, dakPlat: true };
    // De auto's en laadpalen met de keuzes bij Energie (besluit 259), uit alle standen: een kabel of bereik telt niet als iets in huis.
    const plat = plat0 && nodig.houseRegisters ? { ...plat0, opslag: vindOpslag(laadReg(nodig.houseRegisters), allStates, a?.laden ?? null, new Date(), a?.accu ?? null) } : plat0;
    huisBewaard.set(lang, { sleutel, atMs: Date.now(), huis: plat });
    return plat;
  };
  /**
   * Het advies per auto (besluit 259, stap 4): uit het net en de stroom per fase
   * van het laatste besluit, en de prijzen per uur uit de prijs-entiteit van
   * Energie. Alleen lezen.
   */
  /** De fasen van de aansluiting uit het laatste besluit, alleen als ze alle gemeten zijn. */
  const fasenNu = () => {
    const e = runner?.latest?.explanation ?? null;
    const grid = nodig.siteConfig?.grid;
    return e?.phases && grid && e.phases.length > 0 && e.phases.every((p) => p.bron === 'gemeten' && p.currentA != null)
      ? e.phases.map((p) => ({ stroomA: p.currentA!, zekeringA: grid.phases.find((g) => g.id === p.id)?.maxA ?? p.limitA + grid.marginA, grensA: p.limitA }))
      : null;
  };
  /**
   * De hoogste stroom per fase die er met de hand voor een auto op de zekering
   * past (besluit 262): wat hij nu neemt plus de ruimte op de drukste fase; zonder
   * meting per fase de zekering min de marge; zonder aansluiting de zekering
   * die de bewoner bij Energie opgaf, min 2 A; zonder zekering niets.
   */
  function zekeringVoor(id: string): number | null {
    const grid = nodig.siteConfig?.grid;
    if (!grid || !grid.phases.length) {
      // Zonder stroommeters per fase komt de zekering niet in de regeling (logboek bij issue 149 t/m 153), maar hij geldt wel.
      const z = connectionStore?.current?.zekering;
      return z && z !== 'weetniet' ? Math.max(6, z.ampere - 2) : null;
    }
    const fasen = fasenNu();
    if (!fasen) return Math.min(...grid.phases.map((p) => p.maxA - grid.marginA));
    const a = huisNu('nl')?.opslag?.autos.find((x) => x.id === id);
    const nuA = a?.laadt ? Math.max(0, ...(a.stroomA ?? [])) : 0;
    // Nooit boven de zekering zelf: bij teruglevering loopt er op een fase soms minder dan de auto neemt.
    return Math.floor(Math.min(nuA + Math.min(...fasen.map((f) => f.grensA - f.stroomA)), ...fasen.map((f) => f.grensA)));
  }
  /**
   * De fasekaart (besluit 302): de stroom per fase nu, en de dag uit de historie
   * van Home Assistant. Die historie hooguit elke vijf minuten opnieuw; de stand
   * van nu komt elke keer uit het laatste besluit.
   */
  let faseDag: { startMs: number; opMs: number; punten: Map<string, FasePunt[]> } = { startMs: 0, opMs: 0, punten: new Map() };
  async function fasenNuView(): Promise<FasenView> {
    const grid = nodig.siteConfig?.grid ?? null;
    const nuMs = Date.now();
    const startMs = startOfLocalDay(nuMs, nodig.siteConfig?.timezone ?? 'Europe/Amsterdam');
    const e = runner?.latest?.explanation ?? null;
    // De meter van elke fase: de stroom, of anders het vermogen.
    const meterVan = (p: NonNullable<typeof grid>['phases'][number]) => (p.current ?? p.power)!.id;
    const ids = grid?.phases.map(meterVan) ?? [];
    if (ids.length && (faseDag.startMs !== startMs || nuMs - faseDag.opMs > 5 * 60_000)) {
      try {
        // Vanaf een uur voor middernacht: de stand van toen geldt ook om middernacht.
        const antwoord = await client.query('history/history_during_period', { start_time: new Date(startMs - 3_600_000).toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
        faseDag = { startMs, opMs: nuMs, punten: faseHistorie(antwoord) };
      } catch {
        // Zonder historie: alleen de stand van nu; over vijf minuten weer.
        faseDag = faseDag.startMs === startMs ? { ...faseDag, opMs: nuMs } : { startMs, opMs: nuMs, punten: new Map() };
      }
    }
    const z = connectionStore?.current?.zekering;
    return fasenView({
      grid: grid ? { phases: grid.phases.map((p) => ({ id: p.id, current: meterVan(p), ...(p.current ? {} : { watt: true }), maxA: p.maxA })), marginA: grid.marginA } : null,
      nu: e?.phases?.map((p) => ({ id: p.id, currentA: p.currentA, bron: p.bron })) ?? null,
      historie: faseDag.punten,
      dagStartMs: startMs,
      nuMs,
      zekering: z && z !== 'weetniet' ? z : null,
      netW: e && nodig.siteConfig?.power.gridPower ? e.budget.gridPowerW : null,
    });
  }
  const laadadviezen = (): Record<string, LaadAdvies> => {
    const autos = huisNu('nl')?.opslag?.autos ?? [];
    if (!autos.length || !nodig.siteConfig) return {};
    const e = runner?.latest?.explanation ?? null;
    const netW = e && nodig.siteConfig.power.gridPower ? e.budget.gridPowerW : null;
    const fasen = fasenNu();
    const nuMs = Date.now();
    const prijsId = energyStore?.current?.prijzen.dynamisch?.prijsEntiteit ?? null;
    const prijsStaat = prijsId ? allStates.get(prijsId) : undefined;
    const eenheid = typeof prijsStaat?.attributes['unit_of_measurement'] === 'string' ? (prijsStaat.attributes['unit_of_measurement'] as string) : null;
    const prijzen = prijsStaat ? prijzenVooruit(prijsStaat.attributes, prijsStaat.state, eenheid, nuMs) : [];
    const nu = prijsStaat ? Number(prijsStaat.state) : NaN;
    const prijsNu = Number.isFinite(nu) ? nu / (/mwh/i.test(eenheid ?? '') ? 1000 : /ct|cent/i.test(eenheid ?? '') ? 100 : 1) : null;
    // De balk van de dag (besluit 279): de zon die naar verwachting over is, de prijs en de goedkoopste uren.
    const g = nodig.siteConfig.geometry;
    const plek = nodig.location;
    const zonW = (ms: number): number | null =>
      g && plek && g.solarPlanes.length
        ? zonVerwachtW(
            ms,
            nodig.openMeteo.latest?.uren ?? null,
            (t) => clearSkyW(g, plek, t, null),
            (t) => clearSkyOnPlaneWm2(sunPosition(t, plek.latDeg, plek.lonDeg), { azimuthDeg: 180, tiltDeg: 0 }),
          )
        : null;
    // Het huis zonder de auto overdag: ruwweg twee keer het sluipverbruik, minstens 300 W.
    const huisW = Math.max(300, 2 * (sluipverbruik.laatste()?.gewoonW ?? 200));
    return Object.fromEntries(
      autos.map((a) => {
        const advies = laadAdvies(a, { nuMs, netW, fasen, prijzen, prijsNu });
        return [a.id, { ...advies, dag: laadDag(a, { nuMs, prijzen, goedkoop: advies.goedkoop, zonW, huisW }) }];
      }),
    );
  };
  return { fasenNuView, huisNu, laadadviezen, zekeringVoor };
}
