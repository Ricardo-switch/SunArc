/*
 * Je huis › Vorm: wat voor huis het is (schets, 20 november 2026, stap 4
 * punt 3, ronde 1). Tot nu toe vroeg alleen Inrichten het soort woning, met
 * vijf tegels; Je huis kende het niet. Nu staat het bovenaan het blad van
 * Vorm, met een voorstel uit de kaart: hoeveel muren tegen een buurhuis
 * staan, ziet SunArc aan de gebouwen eromheen (dezelfde gebouwen als de
 * erfgrens, besluit 331 en 0.208.4).
 *
 * Ricardo's huis van boven, de straat onderaan (oost): het hoofdhuis 5,6 m
 * breed en 9,9 m diep, rechts tegen de andere helft (twee-onder-een-kap),
 * links de garage 2,9 × 7,0 m die tegen het huis van de buren aan die kant
 * staat. Een muur tegen de buren staat gestreept in oranje: daar komt geen
 * raam, en later telt hij als warme muur (er verdwijnt minder warmte).
 *
 *   (zonder)      voorstel uit de kaart: twee-onder-een-kap, met Klopt dit?
 *   #gekozen      na Ja: de vijf soorten, de muur rechts gestreept
 *   #appartement  een appartement: op welke verdieping, het balkon, geen eigen dak
 */
