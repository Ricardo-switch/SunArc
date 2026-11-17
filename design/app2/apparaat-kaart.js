/*
 * Een apparaat instellen op zijn kaart (schets stap 3, 17 november 2026): de
 * inhoud voor Wand-Apparaat-Kaart en Tel-Apparaat-Kaart, met de apparaten van
 * het voorbeeldhuis. Keuzes Ricardo: op zon in het blad van het apparaat (Regeling
 * verdwijnt), laden en de thuisaccu op hun kaart (Energie houdt de zekering, de
 * meters en de prijzen), Toevoegen maakt het apparaat meteen klaar, en een
 * stekker krijgt zijn kamer met Waar staat hij? in zijn blad.
 *
 * Een blad is een lijst regels (minder bubbels): links wat, rechts de waarde of
 * een schakelaar. Wat mist, is de enige oranje regel.
 */
(function (global) {
  /** Waar staat hij? Dezelfde kamers per etage als in Je huis, en Buiten. */
  const WAAR = [
    ['Zolder', ['Zolder']],
    ['1e verdieping', ['Slaapkamer', 'Kinderkamer', 'Badkamer']],
    ['Begane grond', ['Woonkamer', 'Keuken', 'Hal']],
    ['Buiten', ['Voordeur', 'Garage', 'Tuinhuis', 'Oprit']],
  ];

  const KAARTEN = [
    { id: 'stekker', icoon: 'stekker', naam: 'Stekker kachel tuinhuis', waar: 'Tuinhuis', stand: ['zon', 'Wacht op zon'], zin: 'Gaat aan zodra er 1,2 kW zon over is.', kw: '0,0' },
    { id: 'ontvochtiger', icoon: 'stekker', naam: 'Ontvochtiger', waar: 'Kelder', stand: ['mint', 'Aan op zon'], zin: 'Sinds 11:20, nog 1 uur 10.', kw: '0,3' },
    { id: 'droger', icoon: 'droger', naam: 'Droger', waar: 'Zolder', stand: ['gedempt', 'Niet klaargezet'], zin: 'Start op zon als je hem klaarzet.', kw: '0,0' },
    { id: 'boiler', icoon: 'boiler', naam: 'Boiler', waar: 'Zolder', stand: ['gloed', 'Verwarmt op zon'], zin: '52°, naar 60° zolang er zon is.', kw: '2,0' },
    { id: 'laadpaal', icoon: 'laadpaal', naam: 'Laadpaal', waar: 'Oprit', stand: ['gedempt', 'Aangesloten, laadt niet'], zin: 'Laadt op zon, of goedkoop vannacht.', kw: '0,0' },
    { id: 'auto', icoon: 'auto', naam: 'Elektrische auto', waar: 'Oprit', stand: ['mint', 'Thuis, 58%'], zin: 'Nog 215 km rijden.', kw: '0,0' },
    { id: 'accu', icoon: 'accu', naam: 'Thuisaccu', waar: 'Garage', stand: ['mint', 'Laadt op zon'], zin: '64%, 1,2 kW erin.', kw: '1,2' },
  ];

  /**
   * De bladen. Een regel: [wat, waarde, soort] met soort 'pijl' (tik opent een
   * keuze), 'aan'/'uit' (schakelaar), 'mist' (oranje), 'stap' (− waarde +),
   * 'seg' (waarde is een lijst, de eerste met * is gekozen), of niets (alleen lezen).
   */
  const BLADEN = {
    stekker: {
      nu: 'Staat uit · 0 W · <b style="color: var(--zon-t)">wacht op zon</b>',
      groepen: [
        ['Waar', [['Waar staat hij?', 'Tuinhuis', 'pijl'], ['Wat zit erin', 'Kachel', 'pijl']]],
        ['Op zon', [['Op zon', 'Gaat aan als er zon over is, en weer uit als die op is', 'aan'], ['Wat hij trekt', '1,2 kW, gemeten door de stekker'], ['Minstens per dag', '2 uur', 'stap'], ['Uiterlijk klaar om', '22:00', 'stap']]],
        ['Met de hand', [['SunArc mag hem met de hand schakelen', 'Ook als er geen zon is, als jij het vraagt', 'aan']]],
      ],
      hoe: 'Op zon is ook de toestemming: SunArc zet hem echt aan en uit. Zolang SunArc meekijkt, staat hier wat het zou doen.',
      knop: 'Nu aanzetten',
    },
    nieuw: {
      nu: 'Staat uit · 0 W',
      groepen: [
        ['Waar', [['Waar staat hij?', 'Nog geen plek: kies een kamer', 'mist'], ['Wat zit erin', 'Kachel', 'pijl']]],
        ['Op zon', [['Op zon', 'Gaat aan als er zon over is', 'uit']]],
        ['Met de hand', [['SunArc mag hem met de hand schakelen', 'Nu nog niet', 'uit']]],
      ],
      hoe: 'Zonder kamer staat hij in het huis bij de begane grond. Een tik op Waar staat hij? en hij staat op zijn plek, ook in Je huis.',
      knop: 'Nu aanzetten',
    },
    droger: {
      nu: 'Niet klaargezet · 0 W',
      groepen: [
        ['Waar', [['Waar staat hij?', 'Zolder', 'pijl']]],
        ['Op zon', [['Start op zon', 'Als je hem klaarzet, kiest SunArc het moment', 'aan'], ['Uiterlijk klaar', 'Kies je per keer, als hij klaarstaat']]],
        ['Op de droger', [['Kinderslot', 'De knoppen op de droger doen niets', 'uit']]],
      ],
      hoe: 'Klaarzetten: vullen, programma kiezen, "op afstand starten" aan op de droger. Dan tik je hier op Klaarzetten en kies je hoe laat hij klaar moet zijn.',
      knop: 'Klaarzetten',
    },
    boiler: {
      nu: '52° · verwarmt op zon · 2,0 kW',
      groepen: [
        ['Waar', [['Waar staat hij?', 'Zolder', 'pijl']]],
        ['Op zon', [['Op zon', 'Warmer stoken als er zon over is', 'aan'], ['Op zon tot', '60°, uit het instellingenbestand']]],
      ],
      hoe: 'Op zon stookt hij door tot 60°. Zonder zon doet hij wat hij altijd deed: zijn eigen thermostaat houdt hem warm.',
      knop: null,
    },
    laadpaal: {
      nu: 'Aangesloten · laadt niet · 0 kW',
      groepen: [
        ['Waar', [['Waar staat hij?', 'Oprit', 'pijl'], ['Uit Home Assistant', 'Easee · 6 tot 16 A, vermogen, stroom'], ['Doet mee', 'SunArc kijkt naar deze laadpaal', 'aan']]],
        ['Laden', [['Laadstroom', '6 tot 16 A, 3 fasen'], ['Laadt deze auto', 'Elektrische auto', 'pijl']]],
      ],
      hoe: 'Hoe hij laadt (op zon, goedkoop of nu), kies je op de pagina Auto. Wat bij de auto hoort, zoals de accu en Kabel vergeten, staat in het blad van de auto.',
      knop: null,
    },
    auto: {
      nu: 'Thuis · 58% · nog 215 km',
      groepen: [
        ['De auto', [['Uit Home Assistant', 'Volkswagen · accu, bereik, laadgrens, kabel'], ['Doet mee', 'SunArc kijkt naar deze auto', 'aan'], ['Accu', '77 kWh', 'invul'], ['Laadt thuis aan', 'Laadpaal', 'pijl']]],
        ['Kabel vergeten', [['Melding als hij thuis staat zonder kabel', 'Uit|Onder 30%|Onder 50%*|Onder 70%', 'seg'], ['Kijken om', '21:00', 'stap']]],
        ['In de tekening', [['Staat zonder kabel op', 'Oprit', 'pijl']]],
      ],
      hoe: 'Staat de auto om 21:00 thuis zonder kabel en onder 50%, dan krijg je een melding. De accu staat in de papieren van de auto: nodig voor de tijd waarop hij vol is.',
      knop: null,
    },
    accu: {
      nu: '64% · laadt op zon · 1,2 kW',
      groepen: [
        ['Waar', [['Waar staat hij?', 'Garage', 'pijl'], ['Uit Home Assistant', 'Sessy · lading, vermogen, stand'], ['Doet mee', 'SunArc kijkt naar deze accu', 'aan']]],
        ['De accu', [['Hoeveel erin past', '5,0 kWh', 'invul'], ['Wat SunArc zou doen', 'Hetzelfde: laden met zon over']]],
      ],
      hoe: 'SunArc stuurt de accu nog niet: hij laadt en levert zoals Sessy dat zelf doet. Hier staat wat SunArc anders zou doen.',
      knop: null,
    },
  };

  /** Toevoegen: een gevonden stekker meteen klaar (keuze Ricardo). */
  const TOEVOEGEN = {
    gevonden: [['stekker', 'Stekker kachel tuinhuis', 'Slimme stekker, meet zelf'], ['apparaat', 'Shelly 1 mini Gen3', 'Schakelaar, nog niet ingesteld'], ['apparaat', 'AC 0x01a2b3c4:1', 'Klik-aan-klik-uit'], ['warm', 'Heater tuinhuis', 'IR-afstandsbediening, 2 knoppen']],
    vragen: [
      ['Wat zit erin?', ['Kachel*', 'Ventilator', 'Boiler', 'Lamp', 'Iets anders']],
      ['Waar staat hij?', ['Tuinhuis*', 'Garage', 'Woonkamer', 'Andere kamer…']],
      ['Op zon?', ['Ja, aan als er zon over is*', 'Nee']],
      ['Minstens per dag', ['Niet*', '1 uur', '2 uur', '4 uur']],
    ],
    meet: 'Hij meet zelf wat hij trekt: 1,2 kW als hij aan is. Dat is genoeg om te weten wanneer hij op zon kan.',
  };

  global.apparaatKaart = { WAAR, KAARTEN, BLADEN, TOEVOEGEN };
})(window);
