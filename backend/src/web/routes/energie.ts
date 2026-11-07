/**
 * Energie: meters en prijzen, de aansluiting en de gevels op de kaart (besluiten 102 en 103).
 *
 * Geknipt uit server.ts (besluit 180, 23 oktober 2026): letterlijk, met de
 * context `d` in plaats van de webserver zelf.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { validateConnection } from '../aansluiting.js';
import { importFromPrefs, pricesInPrefs, type DashboardPrice, type MeterOption } from '../energy.js';
import { alBinnen, bagHuisEnOmgeving, haalBagVak, inNederland, naarRd, type BagDak, type BagDakvlak } from '../bag3d.js';
import type { Dakvorm, KaartStandWoord } from '../daken.js';
import { gevelsUitOmtrek, haalKaart, haalOmtrek, heeftGebouwen, huisEnOmgeving, kaartVak, voorkantUitKaart } from '../kaart.js';
import { readJson, sendJson } from '../http.js';
import { taalVan, type Diensten, type Verzoek } from '../diensten.js';

/** De routes van dit onderwerp; waar als het verzoek hier is afgehandeld. */
export async function energieRoutes(d: Diensten, v: Verzoek): Promise<boolean> {
  const { req, res, path, method } = v;
  if (path === '/api/energie') {
    await energieRoute(d, req, res, method);
    return true;
  }

  // De laadbeurten van een auto (besluit 259, stap 3): alleen lezen, uit de statistiek.
  if (path === '/api/laadbeurten') {
    const auto = v.url.searchParams.get('auto') ?? '';
    const lees = d.options.laadbeurten;
    if (!lees || !/^[A-Za-z0-9_.:-]{1,64}$/.test(auto)) {
      sendJson(res, lees ? 400 : 503, lees ? { fout: 'auto is het id van een auto' } : { wachten: 'laadbeurten komen van Home Assistant zodra die verbonden is' });
      return true;
    }
    const uit = await lees(auto).catch(() => null);
    sendJson(res, 200, { beurten: uit });
    return true;
  }

  // Het advies per auto (besluit 259, stap 4): alleen lezen, uit het net, de fasen en de prijzen van nu.
  if (path === '/api/laadadvies') {
    const lees = d.options.laadadvies;
    if (!lees) {
      sendJson(res, 503, { wachten: 'het advies komt van Home Assistant zodra die verbonden is' });
      return true;
    }
    sendJson(res, 200, { adviezen: lees() });
    return true;
  }

  // Laden met de hand (besluit 262): de stand per auto, of een stroom, pauze of terug.
  if (path === '/api/laden') {
    await ladenRoute(d, req, res, method);
    return true;
  }

  // Een slimme stekker met de hand (besluit 265): de stand, of aan of uit tot een tijd, of terug.
  if (path === '/api/stekker') {
    await stekkerRoute(d, req, res, method);
    return true;
  }

  if (path === '/api/aansluiting') {
    await aansluitingRoute(d, req, res, method);
    return true;
  }

  if (path === '/api/gevel-kaart' && method === 'POST') {
    await gevelKaartRoute(d, req, res);
    return true;
  }

  if (path === '/api/daken-kaart' && method === 'POST') {
    await dakenKaartRoute(d, res);
    return true;
  }

  return false;
}

