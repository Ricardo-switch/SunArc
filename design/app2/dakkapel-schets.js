/*
 * Je huis › Dak: de dakkapel (schets, 20 november 2026, stap 4 punt 3). Dak
 * is een eigen tab naast Vorm (Ricardo: dan blijft Vorm rustiger): de dakvorm
 * en de nok, de dakkapel, en wat lager is dan 1,5 m.
 * Keuzes van Ricardo (19 november): een dakkapel is een keuze met de etage
 * erbij, verplaatsbaar en van formaat te veranderen zoals een kamer; vindt de
 * 3D-kaart er een, dan staat hij er meteen op maat.
 *
 * Op de zolder van Ricardo's huis: 5,6 m breed, 9,0 m diep, de nok 4,5 m
 * achter de voorkant (de straat onderaan). Wat lager is dan 1,5 m (onder het
 * schuine dak) staat gestreept; onder een dakkapel kun je staan, dus daar niet.
 *
 *   (zonder)  de zolder zonder dakkapel: Dakkapel erbij in het blad
 *   #kies     erbij: aan welke kant en op welke etage, met een doorsnede
 *   #gekozen  neergezet aan de tuinkant: schuiven, breedte met de zijkant, in het blad de maten
 *   #kaart    gevonden op de 3D-kaart: meteen op maat, met Klopt dit?
 */
