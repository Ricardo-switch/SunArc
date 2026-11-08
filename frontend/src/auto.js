/*
 * De pagina Auto (besluit 259, stap 2; schets Wand-Auto en Tel-Auto): om te
 * kijken. Per auto hoe vol hij is, of hij laadt en met hoeveel, de stroom per
 * fase, de kabel, het bereik, de laadgrens, hoe laat hij vol is en of hij
 * onderweg is. Alles komt van de dienst (`api/huis`, `opslag.autos`); de
 * pagina zet het neer. Of het laden op zon gaat, volgt uit het net nu
 * (`api/state`): komt er niets van het net, dan is het eigen zon.
 *
 * De laadbeurten (stap 3) komen apart (`api/laadbeurten`): uit de statistiek
 * van Home Assistant, de laatste week, met kWh, kosten en het deel eigen zon.
 *
 * Het advies (stap 4) komt ook apart (`api/laadadvies`): zon over en de
 * goedkoopste uren, alleen als het iets zegt; onder de auto.
 *
 * Laden met de hand (stap 5, besluit 262) gaat via het blad Laden en
 * `api/laden`: de hoogste stroom of pauzeren, altijd met een eind; alleen als
 * de bewoner het bij Energie aanzette, en alleen in de add-on.
 *
 * Instellen gebeurt bij Energie › Auto en laadpaal (docs/auto-en-laadpaal.md).
 */
'use strict';

const { $$, nl, esc, klokVan, wanneer, haal } = app;
const { t } = taal;

let huisData = null;
let state = null;
let fout = null;
/** Het advies per auto (stap 4), of null zolang de dienst niets zegt. */
let adviezen = null;
/** De gekozen auto: uit het adres (auto.html#id), anders de eerste. */
let gekozen = decodeURIComponent(location.hash.slice(1)) || null;

async function laad() {
  const [h, s, ad] = await Promise.allSettled([haal('api/huis'), haal('api/state'), haal('api/laadadvies'), laadLaden()]);
  if (ad.status === 'fulfilled') adviezen = ad.value?.adviezen ?? null;
  if (h.status === 'fulfilled') {
    huisData = h.value;
    fout = null;
  } else if (!huisData) fout = t('groep.geenVerbinding');
  if (s.status === 'fulfilled') state = s.value;
  teken();
}

/** De laadbeurten per auto: undefined is nog onderweg, null is niets te tonen. */
const beurten = new Map();
const BEURT_MS = 5 * 60_000;

async function laadBeurten(id, vers = false) {
  const b = beurten.get(id);
  if (b && (b.bezig || (!vers && Date.now() - b.at < BEURT_MS))) return;
  beurten.set(id, { at: Date.now(), data: b?.data, bezig: true });
  let data = b?.data ?? null;
  try {
    data = (await haal(`api/laadbeurten?auto=${encodeURIComponent(id)}`)).beurten ?? null;
  } catch {
    // Dan wat er al was.
  }
  beurten.set(id, { at: Date.now(), data, bezig: false });
  teken();
}

const autos = () => huisData?.opslag?.autos ?? [];
const deAuto = () => autos().find((a) => a.id === gekozen) ?? autos()[0] ?? null;

/** Laadt hij op zon? Uit het net nu: komt er niets van het net, dan is het eigen zon. */
function bron(a) {
  if (!a.laadt) return null;
  const s = state?.bewoner?.stromen;
  if (s?.netKw == null) return 'onbekend';
  if (s.netKw <= 0.05) return 'zon';
  return (s.zonKw ?? 0) > 0.1 ? 'deels' : 'net';
}

/** De stand in woorden, met zijn kleur. */
function stand(a) {
  if (a.thuis === false) return { tekst: t('auto.stand.weg'), kleur: 'var(--zacht)' };
  const b = bron(a);
  if (b === 'zon') return { tekst: t('auto.stand.zon'), kleur: 'var(--zon)', gloed: true };
  if (b === 'deels') return { tekst: t('auto.stand.deels'), kleur: 'var(--zon)', gloed: true };
  if (b === 'net') return { tekst: t('auto.stand.net'), kleur: 'var(--ijs)', gloed: true };
  if (b === 'onbekend') return { tekst: t('auto.stand.laadt'), kleur: 'var(--mint)', gloed: true };
  if (a.aangesloten && a.pct != null && a.pct >= (a.laadgrens ?? 100)) return { tekst: t('auto.stand.vol'), kleur: 'var(--mint)' };
  if (a.aangesloten === true) return { tekst: t('auto.stand.erin'), kleur: 'var(--zacht)' };
  if (a.aangesloten === false) return { tekst: t('auto.stand.eruit'), kleur: 'var(--zacht)' };
  return { tekst: t(a.thuis ? 'auto.stand.thuis' : 'auto.stand.onbekend'), kleur: 'var(--zacht)' };
}

/** De stroom per fase kort: "3 × 6 A" als ze gelijk zijn, anders "6 · 6 · 5 A". */
function fasenKort(stroomA) {
  const aan = (stroomA ?? []).filter((x) => x >= 0.5);
  if (!aan.length) return '';
  const gelijk = Math.max(...aan) - Math.min(...aan) < 0.6;
  return gelijk ? `${aan.length} × ${nl(Math.round(aan[0]), 0)} A` : `${aan.map((x) => nl(x, 0)).join(' · ')} A`;
}

/** Een tijd die nog komt: vandaag de klok, anders "morgen" erbij. */
function straks(iso) {
  const ms = Date.parse(iso);
  return new Date(ms).toDateString() === new Date().toDateString() ? klokVan(ms) : t('auto.morgen', { tijd: klokVan(ms) });
}
const geweest = (iso) => wanneer(Date.parse(iso));

