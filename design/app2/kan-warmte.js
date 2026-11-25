/*
 * Schets Wat je huis kan: één straal voor warmte vasthouden (25 november 2026, puntjes van Ricardo voor december).
 * Eerst waren het twee stralen naast elkaar: "Hoe je huis warmte vasthoudt" (thermisch, wat het leert) met als enige
 * knop een sprong naar "Op tijd warm of koel" (wat het ermee doet). Nu is het één straal, Op tijd warm of koel, en
 * het blad zegt beide: per kamer wat het al weet, en wat het daarmee straks doet. Bekijken gaat naar Vandaag, waar
 * het vooruit rekenen te zien is. De waaier heeft zo 18 stralen in plaats van 19.
 * kanWarmte.teken(svg, blad, 'wand' | 'tel')
 */
(function (global) {
  'use strict';
  const r = (id, kort, stand, p) => ({ id, kort, titel: kort, stand, p });
  const GROEPEN = [
    { id: 'gemak', naam: 'Gemak', onderwerpen: [r('licht', 'Licht en scènes', 'werkt', 1), r('screens', 'Screens', 'werkt', 1), r('vraag', 'Vraag het je huis', 'werkt', 1), r('tedoen', 'Te doen', 'werkt', 1), r('camera', "Camera's", 'werkt', 1)] },
    { id: 'overzicht', naam: 'Overzicht', onderwerpen: [r('opbrengst', 'Opbrengst', 'werkt', 1), r('batterijen', 'Batterijen', 'werkt', 1), r('weer', 'Weer en zon', 'werkt', 1)] },
    { id: 'comfort', naam: 'Comfort', onderwerpen: [r('temperatuur', 'Op temperatuur', 'kijkt', 0.8), r('perkamer', 'Per kamer', 'kijkt', 0.8), r('afwezig', 'Afwezig', 'kijkt', 0.8)] },
    { id: 'leert', naam: 'Leert', onderwerpen: [r('optijd', 'Op tijd warm of koel', 'leert', 0.3), r('gevoel', 'Wat je prettig vindt', 'werkt', 1), r('ligging', 'Ligging panelen', 'werkt', 1)] },
    { id: 'zon', naam: 'Op zon', onderwerpen: [r('opzon', 'Koelen op zon', 'kijkt', 0.8), r('apparaten', 'Apparaten op zon', 'kijkt', 0.8)] },
    { id: 'kosten', naam: 'Kosten', onderwerpen: [r('sluip', 'Sluipverbruik', 'werkt', 1), r('zekering', 'Zekering', 'werkt', 1)] },
  ];

  const KAMERS = [
    ['Woonkamer', '0,08° per uur', 'bij 10° buiten · 9 nachten', 'weet'],
    ['Wasruimte', '0,10° per uur', 'bij 10° buiten · 6 nachten', 'weet'],
    ['Badkamer', 'nog 2 nachten', 'de radiatorknop stookte elke nacht', 'leert'],
    ['Slaapkamer', 'doet mee met Wasruimte', '', 'mee'],
  ];

  const blad = () => `<span class="kw-stand"><i></i>Leert nog</span>
    <h2 class="kw-titel">Op tijd warm of koel</h2>
    <p class="kw-zin">Hoe snel elke kamer afkoelt, en wat zon en apparaten doen. Daarmee begint het huis straks precies op tijd.</p>
    <div class="kw-nu"><b>Nu</b> 2 kamers bekend, 1 leert nog · begint zodra het huis het stoken kent</div>
    <div class="kw-twee">
      <section><span class="kw-kop">Wat het al weet</span>
        ${KAMERS.map(([k, w, z, s]) => `<div class="kw-kamer ${s}"><span><b>${k}</b><small>${z}</small></span><em>${s === 'weet' ? `koelt ${w} af` : w}</em></div>`).join('')}
      </section>
      <section><span class="kw-kop">Wat het daarmee doet</span>
        <ul class="kw-punten"><li>Rekent vooruit: wanneer moet de cv aan voor 20° om zeven uur</li><li>Met zon in de verwachting koelt het eerder, op eigen stroom</li><li>Een kamer die het al kent, doet al mee</li></ul>
        <span class="kw-kop">Wat het nog nodig heeft</span>
        <ul class="kw-punten"><li>Nog een paar nachten zonder verwarming of airco in de badkamer</li></ul>
      </section>
    </div>
    <button class="kw-knop">Bekijken</button>`;

  function teken(svg, bladEl, vorm) {
    const maat = vorm === 'tel' ? { cx: 195, cy: 204, r0: 62, R: 178 } : { cx: 370, cy: 392, r0: 88, R: 238, namen: true, groepnamen: true, horizon: 140, ringen: ['gevonden', 'geleerd', 'kijkt mee', 'werkt'] };
    global.waaier.teken(svg, { groepen: GROEPEN, ...maat, getal: '77%', onder: 'zo ver is je huis', gekozen: 'optijd', groei: false, knoppen: false });
    bladEl.innerHTML = blad();
  }

  global.kanWarmte = { teken };
})(window);
