/*
 * Het huis zoals getekend: de opties voor de tekenaar (23 november 2026, uit src/huisthuis.js).
 *
 * Zet om wat een pagina weet (de tekenaar van Je huis, het model van Thuis, api/huis) naar de opties van
 * kit/huis-maat.js: de kamers, wat aan staat, de screens, het erf met de gebouwen, de auto, de stroom, de hemel.
 * Thuis, een kamer en het always-on display gebruiken het via src/huisthuis.js; Je huis › Huis rechtstreeks.
 *
 * huisOpties.opties(tekenaar, model, huisApi) geeft de opties; tuinKorter, alsEtage en alsRust passen ze aan.
 */
(function (global) {
  'use strict';
  if (global.huisOpties) return;
  const t = (k, p) => global.t(k, p);
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
    const lampKleur = {};
    for (const e of huisApi?.etages ?? []) {
      for (const r of e.ruimtes ?? []) {
        for (const a of r.apparaten ?? []) {
          if (typeof a.id !== 'string') continue;
          if (a.aan) aanSet.add(a.id);
          if (a.soort === 'screen' && typeof a.positiePct === 'number') schermen[a.id] = a.positiePct;
          if (a.soort === 'licht' && a.hoortBij) lichtBij[a.hoortBij] = a.id;
          // De kleur van een lamp die brandt, zoals in het poppenhuis (22 november 2026: de nieuwe tekenaar had altijd geel).
          if (a.soort === 'licht' && a.aan) lampKleur[a.id] = global.huismodel?.kleurVanLicht?.(a) ?? '#FFD9A0';
          // Een bewegingsmelder die nu beweging ziet: het teken eromheen.
          if (a.meting?.beweging?.nu) aanSet.add(a.id);
        }
      }
    }
    // Een radiator is warm als zijn kamer stookt: een radiatorknop die verwarmt, of een thermostaat (niet een airco) die aan staat (22 november 2026).
    for (const e of huisApi?.etages ?? []) {
      for (const r of e.ruimtes ?? []) {
        if (!(r.apparaten ?? []).some((a) => a.soort === 'klimaat' && !a.klimaat?.kanKoelen && a.aan)) continue;
        for (const a of tk.st.apparaten) if (a.soort === 'radiator' && a.kamer === r.id) aanSet.add(a.id);
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
    // Ook een kamer zonder temperatuur die Home Assistant kent (Slaapkamer Matts) krijgt zijn naam; een kamer die alleen
    // getekend is (het toilet, de meterkast) niet, zoals in het poppenhuis (22 november 2026).
    for (const e of huisApi?.etages ?? []) for (const r of e.ruimtes ?? []) kamers[r.id] ??= {};
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
      gebouwen.push({ ...tuinhuis, soort: 'tuinhuis', h: 2.5, naam: global.huismodel?.metHoofdletter?.(naam) ?? naam, overstek: { d: 1.2, licht: !!overstek && aanSet.has(overstek.id), kleur: overstek ? lampKleur[overstek.id] : undefined }, licht: !!binnen && aanSet.has(binnen.id), lichtKleur: binnen ? lampKleur[binnen.id] : undefined });
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
    // Een laadpaal buiten (`model.auto`, issue 164): de auto staat ernaast als hij er is, en laadt daar.
    const paal = model.auto ?? null;
    if ((model.oprit?.auto || (paal && paal.stand !== 'weg')) && oprit) {
      const diep = oprit.y1 - oprit.y0 >= oprit.x1 - oprit.x0;
      const [b, d] = diep ? [1.84, 4.5] : [4.5, 1.84];
      if (oprit.x1 - oprit.x0 >= b && oprit.y1 - oprit.y0 >= d) {
        const x = diep ? (oprit.x0 + oprit.x1) / 2 - b / 2 : Math.max(oprit.x0 + 0.4, Math.min(oprit.x1 - b - 0.4, (garage ? garage.x - 0.9 : oprit.x1) - b));
        const y = diep ? Math.max(oprit.y0 + 0.6, Math.min(oprit.y1 - d - 0.3, (garage && garage.y >= oprit.y0 ? garage.y : oprit.y1) - d - 0.9)) : (oprit.y0 + oprit.y1) / 2 - d / 2;
        auto = { x, y, b, d, kleur: '#c9d4df', laadt: !!model.oprit?.auto?.laadt || paal?.stand === 'laadt' };
      }
    }
    // De laadpaal tegen de muur het dichtst bij de oprit (het huis of de garage), met de kabel naar de auto als hij laadt.
    let laadpaal = null;
    if (paal && oprit) {
      const [ox, oy] = auto ? [auto.x + auto.b / 2, auto.y + auto.d / 2] : [(oprit.x0 + oprit.x1) / 2, (oprit.y0 + oprit.y1) / 2];
      const w = opMuur(ox, oy, [...(garage ? [garage] : []), ...(huisDoos ? [huisDoos] : [])], 0.5);
      if (w) laadpaal = { x: w.x + w.n[0] * 0.05, y: w.y + w.n[1] * 0.05, n: w.n, laadt: paal.stand === 'laadt' };
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
      } else if (a.soort === 'licht' && kamerSoort(a.kamer) !== 'tuinhuis') {
        // Een lamp in de tuin (niet in de border of het tuinhuis): een tuinlamp op een paaltje op zijn plek (22 november 2026).
        apparaten.push({ id: a.id, soort: 'licht', x, y, z: 0.6 });
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
    const voordeur = (bgV?.openingen ?? []).find((g) => g.soort === 'voordeur');
    const deurbel = apparaten.find((a) => a.soort === 'deurbel');
    const halId = bgV ? Object.entries(bgV.ruimtes).find(([, r]) => kamerSoort(r.kamer) === 'hal' || r.kamer === 'hal')?.[0] : null;
    const halR = halId ? K.maten(bgV)[halId]?.r : null;
    const deur = voordeur ? (voordeur.as === 'x' ? { x: m(voordeur.op), y: m((voordeur.van + voordeur.tot) / 2) } : { x: m((voordeur.van + voordeur.tot) / 2), y: m(voordeur.op) }) : deurbel ? { x: deurbel.x, y: deurbel.y } : halR ? { x: m((halR.x0 + halR.x1) / 2), y: hoofd ? hoofd.v : m(halR.y0) } : null;
    /*
     * De stroom (22 november 2026, zoals in het poppenhuis), uit de stromen van nu: van het net via de aansluitkast aan de
     * straat naar de voordeur; van de panelen langs de voorgevel naar binnen; teruglevering van de panelen naar de kast; naar
     * de auto bij de laadpaal; van en naar de thuisaccu. Elke lijn en zijn label opent de energiekaart (`tik`).
     */
    const muurDeur = deur && huisDoos ? opMuur(deur.x, deur.y, [huisDoos], 0) : null;
    const kastX = !deur ? null : !muurDeur || muurDeur.kant === 'voor' ? deur.x : muurDeur.kant === 'achter' ? (hoofd ? hoofd.u - 0.08 : null) : muurDeur.x + muurDeur.n[0] * 0.08;
    const kast = model.net && erf && kastX != null ? { x: kastX, y: erf.y + 0.35 } : null;
    if (kast) apparaten.push({ id: 'aansluitkast', soort: 'kast', x: kast.x, y: kast.y });
    const w = muurDeur;
    const naarDeur = kast && hoofd && deur ? (!w || w.kant === 'voor' ? [[deur.x, kast.y, 0.05], [deur.x, hoofd.v, 0.05]] : w.kant === 'achter' ? [[kastX, kast.y, 0.05], [kastX, w.y + 0.08, 0.05], [w.x, w.y + 0.08, 0.05]] : [[kastX, kast.y, 0.05], [kastX, w.y, 0.05], [w.x - w.n[0] * 0.15, w.y, 0.05]]) : null;
    const deurPunt = naarDeur ? naarDeur.at(-1) : deur ? [deur.x, deur.y, 0.05] : null;
    // De thuisaccu (`model.batterij`): aan de gevel naast de voordeur, met de stroom erheen.
    let accuPunt = null;
    if (model.batterij && deur && huisDoos) {
      const wa = opMuur(deur.x + 1.4, deur.y, [huisDoos], 0.6);
      if (wa) {
        apparaten.push({ id: 'thuisaccu', soort: 'accu', x: wa.x + wa.n[0] * 0.02, y: wa.y + wa.n[1] * 0.02, n: wa.n, procent: model.batterij.procent });
        accuPunt = [wa.x + wa.n[0] * 0.25, wa.y + wa.n[1] * 0.25, 0.05];
      }
    }
    const netLabel = (model.labels ?? []).find((l) => l.bij === 'net');
    const labelNet = netLabel ? { label: netLabel.titel, labelToon: netLabel.toon === 'mint' ? 'mint' : 'violet', dx: -(String(netLabel.titel).length * 7.6 + 40), dy: 16 } : {};
    let netGelabeld = false;
    for (const st of model.stromen ?? []) {
      const tik = st.tik ? { tik: st.tik, tikLabel: st.tikLabel } : {};
      const autoPunt = auto ? [auto.x + auto.b / 2, auto.y + auto.d / 2, 0.05] : null;
      if (st.van === 'net' && st.naar !== 'auto' && st.naar !== 'accu' && naarDeur) {
        stroom.push({ toon: 'violet', pad: naarDeur, ...tik, ...(netGelabeld ? {} : labelNet) });
        netGelabeld = true;
      } else if (st.van === 'zon' && st.naar === 'huis' && deurPunt) stroom.push({ toon: 'zon', pad: ['panelen', deurPunt], ...tik });
      else if (st.van === 'zon' && st.naar === 'net' && naarDeur) {
        stroom.push({ toon: 'zon', pad: ['panelen', ...[...naarDeur].reverse()], bij: 'eind', ...tik, ...(netGelabeld ? {} : labelNet) });
        netGelabeld = true;
      } else if (st.naar === 'auto' && deurPunt && autoPunt) stroom.push({ toon: st.van === 'zon' ? 'zon' : 'violet', pad: [st.van === 'net' && kast ? [kast.x, kast.y, 0.05] : deurPunt, autoPunt], ...tik });
      else if ((st.naar === 'accu' || st.van === 'accu') && deurPunt && accuPunt) stroom.push({ toon: 'mint', pad: st.van === 'accu' ? [accuPunt, deurPunt] : [deurPunt, accuPunt], ...tik });
    }
    // Alleen een label voor het net, ook als er nu geen lijn van of naar het net loopt (dan bij de kast).
    if (!netGelabeld && netLabel && kast && naarDeur) stroom.push({ toon: netLabel.toon === 'mint' ? 'mint' : 'violet', pad: naarDeur, ...labelNet, ...(netLabel.tik ? { tik: netLabel.tik, tikLabel: netLabel.tikLabel } : {}) });
    // Het label van de panelen (zoals in het poppenhuis).
    const panelenLabel = (model.labels ?? []).find((l) => l.bij === 'panelen');
    const voortuin = plek('voortuin')[0];
    /*
     * De buitenunits (22 november 2026, besluit 333): elke airco heeft een eigen bolletje buiten (`buitenunit:<airco>`).
     * Waar de bewoner hem neerzette, bepaalt hoe hij hangt: tegen het huis aan de muur op de hoogte van zijn airco, op een
     * gebouw met een plat dak (garage, carport) op dat dak, anders op de grond. Zonder eigen plek: aan de gevel het dichtst
     * bij zijn airco (niet tegen de buren, aan de straat alleen als het niet anders kan), op de grond bij de begane grond,
     * hoger op een beugel. Verborgen: geen buitenunit.
     */
    const units = [];
    const binnenE = tk.huis.etages.filter((e) => !e.buiten);
    const benedenI = binnenE.findIndex((e) => e.id === (tk.huis.beneden ?? 'bg'));
    /** Op welke hoogte de vloer van een etage ligt (de begane grond op 0). */
    const vloerZ = (id) => {
      const i = binnenE.findIndex((e) => e.id === id);
      if (i < 0 || benedenI < 0) return 0;
      let z = 0;
      for (let j = benedenI - 1; j >= i; j--) z += binnenE[j + 1]?.hoogte ?? 2.6;
      return i < benedenI ? z : 0;
    };
    const aircos = tk.st.apparaten.filter((a) => a.soort === 'airco');
    if (huisDoos) {
      const gebruikt = [];
      for (const a of aircos) {
        const bu = tk.st.apparaten.find((x) => x.id === `buitenunit:${a.id}`);
        if (!bu) continue;
        const za = a.plek ? vloerZ(a.plek.etage) : 0;
        const hoog = za > 0.5 ? za + 0.5 : 0.12;
        const aan = aanSet.has(a.id);
        if (erfE && bu.plek?.etage === erfE.id) {
          const [px, py] = [m(bu.plek.x), m(bu.plek.y)];
          const opDak = gebouwen.find((g) => (g.soort === 'garage' || g.soort === 'carport') && px > g.x + 0.3 && px < g.x + g.b - 0.3 && py > g.y + 0.3 && py < g.y + g.d - 0.3);
          const w = opMuur(px, py, [huisDoos], 0.6);
          if (opDak) units.push({ x: px, y: py, n: [0, -1], z: Number(opDak.h) + 0.02, aan });
          else if (w && w.afst < 0.9) units.push({ x: w.x + w.n[0] * 0.02, y: w.y + w.n[1] * 0.02, n: w.n, z: hoog, aan });
          else units.push({ x: px, y: py, n: w?.n ?? [0, 1], z: 0.12, aan, los: true });
          continue;
        }
        const [ax, ay] = a.plek ? [m(a.plek.x), m(a.plek.y)] : [huisDoos.x + huisDoos.b / 2, huisDoos.y + huisDoos.d];
        let best = null;
        for (const w of gevels(huisDoos)) {
          let l = Math.max(w.van + 0.6, Math.min(w.tot - 0.6, w.as === 'x' ? ax : ay));
          // Niet op een unit die er al staat (op dezelfde hoogte).
          for (const u of gebruikt) if (u.kant === w.kant && Math.abs(u.l - l) < 1.0 && Math.abs(u.z - hoog) < 0.8) l = Math.min(w.tot - 0.6, u.l + 1.0);
          const [px, py] = w.as === 'x' ? [l, w.vast] : [w.vast, l];
          const afst = Math.hypot(px - ax, py - ay) + (w.kant === 'voor' ? 3 : 0);
          if (!best || afst < best.afst) best = { x: px + w.n[0] * 0.02, y: py + w.n[1] * 0.02, n: w.n, kant: w.kant, l, afst, z: hoog };
        }
        if (!best) continue;
        gebruikt.push(best);
        units.push({ x: best.x, y: best.y, n: best.n, z: hoog, aan });
      }
    }
    /*
     * Eén boom in het seizoen, in de voortuin als die groot genoeg is: in de hoek die het verst ligt van het huis, de
     * oprit en de gebouwen, en minstens 1,2 meter van alles af (anders geen boom).
     */
    const bomen = [];
    /*
     * Ook in de achtertuin één boom als die groot genoeg is (22 november 2026, zoals in het poppenhuis), in de hoek die het
     * verst ligt van het huis, de gebouwen, het terras en de border.
     */
    const terras = plek('terras');
    const border = plek('border');
    const bezet = [
      ...(huisDoos ? [huisDoos] : []),
      ...gebouwen,
      ...(auto ? [auto] : []),
      ...[...(oprit ? [oprit] : []), ...terras, ...border].map((r) => ({ x: r.x0, y: r.y0, b: r.x1 - r.x0, d: r.y1 - r.y0 })),
    ];
    const afstTot = (x, y) => Math.min(...bezet.map((g) => Math.hypot(Math.max(g.x - x, 0, x - g.x - g.b), Math.max(g.y - y, 0, y - g.y - g.d))), 99);
    for (const { tuin, minB, minD, h, r } of [{ tuin: voortuin, minB: 2.6, minD: 3.2, h: 4.2, r: 1.1 }, { tuin: plek('achtertuin')[0], minB: 4, minD: 4, h: 5, r: 1.4 }]) {
      if (!tuin || tuin.x1 - tuin.x0 <= minB || tuin.y1 - tuin.y0 <= minD) continue;
      const hoeken = [[tuin.x0 + 1.3, tuin.y0 + 1.6], [tuin.x1 - 1.3, tuin.y0 + 1.6], [tuin.x0 + 1.3, tuin.y1 - 1.6], [tuin.x1 - 1.3, tuin.y1 - 1.6]];
      const [bx, by] = hoeken.sort((a, b) => afstTot(...b) - afstTot(...a))[0];
      if (afstTot(bx, by) >= 1.2) bomen.push({ x: bx, y: by, h, r });
    }
    const zon = model.zon ?? {};
    const panelen = [zon.panelen ? { aantal: zon.panelen, kant: 0 } : null, zon.panelenLinks ? { aantal: zon.panelenLinks, kant: 1 } : null].filter(Boolean);
    const tijd = model.tijd ?? 'dag';
    // Het weer en de feestdag (22 november 2026), zoals bij Weergave gekozen.
    const wg = global.app?.weergave?.() ?? {};
    const weer = wg.weer === false ? null : model.weer ?? null;
    const feest = wg.feestdagen === false ? null : model.feest !== undefined ? model.feest : global.huis?.feestdagVan?.(Date.now()) ?? null;
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
      hemel: { tijd, wolken: wg.weer === false ? 0 : model.wolken ?? 0 },
      weer,
      feest,
      ...(deur ? { voordeur: { x: deur.x, y: deur.y, n: muurDeur?.n ?? [0, -1] } } : {}),
      ...(panelenLabel ? { dakLabel: { titel: panelenLabel.titel, regels: panelenLabel.regels ?? [], toon: 'zon', dx: panelenLabel.dx ?? 60, dy: panelenLabel.dy ?? -80, tik: panelenLabel.tik, tikLabel: panelenLabel.tikLabel } } : {}),
      kamers,
      aan: [...aanSet],
      lampKleur,
      panelen,
      schermen,
      bomen,
      stroom,
      buiten: { erf, vlakken, gebouwen, apparaten, units, ...(auto ? { auto } : {}), ...(laadpaal ? { laadpaal } : {}) },
      rand: 36,
      huisDoos,
      // Tikken op de panelen opent Daken (zoals in het poppenhuis).
      ...(model.zon?.tik ? { panelenTik: model.zon.tik, panelenTikLabel: model.zon.tikLabel } : {}),
      ...extra,
    };
  }

  /*
   * De tuin ingekort (22 november 2026, Ricardo): op Thuis en het always-on display staat het huis groot, zoals in het
   * poppenhuis. Een lege strook tuin langer dan 2 meter tussen het huis en een gebouw (het tuinhuis 20 meter achterin)
   * wordt korter; het huis, de gebouwen, de auto en de bomen houden hun maat. Niet op schaal, wel alles in beeld; bij een
   * kamer buiten staat alles op ware afstand.
   */
  function kaartAs(bezet, huis, G = 2, c = 0.12) {
    const iv = bezet
      .filter(([a, b]) => b > a)
      .sort((p, q) => p[0] - q[0])
      .reduce((uit, [a, b]) => {
        const l = uit.at(-1);
        if (l && a <= l[1]) l[1] = Math.max(l[1], b);
        else uit.push([a, b]);
        return uit;
      }, []);
    const ih = iv.findIndex(([a, b]) => a <= huis[0] + 1e-6 && b >= huis[1] - 1e-6);
    if (ih < 0) return (t) => t;
    const pt = iv.map(([a, b]) => ({ a, b, s: 0 }));
    // Vanaf het huis naar buiten: elke lange tussenruimte schuift alles verderop dichterbij.
    for (let i = ih + 1; i < pt.length; i++) pt[i].s = pt[i - 1].s - Math.max(0, pt[i].a - pt[i - 1].b - G) * (1 - c);
    for (let i = ih - 1; i >= 0; i--) pt[i].s = pt[i + 1].s + Math.max(0, pt[i + 1].a - pt[i].b - G) * (1 - c);
    const kort = (gap) => (gap <= G ? gap : G + (gap - G) * c);
    return (t) => {
      if (t <= pt[0].a) return pt[0].a + pt[0].s - kort(pt[0].a - t);
      for (let i = 0; i < pt.length; i++) {
        const q = pt[i];
        if (t <= q.b) return t + q.s;
        const n = pt[i + 1];
        if (n && t < n.a) return q.b + q.s + ((t - q.b) / (n.a - q.b)) * (n.a + n.s - q.b - q.s);
      }
      const l = pt.at(-1);
      return l.b + l.s + kort(t - l.b);
    };
  }

  /** Buiten korter maken (zie kaartAs): het erf, de vlakken, de gebouwen, de auto, de apparaten, de bomen en de stroomlijn. */
  function tuinKorter(o, huisDoos) {
    const b = o.buiten;
    if (!b?.erf || !huisDoos) return o;
    const dozen = [...(b.gebouwen ?? []).filter((q) => !q.buur), ...(b.auto ? [b.auto] : [])];
    const fx = kaartAs([[huisDoos.x, huisDoos.x + huisDoos.b], ...dozen.map((q) => [q.x, q.x + q.b]), ...(o.bomen ?? []).map((t) => [t.x - (t.r ?? 1), t.x + (t.r ?? 1)])], [huisDoos.x, huisDoos.x + huisDoos.b]);
    const fy = kaartAs([[huisDoos.y, huisDoos.y + huisDoos.d], ...dozen.map((q) => [q.y, q.y + q.d]), ...(o.bomen ?? []).map((t) => [t.y - (t.r ?? 1), t.y + (t.r ?? 1)])], [huisDoos.y, huisDoos.y + huisDoos.d]);
    const doos = (q) => ({ ...q, x: fx(q.x), y: fy(q.y) });
    const punt = ([x, y, ...rest]) => [fx(x), fy(y), ...rest];
    const erf = { x: fx(b.erf.x), y: fy(b.erf.y) };
    erf.b = fx(b.erf.x + b.erf.b) - erf.x;
    erf.d = fy(b.erf.y + b.erf.d) - erf.y;
    o.buiten = {
      ...b,
      erf,
      vlakken: (b.vlakken ?? []).map((v) => ({ ...v, p: v.p.map(punt) })),
      gebouwen: (b.gebouwen ?? []).map((q) => (q.buur ? q : doos(q))),
      apparaten: (b.apparaten ?? []).map((a) => ({ ...a, ...(a.x != null ? { x: fx(a.x), y: fy(a.y) } : {}), ...(a.punten ? { punten: a.punten.map(punt) } : {}) })),
      units: (b.units ?? []).map((u) => ({ ...u, x: fx(u.x), y: fy(u.y) })),
      ...(b.laadpaal ? { laadpaal: { ...b.laadpaal, x: fx(b.laadpaal.x), y: fy(b.laadpaal.y) } } : {}),
      ...(b.auto ? { auto: doos(b.auto) } : {}),
    };
    o.bomen = (o.bomen ?? []).map((t) => ({ ...t, x: fx(t.x), y: fy(t.y) }));
    o.stroom = (o.stroom ?? []).map((st) => ({ ...st, pad: (st.pad ?? []).map((q) => (Array.isArray(q) ? [fx(q[0]), fy(q[1]), ...q.slice(2)] : q)) }));
    if (o.voordeur) o.voordeur = { ...o.voordeur, x: fx(o.voordeur.x), y: fy(o.voordeur.y) };
    return o;
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
    // 's Avonds de maan en de sterren, overdag de wolken (de zon staat op de boog) (22 november 2026, zoals in het poppenhuis).
    Object.assign(o, { stil: true, boven: 0, rand: 10, stroom: [], dakLabel: null, hemel: avond ? { tijd: 'nacht', wolken: o.hemel?.wolken ?? 0 } : { tijd: 'dag', wolken: o.hemel?.wolken ?? 0, geenZon: true } });
    if (avond) o.avond = true;
    const zon = model?.zon;
    const voorDeg = model?.voorgevelDeg ?? model?.kompas?.voorgevelDeg;
    // De baan van de zon kan uit bij Weergave (besluit 205).
    if (!avond && global.app?.weergave?.()?.zonnebaan !== false && zon?.nu && zon?.baan?.length && voorDeg != null) o.zonBoog = { nu: zon.nu, baan: zon.baan, voorDeg };
    return o;
  }

  global.huisOpties = { opties, tuinKorter, alsEtage, alsRust };
})(window);