export async function energieRoute(d: Diensten, req: IncomingMessage, res: ServerResponse, method: string): Promise<void> {
  const energy = d.options.energy;
  if (energy == null) {
    sendJson(res, 503, { wachten: 'Opbrengst staat niet aan' });
    return;
  }
  if (method === 'POST') {
    let body: unknown;
    try {
      body = await readJson(req);
    } catch (error) {
      sendJson(res, 400, { fout: (error as Error).message });
      return;
    }
    const result = await energy.store.save(body);
    d.yieldCache.clear();
    if (result.ok) sendJson(res, 200, result.settings);
    else sendJson(res, result.status, { fout: result.reden });
    return;
  }
  // Wat er staat, wat Home Assistant voorstelt, en de meters om uit te kiezen.
  let voorstel = null;
  let dashboardPrijzen: readonly DashboardPrice[] = [];
  let dashboard: unknown = null;
  let meters: readonly MeterOption[] = [];
  let fout: string | null = null;
  try {
    meters = await energy.source.meters();
    const prefs = await energy.source.prefs();
    voorstel = importFromPrefs(prefs, meters, (id) => energy.source.entityNumber?.(id) ?? null);
    dashboardPrijzen = pricesInPrefs(prefs);
    // Het dashboard zoals Home Assistant het geeft: entiteiten en prijzen, om
    // na te gaan wat het overnemen ervan maakte.
    dashboard = prefs;
  } catch (error) {
    fout = `Home Assistant gaf de meters niet: ${(error as Error).message}`;
  }
  // De prijs van nu bij een dynamisch contract (testerronde, november 2026): live uit de entiteit.
  const dyn = energy.store.current?.prijzen.dynamisch ?? voorstel?.prijzen.dynamisch ?? null;
  const prijsNu = dyn?.prijsEntiteit ? (energy.source.entityNumber?.(dyn.prijsEntiteit) ?? null) : null;
  // Kent Home Assistant geen prijs per uur, dan de sensoren die er een geven (issue 119): die kun je in Home Assistant bij Energie zetten.
  const prijsSensoren = dyn ? [] : (energy.source.prijsSensoren?.() ?? []);
  sendJson(res, 200, { instellingen: energy.store.current, voorstel, dashboardPrijzen, dashboard, meters, prijsNu, prijsSensoren, ...(fout ? { fout } : {}) });
}

/**
 * Laden met de hand (besluit 262). GET: per auto wat kan en wat er loopt.
 * POST `{ auto, stroomA | pauze, tot, totMs?, pct? }`, of `{ auto, terug: true }`.
 * Zonder de deur (de NAS) zegt GET `aan: false`, en kan er niets.
 */
async function ladenRoute(d: Diensten, req: IncomingMessage, res: ServerResponse, method: string): Promise<void> {
  const laden = d.options.laden;
  if (method !== 'POST') {
    sendJson(res, 200, laden ? { aan: true, autos: await laden.standen() } : { aan: false, autos: [] });
    return;
  }
  if (!laden) {
    sendJson(res, 503, { fout: 'Laden met de hand kan alleen in de add-on' });
    return;
  }
  let body: Record<string, unknown>;
  try {
    body = (await readJson(req)) as Record<string, unknown>;
  } catch (error) {
    sendJson(res, 400, { fout: (error as Error).message });
    return;
  }
  const auto = body?.['auto'];
  if (typeof auto !== 'string' || !/^[A-Za-z0-9_.:-]{1,64}$/.test(auto)) {
    sendJson(res, 400, { fout: 'auto is het id van een auto' });
    return;
  }
  if (body['terug'] === true) {
    sendJson(res, 200, { ok: await laden.terug(auto) });
    return;
  }
  const tot = body['tot'];
  if (tot !== 'uur' && tot !== 'tijd' && tot !== 'pct' && tot !== 'kabel') {
    sendJson(res, 400, { fout: 'tot is uur, tijd, pct of kabel' });
    return;
  }
  const getal = (k: string) => (typeof body[k] === 'number' ? (body[k] as number) : undefined);
  const uit = await laden.zet(auto, {
    tot,
    ...(body['pauze'] === true ? { pauze: true } : {}),
    ...(getal('stroomA') != null ? { stroomA: getal('stroomA')! } : {}),
    ...(getal('totMs') != null ? { totMs: getal('totMs')! } : {}),
    ...(getal('pct') != null ? { pct: getal('pct')! } : {}),
  }).catch((e: Error) => ({ ok: false as const, reden: `Home Assistant nam het niet aan: ${e.message}` }));
  sendJson(res, uit.ok ? 200 : 409, uit.ok ? uit : { fout: uit.reden });
}

