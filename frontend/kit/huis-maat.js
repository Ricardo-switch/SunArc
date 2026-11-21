/*
 * SunArc: het huis op Thuis op echte maat (schets 13 november 2026, plan na
 * besluit 288 en 308).
 *
 * Het poppenhuis op Thuis tekent kamers op een rij per woningtype. Dit tekent
 * het huis zoals het in Je huis getekend is: de buitenkant van de gekozen bron
 * (goot, nok en dakvorm per gebouw), alle etages op hun hoogte, de ruimtes uit
 * de ruitjes en de apparaten op hun plek. Opengewerkt, zoals Ricardo koos: de
 * gevels naar de straat zijn glas met een lage borstwering, de binnenmuren
 * halfhoog, het dak aan de kant van de kijker doorzichtig. Vanaf de straat,
 * schuin van opzij. Een garage blijft dicht, met zijn naam op het dak.
 *
 * huisMaat.teken(tekenaar, breed, hoog, opties) geeft de inhoud van een svg.
 * De tekenaar is die van Je huis (huistekenen.maak), dus wat daar verandert
 * staat hier meteen goed.
 *
 * opties:
 *   hoek      draaien om het midden, in graden (0: de straat recht voor)
 *   hoogte    hoe hoog je kijkt, in graden (standaard 24)
 *   kamers    { kamer-id: { temp, zin, toon } }: toon goed | koelt | verwarmt | wacht | zon
 *   aan       [apparaat-id]: wat nu draait (een gloed om de stip)
 *   avond     de lampen die aan staan geven licht op de vloer
 *   panelen   { aantal, kant: 0 | 1 }, of een lijst daarvan: panelen op het dak van het hoofdhuis
 *   rand      ruimte om het huis, in pixels
 *   lucht     meters tussen de etages: uit elkaar geschoven, zodat je in elke etage kijkt (0: op elkaar)
 *   stil      geen namen in de tekening (de telefoon: daar staan de kamers eronder)
 *   buiten    wat om het huis ligt, in meters in de assen van de tekening:
 *             vlakken [{ p: [[x, y]...], soort: terras | oprit | pad | border }],
 *             gebouwen [{ x, y, b, d, h, dak?, h0?, naam?, buur?, kleur?, overstek? }] (een tuinhuis; buur: het huis ernaast, als schim;
 *             dak lessenaar loopt van h0 naar h; overstek { d, licht } bij een plat dak, aan de kant met de kleinste y),
 *             auto { x, y, b, d, kleur, laadt? }, apparaten [{ id, soort, x, y, z, naam? }] (soort licht, screen of deurbel; een deurbel met n: de richting van zijn muur)
 *
 * De wereld om het huis (20 november 2026, de schets Thuis met de nieuwe tekenaar: minstens zo mooi als het poppenhuis):
 *   buiten.erf     { x, y, b, d }: het perceel; dan is het eiland het erf, met een stoep aan de straat en aarde eronder
 *   buiten.units   [{ x, y, n: [nx, ny], aan? }]: buitenunits van de airco's tegen een muur
 *   buiten.laadpaal { x, y, n, laadt? }: een laadpaal tegen een muur; laadt hij, dan loopt de kabel naar de auto
 *   buiten.apparaten ook { soort: 'snoer', punten: [[x, y]...] } (lampjes langs de border) en { soort: 'paal' } (een lantaarn)
 *   buiten.vlakken soort ook gras (een lichter grasveld); een terras met meubels: true krijgt een tafel met stoelen
 *   buiten.gebouwen ook deur: 'voor' (een garagedeur aan de straatkant) en licht (het raam brandt)
 *   bomen     [{ x, y, h? }]: bomen in het seizoen van `seizoen` (lente, zomer, herfst, winter)
 *   hemel     { tijd: dag | ochtend | avond | nacht, wolken? }: de zon of de maan en de sterren achter het huis
 *   stroom    [{ pad: [[x, y, z]...], toon: violet | zon | mint, label? }]: een stroom die loopt, met zijn label
 *   schermen  { apparaat-id: procent open }: de stand van de screens voor de ramen (100 is open)
 *   passend   'huis' of 'dichtbij': alleen het huis in beeld (dichtbij: met wat er vlak naast staat), de randen lopen weg
 *   boven     pixels bovenin vrij (de kop op Thuis)
 *
 * De etages en het always-on display (21 november 2026):
 *   etage     één etage (id): op zijn eigen hoogte, zonder dak; de etage eronder en erboven een stukje wazig, de muren
 *             aan de kant van de kijker laag afgesneden, en een dakkapel van die etage als nis met raam
 *   meubels   meubels per soort kamer, uit de vaste lijst (kit/huis-modellen.js): nooit voor een raam, deur of dakkapel,
 *             niet over elkaar; past het niet, dan korter of weg
 *   gekozen   kamer-id: die kamer licht op
 *   geenEiland zonder grond eronder (een etage boven de begane grond zweeft)
 *   zonBoog   { nu, baan: [{ az, el, uur?, klok? }], voorDeg }: de baan van de zon om het huis, gedraaid naar het kompas
 *
 * De apparaten in huis, de dingen buiten (auto, laadpaal, buitenunit, tuinset) en de gebouwen (tuinhuis, garage,
 * schuurtje, carport, met buiten.gebouwen[].soort) komen uit dezelfde vaste lijst, elk met een voorkant.
 */
