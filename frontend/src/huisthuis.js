/*
 * Het huis zoals getekend, op Thuis, een kamer en het always-on display
 * (21 november 2026, stap a van de nieuwe tekenaar; schets design/app2/thuis-nieuw.js).
 *
 * De nieuwe tekenaar (kit/huis-maat.js) tekent het huis zoals het in Je huis
 * staat, met de vaste lijst van modellen (kit/huis-modellen.js). Dit bestand
 * bouwt daarvoor de tekenaar van Je huis op uit `api/huistekening`, alleen om
 * te tekenen (er wordt niets bewaard), en zet wat Thuis al weet (de
 * temperaturen, wat aan staat, de screens, de stroom, de zon) om naar zijn
 * opties.
 *
 * Voorlopig staat het poppenhuis (kit/huis.js) er nog: de nieuwe tekenaar komt
 * alleen als hij aan staat (`?tekenaar=maat` in het adres, `?tekenaar=poppenhuis`
 * zet hem weer uit; daarna onthoudt dit scherm het). De keuze bij Weergave komt
 * in een volgende stap. Zonder tekening in Je huis, of als er iets misgaat,
 * blijft het poppenhuis. De motor en de modellen laadt het pas als hij aan staat.
 *
 * huisThuis.teken(el, model, { soort, breedte, hoogte, huisData, kamerId, avond, opnieuw })
 * tekent in `el` en geeft true; false betekent: teken het poppenhuis. `opnieuw`
 * wordt aangeroepen zodra de tekenaar klaar is (de eerste keer laden).
 */
