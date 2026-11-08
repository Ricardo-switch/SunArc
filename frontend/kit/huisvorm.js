/*
 * SunArc: het huis op maat (besluit 288, schets Wand-Huis-Ontwerp).
 *
 * De doorsnede (stap 4, Je huis › Etages): het hoofdhuis opzij, van voor naar
 * achter doorgesneden, met de etages als lagen op hun hoogte, het schuine dak
 * met het lage deel onder 1,5 meter, een uitbouw achter en een kelder onder de
 * grond. Een laag tik je aan (`data-etage-kies`).
 *
 * Gebruik: huisvorm.doorsnede(model, { breedte, hoogte }) geeft een svg. Het
 * model zegt alles in meters:
 *   { diep, goot, nok, dakvorm,
 *     etages: [{ id, naam, van, tot, dak, gekozen, zin }],   van onder naar boven; een kelder onder 0
 *     uitbouw: { diep, hoogte, naam } | null,
 *     tekst: { goot, nok, voor, achter, laag } }
 */
(function (global) {
  'use strict';

  const FONT = 'font-family="Figtree, system-ui, sans-serif"';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /** Een maatlijn met streepjes aan de uiteinden en de maat in een pil. */
  function maat(x1, y1, x2, y2, tekst, kleur) {
    const staand = x1 === x2;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const bw = tekst.length * 6.6 + 14;
    let s = `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${kleur}" stroke-opacity="0.7" stroke-width="1.2"/>`;
    s += staand ? `<path d="M${x1 - 5} ${y1}h10M${x2 - 5} ${y2}h10" stroke="${kleur}" stroke-opacity="0.7" stroke-width="1.2"/>` : `<path d="M${x1} ${y1 - 5}v10M${x2} ${y2 - 5}v10" stroke="${kleur}" stroke-opacity="0.7" stroke-width="1.2"/>`;
    const pil = `<rect x="${-bw / 2}" y="-11" width="${bw}" height="22" rx="7" fill="#13213a" stroke="${kleur}" stroke-opacity="0.4"/><text y="4.5" text-anchor="middle" ${FONT} font-size="12" font-weight="700" fill="${kleur}">${esc(tekst)}</text>`;
    return s + (staand ? `<g transform="translate(${mx} ${my}) rotate(-90)">${pil}</g>` : `<g transform="translate(${mx} ${my})">${pil}</g>`);
  }

  function doorsnede(m, opts = {}) {
    const W = opts.breedte ?? 560;
    const H = opts.hoogte ?? 460;
    const diep = Math.max(3, m.diep ?? 9);
    const goot = Math.max(1, m.goot ?? 6);
    const plat = m.dakvorm === 'plat';
    const nok = plat ? goot : Math.max(goot, m.nok ?? goot + 3);
    const ub = m.uitbouw && m.uitbouw.diep > 0 ? m.uitbouw : null;
    const onder = Math.min(0, ...m.etages.map((e) => e.van));
    // Meters in beeld: links ruimte voor de maat van de goot, onder voor de grond en de woorden.
    const breedM = diep + (ub ? ub.diep : 0) + 3.4;
    // Boven ruimte voor de nok, onder voor de grond en de woorden, in pixels.
    const boven = 52;
    const onderPx = 44;
    const s = Math.min(W / breedM, (H - boven - onderPx) / (nok - onder + 0.4));
    const ox = (W - (diep + (ub ? ub.diep : 0)) * s) / 2 + 0.9 * s;
    const oy = (H - (boven + onderPx + (nok - onder + 0.4) * s)) / 2 + boven + nok * s;
    const X = (v) => ox + v * s;
    const Z = (z) => oy - z * s;
    const kleur = { muur: '#c9d3dc', mint: '#6ee7b7', ijs: '#6fd3ff', laag: 'rgb(255 160 110 / 0.35)' };
    let out = `<svg class="sc-doorsnede" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(m.beschrijving ?? '')}">`;
    out += '<defs><pattern id="hv-laag" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V8" stroke="rgb(255 160 110 / 0.35)" stroke-width="2"/></pattern><pattern id="hv-grond" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r="1" fill="rgb(160 120 80 / 0.4)"/><circle cx="9" cy="10" r="1" fill="rgb(160 120 80 / 0.3)"/></pattern></defs>';
    // De grond, met gras erop.
    out += `<rect x="0" y="${Z(0)}" width="${W}" height="${H - Z(0)}" fill="#3a2c22"/><rect x="0" y="${Z(0)}" width="${W}" height="${H - Z(0)}" fill="url(#hv-grond)"/><rect x="0" y="${Z(0) - 4}" width="${W}" height="6" fill="#3f7d55"/>`;
    // Het profiel van het dak: zadel en schild met de nok in het midden, een lessenaar oplopend naar achter.
    const dakPunten = plat ? [[0, goot], [diep, goot]] : m.dakvorm === 'lessenaar' ? [[0, goot], [diep, nok]] : [[0, goot], [diep / 2, nok], [diep, goot]];
    const dakHoogte = (v) => {
      if (plat) return goot;
      if (m.dakvorm === 'lessenaar') return goot + ((nok - goot) * v) / diep;
      return goot + (nok - goot) * (1 - Math.abs(v - diep / 2) / (diep / 2));
    };
    // De lagen: elk een band die je aantikt.
    for (const e of m.etages) {
      const kies = e.gekozen;
      const vul = kies ? 'rgb(111 211 255 / 0.22)' : e.van < 0 ? 'rgb(255 255 255 / 0.05)' : 'rgb(255 255 255 / 0.07)';
      let vorm;
      if (e.dak && !plat) {
        // Onder het schuine dak: tot het dak, met het lage deel onder 1,5 meter gearceerd.
        const lijn = m.dakvorm === 'lessenaar' ? [[0, e.van], [0, goot], [diep, nok], [diep, e.van]] : [[0, e.van], [0, goot], [diep / 2, nok], [diep, goot], [diep, e.van]];
        vorm = lijn.map(([v, z], i) => `${i ? 'L' : 'M'}${X(v).toFixed(1)} ${Z(z).toFixed(1)}`).join('') + 'Z';
        out += `<path d="${vorm}" fill="${vul}" data-etage-kies="${esc(e.id)}" role="button" tabindex="0" aria-label="${esc(e.naam)}" style="cursor: pointer"/>`;
        // Waar het lager is dan 1,5 meter: niet om in te staan.
        const laag = e.van + 1.5;
        if (laag < nok) {
          const stappen = 40;
          for (const kant of m.dakvorm === 'lessenaar' ? [0] : [0, 1]) {
            const pad = [];
            for (let i = 0; i <= stappen; i++) {
              const v = kant === 0 ? (i / stappen) * (diep / (m.dakvorm === 'lessenaar' ? 1 : 2)) : diep - (i / stappen) * (diep / 2);
              const z = dakHoogte(v);
              if (z >= laag) break;
              pad.push([v, z]);
            }
            if (pad.length > 1) {
              const eind = pad[pad.length - 1][0];
              const d = `M${X(pad[0][0])} ${Z(e.van)}` + pad.map(([v, z]) => `L${X(v).toFixed(1)} ${Z(z).toFixed(1)}`).join('') + `L${X(eind).toFixed(1)} ${Z(e.van)}Z`;
              out += `<path d="${d}" fill="url(#hv-laag)" pointer-events="none"/>`;
            }
          }
          // De lijn op 1,5 meter alleen binnen het dak.
          const f = laag <= goot ? 0 : (laag - goot) / (nok - goot);
          const v1 = m.dakvorm === 'lessenaar' ? f * diep : (f * diep) / 2;
          const v2 = m.dakvorm === 'lessenaar' ? diep : diep - v1;
          out += `<path d="M${X(v1)} ${Z(laag)}H${X(v2)}" stroke="${kleur.laag}" stroke-dasharray="3 4" pointer-events="none" opacity="0.8"/>`;
        }
      } else {
        const tot = e.dak ? goot : e.tot;
        out += `<rect x="${X(0)}" y="${Z(tot)}" width="${diep * s}" height="${(tot - e.van) * s}" fill="${vul}" data-etage-kies="${esc(e.id)}" role="button" tabindex="0" aria-label="${esc(e.naam)}" style="cursor: pointer"/>`;
        if (e.van < 0) out += `<rect x="${X(0)}" y="${Z(tot)}" width="${diep * s}" height="${(tot - e.van) * s}" fill="none" stroke="${kleur.muur}" stroke-width="2.5" pointer-events="none"/>`;
      }
      if (kies) out += `<path d="M${X(0)} ${Z(e.van)}H${X(diep)}" stroke="${kleur.ijs}" stroke-width="3.5" pointer-events="none"/>`;
    }
    // De uitbouw achter.
    if (ub) out += `<rect x="${X(diep)}" y="${Z(ub.hoogte)}" width="${ub.diep * s}" height="${ub.hoogte * s}" fill="rgb(255 255 255 / 0.06)" stroke="${kleur.muur}" stroke-width="2.5" pointer-events="none"/>`;
    // Muren en vloeren van het hoofdhuis.
    out += `<path d="M${X(0)} ${Z(0)}V${Z(goot)}M${X(diep)} ${Z(0)}V${Z(dakHoogte(diep))}" stroke="${kleur.muur}" stroke-width="3" pointer-events="none"/>`;
    const dakLijn = dakPunten.map(([v, z], i) => `${i ? 'L' : 'M'}${X(v).toFixed(1)} ${Z(z).toFixed(1)}`).join('');
    out += `<path d="${dakLijn}" fill="none" stroke="${kleur.muur}" stroke-width="3" stroke-linejoin="round" pointer-events="none"/>`;
    if (!plat) {
      const over = [[-0.5, goot - 0.45], ...dakPunten.slice(1, -1).map(([v, z]) => [v, z + 0.06]), [diep + 0.5, dakHoogte(diep) - 0.45]];
      out += `<path d="${over.map(([v, z], i) => `${i ? 'L' : 'M'}${X(v).toFixed(1)} ${Z(z).toFixed(1)}`).join('')}" fill="none" stroke="#7b879a" stroke-width="5" stroke-linejoin="round" pointer-events="none"/>`;
    }
    for (const e of m.etages) if (e.van > 0.01 && e.van < goot - 0.01) out += `<path d="M${X(0)} ${Z(e.van)}H${X(diep)}" stroke="${kleur.muur}" stroke-width="2.5" pointer-events="none"/>`;
    // De namen in de lagen.
    for (const e of m.etages) {
      const top = e.dak && !plat ? Math.min(nok, e.van + Math.max(1.6, (nok - e.van) * 0.45)) : e.dak ? goot : e.tot;
      const mid = e.dak && !plat ? e.van + Math.min(1.25, (top - e.van) / 2 + 0.3) : (e.van + top) / 2;
      out += `<text x="${X(diep / 2)}" y="${Z(mid) - 1}" text-anchor="middle" ${FONT} font-size="15" font-weight="700" fill="${e.gekozen ? '#a9e6ff' : '#eef3f7'}" pointer-events="none">${esc(e.naam)}</text>`;
      if (e.zin) out += `<text x="${X(diep / 2)}" y="${Z(mid) + 16}" text-anchor="middle" ${FONT} font-size="12" fill="rgb(255 255 255 / 0.6)" pointer-events="none">${esc(e.zin)}</text>`;
    }
    if (ub && ub.naam) out += `<text x="${X(diep + ub.diep / 2)}" y="${Z(ub.hoogte / 2) + 4}" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="#eef3f7" pointer-events="none">${esc(ub.naam)}</text>`;
    // De hoogtes: de goot links, de nok erboven.
    const t = m.tekst ?? {};
    if (t.goot) out += maat(X(-0.9), Z(0), X(-0.9), Z(goot), t.goot, kleur.mint);
    if (t.nok && !plat) {
      const nx = m.dakvorm === 'lessenaar' ? X(diep) : X(diep / 2);
      out += `<path d="M${nx} ${Z(nok) - 8}V${Z(nok) - 22}" stroke="${kleur.mint}" stroke-opacity="0.6"/>` + `<g transform="translate(${nx} ${Z(nok) - 34})"><rect x="${-(t.nok.length * 3.4 + 8)}" y="-11" width="${t.nok.length * 6.8 + 16}" height="22" rx="7" fill="#13213a" stroke="${kleur.mint}" stroke-opacity="0.4"/><text y="4.5" text-anchor="middle" ${FONT} font-size="12" font-weight="700" fill="${kleur.mint}">${esc(t.nok)}</text></g>`;
    }
    // Smal: alleen voor en achter.
    const smal = (diep + (ub ? ub.diep : 0)) * s < 270;
    const voor = t.voor && smal ? `‹ ${t.voor.split('·').pop().trim()}` : t.voor;
    const achter = t.achter && smal ? `${t.achter.split('·')[0].trim()} ›` : t.achter;
    if (voor) out += `<text x="${X(0)}" y="${Math.min(H - 8, Z(onder) + 26)}" ${FONT} font-size="11" font-weight="700" letter-spacing="1.5" fill="rgb(255 255 255 / 0.4)">${esc(voor)}</text>`;
    if (achter) out += `<text x="${X(diep + (ub ? ub.diep : 0))}" y="${Math.min(H - 8, Z(onder) + 26)}" text-anchor="end" ${FONT} font-size="11" font-weight="700" letter-spacing="1.5" fill="rgb(255 255 255 / 0.4)">${esc(achter)}</text>`;
    return out + '</svg>';
  }

  global.huisvorm = { doorsnede };
})(typeof window !== 'undefined' ? window : globalThis);
