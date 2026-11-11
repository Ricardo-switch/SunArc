/*
 * Apparaat toevoegen (besluit 293, schets Wand-Apparaat-Toevoegen): een eigen
 * scherm in de tab Apparaten, in plaats van Regeling › Op zon (besluit 295).
 *
 * Links wat SunArc in Home Assistant vond en nog niet is ingedeeld: een
 * schakelaar die nog niet is ingesteld, zonder kamer, nog niet op zon, of een
 * auto, laadpaal of accu die uit staat. Rechts zelf kiezen per soort. Elk gaat
 * naar de plek waar het ingesteld wordt; een schakelaar (besluit 297) stel je
 * hier zelf in: wat hij aanzet, de naam, waar, en wat SunArc mag.
 */
'use strict';

const { $$, esc, haal, deur } = app;
const { t } = taal;

let huisData = null;
let aansluiting = null;
/** De schakelaars met de keuzes (besluit 297), en of SunArc ze hier kan bedienen. */
let schakelaars = [];
let schakelaarsMagBedienen = false;
/** Wat de bewoner in het paneel aan het kiezen is, tot hij bewaart. */
let concept = null;

/** Per soort: het icoon, het vlak erachter en waar je hem toevoegt. */
const SOORTEN = [
  ['klimaat', 'airco', '111, 211, 255', 'inrichten.html#klimaat'],
  ['licht', 'lamp', '247, 181, 72', 'indeling.html'],
  ['water', 'boiler', '255, 122, 77', 'regeling.html#opzon'],
  ['witgoed', 'witgoed', '110, 231, 183', 'regeling.html#opzon'],
  ['auto', 'auto', '143, 134, 255', 'energie.html#auto'],
  ['energie', 'batterij', '110, 231, 183', 'energie.html#accu'],
  ['stekkers', 'stekker', '201, 211, 220', 'regeling.html#opzon'],
  ['schakelaars', 'apparaat', '201, 211, 220', '#schakelaars'],
];

/** Wat er aan een schakelaar kan hangen, met zijn icoon. */
const WAT = [
  ['lamp', 'lamp'],
  ['kachel', 'warm'],
  ['ventilator', 'ventilatie'],
  ['pomp', 'vocht'],
  ['boiler', 'boiler'],
  ['fietslader', 'stekker'],
  ['anders', 'apparaat'],
];

/** Het icoon en de naam van een ding, voor de regel links. */
const DING = {
  licht: ['lamp', 'toev.ding.licht'],
  klimaat: ['airco', 'toev.ding.klimaat'],
  stekker: ['stekker', 'toev.ding.stekker'],
  boiler: ['boiler', 'toev.ding.boiler'],
  jacuzzi: ['jacuzzi', 'toev.ding.jacuzzi'],
  auto: ['auto', 'toev.ding.auto'],
  laadpaal: ['laadpaal', 'toev.ding.laadpaal'],
  accu: ['batterij', 'toev.ding.accu'],
};
const ding = (soort) => DING[soort] ?? ['apparaat', 'toev.ding.anders'];

/** Wat er bij een schakelaar staat: schakelaar of IR, en met hoeveel knoppen. */
const schakelaarZin = (s) => (s.ir ? t('toev.ir', { n: s.knoppen.length }) : s.knoppen.length > 1 ? t('toev.schakelaarKnoppen', { n: s.knoppen.length }) : t('toev.schakelaar'));

/**
 * Wat nieuw gevonden is en nog niet ingedeeld: een schakelaar zonder keuze,
 * zonder kamer (naar Indeling), nog niet op zon (naar Regeling), of uit bij
 * Energie. Dezelfde telling staat op de knop Toevoegen bij Apparaten.
 */
