/*
 * De vaste lijst van modellen (21 november 2026, Ricardo): elk apparaat en elk
 * meubel heeft van tevoren een eigen model op ware grootte, met een voorkant.
 * De nieuwe tekenaar (huis-maat.js) zet een model neer waar de bewoner het in
 * Je huis plaatste, met de voorkant naar de kamer: tegen de dichtstbijzijnde
 * muur (een airco, witgoed, een thermostaat), aan het plafond (een plafonnière,
 * een rookmelder) of los op de vloer (een staande lamp). Meubels zet de
 * tekenaar zelf neer, per soort kamer.
 *
 * Een model is gewone gegevens, in meters:
 * - b, d, h: breed langs de muur, diep de kamer in, hoog.
 * - hangt: 'wand' (tegen de muur), 'vloer' (op de vloer tegen de muur),
 *   'plafond' (aan het plafond, zonder muur) of 'vrij' (op de vloer, los).
 * - z: hoe hoog de voet boven de vloer zit (aan de muur); plafond: hoe ver de
 *   bovenkant onder het plafond blijft.
 * - delen(b, opt): de blokken [a0, a1, d0, d1, z0, z1, kleur], met a langs de
 *   muur (van -b/2 tot b/2), d van de muur de kamer in, z vanaf de voet.
 * - voor(b, opt): wat op de voorkant staat (de kant van de kamer), op diepte
 *   `voorD` (zonder: d): { cirkel: [a, z, r] }, { lijn: [a0, z0, a1, z1] },
 *   { vlak: [a0, z0, a1, z1] }; met vul, rand, dik.
 * - aanVoor: hetzelfde, alleen als het apparaat aan staat.
 * - boven(b, opt): wat bovenop ligt: { rect: [a0, d0, a1, d1, z] } of
 *   { rond: [a, d, r, z] }.
 * - licht: een lamp (een plas licht op de vloer als hij aan is); lucht: een
 *   airco (stromen lucht als hij draait).
 *
 * Een nieuw apparaat of meubel komt hier bij, met zijn regel in `voor()`.
 */
