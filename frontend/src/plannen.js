/*
 * Een nieuwe taak als één zin (besluit 244, schets Wand-Nieuw-Taak). Wat het
 * huis vanzelf doet, staat groot bovenaan als gewone zin: "Elke werkdag om
 * 07:00 gaan de keukenlamp en de lamp hal aan, en gaat het screen open." Elk
 * stuk van de zin is aan te tikken; eronder opent dan de keuze voor dat stuk:
 *
 * - wat: de apparaten per kamer, zoals het huis is ingedeeld, meerdere tegelijk,
 *   met "Hele kamer" voor alle lampen en screens van een kamer;
 * - wanneer: een tijd of de zon, en hoe vaak, samen op één plek;
 * - hoe: wat ze doen, per soort samen (de lampen samen aan, de screens samen
 *   dicht), en per apparaat los als je dat wilt;
 * - klaar: overslaan als niemand thuis is, meteen aan, en bewaren.
 *
 * Wat nog niet gekozen is, staat grijs in de zin, zodat hij altijd leest. Op de
 * wand rechts je dag als boog met het nieuwe moment en de komende keren; op de
 * telefoon alles onder elkaar. Zeg het kan ook: de dienst leest er een voorstel
 * uit (niets bewaard) en de zin vult zich.
 *
 * Wat kan: licht, screens, en klimaat met de hand, slimme stekkers en witgoed
 * als die er zijn. Een scène kies je bij Hoe, onder de lampen (besluit 268). Bewaren gaat naar api/te-doen met actie plan; de dienst rekent het
 * eerste moment uit. Te doen en Vast en gepland openen het met
 * `plannen.open({ klaar, zeg })`; de boog en de namen van hoe vaak en de zon
 * gebruikt Vast en gepland ook.
 */
'use strict';