function tekening(a) {
  const weg = a.thuis === false;
  const b = bron(a);
  const kabel = a.laadt ? (b === 'net' ? 'net' : 'zon') : a.aangesloten ? 'erin' : 'vrij';
  return autoTekening({
    pct: a.pct,
    grens: a.laadgrens,
    kabel,
    auto: !weg,
    // Een auto zonder laadpaal staat er alleen; een laadpaal zonder auto is de auto.
    paal: a.paalNaam != null,
    tekst: { leeg: t(`auto.tekening.leeg.${a.plek ?? 'oprit'}`) },
  });
}

/** Rechtsboven: hoe vol, of waarom de app het niet weet. */
function pctDeel(a) {
  if (a.thuis === false) return `<p>${esc(a.wegSinds ? t('auto.wegSinds', { tijd: geweest(a.wegSinds) }) : t('auto.weg'))}</p>`;
  if (a.pct == null) return `<p>${esc(t('auto.alleenPaal'))}</p>`;
  return `<b>${nl(a.pct, 0)}<sup>%</sup></b>${a.bereikKm != null ? `<span>${esc(t('auto.bereik', { km: nl(a.bereikKm, 0) }))}</span>` : ''}`;
}

/** Linksboven: de stand, en het vermogen met de stroom per fase. */
function standDeel(a) {
  const s = stand(a);
  let onder = '';
  if (a.thuis === false && a.pct != null) onder = `${nl(a.pct, 0)}%${a.bereikKm != null ? `<small>${esc(t('auto.bereik', { km: nl(a.bereikKm, 0) }))}</small>` : ''}`;
  else if (a.laadt && a.vermogenW != null) onder = `${nl(a.vermogenW / 1000)} kW${fasenKort(a.stroomA) ? `<small>${esc(fasenKort(a.stroomA))}</small>` : ''}`;
  return `<div><div class="stand"${s.gloed ? ' data-gloed' : ''} style="color: ${s.kleur}"><i></i><span>${esc(s.tekst)}</span></div>${onder ? `<div class="vermogen">${onder}</div>` : ''}</div>`;
}

/** Een paar woorden achter elkaar, met een hoofdletter vooraan. */
const huismodelZin = (delen) => {
  const s = delen.filter(Boolean).join(' · ');
  return s ? s[0].toUpperCase() + s.slice(1) : '';
};
const plekWoord = (a) => (a.plek ? t(`auto.plek.${a.plek}`) : '');

/* ---- de laadbeurten (stap 3) ---- */

const zonPct = (b) => (b.kWh > 0 && b.zonKWh != null ? Math.round((b.zonKWh / b.kWh) * 100) : null);
const zonBalk = (pct) => `<div class="zonbalk"><i style="width: ${pct}%"></i></div>`;