(function (global) {
  'use strict';
  const FONT = 'font-family="Figtree, system-ui, sans-serif"';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const TOON = { goed: '#6EE7B7', koelt: '#6FD3FF', verwarmt: '#FF7A4D', wacht: '#F7B548', zon: '#F7B548' };
  const DICHT = /garage|carport|schuur|berging/;

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
         * Een dakkapel staat op de bovenste etage (Ricardo, 21 november 2026: hij hoort bij de zolder, niet bij de etage
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

  function teken(t, B, Hpx, o = {}) {
    const K = global.huistekenen;
    const { MARGE, CEL, BUITEN, randen, isMuur, maten, omtrek, TINT, SOORT_TINT } = K;
    const st = t.st;
    const huis = t.huis;
    const bron = huis.bronnen?.[st.bron] ?? {};
    const goot = bron.goot ?? 6;
    const laagGoot = bron.gootLaag ?? goot;
    const nok = bron.nok ?? goot + 3;
    const etages = [...huis.etages].reverse();
    const m = (c) => (c - MARGE) * CEL;
    const kamerInfo = o.kamers ?? {};
    const aan = new Set(o.aan ?? []);

    // De lagen op hun hoogte, zoals in Je huis: de bovenste loopt tot de laagste goot.
    const bg = huis.beneden ? etages.findIndex((e) => e.id === huis.beneden) : 0;
    let z = -etages.slice(0, Math.max(0, bg)).reduce((n, e) => n + (e.hoogte ?? 2.5), 0);
    /** Waar de etage boven laag `li` begint (voor de trap), of null. */
    const erbovenOp = (li) => lagen[li + 1]?.z0 ?? null;
    const lagen = etages.map((e, i) => {
      const z0 = z;
      const top = i === etages.length - 1 ? Math.max(laagGoot, z0 + 0.4) : z0 + (e.hoogte ?? 2.8);
      z = top;
      return { e, z0, top, v: st.vloeren[e.id] };
    }).filter((l) => l.v && l.z0 >= -0.01);
    // Uit elkaar: elke etage een stukje hoger, zodat je in de etage eronder kijkt.
    const lucht = o.lucht ?? 0;
    lagen.forEach((l, i) => {
      l.z0 += i * lucht;
      l.top += i * lucht;
    });
    const dakOp = (lagen.length - 1) * lucht;
    lagen.forEach((l, i) => (l.bovenste = i === lagen.length - 1));
    /*
     * Eén etage (de etages op de kamerpagina; 21 november 2026, Ricardo): op zijn eigen hoogte, niet op de grond. De etage
     * eronder en erboven staan er een klein stukje wazig bij; de bovenste etage onder het dak alleen die eronder. De rest
     * valt weg, en het dak ook (het telt nog wel mee voor waar de muren ophouden).
     */
    const eenEtage = o.etage ? lagen.findIndex((l) => l.e.id === o.etage) : -1;
    const zWeg = 0;
    // Wazig erboven alleen bij een etage met ook een etage eronder; de begane grond staat alleen (Ricardo, 21 november 2026).
    if (eenEtage >= 0) lagen.forEach((l, i) => (l.vaag = i === eenEtage ? null : i === eenEtage - 1 ? 'onder' : i === eenEtage + 1 && eenEtage > 0 && !lagen[eenEtage].bovenste ? 'boven' : 'weg'));
    const metDak = eenEtage < 0;

    // Kijken: vanaf de straat, gedraaid om het midden, iets lager dan in Je huis zodat je de etages in kijkt.
    const om = omtrek(lagen[0].v);
    const [X0, Y0, X1, Y1] = [m(om.x0), m(om.y0), m(om.x1), m(om.y1)];
    const cx = (X0 + X1) / 2;
    const cy = (Y0 + Y1) / 2;
    const th = ((o.hoek ?? 28) * Math.PI) / 180;
    const ph = ((o.hoogte ?? 24) * Math.PI) / 180;
    const [co, si, cp, sp] = [Math.cos(th), Math.sin(th), Math.cos(ph), Math.sin(ph)];
    const diep = (x, y) => -(x - cx) * si + (y - cy) * co;
    const naarKijker = (nx, ny) => -nx * si + ny * co < -0.01;
    const kaal = (x, y, zz) => [(x - cx) * co + (y - cy) * si, -(diep(x, y) * sp + zz * cp)];

    // Het eiland: het perceel om het huis, met een dikte.
    const g = 2.6;
    const buiten = o.buiten ?? {};
    const bx = [X0, X1];
    const by = [Y0, Y1];
    for (const v of buiten.vlakken ?? []) for (const [x, y] of v.p) bx.push(x), by.push(y);
    for (const q of [...(buiten.gebouwen ?? []).filter((q) => !q.buur), ...(buiten.auto ? [buiten.auto] : [])]) bx.push(q.x, q.x + q.b), by.push(q.y, q.y + q.d);
    const erf = buiten.erf;
    // Met een erf: het eiland is het perceel, met aan de straatkant een stoep.
    const [E0, E1, F0, F1] = erf ? [erf.x - 0.2, erf.x + erf.b + 0.2, erf.y - 1.4, erf.y + erf.d + 0.2] : [Math.min(...bx) - (o.buiten ? 1.2 : g), Math.max(...bx) + (o.buiten ? 1.2 : g), Math.min(...by) - (o.buiten ? 1.2 : g), Math.max(...by) + (o.buiten ? 1.2 : g)];
    const dikte = erf ? 0.9 : 0.7;
    const eiland = [[E0, F0], [E1, F0], [E1, F1], [E0, F1]];
    const blokken = bron.blokken ?? [];
    // Met een afdak (ronde 2) begint het dak van het huis pas achter het afdak.
    const zonderAfdak = (b) => {
      const a = b.afdak;
      if (!a || b.nokLangs === 'y') return b;
      const van0 = b.nokVan0 ?? b.d / 2;
      return a.kant === 'voor' ? { ...b, v: b.v + a.diep, d: b.d - a.diep, nokVan0: van0 - a.diep } : { ...b, d: b.d - a.diep };
    };
    // Alleen de gebouwen die bij een etage van het huis horen; wat los op het erf staat (een tuinhuis) tekent buiten zelf.
    const opEtage = new Set(lagen.flatMap((l) => (l.e.blokken ?? []).map((b) => b.id)));
    const daken = blokken.filter((b) => /zadel|schild|lessenaar/.test(b.dak ?? '') && (!opEtage.size || opEtage.has(b.id))).map((b0) => {
      const b = zonderAfdak(b0);
      const d = dakVan(b, { goot, nok, vloer: lagen.length ? lagen[lagen.length - 1].z0 - (lagen.length - 1) * lucht : null });
      for (const v of d.vlakken) v.p = v.p.map(([x, y, zz]) => [x, y, zz + dakOp]);
      for (const kp of d.kapellen) for (const v of [kp.voor, kp.boven, ...kp.zijden]) v.p = v.p.map(([x, y, zz]) => [x, y, zz + dakOp]);
      for (const kp of d.kapellen) kp.raam = kp.raam.map(([x, y, zz]) => [x, y, zz + dakOp]);
      d.nok += dakOp;
      return { b, ...d };
    });
    /*
     * Onder het dak (19 november 2026, het huis van Ricardo): een lang achterdak
     * komt lager dan de etages erboven. Hoe hoog het dak van het hoofdhuis op
     * een plek is (Infinity buiten het hoofdhuis of bij een plat dak), zodat
     * muren daar ophouden en een vloer niet onder het dak uitsteekt.
     */
    const hd = daken.find((d) => d.b.soort === 'hoofdhuis');
    const dakZ = (x, y) => {
      if (!hd || !/zadel|schild/.test(hd.b.dak ?? '')) return Infinity;
      const haaks = hd.b.nokLangs === 'y';
      const [a, c] = haaks ? [y, x] : [x, y];
      if (a < hd.a0 - 0.01 || a > hd.a1 + 0.01 || c < hd.c0 - 0.01 || c > hd.c1 + 0.01) return Infinity;
      const z = c <= hd.cr ? hd.g0 + ((hd.nok - dakOp - hd.g0) * (c - hd.c0)) / Math.max(0.01, hd.cr - hd.c0) : hd.g1 + ((hd.nok - dakOp - hd.g1) * (hd.c1 - c)) / Math.max(0.01, hd.c1 - hd.cr);
      // Onder een dakkapel (21 november 2026) komt het plafond hoger: tot de bovenkant van de kapel.
      let zk = z;
      for (const kp of hd.kapellen ?? []) {
        const xs = kp.boven.p.map((q) => q[0]);
        const ys = kp.boven.p.map((q) => q[1]);
        if (x >= Math.min(...xs) - 0.01 && x <= Math.max(...xs) + 0.01 && y >= Math.min(...ys) - 0.01 && y <= Math.max(...ys) + 0.01) zk = Math.max(zk, Math.max(...kp.boven.p.map((q) => q[2])) - dakOp);
      }
      return zk + dakOp - zWeg;
    };
    /** Waar een vloer op hoogte `z` onder het dak ligt, langs de as dwars op de nok: [van, tot], of null zonder hoofdhuis. */
    const onderDakBereik = (z) => {
      if (!hd || !/zadel|schild/.test(hd.b.dak ?? '')) return null;
      const n = hd.nok - dakOp;
      const z1 = z + zWeg - dakOp;
      const van = hd.g0 >= z1 ? hd.c0 : hd.c0 + ((z1 - hd.g0) * (hd.cr - hd.c0)) / Math.max(0.01, n - hd.g0);
      const tot = hd.g1 >= z1 ? hd.c1 : hd.c1 - ((z1 - hd.g1) * (hd.c1 - hd.cr)) / Math.max(0.01, n - hd.g1);
      return { haaks: hd.b.nokLangs === 'y', van, tot, a0: hd.a0, a1: hd.a1 };
    };
    // Passend maken: alles wat er staat in beeld, met ruimte eromheen.
    // Passend: om alles wat er staat, of (passend: 'huis') alleen om het huis, zodat het groot in beeld staat en de tuin eromheen wegloopt.
    const alleenHuis = o.passend === 'huis' || o.passend === 'dichtbij';
    // Dichtbij (20 november 2026): het huis met wat er vlak naast staat en een paar meter grond, de rest van het erf loopt aan de rand zacht weg.
    const dichtbij = o.passend === 'dichtbij';
    const om2 = dichtbij ? 3.5 : 1;
    const punten = [...(alleenHuis ? [] : eiland.map(([x, y]) => [x, y, -dikte])), ...(alleenHuis ? [[X0 - om2, Y0 - om2, 0], [X1 + om2, Y0 - om2, 0], [X1 + om2, Y1 + om2, 0], [X0 - om2, Y1 + om2, 0]] : eiland.map(([x, y]) => [x, y, 0])), ...lagen.flatMap((l) => [[X0, Y0, l.top], [X1, Y0, l.top], [X1, Y1, l.top], [X0, Y1, l.top]]), ...(metDak ? daken.flatMap((d) => d.vlakken.flatMap((v) => v.p)) : [])];
    if (!alleenHuis) for (const q of buiten.gebouwen ?? []) if (!q.buur) punten.push([q.x, q.y, q.h + 1.5], [q.x + q.b, q.y + q.d, 0]);
    // Dichtbij: ook wat binnen een paar meter van het huis staat (de garage, de auto).
    if (dichtbij) for (const q of [...(buiten.gebouwen ?? []), ...(buiten.auto ? [buiten.auto] : [])]) if (!q.buur && q.x < X1 + 4 && q.x + q.b > X0 - 4 && q.y < Y1 + 4 && q.y + q.d > Y0 - 4) punten.push([q.x, q.y, (q.h ?? 1.4) + 0.5], [q.x + q.b, q.y + q.d, 0]);
    if (!alleenHuis) for (const bm of o.bomen ?? []) punten.push([bm.x, bm.y, (bm.h ?? 5) + 0.8]);
    /*
     * De zonneboog (21 november 2026, het always-on display; zoals de ring van de zon in het poppenhuis, besluit 205):
     * de baan van de zon van vandaag ruim om het huis, met het midden boven de nok, een stip per uur, de tijd van opkomst
     * en ondergang aan de uiteinden, en de zon van nu. `o.zonBoog`: { nu, baan: [{ az, el, uur?, klok? }], voorDeg }.
     */
    const zb = o.zonBoog?.baan?.length && o.zonBoog.voorDeg != null && eenEtage < 0 ? o.zonBoog : null;
    // Breed om het huis, en de hoogte wat opgerekt (de zon staat in november laag; echt op schaal kan niet, hij staat oneindig ver).
    const ringR = Math.max(X1 - X0, Y1 - Y0) * 1.0 + 4.5;
    const ringZ = (hd ? hd.nok : Math.max(...lagen.map((l) => l.top))) + 1.4;
    const ringPunt = ({ az, el }) => {
      const r = Math.PI / 180;
      const c = Math.cos(el * r);
      const rel = (az - zb.voorDeg) * r;
      /*
       * De voorgevel kijkt naar de straat (de kant met de kleinste y), en vanaf de straat ligt -x links: een zon een kwartslag
       * linksom van de voorgevel (az = voorgevel + 90°) staat links. Zo volgt de boog het kompas zoals in het poppenhuis.
       */
      return [cx - ringR * c * Math.sin(rel), cy - ringR * c * Math.cos(rel), ringZ + ringR * 1.4 * Math.sin(Math.max(0, el) * r)];
    };
    if (zb) for (const q of zb.baan) if (q.el > -1.5) punten.push(ringPunt(q));
    // Eén etage: alleen die etage met de wazige stukjes erboven en eronder in beeld (en een smalle rand grond, op de begane grond).
    if (eenEtage >= 0) {
      const L = lagen[eenEtage];
      const onderL = lagen[eenEtage - 1];
      const bovenL = L.bovenste || eenEtage === 0 ? null : lagen[eenEtage + 1];
      const zLaag = onderL ? onderL.top - 1.0 : L.z0 - 0.4;
      const zHoog = L.bovenste && hd ? hd.nok : bovenL ? bovenL.z0 + 0.6 : L.top;
      punten.length = 0;
      for (const zz of [zLaag, zHoog]) punten.push([X0, Y0, zz], [X1, Y0, zz], [X1, Y1, zz], [X0, Y1, zz]);
      if (!o.geenEiland) punten.push([E0, F0, 0], [E1, F0, 0], [E1, F1, 0], [E0, F1, 0]);
    }
    const kp = punten.map((p) => kaal(...p));
    const rand = o.rand ?? 18;
    const [minX, maxX, minY, maxY] = [Math.min(...kp.map((p) => p[0])), Math.max(...kp.map((p) => p[0])), Math.min(...kp.map((p) => p[1])), Math.max(...kp.map((p) => p[1]))];
    // `boven`: zoveel pixels bovenin vrij (op Thuis staat daar de kop).
    const boven = o.boven ?? 0;
    const k = Math.min((B - 2 * rand) / (maxX - minX), (Hpx - 2 * rand - boven) / (maxY - minY));
    const ox = B / 2 - ((minX + maxX) / 2) * k;
    const oy = (Hpx + boven) / 2 - ((minY + maxY) / 2) * k;
    const P = (x, y, zz) => {
      const [a, b] = kaal(x, y, zz);
      return [ox + a * k, oy + b * k];
    };
    const pt = (x, y, zz) => P(x, y, zz).map((n) => n.toFixed(1)).join(' ');
    const vlak = (pp) => `M${pp.map((p) => pt(...p)).join('L')}Z`;
    /** Een muur van het huis: niet hoger dan het dak op die plek. */
    const onder = ([x, y, zz]) => [x, y, Math.min(zz, dakZ(x, y))];
    // Komt het dak lager dan de vloer, dan valt de muur weg (hij hing anders onder de vloer, 20 november 2026).
    // Een staande muur [a onder, b onder, b boven, a boven] volgt het dak: langs de muur afgetast, alleen waar het dak boven de voet ligt.
    const vlakHuis = (pp) => {
      const [a, b, c, d] = pp;
      const staand = pp.length === 4 && a[2] === b[2] && c[2] === d[2] && a[0] === d[0] && a[1] === d[1] && b[0] === c[0] && b[1] === c[1];
      if (!staand) return vlak(pp.map(onder));
      const [voet, kop] = [a[2], d[2]];
      const N = 16;
      const langs = [];
      let heel = true;
      for (let i = 0; i <= N; i++) {
        const [x, y] = [a[0] + ((b[0] - a[0]) * i) / N, a[1] + ((b[1] - a[1]) * i) / N];
        const dz = dakZ(x, y);
        if (dz < kop) heel = false;
        if (dz > voet + 0.02) langs.push([x, y, Math.min(kop, dz)]);
      }
      if (heel) return vlak(pp);
      // Helemaal onder het dak verdwenen: niets (het randje bleef anders als losse streep in de lucht hangen).
      if (langs.length < 2) return '';
      return vlak([...langs.map(([x, y]) => [x, y, voet]), ...langs.reverse()]);
    };
    /** Het plafond op een plek: de bovenkant van de etage, of lager waar het dak lager komt (20 november 2026: niets zweeft meer boven het dak). */
    const plafond = (x, y, top) => Math.min(top, dakZ(x, y) - 0.08);
    const dp = (pp) => pp.reduce((n, q) => n + diep(q[0], q[1]), 0) / pp.length;
    /**
     * De hemel (20 november 2026): 's nachts een maan en sterren, overdag de zon met een gloed, 's avonds en
     * 's ochtends de zon laag en warm. Op het scherm, achter het huis; vaste plekken (geen toeval), zodat het niet springt.
     */
    const hemel = (hm) => {
      let x2 = '';
      const nacht = hm.tijd === 'nacht';
      const laag = hm.tijd === 'avond' || hm.tijd === 'ochtend';
      if (nacht || hm.tijd === 'avond') {
        let zaad = 7;
        const rnd = () => ((zaad = (zaad * 9301 + 49297) % 233280) / 233280);
        for (let i = 0; i < (nacht ? 46 : 16); i++) x2 += `<circle cx="${(rnd() * B).toFixed(0)}" cy="${(rnd() * Hpx * 0.55).toFixed(0)}" r="${(0.6 + rnd() * 1.1).toFixed(1)}" fill="#fff" opacity="${(0.2 + rnd() * 0.5).toFixed(2)}"/>`;
      }
      if (nacht) {
        const [mx, my, r] = [B * 0.62, Hpx * 0.14, 15];
        x2 += `<circle cx="${mx}" cy="${my}" r="${r * 2.6}" fill="#e8eef8" opacity="0.06"/><circle cx="${mx}" cy="${my}" r="${r}" fill="#e9eef6"/><circle cx="${mx + r * 0.42}" cy="${my - r * 0.25}" r="${r * 0.88}" fill="#16203a"/>`;
      } else {
        const [zx, zy, r] = laag ? [hm.tijd === 'avond' ? B * 0.86 : B * 0.14, Hpx * 0.34, 16] : [B * 0.8, Hpx * 0.12, 18];
        x2 += `<circle cx="${zx}" cy="${zy}" r="${r * 3.4}" fill="url(#hm-zongloed)" opacity="${(0.55 - 0.3 * (hm.wolken ?? 0)).toFixed(2)}"/><circle cx="${zx}" cy="${zy}" r="${r}" fill="${laag ? '#ffb86b' : '#ffd27a'}" opacity="${(1 - 0.5 * (hm.wolken ?? 0)).toFixed(2)}"/>`;
      }
      return `<defs><radialGradient id="hm-zongloed"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.7"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs>${x2}`;
    };

    let s = `<defs><linearGradient id="hm-aarde1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a4232"/><stop offset="1" stop-color="#2a1d15"/></linearGradient><linearGradient id="hm-aarde2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3528"/><stop offset="1" stop-color="#21170f"/></linearGradient><filter id="hm-zacht" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="8"/></filter><filter id="hm-wazig" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.6"/></filter></defs><defs><radialGradient id="hm-gloed"><stop offset="0" stop-color="#fff" stop-opacity="0.9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><linearGradient id="hm-glas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe6ff" stop-opacity="0.10"/><stop offset="1" stop-color="#bfe6ff" stop-opacity="0.03"/></linearGradient></defs>`;

    const labels = [];
    /** Een doos van x0..x1, y0..y1, z0..z1: de twee zijkanten naar de kijker en de bovenkant. Kleuren: [boven, zijkant x, zijkant y]. */
    const doos3 = (x0, x1, y0, y1, z0, z1, kl) => {
      const [a0, a1] = [Math.min(x0, x1), Math.max(x0, x1)];
      const [b0, b1] = [Math.min(y0, y1), Math.max(y0, y1)];
      const xKant = naarKijker(-1, 0) ? a0 : a1;
      const yKant = naarKijker(0, -1) ? b0 : b1;
      const zx = `<path d="${vlak([[xKant, b0, z0], [xKant, b1, z0], [xKant, b1, z1], [xKant, b0, z1]])}" fill="${kl[1]}"/>`;
      const zy = `<path d="${vlak([[a0, yKant, z0], [a1, yKant, z0], [a1, yKant, z1], [a0, yKant, z1]])}" fill="${kl[2]}"/>`;
      return zx + zy + `<path d="${vlak([[a0, b0, z1], [a1, b0, z1], [a1, b1, z1], [a0, b1, z1]])}" fill="${kl[0]}" stroke="rgb(13 26 48 / 0.25)" stroke-width="0.5"/>`;
    };
    /** Een cirkel op een staand vlak (de trommel van een droger): `as` is de as waar het vlak haaks op staat. */
    const cirkel = (cx, cy, cz, r, as, attr) => {
      const pp = [];
      for (let i = 0; i < 18; i++) {
        const h = (i / 18) * 2 * Math.PI;
        pp.push(as === 'x' ? [cx, cy + Math.cos(h) * r, cz + Math.sin(h) * r] : [cx + Math.cos(h) * r, cy, cz + Math.sin(h) * r]);
      }
      return `<path d="${vlak(pp)}" ${attr}/>`;
    };
    /*
     * Een model uit de vaste lijst (kit/huis-modellen.js, 21 november 2026) neerzetten. `p` is { x, y, z }: het punt op de
     * muur, de vloer of het plafond waar het model staat, met `wand` 'x' of 'y' (langs welke as `a` loopt: bij 'x' langs y)
     * en `kant` +1 of -1: de kant waar de voorkant naartoe kijkt (de kamer in). Geeft { s, d, rect } of null.
     */
    const MOD = global.huisModellen;
    const zetModel = (naam, p, opt = {}) => {
      const M = MOD?.MODELLEN?.[naam];
      if (!M) return null;
      const b = opt.b ?? M.b;
      const wand = p.wand ?? 'y';
      const kant = p.kant ?? 1;
      const W = (a, d, zz) => (wand === 'x' ? [p.x + kant * d, p.y + a, p.z + zz] : [p.x + a, p.y + kant * d, p.z + zz]);
      const kl = (n) => (Array.isArray(n) ? n : MOD.KLEUR[n] ?? MOD.KLEUR.kast);
      opt = { ...opt, wand };
      const dozen = M.delen(b, opt).map(([a0, a1, d0, d1, z0, z1, kleur, smal]) => {
        const [q0, q1] = [W(a0, d0, z0), W(a1, d1, z1)];
        return { x: Math.min(q0[0], q1[0]), b: Math.abs(q1[0] - q0[0]), y: Math.min(q0[1], q1[1]), d: Math.abs(q1[1] - q0[1]), z0: q0[2], z1: q1[2], kleur, smal, deel: [a0, a1, d0, d1, z0, z1] };
      });
      // Van achter naar voren, op de randen; boven elkaar: het hoogste het laatst.
      const [du, dv] = [-si, co];
      const voorDan = (A, B) => {
        if (A.x + A.b <= B.x + 1e-6) return du > 0;
        if (B.x + B.b <= A.x + 1e-6) return du < 0;
        if (A.y + A.d <= B.y + 1e-6) return dv > 0;
        if (B.y + B.d <= A.y + 1e-6) return dv < 0;
        return A.z0 >= B.z1 - 1e-6 || (A.z1 > B.z1 && A.z0 >= B.z0);
      };
      const rest = [...dozen];
      const volg = [];
      while (rest.length) {
        let i = rest.findIndex((A) => rest.every((B) => B === A || voorDan(B, A)));
        if (i < 0) i = 0;
        volg.push(...rest.splice(i, 1));
      }
      let s2 = '';
      for (const q of volg) {
        if (q.smal) {
          // Een blok dat naar boven smaller wordt (de cabine van een auto): de bovenkant ingesprongen.
          const [a0, a1, d0, d1, z0, z1] = q.deel;
          const [ia, id] = q.smal;
          const onderP = [W(a0, d0, z0), W(a1, d0, z0), W(a1, d1, z0), W(a0, d1, z0)];
          const bovenP = [W(a0 + ia, d0 + id, z1), W(a1 - ia, d0 + id, z1), W(a1 - ia, d1 - id, z1), W(a0 + ia, d1 - id, z1)];
          const draai = (wand === 'x') !== (kant < 0);
          const [on, bo] = draai ? [[...onderP].reverse(), [...bovenP].reverse()] : [onderP, bovenP];
          const k3 = kl(q.kleur);
          s2 += prisma(on, bo, (v) => (Math.abs(v.n[0]) > Math.abs(v.n[1]) ? k3[1] : k3[2]), k3[0]);
        } else s2 += doos3(q.x, q.x + q.b, q.y, q.y + q.d, q.z0, q.z1, kl(q.kleur));
      }
      const tekenDetail = (v, dV, as) => {
        if (v.cirkel) {
          const [a, zz, r] = v.cirkel;
          const c = W(a, dV, zz);
          return cirkel(c[0], c[1], c[2], r, as, `fill="${v.vul ?? 'none'}"${v.rand ? ` stroke="${v.rand}" stroke-width="${v.dik ?? 1}"` : ''}${v.streep ? ' stroke-dasharray="3 3"' : ''}${v.klasse ? ` class="${v.klasse}"` : ''}`);
        }
        if (v.lijn) {
          const [a0, z0, a1, z1] = v.lijn;
          return `<path d="M${pt(...W(a0, dV, z0))}L${pt(...W(a1, dV, z1))}" stroke="${v.rand ?? '#9aa7b4'}" stroke-width="${v.dik ?? 0.8}"/>`;
        }
        if (v.vlak) {
          const [a0, z0, a1, z1] = v.vlak;
          return `<path d="${vlak([W(a0, dV, z0), W(a1, dV, z0), W(a1, dV, z1), W(a0, dV, z1)])}" fill="${v.vul}"${v.doorzicht ? ` fill-opacity="${v.doorzicht}"` : ''}${v.rand ? ` stroke="${v.rand}" stroke-width="${v.dik ?? 1}"` : ''}/>`;
        }
        return '';
      };
      // De voorkant (de kant van de kamer), alleen als je hem ziet.
      const n = wand === 'x' ? [kant, 0] : [0, kant];
      const dV = (typeof M.voorD === 'function' ? M.voorD(b, opt) : M.voorD ?? opt.d ?? M.d) + 0.004;
      const voor = [...(M.voor?.(b, opt) ?? []), ...(opt.aan ? M.aanVoor?.(b, opt) ?? [] : [])];
      if (naarKijker(...n)) for (const v of voor) s2 += tekenDetail(v, dV, wand);
      // De achterkant (de achterlichten van een auto).
      if (!naarKijker(...n)) for (const v of M.achter?.(b, opt) ?? []) s2 += tekenDetail(v, -0.004 + (M.achterD ?? 0), wand);
      // De zijkant die je ziet (de wielen van een auto): `zij` met cirkels op [d, z, r].
      if (M.zij) {
        // De zijkant die je ziet: a = +b/2 ligt bij wand 'x' langs +y, bij 'y' langs +x; die kant is zichtbaar als hij naar de kijker wijst.
        const nZij = wand === 'x' ? [0, 1] : [1, 0];
        const aZij = naarKijker(...nZij) ? b / 2 + 0.01 : -b / 2 - 0.01;
        const asZij = wand === 'x' ? 'y' : 'x';
        for (const v of M.zij(b, opt)) {
          if (v.cirkel) {
            const [d, zz, r] = v.cirkel;
            const c = W(aZij, d, zz);
            s2 += cirkel(c[0], c[1], c[2], r, asZij, `fill="${v.vul ?? '#151c26'}"${v.rand ? ` stroke="${v.rand}" stroke-width="${v.dik ?? 1}"` : ''}`);
          } else if (v.lijn) {
            const [d0, z0, d1, z1] = v.lijn;
            s2 += `<path d="M${pt(...W(aZij, d0, z0))}L${pt(...W(aZij, d1, z1))}" stroke="${v.rand ?? '#9aa7b4'}" stroke-width="${v.dik ?? 0.8}"/>`;
          } else if (v.vlak) {
            const [d0, z0, d1, z1] = v.vlak;
            s2 += `<path d="${vlak([W(aZij, d0, z0), W(aZij, d1, z0), W(aZij, d1, z1), W(aZij, d0, z1)])}" fill="${v.vul}"${v.rand ? ` stroke="${v.rand}" stroke-width="${v.dik ?? 1}"` : ''}/>`;
          }
        }
      }
      for (const v of M.boven?.(b, opt) ?? []) {
        if (v.rect) {
          const [a0, d0, a1, d1, zz] = v.rect;
          s2 += `<path d="${vlak([W(a0, d0, zz), W(a1, d0, zz), W(a1, d1, zz), W(a0, d1, zz)])}" fill="${v.vul}"/>`;
        } else if (v.rond) {
          const [a, d, r, zz] = v.rond;
          const pp = Array.from({ length: 14 }, (_, i) => W(a + r * Math.cos((i / 14) * 2 * Math.PI), d + r * Math.sin((i / 14) * 2 * Math.PI), zz));
          s2 += `<path d="${vlak(pp)}" fill="none" stroke="${v.rand ?? '#5c6876'}" stroke-width="1"/>`;
        }
      }
      const x0 = Math.min(...dozen.map((q) => q.x));
      const x1 = Math.max(...dozen.map((q) => q.x + q.b));
      const y0 = Math.min(...dozen.map((q) => q.y));
      const y1 = Math.max(...dozen.map((q) => q.y + q.d));
      return { s: s2, d: diep((x0 + x1) / 2, (y0 + y1) / 2), rect: { x: x0, b: x1 - x0, y: y0, d: y1 - y0 }, W };
    };
    // De hemel achter het huis: de maan en de sterren, of de zon (eerst, zodat alles erover valt).
    if (o.hemel) s += hemel(o.hemel);
    /**
     * De zonneboog zoals in het poppenhuis: een stippellijn, een stip per uur met om de drie uur het uur erbij, aan de
     * uiteinden een halve zon met de tijd van opkomst (↑) en ondergang (↓), en de zon van nu met stralen en een bundel
     * licht naar het huis. Het stuk achter het huis eerst, het stuk ervoor als laatste.
     */
    const zonneboog = (achter) => {
      if (!zb) return '';
      const mid = diep(cx, cy);
      const pp = zb.baan.filter((q) => q.el > -1.5).map((q) => ({ q, w: ringPunt(q) }));
      const isAchter = (w) => diep(w[0], w[1]) > mid;
      let x2 = '';
      for (let i = 0; i + 1 < pp.length; i++) {
        const [a, b] = [pp[i].w, pp[i + 1].w];
        if (isAchter([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]) !== achter) continue;
        x2 += `<path d="M${pt(...a)}L${pt(...b)}" stroke="#f7b548" stroke-opacity="${achter ? 0.4 : 0.75}" stroke-width="1.5" stroke-dasharray="3 4" stroke-linecap="round"/>`;
      }
      const laatste = pp.length - 1;
      pp.forEach(({ q, w }, i) => {
        if (isAchter(w) !== achter) return;
        const p2 = P(...w);
        const tekst = (t2, dy) => `<text x="${p2[0].toFixed(1)}" y="${(p2[1] + dy).toFixed(1)}" text-anchor="middle" ${FONT} font-size="11" font-weight="700" fill="#f3d8a8" paint-order="stroke" stroke="#0d1a30" stroke-width="3" stroke-linejoin="round">${esc(t2)}</text>`;
        if (q.klok && (i === 0 || i === laatste)) {
          // Een halve zon op de horizon, met de tijd.
          x2 += `<path d="M${(p2[0] - 8).toFixed(1)} ${p2[1].toFixed(1)}A8 8 0 0 1 ${(p2[0] + 8).toFixed(1)} ${p2[1].toFixed(1)}Z" fill="#f59a5b"/>`;
          x2 += tekst(`${i === 0 ? '↑' : '↓'} ${q.klok}`, 15);
        } else if (q.uur != null) {
          x2 += `<circle cx="${p2[0].toFixed(1)}" cy="${p2[1].toFixed(1)}" r="2.4" fill="#f7b548" opacity="${achter ? 0.55 : 0.95}"/>`;
          if (q.uur % 3 === 0) x2 += tekst(String(q.uur), -8);
        }
      });
      const nu = zb.nu;
      if (nu && nu.el > -2) {
        const w = ringPunt(nu);
        if (isAchter(w) === achter) {
          const p2 = P(...w);
          // Een bundel licht van de zon naar het huis.
          const doel = [P(X0, cy, ringZ - 3), P(X1, cy, ringZ - 3), P(cx, cy, 0)];
          const [l, r] = doel.slice(0, 2).sort((a, b) => Math.atan2(a[1] - p2[1], a[0] - p2[0]) - Math.atan2(b[1] - p2[1], b[0] - p2[0]));
          x2 += `<defs><linearGradient id="hm-bundel" gradientUnits="userSpaceOnUse" x1="${p2[0].toFixed(1)}" y1="${p2[1].toFixed(1)}" x2="${doel[2][0].toFixed(1)}" y2="${doel[2][1].toFixed(1)}"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.32"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></linearGradient></defs>`;
          x2 += `<path d="M${p2[0].toFixed(1)} ${p2[1].toFixed(1)}L${l[0].toFixed(1)} ${l[1].toFixed(1)}L${doel[2][0].toFixed(1)} ${doel[2][1].toFixed(1)}L${r[0].toFixed(1)} ${r[1].toFixed(1)}Z" fill="url(#hm-bundel)"/>`;
          x2 += `<circle cx="${p2[0].toFixed(1)}" cy="${p2[1].toFixed(1)}" r="24" fill="#ffd27a" opacity="0.16"/>`;
          for (let i = 0; i < 12; i++) {
            const h = (i / 12) * 2 * Math.PI;
            x2 += `<path d="M${(p2[0] + Math.cos(h) * 11).toFixed(1)} ${(p2[1] + Math.sin(h) * 11).toFixed(1)}L${(p2[0] + Math.cos(h) * 15).toFixed(1)} ${(p2[1] + Math.sin(h) * 15).toFixed(1)}" stroke="#ffd27a" stroke-width="1.6" stroke-linecap="round"/>`;
          }
          x2 += `<circle cx="${p2[0].toFixed(1)}" cy="${p2[1].toFixed(1)}" r="8" fill="#ffd27a"/>`;
        }
      }
      return x2;
    };
    s += zonneboog(true);
    // Het eiland: de zijkanten naar de kijker, dan het gras. Met een erf: een zachte schaduw, een randje gras en aarde in lagen.
    // Zonder eiland (een etage boven de begane grond zweeft, 21 november 2026).
    if (!o.geenEiland) {
      const zijden = [];
      if (erf) {
        const c = P((E0 + E1) / 2, (F0 + F1) / 2, -dikte - 0.4);
        s += `<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(((E1 - E0) + (F1 - F0)) * 0.42 * k).toFixed(1)}" ry="${(((E1 - E0) + (F1 - F0)) * 0.16 * k).toFixed(1)}" fill="#000" opacity="0.28" filter="url(#hm-zacht)"/>`;
      }
      for (let i = 0; i < 4; i++) {
        const [a, b] = [eiland[i], eiland[(i + 1) % 4]];
        const n = [b[1] - a[1], -(b[0] - a[0])];
        if (!naarKijker(n[0], n[1])) continue;
        if (!erf) {
          zijden.push(`<path d="${vlak([[...a, 0], [...b, 0], [...b, -0.7], [...a, -0.7]])}" fill="${i % 2 ? '#1a2a24' : '#14211d'}"/>`);
          continue;
        }
        const licht = Math.abs(n[0]) > Math.abs(n[1]);
        zijden.push(`<path d="${vlak([[...a, -0.16], [...b, -0.16], [...b, -dikte], [...a, -dikte]])}" fill="url(#hm-aarde${licht ? '1' : '2'})"/>`);
        zijden.push(`<path d="${vlak([[...a, 0], [...b, 0], [...b, -0.16], [...a, -0.16]])}" fill="${licht ? '#3f6f4c' : '#335c3f'}"/>`);
        // Een paar steentjes in de aarde.
        for (let j = 1; j < 6; j++) {
          const f = (j + 0.37 * ((i * 7 + j * 3) % 5) / 5) / 6.4;
          const q = P(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, -0.5 - ((i + j * 2) % 3) * 0.28);
          zijden.push(`<ellipse cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" rx="${(0.16 * k).toFixed(1)}" ry="${(0.09 * k).toFixed(1)}" fill="#6b5442" opacity="0.55"/>`);
        }
      }
      s += zijden.join('');
      s += `<path d="${vlak(eiland.map(([x, y]) => [x, y, 0]))}" fill="#264233" stroke="rgb(110 231 183 / 0.22)"/>`;
      // De stoep aan de straatkant: tegels tot het erf.
      if (erf) {
        s += `<path d="${vlak([[E0, F0, 0.01], [E1, F0, 0.01], [E1, erf.y - 0.05, 0.01], [E0, erf.y - 0.05, 0.01]])}" fill="#4f5a67" stroke="#6b7685" stroke-width="0.6"/>`;
        for (let x = E0 + 1.2; x < E1 - 0.2; x += 1.2) s += `<path d="M${pt(x, F0, 0.012)}L${pt(x, erf.y - 0.05, 0.012)}" stroke="#66717e" stroke-width="0.6"/>`;
        s += `<path d="M${pt(E0, F0 + 0.35, 0.012)}L${pt(E1, F0 + 0.35, 0.012)}" stroke="#8a95a2" stroke-width="1"/>`;
      }
    }
    // Buiten: eerst de grond (terras, oprit, border), dan wat achter het huis staat; wat ervoor staat komt na het huis.
    const GROND = { terras: ['#6a5f50', '#97866d'], oprit: ['#3c4655', '#5c6878'], pad: ['#4a5260', '#6b7686'], border: ['#2e5a3c', '#4f8a5f'], gras: ['#2f5a40', '#3f7352'] };
    for (const v of buiten.vlakken ?? []) {
      const [vul, rand] = GROND[v.soort] ?? GROND.pad;
      s += `<path d="${vlak(v.p.map(([x, y]) => [x, y, 0.02]))}" fill="${vul}" stroke="${rand}" stroke-width="0.8"/>`;
      // Tegels op een terras en een oprit: een raster van lijnen, langs de assen.
      if (v.soort === 'terras' || v.soort === 'oprit') {
        const xs = v.p.map((q) => q[0]);
        const ys = v.p.map((q) => q[1]);
        const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
        const stap = v.soort === 'terras' ? 0.6 : 0.9;
        let lijnen = '';
        for (let x = x0 + stap; x < x1 - 0.05; x += stap) lijnen += `M${pt(x, y0, 0.021)}L${pt(x, y1, 0.021)}`;
        for (let y = y0 + stap; y < y1 - 0.05; y += stap) lijnen += `M${pt(x0, y, 0.021)}L${pt(x1, y, 0.021)}`;
        s += `<path d="${lijnen}" stroke="${rand}" stroke-opacity="0.35" stroke-width="0.6"/>`;
      }
      if (v.soort === 'border') {
        // Struiken: een paar bolletjes langs de rand.
        // Langs het midden van het vak, in de lengte (eerst over de diagonaal: scheef, Ricardo 19-11).
        const [p0, p1, p2, p3] = v.p;
        const lang = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) >= Math.hypot(p3[0] - p0[0], p3[1] - p0[1]);
        const mid = (q, r) => [(q[0] + r[0]) / 2, (q[1] + r[1]) / 2];
        const [a, b] = lang ? [mid(p0, p3), mid(p1, p2)] : [mid(p0, p1), mid(p3, p2)];
        const n = Math.max(2, Math.min(8, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.8)));
        for (let i = 0; i < n; i++) {
          const f = (i + 0.5) / n;
          const q = P(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 0.35);
          s += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${(0.45 * k).toFixed(1)}" fill="#3f7a52" stroke="#5fa577" stroke-opacity="0.5"/>`;
        }
      }
    }
    /*
     * Wat dichterbij staat (20 november 2026): op de randen, niet op het midden. Een lange garage naast het
     * huis viel op zijn midden over de auto en door het huis heen. Liggen twee dingen aan weerskanten van
     * een rechte lijn op de grond, dan staat het ding aan de kant van de kijker voor; anders telt het midden.
     */
    const dichterbij = (a, b) => {
      const [du, dv] = [-si, co];
      if (a.x + a.b <= b.x + 1e-6) return du > 0;
      if (b.x + b.b <= a.x + 1e-6) return du < 0;
      if (a.y + a.d <= b.y + 1e-6) return dv > 0;
      if (b.y + b.d <= a.y + 1e-6) return dv < 0;
      return diep(a.x + a.b / 2, a.y + a.d / 2) < diep(b.x + b.b / 2, b.y + b.d / 2);
    };
    const huisDoos = { x: X0, y: Y0, b: X1 - X0, d: Y1 - Y0 };
    const voorHuis = [];
    const achterHuis = [];
    const naarKant = (q) => (dichterbij(q, huisDoos) ? voorHuis : achterHuis);
    for (const q of buiten.gebouwen ?? []) naarKant(q).push({ soort: q.soort === 'tuinhuis' ? 'tuinhuis' : 'gebouw', q });
    if (buiten.auto) naarKant(buiten.auto).push({ soort: 'auto', q: buiten.auto });
    // Bomen, buitenunits, de laadpaal en de terrasmeubels: als kleine dingen, voor of achter het huis.
    const klein = (x, y) => ({ x: x - 0.01, y: y - 0.01, b: 0.02, d: 0.02 });
    const opPlek = (x, y) => naarKant(klein(x, y));
    for (const bm of o.bomen ?? []) opPlek(bm.x, bm.y).push({ soort: 'boom', q: { ...klein(bm.x, bm.y), bm } });
    for (const u of buiten.units ?? []) opPlek(u.x, u.y).push({ soort: 'unit', q: { ...klein(u.x, u.y), u } });
    if (buiten.laadpaal) opPlek(buiten.laadpaal.x, buiten.laadpaal.y).push({ soort: 'laadpaal', q: { ...klein(buiten.laadpaal.x, buiten.laadpaal.y), l: buiten.laadpaal } });
    for (const v of buiten.vlakken ?? []) {
      if (v.soort !== 'terras' || !v.meubels) continue;
      const xs = v.p.map((q) => q[0]);
      const ys = v.p.map((q) => q[1]);
      const [mx, my] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
      opPlek(mx, my).push({ soort: 'tafel', q: { ...klein(mx, my), mx, my } });
    }
    /** Een doos: de vier wanden van achter naar voren, dan de bovenkant (plat of een zadeldak). */
    const doos = (q, kleur) => {
      const { x, y, b, d, h } = q;
      const hoeken = [[x, y], [x + b, y], [x + b, y + d], [x, y + d]];
      // Een lessenaar (een afdak): laag (`h0`) aan de kant met de kleinste y, hoog (`h`) aan de andere kant.
      const les = /lessenaar/.test(q.dak ?? '');
      const hoogOp = ([, c]) => (les && c <= y + 1e-6 ? (q.h0 ?? h) : h);
      const wanden = [0, 1, 2, 3].map((i) => {
        const [a, c] = [hoeken[i], hoeken[(i + 1) % 4]];
        return { p: [[...a, 0], [...c, 0], [...c, hoogOp(c)], [...a, hoogOp(a)]], n: [c[1] - a[1], -(c[0] - a[0])] };
      });
      let x2 = '';
      for (const w of wanden.sort((p1, p2) => dp(p2.p) - dp(p1.p))) {
        if (!naarKijker(...w.n) && !q.buur) continue;
        x2 += `<path d="${vlak(w.p)}" fill="${kleur[Math.abs(w.n[0]) > Math.abs(w.n[1]) ? 0 : 1]}" ${q.buur ? 'stroke="rgb(255 255 255 / 0.1)" stroke-dasharray="3 5"' : 'stroke="rgb(13 26 48 / 0.5)" stroke-width="0.7"'} stroke-linejoin="round"/>`;
      }
      if (/zadel/.test(q.dak ?? '')) {
        const dk = dakVan({ u: x, v: y, b, d, dak: 'zadeldak', nok: h + Math.min(b, d) * 0.45, goot0: h, goot1: h }, { goot: h, nok: h + 1 });
        for (const v of dk.vlakken.sort((p1, p2) => dp(p2.p) - dp(p1.p))) x2 += `<path d="${vlak(v.p)}" fill="${v.gevel ? kleur[0] : naarKijker(...v.n) ? kleur[2] : kleur[3]}" stroke="rgb(13 26 48 / 0.5)" stroke-width="0.7" stroke-linejoin="round"/>`;
      } else x2 += `<path d="${vlak(hoeken.map(([a, c]) => [a, c, hoogOp([a, c])]))}" fill="${kleur[2]}" ${q.buur ? 'stroke="rgb(255 255 255 / 0.2)" stroke-dasharray="4 4"' : 'stroke="rgb(13 26 48 / 0.5)"'}/>`;
      // Een overstek (het tuinhuis zoals op Thuis nu): het platte dak loopt aan de kant met de kleinste y door, iets aflopend, met licht eronder.
      if (q.overstek && !/zadel/.test(q.dak ?? '')) {
        const od = q.overstek.d ?? 1.5;
        const plaat = [[x - 0.1, y, h + 0.05], [x + b + 0.1, y, h + 0.05], [x + b + 0.1, y - od, h - 0.05], [x - 0.1, y - od, h - 0.05]];
        if (q.overstek.licht) {
          const c = P(x + b / 2, y - od / 2, 0.02);
          x2 += `<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(b * 0.45 * k).toFixed(1)}" ry="${(od * 0.35 * k).toFixed(1)}" fill="#FFD39A" opacity="0.22"/>`;
        }
        x2 += `<path d="${vlak(plaat)}" fill="#55626f" stroke="rgb(13 26 48 / 0.5)" stroke-width="0.7" stroke-linejoin="round"/>`;
      }
      // Een garagedeur aan de straatkant (de kant met de kleinste y): panelen met lijnen.
      if (q.deur === 'voor' && naarKijker(0, -1)) {
        const dx = Math.min(2.6, b - 0.4);
        const xa = x + (b - dx) / 2;
        x2 += `<path d="${vlak([[xa, y - 0.01, 0], [xa + dx, y - 0.01, 0], [xa + dx, y - 0.01, Math.min(2.2, h - 0.25)], [xa, y - 0.01, Math.min(2.2, h - 0.25)]])}" fill="#4d5a6a" stroke="#7a8796" stroke-width="0.8"/>`;
        for (let zz = 0.45; zz < Math.min(2.2, h - 0.25); zz += 0.45) x2 += `<path d="M${pt(xa, y - 0.012, zz)}L${pt(xa + dx, y - 0.012, zz)}" stroke="#7a8796" stroke-width="0.7" stroke-opacity="0.8"/>`;
      }
      // Een raam aan de kant van de kijker; brandt het licht binnen, dan warm.
      if (q.raam) {
        const kant = naarKijker(-1, 0) ? x - 0.01 : x + b + 0.01;
        const raam = [[kant, y + d * 0.3, 0.9], [kant, y + d * 0.7, 0.9], [kant, y + d * 0.7, 1.7], [kant, y + d * 0.3, 1.7]];
        x2 += `<path d="${vlak(raam)}" fill="${q.licht ? '#f3c77a' : '#8fb4d6'}" fill-opacity="${q.licht ? 0.75 : 0.35}" stroke="#c9d6e2" stroke-opacity="0.5" stroke-width="0.8"/>`;
      }
      if (q.naam && !o.stil) {
        const p = P(x + b / 2, y + d / 2, (/zadel/.test(q.dak ?? '') ? h + Math.min(b, d) * 0.45 : h) + 0.4);
        labels.push({ x: p[0] - q.naam.length * 3.6, y: p[1] - 10, b: q.naam.length * 7.2, h: 16, prio: 1, s: `<text x="${p[0].toFixed(1)}" y="${(p[1] + 4).toFixed(1)}" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="#dfe6ec" paint-order="stroke" stroke="#0d1a30" stroke-width="3.5" stroke-linejoin="round">${esc(q.naam)}</text>` });
      }
      return x2;
    };
    /** Een blok met een andere boven- en onderkant (vier hoeken elk): de zijden naar de kijker, dan de bovenkant. */
    const prisma = (onder, boven, zij, top) => {
      let x2 = '';
      const vlakken = [0, 1, 2, 3].map((i) => {
        const [a, b] = [onder[i], onder[(i + 1) % 4]];
        return { p: [a, b, boven[(i + 1) % 4], boven[i]], n: [b[1] - a[1], -(b[0] - a[0])] };
      });
      for (const v of vlakken.sort((p1, p2) => dp(p2.p) - dp(p1.p))) if (naarKijker(...v.n)) x2 += `<path d="${vlak(v.p)}" fill="${zij(v)}" stroke="rgb(13 26 48 / 0.35)" stroke-width="0.6" stroke-linejoin="round"/>`;
      return x2 + `<path d="${vlak(boven)}" fill="${top}" stroke="rgb(13 26 48 / 0.35)" stroke-width="0.6" stroke-linejoin="round"/>`;
    };
    /** De auto: een lage carrosserie op wielen, een cabine met ramen, en een bliksem als hij laadt. */
    /** De auto, uit de vaste lijst: met de neus naar de korte kant met de kleinste y of x (de straat), een schaduw, en een bliksem als hij laadt. */
    const auto = (q) => {
      const lang = q.d > q.b;
      const [breed, lengte] = lang ? [q.b, q.d] : [q.d, q.b];
      const pl = lang ? { x: q.x + q.b / 2, y: q.y + q.d, z: 0, wand: 'y', kant: -1 } : { x: q.x + q.b, y: q.y + q.d / 2, z: 0, wand: 'x', kant: -1 };
      const sch = P(q.x + q.b / 2, q.y + q.d / 2, 0.01);
      let x2 = `<ellipse cx="${sch[0].toFixed(1)}" cy="${sch[1].toFixed(1)}" rx="${(lengte * 0.55 * k).toFixed(1)}" ry="${(lengte * 0.55 * k * sp).toFixed(1)}" fill="#000" fill-opacity="0.22"/>`;
      x2 += zetModel('auto', pl, { b: breed, d: lengte, kleur: q.kleur })?.s ?? '';
      if (q.laadt) {
        const p = P(q.x + q.b / 2, q.y + q.d / 2, 1.8);
        x2 += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="9" fill="#0d1a30" stroke="#6ee7b7" stroke-width="1.6"/><path d="M${(p[0] + 1).toFixed(1)} ${(p[1] - 5).toFixed(1)}l-4 6h4l-1 5 4-6h-4z" fill="#6ee7b7"/>`;
      }
      return x2;
    };
    /** Een boom in zijn seizoen: een stam en een kruin van drie bollen, licht van boven. */
    const boom = (bm) => {
      const h = bm.h ?? 5;
      const kl = { herfst: ['#f39a45', '#e07a2e', '#ffb866'], zomer: ['#3f8f5a', '#2f744a', '#58ad73'], lente: ['#7cc47f', '#5ea865', '#f4c6d6'], winter: null }[o.seizoen ?? 'zomer'];
      const p0 = P(bm.x, bm.y, 0);
      const p1 = P(bm.x, bm.y, h * 0.62);
      let x2 = `<ellipse cx="${p0[0].toFixed(1)}" cy="${p0[1].toFixed(1)}" rx="${(1.1 * k).toFixed(1)}" ry="${(1.1 * k * sp).toFixed(1)}" fill="#000" opacity="0.2"/>`;
      x2 += `<path d="M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}" stroke="#5b4636" stroke-width="${Math.max(2, 0.22 * k).toFixed(1)}" stroke-linecap="round"/>`;
      if (!kl) {
        // Winter: kale takken.
        for (const [dx, dz] of [[-0.9, 0.85], [0.8, 0.9], [-0.4, 1], [0.35, 1.05]]) {
          const q = P(bm.x + dx, bm.y, h * dz);
          x2 += `<path d="M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}" stroke="#6b5646" stroke-width="1.6" stroke-linecap="round"/>`;
        }
        return x2;
      }
      const r = (bm.r ?? 1.5) * k;
      const c = P(bm.x, bm.y, h * 0.8);
      x2 += `<circle cx="${(c[0] - r * 0.45).toFixed(1)}" cy="${(c[1] + r * 0.15).toFixed(1)}" r="${(r * 0.78).toFixed(1)}" fill="${kl[1]}"/>`;
      x2 += `<circle cx="${(c[0] + r * 0.45).toFixed(1)}" cy="${(c[1] + r * 0.2).toFixed(1)}" r="${(r * 0.72).toFixed(1)}" fill="${kl[1]}"/>`;
      x2 += `<circle cx="${c[0].toFixed(1)}" cy="${(c[1] - r * 0.3).toFixed(1)}" r="${r.toFixed(1)}" fill="${kl[0]}"/>`;
      x2 += `<circle cx="${(c[0] - r * 0.3).toFixed(1)}" cy="${(c[1] - r * 0.6).toFixed(1)}" r="${(r * 0.42).toFixed(1)}" fill="${kl[2]}" opacity="0.7"/>`;
      return x2;
    };
    /** Een buitenunit van een airco tegen de muur: een witte kast met een ventilator. */
    /** Een buitenunit van een airco tegen de muur, uit de vaste lijst; de ventilator draait als hij aan is. */
    const unit = (u) => {
      const [nx, ny] = u.n ?? [0, 1];
      const pl = Math.abs(nx) > Math.abs(ny) ? { x: u.x, y: u.y, z: 0.12, wand: 'x', kant: Math.sign(nx) } : { x: u.x, y: u.y, z: 0.12, wand: 'y', kant: Math.sign(ny) };
      return zetModel('buitenunit', pl, { aan: !!u.aan })?.s ?? '';
    };
    /** Een laadpaal: een smalle kast met een groen lampje; laadt hij, dan loopt er een kabel naar de auto. */
    /** Een laadpaal tegen een muur, uit de vaste lijst; laadt hij, dan een groen lampje en een kabel naar de auto. */
    const laadpaal = (l) => {
      const [nx, ny] = l.n ?? [0, -1];
      const pl = Math.abs(nx) > Math.abs(ny) ? { x: l.x, y: l.y, z: 0, wand: 'x', kant: Math.sign(nx) } : { x: l.x, y: l.y, z: 0, wand: 'y', kant: Math.sign(ny) };
      const md = zetModel('laadpaal', pl, { aan: !!l.laadt });
      let x2 = md?.s ?? '';
      if (l.laadt && buiten.auto && md) {
        const lampje = P(...md.W(0, 0.17, 1.0));
        const a = buiten.auto;
        const doel = P(a.x + a.b / 2, a.y + a.d * 0.15, 0.7);
        x2 += `<path d="M${lampje[0].toFixed(1)} ${lampje[1].toFixed(1)}Q${((lampje[0] + doel[0]) / 2).toFixed(1)} ${(Math.max(lampje[1], doel[1]) + 18).toFixed(1)} ${doel[0].toFixed(1)} ${doel[1].toFixed(1)}" stroke="#1c2430" stroke-width="2.4" fill="none"/>`;
      }
      return x2;
    };
    /*
     * Het tuinhuis zoals op Thuis nu (het poppenhuis, 24 oktober 2026), op zijn echte maat: een donkere doos
     * met liggende latten, een glazen pui naar het huis, een plat dak dat aan die kant doorloopt als overstek
     * op twee palen, met een vlonder en twee spots eronder. Wat getekend is (x, y, b, d) is alles samen, het
     * overstek erbij; het overstek ligt aan de kant met de kleinste y (naar het huis).
     */
    /*
     * Het tuinhuis, uit de vaste lijst, op zijn echte maat (zoals op Thuis nu, het poppenhuis). Wat getekend is (x, y, b, d)
     * is alles samen, het overstek erbij; het overstek en de pui liggen aan de kant met de kleinste y (naar het huis).
     * Het licht (binnen door de pui, de spots onder het overstek) tekent de tekenaar erbij.
     */
    const tuinhuis = (q) => {
      const h = q.h ?? 2.4;
      const od = Math.min(q.overstek?.d ?? 1.1, q.d * 0.45);
      const [x0, x1] = [q.x, q.x + q.b];
      const y0 = q.y + od;
      const ov = q.y;
      const spotsAan = !!q.overstek?.licht;
      const binnen = !!q.licht;
      const glas = binnen ? '#F4C27E' : o.avond ? '#0f1a2a' : '#4d7eac';
      let x2 = `<path d="${vlak([[x0 - 0.2, ov - 0.2, 0], [x1 + 0.3, ov - 0.2, 0], [x1 + 0.3, q.y + q.d + 0.3, 0], [x0 - 0.2, q.y + q.d + 0.3, 0]])}" fill="#02050a" opacity="0.3" filter="url(#hm-zacht)"/>`;
      if (binnen) x2 += `<path d="${vlak([[x0 + 0.3, y0, 0.01], [x1 - 0.3, y0, 0.01], [x1 + 0.5, ov - 1.6, 0.01], [x0 - 0.5, ov - 1.6, 0.01]])}" fill="#FFB765" opacity="0.35" filter="url(#hm-zacht)"/>`;
      const spots = [0.27, 0.73].map((f) => x0 + (x1 - x0) * f);
      x2 += zetModel('tuinhuis', { x: (x0 + x1) / 2, y: q.y + q.d, z: 0, wand: 'y', kant: -1 }, { b: q.b, d: q.d, h, od, glas })?.s ?? '';
      for (const x of spots) {
        const l = P(x, ov + 0.25, h - 0.01);
        if (spotsAan) {
          const c = P(x, ov + od * 0.5, 0.11);
          x2 += `<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(0.9 * k).toFixed(1)}" ry="${(0.9 * k * sp).toFixed(1)}" fill="#FFD39A" opacity="0.4"/>`;
          x2 += `<path d="M${(l[0] - 2).toFixed(1)} ${l[1].toFixed(1)}L${(l[0] + 2).toFixed(1)} ${l[1].toFixed(1)}L${(c[0] + 0.7 * k).toFixed(1)} ${c[1].toFixed(1)}L${(c[0] - 0.7 * k).toFixed(1)} ${c[1].toFixed(1)}Z" fill="#FFD39A" opacity="0.16"/>`;
        }
        x2 += `<rect x="${(l[0] - 4).toFixed(1)}" y="${(l[1] - 1.5).toFixed(1)}" width="8" height="3" rx="1.5" fill="${spotsAan ? '#FFD39A' : '#55626f'}"/>`;
      }
      x2 += gebouwNaam(q, h + 0.6);
      return x2;
    };
    /** De naam boven een gebouw. */
    const gebouwNaam = (q, z) => {
      if (!q.naam || o.stil) return '';
      const p = P(q.x + q.b / 2, q.y + q.d / 2, z);
      labels.push({ x: p[0] - q.naam.length * 3.6, y: p[1] - 10, b: q.naam.length * 7.2, h: 16, prio: 1, s: `<text x="${p[0].toFixed(1)}" y="${(p[1] + 4).toFixed(1)}" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="#dfe6ec" paint-order="stroke" stroke="#0d1a30" stroke-width="3.5" stroke-linejoin="round">${esc(q.naam)}</text>` });
      return '';
    };
    /** Een gebouw uit de vaste lijst (garage, schuurtje, carport), met de voorkant naar de kant met de kleinste y. */
    const gebouw = (q) => {
      const h = q.h ?? MOD.MODELLEN[q.soort].h;
      const x2 = zetModel(q.soort, { x: q.x + q.b / 2, y: q.y + q.d, z: 0, wand: 'y', kant: -1 }, { b: q.b, d: q.d, h })?.s ?? '';
      return x2 + gebouwNaam(q, h + (q.soort === 'schuur' ? Math.min(q.b, 3) * 0.38 : 0) + 0.4);
    };
    /** Een tafel met vier stoelen op het terras. */
    const tafel = (q) => zetModel('tuinset', { x: q.mx, y: q.my, z: 0, wand: 'y', kant: 1 })?.s ?? '';
    /** Van ver naar dichtbij: steeds het ding waar niets meer achter staat. */
    const vanVer = (lijst) => {
      const rest = [...lijst];
      const uit = [];
      while (rest.length) {
        let i = rest.findIndex((a) => rest.every((b) => b === a || dichterbij(b.q, a.q)));
        if (i < 0) i = rest.reduce((best, a, j) => (diep(a.q.x + a.q.b / 2, a.q.y + a.q.d / 2) > diep(rest[best].q.x + rest[best].q.b / 2, rest[best].q.y + rest[best].q.d / 2) ? j : best), 0);
        uit.push(...rest.splice(i, 1));
      }
      return uit;
    };
    const tekenBuiten = (lijst) => vanVer(lijst).map((x) => (x.soort === 'auto' ? auto(x.q) : x.soort === 'tuinhuis' ? tuinhuis(x.q) : MOD?.MODELLEN?.[x.q.soort] && !x.q.buur ? gebouw(x.q) : x.soort === 'boom' ? boom(x.q.bm) : x.soort === 'unit' ? unit(x.q.u) : x.soort === 'laadpaal' ? laadpaal(x.q.l) : x.soort === 'tafel' ? tafel(x.q) : x.q.buur ? doos(x.q, ['rgb(255 255 255 / 0.025)', 'rgb(255 255 255 / 0.035)', 'rgb(255 255 255 / 0.03)', 'rgb(255 255 255 / 0.03)']) : doos(x.q, x.q.kleur ?? ['#2d3d57', '#26354d', '#3b4a66', '#34425c']))).join('');
    s += tekenBuiten(achterHuis);
    // Hier komen straks de apparaten achter het huis (ze worden pas verderop getekend).
    const ACHTER = '<!--achter-->';
    s += ACHTER;

    // Het dak aan de achterkant: eerst, zodat alles ervoor er overheen valt.
    const paneelLijst = [].concat(o.panelen ?? []).filter((p) => p?.aantal);
    const paneelVan = (v) => paneelLijst.find((p) => (p.kant ?? v.kant) === v.kant);
    const hoofdDak = daken.find((d) => d.b.soort === 'hoofdhuis') ?? daken[0];
    const dakVlak = (d, v) => {
      const kijker = naarKijker(...v.n);
      if (kijker) return '';
      const vul = v.gevel ? (Math.abs(v.n[0]) > 0.5 ? '#33435e' : '#2b3a53') : v.kant === 0 ? '#3b4a66' : '#34425c';
      let x = `<path d="${vlak(v.p)}" fill="${vul}" stroke="rgb(13 26 48 / 0.6)" stroke-width="0.8" stroke-linejoin="round"/>`;
      if (d === hoofdDak && v.dak && paneelVan(v)) x += paneelVeld(d, v);
      return x;
    };
    /** Panelen in rijen op een dakvlak, met wat rand. */
    const paneelVeld = (d, v) => {
      const [A, Bp, C, D] = v.p;
      const lerp = (p, q, f) => p.map((n, i) => n + (q[i] - n) * f);
      // A-B langs de goot, D-C langs de nok.
      const rijen = Math.max(1, Math.min(3, Math.round(Math.hypot(D[0] - A[0], D[1] - A[1], D[2] - A[2]) / 1.75)));
      const aantal = paneelVan(v).aantal;
      const perRij = Math.ceil(aantal / rijen);
      let x = '';
      let n = 0;
      for (let r = 0; r < rijen; r++) {
        for (let i = 0; i < perRij && n < aantal; i++, n++) {
          const f0 = 0.08 + (0.84 * i) / perRij;
          const f1 = 0.08 + (0.84 * (i + 1)) / perRij - 0.012;
          const h0 = 0.1 + (0.8 * r) / rijen;
          const h1 = 0.1 + (0.8 * (r + 1)) / rijen - 0.03;
          const p = (f, h) => lerp(lerp(A, Bp, f), lerp(D, C, f), h);
          x += `<path d="${vlak([p(f0, h0), p(f1, h0), p(f1, h1), p(f0, h1)])}" fill="#1d3f73" stroke="#5c8fd6" stroke-opacity="0.55" stroke-width="0.7"/>`;
        }
      }
      return x;
    };
    if (metDak) for (const d of daken) for (const v of [...d.vlakken].sort((a, b) => dp(b.p) - dp(a.p))) s += dakVlak(d, v);
    /** Een dakkapel: de wanden naar de kijker, het platte dak, en het raam (warm als het avond is). */
    const kapel = (kp) => {
      let x2 = '';
      for (const z of kp.zijden) if (naarKijker(...z.n)) x2 += `<path d="${vlak(z.p)}" fill="#7d8ca1" stroke="rgb(13 26 48 / 0.4)" stroke-width="0.6"/>`;
      if (naarKijker(...kp.voor.n)) {
        x2 += `<path d="${vlak(kp.voor.p)}" fill="#97a6ba" stroke="rgb(13 26 48 / 0.4)" stroke-width="0.6"/>`;
        x2 += `<path d="${vlak(kp.raam)}" fill="${o.avond ? '#f3c77a' : '#8fb4d6'}" fill-opacity="${o.avond ? 0.6 : 0.45}"/>`;
      } else {
        // Van achteren (21 november 2026): door het glazen dak zie je de voorkant van binnen, met het raam, zodat je hem herkent.
        x2 += `<path d="${vlak(kp.voor.p)}" fill="#4a5a76" stroke="#cfe6ff" stroke-opacity="0.45" stroke-width="0.8"/>`;
        x2 += `<path d="${vlak(kp.raam)}" fill="${o.avond ? '#f3c77a' : '#8fb4d6'}" fill-opacity="${o.avond ? 0.6 : 0.5}" stroke="#eef5fb" stroke-opacity="0.7" stroke-width="1"/>`;
      }
      return x2 + `<path d="${vlak(kp.boven.p)}" fill="#7d8ca1" stroke="#cfe6ff" stroke-opacity="0.5" stroke-width="0.8"/>`;
    };

    const kamerVan = (r) => (r?.kamer ? r.kamer : null);
    /*
     * Meubels per soort kamer (20 november 2026, met de vaste lijst sinds 21 november): een bank met een salontafel, een
     * keuken met bovenkasten en een eettafel, een bed met een nachtkastje en een kast, een bad en een wastafel, een toilet,
     * een bureau met een stoel. Altijd tegen de muren aan de kant die van je af ligt, zodat ze niets afdekken; nooit voor
     * een raam of een deur (Ricardo, 21 november), niet over elkaar heen, en onder een schuin dak alleen waar ze passen.
     */
    const meubelsVoor = (soort, q, helften, z0, top, v) => {
      const uit = [];
      // De muren aan de kant van je af, en de richting de kamer in.
      const verX = naarKijker(-1, 0) ? 'x1' : 'x0';
      const verY = naarKijker(0, -1) ? 'y1' : 'y0';
      const sx = verX === 'x1' ? -1 : 1;
      const sy = verY === 'y1' ? -1 : 1;
      const lang = (r, wand) => (wand === 'x' ? r.y1 - r.y0 : r.x1 - r.x0);
      // Voor ramen en deuren blijft de vloer vrij: een strook voor elk raam, een grotere voor elke deur (hij draait open).
      const vrijVoor = (v.openingen ?? []).map((g) => {
        const diep2 = g.soort === 'raam' ? 0.45 : 0.9;
        const [op, a0, a1] = [m(g.op), m(g.van), m(g.tot)];
        return g.as === 'x' ? { x0: op - diep2, x1: op + diep2, y0: a0 - 0.05, y1: a1 + 0.05 } : { x0: a0 - 0.05, x1: a1 + 0.05, y0: op - diep2, y1: op + diep2 };
      });
      // Ook voor het raam van een dakkapel op deze etage (21 november 2026: het bed op zolder stond ervoor).
      for (const kp of hd?.kapellen ?? []) {
        const zt = Math.max(...kp.boven.p.map((q) => q[2]));
        if (zt <= z0 + 0.3 || zt > top + 0.01) continue;
        const xs = kp.voor.p.map((q) => q[0]);
        const ys = kp.voor.p.map((q) => q[1]);
        const [nx, ny] = kp.voor.n;
        // De vloer onder de kapel en 0,9 meter de kamer in (tegen de richting van zijn voorkant in).
        const diepK = Math.max(...kp.boven.p.map((q) => Math.abs((q[0] - xs[0]) * nx + (q[1] - ys[0]) * ny))) + 0.9;
        const [x0, x1, y0, y1] = [Math.min(...xs, ...xs.map((x) => x - nx * diepK)), Math.max(...xs, ...xs.map((x) => x - nx * diepK)), Math.min(...ys, ...ys.map((y) => y - ny * diepK)), Math.max(...ys, ...ys.map((y) => y - ny * diepK))];
        vrijVoor.push({ x0: x0 - 0.05, x1: x1 + 0.05, y0: y0 - 0.05, y1: y1 + 0.05 });
      }
      const bezet = [];
      const raakt = (A, B) => A.x0 < B.x1 - 1e-6 && A.x1 > B.x0 + 1e-6 && A.y0 < B.y1 - 1e-6 && A.y1 > B.y0 + 1e-6;
      const past = (A, hoogte) => [[A.x0, A.y0], [A.x1, A.y0], [A.x0, A.y1], [A.x1, A.y1]].every(([a, b]) => dakZ(a, b) >= z0 + hoogte + 0.05) && z0 + hoogte <= top - 0.05;
      const vrij = (A, hoogte) => past(A, hoogte) && !vrijVoor.some((Z) => raakt(A, Z)) && !bezet.some((Z) => raakt(A, Z));
      /** De vloer die een meubel tegen een muur achterin inneemt: langs de muur van c - b/2 tot c + b/2, van `van` tot `van + diepte` de kamer in. */
      const vloer = (r, wand, c, b, van, diepte) => {
        if (wand === 'x') {
          const [w0, w1] = [r[verX] + sx * van, r[verX] + sx * (van + diepte)];
          return { x0: Math.min(w0, w1), x1: Math.max(w0, w1), y0: c - b / 2, y1: c + b / 2 };
        }
        const [w0, w1] = [r[verY] + sy * van, r[verY] + sy * (van + diepte)];
        return { x0: c - b / 2, x1: c + b / 2, y0: Math.min(w0, w1), y1: Math.max(w0, w1) };
      };
      /**
       * Een vrije plek voor een meubel tegen een muur achterin: zo dicht mogelijk bij `voorkeur` langs de muur (het midden,
       * of 'hoek' voor de hoek achterin), en zo dicht mogelijk tegen de muur (onder een schuin dak schuift hij de kamer in).
       */
      const zoek = (r, wand, b, diepte, hoogte, voorkeur = 'midden') => {
        const [a0, a1] = wand === 'x' ? [r.y0, r.y1] : [r.x0, r.x1];
        const lo = a0 + b / 2 + 0.05;
        const hi = a1 - b / 2 - 0.05;
        if (hi < lo - 1e-6) return null;
        const hoekHoog = wand === 'x' ? verY === 'y1' : verX === 'x1';
        const start = voorkeur === 'hoek' ? (hoekHoog ? hi : lo) : typeof voorkeur === 'number' ? Math.min(hi, Math.max(lo, voorkeur)) : (lo + hi) / 2;
        const plekken = [];
        for (let st2 = 0; st2 <= hi - lo + 0.001; st2 += 0.1) for (const c of [start - st2, start + st2]) if (c >= lo - 1e-6 && c <= hi + 1e-6 && !plekken.includes(c)) plekken.push(c);
        for (let van = 0; van <= Math.min(3, lang(r, wand === 'x' ? 'y' : 'x') - diepte); van += 0.25) {
          for (const c of plekken) {
            // De kamer in schuiven mag alleen voor een schuin dak, niet om een raam of deur te ontwijken (dan zweeft hij).
            if (van > 0 && past(vloer(r, wand, c, b, 0, diepte), hoogte)) continue;
            const A = vloer(r, wand, c, b, van, diepte);
            if (vrij(A, hoogte)) return { c, van };
          }
        }
        return null;
      };
      /** Het punt waar een model tegen de muur achterin komt, met zijn voorkant de kamer in. */
      const punt = (r, wand, c, van) => (wand === 'x' ? { x: r[verX] + sx * van, y: c, z: z0, wand: 'x', kant: sx } : { x: c, y: r[verY] + sy * van, z: z0, wand: 'y', kant: sy });
      const zet = (naam, r, wand, c, van, opt = {}) => {
        const md = zetModel(naam, punt(r, wand, c, van), opt);
        if (!md) return null;
        bezet.push({ x0: md.rect.x, x1: md.rect.x + md.rect.b, y0: md.rect.y, y1: md.rect.y + md.rect.d });
        uit.push({ d: md.d - 0.15, s: md.s });
        return md;
      };
      /** Een meubel op een vrije plek tegen een van de muren achterin (eerst `wanden[0]`). */
      const tegenMuur = (naam, r, wanden, b, opt = {}, voorkeur = 'midden') => {
        const M = MOD?.MODELLEN?.[naam];
        if (!M) return null;
        for (const wand of wanden) {
          const pl = zoek(r, wand, b, M.d, opt.laag ? 1.2 : M.h, voorkeur);
          if (pl) return { ...zet(naam, r, wand, pl.c, pl.van, { ...opt, b }), wand, c: pl.c, van: pl.van };
        }
        return null;
      };
      const langste = (r) => (lang(r, 'x') >= lang(r, 'y') ? ['x', 'y'] : ['y', 'x']);
      /** Zo lang mogelijk, tot `bMin`: past hij nergens, dan een stukje korter (een keuken tussen een deur en een raam). */
      const krimpend = (naam, r, wanden, bMax, bMin, opt = {}, voorkeur = 'midden') => {
        for (let b = bMax; b >= bMin - 1e-6; b -= 0.3) {
          const uit2 = tegenMuur(naam, r, wanden, b, opt, voorkeur);
          if (uit2) return { ...uit2, b };
        }
        return null;
      };
      const bank = (r) => {
        const wanden = langste(r);
        const bk = krimpend('bank', r, wanden, Math.min(2.2, lang(r, wanden[0]) - 0.8), 1.3);
        if (!bk) return;
        const b = bk.b;
        // Een kleed met de salontafel ervoor.
        const kl = vloer(r, bk.wand, bk.c, b + 0.2, bk.van + 0.6, 1.7);
        uit.push({ d: diep((kl.x0 + kl.x1) / 2, (kl.y0 + kl.y1) / 2) + 30, s: `<path d="${vlak([[kl.x0, kl.y0, z0 + 0.01], [kl.x1, kl.y0, z0 + 0.01], [kl.x1, kl.y1, z0 + 0.01], [kl.x0, kl.y1, z0 + 0.01]])}" fill="#4d5f7e" fill-opacity="0.55"/>` });
        const tafel = vloer(r, bk.wand, bk.c, 1.0, bk.van + 1.35, 0.6);
        if (vrij(tafel, 0.4)) zet('salontafel', r, bk.wand, bk.c, bk.van + 1.35);
      };
      const keuken = (r) => {
        const wanden = langste(r);
        const kb = krimpend('keukenblok', r, wanden, Math.min(3.6, lang(r, wanden[0]) - 0.3), 1.2, {}, 'hoek');
        if (!kb) return;
        const b = kb.b;
        // Bovenkasten erboven, als ze onder het plafond passen.
        const bk = punt(r, kb.wand, kb.c, kb.van);
        const bovenVloer = vloer(r, kb.wand, kb.c, b, kb.van, 0.36);
        if (past(bovenVloer, 2.2)) {
          const md = zetModel('bovenkast', { ...bk, z: z0 + 1.5 }, { b });
          if (md) uit.push({ d: md.d - 0.2, s: md.s });
        }
        // Een eettafel met vier stoelen midden in wat er over is, als het ruim genoeg is.
        const vrijD = lang(r, kb.wand === 'x' ? 'y' : 'x') - kb.van - 0.64;
        if (vrijD >= 2.6 && lang(r, kb.wand) >= 2.2) {
          const midden = kb.wand === 'x' ? r[verX] + sx * (kb.van + 0.64 + vrijD / 2) : r[verY] + sy * (kb.van + 0.64 + vrijD / 2);
          const c = kb.wand === 'x' ? (r.y0 + r.y1) / 2 : (r.x0 + r.x1) / 2;
          const [cx2, cy2] = kb.wand === 'x' ? [midden, c] : [c, midden];
          const tb = Math.min(1.6, lang(r, kb.wand) - 1.0);
          const A = kb.wand === 'x' ? { x0: cx2 - 1.0, x1: cx2 + 1.0, y0: cy2 - tb / 2, y1: cy2 + tb / 2 } : { x0: cx2 - tb / 2, x1: cx2 + tb / 2, y0: cy2 - 1.0, y1: cy2 + 1.0 };
          if (vrij(A, 0.8)) {
            const md = zetModel('eettafel', { x: cx2, y: cy2, z: z0, wand: kb.wand === 'x' ? 'x' : 'y', kant: 1 }, { b: tb });
            if (md) {
              bezet.push(A);
              uit.push({ d: md.d - 0.15, s: md.s });
            }
          }
        }
      };
      const bed = (r, breed, kind) => {
        // Het hoofdeinde tegen de muur waar het bed in de breedte past met ruimte ernaast.
        const wanden = lang(r, 'y') >= breed + 0.9 ? ['y', 'x'] : ['x', 'y'];
        const bd = tegenMuur('bed', r, wanden, breed, { kind });
        if (!bd) return;
        // Langs dezelfde muur: aan de kant achterin een kast, aan de kant vooraan een nachtkastje.
        const achterHoog = bd.wand === 'x' ? verY === 'y1' : verX === 'x1';
        const [a0, a1] = bd.wand === 'x' ? [r.y0, r.y1] : [r.x0, r.x1];
        const nk = achterHoog ? bd.c - breed / 2 - 0.3 : bd.c + breed / 2 + 0.3;
        if (nk - 0.23 > a0 && nk + 0.23 < a1 && vrij(vloer(r, bd.wand, nk, 0.45, bd.van, 0.42), 0.5)) zet('nachtkastje', r, bd.wand, nk, bd.van);
        const ruimte = achterHoog ? a1 - (bd.c + breed / 2) - 0.15 : bd.c - breed / 2 - a0 - 0.15;
        const kb = Math.min(1.6, ruimte - 0.05);
        if (kb >= 0.6) {
          const kc = achterHoog ? bd.c + breed / 2 + 0.1 + kb / 2 : bd.c - breed / 2 - 0.1 - kb / 2;
          for (const laag of [false, true]) {
            const pl = zoek(r, bd.wand, kb, 0.62, laag ? 1.2 : 2.1, kc);
            if (pl && Math.abs(pl.c - kc) < 0.35) {
              zet('kast', r, bd.wand, pl.c, pl.van, { b: kb, laag });
              break;
            }
          }
        }
      };
      const bad = (r) => {
        const wanden = langste(r);
        const b = Math.min(1.7, lang(r, wanden[0]) - 0.2);
        if (b >= 1.2) tegenMuur('bad', r, wanden, b, {}, 'hoek');
        tegenMuur('wastafel', r, [...wanden].reverse(), Math.min(0.8, lang(r, wanden[1]) - 0.3));
      };
      const toilet = (r) => tegenMuur('toilet', r, lang(r, 'x') <= lang(r, 'y') ? ['y', 'x'] : ['x', 'y'], 0.38);
      const bureau = (r) => {
        const wanden = langste(r);
        if (lang(r, wanden[0]) < 1.6) return;
        const bu = tegenMuur('bureau', r, wanden, 1.4);
        if (!bu) return;
        const st2 = punt(r, bu.wand, bu.c, bu.van + 0.95);
        const A = vloer(r, bu.wand, bu.c, 0.46, bu.van + 0.72, 0.46);
        if (vrij(A, 1.0)) {
          // De rugleuning aan de kant van de kamer.
          const md = zetModel('bureaustoel', st2);
          if (md) uit.push({ d: md.d - 0.15, s: md.s });
        }
      };
      if (/woonkeuken/.test(soort) && helften?.length) {
        for (const h of helften) (/keuken/i.test(h.naam) ? keuken : bank)(h);
      } else if (/woonkeuken/.test(soort)) {
        bank(q);
      } else if (/woon|zithoek/.test(soort)) bank(q);
      else if (/keuken/.test(soort)) keuken(q);
      else if (/kinderkamer/.test(soort)) bed(q, 0.9, true);
      else if (/slaapkamer|logeer/.test(soort)) bed(q, 1.6, false);
      else if (/badkamer/.test(soort)) bad(q);
      else if (/toilet/.test(soort)) toilet(q);
      else if (/werkkamer|kantoor|hobby|studeer/.test(soort)) bureau(q);
      return uit;
    };
    lagen.forEach((laag, li) => {
      const { v, z0, top: laagTop } = laag;
      if (laag.vaag === 'weg') return;
      // Een wazige etage (eronder of erboven): alleen een strook muur, zonder vloer, namen, apparaten of meubels.
      const band = laag.vaag === 'onder' ? [laagTop - 1.0, laagTop] : laag.vaag === 'boven' ? [z0, z0 + 0.6] : null;
      const s0 = s.length;
      // De bovenste etage onder een schuin dak (20 november 2026): de muren lopen door tot het dak, zoals een zolder (de gevel is een driehoek).
      const top = laag.bovenste && hd && /zadel|schild/.test(hd.b.dak ?? '') ? Math.max(laagTop, hd.nok - zWeg) : laagTop;
      /*
       * Eén etage: de muren aan jouw kant zijn laag afgesneden, zoals een poppenhuis (21 november 2026; op zolder stond
       * anders een grote glazen gevel voor de kamers). De snede krijgt een lichte rand.
       */
      const snee = eenEtage >= 0 && !band ? z0 + 1.0 : null;
      const glasTop = snee ?? top;
      const sneeLijn = (x0, y0, x1, y1) => (snee ? `<path d="M${pt(x0, y0, Math.min(snee, dakZ(x0, y0)))}L${pt(x1, y1, Math.min(snee, dakZ(x1, y1)))}" stroke="#cfe6ff" stroke-opacity="0.55" stroke-width="1.2"/>` : '');
      const ruimteSoort = (id) => t.soortVan(v.ruimtes[id]) ?? '';
      // De vloer per ruimte, op zijn kleur; wat aan staat of op temperatuur is gloeit zacht.
      const per = {};
      const bereik = z0 > 0.5 ? onderDakBereik(z0) : null;
      for (const r of rechthoeken(v, BUITEN)) {
        let [x0, y0, x1, y1] = [m(r.x0), m(r.y0), m(r.x1), m(r.y1)];
        // Onder een dakkapel loopt de vloer door tot de kapel (21 november 2026): daar is het plafond hoger.
        for (const kp of bereik ? hd?.kapellen ?? [] : []) {
          const kx = kp.boven.p.map((q) => q[0]);
          const ky = kp.boven.p.map((q) => q[1]);
          if (Math.max(...kp.boven.p.map((q) => q[2])) - dakOp < z0 + 1.0) continue;
          const [a0, a1, b0, b1] = [Math.max(x0, Math.min(...kx)), Math.min(x1, Math.max(...kx)), Math.max(y0, Math.min(...ky)), Math.min(y1, Math.max(...ky))];
          if (a1 - a0 > 0.05 && b1 - b0 > 0.05) (per[r.id] ??= []).push(vlak([[a0, b0, z0], [a1, b0, z0], [a1, b1, z0], [a0, b1, z0]]));
        }
        // Onder het hoofdhuis: de vloer houdt op waar het dak hem raakt.
        if (bereik) {
          const [a0, a1] = bereik.haaks ? [y0, y1] : [x0, x1];
          if (a1 > bereik.a0 && a0 < bereik.a1) {
            if (bereik.haaks) [x0, x1] = [Math.max(x0, bereik.van), Math.min(x1, bereik.tot)];
            else [y0, y1] = [Math.max(y0, bereik.van), Math.min(y1, bereik.tot)];
          }
        }
        if (x1 - x0 < 0.05 || y1 - y0 < 0.05) continue;
        (per[r.id] ??= []).push(vlak([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]]));
      }
      for (const [id, paden] of band ? [] : Object.entries(per)) {
        const r = v.ruimtes[id];
        const naam = t.naamVan(r);
        const tint = TINT[SOORT_TINT[t.soortVan(r)] ?? (r?.kamer ? 'woon' : naam ? 'hal' : 'leeg')];
        const info = kamerInfo[kamerVan(r)];
        const gloed = info?.toon && info.toon !== 'goed' ? TOON[info.toon] : null;
        // De kamer van de pagina licht op (21 november 2026), zoals in het poppenhuis.
        const gekozen = o.gekozen && kamerVan(r) === o.gekozen;
        s += `<path d="${paden.join('')}" fill="#152238"/><path d="${paden.join('')}" fill="rgb(${tint} / ${gekozen ? 0.42 : naam ? 0.2 : 0.06})"/>`;
        if (gekozen) s += `<path d="${paden.join('')}" fill="none" stroke="#bfe6ff" stroke-opacity="0.75" stroke-width="1.6" stroke-linejoin="round"/>`;
        if (gloed) s += `<path d="${paden.join('')}" fill="${gloed}" fill-opacity="0.16"/>`;
      }
      // De zones: een stippellijn over de vloer, met de naam van elke kant klein op de vloer.
      const was0 = st.etage;
      st.etage = laag.e.id;
      const zones = t.zones();
      st.etage = was0;
      const mz = maten(v);
      for (const zz of band ? [] : zones) {
        for (const r of zz.stukken) s += `<path d="M${r.as === 'x' ? `${pt(m(r.op), m(r.van), z0)}L${pt(m(r.op), m(r.tot), z0)}` : `${pt(m(r.van), m(r.op), z0)}L${pt(m(r.tot), m(r.op), z0)}`}" stroke="#6ee7b7" stroke-opacity="0.7" stroke-width="1.6" stroke-dasharray="6 5" fill="none"/>`;
        const rr = mz[zz.id]?.r;
        if (!rr) continue;
        const helften = zz.z.as === 'x' ? [[rr.x0, zz.z.op, rr.y0, rr.y1], [zz.z.op, rr.x1, rr.y0, rr.y1]] : [[rr.x0, rr.x1, rr.y0, zz.z.op], [rr.x0, rr.x1, zz.z.op, rr.y1]];
        helften.forEach(([xa, xb, ya, yb], i) => {
          const naam = zz.namen[i];
          if (!naam || o.stil) return;
          const p = P(m((xa + xb) / 2), m((ya + yb) / 2), z0);
          const w = naam.length * 6.4;
          labels.push({ x: p[0] - w / 2, y: p[1] - 8, b: w, h: 12, prio: 1, s: `<text x="${p[0].toFixed(1)}" y="${(p[1] + 4).toFixed(1)}" text-anchor="middle" ${FONT} font-size="11.5" font-weight="600" fill="#b8c4cf" paint-order="stroke" stroke="#0d1a30" stroke-width="3" stroke-linejoin="round">${esc(naam)}</text>` });
        });
      }
      const stukken = [];
      const muren = randen(v, isMuur);
      // In welke ruimtes een lamp aan staat (voor de ramen 's avonds).
      const lichtIn = new Set();
      {
        const was1 = st.etage;
        st.etage = laag.e.id;
        for (const q of t.apparaatPunten()) if (q.a.soort === 'licht' && aan.has(q.a.id)) lichtIn.add(q.ruimte);
        st.etage = was1;
      }
      for (const run of muren) {
        const mid = Math.floor((run.van + run.tot) / 2);
        // Aan welke kant ligt de ruimte, en waar kijkt de muur heen.
        const [ia, ib] = run.as === 'x' ? [v.cel[mid * v.W + run.op - 1], v.cel[mid * v.W + run.op]] : [v.cel[(run.op - 1) * v.W + mid], v.cel[run.op * v.W + mid]];
        const binnen = ia === BUITEN ? ib : ia;
        const n = run.as === 'x' ? [ia === BUITEN ? -1 : 1, 0] : [0, ia === BUITEN ? -1 : 1];
        const voor = run.soort === 2 && naarKijker(...n);
        const dicht = run.soort === 2 && DICHT.test(ruimteSoort(binnen));
        const eigenRamen = (v.openingen ?? []).length > 0;
        // Binnenmuren in stukjes van 40 centimeter (buitenmuren houden hun ramen per stuk van 2 meter): zo komt een meubel tegen een muur goed voor of achter die muur (het bad in de badkamer, 21 november 2026).
        for (const deel of K.muurDelen(v, run, run.soort === 1 ? 4 : 20)) {
          const [a, b] = [deel.van, deel.tot];
          if (deel.soort) {
            // Een deur of raam uit de tekening.
            const [x0, y0, x1, y1] = run.as === 'x' ? [m(run.op), m(a), m(run.op), m(b)] : [m(a), m(run.op), m(b), m(run.op)];
            const d = diep((x0 + x1) / 2, (y0 + y1) / 2);
            const muur = (h0, h1, vul, extra = '') => {
              const [b0, b1] = band ? [Math.max(h0, band[0]), Math.min(h1, band[1])] : [h0, h1];
              return b1 <= b0 + 0.01 ? '' : `<path d="${vlakHuis([[x0, y0, b0], [x1, y1, b0], [x1, y1, b1], [x0, y0, b1]])}" fill="${vul}" ${extra}/>`;
            };
            const hoog = run.soort === 1 ? z0 + 1.1 : top;
            const vul = run.as === 'x' ? '#26354d' : '#2d3d57';
            if (deel.soort === 'raam') {
              const r0 = z0 + 0.9;
              // Een raam alleen waar het past: onder het dak, en niet ondersteboven in een lage knieschot (20 november 2026).
              const r1 = Math.min(top - 0.3, z0 + 2.1, dakZ(x0, y0) - 0.25, dakZ(x1, y1) - 0.25);
              const past = r1 - r0 >= 0.5;
              const screen = st.apparaten.find((q) => q.raam === deel.id && q.plek?.etage === laag.e.id);
              // Aan de kant van de kijker: de gevel is glas, het raam krijgt een licht kozijn en wat helderder glas (19 november 2026).
              const kozijn = voor && past ? muur(r0, r1, o.avond && lichtIn.has(binnen) ? 'rgb(243 199 122 / 0.35)' : 'rgb(207 230 255 / 0.16)', 'stroke="#eef5fb" stroke-opacity="0.85" stroke-width="1.6" stroke-linejoin="round"') : '';
              let x2 = voor ? muur(z0, z0 + 0.1, '#c9d4df', 'fill-opacity="0.6"') + muur(z0 + 0.1, glasTop, 'url(#hm-glas)') + (snee ? sneeLijn(x0, y0, x1, y1) : kozijn) : !past ? muur(z0, top, vul, `stroke="${vul}" stroke-width="0.6"`) : muur(z0, r0, vul, `stroke="${vul}" stroke-width="0.6"`) + muur(r1, top, vul, `stroke="${vul}" stroke-width="0.6"`) + muur(r0, r1, o.avond && lichtIn.has(binnen) ? '#f3c77a' : '#8fb4d6', `fill-opacity="${o.avond && lichtIn.has(binnen) ? 0.6 : 0.35}" stroke="#c9d6e2" stroke-opacity="0.4" stroke-width="0.8"`);
              // Een screen voor het raam: neer als hij dicht is, anders opgerold bovenaan.
              /*
               * Een screen voor het raam (20 november 2026): aan de buitenkant, een cassette boven het raam en het doek
               * zo ver neer als hij staat (`o.schermen`: de stand in procenten, 100 is open). Zonder stand: dicht als hij aan staat.
               */
              if (screen && past && !band && !(voor && snee)) {
                const pct = o.schermen?.[screen.id];
                const dicht = pct != null ? Math.max(0, Math.min(1, 1 - pct / 100)) : aan.has(screen.id) ? 1 : 0;
                const [ox, oy] = [n[0] * 0.07, n[1] * 0.07];
                const buiten = (h0, h1, vul, extra = '') => `<path d="${vlakHuis([[x0 + ox, y0 + oy, h0], [x1 + ox, y1 + oy, h0], [x1 + ox, y1 + oy, h1], [x0 + ox, y0 + oy, h1]])}" fill="${vul}" ${extra}/>`;
                const kop = r1 + 0.06;
                if (dicht > 0.02) {
                  const voetDoek = kop - (kop - r0 + 0.12) * dicht;
                  x2 += buiten(voetDoek, kop, '#3f4852', 'fill-opacity="0.92"');
                  x2 += buiten(voetDoek - 0.04, voetDoek, '#9aa5b1');
                }
                x2 += buiten(kop, kop + 0.16, '#b7c1cb', 'stroke="#6b7684" stroke-width="0.6"');
              }
              stukken.push({ d: voor ? d - 50 : d, s: x2 });
            } else if (run.soort === 2 && !voor) {
              // Een deur in een dichte buitenmuur: de deur zelf, de voordeur en achterdeur in hout, openslaande deuren en een schuifpui in glas.
              const glas = deel.soort === 'dubbel' || deel.soort === 'schuifpui';
              const kl = deel.soort === 'voordeur' || deel.soort === 'achterdeur' ? '#8a5a3c' : glas ? (o.avond && lichtIn.has(binnen) ? '#f3c77a' : '#8fb4d6') : '#5c6b80';
              stukken.push({ d, s: muur(z0, z0 + 2.1, kl, glas ? `fill-opacity="${o.avond && lichtIn.has(binnen) ? 0.6 : 0.4}" stroke="#dcefff" stroke-opacity="0.7" stroke-width="1"` : 'stroke="rgb(13 26 48 / 0.5)" stroke-width="0.6"') + muur(z0 + 2.1, top, vul, `stroke="${vul}" stroke-width="0.6"`) });
            } else if (run.soort === 2) {
              // Aan de kant van de kijker: het glas erboven, en de voordeur zelf in hout (een andere deur blijft open).
              const deur = deel.soort === 'voordeur' || deel.soort === 'achterdeur' ? muur(z0, z0 + 2.1, '#8a5a3c', 'stroke="#f0d9c4" stroke-opacity="0.7" stroke-width="1.2"') : deel.soort === 'dubbel' || deel.soort === 'schuifpui' ? muur(z0, z0 + 2.1, 'rgb(207 230 255 / 0.22)', 'stroke="#eef5fb" stroke-opacity="0.9" stroke-width="1.6"') : '';
              stukken.push({ d: d - 50, s: snee ? muur(z0, snee, deur ? '#8a5a3c' : 'rgb(207 230 255 / 0.12)', deur ? 'fill-opacity="0.75"' : '') + sneeLijn(x0, y0, x1, y1) : deur + muur(z0 + 2.1, top, 'url(#hm-glas)') });
            } else if (hoog > z0 + 2.1) stukken.push({ d, s: muur(z0 + 2.1, hoog, '#33445f') });
            continue;
          }
          const [x0, y0, x1, y1] = run.as === 'x' ? [m(run.op), m(a), m(run.op), m(b)] : [m(a), m(run.op), m(b), m(run.op)];
          const d = diep((x0 + x1) / 2, (y0 + y1) / 2);
          const muur = (h0, h1, vul, extra = '') => {
              const [b0, b1] = band ? [Math.max(h0, band[0]), Math.min(h1, band[1])] : [h0, h1];
              return b1 <= b0 + 0.01 ? '' : `<path d="${vlakHuis([[x0, y0, b0], [x1, y1, b0], [x1, y1, b1], [x0, y0, b1]])}" fill="${vul}" ${extra}/>`;
            };
          if (run.soort === 1) {
            // Binnen: halfhoog, met een lichte bovenkant.
            const h = z0 + 1.1;
            stukken.push({ d, s: muur(z0, h, run.as === 'x' ? '#33445f' : '#3c4e6b', 'stroke="rgb(13 26 48 / 0.4)" stroke-width="0.5"') + (!band && Math.min(dakZ(x0, y0), dakZ(x1, y1)) > h ? `<path d="M${pt(x0, y0, h)}L${pt(x1, y1, h)}" stroke="#9fb3c8" stroke-opacity="0.55" stroke-width="1.3"/>` : '') });
          } else if (voor && !dicht) {
            // Naar de straat: een lage borstwering en glas tot het plafond.
            stukken.push({ d: d - 50, s: muur(z0, z0 + 0.1, '#c9d4df', 'fill-opacity="0.6"') + muur(z0 + 0.1, glasTop, 'url(#hm-glas)') + (band ? '' : snee ? sneeLijn(x0, y0, x1, y1) : `<path d="M${pt(...onder([x0, y0, top]))}L${pt(...onder([x1, y1, top]))}" stroke="#cfe6ff" stroke-opacity="0.35" stroke-width="1"/>`) });
          } else {
            // Een garage of berging in dezelfde donkergrijze kleur als het tuinhuis op Thuis (huis.js), niet licht (Ricardo, 19-11).
            const vul = dicht ? (run.as === 'x' ? '#3a4656' : '#2f3a48') : voor ? (run.as === 'x' ? '#5a6a83' : '#66778f') : run.as === 'x' ? '#26354d' : '#2d3d57';
            let raam = '';
            // Een raam in elk stuk muur van een kamer (niet in een garage), zoals in het poppenhuis.
            if (!band && !eigenRamen && !dicht && (b - a) * CEL >= 1.4 && Math.min(top, dakZ(x0, y0), dakZ(x1, y1)) - z0 >= 2.3) {
              const r0 = 0.35 / ((b - a) * CEL);
              const [rx0, ry0, rx1, ry1] = [x0 + (x1 - x0) * r0, y0 + (y1 - y0) * r0, x1 - (x1 - x0) * r0, y1 - (y1 - y0) * r0];
              const warm = o.avond && lichtIn.has(binnen);
              raam = `<path d="${vlak([[rx0, ry0, z0 + 0.9], [rx1, ry1, z0 + 0.9], [rx1, ry1, Math.min(top - 0.3, z0 + 2.1)], [rx0, ry0, Math.min(top - 0.3, z0 + 2.1)]])}" fill="${warm ? '#f3c77a' : '#8fb4d6'}" fill-opacity="${warm ? 0.55 : 0.28}" stroke="#c9d6e2" stroke-opacity="0.35" stroke-width="0.8"/>`;
            }
            stukken.push({ d: voor ? d - 50 : d, s: muur(z0, top, vul, `stroke="${vul}" stroke-width="0.6"`) + raam });
          }
        }
      }
      // De trap: treden in hout naar de kant waar hij omhoog gaat.
      for (const [id, r] of band ? [] : Object.entries(v.ruimtes)) {
        if (t.soortVan(r) !== 'trap') continue;
        const rr = maten(v)[id]?.r;
        if (!rr) continue;
        const [rx, ry] = K.TRAP_RICHTING[r.omhoog ?? 'n'];
        const n = 12;
        const hoogte = (erbovenOp(li) ?? laag.trapTot ?? laagTop) - z0;
        for (let i = 0; i < n; i++) {
          const f0 = i / n;
          const f1 = (i + 1) / n;
          const [xa, xb, ya, yb] = rx
            ? (rx > 0 ? [m(rr.x0) + (m(rr.x1) - m(rr.x0)) * f0, m(rr.x0) + (m(rr.x1) - m(rr.x0)) * f1] : [m(rr.x1) - (m(rr.x1) - m(rr.x0)) * f1, m(rr.x1) - (m(rr.x1) - m(rr.x0)) * f0]).concat([m(rr.y0) + 0.1, m(rr.y1) - 0.1])
            : [m(rr.x0) + 0.1, m(rr.x1) - 0.1].concat(ry > 0 ? [m(rr.y0) + (m(rr.y1) - m(rr.y0)) * f0, m(rr.y0) + (m(rr.y1) - m(rr.y0)) * f1] : [m(rr.y1) - (m(rr.y1) - m(rr.y0)) * f1, m(rr.y1) - (m(rr.y1) - m(rr.y0)) * f0]);
          stukken.push({ d: diep((xa + xb) / 2, (ya + yb) / 2) - 0.2, s: doos3(xa, xb, ya, yb, z0 + hoogte * f0, z0 + hoogte * f1, ['#b08a64', '#8a6a4c', '#9c7a58']) });
        }
      }
      // De apparaten van deze etage, zoals in het poppenhuis: een airco hoog aan de muur, een hanglamp,
      // witgoed tegen de muur. Wat je niet ziet in een kamer (meters, rookmelders, thermostaten) blijft weg: dat is rustiger.
      const was = st.etage;
      st.etage = laag.e.id;
      const punten = t.apparaatPunten();
      st.etage = was;
      /** De muur het dichtst bij een punt (in ruitjes), met de kant waar het punt ligt. */
      /*
       * Met `ruimte` (21 november 2026, de spiegel van de badkamer hing in de kamer ernaast): alleen een muur van die ruimte,
       * met de voorkant naar die ruimte toe. Zo hangt een apparaat nooit aan de verkeerde kant van een muur.
       */
      const wandBij = (cx, cy, ruimte = null) => {
        let best = null;
        for (const run of muren) {
          const [langs, dwars] = run.as === 'x' ? [cy, cx] : [cx, cy];
          if (langs < run.van || langs > run.tot) continue;
          let kant = dwars >= run.op ? 1 : -1;
          if (ruimte != null) {
            const l = Math.min(run.tot - 1, Math.max(run.van, Math.floor(langs)));
            const [voor0, na0] = run.as === 'x' ? [v.cel[l * v.W + run.op - 1], v.cel[l * v.W + run.op]] : [v.cel[(run.op - 1) * v.W + l], v.cel[run.op * v.W + l]];
            if (na0 === ruimte) kant = 1;
            else if (voor0 === ruimte) kant = -1;
            else continue;
          }
          const afst = Math.abs(dwars - run.op) - (run.soort === 2 ? 3 : 0);
          if (!best || afst < best.afst) best = { run, afst, kant, langs };
        }
        return best;
      };
      /*
       * De apparaten van deze etage, elk met zijn model uit de vaste lijst (21 november 2026): waar de bewoner het in Je huis
       * plaatste, tegen de dichtstbijzijnde muur met de voorkant naar de kamer, aan het plafond of los op de vloer.
       */
      for (const q of band ? [] : punten) {
        const naam = MOD?.voor(q.a);
        const M = naam ? MOD.MODELLEN[naam] : null;
        if (!M) continue;
        const draait = aan.has(q.a.id);
        const [x, y] = [m(q.x), m(q.y)];
        let pl;
        if (M.hangt === 'plafond' || M.hangt === 'vrij') {
          const plaf = plafond(x, y, top);
          if (M.hangt === 'plafond') {
            const zb = plaf - (M.plafond ?? 0) - M.h;
            if (zb - z0 < 1.0) continue;
            pl = { x, y, z: zb };
          } else {
            if (plaf - z0 < M.h + 0.1) continue;
            pl = { x, y, z: z0 };
          }
        } else {
          const w = wandBij(q.x, q.y, q.ruimte);
          if (!w) continue;
          const { run, kant } = w;
          const half = M.b / 2;
          const midden = Math.min(m(run.tot) - half - 0.05, Math.max(m(run.van) + half + 0.05, m(w.langs)));
          const vlakMuur = m(run.op) + kant * 0.03;
          const [px, py] = run.as === 'x' ? [vlakMuur, midden] : [midden, vlakMuur];
          const plaf = Math.min(...[[-half, 0], [half, 0], [-half, M.d], [half, M.d]].map(([a, d2]) => plafond(...(run.as === 'x' ? [px + kant * d2, py + a] : [px + a, py + kant * d2]), top)));
          let zb = M.hangt === 'vloer' ? z0 : M.plafond != null ? plaf - M.plafond - M.h : z0 + (M.z ?? 1.2);
          if (zb + M.h > plaf - 0.02) {
            if (M.hangt === 'vloer') continue;
            zb = plaf - 0.05 - M.h;
          }
          // Aan een binnenmuur (die is halfhoog getekend) hangt een apparaat niet hoger dan de muur, anders zweeft het erboven (21 november 2026).
          if (run.soort === 1 && M.hangt !== 'vloer' && zb + M.h > z0 + 1.1) zb = z0 + 1.1 - M.h - 0.02;
          if (M.hangt !== 'vloer' && zb < z0 + 0.05) continue;
          pl = { x: px, y: py, z: zb, wand: run.as, kant };
        }
        const md = zetModel(naam, pl, { aan: draait });
        if (!md) continue;
        let x2 = '';
        const mx = md.rect.x + md.rect.b / 2;
        const my = md.rect.y + md.rect.d / 2;
        // Een lamp die brandt: een plas licht op de vloer (een lamp aan de muur een stukje de kamer in).
        if (M.licht && draait) {
          const [vx, vy] = pl.wand ? (pl.wand === 'x' ? [mx + pl.kant * 0.7, my] : [mx, my + pl.kant * 0.7]) : [mx, my];
          const v0 = P(vx, vy, z0 + 0.01);
          const r0 = M.hangt === 'plafond' ? 1.4 : 1.0;
          stukken.push({ d: diep(vx, vy) + 30, s: `<ellipse cx="${v0[0].toFixed(1)}" cy="${v0[1].toFixed(1)}" rx="${(r0 * k).toFixed(1)}" ry="${(r0 * k * sp).toFixed(1)}" fill="#ffd9a0" fill-opacity="${o.avond ? 0.26 : 0.1}"/>` });
          if (M.snoer) {
            const l = P(mx - 0.6, my, z0 + 0.05);
            const r = P(mx + 0.6, my, z0 + 0.05);
            const b = P(mx, my, pl.z);
            x2 += `<path d="M${b[0].toFixed(1)} ${b[1].toFixed(1)}L${l[0].toFixed(1)} ${l[1].toFixed(1)}L${r[0].toFixed(1)} ${r[1].toFixed(1)}Z" fill="#ffd9a0" fill-opacity="${o.avond ? 0.09 : 0.04}"/>`;
          }
        }
        // Een hanglamp hangt aan een snoer.
        if (M.snoer) {
          const s0 = P(mx, my, plafond(mx, my, top));
          const s1 = P(mx, my, pl.z + M.h);
          x2 += `<path d="M${s0[0].toFixed(1)} ${s0[1].toFixed(1)}L${s1[0].toFixed(1)} ${s1[1].toFixed(1)}" stroke="#8090a0" stroke-width="1"/>`;
        }
        x2 += md.s;
        // Een airco die draait: drie zachte stromen lucht de kamer in, warm of koel.
        if (M.lucht && draait) {
          const kleur = kamerInfo[t.st.apparaten.find((a) => a.id === q.a.id)?.kamer]?.toon === 'koelt' ? '#6fd3ff' : '#ff7a4d';
          for (let i = -1; i <= 1; i++) {
            const a = P(...md.W(i * 0.25, M.d, -0.02));
            const b = P(...md.W(i * 0.25, M.d + 0.7, -0.45));
            x2 += `<path d="M${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${((a[0] + b[0]) / 2).toFixed(1)} ${((a[1] + b[1]) / 2 + 5).toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}" stroke="${kleur}" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.75"/>`;
          }
        }
        stukken.push({ d: md.d - 0.1, s: x2 });
      }
      // De meubels (20 november 2026, zoals in het poppenhuis): per soort kamer, tegen de muren achterin.
      if (o.meubels && !band) {
        // Elke kamer in rechthoekige stukken (een kamer in een U-vorm heeft er drie), de grootste eerst.
        const stukkenPer = {};
        for (const r of rechthoeken(v, BUITEN)) (stukkenPer[r.id] ??= []).push({ x0: m(r.x0), x1: m(r.x1), y0: m(r.y0), y1: m(r.y1) });
        const opp = (q) => (q.x1 - q.x0) * (q.y1 - q.y0);
        const zoneVan = {};
        for (const zz of zones) zoneVan[zz.id] = { as: zz.z.as, op: m(zz.z.op), namen: zz.namen };
        for (const [id, lijst] of Object.entries(stukkenPer)) {
          lijst.sort((a, b) => opp(b) - opp(a));
          // Met zones (de zithoek, de keuken): aan elke kant van de lijn het grootste stuk.
          const zn = zoneVan[id];
          const kantVan = (q) => (zn.as === 'x' ? (q.x0 + q.x1) / 2 : (q.y0 + q.y1) / 2) >= zn.op;
          const helften = zn ? [false, true].map((k2, i) => {
            const q = lijst.find((x) => kantVan(x) === k2);
            return q ? { ...q, naam: zn.namen[i] ?? '' } : null;
          }).filter(Boolean) : null;
          stukken.push(...meubelsVoor(ruimteSoort(id), lijst[0], helften, z0, top, v));
        }
      }
      /*
       * De dakkapel (21 november 2026: hij viel weg achter de muren van de zolder). Met het dak: een kapel aan de achterkant
       * hoort bij de bovenste etage, tussen de rest gesorteerd. Eén etage: de etage waar het meeste van zijn hoogte in valt
       * krijgt hem als nis in de muur, met het raam, zonder dak; aan jouw kant laag afgesneden zoals de muren.
       */
      for (const kp of hd?.kapellen ?? []) {
        const naar = naarKijker(...kp.voor.n);
        const cxk = kp.boven.p.reduce((n, q) => n + q[0], 0) / kp.boven.p.length;
        const cyk = kp.boven.p.reduce((n, q) => n + q[1], 0) / kp.boven.p.length;
        if (metDak) {
          if (!naar && laag.bovenste) stukken.push({ d: diep(cxk, cyk), s: kapel(kp) });
          continue;
        }
        const zs = kp.voor.p.map((q) => q[2]);
        const [za, zt] = [Math.min(...zs), Math.max(...kp.boven.p.map((q) => q[2]))];
        const binnenL = (l) => Math.max(0, Math.min(zt, l.bovenste ? hd.nok : l.top) - Math.max(za, l.z0));
        const mijn = binnenL(laag);
        if (band || mijn < 0.2 || lagen.some((l) => l !== laag && binnenL(l) > mijn)) continue;
        const kap = (zz) => Math.min(naar && snee ? snee : top, Math.max(zz, z0));
        const op = (pp) => pp.map(([x, y, zz]) => [x, y, kap(zz)]);
        let x2 = '';
        for (const zd of kp.zijden) x2 += `<path d="${vlak(op(zd.p))}" fill="#33445f" fill-opacity="0.9" stroke="rgb(13 26 48 / 0.4)" stroke-width="0.6"/>`;
        x2 += `<path d="${vlak(op(kp.voor.p))}" fill="#2d3d57" stroke="rgb(13 26 48 / 0.5)" stroke-width="0.6"/>`;
        if (!(naar && snee)) x2 += `<path d="${vlak(op(kp.raam))}" fill="${o.avond && lichtIn.size ? '#f3c77a' : '#8fb4d6'}" fill-opacity="${o.avond ? 0.55 : 0.4}" stroke="#eef5fb" stroke-opacity="0.75" stroke-width="1.4"/>`;
        stukken.push({ d: diep(cxk, cyk) + 0.5, s: x2 });
      }
      stukken.sort((a, b) => b.d - a.d);
      s += stukken.map((x) => x.s).join('');

      // Een plat dak op een gebouw dat hier ophoudt: de garage dicht met zijn naam, de rest als glas.
      const erboven = lagen[li + 1];
      for (const b of metDak ? blokken : []) {
        if (/zadel|schild|lessenaar/.test(b.dak ?? '') && b.soort === 'hoofdhuis') continue;
        if (!(laag.e.blokken ?? []).some((x) => x.id === b.id)) continue;
        if (erboven && (erboven.e.blokken ?? []).some((x) => x.id === b.id)) continue;
        const r = [[b.u, b.v, laagTop], [b.u + b.b, b.v, laagTop], [b.u + b.b, b.v + b.d, laagTop], [b.u, b.v + b.d, laagTop]];
        if (DICHT.test(b.soort ?? '')) {
          s += `<path d="${vlak(r)}" fill="#46525f" stroke="rgb(13 26 48 / 0.5)"/>`;
          if (o.stil) continue;
          const p = P(b.u + b.b / 2, b.v + b.d / 2, laagTop);
          labels.push({ x: p[0], y: p[1] + 4, prio: 1, s: `<text x="${p[0].toFixed(1)}" y="${(p[1] + 4).toFixed(1)}" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="#b8c4cf">${esc(b.naam ?? '')}</text>`, b: 60, h: 16 });
        } else s += `<path d="${vlak(r)}" fill="rgb(191 230 255 / 0.05)" stroke="#cfe6ff" stroke-opacity="0.3" stroke-dasharray="4 4"/>`;
      }

      // De namen: voorin de ruimte, net boven de vloer, zodat de etage erboven ze niet afdekt.
      const mm = maten(v);
      for (const [id, r] of Object.entries(v.ruimtes)) {
        const naam = t.naamVan(r);
        const rr = mm[id]?.r;
        if (band || o.stil || !naam || !rr || DICHT.test(ruimteSoort(id))) continue;
        // Een trap of overloop zonder iets te melden krijgt geen naam: de treden zeggen het al (en het label viel op de auto).
        if (!kamerInfo[kamerVan(r)] && /trap|overloop/.test(ruimteSoort(id))) continue;
        const hoeken = [[rr.x0, rr.y0], [rr.x1, rr.y0], [rr.x1, rr.y1], [rr.x0, rr.y1]].map(([x, y]) => [m(x), m(y)]);
        hoeken.sort((a, b) => diep(...a) - diep(...b));
        const mx = (m(rr.x0) + m(rr.x1)) / 2;
        const my = (m(rr.y0) + m(rr.y1)) / 2;
        const vx = (hoeken[0][0] + hoeken[1][0]) / 2;
        const vy = (hoeken[0][1] + hoeken[1][1]) / 2;
        const p = P(vx + (mx - vx) * 0.45, vy + (my - vy) * 0.45, z0 + 0.7);
        const info = kamerInfo[kamerVan(r)];
        const breedte = (rr.x1 - rr.x0) * CEL * k;
        if (!info && breedte < 40) continue;
        // Netter (20 november 2026, Ricardo): gecentreerd, kleiner en overal even groot; naam, temperatuur, en eronder wat er gebeurt.
        const midden = `text-anchor="middle" ${FONT}`;
        let regels = `<text y="0" ${midden} font-size="12" font-weight="700" fill="${info ? '#dfe6ec' : '#aebac6'}">${esc(naam)}</text>`;
        let h = 15;
        if (info?.temp) {
          regels += `<text y="19" ${midden} font-size="18" font-weight="800" fill="#ffffff">${esc(info.temp)}</text>`;
          h = 35;
        }
        if (info?.zin) {
          regels += `<text y="${h - 2}" ${midden} font-size="11" font-weight="700" fill="${TOON[info.toon] ?? '#b8c4cf'}">${esc(info.zin)}</text>`;
          h += 13;
        }
        const w = Math.max(naam.length * 6.8, (info?.zin ?? '').length * 6, (info?.temp ?? '').length * 10.5, 44);
        const halo = 'paint-order="stroke" stroke="#0d1a30" stroke-width="3" stroke-linejoin="round"';
        // Past het label nergens, dan op één regel: de naam en de temperatuur (zoals in het poppenhuis).
        const wk = (naam.length + (info?.temp ?? '').length + 1) * 7;
        const kort = info?.temp ? { x: p[0] - wk / 2, y: p[1] - 12, b: wk, h: 15, s: `<g transform="translate(${p[0].toFixed(1)} ${(p[1] + 2).toFixed(1)})" ${halo}><text y="0" ${midden} font-size="12.5" font-weight="700" fill="#dfe6ec">${esc(naam)} <tspan font-weight="800" fill="${TOON[info.toon] && info.toon !== 'goed' ? TOON[info.toon] : '#ffffff'}">${esc(info.temp)}</tspan></text></g>` } : null;
        labels.push({ x: p[0] - w / 2, y: p[1] - 12, b: w, h, prio: info?.temp ? 3 : info ? 2 : 0, s: `<g transform="translate(${p[0].toFixed(1)} ${(p[1] + 2).toFixed(1)})" ${halo}>${regels}</g>`, kader: true, kort });
      }
      // De vloerrand van de etage erboven: een dunne plaat langs de glazen kant.
      if (erboven && !band) {
        // Alleen waar de vloer erboven onder het dak ligt (een lang achterdak komt lager).
        const bereikBoven = onderDakBereik(top);
        for (const run of randen(erboven.v, isMuur).filter((r) => r.soort === 2)) {
          const mid = Math.floor((run.van + run.tot) / 2);
          const [ia] = run.as === 'x' ? [erboven.v.cel[mid * erboven.v.W + run.op - 1]] : [erboven.v.cel[(run.op - 1) * erboven.v.W + mid]];
          const n = run.as === 'x' ? [ia === BUITEN ? -1 : 1, 0] : [0, ia === BUITEN ? -1 : 1];
          if (!naarKijker(...n)) continue;
          let [x0, y0, x1, y1] = run.as === 'x' ? [m(run.op), m(run.van), m(run.op), m(run.tot)] : [m(run.van), m(run.op), m(run.tot), m(run.op)];
          if (bereikBoven) {
            // c: dwars op de nok. Een rand op een vaste c buiten het bereik valt weg; een rand langs c wordt korter.
            const cVast = bereikBoven.haaks ? x0 === x1 : y0 === y1;
            if (cVast) {
              const c = bereikBoven.haaks ? x0 : y0;
              if (c < bereikBoven.van - 0.05 || c > bereikBoven.tot + 0.05) continue;
            } else if (bereikBoven.haaks) [x0, x1] = [Math.max(Math.min(x0, x1), bereikBoven.van), Math.min(Math.max(x0, x1), bereikBoven.tot)];
            else [y0, y1] = [Math.max(Math.min(y0, y1), bereikBoven.van), Math.min(Math.max(y0, y1), bereikBoven.tot)];
            if (Math.hypot(x1 - x0, y1 - y0) < 0.05) continue;
          }
          erboven.rand = (erboven.rand ?? '') + `<path d="${vlakHuis([[x0, y0, top - 0.14], [x1, y1, top - 0.14], [x1, y1, top], [x0, y0, top]])}" fill="#c9d4df" fill-opacity="0.75"/>`;
        }
      }
      if (laag.rand) s += laag.rand;
      if (band) s = s.slice(0, s0) + `<g opacity="0.3" filter="url(#hm-wazig)">${s.slice(s0)}</g>`;
    });

    // Het afdak voor (of achter) het huis: een schuin dakje over de begane grond, met een rand en de zijkanten.
    for (const b of metDak ? blokken.filter((x) => x.afdak) : []) {
      const a = b.afdak;
      const [v0, v1] = a.kant === 'voor' ? [b.v, b.v + a.diep] : [b.v + b.d, b.v + b.d - a.diep];
      const [u0, u1] = [b.u, b.u + b.b];
      const bgTop = lagen[0]?.top ?? 2.5;
      const onder = Math.min(bgTop, a.laag);
      const dak = [[u0, v0, a.laag], [u1, v0, a.laag], [u1, v1, a.hoog], [u0, v1, a.hoog]];
      const delen = [
        { p: [[u0, v0, onder], [u1, v0, onder], [u1, v0, a.laag], [u0, v0, a.laag]], vul: '#cbd4dd', n: [0, a.kant === 'voor' ? -1 : 1] },
        { p: [[u0, v0, onder], [u0, v0, a.laag], [u0, v1, a.hoog], [u0, v1, onder]], vul: '#aab6c4', n: [-1, 0] },
        { p: [[u1, v0, onder], [u1, v0, a.laag], [u1, v1, a.hoog], [u1, v1, onder]], vul: '#aab6c4', n: [1, 0] },
      ].filter((x) => naarKijker(...x.n));
      for (const x of delen.sort((p1, p2) => dp(p2.p) - dp(p1.p))) s += `<path d="${vlak(x.p)}" fill="${x.vul}" stroke="rgb(13 26 48 / 0.45)" stroke-width="0.8" stroke-linejoin="round"/>`;
      s += `<path d="${vlak(dak)}" fill="#55657f" stroke="rgb(13 26 48 / 0.5)" stroke-width="0.8" stroke-linejoin="round"/>`;
      // Een paar lijnen over het dakje, langs de helling.
      for (let f = 0.12; f < 0.95; f += 0.12) s += `<path d="M${pt(u0 + (u1 - u0) * f, v0, a.laag)}L${pt(u0 + (u1 - u0) * f, v1, a.hoog)}" stroke="#7e8da6" stroke-opacity="0.5" stroke-width="0.7"/>`;
    }
    // Het dak aan de kant van de kijker: glas met de lijnen erop.
    for (const d of metDak ? daken : []) {
      for (const v of d.vlakken) {
        if (!naarKijker(...v.n)) continue;
        // Een afdak of uitbouw voor het huis is dicht: daar kijk je niet in (19 november 2026, het afdak van Ricardo).
        if (d.b.soort !== 'hoofdhuis' && v.dak) {
          s += `<path d="${vlak(v.p)}" fill="#3b4a66" stroke="rgb(13 26 48 / 0.6)" stroke-width="0.8" stroke-linejoin="round"/>`;
          continue;
        }
        s += `<path d="${vlak(v.p)}" fill="rgb(191 230 255 / 0.05)" stroke="#9fd8ff" stroke-opacity="0.4" stroke-width="1.1" stroke-dasharray="5 4" stroke-linejoin="round"/>`;
        if (d === hoofdDak && v.dak && paneelVan(v)) s += `<g opacity="0.55">${paneelVeld(d, v)}</g>`;
      }
      for (const kp of d.kapellen) if (naarKijker(...kp.voor.n)) s += kapel(kp);
      // De nok als dunne lijn.
      s += `<path d="M${pt(...d.Q(d.n0, d.cr, d.nok))}L${pt(...d.Q(d.n1, d.cr, d.nok))}" stroke="#cfe6ff" stroke-opacity="0.6" stroke-width="1.4"/>`;
    }

    // De stroom: een lijn over de grond, onder wat ervoor staat (de auto), met zijn label (zoals "0,4 kW van het net" op Thuis).
    const STROOM = { violet: '#a78bfa', zon: '#f7b548', mint: '#6ee7b7' };
    for (const st2 of o.stroom ?? []) {
      const pp = (st2.pad ?? []).map((q) => P(...q));
      if (pp.length < 2) continue;
      const kl = STROOM[st2.toon] ?? STROOM.violet;
      const d = `M${pp.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join('L')}`;
      s += `<path d="${d}" stroke="${kl}" stroke-opacity="0.25" stroke-width="5" fill="none" stroke-linejoin="round"/>`;
      s += `<path d="${d}" stroke="${kl}" stroke-width="2.2" fill="none" stroke-dasharray="2 7" stroke-linecap="round" stroke-linejoin="round" class="sc-stroom"/>`;
      if (st2.label && !o.stil) {
        const [lx, ly] = pp[0];
        const w = st2.label.length * 7.6 + 28;
        const [px, py] = [lx + (st2.dx ?? 10), ly + (st2.dy ?? 26)];
        labels.push({ x: px, y: py - 14, b: w, h: 30, prio: 4, s: `<g transform="translate(${px.toFixed(1)} ${py.toFixed(1)})"><rect x="0" y="-15" width="${w.toFixed(0)}" height="30" rx="12" fill="#0d1a30" stroke="${kl}" stroke-opacity="0.55"/><text x="${(w / 2).toFixed(1)}" y="5.5" text-anchor="middle" ${FONT} font-size="14.5" font-weight="700" fill="#eef3f7">${esc(st2.label)}</text></g>` });
      }
    }
    s += tekenBuiten(voorHuis);
    /** Een apparaat buiten (een lamp, de lampjes in de border, een lantaarn, de deurbel, een zonnescherm). */
    const buitenApparaat = (a) => {
      let x2 = '';
      const draait = aan.has(a.id);
      if (a.soort === 'licht') {
        const v0 = P(a.x, a.y, 0.02);
        if (draait) x2 += `<ellipse cx="${v0[0].toFixed(1)}" cy="${v0[1].toFixed(1)}" rx="${(1.1 * k).toFixed(1)}" ry="${(1.1 * k * sp).toFixed(1)}" fill="#ffd9a0" fill-opacity="${o.avond ? 0.28 : 0.08}"/>`;
        const z = a.z ?? 0.6;
        // Laag: een tuinlampje op een paaltje; hoog: een lamp aan de muur.
        if (z < 1.2) {
          const p0 = P(a.x, a.y, 0);
          const p1 = P(a.x, a.y, z);
          x2 += `<path d="M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}" stroke="#55606e" stroke-width="2"/>`;
        }
        const h = P(a.x, a.y, z);
        if (draait && o.avond) x2 += `<circle cx="${h[0].toFixed(1)}" cy="${h[1].toFixed(1)}" r="9" fill="url(#hm-gloed)" opacity="0.55"/>`;
        x2 += `<circle cx="${h[0].toFixed(1)}" cy="${h[1].toFixed(1)}" r="2.6" fill="${draait ? '#ffe2b0' : '#5c6876'}"/>`;
      } else if (a.soort === 'snoer') {
        // Lampjes langs de border: een snoer met bolletjes; aan geven ze een warm puntje licht.
        const pp = a.punten ?? [];
        for (let i = 0; i + 1 < pp.length; i++) {
          const [p0, p1] = [pp[i], pp[i + 1]];
          const n = Math.max(2, Math.round(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 0.7));
          for (let j = 0; j <= n; j++) {
            const f = j / n;
            const q = P(p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f, 0.55 + 0.12 * Math.sin(j * 1.7));
            if (draait) x2 += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="6" fill="url(#hm-gloed)" opacity="0.35"/>`;
            x2 += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="1.7" fill="${draait ? '#ffe2b0' : '#6b7684'}"/>`;
          }
        }
      } else if (a.soort === 'paal') {
        // Een lantaarn: een paal met een kap; aan een kegel licht naar de grond.
        const z = a.z ?? 2.6;
        const p0 = P(a.x, a.y, 0);
        const p1 = P(a.x, a.y, z);
        if (draait) {
          const v0 = P(a.x, a.y, 0.02);
          x2 += `<ellipse cx="${v0[0].toFixed(1)}" cy="${v0[1].toFixed(1)}" rx="${(1.6 * k).toFixed(1)}" ry="${(1.6 * k * sp).toFixed(1)}" fill="#ffd9a0" fill-opacity="${o.avond ? 0.22 : 0.08}"/>`;
          x2 += `<circle cx="${p1[0].toFixed(1)}" cy="${p1[1].toFixed(1)}" r="16" fill="url(#hm-gloed)" opacity="0.5"/>`;
        }
        x2 += `<path d="M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}" stroke="#4a5563" stroke-width="2.6"/>`;
        x2 += `<rect x="${(p1[0] - 4).toFixed(1)}" y="${(p1[1] - 5).toFixed(1)}" width="8" height="7" rx="2" fill="${draait ? '#ffe2b0' : '#6b7684'}" stroke="#2a3340" stroke-width="1"/>`;
      } else if (a.soort === 'deurbel') {
        // Een deurbel (een camera bij de voordeur): een smal kastje aan de muur, de lens blauw; gloeit als er beweging is.
        const z = a.z ?? 1.4;
        const [n0, n1] = a.n ?? [-1, 0];
        const [ex, ey] = [-n1 * 0.07, n0 * 0.07];
        const kast = [[a.x - ex, a.y - ey, z - 0.13], [a.x + ex, a.y + ey, z - 0.13], [a.x + ex, a.y + ey, z + 0.13], [a.x - ex, a.y - ey, z + 0.13]];
        x2 += `<path d="${vlak(kast)}" fill="#1b2633" stroke="#cfe6ff" stroke-opacity="0.7" stroke-width="1"/>`;
        const l = P(a.x, a.y, z + 0.05);
        if (draait) x2 += `<circle cx="${l[0].toFixed(1)}" cy="${l[1].toFixed(1)}" r="9" fill="url(#hm-gloed)" opacity="0.6"/>`;
        x2 += `<circle cx="${l[0].toFixed(1)}" cy="${l[1].toFixed(1)}" r="2.4" fill="#6fd3ff"/>`;
        if (a.naam && !o.stil) labels.push({ x: l[0] - a.naam.length * 3.4, y: l[1] - 22, b: a.naam.length * 6.8, h: 14, prio: 2, s: `<text x="${l[0].toFixed(1)}" y="${(l[1] - 12).toFixed(1)}" text-anchor="middle" ${FONT} font-size="11.5" font-weight="700" fill="#cfe6ff" paint-order="stroke" stroke="#0b1424" stroke-width="3">${esc(a.naam)}</text>` });
      } else if (a.soort === 'camera') {
        // Een camera aan een muur (20 november 2026, de camera aan de garage): een wit kastje dat uitsteekt, de lens donker;
        // met een lamp erbij (`licht`) een gloed als die aan is.
        const z = a.z ?? 2.4;
        const [n0, n1] = a.n ?? [0, -1];
        const [lx, ly] = [-n1, n0];
        const hoek = (f, g, zz) => [a.x + lx * f * 0.14 + n0 * g * 0.26, a.y + ly * f * 0.14 + n1 * g * 0.26, zz];
        const onder = [hoek(-0.5, 0, z - 0.07), hoek(0.5, 0, z - 0.07), hoek(0.5, 1, z - 0.11), hoek(-0.5, 1, z - 0.11)];
        const boven = [hoek(-0.5, 0, z + 0.07), hoek(0.5, 0, z + 0.07), hoek(0.5, 1, z + 0.03), hoek(-0.5, 1, z + 0.03)];
        if (a.licht && aan.has(a.licht)) {
          const g = P(...hoek(0, 1.1, z - 0.05));
          const v0 = P(a.x + n0 * 2.2, a.y + n1 * 2.2, 0.02);
          x2 += `<ellipse cx="${v0[0].toFixed(1)}" cy="${v0[1].toFixed(1)}" rx="${(1.8 * k).toFixed(1)}" ry="${(1.8 * k * sp).toFixed(1)}" fill="#ffe9c4" fill-opacity="${o.avond ? 0.3 : 0.1}"/>`;
          x2 += `<circle cx="${g[0].toFixed(1)}" cy="${g[1].toFixed(1)}" r="12" fill="url(#hm-gloed)" opacity="0.7"/>`;
        }
        x2 += prisma(onder, boven, (v) => (Math.abs(v.n[0]) > Math.abs(v.n[1]) ? '#d7dee5' : '#e9eef2'), '#f3f6f8');
        const lens = P(...hoek(0, 1.02, z - 0.04));
        x2 += `<circle cx="${lens[0].toFixed(1)}" cy="${lens[1].toFixed(1)}" r="${Math.max(1.6, 0.045 * k).toFixed(1)}" fill="#1b2633" stroke="#6fd3ff" stroke-opacity="0.6" stroke-width="0.8"/>`;
      } else if (a.soort === 'screen' && a.uit) {
        // Een zonnescherm: een doek schuin naar buiten, gestreept als hij uit staat.
        const [ux, uy] = a.uit;
        const b = a.b ?? 3;
        const [lx, ly] = [-uy, ux];
        const z = a.z ?? 2.5;
        const lang = draait ? 1.8 : 0.25;
        const pp = [[a.x - (lx * b) / 2, a.y - (ly * b) / 2, z], [a.x + (lx * b) / 2, a.y + (ly * b) / 2, z], [a.x + (lx * b) / 2 + ux * lang, a.y + (ly * b) / 2 + uy * lang, z - lang * 0.35], [a.x - (lx * b) / 2 + ux * lang, a.y - (ly * b) / 2 + uy * lang, z - lang * 0.35]];
        x2 += `<path d="${vlak(pp)}" fill="#c9d4df" stroke="#8a98a8" stroke-width="0.8"/>`;
        if (draait) for (let i = 1; i < 6; i += 2) {
          const f0 = i / 6;
          const f1 = (i + 1) / 6;
          const lijn = (f) => [pp[0].map((n, j) => n + (pp[1][j] - n) * f), pp[3].map((n, j) => n + (pp[2][j] - n) * f)];
          const [a0, a1] = lijn(f0);
          const [b0, b1] = lijn(f1);
          x2 += `<path d="${vlak([a0, b0, b1, a1])}" fill="#ff9a6b" fill-opacity="0.75"/>`;
        }
      }
      return x2;
    };
    // Wat achter het huis hangt (het zonnescherm aan de achtergevel) komt achter het huis, de rest ervoor (20 november 2026).
    const achterKant = (a) => !dichterbij(klein(a.x ?? a.punten?.[0]?.[0] ?? cx, a.y ?? a.punten?.[0]?.[1] ?? cy), huisDoos);
    const achterStuk = (buiten.apparaten ?? []).filter(achterKant).map(buitenApparaat).join('');
    s = s.replace(ACHTER, () => achterStuk);
    s += (buiten.apparaten ?? []).filter((a) => !achterKant(a)).map(buitenApparaat).join('');
    s += zonneboog(false);
        // De namen bovenop. Wat botst schuift een stukje op of neer; past het nergens, dan valt het weg. De kamers met een temperatuur gaan voor.
    labels.sort((a, b) => b.prio - a.prio);
    const gezet = [];
    // Eerst op en neer, dan ook opzij (20 november 2026: op een huis met drie etages vielen kamers met een temperatuur weg).
    const plekken = [[0, 0], [0, -14], [0, 14], [0, -26], [0, 26], [-36, 0], [36, 0], [0, -40], [0, 40], [-36, -20], [36, -20], [-36, 20], [36, 20]];
    const zet = (l) => {
      for (const [dx, dy] of l.prio >= 3 ? plekken : plekken.slice(0, 5)) {
        const r = { x0: l.x - 4 + dx, y0: l.y - 6 + dy, x1: l.x + l.b + 4 + dx, y1: l.y + l.h + dy };
        if (r.y0 < 2 || r.y1 > Hpx - 2 || r.x0 < 2 || r.x1 > B - 2 || gezet.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) continue;
        gezet.push(r);
        s += dx || dy ? `<g transform="translate(${dx} ${dy.toFixed(1)})">${l.s}</g>` : l.s;
        return true;
      }
      return false;
    };
    for (const l of labels) if (!zet(l) && l.kort) zet({ ...l, ...l.kort });
    // Dichtbij: de randen van het beeld zacht laten weglopen.
    if (alleenHuis) s = `<defs><linearGradient id="hm-rand-v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.1" stop-color="#fff"/><stop offset="0.9" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="hm-rand"><rect width="${B}" height="${Hpx}" fill="url(#hm-rand-v)"/></mask></defs><g mask="url(#hm-rand)">${s}</g>`;
    return { svg: s, P, k };
  }

  global.huisMaat = { teken, dakVan };
})(typeof window !== 'undefined' ? window : globalThis);