(function (global) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ik = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${global.iconen.binnen(n)}</svg>`;
  const WIJS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2"/><path d="M15 11a1.5 1.5 0 0 1 3 0v3.5c0 3.6-2.2 6-5.6 6-2.4 0-3.7-.9-5-2.9L5 14.3c-.6-1 .6-2.2 1.6-1.4L9 15"/></svg>';
  const stand = (location.hash.slice(1) || 'zonder').split('/')[0];
  const flat = stand === 'appartement';
  const OR = '#ffb07a';

  /* ---------------------------------------------------------- de vijf soorten */

  /** Een klein huisje per soort, van voren: het eigen huis licht, de buren grijs. */
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
  const SOORTEN = [
    ['vrijstaand', 'Vrijstaand', 'geen buren tegen'],
    ['tweekap', 'Twee-onder-een-kap', 'één muur tegen'],
    ['hoek', 'Hoekhuis', 'één muur tegen'],
    ['rij', 'Tussenwoning', 'twee muren tegen'],
    ['appartement', 'Appartement', 'in een gebouw'],
  ];
  const nu = flat ? 'appartement' : 'tweekap';
  const tegels = () => `<div class="wn-soorten">${SOORTEN.map(([id, naam, zin]) => `<button type="button" class="wn-soort${id === nu ? ' aan' : ''}" aria-pressed="${id === nu}">${mini(id)}<b>${naam}</b><small>${zin}</small>${id === nu && stand === 'zonder' ? '<i>van de kaart</i>' : ''}</button>`).join('')}</div>`;

  /* ---------------------------------------------------------- de plattegrond */

  function plattegrond(svg, wand) {
    const r = svg.getBoundingClientRect();
    const W = r.width || 600;
    const H = r.height || 500;
    const vraag = stand === 'zonder' && wand ? 84 : 0;
    // u naar rechts, v naar achteren; de straat onderaan. Het hoofdhuis van 0 tot 5,6, de garage links ervan.
    const huis = flat ? { u: 0, v: 0, b: 7.2, d: 11 } : { u: 0, v: 0, b: 5.6, d: 9.9 };
    const garage = flat ? null : { u: -2.9, v: 1.4, b: 2.9, d: 7.0 };
    const links = flat ? -2.6 : -2.9 - 1.6;
    const rechts = huis.b + 2.6;
    const k = Math.min((W - 60) / (rechts - links), (H - 110 - vraag) / (huis.d + 1));
    const x0 = (W - (rechts - links) * k) / 2 - links * k;
    const y0 = (H - huis.d * k) / 2 + 10 + vraag / 2;
    const X = (u) => x0 + u * k;
    const Y = (v) => y0 + (huis.d - v) * k;
    const rect = (q, a) => `<rect x="${X(q.u)}" y="${Y(q.v + q.d)}" width="${q.b * k}" height="${q.d * k}" ${a}/>`;
    let s = `<defs><pattern id="buur" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="rgb(255 176 122 / 0.12)"/><line x1="0" y1="0" x2="0" y2="8" stroke="${OR}" stroke-width="3"/></pattern></defs>`;
    // De buren: alleen een rand, zonder naam of kamers; zo ziet de bewoner waar ze tegenaan staan.
    const buur = (q) => rect(q, 'fill="rgb(255 255 255 / 0.035)" stroke="rgb(255 255 255 / 0.18)" stroke-width="1.5" stroke-dasharray="4 5"');
    if (flat) {
      s += buur({ u: -2.6, v: 0, b: 2.6, d: huis.d });
      s += buur({ u: huis.b, v: 0, b: 2.6, d: huis.d });
    } else {
      s += buur({ u: huis.b, v: 0, b: 2.6, d: huis.d });
      s += buur({ u: links, v: 1.4, b: 1.6, d: 7.0 });
    }
    // Het huis met de kamers van de begane grond zoals ze getekend zijn.
    s += rect(huis, 'fill="rgb(120 190 255 / 0.16)"');
    if (garage) s += rect(garage, 'fill="rgb(160 170 180 / 0.2)"');
    // De muur tegen de buren: gestreept oranje, dik.
    const muur = (u, v0, v1) => `<rect x="${X(u) - 5}" y="${Y(v1)}" width="10" height="${(v1 - v0) * k}" fill="url(#buur)" stroke="${OR}" stroke-width="1.5"/>`;
    s += rect(huis, 'fill="none" stroke="#eef3f7" stroke-width="6"');
    if (garage) s += rect(garage, 'fill="none" stroke="#c9d3dc" stroke-width="4"');
    s += muur(huis.u + huis.b, 0, huis.d);
    if (flat) s += muur(huis.u, 0, huis.d);
    // Een balkon aan de achterkant van het appartement.
    if (flat) s += `<rect x="${X(1.2)}" y="${Y(huis.d + 1.6)}" width="${4.8 * k}" height="${1.6 * k}" rx="3" fill="rgb(110 231 183 / 0.14)" stroke="#6ee7b7" stroke-width="2" stroke-dasharray="6 4"/><text x="${X(3.6)}" y="${Y(huis.d + 0.8) + 4}" text-anchor="middle" font-family="Figtree, sans-serif" font-size="12" font-weight="700" fill="#b6f0d6">Balkon</text>`;
    const tekst = (x, y, t, kleur = 'rgb(255 255 255 / 0.75)', grootte = wand ? 13 : 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="Figtree, sans-serif" font-size="${grootte}" font-weight="700" fill="${kleur}">${esc(t)}</text>`;
    s += tekst(X(huis.u + huis.b / 2), Y(huis.d / 2) + 4, flat ? 'Jouw woning' : 'Huis');
    if (garage) s += tekst(X(garage.u + garage.b / 2), Y(garage.v + garage.d / 2) + 4, 'Garage', 'rgb(255 255 255 / 0.6)');
    // De buren benoemen, en de muur: zo weet de bewoner wat de strepen zijn.
    const buurNaam = (u, v) => tekst(X(u), Y(v), 'buren', 'rgb(255 255 255 / 0.35)', 11);
    s += buurNaam(huis.b + 1.3, huis.d / 2 - 0.6);
    if (flat) s += buurNaam(-1.3, huis.d / 2 - 0.6);
    else s += buurNaam(links + 0.8, 4.9);
    const pil = (x, y, t) => `<g transform="translate(${x} ${y})"><rect x="-58" y="-13" width="116" height="26" rx="9" fill="#0b1424" stroke="${OR}" stroke-width="1.5"/><text y="5" text-anchor="middle" font-family="Figtree, sans-serif" font-size="12.5" font-weight="700" fill="${OR}">${t}</text></g>`;
    if (wand) s += pil(X(huis.b), flat ? Y(0) + 22 : Y(huis.d) - 20, 'tegen de buren');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = s;
  }

  /* ---------------------------------------------------------- het blad */

  const rij = (o) => `<button type="button" class="ht-rij${o.aan ? ' aan' : ''}">${o.ik ? `<span class="ik">${ik(o.ik)}</span>` : ''}<span class="t"><b>${esc(o.titel)}</b>${o.zin ? `<small>${esc(o.zin)}</small>` : ''}</span>${o.rechts ? `<em>${esc(o.rechts)}</em>` : ''}</button>`;
  const stapper = (titel, waarde) => `<div class="dk-stap"><span>${titel}</span><button type="button" aria-label="Lager">−</button><b>${waarde}</b><button type="button" aria-label="Hoger">+</button></div>`;
  const kanten = (aan) => `<div class="ht-twee drie">${['Links', 'Rechts', 'Achter'].map((x) => `<button type="button" class="ht-klein${aan.includes(x) ? ' aan' : ''}" aria-pressed="${aan.includes(x)}">${x}</button>`).join('')}</div>`;

  function blad() {
    if (flat) {
      return `<header><h3>Wat voor huis</h3><span>appartement</span></header>
        ${tegels()}
        ${stapper('Op welke verdieping', '3e')}
        ${stapper('Verdiepingen erboven', '1')}
        <h4 class="ht-dakkop">Tegen de buren</h4>
        ${kanten(['Links', 'Rechts'])}
        ${rij({ ik: 'balkon', titel: 'Balkon', zin: 'aan de achterkant', rechts: 'Wijzig ›' })}
        <p class="ht-zin">Het dak is van het gebouw: Dak staat er dan niet. Zonnepanelen op het gebouw kun je bij Energie nog wel kiezen.</p>
        <p class="ht-voet">Een kaart van één woning in een gebouw is er niet: teken de vorm zelf, of begin met een rechthoek.</p>`;
    }
    return `<header><h3>Wat voor huis</h3><span>twee-onder-een-kap</span></header>
      ${tegels()}
      <h4 class="ht-dakkop">Tegen de buren</h4>
      ${kanten(['Rechts'])}
      <p class="ht-zin">${stand === 'zonder' ? 'Volgens de kaart staat de rechtermuur tegen het huis ernaast.' : 'De rechtermuur staat tegen het huis ernaast.'} Daar komt geen raam, en er gaat minder warmte door weg.</p>
      <h4 class="ht-dakkop">Waar de vorm vandaan komt</h4>
      ${rij({ ik: 'buiten', titel: '3D-kaart', zin: 'het huis, de garage en de buren', rechts: 'Kies ›' })}
      <p class="ht-voet">De garage staat ook tegen een buurhuis. Die telt niet mee: hij is geen woning.</p>`;
  }

  const UITLEG = {
    zonder: 'De kaart ziet een twee-onder-een-kap. Klopt het niet, kies dan in het blad een ander soort.',
    gekozen: 'De muur tegen de buren staat gestreept. Tik op een muur of kies Links, Rechts of Achter om hem te wisselen.',
    appartement: 'Je woning in het gebouw. De muren tegen de buren staan gestreept, het balkon is je plek buiten.',
  };

  function start(tel) {
    const svg = $('tekening');
    const teken = () => plattegrond(svg, !tel);
    teken();
    addEventListener('resize', teken);
    $('blad').innerHTML = blad();
    $('uitleg').innerHTML = `${WIJS}<span>${esc(UITLEG[stand] ?? UITLEG.zonder)}</span>`;
    const v = $('vraag');
    if (stand === 'zonder') {
      v.hidden = false;
      v.innerHTML = `<span class="hb-ik">${ik('thuis')}</span><span class="hb-tekst"><b>Een twee-onder-een-kap volgens de kaart</b><span>De rechtermuur staat tegen het huis ernaast. Klopt dit?</span></span><span class="hb-knoppen"><button type="button">Nee, kies zelf</button><button type="button" class="hb-hoofd">Ja</button></span>`;
    }
    // Een appartement heeft geen eigen dak: de tab Dak staat er niet, en de etages zijn alleen jouw woning en het balkon.
    if (flat) {
      document.querySelector('[data-stand="dak"]')?.remove();
      const stapel = $('stapel');
      if (stapel) stapel.innerHTML = `<div class="wn-gebouw">${['4e', '3e', '2e', '1e', 'Begane grond'].map((x) => `<span class="${x === '3e' ? 'jij' : ''}">${x === '3e' ? '<b>Jouw woning</b><small>3e verdieping</small>' : x}</span>`).join('')}</div><button type="button" class="ht-laag buiten"><b>Balkon</b><small>buiten</small></button>`;
      const etages = document.querySelector('.tk-etages');
      if (etages) etages.innerHTML = '<button type="button" aria-pressed="true">Jouw woning</button><button type="button">Balkon</button>';
      if (etages) etages.style.gridTemplateColumns = '1fr 1fr';
      const seg = document.querySelector('.hm-seg');
      if (seg && tel) seg.style.gridTemplateColumns = 'repeat(4, 1fr)';
    }
    document.querySelectorAll('[data-stand]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.stand === 'vorm')));
  }

  global.woningSchets = { start };
})(window);
