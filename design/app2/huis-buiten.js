/*
 * Je huis › Buiten als eigen tekening (schets, 18 november 2026, stap 3 van de
 * kwaliteitsronde). Keuzes van Ricardo die avond: buiten krijgt een eigen
 * tekening; garage, tuinhuis, schuurtje en carport zijn ruimtes (met klimaat
 * als ze verwarmd worden), terras en border zijn delen van de tuin; de
 * gebouwen van de 3D-kaart koppelen vanzelf aan je ruimtes, met één keer
 * Klopt dit?
 *
 * Dezelfde tekenmotor als binnen (kit/huistekenen.js): het erf is de "etage",
 * het huis ligt erop als één vak, de garage en het tuinhuis van de kaart als
 * gebouwen, en oprit, voortuin en achtertuin trek je als vakken. Het terras is
 * een deel van de achtertuin (een zonelijn), net als de zithoek in de
 * woonkamer. Apparaten sleep je erin. Voorbeeldgetallen, in de maat van het
 * huis van Ricardo: een erf van 16 bij 34 meter, de straat onderaan.
 *
 *   (zonder)    Kamers: het erf getekend, en de kaart vraagt Klopt dit?
 *   #apparaten  de apparaten buiten: camera en laadpaal op de oprit, de heater op het terras
 *   #gebouw     het tuinhuis gekozen: wat is dit gebouw?
 *   #dubbel     het tuinhuis stond twee keer: samenvoegen
 *   #leeg       nog niets getekend: alleen het huis en de gebouwen van de kaart
 */
