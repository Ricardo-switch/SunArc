/*
 * Apparaten in soorten (schets, 11 november 2026): de inhoud voor
 * Wand-Apparaten-Soorten, Tel-Apparaten-Soorten, Wand-Apparaat-Toevoegen en
 * Tel-Apparaat-Toevoegen. Eén bron, zodat wand en telefoon hetzelfde zeggen.
 *
 * Het voorbeeld: een zomermiddag, 4,1 kW zon, 0,1 kW over. Met de
 * schakelaars uit de meldingen van testers: een Shelly 1 mini (issue 157),
 * klik-aan-klik-uit via RFXCOM (161) en een NexBlue via Modbus (160).
 */
(function (global) {
  'use strict';

  const ik = (naam) => global.iconen.svg(naam);

  /** De soorten, in deze volgorde op de pagina. `kleur` is het vlak achter het icoon. */
  const SOORTEN = [
    { id: 'klimaat', naam: 'Klimaat', icoon: 'airco', kleur: '111, 211, 255', vorm: 'kaart', wat: 'Airco, thermostaat, warmtepomp, kachel' },
    { id: 'licht', naam: 'Licht', icoon: 'lamp', kleur: '247, 181, 72', vorm: 'kamers', wat: 'Alle lampen, per kamer' },
    { id: 'water', naam: 'Warm water en bad', icoon: 'boiler', kleur: '255, 122, 77', vorm: 'kaart', wat: 'Boiler, jacuzzi' },
    { id: 'witgoed', naam: 'Witgoed', icoon: 'witgoed', kleur: '110, 231, 183', vorm: 'kaart', wat: 'Wasmachine, droger, vaatwasser' },
    { id: 'auto', naam: 'Auto en laden', icoon: 'auto', kleur: '143, 134, 255', vorm: 'kaart', wat: 'Auto, laadpaal' },
    { id: 'energie', naam: 'Thuisaccu', icoon: 'batterij', kleur: '110, 231, 183', vorm: 'kaart', wat: 'Een of meer accu’s' },
    { id: 'stekkers', naam: 'Stekkers', icoon: 'stekker', kleur: '201, 211, 220', vorm: 'tegel', wat: 'Een slimme stekker met iets erin' },
    { id: 'schakelaars', naam: 'Schakelaars', icoon: 'apparaat', kleur: '201, 211, 220', vorm: 'tegel', wat: 'Een inbouwschakelaar, zoals een Shelly' },
  ];

  /*
   * De apparaten. `kw` komt uit een echte meter, of is null zonder meter.
   * Alleen bij klimaat mag je het vermogen invullen: een infraroodpaneel of
   * vloerverwarming heeft zelden een eigen meter.
   *
   * Een apparaat kan uit meer delen in Home Assistant bestaan (`delen`): de
   * kachel in het tuinhuis is een IR-afstandsbediening met twee geleerde
   * knoppen, een slimme stekker die zijn vermogen meet, en de temperatuur
   * van het tuinhuis.
   */
  const APPARATEN = [
    // Klimaat
    { soort: 'klimaat', icoon: 'airco', naam: 'Airco woonkamer', waar: 'Woonkamer', kw: 0.9, onder: 'kW nu', stand: ['Koelt', 'var(--ijs)'], zin: 'Koelen naar 22° · zon over, dus alvast op voorraad.', klein: 'Helpt op zon', vandaag: '1,6 uur aan', aan: true },
    { soort: 'klimaat', icoon: 'airco', naam: 'Airco zolder', waar: 'Zolder', kw: 0, onder: 'kW nu', stand: ['Wacht op zon', 'var(--zon)'], zin: 'Zou koelen, maar pauzeert even na het uitgaan.', klein: 'Helpt op zon', vandaag: 'niet aan geweest' },
    { soort: 'klimaat', icoon: 'warm', naam: 'Kachel tuinhuis', waar: 'Tuinhuis', kw: 0, onder: 'kW, stekker', stand: ['Uit, het is er 6,3°', 'var(--mint)'], zin: 'Aan en uit via IR, de stroom via de stekker. Vocht 71%.', delen: ['IR-afstandsbediening', 'stekker', 'temperatuur'], knoppen: ['Aan en uit', 'Hoge stand'], vandaag: 'niet aan geweest' },
    { soort: 'klimaat', icoon: 'thermostaat', naam: 'Thermostaat badkamer', waar: 'Badkamer', kw: null, onder: 'gas', stand: ['Uit, het is er 21,5°', 'var(--mint)'], zin: 'Vloerverwarming op water. Houdt de badkamer op 20°.', klein: 'Houdt op temperatuur · kinderslot aan', vandaag: 'niet aan geweest' },
    { soort: 'klimaat', icoon: 'warm', naam: 'Infraroodpaneel', waar: 'Werkkamer', kw: 0, onder: 'kW, ingevuld', stand: ['Uit', 'var(--mint)'], zin: 'Geen eigen meter: ingevuld is 0,6 kW als hij aan is.', klein: 'Houdt op temperatuur', vandaag: 'niet aan geweest' },
    // Licht: alle lampen, per kamer. `via` alleen bij een lamp achter een schakelaar.
    { soort: 'licht', naam: 'Plafondlamp', waar: 'Woonkamer', aan: true },
    { soort: 'licht', naam: 'Staande lamp', waar: 'Woonkamer', aan: true },
    { soort: 'licht', naam: 'Leeslamp', waar: 'Woonkamer', aan: false },
    { soort: 'licht', naam: 'Lampje kast', waar: 'Woonkamer', aan: false },
    { soort: 'licht', naam: 'Boven de tafel', waar: 'Keuken', aan: true },
    { soort: 'licht', naam: 'Spots', waar: 'Keuken', aan: false },
    { soort: 'licht', naam: 'Lamp schuur', waar: 'Schuur', via: 'Shelly 1 mini', aan: true },
    { soort: 'licht', naam: 'Tuinverlichting', waar: 'Buiten', via: 'klik-aan-klik-uit', aan: false, aanname: true },
    { soort: 'licht', naam: 'Buitenlamp voordeur', waar: 'Buiten', via: 'Shelly 1PM mini', aan: true },
    { soort: 'licht', naam: 'Hue lightstrip', waar: null, aan: false },
    { soort: 'licht', naam: 'Hue go', waar: null, aan: false },
    // Warm water en bad
    { soort: 'water', icoon: 'boiler', naam: 'Boiler', waar: 'Zolder', kw: 0, onder: 'kW nu', stand: ['Warm genoeg, 58°', 'var(--mint)'], zin: 'Op zon: gaat aan als er 2,0 kW over is.', klein: 'Op zon', vandaag: '1,1 kWh, 100% eigen zon' },
    // Witgoed
    { soort: 'witgoed', icoon: 'droger', naam: 'Droger', waar: 'Wasruimte', kw: 0.8, onder: 'kW nu', stand: ['Draait', 'var(--zon)'], zin: 'Het programma loopt, klaar om 16:05.', klein: 'Zelf gestart · kinderslot aan', vandaag: '1,2 uur gedraaid', aan: true },
    { soort: 'witgoed', icoon: 'witgoed', naam: 'Wasmachine', waar: 'Wasruimte', kw: 0, onder: 'kW nu', stand: ['Wacht op zon', 'var(--zon)'], zin: 'Start zodra er 1,2 kW over is, uiterlijk 18:00.', klein: 'Op zon', vandaag: 'nog niet gedraaid' },
    // Auto en laden
    { soort: 'auto', icoon: 'auto', naam: 'Elektrische auto', waar: 'Oprit', kw: 1.4, onder: 'kW laden', stand: ['Laadt', 'var(--mint)'], lading: 57, ladingKleur: 'var(--mint)', zin: 'Nog 222 km rijden.', aan: true },
    { soort: 'auto', icoon: 'laadpaal', naam: 'NexBlue Edge Max', waar: 'Oprit', kw: 1.4, onder: 'kW laden', stand: ['Laadt, 6 A op drie fasen', 'var(--mint)'], zin: 'Losse sensoren via Modbus. Alleen kijken.', klein: 'Laadpaal', vandaag: '3,8 kWh geladen', aan: true },
    // Thuisaccu
    { soort: 'energie', icoon: 'batterij', naam: 'De batterij', waar: 'Garage', kw: 0.7, onder: 'kW laden', stand: ['Laadt', 'var(--zon)'], lading: 61, ladingKleur: 'var(--zon)', zin: 'Laadt 0,7 kW met zon. SunArc stuurt de batterij niet.', aan: true },
    // Stekkers
    { soort: 'stekkers', icoon: 'vocht', naam: 'Ontvochtiger', waar: 'Kelder', via: 'Shelly Plug S', kw: 0, aan: false, hand: true, opZon: 'Wacht op zon · aan bij 0,4 kW over' },
    { soort: 'stekkers', icoon: 'stekker', naam: 'Fietslader', waar: 'Schuur', via: 'Sonoff S60', kw: 0.18, aan: true, hand: false },
    // Schakelaars: een relais met iets anders dan een lamp
    { soort: 'schakelaars', icoon: 'vocht', naam: 'Vijverpomp', waar: 'Tuin', via: 'Shelly 1 mini', kw: null, aan: true, hand: true },
    { soort: 'schakelaars', icoon: 'warm', naam: 'Spiegelverwarming', waar: 'Badkamer', via: 'Tuya 1-gang', kw: null, aan: false, hand: true },
  ];

  const nl = (x, d = 1) => x.toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d });
  const per = (id) => APPARATEN.filter((a) => a.soort === id);

  /** Wat een soort nu doet, in een paar woorden voor de kop. */
  function samen(s) {
    const lijst = per(s.id);
    if (s.vorm === 'tegel' || s.vorm === 'kamers') {
      const aan = lijst.filter((a) => a.aan).length;
      return aan ? `${aan} van ${lijst.length} aan` : `${lijst.length} uit`;
    }
    const bezig = lijst.filter((a) => a.aan).length;
    const wacht = lijst.filter((a) => a.stand?.[0] === 'Wacht op zon').length;
    return [bezig ? `${bezig} bezig` : '', wacht ? `${wacht} wacht op zon` : ''].filter(Boolean).join(' · ') || 'alles rustig';
  }

  function vlak(s) {
    return `background: rgba(${s.kleur}, 0.14)`;
  }

  /** Een grote kaart, zoals de kaarten die er nu al zijn. */
  function kaart(a, s) {
    const kw = a.kw == null ? `–<span>${a.onder}</span>` : `${nl(a.kw)}<span>${a.onder}</span>`;
    const knoppen = a.knoppen ? `<div class="irknoppen">${a.knoppen.map((k) => `<span>${k}</span>`).join('')}</div>` : '';
    const delen = a.delen ? `<p class="zin dim">Samen: ${a.delen.join(', ')}</p>` : '';
    const lading = a.lading == null ? '' : `<div class="lading"><div class="regel"><span>Lading</span><b>${a.lading}%</b></div><div class="baan"><i style="width: ${a.lading}%; background: ${a.ladingKleur}"></i></div></div>`;
    return `<section class="glas app${a.aan ? ' bezig' : ''}">
      <div class="kopje"><span class="ik" style="${vlak(s)}">${ik(a.icoon)}</span><div><b>${a.naam}</b><span class="waar">${a.waar}</span></div><div class="kw">${kw}</div></div>
      <div class="stand"><i style="background: ${a.stand[1]}"></i>${a.stand[0]}</div>
      ${lading}
      <p class="zin">${a.zin}</p>
      ${knoppen}${delen}
      ${a.klein ? `<p class="zin dim">${a.klein}</p>` : ''}
      ${a.vandaag ? `<div class="vandaag"><span>Vandaag</span><b>${a.vandaag}</b></div>` : ''}
    </section>`;
  }

  /** Een kleine tegel voor wat alleen aan en uit gaat: een lamp, een pomp, een stekker. */
  function tegel(a, s) {
    const meter = a.kw == null ? '<span class="dim">geen meter</span>' : `<b>${nl(a.kw, a.kw > 0 && a.kw < 0.1 ? 2 : 1)} kW</b>`;
    const stand = a.opZon ? `<span style="color: var(--zon-t)">${a.opZon}</span>` : `${a.aan ? 'Aan' : 'Uit'}${a.aanname ? '<span class="dim"> · laatst gestuurd</span>' : ''}`;
    const rechts = a.hand ? `<span class="schakel${a.aan ? '' : ' uit'}" role="switch" aria-checked="${a.aan}" aria-label="${a.naam}"></span>` : '<span class="kijk">alleen kijken</span>';
    return `<div class="tegel${a.aan ? ' bezig' : ''}">
      <span class="ik" style="${vlak(s)}">${ik(a.icoon)}</span>
      <div class="wie"><b>${a.naam}</b><small>${a.waar} · via ${a.via}</small></div>
      ${rechts}
      <div class="tstand"><span class="stip" style="background: ${a.aan ? 'var(--zon)' : 'rgba(255,255,255,0.28)'}"></span>${stand}<span class="meter">${meter}</span></div>
    </div>`;
  }

  /** De lampen per kamer: per kamer een vlak met een regel en een schakelaar per lamp. */
  function kamers(lijst) {
    const namen = [...new Set(lijst.map((a) => a.waar ?? ''))];
    return `<div class="kamers">${namen
      .map((k) => {
        const hier = lijst.filter((a) => (a.waar ?? '') === k);
        const aan = hier.filter((a) => a.aan).length;
        const kop = k ? `<b>${k}</b><small>${aan ? `${aan} van ${hier.length} aan` : 'uit'}</small>` : '<b>Zonder kamer</b><span class="mist">Kies een kamer</span>';
        const rijen = hier
          .map((a) => `<div class="lamp${a.aan ? ' aan' : ''}"><span class="lik">${ik('lamp')}</span><span class="lnaam">${a.naam}${a.via ? `<small>via ${a.via}${a.aanname ? ' · laatst gestuurd' : ''}</small>` : ''}</span><span class="schakel${a.aan ? '' : ' uit'}" role="switch" aria-checked="${a.aan}" aria-label="${a.naam}"></span></div>`)
          .join('');
        return `<div class="kamer glas"><div class="kkop">${kop}</div>${rijen}</div>`;
      })
      .join('')}</div>`;
  }

  /** Een soort met zijn kop en zijn apparaten; wat nu bezig is eerst. */
  function soortBlok(s) {
    const lijst = per(s.id);
    const voor = [...lijst.filter((a) => a.aan), ...lijst.filter((a) => !a.aan)];
    const binnen = s.vorm === 'kamers' ? kamers(lijst) : s.vorm === 'tegel' ? `<div class="tegels">${voor.map((a) => tegel(a, s)).join('')}</div>` : `<div class="kaarten">${voor.map((a) => kaart(a, s)).join('')}</div>`;
    const extra = '';
    // Een soort is zo breed als hij apparaten heeft (hooguit drie): kleine soorten delen een rij.
    const breed = s.vorm === 'kamers' ? 3 : Math.min(3, voor.length);
    return `<section class="soort" id="soort-${s.id}" style="--breed: ${breed}">
      <h2><span class="ik" style="${vlak(s)}">${ik(s.icoon)}</span>${s.naam}<small>${samen(s)}</small></h2>
      ${binnen}${extra}
    </section>`;
  }

  /** De rij met soorten bovenaan: springt naar de soort. */
  function soortenRij(nu) {
    const delen = [['alles', 'Alles', APPARATEN.length], ...SOORTEN.map((s) => [s.id, s.naam, per(s.id).length])];
    return delen.map(([id, naam, n]) => `<a href="#${id}" class="${id === nu ? 'gekozen' : ''}">${naam}<small>${n}</small></a>`).join('');
  }

  /* ------------------------------------------------ apparaat toevoegen */

  /** Gevonden in Home Assistant, nog niet ingedeeld. */
  const GEVONDEN = [
    { id: 'shelly', naam: 'Shelly 1 mini Gen3', id_ha: 'switch.shelly1minig3_5432', waar: 'Schuur', koppeling: 'Shelly', wat: 'Schakelaar, zonder meter', icoon: 'apparaat' },
    { id: 'rfx1', naam: 'AC 0x01a2b3c4:1', id_ha: 'switch.ac_0x01a2b3c4_1', waar: null, koppeling: 'RFXCOM', wat: 'Schakelaar, klik-aan-klik-uit', icoon: 'apparaat' },
    { id: 'rfx2', naam: 'AC 0x01a2b3c4:2', id_ha: 'switch.ac_0x01a2b3c4_2', waar: null, koppeling: 'RFXCOM', wat: 'Schakelaar, klik-aan-klik-uit', icoon: 'apparaat' },
    { id: 'ir', naam: 'Heater tuinhuis', id_ha: 'switch.heater_tuinhuis_switch1', waar: null, koppeling: 'Zigbee2MQTT', wat: 'IR-afstandsbediening, 2 knoppen', icoon: 'warm' },
    { id: 'plug', naam: 'Shelly Plug S', id_ha: 'switch.shellyplugs_9f21', waar: 'Keuken', koppeling: 'Shelly', wat: 'Stekker, meet zelf', icoon: 'stekker' },
  ];

  /** Wat er aan een schakelaar kan hangen, en in welke soort het dan komt. */
  const AAN_SCHAKELAAR = [
    ['lamp', 'Lamp', 'Licht'],
    ['warm', 'Kachel', 'Klimaat'],
    ['ventilatie', 'Ventilator', 'Klimaat'],
    ['vocht', 'Pomp', 'Schakelaars'],
    ['boiler', 'Boiler', 'Warm water'],
    ['stekker', 'Fietslader', 'Schakelaars'],
    ['apparaat', 'Anders', 'Schakelaars'],
  ];

  const SLOT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7"/><path d="M12 14.6v2.2"/></svg>';

  /*
   * Het blad van een thermostaat met een kinderslot (11-11). Hetzelfde vak
   * komt bij elk apparaat met een kinderslot, ook de droger (Home Connect:
   * switch.droger_kinderslot): "Op de droger" in zijn blad. Het blad zoals het
   * nu is (de draaiknop, Hoe lang, Zet op), met onderaan "Op de thermostaat":
   * het kinderslot, als schakelaar die meteen gaat. Een kinderslot is in Home
   * Assistant een schakelaar onder de instellingen van hetzelfde apparaat
   * (Tuya: switch.thermostaat_badkamer_kinderslot; Sonoff via Zigbee2MQTT:
   * switch.sonoff_thermostaat_child_lock).
   */
  function thermostaatBlad() {
    const streepjes = Array.from({ length: 25 }, (_, i) => {
      const hoek = (-225 + i * 11.25) * (Math.PI / 180);
      const r1 = 70;
      const r2 = 80;
      const kleur = i >= 14 && i <= 18 ? '#ff9d6e' : 'rgba(255,255,255,0.18)';
      return `<line x1="${105 + r1 * Math.cos(hoek)}" y1="${100 + r1 * Math.sin(hoek)}" x2="${105 + r2 * Math.cos(hoek)}" y2="${100 + r2 * Math.sin(hoek)}" stroke="${kleur}" stroke-width="2" stroke-linecap="round"/>`;
    }).join('');
    return `<aside class="blad glas">
      <div class="bkop"><div><h2>Thermostaat badkamer</h2><p>Badkamer · nu 21,5° · volgt je regeling</p></div><span class="sluit">×</span></div>
      <div class="knoprij"><span class="rond">−</span><svg class="wijzer" viewBox="0 0 210 190" aria-hidden="true">${streepjes}<text x="105" y="112" text-anchor="middle" font-family="Bricolage Grotesque" font-size="46" font-weight="600" fill="#eef3f7">20°</text><text x="105" y="136" text-anchor="middle" font-family="Figtree" font-size="13" fill="#7f8e9c">nu 21,5°</text></svg><span class="rond">+</span></div>
      <div class="vraag"><span>Hoe lang</span><span class="seg"><span>1 uur</span><span>2 uur</span><span class="aan">Tot 22:00</span><span>Tot 20°</span></span></div>
      <div class="dagbalk"><i></i></div>
      <p class="hoe">Via de knop van je regeling. Om 22:00 terug naar je regeling.</p>
      <div class="optoestel">
        <h3>Op de thermostaat</h3>
        <div class="instelling"><span class="ik">${SLOT}</span><div><b>Kinderslot</b><small>De knoppen op de thermostaat zelf doen niets. Gaat meteen.</small></div><span class="schakel" role="switch" aria-checked="true" aria-label="Kinderslot"></span></div>
      </div>
      <div class="bonder"><button class="zet">Zet op 20°</button></div>
    </aside>`;
  }

  global.schets = { SOORTEN, APPARATEN, GEVONDEN, AAN_SCHAKELAAR, per, soortBlok, kamers, thermostaatBlad, soortenRij, kaart, tegel, ik, nl };
})(window);
