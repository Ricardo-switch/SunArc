/*
 * SunArc: het huis zoals getekend, de vorm (opgesplitst uit kit/huis-maat.js).
 *
 * Twee rekenstukken zonder tekenwerk: de ruitjes van een vloer als zo weinig mogelijk rechthoeken per ruimte, en het
 * dak van één gebouw (de vlakken, de nok en de dakkapellen), in meters.
 *
 * global.huisMaatVorm = { rechthoeken, dakVan }; kit/huis-maat.js gebruikt ze en geeft dakVan door als huisMaat.dakVan.
 */
(function (global) {
  'use strict';

  /** De ruitjes van een vloer als zo weinig mogelijk rechthoeken per ruimte. */
  function rechthoeken(v, BUITEN) {
    const { W, H, cel } = v;
    const open = new Map();
    const uit = [];
    for (let y = 0; y <= H; y++) {
      const nu = new Set();
      if (y < H) {
        let x = 0;
        while (x < W) {
          const id = cel[y * W + x];
          let x1 = x + 1;
          while (x1 < W && cel[y * W + x1] === id) x1++;
          if (id !== BUITEN) {
            const sleutel = `${id}:${x}:${x1}`;
            nu.add(sleutel);
            if (!open.has(sleutel)) open.set(sleutel, { id, x0: x, x1, y0: y });
          }
          x = x1;
        }
      }
      for (const [sleutel, r] of [...open]) {
        if (nu.has(sleutel)) continue;
        uit.push({ ...r, y1: y });
        open.delete(sleutel);
      }
    }
    return uit;
  }

  /** Het dak van één gebouw: de vlakken met hun buitenkant (horizontaal), in meters. */
  function dakVan(b, standaard) {
    const haaks = b.nokLangs === 'y';
    const Q = (a, c, z) => (haaks ? [c, a, z] : [a, c, z]);
    const N = (na, nc) => (haaks ? [nc, na] : [na, nc]);
    const [a0, a1] = haaks ? [b.v, b.v + b.d] : [b.u, b.u + b.b];
    const [c0, c1] = haaks ? [b.u, b.u + b.b] : [b.v, b.v + b.d];
    const lessenaar = /lessenaar/.test(b.dak);
    const van0 = b.nokVan0 ?? (b.nokVanRechts != null ? c1 - c0 - b.nokVanRechts : lessenaar ? 0 : (c1 - c0) / 2);
    const cr = c0 + van0;
    const nok = b.nok ?? standaard.nok;
    const g0 = b.goot0 ?? b.gootLinks ?? (lessenaar && van0 <= 0 ? nok : standaard.goot);
    const g1 = b.goot1 ?? b.gootRechts ?? standaard.goot;
    const zl = Math.min(g0, g1);
    const inset = /schild/.test(b.dak) ? Math.max(0, Math.min((a1 - a0) / 2 - 0.2, Math.min(cr - c0, c1 - cr))) : 0;
    const [n0, n1] = [a0 + inset, a1 - inset];
    const vlakken = [];
    if (cr > c0) vlakken.push({ dak: true, kant: 0, n: N(0, -1), p: [Q(a0, c0, g0), Q(a1, c0, g0), Q(n1, cr, nok), Q(n0, cr, nok)] });
    if (cr < c1) vlakken.push({ dak: true, kant: 1, n: N(0, 1), p: [Q(a1, c1, g1), Q(a0, c1, g1), Q(n0, cr, nok), Q(n1, cr, nok)] });
    if (inset > 0) {
      vlakken.push({ dak: true, n: N(-1, 0), p: [Q(a0, c1, g1), Q(a0, c0, g0), Q(n0, cr, nok)] }, { dak: true, n: N(1, 0), p: [Q(a1, c0, g0), Q(a1, c1, g1), Q(n1, cr, nok)] });
    } else {
      // De puntgevels aan de uiteinden, vanaf de laagste goot.
      vlakken.push({ gevel: true, n: N(-1, 0), p: [Q(a0, c0, zl), Q(a0, c0, g0), Q(a0, cr, nok), Q(a0, c1, g1), Q(a0, c1, zl)] }, { gevel: true, n: N(1, 0), p: [Q(a1, c0, zl), Q(a1, c0, g0), Q(a1, cr, nok), Q(a1, c1, g1), Q(a1, c1, zl)] });
    }
    // Waar de goot hoger ligt dan de andere, loopt de gevel door tot die goot.
    if (g0 > zl) vlakken.push({ gevel: true, n: N(0, -1), p: [Q(a0, c0, zl), Q(a1, c0, zl), Q(a1, c0, g0), Q(a0, c0, g0)] });
    if (g1 > zl) vlakken.push({ gevel: true, n: N(0, 1), p: [Q(a0, c1, zl), Q(a1, c1, zl), Q(a1, c1, g1), Q(a0, c1, g1)] });
    // Dakkapellen: een kast op de kant van het dak, met een plat dak en een raam naar buiten; op een rij in het midden.
    const kapellen = [];
    const lijst = b.dakkapellen ?? [];
    const opKant = (k) => lijst.filter((x) => x.kant === k);
    for (const kant of [0, 1]) {
      const rij = opKant(kant);
      // Zonder plek (een oude schets): op een rij in het midden.
      const totaal = rij.reduce((n, x) => n + (x.breed ?? x.tot - x.van), 0) + Math.max(0, rij.length - 1) * 0.8;
      let a = (a0 + a1) / 2 - totaal / 2;
      for (const x of rij) {
        const breedte = x.breed ?? x.tot - x.van;
        const [ga, gb] = x.van != null ? [a0 + x.van, a0 + x.tot] : [a, a + breedte];
        a += breedte + 0.8;
        const g = kant === 0 ? g0 : g1;
        const cg = kant === 0 ? c0 : c1;
        const richting = kant === 0 ? 1 : -1;
        const breed = Math.abs(cr - cg);
        if (breed < 1 || nok - g < 1.2) continue;
        const dakZ = (c) => g + ((nok - g) * Math.abs(c - cg)) / breed;
        // Uit de kaart: de voorkant en de hoogte van het dakje; anders geschat.
        let cv = cg + richting * (x.voor ?? Math.min(0.7, breed * 0.25));
        let zv = dakZ(cv);
        /*
         * Een dakkapel staat op de bovenste etage (hij hoort bij de zolder, niet bij de etage
         * eronder). Komt zijn voorkant lager dan die vloer (een lange achterkant met een lage goot), dan schuift hij het dak
         * op tot waar het dak de vloer raakt.
         */
        if (standaard.vloer != null && zv < standaard.vloer) {
          zv = Math.min(nok - 1.4, standaard.vloer);
          cv = cg + (richting * (zv - g) * breed) / (nok - g);
        }
        const zt = Math.min(nok - 0.15, Math.max(x.boven ?? 0, zv + 1.5));
        const ca = cg + (richting * (zt - g) * breed) / (nok - g);
        kapellen.push({
          kant,
          voor: { n: N(0, -richting), p: [Q(ga, cv, zv), Q(gb, cv, zv), Q(gb, cv, zt), Q(ga, cv, zt)] },
          raam: [Q(ga + 0.25, cv - richting * 0.01, zv + 0.25), Q(gb - 0.25, cv - richting * 0.01, zv + 0.25), Q(gb - 0.25, cv - richting * 0.01, zt - 0.2), Q(ga + 0.25, cv - richting * 0.01, zt - 0.2)],
          boven: { p: [Q(ga, cv, zt), Q(gb, cv, zt), Q(gb, ca, zt), Q(ga, ca, zt)] },
          zijden: [{ n: N(-1, 0), p: [Q(ga, cv, zv), Q(ga, cv, zt), Q(ga, ca, zt)] }, { n: N(1, 0), p: [Q(gb, cv, zv), Q(gb, cv, zt), Q(gb, ca, zt)] }],
        });
      }
    }
    return { vlakken, nok, zl, Q, a0, a1, c0, c1, cr, g0, g1, n0, n1, kapellen };
  }

  global.huisMaatVorm = { rechthoeken, dakVan };
})(typeof window !== 'undefined' ? window : globalThis);
