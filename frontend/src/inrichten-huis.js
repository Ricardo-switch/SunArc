/*
 * Deel van inrichten.js (opgesplitst op 22 november 2026): huis. Een gewoon script dat na
 * inrichten.js laadt en zijn bovenste namen deelt met de andere delen van de pagina.
 *
 * Sinds besluit 352 staan hier geen schermen meer: Kamers, Apparaten en Buiten teken je in Je huis, Meten en
 * Wie woont hier staan bij Instellingen. Wat blijft, gebruiken de voorstellen en Wat elk apparaat kan.
 */
'use strict';
/* global antwoorden, binnen, buitenRuimtes, concept, d, esc, klimaatIn, sleutel */
/* exported buitenNu, geenKlimaatToestel, rolKnoppen, rolVan, woningNu */

/** Wat voor huis het is (besluit 190), zoals je het nu bewerkt. */
const woningNu = () => concept()?.woning ?? d.huis?.woning ?? 'vrijstaand';

/** Wat een ruimte buiten is: zoals bewaard, zoals Home Assistant het zegt, of uit de naam. */
function buitenNu(k) {
  const r = buitenRuimtes().find((x) => x.id === k.id);
  return k.buiten ?? r?.buiten ?? huismodel.soortBuiten(k);
}

/* De regeling per kamer (besluit 138): dezelfde drie keuzes als bij Indeling. */
const ROLLEN = ['houdt', 'zon', 'kijken'].map((r) => [r, t(`inr.rol.${r}`), t(`inr.rol.${r}Kort`)]);
/** De knoppen voor wat een apparaat doet; op zon alleen als het kan (besluit 291), of als het er al stond. */
function rolKnoppen(a, nuRol) {
  return ROLLEN.filter(([w]) => w !== 'zon' || nuRol === 'zon' || huismodel.kanOpZon(a, d.huis, antwoorden().verwarming))
    .map(([w, lang, kort]) => `<button type="button" class="${w === 'zon' ? 'zon' : ''}" data-rolwaarde="${w}" aria-pressed="${w === nuRol}" title="${esc(lang)}">${esc(kort)}</button>`)
    .join('');
}
const rolVan = (k, r, key) => (k?.rollen ? (k.rollen[key] ?? 'kijken') : (klimaatIn(r).find((a) => sleutel(a) === key)?.klimaat?.rol ?? 'kijken'));

/** Of er niets is om te verwarmen of te koelen: dan zegt Verwarming dat, en werkt de rest gewoon. */
const geenKlimaatToestel = () => binnen().flatMap(klimaatIn).length === 0 && !(d.huis?.zonderRuimte ?? []).some((x) => x.soort === 'klimaat');
