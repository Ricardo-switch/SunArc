/*
 * Thuis, in ontwerp 2 (besluit 104). De schets is de code: het huis komt uit
 * kit/huis.js, dezelfde tekenmotor als in design/app2. Deze pagina zet alleen
 * de gegevens van de dienst om naar de beschrijving van het huis; uitrekenen
 * doet de dienst (besluit 94).
 *
 * De wand is 800 hoog (1280 breed, of breder op een breed scherm) en wordt als geheel naar het scherm geschaald,
 * zodat er nooit gescrold hoeft te worden. Op een telefoon (staand, of heel smal)
 * staat dezelfde inhoud onder elkaar (besluit 159, schets Thuis-Tel), met de
 * Assistent in een vraagbalk die altijd boven de tabs staat.
 */
'use strict';
/* global blad, buitenKeuze, kaartGegevens, openWeer, tegel, teken, tekenBatterijen, tekenBuiten, tekenDeurbel, tekenDoetBlad, tekenFasen, tekenLading, tekenMaand, tekenMorgen, tekenSluip, tekenWeerknop */
/* exported $$, STAND_KLEUR, aansluiting, bewoners, bijnaOp, esc, getal, goedkoop, haal, huisData, huisModel, klok, klokVan, laadAlles, opmaak, paalNu, state, t, tekenNu, verbruikDag, vet, weer, zon */

const { $$, zet, esc, haal, deur, tijdVanDeDag, lucht, bijnaOp } = app;
// De teksten staan in kit/teksten.*.js (besluit 185); getallen en tijden in de taal van de app.
const { t, getal, klok, opmaak } = taal;
const vet = taal.html;

let state = null;
let huisData = null;
let zon = null;
let vandaag = null;
let weer = null;
/** De antwoorden bij Zon en aansluiting: hoeveel panelen er liggen. */
let aansluiting = null;
let gekozenZone = null;
/** De laadpaal voor zijn blad (issue 164): de auto, de plek, en wat Thuis uitrekende over zon en net. */
let paalNu = null;
/** Wie hier woont en wiens comfort geldt (besluit 147); null zonder bewoners. */
let bewoners = null;

/* ------------------------------------------------------- de gegevens */

let eersteKeer = true;

async function laadAlles() {
  const [s, h, z, v, w, a, b] = await Promise.allSettled([haal('api/state'), haal('api/huis'), haal('api/zon'), haal('api/vandaag'), haal('api/weer'), haal('api/aansluiting'), haal('api/bewoners'), eigen.laad()]);
  if (b.status === 'fulfilled') bewoners = b.value;
  if (s.status === 'fulfilled') state = s.value;
  if (h.status === 'fulfilled') huisData = h.value;
  if (z.status === 'fulfilled') zon = z.value;
  if (v.status === 'fulfilled') vandaag = v.value;
  if (w.status === 'fulfilled') weer = w.value;
  if (a.status === 'fulfilled') aansluiting = a.value;
  // De kaarten van besluit 182: alleen ophalen wat er gekozen is.
  await kaartGegevens();
  teken();
  // Te doen (besluit 216): de kaart, als er iets is.
  void window.tedoen?.laad();
  if (eersteKeer) eigen.vanInstellingen();
  // Met #batterijen meteen de lijst, ook als niets bijna leeg is (besluit 131).
  if (eersteKeer && location.hash === '#batterijen') {
    history.replaceState(null, '', location.pathname);
    openWeer(document.querySelector(app.telStand() ? '#tel [data-buiten]' : '#wand [data-buiten]'), 'batterij');
  }
  eersteKeer = false;
}

/* --------------------------------------- van de dienst naar het huis */

const { zoneNaam } = huismodel;
const kamerModel = (r) => huismodel.kamerModel(r, state);

