/*
 * SunArc: het huis in 3D op echte maat (plan na besluit 288; schetsen
 * Wand-Huis-Kaart en Wand-Huis-Maat).
 *
 * Twee delen:
 *   bouw(model)          de rekenkern: uit Je huis de gebouwen, etages, daken,
 *                        kamers, muren en apparaten in meters, zonder tekenen
 *   teken(model, opts)   de tekening: opengewerkt, vanaf de straat schuin van
 *                        rechtsvoor, met de voorgevel weg, de binnenmuren laag
 *                        en het dak aan de kant van de kijker doorzichtig
 *
 * Alles staat in de assen van het hoofdhuis: x langs de voorgevel (links naar
 * rechts vanaf de straat), y van voor naar achter, z omhoog, in meters. Een
 * gebouw geeft zijn eigen assen (u, v) en de omzetting `m` naar die van het
 * hoofdhuis (huisvorm.naarHoofd).
 *
 * model: {
 *   gebouwen: [{ id, soort, naam, breed, diep, m: {a,b,c,d,e,f}, dakvorm,
 *                nokAs: 'u' | 'v', goot, nok, gootAchter?, nokOp? }],
 *   etages:   [{ id, naam, van, tot, dak, op: [gebouw-id] }],   van onder naar boven
 *   bomen:    { etage: { gebouw: boom } },                      de vakken (huisvorm.js)
 *   kamers:   { id: { naam, soort, temp?, zin?, toon? } },
 *   apparaten:[{ id, naam, gebouw, u, v, etage, kleur? }]
 * }
 */
