/*
 * SunArc: je huis tekenen, het tekenen (22 november 2026, opgesplitst uit kit/huistekenen.js).
 *
 * De tekening zelf, laag voor laag: de vloer en de ruimtes, de muren, deuren en ramen met hun draairichting,
 * de trap, de apparaten als bolletjes, de namen, en de knop Hele huis. Alleen lezen: wat er verandert, doet de
 * tekenaar of het gebaar.
 *
 * global.htTeken(kern) maakt dit deel voor één tekenaar; `kern` geeft wat de tekenaar deelt (zie maak() in huistekenen.js).
 */
(function (global) {
  'use strict';
  const { CEL, BUITEN, MARGE, FONT, esc, T, nl, meter, klem, ik, TINT, SOORT_TINT, APP_KLEUR, APP_ICOON, randen, isMuur, lijnPad, MET_SCHARNIER, openingMuur, openingBinnen, TRAP_RICHTING, vlakPaden, maten } = global.htVloer;
  global.htTeken = function (kern) {
      /* ---------- tekenen */
      kern.svg.classList.add('ht');
      kern.svg.style.touchAction = 'none';
      kern.svg.innerHTML = `<defs><pattern id="ht-leeg" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V3.2" stroke="rgb(247 181 72 / 0.13)" stroke-width="0.7"/></pattern></defs><g data-l="onder"></g><g data-l="vlak"></g><g data-l="namen"></g><g data-l="app"></g><g data-l="over"></g><g data-l="knop"></g>`;
      const laag = (n) => kern.svg.querySelector(`[data-l="${n}"]`);
      const pil = (x, y, tekst, kleur = '#a9e6ff', draai = false) => {
        const bw = tekst.length * 6.9 + 16;
        return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})${draai ? ' rotate(-90)' : ''}" pointer-events="none"><rect x="${-bw / 2}" y="-12" width="${bw}" height="24" rx="8" fill="#0d1a30" stroke="${kleur}" stroke-opacity="0.55"/><text y="4.5" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="${kleur}">${esc(tekst)}</text></g>`;
      };

      function teken() {
        if (!kern.kijk) return;
        // Het huis zoals getekend (23 november 2026): de pagina tekent het met kit/huis-maat.js, net als op Thuis.
        if (kern.st.stand === 'huis') {
          for (const n of ['onder', 'namen', 'app', 'over', 'knop']) laag(n).innerHTML = '';
          // Zonder tekening van de pagina (de schetsen): het huis zelf, zonder erf, de gekozen etage open of dicht.
          const zelf = (t, B, H) => global.huisMaat?.teken(t, B, H, { hoek: kern.st.hoek, rand: 16, stil: B < 600, ...(kern.st.dicht ? {} : { etage: kern.st.etage, meubels: true, geenEiland: true }) }).svg ?? '';
          laag('vlak').innerHTML = (kern.huisTekening ?? zelf)(kern.t, kern.B, kern.Hpx);
          return;
        }
        const v = kern.actie?.voorbeeld ?? kern.vloer();
        const m = maten(v);
        const tf = `translate(${kern.ox.toFixed(2)} ${kern.oy.toFixed(2)}) scale(${kern.k.toFixed(4)} ${(-kern.k).toFixed(4)})`;
        const app = kern.st.stand === 'apparaten';
        const vorm = kern.st.stand === 'vorm';

        // De etage eronder, als stippellijn om muren boven elkaar te zetten.
        const eronder = kern.onder();
        let s = '';
        if (eronder && kern.st.stand === 'kamers') {
          const d = randen(kern.st.vloeren[eronder.id], isMuur).filter((r) => r.soort === 1).map(lijnPad).join('');
          s = `<g transform="${tf}"><path d="${d}" fill="none" stroke="rgb(255 255 255 / 0.2)" stroke-width="1.5" stroke-dasharray="5 6" vector-effect="non-scaling-stroke"/></g>`;
        }
        // Het trapgat: waar de trap van de etage eronder hier uitkomt.
        if (kern.metOpeningen && eronder && kern.st.stand !== 'vorm') {
          const vo = kern.st.vloeren[eronder.id];
          const mo = maten(vo);
          for (const [id, r] of Object.entries(vo.ruimtes)) {
            if (kern.soortVan(r) !== 'trap' || !mo[id]) continue;
            const b = mo[id];
            s += `<g transform="${tf}"><rect x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${b.y1 - b.y0}" fill="rgb(255 255 255 / 0.05)" stroke="#a9e6ff" stroke-opacity="0.6" stroke-width="1.5" stroke-dasharray="6 5" vector-effect="non-scaling-stroke"/></g>`;
            s += `<text x="${kern.X((b.x0 + b.x1) / 2).toFixed(1)}" y="${(kern.Y((b.y0 + b.y1) / 2) + 4).toFixed(1)}" text-anchor="middle" ${FONT} font-size="12" font-weight="700" fill="#a9e6ff" pointer-events="none">${esc(T('ht.trap.gat'))}</text>`;
          }
        }
        laag('onder').innerHTML = s;

        // De ruimtes in hun kleur, en de muren.
        const paden = vlakPaden(v);
        s = `<g transform="${tf}">`;
        // Bij Vorm: de gebouwen van de kaart eromheen, grijs, om aan te wijzen.
        if (vorm) {
          for (const q of kern.omgeving()) {
            const aan = kern.st.kies?.soort === 'omgeving' && kern.st.kies.i === q.i;
            s += `<polygon class="ht-omgeving" points="${q.punten.map(([x, y]) => `${(MARGE + x / CEL).toFixed(1)},${(MARGE + y / CEL).toFixed(1)}`).join(' ')}" fill="${aan ? 'rgb(111 211 255 / 0.22)' : 'rgb(255 255 255 / 0.07)'}" stroke="${aan ? '#6fd3ff' : 'rgb(255 255 255 / 0.35)'}" stroke-width="${aan ? 3 : 1.5}" stroke-dasharray="${aan ? '' : '6 5'}" vector-effect="non-scaling-stroke"/>`;
          }
          // Wat bij je huis hoort maar op het erf staat: een lichte, doorgetrokken rand.
          for (const q of kern.opErfBlokken()) s += `<rect class="ht-op-erf" x="${(MARGE + q.u / CEL).toFixed(1)}" y="${(MARGE + q.v / CEL).toFixed(1)}" width="${(q.b / CEL).toFixed(1)}" height="${(q.d / CEL).toFixed(1)}" fill="rgb(169 230 255 / 0.08)" stroke="#a9e6ff" stroke-opacity="0.7" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
        }
        for (const [id, d] of Object.entries(paden)) {
          const r = v.ruimtes[id];
          const naam = kern.naamVan(r);
          const gekozen = kern.st.kies?.soort === 'ruimte' && kern.st.kies.id === Number(id);
          const doel = kern.actie?.doel === Number(id);
          const dim = app && kern.st.zoom != null && kern.st.zoom !== Number(id);
          const tint = TINT[SOORT_TINT[kern.soortVan(r)] ?? (r?.kamer ? 'woon' : naam ? 'hal' : 'leeg')];
          const sterk = vorm ? 0.1 : doel ? 0.42 : gekozen ? 0.34 : naam ? (dim ? 0.07 : 0.19) : 0.05;
          s += `<path d="${d}" fill="rgb(${tint} / ${sterk})"/>`;
          // Bij Dak geen arcering voor een vak zonder naam: daar zijn de strepen voor wat lager is dan 1,5 m (20 november 2026).
          if (!naam && !vorm && kern.st.stand !== 'dak') s += `<path d="${d}" fill="url(#ht-leeg)" opacity="${dim ? 0.3 : 1}"/>`;
        }
        const muren = randen(v, isMuur);
        const binnen = muren.filter((r) => r.soort === 1).map(lijnPad).join('');
        const buiten = muren.filter((r) => r.soort === 2).map(lijnPad).join('');
        if (!vorm) s += `<path d="${binnen}" fill="none" stroke="#c9d3dc" stroke-width="3" stroke-linecap="square" vector-effect="non-scaling-stroke"/>`;
        s += `<path d="${buiten}" fill="none" stroke="#eef3f7" stroke-width="${vorm ? 6 : 5}" stroke-linecap="square" vector-effect="non-scaling-stroke"/>`;
        if (vorm || kern.st.stand === 'kamers') {
          const bm = kern.buurMuren().map(lijnPad).join('');
          if (bm) s += `<path d="${bm}" fill="none" stroke="#ffb07a" stroke-width="${vorm ? 7 : 6}" vector-effect="non-scaling-stroke"/><path d="${bm}" fill="none" stroke="#0b1424" stroke-width="${vorm ? 7 : 6}" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>`;
        }
        if (kern.metOpeningen && !vorm) s += openingenPad(v);
        if (kern.metOpeningen && !vorm) s += trapPad(v, m);
        // Wat gekozen is: de rand van de ruimte, of de muur zelf.
        if (kern.st.kies?.soort === 'ruimte' && m[kern.st.kies.id]) {
          const id = kern.st.kies.id;
          s += `<path d="${randen(v, (a, b) => ((a === id) !== (b === id) ? 1 : 0)).map(lijnPad).join('')}" fill="none" stroke="#6fd3ff" stroke-width="4" stroke-linecap="square" vector-effect="non-scaling-stroke"/>`;
        }
        if (kern.actie?.doel != null && m[kern.actie.doel]) {
          const id = kern.actie.doel;
          s += `<path d="${randen(v, (a, b) => ((a === id) !== (b === id) ? 1 : 0)).map(lijnPad).join('')}" fill="none" stroke="#6ee7b7" stroke-width="4" stroke-linecap="square" vector-effect="non-scaling-stroke"/>`;
        }
        // Zones: een groene stippellijn in de kamer, geen muur.
        const zones = vorm ? [] : kern.zonesOp(v);
        for (const zz of zones) s += `<path d="${zz.stukken.map(lijnPad).join('')}" fill="none" stroke="#6ee7b7" stroke-width="${kern.actie?.type === 'zone' && kern.actie.kamer === zz.kamer ? 5 : 3}" stroke-dasharray="9 7" vector-effect="non-scaling-stroke"/>`;
        const muur = kern.actie?.type === 'muur' ? kern.actie.nu : kern.st.kies?.soort === 'muur' ? kern.st.kies.run : kern.actie?.kandidaat?.soort === 'muur' && !kern.actie.type ? kern.actie.kandidaat.m : null;
        if (muur) s += `<path d="${lijnPad(muur)}" fill="none" stroke="#6fd3ff" stroke-width="7" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
        s += '</g>';
        // De greep op een gekozen muur: laat zien dat hij te pakken is.
        if (muur) {
          const mid = (muur.van + muur.tot) / 2;
          const gx = muur.as === 'x' ? kern.X(muur.op) : kern.X(mid);
          const gy = muur.as === 'x' ? kern.Y(mid) : kern.Y(muur.op);
          const pijl = muur.as === 'x' ? 'M-5 0h10M-5 0l3-3M-5 0l3 3M5 0l-3-3M5 0l-3 3' : 'M0-5v10M0-5l-3 3M0-5l3 3M0 5l-3-3M0 5l3-3';
          s += `<g transform="translate(${gx.toFixed(1)} ${gy.toFixed(1)})" pointer-events="none"><circle r="15" fill="#6fd3ff"/><path d="${pijl}" stroke="#0b1424" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>`;
        }
        // Het scharnier van de gekozen deur: een stip om te tikken.
        const sp = kern.metOpeningen ? scharnierStip(v) : null;
        if (sp) s += `<g transform="translate(${kern.X(sp.x).toFixed(1)} ${kern.Y(sp.y).toFixed(1)})" pointer-events="none"><circle r="10" fill="#6fd3ff" stroke="#0b1424" stroke-width="2.5"/><path d="M-3.5 -1.5a3.6 3.6 0 1 1 0 3" stroke="#0b1424" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`;
        // De greep om een gekozen ruimte in zijn geheel te verplaatsen.
        const greep = !kern.actie || kern.actie.type === 'verplaats' ? kern.greepPlek(v) : null;
        if (greep) s += `<g transform="translate(${greep.px.toFixed(1)} ${greep.py.toFixed(1)})" pointer-events="none"><circle r="17" fill="#6fd3ff" stroke="#0b1424" stroke-width="2"/><path d="M-9 0h18M0-9v18M-9 0l3-3M-9 0l3 3M9 0l-3-3M9 0l-3 3M0-9l-3 3M0-9l3 3M0 9l-3-3M0 9l3-3" stroke="#0b1424" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>`;
        laag('vlak').innerHTML = s;

        // De namen: in het grootste rechte stuk van de ruimte.
        s = '';
        for (const [id, mm] of Object.entries(m)) {
          const r = v.ruimtes[id];
          if (!mm.r) continue;
          const naam = kern.naamVan(r);
          const pb = (mm.r.x1 - mm.r.x0) * kern.k;
          const pd = (mm.r.y1 - mm.r.y0) * kern.k;
          const m2 = `${nl(mm.n * CEL * CEL, 0)} m²`;
          const dim = app && kern.st.zoom != null && kern.st.zoom !== Number(id);
          if (vorm) continue;
          if (app) {
            // Bij apparaten staat de naam klein in de hoek: het midden is voor de apparaten.
            // Een kamer met zones heet ook hier naar zijn zones: elke kant van de stippellijn zijn eigen naam.
            const zz = zones.find((x) => x.id === Number(id));
            if (zz) {
              const label = (x, y, tekst) => `<text x="${(kern.X(x) + 9).toFixed(1)}" y="${(kern.Y(y) + 19).toFixed(1)}" ${FONT} font-size="12.5" font-weight="700" fill="rgb(110 231 183 / ${dim ? 0.3 : 0.85})" pointer-events="none">${esc(tekst)}</text>`;
              s += zz.z.as === 'x' ? label(mm.x0, mm.y1, zz.namen[0] ?? '') + label(zz.z.op, mm.y1, zz.namen[1] ?? '') : label(mm.x0, zz.z.op, zz.namen[0] ?? '') + label(mm.x0, mm.y1, zz.namen[1] ?? '');
              continue;
            }
            if (pb > 50 && pd > 26) s += `<text x="${(kern.X(mm.r.x0) + 9).toFixed(1)}" y="${(kern.Y(mm.r.y1) + 19).toFixed(1)}" ${FONT} font-size="12.5" font-weight="700" fill="rgb(255 255 255 / ${dim ? 0.25 : 0.62})" pointer-events="none">${esc(naam ?? '')}</text>`;
            continue;
          }
          // Een kamer met zones heet naar zijn zones, bij de lijn.
          if (zones.some((zz) => zz.id === Number(id)) && !kern.actie?.type) continue;
          const cx = kern.X((mm.r.x0 + mm.r.x1) / 2);
          const cy = kern.Y((mm.r.y0 + mm.r.y1) / 2);
          // Bij Dak alleen de namen, klein en bescheiden: het dak en de dakkapel staan voorop.
          if (kern.st.stand === 'dak') {
            if (naam && pb > naam.length * 7 && pd > 18) s += `<text x="${cx.toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle" ${FONT} font-size="12" font-weight="700" fill="rgb(255 255 255 / 0.4)" pointer-events="none">${esc(naam)}</text>`;
            continue;
          }
          const tekst = naam ?? T('ht.watIsDit');
          const fs = pb < 74 || pd < 44 ? 11.5 : pb > 200 && pd > 120 ? 17 : 14.5;
          if (pb < tekst.length * fs * 0.5 || pd < 18) continue;
          const kleur = naam ? (r.kamer ? '#eef3f7' : 'rgb(255 255 255 / 0.72)') : '#ffd38a';
          // Met de greep in het midden staat de naam erboven, als daar plek is.
          if (greep && kern.st.kies.id === Number(id)) {
            if (pd > 78) s += `<text x="${cx.toFixed(1)}" y="${(cy - 26).toFixed(1)}" text-anchor="middle" ${FONT} font-size="${fs}" font-weight="700" fill="${kleur}" pointer-events="none">${esc(tekst)}</text>`;
            continue;
          }
          const metMaat = pd > 46 && pb > 60;
          s += `<text x="${cx.toFixed(1)}" y="${(cy + (metMaat ? -2 : 4)).toFixed(1)}" text-anchor="middle" ${FONT} font-size="${fs}" font-weight="700" fill="${kleur}" pointer-events="none">${esc(tekst)}</text>`;
          if (metMaat) s += `<text x="${cx.toFixed(1)}" y="${(cy + 15).toFixed(1)}" text-anchor="middle" ${FONT} font-size="11.5" fill="rgb(255 255 255 / 0.5)" pointer-events="none">${m2}${naam && !r.kamer && pb > 150 ? ` · ${esc(T('ht.nietInHA'))}` : ''}</text>`;
        }
        // De namen van de zones aan weerszijden van hun lijn, bij het langste stuk.
        if (!app && !kern.actie?.type) {
          for (const zz of zones) {
            const st2 = zz.stukken.reduce((a, b) => (b.tot - b.van > a.tot - a.van ? b : a));
            if ((st2.tot - st2.van) * kern.k < 60) continue;
            const mid = (st2.van + st2.tot) / 2;
            const [een, twee] = [zz.namen[0] ?? '', zz.namen[1] ?? ''];
            const half = (tekst) => (tekst.length * 6.9 + 16) / 2 + 9;
            if (zz.z.as === 'x') s += pil(kern.X(zz.z.op) - half(een), kern.Y(mid), een, '#6ee7b7') + pil(kern.X(zz.z.op) + half(twee), kern.Y(mid), twee, '#6ee7b7');
            else s += pil(kern.X(mid), kern.Y(zz.z.op) + 19, een, '#6ee7b7') + pil(kern.X(mid), kern.Y(zz.z.op) - 19, twee, '#6ee7b7');
          }
        }
        // De maten van wat gekozen is, of van het hele huis bij Vorm.
        if (!kern.actie?.type) {
          if (vorm) {
            for (const r of muren.filter((x) => x.soort === 2 && x.tot - x.van >= 20)) {
              const mid = (r.van + r.tot) / 2;
              const buitenkant = (r.as === 'x' ? v.cel[Math.floor(mid) * v.W + r.op] : v.cel[r.op * v.W + Math.floor(mid)]) === BUITEN ? 1 : -1;
              s += r.as === 'x' ? pil(kern.X(r.op) + buitenkant * 22, kern.Y(mid), meter(r.tot - r.van), '#6ee7b7', true) : pil(kern.X(mid), kern.Y(r.op) - buitenkant * 20, meter(r.tot - r.van), '#6ee7b7');
            }
          } else if (kern.st.kies?.soort === 'ruimte' && m[kern.st.kies.id]?.r && !app) {
            const r = m[kern.st.kies.id].r;
            // Alleen waar ze de naam niet in de weg zitten; de maat staat ook in het blad.
            if ((r.x1 - r.x0) * kern.k > 150 && (r.y1 - r.y0) * kern.k > 110) {
              s += pil(kern.X((r.x0 + r.x1) / 2), kern.Y(r.y1) + 20, meter(r.x1 - r.x0));
              s += pil(kern.X(r.x0) + 20, kern.Y((r.y0 + r.y1) / 2), meter(r.y1 - r.y0), '#a9e6ff', true);
            }
          }
        }
        // Bij Vorm: wat er naast het hoofdhuis staat, met zijn naam; een gekozen gebouw met een blauwe rand.
        if (vorm && (!kern.actie?.type || kern.actie.type === 'blokmaat')) {
          for (const b0 of kern.bijBlokken()) {
            const aan = kern.st.kies?.soort === 'blok' && kern.st.kies.id === b0.id;
            const b = kern.maatVan(b0);
            const [x0, y0, x1, y1] = [kern.X(MARGE + b.u / CEL), kern.Y(MARGE + b.v / CEL), kern.X(MARGE + (b.u + b.b) / CEL), kern.Y(MARGE + (b.v + b.d) / CEL)];
            if (aan) s += `<rect x="${Math.min(x0, x1).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${Math.abs(x1 - x0).toFixed(1)}" height="${Math.abs(y1 - y0).toFixed(1)}" fill="rgb(111 211 255 / 0.14)" stroke="#6fd3ff" stroke-width="3" pointer-events="none"/>`;
            const naam = T(`ht.bron.blok.${b.soort}`);
            const Naam = esc(naam.charAt(0).toUpperCase() + naam.slice(1));
            const past = Math.abs(x1 - x0) > naam.length * 6.5;
            // Op het erf (20 november 2026): de naam met "bij Buiten", erboven als het gebouw te smal is.
            if (kern.opErfBlokken().some((q) => q.id === b.id)) {
              const ty = past ? (y0 + y1) / 2 - 2 : Math.min(y0, y1) - 22;
              s += `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="#a9e6ff" pointer-events="none">${Naam}</text>`;
              s += `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${(ty + 14).toFixed(1)}" text-anchor="middle" ${FONT} font-size="11" font-weight="600" fill="rgb(169 230 255 / 0.75)" pointer-events="none">${esc(T('ht.gebouw.bijBuiten'))}</text>`;
            } else if (past) s += `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${((y0 + y1) / 2 + 4).toFixed(1)}" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="rgb(255 255 255 / 0.7)" pointer-events="none">${Naam}</text>`;
          }
        }
        s += kern.kaartLaag(vorm);
        if (kern.st.stand === 'dak') s += kern.dakLaag();
        laag('namen').innerHTML = s;

        // De apparaten: een rond icoon; dichtbij ook de naam.
        s = '';
        if (app) {
          // Van ver klein genoeg om elkaar niet te dekken; dichtbij groot genoeg voor een vinger.
          const R = klem(kern.k * 3.4, 12, 25);
          const dichtbij = kern.st.zoom != null;
          for (const p of kern.apparaatPunten()) {
            const gekozen = kern.st.kies?.soort === 'apparaat' && kern.st.kies.id === p.a.id;
            const dim = kern.st.zoom != null && kern.st.zoom !== p.ruimte;
            const sleept = kern.actie?.type === 'apparaat' && kern.actie.a.id === p.a.id;
            const x = sleept ? kern.actie.px : kern.X(p.x);
            const y = sleept ? kern.actie.py : kern.Y(p.y);
            const kleur = APP_KLEUR[p.a.soort] ?? '#eef3f7';
            s += `<g class="ht-ap${gekozen ? ' gekozen' : ''}${sleept ? ' sleept' : ''}" data-ap="${esc(p.a.id)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" opacity="${dim ? 0.3 : 1}" style="color: ${kleur}"><circle r="${gekozen || sleept ? R + 3 : R}" fill="#0d1a30" stroke="${gekozen || sleept ? '#6fd3ff' : p.zelf ? 'rgb(255 255 255 / 0.55)' : 'rgb(255 255 255 / 0.28)'}" stroke-width="${gekozen || sleept ? 3 : 1.5}"${p.zelf ? '' : ' stroke-dasharray="3 3"'}/>${ik(APP_ICOON[p.a.soort] ?? p.a.soort).replace('<svg ', `<svg x="${-R * 0.56}" y="${-R * 0.56}" width="${R * 1.12}" height="${R * 1.12}" `)}${(dichtbij && !dim) || gekozen ? `<text y="${R + 15}" text-anchor="middle" ${FONT} font-size="12" font-weight="600" fill="#eef3f7" paint-order="stroke" stroke="#0d1a30" stroke-width="4">${esc(p.a.naam)}</text>` : ''}</g>`;
          }
        }
        laag('app').innerHTML = s;
        laag('over').innerHTML = kern.over;
        // Ingezoomd: een knop terug naar het hele huis.
        const hk = heelKnop();
        laag('knop').innerHTML = hk ? `<g transform="translate(${hk.x} ${hk.y})" pointer-events="none"><rect width="${hk.b}" height="${hk.h}" rx="10" fill="#0d1a30" stroke="#6fd3ff" stroke-opacity="0.7"/><text x="${hk.b / 2}" y="${hk.h / 2 + 4.5}" text-anchor="middle" ${FONT} font-size="13" font-weight="700" fill="#a9e6ff">${esc(T('ht.heleHuis'))}</text></g>` : '';
      }
      /** De deuren, ramen en de voordeur op de plattegrond (in ruitjes, binnen de transform). */
      function openingenPad(v) {
        let s2 = '';
        for (const o of v.openingen ?? []) {
          const mu = openingMuur(v, o);
          if (!mu) continue;
          const gekozen = (kern.st.kies?.soort === 'opening' && kern.st.kies.id === o.id) || kern.actie?.kandidaat?.o?.id === o.id;
          const lijn = (e, a = o.van, b = o.tot) => (o.as === 'x' ? `M${o.op + e} ${a}V${b}` : `M${a} ${o.op + e}H${b}`);
          // Het gat in de muur.
          s2 += `<path d="${lijn(0)}" stroke="#1a2740" stroke-width="${mu === 2 ? 7 : 5}" vector-effect="non-scaling-stroke" fill="none"/>`;
          const kleur = gekozen ? '#6fd3ff' : o.soort === 'raam' || o.soort === 'schuifpui' ? '#a9e6ff' : o.soort === 'voordeur' || o.soort === 'achterdeur' ? '#f7b548' : '#dfe6ec';
          if (o.soort === 'schuifpui') {
            // Twee glazen delen, een beetje verschoven, en binnen een pijl naar waar hij schuift.
            const mid = (o.van + o.tot) / 2;
            const binnenKant = openingBinnen(v, o);
            s2 += `<path d="${lijn(-0.6, o.van, mid + 1.5)}${lijn(0.6, mid - 1.5, o.tot)}" stroke="${kleur}" stroke-width="${gekozen ? 3.2 : 2.4}" vector-effect="non-scaling-stroke" fill="none"/>`;
            const r = o.schuift === 'tot' ? 1 : -1;
            const e = binnenKant * 4;
            const [a0, a1] = [mid - r * 4, mid + r * 4];
            const pt = (langs, uit) => (o.as === 'x' ? `${o.op + uit} ${langs}` : `${langs} ${o.op + uit}`);
            s2 += `<path d="M${pt(a0, e)}L${pt(a1, e)}M${pt(a1 - r * 1.6, e - 1.2)}L${pt(a1, e)}L${pt(a1 - r * 1.6, e + 1.2)}" stroke="${kleur}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill="none"/>`;
          } else if (o.soort === 'raam') {
            s2 += `<path d="${lijn(-0.45)}${lijn(0.45)}" stroke="${kleur}" stroke-width="${gekozen ? 2.6 : 1.8}" vector-effect="non-scaling-stroke" fill="none"/>`;
            // Een screen voor dit raam: een oranje streep aan de buitenkant.
            if (kern.st.apparaten.some((a) => a.raam === o.id && a.plek?.etage === kern.st.etage)) s2 += `<path d="${lijn(-openingBinnen(v, o) * 1.6, o.van + 0.5, o.tot - 0.5)}" stroke="#ff9a6b" stroke-width="2.4" stroke-dasharray="4 3" vector-effect="non-scaling-stroke" fill="none"/>`;
          } else {
            // Een deur: per blad het blad open en de boog waar hij draait; openslaande deuren aan elk eind een blad.
            for (const b of deurBladen(v, o)) {
              const veeg = (b.sx - b.hx) * (b.ly - b.hy) - (b.sy - b.hy) * (b.lx - b.hx) > 0 ? 1 : 0;
              s2 += `<path d="M${b.hx} ${b.hy}L${b.lx} ${b.ly}" stroke="${kleur}" stroke-width="${gekozen ? 3 : 2}" stroke-linecap="round" vector-effect="non-scaling-stroke" fill="none"/>`;
              s2 += `<path d="M${b.sx} ${b.sy}A${b.w} ${b.w} 0 0 ${veeg} ${b.lx} ${b.ly}" stroke="${kleur}" stroke-width="1.2" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" fill="none" opacity="0.8"/>`;
            }
          }
        }
        return s2;
      }
      /**
       * De bladen van een deur, in ruitjes: het scharnier (h), het open blad (l)
       * en waar het blad dicht tegen de muur ligt (s), met de breedte w.
       */
      function deurBladen(v, o) {
        const kant = o.kant ?? openingBinnen(v, o);
        const at = (langs, uit) => (o.as === 'x' ? [o.op + uit, langs] : [langs, o.op + uit]);
        const blad = (h, vrij) => {
          const w = Math.abs(vrij - h);
          const [hx, hy] = at(h, 0);
          const [lx, ly] = at(h, kant * w);
          const [sx, sy] = at(vrij, 0);
          return { hx, hy, lx, ly, sx, sy, w };
        };
        if (o.soort === 'dubbel') {
          const mid = (o.van + o.tot) / 2;
          return [blad(o.van, mid), blad(o.tot, mid)];
        }
        return o.scharnier === 'tot' ? [blad(o.tot, o.van)] : [blad(o.van, o.tot)];
      }
      /** De stip op het scharnier van de gekozen deur: een tik zet het naar het andere eind. */
      function scharnierStip(v) {
        if (kern.st.stand !== 'kamers' || kern.st.kies?.soort !== 'opening') return null;
        const o = (v.openingen ?? []).find((x) => x.id === kern.st.kies.id);
        if (!o || !MET_SCHARNIER.has(o.soort) || !openingMuur(v, o)) return null;
        const b = deurBladen(v, o)[0];
        return { x: b.hx, y: b.hy, o };
      }
      /** De trap: treden dwars op de richting, en een pijl naar boven. */
      function trapPad(v, mm) {
        let s2 = '';
        for (const [id, r] of Object.entries(v.ruimtes)) {
          if (kern.soortVan(r) !== 'trap' || !mm[id]?.r) continue;
          const b = mm[id].r;
          const [rx, ry] = TRAP_RICHTING[r.omhoog ?? 'n'];
          const langs = rx ? [b.x0, b.x1] : [b.y0, b.y1];
          let d = '';
          for (let t2 = langs[0] + 2.5; t2 < langs[1] - 0.5; t2 += 2.5) d += rx ? `M${t2} ${b.y0 + 1}V${b.y1 - 1}` : `M${b.x0 + 1} ${t2}H${b.x1 - 1}`;
          s2 += `<path d="${d}" stroke="rgb(255 255 255 / 0.4)" stroke-width="1.2" vector-effect="non-scaling-stroke" fill="none"/>`;
          // De pijl van onder naar boven.
          const [cx, cy] = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
          const half = ((rx ? b.x1 - b.x0 : b.y1 - b.y0) / 2) * 0.75;
          const [ax, ay, bx, by] = [cx - rx * half, cy - ry * half, cx + rx * half, cy + ry * half];
          const pk = 2.2;
          s2 += `<path d="M${ax} ${ay}L${bx} ${by}M${bx - rx * pk - ry * pk} ${by - ry * pk - rx * pk}L${bx} ${by}L${bx - rx * pk + ry * pk} ${by - ry * pk + rx * pk}" stroke="#a9e6ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill="none"/>`;
        }
        return s2;
      }
      /** Waar de knop Hele huis staat, als er ingezoomd is. */
      function heelKnop() {
        if (!kern.st.eigen) return null;
        const b = T('ht.heleHuis').length * 7.4 + 24;
        return { x: kern.B - b - 10, y: 10, b, h: 32 };
      }


    return { laag, pil, teken, scharnierStip, heelKnop };
  };
})(typeof window !== 'undefined' ? window : globalThis);
