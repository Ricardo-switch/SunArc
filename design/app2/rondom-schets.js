/*
 * Je huis: buiten en dak (schets, 20 november 2026, stap 4 punt 3, ronde 3).
 * Vier dingen die nog niet in Je huis staan:
 *
 *   (zonder)      Huis in 3D met buiten erbij: de voortuin, de oprit, de
 *                 achtertuin met het terras en de border als plekken op de
 *                 grond, met hun naam en hun lampen (wens Ricardo 19-11:
 *                 "voortuin en achtertuin als plek in het 3D-huis, ook voor
 *                 verlichting").
 *   #overkapping  Vorm: een overkapping tegen de achtergevel, boven het
 *                 terras. De kaarten zien hem meestal niet: je tekent hem zelf.
 *   #dakraam      Dak: twee dakramen op de voorkant van het dak, naast de
 *                 dakkapel achter. Ook die ziet de 3D-kaart niet.
 *   #kadaster     Buiten: de erfgrens van het kadaster (open data, CC BY 4.0,
 *                 een aanwijzing en geen meting) in plaats van de grens die
 *                 SunArc uit de gebouwen schatte, met Klopt dit?.
 *
 * Ricardo's huis zoals in de schetsen van ronde 1 en 2: het hoofdhuis 5,6 m
 * breed en 9,9 m diep, de garage links, het tuinhuis 7 x 3 m achterin, de
 * straat onder. De maten van de tuin zijn een voorbeeld.
 *
 * Besluit Ricardo, 20 november 2026: niet bouwen zoals hier. Het kadaster
 * valt af, de veranda en de dakramen gaan naar later, en de tuin in 3D komt
 * in de ene tekenaar voor Thuis en Je huis samen. Deze schets blijft als idee.
 */
