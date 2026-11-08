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

  /* ================================================================ de plattegrond (stap 5) */

  /*
   * De kamers op een etage als vakken (besluit 288, huisvorm.ts in de dienst):
   * elk gebouw heeft zijn eigen assen, u langs de voorgevel en v naar achter,
   * in meters vanaf de linker voorhoek. Een vak deel je met één lijn in
   * tweeën; vakken met dezelfde kamer zijn samen één ruimte.
   */
  const MIN_VAK = 0.3;
  const isSnede = (v) => !!v && (v.as === 'u' || v.as === 'v');
  const lijnOp = (op, lengte) => (lengte < 2 * MIN_VAK ? lengte / 2 : Math.min(Math.max(op, MIN_VAK), lengte - MIN_VAK));

  /** Alle vakken zonder lijn met hun rechthoek, en de lijnen met hun plek. */
  function vakkenIn(vak, r, pad = '', uit = { vakken: [], lijnen: [] }) {
    if (!isSnede(vak)) {
      uit.vakken.push({ r, blad: vak ?? {}, pad });
      return uit;
    }
    if (vak.as === 'u') {
      const op = lijnOp(vak.op, r.breed);
      uit.lijnen.push({ pad, as: 'u', r, op, u1: r.u + op, v1: r.v, u2: r.u + op, v2: r.v + r.diep });
      vakkenIn(vak.a, { ...r, breed: op }, `${pad}a`, uit);
      vakkenIn(vak.b, { ...r, u: r.u + op, breed: r.breed - op }, `${pad}b`, uit);
    } else {
      const op = lijnOp(vak.op, r.diep);
      uit.lijnen.push({ pad, as: 'v', r, op, u1: r.u, v1: r.v + op, u2: r.u + r.breed, v2: r.v + op });
      vakkenIn(vak.a, { ...r, diep: op }, `${pad}a`, uit);
      vakkenIn(vak.b, { ...r, v: r.v + op, diep: r.diep - op }, `${pad}b`, uit);
    }
    return uit;
  }
  const sleutel = (v) => (v.blad.kamer != null ? `k:${v.blad.kamer}` : `p:${v.pad}`);

  /** Een knoop in de boom op zijn pad ('' is de top). */
  function knoop(boom, pad) {
    let n = boom;
    for (const c of pad) n = isSnede(n) ? n[c] : null;
    return n ?? null;
  }
  /** De boom met de knoop op `pad` vervangen. */
  function vervang(boom, pad, nieuw) {
    if (!pad) return nieuw;
    const [c, ...rest] = pad;
    return { ...boom, [c]: vervang(boom[c], rest.join(''), nieuw) };
  }
  /** De rechthoek van een knoop, en die van zijn ouder. */
  function rectVan(boom, pad, r) {
    let n = boom;
    let rect = r;
    for (const c of pad) {
      if (!isSnede(n)) return null;
      const op = lijnOp(n.op, n.as === 'u' ? rect.breed : rect.diep);
      if (n.as === 'u') rect = c === 'a' ? { ...rect, breed: op } : { ...rect, u: rect.u + op, breed: rect.breed - op };
      else rect = c === 'a' ? { ...rect, diep: op } : { ...rect, v: rect.v + op, diep: rect.diep - op };
      n = n[c];
    }
    return rect;
  }

  /**
   * Een ruimte erin, tegen een muur van een vak (de schets #hal): het nieuwe vak
   * krijgt `nieuw`, de rest blijft wat het vak was. `wand`: voor, achter,
   * links of rechts; `b` langs de muur, `d` de muur in.
   */
  function ruimteErin(vak, r, wand, b, d, nieuw = {}) {
    const blad = isSnede(vak) ? {} : vak;
    b = Math.min(b, (wand === 'voor' || wand === 'achter' ? r.breed : r.diep) - 2 * MIN_VAK);
    d = Math.min(d, (wand === 'voor' || wand === 'achter' ? r.diep : r.breed) - MIN_VAK);
    if (wand === 'links' || wand === 'rechts') {
      const v0 = (r.diep - b) / 2;
      const midden = wand === 'rechts' ? { as: 'u', op: r.breed - d, a: { ...blad }, b: nieuw } : { as: 'u', op: d, a: nieuw, b: { ...blad } };
      return { as: 'v', op: v0, a: { ...blad }, b: { as: 'v', op: b, a: midden, b: { ...blad } } };
    }
    const u0 = (r.breed - b) / 2;
    const midden = wand === 'achter' ? { as: 'v', op: r.diep - d, a: { ...blad }, b: nieuw } : { as: 'v', op: d, a: nieuw, b: { ...blad } };
    return { as: 'u', op: u0, a: { ...blad }, b: { as: 'u', op: b, a: midden, b: { ...blad } } };
  }

  /** Het pad van het nieuwe vak dat `ruimteErin` maakte. */
  const ruimtePad = (wand) => (wand === 'rechts' ? 'bab' : wand === 'links' ? 'baa' : wand === 'achter' ? 'bab' : 'baa');

  /** Hoe groot een kamer gewoonlijk is, ten opzichte van andere: voor de indelingen. */
  const GEWICHT = { woonkamer: 2.2, woonkeuken: 2.2, eetkamer: 1.3, keuken: 1.2, slaapkamer: 1.3, kinderkamer: 1, logeerkamer: 1, werkkamer: 0.9, badkamer: 0.8, toilet: 0.35, hal: 0.7, wasruimte: 0.6, bijkeuken: 0.6, berging: 0.5, garage: 1.5, kelder: 1.5 };
  const VOOR = new Set(['woonkamer', 'woonkeuken', 'slaapkamer', 'kinderkamer', 'werkkamer', 'logeerkamer']);

  /** Kamers naast elkaar langs een as, naar hun gewicht. */
  function verdeel(kamers, as, lengte) {
    if (!kamers.length) return {};
    if (kamers.length === 1) return { kamer: kamers[0].id };
    const totaal = kamers.reduce((s, k) => s + (GEWICHT[k.soort] ?? 1), 0);
    const op = Math.round(((lengte * (GEWICHT[kamers[0].soort] ?? 1)) / totaal) * 10) / 10;
    return { as, op, a: { kamer: kamers[0].id }, b: verdeel(kamers.slice(1), as, lengte - op) };
  }
  /** Voor en achter: twee rijen, elk langs de voorgevel. */
  function rijen(voor, achter, b, d) {
    if (!voor.length) return verdeel(achter, 'u', b);
    if (!achter.length) return verdeel(voor, 'u', b);
    const op = Math.round(d * 0.55 * 10) / 10;
    return { as: 'v', op, a: verdeel(voor, 'u', b), b: verdeel(achter, 'u', b) };
  }

  /**
   * Een paar indelingen voor de kamers van een etage, op de gebouwen van die
   * etage. `kamers`: [{ id, soort }]; `gebouwen`: [{ id, soort, breed, diep }].
   * De keuken gaat naar een uitbouw als die er is, een garage naar de garage.
   */
  function indelingen(kamers, gebouwen) {
    const hoofd = gebouwen.find((g) => g.soort === 'hoofdhuis') ?? gebouwen[0];
    if (!hoofd || !kamers.length) return [];
    const uitbouw = gebouwen.find((g) => g.soort === 'uitbouw');
    const garage = gebouwen.find((g) => g.soort === 'garage');
    const vast = {};
    let rest = [...kamers];
    const pak = (gebouw, soorten) => {
      const k = gebouw && rest.find((x) => soorten.includes(x.soort));
      if (!k) return;
      vast[gebouw.id] = { kamer: k.id };
      rest = rest.filter((x) => x !== k);
    };
    pak(garage, ['garage']);
    pak(uitbouw, ['keuken', 'woonkeuken', 'eetkamer']);
    const B = hoofd.breed;
    const D = hoofd.diep;
    const hal = rest.find((k) => k.soort === 'hal');
    const zonderHal = rest.filter((k) => k !== hal);
    const toilet = zonderHal.find((k) => k.soort === 'toilet');
    const voor = rest.filter((k) => VOOR.has(k.soort));
    const achter = rest.filter((k) => !VOOR.has(k.soort));
    const uit = [];
    const met = (naam, boom) => uit.push({ naam, bomen: { ...vast, [hoofd.id]: boom } });
    met('naast', verdeel(rest, 'u', B));
    if (voor.length && achter.length) met('rijen', rijen(voor, achter, B, D));
    if (hal && zonderHal.length) {
      const strook = Math.min(2.6, B * 0.3);
      const andere = zonderHal.filter((k) => k !== toilet);
      const halVak = toilet ? { as: 'v', op: Math.round(D * 0.65 * 10) / 10, a: { kamer: hal.id }, b: { kamer: toilet.id } } : { kamer: hal.id };
      met('halOpzij', { as: 'u', op: strook, a: halVak, b: andere.length > 2 ? rijen(andere.filter((k) => VOOR.has(k.soort)), andere.filter((k) => !VOOR.has(k.soort)), B - strook, D) : verdeel(andere, 'v', D) });
      if (zonderHal.length >= 2) {
        const links = zonderHal.filter((_, i) => i % 2 === 0);
        const rechts = zonderHal.filter((_, i) => i % 2 === 1);
        const gang = 1.6;
        const l = Math.round(((B - gang) / 2) * 10) / 10;
        met('gang', { as: 'u', op: l, a: verdeel(links, 'v', D), b: { as: 'u', op: gang, a: { kamer: hal.id }, b: verdeel(rechts, 'v', D) } });
      }
    }
    return uit;
  }

  /* ---------------------------------------------- tekenen */

  const TINT = { woon: '110 231 183', keuken: '247 181 72', slaap: '143 134 255', nat: '111 211 255', hal: '184 196 207', garage: '154 170 187', zolder: '255 160 110', leeg: '255 255 255' };
  const SOORT_TINT = { woonkamer: 'woon', woonkeuken: 'keuken', keuken: 'keuken', eetkamer: 'keuken', slaapkamer: 'slaap', kinderkamer: 'slaap', logeerkamer: 'slaap', werkkamer: 'slaap', badkamer: 'nat', toilet: 'nat', wasruimte: 'nat', hal: 'hal', bijkeuken: 'hal', berging: 'hal', garage: 'garage', kelder: 'garage' };

  /** De assen van een gebouw op de kaart, uit zijn rechthoek (`maat` uit de tekening van boven). */
  function kaderUitMaat(maat, voorgevelDeg) {
    const RAD = Math.PI / 180;
    const kijk = ((voorgevelDeg ?? 180) + 180) % 360;
    const rechts = (kijk + 90) % 360;
    const vers = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
    const uDeg = [maat.asDeg, maat.asDeg + 90, maat.asDeg + 180, maat.asDeg + 270].reduce((b, a) => (vers(a, rechts) < vers(b, rechts) ? a : b));
    const langs = ((((uDeg - maat.asDeg) % 180) + 180) % 180) < 1;
    const breed = langs ? maat.lengte : maat.breedte;
    const diep = langs ? maat.breedte : maat.lengte;
    const U = [Math.sin(uDeg * RAD), Math.cos(uDeg * RAD)];
    const V = [Math.sin((uDeg - 90) * RAD), Math.cos((uDeg - 90) * RAD)];
    const O = [maat.midden[0] - (U[0] * breed) / 2 - (V[0] * diep) / 2, maat.midden[1] - (U[1] * breed) / 2 - (V[1] * diep) / 2];
    return { O, U, V, breed, diep };
  }
  /** Van de assen van een gebouw naar die van het hoofdhuis: zo staan alle gebouwen in één plattegrond. */
  function naarHoofd(k, h) {
    const dot = (p, q) => p[0] * q[0] + p[1] * q[1];
    const d = [k.O[0] - h.O[0], k.O[1] - h.O[1]];
    return { a: dot(k.U, h.U), b: dot(k.U, h.V), c: dot(k.V, h.U), d: dot(k.V, h.V), e: dot(d, h.U), f: dot(d, h.V) };
  }

  /**
   * De plattegrond van één etage. model:
   *   { gebouwen: [{ id, naam, breed, diep, m: {a,b,c,d,e,f}, boom, actief }],
   *     kamers: { id: { naam, soort } }, kies: 'gebouw:pad', zones: [{ gebouw, kamer, as, grenzen, namen }],
   *     tekst: { leeg, nietInHa, deur } , klein: true voor een voorbeeldje }
   */
  function plattegrond(model, opts = {}) {
    const W = opts.breedte ?? 520;
    const H = opts.hoogte ?? 440;
    const klein = !!model.klein;
    const fmt = (n, d = 0) => n.toLocaleString(global.taal?.locale ?? 'nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d });
    // Alle hoeken in de assen van het hoofdhuis, om de maat te kiezen.
    const naar = (m, u, v) => [m.a * u + m.c * v + m.e, m.b * u + m.d * v + m.f];
    const hoeken = model.gebouwen.flatMap((g) => [naar(g.m, 0, 0), naar(g.m, g.breed, 0), naar(g.m, 0, g.diep), naar(g.m, g.breed, g.diep)]);
    const minU = Math.min(...hoeken.map((p) => p[0]));
    const maxU = Math.max(...hoeken.map((p) => p[0]));
    const minV = Math.min(...hoeken.map((p) => p[1]));
    const maxV = Math.max(...hoeken.map((p) => p[1]));
    const marge = klein ? 6 : 34;
    const s = Math.min((W - 2 * marge) / Math.max(1, maxU - minU), (H - 2 * marge) / Math.max(1, maxV - minV));
    const ox = (W - (maxU - minU) * s) / 2 - minU * s;
    const oy = H - (H - (maxV - minV) * s) / 2 + minV * s;
    const P = (g, u, v) => {
      const [x, y] = naar(g.m, u, v);
      return [ox + x * s, oy - y * s];
    };
    const poly = (g, r, inset = 0) => {
      const pts = [P(g, r.u + inset, r.v + inset), P(g, r.u + r.breed - inset, r.v + inset), P(g, r.u + r.breed - inset, r.v + r.diep - inset), P(g, r.u + inset, r.v + r.diep - inset)];
      return pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    };
    // Groot is hij aan te tikken (een groep knoppen); klein is hij alleen een plaatje bij een knop.
    const rol = klein ? 'aria-hidden="true"' : `role="group" aria-label="${esc(model.beschrijving ?? '')}"`;
    let out = `<svg class="sc-plattegrond" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" ${rol} data-s="${s}" data-ox="${ox}" data-oy="${oy}">`;
    const t = model.tekst ?? {};
    const muren = [];
    const namen = [];
    for (const g of model.gebouwen) {
      const R = { u: 0, v: 0, breed: g.breed, diep: g.diep };
      if (!g.actief) {
        out += `<polygon points="${poly(g, R)}" fill="rgb(255 255 255 / 0.025)" stroke="rgb(255 255 255 / 0.22)" stroke-dasharray="5 5"/>`;
        if (!klein && g.naam) {
          const c = P(g, g.breed / 2, g.diep / 2);
          namen.push(`<text x="${c[0]}" y="${c[1] + 4}" text-anchor="middle" ${FONT} font-size="11.5" font-weight="600" fill="rgb(255 255 255 / 0.35)" pointer-events="none">${esc(g.naam)}</text>`);
        }
        continue;
      }
      const { vakken, lijnen } = vakkenIn(g.boom ?? {}, R);
      for (const v of vakken) {
        const km = v.blad.kamer != null ? model.kamers[v.blad.kamer] : null;
        const tint = TINT[SOORT_TINT[km?.soort] ?? (km ? 'woon' : 'leeg')];
        const kies = model.kies === `${g.id}:${v.pad}`;
        const doel = model.doel != null && v.blad.kamer === model.doel;
        const leeg = !km && !v.blad.naam;
        out += `<polygon points="${poly(g, v.r)}" fill="rgb(${tint} / ${kies || doel ? 0.32 : km ? 0.17 : 0.06})" ${klein ? '' : `data-vak="${esc(`${g.id}:${v.pad}`)}"${km ? ` data-vak-kamer-id="${esc(v.blad.kamer)}"` : ''} data-m="${[g.m.a, g.m.b, g.m.c, g.m.d, g.m.e, g.m.f].join(',')}" role="button" tabindex="0" style="cursor: pointer"`}${klein ? '' : ` aria-label="${esc(km?.naam ?? v.blad.naam ?? t.leeg ?? '')}"`}/>`;
        if (leeg && !klein) out += `<polygon points="${poly(g, v.r, Math.min(0.25, v.r.breed / 6, v.r.diep / 6))}" fill="none" stroke="rgb(247 181 72 / 0.7)" stroke-width="1.6" stroke-dasharray="6 5" pointer-events="none"/>`;
        if (kies || doel) out += `<polygon points="${poly(g, v.r, 0.06)}" fill="none" stroke="${doel ? '#6ee7b7' : '#6fd3ff'}" stroke-width="3" pointer-events="none"/>`;
      }
      // Muren tussen verschillende ruimtes; tussen delen van dezelfde kamer niet.
      for (const A of vakken) {
        for (const B of vakken) {
          if (A === B || sleutel(A) === sleutel(B)) continue;
          const bij = (x, y) => Math.abs(x - y) < 1e-6;
          const over = (a1, a2, b1, b2) => (Math.max(a1, b1) < Math.min(a2, b2) - 1e-6 ? [Math.max(a1, b1), Math.min(a2, b2)] : null);
          if (bij(A.r.u + A.r.breed, B.r.u)) {
            const o = over(A.r.v, A.r.v + A.r.diep, B.r.v, B.r.v + B.r.diep);
            if (o) muren.push([P(g, B.r.u, o[0]), P(g, B.r.u, o[1])]);
          }
          if (bij(A.r.v + A.r.diep, B.r.v)) {
            const o = over(A.r.u, A.r.u + A.r.breed, B.r.u, B.r.u + B.r.breed);
            if (o) muren.push([P(g, o[0], B.r.v), P(g, o[1], B.r.v)]);
          }
        }
      }
      // Een lijn is te slepen: een brede onzichtbare streep erover.
      if (!klein) for (const l of lijnen) {
        const a = P(g, l.u1, l.v1);
        const b = P(g, l.u2, l.v2);
        out += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="transparent" stroke-width="16" data-lijn="${esc(`${g.id}:${l.pad}`)}" data-m="${[g.m.a, g.m.b, g.m.c, g.m.d, g.m.e, g.m.f].join(',')}" style="cursor: ${l.as === 'u' ? 'ew-resize' : 'ns-resize'}"/>`;
      }
      // De naam één keer per ruimte, in zijn grootste vak, met de oppervlakte van alles samen.
      const per = new Map();
      for (const v of vakken) per.set(sleutel(v), [...(per.get(sleutel(v)) ?? []), v]);
      for (const delen of per.values()) {
        const v = delen.reduce((a, b) => (b.r.breed * b.r.diep > a.r.breed * a.r.diep ? b : a));
        const km = v.blad.kamer != null ? model.kamers[v.blad.kamer] : null;
        const naam = km?.naam ?? v.blad.naam ?? (klein ? '' : t.leeg ?? '');
        if (!naam) continue;
        const c = P(g, v.r.u + v.r.breed / 2, v.r.v + v.r.diep / 2);
        const pxB = v.r.breed * s;
        const pxD = v.r.diep * s;
        const m2 = delen.reduce((x, d) => x + d.r.breed * d.r.diep, 0);
        if (klein) {
          if (pxB > 26 && pxD > 12) namen.push(`<text x="${c[0]}" y="${c[1] + 3.5}" text-anchor="middle" ${FONT} font-size="9.5" font-weight="700" fill="rgb(255 255 255 / 0.85)" pointer-events="none">${esc(naam.length > 7 ? `${naam.slice(0, 6)}.` : naam)}</text>`);
          continue;
        }
        const fs = pxB < 80 || pxD < 50 ? 11.5 : 14.5;
        const kleur = km ? '#eef3f7' : v.blad.naam ? 'rgb(255 255 255 / 0.7)' : '#ffd38a';
        namen.push(`<text x="${c[0]}" y="${c[1] - (pxD > 40 ? 3 : -4)}" text-anchor="middle" ${FONT} font-size="${fs}" font-weight="700" fill="${kleur}" pointer-events="none">${esc(naam)}</text>`);
        if (pxD > 40 && pxB > 54) namen.push(`<text x="${c[0]}" y="${c[1] + 14}" text-anchor="middle" ${FONT} font-size="11" fill="rgb(255 255 255 / 0.5)" pointer-events="none">${fmt(m2)} m²${!km && v.blad.naam && t.nietInHa && pxB > 110 ? ` · ${esc(t.nietInHa)}` : ''}</text>`);
      }
      out += `<polygon points="${poly(g, R)}" fill="none" stroke="#dfe6ec" stroke-width="${klein ? 1.6 : 4}" pointer-events="none"/>`;
    }
    for (const [a, b] of muren) out += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="#c9d3dc" stroke-width="${klein ? 1.1 : 2.4}" pointer-events="none"/>`;
    // Zones: een groene stippellijn in de kamer, met de namen aan weerszijden.
    for (const z of model.zones ?? []) {
      const g = model.gebouwen.find((x) => x.id === z.gebouw);
      if (!g || klein) continue;
      const { vakken } = vakkenIn(g.boom ?? {}, { u: 0, v: 0, breed: g.breed, diep: g.diep });
      const eigen = vakken.filter((v) => v.blad.kamer === z.kamer);
      z.grenzen.forEach((op, i) => {
        for (const v of eigen) {
          const binnen = z.as === 'v' ? v.r.v < op && v.r.v + v.r.diep > op : v.r.u < op && v.r.u + v.r.breed > op;
          if (!binnen) continue;
          const a = z.as === 'v' ? P(g, v.r.u + 0.1, op) : P(g, op, v.r.v + 0.1);
          const b = z.as === 'v' ? P(g, v.r.u + v.r.breed - 0.1, op) : P(g, op, v.r.v + v.r.diep - 0.1);
          out += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#6ee7b7" stroke-width="2.4" stroke-dasharray="7 6" pointer-events="none"/>`;
          const mx = (a[0] + b[0]) / 2;
          const my = (a[1] + b[1]) / 2;
          const chip = (tekst, dx, dy) => `<g transform="translate(${mx + dx} ${my + dy})" pointer-events="none"><rect x="${-(tekst.length * 3.5 + 9)}" y="-10" width="${tekst.length * 7 + 18}" height="20" rx="10" fill="#173a35" stroke="rgb(110 231 183 / 0.5)"/><text y="4" text-anchor="middle" ${FONT} font-size="11.5" font-weight="700" fill="#6ee7b7">${esc(tekst)}</text></g>`;
          if (z.as === 'v') out += chip(`${z.namen[i] ?? ''} ↓`, 0, 17) + chip(`${z.namen[i + 1] ?? ''} ↑`, 0, -17);
          else out += chip(`← ${z.namen[i] ?? ''}`, -46, 0) + chip(`${z.namen[i + 1] ?? ''} →`, 46, 0);
        }
      });
    }
    out += namen.join('');
    // Apparaten (stap 6): een rondje met hun icoon op hun plek; aan te tikken en te slepen.
    for (const a of model.apparaten ?? []) {
      const g = model.gebouwen.find((x) => x.id === a.gebouw);
      if (!g) continue;
      const [x, y] = P(g, a.u, a.v);
      const r = a.gekozen ? 15 : 13;
      out += `<g class="pl-app${a.gekozen ? ' gekozen' : ''}" data-app="${esc(a.id)}" data-naam="${esc(a.naam)}" role="button" tabindex="0" aria-label="${esc(a.naam)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" style="cursor: grab; color: ${a.kleur ?? '#eef3f7'}"><circle r="${r}" fill="#13213a" stroke="${a.gekozen ? '#6fd3ff' : 'rgb(255 255 255 / 0.35)'}" stroke-width="${a.gekozen ? 2.5 : 1.2}"/>${(a.ik ?? '').replace('<svg ', `<svg x="-9" y="-9" width="18" height="18" `)}</g>`;
    }
    // De voordeur en de straat.
    if (!klein && t.straat) out += `<text x="${W / 2}" y="${H - 8}" text-anchor="middle" ${FONT} font-size="11" font-weight="700" letter-spacing="2" fill="rgb(255 255 255 / 0.35)">${esc(t.straat)}</text>`;
    return out + '</svg>';
  }

  global.huisvorm = { doorsnede, plattegrond, vakkenIn, knoop, vervang, rectVan, ruimteErin, ruimtePad, indelingen, kaderUitMaat, naarHoofd, isSnede, lijnOp };
})(typeof window !== 'undefined' ? window : globalThis);
