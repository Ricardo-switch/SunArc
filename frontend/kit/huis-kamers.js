/*
 * SunArc: het poppenhuis, de kamers (opgesplitst uit kit/huis.js).
 *
 * Een kamer tekenen met zijn sfeer en naam, de apparaten erin (airco, radiator, lampen, witgoed, boiler) op
 * hun plek, en de meubels per soort kamer.
 *
 * global.huisKamers(kern) maakt dit deel voor één tekenaar; `kern` geeft wat de tekenaar deelt (zie maak() in huistekenen.js).
 */
(function (global) {
  'use strict';

  global.huisKamers = function (kern) {
      /* ---- kamers ---- */
      function vindKamer(wie) {
        return kern.kamers.find((x) => x.id === wie || x.naam === wie);
      }
      function kleurAchter(kamer) {
        if (!kamer) return '#202b3a';
        const st = kamer.stand;
        if (st === 'koelt') return '#21496a';
        if (st === 'verwarmt') return '#5a3324';
        if (st === 'wacht') return '#4a3d22';
        if (st === 'goed') return '#22443d';
        return kern.nacht ? '#1a2331' : '#2e3b4e';
      }
      function sfeer(kamer, x0, x1, z0, z1) {
        const xm = (x0 + x1) / 2;
        const c = kern.P(xm, 0.1, (z0 + z1) / 2);
        const r = kern.k * (x1 - x0) * 0.55;
        if (kamer.stand === 'koelt') kern.huis.push(`<ellipse cx="${c[0]}" cy="${c[1]}" rx="${r}" ry="${r * 0.6}" fill="url(#${kern.id}-koel)"/>`);
        if (kamer.stand === 'verwarmt') kern.huis.push(`<ellipse cx="${c[0]}" cy="${c[1]}" rx="${r}" ry="${r * 0.6}" fill="url(#${kern.id}-warm)"/>`);
        // Beweging: twee zachte ringen over de vloer, die uitdijen en
        // vervagen. Midden op de vloer en niet groter dan de kamer (besluit 166): eerst
        // stonden ze halverwege de achtermuur, en onder het dak zo boven de nok uit.
        if (kamer.beweging) {
          const c = kern.P(xm, kern.D * 0.55, z0 + 0.02);
          const rb = Math.min(kern.k * (x1 - x0) * 0.42, kern.k * kern.D * 0.5, kern.k * 0.9);
          const stil = kern.stilGekozen();
          if (stil) kern.huis.push(`<ellipse class="sc-beweging" cx="${c[0]}" cy="${c[1]}" rx="${rb * 0.6}" ry="${rb * 0.36}" fill="none" stroke="${kern.KLEUR.mint}" stroke-width="2" stroke-opacity="0.7"/>`);
          else for (const vertraging of [0, 1.1]) {
            kern.huis.push(`<ellipse class="sc-beweging" cx="${c[0]}" cy="${c[1]}" rx="${rb * 0.2}" ry="${rb * 0.12}" fill="none" stroke="${kern.KLEUR.mint}" stroke-width="2"><animate attributeName="rx" values="${rb * 0.2};${rb}" dur="2.2s" begin="${vertraging}s" repeatCount="indefinite"/><animate attributeName="ry" values="${rb * 0.12};${rb * 0.6}" dur="2.2s" begin="${vertraging}s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values="0.9;0" dur="2.2s" begin="${vertraging}s" repeatCount="indefinite"/></ellipse>`);
          }
        }
      }
      function tekenKamer(kamer, x0, x1, z0, z1) {
        const xm = (x0 + x1) / 2;
        kern.kamers.push({ id: kamer.id, naam: kamer.naam, soort: kern.soortVanKamer(kamer), xm, x0, x1, z0, z1 });
        kern.tik(kamer, [[x0, kern.D, z0], [x1, kern.D, z0], [x1, kern.D, z1], [x0, kern.D, z1]]);
        // Een lege plek voor een nieuwe kamer, in de bewerkstand: alleen een stippellijn.
        if (kamer.nieuw) {
          kern.huis.push(kern.poly([[x0 + 0.06, 0.06, z0 + 0.01], [x1 - 0.06, 0.06, z0 + 0.01], [x1 - 0.06, kern.D - 0.06, z0 + 0.01], [x0 + 0.06, kern.D - 0.06, z0 + 0.01]], `fill="${kern.KLEUR.ijs}" fill-opacity="0.05" stroke="${kern.KLEUR.ijs}" stroke-opacity="0.7" stroke-width="1.6" stroke-dasharray="6 5"`));
          const t = kern.P(xm, kern.D * 0.5, z0);
          kern.labels.push(`<g><circle cx="${t[0]}" cy="${t[1]}" r="16" fill="#0E1828" stroke="${kern.KLEUR.ijs}" stroke-opacity="0.7"/><path d="M ${t[0] - 7} ${t[1]} h 14 M ${t[0]} ${t[1] - 7} v 14" stroke="${kern.KLEUR.ijs}" stroke-width="2.2" stroke-linecap="round"/><text x="${t[0]}" y="${t[1] + 36}" text-anchor="middle" fill="${kern.KLEUR.ijs}" font-family="Figtree, sans-serif" font-size="13" font-weight="700">${kern.esc(kamer.naam ?? global.t?.('huis.kamerToevoegen') ?? '+')}</text></g>`);
          return;
        }
        const donker = kern.nacht && !(kamer.apparaten ?? []).some((a) => a.soort === 'lamp' && a.aan);
        // Linkerwand (de tussenmuur of de buitenmuur), achterwand, vloer.
        kern.huis.push(kern.poly([[x0, 0, z0], [x0, kern.D, z0], [x0, kern.D, z1], [x0, 0, z1]], `fill="${donker ? '#121a26' : '#3a4a60'}"`));
        kern.huis.push(kern.poly([[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], `fill="${donker ? '#141c29' : '#33425a'}"`));
        const lampAan = (kamer.apparaten ?? []).some((a) => a.soort === 'lamp' && a.aan);
        const tint = (kern.nacht || kern.schemer) && lampAan ? kern.kleurWas(kamer) ?? 'lamp' : kamer.stand ?? 'rust';
        if (!donker) kern.huis.push(kern.poly([[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], `fill="url(#${kern.id}-w-${tint})"`));
        kern.huis.push(kern.poly([[x0, 0, z0], [x1, 0, z0], [x1, kern.D, z0], [x0, kern.D, z0]], `fill="${donker ? '#0f151f' : `url(#${kern.id}-vloer)`}"`));
        // Donkere hoeken waar muur en vloer elkaar raken.
        kern.huis.push(kern.poly([[x0, 0, z0], [x1, 0, z0], [x1, 0, z0 + 0.32], [x0, 0, z0 + 0.32]], `fill="url(#${kern.id}-hoek)"`));
        kern.huis.push(kern.poly([[x0, 0, z0], [x0, kern.D, z0], [x0, kern.D, z0 + 0.25], [x0, 0, z0 + 0.25]], `fill="url(#${kern.id}-hoek)"`));

        // Een raam in de achtermuur, met de lucht erachter.
        const raamPlek = raamVan(kamer, x0, x1);
        if (raamPlek) {
          const [rx0, rx1] = raamPlek;
          if (kern.opts.controle) kern.controle.push({ kamer: kamer.id ?? kamer.naam, wat: 'raam', ruimte: [x0, x1], x0: rx0, x1: rx1, y0: 0, y1: 0.02, z0: z0 + 0.42, z1: z1 - 0.28 });
          const raam = [[rx0, 0.005, z0 + 0.42], [rx1, 0.005, z0 + 0.42], [rx1, 0.005, z1 - 0.28], [rx0, 0.005, z1 - 0.28]];
          kern.huis.push(kern.poly(raam, `fill="${kern.nacht ? '#0a1222' : kern.winter ? '#7f93a8' : '#4d7eac'}" stroke="#55657a" stroke-width="1.5"`));
          if (!kern.nacht) kern.huis.push(kern.poly([raam[0], [rx0 + (rx1 - rx0) * 0.45, 0.005, z0 + 0.42], [rx0, 0.005, z1 - 0.45]], 'fill="#ffffff" opacity="0.12"'));
          kern.huis.push(kern.line([[(rx0 + rx1) / 2, 0.006, z0 + 0.42], [(rx0 + rx1) / 2, 0.006, z1 - 0.28]], 'stroke="#55657a" stroke-width="1.2"'));
        }
        sfeer(kamer, x0, x1, z0, z1);
        inrichten(kamer, x0, x1, z0, z1, null, donker);
        kern.blokKamer = kamer.id ?? kamer.naam;
        kern.dezeKamer = kamer;
        for (const app of kamer.apparaten ?? []) apparaat(app, x0, x1, z0, z1, false);
        kern.radiatorZij = false;
        // In de bewerkstand: de gekozen kamer met een rand, de kamer waar iets heen gaat met een gloed.
        if (kamer.gekozen || kamer.doel) {
          const kl = kamer.doel ? kern.KLEUR.mint : kern.KLEUR.ijs;
          kern.huis.push(kern.poly([[x0 + 0.03, 0.03, z0 + 0.01], [x1 - 0.03, 0.03, z0 + 0.01], [x1 - 0.03, kern.D - 0.03, z0 + 0.01], [x0 + 0.03, kern.D - 0.03, z0 + 0.01]], `fill="${kl}" fill-opacity="${kamer.doel ? 0.16 : 0.06}" stroke="${kl}" stroke-width="2" ${kamer.doel ? '' : 'stroke-dasharray="7 5"'}`));
        }
        // Zones in een kamer: een stippellijn over de vloer, met de naam erbij.
        (kamer.zones ?? []).forEach((zone, i, alle) => {
          if (i === 0) return;
          const xs = x0 + ((x1 - x0) * i) / alle.length;
          kern.huis.push(kern.line([[xs, 0.05, z0 + 0.012], [xs, kern.D - 0.05, z0 + 0.012]], `stroke="#C9D6E2" stroke-opacity="0.45" stroke-width="1.4" stroke-dasharray="5 5"`));
        });
        (kamer.stil ? [] : kamer.zones ?? []).forEach((zone, i, alle) => {
          const xz = x0 + ((x1 - x0) * (i + 0.5)) / alle.length;
          const t = kern.P(xz, kern.D - 0.2, z0 + 0.02);
          kern.labels.push(`<text x="${t[0]}" y="${t[1]}" text-anchor="middle" fill="${kern.KLEUR.zacht}" font-family="Figtree, sans-serif" font-size="11.5" font-weight="600" opacity="0.85">${kern.esc(kern.zoneNaam(zone))}</text>`);
        });
        // De muur ertussen als doorsnede.
        kern.huis.push(kern.line([[x0, kern.D, z0], [x0, kern.D, z1]], `stroke="#C9D6E2" stroke-opacity="0.35" stroke-width="1.6"`));
        kamerLabel(kamer, x0 + 0.16, z1 - 0.3, false, x1 - x0);
      }
      /**
       * De naam, de temperatuur en de korte zin van een kamer, op de open voorkant.
       * De tekst past zich aan de breedte van de kamer aan: kleiner, de naam op
       * twee regels, en zonder de zin als die er niet meer bij past.
       */
      function kamerLabel(kamer, xl, zl, midden, breedte, hoogte) {
        if (!kamer.naam || kamer.stil) return;
        // Het icoon hoort bij de inrichting: alleen ingezoomd (`opts.meubels`).
        const soortIcoon = kern.soortVanKamer(kamer);
        const icoon = kern.opts.meubels && soortIcoon !== 'leeg' ? kern.KAMER_ICOON[soortIcoon ?? 'kamer'] : null;
        /** Het icoon met de linkerbovenhoek op (x, y), `sz` groot, in de kleur van de naam. */
        const tekenIcoon = (x, y, sz) => (!icoon ? '' : `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(sz / 24).toFixed(3)})" fill="none" stroke="${kern.KLEUR.zacht}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icoon}</g>`);
        // Weinig hoogte, zoals onder de schuine kant van het dak: alles op één regel.
        if (hoogte != null && hoogte * kern.k < 96) {
          const t1 = kern.P(xl, kern.D, zl);
          const kl = { koelt: kern.KLEUR.ijs, verwarmt: kern.KLEUR.gloed, wacht: kern.KLEUR.zon, goed: kern.KLEUR.mint }[kamer.stand] ?? kern.KLEUR.zacht;
          // Het icoon links van de regel, als er naast de tekst ruimte voor is.
          const breedTekst = kamer.naam.length * 12.5 * 0.55 + (kamer.temp ? 6 + kamer.temp.length * 16 * 0.55 : 0);
          const metIcoon = !!icoon && (breedte == null || breedte * kern.AX * kern.k > breedTekst + 40);
          const sz1 = 15;
          const ix = t1[0] - breedTekst / 2 - (metIcoon ? (sz1 + 5) / 2 : 0);
          // Past het er niet naast, dan erboven.
          const boven = metIcoon ? '' : tekenIcoon(t1[0] - sz1 / 2, t1[1] - sz1 - 16, sz1);
          kern.labels.push(`<g class="sc-kamer" data-kamer="${kern.esc(kamer.id ?? kamer.naam)}">${metIcoon ? tekenIcoon(ix, t1[1] - sz1 + 2, sz1) : boven}<text x="${metIcoon ? t1[0] + (sz1 + 5) / 2 : t1[0]}" y="${t1[1]}" text-anchor="middle" font-family="Figtree, sans-serif" font-size="12.5" font-weight="600" fill="${kern.KLEUR.zacht}">${kern.esc(kamer.naam)}${kamer.temp ? ` <tspan font-family="Bricolage Grotesque, Figtree, sans-serif" font-size="16" fill="${kern.KLEUR.tekst}">${kern.esc(kamer.temp)}</tspan>` : ''}</text>${kamer.stand ? `<circle cx="${t1[0]}" cy="${t1[1] + 12}" r="4" fill="${kl}"><title>${kern.esc(kamer.zin ?? '')}</title></circle>` : ''}</g>`);
          return;
        }
        const t = kern.P(xl, kern.D, zl);
        const anker = midden ? 'middle' : 'start';
        const kleur = { koelt: kern.KLEUR.ijs, verwarmt: kern.KLEUR.gloed, wacht: kern.KLEUR.zon, goed: kern.KLEUR.mint }[kamer.stand] ?? kern.KLEUR.zacht;
        const ruimte = (breedte ?? 2) * kern.AX * kern.k - 18;
        const past = (tekst, px) => tekst.length * px * 0.6 <= ruimte;
        const naamPx = past(kamer.naam, 12.5) ? 12.5 : past(kamer.naam, 11.5) ? 11.5 : 10.5;
        // Een lange naam breekt op de laatste spatie, als hij anders niet past.
        const woorden = kamer.naam.split(' ');
        const regels = past(kamer.naam, naamPx) || woorden.length < 2 ? [kamer.naam] : [woorden.slice(0, -1).join(' '), woorden[woorden.length - 1]];
        const tempPx = Math.min(28, kern.k * 0.32, ruimte / 3.2);
        let y = t[1];
        // Het icoon voor de eerste regel van de naam; past het er niet bij, dan valt het weg.
        const sz = Math.round(naamPx * 1.25);
        const regelBreed = Math.max(...regels.map((r) => r.length * naamPx * 0.6));
        const metIcoon = !!icoon && regelBreed + sz + 6 <= ruimte;
        const schuif = metIcoon ? sz + 6 : 0;
        const ix = midden ? t[0] - (regelBreed + schuif) / 2 : t[0];
        const delen = regels.map((r, i) => `<text x="${midden ? t[0] + schuif / 2 : t[0] + (i === 0 ? schuif : 0)}" y="${y + i * 14}" text-anchor="${anker}" fill="${kern.KLEUR.zacht}" font-family="Figtree, sans-serif" font-size="${naamPx}" font-weight="600">${kern.esc(r)}</text>`);
        // Past het er niet naast, dan erboven.
        delen.unshift(metIcoon ? tekenIcoon(ix, y - sz + 3, sz) : tekenIcoon(midden ? t[0] - sz / 2 : t[0], y - naamPx - sz - 3, sz));
        y += (regels.length - 1) * 14;
        if (kamer.temp) delen.push(`<text x="${t[0]}" y="${y + tempPx + 2}" text-anchor="${anker}" fill="${kern.KLEUR.tekst}" font-family="Bricolage Grotesque, Figtree, sans-serif" font-size="${tempPx.toFixed(1)}" font-weight="600">${kern.esc(kamer.temp)}</text>`);
        const zinY = y + (kamer.temp ? tempPx + 20 : 18);
        if (kamer.zin && past(kamer.zin, 12)) delen.push(`<text x="${t[0]}" y="${zinY}" text-anchor="${anker}" fill="${kleur}" font-family="Figtree, sans-serif" font-size="12" font-weight="600">${kern.esc(kamer.zin)}</text>`);
        else if (kamer.zin && kamer.stand) delen.push(`<circle cx="${midden ? t[0] : t[0] + 4}" cy="${zinY - 4}" r="4" fill="${kleur}"><title>${kern.esc(kamer.zin)}</title></circle>`);
        kern.labels.push(`<g class="sc-kamer" data-kamer="${kern.esc(kamer.id ?? kamer.naam)}">${delen.join('')}</g>`);
      }

      /* ---- apparaten in een kamer ---- */
      /** Waar de boiler in zijn kamer staat: achterin, iets rechts van het midden. */
      function boilerX(x0, x1) {
        return Math.max(x0 + 0.5, x1 - 0.95);
      }
      function doos(x0, y0, z0, w, d, h, kleuren) {
        const [boven, voor, zij] = kleuren;
        return [
          kern.poly([[x0 + w, y0, z0], [x0 + w, y0 + d, z0], [x0 + w, y0 + d, z0 + h], [x0 + w, y0, z0 + h]], `fill="${zij}"`),
          kern.poly([[x0, y0 + d, z0], [x0 + w, y0 + d, z0], [x0 + w, y0 + d, z0 + h], [x0, y0 + d, z0 + h]], `fill="${voor}"`),
          kern.poly([[x0, y0, z0 + h], [x0 + w, y0, z0 + h], [x0 + w, y0 + d, z0 + h], [x0, y0 + d, z0 + h]], `fill="${boven}"`),
        ].join('');
      }
      function cirkelOpVoorkant(xc, y, zc, r, attrs) {
        const pts = [];
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          pts.push([xc + Math.cos(a) * r, y, zc + Math.sin(a) * r]);
        }
        return kern.poly(pts, attrs);
      }
      /** Het raam in de achtermuur van een gewone kamer: [van, tot], of null. */
      function raamVan(kamer, x0, x1) {
        if (!(x1 - x0 > 1.15) || kamer?.geenRaam) return null;
        return [x0 + 0.28, Math.min(x0 + 0.95, x1 - 1.05 > x0 + 0.95 ? x0 + 0.95 : x1 - 0.25)];
      }
      /** Waar witgoed staat buiten het dak (besluit 167): tegen de achtermuur, rechts van het raam. */
      function toestelPlek(kamer, x0, x1) {
        const raam = raamVan(kamer, x0, x1);
        return Math.max(raam ? raam[1] + 0.06 : x0 + 0.1, x1 - 0.7 - kern.TOESTEL.b);
      }
      /**
       * Waar de binnenunit van een gewone kamer hangt (besluit 131): hoog, en
       * nooit voor het raam. Op de achterwand rechts van het raam, waar hij in
       * beeld niet achter de muur met de volgende kamer valt. Staat er een etage
       * boven, dan net onder wat de vloer erboven aan het zicht onttrekt. Past hij
       * daar niet, dan aan de linkermuur, vooraan, waar hij altijd te zien is.
       */
      function aircoPlek(kamer, x0, x1, z1) {
        const raam = raamVan(kamer, x0, x1);
        const vanaf = raam ? raam[1] + 0.12 : x0 + 0.15;
        // Rechts valt de achterwand in beeld achter de muur met de volgende kamer.
        const tot = x1 - 0.7;
        // Alleen een etage die erboven getekend wordt, onttrekt iets aan het zicht.
        const vloerBoven = kern.erBoven && !kern.model.zonderDak;
        if (tot - vanaf >= kern.AIRCO.b) {
          const top = vloerBoven ? z1 - kern.BY * kern.D - 0.04 : z1 - 0.12;
          return { wand: 'achter', ax: Math.max(vanaf, tot - kern.AIRCO.b), az: top - kern.AIRCO.h };
        }
        const ay = 0.2;
        const top = vloerBoven ? z1 - (kern.D - ay) * kern.BY - 0.04 : z1 - 0.12;
        return { wand: 'links', ay, az: top - kern.AIRCO.h };
      }
      /**
       * Waar de airco onder het dak hangt (besluit 166). Tegen de linkermuur als
       * die hoog genoeg is, zoals bij een kamer die bij de nok begint; anders op de
       * achtermuur, net links van de nok, want daar is de muur hoog en blijft hij
       * in beeld. Eerst hing hij altijd links, en bij een kamer tegen de
       * buitenmuur kwam hij zo buiten het dak terecht.
       */
      function aircoOnderDak(x0, x1, z0, plafond) {
        const { b: AB, h: AH } = kern.AIRCO;
        if (plafond(x0 + 0.05) >= z0 + 0.95 + AH + 0.12) return { wand: 'links', ay: 0.4, az: Math.min(z0 + 0.95, plafond(x0) - AH - 0.12) };
        // Rechts schuift de muur van de volgende kamer over de achterwand.
        const lo = x0 + 0.1;
        const hi = x1 - (x1 < kern.W - 0.01 ? 0.7 : 0.12) - AB;
        // Links van de nok: rechts ervan valt de achtermuur achter het rechter dakvlak.
        const ax = hi < lo ? Math.max(x0 + 0.05, (x0 + x1 - AB) / 2) : Math.max(lo, Math.min(hi, kern.W / 2 - 0.7 - AB));
        const ruimte = Math.min(plafond(ax), plafond(ax + AB));
        return { wand: 'achter', ax, az: Math.max(z0 + 0.3, Math.min(z0 + 0.95, ruimte - AH - 0.1)) };
      }
      /**
       * Waar de radiator onder het dak staat: op de achtermuur,
       * zo ver naar links als hij rechtop past, en niet onder een airco op de
       * achtermuur. Eerst stond hij altijd links, en bij een kamer tegen de
       * buitenmuur stak hij zo door het dak. Past hij nergens, dan een kleinere,
       * lage radiator, zoals tegen een knieschot. Zonder dak links, onder het raam.
       */
      function radiatorPlek(x0, x1, z0, plafond) {
        const { b: B, onder, h: H } = kern.RADIATOR;
        if (!plafond) return { x: x0 + 0.25, b: B, h: H };
        const maten = [[B, H], [0.55, 0.3], [0.4, 0.24]];
        const past = (x, b, h) => Math.min(plafond(x), plafond(x + b)) >= z0 + onder + h + 0.06;
        const onderAirco = (x, b, h) => kern.aircoDak?.wand === 'achter' && x < kern.aircoDak.ax + kern.AIRCO.b + 0.05 && x + b > kern.aircoDak.ax - 0.05 && kern.aircoDak.az < z0 + onder + h + 0.05;
        // Rechts schuift de muur van de volgende kamer over de achterwand; als het niet anders kan, toch daar.
        for (const strook of [0.7, 0.1]) {
          for (const [b, h] of maten) {
            const tot = Math.min(x1 - b - 0.1, x1 < kern.W - 0.01 ? x1 - strook - b : x1);
            for (let x = x0 + 0.25; x <= tot + 1e-9; x += 0.05) if (past(x, b, h) && !onderAirco(x, b, h)) return { x, b, h };
          }
        }
        // Nergens rechtop: klein, zo dicht mogelijk bij de nok, waar het dak het hoogst is.
        const [b, h] = maten[maten.length - 1];
        return { x: Math.max(x0 + 0.1, Math.min(x1 - b - 0.1, kern.W / 2 - b - 0.1)), b, h };
      }
      function apparaat(app, x0, x1, z0, z1, onderDak, plafond) {
        const xm = (x0 + x1) / 2;
        /** Met `opts.controle`: waar dit apparaat staat, als blok. */
        const blok = (bx0, bx1, by0, by1, bz0, bz1) => {
          if (kern.opts.controle) kern.controle.push({ kamer: kern.blokKamer, wat: 'apparaat', soort: app.soort, ruimte: [x0, x1], x0: bx0, x1: bx1, y0: by0, y1: by1, z0: bz0, z1: bz1 });
        };
        const hoog = (x) => (plafond ? plafond(x) : z1);
        if (app.soort === 'airco') {
          const kleur = app.stand === 'verwarmt' ? kern.KLEUR.gloed : kern.KLEUR.ijs;
          const KAST = ['#eef3f7', '#dfe7ee', '#b4c0cb'];
          const dakPlek = plafond ? kern.aircoDak ?? aircoOnderDak(x0, x1, z0, plafond) : null;
          if (dakPlek?.wand === 'links') {
            // Onder het dak tegen de linkermuur, hoog: daar is hij altijd te zien,
            // en de droger schuift naar rechts (zie hieronder).
            const { b: AB, h: AH, d: AD } = kern.AIRCO;
            const ay = dakPlek.ay;
            const az = dakPlek.az;
            kern.plek[`airco:${app.naam ?? ''}`] = [x0 + 0.2, ay + AB / 2, az];
            blok(x0 + 0.01, x0 + 0.01 + AD, ay, ay + AB, az, az + AH);
            kern.huis.push(doos(x0 + 0.01, ay, az, AD, AB, AH, KAST));
            // De uitblaas aan de onderkant, naar de kamer toe.
            kern.huis.push(kern.poly([[x0 + 0.012 + AD, ay + 0.05, az + 0.035], [x0 + 0.012 + AD, ay + AB - 0.05, az + 0.035], [x0 + 0.012 + AD, ay + AB - 0.05, az + 0.06], [x0 + 0.012 + AD, ay + 0.05, az + 0.06]], 'fill="#7d8b99"'));
            if (app.aan) {
              for (let i = 0; i < 3; i++) {
                const a = kern.P(x0 + 0.24, ay + 0.2 + i * 0.2, az + 0.02);
                const b = kern.P(x0 + 0.7, ay + 0.25 + i * 0.2, az - 0.35);
                kern.huis.push(`<path class="sc-lucht" style="animation-delay:${i * 0.35}s" d="M ${a[0]} ${a[1]} Q ${(a[0] + b[0]) / 2} ${a[1] + 4} ${b[0]} ${b[1]}" fill="none" stroke="${kleur}" stroke-width="2" stroke-linecap="round" opacity="0.7"/>`);
              }
            }
          } else {
            // Op een gewone etage: hoog, naast het raam (besluit 131, zie aircoPlek);
            // onder het dak op de achtermuur bij de nok (besluit 166).
            const { b: AB, h: AH, d: AD } = kern.AIRCO;
            const p = dakPlek ?? aircoPlek(kern.dezeKamer, x0, x1, z1);
            const az = p.az;
            if (p.wand === 'achter') {
              const ax = p.ax;
              kern.plek[`airco:${app.naam ?? ''}`] = [ax + AB / 2, 0.1, az];
              blok(ax, ax + AB, 0.02, 0.02 + AD, az, az + AH);
              kern.huis.push(doos(ax, 0.02, az, AB, AD, AH, KAST));
              kern.huis.push(kern.poly([[ax + 0.05, 0.022 + AD, az + 0.035], [ax + AB - 0.05, 0.022 + AD, az + 0.035], [ax + AB - 0.05, 0.022 + AD, az + 0.06], [ax + 0.05, 0.022 + AD, az + 0.06]], 'fill="#7d8b99"'));
              if (app.aan) {
                for (let i = 0; i < 3; i++) {
                  const a = kern.P(ax + 0.11 + i * 0.17, 0.25, az - 0.02);
                  const b = kern.P(ax + 0.11 + i * 0.17, 0.7, az - 0.36);
                  kern.huis.push(`<path class="sc-lucht" style="animation-delay:${i * 0.35}s" d="M ${a[0]} ${a[1]} Q ${a[0] + 8} ${(a[1] + b[1]) / 2} ${b[0]} ${b[1]}" fill="none" stroke="${kleur}" stroke-width="2" stroke-linecap="round" opacity="0.7"/>`);
                }
              }
            } else {
              const ay = p.ay;
              kern.plek[`airco:${app.naam ?? ''}`] = [x0 + 0.1, ay + AB / 2, az];
              blok(x0 + 0.01, x0 + 0.01 + AD, ay, ay + AB, az, az + AH);
              kern.huis.push(doos(x0 + 0.01, ay, az, AD, AB, AH, KAST));
              kern.huis.push(kern.poly([[x0 + 0.012 + AD, ay + 0.05, az + 0.035], [x0 + 0.012 + AD, ay + AB - 0.05, az + 0.035], [x0 + 0.012 + AD, ay + AB - 0.05, az + 0.06], [x0 + 0.012 + AD, ay + 0.05, az + 0.06]], 'fill="#7d8b99"'));
              if (app.aan) {
                for (let i = 0; i < 3; i++) {
                  const a = kern.P(x0 + 0.2, ay + 0.11 + i * 0.17, az - 0.02);
                  const b = kern.P(x0 + 0.62, ay + 0.15 + i * 0.17, az - 0.34);
                  kern.huis.push(`<path class="sc-lucht" style="animation-delay:${i * 0.35}s" d="M ${a[0]} ${a[1]} Q ${(a[0] + b[0]) / 2} ${a[1] + 4} ${b[0]} ${b[1]}" fill="none" stroke="${kleur}" stroke-width="2" stroke-linecap="round" opacity="0.7"/>`);
                }
              }
            }
          }
        } else if (app.soort === 'radiator') {
          const kl = ['#4b5664', app.aan ? '#c4704f' : '#5a6574', '#3d4754'];
          // Tegen de zijmuur als de achterwand een keuken heeft; anders onder het raam.
          const { x: rx, b: rb, h: rh } = radiatorPlek(x0, x1, z0, plafond);
          if (kern.radiatorZij) kern.huis.push(doos(x0 + 0.02, 0.5, z0 + 0.12, 0.08, 0.8, 0.36, [kl[0], kl[2], kl[1]]));
          else kern.huis.push(doos(rx, 0.02, z0 + 0.12, rb, 0.08, rh, kl));
          if (kern.radiatorZij) blok(x0 + 0.02, x0 + 0.1, 0.5, 1.3, z0 + 0.12, z0 + 0.48);
          else blok(rx, rx + rb, 0.02, 0.1, z0 + 0.12, z0 + 0.12 + rh);
          if (kern.opts.controle && plafond && !kern.radiatorZij) kern.controle[kern.controle.length - 1].plafond = Math.min(plafond(rx), plafond(rx + rb));
          if (app.aan) {
            const c = kern.radiatorZij ? kern.P(x0 + 0.4, 0.9, z0 + 0.4) : kern.P(rx + rb / 2, 0.3, z0 + 0.09 + rh);
            kern.huis.push(`<ellipse cx="${c[0]}" cy="${c[1]}" rx="${kern.k * 0.7}" ry="${kern.k * 0.35}" fill="url(#${kern.id}-warm)"/>`);
          }
        } else if (app.soort === 'vloer') {
          if (app.aan) kern.huis.push(kern.poly([[x0 + 0.1, 0.1, z0 + 0.005], [x1 - 0.1, 0.1, z0 + 0.005], [x1 - 0.1, kern.D - 0.1, z0 + 0.005], [x0 + 0.1, kern.D - 0.1, z0 + 0.005]], `fill="${kern.KLEUR.gloed}" opacity="0.16"`));
        } else if (app.soort === 'lamp') {
          const lx = app.x != null ? x0 + (x1 - x0) * app.x : xm;
          const ly = kern.D * 0.42;
          const top = Math.min(hoog(lx), z1);
          kern.huis.push(kern.line([[lx, ly, top], [lx, ly, top - 0.28]], 'stroke="#8090a0" stroke-width="1"'));
          blok(lx - 0.09, lx + 0.09, ly - 0.09, ly + 0.09, top - 0.36, top);
          // Een gekleurde lamp (besluit 129): de kap in zijn kleur, en een sterkere gloed.
          const tinten = app.aan ? kern.tintenVan(app.kleur) : null;
          const kap = tinten ?? (app.aan ? ['#FFE2B0', '#e8b878', '#d6a565'] : ['#5c6876', '#4a5664', '#3c4755']);
          kern.huis.push(doos(lx - 0.09, ly - 0.09, top - 0.36, 0.18, 0.18, 0.09, kap));
          if (app.aan) {
            const kleur = app.kleur ?? '#FFD9A0';
            const v = kern.P(lx, ly, z0);
            const r = kern.k * 0.62;
            kern.huis.push(`<ellipse cx="${v[0]}" cy="${v[1]}" rx="${r}" ry="${r * 0.5}" fill="${kleur}" opacity="${tinten ? 0.4 : 0.22}" filter="url(#${kern.id}-zacht)"/>`);
            const b = kern.P(lx, ly, top - 0.36);
            const l1 = kern.P(lx - 0.45, ly, z0 + 0.05);
            const r1 = kern.P(lx + 0.45, ly, z0 + 0.05);
            kern.huis.push(`<polygon points="${b[0]},${b[1]} ${l1[0]},${l1[1]} ${r1[0]},${r1[1]}" fill="${kleur}" opacity="${tinten ? 0.16 : 0.07}"/>`);
            if (tinten) kern.huis.push(`<circle cx="${b[0]}" cy="${b[1]}" r="${(kern.k * 0.22).toFixed(1)}" fill="${kleur}" opacity="0.5" filter="url(#${kern.id}-zacht)"/>`);
          }
        } else if (app.soort === 'droger' || app.soort === 'wasmachine' || app.soort === 'vaatwasser') {
          // Tegen de achtermuur, rechts van het raam: linksboven staat de naam
          // van de kamer, en het midden blijft vrij. Helemaal rechts valt de
          // achterwand achter de muur ernaast, daarom niet in de hoek. Eerst
          // stond hij midden in de kamer, wat in het echt nooit zo is (besluit 167).
          let dx = app.x != null ? x0 + (x1 - x0) * app.x : toestelPlek(kern.dezeKamer, x0, x1);
          const dy = 0.15;
          if (plafond) {
            // Onder het dak: waar hij rechtop past, en zo ver mogelijk van het
            // midden van de kamer, waar de naam en de temperatuur staan.
            const past = (x) => Math.min(hoog(x), hoog(x + kern.TOESTEL.b)) >= z0 + kern.TOESTEL.h + 0.2;
            // Hangt er een airco tegen de linkermuur of op de achtermuur, dan niet daaronder.
            const vanaf = kern.aircoDak?.wand === 'links' ? x0 + 0.55 : x0 + 0.1;
            const onderAirco = (x) => kern.aircoDak?.wand === 'achter' && x < kern.aircoDak.ax + kern.AIRCO.b + 0.08 && x + kern.TOESTEL.b > kern.aircoDak.ax - 0.08;
            // En niet voor de radiator.
            const rx = (kern.dezeKamer?.apparaten ?? []).some((a) => a.soort === 'radiator') ? radiatorPlek(x0, x1, z0, plafond) : null;
            const voorRadiator = (x) => rx != null && x < rx.x + rx.b + 0.05 && x + kern.TOESTEL.b > rx.x - 0.05;
            const plekken = [];
            for (let x = vanaf; x <= x1 - kern.TOESTEL.b - 0.1; x += 0.05) if (past(x) && !onderAirco(x) && !voorRadiator(x)) plekken.push(x);
            plekken.sort((a, b) => Math.abs(b + kern.TOESTEL.b / 2 - xm) - Math.abs(a + kern.TOESTEL.b / 2 - xm));
            dx = plekken[0] ?? Math.max(x0 + 0.1, Math.min(x1 - kern.TOESTEL.b - 0.1, kern.W / 2 - kern.TOESTEL.b / 2));
          }
          const { b: TB, h: TH } = kern.TOESTEL;
          kern.plek[app.soort] = [dx + TB / 2, dy + TB / 2, z0 + TH];
          blok(dx, dx + TB, dy, dy + TB, z0, z0 + TH);
          kern.huis.push(doos(dx, dy, z0, TB, TB, TH, ['#e9eef2', '#d7dee5', '#b9c3cd']));
          if (app.soort !== 'vaatwasser') {
            kern.huis.push(cirkelOpVoorkant(dx + TB / 2, dy + TB + 0.001, z0 + TH * 0.45, TB * 0.3, 'fill="#5e6c7b" stroke="#9aa7b4" stroke-width="1.5"'));
            if (app.aan) {
              const c = kern.P(dx + TB / 2, dy + TB + 0.002, z0 + TH * 0.45);
              kern.huis.push(`<g class="sc-trommel" style="transform-origin:${c[0]}px ${c[1]}px">${cirkelOpVoorkant(dx + TB / 2, dy + TB + 0.002, z0 + TH * 0.45, TB * 0.2, `fill="none" stroke="${kern.KLEUR.zon}" stroke-width="2" stroke-dasharray="4 4"`)}</g>`);
            }
          } else {
            kern.huis.push(kern.poly([[dx + 0.04, dy + TB + 0.001, z0 + TH - 0.08], [dx + TB - 0.04, dy + TB + 0.001, z0 + TH - 0.08], [dx + TB - 0.04, dy + TB + 0.001, z0 + TH - 0.05], [dx + 0.04, dy + TB + 0.001, z0 + TH - 0.05]], 'fill="#8a97a4"'));
          }
          if (app.aan) {
            const c = kern.P(dx + TB / 2, dy + TB / 2, z0 + TH + 0.02);
            kern.huis.push(`<circle cx="${c[0]}" cy="${c[1]}" r="${kern.k * 0.32}" fill="url(#${kern.id}-zon)" opacity="0.35"/>`);
          }
        } else if (app.soort === 'cv') {
          const cx = x0 + 0.2;
          kern.plek.cv = [cx + 0.21, 0.1, z0 + 1.05];
          blok(cx, cx + 0.42, 0.02, 0.24, z0 + 0.5, z0 + 1.05);
          kern.huis.push(doos(cx, 0.02, z0 + 0.5, 0.42, 0.22, 0.55, ['#e2e7ec', '#cfd6de', '#aeb8c2']));
          if (app.aan) {
            const c = kern.P(cx + 0.21, 0.25, z0 + 0.62);
            kern.huis.push(`<circle cx="${c[0]}" cy="${c[1]}" r="${kern.k * 0.12}" fill="${kern.KLEUR.gloed}" class="sc-vlam"/>`);
          }
        } else if (app.soort === 'boiler') {
          // Een boiler (besluit 186): een ronde witte tank tegen de achterwand, met een strook die zegt hoe warm hij is.
          // Niet in de hoek rechts: daar staat buiten de buitenunit er net boven (huis 3.0).
          const r0 = 0.15;
          const cx = boilerX(x0, x1);
          const cy = 0.06 + r0;
          const bh = Math.min(0.82, (hoog(cx) - z0) * 0.66);
          kern.plek.boiler = [cx, cy, z0 + bh];
          blok(cx - r0, cx + r0, cy - r0, cy + r0, z0, z0 + bh);
          const rand = (z) => Array.from({ length: 24 }, (_, i) => [cx + Math.cos((i / 24) * 2 * Math.PI) * r0, cy + Math.sin((i / 24) * 2 * Math.PI) * r0, z]);
          const mantel = kern.omhulsel([...rand(z0 + 0.04), ...rand(z0 + bh)].map((q) => kern.P(...q)));
          kern.huis.push(`<path d="M ${mantel.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' L ')} Z" fill="#dfe5eb" stroke="#aeb9c4" stroke-width="0.8"/>`);
          // Licht van links: de rechterhelft iets donkerder.
          const schaduwkant = [...rand(z0 + 0.04).filter(([x]) => x >= cx), ...rand(z0 + bh).filter(([x]) => x >= cx).reverse()];
          kern.huis.push(`<path d="M ${schaduwkant.map((q) => kern.P(...q)).map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' L ')} Z" fill="#b9c4ce" opacity="0.5"/>`);
          kern.huis.push(kern.poly(rand(z0 + bh), 'fill="#f6f8fa" stroke="#c9d2da" stroke-width="0.8"'));
          // Twee leidingen naar het plafond.
          for (const dx of [-0.05, 0.05]) kern.huis.push(kern.line([[cx + dx, cy, z0 + bh], [cx + dx, cy, hoog(cx) - 0.02]], 'stroke="#9aa7b4" stroke-width="1.4"'));
          const pct = Math.max(0.05, Math.min(1, app.vol ?? 0.6));
          const yv = cy + r0 + 0.002;
          kern.huis.push(kern.poly([[cx - 0.035, yv, z0 + 0.14], [cx + 0.035, yv, z0 + 0.14], [cx + 0.035, yv, z0 + bh - 0.1], [cx - 0.035, yv, z0 + bh - 0.1]], 'fill="#9aa7b4"'));
          kern.huis.push(kern.poly([[cx - 0.035, yv + 0.001, z0 + 0.14], [cx + 0.035, yv + 0.001, z0 + 0.14], [cx + 0.035, yv + 0.001, z0 + 0.14 + (bh - 0.24) * pct], [cx - 0.035, yv + 0.001, z0 + 0.14 + (bh - 0.24) * pct]], `fill="${app.aan ? kern.KLEUR.gloed : '#ff9a6b'}" ${app.aan ? 'class="sc-puls"' : ''}`));
        } else if (app.soort === 'thuisaccu') {
          // De thuisaccu binnen (besluit 270): een witte kast tegen de achterwand, rechts, met een strook die zegt hoe vol hij is.
          const ax = Math.max(x0 + 0.1, x1 - 0.42);
          const az = z0 + 0.04;
          const ah = Math.max(0.3, Math.min(0.72, (hoog(ax + 0.13) - z0) * 0.7));
          kern.plek.thuisaccu = [ax + 0.13, 0.1, az + ah];
          kern.plek.batterij ??= kern.plek.thuisaccu;
          blok(ax, ax + 0.26, 0.02, 0.18, az, az + ah);
          kern.huis.push(doos(ax, 0.02, az, 0.26, 0.16, ah, ['#eef2f5', '#e1e7ec', '#c3ccd5']));
          const vol = Math.max(0.05, Math.min(1, app.vol ?? 0.5));
          const yv = 0.181;
          kern.huis.push(kern.poly([[ax + 0.1, yv, az + 0.1], [ax + 0.16, yv, az + 0.1], [ax + 0.16, yv, az + ah - 0.1], [ax + 0.1, yv, az + ah - 0.1]], 'fill="#5c6977"'));
          kern.huis.push(kern.poly([[ax + 0.1, yv + 0.001, az + 0.1], [ax + 0.16, yv + 0.001, az + 0.1], [ax + 0.16, yv + 0.001, az + 0.1 + (ah - 0.2) * vol], [ax + 0.1, yv + 0.001, az + 0.1 + (ah - 0.2) * vol]], `fill="${kern.KLEUR.mint}" ${app.aan ? 'class="sc-puls"' : ''}`));
        } else if (app.soort === 'tv') {
          kern.huis.push(kern.poly([[x0 + 0.3, 0.03, z0 + 0.45], [x0 + 1.1, 0.03, z0 + 0.45], [x0 + 1.1, 0.03, z0 + 0.9], [x0 + 0.3, 0.03, z0 + 0.9]], `fill="${app.aan ? '#3d6fb0' : '#0b0f14'}" stroke="#2c3642"`));
        } else if (app.soort === 'bank') {
          kern.huis.push(doos(x0 + 0.25, kern.D - 0.85, z0, 1.1, 0.45, 0.28, ['#46536a', '#3a465a', '#2f394a']));
        }
      }

      /* ---- de inrichting van een kamer ---- */
      /*
       * Een paar meubels per soort kamer (slaapkamer, woonkamer, keuken,
       * badkamer, hal, werkkamer, wasruimte, zolder, eetkamer), zodat je ziet
       * wat voor kamer het is. De soort komt uit de naam, of per zone uit de
       * naam van de zone ("Keuken", "Zithoek"); `kamer.inrichting` gaat voor.
       *
       * De apparaten blijven te zien: een meubel tegen de achterwand blijft weg
       * bij het raam, de radiator, de cv en de airco, onder het dak alleen waar
       * het rechtop past, en staat er witgoed, dan blijft het midden vrij. De
       * meubels zijn gedempt van kleur, zodat de naam en de temperatuur van de
       * kamer de blikvanger blijven.
       */
      function inrichten(kamer, x0, x1, z0, z1, plafond, donker) {
        if (!kern.opts.meubels) return;
        const apps = kamer.apparaten ?? [];
        const witgoed = apps.some((a) => kern.WITGOED.test(a.soort));
        // Welke delen: een gekozen soort geldt voor de hele kamer, een woonkamer met
        // open keuken is links keuken en rechts zithoek, en anders per zone of de naam.
        // Heeft die open keuken een zone die keuken heet, dan staat de keuken onder
        // die naam en de zithoek onder de andere. Witgoed houdt het midden vrij.
        const zones = (kamer.zones ?? []).length > 1 ? kamer.zones : [null];
        const gekozen = kamer.inrichting ?? (zones.length > 1 ? null : kern.soortVanKamer(kamer));
        const perZone = (soort) => zones.map((zone, i) => [soort(zone), i / zones.length, (i + 1) / zones.length]);
        const woonkeuken = zones.some((zone) => zone && kern.zoneSoort(zone) === 'keuken')
          ? perZone((zone) => (kern.zoneSoort(zone) === 'keuken' ? 'keuken' : 'woonkamer'))
          : [['keuken', 0, zones.length === 2 ? 0.5 : 0.45], ['woonkamer', zones.length === 2 ? 0.5 : 0.45, 1]];
        const delen = gekozen === 'woonkeuken'
          ? woonkeuken
          : gekozen
            ? [[gekozen, 0, 1]]
            : perZone((zone) => (zone && kern.zoneSoort(zone)) ?? kern.soortVan(kamer.naam));
        const soorten = delen.map(([soort]) => (witgoed && soort !== 'leeg' ? 'wasruimte' : kern.MEUBELS_ALS[soort] ?? soort));
        // Heeft het grootste meubel de achterwand nodig, dan hangt de radiator aan de zijmuur.
        const ACHTERWAND = ['keuken', 'badkamer', 'toilet', 'woonkamer', 'slaapkamer', 'kinderkamer', 'logeerkamer', 'werkkamer'];
        kern.radiatorZij = !plafond && ACHTERWAND.includes(soorten[0]) && apps.some((a) => a.soort === 'radiator');
        // Waar op de achterwand niets hoogs mag: [van, tot, vanaf welke hoogte].
        const bezet = [];
        const raam = plafond ? null : raamVan(kamer, x0, x1);
        if (raam) bezet.push([raam[0] - 0.06, raam[1] + 0.06, 0.38, 'raam']);
        if (apps.some((a) => a.soort === 'radiator') && !kern.radiatorZij) {
          const r = radiatorPlek(x0, x1, z0, plafond);
          bezet.push([r.x - 0.05, r.x + r.b + 0.05, 0]);
        }
        if (apps.some((a) => a.soort === 'cv')) bezet.push([x0 + 0.15, x0 + 0.67, 0.45]);
        if (apps.some((a) => a.soort === 'boiler')) bezet.push([boilerX(x0, x1) - 0.22, boilerX(x0, x1) + 0.22, 0]);
        if (!plafond && apps.some((a) => a.soort === 'airco')) {
          const p = aircoPlek(kamer, x0, x1, z1);
          if (p.wand === 'achter') bezet.push([p.ax - 0.05, p.ax + kern.AIRCO.b + 0.05, p.az - 0.02 - z0]);
        }
        // Het witgoed tegen de achtermuur (besluit 167): daar komt geen meubel.
        if (!plafond) for (const a of apps.filter((x) => kern.WITGOED.test(x.soort))) {
          const tx = a.x != null ? x0 + (x1 - x0) * a.x : toestelPlek(kamer, x0, x1);
          bezet.push([tx - 0.05, tx + kern.TOESTEL.b + 0.05, 0]);
        }
        if (plafond && kern.aircoDak) bezet.push(kern.aircoDak.wand === 'links' ? [x0, x0 + 0.5, 0.6] : [kern.aircoDak.ax - 0.05, kern.aircoDak.ax + kern.AIRCO.b + 0.05, kern.aircoDak.az - 0.02 - z0]);
        const hoogte = (x) => (plafond ? plafond(x) - z0 : z1 - z0);
        // De hanglampen, zoals apparaat() ze tekent: hun onderkant boven de vloer.
        const lampen = apps.filter((a) => a.soort === 'lamp').map((a) => {
          const lx = a.x != null ? x0 + (x1 - x0) * a.x : (x0 + x1) / 2;
          return { x0: lx - 0.12, x1: lx + 0.12, onder: Math.min(hoogte(lx) + z0, z1) - 0.36 - z0 };
        });
        // Rechts staat de muur van de volgende kamer: die schuift achterin over wat
        // er vlak voor staat. Daar blijft een strook vrij.
        let rechts = x1 < kern.W - 0.01 ? x1 - 0.5 : x1;
        /** Wat al tegen de achterwand staat, houdt zijn plek. */
        const neem = (x, w) => bezet.push([x - 0.03, x + w + 0.03, -1]);
        /** Past iets van `w` breed en `h` hoog hier: niet tegen iets op de achterwand, en onder het dak rechtop. */
        const past = (x, w, h, tegenMuur, voorRaam = false, diep = 0.5) =>
          (!tegenMuur || x + w <= rechts + 1e-9) &&
          hoogte(x) >= h + 0.04 &&
          hoogte(x + w) >= h + 0.04 &&
          (!tegenMuur || !bezet.some(([a, b, vanaf, wat]) => x < b && x + w > a && h > vanaf && !(voorRaam && wat === 'raam'))) &&
          // Onder een hanglamp blijft ruimte; alleen wat diep de kamer in staat, komt eronder.
          !(diep > 0.5 && lampen.some((l) => x < l.x1 && x + w > l.x0 && h > l.onder - 0.03));
        /** De beste plek voor iets van `w` breed in [a, b): `kant` links, rechts of midden. */
        const zoek = (a, b, w, h, kant, tegenMuur = true, voorRaam = false, diep = 0.5) => {
          const kandidaten = [];
          for (let x = a + 0.08; x <= b - w - 0.08 + 1e-9; x += 0.04) if (past(x, w, h, tegenMuur, voorRaam, diep)) kandidaten.push(x);
          // Past het nergens met de strook vrij, dan maar tot aan de muur.
          if (!kandidaten.length && rechts < x1) {
            const was = rechts;
            rechts = x1;
            for (let x = a + 0.08; x <= b - w - 0.08 + 1e-9; x += 0.04) if (past(x, w, h, tegenMuur, voorRaam, diep)) kandidaten.push(x);
            rechts = was;
          }
          if (!kandidaten.length) return null;
          const doel = kant === 'links' ? a : kant === 'rechts' ? b - w : (a + b - w) / 2;
          return kandidaten.sort((p, q) => Math.abs(p - doel) - Math.abs(q - doel))[0];
        };
        const stukken = [];
        /** Welk deel van de kamer nu ingericht wordt, voor de controle. */
        let deel = null;
        /** Een meubel op (x, y); `maat` is [breed, diep, hoog], voor de controle. */
        const zet = (y, x, svgTekst, maat) => {
          stukken.push({ y, x, svgTekst });
          if (kern.opts.controle && maat) {
            const [w, d, h, vanaf = 0] = maat;
            kern.controle.push({ kamer: kamer.id ?? kamer.naam, wat: 'meubel', deel, x0: x, x1: x + w, y0: y, y1: y + d, z0: z0 + vanaf, z1: z0 + vanaf + h, ruimte: [x0, x1], plafond: z0 + Math.min(hoogte(x), hoogte(x + w)) });
          }
        };

        const tafel = (x, y, w, d, h, kl = kern.MEUBEL.hout) => {
          const poot = 0.035;
          return [
            doos(x + 0.03, y + 0.03, z0, poot, poot, h - 0.03, kl),
            doos(x + w - 0.03 - poot, y + 0.03, z0, poot, poot, h - 0.03, kl),
            doos(x + 0.03, y + d - 0.03 - poot, z0, poot, poot, h - 0.03, kl),
            doos(x + w - 0.03 - poot, y + d - 0.03 - poot, z0, poot, poot, h - 0.03, kl),
            doos(x, y, z0 + h - 0.03, w, d, 0.03, kl),
          ].join('');
        };
        const stoel = (x, y, rugAchter = false) =>
          doos(x, y, z0, 0.2, 0.2, 0.2, kern.MEUBEL.donker) + (rugAchter ? doos(x, y, z0 + 0.2, 0.2, 0.04, 0.2, kern.MEUBEL.donker) : doos(x, y + 0.16, z0 + 0.2, 0.2, 0.04, 0.2, kern.MEUBEL.donker));
        const plant = (x, y) => {
          const c = kern.P(x + 0.07, y + 0.07, z0 + 0.36);
          return `${doos(x, y, z0, 0.14, 0.14, 0.16, kern.MEUBEL.doos)}<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(kern.k * 0.13).toFixed(1)}" ry="${(kern.k * 0.17).toFixed(1)}" fill="${kern.MEUBEL.groen}"/><ellipse cx="${(c[0] - kern.k * 0.05).toFixed(1)}" cy="${(c[1] - kern.k * 0.06).toFixed(1)}" rx="${(kern.k * 0.06).toFixed(1)}" ry="${(kern.k * 0.08).toFixed(1)}" fill="#76b48f" opacity="0.8"/>`;
        };
        const kleed = (a, b, y0, y1) => kern.poly([[a, y0, z0 + 0.004], [b, y0, z0 + 0.004], [b, y1, z0 + 0.004], [a, y1, z0 + 0.004]], `fill="${kern.MEUBEL.kleed}" opacity="0.3"`);

        function bed(a, b, breed) {
          // Past een tweepersoonsbed niet, dan een eenpersoons.
          if (breed && zoek(a, b, 0.95, 0.34, 'midden', true, false, 1.16) == null) breed = false;
          const bw = breed ? 0.95 : 0.55;
          const L = breed ? 1.12 : 0.98;
          const x = zoek(a, b, bw, 0.34, breed ? 'midden' : 'links', true, false, L + 0.04);
          if (x == null) return;
          const y = 0.04;
          neem(x, bw);
          const kussens = breed ? [x + 0.08, x + bw / 2 + 0.02] : [x + 0.08];
          const kw = breed ? bw / 2 - 0.1 : bw - 0.16;
          zet(y, x, [
            doos(x, y, z0, bw, 0.06, 0.34, kern.MEUBEL.hout),
            doos(x, y + 0.06, z0, bw, L - 0.06, 0.14, kern.MEUBEL.hout),
            doos(x + 0.03, y + 0.08, z0 + 0.14, bw - 0.06, L - 0.12, 0.07, kern.MEUBEL.wit),
            ...kussens.map((kx) => doos(kx, y + 0.1, z0 + 0.21, kw, 0.2, 0.05, kern.MEUBEL.wit)),
            doos(x + 0.02, y + 0.38, z0 + 0.18, bw - 0.04, L - 0.44, 0.07, kern.MEUBEL.dek),
          ].join(''), [bw, L, 0.34]);
          // Een nachtkastje ernaast, als het past.
          if (past(x + bw + 0.05, 0.22, 0.26, true) && x + bw + 0.3 <= b) {
            zet(y, x + bw + 0.05, doos(x + bw + 0.05, y, z0, 0.22, 0.22, 0.24, kern.MEUBEL.hout), [0.22, 0.22, 0.24]);
            neem(x + bw + 0.05, 0.22);
          }
          else if (breed && past(x - 0.27, 0.22, 0.26, true) && x - 0.27 >= a) zet(y, x - 0.27, doos(x - 0.27, y, z0, 0.22, 0.22, 0.24, kern.MEUBEL.hout), [0.22, 0.22, 0.24]);
        }
        function bureau(a, b) {
          const x = zoek(a, b, 0.7, 0.62, 'rechts', true, true);
          if (x == null) return;
          neem(x, 0.7);
          zet(0.04, x, `${tafel(x, 0.04, 0.7, 0.34, 0.42)}${doos(x + 0.22, 0.1, z0 + 0.42, 0.28, 0.03, 0.2, ['#2a3443', '#1c2430', '#161d27'])}`, [0.7, 0.34, 0.62]);
          zet(0.55, x + 0.25, stoel(x + 0.25, 0.55), [0.2, 0.2, 0.4]);
        }
        function kast(a, b) {
          // Een boekenkast tegen de achterwand, met planken.
          const x = zoek(a, b, 0.42, 0.7, 'links');
          if (x == null) return;
          neem(x, 0.42);
          const planken = [0.24, 0.46].map((h) => kern.line([[x + 0.03, 0.26, z0 + h], [x + 0.39, 0.26, z0 + h]], 'stroke="#4e4135" stroke-width="1.2"')).join('');
          zet(0.03, x, `${doos(x, 0.03, z0, 0.42, 0.24, 0.7, kern.MEUBEL.hout)}${planken}`, [0.42, 0.24, 0.7]);
        }

        function meubels(soort, a, b) {
          const w = b - a;
          if (soort === 'slaapkamer' || soort === 'kinderkamer' || soort === 'logeerkamer') {
            bed(a, b, soort !== 'kinderkamer' && w > 1.3);
            if (soort === 'kinderkamer' && w > 1.4) {
              const x = zoek(a, b, 0.5, 0.36, 'rechts');
              if (x != null) {
                neem(x, 0.5);
                zet(0.04, x, tafel(x, 0.04, 0.5, 0.3, 0.36), [0.5, 0.3, 0.36]);
              }
            }
          } else if (soort === 'woonkamer') {
            const sw = Math.min(1.15, w - 0.35);
            if (sw < 0.6) return;
            const x = zoek(a, b, sw, 0.42, 'midden');
            if (x != null) {
              neem(x - 0.06, sw + 0.12);
              stukken.push({ y: -1, x, svgTekst: kleed(x + 0.05, x + sw - 0.05, 0.5, 1.2) });
              zet(0.04, x, [
                doos(x, 0.04, z0, sw, 0.14, 0.42, kern.MEUBEL.stof),
                doos(x, 0.18, z0, sw, 0.3, 0.2, kern.MEUBEL.stof),
                doos(x + 0.04, 0.18, z0 + 0.2, (sw - 0.08) / 2 - 0.01, 0.28, 0.05, kern.MEUBEL.kussen),
                doos(x + sw / 2 + 0.01, 0.18, z0 + 0.2, (sw - 0.08) / 2 - 0.01, 0.28, 0.05, kern.MEUBEL.kussen),
                doos(x - 0.06, 0.04, z0, 0.08, 0.44, 0.3, kern.MEUBEL.stof),
                doos(x + sw - 0.02, 0.04, z0, 0.08, 0.44, 0.3, kern.MEUBEL.stof),
              ].join(''), [sw, 0.44, 0.42]);
              const tw = Math.min(0.55, sw * 0.5);
              zet(0.66, x + (sw - tw) / 2, tafel(x + (sw - tw) / 2, 0.66, tw, 0.32, 0.17), [tw, 0.32, 0.17]);
            }
            if (w > 1.5 && past(b - 0.3, 0.14, 0.4, true)) zet(0.06, b - 0.3, plant(b - 0.3, 0.06), [0.14, 0.14, 0.4]);
          } else if (soort === 'keuken') {
            // Het aanrecht langs de achterwand, de koelkast aan het eind.
            const kl = Math.min(w - 0.25, 1.6);
            const x = a + 0.1;
            const koel = past(x + kl - 0.38, 0.38, 1.0, true) && kl > 0.9;
            const ak = koel ? kl - 0.4 : kl;
            // Het aanrecht mag onder het raam: daar staat de gootsteen.
            if (ak > 0.3 && past(x, ak, 0.36, true)) {
              zet(0.03, x, [
                doos(x, 0.03, z0, ak, 0.32, 0.4, ['#6c7d93', '#5d6d82', '#4f5d70']),
                doos(x - 0.01, 0.02, z0 + 0.4, ak + 0.02, 0.34, 0.03, kern.MEUBEL.blad),
                kern.poly([[x + 0.12, 0.08, z0 + 0.432], [x + 0.36, 0.08, z0 + 0.432], [x + 0.36, 0.26, z0 + 0.432], [x + 0.12, 0.26, z0 + 0.432]], 'fill="#5b6876"'),
                ak > 0.8 ? [0, 1].map((i) => { const c = kern.P(x + ak - 0.32 + i * 0.16, 0.18, z0 + 0.433); return `<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(kern.k * 0.055).toFixed(1)}" ry="${(kern.k * 0.028).toFixed(1)}" fill="#2a323d"/>`; }).join('') : '',
              ].join(''), [ak, 0.33, 0.43]);
              neem(x, ak);
              // Kastjes aan de muur, alleen waar geen raam of airco zit.
              for (let ux = x; ux + 0.3 <= x + ak + 1e-9; ux += 0.32) {
                if (past(ux, 0.3, 1.18, true) && hoogte(ux) > 1.25) zet(0.02, ux, doos(ux, 0.02, z0 + 0.88, 0.3, 0.2, 0.3, ['#7a8aa0', '#6a7a8f', '#5b6a7e']), [0.3, 0.2, 0.3, 0.88]);
              }
            }
            if (koel) zet(0.03, x + kl - 0.38, doos(x + kl - 0.38, 0.03, z0, 0.38, 0.34, 1.0, kern.MEUBEL.wit) + kern.line([[x + kl - 0.38, 0.37, z0 + 0.62], [x + kl, 0.37, z0 + 0.62]], 'stroke="#9aa6b2" stroke-width="1"'), [0.38, 0.34, 1.0]);
          } else if (soort === 'eetkamer') {
            const tw = Math.min(0.9, w - 0.5);
            if (tw < 0.4) return;
            const x = a + (w - tw) / 2;
            if (!past(x, tw, 0.4, false, false, 0.9)) return;
            const plekken = tw >= 0.7 ? [x + 0.12, x + tw - 0.32] : [x + (tw - 0.2) / 2];
            for (const sx of plekken) zet(0.28, sx, stoel(sx, 0.28, true), [0.2, 0.2, 0.4]);
            zet(0.5, x, tafel(x, 0.5, tw, 0.45, 0.36), [tw, 0.45, 0.36]);
            for (const sx of plekken) zet(0.97, sx, stoel(sx, 0.97), [0.2, 0.2, 0.4]);
          } else if (soort === 'badkamer' || soort === 'toilet') {
            // Een bad als het past; anders een douche met glas in de hoek.
            const bad = soort === 'badkamer' && w > 1.6 ? zoek(a, b, 0.85, 0.32, 'rechts') : null;
            if (bad != null) {
              const x = bad;
              neem(x, 0.85);
              zet(0.04, x, [
                doos(x, 0.04, z0, 0.85, 0.42, 0.3, kern.MEUBEL.wit),
                kern.poly([[x + 0.07, 0.1, z0 + 0.301], [x + 0.78, 0.1, z0 + 0.301], [x + 0.78, 0.4, z0 + 0.301], [x + 0.07, 0.4, z0 + 0.301]], 'fill="#8fc6e0" opacity="0.75"'),
              ].join(''), [0.85, 0.42, 0.3]);
            } else if (soort === 'badkamer') {
              const x = zoek(a, b, 0.5, 1.1, 'rechts');
              if (x != null) neem(x, 0.5);
              if (x != null) zet(0.04, x, `${doos(x, 0.04, z0, 0.5, 0.5, 0.04, kern.MEUBEL.wit)}${doos(x, 0.04, z0 + 0.04, 0.5, 0.5, 1.05, ['#bfe3f2', '#9fd3ea', '#8cc6e0']).replace(/fill="/g, 'fill-opacity="0.22" fill="')}`, [0.5, 0.5, 1.09]);
            }
            // De wastafel, een kastje met een wasbak; hij mag onder het raam.
            const xw = zoek(a, b, 0.4, 0.36, 'links');
            if (xw != null) neem(xw, 0.4);
            if (xw != null) zet(0.04, xw, `${doos(xw, 0.04, z0, 0.4, 0.26, 0.3, kern.MEUBEL.hout)}${doos(xw - 0.01, 0.03, z0 + 0.3, 0.42, 0.28, 0.08, kern.MEUBEL.wit)}`, [0.4, 0.27, 0.38]);
            if (soort === 'toilet' || w > 2.2) {
              const xt = zoek(a, b, 0.22, 0.4, soort === 'toilet' ? 'rechts' : 'midden');
              if (xt != null) neem(xt, 0.22);
              if (xt != null) zet(0.04, xt, `${doos(xt, 0.04, z0 + 0.2, 0.22, 0.1, 0.2, kern.MEUBEL.wit)}${doos(xt + 0.02, 0.14, z0, 0.18, 0.26, 0.22, kern.MEUBEL.wit)}`, [0.22, 0.36, 0.4]);
            }
          } else if (soort === 'hal') {
            // Een trap omhoog langs de zijmuur, van voor naar achter; alleen als er een etage boven is.
            const sw = Math.min(0.45, w - 0.3);
            if (sw < 0.3 || !kern.erBoven) return;
            const n = 8;
            const h = hoogte(a + 0.1);
            const xs = zoek(a, b, sw, h - 0.05, 'links', true, true);
            if (xs == null) return;
            neem(xs, sw);
            const diep = 1.25 / n;
            for (let i = n - 1; i >= 0; i--) {
              const y = 0.05 + i * diep;
              const hi = (h - 0.05) * ((n - i) / n);
              zet(y, xs, doos(xs, y, z0, sw, diep, hi, kern.MEUBEL.hout), [sw, diep, hi]);
            }
          } else if (soort === 'werkkamer') {
            bureau(a, b);
            if (w > 1.5) kast(a, b);
          } else if (soort === 'wasruimte') {
            const x = zoek(a, b, 0.32, 0.3, 'links');
            if (x != null) zet(0.06, x, doos(x, 0.06, z0, 0.32, 0.26, 0.26, ['#c7b9a0', '#b1a389', '#9b8e75']), [0.32, 0.26, 0.26]);
          } else if (soort === 'berging') {
            // Dozen, en in een brede ruimte een stellingkast.
            const x = zoek(a, b, 0.73, 0.5, 'midden');
            if (x != null) {
              neem(x, 0.73);
              zet(0.06, x, `${doos(x, 0.06, z0, 0.4, 0.34, 0.26, kern.MEUBEL.doos)}${doos(x + 0.05, 0.1, z0 + 0.26, 0.3, 0.26, 0.2, kern.MEUBEL.doos)}`, [0.4, 0.34, 0.46]);
              zet(0.06, x + 0.45, doos(x + 0.45, 0.06, z0, 0.28, 0.3, 0.22, kern.MEUBEL.doos), [0.28, 0.3, 0.22]);
            }
            if (w > 1.5) kast(a, b);
          } else if (soort === 'leeg') {
            // Bewust leeg.
          } else {
            // Een kamer zonder bekende soort: een kastje en een plant.
            const x = zoek(a, b, 0.6, 0.4, 'midden');
            if (x != null) {
              neem(x, 0.6);
              zet(0.04, x, doos(x, 0.04, z0, 0.6, 0.28, 0.36, kern.MEUBEL.hout), [0.6, 0.28, 0.36]);
            }
            if (w > 1.2 && past(b - 0.3, 0.14, 0.4, true)) zet(0.06, b - 0.3, plant(b - 0.3, 0.06), [0.14, 0.14, 0.4]);
          }
        }

        // Langs een radiator aan de zijmuur blijft een strook vrij.
        soorten.forEach((soort, i) => {
          deel = soort;
          meubels(soort, x0 + (x1 - x0) * delen[i][1] + (kern.radiatorZij && i === 0 ? 0.12 : 0), x0 + (x1 - x0) * delen[i][2]);
        });
        if (!stukken.length) return;
        // Van achter naar voor, en van links naar rechts: wat dichterbij staat, komt erover.
        stukken.sort((p, q) => p.y - q.y || p.x - q.x);
        kern.huis.push(`<g class="sc-meubels"${donker ? ' opacity="0.4"' : ''}>${stukken.map((s) => s.svgTekst).join('')}</g>`);
      }

    return { vindKamer, kleurAchter, sfeer, tekenKamer, kamerLabel, doos, aircoOnderDak, apparaat, inrichten };
  };
})(window);
