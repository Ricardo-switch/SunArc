/*
 * Wat voor huis (schets Wand-Huis-Woning, 20 november 2026): de vijf soorten
 * met een klein huisje, en welke muren tegen de buren staan. Eén deel voor Je
 * huis › Vorm en voor Inrichten (keuze Ricardo: Inrichten toont hetzelfde
 * deel). De pagina doet de tik: `data-woning` kiest een soort, `data-buur`
 * zet een kant aan of uit, `data-flat` met `data-stap` zet bij een
 * appartement de verdieping of erboven een hoger of lager; in Je huis gaan ze
 * via `data-ht`.
 */
(function (global) {
  'use strict';
  const T = (k, p) => global.taal.t(k, p);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  /** De soorten, in deze volgorde. */
  const SOORTEN = ['vrijstaand', 'tweekap', 'hoek', 'rij', 'appartement'];
  const KANTEN = ['links', 'rechts', 'achter'];

  /** Een klein huisje van voren: het eigen huis licht, de buren grijs. */
  function mini(soort) {
    const huis = (x, w, eigen) => `<path d="M${x} 34V18l${w / 2} -10l${w / 2} 10v16z" fill="${eigen ? 'rgb(111 211 255 / 0.35)' : 'rgb(255 255 255 / 0.1)'}" stroke="${eigen ? '#6fd3ff' : 'rgb(255 255 255 / 0.35)'}" stroke-width="1.6" stroke-linejoin="round"/>`;
    let s = '';
    if (soort === 'vrijstaand') s = huis(18, 28, true);
    if (soort === 'tweekap') s = huis(12, 20, true) + huis(32, 20, false);
    if (soort === 'hoek') s = huis(4, 18, true) + huis(22, 18, false) + huis(40, 18, false);
    if (soort === 'rij') s = huis(4, 18, false) + huis(22, 18, true) + huis(40, 18, false);
    if (soort === 'appartement') {
      s = '<rect x="14" y="4" width="36" height="30" rx="2" fill="rgb(255 255 255 / 0.1)" stroke="rgb(255 255 255 / 0.35)" stroke-width="1.6"/>';
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) s += `<rect x="${19 + c * 10}" y="${8 + r * 8.5}" width="6" height="5" rx="1" fill="${r === 1 && c === 1 ? '#6fd3ff' : 'rgb(255 255 255 / 0.25)'}"/>`;
    }
    return `<svg viewBox="0 0 64 38" width="64" height="38" aria-hidden="true">${s}<line x1="2" x2="62" y1="35" y2="35" stroke="rgb(110 231 183 / 0.5)" stroke-width="1.5"/></svg>`;
  }

  /**
   * Het deel: de soorten, en bij een huis tegen andere huizen de kanten.
   * `soort` en `buren` zijn wat geldt; `kaart` wat de kaart ziet (het label
   * "van de kaart" staat bij die soort zolang de bewoner nog niets koos);
   * `ht`: in Je huis, dan met `data-ht`.
   */
  function html({ soort, buren, kaart = null, gekozen = true, ht = false, verdieping = null, erboven = null }) {
    const nu = SOORTEN.includes(soort) ? soort : 'vrijstaand';
    const doe = (wat) => (ht ? `data-ht="${wat}" ` : '');
    const tegels = SOORTEN.map((s) => `<button type="button" class="wn-soort${s === nu ? ' aan' : ''}" ${doe('woning')}data-woning="${s}" aria-pressed="${s === nu}">${mini(s)}<b>${esc(T(`wn.soort.${s}`))}</b><small>${esc(T(`wn.zin.${s}`))}</small>${!gekozen && kaart?.soort === s ? `<i>${esc(T('wn.vanKaart'))}</i>` : ''}</button>`).join('');
    const tegen = buren ?? [];
    const kanten = nu === 'vrijstaand'
      ? ''
      : `<h4 class="wn-kop">${esc(T('wn.tegen'))}</h4><div class="wn-kanten">${KANTEN.map((k) => `<button type="button" class="wn-kant${tegen.includes(k) ? ' aan' : ''}" ${doe('buur')}data-buur="${k}" aria-pressed="${tegen.includes(k)}">${esc(T(`wn.kant.${k}`))}</button>`).join('')}</div>
         ${nu === 'appartement' && tegen.length ? '' : `<p class="wn-zin">${esc(tegen.length ? T(tegen.length === 1 ? 'wn.tegenZinEen' : 'wn.tegenZinMeer', { kanten: opsomming(tegen.map((k) => T(`wn.kantKlein.${k}`))) }) : T('wn.tegenGeen'))}</p>`}`;
    // Een appartement (20 november 2026): op welke verdieping, en hoeveel erboven; met niets erboven is het dak van jou.
    let flat = '';
    if (nu === 'appartement') {
      const f = flatVan({ verdieping, erboven });
      const stap = (wat, waarde, tekst) => `<div class="wn-stap"><span>${esc(T(`wn.${wat}`))}</span><button type="button" ${doe('flat')}data-flat="${wat}" data-stap="-1" aria-label="${esc(T('wn.lager'))}"${waarde <= 0 ? ' disabled' : ''}>−</button><b>${esc(tekst)}</b><button type="button" ${doe('flat')}data-flat="${wat}" data-stap="1" aria-label="${esc(T('wn.hoger'))}"${waarde >= 99 ? ' disabled' : ''}>+</button></div>`;
      flat = `<div class="wn-staps">${stap('verdieping', f.verdieping, vloer(f.verdieping))}${stap('erboven', f.erboven, String(f.erboven))}</div>
        <p class="wn-zin">${esc(T(f.erboven ? 'wn.dakGebouw' : 'wn.dakEigen'))}</p>`;
    }
    const voet = nu === 'appartement' && ht ? `<p class="wn-voet">${esc(T('wn.vormZelf'))}</p>` : '';
    return `<div class="wn-deel"><div class="wn-soorten">${tegels}</div>${flat}${kanten}${voet}</div>`;
  }

  /** Een appartement: de verdieping (0 is de begane grond) en de verdiepingen erboven; niets gekozen is 1 en 1. */
  const flatVan = (w) => ({ verdieping: Number.isInteger(w?.verdieping) ? w.verdieping : 1, erboven: Number.isInteger(w?.erboven) ? w.erboven : 1 });
  /** Of het dak van de bewoner is: altijd, behalve bij een appartement met verdiepingen erboven. */
  const eigenDak = (w) => w?.soort !== 'appartement' || flatVan(w).erboven === 0;
  /** Een verdieping kort: Begane grond, 1e, 2e (Engels 1st, 2nd); `lang` met het woord verdieping erbij. */
  const rang = (n) => (global.taal.code === 'en' ? `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}` : `${n}e`);
  const vloer = (n, lang = false) => (n === 0 ? T('wn.bg') : lang ? T('wn.vloerLang', { rang: rang(n) }) : rang(n));
  /** Een stap omhoog of omlaag bij de verdieping of erboven, van 0 tot 99. */
  const stap = (w, wat, d) => ({ ...flatVan(w), [wat]: Math.max(0, Math.min(99, flatVan(w)[wat] + d)) });
  const opsomming = (lijst) => (lijst.length <= 1 ? lijst.join('') : `${lijst.slice(0, -1).join(', ')} ${T('wn.en')} ${lijst.at(-1)}`);

  /** Een kant aan of uit; de soort volgt als hij nog vrijstaand was of niet meer klopt. */
  function wissel(buren, kant) {
    const nu = new Set(buren ?? []);
    if (nu.has(kant)) nu.delete(kant);
    else nu.add(kant);
    return KANTEN.filter((k) => nu.has(k));
  }
  /** De kanten die bij een soort passen als je hem kiest: wat de kaart zag, of anders een gok. */
  function burenBij(soort, kaart, oud) {
    if (soort === 'vrijstaand') return [];
    if (kaart?.buren?.length && kaart.soort === soort) return kaart.buren;
    if (oud?.length && soort !== 'rij') return oud;
    return soort === 'rij' || soort === 'appartement' ? ['links', 'rechts'] : ['rechts'];
  }

  global.woningDeel = { SOORTEN, KANTEN, html, mini, wissel, burenBij, flatVan, eigenDak, vloer, stap };
})(window);