function huisModel() {
  const s = state?.bewoner?.stromen ?? {};
  const zonKw = s.zonKw ?? 0;
  const netKw = s.netKw ?? 0;
  // De tekening zelf komt uit huismodel, net als op de andere pagina's (5S).
  // Huis 3.0 (besluit 187): de kelder onder de grond, op een eiland met het weer van nu.
  // Een lamp buiten die je net schakelde, staat in de tekening al zoals je koos (besluit 206).
  const tek = huismodel.tekening(buitenBlad.metGewenst(huisData), { kamer: kamerModel, zon });
  const { etages } = tek;
  const tijd = tijdVanDeDag(zon);
  const helder = zon?.heldereLuchtW ?? 0;
  const wolken = zon?.zon?.boven && helder > 300 ? (zonKw * 1000 < helder * 0.35 ? 0.8 : zonKw * 1000 < helder * 0.7 ? 0.4 : 0.1) : tijd === 'nacht' ? 0 : 0.3;
  const piekW = tek.piekW;
  // Hoe de panelen liggen, zoals bij Inrichten (besluit 166): per kant bij beide kanten.
  const opDak = huismodel.panelenOpDak(aansluiting?.antwoorden?.panelen, piekW);
  const elders = aansluiting?.antwoorden?.elders ?? {};
  const nuWeer = weer?.vandaag?.soort;

  const stromen = [];
  const koelend = etages.flatMap((e) => e.kamers).find((k) => k.apparaten.some((a) => a.soort === 'airco' && a.aan));
  if (zonKw > 0.05) stromen.push({ van: 'zon', naar: koelend ? `kamer:${koelend.naam}` : 'huis', sterkte: Math.min(1, zonKw / 3) });
  if (netKw < -0.05) stromen.push({ van: 'zon', naar: 'net', sterkte: Math.min(1, -netKw / 3) });
  if (netKw > 0.05) stromen.push({ van: 'net', naar: 'huis', sterkte: Math.min(1, netKw / 3) });
  // De thuisaccu (besluit 273): laden met zon als die er is, anders van het net; leveren gaat naar het huis.
  const accuKw = s.accuKw ?? 0;
  const metAccu = !!huisData?.opslag?.batterij;
  if (metAccu && accuKw > 0.05) stromen.push({ van: zonKw > 0.05 ? 'zon' : 'net', naar: 'batterij', sterkte: Math.min(1, accuKw / 3) });
  if (metAccu && accuKw < -0.05) stromen.push({ van: 'batterij', naar: koelend ? `kamer:${koelend.naam}` : 'huis', sterkte: Math.min(1, -accuKw / 3) });
  /*
   * De auto aan de laadpaal (issue 164): van de zon en het net naar de paal,
   * naar rato van waar de stroom van het huis nu vandaan komt; en terug naar
   * het huis als de auto levert.
   */
  const paalAuto = tek.auto && tek.auto.stand !== 'weg' ? tek.auto : null;
  const autoKw = (paalAuto?.vermogenW ?? 0) / 1000;
  let autoZon = 0;
  if (paalAuto && autoKw > 0.05) {
    const zonInHuis = Math.max(0, zonKw - Math.max(0, -netKw));
    const vanNet = Math.max(0, netKw);
    const deel = zonInHuis + vanNet > 0 ? zonInHuis / (zonInHuis + vanNet) : 0;
    autoZon = Math.min(autoKw, autoKw * deel);
    if (autoZon > 0.05) stromen.push({ van: 'zon', naar: 'auto', sterkte: Math.min(1, autoZon / 3) });
    if (autoKw - autoZon > 0.05) stromen.push({ van: 'net', naar: 'auto', sterkte: Math.min(1, (autoKw - autoZon) / 3) });
  }
  if (paalAuto && autoKw < -0.05) stromen.push({ van: 'auto', naar: 'huis', sterkte: Math.min(1, -autoKw / 3) });
  // De boiler (besluit 315, issue 168): verwarmt hij, dan loopt de stroom naar zijn kamer, van de zon of van het net.
  const water = huismodel.waterVan(huisData);
  const boiler = tek.boilerKamer ? (water.boiler?.a ?? null) : null;
  if (boiler?.aan) {
    const kw = (boiler.warmte.vermogenW ?? 0) / 1000;
    stromen.push({ van: boiler.warmte.opZon && zonKw > 0.05 ? 'zon' : 'net', naar: `kamer:${tek.boilerKamer}`, sterkte: kw > 0.05 ? Math.min(1, kw / 3) : 0.5 });
  }
  // Een tik op een lijn opent Stroom nu bij zijn bron (idee 135); de lijn naar de auto opent de laadpaal.
  for (const st of stromen) {
    const bron = st.naar === 'auto' ? null : st.van === 'zon' ? 'zon' : st.van === 'net' ? 'net' : st.van === 'batterij' ? 'accu' : null;
    if (bron) Object.assign(st, { tik: `stroom:${bron}`, tikLabel: t('stroom.label') });
    else if (st.naar === 'auto' || st.van === 'auto') Object.assign(st, { tik: 'laadpaal', tikLabel: t('paal.label') });
  }
  if (paalAuto) tek.auto = { ...paalAuto, bron: autoZon >= autoKw / 2 ? 'zon' : 'net', ...(paalAuto.stand === 'laadt' && autoKw <= 0.05 ? { stand: 'geparkeerd' } : {}) };
  // Een tik op de paal of de auto opent zijn blad (issue 164, idee 135).
  if (tek.auto) {
    tek.auto = { ...tek.auto, tik: 'laadpaal', tikLabel: t('paal.label') };
    const auto = (huisData?.opslag?.autos ?? []).find((a) => a.id === tek.auto.id);
    paalNu = auto ? { auto, plek: auto.paalPlek ?? 'oprit', kw: tek.auto.stand === 'weg' ? 0 : autoKw, zonKw: autoZon } : null;
    paalblad.bij(paalNu);
  } else paalNu = null;

  const labels = [];
  // Zonder slimme meter (besluit 196): bij de panelen wat er geschat over is, en geen label bij het net.
  const over = s.geschat && zonKw > 0.05 ? [t('thuis.label.overGeschat', { kw: getal(s.overKw ?? 0) })] : [];
  // Met meer dakvlakken (besluit 254, stap 5): een tik geeft per vlak wat het nu levert.
  const daken = aansluiting?.daken?.vlakken?.length ?? 0;
  const dakRegel = daken > 1 ? [t('thuis.label.daken', { n: daken })] : [];
  // Een tik op de panelen zelf opent ook De zon op je daken, niet de zolder.
  const dakenTik = daken > 1;
  if (zonKw > 0.05) labels.push({ bij: 'panelen', titel: `${getal(zonKw)} kW`, groot: true, toon: 'zon', regels: [t('thuis.label.panelen'), ...dakRegel, ...over], dx: 64, dy: -70, tik: 'stroom:zon', tikLabel: t('stroom.label') });
  // Bij de accu wat hij nu doet (besluit 273): laden in goud, leveren in ijsblauw, zoals de lijn.
  if (metAccu && Math.abs(accuKw) > 0.05) labels.push({ bij: 'batterij', titel: `${getal(Math.abs(accuKw))} kW`, toon: accuKw > 0 ? 'zon' : 'ijs', regels: [t(accuKw > 0 ? 'thuis.label.accuLaadt' : 'thuis.label.accuLevert')], dx: 54, dy: -40, tik: 'stroom:accu', tikLabel: t('stroom.label') });
  // Bij de laadpaal wat de auto nu laadt, en hoeveel van de zon (issue 164).
  const paalLabel = tek.auto;
  if (paalLabel && paalLabel.stand === 'laadt' && autoKw > 0.05) {
    const pctZon = Math.round((autoZon / autoKw) * 100);
    labels.push({ bij: 'laadpaal', titel: t('thuis.label.laadt', { kw: getal(autoKw) }), tik: 'laadpaal', tikLabel: t('paal.label'), toon: pctZon >= 50 ? 'zon' : 'violet', regels: [pctZon >= 5 ? t('thuis.label.laadtZon', { pct: pctZon }) : t('w.vanHetNet'), ...(paalLabel.procent != null ? [t('thuis.label.autoPct', { pct: paalLabel.procent })] : [])], dx: -30, dy: -96 });
  } else if (paalLabel && autoKw < -0.05) labels.push({ bij: 'laadpaal', titel: t('thuis.label.autoLevert', { kw: getal(-autoKw) }), toon: 'ijs', dx: -30, dy: -96 });
  // Van het net in violet, terug in groen: dezelfde kleur als de lijn (besluit 187).
  if (!s.geschat) labels.push({ bij: 'net', titel: netKw > 0.05 ? t('thuis.label.vanNet', { kw: getal(netKw) }) : netKw < -0.05 ? t('thuis.label.terug', { kw: getal(-netKw) }) : t('thuis.label.nietsNet'), toon: netKw > 0.05 ? 'violet' : 'mint', dx: 40, dy: 64, tik: 'stroom:net', tikLabel: t('stroom.label') });
  /*
   * Bij de boiler en de jacuzzi (besluit 315, issue 168): hoe warm hij is, waar
   * hij heen gaat en waarvan. Altijd, ook als hij niets doet: "60°, warm genoeg".
   */
  for (const [bij, x] of [['boiler', boiler], ['jacuzzi', tek.tuin?.jacuzzi ? (water.jacuzzi?.a ?? null) : null]]) {
    if (!x) continue;
    const w = x.warmte;
    const doel = w.doelC ?? (w.opZon ? w.zonC : w.minC);
    const kw = w.vermogenW ? [`${getal(w.vermogenW / 1000)} kW`] : [];
    const regels = w.tempC == null
      ? [t('thuis.water.geenTemp')]
      : x.aan
        ? [t(w.opZon ? 'thuis.water.naarZon' : 'thuis.water.naarNet', { doel }), ...kw]
        : w.opZon
          ? [t('thuis.water.wachtZon'), t('thuis.water.doel', { doel: w.zonC })]
          : [t('thuis.boiler.rust')];
    labels.push({
      bij,
      titel: w.tempC == null ? x.naam : `${getal(w.tempC, 0)}°`,
      groot: w.tempC != null && !app.telStand(),
      ...(w.tempC == null ? {} : { toon: x.aan ? (w.opZon ? 'zon' : 'violet') : w.opZon ? 'zon' : 'mint' }),
      regels,
      // Boven het label van de thuisaccu aan de gevel, rechts van het dak.
      dx: 90,
      dy: -124,
    });
  }

  return {
    beschrijving: `${state?.bewoner?.kop?.titel ?? t('thuis.hetHuis')}. ${state?.bewoner?.kop?.zin ?? ''}`,
    tijd,
    // De seizoenen (besluit 187): kale bomen in de winter, oranje in de herfst.
    seizoen: app.seizoenNu(),
    weer: nuWeer === 'regen' || nuWeer === 'onweer' ? 'regen' : nuWeer === 'sneeuw' ? 'sneeuw' : undefined,
    wolken,
    // De zon op zijn boog, aan de kant van het oosten. De ring van de dag staat bij Zonnepanelen (besluit 205):
    // op Thuis liep hij door de kop, de stromen en de labels.
    zon: { ...(zon?.dag ? { stand: zon.dag.fractie, hoogte: zon.dag.hoogteDeel, aandeel: Math.min(1, (zonKw * 1000) / Math.max(helder, 1500)), opRechts: huismodel.zonOpRechts(aansluiting?.ligging, aansluiting?.antwoorden?.panelen) ?? undefined, ...opDak } : { aandeel: 0, ...opDak }), ...(dakenTik ? { tik: 'daken', tikLabel: t('daken.nu.kop') } : {}) },
    // Het huis zelf, zoals elke pagina het tekent (besluit 191), met de panelen op een ander dak (besluit 187).
    // Geen kompas op Thuis: dat hoort bij Zonnepanelen.
    ...gekozenBuiten(huismodel.huisDelen(tek, elders)),
    net: true,
    stromen,
    labels,
  };
}

