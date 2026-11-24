/*
 * SunArc: het huis zoals getekend, de meubels (opgesplitst uit kit/huis-maat.js).
 *
 * Meubels per soort kamer, tegen de muren aan de kant die van je af ligt, nooit voor een raam of deur, niet
 * over elkaar heen en onder een schuin dak alleen waar ze passen; onderling op hun randen geordend.
 *
 * global.huisMaatMeubels(kern) maakt dit deel voor één tekenaar; `kern` geeft wat de tekenaar deelt (zie maak() in huistekenen.js).
 */
(function (global) {
  'use strict';

  global.huisMaatMeubels = function (kern) {
      /*
       * Meubels per soort kamer (met de vaste lijst sinds 21 november): een bank met een salontafel, een
       * keuken met bovenkasten en een eettafel, een bed met een nachtkastje en een kast, een bad en een wastafel, een toilet,
       * een bureau met een stoel. Altijd tegen de muren aan de kant die van je af ligt, zodat ze niets afdekken; nooit voor
       * een raam of een deur, niet over elkaar heen, en onder een schuin dak alleen waar ze passen.
       */
      const meubelsVoor = (soort, q, helften, z0, top, v) => {
        const uit = [];
        // De muren aan de kant van je af, en de richting de kamer in.
        const verX = kern.naarKijker(-1, 0) ? 'x1' : 'x0';
        const verY = kern.naarKijker(0, -1) ? 'y1' : 'y0';
        const sx = verX === 'x1' ? -1 : 1;
        const sy = verY === 'y1' ? -1 : 1;
        const lang = (r, wand) => (wand === 'x' ? r.y1 - r.y0 : r.x1 - r.x0);
        // Voor ramen en deuren blijft de vloer vrij: een strook voor elk raam, een grotere voor elke deur (hij draait open).
        const vrijVoor = (v.openingen ?? []).map((g) => {
          const diep2 = g.soort === 'raam' ? 0.45 : 0.9;
          const [op, a0, a1] = [kern.m(g.op), kern.m(g.van), kern.m(g.tot)];
          return g.as === 'x' ? { x0: op - diep2, x1: op + diep2, y0: a0 - 0.05, y1: a1 + 0.05 } : { x0: a0 - 0.05, x1: a1 + 0.05, y0: op - diep2, y1: op + diep2 };
        });
        // Ook voor het raam van een dakkapel op deze etage (het bed op zolder stond ervoor).
        for (const kp of kern.hd?.kapellen ?? []) {
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
        // De apparaten die al op de vloer staan (een staande lamp, witgoed): daar komt geen meubel.
        const bezet = [...(kern.apparaatVloer.get(v) ?? [])];
        const raakt = (A, B) => A.x0 < B.x1 - 1e-6 && A.x1 > B.x0 + 1e-6 && A.y0 < B.y1 - 1e-6 && A.y1 > B.y0 + 1e-6;
        const past = (A, hoogte) => [[A.x0, A.y0], [A.x1, A.y0], [A.x0, A.y1], [A.x1, A.y1]].every(([a, b]) => kern.dakZ(a, b) >= z0 + hoogte + 0.05) && z0 + hoogte <= top - 0.05;
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
          const md = kern.zetModel(naam, punt(r, wand, c, van), opt);
          if (!md) return null;
          bezet.push({ x0: md.rect.x, x1: md.rect.x + md.rect.b, y0: md.rect.y, y1: md.rect.y + md.rect.d });
          (kern.meubelVloer.get(v) ?? kern.meubelVloer.set(v, []).get(v)).push(bezet.at(-1));
          uit.push({ d: md.d - 0.15, s: md.s, rect: md.rect });
          return md;
        };
        /** Een meubel op een vrije plek tegen een van de muren achterin (eerst `wanden[0]`). */
        const tegenMuur = (naam, r, wanden, b, opt = {}, voorkeur = 'midden') => {
          const M = kern.MOD?.MODELLEN?.[naam];
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
          uit.push({ d: kern.diep((kl.x0 + kl.x1) / 2, (kl.y0 + kl.y1) / 2) + 30, s: `<path d="${kern.vlak([[kl.x0, kl.y0, z0 + 0.01], [kl.x1, kl.y0, z0 + 0.01], [kl.x1, kl.y1, z0 + 0.01], [kl.x0, kl.y1, z0 + 0.01]])}" fill="#4d5f7e" fill-opacity="0.55"/>` });
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
            const md = kern.zetModel('bovenkast', { ...bk, z: z0 + 1.5 }, { b });
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
              const md = kern.zetModel('eettafel', { x: cx2, y: cy2, z: z0, wand: kb.wand === 'x' ? 'x' : 'y', kant: 1 }, { b: tb });
              if (md) {
                bezet.push(A);
                uit.push({ d: md.d - 0.15, s: md.s, rect: md.rect });
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
            const md = kern.zetModel('bureaustoel', st2);
            if (md) uit.push({ d: md.d - 0.15, s: md.s, rect: md.rect });
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
        /*
         * Meubels onderling op hun randen, niet op hun midden (het bed lag over het nachtkastje ervoor):
         * liggen twee meubels aan weerskanten van een rechte lijn op de vloer, dan komt het meubel aan de kant van de kijker
         * erna. De diepten blijven dezelfde, alleen hun volgorde onder de meubels verandert.
         */
        const [du, dv] = [-kern.si, kern.co];
        const ervoor = (A, B) => {
          const [a, b] = [A.rect, B.rect];
          if (a.x + a.b <= b.x + 1e-6) return du > 0;
          if (b.x + b.b <= a.x + 1e-6) return du < 0;
          if (a.y + a.d <= b.y + 1e-6) return dv > 0;
          if (b.y + b.d <= a.y + 1e-6) return dv < 0;
          return A.d < B.d;
        };
        const metRect = uit.filter((x) => x.rect);
        const dieptes = metRect.map((x) => x.d).sort((a, b) => b - a);
        const rest = [...metRect];
        const volg = [];
        while (rest.length) {
          // Het verste meubel eerst: het meubel dat voor geen enkel ander staat.
          let i = rest.findIndex((A) => rest.every((B) => B === A || !ervoor(A, B)));
          if (i < 0) i = rest.reduce((bi, x, j) => (x.d > rest[bi].d ? j : bi), 0);
          volg.push(...rest.splice(i, 1));
        }
        volg.forEach((x, i) => (x.d = dieptes[i]));
        return uit;
      };

    return { meubelsVoor };
  };
})(typeof window !== 'undefined' ? window : globalThis);
