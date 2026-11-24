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
 *   aircoToon { apparaat-id: koelt | verwarmt }: wat een airco zelf doet; de kleur van zijn lucht (anders die van de kamer)
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

  // De ruitjes als rechthoeken en het dak van een gebouw: in kit/huis-maat-vorm.js (opgesplitst op 24 november 2026).
  const { rechthoeken, dakVan } = global.huisMaatVorm;

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
      return /** @type {any} */ ({ e, z0, top, v: st.vloeren[e.id] });
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
    // Een appartement met verdiepingen erboven (`o.zonderDak`, 21 november 2026): het dak hoort bij het gebouw, niet bij de woning.
    const metDak = eenEtage < 0 && !o.zonderDak;

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
    const hd = o.zonderDak ? null : daken.find((d) => d.b.soort === 'hoofdhuis');
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
    // Op Thuis (`o.boogVrij`) een kleinere boog dicht om het huis, zodat hij niet in de tekst ernaast loopt (22 november 2026).
    const ringR = o.boogVrij ? Math.max(X1 - X0, Y1 - Y0) * 0.62 + 1.5 : Math.max(X1 - X0, Y1 - Y0) * 1.0 + 4.5;
    let ringZ = (hd ? hd.nok : Math.max(...lagen.map((l) => l.top))) + 1.4;
    // De hoogte van de ring voor hij boven het huis uit getild wordt: daar mikt de bundel licht van de zon op (het dak).
    const ringZ0 = ringZ;
    // De hoogte opgerekt als de zon laag staat (de winter), nooit hoger dan 0,9 keer de straal (de zomer liep anders uit beeld).
    let rek = zb ? Math.min(1.4, 0.9 / Math.max(0.05, Math.sin((Math.max(...zb.baan.map((q) => q.el)) * Math.PI) / 180))) : 1;
    const ringPunt = ({ az, el }) => {
      const r = Math.PI / 180;
      const c = Math.cos(el * r);
      const rel = (az - zb.voorDeg) * r;
      /*
       * De voorgevel kijkt naar de straat (de kant met de kleinste y), en vanaf de straat ligt -x links: een zon een kwartslag
       * linksom van de voorgevel (az = voorgevel + 90°) staat links. Zo volgt de boog het kompas zoals in het poppenhuis.
       */
      return [cx - ringR * c * Math.sin(rel), cy - ringR * c * Math.cos(rel), ringZ + ringR * rek * Math.sin(Math.max(0, el) * r)];
    };
    // Op Thuis (`o.boogVrij`) telt de boog niet mee voor de schaal: het huis blijft groot, de boog loopt erom (22 november 2026).
    if (zb && !o.boogVrij) for (const q of zb.baan) if (q.el > -1.5) punten.push(ringPunt(q));
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
    /*
     * De zonneboog op Thuis (23 november 2026, Ricardo): net boven het huis, niet erdoorheen. De ring ligt om het huis,
     * dus het stuk aan de kant van de kijker valt in beeld over het huis: waar hij boven het huis langs gaat, gaat de
     * hele ring omhoog tot hij 40 cm boven het dak blijft, en hij mag tot een kwart platter als zijn top dan lager
     * blijft (en in beeld). Waar de tekst bovenin ligt (`o.vrij`, de kop op de wand), vervaagt hij (huis-maat-hemel.js):
     * een boog die overal om de tekst heen past, is er op 16:9 niet.
     */
    if (zb && o.boogVrij) {
      const nok = hd ? hd.nok : Math.max(...lagen.map((l) => l.top));
      const goot = Math.max(...lagen.map((l) => l.top));
      const [mx, my] = [(X0 + X1) / 2, (Y0 + Y1) / 2];
      const dak = [[X0, Y0, goot], [X1, Y0, goot], [X1, Y1, goot], [X0, Y1, goot], [mx, Y0, nok], [mx, Y1, nok], [X0, my, nok], [X1, my, nok]].map((q) => P(...q));
      const voet = [[X0, Y0, 0], [X1, Y0, 0], [X1, Y1, 0], [X0, Y1, 0]].map((q) => P(...q)[0]);
      const [hx0, hx1] = [Math.min(...voet), Math.max(...voet)];
      const top = Math.min(...dak.map((q) => q[1]));
      const perMeter = P(cx, cy, 0)[1] - P(cx, cy, 1)[1];
      const [z0, rek0] = [ringZ, rek];
      let beste = null;
      for (let i = 0; i <= 4 && perMeter > 0; i++) {
        rek = rek0 * (1 - i * 0.06);
        ringZ = z0;
        const pp = [...zb.baan.filter((q) => q.el > -1.5), ...(zb.nu && zb.nu.el > -2 ? [zb.nu] : [])].map((q) => P(...ringPunt(q)));
        let nodig = 0;
        for (const p of pp) if (p[0] >= hx0 && p[0] <= hx1) nodig = Math.max(nodig, p[1] - (top - 0.4 * perMeter));
        const dy = Math.max(0, nodig);
        // De top van de boog na het optillen; boven de rand van de tekening telt als slecht (de zon valt eruit).
        const piek = Math.min(...pp.map((p) => p[1])) - dy;
        const kans = { rek, dz: dy / perMeter, piek, uit: piek < 14 };
        if (!beste || (beste.uit && !kans.uit) || (beste.uit === kans.uit && kans.piek > beste.piek + 1e-9)) beste = kans;
      }
      if (beste) {
        rek = beste.rek;
        ringZ = z0 + beste.dz;
      } else [ringZ, rek] = [z0, rek0];
    }
    const vlak = (pp) => `M${pp.map((p) => pt(...p)).join('L')}Z`;
    /*
     * Tikken (21 november 2026, stap c van de nieuwe tekenaar; `o.tik`): onzichtbare vlakken met data-kamer (en
     * data-zone voor een deel buiten, `kamer~zone`), zoals in het poppenhuis, zodat Thuis en een kamer er hetzelfde op
     * reageren. In de volgorde van tekenen: wat erover ligt, vangt de tik. De panelen (`o.panelenTik`) liggen onderop,
     * zodat een kamer op zolder onder het dak altijd te tikken is.
     */
    const tikLaag = [];
    const kamerData = (kamer) => {
      if (!kamer || String(kamer).startsWith('@')) return '';
      const [kk, zz] = String(kamer).split('~');
      return ` data-kamer="${esc(kk)}"${zz ? ` data-zone="${esc(zz)}"` : ''}`;
    };
    const tikAttr = (kamer, naam) => (o.tik && kamerData(kamer) ? `class="sc-tik"${kamerData(kamer)} fill="transparent" role="link" tabindex="0" aria-label="${esc(naam ?? String(kamer).split('~').pop())}" style="cursor: pointer"` : null);
    /** Een onzichtbaar vlak om de hele doos (het omhulsel van de hoeken op het scherm). */
    const omhulsel = (x0, x1, y0, y1, z0, z1) => {
      const pp = [];
      for (const x of [x0, x1]) for (const y of [y0, y1]) for (const zz of [z0, z1]) pp.push(P(x, y, zz));
      pp.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const kruis = (o2, a, b) => (a[0] - o2[0]) * (b[1] - o2[1]) - (a[1] - o2[1]) * (b[0] - o2[0]);
      const onder = [];
      for (const q of pp) {
        while (onder.length >= 2 && kruis(onder[onder.length - 2], onder[onder.length - 1], q) <= 0) onder.pop();
        onder.push(q);
      }
      const boven = [];
      for (const q of [...pp].reverse()) {
        while (boven.length >= 2 && kruis(boven[boven.length - 2], boven[boven.length - 1], q) <= 0) boven.pop();
        boven.push(q);
      }
      const rand = [...onder.slice(0, -1), ...boven.slice(0, -1)];
      return `M${rand.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join('L')}Z`;
    };
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
      } else if (!hm.geenZon) {
        const [zx, zy, r] = laag ? [hm.tijd === 'avond' ? B * 0.86 : B * 0.14, Hpx * 0.34, 16] : [B * 0.8, Hpx * 0.12, 18];
        x2 += `<circle cx="${zx}" cy="${zy}" r="${r * 3.4}" fill="url(#hm-zongloed)" opacity="${(0.55 - 0.3 * (hm.wolken ?? 0)).toFixed(2)}"/><circle cx="${zx}" cy="${zy}" r="${r}" fill="${laag ? '#ffb86b' : '#ffd27a'}" opacity="${(1 - 0.5 * (hm.wolken ?? 0)).toFixed(2)}"/>`;
      }
      /*
       * Wolken (22 november 2026, zoals in het poppenhuis): zoveel als de lucht bewolkt is, op vaste plekken, zacht en grijs;
       * bij regen of sneeuw altijd een paar. Overdag lichter dan 's nachts.
       */
      const nW = Math.min(6, Math.round(Math.max(hm.wolken ?? 0, o.weer ? 0.7 : 0) * 6));
      const WOLK = [[0.2, 0.1, 1], [0.6, 0.06, 0.8], [0.86, 0.2, 1.1], [0.38, 0.2, 0.7], [0.07, 0.3, 0.9], [0.72, 0.3, 0.75]];
      for (let i = 0; i < nW; i++) {
        const [fx, fy, sc] = WOLK[i];
        const [wx, wy, r] = [B * fx, Hpx * fy, 30 * sc];
        const kl = o.weer ? '#7d8d9e' : '#c9d4df';
        x2 += `<g opacity="${nacht ? 0.14 : 0.3}" filter="url(#hm-zacht)"><ellipse cx="${wx.toFixed(0)}" cy="${wy.toFixed(0)}" rx="${(r * 1.7).toFixed(0)}" ry="${(r * 0.55).toFixed(0)}" fill="${kl}"/><ellipse cx="${(wx - r * 0.5).toFixed(0)}" cy="${(wy - r * 0.35).toFixed(0)}" rx="${(r * 0.8).toFixed(0)}" ry="${(r * 0.6).toFixed(0)}" fill="${kl}"/><ellipse cx="${(wx + r * 0.45).toFixed(0)}" cy="${(wy - r * 0.45).toFixed(0)}" rx="${r.toFixed(0)}" ry="${(r * 0.72).toFixed(0)}" fill="${kl}"/></g>`;
      }
      return `<defs><radialGradient id="hm-zongloed"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.7"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs>${x2}`;
    };

    let s = `<defs><linearGradient id="hm-aarde1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a4232"/><stop offset="1" stop-color="#2a1d15"/></linearGradient><linearGradient id="hm-aarde2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3528"/><stop offset="1" stop-color="#21170f"/></linearGradient><filter id="hm-zacht" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="8"/></filter><filter id="hm-wazig" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.6"/></filter></defs><defs><radialGradient id="hm-gloed"><stop offset="0" stop-color="#fff" stop-opacity="0.9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><linearGradient id="hm-glas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe6ff" stop-opacity="0.10"/><stop offset="1" stop-color="#bfe6ff" stop-opacity="0.03"/></linearGradient></defs>`;

    /** @type {any[]} */
    const labels = [];
    /** Apparaten die nergens pasten (22 november 2026): voor de proef, en om na te lopen. */
    const overgeslagen = [];
    /** Per vloer de plekken van apparaten op de vloer, zodat meubels eromheen gaan. */
    const apparaatVloer = new Map();
    /** Per vloer de plekken van de meubels, zodat wat los staat ernaast komt. */
    const meubelVloer = new Map();
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
      const dozen = M.delen(b, opt).map(([a0, a1, d0, d1, z0, z1, kleur, smal], i) => {
        const [q0, q1] = [W(a0, d0, z0), W(a1, d1, z1)];
        return { x: Math.min(q0[0], q1[0]), b: Math.abs(q1[0] - q0[0]), y: Math.min(q0[1], q1[1]), d: Math.abs(q1[1] - q0[1]), z0: q0[2], z1: q1[2], kleur, smal, deel: [a0, a1, d0, d1, z0, z1], i };
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
      const blokS = [];
      for (const q of volg) {
        let s2 = '';
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
        blokS.push({ i: q.i, s: s2 });
      }
      let s2 = '';
      const tekenDetail = (v, dV, as) => {
        if (v.cirkel) {
          const [a, zz, r] = v.cirkel;
          const c = W(a, dV, zz);
          return cirkel(c[0], c[1], c[2], r, as, `fill="${v.vul ?? 'none'}"${v.rand ? ` stroke="${v.rand}" stroke-width="${v.dik ?? 1}"` : ''}${v.streep ? ' stroke-dasharray="3 3"' : ''}${v.klasse ? ` class="${v.klasse}" style="transform-box: fill-box; transform-origin: center"` : ''}`);
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
      /*
       * De voorkant en de zijkant horen bij een blok (`detailBij`, 22 november 2026): de pui van het tuinhuis zit op zijn
       * gevel, vóór de palen en het overstek; eerst lag hij over alles heen (de linkerpaal afgekapt, het glas boven het dak).
       * Zonder `detailBij` komen ze als laatste, zoals bij de auto.
       */
      s2 = M.detailBij == null ? blokS.map((x) => x.s).join('') + s2 : blokS.map((x) => x.s + (x.i === M.detailBij ? s2 : '')).join('');
      const x0 = Math.min(...dozen.map((q) => q.x));
      const x1 = Math.max(...dozen.map((q) => q.x + q.b));
      const y0 = Math.min(...dozen.map((q) => q.y));
      const y1 = Math.max(...dozen.map((q) => q.y + q.d));
      return { s: s2, d: diep((x0 + x1) / 2, (y0 + y1) / 2), rect: { x: x0, b: x1 - x0, y: y0, d: y1 - y0 }, W };
    };
    // hemel: in kit/huis-maat-hemel.js (opgesplitst op 22 november 2026). Wat het deel van de tekenaar deelt:
    const chemel = {};
    Object.defineProperties(chemel, {
      o: { get: () => o },
      s: { get: () => s, set: (w) => {
          s = w;
        } },
      hemel: { get: () => hemel },
      B: { get: () => B },
      Hpx: { get: () => Hpx },
      eenEtage: { get: () => eenEtage },
      metDak: { get: () => metDak },
      X0: { get: () => X0 },
      X1: { get: () => X1 },
      dakZ: { get: () => dakZ },
      Y0: { get: () => Y0 },
      lagen: { get: () => lagen },
      P: { get: () => P },
      buiten: { get: () => buiten },
      k: { get: () => k },
      zb: { get: () => zb },
      diep: { get: () => diep },
      cx: { get: () => cx },
      cy: { get: () => cy },
      ringPunt: { get: () => ringPunt },
      pt: { get: () => pt },
      FONT: { get: () => FONT },
      esc: { get: () => esc },
      ringZ: { get: () => ringZ },
      ringZ0: { get: () => ringZ0 },
      erf: { get: () => erf },
      vlak: { get: () => vlak },
      eiland: { get: () => eiland },
      E0: { get: () => E0 },
      E1: { get: () => E1 },
      F0: { get: () => F0 },
      F1: { get: () => F1 },
      dikte: { get: () => dikte },
      naarKijker: { get: () => naarKijker },
      tikAttr: { get: () => tikAttr },
      tikLaag: { get: () => tikLaag },
    });
    const hemelDeel = global.huisMaatHemel(chemel);

    const { weerLaag, feestLaag, zonneboog } = hemelDeel;
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
    // buiten: in kit/huis-maat-buiten.js (opgesplitst op 22 november 2026). Wat het deel van de tekenaar deelt:
    /*
     * Een blok met een andere boven- en onderkant (vier hoeken elk): de zijden naar de kijker, dan de bovenkant.
     * Hier, vóór het deel buiten (23 november 2026): dat tekent bij het maken al wat achter het huis staat, en een
     * auto achter het huis (bij sommige hoeken) vroeg prisma toen het nog niet bestond; dan viel Thuis terug op het
     * poppenhuis.
     */
    const prisma = (onder, boven, zij, top) => {
      let x2 = '';
      const vlakken = [0, 1, 2, 3].map((i) => {
        const [a, b] = [onder[i], onder[(i + 1) % 4]];
        return { p: [a, b, boven[(i + 1) % 4], boven[i]], n: [b[1] - a[1], -(b[0] - a[0])] };
      });
      for (const v of vlakken.sort((p1, p2) => dp(p2.p) - dp(p1.p))) if (naarKijker(...v.n)) x2 += `<path d="${vlak(v.p)}" fill="${zij(v)}" stroke="rgb(13 26 48 / 0.35)" stroke-width="0.6" stroke-linejoin="round"/>`;
      return x2 + `<path d="${vlak(boven)}" fill="${top}" stroke="rgb(13 26 48 / 0.35)" stroke-width="0.6" stroke-linejoin="round"/>`;
    };
    const cbuiten = {};
    Object.defineProperties(cbuiten, {
      s: { get: () => s, set: (w) => {
          s = w;
        } },
      achterHuis: { get: () => achterHuis },
      o: { get: () => o },
      daken: { get: () => daken },
      metDak: { get: () => metDak },
      vlak: { get: () => vlak },
      naarKijker: { get: () => naarKijker },
      dp: { get: () => dp },
      dakVan: { get: () => dakVan },
      P: { get: () => P },
      k: { get: () => k },
      pt: { get: () => pt },
      labels: { get: () => labels },
      FONT: { get: () => FONT },
      esc: { get: () => esc },
      sp: { get: () => sp },
      zetModel: { get: () => zetModel },
      buiten: { get: () => buiten },
      tikAttr: { get: () => tikAttr },
      tikLaag: { get: () => tikLaag },
      omhulsel: { get: () => omhulsel },
      MOD: { get: () => MOD },
      dichterbij: { get: () => dichterbij },
      diep: { get: () => diep },
    });
    const buitenDeel = global.huisMaatBuiten(cbuiten);

    const { tekenBuiten, ACHTER, paneelVan, hoofdDak, paneelVeld, kapel } = buitenDeel;
    const kamerVan = (r) => (r?.kamer ? r.kamer : null);
    // meubels: in kit/huis-maat-meubels.js (opgesplitst op 22 november 2026). Wat het deel van de tekenaar deelt:
    const cmeubels = {};
    Object.defineProperties(cmeubels, {
      naarKijker: { get: () => naarKijker },
      apparaatVloer: { get: () => apparaatVloer },
      si: { get: () => si },
      co: { get: () => co },
      m: { get: () => m },
      hd: { get: () => hd },
      dakZ: { get: () => dakZ },
      zetModel: { get: () => zetModel },
      meubelVloer: { get: () => meubelVloer },
      MOD: { get: () => MOD },
      diep: { get: () => diep },
      vlak: { get: () => vlak },
    });
    const meubelsDeel = global.huisMaatMeubels(cmeubels);

    const { meubelsVoor } = meubelsDeel;
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
        const ta = tikAttr(kamerVan(r), naam);
        // De hele kamer van vloer tot plafond is te tikken, zoals in het poppenhuis (22 november 2026: alleen de vloer vroeg precisie).
        if (ta) {
          const z1 = laag.bovenste ? Math.min(top, z0 + 2.4) : top;
          const blokjes = rechthoeken(v, BUITEN).filter((q) => String(q.id) === String(id));
          tikLaag.push(blokjes.length ? blokjes.map((q) => `<path d="${omhulsel(m(q.x0), m(q.x1), m(q.y0), m(q.y1), z0, z1)}" ${ta}/>`).join('') : `<path d="${paden.join('')}" ${ta}/>`);
        }
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
        // Een buitenmuur die van je af kijkt, staat achter alles in de kamer: eerst tekenen (22 november 2026, de kast op zolder verloor zijn zijkant).
        const achterMuur = run.soort === 2 && !voor ? 50 : 0;
        const dicht = run.soort === 2 && DICHT.test(ruimteSoort(binnen));
        const eigenRamen = (v.openingen ?? []).length > 0;
        // Binnenmuren in stukjes van 40 centimeter (buitenmuren houden hun ramen per stuk van 2 meter): zo komt een meubel tegen een muur goed voor of achter die muur (het bad in de badkamer, 21 november 2026).
        for (const deel of K.muurDelen(v, run, run.soort === 1 ? 4 : 20)) {
          const [a, b] = [deel.van, deel.tot];
          if (deel.soort) {
            // Een deur of raam uit de tekening.
            const [x0, y0, x1, y1] = run.as === 'x' ? [m(run.op), m(a), m(run.op), m(b)] : [m(a), m(run.op), m(b), m(run.op)];
            const d = diep((x0 + x1) / 2, (y0 + y1) / 2) + achterMuur;
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
              /*
               * Een dakraam (22 november 2026, Ricardo): een raam getekend in een muur waar het dak lager komt dan het raam,
               * zit in het dakvlak erboven. Vanaf de muur de kamer in tot het dak tussen 1,0 en 2,0 meter boven de vloer is.
               */
              /*
               * Onder een dakkapel (22 november 2026, Ricardo: het raam van de slaapkamer op zolder kwam over de dakkapel):
               * dan is het raam het raam van de dakkapel, die zijn eigen raam al tekent; geen dakraam.
               */
              const onderKapel = (hd?.kapellen ?? []).some((kp) => {
                const xs = kp.voor.p.map((q) => q[0]);
                const ys = kp.voor.p.map((q) => q[1]);
                const [nx2, ny2] = kp.voor.n;
                // De kapel kijkt dezelfde kant op als de muur (n wijst naar buiten), en het raam ligt erbinnen.
                if (nx2 * n[0] + ny2 * n[1] < 0.5) return false;
                const langs = run.as === 'x' ? [Math.min(y0, y1), Math.max(y0, y1), Math.min(...ys), Math.max(...ys)] : [Math.min(x0, x1), Math.max(x0, x1), Math.min(...xs), Math.max(...xs)];
                return langs[1] > langs[2] + 0.05 && langs[0] < langs[3] - 0.05;
              });
              if (!past && !onderKapel && run.soort === 2 && !band && Math.min(dakZ(x0, y0), dakZ(x1, y1)) < z0 + 2.35) {
                const [ix, iy] = [-n[0], -n[1]];
                const opD = (d2, hoogte) => {
                  for (let t2 = 0; t2 <= 4.0001; t2 += 0.05) if (Math.min(dakZ(x0 + ix * t2, y0 + iy * t2), dakZ(x1 + ix * t2, y1 + iy * t2)) >= hoogte) return Math.max(d2, t2);
                  return null;
                };
                const d0 = opD(0, z0 + 1.0);
                const d1 = d0 == null ? null : Math.min(opD(d0 + 0.3, z0 + 2.0) ?? d0 + 1.1, d0 + 1.2);
                if (d0 != null && d1 != null && d1 - d0 >= 0.3) {
                  const opDak = (x, y) => [x, y, dakZ(x, y) + 0.03];
                  const hoekenR = [opDak(x0 + ix * d0, y0 + iy * d0), opDak(x1 + ix * d0, y1 + iy * d0), opDak(x1 + ix * d1, y1 + iy * d1), opDak(x0 + ix * d1, y0 + iy * d1)];
                  const brandt = o.avond && lichtIn.has(binnen);
                  const cxr = (x0 + x1) / 2 + ix * (d0 + d1) / 2;
                  const cyr = (y0 + y1) / 2 + iy * (d0 + d1) / 2;
                  stukken.push({ d: diep(cxr, cyr) - 0.6, s: `<path d="${vlak(hoekenR)}" fill="${brandt ? 'rgb(243 199 122 / 0.6)' : 'rgb(143 180 214 / 0.45)'}" stroke="#eef5fb" stroke-opacity="0.85" stroke-width="1.4" stroke-linejoin="round"/>` });
                }
              }
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
          const d = diep((x0 + x1) / 2, (y0 + y1) / 2) + achterMuur;
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
          // Zoals de binnenmuren (halfhoog): de trap houdt op 1,2 meter op, anders steekt hij door de kamer erboven (22 november 2026).
          if (hoogte * f1 > 1.2) break;
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
      const wandenBij = (cx, cy, ruimte = null) => {
        const alle = [];
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
          alle.push({ run, afst, kant, langs });
        }
        return alle.sort((a, b) => a.afst - b.afst);
      };
      /*
       * De apparaten van deze etage, elk met zijn model uit de vaste lijst (21 november 2026): waar de bewoner het in Je huis
       * plaatste, tegen de dichtstbijzijnde muur met de voorkant naar de kamer, aan het plafond of los op de vloer.
       */
      /** Eén apparaat tekenen op zijn plek `pl`: het model, een plas licht als hij brandt, een snoer, de lucht van een airco. */
      const tekenApparaat = (q, naam, M, pl, draait) => {
        const md = zetModel(naam, pl, { aan: draait });
        if (!md) return;
        // Wat op de vloer staat of laag en groot aan de muur hangt (een radiator), houdt zijn plek vrij van meubels (22 november 2026).
        if (M.hangt === 'vloer' || M.hangt === 'vrij' || (pl.z - z0 < 0.7 && M.h >= 0.3)) (apparaatVloer.get(v) ?? apparaatVloer.set(v, []).get(v)).push({ x0: md.rect.x - 0.1, x1: md.rect.x + md.rect.b + 0.1, y0: md.rect.y - 0.1, y1: md.rect.y + md.rect.d + 0.1 });
        let x2 = '';
        // Het stuk binnenmuur achter een apparaat dat hoger hangt dan de halfhoge muur.
        if (pl.paneel) {
          const q2 = pl.paneel;
          const hoek = (a, zz) => (q2.as === 'x' ? [q2.op, a, zz] : [a, q2.op, zz]);
          x2 += `<path d="${vlak([hoek(q2.van, q2.z0), hoek(q2.tot, q2.z0), hoek(q2.tot, q2.z1), hoek(q2.van, q2.z1)])}" fill="${q2.as === 'x' ? '#26354d' : '#2d3d57'}" stroke="rgb(255 255 255 / 0.12)" stroke-width="0.6"/>`;
        }
        const mx = md.rect.x + md.rect.b / 2;
        const my = md.rect.y + md.rect.d / 2;
        // Een lamp die brandt: een plas licht op de vloer (een lamp aan de muur een stukje de kamer in).
        if (M.licht && draait) {
          const [vx, vy] = pl.wand ? (pl.wand === 'x' ? [mx + pl.kant * 0.7, my] : [mx, my + pl.kant * 0.7]) : [mx, my];
          const v0 = P(vx, vy, z0 + 0.01);
          const r0 = M.hangt === 'plafond' ? 1.4 : 1.0;
          const lk = o.lampKleur?.[q.a.id] ?? '#ffd9a0';
          stukken.push({ d: diep(vx, vy) + 30, s: `<ellipse cx="${v0[0].toFixed(1)}" cy="${v0[1].toFixed(1)}" rx="${(r0 * k).toFixed(1)}" ry="${(r0 * k * sp).toFixed(1)}" fill="${lk}" fill-opacity="${o.avond ? 0.3 : 0.12}"/>` });
          if (M.snoer) {
            const l = P(mx - 0.6, my, z0 + 0.05);
            const r = P(mx + 0.6, my, z0 + 0.05);
            const b = P(mx, my, pl.z);
            x2 += `<path d="M${b[0].toFixed(1)} ${b[1].toFixed(1)}L${l[0].toFixed(1)} ${l[1].toFixed(1)}L${r[0].toFixed(1)} ${r[1].toFixed(1)}Z" fill="${o.lampKleur?.[q.a.id] ?? '#ffd9a0'}" fill-opacity="${o.avond ? 0.1 : 0.05}"/>`;
          }
        }
        // Een hanglamp hangt aan een snoer.
        if (M.snoer) {
          const s0 = P(mx, my, plafond(mx, my, top));
          const s1 = P(mx, my, pl.z + M.h);
          x2 += `<path d="M${s0[0].toFixed(1)} ${s0[1].toFixed(1)}L${s1[0].toFixed(1)} ${s1[1].toFixed(1)}" stroke="#8090a0" stroke-width="1"/>`;
        }
        x2 += md.s;
        // Een radiator die warm is: zachte warmte die langs de muur omhoog golft, zoals in het poppenhuis (22 november 2026).
        if (naam === 'radiator' && draait) {
          for (const a of [-0.3, 0, 0.3]) {
            const p0 = P(...md.W(a, 0.12, 0.66));
            const p1 = P(...md.W(a + 0.06, 0.14, 0.95));
            const p2 = P(...md.W(a, 0.16, 1.25));
            x2 += `<path d="M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}Q${p1[0].toFixed(1)} ${p1[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}" stroke="#ff9a6b" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.8"/>`;
          }
          const g = P(...md.W(0, 0.05, 0.9));
          x2 += `<circle cx="${g[0].toFixed(1)}" cy="${g[1].toFixed(1)}" r="${(0.6 * k).toFixed(1)}" fill="#ff7a4d" opacity="0.18" filter="url(#hm-zacht)"/>`;
        }
        // Een bewegingsmelder die nu beweging ziet: een ring die uitdijt op de vloer eronder, zoals in het poppenhuis (22 november 2026).
        if (naam === 'beweging' && draait) {
          const c = P(mx, my, z0 + 0.02);
          const rb = 1.2 * k;
          x2 += o.stil
            ? `<ellipse class="sc-beweging" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(rb * 0.6).toFixed(1)}" ry="${(rb * 0.6 * sp).toFixed(1)}" fill="none" stroke="#6ee7b7" stroke-width="2" stroke-opacity="0.7"/>`
            : `<ellipse class="sc-beweging" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(rb * 0.2).toFixed(1)}" ry="${(rb * 0.2 * sp).toFixed(1)}" fill="none" stroke="#6ee7b7" stroke-width="2"><animate attributeName="rx" values="${(rb * 0.2).toFixed(1)};${rb.toFixed(1)}" dur="2.2s" repeatCount="indefinite"/><animate attributeName="ry" values="${(rb * 0.2 * sp).toFixed(1)};${(rb * sp).toFixed(1)}" dur="2.2s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values="0.9;0" dur="2.2s" repeatCount="indefinite"/></ellipse>`;
        }
        // Een airco die draait: drie zachte stromen lucht de kamer in, warm of koel.
        if (M.lucht && draait) {
          // Blauw als hij koelt, oranje als hij verwarmt (23 november 2026: eerst gaf de kamer de kleur, en die kon koelt zeggen terwijl de airco verwarmde).
          const toon = o.aircoToon?.[q.a.id] ?? kamerInfo[t.st.apparaten.find((a) => a.id === q.a.id)?.kamer]?.toon;
          const kleur = toon === 'koelt' ? '#6fd3ff' : '#ff7a4d';
          for (let i = -1; i <= 1; i++) {
            const a = P(...md.W(i * 0.25, M.d, -0.02));
            const b = P(...md.W(i * 0.25, M.d + 0.7, -0.45));
            x2 += `<path d="M${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${((a[0] + b[0]) / 2).toFixed(1)} ${((a[1] + b[1]) / 2 + 5).toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}" stroke="${kleur}" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.75"/>`;
          }
        }
        stukken.push({ d: md.d - 0.1, s: x2 });
      };
      const uitgesteld = [];
      for (const q of band ? [] : punten) {
        let naam = MOD?.voor(q.a);
        let M = naam ? MOD.MODELLEN[naam] : null;
        if (!M) continue;
        const draait = aan.has(q.a.id);
        const [x, y] = [m(q.x), m(q.y)];
        /*
         * Onder een schuin dak (22 november 2026, de zolder van Ricardo): wat op zijn plek niet past, schuift de kamer in
         * tot het past, in plaats van weg te vallen (de staande lamp in de slaapkamer, de droger in de wasruimte).
         */
        const rr = maten(v)[q.ruimte]?.r;
        const midden = rr ? [m((rr.x0 + rr.x1) / 2), m((rr.y0 + rr.y1) / 2)] : [x, y];
        const naarMidden = (past) => {
          for (let f = 0; f <= 1.0001; f += 0.05) {
            const [xx, yy] = [x + (midden[0] - x) * f, y + (midden[1] - y) * f];
            if (past(xx, yy)) return [xx, yy];
          }
          return null;
        };
        let pl;
        // Wat los op de vloer staat (een staande lamp) komt na de meubels, op een vrije plek ernaast (22 november 2026).
        if (M.hangt === 'vrij') {
          uitgesteld.push({ q, naam, M, draait, x, y, midden, rr });
          continue;
        }
        if (M.hangt === 'plafond') {
          // Een plafonnière onder een schuin dak hangt als hanglamp aan het dak, niet als plat doosje scheef ernaast.
          if (naam === 'plafonniere' && plafond(x, y, top) < top - 0.05) {
            naam = 'hanglamp';
            M = MOD.MODELLEN.hanglamp;
          }
          const MM = M;
          const plek = naarMidden((xx, yy) => plafond(xx, yy, top) - (MM.plafond ?? 0) - MM.h - z0 >= 1.9);
          if (!plek) {
            overgeslagen.push({ id: q.a.id, waarom: 'plafond' });
            continue;
          }
          pl = { x: plek[0], y: plek[1], z: Math.min(plafond(plek[0], plek[1], top) - (M.plafond ?? 0) - M.h, z0 + 2.4) };
          if (naam === 'plafonniere' || naam === 'rookmelder') pl.z = plafond(plek[0], plek[1], top) - (M.plafond ?? 0) - M.h;
        } else {
          /*
           * Tegen de dichtstbijzijnde muur van zijn eigen kamer waar het past: een airco of iets aan de muur niet laag
           * tegen een knieschot (22 november 2026: de airco op zolder hing bijna op de vloer), maar aan de volgende muur
           * waar wel ruimte is; witgoed onder een schuin dak een stukje van de muur af, de kamer in.
           */
          const half = M.b / 2;
          const plafOp = (px, py, run, kant, weg = 0) => Math.min(...[[-half, weg], [half, weg], [-half, weg + M.d], [half, weg + M.d]].map(([a, d2]) => plafond(...(run.as === 'x' ? [px + kant * d2, py + a] : [px + a, py + kant * d2]), top)));
          const wil = M.hangt === 'vloer' ? 0 : M.plafond != null ? 1.5 : Math.min((M.z ?? 1.2) - 0.25, 1.4);
          let reserve = null;
          let kandidaten = wandenBij(q.x, q.y, q.ruimte);
          let raamVoorkeur = false;
          // Een radiator zonder eigen plek hangt onder het dichtstbijzijnde raam van zijn kamer (besluit 333).
          if (naam === 'radiator' && !q.zelf) {
            const onderRaam = [];
            for (const w of kandidaten) {
              if (w.run.soort !== 2) continue;
              for (const g of v.openingen ?? []) {
                if (g.soort !== 'raam' || g.as !== w.run.as || g.op !== w.run.op || g.van < w.run.van - 0.5 || g.tot > w.run.tot + 0.5) continue;
                const c = (g.van + g.tot) / 2;
                // Alleen een raam van zijn eigen kamer: een lange buitenmuur loopt langs meer kamers.
                const l = Math.floor(c);
                const naast = w.run.as === 'x' ? [v.cel[l * v.W + w.run.op - 1], v.cel[l * v.W + w.run.op]] : [v.cel[(w.run.op - 1) * v.W + l], v.cel[w.run.op * v.W + l]];
                if (!naast.includes(q.ruimte)) continue;
                const [gx, gy] = w.run.as === 'x' ? [w.run.op, c] : [c, w.run.op];
                onderRaam.push({ ...w, langs: c, afst: Math.hypot(gx - q.x, gy - q.y) });
              }
            }
            kandidaten = [...onderRaam.sort((a, b) => a.afst - b.afst), ...kandidaten];
            raamVoorkeur = onderRaam.length > 0;
          }
          /*
           * Witgoed met de voorkant naar de kijker (22 november 2026, Ricardo: de droger stond met zijn rug naar je toe tegen
           * de knieschot). Een muur waar de voorkant van je af kijkt telt 2,5 meter verder weg. Ook een radiator zonder raam.
           */
          if (M.hangt === 'vloer' || (naam === 'radiator' && !raamVoorkeur && !q.zelf)) kandidaten = [...kandidaten].sort((a, b) => a.afst + (naarKijker(...(a.run.as === 'x' ? [a.kant, 0] : [0, a.kant])) ? 0 : 25) - (b.afst + (naarKijker(...(b.run.as === 'x' ? [b.kant, 0] : [0, b.kant])) ? 0 : 25)));
          muren: for (const w of kandidaten) {
            const { run, kant } = w;
            const vlakMuur = m(run.op) + kant * 0.03;
            const lo = m(run.van) + half + 0.05;
            const hi = m(run.tot) - half - 0.05;
            const begin = Math.min(hi, Math.max(lo, m(w.langs)));
            /*
             * Eerst waar hij hoort, dan verder langs de muur (22 november 2026): onder een schuin dak is een muur in het
             * midden hoger dan aan de kant, en de airco op zolder in het voorbeeldhuis paste op zijn plek nergens.
             */
            const langs = [begin];
            for (let st2 = 0.25; st2 <= hi - lo + 0.001; st2 += 0.25) for (const c of [begin - st2, begin + st2]) if (c >= lo - 1e-6 && c <= hi + 1e-6) langs.push(c);
            for (const midden2 of langs) {
              const [px, py] = run.as === 'x' ? [vlakMuur, midden2] : [midden2, vlakMuur];
              if (M.hangt === 'vloer') {
                // Witgoed staat op de vloer; onder een schuin dak schuift het van de muur af tot het past (hooguit 2,5 m).
                let weg = null;
                for (let d2 = 0; d2 <= 2.5001; d2 += 0.1) if (plafOp(px, py, run, kant, d2) - z0 >= M.h + 0.05) { weg = d2; break; }
                if (weg == null) continue;
                const [qx, qy] = run.as === 'x' ? [px + kant * weg, py] : [px, py + kant * weg];
                pl = { x: qx, y: qy, z: z0, wand: run.as, kant };
                break muren;
              }
              const plaf = plafOp(px, py, run, kant);
              let zb = M.plafond != null ? plaf - M.plafond - M.h : z0 + (M.z ?? 1.2);
              if (zb + M.h > plaf - 0.02) zb = plaf - 0.05 - M.h;
              if (zb < z0 + 0.05) continue;
              if (zb - z0 < wil) {
                // Te laag hier: de hoogste plek bewaren voor als het nergens op zijn hoogte past.
                if (!reserve || zb > reserve.z) reserve = { x: px, y: py, z: zb, wand: run.as, kant, paneel: null };
                continue;
              }
              /*
               * Aan een binnenmuur (die is halfhoog getekend): op zijn eigen hoogte, met een stuk muur erachter zodat het niet
               * zweeft (22 november 2026; eerst zakte het tot onder de 1,1 m, de spiegel van de badkamer hing op 28 cm).
               */
              const paneel = run.soort === 1 && zb + M.h > z0 + 1.1 ? { as: run.as, op: m(run.op), van: (run.as === 'x' ? py : px) - half - 0.12, tot: (run.as === 'x' ? py : px) + half + 0.12, z0: z0 + 1.1, z1: zb + M.h + 0.1 } : null;
              pl = { x: px, y: py, z: zb, wand: run.as, kant, paneel };
              break muren;
            }
          }
          pl ??= reserve;
          if (!pl) {
            overgeslagen.push({ id: q.a.id, waarom: 'muur' });
            continue;
          }
        }
        tekenApparaat(q, naam, M, pl, draait);
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
      // Wat los staat (een staande lamp): zo dicht mogelijk bij zijn plek, waar het onder het dak past en geen meubel of apparaat staat.
      for (const u of uitgesteld) {
        const bezet = [...(apparaatVloer.get(v) ?? []), ...(meubelVloer.get(v) ?? [])];
        const half = u.M.b / 2 + 0.05;
        const binnen = (xx, yy) => !u.rr || (xx - half >= m(u.rr.x0) && xx + half <= m(u.rr.x1) && yy - half >= m(u.rr.y0) && yy + half <= m(u.rr.y1));
        const vrijOp = (xx, yy) => binnen(xx, yy) && plafond(xx, yy, top) - z0 >= u.M.h + 0.1 && !bezet.some((Z) => xx + half > Z.x0 && xx - half < Z.x1 && yy + half > Z.y0 && yy - half < Z.y1);
        let plek = null;
        for (let r = 0; r <= 3.0001 && !plek; r += 0.15) {
          for (let i = 0; i < (r === 0 ? 1 : 16) && !plek; i++) {
            const h = (i / 16) * Math.PI * 2;
            const [xx, yy] = [u.x + Math.cos(h) * r, u.y + Math.sin(h) * r];
            if (vrijOp(xx, yy)) plek = [xx, yy];
          }
        }
        if (!plek) {
          overgeslagen.push({ id: u.q.a.id, waarom: 'vrij' });
          continue;
        }
        tekenApparaat(u.q, u.naam, u.M, { x: plek[0], y: plek[1], z: z0 }, u.draait);
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
        // Een berging zonder iets te melden blijft zonder naam; een zolder die als berging begint maar een temperatuur heeft
        // (stap f, 21 november 2026: de begin-indeling van het voorbeeldhuis) krijgt hem wel.
        if (band || o.stil || !naam || !rr || (DICHT.test(ruimteSoort(id)) && !kamerInfo[kamerVan(r)])) continue;
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
        // Zonder iets te melden (een kamer die Home Assistant niet kent) geen naam; met `kamers` leeg (een schets) wel, als het past.
        if (!info && (Object.keys(o.kamers ?? {}).length || breedte < 24)) continue;
        // Netter (20 november 2026, Ricardo): gecentreerd, kleiner en overal even groot; naam, temperatuur, en eronder wat er gebeurt.
        const midden = `text-anchor="middle" ${FONT}`;
        /*
         * Een lange naam in een smalle kamer over twee regels, zoals in het poppenhuis (22 november 2026: Slaapkamer Matts en
         * Mylan vielen op Thuis weg).
         */
        const spatie = naam.lastIndexOf(' ');
        const tweeRegels = spatie > 0 && breedte < naam.length * 6.8;
        const naamRegels = tweeRegels ? [naam.slice(0, spatie), naam.slice(spatie + 1)] : [naam];
        let regels = naamRegels.map((n2, i) => `<text y="${i * 13}" ${midden} font-size="12" font-weight="700" fill="${info ? '#dfe6ec' : '#aebac6'}">${esc(n2)}</text>`).join('');
        let h = 15 + (naamRegels.length - 1) * 13;
        if (info?.temp) {
          regels += `<text y="${h + 4}" ${midden} font-size="18" font-weight="800" fill="#ffffff">${esc(info.temp)}</text>`;
          h += 20;
        }
        if (info?.zin) {
          regels += `<text y="${h - 2}" ${midden} font-size="11" font-weight="700" fill="${TOON[info.toon] ?? '#b8c4cf'}">${esc(info.zin)}</text>`;
          h += 13;
        }
        const w = Math.max(...naamRegels.map((n2) => n2.length * 6.8), (info?.zin ?? '').length * 6, (info?.temp ?? '').length * 10.5, 44);
        const halo = 'paint-order="stroke" stroke="#0d1a30" stroke-width="3" stroke-linejoin="round"';
        // Past het label nergens, dan op één regel: de naam en de temperatuur (zoals in het poppenhuis).
        const wk = (naam.length + (info?.temp ?? '').length + 1) * 7;
        const kort = info?.temp ? { x: p[0] - wk / 2, y: p[1] - 12, b: wk, h: 15, s: `<g transform="translate(${p[0].toFixed(1)} ${(p[1] + 2).toFixed(1)})" ${halo}><text y="0" ${midden} font-size="12.5" font-weight="700" fill="#dfe6ec">${esc(naam)} <tspan font-weight="800" fill="${TOON[info.toon] && info.toon !== 'goed' ? TOON[info.toon] : '#ffffff'}">${esc(info.temp)}</tspan></text></g>` }  : { x: p[0] - (naam.length * 5.6) / 2, y: p[1] - 10, b: naam.length * 5.6, h: 12, prio: 2, verder: true, s: `<g transform="translate(${p[0].toFixed(1)} ${(p[1] + 2).toFixed(1)})" ${halo}><text y="0" ${midden} font-size="10.5" font-weight="700" fill="#aebac6">${esc(naam)}</text></g>` };
        // Een tweede plek, als de eerste bezet is: het midden van de kamer, iets hoger (22 november 2026: Slaapkamer Mylan viel weg).
        const p2 = P(mx, my, z0 + 1.3);
        const ook = { x: p2[0] - w / 2, y: p2[1] - 12, s: `<g transform="translate(${p2[0].toFixed(1)} ${(p2[1] + 2).toFixed(1)})" ${halo}>${regels}</g>` };
        labels.push({ x: p[0] - w / 2, y: p[1] - 12, b: w, h, prio: info?.temp ? 3 : info ? 2 : 1, s: `<g transform="translate(${p[0].toFixed(1)} ${(p[1] + 2).toFixed(1)})" ${halo}>${regels}</g>`, kader: true, kort, ook, kamer: kamerVan(r) });
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
      /*
       * Onder de ramen van de etage erboven (22 november 2026): de 3D-kaart gaf bij Ricardo 3,6 m, terwijl de ramen van de
       * 1e op 0,9 m boven die vloer beginnen; het dakje liep door de ramen. Hooguit 0,75 m boven die vloer, en de lage kant
       * blijft eronder zodat het dakje schuin blijft.
       */
      const hoog = Math.min(a.hoog, (lagen[1]?.z0 ?? bgTop) + 0.75);
      const laag = Math.min(a.laag, hoog - 0.35);
      const onder = Math.min(bgTop, laag);
      const dak = [[u0, v0, laag], [u1, v0, laag], [u1, v1, hoog], [u0, v1, hoog]];
      const delen = [
        { p: [[u0, v0, onder], [u1, v0, onder], [u1, v0, laag], [u0, v0, laag]], vul: '#cbd4dd', n: [0, a.kant === 'voor' ? -1 : 1] },
        { p: [[u0, v0, onder], [u0, v0, laag], [u0, v1, hoog], [u0, v1, onder]], vul: '#aab6c4', n: [-1, 0] },
        { p: [[u1, v0, onder], [u1, v0, laag], [u1, v1, hoog], [u1, v1, onder]], vul: '#aab6c4', n: [1, 0] },
      ].filter((x) => naarKijker(...x.n));
      for (const x of delen.sort((p1, p2) => dp(p2.p) - dp(p1.p))) s += `<path d="${vlak(x.p)}" fill="${x.vul}" stroke="rgb(13 26 48 / 0.45)" stroke-width="0.8" stroke-linejoin="round"/>`;
      s += `<path d="${vlak(dak)}" fill="#55657f" stroke="rgb(13 26 48 / 0.5)" stroke-width="0.8" stroke-linejoin="round"/>`;
      // Een paar lijnen over het dakje, langs de helling.
      for (let f = 0.12; f < 0.95; f += 0.12) s += `<path d="M${pt(u0 + (u1 - u0) * f, v0, laag)}L${pt(u0 + (u1 - u0) * f, v1, hoog)}" stroke="#7e8da6" stroke-opacity="0.5" stroke-width="0.7"/>`;
    }
    // Het dak aan de kant van de kijker: glas met de lijnen erop.
    let panelenMidden = null;
    for (const d of metDak ? daken : []) {
      for (const v of d.vlakken) {
        if (!naarKijker(...v.n)) continue;
        // Een afdak of uitbouw voor het huis is dicht: daar kijk je niet in (19 november 2026, het afdak van Ricardo).
        if (d.b.soort !== 'hoofdhuis' && v.dak) {
          s += `<path d="${vlak(v.p)}" fill="#3b4a66" stroke="rgb(13 26 48 / 0.6)" stroke-width="0.8" stroke-linejoin="round"/>`;
          continue;
        }
        s += `<path d="${vlak(v.p)}" fill="rgb(191 230 255 / 0.05)" stroke="#9fd8ff" stroke-opacity="0.4" stroke-width="1.1" stroke-dasharray="5 4" stroke-linejoin="round"/>`;
        // Sneeuw op het dak (22 november 2026, zoals in het poppenhuis).
        if (o.weer === 'sneeuw' && v.dak) s += `<path d="${vlak(v.p.map(([x, y, zz]) => [x, y, zz + 0.04]))}" fill="#eef3f8" fill-opacity="0.85"/>`;
        // Het midden van de panelen: daar begint de stroom van de zon, en daar hangt het label.
        if (d === hoofdDak && v.dak && paneelVan(v) && !panelenMidden) panelenMidden = [0, 1, 2].map((j) => v.p.reduce((n, q) => n + q[j], 0) / v.p.length);
        if (d === hoofdDak && v.dak && paneelVan(v)) {
          s += `<g opacity="0.55">${paneelVeld(d, v)}</g>`;
          if (o.tik && o.panelenTik) tikLaag.unshift(`<path d="${vlak(v.p)}" class="sc-tik" data-tik="${esc(o.panelenTik)}" fill="transparent" role="button" tabindex="0"${o.panelenTikLabel ? ` aria-label="${esc(o.panelenTikLabel)}"` : ''} style="cursor: pointer"/>`);
        }
      }
      for (const kp of d.kapellen) if (naarKijker(...kp.voor.n)) s += kapel(kp);
      // De nok als dunne lijn.
      s += `<path d="M${pt(...d.Q(d.n0, d.cr, d.nok))}L${pt(...d.Q(d.n1, d.cr, d.nok))}" stroke="#cfe6ff" stroke-opacity="0.6" stroke-width="1.4"/>`;
    }

    // De stroom: een lijn over de grond, onder wat ervoor staat (de auto), met zijn label (zoals "0,4 kW van het net" op Thuis).
    const STROOM = { violet: '#a78bfa', zon: '#f7b548', mint: '#6ee7b7' };
    /*
     * 22 november 2026 (zoals in het poppenhuis): `'panelen'` in een pad begint bij het midden van de panelen en loopt langs
     * de voorgevel naar beneden; een lijn en zijn label zijn te tikken (`tik`, de energiekaart); een label kan bij het einde
     * van de lijn staan (`bij: 'eind'`, terugleveren bij de aansluitkast) en een eigen kleur hebben (`labelToon`).
     */
    const padVan = (pad) => pad.flatMap((q) => {
      if (q !== 'panelen') return [q];
      if (!panelenMidden) return [];
      const [mx] = panelenMidden;
      const gevel = Math.max(0.3, Math.min(dakZ(mx, Y0 + 0.02), lagen.at(-1)?.top ?? 5) - 0.05);
      return [panelenMidden, [mx, Y0 - 0.05, gevel], [mx, Y0 - 0.05, 0.05]];
    });
    const tikData = (tik, label) => (o.tik && tik ? ` class="sc-tik" data-tik="${esc(tik)}" role="button" tabindex="0"${label ? ` aria-label="${esc(label)}"` : ''} style="cursor: pointer"` : '');
    for (const st2 of o.stroom ?? []) {
      const pp = padVan(st2.pad ?? []).map((q) => P(...q));
      if (pp.length < 2) continue;
      const kl = STROOM[st2.toon] ?? STROOM.violet;
      const d = `M${pp.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join('L')}`;
      s += `<path d="${d}" stroke="${kl}" stroke-opacity="0.25" stroke-width="5" fill="none" stroke-linejoin="round"/>`;
      s += `<path d="${d}" stroke="${kl}" stroke-width="2.2" fill="none" stroke-dasharray="2 7" stroke-linecap="round" stroke-linejoin="round" class="sc-stroom"/>`;
      if (o.tik && st2.tik) tikLaag.push(`<path d="${d}"${tikData(st2.tik, st2.tikLabel)} fill="none" stroke="transparent" stroke-width="22" stroke-linejoin="round" stroke-linecap="round"/>`);
      if (st2.label && !o.stil) {
        const [lx, ly] = st2.bij === 'eind' ? pp.at(-1) : pp[0];
        const lk = STROOM[st2.labelToon] ?? kl;
        const w = st2.label.length * 7.6 + 28;
        const [px, py] = [lx + (st2.dx ?? 10), ly + (st2.dy ?? 26)];
        labels.push({ x: px, y: py - 14, b: w, h: 30, prio: 4, s: `<g transform="translate(${px.toFixed(1)} ${py.toFixed(1)})"${tikData(st2.tik, st2.tikLabel)}><rect x="0" y="-15" width="${w.toFixed(0)}" height="30" rx="12" fill="#0d1a30" stroke="${lk}" stroke-opacity="0.55"/><text x="${(w / 2).toFixed(1)}" y="5.5" text-anchor="middle" ${FONT} font-size="14.5" font-weight="700" fill="${lk === STROOM.violet ? '#eef3f7' : lk}">${esc(st2.label)}</text></g>` });
      }
    }
    // Het label van de panelen (zoals in het poppenhuis): hoeveel ze nu geven, met een lijntje naar het dak; te tikken.
    if (o.dakLabel && panelenMidden && (!o.stil || o.metDakLabel)) {
      const dl = o.dakLabel;
      const [ax, ay] = P(...panelenMidden);
      const regels = [...(dl.regels ?? [])];
      // Op de telefoon (`o.metDakLabel`) alleen het getal, zoals het poppenhuis daar doet.
      if (o.metDakLabel && o.stil) regels.length = 0;
      const w = Math.max(dl.titel.length * 15 + 24, ...regels.map((r) => r.length * 7 + 24));
      const h = 40 + regels.length * 18;
      // Met de zonneboog op Thuis rechts naast het dak, onder de boog (22 november 2026); anders erboven.
      const [px, py] = o.boogVrij && zb ? [Math.max(ax + 40, P(X1, Y0, 0)[0] + 8), ay + (o.stil ? 10 : 95)] : [ax + (dl.dx ?? 60), ay + (dl.dy ?? -80)];
      const kl = STROOM[dl.toon] ?? STROOM.zon;
      labels.push({ x: px, y: py, b: w, h, prio: 5, s: `<path d="M${ax.toFixed(1)} ${ay.toFixed(1)}L${(px + 12).toFixed(1)} ${(py + h).toFixed(1)}" stroke="${kl}" stroke-opacity="0.7" stroke-width="1.2"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="3.5" fill="${kl}"/><g transform="translate(${px.toFixed(1)} ${py.toFixed(1)})"${tikData(dl.tik, dl.tikLabel)}><rect width="${w.toFixed(0)}" height="${h}" rx="12" fill="#0d1a30" fill-opacity="0.92" stroke="${kl}" stroke-opacity="0.5"/><text x="12" y="30" ${FONT} font-size="24" font-weight="800" fill="${kl}">${esc(dl.titel)}</text>${regels.map((r, i) => `<text x="12" y="${50 + i * 18}" ${FONT} font-size="13" font-weight="${i === 0 ? 700 : 500}" fill="${i === 0 ? kl : '#cfd8e1'}">${esc(r)}</text>`).join('')}</g>` });
    }
    s += tekenBuiten(voorHuis);
    // apparaten: in kit/huis-maat-apparaten.js (opgesplitst op 22 november 2026). Wat het deel van de tekenaar deelt:
    const capparaten = {};
    Object.defineProperties(capparaten, {
      aan: { get: () => aan },
      P: { get: () => P },
      k: { get: () => k },
      sp: { get: () => sp },
      o: { get: () => o },
      zetModel: { get: () => zetModel },
      vlak: { get: () => vlak },
      labels: { get: () => labels },
      FONT: { get: () => FONT },
      esc: { get: () => esc },
      prisma: { get: () => prisma },
    });
    const apparatenDeel = global.huisMaatApparaten(capparaten);

    const { buitenApparaat } = apparatenDeel;
    // Wat achter het huis hangt (het zonnescherm aan de achtergevel) komt achter het huis, de rest ervoor (20 november 2026).
    const achterKant = (a) => !dichterbij(klein(a.x ?? a.punten?.[0]?.[0] ?? cx, a.y ?? a.punten?.[0]?.[1] ?? cy), huisDoos);
    const achterStuk = (buiten.apparaten ?? []).filter(achterKant).map(buitenApparaat).join('');
    s = s.replace(ACHTER, () => achterStuk);
    s += (buiten.apparaten ?? []).filter((a) => !achterKant(a)).map(buitenApparaat).join('');
    s += zonneboog(false);
    s += feestLaag() + weerLaag();
    s += tikLaag.join('');
        // De namen bovenop. Wat botst schuift een stukje op of neer; past het nergens, dan valt het weg. De kamers met een temperatuur gaan voor.
    labels.sort((a, b) => b.prio - a.prio);
    const gezet = [];
    // Eerst op en neer, dan ook opzij (20 november 2026: op een huis met drie etages vielen kamers met een temperatuur weg).
    const plekken = [[0, 0], [0, -14], [0, 14], [0, -26], [0, 26], [-36, 0], [36, 0], [0, -40], [0, 40], [-36, -20], [36, -20], [-36, 20], [36, 20]];
    // `verder`: een kleine naam zonder temperatuur mag als laatste ook wat verder opzij (22 november 2026: Slaapkamer Mylan).
    const zet = (l, verder = false) => {
      for (const [dx, dy] of verder ? [...plekken, [64, 0], [-64, 0], [64, -16], [-64, -16], [0, -54], [0, 54]] : l.prio >= 2 ? plekken : plekken.slice(0, 5)) {
        const r = { x0: l.x - 4 + dx, y0: l.y - 6 + dy, x1: l.x + l.b + 4 + dx, y1: l.y + l.h + dy };
        if (r.y0 < 2 || r.y1 > Hpx - 2 || r.x0 < 2 || r.x1 > B - 2 || gezet.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) continue;
        gezet.push(r);
        // Een naam van een kamer is ook te tikken.
        const inh = o.tik && l.kamer && kamerData(l.kamer) ? `<g class="sc-kamer"${kamerData(l.kamer)} style="cursor: pointer">${l.s}</g>` : l.s;
        s += dx || dy ? `<g transform="translate(${dx} ${dy.toFixed(1)})">${inh}</g>` : inh;
        return true;
      }
      return false;
    };
    for (const l of labels) if (!zet(l) && !(l.ook && zet({ ...l, ...l.ook })) && l.kort) zet({ ...l, ...l.kort }, l.kort.verder);
    // Dichtbij: de randen van het beeld zacht laten weglopen.
    if (alleenHuis) s = `<defs><linearGradient id="hm-rand-v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.1" stop-color="#fff"/><stop offset="0.9" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="hm-rand"><rect width="${B}" height="${Hpx}" fill="url(#hm-rand-v)"/></mask></defs><g mask="url(#hm-rand)">${s}</g>`;
    return { svg: s, P, k, overgeslagen };
  }

  global.huisMaat = { teken, dakVan };
})(typeof window !== 'undefined' ? window : globalThis);
