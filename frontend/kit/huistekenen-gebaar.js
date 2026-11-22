/*
 * SunArc: je huis tekenen, het gebaar (22 november 2026, opgesplitst uit kit/huistekenen.js).
 *
 * Wat er onder de vinger ligt (een muur, een opening, een apparaat, een zonelijn), zoomen met twee vingers of
 * het wieltje, en het gebaar zelf: neer, bewegen en loslaten, met een tik als je niet sleept. Eén luisteraar op
 * de tekening houdt de vinger vast; er wordt pas bewaard als je loslaat.
 *
 * global.htGebaar(kern) maakt dit deel voor één tekenaar; `kern` geeft wat de tekenaar deelt (zie maak() in huistekenen.js).
 */
(function (global) {
  'use strict';
  const { CEL, BUITEN, MARGE, MIN, T, nl, meter, klem, kopie, ordenen, randen, isMuur, openingMuur, openingBinnen, maten, omtrek, muurRuimte, muurNaar } = global.htVloer;
  global.htGebaar = function (kern) {
      /* ---------- wat ligt er onder de vinger */
      const punt = (e) => {
        const r = kern.svg.getBoundingClientRect();
        const px = ((e.clientX - r.left) * kern.B) / r.width;
        const py = ((e.clientY - r.top) * kern.Hpx) / r.height;
        return { px, py, x: (px - kern.ox) / kern.k, y: (kern.oy - py) / kern.k };
      };
      const ruimteOp = (v, x, y) => {
        const cx = Math.floor(x);
        const cy = Math.floor(y);
        if (cx < 0 || cy < 0 || cx >= v.W || cy >= v.H) return BUITEN;
        return v.cel[cy * v.W + cx];
      };
      /** De deur of het raam vlak bij de vinger, op deze vloer. */
      function openingBij(p, tolPx) {
        const tol = tolPx / kern.k;
        let best = null;
        const v = kern.vloer();
        for (const o of v.openingen ?? []) {
          if (!openingMuur(v, o)) continue;
          const dw = Math.abs((o.as === 'x' ? p.x : p.y) - o.op);
          const l = o.as === 'x' ? p.y : p.x;
          if (dw > tol || l < o.van - 1 || l > o.tot + 1) continue;
          if (!best || dw < best.d) best = { d: dw, o };
        }
        return best?.o ?? null;
      }
      /** De muurlijn waar een opening op ligt (langer of korter dan de opening). */
      const muurVan = (v, o) => randen(v, isMuur).find((r) => r.as === o.as && r.op === o.op && r.van <= o.van && r.tot >= o.tot) ?? null;
      /** Het raam vlak bij een plek (een screen dat je erheen sleept), binnen 80 cm. */
      function raamBij(v, x, y) {
        let best = null;
        for (const o of v.openingen ?? []) {
          if (o.soort !== 'raam' || !openingMuur(v, o)) continue;
          const dw = Math.abs((o.as === 'x' ? x : y) - o.op);
          const l = o.as === 'x' ? y : x;
          const buiten = Math.max(0, o.van - l, l - o.tot);
          const d = Math.hypot(dw, buiten);
          if (d <= 8 && (!best || d < best.d)) best = { d, o };
        }
        return best?.o ?? null;
      }
      function muurBij(p, tolPx) {
        const tol = tolPx / kern.k;
        let best = null;
        for (const r of randen(kern.vloer(), isMuur)) {
          if (r.soort !== (kern.st.stand === 'vorm' ? 2 : 1) && !(kern.metOpeningen && kern.st.stand === 'kamers' && r.soort === 2)) continue;
          const dwars = Math.abs((r.as === 'x' ? p.x : p.y) - r.op);
          const langs = r.as === 'x' ? p.y : p.x;
          // Vlak bij een hoek liever niets pakken dan de verkeerde muur.
          if (dwars > tol || langs < r.van + Math.min(1.5, (r.tot - r.van) / 4) || langs > r.tot - Math.min(1.5, (r.tot - r.van) / 4)) continue;
          // In een smalle ruimte pak je de muur alleen vlak erbij: het midden blijft om de ruimte zelf aan te tikken.
          const vl = kern.vloer();
          const kant = (r.as === 'x' ? p.x : p.y) < r.op ? -1 : 1;
          const lees = (i) => (r.as === 'x' ? ruimteOp(vl, i, langs) : ruimteOp(vl, langs, i));
          if (kern.vastId(vl, lees(r.op - 1)) || kern.vastId(vl, lees(r.op))) continue;
          const eigen = lees(kant < 0 ? r.op - 1 : r.op);
          let breed = 0;
          while (breed < 60 && lees(kant < 0 ? r.op - 1 - breed : r.op + breed) === eigen) breed++;
          if (dwars > Math.max(1, breed * 0.3)) continue;
          if (!best || dwars < best.d) best = { d: dwars, r };
        }
        return best?.r ?? null;
      }
      /** De ruimte waar een ruimte het meest aan grenst: die komt terug waar hij weggaat. Zonder buur: null. */
      function buurVoor(v, id) {
        const tel = {};
        const groot = {};
        const { W, H, cel } = v;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            groot[cel[y * W + x]] = (groot[cel[y * W + x]] ?? 0) + 1;
            if (cel[y * W + x] !== id) continue;
            for (const b of [x > 0 ? cel[y * W + x - 1] : BUITEN, x < W - 1 ? cel[y * W + x + 1] : BUITEN, y > 0 ? cel[(y - 1) * W + x] : BUITEN, y < H - 1 ? cel[(y + 1) * W + x] : BUITEN]) if (b !== BUITEN && b !== id) tel[b] = (tel[b] ?? 0) + 1;
          }
        }
        // Bij gelijke stand de kleinste buur: een kast in de hoek van de hal hoort bij de hal, niet bij de kamer erachter.
        const best = Object.entries(tel).sort((a, b) => b[1] - a[1] || groot[a[0]] - groot[b[0]])[0];
        return best ? Number(best[0]) : null;
      }
      /** Een ruimte is te verplaatsen als hij in een grotere staat of ertegenaan ligt; de grote kamer zelf niet. */
      function verplaatsbaar(v, id) {
        if (kern.vastId(v, id)) return false;
        const b = buurVoor(v, id);
        if (b == null) return false;
        let eigen = 0;
        let buur = 0;
        for (let i = 0; i < v.cel.length; i++) {
          if (v.cel[i] === id) eigen++;
          else if (v.cel[i] === b) buur++;
        }
        return eigen < buur;
      }
      /** Waar de greep staat om een gekozen ruimte te verplaatsen: midden in zijn grootste rechte stuk. */
      function greepPlek(v) {
        if (kern.st.stand !== 'kamers' || kern.st.kies?.soort !== 'ruimte') return null;
        const r = maten(v)[kern.st.kies.id]?.r;
        if (!r || !verplaatsbaar(v, kern.st.kies.id)) return null;
        return { px: kern.X((r.x0 + r.x1) / 2), py: kern.Y((r.y0 + r.y1) / 2) };
      }
      function zoneBij(p, tolPx) {
        const tol = tolPx / kern.k;
        for (const zz of kern.zonesOp(kern.vloer())) {
          for (const r of zz.stukken) {
            const dwars = Math.abs((r.as === 'x' ? p.x : p.y) - r.op);
            const langs = r.as === 'x' ? p.y : p.x;
            if (dwars <= tol && langs >= r.van && langs <= r.tot) return { kamer: zz.kamer, id: zz.id, m: r };
          }
        }
        return null;
      }
      function apparaatBij(p, tolPx) {
        let best = null;
        for (const q of kern.apparaatPunten()) {
          if (kern.st.zoom != null && kern.st.zoom !== q.ruimte) continue;
          const d = Math.hypot(kern.X(q.x) - p.px, kern.Y(q.y) - p.py);
          if (d <= tolPx && (!best || d < best.d)) best = { d, q };
        }
        return best?.q ?? null;
      }
      /** De muurlijnen op deze etage en die eronder: daar klikt een vak of een muur aan vast. */
      function magneten(as, zonder) {
        const uit = new Set();
        for (const r of randen(kern.vloer(), isMuur)) if (r.as === as && r !== zonder && !(zonder && r.op === zonder.op && r.as === zonder.as)) uit.add(r.op);
        const e = kern.onder();
        if (e && kern.st.stand === 'kamers') for (const r of randen(kern.st.vloeren[e.id], isMuur)) if (r.as === as) uit.add(r.op);
        return [...uit];
      }
      const klik = (n, lijst, bereik) => {
        let best = Math.round(n);
        let d = bereik;
        for (const m of lijst) {
          if (Math.abs(n - m) < d) {
            d = Math.abs(n - m);
            best = m;
          }
        }
        return best;
      };

      /* ---------- zoomen: knijpen met twee vingers, of het wieltje */
      /** Hoe groot het hele huis past: verder uitzoomen hoeft niet. */
      const pasK = () => {
        const h = kern.heleKijk();
        return Math.min(kern.B / (h.x1 - h.x0), kern.Hpx / (h.y1 - h.y0));
      };
      /** Zoom naar schaal `k1`, met ruitje `g` onder schermpunt `m`. */
      function zoomNaar(k1, g, m) {
        cancelAnimationFrame(kern.anim);
        const kp = pasK();
        k1 = klem(k1, kp, Math.max(kp * 1.01, 16));
        if (k1 <= kp * 1.03) {
          kern.st.eigen = null;
          kern.zetKijk(kern.zoomDoel());
          return kern.teken();
        }
        const ox1 = m.px - g.x * k1;
        const oy1 = m.py + g.y * k1;
        const r = { x0: -ox1 / k1, x1: (kern.B - ox1) / k1, y0: (oy1 - kern.Hpx) / k1, y1: oy1 / k1 };
        // Het midden van wat je ziet blijft boven het huis.
        const h = kern.heleKijk();
        const cx = (r.x0 + r.x1) / 2;
        const cy = (r.y0 + r.y1) / 2;
        const sx = klem(cx, h.x0, h.x1) - cx;
        const sy = klem(cy, h.y0, h.y1) - cy;
        kern.st.eigen = { x0: r.x0 + sx, x1: r.x1 + sx, y0: r.y0 + sy, y1: r.y1 + sy };
        kern.zetKijk(kern.st.eigen);
        kern.teken();
      }
      const opScherm = (c) => {
        const r = kern.svg.getBoundingClientRect();
        return { px: ((c.x - r.left) * kern.B) / r.width, py: ((c.y - r.top) * kern.Hpx) / r.height };
      };
      /** De vingers die nu op de tekening staan. */
      const wijzers = new Map();
      let knijp = null;
      function beginKnijp() {
        const [a, b] = [...wijzers.values()].map(opScherm);
        const m = { px: (a.px + b.px) / 2, py: (a.py + b.py) / 2 };
        knijp = { ids: [...wijzers.keys()], d0: Math.max(20, Math.hypot(a.px - b.px, a.py - b.py)), k0: kern.k, g: { x: (m.px - kern.ox) / kern.k, y: (kern.oy - m.py) / kern.k } };
      }
      function knijpVerder() {
        const [a, b] = knijp.ids.map((id) => opScherm(wijzers.get(id)));
        const m = { px: (a.px + b.px) / 2, py: (a.py + b.py) / 2 };
        zoomNaar((knijp.k0 * Math.hypot(a.px - b.px, a.py - b.py)) / knijp.d0, knijp.g, m);
      }
      function heelHuis() {
        kern.st.eigen = null;
        kern.kijkNaar(kern.zoomDoel());
      }
      kern.svg.addEventListener(
        'wheel',
        (e) => {
          if (kern.st.stand === 'huis' || kern.actie) return;
          e.preventDefault();
          const m = opScherm({ x: e.clientX, y: e.clientY });
          zoomNaar(kern.k * Math.exp(-e.deltaY * 0.0015), { x: (m.px - kern.ox) / kern.k, y: (kern.oy - m.py) / kern.k }, m);
        },
        { passive: false },
      );

      /* ---------- het gebaar */
      function neer(e) {
        if (e.button > 0) return;
        try {
          kern.svg.setPointerCapture(e.pointerId);
        } catch {
          // Een nagebootste vinger kan dat niet; de luisteraars doen het dan nog.
        }
        e.preventDefault();
        wijzers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (wijzers.size > 1) {
          // Een tweede vinger: knijpen en schuiven. Wat de eerste vinger begon, gaat niet door.
          if (wijzers.size === 2 && !knijp && kern.st.stand !== 'huis') {
            if (kern.actie) afgebroken();
            beginKnijp();
          }
          return;
        }
        if (kern.actie || knijp) return;
        const p = punt(e);
        const vinger = e.pointerType !== 'mouse';
        kern.actie = { wijzer: e.pointerId, start: p, vinger, type: null, kandidaat: { soort: 'niets' } };
        if (kern.st.stand === 'huis') {
          // Opzij slepen draait het huis.
          kern.actie.type = 'draai';
          kern.actie.hoek0 = kern.st.hoek;
          return;
        }
        // Dak (stap 4 punt 3): een dakkapel pakken om te schuiven of aan een zijkant te rekken; ernaast tikken laat hem los.
        if (kern.st.stand === 'dak') {
          const raak = kern.kapelOp(p, vinger ? 16 : 8);
          if (raak) {
            Object.assign(kern.actie, { type: 'kapel', kapel: { ...raak, was: { ...kern.st.kapellen[raak.i] } } });
            kern.st.kies = { soort: 'kapel', i: raak.i };
            kern.st.kapelErbij = null;
          } else {
            kern.actie.type = 'niets';
            kern.st.kies = null;
          }
          kern.teken();
          kern.meld();
          return;
        }
        // Ronde 2: tijdens het zoeken van de kaarten kies je bij Vorm niets; een gebouw op maat trek je aan zijn stippen.
        if (kern.st.stand === 'vorm' && kern.huis.kijk?.bezig) {
          kern.actie.type = 'niets';
          return;
        }
        // Het afdak (ronde 2) is smal: wie erin of op zijn label tikt, bedoelt het afdak en niet de muur ervoor.
        if (kern.st.stand === 'vorm' && kern.st.etage === kern.benedenId()) {
          const af = kern.afdakVak();
          const [mx, my] = [(p.x - MARGE) * CEL, (p.y - MARGE) * CEL];
          const opPil = kern.afdakPil && p.px >= kern.afdakPil.x - 6 && p.px <= kern.afdakPil.x + kern.afdakPil.b + 6 && p.py >= kern.afdakPil.y - 6 && p.py <= kern.afdakPil.y + kern.afdakPil.h + 6;
          if (af && (opPil || (mx > af.u0 + 0.3 && mx < af.u1 - 0.3 && my >= af.v0 && my <= af.v1))) {
            kern.actie.kandidaat = { soort: 'afdak' };
            return;
          }
        }
        const greep = kern.st.stand === 'vorm' ? kern.blokGrepen().find((q) => Math.hypot(q.px - p.px, q.py - p.py) <= (vinger ? 24 : 12)) : null;
        if (greep) {
          const b = kern.maatVan(kern.bijBlokken().find((q) => q.id === kern.st.kies.id));
          Object.assign(kern.actie, { type: 'blokmaat', greep, id: b.id, was: { u: b.u, v: b.v, b: b.b, d: b.d } });
          return;
        }
        const hk = kern.heelKnop();
        if (hk && p.px >= hk.x - 6 && p.px <= hk.x + hk.b + 6 && p.py >= hk.y - 6 && p.py <= hk.y + hk.h + 6) {
          kern.actie.kandidaat = { soort: 'heel' };
          return;
        }
        // De stip op het scharnier: een tik zet het scharnier aan het andere eind (20 november 2026).
        const sp = kern.metOpeningen ? kern.scharnierStip(kern.vloer()) : null;
        if (sp && Math.hypot(kern.X(sp.x) - p.px, kern.Y(sp.y) - p.py) <= (vinger ? 24 : 14)) {
          kern.actie.kandidaat = { soort: 'scharnier', o: sp.o };
          return;
        }
        // Een deur of raam: aantikken of langs de muur schuiven.
        const op = kern.metOpeningen && kern.st.stand === 'kamers' ? openingBij(p, vinger ? 22 : 10) : null;
        if (op) {
          kern.actie.kandidaat = { soort: 'opening', o: op };
          kern.teken();
          return;
        }
        // Een gekozen ruimte sleep je in zijn geheel weg: overal binnen de ruimte, of aan de greep in het midden.
        const g = greepPlek(kern.vloer());
        const dg = g ? Math.hypot(g.px - p.px, g.py - p.py) : Infinity;
        const opGreep = dg <= (vinger ? 30 : 20);
        if (g && ruimteOp(kern.vloer(), p.x, p.y) === kern.st.kies.id) kern.actie.gekozen = kern.st.kies.id;
        if (opGreep || kern.actie.gekozen != null) {
          // Vlak bij een muur pak je de muur: wat het dichtst bij de vinger ligt, wint (in een klein vak ligt de muur ook bij de greep).
          const mg = muurBij(p, vinger ? 20 : 9);
          const dm = mg ? Math.abs((mg.as === 'x' ? p.x : p.y) - mg.op) * kern.k : Infinity;
          if (dm >= dg || (!opGreep && !mg)) {
            kern.actie.kandidaat = { soort: 'verplaats', id: kern.st.kies.id, greep: opGreep };
            return;
          }
        }
        if (kern.st.stand === 'apparaten') {
          const q = apparaatBij(p, vinger ? 32 : 24);
          if (q) kern.actie.kandidaat = { soort: 'apparaat', q };
        } else {
          const m = muurBij(p, vinger ? 20 : 9);
          const z = !m && kern.st.stand === 'kamers' ? zoneBij(p, vinger ? 20 : 9) : null;
          kern.actie.kandidaat = m ? { soort: 'muur', m } : z ? { soort: 'zone', ...z } : { soort: 'vak' };
          if (m) kern.teken();
        }
      }
      function beweeg(e) {
        if (wijzers.has(e.pointerId)) wijzers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (knijp) {
          if (knijp.ids.includes(e.pointerId)) knijpVerder();
          return;
        }
        if (!kern.actie || e.pointerId !== kern.actie.wijzer) return;
        const p = punt(e);
        const dx = p.px - kern.actie.start.px;
        const dy = p.py - kern.actie.start.py;
        if (kern.actie.type === 'kapel') {
          const { i, wat, m, was } = kern.actie.kapel;
          const da = (m.langs ? p.y - kern.actie.start.y : p.x - kern.actie.start.x) * CEL;
          const breed = was.tot - was.van;
          const kk = kern.st.kapellen[i];
          if (wat === 'schuif') {
            kk.van = kern.r1(klem(was.van + da, 0, m.la - breed));
            kk.tot = kern.r1(kk.van + breed);
          } else if (wat === 'van') kk.van = kern.r1(klem(was.van + da, 0, was.tot - 0.6));
          else kk.tot = kern.r1(klem(was.tot + da, was.van + 0.6, m.la));
          if (Math.abs(da) > 0.05) kern.actie.kapel.verschoven = true;
          kern.teken();
          return;
        }
        if (kern.actie.type === 'blokmaat') {
          const { ku, kv } = kern.actie.greep;
          const du = (p.x - kern.actie.start.x) * CEL;
          const dv = (p.y - kern.actie.start.y) * CEL;
          const w = kern.actie.was;
          let { u, v, b, d } = w;
          if (ku < 0) {
            u = Math.min(w.u + du, w.u + w.b - 1);
            b = w.u + w.b - u;
          } else if (ku > 0) b = Math.max(1, w.b + du);
          if (kv < 0) {
            v = Math.min(w.v + dv, w.v + w.d - 1);
            d = w.v + w.d - v;
          } else if (kv > 0) d = Math.max(1, w.d + dv);
          kern.st.blokMaat = { id: kern.actie.id, u: kern.r1(u), v: kern.r1(v), b: kern.r1(Math.min(40, b)), d: kern.r1(Math.min(40, d)) };
          if (Math.abs(du) > 0.05 || Math.abs(dv) > 0.05) kern.actie.verschoven = true;
          kern.teken();
          return;
        }
        if (kern.actie.type === 'draai') {
          kern.st.hoek = klem(kern.actie.hoek0 + dx * 0.35, -65, 65);
          kern.teken();
          return;
        }
        if (!kern.actie.type) {
          if (Math.hypot(dx, dy) < (kern.actie.vinger ? 10 : 5)) return;
          let kd = kern.actie.kandidaat;
          // In een gekozen ruimte bij een muur: recht van de muur af schuift de muur, schuin of erlangs verplaatst de ruimte.
          if (kern.actie.gekozen != null && (kd.soort === 'muur' || kd.soort === 'zone') && !(Math.abs(kd.m.as === 'x' ? dx : dy) > Math.abs(kd.m.as === 'x' ? dy : dx) * 1.4)) {
            kd = kern.actie.kandidaat = { soort: 'verplaats', id: kern.actie.gekozen, greep: false };
          }
          if (kd.soort === 'verplaats') {
            // De ruimte optillen: waar hij stond komt de ruimte terug waar hij het meest aan grenst.
            const v0 = kern.vloer();
            kern.actie.type = 'verplaats';
            kern.actie.cellen = [];
            for (let i = 0; i < v0.cel.length; i++) if (v0.cel[i] === kd.id) kern.actie.cellen.push(i);
            kern.actie.basis = kopie(v0);
            const vul = buurVoor(v0, kd.id);
            for (const c of kern.actie.cellen) kern.actie.basis.cel[c] = vul;
            kern.actie.bb = maten(v0)[kd.id];
            kern.actie.d = [0, 0];
            const lijnen = randen(kern.actie.basis, isMuur);
            kern.actie.mx = [...new Set(lijnen.filter((r) => r.as === 'x').map((r) => r.op))];
            kern.actie.my = [...new Set(lijnen.filter((r) => r.as === 'y').map((r) => r.op))];
          } else if (kd.soort === 'muur') {
            // Recht van de muur af is schuiven; schuin of erlangs is een vak trekken dat bij de muur begint.
            const dwars = Math.abs(kd.m.as === 'x' ? dx : dy);
            const langs = Math.abs(kd.m.as === 'x' ? dy : dx);
            // Buiten is de buitenmuur de erfgrens: die schuif je ook bij Kamers (19 november 2026).
            const opErf = !!kern.etageVan(kern.st.etage)?.buiten;
            if (dwars > langs * 1.4 && !(kd.m.soort === 2 && kern.st.stand === 'kamers' && !opErf)) {
              kern.actie.type = 'muur';
              kern.actie.begin = kopie(kern.vloer());
              kern.actie.ruimte = muurRuimte(kern.actie.begin, kd.m, opErf);
              kern.actie.nu = { ...kd.m };
              kern.actie.magneet = magneten(kd.m.as, kd.m);
            } else kern.actie.type = 'vak';
          } else if (kd.soort === 'zone') {
            const dwars = Math.abs(kd.m.as === 'x' ? dx : dy);
            const langs = Math.abs(kd.m.as === 'x' ? dy : dx);
            if (dwars > langs * 1.4) {
              kern.actie.type = 'zone';
              kern.actie.kamer = kd.kamer;
              kern.actie.nuOp = kd.m.op;
              kern.actie.magneet = magneten(kd.m.as);
            } else kern.actie.type = 'vak';
          } else if (kd.soort === 'opening') {
            kern.actie.type = 'opening';
            kern.actie.begin = kern.foto();
            kern.actie.o0 = { ...kd.o };
            kern.actie.run = muurVan(kern.vloer(), kd.o);
            if (!kern.actie.run) {
              kern.actie.type = 'niets';
              return;
            }
          } else if (kd.soort === 'apparaat') {
            kern.actie.type = 'apparaat';
            kern.actie.a = kd.q.a;
            kern.actie.van = kd.q;
            // De vinger dekt het icoon af: til het er een stukje boven.
            kern.actie.dx = kern.X(kd.q.x) - kern.actie.start.px;
            kern.actie.dy = kern.Y(kd.q.y) - kern.actie.start.py - (kern.actie.vinger ? 30 : 0);
          } else if (kd.soort === 'vak') kern.actie.type = 'vak';
          else if (kd.soort === 'heel') {
            // Van de knop af geschoven: dan niets.
            kern.actie.type = 'niets';
            return;
          } else return;
          if (kern.actie.type === 'vak') {
            const sx = klik(kern.actie.start.x, magneten('x'), 3.2);
            const sy = klik(kern.actie.start.y, magneten('y'), 3.2);
            kern.actie.hoek = { x: sx, y: sy };
            kern.teken();
          }
        }
        if (kern.actie.type === 'opening') {
          const o0 = kern.actie.o0;
          const o = kern.vloer().openingen.find((x) => x.id === o0.id);
          const w = o0.tot - o0.van;
          const van = Math.round(klem(o0.van + (o0.as === 'x' ? -dy : dx) / kern.k, kern.actie.run.van + 1, kern.actie.run.tot - 1 - w));
          if (o && van !== o.van) {
            o.van = van;
            o.tot = van + w;
            kern.st.kies = { soort: 'opening', id: o.id };
            kern.teken();
            kern.meld();
          }
          return;
        }
        if (kern.actie.type === 'muur') {
          const m = kern.actie.kandidaat.m;
          const ruw = m.op + (m.as === 'x' ? dx : -dy) / kern.k;
          const nieuw = klem(klik(ruw, kern.actie.magneet, 1.3), kern.actie.ruimte.min, kern.actie.ruimte.max);
          if (nieuw === kern.actie.nu.op) return;
          kern.actie.nu = { ...m, op: nieuw };
          kern.actie.gelijk = kern.actie.magneet.includes(nieuw);
          kern.actie.voorbeeld = muurNaar(kern.actie.begin, m, nieuw);
          kern.over = muurMaten(kern.actie.voorbeeld, kern.actie.nu, m.as === 'x' ? p.y : p.x, kern.actie.gelijk);
          kern.teken();
          kern.meld();
        } else if (kern.actie.type === 'verplaats') {
          const { bb, basis, cellen } = kern.actie;
          // Een kant van de ruimte klikt vast aan een muur in de buurt.
          const klikKant = (d, lo, hi, lijst) => {
            let best = Math.round(d);
            let afstand = 1.6;
            for (const m of lijst) {
              for (const rand of [lo, hi]) {
                const a = Math.abs(rand + d - m);
                if (a < afstand) {
                  afstand = a;
                  best = m - rand;
                }
              }
            }
            return best;
          };
          const ddx = klikKant(dx / kern.k, bb.x0, bb.x1, kern.actie.mx);
          const ddy = klikKant(-dy / kern.k, bb.y0, bb.y1, kern.actie.my);
          if (ddx === kern.actie.d[0] && ddy === kern.actie.d[1]) return;
          // Alleen waar hij helemaal in het huis past.
          const W = basis.W;
          const past = cellen.every((c) => {
            const x = (c % W) + ddx;
            const y = ((c / W) | 0) + ddy;
            return x >= 0 && y >= 0 && x < W && y < basis.H && basis.cel[y * W + x] !== BUITEN;
          });
          if (!past) return;
          kern.actie.d = [ddx, ddy];
          const v = kopie(basis);
          for (const c of cellen) v.cel[c + ddy * W + ddx] = kern.actie.kandidaat.id;
          kern.actie.voorbeeld = v;
          const o = omtrek(basis);
          kern.over = kern.pil(kern.X((bb.x0 + bb.x1) / 2 + ddx), kern.Y(bb.y1 + ddy) - 18, T('ht.vanLinksVoor', { links: meter(bb.x0 + ddx - o.x0), voor: meter(bb.y0 + ddy - o.y0) }));
          kern.teken();
        } else if (kern.actie.type === 'zone') {
          // De zonelijn schuift binnen zijn kamer; de muren blijven staan.
          const m = kern.actie.kandidaat.m;
          const mm = maten(kern.vloer())[kern.actie.kandidaat.id];
          const ruw = m.op + (m.as === 'x' ? dx : -dy) / kern.k;
          const [lo, hi] = m.as === 'x' ? [mm.x0 + MIN, mm.x1 - MIN] : [mm.y0 + MIN, mm.y1 - MIN];
          const nieuw = klem(klik(ruw, kern.actie.magneet, 1.3), lo, hi);
          if (nieuw === kern.actie.nuOp) return;
          kern.actie.nuOp = nieuw;
          kern.actie.voorbeeld = kopie(kern.vloer());
          kern.actie.voorbeeld.zones[kern.actie.kamer].op = nieuw;
          const langs = m.as === 'x' ? p.y : p.x;
          const [a, b] = m.as === 'x' ? [nieuw - mm.x0, mm.x1 - nieuw] : [nieuw - mm.y0, mm.y1 - nieuw];
          kern.over = m.as === 'x' ? kern.pil(kern.X(nieuw - a / 2), kern.Y(langs), meter(a), '#6ee7b7') + kern.pil(kern.X(nieuw + b / 2), kern.Y(langs), meter(b), '#6ee7b7') : kern.pil(kern.X(langs), kern.Y(nieuw - a / 2), meter(a), '#6ee7b7') + kern.pil(kern.X(langs), kern.Y(nieuw + b / 2), meter(b), '#6ee7b7');
          kern.teken();
        } else if (kern.actie.type === 'vak') {
          const x = klik(p.x, magneten('x'), 3.2);
          const y = klik(p.y, magneten('y'), 3.2);
          const r = { x0: Math.min(kern.actie.hoek.x, x), y0: Math.min(kern.actie.hoek.y, y), x1: Math.max(kern.actie.hoek.x, x), y1: Math.max(kern.actie.hoek.y, y) };
          kern.actie.recht = r;
          const goed = r.x1 - r.x0 >= MIN - 1 && r.y1 - r.y0 >= MIN - 1;
          const kleur = goed ? '#6fd3ff' : 'rgb(255 255 255 / 0.4)';
          kern.over = `<rect x="${kern.X(r.x0)}" y="${kern.Y(r.y1)}" width="${(r.x1 - r.x0) * kern.k}" height="${(r.y1 - r.y0) * kern.k}" rx="3" fill="rgb(111 211 255 / ${goed ? 0.16 : 0.05})" stroke="${kleur}" stroke-width="2.5" stroke-dasharray="8 6" pointer-events="none"/>`;
          if (goed) kern.over += kern.pil(kern.X((r.x0 + r.x1) / 2), kern.Y((r.y0 + r.y1) / 2), `${nl((r.x1 - r.x0) * CEL)} × ${nl((r.y1 - r.y0) * CEL)} m`);
          kern.laag('over').innerHTML = kern.over;
        } else if (kern.actie.type === 'apparaat') {
          let px = p.px + kern.actie.dx;
          let py = p.py + kern.actie.dy;
          const v = kern.vloer();
          let x = (px - kern.ox) / kern.k;
          let y = (kern.oy - py) / kern.k;
          const id = ruimteOp(v, x, y);
          let muurBijPlek = false;
          if (id !== BUITEN) {
            // Bij een muur klikt het vast, op 20 cm ervan.
            const tot = (ddx, ddy) => {
              let n = 0;
              while (n < 6 && ruimteOp(v, x + ddx * (n + 0.5), y + ddy * (n + 0.5)) === id) n++;
              return n;
            };
            for (const [ddx, ddy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
              const n = tot(ddx, ddy);
              if (n > 4) continue;
              muurBijPlek = true;
              // De muur ligt op de rand van het eerste ruitje dat niet meer van de ruimte is.
              if (ddx < 0) x = Math.floor(x - n - 0.5) + 1 + 2;
              else if (ddx > 0) x = Math.floor(x + n + 0.5) - 2;
              else if (ddy < 0) y = Math.floor(y - n - 0.5) + 1 + 2;
              else y = Math.floor(y + n + 0.5) - 2;
            }
            px = kern.X(x);
            py = kern.Y(y);
          }
          const kan = id !== BUITEN && !!v.ruimtes[id]?.kamer && !kern.vastId(v, id);
          const anders = kern.actie.doel !== (kan ? id : null);
          kern.actie.doel = kan ? id : null;
          kern.actie.px = px;
          kern.actie.py = py;
          kern.actie.plek = kan ? { etage: kern.st.etage, x, y } : null;
          const naam = id === BUITEN ? T('ht.buitenHuis') : kan ? `${kern.naamVan(v.ruimtes[id])}${muurBijPlek ? ` · ${T('ht.aanDeMuur')}` : ''}` : T('ht.nogGeenKamer');
          kern.over = kern.pil(px, py - 44, naam, kan ? '#6ee7b7' : '#ffb090');
          if (anders) kern.teken();
          else {
            const g = kern.svg.querySelector(`[data-ap="${CSS.escape(kern.actie.a.id)}"]`);
            if (g) g.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
            else kern.teken();
            kern.laag('over').innerHTML = kern.over;
          }
        }
      }
      /** De maten aan weerszijden van een muur, op de hoogte van de vinger. */
      function muurMaten(v, run, langs, gelijk) {
        const j = klem(Math.floor(langs), run.van, run.tot - 1);
        const lees = (i) => (run.as === 'x' ? ruimteOp(v, i, j) : ruimteOp(v, j, i));
        const tel = (start, d) => {
          const id = lees(start);
          let n = 0;
          while (n < 600 && lees(start + d * n) === id && id !== BUITEN) n++;
          return n;
        };
        const a = tel(run.op - 1, -1);
        const b = tel(run.op, 1);
        let s = '';
        const zet = (midden, tekst) => (run.as === 'x' ? kern.pil(kern.X(midden), kern.Y(j + 0.5), tekst) : kern.pil(kern.X(j + 0.5), kern.Y(midden), tekst));
        if (a) s += zet(run.op - a / 2, meter(a));
        if (b) s += zet(run.op + b / 2, meter(b));
        if (gelijk) {
          // Op één lijn met een andere muur: een dunne lijn over het hele huis.
          s += run.as === 'x' ? `<path d="M${kern.X(run.op)} 0V${kern.Hpx}" stroke="#6ee7b7" stroke-opacity="0.6" stroke-dasharray="3 5"/>` : `<path d="M0 ${kern.Y(run.op)}H${kern.B}" stroke="#6ee7b7" stroke-opacity="0.6" stroke-dasharray="3 5"/>`;
        }
        return s;
      }
      /** Een vinger van de tekening af: na het knijpen gebeurt er niets tot ze allebei los zijn. */
      function vingerWeg(id) {
        wijzers.delete(id);
        if (knijp && !wijzers.size) knijp = null;
      }
      function los(e) {
        vingerWeg(e.pointerId);
        if (!kern.actie || e.pointerId !== kern.actie.wijzer) return;
        const a = kern.actie;
        kern.actie = null;
        kern.over = '';
        if (a.type === 'draai') return kern.meld();
        if (a.type === 'niets') return;
        if (a.type === 'blokmaat') {
          if (a.verschoven) kern.blokMaatBewaar(0);
          kern.teken();
          return kern.meld();
        }
        if (a.type === 'kapel') {
          if (a.kapel.verschoven) kern.kapelBewaar();
          kern.teken();
          return kern.meld();
        }
        if (!a.type) return a.kandidaat.soort === 'heel' ? heelHuis() : tik(a);
        if (a.type === 'verplaats') {
          if (a.voorbeeld && (a.d[0] || a.d[1])) {
            kern.stap();
            // Wat in de ruimte een eigen plek had, verhuist mee.
            const inRuimte = new Set(a.cellen);
            for (const dev of kern.st.apparaten) {
              const pl = dev.plek;
              if (pl && pl.etage === kern.st.etage && inRuimte.has(Math.floor(pl.y) * a.basis.W + Math.floor(pl.x))) dev.plek = { ...pl, x: pl.x + a.d[0], y: pl.y + a.d[1] };
            }
            kern.st.vloeren[kern.st.etage] = a.voorbeeld;
            ordenen(kern.vloer());
            kern.st.kies = kern.vloer().ruimtes[a.kandidaat.id] ? { soort: 'ruimte', id: a.kandidaat.id } : null;
          }
          return kern.klaar();
        }
        if (a.type === 'muur') {
          if (a.nu.op !== a.kandidaat.m.op) {
            kern.stap();
            kern.st.vloeren[kern.st.etage] = a.voorbeeld;
            ordenen(kern.vloer());
            kern.st.kies = { soort: 'muur', run: muurOpnieuw(a.nu) };
          }
          return kern.klaar();
        }
        if (a.type === 'opening') {
          const o = kern.vloer().openingen.find((x) => x.id === a.o0.id);
          if (o && o.van !== a.o0.van) kern.stap(a.begin);
          kern.st.kies = { soort: 'opening', id: a.o0.id };
          return kern.klaar();
        }
        if (a.type === 'zone') {
          if (a.voorbeeld) {
            kern.stap();
            kern.vloer().zones[a.kamer].op = a.nuOp;
            kern.st.kies = { soort: 'ruimte', id: a.kandidaat.id };
          }
          return kern.klaar();
        }
        if (a.type === 'vak') {
          const r = a.recht;
          if (r && r.x1 - r.x0 >= MIN - 1 && r.y1 - r.y0 >= MIN - 1) kern.nieuwVak(r);
          else kern.teken();
          return kern.meld();
        }
        if (a.type === 'apparaat') {
          if (a.plek && a.doel != null) {
            kern.stap();
            const dev = kern.st.apparaten.find((x) => x.id === a.a.id);
            const doelKamer = kern.vloer().ruimtes[a.doel].kamer;
            // Binnen de tuin verschoven terwijl zijn deel nog geen vak heeft: het blijft in dat deel.
            const deelVan = dev.kamer ? kern.kamers[dev.kamer]?.deelVan : null;
            dev.kamer = deelVan && deelVan === doelKamer && !kern.kamerPlek()[dev.kamer] ? dev.kamer : doelKamer;
            dev.plek = a.plek;
            if (kern.metOpeningen && dev.soort === 'screen') {
              const r = raamBij(kern.vloer(), a.plek.x, a.plek.y);
              if (r) {
                dev.raam = r.id;
                // Vlak voor het raam, in het midden.
                const kant = openingBinnen(kern.vloer(), r) * (openingMuur(kern.vloer(), r) === 2 ? 1 : 1);
                const mid = (r.van + r.tot) / 2;
                dev.plek = r.as === 'x' ? { etage: kern.st.etage, x: r.op + kant * 3, y: mid } : { etage: kern.st.etage, x: mid, y: r.op + kant * 3 };
              } else delete dev.raam;
            }
            kern.st.kies = { soort: 'apparaat', id: dev.id };
            if (kern.st.zoom != null && kern.st.zoom !== a.doel) kern.st.zoom = a.doel;
          }
          return kern.klaar();
        }
      }
      function afgebroken(e) {
        if (e) vingerWeg(e.pointerId);
        if (!kern.actie || (e && e.pointerId !== kern.actie.wijzer)) return;
        kern.actie = null;
        kern.over = '';
        kern.teken();
        kern.meld();
      }
      /** De muur na het schuiven terugvinden: hij kan langer of korter geworden zijn. */
      function muurOpnieuw(run) {
        const mid = (run.van + run.tot) / 2;
        const soort = kern.st.stand === 'vorm' ? 2 : 1;
        const lijst = randen(kern.vloer(), isMuur).filter((r) => r.as === run.as && r.op === run.op && r.soort === soort);
        return lijst.find((r) => r.van <= mid && r.tot >= mid) ?? lijst[0] ?? null;
      }

      function tik(a) {
        const p = a.start;
        const v = kern.vloer();
        const id = ruimteOp(v, p.x, p.y);
        // Het huis op het erf: een tik geeft zijn blad, met de weg naar binnen (20 november 2026: eerst sprong hij meteen naar de begane grond, ook als je aan het tekenen was).
        if (kern.vastId(v, id) && a.kandidaat.soort !== 'apparaat') {
          kern.st.blad = null;
          kern.st.kies = { soort: 'erfhuis', id };
          kern.teken();
          return kern.meld();
        }
        if (kern.st.stand === 'apparaten') {
          if (a.kandidaat.soort === 'apparaat') {
            kern.st.kies = { soort: 'apparaat', id: a.kandidaat.q.a.id };
          } else if (id !== BUITEN && kern.st.wapen?.apparaat && v.ruimtes[id]?.kamer) {
            // Een apparaat uit de lijst gekozen, dan de kamer aangetikt: daar staat het.
            kern.zetApparaat(kern.st.wapen.apparaat, v.ruimtes[id].kamer, { etage: kern.st.etage, x: p.x, y: p.y });
            return;
          } else if (id !== BUITEN && id !== kern.st.zoom) {
            kern.st.zoom = id;
            kern.st.eigen = null;
            kern.st.kies = { soort: 'ruimte', id };
            kern.kijkNaar(kern.zoomDoel());
          } else if (id === BUITEN && kern.st.zoom != null) {
            kern.st.zoom = null;
            kern.st.eigen = null;
            kern.st.kies = null;
            kern.kijkNaar(kern.zoomDoel());
          } else kern.st.kies = id !== BUITEN ? { soort: 'ruimte', id } : null;
          kern.teken();
          return kern.meld();
        }
        if (a.kandidaat.soort === 'verplaats' && a.kandidaat.greep) return kern.teken();
        if (a.kandidaat.soort === 'scharnier') {
          kern.stap();
          a.kandidaat.o.scharnier = a.kandidaat.o.scharnier === 'tot' ? 'van' : 'tot';
          return kern.klaar();
        }
        if (a.kandidaat.soort === 'afdak') {
          kern.st.kies = { soort: 'afdak' };
          kern.afdakZie();
        } else if (a.kandidaat.soort === 'opening') kern.st.kies = { soort: 'opening', id: a.kandidaat.o.id };
        else if (a.kandidaat.soort === 'muur') kern.st.kies = { soort: 'muur', run: a.kandidaat.m, bij: a.kandidaat.m.as === 'x' ? p.y : p.x };
        else if (a.kandidaat.soort === 'zone') kern.st.kies = { soort: 'ruimte', id: a.kandidaat.id };
        else if (kern.st.stand === 'vorm') {
          kern.st.kies = kern.gebouwOp(p.x, p.y);
          // Het afdak aangetikt: gezien, het label Nieuw gaat weg.
          if (kern.st.kies?.soort === 'afdak') kern.afdakZie();
        }
        else if (id === BUITEN) kern.st.kies = null;
        else if (kern.st.wapen?.kamer) {
          kern.noem(id, { kamer: kern.st.wapen.kamer });
          return;
        } else kern.st.kies = kern.st.kies?.soort === 'ruimte' && kern.st.kies.id === id ? null : { soort: 'ruimte', id };
        kern.teken();
        kern.meld();
      }

      kern.svg.addEventListener('pointerdown', neer);
      kern.svg.addEventListener('pointermove', beweeg);
      kern.svg.addEventListener('pointerup', los);
      kern.svg.addEventListener('pointercancel', afgebroken);
      kern.svg.addEventListener('lostpointercapture', (e) => {
        // Kwijt zonder loslaten (een melding eroverheen): terug naar hoe het was.
        setTimeout(() => {
          vingerWeg(e.pointerId);
          if (kern.actie && kern.actie.wijzer === e.pointerId) afgebroken();
        }, 50);
      });
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => kern.pasAan()).observe(kern.svg);


    return { punt, ruimteOp, muurVan, buurVoor, verplaatsbaar, greepPlek, heelHuis, muurOpnieuw };
  };
})(typeof window !== 'undefined' ? window : globalThis);
