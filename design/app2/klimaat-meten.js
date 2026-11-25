/*
 * Schets Klimaat › Meten en regeling (25 november 2026, puntjes van Ricardo voor december). Een eigen deel bij Het
 * hele huis, op de plek van Soort verwarming (die staat alleen nog bij Energie). Alle kamers onder elkaar: waarmee
 * elke kamer zijn temperatuur meet en wie hem regelt, met de zones ingesprongen onder hun kamer. Een tik op een kamer
 * klapt hem open met dezelfde keuzes als nu achter "Meten en regeling" in het blad van een kamer; daar komt die regel
 * te vervallen, zodat het blad van een kamer alleen nog zegt hoe warm en wat ervoor zorgt.
 *   (zonder)  de lijst          #kamer  de woonkamer open, met zijn meters en de regeling: op de wand de lijst
 *             smal links en de keuzes ernaast (de wand scrolt nooit), op de telefoon open onder de kamer
 * klimaatMeten.teken(el, 'wand' | 'tel')
 */
(function (global) {
  'use strict';
  const ik = (n) => global.iconen?.svg?.(n) ?? '';
  const open = location.hash.slice(1) === 'kamer';

  // regeling: eigen (met het apparaat dat regelt), mee (doet mee met), geen.
  const KAMERS = [
    { id: 'was', naam: 'Wasruimte', icoon: 'kamer', temp: '19,9°', meet: ['Airco zolder', 'Bewegingssensor zolder'], regeling: { soort: 'eigen', met: 'Airco zolder' } },
    { id: 'bad', naam: 'Badkamer', icoon: 'badkamer', temp: '21,4°', meet: ['Radiatorknop badkamer'], regeling: { soort: 'eigen', met: 'Radiatorknop badkamer' } },
    {
      id: 'woon', naam: 'Woonkamer', icoon: 'woonkamer', temp: '20,2°', meet: ['Nest (beneden)', 'Airco woonkamer'], gemiddelde: true, regeling: { soort: 'eigen', met: 'Nest (beneden)' },
      zones: [
        { naam: 'Zithoek', temp: '19,7°', zin: 'meet met Airco woonkamer · met de kamer mee' },
        { naam: 'Keuken', temp: '20,7°', zin: 'meet met Radiatorknop keuken · met de kamer mee' },
      ],
    },
    { id: 'slaap', naam: 'Slaapkamer', icoon: 'slaapkamer', temp: '17,8°', meet: ['Thermometer slaapkamer'], regeling: { soort: 'mee', met: 'Wasruimte' } },
    { id: 'kind', naam: 'Kinderkamer', icoon: 'kinderkamer', temp: '18,6°', meet: ['Thermometer kinderkamer'], regeling: { soort: 'geen' } },
    { id: 'hobby', naam: 'Hobbykamer', icoon: 'werkkamer', temp: null, meet: [], regeling: { soort: 'geen' } },
    { id: 'hal', naam: 'Hal', icoon: 'hal', temp: '18,9°', meet: ['Bewegingssensor hal'], regeling: { soort: 'geen' } },
  ];

  const regelPil = (r) =>
    r.soort === 'eigen' ? `<span class="km-pil eigen">Eigen regeling · ${r.met}</span>`
      : r.soort === 'mee' ? `<span class="km-pil mee">Doet mee met ${r.met}</span>`
        : '<span class="km-pil geen">Niet geregeld</span>';

  function editor(k) {
    // Dezelfde keuzes als nu achter Meten en regeling in het blad van de kamer (warmte.js), op één regel per keuze.
    const meters = [['Nest (beneden)', '19,8°', true], ['Airco woonkamer', '20,5°', true], ['Radiatorknop keuken', '21,5°', false], ['Schakelaar screen groot', '21,6°', false], ['Schakelaar screen klein', '17°', false]];
    return `<div class="km-open">
      <div class="km-keuze"><span class="zv-label">Meten met</span>
        <div class="km-chips">${meters.map(([n, t, aan]) => `<button class="km-chip${aan ? ' aan' : ''}">${n} · ${t}</button>`).join('')}<button class="km-chip plus">Sensor uit een andere kamer…</button></div>
        <small>Twee meters gekozen: het gemiddelde telt meteen voor de regeling.</small></div>
      <div class="km-keuze"><span class="zv-label">Wie regelt hem</span>
        <div class="keuze km-seg"><button aria-pressed="true">Eigen regeling</button><button>Doet mee met…</button><button>Niet geregeld</button></div>
        <small>De Nest (beneden) regelt de woonkamer; de airco helpt mee.</small></div>
      <div class="km-keuze"><span class="zv-label">Zones</span>
        ${k.zones.map((z) => `<div class="km-zone"><b>${z.naam}</b><span>${z.zin.replace(' · met de kamer mee', '')}</span><div class="keuze km-seg klein"><button aria-pressed="true">Met de kamer mee</button><button>Eigen regeling</button></div></div>`).join('')}</div>
    </div>`;
  }

  function rij(k, naast = false) {
    const isOpen = open && k.id === 'woon';
    const meet = k.meet.length ? k.meet.join(', ') + (k.gemiddelde ? ' · gemiddelde' : '') : 'geen thermometer';
    const zones = (k.zones ?? []).map((z) => `<li class="km-rij sub"><span class="km-lijn"></span><span class="km-tekst"><b>${z.naam}</b><small>${z.zin}</small></span><span class="km-temp">${z.temp}</span><span></span><span class="km-pijl"></span></li>`).join('');
    return `<li class="km-rij${isOpen ? ' open' : ''}${k.meet.length ? '' : ' mist'}">
        <span class="zv-ik">${ik(k.icoon)}</span>
        <span class="km-tekst"><b>${k.naam}</b><small${k.meet.length ? '' : ' class="let"'}>${meet}</small></span>
        <span class="km-temp">${k.temp ?? '–'}</span>
        ${regelPil(k.regeling)}
        <span class="km-pijl">${isOpen ? (naast ? '' : '⌃') : '›'}</span>
        ${isOpen && !naast ? editor(k) : ''}
      </li>${isOpen || naast ? '' : zones}`;
  }

  function samen() {
    const eigen = KAMERS.filter((k) => k.regeling.soort === 'eigen').length;
    const mee = KAMERS.filter((k) => k.regeling.soort === 'mee').length;
    const zonder = KAMERS.filter((k) => !k.meet.length).length;
    return `<div class="km-samen"><span><i class="eigen"></i><b>${eigen}</b> met een eigen regeling</span><span><i class="mee"></i><b>${mee}</b> doet mee</span><span><i class="geen"></i><b>${KAMERS.length - eigen - mee}</b> niet geregeld</span>${zonder ? `<span class="let">${zonder} zonder thermometer</span>` : ''}</div>`;
  }

  function teken(el, vorm) {
    if (open && vorm === 'wand') {
      const k = KAMERS.find((x) => x.id === 'woon');
      el.innerHTML = `<div class="km-twee"><ol class="km-lijst smal">${KAMERS.map((x) => rij(x, true)).join('')}</ol>
        <section class="km-blad"><div class="km-bladkop"><b>${k.naam}</b><span class="km-temp">${k.temp}</span><button class="km-sluit" aria-label="Sluiten">×</button></div>${editor(k)}</section></div>`;
      return;
    }
    el.innerHTML = `${samen()}
      <ol class="km-lijst${vorm === 'tel' ? ' smaltel' : ''}">${KAMERS.map((x) => rij(x)).join('')}</ol>
      <p class="zv-noot">Wat een kamer meet, zie je op Thuis en in de kamer. Wat hem regelt, krijgt een doel en tijden bij die kamer.</p>`;
  }

  global.klimaatMeten = { teken };
})(window);
