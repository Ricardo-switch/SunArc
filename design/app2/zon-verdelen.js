/*
 * Schets De zon verdelen (24 november 2026, stap 4 punt 7, issue 137). Eén lijst voor wie de zon krijgt die over is:
 * kamers, boiler, laadpaal, stekkers en witgoed, in de volgorde die de bewoner sleept. Per apparaat het vermogen,
 * gemeten of opgegeven; één marge voor het hele huis; met de hand Nu eerst, Vandaag overslaan en Uit de lijst. Op
 * Thuis zegt de strook wie de zon nu krijgt en wie daarna.
 *   (zonder)  middag, 2,4 kW over: de fietslader staat even eerst, airco en boiler krijgen zon, de laadpaal wacht
 *   #weinig   bewolkt, 0,5 kW over: alleen de fietslader en de airco
 * zonVerdelen.teken(el, 'wand' | 'tel')
 */
(function (global) {
  'use strict';
  const ik = (n) => global.iconen?.svg?.(n) ?? '';
  const weinig = location.hash.slice(1) === 'weinig';

  // De lijst, in volgorde. kw: wat hij nu krijgt; vraagt: wat hij nodig heeft om aan te gaan.
  const LIJST = [
    { id: 'fiets', naam: 'Fietslader', soort: 'Stekker', icoon: 'stekker', vermogen: '120 W gemeten', kw: 0.12, eerst: 'Nu eerst · tot hij vol is', stand: 'zon' },
    { id: 'woon', naam: 'Airco woonkamer', soort: 'Kamer', icoon: 'airco', vermogen: '800 W gemeten', kw: weinig ? 0.38 : 0.8, stand: 'zon', open: true },
    { id: 'boiler', naam: 'Boiler', soort: 'Boiler', icoon: 'boiler', vermogen: '2,0 kW opgegeven', kw: weinig ? 0 : 1.2, stand: weinig ? 'wacht' : 'zon', wachtZin: '1,5 kW te weinig' },
    { id: 'paal', naam: 'Laadpaal', soort: 'Laadpaal', icoon: 'laadpaal', vermogen: '1,4 tot 11 kW', kw: 0, stand: 'wacht', wachtZin: weinig ? '0,9 kW te weinig' : '0,1 kW te weinig' },
    { id: 'was', naam: 'Wasmachine', soort: 'Witgoed', icoon: 'witgoed', vermogen: '2,1 kW gemeten', kw: 0, stand: 'klaar', klaarZin: 'Vandaag al gedraaid' },
    { id: 'zolder', naam: 'Airco zolder', soort: 'Kamer', icoon: 'airco', vermogen: '750 W gemeten', kw: 0, stand: 'over', overZin: 'Vandaag overgeslagen' },
  ];
  const UIT = [{ naam: 'Jacuzzi', soort: 'Jacuzzi', icoon: 'jacuzzi' }];
  const OVER = weinig ? 0.5 : 2.4;
  const KLEUR = { fiets: 'var(--violet)', woon: 'var(--ijs)', boiler: 'var(--zon)', paal: 'var(--mint)' };
  const kw = (x) => `${x.toLocaleString('nl-NL', { maximumFractionDigits: 1, minimumFractionDigits: x < 1 && x > 0 ? 1 : 0 })} kW`;
  const w = (x) => (x < 1 ? `${Math.round(x * 1000)} W` : kw(x));

  function balk() {
    const krijgt = LIJST.filter((x) => x.kw > 0);
    const gebruikt = krijgt.reduce((s, x) => s + x.kw, 0);
    const rest = Math.max(0, OVER - gebruikt);
    const stukken = krijgt.map((x) => `<i style="flex: ${x.kw}; background: ${KLEUR[x.id]}" title="${x.naam}"></i>`).join('') + (rest > 0.05 ? `<i class="rest" style="flex: ${rest}"></i>` : '');
    const namen = krijgt.map((x) => `<span><i style="background: ${KLEUR[x.id]}"></i>${x.naam} <b>${w(x.kw)}</b></span>`).join('') + (rest > 0.05 ? `<span><i class="rest"></i>Nog over <b>${w(rest)}</b></span>` : '');
    const wacht = LIJST.find((x) => x.stand === 'wacht');
    return `<section class="zv-nu">
      <div class="zv-nukop"><span class="zv-label">Nu over</span><b class="zv-over">${kw(OVER)}</b><span class="zv-wacht">${wacht ? `${wacht.naam === 'Boiler' ? 'De boiler' : `De ${wacht.naam.toLowerCase()}`} is de volgende: ${wacht.wachtZin}` : ''}</span></div>
      <div class="zv-balk">${stukken}</div>
      <div class="zv-namen">${namen}</div>
    </section>`;
  }

  function stand(x) {
    if (x.stand === 'zon') return `<span class="zv-stand zon">Krijgt zon · ${w(x.kw)}</span>`;
    if (x.stand === 'wacht') return `<span class="zv-stand wacht">Wacht · ${x.wachtZin}</span>`;
    if (x.stand === 'klaar') return `<span class="zv-stand klaar">${x.klaarZin}</span>`;
    return `<span class="zv-stand over">${x.overZin}</span>`;
  }

  function rij(x, i) {
    const hand = x.open
      ? `<div class="zv-hand"><button class="knop knop-klein">Nu eerst</button><button class="knop knop-klein">Vandaag overslaan</button><button class="knop knop-klein zv-weg">Uit de lijst</button></div>`
      : '';
    return `<li class="zv-rij${x.open ? ' open' : ''}${x.stand === 'over' ? ' gedimd' : ''}">
      <span class="zv-greep" aria-hidden="true">${ik('greep')}</span>
      <span class="zv-nr">${i + 1}</span>
      <span class="zv-ik">${ik(x.icoon)}</span>
      <span class="zv-tekst"><b>${x.naam}</b><small>${x.soort} · ${x.vermogen}</small>${x.eerst ? `<em class="zv-eerst">${x.eerst}</em>` : ''}</span>
      ${stand(x)}
      ${hand}
    </li>`;
  }

  const uit = () => `<section class="zv-uit"><span class="zv-label">Doet niet mee</span>${UIT.map((x) => `<span class="zv-uitrij"><span class="zv-ik klein">${ik(x.icoon)}</span>${x.naam}<button class="knop-tekst">Terug in de lijst</button></span>`).join('')}</section>`;

  function lijst(metUit) {
    return `<section class="zv-lijstvak">
      <div class="zv-lijstkop"><h3 class="kop-3">Wie krijgt de zon</h3><span class="zv-sleep">Sleep om de volgorde te veranderen</span></div>
      <ol class="zv-lijst">${LIJST.map(rij).join('')}</ol>
      ${metUit ? uit() : ''}
    </section>`;
  }

  function stapper(label, waarde, uitleg) {
    return `<div class="zv-stap"><span class="zv-stapnaam">${label}</span><span class="zv-stapper"><button aria-label="minder">−</button><b>${waarde}</b><button aria-label="meer">+</button></span><small>${uitleg}</small></div>`;
  }

  function marge() {
    return `<section class="zv-marge">
      <h3 class="kop-3">De marge</h3>
      ${stapper('Pas aan bij', '200 W extra', 'Zoveel moet er meer over zijn dan een apparaat vraagt.')}
      ${stapper('Minstens aan en uit', '10 minuten', 'Zo laat een wolk niet alles aan en uit gaan.')}
      <p class="zv-noot">Voor het hele huis. Het vermogen per apparaat is gemeten waar een meter is; anders vul je het in bij het apparaat.</p>
    </section>`;
  }

  function thuis() {
    return `<section class="zv-thuis">
      <span class="zv-label">Op Thuis, in de strook</span>
      <div class="zv-strook"><span class="zv-stip"></span><span>${weinig ? 'De zon gaat nu naar de fietslader en de airco woonkamer, daarna de boiler' : 'De zon gaat nu naar de fietslader, de airco woonkamer en de boiler, daarna de laadpaal'}</span><span class="zv-pijl">›</span></div>
      <small>Een tik opent dit blad. Comfort gaat altijd voor: de zon verdelen gaat over wat er daarna nog over is.</small>
    </section>`;
  }

  function teken(el, vorm) {
    el.innerHTML = vorm === 'tel'
      ? `${balk()}${lijst(true)}${marge()}${thuis()}`
      : `${balk()}<div class="zv-twee">${lijst(false)}<div class="zv-rechts">${marge()}${thuis()}${uit()}</div></div>`;
  }

  global.zonVerdelen = { teken };
})(window);
