/*
 * Inrichten in zeven stappen (schets stap 2, 17 november 2026): de inhoud voor
 * Wand-Inrichten-Kort en Tel-Inrichten-Kort, met het voorbeeldhuis. Keuzes
 * Ricardo: zeven stappen na Welkom (zoals het rapport), elke stap een voorstel
 * met "Klopt dit?" (Aanpassen opent de velden), en aan het eind wat SunArc nu
 * doet met de rondleiding als keuze. Wat er niet meer in zit (comfort per
 * dagdeel, afwezig, op zon, buiten, licht, de wand, de stem, de film) biedt
 * de standpagina aan als het iets oplevert; SunArc begint met een basis
 * (besluit 312).
 */
(function (global) {
  const STAPPEN = [
    ['huis', 'Je huis'],
    ['meter', 'Meter en zekering'],
    ['panelen', 'Panelen'],
    ['prijzen', 'Prijzen'],
    ['verwarming', 'Verwarming'],
    ['bewoners', 'Wie woont hier'],
    ['klaar', 'Klaar'],
  ];

  /*
   * Per stap: de vraag, wat SunArc vond (regels met een vinkje), of wat het
   * moet vragen als het niets vond (`vraag`). `gevonden: false` is de stap
   * zonder voorstel.
   */
  const INHOUD = {
    welkom: {
      kop: 'Welkom bij SunArc',
      zin: 'In zeven stappen staat je huis klaar. SunArc heeft Home Assistant al doorgelezen; jij zegt of het klopt.',
      regels: [['Ongeveer vijf minuten', 'wat je overslaat, kan later'], ['Je verwarming blijft zoals hij is', 'SunArc kijkt eerst mee en regelt het klimaat nog niet'], ['Alles blijft in huis', 'geen abonnement, niets in de cloud']],
    },
    huis: {
      kop: 'Klopt je huis?',
      zin: 'Dit vond SunArc in Home Assistant.',
      gevonden: [['3 etages, 9 kamers', 'zolder, eerste verdieping, begane grond'], ['Buiten', 'oprit, tuin, border, tuinhuis'], ['28 apparaten', 'alle met een plek in een kamer'], ['De vorm van het huis', 'uit de 3D-kaart: 9,8 bij 5,6 meter, zadeldak']],
      aanpassen: 'Aanpassen in Je huis',
    },
    meter: {
      kop: 'Klopt je meter?',
      zin: 'Hiermee weet SunArc wat je huis gebruikt en hoeveel er tegelijk aan mag.',
      gevonden: [['Slimme meter', 'nu 1,2 kW van het net'], ['Hoofdzekering 3 × 25 A', 'uit de slimme meter'], ['Omvormer', 'nu 0,8 kW van de panelen'], ['Gasmeter', '2,1 m³ vandaag']],
      aanpassen: 'Aanpassen',
    },
    panelen: {
      kop: 'Kloppen je panelen?',
      zin: 'Met de ligging weet SunArc wanneer er zon komt.',
      gevonden: [['12 panelen, 4,8 kWp', 'uit de omvormer'], ['Op 2 dakvlakken', 'oost en west, helling ± 50°'], ['Waar ze liggen', 'uit de 3D-kaart; SunArc leert het verder vanzelf']],
      aanpassen: 'Aanpassen',
    },
    prijzen: {
      kop: 'Wat kost je stroom?',
      zin: 'Dit vond SunArc niet. Het staat op je rekening of in de app van je leverancier.',
      gevonden: false,
      vraag: true,
      overslaan: 'Weet je het nu niet? Sla over: Opbrengst rekent dan in kWh. SunArc vraagt het later nog eens.',
    },
    verwarming: {
      kop: 'Klopt je verwarming?',
      zin: 'Per kamer wie ervoor zorgt. Wat niet meedoet, kijkt alleen.',
      soort: ['Warmtepomp', 'gevonden: warmtepomp woonkamer'],
      kamers: [['Woonkamer', 'Warmtepomp houdt op temperatuur, airco helpt op zon'], ['Badkamer', 'Thermostaat badkamer houdt op temperatuur'], ['Zolder', 'Airco zolder helpt op zon']],
      nietMee: 'Slaapkamer, Kinderkamer, Keuken, Hal doen nog niet mee',
      aanpassen: 'Aanpassen per kamer',
    },
    bewoners: {
      kop: 'Wie woont hier?',
      zin: 'Wie er thuis is, bepaalt het comfort. Iedereen krijgt later zijn eigen kleur en inlog.',
      gevonden: [['Anna', 'telefoon met locatie: thuis'], ['Bram', 'telefoon met locatie: weg']],
      aanpassen: 'Aanpassen',
    },
    klaar: {
      kop: 'Je huis staat klaar',
      zin: 'SunArc kijkt vanaf nu mee: het zegt wat het zou doen, en schakelt nog niets.',
      regels: [['9 dingen werken al', 'licht, screens, camera’s, opbrengst'], ['8 kijken mee', 'het klimaat, op zon, de zekering'], ['2 leert het eerst', 'hoe snel elke kamer verwarmt, waar de zon komt']],
      later: 'Wat er nog bij kan (comfort per dagdeel, de wand, de stem) zie je bij Wat je huis kan.',
    },
  };

  global.inrichtenKort = { STAPPEN, INHOUD };
})(window);
