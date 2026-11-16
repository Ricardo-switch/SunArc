/*
 * Instellingen in vier groepen (schets stap 2, 16 november 2026): de inhoud
 * voor Wand-Instellingen-Vier, met de getallen van het voorbeeldhuis. Drie
 * vormen om uit te kiezen: het huis in het midden, vier tegels, en lijst met
 * inhoud. De stand staat in alle drie als één regel bovenin (keuze Ricardo).
 */
(function (global) {
  const GROEPEN = [
    {
      id: 'huis',
      naam: 'Je huis',
      icoon: 'thuis',
      kleur: 'mint',
      zin: 'Het gebouw: vorm, etages, kamers, daken en waar elk apparaat staat.',
      rijen: [
        ['Etages en kamers', '3 etages, 9 kamers'],
        ['Apparaten', '28, alle met een plek'],
        ['Panelen', '12, op 2 dakvlakken'],
      ],
      delen: ['Vorm', 'Etages en kamers', 'Apparaten', 'Daken en panelen'],
      knoppen: [['Vorm van het huis', 'uit de 3D-kaart'], ['Etages en kamers', '3 etages, 9 kamers'], ['Waar elk apparaat staat', '28, alle met een plek'], ['Daken en panelen', '12 panelen, 2 vlakken']],
    },
    {
      id: 'klimaat',
      naam: 'Klimaat',
      icoon: 'klimaat',
      kleur: 'gloed',
      zin: 'Hoe warm je het wilt, per kamer, en wat daarvoor zorgt.',
      rijen: [
        ['Woonkamer overdag', '20,5 tot 23°'],
        ['Dagdelen', '7:00 tot 22:00'],
        ['SunArc', 'kijkt mee in 3 kamers'],
      ],
      delen: ['Per kamer', 'Dagdelen', 'Voorrang', 'Afwezig', 'Verwarming van het huis', 'Helpen bij de cv'],
      knoppen: [['Hoe warm per kamer', '3 kamers doen mee'], ['Dagdelen', '7:00 tot 22:00'], ['Voorrang', 'woonkamer eerst'], ['Afwezig en vakantie', 'vanzelf'], ['Soort verwarming', 'warmtepomp'], ['Helpen bij de cv', "2 airco's"]],
    },
    {
      id: 'energie',
      naam: 'Energie',
      icoon: 'aansluiting',
      kleur: 'zon',
      zin: 'Je aansluiting: de zekering, de meters en wat stroom kost.',
      rijen: [
        ['Hoofdzekering', '3 × 25 A'],
        ['Meters', 'slimme meter, 1 omvormer'],
        ['Stroomprijs', '€ 0,27, vast'],
      ],
      delen: ['Aansluiting', 'Meters en omvormers', 'Contract en prijzen'],
      knoppen: [['Zekering en aansluiting', '3 × 25 A'], ['Meters en omvormers', 'slimme meter, 1 omvormer'], ['Contract en prijzen', '€ 0,27, vast']],
    },
    {
      id: 'app',
      naam: 'App en bewoners',
      icoon: 'bewoners',
      kleur: 'violet',
      zin: 'Wie hier woont, de assistent, en wat de app verder doet.',
      rijen: [
        ['Bewoners', 'nog niemand'],
        ['Assistent', 'vaste antwoorden'],
        ['Versie', '0.190.2'],
      ],
      delen: ['Bewoners en inloggen', 'Assistent', "Licht, camera's en weer", 'Meldingen', 'Back-up en versie'],
      knoppen: [['Bewoners en inloggen', 'nog niemand'], ['Assistent', 'vaste antwoorden'], ["Licht, camera's en weer", 'weer: Thuis'], ['Meldingen', 'op de wand'], ['Back-up en versie', '0.190.2']],
    },
  ];

  /** De stand als één regel (de ene standpagina zit erachter). */
  const STAND = {
    wat: 'Kijkt mee sinds 13 januari',
    zin: 'Alles staat goed. 2 dingen kunnen er nog bij.',
    procent: 84,
  };

  /** Klimaat als voorbeeld van een geopende groep (vorm Lijst en inhoud). */
  const KLIMAAT = {
    kamers: [
      ['Woonkamer', 'overdag 20,5 tot 23°', 'Warmtepomp houdt op temperatuur, airco helpt op zon', '20,8°'],
      ['Badkamer', 'overdag 21°, ’s nachts 17°', 'Thermostaat badkamer houdt op temperatuur', '21,2°'],
      ['Zolder', 'overdag 18 tot 23°', 'Airco zolder helpt op zon', '17,9°'],
    ],
    nietMee: 'Slaapkamer, Kinderkamer, Keuken, Hal',
    huis: [
      ['Dagdelen', 'dag 7:00, nacht 22:00'],
      ['Voorrang', 'koelen: woonkamer eerst'],
      ['Afwezig en vakantie', 'per kamer, vanzelf'],
      ['Verwarming van het huis', 'warmtepomp'],
      ['Helpen bij de cv', "2 airco's"],
    ],
  };

  /**
   * De pagina achter de tegel Klimaat (#klimaat): links de delen, rechts het
   * gekozen deel, zoals een groep nu al werkt. Het blad per kamer is hier ruw;
   * de uitwerking is schets 2, Klimaat per kamer in één blad.
   */
  const KAMERBLAD = {
    naam: 'Woonkamer',
    nu: '20,8°',
    warm: [
      ['Overdag', '7:00 tot 22:00', 'verwarmen onder 20,5°, koelen boven 23°'],
      ["'s Nachts", '22:00 tot 7:00', 'doet niets'],
    ],
    zorgt: [
      ['verwarming', 'Warmtepomp', 'Houdt op temperatuur', 'verwarmt en koelt tot het doel, ook van het net'],
      ['airco', 'Airco woonkamer', 'Helpt op zon', 'springt bij als er eigen zon over is'],
    ],
    meten: 'Nest woonkamer, 20,8°',
    gebeurt: ['Warmtepomp staat op 20,5° en staat stil', 'SunArc zou hetzelfde doen'],
  };

  global.instellingenVier = { GROEPEN, STAND, KLIMAAT, KAMERBLAD };
})(window);