/**
 * Een slimme stekker met de hand (besluit 265). GET: de stand per stekker, met
 * `aan` of hier geschakeld kan worden. POST `{ id, aan }` met `duurMin`, `klok`
 * ("22:00") of `totMs`, of `{ id, terug: true }`.
 */
async function stekkerRoute(d: Diensten, req: IncomingMessage, res: ServerResponse, method: string): Promise<void> {
  const s = d.options.stekkers;
  if (method !== 'POST') {
    sendJson(res, 200, { aan: s?.zet != null, stekkers: s ? await s.standen() : [] });
    return;
  }
  if (!s?.zet || !s.terug) {
    sendJson(res, 503, { fout: 'Een stekker schakelen kan alleen in de add-on' });
    return;
  }
  let body: Record<string, unknown>;
  try {
    body = (await readJson(req)) as Record<string, unknown>;
  } catch (error) {
    sendJson(res, 400, { fout: (error as Error).message });
    return;
  }
  const id = body?.['id'];
  if (typeof id !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(id)) {
    sendJson(res, 400, { fout: 'id is het id van een stekker' });
    return;
  }
  if (body['terug'] === true) {
    sendJson(res, 200, { ok: await s.terug(id).catch(() => false) });
    return;
  }
  const tot = typeof body['duurMin'] === 'number' ? { duurMin: body['duurMin'] } : typeof body['klok'] === 'string' ? { klok: body['klok'] } : typeof body['totMs'] === 'number' ? { totMs: body['totMs'] } : null;
  if (typeof body['aan'] !== 'boolean' || tot == null) {
    sendJson(res, 400, { fout: 'verwacht { id, aan } met duurMin, klok of totMs' });
    return;
  }
  const uit = await s.zet(id, body['aan'], tot).catch((e: Error) => ({ ok: false as const, reden: `Home Assistant nam het niet aan: ${e.message}` }));
  sendJson(res, uit.ok ? 200 : 409, uit.ok ? uit : { fout: uit.reden });
}

/** De zon en je aansluiting (besluit 103): wat er staat, of de antwoorden bewaren. */
export async function aansluitingRoute(d: Diensten, req: IncomingMessage, res: ServerResponse, method: string): Promise<void> {
  const connection = d.options.connection;
  if (connection == null) {
    sendJson(res, 503, { wachten: 'De aansluiting staat niet aan' });
    return;
  }
  if (method === 'POST') {
    let body: unknown;
    try {
      body = await readJson(req);
    } catch (error) {
      sendJson(res, 400, { fout: (error as Error).message });
      return;
    }
    const checked = validateConnection(body, connection.found(), connection.store.current);
    if (!checked.ok) {
      sendJson(res, 400, { fout: checked.reden });
      return;
    }
    await connection.store.save(checked.answers);
  }
  sendJson(res, 200, connection.view(taalVan(new URL(req.url ?? '/', 'http://localhost').searchParams.get('taal') ?? req.headers['x-taal'])));
}

/**
 * De gevels opmeten op de kaart (21 oktober 2026): de omtrek van het huis in
 * OpenStreetMap, en daaruit de voorkant die het dichtst bij `nuDeg` ligt.
 * Alleen na een tik van de beheerder; niets bewaard behalve een dag de omtrek.
 */
