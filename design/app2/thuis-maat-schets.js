/*
 * De schets Thuis met het huis op maat (13 november 2026), gedeeld door
 * Wand-Thuis-Maat en Tel-Thuis-Maat. Het huis komt uit dezelfde tekenaar als
 * Je huis (huistekenen.js), op een verborgen tekening; huis-maat.js tekent het.
 *
 *   (zonder)  het voorbeeldhuis op een zomermiddag: koelt op zon
 *   #jouw     het huis van Ricardo uit de 3D-kaart; de begane grond zoals hij
 *             hem tekende, de eerste en de zolder geschat
 *   #avond    jouw huis 's avonds, met de lampen aan
 *   #dicht    de etages op elkaar in plaats van uit elkaar (ook #dicht-jouw)
 */
(function (global) {
  'use strict';

  /** Ricardo's huis met ook de kamers boven (in Je huis-schets staat alleen de begane grond). */
  function jouwHuis() {
    const h = JSON.parse(JSON.stringify(global.huistekenenJouw));
    h.kamers.push(
      { id: 'hobby', naam: 'Hobbykamer', soort: 'werkkamer', etage: 'eerste' },
      { id: 'slaap2', naam: 'Slaapkamer 2', soort: 'kinderkamer', etage: 'eerste' },
      { id: 'slaap3', naam: 'Slaapkamer 3', soort: 'kinderkamer', etage: 'eerste' },
    );
    h.apparaten.push(
      { id: 'airco-zolder', naam: 'Airco zolder', soort: 'airco', kamer: 'zolderkamer' },
      { id: 'badlamp', naam: 'Badkamerlamp', soort: 'licht', kamer: 'badkamer' },
      { id: 'bedlamp', naam: 'Bedlamp', soort: 'licht', kamer: 'slaapkamer' },
      { id: 'lamp2', naam: 'Lamp slaapkamer 2', soort: 'licht', kamer: 'slaap2' },
      { id: 'accu', naam: 'Thuisaccu', soort: 'accu', kamer: 'garage' },
    );
    return h;
  }

  /** De tekenaar van Je huis, op een verborgen tekening, met wat de schets nodig heeft ingevuld. */
  function maakTekenaar(wie) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = 'position:absolute;width:10px;height:10px;left:-99px;top:0';
    document.body.appendChild(svg);
    const huis = wie === 'jouw' ? jouwHuis() : global.huistekenenVoorbeeld;
    const t = global.huistekenen.maak(svg, huis, { stand: 'kamers', etage: 'bg' });
    const M = t.st && global.huistekenen.MARGE;
    const vakken = (etage, lijst) => {
      t.zetEtage(etage);
      for (const [x0, y0, x1, y1, wat] of lijst) {
        if (x0 == null) {
          // Het hele vlak: de ruimte die er al is een naam geven.
          const id = Number(Object.keys(t.vloer().ruimtes)[0]);
          t.noem(id, wat);
          continue;
        }
        t.vak({ x0: M + x0, y0: M + y0, x1: M + x1, y1: M + y1 });
        t.noem(t.st.kies.id, wat);
      }
    };
    if (wie === 'jouw') {
      // De begane grond zoals in de schets Je huis tekenen (#jouw).
      t.zetEtage('bg');
      const v = t.vloer();
      for (const [id, r] of Object.entries(v.ruimtes)) if (huis.kern.basis[r.blok]) t.noem(Number(id), { kamer: huis.kern.basis[r.blok] });
      for (const [x0, y0, x1, y1, wat] of huis.kern.vakken) {
        t.vak({ x0: M + x0, y0: M + y0, x1: M + x1, y1: M + y1 });
        t.noem(t.st.kies.id, wat);
      }
      t.zetZone(huis.kern.zone.kamer, 'zet');
      t.vloer().zones[huis.kern.zone.kamer].op = M + huis.kern.zone.op;
      // De eerste verdieping, geschat: voor (aan de straat) de badkamer en de hobbykamer, achter twee slaapkamers, de overloop boven de trap.
      vakken('eerste', [
        [null, 0, 0, 0, { naam: 'Overloop', soort: 'overloop' }],
        [123, 24, 162, 52, { kamer: 'badkamer' }],
        [123, 52, 162, 80, { kamer: 'hobby' }],
        [64, 24, 111, 52, { kamer: 'slaap2' }],
        [64, 52, 111, 80, { kamer: 'slaap3' }],
      ]);
      // De zolder: achter de slaapkamer, voor de zolder.
      vakken('zolder', [[null, 0, 0, 0, { kamer: 'zolderkamer' }], [64, 24, 104, 80, { kamer: 'slaapkamer' }]]);
    } else {
      vakken('zolder', [[null, 0, 0, 0, { kamer: 'zolderkamer' }], [64, 0, 134, 84, { kamer: 'logeerkamer' }]]);
    }
    t.zetEtage('bg');
    return t;
  }

  const VOORBEELD = {
    hoek: 28,
    lucht: 0,
    hoogte: 24,
    panelen: { aantal: 12, kant: 1 },
    aan: ['airco-woon', 'vaat', 'accu', 'laadpaal'],
    kamers: {
      woonkamer: { temp: '24,1°', zin: 'koelt op zon', toon: 'koelt' },
      keuken: { temp: '23,6°' },
      slaapkamer: { temp: '23,0°', zin: 'op temperatuur', toon: 'goed' },
      kinderkamer: { temp: '23,4°' },
      badkamer: { temp: '23,5°' },
      werkkamer: { temp: '24,6°' },
      zolderkamer: { temp: '25,1°', zin: 'wacht op meer zon', toon: 'wacht' },
      logeerkamer: { temp: '24,8°' },
    },
  };
  const JOUW = (avond) => ({
    hoek: 50,
    lucht: 0,
    hoogte: 24,
    panelen: { aantal: 10, kant: 1 },
    avond,
    aan: avond ? ['airco-zolder', 'plafond', 'hallamp', 'keukenlamp', 'bedlamp', 'lamp2'] : ['airco-woon'],
    kamers: {
      woonkamer: avond ? { temp: '20,4°', zin: 'op temperatuur', toon: 'goed' } : { temp: '20,6°', zin: 'verwarmt op zon', toon: 'zon' },
      badkamer: { temp: avond ? '21,0°' : '18,4°' },
      hobby: { temp: '18,9°' },
      slaap2: { temp: '17,6°' },
      slaap3: { temp: '17,9°' },
      slaapkamer: { temp: '17,8°' },
      zolderkamer: avond ? { temp: '19,2°', zin: 'verwarmt met de airco', toon: 'verwarmt' } : { temp: '17,1°', zin: 'wacht op zon', toon: 'wacht' },
    },
  });

  function start(podium, opts = {}) {
    const adres = location.hash.slice(1);
    const wie = /jouw|avond/.test(adres) ? 'jouw' : '';
    const t = maakTekenaar(wie);
    const keuze = { ...(wie ? JOUW(adres === 'avond') : VOORBEELD) };
    // Proberen: ?hoek=..&hoogte=..&lucht=.. in het adres.
    for (const [k, v] of new URLSearchParams(location.search)) keuze[k] = Number(v);
    // #dicht: de etages op elkaar, zoals ze echt staan.
    if (/dicht/.test(adres)) keuze.lucht = 0;
    const teken = () => {
      const r = podium.getBoundingClientRect();
      const B = Math.round(r.width);
      const H = Math.round(r.height);
      const uit = global.huisMaat.teken(t, B, H, { ...keuze, ...opts });
      podium.innerHTML = `<svg viewBox="0 0 ${B} ${H}" width="${B}" height="${H}" role="img" aria-label="Het huis op maat, opengewerkt">${uit.svg}</svg>`;
    };
    teken();
    global.tekenaar = t;
    // Waar het noorden ligt op het scherm, in graden: het voorbeeldhuis heeft de straat aan de zuidkant, jouw huis aan de oostkant (noord is boven in de plattegrond).
    const [nx, ny] = wie ? [0, -1] : [0, 1];
    const th = ((keuze.hoek ?? 28) * Math.PI) / 180;
    const sx = nx * Math.cos(th) + ny * Math.sin(th);
    const sy = (-nx * Math.sin(th) + ny * Math.cos(th)) * Math.sin(((keuze.hoogte ?? 24) * Math.PI) / 180);
    const noord = (Math.atan2(sx, sy) * 180) / Math.PI;
    return { t, wie, avond: /avond/.test(adres), teken, noord };
  }

  global.thuisMaatSchets = { start };
})(window);