function nieuwGevonden() {
  const uit = [];
  for (const s of schakelaars) if (!s.keuze) uit.push({ naam: s.naam, icoon: s.ir ? 'warm' : 'apparaat', klein: `${schakelaarZin(s)} · ${t('toev.nietIngesteld')}`, href: `#s-${encodeURIComponent(s.id)}` });
  for (const d of huisData?.zonderRuimte ?? []) uit.push({ naam: d.naam, soort: d.soort, zin: 'toev.zonderKamer', href: 'indeling.html#los' });
  const opZon = aansluiting?.antwoorden?.opZon ?? {};
  // Wat al in de configuratie op zon staat (zoals een droger uit het bestand), is niet nieuw: Regeling toont het al (besluit 296).
  const vast = new Set((aansluiting?.configuratie?.apparaten ?? []).map((x) => x.id));
  for (const d of aansluiting?.gevonden?.apparaten ?? []) if (opZon[d.id] !== true && !vast.has(d.id)) uit.push({ naam: d.naam, soort: d.soort, zin: 'toev.nietOpZon', href: 'regeling.html#opzon' });
  for (const d of aansluiting?.laden?.apparaten ?? []) if (!d.aan) uit.push({ naam: d.naam, soort: d.rol, zin: 'toev.uit', href: 'energie.html#auto' });
  for (const d of aansluiting?.accu?.apparaten ?? []) if (!d.aan) uit.push({ naam: d.naam, soort: 'accu', zin: 'toev.uit', href: 'energie.html#accu' });
  return uit;
}

function rij(d) {
  const [icoon, wat] = d.icoon ? [d.icoon, null] : ding(d.soort);
  const klein = d.klein ?? t(d.zin, { wat: t(wat) });
  const nu = location.hash === d.href;
  return `<a class="rij${nu ? ' nu' : ''}" href="${d.href}"><span class="ik">${iconen.svg(icoon)}</span><b>${esc(d.naam)}</b><small>${esc(klein)}</small><span class="pijl" aria-hidden="true">›</span></a>`;
}

/* ------------------------------------------------- een schakelaar (296) */

/** De kamers uit het huis, om er een te kiezen. */
const kamers = () => (huisData?.etages ?? []).flatMap((e) => (e.ruimtes ?? []).map((r) => ({ id: r.id, naam: r.naam })));