export async function gevelKaartRoute(d: Diensten, req: IncomingMessage, res: ServerResponse): Promise<void> {
  // De precieze plek (besluit 254): de ligging voor de zon is afgerond op 0,1° en wijst geen huis aan.
  const loc = (await d.options.exacteLocatie?.().catch(() => null)) ?? d.options.location?.() ?? null;
  if (loc == null) {
    sendJson(res, 503, { wachten: 'de ligging van het huis komt van Home Assistant zodra die verbonden is' });
    return;
  }
  let body: unknown;
  try {
    body = await readJson(req);
  } catch (error) {
    sendJson(res, 400, { fout: (error as Error).message });
    return;
  }
  const nu = Number((body as { nuDeg?: unknown } | null)?.nuDeg);
  if (!Number.isFinite(nu) || nu < 0 || nu >= 360) {
    sendJson(res, 400, { fout: 'nuDeg is een richting van 0 tot 360' });
    return;
  }
  const sleutel = `${loc.latDeg.toFixed(5)},${loc.lonDeg.toFixed(5)}`;
  let bewaard = d.kaart.get(sleutel);
  if (bewaard == null || Date.now() - bewaard.at > 86_400_000) {
    try {
      bewaard = { at: Date.now(), omtrek: await (d.options.omtrek ?? haalOmtrek)(loc.latDeg, loc.lonDeg) };
    } catch {
      sendJson(res, 502, { fout: 'De kaart gaf geen antwoord. Probeer het straks nog eens.' });
      return;
    }
    d.kaart.set(sleutel, bewaard);
  }
  const gevels = bewaard.omtrek ? gevelsUitOmtrek(bewaard.omtrek) : null;
  if (gevels == null) {
    sendJson(res, 404, { fout: 'Op de kaart staat op deze plek geen huis.' });
    return;
  }
  sendJson(res, 200, { voorkantDeg: voorkantUitKaart(gevels, nu), as: gevels.as, bron: 'OpenStreetMap' });
}

/** De antwoorden van OpenStreetMap per vak van het raster, een dag. */
const kaartVakken = new Map<string, { at: number; antwoord: unknown }>();
/** Wat 3D BAG over het huis zei, een dag; alleen het uitgerekende, niet het hele vak. */
let bagBewaard: { at: number; sleutel: string; vak: boolean; uit: ReturnType<typeof bagHuisEnOmgeving> } | null = null;

/** Wat een kaart over het huis zei (6 november 2026): de stand, en bij `huis` de vormen in meters. */
export interface UitKaart {
  readonly stand: KaartStandWoord;
  readonly hoofdhuis?: readonly (readonly [number, number])[];
  readonly omgeving?: readonly (readonly (readonly [number, number])[])[];
  readonly dak?: { readonly dakvorm: Dakvorm; readonly nokDeg: number; readonly hellingDeg: number | null; readonly vlakken: readonly BagDakvlak[] };
}

/**
 * Het huis van boven uit de kaart (besluit 254, stap 2a): het gebouw waar de
 * plek uit Home Assistant in ligt en de gebouwen eromheen, in meters vanaf die
 * plek. Naar OpenStreetMap gaat alleen het vak van het raster; de plek zelf
 * blijft in huis en wordt niet bewaard. Alleen na een tik van de beheerder.
 *
 * Wat kan bij jouw huis (Ricardo, 6 november 2026): per kaart wat hij vond,
 * zodat de bewoner ziet wat er is en zelf kiest (`bronnen`). Bovenaan staat
 * nog de beste, zoals eerst: 3D BAG met wat OpenStreetMap erbij heeft, anders
 * OpenStreetMap.
 */
