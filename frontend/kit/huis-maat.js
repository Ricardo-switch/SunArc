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
 *   panelen   { aantal, kant: 0 | 1 }: panelen op het dak van het hoofdhuis
 *   rand      ruimte om het huis, in pixels
 *   lucht     meters tussen de etages: uit elkaar geschoven, zodat je in elke etage kijkt (0: op elkaar)
 *   stil      geen namen in de tekening (de telefoon: daar staan de kamers eronder)
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
    const eiland = [[X0 - g, Y0 - g], [X1 + g, Y0 - g], [X1 + g, Y1 + g], [X0 - g, Y1 + g]];
    const blokken = bron.blokken ?? [];
    const daken = blokken.filter((b) => /zadel|schild|lessenaar/.test(b.dak ?? '')).map((b) => {
      const d = dakVan(b, { goot, nok });
      for (const v of d.vlakken) v.p = v.p.map(([x, y, zz]) => [x, y, zz + dakOp]);
      d.nok += dakOp;
      return { b, ...d };
    });
    // Passend maken: alles wat er staat in beeld, met ruimte eromheen.
    const punten = [...eiland.map(([x, y]) => [x, y, -0.7]), ...eiland.map(([x, y]) => [x, y, 0]), ...lagen.flatMap((l) => [[X0, Y0, l.top], [X1, Y0, l.top], [X1, Y1, l.top], [X0, Y1, l.top]]), ...daken.flatMap((d) => d.vlakken.flatMap((v) => v.p))];
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

    // Het eiland: de zijkanten naar de kijker, dan het gras.
    const zijden = [];
    for (let i = 0; i < 4; i++) {
      const [a, b] = [eiland[i], eiland[(i + 1) % 4]];
      const n = [b[1] - a[1], -(b[0] - a[0])];
      if (!naarKijker(n[0], n[1])) continue;
      zijden.push(`<path d="${vlak([[...a, 0], [...b, 0], [...b, -0.7], [...a, -0.7]])}" fill="${i % 2 ? '#1a2a24' : '#14211d'}"/>`);
    }
    s += zijden.join('');
    s += `<path d="${vlak(eiland.map(([x, y]) => [x, y, 0]))}" fill="#22392f" stroke="rgb(110 231 183 / 0.18)"/>`;
    // Een pad van de straat naar de voordeur ligt er niet: dat weet de tekening niet.

    // Het dak aan de achterkant: eerst, zodat alles ervoor er overheen valt.
    const panelen = o.panelen;
    const hoofdDak = daken.find((d) => d.b.soort === 'hoofdhuis') ?? daken[0];
    const dakVlak = (d, v) => {
      const kijker = naarKijker(...v.n);
      if (kijker) return '';
      const vul = v.gevel ? (Math.abs(v.n[0]) > 0.5 ? '#33435e' : '#2b3a53') : v.kant === 0 ? '#3b4a66' : '#34425c';
      let x = `<path d="${vlak(v.p)}" fill="${vul}" stroke="rgb(13 26 48 / 0.6)" stroke-width="0.8" stroke-linejoin="round"/>`;
      if (panelen?.aantal && d === hoofdDak && v.dak && v.kant === (panelen.kant ?? v.kant)) x += paneelVeld(d, v);
      return x;
    };
    /** Panelen in rijen op een dakvlak, met wat rand. */
    const paneelVeld = (d, v) => {
      const [A, Bp, C, D] = v.p;
      const lerp = (p, q, f) => p.map((n, i) => n + (q[i] - n) * f);
      // A-B langs de goot, D-C langs de nok.
      const rijen = Math.max(1, Math.min(3, Math.round(Math.hypot(D[0] - A[0], D[1] - A[1], D[2] - A[2]) / 1.75)));
      const perRij = Math.ceil(panelen.aantal / rijen);
      let x = '';
      let n = 0;
      for (let r = 0; r < rijen; r++) {
        for (let i = 0; i < perRij && n < panelen.aantal; i++, n++) {
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

    const labels = [];
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
            stukken.push({ d: voor ? d - 50 : d, s: muur(z0, top, vul, `stroke="${vul}" stroke-width="0.6"`) });
          }
        }
      }
      // De apparaten van deze etage: een stip op ooghoogte met een steeltje.
      const was = st.etage;
      st.etage = laag.e.id;
      const punten = t.apparaatPunten();
      st.etage = was;
      for (const q of punten) {
        const [x, y] = [m(q.x), m(q.y)];
        const a = P(x, y, z0);
        const b = P(x, y, z0 + 1.35);
        const kleur = APP_KLEUR[q.a.soort] ?? '#eef3f7';
        const draait = aan.has(q.a.id);
        const licht = draait && o.avond && q.a.soort === 'licht';
        let x2 = '';
        if (licht) x2 += `<ellipse cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" rx="${(2.2 * k).toFixed(1)}" ry="${(2.2 * k * sp).toFixed(1)}" fill="#f7b548" fill-opacity="0.22"/>`;
        x2 += `<path d="M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}" stroke="rgb(255 255 255 / 0.3)" stroke-width="1.1"/>`;
        if (draait) x2 += `<circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="13" fill="url(#hm-gloed)" opacity="0.55" style="mix-blend-mode:screen"/><circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="9" fill="${kleur}" fill-opacity="0.35"/>`;
        x2 += `<circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${draait ? 5 : 4}" fill="${draait ? kleur : '#0d1a30'}" stroke="${kleur}" stroke-width="${draait ? 1.5 : 1.8}"/>`;
        stukken.push({ d: diep(x, y) - 0.1, s: x2 });
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
        if (panelen?.aantal && d === hoofdDak && v.dak && v.kant === panelen.kant) s += `<g opacity="0.55">${paneelVeld(d, v)}</g>`;
      }
      // De nok als dunne lijn.
      s += `<path d="M${pt(...d.Q(d.n0, d.cr, d.nok))}L${pt(...d.Q(d.n1, d.cr, d.nok))}" stroke="#cfe6ff" stroke-opacity="0.6" stroke-width="1.4"/>`;
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
