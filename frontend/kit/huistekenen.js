/*
 * SunArc: je huis tekenen (schets, 11 november 2026).
 *
 * Opnieuw ontworpen na Je huis 0.158-0.162 (besluit 288, teruggedraaid in
 * 0.163.0). Wat er anders is:
 *
 * - Een etage is ruitjespapier van 10 cm. Elk ruitje hoort bij één ruimte of
 *   ligt buiten. Er is dus nooit een gat of een overlap, en een ruimte mag elke
 *   rechte vorm hebben (een L, een U). De oude boom van lijnen is weg: een muur
 *   schuiven verandert alleen de twee ruimtes ernaast.
 * - Eén manier van tekenen: trek een vak met je vinger (een nieuwe ruimte), pak
 *   een muur om hem te schuiven, tik iets aan om te zeggen wat het is.
 * - Alles gaat via één luisteraar op de tekening zelf, die de vinger vasthoudt
 *   (`setPointerCapture`, `touch-action: none`). Wat je raakt rekent de motor
 *   uit de meters, niet uit het element onder je vinger. Tijdens het slepen
 *   blijft de tekening staan; er wordt niets bewaard tot je loslaat.
 * - Een apparaat hoeft geen plek: zonder plek kiest de tekening er een die bij
 *   de soort past (airco aan de achterwand, screen aan de gevel, lamp in het
 *   midden). Verplaatsen kan, en bij een muur klikt het vast.
 *
 * Gebruik: huistekenen.maak(svg, huis, opties) geeft de tekenaar;
 * huistekenen.paneel(el, tekenaar) en huistekenen.stapel(el, tekenaar) vullen
 * het blad ernaast en de etages. De assen: x naar rechts langs de voorgevel,
 * y van de straat naar achter, in ruitjes.
 *
 * Sinds besluit 308 (stap 1) staat de motor in frontend/kit: de app (Je huis)
 * en de schetsen in design/app2 gebruiken hetzelfde bestand. De teksten staan
 * in teksten.nl.js en teksten.en.js onder `ht.`. Bewaren gaat in de app via
 * `opties.opslaan` (de dienst), in de schets via `opties.bewaar` (de browser);
 * `opties.tekening` is wat er al bewaard was, in meters (`t.uitvoer()`).
 */
