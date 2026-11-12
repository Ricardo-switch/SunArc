/*
 * De schets Je huis tekenen aan elkaar: de tekenaar op de tekening, het blad,
 * de etages, de strook, de knoppen bovenin en de standen in het adres. Gedeeld
 * door Wand-Huis-Tekenen en Tel-Huis-Tekenen.
 *
 * Het adres zegt de stand en het huis: `#vorm`, `#huis`, `#dicht`, `#muur`…
 * voor het voorbeeldhuis; `#open` het tweede huis nog leeg, `#kern` getekend;
 * `#jouw` het huis van Ricardo uit de 3D-kaart, met zijn begane grond. Een
 * stand en een huis samen: `#huis-jouw`, `#dicht-jouw`, `#vorm-jouw`, `#huis-kern`.
 */
(function (global) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const WIJS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2"/><path d="M15 11a1.5 1.5 0 0 1 3 0v3.5c0 3.6-2.2 6-5.6 6-2.4 0-3.7-.9-5-2.9L5 14.3c-.6-1 .6-2.2 1.6-1.4L9 15"/></svg>';

  function start() {
    const adres = location.hash.slice(1);
    const wie = /(^|-)jouw$/.test(adres) ? 'jouw' : /(^|-)kern$/.test(adres) ? 'kern' : adres === 'open' ? 'open' : '';
    const toon = adres.replace(/-?(jouw|kern)$/, '').replace(/^open$/, '');
    const huis = wie === 'jouw' ? huistekenenJouw : wie ? huistekenenOpen : huistekenenVoorbeeld;
    const stand = toon === 'huis' || toon === 'dicht' ? 'huis' : toon === 'vorm' || toon === 'bron' ? 'vorm' : toon === 'apparaten' || toon === 'kamer' ? 'apparaten' : 'kamers';
    const t = huistekenen.maak($('tekening'), huis, { stand, etage: toon === 'leeg' ? 'zolder' : 'bg', bewaar: adres ? null : 'sunarc-schets-huistekenen-1' });
    huistekenen.paneel($('blad'), t);
    if ($('stapel')) huistekenen.stapel($('stapel'), t);
    huistekenen.strook($('strook'), t);
    // Wat er onder de tekening ligt: meestal de straat.
    document.querySelectorAll('.hm-straat').forEach((el) => (el.textContent = huis.onder ?? 'STRAAT'));

    document.querySelectorAll('[data-ik]').forEach((el) => el.insertAdjacentHTML('afterbegin', iconen.svg(el.dataset.ik)));
    const bij = () => {
      document.querySelectorAll('[data-stand]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.stand === t.st.stand)));
      document.querySelectorAll('[data-etage-kies]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.etageKies === t.st.etage)));
      $('terug').disabled = !t.st.terug.length;
      $('vooruit').disabled = !t.st.vooruit.length;
      $('bewaard').textContent = t.st.bewaard ? 'Bewaard' : 'Bewaren…';
      $('bewaard').classList.toggle('bezig', !t.st.bewaard);
      $('uitleg').innerHTML = `${WIJS}<span>${huistekenen.uitleg(t)}</span>`;
    };
    t.op(bij);
    document.addEventListener('click', (e) => {
      const s = e.target.closest('[data-stand]');
      if (s) t.zetStand(s.dataset.stand);
      const et = e.target.closest('[data-etage-kies]');
      if (et) t.zetEtage(et.dataset.etageKies);
    });
    $('terug').addEventListener('click', () => t.terug());
    $('vooruit').addEventListener('click', () => t.vooruit());
    $('opnieuw')?.addEventListener('click', () => t.opnieuw());

    // De standen voor de schermafdrukken.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const v = t.vloer();
      const ruimte = (kamer) => Number(Object.entries(v.ruimtes).find(([, r]) => r.kamer === kamer)?.[0]);
      const M = t.MARGE;
      if ((wie === 'kern' || wie === 'jouw') && huis.kern) {
        // De begane grond met dezelfde stappen als met de vinger: zeggen wat het is, vak trekken, de zonelijn.
        const stand0 = t.st.stand;
        t.st.stand = 'kamers';
        for (const [id, r] of Object.entries(v.ruimtes)) if (huis.kern.basis[r.blok]) t.noem(Number(id), { kamer: huis.kern.basis[r.blok] });
        for (const [x0, y0, x1, y1, wat] of huis.kern.vakken) {
          t.vak({ x0: M + x0, y0: M + y0, x1: M + x1, y1: M + y1 });
          t.noem(t.st.kies.id, wat);
        }
        t.zetZone(huis.kern.zone.kamer, 'zet');
        t.vloer().zones[huis.kern.zone.kamer].op = M + huis.kern.zone.op;
        t.st.terug = [];
        t.st.stand = stand0;
        t.kies(null);
      }
      if (toon === 'muur') {
        const o = t.omtrek();
        // De muur tussen de hal en de woonkamer.
        t.kies({ soort: 'muur', run: { as: 'x', op: o.x0 + 58, van: o.y0, tot: o.y0 + 84, soort: 1 } });
      } else if (toon === 'vak') {
        const o = t.omtrek();
        // Een vak tegen de hal aan, rechts vooraan in de woonkamer: het toilet in wording.
        const id = v.volg++;
        v.ruimtes[id] = {};
        for (let y = o.y0 + 52; y < o.y0 + 84; y++) for (let x = o.x0 + 58; x < o.x0 + 72; x++) v.cel[y * v.W + x] = id;
        t.kies({ soort: 'ruimte', id });
      } else if (toon === 'kamer') t.zoom(ruimte('woonkamer'));
      else if (toon === 'dicht') {
        t.st.dicht = true;
        t.teken();
      } else if (toon === 'bron') t.kiesBron('osm');
      bij();
    }));
    bij();
    global.tekenaar = t;
  }

  global.huistekenenSchets = { start };
})(window);