(function (global) {
  'use strict';
  if (global.huisThuis) return;
  const SLEUTEL = 'sc-tekenaar';
  const t = (k, p) => global.t(k, p);

  /**
   * Staat de nieuwe tekenaar aan? Bij Weergave (Het huis zoals getekend, voor jou op elk scherm). Het adres kan het op
   * één scherm nog anders zetten (`?tekenaar=maat` of `?tekenaar=poppenhuis`, dat scherm onthoudt het tot je bij
   * Weergave kiest).
   */
  function aan() {
    let keuze = null;
    try {
      keuze = new URLSearchParams(location.search).get('tekenaar');
      if (keuze === 'maat' || keuze === 'poppenhuis') localStorage.setItem(SLEUTEL, keuze);
      else keuze = localStorage.getItem(SLEUTEL);
    } catch {
      // Zonder opslag: alleen wat het adres zegt.
    }
    if (keuze === 'maat' || keuze === 'poppenhuis') return keuze === 'maat';
    return global.app?.weergave?.()?.getekend === true;
  }

  const staat = { tk: null, bezig: null, fout: false };
  const laadScript = (src) =>
    new Promise((ok, fout) => {
      if (document.querySelector(`script[data-huisthuis="${src}"]`)) return ok();
      const s = document.createElement('script');
      s.src = src;
      s.dataset.huisthuis = src;
      s.onload = () => ok();
      s.onerror = fout;
      document.head.append(s);
    });

  /** De motor en de modellen laden, de tekening ophalen en de tekenaar opbouwen, op een svg die niemand ziet. */
  async function laad() {
    for (const src of ['kit/huistekenen.js', 'kit/huis-modellen.js', 'kit/huis-maat.js', 'huisvoor.js']) await laadScript(src);
    const d = await global.app.haal('api/huistekening');
    const hv = global.huisVoor;
    const huis = hv.huisVoorMotor(d);
    if (!huis.etages.length) throw new Error('geen etages');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:fixed;left:-4000px;top:0;width:800px;height:600px;visibility:hidden;pointer-events:none';
    document.body.append(svg);
    const beneden = huis.etages.find((e) => e.id === 'bg')?.id ?? huis.etages.at(-1).id;
    const tk = global.huistekenen.maak(svg, huis, { stand: 'kamers', etage: beneden, tekening: hv.zonderLosBuiten(d, huis), openingen: true, vast: [hv.HUIS_OP_ERF] });
    // Nog niets getekend in Je huis (het voorbeeldhuis, een nieuw huis): geen lege dozen, dan blijft het poppenhuis.
    const binnen = huis.etages.filter((e) => !e.buiten).map((e) => tk.st.vloeren[e.id]);
    if (!binnen.some((v) => Object.values(v?.ruimtes ?? {}).some((r) => r.kamer))) {
      svg.remove();
      throw new Error('nog niets getekend in Je huis');
    }
    staat.tk = tk;
  }

  /** Is de tekenaar er? Zo niet, dan begint het laden, en `opnieuw` tekent als hij klaar is. */
  function klaar(opnieuw) {
    if (staat.tk) return true;
    if (!staat.bezig && !staat.fout) {
      staat.bezig = laad()
        .then(() => opnieuw?.())
        .catch((e) => {
          staat.fout = true;
          console.warn('Het huis zoals getekend laadde niet; het poppenhuis blijft.', e);
        });
    }
    return false;
  }

  /** De ruitjes van een vloer als rechthoeken per ruimte, in meters. */
  function rechthoeken(v, K) {
    const { W, H, cel } = v;
    const m = (c) => (c - K.MARGE) * K.CEL;
    const uit = [];
    const open = new Map();
    for (let y = 0; y <= H; y++) {
      const nu = new Set();
      if (y < H) {
        let x = 0;
        while (x < W) {
          const id = cel[y * W + x];
          let x1 = x + 1;
          while (x1 < W && cel[y * W + x1] === id) x1++;
          if (id !== K.BUITEN) {
            const sl = `${id}:${x}:${x1}`;
            nu.add(sl);
            if (!open.has(sl)) open.set(sl, { id, x0: x, x1, y0: y });
          }
          x = x1;
        }
      }
      for (const [sl, r] of [...open]) {
        if (nu.has(sl)) continue;
        uit.push({ id: r.id, x0: m(r.x0), x1: m(r.x1), y0: m(r.y0), y1: m(y) });
        open.delete(sl);
      }
    }
    return uit;
  }

  const TOON = { goed: 'goed', verwarmt: 'verwarmt', koelt: 'koelt', wacht: 'wacht', zon: 'zon' };
  const opp = (r) => (r.x1 - r.x0) * (r.y1 - r.y0);

  /** Wat de nieuwe tekenaar nodig heeft, uit de tekenaar, het model van de pagina en api/huis. */
  function opties(tk, model, huisApi) {
    const K = global.huistekenen;
    const m = (c) => (c - K.MARGE) * K.CEL;
    // Wat aan staat, de stand van de screens (100 is open) en de lamp die bij een camera hoort, uit api/huis.
    const aanSet = new Set();
    const schermen = {};
    const lichtBij = {};
    for (const e of huisApi?.etages ?? []) {
      for (const r of e.ruimtes ?? []) {
        for (const a of r.apparaten ?? []) {
          if (typeof a.id !== 'string') continue;
          if (a.aan) aanSet.add(a.id);
          if (a.soort === 'screen' && typeof a.positiePct === 'number') schermen[a.id] = a.positiePct;
          if (a.soort === 'licht' && a.hoortBij) lichtBij[a.hoortBij] = a.id;
        }
      }
    }
    // De airco's uit het model (die zeggen of ze echt draaien).
    for (const e of model.etages ?? []) for (const k of e.kamers ?? []) for (const a of k.apparaten ?? []) if (a.soort === 'airco' && a.aan && a.naam) aanSet.add(a.naam);
    // De temperatuur en de stand per kamer, zoals de pagina ze toont.
    const kamers = {};
    for (const e of model.etages ?? []) {
      for (const k of e.kamers ?? []) {
        if (!k.temp && !k.stand) continue;
        kamers[k.id] = { temp: k.temp ?? undefined, ...(k.stand ? { zin: k.zin, toon: TOON[k.stand] ?? 'goed' } : {}) };
      }
    }
    // Buiten: het erf, de plekken als vlakken, de gebouwen erop.
    const erfE = tk.huis.etages.find((e) => e.buiten);
    const vloer = erfE ? tk.st.vloeren[erfE.id] : null;
    const erf = tk.huis.erf ? { x: tk.huis.erf.u, y: tk.huis.erf.v, b: tk.huis.erf.b, d: tk.huis.erf.d } : null;
    const kamerVan = (id) => tk.huis.kamers.find((x) => x.id === id);
    const kamerSoort = (id) => kamerVan(id)?.soort ?? '';
    const rects = vloer ? rechthoeken(vloer, K) : [];
    const plek = (soort) => rects.filter((r) => kamerSoort(vloer.ruimtes[r.id]?.kamer) === soort).sort((a, b) => opp(b) - opp(a));
    const vlakken = [];
    for (const r of rects) {
      const grond = { oprit: 'oprit', voortuin: 'gras', tuin: 'gras', achtertuin: 'gras', terras: 'terras', border: 'border' }[kamerSoort(vloer.ruimtes[r.id]?.kamer)];
      const kamer = vloer.ruimtes[r.id]?.kamer;
      if (grond) vlakken.push({ soort: grond, p: [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]], kamer, naam: kamerVan(kamer)?.naam, ...(grond === 'terras' ? { meubels: true } : {}) });
    }
    // Op het terras één tafel: alleen op het grootste stuk.
    const vopp = (v) => (v.p[2][0] - v.p[0][0]) * (v.p[2][1] - v.p[0][1]);
    vlakken.filter((v) => v.soort === 'terras').sort((a, b) => vopp(b) - vopp(a)).slice(1).forEach((v) => delete v.meubels);
    // De gebouwen op het erf op de maat zoals ze getekend zijn, met de naam die de bewoner gaf.
    const blok = (soort) => erfE?.blokken?.find((b) => b.soort === soort || b.id === soort);
    const getekend = (soort) => {
      const r = plek(soort)[0];
      if (r) return { x: r.x0, y: r.y0, b: r.x1 - r.x0, d: r.y1 - r.y0, naam: kamerVan(vloer.ruimtes[r.id]?.kamer)?.naam, kamer: vloer.ruimtes[r.id]?.kamer };
      const b = blok(soort);
      return b ? { x: b.u, y: b.v, b: b.b, d: b.d } : null;
    };
    const naamVan = (g, soort) => g.naam ?? (soort === 'schuur' ? t('ht.bron.blok.tuinhuis') : t(`ht.bron.blok.${soort}`));
    const hoofd = tk.huis.etages.find((e) => e.id === (tk.huis.beneden ?? 'bg'))?.blokken?.find((b) => b.soort === 'hoofdhuis');
    const gebouwen = [];
    for (const [soort, h] of [['garage', 2.7], ['schuur', 2.0], ['carport', 2.4]]) {
      const g = getekend(soort);
      if (g) gebouwen.push({ ...g, soort, h, naam: global.huismodel?.metHoofdletter?.(naamVan(g, soort)) ?? naamVan(g, soort) });
    }
    // Het tuinhuis met zijn lampen: een lamp met "overstek" (of veranda, buiten) in de naam brandt onder het overstek, de andere binnen.
    const tuinhuis = getekend('tuinhuis');
    if (tuinhuis) {
      const lampen = tk.st.apparaten.filter((a) => a.soort === 'licht' && kamerSoort(a.kamer) === 'tuinhuis');
      const overstek = lampen.find((a) => /overstek|veranda|buiten|porch|canopy/i.test(a.naam ?? ''));
      const binnen = lampen.find((a) => a !== overstek);
      const naam = naamVan(tuinhuis, 'tuinhuis');
      gebouwen.push({ ...tuinhuis, soort: 'tuinhuis', h: 2.5, naam: global.huismodel?.metHoofdletter?.(naam) ?? naam, overstek: { d: 1.2, licht: !!overstek && aanSet.has(overstek.id) }, licht: !!binnen && aanSet.has(binnen.id) });
    }
    /*
     * De muren van het huis (stap b, 21 november 2026: geen plekken meer die alleen bij Ricardo's huis klopten). Het
     * dichtstbijzijnde punt op een gevel met de richting naar buiten; een muur tegen de buren (links, rechts, achter vanaf
     * de straat; -x is links) telt niet mee.
     */
    const tegenBuren = new Set(tk.huis.woning?.buren ?? []);
    const huisDoos = hoofd ? { x: hoofd.u, y: hoofd.v, b: hoofd.b, d: hoofd.d } : null;
    const gevels = (g, metBuren = false) => [
      { kant: 'voor', n: [0, -1], vast: g.y, as: 'x', van: g.x, tot: g.x + g.b },
      { kant: 'achter', n: [0, 1], vast: g.y + g.d, as: 'x', van: g.x, tot: g.x + g.b },
      { kant: 'links', n: [-1, 0], vast: g.x, as: 'y', van: g.y, tot: g.y + g.d },
      { kant: 'rechts', n: [1, 0], vast: g.x + g.b, as: 'y', van: g.y, tot: g.y + g.d },
    ].filter((w) => metBuren || g !== huisDoos || !tegenBuren.has(w.kant));
    /** Het dichtstbijzijnde punt op een muur van een van de dozen, een stukje van de hoeken af, met zijn richting naar buiten. */
    const opMuur = (x, y, dozen, marge = 0.3) => {
      let best = null;
      for (const g of dozen) {
        for (const w of gevels(g)) {
          const l = Math.max(w.van + marge, Math.min(w.tot - marge, w.as === 'x' ? x : y));
          const [px, py] = w.as === 'x' ? [l, w.vast] : [w.vast, l];
          const afst = Math.hypot(px - x, py - y);
          if (!best || afst < best.afst) best = { x: px, y: py, n: w.n, kant: w.kant, afst };
        }
      }
      return best;
    };
    // De auto op de oprit: in de lengte van de oprit, met de neus naar de straat (of naar de kant zonder gebouw).
    const oprit = plek('oprit')[0];
    const garage = gebouwen.find((g) => g.soort === 'garage');
    let auto = null;
    if (model.oprit?.auto && oprit) {
      const diep = oprit.y1 - oprit.y0 >= oprit.x1 - oprit.x0;
      const [b, d] = diep ? [1.84, 4.5] : [4.5, 1.84];
      if (oprit.x1 - oprit.x0 >= b && oprit.y1 - oprit.y0 >= d) {
        const x = diep ? (oprit.x0 + oprit.x1) / 2 - b / 2 : Math.max(oprit.x0 + 0.4, Math.min(oprit.x1 - b - 0.4, (garage ? garage.x - 0.9 : oprit.x1) - b));
        const y = diep ? Math.max(oprit.y0 + 0.6, Math.min(oprit.y1 - d - 0.3, (garage && garage.y >= oprit.y0 ? garage.y : oprit.y1) - d - 0.9)) : (oprit.y0 + oprit.y1) / 2 - d / 2;
        auto = { x, y, b, d, kleur: '#c9d4df', laadt: !!model.oprit?.laadt };
      }
    }
    // Apparaten buiten: lampen, de deurbel, camera's, het zonnescherm, de lampjes in de border.
    const apparaten = [];
    for (const a of tk.st.apparaten) {
      if (!erfE || a.plek?.etage !== erfE.id) continue;
      const [x, y] = [m(a.plek.x), m(a.plek.y)];
      if (a.soort === 'licht' && kamerSoort(a.kamer) === 'border') {
        const b = plek('border')[0];
        if (!b) continue;
        const lang = b.x1 - b.x0 >= b.y1 - b.y0;
        apparaten.push({ id: a.id, soort: 'snoer', punten: lang ? [[b.x0 + 0.2, (b.y0 + b.y1) / 2], [b.x1 - 0.2, (b.y0 + b.y1) / 2]] : [[(b.x0 + b.x1) / 2, b.y0 + 0.2], [(b.x0 + b.x1) / 2, b.y1 - 0.2]] });
      } else if (a.soort === 'camera' && /deurbel|doorbell/i.test(`${a.id} ${a.naam}`)) {
        // Een deurbel hangt aan de gevel van het huis, het dichtst bij waar hij in Je huis staat.
        const w = huisDoos ? opMuur(x, y, [huisDoos]) : null;
        apparaten.push({ id: a.id, soort: 'deurbel', x: w?.x ?? x, y: w?.y ?? y, z: 1.4, n: w?.n ?? [0, -1] });
      } else if (a.soort === 'camera') {
        // Een camera hangt aan de muur die het dichtst ligt bij waar hij in Je huis staat: het huis, de garage, een schuur.
        const w = opMuur(x, y, [...gebouwen.filter((q) => q.soort !== 'tuinhuis' && q.soort !== 'carport'), ...(huisDoos ? [huisDoos] : [])]);
        apparaten.push({ id: a.id, soort: 'camera', x: w?.x ?? x, y: w?.y ?? y, n: w?.n ?? [0, -1], z: 2.4, licht: lichtBij[a.id] });
      } else if (a.soort === 'screen') {
        // Een zonnescherm hangt aan de gevel het dichtst bij zijn plek, en rolt naar buiten uit.
        const w = huisDoos ? opMuur(x, y, [huisDoos], 1.8) : null;
        if (w) apparaten.push({ id: a.id, soort: 'screen', x: w.x + w.n[0] * 0.02, y: w.y + w.n[1] * 0.02, z: 2.5, b: Math.min(3.4, (w.n[0] ? hoofd.d : hoofd.b) - 0.4), uit: w.n });
      }
    }
    /*
     * De stroom van het net: van de straat naar de voordeur. Ligt de voordeur in de voorgevel, dan recht erheen; in een
     * zijgevel langs die gevel (bij Ricardo de lijn tussen voortuin en oprit). De voordeur uit de tekening, anders de
     * deurbel, anders het midden van de hal.
     */
    const stroom = [];
    const bgV = tk.st.vloeren[tk.huis.beneden ?? 'bg'];
    const net = (model.stromen ?? []).find((x) => x.van === 'net');
    const label = (model.labels ?? []).find((l) => l.bij === 'net')?.titel;
    const voordeur = (bgV?.openingen ?? []).find((g) => g.soort === 'voordeur');
    const deurbel = apparaten.find((a) => a.soort === 'deurbel');
    const halId = bgV ? Object.entries(bgV.ruimtes).find(([, r]) => kamerSoort(r.kamer) === 'hal' || r.kamer === 'hal')?.[0] : null;
    const halR = halId ? K.maten(bgV)[halId]?.r : null;
    const deur = voordeur ? (voordeur.as === 'x' ? { x: m(voordeur.op), y: m((voordeur.van + voordeur.tot) / 2) } : { x: m((voordeur.van + voordeur.tot) / 2), y: m(voordeur.op) }) : deurbel ? { x: deurbel.x, y: deurbel.y } : halR ? { x: m((halR.x0 + halR.x1) / 2), y: hoofd ? hoofd.v : m(halR.y0) } : null;
    if (net && erf && hoofd && deur) {
      const w = opMuur(deur.x, deur.y, [huisDoos], 0);
      const pad = !w || w.kant === 'voor' ? [[deur.x, erf.y - 1.0, 0.05], [deur.x, hoofd.v, 0.05]] : w.kant === 'achter' ? [[hoofd.u - 0.08, erf.y - 1.0, 0.05], [hoofd.u - 0.08, w.y + 0.08, 0.05], [w.x, w.y + 0.08, 0.05]] : [[w.x + w.n[0] * 0.08, erf.y - 1.0, 0.05], [w.x + w.n[0] * 0.08, w.y, 0.05], [w.x - w.n[0] * 0.15, w.y, 0.05]];
      stroom.push({ toon: 'violet', label, dx: -(String(label ?? '').length * 7.6 + 40), dy: 16, pad });
    }
    const voortuin = plek('voortuin')[0];
    /*
     * De buitenunits: buiten, op de grond tegen de gevel het dichtst bij zijn airco (de plek uit Je huis), niet tegen de
     * buren, en aan de straat alleen als het niet anders kan; aan als zijn airco draait. Zoveel als er buitenunits zijn.
     */
    const units = [];
    const aircos = tk.st.apparaten.filter((a) => a.soort === 'airco');
    const aantalUnits = Math.min(model.buitenunit?.aantal ?? 0, Math.max(1, aircos.length));
    if (huisDoos && aantalUnits) {
      const gebruikt = [];
      for (let i = 0; i < aantalUnits; i++) {
        const a = aircos[i];
        const [ax, ay] = a?.plek ? [m(a.plek.x), m(a.plek.y)] : [huisDoos.x + huisDoos.b / 2, huisDoos.y + huisDoos.d];
        let best = null;
        for (const w of gevels(huisDoos)) {
          let l = Math.max(w.van + 0.6, Math.min(w.tot - 0.6, w.as === 'x' ? ax : ay));
          // Niet op een unit die er al staat.
          for (const u of gebruikt) if (u.kant === w.kant && Math.abs(u.l - l) < 1.0) l = Math.min(w.tot - 0.6, u.l + 1.0);
          const [px, py] = w.as === 'x' ? [l, w.vast] : [w.vast, l];
          const afst = Math.hypot(px - ax, py - ay) + (w.kant === 'voor' ? 3 : 0);
          if (!best || afst < best.afst) best = { x: px + w.n[0] * 0.02, y: py + w.n[1] * 0.02, n: w.n, kant: w.kant, l, afst };
        }
        if (!best) continue;
        gebruikt.push(best);
        units.push({ x: best.x, y: best.y, n: best.n, aan: !!a && aanSet.has(a.id) });
      }
    }
    /*
     * Eén boom in het seizoen, in de voortuin als die groot genoeg is: in de hoek die het verst ligt van het huis, de
     * oprit en de gebouwen, en minstens 1,2 meter van alles af (anders geen boom).
     */
    const bomen = [];
    if (voortuin && voortuin.x1 - voortuin.x0 > 2.6 && voortuin.y1 - voortuin.y0 > 3.2) {
      const bezet = [...(huisDoos ? [huisDoos] : []), ...gebouwen, ...(oprit ? [{ x: oprit.x0, y: oprit.y0, b: oprit.x1 - oprit.x0, d: oprit.y1 - oprit.y0 }] : []), ...(auto ? [auto] : [])];
      const afstTot = (x, y) => Math.min(...bezet.map((g) => Math.hypot(Math.max(g.x - x, 0, x - g.x - g.b), Math.max(g.y - y, 0, y - g.y - g.d))), 99);
      const hoeken = [[voortuin.x0 + 1.3, voortuin.y0 + 1.6], [voortuin.x1 - 1.3, voortuin.y0 + 1.6], [voortuin.x0 + 1.3, voortuin.y1 - 1.6], [voortuin.x1 - 1.3, voortuin.y1 - 1.6]];
      const [bx, by] = hoeken.sort((a, b) => afstTot(...b) - afstTot(...a))[0];
      if (afstTot(bx, by) >= 1.2) bomen.push({ x: bx, y: by, h: 4.2, r: 1.1 });
    }
    const zon = model.zon ?? {};
    const panelen = [zon.panelen ? { aantal: zon.panelen, kant: 0 } : null, zon.panelenLinks ? { aantal: zon.panelenLinks, kant: 1 } : null].filter(Boolean);
    const tijd = model.tijd ?? 'dag';
    /*
     * Stap f (21 november 2026, het voorbeeldhuis en een appartement): een appartement is alleen de woning, zonder
     * tuin en, met verdiepingen erboven, zonder dak; een erf waar nog niets op getekend is, staat niet als lege wei
     * om het huis (alleen gras, geen gebouw of auto): dan het huis dichtbij.
     */
    const appartement = tk.huis.woning?.soort === 'appartement';
    const leegErf = vlakken.every((v) => v.soort === 'gras') && !gebouwen.length && !auto;
    const extra = appartement ? { buiten: {}, bomen: [], geenEiland: true, passend: 'huis', zonderDak: (tk.huis.woning?.erboven ?? 1) > 0, stroom: [] } : leegErf ? { passend: 'dichtbij', bomen: [] } : {};
    return {
      hoek: -58,
      hoogte: 27,
      lucht: 0,
      // Het seizoen kan uit bij Weergave: dan een groene zomer.
      seizoen: global.app?.weergave?.()?.seizoen === false ? 'zomer' : model.seizoen ?? 'herfst',
      avond: tijd === 'avond' || tijd === 'nacht',
      hemel: { tijd, wolken: model.wolken ?? 0 },
      kamers,
      aan: [...aanSet],
      panelen,
      schermen,
      bomen,
      stroom,
      buiten: { erf, vlakken, gebouwen, apparaten, units, ...(auto ? { auto } : {}) },
      rand: 36,
      // Tikken op de panelen opent Daken (zoals in het poppenhuis).
      ...(model.zon?.tik ? { panelenTik: model.zon.tik, panelenTikLabel: model.zon.tikLabel } : {}),
      ...extra,
    };
  }

  /** Een kamer: één etage los, met meubels. Een plek buiten toont de begane grond met het hele erf. */
  function alsEtage(o, tk, huisApi, kamerId) {
    const e = (huisApi?.etages ?? []).find((x) => (x.ruimtes ?? []).some((r) => r.id === kamerId));
    const beneden = tk.huis.beneden ?? 'bg';
    const buiten = !e || !tk.huis.etages.some((x) => x.id === e.id && !x.buiten);
    Object.assign(o, { etage: buiten ? beneden : e.id, meubels: true, boven: 0, rand: 16, stroom: [], gekozen: kamerId });
    if (!buiten) Object.assign(o, { passend: 'huis', buiten: {}, bomen: [], geenEiland: e.id !== beneden });
    return o;
  }

  /** Het always-on display: het hele huis zonder getallen; overdag de zonneboog, 's avonds donker. */
  function alsRust(o, avond, model) {
    Object.assign(o, { stil: true, boven: 0, rand: 10, stroom: [], hemel: null });
    if (avond) o.avond = true;
    const zon = model?.zon;
    const voorDeg = model?.voorgevelDeg ?? model?.kompas?.voorgevelDeg;
    // De baan van de zon kan uit bij Weergave (besluit 205).
    if (!avond && global.app?.weergave?.()?.zonnebaan !== false && zon?.nu && zon?.baan?.length && voorDeg != null) o.zonBoog = { nu: zon.nu, baan: zon.baan, voorDeg };
    return o;
  }

  /**
   * Tekent het huis zoals getekend in `el`; false: teken het poppenhuis.
   * @param {Element} el
   * @param {any} model
   * @param {{ soort?: string, tel?: boolean, breedte?: number, hoogte?: number, huisData?: any, kamerId?: string | null, avond?: boolean, opnieuw?: (() => void) | null }} [opts]
   */
  function teken(el, model, { soort = 'thuis', tel = false, breedte, hoogte, huisData = null, kamerId = null, avond = false, opnieuw = null } = {}) {
    if (!el || !aan() || staat.fout || !klaar(opnieuw)) return false;
    try {
      const B = Math.round(breedte ?? el.clientWidth ?? 860);
      const H = Math.round(hoogte ?? 612);
      const o = /** @type {any} */ (opties(staat.tk, model, huisData));
      if (soort === 'kamer') alsEtage(o, staat.tk, huisData, kamerId);
      else if (soort === 'rust') alsRust(o, avond, model);
      else if (soort === 'tel') Object.assign(o, { passend: o.passend === 'huis' ? 'huis' : 'dichtbij', boven: 0, rand: 6, stroom: [] });
      else o.boven = 90;
      // De telefoon (stap d): klein, dus zonder namen in de tekening; de kamers staan eronder.
      if (soort === 'tel' || tel) Object.assign(o, { stil: true, rand: 6 });
      // Tikken op een kamer, een deel buiten of de panelen, zoals in het poppenhuis (niet als niemand kijkt).
      if (soort !== 'rust') o.tik = true;
      const uit = global.huisMaat.teken(staat.tk, B, H, o);
      el.innerHTML = `<svg viewBox="0 0 ${B} ${H}" width="${B}" height="${H}" role="img" aria-label="${global.app.esc(t('thuis.hetHuis'))}">${uit.svg}</svg>`;
      return true;
    } catch (e) {
      staat.fout = true;
      console.warn('Het huis zoals getekend lukte niet; het poppenhuis blijft.', e);
      return false;
    }
  }

  global.huisThuis = { aan, teken, laad };
})(window);
