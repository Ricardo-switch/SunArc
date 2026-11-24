/*
 * Het voorbeeldhuis in de app (besluit 237, schets design/app2/Wand-Voorbeeldhuis).
 * Alleen onder `voorbeeld/`: basis.js zet de klok van de pagina op die van het
 * voorbeeld en laadt dit. Hier de balk onderaan: de dag om door te spelen
 * (schuif, afspelen, zomer of winter), Probeer dit, en terug naar je eigen huis.
 * De violette rand om het scherm staat in basis.css (html.sc-voorbeeld).
 */
'use strict';

(function (global) {
  const t = (k, v) => global.t(k, v);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ZON = { zomer: [334, 1312], winter: [522, 1012] };
  /** Het weer (besluit 243): vanzelf met dezelfde tijden als backend/src/voorbeeld/dag.ts, of vast. */
  const WEER = ['vanzelf', 'zon', 'bewolkt', 'regen', 'sneeuw'];
  const weerOp = ({ minuut: m, seizoen, weer }) => {
    if (weer && weer !== 'vanzelf') return weer;
    if (seizoen === 'zomer') return m >= 900 && m < 990 ? 'regen' : m >= 840 && m < 1050 ? 'bewolkt' : 'zon';
    return m < 660 ? 'sneeuw' : m < 750 ? 'bewolkt' : m < 960 ? 'zon' : 'bewolkt';
  };
  /** De iconen van het weer, zoals op Thuis. */
  const WOLK = '<path d="M10 25h15a6 6 0 0 0 .6-12A8 8 0 0 0 10.4 15 5 5 0 0 0 10 25z" fill="#B8C4CF"/>';
  const WEER_ICOON = {
    zon: '<circle cx="18" cy="18" r="7" fill="#F7B548"/><g stroke="#F7B548" stroke-width="2.2" stroke-linecap="round"><path d="M18 4v3M18 29v3M4 18h3M29 18h3M8 8l2 2M26 26l2 2M8 28l2-2M26 10l2-2"/></g>',
    bewolkt: WOLK,
    regen: `${WOLK}<g stroke="#6FD3FF" stroke-width="2" stroke-linecap="round"><path d="M13 28l-1.5 4M19 28l-1.5 4M25 28l-1.5 4"/></g>`,
    sneeuw: `${WOLK}<g fill="#EEF3F7"><circle cx="13" cy="30" r="1.6"/><circle cx="19" cy="32" r="1.6"/><circle cx="25" cy="30" r="1.6"/></g>`,
  };
  const STROOK = { bewolkt: '#7d8d9e', regen: '#6fd3ff', sneeuw: '#eef3f7' };
  const uur = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  /** Waar het voorbeeld de pagina's ziet: alles na `voorbeeld/`. */
  const TERUG = 'sc-voorbeeld-terug';
  /** Wat er te proberen is, en waar je het doet. */
  const PROBEER = [
    { id: 'lamp', naar: 'apparaten.html#licht' },
    { id: 'droger', naar: 'apparaten.html#zon' },
    { id: 'avond', klok: { minuut: 1215, seizoen: 'zomer' } },
    { id: 'vraag', naar: 'assistent.html' },
    { id: 'hand', naar: 'apparaten.html#hand' },
    { id: 'gepland', naar: 'gepland.html' },
  ];

  let stand = { klok: { minuut: 760, seizoen: 'zomer' }, gedaan: [] };
  let speelt = null;
  let stuur = null;

  // Waar je vandaan kwam (?van=inrichten), voor Terug.
  try {
    const van = new URLSearchParams(global.location.search).get('van');
    if (van) global.sessionStorage.setItem(TERUG, van);
  } catch {}

  const balk = document.createElement('div');
  balk.className = 'vb-balk';
  balk.setAttribute('role', 'region');
  balk.setAttribute('aria-label', t('voorbeeld.balk'));
  balk.innerHTML = `
    <button class="vb-speel" type="button" aria-label="${esc(t('voorbeeld.speel'))}" data-vb-speel>▶</button>
    <div class="vb-baan"><span class="vb-uur" data-vb-uur></span><svg viewBox="0 0 640 64" preserveAspectRatio="none" aria-hidden="true" data-vb-baan></svg><input type="range" min="0" max="1435" step="5" aria-label="${esc(t('voorbeeld.tijd'))}" data-vb-schuif></div>
    <div class="keuze vb-seizoen" role="group" aria-label="${esc(t('voorbeeld.seizoen'))}"><button type="button" data-vb-seizoen="zomer">${esc(t('voorbeeld.zomer'))}</button><button type="button" data-vb-seizoen="winter">${esc(t('voorbeeld.winter'))}</button></div>
    <button class="vb-weer" type="button" aria-expanded="false" data-vb-weer><svg viewBox="0 0 36 36" aria-hidden="true" data-vb-weericoon></svg><span data-vb-weernaam></span></button>
    <button class="vb-probeer" type="button" aria-expanded="false" data-vb-probeer>${esc(t('voorbeeld.probeer'))} <b data-vb-teller></b></button>
    <span class="vb-naam"><i aria-hidden="true"></i>${esc(t('voorbeeld.naam'))}</span>
    <button class="vb-terug" type="button" data-vb-terug><span class="vb-lang">${esc(t('voorbeeld.terug'))}</span><span class="vb-kort">${esc(t('w.terug'))}</span></button>
    <section class="vb-lijst" hidden data-vb-lijst>
      <h2>${esc(t('voorbeeld.probeer'))}</h2>
      <ol data-vb-items></ol>
      <p>${esc(t('voorbeeld.weg'))}</p>
    </section>
    <section class="vb-lijst vb-weerkeuze" hidden data-vb-weerkeuze>
      <h2>${esc(t('w.weer'))}</h2>
      <div class="keuze" role="group" aria-label="${esc(t('w.weer'))}">${WEER.map((w) => `<button type="button" data-vb-weerkies="${w}">${esc(t(`voorbeeld.weer.${w}`))}</button>`).join('')}</div>
      <p>${esc(t('voorbeeld.weer.uitleg'))}</p>
    </section>`;
  document.body.appendChild(balk);
  document.documentElement.classList.add('sc-voorbeeld');

  const $ = (s) => balk.querySelector(s);

  function baan() {
    const { minuut, seizoen } = stand.klok;
    const [op, onder] = ZON[seizoen];
    const x = (m) => (m / 1440) * 640;
    const piek = seizoen === 'winter' ? 26 : 50;
    const punten = [];
    for (let m = op; m <= onder; m += 10) punten.push(`${x(m).toFixed(1)},${(58 - Math.sin((Math.PI * (m - op)) / (onder - op)) * piek).toFixed(1)}`);
    const gebeurt = seizoen === 'winter' ? [[390, '#ff7a4d'], [700, '#f7b548']] : [[690, '#f7b548'], [990, '#6ee7b7'], [1230, '#6fd3ff']];
    $('[data-vb-baan]').innerHTML = `
      <rect x="0" y="56" width="${x(op)}" height="4" rx="2" fill="#8f86ff" opacity="0.4"/>
      <rect x="${x(op)}" y="56" width="${x(onder) - x(op)}" height="4" rx="2" fill="#f7b548" opacity="0.55"/>
      <rect x="${x(onder)}" y="56" width="${640 - x(onder)}" height="4" rx="2" fill="#8f86ff" opacity="0.4"/>
      <polyline points="${punten.join(' ')}" fill="none" stroke="#f7b548" stroke-width="2" stroke-dasharray="2 4" opacity="0.7"/>
      ${weerStrook(x)}
      ${gebeurt.map(([m, k]) => `<circle cx="${x(m)}" cy="58" r="4" fill="${k}"/>`).join('')}
      <line x1="${x(minuut)}" y1="10" x2="${x(minuut)}" y2="62" stroke="#eef3f7" stroke-width="2"/>
      <circle cx="${x(minuut)}" cy="58" r="8" fill="#eef3f7" stroke="#8f86ff" stroke-width="3"/>`;
    $('[data-vb-uur]').textContent = uur(minuut);
    $('[data-vb-schuif]').value = String(minuut);
    balk.querySelectorAll('[data-vb-seizoen]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vbSeizoen === seizoen)));
    const keuze = stand.klok.weer ?? 'vanzelf';
    const nu = weerOp(stand.klok);
    $('[data-vb-weericoon]').innerHTML = WEER_ICOON[nu];
    $('[data-vb-weernaam]').textContent = t(`voorbeeld.weer.${keuze}`);
    $('[data-vb-weer]').setAttribute('aria-label', `${t('w.weer')}: ${t(`voorbeeld.weer.${keuze}`)}, ${t(`voorbeeld.weer.${nu}`)}`);
    balk.querySelectorAll('[data-vb-weerkies]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vbWeerkies === keuze)));
  }

  /** Het weer van de dag als dunne strook boven de baan: wolken grijs, regen blauw, sneeuw wit. */
  function weerStrook(x) {
    const stukken = [];
    for (let m = 0; m < 1440; m += 10) {
      const w = weerOp({ ...stand.klok, minuut: m });
      const vorig = stukken[stukken.length - 1];
      if (vorig?.w === w) vorig.tot = m + 10;
      else stukken.push({ w, van: m, tot: m + 10 });
    }
    return stukken.filter((s) => STROOK[s.w]).map((s) => `<rect x="${x(s.van).toFixed(1)}" y="49" width="${(x(s.tot) - x(s.van)).toFixed(1)}" height="3" rx="1.5" fill="${STROOK[s.w]}" opacity="0.75"/>`).join('');
  }

  function lijst() {
    const gedaan = new Set(stand.gedaan);
    $('[data-vb-teller]').textContent = t('voorbeeld.van', { n: gedaan.size, totaal: PROBEER.length });
    $('[data-vb-items]').innerHTML = PROBEER.map((p) => {
      const klaar = gedaan.has(p.id);
      return `<li class="${klaar ? 'klaar' : ''}"><i aria-hidden="true">${klaar ? '✓' : ''}</i><span>${esc(t(`voorbeeld.doe.${p.id}`))}</span>${klaar ? '<em></em>' : `<button type="button" data-vb-doe="${p.id}">${esc(t(p.klok ? 'voorbeeld.doeHet' : p.id === 'vraag' ? 'voorbeeld.vraag' : p.id === 'gepland' ? 'voorbeeld.plan' : 'voorbeeld.doeHet'))}</button>`}</li>`;
    }).join('');
  }

  /** De klok van de pagina: de tijd van het voorbeeld (basis.js leest dit verschil). */
  function zetPaginaKlok(nuMs) {
    if (!Number.isFinite(nuMs)) return;
    global.scVoorbeeldVerschil?.(nuMs);
    global.app?.klok?.();
  }

  async function haal() {
    const r = await fetch('api/voorbeeld', { headers: { accept: 'application/json' } }).catch(() => null);
    if (!r?.ok) return;
    stand = await r.json();
    zetPaginaKlok(stand.nuMs);
    baan();
    lijst();
  }

  async function zetKlok(klok) {
    stand = { ...stand, klok };
    baan();
    clearTimeout(stuur);
    stuur = setTimeout(async () => {
      const r = await fetch('api/voorbeeld', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ klok }) }).catch(() => null);
      if (!r?.ok) return;
      const b = await r.json();
      stand = { ...stand, gedaan: b.gedaan ?? stand.gedaan };
      zetPaginaKlok(b.nuMs);
      lijst();
      meld();
    }, 160);
  }

  /*
   * De pagina's halen alles opnieuw bij `voorbeeldklok`, zodat de lijn van nu en
   * de standen meelopen. Bij afspelen hooguit eens per tel, en de laatste altijd.
   */
  let gemeld = 0;
  let straks = null;
  function meld() {
    clearTimeout(straks);
    const wacht = gemeld + 1000 - Date.now();
    if (wacht > 0) {
      straks = setTimeout(meld, wacht);
      return;
    }
    gemeld = Date.now();
    global.dispatchEvent(new CustomEvent('voorbeeldklok'));
  }

  $('[data-vb-schuif]').addEventListener('input', (e) => zetKlok({ ...stand.klok, minuut: Number(e.target.value) }));
  balk.querySelectorAll('[data-vb-seizoen]').forEach((b) => b.addEventListener('click', () => zetKlok({ ...stand.klok, seizoen: b.dataset.vbSeizoen })));
  $('[data-vb-speel]').addEventListener('click', (e) => {
    if (speelt) {
      clearInterval(speelt);
      speelt = null;
      e.currentTarget.textContent = '▶';
      e.currentTarget.setAttribute('aria-label', t('voorbeeld.speel'));
      return;
    }
    e.currentTarget.textContent = '❚❚';
    e.currentTarget.setAttribute('aria-label', t('voorbeeld.pauze'));
    // Een uur per anderhalve tel: de hele dag in een halve minuut.
    speelt = setInterval(() => zetKlok({ ...stand.klok, minuut: (stand.klok.minuut + 15) % 1440 }), 380);
  });
  /** Eén vak tegelijk open: Probeer dit of het weer. */
  function open(vak, knop) {
    const wordtOpen = $(vak).hidden;
    for (const [v, k] of [['[data-vb-lijst]', '[data-vb-probeer]'], ['[data-vb-weerkeuze]', '[data-vb-weer]']]) {
      $(v).hidden = !(wordtOpen && v === vak);
      $(k).setAttribute('aria-expanded', String(wordtOpen && k === knop));
    }
    // Het weer boven zijn knop, niet rechts in de hoek; op de telefoon over de hele breedte (basis.css).
    if (vak === '[data-vb-weerkeuze]' && wordtOpen && !document.documentElement.classList.contains('tel-stand')) {
      const k = $(knop);
      const breed = $(vak).offsetWidth;
      $(vak).style.right = 'auto';
      $(vak).style.left = `${Math.max(12, Math.min(balk.clientWidth - breed - 12, k.offsetLeft + k.offsetWidth / 2 - breed / 2))}px`;
    }
  }
  $('[data-vb-probeer]').addEventListener('click', () => open('[data-vb-lijst]', '[data-vb-probeer]'));
  $('[data-vb-weer]').addEventListener('click', () => open('[data-vb-weerkeuze]', '[data-vb-weer]'));
  balk.querySelectorAll('[data-vb-weerkies]').forEach((b) => b.addEventListener('click', () => {
    zetKlok({ ...stand.klok, weer: b.dataset.vbWeerkies });
    open('[data-vb-weerkeuze]', '[data-vb-weer]');
  }));
  $('[data-vb-items]').addEventListener('click', (e) => {
    const knop = e.target.closest('[data-vb-doe]');
    if (!knop) return;
    const p = PROBEER.find((x) => x.id === knop.dataset.vbDoe);
    if (p?.klok) {
      zetKlok(p.klok);
      $('[data-vb-lijst]').hidden = true;
    } else if (p?.naar) global.location.href = p.naar;
  });
  $('[data-vb-terug]').addEventListener('click', async () => {
    await fetch('api/voorbeeld', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ terug: true }) }).catch(() => null);
    let van = null;
    try {
      van = global.sessionStorage.getItem(TERUG);
      global.sessionStorage.removeItem(TERUG);
      global.sessionStorage.removeItem('sc-voorbeeld-klok');
    } catch {}
    global.location.href = van === 'inrichten' ? '../inrichten.html' : van === 'welkom' ? '../begin.html' : '../thuis.html';
  });

  baan();
  lijst();
  void haal();
  // Wat er intussen geprobeerd is (een lamp, de droger), af en toe opnieuw.
  setInterval(() => {
    if (!document.hidden && !speelt) void haal();
  }, 15_000);
})(window);
