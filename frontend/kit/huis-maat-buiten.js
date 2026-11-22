/*
 * SunArc: het huis zoals getekend, wat buiten staat (22 november 2026, opgesplitst uit kit/huis-maat.js).
 *
 * De gebouwen en dingen op het erf (auto, boom, buitenunit, laadpaal, tuinhuis, garage, schuur, tuinset), van
 * ver naar dichtbij, en de panelen en dakkapellen op het dak.
 *
 * global.huisMaatBuiten(kern) maakt dit deel voor één tekenaar; `kern` geeft wat de tekenaar deelt (zie maak() in huistekenen.js).
 */
(function (global) {
  'use strict';

  global.huisMaatBuiten = function (kern) {
      /** Een doos: de vier wanden van achter naar voren, dan de bovenkant (plat of een zadeldak). */
      const doos = (q, kleur) => {
        const { x, y, b, d, h } = q;
        const hoeken = [[x, y], [x + b, y], [x + b, y + d], [x, y + d]];
        // Een lessenaar (een afdak): laag (`h0`) aan de kant met de kleinste y, hoog (`h`) aan de andere kant.
        const les = /lessenaar/.test(q.dak ?? '');
        const hoogOp = ([, c]) => (les && c <= y + 1e-6 ? (q.h0 ?? h) : h);
        const wanden = [0, 1, 2, 3].map((i) => {
          const [a, c] = [hoeken[i], hoeken[(i + 1) % 4]];
          return { p: [[...a, 0], [...c, 0], [...c, hoogOp(c)], [...a, hoogOp(a)]], n: [c[1] - a[1], -(c[0] - a[0])] };
        });
        let x2 = '';
        for (const w of wanden.sort((p1, p2) => kern.dp(p2.p) - kern.dp(p1.p))) {
          if (!kern.naarKijker(...w.n) && !q.buur) continue;
          x2 += `<path d="${kern.vlak(w.p)}" fill="${kleur[Math.abs(w.n[0]) > Math.abs(w.n[1]) ? 0 : 1]}" ${q.buur ? 'stroke="rgb(255 255 255 / 0.1)" stroke-dasharray="3 5"' : 'stroke="rgb(13 26 48 / 0.5)" stroke-width="0.7"'} stroke-linejoin="round"/>`;
        }
        if (/zadel/.test(q.dak ?? '')) {
          const dk = kern.dakVan({ u: x, v: y, b, d, dak: 'zadeldak', nok: h + Math.min(b, d) * 0.45, goot0: h, goot1: h }, { goot: h, nok: h + 1 });
          for (const v of dk.vlakken.sort((p1, p2) => kern.dp(p2.p) - kern.dp(p1.p))) x2 += `<path d="${kern.vlak(v.p)}" fill="${v.gevel ? kleur[0] : kern.naarKijker(...v.n) ? kleur[2] : kleur[3]}" stroke="rgb(13 26 48 / 0.5)" stroke-width="0.7" stroke-linejoin="round"/>`;
        } else x2 += `<path d="${kern.vlak(hoeken.map(([a, c]) => [a, c, hoogOp([a, c])]))}" fill="${kleur[2]}" ${q.buur ? 'stroke="rgb(255 255 255 / 0.2)" stroke-dasharray="4 4"' : 'stroke="rgb(13 26 48 / 0.5)"'}/>`;
        // Een overstek (het tuinhuis zoals op Thuis nu): het platte dak loopt aan de kant met de kleinste y door, iets aflopend, met licht eronder.
        if (q.overstek && !/zadel/.test(q.dak ?? '')) {
          const od = q.overstek.d ?? 1.5;
          const plaat = [[x - 0.1, y, h + 0.05], [x + b + 0.1, y, h + 0.05], [x + b + 0.1, y - od, h - 0.05], [x - 0.1, y - od, h - 0.05]];
          if (q.overstek.licht) {
            const c = kern.P(x + b / 2, y - od / 2, 0.02);
            x2 += `<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(b * 0.45 * kern.k).toFixed(1)}" ry="${(od * 0.35 * kern.k).toFixed(1)}" fill="${q.overstek.kleur ?? '#FFD39A'}" opacity="0.22"/>`;
          }
          x2 += `<path d="${kern.vlak(plaat)}" fill="#55626f" stroke="rgb(13 26 48 / 0.5)" stroke-width="0.7" stroke-linejoin="round"/>`;
        }
        // Een garagedeur aan de straatkant (de kant met de kleinste y): panelen met lijnen.
        if (q.deur === 'voor' && kern.naarKijker(0, -1)) {
          const dx = Math.min(2.6, b - 0.4);
          const xa = x + (b - dx) / 2;
          x2 += `<path d="${kern.vlak([[xa, y - 0.01, 0], [xa + dx, y - 0.01, 0], [xa + dx, y - 0.01, Math.min(2.2, h - 0.25)], [xa, y - 0.01, Math.min(2.2, h - 0.25)]])}" fill="#4d5a6a" stroke="#7a8796" stroke-width="0.8"/>`;
          for (let zz = 0.45; zz < Math.min(2.2, h - 0.25); zz += 0.45) x2 += `<path d="M${kern.pt(xa, y - 0.012, zz)}L${kern.pt(xa + dx, y - 0.012, zz)}" stroke="#7a8796" stroke-width="0.7" stroke-opacity="0.8"/>`;
        }
        // Een raam aan de kant van de kijker; brandt het licht binnen, dan warm.
        if (q.raam) {
          const kant = kern.naarKijker(-1, 0) ? x - 0.01 : x + b + 0.01;
          const raam = [[kant, y + d * 0.3, 0.9], [kant, y + d * 0.7, 0.9], [kant, y + d * 0.7, 1.7], [kant, y + d * 0.3, 1.7]];
          x2 += `<path d="${kern.vlak(raam)}" fill="${q.licht ? '#f3c77a' : '#8fb4d6'}" fill-opacity="${q.licht ? 0.75 : 0.35}" stroke="#c9d6e2" stroke-opacity="0.5" stroke-width="0.8"/>`;
        }
        if (q.naam && !kern.o.stil) {
          const p = kern.P(x + b / 2, y + d / 2, (/zadel/.test(q.dak ?? '') ? h + Math.min(b, d) * 0.45 : h) + 0.4);
          kern.labels.push({ x: p[0] - q.naam.length * 3.6, y: p[1] - 10, b: q.naam.length * 7.2, h: 16, prio: 1, s: `<text x="${p[0].toFixed(1)}" y="${(p[1] + 4).toFixed(1)}" text-anchor="middle" ${kern.FONT} font-size="12.5" font-weight="700" fill="#dfe6ec" paint-order="stroke" stroke="#0d1a30" stroke-width="3.5" stroke-linejoin="round">${kern.esc(q.naam)}</text>` });
        }
        return x2;
      };
      /** Een blok met een andere boven- en onderkant (vier hoeken elk): de zijden naar de kijker, dan de bovenkant. */
      const prisma = (onder, boven, zij, top) => {
        let x2 = '';
        const vlakken = [0, 1, 2, 3].map((i) => {
          const [a, b] = [onder[i], onder[(i + 1) % 4]];
          return { p: [a, b, boven[(i + 1) % 4], boven[i]], n: [b[1] - a[1], -(b[0] - a[0])] };
        });
        for (const v of vlakken.sort((p1, p2) => kern.dp(p2.p) - kern.dp(p1.p))) if (kern.naarKijker(...v.n)) x2 += `<path d="${kern.vlak(v.p)}" fill="${zij(v)}" stroke="rgb(13 26 48 / 0.35)" stroke-width="0.6" stroke-linejoin="round"/>`;
        return x2 + `<path d="${kern.vlak(boven)}" fill="${top}" stroke="rgb(13 26 48 / 0.35)" stroke-width="0.6" stroke-linejoin="round"/>`;
      };
      /** De auto: een lage carrosserie op wielen, een cabine met ramen, en een bliksem als hij laadt. */
      /** De auto, uit de vaste lijst: met de neus naar de korte kant met de kleinste y of x (de straat), een schaduw, en een bliksem als hij laadt. */
      const auto = (q) => {
        const lang = q.d > q.b;
        const [breed, lengte] = lang ? [q.b, q.d] : [q.d, q.b];
        const pl = lang ? { x: q.x + q.b / 2, y: q.y + q.d, z: 0, wand: 'y', kant: -1 } : { x: q.x + q.b, y: q.y + q.d / 2, z: 0, wand: 'x', kant: -1 };
        const sch = kern.P(q.x + q.b / 2, q.y + q.d / 2, 0.01);
        let x2 = `<ellipse cx="${sch[0].toFixed(1)}" cy="${sch[1].toFixed(1)}" rx="${(lengte * 0.55 * kern.k).toFixed(1)}" ry="${(lengte * 0.55 * kern.k * kern.sp).toFixed(1)}" fill="#000" fill-opacity="0.22"/>`;
        x2 += kern.zetModel('auto', pl, { b: breed, d: lengte, kleur: q.kleur })?.s ?? '';
        if (q.laadt) {
          const p = kern.P(q.x + q.b / 2, q.y + q.d / 2, 1.8);
          x2 += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="9" fill="#0d1a30" stroke="#6ee7b7" stroke-width="1.6"/><path d="M${(p[0] + 1).toFixed(1)} ${(p[1] - 5).toFixed(1)}l-4 6h4l-1 5 4-6h-4z" fill="#6ee7b7"/>`;
        }
        return x2;
      };
      /** Een boom in zijn seizoen: een stam en een kruin van drie bollen, licht van boven. */
      const boom = (bm) => {
        const h = bm.h ?? 5;
        const kl = { herfst: ['#f39a45', '#e07a2e', '#ffb866'], zomer: ['#3f8f5a', '#2f744a', '#58ad73'], lente: ['#7cc47f', '#5ea865', '#f4c6d6'], winter: null }[kern.o.seizoen ?? 'zomer'];
        const p0 = kern.P(bm.x, bm.y, 0);
        const p1 = kern.P(bm.x, bm.y, h * 0.62);
        let x2 = `<ellipse cx="${p0[0].toFixed(1)}" cy="${p0[1].toFixed(1)}" rx="${(1.1 * kern.k).toFixed(1)}" ry="${(1.1 * kern.k * kern.sp).toFixed(1)}" fill="#000" opacity="0.2"/>`;
        x2 += `<path d="M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}" stroke="#5b4636" stroke-width="${Math.max(2, 0.22 * kern.k).toFixed(1)}" stroke-linecap="round"/>`;
        if (!kl) {
          // Winter: kale takken.
          for (const [dx, dz] of [[-0.9, 0.85], [0.8, 0.9], [-0.4, 1], [0.35, 1.05]]) {
            const q = kern.P(bm.x + dx, bm.y, h * dz);
            x2 += `<path d="M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}" stroke="#6b5646" stroke-width="1.6" stroke-linecap="round"/>`;
          }
          return x2;
        }
        const r = (bm.r ?? 1.5) * kern.k;
        const c = kern.P(bm.x, bm.y, h * 0.8);
        x2 += `<circle cx="${(c[0] - r * 0.45).toFixed(1)}" cy="${(c[1] + r * 0.15).toFixed(1)}" r="${(r * 0.78).toFixed(1)}" fill="${kl[1]}"/>`;
        x2 += `<circle cx="${(c[0] + r * 0.45).toFixed(1)}" cy="${(c[1] + r * 0.2).toFixed(1)}" r="${(r * 0.72).toFixed(1)}" fill="${kl[1]}"/>`;
        x2 += `<circle cx="${c[0].toFixed(1)}" cy="${(c[1] - r * 0.3).toFixed(1)}" r="${r.toFixed(1)}" fill="${kl[0]}"/>`;
        x2 += `<circle cx="${(c[0] - r * 0.3).toFixed(1)}" cy="${(c[1] - r * 0.6).toFixed(1)}" r="${(r * 0.42).toFixed(1)}" fill="${kl[2]}" opacity="0.7"/>`;
        return x2;
      };
      /** Een buitenunit van een airco tegen de muur: een witte kast met een ventilator. */
      /** Een buitenunit van een airco tegen de muur, uit de vaste lijst; de ventilator draait als hij aan is. */
      const unit = (u) => {
        const [nx, ny] = u.n ?? [0, 1];
        const z = u.z ?? 0.12;
        const pl = Math.abs(nx) > Math.abs(ny) ? { x: u.x, y: u.y, z, wand: 'x', kant: Math.sign(nx) } : { x: u.x, y: u.y, z, wand: 'y', kant: Math.sign(ny) };
        const md = kern.zetModel('buitenunit', pl, { aan: !!u.aan });
        if (!md) return '';
        // Hoger dan de grond en tegen de muur: op een beugel (22 november 2026, besluit 333).
        let beugel = '';
        if (z > 0.5 && !u.los) {
          for (const a of [-0.3, 0.3]) {
            const v0 = kern.P(...md.W(a, 0, -0.03));
            const v1 = kern.P(...md.W(a, 0.42, -0.03));
            const v2 = kern.P(...md.W(a, 0, -0.32));
            beugel += `<path d="M${v2[0].toFixed(1)} ${v2[1].toFixed(1)}L${v0[0].toFixed(1)} ${v0[1].toFixed(1)}L${v1[0].toFixed(1)} ${v1[1].toFixed(1)}Z" fill="none" stroke="#7d8b9b" stroke-width="1.2" stroke-linejoin="round"/>`;
          }
        }
        return beugel + md.s;
      };
      /** Een laadpaal: een smalle kast met een groen lampje; laadt hij, dan loopt er een kabel naar de auto. */
      /** Een laadpaal tegen een muur, uit de vaste lijst; laadt hij, dan een groen lampje en een kabel naar de auto. */
      const laadpaal = (l) => {
        const [nx, ny] = l.n ?? [0, -1];
        const pl = Math.abs(nx) > Math.abs(ny) ? { x: l.x, y: l.y, z: 0, wand: 'x', kant: Math.sign(nx) } : { x: l.x, y: l.y, z: 0, wand: 'y', kant: Math.sign(ny) };
        const md = kern.zetModel('laadpaal', pl, { aan: !!l.laadt });
        let x2 = md?.s ?? '';
        if (l.laadt && kern.buiten.auto && md) {
          const lampje = kern.P(...md.W(0, 0.17, 1.0));
          const a = kern.buiten.auto;
          const doel = kern.P(a.x + a.b / 2, a.y + a.d * 0.15, 0.7);
          x2 += `<path d="M${lampje[0].toFixed(1)} ${lampje[1].toFixed(1)}Q${((lampje[0] + doel[0]) / 2).toFixed(1)} ${(Math.max(lampje[1], doel[1]) + 18).toFixed(1)} ${doel[0].toFixed(1)} ${doel[1].toFixed(1)}" stroke="#1c2430" stroke-width="2.4" fill="none"/>`;
        }
        return x2;
      };
      /*
       * Het tuinhuis zoals op Thuis nu (het poppenhuis, 24 oktober 2026), op zijn echte maat: een donkere doos
       * met liggende latten, een glazen pui naar het huis, een plat dak dat aan die kant doorloopt als overstek
       * op twee palen, met een vlonder en twee spots eronder. Wat getekend is (x, y, b, d) is alles samen, het
       * overstek erbij; het overstek ligt aan de kant met de kleinste y (naar het huis).
       */
      /*
       * Het tuinhuis, uit de vaste lijst, op zijn echte maat (zoals op Thuis nu, het poppenhuis). Wat getekend is (x, y, b, d)
       * is alles samen, het overstek erbij; het overstek en de pui liggen aan de kant met de kleinste y (naar het huis).
       * Het licht (binnen door de pui, de spots onder het overstek) tekent de tekenaar erbij.
       */
      const tuinhuis = (q) => {
        const h = q.h ?? 2.4;
        const od = Math.min(q.overstek?.d ?? 1.1, q.d * 0.45);
        const [x0, x1] = [q.x, q.x + q.b];
        const y0 = q.y + od;
        const ov = q.y;
        const spotsAan = !!q.overstek?.licht;
        const binnen = !!q.licht;
        // De kleur van de lampen uit Home Assistant (22 november 2026, Ricardo); zonder kleur warm wit.
        const binnenKleur = q.lichtKleur ?? '#F4C27E';
        const spotKleur = q.overstek?.kleur ?? '#FFD39A';
        const glas = binnen ? binnenKleur : kern.o.avond ? '#0f1a2a' : '#4d7eac';
        let x2 = `<path d="${kern.vlak([[x0 - 0.2, ov - 0.2, 0], [x1 + 0.3, ov - 0.2, 0], [x1 + 0.3, q.y + q.d + 0.3, 0], [x0 - 0.2, q.y + q.d + 0.3, 0]])}" fill="#02050a" opacity="0.3" filter="url(#hm-zacht)"/>`;
        if (binnen) x2 += `<path d="${kern.vlak([[x0 + 0.3, y0, 0.01], [x1 - 0.3, y0, 0.01], [x1 + 0.5, ov - 1.6, 0.01], [x0 - 0.5, ov - 1.6, 0.01]])}" fill="${binnenKleur}" opacity="0.35" filter="url(#hm-zacht)"/>`;
        const spots = [0.27, 0.73].map((f) => x0 + (x1 - x0) * f);
        x2 += kern.zetModel('tuinhuis', { x: (x0 + x1) / 2, y: q.y + q.d, z: 0, wand: 'y', kant: -1 }, { b: q.b, d: q.d, h, od, glas })?.s ?? '';
        if (kern.o.weer === 'sneeuw') x2 += `<path d="${kern.vlak([[x0 - 0.12, ov - 0.05, h + 0.2], [x1 + 0.12, ov - 0.05, h + 0.2], [x1 + 0.12, q.y + q.d + 0.12, h + 0.2], [x0 - 0.12, q.y + q.d + 0.12, h + 0.2]])}" fill="#eef3f8" fill-opacity="0.9"/>`;
        for (const x of spots) {
          const l = kern.P(x, ov + 0.25, h - 0.01);
          if (spotsAan) {
            const c = kern.P(x, ov + od * 0.5, 0.11);
            x2 += `<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(0.9 * kern.k).toFixed(1)}" ry="${(0.9 * kern.k * kern.sp).toFixed(1)}" fill="${spotKleur}" opacity="0.4"/>`;
            x2 += `<path d="M${(l[0] - 2).toFixed(1)} ${l[1].toFixed(1)}L${(l[0] + 2).toFixed(1)} ${l[1].toFixed(1)}L${(c[0] + 0.7 * kern.k).toFixed(1)} ${c[1].toFixed(1)}L${(c[0] - 0.7 * kern.k).toFixed(1)} ${c[1].toFixed(1)}Z" fill="${spotKleur}" opacity="0.16"/>`;
          }
          x2 += `<rect x="${(l[0] - 4).toFixed(1)}" y="${(l[1] - 1.5).toFixed(1)}" width="8" height="3" rx="1.5" fill="${spotsAan ? spotKleur : '#55626f'}"/>`;
        }
        x2 += gebouwNaam(q, h + 0.6);
        const ta = kern.tikAttr(q.kamer, q.naam);
        if (ta) kern.tikLaag.push(`<path d="${kern.omhulsel(q.x, q.x + q.b, q.y, q.y + q.d, 0, h + 0.2)}" ${ta}/>`);
        return x2;
      };
      /** De naam boven een gebouw. */
      const gebouwNaam = (q, z) => {
        if (!q.naam || kern.o.stil) return '';
        const p = kern.P(q.x + q.b / 2, q.y + q.d / 2, z);
        kern.labels.push({ x: p[0] - q.naam.length * 3.6, y: p[1] - 10, b: q.naam.length * 7.2, h: 16, prio: 1, s: `<text x="${p[0].toFixed(1)}" y="${(p[1] + 4).toFixed(1)}" text-anchor="middle" ${kern.FONT} font-size="12.5" font-weight="700" fill="#dfe6ec" paint-order="stroke" stroke="#0d1a30" stroke-width="3.5" stroke-linejoin="round">${kern.esc(q.naam)}</text>` });
        return '';
      };
      /** Een gebouw uit de vaste lijst (garage, schuurtje, carport), met de voorkant naar de kant met de kleinste y. */
      const gebouw = (q) => {
        const h = q.h ?? kern.MOD.MODELLEN[q.soort].h;
        const ta = kern.tikAttr(q.kamer, q.naam);
        if (ta) kern.tikLaag.push(`<path d="${kern.omhulsel(q.x, q.x + q.b, q.y, q.y + q.d, 0, h + (q.soort === 'schuur' ? Math.min(q.b, 3) * 0.38 : 0.2))}" ${ta}/>`);
        let x2 = kern.zetModel(q.soort, { x: q.x + q.b / 2, y: q.y + q.d, z: 0, wand: 'y', kant: -1 }, { b: q.b, d: q.d, h })?.s ?? '';
        if (kern.o.weer === 'sneeuw' && q.soort !== 'schuur') x2 += `<path d="${kern.vlak([[q.x, q.y, h + 0.03], [q.x + q.b, q.y, h + 0.03], [q.x + q.b, q.y + q.d, h + 0.03], [q.x, q.y + q.d, h + 0.03]])}" fill="#eef3f8" fill-opacity="0.9"/>`;
        return x2 + gebouwNaam(q, h + (q.soort === 'schuur' ? Math.min(q.b, 3) * 0.38 : 0) + 0.4);
      };
      /** Een tafel met vier stoelen op het terras. */
      const tafel = (q) => kern.zetModel('tuinset', { x: q.mx, y: q.my, z: 0, wand: 'y', kant: 1 })?.s ?? '';
      /** Van ver naar dichtbij: steeds het ding waar niets meer achter staat. */
      const vanVer = (lijst) => {
        const rest = [...lijst];
        const uit = [];
        while (rest.length) {
          let i = rest.findIndex((a) => rest.every((b) => b === a || kern.dichterbij(b.q, a.q)));
          if (i < 0) i = rest.reduce((best, a, j) => (kern.diep(a.q.x + a.q.b / 2, a.q.y + a.q.d / 2) > kern.diep(rest[best].q.x + rest[best].q.b / 2, rest[best].q.y + rest[best].q.d / 2) ? j : best), 0);
          uit.push(...rest.splice(i, 1));
        }
        return uit;
      };
      const tekenBuiten = (lijst) => vanVer(lijst).map((x) => (x.soort === 'auto' ? auto(x.q) : x.soort === 'tuinhuis' ? tuinhuis(x.q) : kern.MOD?.MODELLEN?.[x.q.soort] && !x.q.buur ? gebouw(x.q) : x.soort === 'boom' ? boom(x.q.bm) : x.soort === 'unit' ? unit(x.q.u) : x.soort === 'laadpaal' ? laadpaal(x.q.l) : x.soort === 'tafel' ? tafel(x.q) : x.q.buur ? doos(x.q, ['rgb(255 255 255 / 0.025)', 'rgb(255 255 255 / 0.035)', 'rgb(255 255 255 / 0.03)', 'rgb(255 255 255 / 0.03)']) : doos(x.q, x.q.kleur ?? ['#2d3d57', '#26354d', '#3b4a66', '#34425c']))).join('');
      kern.s += tekenBuiten(kern.achterHuis);
      // Hier komen straks de apparaten achter het huis (ze worden pas verderop getekend).
      const ACHTER = '<!--achter-->';
      kern.s += ACHTER;

      // Het dak aan de achterkant: eerst, zodat alles ervoor er overheen valt.
      const paneelLijst = [].concat(kern.o.panelen ?? []).filter((p) => p?.aantal);
      const paneelVan = (v) => paneelLijst.find((p) => (p.kant ?? v.kant) === v.kant);
      const hoofdDak = kern.daken.find((d) => d.b.soort === 'hoofdhuis') ?? kern.daken[0];
      const dakVlak = (d, v) => {
        const kijker = kern.naarKijker(...v.n);
        if (kijker) return '';
        const vul = v.gevel ? (Math.abs(v.n[0]) > 0.5 ? '#33435e' : '#2b3a53') : v.kant === 0 ? '#3b4a66' : '#34425c';
        let x = `<path d="${kern.vlak(v.p)}" fill="${vul}" stroke="rgb(13 26 48 / 0.6)" stroke-width="0.8" stroke-linejoin="round"/>`;
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
            x += `<path d="${kern.vlak([p(f0, h0), p(f1, h0), p(f1, h1), p(f0, h1)])}" fill="#1d3f73" stroke="#5c8fd6" stroke-opacity="0.55" stroke-width="0.7"/>`;
          }
        }
        return x;
      };
      if (kern.metDak) for (const d of kern.daken) for (const v of [...d.vlakken].sort((a, b) => kern.dp(b.p) - kern.dp(a.p))) kern.s += dakVlak(d, v);
      /** Een dakkapel: de wanden naar de kijker, het platte dak, en het raam (warm als het avond is). */
      const kapel = (kp) => {
        let x2 = '';
        for (const z of kp.zijden) if (kern.naarKijker(...z.n)) x2 += `<path d="${kern.vlak(z.p)}" fill="#7d8ca1" stroke="rgb(13 26 48 / 0.4)" stroke-width="0.6"/>`;
        if (kern.naarKijker(...kp.voor.n)) {
          x2 += `<path d="${kern.vlak(kp.voor.p)}" fill="#97a6ba" stroke="rgb(13 26 48 / 0.4)" stroke-width="0.6"/>`;
          x2 += `<path d="${kern.vlak(kp.raam)}" fill="${kern.o.avond ? '#f3c77a' : '#8fb4d6'}" fill-opacity="${kern.o.avond ? 0.6 : 0.45}"/>`;
        } else {
          // Van achteren (21 november 2026): door het glazen dak zie je de voorkant van binnen, met het raam, zodat je hem herkent.
          x2 += `<path d="${kern.vlak(kp.voor.p)}" fill="#4a5a76" stroke="#cfe6ff" stroke-opacity="0.45" stroke-width="0.8"/>`;
          x2 += `<path d="${kern.vlak(kp.raam)}" fill="${kern.o.avond ? '#f3c77a' : '#8fb4d6'}" fill-opacity="${kern.o.avond ? 0.6 : 0.5}" stroke="#eef5fb" stroke-opacity="0.7" stroke-width="1"/>`;
        }
        return x2 + `<path d="${kern.vlak(kp.boven.p)}" fill="#7d8ca1" stroke="#cfe6ff" stroke-opacity="0.5" stroke-width="0.8"/>`;
      };


    return { prisma, tekenBuiten, ACHTER, paneelVan, hoofdDak, paneelVeld, kapel };
  };
})(typeof window !== 'undefined' ? window : globalThis);
