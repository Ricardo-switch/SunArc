/*
 * Auto en laadpaal (besluit 259, sinds besluit 318 op hun kaart bij
 * Apparaten, sinds stap 4 toevoegen alleen bij Toevoegen › Auto en laden):
 * hier stel je in; kijken en bedienen gebeurt op de pagina Auto. Of SunArc een
 * laadpaal met de hand mag bedienen, zet je hier aan (`bedienen`, besluit
 * 262), bij het apparaat dat het kan; weg is nee. Links
 * wat de app in Home Assistant vond, elk met een schakelaar, en een ander
 * apparaat kiezen. Rechts per auto de accu, aan welke laadpaal hij laadt en
 * waar hij in de tekening staat (ook de garage, idee 123).
 *
 * De dienst zoekt de apparaten (`api/aansluiting`, veld `laden`); deze kant
 * zet ze neer en zet de keuzes in de antwoorden (`laden`): `aan` per
 * apparaat, `rol` voor wat de bewoner zelf koos, en `instelling` per auto.
 */
'use strict';

const laden = (() => {
  const { esc } = app;
  const t = (k, p) => window.taal.t(k, p);
  const PLEKKEN = ['oprit', 'carport', 'garage'];
  const VERBERG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3 4.1M6.1 6.1C3.9 7.5 2.5 9.7 2 12c1 2.5 5 7 10 7a9.6 9.6 0 0 0 5.9-2.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  /** Kabel vergeten (besluit 263): weg is 21:00 en 50%. */
  const KABEL = { om: '21:00', pct: 50 };
  const KABEL_PCT = [null, 30, 50, 70];

  /** De keuzes zoals ze nu zijn; leeg als er nog niets gekozen is. */
  const keuzeVan = (a) => (a.laden ??= { aan: {}, rol: {}, instelling: {} });
  const bedienenVan = (a) => (keuzeVan(a).bedienen ??= {});
  const leeg = { accuKWh: null, laadpaal: null, plek: null };
  const instelling = (a, id) => ({ ...leeg, ...(keuzeVan(a).instelling[id] ?? {}) });
  const lijst = (info) => info?.laden?.apparaten ?? [];
  const aan = (info) => lijst(info).filter((x) => x.aan);

  /** Wat er in het lijstje links staat: wat hij meet, of dat hij uit staat. */
  function watZin(x) {
    if (!x.aan) return t('w.nietVanDitHuis');
    const wat = x.wat.filter((w) => !(w === 'stroomZetten' && x.stroomA)).slice(0, 4).map((w) => t(`laden.wat.${w}`));
    if (x.stroomA) wat.unshift(t('laden.stroomVan', { min: x.stroomA.min, max: x.stroomA.max }));
    return [x.merk, wat.join(', ') || t('laden.watNiets')].filter(Boolean).join(' · ');
  }

  /** Het korte zinnetje bij Energie in de lijst links: hoeveel auto's en laadpalen. */
  function kortZin(info) {
    if (!info?.laden) return null;
    const x = aan(info);
    const autos = x.filter((y) => y.rol === 'auto').length;
    const palen = x.filter((y) => y.rol === 'laadpaal').length;
    if (!autos && !palen) return t('w.nietsGevonden');
    return [autos ? t('laden.nAutos', { n: autos }) : null, palen ? t('laden.nPalen', { n: palen }) : null].filter(Boolean).join(', ');
  }

  /** Een ander apparaat kiezen, uit wat iets meet wat bij laden hoort. */
  function kiezen(info, label, rol = 'auto') {
    const k = info.laden.kandidaten;
    if (!k.length) return '';
    return `<select class="invoer" data-laad-kies data-rol="${rol}" aria-label="${esc(label)}"><option value="">${esc(label)}</option>${k.map((x) => `<option value="${esc(x.id)}">${esc(x.naam)}</option>`).join('')}</select>`;
  }

  /** Kabel vergeten (besluit 263): om hoe laat, en onder welk %; alleen bij een auto die zegt hoe vol hij is. */
  function kabelVraag(a, x) {
    if (!x.wat.includes('lading')) return '';
    const k = instelling(a, x.id).kabel ?? KABEL;
    const knoppen = KABEL_PCT.map((p) => `<button type="button" data-laad="kabel" data-id="${esc(x.id)}" data-waarde="${p ?? ''}" aria-pressed="${k.pct === p}">${esc(p == null ? t('w.uit') : t('laden.kabelOnder', { pct: p }))}</button>`).join('');
    return `<div class="ld-vraag"><b>${esc(t('laden.kabel'))}</b><div class="keuzes" role="group">${knoppen}</div>
        ${k.pct != null ? `<label class="veldnaam ld-om">${esc(t('laden.kabelOm'))}<input class="invoer" type="time" value="${esc(k.om)}" data-laad-kabelom="${esc(x.id)}"></label>` : ''}
        <p class="mini">${esc(t('laden.kabelUitleg'))}</p></div>`;
  }

  /** Mag SunArc hem met de hand bedienen (besluit 262)? Alleen bij een apparaat dat het kan. */
  function bedienBlok(info, x) {
    if (!x.kanBedienen) return '';
    const z = info.configuratie?.zekering;
    const zin = info.laden.evcc.length
      ? t('laden.bedienenEvcc')
      : [t('laden.bedienenZin'), x.stroomA ? t('laden.bedienenGrens', { max: x.stroomA.max }) : '', z ? t('laden.bedienenZekering', { fasen: z.fasen, ampere: z.ampere }) : ''].filter(Boolean).join(' ');
    return `<div class="ld-schakel"><div><b>${esc(t('laden.bedienen', { naam: x.naam }))}</b><span class="mini">${esc(zin)}</span></div><button type="button" class="schakelaar" role="switch" aria-checked="${x.bedienen === true}" aria-label="${esc(t('laden.bedienen', { naam: x.naam }))}" data-laad="bedienen" data-id="${esc(x.id)}" ${info.laden.evcc.length ? 'disabled' : ''}></button></div>`;
  }

  /** Rechts: wat je bij het gekozen apparaat instelt. */
  function instellen(info, a, x) {
    const palen = aan(info).filter((y) => y.rol === 'laadpaal');
    const i = instelling(a, x.id);
    const keuzes = (sleutel, opties, huidig) => `<div class="keuzes" role="group">${opties.map(([w, tekst]) => `<button type="button" data-laad="${sleutel}" data-id="${esc(x.id)}" data-waarde="${esc(w ?? '')}" aria-pressed="${w === huidig}">${esc(tekst)}</button>`).join('')}</div>`;
    // Een laadpaal heeft altijd een eigen plek (issue 164); een auto met een paal staat daar als hij aan de kabel zit.
    const plekUitleg = x.rol === 'laadpaal' ? 'laden.paalPlekUitleg' : palen.length ? 'laden.autoPlekUitleg' : 'laden.plekUitleg';
    const plek = `<div class="ld-vraag"><b>${esc(t('laden.plek'))}</b>${keuzes('plek', PLEKKEN.map((p) => [p, t(`laden.plek.${p}`)]), i.plek)}<p class="mini">${esc(t(plekUitleg))}</p></div>`;
    const rol = x.zelf ? `<div class="ld-vraag"><b>${esc(t('laden.watIsHet'))}</b>${keuzes('rol', [['auto', t('laden.rol.auto')], ['laadpaal', t('laden.rol.laadpaal')]], x.rol)}<button type="button" class="knop" data-laad="weg" data-id="${esc(x.id)}" style="align-self: start">${esc(t('w.weghalen'))}</button></div>` : '';
    if (x.rol === 'auto') {
      const paalOpties = [['', palen.length === 1 ? t('laden.paalVanzelf', { naam: palen[0].naam }) : t('auto.paal.geen')], ...palen.map((p) => [p.id, p.naam])];
      return `${rol}
        <label class="veldnaam">${esc(t('laden.accu'))}<span class="ld-met"><input class="invoer" type="number" inputmode="decimal" min="5" max="250" step="0.1" data-laad-accu="${esc(x.id)}" value="${i.accuKWh ?? ''}" placeholder="${esc(t('laden.accuVoorbeeld'))}"><span>kWh</span></span></label>
        <p class="mini">${esc(t('laden.accuUitleg'))}</p>
        ${palen.length ? `<label class="veldnaam">${esc(t('laden.laadtAan'))}<select class="invoer" data-laad-paal="${esc(x.id)}">${paalOpties.map(([w, tekst]) => `<option value="${esc(w)}" ${(i.laadpaal ?? '') === w ? 'selected' : ''}>${esc(tekst)}</option>`).join('')}</select></label>` : ''}
        ${kabelVraag(a, x)}
        ${plek}${bedienBlok(info, x)}`;
    }
    // Een laadpaal: wat hij kan, en waar hij staat (issue 164: ook als er een auto is).
    const kan = x.stroomA ? t('laden.paalKan', { min: x.stroomA.min, max: x.stroomA.max }) : t('laden.paalKanNiet');
    return `${rol}<div class="ld-vraag"><b>${esc(t('laden.watHijKan'))}</b><p class="uitleg geen-marge">${esc(kan)}</p></div>${bedienBlok(info, x)}${plek}`;
  }

  /** Een tik; true als er iets te bewaren is, 'teken' als alleen het beeld verandert. */
  function klik(el, info, a, staat) {
    const knop = el.closest('[data-laad]');
    if (!knop) return false;
    const { laad, id } = knop.dataset;
    const k = keuzeVan(a);
    if (laad === 'aan') {
      const nu = knop.getAttribute('aria-checked') === 'true';
      const zelf = lijst(info).find((y) => y.id === id)?.zelf;
      // Wat de app vond, staat zonder keuze aan; uit is een keuze.
      if (!nu && !zelf) delete k.aan[id];
      else k.aan[id] = !nu;
      return true;
    }
    if (laad === 'kabel') {
      const i = instelling(a, id);
      const w = knop.dataset.waarde;
      k.instelling[id] = { ...i, kabel: { om: (i.kabel ?? KABEL).om, pct: w === '' ? null : Number(w) } };
      return true;
    }
    if (laad === 'bedienen') {
      const b = bedienenVan(a);
      if (knop.getAttribute('aria-checked') === 'true') delete b[id];
      else b[id] = true;
      return true;
    }
    if (laad === 'rol') {
      k.rol[id] = knop.dataset.waarde;
      return true;
    }
    if (laad === 'weg') {
      delete k.rol[id];
      delete k.aan[id];
      delete k.instelling[id];
      if (staat.wie === id) staat.wie = null;
      return true;
    }
    if (laad === 'plek') {
      const w = knop.dataset.waarde;
      const i = instelling(a, id);
      k.instelling[id] = { ...i, plek: i.plek === w ? null : w };
      return true;
    }
    return false;
  }

  /** Een veld of keuzelijst; true als er iets te bewaren is. */
  function verander(el, info, a, staat) {
    const k = keuzeVan(a);
    if (el.matches('[data-laad-kies]')) {
      if (!el.value) return false;
      // Wat je koos: een auto of een laadpaal (twee keuzes onder elkaar).
      k.rol[el.value] = el.dataset.rol === 'laadpaal' ? 'laadpaal' : 'auto';
      k.aan[el.value] = true;
      staat.wie = el.value;
      return true;
    }
    if (el.dataset.laadAccu) {
      const n = Number(el.value.replace(',', '.'));
      const accu = el.value === '' || !Number.isFinite(n) ? null : Math.min(250, Math.max(5, Math.round(n * 10) / 10));
      if (accu != null) el.value = String(accu);
      k.instelling[el.dataset.laadAccu] = { ...instelling(a, el.dataset.laadAccu), accuKWh: accu };
      return true;
    }
    if (el.dataset.laadKabelom) {
      if (!/^\d{2}:\d{2}$/.test(el.value)) return false;
      const i = instelling(a, el.dataset.laadKabelom);
      k.instelling[el.dataset.laadKabelom] = { ...i, kabel: { om: el.value, pct: (i.kabel ?? KABEL).pct } };
      return true;
    }
    if (el.dataset.laadPaal) {
      k.instelling[el.dataset.laadPaal] = { ...instelling(a, el.dataset.laadPaal), laadpaal: el.value || null };
      return true;
    }
    return false;
  }

  /**
   * Het blad van één auto of laadpaal bij Apparaten (besluit 318): of hij
   * meedoet, en wat je bij hem instelt. Dezelfde keuzes als eerst bij Energie.
   */
  function blad(info, a, id) {
    const x = lijst(info).find((y) => y.id === id);
    if (!x) return null;
    // Verborgen (stap 4): terughalen; anders de keuzes, evcc bij de laadpaal, en onderaan Verbergen.
    if (!x.aan) return { naam: x.naam, rol: x.rol, html: `<p class="uitleg">${esc(t('accu.verborgenZin'))}</p><button type="button" class="knop" data-laad="aan" data-id="${esc(x.id)}" aria-checked="false" style="align-self: start">${esc(t('toev.terughalen'))}</button>` };
    const palen = aan(info).filter((y) => y.rol === 'laadpaal');
    const evcc = x.rol === 'laadpaal' || (!palen.length && x === aan(info)[0]) ? evccBlok(info) : '';
    const verberg = `<button type="button" class="ld-verberg" data-laad="aan" data-id="${esc(x.id)}" aria-checked="true">${VERBERG}<span>${esc(t('toev.verbergen'))}<small>${esc(t(x.rol === 'auto' ? 'laden.verbergAuto' : 'laden.verbergPaal'))}</small></span></button>`;
    // De klimaatregeling van een auto telt niet als klimaat in huis: dat staat bij de auto.
    const klimaat = x.rol === 'auto' ? `<p class="mini">${esc(t('laden.klimaatNoot'))}</p>` : '';
    return { naam: x.naam, rol: x.rol, html: `${instellen(info, a, x)}${klimaat}${evcc}${verberg}` };
  }

  /** Of SunArc de stand van evcc mag zetten (besluit 278), per laadpunt; op de kaart van de laadpaal (stap 4). */
  function evccBlok(info) {
    if (!info.laden.evcc.length) return '';
    const mag = info.laden.evcc
      .filter((p) => p.kanBedienen)
      .map((p) => `<div class="ld-schakel"><div><b>${esc(t('laden.evccMag', { naam: p.naam }))}</b><span class="mini">${esc(t('laden.evccMagZin'))}</span></div><button type="button" class="schakelaar" role="switch" aria-checked="${p.bedienen === true}" aria-label="${esc(t('laden.evccMag', { naam: p.naam }))}" data-laad="bedienen" data-id="${esc(p.id)}"></button></div>`)
      .join('');
    return `<div class="ld-evcc"><span class="stip" style="background: var(--ijs)"></span><span><b>${esc(t('laden.evccKop'))}</b> ${esc(t('laden.evccZin'))}</span></div>${mag}`;
  }

  /** Zelf een apparaat kiezen (Toevoegen › Auto en laden, stap 4): wat iets meet dat bij laden hoort. */
  function zelfKiezen(info) {
    if (!info?.laden) return `<p class="uitleg">${esc(t('laden.geenHA'))}</p>`;
    // Een auto en een laadpaal apart, onder elkaar: overzichtelijker dan eerst kiezen en daarna zeggen wat het is.
    const auto = kiezen(info, t('laden.eenAuto'), 'auto');
    if (!auto) return `<p class="uitleg">${esc(t('laden.zelfGeen'))}</p>`;
    return `<label class="veldnaam">${esc(t('laden.zelfAuto'))}${auto}</label><label class="veldnaam">${esc(t('laden.zelfPaal'))}${kiezen(info, t('laden.eenPaal'), 'laadpaal')}</label><p class="mini">${esc(t('laden.zelfUitleg'))}</p>`;
  }

  return { klik, verander, kortZin, blad, lijst, zelfKiezen, watZin };
})();
// Ook als window.laden, voor het blad bij Apparaten (instellen.js, besluit 318).
window.laden = laden;
