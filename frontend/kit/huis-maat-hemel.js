/*
 * SunArc: het huis zoals getekend, de lucht (22 november 2026, opgesplitst uit kit/huis-maat.js).
 *
 * Het weer over het huis (regen, sneeuw), de feestdag (kerst, Halloween, Oud en Nieuw, Pasen), de hemel achter
 * het huis en de zonneboog om het huis.
 *
 * global.huisMaatHemel(kern) maakt dit deel voor één tekenaar; `kern` geeft wat de tekenaar deelt (zie maak() in huistekenen.js).
 */
(function (global) {
  'use strict';

  global.huisMaatHemel = function (kern) {
      /*
       * Het weer over het huis (22 november 2026, zoals in het poppenhuis): regen als schuine streepjes, sneeuw als vlokjes;
       * vaste plekken, en ze bewegen alleen als er geen rust is gevraagd.
       */
      const weerLaag = () => {
        if (kern.o.weer !== 'regen' && kern.o.weer !== 'sneeuw') return '';
        let zaad = 5;
        const rnd = () => ((zaad = (zaad * 16807) % 2147483647) / 2147483647);
        let x2 = '';
        const regen = kern.o.weer === 'regen';
        for (let i = 0; i < (regen ? 70 : 60); i++) {
          const [x, y] = [rnd() * kern.B, rnd() * kern.Hpx * 0.85];
          x2 += regen ? `<path d="M${x.toFixed(0)} ${y.toFixed(0)}l-3 10" stroke="#9fb3c8" stroke-opacity="0.45" stroke-width="1.2" stroke-linecap="round"/>` : `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(1 + rnd() * 1.4).toFixed(1)}" fill="#f4f7fa" opacity="0.8"/>`;
        }
        const beweeg = kern.o.stil ? '' : `<animateTransform attributeName="transform" type="translate" values="0 0;${regen ? '-6 18' : '-4 12'}" dur="${regen ? '0.7s' : '3s'}" repeatCount="indefinite"/>`;
        return `<g pointer-events="none">${x2}${beweeg}</g>`;
      };
      /**
       * De feestdag (22 november 2026, zoals in het poppenhuis; `o.feest`): met Kerst lichtjes langs de goot, met Halloween een
       * pompoen bij de voordeur, met Oud en Nieuw vuurwerk in de lucht, met Pasen eieren in het gras.
       */
      const feestLaag = () => {
        const f = kern.o.feest;
        if (!f || kern.eenEtage >= 0) return '';
        let x2 = '';
        const deur = kern.o.voordeur;
        if (f === 'kerst' && kern.metDak) {
          const KL = ['#ff5a5a', '#6ee7b7', '#ffd36b', '#6fd3ff'];
          let vorige = null;
          for (let x = kern.X0 + 0.15, i = 0; x <= kern.X1 - 0.1; x += 0.32, i++) {
            const z = Math.min(kern.dakZ(x, kern.Y0 + 0.02), kern.lagen.at(-1)?.top ?? 5) - 0.06;
            const q = kern.P(x, kern.Y0 - 0.03, z - (i % 2 ? 0.06 : 0.02));
            if (vorige) x2 += `<path d="M${vorige[0].toFixed(1)} ${vorige[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}" stroke="#2c3646" stroke-width="0.8"/>`;
            if (kern.o.avond) x2 += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="5" fill="url(#hm-gloed)" opacity="0.45"/>`;
            x2 += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="2.2" fill="${KL[i % KL.length]}"/>`;
            vorige = q;
          }
        }
        if (f === 'halloween' && deur) {
          const [nx, ny] = deur.n ?? [0, -1];
          // Tegen de gevel naast de deur; staat daar de auto (een voordeur aan de oprit), dan op de hoek van de voorgevel.
          const au = kern.buiten.auto;
          const bijAuto = au && deur.x > au.x - 1.5 && deur.x < au.x + au.b + 1.5 && deur.y > au.y - 1.5 && deur.y < au.y + au.d + 1.5;
          const c = bijAuto ? kern.P(kern.X1 - 0.5, kern.Y0 - 0.35, 0.18) : kern.P(deur.x + nx * 0.25 + (ny ? 0.75 : 0), deur.y + ny * 0.25 + (nx ? 0.75 : 0), 0.18);
          const r = Math.max(5, 0.22 * kern.k);
          x2 += `<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(r * 1.2).toFixed(1)}" ry="${r.toFixed(1)}" fill="#f08a2e" stroke="#b8601c" stroke-width="0.8"/><path d="M${c[0].toFixed(1)} ${(c[1] - r).toFixed(1)}l1 -${(r * 0.4).toFixed(1)}" stroke="#4f6d34" stroke-width="2"/>`;
          if (kern.o.avond) x2 += `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(r * 2).toFixed(1)}" fill="url(#hm-gloed)" opacity="0.4"/>`;
        }
        if (f === 'oudnieuw') {
          for (const [fx, fy, kl] of /** @type {[number, number, string][]} */ ([[0.22, 0.16, '#ff8fb1'], [0.76, 0.1, '#ffd36b'], [0.5, 0.24, '#6fd3ff']])) {
            const [cx2, cy2] = [kern.B * fx, kern.Hpx * fy];
            for (let i = 0; i < 12; i++) {
              const h = (i / 12) * Math.PI * 2;
              x2 += `<path d="M${(cx2 + Math.cos(h) * 6).toFixed(1)} ${(cy2 + Math.sin(h) * 6).toFixed(1)}L${(cx2 + Math.cos(h) * 22).toFixed(1)} ${(cy2 + Math.sin(h) * 22).toFixed(1)}" stroke="${kl}" stroke-width="1.6" stroke-linecap="round" opacity="0.85"/>`;
            }
          }
        }
        if (f === 'pasen' && deur) {
          const [nx, ny] = deur.n ?? [0, -1];
          [['#ff8fb1', -0.8], ['#ffd36b', -0.3], ['#6fd3ff', 0.4], ['#b59cff', 0.9]].forEach(([kl, a]) => {
            const c = kern.P(deur.x + nx * 1.6 + (ny ? a : 0), deur.y + ny * 1.6 + (nx ? a : 0), 0.08);
            x2 += `<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${Math.max(2.5, 0.08 * kern.k).toFixed(1)}" ry="${Math.max(3.4, 0.11 * kern.k).toFixed(1)}" fill="${kl}"/>`;
          });
        }
        return `<g pointer-events="none">${x2}</g>`;
      };
      // De hemel achter het huis: de maan en de sterren, of de zon (eerst, zodat alles erover valt).
      if (kern.o.hemel) kern.s += kern.hemel(kern.o.hemel);
      /**
       * De zonneboog zoals in het poppenhuis: een stippellijn, een stip per uur met om de drie uur het uur erbij, aan de
       * uiteinden een halve zon met de tijd van opkomst (↑) en ondergang (↓), en de zon van nu met stralen en een bundel
       * licht naar het huis. Het stuk achter het huis eerst, het stuk ervoor als laatste.
       */
      const zonneboog = (achter) => {
        if (!kern.zb) return '';
        const mid = kern.diep(kern.cx, kern.cy);
        const pp = kern.zb.baan.filter((q) => q.el > -1.5).map((q) => ({ q, w: kern.ringPunt(q) }));
        const isAchter = (w) => kern.diep(w[0], w[1]) > mid;
        let x2 = '';
        for (let i = 0; i + 1 < pp.length; i++) {
          const [a, b] = [pp[i].w, pp[i + 1].w];
          if (isAchter([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]) !== achter) continue;
          x2 += `<path d="M${kern.pt(...a)}L${kern.pt(...b)}" stroke="#f7b548" stroke-opacity="${achter ? 0.4 : 0.75}" stroke-width="1.5" stroke-dasharray="3 4" stroke-linecap="round"/>`;
        }
        const laatste = pp.length - 1;
        pp.forEach(({ q, w }, i) => {
          if (isAchter(w) !== achter) return;
          const p2 = kern.P(...w);
          const tekst = (t2, dy) => `<text x="${p2[0].toFixed(1)}" y="${(p2[1] + dy).toFixed(1)}" text-anchor="middle" ${kern.FONT} font-size="11" font-weight="700" fill="#f3d8a8" paint-order="stroke" stroke="#0d1a30" stroke-width="3" stroke-linejoin="round">${kern.esc(t2)}</text>`;
          if (q.klok && (i === 0 || i === laatste)) {
            // Een halve zon op de horizon, met de tijd.
            x2 += `<path d="M${(p2[0] - 8).toFixed(1)} ${p2[1].toFixed(1)}A8 8 0 0 1 ${(p2[0] + 8).toFixed(1)} ${p2[1].toFixed(1)}Z" fill="#f59a5b"/>`;
            x2 += tekst(`${i === 0 ? '↑' : '↓'} ${q.klok}`, 15);
          } else if (q.uur != null) {
            x2 += `<circle cx="${p2[0].toFixed(1)}" cy="${p2[1].toFixed(1)}" r="2.4" fill="#f7b548" opacity="${achter ? 0.55 : 0.95}"/>`;
            if (q.uur % 3 === 0) x2 += tekst(String(q.uur), -8);
          }
        });
        // De zon van nu en zijn bundel apart: die vervagen nooit onder de tekst (23 november 2026).
        let zonS = '';
        const nu = kern.zb.nu;
        if (nu && nu.el > -2) {
          const w = kern.ringPunt(nu);
          if (isAchter(w) === achter) {
            const p2 = kern.P(...w);
            // Een bundel licht van de zon naar het huis.
            // Naar het dak (de hoogte van de ring vóór hij boven het huis uit getild werd), niet naar de boog zelf.
            const doel = [kern.P(kern.X0, kern.cy, kern.ringZ0 - 3), kern.P(kern.X1, kern.cy, kern.ringZ0 - 3), kern.P(kern.cx, kern.cy, 0)];
            const [l, r] = doel.slice(0, 2).sort((a, b) => Math.atan2(a[1] - p2[1], a[0] - p2[0]) - Math.atan2(b[1] - p2[1], b[0] - p2[0]));
            zonS += `<defs><linearGradient id="hm-bundel" gradientUnits="userSpaceOnUse" x1="${p2[0].toFixed(1)}" y1="${p2[1].toFixed(1)}" x2="${doel[2][0].toFixed(1)}" y2="${doel[2][1].toFixed(1)}"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.32"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></linearGradient></defs>`;
            zonS += `<path d="M${p2[0].toFixed(1)} ${p2[1].toFixed(1)}L${l[0].toFixed(1)} ${l[1].toFixed(1)}L${doel[2][0].toFixed(1)} ${doel[2][1].toFixed(1)}L${r[0].toFixed(1)} ${r[1].toFixed(1)}Z" fill="url(#hm-bundel)"/>`;
            zonS += `<circle cx="${p2[0].toFixed(1)}" cy="${p2[1].toFixed(1)}" r="24" fill="#ffd27a" opacity="0.16"/>`;
            for (let i = 0; i < 12; i++) {
              const h = (i / 12) * 2 * Math.PI;
              zonS += `<path d="M${(p2[0] + Math.cos(h) * 11).toFixed(1)} ${(p2[1] + Math.sin(h) * 11).toFixed(1)}L${(p2[0] + Math.cos(h) * 15).toFixed(1)} ${(p2[1] + Math.sin(h) * 15).toFixed(1)}" stroke="#ffd27a" stroke-width="1.6" stroke-linecap="round"/>`;
            }
            zonS += `<circle cx="${p2[0].toFixed(1)}" cy="${p2[1].toFixed(1)}" r="8" fill="#ffd27a"/>`;
          }
        }
        /*
         * Onder de tekst bovenin (`o.vrij`, de kop op de wand) vervaagt de boog met een zachte rand (23 november 2026):
         * hij loopt er niet doorheen. Het masker staat één keer in de tekening.
         */
        const vrij = (kern.o.vrij ?? []).filter((v) => v && Number.isFinite(v.x0) && Number.isFinite(v.y1));
        if (!vrij.length || !x2) return x2 + zonS;
        let masker = '';
        if (!kern.zbMasker) {
          kern.zbMasker = true;
          masker = `<defs><filter id="hm-vrij-zacht" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter><mask id="hm-vrij" maskUnits="userSpaceOnUse" x="0" y="0" width="${kern.B}" height="${kern.Hpx}"><rect x="0" y="0" width="${kern.B}" height="${kern.Hpx}" fill="#fff"/>${vrij.map((v) => `<rect x="${(v.x0 - 14).toFixed(0)}" y="${(v.y0 - 12).toFixed(0)}" width="${(v.x1 - v.x0 + 28).toFixed(0)}" height="${(v.y1 - v.y0 + 24).toFixed(0)}" rx="16" fill="#000" filter="url(#hm-vrij-zacht)"/>`).join('')}</mask></defs>`;
        }
        return `${masker}<g mask="url(#hm-vrij)">${x2}</g>${zonS}`;
      };
      kern.s += zonneboog(true);
      // Het eiland: de zijkanten naar de kijker, dan het gras. Met een erf: een zachte schaduw, een randje gras en aarde in lagen.
      // Zonder eiland (een etage boven de begane grond zweeft, 21 november 2026).
      if (!kern.o.geenEiland) {
        const zijden = [];
        if (kern.erf) {
          const c = kern.P((kern.E0 + kern.E1) / 2, (kern.F0 + kern.F1) / 2, -kern.dikte - 0.4);
          kern.s += `<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(((kern.E1 - kern.E0) + (kern.F1 - kern.F0)) * 0.42 * kern.k).toFixed(1)}" ry="${(((kern.E1 - kern.E0) + (kern.F1 - kern.F0)) * 0.16 * kern.k).toFixed(1)}" fill="#000" opacity="0.28" filter="url(#hm-zacht)"/>`;
        }
        for (let i = 0; i < 4; i++) {
          const [a, b] = [kern.eiland[i], kern.eiland[(i + 1) % 4]];
          const n = [b[1] - a[1], -(b[0] - a[0])];
          if (!kern.naarKijker(n[0], n[1])) continue;
          if (!kern.erf) {
            zijden.push(`<path d="${kern.vlak([[...a, 0], [...b, 0], [...b, -0.7], [...a, -0.7]])}" fill="${i % 2 ? '#1a2a24' : '#14211d'}"/>`);
            continue;
          }
          const licht = Math.abs(n[0]) > Math.abs(n[1]);
          zijden.push(`<path d="${kern.vlak([[...a, -0.16], [...b, -0.16], [...b, -kern.dikte], [...a, -kern.dikte]])}" fill="url(#hm-aarde${licht ? '1' : '2'})"/>`);
          zijden.push(`<path d="${kern.vlak([[...a, 0], [...b, 0], [...b, -0.16], [...a, -0.16]])}" fill="${licht ? '#3f6f4c' : '#335c3f'}"/>`);
          // Een paar steentjes in de aarde.
          for (let j = 1; j < 6; j++) {
            const f = (j + 0.37 * ((i * 7 + j * 3) % 5) / 5) / 6.4;
            const q = kern.P(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, -0.5 - ((i + j * 2) % 3) * 0.28);
            zijden.push(`<ellipse cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" rx="${(0.16 * kern.k).toFixed(1)}" ry="${(0.09 * kern.k).toFixed(1)}" fill="#6b5442" opacity="0.55"/>`);
          }
        }
        kern.s += zijden.join('');
        kern.s += `<path d="${kern.vlak(kern.eiland.map(([x, y]) => [x, y, 0]))}" fill="#264233" stroke="rgb(110 231 183 / 0.22)"/>`;
        // De stoep aan de straatkant: tegels tot het erf.
        if (kern.erf) {
          kern.s += `<path d="${kern.vlak([[kern.E0, kern.F0, 0.01], [kern.E1, kern.F0, 0.01], [kern.E1, kern.erf.y - 0.05, 0.01], [kern.E0, kern.erf.y - 0.05, 0.01]])}" fill="#4f5a67" stroke="#6b7685" stroke-width="0.6"/>`;
          for (let x = kern.E0 + 1.2; x < kern.E1 - 0.2; x += 1.2) kern.s += `<path d="M${kern.pt(x, kern.F0, 0.012)}L${kern.pt(x, kern.erf.y - 0.05, 0.012)}" stroke="#66717e" stroke-width="0.6"/>`;
          kern.s += `<path d="M${kern.pt(kern.E0, kern.F0 + 0.35, 0.012)}L${kern.pt(kern.E1, kern.F0 + 0.35, 0.012)}" stroke="#8a95a2" stroke-width="1"/>`;
        }
      }
      // Buiten: eerst de grond (terras, oprit, border), dan wat achter het huis staat; wat ervoor staat komt na het huis.
      const GROND = { terras: ['#6a5f50', '#97866d'], oprit: ['#3c4655', '#5c6878'], pad: ['#4a5260', '#6b7686'], border: ['#2e5a3c', '#4f8a5f'], gras: ['#2f5a40', '#3f7352'] };
      for (const v of kern.buiten.vlakken ?? []) {
        const ta = kern.tikAttr(v.kamer, v.naam);
        if (ta) kern.tikLaag.push(`<path d="${kern.vlak(v.p.map(([x, y]) => [x, y, 0.02]))}" ${ta}/>`);
        const [vul, rand] = GROND[v.soort] ?? GROND.pad;
        kern.s += `<path d="${kern.vlak(v.p.map(([x, y]) => [x, y, 0.02]))}" fill="${vul}" stroke="${rand}" stroke-width="0.8"/>`;
        // Tegels op een terras en een oprit: een raster van lijnen, langs de assen.
        if (v.soort === 'terras' || v.soort === 'oprit') {
          const xs = v.p.map((q) => q[0]);
          const ys = v.p.map((q) => q[1]);
          const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
          const stap = v.soort === 'terras' ? 0.6 : 0.9;
          let lijnen = '';
          for (let x = x0 + stap; x < x1 - 0.05; x += stap) lijnen += `M${kern.pt(x, y0, 0.021)}L${kern.pt(x, y1, 0.021)}`;
          for (let y = y0 + stap; y < y1 - 0.05; y += stap) lijnen += `M${kern.pt(x0, y, 0.021)}L${kern.pt(x1, y, 0.021)}`;
          kern.s += `<path d="${lijnen}" stroke="${rand}" stroke-opacity="0.35" stroke-width="0.6"/>`;
        }
        if (v.soort === 'border') {
          /*
           * Struiken zoals in het poppenhuis (22 november 2026): een rij kleine struiken langs het midden van de border,
           * elk twee bollen, met bloemen in de lente en de zomer en bladkleur in de herfst; niet groter dan de border, zodat
           * er niets over de rand of door het hek steekt.
           */
          const [p0, p1, p2, p3] = v.p;
          const lang = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) >= Math.hypot(p3[0] - p0[0], p3[1] - p0[1]);
          const mid = (q, r) => [(q[0] + r[0]) / 2, (q[1] + r[1]) / 2];
          const [a, b] = lang ? [mid(p0, p3), mid(p1, p2)] : [mid(p0, p1), mid(p3, p2)];
          const breed = lang ? Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) : Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
          const r0 = Math.max(0.12, Math.min(0.3, breed * 0.32));
          const lengte = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const n = Math.max(2, Math.min(40, Math.round(lengte / (r0 * 1.9))));
          const seizoen = kern.o.seizoen ?? 'zomer';
          const blad = { herfst: ['#7a9a4a', '#4f6d34'], winter: ['#4a5d55', '#2f3d38'], lente: ['#6cbf7c', '#2f6446'], zomer: ['#5fae7a', '#2f6446'] }[seizoen] ?? ['#5fae7a', '#2f6446'];
          const bloemen = seizoen === 'lente' ? ['#f4c6d6', '#fff2a8', '#ffffff'] : seizoen === 'zomer' ? ['#ff8fb1', '#ffd36b', '#b59cff'] : seizoen === 'herfst' ? ['#f39a45', '#e07a2e'] : null;
          let zaad = 11;
          const rnd = () => ((zaad = (zaad * 16807) % 2147483647) / 2147483647);
          if (!kern.s.includes('id="hm-struik"')) kern.s += `<defs><radialGradient id="hm-struik" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="${blad[0]}"/><stop offset="1" stop-color="${blad[1]}"/></radialGradient></defs>`;
          for (let i = 0; i < n; i++) {
            const f = (i + 0.5) / n;
            const sc = 0.8 + rnd() * 0.4;
            const [cx2, cy2] = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
            for (const [dz, rr] of [[0.75, 1], [1.05, 0.8]]) {
              const q = kern.P(cx2, cy2, r0 * dz * sc);
              kern.s += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${(r0 * rr * sc * kern.k).toFixed(1)}" fill="url(#hm-struik)"/>`;
            }
            if (bloemen) {
              for (let j = 0; j < 3; j++) {
                const q = kern.P(cx2 + (j - 1) * r0 * 0.5, cy2, r0 * (1.2 + (j % 2) * 0.35) * sc);
                kern.s += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${Math.max(1.2, 0.05 * kern.k).toFixed(1)}" fill="${bloemen[(i + j) % bloemen.length]}"/>`;
              }
            }
          }
        }
      }

    return { weerLaag, feestLaag, zonneboog };
  };
})(typeof window !== 'undefined' ? window : globalThis);
