/*
 * Wat er nu stroomt (idee 135): de zon, het net, de thuisaccu en de apparaten
 * die nu stroom vragen. Eén rekensom voor Opbrengst › Nu en voor het blad op
 * Thuis, zodat ze hetzelfde zeggen. Rekent alleen met wat de dienst al gaf:
 * de stromen uit het laatste besluit, de meters per apparaat, de schakelaars.
 */
(function (global) {
  'use strict';

  const { haal } = global.app;
  let daken = null;

  /**
   * Haalt wat nodig is: de stromen, de apparaten met een meter die nu meer dan
   * 30 W vragen, de schakelaars, en de dakvlakken (die hooguit elke 30 tellen).
   * Geeft `null` als er nog geen stromen zijn, met `fout` als de dienst niet antwoordde.
   */
  async function laad() {
    const dakenOud = !daken || Date.now() - daken.at > 30_000;
    const [s, h, a, sch] = await Promise.allSettled([haal('api/state'), haal('api/huis'), dakenOud ? haal('api/aansluiting') : Promise.resolve(null), haal('api/schakelaars')]);
    if (a.status === 'fulfilled' && a.value) daken = { at: Date.now(), daken: a.value.daken ?? null };
    const st = s.status === 'fulfilled' ? s.value?.bewoner?.stromen ?? null : null;
    const apparaten = h.status === 'fulfilled'
      ? (h.value?.etages ?? []).flatMap((e) => (e.ruimtes ?? []).flatMap((r) => (r.apparaten ?? []).filter((d) => typeof d.vermogenW === 'number' && d.vermogenW >= 30).map((d) => ({ id: d.id, naam: d.naam, w: d.vermogenW, kamer: r.naam }))))
      : [];
    // Schakelaars (besluit 298): met hun meter, of met het ingevulde vermogen als ze aan staan.
    if (sch.status === 'fulfilled') for (const x of sch.value?.schakelaars ?? []) if (x.keuze && x.nuW != null && x.nuW >= 30) apparaten.push({ id: `sch-${x.id}`, naam: x.keuze.naam || x.naam, w: x.nuW });
    // De auto aan de laadpaal (issue 164): wat hij nu laadt, onder zijn eigen naam; de paal zelf dan niet nog eens.
    for (const a of h.status === 'fulfilled' ? h.value?.opslag?.autos ?? [] : []) {
      if (a.thuis === false || a.vermogenW == null || a.vermogenW < 30) continue;
      const dubbel = apparaten.findIndex((d) => d.id === a.laadpaal);
      if (dubbel >= 0) apparaten.splice(dubbel, 1);
      apparaten.push({ id: `auto-${a.id}`, naam: a.naam, w: a.vermogenW, kamer: a.paalNaam ?? global.t('paal.naam') });
    }
    const batterij = h.status === 'fulfilled' ? h.value?.opslag?.batterij ?? null : null;
    return { live: st ? { st, apparaten, batterij, at: Date.now() } : null, fout: s.status === 'rejected', daken: daken?.daken ?? null };
  }

  /**
   * De verdeling van nu, in W. De thuisaccu (besluit 273): wat hij laadt komt
   * eerst uit de zon, wat hij levert gaat naar het huis. De grootste apparaten
   * (hooguit `max`), samen nooit meer dan het huis; een meter die meer zegt dan
   * het huis is geen apparaat. `sluipW` is het gewone sluipverbruik (besluit 192).
   */
  function verdeling(live, { max = 5, sluipW = 0 } = {}) {
    const st = live.st;
    const zonW = Math.max(0, (st.zonKw ?? 0) * 1000);
    const netW = (st.netKw ?? 0) * 1000;
    const vanNet = Math.max(0, netW);
    const terug = Math.max(0, -netW);
    const accuW = (st.accuKw ?? 0) * 1000;
    const laden = Math.max(0, accuW);
    const leveren = Math.max(0, -accuW);
    const verbruik = st.verbruikKw != null ? st.verbruikKw * 1000 : Math.max(0, zonW + netW - accuW);
    const ladenZon = Math.min(laden, Math.max(0, zonW - terug));
    const zonHuis = Math.max(0, Math.min(verbruik, zonW - terug - ladenZon));
    const uitAccu = Math.min(leveren, Math.max(0, verbruik - zonHuis));
    let ruimte = verbruik;
    const apps = [...live.apparaten].filter((d) => d.w <= verbruik * 1.05).sort((x, y) => y.w - x.w).slice(0, max).map((d) => {
      const w = Math.min(d.w, ruimte);
      ruimte -= w;
      return { ...d, w };
    }).filter((d) => d.w >= 30);
    const rest = Math.max(0, ruimte);
    // Altijd aan: het gewone sluipverbruik, hooguit 90% van de rest.
    const altijd = sluipW ? Math.min(rest * 0.9, sluipW) : 0;
    const zonDeel = verbruik > 0 ? zonHuis / verbruik : 0;
    const accuDeel = verbruik > 0 ? uitAccu / verbruik : 0;
    const netDeel = Math.max(0, 1 - zonDeel - accuDeel);
    return { zonW, netW, vanNet, terug, accuW, laden, leveren, verbruik, ladenZon, ladenNet: Math.max(0, laden - ladenZon), zonHuis, uitAccu, apps, rest, altijd, zonDeel, accuDeel, netDeel };
  }

  global.stroomNu = { laad, verdeling };
})(window);
