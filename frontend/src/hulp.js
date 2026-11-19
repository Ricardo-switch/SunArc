/*
 * Hulp op de plek (besluit 325, schets Wand-Hulp-Plek, 19 november 2026).
 * De stukjes handleiding zijn één bron: hun teksten staan in teksten.nl.js en
 * teksten.en.js (`hulp.<id>.kop`, `.tekst`, `.zoek`), hier staat waar ze horen.
 *
 * - Een klein vraagteken bij wat lastig is (`hulp.vraag(id)`, `data-hulp`)
 *   opent een kort blad: het stukje, Vraag het je huis, Klopt iets niet? en
 *   Meer in de handleiding. Op de wand bij het vraagteken, op de telefoon
 *   onderin.
 * - Waarvoor is dit? (groep.js) krijgt de stukjes van dat deel erbij
 *   (`hulp.naast(ids)`).
 * - De handleiding: alle stukjes per plek, met een zoekveld (`hulp.lijst`).
 * - De woordzoeker (`hulp.zoek(tekst)`) voor Ik snap iets niet bij melden en
 *   voor de assistent als die een vraag niet begrijpt.
 *
 * Op Klimaat, Je huis, Apparaten en Energie staat dit bestand in de pagina;
 * elders laadt basis.js het pas bij de eerste tik.
 */
'use strict';

