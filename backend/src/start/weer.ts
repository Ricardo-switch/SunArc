/**
 * Het weer (uit main.ts, 23 november 2026; besluit 105): de verwachting uit Home Assistant of Open-Meteo, en elke tien
 * minuten de zonkans van morgen bewaren. Alleen verhuisd.
 */
import { logDir } from './begin.js';
import { WeatherLog, type EntityForecast, dagenUitUren } from '../web/weather.js';
import { volledig } from '../web/functies.js';
import { OpenMeteo, OPEN_METEO } from '../web/open-meteo.js';
import { weerNaamVan, verwachtingVan } from '../web/weerbron.js';
import { partsIn, zonedMidnight } from '../web/today.js';
import type { MaakWeerNodig } from '../main.js';

export function maakWeer(nodig: MaakWeerNodig) {
  const {
    allStates, baseConfig, client, functiesKeuzes, functiesNu, klopt,
  } = nodig;
  /*
   * Het weer van de komende dagen (besluit 105). Elke tien minuten de zonkans
   * van morgen bewaren, ook als niemand kijkt: na die dag legt het huis hem naast
   * wat de panelen werkelijk haalden.
   */
  const weatherLog = logDir === '' ? null : new WeatherLog(logDir);
  /*
   * Waar het weer vandaan komt (besluit 111): Buienradar, of een weerentiteit
   * van Home Assistant, zoals de bewoner koos. Van een weerentiteit volgt de
   * dienst de dagverwachting; die komt alleen via een abonnement.
   */
  // Zonder configuratie de tijdzone van de dienst; in de add-on is dat die van Home Assistant (run.sh).
  const weerZone: string = baseConfig?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  let entityForecast: { entity: string | null; days: EntityForecast[] } = { entity: null, days: [] };
  client.on('forecast', (entity, lijst, soort) => {
    // Geeft de entiteit uren of halve dagen, dan maakt de dienst er zelf dagen van.
    const days = soort === 'daily' ? (lijst as EntityForecast[]) : dagenUitUren(lijst as EntityForecast[], weerZone);
    entityForecast = { entity, days };
  });
  const weerBron = (): string | null => {
    const f = functiesNu();
    return f ? volledig(f, functiesKeuzes()).weer.bron : null;
  };
  const volgWeer = () => {
    const bron = weerBron();
    const vanHa = bron?.startsWith('weather.') === true;
    client.followForecast(vanHa ? bron : null).then(
      () => {
        if (vanHa) klopt.weer(true, Date.now());
      },
      (e: unknown) => {
        if (vanHa) klopt.weer(false, Date.now());
        console.warn(`Verwachting van ${bron} niet te volgen: ${(e as Error).message}`);
      },
    );
  };
  setInterval(volgWeer, 60_000).unref();
  setTimeout(volgWeer, 15_000).unref();
  /*
   * Open-Meteo (besluit 127): het weer zonder Home Assistant. Elk uur de
   * verwachting per uur bewaren voor het thermisch model, tenzij de bewoner dat
   * bij Functies uitzette; en de dagverwachting als hij Open-Meteo als weerbron
   * koos. Alleen de ligging op één decimaal gaat de deur uit.
   */
  const openMeteo = new OpenMeteo({ location: () => nodig.location, timeZone: weerZone, logDir: logDir === '' ? null : logDir });
  const haalWeer = () => {
    const f = functiesNu();
    const w = f ? volledig(f, functiesKeuzes()).weer : null;
    if (w == null || (!w.uren && w.bron !== OPEN_METEO)) return;
    const gekozen = w.bron === OPEN_METEO;
    openMeteo.refresh(w.uren).then(
      () => {
        if (gekozen) klopt.weer(true, Date.now());
      },
      (e: unknown) => {
        if (gekozen) klopt.weer(false, Date.now());
        console.warn(`Weer van Open-Meteo niet opgehaald: ${(e as Error).message}`);
      },
    );
  };
  setInterval(haalWeer, 5 * 60_000).unref();
  setTimeout(haalWeer, 20_000).unref();
  // De naam en de dagverwachting van de gekozen bron (weerbron.ts).
  const weerNaam = (): string => weerNaamVan(weerBron(), allStates);
  const forecastNow = () =>
    verwachtingVan(weerBron(), { openMeteo: openMeteo.latest?.dagen ?? null, entities: nodig.houseRegisters?.entities ?? null, states: allStates, entiteit: entityForecast, nu: Date.now(), zone: weerZone });
  if (weatherLog && nodig.site) {
    const timeZone = nodig.site.config.timezone;
    const noteTomorrow = () => {
      // Met de weergave rekent die ook de verwachting van morgen uit en bewaart hem.
      if (nodig.web) {
        nodig.web.weatherNow().catch((e: unknown) => console.warn(`Weer van morgen niet bewaard: ${(e as Error).message}`));
        return;
      }
      const morgen = forecastNow().find((f) => f.offset === 1);
      if (morgen?.zonkansPct == null) return;
      const p = partsIn(Date.now(), timeZone);
      const d = partsIn(zonedMidnight(p.y, p.m, p.d + 1, timeZone) + 12 * 3_600_000, timeZone);
      const day = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      weatherLog.note(day, morgen.zonkansPct).catch((e: unknown) => console.warn(`Zonkans van morgen niet bewaard: ${(e as Error).message}`));
    };
    setInterval(noteTomorrow, 10 * 60_000).unref();
    setTimeout(noteTomorrow, 60_000).unref();
  }
  return { forecastNow, openMeteo, weatherLog, weerNaam, weerZone };
}
