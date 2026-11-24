/**
 * De meldingen in de bel en op de telefoon (uit main.ts, 24 november 2026; besluit 136 en 183): elke minuut wat de
 * dienst weet naar de bel, en daarna wat naar welke telefoon moet. Alleen verhuisd, niets veranderd.
 */
import { Sluipverbruik, jaarPrijs, sluipVoorBel } from '../web/sluipverbruik.js';
import { logDir, startup } from './begin.js';
import { MeldingenStore } from '../web/meldingen.js';
import { VoorkeurenStore } from '../web/voorkeuren.js';
import { meldingenBron } from '../web/meldingen-bron.js';
import { partsIn, zonedMidnight } from '../web/today.js';
import { KABEL_STANDAARD, accusNu } from '../web/opslag.js';
import { type SiteConfig } from '../core/model.js';
import { hoofdVan } from '../web/bewoners.js';
import { kloptVast, verwarmtMeeMet } from '../web/klopt.js';
import { regelKamers } from '../web/layout.js';
import { PushStore, type Telefoon, vindTelefoons, ontvangersVan, teSturen, alsMelding, telefoonVan, proefTekst } from '../web/push.js';
import { type HouseRegisters } from '../web/house.js';
import type { MaakMeldingenNodig } from '../main.js';

export async function maakMeldingen(nodig: MaakMeldingenNodig) {
  const {
    allStates, analyse, bewonersStore, client, connectionStore, energyStore, klopt, laadReg, laadhand, layoutStore,
    metingNu, runner, version, vindBuffersHa, vlakMetingNu, webConfig,
  } = nodig;
  /*
   * Meldingen in de app (besluit 136): elke minuut uit wat de dienst weet, naar
   * een eigen bestand naast de dataset. Niets naar Home Assistant.
   */
  // Het sluipverbruik (besluit 192): de nachten uit dezelfde statistiek, met de prijs van Energie.
  const sluipverbruik = new Sluipverbruik({
    config: () => nodig.siteConfig,
    vraag: (type, velden) => client.query<Record<string, { start: number | string; mean?: number | null }[]>>(type, velden),
    prijs: () => jaarPrijs(energyStore?.current?.prijzen ?? null),
    ...(logDir !== '' ? { logDir } : {}),
  });
  await sluipverbruik.load();
  // Elk half uur de nachten bij, zodat de bel de ochtend erna weet of de nacht opviel.
  setTimeout(() => void sluipverbruik.rapport().catch(() => null), 20_000).unref();
  setInterval(() => void sluipverbruik.rapport().catch(() => null), 30 * 60_000).unref();
  const meldingen = logDir !== '' ? new MeldingenStore({ logDir }) : null;
  // Thuis naar eigen smaak (besluit 162): kaarten en favorieten, naast de dataset.
  const voorkeuren = logDir !== '' ? new VoorkeurenStore(logDir) : null;
  await voorkeuren?.load();
  await meldingen?.load();
  /** Wat de bel van de auto's weet (besluit 263): de auto's met hun keuze voor kabel vergeten, en de klok van het huis. */
  function autoBel(timeZone: string): Pick<Parameters<typeof meldingenBron>[0], 'autos' | 'handKlaar'> {
    const autos = nodig.huisNu('nl')?.opslag?.autos ?? [];
    if (!autos.length) return {};
    const nu = Date.now();
    const p = partsIn(nu, timeZone);
    const q = partsIn(zonedMidnight(p.y, p.m, p.d, timeZone) - 12 * 3_600_000, timeZone);
    const dag = (x: { y: number; m: number; d: number }) => `${x.y}-${String(x.m).padStart(2, '0')}-${String(x.d).padStart(2, '0')}`;
    const minuut = (uu: string) => Number(uu.slice(0, 2)) * 60 + Number(uu.slice(3, 5));
    const instelling = connectionStore?.current?.laden?.instelling ?? {};
    return {
      autos: {
        minuut: p.h * 60 + p.mi,
        dag: dag(p),
        gisteren: dag(q),
        lijst: autos.map((a) => {
          // Weg is 21:00 en 50%; null is uit. Zonder lading in procenten kan het niet.
          const k = instelling[a.id]?.kabel === undefined ? KABEL_STANDAARD : instelling[a.id]!.kabel!;
          return {
            id: a.id,
            naam: a.naam,
            pct: a.pct,
            grens: a.laadgrens,
            aangesloten: a.aangesloten,
            thuis: a.thuis,
            fout: a.fout,
            kabelSindsMs: a.kabelSinds ? Date.parse(a.kabelSinds) : null,
            kabel: k.pct != null && a.pct != null ? { om: minuut(k.om), pct: k.pct } : null,
          };
        }),
      },
      handKlaar: (laadhand?.klaar ?? []).map((k) => ({ ...k, naam: autos.find((a) => a.id === k.auto)?.naam ?? k.auto })),
    };
  }
  /** Wat de bel van de thuisaccu's weet (besluit 276); null zonder accu. */
  function accuBel(cfg: SiteConfig): NonNullable<Parameters<typeof meldingenBron>[0]['accus']> | null {
    if (!nodig.houseRegisters) return null;
    const lijst = accusNu(laadReg(nodig.houseRegisters), allStates, connectionStore?.current?.laden ?? null, connectionStore?.current?.accu ?? null);
    if (!lijst.length) return null;
    const p = partsIn(Date.now(), cfg.timezone);
    const e = runner?.latest?.explanation;
    const netW = e && cfg.power.gridPower ? e.budget.gridPowerW : null;
    return {
      lijst: lijst.map((a) => ({ id: a.id, naam: a.naam, pct: a.pct, fout: a.fout, stilSindsMs: a.stilSindsMs })),
      terugW: netW == null ? null : Math.max(0, -netW),
      dag: `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`,
    };
  }
  /** Wat de bel van de slimme stekkers weet (besluit 264); null zolang de registers er niet zijn. */
  function stekkerBel(cfg: SiteConfig): NonNullable<Parameters<typeof meldingenBron>[0]['stekkers']> | null {
    if (!nodig.houseRegisters) return null;
    const inRegeling = new Set((cfg.heatStores ?? []).map((h) => h.actuator.id));
    const gekozen = new Set((connectionStore?.current?.buffers ?? []).filter((b) => b.opZon).map((b) => b.actuator));
    const meters = energyStore?.current ? new Set(energyStore.current.apparaten.map((a) => a.id)) : null;
    // Een schakelaar op zon (besluit 304) is niet gevonden maar ingesteld: geen melding.
    // Verborgen bij Toevoegen of in Je huis (versie 3 van de apparaatkaart): dan ook geen melding meer.
    const verborgen = new Set(layoutStore?.current?.verborgen ?? []);
    return vindBuffersHa()
      .filter((b) => b.soort === 'stekker' && !verborgen.has(b.id))
      .map((b) => ({ id: b.id, naam: b.naam, opZon: inRegeling.has(b.actuator) || gekozen.has(b.actuator), meter: b.energy ?? null, meterErin: meters == null || (b.energy != null && meters.has(b.energy)) }));
  }
  function meldingenRonde(): void {
    const cfg = nodig.siteConfig;
    const h = cfg ? nodig.houseReport() : null;
    if (!meldingen || !cfg || !h || allStates.size === 0) return;
    // Wat de bel weet (meldingen-bron.ts); null als Home Assistant zelf weg is.
    const bron = meldingenBron({
      nu: Date.now(),
      config: cfg,
      huis: h,
      states: allStates,
      addOn: version.installatie === 'add-on',
      // Met bewaarde daken (besluit 254) is er niets meer te bevestigen.
      panelenVoorstel: connectionStore?.current?.dak == null && !connectionStore?.current?.daken?.vlakken.length && metingNu() != null,
      // Een vlak dat op minstens drie zonnige dagen achterbleef (stap 5).
      dakAchter: (() => {
        const a = vlakMetingNu()?.achter;
        return a && a.dagen >= 3 ? { letter: a.letter, wanneer: a.wanneer, minderPct: a.minderPct, eigenMeter: a.eigenMeter } : null;
      })(),
      // De wintertest is van het huis met een oude regeling ernaast (besluit 312): alleen daar de mijlpalen van 10, 20 en 30.
      winterdagen: cfg.migration?.legacyExplanation != null ? (analyse?.latest?.dataset?.seizoenen?.find((s) => s.seizoen === 'winter')?.dagen ?? null) : null,
      profiel: runner?.latest?.explanation.profile ?? null,
      hoofd: bewonersStore ? hoofdVan(bewonersStore.current) : null,
      sluip: sluipVoorBel(sluipverbruik.laatste(), Date.now(), cfg.timezone),
      // De auto (besluit 263): vol, een fout, kabel vergeten, en laden met de hand dat klaar is.
      ...autoBel(cfg.timezone),
      // De thuisaccu (besluit 276): stil, een fout, of vol terwijl de zon naar het net gaat.
      accus: accuBel(cfg),
      // De slimme stekkers (besluit 264): gevonden, en zijn meter bij Energie.
      stekkers: stekkerBel(cfg),
      // Wat niet klopt (besluit 314): uit de keuzes van nu, en wat mislukte.
      klopt: [
        ...kloptVast({
          answers: connectionStore?.current ?? null,
          configFasen: nodig.basisFasen,
          regelingNiet: nodig.regelingNiet,
          // Met de namen uit de indeling: een kamer heet zoals de bewoner hem noemde (0.190.0, "de zolder" was de wasruimte).
          config: webConfig() ?? cfg,
          kamerVanZone: (zoneId) => regelKamers(nodig.layoutNu?.()?.kamers ?? []).find((k) => k.regelzone === zoneId)?.id ?? null,
          // Een radiator of vloer die een thermostaat in een andere kamer volgt: dan verwarmt de kamer mee.
          meeMet: (zoneId) => verwarmtMeeMet(zoneId, cfg, nodig.layoutNu?.()?.kamers ?? []),
        }),
        ...klopt.lijst(Date.now()),
      ],
    });
    if (bron == null) return;
    meldingen.bij(bron);
    void meldingen.bewaar().catch(() => undefined);
    void pushRonde().catch(() => undefined);
    // Live naar de open pagina's: eerst zag je een nieuwe melding pas bij een andere tab.
    const vinger = JSON.stringify(meldingen.lijst(Date.now()).actief.map((m) => [m.id, m.titel, m.tekst]));
    if (vinger !== meldingenVinger) {
      meldingenVinger = vinger;
      nodig.web?.meldingenVeranderd();
    }
  }
  /** Wat de open pagina's als laatste aan meldingen hoorden; verandert het, dan zegt de dienst het. */
  let meldingenVinger: string | null = null;

  /*
   * Meldingen op de telefoon (besluit 183): na elke ronde van de bel kijken wat
   * er naar welke telefoon moet. In de add-on, of op een eigen server met
   * HEMS_DEUREN=1 (besluit 309); niet in het voorbeeldhuis.
   */
  const telefoonDeur = startup.deuren.enabled;
  const pushStore = logDir !== '' && telefoonDeur ? new PushStore(logDir) : null;
  await pushStore?.load();
  let telefoonsVoor: HouseRegisters | null = null;
  let telefoonsNu: Telefoon[] = [];
  /** De telefoons met de app van Home Assistant; opnieuw als de registers veranderen. */
  const telefoons = (): Telefoon[] => {
    if (!nodig.houseRegisters) return [];
    if (telefoonsVoor !== nodig.houseRegisters) {
      telefoonsNu = vindTelefoons(nodig.houseRegisters, allStates);
      telefoonsVoor = nodig.houseRegisters;
    }
    return telefoonsNu;
  };
  let pushBezig = false;
  async function pushRonde(): Promise<void> {
    if (!pushStore || !voorkeuren || !bewonersStore || !meldingen || pushBezig) return;
    pushBezig = true;
    try {
      const ontvangers = ontvangersVan(bewonersStore.current, voorkeuren, telefoons());
      const nu = Date.now();
      const l = meldingen.lijst(nu);
      const { berichten, verstuurd } = teSturen([...l.actief, ...l.eerder], ontvangers, pushStore.verstuurd, nu, nodig.siteConfig?.timezone ?? 'Europe/Amsterdam');
      for (const m of berichten) {
        try {
          const v = alsMelding(m, nodig.paneelPad);
          await client.callService('notify', m.dienst, v, {});
        } catch (error) {
          console.warn(`Melding naar ${m.dienst} lukte niet: ${(error as Error).message}`);
        }
      }
      await pushStore.save(verstuurd);
    } finally {
      pushBezig = false;
    }
  }
  /** Een proefmelding naar je eigen telefoon (besluit 183), vanaf Jij. */
  async function proefmelding(userId: string | null): Promise<{ ok: true; naam: string } | { ok: false; status: number; reden: string }> {
    if (!telefoonDeur) return { ok: false, status: 409, reden: 'meldingen op de telefoon gaan alleen vanuit de add-on, of met HEMS_DEUREN=1' };
    if (!userId || !voorkeuren) return { ok: false, status: 403, reden: 'log in met je eigen account' };
    const t = telefoonVan(userId, voorkeuren.meldingen(userId), telefoons());
    if (!t) return { ok: false, status: 404, reden: 'geen telefoon met de app van Home Assistant gevonden' };
    try {
      await client.callService('notify', t.dienst, alsMelding({ dienst: t.dienst, ...proefTekst(voorkeuren.taal(userId)), tag: 'smart-climate-proef', dringend: false, stil: false }, nodig.paneelPad), {});
      return { ok: true, naam: t.naam };
    } catch (error) {
      return { ok: false, status: 502, reden: (error as Error).message };
    }
  }
  if (meldingen) {
    setTimeout(meldingenRonde, 30_000).unref();
    setInterval(meldingenRonde, 60_000).unref();
  }
  return { meldingen, meldingenRonde, proefmelding, sluipverbruik, telefoonDeur, telefoons, voorkeuren };
}