(function (global) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const nl = (n) => n.toFixed(1).replace('.', ',');
  const ik = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${global.iconen.binnen(n)}</svg>`;
  const WIJS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2"/><path d="M15 11a1.5 1.5 0 0 1 3 0v3.5c0 3.6-2.2 6-5.6 6-2.4 0-3.7-.9-5-2.9L5 14.3c-.6-1 .6-2.2 1.6-1.4L9 15"/></svg>';

  // De zolder in meters: u naar rechts, v naar achteren (de straat bij v = 0).
  const B = 5.6;
  const D = 9.0;
  const NOK = 4.5;
  const LAAG = 1.4; // tot hier vanaf de voor- en achtergevel is het lager dan 1,5 m
  const KAMERS = [
    { naam: 'Slaapkamer', u: 0, v: 0, b: 3.6, d: 9.0, tint: '120 190 255' },
    { naam: 'Wasruimte', u: 3.6, v: 0, b: 2.0, d: 4.4, tint: '120 220 200' },
    { naam: 'Overloop', u: 3.6, v: 4.4, b: 2.0, d: 4.6, tint: '200 210 220' },
  ];
  const stand = (location.hash.slice(1) || 'zonder').split('/')[0];
  // De dakkapel per stand: aan de achterkant (tuin), van..tot langs de gevel, diep vanaf de achtergevel.
  const KAPEL = stand === 'kaart' ? { van: 0.6, tot: 3.0, diep: 2.0, bron: 'kaart' } : stand === 'gekozen' ? { van: 0.3, tot: 3.3, diep: 2.0, bron: 'bewoner' } : null;

  /* ---------------------------------------------------------- de plattegrond */

  function plattegrond(svg, wand) {
    const r = svg.getBoundingClientRect();
    const W = r.width || 600;
    const H = r.height || 500;
    // Op de wand staat Klopt dit? over de tekening: dan schuift het huis omlaag.
    const vraag = stand === 'kaart' && wand ? 84 : 0;
    const k = Math.min((W - 120) / B, (H - 130 - vraag) / D);
    const x0 = (W - B * k) / 2;
    const y0 = (H - D * k) / 2 + 14 + vraag / 2;
    const X = (u) => x0 + u * k;
    const Y = (v) => y0 + (D - v) * k; // achter boven, de straat onder
    let s = `<defs><pattern id="laag" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="rgb(255 255 255 / 0.03)"/><line x1="0" y1="0" x2="0" y2="9" stroke="rgb(255 255 255 / 0.16)" stroke-width="3"/></pattern></defs>`;
    for (const q of KAMERS) s += `<rect x="${X(q.u)}" y="${Y(q.v + q.d)}" width="${q.b * k}" height="${q.d * k}" fill="rgb(${q.tint} / 0.17)"/>`;
    // Wat lager is dan 1,5 m: een strook langs de voor- en de achtergevel; onder de dakkapel niet.
    const strook = (v0, v1) => `<rect x="${X(0)}" y="${Y(v1)}" width="${B * k}" height="${(v1 - v0) * k}" fill="url(#laag)"/>`;
    s += strook(0, LAAG);
    if (KAPEL) {
      s += `<rect x="${X(0)}" y="${Y(D)}" width="${KAPEL.van * k}" height="${LAAG * k}" fill="url(#laag)"/>`;
      s += `<rect x="${X(KAPEL.tot)}" y="${Y(D)}" width="${(B - KAPEL.tot) * k}" height="${LAAG * k}" fill="url(#laag)"/>`;
    } else s += strook(D - LAAG, D);
    // De nok: een stippellijn dwars door de zolder.
    s += `<line x1="${X(0) - 10}" x2="${X(B) + 10}" y1="${Y(NOK)}" y2="${Y(NOK)}" stroke="rgb(255 255 255 / 0.4)" stroke-width="1.5" stroke-dasharray="3 5"/>`;
    s += `<text x="${X(B) + 14}" y="${Y(NOK) + 4}" font-family="Figtree, sans-serif" font-size="11.5" font-weight="700" fill="rgb(255 255 255 / 0.5)">nok</text>`;
    // De binnenmuren en de buitenmuur.
    s += `<line x1="${X(3.6)}" x2="${X(3.6)}" y1="${Y(0)}" y2="${Y(D)}" stroke="#c9d3dc" stroke-width="3"/>`;
    s += `<line x1="${X(3.6)}" x2="${X(B)}" y1="${Y(4.4)}" y2="${Y(4.4)}" stroke="#c9d3dc" stroke-width="3"/>`;
    s += `<rect x="${X(0)}" y="${Y(D)}" width="${B * k}" height="${D * k}" fill="none" stroke="#eef3f7" stroke-width="6"/>`;
    // De dakkapel: een vak dat uit de achtergevel steekt, zoals een kamer te schuiven en te rekken.
    if (KAPEL) {
      const kx0 = X(KAPEL.van);
      const kx1 = X(KAPEL.tot);
      const ky0 = Y(D);
      const ky1 = Y(D - KAPEL.diep);
      const uitKaart = KAPEL.bron === 'kaart';
      s += `<rect x="${kx0}" y="${ky0 - 0.35 * k}" width="${kx1 - kx0}" height="${ky1 - ky0 + 0.35 * k}" rx="3" fill="rgb(111 211 255 / 0.2)" stroke="#6fd3ff" stroke-width="${uitKaart ? 2.5 : 3.5}" ${uitKaart ? 'stroke-dasharray="7 5"' : ''}/>`;
      s += `<line x1="${kx0 + 6}" x2="${kx1 - 6}" y1="${ky0 - 0.35 * k + 4}" y2="${ky0 - 0.35 * k + 4}" stroke="#a9e6ff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>`;
      s += `<text x="${(kx0 + kx1) / 2}" y="${(ky0 + ky1) / 2 + 2}" text-anchor="middle" font-family="Figtree, sans-serif" font-size="${wand ? 13.5 : 12}" font-weight="700" fill="#eef3f7">Dakkapel</text>`;
      if (wand) s += `<text x="${(kx0 + kx1) / 2}" y="${(ky0 + ky1) / 2 + 17}" text-anchor="middle" font-family="Figtree, sans-serif" font-size="11" font-weight="600" fill="rgb(169 230 255 / 0.85)">${uitKaart ? 'van de 3D-kaart' : 'hier kun je staan'}</text>`;
      // De maat erboven, en grepen op de zijkanten; in het midden de greep om te schuiven.
      const pil = (x, y, t) => `<g transform="translate(${x} ${y})"><rect x="-27" y="-13" width="54" height="26" rx="9" fill="#0b1424" stroke="#6ee7b7" stroke-width="1.5"/><text y="5" text-anchor="middle" font-family="Figtree, sans-serif" font-size="13" font-weight="700" fill="#6ee7b7">${t}</text></g>`;
      s += pil((kx0 + kx1) / 2, ky0 - 0.35 * k - 22, `${nl(KAPEL.tot - KAPEL.van)} m`);
      if (!uitKaart) {
        for (const x of [kx0, kx1]) s += `<rect x="${x - 5}" y="${(ky0 + ky1) / 2 - 22}" width="10" height="44" rx="5" fill="#6fd3ff" stroke="#0b1424" stroke-width="2"/>`;
        s += `<g transform="translate(${(kx0 + kx1) / 2} ${ky1 + 2})"><circle r="15" fill="#6fd3ff" stroke="#0b1424" stroke-width="2"/><path d="M-8 0h16M-8 0l3-3M-8 0l3 3M8 0l-3-3M8 0l-3 3" stroke="#0b1424" stroke-width="1.8" stroke-linecap="round" fill="none"/></g>`;
      }
    }
    // De namen van de kamers.
    for (const q of KAMERS) {
      const cx = X(q.u + q.b / 2);
      const cy = q.naam === 'Slaapkamer' ? Y(NOK) - 10 : Y(q.v + q.d / 2) + 4;
      s += `<text x="${cx}" y="${cy}" text-anchor="middle" font-family="Figtree, sans-serif" font-size="${wand ? 13 : 10.5}" font-weight="700" fill="rgb(255 255 255 / 0.75)">${q.naam}</text>`;
    }
    // Wat de strepen zijn.
    s += `<text x="${X(B / 2)}" y="${Y(LAAG / 2) + 4}" text-anchor="middle" font-family="Figtree, sans-serif" font-size="11" font-weight="600" fill="rgb(255 255 255 / 0.55)">lager dan 1,5 m</text>`;
    s += `<text x="${X(0) - 12}" y="${Y(D - 0.2)}" text-anchor="end" font-family="Figtree, sans-serif" font-size="11" font-weight="700" fill="rgb(255 255 255 / 0.45)">TUIN</text>`;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = s;
  }

  /* ---------------------------------------------------------- de doorsnede */

  /**
   * De zijkant van het huis (de straat links, de tuin rechts), met Ricardo's
   * maten uit 3D BAG: het voordak tot 5,6 m, het achterdak lang tot 3,9 m, de
   * nok op 9,2 m, 4,5 m achter de voorkant; de zolder op 5,4 m. Een dakkapel
   * steekt uit het schuine dak, met een rechte voorkant en een plat dakje.
   */
  function doorsnede(kant, etage, grootte) {
    const [w, h] = grootte;
    const m = 7;
    const DIEP = 9.0;
    const sx = (w - 2 * m) / DIEP;
    const sy = (h - 2 * m - 10) / 9.4;
    const P = (pp) => pp.map(([a, z]) => `${(m + a * sx).toFixed(1)},${(h - m - 10 - z * sy).toFixed(1)}`).join(' ');
    const voor = (a) => 5.6 + a * (3.6 / 4.5);
    const achter = (a) => 9.2 - (a - 4.5) * (5.3 / 4.5);
    const zolder = 5.4;
    const randZolder = 4.5 + (9.2 - zolder) / (5.3 / 4.5);
    let s = `<polygon points="${P([[0, 0], [0, 5.6], [4.5, 9.2], [DIEP, 3.9], [DIEP, 0]])}" fill="rgb(255 255 255 / 0.07)" stroke="rgb(255 255 255 / 0.55)" stroke-width="1.5" stroke-linejoin="round"/>`;
    s += `<polyline points="${P([[0, 2.7], [DIEP, 2.7]])}" fill="none" stroke="rgb(255 255 255 / 0.3)" stroke-width="1"/>`;
    s += `<polyline points="${P([[0, zolder], [randZolder, zolder]])}" fill="none" stroke="${etage === 'zolder' && kant ? 'rgb(111 211 255 / 0.7)' : 'rgb(255 255 255 / 0.3)'}" stroke-width="${etage === 'zolder' && kant ? 2 : 1}"/>`;
    const top = zolder + 2.4;
    if (kant === 'achter') {
      const gevel = 7.5;
      const tot = 4.5 + (9.2 - top) / (5.3 / 4.5);
      s += `<polygon points="${P([[tot, top], [gevel, top], [gevel, achter(gevel)]])}" fill="rgb(111 211 255 / 0.32)" stroke="#6fd3ff" stroke-width="2" stroke-linejoin="round"/>`;
      s += `<polyline points="${P([[gevel, zolder + 0.6], [gevel, top - 0.4]])}" fill="none" stroke="#a9e6ff" stroke-width="3" stroke-linecap="round"/>`;
    } else if (kant === 'voor') {
      const gevel = 0.9;
      const tot = (top - 5.6) / (3.6 / 4.5);
      s += `<polygon points="${P([[gevel, voor(gevel)], [gevel, top], [tot, top]])}" fill="rgb(111 211 255 / 0.32)" stroke="#6fd3ff" stroke-width="2" stroke-linejoin="round"/>`;
      s += `<polyline points="${P([[gevel, voor(gevel) + 0.3], [gevel, top - 0.4]])}" fill="none" stroke="#a9e6ff" stroke-width="3" stroke-linecap="round"/>`;
    }
    s += `<text x="${m}" y="${h - 2}" font-family="Figtree, sans-serif" font-size="9.5" font-weight="700" fill="rgb(255 255 255 / 0.4)">STRAAT</text><text x="${w - m}" y="${h - 2}" text-anchor="end" font-family="Figtree, sans-serif" font-size="9.5" font-weight="700" fill="rgb(255 255 255 / 0.4)">TUIN</text>`;
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${s}</svg>`;
  }

  /* ---------------------------------------------------------- het blad */

  const rij = (o) => `<button type="button" class="ht-rij${o.aan ? ' aan' : ''}"${o.mist ? ' style="border: 1px dashed rgb(111 211 255 / 0.6); background: rgb(111 211 255 / 0.08)"' : ''}>${o.ik ? `<span class="ik">${ik(o.ik)}</span>` : ''}<span class="t"><b>${esc(o.titel)}</b>${o.zin ? `<small>${esc(o.zin)}</small>` : ''}</span>${o.rechts ? `<em>${esc(o.rechts)}</em>` : ''}</button>`;
  const dak = `<h4 class="ht-dakkop">Het dak<button type="button" class="ht-dakknop">Nok draaien</button></h4><div class="ht-twee vier">${['Zadeldak', 'Schilddak', 'Lessenaar', 'Plat dak'].map((x, i) => `<button type="button" class="ht-klein${i === 0 ? ' aan' : ''}">${x}</button>`).join('')}</div>`;
  const stapper = (titel, waarde) => `<div class="dk-stap"><span>${titel}</span><button type="button" aria-label="Kleiner">−</button><b>${waarde}</b><button type="button" aria-label="Groter">+</button></div>`;

  function blad(tel) {
    if (stand === 'kies') {
      const kantKnop = (kant, titel, zin, aan) => `<button type="button" class="dk-kant${aan ? ' aan' : ''}" aria-pressed="${aan}">${doorsnede(kant, 'zolder', tel ? [130, 70] : [118, 64])}<b>${titel}</b><small>${zin}</small></button>`;
      return `<header><h3>Dakkapel erbij</h3><span>zolder</span></header>
        <p class="ht-zin">Kies de kant en de etage. Daarna schuif je hem op zijn plek en trek je hem breder of smaller, zoals een kamer.</p>
        <h4 class="ht-dakkop">Aan welke kant</h4>
        <div class="dk-kanten">${kantKnop('voor', 'Voorkant', 'aan de straat', false)}${kantKnop('achter', 'Achterkant', 'aan de tuin', true)}</div>
        <h4 class="ht-dakkop">Op welke etage</h4>
        <div class="ht-twee twee"><button type="button" class="ht-klein aan">Zolder</button><button type="button" class="ht-klein">1e</button></div>
        <p class="ht-zin" style="margin-top: 2px">De etages onder het schuine dak. Een dakkapel op de 1e komt alleen voor als het dak laag begint.</p>
        <div class="dk-knoppen"><button type="button" class="knop">Annuleren</button><button type="button" class="knop knop-licht">Neerzetten</button></div>`;
    }
    if (KAPEL) {
      const uitKaart = KAPEL.bron === 'kaart';
      return `<header><h3>Dakkapel</h3><span>${nl(KAPEL.tot - KAPEL.van)} × ${nl(KAPEL.diep)} m</span></header>
        <div class="dk-door">${doorsnede('achter', 'zolder', tel ? [300, 128] : [270, 118])}</div>
        <p class="ht-zin">${uitKaart ? 'Gevonden op de 3D-kaart, op maat gemeten. Klopt hij niet helemaal, schuif hem dan of trek een zijkant.' : 'Zelf neergezet. Sleep hem langs het dak; pak een zijkant om hem breder of smaller te maken.'}</p>
        ${rij({ ik: 'dak', titel: 'Achterkant', zin: 'aan de tuin', rechts: 'Andere kant ›' })}
        ${rij({ ik: 'etages', titel: 'Zolder', zin: 'op welke etage', rechts: 'Wijzig ›' })}
        ${stapper('Breed', `${nl(KAPEL.tot - KAPEL.van)} m`)}
        ${stapper('Diep', `${nl(KAPEL.diep)} m`)}
        ${rij({ ik: 'kruis', titel: 'Weghalen', zin: uitKaart ? 'Komt niet terug van de kaart' : '' })}
        ${uitKaart ? '<p class="ht-voet">Uit 3D BAG: een klein, bijna plat dakvlak aan de tuinkant.</p>' : ''}`;
    }
    return `<header><h3>Het dak</h3><span>zadeldak · nok 9,1 m</span></header>
      <p class="ht-zin">Op de zolder: wat lager is dan 1,5 m staat gestreept; daar kun je niet staan.</p>
      ${dak.replace('<h4 class="ht-dakkop">Het dak', '<h4 class="ht-dakkop">Vorm van het dak')}
      ${rij({ ik: 'dak', titel: 'Dakkapel erbij', zin: 'Een kast op het dak, met een raam', rechts: '+', mist: true })}`;
  }

  const UITLEG = {
    zonder: 'Het dak van boven op de zolder. Een dakkapel zet je erbij in het blad.',
    kies: 'Kies in het blad aan welke kant de dakkapel komt.',
    gekozen: 'Sleep de dakkapel langs het dak. Pak een zijkant om hem breder of smaller te maken.',
    kaart: 'De 3D-kaart vond een dakkapel. Klopt hij niet, schuif hem of trek een zijkant.',
  };

  function start(tel) {
    const svg = $('tekening');
    const teken = () => plattegrond(svg, !tel);
    teken();
    addEventListener('resize', teken);
    $('blad').innerHTML = blad(tel);
    $('uitleg').innerHTML = `${WIJS}<span>${esc(UITLEG[stand] ?? UITLEG.zonder)}</span>`;
    const v = $('vraag');
    if (stand === 'kaart') {
      v.hidden = false;
      v.innerHTML = `<span class="hb-ik">${ik('dak')}</span><span class="hb-tekst"><b>Een dakkapel op de 3D-kaart</b><span>Aan de achterkant, op de zolder, 2,4 m breed. Klopt dit?</span></span><span class="hb-knoppen"><button type="button">Nee, weghalen</button><button type="button" class="hb-hoofd">Ja</button></span>`;
    }
    document.querySelectorAll('[data-stand]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.stand === 'dak')));
  }

  global.dakkapelSchets = { start };
})(window);
