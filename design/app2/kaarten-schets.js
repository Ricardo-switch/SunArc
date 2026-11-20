/*
 * Je huis › Vorm: wat de kaarten vinden (schets, 20 november 2026, stap 4
 * punt 3, ronde 2). Vijf dingen die de kaart nog niet goed deed:
 *
 *   (zonder)     De kaarten zoeken: de keuzes erboven grijs, een draaiend
 *                icoon en per kaart een vinkje (wens Ricardo 20-11).
 *   #gevonden    Wat de kaarten vonden: het afdak voor het huis is een eigen
 *                deel uit de dakdelen van de 3D-kaart, niet meer een stuk van
 *                het hoofdhuis; twee straten, en de straat van je adres staat
 *                onder met Klopt dit?.
 *   #straat      Waar is de straat: de twee straten van de kaart, of zelf een
 *                kant kiezen.
 *   #gebouw      Een gebouw van de kaart op maat: het tuinhuis groter
 *                getrokken (de kaart ziet 1,8 × 3,3 m, het is 7 × 3 m), en het
 *                schuurtje dat er niet meer staat, weggehaald en weg gebleven.
 *   #buitenland  Een huis buiten Nederland: geen 3D-kaart, wel de plattegrond
 *                met zijn lagen, hoogte en dakvorm als die erin staan.
 *
 * Ricardo's huis van boven, de straat onderaan (oost). Maten zoals in de
 * schets Wand-Huis-Woning; de straatnamen zijn verzonnen.
 */
