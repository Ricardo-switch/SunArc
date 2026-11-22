/*
 * SunArc: het poppenhuis, wat buiten staat (22 november 2026, opgesplitst uit kit/huis.js).
 *
 * De buitenunit, voordeur, thuisaccu, garage, panelen, jacuzzi, carport, auto, camera, terras, voortuin, balkon,
 * tuin, de aansluiting op het net, de lagen van het huis en het eiland eronder.
 *
 * global.huisBuiten(kern) maakt dit deel voor één tekenaar; `kern` geeft wat de tekenaar deelt (zie maak() in huistekenen.js).
 */
(function (global) {
  'use strict';

  global.huisBuiten = function (kern) {
      /**
       * De buitenunits (rapport 15 oktober): tegen de zijgevel, op pootjes, één
       * per airco, op ware grootte (80 bij 30 bij 55 centimeter).
       */
      function bouwBuitenunit(unit, Wx) {
        const n = Math.max(1, Math.min(3, unit.aantal ?? 1));
        for (let i = 0; i < n; i++) {
          // De eerste op de grond, de volgende op een steun hoger tegen de gevel: zo staan ze niet over elkaar.
          const y0 = kern.D - 0.5;
          const z0 = 0.06 + i * 0.55;
          if (i > 0) kern.buiten.push(kern.line([[Wx, y0 + 0.08, z0 - 0.02], [Wx + 0.21, y0 + 0.08, z0 - 0.02]], 'stroke="#7d8b99" stroke-width="2"'), kern.line([[Wx, y0 + 0.4, z0 - 0.02], [Wx + 0.21, y0 + 0.4, z0 - 0.02]], 'stroke="#7d8b99" stroke-width="2"'));
          kern.buiten.push(kern.doos(Wx + 0.03, y0, z0, 0.18, 0.48, 0.33, ['#dbe3ea', '#c6d0d9', '#aab5c0']));
          const c = kern.P(Wx + 0.211, y0 + 0.22, z0 + 0.16);
          kern.buiten.push(`<ellipse cx="${c[0]}" cy="${c[1]}" rx="${kern.k * 0.065}" ry="${kern.k * 0.12}" fill="#5c6977"/>`);
          if (unit.aan) kern.buiten.push(`<g class="sc-fan" style="transform-origin:${c[0]}px ${c[1]}px"><line x1="${c[0] - kern.k * 0.05}" y1="${c[1]}" x2="${c[0] + kern.k * 0.05}" y2="${c[1]}" stroke="#cfd8e1" stroke-width="1.6"/><line x1="${c[0]}" y1="${c[1] - kern.k * 0.1}" x2="${c[0]}" y2="${c[1] + kern.k * 0.1}" stroke="#cfd8e1" stroke-width="1.6"/></g>`);
          if (unit.aan && kern.winter) {
            for (let j = 0; j < 2; j++) {
              const q = kern.P(Wx + 0.12, y0 + 0.24, z0 + 0.45 + j * 0.25);
              kern.buiten.push(`<circle class="sc-damp" style="animation-delay:${j}s" cx="${q[0]}" cy="${q[1]}" r="${kern.k * 0.08}" fill="#dfe6ee" opacity="0.2"/>`);
            }
          }
        }
      }
      /** De voordeur in de snijlijn, half open, met de deurbel en de meterkast (zie boven). */
      function bouwVoordeur(v) {
        const h = 1.2;
        const blad = kern.nacht ? '#22303f' : '#3b4b5f';
        // De drempel en de deur, half open naar binnen.
        kern.huis.push(kern.poly([[v.x0 - 0.04, kern.D, 0.002], [v.x1 + 0.04, kern.D, 0.002], [v.x1 + 0.04, kern.D + 0.1, 0.002], [v.x0 - 0.04, kern.D + 0.1, 0.002]], 'fill="#5a6776"'));
        kern.huis.push(kern.poly([[v.x0, kern.D, 0.01], [v.x0, kern.D - 0.36, 0.01], [v.x0, kern.D - 0.36, h], [v.x0, kern.D, h]], `fill="${blad}" stroke="#7d8b99" stroke-width="1"`));
        const kruk = kern.P(v.x0, kern.D - 0.31, h * 0.5);
        kern.huis.push(`<circle cx="${kruk[0]}" cy="${kruk[1]}" r="${(kern.k * 0.025).toFixed(1)}" fill="#c9d3dc"/>`);
        // Het kozijn, licht, zodat de deur in de doorsnede te zien is.
        kern.huis.push(kern.line([[v.x0, kern.D, 0], [v.x0, kern.D, h], [v.x1, kern.D, h], [v.x1, kern.D, 0]], 'stroke="#C9D6E2" stroke-opacity="0.85" stroke-width="2.6" stroke-linejoin="round"'));
        // De meterkast in de hal: tegen de achterwand, met de bliksem.
        // Tegen de zijmuur van de hal, vooraan bij de deur, op ooghoogte (de bewoner, 16 oktober).
        const mx = v.kamer.x0 + 0.01;
        const my = kern.D - 0.62;
        kern.huis.push(kern.doos(mx, my, 0.2, 0.09, 0.3, 0.38, ['#59677a', '#3d495a', '#4a5769']));
        const t = kern.P(mx + 0.091, my + 0.15, 0.36);
        kern.huis.push(`<text x="${t[0]}" y="${t[1] + 4}" text-anchor="middle" font-family="Figtree, sans-serif" font-size="11" font-weight="700" fill="#cfd8e1">⚡</text>`);
        kern.plek.meterkast = [mx + 0.09, my + 0.15, 0.4];
        kern.plek.voordeur = [(v.x0 + v.x1) / 2, kern.D, h];
        // De deurbel naast het kozijn: hij licht op bij beweging, en de ringen gaan als er wordt aangebeld.
        const bel = v.deurbel;
        const bx = v.x1 + 0.1;
        kern.huis.push(kern.doos(bx - 0.04, kern.D - 0.02, 0.62, 0.08, 0.04, 0.16, ['#e5ebf0', '#cfd8e0', '#b3bec9']));
        const lens = kern.P(bx, kern.D + 0.021, 0.73);
        const kleur = bel?.belt ? kern.KLEUR.zon : bel?.beweging ? kern.KLEUR.mint : '#4d7eac';
        kern.huis.push(`<circle cx="${lens[0]}" cy="${lens[1]}" r="${(kern.k * 0.022).toFixed(1)}" fill="${kleur}"/>`);
        kern.plek.deurbel = [bx, kern.D, 0.73];
        if (bel?.belt || bel?.beweging) {
          const stil = kern.stilGekozen();
          const r = kern.k * 0.28;
          if (stil) kern.buiten.push(`<circle cx="${lens[0]}" cy="${lens[1]}" r="${r * 0.6}" fill="none" stroke="${kleur}" stroke-width="2" stroke-opacity="0.7"/>`);
          else for (const vertraging of [0, 0.7]) {
            kern.buiten.push(`<circle cx="${lens[0]}" cy="${lens[1]}" r="${r * 0.2}" fill="none" stroke="${kleur}" stroke-width="2"><animate attributeName="r" values="${r * 0.2};${r}" dur="1.4s" begin="${vertraging}s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values="0.9;0" dur="1.4s" begin="${vertraging}s" repeatCount="indefinite"/></circle>`);
          }
        }
      }
      function bouwBatterij(b, isSpook) {
        // Op het eiland (huis 3.0) naast de garagedeur als er een garage is, anders achteraan
        // tegen de gevel: voorin staan de buitenunit en het terras, en eronder de boiler.
        const { x, y } = kern.accuPlek;
        // Bij de garage staat hij achter het huis: dan eerder getekend.
        const laag = x < 0 ? kern.buitenAchter : kern.buiten;
        kern.plek.batterij = kern.accuPlek.garage ? [x + 0.085, y + 0.06, 0.6] : kern.accuPlek.wand ? [x + 0.12, y + 0.23, 0.9] : [x + 0.32, y + 0.28, 1.0];
        if (isSpook) {
          laag.push(`<g opacity="0.7">${kern.poly([[x + 0.3, y, 0], [x + 0.3, y + 0.55, 0], [x + 0.3, y + 0.55, 1.1], [x + 0.3, y, 1.1]], `fill="none" stroke="${kern.KLEUR.mint}" stroke-dasharray="4 4"`)}</g>`);
          return;
        }
        const pct = (b.procent ?? 50) / 100;
        if (kern.accuPlek.garage) {
          // In de garage (besluit 270): dun tegen de voorgevel, met de strook naar voren.
          laag.push(kern.doos(x, y, 0.12, 0.17, 0.06, 0.72, ['#e6ecf1', '#eef2f5', '#cdd6de']));
          const yv = y + 0.061;
          laag.push(kern.poly([[x + 0.06, yv, 0.2], [x + 0.11, yv, 0.2], [x + 0.11, yv, 0.76], [x + 0.06, yv, 0.76]], 'fill="#5c6977"'));
          laag.push(kern.poly([[x + 0.06, yv + 0.001, 0.2], [x + 0.11, yv + 0.001, 0.2], [x + 0.11, yv + 0.001, 0.2 + 0.56 * pct], [x + 0.06, yv + 0.001, 0.2 + 0.56 * pct]], `fill="${kern.KLEUR.mint}" ${b.stand !== 'rust' ? 'class="sc-puls"' : ''}`));
          return;
        }
        if (kern.accuPlek.wand) {
          // Aan de muur: dun, iets van de grond, met de strook op de kant die je ziet.
          laag.push(kern.doos(x, y, 0.12, 0.12, 0.46, 0.82, ['#e6ecf1', '#cdd6de', '#eef2f5']));
          laag.push(kern.poly([[x + 0.121, y + 0.18, 0.24], [x + 0.121, y + 0.28, 0.24], [x + 0.121, y + 0.28, 0.82], [x + 0.121, y + 0.18, 0.82]], 'fill="#5c6977"'));
          laag.push(kern.poly([[x + 0.122, y + 0.18, 0.24], [x + 0.122, y + 0.28, 0.24], [x + 0.122, y + 0.28, 0.24 + 0.58 * pct], [x + 0.122, y + 0.18, 0.24 + 0.58 * pct]], `fill="${kern.KLEUR.mint}" ${b.stand !== 'rust' ? 'class="sc-puls"' : ''}`));
          return;
        }
        laag.push(kern.doos(x, y, 0, 0.3, 0.55, 1.1, ['#e6ecf1', '#cdd6de', '#eef2f5']));
        // Het niveau als een lichtstrook op de zijkant.
        laag.push(kern.poly([[x + 0.301, y + 0.22, 0.15], [x + 0.301, y + 0.33, 0.15], [x + 0.301, y + 0.33, 0.95], [x + 0.301, y + 0.22, 0.95]], 'fill="#5c6977"'));
        laag.push(kern.poly([[x + 0.302, y + 0.22, 0.15], [x + 0.302, y + 0.33, 0.15], [x + 0.302, y + 0.33, 0.15 + 0.8 * pct], [x + 0.302, y + 0.22, 0.15 + 0.8 * pct]], `fill="${kern.KLEUR.mint}" ${b.stand !== 'rust' ? 'class="sc-puls"' : ''}`));
      }
      /**
       * Een garage achter de oprit, met de deur naar voren; licht achter de deur als er een lamp aan is.
       * Vóór het huis en de auto getekend (huis 3.0): hij staat erachter, en viel er eerst doorheen.
       */
      function bouwGarage(gar) {
        const x0 = -2.9;
        const y0 = -2.0;
        const b = 1.8;
        const d = 1.5;
        const h = 1.1;
        kern.buitenAchter.push(kern.doos(x0, y0, 0, b, d, h, ['#3a4656', '#2f3a48', '#46525f']));
        // Een plat dak dat iets uitsteekt.
        kern.buitenAchter.push(kern.poly([[x0 - 0.05, y0 - 0.05, h], [x0 + b + 0.05, y0 - 0.05, h], [x0 + b + 0.05, y0 + d + 0.08, h], [x0 - 0.05, y0 + d + 0.08, h]], `fill="${kern.model.weer === 'sneeuw' ? '#eef3f8' : '#55626f'}"`));
        kern.buitenAchter.push(kern.poly([[x0 - 0.05, y0 + d + 0.08, h], [x0 + b + 0.05, y0 + d + 0.08, h], [x0 + b + 0.05, y0 + d + 0.08, h + 0.06], [x0 - 0.05, y0 + d + 0.08, h + 0.06]], 'fill="#3d4957"'));
        // De kanteldeur, met lamellen.
        const yd = y0 + d + 0.001;
        if (gar.auto) bouwAutoInGarage(gar, x0, b, yd, h);
        else {
          kern.buitenAchter.push(kern.poly([[x0 + 0.22, yd, 0.02], [x0 + b - 0.22, yd, 0.02], [x0 + b - 0.22, yd, h - 0.18], [x0 + 0.22, yd, h - 0.18]], `fill="${gar.lampAan ? '#6b5a3c' : '#4f5c6a'}"`));
          for (let z = 0.2; z < h - 0.2; z += 0.18) kern.buitenAchter.push(kern.line([[x0 + 0.22, yd + 0.001, z], [x0 + b - 0.22, yd + 0.001, z]], 'stroke="#3b4652" stroke-width="1"'));
        }
        if (gar.lampAan) {
          const c = kern.P(x0 + b / 2, yd + 0.4, 0.02);
          kern.buitenAchter.push(`<ellipse cx="${c[0]}" cy="${c[1]}" rx="${kern.k * 0.7}" ry="${kern.k * 0.28}" fill="#FFD39A" opacity="0.22" filter="url(#${kern.id}-zacht)"/>`);
        }
        // Panelen op het platte dak (huis 3.0): schuin op rekken, in rijen.
        if (gar.panelen && kern.model.weer !== 'sneeuw') {
          plaatPanelen(x0 + 0.1, y0 + 0.1, b - 0.2, d - 0.15, h + 0.06, gar.panelen, kern.buitenAchter);
          kern.plek.panelenGarage = [x0 + b / 2, y0 + d / 2, h + 0.3];
        }
      }
      /**
       * Een auto in de garage (idee 123, besluit 259): de kanteldeur staat
       * omhoog, binnen is het donker (of warm met de lamp aan), en de neus van de
       * auto kijkt naar buiten. Laadt hij, dan brandt de laadpaal aan de wand.
       */
      function bouwAutoInGarage(gar, x0, b, yd, h) {
        const xl = x0 + 0.22;
        const xr = x0 + b - 0.22;
        const top = h - 0.32;
        // Binnen, en de opgeklapte deur erboven.
        kern.buitenAchter.push(kern.poly([[xl, yd, 0.02], [xr, yd, 0.02], [xr, yd, top], [xl, yd, top]], `fill="${gar.lampAan ? '#3d3326' : '#141b24'}"`));
        kern.buitenAchter.push(kern.poly([[xl, yd, top], [xr, yd, top], [xr, yd, h - 0.18], [xl, yd, h - 0.18]], 'fill="#4f5c6a"'));
        kern.buitenAchter.push(kern.line([[xl, yd + 0.001, top + 0.07], [xr, yd + 0.001, top + 0.07]], 'stroke="#3b4652" stroke-width="1"'));
        // De laadpaal aan de wand, links binnen.
        kern.buitenAchter.push(kern.poly([[xl + 0.06, yd, 0.42], [xl + 0.16, yd, 0.42], [xl + 0.16, yd, 0.66], [xl + 0.06, yd, 0.66]], 'fill="#c5cfd8"'));
        kern.buitenAchter.push(kern.poly([[xl + 0.085, yd, 0.56], [xl + 0.135, yd, 0.56], [xl + 0.135, yd, 0.61], [xl + 0.085, yd, 0.61]], `fill="${gar.auto.laadt ? kern.KLEUR.mint : '#66727f'}" ${gar.auto.laadt ? 'class="sc-puls"' : ''}`));
        // De neus van de auto: wielen, de voorkant, de lampen en de voorruit.
        const lak = gar.auto.kleur ?? '#8fa3b8';
        const xc = x0 + b / 2 + 0.08;
        const hb = 0.42;
        for (const wx of [xc - 0.4, xc + 0.3]) kern.buitenAchter.push(kern.poly([[wx, yd, 0.02], [wx + 0.1, yd, 0.02], [wx + 0.1, yd, 0.18], [wx, yd, 0.18]], 'fill="#0b1016"'));
        kern.buitenAchter.push(kern.poly([[xc - 0.44, yd, 0.12], [xc + 0.44, yd, 0.12], [xc + 0.44, yd, hb], [xc - 0.44, yd, hb]], `fill="${kern.schaduw(lak, 0.85)}"`));
        for (const lx of [xc - 0.38, xc + 0.26]) kern.buitenAchter.push(kern.poly([[lx, yd, 0.3], [lx + 0.12, yd, 0.3], [lx + 0.12, yd, 0.36], [lx, yd, 0.36]], 'fill="#eef2e6" opacity="0.9"'));
        kern.buitenAchter.push(kern.poly([[xc - 0.36, yd, hb], [xc + 0.36, yd, hb], [xc + 0.28, yd, hb + 0.24], [xc - 0.28, yd, hb + 0.24]], 'fill="#2b4562"'));
      }
      /**
       * Panelen op een plat dak (huis 3.0): rijen schuine panelen op rekken, naar
       * de straat gericht. Hoeveel er liggen, bepaalt het aantal rijen en kolommen.
       */
      function plaatPanelen(x0, y0, b, d, z, aantal, laag = kern.buiten) {
        const n = Math.max(1, Math.min(24, Math.round(aantal)));
        const rijen = Math.max(1, Math.min(4, Math.round(d / 0.42)));
        const kol = Math.ceil(n / rijen);
        const pb = b / kol;
        const pd = d / rijen;
        for (let r = 0; r < rijen; r++) {
          for (let c = 0; c < kol && r * kol + c < n; c++) {
            const px = x0 + c * pb + 0.02;
            const py = y0 + r * pd + 0.04;
            const q = [[px, py, z + 0.16], [px + pb - 0.04, py, z + 0.16], [px + pb - 0.04, py + pd - 0.1, z + 0.02], [px, py + pd - 0.1, z + 0.02]];
            laag.push(kern.poly(q, `fill="url(#${kern.id}-paneel)" stroke="#5b7aa0" stroke-opacity="0.7" stroke-width="0.8"`));
            if (kern.zonKracht > 0) laag.push(kern.poly(q, `fill="url(#${kern.id}-glans)" opacity="0.6"`));
          }
        }
      }
      /**
       * Een jacuzzi (besluit 186): rond, op het terras of in de tuin. Warm is het
       * water lichter en komt er damp vanaf; op zon een gouden rand.
       */
      function bouwJacuzzi(j, xc, yc, r = 0.42, z0 = 0) {
        const h = z0 + 0.34;
        const rand = (z, f = 1) => Array.from({ length: 28 }, (_, i) => {
          const a = (i / 28) * Math.PI * 2;
          return [xc + Math.cos(a) * r * f, yc + Math.sin(a) * r * f, z];
        });
        // De wand: de voorste helft van de cilinder.
        const voor = rand(z0).filter(([, y]) => y >= yc - 0.02).sort((p1, p2) => p1[0] - p2[0]);
        const zijde = [...voor, ...[...voor].reverse().map(([x, y]) => [x, y, h])];
        kern.buiten.push(kern.poly(zijde, `fill="${j.kleur ?? '#4a5a6e'}"`));
        kern.buiten.push(kern.poly(rand(h), `fill="#5d6e83" stroke="${j.zon ? kern.KLEUR.zon : '#7a8a9d'}" stroke-opacity="${j.zon ? 0.9 : 0.6}" stroke-width="${j.zon ? 2 : 1}"`));
        const warm = j.stand === 'verwarmt' || (j.temp ?? 0) >= 34;
        kern.buiten.push(kern.poly(rand(h - 0.02, 0.8), `fill="${warm ? '#5fb6e0' : '#3d6f96'}" opacity="0.95"`));
        // Bubbels als hij aan staat.
        if (j.bubbels) for (const [dx, dy] of [[-0.12, 0.05], [0.1, -0.08], [0.02, 0.14], [0.16, 0.1]]) {
          const c = kern.P(xc + dx, yc + dy, h - 0.01);
          kern.buiten.push(`<circle cx="${c[0]}" cy="${c[1]}" r="${(kern.k * 0.025).toFixed(1)}" fill="#e6f6ff" opacity="0.8"/>`);
        }
        if (warm && !kern.stilGekozen()) for (let i = 0; i < 3; i++) {
          const c = kern.P(xc - 0.15 + i * 0.15, yc, h + 0.2 + i * 0.12);
          kern.buiten.push(`<circle class="sc-damp" style="animation-delay:${i * 0.9}s" cx="${c[0]}" cy="${c[1]}" r="${kern.k * (0.08 + i * 0.03)}" fill="#e2ebf3" opacity="0.2"/>`);
        }
        kern.plek.jacuzzi = [xc, yc, h];
      }
      /** Een carport: vier palen en een plat dak boven de oprit. */
      function bouwCarport() {
        const x0 = -2.88;
        const x1 = -1.08;
        const y0 = -0.35;
        const y1 = kern.D + 1.4;
        const h = 1.05;
        // Eerst de palen achter, dan het dak, dan de palen voor: zo staat het in de diepte goed.
        for (const [x, y] of [[x0, y0], [x1, y0]]) kern.buiten.push(kern.doos(x, y, 0, 0.06, 0.06, h, ['#9aa7b4', '#8592a0', '#6f7c8a']));
        kern.buiten.push(kern.poly([[x0 - 0.04, y0 - 0.05, h], [x1 + 0.1, y0 - 0.05, h], [x1 + 0.1, y1 + 0.1, h], [x0 - 0.04, y1 + 0.1, h]], 'fill="#5b6a7a" fill-opacity="0.5" stroke="#9aa7b4" stroke-opacity="0.6" stroke-width="1"'));
        kern.buiten.push(kern.poly([[x0 - 0.04, y1 + 0.1, h], [x1 + 0.1, y1 + 0.1, h], [x1 + 0.1, y1 + 0.1, h + 0.07], [x0 - 0.04, y1 + 0.1, h + 0.07]], 'fill="#4a5868"'));
        for (const [x, y] of [[x0, y1], [x1, y1]]) kern.buiten.push(kern.doos(x, y, 0, 0.06, 0.06, h, ['#9aa7b4', '#8592a0', '#6f7c8a']));
        // Panelen op de carport (huis 3.0).
        const cp = kern.model.oprit?.carport;
        if (cp && typeof cp === 'object' && cp.panelen) {
          plaatPanelen(x0 + 0.05, y0 + 0.1, x1 - x0 + 0.0, y1 - y0 - 0.2, h + 0.07, cp.panelen);
          kern.plek.panelenCarport = [(x0 + x1) / 2, (y0 + y1) / 2, h + 0.3];
        }
      }
      function bouwAuto(a, isSpook, metPaal) {
        // Een laadpaal en een auto op de oprit, links voor het huis.
        const px = -0.95;
        const py = kern.D + 0.1;
        // De laadpaal staat dichter bij je dan de auto: na de auto getekend, anders viel hij erachter (huis 3.0).
        const paal = () => {
          if (metPaal) kern.buiten.push(kern.doos(px - 0.08, py - 0.08, 0, 0.16, 0.16, 0.75, ['#dfe6ec', '#c5cfd8', '#a7b2bd']));
          if (!isSpook && metPaal) kern.buiten.push(kern.poly([[px - 0.081, py - 0.04, 0.5], [px - 0.081, py + 0.04, 0.5], [px - 0.081, py + 0.04, 0.62], [px - 0.081, py - 0.04, 0.62]], `fill="${a?.stand === 'laadt' ? kern.KLEUR.mint : '#66727f'}"`));
        };
        const x0 = -2.45;
        const y0 = kern.D - 1.75;
        const L = 2.1;
        const B = 0.95;
        // Een tik op de paal of de auto (issue 164): een vlak erboven, als Thuis dat vraagt.
        const tikVlak = (pts) => {
          if (a?.tik) kern.tikkenBoven.push(kern.poly(pts, `class="sc-tik" data-tik="${kern.esc(a.tik)}" fill="transparent" role="button" tabindex="0"${a.tikLabel ? ` aria-label="${kern.esc(a.tikLabel)}"` : ''}`));
        };
        // De auto is weg (issue 164): alleen de laadpaal staat er.
        if (a?.stand === 'weg') {
          paal();
          tikVlak([[px - 0.35, py - 0.35, 0.5], [px + 0.35, py - 0.35, 0.5], [px + 0.35, py + 0.35, 0.5], [px - 0.35, py + 0.35, 0.5]]);
          return;
        }
        if (isSpook) {
          kern.buiten.push(`<g opacity="0.65">${kern.poly([[x0, y0, 0.02], [x0 + B, y0, 0.02], [x0 + B, y0 + L, 0.02], [x0, y0 + L, 0.02]], `fill="none" stroke="${kern.KLEUR.ijs}" stroke-dasharray="5 5"`)}</g>`);
          paal();
          return;
        }
        const lak = a?.kleur ?? '#8fa3b8';
        // Schaduw onder de auto.
        kern.buiten.push(`<g filter="url(#${kern.id}-zacht)" opacity="0.55">${kern.poly([[x0 - 0.05, y0 - 0.05, 0], [x0 + B + 0.12, y0 - 0.05, 0], [x0 + B + 0.12, y0 + L + 0.1, 0], [x0 - 0.05, y0 + L + 0.1, 0]], 'fill="#020509"')}</g>`);
        const h0 = 0.16; // bodemvrijheid
        const h1 = 0.52; // tot de gordel
        const kap0 = y0 + L - 0.62; // waar de motorkap begint
        const ruit0 = y0 + 0.5;
        const ruit1 = y0 + L - 0.75;
        // Romp: zijkant, voorkant, motorkap en kofferbak.
        kern.buiten.push(kern.poly([[x0 + B, y0 + 0.05, h0], [x0 + B, y0 + L, h0], [x0 + B, y0 + L, h1 - 0.06], [x0 + B, kap0, h1], [x0 + B, y0 + 0.05, h1]], `fill="${lak}"`));
        kern.buiten.push(kern.poly([[x0, y0 + L, h0], [x0 + B, y0 + L, h0], [x0 + B, y0 + L, h1 - 0.06], [x0, y0 + L, h1 - 0.06]], `fill="${kern.schaduw(lak, 0.72)}"`));
        kern.buiten.push(kern.poly([[x0, kap0, h1], [x0 + B, kap0, h1], [x0 + B, y0 + L, h1 - 0.06], [x0, y0 + L, h1 - 0.06]], `fill="${kern.schaduw(lak, 1.18)}"`));
        kern.buiten.push(kern.poly([[x0, y0 + 0.05, h1], [x0 + B, y0 + 0.05, h1], [x0 + B, ruit0, h1], [x0, ruit0, h1]], `fill="${kern.schaduw(lak, 1.1)}"`));
        // Cabine: glas rondom, dak erop.
        const d0 = 0.08;
        kern.buiten.push(kern.poly([[x0 + B - d0, ruit0, h1], [x0 + B - d0, ruit1 + 0.2, h1], [x0 + B - d0 - 0.06, ruit1, h1 + 0.3], [x0 + B - d0 - 0.06, ruit0 + 0.12, h1 + 0.3]], 'fill="#18273a"'));
        kern.buiten.push(kern.poly([[x0 + d0, ruit1 + 0.2, h1], [x0 + B - d0, ruit1 + 0.2, h1], [x0 + B - d0 - 0.06, ruit1, h1 + 0.3], [x0 + d0 + 0.06, ruit1, h1 + 0.3]], 'fill="#2b4562"'));
        kern.buiten.push(kern.poly([[x0 + d0 + 0.06, ruit0 + 0.12, h1 + 0.3], [x0 + B - d0 - 0.06, ruit0 + 0.12, h1 + 0.3], [x0 + B - d0 - 0.06, ruit1, h1 + 0.3], [x0 + d0 + 0.06, ruit1, h1 + 0.3]], `fill="${kern.schaduw(lak, 1.25)}"`));
        kern.buiten.push(kern.line([[x0 + B - d0 - 0.03, (ruit0 + ruit1) / 2 + 0.05, h1 + 0.02], [x0 + B - d0 - 0.06, (ruit0 + ruit1) / 2 + 0.03, h1 + 0.29]], `stroke="${lak}" stroke-width="2"`));
        // Wielen, op de zijkant.
        for (const wy of [y0 + 0.42, y0 + L - 0.42]) {
          const pts = [];
          for (let i = 0; i < 20; i++) {
            const t = (i / 20) * Math.PI * 2;
            pts.push([x0 + B + 0.012, wy + Math.cos(t) * 0.19, 0.19 + Math.sin(t) * 0.19]);
          }
          kern.buiten.push(kern.poly(pts, 'fill="#0b1016"'));
          const naaf = [];
          for (let i = 0; i < 16; i++) {
            const t = (i / 16) * Math.PI * 2;
            naaf.push([x0 + B + 0.014, wy + Math.cos(t) * 0.09, 0.19 + Math.sin(t) * 0.09]);
          }
          kern.buiten.push(kern.poly(naaf, 'fill="#7d8a98"'));
        }
        // Koplampen als een lichtstreep.
        kern.buiten.push(kern.poly([[x0 + 0.1, y0 + L + 0.002, h1 - 0.16], [x0 + B - 0.1, y0 + L + 0.002, h1 - 0.16], [x0 + B - 0.1, y0 + L + 0.002, h1 - 0.11], [x0 + 0.1, y0 + L + 0.002, h1 - 0.11]], 'fill="#e9f1f8" opacity="0.9"'));
        paal();
        tikVlak([[-2.6, kern.D - 1.9, 0.45], [px + 0.3, kern.D - 1.9, 0.45], [px + 0.3, py + 0.35, 0.45], [-2.6, py + 0.35, 0.45]]);
        // De kabel naar de laadpaal.
        if (a?.stand === 'laadt') {
          const p1 = kern.P(px - 0.08, py, 0.55);
          const p2 = kern.P(x0 + B, y0 + L - 0.25, 0.45);
          kern.buiten.push(`<path d="M ${p1[0]} ${p1[1]} C ${p1[0] - 10} ${p1[1] + 30}, ${p2[0] + 14} ${p2[1] + 28}, ${p2[0]} ${p2[1]}" fill="none" stroke="#2b3542" stroke-width="3"/>`);
          kern.buiten.push(`<path class="sc-stroom" d="M ${p1[0]} ${p1[1]} C ${p1[0] - 10} ${p1[1] + 30}, ${p2[0] + 14} ${p2[1] + 28}, ${p2[0]} ${p2[1]}" fill="none" stroke="${a.bron === 'net' ? kern.KLEUR.net : kern.KLEUR.zon}" stroke-width="2" stroke-dasharray="1 9" stroke-linecap="round"/>`);
        }
      }
      /**
       * De camera met schijnwerper (rapport 15 oktober): aan de gevel bij de
       * oprit, hoog op de hoek. Staat de schijnwerper aan, dan een bundel warm
       * licht over de oprit; ziet hij beweging, dan een koele bundel en een ring.
       */
      function bouwCamera(cam) {
        // Op een paal naast het huis, tussen de gevel en de oprit (de bewoner, 16 oktober).
        const px = -0.55;
        const y = kern.D + 0.35;
        const z = 1.3;
        kern.buiten.push(kern.doos(px - 0.04, y - 0.04, 0, 0.08, 0.08, z, ['#5a6878', '#4a5868', '#3c4858']));
        kern.buiten.push(kern.doos(px - 0.1, y - 0.08, z, 0.16, 0.16, 0.12, ['#e5ebf0', '#cfd8e0', '#b3bec9']));
        const lens = kern.P(px - 0.02, y + 0.081, z + 0.06);
        kern.buiten.push(`<circle cx="${lens[0]}" cy="${lens[1]}" r="${(kern.k * 0.03).toFixed(1)}" fill="#1b2633"/><circle cx="${lens[0]}" cy="${lens[1]}" r="${(kern.k * 0.012).toFixed(1)}" fill="${cam.beweging ? kern.KLEUR.mint : cam.opname ? '#ff5d5d' : '#4d7eac'}"/>`);
        kern.plek.camera = [px, y, z + 0.06];
        if (cam.aan || cam.beweging) {
          const licht = cam.beweging && !cam.aan ? kern.KLEUR.ijs : '#FFF1C9';
          const bron = kern.P(px - 0.05, y, z);
          const a1 = kern.P(-2.6, kern.D - 1.2, 0.01);
          const a2 = kern.P(-1.3, kern.D + 0.9, 0.01);
          kern.buiten.push(`<polygon points="${bron[0]},${bron[1]} ${a1[0]},${a1[1]} ${a2[0]},${a2[1]}" fill="${licht}" opacity="0.12"/>`);
          const c = kern.P(-1.95, kern.D - 0.2, 0.01);
          kern.buiten.push(`<ellipse cx="${c[0]}" cy="${c[1]}" rx="${kern.k * 0.9}" ry="${kern.k * 0.4}" fill="${licht}" opacity="0.18" filter="url(#${kern.id}-zacht)"/>`);
          if (cam.beweging) kern.buiten.push(`<ellipse class="sc-beweging" cx="${c[0]}" cy="${c[1]}" rx="${kern.k * 0.5}" ry="${kern.k * 0.22}" fill="none" stroke="${kern.KLEUR.mint}" stroke-width="2" stroke-opacity="0.8"/>`);
        }
      }
      /** Een terras rechts naast het huis: tegels, een tafel en twee stoelen (besluit 113). */
      function bouwTerras(t) {
        const x0 = kern.W + 0.3;
        const x1 = kern.W + 2.05;
        const y0 = 0.45;
        const y1 = kern.D + 0.4;
        kern.buiten.push(kern.poly([[x0, y0, 0.006], [x1, y0, 0.006], [x1, y1, 0.006], [x0, y1, 0.006]], 'fill="#3b4652"'));
        for (let x = x0 + 0.35; x < x1 - 0.05; x += 0.35) kern.buiten.push(kern.line([[x, y0, 0.008], [x, y1, 0.008]], 'stroke="#2c353f" stroke-width="1"'));
        for (let y = y0 + 0.35; y < y1 - 0.05; y += 0.35) kern.buiten.push(kern.line([[x0, y, 0.008], [x1, y, 0.008]], 'stroke="#2c353f" stroke-width="1"'));
        const tx = x0 + 0.75;
        const ty = (y0 + y1) / 2 - 0.2;
        kern.buiten.push(kern.doos(tx, ty, 0.42, 0.5, 0.4, 0.05, ['#c9d3dc', '#9aa7b4', '#7d8a97']));
        kern.buiten.push(kern.doos(tx + 0.22, ty + 0.17, 0, 0.06, 0.06, 0.42, ['#7d8a97', '#6b7885', '#5d6976']));
        for (const sx of [tx - 0.32, tx + 0.62]) kern.buiten.push(kern.doos(sx, ty + 0.08, 0, 0.22, 0.24, 0.26, ['#55626f', '#46525f', '#3a4552']));
        if (t.lampAan) {
          const c = kern.P(tx + 0.25, ty + 0.2, 0.47);
          kern.buiten.push(`<ellipse cx="${c[0]}" cy="${c[1]}" rx="${kern.k * 0.6}" ry="${kern.k * 0.28}" fill="#FFD39A" opacity="0.25" filter="url(#${kern.id}-zacht)"/>`);
        }
      }
      /** Een voortuin voor het huis: gras met een lage haag langs de rand (besluit 113). */
      function bouwVoortuin(t) {
        const x0 = 1.3;
        const x1 = kern.W + 0.1;
        // Op het eiland (huis 3.0) staat de haag op de rand van de doorsnede.
        const yh = kern.eiland ? kern.eiland.yF - 0.16 : kern.D + 1.55;
        kern.buiten.push(kern.doos(x0, yh, 0, x1 - x0, 0.14, 0.18, ['#2f5a3c', '#26492f', '#1f3d27']));
        for (let x = x0 + 0.4; x < x1 - 0.2; x += 0.7) {
          const c = kern.P(x, kern.eiland ? kern.D + 0.4 : kern.D + 0.9, 0.02);
          kern.buiten.push(`<circle cx="${c[0]}" cy="${c[1]}" r="${kern.k * 0.06}" fill="${t.lampAan ? '#FFD39A' : '#6e9a6f'}" opacity="0.8"/>`);
        }
      }
      /** Een balkon aan de zijgevel, op de eerste verdieping, met een reling (besluit 113). */
      function bouwBalkon(b, z = kern.FH) {
        const y0 = 0.35;
        const y1 = 1.15;
        kern.buiten.push(kern.doos(kern.W, y0, z - 0.06, 0.55, y1 - y0, 0.06, ['#9aa7b4', '#7d8a97', '#6b7885']));
        const rz = z + 0.42;
        kern.buiten.push(kern.line([[kern.W + 0.55, y0, rz], [kern.W + 0.55, y1, rz]], 'stroke="#C9D6E2" stroke-width="1.6"'));
        kern.buiten.push(kern.line([[kern.W, y1, rz], [kern.W + 0.55, y1, rz]], 'stroke="#C9D6E2" stroke-width="1.6"'));
        for (let y = y0; y <= y1 + 0.001; y += 0.2) kern.buiten.push(kern.line([[kern.W + 0.55, y, z], [kern.W + 0.55, y, rz]], 'stroke="#C9D6E2" stroke-opacity="0.7" stroke-width="1"'));
        if (b.lampAan) {
          const c = kern.P(kern.W + 0.28, (y0 + y1) / 2, z + 0.02);
          kern.buiten.push(`<ellipse cx="${c[0]}" cy="${c[1]}" rx="${kern.k * 0.4}" ry="${kern.k * 0.2}" fill="#FFD39A" opacity="0.3" filter="url(#${kern.id}-zacht)"/>`);
        }
      }
      function bouwTuin(t) {
        // Het tuinhuis rechtsachter, met een overstek en de lamp eronder; lampen langs het pad.
        // Alleen als de tuin er een heeft (`tuinhuis: false` is geen tuinhuis).
        const x0 = kern.W + 0.85;
        const y0 = -1.75;
        if (t.tuinhuis !== false) {
          kern.buiten.push(kern.doos(x0, y0, 0, 1.05, 0.95, 0.85, ['#3a4656', '#2f3a48', '#46525f']));
          kern.buiten.push(kern.poly([[x0 - 0.05, y0 + 0.95, 0.88], [x0 + 1.1, y0 + 0.95, 0.88], [x0 + 1.1, y0 + 1.45, 0.82], [x0 - 0.05, y0 + 1.45, 0.82]], `fill="${kern.model.weer === 'sneeuw' ? '#eef3f8' : '#55626f'}"`));
          kern.buiten.push(kern.poly([[x0 + 1.051, y0 + 0.3, 0.05], [x0 + 1.051, y0 + 0.62, 0.05], [x0 + 1.051, y0 + 0.62, 0.62], [x0 + 1.051, y0 + 0.3, 0.62]], `fill="${t.tuinhuisAan ? '#F4C27E' : '#1b2633'}"`));
        }
        // Panelen op het schuurtje (huis 3.0): een plat rek op het dak.
        if (t.tuinhuis !== false && t.tuinhuisPanelen) {
          plaatPanelen(x0 + 0.05, y0 + 0.05, 0.95, 0.85, 0.89, t.tuinhuisPanelen);
          kern.plek.panelenSchuur = [x0 + 0.5, y0 + 0.45, 1.1];
        }
        // De jacuzzi (besluit 186): op het gras voor het schuurtje.
        if (t.jacuzzi) bouwJacuzzi(t.jacuzzi, kern.W + 1.25, -0.25, 0.42, 0);
        if (t.tuinhuis !== false && t.overstekAan) {
          const c = kern.P(x0 + 0.5, y0 + 1.2, 0.02);
          kern.buiten.push(`<ellipse cx="${c[0]}" cy="${c[1]}" rx="${kern.k * 0.7}" ry="${kern.k * 0.3}" fill="${t.overstekKleur ?? '#FFD39A'}" opacity="0.28" filter="url(#${kern.id}-zacht)"/>`);
        }
        // De border (rapport 15 oktober): lage lampjes langs de rand van het gras, per groep in zijn kleur.
        const rand = (t.lampen ?? []).flatMap((lamp, g2) => Array.from({ length: 4 }, (_, i) => ({ lamp, x: kern.W + 0.42 + (g2 * 4 + i) * 0.42 })));
        for (const { lamp, x: lx } of rand.filter((r) => r.x < kern.W + 2.0)) {
          const ly = 0.18;
          kern.buiten.push(kern.doos(lx - 0.025, ly - 0.025, 0, 0.05, 0.05, 0.16, ['#6b7a8a', '#56636f', '#47525d']));
          const kop = kern.P(lx, ly, 0.18);
          kern.buiten.push(`<circle cx="${kop[0]}" cy="${kop[1]}" r="${(kern.k * 0.05).toFixed(1)}" fill="${lamp.aan ? lamp.kleur ?? '#FFD39A' : '#3c4755'}"/>`);
          if (lamp.aan) kern.buiten.push(`<circle cx="${kop[0]}" cy="${kop[1]}" r="${(kern.k * 0.28).toFixed(1)}" fill="${lamp.kleur ?? '#FFD39A'}" opacity="0.4" filter="url(#${kern.id}-zacht)"/>`);
        }
        if (t.zonnescherm) {
          // Het zonnescherm boven het terras, uitgerold naar wat het nu is.
          const uit = Math.max(0.08, t.zonnescherm.dicht ?? 0) * 0.95;
          kern.buiten.push(kern.doos(kern.W + 0.01, 0.08, 1.12, 0.1, 0.9, 0.1, ['#8a97a5', '#7a8795', '#6a7785']));
          if (uit > 0.1) kern.buiten.push(kern.poly([[kern.W + 0.1, 0.1, 1.15], [kern.W + 0.1, 0.96, 1.15], [kern.W + 0.1 + uit, 0.96, 0.85], [kern.W + 0.1 + uit, 0.1, 0.85]], 'fill="#c98a4a" opacity="0.92"'));
        }
      }
      function bouwNet() {
        // In de wereld (huis 3.0): een aansluitkast aan de straat, op de rand.
        if (kern.eiland) {
          kern.buiten.push(kern.doos(kern.netStraat[0] - 0.13, kern.netStraat[1] - 0.09, 0, 0.26, 0.18, 0.42, ['#6b7a8a', '#56636f', '#47525d']));
          const t = kern.P(kern.netStraat[0], kern.netStraat[1] + 0.09, 0.24);
          kern.buiten.push(`<text x="${t[0]}" y="${t[1] + 4}" text-anchor="middle" font-family="Figtree, sans-serif" font-size="10" font-weight="700" fill="#cfd8e1">⚡</text>`);
          return;
        }
        // Met een voordeur zit de aansluiting in de meterkast in de hal (rapport 15 oktober):
        // dan alleen het putje aan de straat. Anders het kastje links voor, zoals eerst.
        if (kern.voordeur) {
          const c = kern.P(kern.netStraat[0], kern.netStraat[1], 0.004);
          kern.buiten.push(`<rect x="${c[0] - kern.k * 0.09}" y="${c[1] - kern.k * 0.05}" width="${kern.k * 0.18}" height="${kern.k * 0.1}" rx="2" fill="#2a3442" stroke="#4a5769"/>`);
          return;
        }
        const x = -0.6;
        const y = kern.D + 1.25;
        kern.buiten.push(kern.doos(x - 0.2, y - 0.15, 0, 0.4, 0.3, 0.55, ['#59677a', '#4a5769', '#3d495a']));
        const t = kern.P(x, y + 0.15, 0.3);
        kern.buiten.push(`<text x="${t[0]}" y="${t[1] + 4}" text-anchor="middle" font-family="Figtree, sans-serif" font-size="11" font-weight="700" fill="#cfd8e1">⚡</text>`);
      }
      /*
       * ---- het eiland (huis 3.0) ----
       * Het perceel zweeft in de lucht. De voorkant is een rechte doorsnede: gras
       * met een rand, dan lagen aarde die naar onder wegvagen. Met een kelder een
       * nis in die doorsnede, precies onder het huis, zodat de kelder open ligt.
       * De achterhoeken zijn rond; een haag langs de achterkant, bomen in de
       * hoeken in het seizoen van nu, en de schaduw van het huis die met de zon
       * meedraait.
       */
      /**
       * De vage lagen (25 oktober 2026): ingezoomd op een verdieping de etage
       * eronder, die naar het eiland wegloopt, en erboven de omtrek van de
       * volgende etage of het dak, die naar boven vervaagt. Vaag genoeg dat de
       * kamers van deze etage het beeld blijven.
       */
      function bouwLagen() {
        const kleur = kern.licht ? '#9fb0c2' : '#41536a';
        const rand = kern.licht ? '#5d6f83' : '#C9D6E2';
        const gid = `${kern.id}-laag`;
        const verloop = (naam, ya, yb, c, o0, o1) =>
          kern.defs.push(`<linearGradient id="${gid}-${naam}" gradientUnits="userSpaceOnUse" x1="0" y1="${ya.toFixed(1)}" x2="0" y2="${yb.toFixed(1)}"><stop offset="0" stop-color="${c}" stop-opacity="${o0}"/><stop offset="1" stop-color="${c}" stop-opacity="${o1}"/></linearGradient>`);
        // Eronder: de gevels van één etage, die naar het gras wegloopt.
        if (kern.lagen.zak && kern.eiland) {
          const z0 = -kern.lagen.zak;
          const [ya, yb] = [kern.P(0, kern.D, 0)[1], kern.P(kern.W, kern.D, z0)[1]];
          verloop('o', ya, yb, kleur, 0.5, 0.06);
          verloop('or', ya, yb, rand, 0.3, 0.02);
          // Na de haag en de bomen achterin, die op het gezakte eiland staan; voor het huis.
          const onder = [];
          onder.push(kern.poly([[kern.W, 0, z0], [kern.W, kern.D, z0], [kern.W, kern.D, 0], [kern.W, 0, 0]], `fill="url(#${gid}-o)" opacity="0.75"`));
          onder.push(kern.poly([[0, kern.D, z0], [kern.W, kern.D, z0], [kern.W, kern.D, 0], [0, kern.D, 0]], `fill="url(#${gid}-o)"`));
          for (const rx of [0.35, kern.W * 0.55]) onder.push(kern.poly([[rx, kern.D + 0.002, z0 + 0.45], [rx + 0.7, kern.D + 0.002, z0 + 0.45], [rx + 0.7, kern.D + 0.002, -0.35], [rx, kern.D + 0.002, -0.35]], `fill="${kern.nacht ? '#F4C27E' : '#8fb1d1'}" opacity="${kern.nacht ? 0.12 : 0.1}"`));
          onder.push(kern.line([[0, kern.D, 0], [0, kern.D, z0]], `stroke="url(#${gid}-or)" stroke-width="1.6"`));
          onder.push(kern.line([[kern.W, 0, 0], [kern.W, 0, z0]], `stroke="url(#${gid}-or)" stroke-width="1.2"`));
          onder.push(kern.line([[kern.W, kern.D, 0], [kern.W, kern.D, z0]], `stroke="url(#${gid}-or)" stroke-width="1.6"`));
          kern.buitenAchter.push(onder.join(''));
        }
        // Erboven: de omtrek van de volgende etage, of het dak als dit de bovenste is.
        const z1 = kern.Ht;
        const top = kern.lagen.dak ? z1 + kern.R : z1 + kern.FH;
        const [ya, yb] = [kern.P(0, kern.D, z1)[1], kern.P(kern.W, 0, kern.lagen.dak ? top : z1 + kern.FH * 0.6)[1]];
        verloop('b', ya, yb, rand, 0.42, kern.lagen.dak ? 0.1 : 0);
        verloop('bv', ya, yb, kleur, 0.45, 0);
        const stijl = `stroke="url(#${gid}-b)" stroke-width="1.6" stroke-linejoin="round" stroke-dasharray="6 5"`;
        const voor = [];
        if (kern.lagen.dak) {
          voor.push(kern.poly([[kern.W / 2, 0, top], [kern.W, 0, z1], [kern.W, kern.D, z1], [kern.W / 2, kern.D, top]], `fill="url(#${gid}-bv)"`));
          voor.push(kern.line([[0, kern.D, z1], [kern.W / 2, kern.D, top], [kern.W, kern.D, z1]], stijl));
          voor.push(kern.line([[kern.W / 2, kern.D, top], [kern.W / 2, 0, top], [kern.W, 0, z1]], stijl));
        } else {
          voor.push(kern.poly([[kern.W, 0, z1], [kern.W, kern.D, z1], [kern.W, kern.D, top], [kern.W, 0, top]], `fill="url(#${gid}-bv)"`));
          voor.push(kern.line([[0, kern.D, z1], [0, kern.D, top]], stijl));
          voor.push(kern.line([[0, 0, z1], [0, 0, top]], stijl));
          voor.push(kern.line([[kern.W, kern.D, z1], [kern.W, kern.D, top]], stijl));
          voor.push(kern.line([[kern.W, 0, z1], [kern.W, 0, top]], stijl));
        }
        kern.burenVoor.push(kern.lichter(voor.join('')));
      }

      function bouwEiland() {
        const { x0, x1, y0, yF, nis, T } = kern.eiland;
        const r = 0.5;
        const zNis = -kern.FH - 0.12;
        const boog = (cx, cy, a0, a1) => Array.from({ length: 8 }, (_, i) => {
          const a = a0 + ((a1 - a0) * i) / 7;
          return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0];
        });
        const top = [[x0, yF, 0], ...boog(x0 + r, y0 + r, Math.PI, 1.5 * Math.PI), ...boog(x1 - r, y0 + r, 1.5 * Math.PI, 2 * Math.PI), [x1, yF, 0]];
        if (nis) top.push([kern.W, yF, 0], [kern.W, kern.D, 0], [0, kern.D, 0], [0, yF, 0]);
        const sneeuw = kern.model.weer === 'sneeuw';
        const aardeBoven = kern.licht ? '#9a8165' : '#4a3a2b';
        const aardeOnder = kern.licht ? '#7d6650' : '#2a2018';
        kern.defs.push(`
          <linearGradient id="${kern.id}-aarde" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${aardeBoven}"/><stop offset="0.55" stop-color="${aardeOnder}"/><stop offset="1" stop-color="${kern.schaduw(aardeOnder, 0.8)}"/></linearGradient>
          <linearGradient id="${kern.id}-rots" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${kern.schaduw(aardeOnder, 0.75)}"/><stop offset="1" stop-color="${kern.schaduw(aardeOnder, 0.6)}" stop-opacity="0"/></linearGradient>
          <linearGradient id="${kern.id}-aarde-zij" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${kern.schaduw(aardeBoven, 0.78)}"/><stop offset="0.55" stop-color="${kern.schaduw(aardeOnder, 0.75)}"/><stop offset="1" stop-color="${kern.schaduw(aardeOnder, 0.6)}"/></linearGradient>
          <radialGradient id="${kern.id}-gloed-onder"><stop offset="0" stop-color="${kern.nacht ? '#3a4f8a' : '#8fb4e0'}" stop-opacity="${kern.nacht ? 0.35 : 0.28}"/><stop offset="1" stop-color="#8fb4e0" stop-opacity="0"/></radialGradient>
          <clipPath id="${kern.id}-eiland">${kern.poly(top, '')}</clipPath>`);
        // Een zachte gloed onder het eiland: het zweeft.
        const onder = kern.P((x0 + x1) / 2, (y0 + yF) / 2, -T - 0.5);
        kern.grond.push(`<ellipse cx="${onder[0]}" cy="${onder[1]}" rx="${(kern.k * (x1 - x0) * 0.6).toFixed(1)}" ry="${(kern.k * 1.0).toFixed(1)}" fill="url(#${kern.id}-gloed-onder)"/>`);
        // De onderkant: rots die naar een punt toe loopt en in de lucht wegvaagt.
        // Facetten van rots, elk iets anders van tint, die naar onder in de lucht vervagen.
        const punt = [(x0 + x1) * 0.42, yF - 0.6, -T - 0.55];
        const facetten = [
          [[[x0, yF, -T], [x0 + 1.4, yF, -T], punt], 0.95],
          [[[x0 + 1.4, yF, -T], [(x0 + x1) * 0.62, yF, -T], punt], 1.1],
          [[[(x0 + x1) * 0.62, yF, -T], [x1, yF, -T], [x1 - 0.8, yF - 1.0, -T - 0.3], punt], 0.85],
          [[[x1, yF, -T], [x1, y0 + r, -T * 0.8], [x1 - 0.8, yF - 1.0, -T - 0.3]], 0.7],
        ];
        for (const [pts, f0] of facetten) {
          const f = Number(f0);
          const fid = `${kern.id}-rots-${Math.round(f * 100)}`;
          kern.defs.push(`<linearGradient id="${fid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${kern.schaduw(aardeOnder, f)}"/><stop offset="0.7" stop-color="${kern.schaduw(aardeOnder, f * 0.8)}" stop-opacity="0.55"/><stop offset="1" stop-color="${kern.schaduw(aardeOnder, f * 0.7)}" stop-opacity="0"/></linearGradient>`);
          kern.grond.push(kern.poly(pts, `fill="url(#${fid})"`));
        }
        // De rechterkant en de voorkant: aarde die naar onder wegvaagt.
        kern.grond.push(kern.poly([[x1, yF, 0], [x1, y0 + r, 0], [x1, y0 + r, -T * 0.8], [x1, yF, -T]], `fill="url(#${kern.id}-aarde-zij)"`));
        const voor = (xa, xb, za, zb) => kern.grond.push(kern.poly([[xa, yF, za], [xb, yF, za], [xb, yF, zb], [xa, yF, zb]], `fill="url(#${kern.id}-aarde)"`));
        if (nis) {
          voor(x0, 0, 0, -T);
          voor(kern.W, x1, 0, -T);
          kern.grond.push(kern.poly([[0, yF, zNis], [kern.W, yF, zNis], [kern.W, yF, -T], [0, yF, -T]], `fill="url(#${kern.id}-aarde)"`));
          // De nis: de linkerwand en de bodem, in het licht van de kelder.
          kern.grond.push(kern.poly([[0, kern.D, 0], [0, yF, 0], [0, yF, zNis], [0, kern.D, zNis]], `fill="${kern.schaduw(aardeBoven, 0.62)}"`));
          kern.grond.push(kern.poly([[0, kern.D, zNis], [kern.W, kern.D, zNis], [kern.W, yF, zNis], [0, yF, zNis]], `fill="${kern.schaduw(aardeBoven, 0.9)}"`));
        } else voor(x0, x1, 0, -T);
        // Lagen in de aarde, en een paar stenen.
        for (const [f, o] of [[0.18, 0.45], [0.42, 0.3], [0.7, 0.18]]) {
          const z = -T * f;
          const golf = (xa, xb) => Array.from({ length: 9 }, (_, i) => [xa + ((xb - xa) * i) / 8, yF + 0.002, z + Math.sin(i * 1.7 + f * 9) * 0.035]);
          const stukken = nis && z > zNis ? [[x0, 0], [kern.W, x1]] : [[x0, x1]];
          for (const [xa, xb] of stukken) kern.grond.push(kern.line(golf(xa, xb), `stroke="${kern.licht ? '#6b5642' : '#5a4634'}" stroke-opacity="${o}" stroke-width="2.4" stroke-linecap="round"`));
          kern.grond.push(kern.line(Array.from({ length: 7 }, (_, i) => [x1 + 0.002, yF - ((yF - y0 - r) * i) / 6, z * 0.95 + Math.sin(i * 2.1 + f * 7) * 0.03]), `stroke="#3d3026" stroke-opacity="${o}" stroke-width="2" stroke-linecap="round"`));
        }
        let zaad = 11;
        const rnd = () => ((zaad = (zaad * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 16; i++) {
          const x = x0 + rnd() * (x1 - x0);
          const z = -0.15 - rnd() * T * 0.6;
          if (nis && x > -0.05 && x < kern.W + 0.05 && z > zNis) continue;
          const c = kern.P(x, yF + 0.003, z);
          kern.grond.push(`<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(kern.k * (0.03 + rnd() * 0.05)).toFixed(1)}" ry="${(kern.k * 0.025).toFixed(1)}" fill="${kern.licht ? '#7a6550' : '#5e4a38'}" opacity="0.8"/>`);
        }
        // Het gras erop, met een rand die het licht vangt.
        kern.grond.push(kern.poly(top, `fill="url(#${kern.id}-gras)"`));
        if (sneeuw) kern.grond.push(kern.poly(top, 'fill="#e8eef5" opacity="0.72"'));
        const randKleur = sneeuw ? '#f2f6fa' : kern.licht ? '#9cc4a6' : kern.winter ? '#4a5d6e' : kern.nacht ? '#2a4a3a' : '#3f7a58';
        const rand = (xa, xb) => kern.grond.push(kern.poly([[xa, yF, 0], [xb, yF, 0], [xb, yF, -0.07], [xa, yF, -0.07]], `fill="${randKleur}"`));
        if (nis) {
          rand(x0, 0);
          rand(kern.W, x1);
        } else rand(x0, x1);
        kern.grond.push(kern.poly([[x1, yF, 0], [x1, y0 + r, 0], [x1, y0 + r, -0.07], [x1, yF, -0.07]], `fill="${kern.schaduw(randKleur, 0.8)}"`));
        // Een lijn licht langs de snede, zodat de rand scherp staat.
        kern.grond.push(kern.line([[x0, yF + 0.004, -0.07], [nis ? 0 : x1, yF + 0.004, -0.07]], `stroke="#ffffff" stroke-opacity="${kern.nacht ? 0.06 : 0.14}" stroke-width="1.2"`));
        if (nis) kern.grond.push(kern.line([[kern.W, yF + 0.004, -0.07], [x1, yF + 0.004, -0.07]], `stroke="#ffffff" stroke-opacity="${kern.nacht ? 0.06 : 0.14}" stroke-width="1.2"`));
        // Textuur in het gras: sprietjes en vlekjes; in de zomer bloemen, in de herfst bladeren.
        {
          let z2 = 29;
          const rnd2 = () => ((z2 = (z2 * 16807) % 2147483647) / 2147483647);
          const bloem = kern.model.seizoen === 'herfst' ? ['#e0a04a', '#c97a36', '#b5652e'] : !kern.winter && !sneeuw ? ['#f6d36b', '#f2a7c3', '#ffffff'] : null;
          for (let i = 0; i < 90; i++) {
            const x = x0 + 0.15 + rnd2() * (x1 - x0 - 0.3);
            const y = y0 + 0.3 + rnd2() * (yF - y0 - 0.45);
            if (x > -0.1 && x < kern.W + 0.1 && y > -0.1 && y < kern.D + 0.1) continue;
            if ((kern.model.oprit || kern.model.auto) && x > -2.8 && x < -1.15 && y > -0.45) continue;
            const c = kern.P(x, y, 0.004);
            const kleur = bloem && i % 3 === 0 ? bloem[i % bloem.length] : sneeuw ? '#ffffff' : '#000000';
            const o = bloem && i % 3 === 0 ? 0.75 : sneeuw ? 0.5 : 0.12;
            kern.grond.push(`<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(kern.k * (bloem && i % 3 === 0 ? 0.022 : 0.03)).toFixed(1)}" fill="${kleur}" opacity="${o}"/>`);
          }
        }
        // De tuin lichter, de oprit van klinkers.
        if (kern.model.tuin) kern.grond.push(kern.poly([[kern.W + 0.3, y0 + 0.3, 0.003], [x1 - 0.12, y0 + 0.3, 0.003], [x1 - 0.12, yF - 0.12, 0.003], [kern.W + 0.3, yF - 0.12, 0.003]], `fill="${sneeuw ? '#f4f7fa' : kern.licht ? (kern.winter ? '#d3dce5' : '#86b294') : kern.winter ? '#33465a' : kern.nacht ? '#173326' : '#26503a'}"`));
        if (kern.model.auto || kern.model.oprit || kern.spook(kern.model, 'auto')) {
          kern.grond.push(kern.poly([[-2.75, -0.4, 0.005], [-1.2, -0.4, 0.005], [-1.2, yF, 0.005], [-2.75, yF, 0.005]], `fill="${sneeuw ? '#cfd8e1' : kern.licht ? '#b9c2cb' : '#1d2933'}"`));
          kern.grond.push(kern.poly([[-2.75, yF, 0], [-1.2, yF, 0], [-1.2, yF, -0.07], [-2.75, yF, -0.07]], `fill="${kern.licht ? '#8d98a3' : '#2a3542'}"`));
        }
        // Een pad van tegels naar de voordeur, tot aan de rand.
        if (kern.voordeur && !nis) {
          for (let y = kern.D + 0.1; y < yF - 0.15; y += 0.3) kern.grond.push(kern.poly([[kern.voordeur.x0, y, 0.004], [kern.voordeur.x1, y, 0.004], [kern.voordeur.x1, y + 0.22, 0.004], [kern.voordeur.x0, y + 0.22, 0.004]], 'fill="#ffffff" opacity="0.1"'));
        }
        // De schaduw van de echte zon (schets Wand-Huis-Ligging): van de zon af, langer als hij laag staat.
        if (!kern.nacht && kern.echteZon && kern.echteZon.el > 2) {
          const [zx, zy] = kern.opGrond(kern.echteZon.az);
          const lang = Math.min(0.55, 0.22 / Math.tan((Math.max(6, kern.echteZon.el) * Math.PI) / 180));
          const val = (x, y, z) => [x - zx * z * lang, y - zy * z * lang, 0.006];
          const nokPunten = kern.model.dak?.nok === 'langs' ? [[0, kern.D / 2, kern.Ht + kern.R], [kern.W, kern.D / 2, kern.Ht + kern.R]] : [[kern.W / 2, 0, kern.Ht + kern.R], [kern.W / 2, kern.D, kern.Ht + kern.R]];
          const hoeken = [[0, 0, 0], [kern.W, 0, 0], [kern.W, kern.D, 0], [0, kern.D, 0], [0, 0, kern.Ht], [kern.W, 0, kern.Ht], [kern.W, kern.D, kern.Ht], [0, kern.D, kern.Ht], ...nokPunten].map(([x, y, z]) => val(x, y, z));
          const sterkte = (0.22 + 0.3 * kern.zonKracht) * (1 - 0.5 * (kern.model.wolken ?? 0));
          kern.grond.push(`<g clip-path="url(#${kern.id}-eiland)"><g filter="url(#${kern.id}-zacht)" opacity="${sterkte.toFixed(2)}">${kern.poly(kern.omhulsel(hoeken), `fill="${kern.licht ? '#2c3a48' : '#02050a'}"`)}</g></g>`);
        } else if (!kern.nacht && kern.model.zon?.stand != null) {
          const f = Math.max(0, Math.min(1, kern.model.zon.stand));
          const hoog = Math.max(0.3, Math.sin(Math.PI * f));
          // Van de zon af: komt hij rechts op, dan valt de schaduw 's ochtends naar links.
          const dx = -kern.opkomst * Math.cos(Math.PI * f) * 0.75 * (1.25 - hoog);
          const dy = 0.28 * (1.3 - hoog);
          const val = (x, y, z) => [x + dx * z, y + dy * z, 0.006];
          const hoeken = [[0, 0, 0], [kern.W, 0, 0], [kern.W, kern.D, 0], [0, kern.D, 0], [0, 0, kern.Ht], [kern.W, 0, kern.Ht], [kern.W, kern.D, kern.Ht], [0, kern.D, kern.Ht], [kern.W / 2, 0, kern.Ht + kern.R], [kern.W / 2, kern.D, kern.Ht + kern.R]].map(([x, y, z]) => val(x, y, z));
          const sterkte = (0.22 + 0.3 * kern.zonKracht) * (1 - 0.5 * (kern.model.wolken ?? 0));
          kern.grond.push(`<g clip-path="url(#${kern.id}-eiland)"><g filter="url(#${kern.id}-zacht)" opacity="${sterkte.toFixed(2)}">${kern.poly(kern.omhulsel(hoeken), `fill="${kern.licht ? '#2c3a48' : '#02050a'}"`)}</g></g>`);
        }
        // Een haag langs de achterkant.
        const haag = sneeuw ? ['#eef3f8', '#d6dee7', '#c3ccd6'] : kern.winter ? ['#3d5262', '#33465a', '#2a3a4c'] : ['#3d7a55', '#2f6446', '#27553b'];
        // Niet onder een opgetilde etage (de vage lagen): daar schijnt hij als een groene band door de etage eronder.
        if (!kern.lagen?.zak) kern.buitenAchter.push(kern.doos(x0 + r, y0 + 0.08, 0, x1 - x0 - 2 * r, 0.16, 0.22, haag));
        // Bomen in de achterhoeken, en een kleine voorin rechts als er plek is.
        kern.boom(x0 + 0.42, y0 + 0.45, 1.15, kern.buitenAchter);
        kern.boom(x1 - 0.45, y0 + 0.42, 1.3, kern.buitenAchter);
        if (!kern.model.terras && !kern.model.tuin) kern.boom(x1 - 0.35, yF - 0.4, 0.85, kern.buiten);
        // Een lantaarn aan de straat.
        kern.lantaarn(x0 + 0.22, yF - 0.18);
        // Een kompas op het gras voor het huis (huis 3.0), als het model de ligging kent.
        if (kern.model.kompas) {
          // Groot op de oprit als er geen auto staat (zoals bij Zonnepanelen), anders klein voor het huis.
          const groot = kern.model.kompas.groot && !kern.model.auto && !kern.model.oprit?.auto;
          kern.kompas(kern.model.kompas.voorgevelDeg ?? 180, groot ? -2.05 : -0.62, yF - (groot ? 1.05 : 0.42), groot ? 1.0 : 0.34);
        }
      }

    return { bouwBuitenunit, bouwVoordeur, bouwBatterij, bouwGarage, plaatPanelen, bouwJacuzzi, bouwCarport, bouwAuto, bouwCamera, bouwTerras, bouwVoortuin, bouwBalkon, bouwTuin, bouwNet, bouwLagen, bouwEiland };
  };
})(window);
