/*
 * SunArc: het poppenhuis, de tuin (opgesplitst uit kit/huis.js).
 *
 * Het kompas, bomen, lantaarns, de tuin met border, terras en tuinhuis (huis 3.0), struiken en schaduwkleuren.
 *
 * global.huisTuin(kern) maakt dit deel voor één tekenaar; `kern` geeft wat de tekenaar deelt (zie maak() in huistekenen.js).
 */
(function (global) {
  'use strict';

  global.huisTuin = function (kern) {
      /**
       * Een kompas op de grond (huis 3.0): een ring met de vier windrichtingen,
       * gedraaid naar hoe het huis echt ligt. De voorgevel kijkt naar
       * `voorgevelDeg` (0 is noord); +x in de tekening ligt dan op voorgevel - 90.
       */
      function kompas(v, cx, cy, r0 = 0.34) {
        const rad = (a) => (a * Math.PI) / 180;
        const richting = (a, r) => [cx - Math.sin(rad(a - v)) * r, cy + Math.cos(rad(a - v)) * r, 0.006];
        const cirkel = (r) => Array.from({ length: 48 }, (_, i) => richting(i * 7.5, r));
        // Een plaat op de grond met een rand, streepjes per 30° en een naald: noord in de gloedkleur.
        kern.grond.push(kern.poly(cirkel(r0), `fill="${kern.nacht ? '#0b1422' : '#132233'}" fill-opacity="0.8" stroke="#E6EEF5" stroke-opacity="0.75" stroke-width="1.6"`));
        kern.grond.push(kern.poly(cirkel(r0 * 0.72), 'fill="none" stroke="#E6EEF5" stroke-opacity="0.22" stroke-width="1"'));
        for (let a = 0; a < 360; a += 30) {
          const [p1, p2] = [kern.P(...richting(a, r0 * (a % 90 ? 0.86 : 0.78))), kern.P(...richting(a, r0 * 0.97))];
          kern.grond.push(`<path d="M ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} L ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}" stroke="#E6EEF5" stroke-opacity="${a % 90 ? 0.35 : 0.8}" stroke-width="${a % 90 ? 1 : 1.6}"/>`);
        }
        kern.grond.push(kern.poly([richting(0, r0 * 0.7), richting(90, r0 * 0.13), richting(270, r0 * 0.13)], `fill="${kern.KLEUR.gloed}"`));
        kern.grond.push(kern.poly([richting(180, r0 * 0.7), richting(90, r0 * 0.13), richting(270, r0 * 0.13)], 'fill="#E6EEF5" opacity="0.75"'));
        const midden = kern.P(cx, cy, 0.006);
        kern.grond.push(`<circle cx="${midden[0].toFixed(1)}" cy="${midden[1].toFixed(1)}" r="${(kern.k * r0 * 0.07).toFixed(1)}" fill="#E6EEF5"/>`);
        const maat = r0 > 0.4 ? 18 : 12;
        for (const [a, letter] of [[0, global.t?.('huis.kompas.n') ?? 'N'], [90, global.t?.('huis.kompas.o') ?? 'O'], [180, global.t?.('huis.kompas.z') ?? 'Z'], [270, global.t?.('huis.kompas.w') ?? 'W']]) {
          const t = kern.P(...richting(a, r0 + (r0 > 0.4 ? 0.34 : 0.2)));
          // Een donkere rand om de letter, zodat hij op gras en klinkers leesbaar blijft.
          kern.labels.push(`<text x="${t[0].toFixed(1)}" y="${(t[1] + maat * 0.36).toFixed(1)}" text-anchor="middle" font-family="Figtree, sans-serif" font-size="${maat}" font-weight="800" fill="${a === 0 ? kern.KLEUR.gloed : '#F2F6FA'}" stroke="#0a1220" stroke-opacity="0.85" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${letter}</text>`);
        }
      }
      /** Het omhulsel van punten op de grond (Andrew's monotone keten), voor een schaduw. */
      function omhulsel(pts) {
        const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const kruis = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
        const keten = (lijst) => {
          const uit = [];
          for (const q of lijst) {
            while (uit.length >= 2 && kruis(uit[uit.length - 2], uit[uit.length - 1], q) <= 0) uit.pop();
            uit.push(q);
          }
          return uit.slice(0, -1);
        };
        return [...keten(p), ...keten([...p].reverse())];
      }
      /** Een boom: een stam en een kroon van drie bollen, in het seizoen van nu (huis 3.0). */
      function boom(x, y, s, laag) {
        const herfst = kern.model.seizoen === 'herfst';
        const sneeuw = kern.model.weer === 'sneeuw';
        const stam = kern.P(x, y, 0);
        const top = kern.P(x, y, 0.62 * s);
        laag.push(`<g filter="url(#${kern.id}-zacht)" opacity="0.35"><ellipse cx="${stam[0]}" cy="${stam[1]}" rx="${(kern.k * 0.36 * s).toFixed(1)}" ry="${(kern.k * 0.14 * s).toFixed(1)}" fill="#02050a"/></g>`);
        laag.push(`<path d="M ${stam[0]} ${stam[1]} L ${top[0]} ${top[1]}" stroke="#4a3a2c" stroke-width="${(kern.k * 0.07 * s).toFixed(1)}" stroke-linecap="round"/>`);
        if (kern.winter && !sneeuw) {
          // Kaal in de winter: alleen takken.
          for (const [dx, dz] of [[-0.18, 0.9], [0.2, 0.95], [0.02, 1.05]]) {
            const t = kern.P(x + dx * s, y, dz * s);
            laag.push(`<path d="M ${top[0]} ${top[1]} L ${t[0]} ${t[1]}" stroke="#5a4838" stroke-width="${(kern.k * 0.03 * s).toFixed(1)}" stroke-linecap="round"/>`);
          }
          return;
        }
        const kleuren = herfst ? ['#e0a04a', '#c97a36', '#9b5a2a'] : kern.nacht ? ['#2f5a45', '#244a39', '#1b3a2c'] : ['#6fbf8a', '#4e9a6c', '#3a7a55'];
        const gid = `${kern.id}-boom-${herfst ? 'h' : kern.nacht ? 'n' : 'z'}`;
        if (!kern.defs.some((d) => d.includes(`id="${gid}"`))) kern.defs.push(`<radialGradient id="${gid}" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="${kleuren[0]}"/><stop offset="0.6" stop-color="${kleuren[1]}"/><stop offset="1" stop-color="${kleuren[2]}"/></radialGradient>`);
        for (const [dx, dz, rr] of [[-0.17, 0.82, 0.3], [0.17, 0.86, 0.28], [0, 1.08, 0.33]]) {
          const c = kern.P(x + dx * s, y, dz * s);
          laag.push(`<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(kern.k * rr * s).toFixed(1)}" fill="url(#${gid})"/>`);
          if (sneeuw) laag.push(`<ellipse cx="${c[0].toFixed(1)}" cy="${(c[1] - kern.k * rr * s * 0.55).toFixed(1)}" rx="${(kern.k * rr * s * 0.75).toFixed(1)}" ry="${(kern.k * rr * s * 0.32).toFixed(1)}" fill="#f4f7fa"/>`);
        }
      }
      /** Een lantaarn aan de straat; 's avonds en 's nachts brandt hij, met een plas licht (huis 3.0). */
      function lantaarn(x, y) {
        const aan = kern.nacht || kern.schemer;
        kern.buiten.push(kern.doos(x - 0.025, y - 0.025, 0, 0.05, 0.05, 1.05, ['#6b7a8a', '#56636f', '#47525d']));
        kern.buiten.push(kern.doos(x - 0.08, y - 0.08, 1.05, 0.16, 0.16, 0.12, [aan ? '#ffe2a8' : '#8a97a5', aan ? '#f4c27e' : '#6b7885', aan ? '#d9a865' : '#5d6976']));
        if (aan) {
          const kop = kern.P(x, y, 1.1);
          const voet = kern.P(x + 0.15, y + 0.1, 0);
          kern.buiten.push(`<ellipse cx="${voet[0]}" cy="${voet[1]}" rx="${(kern.k * 0.75).toFixed(1)}" ry="${(kern.k * 0.3).toFixed(1)}" fill="#FFD39A" opacity="0.22" filter="url(#${kern.id}-zacht)"/>`);
          kern.buiten.push(`<circle cx="${kop[0]}" cy="${kop[1]}" r="${(kern.k * 0.35).toFixed(1)}" fill="#FFD39A" opacity="0.35" filter="url(#${kern.id}-zacht)"/>`);
        }
      }
      /*
       * ---- de tuin op het eiland (huis 3.0) ----
       * Elk ding een vaste plek, zodat alles tegelijk kan zonder op elkaar te
       * staan: achterin het tuinhuis, in het midden de jacuzzi op een vlonder,
       * voorin het terras tegen de gevel, ertussen een pad van stapstenen met
       * eigen tuinlampjes, en langs de buitenrand een border met planten. Wat er
       * niet is, laat zijn plek gewoon gras.
       */
      function bouwTuin3(t) {
        const gx1 = kern.eiland.x1 - 0.12;
        const gy0 = kern.eiland.y0 + 0.3;
        const gy1 = kern.eiland.yF - 0.12;
        const sneeuw = kern.model.weer === 'sneeuw';
        const herfst = kern.model.seizoen === 'herfst';
        const padX = kern.W + 1.78;
        const dingen = [];
        // De border: een strook aarde langs de buitenrand, met struiken en bloemen.
        // Alleen als hij er is; anders loopt het gras door tot de rand.
        const metBorder = t.border !== false;
        const bx0 = gx1 - 0.34;
        if (metBorder) {
          kern.grond.push(kern.poly([[bx0, gy0 + 0.95, 0.004], [gx1, gy0 + 0.95, 0.004], [gx1, gy1 - 0.08, 0.004], [bx0, gy1 - 0.08, 0.004]], `fill="${sneeuw ? '#dfe6ee' : kern.licht ? '#8a7560' : '#3a2e24'}"`));
          kern.grond.push(kern.line([[bx0, gy0 + 0.95, 0.006], [bx0, gy1 - 0.08, 0.006]], `stroke="${sneeuw ? '#c9d3dd' : '#5a4634'}" stroke-width="1.5"`));
        }
        const bloemen = herfst ? ['#e0a04a', '#c9543a', '#e8c25a'] : kern.winter || sneeuw ? null : ['#f2a7c3', '#f6d36b', '#b7a0f2', '#ffffff'];
        /*
         * De tuin in zones (schets Wand-Huis-Ligging): elke zone een
         * vaste plek, voor een label en om op te tikken. De lampen van de border
         * staan in de border, elk in de kleur van zijn lamp.
         */
        const gazon = { x0: kern.W + 0.35, y0: gy0 + 1.0, x1: metBorder ? bx0 - 0.08 : gx1 - 0.08, y1: 0.22 };
        if (metBorder) kern.plek.border = [bx0 + 0.17, (gy0 + 0.95 + gy1) / 2, 0.25];
        kern.plek.gazon = [(gazon.x0 + gazon.x1) / 2 - 0.25, (gazon.y0 + gazon.y1) / 2, 0.05];
        const borderLampen = metBorder ? (t.borderLampen ?? []) : [];
        /*
         * Brandt een lamp van de border, dan kleurt zijn stuk border mee: een gloed
         * over de aarde en over de planten. Eén lamp in Home
         * Assistant is vaak een groep wandlampen; die verlicht de hele border.
         */
        const by0 = gy0 + 0.95;
        const by1 = gy1 - 0.08;
        borderLampen.slice(0, 6).forEach((l, i, alle) => {
          if (!l.aan) return;
          const kleur = l.kleur ?? '#FFD39A';
          const y0 = by0 + ((by1 - by0) * i) / alle.length;
          const y1 = by0 + ((by1 - by0) * (i + 1)) / alle.length;
          kern.grond.push(`<g filter="url(#${kern.id}-zacht)" opacity="0.5">${kern.poly([[bx0 - 0.04, y0, 0.005], [gx1 - 0.06, y0, 0.005], [gx1 - 0.06, y1, 0.005], [bx0 - 0.04, y1, 0.005]], `style="fill: ${kleur}" fill-opacity="0.35"`)}</g>`);
          for (let y = y0 + 0.2; y < y1 - 0.05; y += 0.38) {
            dingen.push([y + 0.2, () => {
              const c = kern.P(bx0 + 0.17, y, 0.16);
              kern.buiten.push(`<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(kern.k * 0.26).toFixed(1)}" ry="${(kern.k * 0.18).toFixed(1)}" style="fill: ${kleur}" opacity="0.22" filter="url(#${kern.id}-zacht)"/>`);
            }]);
          }
        });
        borderLampen.slice(0, 6).forEach((l, i, alle) => {
          const y = gy0 + 1.25 + ((gy1 - 0.35 - (gy0 + 1.25)) * (i + 0.5)) / alle.length;
          const x = bx0 + 0.1 + (i % 2) * 0.14;
          dingen.push([y + 0.01, () => {
            kern.buiten.push(kern.doos(x - 0.02, y - 0.02, 0, 0.04, 0.04, 0.16, ['#56636f', '#47525d', '#3b4651']));
            const kop = kern.P(x, y, 0.18);
            kern.buiten.push(`<circle cx="${kop[0].toFixed(1)}" cy="${kop[1].toFixed(1)}" r="${(kern.k * 0.065).toFixed(1)}" fill="${l.aan ? l.kleur ?? '#FFD39A' : '#3c4755'}"/>`);
            if (l.aan) {
              const voet = kern.P(x, y, 0.01);
              kern.buiten.push(`<ellipse cx="${voet[0].toFixed(1)}" cy="${voet[1].toFixed(1)}" rx="${(kern.k * 0.4).toFixed(1)}" ry="${(kern.k * 0.18).toFixed(1)}" fill="${l.kleur ?? '#FFD39A'}" opacity="0.4" filter="url(#${kern.id}-zacht)"/>`);
              kern.buiten.push(`<circle cx="${kop[0].toFixed(1)}" cy="${kop[1].toFixed(1)}" r="${(kern.k * 0.12).toFixed(1)}" fill="${l.kleur ?? '#FFD39A'}" opacity="0.3" filter="url(#${kern.id}-zacht)"/>`);
            }
          }]);
        });
        let z3 = 7;
        const rnd3 = () => ((z3 = (z3 * 16807) % 2147483647) / 2147483647);
        for (let y = gy0 + 1.1; metBorder && y < gy1 - 0.15; y += 0.3) {
          const x = bx0 + 0.17 + (rnd3() - 0.5) * 0.08;
          const s = 0.8 + rnd3() * 0.45;
          dingen.push([y, () => struik(x, y, s, bloemen, sneeuw)]);
        }
        // Het terras tegen de gevel, voorin.
        // Niet tegen de gevel: daar staat de buitenunit.
        const ter = { x0: kern.W + 0.5, x1: kern.W + 1.5, y0: 0.35, y1: gy1 - 0.05 };
        kern.plek.terras = [(ter.x0 + ter.x1) / 2, (ter.y0 + ter.y1) / 2, 0.45];
        const terrasEr = !!kern.model.terras || t.terras !== false;
        if (terrasEr) {
          kern.grond.push(kern.poly([[ter.x0, ter.y0, 0.006], [ter.x1, ter.y0, 0.006], [ter.x1, ter.y1, 0.006], [ter.x0, ter.y1, 0.006]], `fill="${sneeuw ? '#e6ecf2' : kern.licht ? '#c3cad2' : '#3b4652'}"`));
          for (let x = ter.x0 + 0.3; x < ter.x1 - 0.05; x += 0.3) kern.grond.push(kern.line([[x, ter.y0, 0.008], [x, ter.y1, 0.008]], 'stroke="#2c353f" stroke-width="1"'));
          for (let y = ter.y0 + 0.3; y < ter.y1 - 0.05; y += 0.3) kern.grond.push(kern.line([[ter.x0, y, 0.008], [ter.x1, y, 0.008]], 'stroke="#2c353f" stroke-width="1"'));
          const tx = (ter.x0 + ter.x1) / 2 - 0.22;
          const ty = (ter.y0 + ter.y1) / 2 - 0.15;
          dingen.push([ty, () => {
            for (const sx of [tx - 0.3, tx + 0.52]) kern.buiten.push(kern.doos(sx, ty + 0.07, 0, 0.2, 0.22, 0.24, ['#55626f', '#46525f', '#3a4552']));
            kern.buiten.push(kern.doos(tx + 0.19, ty + 0.15, 0, 0.06, 0.06, 0.38, ['#7d8a97', '#6b7885', '#5d6976']));
            kern.buiten.push(kern.doos(tx, ty, 0.38, 0.44, 0.36, 0.05, ['#c9d3dc', '#9aa7b4', '#7d8a97']));
            if (kern.model.terras?.lampAan || t.terrasAan) {
              const c = kern.P(tx + 0.22, ty + 0.18, 0.43);
              kern.buiten.push(`<ellipse cx="${c[0]}" cy="${c[1]}" rx="${kern.k * 0.55}" ry="${kern.k * 0.25}" fill="#FFD39A" opacity="0.25" filter="url(#${kern.id}-zacht)"/>`);
            }
          }]);
        }
        // Het pad van stapstenen, van het terras naar het tuinhuis, met tuinlampjes ernaast.
        for (let y = 0.2; y > gy0 + 0.95; y -= 0.32) {
          const st = [[padX - 0.13, y - 0.1, 0.007], [padX + 0.13, y - 0.1, 0.007], [padX + 0.13, y + 0.1, 0.007], [padX - 0.13, y + 0.1, 0.007]];
          kern.grond.push(kern.poly(st, `fill="${sneeuw ? '#ffffff' : '#9aa7b4'}" opacity="${sneeuw ? 0.9 : 0.55}"`));
        }
        const padAan = (t.lampen ?? []).some((l) => l.aan) || t.padAan;
        const padKleur = (t.lampen ?? []).find((l) => l.aan)?.kleur ?? '#FFD39A';
        for (let y = 0.05, i = 0; y > gy0 + 1.0; y -= 0.55, i++) {
          const lx = padX + (i % 2 === 0 ? 0.24 : -0.24);
          dingen.push([y, () => {
            kern.buiten.push(kern.doos(lx - 0.03, y - 0.03, 0, 0.06, 0.06, 0.2, ['#6b7a8a', '#56636f', '#47525d']));
            const kop = kern.P(lx, y, 0.22);
            kern.buiten.push(`<circle cx="${kop[0]}" cy="${kop[1]}" r="${(kern.k * 0.045).toFixed(1)}" fill="${padAan ? padKleur : '#3c4755'}"/>`);
            if (padAan) {
              const voet = kern.P(lx, y, 0.01);
              kern.buiten.push(`<ellipse cx="${voet[0]}" cy="${voet[1]}" rx="${(kern.k * 0.3).toFixed(1)}" ry="${(kern.k * 0.13).toFixed(1)}" fill="${padKleur}" opacity="0.35" filter="url(#${kern.id}-zacht)"/>`);
            }
          }]);
        }
        // De jacuzzi op een vlonder, in het midden.
        if (t.jacuzzi) {
          const vx0 = kern.W + 0.45;
          const vx1 = kern.W + 1.45;
          const vy0 = -1.3;
          const vy1 = -0.25;
          dingen.push([vy0, () => {
            kern.buiten.push(kern.doos(vx0, vy0, 0, vx1 - vx0, vy1 - vy0, 0.06, [sneeuw ? '#eef3f8' : '#a07a54', '#7d5c3e', '#6b4e35']));
            if (!sneeuw) for (let x = vx0 + 0.1; x < vx1 - 0.02; x += 0.1) kern.buiten.push(kern.line([[x, vy0, 0.061], [x, vy1, 0.061]], 'stroke="#7d5c3e" stroke-width="0.8" stroke-opacity="0.7"'));
            kern.bouwJacuzzi(t.jacuzzi, (vx0 + vx1) / 2, (vy0 + vy1) / 2, 0.38, 0.06);
          }]);
        }
        // Het tuinhuis achterin, met de deur naar het pad.
        // Een schuurtje met puntdak, of een tuinhuis met plat dak en overstek.
        /*
         * Allebei: het schuurtje links, het tuinhuis rechts aan het
         * pad. De lampen, de panelen en de tik horen bij het huisje uit Home
         * Assistant (`huisjeVanHA`); het andere staat er alleen.
         */
        const allebei = () => {
          const vanHA = t.huisjeVanHA === 'schuur' ? 'schuur' : 'tuinhuis';
          const alleen = { ...t, tuinhuisAan: false, overstekAan: false, overstekLampen: [], tuinhuisPanelen: 0 };
          tuinhuis3(kern.W + 0.28, gy0 + 0.02, vanHA === 'schuur' ? t : alleen);
          const schuurVak = kern.tuinhuisVak;
          const schuurPlek = kern.plek.tuinhuis;
          tuinhuisPlat(kern.W + 1.38, gy0 + 0.02, vanHA === 'schuur' ? alleen : t);
          if (vanHA === 'schuur') {
            kern.tuinhuisVak = schuurVak;
            kern.plek.tuinhuis = schuurPlek;
          }
        };
        if (t.tuinhuis !== false) dingen.push([gy0, () => (t.tuinhuisSoort === 'beide' ? allebei() : t.tuinhuisSoort === 'schuur' ? tuinhuis3(padX - 0.5, gy0 + 0.02, t) : tuinhuisPlat(padX - 0.55, gy0 + 0.02, t))]);
        dingen.sort((a, b) => a[0] - b[0]).forEach(([, teken]) => teken());
        // De gekozen zone (`zone`) licht op (schets Wand-Huis-Ligging): na een tik, met zijn kaartje ernaast.
        kern.tuinVakken = { ...(metBorder ? { border: { x0: bx0 - 0.04, y0: gy0 + 0.9, x1: gx1 + 0.02, y1: gy1 - 0.04 } } : {}), ...(terrasEr ? { terras: ter } : {}), gazon, tuinhuis: kern.tuinhuisVak, overstek: kern.tuinhuisVak };
        const vak = kern.tuinVakken[t.zone];
        if (vak) markeer(vak);
      }
      /** Een plek op de grond die oplicht: een rand in ijsblauw met een gloed (schets Wand-Huis-Ligging). */
      function markeer(v) {
        const rand = [[v.x0, v.y0, 0.012], [v.x1, v.y0, 0.012], [v.x1, v.y1, 0.012], [v.x0, v.y1, 0.012]];
        kern.grond.push(`<g filter="url(#${kern.id}-zacht)" opacity="0.7">${kern.poly(rand, `fill="none" stroke="${kern.KLEUR.ijs}" stroke-width="5"`)}</g>`);
        kern.grond.push(kern.poly(rand, `fill="${kern.KLEUR.ijs}" fill-opacity="0.12" stroke="${kern.KLEUR.ijs}" stroke-width="2" stroke-linejoin="round"`));
      }
      /** Een struik in de border: twee bollen, met bloemen of bladeren in het seizoen (huis 3.0). */
      function struik(x, y, s, bloemen, sneeuw) {
        const gid = `${kern.id}-struik`;
        if (!kern.defs.some((d) => d.includes(`id="${gid}"`))) kern.defs.push(`<radialGradient id="${gid}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="${kern.nacht ? '#2f5a45' : kern.winter ? '#4a5d55' : '#5fae7a'}"/><stop offset="1" stop-color="${kern.nacht ? '#1b3a2c' : kern.winter ? '#2f3d38' : '#2f6446'}"/></radialGradient>`);
        for (const [dx, dz, r] of [[-0.05, 0.1, 0.11], [0.05, 0.14, 0.09]]) {
          const c = kern.P(x + dx * s, y, dz * s);
          kern.buiten.push(`<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(kern.k * r * s).toFixed(1)}" fill="url(#${gid})"/>`);
          if (sneeuw) kern.buiten.push(`<ellipse cx="${c[0].toFixed(1)}" cy="${(c[1] - kern.k * r * s * 0.5).toFixed(1)}" rx="${(kern.k * r * s * 0.7).toFixed(1)}" ry="${(kern.k * r * s * 0.3).toFixed(1)}" fill="#f4f7fa"/>`);
        }
        if (bloemen) {
          for (let i = 0; i < 3; i++) {
            const c = kern.P(x + (i - 1) * 0.06 * s, y + 0.02, (0.16 + (i % 2) * 0.06) * s);
            kern.buiten.push(`<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(kern.k * 0.022).toFixed(1)}" fill="${bloemen[(Math.round(y * 10) + i) % bloemen.length]}"/>`);
          }
        }
      }
      /**
       * Het tuinhuis (huis 3.0): houten planken, een puntdak met overstek, een
       * deur met een raampje naar het pad, een raam aan de zijkant met een
       * bloembak, en een lamp boven de deur. Panelen op het dakvlak, als die er
       * liggen.
       */
      /**
       * Het tuinhuis: een strakke doos met een plat dak dat aan
       * de voorkant uitsteekt als overstek, op twee palen, met een vlonder eronder,
       * een glazen pui en een lamp onder het overstek. Panelen liggen op rekken op
       * het dak. Het houten huisje met puntdak is het schuurtje (`tuinhuisSoort: 'schuur'`).
       */
      function tuinhuisPlat(tx, ty, t) {
        const b = 1.08;
        const d = 0.72;
        const h = 0.8;
        const dik = 0.07;
        const over = 0.34;
        const sneeuw = kern.model.weer === 'sneeuw';
        const aan = t.tuinhuisAan;
        const lampAan = t.overstekAan || aan;
        const gevel = kern.licht ? ['#e9e3d8', '#d8d0c2', '#c4baa9'] : ['#3c4654', '#323b47', '#2a323c'];
        const latten = kern.licht ? '#bfb4a2' : '#262e38';
        kern.buiten.push(`<g filter="url(#${kern.id}-zacht)" opacity="0.35">${kern.poly([[tx - 0.06, ty, 0], [tx + b + 0.3, ty, 0], [tx + b + 0.3, ty + d + over + 0.2, 0], [tx - 0.06, ty + d + over + 0.2, 0]], 'fill="#02050a"')}</g>`);
        // De vlonder onder het overstek.
        kern.buiten.push(kern.doos(tx - 0.02, ty + d, 0, b + 0.04, over, 0.04, ['#8a6a4a', '#74583d', '#5e4732']));
        for (let x = tx + 0.08; x < tx + b; x += 0.1) kern.buiten.push(kern.line([[x, ty + d + 0.01, 0.041], [x, ty + d + over - 0.01, 0.041]], 'stroke="#5e4732" stroke-width="0.8" stroke-opacity="0.8"'));
        // Het huis zelf: donker (of licht) met liggende latten.
        kern.buiten.push(kern.doos(tx, ty, 0, b, d, h, gevel));
        for (let z = 0.1; z < h - 0.02; z += 0.075) {
          kern.buiten.push(kern.line([[tx + 0.01, ty + d + 0.001, z], [tx + b - 0.01, ty + d + 0.001, z]], `stroke="${latten}" stroke-width="0.7" stroke-opacity="0.8"`));
          kern.buiten.push(kern.line([[tx + b + 0.001, ty + 0.01, z], [tx + b + 0.001, ty + d - 0.01, z]], `stroke="${latten}" stroke-width="0.7" stroke-opacity="0.6"`));
        }
        // De glazen pui: een schuifdeur en een groot raam, met licht als er iemand is.
        const glas = aan ? '#F4C27E' : kern.nacht ? '#0f1a2a' : '#4d7eac';
        const pui = [[tx + 0.12, ty + d + 0.002, 0.05], [tx + b - 0.12, ty + d + 0.002, 0.05], [tx + b - 0.12, ty + d + 0.002, h - 0.1], [tx + 0.12, ty + d + 0.002, h - 0.1]];
        kern.buiten.push(kern.poly(pui, `fill="${glas}" stroke="#1c232c" stroke-width="1.4"`));
        if (aan) {
          kern.buiten.push(`<g filter="url(#${kern.id}-zacht)" opacity="0.7">${kern.poly(pui, 'fill="#FFB765"')}</g>`);
          // Het licht van binnen valt door de pui naar buiten, over de vlonder en het gras.
          kern.grond.push(`<g filter="url(#${kern.id}-zacht)" opacity="0.9">${kern.poly([[tx + 0.05, ty + d, 0.005], [tx + b - 0.05, ty + d, 0.005], [tx + b + 0.3, ty + d + over + 0.95, 0.005], [tx - 0.3, ty + d + over + 0.95, 0.005]], 'fill="#FFB765" fill-opacity="0.8"')}</g>`);
          const pk = kern.P(tx + b / 2, ty + d + 0.15, h * 0.45);
          kern.buiten.push(`<ellipse cx="${pk[0].toFixed(1)}" cy="${pk[1].toFixed(1)}" rx="${(kern.k * 0.75).toFixed(1)}" ry="${(kern.k * 0.45).toFixed(1)}" fill="#FFB765" opacity="0.3" filter="url(#${kern.id}-zacht)"/>`);
        }
        if (!aan && !kern.nacht) kern.buiten.push(kern.poly([pui[0], [tx + 0.4, ty + d + 0.002, 0.05], [tx + 0.2, ty + d + 0.002, h - 0.1]], 'fill="#ffffff" opacity="0.12"'));
        for (const x of [tx + b * 0.42, tx + b * 0.7]) kern.buiten.push(kern.line([[x, ty + d + 0.003, 0.05], [x, ty + d + 0.003, h - 0.1]], 'stroke="#1c232c" stroke-width="1.4"'));
        // Een smal raam in de zijkant.
        const zij = [[tx + b + 0.002, ty + 0.2, 0.42], [tx + b + 0.002, ty + 0.52, 0.42], [tx + b + 0.002, ty + 0.52, 0.62], [tx + b + 0.002, ty + 0.2, 0.62]];
        kern.buiten.push(kern.poly(zij, `fill="${glas}" stroke="#1c232c" stroke-width="1"`));
        // De palen van het overstek, voor de pui.
        for (const x of [tx + 0.02, tx + b - 0.06]) kern.buiten.push(kern.doos(x, ty + d + over - 0.06, 0.04, 0.04, 0.04, h - 0.04, ['#2a323c', '#20272f', '#1a2027']));
        // Het platte dak, met het overstek naar voren; panelen of sneeuw erop.
        kern.buiten.push(kern.doos(tx - 0.05, ty - 0.05, h, b + 0.1, d + over + 0.05, dik, [sneeuw ? '#eef3f8' : kern.licht ? '#5b6672' : '#4a5562', '#1f262e', '#262e37']));
        /*
         * Twee spots onder het overstek: elk schijnt omlaag in een
         * bundel, in de kleur van zijn lamp, met een plas licht op de vlonder. Met
         * één lamp in Home Assistant schijnen ze samen; zonder lamp onder het
         * overstek gaan ze mee met het licht binnen.
         */
        const spots = t.overstekLampen?.length ? t.overstekLampen : [{ aan: lampAan, kleur: t.overstekKleur ?? '#FFD39A' }];
        [0.27, 0.73].forEach((f, i) => {
          const s = spots[i] ?? spots[0];
          const kleur = s.kleur ?? '#FFD39A';
          const x = tx + b * f;
          const lamp = kern.P(x, ty + d + over - 0.1, h - 0.005);
          const voet = kern.P(x, ty + d + over * 0.55, 0.045);
          if (s.aan) {
            const rx = kern.k * 0.26;
            const ry = kern.k * 0.1;
            kern.buiten.push(`<defs><linearGradient id="${kern.id}-spot${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color: ${kleur}" stop-opacity="0.75"/><stop offset="1" style="stop-color: ${kleur}" stop-opacity="0.08"/></linearGradient></defs>`);
            kern.buiten.push(`<polygon points="${[[lamp[0] - kern.k * 0.025, lamp[1]], [lamp[0] + kern.k * 0.025, lamp[1]], [voet[0] + rx, voet[1]], [voet[0] - rx, voet[1]]].map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="url(#${kern.id}-spot${i})" opacity="0.8" filter="url(#${kern.id}-zacht)"/>`);
            kern.buiten.push(`<ellipse cx="${voet[0].toFixed(1)}" cy="${voet[1].toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" style="fill: ${kleur}" opacity="0.75" filter="url(#${kern.id}-zacht)"/>`);
            // En een plas in zijn kleur op het gras voor het tuinhuis, zodat je het ook klein ziet.
            const plas = kern.P(x, ty + d + over + 0.3, 0.005);
            kern.grond.push(`<ellipse cx="${plas[0].toFixed(1)}" cy="${plas[1].toFixed(1)}" rx="${(kern.k * 0.5).toFixed(1)}" ry="${(kern.k * 0.22).toFixed(1)}" style="fill: ${kleur}" opacity="0.45" filter="url(#${kern.id}-zacht)"/>`);
          }
          kern.buiten.push(`<rect x="${(lamp[0] - kern.k * 0.03).toFixed(1)}" y="${(lamp[1] - kern.k * 0.012).toFixed(1)}" width="${(kern.k * 0.06).toFixed(1)}" height="${(kern.k * 0.024).toFixed(1)}" rx="${(kern.k * 0.01).toFixed(1)}" style="fill: ${s.aan ? kleur : '#55626f'}"/>`);
        });
        if (t.tuinhuisPanelen && !sneeuw) {
          kern.plaatPanelen(tx + 0.04, ty, b - 0.08, d + 0.1, h + dik, Math.min(6, t.tuinhuisPanelen));
          kern.plek.panelenSchuur = [tx + b / 2, ty + d / 2, h + dik + 0.1];
        }
        kern.plek.tuinhuis = [tx + b / 2, ty + d / 2, h + dik];
        kern.tuinhuisVak = { x0: tx - 0.1, y0: ty - 0.1, x1: tx + b + 0.1, y1: ty + d + over, h: h + dik + 0.1 };
      }
      /** Het schuurtje: het houten huisje met puntdak (het tuinhuis van huis 3.0 tot 24 oktober 2026). */
      function tuinhuis3(tx, ty, t) {
        const b = 1.0;
        const d = 0.85;
        const h = 0.7;
        const nok = 1.08;
        const sneeuw = kern.model.weer === 'sneeuw';
        const hout = kern.licht ? ['#b08a62', '#9a7552', '#86643f'] : ['#8a6a4a', '#74583d', '#5e4732'];
        const aan = t.tuinhuisAan;
        kern.buiten.push(`<g filter="url(#${kern.id}-zacht)" opacity="0.35">${kern.poly([[tx - 0.05, ty, 0], [tx + b + 0.25, ty, 0], [tx + b + 0.25, ty + d + 0.2, 0], [tx - 0.05, ty + d + 0.2, 0]], 'fill="#02050a"')}</g>`);
        // Het linker dakvlak eerst: daar zie je alleen de rand van.
        kern.buiten.push(kern.poly([[tx - 0.08, ty - 0.08, h - 0.04], [tx + b / 2, ty - 0.08, nok], [tx + b / 2, ty + d + 0.1, nok], [tx - 0.08, ty + d + 0.1, h - 0.04]], `fill="${sneeuw ? '#d6dee7' : '#2c3542'}"`));
        kern.buiten.push(kern.doos(tx, ty, 0, b, d, h, [hout[0], hout[1], hout[2]]));
        // De planken: verticale lijnen op de voorkant en de zijkant.
        for (let x = tx + 0.1; x < tx + b - 0.02; x += 0.1) kern.buiten.push(kern.line([[x, ty + d + 0.001, 0.02], [x, ty + d + 0.001, h]], `stroke="${hout[2]}" stroke-width="0.8" stroke-opacity="0.8"`));
        for (let y = ty + 0.1; y < ty + d - 0.02; y += 0.1) kern.buiten.push(kern.line([[tx + b + 0.001, y, 0.02], [tx + b + 0.001, y, h]], 'stroke="#4a3828" stroke-width="0.8" stroke-opacity="0.7"'));
        // De punt boven de deur.
        kern.buiten.push(kern.poly([[tx, ty + d, h], [tx + b, ty + d, h], [tx + b / 2, ty + d, nok - 0.02]], `fill="${hout[1]}"`));
        // De deur met een raampje, en een lamp erboven.
        const dx0 = tx + b / 2 - 0.13;
        kern.buiten.push(kern.poly([[dx0, ty + d + 0.002, 0.01], [dx0 + 0.26, ty + d + 0.002, 0.01], [dx0 + 0.26, ty + d + 0.002, 0.56], [dx0, ty + d + 0.002, 0.56]], `fill="${hout[2]}" stroke="#3e2f22" stroke-width="1"`));
        kern.buiten.push(kern.poly([[dx0 + 0.07, ty + d + 0.003, 0.38], [dx0 + 0.19, ty + d + 0.003, 0.38], [dx0 + 0.19, ty + d + 0.003, 0.5], [dx0 + 0.07, ty + d + 0.003, 0.5]], `fill="${aan ? '#F4C27E' : '#1b2633'}"`));
        const lamp = kern.P(tx + b / 2, ty + d + 0.04, 0.64);
        kern.buiten.push(`<circle cx="${lamp[0]}" cy="${lamp[1]}" r="${(kern.k * 0.035).toFixed(1)}" fill="${t.overstekAan || aan ? '#FFD39A' : '#55626f'}"/>`);
        if (t.overstekAan || aan) {
          const voet = kern.P(tx + b / 2, ty + d + 0.25, 0.01);
          kern.buiten.push(`<ellipse cx="${voet[0]}" cy="${voet[1]}" rx="${(kern.k * 0.45).toFixed(1)}" ry="${(kern.k * 0.2).toFixed(1)}" fill="#FFD39A" opacity="0.3" filter="url(#${kern.id}-zacht)"/>`);
        }
        // Een raam aan de zijkant, met een bloembak eronder.
        const raam = [[tx + b + 0.002, ty + 0.25, 0.3], [tx + b + 0.002, ty + 0.58, 0.3], [tx + b + 0.002, ty + 0.58, 0.55], [tx + b + 0.002, ty + 0.25, 0.55]];
        kern.buiten.push(kern.poly(raam, `fill="${aan ? '#F4C27E' : kern.nacht ? '#0f1a2a' : '#4d7eac'}" stroke="#3e2f22" stroke-width="1"`));
        if (aan) kern.buiten.push(`<g filter="url(#${kern.id}-zacht)" opacity="0.5">${kern.poly(raam, 'fill="#FFB765"')}</g>`);
        kern.buiten.push(kern.doos(tx + b, ty + 0.23, 0.22, 0.06, 0.37, 0.07, ['#5e4732', '#4a3828', '#6b4e35']));
        if (!kern.winter && !sneeuw) for (let i = 0; i < 4; i++) {
          const c = kern.P(tx + b + 0.04, ty + 0.28 + i * 0.09, 0.31);
          kern.buiten.push(`<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(kern.k * 0.025).toFixed(1)}" fill="${['#f2a7c3', '#f6d36b', '#e8634a', '#ffffff'][i]}"/>`);
        }
        // Het rechter dakvlak, met overstek; panelen of sneeuw erop.
        const q = (u, v) => [tx + b / 2 + u * (b / 2 + 0.08), ty - 0.08 + v * (d + 0.18), nok - u * (nok - h + 0.04) + 0.005];
        kern.buiten.push(kern.poly([q(0, 0), q(1, 0), q(1, 1), q(0, 1)], `fill="${sneeuw ? '#eef3f8' : '#3b4654'}"`));
        kern.buiten.push(kern.line([q(1, 0), q(1, 1)], 'stroke="#2a323d" stroke-width="1.5"'));
        if (t.tuinhuisPanelen && !sneeuw) {
          const n = Math.max(1, Math.min(6, Math.round(t.tuinhuisPanelen)));
          for (let i = 0; i < n; i++) {
            const v0 = 0.08 + (i * 0.84) / n;
            const v1 = v0 + 0.84 / n - 0.03;
            const pan = [q(0.12, v0), q(0.9, v0), q(0.9, v1), q(0.12, v1)].map(([x, y, z]) => [x, y, z + 0.01]);
            kern.buiten.push(kern.poly(pan, `fill="url(#${kern.id}-paneel)" stroke="#5b7aa0" stroke-opacity="0.7" stroke-width="0.8"`));
          }
          kern.plek.panelenSchuur = q(0.5, 0.5);
        }
        kern.plek.tuinhuis = [tx + b / 2, ty + d / 2, nok];
        kern.tuinhuisVak = { x0: tx - 0.1, y0: ty - 0.1, x1: tx + b + 0.1, y1: ty + d + 0.1, h: nok + 0.05 };
      }
      function schaduw(hex, f) {
        const n = parseInt(hex.slice(1), 16);
        const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
        return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
      }

    return { kompas, omhulsel, boom, lantaarn, bouwTuin3, schaduw };
  };
})(window);
