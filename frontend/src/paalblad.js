/*
 * Het blad van de laadpaal op Thuis (issue 164, idee 135; schets
 * Wand-Laadpaal #blad). Een tik op de paal, de auto ernaast of het label
 * opent het: wat hij nu laadt en waarvan, de auto, de stroom per fase, wat hij
 * vandaag laadde, en de weg naar de pagina Auto. Alleen kijken.
 */
(function (global) {
  'use strict';

  const { esc, haal } = global.app;
  const t = (k, v) => global.t(k, v);
  const { getal, klok } = global.taal;

  /** Wat het blad toont: de auto uit het huis, en wat Thuis uitrekende over zon en net. */
  let nu = null;
  let vandaag = null;
  let open = false;

  /** Vandaag geladen, uit de laadbeurten van deze auto. */
  async function laadVandaag(id) {
    try {
      const r = await haal(`api/laadbeurten?auto=${encodeURIComponent(id)}`);
      const dag = new Date().toDateString();
      const beurten = (r?.beurten?.beurten ?? []).filter((b) => new Date(b.tot).toDateString() === dag);
      const kWh = beurten.reduce((s, b) => s + (b.kWh ?? 0), 0);
      const metZon = beurten.every((b) => b.zonKWh != null);
      vandaag = { kWh, zonKWh: metZon ? beurten.reduce((s, b) => s + b.zonKWh, 0) : null };
    } catch {
      vandaag = null;
    }
    if (open) teken();
  }

  function html() {
    const a = nu.auto;
    const sluit = `<button type="button" class="sluit" data-paal-sluit aria-label="${esc(t('algemeen.sluiten'))}">×</button>`;
    const plek = t(`paal.plek.${nu.plek ?? 'oprit'}`);
    const kop = `<div class="hand-boven"><div><h2>${esc(a.paalNaam ?? t('paal.naam'))}</h2><p class="nu">${esc([plek, a.thuis === false ? t('paal.weg') : null].filter(Boolean).join(' · '))}</p></div>${sluit}</div>`;
    let stand;
    if (nu.kw > 0.05) {
      const zon = Math.max(0, Math.min(nu.kw, nu.zonKw));
      const deel = (zon / nu.kw) * 100;
      stand = `<div class="pb-nu"><div class="pb-getal"><b>${getal(nu.kw, 1)}</b><span>kW</span><small>${esc(t('paal.laadtNu'))}</small></div>
        <div><div class="pb-balk"><i style="width: ${deel.toFixed(1)}%; background: var(--zon)"></i><i style="width: ${(100 - deel).toFixed(1)}%; background: var(--violet)"></i></div>
        <div class="pb-leg">${zon >= 0.05 ? `<span><i style="background: var(--zon)"></i>${esc(t('paal.zon', { kw: getal(zon, 1) }))}</span>` : ''}${nu.kw - zon >= 0.05 ? `<span><i style="background: var(--violet)"></i>${esc(t('paal.net', { kw: getal(nu.kw - zon, 1) }))}</span>` : ''}</div></div></div>`;
    } else if (nu.kw < -0.05) stand = `<p class="hand-hoe">${esc(t('paal.levert', { kw: getal(-nu.kw, 1) }))}</p>`;
    else stand = `<p class="hand-hoe">${esc(t(a.thuis === false ? 'paal.geenAuto' : a.aangesloten ? 'paal.aanKabel' : 'paal.geenAuto'))}</p>`;
    const zin = [a.volOm && a.laadt ? t('paal.volOm', { klok: klok(Date.parse(a.volOm)) }) : null, a.laadgrens ? t('paal.totGrens', { pct: a.laadgrens }) : null].filter(Boolean).join(', ');
    const pct = a.pct ?? null;
    const auto = a.laadpaal != null || a.pct != null
      ? `<a class="pb-auto" href="auto.html"><span class="pb-ring" style="--p: ${pct ?? 0}"><b>${pct == null ? '–' : `${getal(pct, 0)}%`}</b></span><span><b>${esc(a.naam)}</b><small>${esc(zin || t('paal.auto'))}</small></span><span class="pijl" aria-hidden="true">›</span></a>`
      : '';
    const fasen = (a.stroomA ?? []).length
      ? `<div><h3 class="pb-h3">${esc(t('paal.fasen'))}</h3><div class="pb-fasen" style="grid-template-columns: repeat(${a.stroomA.length}, minmax(0, 1fr))">${a.stroomA.map((x, i) => `<div><span>${a.stroomA.length > 1 ? `L${i + 1}` : t('paal.stroom')}</span><b>${getal(x, 1)} A</b></div>`).join('')}</div></div>`
      : '';
    // Laadt hij nu maar telt de statistiek vandaag nog niets, dan zegt het blad liever niets dan "nog niet geladen".
    const dag = vandaag && !(vandaag.kWh < 0.05 && nu.kw > 0.05)
      ? `<div><h3 class="pb-h3">${esc(t('paal.vandaag'))}</h3><p class="pb-zin">${esc(vandaag.kWh < 0.05 ? t('paal.vandaagNiets') : vandaag.zonKWh != null ? t('paal.vandaagZin', { kwh: getal(vandaag.kWh, 1), pct: Math.round((vandaag.zonKWh / vandaag.kWh) * 100) }) : t('paal.vandaagZinZonder', { kwh: getal(vandaag.kWh, 1) }))}</p></div>`
      : '';
    return `${kop}${stand}${auto}${fasen}${dag}<div class="hand-onder"><a class="hand-zet" href="auto.html">${esc(t('paal.naarAuto'))}</a></div>`;
  }

  function teken() {
    let laag = document.querySelector('[data-paalblad]');
    if (!open || !nu) {
      laag?.remove();
      return;
    }
    const tel = global.app.telStand();
    if (!laag) {
      laag = document.createElement('div');
      laag.className = 'hand-laag';
      laag.setAttribute('data-paalblad', '');
      laag.setAttribute('role', 'dialog');
      laag.setAttribute('aria-modal', 'true');
      laag.setAttribute('aria-label', t('paal.label'));
      (tel ? document.body : (document.getElementById('wand') ?? document.body)).append(laag);
      laag.innerHTML = '<div class="hand-achter" data-paal-sluit></div><div class="hand-vel"><section class="glas hand-blad pb-blad"></section></div>';
    }
    laag.classList.toggle('op-tel', tel);
    const h = html();
    const blad = laag.querySelector('.pb-blad');
    if (blad.dataset.html !== h) {
      blad.innerHTML = h;
      blad.dataset.html = h;
    }
  }

  /** Opent het blad; `gegevens` is { auto, plek, kw, zonKw } van Thuis. */
  function openen(gegevens) {
    nu = gegevens;
    open = true;
    vandaag = null;
    teken();
    document.querySelector('[data-paalblad] .sluit')?.focus();
    void laadVandaag(gegevens.auto.id);
  }
  /** Nieuwe cijfers terwijl het blad open is. */
  function bij(gegevens) {
    if (!open || !gegevens) return;
    nu = gegevens;
    teken();
  }
  function sluiten() {
    open = false;
    teken();
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-paal-sluit]')) sluiten();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) sluiten();
  });

  global.paalblad = { openen, bij, sluiten };
})(window);