(function (global) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const t = (k, p) => global.taal.t(k, p);
  const ik = (n) => global.iconen?.svg(n) ?? '';

  /** Waar elk stukje hoort: de plek (de kop in de handleiding) en waar je het instelt. */
  const STUKJES = {
    'klimaat-kamer': { plek: 'klimaat', href: 'comfort.html' },
    'houdt-op-temperatuur': { plek: 'klimaat', href: 'comfort.html' },
    'helpt-op-zon': { plek: 'klimaat', href: 'comfort.html' },
    'doet-niet-mee': { plek: 'klimaat', href: 'comfort.html' },
    'op-zon-mag-het': { plek: 'klimaat', href: 'comfort.html' },
    'koelen-van-het-net': { plek: 'klimaat', href: 'comfort.html' },
    'helpt-de-cv': { plek: 'klimaat', href: 'comfort.html#helpen' },
    'kijkt-mee': { plek: 'klimaat', href: 'comfort.html' },
    'je-huis': { plek: 'jehuis', href: 'jehuis.html' },
    zones: { plek: 'jehuis', href: 'jehuis.html' },
    buiten: { plek: 'jehuis', href: 'jehuis.html#buiten/rond' },
    verbergen: { plek: 'jehuis', href: 'jehuis.html' },
    apparaten: { plek: 'apparaten', href: 'apparaten.html' },
    'apparaat-op-zon': { plek: 'apparaten', href: 'apparaten.html' },
    boiler: { plek: 'apparaten', href: 'apparaten.html' },
    laadpaal: { plek: 'apparaten', href: 'apparaten.html#laden-lijst' },
    'stekker-op-zon': { plek: 'apparaten', href: 'apparaten.html' },
    'met-de-hand': { plek: 'apparaten', href: 'apparaten.html' },
    hoofdzekering: { plek: 'energie', href: 'energie.html#aansluiting' },
    meters: { plek: 'energie', href: 'energie.html#meters' },
    prijzen: { plek: 'energie', href: 'energie.html#prijzen' },
  };
  const PLEKKEN = ['klimaat', 'jehuis', 'apparaten', 'energie'];

  const stukje = (id) => (STUKJES[id] ? { id, ...STUKJES[id], kop: t(`hulp.${id}.kop`), tekst: t(`hulp.${id}.tekst`), waar: t(`hulp.plek.${STUKJES[id].plek}`) } : null);
  /** Of je al op de pagina van het stukje bent: dan geen knop erheen. */
  const hierAl = (href) => (global.location.pathname.split('/').pop() || 'thuis.html') === href.split('#')[0];

  /* ------------------------------------------------- de woordzoeker */

  /** Woorden die niets zeggen over het onderwerp, in beide talen. */
  const STOP = new Set('de het een en of in op aan van voor met bij naar uit om te is zijn was wordt word niet geen wel ook nog al dan als maar die dat dit deze wat wie waar waarom hoe wanneer welke ik je jij mijn mij me we wij ons onze hij zij ze er hier daar zo heel erg toch even kan kun kunnen moet moeten mag wil doe doet gaat gaan staat staan the a an and or in on at of for with to from is are was be it its this that what why how when which who my me i you your we our does do not no can should would there here so very just get'.split(' '));
  const plat = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ');
  const stam = (w) => (w.length > 5 ? w.replace(/(tjes|jes|en|es|s|t)$/, '') : w);
  const woorden = (s) => plat(s).split(/\s+/).filter((w) => w.length >= 2 && !STOP.has(w)).map(stam);
  /** Een woord past ook als het begin of een stuk van een samengesteld woord: "zekering" in "hoofdzekering". */
  const past = (w, x) => w === x || (w.length >= 4 && x.length >= 4 && (x.startsWith(w) || w.startsWith(x) || (w.length >= 5 && x.includes(w))));

  /**
   * De stukjes die bij een vraag passen, de beste eerst. Vergevingsgezind:
   * woorden zonder betekenis tellen niet, en niet elk woord hoeft te passen.
   * Een woord in de kop telt 3, in de zoekwoorden 2, in de tekst 1.
   */
  function zoek(tekst, max = 3) {
    const vraag = [...new Set(woorden(tekst))];
    if (!vraag.length) return [];
    return Object.keys(STUKJES)
      .map((id) => {
        const kop = woorden(t(`hulp.${id}.kop`));
        const extra = woorden(t(`hulp.${id}.zoek`));
        const lijf = woorden(t(`hulp.${id}.tekst`));
        let score = 0;
        for (const w of vraag) score += kop.some((x) => past(w, x)) ? 3 : extra.some((x) => past(w, x)) ? 2 : lijf.some((x) => past(w, x)) ? 1 : 0;
        return { id, score };
      })
      // Een of twee woorden: één goed woord is genoeg; bij een hele zin moet er meer passen.
      .filter((x) => x.score >= (vraag.length <= 2 ? 2 : 3))
      .sort((a, b) => b.score - a.score)
      .slice(0, max)
      .map((x) => stukje(x.id));
  }

  /* ------------------------------------------------- het vraagteken */

  /** Een klein vraagteken naast iets lastigs; een tik opent het stukje. */
  function vraag(id) {
    const s = stukje(id);
    return s ? `<button type="button" class="hulpvraag" data-hulp="${esc(id)}" aria-label="${esc(t('hulp.uitleg', { kop: s.kop }))}">?</button>` : '';
  }

  /** De drie knoppen onder een stukje. */
  function knoppen(s) {
    return `<div class="hulpknoppen"><a class="knop" href="assistent.html#hulp/${encodeURIComponent(s.id)}">${ik('praten')}${esc(t('hulp.vraagHuis'))}</a><button type="button" class="knop" data-meld-probleem data-meld-soort="snap" data-hulp-id="${esc(s.id)}">${ik('melden')}${esc(t('hulp.klopt'))}</button></div>`;
  }

  function sluit() {
    document.querySelectorAll('[data-hulpblad], [data-hulpachter]').forEach((el) => el.remove());
    document.querySelectorAll('.hulpvraag.aan').forEach((el) => el.classList.remove('aan'));
  }

  /** Het korte blad bij een vraagteken: op de wand eronder (of erboven), op de telefoon onderin. */
  /** Het anker van het open blad: een ander stukje opent op dezelfde plek. */
  let laatsteAnker = null;
  function open(id, anker) {
    const s = stukje(id);
    sluit();
    laatsteAnker = anker ?? null;
    if (!s) return;
    const tel = global.app?.telStand?.() ?? global.innerHeight > global.innerWidth;
    const naar = hierAl(s.href) ? '' : `<a class="hulpnaar" href="${esc(s.href)}">${esc(t('hulp.instellen', { waar: s.waar }))} ›</a>`;
    // Ook op deze pagina (19 november 2026): de andere stukjes van dezelfde plek, een tik zet ze in dit blad.
    const ook = Object.keys(STUKJES).filter((x) => x !== id && STUKJES[x].plek === s.plek).slice(0, 5).map(stukje);
    const ookHtml = ook.length ? `<div class="hulpook"><span>${esc(t('hulp.ook'))}</span>${ook.map((o) => `<button type="button" data-hulpander="${esc(o.id)}">${esc(o.kop)}</button>`).join('')}</div>` : '';
    const blad = document.createElement('div');
    blad.className = `hulpblad glas${tel ? ' onder' : ''}`;
    blad.setAttribute('role', 'dialog');
    blad.setAttribute('aria-label', s.kop);
    blad.dataset.hulpblad = '';
    blad.innerHTML = `<button type="button" class="hulpsluit" data-hulpsluit aria-label="${esc(t('algemeen.sluiten'))}">×</button>
      <span class="hulpvan">${ik('lijst')}${esc(t('hulp.uitDe'))}</span>
      <h3>${esc(s.kop)}</h3><p>${esc(s.tekst)}</p>
      ${knoppen(s)}
      ${ookHtml}
      <div class="hulponder">${naar}<button type="button" class="hulpmeer" data-hulplijst="${esc(id)}">${esc(t('hulp.meer'))} ›</button></div>`;
    if (tel) document.body.insertAdjacentHTML('beforeend', '<div class="hulpachter" data-hulpachter></div>');
    document.body.append(blad);
    if (!tel && anker) {
      anker.classList.add('aan');
      const a = anker.getBoundingClientRect();
      const b = blad.getBoundingClientRect();
      const links = Math.max(12, Math.min(global.innerWidth - b.width - 12, a.left + a.width / 2 - b.width / 2));
      const onder = a.bottom + 12 + b.height < global.innerHeight - 8;
      blad.style.left = `${Math.round(links)}px`;
      blad.style.top = `${Math.round(onder ? a.bottom + 12 : Math.max(8, a.top - 12 - b.height))}px`;
      blad.style.setProperty('--pijl', `${Math.round(a.left + a.width / 2 - links)}px`);
      blad.classList.add(onder ? 'pijlboven' : 'pijlonder');
    }
    blad.querySelector('h3')?.setAttribute('tabindex', '-1');
    blad.querySelector('h3')?.focus({ preventScroll: true });
  }

  /* ------------------------------------------------- waarvoor is dit? */

  /** Onder de uitleg van een deel (groep.js): de stukjes erbij, open te tikken, en de twee knoppen. */
  function naast(ids) {
    const lijst = ids.map(stukje).filter(Boolean);
    if (!lijst.length) return '';
    return `<div class="hulpnaast"><h4>${ik('lijst')}${esc(t('hulp.uitDe'))}</h4>
      ${lijst.map((s) => `<details class="hulponderwerp"><summary>${esc(s.kop)}<span class="pijl" aria-hidden="true">›</span></summary><p>${esc(s.tekst)}</p></details>`).join('')}
      <div class="hulpknoppen"><a class="knop" href="assistent.html#typ">${ik('praten')}${esc(t('hulp.vraagHuis'))}</a><button type="button" class="knop" data-meld-probleem data-meld-soort="snap" data-hulp-id="${esc(lijst[0].id)}">${ik('melden')}${esc(t('hulp.snap'))}</button></div></div>`;
  }

  /* ------------------------------------------------- de handleiding */

  /** Alle stukjes per plek, met een zoekveld; `open` staat al open. */
  function lijst(openId = null, plek = null) {
    sluit();
    const tel = global.app?.telStand?.() ?? false;
    document.body.insertAdjacentHTML('beforeend', `<div class="hulpachter" data-hulpachter></div><aside class="hulpblad hulplijst glas${tel ? ' onder' : ''}" role="dialog" aria-labelledby="hulplijstkop" data-hulpblad>
      <button type="button" class="hulpsluit" data-hulpsluit aria-label="${esc(t('algemeen.sluiten'))}">×</button>
      <h3 id="hulplijstkop">${esc(t('hulp.handleiding'))}</h3>
      <input class="invoer" type="search" data-hulpzoek placeholder="${esc(t('hulp.zoek'))}" aria-label="${esc(t('hulp.zoek'))}">
      <div class="hulprijen" data-hulprijen></div>
      ${knoppen({ id: openId ?? 'klimaat-kamer' })}</aside>`);
    tekenLijst('', openId, plek);
    if (!tel) /** @type {HTMLInputElement | null} */ (document.querySelector('[data-hulpzoek]'))?.focus({ preventScroll: true });
  }
  function tekenLijst(q, openId = null, plek = null) {
    const vak = document.querySelector('[data-hulprijen]');
    if (!vak) return;
    const rij = (s, open) => `<details class="hulponderwerp" ${open ? 'open' : ''}><summary>${esc(s.kop)}<span class="pijl" aria-hidden="true">›</span></summary><p>${esc(s.tekst)}</p>${hierAl(s.href) ? '' : `<a class="hulpnaar" href="${esc(s.href)}">${esc(t('hulp.naar', { waar: s.waar }))} ›</a>`}</details>`;
    if (q.trim()) {
      const gevonden = zoek(q, 6);
      vak.innerHTML = gevonden.length ? gevonden.map((s, i) => rij(s, i === 0)).join('') : `<p class="klein">${esc(t('hulp.niets'))}</p>`;
      return;
    }
    const plekken = plek ? [plek, ...PLEKKEN.filter((p) => p !== plek)] : PLEKKEN;
    vak.innerHTML = plekken.map((p) => `<h4>${esc(t(`hulp.plek.${p}`))}</h4>${Object.keys(STUKJES).filter((id) => STUKJES[id].plek === p).map((id) => rij(stukje(id), id === openId)).join('')}`).join('');
    vak.querySelector('details[open]')?.scrollIntoView({ block: 'nearest' });
  }

  let zoekWacht = null;
  document.addEventListener('input', (e) => {
    const veld = /** @type {HTMLInputElement} */ (e.target);
    if (!veld.matches?.('[data-hulpzoek]')) return;
    clearTimeout(zoekWacht);
    zoekWacht = setTimeout(() => tekenLijst(veld.value), 200);
  });
  document.addEventListener('click', (e) => {
    const doel = /** @type {HTMLElement} */ (e.target);
    const v = /** @type {HTMLElement | null} */ (doel.closest?.('[data-hulp]'));
    if (v) {
      e.preventDefault();
      e.stopPropagation();
      if (v.classList.contains('aan')) return sluit();
      return open(v.dataset.hulp, v);
    }
    const ander = /** @type {HTMLElement | null} */ (doel.closest?.('[data-hulpander]'));
    if (ander) return open(ander.dataset.hulpander, laatsteAnker);
    const l = /** @type {HTMLElement | null} */ (doel.closest?.('[data-hulplijst]'));
    if (l) return lijst(l.dataset.hulplijst || null, l.dataset.hulpplek || STUKJES[l.dataset.hulplijst]?.plek || null);
    if (doel.closest?.('[data-hulpsluit], [data-hulpachter]')) return sluit();
    // Melden opent zijn eigen blad: dit blad dicht.
    if (doel.closest?.('[data-hulpblad] [data-meld-probleem]')) return void setTimeout(sluit, 0);
    // Een tik ernaast sluit het korte blad.
    if (!doel.closest?.('[data-hulpblad]') && document.querySelector('[data-hulpblad]:not(.hulplijst)')) sluit();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.querySelector('[data-hulpblad]')) sluit();
  });

  /* ------------------------------------------------- de vormgeving */

  const CSS = `
.hulpvraag { display: inline-grid; place-items: center; width: 24px; height: 24px; padding: 0; margin-left: 6px; border-radius: 50%; border: 1.5px solid rgb(var(--wit) / 0.35); background: none; color: var(--zacht); font-family: inherit; font-size: 12px; font-weight: 800; line-height: 1; letter-spacing: 0; vertical-align: middle; flex: none; cursor: pointer; position: relative; }
.hulpvraag::after { content: ''; position: absolute; inset: -11px; }
h1 .hulpvraag { margin-left: 10px; vertical-align: 6px; }
.metvraag { display: inline-flex; align-items: center; gap: 2px; min-width: 0; }
.metvraag > select { min-width: 0; }
.zorgt .metvraag .rolkeuze.kort { max-width: 150px; }
.hulpvraag.aan, .hulpvraag:hover { border-color: var(--ijs); background: var(--ijs); color: #0b1424; }
.hulpachter { position: fixed; inset: 0; z-index: 63; background: rgba(4, 8, 16, 0.45); }
.hulpblad { position: fixed; z-index: 64; width: 380px; max-width: calc(100vw - 24px); padding: 18px 20px; border-radius: 22px; background: rgb(var(--nacht) / 0.98); border: 1px solid var(--glas-rand); box-shadow: 0 18px 50px rgb(0 0 0 / 0.5); display: flex; flex-direction: column; gap: 10px; box-sizing: border-box; text-align: left; }
.hulpblad.onder { left: 0; right: 0; bottom: 0; top: auto; width: auto; max-width: none; max-height: 82vh; overflow: auto; border-radius: 24px 24px 0 0; padding-bottom: calc(18px + env(safe-area-inset-bottom)); }
.hulpblad.pijlboven::before, .hulpblad.pijlonder::before { content: ''; position: absolute; left: calc(var(--pijl) - 8px); width: 16px; height: 16px; background: rgb(var(--nacht)); border-left: 1px solid var(--glas-rand); border-top: 1px solid var(--glas-rand); transform: rotate(45deg); }
.hulpblad.pijlboven::before { top: -9px; }
.hulpblad.pijlonder::before { bottom: -9px; transform: rotate(225deg); }
.hulpblad h3 { margin: 0; padding-right: 36px; font: 600 22px var(--kop); outline: none; }
.hulpblad p { margin: 0; font-size: 14.5px; line-height: 1.5; color: var(--zacht); }
.hulpvan, .hulpnaast h4 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 12px; font-weight: 700; color: var(--ijs-t); }
.hulpvan svg, .hulpnaast h4 svg { width: 15px; height: 15px; }
.hulpsluit { position: absolute; right: 12px; top: 12px; width: 32px; height: 32px; border-radius: 50%; border: 0; display: grid; place-items: center; background: rgb(var(--wit) / 0.08); color: var(--tekst); font-size: 18px; cursor: pointer; }
.hulpknoppen { display: flex; gap: 8px; margin-top: 2px; }
.hulpknoppen .knop { flex: 1; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; white-space: nowrap; text-decoration: none; }
.hulpknoppen .knop svg { width: 17px; height: 17px; flex: none; }
.hulpook { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding-top: 10px; border-top: 1px solid rgb(var(--wit) / 0.08); }
.hulpook span { width: 100%; font-size: 12px; font-weight: 700; color: var(--gedempt); }
.hulpook button { min-height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--glas-rand); background: rgb(var(--wit) / 0.05); color: var(--tekst); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.hulponder { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.hulpmeer, .hulpnaar { padding: 0; border: 0; background: none; font: inherit; font-size: 13px; font-weight: 600; color: var(--ijs-t); text-decoration: none; cursor: pointer; }
.hulpmeer { margin-left: auto; }
.hulplijst { width: 440px; right: 26px; top: 22px; bottom: 22px; left: auto; }
.hulplijst.onder { top: auto; bottom: 0; left: 0; right: 0; width: auto; height: 82vh; }
.hulplijst h3 { font-size: 26px; }
.hulprijen { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 6px; }
.hulprijen h4 { margin: 8px 0 0; font-size: 12.5px; color: var(--gedempt); }
.hulponderwerp { border-radius: 14px; background: rgb(var(--wit) / 0.05); padding: 0 14px; }
.hulponderwerp[open] { background: rgb(var(--wit) / 0.08); padding-bottom: 12px; }
.hulponderwerp summary { list-style: none; display: flex; align-items: center; gap: 10px; padding: 10px 0; font-size: 14px; font-weight: 600; cursor: pointer; }
.hulponderwerp summary::-webkit-details-marker { display: none; }
.hulponderwerp summary .pijl { margin-left: auto; color: var(--gedempt); transition: transform 0.15s; }
.hulponderwerp[open] summary .pijl { transform: rotate(90deg); }
.hulponderwerp p { margin: 0 0 6px; font-size: 13.5px; line-height: 1.5; color: var(--zacht); }
.hulpnaast { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
.sc-licht .hulpblad { background: rgb(var(--nacht) / 0.99); }
`;
  if (!document.querySelector('style[data-hulpcss]')) document.head.insertAdjacentHTML('beforeend', `<style data-hulpcss>${CSS}</style>`);

  global.hulp = { STUKJES, stukje, zoek, vraag, open, naast, lijst, sluit };
})(window);