function paneel(s) {
  if (!concept || concept.id !== s.id) {
    const k = s.keuze;
    concept = { id: s.id, wat: k?.wat ?? null, naam: k?.naam ?? '', kamer: k?.kamer ?? '', mag: k?.mag ?? 'kijken', knoppen: { ...(k?.knoppen ?? {}) }, vermogenW: k?.vermogenW != null ? String(k.vermogenW) : '' };
  }
  const c = concept;
  const keuzes = WAT.map(([w, icoon]) => `<button type="button" class="watkeuze" data-wat="${w}" aria-pressed="${c.wat === w}">${iconen.svg(icoon)}<span>${esc(t(`toev.wat.${w}`))}</span></button>`).join('');
  const onder = c.wat ? t(c.wat === 'lamp' ? 'toev.watLamp' : 'toev.watAnders') : '';
  const knoppen = s.knoppen.length > 1
    ? `<div class="stap"><b>${esc(t('toev.knoppen'))}${s.zonderCode ? `<small>${esc(t('toev.zonderCode', { n: s.zonderCode }))}</small>` : ''}</b><div class="knoppen">${s.knoppen.map((k, i) => `<label class="knoplabel"><span>${esc(t('toev.knop', { n: i + 1 }))}</span><input type="text" maxlength="60" data-knop="${esc(k.id)}" value="${esc(c.knoppen[k.id] ?? '')}" placeholder="${esc(t('toev.knopNaam'))}"></label>`).join('')}</div></div>`
    : '';
  const opties = [`<option value="">${esc(t(s.gebied ? 'toev.zoalsHa' : 'toev.geenKamer'))}</option>`, ...kamers().map((k) => `<option value="${esc(k.id)}" ${c.kamer === k.id ? 'selected' : ''}>${esc(k.naam)}</option>`)].join('');
  const meet = s.meet ? t('toev.meet') : t('toev.geenMeter');
  const let_ = s.aanname ? `<p class="let">${esc(t(s.ir ? 'toev.aannameIr' : 'toev.aanname'))}</p>` : '';
  return `
    <div class="wie"><span class="ik">${iconen.svg(s.ir ? 'warm' : 'apparaat')}</span><div><h2>${esc(s.naam)}</h2><small>${esc([schakelaarZin(s), s.model ?? s.koppeling, meet].filter(Boolean).join(' · '))}</small></div></div>
    <div class="stap"><b>${esc(t(s.ir ? 'toev.watBedient' : 'toev.watAan'))}</b><div><div class="watkeuzes" role="group">${keuzes}</div>${onder ? `<p class="onder">${esc(onder)}</p>` : ''}</div></div>
    ${knoppen}
    <div class="stap"><b>${esc(t('toev.naam'))}</b><input type="text" class="invoer" maxlength="60" data-naam value="${esc(c.naam)}" placeholder="${esc(s.naam)}"></div>
    <div class="stap"><b>${esc(t('toev.waar'))}</b><select class="invoer" data-kamer>${opties}</select></div>
    ${s.meet ? '' : `<div class="stap"><b>${esc(t('toev.vermogen'))}<small>${esc(t('toev.vermogenKlein'))}</small></b><div><input type="number" class="invoer" min="1" max="10000" step="1" inputmode="numeric" data-vermogen value="${esc(c.vermogenW)}" placeholder="W"><p class="onder">${esc(t('toev.vermogenUitleg'))}</p></div></div>`}
    <div class="stap"><b>${esc(t('toev.watMag'))}</b><div><div class="seg" role="group"><button type="button" data-mag="kijken" aria-pressed="${c.mag === 'kijken'}">${esc(t('toev.kijken'))}</button><button type="button" data-mag="hand" aria-pressed="${c.mag === 'hand'}">${esc(t('toev.hand'))}</button></div><p class="onder">${esc(t(s.meet ? 'toev.opZonLater' : 'toev.opZonNiet'))}</p></div></div>
    ${let_}
    <p class="fout" data-fout aria-live="polite"></p>
    <div class="klaar"><button type="button" class="knop hoofd" data-bewaar ${c.wat ? '' : 'disabled'}>${esc(t(s.keuze ? 'toev.bewaar' : 'toev.voegToe'))}</button>${s.keuze ? `<button type="button" class="stil" data-weg>${esc(t('toev.weg'))}</button>` : `<button type="button" class="stil" data-geen>${esc(t('toev.geen'))}</button>`}</div>`;
}

/** Alle schakelaars, ook die al ingesteld zijn, om er een te kiezen. */
function lijstSchakelaars() {
  const rijen = schakelaars.map((s) => rij({ naam: s.keuze?.naam || s.naam, icoon: s.ir ? 'warm' : 'apparaat', klein: `${schakelaarZin(s)} · ${s.keuze ? t(`toev.wat.${s.keuze.wat}`) : t('toev.nietIngesteld')}`, href: `#s-${encodeURIComponent(s.id)}` })).join('');
  return `<div><h2>${esc(t('apparaten.soort.schakelaars'))}</h2><p class="lead">${esc(t('toev.schakelaarsLead'))}</p></div><div class="lijst">${rijen || `<p class="leeg">${esc(t('toev.geenSchakelaars'))}</p>`}</div>`;
}

async function bewaar(body) {
  const fout = $$('[data-fout]');
  try {
    const res = await deur('api/schakelaars', body);
    if (res === null) return;
    const uit = await res.json().catch(() => ({}));
    if (!res.ok) {
      fout.forEach((el) => (el.textContent = uit.fout ?? t('kamer.mislukt')));
      return;
    }
    schakelaars = uit.schakelaars ?? schakelaars;
    concept = null;
    // Terug naar de keuze van de soort; het huis leest de nieuwe lamp bij het volgende verversen.
    location.hash = '';
    void laad();
  } catch {
    fout.forEach((el) => (el.textContent = t('kamer.geenVerbinding')));
  }
}