(function (global) {
  const { esc, haal, deur, telStand } = global.app;
  const { klok } = global.taal;
  const t = (k, v) => global.t(k, v);
  const en = () => global.taal.code === 'en';
  const STUKKEN = ['wat', 'wanneer', 'hoe', 'klaar'];
  /** De volgorde van de soorten, in een kamer en in de zin. */
  const SOORTEN = ['licht', 'scherm', 'scene', 'klimaat', 'stekker', 'plug', 'witgoed'];
  /** Een slimme stekker (besluit 266): zo lang aan of uit, in minuten. */
  const PLUG_DUUR = { m30: 30, uur1: 60, uur2: 120, uur4: 240 };
  /** Zoveel stappen neemt de dienst in één taak (MAX_STAPPEN in routes/tedoen.ts). */
  const MAX_STAPPEN = 12;
  const IK = {
    licht: iconen.binnen('licht'),
    scene: iconen.binnen('scene'),
    scherm: iconen.binnen('screen'),
    klimaat: iconen.binnen('klimaat'),
    stekker: iconen.binnen('stekker'),
    plug: iconen.binnen('stekker'),
    witgoed: iconen.binnen('witgoed'),
    mic: iconen.binnen('mic'),
  };
  const svg = (d, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const graden = (c) => `${String(c).replace('.', en() ? '.' : ',')}°`;
  const groot = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  /* ------------------------------------------------------------ gedeeld met Vast en gepland */

  const uurVan = (ms) => { const d = new Date(ms); return d.getHours() + d.getMinutes() / 60; };

  /** "Elke dag", "Werkdagen", "Ma, wo en vr". */
  function herhaalNaam(h) {
    if (h.soort !== 'dagen') return t(`gp.h.${h.soort}`);
    const namen = (h.dagen ?? []).map((d) => t(`gp.d${d}`));
    return namen.length <= 1 ? (namen[0] ?? '') : t('gp.enLijst', { lijst: namen.slice(0, -1).join(', '), laatste: namen.at(-1) });
  }

  /** "10 min voor zonsondergang", "bij zonsopkomst"; leeg bij een tijd. */
  function zonNaam(m) {
    if (m.soort !== 'zon') return '';
    if (m.minuten === 0) return t(`gp.zon.${m.zon}`);
    return t(m.minuten < 0 ? `gp.zon.${m.zon}Voor` : `gp.zon.${m.zon}Na`, { n: Math.abs(m.minuten) });
  }

  function stapperTekst(m) {
    if (m.minuten === 0) return t('gp.precies');
    return t(m.minuten < 0 ? 'gp.minErvoor' : 'gp.minErna', { n: Math.abs(m.minuten) });
  }

  /** Wanneer het ongeveer is: de zon van vandaag met de minuten erbij; leeg bij een tijd. */
  function voorproef(m, zon) {
    if (m.soort === 'tijd') return '';
    const zonMs = m.zon === 'op' ? zon?.dag?.opMs : zon?.dag?.onderMs;
    if (zonMs == null) return '';
    const ms = zonMs + m.minuten * 60_000;
    return ms > Date.now() ? t('gp.vandaagOm', { klok: klok(ms) }) : t('gp.morgenRond', { klok: klok(ms + 86_400_000) });
  }

  /**
   * De dag als boog, net als het logo: de zon van opkomst tot ondergang, nu, en
   * de opdrachten van vandaag op hun moment. Groot op Vast en gepland, klein op
   * Te doen (`mini`), en rechts bij een nieuwe taak.
   */
  /*
   * Elke boog een eigen naam voor zijn kleurverloop: Te doen tekent hem op de
   * wand en op de telefoon, en met dezelfde naam pakte de telefoon het verloop
   * uit het verborgen wanddeel. Dan bleef de boog weg (2 november 2026).
   */
  let boogNr = 0;
  function boog(lijst, o, zon) {
    const { tel = false, mini = false, naast = false } = o ?? {};
    const W = mini ? 400 : naast ? 400 : tel ? 358 : 1180;
    const H = mini ? 96 : naast ? 210 : tel ? 190 : 270;
    const L = mini || naast || tel ? 12 : 40;
    const R = L;
    const HOR = mini ? 82 : naast ? 168 : tel ? 150 : 216;
    const TOP = mini ? 16 : naast ? 48 : tel ? 50 : 66;
    const klein = tel || mini || naast;
    const op = zon?.dag?.opMs != null ? uurVan(zon.dag.opMs) : 7.5;
    const onder = zon?.dag?.onderMs != null ? uurVan(zon.dag.onderMs) : 17;
    const nu = uurVan(Date.now());
    const x = (u) => L + (u / 24) * (W - L - R);
    const y = (u) => (u <= op || u >= onder ? HOR : HOR - (HOR - TOP) * Math.sin((Math.PI * (u - op)) / (onder - op)));
    const pad = (van, tot) => Array.from({ length: 61 }, (_, i) => { const u = van + (i / 60) * (tot - van); return `${i ? 'L' : 'M'}${x(u).toFixed(1)},${y(u).toFixed(1)}`; }).join(' ');
    const id = `${mini ? 'mini' : naast ? 'naast' : tel ? 'tel' : 'wand'}-${++boogNr}`;
    let s = `<defs><linearGradient id="gp-boog-${id}" x1="0" x2="1"><stop offset="0" stop-color="#6ee7b7"/><stop offset="0.5" stop-color="#f7b548"/><stop offset="1" stop-color="#8f86ff"/></linearGradient><radialGradient id="gp-gloed-${id}"><stop offset="0" stop-color="#f7b548" stop-opacity="0.55"/><stop offset="1" stop-color="#f7b548" stop-opacity="0"/></radialGradient></defs>`;
    s += `<line x1="${x(0)}" x2="${x(24)}" y1="${HOR}" y2="${HOR}" stroke="rgb(255 255 255 / 0.14)"/>`;
    if (!mini) for (const u of [0, 6, 12, 18, 24]) s += `<text x="${x(u)}" y="${HOR + (klein ? 20 : 26)}" text-anchor="${u === 0 ? 'start' : u === 24 ? 'end' : 'middle'}" font-size="${klein ? 11 : 13}" fill="var(--gedempt)">${tel && !naast ? u : `${String(u).padStart(2, '0')}:00`}</text>`;
    const dik = mini ? 3 : klein ? 4 : 5;
    s += `<path d="${pad(0, op)}" stroke="rgb(143 134 255 / 0.45)" stroke-width="${Math.max(1.5, dik - 2)}" stroke-dasharray="2 7" stroke-linecap="round" fill="none"/>`;
    s += `<path d="${pad(onder, 24)}" stroke="rgb(143 134 255 / 0.65)" stroke-width="${Math.max(1.5, dik - 2)}" stroke-dasharray="2 7" stroke-linecap="round" fill="none"/>`;
    s += `<path d="${pad(op, Math.min(Math.max(nu, op), onder))}" stroke="url(#gp-boog-${id})" stroke-opacity="0.35" stroke-width="${dik}" stroke-linecap="round" fill="none"/>`;
    if (nu < onder) s += `<path d="${pad(Math.max(nu, op), onder)}" stroke="url(#gp-boog-${id})" stroke-width="${dik}" stroke-linecap="round" fill="none"/>`;
    // De zon, of 's nachts een maantje op de horizon.
    const r = mini ? 6 : klein ? 8 : 13;
    if (nu > op && nu < onder) s += `<circle cx="${x(nu)}" cy="${y(nu)}" r="${r * 3}" fill="url(#gp-gloed-${id})"/><circle cx="${x(nu)}" cy="${y(nu)}" r="${r}" fill="#ffd27a"/>`;
    else s += `<circle cx="${x(nu)}" cy="${HOR}" r="${Math.max(3, r - 3)}" fill="#c9c3ff"/>`;
    // "nu" boven de zon, of eronder als er vlakbij een opdracht staat.
    const dichtbij = lijst.some((o2) => Math.abs(uurVan(o2.ms) - nu) < 1.5);
    const zonY = nu > op && nu < onder ? y(nu) : HOR;
    if (!klein) s += `<text x="${x(nu)}" y="${dichtbij ? zonY + r + 18 : zonY - r - 10}" text-anchor="middle" font-size="13" font-weight="700" fill="#ffd27a">${esc(t('gp.nu'))}</text>`;
    // De opdrachten van vandaag; op de telefoon de eerstvolgende met zijn tijd, naast een nieuwe taak die nieuwe.
    const eerstvolgende = lijst.find((o2) => !o2.gedaan && o2.ms >= Date.now());
    for (const o2 of lijst) {
      const u = uurVan(o2.ms);
      const px = x(u);
      const py = y(u);
      const kleur = o2.gedaan ? 'rgb(170 185 200 / 0.55)' : o2.gekozen ? '#ffffff' : '#e8eef5';
      const nieuw = naast && o2.gekozen;
      s += `<circle cx="${px}" cy="${py}" r="${nieuw ? 8 : o2.gekozen ? (klein ? 6 : 8) : mini ? 4 : klein ? 5 : 6}" fill="${o2.gedaan || !o2.aan ? '#5b6b7c' : '#0b1424'}" stroke="${nieuw ? '#ffd27a' : kleur}" stroke-width="${nieuw ? 3 : klein ? 2 : 2.5}"/>`;
      if (mini || (tel && o2 !== eerstvolgende) || (naast && !nieuw)) continue;
      const dag = u > op && u < onder;
      const stijgt = u < (op + onder) / 2;
      const tx = dag ? px + (stijgt ? -14 : 14) : px;
      const ty = dag ? py - 4 : py - (klein ? 14 : 40);
      const anker = dag ? (stijgt ? 'end' : 'start') : 'middle';
      if (!dag && !klein) s += `<line x1="${px}" x2="${px}" y1="${py}" y2="${py - 32}" stroke="${kleur}" stroke-opacity="0.35"/>`;
      s += `<text class="t" x="${tx}" y="${klein ? ty : ty - 16}" text-anchor="${anker}" fill="${kleur}"${klein ? ` style="font-size: ${naast ? 13 : 12}px"` : ''}>${esc(klok(o2.ms))}${o2.gedaan ? ' ✓' : ''}</text>`;
      if (!klein) s += `<text class="w" x="${tx}" y="${ty + 2}" text-anchor="${anker}" fill="${o2.gedaan ? 'rgb(170 185 200 / 0.55)' : 'rgb(205 215 225 / 0.9)'}">${esc(o2.wat)}</text>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(t('gp.boogUitleg'))}">${s}</svg>`;
  }

  /* ------------------------------------------------------------ de staat */

  /** Wat open staat; null als het blad dicht is. */
  let st = null;
  /** Het huis, klimaat met de hand, het witgoed en de zon: waar je uit kiest. */
  let bron = null;
  /** Na bewaren: wat de pagina opnieuw moet laden. */
  let naBewaren = null;

  function open(o = {}) {
    naBewaren = o.klaar ?? null;
    st = {
      stuk: 'wat',
      kies: [],
      hoe: { licht: { aan: true }, scherm: { actie: 'dicht' }, klimaat: null, stekker: { tot: 'uur1' }, plug: { aan: true, tot: 'uur1' } },
      los: {},
      losOpen: [],
      wanneerGekozen: false,
      moment: { soort: 'tijd', uur: 7, minuut: 0 },
      herhaal: { soort: 'dag' },
      overslaanWeg: false,
      aan: true,
      zeg: o.zeg ?? '',
      voorstel: null,
      momenten: null,
      bezig: false,
      fout: '',
      luistert: false,
    };
    teken();
    void laadBron();
    if (o.zeg) void zeg(o.zeg);
  }

  function sluit() {
    st = null;
    for (const el of document.querySelectorAll('[data-pl]')) el.remove();
  }

  async function laadBron() {
    const [h, k, w, z, s] = await Promise.allSettled([haal('api/huis'), haal('api/hand'), haal('api/witgoed'), haal('api/zon'), haal('api/stekker')]);
    const ok = (x) => (x.status === 'fulfilled' ? x.value : null);
    bron = { huis: ok(h), hand: ok(k), witgoed: ok(w), zon: ok(z), stekker: ok(s) };
    teken();
  }

  /* ------------------------------------------------------------ wat er is */

  /**
   * Alles om uit te kiezen, per etage en per kamer, zoals het huis is ingedeeld.
   * Klimaat met de hand noemt zijn kamer bij naam; wat geen kamer heeft (het
   * witgoed), staat onder Overig.
   */
  function huis() {
    const etages = (bron?.huis?.etages ?? []).map((e) => ({
      id: e.id,
      naam: e.naam,
      kamers: (e.ruimtes ?? []).map((r) => ({ id: r.id, naam: r.naam, items: [] })),
    }));
    const kamers = etages.flatMap((e) => e.kamers);
    const overig = { id: '_overig', naam: t('tk.overig'), items: [] };
    const kamerVan = (naam) => kamers.find((k) => naam && k.naam.toLowerCase() === String(naam).toLowerCase()) ?? overig;
    const zet = (k, item) => k.items.push({ ...item, kamer: k === overig ? '' : k.naam, kamerId: k.id, sleutel: `${item.soort}:${item.id}` });
    for (const e of bron?.huis?.etages ?? []) {
      for (const r of e.ruimtes ?? []) {
        const k = kamers.find((x) => x.id === r.id);
        for (const d of r.apparaten ?? []) {
          if (d.soort === 'licht') zet(k, { soort: 'licht', id: d.id, naam: d.naam });
          else if (d.soort === 'screen') zet(k, { soort: 'scherm', id: d.id, naam: d.naam, half: !!d.scherm?.standKiezen });
        }
      }
    }
    const h = bron?.hand;
    if (h?.aan) {
      for (const a of h.apparaten ?? []) if ((a.modi ?? []).some((m) => !m.niet)) zet(kamerVan(a.kamer), { soort: 'klimaat', id: a.id, naam: a.naam, klimaat: a });
      for (const s of h.schakelaars ?? []) zet(kamerVan(s.kamer), { soort: 'stekker', id: s.id, naam: s.naam });
    }
    // De slimme stekkers die SunArc mag schakelen (besluit 266), dubbel met een warmtebron hierboven niet.
    const alStekker = new Set((h?.aan ? h.schakelaars ?? [] : []).map((s) => s.naam));
    for (const s of bron?.stekker?.stekkers ?? []) if (s.mag && !alStekker.has(s.naam)) zet(overig, { soort: 'plug', id: s.id, naam: s.naam });
    for (const w of bron?.witgoed?.apparaten ?? []) zet(kamerVan(w.kamer), { soort: 'witgoed', id: w.id, naam: w.naam });
    for (const k of [...kamers, overig]) k.items.sort((a, b) => SOORTEN.indexOf(a.soort) - SOORTEN.indexOf(b.soort));
    const uit = etages.map((e) => ({ ...e, kamers: e.kamers.filter((k) => k.items.length) })).filter((e) => e.kamers.length);
    if (overig.items.length) uit.push({ id: '_overig', naam: t('tk.overig'), kamers: [overig] });
    return uit;
  }

  const alleItems = () => huis().flatMap((e) => e.kamers.flatMap((k) => k.items));
  const gekozen = () => {
    const alle = alleItems();
    return st.kies.map((s) => alle.find((i) => i.sleutel === s)).filter(Boolean);
  };
  /**
   * De scènes van de kamers met een gekozen lamp (besluit 268): die staan bij Hoe
   * onder de lampen, niet meer los bij Wat.
   */
  function lichtScenes() {
    const kamers = new Set(gekozen().filter((i) => i.soort === 'licht').map((i) => i.kamerId));
    const uit = [];
    const gezien = new Set();
    for (const e of bron?.huis?.etages ?? []) for (const r of e.ruimtes ?? []) if (kamers.has(r.id)) for (const sc of r.scenes ?? []) if (!gezien.has(sc.id) && gezien.add(sc.id)) uit.push({ id: sc.id, naam: sc.naam });
    return uit;
  }

  /** De scène die de lampen samen starten, of null: aan of uit, of los per lamp. */
  function gekozenScene() {
    const id = st.losOpen.includes('licht') ? null : st.hoe.licht?.scene;
    return id ? lichtScenes().find((x) => x.id === id) ?? null : null;
  }

  /** Wat "Hele kamer" kiest: de lampen en de screens. */
  const heelBaar = (i) => i.soort === 'licht' || i.soort === 'scherm';

  /* ------------------------------------------------------------ hoe */

  /** Wat een klimaatapparaat samen doet: de stand en het doel van de eerste, binnen wat elk kan. */
  function klimaatHoe(item) {
    const modi = item.klimaat.modi.filter((m) => !m.niet);
    const samen = st.hoe.klimaat;
    const m = modi.find((x) => x.modus === samen?.modus) ?? modi[0];
    const doelC = Math.max(m.min ?? 5, Math.min(m.max ?? 35, samen?.doelC ?? m.doelC ?? m.standaardC ?? 20));
    return { modus: m.modus, doelC, tot: samen?.tot ?? 'doel' };
  }

  /** Wat een apparaat doet: los als je dat koos, anders samen met zijn soort. */
  function hoeVan(item) {
    if (item.soort === 'klimaat') return { ...klimaatHoe(item), ...(st.los[item.sleutel] ?? {}) };
    return st.los[item.sleutel] ?? st.hoe[item.soort] ?? {};
  }

  /** Of er bij de keus iets te kiezen valt bij Hoe: scènes en witgoed starten gewoon. */
  const heeftHoe = () => gekozen().some((i) => i.soort !== 'scene' && i.soort !== 'witgoed');

  /* ------------------------------------------------------------ de stappen en de naam */

  function stappen() {
    if (st.voorstel) return st.voorstel.stappen;
    const lijst = gekozen();
    const uit = [];
    // Een scène in plaats van de lampen (besluit 268): één stap, en de lampen zelf niet.
    const scene = gekozenScene();
    if (scene) uit.push({ pad: 'api/scene', body: { id: scene.id } });
    // Een hele kamer met lampen die allemaal hetzelfde doen: één stap voor de kamer.
    const kamersHeel = new Set();
    for (const e of scene ? [] : huis()) {
      for (const k of e.kamers) {
        const lampen = k.items.filter((i) => i.soort === 'licht');
        if (lampen.length > 1 && lampen.every((l) => st.kies.includes(l.sleutel)) && new Set(lampen.map((l) => hoeVan(l).aan !== false)).size === 1 && k.id !== '_overig') {
          kamersHeel.add(k.id);
          uit.push({ pad: 'api/licht', body: { doel: 'kamer', id: k.id, aan: hoeVan(lampen[0]).aan !== false } });
        }
      }
    }
    for (const i of lijst) {
      const h = hoeVan(i);
      if (i.soort === 'licht' && scene) continue;
      if (i.soort === 'licht' && !kamersHeel.has(i.kamerId)) uit.push({ pad: 'api/licht', body: { doel: 'lamp', id: i.id, aan: h.aan !== false } });
      else if (i.soort === 'scherm') uit.push(h.actie === 'half' ? { pad: 'api/scherm', body: { id: i.id, actie: 'stand', standPct: 50 } } : { pad: 'api/scherm', body: { id: i.id, actie: h.actie ?? 'dicht' } });
      else if (i.soort === 'scene') uit.push({ pad: 'api/scene', body: { id: i.id } });
      else if (i.soort === 'klimaat') uit.push({ pad: 'api/hand', body: { id: i.id, modus: h.modus, doelC: h.doelC, tot: h.tot ?? 'doel' } });
      else if (i.soort === 'stekker') uit.push({ pad: 'api/hand', body: { id: i.id, tot: h.tot ?? 'uur1' } });
      else if (i.soort === 'plug') uit.push({ pad: 'api/stekker', body: { id: i.id, aan: h.aan !== false, duurMin: PLUG_DUUR[h.tot] ?? 60 } });
      else if (i.soort === 'witgoed') uit.push({ pad: 'api/witgoed', body: { id: i.id, start: true } });
    }
    return uit;
  }

  /** De gekozen apparaten in groepjes die hetzelfde doen, in de volgorde van de soorten. */
  function groepjes() {
    const uit = [];
    const scene = gekozenScene();
    for (const i of gekozen()) {
      const h = hoeVan(i);
      const actie = i.soort === 'licht' && scene ? 'scene' : i.soort === 'licht' || i.soort === 'stekker' || i.soort === 'plug' ? (h.aan === false ? 'uit' : 'aan') : i.soort === 'scherm' ? (h.actie ?? 'dicht') : i.soort === 'klimaat' ? h.modus : 'start';
      const sleutel = `${i.soort}|${actie}|${h.doelC ?? ''}|${h.tot ?? ''}`;
      let g = uit.find((x) => x.sleutel === sleutel);
      if (!g) uit.push((g = { sleutel, soort: i.soort, actie, hoe: h, items: [], ...(actie === 'scene' ? { scene } : {}) }));
      g.items.push(i);
    }
    return uit.sort((a, b) => SOORTEN.indexOf(a.soort) - SOORTEN.indexOf(b.soort));
  }

  /** "de keukenlamp", "het screen woonkamer", "de scène Avond"; in het Engels "the …". */
  function lidwoord(i) {
    const klein = i.naam.charAt(0).toLowerCase() + i.naam.slice(1);
    if (en()) return i.soort === 'scene' ? t('tk.scene', { naam: i.naam }) : `the ${klein}`;
    if (i.soort === 'scene') return t('tk.scene', { naam: i.naam });
    return `${/^(screen|scherm|rolluik|zonnescherm|licht)/i.test(i.naam) ? 'het' : 'de'} ${klein}`;
  }

  /** "a, b en c", met hooguit drie namen en dan "en 2 andere". */
  function opsom(namen) {
    const en2 = t('tk.en');
    if (namen.length > 3) return t('tk.enAndere', { lijst: namen.slice(0, 2).join(', '), n: namen.length - 2 });
    if (namen.length <= 1) return namen[0] ?? '';
    return `${namen.slice(0, -1).join(', ')} ${en2} ${namen.at(-1)}`;
  }

  /** Het werkwoord en de actie van een groepje, met de namen ertussen: "gaan {namen} aan". */
  function groepjeZin(g) {
    const n = g.items.length > 1 ? 'n' : '1';
    const namen = `<span class="tk-stuk${st.stuk === 'wat' ? ' open' : ''}" data-pl-stuk="wat">${esc(opsom(g.items.map(lidwoord)))}</span>`;
    if (g.soort === 'scene' || g.soort === 'witgoed') return t(`tk.start.${n}`, { namen });
    // Lampen met een scène (besluit 268): "start de scène Avond".
    if (g.actie === 'scene') return t('tk.start.1', { namen: `<span class="tk-stuk${st.stuk === 'hoe' ? ' open' : ''}" data-pl-stuk="hoe">${esc(t('tk.scene', { naam: g.scene.naam }))}</span>` });
    const duur = g.soort === 'klimaat' || g.soort === 'stekker' || g.soort === 'plug' ? t(`tk.duur.${g.hoe.tot ?? (g.soort === 'klimaat' ? 'doel' : 'uur1')}`) : '';
    const actie = g.soort === 'klimaat' ? t(`tk.a.${g.actie}.${n}`, { doel: graden(g.hoe.doelC) }) : t(`tk.a.${g.actie}.${n}`);
    const hoe = `<span class="tk-stuk${st.stuk === 'hoe' ? ' open' : ''}" data-pl-stuk="hoe">${esc(actie + duur)}</span>`;
    return t(`tk.gaan.${n}`, { namen, actie: hoe });
  }

  /** "Elke werkdag om 07:00", "Morgen bij zonsondergang". */
  function wanneerTekst() {
    const m = st.moment;
    const h = st.herhaal;
    const wanneer = m.soort === 'tijd' ? t('tk.om', { klok: `${String(m.uur).padStart(2, '0')}:${String(m.minuut).padStart(2, '0')}` }) : zonNaam(m);
    let vaak;
    if (h.soort === 'een') {
      const eerste = st.momenten?.[0];
      const n = eerste == null ? null : Math.round((new Date(eerste).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
      vaak = n === 0 ? t('gp.vandaag') : n === 1 ? t('gp.morgen') : n != null ? new Intl.DateTimeFormat(en() ? 'en-GB' : 'nl-NL', { weekday: 'long' }).format(eerste) : '';
      if (en() && vaak) vaak = vaak.toLowerCase();
    } else vaak = h.soort === 'dagen' ? t('tk.h.dagen', { dagen: herhaalNaam(h).toLowerCase() }) : t(`tk.h.${h.soort}`);
    return groot([vaak, wanneer].filter(Boolean).join(' '));
  }

  /** De zin, met elk stuk aan te tikken. Wat nog niet gekozen is, staat er grijs als vraag. */
  function zinHtml() {
    const stuk = (s, tekst, nog) => `<span class="tk-stuk${st.stuk === s ? ' open' : ''}${nog ? ' nog' : ''}" data-pl-stuk="${s}">${esc(tekst)}</span>`;
    const wanneer = st.wanneerGekozen || st.voorstel ? stuk('wanneer', wanneerTekst(), false) : stuk('wanneer', t('tk.leeg.wanneer'), true);
    let wat;
    // Een voorstel van de assistent is een gebiedende zin ("doe de screens dicht"): na een dubbele punt.
    if (st.voorstel) {
      const w = st.voorstel.wat || st.voorstel.tekst;
      return t('tk.zinVoorstel', { wanneer, wat: stuk('wat', w.charAt(0).toLowerCase() + w.slice(1), false) });
    } else {
      const g = groepjes();
      if (!g.length) wat = stuk('wat', t('tk.leeg.wat'), true);
      else {
        const delen = g.map(groepjeZin);
        wat = delen.length === 1 ? delen[0] : `${delen.slice(0, -1).join(', ')}${t('tk.enZin')}${delen.at(-1)}`;
      }
    }
    return t('tk.zin', { wanneer, wat });
  }

  /** De naam in de lijst: kort, zonder lidwoorden. "Keukenlamp en Lamp hal aan, Screen open". */
  function naam() {
    if (st.voorstel) return st.voorstel.tekst;
    const delen = groepjes().map((g) => {
      const namen = g.items.length > 2 ? t(g.soort === 'licht' ? 'pl.lampen' : g.soort === 'scherm' ? 'pl.schermen' : 'tk.apparaten', { n: g.items.length }) : opsom(g.items.map((i) => i.naam));
      if (g.actie === 'scene') return t('pl.wat.scene', { naam: g.scene.naam });
      if (g.soort === 'licht') return t(g.actie === 'uit' ? 'pl.wat.lichtUit' : 'pl.wat.lichtAan', { naam: namen });
      if (g.soort === 'scherm') return t(`pl.wat.${g.actie}`, { naam: namen });
      if (g.soort === 'scene') return t('pl.wat.scene', { naam: namen });
      if (g.soort === 'klimaat') return t(g.actie === 'koelen' ? 'pl.wat.koelen' : 'pl.wat.verwarmen', { naam: namen, doel: graden(g.hoe.doelC) });
      if (g.soort === 'stekker') return t('pl.wat.stekker', { naam: namen });
      if (g.soort === 'plug') return t(g.actie === 'uit' ? 'pl.wat.plugUit' : 'pl.wat.stekker', { naam: namen });
      return t('pl.wat.witgoed', { naam: namen });
    });
    const tekst = groot(delen.map((d, i) => (i ? d.charAt(0).toLowerCase() + d.slice(1) : d)).join(', '));
    return tekst.length > 120 ? `${tekst.slice(0, 117)}…` : tekst;
  }

  /** Waar het nieuwe moment vandaag op de boog staat; de dienst rekent het echte moment uit. */
  function vandaagMs(m) {
    if (m.soort === 'tijd') return new Date().setHours(m.uur, m.minuut, 0, 0);
    const z = m.zon === 'op' ? bron?.zon?.dag?.opMs : bron?.zon?.dag?.onderMs;
    return z == null ? null : z + m.minuten * 60_000;
  }

  /* ------------------------------------------------------------ de panelen */

  function knop(attr, waarde, tekst, aan) {
    return `<button type="button" ${attr}="${esc(waarde)}" aria-pressed="${aan}">${esc(tekst)}</button>`;
  }

  function watHtml() {
    if (!bron) return `<p class="mini">${esc(t('algemeen.laden'))}</p>`;
    const etages = huis();
    if (!etages.length) return `<p class="tk-leeg">${esc(t('pl.geenSoort'))}</p>`;
    const kamer = (k) => {
      const heel = k.items.filter(heelBaar);
      const allesHeel = heel.length > 0 && heel.every((i) => st.kies.includes(i.sleutel));
      const iets = k.items.some((i) => st.kies.includes(i.sleutel));
      const heelKnop = heel.length > 1 ? `<button type="button" class="tk-heel" data-pl-kamer="${esc(k.id)}" aria-pressed="${allesHeel}">${esc(t('tk.heleKamer'))}</button>` : '';
      // Overig heeft geen kamer: de naam staat al boven het groepje.
      const kop = k.id === '_overig' && !heelKnop ? '' : `<header><b>${esc(k.id === '_overig' ? '' : k.naam)}</b>${heelKnop}</header>`;
      return `<div class="tk-kamer${iets ? ' gekozen' : ''}">${kop}${k.items
        .map((i) => `<button type="button" class="tk-app" data-pl-kies="${esc(i.sleutel)}" aria-pressed="${st.kies.includes(i.sleutel)}">${svg(IK[i.soort])}<span>${esc(i.naam)}</span><i aria-hidden="true"></i></button>`)
        .join('')}</div>`;
    };
    const huisHtml = `<div class="tk-huis">${etages.map((e) => `<div class="tk-etage"><span>${esc(e.naam)}</span>${e.kamers.map(kamer).join('')}</div>`).join('')}</div>`;
    return `<h3 class="tk-kop">${esc(t('tk.k.wat'))}<em>${esc(t('tk.k.watUitleg'))}</em></h3>${huisHtml}`;
  }

  function wanneerHtml() {
    const m = st.moment;
    const h = st.herhaal;
    const seg = [['tijd', t('gp.tijd')], ['op', t('gp.op')], ['onder', t('gp.onder')]].map(([k, n]) => knop('data-pl-wanneer', k, n, k === 'tijd' ? m.soort === 'tijd' : m.soort === 'zon' && m.zon === k)).join('');
    const tijd = `${String(m.uur ?? 7).padStart(2, '0')}:${String(m.minuut ?? 0).padStart(2, '0')}`;
    const keuze = m.soort === 'tijd'
      ? `<input class="tk-tijd" type="time" value="${tijd}" data-pl-tijd aria-label="${esc(t('gp.tijd'))}">`
      : `<div class="tk-stapper"><button type="button" data-pl-min="-5" aria-label="${esc(t('gp.eerder'))}">−</button><b>${esc(stapperTekst(m))}</b><button type="button" data-pl-min="5" aria-label="${esc(t('gp.later'))}">+</button></div><div class="tk-zo">${esc(voorproef(m, bron?.zon))}</div>`;
    const keuzes = ['een', 'dag', 'werkdagen', 'weekend', 'dagen'].map((s) => `<button type="button" data-pl-herhaal="${s}" aria-pressed="${h.soort === s}"><span>${esc(t(s === 'dagen' ? 'gp.kiesDagen' : `gp.h.${s}`))}</span>${s === 'werkdagen' ? `<small>${esc(t('tk.maVr'))}</small>` : ''}</button>`).join('');
    const dagen = h.soort === 'dagen' ? `<div class="tk-dagen">${[1, 2, 3, 4, 5, 6, 7].map((d) => knop('data-pl-dag', d, t(`gp.d${d}`), (h.dagen ?? []).includes(d))).join('')}</div>` : '';
    return `<h3 class="tk-kop">${esc(t('tk.k.wanneer'))}</h3><div class="tk-twee">
      <div class="tk-vraag"><span>${esc(t('tk.k.op'))}</span><div class="tk-seg">${seg}</div>${keuze}</div>
      <div class="tk-vraag"><span>${esc(t('tk.k.hoevaak'))}</span><div class="tk-keus">${keuzes}</div>${dagen}</div>
    </div>`;
  }

  /** De knoppen van een soort: samen, of voor één apparaat los (`sleutel`). */
  function hoeKnoppen(soort, h, sleutel, item) {
    const at = (veld, waarde) => `data-pl-hoe="${soort}:${veld}:${waarde}"${sleutel ? ` data-pl-sleutel="${esc(sleutel)}"` : ''}`;
    const b = (veld, waarde, tekst, aan) => `<button type="button" ${at(veld, waarde)} aria-pressed="${aan}">${esc(tekst)}</button>`;
    if (soort === 'licht') {
      // Samen kan ook een scène van hun kamer (besluit 268); los per lamp alleen aan of uit.
      const scenes = sleutel ? [] : lichtScenes();
      const sc = sleutel ? null : gekozenScene();
      const aanUit = `<div class="tk-seg">${b('aan', '1', t('pl.aan'), !sc && h.aan !== false)}${b('aan', '0', t('pl.uit'), !sc && h.aan === false)}</div>`;
      if (!scenes.length) return aanUit;
      const keuzes = scenes.map((x) => `<option value="${esc(x.id)}"${sc?.id === x.id ? ' selected' : ''}>${esc(t('tk.sceneOptie', { naam: x.naam }))}</option>`).join('');
      return `<div class="tk-klimaat">${aanUit}<select class="tk-scene" data-pl-scene aria-label="${esc(t('tk.kiesScene'))}" data-gekozen="${!!sc}"><option value="">${esc(t('tk.ofScene'))}</option>${keuzes}</select></div>`;
    }
    if (soort === 'scherm') {
      const half = item ? item.half : gekozen().filter((i) => i.soort === 'scherm').every((i) => i.half);
      return `<div class="tk-seg">${['dicht', ...(half ? ['half'] : []), 'open'].map((a) => b('actie', a, t(`pl.${a}`), (h.actie ?? 'dicht') === a)).join('')}</div>`;
    }
    if (soort === 'stekker') return `<div class="tk-seg">${['uur1', 'uur2', 'dagdeel'].map((x) => b('tot', x, t(`pl.tot.${x}`), (h.tot ?? 'uur1') === x)).join('')}</div>`;
    // Een slimme stekker (besluit 266): aan of uit, en hoe lang; daarna weer zoals hij was.
    if (soort === 'plug') return `<div class="tk-klimaat"><div class="tk-seg">${b('aan', '1', t('pl.aan'), h.aan !== false)}${b('aan', '0', t('pl.uit'), h.aan === false)}</div><div class="tk-seg">${Object.keys(PLUG_DUUR).map((x) => b('tot', x, t(`pl.tot.${x}`), (h.tot ?? 'uur1') === x)).join('')}</div></div>`;
    return '';
  }

  function hoeHtml() {
    const lijst = gekozen();
    const rijen = [];
    for (const soort of ['licht', 'scherm', 'klimaat', 'stekker', 'plug']) {
      const items = lijst.filter((i) => i.soort === soort);
      if (!items.length) continue;
      const namen = opsom(items.map((i) => i.naam));
      if (soort === 'klimaat') {
        const h = klimaatHoe(items[0]);
        const modi = [...new Set(items.flatMap((i) => i.klimaat.modi.filter((m) => !m.niet).map((m) => m.modus)))];
        const modus = modi.length > 1 ? `<div class="tk-seg">${modi.map((m) => knop('data-pl-hoe', `klimaat:modus:${m}`, t(`pl.${m}`), h.modus === m)).join('')}</div>` : '';
        const doel = `<div class="tk-stapper"><button type="button" data-pl-doel="-1" aria-label="${esc(t('pl.lager'))}">−</button><b>${esc(graden(h.doelC))}</b><button type="button" data-pl-doel="1" aria-label="${esc(t('pl.hoger'))}">+</button></div>`;
        const tot = `<div class="tk-seg">${['uur1', 'uur2', 'dagdeel', 'doel'].map((x) => knop('data-pl-hoe', `klimaat:tot:${x}`, t(`pl.tot.${x}`), (h.tot ?? 'doel') === x)).join('')}</div>`;
        rijen.push(`<div class="tk-soort">${svg(IK.klimaat)}<div><b>${esc(t('tk.soort.klimaat'))}</b><small>${esc(namen)}</small></div><div class="tk-klimaat">${modus}${doel}${tot}</div></div>`);
        continue;
      }
      const samen = st.hoe[soort];
      const los = st.losOpen.includes(soort);
      const losKnop = items.length > 1 ? `<button type="button" class="tk-los" data-pl-los="${soort}">${esc(t(los ? 'tk.weerSamen' : 'tk.losAanpassen'))}</button>` : '';
      const apart = los ? `<div class="tk-apart">${items.map((i) => `<div><span>${esc(i.naam)}</span>${hoeKnoppen(soort, hoeVan(i), i.sleutel, i)}</div>`).join('')}</div>` : '';
      rijen.push(`<div class="tk-soort">${svg(IK[soort])}<div><b>${esc(t(`tk.soort.${soort}`))}</b><small>${esc(namen)}</small>${losKnop}</div>${los ? '' : hoeKnoppen(soort, samen)}${apart}</div>`);
    }
    const start = lijst.filter((i) => i.soort === 'scene' || i.soort === 'witgoed');
    if (start.length) rijen.push(`<p class="tk-uitleg">${esc(t('tk.startGewoon', { namen: opsom(start.map((i) => i.naam)) }))}</p>`);
    return `<h3 class="tk-kop">${esc(t('tk.k.hoe'))}<em>${esc(t('tk.k.hoeUitleg'))}</em></h3><div class="tk-soorten">${rijen.join('')}</div>`;
  }

  function klaarHtml() {
    return `<h3 class="tk-kop">${esc(t('tk.k.klaar'))}</h3>
      <div class="tk-rij"><span>${esc(t('gp.overslaan'))}<small>${esc(t('tk.overslaanZin'))}</small></span><button class="schakelaar" type="button" role="switch" aria-checked="${st.overslaanWeg}" aria-label="${esc(t('gp.overslaan'))}" data-pl-weg></button></div>
      <div class="tk-rij"><span>${esc(t('pl.meteenAan'))}<small>${esc(t('tk.meteenAanZin'))}</small></span><button class="schakelaar" type="button" role="switch" aria-checked="${st.aan}" aria-label="${esc(t('pl.meteenAan'))}" data-pl-meteen></button></div>`;
  }

  function zegHtml() {
    const mic = global.luisteren?.kan?.() && global.luisteren?.eenmaal ? `<button type="button" class="tk-mic${st.luistert ? ' aan' : ''}" data-pl-mic aria-label="${esc(t('pl.inspreken'))}">${svg(IK.mic)}</button>` : '';
    const voorbeelden = [1, 2, 3].map((i) => `<button type="button" data-pl-voorbeeld="${i}"><span>${esc(t(`pl.voorbeeld.${i}`))}</span><i>›</i></button>`).join('');
    return `<h3 class="tk-kop">${esc(t('pl.zeg'))}<em>${esc(t('pl.zegZin'))}</em></h3>
      <form class="tk-invoer" data-pl-zeg><input type="text" maxlength="200" value="${esc(st.zeg)}" placeholder="${esc(t('pl.zegVoorbeeld'))}" aria-label="${esc(t('pl.zeg'))}">${mic}<button type="submit" class="tk-maak"${st.bezig ? ' disabled' : ''}>${esc(t('pl.maak'))}</button></form>
      <div class="tk-voorbeelden">${voorbeelden}</div>`;
  }

  function komendHtml() {
    const ms = st.momenten;
    if (!st.wanneerGekozen && !st.voorstel) return `<div class="tk-komend"><div><b>${esc(t('tk.nogGeenMoment'))}</b><span>${esc(t('tk.tikMoment'))}</span></div></div>`;
    if (ms == null) return `<p class="mini">${esc(t('algemeen.laden'))}</p>`;
    if (!ms.length) return `<p class="tk-fout">${esc(t('pl.geenMoment'))}</p>`;
    const dag = (x) => {
      const n = Math.round((new Date(x).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
      const d = n === 0 ? t('gp.vandaag') : n === 1 ? t('gp.morgen') : new Intl.DateTimeFormat(en() ? 'en-GB' : 'nl-NL', n > 6 ? { weekday: 'long', day: 'numeric' } : { weekday: 'long' }).format(x);
      return groot(d);
    };
    return `<div class="tk-komend">${ms.slice(0, 4).map((x) => `<div><b>${esc(dag(x))}</b><span>${esc(klok(x))}</span></div>`).join('')}</div>`;
  }

  function boogHtml() {
    // Het moment van de dienst als dat vandaag is, zodat de boog en de lijst dezelfde minuut zeggen.
    const eerste = st.momenten?.[0];
    const ms = eerste != null && new Date(eerste).toDateString() === new Date().toDateString() ? eerste : vandaagMs(st.moment);
    const lijst = ms != null && (st.wanneerGekozen || st.voorstel) ? [{ ms, wat: '', aan: true, gekozen: true }] : [];
    return boog(lijst, { naast: true }, bron?.zon);
  }

  /* ------------------------------------------------------------ tekenen */

  /** Het volgende stuk na dit: Hoe slaat over als er niets te kiezen valt. */
  function volgende(s) {
    const i = STUKKEN.indexOf(s);
    const n = STUKKEN[i + 1] ?? 'klaar';
    return n === 'hoe' && !heeftHoe() ? 'klaar' : n;
  }

  /** Mag je verder: iets gekozen bij Wat, dagen bij Kies dagen, een moment en niet te veel bij Klaar. */
  function kanVerder() {
    if (st.stuk === 'zeg') return false;
    if (st.stuk === 'wat') return st.kies.length > 0 || !!st.voorstel;
    if (st.stuk === 'wanneer') return st.herhaal.soort !== 'dagen' || (st.herhaal.dagen ?? []).length > 0;
    if (st.stuk === 'klaar') return !!st.momenten?.length && !st.bezig && stappen().length > 0 && stappen().length <= MAX_STAPPEN && (st.wanneerGekozen || !!st.voorstel);
    return true;
  }

  function onderHtml() {
    const klaar = st.stuk === 'klaar';
    const n = st.kies.length;
    const te = !st.voorstel && stappen().length > MAX_STAPPEN;
    const links = st.stuk === 'zeg'
      ? `<button type="button" class="tk-link" data-pl-stuk="wat">${esc(t('tk.liever'))}</button>`
      : te
        ? `<span class="tk-fout">${esc(t('tk.teVeel', { n: MAX_STAPPEN }))}</span>`
        : st.stuk === 'wat' && n
          ? `<span class="tk-samen">${esc(t('tk.gekozen', { n }))}</span>`
          : `<span class="tk-hulp">${esc(t('pl.hulp'))} <button type="button" class="tk-link" data-pl-stuk="zeg">${esc(t('pl.hulpLink'))}</button></span>`;
    const fout = st.fout ? `<span class="tk-fout">${esc(st.fout)}</span>` : '';
    const knop2 = st.stuk === 'zeg' ? '' : `<button type="button" class="tk-verder${klaar ? ' zon' : ''}" data-pl-verder${kanVerder() ? '' : ' disabled'}>${esc(t(klaar ? 'pl.bewaar' : 'pl.verder'))}</button>`;
    return `<div class="tk-onder">${fout || links}${knop2}</div>`;
  }

  function paneelHtml() {
    if (st.stuk === 'zeg') return zegHtml();
    if (st.stuk === 'wat') return watHtml();
    if (st.stuk === 'wanneer') return wanneerHtml();
    if (st.stuk === 'hoe') return hoeHtml();
    return klaarHtml();
  }

  function teken() {
    if (!st) return;
    const tel = telStand();
    const ouder = document.getElementById(tel ? 'tel' : 'wand');
    for (const el of document.querySelectorAll('[data-pl]')) if (el.parentElement !== ouder) el.remove();
    let laag = ouder.querySelector(':scope > [data-pl]');
    if (!laag) {
      laag = document.createElement('div');
      laag.className = 'pl-laag';
      laag.setAttribute('data-pl', '');
      ouder.appendChild(laag);
    }
    // Wat je aan het typen was, blijft staan; een paneel dat je schoof ook.
    const invoer = laag.querySelector('[data-pl-zeg] input');
    const focus = invoer && document.activeElement === invoer;
    const schuif = laag.querySelector('.tk-paneel')?.scrollTop ?? 0;
    const zelfde = laag.dataset.stuk === st.stuk;
    const sluitKnop = `<button class="tk-sluit" type="button" data-pl-sluit aria-label="${esc(t('algemeen.sluiten'))}">×</button>`;
    const links = `<section class="tk-links"><span class="tk-soortje">${esc(t('tk.nieuweTaak'))}</span><p class="tk-zin">${zinHtml()}</p><div class="tk-paneel" data-stuk="${st.stuk}">${paneelHtml()}${tel && st.stuk === 'klaar' ? `<div class="tk-boog">${boogHtml()}</div>${komendHtml()}` : ''}</div>${onderHtml()}</section>`;
    const rechts = tel ? '' : `<section class="tk-rechts"><span class="tk-soortje">${esc(t('tk.jeDag'))}</span><div class="tk-boog">${boogHtml()}</div>${komendHtml()}<p class="tk-let">${esc(t('pl.let'))}</p></section>`;
    laag.dataset.stuk = st.stuk;
    laag.innerHTML = `${tel ? '<div class="pl-achter" data-pl-sluit></div>' : ''}<div class="tk-blad" role="dialog" aria-modal="true" aria-label="${esc(t('tk.nieuweTaak'))}">${tel ? '<div class="tk-greep"></div>' : ''}${sluitKnop}${links}${rechts}</div>`;
    if (zelfde) {
      const p = laag.querySelector('.tk-paneel');
      if (p) p.scrollTop = schuif;
    }
    if (focus) {
      const nieuw = laag.querySelector('[data-pl-zeg] input');
      nieuw?.focus();
      nieuw?.setSelectionRange(nieuw.value.length, nieuw.value.length);
    }
  }

  /* ------------------------------------------------------------ doen */

  /** De komende keren van de dienst, opnieuw na elke andere keus van wanneer of hoe vaak. */
  let vraagNr = 0;
  async function haalMomenten() {
    if (!st || (!st.wanneerGekozen && !st.voorstel)) return;
    if (st.herhaal.soort === 'dagen' && !(st.herhaal.dagen ?? []).length) return;
    const nr = ++vraagNr;
    st.momenten = null;
    const res = await deur('api/te-doen', { actie: 'voorproef', moment: st.moment, herhaal: st.herhaal.soort === 'dagen' ? st.herhaal : { soort: st.herhaal.soort } });
    if (!st || nr !== vraagNr) return;
    st.momenten = res?.ok ? ((await res.json().catch(() => null))?.momenten ?? []) : [];
    teken();
  }

  function naarStuk(s) {
    st.stuk = s;
    st.fout = '';
    if (s === 'wanneer' && !st.wanneerGekozen) {
      st.wanneerGekozen = true;
      void haalMomenten();
    }
    teken();
  }

  async function zeg(tekst) {
    st.zeg = tekst;
    if (!tekst.trim()) return;
    st.bezig = true;
    st.fout = '';
    st.stuk = 'zeg';
    teken();
    const q = new URLSearchParams({ v: 'vrij', tekst, taal: global.taal.code, voorstel: '1' });
    const body = await fetch(`api/vraag?${q}`).then((r) => r.json()).catch(() => null);
    if (!st) return;
    st.bezig = false;
    const v = body?.voorstel;
    if (!v) {
      st.fout = body?.antwoord || t('pl.voorstelFout');
      return teken();
    }
    st.voorstel = v;
    st.moment = v.moment;
    st.herhaal = v.herhaal;
    st.stuk = 'klaar';
    teken();
    await haalMomenten();
  }

  async function bewaar() {
    st.bezig = true;
    teken();
    const res = await deur('api/te-doen', { actie: 'plan', tekst: naam(), stappen: stappen(), moment: st.moment, herhaal: st.herhaal.soort === 'dagen' ? st.herhaal : { soort: st.herhaal.soort }, overslaanWeg: st.overslaanWeg, aan: st.aan });
    if (!st) return;
    st.bezig = false;
    if (!res) return teken();
    if (!res.ok) {
      st.fout = (await res.json().catch(() => null))?.fout ?? t('gp.lukteNiet');
      return teken();
    }
    const klaar = naBewaren;
    sluit();
    await klaar?.();
  }

  function luister() {
    if (st.luistert) return;
    st.luistert = true;
    teken();
    const op = (b) => {
      if (b.soort === 'tekst' || b.soort === 'fout' || b.soort === 'dicht') {
        st.luistert = false;
        if (b.soort === 'tekst' && b.tekst) return void zeg(b.tekst);
        if (b.soort === 'fout') st.fout = b.reden;
        teken();
      }
    };
    global.luisteren.eenmaal(op).catch(() => {
      st.luistert = false;
      st.fout = t('assistent.geenMicrofoon');
      teken();
    });
  }

  /** Een eigen keus maakt van een voorstel weer je eigen taak. */
  function zelf() {
    if (st.voorstel) {
      st.voorstel = null;
      st.kies = [];
    }
  }

  function kies(sleutel) {
    zelf();
    st.kies = st.kies.includes(sleutel) ? st.kies.filter((s) => s !== sleutel) : [...st.kies, sleutel];
    delete st.los[sleutel];
  }

  document.addEventListener('click', (e) => {
    if (!st) return;
    const el = (s) => e.target.closest(s);
    if (!el('[data-pl]')) return;
    let x;
    if (el('[data-pl-sluit]')) return sluit();
    if ((x = el('[data-pl-voorbeeld]'))) return void zeg(t(`pl.voorbeeld.${x.dataset.plVoorbeeld}`));
    if (el('[data-pl-mic]')) return luister();
    if ((x = el('[data-pl-stuk]'))) {
      if (x.dataset.plStuk === 'wat') zelf();
      return naarStuk(x.dataset.plStuk);
    }
    if (el('[data-pl-verder]')) {
      if (!kanVerder()) return;
      if (st.stuk === 'klaar') return void bewaar();
      return naarStuk(volgende(st.stuk));
    }
    if ((x = el('[data-pl-kies]'))) kies(x.dataset.plKies);
    else if ((x = el('[data-pl-kamer]'))) {
      zelf();
      const k = huis().flatMap((e2) => e2.kamers).find((y) => y.id === x.dataset.plKamer);
      const heel = (k?.items ?? []).filter(heelBaar).map((i) => i.sleutel);
      const alles = heel.every((s) => st.kies.includes(s));
      st.kies = alles ? st.kies.filter((s) => !heel.includes(s)) : [...st.kies, ...heel.filter((s) => !st.kies.includes(s))];
    } else if ((x = el('[data-pl-hoe]'))) {
      const [soort, veld, ruw] = x.dataset.plHoe.split(':');
      const waarde = veld === 'aan' ? ruw === '1' : ruw;
      const sleutel = x.dataset.plSleutel;
      if (sleutel) st.los[sleutel] = { ...(st.los[sleutel] ?? st.hoe[soort] ?? {}), [veld]: waarde };
      else if (soort === 'klimaat') {
        const eerste = gekozen().find((i) => i.soort === 'klimaat');
        const nu = eerste ? klimaatHoe(eerste) : {};
        const m = veld === 'modus' ? eerste?.klimaat.modi.find((y) => y.modus === waarde) : null;
        st.hoe.klimaat = { ...nu, [veld]: waarde, ...(m?.doelC != null ? { doelC: m.doelC } : {}) };
      } else {
        st.hoe[soort] = { ...st.hoe[soort], [veld]: waarde };
        // Aan of uit bij de lampen: dan geen scène meer.
        if (soort === 'licht' && veld === 'aan') delete st.hoe.licht.scene;
      }
    } else if ((x = el('[data-pl-doel]'))) {
      const eerste = gekozen().find((i) => i.soort === 'klimaat');
      if (eerste) {
        const nu = klimaatHoe(eerste);
        const m = eerste.klimaat.modi.find((y) => y.modus === nu.modus) ?? eerste.klimaat.modi[0];
        const stap = m?.stap ?? 0.5;
        st.hoe.klimaat = { ...nu, doelC: Math.round(Math.max(m?.min ?? 5, Math.min(m?.max ?? 35, nu.doelC + Number(x.dataset.plDoel) * stap)) * 10) / 10 };
      }
    } else if ((x = el('[data-pl-los]'))) {
      const soort = x.dataset.plLos;
      if (st.losOpen.includes(soort)) {
        // Weer samen: wat los stond, gaat terug naar de stand van de soort.
        st.losOpen = st.losOpen.filter((s) => s !== soort);
        for (const i of gekozen()) if (i.soort === soort) delete st.los[i.sleutel];
      } else {
        st.losOpen = [...st.losOpen, soort];
        // Los per lamp kent geen scène.
        if (soort === 'licht') st.hoe.licht = { aan: st.hoe.licht?.aan !== false };
      }
    } else if ((x = el('[data-pl-wanneer]'))) {
      const k = x.dataset.plWanneer;
      if (k === 'tijd' && st.moment.soort !== 'tijd') st.moment = { soort: 'tijd', uur: 7, minuut: 0 };
      else if (k !== 'tijd') st.moment = { soort: 'zon', zon: k, minuten: st.moment.soort === 'zon' ? st.moment.minuten : 0 };
      void haalMomenten();
    } else if ((x = el('[data-pl-min]'))) {
      st.moment = { ...st.moment, minuten: Math.max(-180, Math.min(180, st.moment.minuten + Number(x.dataset.plMin))) };
      void haalMomenten();
    } else if ((x = el('[data-pl-herhaal]'))) {
      const s = x.dataset.plHerhaal;
      st.herhaal = s === 'dagen' ? { soort: 'dagen', dagen: st.herhaal.dagen?.length ? st.herhaal.dagen : [new Date().getDay() || 7] } : { soort: s };
      void haalMomenten();
    } else if ((x = el('[data-pl-dag]'))) {
      const d = Number(x.dataset.plDag);
      const dagen = new Set(st.herhaal.dagen ?? []);
      if (dagen.has(d)) dagen.delete(d);
      else dagen.add(d);
      st.herhaal = { soort: 'dagen', dagen: [...dagen].sort((a, b) => a - b) };
      void haalMomenten();
    } else if (el('[data-pl-weg]')) st.overslaanWeg = !st.overslaanWeg;
    else if (el('[data-pl-meteen]')) st.aan = !st.aan;
    else return;
    teken();
  });

  document.addEventListener('submit', (e) => {
    const f = e.target.closest?.('[data-pl-zeg]');
    if (!f || !st) return;
    e.preventDefault();
    void zeg(f.querySelector('input').value);
  });

  document.addEventListener('input', (e) => {
    if (st && e.target.closest?.('[data-pl-zeg]')) st.zeg = e.target.value;
  });

  document.addEventListener('change', (e) => {
    // Een scène voor de lampen (besluit 268), of weer gewoon aan.
    const scene = e.target.closest?.('[data-pl-scene]');
    if (scene && st) {
      zelf();
      st.hoe.licht = scene.value ? { aan: true, scene: scene.value } : { aan: true };
      return teken();
    }
    const tijd = e.target.closest?.('[data-pl-tijd]');
    if (!tijd || !st) return;
    const [u, m] = tijd.value.split(':').map(Number);
    if (Number.isInteger(u) && Number.isInteger(m)) st.moment = { soort: 'tijd', uur: u, minuut: m };
    teken();
    void haalMomenten();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && st) sluit();
  });
  addEventListener('resize', () => st && teken());

  global.plannen = { open, sluit, isOpen: () => st != null, boog, herhaalNaam, zonNaam, stapperTekst, voorproef };
})(window);
