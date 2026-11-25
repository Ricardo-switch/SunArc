/*
 * Schets Instellingen › Meldingen: kiezen wat er in de bel komt. Alle soorten
 * die de bel kent, in groepen, met een schakelaar per soort. Wat SunArc nodig
 * heeft om veilig te regelen, staat altijd aan. Batterij en filter houden hun
 * grens. Wat je huis niet heeft (geen auto, geen thuisaccu), staat er niet.
 *
 *   meldingenKiezen.teken(el, 'wand' | 'tel')
 */
(function (global) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // [soort, titel, zin, keuze]: true/false is de schakelaar, 'altijd' staat vast aan, een getal is de grens.
  const GROEPEN = [
    ['Veiligheid', [
      ['rook', 'Rook en koolmonoxide', 'een melder gaat af, of zijn batterij is bijna leeg', 'altijd'],
    ]],
    ['Je apparaten', [
      ['nieuw', 'Nieuw in Home Assistant', 'een apparaat dat nog in geen kamer staat', true],
      ['weg', 'Weg uit Home Assistant', 'al tien minuten niet meer te vinden', true],
      ['stil', 'Reageert niet meer', 'een uur onbereikbaar; wat SunArc regelt, altijd', true],
      ['batterij', 'Batterij bijna leeg', 'een sensor, knop of slot', 10],
      ['filter', 'Airco-filter bijna vol', 'tijd om hem schoon te maken', 10],
    ]],
    ['Energie', [
      ['meter', 'Een meter levert niets', 'zonder meter kloppen de cijfers niet', 'altijd'],
      ['sluip', 'Sluipverbruik', 'de ochtend na een nacht met meer dan anders', true],
      ['panelen', 'Panelen en daken', 'de ligging is gemeten, of een dakvlak blijft achter', true],
      ['stekker', 'Slimme stekker gevonden', 'nog niet op zon, of zijn meter staat niet bij Energie', true],
      ['accu', 'Thuisaccu', 'zegt niets meer, een fout, of vol terwijl de zon naar het net gaat', true],
      ['auto', 'De auto', 'vol, een fout, kabel vergeten, met de hand klaar', true],
    ]],
    ['SunArc', [
      ['klopt', 'Iets klopt niet of lukte niet', 'een instelling die niet past, een opdracht die niet aankwam', 'altijd'],
      ['comfort', 'Wiens comfort er geldt', 'als het wisselt naar wie er thuis is', false],
      ['versie', 'Nieuwe versie', 'met wat erin nieuw is', true],
      ['mijlpaal', 'Winterdagen', 'bij 10, 20 en 30 dagen van de wintertest', true],
    ]],
  ];
  const GRENZEN = [[null, 'Nooit'], [5, '5%'], [10, '10%'], [20, '20%'], [30, '30%']];

  function keuze([soort, titel, , k]) {
    if (k === 'altijd') return '<span class="mk-altijd">Altijd</span>';
    if (typeof k === 'number') {
      return `<div class="keuze mk-grens" role="group" aria-label="${esc(titel)} onder">${GRENZEN.map(([w, x]) => `<button type="button" aria-pressed="${w === k}">${esc(x)}</button>`).join('')}</div>`;
    }
    return `<button type="button" class="schakel${k ? ' aan' : ''}" role="switch" aria-checked="${k}" aria-label="${esc(titel)}" data-mk="${soort}"></button>`;
  }

  function rij(r) {
    const grens = typeof r[3] === 'number';
    return `<div class="mk-rij${grens ? ' grens' : ''}${r[3] === false ? ' uit' : ''}"><span><b>${esc(r[1])}</b><small>${esc(r[2])}</small></span>${keuze(r)}</div>`;
  }

  const groep = ([kop, rijen]) => `<section class="mk-groep"><h3>${esc(kop)}</h3>${rijen.map((r) => rij(r)).join('')}</section>`;

  const telefoon = `<a class="mk-tel"><span><b>Op je telefoon</b><small>Standaard rook, als het regelen hapert, sluipverbruik en de auto. Elke bewoner kiest zelf, bij Profiel.</small></span><span class="pijl">›</span></a>`;

  function teken(el, zicht) {
    if (zicht === 'wand') {
      el.innerHTML = `<div class="mk-twee"><div class="mk-kol">${groep(GROEPEN[0])}${groep(GROEPEN[1])}${telefoon}</div><div class="mk-kol">${groep(GROEPEN[2])}${groep(GROEPEN[3])}</div></div>`;
    } else {
      el.innerHTML = `${GROEPEN.map((g) => groep(g)).join('')}${telefoon}`;
    }
    el.addEventListener('click', (e) => {
      const s = e.target.closest('[data-mk]');
      if (s) {
        const aan = s.getAttribute('aria-checked') !== 'true';
        s.setAttribute('aria-checked', String(aan));
        s.classList.toggle('aan', aan);
        s.closest('.mk-rij').classList.toggle('uit', !aan);
      }
      const b = e.target.closest('.mk-grens button');
      if (b) b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
  }

  global.meldingenKiezen = { teken };
})(window);
