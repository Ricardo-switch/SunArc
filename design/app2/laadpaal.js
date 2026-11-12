/*
 * De laadpaal op Thuis (schets, 12 november 2026; issue 164 en idee 135). De
 * inhoud voor Wand-Laadpaal en Tel-Laadpaal, zodat wand en telefoon hetzelfde
 * zeggen. Een NexBlue via Modbus, toegevoegd uit losse sensoren.
 *
 * Standen (de hash van de pagina):
 *   (zonder)   middag: de auto laadt op zon, van de panelen naar de paal, en van de paal naar de auto
 *   #net       avond: de auto laadt van het net
 *   #blad      een tik op de laadpaal: het blad met wat hij nu doet
 *   #plek      Energie › Auto en laadpaal: ook de laadpaal krijgt een plek
 */
(function (global) {
  'use strict';

  const kamers = {
    beneden: [
      { naam: 'Woonkamer', gewicht: 1.5, temp: '20,6°', zin: 'goed', stand: 'goed', zones: ['Zithoek', 'Keuken'], apparaten: [{ soort: 'bank' }, { soort: 'lamp', x: 0.3 }] },
      { naam: 'Hal', gewicht: 0.55, temp: '18,9°', apparaten: [] },
    ],
    boven: [
      { naam: 'Slaapkamer', gewicht: 1.1, temp: '18,4°', apparaten: [{ soort: 'bed' }] },
      { naam: 'Badkamer', gewicht: 0.8, temp: '21,0°', apparaten: [] },
    ],
  };

  /** Per stand: het model voor de tekening, de kop en de kaarten rechts. */
  function stand(naam) {
    const avond = naam === 'net';
    const basis = {
      tijd: avond ? 'avond' : 'dag',
      zon: avond ? { stand: 0, aandeel: 0, panelen: 12 } : { stand: 0.55, aandeel: 0.95, panelen: 12 },
      wolken: avond ? 0 : 0.15,
      etages: [{ naam: 'Begane grond', kamers: kamers.beneden }, { naam: 'Eerste', kamers: kamers.boven }, { dak: true, kamers: [{ naam: 'Zolder', temp: '17,2°', apparaten: [] }] }],
      net: true,
      voordeur: {},
      oprit: {},
      tuin: {},
      auto: avond ? { procent: 64, stand: 'laadt', bron: 'net', kleur: '#7f97b0' } : { procent: 57, stand: 'laadt', bron: 'zon', kleur: '#7f97b0' },
    };
    if (avond) {
      return {
        tijd: '20:30',
        kop: 'De auto laadt van het net',
        lead: 'Goedkoop tot 23:00. Vol om 22:10.',
        model: {
          ...basis,
          stromen: [{ van: 'net', naar: 'huis', sterkte: 0.25 }, { van: 'net', naar: 'auto', sterkte: 0.85 }],
          labels: [
            { bij: 'laadpaal', titel: 'Laadt 7,4 kW', toon: 'violet', regels: ['van het net', 'auto 64%, vol om 22:10'], dx: -40, dy: 96 },
            { bij: 'net', titel: '8,0 kW van het net', toon: 'violet', dx: 40, dy: 40 },
          ],
        },
      };
    }
    return {
      tijd: '13:20',
      kop: 'De auto laadt op zon',
      lead: 'Je panelen leveren 5,2 kW: 3,7 kW gaat naar de auto, de rest naar het huis.',
      model: {
        ...basis,
        stromen: [{ van: 'zon', naar: 'huis', sterkte: 0.3 }, { van: 'zon', naar: 'auto', sterkte: 0.75 }, { van: 'net', naar: 'auto', sterkte: 0.15 }],
        labels: [
          { bij: 'panelen', titel: '5,2 kW', groot: true, toon: 'zon', regels: ['je panelen, nu'], dx: 70, dy: -70 },
          { bij: 'laadpaal', titel: 'Laadt 3,7 kW', toon: 'zon', regels: ['80% van je zon', 'auto 57%, vol om 16:40'], dx: -40, dy: 96 },
        ],
      },
    };
  }

  /** Een getal met een komma. */
  const nl = (x, d = 1) => x.toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d });

  /** Het blad van de laadpaal: wat hij nu doet, waarvan, de auto, de fasen en vandaag. */
  function blad(net = false) {
    const kw = net ? 7.4 : 3.7;
    const zon = net ? 0 : 0.8;
    const fasen = net ? [10.7, 10.7, 10.8] : [5.3, 5.3, 5.4];
    return `<div class="lkop"><div><h2>NexBlue Edge Max</h2><p>Op de oprit · uit losse sensoren</p></div><span class="sluit">×</span></div>
      <div class="lnu">
        <div class="lgetal"><b>${nl(kw)}</b><span>kW</span><small>laadt nu</small></div>
        <div class="lverdeel"><div class="lbalk"><i style="width: ${zon * 100}%; background: var(--zon)"></i><i style="width: ${(1 - zon) * 100}%; background: #8f86ff"></i></div>
          <div class="lleg"><span><i style="background: var(--zon)"></i>zon ${nl(kw * zon)} kW</span><span><i style="background: #8f86ff"></i>net ${nl(kw * (1 - zon))} kW</span></div></div>
      </div>
      <div class="lrij lauto"><span class="lring" style="--p: ${net ? 64 : 57}"><b>${net ? 64 : 57}%</b></span><div><b>Elektrische auto</b><small>${net ? 'vol om 22:10, tot 80%' : 'vol om 16:40, tot 80%'}</small></div><span class="pijl">›</span></div>
      <div class="lblok"><h3>Stroom per fase</h3><div class="lfasen">${fasen.map((a, i) => `<div><span>L${i + 1}</span><b>${nl(a)} A</b></div>`).join('')}</div></div>
      <div class="lblok"><h3>Vandaag</h3><p class="lzin"><b>${net ? '14,6' : '8,2'} kWh</b> geladen, ${net ? '38' : '74'}% van je eigen zon</p></div>
      <p class="lnoot">SunArc kijkt mee. Laden zetten of pauzeren via Modbus kan nog niet.</p>
      <div class="londer"><span class="knopje">Naar Auto ›</span></div>`;
  }

  /** Energie › Auto en laadpaal: de laadpaal gekozen, met zijn eigen plek. */
  function plek() {
    return `<div class="pkop"><h2 class="kop-2">Auto en laadpaal</h2></div>
      <div class="pkol">
        <div>
          <h3 class="ph3">Gevonden in Home Assistant</h3>
          <div class="prij"><span class="pik">${global.iconen.svg('auto')}</span><div><b>Elektrische auto</b><small>Volkswagen · accu, bereik, laadgrens, kabel</small></div><span class="pschakel"></span></div>
          <div class="prij nu"><span class="pik">${global.iconen.svg('laadpaal')}</span><div><b>NexBlue Edge Max</b><small>Losse sensoren · vermogen, stroom, totaal, stand</small></div><span class="pschakel"></span></div>
          <p class="pmini">Een laadpaal via Modbus staat hier niet vanzelf: hij is in Home Assistant geen apparaat. <a>Toevoegen uit losse sensoren ›</a></p>
        </div>
        <div>
          <div class="pseg"><span>Elektrische auto</span><span class="aan">Laadpaal</span></div>
          <h3 class="ph3">Wat hij kan</h3>
          <p class="pmini">Laadt tot 3 × 16 A. Bedienen via Modbus kan nog niet.</p>
          <h3 class="ph3">Staat in de tekening</h3>
          <div class="pseg"><span class="aan">Oprit</span><span>Carport</span><span>Garage</span><span>Aan het huis</span></div>
          <p class="pmini">Waar de paal staat. De auto die eraan laadt, staat ernaast; bij de auto kies je waar hij staat als hij niet laadt.</p>
          <h3 class="ph3">Laadt deze auto</h3>
          <div class="pseg"><span class="aan">Elektrische auto</span><span>Wisselt</span></div>
        </div>
      </div>`;
  }

  global.laadpaalSchets = { stand, blad, plek };
})(window);
