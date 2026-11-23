/**
 * De stand van nu: het besluit, de live-verbinding en de vergelijking met het oude systeem.
 *
 * Geknipt uit server.ts (besluit 180, 23 oktober 2026): letterlijk, met de
 * context `d` in plaats van de webserver zelf.
 */

import { sendJson } from '../http.js';
import { taalVan, type Diensten, type Verzoek } from '../diensten.js';
import { motorDag, motorRonde } from '../motor.js';

/** De routes van dit onderwerp; waar als het verzoek hier is afgehandeld. */
export async function standRoutes(d: Diensten, v: Verzoek): Promise<boolean> {
  const { req, res, url, path, method } = v;
  if (path === '/api/state') {
    const snapshot = d.options.latest();
    if (snapshot == null) {
      // 503 en niet 200-met-null: er ís nog geen stand, en dat is iets
      // anders dan een lege stand. De pagina kan dat onderscheid tonen.
      sendJson(res, 503, { wachten: 'nog geen besluit genomen' });
      return true;
    }
    sendJson(res, 200, d.withResident(snapshot, taalVan(url.searchParams.get('taal') ?? req.headers['x-taal'])));
    return true;
  }

  if (path === '/api/events') {
    d.live.abonneer(res, method === 'HEAD', taalVan(url.searchParams.get('taal')));
    return true;
  }

  /*
   * De motor › Vandaag (23 november 2026): per kwartier van een dag wat de motor zou doen, wat er gebeurde en wat de
   * oude regeling deed (`?dag=JJJJ-MM-DD`, anders vandaag), en één ronde om terug te kijken (`?t=` in ms, anders nu).
   */
  if (path === '/api/motor/dag' || path === '/api/motor/ronde') {
    const logDir = d.options.logDir;
    const tz = d.config()?.timezone ?? 'Europe/Amsterdam';
    if (!logDir) {
      sendJson(res, 503, { wachten: 'zonder logboek is er niets terug te kijken' });
      return true;
    }
    if (path === '/api/motor/dag') {
      const vraag = url.searchParams.get('dag');
      const vandaag = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const dag = vraag ?? vandaag;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dag)) {
        sendJson(res, 400, { fout: 'dag is een dag als 2026-11-23' });
        return true;
      }
      const uit = await motorDag(logDir, dag, tz);
      sendJson(res, uit ? 200 : 404, uit ?? { fout: 'van die dag is er geen logboek' });
      return true;
    }
    const t = Number(url.searchParams.get('t') ?? Date.now());
    if (!Number.isFinite(t)) {
      sendJson(res, 400, { fout: 't is een moment in milliseconden' });
      return true;
    }
    const uit = await motorRonde(logDir, t, tz);
    sendJson(res, uit ? 200 : 404, uit ?? { fout: 'van die dag is er geen logboek' });
    return true;
  }

  if (path === '/api/divergence') {
    const report = d.options.divergence?.() ?? null;
    if (report == null) {
      // Onderscheid tussen "staat uit" en "nog niet gerekend" is voor de
      // pagina het verschil tussen iets verbergen en iets uitleggen.
      sendJson(res, 503, {
        wachten:
          d.options.divergence == null
            ? 'geen logboekanalyse ingeschakeld'
            : 'nog niet doorgerekend',
      });
      return true;
    }
    sendJson(res, 200, report);
    return true;
  }

  return false;
}
