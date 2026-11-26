/*
 * SunArc: je huis tekenen, de bladen (22 november 2026, opgesplitst uit kit/huistekenen.js).
 *
 * Wat naast en onder de tekening staat: het blad met wat je gekozen hebt (paneel), de etages (stapel), de strook
 * met apparaten zonder kamer (strook) en de uitleg onder de tekening (uitleg). Ze krijgen de tekenaar t mee en
 * lezen en veranderen alleen via die tekenaar; global.htBlad.
 */
(function (global) {
  'use strict';
  const { CEL, FONT, esc, T, nl, meter, ik, DRAAI, eigenNamen, APP_KLEUR, APP_ICOON, OPENING_SOORTEN, BINNEN_SOORTEN, MET_SCHARNIER, openingPlaatje } = global.htVloer;
  /**
   * Eén apparaat, één bolletje (20 november 2026): wat er ook in een apparaat
   * zit, zoals de schijnwerper en de bewegingsmelder van een camera. De naam
   * zonder die van het apparaat zelf; is er niets over, dan wat het doet.
   */
  function bijBlad(a) {
    if (!a.bij?.length) return '';
    const kort = (x) => {
      const n = (x.naam ?? '').trim();
      const rest = n.toLowerCase().startsWith((a.naam ?? '').toLowerCase()) ? n.slice((a.naam ?? '').length).trim() : n;
      return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : null;
    };
    const wat = (x) => T(`ht.bij.${['licht', 'beweging', 'meter', 'camera'].includes(x.soort) ? x.soort : 'anders'}`);
    return `<h4>${esc(T('ht.app.zitErin'))}</h4>${a.bij.map((x) => rij({ ik: APP_ICOON[x.soort] ?? x.soort, kleur: APP_KLEUR[x.soort], titel: kort(x) ?? wat(x), zin: kort(x) ? wat(x) : '', data: 'disabled' })).join('')}`;
  }
  const STRAAT_KANTEN = ['voor', 'links', 'rechts', 'achter'];
  /** Een huisje met de straat aan een kant. */
  const straatPlaatje = (kant, aan) => {
    const band = { voor: '<rect x="2" y="38" width="60" height="7" rx="2"', achter: '<rect x="2" y="3" width="60" height="7" rx="2"', links: '<rect x="2" y="2" width="8" height="44" rx="2"', rechts: '<rect x="54" y="2" width="8" height="44" rx="2"' }[kant];
    return `<svg viewBox="0 0 64 48" width="64" height="48" aria-hidden="true"><rect x="22" y="13" width="20" height="22" rx="2" fill="rgb(111 211 255 / 0.25)" stroke="#6fd3ff" stroke-width="1.8"/>${band} fill="${aan ? 'rgb(110 231 183 / 0.45)' : 'rgb(255 255 255 / 0.2)'}"/></svg>`;
  };
  /** De regel Straat in het blad van Vorm, met de straat aan de voorkant. */
  function straatRij(t) {
    const s = t.huis.straat;
    if (!s?.lijst.length) return '';
    const voor = s.lijst.find((x) => x.kant === 'voor');
    const zin = voor ? T(voor.adres ? 'ht.straat.voorAdres' : 'ht.straat.voor', { maat: voor.afstand }) : T('ht.straat.geenVoor');
    return rij({ ik: 'oprit', titel: T(s.lijst.length > 1 ? 'ht.straat.twee' : 'ht.straat.een'), zin, rechts: T('ht.dakkapel.wijzig'), data: 'data-ht="straat-open"', mist: !s.bevestigd && !voor?.adres });
  }
  /** Het blad Waar is de straat: de straten van de kaart, of zelf een kant. */
  function straatBlad(t) {
    const s = t.huis.straat;
    const st = t.st;
    const kan = (kant) => kant === 'voor' || !s.getekend;
    // De straat aan de voorkant eerst, dan de dichtstbijzijnde.
    const tegels = [...s.lijst]
      .sort((a, b) => Number(b.kant === 'voor') - Number(a.kant === 'voor') || a.afstand - b.afstand)
      .map((x) => `<button type="button" class="kv-straat${x.kant === 'voor' ? ' aan' : ''}" data-ht="straat-kies" data-kant="${x.kant}" aria-pressed="${x.kant === 'voor'}"${kan(x.kant) ? '' : ' disabled'}>${straatPlaatje(x.kant, x.kant === 'voor')}<span><b>${esc(T(x.adres ? 'ht.straat.adres' : 'ht.straat.andere'))}</b><small>${esc(T('ht.straat.waar', { maat: x.afstand, kant: T(`ht.straat.kant.${x.kant}`) }))}</small></span>${x.adres ? `<i>${esc(T('ht.straat.jeAdres'))}</i>` : ''}</button>`)
      .join('');
    const kanten = `<div class="ht-twee kv-vier">${STRAAT_KANTEN.map((k) => `<button type="button" class="ht-klein${k === 'voor' ? ' aan' : ''}" data-ht="straat-kies" data-kant="${k}" aria-pressed="${k === 'voor'}"${kan(k) ? '' : ' disabled'}>${esc(T(`ht.straat.knop.${k}`))}</button>`).join('')}</div>`;
    return `<header><h3>${esc(T('ht.straat.kop'))}</h3><span>${esc(T('ht.straat.gevonden', { n: s.lijst.length }))}</span></header>
      <p class="ht-zin">${esc(T('ht.straat.zin'))}</p>
      ${tegels}
      <h4 class="ht-dakkop">${esc(T('ht.straat.zelf'))}</h4>
      ${kanten}
      ${st.gebouwFout ? `<p class="ht-niet">${esc(st.gebouwFout)}</p>` : ''}
      ${st.gebouwBezig ? `<p class="ht-zin">${esc(T('ht.gebouw.bezig'))}</p>` : ''}
      <p class="ht-voet">${esc(T(s.getekend ? 'ht.straat.getekend' : 'ht.straat.voet'))}</p>
      <div class="ht-onder">${rij({ ik: 'terug', titel: T('ht.vorm.woningKlaar'), zin: '', data: 'data-ht="straat-dicht"' })}</div>`;
  }
  /** Wat de plattegrond weet van een huis zonder 3D-kaart: elk getal van de kaart of geschat. */
  function weetDeel(t, nu) {
    const w = nu.kaartWeet;
    const lagen = t.huis.etages.filter((e) => !e.buiten && e.id !== 'kelder').length;
    const r = (titel, waarde, vanKaart) => `<div class="kv-weet${vanKaart ? '' : ' mist'}"><span>${esc(titel)}</span><b>${esc(waarde)}</b><i>${esc(T(vanKaart ? 'ht.weet.kaart' : 'ht.geschat'))}</i></div>`;
    return `<h4 class="ht-dakkop">${esc(T('ht.weet.kop'))}</h4><div class="kv-weten">
      ${r(T('ht.weet.lagen'), String(w.lagen ?? lagen), w.lagen != null)}
      ${r(T('ht.weet.goot'), `${nl(w.goot ?? nu.goot)} m`, w.goot != null)}
      ${r(T('ht.weet.nok'), `${nl(w.nok ?? nu.nok)} m`, w.nok != null)}
      ${r(T('jehuis.dak'), T(`daken.dakvorm.${w.dak ?? nu.dakvorm ?? 'zadel'}`), w.dak != null)}</div>`;
  }
  const rij = (o) => `<button type="button" class="ht-rij${o.mist ? ' mist' : ''}${o.aan ? ' aan' : ''}" ${o.data}>${o.ik ? `<span class="ik"${o.kleur ? ` style="color: ${o.kleur}"` : ''}>${ik(o.ik)}</span>` : ''}<span class="t"><b>${esc(o.titel)}</b>${o.zin ? `<small>${esc(o.zin)}</small>` : ''}</span>${o.rechts ? `<em>${esc(o.rechts)}</em>` : ''}</button>`;
  /*
   * Het dak van een gebouw (stap 4, keuze Ricardo 19 november 2026): het dak
   * teken je in Je huis, Zonnepanelen legt de panelen erop. De vier vormen en de
   * nok een kwart draaien; alleen in de app (`t.gebouw`), niet in een schets.
   */
  /** De naamsvermelding van de kaarten bij Vorm (stap 4: de kaart staat alleen hier): 3D BAG met "vorm aangepast", OpenStreetMap voor de plattegrond en de gebouwen eromheen. */
  const vermelding = (bron, omgeving) => {
    const links = [
      ...(bron === 'bag3d' ? [`<a href="https://docs.3dbag.nl/en/copyright" target="_blank" rel="noopener">${esc(T('daken.kk.bag'))}</a>`] : []),
      ...(bron === 'osm' || ((bron === 'bag3d' || bron === 'osm') && omgeving) ? [`<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">${esc(T('daken.kk.osm'))}</a>`] : []),
    ].join(' · ');
    return links ? `<p class="ht-voet ht-vermelding">${links}</p>` : '';
  };
  const dakDeel = (t, b) => {
    if (!b || !t.gebouw) return '';
    const vormen = ['zadel', 'schild', 'lessenaar', 'plat'];
    const nok = b.dak === 'plat' ? '' : `<button type="button" class="ht-dakknop" data-ht="gebouw-nok" data-id="${esc(b.id)}" title="${esc(T('ht.dak.nokZin'))}">${esc(T(b.dak === 'lessenaar' ? 'daken.andereKant' : 'daken.nokDraaien'))}</button>`;
    return `<h4 class="ht-dakkop">${esc(T('ht.dak.kop'))}${nok}</h4><div class="ht-twee vier">${vormen.map((v) => `<button type="button" class="ht-klein${b.dak === v ? ' aan' : ''}" data-ht="gebouw-dak" data-id="${esc(b.id)}" data-dakvorm="${v}" aria-pressed="${b.dak === v}">${esc(T(`daken.dakvorm.${v}`))}</button>`).join('')}</div>`;
  };

  /** Een doorsnede van het huis (de straat of links aan het begin): de etages, het dak, en de dakkapel op zijn kant en etage. */
  function doorsnede(t, kant, etage, [w, h]) {
    const m = t.dakMaat();
    if (!m) return '';
    const pad = 7;
    const hoog = Math.max(m.nok, ...m.goot) + 0.3;
    const sx = (w - 2 * pad) / m.lc;
    const sy = (h - 2 * pad - 10) / hoog;
    const P = (pp) => pp.map(([c, z]) => `${(pad + c * sx).toFixed(1)},${(h - pad - 10 - z * sy).toFixed(1)}`).join(' ');
    const dakOp = (c) => (c <= m.naar[0] ? m.goot[0] + ((m.nok - m.goot[0]) * c) / Math.max(0.1, m.naar[0]) : m.goot[1] + ((m.nok - m.goot[1]) * (m.lc - c)) / Math.max(0.1, m.naar[1]));
    let s = `<polygon points="${P([[0, 0], [0, m.goot[0]], [m.naar[0], m.nok], [m.lc, m.goot[1]], [m.lc, 0]])}" fill="rgb(255 255 255 / 0.07)" stroke="rgb(255 255 255 / 0.55)" stroke-width="1.5" stroke-linejoin="round"/>`;
    for (const e of t.huis.etages.filter((x) => !x.buiten)) {
      const z = t.vloerHoogte(e.id);
      if (z <= 0) continue;
      const tot = (c) => dakOp(c) > z;
      let c0 = 0;
      while (c0 < m.lc && !tot(c0)) c0 += 0.05;
      let c1 = m.lc;
      while (c1 > 0 && !tot(c1)) c1 -= 0.05;
      s += `<polyline points="${P([[c0, z], [c1, z]])}" fill="none" stroke="${kant != null && e.id === etage ? 'rgb(111 211 255 / 0.75)' : 'rgb(255 255 255 / 0.3)'}" stroke-width="${kant != null && e.id === etage ? 2 : 1}"/>`;
    }
    if (kant != null) {
      const z = t.vloerHoogte(etage) + 2.4;
      const gevel = kant === 0 ? 0.3 : m.lc - 0.3;
      const tot = kant === 0 ? ((z - m.goot[0]) * m.naar[0]) / Math.max(0.1, m.nok - m.goot[0]) : m.lc - ((z - m.goot[1]) * m.naar[1]) / Math.max(0.1, m.nok - m.goot[1]);
      if (Math.abs(tot - gevel) > 0.2) {
        s += `<polygon points="${P([[gevel, dakOp(gevel)], [gevel, z], [tot, z]])}" fill="rgb(111 211 255 / 0.32)" stroke="#6fd3ff" stroke-width="2" stroke-linejoin="round"/>`;
        s += `<polyline points="${P([[gevel, dakOp(gevel) + 0.3], [gevel, z - 0.4]])}" fill="none" stroke="#a9e6ff" stroke-width="3" stroke-linecap="round"/>`;
      }
    }
    const [l, r] = m.langs ? [T('ht.dakkapel.links'), T('ht.dakkapel.rechts')] : [T('ht.straat.een'), T('ht.dakkapel.tuin')];
    s += `<text x="${pad}" y="${h - 2}" ${FONT} font-size="9.5" font-weight="700" fill="rgb(255 255 255 / 0.4)">${esc(l.toUpperCase())}</text><text x="${w - pad}" y="${h - 2}" text-anchor="end" ${FONT} font-size="9.5" font-weight="700" fill="rgb(255 255 255 / 0.4)">${esc(r.toUpperCase())}</text>`;
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${s}</svg>`;
  }
  /** De naam van een kant: voor en achter als de nok langs de straat loopt, anders links en rechts. */
  const kantNaam = (t, kant) => {
    const m = t.dakMaat();
    return m?.langs ? [T(kant === 0 ? 'ht.dakkapel.links' : 'ht.dakkapel.rechts'), T('ht.dakkapel.zijZin')] : [T(kant === 0 ? 'ht.dakkapel.voor' : 'ht.dakkapel.achter'), T(kant === 0 ? 'ht.dakkapel.voorZin' : 'ht.dakkapel.achterZin')];
  };
  const etageNaam = (t, id) => {
    const e = t.huis.etages.find((x) => x.id === id);
    return e?.kort ?? e?.naam ?? id;
  };
  /*
   * Je huis › Dak (stap 4 punt 3, schets Wand-Huis-Dakkapel): het dak (de vorm
   * en de nok, eerst bij Vorm), een dakkapel erbij met de kant en de etage, of
   * een gekozen dakkapel met zijn maten.
   */
  function dakBlad(t) {
    const st = t.st;
    const m = t.dakMaat();
    const b = t.hoofdBlok();
    const stap = (wat, titel, waarde, i) => `<div class="ht-stapper"><span>${esc(titel)}</span><button type="button" data-ht="kapel-anders" data-i="${i}" data-wat="${wat}" data-d="-0.1" aria-label="${esc(T('ht.gebouw.kleiner'))}">−</button><b>${esc(waarde)}</b><button type="button" data-ht="kapel-anders" data-i="${i}" data-wat="${wat}" data-d="0.1" aria-label="${esc(T('ht.gebouw.groter'))}">+</button></div>`;
    if (st.kapelErbij && m) {
      const keus = st.kapelErbij;
      const kantKnop = (kant) => {
        const [naam, zin] = kantNaam(t, kant);
        return `<button type="button" class="ht-kant${keus.kant === kant ? ' aan' : ''}" data-ht="kapel-keus" data-wat="kant" data-waarde="${kant}" aria-pressed="${keus.kant === kant}">${doorsnede(t, kant, keus.etage, [118, 64])}<b>${esc(naam)}</b><small>${esc(zin)}</small></button>`;
      };
      const etages = t.kapelEtages();
      return `<header><h3>${esc(T('ht.dakkapel.erbij'))}</h3><span>${esc(etageNaam(t, keus.etage))}</span></header>
        <p class="ht-zin">${esc(T('ht.dakkapel.erbijUitleg'))}</p>
        <h4>${esc(T('ht.dakkapel.welkeKant'))}</h4>
        <div class="ht-kanten">${kantKnop(0)}${kantKnop(1)}</div>
        ${etages.length > 1 ? `<h4>${esc(T('ht.dakkapel.welkeEtage'))}</h4><div class="ht-twee twee">${etages.map((id) => `<button type="button" class="ht-klein${keus.etage === id ? ' aan' : ''}" data-ht="kapel-keus" data-wat="etage" data-waarde="${esc(id)}" aria-pressed="${keus.etage === id}">${esc(etageNaam(t, id))}</button>`).join('')}</div><p class="ht-zin">${esc(T('ht.dakkapel.etageUitleg'))}</p>` : ''}
        <div class="ht-knoppen"><button type="button" class="knop" data-ht="kapel-niet">${esc(T('indeling.annuleren'))}</button><button type="button" class="knop knop-licht" data-ht="kapel-zet">${esc(T('ht.dakkapel.zet'))}</button></div>`;
    }
    const kk = st.kies?.soort === 'kapel' ? st.kapellen[st.kies.i] : null;
    if (kk && m) {
      const i = st.kies.i;
      const uitKaart = b?.kapelBron === 'kaart';
      const [kant, kantZin] = kantNaam(t, kk.kant);
      const etage = kk.etage ?? t.dakEtage();
      return `<header><h3>${esc(T('ht.dakkapel.naam'))}</h3><span>${nl(kk.tot - kk.van)} × ${nl(kk.diep)} m</span></header>
        <div class="ht-door">${doorsnede(t, kk.kant, etage, [268, 118])}</div>
        <p class="ht-zin">${esc(T(uitKaart ? 'ht.dakkapel.kaartZin' : 'ht.dakkapel.eigenZin'))}</p>
        ${rij({ ik: 'dak', titel: kant, zin: kantZin, rechts: T('ht.dakkapel.andere'), data: `data-ht="kapel-anders" data-i="${i}" data-wat="kant"` })}
        ${t.kapelEtages().length > 1 ? rij({ ik: 'etages', titel: etageNaam(t, etage), zin: T('ht.dakkapel.etageZin'), rechts: T('ht.dakkapel.wijzig'), data: `data-ht="kapel-anders" data-i="${i}" data-wat="etage"` }) : ''}
        ${stap('breed', T('ht.gebouw.breed'), `${nl(kk.tot - kk.van)} m`, i)}
        ${stap('diep', T('ht.gebouw.diep'), `${nl(kk.diep)} m`, i)}
        ${rij({ ik: 'kruis', titel: T('w.weghalen'), zin: uitKaart ? T('ht.dakkapel.wegKaart') : '', data: `data-ht="kapel-weg" data-i="${i}"` })}`;
    }
    const naam = b ? T(`daken.dakvorm.${b.dak ?? 'zadel'}`) : '';
    const etage = t.huis.etages.find((e) => e.id === st.etage);
    const onder = t.kapelEtages().includes(st.etage);
    return `<header><h3>${esc(T('ht.dak.kop'))}</h3><span>${esc(b?.nok ? `${naam.toLowerCase()} · ${T('ht.dakkapel.nok')} ${nl(b.nok)} m` : naam)}</span></header>
      <p class="ht-zin">${esc(!m ? T('ht.dakkapel.plat') : onder ? T('ht.dakkapel.zin', { etage: (etage?.kort ?? etage?.naam ?? '').toLowerCase() }) : T('ht.dakkapel.geenEtage'))}</p>
      ${st.gebouwBezig ? `<p class="ht-zin">${esc(T('ht.gebouw.bezig'))}</p>` : dakDeel(t, b)}
      ${m ? rij({ ik: 'dak', titel: T('ht.dakkapel.erbij'), zin: T('ht.dakkapel.erbijZin'), rechts: '+', data: 'data-ht="kapel-erbij"' }) : ''}`;
  }

  /** Het blad rechts (wand) of onder (telefoon): wat je hier kunt, in regels. */
  const metOpeningenVan = (t) => !!t.metOpeningen;
  /*
   * De bladen van de indeling (stap 3, 17 november 2026, schets Wand-Huis-Aanvulling): wat eerst alleen
   * bij Kamers en indeling kon. De pagina geeft de gegevens en bewaart; hier alleen hoe het eruitziet.
   */
  function indelingBlad(t, blad, ix, etage, hier) {
    const knop = (actie, waarde, tekst, aan, uit) => `<button type="button" class="ht-klein${aan ? ' aan' : ''}" data-ht="ix" data-actie="${actie}" data-waarde="${esc(waarde)}"${uit ? ' disabled' : ''}>${esc(tekst)}</button>`;
    if (blad === 'etage') {
      const e = ix.etage;
      let s = `<header><h3>${esc(etage.naam)}</h3><span>${esc(T('ht.kamers', { n: hier.length }))}</span></header>
        <h4>${esc(T('w.naam'))}</h4><input class="ht-naam" data-ht-ix="etage-naam" value="${esc(etage.naam)}" maxlength="40" aria-label="${esc(T('w.naam'))}">
        <h4>${esc(T('ht.etage.dak'))}</h4><div class="ht-twee twee">${knop('dak', '1', T('w.ja'), !!etage.dak)}${knop('dak', '0', T('ht.nee'), !etage.dak)}</div>
        <h4>${esc(T('ht.etage.volgorde'))}</h4><div class="ht-twee twee">${knop('schuif', '-1', T('hand.hoger'), false, !e.kanHoger)}${knop('schuif', '1', T('hand.lager'), false, !e.kanLager)}</div>`;
      if (ix.nieuweEtages.length) s += `<h4>${esc(T('ht.etage.erbij'))}</h4>${ix.nieuweEtages.map(([id, naam]) => rij({ ik: id === 'kelder' ? 'kelder' : 'etages', titel: naam, rechts: '+', data: `data-ht="ix" data-actie="etage-erbij" data-waarde="${esc(id)}"` })).join('')}`;
      s += `<div class="ht-onder">${e.kanWeg ? rij({ ik: 'kruis', kleur: 'var(--gloed)', titel: T('ht.etage.weg'), zin: T('ht.etage.wegZin'), data: 'data-ht="ix" data-actie="etage-weg" data-waarde=""' }) : ''}${rij({ ik: 'terug', titel: T('algemeen.klaar'), zin: '', data: 'data-ht="blad" data-blad=""' })}</div>`;
      return s;
    }
    if (blad === 'buiten') {
      let s = `<header><h3>${esc(T('ht.buiten.kop'))}</h3><span>${esc(T('ht.buiten.span'))}</span></header><p class="ht-zin">${esc(T('ht.buiten.zin'))}</p><h4>${esc(T('ht.buiten.rond'))}</h4>`;
      // Knoppen in twee kolommen, aan of uit: als regels liep het blad op de wand onder de rand (de wand schuift nooit).
      s += `<div class="ht-twee twee">${ix.rond.map((r) => `<button type="button" class="ht-klein${r.aan ? ' aan' : ''}" data-ht="ix" data-actie="rond" data-waarde="${esc(r.w)}" aria-pressed="${r.aan}">${esc(r.naam)}</button>`).join('')}</div>`;
      if (ix.huisje) s += `<h4>${esc(T('ht.buiten.tuin'))}</h4><div class="ht-twee">${ix.huisje.opties.map(([w, naam]) => knop('huisje', w, naam, ix.huisje.nu === w)).join('')}</div>`;
      if (ix.accu) s += `<h4>${esc(T('ht.buiten.accu', { naam: ix.accu.naam }))}</h4><select class="ht-naam" data-ht-ix="accu" aria-label="${esc(T('ht.buiten.accu', { naam: ix.accu.naam }))}">${ix.accu.opties.map(([w, naam]) => `<option value="${esc(w)}"${ix.accu.nu === w ? ' selected' : ''}>${esc(naam)}</option>`).join('')}</select>`;
      return s;
    }
    // Verborgen: om terug te halen.
    const lijst = t.huis.verborgenLijst ?? [];
    return `<header><h3>${esc(T('toev.verborgen'))}${window.hulp?.vraag('verbergen') ?? ''}</h3><span>${esc(T('ht.apparaten', { n: lijst.length }))}</span></header>
      <p class="ht-zin">${esc(T(lijst.length ? 'ht.verborgen.zin' : 'ht.verborgen.leeg'))}</p>
      ${lijst.map((a) => rij({ ik: APP_ICOON[a.soort] ?? a.soort ?? 'apparaat', titel: a.naam, rechts: T('toev.terughalen'), data: `data-ht="ix" data-actie="terug" data-waarde="${esc(a.id)}"` })).join('')}
      <div class="ht-onder">${rij({ ik: 'terug', titel: T('ht.verborgen.naarApparaten'), zin: '', data: 'data-ht="blad" data-blad=""' })}</div>`;
  }
  /** Bij een kamer die in Home Assistant bestaat: de soort, de naam in de app, en de weg naar Verwarmen en koelen. */
  function kamerIndeling(t, kamer, ix) {
    const k = t.kamers[kamer];
    return `<h4>${esc(T('ht.kamer.soort'))}</h4><select class="ht-naam" data-ht-ix="kamer-soort" data-kamer="${esc(kamer)}" aria-label="${esc(T('ht.kamer.soort'))}"><option value="">${esc(T('inr.uitNaam'))}</option>${ix.soorten.map(([w, naam]) => `<option value="${esc(w)}"${k.soort === w ? ' selected' : ''}>${esc(naam)}</option>`).join('')}</select>
      <h4>${esc(T('ht.kamer.naam'))}</h4><input class="ht-naam" data-ht-ix="kamer-naam" data-kamer="${esc(kamer)}" value="${esc(k.naam)}" maxlength="40" aria-label="${esc(T('ht.kamer.naam'))}">
      <p class="ht-voet">${esc(T('ht.kamer.naamZin'))}</p>
      <h4>${esc(T('ht.kamer.klimaat'))}</h4>${rij({ ik: 'klimaat', kleur: 'var(--gloed)', titel: T('ht.kamer.klimaatRij'), zin: T('ht.kamer.klimaatZin'), rechts: '›', data: `data-ht="ix" data-actie="klimaat" data-waarde="${esc(kamer)}"` })}`;
  }

  function paneel(el, t) {
    const teken = () => {
      // Wie een maat aan het typen is, houdt zijn veld.
      if (document.activeElement?.matches?.('[data-ht-maat], [data-ht-naam], [data-ht-ix]') && el.contains(document.activeElement)) return;
      const st = t.st;
      const v = t.vloer();
      const m = t.maten();
      const etage = t.huis.etages.find((e) => e.id === st.etage);
      const hier = t.huis.kamers.filter((k) => k.etage === st.etage && !t.vast?.includes(k.id));
      const waar = t.kamerPlek();
      let s;
      const ix = t.indeling?.gegevens?.() ?? null;
      const blad = ix && st.blad && !st.kies && st.blad.etage === st.etage && st.blad.stand === st.stand ? st.blad.naam : null;
      if (blad) s = indelingBlad(t, blad, ix, etage, hier);
      else if (st.stand === 'dak') s = dakBlad(t);
      else if (st.kies?.soort === 'erfhuis') {
        // Het huis op het erf (20 november 2026): het volgt de vorm van je huis; die pas je aan bij Vorm.
        const opp = m[st.kies.id] ? Math.round(m[st.kies.id].n * CEL * CEL) : null;
        s = `<header><h3>${esc(T('thuis.hetHuis'))}</h3>${opp ? `<span>${opp} m²</span>` : ''}</header>
          <p class="ht-zin">${esc(T('ht.erfhuis.zin'))}</p>
          ${rij({ ik: 'etages', titel: T('ht.erfhuis.binnen'), zin: T('ht.erfhuis.binnenZin'), rechts: '›', data: 'data-ht="naar-binnen"' })}
          ${rij({ ik: 'thuis', titel: T('ht.erfhuis.vorm'), zin: T('ht.erfhuis.vormZin'), rechts: '›', data: 'data-ht="naar-vorm"' })}`;
      } else if (st.stand === 'vorm' && st.kies?.soort === 'omgeving') {
        // Een grijs gebouw van de kaart aangetikt: wat is het? Zoals bij Daken en panelen, en het geldt op allebei.
        s = `<header><h3>${esc(T('ht.gebouw.kop'))}</h3></header>
          <p class="ht-zin">${esc(T('ht.gebouw.zin'))}</p>
          ${st.gebouwFout ? `<p class="ht-niet">${esc(st.gebouwFout)}</p>` : ''}
          ${st.gebouwBezig ? `<p class="ht-zin">${esc(T('ht.gebouw.bezig'))}</p>` : ['uitbouw', 'garage', 'carport', 'tuinhuis', 'anders'].map((soort) => rij({ ik: 'thuis', titel: T(`daken.gebouw.${soort}`), zin: T(`ht.gebouw.zin.${soort}`), rechts: '+', data: `data-ht="gebouw-erbij" data-soort="${soort}"` })).join('')}
          ${st.gebouwBezig ? '' : rij({ ik: 'weg', titel: T('ht.gebouw.bestaatNiet'), zin: T('ht.gebouw.bestaatNietZin'), data: 'data-ht="bestaat-niet"' })}
          ${rij({ ik: 'kruis', titel: T('ht.gebouw.niet'), zin: T('ht.gebouw.nietZin'), data: 'data-ht="gebouw-terug"' })}`;
      } else if (st.stand === 'vorm' && st.kies?.soort === 'afdak' && t.afdakVak()) {
        // Het afdak (ronde 2): uit de dakdelen van de 3D-kaart, een eigen stuk met een eigen dak.
        const a = t.afdakVak().a;
        s = `<header><h3>${esc(T(`ht.afdak.kop.${a.kant}`))}</h3><span>${esc(T('ht.afdak.diep', { maat: nl(a.diep) }))}</span></header>
          ${rij({ ik: 'dak', titel: T(a.plat ? 'ht.afdak.plat' : 'ht.afdak.schuin', { laag: nl(a.laag), hoog: nl(a.hoog) }), zin: T('ht.afdak.vanKaart'), data: 'disabled' })}
          <p class="ht-zin">${esc(T('ht.afdak.zin'))}</p>
          ${st.gebouwFout ? `<p class="ht-niet">${esc(st.gebouwFout)}</p>` : ''}
          ${st.gebouwBezig ? `<p class="ht-zin">${esc(T('ht.gebouw.bezig'))}</p>` : `${rij({ ik: 'vink', titel: T('inr.dak.klopt'), zin: '', data: 'data-ht="afdak-klopt"' })}${rij({ ik: 'kruis', titel: T('ht.afdak.nee'), zin: T('ht.afdak.neeZin'), data: 'data-ht="afdak-nee"' })}`}
          ${rij({ ik: 'thuis', titel: T('ht.gebouw.terug'), zin: '', data: 'data-ht="gebouw-terug"' })}`;
      } else if (st.stand === 'vorm' && st.kies?.soort === 'blok') {
        const b = (t.huis.bronnen?.[st.bron]?.blokken ?? []).find((q) => q.id === st.kies.id);
        const naam = b ? T(`ht.bron.blok.${b.soort}`) : '';
        // Op maat (ronde 2): min en plus naast de stippen in de tekening, met de maat van de kaart erbij.
        const bm = b ? t.maatVan(b) : null;
        const stapper = (wat) => `<div class="kv-stap"><span>${esc(T(wat === 'b' ? 'ht.gebouw.breed' : 'ht.gebouw.diep'))}${b.kaartMaat ? `<i>${esc(T('ht.gebouw.kaartMaat', { maat: nl(b.kaartMaat[wat]) }))}</i>` : ''}</span><button type="button" data-ht="blok-stap" data-wat="${wat}" data-d="-0.5" aria-label="${esc(T('ht.gebouw.kleiner'))}"${bm[wat] <= 1 ? ' disabled' : ''}>−</button><b>${nl(bm[wat])} m</b><button type="button" data-ht="blok-stap" data-wat="${wat}" data-d="0.5" aria-label="${esc(T('ht.gebouw.groter'))}">+</button></div>`;
        s = `<header><h3>${esc(naam.charAt(0).toUpperCase() + naam.slice(1))}</h3>${bm ? `<span>${nl(bm.b)} × ${nl(bm.d)} m</span>` : ''}</header>
          ${b && t.opErf(b.id) && t.erfEtage() ? rij({ ik: 'tuin', titel: T('ht.gebouw.naarBuiten'), zin: T('ht.gebouw.naarBuitenZin'), rechts: '›', data: 'data-ht="naar-buiten"' }) : `<p class="ht-zin">${esc(T('ht.gebouw.blokZin'))}</p>`}
          ${st.gebouwFout ? `<p class="ht-niet">${esc(st.gebouwFout)}</p>` : ''}
          ${st.gebouwBezig ? `<p class="ht-zin">${esc(T('ht.gebouw.bezig'))}</p>` : `${b && t.gebouw ? `${stapper('b')}${stapper('d')}<p class="ht-zin">${esc(T('ht.gebouw.opMaatZin'))}</p>` : ''}${b?.kaartMaat ? rij({ ik: 'terug', titel: T('ht.gebouw.kaartTerug'), zin: `${nl(b.kaartMaat.b)} × ${nl(b.kaartMaat.d)} m`, data: 'data-ht="blok-kaart"' }) : ''}${dakDeel(t, b)}${rij({ ik: 'weg', titel: T('ht.gebouw.bestaatNiet'), zin: T('ht.gebouw.bestaatNietZin'), data: 'data-ht="bestaat-niet"' })}${rij({ ik: 'kruis', titel: T('w.weghalen'), zin: T('ht.gebouw.wegZin'), data: 'data-ht="gebouw-weg"' })}`}
          ${rij({ ik: 'thuis', titel: T('ht.gebouw.terug'), zin: '', data: 'data-ht="gebouw-terug"' })}`;
      } else if (st.stand === 'vorm' && st.straatOpen && t.huis.straat) {
        s = straatBlad(t);
      } else if (st.stand === 'vorm' && st.wnOpen && t.huis.woning && global.woningDeel) {
        // Wat voor huis (20 november 2026): de vijf soorten en de muren tegen de buren.
        s = `<header><h3>${esc(T('ht.vorm.woning'))}</h3><span>${esc(T(`wn.soort.${t.huis.woning.soort}`).toLowerCase())}</span></header>
          <div class="wn-breed wn-twee">${global.woningDeel.html({ ...t.huis.woning, ht: true })}</div>
          <div class="ht-onder">${rij({ ik: 'terug', titel: T('ht.vorm.woningKlaar'), zin: '', data: 'data-ht="wn-dicht"' })}</div>`;
      } else if (st.stand === 'vorm') {
        // Vorm is ook de plek waar je ziet wat elke bron van je huis vindt, en waar je kiest.
        const o = t.omtrek();
        const nu = t.huis.bronnen?.[st.bron];
        // Ronde 2: tijdens het zoeken de keuzes grijs, met een draaiend icoon en een vinkje per kaart.
        const zoekt = !!(t.kijk && t.huis.kijk?.bezig);
        const wacht = (x) => (zoekt ? `<div class="kv-wacht" aria-hidden="true">${x}</div>` : x);
        const zoekBlok = () => `<div class="kv-zoek" role="status"><div class="kv-zoekkop">${DRAAI}<span><b>${esc(T('ht.vorm.kijkt'))}</b><small>${esc(T('ht.zoek.zin'))}</small></span></div><ol class="kv-stappen">${(t.huis.kijk.stappen ?? []).map((x) => `<li class="kv-${x.stand}"><span class="kv-st">${x.stand === 'klaar' ? ik('vink') : x.stand === 'bezig' ? DRAAI : ''}</span><span><b>${esc(x.naam)}</b><small>${esc(x.zin)}</small></span></li>`).join('')}</ol></div>`;
        // Wat de bewoner weghaalde omdat het er niet meer staat, met Terug.
        const Groot = (x) => x.charAt(0).toUpperCase() + x.slice(1);
        const weg = [
          ...(nu?.weg ?? []).map((w) => rij({ ik: ['tuinhuis', 'garage', 'carport'].includes(w.soort) ? w.soort : 'schuur', titel: w.soort ? Groot(T(`ht.bron.blok.${w.soort}`)) : T('ht.gebouw.gebouw'), zin: T('ht.gebouw.wegMaat', { maat: `${nl(w.b)} × ${nl(w.d)} m` }), rechts: T('ht.gebouw.terugKnop'), data: `data-ht="weg-terug" data-n="${w.n}"` })),
          ...(nu?.afdakWeg ? [rij({ ik: 'dak', titel: T(`ht.afdak.kop.${nu.afdakWeg.kant}`), zin: T('ht.afdak.wegZin'), rechts: T('ht.gebouw.terugKnop'), data: 'data-ht="afdak-terug"' })] : []),
        ];
        s = `<header><h3>${esc(T('ht.vorm.kop'))}</h3><span>${nl((o.x1 - o.x0) * CEL)} × ${nl((o.y1 - o.y0) * CEL)} m</span></header>
          ${zoekt ? '<div class="kv-wacht" aria-hidden="true">' : ''}${t.huis.woning && global.woningDeel ? rij({ ik: 'thuis', titel: T(`wn.soort.${t.huis.woning.soort}`), zin: t.huis.woning.soort === 'vrijstaand' ? T('wn.zin.vrijstaand') : (t.huis.woning.soort === 'appartement' ? `${global.woningDeel.vloer(global.woningDeel.flatVan(t.huis.woning).verdieping, true)} · ` : '') + T('ht.vorm.woningTegen', { kanten: (t.huis.woning.buren ?? []).map((k) => T(`wn.kantKlein.${k}`)).join(', ') || '—' }), rechts: T('ht.dakkapel.wijzig'), data: 'data-ht="wn-open"' }) : ''}
          ${straatRij(t)}
          <p class="ht-zin">${esc(T('ht.vorm.zin'))}</p>
          ${Object.entries(t.huis.bronnen ?? {})
            .map(([id, b]) => `<button type="button" class="ht-bron${st.bron === id ? ' aan' : ''}" data-ht="bron" data-bron="${esc(id)}" aria-pressed="${st.bron === id}"><span class="pl">${t.bronPlaatje(id, 92, 70)}</span><span class="t"><b>${esc(b.naam)}</b><small>${esc(b.vond)}</small><small>${esc(b.weet)}</small><em>${esc(st.bron === id ? T('ht.vorm.inGebruik') : T('ht.vorm.gebruik'))}</em></span></button>`)
            .join('')}
          ${(t.huis.nietGevonden ?? []).map((x) => `<p class="ht-niet"><b>${esc(x.naam)}</b> ${esc(x.zin)}</p>`).join('')}${zoekt ? '</div>' : ''}
          ${nu?.kaartWeet ? wacht(weetDeel(t, nu)) : ''}
          ${zoekt ? zoekBlok() : t.kijk && t.huis.kijk ? rij({ ik: 'dak', titel: T('ht.vorm.kijk'), zin: t.huis.kijk.fout ?? T('ht.vorm.kijkZin'), rechts: '›', data: 'data-ht="kijk"' }) : ''}
          ${nu?.kaartWeet ? '' : wacht(rij({ ik: 'etages', titel: T('ht.hoogte'), zin: nu?.hoogte ?? '', rechts: nu?.gemeten ? T('ht.gemeten') : T('ht.geschat'), data: 'disabled' }))}
          ${weg.length ? wacht(`<h4 class="ht-dakkop">${esc(T('ht.gebouw.weggehaald'))}</h4>${weg.join('')}`) : ''}
          ${st.gebouwFout ? `<p class="ht-niet">${esc(st.gebouwFout)}</p>` : ''}
          ${st.gebouwBezig ? `<p class="ht-zin">${esc(T('ht.gebouw.bezig'))}</p>` : ''}
          <p class="ht-voet">${esc(T(t.kijk ? 'ht.vorm.voet' : 'ht.vorm.voet'))}</p>${vermelding(st.bron, (t.huis.bronnen?.[st.bron]?.omgeving ?? []).length > 0)}`;
      } else if (st.stand === 'kamers' && st.kies?.soort === 'opening' && (v.openingen ?? []).some((x) => x.id === st.kies.id)) {
        // Een deur, raam of de voordeur: de breedte, en weghalen.
        const o = v.openingen.find((x) => x.id === st.kies.id);
        const screen = o.soort === 'raam' ? st.apparaten.find((a) => a.raam === o.id && a.plek?.etage === st.etage) : null;
        const buitenmuur = t.openingMuur(o) === 2;
        const soorten = (buitenmuur ? OPENING_SOORTEN : BINNEN_SOORTEN).map((x) => `<button type="button" class="dr-soort${x === o.soort ? ' aan' : ''}" data-ht="opening-zet" data-wat="soort" data-w="${x}" aria-pressed="${x === o.soort}">${openingPlaatje(x)}<b>${esc(T(`ht.opening.${x}`))}</b></button>`).join('');
        const keus = (wat, opties, nu) => `<div class="ht-twee twee">${opties.map(([w, naam]) => `<button type="button" class="ht-klein${String(nu) === String(w) ? ' aan' : ''}" data-ht="opening-zet" data-wat="${wat}" data-w="${w}" aria-pressed="${String(nu) === String(w)}">${esc(naam)}</button>`).join('')}</div>`;
        // Het scharnier en de schuifrichting heten links en rechts zoals je ze in de tekening ziet: langs de muur van links naar rechts, of van onder naar boven.
        const eindNaam = (w) => T(o.as === 'y' ? (w === 'van' ? 'ht.opening.links' : 'ht.opening.rechts') : w === 'van' ? 'ht.opening.voorkant' : 'ht.opening.achterkant');
        const binnenKant = t.openingBinnen(o);
        const [ka, kb] = t.muurKanten({ as: o.as, op: o.op, van: o.van, tot: o.tot });
        const kamerNaam = (k) => (buitenmuur ? T(k === binnenKant ? 'ht.opening.naarBinnen' : 'ht.opening.naarBuiten') : (t.naamVan(v.ruimtes[k === -1 ? ka : kb]) ?? T('ht.vakZonderNaam')));
        const richting = o.soort === 'raam'
          ? ''
          : o.soort === 'schuifpui'
            ? `<h4 class="ht-dakkop">${esc(T('ht.opening.schuiftNaar'))}</h4>${keus('schuift', [['van', eindNaam('van')], ['tot', eindNaam('tot')]], o.schuift ?? 'van')}`
            : `${MET_SCHARNIER.has(o.soort) ? `<h4 class="ht-dakkop">${esc(T('ht.opening.scharnier'))}</h4>${keus('scharnier', [['van', eindNaam('van')], ['tot', eindNaam('tot')]], o.scharnier ?? 'van')}` : ''}
              <h4 class="ht-dakkop">${esc(T('ht.opening.draait'))}</h4>${keus('kant', buitenmuur ? [[binnenKant, kamerNaam(binnenKant)], [-binnenKant, kamerNaam(-binnenKant)]] : [[-1, kamerNaam(-1)], [1, kamerNaam(1)]], t.openingKant(o))}`;
        s = `<header><h3>${esc(T(`ht.opening.${o.soort}`))}</h3><span>${esc(meter(o.tot - o.van))}</span></header>
          <div class="dr-soorten">${soorten}</div>
          ${richting}
          <p class="ht-zin">${esc(T(`ht.opening.${o.soort}Zin`))}</p>
          <div class="ht-veld"><label>${esc(T('ht.opening.breed'))}</label>
            <div class="ht-stap"><button type="button" data-ht="opening-breed" data-d="-1" aria-label="${esc(T('ht.opening.smaller'))}">−</button><input readonly value="${nl((o.tot - o.van) * CEL)}" aria-label="${esc(T('ht.opening.breed'))}"><span>m</span><button type="button" data-ht="opening-breed" data-d="1" aria-label="${esc(T('ht.opening.breder'))}">+</button></div></div>
          ${o.soort === 'raam' ? rij({ ik: 'screen', titel: T('ht.opening.screen'), zin: screen ? T('ht.opening.screenErvoor', { naam: screen.naam }) : T('ht.opening.screenZin'), data: 'disabled' }) : ''}
          <div class="ht-onder">${rij({ ik: 'kruis', kleur: 'var(--gloed)', titel: T('ht.opening.weg'), zin: T('ht.opening.wegZin'), data: 'data-ht="opening-weg"' })}</div>`;
      } else if (st.stand === 'kamers' && metOpeningenVan(t) && st.kies?.soort === 'muur' && st.kies.run?.soort === 2) {
        // Een buitenmuur bij Kamers: schuiven doe je bij Vorm; hier een raam of de voordeur.
        const run = st.kies.run;
        s = t.opBuurMuur(run)
          ? `<header><h3>${esc(T('ht.opening.buurmuur'))}</h3><span>${esc(T('ht.muur.lang', { maat: meter(run.tot - run.van) }))}</span></header>
          <p class="ht-zin">${esc(T('ht.opening.buurmuurZin'))}</p>`
          : `<header><h3>${esc(T('ht.opening.buitenmuur'))}</h3><span>${esc(T('ht.muur.lang', { maat: meter(run.tot - run.van) }))}</span></header>
          <p class="ht-zin">${esc(T('ht.opening.buitenmuurZin'))}</p>
          <div class="dr-soorten">${OPENING_SOORTEN.map((x) => `<button type="button" class="dr-soort" data-ht="opening-plaats" data-soort="${x}">${openingPlaatje(x)}<b>${esc(T(`ht.opening.${x}`))}</b></button>`).join('')}</div>`;
      } else if (st.stand === 'kamers') {
        if (st.kies?.soort === 'muur' && st.kies.run) {
          const run = st.kies.run;
          const o = t.omtrek();
          const [a, b] = t.muurKanten(run);
          const na = t.naamVan(v.ruimtes[a]) ?? T('ht.vakZonderNaam');
          const nb = t.naamVan(v.ruimtes[b]) ?? T('ht.vakZonderNaam');
          const vanaf = run.as === 'x' ? run.op - o.x0 : run.op - o.y0;
          s = `<header><h3>${esc(T('ht.muur.kop'))}</h3><span>${esc(T('ht.muur.lang', { maat: meter(run.tot - run.van) }))}</span></header>
            <p class="ht-zin">${esc(T('ht.muur.zin', { a: na, b: nb }))}</p>
            <div class="ht-veld"><label for="ht-maat">${esc(run.as === 'x' ? T('ht.muur.vanLinks') : T('ht.muur.vanVoor'))}</label>
              <div class="ht-stap"><button type="button" data-ht="muur-stap" data-d="-1" aria-label="${esc(T('ht.muur.terug'))}">−</button><input id="ht-maat" inputmode="decimal" value="${nl(vanaf * CEL)}" data-ht-maat data-nul="${run.as === 'x' ? o.x0 : o.y0}" aria-label="${esc(T('ht.muur.meter'))}"><span>m</span><button type="button" data-ht="muur-stap" data-d="1" aria-label="${esc(T('ht.muur.verder'))}">+</button></div></div>
            ${metOpeningenVan(t) ? `<h4 class="ht-dakkop">${esc(T('ht.opening.watHier'))}</h4><div class="dr-soorten">${BINNEN_SOORTEN.map((x) => `<button type="button" class="dr-soort" data-ht="opening-plaats" data-soort="${x}">${openingPlaatje(x)}<b>${esc(T(`ht.opening.${x}`))}</b></button>`).join('')}</div>` : ''}
            ${rij({ ik: 'kruis', titel: T('ht.muur.weg'), zin: T('ht.muur.wegZin'), data: 'data-ht="muur-weg"' })}`;
        } else if (st.kies?.soort === 'ruimte' && v.ruimtes[st.kies.id]) {
          const id = st.kies.id;
          const r = v.ruimtes[id];
          const mm = m[id];
          const naam = t.naamVan(r);
          const maat = mm.recht ? `${nl((mm.x1 - mm.x0) * CEL)} × ${nl((mm.y1 - mm.y0) * CEL)} m` : T('ht.metHoek');
          s = `<header><h3>${esc(naam ?? T('ht.nieuwVak'))}</h3><span>${maat} · ${nl(mm.n * CEL * CEL, 0)} m²</span></header><h4>${esc(T('ht.watIsDit'))}</h4>`;
          for (const km of hier) {
            const w = waar[km.id];
            const aan = r.kamer === km.id;
            s += rij({ ik: km.soort, titel: km.naam, zin: aan ? T('ht.staatHier') : w ? T('ht.wisselen') : T('ht.nogGeenPlek'), mist: !w, aan, rechts: aan ? '✓' : '', data: `data-ht="noem" data-kamer="${esc(km.id)}"` });
          }
          // Buiten: een plek die nog niet bestaat, zoals de voortuin (Ricardo, 19 november 2026); kiezen zet hem in de indeling, met dit vak.
          if (etage.buiten && ix?.nieuwBuiten?.length) for (const p of ix.nieuwBuiten) s += rij({ ik: p.icoon ?? 'tuin', titel: p.naam, zin: T('ht.buiten.komtErbij'), rechts: '+', data: `data-ht="ix" data-actie="vak-buiten" data-waarde="${esc(p.soort)}"` });
          // Zones: alleen bij een kamer die er in Home Assistant meer dan één heeft.
          const zn = r.kamer ? (t.kamers[r.kamer]?.zones ?? []) : [];
          if (zn.length > 1 && !etage.buiten) {
            const z = v.zones?.[r.kamer];
            s += `<h4>${esc(T('ht.zones.kop', { namen: zn.join(` ${T('tk.en')} `) }))}</h4>`;
            s += z
              ? `<div class="ht-twee twee">${`<button type="button" class="ht-klein" data-ht="zone" data-wat="draai">${esc(T('ht.zones.draai'))}</button><button type="button" class="ht-klein" data-ht="zone" data-wat="weg">${esc(T('ht.zones.weg'))}</button>`}</div>`
              : rij({ ik: 'kamers', titel: T('ht.zones.zet'), zin: T('ht.zones.zetZin'), data: 'data-ht="zone" data-wat="zet"' });
          }
          const EIGEN = eigenNamen(!!etage.buiten);
          const eigen = r.naam && !EIGEN.some(([, n]) => n === r.naam) ? r.naam : '';
          // Een trap: naar welke kant hij omhoog gaat.
          if (metOpeningenVan(t) && t.soortVan(r) === 'trap') {
            s += `<h4>${esc(T('ht.trap.omhoog'))}</h4><div class="ht-twee">${['n', 'z', 'w', 'o'].map((x) => `<button type="button" class="ht-klein${(r.omhoog ?? 'n') === x ? ' aan' : ''}" data-ht="trap" data-r="${x}">${esc(T(`ht.trap.${x}`))}</button>`).join('')}</div>`;
          }
          s += `<h4>${esc(T('ht.geenKamerHA'))}</h4><div class="ht-twee">${EIGEN.map(([soort, n]) => `<button type="button" class="ht-klein${r.naam === n ? ' aan' : ''}" data-ht="noem" data-naam="${esc(n)}" data-soort="${soort}">${esc(n)}</button>`).join('')}</div>
            <input class="ht-naam" id="ht-naam" data-ht-naam value="${esc(eigen)}" placeholder="${esc(T('ht.eigenNaam'))}" maxlength="30" aria-label="${esc(T('ht.eigenNaamLabel'))}">`;
          if (ix && r.kamer && t.kamers[r.kamer] && !etage.buiten) s += kamerIndeling(t, r.kamer, ix);
          // Weghalen: het vak wordt weer deel van de ruimte waar het het meest aan grenst.
          const bw = t.buurVoor(id);
          const bwNaam = bw != null ? t.naamVan(v.ruimtes[bw]) : null;
          s += `<div class="ht-onder">${rij({ ik: 'kruis', kleur: 'var(--gloed)', titel: bw != null ? T('w.weghalen') : T('ht.naamWeghalen'), zin: bw != null ? T('ht.weerDeelVan', { naam: bwNaam ?? T('ht.vakErnaast') }) : T('ht.vakBlijft'), data: 'data-ht="weg"' })}</div>`;
        } else if (t.isLeeg()) {
          const lijst = t.indelingen();
          s = `<header><h3>${esc(etage.naam)}</h3><span>${esc(T('ht.kamers', { n: hier.length }))}</span></header><h4>${esc(T('ht.begin.kop'))}</h4>
            <div class="ht-keus">${lijst.map((x, i) => `<button type="button" data-ht="indeling" data-i="${i}"><span>${t.plaatje(i, 116, 78)}</span><b>${esc(x.naam)}</b></button>`).join('')}</div>
            ${st.etage !== t.huis.etages[t.huis.etages.length - 1].id ? rij({ ik: 'etages', titel: T('ht.begin.beneden'), zin: T('ht.begin.benedenZin'), data: 'data-ht="beneden"' }) : ''}
            <p class="ht-voet">${esc(T('ht.begin.voet'))}</p>
            ${ix ? `<div class="ht-onder">${rij({ ik: 'etages', titel: T('ht.etage.instellen'), zin: T('ht.etage.instellenZin'), rechts: '›', data: 'data-ht="blad" data-blad="etage"' })}</div>` : ''}`;
        } else {
          const zonder = hier.filter((k) => !waar[k.id]);
          s = `<header><h3>${esc(etage.naam)}</h3><span>${esc(zonder.length ? T('ht.zonderPlek', { n: zonder.length }) : T('ht.allesPlek'))}</span></header>`;
          for (const km of hier) {
            const w = waar[km.id];
            const mm = w ? m[w.id] : null;
            s += rij({ ik: km.soort, titel: km.naam, zin: w ? '' : st.wapen?.kamer === km.id ? T('ht.tikVak') : T('ht.nogGeenPlek'), mist: !w, aan: st.wapen?.kamer === km.id, rechts: mm ? `${nl(mm.n * CEL * CEL, 0)} m²` : '', data: `data-ht="kamer" data-kamer="${esc(km.id)}"` });
          }
          for (const [id, r] of Object.entries(v.ruimtes)) if (r.naam) s += rij({ ik: r.soort ?? 'kamer', titel: r.naam, zin: T('ht.nietInHA'), rechts: `${nl(m[id].n * CEL * CEL, 0)} m²`, data: `data-ht="ruimte" data-id="${id}"`, kleur: 'var(--gedempt)' });
          // Buiten: wat er rond het huis is (voor Thuis) in plaats van de etage, en geen andere indeling.
          s += etage.buiten
            ? `<div class="ht-onder">${ix ? rij({ ik: 'buiten', titel: T('ht.buiten.rond'), zin: T('ht.buiten.rondZin'), rechts: '›', data: 'data-ht="blad" data-blad="buiten"' }) : ''}${rij({ ik: 'dak', titel: T('ht.buiten.vanKaart'), zin: T('ht.buiten.vanKaartZin'), data: 'data-ht="van-kaart"' })}</div>`
            : `${metOpeningenVan(t) ? rij({ ik: 'deur', titel: T('ht.opening.uitleg'), zin: T('ht.opening.uitlegZin', { n: (v.openingen ?? []).filter((o) => t.openingMuur(o)).length }), data: 'disabled' }) : ''}<div class="ht-onder">${ix ? rij({ ik: 'etages', titel: T('ht.etage.instellen'), zin: T('ht.etage.instellenZin'), rechts: '›', data: 'data-ht="blad" data-blad="etage"' }) : ''}${rij({ ik: 'kamers', titel: T('ht.andereIndeling'), zin: T('ht.andereIndelingZin'), data: 'data-ht="leeg"' })}</div>`;
        }
      } else if (st.stand === 'huis') {
        const b = t.huis.bronnen?.[st.bron];
        const n = Object.values(v.ruimtes).filter((r) => t.naamVan(r)).length;
        s = `<header><h3>${esc(T('jehuis.kop'))}</h3><span>${esc(st.dicht ? T('ht.huis.dicht') : T('ht.huis.open', { etage: etage.kort ?? etage.naam }))}</span></header>
          <p class="ht-zin">${esc(T('ht.huis.zin'))}</p>
          ${rij({ ik: 'thuis', titel: T('ht.vorm.kop'), zin: b?.naam ?? T('ht.huis.zelf'), data: 'disabled' })}
          ${rij({ ik: 'etages', titel: T('ht.hoogte'), zin: b?.hoogte ?? '', rechts: b?.gemeten ? T('ht.gemeten') : T('ht.geschat'), data: 'disabled' })}
          ${rij({ ik: 'kamers', titel: T('ht.huis.binnen'), zin: T('ht.huis.ruimtes', { n }), data: 'disabled' })}
          <h4>${esc(T('ht.huis.kijken'))}</h4>
          <div class="ht-twee twee"><button type="button" class="ht-klein${st.dicht ? '' : ' aan'}" data-ht="dicht" data-d="0">${esc(T('buiten.deurOpen'))}</button><button type="button" class="ht-klein${st.dicht ? ' aan' : ''}" data-ht="dicht" data-d="1">${esc(T('buiten.deurDicht'))}</button></div>
          <p class="ht-voet">${esc(T('ht.huis.voet'))}</p>`;
      } else {
        const punten = t.apparaatPunten();
        const kies = st.kies?.soort === 'apparaat' ? t.st.apparaten.find((a) => a.id === st.kies.id) : null;
        const los = t.st.apparaten.filter((a) => !a.kamer);
        if (st.wapen?.apparaat || (kies && st.wapen?.lijst)) {
          const a = t.st.apparaten.find((x) => x.id === (st.wapen.apparaat ?? kies.id));
          s = `<header><h3>${esc(a.naam)}</h3><span>${esc(T('ht.app.waar'))}</span></header><p class="ht-zin">${esc(T('ht.app.waarZin'))}</p>`;
          for (const e of t.huis.etages) {
            const ks = t.huis.kamers.filter((k) => k.etage === e.id && waar[k.id] && !t.vast?.includes(k.id));
            if (!ks.length) continue;
            s += `<h4>${esc(e.naam)}</h4><div class="ht-twee">${ks.map((k) => `<button type="button" class="ht-klein${a.ha === k.id ? ' tip' : ''}${a.kamer === k.id ? ' aan' : ''}" data-ht="app-kamer" data-app="${esc(a.id)}" data-kamer="${esc(k.id)}">${esc(k.naam)}</button>`).join('')}</div>`;
          }
          // Buiten (besluit 269 en 317): de voordeur en wat er rond het huis is; een plek zonder ruimte komt erbij.
          // Een ruimte buiten met delen (de tuin met het terras en de border) onder zijn eigen kopje (18 november 2026).
          const groepen = [];
          // Wat al in de tekening van buiten staat, staat daar al bij de etage Buiten.
          for (const p of (ix?.plekken ?? []).filter((x) => !waar[x.waarde])) {
            const g = p.groep ?? T('ht.buiten.kop');
            const x = groepen.find(([y]) => y === g) ?? groepen[groepen.push([g, []]) - 1];
            x[1].push(p);
          }
          s += groepen.map(([g, ps]) => `<h4>${esc(g)}</h4><div class="ht-twee">${ps.map((p) => `<button type="button" class="ht-klein" data-ht="ix" data-actie="app-buiten" data-waarde="${esc(`${a.id}|${p.waarde}`)}">${esc(p.naam)}</button>`).join('')}</div>`).join('');
          if (a.ha) s += `<p class="ht-voet">${esc(T('ht.app.inHA', { naam: t.kamers[a.ha]?.naam ?? a.ha }))}</p>`;
          // Verbergen kan ook hier (18 november 2026): eerst alleen bij een apparaat dat al een kamer had.
          if (ix) s += `<div class="ht-onder">${rij({ ik: 'verborgen', titel: T('toev.verbergen'), zin: T('ht.app.verbergenZin'), data: `data-ht="ix" data-actie="verberg" data-waarde="${esc(a.id)}"` })}</div>`;
        } else if (kies) {
          const p = punten.find((x) => x.a.id === kies.id);
          s = `<header><h3>${esc(kies.naam)}</h3><span>${esc(t.kamers[kies.kamer]?.naam ?? T('ht.app.geenKamer'))}</span></header>
            ${rij({ ik: t.kamers[kies.kamer]?.soort ?? 'kamer', titel: T('w.kamer'), zin: t.kamers[kies.kamer]?.naam ?? T('ht.app.nietGekozen'), rechts: '›', data: `data-ht="app-waar" data-app="${esc(kies.id)}"` })}
            ${rij({ ik: 'standaard', titel: T('ht.app.plek'), zin: p ? [t.zoneVan(p), t.plekNaam(p)].filter(Boolean).join(' · ') : T('ht.app.andereEtage'), rechts: p?.zelf ? T('ht.app.laatKiezen') : '', data: p?.zelf ? `data-ht="app-vrij" data-app="${esc(kies.id)}"` : 'disabled' })}
            ${rij({ ik: 'apparaat', titel: T('ht.app.openen'), zin: T('ht.app.openenZin'), rechts: '›', data: t.naar && kies.kamer ? `data-ht="openen" data-app="${esc(kies.id)}"` : 'disabled' })}
            ${bijBlad(kies)}
            <p class="ht-voet">${esc(T('ht.app.voet'))}</p>
            ${ix ? `<div class="ht-onder">${rij({ ik: 'verborgen', titel: T('toev.verbergen'), zin: T('ht.app.verbergenZin'), data: `data-ht="ix" data-actie="verberg" data-waarde="${esc(kies.id)}"` })}</div>` : ''}`;
        } else if (st.zoom != null && v.ruimtes[st.zoom]) {
          const lijst = punten.filter((p) => p.ruimte === st.zoom);
          s = `<header><h3>${esc(t.naamVan(v.ruimtes[st.zoom]) ?? T('ht.vakZonderNaamKop'))}</h3><span>${esc(T('ht.apparaten', { n: lijst.length }))}</span></header>`;
          s += lijst.map((p) => rij({ ik: APP_ICOON[p.a.soort] ?? p.a.soort, kleur: APP_KLEUR[p.a.soort], titel: p.a.naam, zin: [t.zoneVan(p), t.plekNaam(p)].filter(Boolean).join(' · '), data: `data-ht="app" data-app="${esc(p.a.id)}"` })).join('') || `<p class="ht-zin">${esc(T('ht.app.leeg'))}</p>`;
          // Een radiator erbij (besluit 333), alleen binnen.
          const kamerZoom = v.ruimtes[st.zoom].kamer;
          if (kamerZoom && !etage.buiten) s += rij({ ik: 'verwarming', kleur: APP_KLEUR.radiator, titel: T('ht.app.radiatorErbij'), zin: T('ht.app.radiatorErbijZin'), data: `data-ht="radiator-erbij" data-kamer="${esc(kamerZoom)}"` });
          s += `<div class="ht-onder">${rij({ ik: 'terug', titel: T('ht.app.heleEtage'), zin: '', data: 'data-ht="uit"' })}</div>`;
        } else {
          s = `<header><h3>${esc(etage.naam)}</h3><span>${esc(T('ht.apparaten', { n: punten.length }))}</span></header>`;
          for (const km of hier.filter((x) => waar[x.id])) {
            const n = punten.filter((p) => p.ruimte === waar[km.id].id).length;
            s += rij({ ik: km.soort, titel: km.naam, zin: `${(km.zones ?? []).length > 1 && v.zones?.[km.id] ? `${T('ht.zones.aantal', { n: km.zones.length })} · ` : ''}${T('ht.apparaten', { n })}`, rechts: '›', data: `data-ht="zoom" data-id="${waar[km.id].id}"` });
          }
          const zonderVak = hier.filter((x) => !waar[x.id]);
          if (zonderVak.length) s += `<p class="ht-zin mist">${esc(T('ht.app.zonderVak', { namen: zonderVak.map((x) => x.naam).join(', ') }))}</p>${rij({ ik: 'kamers', titel: T('ht.app.naarKamers'), zin: '', rechts: '›', data: 'data-ht="naar-kamers"' })}`;
          s += `<div class="ht-onder">${los.length ? '' : `<p class="ht-voet">${esc(T('ht.app.allesKamer'))}</p>`}${t.huis.verborgen ? rij({ ik: 'verborgen', titel: T('toev.verborgen'), zin: T('ht.apparaten', { n: t.huis.verborgen }), rechts: '›', data: t.naar ? 'data-ht="verborgen"' : 'disabled' }) : ''}</div>`;
        }
      }
      el.innerHTML = s;
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ht]');
      if (!b || b.disabled) return;
      const d = b.dataset;
      const st = t.st;
      if (d.ht === 'noem') t.noem(st.kies.id, d.kamer ? { kamer: d.kamer } : { naam: d.naam, soort: d.soort });
      else if (d.ht === 'zone') t.zetZone(t.vloer().ruimtes[st.kies.id].kamer, d.wat);
      else if (d.ht === 'bron') t.kiesBron(d.bron);
      else if (d.ht === 'wn-open' || d.ht === 'wn-dicht') {
        st.wnOpen = d.ht === 'wn-open';
        t.ververs();
      } else if (d.ht === 'woning') void t.indeling?.doe?.('woning', d.woning);
      else if (d.ht === 'buur') void t.indeling?.doe?.('buur', d.buur);
      else if (d.ht === 'flat') void t.indeling?.doe?.('flat', { wat: d.flat, d: Number(d.stap) });
      else if (d.ht === 'kijk') t.kijk?.();
      else if (d.ht === 'gebouw-terug') t.kies(null);
      else if (d.ht === 'blok-stap') t.blokStap(d.wat, Number(d.d));
      else if (d.ht === 'straat-open' || d.ht === 'straat-dicht') {
        st.straatOpen = d.ht === 'straat-open';
        t.ververs();
      } else if (d.ht === 'straat-kies' && t.straat && !st.gebouwBezig) {
        st.gebouwBezig = true;
        teken();
        Promise.resolve(t.straat(d.kant)).finally(() => {
          st.gebouwBezig = false;
          teken();
        });
      }
      else if (d.ht === 'afdak-klopt') {
        t.afdakZie();
        t.kies(null);
      } else if (['blok-kaart', 'bestaat-niet', 'weg-terug', 'afdak-nee', 'afdak-terug'].includes(d.ht) && t.gebouw && !st.gebouwBezig) {
        // Ronde 2: de maat van de kaart terug, iets dat er niet meer staat, terughalen, en het afdak; de pagina bewaart en laadt opnieuw.
        const k = st.kies;
        const wat = d.ht === 'blok-kaart' ? { maat: k.id, kaart: true } : d.ht === 'bestaat-niet' ? { bestaatNiet: k.soort === 'omgeving' ? k.i : k.id } : d.ht === 'weg-terug' ? { terug: Number(d.n) } : { afdak: d.ht === 'afdak-nee' ? 'nee' : 'ja' };
        if (d.ht === 'bestaat-niet' && k.soort === 'blok') t.blokWeg(k.id);
        st.gebouwBezig = true;
        teken();
        Promise.resolve(t.gebouw(wat)).finally(() => {
          st.gebouwBezig = false;
          teken();
        });
      }
      else if (d.ht === 'opening-plaats') t.plaatsOpening(d.soort);
      else if (d.ht === 'opening-breed') t.openingBreed(Number(d.d));
      else if (d.ht === 'opening-zet') t.openingZet(d.wat, d.w);
      else if (d.ht === 'opening-weg') t.openingWeg();
      else if (d.ht === 'radiator-erbij') t.radiatorErbij(d.kamer);
      else if (d.ht === 'trap') t.zetTrap(st.kies.id, d.r);
      else if ((d.ht === 'gebouw-dak' || d.ht === 'gebouw-nok') && t.gebouw && !st.gebouwBezig) {
        st.gebouwBezig = true;
        teken();
        Promise.resolve(t.gebouw(d.ht === 'gebouw-nok' ? { dak: d.id, nok: true } : { dak: d.id, dakvorm: d.dakvorm })).finally(() => {
          st.gebouwBezig = false;
          teken();
        });
      }
      else if (d.ht === 'naar-buiten' && t.erfEtage()) t.zetEtage(t.erfEtage());
      else if (d.ht === 'naar-binnen' || d.ht === 'naar-vorm') {
        const binnen = t.huis.beneden ?? t.huis.etages.filter((e) => !e.buiten).at(-1)?.id;
        t.st.kies = null;
        t.zetEtage(binnen);
        if (d.ht === 'naar-vorm') t.zetStand('vorm');
      }
      else if ((d.ht === 'gebouw-erbij' || d.ht === 'gebouw-weg') && t.gebouw && !st.gebouwBezig) {
        st.gebouwBezig = true;
        teken();
        const wat = d.ht === 'gebouw-erbij' ? { erbij: st.kies.i, soort: d.soort } : { weg: st.kies.id };
        if (wat.weg) t.blokWeg(wat.weg);
        Promise.resolve(t.gebouw(wat)).finally(() => {
          st.gebouwBezig = false;
          teken();
        });
      }
      else if (d.ht === 'weg') t.haalWeg(st.kies.id);
      else if (d.ht === 'dicht') {
        st.dicht = d.d === '1';
        t.teken();
        teken();
      } else if (d.ht === 'hoort') t.voegSamen(Number(d.bij), st.kies.id);
      else if (d.ht === 'muur-weg') t.muurWeg();
      else if (d.ht === 'muur-stap') t.muurZet(st.kies.run.op + Number(d.d));
      else if (d.ht === 'indeling') t.kiesIndeling(Number(d.i));
      else if (d.ht === 'beneden') t.zoalsBeneden();
      else if (d.ht === 'leeg') t.leeg();
      else if (d.ht === 'van-kaart') t.vanKaart();
      else if (d.ht === 'kapel-erbij') t.kapelErbij();
      else if (d.ht === 'kapel-keus') t.kapelKeus(d.wat, d.waarde);
      else if (d.ht === 'kapel-zet') t.kapelZet();
      else if (d.ht === 'kapel-niet') t.kapelNiet();
      else if (d.ht === 'kapel-anders') t.kapelAnders(Number(d.i), d.wat, Number(d.d ?? 0));
      else if (d.ht === 'kapel-weg') t.kapelWeg(Number(d.i));
      else if (d.ht === 'kamer') {
        const w = t.kamerPlek()[d.kamer];
        if (w) t.kies({ soort: 'ruimte', id: w.id });
        else t.wapen(st.wapen?.kamer === d.kamer ? null : { kamer: d.kamer });
      } else if (d.ht === 'ruimte') t.kies({ soort: 'ruimte', id: Number(d.id) });
      else if (d.ht === 'zoom') t.zoom(Number(d.id));
      else if (d.ht === 'uit') t.zoom(null);
      else if (d.ht === 'app') t.kies({ soort: 'apparaat', id: d.app });
      else if (d.ht === 'app-waar') {
        st.wapen = { lijst: true };
        teken();
      } else if (d.ht === 'app-kamer') t.zetApparaat(d.app, d.kamer, null);
      else if (d.ht === 'app-vrij') t.zetApparaat(d.app, st.apparaten.find((a) => a.id === d.app).kamer, null);
      else if (d.ht === 'openen') t.naar('apparaat', st.apparaten.find((a) => a.id === d.app));
      else if (d.ht === 'verborgen') {
        if (t.indeling) t.toonBlad('verborgen');
        else t.naar('verborgen');
      } else if (d.ht === 'blad') t.toonBlad(d.blad || null);
      else if (d.ht === 'ix' && t.indeling) Promise.resolve(t.indeling.doe(d.actie, d.waarde)).finally(() => teken());
      else if (d.ht === 'naar-kamers') t.zetStand('kamers');
    });
    el.addEventListener('change', (e) => {
      const ixVeld = e.target.closest('[data-ht-ix]');
      if (ixVeld && t.indeling) {
        const w = ixVeld.value.trim().replace(/\s+/g, ' ');
        ixVeld.blur();
        const waarde = ixVeld.dataset.kamer ? { kamer: ixVeld.dataset.kamer, w } : w;
        Promise.resolve(t.indeling.doe(ixVeld.dataset.htIx, waarde)).finally(() => teken());
        return;
      }
      const naam = e.target.closest('[data-ht-naam]');
      if (naam) {
        const tekst = naam.value.trim().replace(/\s+/g, ' ');
        naam.blur();
        if (tekst && t.st.kies?.soort === 'ruimte') t.noem(t.st.kies.id, { naam: tekst, soort: 'berging' });
        return teken();
      }
      const inp = e.target.closest('[data-ht-maat]');
      if (!inp) return;
      const n = Number(inp.value.replace(',', '.'));
      const nul = Number(inp.dataset.nul);
      inp.blur();
      if (Number.isFinite(n)) t.muurZet(nul + Math.round(n / CEL));
      teken();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-ht-maat], [data-ht-naam], input[data-ht-ix]')) e.target.blur();
    });
    t.op(teken);
    teken();
  }

  /** De etages als het huis opzij: tik een laag aan. */
  function stapel(el, t) {
    const teken = () => {
      const waar = t.kamerPlek();
      const erf = t.huis.etages.find((e) => e.buiten);
      const zonderBuiten = erf ? t.huis.kamers.filter((k) => k.etage === erf.id && !t.vast?.includes(k.id) && !waar[k.id]).length : 0;
      const binnen = t.huis.etages.filter((e) => !e.buiten);
      // Een appartement (20 november 2026): de woning in het gebouw, met de verdiepingen erboven en eronder grijs.
      const wd = global.woningDeel;
      const flat = wd && t.huis.woning?.soort === 'appartement' ? wd.flatVan(t.huis.woning) : null;
      const vloeren = (van, tot) => {
        const n = [];
        for (let i = van; i >= tot; i--) n.push(i);
        const rij = (x) => `<span class="ht-vloer">${esc(typeof x === 'number' ? wd.vloer(x) : x)}</span>`;
        return n.length <= 3 ? n.map(rij).join('') : rij(n[0]) + rij(T('wn.gebouwNog', { n: n.length - 2 })) + rij(n.at(-1));
      };
      const boven = flat ? flat.verdieping + binnen.length : 0;
      el.innerHTML = `<div class="ht-dak${flat ? ' plat' : ''}" aria-hidden="true"></div>${flat ? vloeren(boven + flat.erboven - 1, boven) : ''}${binnen
        .map((e, i) => {
          const zonder = t.huis.kamers.filter((k) => k.etage === e.id && !waar[k.id]).length;
          const zin = t.st.stand === 'vorm' ? T('ht.stapel.hoog', { maat: nl(e.hoogte ?? 2.8) }) : zonder && t.st.stand === 'kamers' ? T('ht.zonderPlek', { n: zonder }) : T('ht.kamers', { n: t.huis.kamers.filter((k) => k.etage === e.id).length });
          return `<button type="button" class="ht-laag${e.id === t.st.etage ? ' aan' : ''}" data-etage="${esc(e.id)}" aria-pressed="${e.id === t.st.etage}"><b>${esc(e.kort ?? e.naam)}</b><small>${esc(flat ? `${wd.vloer(boven - 1 - i)} · ${zin}` : zin)}</small>${zonder && t.st.stand === 'kamers' ? '<i></i>' : ''}</button>`;
        })
        .join('')}${flat ? vloeren(flat.verdieping - 1, 0) : ''}<div class="ht-grond" aria-hidden="true"></div>${erf
        // Buiten als eigen tekening (19 november 2026): een etage zoals de andere.
        ? `<button type="button" class="ht-laag buiten${t.st.etage === erf.id ? ' aan' : ''}" data-etage="${esc(erf.id)}" aria-pressed="${t.st.etage === erf.id}"><b>${esc(flat ? T('wn.balkon') : (erf.kort ?? erf.naam))}</b><small>${esc(zonderBuiten && t.st.stand === 'kamers' ? T('ht.zonderPlek', { n: zonderBuiten }) : T(flat ? 'wn.balkonZin' : 'ht.stapel.buitenZin'))}</small>${zonderBuiten && t.st.stand === 'kamers' ? '<i></i>' : ''}</button>`
        : `<button type="button" class="ht-laag buiten${t.st.blad?.naam === 'buiten' ? ' aan' : ''}" ${t.indeling ? 'data-buiten-blad' : 'disabled'}><b>${esc(T(flat ? 'wn.balkon' : 'ht.buiten.kop'))}</b><small>${esc(T(flat ? 'wn.balkonZin' : 'ht.stapel.buitenZin'))}</small></button>`}`;
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-etage]');
      // De etage die al gekozen is, nog eens aantikken: zijn blad (naam, dak, volgorde); buiten wat er rond het huis is.
      if (b && t.indeling && b.dataset.etage === t.st.etage && !t.st.blad) t.toonBlad(t.huis.etages.find((x) => x.id === b.dataset.etage)?.buiten ? 'buiten' : 'etage');
      else if (b) {
        t.st.blad = null;
        t.zetEtage(b.dataset.etage);
      }
      if (e.target.closest('[data-buiten-blad]')) t.toonBlad('buiten');
    });
    t.op(teken);
    teken();
  }

  /**
   * De strook onder de tekening bij Apparaten: wat nog geen kamer heeft. Sleep
   * een apparaat de tekening in, of tik het aan en dan de kamer.
   */
  function strook(el, t) {
    let sleep = null;
    const teken = () => {
      // Onder de vinger blijft de strook staan: opnieuw tekenen zou het gesleepte apparaat weghalen.
      if (sleep) return;
      const los = t.st.apparaten.filter((a) => !a.kamer);
      el.hidden = t.st.stand !== 'apparaten' || !los.length;
      el.innerHTML = `<div class="ht-n"><b>${los.length}</b><span>${esc(T('ht.strook.zonder'))}</span></div>${los.map((a) => `<button type="button" class="ht-los${t.st.wapen?.apparaat === a.id ? ' aan' : ''}" data-los="${esc(a.id)}" style="color: ${APP_KLEUR[a.soort] ?? '#eef3f7'}"><span class="ik">${ik(APP_ICOON[a.soort] ?? a.soort)}</span><span class="t"><b>${esc(a.naam)}</b><small>${esc(a.ha ? T('ht.strook.ha', { naam: t.kamers[a.ha]?.naam ?? a.ha }) : T('ht.strook.sleep'))}</small></span></button>`).join('')}`;
    };
    el.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-los]');
      if (!b || e.button > 0 || sleep) return;
      // De strook zelf houdt de vinger vast, niet de knop: die mag opnieuw getekend worden.
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Zonder vasthouden werkt het binnen de strook nog steeds.
      }
      sleep = { b, id: b.dataset.los, x: e.clientX, y: e.clientY, kaart: null, vinger: e.pointerType !== 'mouse' };
    });
    el.addEventListener('pointermove', (e) => {
      if (!sleep) return;
      if (!sleep.kaart) {
        if (Math.hypot(e.clientX - sleep.x, e.clientY - sleep.y) < 10) return;
        sleep.kaart = sleep.b.cloneNode(true);
        sleep.kaart.classList.add('zweeft');
        document.body.append(sleep.kaart);
        sleep.b.classList.add('weg');
      }
      // Boven de vinger, zodat je ziet waar het neerkomt.
      const y = e.clientY - (sleep.vinger ? 46 : 0);
      sleep.kaart.style.transform = `translate(${e.clientX}px, ${y}px) translate(-50%, -50%)`;
      sleep.px = e.clientX;
      sleep.py = y;
      t.zweef(e.clientX, y);
    });
    const klaar = (e, afgebroken) => {
      if (!sleep) return;
      const s = sleep;
      sleep = null;
      s.kaart?.remove();
      s.b.classList.remove('weg');
      t.zweef(null);
      if (afgebroken) return teken();
      if (!s.kaart) {
        // Getikt: dan de kamer kiezen, in de tekening of in het blad.
        t.wapen(t.st.wapen?.apparaat === s.id ? null : { apparaat: s.id });
        return;
      }
      const w = t.plekOp(s.px, s.py);
      if (w) t.zetApparaat(s.id, w.kamer, w.plek);
      else teken();
    };
    el.addEventListener('pointerup', (e) => klaar(e, false));
    el.addEventListener('pointercancel', (e) => klaar(e, true));
    t.op(teken);
    teken();
  }

  /** De zin onder de tekening: wat je hier kunt, of wat er nu gebeurt. */
  function uitleg(t) {
    const st = t.st;
    const a = t.bezig();
    if (a?.type === 'muur') return a.gelijk ? T('ht.uitleg.opLijn') : T('ht.uitleg.muurLos');
    if (a?.type === 'verplaats') return T('ht.uitleg.verplaatsLos');
    if (a?.type === 'vak') return T('ht.uitleg.vakLos');
    if (a?.type === 'apparaat') return T('ht.uitleg.apparaatLos');
    if (a?.type === 'opening') return T('ht.uitleg.openingLos');
    if (st.stand === 'huis') return T('ht.uitleg.huis');
    if (st.stand === 'vorm' && t.huis.kijk?.bezig) return T('ht.zoek.uitleg');
    if (st.stand === 'vorm' && st.kies?.soort === 'blok' && t.gebouw) return T('ht.uitleg.opMaat');
    if (st.stand === 'vorm') return T('ht.uitleg.vorm');
    if (st.stand === 'dak') return T(a?.type === 'kapel' || st.kies?.soort === 'kapel' ? 'ht.uitleg.dakKapel' : 'ht.uitleg.dak');
    if (st.stand === 'kamers') {
      if (st.wapen?.kamer) return T('ht.uitleg.wapen', { naam: t.kamers[st.wapen.kamer].naam.toLowerCase() });
      if (st.kies?.soort === 'ruimte' && t.verplaatsbaar(st.kies.id)) return T('ht.uitleg.greep');
      if (st.kies?.soort === 'opening') return T('ht.uitleg.opening');
      if (st.kies?.soort === 'muur' && st.kies.run?.soort === 2) return T('ht.uitleg.buitenmuur');
      if (st.kies?.soort === 'muur') return T('ht.uitleg.muur');
      // Buiten (19 november 2026): de oprit, de tuin en hun delen; het huis aantikken is naar binnen.
      if (t.huis.etages.find((e) => e.id === st.etage)?.buiten) return T('ht.uitleg.buiten');
      return T('ht.uitleg.kamers');
    }
    if (st.wapen?.apparaat) return T('ht.uitleg.appWapen');
    if (st.zoom != null) return T('ht.uitleg.appZoom');
    if (t.huis.etages.find((e) => e.id === st.etage)?.buiten) return T('ht.uitleg.appBuiten');
    return T('ht.uitleg.apparaten');
  }

  global.htBlad = { bijBlad, STRAAT_KANTEN, straatPlaatje, straatRij, straatBlad, weetDeel, rij, vermelding, dakDeel, doorsnede, kantNaam, etageNaam, dakBlad, metOpeningenVan, indelingBlad, kamerIndeling, paneel, stapel, strook, uitleg };
})(typeof window !== 'undefined' ? window : globalThis);
