/**
 * De opties van de webserver (uit main.ts): wat elke route en elke pagina van de dienst krijgt. Alleen
 * verhuisd, niets veranderd. Wat in main.ts kan wijzigen (een `let`), komt via een getter (en setter) op
 * `mainStand`, zodat het altijd de stand van nu is; wat vastligt, wordt aan het begin uit `mainStand` gehaald.
 */
import { webPort, startup, webDir, logDir, inHuisMetDeuren, url, token } from './begin.js';
import { houseBeforeSetup, emptyAreasBeforeSetup, proposeLayout } from '../web/house.js';
import { type HaCoreConfig } from '../adapters/homeassistant/discovery.js';
import { accusNu } from '../web/opslag.js';
import { type Laadhand } from '../web/laadhand.js';
import { losseSensoren, leesLosseLaadpaal, metLaadpaal, schakelaarViews, leesSchakelaarKeuze, metKeuze, schakelaarsMag } from '../web/schakelaars.js';
import { type StekkerTot } from '../web/stekkerhand.js';
import { kiesVerstaan } from '../web/verstaan.js';
import { FeedbackLog } from '../web/feedback.js';
import { type Lang } from '../web/assistant.js';
import { profielenVan, type Wie, GEEN_BEWONERS, hoofdVan, bewonersView, leesActie, persoonsAccount, voerUit, herken as herkenBewoner, personenUit, gastStand } from '../web/bewoners.js';
import { controleerComfort, comfortView, type Comfort, type ComfortRoom, bijspringenView, controleerBijspringen } from '../web/comfort.js';
import { helpenView, controleerHelpen } from '../web/helpen.js';
import { leesZonBody, sleutelVan, volgordeVan, zonVerdelenView, type ZonAuto, type ZonVerdelenStore } from '../web/zon-verdelen.js';
import { type KlaarPunt } from '../web/klaarzetten.js';
import { klaarFuncties, wolkenVan, type WandMelding } from '../web/klaarzetten-functies.js';
import { writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { Stem } from '../web/stem.js';
import { httpBase } from '../web/camera.js';
import { volledig, getoondeCameras } from '../web/functies.js';
import { eigenUpdate } from '../web/bijwerken.js';
import { apparaatGegevens } from '../web/apparaat-gegevens.js';
import { WACHT_MS } from '../web/taalmodel.js';
import { haEnergySource } from '../adapters/homeassistant/energy.js';
import type { WebOptions } from '../web/server.js';
import type { SiteConfig } from '../core/model.js';
import type { MainStand } from '../main.js';
import { perTaal } from '../taal/index.js';

/** Losse zinnen van dit bestand, per taal (besluit 344). */
const TAAL_ZIN = perTaal('algemeen');

/** De zon verdelen (besluit 343): de lijst zoals de pagina hem toont, en bewaren. */
function zonVerdelenOptie(mainStand: MainStand, store: ZonVerdelenStore): NonNullable<WebOptions['zonVerdelen']> {
  const { comfortStore, configWithComfort, runner, allStates, huisNu, webConfig } = mainStand;
  const autos = (): ZonAuto[] =>
    (huisNu('nl')?.opslag?.autos ?? []).map((a) => ({
      id: a.id,
      naam: a.paalNaam ?? a.naam,
      laadpaal: a.laadpaal != null,
      minW: a.paalStroomA ? a.paalStroomA.min * 230 : null,
      aangesloten: a.aangesloten,
      laadt: a.laadt,
      vermogenW: a.vermogenW,
    }));
  const gemeten = (entiteit: string): number | null => {
    const s = allStates.get(entiteit);
    const w = Number(s?.state);
    if (s == null || !Number.isFinite(w)) return null;
    return String(s.attributes?.['unit_of_measurement'] ?? 'W') === 'kW' ? w * 1000 : w;
  };
  const volgorde = (config: SiteConfig) => volgordeVan(comfortStore?.current?.voorrang?.zon, comfortView(config, comfortStore?.current ?? null).voorrang.zon, autos());
  const view = () => {
    const config = webConfig() ?? mainStand.siteConfig!;
    const tz = config.timezone ?? 'Europe/Amsterdam';
    return zonVerdelenView({
      config,
      snapshot: runner?.latest ?? null,
      volgorde: volgorde(config),
      autos: autos(),
      keuzes: store.current,
      gemeten,
      nowMs: Date.now(),
      vandaag: new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()),
    });
  };
  return {
    view,
    save: async (body: unknown) => {
      const config = mainStand.siteConfig!;
      const nu = volgorde(config);
      const check = leesZonBody(body, new Set(nu.map(sleutelVan)));
      if (!check.ok) return { ok: false as const, status: 400, reden: check.reden };
      const { volgorde: nieuw } = check.body;
      if (nieuw && nieuw.length !== nu.length) return { ok: false as const, status: 400, reden: 'de volgorde is de hele lijst' };
      if (nieuw && comfortStore) {
        // Zoals Op zon bij Klimaat › Voorrang: naar comfort, en zo naar de regeling (zonder de laadpaal).
        const huidig = comfortStore.current ?? { versie: 1 as const, kamers: {} };
        const gewoon = comfortView(config, huidig).voorrang;
        const comfort: Comfort = { ...huidig, voorrang: { koelen: huidig.voorrang?.koelen ?? gewoon.koelen, verwarmen: huidig.voorrang?.verwarmen ?? gewoon.verwarmen, zon: nieuw } };
        const met = await configWithComfort(comfort);
        if (!met.ok) return { ok: false as const, status: 400, reden: `past niet in de regeling: ${met.reden}` };
        if (runner && !runner.setConfig(met.config, allStates.values())) return { ok: false as const, status: 409, reden: 'de regeling kon het niet overnemen; het gaat in na de volgende start' };
        await comfortStore.save(comfort);
        mainStand.siteConfig = met.config;
      }
      if (check.body.marge || check.body.hand || check.body.uit) await store.save(store.met(check.body));
      return { ok: true as const, view: view() };
    },
  };
}

