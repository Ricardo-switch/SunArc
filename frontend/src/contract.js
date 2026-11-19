/*
 * Het soort contract (stap 4, keuze Ricardo 19 november 2026: eerst de soort,
 * dan de rest). Eén rij bij Energie › Contract en prijzen en bij Inrichten ›
 * Prijzen: één tarief, dag en nacht, per uur, of weet ik niet. Daarna vraagt
 * elke pagina alleen de prijzen die bij die soort horen, en bewaart zelf.
 *
 * `van(tarief, dal)` zegt welke soort het nu is; `vorm(keuze, uit)` geeft de
 * knoppen; `klik(el)` geeft de gekozen soort, of undefined als het niet over
 * het contract ging. `tarief(keuze)` is wat de aansluiting bewaart.
 */
'use strict';

const contract = (() => {
  const esc = (s) => window.app.esc(s);
  const t = (k, p) => window.taal.t(k, p);
  const SOORTEN = ['enkel', 'dagnacht', 'dynamisch', 'weetniet'];

  /** De soort uit wat er bewaard is: het tarief van de aansluiting en of er een daltarief is. */
  function van(tarief, dal) {
    if (tarief === 'dynamisch') return 'dynamisch';
    if (tarief === 'weetniet') return 'weetniet';
    if (dal) return 'dagnacht';
    if (tarief === 'vast') return 'enkel';
    return null;
  }

  function vorm(keuze, uit = false) {
    return `<div class="keuzes ct-rij" role="group" aria-label="${esc(t('ct.soort'))}">${SOORTEN.map((s) => `<button type="button" data-ct="${s}" aria-pressed="${keuze === s}"${uit ? ' disabled' : ''}>${esc(t(`ct.${s}`))}</button>`).join('')}</div>`;
  }

  function klik(el) {
    const k = el.closest?.('[data-ct]');
    return k && SOORTEN.includes(k.dataset.ct) ? k.dataset.ct : undefined;
  }

  const tarief = (keuze) => (keuze === 'dynamisch' ? 'dynamisch' : keuze === 'weetniet' ? 'weetniet' : 'vast');

  return { van, vorm, klik, tarief };
})();
window.contract = contract;