(function (global) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ik = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${global.iconen.binnen(n)}</svg>`;
  const WIJS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2"/><path d="M15 11a1.5 1.5 0 0 1 3 0v3.5c0 3.6-2.2 6-5.6 6-2.4 0-3.7-.9-5-2.9L5 14.3c-.6-1 .6-2.2 1.6-1.4L9 15"/></svg>';
  const stand = (location.hash.slice(1) || 'tuin').split('/')[0];
  const MINT = '#6ee7b7';
  const IJS = '#6fd3ff';
  const ZON = '#f7b548';
  const F = 'font-family="Figtree, sans-serif"';

  // u naar rechts, v naar achteren; de voorkant van het hoofdhuis is v = 0.
  const HUIS = { u: 0, v: 0, b: 5.6, d: 9.9, goot: 4.9, nok: 9.1, nokV: 4.5 };
  const GARAGE = { u: -2.9, v: 1.4, b: 2.9, d: 7.0, h: 2.7 };
  const TUINHUIS = { u: -1.2, v: 15.2, b: 7.0, d: 3.0, h: 2.4 };
  const PLEKKEN = [
    { id: 'voortuin', naam: 'Voortuin', u: 0, v: -6, b: 5.6, d: 6, kleur: 'rgb(74 160 104 / 0.55)', lampen: 2 },
    { id: 'oprit', naam: 'Oprit', u: -2.9, v: -6, b: 2.9, d: 7.4, kleur: 'rgb(150 160 172 / 0.45)', lampen: 1, extra: 'camera' },
    { id: 'achtertuin', naam: 'Achtertuin', u: -2.9, v: 8.4, b: 8.5, d: 10.6, kleur: 'rgb(74 160 104 / 0.5)', lampen: 2 },
    { id: 'terras', naam: 'Terras', u: 0, v: 9.9, b: 5.6, d: 3.5, kleur: 'rgb(196 170 128 / 0.55)', lampen: 1, deel: true },
    { id: 'border', naam: 'Border', u: -2.9, v: 18.2, b: 8.5, d: 0.8, kleur: 'rgb(122 176 92 / 0.75)', lampen: 0, deel: true },
  ];
  // Waar de lampen buiten staan: in de voortuin langs het pad, op de oprit bij de garage, op het terras aan de gevel, in de achtertuin.
  const LAMPEN = [[1.2, -4.6], [4.4, -2.2], [-1.4, 0.6], [2.8, 10.2], [-1.8, 13.6], [4.8, 16.6]];

  /* ---------------------------------------------------------- het huis in 3D, met buiten */

  function drieD(svg, wand) {
    const r = svg.getBoundingClientRect();
    const W = r.width || 600;
    const H = r.height || 500;
    // Schuin van rechtsvoor en van boven, zoals Huis in 3D (huistekenen-3d.js): 25 graden gedraaid, 33 graden van boven.
    const [co, si] = [Math.cos(0.44), Math.sin(0.44)];
    const [cp, sp] = [Math.cos(0.58), Math.sin(0.58)];
    const [cu, cv] = [1.2, 6.6];
    const ruw = (u, v, z) => [(u - cu) * co + (v - cv) * si, -((-(u - cu) * si + (v - cv) * co) * sp + z * cp)];
    const hoeken = [[-3.6, -6.2, 0], [5.6, -6.2, 0], [5.6, 19.4, 0], [-3.6, 19.4, 0], [11.2, 0, 0], [2.8, 4.5, 9.1]].map((q) => ruw(...q));
    const [xmin, xmax, ymin, ymax] = [Math.min(...hoeken.map((q) => q[0])), Math.max(...hoeken.map((q) => q[0])), Math.min(...hoeken.map((q) => q[1])), Math.max(...hoeken.map((q) => q[1]))];
    const k = Math.min((W - 40) / (xmax - xmin), (H - 50) / (ymax - ymin));
    const P = (u, v, z = 0) => {
      const [x, y] = ruw(u, v, z);
      return [W / 2 + (x - (xmin + xmax) / 2) * k, H / 2 + 6 + (y - (ymin + ymax) / 2) * k];
    };
    const pad = (pp) => `M${pp.map((p) => P(...p).map((n) => n.toFixed(1)).join(' ')).join('L')}Z`;
    const vak = (q, z = 0) => pad([[q.u, q.v, z], [q.u + q.b, q.v, z], [q.u + q.b, q.v + q.d, z], [q.u, q.v + q.d, z]]);
    let s = '';
    // Het erf: de grond tot de erfgrens.
    s += `<path d="${pad([[-3.1, -6.2, 0], [5.6, -6.2, 0], [5.6, 19.4, 0], [-3.6, 19.1, 0]])}" fill="rgb(42 94 62 / 0.35)" stroke="rgb(110 231 183 / 0.35)" stroke-dasharray="5 5"/>`;
    // De buren: alleen de grond en een schim.
    s += `<path d="${vak({ u: 5.6, v: 0, b: 5.6, d: 9.9 })}" fill="rgb(255 255 255 / 0.04)" stroke="rgb(255 255 255 / 0.12)"/>`;
    // De plekken buiten: de tuinen eerst, dan de delen erin.
    for (const p of PLEKKEN) s += `<path d="${vak(p, 0.02)}" fill="${p.kleur}" stroke="rgb(255 255 255 / ${p.deel ? 0.35 : 0.22})" stroke-width="1.2"${p.id === 'terras' ? ' stroke-dasharray="4 3"' : ''}/>`;
    // Een doos: de muren naar de kijker (voor en rechts) en het dak.
    const doos = (q, h, vul, dak) => {
      let x = '';
      x += `<path d="${pad([[q.u + q.b, q.v, 0], [q.u + q.b, q.v + q.d, 0], [q.u + q.b, q.v + q.d, h], [q.u + q.b, q.v, h]])}" fill="${vul[1]}" stroke="rgb(13 26 48 / 0.5)" stroke-width="0.8"/>`;
      x += `<path d="${pad([[q.u, q.v, 0], [q.u + q.b, q.v, 0], [q.u + q.b, q.v, h], [q.u, q.v, h]])}" fill="${vul[0]}" stroke="rgb(13 26 48 / 0.5)" stroke-width="0.8"/>`;
      x += dak ?? `<path d="${vak(q, h)}" fill="${vul[2]}" stroke="rgb(13 26 48 / 0.5)" stroke-width="0.8"/>`;
      return x;
    };
    // De lampen achter en naast het huis eerst: het huis staat ervoor.
    for (const [u, v] of LAMPEN.filter((q) => q[1] >= 0)) {
      const [x0, y0] = P(u, v, 0);
      const [x1, y1] = P(u, v, 0.7);
      s += `<circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="${(k * 0.9).toFixed(1)}" fill="url(#lampgloed)"/><line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="#2a3446" stroke-width="2"/><circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="3.4" fill="#ffd38a" stroke="#0b1424" stroke-width="1"/>`;
    }
    // Van achter naar voren: het tuinhuis, het huis, de garage.
    s += doos(TUINHUIS, TUINHUIS.h, ['#9aa8b6', '#7e8c9b', '#5d6a7a']);
    const h = HUIS;
    const dakHuis = `<path d="${pad([[h.u, h.v, h.goot], [h.u + h.b, h.v, h.goot], [h.u + h.b, h.nokV, h.nok], [h.u, h.nokV, h.nok]])}" fill="#4d5d78" stroke="rgb(13 26 48 / 0.5)" stroke-width="0.8"/><path d="${pad([[h.u + h.b, h.v, h.goot], [h.u + h.b, h.nokV, h.nok], [h.u + h.b, h.v + h.d, 3.9]])}" fill="#b9c4cf" stroke="rgb(13 26 48 / 0.5)" stroke-width="0.8"/>`;
    s += `<path d="${pad([[h.u + h.b, h.v, 0], [h.u + h.b, h.v + h.d, 0], [h.u + h.b, h.v + h.d, 3.9], [h.u + h.b, h.v, h.goot]])}" fill="#cbd4dd" stroke="rgb(13 26 48 / 0.5)" stroke-width="0.8"/>`;
    s += `<path d="${pad([[h.u, h.v, 0], [h.u + h.b, h.v, 0], [h.u + h.b, h.v, h.goot], [h.u, h.v, h.goot]])}" fill="#e4eaf0" stroke="rgb(13 26 48 / 0.5)" stroke-width="0.8"/>`;
    s += dakHuis;
    // Ramen op de voorgevel, en het licht dat binnen brandt.
    for (const [u0, z0] of [[0.6, 0.9], [3.2, 0.9], [0.6, 3.4], [3.2, 3.4]]) s += `<path d="${pad([[u0, 0, z0], [u0 + 1.8, 0, z0], [u0 + 1.8, 0, z0 + 1.2], [u0, 0, z0 + 1.2]])}" fill="rgb(143 208 255 / 0.5)" stroke="#dcefff" stroke-opacity="0.7" stroke-width="0.8"/>`;
    s += doos(GARAGE, GARAGE.h, ['#b8c3ce', '#9aa8b6', '#6f7d8e']);
    // De lampen buiten: een paaltje met een gloed; die voor het huis na het huis.
    for (const [u, v] of LAMPEN.filter((q) => q[1] < 0)) {
      const [x0, y0] = P(u, v, 0);
      const [x1, y1] = P(u, v, 0.7);
      s += `<circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="${(k * 0.9).toFixed(1)}" fill="url(#lampgloed)"/><line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="#2a3446" stroke-width="2"/><circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="3.4" fill="#ffd38a" stroke="#0b1424" stroke-width="1"/>`;
    }
    // De namen van de plekken, met hoeveel lampen.
    for (const p of PLEKKEN) {
      if (p.id === 'border' && !wand) continue;
      const [x, y] = P(p.u + p.b / 2, p.v + p.d / 2, 0.05);
      const tekst = p.lampen ? `${p.naam} · ${p.lampen} ${p.lampen === 1 ? 'lamp' : 'lampen'}` : p.naam;
      const bw = tekst.length * (wand ? 6.4 : 5.6) + 16;
      const aan = p.id === 'terras';
      s += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect x="${-bw / 2}" y="-11" width="${bw}" height="22" rx="8" fill="#0b1424" stroke="${aan ? IJS : 'rgb(110 231 183 / 0.6)'}" stroke-width="${aan ? 2 : 1.2}"/><text y="4" text-anchor="middle" ${F} font-size="${wand ? 11.5 : 10}" font-weight="700" fill="${aan ? '#a9e6ff' : '#b6f0d6'}">${esc(tekst)}</text></g>`;
    }
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = `<defs><radialGradient id="lampgloed"><stop offset="0" stop-color="#ffd38a" stop-opacity="0.55"/><stop offset="1" stop-color="#ffd38a" stop-opacity="0"/></radialGradient></defs>${s}`;
  }

  /* ---------------------------------------------------------- van boven: Vorm, Dak en Buiten */

  function bovenaf(svg, wand) {
    const r = svg.getBoundingClientRect();
    const W = r.width || 600;
    const H = r.height || 500;
    const buiten = stand === 'kadaster';
    const vraag = buiten && wand ? 80 : 0;
    const [u0, u1, v0, v1] = buiten ? [-6, 9, -8, 21.5] : stand === 'dakraam' ? [-1.5, 7.1, -1.2, 11.2] : [-5, 10.5, -3, 15.5];
    const k = Math.min((W - 30) / (u1 - u0), (H - 40 - vraag) / (v1 - v0));
    const x0 = (W - (u1 - u0) * k) / 2 - u0 * k;
    const y0 = vraag + (H - vraag - (v1 - v0) * k) / 2 + v1 * k;
    const X = (u) => x0 + u * k;
    const Y = (v) => y0 - v * k;
    const rect = (q, a) => `<rect x="${X(q.u)}" y="${Y(q.v + q.d)}" width="${q.b * k}" height="${q.d * k}" ${a}/>`;
    const poly = (pp, a) => `<polygon points="${pp.map(([u, v]) => `${X(u).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}" ${a}/>`;
    const tekst = (x, y, t, kleur = 'rgb(255 255 255 / 0.75)', grootte = wand ? 12.5 : 10.5, gewicht = 700) => `<text x="${x}" y="${y}" text-anchor="middle" ${F} font-size="${grootte}" font-weight="${gewicht}" fill="${kleur}">${esc(t)}</text>`;
    const pil = (x, y, t, kleur = MINT) => {
      const bw = t.length * (wand ? 6.6 : 5.8) + 18;
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect x="${-bw / 2}" y="-12" width="${bw}" height="24" rx="9" fill="#0b1424" stroke="${kleur}" stroke-width="1.4"/><text y="4.5" text-anchor="middle" ${F} font-size="${wand ? 11.5 : 10}" font-weight="700" fill="${kleur === IJS ? '#a9e6ff' : '#b6f0d6'}">${esc(t)}</text></g>`;
    };
    let s = '';
    const h = HUIS;
    if (stand === 'kadaster') {
      // Buiten: de grens die SunArc schatte (grijs), en die van het kadaster (mint).
      s += rect({ u: -4.6, v: -5.2, b: 10.2, d: 25.6 }, 'fill="none" stroke="rgb(255 255 255 / 0.3)" stroke-width="1.5" stroke-dasharray="3 5"');
      s += poly([[-3.1, -6.2], [5.6, -6.2], [5.6, 19.4], [-3.6, 19.1]], `fill="rgb(110 231 183 / 0.08)" stroke="${MINT}" stroke-width="2.5" stroke-dasharray="9 5"`);
      for (const p of PLEKKEN) s += rect(p, `fill="${p.kleur.replace(/0\.\d+\)/, '0.32)')}" stroke="rgb(255 255 255 / 0.25)" stroke-width="1"`);
      s += rect(h, 'fill="rgb(120 190 255 / 0.2)" stroke="#eef3f7" stroke-width="3"');
      s += rect(GARAGE, 'fill="rgb(160 170 180 / 0.25)" stroke="#c9d3dc" stroke-width="2.5"');
      s += rect(TUINHUIS, 'fill="rgb(160 170 180 / 0.25)" stroke="#c9d3dc" stroke-width="2.5"');
      for (const p of PLEKKEN.filter((x) => !x.deel)) s += tekst(X(p.u + p.b / 2), Y(p.v + p.d / 2) + (p.id === 'achtertuin' ? k * 3.4 : 4), p.naam, 'rgb(255 255 255 / 0.7)');
      s += tekst(X(2.8), Y(5) + 4, 'Huis');
      // De maat van de nieuwe grens, en de oude als stippel.
      s += pil(X(1.1), Y(-6.2) + 18, 'Kadaster: 8,7 × 25,6 m');
      s += tekst(X(-4.6) - 4, Y(20.8), 'geschat', 'rgb(255 255 255 / 0.45)', wand ? 11 : 9.5, 600);
    } else {
      // Vorm en Dak: het huis van boven, de garage en de buren.
      s += rect({ u: 5.6, v: 0, b: 4.6, d: 9.9 }, 'fill="rgb(255 255 255 / 0.035)" stroke="rgb(255 255 255 / 0.18)" stroke-width="1.5" stroke-dasharray="4 5"');
      s += rect(h, 'fill="rgb(120 190 255 / 0.16)"');
      if (stand !== 'dakraam') s += rect(GARAGE, 'fill="rgb(160 170 180 / 0.2)" stroke="#c9d3dc" stroke-width="4"');
      s += rect(h, 'fill="none" stroke="#eef3f7" stroke-width="6"');
      if (stand === 'overkapping') {
        // Het terras achter het huis, en de overkapping erboven: een dak op twee palen, tegen de achtergevel.
        const ok = { u: 0, v: 9.9, b: 5.6, d: 3.5 };
        s += rect(ok, 'fill="rgb(196 170 128 / 0.18)"');
        s += `<defs><pattern id="glas" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="rgb(143 208 255 / 0.14)"/><line x1="0" y1="0" x2="0" y2="10" stroke="rgb(143 208 255 / 0.45)" stroke-width="1.4"/></pattern></defs>`;
        s += rect(ok, `fill="url(#glas)" stroke="${IJS}" stroke-width="3"`);
        for (const [u, v] of [[0.15, 13.25], [5.45, 13.25]]) s += `<rect x="${X(u) - 6}" y="${Y(v) - 6}" width="12" height="12" rx="2" fill="#0b1424" stroke="${IJS}" stroke-width="2.5"/>`;
        for (const [u, v] of [[0, 9.9], [5.6, 9.9], [0, 13.4], [5.6, 13.4]]) s += `<circle cx="${X(u)}" cy="${Y(v)}" r="${wand ? 8 : 7}" fill="#0b1424" stroke="${IJS}" stroke-width="2.5"/>`;
        s += tekst(X(2.8), Y(11.65) + 4, 'Veranda', '#a9e6ff');
        s += tekst(X(2.8), Y(11.65) + 18, '5,6 × 3,5 m · glas', 'rgb(169 230 255 / 0.75)', wand ? 10.5 : 9, 600);
        s += tekst(X(2.8), Y(5) + 4, 'Huis');
        s += tekst(X(GARAGE.u + GARAGE.b / 2), Y(5) + 4, 'Garage', 'rgb(255 255 255 / 0.6)');
      } else {
        // Dak: de nok, de dakkapel achter, en twee dakramen op de voorkant van het dak.
        s += `<line x1="${X(0)}" y1="${Y(h.nokV)}" x2="${X(5.6)}" y2="${Y(h.nokV)}" stroke="rgb(255 255 255 / 0.45)" stroke-width="1.5" stroke-dasharray="3 5"/>`;
        s += tekst(X(5.6) + (wand ? 18 : 14), Y(h.nokV) + 4, 'nok', 'rgb(255 255 255 / 0.5)', wand ? 11.5 : 10, 700);
        s += rect({ u: 1.5, v: 6.6, b: 2.3, d: 2.0 }, 'fill="rgb(255 255 255 / 0.08)" stroke="#c9d3dc" stroke-width="2"');
        s += tekst(X(2.65), Y(7.6) + 4, 'Dakkapel', 'rgb(255 255 255 / 0.6)', wand ? 11 : 9.5, 600);
        const raam = (u, v, aan) => rect({ u, v, b: 0.78, d: 1.18 }, `rx="2" fill="rgb(143 208 255 / ${aan ? 0.42 : 0.28})" stroke="${aan ? IJS : '#a9e6ff'}" stroke-width="${aan ? 3 : 1.8}"`);
        s += raam(1.0, 1.6, true) + raam(3.8, 1.6, false);
        for (const [u, v] of [[1.0, 1.6], [1.78, 1.6], [1.0, 2.78], [1.78, 2.78]]) s += `<circle cx="${X(u)}" cy="${Y(v)}" r="${wand ? 7 : 6}" fill="#0b1424" stroke="${IJS}" stroke-width="2.5"/>`;
        s += pil(X(1.39), Y(2.78) - 22, 'Dakraam 78 × 118', IJS);
        s += tekst(X(4.19), Y(1.6) + 16, 'Dakraam', 'rgb(169 230 255 / 0.8)', wand ? 11 : 9.5, 600);
        s += tekst(X(2.8), Y(0.6) + 4, 'voorkant van het dak', 'rgb(255 255 255 / 0.45)', wand ? 11 : 9.5, 600);
      }
    }
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = s;
  }

  /* ---------------------------------------------------------- het blad */

  const rij = (o) => `<button type="button" class="ht-rij${o.aan ? ' aan' : ''}${o.mist ? ' mist' : ''}"${o.uit ? ' disabled' : ''}>${o.ik ? `<span class="ik">${ik(o.ik)}</span>` : ''}<span class="t"><b>${esc(o.titel)}</b>${o.zin ? `<small>${esc(o.zin)}</small>` : ''}</span>${o.rechts ? `<em>${esc(o.rechts)}</em>` : ''}</button>`;
  const stapper = (titel, waarde) => `<div class="kv-stap"><span>${esc(titel)}</span><button type="button" aria-label="Kleiner">−</button><b>${esc(waarde)}</b><button type="button" aria-label="Groter">+</button></div>`;
  const tegels = (lijst, nu) => `<div class="rd-tegels">${lijst.map(([id, naam, zin, plaatje]) => `<button type="button" class="rd-tegel${id === nu ? ' aan' : ''}" aria-pressed="${id === nu}">${plaatje}<b>${esc(naam)}</b><small>${esc(zin)}</small></button>`).join('')}</div>`;
  const knoppen = (lijst, nu) => `<div class="ht-twee kv-vier">${lijst.map((x) => `<button type="button" class="ht-klein${x === nu ? ' aan' : ''}">${x}</button>`).join('')}</div>`;
  // Kleine plaatjes van de zijkant: een dak op palen tegen een muur.
  const dakje = (soort) => {
    const dak = soort === 'pergola' ? [0, 1, 2, 3, 4].map((i) => `<line x1="${16 + i * 8}" y1="11" x2="${16 + i * 8}" y2="15" stroke="#c9d3dc" stroke-width="2"/>`).join('') + '<line x1="12" y1="13" x2="52" y2="13" stroke="#c9d3dc" stroke-width="1.6"/>' : `<path d="M10 10L54 16" stroke="${soort === 'veranda' ? IJS : '#c9d3dc'}" stroke-width="${soort === 'veranda' ? 3 : 4}" stroke-linecap="round"/>`;
    return `<svg viewBox="0 0 64 40" width="64" height="40" aria-hidden="true"><rect x="4" y="4" width="6" height="32" fill="rgb(255 255 255 / 0.25)"/>${dak}<line x1="51" y1="16" x2="51" y2="36" stroke="#c9d3dc" stroke-width="2.5"/><line x1="2" x2="62" y1="36" y2="36" stroke="rgb(110 231 183 / 0.5)" stroke-width="1.5"/></svg>`;
  };
  const raampje = (b, d) => `<svg viewBox="0 0 64 40" width="64" height="40" aria-hidden="true"><path d="M6 34L32 6L58 34Z" fill="rgb(255 255 255 / 0.06)" stroke="rgb(255 255 255 / 0.3)" stroke-width="1.5"/><rect x="${32 - b / 2}" y="${22 - d / 2}" width="${b}" height="${d}" rx="1.5" fill="rgb(143 208 255 / 0.45)" stroke="${IJS}" stroke-width="1.6"/></svg>`;

  function blad() {
    if (stand === 'overkapping') {
      return `<header><h3>Veranda</h3><span>5,6 × 3,5 m</span></header>
        ${tegels([['overkapping', 'Overkapping', 'dicht dak', dakje('overkapping')], ['veranda', 'Veranda', 'glazen dak', dakje('veranda')], ['pergola', 'Pergola', 'open latten', dakje('pergola')]], 'veranda')}
        ${stapper('Diep', '3,5 m')}
        ${stapper('Hoogte tegen het huis', '2,6 m')}
        <h4 class="ht-dakkop">Tegen het huis</h4>
        ${knoppen(['Voor', 'Links', 'Rechts', 'Achter'], 'Achter')}
        <p class="ht-zin">Boven het terras. De lamp en de heater eronder horen bij het terras.</p>
        ${rij({ ik: 'kruis', titel: 'Weghalen', zin: 'De veranda gaat uit je huis' })}
        <p class="ht-voet">De kaarten zien een overkapping meestal niet: je tekent hem zelf, tegen een muur. Trek aan een stip om hem op maat te maken.</p>`;
    }
    if (stand === 'dakraam') {
      return `<header><h3>Dakraam</h3><span>voorkant van het dak</span></header>
        ${tegels([['klein', 'Klein', '55 × 78 cm', raampje(9, 13)], ['middel', 'Middel', '78 × 118 cm', raampje(13, 19)], ['groot', 'Groot', '114 × 118 cm', raampje(19, 19)]], 'middel')}
        <h4 class="ht-dakkop">Op welke etage</h4>
        ${knoppen(['1e', 'Zolder'], 'Zolder')}
        <h4 class="ht-dakkop">Ervoor</h4>
        ${knoppen(['Niets', 'Screen', 'Rolluik'], 'Screen')}
        <p class="ht-zin">Een dakraam laat op zon warmte binnen. Met een screen ervoor kan SunArc hem later dicht doen, zoals de screens voor je ramen.</p>
        ${rij({ ik: 'dak', titel: 'Nog een dakraam', zin: 'Op de voorkant of de achterkant', rechts: '+' })}
        ${rij({ ik: 'kruis', titel: 'Weghalen', zin: '' })}
        <p class="ht-voet">De 3D-kaart ziet geen dakramen: je zet ze zelf. Sleep langs het dak naar zijn plek.</p>`;
    }
    if (stand === 'kadaster') {
      const bron = (o) => `<button type="button" class="ht-rij${o.aan ? ' aan' : ''}"><span class="ik">${ik(o.ik)}</span><span class="t"><b>${esc(o.titel)}</b><small>${esc(o.zin)}</small></span><em>${esc(o.rechts)}</em></button>`;
      return `<header><h3>Erfgrens</h3><span>218 m²</span></header>
        ${bron({ ik: 'kaarten', titel: 'Kadaster', zin: '8,7 × 25,6 m, de grens van je perceel', rechts: 'In gebruik', aan: true })}
        ${bron({ ik: 'thuis', titel: 'Geschat', zin: 'Uit de gebouwen eromheen', rechts: 'Gebruik' })}
        ${bron({ ik: 'greep', titel: 'Zelf getrokken', zin: 'Trek aan de grens', rechts: 'Gebruik' })}
        <p class="ht-zin">De kaart van het kadaster is een aanwijzing, geen meting. Je tuinen en terras blijven waar je ze tekende; wat buiten de grens valt, zie je meteen.</p>
        <p class="ht-voet">SunArc vraagt het kadaster een vak van de wijk, niet je adres. © Kadaster, CC BY 4.0.</p>`;
    }
    return `<header><h3>Je huis</h3><span>dicht, met buiten</span></header>
      ${rij({ ik: 'tuin', titel: 'Buiten', zin: 'De tuinen, het terras en de oprit op de grond', rechts: 'Aan', aan: true })}
      <h4 class="ht-dakkop">Plekken buiten</h4>
      ${rij({ ik: 'tuin', titel: 'Voortuin', zin: '2 lampen' })}
      ${rij({ ik: 'oprit', titel: 'Oprit', zin: '1 lamp, de camera' })}
      ${rij({ ik: 'tuin', titel: 'Achtertuin', zin: '2 lampen, met de border' })}
      ${rij({ ik: 'terras', titel: 'Terras', zin: '1 lamp · deel van de achtertuin', aan: true, rechts: '›' })}
      <p class="ht-voet">Een plek aantikken zet zijn lampen aan of uit, zoals op Thuis. Buiten teken je bij de etage Buiten.</p>`;
  }

  const UITLEG = {
    tuin: 'Sleep opzij om het huis te draaien. Tik op een plek buiten om zijn lampen te zien.',
    overkapping: 'Trek aan een stip om de veranda op maat te maken, of sleep hem langs de muur.',
    dakraam: 'Sleep een dakraam langs het dak, of trek aan een stip. Tik ernaast om los te laten.',
    kadaster: 'De grens van het kadaster staat in mint, de geschatte grens in grijs.',
  };

  function start(tel) {
    const svg = $('tekening');
    const teken = () => (stand === 'tuin' ? drieD(svg, !tel) : bovenaf(svg, !tel));
    teken();
    addEventListener('resize', teken);
    $('blad').innerHTML = blad();
    $('uitleg').innerHTML = `${WIJS}<span>${esc(UITLEG[stand] ?? UITLEG.tuin)}</span>`;
    const v = $('vraag');
    if (stand === 'kadaster') {
      v.hidden = false;
      v.innerHTML = `<span class="hb-ik">${ik('kaarten')}</span><span class="hb-tekst"><b>De erfgrens van het kadaster</b><span>Iets kleiner dan geschat: 8,7 × 25,6 m. Klopt dit?</span></span><span class="hb-knoppen"><button type="button">Houd de oude</button><button type="button" class="hb-hoofd">Ja</button></span>`;
    }
    const tab = { tuin: 'huis', overkapping: 'vorm', dakraam: 'dak', kadaster: 'kamers' }[stand] ?? 'huis';
    document.querySelectorAll('[data-stand]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.stand === tab)));
    // Buiten: de etage Buiten gekozen; bij Dak de zolder.
    const kies = { kadaster: 'Buiten', dakraam: 'Zolder' }[stand] ?? 'Begane grond';
    document.querySelectorAll('#stapel .ht-laag, .tk-etages button').forEach((b) => {
      const aan = b.textContent.trim().startsWith(kies);
      b.classList.toggle('aan', aan);
      b.setAttribute('aria-pressed', String(aan));
    });
  }

  global.rondomSchets = { start };
})(window);
