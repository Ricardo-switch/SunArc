/*
 * Je huis › Kamers: deuren en ramen (schets, 20 november 2026, stap 4 punt 3,
 * voor het appartement). Nu kent Je huis een deur, een raam en de voordeur;
 * een deur draait altijd vanaf hetzelfde eind de kamer in. Ricardo: de
 * richting is niet in te stellen, en een achterdeur, een schuifpui of dubbele
 * openslaande deuren zijn er niet.
 *
 * Erbij: de soort (deur, voordeur, achterdeur, openslaande deuren, schuifpui,
 * raam), voor een deur aan welke kant het scharnier zit en of hij naar binnen
 * of naar buiten draait, voor een schuifpui naar welke kant hij schuift. In de
 * tekening zoals op een bouwtekening: een boog per deurblad, een schuifpui
 * als twee glazen delen met een pijl.
 *
 * De begane grond van Ricardo's huis, de straat onderaan; de voordeur zit aan
 * de zijkant bij de garage (zijn antwoord van 19 november).
 *
 *   (zonder)  de etage met de deuren en ramen; in het blad hoe je er een zet
 *   #deur     de voordeur gekozen: soort, scharnier, naar binnen of buiten
 *   #pui      de schuifpui naar de tuin gekozen: naar welke kant hij schuift
 *   #muur     een buitenmuur aangetikt: wat komt hier
 */