document.addEventListener('click', (e) => {
  const doel = e.target.closest('[data-wat], [data-mag], [data-bewaar], [data-geen], [data-weg]');
  if (!doel || !concept) return;
  if (doel.dataset.wat) concept.wat = doel.dataset.wat;
  else if (doel.dataset.mag) concept.mag = doel.dataset.mag;
  else if (doel.hasAttribute('data-geen')) return void bewaar({ id: concept.id, geen: true });
  else if (doel.hasAttribute('data-weg')) return void bewaar({ id: concept.id, weg: true });
  else if (doel.hasAttribute('data-bewaar')) return void bewaar({ id: concept.id, wat: concept.wat, naam: concept.naam, kamer: concept.kamer || null, mag: concept.mag, knoppen: concept.knoppen, vermogenW: /^\d+$/.test(String(concept.vermogenW).trim()) ? Number(concept.vermogenW) : null });
  teken();
});
document.addEventListener('input', (e) => {
  if (!concept) return;
  const el = e.target;
  if (el.matches('[data-naam]')) concept.naam = el.value;
  else if (el.matches('[data-kamer]')) concept.kamer = el.value;
  else if (el.matches('[data-knop]')) concept.knoppen[el.dataset.knop] = el.value;
  else if (el.matches('[data-vermogen]')) concept.vermogenW = el.value;
});

/* ------------------------------------------------------------ tekenen */

function teken() {
  app.schaal();
  const lijst = nieuwGevonden();
  const rijen = lijst.length ? lijst.map(rij).join('') : `<p class="leeg">${esc(t('toev.geenNieuw'))}</p>`;
  $$('[data-nieuw]').forEach((el) => (el.innerHTML = rijen));
  const hash = decodeURIComponent(location.hash.slice(1));
  const open = hash.startsWith('s-') ? schakelaars.find((s) => s.id === hash.slice(2)) : null;
  if (!open) concept = null;
  const focus = document.activeElement?.matches?.('input, select') ? document.activeElement.dataset : null;
  const rechts = open ? paneel(open) : hash === 'schakelaars' ? lijstSchakelaars() : null;
  $$('[data-rechts]').forEach((el) => {
    el.hidden = rechts == null;
    if (rechts != null) el.innerHTML = rechts;
  });
  // `display: contents` zou `hidden` overschrijven: daarom de stijl zelf.
  $$('[data-kiezen]').forEach((el) => (el.style.display = rechts != null ? 'none' : 'contents'));
  // Met een schakelaar open gaat terug naar Toevoegen, anders naar Apparaten.
  $$('a.terug').forEach((a) => {
    a.href = rechts != null ? 'toevoegen.html' : 'apparaten.html';
    a.lastElementChild.textContent = t(rechts != null ? 'toev.titelKort' : 'nav.apparaten');
  });
  // Wie aan het typen was, blijft in hetzelfde veld.
  if (focus) $$(`[data-rechts] ${focus.knop ? `[data-knop="${focus.knop}"]` : focus.naam != null ? '[data-naam]' : focus.vermogen != null ? '[data-vermogen]' : '[data-kamer]'}`).find((x) => x.offsetParent)?.focus();
  const tegels = SOORTEN.filter(([id]) => id !== 'schakelaars' || schakelaars.length > 0)
    .map(([id, icoon, vlak, href]) => `<a class="soort" href="${href}" data-soort="${id}"><span class="ik" style="background: rgba(${vlak}, 0.14)">${iconen.svg(icoon)}</span><b>${esc(t(`apparaten.soort.${id}`))}</b><span>${esc(t(`toev.soort.${id}`))}</span></a>`)
    .join('');
  $$('[data-soorten]').forEach((el) => (el.innerHTML = tegels));
}

async function laad() {
  const [h, a, s] = await Promise.allSettled([haal('api/huis'), haal('api/aansluiting'), haal('api/schakelaars')]);
  if (h.status === 'fulfilled') huisData = h.value;
  if (a.status === 'fulfilled') aansluiting = a.value;
  if (s.status === 'fulfilled') {
    schakelaars = s.value?.schakelaars ?? [];
    schakelaarsMagBedienen = s.value?.bedienen === true;
  }
  void schakelaarsMagBedienen;
  teken();
}

addEventListener('standwissel', teken);
addEventListener('hashchange', teken);
app.start('apparaten');
teken();
void laad();