export function webOpties(mainStand: MainStand, port: number): WebOptions {
  const {
    WAND_BESTAND, accuNuW, addOnStand, allStates, analyse, assistentAan, baseConfig, bewonersStore, bufferStore,
    camerasAlle, camerasLijst, client, comfortStore, comfortVoor, configWithComfort, connectionStore, coverSwitch,
    dakenOpbrengst, deurbelNu, eigenPoort, energyStore, fasenNuView, forecastNow, functiesKeuzes, functiesNu,
    functiesStore, gegevens, handKnoppen, handSchakelaars, handbediening, helpenDag, herlaadUitDeApp, herstart,
    historieVan, houseReport, houseStates, huisNu, integratie, integratieStand, kinderslotten, klaarPunten,
    klimaatAan, klimaatBrug, laadReg, laadadviezen, laadbeurten, laadhand, layoutStore, lightSwitch, losKlimaat,
    meldingen, modelTeller, onboarding, openMeteo, pauzeVan, proefmelding, reserveBeelden, runner, scenePictures,
    schakelaarKeuzes, schakelaarStore, sleutel, sluipverbruik, stekkerZon, stekkerhand, stemInHuis, teDoen, telefoons,
    uitstelStore, updateNu, version, verstaan, vindSchakelaarsNu, voorbeeld, voorkeuren, weatherLog, webConfig,
    weerNaam, weerZone, wekwoordNu, zoekUpdates, zonVerdelenStore,
  } = mainStand;
  return {
    access: mainStand.access,
    ...(voorbeeld ? { voorbeeld } : {}),
    ...(mainStand.witgoed ? { witgoed: mainStand.witgoed } : {}),
    ...(eigenPoort ? { eigenPoort } : {}),
    ...(gegevens ? { gegevens } : {}),
    port,
    host: startup.web.host,
    webDir,
    config: mainStand.site?.config ?? null,
    latest: () => runner?.latest ?? null,
    ...(analyse ? { divergence: () => analyse.latest } : {}),
    // Alleen wanneer er werkelijk gelogd wordt; anders geen exportknop.
    ...(logDir === '' ? {} : { logDir }),
    ...(onboarding
      ? {
          onboarding,
          // Het welkom in een leeg huis (besluit 154): het huis uit Home Assistant, en na het opslaan opnieuw starten.
          welkomHuis: () => (mainStand.siteConfig == null && mainStand.houseRegisters ? houseBeforeSetup(mainStand.houseRegisters, houseStates, Intl.DateTimeFormat().resolvedOptions().timeZone) : null),
          // De gebieden die nog leeg zijn, zodat 0 ruimtes niet lijkt alsof SunArc ze niet ziet.
          welkomLegeRuimtes: () => (mainStand.siteConfig == null && mainStand.houseRegisters ? emptyAreasBeforeSetup(mainStand.houseRegisters, houseStates, Intl.DateTimeFormat().resolvedOptions().timeZone) : []),
          naOnboarding: herstart,
        }
      : {}),
    location: () => mainStand.location,
    // De precieze plek alleen na een tik op de kaart (besluit 254); niet bewaard.
    exacteLocatie: () =>
      client.query<HaCoreConfig>('get_config').then((c) => (typeof c.latitude === 'number' && typeof c.longitude === 'number' ? { latDeg: c.latitude, lonDeg: c.longitude } : null)),
    historie: historieVan,
    laadbeurten: (auto: string) => laadbeurten.van(auto),
    laadadvies: laadadviezen,
    // De fasekaart (besluit 302): alleen lezen.
    fasen: fasenNuView,
    // De thuisaccu's (besluit 272): wat ze nu doen, en hun tellers voor Opbrengst.
    accu: {
      nuW: accuNuW,
      meters: () => {
        const lijst = mainStand.houseRegisters ? accusNu(laadReg(mainStand.houseRegisters), allStates, connectionStore?.current?.laden ?? null, connectionStore?.current?.accu ?? null) : [];
        return {
          geladen: lijst.flatMap((a) => (a.sensoren.geladen ? [a.sensoren.geladen] : [])),
          geleverd: lijst.flatMap((a) => (a.sensoren.geleverd ? [a.sensoren.geleverd] : [])),
        };
      },
    },
    // Laden met de hand (besluit 262): alleen met de deuren open (add-on of HEMS_DEUREN, besluit 309); zonder HEMS_DEUREN laat een eigen server het blad zonder knoppen zien.
    ...(laadhand
      ? {
          laden: {
            standen: async () => (await Promise.all((huisNu('nl')?.opslag?.autos ?? []).map((a) => laadhand.stand(a.id)))).filter((x) => x != null),
            zet: (id: string, v: Parameters<Laadhand['zet']>[1]) => laadhand.zet(id, v),
            terug: (id: string) => laadhand.terugNu(id),
          },
        }
      : {}),
    // Een slimme stekker met de hand (besluit 265): de stand overal, schakelen alleen met de deuren open (add-on of HEMS_DEUREN, besluit 309).
    // Een laadpaal uit losse sensoren (besluit 301): de keuzes in het eigen bestand van de schakelaars.
    losseLaadpalen: {
      lijst: () => ({ laadpalen: schakelaarStore?.current?.laadpalen ?? {}, sensoren: mainStand.houseRegisters ? losseSensoren(mainStand.houseRegisters.entities, allStates) : [] }),
      bewaar: async (body: unknown) => {
        if (!schakelaarStore) return { ok: false as const, reden: 'er is geen map om de keuze te bewaren' };
        const l = leesLosseLaadpaal(body);
        if (!l.ok) return l;
        await schakelaarStore.save(metLaadpaal(schakelaarStore.current, l.id, l.laadpaal));
        return { ok: true as const };
      },
    },
    // Het kinderslot in het blad (besluit 299): zien overal, zetten alleen met de deuren open (add-on of HEMS_DEUREN, besluit 309).
    kinderslot: {
      lijst: () => kinderslotten(),
      ...(inHuisMetDeuren
        ? {
            zet: async (slot: string, aan: boolean) => {
              if (!Object.values(kinderslotten()).some((s) => s.id === slot)) return { ok: false as const, reden: 'dat is geen kinderslot dat het huis kent' };
              try {
                await client.callService('switch', aan ? 'turn_on' : 'turn_off', {}, { entity_id: slot });
                return { ok: true as const };
              } catch (e) {
                return { ok: false as const, reden: `Home Assistant nam het niet aan: ${(e as Error).message}` };
              }
            },
          }
        : {}),
    },
    schakelaars: {
      lijst: () => schakelaarViews(vindSchakelaarsNu(), schakelaarKeuzes(), allStates),
      verborgen: () => vindSchakelaarsNu().filter((g) => schakelaarKeuzes().geen.includes(g.id)).map((g) => ({ id: g.id, naam: g.naam })),
      bewaar: async (body) => {
        if (!schakelaarStore) return { ok: false as const, reden: 'er is geen map om de keuze te bewaren' };
        const k = leesSchakelaarKeuze(body);
        if (!k.ok) return k;
        if (!vindSchakelaarsNu().some((g) => g.id === k.id) && k.keuze !== 'weg') return { ok: false as const, reden: 'die schakelaar kent het huis niet' };
        await schakelaarStore.save(metKeuze(schakelaarStore.current, k.id, k.keuze));
        return { ok: true as const };
      },
      // Met de hand aan of uit (besluit 297): alleen met de deuren open (add-on of HEMS_DEUREN, besluit 309), alleen een knop die de bewoner toeliet.
      ...(inHuisMetDeuren
        ? {
            zet: async (knop: string, aan: boolean) => {
              if (!schakelaarsMag(vindSchakelaarsNu(), schakelaarKeuzes()).includes(knop)) return { ok: false as const, reden: 'deze schakelaar mag SunArc niet bedienen' };
              try {
                await client.callService('switch', aan ? 'turn_on' : 'turn_off', {}, { entity_id: knop });
                return { ok: true as const };
              } catch (e) {
                return { ok: false as const, reden: `Home Assistant nam het niet aan: ${(e as Error).message}` };
              }
            },
          }
        : {}),
    },
    stekkers: {
      standen: async () =>
        (await stekkerhand.standen(inHuisMetDeuren)).map((s) => {
          const gehad = bufferStore?.aanGehad(s.id) ?? null;
          const min = (mainStand.siteConfig?.heatStores ?? []).find((h) => h.id === s.id)?.minimum;
          return { ...s, zon: stekkerZon.stand(s.id), ...(min ? { minimum: { minuten: min.minutes, klok: min.by } } : {}), ...(gehad != null ? { gehadMin: gehad } : {}) };
        }),
      ...(inHuisMetDeuren ? { zet: (id: string, aan: boolean, tot: StekkerTot) => stekkerhand.zet(id, aan, tot), terug: (id: string) => stekkerhand.terugNu(id), uit: (id: string) => stekkerhand.uitNu(id) } : {}),
    },
    dakenOpbrengst,
    sluipverbruik,
    house: houseReport,
    ...(lightSwitch ? { lights: lightSwitch } : {}),
    ...(coverSwitch ? { covers: coverSwitch } : {}),
    ...(klimaatBrug ? { klimaat: { brug: klimaatBrug, aan: klimaatAan } } : {}),
    ...(handbediening ? { hand: { hand: handbediening, aan: klimaatAan, schakelaars: handSchakelaars, knoppen: handKnoppen, los: losKlimaat } } : {}),
    verstaanInHuis: () => kiesVerstaan([...allStates.keys()]),
    ...(layoutStore && mainStand.siteConfig
      ? {
          layout: {
            store: layoutStore,
            proposal: () => (mainStand.houseRegisters ? proposeLayout(mainStand.siteConfig!, mainStand.houseRegisters, houseStates) : null),
          },
        }
      : {}),
    // Gevoel en toelichting (besluit 84): alleen als er gelogd wordt, want ze
    // horen bij de dataset, en alleen naar een eigen bestand in de logmap.
    ...(logDir !== '' && mainStand.site
      ? { feedback: new FeedbackLog({ logDir, zoneIds: () => (mainStand.siteConfig ?? mainStand.site!.config).zones.map((z) => z.id) }) }
      : {}),
    ...(uitstelStore ? { uitstel: uitstelStore } : {}),
    ...(bufferStore ? { buffers: bufferStore } : {}),
    ...(meldingen ? { meldingen } : {}),
    ...(voorkeuren ? { voorkeuren } : {}),
    deurbel: deurbelNu,
    cameras: camerasLijst,
    camerasAlle,
    // Meldingen op de telefoon (besluit 183): welke telefoons er zijn, en een proefmelding.
    telefoons: (userId: string | null) => telefoons().map((t) => ({ id: t.id, naam: t.naam, eigen: userId != null && t.account === userId })),
    proefmelding,
    ...(integratie ? { integratie: { stand: integratieStand, zetNeer: () => integratie.zetNeer(), ...(assistentAan ? { aanzetten: { stand: () => assistentAan.stand, start: () => void assistentAan.start() } } : {}) } } : {}),
    ...(stemInHuis ? { stemInHuis: { stand: () => stemInHuis.stand(), start: (lang: Lang) => void stemInHuis.start(lang) } } : {}),
    // Het profiel (besluit 181): de bewoners op volgorde en wiens comfort geldt, voor de wand en de kleuren.
    ...(voorkeuren && bewonersStore
      ? {
          profielen: (userId: string | null) => profielenVan(bewonersStore.current, runner?.latest?.explanation.profile?.id ?? null, userId),
        }
      : {}),
    ...(scenePictures ? { scenePicturesDir: scenePictures.dir } : {}),
    // De zon en je aansluiting (besluit 103): alleen met een logmap en een configuratie.
    ...(connectionStore && baseConfig ? { connection: mainStand.connectionDoor(connectionStore, baseConfig) } : {}),
    // Wat de app laat zien, heet zoals in de indeling (besluit 131).
    configNow: webConfig,
    ...(comfortStore && mainStand.siteConfig
      ? {
          comfort: {
            view: (wie: Wie, bewoner: string | null) => comfortVoor(wie, bewoner).view,
            save: async (body: unknown, wie: Wie, bewoner: string | null) => {
              const doel = comfortVoor(wie, bewoner);
              if (!doel.view.van?.magAanpassen && doel.view.van != null) return { ok: false as const, status: 403, reden: 'alleen je eigen comfort, of als hoofdgebruiker' };
              const check = controleerComfort(body, mainStand.siteConfig!);
              if (!check.ok) return { ok: false as const, status: 400, reden: check.reden };
              const huidig = comfortStore.current;
              const b = bewonersStore?.current ?? GEEN_BEWONERS;
              let comfort: Comfort;
              let bewoners = b;
              if (doel.id == null || doel.id === hoofdVan(b)?.id) {
                // Het comfort van het huis, van de hoofdgebruiker; de eigen comforts blijven.
                // Bijspringen (besluit 283) komt van Regeling, niet van deze pagina: dat blijft ook.
                comfort = { ...check.comfort, ...(huidig?.profielen ? { profielen: huidig.profielen } : {}), ...(huidig?.bijspringen ? { bijspringen: huidig.bijspringen } : {}), ...(huidig?.helpen ? { helpen: huidig.helpen } : {}) };
                // De volgorde op zon komt van Energie › De zon verdelen (besluit 343): die blijft.
                const zon = huidig?.voorrang?.zon;
                if (zon && comfort.voorrang && !comfort.voorrang.zon) comfort = { ...comfort, voorrang: { ...comfort.voorrang, zon } };
              } else {
                // Een eigen comfort (besluit 147): alleen de doelen en het plafond per kamer.
                const eigen: Record<string, ComfortRoom> = Object.fromEntries(Object.entries(check.comfort.kamers).map(([k, v]) => [k, { modi: v.modi, ...(v.nooitWarmerC !== undefined ? { nooitWarmerC: v.nooitWarmerC } : {}) }]));
                comfort = { ...(huidig ?? { versie: 1, kamers: {} }), profielen: { ...huidig?.profielen, [doel.id]: eigen } };
                bewoners = { ...b, bewoners: { ...b.bewoners, [doel.id]: { ...b.bewoners[doel.id]!, comfort: 'eigen' } } };
              }
              const met = await configWithComfort(comfort, bewoners);
              if (!met.ok) return { ok: false as const, status: 400, reden: `past niet in de regeling: ${met.reden}` };
              if (runner && !runner.setConfig(met.config, allStates.values())) return { ok: false as const, status: 409, reden: 'de regeling kon het niet overnemen; het gaat in na de volgende start' };
              await comfortStore.save(comfort);
              if (bewoners !== b) await bewonersStore!.save(bewoners);
              mainStand.siteConfig = met.config;
              return { ok: true as const, view: comfortVoor(wie, doel.id).view };
            },
          },
          // Helpen bij de cv (besluit 292): van het huis, net als bijspringen.
          helpen: {
            // Met de namen uit de indeling: de kamer heet zoals de bewoner hem noemde (0.190.2, "Zolder" was de wasruimte).
            view: () => {
              const v = helpenView(webConfig() ?? mainStand.siteConfig!, runner?.latest ?? null, helpenDag, Date.now());
              // Alleen airco's (besluit 342): geen ketel, dus geen airco's die hem helpen.
              return connectionStore?.current?.verwarming?.soort === 'airco' ? { ...v, aircos: [] } : v;
            },
            save: async (body: unknown) => {
              const check = controleerHelpen(body, mainStand.siteConfig!);
              if (!check.ok) return { ok: false as const, status: 400, reden: check.reden };
              const huidig = comfortStore.current ?? { versie: 1 as const, kamers: {} };
              const comfort: Comfort = { ...huidig, helpen: check.waarde };
              const met = await configWithComfort(comfort);
              if (!met.ok) return { ok: false as const, status: 400, reden: `past niet in de regeling: ${met.reden}` };
              if (runner && !runner.setConfig(met.config, allStates.values())) return { ok: false as const, status: 409, reden: 'de regeling kon het niet overnemen; het gaat in na de volgende start' };
              await comfortStore.save(comfort);
              mainStand.siteConfig = met.config;
              return { ok: true as const, view: helpenView(webConfig() ?? met.config, runner?.latest ?? null, helpenDag, Date.now()) };
            },
          },
          // De zon verdelen (besluit 343): de volgorde gaat zoals Op zon naar de regeling; de marge en de hand worden bewaard.
          ...(zonVerdelenStore ? { zonVerdelen: zonVerdelenOptie(mainStand, zonVerdelenStore) } : {}),
          // Bijspringen per kamer (besluit 283): van het huis, dus wie het comfort van het huis mag aanpassen.
          bijspringen: {
            view: () => bijspringenView(mainStand.siteConfig!),
            // Wie mag, toetst de route: de beheerder, net als de rest van Regeling.
            save: async (body: unknown) => {
              const check = controleerBijspringen(body, mainStand.siteConfig!);
              if (!check.ok) return { ok: false as const, status: 400, reden: check.reden };
              const huidig = comfortStore.current ?? { versie: 1 as const, kamers: {} };
              const comfort: Comfort = { ...huidig, bijspringen: { ...huidig.bijspringen, [check.zone]: check.waarde } };
              const met = await configWithComfort(comfort);
              if (!met.ok) return { ok: false as const, status: 400, reden: `past niet in de regeling: ${met.reden}` };
              if (runner && !runner.setConfig(met.config, allStates.values())) return { ok: false as const, status: 409, reden: 'de regeling kon het niet overnemen; het gaat in na de volgende start' };
              await comfortStore.save(comfort);
              mainStand.siteConfig = met.config;
              return { ok: true as const, view: bijspringenView(met.config) };
            },
          },
        }
      : {}),
    ...(bewonersStore && mainStand.siteConfig
      ? {
          bewoners: {
            view: (wie: Wie) => bewonersView(bewonersStore.current, wie, mainStand.siteConfig!.occupancy, (id) => allStates.get(id), runner?.latest?.explanation.profile ?? null),
            actie: async (body: unknown, wie: Wie & { readonly naam: string }) => {
              const a = leesActie(body);
              if (a == null) return { ok: false as const, status: 400, reden: 'dat is geen actie die de app kent' };
              const thuis = runner?.latest?.explanation.profile?.home ?? [];
              const bronAccount = (id: string) => { const o = mainStand.siteConfig!.occupancy.find((x) => x.id === id); return o ? persoonsAccount(o, (e) => allStates.get(e)) : null; };
              const uit = voerUit(bewonersStore.current, comfortStore?.current ?? null, a, wie, mainStand.siteConfig!.occupancy, thuis, Date.now(), bronAccount);
              if (!uit.ok) return uit;
              const comfort = uit.comfort !== undefined ? uit.comfort : (comfortStore?.current ?? null);
              const met = await configWithComfort(comfort, uit.bewoners);
              if (!met.ok) return { ok: false as const, status: 400, reden: `past niet in de regeling: ${met.reden}` };
              if (runner && !runner.setConfig(met.config, allStates.values())) return { ok: false as const, status: 409, reden: 'de regeling kon het niet overnemen; het gaat in na de volgende start' };
              if (uit.comfort !== undefined && uit.comfort != null) await comfortStore?.save(uit.comfort);
              await bewonersStore.save(uit.bewoners);
              mainStand.siteConfig = met.config;
              return { ok: true as const, view: bewonersView(uit.bewoners, wie, mainStand.siteConfig.occupancy, (id) => allStates.get(id), runner?.latest?.explanation.profile ?? null) };
            },
            herken: async (account: { readonly userId: string; readonly naam: string }) => {
              const r = herkenBewoner(bewonersStore.current, account, personenUit(allStates.values()), mainStand.siteConfig!.occupancy, Date.now());
              if (r.soort === 'vraag') return 'vraag' as const;
              // Zonder persoon in Home Assistant een gast (besluit 151); de hoofdgebruiker kan er een bewoner van maken.
              if (r.soort === 'gast') {
                await bewonersStore.save(r.bewoners);
                return 'gast' as const;
              }
              if (r.soort !== 'bewoner' || !r.nieuw) return null;
              await bewonersStore.save(r.bewoners);
              await herlaadUitDeApp('een nieuwe bewoner');
              return 'welkom' as const;
            },
            // Een gast (besluit 147): thuis volgens zijn aanwezigheid in Home Assistant.
            gast: (userId: string | null) => gastStand(bewonersStore.current, userId, mainStand.siteConfig!.occupancy, (id) => allStates.get(id)),
          },
        }
      : {}),
    ...(sleutel ? { sleutel } : {}),
    // Klaarzetten in Home Assistant (besluit 179): tellen wat er staat, nooit een entiteit noemen.
    klaarzetten: (lang?: Lang) => klaarPunten(lang),
    // Klaarzetten per niveau (besluit 246): per functie de stappen, met wat de wand zelf meldt.
    klaarFuncties: async (punten: readonly KlaarPunt[], lang?: Lang) => {
      const [inHuis, addons] = await Promise.all([stemInHuis ? stemInHuis.stand().catch(() => null) : null, addOnStand()]);
      // Per bewoner (stap 4 punt 2): staat het bij iemand aan, dan is het er.
      const alleNiemand = voorkeuren?.alleNiemand() ?? [];
      const niemand = alleNiemand.find((n) => n.nacht || n.weg) ?? alleNiemand[0] ?? null;
      const taal = lang ?? 'nl';
      return klaarFuncties(punten, {
        addOn: version.installatie === 'add-on',
        eigenPoort: eigenPoort != null,
        eigenSlug: mainStand.eigenSlug,
        inHuis,
        whisperModel: addons.whisper === undefined ? undefined : addons.whisper == null ? null : typeof addons.whisper.opties['model'] === 'string' ? addons.whisper.opties['model'] : null,
        tailscale: addons.tailscale == null ? null : addons.tailscale.draait,
        wand: mainStand.wandMelding,
        heeftWand: mainStand.wandMelding != null || Object.keys(bewonersStore?.current.schermen ?? {}).length > 0,
        schermUit: niemand != null && (niemand.nacht || niemand.weg),
        wekker: alleNiemand.find((n) => n.melder != null)?.melder ?? null,
        wolken: wolkenVan(mainStand.houseRegisters?.entities ?? []),
        spraak: mainStand.spraakLijst,
        tijd: (ms) => new Intl.DateTimeFormat(TAAL_ZIN[taal].locale, { hour: '2-digit', minute: '2-digit', timeZone: weerZone }).format(new Date(ms)),
      }, lang);
    },
    // De wand meldt zelf of hij in Fully Kiosk draait (besluit 246); bewaard naast het logboek.
    wandMeldt: (m: Omit<WandMelding, 'ms'>) => {
      mainStand.wandMelding = { ...m, ms: Date.now() };
      if (WAND_BESTAND) void writeFile(WAND_BESTAND, `${JSON.stringify(mainStand.wandMelding)}\n`, 'utf-8').catch(() => undefined);
    },
    // In de add-on stelt Home Assistant de vraag rechtstreeks aan de add-on, op zijn naam in het netwerk (besluit 177).
    ...(sleutel && version.installatie === 'add-on' && webPort != null ? { sleutelAdres: `http://${hostname()}:${webPort}/api/vraag` } : {}),
    ...(weatherLog ? { weather: { forecast: forecastNow, log: weatherLog, bron: weerNaam, uren: () => openMeteo.latest?.uren ?? null } } : {}),
    // De stem van het huis (besluit 141): Piper in Home Assistant; er wordt niets geschakeld.
    stem: new Stem({
      base: httpBase(url!),
      token: token!,
      // De stem die de bewoner koos bij Functies (besluit 212); null is vanzelf.
      keuze: () => {
        const f = functiesNu();
        return f ? volledig(f, functiesKeuzes()).praten.stemKeuze : null;
      },
      stemmen: () => [...allStates.keys()].filter((id) => id.startsWith('tts.')),
      // Welke talen en stemmen Piper heeft: lezen, zoals de registers.
      talen: async (stem) => {
        const r = await client.query<{ providers?: { engine_id: string; supported_languages?: string[] }[] }>('tts/engine/list');
        return r.providers?.find((p) => p.engine_id === stem)?.supported_languages ?? [];
      },
      stemmenVoor: async (stem, taal) => (await client.query<{ voices?: { voice_id: string; name: string }[] | null }>('tts/engine/voices', { engine_id: stem, language: taal })).voices ?? [],
    }),
    // Bijwerken vanuit de app: alleen in de add-on.
    ...(version.installatie === 'add-on'
      ? {
          bijwerken: {
            view: updateNu,
            installeer: async () => {
              const s = eigenUpdate(allStates.values());
              if (!s || s.state !== 'on') return { ok: false, reden: 'er staat geen nieuwe versie klaar' };
              if (s.attributes['in_progress'] === true) return { ok: true };
              // Niet wachten: de Supervisor start de add-on opnieuw, en dan valt de verbinding weg.
              void client.callService('update', 'install', {}, { entity_id: s.entity_id }).catch((e: unknown) => console.warn(`Bijwerken: ${(e as Error).message}`));
              return { ok: true };
            },
            zoek: zoekUpdates,
          },
        }
      : {}),
    // Opnieuw starten (testerronde, november 2026): een keuze bij Energie gaat pas bij de start in.
    herstart,
    // Deel apparaatgegevens (testerronde, november 2026): alleen het soort apparaat, geen namen.
    apparaatGegevens: (id) => (mainStand.houseRegisters ? apparaatGegevens(id, allStates, mainStand.houseRegisters.entities, mainStand.houseRegisters.devices) : null),
    // De stand (besluit 287): welke knop het huis op Handmatig zet, en sinds wanneer het vakantie is.
    toestand: (id) => {
      const s = allStates.get(id);
      if (!s) return null;
      const naam = s.attributes['friendly_name'];
      const sinds = Date.parse(s.last_changed);
      return { state: s.state, naam: typeof naam === 'string' ? naam : null, sindsMs: Number.isFinite(sinds) ? sinds : null };
    },
    // De camera's bekijken (besluit 106): alleen lezen, alleen met inlog.
    camera: {
      base: httpBase(url!),
      token: token!,
      // De camera's die de app toont, en die van de deurbel (besluit 109).
      ids: () => {
        const f = functiesNu();
        // Sinds 20 november 2026 ook de andere camera's uit Home Assistant: Apparaten toont ze allemaal.
        const alle = (functiesKeuzes()?.cameras ?? []).flatMap((c) => c.beelden.map((b) => b.id));
        return new Set(f ? [...getoondeCameras(f), ...alle, ...(f.deurbel.aan && f.deurbel.camera ? [f.deurbel.camera, ...reserveBeelden(f.deurbel.camera)] : [])] : []);
      },
    },
    ...(functiesStore ? { functies: { store: functiesStore, gevonden: functiesKeuzes } } : {}),
    // Licht bedienen aan of uit in de app (besluit 111), binnen wat HEMS_LIGHTS toestaat.
    lichtAan: () => {
      const f = functiesNu();
      return f ? volledig(f, functiesKeuzes()).licht.bedienen : true;
    },
    // Schermen bedienen aan of uit in de app (besluit 121), binnen wat HEMS_SCREENS toestaat.
    schermenAan: () => {
      const f = functiesNu();
      return f ? volledig(f, functiesKeuzes()).schermen.bedienen : true;
    },
    // Praten met je stem (besluit 150): geluid naar Home Assistant, tot tekst.
    luisteren: {
      start: (opts) => client.listen(opts),
      pipeline: () => {
        const f = functiesNu();
        return f ? volledig(f, functiesKeuzes()).praten.spraak : null;
      },
      wekwoord: wekwoordNu,
      // Rechtstreeks uitschrijven met Whisper in huis (besluit 211); zonder spraak naar tekst in huis via de spraakassistent.
      uitschrijven: () => {
        const e = kiesVerstaan([...allStates.keys()]);
        return e ? (pcm, lang) => verstaan.tekst(e, pcm, lang) : null;
      },
    },
    // Praten met je huis (besluit 148): de AI-taak die bij Functies gekozen is, standaard uit.
    // Te doen (besluit 216): herinneringen, de lijsten en agenda's van Home Assistant.
    tedoen: teDoen,
    praten: {
      model: () => {
        const f = functiesNu();
        const id = f ? volledig(f, functiesKeuzes()).praten.taalmodel : null;
        return id && allStates.has(id) ? pauzeVan(id).om(modelTeller.om((opdracht, velden) => client.generateData(id, opdracht, velden))) : null;
      },
      proef: (id) => pauzeVan(id).om(modelTeller.om((opdracht, velden) => client.generateData(id, opdracht, velden))),
      // Hoeveel vragen en hoe snel (besluit 213), voor Functies.
      teller: () => modelTeller.stand(),
      // Te traag voor eigen woorden: dan meteen het vaste antwoord, in plaats van wachten.
      eigenWoorden: () => modelTeller.eigenWoordenNu(WACHT_MS),
      // Na "gebruik op" of "te druk" even niet vragen, per AI-taak (besluit 148).
      pauze: (id) => pauzeVan(id).stand,
      bedienen: () => {
        const f = functiesNu();
        return f ? volledig(f, functiesKeuzes()).praten.bedienen : true;
      },
    },
    // Opbrengst (besluit 102): meters en prijzen naast de dataset, de cijfers uit Home Assistant.
    ...(energyStore ? {
          energy: {
            store: energyStore,
            naBewaren: () => herlaadUitDeApp('andere prijzen'),
            source: haEnergySource(
              client,
              (id) => allStates.get(id),
              (id) => mainStand.houseRegisters?.entities.find((e) => e.entity_id === id)?.platform ?? null,
              () => allStates.values(),
              // Opgewekt uit de omvormers; een meetpunt met een attribuut heeft geen statistiek.
              () => (mainStand.siteConfig?.solarProduction ? [mainStand.siteConfig.solarProduction, ...(mainStand.siteConfig.solarExtra ?? [])].filter((p) => !p.attribute).map((p) => p.id) : []),
            ),
          },
        } : {}),
    version,
  };
}
