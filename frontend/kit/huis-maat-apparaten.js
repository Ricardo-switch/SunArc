/*
 * SunArc: het huis zoals getekend, de apparaten buiten (opgesplitst uit kit/huis-maat.js).
 *
 * Lampen in de tuin, de lampjes van de border, de lantaarn, de deurbel, camera, aansluitkast, thuisaccu en het
 * zonnescherm, elk op zijn plek en in de kleur van zijn lamp.
 *
 * global.huisMaatApparaten(kern) maakt dit deel voor één tekenaar; `kern` geeft wat de tekenaar deelt (zie maak() in huistekenen.js).
 */
(function (global) {
  'use strict';

  global.huisMaatApparaten = function (kern) {
      /** Een apparaat buiten (een lamp, de lampjes in de border, een lantaarn, de deurbel, een zonnescherm). */
      const buitenApparaat = (a) => {
        let x2 = '';
        const draait = kern.aan.has(a.id);
        if (a.soort === 'licht') {
          const v0 = kern.P(a.x, a.y, 0.02);
          if (draait) x2 += `<ellipse cx="${v0[0].toFixed(1)}" cy="${v0[1].toFixed(1)}" rx="${(1.1 * kern.k).toFixed(1)}" ry="${(1.1 * kern.k * kern.sp).toFixed(1)}" fill="${kern.o.lampKleur?.[a.id] ?? '#ffd9a0'}" fill-opacity="${kern.o.avond ? 0.3 : 0.1}"/>`;
          const z = a.z ?? 0.6;
          // Laag: een tuinlampje op een paaltje; hoog: een lamp aan de muur.
          if (z < 1.2) {
            const p0 = kern.P(a.x, a.y, 0);
            const p1 = kern.P(a.x, a.y, z);
            x2 += `<path d="M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}" stroke="#55606e" stroke-width="2"/>`;
          }
          const h = kern.P(a.x, a.y, z);
          if (draait && kern.o.avond) x2 += `<circle cx="${h[0].toFixed(1)}" cy="${h[1].toFixed(1)}" r="9" fill="url(#hm-gloed)" opacity="0.55"/>`;
          x2 += `<circle cx="${h[0].toFixed(1)}" cy="${h[1].toFixed(1)}" r="2.6" fill="${draait ? '#ffe2b0' : '#5c6876'}"/>`;
        } else if (a.soort === 'snoer') {
          // Lampjes langs de border: een snoer met bolletjes; aan geven ze een warm puntje licht.
          // Zoals in het poppenhuis: lampjes op een paaltje tussen de struiken, in de kleur van de lamp, met een gloed op de grond.
          const pp = a.punten ?? [];
          const lk = kern.o.lampKleur?.[a.id] ?? '#FFD39A';
          for (let i = 0; i + 1 < pp.length; i++) {
            const [p0, p1] = [pp[i], pp[i + 1]];
            const n = Math.max(2, Math.round(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 1.2));
            for (let j = 0; j <= n; j++) {
              const f = j / n;
              const [lx, ly] = [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f];
              const voet = kern.P(lx, ly, 0);
              const kop = kern.P(lx, ly, 0.45);
              if (draait) x2 += `<ellipse cx="${voet[0].toFixed(1)}" cy="${voet[1].toFixed(1)}" rx="${(0.6 * kern.k).toFixed(1)}" ry="${(0.6 * kern.k * kern.sp).toFixed(1)}" fill="${lk}" opacity="${kern.o.avond ? 0.35 : 0.15}"/>`;
              x2 += `<path d="M${voet[0].toFixed(1)} ${voet[1].toFixed(1)}L${kop[0].toFixed(1)} ${kop[1].toFixed(1)}" stroke="#55606e" stroke-width="1.6"/>`;
              if (draait) x2 += `<circle cx="${kop[0].toFixed(1)}" cy="${kop[1].toFixed(1)}" r="6" fill="url(#hm-gloed)" opacity="0.4"/>`;
              x2 += `<circle cx="${kop[0].toFixed(1)}" cy="${kop[1].toFixed(1)}" r="2.2" fill="${draait ? lk : '#5c6876'}"/>`;
            }
          }
        } else if (a.soort === 'accu') {
          // De thuisaccu aan de gevel naast de voordeur (zoals in het poppenhuis).
          const [nx, ny] = a.n ?? [0, -1];
          x2 += kern.zetModel('accu', Math.abs(nx) > Math.abs(ny) ? { x: a.x, y: a.y, z: 0.05, wand: 'x', kant: Math.sign(nx) } : { x: a.x, y: a.y, z: 0.05, wand: 'y', kant: Math.sign(ny) })?.s ?? '';
        } else if (a.soort === 'kast') {
          // De aansluitkast aan de straat, met de voorkant naar de straat.
          x2 += kern.zetModel('aansluitkast', { x: a.x, y: a.y + 0.15, z: 0, wand: 'y', kant: -1 })?.s ?? '';
        } else if (a.soort === 'paal') {
          // Een lantaarn: een paal met een kap; aan een kegel licht naar de grond.
          const z = a.z ?? 2.6;
          const p0 = kern.P(a.x, a.y, 0);
          const p1 = kern.P(a.x, a.y, z);
          if (draait) {
            const v0 = kern.P(a.x, a.y, 0.02);
            x2 += `<ellipse cx="${v0[0].toFixed(1)}" cy="${v0[1].toFixed(1)}" rx="${(1.6 * kern.k).toFixed(1)}" ry="${(1.6 * kern.k * kern.sp).toFixed(1)}" fill="#ffd9a0" fill-opacity="${kern.o.avond ? 0.22 : 0.08}"/>`;
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
          x2 += `<path d="${kern.vlak(kast)}" fill="#1b2633" stroke="#cfe6ff" stroke-opacity="0.7" stroke-width="1"/>`;
          const l = kern.P(a.x, a.y, z + 0.05);
          if (draait) x2 += `<circle cx="${l[0].toFixed(1)}" cy="${l[1].toFixed(1)}" r="9" fill="url(#hm-gloed)" opacity="0.6"/>`;
          x2 += `<circle cx="${l[0].toFixed(1)}" cy="${l[1].toFixed(1)}" r="2.4" fill="#6fd3ff"/>`;
          if (a.naam && !kern.o.stil) kern.labels.push({ x: l[0] - a.naam.length * 3.4, y: l[1] - 22, b: a.naam.length * 6.8, h: 14, prio: 2, s: `<text x="${l[0].toFixed(1)}" y="${(l[1] - 12).toFixed(1)}" text-anchor="middle" ${kern.FONT} font-size="11.5" font-weight="700" fill="#cfe6ff" paint-order="stroke" stroke="#0b1424" stroke-width="3">${kern.esc(a.naam)}</text>` });
        } else if (a.soort === 'camera') {
          // Een camera aan een muur (de camera aan de garage): een wit kastje dat uitsteekt, de lens donker;
          // met een lamp erbij (`licht`) een gloed als die aan is.
          const z = a.z ?? 2.4;
          const [n0, n1] = a.n ?? [0, -1];
          const [lx, ly] = [-n1, n0];
          const hoek = (f, g, zz) => [a.x + lx * f * 0.14 + n0 * g * 0.26, a.y + ly * f * 0.14 + n1 * g * 0.26, zz];
          const onder = [hoek(-0.5, 0, z - 0.07), hoek(0.5, 0, z - 0.07), hoek(0.5, 1, z - 0.11), hoek(-0.5, 1, z - 0.11)];
          const boven = [hoek(-0.5, 0, z + 0.07), hoek(0.5, 0, z + 0.07), hoek(0.5, 1, z + 0.03), hoek(-0.5, 1, z + 0.03)];
          if (a.licht && kern.aan.has(a.licht)) {
            const g = kern.P(...hoek(0, 1.1, z - 0.05));
            const v0 = kern.P(a.x + n0 * 2.2, a.y + n1 * 2.2, 0.02);
            x2 += `<ellipse cx="${v0[0].toFixed(1)}" cy="${v0[1].toFixed(1)}" rx="${(1.8 * kern.k).toFixed(1)}" ry="${(1.8 * kern.k * kern.sp).toFixed(1)}" fill="#ffe9c4" fill-opacity="${kern.o.avond ? 0.3 : 0.1}"/>`;
            x2 += `<circle cx="${g[0].toFixed(1)}" cy="${g[1].toFixed(1)}" r="12" fill="url(#hm-gloed)" opacity="0.7"/>`;
          }
          x2 += kern.prisma(onder, boven, (v) => (Math.abs(v.n[0]) > Math.abs(v.n[1]) ? '#d7dee5' : '#e9eef2'), '#f3f6f8');
          const lens = kern.P(...hoek(0, 1.02, z - 0.04));
          x2 += `<circle cx="${lens[0].toFixed(1)}" cy="${lens[1].toFixed(1)}" r="${Math.max(1.6, 0.045 * kern.k).toFixed(1)}" fill="#1b2633" stroke="#6fd3ff" stroke-opacity="0.6" stroke-width="0.8"/>`;
        } else if (a.soort === 'screen' && a.uit) {
          // Een zonnescherm: een doek schuin naar buiten, gestreept als hij uit staat.
          const [ux, uy] = a.uit;
          const b = a.b ?? 3;
          const [lx, ly] = [-uy, ux];
          const z = a.z ?? 2.5;
          const lang = draait ? 1.8 : 0.25;
          const pp = [[a.x - (lx * b) / 2, a.y - (ly * b) / 2, z], [a.x + (lx * b) / 2, a.y + (ly * b) / 2, z], [a.x + (lx * b) / 2 + ux * lang, a.y + (ly * b) / 2 + uy * lang, z - lang * 0.35], [a.x - (lx * b) / 2 + ux * lang, a.y - (ly * b) / 2 + uy * lang, z - lang * 0.35]];
          x2 += `<path d="${kern.vlak(pp)}" fill="#c9d4df" stroke="#8a98a8" stroke-width="0.8"/>`;
          if (draait) for (let i = 1; i < 6; i += 2) {
            const f0 = i / 6;
            const f1 = (i + 1) / 6;
            const lijn = (f) => [pp[0].map((n, j) => n + (pp[1][j] - n) * f), pp[3].map((n, j) => n + (pp[2][j] - n) * f)];
            const [a0, a1] = lijn(f0);
            const [b0, b1] = lijn(f1);
            x2 += `<path d="${kern.vlak([a0, b0, b1, a1])}" fill="#ff9a6b" fill-opacity="0.75"/>`;
          }
        }
        return x2;
      };

    return { buitenApparaat };
  };
})(typeof window !== 'undefined' ? window : globalThis);
