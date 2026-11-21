/*
 * De schets Thuis met de nieuwe tekenaar (20 november 2026, stap 4 punt 3:
 * één tekenaar voor het huis). Draait op de echte pagina Thuis van de dienst:
 * het huis komt uit de tekenaar van Je huis (op een verborgen Je huis in een
 * iframe) en wordt getekend door kit/huis-maat.js in plaats van het poppenhuis
 * (huis.js). Wat er nu in huis gebeurt (de temperaturen, wat aan staat, de
 * stroom) komt uit het model dat Thuis al maakt, en uit api/huis.
 *
 * Gebruik: in de pagina Thuis laden, met window.__stand op 'nu', 'avond' of
 * 'dag' (de avond met de lampen aan, de dag met de zon op de panelen). Zonder
 * eigen gegevens in de repo: de gegevens komen van de dienst die draait.
 *
 * Dit bestand wordt de koppeling in thuis.js als de schets is goedgekeurd. Het noemt geen apparaten
 * of lampen bij naam: alles komt uit Je huis en de dienst die draait.
 */
(function (global) {
  'use strict';
  const wacht = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const laad = (src) => new Promise((ok, fout) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = fout;
    document.head.append(s);
  });

  /** De tekenaar van Je huis, op een verborgen pagina Je huis. */
  async function tekenaarVanJeHuis() {
    const f = document.createElement('iframe');
    f.src = 'jehuis.html#bg/huis';
    f.style.cssText = 'position:fixed;left:-3000px;top:0;width:1280px;height:800px;visibility:hidden';
    document.body.append(f);
    for (let i = 0; i < 300; i++) {
      const t = f.contentWindow?.tekenaar;
      if (t && t.st?.vloeren && Object.keys(t.st.vloeren).length) return t;
      await wacht(100);
    }
    throw new Error('Je huis laadde niet');
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

  /** Wat de nieuwe tekenaar nodig heeft, uit de tekenaar van Je huis, het model van Thuis en api/huis. */
  function opties(t, model, huisApi, stand) {
    const K = global.huistekenen;
    const m = (c) => (c - K.MARGE) * K.CEL;
    // Wat aan staat: de lampen uit api/huis, de airco's uit het model.
    const aan = new Set();
    for (const e of huisApi.etages ?? []) for (const r of e.ruimtes ?? []) for (const a of r.apparaten ?? []) if (a.aan && typeof a.id === 'string') aan.add(a.id);
    // De stand van de screens (100 is open) en de lamp die bij een camera hoort, uit api/huis.
    const schermen = {};
    const lichtBij = {};
    for (const e of huisApi.etages ?? []) {
      for (const r of e.ruimtes ?? []) {
        for (const a of r.apparaten ?? []) {
          if (a.soort === 'screen' && typeof a.positiePct === 'number') schermen[a.id] = a.positiePct;
          if (a.soort === 'licht' && a.hoortBij) lichtBij[a.hoortBij] = a.id;
        }
      }
    }
    for (const e of model.etages ?? []) for (const k of e.kamers ?? []) for (const a of k.apparaten ?? []) if (a.soort === 'airco' && a.aan && a.naam) aan.add(a.naam);
    // De temperatuur en de stand per kamer, zoals Thuis ze toont.
    const kamers = {};
    for (const e of model.etages ?? []) {
      for (const k of e.kamers ?? []) {
        if (!k.temp && !k.stand) continue;
        kamers[k.id] = { temp: k.temp ?? undefined, ...(k.stand ? { zin: k.zin, toon: TOON[k.stand] ?? 'goed' } : {}) };
      }
    }
    // Buiten: het erf, de plekken als vlakken, de gebouwen erop.
    const erfE = t.huis.etages.find((e) => e.buiten);
    const vloer = erfE ? t.st.vloeren[erfE.id] : null;
    const erf = t.huis.erf ? { x: t.huis.erf.u, y: t.huis.erf.v, b: t.huis.erf.b, d: t.huis.erf.d } : null;
    const vlakken = [];
    const kamerSoort = (r) => {
      const k = t.huis.kamers.find((x) => x.id === r?.kamer);
      return k?.soort ?? '';
    };
    const rects = vloer ? rechthoeken(vloer, K) : [];
    const plek = (soort) => rects.filter((r) => kamerSoort(vloer.ruimtes[r.id]) === soort);
    for (const r of rects) {
      const soort = kamerSoort(vloer.ruimtes[r.id]);
      const grond = { oprit: 'oprit', voortuin: 'gras', tuin: 'gras', achtertuin: 'gras', terras: 'terras', border: 'border' }[soort];
      if (!grond) continue;
      vlakken.push({ soort: grond, p: [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]], ...(grond === 'terras' ? { meubels: true } : {}) });
    }
    // Op het terras één tafel: alleen op het grootste stuk.
    const terrassen = vlakken.filter((v) => v.soort === 'terras');
    terrassen.sort((a, b) => (b.p[2][0] - b.p[0][0]) * (b.p[2][1] - b.p[0][1]) - (a.p[2][0] - a.p[0][0]) * (a.p[2][1] - a.p[0][1]));
    terrassen.slice(1).forEach((v) => delete v.meubels);
    // De gebouwen op het erf op de maat zoals ze getekend zijn (de vakken op de vloer Buiten); het blok erbij kan ouder zijn.
    const blok = (id) => erfE?.blokken?.find((b) => b.id === id);
    const getekend = (soort, id) => {
      const r = plek(soort).sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0))[0];
      if (r) return { x: r.x0, y: r.y0, b: r.x1 - r.x0, d: r.y1 - r.y0 };
      const b = blok(id);
      return b ? { x: b.u, y: b.v, b: b.b, d: b.d } : null;
    };
    const gebouwen = [];
    const garage = getekend('garage', 'garage');
    if (garage) gebouwen.push({ ...garage, soort: 'garage', h: 2.7, naam: 'Garage' });
    // Een schuurtje of carport (uit de vaste lijst), als die in Je huis getekend is.
    for (const [soort, naam, h] of [['schuur', 'Schuurtje', 2.0], ['carport', 'Carport', 2.4]]) {
      const g = getekend(soort, soort);
      if (g) gebouwen.push({ ...g, soort, h, naam });
    }
    // Het tuinhuis met zijn lampen uit Je huis: een lamp met "overstek" in de naam is de lamp onder het overstek, de andere brandt binnen.
    const tuinhuis = getekend('tuinhuis', 'tuinhuis');
    const lampenTuinhuis = t.st.apparaten.filter((a) => a.soort === 'licht' && kamerSoort({ kamer: a.kamer }) === 'tuinhuis');
    const overstekLamp = lampenTuinhuis.find((a) => /overstek|veranda|buiten/i.test(a.naam ?? ''));
    const binnenLamp = lampenTuinhuis.find((a) => a !== overstekLamp);
    if (tuinhuis) gebouwen.push({ ...tuinhuis, soort: 'tuinhuis', h: 2.5, naam: 'Tuinhuis', overstek: { d: 1.2, licht: !!overstekLamp && aan.has(overstekLamp.id) }, licht: !!binnenLamp && aan.has(binnenLamp.id) });
    // Het huis van de buren (de andere helft), als schim tegen de muur.
    const hoofd = t.huis.etages.find((e) => e.id === (t.huis.beneden ?? 'bg'))?.blokken?.find((b) => b.soort === 'hoofdhuis');
    const buren = t.huis.woning?.buren ?? [];
    // De buren staan niet in de tekening: de muur tegen hen is gewoon dicht (rustiger dan een schim).
    void buren;
    // De auto op de oprit, met de neus naar de straat.
    const oprit = plek('oprit').sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0))[0];
    const auto = model.oprit?.auto && oprit ? { x: (oprit.x0 + oprit.x1) / 2 - 0.92, y: Math.max(oprit.y0 + 0.6, (garage?.y ?? oprit.y1) - 5.4), b: 1.84, d: 4.5, kleur: '#c9d4df' } : null;
    // Apparaten buiten: lampen, de deurbel, het zonnescherm, de lampjes in de border.
    const apparaten = [];
    for (const a of t.st.apparaten) {
      if (a.plek?.etage !== erfE?.id) continue;
      const [x, y] = [m(a.plek.x), m(a.plek.y)];
      const soort = kamerSoort({ kamer: a.kamer });
      if (a.soort === 'licht' && soort === 'border') {
        const b = plek('border')[0];
        if (b) {
          const lang = b.x1 - b.x0 >= b.y1 - b.y0;
          apparaten.push({ id: a.id, soort: 'snoer', punten: lang ? [[b.x0 + 0.2, (b.y0 + b.y1) / 2], [b.x1 - 0.2, (b.y0 + b.y1) / 2]] : [[(b.x0 + b.x1) / 2, b.y0 + 0.2], [(b.x0 + b.x1) / 2, b.y1 - 0.2]] });
        }
      } else if (a.soort === 'camera' && /deurbel/i.test(`${a.id} ${a.naam}`)) apparaten.push({ id: a.id, soort: 'deurbel', x, y, z: 1.4, n: [-1, 0] });
      else if (a.soort === 'camera') {
        // Een camera hangt aan een muur: aan een gebouw op het erf (de garage) als dat binnen een paar meter staat, anders aan het huis.
        const opErf = gebouwen.filter((g) => g.soort !== 'tuinhuis');
        const huisDoos = hoofd ? [{ x: hoofd.u, y: hoofd.v, b: hoofd.b, d: hoofd.d }] : [];
        let best = null;
        for (const g of [...opErf, ...huisDoos]) {
          if (best && huisDoos.includes(g)) break;
          const kx = Math.max(g.x, Math.min(g.x + g.b, x));
          const ky = Math.max(g.y, Math.min(g.y + g.d, y));
          const afst = Math.hypot(kx - x, ky - y);
          if (afst > 4.5 || (best && afst >= best.afst)) continue;
          // Op welke muur: de kant waar de camera vandaan komt.
          const binnen = kx > g.x && kx < g.x + g.b && ky > g.y && ky < g.y + g.d;
          const kant = binnen ? null : ky <= g.y ? [0, -1] : ky >= g.y + g.d ? [0, 1] : kx <= g.x ? [-1, 0] : [1, 0];
          if (!kant) continue;
          const [px, py] = kant[1] ? [Math.max(g.x + 0.3, Math.min(g.x + g.b - 0.3, kx)), ky] : [kx, Math.max(g.y + 0.3, Math.min(g.y + g.d - 0.3, ky))];
          best = { afst, x: px, y: py, n: kant };
        }
        apparaten.push({ id: a.id, soort: 'camera', x: best?.x ?? x, y: best?.y ?? y, n: best?.n ?? [0, -1], z: 2.4, licht: lichtBij[a.id] });
      }
      else if (a.soort === 'screen') apparaten.push({ id: a.id, soort: 'screen', x, y: Math.min(y, (hoofd?.v ?? 0) + (hoofd?.d ?? 0) + 0.02), z: 2.5, b: 3.4, uit: [0, 1] });
    }
    // De stroom van het net (Ricardo, 20 november 2026): vanaf de straat langs de rand van voortuin en oprit naar de voordeur.
    const stroom = [];
    const bgV = t.st.vloeren[t.huis.beneden ?? 'bg'];
    const net = (model.stromen ?? []).find((x) => x.van === 'net');
    const label = (model.labels ?? []).find((l) => l.bij === 'net')?.titel;
    const deurbel = apparaten.find((a) => a.soort === 'deurbel');
    const halId = bgV ? Object.entries(bgV.ruimtes).find(([, r]) => r.kamer === 'hal')?.[0] : null;
    const halR = halId ? K.maten(bgV)[halId]?.r : null;
    const deurY = deurbel?.y ?? (halR ? m((halR.y0 + halR.y1) / 2) : null);
    const voortuin0 = plek('voortuin')[0];
    if (net && erf && hoofd && deurY != null) {
      const rand = (voortuin0?.x0 ?? hoofd.u) - 0.08;
      stroom.push({ toon: 'violet', label, dx: -(String(label ?? '').length * 7.6 + 40), dy: 16, pad: [[rand, erf.y - 1.0, 0.05], [rand, deurY, 0.05], [hoofd.u + 0.15, deurY, 0.05]] });
    }
    // De buitenunits van de airco's (geschat): de eerste tegen de zijgevel, een tweede tegen de achtergevel; aan als zijn airco draait.
    const units = [];
    const aircos = t.st.apparaten.filter((a) => a.soort === 'airco');
    if (hoofd && model.buitenunit?.aantal) {
      const achter = hoofd.v + hoofd.d;
      units.push({ x: hoofd.u - 0.05, y: hoofd.v + 2.4, n: [-1, 0], aan: !!aircos[0] && aan.has(aircos[0].id), airco: aircos[0]?.id });
      if (model.buitenunit.aantal > 1) units.push({ x: hoofd.u + hoofd.b - 1.0, y: achter + 0.02, n: [0, 1], aan: !!aircos[1] && aan.has(aircos[1].id), airco: aircos[1]?.id });
    }
    // Eén boom in het seizoen, in de voortuin (achterin staat het tuinhuis tegen de erfgrens).
    const bomen = voortuin0 ? [{ x: voortuin0.x1 - 1.3, y: voortuin0.y0 + 1.6, h: 4.2, r: 1.1 }] : [];
    const zon = model.zon ?? {};
    const panelen = [zon.panelen ? { aantal: zon.panelen, kant: 0 } : null, zon.panelenLinks ? { aantal: zon.panelenLinks, kant: 1 } : null].filter(Boolean);
    const tijd = model.tijd ?? 'dag';
    const o = {
      hoek: global.__hoek ?? -58,
      hoogte: global.__hoogte ?? 27,
      lucht: global.__lucht ?? 0,
      seizoen: model.seizoen ?? 'herfst',
      avond: tijd === 'avond' || tijd === 'nacht',
      hemel: { tijd, wolken: model.wolken ?? 0 },
      kamers,
      aan: [...aan],
      panelen,
      schermen,
      bomen,
      stroom,
      buiten: { erf, vlakken, gebouwen, apparaten, units, ...(auto ? { auto } : {}) },
      rand: 36,
      // Boven blijft ruimte voor de kop en de zin eronder, zodat bomen en dak er niet doorheen lopen.
      ...(global.__passend ? { passend: global.__passend, boven: global.__passend === 'dichtbij' ? 150 : 90 } : { boven: 90 }),
    };
    // De avond (nagespeeld): in elke kamer en buiten de eerste lamp aan.
    if (stand === 'avond') {
      o.avond = true;
      const perKamer = new Map();
      for (const a of t.st.apparaten) if (a.soort === 'licht' && a.kamer && !perKamer.has(a.kamer)) perKamer.set(a.kamer, a.id);
      o.aan.push(...perKamer.values());
      const th = o.buiten.gebouwen.find((g) => g.naam === 'Tuinhuis');
      if (th) Object.assign(th, { licht: true, overstek: { ...th.overstek, licht: true } });
    }
    // De dag: de zon op de panelen, de stroom van het dak naar het huis, de airco op zolder op zon.
    if (stand === 'dag') {
      o.hemel = { tijd: 'dag', wolken: 0.1 };
      // De lucht van de pagina zelf ook naar de dag.
      const lucht = global.app?.lucht ?? global.lucht;
      if (typeof lucht === 'function') lucht('dag', model.seizoen, 0.1);
      o.avond = false;
      // Nagespeeld: de lampen uit, de laatste airco verwarmt op zon, het zonnescherm uit.
      const lampen = new Set(t.st.apparaten.filter((a) => a.soort === 'licht').map((a) => a.id));
      o.aan = o.aan.filter((id) => !lampen.has(id));
      const opZon = aircos[aircos.length - 1];
      if (opZon) {
        o.aan.push(opZon.id);
        if (o.kamers[opZon.kamer]) Object.assign(o.kamers[opZon.kamer], { zin: 'verwarmt op zon', toon: 'zon' });
      }
      for (const a of t.st.apparaten) if (a.soort === 'screen' && a.plek?.etage === erfE?.id) o.aan.push(a.id);
      // Alleen het label bij de panelen: een lijn dwars door het huis naar de grond las als iets dat zweeft.
      if (hoofd) o.stroom = [{ toon: 'zon', label: '1,8 kW van je panelen', dx: 30, dy: -80, pad: [[hoofd.u + hoofd.b * 0.5, hoofd.v + 2.2, 6.6], [hoofd.u + hoofd.b * 0.5 + 0.01, hoofd.v + 2.2, 6.6]] }];
      for (const u of o.buiten.units) u.aan = true;
      // Nagespeeld: de screens voor de zithoek grotendeels neer tegen de zon (35% open).
      for (const id of Object.keys(o.schermen)) o.schermen[id] = 35;
    }
    return o;
  }

  /**
   * De kamerpagina (20 november 2026): één etage los, met meubels. Een kamer binnen toont zijn etage dichtbij;
   * een plek buiten toont de begane grond met het hele erf. Boven de begane grond staat alleen de etage op de grond.
   */
  function alsEtage(o, t, huisApi) {
    const kamerId = decodeURIComponent(location.hash.slice(1).split('/')[0]);
    const e = (huisApi.etages ?? []).find((x) => (x.ruimtes ?? []).some((r) => r.id === kamerId));
    const beneden = t.huis.beneden ?? 'bg';
    const buiten = !e || e.id === 'buiten' || !t.huis.etages.some((x) => x.id === e.id && !x.buiten);
    const etage = buiten ? beneden : e.id;
    Object.assign(o, { etage, meubels: true, boven: 0, rand: 16, lucht: 0, stroom: [], gekozen: kamerId });
    if (buiten) {
      delete o.passend;
      return o;
    }
    // Een etage binnen (Ricardo, 21 november 2026): alleen de etage, zonder garage, auto of tuin; boven de begane grond zonder grond eronder.
    Object.assign(o, { passend: 'huis', buiten: {}, bomen: [], geenEiland: etage !== beneden });
    return o;
  }

  /** Het always-on display (besluit 168): het hele huis zonder getallen; 's avonds donker, zonder stromen of hemel. */
  function alsRust(o, avond, model) {
    Object.assign(o, { stil: true, boven: 0, rand: 10, stroom: [], hemel: null });
    delete o.passend;
    if (avond) o.avond = true;
    // Overdag de zonneboog om het huis (Ricardo, 21 november 2026), zoals de ring van de zon in het poppenhuis.
    const zon = model?.zon;
    const voorDeg = model?.voorgevelDeg ?? model?.kompas?.voorgevelDeg;
    if (!avond && zon?.nu && zon?.baan?.length && voorDeg != null) o.zonBoog = { nu: zon.nu, baan: zon.baan, voorDeg };
    return o;
  }

  async function start() {
    if (!global.huistekenen) await laad('kit/huistekenen.js');
    await laad(`kit/huis-modellen.js?${Date.now()}`);
    await laad(`kit/huis-maat.js?${Date.now()}`);
    const t = await tekenaarVanJeHuis();
    const huisApi = await (await fetch('api/huis')).json();
    const stand = global.__stand ?? 'nu';
    const oud = global.huis.teken;
    global.huis.teken = (el, model, opts) => {
      // Alleen het huis op de wand; de telefoon later.
      if (el?.id === 'podium-tel') return oud(el, model, opts);
      global.__laatsteModel = model;
      const B = Math.round(opts?.breedte ?? el.clientWidth ?? 860);
      const H = Math.round(opts?.hoogte ?? 612);
      const o = opties(t, model, huisApi, stand);
      if (/kamer\.html/.test(location.pathname)) alsEtage(o, t, huisApi);
      else if (el.closest?.('.sc-niemand-laag, [data-nk-huis]') || el.matches?.('[data-nk-huis]')) alsRust(o, global.niemand?.toont === 'avond', model);
      const uit = global.huisMaat.teken(t, B, H, o);
      el.innerHTML = `<svg viewBox="0 0 ${B} ${H}" width="${B}" height="${H}" role="img" aria-label="Je huis">${uit.svg}</svg>`;
    };
    // Meten (voor de vraag of draaien met de vinger licht genoeg is): n keer tekenen, elke keer een andere hoek.
    global.thuisNieuw.meet = (n = 40) => {
      const model = global.__laatsteModel;
      const o = opties(t, model, huisApi, stand);
      const t0 = performance.now();
      for (let i = 0; i < n; i++) global.huisMaat.teken(t, 860, 612, { ...o, hoek: -90 + (i * 180) / n });
      return (performance.now() - t0) / n;
    };
    global.__nieuwKlaar = true;
  }

  global.thuisNieuw = { start, opties };
})(window);
