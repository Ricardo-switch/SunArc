/*
 * De ene standpagina (schets stap 2, 17 november 2026): de inhoud voor
 * Wand-Stand-Een en Tel-Stand-Een. Wat je huis kan, Hoe ver je huis is,
 * Klaarzetten en het vak Nog te doen worden één pagina. De functies en de
 * waaier komen uit voortgang-voorbeeld.js (W_GROEPEN, TOTAAL); hier staat wat
 * erbij komt. Keuzes Ricardo: de zonnewaaier als beeld, wat mist bovenaan en
 * op de regel, de weg naar zelf regelen onderaan en per huis.
 */
(function (global) {
  /** Wat echt ontbreekt: bovenaan, met de knop erbij. */
  const EERST = [
    { titel: 'Thuis of weg', zin: 'Zet de app van Home Assistant op elke telefoon, met locatie aan. Wie er thuis is, bepaalt het comfort.', knop: 'Zo doe je dat' },
  ];

  /** Wat er nog bij kan: een eigen groep, elk met de knop op de regel. */
  const KAN_ERBIJ = [
    ['Goedkope uren', 'koelen en wassen als stroom goedkoop is', 'Ander contract'],
    ['De auto op zon', 'laden met wat er over is', 'Laadpaal toevoegen'],
    ['De assistent in huis', 'praten met je huis, ook zonder internet', 'Klaarzetten'],
    ['De wand', 'een tablet aan de muur met dit scherm', 'Klaarzetten'],
  ];

  /**
   * De weg naar zelf regelen, per huis. In het huis van Ricardo de wintertest
   * (besluit 64, 30 winterdagen); in een nieuw huis zoals besluit 312: een
   * basis, leren, meekijken, en per kamer zelf regelen als de bewoner dat kiest.
   */
  const WEG = {
    jouw: {
      kop: 'De weg naar zelf regelen',
      zin: 'Na een winter meekijken neemt SunArc het klimaat over, als jij dat wilt.',
      stappen: [['Meekijken begint', '13 januari', 'klaar'], ['Nu', '1 dag meegekeken', 'nu'], ['30 winterdagen', '0 van 30, op zijn vroegst 31 december', 'straks'], ['Zelf regelen', 'na jouw ja', 'doel']],
      maten: [['Winterdagen', '0 van 30', 0], ['Elke stand gezien', '12%', 0.12], ['Klaar om over te nemen', '2%', 0.02]],
    },
    nieuw: {
      kop: 'De weg naar zelf regelen',
      zin: 'SunArc begint met een basis en leert je huis kennen. Per kamer kies jij wanneer het zelf regelt.',
      stappen: [['Basis', 'vanaf de eerste dag', 'klaar'], ['Leren', 'hoe elke kamer warmte vasthoudt', 'nu'], ['Meekijken', 'zegt wat het zou doen', 'straks'], ['Per kamer zelf regelen', 'als jij dat kiest', 'doel']],
      maten: [['Dagen geleerd', '6', 0.2], ['Kamers gemeten', '3 van 5', 0.6], ['Klaar om mee te kijken', '25%', 0.25]],
    },
  };

  global.standEen = { EERST, KAN_ERBIJ, WEG };
})(window);
