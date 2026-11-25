/*
 * Schets Op zon op één plek (25 november 2026, puntjes van Ricardo voor december; keuze Ricardo: De zon verdelen).
 * Eerst stond op zon op twee soorten plekken: bij elke kamer of elk apparaat zette je het aan (Klimaat › kamer: "Op
 * zon mag het" en de taak "Helpt op zon"; de kaart van witgoed, stekker en boiler), en bij De zon verdelen stonden de
 * volgorde en "Uit de lijst". Nu is De zon verdelen de ene plek: daar zet je iets erbij, haal je het weg, en kies je
 * per kamer hoe ver het op zon mag. Bij de kamer en het apparaat staat alleen nog een regel zonder knop, met een tik
 * hierheen.
 *   (zonder)  de wasruimte open: hoe ver op zon, en de airco alleen op zon
 *   #erbij    Iets erbij zetten open: alles wat op zon kan en nu niet meedoet
 * zonEen.teken(el, 'wand' | 'tel')
 */
(function (global) {
  'use strict';
  const ik = (n) => global.iconen?.svg?.(n) ?? '';
  const erbij = location.hash.slice(1) === 'erbij';

  const LIJST = [
    { id: 'fiets', naam: 'Fietslader', soort: 'Stekker', icoon: 'stekker', vermogen: '120 W gemeten', kw: 0.12, stand: 'zon' },
    { id: 'was', naam: 'Wasruimte', soort: 'Kamer · airco zolder', icoon: 'airco', vermogen: '750 W gemeten', kw: 0.75, stand: 'zon', open: !erbij },
    { id: 'boiler', naam: 'Boiler', soort: 'Boiler', icoon: 'boiler', vermogen: '2,0 kW opgegeven', kw: 1.2, stand: 'zon' },
    { id: 'paal', naam: 'Laadpaal', soort: 'Laadpaal', icoon: 'laadpaal', vermogen: '1,4 tot 11 kW', kw: 0, stand: 'wacht', wachtZin: '0,1 kW te weinig' },
    { id: 'vaat', naam: 'Vaatwasser', soort: 'Witgoed', icoon: 'vaat', vermogen: '1,8 kW gemeten', kw: 0, stand: 'klaar', klaarZin: 'Vandaag al gedraaid' },
  ];
  // Wat op zon kan, maar nu niet meedoet: hier zet je het erbij.
  const KAN = [
    { naam: 'Woonkamer', soort: 'Kamer · airco woonkamer', icoon: 'airco' },
    { naam: 'Wasmachine', soort: 'Witgoed · 2,1 kW', icoon: 'witgoed' },
    { naam: 'Droger', soort: 'Witgoed · 2,4 kW', icoon: 'droger' },
    { naam: 'Jacuzzi', soort: 'Op temperatuur houden', icoon: 'jacuzzi' },
  ];
  const w = (x) => (x < 1 ? `${Math.round(x * 1000)} W` : `${x.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} kW`);

  function stand(x) {
    if (x.stand === 'zon') return `<span class="zv-stand zon">Krijgt zon · ${w(x.kw)}</span>`;
    if (x.stand === 'wacht') return `<span class="zv-stand wacht">Wacht · ${x.wachtZin}</span>`;
    return `<span class="zv-stand klaar">${x.klaarZin}</span>`;
  }

  // Een kamer open: wat er bij een kamer over de zon te kiezen is, staat nu hier (eerst bij Klimaat).
  const kamerBlad = () => `<div class="ze-blad">
      <div class="ze-keuze"><span class="ze-naam">Op zon mag het</span>
        <div class="keuze ze-seg"><button>Niet</button><button>½°</button><button aria-pressed="true">1°</button><button>2°</button></div>
        <small>verder dan je doel, koeler of warmer. Zo bewaart de kamer de zon van de middag voor later.</small></div>
      <div class="ze-keuze rij"><span class="ze-naam">Airco zolder alleen op zon<small>zonder zon houdt de Nest (beneden) de temperatuur</small></span><span class="schakelaar ze-aan" role="switch" aria-checked="true"></span></div>
      <div class="zv-hand"><button class="knop knop-klein">Nu eerst</button><button class="knop knop-klein">Vandaag overslaan</button><button class="knop knop-klein zv-weg">Uit de lijst</button></div>
    </div>`;

  function rij(x, i) {
    return `<li class="zv-rij${x.open ? ' open' : ''}">
      <span class="zv-greep" aria-hidden="true">${ik('greep')}</span>
      <span class="zv-nr">${i + 1}</span>
      <span class="zv-ik">${ik(x.icoon)}</span>
      <span class="zv-tekst"><b>${x.naam}</b><small>${x.soort} · ${x.vermogen}</small></span>
      ${stand(x)}
      ${x.open ? kamerBlad() : ''}
    </li>`;
  }

  const lijst = () => `<section class="zv-lijstvak">
      <div class="zv-lijstkop"><h3 class="kop-3">Wie krijgt de zon</h3><span class="zv-sleep">Sleep om de volgorde te veranderen</span></div>
      <ol class="zv-lijst">${LIJST.map(rij).join('')}</ol>
      <button class="ze-plus${erbij ? ' aan' : ''}">+ Iets erbij zetten</button>
    </section>`;

  const kan = () => `<section class="ze-kan${erbij ? ' open' : ''}">
      <span class="zv-label">Kan op zon, doet nu niet mee</span>
      ${KAN.map((x) => `<div class="ze-kanrij"><span class="zv-ik klein">${ik(x.icoon)}</span><span class="zv-tekst"><b>${x.naam}</b><small>${x.soort}</small></span><button class="knop knop-klein">Erbij</button></div>`).join('')}
      <small class="ze-noot">Uit de lijst gehaald komt hier terug. Een nieuw apparaat dat op zon kan, ook.</small>
    </section>`;

  // Hoe het bij de kamer en het apparaat staat: een regel, geen knop.
  const elders = () => `<section class="ze-elders">
      <span class="zv-label">Bij de kamer en het apparaat</span>
      <div class="ze-voorbeeld"><span class="ze-waar">Klimaat › Wasruimte</span><div class="ze-regel"><span class="zv-stip"></span><span><b>Op zon</b> · 2e in De zon verdelen, 1° verder</span><span class="zv-pijl">›</span></div></div>
      <div class="ze-voorbeeld"><span class="ze-waar">Apparaten › Vaatwasser</span><div class="ze-regel"><span class="zv-stip"></span><span><b>Op zon</b> · 5e in De zon verdelen</span><span class="zv-pijl">›</span></div></div>
      <small class="ze-noot">De taak van een airco wordt Houdt op temperatuur of Doet niet mee. Of hij alleen op zon helpt, kies je hier bij zijn kamer.</small>
    </section>`;

  function teken(el, vorm) {
    el.innerHTML = vorm === 'tel'
      ? `${lijst()}${kan()}${elders()}`
      : `<div class="zv-twee">${lijst()}<div class="zv-rechts">${kan()}${elders()}</div></div>`;
  }

  global.zonEen = { teken };
})(window);
