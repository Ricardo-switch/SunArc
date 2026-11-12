/*
 * Een zone apart regelen (schets, 12 november 2026). De woonkamer is één
 * ruimte met twee zones, Zithoek en Keuken, elk met een radiator en een slimme
 * radiatorknop. Met een eigen regeling heeft elke zone een eigen doel en eigen
 * tijden; de keuken kan uit terwijl de zithoek warm blijft. De inhoud voor
 * Wand-Zones en Tel-Zones.
 *
 * Standen (de hash van de pagina):
 *   (zonder)   het blad van de woonkamer: per zone de temperatuur, het doel en de knop
 *   #zone      een tik op de keuken: het blad van die zone, met de hand
 *   #indeling  Kamers en indeling › Woonkamer › Verwarmen en koelen: per zone eigen of met de kamer
 *   #comfort   Comfort: de woonkamer in twee regels, een per zone
 */
(function (global) {
  'use strict';

  const ik = (naam) => global.iconen.svg(naam);

  /** De begane grond, met de woonkamer in twee zones. */
  function model() {
    return {
      tijd: 'avond',
      zonderDak: true,
      etages: [{
        naam: 'Begane grond',
        kamers: [
          { naam: 'Woonkamer', gewicht: 1.6, temp: '20,6°', zin: 'twee zones', gekozen: true, zones: ['Zithoek 20,6°', 'Keuken 18,9°'], apparaten: [{ soort: 'bank' }, { soort: 'lamp', aan: true, x: 0.25 }, { soort: 'radiator', x: 0.2 }, { soort: 'radiator', x: 0.8 }] },
          { naam: 'Hal', gewicht: 0.6, temp: '18,4°', apparaten: [] },
        ],
      }],
    };
  }

  /** Het blad van de woonkamer, met per zone een eigen regel. */
  function kamerBlad() {
    const zone = (naam, temp, zin, kleur, knop, knopZin) => `
      <div class="zgroep">
        <div class="zkop"><b>${naam}</b><span class="ztemp">${temp}</span><span class="zstand" style="color: ${kleur}">${zin}</span></div>
        <div class="zrij"><span class="zik">${ik('verwarming')}</span><div><b>${knop}</b><small>${knopZin}</small></div><span class="pijl">›</span></div>
      </div>`;
    return `<div class="bkop"><h2>Woonkamer</h2><p>Twee zones, elk een eigen regeling</p></div>
      <h3 class="bh3">Klimaat</h3>
      ${zone('Zithoek', '20,6°', 'verwarmt naar 21°', 'var(--gloed-t, #ff9d6e)', 'Radiatorknop zithoek', 'verwarmt, klep 60% open')}
      ${zone('Keuken', '18,9°', 'uit tot 17:00', 'var(--gedempt)', 'Radiatorknop keuken', 'uit, met de hand')}
      <h3 class="bh3">Licht</h3>
      <div class="zrij dim"><span class="zik">${ik('lamp')}</span><div><b>Plafondlamp zithoek</b><small>aan</small></div><span class="zschakel"></span></div>
      <h3 class="bh3">Hoe voelt het hier?</h3>
      <div class="zgevoel"><span>Te koud</span><span>Goed</span><span>Te warm</span></div>`;
  }

  /** Het blad van de keuken: met de hand een doel of uit, tot een tijd. */
  function zoneBlad() {
    return `<div class="bkop"><div><h2>Keuken</h2><p>Zone in de woonkamer · 18,9° · radiatorknop keuken</p></div><span class="sluit">×</span></div>
      <div class="zwijzer"><span class="zknop">−</span><div class="zdoel"><b>Uit</b><small>nu 18,9°</small></div><span class="zknop">+</span></div>
      <div class="zseg"><span>Verwarmen</span><span class="aan">Uit</span></div>
      <div class="zvraag"><span>Hoe lang</span><div class="zseg klein"><span>1 uur</span><span>2 uur</span><span class="aan">Tot 17:00</span></div></div>
      <div class="zhoe">De keuken heeft een eigen regeling. Uit tot 17:00; daarna weer zoals bij Comfort, 20° tot 22:00. De zithoek blijft op 21°.</div>
      <div class="zonder"><span class="zterug">Naar Comfort</span><span class="zzet">Zet uit tot 17:00</span></div>`;
  }

  /** Kamers en indeling › Woonkamer › Verwarmen en koelen: per zone met de kamer of een eigen regeling. */
  function indeling() {
    const zone = (naam, knop, eigen, open = true) => !open ? `
      <div class="izone dicht"><div class="izkop"><b>${naam}</b><span>${knop} · eigen regeling · meet met de knop · 19° tot 22:00</span></div><span class="pijl">›</span></div>` : `
      <div class="izone">
        <div class="izkop"><b>${naam}</b><span>Radiator · slimme radiatorknop</span></div>
        <div class="irij"><span class="zik">${ik('verwarming')}</span><div><b>${knop}</b><small>gevonden in Home Assistant</small></div></div>
        <div class="ivraag"><span>Regeling</span><div class="zseg"><span${eigen ? '' : ' class="aan"'}>Met de kamer</span><span${eigen ? ' class="aan"' : ''}>Eigen regeling</span></div></div>
        ${eigen ? `<div class="irij link"><div><b>Meten met</b><small>de knop zelf (${knop.toLowerCase()})</small></div><span class="pijl">›</span></div>
        <div class="irij link"><div><b>Doel en tijden</b><small>eigen, bij Comfort: 20° tot 22:00, 's nachts 15°</small></div><span class="pijl">›</span></div>` : ''}
      </div>`;
    return `<div class="ikop"><h2 class="kop-2">Woonkamer</h2><span class="mini">gekozen</span></div>
      <div class="itabs"><span>Kamer</span><span class="aan">Verwarmen en koelen</span></div>
      <p class="imini">Twee zones met elk een radiator. Met een eigen regeling heeft een zone een eigen doel en tijden, en kan hij uit terwijl de rest van de kamer warm blijft.</p>
      ${zone('Zithoek', 'Radiatorknop zithoek', true)}
      ${zone('Keuken', 'Radiatorknop keuken', true, false)}
      <div class="irij plus"><b>+ Iets toevoegen dat verwarmt of koelt</b></div>`;
  }

  /** Comfort: de woonkamer in twee regels, een per zone. */
  function comfort() {
    const rij = (kamer, zone, dag, nacht, eigen = true) => `<tr${eigen ? '' : ' class="dim"'}><td><b>${kamer}</b>${zone ? `<small>${zone}</small>` : ''}</td><td>${dag}</td><td>${nacht}</td><td>23°</td></tr>`;
    return `<h2 class="kop-2" style="margin: 0">Comfort</h2>
      <p class="imini">Per kamer, en per zone die een eigen regeling heeft.</p>
      <table class="ctabel"><thead><tr><th></th><th>Overdag verwarmen</th><th>'s Nachts</th><th>Koelen vanaf</th></tr></thead><tbody>
        ${rij('Woonkamer', 'Zithoek', '21°', '17°')}
        ${rij('Woonkamer', 'Keuken', '20°', '15°')}
        ${rij('Slaapkamer', '', '18°', '16°')}
        ${rij('Badkamer', '', '21°', '17°')}
        ${rij('Zolder', '', '17°', '15°')}
      </tbody></table>`;
  }

  global.zonesSchets = { model, kamerBlad, zoneBlad, indeling, comfort };
})(window);
