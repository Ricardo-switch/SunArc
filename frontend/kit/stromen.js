/*
 * Het stroombeeld van Opbrengst (schets Wand-Opbrengst-Stromen, 5 november
 * 2026): bronnen links, waar het heen ging rechts, de dikte is de hoeveelheid.
 * Elke band loopt van de kleur van zijn bron naar die van zijn bestemming;
 * een klein blok is minstens 4 px, en de namen schuiven uit elkaar als ze te
 * dicht zitten. Klein en zonder bibliotheek.
 *
 * stromen.svg({
 *   breedte, hoogte, links, rechts, id, beschrijving,
 *   bronnen: [{ id, naam, kleur, regels: [{ t, vet, kleur }] }],
 *   doelen:  [{ id, naam, kleur, regels: [...] }],
 *   stromen: [{ van, naar, kwh }],
 * })
 */
(function (global) {
  'use strict';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function svg(o) {
    const W = o.breedte;
    const H = o.hoogte;
    const xL = o.links ?? 104;
    const xR = W - (o.rechts ?? 136);
    const nb = 10;
    const gat = 14;
    const st = o.stromen.filter((s) => s.kwh > 0);
    const som = (id, kant) => st.filter((s) => s[kant] === id).reduce((t, s) => t + s.kwh, 0);
    const bronnen = o.bronnen.filter((b) => som(b.id, 'van') > 0);
    const doelen = o.doelen.filter((d) => som(d.id, 'naar') > 0);
    const totaal = Math.max(bronnen.reduce((t, b) => t + som(b.id, 'van'), 0), doelen.reduce((t, d) => t + som(d.id, 'naar'), 0)) || 1;
    // Elk blok krijgt minstens de ruimte van zijn naam, zodat een klein blok (1 kWh
    // van de haard) zijn naam niet naast het volgende blok krijgt (Ricardo, 19 november 2026).
    const minVak = (x) => 14 * ((x.regels ?? []).length + 1) + 4 - gat;
    // Onderaan ruimte voor de naam van het laatste blok; de schaal zo dat de grote blokken de rest delen.
    const schaalVan = (lijst, kant) => {
      const ruimte = H - 52 - gat * (lijst.length - 1);
      let s = ruimte / totaal;
      for (let k = 0; k < 6; k++) {
        let vast = 0;
        let rest = 0;
        for (const x of lijst) {
          const v = som(x.id, kant);
          if (v * s < minVak(x)) vast += minVak(x);
          else rest += v;
        }
        s = rest > 0 ? Math.max(0, ruimte - vast) / rest : s;
      }
      return s;
    };
    const schaal = Math.max(1e-9, Math.min(schaalVan(bronnen, 'van'), schaalVan(doelen, 'naar')));
    const plek = {};
    const leg = (lijst, kant) => {
      let y = 12;
      for (const x of lijst) {
        const echt = som(x.id, kant) * schaal;
        const h = Math.max(4, echt);
        const vak = Math.max(h, minVak(x));
        const top = y + (vak - h) / 2;
        plek[x.id] = { y: top, h, vrij: top, rek: h / Math.max(1e-9, echt) };
        y += vak + gat;
      }
    };
    leg(bronnen, 'van');
    leg(doelen, 'naar');
    const kleur = Object.fromEntries([...bronnen, ...doelen].map((x) => [x.id, x.kleur]));
    let defs = '';
    let banden = '';
    st.forEach((f, i) => {
      const a = plek[f.van];
      const b = plek[f.naar];
      if (!a || !b) return;
      const ha = f.kwh * schaal * a.rek;
      const hb = f.kwh * schaal * b.rek;
      const y1 = a.vrij;
      const y2 = b.vrij;
      a.vrij += ha;
      b.vrij += hb;
      const x1 = xL + nb;
      const x2 = xR;
      const m = (x1 + x2) / 2;
      const id = `${o.id ?? 'st'}-${i}`;
      defs += `<linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${kleur[f.van]}" stop-opacity="0.55"/><stop offset="1" stop-color="${kleur[f.naar]}" stop-opacity="0.32"/></linearGradient>`;
      banden += `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} C${m.toFixed(1)},${y1.toFixed(1)} ${m.toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} L${x2.toFixed(1)},${(y2 + hb).toFixed(1)} C${m.toFixed(1)},${(y2 + hb).toFixed(1)} ${m.toFixed(1)},${(y1 + ha).toFixed(1)} ${x1.toFixed(1)},${(y1 + ha).toFixed(1)}Z" fill="url(#${id})"/>`;
    });
    const tekst = (x, y, anker, kop, regels) =>
      `<text x="${x}" y="${y.toFixed(1)}" text-anchor="${anker}" font-family="Figtree, sans-serif" font-size="12.5" font-weight="700" fill="var(--tekst)">${esc(kop)}</text>${(regels ?? [])
        .map((r, i) => `<text x="${x}" y="${(y + 14 * (i + 1)).toFixed(1)}" text-anchor="${anker}" font-family="Figtree, sans-serif" font-size="11.5" font-weight="${r.vet ? 700 : 500}" fill="${r.kleur ?? 'var(--zacht)'}">${esc(r.t)}</text>`)
        .join('')}`;
    // De namen naast hun blok, maar nooit over elkaar: wat te dicht zit, schuift omlaag.
    const namenY = (lijst) => {
      let vrij = -Infinity;
      return lijst.map((x) => {
        const n = (x.regels ?? []).length;
        const y = Math.max(plek[x.id].y + plek[x.id].h / 2 - 2 - (n * 14) / 2 + 7, vrij);
        vrij = y + 14 * (n + 1) + 4;
        return y;
      });
    };
    let knopen = '';
    const yB = namenY(bronnen);
    bronnen.forEach((b, i) => {
      const p = plek[b.id];
      knopen += `<rect x="${xL}" y="${p.y.toFixed(1)}" width="${nb}" height="${p.h.toFixed(1)}" rx="3" fill="${b.kleur}"/>${tekst(xL - 8, yB[i], 'end', b.naam, b.regels)}`;
    });
    const yD = namenY(doelen);
    doelen.forEach((d, i) => {
      const p = plek[d.id];
      knopen += `<rect x="${xR}" y="${p.y.toFixed(1)}" width="${nb}" height="${p.h.toFixed(1)}" rx="3" fill="${d.kleur}"/>${tekst(xR + nb + 8, yD[i], 'start', d.naam, d.regels)}`;
    });
    // Zo hoog als nodig: de laatste naam valt nooit buiten beeld.
    const onder = Math.max(H, ...[...yB, ...yD].map((y, i) => y + 14 * (([...bronnen, ...doelen][i]?.regels ?? []).length + 1)));
    return `<svg viewBox="0 0 ${W} ${Math.ceil(onder)}" role="img" aria-label="${esc(o.beschrijving ?? '')}" preserveAspectRatio="xMidYMid meet"><defs>${defs}</defs>${banden}${knopen}</svg>`;
  }

  global.stromen = { svg };
})(window);