(function (global) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ik = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${global.iconen.binnen(n)}</svg>`;
  const WIJS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2"/><path d="M15 11a1.5 1.5 0 0 1 3 0v3.5c0 3.6-2.2 6-5.6 6-2.4 0-3.7-.9-5-2.9L5 14.3c-.6-1 .6-2.2 1.6-1.4L9 15"/></svg>';
  const DRAAI = '<svg class="kv-draai" viewBox="0 0 24 24" fill="none" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="rgb(111 211 255 / 0.2)"/><path d="M12 3a9 9 0 0 1 9 9" stroke="#6fd3ff"/></svg>';
  const VINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  const stand = (location.hash.slice(1) || 'zoekt').split('/')[0];
  const MINT = '#6ee7b7';
  const IJS = '#6fd3ff';
  const OR = '#ffb07a';
  const nl = (x) => String(x).replace('.', ',');

  /* ---------------------------------------------------------- de tekening */

  // u naar rechts, v naar achteren; de voorkant van het hoofdhuis is v = 0.
  const HUIS = { u: 0, v: 0, b: 5.6, d: 9.9 };
  const AFDAK = { u: 0, v: 0, b: 5.6, d: 0.9 };
  const GARAGE = { u: -2.9, v: 1.4, b: 2.9, d: 7.0 };
  const BUUR = { u: 5.6, v: 0, b: 5.6, d: 9.9 };
  const TUINHUIS_KAART = { u: 3.6, v: 15.2, b: 1.8, d: 3.3 };
  const TUINHUIS = { u: -1.2, v: 15.2, b: 7.0, d: 3.0 };
  const SCHUUR = { u: -2.9, v: 9.6, b: 2.0, d: 3.0 };
  const BUREN = [{ u: 11.6, v: 0.4, b: 3.2, d: 9.4 }, { u: -8.6, v: 0.8, b: 4.4, d: 9 }, { u: 11.8, v: 12.5, b: 3, d: 3.5 }];
  // Een huis in België voor #buitenland: vrijstaand, 9 bij 10 m, één straat.
  const BE = { u: 0, v: 0, b: 9, d: 10 };

  function plattegrond(svg, wand) {
    const r = svg.getBoundingClientRect();
    const W = r.width || 600;
    const H = r.height || 500;
    const be = stand === 'buitenland';
    const vraag = stand === 'gevonden' && wand ? 76 : stand === 'zoekt' ? 46 : 0;
    const [u0, u1, v0, v1] = be ? [-8, 17, -8, 17] : [-5.5, 19.2, -8, 19];
    const k = Math.min((W - 30) / (u1 - u0), (H - 40 - vraag) / (v1 - v0));
    const x0 = (W - (u1 - u0) * k) / 2 - u0 * k;
    const y0 = vraag + (H - vraag - (v1 - v0) * k) / 2 + v1 * k;
    const X = (u) => x0 + u * k;
    const Y = (v) => y0 - v * k;
    const rect = (q, a) => `<rect x="${X(q.u)}" y="${Y(q.v + q.d)}" width="${q.b * k}" height="${q.d * k}" ${a}/>`;
    const tekst = (x, y, t, kleur = 'rgb(255 255 255 / 0.75)', grootte = wand ? 12.5 : 9.5, gewicht = 700) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="Figtree, sans-serif" font-size="${grootte}" font-weight="${gewicht}" fill="${kleur}">${esc(t)}</text>`;
    const label = (q, t, kleur, zin) => tekst(X(q.u + q.b / 2), Y(q.v + q.d / 2) + (zin ? -2 : 4), t, kleur) + (zin ? tekst(X(q.u + q.b / 2), Y(q.v + q.d / 2) + 12, zin, 'rgb(255 255 255 / 0.5)', wand ? 10.5 : 9, 600) : '');
    let s = `<defs>
      <pattern id="kv-afdak" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(90)"><rect width="7" height="7" fill="rgb(110 231 183 / 0.16)"/><line x1="0" y1="0" x2="0" y2="7" stroke="${MINT}" stroke-width="1.6" opacity="0.7"/></pattern>
      <pattern id="kv-buur" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="rgb(255 176 122 / 0.12)"/><line x1="0" y1="0" x2="0" y2="8" stroke="${OR}" stroke-width="3"/></pattern>
      <radialGradient id="kv-straal" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${X(2.8)} ${Y(8)}) scale(${16 * k})"><stop offset="0" stop-color="${IJS}" stop-opacity="0.35"/><stop offset="1" stop-color="${IJS}" stop-opacity="0"/></radialGradient>
    </defs>`;

    // De straten: een band met de naam erin. Onder de Lindelaan (oost), rechts schuin de Beukenweg (noordnoordoost).
    const straatKies = stand === 'straat';
    const lindeAan = !be && stand !== 'zoekt';
    if (!be) {
      const band1 = `M${X(u0)} ${Y(-4.2)} L${X(u1)} ${Y(-4.2)} L${X(u1)} ${Y(-7.6)} L${X(u0)} ${Y(-7.6)} Z`;
      const band2 = `M${X(15.4)} ${Y(-7.6)} L${X(18.4)} ${Y(-7.6)} L${X(19.2)} ${Y(19)} L${X(16.2)} ${Y(19)} Z`;
      const vul = (aan) => (aan ? `fill="rgb(110 231 183 / 0.13)" stroke="${MINT}" stroke-width="1.5"` : 'fill="rgb(255 255 255 / 0.05)" stroke="rgb(255 255 255 / 0.16)" stroke-width="1"');
      s += `<path d="${band1}" ${vul(lindeAan)}/><path d="${band2}" ${vul(false)}${straatKies ? ` stroke-dasharray="5 4" stroke="${IJS}" stroke-opacity="0.8"` : ''}/>`;
      s += tekst(X(4), Y(-6.3), 'Lindelaan', lindeAan ? '#b6f0d6' : 'rgb(255 255 255 / 0.38)', wand ? 12 : 10);
      const xm = (X(16.6) + X(18.4)) / 2;
      s += `<text x="${xm}" y="${Y(9)}" transform="rotate(-86.5 ${xm} ${Y(9)})" text-anchor="middle" font-family="Figtree, sans-serif" font-size="${wand ? 12 : 10}" font-weight="700" fill="${straatKies ? '#a9e6ff' : 'rgb(255 255 255 / 0.38)'}">Beukenweg</text>`;
      if (stand !== 'zoekt') {
        const afst = (x1, y1, x2, y2, t) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgb(255 255 255 / 0.35)" stroke-dasharray="2 4"/>${tekst((x1 + x2) / 2 + (x1 === x2 ? 16 : 0), (y1 + y2) / 2 + (x1 === x2 ? 4 : -5), t, 'rgb(255 255 255 / 0.5)', wand ? 10.5 : 9, 600)}`;
        s += afst(X(2.8), Y(0), X(2.8), Y(-4.2), '20 m');
        if (straatKies) s += afst(X(BUUR.u + BUUR.b + 0.3), Y(5), X(16.2), Y(5), '34 m');
      }
    } else {
      s += `<path d="M${X(u0)} ${Y(-4.4)} L${X(u1)} ${Y(-4.4)} L${X(u1)} ${Y(-7.6)} L${X(u0)} ${Y(-7.6)} Z" fill="rgb(110 231 183 / 0.13)" stroke="${MINT}" stroke-width="1.5"/>`;
      s += tekst(X(4.5), Y(-6.4), 'Rue des Tilleuls', '#b6f0d6', wand ? 12 : 10);
    }

    // De buren en de gebouwen van de kaart die er niet bij horen: alleen een rand.
    const grijs = (q) => rect(q, 'fill="rgb(255 255 255 / 0.035)" stroke="rgb(255 255 255 / 0.2)" stroke-width="1.5" stroke-dasharray="4 5"');
    if (be) {
      s += grijs({ u: -7, v: 1, b: 4.5, d: 8 }) + grijs({ u: 12, v: 0, b: 4.5, d: 9 });
    } else {
      for (const q of BUREN) s += grijs(q);
      s += grijs(BUUR);
    }

    if (be) {
      s += rect(BE, 'fill="rgb(120 190 255 / 0.16)"') + rect(BE, 'fill="none" stroke="#eef3f7" stroke-width="6"');
      // De nok van het zadeldak uit de plattegrond: van links naar rechts, evenwijdig aan de straat.
      s += `<line x1="${X(0)}" y1="${Y(5)}" x2="${X(9)}" y2="${Y(5)}" stroke="${IJS}" stroke-width="2" stroke-dasharray="7 5"/>`;
      s += label({ u: 0, v: 6.4, b: 9, d: 2.4 }, 'Huis', 'rgb(255 255 255 / 0.8)', 'zadeldak, 2 lagen');
      s += `<g transform="translate(${X(9) + 10} ${Y(5)})"><rect x="0" y="-11" width="${wand ? 88 : 74}" height="22" rx="8" fill="#0b1424" stroke="${IJS}" stroke-width="1.2"/><text x="${wand ? 44 : 37}" y="4" text-anchor="middle" font-family="Figtree, sans-serif" font-size="${wand ? 11 : 9.5}" font-weight="700" fill="#a9e6ff">nok geschat</text></g>`;
    } else {
      // Het hoofdhuis, en het afdak voor als eigen deel (uit de dakdelen) na het zoeken.
      const afdakApart = stand !== 'zoekt';
      s += rect(HUIS, 'fill="rgb(120 190 255 / 0.16)"');
      if (afdakApart) s += rect(AFDAK, 'fill="url(#kv-afdak)"');
      s += rect(GARAGE, 'fill="rgb(160 170 180 / 0.2)"');
      s += rect(HUIS, 'fill="none" stroke="#eef3f7" stroke-width="6"');
      if (afdakApart) s += `<line x1="${X(0)}" y1="${Y(0.9)}" x2="${X(5.6)}" y2="${Y(0.9)}" stroke="#eef3f7" stroke-width="2.5"/>`;
      s += rect(GARAGE, 'fill="none" stroke="#c9d3dc" stroke-width="4"');
      s += `<rect x="${X(5.6) - 5}" y="${Y(9.9)}" width="10" height="${9.9 * k}" fill="url(#kv-buur)" stroke="${OR}" stroke-width="1.5"/>`;
      s += label({ ...HUIS, v: 1, d: 8.9 }, 'Huis', 'rgb(255 255 255 / 0.8)', stand === 'zoekt' ? '' : 'nok 9,2 m');
      s += label(GARAGE, 'Garage', 'rgb(255 255 255 / 0.6)');
      if (afdakApart) {
        // Het afdak: een labeltje ernaast, met "nieuw" zolang de bewoner het nog niet zag.
        const ly = Y(0.45);
        s += `<line x1="${X(5.6) + 4}" y1="${ly}" x2="${X(7.4)}" y2="${ly + 22}" stroke="${MINT}" stroke-width="1.4"/>`;
        s += `<g transform="translate(${X(7.4)} ${ly + 22})"><rect x="0" y="-12" width="${wand ? 132 : 108}" height="24" rx="9" fill="#0b1424" stroke="${MINT}" stroke-width="1.4"/><text x="${wand ? 66 : 54}" y="4.5" text-anchor="middle" font-family="Figtree, sans-serif" font-size="${wand ? 11.5 : 10}" font-weight="700" fill="#b6f0d6">${stand === 'gevonden' ? 'Nieuw · ' : ''}Afdak 0,9 m</text></g>`;
      }
      // Het tuinhuis: zoals de kaart hem ziet, of op maat getrokken; het schuurtje tot hij weg is.
      if (stand === 'gebouw') {
        s += rect(TUINHUIS, `fill="rgb(160 170 180 / 0.2)" stroke="${IJS}" stroke-width="3"`);
        s += rect(TUINHUIS_KAART, 'fill="none" stroke="rgb(255 255 255 / 0.45)" stroke-width="1.2" stroke-dasharray="3 4"');
        s += tekst(X(TUINHUIS_KAART.u + TUINHUIS_KAART.b / 2), Y(TUINHUIS_KAART.v) + 14, 'kaart', 'rgb(255 255 255 / 0.5)', wand ? 10 : 8.5, 600);
        s += label({ ...TUINHUIS, b: 4.4 }, 'Tuinhuis', 'rgb(255 255 255 / 0.85)', '7 × 3 m');
        // De grepen: op de hoeken en midden op elke muur, groot genoeg voor een vinger.
        const g = (u, v) => `<circle cx="${X(u)}" cy="${Y(v)}" r="${wand ? 8 : 7}" fill="#0b1424" stroke="${IJS}" stroke-width="2.5"/>`;
        const t = TUINHUIS;
        s += g(t.u, t.v) + g(t.u + t.b, t.v) + g(t.u, t.v + t.d) + g(t.u + t.b, t.v + t.d) + g(t.u + t.b, t.v + t.d / 2) + g(t.u, t.v + t.d / 2);
        // De vinger die rechts trekt.
        s += `<g transform="translate(${X(t.u + t.b) + 14} ${Y(t.v + t.d / 2) + 8})" opacity="0.9"><path d="M0 0 l-14 0" stroke="${IJS}" stroke-width="2" marker-end="none"/><path d="M-20 0 l6 -4 v8 z" fill="${IJS}" transform="rotate(180 -17 0)"/></g>`;
      } else {
        s += rect(TUINHUIS_KAART, 'fill="rgb(160 170 180 / 0.2)" stroke="#c9d3dc" stroke-width="3"');
        s += tekst(X(TUINHUIS_KAART.u + TUINHUIS_KAART.b / 2), Y(TUINHUIS_KAART.v + TUINHUIS_KAART.d) - 8, 'Tuinhuis', 'rgb(255 255 255 / 0.65)');
        s += rect(SCHUUR, 'fill="rgb(160 170 180 / 0.12)" stroke="#c9d3dc" stroke-opacity="0.6" stroke-width="2.5"');
        s += tekst(X(SCHUUR.u + SCHUUR.b / 2), Y(SCHUUR.v + SCHUUR.d) - 7, 'Schuurtje', 'rgb(255 255 255 / 0.55)', wand ? 11 : 9.5);
      }
    }

    // Tijdens het zoeken: een straal die rond het huis draait.
    if (stand === 'zoekt') {
      const cx = X(2.8);
      const cy = Y(8);
      const R = 16 * k;
      s += `<g class="kv-zwaai" style="transform-origin:${cx}px ${cy}px"><path d="M${cx} ${cy} L${cx + R} ${cy} A${R} ${R} 0 0 0 ${cx + R * Math.cos(0.7)} ${cy - R * Math.sin(0.7)} Z" fill="url(#kv-straal)"/></g>`;
      s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${IJS}" stroke-opacity="0.18" stroke-dasharray="3 6"/>`;
    }
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = s;
  }

  /* ---------------------------------------------------------- het blad */

  const rij = (o) => `<button type="button" class="ht-rij${o.aan ? ' aan' : ''}${o.mist ? ' mist' : ''}"${o.uit ? ' disabled' : ''}>${o.ik ? `<span class="ik">${ik(o.ik)}</span>` : ''}<span class="t"><b>${esc(o.titel)}</b>${o.zin ? `<small>${esc(o.zin)}</small>` : ''}</span>${o.rechts ? `<em>${esc(o.rechts)}</em>` : ''}</button>`;
  const huisje = (vol) => `<svg viewBox="0 0 64 48" width="64" height="48" aria-hidden="true"><path d="M10 40V20L32 7l22 13v20z" fill="${vol ? 'rgb(111 211 255 / 0.25)' : 'none'}" stroke="${vol ? IJS : 'rgb(255 255 255 / 0.4)'}" stroke-width="2" stroke-linejoin="round"${vol ? '' : ' stroke-dasharray="4 4"'}/></svg>`;
  const bron = (o) => `<button type="button" class="ht-bron${o.aan ? ' aan' : ''}"${o.uit ? ' disabled' : ''}><span class="pl">${huisje(!o.uit)}</span><span class="t"><b>${esc(o.naam)}</b><small>${esc(o.vond)}</small><em>${esc(o.knop)}</em></span></button>`;
  const stapper = (titel, waarde, tag) => `<div class="kv-stap"><span>${esc(titel)}${tag ? `<i>${esc(tag)}</i>` : ''}</span><button type="button" aria-label="Kleiner">−</button><b>${esc(waarde)}</b><button type="button" aria-label="Groter">+</button></div>`;
  const stap = (st, titel, zin) => `<li class="kv-${st}"><span class="kv-st">${st === 'klaar' ? VINK : st === 'bezig' ? DRAAI : ''}</span><span><b>${esc(titel)}</b><small>${esc(zin)}</small></span></li>`;

  function blad() {
    if (stand === 'zoekt') {
      return `<header><h3>Vorm</h3><span>5,6 × 9,9 m</span></header>
        <div class="kv-wacht" aria-hidden="true">
          ${rij({ ik: 'thuis', titel: 'Twee-onder-een-kap', zin: 'tegen rechts', rechts: 'Wijzig ›' })}
          ${bron({ naam: '3D-kaart van Nederland', vond: 'het huis, de garage, het tuinhuis', knop: 'In gebruik', aan: true })}
          ${bron({ naam: 'Basishuis', vond: '7 × 9 m', knop: 'Gebruik deze' })}
        </div>
        <div class="kv-zoek" role="status">
          <div class="kv-zoekkop">${DRAAI}<span><b>De kaarten zoeken…</b><small>Kiezen kan weer zodra ze klaar zijn</small></span></div>
          <ol class="kv-stappen">
            ${stap('klaar', '3D-kaart van Nederland', 'je huis en 5 gebouwen eromheen')}
            ${stap('bezig', 'Plattegrond', 'zoekt de gebouwen en de straten')}
            ${stap('nog', 'De straat bij je huis', 'daarna')}
          </ol>
        </div>
        <p class="ht-voet">Het zoeken duurt soms een halve minuut. De kaarten zien de wijk, niet je adres.</p>`;
    }
    if (stand === 'gevonden') {
      return `<header><h3>Wat de kaarten vonden</h3></header>
        ${rij({ ik: 'thuis', titel: 'Huis', zin: '5,6 × 9,9 m · scheef dak, nok 9,2 m', rechts: '✓' })}
        ${rij({ ik: 'dak', titel: 'Afdak voor', zin: '0,9 m · schuin, 2,9 tot 3,6 m', rechts: 'Nieuw', aan: true })}
        ${rij({ ik: 'garage', titel: 'Garage', zin: '2,9 × 7 m · plat, 2,7 m', rechts: '✓' })}
        ${rij({ ik: 'tuinhuis', titel: 'Tuinhuis', zin: '1,8 × 3,3 m · klopt dat?', rechts: 'Op maat ›' })}
        ${rij({ ik: 'schuur', titel: 'Schuurtje', zin: '2 × 3 m', rechts: 'Wat is dit? ›' })}
        ${rij({ ik: 'oprit', titel: 'Twee straten', zin: 'Lindelaan onder', rechts: 'Wijzig ›', mist: true })}
        <p class="ht-zin">Het afdak zag de 3D-kaart als een eigen dakdeel. Nu is het een eigen stuk van je huis, met zijn eigen dak.</p>`;
    }
    if (stand === 'straat') {
      const tegel = (o) => `<button type="button" class="kv-straat${o.aan ? ' aan' : ''}" aria-pressed="${!!o.aan}"><svg viewBox="0 0 64 48" width="64" height="48" aria-hidden="true"><rect x="22" y="${o.onder ? 10 : 14}" width="20" height="24" rx="2" fill="rgb(111 211 255 / 0.25)" stroke="${IJS}" stroke-width="1.8"/>${o.onder ? `<rect x="2" y="38" width="60" height="7" rx="2" fill="${o.aan ? 'rgb(110 231 183 / 0.4)' : 'rgb(255 255 255 / 0.2)'}"/>` : `<rect x="50" y="2" width="8" height="44" rx="2" transform="rotate(4 54 24)" fill="${o.aan ? 'rgb(110 231 183 / 0.4)' : 'rgb(255 255 255 / 0.2)'}"/>`}</svg><span><b>${esc(o.naam)}</b><small>${esc(o.zin)}</small></span>${o.tag ? `<i>${esc(o.tag)}</i>` : ''}</button>`;
      return `<header><h3>Waar is de straat?</h3><span>twee gevonden</span></header>
        <p class="ht-zin">De straat staat onder in de tekening, en daar is de voorkant.</p>
        ${tegel({ naam: 'Lindelaan', zin: '20 m, aan de voorkant', onder: true, aan: true, tag: 'je adres' })}
        ${tegel({ naam: 'Beukenweg', zin: '34 m, aan de zijkant' })}
        <h4 class="ht-dakkop">Of kies de kant zelf</h4>
        <div class="ht-twee kv-vier">${['Voor', 'Links', 'Rechts', 'Achter'].map((x, i) => `<button type="button" class="ht-klein${i === 0 ? ' aan' : ''}">${x}</button>`).join('')}</div>
        <p class="ht-voet">De tekening draait mee. De zon en je panelen niet: die liggen vast op het kompas.</p>`;
    }
    if (stand === 'gebouw') {
      return `<header><h3>Tuinhuis</h3><span>op maat</span></header>
        ${stapper('Breed', '7,0 m', 'kaart 1,8')}
        ${stapper('Diep', '3,0 m', 'kaart 3,3')}
        <p class="ht-zin">Je trok hem groter. Dat blijft zo, ook als de kaart hem kleiner ziet.</p>
        ${rij({ ik: 'terug', titel: 'Maat van de kaart', zin: '1,8 × 3,3 m' })}
        ${rij({ ik: 'weg', titel: 'Bestaat niet meer', zin: 'Blijft weg, ook als de kaart hem ziet' })}
        ${rij({ ik: 'kruis', titel: 'Hoort er niet bij', zin: 'Blijft grijs op de kaart' })}
        <h4 class="ht-dakkop">Weggehaald</h4>
        ${rij({ ik: 'schuur', titel: 'Schuurtje', zin: '2 × 3 m, bestaat niet meer', rechts: 'Terug' })}`;
    }
    // #buitenland
    const weet = (titel, waarde, tag, mist) => `<div class="kv-weet${mist ? ' mist' : ''}"><span>${esc(titel)}</span><b>${esc(waarde)}</b><i>${esc(tag)}</i></div>`;
    return `<header><h3>Vorm</h3><span>9 × 10 m</span></header>
      ${bron({ naam: 'Plattegrond', vond: 'de omtrek, de lagen, de hoogte en het dak', knop: 'In gebruik', aan: true })}
      ${bron({ naam: '3D-kaart van Nederland', vond: 'Alleen in Nederland', knop: 'Niet bij jou', uit: true })}
      <h4 class="ht-dakkop">Wat de plattegrond weet</h4>
      ${weet('Lagen', '2', 'van de kaart')}
      ${weet('Hoogte', '7,5 m', 'van de kaart')}
      ${weet('Dak', 'Zadeldak', 'van de kaart')}
      ${weet('Nok', '9 m', 'geschat · Wijzig', true)}
      <p class="ht-voet">Staat iets niet in de plattegrond, dan schat SunArc het uit de lagen. Wat je zelf invult, blijft.</p>`;
  }

  const UITLEG = {
    zoekt: 'De kaarten zoeken. Je kunt de tekening bekijken; kiezen kan zodra ze klaar zijn.',
    gevonden: 'Tik op een gebouw om te zeggen wat het is, of op het afdak om zijn dak te zien.',
    straat: 'Kies de straat aan de voorkant. De tekening draait zo dat hij onder staat.',
    gebouw: 'Trek aan een stip om het tuinhuis op maat te maken. Wat je trekt, blijft.',
    buitenland: 'De omtrek en het dak komen uit de plattegrond. Trek aan een muur als hij niet klopt.',
  };

  function start(tel) {
    const svg = $('tekening');
    const teken = () => plattegrond(svg, !tel);
    teken();
    addEventListener('resize', teken);
    $('blad').innerHTML = blad();
    $('uitleg').innerHTML = `${WIJS}<span>${esc(UITLEG[stand] ?? UITLEG.zoekt)}</span>`;
    const v = $('vraag');
    if (stand === 'gevonden') {
      v.hidden = false;
      v.innerHTML = `<span class="hb-ik">${ik('oprit')}</span><span class="hb-tekst"><b>Twee straten bij je huis</b><span>Je adres is aan de Lindelaan, dus die staat onder. Klopt dit?</span></span><span class="hb-knoppen"><button type="button">Kies zelf</button><button type="button" class="hb-hoofd">Ja</button></span>`;
    }
    // Tijdens het zoeken: een pil boven op de tekening, en de etages en standen even niet.
    if (stand === 'zoekt') {
      document.querySelector('.hm-podium, .tk-podium')?.insertAdjacentHTML('afterbegin', `<div class="kv-pil" role="status">${DRAAI}<span>De kaarten zoeken…</span></div>`);
      document.querySelectorAll('#stapel, .tk-etages').forEach((el) => el.classList.add('kv-stil'));
    }
    if (stand === 'buitenland') {
      const stapel = $('stapel');
      if (stapel) stapel.innerHTML = '<div class="ht-dak" aria-hidden="true"></div><button type="button" class="ht-laag"><b>1e</b><small>2,6 m hoog</small></button><button type="button" class="ht-laag aan" aria-pressed="true"><b>Begane grond</b><small>2,8 m hoog</small></button><div class="ht-grond" aria-hidden="true"></div><button type="button" class="ht-laag buiten"><b>Buiten</b><small>oprit, tuin</small></button>';
      const etages = document.querySelector('.tk-etages');
      if (etages) etages.innerHTML = '<button type="button">1e</button><button type="button" aria-pressed="true">Begane grond</button><button type="button">Buiten</button>';
    }
    document.querySelectorAll('[data-stand]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.stand === 'vorm')));
  }

  global.kaartenSchets = { start };
})(window);
