/*
 * SunArc: het huis in 3D uit de tekening (schets, 12 november 2026).
 *
 * De buitenkant komt van de gekozen bron (de 3D-kaart geeft goot, nok en
 * dakvorm; anders geschat), de binnenkant uit de ruitjes van Je huis tekenen
 * (huistekenen.js). Eén etage staat open: daar zie je de ruimtes met lage
 * binnenmuren, de zones en de apparaten; wat eronder ligt is dicht, wat
 * erboven ligt is weg en het dak staat er als lijnen boven. Of alles dicht,
 * met het dak erop. SVG, geen 3D-motor: van achter naar voren getekend.
 *
 * huistekenen3d.teken(tekenaar, breed, hoog) geeft de inhoud voor de tekening.
 */
(function (global) {
  'use strict';
  const FONT = 'font-family="Figtree, system-ui, sans-serif"';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const nl = (n) => n.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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

  function teken(t, B, Hpx) {
    const K = global.huistekenen;
    const { MARGE, CEL, BUITEN, randen, isMuur, maten, omtrek, TINT, SOORT_TINT, APP_KLEUR } = K;
    const st = t.st;
    const huis = t.huis;
    const bron = huis.bronnen?.[st.bron] ?? {};
    const goot = bron.goot ?? 6;
    // Bij een scheef dak ligt de goot aan één kant lager: tot daar lopen de dichte muren.
    const laagGoot = bron.gootLaag ?? goot;
    const nok = bron.nok ?? goot + 3;
    const etages = [...huis.etages].reverse();
    const m = (c) => (c - MARGE) * CEL;

    // De lagen op hun hoogte: de bovenste loopt tot de goot.
    let z = 0;
    const lagen = etages.map((e, i) => {
      const z0 = z;
      const top = i === etages.length - 1 ? Math.max(laagGoot, z0 + 0.4) : z0 + (e.hoogte ?? 2.8);
      z = top;
      return { e, z0, top, v: st.vloeren[e.id] };
    });
    const openIndex = st.dicht ? -1 : lagen.findIndex((l) => l.e.id === st.etage);

    // Kijken: schuin van voren en van boven, gedraaid om het midden van het huis.
    const o = omtrek(lagen[0].v);
    const cx = (m(o.x0) + m(o.x1)) / 2;
    const cy = (m(o.y0) + m(o.y1)) / 2;
    const th = (st.hoek * Math.PI) / 180;
    const ph = (33 * Math.PI) / 180;
    const [co, si, cp, sp] = [Math.cos(th), Math.sin(th), Math.cos(ph), Math.sin(ph)];
    const R = Math.hypot(m(o.x1) - m(o.x0), m(o.y1) - m(o.y0)) / 2 + 1.2;
    const k = Math.min((B - 30) / (2 * R), (Hpx - 70) / (2 * R * sp + nok * cp));
    const diep = (x, y) => -(x - cx) * si + (y - cy) * co;
    const P = (x, y, zz) => {
      const xr = (x - cx) * co + (y - cy) * si;
      return [B / 2 + xr * k, Hpx / 2 + 14 + (nok * cp * k) / 2 - (diep(x, y) * sp + zz * cp) * k];
    };
    const pt = (x, y, zz) => P(x, y, zz).map((n) => n.toFixed(1)).join(' ');
    const vlak = (punten) => `M${punten.map((p) => pt(...p)).join('L')}Z`;

    let s = '';
    // De grond onder het huis.
    const g = 1.3;
    s += `<path d="${vlak([[m(o.x0) - g, m(o.y0) - g, 0], [m(o.x1) + g, m(o.y0) - g, 0], [m(o.x1) + g, m(o.y1) + g, 0], [m(o.x0) - g, m(o.y1) + g, 0]])}" fill="rgb(63 125 85 / 0.16)" stroke="rgb(63 125 85 / 0.35)"/>`;

    /** Een muur als staand vlak; lange muren in stukken, zodat voor en achter kloppen. */
    const muurStukken = (run) => {
      const uit = [];
      for (let a = run.van; a < run.tot; a += 10) {
        const b = Math.min(run.tot, a + 10);
        uit.push(run.as === 'x' ? [m(run.op), m(a), m(run.op), m(b)] : [m(a), m(run.op), m(b), m(run.op)]);
      }
      return uit;
    };
    /** Kijkt de buitenkant van deze buitenmuur naar de kijker? */
    const naarKijker = (v, run) => {
      const mid = Math.floor((run.van + run.tot) / 2);
      const [nx, ny] = run.as === 'x' ? [v.cel[mid * v.W + run.op - 1] === BUITEN ? -1 : 1, 0] : [0, v.cel[(run.op - 1) * v.W + mid] === BUITEN ? -1 : 1];
      return -nx * si + ny * co < 0;
    };

    lagen.forEach((laag, li) => {
      if (openIndex >= 0 && li > openIndex) return;
      const { v, z0 } = laag;
      // Dicht: wat boven de laagste goot ligt, zit in het dak.
      if (st.dicht && z0 >= laagGoot) return;
      const top = st.dicht ? Math.min(laag.top, laagGoot) : laag.top;
      const muren = randen(v, isMuur);
      const stukken = [];
      if (li === openIndex) {
        // De open etage: de vloer per ruimte in zijn kleur.
        const per = {};
        for (const r of rechthoeken(v, BUITEN)) (per[r.id] ??= []).push(vlak([[m(r.x0), m(r.y0), z0], [m(r.x1), m(r.y0), z0], [m(r.x1), m(r.y1), z0], [m(r.x0), m(r.y1), z0]]));
        for (const [id, paden] of Object.entries(per)) {
          const r = v.ruimtes[id];
          const naam = t.naamVan(r);
          const tint = TINT[SOORT_TINT[t.soortVan(r)] ?? (r?.kamer ? 'woon' : naam ? 'hal' : 'leeg')];
          s += `<path d="${paden.join('')}" fill="#16233a"/><path d="${paden.join('')}" fill="rgb(${tint} / ${naam ? 0.34 : 0.08})"/>`;
        }
        // De zones: een stippellijn over de vloer.
        for (const zz of t.zones()) for (const r of zz.stukken) s += `<path d="M${r.as === 'x' ? `${pt(m(r.op), m(r.van), z0)}L${pt(m(r.op), m(r.tot), z0)}` : `${pt(m(r.van), m(r.op), z0)}L${pt(m(r.tot), m(r.op), z0)}`}" stroke="#6ee7b7" stroke-width="2.2" stroke-dasharray="7 6" fill="none"/>`;
        // De muren: binnen halfhoog, de buitenmuur naar de kijker laag, die erachter op volle hoogte.
        for (const run of muren) {
          const voor = run.soort === 2 && naarKijker(v, run);
          const h = run.soort === 1 ? 1.15 : voor ? 0.45 : top - z0;
          const vul = run.soort === 1 ? (run.as === 'x' ? '#cdd6df' : '#e4eaf0') : voor ? '#f1f5f8' : run.as === 'x' ? 'rgb(170 184 198 / 0.42)' : 'rgb(201 211 220 / 0.42)';
          for (const [x0, y0, x1, y1] of muurStukken(run)) stukken.push({ d: diep((x0 + x1) / 2, (y0 + y1) / 2), s: `<path d="${vlak([[x0, y0, z0], [x1, y1, z0], [x1, y1, z0 + h], [x0, y0, z0 + h]])}" fill="${vul}" stroke="rgb(13 26 48 / 0.35)" stroke-width="0.7" stroke-linejoin="round"/>` });
        }
        // De apparaten: een stip op ooghoogte, met een steel naar de vloer.
        if (li === lagen.findIndex((l) => l.e.id === st.etage)) {
          for (const q of t.apparaatPunten()) {
            const [x, y] = [m(q.x), m(q.y)];
            const a = P(x, y, z0);
            const b = P(x, y, z0 + 1.25);
            stukken.push({ d: diep(x, y) - 0.05, s: `<path d="M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}" stroke="rgb(255 255 255 / 0.4)" stroke-width="1.2"/><circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="5.5" fill="${APP_KLEUR[q.a.soort] ?? '#eef3f7'}" stroke="#0d1a30" stroke-width="1.5"/>` });
          }
        }
        stukken.sort((a, b) => b.d - a.d);
        s += stukken.map((x) => x.s).join('');
        // De namen van de ruimtes, op de vloer.
        const mm = maten(v);
        for (const [id, r] of Object.entries(v.ruimtes)) {
          const naam = t.naamVan(r);
          const rr = mm[id]?.r;
          if (!naam || !rr || (rr.x1 - rr.x0) * CEL * k < 46) continue;
          const zone = t.zones().find((zz) => zz.id === Number(id));
          const zet = (x, y, tekst) => {
            const p = P(x, y, z0 + 0.05);
            s += `<text x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="#eef3f7" paint-order="stroke" stroke="#0d1a30" stroke-width="3.5" stroke-linejoin="round">${esc(tekst)}</text>`;
          };
          if (zone && zone.z.as === 'x') {
            const y = m((zone.stukken[0].van + zone.stukken[0].tot) / 2);
            zet(m((mm[id].x0 + zone.z.op) / 2), y, zone.namen[0] ?? '');
            zet(m((zone.z.op + mm[id].x1) / 2), y, zone.namen[1] ?? '');
          } else zet(m((rr.x0 + rr.x1) / 2), m((rr.y0 + rr.y1) / 2), naam);
        }
        return;
      }
      // Een dichte laag: alleen de buitenmuren, en het vlak erbovenop (een plat dak, of de vloer van de laag erboven).
      for (const run of muren.filter((r) => r.soort === 2)) {
        const vul = run.as === 'x' ? '#aab6c4' : '#cbd4dd';
        for (const [x0, y0, x1, y1] of muurStukken(run)) stukken.push({ d: diep((x0 + x1) / 2, (y0 + y1) / 2), s: `<path d="${vlak([[x0, y0, z0], [x1, y1, z0], [x1, y1, top], [x0, y0, top]])}" fill="${vul}" stroke="${vul}" stroke-width="0.6" stroke-linejoin="round"/>` });
      }
      stukken.sort((a, b) => b.d - a.d);
      s += stukken.map((x) => x.s).join('');
      s += `<path d="${rechthoeken(v, BUITEN).map((r) => vlak([[m(r.x0), m(r.y0), top], [m(r.x1), m(r.y0), top], [m(r.x1), m(r.y1), top], [m(r.x0), m(r.y1), top]])).join('')}" fill="#3a475f"/>`;
    });

    // Het dak van de gebouwen met een zadeldak: dicht erop, of als lijnen erboven.
    // De nok loopt langs de voorgevel (in het midden) of er haaks op, en hoeft niet in het midden te liggen:
    // dan is de goot aan de ene kant hoger dan aan de andere.
    const pil = (p, tekst, kleur) => {
      const bw = tekst.length * 6.6 + 16;
      return `<g transform="translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})"><rect x="${-bw / 2}" y="-11" width="${bw}" height="22" rx="7" fill="#0d1a30" stroke="${kleur}" stroke-opacity="0.55"/><text y="4.5" text-anchor="middle" ${FONT} font-size="12" font-weight="700" fill="${kleur}">${esc(tekst)}</text></g>`;
    };
    const kleur = bron.gemeten ? '#6ee7b7' : '#ffd38a';
    for (const b of (bron.blokken ?? []).filter((x) => /zadel/.test(x.dak ?? ''))) {
      const haaks = b.nokLangs === 'y';
      // a loopt langs de nok, c er dwars op.
      const Q = (a, c, zz) => (haaks ? [c, a, zz] : [a, c, zz]);
      const [a0, a1] = haaks ? [b.v, b.v + b.d] : [b.u, b.u + b.b];
      const [c0, c1] = haaks ? [b.u, b.u + b.b] : [b.v, b.v + b.d];
      const cr = haaks ? c1 - (b.nokVanRechts ?? (c1 - c0) / 2) : (c0 + c1) / 2;
      const g0 = haaks ? (b.gootLinks ?? goot) : goot;
      const g1 = haaks ? (b.gootRechts ?? goot) : goot;
      const zl = Math.min(g0, g1);
      const dp = (punten) => punten.reduce((n, q) => n + diep(q[0], q[1]), 0) / punten.length;
      if (st.dicht) {
        const delen = [
          { p: [Q(a0, c0, g0), Q(a1, c0, g0), Q(a1, cr, nok), Q(a0, cr, nok)], vul: '#52627f' },
          { p: [Q(a0, c1, g1), Q(a1, c1, g1), Q(a1, cr, nok), Q(a0, cr, nok)], vul: '#3f4d66' },
          { p: [Q(a0, c0, zl), Q(a0, c0, g0), Q(a0, cr, nok), Q(a0, c1, g1), Q(a0, c1, zl)], vul: haaks ? '#cbd4dd' : '#aab6c4' },
          { p: [Q(a1, c0, zl), Q(a1, c0, g0), Q(a1, cr, nok), Q(a1, c1, g1), Q(a1, c1, zl)], vul: haaks ? '#cbd4dd' : '#aab6c4' },
        ];
        // Waar de goot hoger ligt, loopt de gevel daar door tot de goot.
        if (g0 > zl) delen.push({ p: [Q(a0, c0, zl), Q(a1, c0, zl), Q(a1, c0, g0), Q(a0, c0, g0)], vul: haaks ? '#aab6c4' : '#cbd4dd' });
        if (g1 > zl) delen.push({ p: [Q(a0, c1, zl), Q(a1, c1, zl), Q(a1, c1, g1), Q(a0, c1, g1)], vul: haaks ? '#aab6c4' : '#cbd4dd' });
        delen.sort((x, y) => dp(y.p) - dp(x.p));
        s += delen.map((x) => `<path d="${vlak(x.p)}" fill="${x.vul}" stroke="rgb(13 26 48 / 0.45)" stroke-width="0.8" stroke-linejoin="round"/>`).join('');
      } else {
        const lijn = (p, q) => `M${pt(...p)}L${pt(...q)}`;
        const open = lagen[openIndex];
        const van = open ? open.top : zl;
        let d = '';
        for (const [a, c, gz] of [[a0, c0, g0], [a1, c0, g0], [a0, c1, g1], [a1, c1, g1]]) if (gz > van) d += lijn(Q(a, c, van), Q(a, c, gz));
        d += lijn(Q(a0, c0, g0), Q(a1, c0, g0)) + lijn(Q(a0, c1, g1), Q(a1, c1, g1)) + lijn(Q(a0, cr, nok), Q(a1, cr, nok));
        for (const a of [a0, a1]) d += lijn(Q(a, c0, g0), Q(a, cr, nok)) + lijn(Q(a, c1, g1), Q(a, cr, nok));
        s += `<path d="${d}" fill="none" stroke="#6fd3ff" stroke-opacity="0.55" stroke-width="1.4" stroke-dasharray="5 5" stroke-linecap="round"/>`;
      }
      // De maten van de kaart: de nok, en de goot aan elke kant als die verschillen.
      const bij = (q, tekst, omhoog) => {
        const p = P(...q);
        const kant = p[0] >= B / 2 ? 1 : -1;
        return pil([p[0] + kant * (tekst.length * 3.3 + 20), p[1] + omhoog], tekst, kleur);
      };
      const voor = diep(...Q(a0, cr, 0)) < diep(...Q(a1, cr, 0)) ? a0 : a1;
      s += bij(Q(voor, cr, nok), `nok ${nl(nok)} m`, -8);
      if (g0 === g1) s += bij(Q(voor, c0, g0), `goot ${nl(g0)} m`, 4);
      else s += bij(Q(voor, c0, g0), `goot ${nl(g0)} m`, 4) + bij(Q(voor, c1, g1), `goot ${nl(g1)} m`, 4);
    }
    return s;
  }

  global.huistekenen3d = { teken };
})(typeof window !== 'undefined' ? window : globalThis);
