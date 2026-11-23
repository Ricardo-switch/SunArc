/*
 * De motor (schets, 23 november 2026; kwaliteitsronde stap 4 punt 4, rapport "De schaduwpagina wordt De motor").
 *
 * Eén regel blijft: hier wordt niets uitgerekend. Alles komt zoals de kern het meegeeft (api/state voor Nu,
 * api/divergence voor Vandaag en Vergelijken, api/thermisch en api/zon voor Geleerd). Wat de pagina wel doet is
 * vertalen: een vaste code krijgt een gewoon woord, en de code blijft er klein achter staan.
 *
 * Wat nieuw is tegenover de oude schaduwpagina: de fasen, de accu, wat met de hand is overgenomen, wat de
 * apparaten nu echt doen naast wat de motor stuurt, Geleerd (het thermisch model en de panelen), en Kopieer de
 * stand: het besluit van dit moment op het klembord, zonder namen of adressen, voor bij een melding.
 *
 * De gegevens hieronder zijn verzonnen (het voorbeeldhuis); de vorm is die van api/state op 23 november.
 */
(function () {
  'use strict';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const nl = (n, d = 1) => Number(n).toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d });
  const W = (n) => `${Math.round(n).toLocaleString('nl-NL')} W`;
  const ik = (n) => (window.iconen?.svg ? window.iconen.svg(n) : '');

  /* ------------------------------------------------------------ voorbeeld: één ronde van de kern */
  const ronde = {
    tijd: '09:41:23',
    trigger: 'wijziging',
    stand: { code: 'dag', woord: 'Dag', bron: 'schema', bronWoord: 'volgens het schema', thuis: true },
    buitenC: -4.7,
    zonW: 812,
    netW: 11,
    fasen: [{ id: 'L1', a: 4.2, max: 25 }],
    accu: { pct: 54, w: -900 },
    failsafe: { actief: false, onbetrouwbaar: [] },
    budget: { beschikbaar: 1199, toegewezen: 900, overschot: 0, terug: 900 },
    zones: [
      { naam: 'Woonkamer', t: 19.9, doel: 20, vraag: 'warm', code: 'zone_below_setpoint', zin: 'onder het doel' },
      { naam: 'Zolder', t: 19.3, doel: 19, vraag: null, code: 'zone_satisfied', zin: 'op temperatuur' },
      { naam: 'Badkamer', t: 18.5, doel: 18, vraag: null, code: 'zone_satisfied', zin: 'op temperatuur' },
    ],
    besluit: [
      { naam: 'Airco woonkamer', ik: 'airco', actie: 'heat', woord: 'Verwarmen', w: 900, regel: 'pv-surplus', regelWoord: 'helpt op zon', prio: 2, nu: 'heat@18', nuWoord: 'staat op 18°: wacht' },
      { naam: 'Nest (beneden)', ik: 'thermostaat', actie: 'heat', woord: 'Verwarmen', w: 0, regel: 'comfort', regelWoord: 'houdt op temperatuur', prio: 1, nu: 'heat@20', nuWoord: 'verwarmt naar 20°' },
      { naam: 'Radiatorknop keuken', ik: 'verwarming', actie: 'heat', woord: 'Volgt de Nest', w: 0, regel: 'volgt', regelWoord: 'volgt de Nest', prio: 1, nu: 'heat@20', nuWoord: 'staat stil' },
    ],
    afgewezen: [
      { naam: 'Badkamer', ik: 'warm', actie: 'heat', code: 'insufficient_power_budget', zin: 'te weinig zon over: vraagt 1.150 W, er is 299 W' },
      { naam: 'Airco woonkamer', ik: 'airco', actie: 'off', code: 'min_run_not_elapsed', zin: 'moet nog even aan blijven: minimaal aan tot 09:51' },
      { naam: 'Airco zolder', ik: 'airco', actie: 'heat', code: 'min_rest_not_elapsed', zin: 'rust nog: mag weer aan om 09:44' },
    ],
    hand: [],
    // Op zon, naast de motor: wat los van het besluit op zon draait (stekkers op zon, warmtebuffers, uitstelbaar witgoed).
    ernaast: [
      { naam: 'Infraroodpaneel tuinhuis', ik: 'stekker', tag: ['zon', 'op zon'], zin: 'uit · gaat aan bij 450 W over, nu 299 W', code: 'stekker-zon' },
      { naam: 'Boiler', ik: 'boiler', tag: ['zon', 'buffer'], zin: '52°, naar 60° op zon · wacht op 2.000 W over', code: 'warmtebuffer' },
      { naam: 'Droger', ik: 'droger', tag: ['', 'uitstelbaar'], zin: 'meldt niets: geen meting', code: 'reading_unavailable' },
    ],
    oud: 'PV-verwarmen: Woonkamer (standby), minimaal aan tot 09:36',
  };

  /* ------------------------------------------------------------ voorbeeld: vandaag, per kwartier */
  const NU_KW = 38; // 09:30
  const vul = (rij) => Array.from({ length: 96 }, (_, i) => (i > NU_KW ? 'leeg' : rij(i)));
  const vandaag = [
    { naam: 'Zon', cellen: vul((i) => (i >= 32 && i <= NU_KW ? 'zon' : '')) },
    { naam: 'Net', cellen: vul((i) => (i < 32 ? 'net half' : i >= 33 && i <= 35 ? 'net' : '')) },
    { naam: 'Thuisaccu', cellen: vul((i) => (i >= 24 && i <= 31 ? 'accu' : i >= 36 ? 'accu half' : '')) },
    { scheid: true },
    { naam: 'Nest (beneden)', cellen: vul((i) => (i >= 24 && i <= 31 ? 'heat' : i >= 32 ? 'stil' : '')) },
    { naam: 'Airco woonkamer', cellen: vul((i) => (i >= 33 && i <= 34 ? 'heat' : i >= 35 ? 'stil' : '')) },
    { naam: 'Airco zolder', cellen: vul((i) => (i === 34 ? 'heat' : '')) },
    { naam: 'Badkamer', cellen: vul((i) => (i >= 26 && i <= 29 ? 'heat' : '')) },
    { scheid: true },
    { naam: 'Oude regeling', cellen: vul((i) => (i >= 24 && i <= 31 ? 'oud' : i >= 33 && i <= 35 ? 'oud' : '')) },
  ];
  /*
   * Een ronde terugkijken: de dienst bewaart elke ronde (om de 15 seconden) in het logboek van die dag; een nieuw
   * adres geeft één ronde terug (api/motor/ronde?t=…). Tik een blokje voor dat kwartier, en blader met de knoppen
   * door de zestig rondes erin. Hieronder vier rondes waar iets gebeurde; de andere zeggen dat er niets veranderde.
   */
  const RONDES = {
    27: { n: 2, regels: [['Stand', 'Dag, net begonnen'], ['Zou sturen', 'Badkamer → verwarmen naar 18°'], ['Waarom', 'komt anders om 07:00 niet op 18°: koelt 0,15°/u, nu 17,4°'], ['Oude regeling', 'Badkamer nog uit tot 07:00'], ['Verschil', 'De motor zou een kwartier eerder beginnen']] },
    32: { n: 27, regels: [['Zon', '290 W, net 640 W'], ['Te verdelen', '290 W, niets toegewezen'], ['Wees af', 'Airco woonkamer verwarmen: vraagt 900 W, er is 290 W'], ['Oude regeling', 'Woonkamer en zolder verwarmen op zon'], ['Verschil', 'De oude regeling zette de woonkamer aan; de motor zou wachten']] },
    34: { n: 27, regels: [['Zon', '387 W, net 11 W'], ['Te verdelen', '387 W, niets toegewezen'], ['Wees af', 'Airco zolder verwarmen: vraagt 600 W, er is 387 W'], ['Oude regeling', 'Zolder verwarmen op zon'], ['Verschil', 'De oude regeling zette de zolder aan; de motor zou wachten']] },
    38: { n: 46, regels: [['Zon', '812 W, net 11 W'], ['Te verdelen', '1.199 W, 900 W toegewezen'], ['Zou sturen', 'niets nieuws: Airco woonkamer blijft aan'], ['Wees af', 'Badkamer verwarmen: te weinig zon over'], ['Oude regeling', 'Woonkamer standby']] },
  };
  let gekozen = 34;
  let stap = 0;
  const klokVanKw = (kw, n) => {
    const t = kw * 900 + (n - 1) * 15;
    return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  };

  /* ------------------------------------------------------------ voorbeeld: geleerd en vergelijken */
  const seizoenen = [
    { naam: 'Winter', dagen: 0, nodig: 30, kleur: 'var(--ijs)' },
    { naam: 'Voorjaar', dagen: 21, nodig: 21, kleur: 'var(--mint)' },
    { naam: 'Zomer', dagen: 28, nodig: 21, kleur: 'var(--zon)' },
    { naam: 'Najaar', dagen: 24, nodig: 21, kleur: 'var(--gloed)' },
  ];
  const nogNooit = ['Afwezig', 'Vakantie'];
  const thermisch = [
    { naam: 'Woonkamer', koelt: 0.09, zeker: 'zeker', dagen: 34 },
    { naam: 'Zolder', koelt: 0.12, zeker: 'zeker', dagen: 34 },
    { naam: 'Badkamer', koelt: null, zeker: 'nog te weinig', dagen: 6 },
  ];
  const eens = { totaal: 87, apparaten: [['Nest (beneden)', 96], ['Airco woonkamer', 78], ['Airco zolder', 84], ['Badkamer', 91]] };
  const momenten = [
    ['08:36', 'Airco zolder', 'De oude regeling zette hem op zon aan; de motor zou wachten: 387 W zon, de airco vraagt 600 W.'],
    ['08:06', 'Airco woonkamer', 'De oude regeling zette hem op zon aan; de motor zou wachten: 290 W zon, de airco vraagt 900 W.'],
    ['06:45', 'Badkamer', 'De motor zou hem een kwartier eerder aanzetten: hij komt anders om 07:00 niet op 18°.'],
    ['00:15', 'Airco woonkamer', 'De oude regeling liet hem op standby; de motor zou hem uitzetten (nacht, niets te doen).'],
  ];
  const vermogens = [
    ['Airco woonkamer', '900 W', 'gemeten'],
    ['Airco zolder', '600 W', 'gemeten'],
    ['Badkamer', '1.150 W', 'ingesteld'],
    ['Boiler', '2.000 W', 'ingesteld'],
  ];

  /* ------------------------------------------------------------ tekenen */
  const DELEN = [['nu', 'Nu'], ['vandaag', 'Vandaag'], ['geleerd', 'Geleerd'], ['vergelijken', 'Vergelijken']];
  let deel = new URLSearchParams(location.search).get('deel') ?? 'nu';
  if (!DELEN.some(([d]) => d === deel)) deel = 'nu';
  const rij = (wat, waarde, code, onder) => `<div class="mo-rij"><span>${esc(wat)}</span><b>${waarde}</b>${code || onder ? `<em>${onder ? esc(onder) : ''}${code ? ` <code>${esc(code)}</code>` : ''}</em>` : ''}</div>`;
  const tag = (soort, tekst) => `<span class="mo-tag ${soort}">${esc(tekst)}</span>`;

  function tekenNu() {
    const r = ronde;
    const b = r.budget;
    const meet = `<section class="glas mo-kaart" style="--o: 4"><h2>Wat hij meet <small>ronde ${esc(r.tijd)}</small></h2>
      ${rij('Stand', esc(r.stand.woord), r.stand.code, `${r.stand.bronWoord}${r.stand.thuis ? ', iemand thuis' : ', niemand thuis'}`)}
      ${rij('Buiten', `${nl(r.buitenC)}°`)}
      ${rij('Zon', W(r.zonW))}
      ${rij('Net', `${W(r.netW)} van het net`)}
      ${r.fasen.map((f) => `<div class="mo-rij"><span>Fase ${esc(f.id)}</span><b>${nl(f.a)} A <small style="color: var(--gedempt); font-weight: 600">van ${f.max} A</small></b><div class="mo-balk"><i style="width: ${(f.a / f.max) * 100}%; background: var(--violet)"></i></div></div>`).join('')}
      ${r.accu ? `<div class="mo-rij"><span>Thuisaccu</span><b>${r.accu.pct}% · levert ${nl(-r.accu.w / 1000)} kW</b><div class="mo-balk"><i style="width: ${r.accu.pct}%; background: var(--mint)"></i></div></div>` : ''}
      <div class="mo-veilig">${r.failsafe.actief ? tag('nee', 'terugvallen actief') : tag('goed', 'terugvallen niet nodig')}${r.failsafe.onbetrouwbaar.length ? tag('nee', 'meting twijfelt') : tag('goed', 'metingen betrouwbaar')}${tag('', r.hand.length ? `met de hand: ${r.hand.join(', ')}` : 'niets met de hand')}</div>
    </section>
    <section class="glas mo-kaart" style="--o: 5"><h2>Op zon, naast de motor <small>los van het besluit</small></h2>
      ${r.ernaast.map((x) => `<div class="mo-besluit"><span class="ik">${ik(x.ik)}</span><b>${esc(x.naam)}</b>${tag(x.tag[0], x.tag[1])}<span class="zin">${esc(x.zin)} <code>${esc(x.code)}</code></span></div>`).join('')}
    </section>
    <section class="glas mo-kaart" style="--o: 6"><h2>De oude regeling <small>tot de overstap</small></h2><p class="mo-zin" style="margin: 0">${esc(r.oud)}</p></section>`;

    const delen = [['Airco woonkamer', 900, 'var(--gloed)']];
    const verdeel = `<section class="glas mo-kaart" style="--o: 3"><h2>Wat er te verdelen is <small>budget</small></h2>
      <div class="mo-groot">${Math.round(b.beschikbaar).toLocaleString('nl-NL')}<small>W</small></div>
      <div class="mo-stapel">${delen.map(([n, w, k]) => `<i style="width: ${(w / b.beschikbaar) * 100}%; background: ${k}">${w >= 300 ? esc(n) : ''}</i>`).join('')}</div>
      <div class="mo-leg">${delen.map(([n, w, k]) => `<span style="--k: ${k}">${esc(n)} ${W(w)}</span>`).join('')}<span style="--k: rgb(255 255 255 / 0.15)">vrij ${W(b.beschikbaar - b.toegewezen)}</span></div>
      <div style="margin-top: 8px">${rij('Toegewezen', W(b.toegewezen), 'allocatedW')}${rij('Overschot', W(b.overschot), 'surplusW')}${rij('Terug te halen', W(b.terug), 'reclaimableW', 'als hij iets uitzet')}</div>
    </section>
    <section class="glas mo-kaart mo-vul" style="--o: 2"><h2>Wat elke kamer vraagt</h2>
      ${r.zones.map((z) => `<div class="mo-kamer"><b>${esc(z.naam)}</b><span class="t">${nl(z.t)}° <small>naar ${nl(z.doel)}°</small></span><span>${z.vraag === 'warm' ? tag('warm', 'vraagt warmte') : z.vraag === 'koel' ? tag('koel', 'vraagt koelte') : tag('', 'vraagt niets')} ${esc(z.zin)} <code>${esc(z.code)}</code></span></div>`).join('')}
    </section>`;

    const besluit = `<section class="glas mo-kaart mo-vul" style="--o: 1"><h2>Wat hij besluit <small>zou doen · kijkt mee</small></h2>
      ${r.besluit.map((x) => `<div class="mo-besluit"><span class="ik">${ik(x.ik)}</span><b>${esc(x.naam)}</b>${tag(x.actie === 'heat' ? 'warm' : x.actie === 'cool' ? 'koel' : '', x.woord)}<span class="zin">${esc(x.regelWoord)}${x.w ? ` · ${W(x.w)}` : ''} · voorrang ${x.prio} <code>${esc(x.regel)}</code><br>Nu: ${esc(x.nuWoord)} <code>${esc(x.nu)}</code></span></div>`).join('')}
      <div class="mo-tussen">Afgewezen</div>
      ${r.afgewezen.map((x) => `<div class="mo-besluit"><span class="ik">${ik(x.ik)}</span><b>${esc(x.naam)}</b>${tag('nee', x.actie === 'off' ? 'Uit: nee' : 'Aan: nee')}<span class="zin">${esc(x.zin)} <code>${esc(x.code)}</code></span></div>`).join('')}
    </section>`;
    return `<div class="mo-kol">${meet}</div><div class="mo-kol">${verdeel}</div><div class="mo-kol">${besluit}</div>`;
  }

  function tekenVandaag() {
    const regels = vandaag
      .map((x) => (x.scheid ? '<div class="scheid"></div>' : `<span class="naam">${esc(x.naam)}</span><div class="rij">${x.cellen.map((c, i) => `<i class="${c}" data-kw="${i}"></i>`).join('')}${x.naam === 'Zon' ? `<span class="mo-nu" style="left: calc(${((NU_KW + 1) / 96) * 100}% - 1px)"></span>` : ''}<span class="mo-gekozen" style="left: calc(${(gekozen / 96) * 100}% - 2px); width: calc(${100 / 96}% + 2px)"></span></div>`))
      .join('');
    const as = `<span></span><div class="as">${['00', '03', '06', '09', '12', '15', '18', '21', '24'].map((u) => `<span>${u}</span>`).join('')}</div>`;
    const tijdlijn = `<section class="glas mo-kaart" style="flex: 1"><h2>Elke ronde van vandaag <small>per kwartier · tik een blokje</small></h2>
      <div class="mo-tijd">${regels}${as}</div>
      <div class="mo-leg" style="margin-top: 14px"><span style="--k: var(--gloed)">verwarmt</span><span style="--k: color-mix(in srgb, var(--gloed) 35%, transparent)">aan, staat stil</span><span style="--k: var(--ijs)">koelt</span><span style="--k: var(--zon)">zon</span><span style="--k: var(--violet)">van het net</span><span style="--k: var(--mint)">accu levert</span><span style="--k: color-mix(in srgb, var(--violet) 70%, transparent)">de oude regeling doet iets</span></div>
      <p class="mo-zin">Wat de motor op elk kwartier zou sturen, naast wat de oude regeling deed. Tik een blokje voor die ronde: wat hij mat, verdeelde, besloot en afwees.</p>
    </section>`;
    const r = RONDES[gekozen];
    const n = Math.min(60, Math.max(1, (r?.n ?? 1) + stap));
    const blad = r && stap === 0 ? r.regels : [['Wat er gebeurde', 'niets veranderd tegenover de ronde ervoor'], ['Zou sturen', 'niets'], ['Oude regeling', 'zoals ervoor']];
    const detail = `<section class="glas mo-kaart"><h2>Ronde ${esc(klokVanKw(gekozen, n))} <small>${n} van 60 in dit kwartier</small></h2>
      <div class="mo-blader"><button type="button" data-stap="-1" ${n <= 1 ? 'disabled' : ''}>15 s eerder</button><button type="button" data-stap="1" ${n >= 60 ? 'disabled' : ''}>15 s later</button></div>
      ${blad.map(([a, b]) => `<div class="mo-rij onder"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}
      <p class="mo-zin">Uit het logboek van vandaag: precies wat de motor toen meegaf, niets nagerekend.</p></section>`;
    return `<div class="mo-kol">${tijdlijn}</div><div class="mo-kol">${detail}</div>`;
  }

  function tekenGeleerd() {
    const ds = `<section class="glas mo-kaart"><h2>Wat de motor al meemaakte <small>dagen per seizoen</small></h2>
      ${seizoenen.map((s) => `<div class="mo-seizoen"><span>${esc(s.naam)}</span><div class="mo-balk"><i style="width: ${Math.min(100, (s.dagen / s.nodig) * 100)}%; background: ${s.kleur}"></i></div><b>${s.dagen}/${s.nodig}</b></div>`).join('')}
      <p class="mo-zin">De dertig winterdagen beginnen op 1 december. Daarna weet de motor genoeg om zelf te regelen.</p></section>`;
    const nooit = `<section class="glas mo-kaart"><h2>Nog nooit gezien <small>standen</small></h2>
      <div style="display: flex; gap: 8px; flex-wrap: wrap">${nogNooit.map((n) => tag('', n)).join('')}</div>
      <p class="mo-zin">Zet het huis in december een dag op Afwezig en een dag op Vakantie, dan heeft de motor ze een keer meegemaakt.</p></section>`;
    const th = `<section class="glas mo-kaart"><h2>Hoe snel elke kamer afkoelt <small>thermisch model</small></h2>
      ${thermisch.map((k) => rij(k.naam, k.koelt == null ? '<span style="color: var(--gedempt)">nog te weinig</span>' : `${nl(k.koelt, 2)}°/u`, null, k.koelt == null ? `${k.dagen} dagen gemeten` : `bij 10° buiten · ${k.dagen} dagen gemeten`)).join('')}
      <p class="mo-zin">Leert van de nachten zonder verwarming. De regeling gebruikt het nog niet.</p></section>`;
    const pan = `<section class="glas mo-kaart"><h2>De panelen <small>ligging</small></h2>
      ${rij('Daken', '2')}${rij('Richting', 'zuidwest en noordoost')}${rij('Hoogste gemeten', '3,2 kW')}${rij('Vandaag verwacht', '3,7 kWh')}</section>`;
    const verm = `<section class="glas mo-kaart mo-breed2"><h2>Wat elk apparaat vraagt <small>voor het verdelen</small></h2>
      ${vermogens.map(([n, w, h]) => rij(n, w, null, h === 'gemeten' ? 'gemeten met zijn stroommeter' : 'ingesteld: geen stroommeter')).join('')}
      <p class="mo-zin">Zo weet de motor of er genoeg zon over is om iets aan te zetten. Gemeten wint van ingesteld.</p></section>`;
    return `${ds}${nooit}${th}${pan}${verm}`;
  }

  function tekenVergelijken() {
    const groot = `<section class="glas mo-kaart"><h2>Eens met de oude regeling <small>per kwartier, deze week</small></h2>
      <div class="mo-pct">${eens.totaal}<small>%</small></div>
      <p class="mo-zin">Op 87 van de 100 kwartieren zou de motor hetzelfde doen als de oude regeling. Na de overstap staat hier: hoe vaak een apparaat deed wat de motor vroeg.</p></section>`;
    const per = `<section class="glas mo-kaart"><h2>Per apparaat</h2>${eens.apparaten.map(([n, p]) => `<div class="mo-staaf"><span>${esc(n)}</span><div class="mo-balk"><i style="width: ${p}%; background: var(--mint)"></i></div><b>${p}%</b></div>`).join('')}</section>`;
    const net = `<section class="glas mo-kaart"><h2>Wat het zou schelen <small>deze week</small></h2>${rij('Netstroom minder', '4,2 kWh')}${rij('Vaker op eigen zon', '+11 kwartieren')}${rij('Minder vaak aan en uit', '6 keer')}</section>`;
    const mom = `<section class="glas mo-kaart mo-breed3"><h2>Waar ze verschilden <small>vandaag · tik voor die ronde</small></h2>${momenten.map(([t, n, z]) => `<div class="mo-moment"><time>${esc(t)}</time><span><b style="color: var(--tekst)">${esc(n)}</b> · ${esc(z)}</span></div>`).join('')}</section>`;
    return `${groot}${per}${net}${mom}`;
  }

  function teken() {
    document.querySelector('[data-delen]').innerHTML = DELEN.map(([d, n]) => `<button type="button" class="chip" aria-pressed="${d === deel}" data-naar="${d}">${esc(n)}</button>`).join('');
    document.querySelector('[data-onder]').innerHTML = `Kijkt mee: <b>zou doen</b> · elke 15 seconden een ronde · laatste om <b>${esc(ronde.tijd)}</b>`;
    const el = document.querySelector('[data-deel]');
    el.className = `mo-deel ${deel}`;
    el.innerHTML = deel === 'vandaag' ? tekenVandaag() : deel === 'geleerd' ? tekenGeleerd() : deel === 'vergelijken' ? tekenVergelijken() : tekenNu();
    // Op de telefoon schuift de tijdlijn opzij: het gekozen kwartier in beeld.
    const tl = el.querySelector('.mo-tijd');
    if (tl && tl.scrollWidth > tl.clientWidth) tl.scrollLeft = Math.max(0, ((gekozen + 4) / 96) * (tl.scrollWidth - 96) - tl.clientWidth + 96);
  }
  document.addEventListener('click', (e) => {
    const naar = e.target.closest?.('[data-naar]');
    if (naar) {
      deel = naar.dataset.naar;
      teken();
    }
    const kw = e.target.closest?.('[data-kw]');
    if (kw && Number(kw.dataset.kw) <= NU_KW) {
      gekozen = Number(kw.dataset.kw);
      stap = 0;
      teken();
    }
    const st = e.target.closest?.('[data-stap]');
    if (st) {
      stap += Number(st.dataset.stap);
      teken();
    }
    const k = e.target.closest?.('[data-kopie]');
    if (k) {
      k.textContent = 'Gekopieerd';
      k.classList.add('klaar');
      setTimeout(() => {
        k.textContent = 'Kopieer de stand';
        k.classList.remove('klaar');
      }, 1600);
    }
  });
  teken();
})();
