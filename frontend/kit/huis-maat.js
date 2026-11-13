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
 *             gebouwen [{ x, y, b, d, h, dak?, naam?, buur? }] (een tuinhuis; buur: het huis ernaast, als schim),
 *             auto { x, y, b, d, kleur, laadt? }, apparaten [{ id, soort, x, y, z, naam? }]
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
    return { vlakken, nok, zl, Q, a0, a1, c0, c1, cr, g0, g1, n0, n1 };
  }

  function teken(t, B, Hpx, o = {}) {
    const K = global.huistekenen;
    const { MARGE, CEL, BUITEN, randen, isMuur, maten, omtrek, TINT, SOORT_TINT, APP_KLEUR } = K;
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
    const [E0, E1, F0, F1] = [Math.min(...bx) - (o.buiten ? 1.2 : g), Math.max(...bx) + (o.buiten ? 1.2 : g), Math.min(...by) - (o.buiten ? 1.2 : g), Math.max(...by) + (o.buiten ? 1.2 : g)];
    const eiland = [[E0, F0], [E1, F0], [E1, F1], [E0, F1]];
    const blokken = bron.blokken ?? [];
    const daken = blokken.filter((b) => /zadel|schild|lessenaar/.test(b.dak ?? '')).map((b) => {
      const d = dakVan(b, { goot, nok });
      for (const v of d.vlakken) v.p = v.p.map(([x, y, zz]) => [x, y, zz + dakOp]);
      d.nok += dakOp;
      return { b, ...d };
    });
    // Passend maken: alles wat er staat in beeld, met ruimte eromheen.
    // Passend: om alles wat er staat, of (passend: 'huis') alleen om het huis, zodat het groot in beeld staat en de tuin eromheen wegloopt.
    const alleenHuis = o.passend === 'huis';
    const punten = [...(alleenHuis ? [] : eiland.map(([x, y]) => [x, y, -0.7])), ...(alleenHuis ? [[X0 - 1, Y0 - 1, 0], [X1 + 1, Y0 - 1, 0], [X1 + 1, Y1 + 1, 0], [X0 - 1, Y1 + 1, 0]] : eiland.map(([x, y]) => [x, y, 0])), ...lagen.flatMap((l) => [[X0, Y0, l.top], [X1, Y0, l.top], [X1, Y1, l.top], [X0, Y1, l.top]]), ...daken.flatMap((d) => d.vlakken.flatMap((v) => v.p))];
    if (!alleenHuis) for (const q of buiten.gebouwen ?? []) if (!q.buur) punten.push([q.x, q.y, q.h + 1.5], [q.x + q.b, q.y + q.d, 0]);
    const kp = punten.map((p) => kaal(...p));
    const rand = o.rand ?? 18;
    const [minX, maxX, minY, maxY] = [Math.min(...kp.map((p) => p[0])), Math.max(...kp.map((p) => p[0])), Math.min(...kp.map((p) => p[1])), Math.max(...kp.map((p) => p[1]))];
    const k = Math.min((B - 2 * rand) / (maxX - minX), (Hpx - 2 * rand) / (maxY - minY));
    const ox = B / 2 - ((minX + maxX) / 2) * k;
    const oy = Hpx / 2 - ((minY + maxY) / 2) * k;
    const P = (x, y, zz) => {
      const [a, b] = kaal(x, y, zz);
      return [ox + a * k, oy + b * k];
    };
    const pt = (x, y, zz) => P(x, y, zz).map((n) => n.toFixed(1)).join(' ');
    const vlak = (pp) => `M${pp.map((p) => pt(...p)).join('L')}Z`;
    const dp = (pp) => pp.reduce((n, q) => n + diep(q[0], q[1]), 0) / pp.length;

    let s = `<defs><radialGradient id="hm-gloed"><stop offset="0" stop-color="#fff" stop-opacity="0.9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><linearGradient id="hm-glas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe6ff" stop-opacity="0.10"/><stop offset="1" stop-color="#bfe6ff" stop-opacity="0.03"/></linearGradient></defs>`;

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
    const KAST = ['#eef3f7', '#dfe7ee', '#c3ced8'];
    const WIT = ['#e9eef2', '#d7dee5', '#b9c3cd'];
    // Het eiland    // Het eiland: de zijkanten naar de kijker, dan het gras.
    const zijden = [];
    for (let i = 0; i < 4; i++) {
      const [a, b] = [eiland[i], eiland[(i + 1) % 4]];
      const n = [b[1] - a[1], -(b[0] - a[0])];
      if (!naarKijker(n[0], n[1])) continue;
      zijden.push(`<path d="${vlak([[...a, 0], [...b, 0], [...b, -0.7], [...a, -0.7]])}" fill="${i % 2 ? '#1a2a24' : '#14211d'}"/>`);
    }
    s += zijden.join('');
    s += `<path d="${vlak(eiland.map(([x, y]) => [x, y, 0]))}" fill="#22392f" stroke="rgb(110 231 183 / 0.18)"/>`;
    // Buiten: eerst de grond (terras, oprit, border), dan wat achter het huis staat; wat ervoor staat komt na het huis.
    const GROND = { terras: ['#5b5246', '#8a7a64'], oprit: ['#3c4655', '#5c6878'], pad: ['#4a5260', '#6b7686'], border: ['#2e5a3c', '#4f8a5f'] };
    for (const v of buiten.vlakken ?? []) {
      const [vul, rand] = GROND[v.soort] ?? GROND.pad;
      s += `<path d="${vlak(v.p.map(([x, y]) => [x, y, 0.02]))}" fill="${vul}" stroke="${rand}" stroke-width="0.8"/>`;
      if (v.soort === 'border') {
        // Struiken: een paar bolletjes langs de rand.
        const [a, b] = [v.p[0], v.p[2]];
        for (let i = 0; i < 6; i++) {
          const f = (i + 0.5) / 6;
          const q = P(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 0.35);
          s += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${(0.45 * k).toFixed(1)}" fill="#3f7a52" stroke="#5fa577" stroke-opacity="0.5"/>`;
        }
      }
    }
    const midHuis = diep(cx, cy);
    const voorHuis = [];
    const achterHuis = [];
    for (const q of buiten.gebouwen ?? []) (diep(q.x + q.b / 2, q.y + q.d / 2) < midHuis - 2 ? voorHuis : achterHuis).push({ soort: 'gebouw', q });
    if (buiten.auto) (diep(buiten.auto.x + buiten.auto.b / 2, buiten.auto.y + buiten.auto.d / 2) < midHuis ? voorHuis : achterHuis).push({ soort: 'auto', q: buiten.auto });
    /** Een doos: de vier wanden van achter naar voren, dan de bovenkant (plat of een zadeldak). */
    const doos = (q, kleur) => {
      const { x, y, b, d, h } = q;
      const hoeken = [[x, y], [x + b, y], [x + b, y + d], [x, y + d]];
      const wanden = [0, 1, 2, 3].map((i) => {
        const [a, c] = [hoeken[i], hoeken[(i + 1) % 4]];
        return { p: [[...a, 0], [...c, 0], [...c, h], [...a, h]], n: [c[1] - a[1], -(c[0] - a[0])] };
      });
      let x2 = '';
      for (const w of wanden.sort((p1, p2) => dp(p2.p) - dp(p1.p))) {
        if (!naarKijker(...w.n) && !q.buur) continue;
        x2 += `<path d="${vlak(w.p)}" fill="${kleur[Math.abs(w.n[0]) > Math.abs(w.n[1]) ? 0 : 1]}" ${q.buur ? 'stroke="rgb(255 255 255 / 0.18)" stroke-dasharray="4 4"' : 'stroke="rgb(13 26 48 / 0.5)" stroke-width="0.7"'} stroke-linejoin="round"/>`;
      }
      if (/zadel/.test(q.dak ?? '')) {
        const dk = dakVan({ u: x, v: y, b, d, dak: 'zadeldak', nok: h + Math.min(b, d) * 0.45, goot0: h, goot1: h }, { goot: h, nok: h + 1 });
        for (const v of dk.vlakken.sort((p1, p2) => dp(p2.p) - dp(p1.p))) x2 += `<path d="${vlak(v.p)}" fill="${v.gevel ? kleur[0] : naarKijker(...v.n) ? kleur[2] : kleur[3]}" stroke="rgb(13 26 48 / 0.5)" stroke-width="0.7" stroke-linejoin="round"/>`;
      } else x2 += `<path d="${vlak(hoeken.map(([a, c]) => [a, c, h]))}" fill="${kleur[2]}" ${q.buur ? 'stroke="rgb(255 255 255 / 0.2)" stroke-dasharray="4 4"' : 'stroke="rgb(13 26 48 / 0.5)"'}/>`;
      if (q.naam && !o.stil) {
        const p = P(x + b / 2, y + d / 2, (/zadel/.test(q.dak ?? '') ? h + Math.min(b, d) * 0.45 : h) + 0.4);
        labels.push({ x: p[0] - q.naam.length * 3.6, y: p[1] - 10, b: q.naam.length * 7.2, h: 16, prio: 1, s: `<text x="${p[0].toFixed(1)}" y="${(p[1] + 4).toFixed(1)}" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="#dfe6ec" paint-order="stroke" stroke="#0d1a30" stroke-width="3.5" stroke-linejoin="round">${esc(q.naam)}</text>` });
      }
      return x2;
    };
    /** De auto: een lage bak met een cabine erop, en een kabel als hij laadt. */
    const auto = (q) => {
      const kleur = q.kleur ?? '#7f97b0';
      const donker = '#4d5f75';
      let x2 = doos({ x: q.x, y: q.y, b: q.b, d: q.d, h: 0.75 }, [donker, '#62758c', kleur, kleur]);
      const lang = q.d > q.b;
      const c = lang ? { x: q.x + 0.12, y: q.y + q.d * 0.3, b: q.b - 0.24, d: q.d * 0.42, h: 1.35 } : { x: q.x + q.b * 0.3, y: q.y + 0.12, b: q.b * 0.42, d: q.d - 0.24, h: 1.35 };
      x2 += doos({ ...c, h: 1.35 }, ['#26364d', '#2f425c', '#9fb3c8', '#9fb3c8']).replace(/<path d="M([^"]*)" fill="#9fb3c8"/, (m0) => m0);
      if (q.laadt) {
        const p = P(q.x + q.b / 2, q.y + q.d / 2, 1.6);
        x2 += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="14" fill="url(#hm-gloed)" opacity="0.5"/><circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="9" fill="#0d1a30" stroke="#6ee7b7" stroke-width="1.6"/><path d="M${(p[0] + 1).toFixed(1)} ${(p[1] - 5).toFixed(1)}l-4 6h4l-1 5 4-6h-4z" fill="#6ee7b7"/>`;
      }
      return x2;
    };
    const tekenBuiten = (lijst) => lijst.sort((a, b) => diep(b.q.x + b.q.b / 2, b.q.y + b.q.d / 2) - diep(a.q.x + a.q.b / 2, a.q.y + a.q.d / 2)).map((x) => (x.soort === 'auto' ? auto(x.q) : x.q.buur ? doos(x.q, ['rgb(255 255 255 / 0.05)', 'rgb(255 255 255 / 0.07)', 'rgb(255 255 255 / 0.06)', 'rgb(255 255 255 / 0.06)']) : doos(x.q, ['#8a7660', '#a08a70', '#5a4a3c', '#4a3d31']))).join('');
    s += tekenBuiten(achterHuis);

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
    for (const d of daken) for (const v of [...d.vlakken].sort((a, b) => dp(b.p) - dp(a.p))) s += dakVlak(d, v);

    const kamerVan = (r) => (r?.kamer ? r.kamer : null);
    lagen.forEach((laag, li) => {
      const { v, z0, top } = laag;
      const ruimteSoort = (id) => t.soortVan(v.ruimtes[id]) ?? '';
      // De vloer per ruimte, op zijn kleur; wat aan staat of op temperatuur is gloeit zacht.
      const per = {};
      for (const r of rechthoeken(v, BUITEN)) (per[r.id] ??= []).push(vlak([[m(r.x0), m(r.y0), z0], [m(r.x1), m(r.y0), z0], [m(r.x1), m(r.y1), z0], [m(r.x0), m(r.y1), z0]]));
      for (const [id, paden] of Object.entries(per)) {
        const r = v.ruimtes[id];
        const naam = t.naamVan(r);
        const tint = TINT[SOORT_TINT[t.soortVan(r)] ?? (r?.kamer ? 'woon' : naam ? 'hal' : 'leeg')];
        const info = kamerInfo[kamerVan(r)];
        const gloed = info?.toon && info.toon !== 'goed' ? TOON[info.toon] : null;
        s += `<path d="${paden.join('')}" fill="#152238"/><path d="${paden.join('')}" fill="rgb(${tint} / ${naam ? 0.2 : 0.06})"/>`;
        if (gloed) s += `<path d="${paden.join('')}" fill="${gloed}" fill-opacity="0.16"/>`;
      }
      // De zones: een stippellijn over de vloer, met de naam van elke kant klein op de vloer.
      const was0 = st.etage;
      st.etage = laag.e.id;
      const zones = t.zones();
      st.etage = was0;
      const mz = maten(v);
      for (const zz of zones) {
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
        for (let a = run.van; a < run.tot; a += 20) {
          const b = Math.min(run.tot, a + 20);
          const [x0, y0, x1, y1] = run.as === 'x' ? [m(run.op), m(a), m(run.op), m(b)] : [m(a), m(run.op), m(b), m(run.op)];
          const d = diep((x0 + x1) / 2, (y0 + y1) / 2);
          const muur = (h0, h1, vul, extra = '') => `<path d="${vlak([[x0, y0, h0], [x1, y1, h0], [x1, y1, h1], [x0, y0, h1]])}" fill="${vul}" ${extra}/>`;
          if (run.soort === 1) {
            // Binnen: halfhoog, met een lichte bovenkant.
            const h = z0 + 1.1;
            stukken.push({ d, s: muur(z0, h, run.as === 'x' ? '#33445f' : '#3c4e6b', 'stroke="rgb(13 26 48 / 0.4)" stroke-width="0.5"') + `<path d="M${pt(x0, y0, h)}L${pt(x1, y1, h)}" stroke="#9fb3c8" stroke-opacity="0.55" stroke-width="1.3"/>` });
          } else if (voor && !dicht) {
            // Naar de straat: een lage borstwering en glas tot het plafond.
            stukken.push({ d: d - 50, s: muur(z0, z0 + 0.35, '#d7e0e9', 'fill-opacity="0.85"') + muur(z0 + 0.35, top, 'url(#hm-glas)') + `<path d="M${pt(x0, y0, top)}L${pt(x1, y1, top)}" stroke="#cfe6ff" stroke-opacity="0.35" stroke-width="1"/>` });
          } else {
            const vul = voor ? (run.as === 'x' ? '#5a6a83' : '#66778f') : run.as === 'x' ? '#26354d' : '#2d3d57';
            let raam = '';
            // Een raam in elk stuk muur van een kamer (niet in een garage), zoals in het poppenhuis.
            if (!dicht && (b - a) * CEL >= 1.4 && top - z0 >= 2) {
              const r0 = 0.35 / ((b - a) * CEL);
              const [rx0, ry0, rx1, ry1] = [x0 + (x1 - x0) * r0, y0 + (y1 - y0) * r0, x1 - (x1 - x0) * r0, y1 - (y1 - y0) * r0];
              const warm = o.avond && lichtIn.has(binnen);
              raam = `<path d="${vlak([[rx0, ry0, z0 + 0.9], [rx1, ry1, z0 + 0.9], [rx1, ry1, Math.min(top - 0.3, z0 + 2.1)], [rx0, ry0, Math.min(top - 0.3, z0 + 2.1)]])}" fill="${warm ? '#f3c77a' : '#8fb4d6'}" fill-opacity="${warm ? 0.55 : 0.28}" stroke="#c9d6e2" stroke-opacity="0.35" stroke-width="0.8"/>`;
            }
            stukken.push({ d: voor ? d - 50 : d, s: muur(z0, top, vul, `stroke="${vul}" stroke-width="0.6"`) + raam });
          }
        }
      }
      // De apparaten van deze etage, zoals in het poppenhuis: een airco hoog aan de muur, een hanglamp,
      // witgoed tegen de muur. Wat je niet ziet in een kamer (meters, rookmelders, thermostaten) blijft weg: dat is rustiger.
      const was = st.etage;
      st.etage = laag.e.id;
      const punten = t.apparaatPunten();
      st.etage = was;
      /** De muur het dichtst bij een punt (in ruitjes), met de kant waar het punt ligt. */
      const wandBij = (cx, cy) => {
        let best = null;
        for (const run of muren) {
          const [langs, dwars] = run.as === 'x' ? [cy, cx] : [cx, cy];
          if (langs < run.van || langs > run.tot) continue;
          const afst = Math.abs(dwars - run.op) - (run.soort === 2 ? 3 : 0);
          if (!best || afst < best.afst) best = { run, afst, kant: dwars >= run.op ? 1 : -1, langs };
        }
        return best;
      };
      /** Een doos tegen een muur: `b` langs de muur, `d` de kamer in, van hoogte za tot zb. */
      const tegenMuur = (w, b, d, za, zb, kl) => {
        const { run, kant } = w;
        const half = b / 2;
        const midden = Math.min(m(run.tot) - half - 0.05, Math.max(m(run.van) + half + 0.05, m(w.langs)));
        const vlakMuur = m(run.op) + kant * 0.03;
        const diepte = vlakMuur + kant * d;
        const [x0, x1, y0, y1] = run.as === 'x' ? [vlakMuur, diepte, midden - half, midden + half] : [midden - half, midden + half, vlakMuur, diepte];
        return { s: doos3(x0, x1, y0, y1, za, zb, kl), x0, x1, y0, y1, midden, diepte, as: run.as, kant };
      };
      for (const q of punten) {
        const soort = q.a.soort;
        const draait = aan.has(q.a.id);
        const [x, y] = [m(q.x), m(q.y)];
        let x2 = '';
        let d = diep(x, y);
        if (soort === 'airco') {
          const w = wandBij(q.x, q.y);
          if (!w) continue;
          const doos = tegenMuur(w, 0.85, 0.22, top - 0.6, top - 0.32, KAST);
          x2 += doos.s;
          d = diep((doos.x0 + doos.x1) / 2, (doos.y0 + doos.y1) / 2);
          if (draait) {
            // Drie zachte stromen lucht naar de kamer, warm of koel.
            const kleur = kamerInfo[t.st.apparaten.find((a) => a.id === q.a.id)?.kamer]?.toon === 'koelt' ? '#6fd3ff' : '#ff7a4d';
            for (let i = -1; i <= 1; i++) {
              const langs = doos.midden + i * 0.25;
              const van = doos.as === 'x' ? [doos.diepte, langs, top - 0.62] : [langs, doos.diepte, top - 0.62];
              const naar = doos.as === 'x' ? [doos.diepte + doos.kant * 0.7, langs, top - 1.05] : [langs, doos.diepte + doos.kant * 0.7, top - 1.05];
              const a = P(...van);
              const b = P(...naar);
              x2 += `<path d="M${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${((a[0] + b[0]) / 2).toFixed(1)} ${((a[1] + b[1]) / 2 + 5).toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}" stroke="${kleur}" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.75"/>`;
            }
          }
        } else if (soort === 'licht') {
          // Een hanglamp: een snoer, een kap, en aan een vlek licht op de vloer.
          const kap = top - 0.42;
          const s0 = P(x, y, top);
          const s1 = P(x, y, kap + 0.1);
          if (draait) {
            const v0 = P(x, y, z0 + 0.01);
            x2 += `<ellipse cx="${v0[0].toFixed(1)}" cy="${v0[1].toFixed(1)}" rx="${(1.3 * k).toFixed(1)}" ry="${(1.3 * k * sp).toFixed(1)}" fill="#ffd9a0" fill-opacity="${o.avond ? 0.26 : 0.1}"/>`;
            const l = P(x - 0.6, y, z0 + 0.05);
            const r = P(x + 0.6, y, z0 + 0.05);
            const b = P(x, y, kap);
            x2 += `<path d="M${b[0].toFixed(1)} ${b[1].toFixed(1)}L${l[0].toFixed(1)} ${l[1].toFixed(1)}L${r[0].toFixed(1)} ${r[1].toFixed(1)}Z" fill="#ffd9a0" fill-opacity="${o.avond ? 0.09 : 0.04}"/>`;
          }
          x2 += `<path d="M${s0[0].toFixed(1)} ${s0[1].toFixed(1)}L${s1[0].toFixed(1)} ${s1[1].toFixed(1)}" stroke="#8090a0" stroke-width="1"/>`;
          x2 += doos3(x - 0.12, x + 0.12, y - 0.12, y + 0.12, kap, kap + 0.1, draait ? ['#ffe2b0', '#e8b878', '#d6a565'] : ['#5c6876', '#4a5664', '#3c4755']);
        } else if (/droger|wasmachine|vaat/.test(soort)) {
          const w = wandBij(q.x, q.y);
          if (!w) continue;
          const doos = tegenMuur(w, 0.6, 0.6, z0, z0 + 0.85, WIT);
          x2 += doos.s;
          d = diep((doos.x0 + doos.x1) / 2, (doos.y0 + doos.y1) / 2);
          if (soort !== 'vaat') {
            const c = doos.as === 'x' ? [doos.diepte + doos.kant * 0.001, doos.midden, z0 + 0.42] : [doos.midden, doos.diepte + doos.kant * 0.001, z0 + 0.42];
            x2 += cirkel(...c, 0.18, doos.as, 'fill="#5e6c7b" stroke="#9aa7b4" stroke-width="1.2"');
            if (draait) x2 += cirkel(...c, 0.12, doos.as, 'fill="none" stroke="#f7b548" stroke-width="1.6" stroke-dasharray="3 3"');
          }
        } else if (soort === 'accu') {
          const w = wandBij(q.x, q.y);
          if (!w) continue;
          const doos = tegenMuur(w, 0.5, 0.2, z0 + 0.05, z0 + 0.95, KAST);
          x2 += doos.s;
          d = diep((doos.x0 + doos.x1) / 2, (doos.y0 + doos.y1) / 2);
        } else continue;
        stukken.push({ d: d - 0.1, s: x2 });
      }
      stukken.sort((a, b) => b.d - a.d);
      s += stukken.map((x) => x.s).join('');

      // Een plat dak op een gebouw dat hier ophoudt: de garage dicht met zijn naam, de rest als glas.
      const erboven = lagen[li + 1];
      for (const b of blokken) {
        if (/zadel|schild|lessenaar/.test(b.dak ?? '') && b.soort === 'hoofdhuis') continue;
        if (!(laag.e.blokken ?? []).some((x) => x.id === b.id)) continue;
        if (erboven && (erboven.e.blokken ?? []).some((x) => x.id === b.id)) continue;
        const r = [[b.u, b.v, top], [b.u + b.b, b.v, top], [b.u + b.b, b.v + b.d, top], [b.u, b.v + b.d, top]];
        if (DICHT.test(b.soort ?? '')) {
          s += `<path d="${vlak(r)}" fill="#3a4862" stroke="rgb(13 26 48 / 0.5)"/>`;
          if (o.stil) continue;
          const p = P(b.u + b.b / 2, b.v + b.d / 2, top);
          labels.push({ x: p[0], y: p[1] + 4, prio: 1, s: `<text x="${p[0].toFixed(1)}" y="${(p[1] + 4).toFixed(1)}" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="#b8c4cf">${esc(b.naam ?? '')}</text>`, b: 60, h: 16 });
        } else s += `<path d="${vlak(r)}" fill="rgb(191 230 255 / 0.05)" stroke="#cfe6ff" stroke-opacity="0.3" stroke-dasharray="4 4"/>`;
      }

      // De namen: voorin de ruimte, net boven de vloer, zodat de etage erboven ze niet afdekt.
      const mm = maten(v);
      for (const [id, r] of Object.entries(v.ruimtes)) {
        const naam = t.naamVan(r);
        const rr = mm[id]?.r;
        if (o.stil || !naam || !rr || DICHT.test(ruimteSoort(id))) continue;
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
        let regels = `<text y="0" ${FONT} font-size="${info ? 13.5 : 12}" font-weight="700" fill="${info ? '#eef3f7' : '#b8c4cf'}">${esc(naam)}</text>`;
        let h = 16;
        if (info?.temp) {
          regels += `<text y="23" ${FONT} font-size="21" font-weight="700" fill="#eef3f7">${esc(info.temp)}</text>`;
          h = 40;
        }
        if (info?.zin) {
          regels += `<text y="${h}" ${FONT} font-size="12.5" font-weight="600" fill="${TOON[info.toon] ?? '#b8c4cf'}">${esc(info.zin)}</text>`;
          h += 16;
        }
        const w = Math.max(naam.length * 7.4, (info?.zin ?? '').length * 6.6, 50);
        labels.push({ x: p[0] - w / 2, y: p[1] - 10, b: w, h, prio: info?.temp ? 3 : info ? 2 : 0, s: `<g transform="translate(${(p[0] - w / 2).toFixed(1)} ${(p[1] + 2).toFixed(1)})" paint-order="stroke" stroke="#0d1a30" stroke-width="3.5" stroke-linejoin="round">${regels}</g>`, kader: true });
      }
      // De vloerrand van de etage erboven: een dunne plaat langs de glazen kant.
      if (erboven) {
        for (const run of randen(erboven.v, isMuur).filter((r) => r.soort === 2)) {
          const mid = Math.floor((run.van + run.tot) / 2);
          const [ia] = run.as === 'x' ? [erboven.v.cel[mid * erboven.v.W + run.op - 1]] : [erboven.v.cel[(run.op - 1) * erboven.v.W + mid]];
          const n = run.as === 'x' ? [ia === BUITEN ? -1 : 1, 0] : [0, ia === BUITEN ? -1 : 1];
          if (!naarKijker(...n)) continue;
          const [x0, y0, x1, y1] = run.as === 'x' ? [m(run.op), m(run.van), m(run.op), m(run.tot)] : [m(run.van), m(run.op), m(run.tot), m(run.op)];
          erboven.rand = (erboven.rand ?? '') + `<path d="${vlak([[x0, y0, top - 0.22], [x1, y1, top - 0.22], [x1, y1, top], [x0, y0, top]])}" fill="#c9d4df" fill-opacity="0.9"/>`;
        }
      }
      if (laag.rand) s += laag.rand;
    });

    // Het dak aan de kant van de kijker: glas met de lijnen erop.
    for (const d of daken) {
      for (const v of d.vlakken) {
        if (!naarKijker(...v.n)) continue;
        s += `<path d="${vlak(v.p)}" fill="rgb(191 230 255 / 0.05)" stroke="#9fd8ff" stroke-opacity="0.4" stroke-width="1.1" stroke-dasharray="5 4" stroke-linejoin="round"/>`;
        if (d === hoofdDak && v.dak && paneelVan(v)) s += `<g opacity="0.55">${paneelVeld(d, v)}</g>`;
      }
      // De nok als dunne lijn.
      s += `<path d="M${pt(...d.Q(d.n0, d.cr, d.nok))}L${pt(...d.Q(d.n1, d.cr, d.nok))}" stroke="#cfe6ff" stroke-opacity="0.6" stroke-width="1.4"/>`;
    }

    s += tekenBuiten(voorHuis);
    for (const a of buiten.apparaten ?? []) {
      const draait = aan.has(a.id);
      if (a.soort === 'licht') {
        const v0 = P(a.x, a.y, 0.02);
        if (draait) s += `<ellipse cx="${v0[0].toFixed(1)}" cy="${v0[1].toFixed(1)}" rx="${(1.1 * k).toFixed(1)}" ry="${(1.1 * k * sp).toFixed(1)}" fill="#ffd9a0" fill-opacity="${o.avond ? 0.28 : 0.08}"/>`;
        const z = a.z ?? 0.6;
        // Laag: een tuinlampje op een paaltje; hoog: een lamp aan de muur.
        if (z < 1.2) {
          const p0 = P(a.x, a.y, 0);
          const p1 = P(a.x, a.y, z);
          s += `<path d="M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}" stroke="#55606e" stroke-width="2"/>`;
        }
        const h = P(a.x, a.y, z);
        if (draait && o.avond) s += `<circle cx="${h[0].toFixed(1)}" cy="${h[1].toFixed(1)}" r="9" fill="url(#hm-gloed)" opacity="0.55"/>`;
        s += `<circle cx="${h[0].toFixed(1)}" cy="${h[1].toFixed(1)}" r="2.6" fill="${draait ? '#ffe2b0' : '#5c6876'}"/>`;
      } else if (a.soort === 'screen' && a.uit) {
        // Een zonnescherm: een doek schuin naar buiten, gestreept als hij uit staat.
        const [ux, uy] = a.uit;
        const b = a.b ?? 3;
        const [lx, ly] = [-uy, ux];
        const z = a.z ?? 2.5;
        const lang = draait ? 1.8 : 0.25;
        const pp = [[a.x - (lx * b) / 2, a.y - (ly * b) / 2, z], [a.x + (lx * b) / 2, a.y + (ly * b) / 2, z], [a.x + (lx * b) / 2 + ux * lang, a.y + (ly * b) / 2 + uy * lang, z - lang * 0.35], [a.x - (lx * b) / 2 + ux * lang, a.y - (ly * b) / 2 + uy * lang, z - lang * 0.35]];
        s += `<path d="${vlak(pp)}" fill="#c9d4df" stroke="#8a98a8" stroke-width="0.8"/>`;
        if (draait) for (let i = 1; i < 6; i += 2) {
          const f0 = i / 6;
          const f1 = (i + 1) / 6;
          const lijn = (f) => [pp[0].map((n, j) => n + (pp[1][j] - n) * f), pp[3].map((n, j) => n + (pp[2][j] - n) * f)];
          const [a0, a1] = lijn(f0);
          const [b0, b1] = lijn(f1);
          s += `<path d="${vlak([a0, b0, b1, a1])}" fill="#ff9a6b" fill-opacity="0.75"/>`;
        }
      }
    }
        // De namen bovenop. Wat botst schuift een stukje op of neer; past het nergens, dan valt het weg. De kamers met een temperatuur gaan voor.
    labels.sort((a, b) => b.prio - a.prio);
    const gezet = [];
    for (const l of labels) {
      for (const dy of [0, -14, 14, -26, 26]) {
        const r = { x0: l.x - 4, y0: l.y - 6 + dy, x1: l.x + l.b + 4, y1: l.y + l.h + dy };
        if (r.y0 < 2 || r.y1 > Hpx - 2 || gezet.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) continue;
        gezet.push(r);
        s += dy ? `<g transform="translate(0 ${dy.toFixed(1)})">${l.s}</g>` : l.s;
        break;
      }
    }
    return { svg: s, P, k };
  }

  global.huisMaat = { teken, dakVan };
})(typeof window !== 'undefined' ? window : globalThis);
