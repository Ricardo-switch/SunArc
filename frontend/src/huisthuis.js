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

  /** Staat de nieuwe tekenaar aan op dit scherm? Het adres zet het (en onthoudt het). */
  function aan() {
    let keuze = null;
    try {
      keuze = new URLSearchParams(location.search).get('tekenaar');
      if (keuze === 'maat' || keuze === 'poppenhuis') localStorage.setItem(SLEUTEL, keuze);
      else keuze = localStorage.getItem(SLEUTEL);
    } catch {
      // Zonder opslag: alleen wat het adres zegt.
    }
    return keuze === 'maat';
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
    staat.tk = global.huistekenen.maak(svg, huis, { stand: 'kamers', etage: beneden, tekening: hv.zonderLosBuiten(d, huis), openingen: true, vast: [hv.HUIS_OP_ERF] });
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
      if (grond) vlakken.push({ soort: grond, p: [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]], ...(grond === 'terras' ? { meubels: true } : {}) });
    }
    // Op het terras één tafel: alleen op het grootste stuk.
    const vopp = (v) => (v.p[2][0] - v.p[0][0]) * (v.p[2][1] - v.p[0][1]);
    vlakken.filter((v) => v.soort === 'terras').sort((a, b) => vopp(b) - vopp(a)).slice(1).forEach((v) => delete v.meubels);
    // De gebouwen op het erf op de maat zoals ze getekend zijn, met de naam die de bewoner gaf.
    const blok = (soort) => erfE?.blokken?.find((b) => b.soort === soort || b.id === soort);
    const getekend = (soort) => {
      const r = plek(soort)[0];
      if (r) return { x: r.x0, y: r.y0, b: r.x1 - r.x0, d: r.y1 - r.y0, naam: kamerVan(vloer.ruimtes[r.id]?.kamer)?.naam };
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
    // De auto op de oprit, met de neus naar de straat.
    const oprit = plek('oprit')[0];
    const garage = gebouwen.find((g) => g.soort === 'garage');
    const auto = model.oprit?.auto && oprit ? { x: (oprit.x0 + oprit.x1) / 2 - 0.92, y: Math.max(oprit.y0 + 0.6, (garage?.y ?? oprit.y1) - 5.4), b: 1.84, d: 4.5, kleur: '#c9d4df', laadt: !!model.oprit?.laadt } : null;
    // Apparaten buiten: lampen, de deurbel, camera's, het zonnescherm, de lampjes in de border.
    const apparaten = [];
    const huisDoos = hoofd ? { x: hoofd.u, y: hoofd.v, b: hoofd.b, d: hoofd.d } : null;
    for (const a of tk.st.apparaten) {
      if (!erfE || a.plek?.etage !== erfE.id) continue;
      const [x, y] = [m(a.plek.x), m(a.plek.y)];
      if (a.soort === 'licht' && kamerSoort(a.kamer) === 'border') {
        const b = plek('border')[0];
        if (!b) continue;
        const lang = b.x1 - b.x0 >= b.y1 - b.y0;
        apparaten.push({ id: a.id, soort: 'snoer', punten: lang ? [[b.x0 + 0.2, (b.y0 + b.y1) / 2], [b.x1 - 0.2, (b.y0 + b.y1) / 2]] : [[(b.x0 + b.x1) / 2, b.y0 + 0.2], [(b.x0 + b.x1) / 2, b.y1 - 0.2]] });
      } else if (a.soort === 'camera' && /deurbel|doorbell/i.test(`${a.id} ${a.naam}`)) {
        apparaten.push({ id: a.id, soort: 'deurbel', x, y, z: 1.4, n: [-1, 0] });
      } else if (a.soort === 'camera') {
        // Een camera hangt aan een muur: aan een gebouw op het erf binnen een paar meter, anders aan het huis.
        let best = null;
        for (const g of [...gebouwen.filter((q) => q.soort !== 'tuinhuis'), ...(huisDoos ? [huisDoos] : [])]) {
          if (best && g === huisDoos) break;
          const kx = Math.max(g.x, Math.min(g.x + g.b, x));
          const ky = Math.max(g.y, Math.min(g.y + g.d, y));
          const afst = Math.hypot(kx - x, ky - y);
          if (afst > 4.5 || (best && afst >= best.afst)) continue;
          const binnen = kx > g.x && kx < g.x + g.b && ky > g.y && ky < g.y + g.d;
          if (binnen) continue;
          const kant = ky <= g.y ? [0, -1] : ky >= g.y + g.d ? [0, 1] : kx <= g.x ? [-1, 0] : [1, 0];
          const [px, py] = kant[1] ? [Math.max(g.x + 0.3, Math.min(g.x + g.b - 0.3, kx)), ky] : [kx, Math.max(g.y + 0.3, Math.min(g.y + g.d - 0.3, ky))];
          best = { afst, x: px, y: py, n: kant };
        }
        apparaten.push({ id: a.id, soort: 'camera', x: best?.x ?? x, y: best?.y ?? y, n: best?.n ?? [0, -1], z: 2.4, licht: lichtBij[a.id] });
      } else if (a.soort === 'screen') {
        apparaten.push({ id: a.id, soort: 'screen', x, y: Math.min(y, (hoofd?.v ?? 0) + (hoofd?.d ?? 0) + 0.02), z: 2.5, b: 3.4, uit: [0, 1] });
      }
    }
    // De stroom van het net: vanaf de straat langs de rand van de voortuin naar de voordeur (de deurbel, anders de hal).
    const stroom = [];
    const bgV = tk.st.vloeren[tk.huis.beneden ?? 'bg'];
    const net = (model.stromen ?? []).find((x) => x.van === 'net');
    const label = (model.labels ?? []).find((l) => l.bij === 'net')?.titel;
    const deurbel = apparaten.find((a) => a.soort === 'deurbel');
    const halId = bgV ? Object.entries(bgV.ruimtes).find(([, r]) => kamerSoort(r.kamer) === 'hal' || r.kamer === 'hal')?.[0] : null;
    const halR = halId ? K.maten(bgV)[halId]?.r : null;
    const deurY = deurbel?.y ?? (halR ? m((halR.y0 + halR.y1) / 2) : null);
    const voortuin = plek('voortuin')[0];
    if (net && erf && hoofd && deurY != null) {
      const rand = (voortuin?.x0 ?? hoofd.u) - 0.08;
      stroom.push({ toon: 'violet', label, dx: -(String(label ?? '').length * 7.6 + 40), dy: 16, pad: [[rand, erf.y - 1.0, 0.05], [rand, deurY, 0.05], [hoofd.u + 0.15, deurY, 0.05]] });
    }
    // De buitenunits van de airco's (geschat): de eerste tegen de zijgevel, een tweede tegen de achtergevel; aan als zijn airco draait.
    const units = [];
    const aircos = tk.st.apparaten.filter((a) => a.soort === 'airco');
    if (hoofd && model.buitenunit?.aantal) {
      units.push({ x: hoofd.u - 0.05, y: hoofd.v + 2.4, n: [-1, 0], aan: !!aircos[0] && aanSet.has(aircos[0].id) });
      if (model.buitenunit.aantal > 1) units.push({ x: hoofd.u + hoofd.b - 1.0, y: hoofd.v + hoofd.d + 0.02, n: [0, 1], aan: !!aircos[1] && aanSet.has(aircos[1].id) });
    }
    // Eén boom in het seizoen, in de voortuin.
    const bomen = voortuin && voortuin.x1 - voortuin.x0 > 2.6 && voortuin.y1 - voortuin.y0 > 3.2 ? [{ x: voortuin.x1 - 1.3, y: voortuin.y0 + 1.6, h: 4.2, r: 1.1 }] : [];
    const zon = model.zon ?? {};
    const panelen = [zon.panelen ? { aantal: zon.panelen, kant: 0 } : null, zon.panelenLinks ? { aantal: zon.panelenLinks, kant: 1 } : null].filter(Boolean);
    const tijd = model.tijd ?? 'dag';
    return {
      hoek: -58,
      hoogte: 27,
      lucht: 0,
      seizoen: model.seizoen ?? 'herfst',
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
    if (!avond && zon?.nu && zon?.baan?.length && voorDeg != null) o.zonBoog = { nu: zon.nu, baan: zon.baan, voorDeg };
    return o;
  }

  /**
   * Tekent het huis zoals getekend in `el`; false: teken het poppenhuis.
   * @param {Element} el
   * @param {any} model
   * @param {{ soort?: string, breedte?: number, hoogte?: number, huisData?: any, kamerId?: string | null, avond?: boolean, opnieuw?: (() => void) | null }} [opts]
   */
  function teken(el, model, { soort = 'thuis', breedte, hoogte, huisData = null, kamerId = null, avond = false, opnieuw = null } = {}) {
    if (!el || !aan() || staat.fout || !klaar(opnieuw)) return false;
    try {
      const B = Math.round(breedte ?? el.clientWidth ?? 860);
      const H = Math.round(hoogte ?? 612);
      const o = opties(staat.tk, model, huisData);
      if (soort === 'kamer') alsEtage(o, staat.tk, huisData, kamerId);
      else if (soort === 'rust') alsRust(o, avond, model);
      else o.boven = 90;
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