/**
 * Het deel buiten waarvan het blad open is, licht op in het huis (besluit 206):
 * een zone in de tuin op zijn plek, en de oprit, de garage of een ander deel
 * met een stippellijn eromheen.
 */
function gekozenBuiten(delen) {
  const k = buitenKeuze;
  if (!k || k.alles) return delen;
  const uit = { ...delen };
  for (const naam of ['oprit', 'tuin', 'terras', 'voortuin', 'garage', 'balkon']) {
    const deel = uit[naam];
    if (!deel || deel.id !== k.kamer) continue;
    const zone = naam === 'tuin' && k.zone ? Object.entries(deel.zones ?? {}).find(([, z]) => z.id === k.zone)?.[0] : null;
    uit[naam] = zone ? { ...deel, zone } : { ...deel, gekozen: true };
  }
  if (uit.tuin && uit.tuin.tuinhuisId === k.kamer) uit.tuin = { ...uit.tuin, tuinhuisGekozen: true };
  return uit;
}

/**
 * Op de telefoon onder het huis (besluit 187): van de zon, naar het huis, en
 * van of naar het net, in de kleur van de lijnen. Op de wand staat het net als
 * label bij het huis.
 */
function tekenStromenTel() {
  const el = document.querySelector('#tel [data-stromen]');
  if (!el) return;
  const s = state?.bewoner?.stromen;
  if (!s) return void (el.hidden = true);
  // Drie vakjes zonder pijlen (een pijl naar links zei niets): de zon, het huis en het net, elk met een icoon in de kleur van zijn lijn.
  const ik = (pad) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pad}</svg>`;
  const ZON = '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>';
  const HUIS = '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>';
  const NET = '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>';
  // Elk vakje opent Stroom nu bij zijn bron (idee 135).
  const vak = (pad, kleur, kw, woord, bron) => `<div class="${kleur}"${bron ? ` data-tik="stroom:${bron}" role="button" tabindex="0" aria-label="${esc(`${woord}: ${kw}`)}"` : ''}><i>${ik(pad)}</i><b>${esc(kw)}</b><span>${esc(woord)}</span></div>`;
  const netKw = s.netKw ?? 0;
  const delen = [];
  // De zon alleen als het huis panelen heeft; 's nachts gewoon 0.
  if (s.zonKw != null) delen.push(vak(ZON, 'zon-t', `${getal(s.zonKw)} kW`, t('w.zon'), 'zon'));
  // Zonder slimme meter (besluit 196): wat er geschat over is, en geen net.
  if (s.geschat) {
    if (s.overKw != null) delen.push(vak(HUIS, '', `± ${getal(s.overKw)} kW`, t('thuis.stromen.overGeschat')));
    el.innerHTML = delen.join('');
    el.hidden = !delen.length;
    return;
  }
  if (s.verbruikKw != null) delen.push(vak(HUIS, '', `${getal(s.verbruikKw)} kW`, t('thuis.stromen.huis'), 'huis'));
  delen.push(netKw > 0.05
    ? vak(NET, 'violet-t', `${getal(netKw)} kW`, t('w.vanHetNet2'), 'net')
    : netKw < -0.05
      ? vak(NET, 'mint-t', `${getal(-netKw)} kW`, t('w.terug'), 'net')
      : vak(NET, '', '0 kW', t('w.net'), 'net'));
  el.innerHTML = delen.join('');
  el.hidden = false;
}

/** Het klimaatapparaat bij een actuator, zoals het huis het noemt. */
function apparaatVan(actuatorId) {
  for (const e of huisData?.etages ?? []) for (const r of e.ruimtes ?? []) for (const d of r.apparaten ?? []) if (d.actuatorId === actuatorId) return d;
  return null;
}

/* ------------------------------------------------------------ tekenen */

/** De kleur van wat er meespeelt bij de stand (besluit 286). */
const STAND_KLEUR = { hand: 'var(--mint)', bijspringen: 'var(--gloed)', licht: 'var(--zon)', afwezig: 'var(--ijs)', vakantie: 'var(--violet)' };

/**
 * De stand van het huis (besluit 286): op de wand in de knop rechtsboven, met
 * wat er meespeelt ("Dag · de airco springt bij"); op de telefoon als regel
 * naast de begroeting. Zonder melding de stand en tot wanneer.
 */
function tekenStand(e) {
  const st = state?.bewoner?.stand;
  const pijl = '<span aria-hidden="true" style="color: var(--gedempt)">▾</span>';
  if (!st) {
    // Een dienst van voor deze versie: zoals het was.
    const modus = e.modeSource === 'schedule' ? 'automatisch' : ['voorverwarmen', 'dag', 'nacht', 'afwezig', 'vakantie', 'handmatig'].includes(e.mode) ? e.mode : 'automatisch';
    $$('#wand [data-modus]').forEach((el) => (el.innerHTML = `${esc(t(`thuis.stand.${modus}`))} ${pijl}`));
    $$('#tel [data-modus]').forEach((el) => (el.hidden = true));
    return;
  }
  const kleur = st.soort ? STAND_KLEUR[st.soort] : null;
  const stip = kleur ? '<span class="standstip" aria-hidden="true"></span>' : '';
  $$('#wand [data-modus]').forEach((el) => {
    el.style.setProperty('--k', kleur ?? 'var(--zacht)');
    el.innerHTML = `${stip}<b>${esc(st.naam)}</b><span class="wat${kleur ? ' speelt' : ''}">· ${esc(st.knop)}</span>${pijl}`;
  });
  $$('#tel [data-modus]').forEach((el) => {
    el.hidden = false;
    el.style.setProperty('--k', kleur ?? 'var(--zacht)');
    el.classList.toggle('speelt', !!kleur);
    el.innerHTML = `${stip}<span>${esc(st.kort)}</span><i aria-hidden="true">›</i>`;
  });
}

/**
 * Wat SunArc doet (besluit 313): de vaste strook. Op de wand één regel met de
 * stand, de zin en hoeveel kamers gelijk zijn; op de telefoon twee korte
 * regels. De zin komt kant-en-klaar uit de dienst. De strook is er alleen
 * zolang SunArc meekijkt: regelt het zelf, of doet er geen kamer mee, dan zegt
 * de zin boven het huis genoeg en is er geen strook.
 */
/**
 * De zon verdelen (besluit 343): zolang er zon over is en iemand hem krijgt of erop wacht, zegt de strook wie hem nu
 * krijgt en wie daarna. Anders de zin van de dienst.
 */
function zonZin() {
  const v = zonVerdelen.data;
  if (!v || !(v.overW > 50) || !v.lijst.some((x) => x.stand === 'zon' || x.stand === 'laadt' || x.stand === 'wacht')) return null;
  return zonVerdelen.strook(v);
}

function tekenDoet() {
  const d = state?.bewoner?.doet ?? null;
  const zin = zonZin() ?? d?.zin;
  // Met de strook is het vak van het huis op de wand iets lager: vóór het huis getekend wordt.
  document.body.classList.toggle('met-doet', !!d);
  const stip = '<span class="standstip" aria-hidden="true"></span>';
  const pijl = '<span class="dt-pijl" aria-hidden="true">›</span>';
  $$('[data-doet]').forEach((el) => {
    el.hidden = !d;
    if (!d) return;
    const lang = t('w.sunarcKijktMee');
    const tel = d.van > 0 ? t('thuis.doet.gelijk', { n: d.van, gelijk: d.gelijk }) : '';
    el.setAttribute('aria-label', [lang, zin, tel].filter(Boolean).join('. '));
    if (el.closest('#tel')) {
      el.innerHTML = `${stip}<span class="dt-twee"><span><b>${esc(t('thuis.doet.stand.kijkt'))}</b> · ${esc(t('thuis.doet.nogNiet'))}</span><span class="dt-zin">${esc(zin)}</span></span>${pijl}`;
      return;
    }
    const blokjes = d.van > 0 && d.van <= 8 ? `<span class="dt-blokjes" aria-hidden="true">${Array.from({ length: d.van }, (_, i) => `<i class="${i < d.gelijk ? 'ja' : ''}"></i>`).join('')}</span>` : '';
    // Het zinnetje gaat voor (stap 4): de blokjes zeggen hoe vaak het gelijk was, het getal staat in het blad.
    el.innerHTML = `${stip}<b>${esc(lang)}</b><span class="dt-zin">${esc(zin)}</span><span class="dt-tel" title="${esc(tel)}">${blokjes || esc(tel)}</span>${pijl}`;
  });
  const blad = document.querySelector('[data-kiesblad]');
  if (blad && !blad.hidden && blad.dataset.blad === 'doet') tekenDoetBlad();
}

function tekenNu() {
  app.schaal();
  if (!state || !huisData) return;

  const e = state.explanation ?? {};
  const kop = state.bewoner?.kop ?? {};
  zet('[data-kop]', kop.titel ?? t('thuis.hetHuis'));
  zet('[data-zin]', kop.zin ?? '');
  tekenWeerknop();
  tekenStand(e);
  tekenDoet();

  const model = huisModel();
  lucht(model.tijd, model.seizoen, model.wolken);
  // Een nieuw huis (nog het voorstel uit Home Assistant): de weg naar Inrichten (besluit 114).
  $$('[data-inrichten]').forEach((el) => (el.hidden = huisData?.indeling !== 'voorstel'));
  // De begroeting, naar de tijd van de dag, met wie je bent (besluit 147).
  const uur = new Date().getHours();
  const groet = t(`thuis.groet.${uur < 6 ? 'nacht' : uur < 12 ? 'morgen' : uur < 18 ? 'middag' : 'avond'}`);
  // Ieder in zijn eigen kleur (besluit 181).
  const namen = huismodel.groetWie(bewoners);
  $$('[data-groet]').forEach((el) => (el.innerHTML = namen.length ? `${esc(groet)}, ${namen.map((n) => `<b data-kleur="${esc(app.kleurVan(n.id))}">${esc(n.naam)}</b>`).reduce((acc, n, i, a) => (i === 0 ? n : `${acc}${i === a.length - 1 ? ` ${esc(t('algemeen.en'))} ` : ', '}${n}`), '')}` : esc(groet)));
  tekenGeldt();
  if (blad === 'batterij' && $$('[data-weer]').some((x) => !x.hidden)) tekenBatterijen();
  if (blad === 'buiten' && buitenKeuze && $$('[data-weer]').some((x) => !x.hidden)) tekenBuiten();
  const wandPodium = document.getElementById('podium-wand');
  // Het huis zoals getekend in Je huis (stap a van de nieuwe tekenaar, src/huisthuis.js), als die aan staat; anders het poppenhuis.
  if (!app.telStand()) {
    // Het poppenhuis laadt pas als het nodig is: huisThuis.poppenhuis tekent opnieuw zodra het er is.
    if (!window.huisThuis?.teken(wandPodium, model, { breedte: wandPodium.clientWidth || 860, hoogte: 612, huisData, zonData: zon, opnieuw: tekenNu }) && (window.huisThuis?.poppenhuis(tekenNu) ?? true)) huis.teken(wandPodium, model, { breedte: wandPodium.clientWidth || 860, hoogte: 612, marge: 0.04, schuifX: 10, schuifY: 10, tik: true });
  }
  // Eenvoudig (besluit 164): geen getallen op het huis. De telefoon ook met het huis zoals getekend (stap d), als die aan staat.
  else if (!window.huisThuis?.teken(document.getElementById('podium-tel'), model, { soort: 'tel', breedte: 390, hoogte: 330, huisData, zonData: zon, opnieuw: tekenNu }) && (window.huisThuis?.poppenhuis(tekenNu) ?? true)) huis.teken(document.getElementById('podium-tel'), { ...model, etages: model.etages.map((et) => ({ ...et, kamers: et.kamers.map((k) => ({ ...k, stil: true })) })), labels: app.weergave().eenvoudig ? [] : model.labels.filter((l) => l.bij === 'panelen' || l.bij === 'boiler' || l.bij === 'jacuzzi').map((l) => (l.bij === 'panelen' ? { ...l, dx: -40, dy: -84 } : { ...l, groot: false, dx: 30, dy: -52 })) }, { breedte: 390, hoogte: 330, marge: 0.03, schuifY: -6, tik: true });
  tekenStromenTel();

  tekenVandaag();
  tekenStraks();
  tekenApparaat();
  tekenGevoel();
  tekenKamersTel();
  tekenMorgen();
  tekenLading();
  tekenMaand();
  tekenSluip();
  tekenFasen();
  tekenDeurbel();
  // Thuis naar eigen smaak (besluit 162): favorieten, en de kaarten op hun plek.
  eigen.tekenFavorieten(huisData);
  eigen.na();
  // De wand als niemand kijkt (besluit 164): de stand van het huis bij, en opnieuw tekenen als hij rust.
  niemand.ververs();
  // De microfoon in de vraagbalk alleen waar hij kan: over https (besluit 150).
  $$('#tel [data-mic]').forEach((el) => (el.hidden = !(window.isSecureContext && navigator.mediaDevices?.getUserMedia)));
}

/*
 * Onderhoud (besluit 226): batterijen en filters staan alleen nog bij de bel,
 * die ze al telde (besluit 221). De sleutel op Thuis zei hetzelfde nog eens.
 */

/** Vandaag staat op de wand rechts, en op de telefoon onderaan (besluit 159). */
/*
 * Een huis zonder panelen (besluit 196, schets Wand-Huis-Zonder): de kaart
 * Vandaag zegt wat het huis vandaag gebruikte en kostte, met de goedkope uren
 * van het contract eronder.
 */
let verbruikDag = null;
let goedkoop = null;
function tekenVerbruikVandaag() {
  const s = verbruikDag?.stroom;
  const euroNu = verbruikDag?.kosten?.totaal;
  const dal = goedkoop?.dal ?? [];
  const nuUur = goedkoop ? Math.floor((Date.now() - goedkoop.dagStartMs) / 3_600_000) : -1;
  const strook = dal.length
    ? `<div class="dalstrook" role="img" aria-label="${esc(t('thuis.goedkoop.label'))}">${dal.map((d, i) => `<i class="${d ? 'dal' : ''}${i === nuUur ? ' nu' : ''}"></i>`).join('')}</div><div class="dalas"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>`
    : '';
  // De daluren als tekst: het eerste blok van vandaag dat nog komt, of het eerste.
  const blokken = [];
  dal.forEach((d, i) => {
    if (!d) return;
    const laatst = blokken.at(-1);
    if (laatst && laatst.tot === i) laatst.tot = i + 1;
    else blokken.push({ van: i, tot: i + 1 });
  });
  // Op de klok, niet geteld: een dag met de klokwissel heeft 23 of 25 uur.
  const uur = (h) => app.klokVan(goedkoop.dagStartMs + h * 3_600_000);
  const blok = blokken.find((b) => b.tot > nuUur) ?? blokken[0];
  const prijzen = { dal: goedkoop?.dalPrijs != null ? `${taal.valuta()} ${getal(goedkoop.dalPrijs, 2)}` : '', normaal: goedkoop?.normaal != null ? `${taal.valuta()} ${getal(goedkoop.normaal, 2)}` : '' };
  const zin = !dal.length ? t('thuis.goedkoop.geen') : !blokken.length ? t('thuis.goedkoop.vandaagNiet') : t(blok.van <= nuUur ? 'thuis.goedkoop.nu' : 'thuis.goedkoop.vanaf', { van: uur(blok.van), tot: uur(blok.tot), ...prijzen });
  const cijfer = (naam, waarde) => `<div class="dagcijfer"><span class="mini">${esc(naam)}</span><b class="getal">${waarde}</b></div>`;
  $$('[data-dag]').forEach((box) => (box.innerHTML = `<div class="dagcijfers">${cijfer(t('thuis.verbruik.gebruikt'), s ? `${getal(s.verbruikKwh)} <small>kWh</small>` : '–')}${euroNu != null ? cijfer(t('thuis.verbruik.kosten'), `${taal.valuta()} ${getal(euroNu, 2)}`) : ''}</div>${strook}`));
  zet('[data-opgewekt]', '');
  zet('[data-dag-zin]', zin);
  $$('[data-vandaag-tegel]').forEach((el) => (el.outerHTML = tegel({ id: 'vandaag', naam: t('w.vandaag'), waarde: s ? `${getal(s.verbruikKwh)} <small>kWh</small>` : '–', zin: euroNu != null ? t('thuis.verbruik.tegel', { euro: getal(euroNu, 2) }) : '' }).replace('class="ktegel', 'data-vandaag-tegel class="ktegel')));
  $$('[data-dag-eenvoudig]').forEach((el) => (el.innerHTML = s ? `${vet('thuis.verbruik.eenvoudig', { kwh: getal(s.verbruikKwh) })} ${esc(zin)}` : esc(zin)));
}

function tekenVandaag() {
  if (app.huisSoort()?.zon === false) return tekenVerbruikVandaag();
  const boxen = $$('[data-dag]');
  if (!vandaag?.kwartieren?.length) {
    boxen.forEach((box) => (box.innerHTML = `<p class="mini">${esc(t('thuis.vandaag.geen'))}</p>`));
    return;
  }
  const B = 312;
  const t0 = vandaag.vanMs;
  const t1 = t0 + 24 * 3600_000;
  const x = (t) => 8 + ((t - t0) / (t1 - t0)) * (B - 16);
  const kw = vandaag.kwartieren;
  const lijn2 = app.verwachting(zon, weer);
  const max = Math.max(1500, ...kw.map((q) => q.zonW ?? 0), ...lijn2.punten.map((q) => q.w));
  const y = (w) => 86 - (w / max) * 72;
  const lijn = kw.map((q, i) => `${i ? 'L' : 'M'} ${x(q.tMs).toFixed(1)} ${y(q.zonW ?? 0).toFixed(1)}`).join(' ');
  const laatste = kw[kw.length - 1];
  const vlak = `${lijn} L ${x(laatste.tMs).toFixed(1)} 86 L ${x(kw[0].tMs).toFixed(1)} 86 Z`;
  const helder = lijn2.punten.map((q, i) => `${i ? 'L' : 'M'} ${x(q.tMs).toFixed(1)} ${y(q.w).toFixed(1)}`).join(' ');
  const nuX = x(Date.now());
  // De apparaten die op zon kunnen koelen of verwarmen: de airco's en warmtepompen.
  const banen = (vandaag.apparaten ?? []).filter((a) => apparaatVan(a.actuatorId)?.klimaat?.kanKoelen).slice(0, 3);
  // Per apparaat de naam op een eigen regel en de baan eronder: een blokje vroeg op de dag liep anders door de naam.
  const BAAN = 24;
  const banenSvg = banen
    .map((a, i) => {
      const yy = 102 + i * BAAN;
      const naam = apparaatVan(a.actuatorId)?.naam ?? a.actuatorId;
      const stukken = (a.smartClimate ?? []).map((s) => `<rect x="${x(s.vanMs).toFixed(1)}" y="${yy + 5}" width="${Math.max(3, x(s.totMs) - x(s.vanMs)).toFixed(1)}" height="7" rx="3.5" fill="#6FD3FF"/>`).join('');
      return `<text x="8" y="${yy}">${esc(naam)}</text><rect x="8" y="${yy + 5}" width="${B - 16}" height="7" rx="3.5" fill="#ffffff" fill-opacity="0.05"/>${stukken}`;
    })
    .join('');
  const uren = [6, 12, 18, 22].map((u) => `<text x="${x(t0 + u * 3600_000).toFixed(1)}" y="${104 + banen.length * BAAN}" text-anchor="middle">${String(u).padStart(2, '0')}</text>`).join('');
  const hoog = 110 + banen.length * BAAN;
  // Elk een eigen verloop: een verloop in de verborgen weergave tekent niet.
  boxen.forEach((box, i) => (box.innerHTML = `<svg viewBox="0 0 ${B} ${hoog}" width="${B}" height="${hoog}" aria-label="${esc(t('thuis.vandaag.grafiek'))}">
    <defs><linearGradient id="zonvlak-${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7B548" stop-opacity="0.55"/><stop offset="1" stop-color="#F7B548" stop-opacity="0.02"/></linearGradient></defs>
    ${helder ? `<path d="${helder}" fill="none" stroke="#F7B548" stroke-opacity="0.35" stroke-dasharray="2 4"/>` : ''}
    <path d="${vlak}" fill="url(#zonvlak-${i})"/><path d="${lijn}" fill="none" stroke="#F7B548" stroke-width="2"/>
    <line x1="${nuX}" y1="14" x2="${nuX}" y2="${hoog - 14}" stroke="#EEF3F7" stroke-opacity="0.6"/>
    <text x="${nuX}" y="10" fill="#B8C4CF" font-size="10" text-anchor="middle" font-family="Figtree">${esc(t('w.nu'))}</text>
    <g font-family="Figtree" font-size="10.5" fill="#7F8E9C">${banenSvg}${uren}</g>
  </svg>`));
  const kwh = (vandaag.zonWh ?? 0) / 1000;
  // Naast wat de dag ervoor werd verwacht (besluit 137); anders wat er nog komt.
  const vooraf = weer?.vandaag?.verwachtVoorafKwh;
  const verwacht = weer?.vandaag?.verwachtKwh;
  zet('[data-opgewekt]', vooraf != null ? t('thuis.vandaag.verwacht', { kwh: getal(kwh), verwacht: getal(vooraf) }) : verwacht != null && verwacht > kwh + 0.05 ? t('thuis.vandaag.verwacht', { kwh: getal(kwh), verwacht: getal(verwacht) }) : t('thuis.vandaag.opgewekt', { kwh: getal(kwh) }));
  const terug = (vandaag.netTerugWh ?? 0) / 1000;
  // De tegel (besluit 189): de zon van vandaag als kleine lijn, het getal eronder.
  const kx = (tt) => ((tt - t0) / (t1 - t0)) * 260;
  const ky = (w) => 42 - (w / max) * 38;
  const kLijn = kw.map((q, i) => `${i ? 'L' : 'M'} ${kx(q.tMs).toFixed(1)} ${ky(q.zonW ?? 0).toFixed(1)}`).join(' ');
  const kHelder = lijn2.punten.map((q, i) => `${i ? 'L' : 'M'} ${kx(q.tMs).toFixed(1)} ${ky(q.w).toFixed(1)}`).join(' ');
  const grafiek = `<svg class="grafiek" viewBox="0 0 260 44" preserveAspectRatio="none" aria-hidden="true">${kHelder ? `<path d="${kHelder}" fill="none" stroke="#F7B548" stroke-opacity="0.45" stroke-width="1.5" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>` : ''}<path d="${kLijn} L ${kx(laatste.tMs).toFixed(1)} 42 L 0 42 Z" fill="rgb(247 181 72 / 0.22)"/><path d="${kLijn}" fill="none" stroke="#F7B548" stroke-width="2" vector-effect="non-scaling-stroke"/><line x1="${kx(Date.now()).toFixed(1)}" y1="0" x2="${kx(Date.now()).toFixed(1)}" y2="44" stroke="rgb(255 255 255 / 0.5)" vector-effect="non-scaling-stroke"/></svg>`;
  $$('[data-vandaag-tegel]').forEach((el) => (el.outerHTML = tegel({ id: 'vandaag', naam: t('w.vandaag'), waarde: `${getal(kwh)} <small>kWh</small>`, zin: kwh > 0.05 && app.huisSoort()?.meter !== false ? t('thuis.tegel.zelf', { pct: getal(Math.max(0, Math.min(100, ((kwh - terug) / kwh) * 100)), 0) }) : '', beeld: grafiek, klasse: 'metgrafiek' }).replace('class="ktegel', 'data-vandaag-tegel class="ktegel')));
  const uitleg = t('thuis.vandaag.gestippeld', { lijn: lijn2.naam });
  // Zonder slimme meter (besluit 196) weet het huis niet wat er terugging: dan geen deel zelf gebruikt.
  const metMeter = app.huisSoort()?.meter !== false;
  zet('[data-dag-zin]', kwh > 0.05 && metMeter ? `${t('thuis.vandaag.zelf', { pct: getal(Math.max(0, Math.min(100, ((kwh - terug) / kwh) * 100)), 0) })} ${uitleg}` : uitleg);
  // Eenvoudig (besluit 164, schets Thuis-Tel-Eigen #eenvoudig): de dag in één zin.
  const zelf = kwh > 0.05 ? (kwh - terug) / kwh : 0;
  $$('[data-dag-eenvoudig]').forEach((el) => (el.innerHTML = kwh > 0.05 ? `${vet('thuis.vandaag.eenvoudig', { kwh: getal(kwh) })} ${esc(t(zelf >= 0.9 ? 'thuis.vandaag.bijnaAlles' : zelf >= 0.5 ? 'thuis.vandaag.meeste' : 'thuis.vandaag.naarNet'))}` : esc(t('thuis.vandaag.niets'))));
}

/*
 * Straks: wat het huis gaat doen zodra het kan. Uit de besluiten die nu op zon
 * wachten; het plan voor de middag komt met het thermisch model (D).
 */
/** Een uitstelbaar apparaat dat draait of klaarstaat, als kaart: met de eindtijd (besluit 98). */
function tekenApparaat() {
  const kaarten = $$('[data-apparaatkaart]');
  const inhoud = (k) => k.querySelector('[data-apparaat-inhoud]');
  const d = (state?.bewoner?.uitstelbaar ?? []).find((x) => x.stand === 'running') ?? (state?.bewoner?.uitstelbaar ?? []).find((x) => x.stand === 'waiting' || x.stand === 'would_start');
  if (!d) {
    kaarten.forEach((k) => (k.hidden = true));
    return;
  }
  // Een apparaat dat draait of wacht, speelt nu: bovenaan de kaarten (besluit 226).
  kaarten.forEach((k) => k.classList.add('nu'));
  const s = (vandaag?.uitstelbaar ?? []).find((u) => u.id === d.id)?.draaide?.at(-1);
  const nu = Date.now();
  // Klaar met drogen, ook al draait de trommel nog tegen kreuken (besluit 167): dat zegt de dienst.
  const klaar = d.stand === 'running' ? d.klaarSindsMs ?? null : null;
  const loopt = d.stand === 'running' && !klaar && s && nu - s.totMs < 5 * 60_000;
  // De eindtijd: wat het apparaat zegt dat er nog over is, anders de start plus de duur.
  const eind = d.stand === 'running' && !klaar ? (d.restMin != null ? nu + d.restMin * 60_000 : loopt && d.duurMin ? s.vanMs + d.duurMin * 60_000 : null) : null;
  const deel = klaar ? 1 : eind && s ? Math.max(0, Math.min(1, (nu - s.vanMs) / Math.max(60_000, eind - s.vanMs))) : d.stand === 'running' ? 1 : 0;
  const rest = eind ? Math.max(0, Math.round((eind - nu) / 60_000)) : null;
  const R = 2 * Math.PI * 24;
  const kleur = klaar ? '#6EE7B7' : '#F7B548';
  const binnen = klaar
    ? '<path d="M19 28.5l6 6 12-13" fill="none" stroke="#6EE7B7" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'
    : rest != null ? `<text x="28" y="33" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="600" font-size="13" fill="#EEF3F7">${esc(rest >= 60 ? t('thuis.apparaat.uren', { u: Math.floor(rest / 60), m: String(rest % 60).padStart(2, '0') }) : t('thuis.apparaat.minuten', { m: rest }))}</text>` : '';
  const ring = `<svg class="ring" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="5" ${d.stand === 'running' ? '' : 'stroke-dasharray="3 5"'}/>${deel > 0 ? `<circle cx="28" cy="28" r="24" fill="none" stroke="${kleur}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(deel * R).toFixed(1)} ${R.toFixed(1)}" transform="rotate(-90 28 28)"/>` : ''}${binnen}</svg>`;
  const zin = klaar ? t('thuis.apparaat.kreuken', { klok: klok(klaar) }) : eind ? t('thuis.apparaat.klaarRond', { klok: klok(eind) }) : d.kop;
  kaarten.forEach((k) => {
    inhoud(k).innerHTML = `${ring}<span><b>${esc(d.naam)}</b><span class="klein ${klaar ? 'mint-t' : 'zon-t'}">${esc(zin)}</span></span>`;
    k.hidden = false;
  });
}

function tekenStraks() {
  const wacht = (state.rejected ?? []).find((r) => r.blockedBy === 'insufficient_power_budget' && r.intent?.budgetW > 0);
  const kaarten = $$('[data-straks]');
  if (!wacht) {
    kaarten.forEach((k) => (k.hidden = true));
    return;
  }
  const zone = huismodel.metHoofdletter(zoneNaam(wacht.intent.zoneId, huisData));
  zet('[data-straks-kop]', t(wacht.intent.action === 'heat' ? 'thuis.straks.warm' : 'thuis.straks.koel', { zone, kw: getal(wacht.intent.budgetW / 1000) }));
  const over = Math.max(0, state.explanation?.budget?.availableW ?? 0);
  zet('[data-straks-zin]', `${over >= 50 ? t('thuis.straks.over', { kw: getal(over / 1000) }) : t('thuis.straks.geenZon')} ${t('thuis.straks.vanzelf')}`);
  kaarten.forEach((k) => {
    k.hidden = false;
    k.classList.add('nu');
  });
}

/*
 * Wie er thuis is en wiens comfort geldt (besluit 169, schetsen Wand-Thuis-Wie
 * en Thuis-Tel-Wie): een rondje per bewoner, op de wand bovenin voor de pillen
 * en op de telefoon rechts van de begroeting. Wie thuis is, licht op in zijn
 * kleur; wie weg is, blijft grijs; wie gevolgd wordt, heeft een witte ring met
 * een klein thermometertje. Een tik opent een blad met iedereen, thuis of weg
 * en zijn temperaturen; daar kies je wiens comfort geldt, tot er iemand
 * thuiskomt of weggaat. Een gast kijkt alleen. Eerst stond er een grote kaart
 * "Comfort van Noor" met één knop terug naar de hoofdgebruiker. De kleur is
 * die van de bewoner zelf (besluit 181); eerst een vaste rij, met amber en
 * groen erin, die iets anders betekenen.
 */
const klokVan = klok;
/**
 * Wie er thuis is: meteen zoals Home Assistant het ziet, net als bij Bewoners
 *. Eerst volgden de rondjes de regeling, die pas na tien
 * minuten rust wisselt; dan stond iemand bij Bewoners al thuis en hier nog
 * weg. Het comfort wisselt nog steeds pas na die tien minuten (besluit 147);
 * dat laat de ring zien.
 */
function wieThuis() {
  return new Set((bewoners?.bewoners ?? []).filter((b) => b.thuis).map((b) => b.id));
}
function gezicht(b) {
  const thuis = wieThuis().has(b.id);
  const geldt = bewoners?.geldt?.id === b.id;
  return `<i data-kleur="${esc(app.kleurVan(b.id))}" class="${thuis ? '' : 'afwezig'}${geldt ? ' geldt' : ''}">${esc(b.naam.charAt(0).toUpperCase())}</i>`;
}
function tekenGeldt() {
  const lijst = bewoners?.bewoners ?? [];
  const g = bewoners?.geldt;
  const thuis = wieThuis();
  const label = lijst.length
    ? `${lijst.map((b) => t(thuis.has(b.id) ? 'thuis.wie.isThuis' : 'thuis.wie.isWeg', { naam: b.naam })).join(', ')}.${g ? ` ${t('thuis.wie.geldt', { naam: g.naam })}` : ''} ${t('thuis.wie.tik')}`
    : '';
  $$('[data-wie]').forEach((el) => {
    el.hidden = lijst.length === 0;
    if (!lijst.length) return;
    el.setAttribute('aria-label', label);
    el.innerHTML = `<span class="gezichten" aria-hidden="true">${lijst.map(gezicht).join('')}</span><span class="pijl" aria-hidden="true">▾</span>`;
  });
  const blad = document.querySelector('[data-kiesblad]');
  if (blad && !blad.hidden && blad.dataset.blad === 'wie') void tekenWieBlad();
}

/** De temperaturen per bewoner: overdag en 's nachts, in de eerste kamer die verwarmt. */
const wieTemps = new Map();
async function haalTemps() {
  await Promise.all((bewoners?.bewoners ?? []).map(async (b) => {
    if (wieTemps.has(b.id)) return;
    try {
      const c = await haal(`api/comfort?bewoner=${encodeURIComponent(b.id)}`);
      const k = (c?.kamers ?? []).find((x) => x.kanVerwarmen) ?? c?.kamers?.[0];
      wieTemps.set(b.id, k ? { kamer: k.naam, dag: k.modi?.dag?.heat ?? null, nacht: k.modi?.nacht?.heat ?? null } : null);
    } catch {
      wieTemps.set(b.id, null);
    }
  }));
}

async function tekenWieBlad() {
  const el = document.querySelector('[data-kiesblad]');
  if (!el || !bewoners) return;
  const lijst = bewoners.bewoners ?? [];
  const g = bewoners.geldt;
  const thuis = wieThuis();
  const gast = bewoners.ik?.soort === 'gast';
  const gekozen = g?.waarom === 'gekozen' ? g.id : null;
  const graad = (c) => (c == null ? '–' : `${getal(c, Number.isInteger(c) ? 0 : 1)}°`);
  // Waarom het nu deze is, in één zin.
  const hoofd = lijst[0];
  const weg = lijst.filter((b) => !thuis.has(b.id));
  const isWeg = (b) => (b.thuisSindsMs ? t('thuis.wie.wegSinds', { naam: b.naam, klok: klokVan(b.thuisSindsMs) }) : t('thuis.wie.weg', { naam: b.naam }));
  const nu = g?.waarom === 'niemand'
    ? t('thuis.wie.niemand', { naam: g.naam })
    : `${t('thuis.wie.nu', { naam: g?.naam ?? hoofd?.naam ?? '' })}${weg.length && g && g.id !== hoofd?.id ? ` ${weg.map(isWeg).join(', ')}.` : ''}`;
  const rij = (id, gezichtHtml, naam, onder, rechts, aan) => `<button type="button" class="wiekeuze${aan ? ' aan' : ''}" role="radio" aria-checked="${aan}" data-wie-kies="${esc(id)}" ${gast ? 'disabled' : ''}><span class="rond" aria-hidden="true"></span>${gezichtHtml}<span><b>${esc(naam)}</b><small>${onder}</small></span><span class="temp">${rechts}</span></button>`;
  const rijen = lijst.map((b) => {
    const temps = wieTemps.get(b.id);
    const isThuis = thuis.has(b.id);
    const onder = isThuis ? `<span class="thuis-t">${esc(t('w.thuis'))}</span>` : esc(b.thuisSindsMs ? t('w.wegSinds', { klok: klokVan(b.thuisSindsMs) }) : t('w.weg'));
    const rechts = temps ? [temps.dag != null ? vet('thuis.wie.overdag', { graden: graad(temps.dag) }) : '', temps.nacht != null ? vet('thuis.wie.snachts', { graden: graad(temps.nacht) }) : ''].filter(Boolean).join('<br>') : '';
    return rij(b.id, `<span class="gezicht${isThuis ? '' : ' afwezig'}" data-kleur="${esc(app.kleurVan(b.id))}" aria-hidden="true">${esc(b.naam.charAt(0).toUpperCase())}</span>`, b.naam, onder, rechts, gekozen === b.id);
  }).join('');
  el.dataset.blad = 'wie';
  el.setAttribute('aria-label', t('thuis.wie.kop'));
  el.innerHTML = `<div class="bladkop"><h2 class="kop-2">${esc(t('thuis.wie.kop'))}</h2><button type="button" class="knop knop-licht" data-blad-dicht>${esc(t('algemeen.klaar'))}</button></div>
    <div role="radiogroup" aria-label="${esc(t('thuis.wie.kop'))}">
      ${rij('', '<span class="gezicht vanzelf" aria-hidden="true">⟳</span>', t('thuis.wie.vanzelf'), esc(nu), '', gekozen == null)}
      ${rijen}
    </div>
    <p class="mini geen-marge boven-12">${esc(t(gast ? 'thuis.wie.gast' : 'thuis.wie.totDat'))}${wieTemps.size ? ` ${esc(t('thuis.wie.temperaturenVan', { kamer: [...wieTemps.values()].find(Boolean)?.kamer ?? t('thuis.wie.eersteKamer') }))}` : ''}</p>`;
}

async function openWie() {
  const el = document.querySelector('[data-kiesblad]');
  if (!el || !bewoners?.bewoners?.length) return;
  await tekenWieBlad();
  document.querySelector('[data-kies-achter]').hidden = false;
  el.hidden = false;
  el.querySelector('button')?.focus();
  // De temperaturen erbij zodra ze er zijn.
  await haalTemps();
  if (el.dataset.blad === 'wie' && !el.hidden) await tekenWieBlad();
}

document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-wie]') && !eigen.bewerkt) return void openWie();
  const knop = e.target.closest('[data-wie-kies]');
  if (!knop || knop.disabled) return;
  const id = knop.dataset.wieKies || null;
  const res = await deur('api/bewoners', { actie: 'vasthouden', id });
  if (res?.ok) {
    bewoners = await res.json();
    tekenGeldt();
    // De regeling neemt het meteen over; Thuis tekent opnieuw met wat er nu geldt.
    void tekenWieBlad();
  }
});


/*
 * Hoe voelt het? (besluit 134): de kaart komt uit gevoel.js. Kiezen welke
 * kamer kan met de knoppen erboven; de eerste keer de kamer met een regeling
 * op de laagste etage, meestal waar je woont.
 */
function tekenGevoel() {
  // Van beneden naar boven: de gekozen kamer vooraan, niet half buiten beeld.
  const zones = [...huisData.etages].reverse().flatMap((e) => e.ruimtes).filter((r) => r.zoneId && r.temperatuurC != null);
  // Op de telefoon geen lege kaart zonder kamers.
  $$('#tel [data-gevoel-kaart]').forEach((el) => (el.hidden = !zones.length));
  if (!zones.length) return;
  gekozenZone ??= zones[0].zoneId;
  const kamer = zones.find((r) => r.zoneId === gekozenZone) ?? zones[0];
  zet('[data-gevoel-kop]', t('thuis.gevoel.kop'));
  $$('[data-gevoel-uitleg]').forEach((el) => (el.hidden = true));
  const html = gevoel.html({ zoneId: kamer.zoneId, kamers: zones.map((r) => ({ zoneId: r.zoneId, naam: r.naam, c: r.temperatuurC })), state });
  $$('[data-gevoel]').forEach((el) => {
    if (el.dataset.html !== html) {
      el.innerHTML = html;
      el.dataset.html = html;
    }
  });
}
gevoel.bij(() => teken());
// De zon verdelen (besluit 343): bij het openen en elke minuut, zolang SunArc meekijkt en de strook er is.
zonVerdelen.na = () => tekenDoet();
void zonVerdelen.laad();
setInterval(() => {
  if (!document.hidden && state?.bewoner?.doet) void zonVerdelen.laad();
}, 60_000);
addEventListener('gevoelzone', (/** @type {CustomEvent} */ e) => {
  gekozenZone = e.detail;
  teken();
});
// Een huis zonder panelen: geen "Hoeveel zon vandaag?" in het dok.
const zonVraag = () => $$('[data-zon-vraag]').forEach((el) => (el.hidden = app.huisSoort()?.zon === false));
zonVraag();
addEventListener('huissoort', zonVraag);

/** De kamers op de telefoon: één kaart, een regel per kamer (besluit 159). */
function tekenKamersTel() {
  const box = document.querySelector('[data-kamers]');
  const kleur = { koelt: 'var(--ijs)', verwarmt: 'var(--gloed)', wacht: 'var(--zon)', goed: 'var(--mint)' };
  const kamers = huisData.etages.flatMap((e) => e.ruimtes).filter((r) => r.zoneId && r.temperatuurC != null);
  box.closest('[data-kaart]').hidden = !kamers.length;
  box.innerHTML = kamers
    .map((r) => {
      const stand = huismodel.standVan(r.zoneId, state);
      const kort = state.bewoner?.kamers?.find((x) => x.zoneId === r.zoneId)?.kort ?? '';
      return `<a href="kamer.html#${encodeURIComponent(r.id)}"><span class="stip" style="width: 10px; height: 10px; background: ${kleur[stand] ?? 'var(--gedempt)'}"></span><span><b>${esc(r.naam)}</b><small style="color: ${app.tekstKleur(kleur[stand] ?? 'var(--zacht)')}">${esc(kort)}</small></span><span class="getal">${getal(r.temperatuurC)}°</span><span class="pijl" aria-hidden="true">›</span></a>`;
    })
    .join('');
}