/** De dag van een beurt: vandaag, gisteren of de dag van de week. */
function dagVan(ms) {
  const d = new Date(ms).toDateString();
  if (d === new Date().toDateString()) return t('auto.beurt.vandaag');
  if (d === new Date(Date.now() - 86_400_000).toDateString()) return t('auto.beurt.gisteren');
  // Een week terug heeft dezelfde dag als vandaag: dan met de datum erbij.
  const oud = Date.now() - ms > 6 * 86_400_000;
  const w = taal.datum(ms, oud ? { weekday: 'long', day: 'numeric', month: 'short' } : { weekday: 'long' });
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function beurtRegel(b) {
  const tijd = `${klokVan(Date.parse(b.van))} – ${b.bezig ? t('auto.beurt.nu') : klokVan(Date.parse(b.tot))}`;
  const z = zonPct(b);
  return `<div class="beurt"${z != null ? ` title="${esc(t('auto.beurt.zonZin', { pct: z }))}"` : ''}>
      <div><b>${esc(dagVan(Date.parse(b.van)))}</b><span>${esc(tijd)}</span></div>
      <span class="kwh">${nl(b.kWh)} kWh</span><span class="eur">${b.kosten != null ? esc(taal.geld(b.kosten)) : ''}</span>
      ${z != null ? zonBalk(z) : ''}
    </div>`;
}

/** De laadbeurten van de laatste week: wat er samen geladen is, en per beurt. */
function beurtenKaart(a, hoeveel) {
  const o = beurten.get(a.id)?.data;
  // Zonder meter van het laadvermogen: niets, de laadpaal zegt al dat het niet gemeten wordt.
  if (o === null) return '';
  const kop = `<h2>${esc(t('auto.beurt.kop'))}</h2><p class="onder">${esc(t('auto.beurt.periode', { n: o?.dagen ?? 7 }))}</p>`;
  if (o === undefined) return `<section class="glas kaart beurten">${kop}<p class="kan">${esc(t('algemeen.laden'))}…</p></section>`;
  if (!o.beurten.length) return `<section class="glas kaart beurten">${kop}<p class="kan">${esc(o.statistiek ? t('auto.beurt.geen', { n: o.dagen }) : t('auto.beurt.geenStatistiek'))}</p></section>`;
  const zon = o.zonKWh != null && o.kWh > 0 ? Math.round((o.zonKWh / o.kWh) * 100) : null;
  const som = `<div class="som">
      <div><small>${esc(t('auto.beurt.geladen'))}</small><b>${nl(o.kWh)} kWh</b></div>
      ${o.kosten != null ? `<div><small>${esc(t('auto.beurt.kosten'))}</small><b>${esc(taal.geld(o.kosten))}</b></div>` : ''}
      ${zon != null ? `<div><small>${esc(t('auto.beurt.eigenZon'))}</small><b>${zon}%</b></div>` : ''}
    </div>`;
  const rest = o.beurten.length - hoeveel;
  const uitleg = o.zonKWh == null ? t('auto.beurt.zonderNet') : o.beurten.every((b) => b.kosten == null) ? t('auto.beurt.zonderPrijs') : t(o.perUur ? 'auto.beurt.uitlegUur' : 'auto.beurt.uitleg');
  return `<section class="glas kaart beurten">${kop}${som}
      <div class="lijst">${o.beurten.slice(0, hoeveel).map(beurtRegel).join('')}</div>
      <p class="meer" data-meer="${Math.max(0, rest)}"${rest > 0 ? '' : ' hidden'}>${esc(t('auto.beurt.meer', { n: Math.max(0, rest) }))}</p>
      <p class="kan">${esc(uitleg)}</p>
    </section>`;
}

/**
 * De wand scrolt nooit: past de kolom niet, dan gaan er beurten uit de lijst
 * (de oudste eerst), en zegt de regel eronder hoeveel er nog meer zijn.
 */
function pasIn(doos) {
  const lijst = doos.querySelector('.beurten .lijst');
  const meer = doos.querySelector('.beurten .meer');
  if (!lijst || !meer) return;
  let n = Number(meer.dataset.meer) || 0;
  while (doos.scrollHeight > doos.clientHeight + 1 && lijst.children.length > 1) {
    lijst.lastElementChild.remove();
    n += 1;
    meer.textContent = t('auto.beurt.meer', { n });
    meer.hidden = false;
  }
}

/** De beurt van nu, als de auto laadt. */
function dezeBeurt(a) {
  if (!a.laadt) return null;
  return beurten.get(a.id)?.data?.beurten?.find((b) => b.bezig) ?? null;
}

/** De drie feiten onder de auto: laadgrens en vol om, de kabel, de accu (of deze laadbeurt). */
function feiten(a) {
  const grens = a.laadgrens != null
    ? `<b>${nl(a.laadgrens, 0)}%</b><span>${esc(a.volOm ? t('auto.volOm', { tijd: straks(a.volOm) }) : a.pct != null && a.pct >= a.laadgrens ? t('auto.opGrens') : t('auto.inDeAuto'))}</span>`
    : `<b>${esc(t('auto.geenGrens'))}</b><span>${esc(a.volOm ? t('auto.volOm', { tijd: straks(a.volOm) }) : t('auto.geenGrensZin'))}</span>`;
  const kabelB = a.thuis === false ? t('auto.kabelEruit') : a.kabelSinds ? t('auto.kabelSinds', { tijd: geweest(a.kabelSinds) }) : a.aangesloten === true ? t('auto.kabelErin') : a.aangesloten === false ? t('auto.kabelEruit') : t('auto.kabelOnbekend');
  const waar = [a.paalNaam, plekWoord(a)].filter(Boolean).join(', ');
  // Een laadpaal zonder auto heeft geen accu; dan zegt het derde vak wat er nog kan.
  const accu = a.pct == null && a.paalNaam != null && a.accuKWh == null
    ? `<small>${esc(t('auto.feit.auto'))}</small><b>${esc(t('auto.nietInHA'))}</b><span><a href="energie.html#auto">${esc(t('auto.kiesBijEnergie'))}</a></span>`
    : a.accuKWh != null
    ? `<small>${esc(t('auto.feit.accu'))}</small><b>${esc(t('auto.accuKwh', { kwh: nl(a.accuKWh, a.accuKWh % 1 ? 1 : 0) }))}</b><span>${esc(t('auto.accuZin'))}</span>`
    : `<small>${esc(t('auto.feit.accu'))}</small><b>${esc(t('auto.accuLeeg'))}</b><span><a href="energie.html#auto">${esc(t('auto.accuWaarom'))}</a></span>`;
  // Tijdens het laden: deze laadbeurt in plaats van de accu (schets Wand-Auto).
  const nu = dezeBeurt(a);
  const z = nu ? zonPct(nu) : null;
  const derde = nu
    ? `<small>${esc(t('auto.beurt.deze'))}</small><b>${nl(nu.kWh)} kWh${nu.kosten != null ? ` · ${esc(taal.geld(nu.kosten))}` : ''}</b>${z != null ? `${zonBalk(z)}<span>${esc(t('auto.beurt.zonZin', { pct: z }))}</span>` : ''}`
    : accu;
  return `<div class="feiten">
      <div><small>${esc(t('auto.feit.laadgrens'))}</small>${grens}</div>
      <div><small>${esc(t('auto.feit.kabel'))}</small><b>${esc(kabelB)}</b>${waar ? `<span>${esc(waar)}</span>` : ''}</div>
      <div>${derde}</div>
    </div>`;
}

function held(a) {
  const zon = ['zon', 'deels'].includes(bron(a));
  return `<section class="glas held" data-zon="${zon ? 'ja' : 'nee'}">
      <div class="boven">${standDeel(a)}<div class="pct">${pctDeel(a)}</div></div>
      <div class="scene"><svg viewBox="0 52 760 228" preserveAspectRatio="xMidYMax meet" role="img" aria-label="${esc(a.pct == null ? a.naam : t('auto.tekeningLabel', { naam: a.naam, pct: nl(a.pct, 0) }))}">${tekening(a)}</svg></div>
      ${feiten(a)}
    </section>`;
}

/** De laadpaal: zijn stand, het vermogen en de stroom per fase; op de wand met de rij Laden erin. */
function paalKaart(a, metLaden = false) {
  if (a.paalNaam == null) {
    return `<section class="glas kaart"><h2>${esc(t('auto.paal.geen'))}</h2><p class="onder">${esc(t('auto.paal.geenZin'))}</p></section>`;
  }
  // Is de auto weg, dan is de laadpaal vrij; een laadpaal is niet onderweg.
  const s = a.thuis === false ? { tekst: t('auto.paal.vrij'), kleur: 'var(--zacht)' } : stand(a);
  const max = Math.max(a.paalStroomA?.max ?? 16, ...(a.stroomA ?? [0]));
  // Op de wand met de rij Laden: het vermogen staat al groot bij de auto, en wat hij kan in het blad.
  const rij = metLaden ? ladenRij(a) : '';
  const kleur = ['zon', 'deels'].includes(bron(a)) ? 'var(--zon)' : a.laadt ? 'var(--ijs)' : 'rgb(var(--wit) / 0.3)';
  const fasen = a.stroomA
    ? `<div class="fasen"><span>${esc(t(a.stroomA.length > 1 ? 'auto.paal.stroom' : 'auto.paal.stroomEen'))}</span>${a.stroomA
        .map((x, i) => `<div class="fase"><em>${a.stroomA.length > 1 ? `L${i + 1}` : ''}</em><div class="fbalk"><i style="width: ${Math.min(100, (x / max) * 100).toFixed(1)}%; background: ${kleur}"></i></div><b>${nl(x, x % 1 ? 1 : 0)} A</b></div>`)
        .join('')}</div>`
    : `<div class="regel"><span>${esc(t('auto.paal.stroom'))}</span><b>${esc(t('auto.paal.nietGemeten'))}</b></div>`;
  return `<section class="glas kaart">
      <h2>${esc(a.paalNaam)}</h2><p class="onder">${esc(huismodelZin([a.paalNaam === t('auto.paal.kop') ? '' : t('auto.paal.kop'), plekWoord(a)]))}</p>
      <div class="regel"><span>${esc(t('auto.paal.stand'))}</span><b style="color: ${s.kleur === 'var(--zacht)' ? 'var(--tekst)' : s.kleur}">${esc(s.tekst)}</b></div>
      ${rij}
      ${rij ? '' : `<div class="regel"><span>${esc(t('auto.paal.vermogen'))}</span><b>${a.vermogenW != null ? `${nl(a.vermogenW / 1000)} kW` : esc(t('auto.paal.nietGemeten'))}</b></div>`}
      ${fasen}
      ${a.paalStroomA && !rij ? `<p class="kan">${esc(t('laden.paalKan', { min: nl(a.paalStroomA.min, 0), max: nl(a.paalStroomA.max, 0) }))}</p>` : ''}
    </section>`;
}

/* ---- het advies (stap 4) ---- */

const SVG = (naam) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconen.binnen(naam)}</svg>`;

/** Vannacht, vandaag of morgen, voor het goedkoopste blok. */
function wanneerBlok(ms) {
  const uur = Number(taal.klok(ms).slice(0, 2));
  if (uur < 7 && ms - Date.now() < 18 * 3_600_000) return t('auto.advies.vannacht');
  return new Date(ms).toDateString() === new Date().toDateString() ? t('auto.advies.vandaag') : t('auto.advies.morgen');
}

/** De zin bij de zon: wat er kan, en wat er overblijft op de zekering. */
function zonZin(z) {
  const zin = t(`auto.advies.${z.soort}.zin`, { met: z.metA, nu: z.nuA ?? '', kw: nl(z.kW) });
  return z.overA != null && z.zekering ? `${zin} ${t('auto.advies.zekering', { a: z.overA, fasen: z.zekering.fasen, ampere: z.zekering.ampere })}` : zin;
}

/** De zin bij het goedkoopste blok: de prijs, en hoe ver hij komt. */
function goedkoopZin(g, a) {
  const deel = g.prijsNu != null ? (g.prijs <= g.prijsNu * 0.55 ? t('auto.advies.helft') : t('auto.advies.nu', { prijs: taal.geld(g.prijsNu) })) : '';
  const prijs = `${t('auto.advies.perKwh', { prijs: taal.geld(g.prijs) })}${deel ? `, ${deel}` : ''}.`;
  const verder = g.nietNodig && a.volOm
    ? t('auto.advies.nietNodig', { tijd: klokVan(Date.parse(a.volOm)) })
    : g.totPct != null && g.kosten != null
    ? t(g.totPct >= (a.laadgrens ?? 100) ? 'auto.advies.genoeg' : 'auto.advies.komtTot', { pct: g.totPct, uren: g.uren, kosten: taal.geld(g.kosten) })
    : '';
  return `${prijs}${verder ? ` ${verder}` : ''}`;
}

/** Het advies onder de auto: zon en prijs, alleen wat iets zegt (schets Wand-Auto). */
function adviesKaart(a) {
  const ad = adviezen?.[a.id];
  const delen = [];
  if (ad?.zon) delen.push(`<div class="zon"><span class="ik">${SVG('zon')}</span><div><b>${esc(t(`auto.advies.${ad.zon.soort}.kop`))}</b><span>${esc(zonZin(ad.zon))}</span>${snelKnop(a, ad.zon)}</div></div>`);
  if (ad?.goedkoop) {
    const g = ad.goedkoop;
    const kop = t('auto.advies.goedkoop.kop', { wanneer: wanneerBlok(Date.parse(g.van)), van: klokVan(Date.parse(g.van)), tot: klokVan(Date.parse(g.tot)) });
    delen.push(`<div class="goedkoop"><span class="ik">${SVG('klok')}</span><div><b>${esc(kop)}</b><span>${esc(goedkoopZin(g, a))}</span></div></div>`);
  }
  return delen.length ? `<section class="glas advies${delen.length === 1 ? ' een' : ''}" data-advies>${delen.join('')}</section>` : '';
}

/* ---- laden met de hand (stap 5, besluit 262; het blad Laden) ---- */

/** Per auto wat er met de hand kan en wat er loopt (`api/laden`); `aan` is false op de NAS. */
let laden = null;
/** Het blad Laden: open voor een auto, met wat er gekozen is; null als het dicht is. */
let blad = null;
let ladenFout = '';

async function laadLaden() {
  try {
    laden = await haal('api/laden');
  } catch {
    // Dan wat er al was.
  }
}

const standVan = (id) => laden?.autos?.find((x) => x.auto === id) ?? null;
/** Op hoeveel fasen hij laadt: wat nu stroom krijgt, anders wat de laadpaal meet. */
const fasenVan = (a) => {
  const aan = (a.stroomA ?? []).filter((x) => x >= 0.5).length;
  return a.laadt && aan ? aan : Math.max(1, a.stroomA?.length ?? 1);
};
const kwBij = (a, stroomA) => nl((stroomA * 230 * fasenVan(a)) / 1000);
/** De stroom van nu per fase: wat de laadpaal meet, anders waar het getal op staat. */
const nuA = (a, s) => (a.laadt && (a.stroomA ?? []).some((x) => x >= 0.5) ? Math.round(Math.max(...a.stroomA)) : s?.stroom?.nuA ?? null);
/** Tot hoeveel A het op zon past, uit het advies, of wat hij nu neemt als het al op zon gaat. */
function opZonTot(a, s) {
  const z = adviezen?.[a.id]?.zon;
  if (z) return z.metA;
  return a.laadt && bron(a) === 'zon' ? nuA(a, s) : null;
}
/** De hoogste stroom die nu kan: de laadpaal, en de zekering. */
const hoogste = (s) => Math.min(s.stroom.max, s.zekeringA ?? Infinity);
/** "Tot een tijd": drie uur vooruit, op het hele uur. */
const tijdKeuze = () => Math.ceil((Date.now() + 3 * 3_600_000) / 3_600_000) * 3_600_000;

/** De naam van een stand van evcc (besluit 278). */
const standNaam = (x) => t(`evcc.stand.${x}`);
/** Met evcc: alleen de stand, als evcc er een zegt bij deze auto. */
const metStand = (s) => s?.evcc && s.evccStand != null;

/** Wat er nu met de hand loopt, of wat de laadpaal doet, in een paar woorden. */
function ladenNuZin(a, s) {
  const x = s?.actief;
  if (x) {
    const tot = x.tot === 'pct' ? t('auto.laden.totPctKort', { pct: x.pct }) : x.tot === 'kabel' ? t('auto.laden.totKabelKort') : t('auto.laden.totKlokKort', { tijd: klokVan(x.totMs) });
    if (x.stand) return t('auto.laden.handStand', { stand: standNaam(x.stand), tot });
    return x.pauze ? t('auto.laden.handPauze', { tot }) : t('auto.laden.handStroom', { a: x.stroomA, tot });
  }
  if (metStand(s)) return [s.evccStand.nu ? t('auto.laden.evccNu', { stand: standNaam(s.evccStand.nu) }) : '', a.kabelSinds ? t('auto.laden.kabelSinds', { tijd: geweest(a.kabelSinds) }) : ''].filter(Boolean).join(' · ');
  const a0 = nuA(a, s);
  const delen = [t('auto.laden.paalZelf'), a0 != null ? `${a0} A` : '', a.kabelSinds ? t('auto.laden.kabelSinds', { tijd: geweest(a.kabelSinds) }) : ''];
  return delen.filter(Boolean).join(' · ');
}

/** Op de wand: een rij in de kaart van de laadpaal die het blad opent (de wand scrolt nooit). */
function ladenRij(a) {
  const s = standVan(a.id);
  if (!s || (!s.stroom && !s.pauze && !metStand(s))) return '';
  return `<button type="button" class="regel ladenrij" data-laden-open><span>${esc(t('auto.laden.kop'))}</span><b>${esc(ladenNuZin(a, s))} ›</b></button>`;
}

/** De regel die het blad opent, op de telefoon onder het advies. */
function ladenRegel(a) {
  const s = standVan(a.id);
  if (!s || (!s.stroom && !s.pauze && !metStand(s))) return '';
  return `<button type="button" class="glas kaart ladenregel" data-laden-open><div><b>${esc(t('auto.laden.kop'))}</b><span>${esc(ladenNuZin(a, s))}</span></div><span class="pijl" aria-hidden="true">›</span></button>`;
}

function openBlad(a) {
  const s = standVan(a.id);
  if (!s) return;
  const x = s.actief;
  const voorstel = adviezen?.[a.id]?.zon?.metA ?? nuA(a, s) ?? s.stroom?.min ?? 6;
  const pctStart = a.pct != null ? Math.min(a.laadgrens ?? 100, Math.ceil((a.pct + 10) / 5) * 5) : null;
  blad = {
    auto: a.id,
    stroomA: s.stroom ? Math.max(s.stroom.min, Math.min(hoogste(s), x?.stroomA ?? voorstel)) : null,
    tot: x?.tot ?? 'kabel',
    totMs: x?.tot === 'tijd' ? x.totMs : tijdKeuze(),
    pct: x?.pct ?? pctStart,
    // Met evcc: de stand die nu met de hand staat, anders Snel als hij nu niet al snel laadt.
    stand: metStand(s) ? (x?.stand ?? (s.evccStand.nu === 'now' ? (s.evccStand.opties.includes('pv') ? 'pv' : 'smart') : 'now')) : null,
  };
  ladenFout = '';
  tekenBlad();
}

/** Waarom er niets te bedienen is: de NAS, evcc, of nog niet aangezet bij Energie. */
function nietZin(s, a) {
  if (!laden?.aan) return t('auto.laden.alleenAddon');
  if (metStand(s)) {
    if (!s.evccMag) return t('auto.laden.nietAanEvcc');
    if (a.thuis === false || a.aangesloten === false) return t('auto.laden.geenKabel');
    return '';
  }
  if (s.evcc) return t('laden.bedienenEvcc');
  if (!s.mag) return t('auto.laden.nietAan');
  if (a.thuis === false || a.aangesloten === false) return t('auto.laden.geenKabel');
  return '';
}

/** Met evcc (besluit 278): de stand kiezen, hoe lang, en daarna weer de stand van daarvoor. */
function standBladHtml(a, s, kop, niet) {
  const b = blad;
  const kanRegel = `<p class="kan">${esc(t('auto.laden.evccKan', { standen: s.evccStand.opties.map(standNaam).join(', ') }))} <a href="energie.html#auto">${esc(t('auto.laden.instellen'))}</a></p>`;
  if (niet) return `${kop}<div class="hand-hoe">${esc(niet)}</div>${kanRegel}`;
  const knop = (x) => `<button type="button" data-laden-stand="${esc(x)}" aria-pressed="${b.stand === x}">${esc(standNaam(x))}</button>`;
  const stand = `<div class="vraag"><span>${esc(t('auto.laden.stand'))}</span><div class="seg">${s.evccStand.opties.map(knop).join('')}</div></div>`;
  const keus = (w, tekst) => `<button type="button" data-laden-tot="${w}" aria-pressed="${b.tot === w}" ${w === 'pct' && a.pct == null ? 'disabled' : ''}>${esc(tekst)}</button>`;
  const totPct = b.tot === 'pct' && b.pct != null
    ? `<div class="tot-pct"><button type="button" data-laden-pct="-5" aria-label="${esc(t('auto.laden.lager'))}">−</button><b>${b.pct}%</b><button type="button" data-laden-pct="5" aria-label="${esc(t('auto.laden.hoger'))}" ${b.pct >= (a.laadgrens ?? 100) ? 'disabled' : ''}>+</button></div>`
    : '';
  const lang = `<div class="vraag"><span>${esc(t('auto.laden.hoeLang'))}</span><div class="seg">${keus('uur', t('auto.laden.uur'))}${keus('tijd', t('auto.laden.totTijd', { tijd: klokVan(b.totMs) }))}${keus('pct', t('auto.laden.totPct'))}${keus('kabel', t('auto.laden.totKabel'))}</div>${totPct}</div>`;
  const actief = s.actief;
  // Daarna weer de stand van nu (loopt er al iets met de hand, dan staat dat al vast en zegt de knop Terug het).
  const naar = s.evccStand.nu ? standNaam(s.evccStand.nu) : 'evcc';
  const na = b.tot === 'kabel' ? t('auto.laden.naStandKabel', { stand: naar }) : b.tot === 'pct' ? t('auto.laden.naStandPct', { pct: b.pct, stand: naar }) : t('auto.laden.naStandTijd', { tijd: klokVan(b.tot === 'uur' ? Date.now() + 3_600_000 : b.totMs), stand: naar });
  const hoe = [actief?.stand ? '' : na, t('auto.laden.zelfWint')].filter(Boolean).join(' ');
  const links = actief?.stand ? `<button type="button" class="hand-terug" data-laden-terug>${esc(t('auto.laden.terugEvcc', { stand: 'evcc' }))}</button>` : '';
  const zet = b.stand ? `<button type="button" class="hand-zet" data-laden-zetstand>${esc(actief?.stand === b.stand ? t('hand.bewaar') : t('auto.laden.zetStand', { stand: standNaam(b.stand) }))}</button>` : '';
  return `${kop}${stand}${lang}<div class="hand-hoe">${esc(hoe)}</div>${ladenFout ? `<p class="hand-fout">${esc(ladenFout)}</p>` : ''}${kanRegel}<div class="hand-onder">${links}${zet}</div>`;
}

function bladHtml(a, s) {
  const b = blad;
  const niet = nietZin(s, a);
  const kop = `<div class="hand-boven"><div><h2>${esc(t('auto.laden.kop'))}</h2><p class="nu">${esc(ladenNuZin(a, s))}</p></div><button type="button" class="sluit" data-laden-sluit aria-label="${esc(t('algemeen.sluiten'))}">×</button></div>`;
  if (metStand(s)) return standBladHtml(a, s, kop, niet);
  const kan = [s.stroom ? t('laden.paalKan', { min: s.stroom.min, max: s.stroom.max }) : '', s.pauze ? t('auto.laden.kanPauze') : ''].filter(Boolean).join(' ');
  const kanRegel = `<p class="kan">${esc(`${a.paalNaam ?? a.naam}: ${kan}`)} <a href="energie.html#auto">${esc(t('auto.laden.instellen'))}</a></p>`;
  if (niet) return `${kop}<div class="hand-hoe">${esc(niet)}</div>${kanRegel}`;
  let stroom = '';
  if (s.stroom && b.stroomA != null) {
    const max = hoogste(s);
    const zon = opZonTot(a, s);
    const opZon = zon != null && b.stroomA <= zon;
    const span = (x) => (((x - s.stroom.min) / Math.max(1, s.stroom.max - s.stroom.min)) * 100).toFixed(1);
    const zonDeel = zon != null && zon > s.stroom.min ? `<i class="zon" style="left: 0; width: ${span(Math.min(zon, s.stroom.max))}%"></i>` : '';
    const dicht = max < s.stroom.max ? `<i class="dicht" style="left: ${span(max)}%; right: 0"></i>` : '';
    stroom = `<div class="vraag"><span>${esc(t('auto.laden.hoogste'))}</span>
        <div class="stroom"><button type="button" data-laden-stroom="-1" aria-label="${esc(t('auto.laden.minder'))}" ${b.stroomA <= s.stroom.min ? 'disabled' : ''}>−</button><div class="getal"><b>${b.stroomA}<small>A</small></b><span>${esc(kwBij(a, b.stroomA))} kW${zon != null ? ` · ${esc(t(opZon ? 'auto.laden.opZon' : 'auto.laden.deelsNet'))}` : ''}</span></div><button type="button" data-laden-stroom="1" aria-label="${esc(t('auto.laden.meer'))}" ${b.stroomA >= max ? 'disabled' : ''}>+</button></div>
        <div class="schaal">${zonDeel}${dicht}<b style="left: ${span(b.stroomA)}%"></b></div>
        <div class="schaal-as"><span>${s.stroom.min} A</span>${zon != null ? `<span class="zon-t">${esc(t('auto.laden.zonTot', { a: zon }))}</span>` : ''}<span>${max < s.stroom.max ? esc(t('auto.laden.zekeringTot', { a: max })) : `${s.stroom.max} A`}</span></div>
      </div>`;
  }
  const keus = (w, tekst) => `<button type="button" data-laden-tot="${w}" aria-pressed="${b.tot === w}" ${w === 'pct' && a.pct == null ? 'disabled' : ''}>${esc(tekst)}</button>`;
  const totPct = b.tot === 'pct' && b.pct != null
    ? `<div class="tot-pct"><button type="button" data-laden-pct="-5" aria-label="${esc(t('auto.laden.lager'))}">−</button><b>${b.pct}%</b><button type="button" data-laden-pct="5" aria-label="${esc(t('auto.laden.hoger'))}" ${b.pct >= (a.laadgrens ?? 100) ? 'disabled' : ''}>+</button><span>${esc(t('auto.laden.pctUitleg', { grens: a.laadgrens ?? 100 }))}</span></div>`
    : '';
  const lang = `<div class="vraag"><span>${esc(t('auto.laden.hoeLang'))}</span><div class="seg">${keus('uur', t('auto.laden.uur'))}${keus('tijd', t('auto.laden.totTijd', { tijd: klokVan(b.totMs) }))}${keus('pct', t('auto.laden.totPct'))}${keus('kabel', t('auto.laden.totKabel'))}</div>${totPct}</div>`;
  const na = b.tot === 'kabel' ? t('auto.laden.naKabel') : b.tot === 'pct' ? t('auto.laden.naPct', { pct: b.pct }) : t('auto.laden.naTijd', { tijd: klokVan(b.tot === 'uur' ? Date.now() + 3_600_000 : b.totMs) });
  const hoe = [s.zekeringA != null && b.stroomA != null ? t('auto.laden.zekeringZin', { a: Math.floor(s.zekeringA) }) : '', na, t('auto.laden.geenWolk')].filter(Boolean).join(' ');
  const actief = s.actief;
  const links = actief ? `<button type="button" class="hand-terug" data-laden-terug>${esc(t('auto.laden.terug'))}</button>` : s.pauze ? `<button type="button" class="hand-terug" data-laden-pauze ${b.tot === 'pct' ? 'disabled' : ''}>${esc(t('auto.laden.pauzeer'))}</button>` : '';
  const zet = b.stroomA != null ? `<button type="button" class="hand-zet" data-laden-zet>${esc(actief && !actief.pauze && actief.stroomA === b.stroomA ? t('hand.bewaar') : t('auto.laden.laadMet', { a: b.stroomA }))}</button>` : '';
  return `${kop}${stroom}${lang}<div class="hand-hoe">${esc(hoe)}</div>${ladenFout ? `<p class="hand-fout">${esc(ladenFout)}</p>` : ''}${kanRegel}<div class="hand-onder">${links}${zet}</div>`;
}

function tekenBlad() {
  let laag = document.querySelector('[data-ladenlaag]');
  const a = blad ? autos().find((x) => x.id === blad.auto) : null;
  const s = a ? standVan(a.id) : null;
  if (!blad || !a || !s) {
    laag?.remove();
    return;
  }
  if (!laag) {
    laag = document.createElement('div');
    laag.className = 'hand-laag laden-laag';
    laag.setAttribute('data-ladenlaag', '');
    laag.setAttribute('role', 'dialog');
    laag.setAttribute('aria-modal', 'true');
    laag.setAttribute('aria-label', t('auto.laden.kop'));
    (app.telStand() ? document.body : (document.getElementById('wand') ?? document.body)).append(laag);
  }
  laag.classList.toggle('op-tel', app.telStand());
  laag.innerHTML = `<div class="hand-achter" data-laden-sluit></div><div class="hand-vel"><section class="glas hand-blad laadblad">${bladHtml(a, s)}</section></div>`;
}

async function stuurLaden(body) {
  const res = await app.deur('api/laden', body);
  if (!res) return false;
  if (!res.ok) {
    ladenFout = (await res.json().catch(() => null))?.fout ?? t('hand.lukteNiet');
    tekenBlad();
    return false;
  }
  ladenFout = '';
  await Promise.all([laadLaden(), laad()]);
  return true;
}

document.addEventListener('click', async (e) => {
  const el = (s) => e.target.closest?.(s);
  let x;
  if (el('[data-laden-open]')) {
    const a = deAuto();
    if (a) openBlad(a);
    return;
  }
  if ((x = el('[data-laden-snel]'))) {
    // Laad met 8 A, op het advies: tot de kabel eruit gaat.
    x.disabled = true;
    await stuurLaden({ auto: x.dataset.auto, stroomA: Number(x.dataset.ladenSnel), tot: 'kabel' });
    teken();
    return;
  }
  if (!blad) return;
  const a = autos().find((y) => y.id === blad.auto);
  const s = a ? standVan(a.id) : null;
  if (el('[data-laden-sluit]')) blad = null;
  else if ((x = el('[data-laden-stroom]')) && s?.stroom) blad.stroomA = Math.max(s.stroom.min, Math.min(hoogste(s), blad.stroomA + Number(x.dataset.ladenStroom) * s.stroom.stap));
  else if ((x = el('[data-laden-tot]'))) blad.tot = x.dataset.ladenTot;
  else if ((x = el('[data-laden-stand]'))) blad.stand = x.dataset.ladenStand;
  else if (el('[data-laden-zetstand]')) {
    const ok = await stuurLaden({ auto: blad.auto, stand: blad.stand, tot: blad.tot, ...(blad.tot === 'tijd' ? { totMs: blad.totMs } : {}), ...(blad.tot === 'pct' ? { pct: blad.pct } : {}) });
    if (ok) blad = null;
  }
  else if ((x = el('[data-laden-pct]')) && a?.pct != null) blad.pct = Math.max(Math.ceil((a.pct + 1) / 5) * 5, Math.min(a.laadgrens ?? 100, blad.pct + Number(x.dataset.ladenPct)));
  else if (el('[data-laden-terug]')) {
    if (await stuurLaden({ auto: blad.auto, terug: true })) blad = null;
  } else if (el('[data-laden-pauze]')) {
    if (await stuurLaden({ auto: blad.auto, pauze: true, tot: blad.tot, ...(blad.tot === 'tijd' ? { totMs: blad.totMs } : {}) })) blad = null;
  } else if (el('[data-laden-zet]')) {
    const ok = await stuurLaden({ auto: blad.auto, stroomA: blad.stroomA, tot: blad.tot, ...(blad.tot === 'tijd' ? { totMs: blad.totMs } : {}), ...(blad.tot === 'pct' ? { pct: blad.pct } : {}) });
    if (ok) blad = null;
  } else return;
  tekenBlad();
  teken();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && blad) {
    blad = null;
    tekenBlad();
  }
});

/** "Laad met 8 A" bij het advies (stap 5): alleen als SunArc de laadpaal mag bedienen. */
function snelKnop(a, z) {
  const s = standVan(a.id);
  if (!laden?.aan || !s?.mag || !s.stroom || s.actief || !z || z.soort === 'start') return '';
  return `<button type="button" class="pil snel" data-laden-snel="${z.metA}" data-auto="${esc(a.id)}">${esc(t('auto.laden.laadMet', { a: z.metA }))}</button>`;
}

function instellenKaart() {
  return `<a class="glas kaart naar" href="energie.html#auto"><div><h2>${esc(t('auto.instellen'))}</h2><p class="onder">${esc(t('auto.instellenZin'))}</p></div><span class="pijl" aria-hidden="true">›</span></a>`;
}

function kiezer() {
  const lijst = autos();
  const a = deAuto();
  $$('[data-autos]').forEach((el) => {
    el.hidden = lijst.length < 2;
    el.innerHTML = lijst
      .map((x) => `<button type="button" data-kies="${esc(x.id)}" aria-pressed="${x.id === a?.id}"><i style="background: ${x.laadt ? 'var(--zon)' : 'var(--gedempt)'}"></i>${esc(x.naam)}</button>`)
      .join('');
  });
}

function tekenNu() {
  app.schaal();
  kiezer();
  const wandHeld = document.querySelector('[data-held]');
  const wandRechts = document.querySelector('[data-rechts]');
  const tel = document.querySelector('[data-telinhoud]');
  const a = deAuto();
  if (!a) {
    const leeg = `<section class="glas leeg"><h2>${esc(fout ? t('auto.nogNiet') : huisData ? t('laden.nietsKop') : t('algemeen.laden'))}</h2>${huisData || fout ? `<p>${esc(fout ?? t('auto.nietsZin'))}</p><a class="knop knop-licht" href="energie.html#auto">${esc(t('auto.naarEnergie'))}</a>` : ''}</section>`;
    wandHeld.innerHTML = leeg;
    wandRechts.innerHTML = '';
    tel.innerHTML = leeg;
    return;
  }
  void laadBeurten(a.id);
  wandHeld.innerHTML = `${held(a)}${adviesKaart(a)}`;
  // De wand scrolt nooit: daar de laatste beurten die passen, en Instellen bovenin; de telefoon heeft de hele week.
  wandRechts.innerHTML = `${paalKaart(a, true)}${beurtenKaart(a, 3)}`;
  pasIn(wandRechts);
  tel.innerHTML = `${held(a)}${adviesKaart(a)}${ladenRegel(a)}${paalKaart(a)}${beurtenKaart(a, 20)}${instellenKaart()}`;
  // Vanaf Thuis met "Meer keuzes": meteen het blad Laden.
  if (openOpStart && standVan(a.id)) {
    openOpStart = false;
    openBlad(a);
  } else if (blad) tekenBlad();
}
let openOpStart = new URLSearchParams(location.search).has('laden');

const teken = app.gebundeld(tekenNu);
addEventListener('standwissel', teken);

document.addEventListener('click', (e) => {
  const knop = e.target.closest?.('[data-kies]');
  if (!knop) return;
  gekozen = knop.dataset.kies;
  history.replaceState(null, '', `#${encodeURIComponent(gekozen)}`);
  tekenNu();
});
addEventListener('hashchange', () => {
  gekozen = decodeURIComponent(location.hash.slice(1)) || null;
  teken();
});

app.start('apparaten');
void laad();
setInterval(() => void laad(), 30_000);
// In het voorbeeldhuis verschuift de klok (besluit 237): dan meteen vers.
addEventListener('voorbeeldklok', () => {
  void laad();
  const a = deAuto();
  if (a) void laadBeurten(a.id, true);
});
app.live((nieuw) => {
  state = nieuw;
  teken();
});