(function (global) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const WIJS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2"/><path d="M15 11a1.5 1.5 0 0 1 3 0v3.5c0 3.6-2.2 6-5.6 6-2.4 0-3.7-.9-5-2.9L5 14.3c-.6-1 .6-2.2 1.6-1.4L9 15"/></svg>';

  const erf = { id: 'erf', soort: 'hoofdhuis', naam: 'Erf', u: 0, v: 0, b: 16, d: 34 };
  const huis = { id: 'huis', soort: 'hoofdhuis', naam: 'Huis', u: 6, v: 10.5, b: 9.8, d: 8.5 };
  const garage = { id: 'garage', soort: 'garage', naam: 'Garage', u: 3.4, v: 11, b: 2.6, d: 9 };
  const tuinhuis = { id: 'tuinhuis', soort: 'tuinhuis', naam: 'Tuinhuis', u: 1.6, v: 30.4, b: 3, d: 2.4 };

  const ERF = {
    maat: { breed: 16, diep: 34 },
    onder: 'STRAAT',
    bron: '3d',
    bronnen: {
      '3d': { naam: '3D-kaart van Nederland', vond: 'Gevonden: huis, garage en tuinhuis', weet: 'Omtrek gemeten', gemeten: true, hoogte: '', goot: 3, nok: 3, blokken: [erf, huis, garage, tuinhuis] },
    },
    etages: [{ id: 'buiten', naam: 'Buiten', kort: 'Buiten', hoogte: 0.1, blokken: [erf, huis, garage, tuinhuis] }],
    kamers: [
      { id: 'achtertuin', naam: 'Achtertuin', soort: 'tuin', etage: 'buiten', zones: ['Terras', 'Tuin'] },
      { id: 'oprit', naam: 'Oprit', soort: 'oprit', etage: 'buiten' },
      { id: 'voortuin', naam: 'Voortuin', soort: 'tuin', etage: 'buiten' },
      { id: 'garage', naam: 'Garage', soort: 'garage', etage: 'buiten' },
      { id: 'tuinhuis', naam: 'Tuinhuis', soort: 'tuinhuis', etage: 'buiten' },
      { id: 'schuurtje', naam: 'Schuurtje', soort: 'schuur', etage: 'buiten' },
      { id: 'huis', naam: 'Huis', soort: 'thuis', etage: 'buiten' },
    ],
    begin: { buiten: { erf: { kamer: 'achtertuin' }, huis: { kamer: 'huis' }, garage: { kamer: 'garage' }, tuinhuis: { kamer: 'tuinhuis' } } },
    verborgen: 2,
    apparaten: [
      { id: 'camera-oprit', naam: 'Camera oprit', soort: 'camera', kamer: 'oprit' },
      { id: 'schijnwerper', naam: 'Schijnwerper oprit', soort: 'licht', kamer: 'oprit' },
      { id: 'laadpaal', naam: 'Laadpaal', soort: 'auto', kamer: 'oprit' },
      { id: 'deurbel', naam: 'Deurbel', soort: 'camera', kamer: 'voortuin' },
      { id: 'border', naam: 'Lamp border', soort: 'licht', kamer: 'achtertuin' },
      { id: 'zonnescherm', naam: 'Zonnescherm', soort: 'screen', kamer: 'achtertuin' },
      { id: 'heater', naam: 'Terrasheater', soort: 'stekker', kamer: 'achtertuin' },
      { id: 'overstek', naam: 'Lamp overstek', soort: 'licht', kamer: 'tuinhuis' },
      { id: 'kachel', naam: 'Kachel tuinhuis', soort: 'thermostaat', kamer: 'tuinhuis' },
      { id: 'meter-tuinhuis', naam: 'Thermometer tuinhuis', soort: 'meter', kamer: 'tuinhuis' },
      { id: 'accu', naam: 'Thuisaccu', soort: 'accu', kamer: 'garage' },
      { id: 'tuinlamp', naam: 'Tuinlamp', soort: 'licht', kamer: null, ha: 'achtertuin' },
    ],
  };

  /* Een kaartje boven de tekening: Klopt dit? van de kaart, of het dubbele tuinhuis. */
  function kaartje(soort) {
    const el = $('vraag');
    if (!el) return;
    if (soort === 'dubbel') {
      el.innerHTML = `<span class="hb-ik">${iconen.svg('tuinhuis')}</span><div class="hb-tekst"><b>Tuinhuis staat twee keer</b><span>Als deel van de Achtertuin (met de lampen) en als eigen ruimte (met de kachel). Samen is het één gebouw.</span></div><div class="hb-knoppen"><button type="button" class="hb-zacht">Zo laten</button><button type="button" class="hb-hoofd">Samenvoegen</button></div>`;
    } else {
      el.innerHTML = `<span class="hb-ik">${iconen.svg('garage')}</span><div class="hb-tekst"><b>De kaart vond een garage en een tuinhuis</b><span>Zijn dit je Garage en je Tuinhuis? Dan staan ze hier, en sleep je er apparaten in.</span></div><div class="hb-knoppen"><button type="button" class="hb-zacht">Anders</button><button type="button" class="hb-hoofd">Ja</button></div>`;
    }
    el.hidden = false;
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => (el.hidden = true)));
  }

  function start() {
    const toon = location.hash.slice(1);
    const stand = toon === 'apparaten' ? 'apparaten' : 'kamers';
    const t = huistekenen.maak($('tekening'), ERF, { stand, etage: 'buiten', bewaar: null, openingen: false });
    huistekenen.paneel($('blad'), t);
    if ($('stapel')) huistekenen.stapel($('stapel'), t);
    huistekenen.strook($('strook'), t);
    document.querySelectorAll('[data-ik]').forEach((el) => el.insertAdjacentHTML('afterbegin', iconen.svg(el.dataset.ik)));
    const bij = () => {
      document.querySelectorAll('[data-stand]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.stand === t.st.stand)));
      $('uitleg').innerHTML = `${WIJS}<span>${t.st.stand === 'apparaten' ? 'Sleep een apparaat naar zijn plek: de heater op het terras, de lamp in de border. Ook in de garage en het tuinhuis.' : 'Trek met je vinger een vak voor de oprit, de tuin of een schuurtje. Een lijn in de tuin maakt het terras. Tik een gebouw aan om te zeggen wat het is.'}</span>`;
    };
    t.op(bij);
    document.addEventListener('click', (e) => {
      const s = e.target.closest('[data-stand]');
      if (s && s.dataset.stand !== 'huis') t.zetStand(s.dataset.stand);
    });

    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (toon !== 'leeg') {
        const M = t.MARGE;
        const stand0 = t.st.stand;
        t.st.stand = 'kamers';
        // Zoals met de vinger: de oprit naast het huis, de voortuin ervoor, de border langs de schutting.
        const vak = (x0, y0, x1, y1, wat) => {
          t.vak({ x0: M + x0, y0: M + y0, x1: M + x1, y1: M + y1 });
          t.noem(t.st.kies.id, wat);
        };
        vak(0, 0, 60, 110, { kamer: 'oprit' });
        vak(60, 0, 160, 105, { kamer: 'voortuin' });
        vak(0, 200, 12, 300, { naam: 'Border', soort: 'border' });
        // Het terras: een deel van de achtertuin, met een zonelijn.
        t.zetZone('achtertuin', 'zet');
        const z = t.vloer().zones.achtertuin;
        z.as = 'y';
        z.op = M + 230;
        t.st.terug = [];
        t.st.stand = stand0;
        t.kies(null);
      }
      if (toon === 'gebouw') {
        const v = t.vloer();
        const id = Number(Object.entries(v.ruimtes).find(([, r]) => r.kamer === 'tuinhuis')?.[0]);
        t.kies({ soort: 'ruimte', id });
      }
      t.teken();
      kaartje(toon === 'dubbel' ? 'dubbel' : toon === '' ? 'kaart' : null);
      if (toon !== '' && toon !== 'dubbel' && $('vraag')) $('vraag').hidden = true;
      bij();
    }));
    bij();
    global.tekenaar = t;
  }

  global.huisBuiten = { start, ERF };
})(window);
