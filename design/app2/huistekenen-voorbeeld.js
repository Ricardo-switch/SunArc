/*
 * Het voorbeeldhuis voor de schets Je huis tekenen (Wand-Huis-Tekenen,
 * Tel-Huis-Tekenen): een hoofdhuis van 10 bij 8,4 meter, een garage links en
 * een uitbouw achter. Voorbeeldgetallen; in de app komt de vorm uit Daken en
 * panelen en de kamers en apparaten uit Home Assistant.
 */
(function (global) {
  'use strict';
  const garage = { id: 'garage', soort: 'garage', naam: 'Garage', u: 0, v: 1, b: 3.4, d: 6.2, dak: 'plat dak' };
  const hoofd = { id: 'hoofd', soort: 'hoofdhuis', naam: 'Hoofdhuis', u: 3.4, v: 0, b: 10, d: 8.4, dak: 'zadeldak' };
  const uitbouw = { id: 'uitbouw', soort: 'uitbouw', naam: 'Uitbouw', u: 8.8, v: 8.4, b: 4.6, d: 3.2, dak: 'plat dak' };
  global.huistekenenVoorbeeld = {
    maat: { breed: 13.4, diep: 11.6 },
    bron: '3d',
    bronnen: {
      '3d': {
        naam: '3D-kaart van Nederland', vond: 'Gevonden: huis, garage en uitbouw', weet: 'Omtrek, hoogte en dak, gemeten', gemeten: true, hoogte: 'goot 6,2 m · nok 9,7 m', goot: 6.2, nok: 9.7, blokken: [garage, hoofd, uitbouw],
        // Wat de kaart er nog meer vindt (0.185.0): een tuinhuis achter de garage en het huis van de buren, grijs om aan te wijzen.
        omgeving: [
          { i: 0, punten: [[0.4, 9.2], [3.4, 9.2], [3.4, 11.6], [0.4, 11.6]] },
          { i: 1, punten: [[15.2, 0.6], [22, 0.6], [22, 9.4], [15.2, 9.4]] },
        ],
      },
      osm: { naam: 'OpenStreetMap', vond: 'Gevonden: huis en garage', weet: 'Alleen de omtrek; hoogte geschat', gemeten: false, hoogte: 'goot 5,6 m · nok 8,6 m', goot: 5.6, nok: 8.6, blokken: [{ ...garage, v: 1.2, d: 5.8 }, hoofd] },
      basis: { naam: 'Basishuis', vond: 'Vrijstaand huis van 10 bij 8,4 m', weet: 'Uit je woningtype; alles geschat', gemeten: false, hoogte: 'goot 5,6 m · nok 8,6 m', goot: 5.6, nok: 8.6, blokken: [hoofd] },
    },
    etages: [
      { id: 'zolder', naam: 'Zolder', kort: 'Zolder', hoogte: 3.5, blokken: [hoofd] },
      { id: 'eerste', naam: 'Eerste verdieping', kort: 'Eerste', hoogte: 2.8, blokken: [hoofd] },
      { id: 'bg', naam: 'Begane grond', kort: 'Begane grond', hoogte: 2.8, blokken: [garage, hoofd, uitbouw] },
    ],
    kamers: [
      { id: 'woonkamer', naam: 'Woonkamer', soort: 'woonkamer', etage: 'bg' },
      { id: 'keuken', naam: 'Keuken', soort: 'keuken', etage: 'bg' },
      { id: 'hal', naam: 'Hal', soort: 'hal', etage: 'bg' },
      { id: 'garage', naam: 'Garage', soort: 'garage', etage: 'bg' },
      { id: 'slaapkamer', naam: 'Slaapkamer', soort: 'slaapkamer', etage: 'eerste' },
      { id: 'kinderkamer', naam: 'Kinderkamer', soort: 'kinderkamer', etage: 'eerste' },
      { id: 'badkamer', naam: 'Badkamer', soort: 'badkamer', etage: 'eerste' },
      { id: 'werkkamer', naam: 'Werkkamer', soort: 'werkkamer', etage: 'eerste' },
      { id: 'zolderkamer', naam: 'Zolder', soort: 'zolder', etage: 'zolder' },
      { id: 'logeerkamer', naam: 'Logeerkamer', soort: 'logeerkamer', etage: 'zolder' },
    ],
    begin: {
      bg: { garage: { kamer: 'garage' }, uitbouw: { kamer: 'keuken' }, hoofd: { as: 'u', op: 2.4, a: { kamer: 'hal' }, b: { kamer: 'woonkamer' } } },
      eerste: { hoofd: { as: 'v', op: 4.6, a: { as: 'u', op: 5.6, a: { kamer: 'slaapkamer' }, b: { kamer: 'kinderkamer' } }, b: { as: 'u', op: 3.8, a: { kamer: 'badkamer' }, b: { kamer: 'werkkamer' } } } },
    },
    verborgen: 2,
    apparaten: [
      { id: 'airco-woon', naam: 'Airco woonkamer', soort: 'airco', kamer: 'woonkamer' },
      { id: 'plafond', naam: 'Plafondlamp', soort: 'licht', kamer: 'woonkamer' },
      { id: 'sfeer', naam: 'Sfeerlamp', soort: 'licht', kamer: 'woonkamer' },
      { id: 'screen-woon', naam: 'Screen woonkamer', soort: 'screen', kamer: 'woonkamer' },
      { id: 'meter-woon', naam: 'Meter woonkamer', soort: 'meter', kamer: 'woonkamer' },
      { id: 'keukenlamp', naam: 'Keukenlamp', soort: 'licht', kamer: 'keuken' },
      { id: 'vaat', naam: 'Vaatwasser', soort: 'vaat', kamer: 'keuken' },
      { id: 'meter-keuken', naam: 'Meter keuken', soort: 'meter', kamer: 'keuken' },
      { id: 'hallamp', naam: 'Hallamp', soort: 'licht', kamer: 'hal' },
      { id: 'accu', naam: 'Thuisaccu', soort: 'accu', kamer: 'garage' },
      { id: 'laadpaal', naam: 'Laadpaal', soort: 'auto', kamer: 'garage' },
      { id: 'airco-slaap', naam: 'Airco slaapkamer', soort: 'airco', kamer: 'slaapkamer' },
      { id: 'bedlamp', naam: 'Bedlamp', soort: 'licht', kamer: 'slaapkamer' },
      { id: 'screen-slaap', naam: 'Screen slaapkamer', soort: 'screen', kamer: 'slaapkamer' },
      { id: 'kinderlamp', naam: 'Lamp kinderkamer', soort: 'licht', kamer: 'kinderkamer' },
      { id: 'badlamp', naam: 'Badkamerlamp', soort: 'licht', kamer: 'badkamer' },
      { id: 'bureaulamp', naam: 'Bureaulamp', soort: 'licht', kamer: 'werkkamer' },
      { id: 'printer', naam: 'Stekker printer', soort: 'stekker', kamer: 'werkkamer' },
      { id: 'koffie', naam: 'Stekker koffie', soort: 'koffie', kamer: null, ha: 'keuken' },
      { id: 'staand', naam: 'Staande lamp', soort: 'licht', kamer: null },
    ],
  };

  /*
   * Deuren, ramen, de trap en de screens van het voorbeeldhuis (schets 13
   * november 2026): `#deuren` in Je huis tekenen, en Thuis op maat. In ruitjes
   * (de rand is 30 ruitjes, een ruitje is 10 cm). Op de begane grond de
   * voordeur in de hal, ramen in de woonkamer en de keuken, deuren naar de
   * woonkamer, de keuken en de garage, en achter in de hal de trap naar voren;
   * boven een overloop boven de trap, ramen en deuren. De screens van de
   * woonkamer en de slaapkamer hangen voor het raam aan de straat.
   */
  global.huistekenenVoorbeeld.inrichten = function (t) {
    const st = t.st;
    const o = (soort, as, op, van, tot) => ({ soort, as, op, van, tot });
    const zet = (etage, lijst) => (st.vloeren[etage].openingen = lijst.map((x, i) => ({ id: `o${i + 1}`, ...x })));
    const was = st.etage;
    const stand = st.stand;
    st.stand = 'kamers';
    // De trap achter in de hal, en boven de overloop erboven.
    t.zetEtage('bg');
    t.vak({ x0: 64, y0: 84, x1: 88, y1: 114 });
    t.noem(t.st.kies.id, { naam: t.huis.eigenNaam?.('trap') ?? 'Trap', soort: 'trap' });
    t.zetTrap(t.st.kies.id, 'z');
    t.zetEtage('eerste');
    t.vak({ x0: 64, y0: 76, x1: 88, y1: 114 });
    t.noem(t.st.kies.id, { naam: 'Overloop', soort: 'overloop' });
    zet('bg', [
      o('voordeur', 'y', 30, 71, 81),
      o('raam', 'y', 30, 100, 120),
      o('raam', 'y', 30, 128, 148),
      o('raam', 'x', 164, 52, 66),
      o('raam', 'y', 146, 128, 148),
      o('deur', 'x', 88, 66, 75),
      o('deur', 'y', 114, 140, 149),
      o('deur', 'x', 64, 70, 79),
    ]);
    zet('eerste', [
      o('raam', 'y', 30, 80, 96),
      o('raam', 'y', 30, 132, 148),
      o('raam', 'y', 114, 120, 136),
      o('raam', 'x', 164, 50, 62),
      o('deur', 'y', 76, 70, 79),
      o('deur', 'x', 88, 92, 101),
      o('deur', 'y', 76, 104, 113),
    ]);
    const hang = (id, etage, raam) => {
      const a = st.apparaten.find((x) => x.id === id);
      const r = st.vloeren[etage].openingen.find((x) => x.id === raam);
      if (!a || !r) return;
      a.raam = raam;
      a.plek = { etage, x: (r.van + r.tot) / 2, y: r.op + 3 };
    };
    hang('screen-woon', 'bg', 'o2');
    hang('screen-slaap', 'eerste', 'o1');
    st.terug = [];
    st.stand = stand;
    t.zetEtage(was);
    t.kies(null);
  };

  /*
   * Een tweede huis: één rechthoek van 10 bij 7,6 meter met een open begane
   * grond. Keuken en woonkamer zijn zones van één kamer; in het midden aan de
   * voorkant staat een kern met de hal, de meterkast, het toilet en de trap.
   * `#open` begint leeg (om het zelf te tekenen), `#kern` toont het getekend.
   */
  const blok = { id: 'hoofd', soort: 'hoofdhuis', naam: 'Hoofdhuis', u: 0, v: 0, b: 10, d: 7.6, dak: 'zadeldak' };
  global.huistekenenOpen = {
    maat: { breed: 10, diep: 7.6 },
    bron: '3d',
    bronnen: {
      '3d': { naam: '3D-kaart van Nederland', vond: 'Gevonden: je huis', weet: 'Omtrek, hoogte en dak, gemeten', gemeten: true, hoogte: 'goot 5,8 m · nok 9,1 m', goot: 5.8, nok: 9.1, blokken: [blok] },
      osm: { naam: 'OpenStreetMap', vond: 'Gevonden: je huis', weet: 'Alleen de omtrek; hoogte geschat', gemeten: false, hoogte: 'goot 5,4 m · nok 8,4 m', goot: 5.4, nok: 8.4, blokken: [{ ...blok, b: 9.8 }] },
      basis: { naam: 'Basishuis', vond: 'Vrijstaand huis van 9 bij 7,6 m', weet: 'Uit je woningtype; alles geschat', gemeten: false, hoogte: 'goot 5,4 m · nok 8,4 m', goot: 5.4, nok: 8.4, blokken: [{ ...blok, u: 0.5, b: 9 }] },
    },
    etages: [
      { id: 'zolder', naam: 'Zolder', kort: 'Zolder', hoogte: 3.3, blokken: [blok] },
      { id: 'eerste', naam: 'Eerste verdieping', kort: 'Eerste', hoogte: 2.7, blokken: [blok] },
      { id: 'bg', naam: 'Begane grond', kort: 'Begane grond', hoogte: 2.7, blokken: [blok] },
    ],
    kamers: [
      { id: 'woonkamer', naam: 'Woonkamer', soort: 'woonkamer', etage: 'bg', zones: ['Keuken', 'Woonkamer'] },
      { id: 'hal', naam: 'Hal', soort: 'hal', etage: 'bg' },
      { id: 'slaapkamer', naam: 'Slaapkamer', soort: 'slaapkamer', etage: 'eerste' },
      { id: 'badkamer', naam: 'Badkamer', soort: 'badkamer', etage: 'eerste' },
      { id: 'zolderkamer', naam: 'Zolder', soort: 'zolder', etage: 'zolder' },
    ],
    begin: {},
    kern: {
      basis: { hoofd: 'woonkamer' },
      vakken: [[29, 0, 48, 40, { kamer: 'hal' }], [48, 14, 60, 40, { naam: 'Toilet', soort: 'toilet' }], [48, 0, 60, 14, { naam: 'Trap', soort: 'trap' }], [29, 30, 36, 40, { naam: 'Meterkast', soort: 'berging' }]],
      zone: { kamer: 'woonkamer', op: 40 },
    },
    verborgen: 2,
    apparaten: [
      { id: 'airco-woon', naam: 'Airco woonkamer', soort: 'airco', kamer: 'woonkamer' },
      { id: 'keukenlamp', naam: 'Keukenlamp', soort: 'licht', kamer: 'woonkamer' },
      { id: 'plafond', naam: 'Plafondlamp', soort: 'licht', kamer: 'woonkamer' },
      { id: 'screen-woon', naam: 'Screen woonkamer', soort: 'screen', kamer: 'woonkamer' },
      { id: 'meter-woon', naam: 'Meter woonkamer', soort: 'meter', kamer: 'woonkamer' },
      { id: 'hallamp', naam: 'Hallamp', soort: 'licht', kamer: 'hal' },
      { id: 'bedlamp', naam: 'Bedlamp', soort: 'licht', kamer: 'slaapkamer' },
      { id: 'koffie', naam: 'Stekker koffie', soort: 'koffie', kamer: null, ha: 'woonkamer' },
    ],
  };

  /*
   * Het huis van Ricardo, zoals de kaart het vindt (dezelfde gegevens als in
   * Wand-Huis-Kaart): het huis 9,8 bij 5,6 meter, de garage 8,9 bij 2,4 meter
   * eronder, die naar het westen uitsteekt. De straat ligt aan de oostkant,
   * rechts in de tekening. De nok loopt van noord naar zuid op 3,75 meter van
   * de voorgevel: de goot ligt voor op 5,6 meter en achter op 3,9 meter. De
   * begane grond is zijn eigen schets (12 november 2026), op deze maat gezet.
   */
  const gar = { id: 'garage', soort: 'garage', naam: 'Garage', u: 0, v: 0, b: 8.9, d: 2.4, dak: 'plat dak' };
  const hs = { id: 'hoofd', soort: 'hoofdhuis', naam: 'Hoofdhuis', u: 6.4, v: 2.4, b: 9.8, d: 5.6, dak: 'zadeldak', nokLangs: 'y', nokVanRechts: 3.75, gootLinks: 3.9, gootRechts: 5.6, dakkapellen: [{ kant: 0, breed: 2.5 }] };
  const hsRecht = { ...hs, nokVanRechts: 4.9, gootLinks: 5.4, gootRechts: 5.4 };
  global.huistekenenJouw = {
    maat: { breed: 16.2, diep: 8 },
    onder: 'ZUID · DE STRAAT LIGT RECHTS',
    bron: '3d',
    bronnen: {
      '3d': { naam: '3D-kaart van Nederland', vond: 'Gevonden: huis en garage', weet: 'Omtrek, hoogte en dak, gemeten', gemeten: true, hoogte: 'nok 9,2 · goot 5,6 en 3,9 m', goot: 5.6, gootLaag: 3.9, nok: 9.2, blokken: [gar, hs] },
      osm: { naam: 'OpenStreetMap', vond: 'Gevonden: huis en garage', weet: 'Alleen de omtrek; hoogte geschat', gemeten: false, hoogte: 'goot 5,4 m · nok 8,6 m', goot: 5.4, nok: 8.6, blokken: [gar, hsRecht] },
      basis: { naam: 'Basishuis', vond: 'Vrijstaand huis van 9,8 bij 5,6 m', weet: 'Uit je woningtype; alles geschat', gemeten: false, hoogte: 'goot 5,4 m · nok 8,6 m', goot: 5.4, nok: 8.6, blokken: [hsRecht] },
    },
    etages: [
      { id: 'zolder', naam: 'Zolder', kort: 'Zolder', hoogte: 3.5, blokken: [hs] },
      { id: 'eerste', naam: 'Eerste verdieping', kort: 'Eerste', hoogte: 2.6, blokken: [hs] },
      { id: 'bg', naam: 'Begane grond', kort: 'Begane grond', hoogte: 2.8, blokken: [gar, hs] },
    ],
    kamers: [
      { id: 'woonkamer', naam: 'Woonkamer', soort: 'woonkamer', etage: 'bg', zones: ['Keuken', 'Woonkamer'] },
      { id: 'hal', naam: 'Hal', soort: 'hal', etage: 'bg' },
      { id: 'garage', naam: 'Garage', soort: 'garage', etage: 'bg' },
      { id: 'slaapkamer', naam: 'Slaapkamer', soort: 'slaapkamer', etage: 'eerste' },
      { id: 'badkamer', naam: 'Badkamer', soort: 'badkamer', etage: 'eerste' },
      { id: 'zolderkamer', naam: 'Zolder', soort: 'zolder', etage: 'zolder' },
    ],
    begin: {},
    kern: {
      basis: { hoofd: 'woonkamer', garage: 'garage' },
      vakken: [[93, 24, 111, 53, { kamer: 'hal' }], [111, 34, 123, 53, { naam: 'Toilet', soort: 'toilet' }], [111, 24, 123, 34, { naam: 'Trap', soort: 'trap' }], [93, 46, 99, 53, { naam: 'Meterkast', soort: 'berging' }]],
      zone: { kamer: 'woonkamer', op: 103 },
    },
    verborgen: 2,
    apparaten: [
      { id: 'airco-woon', naam: 'Airco woonkamer', soort: 'airco', kamer: 'woonkamer' },
      { id: 'keukenlamp', naam: 'Keukenlamp', soort: 'licht', kamer: 'woonkamer' },
      { id: 'plafond', naam: 'Plafondlamp', soort: 'licht', kamer: 'woonkamer' },
      { id: 'meter-woon', naam: 'Meter woonkamer', soort: 'meter', kamer: 'woonkamer' },
      { id: 'hallamp', naam: 'Hallamp', soort: 'licht', kamer: 'hal' },
      { id: 'laadpaal', naam: 'Laadpaal', soort: 'auto', kamer: 'garage' },
    ],
  };
})(typeof window !== 'undefined' ? window : globalThis);