(function (global) {
  'use strict';
  // De vaste waarden en losse rekenfuncties staan in kit/huistekenen-vloer.js (opgesplitst op 22 november 2026).
  const { CEL, BUITEN, MARGE, MIN, FONT, esc, T, nl, meter, klem, ik, TINT, SOORT_TINT, APP_KLEUR, APP_ICOON, nieuweVloer, vulRecht, kopie, zoneStukken, ordenen, randen, isMuur, lijnPad, OPENING_BREED, OPENING_SOORTEN, MET_SCHARNIER, richtingVan, openingMuur, openingBinnen, TRAP_RICHTING, muurDelen, vlakPaden, maten, omtrek, muurRuimte, muurNaar, indelingen, vloerUitIndeling, inpakken, uitpakken, m1, vloerNaarMeters, vloerUitMeters, klein } = global.htVloer;
  // Uit kit/huistekenen-blad.js (opgesplitst op 22 november 2026).
  const { paneel, stapel, strook, uitleg } = global.htBlad;

  /* ================================================================ de tekenaar */

  /**
   * huis: { maat: {breed, diep}, etages: [{id, naam, kort, blokken: [{id, soort, naam, u, v, b, d}]}] van boven naar beneden,
   *         kamers: [{id, naam, soort, etage}], apparaten: [{id, naam, soort, kamer, ha}], verborgen: hoeveel apparaten verborgen zijn,
   *         begin: { etage: [boom per blok] } }
   */
  function maak(svg, huis, opties = {}) {
    const kamers = Object.fromEntries(huis.kamers.map((k) => [k.id, k]));
    /** Deuren, ramen, screens aan een raam en een trap met een richting (schets, nog niet in de dienst). */
    const metOpeningen = !!opties.openingen;
    const st = {
      stand: opties.stand ?? 'kamers',
      etage: opties.etage ?? huis.etages[huis.etages.length - 1].id,
      vloeren: {},
      apparaten: JSON.parse(JSON.stringify(huis.apparaten)),
      kies: null,
      /** Stap 3 (17 november 2026): een blad van de indeling, zolang er niets gekozen is: etage, buiten of verborgen. */
      blad: null,
      wapen: null,
      zoom: null,
      terug: [],
      vooruit: [],
      bewaard: true,
      bron: huis.bronnen ? (huis.bron ?? Object.keys(huis.bronnen)[0]) : null,
      hoek: 28,
      dicht: false,
    };
    /** De gebouwen van de gekozen bron: beneden allemaal, erboven alleen het hoofdhuis. */
    /** De gebouwen van de kaart eromheen (bij Vorm, om aan te wijzen), en de gebouwen naast het hoofdhuis. */
    const omgeving = () => huis.bronnen?.[st.bron]?.omgeving ?? [];
    const bijBlokken = () => (huis.bronnen?.[st.bron]?.blokken ?? []).filter((b) => b.soort !== 'hoofdhuis');
    const binnen = (pp, x, y) => {
      let erin = false;
      for (let i = 0, j = pp.length - 1; i < pp.length; j = i++) {
        const [xi, yi] = pp[i];
        const [xj, yj] = pp[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) erin = !erin;
      }
      return erin;
    };
    /** Wat er bij Vorm onder de vinger ligt: een gebouw dat erbij hoort (niet het hoofdhuis), of een grijs gebouw van de kaart. */
    const gebouwOp = (cx, cy) => {
      const [x, y] = [(cx - MARGE) * CEL, (cy - MARGE) * CEL];
      // Het afdak voor het huis (ronde 2): een eigen stuk om aan te tikken, op de begane grond.
      const af = st.etage === benedenId() ? afdakVak() : null;
      if (af && x >= af.u0 && x <= af.u1 && y >= af.v0 && y <= af.v1) return { soort: 'afdak' };
      const b = bijBlokken().find((q) => x >= q.u && x <= q.u + q.b && y >= q.v && y <= q.v + q.d);
      if (b) return { soort: 'blok', id: b.id };
      const o = omgeving().find((q) => binnen(q.punten, x, y));
      return o ? { soort: 'omgeving', i: o.i } : null;
    };
    /*
     * Buiten (19 november 2026): wat los in de tuin staat (een tuinhuis, een
     * carport, iets anders, en de garage als die niet binnen hoort) ligt op het
     * erf en niet meer op de begane grond. Het huis ligt op het erf als één vast vak.
     */
    const losBuiten = (x) => ['tuinhuis', 'carport', 'anders'].includes(x.soort) || (x.soort === 'garage' && !huis.garageBinnen);
    /*
     * Bij Vorm op de begane grond (Ricardo, 20 november 2026: "zodra ik de
     * garage of schuur toewijs verdwijnen ze"): wat op het erf staat, blijft
     * te zien met zijn naam en "bij Buiten"; een tik brengt je daarheen.
     */
    const opErfBlokken = () => (etageVan(st.etage)?.buiten || !huis.etages.some((e) => e.buiten) ? [] : bijBlokken().filter((x) => losBuiten(x)));
    const zetBlokken = () => {
      const b = huis.bronnen?.[st.bron];
      if (!b) return;
      // De begane grond (`huis.beneden`, anders de onderste) krijgt alle gebouwen; een kelder en de etages erboven alleen het hoofdhuis.
      const beneden = huis.beneden ?? huis.etages.filter((e) => !e.buiten).at(-1)?.id;
      const metErf = huis.etages.some((e) => e.buiten);
      huis.etages.forEach((e) => (e.blokken = e.buiten ? [...(huis.erf ? [huis.erf] : []), ...b.blokken] : b.blokken.filter((x) => x.soort === 'hoofdhuis' || (e.id === beneden && !(metErf && losBuiten(x))))));
      // Het afdak hoort alleen bij de begane grond (Ricardo, 20 november 2026): de etages erboven lopen zoveel minder ver.
      for (const e of boven(beneden)) e.blokken = e.blokken.map((x) => (x.soort === 'hoofdhuis' && x.afdak ? zonderAfdak(x) : x));
    };
    const rond = (n) => Math.round(n * 10) / 10;
    /** De etages boven de begane grond (niet buiten, niet een kelder eronder). */
    const boven = (beneden) => {
      const binnen = huis.etages.filter((e) => !e.buiten);
      const ib = binnen.findIndex((e) => e.id === beneden);
      return ib > 0 ? binnen.slice(0, ib) : [];
    };
    /** Het hoofdhuis zonder de strook van het afdak, voor de etages erboven. */
    const zonderAfdak = (x) => {
      const a = x.afdak;
      const { afdak: _a, ...rest } = x;
      return a.kant === 'voor' ? { ...rest, v: rond(x.v + a.diep), d: rond(x.d - a.diep) } : { ...rest, d: rond(x.d - a.diep) };
    };
    /**
     * Wat op een etage boven het afdak getekend stond in de strook van het afdak, gaat de strook uit
     * (20 november 2026): de vakken worden korter (of vallen weg), een deur of raam in de gevel gaat
     * mee naar de nieuwe gevel, een apparaat schuift net naar binnen. In meters, zoals bewaard.
     */
    const afdakUitBoven = (bewaarde) => {
      const h = (huis.bronnen?.[st.bron]?.blokken ?? []).find((x) => x.soort === 'hoofdhuis' && x.afdak);
      if (!h || !bewaarde) return;
      const beneden = huis.beneden ?? huis.etages.filter((e) => !e.buiten).at(-1)?.id;
      const voor = h.afdak.kant === 'voor';
      const [s0, s1] = voor ? [h.v, rond(h.v + h.afdak.diep)] : [rond(h.v + h.d - h.afdak.diep), h.v + h.d];
      const rand = voor ? s1 : s0;
      for (const e of boven(beneden)) {
        const lijst = bewaarde.tekening?.[e.id];
        if (lijst) {
          bewaarde.tekening[e.id] = lijst.map((r) => ({
            ...r,
            vakken: (r.vakken ?? []).flatMap(([x, y, b, d]) => {
              const [y0, y1] = voor ? [Math.max(y, s1), y + d] : [y, Math.min(y + d, s0)];
              return y1 - y0 < 0.05 ? [] : [[x, rond(y0), b, rond(y1 - y0)]];
            }),
          }));
        }
        const op = bewaarde.openingen?.[e.id];
        if (op) {
          /*
           * `as: 'v'` ligt op een vaste v (de voor- of achtergevel), met van/tot langs u; `as: 'u'` op een vaste u (een
           * zijgevel), met van/tot langs v. Tot 22 november 2026 stond dat andersom: dan knipte het laden elk raam in de
           * voorgevel bij met de diepte van het afdak, en viel een raam aan de linkerkant (de badkamer van Ricardo) weg.
           */
          bewaarde.openingen[e.id] = op.flatMap((o) => {
            // Een deur of raam in de gevel van het afdak: naar de nieuwe gevel.
            if (o.as === 'v' && o.op >= s0 - 0.05 && o.op <= s1 + 0.05) return [{ ...o, op: rand }];
            // In een zijgevel: alleen het stuk buiten de strook van het afdak blijft.
            if (o.as === 'u') {
              const [van, tot] = voor ? [Math.max(o.van, s1), o.tot] : [o.van, Math.min(o.tot, s0)];
              if (van === o.van && tot === o.tot) return [o];
              return tot - van < 0.3 ? [] : [{ ...o, van: rond(van), tot: rond(tot) }];
            }
            return [o];
          });
        }
        for (const [id, pl] of Object.entries(bewaarde.plekken ?? {})) {
          if (pl?.etage !== e.id || pl.v < s0 || pl.v > s1) continue;
          bewaarde.plekken[id] = { ...pl, v: voor ? rond(s1 + 0.2) : rond(s0 - 0.2) };
        }
      }
    };
    zetBlokken();
    /* ---------- het dak en de dakkapellen (stap 4 punt 3, Je huis › Dak, schets Wand-Huis-Dakkapel) */
    const hoofdBlok = () => (huis.bronnen?.[st.bron]?.blokken ?? []).find((b) => b.soort === 'hoofdhuis') ?? null;
    /* ---------- wat de kaarten vinden (ronde 2, 20 november 2026, schets Wand-Huis-Kaarten) */
    const benedenId = () => huis.beneden ?? huis.etages.filter((e) => !e.buiten).at(-1)?.id;
    /** Het afdak voor of achter het hoofdhuis, in meters op het papier; alleen als de 3D-kaart het zag. */
    const afdakVak = () => {
      const b = hoofdBlok();
      const a = b?.afdak;
      if (!a) return null;
      return { a, u0: b.u, u1: b.u + b.b, v0: a.kant === 'voor' ? b.v : b.v + b.d - a.diep, v1: a.kant === 'voor' ? b.v + a.diep : b.v + b.d };
    };
    /** Het label Nieuw staat bij het afdak tot de bewoner het zag (aantikte). */
    const afdakSleutel = (a) => `${a.kant}:${a.diep}`;
    const afdakGezien = () => {
      const a = afdakVak()?.a;
      if (!a) return true;
      try {
        return localStorage.getItem('sc-afdak-gezien') === afdakSleutel(a);
      } catch {
        return false;
      }
    };
    const afdakZie = () => {
      const a = afdakVak()?.a;
      if (!a) return;
      try {
        localStorage.setItem('sc-afdak-gezien', afdakSleutel(a));
      } catch {
        // Zonder opslag staat Nieuw er de volgende keer weer.
      }
    };
    /** Een gebouw op maat: wat de vinger nu trekt, of de maat van de bron. */
    const maatVan = (b) => (b && st.blokMaat?.id === b.id ? { ...b, ...st.blokMaat } : b);
    /** De stippen van een gekozen gebouw bij Vorm: de hoeken, en midden op een muur als die lang genoeg is. */
    const blokGrepen = () => {
      if (st.stand !== 'vorm' || st.kies?.soort !== 'blok' || !opties.gebouw || huis.kijk?.bezig) return [];
      const b = maatVan(bijBlokken().find((q) => q.id === st.kies.id));
      if (!b) return [];
      const [x0, y0, x1, y1] = [X(MARGE + b.u / CEL), Y(MARGE + b.v / CEL), X(MARGE + (b.u + b.b) / CEL), Y(MARGE + (b.v + b.d) / CEL)];
      const uit = [];
      for (const ku of [-1, 0, 1]) {
        for (const kv of [-1, 0, 1]) {
          if ((!ku && !kv) || (!ku && Math.abs(x1 - x0) < 70) || (!kv && Math.abs(y1 - y0) < 70)) continue;
          uit.push({ ku, kv, px: ku < 0 ? x0 : ku > 0 ? x1 : (x0 + x1) / 2, py: kv < 0 ? y0 : kv > 0 ? y1 : (y0 + y1) / 2 });
        }
      }
      return uit;
    };
    /** De nieuwe maat bewaren (na het loslaten meteen, na min en plus even wachten): de pagina bewaart en laadt opnieuw. */
    let maatKlok = null;
    const blokMaatBewaar = (ms) => {
      clearTimeout(maatKlok);
      maatKlok = setTimeout(() => {
        const m = st.blokMaat;
        const h = hoofdBlok();
        if (!m || !h || !opties.gebouw) return;
        st.gebouwBezig = true;
        meld();
        Promise.resolve(opties.gebouw({ maat: m.id, vak: { u: rond(m.u - h.u), v: rond(m.v - h.v), b: m.b, d: m.d } })).finally(() => {
          st.gebouwBezig = false;
          meld();
        });
      }, ms);
    };
    /**
     * De muren van het hoofdhuis tegen de buren (schets Wand-Huis-Woning, 20
     * november 2026), als muurlijnen in rastercellen: links, rechts en achter,
     * van de straat af gezien. Buiten en zonder hoofdhuis: geen.
     */
    const buurMuren = () => {
      // Het hoofdhuis zoals deze etage het heeft: boven het afdak korter (20 november 2026).
      const h = etageVan(st.etage)?.blokken?.find((x) => x.soort === 'hoofdhuis') ?? hoofdBlok();
      const kanten = huis.woning?.soort === 'vrijstaand' ? [] : (huis.woning?.buren ?? []);
      if (!h || !kanten.length || etageVan(st.etage)?.buiten) return [];
      const x0 = MARGE + h.u / CEL;
      const x1 = MARGE + (h.u + h.b) / CEL;
      const y0 = MARGE + h.v / CEL;
      const y1 = MARGE + (h.v + h.d) / CEL;
      return kanten.map((k) => (k === 'links' ? { as: 'x', op: x0, van: y0, tot: y1 } : k === 'rechts' ? { as: 'x', op: x1, van: y0, tot: y1 } : { as: 'y', op: y1, van: x0, tot: x1 }));
    };
    /** Ligt een muur op een muur tegen de buren? Dan komt er geen raam of voordeur. */
    const opBuurMuur = (run) => buurMuren().some((b) => b.as === run.as && Math.abs(b.op - run.op) <= 2 && Math.min(b.tot, run.tot) - Math.max(b.van, run.van) > 3);
    /** De etage onder het dak (de zolder), anders de bovenste. */
    const dakEtage = () => huis.etages.find((e) => e.dak && !e.buiten)?.id ?? huis.etages.find((e) => !e.buiten)?.id ?? null;
    /** De dakkapellen van het blok als die van de bewoner: kant, van..tot langs de nok, diep vanaf de goot, en de etage. */
    const kapelsVan = (b) => (b?.dakkapellen ?? []).map((k) => ({ kant: k.kant, van: k.van, tot: k.tot, diep: Math.max(0.5, Math.round((k.achter - k.voor) * 10) / 10), etage: k.etage ?? null }));
    st.kapellen = kapelsVan(hoofdBlok());
    /**
     * Het dak van het hoofdhuis in meters: `a` loopt langs de nok, `c` er
     * dwars op (kant 0 is de kant met de kleinste c: voor of links). Met de
     * goot van elke kant, de nok en hoe ver de nok van elke goot ligt. Null bij
     * een plat dak.
     */
    const dakMaat = () => {
      const b = hoofdBlok();
      if (!b || !b.dak || b.dak === 'plat') return null;
      const langs = b.nokLangs === 'y';
      const [a0, la, c0, lc] = langs ? [b.v, b.d, b.u, b.b] : [b.u, b.b, b.v, b.d];
      const naar0 = b.nokVan0 ?? lc / 2;
      return { b, langs, a0, la, c0, lc, naar: [naar0, lc - naar0], goot: [b.goot0 ?? b.goot1 ?? 3, b.goot1 ?? b.goot0 ?? 3], nok: b.nok ?? 8 };
    };
    /** Hoe hoog de vloer van een etage ligt: de etages eronder bij elkaar. */
    const vloerHoogte = (id) => {
      const lijst = huis.etages.filter((e) => !e.buiten);
      const i = lijst.findIndex((e) => e.id === id);
      return i < 0 ? 0 : lijst.slice(i + 1).reduce((t, e) => t + (e.hoogte ?? 2.6), 0);
    };
    /** Per kant hoe ver vanaf de goot het dak lager is dan 1,5 m boven de vloer van deze etage. */
    const laagStrook = (id) => {
      const m = dakMaat();
      if (!m) return [0, 0];
      const z = vloerHoogte(id) + 1.5;
      return [0, 1].map((k) => {
        const helling = (m.nok - m.goot[k]) / Math.max(0.1, m.naar[k]);
        return helling <= 0 ? 0 : Math.max(0, Math.min(m.naar[k], (z - m.goot[k]) / helling));
      });
    };
    /** De etages waar een dakkapel op kan: onder het schuine dak (een strook van minstens 20 cm). */
    const kapelEtages = () => (dakMaat() ? huis.etages.filter((e) => !e.buiten && (e.id === dakEtage() || Math.max(...laagStrook(e.id)) >= 0.2)).map((e) => e.id) : []);
    /** Waar een dakkapel ligt, in meters op het papier. */
    const kapelRecht = (k, m) => {
      const a = [m.a0 + k.van, m.a0 + k.tot];
      const c = k.kant === 0 ? [m.c0 + 0.3, m.c0 + 0.3 + k.diep] : [m.c0 + m.lc - 0.3 - k.diep, m.c0 + m.lc - 0.3];
      return m.langs ? { u0: c[0], u1: c[1], v0: a[0], v1: a[1] } : { u0: a[0], u1: a[1], v0: c[0], v1: c[1] };
    };
    const opDezeEtage = () => st.kapellen.map((k, i) => ({ k, i })).filter(({ k }) => (k.etage ?? dakEtage()) === st.etage);
    /** Na elke verandering: het blok (voor Huis in 3D) en de dienst. */
    const kapelBewaar = () => {
      const b = hoofdBlok();
      if (b) {
        b.dakkapellen = st.kapellen.map((k) => ({ kant: k.kant, van: k.van, tot: k.tot, voor: 0.3, achter: Math.round((0.3 + k.diep) * 10) / 10, ...(k.etage ? { etage: k.etage } : {}) }));
        b.kapelBron = 'bewoner';
        delete b.kapelVraag;
      }
      opties.kapel?.(st.kapellen.map((k) => ({ kant: k.kant, van: k.van, tot: k.tot, diep: k.diep, ...(k.etage ? { etage: k.etage } : {}) })));
    };
    const r1 = (n) => Math.round(n * 10) / 10;
    let luisteraars = [];
    const meld = () => luisteraars.forEach((f) => f());

    /* ---------- begin: uit de browser, of de eerste indeling */
    const sleutel = opties.bewaar ?? null;
    const begin = () => {
      for (const e of huis.etages) {
        const boom = huis.begin?.[e.id];
        st.vloeren[e.id] = boom ? vloerUitIndeling(huis.maat, e.blokken, boom) : nieuweVloer(huis.maat, e.blokken);
      }
      st.apparaten = JSON.parse(JSON.stringify(huis.apparaten));
    };
    begin();
    // Wat er in de dienst bewaard was (besluit 308): per etage de ruimtes in meters, de zonelijnen en de plekken.
    const bewaarde = opties.tekening;
    afdakUitBoven(bewaarde);
    if (bewaarde?.tekening) {
      // Getekend op de bron van nu: de buitenmuur van de tekening telt. Een andere bron: de ruimtes vallen op de nieuwe vorm.
      const eigen = !bewaarde.tekeningBron || bewaarde.tekeningBron === st.bron;
      for (const e of huis.etages) if (bewaarde.tekening[e.id]?.length) st.vloeren[e.id] = vloerUitMeters(huis.maat, e.blokken, bewaarde.tekening[e.id], bewaarde.zones, eigen);
    }
    if (bewaarde?.plekken) {
      for (const a of st.apparaten) {
        const p = bewaarde.plekken[a.id];
        if (p && st.vloeren[p.etage]) a.plek = { etage: p.etage, x: MARGE + p.u / CEL, y: MARGE + p.v / CEL };
      }
    }
    // De deuren en ramen (0.187.0): u is x, v is y; en welk screen voor welk raam hangt.
    const celVan = (meter) => MARGE + Math.round(meter / CEL);
    if (bewaarde?.openingen) {
      for (const [etage, lijst] of Object.entries(bewaarde.openingen)) {
        if (!st.vloeren[etage]) continue;
        st.vloeren[etage].openingen = lijst.map((o) => ({ id: o.id, soort: o.soort, as: o.as === 'u' ? 'x' : 'y', op: celVan(o.op), van: celVan(o.van), tot: celVan(o.tot), ...richtingVan(o) }));
      }
    }
    if (bewaarde?.ramen) for (const a of st.apparaten) if (bewaarde.ramen[a.id] && a.plek) a.raam = bewaarde.ramen[a.id];
    /** De hele tekening in meters, zoals de dienst hem bewaart. */
    const uitvoer = () => {
      herstelErf();
      const tekening = {};
      const zones = {};
      for (const [etage, v] of Object.entries(st.vloeren)) {
        tekening[etage] = vloerNaarMeters(v);
        for (const [kamer, z] of Object.entries(v.zones ?? {})) zones[kamer] = { as: z.as === 'x' ? 'u' : 'v', op: m1(z.op - MARGE) };
      }
      const plekken = {};
      // Per apparaat de kamer waar het staat (stap 3); wat nog geen kamer heeft, ontbreekt.
      const apparaten = {};
      for (const a of st.apparaten) {
        if (a.plek) plekken[a.id] = { etage: a.plek.etage, u: Math.round((a.plek.x - MARGE) * 10) / 100, v: Math.round((a.plek.y - MARGE) * 10) / 100 };
        if (a.kamer) apparaten[a.id] = a.kamer;
      }
      // De deuren en ramen (0.187.0), in meters; en per screen het raam waar het voor hangt.
      const openingen = {};
      for (const [etage, v] of Object.entries(st.vloeren)) {
        const lijst = (v.openingen ?? []).filter((o) => openingMuur(v, o));
        if (lijst.length) openingen[etage] = lijst.map((o) => ({ id: o.id, soort: o.soort, as: o.as === 'x' ? 'u' : 'v', op: m1(o.op - MARGE), van: m1(o.van - MARGE), tot: m1(o.tot - MARGE), ...richtingVan(o) }));
      }
      const ramen = {};
      for (const a of st.apparaten) if (a.raam && a.plek) ramen[a.id] = a.raam;
      // Stap 4: op welke bron dit getekend is; een andere dan bij Daken en panelen zet die daar ook.
      return { tekening, zones, plekken, apparaten, bron: st.bron, ...(metOpeningen ? { openingen, ramen } : {}) };
    };
    if (sleutel) {
      try {
        const p = JSON.parse(localStorage.getItem(sleutel) ?? 'null');
        if (p?.vloeren && huis.etages.every((e) => p.vloeren[e.id]?.W === st.vloeren[e.id].W)) {
          for (const e of huis.etages) st.vloeren[e.id] = uitpakken(p.vloeren[e.id]);
          st.apparaten = p.apparaten;
          if (p.bron && huis.bronnen?.[p.bron]) {
            st.bron = p.bron;
            zetBlokken();
          }
        }
      } catch {
        // Zonder opslag begint de schets gewoon opnieuw.
      }
    }
    /*
     * Het huis op het erf is altijd precies het huis (20 november 2026,
     * Ricardo: het huis was 313 m² op zijn erf, met losse vakken eromheen).
     * Wat binnen het huis valt, is het vaste vak; wat daarbuiten nog "huis"
     * heette, wordt weer de tuin. Zo herstelt een kapotte tekening zichzelf.
     */
    const herstelErf = () => {
      const kamer = opties.vast?.[0];
      if (!kamer) return false;
      let veranderd = false;
      for (const e of huis.etages) {
        const vl = e.buiten ? st.vloeren[e.id] : null;
        if (!vl) continue;
        const delen = (e.blokken ?? []).filter((b) => b.soort === 'hoofdhuis' || b.soort === 'uitbouw' || (b.soort === 'garage' && huis.garageBinnen));
        if (!delen.length) continue;
        const celVan = (m) => MARGE + Math.round(m / CEL);
        const inHuis = new Uint8Array(vl.cel.length);
        for (const b of delen) for (let y = celVan(b.v); y < celVan(b.v + b.d); y++) for (let x = celVan(b.u); x < celVan(b.u + b.b); x++) if (x >= 0 && y >= 0 && x < vl.W && y < vl.H) inHuis[y * vl.W + x] = 1;
        let hid = Number(Object.entries(vl.ruimtes).find(([, r]) => r.kamer === kamer)?.[0]) || 0;
        // Echt kapot (meer dan 15% van het huis verkeerd): Buiten begint opnieuw zoals de eerste keer, op de kaart.
        let fout = 0;
        let huisCellen = 0;
        for (let i = 0; i < vl.cel.length; i++) {
          if (inHuis[i]) huisCellen++;
          if (inHuis[i] !== (hid && vl.cel[i] === hid ? 1 : 0)) fout++;
        }
        if (huis.begin?.[e.id] && (!hid || fout > huisCellen * 0.15)) {
          st.vloeren[e.id] = vloerUitIndeling(huis.maat, e.blokken, huis.begin[e.id]);
          veranderd = true;
          continue;
        }
        const tuinKamer = huis.begin?.[e.id]?.erf?.kamer ?? null;
        let tid = tuinKamer ? Number(Object.entries(vl.ruimtes).find(([, r]) => r.kamer === tuinKamer)?.[0]) || 0 : 0;
        for (let i = 0; i < vl.cel.length; i++) {
          if (inHuis[i]) {
            if (!hid) {
              hid = vl.volg++;
              vl.ruimtes[hid] = { kamer };
            }
            if (vl.cel[i] !== hid) {
              vl.cel[i] = hid;
              veranderd = true;
            }
          } else if (hid && vl.cel[i] === hid) {
            if (!tid) {
              tid = vl.volg++;
              vl.ruimtes[tid] = tuinKamer ? { kamer: tuinKamer } : {};
            }
            vl.cel[i] = tid;
            veranderd = true;
          }
        }
        if (veranderd) ordenen(vl);
      }
      return veranderd;
    };
    const erfHersteld = herstelErf();
    /*
     * De deurbel bij de voordeur (20 november 2026, stap 4 punt 3): heeft de
     * camera van de deurbel nog geen plek en is er een voordeur, dan staat hij
     * buiten naast de voordeur, 30 cm van de muur. Daarna sleep je hem waarheen
     * je wilt. Op het erf als dat er is (dezelfde maat), anders op de etage van de deur.
     */
    function deurbelBijVoordeur() {
      const bel = st.apparaten.find((a) => !a.plek && a.soort === 'camera' && (a.deurbel || /deurbel|doorbell/i.test(`${a.id} ${a.naam ?? ''}`)));
      if (!bel) return false;
      for (const e of huis.etages) {
        const vl = st.vloeren[e.id];
        const o = e.buiten ? null : (vl?.openingen ?? []).find((x) => x.soort === 'voordeur');
        if (!o) continue;
        const cel = (x, y) => (x < 0 || y < 0 || x >= vl.W || y >= vl.H ? BUITEN : vl.cel[y * vl.W + x]);
        const mid = Math.floor((o.van + o.tot) / 2);
        // Een muur langs x ligt tussen rij op-1 en op; buiten is de kant zonder ruimte.
        const naarBuiten = o.as === 'x' ? (cel(mid, o.op) === BUITEN ? 1 : -1) : cel(o.op, mid) === BUITEN ? 1 : -1;
        const opMuur = o.op + (naarBuiten > 0 ? 3 : -3);
        const langs = o.tot + 2;
        const erf = huis.etages.find((x) => x.buiten);
        bel.plek = o.as === 'x' ? { etage: erf?.id ?? e.id, x: langs, y: opMuur } : { etage: erf?.id ?? e.id, x: opMuur, y: langs };
        return true;
      }
      return false;
    }
    const belGezet = deurbelBijVoordeur();
    let bewaarTimer = null;
    /** In de app: elke keer de laatste stand naar de dienst, één tegelijk; onder de vinger gebeurt er niets. */
    let bezigMet = null;
    let nogEens = false;
    const naarDienst = () => {
      if (bezigMet) {
        nogEens = true;
        return;
      }
      bezigMet = Promise.resolve()
        .then(() => opties.opslaan(uitvoer()))
        .then(
          () => {
            st.fout = null;
          },
          (e) => {
            st.fout = e?.message ?? String(e);
          },
        )
        .finally(() => {
          bezigMet = null;
          if (nogEens) {
            nogEens = false;
            naarDienst();
            return;
          }
          st.bewaard = !st.fout;
          meld();
        });
    };
    const bewaar = () => {
      st.bewaard = false;
      clearTimeout(bewaarTimer);
      bewaarTimer = setTimeout(() => {
        if (opties.opslaan) return naarDienst();
        if (sleutel) {
          try {
            localStorage.setItem(sleutel, JSON.stringify({ vloeren: Object.fromEntries(Object.entries(st.vloeren).map(([id, v]) => [id, inpakken(v)])), apparaten: st.apparaten, bron: st.bron }));
          } catch {
            // Dan blijft het bij deze keer.
          }
        }
        st.bewaard = true;
        meld();
      }, opties.wacht ?? 700);
    };

    const vloer = () => st.vloeren[st.etage];
    const etageVan = (id) => huis.etages.find((e) => e.id === id);
    if ((erfHersteld || belGezet) && opties.opslaan) setTimeout(() => bewaar(), 0);
    // De etage eronder; buiten (het erf) ligt onder geen enkele etage.
    const onder = () => {
      const lijst = huis.etages.filter((e) => !e.buiten);
      const i = lijst.findIndex((e) => e.id === st.etage);
      return i >= 0 && i < lijst.length - 1 ? lijst[i + 1] : null;
    };
    const naamVan = (r) => (r?.kamer ? kamers[r.kamer]?.naam : r?.naam) ?? null;
    /** Een vast vak (19 november 2026): het huis op het erf. Geen muur te pakken, er gaat niets in, een tik gaat naar binnen. */
    const vastId = (v, id) => id != null && id !== BUITEN && !!opties.vast?.includes(v.ruimtes[id]?.kamer);
    /** De zonelijnen op een vloer: per kamer de lijn en de stukken die in de ruimte liggen. */
    const zonesOp = (v) => {
      const uit = [];
      for (const [kamer, z] of Object.entries(v.zones ?? {})) {
        const id = Number(Object.entries(v.ruimtes).find(([, r]) => r.kamer === kamer)?.[0]);
        if (!id) continue;
        const stukken = zoneStukken(v, id, z.as, z.op);
        if (stukken.length) uit.push({ kamer, id, z, stukken, namen: kamers[kamer]?.zones ?? [] });
      }
      return uit;
    };
    const soortVan = (r) => (r?.kamer ? kamers[r.kamer]?.soort : r?.soort) ?? null;

    /* ---------- terug en vooruit */
    const foto = () => ({ vloeren: Object.fromEntries(Object.entries(st.vloeren).map(([id, v]) => [id, kopie(v)])), apparaten: JSON.parse(JSON.stringify(st.apparaten)), etage: st.etage, bron: st.bron });
    const zetFoto = (f) => {
      st.bron = f.bron;
      zetBlokken();
      st.vloeren = f.vloeren;
      st.apparaten = f.apparaten;
      st.etage = f.etage;
      st.kies = null;
    };
    /** Vóór elke verandering: de stand onthouden. */
    const stap = (f = foto()) => {
      st.terug.push(f);
      if (st.terug.length > 40) st.terug.shift();
      st.vooruit = [];
    };
    const klaar = () => {
      bewaar();
      teken();
      meld();
    };

    /* ---------- kijken: van ruitjes naar het scherm */
    let B = 600;
    let Hpx = 500;
    let kijk = null;
    let k = 1;
    let ox = 0;
    let oy = 0;
    const heleKijk = () => {
      // Het hele huis, over alle etages: in de app kan er een kelder onder de begane grond liggen, op alleen het hoofdhuis.
      // Buiten (het erf) heeft zijn eigen beeld, en telt binnen niet mee (19 november 2026).
      const opErf = !!etageVan(st.etage)?.buiten;
      const os = huis.etages.filter((e) => !!e.buiten === opErf).map((e) => omtrek(st.vloeren[e.id]));
      const o = { x0: Math.min(...os.map((x) => x.x0)), y0: Math.min(...os.map((x) => x.y0)), x1: Math.max(...os.map((x) => x.x1)), y1: Math.max(...os.map((x) => x.y1)) };
      const rand = st.stand === 'vorm' ? 16 : 7;
      // Een deur die naar buiten draait, valt niet buiten beeld (22 november 2026: de achterdeur van Ricardo viel bovenin weg).
      if (!opErf && st.stand !== 'vorm') {
        for (const e of huis.etages.filter((x) => !x.buiten)) {
          for (const g of st.vloeren[e.id]?.openingen ?? []) {
            if (g.soort === 'raam' || g.soort === 'schuifpui') continue;
            const w = (g.tot - g.van) / (g.soort === 'dubbel' ? 2 : 1);
            if (g.as === 'y') {
              o.y0 = Math.min(o.y0, g.op - w);
              o.y1 = Math.max(o.y1, g.op + w);
            } else {
              o.x0 = Math.min(o.x0, g.op - w);
              o.x1 = Math.max(o.x1, g.op + w);
            }
          }
        }
      }
      if (st.stand === 'vorm') {
        const randpunten = [...omgeving().flatMap((q) => q.punten), ...opErfBlokken().flatMap((q) => [[q.u, q.v], [q.u + q.b, q.v + q.d]])];
        for (const [x, y] of randpunten) {
          o.x0 = Math.min(o.x0, MARGE + x / CEL);
          o.x1 = Math.max(o.x1, MARGE + x / CEL);
          o.y0 = Math.min(o.y0, MARGE + y / CEL);
          o.y1 = Math.max(o.y1, MARGE + y / CEL);
        }
      }
      return { x0: o.x0 - rand, y0: o.y0 - rand - 3, x1: o.x1 + rand, y1: o.y1 + rand };
    };
    /** Het dak bij Dak: wat lager is dan 1,5 m gestreept (niet onder een dakkapel), de nok, en de dakkapellen met hun grepen. */
    /**
     * Wat de kaarten vinden (ronde 2): het afdak als eigen stuk met zijn naam (Nieuw tot je het zag), op een
     * etage erboven gestreept; de stippen van een gebouw op maat; en tijdens het zoeken een straal rond het huis.
     */
    let afdakPil = null;
    const kaartLaag = (vorm) => {
      let s = '';
      afdakPil = null;
      const af = afdakVak();
      const P = (u, w) => [X(MARGE + u / CEL), Y(MARGE + w / CEL)];
      const vak = (u0, v0, u1, v1, extra) => {
        const [x0, y0] = P(u0, v1);
        const [x1, y1] = P(u1, v0);
        return `<rect x="${Math.min(x0, x1).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${Math.abs(x1 - x0).toFixed(1)}" height="${Math.abs(y1 - y0).toFixed(1)}" ${extra}/>`;
      };
      const beneden = benedenId();
      // Alleen de etage waar het afdak tot in reikt (Ricardo 20 november 2026: bij hem de 1e, niet de zolder):
      // de vloer van die etage ligt lager dan de bovenkant van het afdak.
      const lagen = huis.etages.filter((e) => !e.buiten);
      const ib = lagen.findIndex((e) => e.id === beneden);
      const ie = lagen.findIndex((e) => e.id === st.etage);
      const vloer = ie >= 0 && ib >= 0 && ie < ib ? lagen.slice(ie + 1, ib + 1).reduce((n, e) => n + (e.hoogte ?? 2.8), 0) : null;
      const erboven = vloer != null && af != null && vloer < af.a.hoog;
      if (af && vorm && st.etage === beneden) {
        const aan = st.kies?.soort === 'afdak';
        s += `<defs><pattern id="ht-afdak" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="rgb(110 231 183 / 0.16)"/><line x1="0" y1="0" x2="7" y2="0" stroke="#6ee7b7" stroke-width="1.6" opacity="0.7"/></pattern></defs>`;
        s += vak(af.u0, af.v0, af.u1, af.v1, `fill="url(#ht-afdak)" stroke="${aan ? '#6fd3ff' : '#6ee7b7'}" stroke-width="${aan ? 3 : 1.4}" pointer-events="none"`);
        const tekst = `${afdakGezien() ? '' : `${T('ht.afdak.nieuw')} · `}${T('ht.afdak.label', { maat: nl(af.a.diep) })}`;
        const [xr] = P(af.u1, 0);
        const [, ym] = P(0, (af.v0 + af.v1) / 2);
        const bw = tekst.length * 6.6 + 18;
        const x = Math.min(B - bw - 4, xr + 12);
        afdakPil = { x, y: ym + 6, b: bw, h: 24 };
        s += `<g transform="translate(${x.toFixed(1)} ${(ym + 18).toFixed(1)})" pointer-events="none"><rect x="0" y="-12" width="${bw.toFixed(0)}" height="24" rx="9" fill="#0b1424" stroke="#6ee7b7" stroke-width="1.4"/><text x="${(bw / 2).toFixed(1)}" y="4.5" text-anchor="middle" ${FONT} font-size="11.5" font-weight="700" fill="#b6f0d6">${esc(tekst)}</text></g>`;
        s += `<line x1="${(xr + 2).toFixed(1)}" y1="${ym.toFixed(1)}" x2="${(x + 4).toFixed(1)}" y2="${(ym + 12).toFixed(1)}" stroke="#6ee7b7" stroke-width="1.4" pointer-events="none"/>`;
      }
      // Op een etage boven het afdak: daar is geen huis, het afdak ligt eronder.
      if (af && st.stand === 'kamers' && erboven) {
        s += `<defs><pattern id="ht-afdak-boven" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="rgb(110 231 183 / 0.05)"/><line x1="0" y1="0" x2="0" y2="9" stroke="rgb(110 231 183 / 0.35)" stroke-width="3"/></pattern></defs>`;
        s += vak(af.u0, af.v0, af.u1, af.v1, 'fill="url(#ht-afdak-boven)" pointer-events="none"');
        const [xm, ym] = P((af.u0 + af.u1) / 2, (af.v0 + af.v1) / 2);
        s += `<text x="${xm.toFixed(1)}" y="${(ym + 4).toFixed(1)}" text-anchor="middle" ${FONT} font-size="11.5" font-weight="700" fill="#b6f0d6" paint-order="stroke" stroke="#0b1424" stroke-width="3" pointer-events="none">${esc(T('ht.afdak.eronder'))}</text>`;
      }
      // De stippen om een gebouw op maat te trekken.
      for (const g of blokGrepen()) s += `<circle cx="${g.px.toFixed(1)}" cy="${g.py.toFixed(1)}" r="8" fill="#0b1424" stroke="#6fd3ff" stroke-width="2.5" pointer-events="none"/>`;
      // Tijdens het zoeken: een straal die rond het huis draait.
      const h = hoofdBlok();
      if (vorm && huis.kijk?.bezig && h) {
        const [cx, cy] = P(h.u + h.b / 2, h.v + h.d / 2);
        const R = (16 / CEL) * k;
        const [ex, ey] = [cx + R * Math.cos(0.7), cy - R * Math.sin(0.7)];
        s += `<defs><radialGradient id="ht-straal" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${R.toFixed(1)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#6fd3ff" stop-opacity="0.35"/><stop offset="1" stop-color="#6fd3ff" stop-opacity="0"/></radialGradient></defs>`;
        s += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${R.toFixed(1)}" fill="none" stroke="#6fd3ff" stroke-opacity="0.18" stroke-dasharray="3 6" pointer-events="none"/>`;
        s += `<g class="ht-zwaai" pointer-events="none"><path d="M${cx.toFixed(1)} ${cy.toFixed(1)} L${(cx + R).toFixed(1)} ${cy.toFixed(1)} A${R.toFixed(1)} ${R.toFixed(1)} 0 0 0 ${ex.toFixed(1)} ${ey.toFixed(1)} Z" fill="url(#ht-straal)"/><animateTransform attributeName="transform" type="rotate" from="0 ${cx.toFixed(1)} ${cy.toFixed(1)}" to="-360 ${cx.toFixed(1)} ${cy.toFixed(1)}" dur="3.2s" repeatCount="indefinite"/></g>`;
      }
      return s;
    };
    const dakLaag = () => {
      const m = dakMaat();
      if (!m) return '';
      const P = (u, w) => [X(MARGE + u / CEL), Y(MARGE + w / CEL)];
      const vak = (u0, v0, u1, v1, extra) => {
        const [x0, y0] = P(u0, v1);
        const [x1, y1] = P(u1, v0);
        return `<rect x="${Math.min(x0, x1).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${Math.abs(x1 - x0).toFixed(1)}" height="${Math.abs(y1 - y0).toFixed(1)}" ${extra}/>`;
      };
      const opAC = (a0, a1, c0, c1, extra) => (m.langs ? vak(c0, a0, c1, a1, extra) : vak(a0, c0, a1, c1, extra));
      let s = `<defs><pattern id="ht-laag" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="rgb(255 255 255 / 0.03)"/><line x1="0" y1="0" x2="0" y2="9" stroke="rgb(255 255 255 / 0.18)" stroke-width="3"/></pattern></defs>`;
      const hier = opDezeEtage();
      const strook = laagStrook(st.etage);
      let label = null;
      for (const kant of [0, 1]) {
        const w = strook[kant];
        if (w < 0.2) continue;
        const [c0, c1] = kant === 0 ? [m.c0, m.c0 + w] : [m.c0 + m.lc - w, m.c0 + m.lc];
        const gaten = hier.filter(({ k }) => k.kant === kant).map(({ k }) => [m.a0 + k.van, m.a0 + k.tot]).sort((x, y) => x[0] - y[0]);
        let a = m.a0;
        const stukken = [];
        for (const [g0, g1] of gaten) {
          if (g0 > a) stukken.push([a, g0]);
          a = Math.max(a, g1);
        }
        if (a < m.a0 + m.la) stukken.push([a, m.a0 + m.la]);
        for (const [a0, a1] of stukken) s += opAC(a0, a1, c0, c1, 'fill="url(#ht-laag)" pointer-events="none"');
        // Het label op het langste stuk, dicht bij de gevel: niet in een dakkapel.
        const lang = stukken.sort((x, y) => y[1] - y[0] - (x[1] - x[0]))[0];
        if (lang && lang[1] - lang[0] > 1.6 && (!label || w > label.w)) label = { w, a: (lang[0] + lang[1]) / 2, c: kant === 0 ? m.c0 + Math.min(w / 2, 0.45) : m.c0 + m.lc - Math.min(w / 2, 0.45) };
      }
      if (label) {
        const [x, y] = m.langs ? P(label.c, label.a) : P(label.a, label.c);
        s += `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" ${FONT} font-size="11.5" font-weight="600" fill="rgb(255 255 255 / 0.6)" pointer-events="none">${esc(T('ht.dakkapel.laag'))}</text>`;
      }
      // De nok: een stippellijn over het huis.
      const nc = m.c0 + m.naar[0];
      const [[nx0, ny0], [nx1, ny1]] = m.langs ? [P(nc, m.a0), P(nc, m.a0 + m.la)] : [P(m.a0, nc), P(m.a0 + m.la, nc)];
      s += `<line x1="${nx0.toFixed(1)}" y1="${ny0.toFixed(1)}" x2="${nx1.toFixed(1)}" y2="${ny1.toFixed(1)}" stroke="rgb(255 255 255 / 0.4)" stroke-width="1.5" stroke-dasharray="3 5" pointer-events="none"/>`;
      s += `<text x="${(Math.max(nx0, nx1) + 8).toFixed(1)}" y="${(Math.min(ny0, ny1) + (m.langs ? -8 : 4)).toFixed(1)}" ${FONT} font-size="11.5" font-weight="700" fill="rgb(255 255 255 / 0.5)" pointer-events="none">${esc(T('ht.dakkapel.nok'))}</text>`;
      // De dakkapellen op deze etage.
      const uitKaart = hoofdBlok()?.kapelBron === 'kaart';
      for (const { k, i } of hier) {
        const r = kapelRecht(k, m);
        const [x0, y0] = P(r.u0, r.v1);
        const [x1, y1] = P(r.u1, r.v0);
        const [l, t2, b, h] = [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)];
        const gekozen = st.kies?.soort === 'kapel' && st.kies.i === i;
        s += `<rect x="${l.toFixed(1)}" y="${t2.toFixed(1)}" width="${b.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="rgb(111 211 255 / ${gekozen ? 0.26 : 0.18})" stroke="#6fd3ff" stroke-width="${gekozen ? 3.5 : 2.5}" ${uitKaart ? 'stroke-dasharray="7 5"' : ''}/>`;
        const [cx, cy] = [l + b / 2, t2 + h / 2];
        s += `<text x="${cx.toFixed(1)}" y="${(cy + 2).toFixed(1)}" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="#eef3f7" pointer-events="none">${esc(T('ht.dakkapel.naam'))}</text>`;
        if (b > 90 && h > 40) s += `<text x="${cx.toFixed(1)}" y="${(cy + 16).toFixed(1)}" text-anchor="middle" ${FONT} font-size="11" font-weight="600" fill="rgb(169 230 255 / 0.85)" pointer-events="none">${esc(T(uitKaart ? 'ht.dakkapel.vanKaart' : 'ht.dakkapel.staan'))}</text>`;
        if (gekozen) {
          // De maat langs de nok, en grepen op de twee zijkanten die je rekt.
          const breed = `${nl(k.tot - k.van)} m`;
          const [px, py] = m.langs ? [l - 34, cy] : [cx, t2 - 20];
          s += `<g transform="translate(${px.toFixed(1)} ${py.toFixed(1)})" pointer-events="none"><rect x="-27" y="-13" width="54" height="26" rx="9" fill="#0b1424" stroke="#6ee7b7" stroke-width="1.5"/><text y="5" text-anchor="middle" ${FONT} font-size="13" font-weight="700" fill="#6ee7b7">${esc(breed)}</text></g>`;
          const grepen = m.langs ? [[cx, t2], [cx, t2 + h]] : [[l, cy], [l + b, cy]];
          for (const [gx, gy] of grepen) s += m.langs ? `<rect x="${(gx - 22).toFixed(1)}" y="${(gy - 5).toFixed(1)}" width="44" height="10" rx="5" fill="#6fd3ff" stroke="#0b1424" stroke-width="2" pointer-events="none"/>` : `<rect x="${(gx - 5).toFixed(1)}" y="${(gy - 22).toFixed(1)}" width="10" height="44" rx="5" fill="#6fd3ff" stroke="#0b1424" stroke-width="2" pointer-events="none"/>`;
        }
      }
      return s;
    };
    /** Welke dakkapel onder de vinger ligt, en of het een zijkant (rekken) is of het midden (schuiven). */
    const kapelOp = (p, tolPx) => {
      const m = dakMaat();
      if (!m) return null;
      const tol = (tolPx * CEL) / k;
      const [u, w] = [(p.x - MARGE) * CEL, (p.y - MARGE) * CEL];
      const [a, c] = m.langs ? [w, u] : [u, w];
      for (const { k: kk, i } of opDezeEtage()) {
        const r = kapelRecht(kk, m);
        const [ra0, ra1, rc0, rc1] = m.langs ? [r.v0, r.v1, r.u0, r.u1] : [r.u0, r.u1, r.v0, r.v1];
        if (a < ra0 - tol || a > ra1 + tol || c < rc0 - tol || c > rc1 + tol) continue;
        const wat = Math.abs(a - ra0) <= tol ? 'van' : Math.abs(a - ra1) <= tol ? 'tot' : 'schuif';
        return { i, wat, m };
      }
      return null;
    };
    const zetKijk = (kk) => {
      kijk = kk;
      k = Math.min(B / (kk.x1 - kk.x0), Hpx / (kk.y1 - kk.y0));
      ox = (B - (kk.x1 - kk.x0) * k) / 2 - kk.x0 * k;
      oy = Hpx - (Hpx - (kk.y1 - kk.y0) * k) / 2 + kk.y0 * k;
    };
    const X = (x) => ox + x * k;
    const Y = (y) => oy - y * k;
    let anim = null;
    const kijkNaar = (doel, meteen) => {
      cancelAnimationFrame(anim);
      if (meteen || !kijk) {
        zetKijk(doel);
        teken();
        return;
      }
      const van = { ...kijk };
      const t0 = performance.now();
      const loop = (t) => {
        const f = Math.min(1, (t - t0) / 260);
        const e = 1 - (1 - f) ** 3;
        zetKijk({ x0: van.x0 + (doel.x0 - van.x0) * e, y0: van.y0 + (doel.y0 - van.y0) * e, x1: van.x1 + (doel.x1 - van.x1) * e, y1: van.y1 + (doel.y1 - van.y1) * e });
        teken();
        if (f < 1) anim = requestAnimationFrame(loop);
      };
      anim = requestAnimationFrame(loop);
    };
    const zoomDoel = () => {
      if (st.eigen) return st.eigen;
      if (st.zoom == null) return heleKijk();
      const m = maten(vloer())[st.zoom];
      if (!m) return heleKijk();
      const rand = Math.max(8, Math.round(Math.max(m.x1 - m.x0, m.y1 - m.y0) * 0.14));
      return { x0: m.x0 - rand, y0: m.y0 - rand, x1: m.x1 + rand, y1: m.y1 + rand };
    };
    function pasAan() {
      const r = svg.getBoundingClientRect();
      B = Math.max(200, Math.round(r.width));
      Hpx = Math.max(200, Math.round(r.height));
      svg.setAttribute('viewBox', `0 0 ${B} ${Hpx}`);
      zetKijk(zoomDoel());
      teken();
    }

    /* ---------- apparaten: waar staan ze */
    const kamerPlek = () => {
      const uit = {};
      for (const [etage, v] of Object.entries(st.vloeren)) for (const [id, r] of Object.entries(v.ruimtes)) if (r.kamer) uit[r.kamer] = { etage, id: Number(id) };
      return uit;
    };
    /** De apparaten van deze etage met hun plek in ruitjes: bewaard, of gekozen naar hun soort. */
    function apparaatPunten() {
      const v = vloer();
      const m = maten(v);
      const waar = kamerPlek();
      const uit = [];
      const zonder = {};
      for (const a of st.apparaten) {
        // Een deel buiten zonder eigen vak (de border in de tuin): zijn apparaten staan in de ruimte zelf (19 november 2026).
        const w = a.kamer ? (waar[a.kamer] ?? (kamers[a.kamer]?.deelVan ? waar[kamers[a.kamer].deelVan] : null)) : null;
        if (!w || w.etage !== st.etage) continue;
        const p = a.plek;
        const zelf = !!p && p.etage === st.etage && v.cel[Math.floor(p.y) * v.W + Math.floor(p.x)] === w.id;
        if (zelf) uit.push({ a, x: p.x, y: p.y, ruimte: w.id, zelf: true });
        // Ook wie zelf een plek heeft telt mee in de verdeling: zo verspringt de rest niet als je er één verzet.
        (zonder[w.id] ??= []).push({ a, zelf });
      }
      for (const [id, lijst] of Object.entries(zonder)) {
        const r = m[id]?.r;
        if (!r) continue;
        const bb = r.x1 - r.x0;
        const dd = r.y1 - r.y0;
        const per = {};
        for (const { a, zelf } of lijst) {
          const groep = a.soort === 'licht' || a.soort === 'rookmelder' ? 'midden' : a.soort === 'airco' ? 'achter' : a.soort === 'screen' ? 'voor' : a.soort === 'meter' || a.soort === 'beweging' || a.soort === 'thermostaat' ? 'rechts' : 'links';
          (per[groep] ??= []).push(zelf ? null : a);
        }
        const zet = (a, x, y) => a && uit.push({ a, x: klem(x, r.x0 + 2, r.x1 - 2), y: klem(y, r.y0 + 2, r.y1 - 2), ruimte: Number(id), zelf: false });
        (per.midden ?? []).forEach((a, i, l) => {
          const kol = l.length <= 3 ? l.length : Math.ceil(l.length / 2);
          const rij = l.length <= 3 ? 0 : Math.floor(i / kol);
          const rijenN = l.length <= 3 ? 1 : 2;
          zet(a, r.x0 + (bb * ((i % kol) + 0.5)) / kol, r.y0 + (dd * (rij + 1)) / (rijenN + 1) - (rijenN === 1 ? dd * 0.08 : 0));
        });
        // Iets uit het midden: daar staat bij twee zones de naam van de tweede.
        (per.achter ?? []).forEach((a, i, l) => zet(a, r.x0 + bb * ((i + 1) / (l.length + 1) + (l.length === 1 ? 0.2 : 0)), r.y1 - 3));
        (per.voor ?? []).forEach((a, i, l) => zet(a, r.x0 + (bb * (i + 1)) / (l.length + 1), r.y0 + 2));
        (per.rechts ?? []).forEach((a, i, l) => zet(a, r.x1 - 3, r.y0 + (dd * (i + 1)) / (l.length + 1)));
        (per.links ?? []).forEach((a, i, l) => zet(a, r.x0 + 3, r.y0 + (dd * (i + 1)) / (l.length + 1)));
      }
      return uit;
    }
    /** Hoe een plek heet in gewone woorden. */
    function plekNaam(p) {
      if (!p.zelf) return T('ht.plek.sunarc');
      const v = vloer();
      const tot = (dx, dy) => {
        let n = 0;
        let x = Math.floor(p.x);
        let y = Math.floor(p.y);
        while (n < 400 && v.cel[y * v.W + x] === p.ruimte) {
          x += dx;
          y += dy;
          n++;
        }
        return n;
      };
      const kanten = [[T('ht.plek.links'), tot(-1, 0)], [T('ht.plek.rechts'), tot(1, 0)], [T('ht.plek.voor'), tot(0, -1)], [T('ht.plek.achter'), tot(0, 1)]].sort((a, b) => a[1] - b[1]);
      return kanten[0][1] <= 5 ? kanten[0][0] : T('ht.plek.midden');
    }

    /* ---------- tekenen */
    svg.classList.add('ht');
    svg.style.touchAction = 'none';
    svg.innerHTML = `<defs><pattern id="ht-leeg" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V3.2" stroke="rgb(247 181 72 / 0.13)" stroke-width="0.7"/></pattern></defs><g data-l="onder"></g><g data-l="vlak"></g><g data-l="namen"></g><g data-l="app"></g><g data-l="over"></g><g data-l="knop"></g>`;
    const laag = (n) => svg.querySelector(`[data-l="${n}"]`);
    const pil = (x, y, tekst, kleur = '#a9e6ff', draai = false) => {
      const bw = tekst.length * 6.9 + 16;
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})${draai ? ' rotate(-90)' : ''}" pointer-events="none"><rect x="${-bw / 2}" y="-12" width="${bw}" height="24" rx="8" fill="#0d1a30" stroke="${kleur}" stroke-opacity="0.55"/><text y="4.5" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="${kleur}">${esc(tekst)}</text></g>`;
    };
    /** Wat er tijdens een gebaar bovenop ligt (een vak in wording, de maten bij een muur). */
    let over = '';

    function teken() {
      if (!kijk) return;
      // Het huis in 3D: de buitenkant van de kaart, de binnenkant uit de tekening (huistekenen-3d.js).
      if (st.stand === 'huis' && global.huistekenen3d) {
        for (const n of ['onder', 'namen', 'app', 'over', 'knop']) laag(n).innerHTML = '';
        laag('vlak').innerHTML = global.huistekenen3d.teken(t, B, Hpx);
        return;
      }
      const v = actie?.voorbeeld ?? vloer();
      const m = maten(v);
      const tf = `translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${k.toFixed(4)} ${(-k).toFixed(4)})`;
      const app = st.stand === 'apparaten';
      const vorm = st.stand === 'vorm';

      // De etage eronder, als stippellijn om muren boven elkaar te zetten.
      const eronder = onder();
      let s = '';
      if (eronder && st.stand === 'kamers') {
        const d = randen(st.vloeren[eronder.id], isMuur).filter((r) => r.soort === 1).map(lijnPad).join('');
        s = `<g transform="${tf}"><path d="${d}" fill="none" stroke="rgb(255 255 255 / 0.2)" stroke-width="1.5" stroke-dasharray="5 6" vector-effect="non-scaling-stroke"/></g>`;
      }
      // Het trapgat: waar de trap van de etage eronder hier uitkomt.
      if (metOpeningen && eronder && st.stand !== 'vorm') {
        const vo = st.vloeren[eronder.id];
        const mo = maten(vo);
        for (const [id, r] of Object.entries(vo.ruimtes)) {
          if (soortVan(r) !== 'trap' || !mo[id]) continue;
          const b = mo[id];
          s += `<g transform="${tf}"><rect x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${b.y1 - b.y0}" fill="rgb(255 255 255 / 0.05)" stroke="#a9e6ff" stroke-opacity="0.6" stroke-width="1.5" stroke-dasharray="6 5" vector-effect="non-scaling-stroke"/></g>`;
          s += `<text x="${X((b.x0 + b.x1) / 2).toFixed(1)}" y="${(Y((b.y0 + b.y1) / 2) + 4).toFixed(1)}" text-anchor="middle" ${FONT} font-size="12" font-weight="700" fill="#a9e6ff" pointer-events="none">${esc(T('ht.trap.gat'))}</text>`;
        }
      }
      laag('onder').innerHTML = s;

      // De ruimtes in hun kleur, en de muren.
      const paden = vlakPaden(v);
      s = `<g transform="${tf}">`;
      // Bij Vorm: de gebouwen van de kaart eromheen, grijs, om aan te wijzen.
      if (vorm) {
        for (const q of omgeving()) {
          const aan = st.kies?.soort === 'omgeving' && st.kies.i === q.i;
          s += `<polygon class="ht-omgeving" points="${q.punten.map(([x, y]) => `${(MARGE + x / CEL).toFixed(1)},${(MARGE + y / CEL).toFixed(1)}`).join(' ')}" fill="${aan ? 'rgb(111 211 255 / 0.22)' : 'rgb(255 255 255 / 0.07)'}" stroke="${aan ? '#6fd3ff' : 'rgb(255 255 255 / 0.35)'}" stroke-width="${aan ? 3 : 1.5}" stroke-dasharray="${aan ? '' : '6 5'}" vector-effect="non-scaling-stroke"/>`;
        }
        // Wat bij je huis hoort maar op het erf staat: een lichte, doorgetrokken rand.
        for (const q of opErfBlokken()) s += `<rect class="ht-op-erf" x="${(MARGE + q.u / CEL).toFixed(1)}" y="${(MARGE + q.v / CEL).toFixed(1)}" width="${(q.b / CEL).toFixed(1)}" height="${(q.d / CEL).toFixed(1)}" fill="rgb(169 230 255 / 0.08)" stroke="#a9e6ff" stroke-opacity="0.7" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
      }
      for (const [id, d] of Object.entries(paden)) {
        const r = v.ruimtes[id];
        const naam = naamVan(r);
        const gekozen = st.kies?.soort === 'ruimte' && st.kies.id === Number(id);
        const doel = actie?.doel === Number(id);
        const dim = app && st.zoom != null && st.zoom !== Number(id);
        const tint = TINT[SOORT_TINT[soortVan(r)] ?? (r?.kamer ? 'woon' : naam ? 'hal' : 'leeg')];
        const sterk = vorm ? 0.1 : doel ? 0.42 : gekozen ? 0.34 : naam ? (dim ? 0.07 : 0.19) : 0.05;
        s += `<path d="${d}" fill="rgb(${tint} / ${sterk})"/>`;
        // Bij Dak geen arcering voor een vak zonder naam: daar zijn de strepen voor wat lager is dan 1,5 m (20 november 2026).
        if (!naam && !vorm && st.stand !== 'dak') s += `<path d="${d}" fill="url(#ht-leeg)" opacity="${dim ? 0.3 : 1}"/>`;
      }
      const muren = randen(v, isMuur);
      const binnen = muren.filter((r) => r.soort === 1).map(lijnPad).join('');
      const buiten = muren.filter((r) => r.soort === 2).map(lijnPad).join('');
      if (!vorm) s += `<path d="${binnen}" fill="none" stroke="#c9d3dc" stroke-width="3" stroke-linecap="square" vector-effect="non-scaling-stroke"/>`;
      s += `<path d="${buiten}" fill="none" stroke="#eef3f7" stroke-width="${vorm ? 6 : 5}" stroke-linecap="square" vector-effect="non-scaling-stroke"/>`;
      if (vorm || st.stand === 'kamers') {
        const bm = buurMuren().map(lijnPad).join('');
        if (bm) s += `<path d="${bm}" fill="none" stroke="#ffb07a" stroke-width="${vorm ? 7 : 6}" vector-effect="non-scaling-stroke"/><path d="${bm}" fill="none" stroke="#0b1424" stroke-width="${vorm ? 7 : 6}" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>`;
      }
      if (metOpeningen && !vorm) s += openingenPad(v);
      if (metOpeningen && !vorm) s += trapPad(v, m);
      // Wat gekozen is: de rand van de ruimte, of de muur zelf.
      if (st.kies?.soort === 'ruimte' && m[st.kies.id]) {
        const id = st.kies.id;
        s += `<path d="${randen(v, (a, b) => ((a === id) !== (b === id) ? 1 : 0)).map(lijnPad).join('')}" fill="none" stroke="#6fd3ff" stroke-width="4" stroke-linecap="square" vector-effect="non-scaling-stroke"/>`;
      }
      if (actie?.doel != null && m[actie.doel]) {
        const id = actie.doel;
        s += `<path d="${randen(v, (a, b) => ((a === id) !== (b === id) ? 1 : 0)).map(lijnPad).join('')}" fill="none" stroke="#6ee7b7" stroke-width="4" stroke-linecap="square" vector-effect="non-scaling-stroke"/>`;
      }
      // Zones: een groene stippellijn in de kamer, geen muur.
      const zones = vorm ? [] : zonesOp(v);
      for (const zz of zones) s += `<path d="${zz.stukken.map(lijnPad).join('')}" fill="none" stroke="#6ee7b7" stroke-width="${actie?.type === 'zone' && actie.kamer === zz.kamer ? 5 : 3}" stroke-dasharray="9 7" vector-effect="non-scaling-stroke"/>`;
      const muur = actie?.type === 'muur' ? actie.nu : st.kies?.soort === 'muur' ? st.kies.run : actie?.kandidaat?.soort === 'muur' && !actie.type ? actie.kandidaat.m : null;
      if (muur) s += `<path d="${lijnPad(muur)}" fill="none" stroke="#6fd3ff" stroke-width="7" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
      s += '</g>';
      // De greep op een gekozen muur: laat zien dat hij te pakken is.
      if (muur) {
        const mid = (muur.van + muur.tot) / 2;
        const gx = muur.as === 'x' ? X(muur.op) : X(mid);
        const gy = muur.as === 'x' ? Y(mid) : Y(muur.op);
        const pijl = muur.as === 'x' ? 'M-5 0h10M-5 0l3-3M-5 0l3 3M5 0l-3-3M5 0l-3 3' : 'M0-5v10M0-5l-3 3M0-5l3 3M0 5l-3-3M0 5l3-3';
        s += `<g transform="translate(${gx.toFixed(1)} ${gy.toFixed(1)})" pointer-events="none"><circle r="15" fill="#6fd3ff"/><path d="${pijl}" stroke="#0b1424" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>`;
      }
      // Het scharnier van de gekozen deur: een stip om te tikken.
      const sp = metOpeningen ? scharnierStip(v) : null;
      if (sp) s += `<g transform="translate(${X(sp.x).toFixed(1)} ${Y(sp.y).toFixed(1)})" pointer-events="none"><circle r="10" fill="#6fd3ff" stroke="#0b1424" stroke-width="2.5"/><path d="M-3.5 -1.5a3.6 3.6 0 1 1 0 3" stroke="#0b1424" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`;
      // De greep om een gekozen ruimte in zijn geheel te verplaatsen.
      const greep = !actie || actie.type === 'verplaats' ? greepPlek(v) : null;
      if (greep) s += `<g transform="translate(${greep.px.toFixed(1)} ${greep.py.toFixed(1)})" pointer-events="none"><circle r="17" fill="#6fd3ff" stroke="#0b1424" stroke-width="2"/><path d="M-9 0h18M0-9v18M-9 0l3-3M-9 0l3 3M9 0l-3-3M9 0l-3 3M0-9l-3 3M0-9l3 3M0 9l-3-3M0 9l3-3" stroke="#0b1424" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>`;
      laag('vlak').innerHTML = s;

      // De namen: in het grootste rechte stuk van de ruimte.
      s = '';
      for (const [id, mm] of Object.entries(m)) {
        const r = v.ruimtes[id];
        if (!mm.r) continue;
        const naam = naamVan(r);
        const pb = (mm.r.x1 - mm.r.x0) * k;
        const pd = (mm.r.y1 - mm.r.y0) * k;
        const m2 = `${nl(mm.n * CEL * CEL, 0)} m²`;
        const dim = app && st.zoom != null && st.zoom !== Number(id);
        if (vorm) continue;
        if (app) {
          // Bij apparaten staat de naam klein in de hoek: het midden is voor de apparaten.
          // Een kamer met zones heet ook hier naar zijn zones: elke kant van de stippellijn zijn eigen naam.
          const zz = zones.find((x) => x.id === Number(id));
          if (zz) {
            const label = (x, y, tekst) => `<text x="${(X(x) + 9).toFixed(1)}" y="${(Y(y) + 19).toFixed(1)}" ${FONT} font-size="12.5" font-weight="700" fill="rgb(110 231 183 / ${dim ? 0.3 : 0.85})" pointer-events="none">${esc(tekst)}</text>`;
            s += zz.z.as === 'x' ? label(mm.x0, mm.y1, zz.namen[0] ?? '') + label(zz.z.op, mm.y1, zz.namen[1] ?? '') : label(mm.x0, zz.z.op, zz.namen[0] ?? '') + label(mm.x0, mm.y1, zz.namen[1] ?? '');
            continue;
          }
          if (pb > 50 && pd > 26) s += `<text x="${(X(mm.r.x0) + 9).toFixed(1)}" y="${(Y(mm.r.y1) + 19).toFixed(1)}" ${FONT} font-size="12.5" font-weight="700" fill="rgb(255 255 255 / ${dim ? 0.25 : 0.62})" pointer-events="none">${esc(naam ?? '')}</text>`;
          continue;
        }
        // Een kamer met zones heet naar zijn zones, bij de lijn.
        if (zones.some((zz) => zz.id === Number(id)) && !actie?.type) continue;
        const cx = X((mm.r.x0 + mm.r.x1) / 2);
        const cy = Y((mm.r.y0 + mm.r.y1) / 2);
        // Bij Dak alleen de namen, klein en bescheiden: het dak en de dakkapel staan voorop.
        if (st.stand === 'dak') {
          if (naam && pb > naam.length * 7 && pd > 18) s += `<text x="${cx.toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle" ${FONT} font-size="12" font-weight="700" fill="rgb(255 255 255 / 0.4)" pointer-events="none">${esc(naam)}</text>`;
          continue;
        }
        const tekst = naam ?? T('ht.watIsDit');
        const fs = pb < 74 || pd < 44 ? 11.5 : pb > 200 && pd > 120 ? 17 : 14.5;
        if (pb < tekst.length * fs * 0.5 || pd < 18) continue;
        const kleur = naam ? (r.kamer ? '#eef3f7' : 'rgb(255 255 255 / 0.72)') : '#ffd38a';
        // Met de greep in het midden staat de naam erboven, als daar plek is.
        if (greep && st.kies.id === Number(id)) {
          if (pd > 78) s += `<text x="${cx.toFixed(1)}" y="${(cy - 26).toFixed(1)}" text-anchor="middle" ${FONT} font-size="${fs}" font-weight="700" fill="${kleur}" pointer-events="none">${esc(tekst)}</text>`;
          continue;
        }
        const metMaat = pd > 46 && pb > 60;
        s += `<text x="${cx.toFixed(1)}" y="${(cy + (metMaat ? -2 : 4)).toFixed(1)}" text-anchor="middle" ${FONT} font-size="${fs}" font-weight="700" fill="${kleur}" pointer-events="none">${esc(tekst)}</text>`;
        if (metMaat) s += `<text x="${cx.toFixed(1)}" y="${(cy + 15).toFixed(1)}" text-anchor="middle" ${FONT} font-size="11.5" fill="rgb(255 255 255 / 0.5)" pointer-events="none">${m2}${naam && !r.kamer && pb > 150 ? ` · ${esc(T('ht.nietInHA'))}` : ''}</text>`;
      }
      // De namen van de zones aan weerszijden van hun lijn, bij het langste stuk.
      if (!app && !actie?.type) {
        for (const zz of zones) {
          const st2 = zz.stukken.reduce((a, b) => (b.tot - b.van > a.tot - a.van ? b : a));
          if ((st2.tot - st2.van) * k < 60) continue;
          const mid = (st2.van + st2.tot) / 2;
          const [een, twee] = [zz.namen[0] ?? '', zz.namen[1] ?? ''];
          const half = (tekst) => (tekst.length * 6.9 + 16) / 2 + 9;
          if (zz.z.as === 'x') s += pil(X(zz.z.op) - half(een), Y(mid), een, '#6ee7b7') + pil(X(zz.z.op) + half(twee), Y(mid), twee, '#6ee7b7');
          else s += pil(X(mid), Y(zz.z.op) + 19, een, '#6ee7b7') + pil(X(mid), Y(zz.z.op) - 19, twee, '#6ee7b7');
        }
      }
      // De maten van wat gekozen is, of van het hele huis bij Vorm.
      if (!actie?.type) {
        if (vorm) {
          for (const r of muren.filter((x) => x.soort === 2 && x.tot - x.van >= 20)) {
            const mid = (r.van + r.tot) / 2;
            const buitenkant = (r.as === 'x' ? v.cel[Math.floor(mid) * v.W + r.op] : v.cel[r.op * v.W + Math.floor(mid)]) === BUITEN ? 1 : -1;
            s += r.as === 'x' ? pil(X(r.op) + buitenkant * 22, Y(mid), meter(r.tot - r.van), '#6ee7b7', true) : pil(X(mid), Y(r.op) - buitenkant * 20, meter(r.tot - r.van), '#6ee7b7');
          }
        } else if (st.kies?.soort === 'ruimte' && m[st.kies.id]?.r && !app) {
          const r = m[st.kies.id].r;
          // Alleen waar ze de naam niet in de weg zitten; de maat staat ook in het blad.
          if ((r.x1 - r.x0) * k > 150 && (r.y1 - r.y0) * k > 110) {
            s += pil(X((r.x0 + r.x1) / 2), Y(r.y1) + 20, meter(r.x1 - r.x0));
            s += pil(X(r.x0) + 20, Y((r.y0 + r.y1) / 2), meter(r.y1 - r.y0), '#a9e6ff', true);
          }
        }
      }
      // Bij Vorm: wat er naast het hoofdhuis staat, met zijn naam; een gekozen gebouw met een blauwe rand.
      if (vorm && (!actie?.type || actie.type === 'blokmaat')) {
        for (const b0 of bijBlokken()) {
          const aan = st.kies?.soort === 'blok' && st.kies.id === b0.id;
          const b = maatVan(b0);
          const [x0, y0, x1, y1] = [X(MARGE + b.u / CEL), Y(MARGE + b.v / CEL), X(MARGE + (b.u + b.b) / CEL), Y(MARGE + (b.v + b.d) / CEL)];
          if (aan) s += `<rect x="${Math.min(x0, x1).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${Math.abs(x1 - x0).toFixed(1)}" height="${Math.abs(y1 - y0).toFixed(1)}" fill="rgb(111 211 255 / 0.14)" stroke="#6fd3ff" stroke-width="3" pointer-events="none"/>`;
          const naam = T(`ht.bron.blok.${b.soort}`);
          const Naam = esc(naam.charAt(0).toUpperCase() + naam.slice(1));
          const past = Math.abs(x1 - x0) > naam.length * 6.5;
          // Op het erf (20 november 2026): de naam met "bij Buiten", erboven als het gebouw te smal is.
          if (opErfBlokken().some((q) => q.id === b.id)) {
            const ty = past ? (y0 + y1) / 2 - 2 : Math.min(y0, y1) - 22;
            s += `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="#a9e6ff" pointer-events="none">${Naam}</text>`;
            s += `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${(ty + 14).toFixed(1)}" text-anchor="middle" ${FONT} font-size="11" font-weight="600" fill="rgb(169 230 255 / 0.75)" pointer-events="none">${esc(T('ht.gebouw.bijBuiten'))}</text>`;
          } else if (past) s += `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${((y0 + y1) / 2 + 4).toFixed(1)}" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="rgb(255 255 255 / 0.7)" pointer-events="none">${Naam}</text>`;
        }
      }
      s += kaartLaag(vorm);
      if (st.stand === 'dak') s += dakLaag();
      laag('namen').innerHTML = s;

      // De apparaten: een rond icoon; dichtbij ook de naam.
      s = '';
      if (app) {
        // Van ver klein genoeg om elkaar niet te dekken; dichtbij groot genoeg voor een vinger.
        const R = klem(k * 3.4, 12, 25);
        const dichtbij = st.zoom != null;
        for (const p of apparaatPunten()) {
          const gekozen = st.kies?.soort === 'apparaat' && st.kies.id === p.a.id;
          const dim = st.zoom != null && st.zoom !== p.ruimte;
          const sleept = actie?.type === 'apparaat' && actie.a.id === p.a.id;
          const x = sleept ? actie.px : X(p.x);
          const y = sleept ? actie.py : Y(p.y);
          const kleur = APP_KLEUR[p.a.soort] ?? '#eef3f7';
          s += `<g class="ht-ap${gekozen ? ' gekozen' : ''}${sleept ? ' sleept' : ''}" data-ap="${esc(p.a.id)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" opacity="${dim ? 0.3 : 1}" style="color: ${kleur}"><circle r="${gekozen || sleept ? R + 3 : R}" fill="#0d1a30" stroke="${gekozen || sleept ? '#6fd3ff' : p.zelf ? 'rgb(255 255 255 / 0.55)' : 'rgb(255 255 255 / 0.28)'}" stroke-width="${gekozen || sleept ? 3 : 1.5}"${p.zelf ? '' : ' stroke-dasharray="3 3"'}/>${ik(APP_ICOON[p.a.soort] ?? p.a.soort).replace('<svg ', `<svg x="${-R * 0.56}" y="${-R * 0.56}" width="${R * 1.12}" height="${R * 1.12}" `)}${(dichtbij && !dim) || gekozen ? `<text y="${R + 15}" text-anchor="middle" ${FONT} font-size="12" font-weight="600" fill="#eef3f7" paint-order="stroke" stroke="#0d1a30" stroke-width="4">${esc(p.a.naam)}</text>` : ''}</g>`;
        }
      }
      laag('app').innerHTML = s;
      laag('over').innerHTML = over;
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
        const gekozen = (st.kies?.soort === 'opening' && st.kies.id === o.id) || actie?.kandidaat?.o?.id === o.id;
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
          if (st.apparaten.some((a) => a.raam === o.id && a.plek?.etage === st.etage)) s2 += `<path d="${lijn(-openingBinnen(v, o) * 1.6, o.van + 0.5, o.tot - 0.5)}" stroke="#ff9a6b" stroke-width="2.4" stroke-dasharray="4 3" vector-effect="non-scaling-stroke" fill="none"/>`;
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
      if (st.stand !== 'kamers' || st.kies?.soort !== 'opening') return null;
      const o = (v.openingen ?? []).find((x) => x.id === st.kies.id);
      if (!o || !MET_SCHARNIER.has(o.soort) || !openingMuur(v, o)) return null;
      const b = deurBladen(v, o)[0];
      return { x: b.hx, y: b.hy, o };
    }
    /** De trap: treden dwars op de richting, en een pijl naar boven. */
    function trapPad(v, mm) {
      let s2 = '';
      for (const [id, r] of Object.entries(v.ruimtes)) {
        if (soortVan(r) !== 'trap' || !mm[id]?.r) continue;
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
      if (!st.eigen) return null;
      const b = T('ht.heleHuis').length * 7.4 + 24;
      return { x: B - b - 10, y: 10, b, h: 32 };
    }

    /* ---------- wat ligt er onder de vinger */
    const punt = (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) * B) / r.width;
      const py = ((e.clientY - r.top) * Hpx) / r.height;
      return { px, py, x: (px - ox) / k, y: (oy - py) / k };
    };
    const ruimteOp = (v, x, y) => {
      const cx = Math.floor(x);
      const cy = Math.floor(y);
      if (cx < 0 || cy < 0 || cx >= v.W || cy >= v.H) return BUITEN;
      return v.cel[cy * v.W + cx];
    };
    /** De deur of het raam vlak bij de vinger, op deze vloer. */
    function openingBij(p, tolPx) {
      const tol = tolPx / k;
      let best = null;
      const v = vloer();
      for (const o of v.openingen ?? []) {
        if (!openingMuur(v, o)) continue;
        const dw = Math.abs((o.as === 'x' ? p.x : p.y) - o.op);
        const l = o.as === 'x' ? p.y : p.x;
        if (dw > tol || l < o.van - 1 || l > o.tot + 1) continue;
        if (!best || dw < best.d) best = { d: dw, o };
      }
      return best?.o ?? null;
    }
    /** De muurlijn waar een opening op ligt (langer of korter dan de opening). */
    const muurVan = (v, o) => randen(v, isMuur).find((r) => r.as === o.as && r.op === o.op && r.van <= o.van && r.tot >= o.tot) ?? null;
    /** Het raam vlak bij een plek (een screen dat je erheen sleept), binnen 80 cm. */
    function raamBij(v, x, y) {
      let best = null;
      for (const o of v.openingen ?? []) {
        if (o.soort !== 'raam' || !openingMuur(v, o)) continue;
        const dw = Math.abs((o.as === 'x' ? x : y) - o.op);
        const l = o.as === 'x' ? y : x;
        const buiten = Math.max(0, o.van - l, l - o.tot);
        const d = Math.hypot(dw, buiten);
        if (d <= 8 && (!best || d < best.d)) best = { d, o };
      }
      return best?.o ?? null;
    }
    function muurBij(p, tolPx) {
      const tol = tolPx / k;
      let best = null;
      for (const r of randen(vloer(), isMuur)) {
        if (r.soort !== (st.stand === 'vorm' ? 2 : 1) && !(metOpeningen && st.stand === 'kamers' && r.soort === 2)) continue;
        const dwars = Math.abs((r.as === 'x' ? p.x : p.y) - r.op);
        const langs = r.as === 'x' ? p.y : p.x;
        // Vlak bij een hoek liever niets pakken dan de verkeerde muur.
        if (dwars > tol || langs < r.van + Math.min(1.5, (r.tot - r.van) / 4) || langs > r.tot - Math.min(1.5, (r.tot - r.van) / 4)) continue;
        // In een smalle ruimte pak je de muur alleen vlak erbij: het midden blijft om de ruimte zelf aan te tikken.
        const vl = vloer();
        const kant = (r.as === 'x' ? p.x : p.y) < r.op ? -1 : 1;
        const lees = (i) => (r.as === 'x' ? ruimteOp(vl, i, langs) : ruimteOp(vl, langs, i));
        if (vastId(vl, lees(r.op - 1)) || vastId(vl, lees(r.op))) continue;
        const eigen = lees(kant < 0 ? r.op - 1 : r.op);
        let breed = 0;
        while (breed < 60 && lees(kant < 0 ? r.op - 1 - breed : r.op + breed) === eigen) breed++;
        if (dwars > Math.max(1, breed * 0.3)) continue;
        if (!best || dwars < best.d) best = { d: dwars, r };
      }
      return best?.r ?? null;
    }
    /** De ruimte waar een ruimte het meest aan grenst: die komt terug waar hij weggaat. Zonder buur: null. */
    function buurVoor(v, id) {
      const tel = {};
      const groot = {};
      const { W, H, cel } = v;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          groot[cel[y * W + x]] = (groot[cel[y * W + x]] ?? 0) + 1;
          if (cel[y * W + x] !== id) continue;
          for (const b of [x > 0 ? cel[y * W + x - 1] : BUITEN, x < W - 1 ? cel[y * W + x + 1] : BUITEN, y > 0 ? cel[(y - 1) * W + x] : BUITEN, y < H - 1 ? cel[(y + 1) * W + x] : BUITEN]) if (b !== BUITEN && b !== id) tel[b] = (tel[b] ?? 0) + 1;
        }
      }
      // Bij gelijke stand de kleinste buur: een kast in de hoek van de hal hoort bij de hal, niet bij de kamer erachter.
      const best = Object.entries(tel).sort((a, b) => b[1] - a[1] || groot[a[0]] - groot[b[0]])[0];
      return best ? Number(best[0]) : null;
    }
    /** Een ruimte is te verplaatsen als hij in een grotere staat of ertegenaan ligt; de grote kamer zelf niet. */
    function verplaatsbaar(v, id) {
      if (vastId(v, id)) return false;
      const b = buurVoor(v, id);
      if (b == null) return false;
      let eigen = 0;
      let buur = 0;
      for (let i = 0; i < v.cel.length; i++) {
        if (v.cel[i] === id) eigen++;
        else if (v.cel[i] === b) buur++;
      }
      return eigen < buur;
    }
    /** Waar de greep staat om een gekozen ruimte te verplaatsen: midden in zijn grootste rechte stuk. */
    function greepPlek(v) {
      if (st.stand !== 'kamers' || st.kies?.soort !== 'ruimte') return null;
      const r = maten(v)[st.kies.id]?.r;
      if (!r || !verplaatsbaar(v, st.kies.id)) return null;
      return { px: X((r.x0 + r.x1) / 2), py: Y((r.y0 + r.y1) / 2) };
    }
    function zoneBij(p, tolPx) {
      const tol = tolPx / k;
      for (const zz of zonesOp(vloer())) {
        for (const r of zz.stukken) {
          const dwars = Math.abs((r.as === 'x' ? p.x : p.y) - r.op);
          const langs = r.as === 'x' ? p.y : p.x;
          if (dwars <= tol && langs >= r.van && langs <= r.tot) return { kamer: zz.kamer, id: zz.id, m: r };
        }
      }
      return null;
    }
    function apparaatBij(p, tolPx) {
      let best = null;
      for (const q of apparaatPunten()) {
        if (st.zoom != null && st.zoom !== q.ruimte) continue;
        const d = Math.hypot(X(q.x) - p.px, Y(q.y) - p.py);
        if (d <= tolPx && (!best || d < best.d)) best = { d, q };
      }
      return best?.q ?? null;
    }
    /** De muurlijnen op deze etage en die eronder: daar klikt een vak of een muur aan vast. */
    function magneten(as, zonder) {
      const uit = new Set();
      for (const r of randen(vloer(), isMuur)) if (r.as === as && r !== zonder && !(zonder && r.op === zonder.op && r.as === zonder.as)) uit.add(r.op);
      const e = onder();
      if (e && st.stand === 'kamers') for (const r of randen(st.vloeren[e.id], isMuur)) if (r.as === as) uit.add(r.op);
      return [...uit];
    }
    const klik = (n, lijst, bereik) => {
      let best = Math.round(n);
      let d = bereik;
      for (const m of lijst) {
        if (Math.abs(n - m) < d) {
          d = Math.abs(n - m);
          best = m;
        }
      }
      return best;
    };

    /* ---------- zoomen: knijpen met twee vingers, of het wieltje */
    /** Hoe groot het hele huis past: verder uitzoomen hoeft niet. */
    const pasK = () => {
      const h = heleKijk();
      return Math.min(B / (h.x1 - h.x0), Hpx / (h.y1 - h.y0));
    };
    /** Zoom naar schaal `k1`, met ruitje `g` onder schermpunt `m`. */
    function zoomNaar(k1, g, m) {
      cancelAnimationFrame(anim);
      const kp = pasK();
      k1 = klem(k1, kp, Math.max(kp * 1.01, 16));
      if (k1 <= kp * 1.03) {
        st.eigen = null;
        zetKijk(zoomDoel());
        return teken();
      }
      const ox1 = m.px - g.x * k1;
      const oy1 = m.py + g.y * k1;
      const r = { x0: -ox1 / k1, x1: (B - ox1) / k1, y0: (oy1 - Hpx) / k1, y1: oy1 / k1 };
      // Het midden van wat je ziet blijft boven het huis.
      const h = heleKijk();
      const cx = (r.x0 + r.x1) / 2;
      const cy = (r.y0 + r.y1) / 2;
      const sx = klem(cx, h.x0, h.x1) - cx;
      const sy = klem(cy, h.y0, h.y1) - cy;
      st.eigen = { x0: r.x0 + sx, x1: r.x1 + sx, y0: r.y0 + sy, y1: r.y1 + sy };
      zetKijk(st.eigen);
      teken();
    }
    const opScherm = (c) => {
      const r = svg.getBoundingClientRect();
      return { px: ((c.x - r.left) * B) / r.width, py: ((c.y - r.top) * Hpx) / r.height };
    };
    /** De vingers die nu op de tekening staan. */
    const wijzers = new Map();
    let knijp = null;
    function beginKnijp() {
      const [a, b] = [...wijzers.values()].map(opScherm);
      const m = { px: (a.px + b.px) / 2, py: (a.py + b.py) / 2 };
      knijp = { ids: [...wijzers.keys()], d0: Math.max(20, Math.hypot(a.px - b.px, a.py - b.py)), k0: k, g: { x: (m.px - ox) / k, y: (oy - m.py) / k } };
    }
    function knijpVerder() {
      const [a, b] = knijp.ids.map((id) => opScherm(wijzers.get(id)));
      const m = { px: (a.px + b.px) / 2, py: (a.py + b.py) / 2 };
      zoomNaar((knijp.k0 * Math.hypot(a.px - b.px, a.py - b.py)) / knijp.d0, knijp.g, m);
    }
    function heelHuis() {
      st.eigen = null;
      kijkNaar(zoomDoel());
    }
    svg.addEventListener(
      'wheel',
      (e) => {
        if (st.stand === 'huis' || actie) return;
        e.preventDefault();
        const m = opScherm({ x: e.clientX, y: e.clientY });
        zoomNaar(k * Math.exp(-e.deltaY * 0.0015), { x: (m.px - ox) / k, y: (oy - m.py) / k }, m);
      },
      { passive: false },
    );

    /* ---------- het gebaar */
    let actie = null;
    function neer(e) {
      if (e.button > 0) return;
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {
        // Een nagebootste vinger kan dat niet; de luisteraars doen het dan nog.
      }
      e.preventDefault();
      wijzers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (wijzers.size > 1) {
        // Een tweede vinger: knijpen en schuiven. Wat de eerste vinger begon, gaat niet door.
        if (wijzers.size === 2 && !knijp && st.stand !== 'huis') {
          if (actie) afgebroken();
          beginKnijp();
        }
        return;
      }
      if (actie || knijp) return;
      const p = punt(e);
      const vinger = e.pointerType !== 'mouse';
      actie = { wijzer: e.pointerId, start: p, vinger, type: null, kandidaat: { soort: 'niets' } };
      if (st.stand === 'huis') {
        // Opzij slepen draait het huis.
        actie.type = 'draai';
        actie.hoek0 = st.hoek;
        return;
      }
      // Dak (stap 4 punt 3): een dakkapel pakken om te schuiven of aan een zijkant te rekken; ernaast tikken laat hem los.
      if (st.stand === 'dak') {
        const raak = kapelOp(p, vinger ? 16 : 8);
        if (raak) {
          Object.assign(actie, { type: 'kapel', kapel: { ...raak, was: { ...st.kapellen[raak.i] } } });
          st.kies = { soort: 'kapel', i: raak.i };
          st.kapelErbij = null;
        } else {
          actie.type = 'niets';
          st.kies = null;
        }
        teken();
        meld();
        return;
      }
      // Ronde 2: tijdens het zoeken van de kaarten kies je bij Vorm niets; een gebouw op maat trek je aan zijn stippen.
      if (st.stand === 'vorm' && huis.kijk?.bezig) {
        actie.type = 'niets';
        return;
      }
      // Het afdak (ronde 2) is smal: wie erin of op zijn label tikt, bedoelt het afdak en niet de muur ervoor.
      if (st.stand === 'vorm' && st.etage === benedenId()) {
        const af = afdakVak();
        const [mx, my] = [(p.x - MARGE) * CEL, (p.y - MARGE) * CEL];
        const opPil = afdakPil && p.px >= afdakPil.x - 6 && p.px <= afdakPil.x + afdakPil.b + 6 && p.py >= afdakPil.y - 6 && p.py <= afdakPil.y + afdakPil.h + 6;
        if (af && (opPil || (mx > af.u0 + 0.3 && mx < af.u1 - 0.3 && my >= af.v0 && my <= af.v1))) {
          actie.kandidaat = { soort: 'afdak' };
          return;
        }
      }
      const greep = st.stand === 'vorm' ? blokGrepen().find((q) => Math.hypot(q.px - p.px, q.py - p.py) <= (vinger ? 24 : 12)) : null;
      if (greep) {
        const b = maatVan(bijBlokken().find((q) => q.id === st.kies.id));
        Object.assign(actie, { type: 'blokmaat', greep, id: b.id, was: { u: b.u, v: b.v, b: b.b, d: b.d } });
        return;
      }
      const hk = heelKnop();
      if (hk && p.px >= hk.x - 6 && p.px <= hk.x + hk.b + 6 && p.py >= hk.y - 6 && p.py <= hk.y + hk.h + 6) {
        actie.kandidaat = { soort: 'heel' };
        return;
      }
      // De stip op het scharnier: een tik zet het scharnier aan het andere eind (20 november 2026).
      const sp = metOpeningen ? scharnierStip(vloer()) : null;
      if (sp && Math.hypot(X(sp.x) - p.px, Y(sp.y) - p.py) <= (vinger ? 24 : 14)) {
        actie.kandidaat = { soort: 'scharnier', o: sp.o };
        return;
      }
      // Een deur of raam: aantikken of langs de muur schuiven.
      const op = metOpeningen && st.stand === 'kamers' ? openingBij(p, vinger ? 22 : 10) : null;
      if (op) {
        actie.kandidaat = { soort: 'opening', o: op };
        teken();
        return;
      }
      // Een gekozen ruimte sleep je in zijn geheel weg: overal binnen de ruimte, of aan de greep in het midden.
      const g = greepPlek(vloer());
      const dg = g ? Math.hypot(g.px - p.px, g.py - p.py) : Infinity;
      const opGreep = dg <= (vinger ? 30 : 20);
      if (g && ruimteOp(vloer(), p.x, p.y) === st.kies.id) actie.gekozen = st.kies.id;
      if (opGreep || actie.gekozen != null) {
        // Vlak bij een muur pak je de muur: wat het dichtst bij de vinger ligt, wint (in een klein vak ligt de muur ook bij de greep).
        const mg = muurBij(p, vinger ? 20 : 9);
        const dm = mg ? Math.abs((mg.as === 'x' ? p.x : p.y) - mg.op) * k : Infinity;
        if (dm >= dg || (!opGreep && !mg)) {
          actie.kandidaat = { soort: 'verplaats', id: st.kies.id, greep: opGreep };
          return;
        }
      }
      if (st.stand === 'apparaten') {
        const q = apparaatBij(p, vinger ? 32 : 24);
        if (q) actie.kandidaat = { soort: 'apparaat', q };
      } else {
        const m = muurBij(p, vinger ? 20 : 9);
        const z = !m && st.stand === 'kamers' ? zoneBij(p, vinger ? 20 : 9) : null;
        actie.kandidaat = m ? { soort: 'muur', m } : z ? { soort: 'zone', ...z } : { soort: 'vak' };
        if (m) teken();
      }
    }
    function beweeg(e) {
      if (wijzers.has(e.pointerId)) wijzers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (knijp) {
        if (knijp.ids.includes(e.pointerId)) knijpVerder();
        return;
      }
      if (!actie || e.pointerId !== actie.wijzer) return;
      const p = punt(e);
      const dx = p.px - actie.start.px;
      const dy = p.py - actie.start.py;
      if (actie.type === 'kapel') {
        const { i, wat, m, was } = actie.kapel;
        const da = (m.langs ? p.y - actie.start.y : p.x - actie.start.x) * CEL;
        const breed = was.tot - was.van;
        const kk = st.kapellen[i];
        if (wat === 'schuif') {
          kk.van = r1(klem(was.van + da, 0, m.la - breed));
          kk.tot = r1(kk.van + breed);
        } else if (wat === 'van') kk.van = r1(klem(was.van + da, 0, was.tot - 0.6));
        else kk.tot = r1(klem(was.tot + da, was.van + 0.6, m.la));
        if (Math.abs(da) > 0.05) actie.kapel.verschoven = true;
        teken();
        return;
      }
      if (actie.type === 'blokmaat') {
        const { ku, kv } = actie.greep;
        const du = (p.x - actie.start.x) * CEL;
        const dv = (p.y - actie.start.y) * CEL;
        const w = actie.was;
        let { u, v, b, d } = w;
        if (ku < 0) {
          u = Math.min(w.u + du, w.u + w.b - 1);
          b = w.u + w.b - u;
        } else if (ku > 0) b = Math.max(1, w.b + du);
        if (kv < 0) {
          v = Math.min(w.v + dv, w.v + w.d - 1);
          d = w.v + w.d - v;
        } else if (kv > 0) d = Math.max(1, w.d + dv);
        st.blokMaat = { id: actie.id, u: r1(u), v: r1(v), b: r1(Math.min(40, b)), d: r1(Math.min(40, d)) };
        if (Math.abs(du) > 0.05 || Math.abs(dv) > 0.05) actie.verschoven = true;
        teken();
        return;
      }
      if (actie.type === 'draai') {
        st.hoek = klem(actie.hoek0 + dx * 0.35, -65, 65);
        teken();
        return;
      }
      if (!actie.type) {
        if (Math.hypot(dx, dy) < (actie.vinger ? 10 : 5)) return;
        let kd = actie.kandidaat;
        // In een gekozen ruimte bij een muur: recht van de muur af schuift de muur, schuin of erlangs verplaatst de ruimte.
        if (actie.gekozen != null && (kd.soort === 'muur' || kd.soort === 'zone') && !(Math.abs(kd.m.as === 'x' ? dx : dy) > Math.abs(kd.m.as === 'x' ? dy : dx) * 1.4)) {
          kd = actie.kandidaat = { soort: 'verplaats', id: actie.gekozen, greep: false };
        }
        if (kd.soort === 'verplaats') {
          // De ruimte optillen: waar hij stond komt de ruimte terug waar hij het meest aan grenst.
          const v0 = vloer();
          actie.type = 'verplaats';
          actie.cellen = [];
          for (let i = 0; i < v0.cel.length; i++) if (v0.cel[i] === kd.id) actie.cellen.push(i);
          actie.basis = kopie(v0);
          const vul = buurVoor(v0, kd.id);
          for (const c of actie.cellen) actie.basis.cel[c] = vul;
          actie.bb = maten(v0)[kd.id];
          actie.d = [0, 0];
          const lijnen = randen(actie.basis, isMuur);
          actie.mx = [...new Set(lijnen.filter((r) => r.as === 'x').map((r) => r.op))];
          actie.my = [...new Set(lijnen.filter((r) => r.as === 'y').map((r) => r.op))];
        } else if (kd.soort === 'muur') {
          // Recht van de muur af is schuiven; schuin of erlangs is een vak trekken dat bij de muur begint.
          const dwars = Math.abs(kd.m.as === 'x' ? dx : dy);
          const langs = Math.abs(kd.m.as === 'x' ? dy : dx);
          // Buiten is de buitenmuur de erfgrens: die schuif je ook bij Kamers (19 november 2026).
          const opErf = !!etageVan(st.etage)?.buiten;
          if (dwars > langs * 1.4 && !(kd.m.soort === 2 && st.stand === 'kamers' && !opErf)) {
            actie.type = 'muur';
            actie.begin = kopie(vloer());
            actie.ruimte = muurRuimte(actie.begin, kd.m, opErf);
            actie.nu = { ...kd.m };
            actie.magneet = magneten(kd.m.as, kd.m);
          } else actie.type = 'vak';
        } else if (kd.soort === 'zone') {
          const dwars = Math.abs(kd.m.as === 'x' ? dx : dy);
          const langs = Math.abs(kd.m.as === 'x' ? dy : dx);
          if (dwars > langs * 1.4) {
            actie.type = 'zone';
            actie.kamer = kd.kamer;
            actie.nuOp = kd.m.op;
            actie.magneet = magneten(kd.m.as);
          } else actie.type = 'vak';
        } else if (kd.soort === 'opening') {
          actie.type = 'opening';
          actie.begin = foto();
          actie.o0 = { ...kd.o };
          actie.run = muurVan(vloer(), kd.o);
          if (!actie.run) {
            actie.type = 'niets';
            return;
          }
        } else if (kd.soort === 'apparaat') {
          actie.type = 'apparaat';
          actie.a = kd.q.a;
          actie.van = kd.q;
          // De vinger dekt het icoon af: til het er een stukje boven.
          actie.dx = X(kd.q.x) - actie.start.px;
          actie.dy = Y(kd.q.y) - actie.start.py - (actie.vinger ? 30 : 0);
        } else if (kd.soort === 'vak') actie.type = 'vak';
        else if (kd.soort === 'heel') {
          // Van de knop af geschoven: dan niets.
          actie.type = 'niets';
          return;
        } else return;
        if (actie.type === 'vak') {
          const sx = klik(actie.start.x, magneten('x'), 3.2);
          const sy = klik(actie.start.y, magneten('y'), 3.2);
          actie.hoek = { x: sx, y: sy };
          teken();
        }
      }
      if (actie.type === 'opening') {
        const o0 = actie.o0;
        const o = vloer().openingen.find((x) => x.id === o0.id);
        const w = o0.tot - o0.van;
        const van = Math.round(klem(o0.van + (o0.as === 'x' ? -dy : dx) / k, actie.run.van + 1, actie.run.tot - 1 - w));
        if (o && van !== o.van) {
          o.van = van;
          o.tot = van + w;
          st.kies = { soort: 'opening', id: o.id };
          teken();
          meld();
        }
        return;
      }
      if (actie.type === 'muur') {
        const m = actie.kandidaat.m;
        const ruw = m.op + (m.as === 'x' ? dx : -dy) / k;
        const nieuw = klem(klik(ruw, actie.magneet, 1.3), actie.ruimte.min, actie.ruimte.max);
        if (nieuw === actie.nu.op) return;
        actie.nu = { ...m, op: nieuw };
        actie.gelijk = actie.magneet.includes(nieuw);
        actie.voorbeeld = muurNaar(actie.begin, m, nieuw);
        over = muurMaten(actie.voorbeeld, actie.nu, m.as === 'x' ? p.y : p.x, actie.gelijk);
        teken();
        meld();
      } else if (actie.type === 'verplaats') {
        const { bb, basis, cellen } = actie;
        // Een kant van de ruimte klikt vast aan een muur in de buurt.
        const klikKant = (d, lo, hi, lijst) => {
          let best = Math.round(d);
          let afstand = 1.6;
          for (const m of lijst) {
            for (const rand of [lo, hi]) {
              const a = Math.abs(rand + d - m);
              if (a < afstand) {
                afstand = a;
                best = m - rand;
              }
            }
          }
          return best;
        };
        const ddx = klikKant(dx / k, bb.x0, bb.x1, actie.mx);
        const ddy = klikKant(-dy / k, bb.y0, bb.y1, actie.my);
        if (ddx === actie.d[0] && ddy === actie.d[1]) return;
        // Alleen waar hij helemaal in het huis past.
        const W = basis.W;
        const past = cellen.every((c) => {
          const x = (c % W) + ddx;
          const y = ((c / W) | 0) + ddy;
          return x >= 0 && y >= 0 && x < W && y < basis.H && basis.cel[y * W + x] !== BUITEN;
        });
        if (!past) return;
        actie.d = [ddx, ddy];
        const v = kopie(basis);
        for (const c of cellen) v.cel[c + ddy * W + ddx] = actie.kandidaat.id;
        actie.voorbeeld = v;
        const o = omtrek(basis);
        over = pil(X((bb.x0 + bb.x1) / 2 + ddx), Y(bb.y1 + ddy) - 18, T('ht.vanLinksVoor', { links: meter(bb.x0 + ddx - o.x0), voor: meter(bb.y0 + ddy - o.y0) }));
        teken();
      } else if (actie.type === 'zone') {
        // De zonelijn schuift binnen zijn kamer; de muren blijven staan.
        const m = actie.kandidaat.m;
        const mm = maten(vloer())[actie.kandidaat.id];
        const ruw = m.op + (m.as === 'x' ? dx : -dy) / k;
        const [lo, hi] = m.as === 'x' ? [mm.x0 + MIN, mm.x1 - MIN] : [mm.y0 + MIN, mm.y1 - MIN];
        const nieuw = klem(klik(ruw, actie.magneet, 1.3), lo, hi);
        if (nieuw === actie.nuOp) return;
        actie.nuOp = nieuw;
        actie.voorbeeld = kopie(vloer());
        actie.voorbeeld.zones[actie.kamer].op = nieuw;
        const langs = m.as === 'x' ? p.y : p.x;
        const [a, b] = m.as === 'x' ? [nieuw - mm.x0, mm.x1 - nieuw] : [nieuw - mm.y0, mm.y1 - nieuw];
        over = m.as === 'x' ? pil(X(nieuw - a / 2), Y(langs), meter(a), '#6ee7b7') + pil(X(nieuw + b / 2), Y(langs), meter(b), '#6ee7b7') : pil(X(langs), Y(nieuw - a / 2), meter(a), '#6ee7b7') + pil(X(langs), Y(nieuw + b / 2), meter(b), '#6ee7b7');
        teken();
      } else if (actie.type === 'vak') {
        const x = klik(p.x, magneten('x'), 3.2);
        const y = klik(p.y, magneten('y'), 3.2);
        const r = { x0: Math.min(actie.hoek.x, x), y0: Math.min(actie.hoek.y, y), x1: Math.max(actie.hoek.x, x), y1: Math.max(actie.hoek.y, y) };
        actie.recht = r;
        const goed = r.x1 - r.x0 >= MIN - 1 && r.y1 - r.y0 >= MIN - 1;
        const kleur = goed ? '#6fd3ff' : 'rgb(255 255 255 / 0.4)';
        over = `<rect x="${X(r.x0)}" y="${Y(r.y1)}" width="${(r.x1 - r.x0) * k}" height="${(r.y1 - r.y0) * k}" rx="3" fill="rgb(111 211 255 / ${goed ? 0.16 : 0.05})" stroke="${kleur}" stroke-width="2.5" stroke-dasharray="8 6" pointer-events="none"/>`;
        if (goed) over += pil(X((r.x0 + r.x1) / 2), Y((r.y0 + r.y1) / 2), `${nl((r.x1 - r.x0) * CEL)} × ${nl((r.y1 - r.y0) * CEL)} m`);
        laag('over').innerHTML = over;
      } else if (actie.type === 'apparaat') {
        let px = p.px + actie.dx;
        let py = p.py + actie.dy;
        const v = vloer();
        let x = (px - ox) / k;
        let y = (oy - py) / k;
        const id = ruimteOp(v, x, y);
        let muurBijPlek = false;
        if (id !== BUITEN) {
          // Bij een muur klikt het vast, op 20 cm ervan.
          const tot = (ddx, ddy) => {
            let n = 0;
            while (n < 6 && ruimteOp(v, x + ddx * (n + 0.5), y + ddy * (n + 0.5)) === id) n++;
            return n;
          };
          for (const [ddx, ddy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const n = tot(ddx, ddy);
            if (n > 4) continue;
            muurBijPlek = true;
            // De muur ligt op de rand van het eerste ruitje dat niet meer van de ruimte is.
            if (ddx < 0) x = Math.floor(x - n - 0.5) + 1 + 2;
            else if (ddx > 0) x = Math.floor(x + n + 0.5) - 2;
            else if (ddy < 0) y = Math.floor(y - n - 0.5) + 1 + 2;
            else y = Math.floor(y + n + 0.5) - 2;
          }
          px = X(x);
          py = Y(y);
        }
        const kan = id !== BUITEN && !!v.ruimtes[id]?.kamer && !vastId(v, id);
        const anders = actie.doel !== (kan ? id : null);
        actie.doel = kan ? id : null;
        actie.px = px;
        actie.py = py;
        actie.plek = kan ? { etage: st.etage, x, y } : null;
        const naam = id === BUITEN ? T('ht.buitenHuis') : kan ? `${naamVan(v.ruimtes[id])}${muurBijPlek ? ` · ${T('ht.aanDeMuur')}` : ''}` : T('ht.nogGeenKamer');
        over = pil(px, py - 44, naam, kan ? '#6ee7b7' : '#ffb090');
        if (anders) teken();
        else {
          const g = svg.querySelector(`[data-ap="${CSS.escape(actie.a.id)}"]`);
          if (g) g.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
          else teken();
          laag('over').innerHTML = over;
        }
      }
    }
    /** De maten aan weerszijden van een muur, op de hoogte van de vinger. */
    function muurMaten(v, run, langs, gelijk) {
      const j = klem(Math.floor(langs), run.van, run.tot - 1);
      const lees = (i) => (run.as === 'x' ? ruimteOp(v, i, j) : ruimteOp(v, j, i));
      const tel = (start, d) => {
        const id = lees(start);
        let n = 0;
        while (n < 600 && lees(start + d * n) === id && id !== BUITEN) n++;
        return n;
      };
      const a = tel(run.op - 1, -1);
      const b = tel(run.op, 1);
      let s = '';
      const zet = (midden, tekst) => (run.as === 'x' ? pil(X(midden), Y(j + 0.5), tekst) : pil(X(j + 0.5), Y(midden), tekst));
      if (a) s += zet(run.op - a / 2, meter(a));
      if (b) s += zet(run.op + b / 2, meter(b));
      if (gelijk) {
        // Op één lijn met een andere muur: een dunne lijn over het hele huis.
        s += run.as === 'x' ? `<path d="M${X(run.op)} 0V${Hpx}" stroke="#6ee7b7" stroke-opacity="0.6" stroke-dasharray="3 5"/>` : `<path d="M0 ${Y(run.op)}H${B}" stroke="#6ee7b7" stroke-opacity="0.6" stroke-dasharray="3 5"/>`;
      }
      return s;
    }
    /** Een vinger van de tekening af: na het knijpen gebeurt er niets tot ze allebei los zijn. */
    function vingerWeg(id) {
      wijzers.delete(id);
      if (knijp && !wijzers.size) knijp = null;
    }
    function los(e) {
      vingerWeg(e.pointerId);
      if (!actie || e.pointerId !== actie.wijzer) return;
      const a = actie;
      actie = null;
      over = '';
      if (a.type === 'draai') return meld();
      if (a.type === 'niets') return;
      if (a.type === 'blokmaat') {
        if (a.verschoven) blokMaatBewaar(0);
        teken();
        return meld();
      }
      if (a.type === 'kapel') {
        if (a.kapel.verschoven) kapelBewaar();
        teken();
        return meld();
      }
      if (!a.type) return a.kandidaat.soort === 'heel' ? heelHuis() : tik(a);
      if (a.type === 'verplaats') {
        if (a.voorbeeld && (a.d[0] || a.d[1])) {
          stap();
          // Wat in de ruimte een eigen plek had, verhuist mee.
          const inRuimte = new Set(a.cellen);
          for (const dev of st.apparaten) {
            const pl = dev.plek;
            if (pl && pl.etage === st.etage && inRuimte.has(Math.floor(pl.y) * a.basis.W + Math.floor(pl.x))) dev.plek = { ...pl, x: pl.x + a.d[0], y: pl.y + a.d[1] };
          }
          st.vloeren[st.etage] = a.voorbeeld;
          ordenen(vloer());
          st.kies = vloer().ruimtes[a.kandidaat.id] ? { soort: 'ruimte', id: a.kandidaat.id } : null;
        }
        return klaar();
      }
      if (a.type === 'muur') {
        if (a.nu.op !== a.kandidaat.m.op) {
          stap();
          st.vloeren[st.etage] = a.voorbeeld;
          ordenen(vloer());
          st.kies = { soort: 'muur', run: muurOpnieuw(a.nu) };
        }
        return klaar();
      }
      if (a.type === 'opening') {
        const o = vloer().openingen.find((x) => x.id === a.o0.id);
        if (o && o.van !== a.o0.van) stap(a.begin);
        st.kies = { soort: 'opening', id: a.o0.id };
        return klaar();
      }
      if (a.type === 'zone') {
        if (a.voorbeeld) {
          stap();
          vloer().zones[a.kamer].op = a.nuOp;
          st.kies = { soort: 'ruimte', id: a.kandidaat.id };
        }
        return klaar();
      }
      if (a.type === 'vak') {
        const r = a.recht;
        if (r && r.x1 - r.x0 >= MIN - 1 && r.y1 - r.y0 >= MIN - 1) nieuwVak(r);
        else teken();
        return meld();
      }
      if (a.type === 'apparaat') {
        if (a.plek && a.doel != null) {
          stap();
          const dev = st.apparaten.find((x) => x.id === a.a.id);
          const doelKamer = vloer().ruimtes[a.doel].kamer;
          // Binnen de tuin verschoven terwijl zijn deel nog geen vak heeft: het blijft in dat deel.
          const deelVan = dev.kamer ? kamers[dev.kamer]?.deelVan : null;
          dev.kamer = deelVan && deelVan === doelKamer && !kamerPlek()[dev.kamer] ? dev.kamer : doelKamer;
          dev.plek = a.plek;
          if (metOpeningen && dev.soort === 'screen') {
            const r = raamBij(vloer(), a.plek.x, a.plek.y);
            if (r) {
              dev.raam = r.id;
              // Vlak voor het raam, in het midden.
              const kant = openingBinnen(vloer(), r) * (openingMuur(vloer(), r) === 2 ? 1 : 1);
              const mid = (r.van + r.tot) / 2;
              dev.plek = r.as === 'x' ? { etage: st.etage, x: r.op + kant * 3, y: mid } : { etage: st.etage, x: mid, y: r.op + kant * 3 };
            } else delete dev.raam;
          }
          st.kies = { soort: 'apparaat', id: dev.id };
          if (st.zoom != null && st.zoom !== a.doel) st.zoom = a.doel;
        }
        return klaar();
      }
    }
    function afgebroken(e) {
      if (e) vingerWeg(e.pointerId);
      if (!actie || (e && e.pointerId !== actie.wijzer)) return;
      actie = null;
      over = '';
      teken();
      meld();
    }
    /** De muur na het schuiven terugvinden: hij kan langer of korter geworden zijn. */
    function muurOpnieuw(run) {
      const mid = (run.van + run.tot) / 2;
      const soort = st.stand === 'vorm' ? 2 : 1;
      const lijst = randen(vloer(), isMuur).filter((r) => r.as === run.as && r.op === run.op && r.soort === soort);
      return lijst.find((r) => r.van <= mid && r.tot >= mid) ?? lijst[0] ?? null;
    }

    function tik(a) {
      const p = a.start;
      const v = vloer();
      const id = ruimteOp(v, p.x, p.y);
      // Het huis op het erf: een tik geeft zijn blad, met de weg naar binnen (20 november 2026: eerst sprong hij meteen naar de begane grond, ook als je aan het tekenen was).
      if (vastId(v, id) && a.kandidaat.soort !== 'apparaat') {
        st.blad = null;
        st.kies = { soort: 'erfhuis', id };
        teken();
        return meld();
      }
      if (st.stand === 'apparaten') {
        if (a.kandidaat.soort === 'apparaat') {
          st.kies = { soort: 'apparaat', id: a.kandidaat.q.a.id };
        } else if (id !== BUITEN && st.wapen?.apparaat && v.ruimtes[id]?.kamer) {
          // Een apparaat uit de lijst gekozen, dan de kamer aangetikt: daar staat het.
          zetApparaat(st.wapen.apparaat, v.ruimtes[id].kamer, { etage: st.etage, x: p.x, y: p.y });
          return;
        } else if (id !== BUITEN && id !== st.zoom) {
          st.zoom = id;
          st.eigen = null;
          st.kies = { soort: 'ruimte', id };
          kijkNaar(zoomDoel());
        } else if (id === BUITEN && st.zoom != null) {
          st.zoom = null;
          st.eigen = null;
          st.kies = null;
          kijkNaar(zoomDoel());
        } else st.kies = id !== BUITEN ? { soort: 'ruimte', id } : null;
        teken();
        return meld();
      }
      if (a.kandidaat.soort === 'verplaats' && a.kandidaat.greep) return teken();
      if (a.kandidaat.soort === 'scharnier') {
        stap();
        a.kandidaat.o.scharnier = a.kandidaat.o.scharnier === 'tot' ? 'van' : 'tot';
        return klaar();
      }
      if (a.kandidaat.soort === 'afdak') {
        st.kies = { soort: 'afdak' };
        afdakZie();
      } else if (a.kandidaat.soort === 'opening') st.kies = { soort: 'opening', id: a.kandidaat.o.id };
      else if (a.kandidaat.soort === 'muur') st.kies = { soort: 'muur', run: a.kandidaat.m, bij: a.kandidaat.m.as === 'x' ? p.y : p.x };
      else if (a.kandidaat.soort === 'zone') st.kies = { soort: 'ruimte', id: a.kandidaat.id };
      else if (st.stand === 'vorm') {
        st.kies = gebouwOp(p.x, p.y);
        // Het afdak aangetikt: gezien, het label Nieuw gaat weg.
        if (st.kies?.soort === 'afdak') afdakZie();
      }
      else if (id === BUITEN) st.kies = null;
      else if (st.wapen?.kamer) {
        noem(id, { kamer: st.wapen.kamer });
        return;
      } else st.kies = st.kies?.soort === 'ruimte' && st.kies.id === id ? null : { soort: 'ruimte', id };
      teken();
      meld();
    }

    svg.addEventListener('pointerdown', neer);
    svg.addEventListener('pointermove', beweeg);
    svg.addEventListener('pointerup', los);
    svg.addEventListener('pointercancel', afgebroken);
    svg.addEventListener('lostpointercapture', (e) => {
      // Kwijt zonder loslaten (een melding eroverheen): terug naar hoe het was.
      setTimeout(() => {
        vingerWeg(e.pointerId);
        if (actie && actie.wijzer === e.pointerId) afgebroken();
      }, 50);
    });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => pasAan()).observe(svg);

    /* ---------- wat je kunt doen */
    function nieuwVak(r) {
      const v = kopie(vloer());
      const id = v.volg++;
      v.ruimtes[id] = {};
      let n = vulRecht(v, r.x0, r.y0, r.x1, r.y1, id, st.stand === 'vorm' ? 'alleen' : false);
      // Over het huis op het erf heen trek je geen vak: dat blijft staan.
      const was = vloer();
      for (let i = 0; i < v.cel.length; i++) {
        if (v.cel[i] === id && vastId(was, was.cel[i])) {
          v.cel[i] = was.cel[i];
          n--;
        }
      }
      if (n <= 0) return teken();
      stap();
      // Wat helemaal onder het nieuwe vak verdween, geeft zijn naam eraan door: dan was het vak over die ruimte heen getrokken.
      const oud = vloer();
      const weg = Object.keys(oud.ruimtes).filter((x) => !v.cel.includes(Number(x)));
      if (weg.length === 1) v.ruimtes[id] = { ...oud.ruimtes[weg[0]] };
      ordenen(v);
      st.vloeren[st.etage] = v;
      if (st.wapen?.kamer && !v.ruimtes[id].kamer) {
        for (const x of Object.values(v.ruimtes)) if (x.kamer === st.wapen.kamer) delete x.kamer;
        v.ruimtes[id] = { kamer: st.wapen.kamer };
        st.wapen = null;
      }
      st.kies = st.stand === 'vorm' ? null : { soort: 'ruimte', id };
      klaar();
    }
    /** Zeggen wat een ruimte is. Stond die kamer al ergens, dan wisselen ze. */
    function noem(id, wat) {
      const v = vloer();
      if (!v.ruimtes[id]) return;
      stap();
      const oud = { ...v.ruimtes[id] };
      if (wat.kamer) {
        const ander = Object.entries(v.ruimtes).find(([x, r]) => Number(x) !== id && r.kamer === wat.kamer);
        if (ander) v.ruimtes[ander[0]] = { ...oud, blok: v.ruimtes[ander[0]].blok };
      }
      v.ruimtes[id] = wat.kamer ? { kamer: wat.kamer } : wat.naam ? { naam: wat.naam, soort: wat.soort } : {};
      st.wapen = null;
      st.kies = { soort: 'ruimte', id };
      klaar();
    }
    /** Twee ruimtes worden één: de muur ertussen is weg. `blijft` houdt zijn naam. */
    function voegSamen(blijft, weg) {
      const v = vloer();
      stap();
      for (let i = 0; i < v.cel.length; i++) if (v.cel[i] === weg) v.cel[i] = blijft;
      ordenen(v);
      st.kies = { soort: 'ruimte', id: blijft };
      klaar();
    }
    /** De ruimtes die een muur delen met deze. */
    function buren(id) {
      const v = vloer();
      const uit = new Set();
      for (let y = 0; y < v.H; y++) {
        for (let x = 0; x < v.W; x++) {
          if (v.cel[y * v.W + x] !== id) continue;
          for (const b of [x > 0 ? v.cel[y * v.W + x - 1] : BUITEN, x < v.W - 1 ? v.cel[y * v.W + x + 1] : BUITEN, y > 0 ? v.cel[(y - 1) * v.W + x] : BUITEN, y < v.H - 1 ? v.cel[(y + 1) * v.W + x] : BUITEN]) if (b !== BUITEN && b !== id) uit.add(b);
        }
      }
      return [...uit];
    }
    /** Wat er aan weerszijden van de gekozen muur ligt, halverwege. */
    function muurKanten(run) {
      const v = vloer();
      const j = Math.floor((run.van + run.tot) / 2);
      const a = run.as === 'x' ? ruimteOp(v, run.op - 1, j) : ruimteOp(v, j, run.op - 1);
      const b = run.as === 'x' ? ruimteOp(v, run.op, j) : ruimteOp(v, j, run.op);
      return [a, b];
    }
    function muurWeg() {
      if (st.kies?.soort !== 'muur') return;
      const [a, b] = muurKanten(st.kies.run);
      if (a === BUITEN || b === BUITEN) return;
      const v = vloer();
      const m = maten(v);
      // De ruimte met een kamer blijft; bij twee de grootste.
      const sterk = (id) => (v.ruimtes[id]?.kamer ? 2 : naamVan(v.ruimtes[id]) ? 1 : 0) * 1e6 + (m[id]?.n ?? 0);
      const [blijft, weg] = sterk(a) >= sterk(b) ? [a, b] : [b, a];
      voegSamen(blijft, weg);
    }
    /** De gekozen muur een stap, of naar een maat vanaf de gevel. */
    function muurZet(nieuw) {
      if (st.kies?.soort !== 'muur') return;
      const run = st.kies.run;
      const begin = kopie(vloer());
      const ruimte = muurRuimte(begin, run, !!etageVan(st.etage)?.buiten);
      const op = klem(Math.round(nieuw), ruimte.min, ruimte.max);
      if (op === run.op) return;
      stap();
      st.vloeren[st.etage] = muurNaar(begin, run, op);
      ordenen(vloer());
      st.kies = { soort: 'muur', run: muurOpnieuw({ ...run, op }) };
      klaar();
    }
    /** Een ruimte weghalen: hij wordt weer deel van de ruimte waar hij het meest aan grenst. */
    function haalWeg(id) {
      const v = vloer();
      if (!v.ruimtes[id]) return;
      const b = buurVoor(v, id);
      stap();
      if (b == null) v.ruimtes[id] = {};
      else {
        for (let i = 0; i < v.cel.length; i++) if (v.cel[i] === id) v.cel[i] = b;
        ordenen(v);
      }
      st.kies = null;
      klaar();
    }
    /**
     * Een andere bron voor de buitenkant: de gebouwen van die bron. De kamers
     * blijven staan waar ze nog in het huis vallen; wat erbij komt is een vak
     * zonder naam.
     */
    function kiesBron(id) {
      if (!huis.bronnen?.[id] || id === st.bron) return;
      stap();
      st.bron = id;
      st.eigen = null;
      zetBlokken();
      for (const e of huis.etages) {
        const oud = st.vloeren[e.id];
        const nv = nieuweVloer(huis.maat, e.blokken);
        const erbij = nv.volg;
        for (let i = 0; i < nv.cel.length; i++) if (nv.cel[i] !== BUITEN && oud.cel[i] !== BUITEN) nv.cel[i] = oud.cel[i] + erbij;
        for (const [rid, r] of Object.entries(oud.ruimtes)) nv.ruimtes[Number(rid) + erbij] = r;
        nv.volg = erbij + oud.volg;
        nv.zones = oud.zones ?? {};
        ordenen(nv);
        st.vloeren[e.id] = nv;
      }
      st.kies = null;
      zetKijk(zoomDoel());
      klaar();
    }
    /** De zones van een kamer als lijn: in het midden beginnen, draaien, of weg. */
    function zetZone(kamer, wat) {
      const v = vloer();
      const id = Number(Object.entries(v.ruimtes).find(([, r]) => r.kamer === kamer)?.[0]);
      if (!id) return;
      stap();
      if (wat === 'weg') delete v.zones[kamer];
      else {
        const as = wat === 'draai' ? (v.zones[kamer]?.as === 'x' ? 'y' : 'x') : 'x';
        // Begin waar de lijn het langst is: in het midden van de hele kamer.
        const m = maten(v)[id];
        v.zones[kamer] = { as, op: Math.round(as === 'x' ? (m.x0 + m.x1) / 2 : (m.y0 + m.y1) / 2) };
      }
      st.kies = { soort: 'ruimte', id };
      klaar();
    }
    function zetApparaat(id, kamer, plek) {
      const dev = st.apparaten.find((x) => x.id === id);
      if (!dev) return;
      stap();
      dev.kamer = kamer;
      if (plek) dev.plek = plek;
      else delete dev.plek;
      st.wapen = null;
      const w = kamerPlek()[kamer];
      if (w && w.etage !== st.etage) {
        st.etage = w.etage;
        st.zoom = null;
      }
      st.kies = { soort: 'apparaat', id };
      klaar();
    }
    function kiesIndeling(i) {
      const e = etageVan(st.etage);
      const lijst = indelingen(huis.kamers.filter((x) => x.etage === st.etage), e.blokken);
      if (!lijst[i]) return;
      stap();
      st.vloeren[st.etage] = vloerUitIndeling(huis.maat, e.blokken, lijst[i].bomen);
      st.kies = null;
      klaar();
    }
    /** De muren van de etage eronder overnemen, zonder namen. */
    function zoalsBeneden() {
      const e = onder();
      if (!e) return;
      stap();
      const v = vloer();
      const b = st.vloeren[e.id];
      const om = {};
      for (let i = 0; i < v.cel.length; i++) {
        if (v.cel[i] === BUITEN || b.cel[i] === BUITEN) continue;
        om[b.cel[i]] ??= v.volg++;
        v.cel[i] = om[b.cel[i]];
      }
      const houd = { ...v.ruimtes };
      v.ruimtes = {};
      for (const id of new Set(v.cel)) if (id !== BUITEN) v.ruimtes[id] = Object.values(om).includes(id) ? {} : (houd[id] ?? {});
      ordenen(v);
      st.kies = null;
      klaar();
    }
    function leeg() {
      stap();
      st.vloeren[st.etage] = nieuweVloer(huis.maat, etageVan(st.etage).blokken);
      st.kies = null;
      klaar();
    }
    /** Buiten opnieuw vanaf de kaart (20 november 2026, Ricardo): het erf, het huis en de gebouwen zoals de eerste keer; Stap terug haalt het terug. */
    function vanKaart() {
      const e = etageVan(st.etage);
      if (!e?.buiten) return;
      stap();
      st.vloeren[e.id] = huis.begin?.[e.id] ? vloerUitIndeling(huis.maat, e.blokken, huis.begin[e.id]) : nieuweVloer(huis.maat, e.blokken);
      st.kies = null;
      st.zoom = null;
      klaar();
    }

    const t = {
      CEL,
      huis,
      st,
      kamers,
      op: (f) => luisteraars.push(f),
      /** Het blad en de rest opnieuw, als de pagina iets veranderde (de kaarten zoeken). */
      ververs: () => meld(),
      teken,
      pasAan,
      vloer,
      maten: () => maten(vloer()),
      omtrek: () => omtrek(vloer()),
      naamVan,
      soortVan,
      buren,
      muurKanten,
      apparaatPunten,
      plekNaam,
      kamerPlek,
      bezig: () => actie,
      heelHuis,
      /** Naar een andere pagina (de app): `verborgen`, of `apparaat` met { id, kamer }. Weg in de schets. */
      naar: opties.naar ?? null,
      /**
       * Stap 3 (Kamers en indeling weg): de indeling van de pagina, als die er is. `gegevens()` geeft wat de
       * bladen tonen (etage, buiten, soorten, verborgen), `doe(actie, waarde)` bewaart. Zonder (de schets) geen bladen.
       */
      indeling: opties.indeling ?? null,
      /** Vaste vakken (het huis op het erf): niet in de lijsten. */
      vast: opties.vast ?? [],
      /** Nu bewaren, ook zonder dat er iets veranderde: wat de kaart voorstelde, klopt (19 november 2026). */
      bewaarNu() {
        bewaar();
        meld();
      },
      /** Een blad van de indeling tonen, of weer weg (null). */
      toonBlad(naam) {
        st.blad = naam ? { naam, etage: st.etage, stand: st.stand } : null;
        st.kies = null;
        meld();
      },
      /** Stap 4: de kaarten vragen (na de melding), als de pagina dat kan. */
      kijk: opties.kijk ?? null,
      metOpeningen,
      openingMuur: (o) => openingMuur(vloer(), o),
      /** Een deur, raam of voordeur op de gekozen muur, waar je tikte. */
      plaatsOpening(soort) {
        const kz = st.kies;
        if (kz?.soort !== 'muur' || !kz.run) return;
        const run = kz.run;
        const w = Math.min(OPENING_BREED[soort] ?? 9, run.tot - run.van - 2);
        if (w < 5) return;
        const mid = kz.bij ?? (run.van + run.tot) / 2;
        const van = Math.round(klem(mid - w / 2, run.van + 1, run.tot - 1 - w));
        const v = vloer();
        stap();
        const lijst = v.openingen ?? [];
        const id = `o${Math.max(0, ...lijst.map((o) => Number(o.id.slice(1)) || 0)) + 1}`;
        v.openingen = [...lijst, { id, soort, as: run.as, op: run.op, van, tot: van + w }];
        st.kies = { soort: 'opening', id };
        // Een voordeur erbij: de deurbel komt ernaast, als hij nog geen plek had.
        if (soort === 'voordeur') deurbelBijVoordeur();
        klaar();
      },
      /** De gekozen opening een andere soort, scharnier, kant of schuifrichting (20 november 2026). */
      openingZet(wat, w) {
        const v = vloer();
        const o = (v.openingen ?? []).find((x) => x.id === st.kies?.id);
        if (!o) return;
        stap();
        if (wat === 'soort' && OPENING_SOORTEN.includes(w)) {
          const was = o.soort;
          o.soort = w;
          // Breder of smaller als de soort een andere maat heeft, om het midden, binnen de muur.
          const run = muurVan(v, o);
          if (run && (OPENING_BREED[w] ?? 9) !== (OPENING_BREED[was] ?? 9)) {
            const bw = Math.min(OPENING_BREED[w] ?? 9, run.tot - run.van - 2);
            const van = Math.round(klem((o.van + o.tot) / 2 - bw / 2, run.van + 1, run.tot - 1 - bw));
            o.van = van;
            o.tot = van + bw;
          }
          if (w !== 'raam') for (const a of st.apparaten) if (a.raam === o.id) delete a.raam;
          if (w === 'voordeur') deurbelBijVoordeur();
        } else if (wat === 'scharnier' && (w === 'van' || w === 'tot')) o.scharnier = w;
        else if (wat === 'kant' && (w === '1' || w === '-1')) o.kant = Number(w);
        else if (wat === 'schuift' && (w === 'van' || w === 'tot')) o.schuift = w;
        klaar();
      },
      openingKant: (o) => o.kant ?? openingBinnen(vloer(), o),
      openingBinnen: (o) => openingBinnen(vloer(), o),
      /** De gekozen opening breder (+1) of smaller (-1), tien centimeter per stap, om zijn midden. */
      openingBreed(d) {
        const v = vloer();
        const o = (v.openingen ?? []).find((x) => x.id === st.kies?.id);
        const run = o && muurVan(v, o);
        if (!run) return;
        const w = klem(o.tot - o.van + d, 5, Math.min(40, run.tot - run.van - 2));
        const van = Math.round(klem((o.van + o.tot) / 2 - w / 2, run.van + 1, run.tot - 1 - w));
        if (w === o.tot - o.van && van === o.van) return;
        stap();
        o.van = van;
        o.tot = van + w;
        klaar();
      },
      /** Een radiator erbij in een kamer (besluit 333): hij komt onder het dichtstbijzijnde raam; weghalen gaat met Verbergen. */
      radiatorErbij(kamer) {
        if (!kamer) return;
        stap();
        const nrs = st.apparaten.filter((a) => a.id.startsWith(`radiator:${kamer}:`)).map((a) => Number(a.id.split(':')[2]) || 0);
        st.apparaten.push({ id: `radiator:${kamer}:${Math.max(1, ...nrs) + 1}`, naam: T('ht.app.radiator'), soort: 'radiator', kamer });
        klaar();
      },
      openingWeg() {
        const v = vloer();
        const id = st.kies?.id;
        if (!(v.openingen ?? []).some((x) => x.id === id)) return;
        stap();
        v.openingen = v.openingen.filter((x) => x.id !== id);
        for (const a of st.apparaten) if (a.raam === id) delete a.raam;
        st.kies = null;
        klaar();
      },
      /** De trap in een ruimte: naar welke kant hij omhoog gaat. */
      zetTrap(id, richting) {
        const r = vloer().ruimtes[id];
        if (!r || !TRAP_RICHTING[richting]) return;
        stap();
        r.omhoog = richting;
        klaar();
      },
      /** 0.185.0: een gebouw van de kaart erbij ({ erbij, soort }) of weg ({ weg }); de pagina bewaart en laadt opnieuw. */
      gebouw: opties.gebouw ?? null,
      /** Ronde 2 versie 2: de straat aan een kant zetten; de pagina bewaart en laadt opnieuw. */
      straat: opties.straat ?? null,
      /** Ronde 2: een gebouw een stap breder of dieper (min en plus); bewaard als je even niets doet. */
      blokStap(wat, dd) {
        const b = maatVan(bijBlokken().find((q) => q.id === st.kies?.id));
        if (!b || (wat !== 'b' && wat !== 'd')) return;
        st.blokMaat = { id: b.id, u: b.u, v: b.v, b: b.b, d: b.d, [wat]: r1(klem(b[wat] + dd, 1, 40)) };
        teken();
        meld();
        blokMaatBewaar(1200);
      },
      /** Ronde 2: het afdak gezien (het label Nieuw gaat weg). */
      afdakZie() {
        afdakZie();
        teken();
      },
      afdakVak,
      maatVan,
      omgeving,
      /** Een gebouw weg: zijn ruitjes op de begane grond worden weer buiten, en de tekening wordt bewaard. */
      blokWeg(id) {
        const b = bijBlokken().find((q) => q.id === id);
        const beneden = huis.beneden ?? huis.etages.at(-1)?.id;
        const v = b && st.vloeren[beneden];
        if (!v) return;
        stap();
        const rest = huis.etages.find((e) => e.id === beneden).blokken.filter((q) => q.id !== id);
        const inRest = (x, y) => rest.some((q) => x >= MARGE + q.u / CEL && x < MARGE + (q.u + q.b) / CEL && y >= MARGE + q.v / CEL && y < MARGE + (q.v + q.d) / CEL);
        for (let y = Math.round(MARGE + b.v / CEL); y < Math.round(MARGE + (b.v + b.d) / CEL); y++) for (let x = Math.round(MARGE + b.u / CEL); x < Math.round(MARGE + (b.u + b.b) / CEL); x++) if (!inRest(x, y)) v.cel[y * v.W + x] = BUITEN;
        ordenen(v);
        st.kies = null;
        klaar();
      },
      zetStand(s) {
        // Een appartement met verdiepingen erboven heeft geen eigen dak (20 november 2026): dan naar Vorm.
        if (s === 'dak' && global.woningDeel && !global.woningDeel.eigenDak(huis.woning)) s = 'vorm';
        // Vorm en het huis in 3D gaan over het huis zelf: vanaf buiten naar de begane grond.
        if ((s === 'vorm' || s === 'huis') && etageVan(st.etage)?.buiten) st.etage = huis.beneden ?? huis.etages.filter((e) => !e.buiten).at(-1)?.id;
        // Dak (stap 4 punt 3): de etage onder het dak, als je niet al op een etage onder het schuine dak stond.
        if (s === 'dak' && !kapelEtages().includes(st.etage)) st.etage = dakEtage() ?? st.etage;
        st.kapelErbij = null;
        st.stand = s;
        st.kies = null;
        st.wapen = null;
        st.zoom = null;
        st.eigen = null;
        kijkNaar(zoomDoel());
        meld();
      },
      zetEtage(id) {
        st.etage = id;
        if (etageVan(id)?.buiten && (st.stand === 'vorm' || st.stand === 'huis' || st.stand === 'dak')) st.stand = 'kamers';
        // Bij Huis zet een etage aantikken die etage open, ook als het huis dicht was.
        if (st.stand === 'huis') st.dicht = false;
        st.kies = null;
        st.wapen = null;
        st.zoom = null;
        kijkNaar(zoomDoel(), true);
        meld();
      },
      kies(k2) {
        st.kies = k2;
        teken();
        meld();
      },
      wapen(w) {
        st.wapen = w;
        st.kies = null;
        teken();
        meld();
      },
      zoom(id) {
        st.zoom = id;
        st.eigen = null;
        if (id != null) st.kies = { soort: 'ruimte', id };
        kijkNaar(zoomDoel());
        meld();
      },
      noem,
      vak: nieuwVak,
      haalWeg,
      kiesBron,
      /** Of een gebouw bij Vorm op het erf staat (20 november 2026), en de etage Buiten. */
      opErf: (id) => opErfBlokken().some((q) => q.id === id),
      erfEtage: () => huis.etages.find((e) => e.buiten)?.id ?? null,
      buurVoor: (id) => buurVoor(vloer(), id),
      verplaatsbaar: (id) => verplaatsbaar(vloer(), id),
      zones: () => zonesOp(vloer()),
      /** In welke zone een apparaat staat: aan welke kant van de stippellijn. */
      zoneVan(p) {
        const zz = zonesOp(vloer()).find((x) => x.id === p.ruimte);
        return zz ? (zz.namen[(zz.z.as === 'x' ? p.x : p.y) < zz.z.op ? 0 : 1] ?? null) : null;
      },
      bronPlaatje: (id, b, h) => klein(nieuweVloer(huis.maat, huis.bronnen[id].blokken), kamers, b, h),
      zetZone,
      MARGE,
      voegSamen,
      muurWeg,
      muurZet,
      zetApparaat,
      kiesIndeling,
      zoalsBeneden,
      leeg,
      vanKaart,
      /* Het dak en de dakkapellen (stap 4 punt 3). */
      dakMaat,
      dakEtage,
      kapelEtages,
      laagStrook,
      vloerHoogte,
      hoofdBlok,
      opBuurMuur,
      kapelErbij() {
        const m = dakMaat();
        if (!m) return;
        const strook = laagStrook(st.etage);
        st.kapelErbij = { kant: strook[1] >= strook[0] ? 1 : 0, etage: kapelEtages().includes(st.etage) ? st.etage : dakEtage() };
        st.kies = null;
        teken();
        meld();
      },
      kapelKeus(wat, w) {
        if (!st.kapelErbij) return;
        st.kapelErbij = { ...st.kapelErbij, [wat]: wat === 'kant' ? Number(w) : w };
        meld();
      },
      kapelZet() {
        const m = dakMaat();
        const keus = st.kapelErbij;
        if (!m || !keus) return;
        const breed = r1(Math.min(3, Math.max(0.6, m.la - 1)));
        const van = r1((m.la - breed) / 2);
        const diep = r1(Math.max(0.5, Math.min(2, m.naar[keus.kant] - 0.6)));
        st.kapellen.push({ kant: keus.kant, van, tot: r1(van + breed), diep, etage: keus.etage === dakEtage() ? null : keus.etage });
        st.kapelErbij = null;
        if (st.etage !== (keus.etage ?? dakEtage())) st.etage = keus.etage ?? dakEtage();
        st.kies = { soort: 'kapel', i: st.kapellen.length - 1 };
        kapelBewaar();
        teken();
        meld();
      },
      kapelNiet() {
        st.kapelErbij = null;
        meld();
      },
      kapelAnders(i, wat, d) {
        const m = dakMaat();
        const kk = st.kapellen[i];
        if (!m || !kk) return;
        if (wat === 'kant') kk.kant = kk.kant === 0 ? 1 : 0;
        else if (wat === 'etage') {
          const lijst = kapelEtages();
          const nu = kk.etage ?? dakEtage();
          const volgende = lijst[(lijst.indexOf(nu) + 1) % Math.max(1, lijst.length)] ?? nu;
          kk.etage = volgende === dakEtage() ? null : volgende;
          st.etage = volgende;
        } else if (wat === 'breed') {
          const breed = klem(r1(kk.tot - kk.van + d), 0.6, m.la);
          kk.tot = r1(Math.min(m.la, kk.van + breed));
          kk.van = r1(kk.tot - breed);
        } else if (wat === 'diep') kk.diep = r1(klem(kk.diep + d, 0.5, Math.max(0.5, m.naar[kk.kant] - 0.3)));
        kapelBewaar();
        teken();
        meld();
      },
      kapelWeg(i) {
        st.kapellen.splice(i, 1);
        st.kies = null;
        kapelBewaar();
        teken();
        meld();
      },
      indelingen: () => indelingen(huis.kamers.filter((x) => x.etage === st.etage), etageVan(st.etage).blokken),
      plaatje: (i, b, h) => {
        const e = etageVan(st.etage);
        const lijst = indelingen(huis.kamers.filter((x) => x.etage === st.etage), e.blokken);
        return lijst[i] ? klein(vloerUitIndeling(huis.maat, e.blokken, lijst[i].bomen), kamers, b, h) : '';
      },
      /** Nog niets ingedeeld: elke ruimte is nog een heel blok zonder naam. */
      isLeeg: () => !etageVan(st.etage)?.buiten && Object.values(vloer().ruimtes).every((r) => !r.kamer && !r.naam) && Object.keys(vloer().ruimtes).length <= etageVan(st.etage).blokken.length,
      terug() {
        const f = st.terug.pop();
        if (!f) return;
        st.vooruit.push(foto());
        zetFoto(f);
        st.zoom = null;
        zetKijk(zoomDoel());
        klaar();
      },
      vooruit() {
        const f = st.vooruit.pop();
        if (!f) return;
        st.terug.push(foto());
        zetFoto(f);
        st.zoom = null;
        zetKijk(zoomDoel());
        klaar();
      },
      opnieuw() {
        stap();
        begin();
        st.kies = null;
        st.zoom = null;
        zetKijk(zoomDoel());
        klaar();
      },
      /** Voor iets dat van buiten de tekening wordt gesleept (een apparaat uit de strook): wat ligt daar. */
      plekOp(clientX, clientY) {
        const p = punt({ clientX, clientY });
        const id = ruimteOp(vloer(), p.x, p.y);
        return id !== BUITEN && vloer().ruimtes[id]?.kamer ? { ruimte: id, kamer: vloer().ruimtes[id].kamer, plek: { etage: st.etage, x: p.x, y: p.y } } : null;
      },
      zweef(clientX, clientY) {
        const w = clientX == null ? null : t.plekOp(clientX, clientY);
        const doel = w?.ruimte ?? null;
        if ((actie?.doel ?? null) === doel) return;
        actie = doel == null ? null : { type: 'zweef', doel, kandidaat: {} };
        teken();
      },
    };
    requestAnimationFrame(pasAan);
    return t;
  }

  /* ================================================================ het blad ernaast */

  /* ---------- de straat en wat de plattegrond weet (ronde 2 versie 2, schets Wand-Huis-Kaarten #straat en #buitenland) */
  global.huistekenen = { maak, paneel, stapel, strook, uitleg, CEL, MARGE, BUITEN, randen, isMuur, maten, omtrek, TINT, SOORT_TINT, APP_KLEUR, muurDelen, openingBinnen, TRAP_RICHTING };
})(typeof window !== 'undefined' ? window : globalThis);
