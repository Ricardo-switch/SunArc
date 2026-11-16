/*
 * Klimaat per kamer in één blad (schets stap 2, 17 november 2026): de inhoud
 * voor Wand-Klimaat-Kamer en Tel-Klimaat-Kamer, met de getallen van het
 * voorbeeldhuis. Wat nu over drie schermen verspreid staat (Comfort, Regeling ›
 * Helpen bij de cv, Kamers en indeling › Verwarmen en koelen), staat hier bij
 * de kamer. Keuzes Ricardo: de schuif zoals nu, helpen bij de cv bij de airco,
 * wat er nu gebeurt bovenaan als zin, op zon en afwezig in het blad.
 */
(function (global) {
  const KAMERS = {
    woonkamer: {
      naam: 'Woonkamer',
      icoon: 'woonkamer',
      nu: '20,8°',
      meten: 'Nest woonkamer',
      metenAantal: 'gemiddelde van 3',
      zin: 'De warmtepomp staat op 20,5° en staat stil.',
      zou: 'SunArc zou hetzelfde doen.',
      dagdelen: [
        { naam: 'Overdag', tijd: '7:00 tot 22:00', warm: 20.5, koel: 23, warmAan: true, koelAan: true },
        { naam: "'s Nachts", tijd: '22:00 tot 7:00', warm: 17, koel: 26, warmAan: false, koelAan: false },
      ],
      opZon: 1,
      koelNet: '26°',
      afwezig: ['Afwezig', '17°, vanzelf als niemand thuis is'],
      zorgt: [
        { icoon: 'verwarming', naam: 'Warmtepomp', taak: 'Houdt op temperatuur', zin: 'Verwarmt en koelt tot het doel, ook van het net.' },
        { icoon: 'airco', naam: 'Airco woonkamer', taak: 'Helpt op zon', zin: 'Springt bij als er eigen zon over is.', cv: { aan: true, vandaag: 'zou vandaag 1× helpen, 18 min' } },
        { icoon: 'thermostaat', naam: 'Radiatorknoppen zithoek en eethoek', volgt: 'Volgen de warmtepomp', zin: 'Zetten alleen een klep open; de warmte komt van de warmtepomp.' },
      ],
    },
    zolder: {
      naam: 'Zolder',
      icoon: 'dak',
      nu: '17,9°',
      meten: 'Airco zolder',
      metenAantal: 'eigen meting',
      zin: 'De airco zolder staat uit.',
      zou: 'SunArc zou wachten, en verwarmen naar 18° zodra er zon over is.',
      anders: true,
      dagdelen: [
        { naam: 'Overdag', tijd: '7:00 tot 22:00', warm: 18, koel: 23, warmAan: true, koelAan: true },
        { naam: "'s Nachts", tijd: '22:00 tot 7:00', warm: 16, koel: 26, warmAan: false, koelAan: false },
      ],
      opZon: 2,
      koelNet: 'nooit',
      afwezig: ['Afwezig', 'doet niets als niemand thuis is'],
      zorgt: [
        { icoon: 'airco', naam: 'Airco zolder', taak: 'Helpt op zon', zin: 'De enige in deze kamer. Wil je hem ook van het net laten verwarmen, kies dan Houdt op temperatuur.', cv: { aan: true, vandaag: 'zou vandaag niet helpen: de ketel stookte niet lang genoeg' } },
      ],
    },
  };

  /** Links in de lijst: de kamers die meedoen en het hele huis (zoals de pagina achter de tegel). */
  const LIJST = {
    kamers: [['woonkamer', 'Woonkamer', 'overdag 20,5 tot 23°', '20,8°'], ['badkamer', 'Badkamer', 'overdag 21°, ’s nachts 17°', '21,2°'], ['zolder', 'Zolder', 'overdag 18 tot 23°', '17,9°']],
    nietMee: 'Slaapkamer, Kinderkamer, Keuken, Hal',
    huis: [['dagdelen', 'Dagdelen', '7:00 tot 22:00'], ['voorrang', 'Voorrang', 'woonkamer eerst'], ['afwezig', 'Afwezig en vakantie', 'vanzelf'], ['verwarming', 'Soort verwarming', 'warmtepomp'], ['airco', 'Helpen bij de cv', 'na 5 min stoken, vanaf 0,5° te koud']],
  };

  global.klimaatKamer = { KAMERS, LIJST };
})(window);
