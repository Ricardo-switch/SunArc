/**
 * Het huis: de indeling, het huis zelf, en licht, scènes en schermen bedienen.
 *
 * Geknipt uit server.ts (besluit 180, 23 oktober 2026): letterlijk, met de
 * context `d` in plaats van de webserver zelf.
 */

import { OUTSIDE_FLOOR, floorName, floorOrder, standardFloors } from '../layout.js';
import { readJson, sendJson } from '../http.js';
import { taalVan, type Diensten, type Verzoek } from '../diensten.js';
import { brugVerzoek, totWanneer } from '../klimaatbrug.js';
import { bronVanDaken, bronVorm, dakenMetBron, eenPapier, ERBIJ_SOORTEN, gebouwErbij, gebouwWeg, type ErbijSoort, etageHoogtes, kaalGebouw, lagenOnderDak, tekenSoort, verschuif, VORM_BRONNEN, zoneVanPlek, type BronVorm, type TekenRuimte, type VormBron } from '../huistekening.js';
import { leesDaken, type Daken, type Xy } from '../daken.js';
import { validateConnection } from '../aansluiting.js';
import { kaartBronnen } from './energie.js';

/** De routes van dit onderwerp; waar als het verzoek hier is afgehandeld. */
export async function huisRoutes(d: Diensten, v: Verzoek): Promise<boolean> {
  const { req, res, url, path, method } = v;
  if (path === '/api/indeling') {
    const door = d.options.layout;
    const taal = taalVan(url.searchParams.get('taal') ?? req.headers['x-taal']);
    const config = d.config();
    if (door == null || config == null) {
      sendJson(res, 503, { wachten: 'indelen staat niet aan' });
      return true;
    }
    if (method === 'POST') {
      let body: unknown;
      try {
        body = await readJson(req);
      } catch (error) {
        sendJson(res, 400, { fout: (error as Error).message });
        return true;
      }
      const result = await door.store.save(body);
      if (result.ok) sendJson(res, 200, result.layout);
      else sendJson(res, result.status, { fout: result.reden });
      return true;
    }
    // Alles wat de bewerkstand nodig heeft om te kiezen, zonder zelf te rekenen.
    sendJson(res, 200, {
      indeling: door.store.current,
      voorstel: door.proposal(),
      // De etages van deze indeling, van boven naar beneden, en buiten (besluit 112);
      // de vaste etages als voorstel om toe te voegen.
      etages: [...floorOrder(door.store.current ?? door.proposal() ?? { kamers: [] }), OUTSIDE_FLOOR].map((id) => ({ id, standaardNaam: floorName(id, taal) })),
      standaard: standardFloors(taal),
      regelzones: config.zones.map((z) => ({ id: z.id, naam: z.name })),
    });
    return true;
  }

  if (path === '/api/huistekening') {
    await huistekeningRoute(d, v);
    return true;
  }

  if (path === '/api/huis') {
    const house = d.options.house?.(taalVan(url.searchParams.get('taal') ?? req.headers['x-taal'])) ?? null;
    if (house == null) {
      sendJson(res, 503, { wachten: 'de etages en ruimtes komen van Home Assistant zodra die verbonden is' });
      return true;
    }
    // Of de knoppen voor licht echt schakelen, of zeggen dat het nog niet mag.
    sendJson(res, 200, { ...house, lichtBedienen: d.lichtMag(), schermenBedienen: d.schermMag() });
    return true;
  }

  if (path === '/api/scene') {
    const lights = d.options.lights;
    if (lights == null || !lights.scenesEnabled || !d.lichtMag()) {
      sendJson(res, 503, { wachten: 'scènes staan niet aan' });
      return true;
    }
    if (method !== 'POST') {
      sendJson(res, 405, { fout: 'een scène zet je aan met een POST' });
      return true;
    }
    let body: unknown;
    try {
      body = await readJson(req);
    } catch (error) {
      sendJson(res, 400, { fout: (error as Error).message });
      return true;
    }
    const result = await lights.scene(body);
    if (result.ok) sendJson(res, 200, { aan: true });
    else sendJson(res, result.status, { fout: result.reden });
    return true;
  }

  if (path === '/api/scherm') {
    const covers = d.options.covers;
    if (covers == null || !d.schermMag()) {
      sendJson(res, 503, { wachten: 'schermen bedienen staat niet aan' });
      return true;
    }
    if (method !== 'POST') {
      sendJson(res, 405, { fout: 'een scherm bedien je met een POST' });
      return true;
    }
    let body: unknown;
    try {
      body = await readJson(req);
    } catch (error) {
      sendJson(res, 400, { fout: (error as Error).message });
      return true;
    }
    const result = await covers.move(body);
    if (result.ok) sendJson(res, 200, { ok: true });
    else sendJson(res, result.status, { fout: result.reden });
    return true;
  }

  /*
   * Witgoed starten (besluit 238): GET per apparaat of het kan en waarom niet;
   * POST { id, start: true } drukt nu op de startknop.
   */
  if (path === '/api/witgoed') {
    const w = d.options.witgoed;
    const config = d.config();
    if (w == null || config == null) {
      sendJson(res, 503, { wachten: 'witgoed starten kan alleen in de add-on' });
      return true;
    }
    if (method === 'GET') {
      sendJson(res, 200, { apparaten: (config.deferrables ?? []).map((x) => ({ id: x.id, naam: x.name, ...w.stand(x.id) })) });
      return true;
    }
    if (method !== 'POST') {
      sendJson(res, 405, { fout: 'witgoed: GET of POST' });
      return true;
    }
    const body = (await readJson(req).catch(() => null)) as Record<string, unknown> | null;
    if (typeof body?.['id'] !== 'string' || body['start'] !== true) {
      sendJson(res, 400, { fout: 'stuur { id, start: true }' });
      return true;
    }
    const uit = await w.nuStarten(body['id']);
    sendJson(res, uit.ok ? 200 : 409, uit.ok ? { ok: true } : { fout: uit.reden });
    return true;
  }

  /*
   * Klimaat met de hand (besluit 235): GET wat er kan, per apparaat en per
   * stekker; POST een doel tot een tijd, een stekker aan, of terug.
   */
  if (path === '/api/hand') {
    const h = d.options.hand;
    const config = d.config();
    if (h == null || config == null) {
      sendJson(res, 503, { wachten: 'klimaat met de hand kan alleen in de add-on' });
      return true;
    }
    if (method === 'GET') {
      const nu = Date.now();
      const zoneVan = (id: string) => config.zones.find((z) => z.actuatorIds.some((a) => config.actuators.find((x) => x.id === a)?.ref.id === id));
      const knoppen = h.knoppen();
      const apparaten = (await h.hand.standen(knoppen.map((k) => k.id))).map((s) => {
        const knop = knoppen.find((k) => k.id === s.id);
        if (knop) return { ...s, naam: knop.naam, kamer: knop.kamer, zoneId: null, actuatorId: null, ...(knop.zone ? { zone: knop.zone } : {}) };
        const a = config.actuators.find((x) => x.ref.id === s.id);
        const zone = zoneVan(s.id);
        // Het klimaatapparaat uit de configuratie: zo vindt het blad van een apparaat in het huis zijn stand (ronde 5).
        return { ...s, naam: a?.name ?? s.id, kamer: zone?.name ?? null, zoneId: zone?.id ?? null, actuatorId: a?.id ?? null };
      });
      const schakelaars = h.schakelaars().map((s) => ({ ...s, totMs: h.hand.schakelaarTot(s.id) }));
      // Het eind van het dagdeel: 22:00, of 's nachts twee uur, zoals de klimaatbrug.
      sendJson(res, 200, { aan: h.aan(), apparaten, schakelaars, dagdeelTotMs: totWanneer(null, nu, config.timezone, false), nu });
      return true;
    }
    if (method !== 'POST') {
      sendJson(res, 405, { fout: 'met de hand: GET of POST' });
      return true;
    }
    if (!h.aan()) {
      sendJson(res, 409, { fout: 'klimaat met de hand staat uit bij Functies › Praten' });
      return true;
    }
    let body: Record<string, unknown>;
    try {
      const b = await readJson(req);
      if (typeof b !== 'object' || b == null || Array.isArray(b)) throw new Error('verwacht een object');
      body = b as Record<string, unknown>;
    } catch (error) {
      sendJson(res, 400, { fout: (error as Error).message });
      return true;
    }
    const id = typeof body['id'] === 'string' ? body['id'] : '';
    const totMs = Number(body['totMs']);
    // Tot het doel (ronde 5): terug zodra de kamer het doel haalt, en uiterlijk op totMs.
    const totDoel = body['totDoel'] === true;
    try {
      if (body['terug'] === true) {
        sendJson(res, (await h.hand.terugNu(id)) ? 200 : 404, { ok: true });
        return true;
      }
      if (id.startsWith('switch.')) {
        if (!h.schakelaars().some((s) => s.id === id)) {
          sendJson(res, 400, { fout: 'die stekker is geen warmtebron buiten je regeling' });
          return true;
        }
        const uit = await h.hand.schakelAan(id, totMs);
        sendJson(res, uit.ok ? 200 : 400, uit.ok ? uit : { fout: uit.reden });
        return true;
      }
      const modus = body['modus'];
      const doel = Number(body['doelC']);
      // Een radiatorknop buiten de regeling: zijn eigen doel, direct.
      if (h.knoppen().some((k) => k.id === id)) {
        if (!Number.isFinite(doel)) {
          sendJson(res, 400, { fout: 'doelC is een getal' });
          return true;
        }
        const uit = await h.hand.zetKnop(id, doel, totMs, totDoel);
        sendJson(res, uit.ok ? 200 : 400, uit.ok ? uit : { fout: uit.reden });
        return true;
      }
      if ((modus !== 'verwarmen' && modus !== 'koelen') || !Number.isFinite(doel)) {
        sendJson(res, 400, { fout: 'modus is verwarmen of koelen, doelC een getal' });
        return true;
      }
      const uit = await h.hand.zet(id, modus, doel, totMs, totDoel);
      sendJson(res, uit.ok ? 200 : 400, uit.ok ? uit : { fout: uit.reden });
    } catch (error) {
      sendJson(res, 502, { fout: `Home Assistant weigerde: ${(error as Error).message}` });
    }
    return true;
  }

  // De klimaatbrug (besluit 210): verwarmen of koelen via de knoppen van het oude systeem.
  if (path === '/api/klimaat') {
    const k = d.options.klimaat;
    const config = d.config();
    if (k == null || config == null || !k.aan() || !k.brug.beschikbaar) {
      sendJson(res, 503, { wachten: 'klimaat via je eigen regeling staat niet aan' });
      return true;
    }
    if (method !== 'POST') {
      sendJson(res, 405, { fout: 'klimaat bedien je met een POST' });
      return true;
    }
    let body: unknown;
    try {
      body = await readJson(req);
    } catch (error) {
      sendJson(res, 400, { fout: (error as Error).message });
      return true;
    }
    // "Doe maar terug" (besluit 213): wat de brug zette, meteen terug.
    if (typeof body === 'object' && body != null && (body as Record<string, unknown>)['terug'] === true) {
      try {
        sendJson(res, 200, { ok: true, terug: await k.brug.terugNu() });
      } catch (error) {
        sendJson(res, 502, { fout: `Home Assistant weigerde: ${(error as Error).message}` });
      }
      return true;
    }
    const uit = brugVerzoek(body, config, Date.now());
    if (!uit.ok) {
      sendJson(res, 400, { fout: uit.reden });
      return true;
    }
    const p = k.brug.plan(uit.wens, uit.temperatuurC, null, config.timezone);
    if (!p.ok) {
      sendJson(res, 409, { fout: p.reden });
      return true;
    }
    try {
      await k.brug.voerUit({ ...p.plan, totMs: uit.totMs });
    } catch (error) {
      sendJson(res, 502, { fout: `Home Assistant weigerde: ${(error as Error).message}` });
      return true;
    }
    sendJson(res, 200, { ok: true, doel: p.plan.doel });
    return true;
  }

  if (path === '/api/licht') {
    const lights = d.options.lights;
    if (lights == null || !d.lichtMag()) {
      sendJson(res, 503, { wachten: 'licht bedienen staat niet aan' });
      return true;
    }
    if (method !== 'POST') {
      sendJson(res, 405, { fout: 'licht bedien je met een POST' });
      return true;
    }
    let body: unknown;
    try {
      body = await readJson(req);
    } catch (error) {
      sendJson(res, 400, { fout: (error as Error).message });
      return true;
    }
    const result = await lights.switch(body);
    if (result.ok) sendJson(res, 200, { lampen: result.lampen });
    else sendJson(res, result.status, { fout: result.reden });
    return true;
  }

  return false;
}