(function (global) {
  'use strict';

  /** De kleuren: [bovenkant, zijkant langs x, zijkant langs y], zoals doos3 in de tekenaar. */
  const KLEUR = {
    kast: ['#d5dde5', '#b9c4cf', '#c7d0d9'],
    wit: ['#f3f6f8', '#d7dee5', '#e4e9ee'],
    witgoed: ['#e9eef2', '#d7dee5', '#b9c3cd'],
    donker: ['#1b2633', '#141d28', '#18222e'],
    grijs: ['#5c6876', '#4a5664', '#3c4755'],
    lamp: ['#5c6876', '#4a5664', '#3c4755'],
    lampAan: ['#ffe2b0', '#e8b878', '#d6a565'],
    hout: ['#b08a64', '#8a6a4c', '#9c7a58'],
    bank: ['#7387a6', '#5b6d8c', '#66799a'],
    bankDonker: ['#61749a', '#4d5e7e', '#57698c'],
    matras: ['#eef2f6', '#d3dbe3', '#dfe5eb'],
    keuken: ['#2c3646', '#d9e1e8', '#e8edf1'],
    blad: ['#2c3646', '#2c3646', '#2c3646'],
    dekbed: ['#8fa8d6', '#7189bb', '#7f98c9'],
    dekbedKind: ['#7cc4a4', '#5ea586', '#6db495'],
    accu: ['#dfe6ec', '#c3ced8', '#d0d9e1'],
    laadpaal: ['#5b6779', '#3a4656', '#4a5668'],
    glasDonker: ['#1b2738', '#1b2738', '#1b2738'],
    tuinhuis: ['#3c4654', '#323b47', '#2a323c'],
    vlonder: ['#8a6a4a', '#74583d', '#5e4732'],
    paal: ['#2a323c', '#20272f', '#1a2027'],
    tuindak: ['#4a5562', '#262e37', '#1f262e'],
    schuur: ['#8a6a4c', '#74583d', '#7f6247'],
    schuurdak: ['#3b4656', '#4a5668', '#2f3a48'],
    garage: ['#46525f', '#3a4656', '#2f3a48'],
    tuinstoel: ['#cfd8e0', '#a9b5c1', '#b9c4cf'],
    tuintafel: ['#e9eef2', '#c3ced8', '#d3dce4'],
  };

  /** Een blok over de hele breedte. */
  const heel = (b, d0, d1, z0, z1, kl) => [-b / 2, b / 2, d0, d1, z0, z1, kl];

  const MODELLEN = {
    /* ---------------------------------------------------------------- apparaten */
    airco: {
      naam: 'Airco', b: 0.85, d: 0.22, h: 0.29, hangt: 'wand', plafond: 0.32, lucht: true,
      delen: (b) => [heel(b, 0, 0.22, 0, 0.29, 'kast')],
      voor: (b) => [{ lijn: [-b / 2 + 0.08, 0.07, b / 2 - 0.08, 0.07], rand: '#9aa7b4', dik: 1.2 }],
    },
    wasmachine: {
      naam: 'Wasmachine', b: 0.6, d: 0.6, h: 0.85, hangt: 'vloer',
      delen: (b) => [heel(b, 0, 0.6, 0, 0.85, 'witgoed')],
      voor: () => [{ lijn: [-0.27, 0.74, 0.27, 0.74], rand: '#b9c3cd' }, { cirkel: [0, 0.4, 0.18], vul: '#5e6c7b', rand: '#9aa7b4' }],
      aanVoor: () => [{ cirkel: [0, 0.4, 0.12], vul: 'none', rand: '#f7b548', dik: 1.6, streep: true }],
    },
    droger: {
      naam: 'Droger', b: 0.6, d: 0.6, h: 0.85, hangt: 'vloer',
      delen: (b) => [heel(b, 0, 0.6, 0, 0.85, 'witgoed')],
      voor: () => [{ lijn: [-0.27, 0.74, 0.27, 0.74], rand: '#b9c3cd' }, { cirkel: [0, 0.44, 0.2], vul: '#6b7886', rand: '#9aa7b4' }],
      aanVoor: () => [{ cirkel: [0, 0.44, 0.13], vul: 'none', rand: '#f7b548', dik: 1.6, streep: true }],
    },
    vaatwasser: {
      naam: 'Vaatwasser', b: 0.6, d: 0.6, h: 0.85, hangt: 'vloer',
      delen: (b) => [heel(b, 0, 0.6, 0, 0.85, 'witgoed')],
      voor: () => [{ lijn: [-0.2, 0.76, 0.2, 0.76], rand: '#7d8b9b', dik: 1.6 }],
    },
    koelkast: {
      naam: 'Koelkast', b: 0.6, d: 0.65, h: 1.8, hangt: 'vloer',
      delen: (b) => [heel(b, 0, 0.65, 0, 1.8, 'witgoed')],
      voor: () => [{ lijn: [-0.29, 1.15, 0.29, 1.15], rand: '#b9c3cd' }, { lijn: [0.22, 1.25, 0.22, 1.55], rand: '#7d8b9b', dik: 1.6 }, { lijn: [0.22, 0.75, 0.22, 1.05], rand: '#7d8b9b', dik: 1.6 }],
    },
    boiler: {
      naam: 'Boiler', b: 0.55, d: 0.55, h: 1.3, hangt: 'vloer',
      delen: (b) => [heel(b, 0, 0.55, 0, 1.3, 'wit')],
      voor: () => [{ vlak: [-0.04, 0.3, 0.04, 1.0], vul: '#c3ced8' }],
      aanVoor: () => [{ vlak: [-0.04, 0.3, 0.04, 0.8], vul: '#ff9a6b' }],
    },
    accu: {
      naam: 'Thuisaccu', b: 0.5, d: 0.2, h: 0.9, hangt: 'wand', z: 0.05,
      delen: (b) => [heel(b, 0, 0.2, 0, 0.9, 'accu')],
      voor: () => [{ cirkel: [0, 0.75, 0.025], vul: '#6ee7b7' }, { lijn: [-0.18, 0.12, 0.18, 0.12], rand: '#b9c3cd' }],
    },
    tv: {
      naam: 'Televisie', b: 1.2, d: 0.06, h: 0.7, hangt: 'wand', z: 0.95,
      delen: (b) => [heel(b, 0, 0.06, 0, 0.7, 'donker')],
      aanVoor: (b) => [{ vlak: [-b / 2 + 0.04, 0.04, b / 2 - 0.04, 0.66], vul: '#4d7eac' }],
    },
    radiator: {
      naam: 'Radiator', b: 1.0, d: 0.1, h: 0.6, hangt: 'wand', z: 0.15,
      delen: (b) => [heel(b, 0.03, 0.1, 0, 0.6, 'wit')],
      voor: (b) => Array.from({ length: Math.floor(b / 0.1) - 1 }, (_, i) => ({ lijn: [-b / 2 + 0.1 * (i + 1), 0.04, -b / 2 + 0.1 * (i + 1), 0.56], rand: '#c3ced8' })),
    },
    thermostaat: {
      naam: 'Thermostaat', b: 0.09, d: 0.03, h: 0.09, hangt: 'wand', z: 1.45,
      delen: (b) => [heel(b, 0, 0.03, 0, 0.09, 'wit')],
      voor: () => [{ cirkel: [0, 0.045, 0.028], vul: '#1b2633', rand: '#f7b548', dik: 0.8 }],
    },
    sensor: {
      naam: 'Sensor', b: 0.06, d: 0.02, h: 0.06, hangt: 'wand', z: 1.5,
      delen: (b) => [heel(b, 0, 0.02, 0, 0.06, 'wit')],
    },
    beweging: {
      naam: 'Bewegingsmelder', b: 0.06, d: 0.05, h: 0.06, hangt: 'wand', z: 2.1,
      delen: (b) => [heel(b, 0, 0.05, 0, 0.06, 'wit')],
      voor: () => [{ cirkel: [0, 0.03, 0.018], vul: '#d7dee5' }],
    },
    rookmelder: {
      naam: 'Rookmelder', b: 0.12, d: 0.12, h: 0.04, hangt: 'plafond', plafond: 0,
      delen: (b) => [[-b / 2, b / 2, -b / 2, b / 2, 0, 0.04, 'wit']],
    },
    stekker: {
      naam: 'Stekker', b: 0.06, d: 0.07, h: 0.1, hangt: 'wand', z: 0.3,
      delen: (b) => [heel(b, 0, 0.07, 0, 0.1, 'wit')],
      aanVoor: () => [{ cirkel: [0, 0.07, 0.008], vul: '#6ee7b7' }],
    },
    /* -------------------------------------------------------------------- lampen */
    hanglamp: {
      naam: 'Hanglamp', b: 0.26, d: 0.26, h: 0.12, hangt: 'plafond', plafond: 0.4, licht: true, snoer: true,
      delen: (b, o) => [[-b / 2, b / 2, -b / 2, b / 2, 0, 0.12, o?.aan ? 'lampAan' : 'lamp']],
    },
    plafonniere: {
      naam: 'Plafonnière', b: 0.4, d: 0.4, h: 0.06, hangt: 'plafond', plafond: 0, licht: true,
      delen: (b, o) => [[-b / 2, b / 2, -b / 2, b / 2, 0, 0.06, o?.aan ? 'lampAan' : 'wit']],
    },
    staandelamp: {
      naam: 'Staande lamp', b: 0.32, d: 0.32, h: 1.55, hangt: 'vrij', licht: true,
      delen: (b, o) => [[-0.12, 0.12, -0.12, 0.12, 0, 0.03, 'grijs'], [-0.015, 0.015, -0.015, 0.015, 0.03, 1.3, 'grijs'], [-b / 2, b / 2, -b / 2, b / 2, 1.3, 1.55, o?.aan ? 'lampAan' : 'kast']],
    },
    wandlamp: {
      naam: 'Wandlamp', b: 0.2, d: 0.12, h: 0.14, hangt: 'wand', z: 1.8, licht: true,
      delen: (b, o) => [heel(b, 0, 0.12, 0, 0.14, o?.aan ? 'lampAan' : 'lamp')],
    },
    ledstrip: {
      naam: 'Ledstrip', b: 1.2, d: 0.02, h: 0.02, hangt: 'wand', z: 1.1, licht: true,
      delen: (b, o) => [heel(b, 0, 0.02, 0, 0.02, o?.aan ? 'lampAan' : 'grijs')],
    },
    spiegellamp: {
      naam: 'Spiegel met licht', b: 0.6, d: 0.03, h: 0.8, hangt: 'wand', z: 1.1, licht: true,
      delen: (b) => [heel(b, 0, 0.03, 0, 0.8, 'kast')],
      voor: (b) => [{ vlak: [-b / 2 + 0.04, 0.04, b / 2 - 0.04, 0.72], vul: '#bfe6ff', doorzicht: 0.55 }],
      aanVoor: (b) => [{ vlak: [-b / 2 + 0.04, 0.73, b / 2 - 0.04, 0.78], vul: '#ffe2b0' }],
    },

    /* -------------------------------------------------------------------- buiten */
    /*
     * Buiten (21 november 2026): de auto, de laadpaal, de buitenunit, de tuinset en de gebouwen op het erf. De voorkant
     * (d groot) is de neus van de auto, de kant van de laadpaal met het lampje, en bij een gebouw de deur of pui.
     * Een gebouw neemt zijn maat uit de tekening: opt.b (breed), opt.d (diep), opt.h (hoog).
     */
    auto: {
      naam: 'Auto', b: 1.84, d: 4.5, h: 1.38, hangt: 'vrij',
      delen: (b, o) => {
        const d = o?.d ?? 4.5;
        const kl = o?.kleur ?? '#c9d4df';
        const [zij, kop] = ['#9aa8b7', '#b4c0cc'];
        const romp = o?.wand === 'x' ? [kl, kop, zij] : [kl, zij, kop];
        return [[-b / 2, b / 2, 0.02, d - 0.02, 0.22, 0.78, romp], [-b / 2 + 0.09, b / 2 - 0.09, d * 0.22, d * 0.8, 0.78, 1.38, [kl, '#1b2738', '#1b2738'], [0.12, d * 0.08]]];
      },
      voor: () => [-0.62, 0.62].map((a) => ({ cirkel: [a, 0.6, 0.07], vul: '#fff4d6' })),
      achter: () => [-0.64, 0.64].map((a) => ({ cirkel: [a, 0.62, 0.06], vul: '#ff5a5a' })),
      zij: (b, o) => {
        const d = o?.d ?? 4.5;
        return [d * 0.18, d * 0.81].flatMap((dd) => [{ cirkel: [dd, 0.32, 0.32], vul: '#151c26', rand: '#2c3542' }, { cirkel: [dd, 0.32, 0.14], vul: '#6d7886' }]);
      },
    },
    laadpaal: {
      naam: 'Laadpaal', b: 0.32, d: 0.16, h: 1.25, hangt: 'vloer',
      delen: (b) => [heel(b, 0, 0.16, 0, 1.25, 'laadpaal')],
      voor: () => [{ cirkel: [0, 1.0, 0.035], vul: '#9aa7b4' }],
      aanVoor: () => [{ cirkel: [0, 1.0, 0.04], vul: '#6ee7b7' }],
    },
    buitenunit: {
      naam: 'Buitenunit', b: 0.85, d: 0.32, h: 0.62, hangt: 'wand', z: 0.12,
      delen: (b) => [heel(b, 0, 0.32, 0, 0.62, 'wit')],
      voor: () => [{ cirkel: [-0.12, 0.31, 0.22], vul: '#8a96a3', rand: '#5f6b78' }],
      aanVoor: () => [{ cirkel: [-0.12, 0.31, 0.15], vul: 'none', rand: '#6fd3ff', dik: 1.4, streep: true, klasse: 'sc-fan' }],
    },
    tuinset: {
      naam: 'Tuinset', b: 1.0, d: 1.0, h: 0.74, hangt: 'vrij',
      delen: () => [
        ...[[0, -0.75], [0, 0.75], [-0.75, 0], [0.75, 0]].map(([a, d]) => [a - 0.2, a + 0.2, d - 0.2, d + 0.2, 0, 0.45, 'tuinstoel']),
        [-0.04, 0.04, -0.04, 0.04, 0, 0.68, 'grijs'],
        [-0.5, 0.5, -0.5, 0.5, 0.68, 0.74, 'tuintafel'],
      ],
    },
    tuinhuis: {
      naam: 'Tuinhuis', b: 3, d: 3, h: 2.5, hangt: 'vrij', detailBij: 0,
      // Zoals het tuinhuis op Thuis nu: een donkere doos met latten, een glazen pui, een overstek op twee palen met een vlonder.
      delen: (b, o) => {
        const [d, h, od] = [o?.d ?? 3, o?.h ?? 2.5, o?.od ?? 1.1];
        return [
          heel(b, 0, d - od, 0, h, 'tuinhuis'),
          [-b / 2 - 0.05, b / 2 + 0.05, d - od, d, 0, 0.1, 'vlonder'],
          [-b / 2 + 0.08, -b / 2 + 0.2, d - 0.2, d - 0.08, 0.1, h, 'paal'],
          [b / 2 - 0.2, b / 2 - 0.08, d - 0.2, d - 0.08, 0.1, h, 'paal'],
          [-b / 2 - 0.12, b / 2 + 0.12, -0.12, d + 0.05, h, h + 0.18, 'tuindak'],
        ];
      },
      voorD: (b, o) => (o?.d ?? 3) - (o?.od ?? 1.1),
      voor: (b, o) => {
        const h = o?.h ?? 2.5;
        const [pa, pb] = [-b / 2 + Math.min(0.5, b * 0.1), b / 2 - Math.min(0.5, b * 0.1)];
        return [{ vlak: [pa, 0.15, pb, h - 0.3], vul: o?.glas ?? '#4d7eac', rand: '#1c232c', dik: 1.6 }, ...[0.38, 0.66].map((f) => ({ lijn: [pa + (pb - pa) * f, 0.15, pa + (pb - pa) * f, h - 0.3], rand: '#1c232c', dik: 1.6 }))];
      },
      zij: (b, o) => {
        const [d, h, od] = [o?.d ?? 3, o?.h ?? 2.5, o?.od ?? 1.1];
        const latten = [];
        for (let z = 0.32; z < h - 0.05; z += 0.2) latten.push({ lijn: [0.02, z, d - od - 0.02, z], rand: '#262e38', dik: 0.8 });
        const m = (d - od) / 2;
        return [...latten, { vlak: [m - 0.35, 1.2, m + 0.35, 1.75], vul: o?.glas ?? '#4d7eac', rand: '#1c232c', dik: 1.2 }];
      },
    },
    schuur: {
      naam: 'Schuurtje', b: 2.4, d: 2.0, h: 2.0, hangt: 'vrij',
      // Een houten schuurtje met een puntdak; de nok loopt van voor naar achter.
      delen: (b, o) => {
        const [d, h] = [o?.d ?? 2, o?.h ?? 2];
        return [heel(b, 0, d, 0, h, 'schuur'), [-b / 2 - 0.12, b / 2 + 0.12, -0.12, d + 0.12, h, h + Math.min(b, 3) * 0.38, 'schuurdak', [b / 2 + 0.11, 0]]];
      },
      voor: (b, o) => [{ vlak: [-0.4, 0, 0.4, Math.min(1.9, (o?.h ?? 2) - 0.1)], vul: '#5e4732', rand: '#3e2f22', dik: 1 }],
    },
    carport: {
      naam: 'Carport', b: 3, d: 5, h: 2.4, hangt: 'vrij',
      // Vier palen en een plat dak, open aan alle kanten.
      delen: (b, o) => {
        const [d, h] = [o?.d ?? 5, o?.h ?? 2.4];
        const paal = (a, dd) => [a - 0.06, a + 0.06, dd - 0.06, dd + 0.06, 0, h, 'paal'];
        return [paal(-b / 2 + 0.12, 0.12), paal(b / 2 - 0.12, 0.12), paal(-b / 2 + 0.12, d - 0.12), paal(b / 2 - 0.12, d - 0.12), [-b / 2 - 0.1, b / 2 + 0.1, -0.1, d + 0.1, h, h + 0.14, 'tuindak']];
      },
    },
    garage: {
      naam: 'Garage', b: 3, d: 6, h: 2.7, hangt: 'vrij',
      // Een dichte doos met een plat dak en een kanteldeur aan de voorkant.
      delen: (b, o) => [heel(b, 0, o?.d ?? 6, 0, o?.h ?? 2.7, 'garage')],
      voor: (b, o) => {
        const h = Math.min(2.2, (o?.h ?? 2.7) - 0.25);
        const dx = Math.min(2.6, b - 0.4);
        return [{ vlak: [-dx / 2, 0, dx / 2, h], vul: '#4d5a6a', rand: '#7a8796', dik: 0.8 }, ...Array.from({ length: Math.floor(h / 0.45) }, (_, i) => ({ lijn: [-dx / 2, 0.45 * (i + 1), dx / 2, 0.45 * (i + 1)], rand: '#7a8796', dik: 0.7 }))];
      },
    },
    boom: {
      // Een boom is rond, geen blok: die tekent de tekenaar zelf (stam en kruin in het seizoen). Hier voor de volledigheid.
      naam: 'Boom', b: 2.2, d: 2.2, h: 5, hangt: 'vrij', eigen: 'boom',
    },

    /* ------------------------------------------------------------------ meubels */
    bank: {
      naam: 'Bank', b: 2.2, d: 0.92, h: 0.82, hangt: 'vloer',
      delen: (b) => [heel(b, 0.03, 0.27, 0, 0.82, 'bankDonker'), [-b / 2 + 0.16, b / 2 - 0.16, 0.27, 0.9, 0, 0.42, 'bank'], [-b / 2, -b / 2 + 0.16, 0.03, 0.92, 0, 0.6, 'bank'], [b / 2 - 0.16, b / 2, 0.03, 0.92, 0, 0.6, 'bank']],
    },
    salontafel: {
      naam: 'Salontafel', b: 1.0, d: 0.6, h: 0.38, hangt: 'vloer',
      delen: (b) => [heel(b, 0, 0.6, 0.32, 0.38, 'hout'), [-b / 2 + 0.04, -b / 2 + 0.1, 0.04, 0.56, 0, 0.32, 'hout'], [b / 2 - 0.1, b / 2 - 0.04, 0.04, 0.56, 0, 0.32, 'hout']],
    },
    keukenblok: {
      naam: 'Keuken', b: 2.4, d: 0.64, h: 0.9, hangt: 'vloer',
      delen: (b) => [heel(b, 0.02, 0.62, 0, 0.86, 'keuken'), heel(b, 0.02, 0.64, 0.86, 0.9, 'blad')],
      voorD: 0.62,
      // Deurtjes van 60 centimeter.
      voor: (b) => Array.from({ length: Math.max(0, Math.round(b / 0.6) - 1) }, (_, i) => ({ lijn: [-b / 2 + (b / Math.round(b / 0.6)) * (i + 1), 0.06, -b / 2 + (b / Math.round(b / 0.6)) * (i + 1), 0.8], rand: '#aab6c4' })),
      // Een spoelbak en een kookplaat op het blad.
      boven: (b) => (b >= 1.8 ? [
        { rect: [-b / 2 + 0.25, 0.12, -b / 2 + 0.75, 0.5, 0.901], vul: '#9fb3c8' },
        { rect: [b / 2 - 0.85, 0.1, b / 2 - 0.25, 0.54, 0.901], vul: '#141d28' },
        ...[[-0.15, 0.22], [0.15, 0.22], [-0.15, 0.42], [0.15, 0.42]].map(([a, d]) => ({ rond: [b / 2 - 0.55 + a, d, 0.07, 0.902], rand: '#5c6876' })),
      ] : []),
    },
    bovenkast: {
      naam: 'Bovenkasten', b: 2.4, d: 0.34, h: 0.7, hangt: 'wand', z: 1.5,
      delen: (b) => [heel(b, 0.02, 0.34, 0, 0.7, 'kast')],
      voorD: 0.34,
      voor: (b) => Array.from({ length: Math.max(0, Math.round(b / 0.6) - 1) }, (_, i) => ({ lijn: [-b / 2 + (b / Math.round(b / 0.6)) * (i + 1), 0.04, -b / 2 + (b / Math.round(b / 0.6)) * (i + 1), 0.66], rand: '#c3ced8' })),
    },
    eettafel: {
      naam: 'Eettafel', b: 1.6, d: 0.9, h: 0.76, hangt: 'vrij',
      delen: (b) => {
        const d2 = 0.45;
        const stoelen = [-b / 4, b / 4].flatMap((a) => [[a - 0.2, a + 0.2, -d2 - 0.55, -d2 - 0.15, 0, 0.46, 'grijs'], [a - 0.2, a + 0.2, d2 + 0.15, d2 + 0.55, 0, 0.46, 'grijs']]);
        return [...stoelen, [-b / 2, b / 2, -d2, d2, 0.72, 0.76, 'hout'], [-b / 2 + 0.05, -b / 2 + 0.11, -d2 + 0.05, d2 - 0.05, 0, 0.72, 'hout'], [b / 2 - 0.11, b / 2 - 0.05, -d2 + 0.05, d2 - 0.05, 0, 0.72, 'hout']];
      },
    },
    bed: {
      naam: 'Bed', b: 1.6, d: 2.1, h: 0.95, hangt: 'vloer',
      delen: (b, o) => [
        heel(b, 0.02, 0.1, 0, 0.95, 'hout'),
        heel(b, 0.1, 2.1, 0, 0.4, 'hout'),
        [-b / 2 + 0.04, b / 2 - 0.04, 0.12, 2.06, 0.4, 0.56, 'matras'],
        [-b / 2 + 0.02, b / 2 - 0.02, 0.75, 2.08, 0.56, 0.64, o?.kind ? 'dekbedKind' : 'dekbed'],
        ...(b > 1.2 ? [[-b / 2 + 0.1, -0.05, 0.18, 0.58, 0.56, 0.68, 'wit'], [0.05, b / 2 - 0.1, 0.18, 0.58, 0.56, 0.68, 'wit']] : [[-b / 2 + 0.1, b / 2 - 0.1, 0.18, 0.58, 0.56, 0.68, 'wit']]),
      ],
    },
    nachtkastje: {
      naam: 'Nachtkastje', b: 0.45, d: 0.4, h: 0.5, hangt: 'vloer',
      delen: (b) => [heel(b, 0.02, 0.42, 0, 0.5, 'hout')],
      voorD: 0.42,
      voor: () => [{ lijn: [-0.18, 0.25, 0.18, 0.25], rand: '#8a6a4c' }],
    },
    kast: {
      naam: 'Kast', b: 1.6, d: 0.6, h: 2.1, hangt: 'vloer',
      delen: (b, o) => [heel(b, 0.02, 0.62, 0, o?.laag ? 1.2 : 2.1, 'kast')],
      voorD: 0.62,
      voor: (b, o) => Array.from({ length: Math.max(0, Math.round(b / 0.5) - 1) }, (_, i) => ({ lijn: [-b / 2 + (b / Math.round(b / 0.5)) * (i + 1), 0.04, -b / 2 + (b / Math.round(b / 0.5)) * (i + 1), (o?.laag ? 1.2 : 2.1) - 0.04], rand: '#c3ced8' })),
    },
    bad: {
      naam: 'Bad', b: 1.7, d: 0.75, h: 0.55, hangt: 'vloer',
      delen: (b) => [heel(b, 0.02, 0.77, 0, 0.55, 'wit')],
      boven: (b) => [{ rect: [-b / 2 + 0.08, 0.1, b / 2 - 0.08, 0.69, 0.551], vul: '#bfdcef' }],
    },
    wastafel: {
      naam: 'Wastafel', b: 0.8, d: 0.48, h: 0.86, hangt: 'vloer',
      delen: (b) => [heel(b, 0.02, 0.5, 0.62, 0.86, 'wit')],
      boven: (b) => [{ rect: [-b / 2 + 0.12, 0.1, b / 2 - 0.12, 0.4, 0.861], vul: '#bfdcef' }],
    },
    toilet: {
      naam: 'Toilet', b: 0.38, d: 0.7, h: 0.8, hangt: 'vloer',
      delen: () => [[-0.19, 0.19, 0.02, 0.2, 0.35, 0.8, 'wit'], [-0.19, 0.19, 0.2, 0.7, 0, 0.42, 'wit']],
    },
    bureau: {
      naam: 'Bureau', b: 1.4, d: 0.7, h: 0.75, hangt: 'vloer',
      delen: (b) => [[-b / 2, -b / 2 + 0.05, 0.02, 0.72, 0, 0.71, 'hout'], [b / 2 - 0.05, b / 2, 0.02, 0.72, 0, 0.71, 'hout'], heel(b, 0.02, 0.72, 0.71, 0.75, 'hout'), [-0.3, 0.3, 0.12, 0.16, 0.8, 1.15, 'donker'], [-0.05, 0.05, 0.14, 0.24, 0.75, 0.8, 'donker']],
    },
    bureaustoel: {
      naam: 'Bureaustoel', b: 0.46, d: 0.46, h: 0.95, hangt: 'vrij',
      delen: (b) => [[-b / 2, b / 2, -b / 2, b / 2, 0.42, 0.48, 'donker'], [-0.03, 0.03, -0.03, 0.03, 0, 0.42, 'grijs'], [-b / 2, b / 2, b / 2 - 0.06, b / 2, 0.48, 0.95, 'donker']],
    },
  };

  /** Welk model bij een apparaat uit Je huis hoort: eerst de soort, dan de naam (een stekker met een droger erachter). */
  function voor(a) {
    const naam = `${a?.naam ?? ''} ${a?.id ?? ''}`.toLowerCase();
    const s = a?.soort ?? '';
    if (s === 'airco') return 'airco';
    if (s === 'licht') {
      if (/spiegel/.test(naam)) return 'spiegellamp';
      if (/strip|ambilight/.test(naam)) return 'ledstrip';
      if (/wand/.test(naam)) return 'wandlamp';
      if (/sfeer|staande|vloerlamp|leeslamp/.test(naam)) return 'staandelamp';
      if (/plafon|spot/.test(naam)) return 'plafonniere';
      return 'hanglamp';
    }
    // Een radiator (besluit 333): een radiatorknop, of een radiator die Je huis vanzelf of op verzoek tekent.
    if (s === 'radiator') return 'radiator';
    if (s === 'thermostaat' || s === 'klimaat') return 'thermostaat';
    if (s === 'rookmelder') return 'rookmelder';
    if (s === 'beweging') return 'beweging';
    if (s === 'meter') return 'sensor';
    if (s === 'accu') return 'accu';
    if (/droger|wasmachine|vaat|stekker|apparaat|witgoed/.test(s)) {
      if (/droger|droog/.test(naam) || s === 'droger') return 'droger';
      if (/vaat/.test(naam) || s === 'vaat') return 'vaatwasser';
      if (/wasmachine|was\b/.test(naam) || s === 'wasmachine') return 'wasmachine';
      if (/koel|vries/.test(naam)) return 'koelkast';
      if (/boiler/.test(naam)) return 'boiler';
      if (/\btv\b|televisie/.test(naam)) return 'tv';
      return 'stekker';
    }
    return null;
  }

  global.huisModellen = { MODELLEN, KLEUR, voor };
})(typeof window !== 'undefined' ? window : globalThis);
