/*
 * Alleen de teksten van één taal laden (23 november 2026, Meertalig stap 4).
 *
 * Eerst laadde elke pagina teksten.nl.js én teksten.en.js: samen bijna 700 kB,
 * meer dan een derde van alle code van Thuis, terwijl er maar één taal te zien
 * is. Dit script staat op hun plek, kiest de taal zoals taal.js dat doet (wat
 * de bewoner bij Profiel koos, anders zijn account in Home Assistant, anders de
 * browser) en schrijft de scriptregel van die ene taal in de pagina. Zo laadt
 * hij nog steeds vóór taal.js en de rest, net als eerst.
 *
 * De keuze staat dubbel: hier en in taal.js (dat ook zonder dit script werkt,
 * zoals in de schetsen). Een test houdt de twee gelijk (taal.test.ts).
 */
(function (global) {
  'use strict';
  /** De talen die de hele app spreekt; alleen die kiest de app vanzelf. */
  const HEEL = ['nl', 'en'];
  const past = (c) => {
    const t = String(c ?? '').toLowerCase().split(/[-_]/)[0];
    return HEEL.includes(t) ? t : null;
  };
  function haTaal() {
    try {
      /** @type {any} */
      const ha = global.parent?.document?.querySelector('home-assistant');
      return ha?.hass?.language ?? null;
    } catch {
      return null;
    }
  }
  function gekozen() {
    try {
      return past(global.localStorage?.getItem('sc-taal'));
    } catch {
      return null;
    }
  }
  function vanzelf() {
    /** @type {any} */
    const n = global.navigator ?? {};
    const talen = [haTaal(), n.language, ...(n.languages ?? [])].filter(Boolean);
    return talen.map(past).find(Boolean) ?? (talen.length ? 'en' : 'nl');
  }
  const code = gekozen() ?? vanzelf();
  global.TAAL_GELADEN = code;
  // De volledige namen, zodat de build er zijn stempel achter zet (build.js).
  const src = code === 'en' ? 'kit/teksten.en.js' : 'kit/teksten.nl.js';
  global.document.write(`<script src="${src}"></` + 'script>');
})(window);
