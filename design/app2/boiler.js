/*
 * De boiler in de tekening, met zijn temperatuur en zijn stroom (schets, 15
 * november 2026), voor Wand-Boiler en Tel-Boiler. Stap 1, punt 3 van de
 * kwaliteitsronde, issue 168: "Zou mooi zijn als je in de animatie kan zien hoe
 * warm de boiler is en wat de doeltemperatuur is. Ook mooi als hiervan de
 * energiestroom zichtbaar is."
 *
 * Wat er al is (besluit 186 en 189): de boiler staat als witte tank in zijn
 * kamer, met een strook die zegt hoe warm hij is, en er is een kaart op Thuis.
 * Wat ontbreekt:
 * - Geen getal. De strook zegt warm of koud, niet 52° en niet het doel.
 * - Geen stroom. Verwarmt de boiler op zon, dan loopt er geen lijn naartoe.
 * - Zonder kamer is hij er niet. Een boiler die bij Apparaten op zon is
 *   toegevoegd en geen kamer kreeg, staat nergens in het huis.
 *
 * In de schets:
 * - Bij de boiler een label zoals bij de panelen en de laadpaal: hoe warm hij
 *   is, waar hij heen gaat, en waarvan.
 * - Verwarmt hij, dan loopt de stroom naar zijn kamer, goud van de zon en
 *   violet van het net, zoals de andere lijnen.
 * - Zonder kamer staat hij op een vaste plek op de begane grond.
 *
 * Hash:
 *   (geen)    overdag: 52°, verwarmt op zon naar 60°
 *   #net      's avonds: 43°, onder zijn ondergrens, verwarmt van het net naar 45°
 *   #warm     60°, warm genoeg, geen stroom
 *   #wacht    48°, wacht op zon
 *   #zonder   geen temperatuursensor gekozen
 */
(function () {
  'use strict';

  const STANDEN = {
    zon: { tijd: 'dag', zon: 0.8, aan: true, vol: 0.55, label: { titel: '52°', toon: 'zon', regels: ['naar 60° op zon', '2,0 kW'] }, stroom: { van: 'zon', sterkte: 0.6 }, panelen: '3,4 kW', kop: 'De boiler verwarmt op zon', zin: 'Hij is 52° en gaat naar 60°. Dat kan op eigen zon.' },
    net: { tijd: 'avond', zon: 0, aan: true, vol: 0.12, label: { titel: '43°', toon: 'violet', regels: ['naar 45° van het net', '2,0 kW'] }, stroom: { van: 'net', sterkte: 0.6 }, panelen: null, kop: 'De boiler wordt verwarmd', zin: 'Hij is 43°, onder zijn ondergrens van 45°.' },
    warm: { tijd: 'dag', zon: 0.8, aan: false, vol: 1, label: { titel: '60°', toon: 'mint', regels: ['warm genoeg'] }, stroom: null, panelen: '3,4 kW', kop: 'Alles op temperatuur', zin: 'Je panelen geven 3,4 kW. Buiten is het 9°.' },
    wacht: { tijd: 'dag', zon: 0.15, aan: false, vol: 0.35, label: { titel: '48°', toon: 'zon', regels: ['wacht op zon', 'doel 60°'] }, stroom: null, panelen: '0,4 kW', kop: 'Rustige ochtend', zin: 'Je panelen geven 0,4 kW. Buiten is het 6°.' },
    zonder: { tijd: 'dag', zon: 0.8, aan: false, vol: 0.5, label: { titel: 'Boiler', toon: 'grijs', regels: ['geen temperatuur', 'kies een sensor'] }, stroom: null, panelen: '3,4 kW', kop: 'Alles op temperatuur', zin: 'Je panelen geven 3,4 kW. Buiten is het 9°.' },
  };

  function teken() {
    const naam = STANDEN[location.hash.slice(1)] ? location.hash.slice(1) : 'zon';
    const s = STANDEN[naam];
    const tel = document.body.dataset.scherm === 'tel';
    const lucht = document.querySelector('[data-lucht]');
    lucht.className = `${lucht.dataset.basis} lucht lucht-${s.tijd}`;
    document.querySelector('[data-kop]').textContent = s.kop;
    document.querySelector('[data-zin]').textContent = s.zin;
    const labels = [{ bij: 'boiler', titel: s.label.titel, groot: !tel && s.label.titel !== 'Boiler', toon: s.label.toon === 'grijs' ? undefined : s.label.toon, regels: s.label.regels, dx: tel ? 30 : 46, dy: tel ? -52 : -70 }];
    if (s.panelen) labels.push({ bij: 'panelen', titel: s.panelen, groot: !tel, toon: 'zon', regels: ['je panelen, nu'], dx: 64, dy: -70 });
    window.huis.teken(document.getElementById('podium'), {
      beschrijving: `${s.kop}. ${s.zin}`,
      tijd: s.tijd,
      zon: { aandeel: s.zon, panelen: 12 },
      etages: [
        { kamers: [{ naam: 'Woonkamer', gewicht: 1.5, temp: '20,4°', stil: tel, apparaten: [{ soort: 'lamp', aan: s.tijd === 'avond', x: 0.4 }] }, { naam: 'Berging', gewicht: 0.8, stil: tel, apparaten: [{ soort: 'boiler', aan: s.aan, vol: s.vol }] }] },
        { kamers: [{ naam: 'Badkamer', temp: '21,0°', stil: tel, apparaten: [] }, { naam: 'Slaapkamer', temp: '18,2°', stil: tel, apparaten: [] }] },
        { dak: true, kamers: [{ naam: 'Zolder', temp: '17,1°', stil: tel, apparaten: [] }] },
      ],
      net: true,
      stromen: s.stroom ? [{ van: s.stroom.van, naar: 'Berging', sterkte: s.stroom.sterkte }] : s.zon > 0.3 ? [{ van: 'zon', naar: 'net', sterkte: 0.4 }] : [],
      labels,
    }, tel ? { breedte: 390, hoogte: 330, marge: 0.04 } : { breedte: 860, hoogte: 600, marge: 0.05 });
  }

  addEventListener('hashchange', teken);
  teken();
})();
