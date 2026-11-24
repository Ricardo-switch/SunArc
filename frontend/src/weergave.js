/*
 * Het blad Weergave (besluit 164, schets Thuis-Tel-Eigen #weergave), als één
 * gedeeld deel: op Jij opent het als eigen blad, zonder
 * eerst naar Thuis te gaan en te wachten tot Thuis helemaal geladen is; op
 * Thuis (eigen.js) blijft het zoals het was. Eenvoudig of uitgebreid, grotere
 * letters en minder beweging, en hoe het huis eruitziet. Voor jou, op elk
 * scherm.
 *
 * weergaveDeel.html(w, { volgt, telStand, zonderLetters }) geeft het blad met
 * zijn kop; weergaveDeel.nieuw(nu, el) de nieuwe weergave na een tik op een
 * keuze of schakelaar (`[data-wg-eenvoudig]`, `[data-wg-schakel]`).
 */
(function (global) {
  'use strict';
  if (global.weergaveDeel) return;
  const t = (k, p) => global.t(k, p);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  /** Wat aan staat als het nooit gekozen is. */
  const STANDAARD_AAN = ['seizoen', 'weer', 'feestdagen', 'zonnebaan', 'getekend'];

  const CSS = `
  .wg-twee { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
  .wg-twee button { padding: 12px; border-radius: 16px; background: rgb(var(--wit) / 0.05); border: 2px solid transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .wg-twee button[aria-checked='true'] { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
  .wg-twee button:focus-visible { outline: 2px solid var(--tekst); outline-offset: 2px; }
  .wg-twee b { display: block; font-size: 15px; margin-top: 10px; }
  .wg-twee p { font-size: 12.5px; color: var(--gedempt); line-height: 1.35; margin: 2px 0 0; }
  .wg-mini { height: 64px; border-radius: 10px; background: rgb(var(--nacht) / 0.6); padding: 9px; display: flex; flex-direction: column; gap: 6px; }
  .wg-mini i { display: block; height: 6px; border-radius: 3px; background: rgb(var(--wit) / 0.18); }
  .wg-schakel { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 0; border: 0; border-top: 1px solid rgb(var(--wit) / 0.06); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .wg-schakel:focus-visible { outline: 2px solid var(--tekst); outline-offset: 2px; border-radius: 8px; }
  .wg-schakel div { flex: 1; }
  .wg-schakel b { display: block; font-size: 15px; }
  .wg-schakel span { font-size: 12.5px; color: var(--gedempt); }`;
  function opmaak() {
    if (document.getElementById('wg-opmaak')) return;
    const s = document.createElement('style');
    s.id = 'wg-opmaak';
    s.textContent = CSS;
    document.head.append(s);
  }

  /** Het blad, met de kop en Klaar. `volgt`: de naam van wie dit scherm volgt (dan alleen om te zien). */
  function html(w, { volgt = null, telStand = false, zonderLetters = false } = {}) {
    opmaak();
    const aan = (id) => w[id] === true || (w[id] !== false && STANDAARD_AAN.includes(id));
    const keuze = (eenvoudig, naam, zin, tel) => `<button type="button" role="radio" aria-checked="${w.eenvoudig === eenvoudig}" data-wg-eenvoudig="${eenvoudig}"><span class="wg-mini" aria-hidden="true">${tel}</span><b>${naam}</b><p>${zin}</p></button>`;
    const schakel = (id, naam, zin) => `<button type="button" class="wg-schakel" role="switch" aria-checked="${aan(id)}" data-wg-schakel="${id}"><div><b>${naam}</b><span>${zin}</span></div><span class="schakelaar-teken" aria-hidden="true"></span></button>`;
    return `<div class="bladkop"><h2 class="kop-2" id="bladkop">${esc(t('thuis.weergave'))}</h2><button type="button" class="knop knop-licht" data-blad-dicht>${esc(t('algemeen.klaar'))}</button></div>
      <p class="mini geen-marge">${volgt != null ? esc(t('eigen.wg.volgt', { naam: volgt })) : `${esc(t('eigen.wg.voorJou'))}${telStand ? '' : ` ${esc(t('eigen.wg.wand'))}`}`}</p>
      <div class="wg-twee" role="radiogroup" aria-label="${esc(t('eigen.wg.keuze'))}">
        ${keuze(true, esc(t('eigen.wg.eenvoudig')), esc(t('eigen.wg.eenvoudigZin')), '<i style="width: 70%; height: 10px; background: rgb(var(--wit) / 0.45)"></i><i style="width: 92%; height: 8px"></i><i style="width: 60%; height: 8px"></i>')}
        ${keuze(false, esc(t('eigen.wg.uitgebreid')), esc(t('eigen.wg.uitgebreidZin')), '<i style="width: 60%; height: 7px; background: rgb(var(--wit) / 0.45)"></i><i style="width: 90%"></i><i style="width: 80%"></i><i style="width: 45%; background: rgba(247,181,72,0.55)"></i><i style="width: 70%"></i>')}
      </div>
      ${zonderLetters ? '' : `<div class="boven-12">${schakel('groteLetters', esc(t('eigen.wg.letters')), esc(t('eigen.wg.lettersZin')))}${schakel('minderBeweging', esc(t('eigen.wg.beweging')), esc(t('eigen.wg.bewegingZin')))}</div>`}
      <p class="mini geen-marge boven-16 onder-4">${esc(t('eigen.wg.huis'))}</p>
      <div>${schakel('seizoen', esc(t('eigen.wg.seizoen')), esc(t('eigen.wg.seizoenZin')))}${schakel('weer', esc(t('eigen.wg.weer')), esc(t('eigen.wg.weerZin')))}${schakel('feestdagen', esc(t('eigen.wg.feest')), esc(t('eigen.wg.feestZin')))}${schakel('zonnebaan', esc(t('eigen.wg.zon')), esc(t('eigen.wg.zonZin')))}${schakel('getekend', esc(t('eigen.wg.getekend')), esc(t('eigen.wg.getekendZin')))}</div>`;
  }

  /** De nieuwe weergave na een tik op `el`, of null als `el` geen keuze van dit blad is. */
  function nieuw(nu, el) {
    const wg = el?.closest?.('[data-wg-eenvoudig], [data-wg-schakel]');
    if (!wg) return null;
    const id = wg.dataset.wgSchakel;
    const wat = id ? { [id]: wg.getAttribute('aria-checked') !== 'true' } : { eenvoudig: wg.dataset.wgEenvoudig === 'true' };
    // Het huis zoals getekend kiezen geldt voor jou op elk scherm: een keuze die alleen dit scherm onthield (?tekenaar=) vervalt.
    if (id === 'getekend') {
      try {
        localStorage.removeItem('sc-tekenaar');
      } catch {
        // Niets onthouden.
      }
    }
    return { ...nu, ...wat };
  }

  /** De selector van wat er na het opnieuw tekenen de focus terugkrijgt. */
  const focusVan = (el) => {
    const wg = el?.closest?.('[data-wg-eenvoudig], [data-wg-schakel]');
    if (!wg) return null;
    return wg.dataset.wgSchakel ? `[data-wg-schakel="${wg.dataset.wgSchakel}"]` : `[data-wg-eenvoudig="${wg.dataset.wgEenvoudig}"]`;
  };

  global.weergaveDeel = { html, nieuw, focusVan };
})(window);
