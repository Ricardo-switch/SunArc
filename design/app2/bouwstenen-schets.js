/*
 * Schets Bouwstenen (24 november 2026, kwaliteitsronde stap 4 punt 8: één opmaak uit vaste bouwstenen).
 *
 * Per bouwsteen de varianten van nu, met de pagina waar ze staan (gemeten uit frontend/src/*.html), en één voorstel.
 * Het voorstel wordt na de keuze één keer gebouwd in kit/kit.css; de pagina's halen hun eigen kopie weg.
 * bouwstenen.teken(el, 'wand' | 'tel') tekent de kaarten.
 */
(function (global) {
  'use strict';

  // De schakelaar: [pagina, breed, hoog, knop, kleur aan]
  const SCHAKEL_NU = [
    ['Klimaat', 36, 20, 16, 'var(--gloed)'],
    ['Inrichten, Sluipverbruik', 42, 26, 20, 'var(--mint)'],
    ['Apparaten', 44, 26, 20, 'var(--mint)'],
    ['Jij', 46, 28, 22, 'var(--accent)'],
    ['Kamer', 50, 30, 24, '#f2c27a'],
  ];
  // Het invoerveld: [pagina, hoog, tekst]
  const VELD_NU = [
    ['Inrichten', 38, 14],
    ['Bewoners', 46, 16],
    ['Welkom', 48, 17],
  ];
  // Keuze in delen: [pagina, hoog, gekozen]
  const SEG_NU = [
    ['Inrichten', 32, 'zacht'],
    ['Bewoners', 38, 'zacht'],
    ['Toevoegen', 38, 'wit'],
  ];
  // De kaart: [pagina, binnenrand, ronding]
  const KAART_NU = [
    ['Thuis, Opbrengst', '18 · 20', 24],
    ['Vandaag', '18 · 22', 24],
    ['Auto', '20 · 22', 24],
    ['Inrichten, Welkom', '26 · 28', 24],
  ];
  // De titel: [pagina, grootte]
  const KOP_NU = [
    ['Welkom, Inloggen (telefoon)', 30],
    ['Auto (telefoon)', 34],
    ['Inloggen', 36],
    ['Wandpagina’s', 46],
  ];

  const kaart = (titel, nu, voorstel, noot) => `<section class="glas bs">
    <h3 class="kop-3">${titel}</h3>
    <div class="bs-label">Nu</div>
    <div class="bs-nu">${nu}</div>
    <div class="bs-label voor">Voorstel</div>
    <div class="bs-voor">${voorstel}</div>
    ${noot ? `<p class="bs-noot">${noot}</p>` : ''}
  </section>`;

  const schakel = (b, h, k, kleur, aan) => `<span class="bs-schakel" style="width:${b}px;height:${h}px;background:${aan ? kleur : 'rgb(var(--wit) / 0.14)'}"><i style="width:${k}px;height:${k}px;top:${(h - k) / 2}px;left:${aan ? b - k - (h - k) / 2 : (h - k) / 2}px"></i></span>`;
  const varianten = (rijen, maak) => rijen.map((r) => `<div class="bs-rij">${maak(r)}<small>${r[0]}</small></div>`).join('');

  function teken(el, vorm) {
    const tel = vorm === 'tel';
    const delen = [
      kaart('Schakelaar',
        varianten(SCHAKEL_NU, ([, b, h, k, kleur]) => `<span class="bs-paar">${schakel(b, h, k, kleur, false)}${schakel(b, h, k, kleur, true)}</span><b>${b}×${h}</b>`),
        `<div class="bs-rij"><span class="bs-paar">${schakel(44, 26, 20, 'var(--mint)', false)}${schakel(44, 26, 20, 'var(--mint)', true)}</span><b>44×26</b><small>A · aan is altijd mint</small></div>
         <div class="bs-rij onder"><span class="bs-paar">${schakel(44, 26, 20, 'var(--gloed)', true)}${schakel(44, 26, 20, 'var(--ijs)', true)}${schakel(44, 26, 20, 'var(--zon)', true)}</span><small>B · aan in de kleur van wat hij doet</small></div>`,
        'Overal dezelfde maat, ook op de telefoon.'),
      kaart('Invoerveld',
        varianten(VELD_NU, ([, h, t]) => `<span class="bs-veld" style="height:${h}px;font-size:${t}px">Kantoor</span><b>${h}</b>`),
        `<div class="bs-rij"><span class="bs-veld" style="height:${tel ? 46 : 44}px;font-size:${tel ? 16 : 15}px">Kantoor</span><b>${tel ? 46 : 44}</b><small>gewoon</small></div>
         <div class="bs-rij"><span class="bs-veld" style="height:34px;font-size:13px">Kantoor</span><b>34</b><small>klein, in een regel</small></div>`,
        tel ? 'Op de telefoon 16 punten tekst: dan zoomt een iPhone niet in bij het typen.' : 'Op de telefoon 46 hoog en 16 punten tekst.'),
      kaart('Keuze in delen',
        varianten(SEG_NU, ([, h, g]) => `<span class="bs-seg" style="--h:${h}px"><span class="${g === 'wit' ? 'wit' : 'aan'}">Uit</span><span>Aan</span><span>Vanzelf</span></span>`),
        `<div class="bs-rij"><span class="bs-seg" style="--h:36px"><span class="aan">Uit</span><span>Aan</span><span>Vanzelf</span></span><small>A · gekozen zacht wit</small></div>
         <div class="bs-rij"><span class="bs-seg" style="--h:36px"><span class="wit">Uit</span><span>Aan</span><span>Vanzelf</span></span><small>B · gekozen helder</small></div>`,
        '36 hoog; een kleinere 30 in een regel.'),
      kaart('Knoppen',
        `<div class="bs-rij"><span class="knop bs-knop">Knop</span><b>46</b><small>kit</small></div>
         <div class="bs-rij"><span class="bs-knopje">Knopje</span><b>34</b><small>Wat je huis kan</small></div>
         <div class="bs-rij"><span class="bs-chip">Chip</span><b>34</b><small>Inrichten</small></div>`,
        `<div class="bs-rij bs-knoppen"><span class="knop knop-licht bs-knop">Bewaren</span><span class="knop bs-knop">Annuleren</span></div>
         <div class="bs-rij bs-knoppen"><span class="bs-knopje">Aanzetten</span><span class="bs-chip">+ Kamer</span><span class="knop-tekst">Uitleg</span></div>`,
        'Vier soorten: hoofdknop, knop (46), klein (34) en tekst.'),
      kaart('Kaart',
        varianten(KAART_NU, ([, rand, r]) => `<span class="bs-kaart" style="border-radius:${Math.round(r / 2)}px">${rand}</span>`),
        `<div class="bs-rij"><span class="bs-kaart voor" style="border-radius:12px">${tel ? '16' : '18 · 20'}</span><small>${tel ? 'telefoon: 16 rondom, ronding 20' : 'wand: 18 boven en onder, 20 opzij, ronding 24'}</small></div>`,
        tel ? 'Op de wand 18 · 20, ronding 24.' : 'Op de telefoon 16 rondom, ronding 20.'),
      kaart('Titel van een pagina',
        varianten(KOP_NU, ([, g]) => `<span class="bs-kop" style="font-size:${Math.round(g / 2)}px">Aa</span><b>${g}</b>`),
        `<div class="bs-rij"><span class="bs-terug">‹ Instellingen</span></div>
         <div class="bs-rij"><span class="bs-kop" style="font-size:${tel ? 30 : 23}px">Klimaat</span><b>${tel ? 30 : 46}</b>${tel ? '' : '<small>hier op halve grootte, net als boven</small>'}</div>`,
        tel ? 'Op de wand 46. De terugregel 14 punten, altijd boven de titel.' : 'Op de telefoon 30. De terugregel 14 punten, altijd boven de titel.'),
      kaart('Foutregel',
        `<div class="bs-rij"><span class="bs-fout" style="font-size:13px">Dat lukte niet.</span><b>13</b><small>Bewoners, Welkom</small></div>
         <div class="bs-rij"><span class="bs-fout" style="font-size:13.5px">Dat lukte niet.</span><b>13,5</b><small>Toevoegen</small></div>
         <div class="bs-rij"><span class="bs-fout" style="font-size:14px;font-weight:600">Dat lukte niet.</span><b>14</b><small>Begin</small></div>`,
        `<div class="bs-rij"><span class="bs-fout voor">Dat lukte niet. Probeer het zo nog eens.</span></div>`,
        '13,5 punten, oranje, altijd onder wat misging.'),
      kaart('Ruimte',
        `<div class="bs-rij"><b class="bs-groot">250</b><small>keer een eigen marge in de scripts (style="margin…")</small></div>
         <div class="bs-rij"><b class="bs-groot">676</b><small>regels met een vaste kleur in plaats van het thema</small></div>`,
        `<div class="bs-rij bs-maten">${[4, 8, 12, 16, 24].map((m) => `<span><i style="height:${m}px"></i>${m}</span>`).join('')}</div>`,
        'Vijf vaste afstanden tussen dingen, en elke kleur uit het thema.'),
    ];
    el.innerHTML = delen.join('');
  }

  global.bouwstenen = { teken };
})(window);