/**
 * Je huis tekenen (besluit 308). GET geeft alles wat de tekentafel nodig heeft:
 * de vorm van elke bron (de gebouwen van Daken en panelen, wat de kaarten van
 * vandaag nog vonden, of zonder kaart), de etages binnen met hun hoogte, de
 * kamers met hun zones, de apparaten, en wat er al getekend is. Alles in meters
 * op één ruitjespapier: `nul` is waar de linker voorhoek van het hoofdhuis
 * ligt, en de pagina stuurt hem bij het bewaren terug.
 *
 * POST `{ tekening, zones, plekken?, apparaten?, bron?, nul? }` bewaart dat in
 * de indeling (apparaten: per id de kamer); de rest van de indeling blijft
 * zoals hij is. Een kamer die er niet meer is, laat een vak zonder naam
 * achter. Een andere `bron` geldt ook bij Daken en panelen (stap 4). POST
 * `{ kijk: true }` vraagt de kaarten, na de melding, en onthoudt bij Daken wat
 * ze zeiden.
 */
async function huistekeningRoute(d: Diensten, v: Verzoek): Promise<void> {
  const { req, res, url, method } = v;
  const door = d.options.layout;
  const taal = taalVan(url.searchParams.get('taal') ?? req.headers['x-taal']);
  const huis = d.options.house?.(taal) ?? null;
  const basis = door?.store.current ?? door?.proposal() ?? null;
  if (door == null || huis == null || basis == null) {
    sendJson(res, 503, { wachten: 'de etages en kamers komen van Home Assistant zodra die verbonden is' });
    return;
  }
  const binnen = huis.etages.filter((e) => e.id !== OUTSIDE_FLOOR);
  const vorm = await vormVanHuis(d, taal, huis.woning, binnen, basis.plattegrond ?? {});

  if (method === 'POST') {
    let body: unknown;
    try {
      body = await readJson(req);
    } catch (error) {
      sendJson(res, 400, { fout: (error as Error).message });
      return;
    }
    const b = (typeof body === 'object' && body != null && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
    // Kijk wat de kaarten vinden: dezelfde zoekactie als bij Daken en panelen, alleen na de melding.
    if (b['kijk'] === true) {
      const kaarten = await kaartBronnen(d, true);
      if (kaarten == null) {
        sendJson(res, 503, { wachten: 'de plek van het huis komt van Home Assistant zodra die verbonden is' });
        return;
      }
      const stand = { osm: kaarten.osm?.stand ?? 'fout', bag3d: kaarten.bag3d?.stand ?? 'fout', datum: new Date().toLocaleDateString('sv-SE') };
      if (vorm.daken && d.options.connection) {
        const fout = await bewaarDaken(d.options.connection, { ...vorm.daken, kaartStand: stand });
        if (fout) {
          sendJson(res, 400, { fout });
          return;
        }
      }
      sendJson(res, 200, { kaarten: stand });
      return;
    }
    // Een gebouw van de kaart erbij, of weer weg (0.185.0): zoals bij Daken en panelen, en het geldt op allebei.
    const gb = b['gebouw'];
    if (typeof gb === 'object' && gb != null && !Array.isArray(gb)) {
      const g = gb as Record<string, unknown>;
      if (!vorm.daken || !d.options.connection) {
        sendJson(res, 409, { fout: 'eerst een huis bij Daken en panelen' });
        return;
      }
      const soort = g['soort'];
      const nieuw =
        typeof g['erbij'] === 'number' && (ERBIJ_SOORTEN as readonly unknown[]).includes(soort)
          ? (gebouwErbij(vorm.daken, g['erbij'], soort as ErbijSoort)?.daken ?? null)
          : typeof g['weg'] === 'string'
            ? gebouwWeg(vorm.daken, g['weg'])
            : undefined;
      if (nieuw === undefined) {
        sendJson(res, 400, { fout: 'verwacht { gebouw: { erbij, soort } } of { gebouw: { weg } }' });
        return;
      }
      if (nieuw == null) {
        sendJson(res, 409, { fout: 'dat gebouw is er niet (meer)' });
        return;
      }
      const fout = await bewaarDaken(d.options.connection, nieuw);
      if (fout) sendJson(res, 400, { fout });
      else sendJson(res, 200, { bewaard: true });
      return;
    }
    if (typeof b['tekening'] !== 'object' || b['tekening'] == null || Array.isArray(b['tekening'])) {
      sendJson(res, 400, { fout: 'verwacht { tekening, zones }' });
      return;
    }
    // Een andere bron voor de buitenkant: eerst bij Daken en panelen, dan pas de tekening.
    const bron = VORM_BRONNEN.includes(b['bron'] as VormBron) ? (b['bron'] as VormBron) : vorm.bron;
    if (bron !== vorm.bron) {
      const alle = bron === 'zelf' ? null : await kaartBronnen(d, false);
      const kaart = alle?.[bron as 'osm' | 'bag3d'] ?? null;
      const nieuw = vorm.daken && d.options.connection ? dakenMetBron(vorm.daken, bron, kaart, alle?.bag3d ?? null) : null;
      if (!nieuw || !d.options.connection) {
        sendJson(res, 409, { fout: 'deze bron is er niet meer; kijk opnieuw wat de kaarten vinden' });
        return;
      }
      const fout = await bewaarDaken(d.options.connection, nieuw);
      if (fout) {
        sendJson(res, 400, { fout });
        return;
      }
    }
    // De pagina stuurt de hoek van het hoofdhuis terug zoals hij hem kreeg; anders die van nu.
    const n = b['nul'] as { u?: unknown; v?: unknown } | null | undefined;
    const goed = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 200;
    const { u: nu, v: nv } = n && goed(n.u) && goed(n.v) ? { u: n.u, v: n.v } : vorm.nul;
    // Terug naar de hoek van het hoofdhuis; wat niet klopt, zegt de toets van de indeling.
    const terug = (x: unknown) => (Array.isArray(x) && x.length === 4 && x.every((n) => typeof n === 'number') ? [(x[0] as number) - nu, (x[1] as number) - nv, x[2], x[3]] : x);
    const ruimteTerug = (r: unknown) => {
      const o = typeof r === 'object' && r != null ? (r as Record<string, unknown>) : null;
      return o && Array.isArray(o['vakken']) ? { ...o, vakken: o['vakken'].map(terug) } : r;
    };
    const tekening = Object.fromEntries(Object.entries(b['tekening'] as Record<string, unknown>).map(([e, lijst]) => [e, Array.isArray(lijst) ? lijst.map(ruimteTerug) : lijst]));
    const zones = (typeof b['zones'] === 'object' && b['zones'] != null ? b['zones'] : {}) as Record<string, { as?: unknown; op?: unknown }>;
    const kamers = basis.kamers.map((k) => {
      const { zoneLijn: _weg, ...rest } = k;
      const z = zones[k.id];
      if (!z || (z.as !== 'u' && z.as !== 'v') || typeof z.op !== 'number') return rest;
      return { ...rest, zoneLijn: { as: z.as as 'u' | 'v', op: z.op - (z.as === 'u' ? nu : nv) } };
    });
    // De apparaten (stap 3), alleen als ze meekomen: de kamer waar een apparaat staat, en zijn plek.
    // Een plek in een kamer met een zonelijn zet de zone: die aan zijn kant van de lijn.
    const object = (x: unknown) => (typeof x === 'object' && x != null && !Array.isArray(x) ? (x as Record<string, unknown>) : null);
    const plekken = object(b['plekken']) as Record<string, { etage?: unknown; u?: unknown; v?: unknown }> | null;
    const naarKamer = object(b['apparaten']);
    let apparaten: Record<string, unknown> = basis.apparaten;
    if (plekken || naarKamer) {
      const kamerOp = new Map(kamers.map((k) => [k.id, k]));
      apparaten = {};
      for (const id of new Set([...Object.keys(basis.apparaten), ...Object.keys(naarKamer ?? {})])) {
        const oud = basis.apparaten[id];
        const gevraagd = naarKamer?.[id];
        const kamer = typeof gevraagd === 'string' && kamerOp.has(gevraagd) ? gevraagd : oud?.kamer;
        if (!kamer) continue;
        const { plek: oudePlek, ...rest } = oud ?? { zone: null };
        const p = plekken?.[id];
        const plek = plekken ? (p && typeof p.u === 'number' && typeof p.v === 'number' && typeof p.etage === 'string' ? { etage: p.etage, u: p.u - nu, v: p.v - nv } : undefined) : oudePlek;
        const zone = (plek && kamerOp.get(kamer) ? zoneVanPlek(kamerOp.get(kamer)!, plek) : null) ?? (oud?.kamer === kamer ? oud.zone : null);
        apparaten[id] = { ...rest, kamer, zone, ...(plek ? { plek } : {}) };
      }
    }
    const { plattegrondBron: _oud, ...zonderBron } = basis;
    const uit = await door.store.save({ ...zonderBron, kamers, apparaten, plattegrond: tekening, plattegrondBron: bron });
    if (uit.ok) sendJson(res, 200, { bewaard: true });
    else sendJson(res, uit.status, { fout: uit.reden });
    return;
  }

  const { u: nu, v: nv } = vorm.nul;
  const zoneLijnen: Record<string, { as: 'u' | 'v'; op: number }> = {};
  for (const k of basis.kamers) if (k.zoneLijn) zoneLijnen[k.id] = { as: k.zoneLijn.as, op: Math.round((k.zoneLijn.op + (k.zoneLijn.as === 'u' ? nu : nv)) * 10) / 10 };
  const plekken: Record<string, { etage: string; u: number; v: number }> = {};
  for (const [id, a] of Object.entries(basis.apparaten)) if (a.plek) plekken[id] = { etage: a.plek.etage, u: Math.round((a.plek.u + nu) * 100) / 100, v: Math.round((a.plek.v + nv) * 100) / 100 };
  // De apparaten binnen: in hun kamer, of nog zonder kamer (de strook), met de kamer uit Home Assistant als tip.
  const kamerIds = new Set(binnen.flatMap((e) => e.ruimtes.map((r) => r.id)));
  const kamerMetNaam = (naam: string | null) => (naam ? (binnen.flatMap((e) => e.ruimtes).find((r) => r.naam.toLowerCase() === naam.toLowerCase())?.id ?? null) : null);
  const apparaten = [
    ...binnen.flatMap((e) => e.ruimtes.flatMap((r) => r.apparaten.map((a) => ({ id: a.id, naam: a.naam, soort: tekenSoort(a), kamer: r.id })))),
    ...huis.zonderRuimte.map((a) => {
      const tip = a.voorstelKamer && kamerIds.has(a.voorstelKamer) ? a.voorstelKamer : kamerMetNaam(a.voorstel);
      return { id: a.id, naam: a.naam, soort: tekenSoort(a), kamer: null, ...(tip ? { ha: tip } : {}) };
    }),
  ];
  const nu0 = vorm.bronnen[vorm.bron]!;
  const hoogtes = etageHoogtes(binnen, nu0.goot, nu0.nok);
  sendJson(res, 200, {
    eigen: door.store.current != null,
    vorm: { maat: vorm.maat, blokken: nu0.blokken, bron: vorm.bron },
    // Stap 4: elke bron op hetzelfde ruitjespapier, de bron van nu, en wat de kaarten van vandaag zeiden.
    nul: vorm.nul,
    bron: vorm.bron,
    bronnen: vorm.bronnen,
    kaarten: vorm.kaarten,
    tekeningBron: basis.plattegrondBron ?? vorm.bron,
    woning: huis.woning,
    // Van boven naar beneden, zoals het huis opzij.
    etages: binnen.map((e, i) => ({ id: e.id, naam: e.naam, hoogte: hoogtes[i] })),
    kamers: binnen.flatMap((e) => e.ruimtes.map((r) => ({ id: r.id, naam: r.naam, soort: r.soort, etage: e.id, zones: r.zones.map((z) => z.naam) }))),
    tekening: verschuif(basis.plattegrond ?? {}, nu, nv),
    zones: zoneLijnen,
    plekken,
    apparaten,
    verborgen: huis.verborgen.length,
  });
}

/**
 * De vorm van het huis voor de tekentafel (stap 4): de daken zoals Daken en
 * panelen ze nu tekent, de bron daarvan, en per bron de gebouwen en de hoogte.
 * De kaarten alleen van wat er vandaag al gevraagd is: hier gaat niets naar
 * buiten.
 */
async function vormVanHuis(
  d: Diensten,
  taal: ReturnType<typeof taalVan>,
  woning: string | null | undefined,
  etages: readonly { readonly id: string; readonly naam: string }[],
  plattegrond: Readonly<Record<string, readonly TekenRuimte[]>>,
): Promise<{
  daken: Daken | null;
  bron: VormBron;
  bronnen: Partial<Record<VormBron, BronVorm>>;
  kaarten: { osm: string | null; bag3d: string | null } | null;
  nul: { u: number; v: number };
  maat: { breed: number; diep: number };
}> {
  const verbinding = d.options.connection ?? null;
  const zicht = verbinding?.view(taal).daken ?? null;
  const bewaard = verbinding?.store.current?.daken ?? null;
  // Wat Daken en panelen bewaarde, of anders wat het nu tekent; zonder vlakken telt wat er al was (dakenNu).
  const daken: Daken | null = zicht
    ? {
        ...(bewaard ?? {}),
        vlakken: bewaard?.vlakken ?? [],
        voorgevelDeg: bewaard?.voorgevelDeg ?? zicht.voorgevelDeg,
        omvormerW: bewaard?.omvormerW ?? zicht.omvormerW,
        gebouwen: bewaard?.gebouwen ?? zicht.tekening.gebouwen.map(kaalGebouw),
        // De gebouwen eromheen: wat bewaard is, anders wat Daken nu grijs tekent (om aan te wijzen bij Vorm).
        ...(bewaard?.omgeving ? {} : { omgeving: zicht.tekening.omgeving.map((o) => o.map((p) => [p[0], p[1]] as Xy)) }),
      }
    : null;
  const leeg: Daken = { vlakken: [], voorgevelDeg: null, omvormerW: null };
  const voorgevel = daken?.voorgevelDeg ?? null;
  const lagen = lagenOnderDak(etages);
  const bron = daken ? bronVanDaken(daken.gebouwen ?? []) : 'zelf';
  const vormen: Partial<Record<VormBron, BronVorm>> = { [bron]: bronVorm(daken ?? leeg, voorgevel, woning, lagen) };
  const kaarten = daken ? await kaartBronnen(d, false) : null;
  for (const k of ['bag3d', 'osm'] as const) {
    if (k === bron || !daken) continue;
    const met = dakenMetBron(daken, k, kaarten?.[k] ?? null, kaarten?.bag3d ?? null);
    if (met) vormen[k] = bronVorm(met, voorgevel, woning, lagen);
  }
  if (bron !== 'zelf') vormen.zelf = bronVorm(daken ? dakenMetBron(daken, 'zelf', null)! : leeg, voorgevel, woning, lagen);
  const papier = eenPapier(Object.fromEntries(Object.entries(vormen).map(([id, v]) => [id, v.blokken])), plattegrond);
  // In vaste volgorde: de 3D-kaart, de plattegrond, zonder kaart.
  const bronnen: Partial<Record<VormBron, BronVorm>> = {};
  // De gebouwen eromheen schuiven mee op het ruitjespapier.
  const schuif = (o: BronVorm['omgeving']) => o.map((x) => ({ i: x.i, punten: x.punten.map(([u, v]) => [Math.round((u + papier.nul.u) * 10) / 10, Math.round((v + papier.nul.v) * 10) / 10] as const) }));
  for (const id of VORM_BRONNEN) if (vormen[id]) bronnen[id] = { ...vormen[id], blokken: papier.blokken[id] ?? [], omgeving: schuif(vormen[id].omgeving) };
  return {
    daken,
    bron,
    bronnen,
    kaarten: kaarten ? { osm: kaarten.osm?.stand ?? null, bag3d: kaarten.bag3d?.stand ?? null } : null,
    nul: papier.nul,
    maat: papier.maat,
  };
}

/**
 * De daken bewaren zoals Daken en panelen het doet (de deur `api/huisvorm` van
 * de branch je-huis): alleen de daken, de rest van de antwoorden blijft.
 * Geeft de fout, of null.
 */
async function bewaarDaken(verbinding: NonNullable<Diensten['options']['connection']>, raw: Daken): Promise<string | null> {
  const gelezen = leesDaken(raw);
  if ('fout' in gelezen) return gelezen.fout;
  const nu = verbinding.store.current;
  // Zonder vlakken en gebouwen bewaart Daken niets meer (zoals Zonder kaart daar): dan rekent SunArc weer zelf.
  if (nu) await verbinding.store.save({ ...nu, daken: gelezen.daken });
  else {
    const c = validateConnection({ daken: raw }, verbinding.found(), null);
    if (!c.ok) return c.reden;
    await verbinding.store.save(c.answers);
  }
  await verbinding.naBewaren?.();
  return null;
}
