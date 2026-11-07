/*
 * Het blad van een apparaat (ronde 5, besluit 238, schetsen Wand-Apparaat-Blad
 * en Tel-Apparaat-Blad). Eerst was dit "klimaat met de hand" (besluit 235): een
 * laag met een lijst en een blad. Nu is het één blad per apparaat, of je het
 * via Apparaten of via het huis opent:
 *
 *  - een klimaatapparaat: de draaiknop met min en plus, wat (warm of koelen),
 *    hoe lang (1 uur, 2 uur, tot het eind van het dagdeel, of tot het doel),
 *    de dag als balk, en eerlijk via welke knop het gaat;
 *  - witgoed dat op zon wacht: hoe laat hij uiterlijk klaar moet zijn, en Nu
 *    starten;
 *  - een slimme stekker (besluit 265): aan of uit, voor 30 minuten, een of
 *    twee uur, of tot een tijd; daarna weer zoals hij was.
 *
 * Op Apparaten staat het blad op de wand rechts naast de kaarten en op de
 * telefoon van onderen; bij een kamer staat het in het blad van de kamer zelf.
 * De dienst doet het werk: `api/hand` voor klimaat, `api/uitstel` en
 * `api/witgoed` voor witgoed.
 */
(function (global) {
  'use strict';
  if (global.hand) return;

  const { esc, nl, haal, deur, telStand, klokVan } = global.app;
  const t = (k, p) => global.t(k, p);

  let data = null;
  let witgoed = null;
  /** De slimme stekkers (besluit 265): `{ aan, stekkers }` van `api/stekker`. */
  let stekkers = null;
  /**
   * Wat er open is: een klimaatapparaat `{ id, modus, doel, tot, plek }`, of
   * witgoed `{ wg, stap }`; null zonder blad. Met `plek` staat het blad in die
   * plek (het blad van een kamer), anders in een eigen laag.
   */
  let open = null;
  let fout = '';

  const graden = (n) => `${nl(n, Number.isInteger(n) ? 0 : 1)}°`;
  const vind = (id) => (data?.apparaten ?? []).find((a) => a.id === id) ?? null;
  const stekkerVan = (id) => (stekkers?.stekkers ?? []).find((s) => s.id === id) ?? null;

  /** Het klimaatapparaat bij een apparaat uit het huis: via het apparaat uit de configuratie, of zijn naam in Home Assistant. */
  function bij(d) {
    if (!data?.aan) return null;
    return (data.apparaten ?? []).find((a) => (d.actuatorId != null && a.actuatorId === d.actuatorId) || a.id === d.id) ?? null;
  }

  /** Wat het apparaat nu doet, als korte zin. */
  function nuZin(a) {
    if (a.actief) {
      const tot = a.actief.totDoel ? t('hand.totHetDoel', { doel: graden(a.actief.doelC) }) : t('hand.totKlokKort', { klok: klokVan(a.actief.totMs) });
      return a.actief.modus === 'koelen' ? t('hand.handKoelenTot', { doel: graden(a.actief.doelC), tot }) : t('hand.handOpTot', { doel: graden(a.actief.doelC), tot });
    }
    const hvac = a.hvac === 'heat' ? t('hand.verwarmt') : a.hvac === 'cool' ? t('hand.koelt') : a.hvac === 'off' ? t('hand.uit') : '';
    return [t('hand.volgt'), hvac].filter(Boolean).join(' · ');
  }

  /** Tot wanneer, uit de keuze: een uur, twee uur, of het eind van het dagdeel (ook de uiterste tijd van "tot het doel"). */
  const totVan = (keus) => (keus === 'u1' ? Date.now() + 3_600_000 : keus === 'u2' ? Date.now() + 2 * 3_600_000 : data.dagdeelTotMs);

  /** De dag als balk: van nu tot de eindtijd in zonkleur. */
  function dagbalk(totMs, label) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const pct = (ms) => Math.max(0, Math.min(100, ((ms - d.getTime()) / 86_400_000) * 100));
    const nu = pct(Date.now());
    const tot = pct(totMs);
    return `<div class="hand-dag" role="img" aria-label="${esc(t('hand.balkUitleg', { klok: klokVan(totMs) }))}"><div class="balk24"><i class="hand" style="left: ${nu.toFixed(1)}%; width: ${Math.max(1, tot - nu).toFixed(1)}%"></i><b style="left: ${nu.toFixed(1)}%"></b></div><div class="assen"><span style="left: 0; transform: none">0</span><span style="left: ${nu.toFixed(1)}%; transform: translateX(-100%); padding-right: 4px">${esc(t('hand.nu'))}</span><span style="left: ${Math.min(tot, 76).toFixed(1)}%; transform: none" class="tot">${esc(label)}</span>${tot > 55 ? '' : '<span style="right: 0; left: auto; transform: none">24</span>'}</div></div>`;
  }

  /** De draaiknop: een boog van het laagste tot het hoogste doel, met het doel en wat het nu is. */
  function wijzer(a, m) {
    const warm = m.modus !== 'koelen';
    const kleur = warm ? '#ff9a6b' : '#6fd3ff';
    const lo = Math.max(m.min, 10);
    const hi = Math.min(m.max, 30);
    const binnen = (c) => Math.max(lo, Math.min(hi, c));
    const hoek = (c) => (-225 + ((binnen(c) - lo) / Math.max(1, hi - lo)) * 270) * (Math.PI / 180);
    const punt = (c, r) => [105 + r * Math.cos(hoek(c)), 100 + r * Math.sin(hoek(c))];
    const nu = a.nuC;
    const streep = [];
    const stap = (hi - lo) / 28;
    for (let c = lo; c <= hi + 0.001; c += stap) {
      const [x1, y1] = punt(c, 78);
      const [x2, y2] = punt(c, 88);
      const tussen = nu != null && c >= Math.min(nu, open.doel) - stap / 2 && c <= Math.max(nu, open.doel) + stap / 2;
      streep.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${tussen ? kleur : 'rgba(255,255,255,0.18)'}" stroke-width="${tussen ? 3 : 2}" stroke-linecap="round"/>`);
    }
    const [dx, dy] = punt(open.doel, 66);
    const label = nu == null ? t('kamer.doelLabel', { doel: nl(open.doel) }) : t('kamer.doelNuLabel', { doel: nl(open.doel), nu: nl(nu) });
    return `<svg class="hand-wijzer" viewBox="0 0 210 190" role="img" aria-label="${esc(label)}">${streep.join('')}<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="6" fill="${kleur}"/>
      <text x="105" y="112" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="600" font-size="50" fill="currentColor">${esc(graden(open.doel))}</text>
      ${nu == null ? '' : `<text x="105" y="136" text-anchor="middle" font-family="Figtree" font-size="13" fill="#8494a5">${esc(t('hand.nuGraden', { graden: graden(nu) }))}</text>`}</svg>`;
  }

  /** Eerlijk: via welke knop, wat de regeling ermee doet, en wanneer het terug gaat. */
  function hoeZin(a, m, totMs) {
    const klok = klokVan(totMs);
    if (!data.aan) return { let: true, tekst: t('hand.staatUitZin') };
    if (m.niet === 'koelstrategie') return { let: true, tekst: t('hand.nietKoelen') };
    if (m.niet === 'vakantie') return { let: true, tekst: t('hand.nietVakantie') };
    if (open.tot === 'doel') return { tekst: t(m.modus === 'koelen' ? 'hand.zinDoelKoelen' : 'hand.zinDoel', { doel: graden(open.doel), klok }) };
    const terug = m.standaardC != null ? graden(m.standaardC) : '';
    if (a.soort === 'radiatorknop') return { tekst: t('hand.zinRadiator', { doel: graden(open.doel), klok, terug }) };
    if (m.via === 'direct') return { let: true, tekst: t('hand.zinDirect', { doel: graden(open.doel), klok }) };
    if (m.modus === 'koelen') return { tekst: t('hand.zinKoelen', { doel: graden(open.doel), klok, terug }) };
    if (/badkamer/.test(a.id)) return { tekst: t('hand.zinBadkamer', { doel: graden(open.doel), klok, terug }) };
    return { tekst: t('hand.zinKnop', { klok, terug }) };
  }

  const seg = (naam, keuzes) => `<div class="chips seg hand-seg" role="group" aria-label="${esc(naam)}">${keuzes.map(([k, w, aan, attr]) => `<button type="button" class="chip" ${attr}="${k}" aria-pressed="${aan}">${esc(w)}</button>`).join('')}</div>`;

  function kopVan(naam, zin) {
    return `<div class="hand-boven"><div><h2>${esc(naam)}</h2><p class="nu">${esc(zin)}</p></div><button type="button" class="sluit" data-hand-sluit aria-label="${esc(t('algemeen.sluiten'))}">×</button></div>`;
  }

  /** Het blad van een klimaatapparaat; in een kamer zonder eigen kop. */
  function blad(a, metKop) {
    const totMs = totVan(open.tot);
    const m = a.modi.find((x) => x.modus === open.modus) ?? a.modi[0];
    const lang = seg(t('hand.hoeLang'), [
      ['u1', t('hand.uur1'), open.tot === 'u1', 'data-hand-tot'],
      ['u2', t('hand.uur2'), open.tot === 'u2', 'data-hand-tot'],
      ['dagdeel', t('hand.totKlok', { klok: klokVan(data.dagdeelTotMs) }), open.tot === 'dagdeel', 'data-hand-tot'],
      ['doel', t('hand.totDoel', { doel: graden(open.doel) }), open.tot === 'doel', 'data-hand-tot'],
    ]);
    const kop = metKop ? kopVan(a.naam, [a.kamer, a.nuC != null ? t('hand.nuGraden', { graden: graden(a.nuC) }) : null, nuZin(a)].filter(Boolean).join(' · ')) : '';
    const terugKnop = a.actief ? `<button type="button" class="hand-terug" data-hand-terug>${esc(t('hand.terug'))}</button>` : '';
    const wat = a.modi.length > 1 ? seg(t('hand.wat'), a.modi.map((x) => [x.modus, t(`hand.modus.${x.modus}`), x.modus === m.modus, 'data-hand-modus'])) : '';
    const hoe = hoeZin(a, m, totMs);
    const kan = data.aan && !m.niet;
    const zet = a.actief ? t('hand.bewaar') : m.modus === 'koelen' ? t('hand.zetKoel', { doel: graden(open.doel) }) : m.via === 'direct' && open.tot !== 'doel' ? t('hand.zetWarm', { klok: klokVan(totMs) }) : t('hand.zetOp', { doel: graden(open.doel) });
    const label = open.tot === 'doel' ? t('hand.balkDoel', { doel: graden(open.doel), klok: klokVan(totMs) }) : t('hand.terugOm', { klok: klokVan(totMs) });
    return `${kop}
      <div class="hand-knoprij"><button type="button" data-hand-doel="-1" aria-label="${esc(t('hand.lager'))}" ${open.doel - m.stap < m.min ? 'disabled' : ''}>−</button>${wijzer(a, m)}<button type="button" data-hand-doel="1" aria-label="${esc(t('hand.hoger'))}" ${open.doel + m.stap > m.max ? 'disabled' : ''}>+</button></div>
      ${wat}
      <div class="hand-vraag"><span>${esc(t('hand.hoeLang'))}</span>${lang}</div>
      ${dagbalk(totMs, label)}
      <div class="hand-hoe${hoe.let ? ' let' : ''}">${esc(hoe.tekst)}</div>
      ${fout ? `<p class="hand-fout">${esc(fout)}</p>` : ''}
      <div class="hand-onder">${terugKnop}<button type="button" class="hand-zet" data-hand-zet ${kan ? '' : 'disabled'}>${esc(zet)}</button></div>`;
  }

  /**
   * Witgoed dat (nog) niet klaarstaat (besluit 245): hoe je hem klaarzet, of dat
   * hij nu draait. Zo weet je dat er iets mee kan, ook voordat hij wacht.
   */
  function witgoedUitleg(d, stand) {
    const draait = d.stand === 'running';
    const stappen = ['vul', 'afstand', 'kies'].map((s, i) => `<li><i>${i + 1}</i><span>${esc(t(`witgoed.stap.${s}`))}</span></li>`).join('');
    const nu = stand?.kan ? `<button type="button" class="hand-terug" data-wg-start>${esc(t('witgoed.nuStarten'))}</button>` : '';
    // De zin van de kaart niet nog eens: de stappen zeggen hetzelfde, uitgebreider.
    return `${kopVan(d.naam, d.kop)}
      <div class="hand-vraag hand-kolom"><span>${esc(t(draait ? 'witgoed.straks' : 'witgoed.zoKlaar'))}</span><ol class="wg-stappen">${stappen}</ol></div>
      <div class="hand-hoe">${esc(t('witgoed.hoe'))}</div>
      ${fout ? `<p class="hand-fout">${esc(fout)}</p>` : ''}
      <div class="hand-onder">${nu}<button type="button" class="hand-zet" data-hand-sluit>${esc(t('witgoed.begrepen'))}</button></div>`;
  }

  /* ------------------------------------------- een slimme stekker (265) */

  /** Tot wanneer: 30 minuten, een of twee uur, of de eerstvolgende keer dat het die tijd is. */
  function stekkerTot(o) {
    if (o.tot === 'm30') return Date.now() + 30 * 60_000;
    if (o.tot === 'u1') return Date.now() + 3_600_000;
    if (o.tot === 'u2') return Date.now() + 2 * 3_600_000;
    const [u, m] = String(o.tijd ?? '22:00').split(':').map(Number);
    const d = new Date();
    d.setHours(u || 0, m || 0, 0, 0);
    if (d.getTime() <= Date.now() + 60_000) d.setDate(d.getDate() + 1);
    return d.getTime();
  }

  /** Wat de stekker nu doet, als korte zin: aan of uit, wat hij trekt, en met de hand tot wanneer. */
  function stekkerZin(s) {
    return [
      s.aan == null ? null : t(s.aan ? 'apparaten.stekkerAan' : 'apparaten.stekkerUit'),
      s.vermogenW != null && s.vermogenW >= 5 ? `${nl(s.vermogenW / 1000)} kW` : null,
      s.actief ? t(s.actief.aan ? 'hand.stekkerAanTot' : 'hand.stekkerUitTot', { klok: klokVan(s.actief.totMs) }) : null,
    ].filter(Boolean).join(' · ');
  }

  /** "2 uur", "1 u 20", "45 min". */
  function duurVan(min) {
    const u = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return u === 0 ? t('hand.duurMin', { m }) : m === 0 ? t('hand.duurUur', { u }) : t('hand.duurUurMin', { u, m });
  }

  function stekkerBlad(s) {
    const totMs = stekkerTot(open);
    const klok = klokVan(totMs);
    const wat = seg(t('hand.wat'), [
      ['aan', t('hand.stekkerAanKort'), open.aan, 'data-st-aan'],
      ['uit', t('hand.stekkerUitKort'), !open.aan, 'data-st-aan'],
    ]);
    const lang = seg(t('hand.hoeLang'), [
      ['m30', t('hand.min30'), open.tot === 'm30', 'data-st-tot'],
      ['u1', t('hand.uur1'), open.tot === 'u1', 'data-st-tot'],
      ['u2', t('hand.uur2'), open.tot === 'u2', 'data-st-tot'],
      ['tijd', t('hand.totEenTijd'), open.tot === 'tijd', 'data-st-tot'],
    ]);
    const tijd = open.tot === 'tijd' ? `<label class="veldnaam">${esc(t('hand.totHoeLaat'))}<input class="invoer" type="time" data-st-tijd value="${esc(open.tijd)}"></label>` : '';
    const hoe = !stekkers?.aan
      ? { let: true, tekst: t('hand.stekkerAlleenAddon') }
      : !s.toegelaten
        ? { let: true, tekst: t('hand.stekkerToelaten') }
        : { tekst: t('hand.stekkerDaarna', { klok }) };
    // Op zon, echt geschakeld (besluit 267): dat SunArc hem zelf schakelt, en hoe ver hij is met zijn minimum.
    const zonZin = s.zon?.schakelt
      ? [t('hand.stekkerOpZon'), s.minimum ? t('hand.stekkerMinimum', { duur: duurVan(s.minimum.minuten), klok: s.minimum.klok, gehad: duurVan(s.gehadMin ?? 0) }) : ''].filter(Boolean).join(' ')
      : '';
    const terugKnop = s.actief ? `<button type="button" class="hand-terug" data-st-terug>${esc(t('hand.stekkerTerug'))}</button>` : '';
    const toelaten = stekkers?.aan && !s.toegelaten ? `<a class="hand-terug" href="regeling.html#opzon">${esc(t('hand.stekkerNaarRegeling'))}</a>` : '';
    return `${kopVan(s.naam, stekkerZin(s) || t('apparaten.stekker'))}
      <div class="hand-vraag"><span>${esc(t('hand.wat'))}</span>${wat}</div>
      <div class="hand-vraag"><span>${esc(t('hand.hoeLang'))}</span>${lang}</div>
      ${tijd}
      ${dagbalk(totMs, t(open.aan ? 'hand.stekkerBalkAan' : 'hand.stekkerBalkUit', { klok }))}
      <div class="hand-hoe${hoe.let ? ' let' : ''}">${esc(hoe.tekst)}</div>
      ${zonZin ? `<div class="hand-hoe">${esc(zonZin)}</div>` : ''}
      ${fout ? `<p class="hand-fout">${esc(fout)}</p>` : ''}
      <div class="hand-onder">${terugKnop}${toelaten}<button type="button" class="hand-zet" data-st-zet ${s.mag ? '' : 'disabled'}>${esc(t(open.aan ? 'hand.stekkerZetAan' : 'hand.stekkerZetUit', { klok }))}</button></div>`;
  }

  async function laadStekkers() {
    try {
      stekkers = await haal('api/stekker');
    } catch {
      stekkers = null;
    }
    return stekkers;
  }

  /** Opent het blad van een stekker; staat hij uit, dan begint het blad bij aan. */
  async function openStekker(id) {
    await laadStekkers();
    const s = stekkerVan(id);
    if (!s) return;
    open = { st: id, aan: s.actief ? s.actief.aan : s.aan !== true, tot: 'u1', tijd: '22:00' };
    fout = '';
    teken();
  }

  /** Het blad van witgoed: uiterlijk klaar, en Nu starten (besluit 238); staat hij niet klaar, de uitleg. */
  function witgoedBlad(d) {
    if (!d.kanKiezen) return witgoedUitleg(d, (witgoed?.apparaten ?? []).find((x) => x.id === d.id));
    const stappen = [{ tekst: t('apparaten.geenHaast'), waarde: null }, ...(d.stappen ?? [])];
    const s = stappen[open.stap] ?? stappen[0];
    const stand = (witgoed?.apparaten ?? []).find((x) => x.id === d.id);
    const zin = s.waarde == null ? (d.uiterlijk ? t('witgoed.geenHaastZin', { klok: d.uiterlijk }) : t('witgoed.geenHaastKort')) : t('witgoed.begintUiterlijk', { klok: klokVan(s.beginMs) });
    const duur = d.duurMin != null ? t('witgoed.programma', { duur: `${Math.floor(d.duurMin / 60)}:${String(d.duurMin % 60).padStart(2, '0')}` }) : null;
    const nu = stand?.kan ? `<button type="button" class="hand-terug" data-wg-start>${esc(t('witgoed.nuStarten'))}</button>` : '';
    return `${kopVan(d.naam, [d.kop, duur].filter(Boolean).join(' · '))}
      <p class="hand-hoe" style="margin: 0">${esc(d.zin)}</p>
      <div class="hand-vraag hand-kolom"><span>${esc(t('witgoed.uiterlijkKlaar'))}</span>
        <div class="hand-tijd"><button type="button" data-wg-stap="-1" aria-label="${esc(t('witgoed.eerder'))}" ${open.stap <= 0 ? 'disabled' : ''}>−</button><div class="getal"><b${s.waarde == null ? ' class="woord"' : ''}>${esc(s.tekst)}</b><span>${esc(zin)}</span></div><button type="button" data-wg-stap="1" aria-label="${esc(t('witgoed.later'))}" ${open.stap >= stappen.length - 1 ? 'disabled' : ''}>+</button></div>
      </div>
      <div class="hand-hoe">${esc(stand && !stand.kan && stand.reden ? `${t('witgoed.hoe')} ${t('witgoed.nuNiet', { reden: stand.reden })}` : t('witgoed.hoe'))}</div>
      ${fout ? `<p class="hand-fout">${esc(fout)}</p>` : ''}
      <div class="hand-onder">${nu}<button type="button" class="hand-zet" data-wg-bewaar>${esc(t('hand.bewaar'))}</button></div>`;
  }

  function teken() {
    if (open?.plek) {
      const a = vind(open.id);
      if (!a || !open.plek.isConnected) return;
      open.plek.innerHTML = blad(a, false);
      return;
    }
    let laag = document.querySelector('[data-hand]');
    if (!open) {
      laag?.remove();
      return;
    }
    if (!laag) {
      laag = document.createElement('div');
      laag.className = 'hand-laag';
      laag.setAttribute('data-hand', '');
      laag.setAttribute('role', 'dialog');
      laag.setAttribute('aria-modal', 'true');
      (telStand() ? document.body : (document.getElementById('wand') ?? document.body)).append(laag);
    }
    // Niet 'tel': die klasse is in kit.css het telefoonframe van de schetsen, 390 breed (2 november 2026).
    laag.classList.toggle('op-tel', telStand());
    const naam = open.wg ? open.wg.naam : open.st ? stekkerVan(open.st)?.naam ?? '' : vind(open.id)?.naam ?? '';
    laag.setAttribute('aria-label', naam);
    const st = open.st ? stekkerVan(open.st) : null;
    const inhoud = open.wg ? witgoedBlad(open.wg) : open.st ? (st ? stekkerBlad(st) : '') : (() => {
      const a = vind(open.id);
      return a ? blad(a, true) : '';
    })();
    laag.innerHTML = `<div class="hand-achter" data-hand-sluit></div><div class="hand-vel"><section class="glas hand-blad">${inhoud}</section></div>`;
    global.dispatchEvent(new CustomEvent('handblad', { detail: { id: open.wg ? open.wg.id : open.st ?? open.id } }));
  }

  /** Begint een klimaatapparaat: wat er met de hand staat, wat het nu doet (een airco die koelt), of het doel van zijn knop. */
  function begin(id, plek = null) {
    const a = vind(id);
    if (!a) return null;
    const actief = a.actief ?? null;
    const doetNu = a.hvac === 'cool' ? 'koelen' : a.hvac === 'heat' ? 'verwarmen' : null;
    const m = a.modi?.find((x) => x.modus === actief?.modus) ?? a.modi?.find((x) => x.modus === doetNu && !x.niet) ?? a.modi?.find((x) => !x.niet) ?? a.modi?.[0];
    return { id, modus: m?.modus ?? null, doel: actief?.doelC ?? m?.doelC ?? 20, tot: actief?.totDoel ? 'doel' : 'dagdeel', plek };
  }

  async function laad() {
    try {
      data = await haal('api/hand');
    } catch {
      data = null;
    }
    return data;
  }

  /** Opent het blad van een klimaatapparaat, als eigen laag (Apparaten). */
  async function openen(id) {
    if (!data) await laad();
    if (!data) return;
    open = begin(id);
    fout = '';
    teken();
  }

  /** Het blad van een klimaatapparaat in een plek op de pagina (het blad van een kamer); een tweede keer blijft de keuze staan. */
  function inPlek(el, id) {
    if (!data || !vind(id)) return false;
    if (!(open?.plek && open.id === id)) {
      open = begin(id, el);
      fout = '';
    } else open.plek = el;
    teken();
    return true;
  }

  /** Opent het blad van witgoed dat op zon wacht (besluit 238), met de stand van Resident. */
  async function openWitgoed(d) {
    try {
      witgoed = await haal('api/witgoed');
    } catch {
      witgoed = null;
    }
    const stappen = d.stappen ?? [];
    const i = stappen.findIndex((s) => s.waarde === d.klaarVoor);
    open = { wg: d, stap: i < 0 ? 0 : i + 1 };
    fout = '';
    teken();
  }

  async function stuur(pad, body) {
    const res = await deur(pad, body);
    if (!res) return false;
    if (!res.ok) {
      fout = (await res.json().catch(() => null))?.fout ?? t('hand.lukteNiet');
      teken();
      return false;
    }
    fout = '';
    await (pad === 'api/stekker' ? laadStekkers() : laad());
    global.dispatchEvent(new CustomEvent('handveranderd'));
    return true;
  }

  document.addEventListener('click', async (e) => {
    if (!open) return;
    const el = (s) => e.target.closest(s);
    // In een kamer: alleen klikken in het eigen blad.
    if (open.plek && !open.plek.contains(e.target)) return;
    let x;
    if (el('[data-hand-sluit]')) open = null;
    else if ((x = el('[data-hand-tot]'))) open.tot = x.dataset.handTot;
    else if ((x = el('[data-hand-modus]'))) {
      const m = vind(open.id)?.modi.find((y) => y.modus === x.dataset.handModus);
      if (m) Object.assign(open, { modus: m.modus, doel: m.doelC ?? open.doel });
    } else if ((x = el('[data-hand-doel]'))) {
      const m = vind(open.id)?.modi.find((y) => y.modus === open.modus);
      if (m) open.doel = Math.max(m.min, Math.min(m.max, Math.round((open.doel + Number(x.dataset.handDoel) * m.stap) * 10) / 10));
    } else if (el('[data-hand-terug]')) {
      if (await stuur('api/hand', { id: open.id, terug: true })) open = open.plek ? begin(open.id, open.plek) : null;
    } else if (el('[data-hand-zet]')) {
      const ok = await stuur('api/hand', { id: open.id, modus: open.modus, doelC: open.doel, totMs: totVan(open.tot), ...(open.tot === 'doel' ? { totDoel: true } : {}) });
      if (ok && !open.plek) open = null;
    } else if ((x = el('[data-wg-stap]'))) {
      const n = (open.wg.stappen ?? []).length;
      open.stap = Math.max(0, Math.min(n, open.stap + Number(x.dataset.wgStap)));
    } else if (el('[data-wg-bewaar]')) {
      const s = [null, ...(open.wg.stappen ?? [])][open.stap];
      if (await stuur('api/uitstel', { id: open.wg.id, klaarVoor: s?.waarde ?? null })) open = null;
    } else if (el('[data-wg-start]')) {
      if (await stuur('api/witgoed', { id: open.wg.id, start: true })) open = null;
    } else if ((x = el('[data-st-aan]'))) open.aan = x.dataset.stAan === 'aan';
    else if ((x = el('[data-st-tot]'))) open.tot = x.dataset.stTot;
    else if (el('[data-st-terug]')) {
      if (await stuur('api/stekker', { id: open.st, terug: true })) open = null;
    } else if (el('[data-st-zet]')) {
      // De keuze, niet het tijdstip: de dienst rekent het eind zelf uit, ook als de klok van de telefoon afwijkt.
      const wanneer = open.tot === 'tijd' ? { klok: open.tijd } : { duurMin: { m30: 30, u1: 60, u2: 120 }[open.tot] ?? 60 };
      if (await stuur('api/stekker', { id: open.st, aan: open.aan, ...wanneer })) open = null;
    } else return;
    teken();
  });
  /*
   * Wat nu met de hand of op zon loopt, voor Te doen en Vast en gepland (besluit
   * 238): een klimaatapparaat met de hand, met Terug; witgoed dat op zon wacht,
   * met Aanpassen (naar het blad bij Apparaten).
   */
  let uitstelbaar = [];
  async function laadNu() {
    const [h, s] = await Promise.allSettled([laad(), haal('api/state'), laadStekkers()]);
    if (s.status === 'fulfilled') uitstelbaar = s.value?.bewoner?.uitstelbaar ?? [];
    return h.status === 'fulfilled';
  }
  const IK = {
    klimaat: iconen.svg('klimaat'),
    witgoed: iconen.svg('witgoed'),
  };
  function nuHtml() {
    const klimaat = (data?.apparaten ?? []).filter((a) => a.actief).map((a) => `<div class="nu-regel"><span class="ik">${IK.klimaat}</span><div><b>${esc(a.naam)}</b><span>${esc(nuZin(a))}</span></div><button type="button" data-nu-terug="${esc(a.id)}">${esc(t('hand.terugKort'))}</button></div>`);
    const wit = uitstelbaar.filter((d) => d.kanKiezen).map((d) => `<a class="nu-regel" href="apparaten.html#wg-${encodeURIComponent(d.id)}"><span class="ik">${IK.witgoed}</span><div><b>${esc(t('witgoed.opZon', { naam: d.naam }))}</b><span>${esc(d.klaarVoor ? t('witgoed.klaarVoorKort', { klok: d.klaarVoor }) : t('witgoed.geenHaastKort'))}</span></div><em>${esc(t('witgoed.aanpassen'))}</em></a>`);
    // Een stekker met de hand (besluit 265), met Terug.
    const stek = (stekkers?.stekkers ?? []).filter((s) => s.actief).map((s) => `<div class="nu-regel"><span class="ik">${iconen.svg('stekker')}</span><div><b>${esc(s.naam)}</b><span>${esc(t(s.actief.aan ? 'hand.stekkerAanTot' : 'hand.stekkerUitTot', { klok: klokVan(s.actief.totMs) }))}</span></div>${stekkers?.aan ? `<button type="button" data-nu-stekker="${esc(s.id)}">${esc(t('hand.terugKort'))}</button>` : ''}</div>`);
    return [...klimaat, ...stek, ...wit].join('');
  }
  document.addEventListener('click', async (e) => {
    const k = e.target.closest('[data-nu-terug]');
    const s = e.target.closest('[data-nu-stekker]');
    if (!k && !s) return;
    (k ?? s).disabled = true;
    if (k) await stuur('api/hand', { id: k.dataset.nuTerug, terug: true });
    else await stuur('api/stekker', { id: s.dataset.nuStekker, terug: true });
  });
  // De tijd van een stekker: bij het verlaten van het veld, zodat typen niet onderbroken wordt.
  document.addEventListener('change', (e) => {
    const v = e.target.closest?.('[data-st-tijd]');
    if (!v || !open?.st) return;
    open.tijd = v.value || open.tijd;
    teken();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open && !open.plek) {
      open = null;
      teken();
    }
  });

  global.hand = { laad, laadNu, nuHtml, openen, inPlek, openWitgoed, openStekker, laadStekkers, stekker: stekkerVan, stekkerZin, bij, data: () => data, nuZin, sluit: () => { open = null; teken(); } };
})(window);
