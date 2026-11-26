/*
 * Verwarming bij Klimaat (besluit 350): waar de warmte vandaan komt, hoe warm de cv het water maakt en welke
 * thermostaat de ketel stuurt. Stond eerst bij Energie; wie bij Klimaat zoekt, vindt het nu daar. Het antwoord
 * hoort bij de aansluiting (api/aansluiting), dus bewaren stuurt de aansluiting zoals Energie dat doet, met
 * alleen de verwarming anders.
 *   soortVerwarming.laad()  de aansluiting en het huis van de dienst
 *   soortVerwarming.vorm()  het deel, voor wand en telefoon
 *   soortVerwarming.zin()   de korte zin in de lijst met delen
 *   soortVerwarming.stand() goed, leeg of null (nog niet geladen)
 *   soortVerwarming.na      wat er na laden of bewaren getekend moet worden
 */
const soortVerwarming = (function (global) {
  'use strict';
  const t = (k, p) => global.taal.t(k, p);
  const esc = (s) => global.app.esc(s);

  /** Wat de dienst zegt (api/aansluiting), of null. */
  let info = null;
  /** Het huis (api/huis), voor de thermostaten. */
  let huis = null;
  const BRONNEN = ['cv', 'warmtepomp', 'hybride', 'stadsverwarming', 'airco'];
  const api = { laad, vorm, zin, stand, antwoord: () => info?.antwoorden?.verwarming ?? null, na: () => {} };

  async function laad() {
    const [a, h] = await Promise.allSettled([global.app.haal('api/aansluiting'), global.app.haal('api/huis')]);
    if (a.status === 'fulfilled') info = a.value;
    if (h.status === 'fulfilled') huis = h.value;
    api.na();
  }

  const v = () => info?.antwoorden?.verwarming ?? { soort: null, aanvoerC: null, thermostaat: null };

  function zin() {
    if (!info) return '…';
    const s = v().soort ? t(`energie.soort.${v().soort}`) : null;
    if (!s) return t('instellingen.nogKiezen');
    return v().aanvoerC ? t('energie.aanvoer', { soort: s, c: v().aanvoerC }) : s;
  }

  function stand() {
    return !info ? null : v().soort ? 'goed' : 'leeg';
  }

  function thermostaatKeuze(x) {
    const lijst = global.huismodel.thermostaten(huis);
    const voorstel = lijst[0];
    const nu = x.thermostaat ?? '';
    const opties = [['', voorstel ? t('energie.thermostaatUitHA', { naam: voorstel.naam, kamer: voorstel.kamer }) : t('energie.geenThermostaatHA')], ...lijst.map((y) => [y.sleutel, t('energie.naamKamer', { naam: y.naam, kamer: y.kamer })]), ['geen', t('inr.nietMee')]];
    return `<label class="veldnaam">${esc(t('energie.thermostaatKetel'))}<select class="invoer" data-vw-thermostaat>${opties.map(([w, y]) => `<option value="${esc(w)}" ${w === nu ? 'selected' : ''}>${esc(y)}</option>`).join('')}</select></label>
      <p class="mini">${esc(t('energie.thermostaatUitleg'))}</p>`;
  }

  function vorm() {
    if (!info) return `<p class="klein">${esc(t('algemeen.laden'))}…</p>`;
    const x = v();
    const keuzes = [...BRONNEN.map((b) => [b, t(`energie.bron.${b}`)]), ['weetniet', t('w.weetIkNiet')]];
    return `<div class="kopregel"><h2 class="kop-2">${esc(t('energie.verwarming'))}</h2></div>
    <div class="vw-vraag" data-verwarming>
      <h3 class="kop-3">${esc(t('energie.waarWarmte'))}</h3>
      <div class="keuzes" role="group" aria-label="${esc(t('energie.verwarming'))}">${keuzes.map(([w, y]) => `<button type="button" data-vw-soort="${esc(w)}" aria-pressed="${w === x.soort}">${esc(y)}</button>`).join('')}</div>
      ${x.soort === 'airco' ? '' : `<label class="veldnaam">${esc(t('energie.aanvoerLabel'))}<input class="invoer" type="number" inputmode="numeric" min="25" max="90" step="1" data-vw-aanvoer value="${x.aanvoerC ?? ''}" placeholder="${esc(t('energie.bijvoorbeeld60'))}"></label>
      <p class="mini">${esc(t('energie.aanvoerUitleg'))}</p>`}
      ${x.soort === 'stadsverwarming' || x.soort === 'airco' ? '' : thermostaatKeuze(x)}
    </div>`;
  }

  /** De aansluiting zoals Energie hem stuurt, met de nieuwe verwarming; wat hier niet gekozen is, houdt de dienst. */
  function bewaar(nieuw) {
    const x = info.antwoorden;
    const opZon = Object.fromEntries(Object.entries(x.opZon ?? {}).filter(([, w]) => typeof w === 'boolean'));
    info = { ...info, antwoorden: { ...x, verwarming: nieuw } };
    api.na();
    global.groep.bewaarStraks(async () => {
      const uit = await global.groep.stuur('api/aansluiting', { panelen: x.panelen, zekering: x.zekering ?? null, tarief: x.tarief ?? null, verwarming: nieuw, voorkantZon: x.voorkantZon ?? null, dak: x.dak ?? null, elders: x.elders ?? {}, daken: x.daken ?? null, opZon, opZonUit: x.opZonUit ?? [], laden: x.laden ?? { aan: {}, rol: {}, instelling: {} }, accu: x.accu ?? { aan: {}, zelf: [], instelling: {} } });
      if (uit?.ok) {
        info = uit.antwoord;
        api.na();
      }
      return uit;
    });
  }

  document.addEventListener('click', (e) => {
    const knop = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('[data-vw-soort]'));
    if (!knop || !info) return;
    bewaar({ ...v(), soort: knop.dataset.vwSoort });
  });
  document.addEventListener('change', (e) => {
    const el = /** @type {HTMLInputElement} */ (e.target);
    if (!info || !el.matches?.('[data-vw-thermostaat], [data-vw-aanvoer]')) return;
    if (el.matches('[data-vw-thermostaat]')) return bewaar({ ...v(), thermostaat: el.value || null });
    const n = Math.round(Number(el.value));
    const c = el.value === '' || !Number.isFinite(n) ? null : Math.min(90, Math.max(25, n));
    bewaar({ ...v(), aanvoerC: c });
  });

  return api;
})(window);

void soortVerwarming.laad();
