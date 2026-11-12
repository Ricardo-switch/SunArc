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
  /** De kinderslotten per apparaat (besluit 299): `{ sloten, bedienen }` van `api/kinderslot`. */
  let sloten = null;
  /** Wat je net tikte bij een kinderslot, tot Home Assistant het doorgeeft. */
  const slotWens = new Map();

  async function laadSloten() {
    try {
      sloten = await haal('api/kinderslot');
    } catch {
      sloten = null;
    }
  }

  const SLOT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7"/><path d="M12 14.6v2.2"/></svg>';

  /**
   * Het kinderslot van een apparaat (besluit 299), onderaan zijn blad: "Op de
   * thermostaat" of "Op de droger", met een schakelaar die meteen gaat.
   */
  function slotHtml(sleutel, naam) {
    const sl = sloten?.sloten?.[sleutel];
    if (!sl) return '';
    const aan = slotWens.has(sl.id) ? slotWens.get(sl.id) : sl.aan;
    const mag = sloten.bedienen === true;
    const wie = naam ? naam.charAt(0).toLowerCase() + naam.slice(1) : '';
    return `<div class="hand-slot"><h3>${esc(t('hand.slot.op', { naam: wie }))}</h3><div class="hand-slotrij"><span class="hand-slotik">${SLOT}</span><div><b>${esc(t('hand.slot.naam'))}</b><small>${esc(t(mag ? 'hand.slot.zin' : 'hand.slot.addon'))}</small></div><button type="button" class="schakel${aan ? '' : ' uit'}" role="switch" aria-checked="${aan}" aria-label="${esc(t('hand.slot.naam'))}" data-slot="${esc(sl.id)}" ${mag ? '' : 'disabled'}></button></div></div>`;
  }

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
    // Een knop die een zone met een eigen regeling regelt (besluit 306): daarna terug naar zijn doel van daarvoor (tot stap B zet de regeling hem niet zelf).
    if (a.soort === 'radiatorknop' && a.zone) return { tekst: t('hand.zinRadiatorZone', { zone: a.zone, doel: graden(open.doel), klok, terug }) };
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

  /*
   * Helpen bij de cv in het blad van een airco (besluit 303, schets
   * Wand-Helpen-Cv #apparaat): de dag van 06:00 tot 24:00 als twee banen, wanneer
   * de ketel stookte en wanneer de airco hielp, met de stille uren gearceerd en
   * een streepje waar hij zelf kort uitging. Daaronder wat dat samen was.
   */
  let helpen = null;
  let helpenOp = 0;
  async function laadHelpen() {
    if (Date.now() - helpenOp < 60_000) return;
    helpenOp = Date.now();
    try {
      helpen = await haal('api/helpen');
    } catch {
      helpen = null;
    }
  }
  /** Bij een airco die kan helpen: de hulp van vandaag ophalen en het blad opnieuw tekenen. */
  function metHelpen(a) {
    if (!a?.actuatorId || !a.modi?.some((m) => m.modus === 'verwarmen')) return;
    void laadHelpen().then(() => {
      if (open && !open.vrij && !open.wg && !open.st) teken();
    });
  }
  function duurVan(min) {
    const u = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return u === 0 ? t('regeling.helpen.min', { n: m }) : m === 0 ? t('regeling.helpen.uur', { n: u }) : t('regeling.helpen.uurMin', { u, m });
  }
  function hulpBlok(a) {
    const h = helpen?.aircos?.find((x) => x.id === a.actuatorId);
    if (!h || !h.balk) return '';
    if (!h.aan) return `<div class="hand-koppel"><span>${esc(t('hand.hulp.uit'))}</span><a href="regeling.html#helpen">${esc(t('hand.hulp.naar'))}</a></div>`;
    const b = h.balk;
    const nu = Date.now();
    const van = b.vanMs + 6 * 3_600_000;
    const tot = b.vanMs + 24 * 3_600_000;
    const pos = (ms) => Math.max(0, Math.min(100, ((ms - van) / (tot - van)) * 100));
    const blokken = (stukken, klasse) =>
      stukken
        .map(([a0, e]) => {
          const l = pos(a0);
          const r = pos(e ?? nu);
          return r > l ? `<i class="${klasse}" style="left: ${l.toFixed(2)}%; width: ${Math.max(0.6, r - l).toFixed(2)}%"></i>` : '';
        })
        .join('');
    const stil = blokken(b.stil, 'stil');
    const nuLijn = nu < tot ? `<b style="left: ${pos(nu).toFixed(2)}%"></b>` : '';
    const kort = b.kort.map((ms) => `<i class="kort" style="left: ${pos(ms).toFixed(2)}%"></i>`).join('');
    const uren = [6, 9, 12, 15, 18, 21, 24].map((u) => `<span style="left: ${(((u - 6) / 18) * 100).toFixed(2)}%">${u}</span>`).join('');
    const regels = [];
    if (h.vandaag.keer) regels.push([t('hand.hulp.keer', { n: h.vandaag.keer, duur: duurVan(h.vandaag.minuten) }), false]);
    else regels.push([t('hand.hulp.nogNiet'), false]);
    if (b.langerMin >= 1) regels.push([t('hand.hulp.langer', { duur: duurVan(b.langerMin), kamer: h.kamer ?? a.kamer ?? '' }), false]);
    if (b.kort.length) regels.push([t('hand.hulp.kort', { n: b.kort.length }), true]);
    if (h.bijC > 0) regels.push([t('hand.hulp.hoger', { graden: nl(h.bijC, h.bijC % 1 ? 1 : 0) }), false]);
    return `<div class="hand-hulp">
        <div class="hand-hulp-kop"><b>${esc(t('hand.hulp.vandaag'))}</b><span>${esc(t('hand.hulp.tot', { klok: klokVan(Math.min(nu, tot)) }))}</span></div>
        <div class="hand-hulp-banen" role="img" aria-label="${esc(t('hand.hulp.label'))}">
          <span>${esc(t('hand.hulp.ketel'))}</span><span class="baan">${stil}${blokken(b.ketel, 'ketel')}${nuLijn}</span>
          <span>${esc(t('hand.hulp.airco'))}</span><span class="baan">${stil}${blokken(b.airco, 'airco')}${kort}${nuLijn}</span>
          <span></span><span class="uren">${uren}</span>
        </div>
        <div class="hand-hulp-legenda"><span><i class="ketel"></i>${esc(t('hand.hulp.lKetel'))}</span><span><i class="airco"></i>${esc(t('hand.hulp.lAirco'))}</span><span><i class="stil"></i>${esc(t('hand.hulp.lStil'))}</span>${b.kort.length ? `<span><i class="kort"></i>${esc(t('hand.hulp.lKort'))}</span>` : ''}</div>
        <div class="hand-hulp-samen">${regels.map(([r, opvallen]) => `<span${opvallen ? ' class="let"' : ''}>${esc(r)}</span>`).join('')}</div>
      </div>
      <div class="hand-koppel"><span>${esc(t('hand.hulp.aan', { kamer: h.kamer ?? a.kamer ?? '' }))}</span><a href="regeling.html#helpen">${esc(t('hand.hulp.naar'))}</a></div>`;
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
      ${hulpBlok(a)}
      ${slotHtml(a.id, a.naam)}
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
      ${slotHtml(d.id, d.naam)}
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

  /** Hoe lang, per keuze, in minuten. Herhalen kent geen "tot een tijd", wel vier uur. */
  const ST_DUUR = { m30: 30, u1: 60, u2: 120, u4: 240 };
  const ST_TK = { m30: 'm30', u1: 'uur1', u2: 'uur2', u4: 'uur4' };
  /** De vaste taken bij Vast en gepland (besluit 268): die van een stekker staan in zijn blad. */
  let stekkerTaken = [];
  const takenVan = (id) => stekkerTaken.filter((g) => (g.opdracht?.stappen ?? []).some((x) => x.pad === 'api/stekker' && x.body?.id === id));

  /**
   * Het blad van een slimme stekker (besluit 265, opnieuw in 268): de stand
   * apart bovenaan, dan wat je wilt (Zet aan of Zet uit), hoe lang, en wanneer:
   * nu, of vast elke dag, op werkdagen of in het weekend. Vast wordt een taak bij
   * Vast en gepland. Op de NAS alleen de stand: schakelen kan daar niet.
   */
  function stekkerBlad(s) {
    const stip = s.aan == null ? '' : `<i class="hand-stip" style="background: ${s.aan ? 'var(--zon)' : 'var(--net)'}"></i>`;
    const stand = [
      s.aan == null ? null : t(s.aan ? 'hand.stekkerNuAan' : 'hand.stekkerNuUit'),
      s.vermogenW != null ? `${nl(s.vermogenW, 0)} W` : null,
      s.actief ? t(s.actief.aan ? 'hand.stekkerAanTot' : 'hand.stekkerUitTot', { klok: klokVan(s.actief.totMs) }) : null,
    ].filter(Boolean).join(' · ');
    const kop = `<div class="hand-boven"><div><h2>${esc(s.naam)}</h2><p class="nu">${stip}${esc(stand || t('apparaten.stekker'))}</p></div><button type="button" class="sluit" data-hand-sluit aria-label="${esc(t('algemeen.sluiten'))}">×</button></div>`;
    const zonZin = s.zon?.schakelt
      ? [t('hand.stekkerOpZon'), s.minimum ? t('hand.stekkerMinimum', { duur: duurVan(s.minimum.minuten), klok: s.minimum.klok, gehad: duurVan(s.gehadMin ?? 0) }) : ''].filter(Boolean).join(' ')
      : '';
    const zon = zonZin ? `<div class="hand-hoe">${esc(zonZin)}</div>` : '';
    // Op de NAS, of nog niet toegelaten: alleen de stand en waarom.
    if (!stekkers?.aan) return `${kop}<div class="hand-hoe let">${esc(t('hand.stekkerAlleenAddon'))}</div>${zon}`;
    // Nog niet toegelaten: hier toestaan (besluit 290), zonder eerst naar Regeling.
    if (!s.toegelaten) return `${kop}<div class="hand-hoe let">${esc(t('hand.stekkerToelaten'))}</div>${zon}${fout ? `<p class="hand-fout">${esc(fout)}</p>` : ''}<div class="hand-onder"><button type="button" class="hand-zet" data-st-toestaan="ja">${esc(t('hand.stekkerToestaan'))}</button></div>`;
    // Toegelaten zonder op zon: dat kan hier ook weer weg. Op zon is zelf de toestemming (besluit 290).
    const intrekken = s.zon?.schakelt ? '' : `<p class="mini" style="margin: 0"><button type="button" class="hand-intrek" data-st-toestaan="nee">${esc(t('hand.stekkerIntrekken'))}</button></p>`;

    const vast = open.wanneer !== 'nu';
    // Uit, nu: meteen uit, zonder hoe lang (7 november 2026).
    const meteenUit = !vast && !open.aan;
    const totMs = stekkerTot(open);
    const klok = klokVan(totMs);
    const wat = seg(t('hand.watWil'), [
      ['aan', t('hand.stekkerZetAanKort'), open.aan, 'data-st-aan'],
      ['uit', t('hand.stekkerZetUitKort'), !open.aan, 'data-st-aan'],
    ]);
    const lang = seg(t('hand.hoeLang'), [
      ['m30', t('hand.min30'), open.tot === 'm30', 'data-st-tot'],
      ['u1', t('hand.uur1'), open.tot === 'u1', 'data-st-tot'],
      ['u2', t('hand.uur2'), open.tot === 'u2', 'data-st-tot'],
      vast ? ['u4', t('hand.uur4'), open.tot === 'u4', 'data-st-tot'] : ['tijd', t('hand.totEenTijd'), open.tot === 'tijd', 'data-st-tot'],
    ]);
    const wanneer = seg(t('hand.wanneer'), [
      ['nu', t('hand.stekkerNu'), open.wanneer === 'nu', 'data-st-wanneer'],
      ['dag', t('gp.h.dag'), open.wanneer === 'dag', 'data-st-wanneer'],
      ['werkdagen', t('gp.h.werkdagen'), open.wanneer === 'werkdagen', 'data-st-wanneer'],
      ['weekend', t('gp.h.weekend'), open.wanneer === 'weekend', 'data-st-wanneer'],
    ]);
    // Een keuzelijst met tijden, geen klok: op een Android-wand ging Instellen pas na het toetsenbord (7 november 2026).
    const tijd = !meteenUit && !vast && open.tot === 'tijd' ? `<label class="veldnaam">${esc(t('hand.totHoeLaat'))}${tijdKeuze(open.tijd, 'data-st-tijd', true)}</label>` : '';
    const om = vast ? `<div class="hand-vraag"><span>${esc(t('hand.om'))}</span>${tijdKeuze(open.om, `data-st-om aria-label="${esc(t('hand.omHoeLaat'))}"`, false, 'hand-om')}</div>` : '';
    const duur = t(`tk.duur.${ST_TK[open.tot] ?? 'uur1'}`).trim();
    const hoe = vast
      ? t(open.aan ? 'hand.stekkerVastAan' : 'hand.stekkerVastUit', { wanneer: t(`hand.vast.${open.wanneer}`), klok: open.om, duur })
      : meteenUit
        ? [t('hand.stekkerMeteenUit'), s.zon?.schakelt ? t('hand.stekkerMeteenUitZon') : ''].filter(Boolean).join(' ')
        : t('hand.stekkerDaarna', { klok });
    const taken = takenVan(s.id);
    const lijst = taken.length
      ? `<div class="hand-vast"><span>${esc(t('hand.stekkerVast'))}</span>${taken.map((g) => `<div><p><b>${esc(g.tekst)}</b><small>${esc([g.opdracht?.herhaal ? t(`gp.h.${g.opdracht.herhaal.soort}`) : '', t('hand.stekkerVolgende', { klok: klokVan(g.ms) })].filter(Boolean).join(' · '))}</small></p><button type="button" data-st-weg="${esc(g.id)}" aria-label="${esc(t('hand.stekkerVastWeg', { naam: g.tekst }))}">×</button></div>`).join('')}</div>`
      : '';
    const terugKnop = s.actief && !vast ? `<button type="button" class="hand-terug" data-st-terug>${esc(t('hand.stekkerTerug'))}</button>` : '';
    const knopTekst = vast
      ? t('hand.stekkerBewaar', { wanneer: t(`hand.vast.${open.wanneer}`).toLowerCase(), klok: open.om })
      : meteenUit
        ? t('hand.stekkerZetUitKort')
        : t(open.aan ? 'hand.stekkerZetAan' : 'hand.stekkerZetUit', { klok });
    return `${kop}
      <div class="hand-vraag"><span>${esc(t('hand.watWil'))}</span>${wat}</div>
      ${meteenUit ? '' : `<div class="hand-vraag"><span>${esc(t('hand.hoeLang'))}</span>${lang}</div>`}
      ${tijd}
      <div class="hand-vraag"><span>${esc(t('hand.wanneer'))}</span>${wanneer}</div>
      ${om}
      ${vast || meteenUit ? '' : dagbalk(totMs, t(open.aan ? 'hand.stekkerBalkAan' : 'hand.stekkerBalkUit', { klok }))}
      <div class="hand-hoe">${esc(hoe)}</div>
      ${zon}
      ${lijst}
      ${fout ? `<p class="hand-fout">${esc(fout)}</p>` : ''}
      <div class="hand-onder">${terugKnop}<button type="button" class="hand-zet" data-st-zet ${s.mag ? '' : 'disabled'}>${esc(knopTekst)}</button></div>
      ${intrekken}`;
  }

  /**
   * Toestaan of weer intrekken, in het blad (besluit 290): SunArc mag de stekker
   * met de hand en op vaste tijden schakelen. Bewaard bij de aansluiting, met de
   * rest zoals het was.
   */
  async function stekkerToestaan(id, ja) {
    let a = null;
    try {
      a = (await haal('api/aansluiting'))?.antwoorden ?? null;
    } catch {
      a = null;
    }
    const res = a
      ? await deur('api/aansluiting', { panelen: a.panelen, zekering: a.zekering, tarief: a.tarief, verwarming: a.verwarming, voorkantZon: a.voorkantZon, dak: a.dak, elders: a.elders ?? {}, opZon: a.opZon ?? {}, opZonUit: a.opZonUit ?? [], bedienen: { [id]: ja } })
      : null;
    if (!res || !res.ok) {
      fout = (res ? (await res.json().catch(() => null))?.fout : null) ?? t('hand.lukteNiet');
      return false;
    }
    fout = '';
    await laadStekkers();
    global.dispatchEvent(new CustomEvent('handveranderd'));
    return true;
  }

  /**
   * Een tijd kiezen uit een lijst per kwartier (7 november 2026): een veld met
   * een klok vroeg op een Android-wand eerst om het toetsenbord. `vanafNu`
   * begint bij het volgende kwartier, voor "tot hoe laat".
   */
  function tijdKeuze(huidig, attr, vanafNu, klasse = '') {
    const twee = (n) => String(n).padStart(2, '0');
    const nu = new Date();
    const start = vanafNu ? Math.ceil((nu.getHours() * 60 + nu.getMinutes() + 1) / 15) : 0;
    const tijden = Array.from({ length: 96 }, (_, i) => {
      const m = ((start + i) % 96) * 15;
      return `${twee(Math.floor(m / 60))}:${twee(m % 60)}`;
    });
    if (huidig && !tijden.includes(huidig)) tijden.unshift(huidig);
    return `<select class="invoer${klasse ? ` ${klasse}` : ''}" ${attr}>${tijden.map((x) => `<option value="${x}" ${x === huidig ? 'selected' : ''}>${x}</option>`).join('')}</select>`;
  }

  /** De vaste taken ophalen, voor de lijst in het blad. */
  async function laadTaken() {
    try {
      stekkerTaken = (await haal('api/te-doen'))?.gepland ?? [];
    } catch {
      stekkerTaken = [];
    }
  }

  /** Een stekker vast elke dag, op werkdagen of in het weekend: een taak bij Vast en gepland (besluit 268). */
  async function bewaarVast(s) {
    const [uur, minuut] = String(open.om).split(':').map(Number);
    const res = await deur('api/te-doen', {
      actie: 'plan',
      tekst: t(open.aan ? 'pl.wat.stekker' : 'pl.wat.plugUit', { naam: s.naam }),
      stappen: [{ pad: 'api/stekker', body: { id: s.id, aan: open.aan, duurMin: ST_DUUR[open.tot] ?? 60 } }],
      moment: { soort: 'tijd', uur: uur || 0, minuut: minuut || 0 },
      herhaal: { soort: open.wanneer },
      overslaanWeg: false,
      aan: true,
    });
    if (!res) return false;
    if (!res.ok) {
      fout = (await res.json().catch(() => null))?.fout ?? t('gp.lukteNiet');
      return false;
    }
    fout = '';
    await laadTaken();
    open.wanneer = 'nu';
    open.tot = 'u1';
    return true;
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
    await Promise.all([laadStekkers(), laadTaken()]);
    const s = stekkerVan(id);
    if (!s) return;
    open = { st: id, aan: s.actief ? s.actief.aan : s.aan !== true, tot: 'u1', tijd: '22:00', wanneer: 'nu', om: '07:00' };
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
      ${slotHtml(d.id, d.naam)}
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
    // Een vrij blad (besluit 298): de pagina zegt de naam, de zin en wat erin staat.
    const vrij = open.vrij ? open.vrij() : null;
    if (open.vrij && !vrij) {
      open = null;
      laag.remove();
      return;
    }
    const naam = vrij ? vrij.naam : open.wg ? open.wg.naam : open.st ? stekkerVan(open.st)?.naam ?? '' : vind(open.id)?.naam ?? '';
    laag.setAttribute('aria-label', naam);
    const st = open.st ? stekkerVan(open.st) : null;
    const inhoud = vrij ? `${kopVan(vrij.naam, vrij.zin)}${vrij.html}` : open.wg ? witgoedBlad(open.wg) : open.st ? (st ? stekkerBlad(st) : '') : (() => {
      const a = vind(open.id);
      return a ? blad(a, true) : '';
    })();
    laag.innerHTML = `<div class="hand-achter" data-hand-sluit></div><div class="hand-vel"><section class="glas hand-blad">${inhoud}</section></div>`;
    global.dispatchEvent(new CustomEvent('handblad', { detail: { id: open.wg ? open.wg.id : open.st ?? open.vrijId ?? open.id } }));
  }

  /**
   * Een vrij blad (besluit 298): voor een lamp, de boiler, de thuisaccu of een
   * schakelaar bij Apparaten. `maak` geeft `{ naam, zin, html }` (of null: dan
   * gaat het dicht) en wordt bij elk verversen opnieuw gevraagd; de knoppen
   * erin handelt de pagina zelf af.
   */
  function openVrij(id, maak) {
    open = { vrij: maak, vrijId: id };
    fout = '';
    teken();
  }
  /** Het open vrije blad opnieuw tekenen, als er iets veranderde. */
  function verfris() {
    if (open?.vrij) teken();
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
    await laadSloten();
    return data;
  }

  /** Opent het blad van een klimaatapparaat, als eigen laag (Apparaten). */
  async function openen(id) {
    if (!data) await laad();
    if (!data) return;
    open = begin(id);
    fout = '';
    teken();
    metHelpen(vind(id));
  }

  /** Het blad van een klimaatapparaat in een plek op de pagina (het blad van een kamer); een tweede keer blijft de keuze staan. */
  function inPlek(el, id) {
    if (!data || !vind(id)) return false;
    if (!(open?.plek && open.id === id)) {
      open = begin(id, el);
      fout = '';
      metHelpen(vind(id));
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
    await laadSloten();
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
    // Het kinderslot (besluit 299): meteen, los van "Zet op".
    if ((x = el('[data-slot]'))) {
      if (x.disabled) return;
      const aan = x.getAttribute('aria-checked') !== 'true';
      slotWens.set(x.dataset.slot, aan);
      teken();
      await deur('api/kinderslot', { slot: x.dataset.slot, aan }).catch(() => null);
      setTimeout(async () => {
        await laadSloten();
        slotWens.delete(x.dataset.slot);
        teken();
      }, 2500);
      return;
    }
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
    else if ((x = el('[data-st-wanneer]'))) {
      // Nu kent "tot een tijd", vast kent vier uur: wat er niet bij hoort, wordt een uur.
      open.wanneer = x.dataset.stWanneer;
      if ((open.wanneer === 'nu' && open.tot === 'u4') || (open.wanneer !== 'nu' && open.tot === 'tijd')) open.tot = 'u1';
    } else if ((x = el('[data-st-weg]'))) {
      const res = await deur('api/te-doen', { actie: 'annuleer', id: x.dataset.stWeg });
      if (res && !res.ok) fout = (await res.json().catch(() => null))?.fout ?? t('gp.lukteNiet');
      await laadTaken();
    } else if ((x = el('[data-st-toestaan]'))) {
      x.disabled = true;
      await stekkerToestaan(open.st, x.dataset.stToestaan === 'ja');
    } else if (el('[data-st-terug]')) {
      if (await stuur('api/stekker', { id: open.st, terug: true })) open = null;
    } else if (el('[data-st-zet]') && open.wanneer !== 'nu') {
      const s = stekkerVan(open.st);
      if (s) await bewaarVast(s);
    } else if (el('[data-st-zet]') && !open.aan) {
      // Uit is meteen uit, zonder eind (7 november 2026).
      if (await stuur('api/stekker', { id: open.st, aan: false, meteen: true })) open = null;
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
    // Een stekker met de hand (besluit 265): aan met de hand zegt Zet uit, uit met de hand Zet aan (7 november 2026).
    const stek = (stekkers?.stekkers ?? []).filter((s) => s.actief).map((s) => `<div class="nu-regel"><span class="ik">${iconen.svg('stekker')}</span><div><b>${esc(s.naam)}</b><span>${esc(t(s.actief.aan ? 'hand.stekkerAanTot' : 'hand.stekkerUitTot', { klok: klokVan(s.actief.totMs) }))}</span></div>${stekkers?.aan ? `<button type="button" data-nu-stekker="${esc(s.id)}" data-nu-aan="${s.actief.aan}">${esc(t(s.actief.aan ? 'hand.stekkerZetUitKort' : 'hand.stekkerZetAanKort'))}</button>` : ''}</div>`);
    return [...klimaat, ...stek, ...wit].join('');
  }
  document.addEventListener('click', async (e) => {
    const k = e.target.closest('[data-nu-terug]');
    const s = e.target.closest('[data-nu-stekker]');
    if (!k && !s) return;
    (k ?? s).disabled = true;
    if (k) await stuur('api/hand', { id: k.dataset.nuTerug, terug: true });
    // Aan met de hand: meteen uit. Uit met de hand: terug zoals hij was, dus weer aan.
    else await stuur('api/stekker', s.dataset.nuAan === 'true' ? { id: s.dataset.nuStekker, aan: false, meteen: true } : { id: s.dataset.nuStekker, terug: true });
  });
  // De tijd van een stekker: bij het verlaten van het veld, zodat typen niet onderbroken wordt.
  document.addEventListener('change', (e) => {
    const v = e.target.closest?.('[data-st-tijd]');
    const om = e.target.closest?.('[data-st-om]');
    if ((!v && !om) || !open?.st) return;
    if (v) open.tijd = v.value || open.tijd;
    else if (/^\d\d:\d\d$/.test(om.value)) open.om = om.value;
    teken();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open && !open.plek) {
      open = null;
      teken();
    }
  });

  global.hand = { laad, laadNu, nuHtml, openen, inPlek, openWitgoed, openStekker, openVrij, verfris, vrijOpen: () => open?.vrijId ?? null, laadStekkers, stekker: stekkerVan, stekkerZin, bij, data: () => data, nuZin, sluit: () => { open = null; teken(); } };
})(window);