export async function dakenKaartRoute(d: Diensten, res: ServerResponse): Promise<void> {
  const loc = await (d.options.exacteLocatie?.() ?? Promise.resolve(null)).catch(() => null);
  if (loc == null) {
    sendJson(res, 503, { wachten: 'de plek van het huis komt van Home Assistant zodra die verbonden is' });
    return;
  }
  const nl = inNederland(loc.latDeg, loc.lonDeg);
  // In Nederland ook 3D BAG (5 november 2026): de omtrek en het dak per gebouw; OpenStreetMap vult aan wat er niet in staat, zoals een tuinhuis.
  const [osm, bag] = await Promise.allSettled([osmVak(d, loc.latDeg, loc.lonDeg), nl ? bagVak(d, loc.latDeg, loc.lonDeg) : Promise.resolve(null)]);
  const uitOsm = osm.status === 'fulfilled' ? huisEnOmgeving(osm.value, { lat: loc.latDeg, lon: loc.lonDeg }) : null;
  const uitBag = bag.status === 'fulfilled' ? bag.value?.uit ?? null : null;
  const kaartOsm: UitKaart =
    osm.status === 'rejected' ? { stand: 'fout' } : uitOsm ? { stand: 'huis', hoofdhuis: uitOsm.huis, omgeving: uitOsm.omgeving } : { stand: heeftGebouwen(osm.value) ? 'wijk' : 'niets' };
  let kaartBag: UitKaart;
  if (!nl) kaartBag = { stand: 'buiten' };
  else if (bag.status === 'rejected') kaartBag = { stand: 'fout' };
  else if (!uitBag) kaartBag = { stand: bag.value?.vak ? 'wijk' : 'niets' };
  else {
    const bagOmtrekken = [uitBag.huis.omtrek, ...uitBag.omgeving.map((g) => g.omtrek)];
    const erbij = [...(uitOsm ? [uitOsm.huis] : []), ...(uitOsm?.omgeving ?? [])].filter((o) => !alBinnen(o, bagOmtrekken));
    const dak: BagDak = uitBag.huis.dak;
    kaartBag = {
      stand: 'huis',
      hoofdhuis: uitBag.huis.omtrek,
      omgeving: [...uitBag.omgeving.map((g) => g.omtrek), ...erbij].slice(0, 20),
      dak: { dakvorm: dak.dakvorm, nokDeg: dak.nokDeg, hellingDeg: dak.hellingDeg, vlakken: dak.vlakken },
    };
  }
  const bronnen = { osm: kaartOsm, bag3d: kaartBag };
  if (kaartBag.stand === 'huis') {
    sendJson(res, 200, { hoofdhuis: kaartBag.hoofdhuis, omgeving: kaartBag.omgeving, bron: 'bag3d', dak: kaartBag.dak, bronnen });
    return;
  }
  if (kaartOsm.stand === 'huis') {
    sendJson(res, 200, { hoofdhuis: kaartOsm.hoofdhuis, omgeving: kaartOsm.omgeving, bron: 'osm', bronnen });
    return;
  }
  if (kaartOsm.stand === 'fout' && (kaartBag.stand === 'fout' || kaartBag.stand === 'buiten')) {
    sendJson(res, 502, { fout: 'De kaart gaf geen antwoord. Probeer het straks nog eens.', bronnen });
    return;
  }
  // Geen huis: wel zeggen wat de kaarten zagen, zodat de pagina het kan tonen.
  sendJson(res, 404, { fout: 'Op de kaart staat op deze plek geen huis.', bronnen });
}

/** OpenStreetMap: het vak van het raster, een dag bewaard. */
async function osmVak(d: Diensten, lat: number, lon: number): Promise<unknown> {
  const vak = kaartVak(lat, lon).sleutel;
  let bewaard = kaartVakken.get(vak);
  if (bewaard == null || Date.now() - bewaard.at > 86_400_000) {
    bewaard = { at: Date.now(), antwoord: await (d.options.kaartAntwoord ?? haalKaart)(lat, lon) };
    kaartVakken.set(vak, bewaard);
  }
  return bewaard.antwoord;
}

/** 3D BAG: het kaartvak van de plek, en daaruit het huis en de buren; een dag bewaard. `vak`: was er een kaartvak? */
async function bagVak(d: Diensten, lat: number, lon: number): Promise<{ vak: boolean; uit: ReturnType<typeof bagHuisEnOmgeving> }> {
  const [x, y] = naarRd(lat, lon);
  const sleutel = `${Math.round(x)},${Math.round(y)}`;
  if (bagBewaard?.sleutel === sleutel && Date.now() - bagBewaard.at < 86_400_000) return bagBewaard;
  const cj = await (d.options.bagVak ?? haalBagVak)(lat, lon);
  const uit = cj ? bagHuisEnOmgeving(cj, x, y) : null;
  bagBewaard = { at: Date.now(), sleutel, vak: cj != null, uit };
  return bagBewaard;
}