(function (global) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const nl = (n) => n.toFixed(1).replace('.', ',');
  const ik = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${global.iconen.binnen(n)}</svg>`;
  const WIJS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2"/><path d="M15 11a1.5 1.5 0 0 1 3 0v3.5c0 3.6-2.2 6-5.6 6-2.4 0-3.7-.9-5-2.9L5 14.3c-.6-1 .6-2.2 1.6-1.4L9 15"/></svg>';
  const stand = (location.hash.slice(1) || 'zonder').split('/')[0];

  // De begane grond in meters: u naar rechts, v naar achteren (de straat bij v = 0).
  const B = 5.6;
  const D = 9.9;
  const KAMERS = [
    { naam: 'Woonkamer', u: 0, v: 0, b: B, d: D, tint: '120 190 255', kop: [B / 2, 1.6] },
    { naam: 'Hal', u: 0, v: 4.6, b: 3.6, d: 1.7, tint: '200 210 220' },
    { naam: 'Trap', u: 0, v: 3.0, b: 1.3, d: 1.6, tint: '200 210 220' },
    { naam: 'Toilet', u: 1.3, v: 3.0, b: 2.3, d: 1.6, tint: '140 200 230' },
  ];
  /*
   * De deuren en ramen. `as` u: de muur ligt op u = op (links of rechts), langs v;
   * `as` v: op v = op (voor of achter), langs u. `scharnier` 0 aan het begin
   * (van), 1 aan het eind (tot); `kant` +1 draait naar hogere u of v, -1 naar
   * lagere. Een schuifpui `schuift` naar het begin (0) of het eind (1).
   */
  const OPENINGEN = [
    { id: 'voordeur', soort: 'voordeur', as: 'u', op: 0, van: 5.0, tot: 6.0, scharnier: 1, kant: 1 },
    { id: 'hal', soort: 'deur', as: 'u', op: 3.6, van: 5.1, tot: 5.9, scharnier: 0, kant: 1 },
    { id: 'toilet', soort: 'deur', as: 'v', op: 4.6, van: 2.4, tot: 3.1, scharnier: 1, kant: -1 },
    { id: 'pui', soort: 'schuifpui', as: 'v', op: D, van: 0.8, tot: 4.0, schuift: 0 },
    { id: 'raam1', soort: 'raam', as: 'v', op: 0, van: 0.5, tot: 2.5 },
    { id: 'raam2', soort: 'raam', as: 'v', op: 0, van: 3.1, tot: 5.1 },
  ];
  const gekozen = stand === 'deur' ? 'voordeur' : stand === 'pui' ? 'pui' : null;
  const KLEUR = { raam: '#a9e6ff', voordeur: '#f7b548', achterdeur: '#f7b548', deur: '#dfe6ec', dubbel: '#dfe6ec', schuifpui: '#a9e6ff' };

  /* ---------------------------------------------------------- de plattegrond */

  function plattegrond(svg, wand) {
    const r = svg.getBoundingClientRect();
    const W = r.width || 600;
    const H = r.height || 500;
    const k = Math.min((W - 120) / B, (H - 90) / D);
    const x0 = (W - B * k) / 2;
    const y0 = (H - D * k) / 2 + 6;
    const X = (u) => x0 + u * k;
    const Y = (v) => y0 + (D - v) * k;
    // Een punt op de muur: langs is de plek langs de muur, uit hoe ver ervan af (naar hogere u of v).
    const P = (o, langs, uit) => (o.as === 'u' ? [X(o.op + uit), Y(langs)] : [X(langs), Y(o.op + uit)]);
    let s = '';
    for (const q of KAMERS) s += `<rect x="${X(q.u)}" y="${Y(q.v + q.d)}" width="${q.b * k}" height="${q.d * k}" fill="rgb(${q.tint} / ${q.naam === 'Woonkamer' ? 0.14 : 0.22})"/>`;
    // De binnenmuren en de buitenmuur.
    const muur = (a, b, c, d2) => `<line x1="${X(a)}" y1="${Y(b)}" x2="${X(c)}" y2="${Y(d2)}" stroke="#c9d3dc" stroke-width="3" stroke-linecap="square"/>`;
    s += muur(0, 3.0, 3.6, 3.0) + muur(0, 4.6, 3.6, 4.6) + muur(0, 6.3, 3.6, 6.3) + muur(3.6, 3.0, 3.6, 6.3) + muur(1.3, 3.0, 1.3, 4.6);
    s += `<rect x="${X(0)}" y="${Y(D)}" width="${B * k}" height="${D * k}" fill="none" stroke="#eef3f7" stroke-width="5"/>`;
    // De muur tegen de buren (0.211.0): gestreept oranje, daar komt niets.
    s += `<line x1="${X(B)}" y1="${Y(0)}" x2="${X(B)}" y2="${Y(D)}" stroke="#ffb07a" stroke-width="6"/><line x1="${X(B)}" y1="${Y(0)}" x2="${X(B)}" y2="${Y(D)}" stroke="#0b1424" stroke-width="6" stroke-dasharray="3 4"/>`;
    // De trap: treden.
    for (let i = 1; i < 6; i++) s += `<line x1="${X(0.1)}" y1="${Y(3.0 + i * 0.27)}" x2="${X(1.2)}" y2="${Y(3.0 + i * 0.27)}" stroke="rgb(255 255 255 / 0.25)" stroke-width="1.2"/>`;
    for (const o of OPENINGEN) {
      const aan = o.id === gekozen;
      const kleur = aan ? '#6fd3ff' : KLEUR[o.soort];
      const breed = o.tot - o.van;
      // Het gat in de muur.
      s += `<line x1="${P(o, o.van, 0)[0]}" y1="${P(o, o.van, 0)[1]}" x2="${P(o, o.tot, 0)[0]}" y2="${P(o, o.tot, 0)[1]}" stroke="#1a2740" stroke-width="${o.op === 0 || o.op === D || o.op === B ? 7 : 5}"/>`;
      if (o.soort === 'raam') {
        for (const e of [-0.06, 0.06]) s += `<line x1="${P(o, o.van, e)[0]}" y1="${P(o, o.van, e)[1]}" x2="${P(o, o.tot, e)[0]}" y2="${P(o, o.tot, e)[1]}" stroke="${kleur}" stroke-width="1.8"/>`;
      } else if (o.soort === 'schuifpui') {
        // Twee glazen delen naast elkaar, een beetje verschoven, en een pijl naar waar hij schuift.
        const mid = (o.van + o.tot) / 2;
        s += `<line x1="${P(o, o.van, -0.07)[0]}" y1="${P(o, o.van, -0.07)[1]}" x2="${P(o, mid + 0.15, -0.07)[0]}" y2="${P(o, mid + 0.15, -0.07)[1]}" stroke="${kleur}" stroke-width="${aan ? 3.2 : 2.4}"/>`;
        s += `<line x1="${P(o, mid - 0.15, 0.07)[0]}" y1="${P(o, mid - 0.15, 0.07)[1]}" x2="${P(o, o.tot, 0.07)[0]}" y2="${P(o, o.tot, 0.07)[1]}" stroke="${kleur}" stroke-width="${aan ? 3.2 : 2.4}"/>`;
        const [ax, ay] = P(o, mid + (o.schuift ? 0.5 : -0.5), -0.45);
        const [bx, by] = P(o, mid + (o.schuift ? -0.5 : 0.5), -0.45);
        s += `<line x1="${bx}" y1="${by}" x2="${ax}" y2="${ay}" stroke="${kleur}" stroke-width="1.6" marker-end="url(#pijl)"/>`;
      } else {
        // Een deurblad per vleugel: het blad open en de boog waar hij draait.
        const vleugels = o.soort === 'dubbel' ? [[o.van, 0], [o.tot, 1]] : [[o.scharnier ? o.tot : o.van, o.scharnier]];
        const w = o.soort === 'dubbel' ? breed / 2 : breed;
        for (const [scharnier, eind] of vleugels) {
          const [hx, hy] = P(o, scharnier, 0);
          const [lx, ly] = P(o, scharnier, o.kant * w);
          const [sx, sy] = P(o, eind ? scharnier - w : scharnier + w, 0);
          // De boog van het dichte punt naar het open blad.
          const veeg = ((o.as === 'u') === (o.kant > 0)) !== !!eind ? 1 : 0;
          s += `<line x1="${hx}" y1="${hy}" x2="${lx}" y2="${ly}" stroke="${kleur}" stroke-width="${aan ? 3 : 2}" stroke-linecap="round"/>`;
          s += `<path d="M${sx} ${sy}A${w * k} ${w * k} 0 0 ${veeg} ${lx} ${ly}" fill="none" stroke="${kleur}" stroke-width="1.3" stroke-dasharray="3 3" opacity="0.85"/>`;
          if (aan) s += `<circle cx="${hx}" cy="${hy}" r="5" fill="#6fd3ff" stroke="#0b1424" stroke-width="2"/>`;
        }
      }
    }
    // De namen.
    for (const q of KAMERS) {
      const [cu, cv] = q.kop ?? [q.u + q.b / 2, q.v + q.d / 2];
      s += `<text x="${X(cu)}" y="${Y(cv) + 4}" text-anchor="middle" font-family="Figtree, sans-serif" font-size="${wand ? 13 : 10.5}" font-weight="700" fill="rgb(255 255 255 / 0.75)">${q.naam}</text>`;
    }
    s += `<text x="${X(B / 2)}" y="${Y(D) - 12}" text-anchor="middle" font-family="Figtree, sans-serif" font-size="11" font-weight="700" fill="rgb(255 255 255 / 0.45)">TUIN</text>`;
    s += `<text x="${X(0) - 10}" y="${Y(5.5) + 4}" text-anchor="end" font-family="Figtree, sans-serif" font-size="11" font-weight="700" fill="rgb(255 255 255 / 0.45)">GARAGE</text>`;
    if (stand === 'muur') s += `<line x1="${X(4.2)}" y1="${Y(D)}" x2="${X(B)}" y2="${Y(D)}" stroke="#6fd3ff" stroke-width="7" stroke-linecap="round"/>`;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = `<defs><marker id="pijl" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#a9e6ff"/></marker></defs>${s}`;
  }

  /* ---------------------------------------------------------- het blad */

  const rij = (o) => `<button type="button" class="ht-rij${o.aan ? ' aan' : ''}"${o.mist ? ' style="border: 1px dashed rgb(111 211 255 / 0.6); background: rgb(111 211 255 / 0.08)"' : ''}>${o.ik ? `<span class="ik">${ik(o.ik)}</span>` : ''}<span class="t"><b>${esc(o.titel)}</b>${o.zin ? `<small>${esc(o.zin)}</small>` : ''}</span>${o.rechts ? `<em>${esc(o.rechts)}</em>` : ''}</button>`;
  const stapper = (titel, waarde) => `<div class="dk-stap"><span>${titel}</span><button type="button" aria-label="Smaller">−</button><b>${waarde}</b><button type="button" aria-label="Breder">+</button></div>`;
  const twee = (titel, a, b, aanA) => `<h4 class="ht-dakkop">${titel}</h4><div class="ht-twee twee"><button type="button" class="ht-klein${aanA ? ' aan' : ''}">${a}</button><button type="button" class="ht-klein${aanA ? '' : ' aan'}">${b}</button></div>`;

  /** Een klein plaatje per soort, van boven, zoals in de tekening. */
  function soortPlaatje(soort) {
    const muur = '<line x1="4" y1="30" x2="12" y2="30" stroke="#eef3f7" stroke-width="3"/><line x1="44" y1="30" x2="52" y2="30" stroke="#eef3f7" stroke-width="3"/>';
    const c = KLEUR[soort];
    let s = '';
    if (soort === 'raam') s = `<line x1="12" y1="28.5" x2="44" y2="28.5" stroke="${c}" stroke-width="1.8"/><line x1="12" y1="31.5" x2="44" y2="31.5" stroke="${c}" stroke-width="1.8"/>`;
    else if (soort === 'schuifpui') s = `<line x1="12" y1="28" x2="30" y2="28" stroke="${c}" stroke-width="2.4"/><line x1="26" y1="32" x2="44" y2="32" stroke="${c}" stroke-width="2.4"/><path d="M34 22h-12m3-3-3 3 3 3" stroke="${c}" stroke-width="1.5" fill="none"/>`;
    else if (soort === 'dubbel') s = `<line x1="12" y1="30" x2="12" y2="14" stroke="${c}" stroke-width="2"/><path d="M28 30A16 16 0 0 0 12 14" stroke="${c}" stroke-dasharray="2 2" fill="none"/><line x1="44" y1="30" x2="44" y2="14" stroke="${c}" stroke-width="2"/><path d="M28 30A16 16 0 0 1 44 14" stroke="${c}" stroke-dasharray="2 2" fill="none"/>`;
    else s = `<line x1="12" y1="30" x2="12" y2="0" stroke="${c}" stroke-width="2"/><path d="M44 30A32 32 0 0 0 12 -2" stroke="${c}" stroke-dasharray="2 2" fill="none"/>`;
    return `<svg viewBox="0 0 56 36" width="56" height="36" aria-hidden="true"><g transform="translate(0 2)">${muur}${s}</g></svg>`;
  }
  const SOORTEN = [
    ['deur', 'Deur', 'binnen'],
    ['voordeur', 'Voordeur', 'van de straat'],
    ['achterdeur', 'Achterdeur', 'naar buiten'],
    ['dubbel', 'Openslaande deuren', 'twee delen'],
    ['schuifpui', 'Schuifpui', 'glas, schuift'],
    ['raam', 'Raam', ''],
  ];
  const soorten = (nu, buiten) => `<div class="dr-soorten">${SOORTEN.filter(([s]) => buiten || ['deur', 'dubbel', 'schuifpui'].includes(s)).map(([s, naam, zin]) => `<button type="button" class="dr-soort${s === nu ? ' aan' : ''}" aria-pressed="${s === nu}">${soortPlaatje(s)}<b>${naam}</b>${zin ? `<small>${zin}</small>` : ''}</button>`).join('')}</div>`;

  function blad() {
    if (stand === 'deur') {
      return `<header><h3>Voordeur</h3><span>1,0 m</span></header>
        ${soorten('voordeur', true)}
        ${twee('Scharnier', 'Links', 'Rechts', false)}
        ${twee('Draait', 'Naar binnen', 'Naar buiten', true)}
        ${stapper('Breed', '1,0 m')}
        <p class="ht-zin">Van binnen gezien: het scharnier rechts, en hij draait de hal in. Tik op de stip om het scharnier te wisselen.</p>
        ${rij({ ik: 'kruis', titel: 'Weghalen', zin: '' })}`;
    }
    if (stand === 'pui') {
      return `<header><h3>Schuifpui</h3><span>3,2 m</span></header>
        ${soorten('schuifpui', true)}
        ${twee('Schuift naar', 'Links', 'Rechts', true)}
        ${stapper('Breed', '3,2 m')}
        <p class="ht-zin">Naar de tuin. Een schuifpui draait niet: hij heeft geen boog in de tekening.</p>
        ${rij({ ik: 'kruis', titel: 'Weghalen', zin: '' })}`;
    }
    if (stand === 'muur') {
      return `<header><h3>Buitenmuur</h3><span>1,4 m vrij</span></header>
        <p class="ht-zin">Aan de tuin. Wat komt hier?</p>
        ${soorten(null, true)}
        <p class="ht-voet">Hij komt in het midden van de muur, zo breed als gebruikelijk. Daarna schuif je hem en kies je de richting.</p>`;
    }
    return `<header><h3>Begane grond</h3><span>3 deuren · 2 ramen</span></header>
      ${rij({ ik: 'deur', titel: 'Deuren en ramen', zin: 'Tik op een muur om er een te zetten, of op een deur om hem te wijzigen', mist: true })}
      ${rij({ ik: 'woonkamer', titel: 'Woonkamer', zin: '', rechts: '44 m²' })}
      ${rij({ ik: 'hal', titel: 'Hal', zin: '', rechts: '5 m²' })}
      ${rij({ ik: 'trap', titel: 'Trap', zin: '', rechts: '3 m²' })}
      ${rij({ ik: 'toilet', titel: 'Toilet', zin: '', rechts: '3 m²' })}`;
  }

  const UITLEG = {
    zonder: 'Tik op een muur om er een deur of raam in te zetten. Tik op een deur om hem te wijzigen.',
    deur: 'Tik op de stip om het scharnier naar de andere kant te zetten. Sleep de deur langs de muur.',
    pui: 'Sleep de schuifpui langs de muur. Pak een eind om hem breder of smaller te maken.',
    kies: 'Kies in het blad wat er in deze muur komt.',
    muur: 'Kies in het blad wat er in deze muur komt.',
  };

  function start(tel) {
    const svg = $('tekening');
    const teken = () => plattegrond(svg, !tel);
    teken();
    addEventListener('resize', teken);
    $('blad').innerHTML = blad();
    $('uitleg').innerHTML = `${WIJS}<span>${esc(UITLEG[stand] ?? UITLEG.zonder)}</span>`;
    document.querySelectorAll('[data-stand]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.stand === 'kamers')));
  }

  global.deurenSchets = { start, nl };
})(window);
