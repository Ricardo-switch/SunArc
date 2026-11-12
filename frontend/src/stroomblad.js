/*
 * Stroom nu, het blad op Thuis (idee 135). Een tik op de zon, het net of de
 * thuisaccu, op hun lijn of hun label, of op een vakje onder het huis op de
 * telefoon, opent het: per apparaat wat het nu van die bron gebruikt. Zelfde
 * rekensom als Opbrengst › Nu (stroomnu.js). Alleen kijken; elke vijf tellen
 * opnieuw zolang het open is.
 */
(function (global) {
  'use strict';

  const { esc } = global.app;
  const t = (k, v) => global.t(k, v);
  const { getal } = global.taal;

  const KLEUR = { zon: 'var(--zon)', net: 'var(--violet)', accu: 'var(--ijs)', terug: 'var(--mint)', huis: 'rgb(var(--wit) / 0.55)' };
  const kw = (w) => getal(w / 1000, w >= 10_000 ? 0 : w >= 1000 ? 1 : 2);

  let open = false;
  let soort = 'zon';
  let data = null;
  let klok = null;
  let bezig = false;

  async function ververs() {
    if (bezig) return;
    bezig = true;
    try {
      data = await global.stroomNu.laad();
    } catch {
      data = { live: null, fout: true, daken: null };
    }
    bezig = false;
    if (open) teken();
  }

  /** Een balk met delen in hun kleur, en eronder de woorden. */
  function balk(delen) {
    const som = delen.reduce((s, d) => s + d.w, 0);
    if (som < 30) return '';
    const zichtbaar = delen.filter((d) => d.w >= 30);
    return `<div><div class="pb-balk">${zichtbaar.map((d) => `<i style="width: ${((d.w / som) * 100).toFixed(1)}%; background: ${d.kleur}"></i>`).join('')}</div>
      <div class="pb-leg">${zichtbaar.map((d) => `<span><i style="background: ${d.kleur}"></i>${esc(d.naam)} ${kw(d.w)} kW</span>`).join('')}</div></div>`;
  }
  /** Het grote getal bovenaan. */
  const groot = (w, woord, rest = '') => `<div class="pb-nu"><div class="pb-getal"><b>${kw(w)}</b><span>kW</span><small>${esc(woord)}</small></div>${rest || '<div></div>'}</div>`;
  /** Een rij per apparaat: naam, kamer, wat het van deze bron gebruikt, en een staafje naar het grootste. */
  function rijen(lijst, kleur) {
    const top = Math.max(1, ...lijst.map((r) => r.w));
    return `<div class="sb-rijen">${lijst.map((r) => `<div class="sb-rij"><span class="sb-naam"><b>${esc(r.naam)}</b>${r.kamer ? `<small>${esc(r.kamer)}</small>` : ''}</span><b class="sb-w">${kw(r.w)} kW</b><span class="sb-staaf"><i style="width: ${((r.w / top) * 100).toFixed(1)}%; background: ${r.kleur ?? kleur}"></i></span></div>`).join('')}</div>`;
  }
  const kop3 = (k) => `<h3 class="pb-h3">${esc(k)}</h3>`;
  const zin = (k) => `<p class="hand-hoe">${esc(k)}</p>`;
  /** De apparaten met hun deel van een bron, alleen wie er 30 W of meer van krijgt. */
  const deelVan = (v, deel) => v.apps.map((a) => ({ naam: a.naam, kamer: a.kamer, w: a.w * deel })).filter((a) => a.w >= 30);

  function zonDeel(v) {
    if (v.zonW < 30) return zin(t('stroom.zon.niets'));
    const naar = balk([
      { naam: t('stroom.leg.huis'), w: v.zonHuis, kleur: KLEUR.zon },
      { naam: t('stroom.leg.accu'), w: v.ladenZon, kleur: KLEUR.accu },
      { naam: t('stroom.leg.terug'), w: v.terug, kleur: KLEUR.terug },
    ]);
    // Per dakvlak, als er meer zijn (besluit 254): wat elk nu levert.
    const dk = data.daken;
    const vlakken = (dk?.vlakken ?? []).filter((x) => dk.nu?.[x.letter]?.w != null);
    const daken = vlakken.length > 1
      ? `<div>${kop3(t('stroom.zon.daken'))}${rijen(vlakken.map((x) => ({ naam: `${x.letter} · ${global.dakvlakken?.naam ? global.dakvlakken.naam(x, dk.vlakken) : x.letter}`, w: dk.nu[x.letter].w })), KLEUR.zon)}<button type="button" class="sb-link" data-tik="daken">${esc(t('stroom.zon.dakenOpen'))}</button></div>`
      : '';
    const wie = deelVan(v, v.zonDeel);
    return `${groot(v.zonW, t('stroom.zon.nu'), naar)}${daken}<div>${kop3(t('stroom.zon.wie'))}${wie.length ? rijen(wie, KLEUR.zon) : zin(t('stroom.geenApparaat'))}</div>`;
  }

  function huisDeel(v) {
    const herkomst = balk([
      { naam: t('stroom.leg.zon'), w: v.zonHuis, kleur: KLEUR.zon },
      { naam: t('stroom.leg.accu'), w: v.uitAccu, kleur: KLEUR.accu },
      { naam: t('stroom.leg.net'), w: v.verbruik * v.netDeel, kleur: KLEUR.net },
    ]);
    const lijst = v.apps.map((a) => ({ naam: a.naam, kamer: a.kamer, w: a.w, kleur: v.zonDeel >= 0.5 ? KLEUR.zon : v.accuDeel >= 0.5 ? KLEUR.accu : KLEUR.net }));
    if (v.rest >= 30) lijst.push({ naam: t('opbrengst.rest'), w: v.rest, kleur: KLEUR.huis });
    return `${groot(v.verbruik, t('stroom.huis.nu'), herkomst)}<div>${kop3(t('opbrengst.nu.apparaten'))}${v.apps.length ? rijen(lijst, KLEUR.huis) : zin(t('opbrengst.nu.geenApparaten'))}</div>`;
  }

  function netDeel(v) {
    if (v.terug >= 30) return `${groot(v.terug, t('stroom.net.terug'))}${zin(t('stroom.net.terugZin'))}`;
    if (v.vanNet < 30) return zin(t('stroom.net.niets'));
    const wie = deelVan(v, v.netDeel);
    if (v.ladenNet >= 30) wie.push({ naam: t('stroom.net.naarAccu'), w: v.ladenNet, kleur: KLEUR.accu });
    const naar = balk([
      { naam: t('stroom.leg.huis'), w: Math.max(0, v.vanNet - v.ladenNet), kleur: KLEUR.net },
      { naam: t('stroom.leg.accu'), w: v.ladenNet, kleur: KLEUR.accu },
    ]);
    return `${groot(v.vanNet, t('stroom.net.van'), naar)}<div>${kop3(t('stroom.net.wie'))}${wie.length ? rijen(wie, KLEUR.net) : zin(t('stroom.geenApparaat'))}</div>`;
  }

  function accuDeel(v) {
    const b = data.live.batterij;
    const ring = b?.pct != null ? `<span class="pb-ring" style="--p: ${b.pct}"><b>${getal(b.pct, 0)}%</b></span>` : '';
    if (v.laden >= 30) {
      const extra = [b?.volOm ? t('paal.volOm', { klok: global.taal.klok(Date.parse(b.volOm)) }) : null].filter(Boolean).join('');
      return `${groot(v.laden, t('stroom.accu.laadt'), balk([{ naam: t('stroom.leg.zon'), w: v.ladenZon, kleur: KLEUR.zon }, { naam: t('stroom.leg.net'), w: v.ladenNet, kleur: KLEUR.net }]))}${ring || extra ? `<div class="sb-accu">${ring}<span>${esc(extra || b?.naam || '')}</span></div>` : ''}`;
    }
    if (v.leveren >= 30) {
      const wie = deelVan(v, v.accuDeel);
      const extra = b?.urenNog != null ? t('stroom.accu.uren', { uren: getal(b.urenNog, b.urenNog < 10 ? 1 : 0) }) : '';
      return `${groot(v.leveren, t('stroom.accu.levert'))}${ring || extra ? `<div class="sb-accu">${ring}<span>${esc(extra || b?.naam || '')}</span></div>` : ''}<div>${kop3(t('stroom.accu.wie'))}${wie.length ? rijen(wie, KLEUR.accu) : zin(t('stroom.geenApparaat'))}</div>`;
    }
    return `${ring ? `<div class="sb-accu">${ring}<span>${esc(b?.naam ?? '')}</span></div>` : ''}${zin(t('stroom.accu.rust'))}`;
  }

  function html() {
    const sluit = `<button type="button" class="sluit" data-sb-sluit aria-label="${esc(t('algemeen.sluiten'))}">×</button>`;
    const live = data?.live;
    const metAccu = !!live?.batterij;
    if (soort === 'accu' && !metAccu) soort = 'zon';
    const tijd = live ? (global.taal.tijd ? global.taal.tijd(live.at) : new Date(live.at).toLocaleTimeString(global.taal.locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })) : null;
    const kop = `<div class="hand-boven"><div><h2>${esc(t('stroom.kop'))}</h2><p class="nu">${tijd ? `<span class="livelabel"><i aria-hidden="true"></i>${esc(t('opbrengst.nu.live', { tijd }))}</span>` : esc(t('opbrengst.nu.wachten'))}</p></div>${sluit}</div>`;
    const tabs = ['zon', 'huis', 'net', ...(metAccu ? ['accu'] : [])];
    const seg = `<div class="chips seg hand-seg" role="group" aria-label="${esc(t('stroom.kop'))}">${tabs.map((k) => `<button type="button" class="chip" data-sb-soort="${k}" aria-pressed="${k === soort}">${esc(t(`stroom.tab.${k}`))}</button>`).join('')}</div>`;
    if (!live) return `${kop}${seg}${zin(data?.fout ? t('kamer.geenVerbinding') : t('opbrengst.nu.wachten'))}`;
    const v = global.stroomNu.verdeling(live, { max: 6 });
    const inhoud = soort === 'huis' ? huisDeel(v) : soort === 'net' ? netDeel(v) : soort === 'accu' ? accuDeel(v) : zonDeel(v);
    return `${kop}${seg}${inhoud}<div class="hand-onder"><a class="hand-zet" href="opbrengst.html#nu">${esc(t('stroom.naarOpbrengst'))}</a></div>`;
  }

  function teken() {
    let laag = document.querySelector('[data-stroomblad]');
    if (!open) {
      laag?.remove();
      return;
    }
    const tel = global.app.telStand();
    if (!laag) {
      laag = document.createElement('div');
      laag.className = 'hand-laag';
      laag.setAttribute('data-stroomblad', '');
      laag.setAttribute('role', 'dialog');
      laag.setAttribute('aria-modal', 'true');
      laag.setAttribute('aria-label', t('stroom.label'));
      (tel ? document.body : (document.getElementById('wand') ?? document.body)).append(laag);
      laag.innerHTML = '<div class="hand-achter" data-sb-sluit></div><div class="hand-vel"><section class="glas hand-blad pb-blad sb-blad"></section></div>';
    }
    laag.classList.toggle('op-tel', tel);
    const h = html();
    const blad = laag.querySelector('.sb-blad');
    if (blad.dataset.html !== h) {
      blad.innerHTML = h;
      blad.dataset.html = h;
    }
  }

  /** Opent het blad bij een bron: 'zon', 'huis', 'net' of 'accu'. */
  function openen(welke) {
    soort = welke || 'zon';
    open = true;
    teken();
    document.querySelector('[data-stroomblad] .sluit')?.focus();
    void ververs();
    clearInterval(klok);
    klok = setInterval(() => document.visibilityState === 'visible' && void ververs(), 5_000);
  }
  function sluiten() {
    open = false;
    clearInterval(klok);
    klok = null;
    teken();
  }

  document.addEventListener('click', (e) => {
    if (!open) return;
    if (e.target.closest('[data-sb-sluit]')) return void sluiten();
    const k = e.target.closest('[data-sb-soort]');
    if (k) {
      soort = k.dataset.sbSoort;
      teken();
    }
    // Naar De zon op je daken: dit blad dicht, Thuis opent dat blad.
    if (e.target.closest('.sb-blad [data-tik="daken"]')) sluiten();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) sluiten();
  });

  global.stroomblad = { openen, sluiten };
})(window);
