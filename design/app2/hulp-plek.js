/*
 * Hulp op de plek (schets, 19 november 2026): de stukjes handleiding voor de
 * schetsen Wand-Hulp-Plek en Tel-Hulp-Plek. Keuzes van Ricardo die dag: één
 * besluit Hulp op de plek; de stukjes zijn één bron (NL en EN) voor de uitleg
 * op de plek (een vraagteken bij wat lastig is, en Waarvoor is dit? onderaan
 * een blad), de woordzoeker onder Ik snap iets niet, en de assistent. Eerst
 * waar testers vastliepen: Klimaat per kamer, Je huis, Apparaten en Energie.
 * Elk stukje: een kop, hooguit drie korte zinnen, en waar je het instelt.
 */
(function (global) {
  const STUKJES = {
    'helpt-op-zon': {
      kop: 'Helpt op zon',
      waar: 'Klimaat › een kamer › Wat ervoor zorgt',
      tekst: [
        'Dit apparaat springt bij als er eigen zon over is: dan koelt of verwarmt het met stroom die anders terug het net op gaat.',
        'Is er geen zon over, dan doet het niets, en houdt het andere apparaat de kamer op temperatuur.',
        'Hoeveel verder dan je doel het op zon mag, zet je bij Op zon mag het.',
      ],
      vragen: ['Waarom draait mijn airco niet terwijl de zon schijnt?', 'Wanneer is er zon over?'],
    },
    'op-zon-mag-het': {
      kop: 'Op zon mag het',
      waar: 'Klimaat › een kamer › Op zon, van het net en weg',
      tekst: [
        'Met zon over mag de kamer een stukje voorbij je doel: 1° kouder in de zomer of 1° warmer in de winter.',
        'Zo bewaar je zon in je huis, voor als de zon weg is.',
        'Bij Niet blijft het precies bij je doel.',
      ],
    },
    'helpt-de-cv': {
      kop: 'Helpt ook de cv',
      waar: 'Klimaat › een kamer › bij de airco',
      tekst: [
        'Stookt de ketel al een tijd en blijft de kamer koud, dan zet SunArc de airco erbij.',
        'Hij draait door tot de kamer op temperatuur is, ook als de ketel al stopt.',
        'Wanneer dat begint, geldt voor alle airco\'s: Het hele huis › Helpen bij de cv.',
      ],
    },
    'klimaat-kamer': {
      kop: 'Klimaat per kamer',
      waar: 'Instellingen › Klimaat',
      tekst: [
        'Per kamer zet je hoe warm het moet zijn, overdag en \'s nachts, en wat ervoor zorgt.',
        'Bovenaan staat wat SunArc nu doet of zou doen in die kamer.',
        'Wat voor het hele huis geldt (dagdelen, voorrang, afwezig) staat links onder de kamers.',
      ],
      onderwerpen: ['Hoe warm', 'Op zon mag het', 'Koelen van het net', 'Wat ervoor zorgt', 'Helpt op zon', 'Helpt ook de cv'],
    },
  };
  global.hulpPlek = { STUKJES };
})(window);