(function (global) {
  'use strict';

  const hv = () => global.huisvorm;
  const FONT = 'font-family="Figtree, system-ui, sans-serif"';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /* ================================================================ de rekenkern */

  /**
   * De hoogte van het dak van een gebouw op een punt (u, v) in zijn eigen
   * assen. Een zadel- of schilddak met de nok langs u (evenwijdig aan de
   * voorgevel) loopt van de goot voor naar de nok op `nokOp` en terug naar de
   * goot achter; met de nok langs v van links en rechts naar het midden. Een
   * lessenaar loopt op naar achter (of naar rechts), plat is overal de goot.
   */
  function dakHoogte(g, u, v) {
    const goot = g.goot;
    const achter = g.gootAchter ?? goot;
    const nok = Math.max(goot, achter, g.nok ?? goot);
    if (g.dakvorm === 'plat') return goot;
    const langsU = g.nokAs !== 'v';
    const L = langsU ? g.diep : g.breed;
    const t = langsU ? v : u;
    if (g.dakvorm === 'lessenaar') return goot + ((nok - goot) * t) / L;
    const op = Math.min(L - 0.1, Math.max(0.1, g.nokOp ?? L / 2));
    let z = t <= op ? goot + ((nok - goot) * t) / op : nok - ((nok - achter) * (t - op)) / (L - op);
    if (g.dakvorm === 'schild') {
      // Een schilddak loopt ook aan de korte kanten schuin op, even steil als voor.
      const k = langsU ? u : v;
      const K = langsU ? g.breed : g.diep;
      const steil = (nok - goot) / op;
      z = Math.min(z, goot + steil * Math.min(k, K - k));
    }
    return Math.max(Math.min(goot, achter), z);
  }

  /** De dakvlakken van een gebouw, als veelhoeken in zijn eigen assen (u, v, z), met waar ze naartoe kijken. */
  function dakVlakken(g) {
    const B = g.breed;
    const D = g.diep;
    const goot = g.goot;
    const achter = g.gootAchter ?? goot;
    const nok = Math.max(goot, achter, g.nok ?? goot);
    if (g.dakvorm === 'plat') return [{ kant: 'boven', punten: [[0, 0, goot], [B, 0, goot], [B, D, goot], [0, D, goot]] }];
    const langsU = g.nokAs !== 'v';
    if (g.dakvorm === 'lessenaar') {
      return [{ kant: langsU ? 'voor' : 'links', punten: langsU ? [[0, 0, goot], [B, 0, goot], [B, D, nok], [0, D, nok]] : [[0, 0, goot], [0, D, goot], [B, D, nok], [B, 0, nok]] }];
    }
    const L = langsU ? D : B;
    const op = Math.min(L - 0.1, Math.max(0.1, g.nokOp ?? L / 2));
    // Een schilddak: de nok korter, met aan de korte kanten een driehoek.
    const steil = (nok - goot) / op;
    const kort = g.dakvorm === 'schild' ? Math.min((langsU ? B : D) / 2 - 0.05, (nok - goot) / steil) : 0;
    if (langsU) {
      const n0 = [kort, op, nok];
      const n1 = [B - kort, op, nok];
      const vlakken = [
        { kant: 'voor', punten: [[0, 0, goot], [B, 0, goot], n1, n0] },
        { kant: 'achter', punten: [n0, n1, [B, D, achter], [0, D, achter]] },
      ];
      if (kort > 0) vlakken.push({ kant: 'links', punten: [[0, D, achter], [0, 0, goot], n0] }, { kant: 'rechts', punten: [[B, 0, goot], [B, D, achter], n1] });
      return vlakken;
    }
    const n0 = [op, kort, nok];
    const n1 = [op, D - kort, nok];
    const vlakken = [
      { kant: 'links', punten: [[0, D, goot], [0, 0, goot], n0, n1] },
      { kant: 'rechts', punten: [[B, 0, achter], [B, D, achter], n1, n0] },
    ];
    if (kort > 0) vlakken.push({ kant: 'voor', punten: [[0, 0, goot], [B, 0, achter], n0] }, { kant: 'achter', punten: [[B, D, achter], [0, D, goot], n1] });
    return vlakken;
  }

  /**
   * Waar een gebouw op hoogte z nog onder zijn dak valt: de rechthoek in u en
   * v. Een zolder onder een zadeldak is zo smaller dan het huis.
   */
  function bruikbaar(g, z) {
    const vol = { u0: 0, u1: g.breed, v0: 0, v1: g.diep };
    if (g.dakvorm === 'plat') return vol;
    const goot = g.goot;
    const achter = g.gootAchter ?? goot;
    const nok = Math.max(goot, achter, g.nok ?? goot);
    if (z >= nok) return { u0: 0, u1: 0, v0: 0, v1: 0 };
    const langsU = g.nokAs !== 'v';
    const L = langsU ? g.diep : g.breed;
    let a = 0;
    let b = L;
    if (g.dakvorm === 'lessenaar') a = z > goot ? ((z - goot) / (nok - goot)) * L : 0;
    else {
      const op = Math.min(L - 0.1, Math.max(0.1, g.nokOp ?? L / 2));
      if (z > goot) a = ((z - goot) / (nok - goot)) * op;
      if (z > achter) b = op + ((nok - z) / (nok - achter)) * (L - op);
    }
    return langsU ? { ...vol, v0: a, v1: b } : { ...vol, u0: a, u1: b };
  }

  /** Een buitenmuur van een gebouw als veelhoek tot onder het dak: voor, rechts, achter of links. */
  function gevel(g, kant) {
    const B = g.breed;
    const D = g.diep;
    const lijn = { voor: [[0, 0], [B, 0]], rechts: [[B, 0], [B, D]], achter: [[B, D], [0, D]], links: [[0, D], [0, 0]] }[kant];
    const [[u0, v0], [u1, v1]] = lijn;
    const stappen = 16;
    const boven = [];
    for (let i = 0; i <= stappen; i++) {
      const u = u0 + ((u1 - u0) * i) / stappen;
      const v = v0 + ((v1 - v0) * i) / stappen;
      boven.push([u, v, dakHoogte(g, u, v)]);
    }
    // Overbodige punten op een rechte lijn eruit, zodat de veelhoek klein blijft.
    const kaal = boven.filter((p, i) => {
      if (i === 0 || i === boven.length - 1) return true;
      const a = boven[i - 1];
      const b = boven[i + 1];
      return Math.abs((p[2] - a[2]) - (b[2] - p[2])) > 1e-6;
    });
    return [[u0, v0, 0], ...kaal, [u1, v1, 0]];
  }

  /**
   * Alles in meters, in de assen van het hoofdhuis. Per gebouw de gevels en
   * de dakvlakken; per etage de vloeren per vak met hun kamer, de muren tussen
   * verschillende ruimtes, en de plek van een naam; de apparaten.
   */
  function bouw(model) {
    const naar = (g, [u, v, z = 0]) => [g.m.a * u + g.m.c * v + g.m.e, g.m.b * u + g.m.d * v + g.m.f, z];
    const gebouwen = model.gebouwen.map((g) => ({
      ...g,
      gevels: Object.fromEntries(['voor', 'rechts', 'achter', 'links'].map((k) => [k, gevel(g, k).map((p) => naar(g, p))])),
      dak: dakVlakken(g).map((d) => ({ ...d, punten: d.punten.map((p) => naar(g, p)) })),
    }));
    const vloeren = [];
    const muren = [];
    const namen = [];
    const ruimtes = [];
    for (const e of model.etages) {
      for (const g of model.gebouwen.filter((x) => (e.op ?? []).includes(x.id))) {
        const boom = model.bomen?.[e.id]?.[g.id] ?? {};
        const { vakken } = hv().vakkenIn(boom, { u: 0, v: 0, breed: g.breed, diep: g.diep });
        // De hoogte van deze etage in dit gebouw: tot de volgende, of tot het dak.
        const top = Math.min(e.tot, Math.max(...[0, g.breed].flatMap((u) => [0, g.diep].map((v) => dakHoogte(g, u, v)))) + 10);
        // Onder een schuin dak is de vloer alleen waar er boven nog ruimte is.
        const ruimte = bruikbaar(g, e.van + 0.3);
        for (const v of vakken) {
          const u0 = Math.max(v.r.u, ruimte.u0);
          const u1 = Math.min(v.r.u + v.r.breed, ruimte.u1);
          const v0 = Math.max(v.r.v, ruimte.v0);
          const v1 = Math.min(v.r.v + v.r.diep, ruimte.v1);
          if (u1 - u0 < 0.05 || v1 - v0 < 0.05) continue;
          const p = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, w]) => naar(g, [u, w, e.van]));
          vloeren.push({ etage: e.id, gebouw: g.id, kamer: v.blad.kamer ?? null, naam: v.blad.naam ?? null, punten: p, m2: v.r.breed * v.r.diep });
        }
        // Muren tussen verschillende ruimtes; laag, zodat je de kamers erachter ziet.
        const sleutel = (v) => (v.blad.kamer != null ? `k:${v.blad.kamer}` : `p:${v.pad}`);
        const bij = (a, b) => Math.abs(a - b) < 1e-6;
        const over = (a1, a2, b1, b2) => (Math.max(a1, b1) < Math.min(a2, b2) - 1e-6 ? [Math.max(a1, b1), Math.min(a2, b2)] : null);
        const hoogte = Math.min(1.0, (top - e.van) * 0.4);
        for (const A of vakken) {
          for (const Bv of vakken) {
            if (A === Bv || sleutel(A) === sleutel(Bv)) continue;
            if (bij(A.r.u + A.r.breed, Bv.r.u)) {
              const o = over(A.r.v, A.r.v + A.r.diep, Bv.r.v, Bv.r.v + Bv.r.diep);
              if (o) muren.push({ etage: e.id, gebouw: g.id, a: naar(g, [Bv.r.u, o[0], e.van]), b: naar(g, [Bv.r.u, o[1], e.van]), hoogte });
            }
            if (bij(A.r.v + A.r.diep, Bv.r.v)) {
              const o = over(A.r.u, A.r.u + A.r.breed, Bv.r.u, Bv.r.u + Bv.r.breed);
              if (o) muren.push({ etage: e.id, gebouw: g.id, a: naar(g, [o[0], Bv.r.v, e.van]), b: naar(g, [o[1], Bv.r.v, e.van]), hoogte });
            }
          }
        }
        // Eén naam per ruimte, in het grootste vak, net boven de vloer.
        const per = new Map();
        for (const v of vakken) per.set(sleutel(v), [...(per.get(sleutel(v)) ?? []), v]);
        for (const delen of per.values()) {
          const v = delen.reduce((a, b) => (b.r.breed * b.r.diep > a.r.breed * a.r.diep ? b : a));
          if (v.blad.kamer == null && !v.blad.naam) continue;
          namen.push({ etage: e.id, gebouw: g.id, kamer: v.blad.kamer ?? null, naam: v.blad.naam ?? null, plek: naar(g, [v.r.u + v.r.breed / 2, v.r.v + v.r.diep / 2, e.van + 0.25]), m2: delen.reduce((s, d) => s + d.r.breed * d.r.diep, 0) });
          ruimtes.push({ etage: e.id, kamer: v.blad.kamer ?? null, gebouw: g.id, delen: delen.length });
        }
      }
    }
    const apparaten = (model.apparaten ?? [])
      .map((a) => {
        const g = model.gebouwen.find((x) => x.id === a.gebouw);
        const e = model.etages.find((x) => x.id === a.etage);
        return g && e ? { ...a, plek: naar(g, [a.u, a.v, e.van + 1.1]) } : null;
      })
      .filter(Boolean);
    return { gebouwen, vloeren, muren, namen, ruimtes, apparaten };
  }

  /* ================================================================ de tekening */

  const TINT = { woon: '#4f8f78', keuken: '#8a7046', slaap: '#625c9c', nat: '#4f7f9c', hal: '#5d6a7b', garage: '#4d5868', zolder: '#7d5f52', leeg: '#3d475a' };
  const SOORT_TINT = { woonkamer: 'woon', woonkeuken: 'keuken', keuken: 'keuken', eetkamer: 'keuken', slaapkamer: 'slaap', kinderkamer: 'slaap', logeerkamer: 'slaap', werkkamer: 'slaap', badkamer: 'nat', toilet: 'nat', wasruimte: 'nat', hal: 'hal', bijkeuken: 'hal', berging: 'zolder', garage: 'garage', kelder: 'garage' };
  const TOON = { koelt: '#6FD3FF', verwarmt: '#FF7A4D', goed: '#6EE7B7', zon: '#F7B548' };

  /**
   * Het huis als svg. opts: breedte, hoogte, hoek (graden schuin van rechts,
   * standaard 32), hoogteHoek (graden boven de grond, standaard 30), zon
   * (richting [x, y, z] in de assen van het huis, voor het licht).
   */
  function teken(model, opts = {}) {
    const W = opts.breedte ?? 760;
    const H = opts.hoogte ?? 520;
    const b = bouw(model);
    const RAD = Math.PI / 180;
    const th = (opts.hoek ?? 18) * RAD;
    const ph = (opts.hoogteHoek ?? 33) * RAD;
    const rechts = [Math.cos(th), Math.sin(th), 0];
    const vooruit = [-Math.sin(th) * Math.cos(ph), Math.cos(th) * Math.cos(ph), -Math.sin(ph)];
    const op = [-Math.sin(th) * Math.sin(ph), Math.cos(th) * Math.sin(ph), Math.cos(ph)];
    const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
    const ruw = (p) => [dot(p, rechts), -dot(p, op)];
    const diepte = (p) => dot(p, vooruit);
    const zon = opts.zon ?? [0.35, -0.75, 0.55];
    const zl = Math.hypot(...zon);
    const ZON = zon.map((q) => q / zl);
    const normaal = (pts) => {
      const [a, c, d] = [pts[0], pts[1], pts[2]];
      const u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const l = Math.hypot(...n) || 1;
      return n.map((q) => q / l);
    };
    const mix = (hex, f) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgb(${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((q) => Math.max(0, Math.min(255, Math.round(q * f)))).join(',')})`;
    };
    // Eerst alles verzamelen in meters; daarna schalen naar het beeld.
    const stukken = [];
    const voeg = (laag, d, maak) => stukken.push({ laag, d, maak });
    /** Het licht op een vlak zoals de kijker het ziet: de normaal naar de kijker gedraaid. */
    const licht = (pts) => {
      let n = normaal(pts);
      if (dot(n, vooruit) > 0) n = n.map((q) => -q);
      return 0.62 + 0.45 * Math.max(0, dot(n, ZON));
    };
    /** Kijkt een gevel naar de kijker? Met de buitenkant van het gebouw, niet met de volgorde van de punten. */
    const gevelNaarKijker = (g, kant) => {
      const u = [g.m.a, g.m.b, 0];
      const v = [g.m.c, g.m.d, 0];
      const uit = { voor: v.map((q) => -q), achter: v, rechts: u, links: u.map((q) => -q) }[kant];
      return -dot(uit, vooruit) > 0.02;
    };
    /** Kijkt een dakvlak naar de kijker? Een dak kijkt altijd omhoog. */
    const dakNaarKijker = (pts) => {
      let n = normaal(pts);
      if (n[2] < 0) n = n.map((q) => -q);
      return -dot(n, vooruit) > 0.02;
    };
    const alle = [];
    const poly = (pts, attr) => (P) => `<polygon points="${pts.map((p) => P(p).map((q) => q.toFixed(1)).join(',')).join(' ')}" ${attr}/>`;
    const mid = (pts) => pts.reduce((s, p) => s.map((q, i) => q + p[i] / pts.length), [0, 0, 0]);

    // De grond: een plaat om de gebouwen heen.
    const hoeken = b.gebouwen.flatMap((g) => g.gevels.voor.concat(g.gevels.achter)).filter((p) => p[2] === 0);
    const xs = hoeken.map((p) => p[0]);
    const ys = hoeken.map((p) => p[1]);
    const grond = [[Math.min(...xs) - 3, Math.min(...ys) - 3.5, 0], [Math.max(...xs) + 3, Math.min(...ys) - 3.5, 0], [Math.max(...xs) + 3, Math.max(...ys) + 3, 0], [Math.min(...xs) - 3, Math.max(...ys) + 3, 0]];
    alle.push(...grond);
    voeg(0, 0, poly(grond, 'fill="#3f6f52" stroke="#5f9a72" stroke-opacity="0.5" stroke-width="1.5"'));
    const zijkant = [grond[0], grond[1], [grond[1][0], grond[1][1], -0.7], [grond[0][0], grond[0][1], -0.7]];
    voeg(0, -1, poly(zijkant, 'fill="#4a3628"'));
    const zij2 = [grond[1], grond[2], [grond[2][0], grond[2][1], -0.7], [grond[1][0], grond[1][1], -0.7]];
    voeg(0, -1, poly(zij2, 'fill="#3b2a1f"'));
    // Schaduw van elk gebouw op de grond, naar achter-links (de zon staat rechtsvoor).
    for (const g of b.gebouwen) {
      const voet = [...g.gevels.voor, ...g.gevels.achter].filter((p) => p[2] === 0);
      const sx = -ZON[0] / Math.max(0.3, ZON[2]);
      const sy = -ZON[1] / Math.max(0.3, ZON[2]);
      const h = Math.min(4, g.goot) * 0.6;
      const sch = [...voet, ...voet.map(([x, y]) => [x + sx * h, y + sy * h, 0])];
      // De omhullende van de voet en zijn verschoven kopie.
      const pts2 = sch.map((p) => [p[0], p[1]]);
      const omh = omhul(pts2).map(([x, y]) => [x, y, 0.01]);
      voeg(0, 1, poly(omh, 'fill="rgb(0 0 0 / 0.16)"'));
    }

    // Opengewerkt zijn het huis en de uitbouw; een garage, carport of schuur staat dicht, met zijn naam op het dak.
    const open = (g) => g.soort === 'hoofdhuis' || g.soort === 'uitbouw';
    const dicht = new Set(b.gebouwen.filter((g) => !open(g)).map((g) => g.id));
    for (const g of b.gebouwen.filter((x) => !open(x))) {
      const d0 = -diepte(mid(g.gevels.achter)) - 200;
      for (const kant of ['achter', 'links', 'rechts', 'voor']) {
        const pts = g.gevels[kant];
        alle.push(...pts);
        if (gevelNaarKijker(g, kant)) voeg(1, d0 + 1 - diepte(mid(pts)) * 0.01, poly(pts, `fill="${mix('#8d99ab', licht(pts))}" stroke="#c9d3dc" stroke-opacity="0.5" stroke-width="1"`));
      }
      for (const d of g.dak) {
        alle.push(...d.punten);
        if (dakNaarKijker(d.punten)) voeg(1, d0 + 2, poly(d.punten, `fill="${mix('#5d6a80', licht(d.punten))}" stroke="#c9d3dc" stroke-opacity="0.6" stroke-width="1.2"`));
      }
    }
    // Per open gebouw: de gevels achter en links (van binnen), het dak, de vloeren, en wat open is.
    for (const g of b.gebouwen.filter(open)) {
      const muur = '#3b4962';
      // Gevels: die van de kijker af kijken zie je van binnen; die naar de kijker toe zijn open (voor) of glas (rechts).
      for (const kant of ['achter', 'links', 'rechts', 'voor']) {
        const pts = g.gevels[kant];
        alle.push(...pts);
        const open = gevelNaarKijker(g, kant);
        if (!open) voeg(1, -diepte(mid(pts)) - 100, poly(pts, `fill="${mix(muur, licht(pts))}" stroke="#5a6a84" stroke-width="1"`));
        else if (kant !== 'voor') voeg(5, -diepte(mid(pts)), poly(pts, 'fill="rgb(200 220 240 / 0.07)" stroke="rgb(220 230 240 / 0.55)" stroke-width="1.2"'));
        else voeg(5, -diepte(mid(pts)), poly(pts, 'fill="none" stroke="rgb(220 230 240 / 0.35)" stroke-width="1" stroke-dasharray="4 4"'));
      }
      // Het dak: van onderen gezien donker, naar de kijker toe doorzichtig met een rand.
      for (const d of g.dak) {
        alle.push(...d.punten);
        if (dakNaarKijker(d.punten)) voeg(6, -diepte(mid(d.punten)), poly(d.punten, `fill="rgb(120 135 158 / ${g.dakvorm === 'plat' ? 0.55 : 0.2})" stroke="#c9d3dc" stroke-width="1.6" stroke-linejoin="round"`));
        else voeg(1, -diepte(mid(d.punten)) - 50, poly(d.punten, `fill="${mix('#4a566b', licht(d.punten))}" stroke="#6b7a92" stroke-width="1"`));
      }
    }

    // De etages van onder naar boven: de vloer per vak in de kleur van zijn kamer, de rand van de vloer, de lage muren.
    model.etages.forEach((e, i) => {
      const laag = 2 + i * 0.1;
      for (const v of b.vloeren.filter((x) => x.etage === e.id && !dicht.has(x.gebouw))) {
        const km = v.kamer != null ? model.kamers?.[v.kamer] : null;
        const tint = TINT[SOORT_TINT[km?.soort] ?? (km ? 'woon' : 'leeg')];
        const toon = km?.toon && TOON[km.toon];
        alle.push(...v.punten);
        // Een vloer boven de begane grond iets doorzichtig: dan zie je de kamers eronder nog.
        voeg(laag, -diepte(mid(v.punten)) * 0.001, poly(v.punten, `fill="${tint}" fill-opacity="${i === 0 ? 0.95 : 0.8}" stroke="${toon ?? 'rgb(255 255 255 / 0.12)'}" stroke-width="${toon ? 2 : 0.8}" data-kamer3d="${esc(v.kamer ?? '')}"`));
      }
      // De rand van de vloer aan de open kant: een dunne plaat.
      if (e.van > 0) {
        for (const g of b.gebouwen.filter((x) => (e.op ?? []).includes(x.id) && !dicht.has(x.id))) {
          const [p0, p1] = [g.gevels.voor[0], g.gevels.voor[g.gevels.voor.length - 1]];
          const rand = [[p0[0], p0[1], e.van], [p1[0], p1[1], e.van], [p1[0], p1[1], e.van - 0.28], [p0[0], p0[1], e.van - 0.28]];
          voeg(laag + 0.05, 0, poly(rand, 'fill="#c9d3dc"'));
          const [q0, q1] = [g.gevels.rechts[0], g.gevels.rechts[g.gevels.rechts.length - 1]];
          const rand2 = [[q0[0], q0[1], e.van], [q1[0], q1[1], e.van], [q1[0], q1[1], e.van - 0.28], [q0[0], q0[1], e.van - 0.28]];
          if (gevelNaarKijker(g, 'rechts')) voeg(laag + 0.05, 0, poly(rand2, 'fill="#aeb9c4"'));
        }
      }
      for (const m of b.muren.filter((x) => x.etage === e.id && !dicht.has(x.gebouw))) {
        const pts = [m.a, m.b, [m.b[0], m.b[1], m.b[2] + m.hoogte], [m.a[0], m.a[1], m.a[2] + m.hoogte]];
        const top = [[m.a[0], m.a[1], m.a[2] + m.hoogte], [m.b[0], m.b[1], m.b[2] + m.hoogte]];
        voeg(laag + 0.02, -diepte(mid(pts)), (P) => poly(pts, `fill="${mix('#3b4962', licht(pts))}"`)(P) + `<line x1="${P(top[0])[0].toFixed(1)}" y1="${P(top[0])[1].toFixed(1)}" x2="${P(top[1])[0].toFixed(1)}" y2="${P(top[1])[1].toFixed(1)}" stroke="#d9e1ea" stroke-width="2.4" stroke-linecap="round"/>`);
      }
      for (const a of b.apparaten.filter((x) => x.etage === e.id)) {
        voeg(laag + 0.04, -diepte(a.plek), (P) => {
          const [x, y] = P(a.plek);
          return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><line y1="0" y2="10" stroke="rgb(255 255 255 / 0.3)"/><circle r="6" fill="#13213a" stroke="${a.kleur ?? '#eef3f7'}" stroke-width="2"/></g>`;
        });
      }
    });

    // De namen, bovenop; een naam die over een andere zou vallen, schuift omhoog of valt weg.
    const geplaatst = [];
    for (const n of [...b.namen].sort((a, c) => (model.kamers?.[c.kamer]?.temp ? 1 : 0) - (model.kamers?.[a.kamer]?.temp ? 1 : 0))) {
      const km = n.kamer != null ? model.kamers?.[n.kamer] : null;
      const naam = km?.naam ?? n.naam ?? '';
      // In een dicht gebouw staat de naam op het dak.
      const g = dicht.has(n.gebouw) ? b.gebouwen.find((x) => x.id === n.gebouw) : null;
      const plek = g ? [n.plek[0], n.plek[1], g.goot + 0.2] : n.plek;
      voeg(9, 0, (P) => {
        let [x, y] = P(plek);
        const breed = Math.max(naam.length * 7, km?.zin ? km.zin.length * 6 : 0, 40);
        const hoog = 14 + (km?.temp ? 16 : 0) + (km?.zin ? 14 : 0);
        const botst = (yy) => geplaatst.some((q) => Math.abs(q.x - x) < (q.b + breed) / 2 && yy - 12 < q.y + q.h && yy - 12 + hoog > q.y);
        let stap = 0;
        while (botst(y) && stap < 4) {
          y -= 16;
          stap++;
        }
        if (botst(y)) return '';
        geplaatst.push({ x, y: y - 12, b: breed, h: hoog });
        const temp = km?.temp ? `<text y="16" text-anchor="middle" ${FONT} font-size="15" font-weight="800" fill="#ffffff" paint-order="stroke" stroke="rgb(0 0 0 / 0.45)" stroke-width="3">${esc(km.temp)}</text>` : '';
        const zin = km?.zin ? `<text y="${km.temp ? 30 : 16}" text-anchor="middle" ${FONT} font-size="10.5" font-weight="700" fill="${TOON[km.toon] ?? '#b8c4cf'}" paint-order="stroke" stroke="rgb(0 0 0 / 0.45)" stroke-width="3">${esc(km.zin)}</text>` : '';
        return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" pointer-events="none"><text text-anchor="middle" ${FONT} font-size="12" font-weight="700" fill="#eef3f7" paint-order="stroke" stroke="rgb(0 0 0 / 0.45)" stroke-width="3">${esc(naam)}</text>${temp}${zin}</g>`;
      });
    }

    // Schalen: alles in beeld, met wat ruimte erom.
    const pr = alle.map(ruw);
    const minX = Math.min(...pr.map((p) => p[0]));
    const maxX = Math.max(...pr.map((p) => p[0]));
    const minY = Math.min(...pr.map((p) => p[1]));
    const maxY = Math.max(...pr.map((p) => p[1]));
    const marge = opts.marge ?? 24;
    const s = Math.min((W - 2 * marge) / (maxX - minX), (H - 2 * marge) / (maxY - minY));
    const ox = (W - (maxX - minX) * s) / 2 - minX * s;
    const oy = (H - (maxY - minY) * s) / 2 - minY * s;
    const P = (p) => {
      const [x, y] = ruw(p);
      return [ox + x * s, oy + y * s];
    };
    stukken.sort((a, c) => a.laag - c.laag || a.d - c.d);
    return `<svg class="sc-huis3d" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(model.beschrijving ?? '')}">${stukken.map((x) => x.maak(P)).join('')}</svg>`;
  }

  /** De omhullende van punten (voor een schaduw). */
  function omhul(pts) {
    const p = [...pts].sort((a, c) => a[0] - c[0] || a[1] - c[1]);
    const kruis = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
    const onder = [];
    for (const q of p) {
      while (onder.length >= 2 && kruis(onder[onder.length - 2], onder[onder.length - 1], q) <= 0) onder.pop();
      onder.push(q);
    }
    const boven = [];
    for (const q of [...p].reverse()) {
      while (boven.length >= 2 && kruis(boven[boven.length - 2], boven[boven.length - 1], q) <= 0) boven.pop();
      boven.push(q);
    }
    return [...onder.slice(0, -1), ...boven.slice(0, -1)];
  }

  global.huis3d = { bouw, teken, dakHoogte, dakVlakken, gevel, bruikbaar };
})(typeof window !== 'undefined' ? window : globalThis);
