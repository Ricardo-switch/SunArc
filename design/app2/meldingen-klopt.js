/*
 * Wat nu alleen in het logboek staat, als melding met een knop (schets, 15
 * november 2026), voor Wand-Meldingen-Klopt en Tel-Meldingen-Klopt. Stap 1,
 * punt 2 van de kwaliteitsronde. In elk logboek dat een tester meestuurde stond
 * zes keer "Uit de app niet overgenomen: 3 × 25 A, maar 0 stroommeters per fase
 * gevonden". De app wist een week dat er iets niet klopte en zei het alleen
 * tegen het logboek.
 *
 * De vorm is die van de bel (besluit 136, schets Wand-Meldingen): een titel die
 * zegt wat er is, één zin met wat het gevolg is, en één knop die naar de plek
 * gaat waar je het oplost. Lost het zichzelf op, dan schuift het naar Eerder.
 * Nieuw is alleen de inhoud. De dienst schrijft nu 46 waarschuwingen naar het
 * logboek; in drie groepen horen ze bij de bewoner:
 *
 *   1. Je koos iets, en SunArc kon het niet overnemen.
 *        de zekering zonder stroommeters per fase, een airco die op zon moet
 *        helpen zonder vermogen, een kamer met alleen een apparaat dat helpt
 *   2. SunArc deed iets, en het lukte niet.
 *        terugzetten na met de hand, aanzetten op zon, een geplande taak
 *   3. Iets van buiten komt niet binnen.
 *        de weersverwachting, na zes uur
 *
 * Niet als melding: wat over de server gaat (de deuren open, lezen zonder
 * inlog). Dat is voor wie de server beheert, en blijft in het logboek.
 *
 * Hash:
 *   (geen)     groep 1 en 3: de zekering, een kamer waar niets verwarmt, het weer
 *   #mislukt   groep 2: terugzetten lukte niet, op zon lukte niet
 *   #vermogen  een airco die op zon moet helpen zonder vermogen
 */
(function () {
  'use strict';

  const IK = {
    klopt: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4.5M12 17.4v.1"/>',
    mislukt: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4h4"/><path d="M12 9v3.5M12 15.4v.1"/>',
    weer: '<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.6A3.5 3.5 0 0 0 7 18z"/><path d="M4 4l16 16"/>',
    goed: '<path d="M5 12l5 5 9-10"/>',
    versie: '<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/>',
  };
  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

  const ZEKERING = { ik: 'klopt', kleur: 'geel', titel: 'De zekering telt nog niet mee', tekst: 'Je koos 3 × 25 A, maar er is geen stroommeter per fase gevonden. Zonder die meters bewaakt SunArc de zekering niet.', knop: 'Kies de meters', tijd: 'sinds 8 nov' };
  const KAMER = { ik: 'klopt', kleur: 'geel', titel: 'Niets houdt de wasruimte op temperatuur', tekst: 'De airco helpt er alleen als er zon over is. Zonder zon wordt de kamer niet verwarmd.', knop: 'Kies wat verwarmt', laat: true, tijd: 'sinds 2 nov' };
  const WEER = { ik: 'weer', kleur: 'blauw', titel: 'Geen weersverwachting', tekst: 'De weerbron geeft al 6 uur geen verwachting per uur. De zon van morgen en het laadadvies kloppen dan minder goed.', knop: 'Kies een weerbron', tijd: '09:10' };
  const TERUG = { ik: 'mislukt', kleur: 'rood', titel: 'De airco woonkamer staat nog met de hand', tekst: 'Met de hand liep tot 14:00, maar terugzetten lukte niet. Hij verwarmt nog naar 22°.', knop: 'Bekijk', tijd: '14:00' };
  const OPZON = { ik: 'mislukt', kleur: 'rood', titel: 'De ontvochtiger ging niet aan', tekst: 'Er was zon over, maar Home Assistant nam het aanzetten niet aan. SunArc probeert het bij de volgende ronde opnieuw.', knop: 'Bekijk', tijd: '11:25' };
  const VERMOGEN = { ik: 'klopt', kleur: 'geel', titel: 'De airco zolder helpt nog niet op zon', tekst: 'Je koos helpt op zon, maar daarvoor is zijn vermogen nodig. Tot dan doet hij niet mee.', knop: 'Vul het vermogen in', tijd: 'gisteren' };

  const STANDEN = {
    klopt: { aandacht: [ZEKERING, KAMER, WEER], eerder: [['goed', 'groen', 'Airco zolder weer goed', 'Na 20 minuten zonder verbinding, om 14:05.']] },
    mislukt: { aandacht: [TERUG, OPZON], eerder: [['goed', 'groen', 'De zekering telt weer mee', 'Drie stroommeters gekozen, om 10:40.'], ['versie', 'paars', 'Versie 0.188.1: wat is er nieuw', 'De stand staat onder de begroeting.']] },
    vermogen: { aandacht: [VERMOGEN, ZEKERING], eerder: [] },
  };

  function melding(m) {
    const laat = m.laat ? '<span>Laat zo</span>' : '';
    return `<div class="melding"><span class="ik ${m.kleur}">${svg(IK[m.ik])}</span><b>${m.titel}</b><p>${m.tekst}</p><div class="acties"><span class="licht">${m.knop}</span>${laat}<span class="tijd">${m.tijd}</span></div></div>`;
  }

  function teken() {
    const s = STANDEN[location.hash.slice(1)] ?? STANDEN.klopt;
    const eerder = s.eerder.map(([ik, kleur, titel, tekst]) => `<div class="melding oud"><span class="ik ${kleur}">${svg(IK[ik])}</span><b>${titel}</b><p>${tekst}</p></div>`).join('');
    document.querySelector('[data-lijst]').innerHTML = `<h3>Vraagt aandacht</h3>${s.aandacht.map(melding).join('')}${eerder ? `<h3>Eerder</h3>${eerder}` : ''}`;
    for (const b of document.querySelectorAll('[data-aantal]')) b.textContent = String(s.aandacht.length);
  }

  addEventListener('hashchange', teken);
  teken();
})();
