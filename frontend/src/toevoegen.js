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
/** De slimme stekkers (besluit 300), om er een bij een kachel te kiezen. */
let stekkers = [];
/** Wat bij Klimaat komt in plaats van bij Schakelaars (besluit 300). */
const KLIMAAT_WAT = new Set(['kachel', 'ventilator']);

/** Een stekker die bij deze schakelaar lijkt te horen: een woord van vier letters of meer uit de naam of het gebied. */
function stekkerVoorstel(s) {
  const woorden = `${s.naam} ${s.gebied ?? ''}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !/heater|switch|remote|smart|plug/.test(w));
  return stekkers.find((st) => woorden.some((w) => st.naam.toLowerCase().includes(w)))?.id ?? '';
}
let schakelaarsMagBedienen = false;
/** Wat de bewoner in het paneel aan het kiezen is, tot hij bewaart. */
let concept = null;

/* --------------------------------- een laadpaal uit losse sensoren (301) */

/** Wat gekozen is en de sensoren zonder apparaat, van `api/losse-laadpaal`. */
let losse = { laadpalen: {}, sensoren: [] };
/** Wat de bewoner aan het kiezen is. */
let lConcept = { naam: '', zoek: '', gekozen: new Set() };
const slug = (x) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'laadpaal';

function lossePaneel() {
  const zoek = lConcept.zoek.trim().toLowerCase();
  const passend = losse.sensoren.filter((x) => !zoek || `${x.id} ${x.naam}`.toLowerCase().includes(zoek));
  const groepen = ['vermogen', 'stroom', 'energie', 'stand', 'overig']
    .map((soort) => {
      const rijen = passend.filter((x) => x.soort === soort).slice(0, 30);
      if (!rijen.length) return '';
      const uitleg = soort === 'overig' ? `<p class="onder">${esc(t('toev.losse.overigZin'))}</p>` : '';
      return `<div class="lgroep"><h3>${esc(t(`toev.losse.${soort === 'energie' ? 'energie2' : soort}`))}</h3>${uitleg}${rijen.map((x) => `<label class="lsensor"><input type="checkbox" data-lsensor="${esc(x.id)}" ${lConcept.gekozen.has(x.id) ? 'checked' : ''}><span><b>${esc(x.naam)}</b><small>${esc(x.id)}</small></span><em>${esc(`${x.staat}${x.eenheid ? ` ${x.eenheid}` : ''}`)}</em></label>`).join('')}</div>`;
    })
    .join('');
  const bestaand = Object.entries(losse.laadpalen ?? {});
  const lijst = bestaand.length
    ? `<div class="stap"><b>${esc(t('toev.losse.al'))}</b><div class="lijst">${bestaand.map(([id, l]) => `<div class="rij"><span class="ik">${iconen.svg('laadpaal')}</span><b>${esc(l.naam)}</b><small>${esc(t('toev.losse.n', { n: l.sensoren.length }))} · <a href="apparaten.html#laden-lijst">${esc(t('toev.losse.energie'))}</a></small><button type="button" class="stil" data-lweg="${esc(id)}">${esc(t('toev.weg'))}</button></div>`).join('')}</div></div>`
    : '';
  return `
    <div class="wie"><span class="ik">${iconen.svg('laadpaal')}</span><div><h2>${esc(t('toev.losse.titel'))}</h2><small>${esc(t('toev.losse.lead'))}</small></div></div>
    ${lijst}
    <div class="stap"><b>${esc(t('toev.naam'))}</b><input type="text" class="invoer" maxlength="60" data-lnaam value="${esc(lConcept.naam)}" placeholder="${esc(t('toev.losse.naamVoorbeeld'))}"></div>
    <div class="stap"><b>${esc(t('toev.losse.zoek'))}</b><input type="search" class="invoer" data-lzoek value="${esc(lConcept.zoek)}" placeholder="${esc(t('toev.losse.zoekVoorbeeld'))}"></div>
    <div class="stap"><b>${esc(t('toev.losse.sensoren'))}<small>${esc(t('toev.losse.gekozen', { n: lConcept.gekozen.size }))}</small></b><div>${groepen || `<p class="onder">${esc(t(losse.sensoren.length ? 'toev.losse.geenPassend' : 'toev.losse.geen'))}</p>`}</div></div>
    <p class="fout" data-fout aria-live="polite"></p>
    <div class="klaar"><button type="button" class="knop hoofd" data-lbewaar ${lConcept.gekozen.size && lConcept.naam.trim() ? '' : 'disabled'}>${esc(t('toev.voegToe'))}</button></div>`;
}

async function bewaarLosse(body) {
  try {
    const res = await deur('api/losse-laadpaal', body);
    if (res === null) return;
    const uit = await res.json().catch(() => ({}));
    if (!res.ok) {
      $$('[data-fout]').forEach((el) => (el.textContent = uit.fout ?? t('kamer.mislukt')));
      return;
    }
    losse = { laadpalen: uit.laadpalen ?? {}, sensoren: uit.sensoren ?? losse.sensoren };
    lConcept = { naam: '', zoek: '', gekozen: new Set() };
    teken();
  } catch {
    $$('[data-fout]').forEach((el) => (el.textContent = t('kamer.geenVerbinding')));
  }
}

document.addEventListener('click', (e) => {
  const weg = e.target.closest('[data-lweg]');
  if (weg) return void bewaarLosse({ id: weg.dataset.lweg, weg: true });
  if (e.target.closest('[data-lbewaar]')) return void bewaarLosse({ id: `losse-${slug(lConcept.naam)}`, naam: lConcept.naam.trim(), sensoren: [...lConcept.gekozen] });
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.matches?.('[data-lnaam]')) {
    lConcept.naam = el.value;
    $$('[data-lbewaar]').forEach((b) => (b.disabled = !(lConcept.gekozen.size && lConcept.naam.trim())));
  } else if (el.matches?.('[data-lzoek]')) {
    lConcept.zoek = el.value;
    teken();
  } else if (el.matches?.('[data-lsensor]')) {
    if (el.checked) lConcept.gekozen.add(el.dataset.lsensor);
    else lConcept.gekozen.delete(el.dataset.lsensor);
    teken();
  }
});

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

/** Wat er bij een schakelaar staat: schakelaar of IR, en met hoeveel knoppen. */
const schakelaarZin = (s) => (s.ir ? t('toev.ir', { n: s.knoppen.length }) : s.knoppen.length > 1 ? t('toev.schakelaarKnoppen', { n: s.knoppen.length }) : t('toev.schakelaar'));

/* ------------------------------------------------- een schakelaar (296) */

/** De kamers uit het huis, om er een te kiezen. */
const kamers = () => (huisData?.etages ?? []).flatMap((e) => (e.ruimtes ?? []).map((r) => ({ id: r.id, naam: r.naam })));

function paneel(s) {
  if (!concept || concept.id !== s.id) {
    const k = s.keuze;
    concept = { id: s.id, wat: k?.wat ?? null, naam: k?.naam ?? '', kamer: k?.kamer ?? '', mag: k?.mag ?? 'kijken', knoppen: { ...(k?.knoppen ?? {}) }, vermogenW: k?.vermogenW != null ? String(k.vermogenW) : '', stekker: k ? k.stekker ?? '' : stekkerVoorstel(s) };
  }
  const c = concept;
  const keuzes = WAT.map(([w, icoon]) => `<button type="button" class="watkeuze" data-wat="${w}" aria-pressed="${c.wat === w}">${iconen.svg(icoon)}<span>${esc(t(`toev.wat.${w}`))}</span></button>`).join('');
  const onder = c.wat ? t(c.wat === 'lamp' ? 'toev.watLamp' : KLIMAAT_WAT.has(c.wat) ? 'toev.watKlimaat' : 'toev.watAnders') : '';
  // Hoort erbij (besluit 300): de stekker die de stroom geeft en meet, en de temperatuur van het apparaat zelf.
  const erbij = c.wat && c.wat !== 'lamp' && (stekkers.length || s.temperatuurC != null)
    ? `<div class="stap"><b>${esc(t('toev.hoortErbij'))}</b><div>${stekkers.length ? `<select class="invoer" data-stekker aria-label="${esc(t('toev.stekker'))}"><option value="">${esc(t('toev.geenStekker'))}</option>${stekkers.map((st) => `<option value="${esc(st.id)}" ${c.stekker === st.id ? 'selected' : ''}>${esc(t('toev.stekkerNaam', { naam: st.naam }))}</option>`).join('')}</select><p class="onder">${esc(t('toev.stekkerUitleg'))}</p>` : ''}${s.temperatuurC != null ? `<p class="onder">${esc(t('toev.temperatuur', { c: String(s.temperatuurC).replace('.', ',') }))}</p>` : ''}</div></div>`
    : '';
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
    ${erbij}
    <div class="stap"><b>${esc(t('toev.naam'))}</b><input type="text" class="invoer" maxlength="60" data-naam value="${esc(c.naam)}" placeholder="${esc(s.naam)}"></div>
    <div class="stap"><b>${esc(t('toev.waar'))}</b><select class="invoer" data-kamer>${opties}</select></div>
    ${s.meet || c.stekker ? '' : `<div class="stap"><b>${esc(t('toev.vermogen'))}<small>${esc(t('toev.vermogenKlein'))}</small></b><div><input type="number" class="invoer" min="1" max="10000" step="1" inputmode="numeric" data-vermogen value="${esc(c.vermogenW)}" placeholder="W"><p class="onder">${esc(t('toev.vermogenUitleg'))}</p></div></div>`}
    <div class="stap"><b>${esc(t('toev.watMag'))}</b><div><div class="seg" role="group"><button type="button" data-mag="kijken" aria-pressed="${c.mag === 'kijken'}">${esc(t('toev.kijken'))}</button><button type="button" data-mag="hand" aria-pressed="${c.mag === 'hand'}">${esc(t('toev.hand'))}</button></div><p class="onder">${esc(t(s.meet || c.stekker ? 'toev.opZonLater' : 'toev.opZonNiet'))}</p></div></div>
    ${let_}
    <p class="fout" data-fout aria-live="polite"></p>
    <div class="klaar"><button type="button" class="knop hoofd" data-bewaar ${c.wat ? '' : 'disabled'}>${esc(t(s.keuze ? 'toev.bewaar' : 'toev.voegToe'))}</button>${s.keuze ? `<button type="button" class="stil" data-weg>${esc(t('toev.weg'))}</button>` : `<button type="button" class="stil" data-geen>${esc(t('toev.verbergen'))}</button>`}</div>`;
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
  else if (doel.hasAttribute('data-bewaar')) return void bewaar({ id: concept.id, wat: concept.wat, naam: concept.naam, kamer: concept.kamer || null, mag: concept.mag, knoppen: concept.knoppen, vermogenW: !concept.stekker && /^\d+$/.test(String(concept.vermogenW).trim()) ? Number(concept.vermogenW) : null, stekker: concept.stekker || null });
  teken();
});
document.addEventListener('input', (e) => {
  if (!concept) return;
  const el = e.target;
  if (el.matches('[data-naam]')) concept.naam = el.value;
  else if (el.matches('[data-kamer]')) concept.kamer = el.value;
  else if (el.matches('[data-knop]')) concept.knoppen[el.dataset.knop] = el.value;
  else if (el.matches('[data-vermogen]')) concept.vermogenW = el.value;
  else if (el.matches('[data-stekker]')) {
    concept.stekker = el.value;
    teken();
  }
});


/* ------------------------------------- Toevoegen maakt klaar (versie 3) */

/*
 * Versie 3 van de apparaatkaart (schets Wand-Toevoegen-Klaar, goedgekeurd 18
 * november 2026): links de soort, in het midden wat SunArc van die soort vond
 * (nieuw bovenaan, wat al klaar is met een vinkje), rechts het blad om er een
 * meteen klaar te zetten. Het blad gebruikt dezelfde regels als de kaart op
 * Apparaten (instellen.js), zodat Waar, Op zon en Met de hand op één plek
 * geregeld zijn. Onderaan Verbergen, in plaats van "Dit is geen apparaat".
 *
 * Nieuw is: een schakelaar zonder keuze, een apparaat zonder kamer, witgoed of
 * een boiler zonder kamer en niet op zon, of een auto, laadpaal of accu die
 * niet meedoet. Dezelfde telling staat op de knop Toevoegen bij Apparaten.
 *
 * Adres: #soort of #soort/id, #nieuw, #verborgen; van eerder #s-id, #schakelaars
 * en #losse. Op de telefoon zijn het drie stappen: de soorten, de lijst, en het
 * blad van onderen.
 */

/** De soorten in de volgorde van Apparaten, met hun icoon. */
const ORDE = [
  ['klimaat', 'airco'],
  ['licht', 'lamp'],
  ['water', 'boiler'],
  ['witgoed', 'witgoed'],
  ['auto', 'auto'],
  ['energie', 'batterij'],
  ['stekkers', 'stekker'],
  ['schakelaars', 'apparaat'],
  ['losse', 'laadpaal'],
];
const WITGOED = new Set(['wasmachine', 'droger', 'vaatwasser', 'wasdroger']);
const WATER = new Set(['boiler', 'jacuzzi']);

/** De warmtebuffers van `api/state` (boilers en stekkers op zon), en of SunArc stekkers mag schakelen. */
let buffers = [];
let stekkerAan = false;
/** Schakelaars die verborgen zijn, om terug te halen. */
let schakelaarsVerborgen = [];

/** De ruimte waar een apparaat staat, of null. */
function ruimteVan(id) {
  for (const e of huisData?.etages ?? []) for (const r of e.ruimtes ?? []) if ((r.apparaten ?? []).some((a) => a.id === id || a.actuatorId === id)) return r;
  return null;
}
const zonderKamer = () => new Set((huisData?.zonderRuimte ?? []).map((d) => d.id));
const isStekker = (id) => /^stekker-/.test(id) || stekkers.some((x) => x.id === id) || buffers.some((b) => b.id === id && b.soort === 'stekker') || (aansluiting?.gevonden?.apparaten ?? []).some((a) => a.id === id && a.soort === 'stekker');
const bijSchakelaar = () => new Set(schakelaars.flatMap((x) => [x.keuze?.stekker, x.opZonId]).filter(Boolean));
const plekZin = (id, nieuwZin = t('toev.nogGeenKamer')) => ruimteVan(id)?.naam ?? nieuwZin;

/**
 * Wat SunArc van een soort vond: { id, naam, icoon, zin, nieuw, wat }. `wat` zegt
 * welke regels het blad krijgt: stekker, witgoed, buffer, klimaat, licht, laden,
 * accu of schakelaar.
 */
function itemsVan(soort) {
  const zonder = zonderKamer();
  const opZon = aansluiting?.antwoorden?.opZon ?? {};
  const vast = new Set((aansluiting?.configuratie?.apparaten ?? []).map((x) => x.id));
  const uit = [];
  const huisSoort = (s, icoon, wat) => {
    // Een thermostaat of radiatorknop met zijn eigen icoon, niet dat van een airco.
    const ik = (a) => (s !== 'klimaat' ? icoon : a.klimaat?.kanKoelen ? 'airco' : a.radiatorknop ? 'verwarming' : 'klimaat');
    for (const e of huisData?.etages ?? []) for (const r of e.ruimtes ?? []) for (const a of r.apparaten ?? []) if (a.soort === s) uit.push({ id: a.id, naam: a.naam, icoon: ik(a), zin: r.naam, nieuw: false, wat });
    for (const d of huisData?.zonderRuimte ?? []) if (d.soort === s) uit.push({ id: d.id, naam: d.naam, icoon: ik(d), zin: t('toev.nogGeenKamer'), nieuw: true, wat });
  };
  if (soort === 'klimaat') huisSoort('klimaat', 'airco', 'klimaat');
  else if (soort === 'licht') huisSoort('licht', 'lamp', 'licht');
  else if (soort === 'water') {
    for (const b of buffers) if (b.soort !== 'stekker') uit.push({ id: b.id, naam: b.naam, icoon: b.soort === 'jacuzzi' ? 'jacuzzi' : 'boiler', zin: plekZin(b.id, b.kop ?? ''), nieuw: false, wat: 'buffer' });
    for (const g of aansluiting?.gevonden?.apparaten ?? []) {
      if (!WATER.has(g.soort) || uit.some((x) => x.id === g.id)) continue;
      uit.push({ id: g.id, naam: g.naam, icoon: g.soort === 'jacuzzi' ? 'jacuzzi' : 'boiler', zin: plekZin(g.id), nieuw: !ruimteVan(g.id) && opZon[g.id] !== true, wat: 'buffer' });
    }
  } else if (soort === 'witgoed') {
    const alle = [...(aansluiting?.configuratie?.apparaten ?? []).filter((x) => !isStekker(x.id)), ...(aansluiting?.gevonden?.apparaten ?? []).filter((g) => WITGOED.has(g.soort))];
    for (const g of alle) {
      if (uit.some((x) => x.id === g.id)) continue;
      const zon = vast.has(g.id) || opZon[g.id] === true;
      uit.push({ id: g.id, naam: g.naam, icoon: 'witgoed', zin: [plekZin(g.id), zon ? t('toev.opZonKort') : null].filter(Boolean).join(' · '), nieuw: !zon && !vast.has(g.id) && !ruimteVan(g.id), wat: 'witgoed' });
    }
  } else if (soort === 'auto') {
    for (const d of aansluiting?.laden?.apparaten ?? []) uit.push({ id: d.id, naam: d.naam, icoon: d.rol === 'laadpaal' ? 'laadpaal' : 'auto', zin: d.aan ? t(`laden.rol.${d.rol}`) : t('toev.doetNietMee'), nieuw: !d.aan, wat: 'laden' });
  } else if (soort === 'energie') {
    for (const d of aansluiting?.accu?.apparaten ?? []) uit.push({ id: d.id, naam: d.naam, icoon: 'batterij', zin: d.aan ? t('apparaten.soort.energie') : t('toev.doetNietMee'), nieuw: !d.aan, wat: 'accu' });
  } else if (soort === 'stekkers') {
    const bij = bijSchakelaar();
    const ids = new Set();
    for (const g of aansluiting?.gevonden?.apparaten ?? []) if (g.soort === 'stekker') ids.add(g.id);
    for (const b of buffers) if (b.soort === 'stekker') ids.add(b.id);
    // De slimme stekkers van api/stekker: ook die al op zon staan uit het instellingenbestand, zoals een ontvochtiger.
    for (const st of stekkers) ids.add(st.id);
    for (const d of huisData?.zonderRuimte ?? []) if (isStekker(d.id)) ids.add(d.id);
    for (const id of ids) {
      if (bij.has(id)) continue;
      const naam = (aansluiting?.gevonden?.apparaten ?? []).find((x) => x.id === id)?.naam ?? buffers.find((x) => x.id === id)?.naam ?? stekkers.find((x) => x.id === id)?.naam ?? (huisData?.zonderRuimte ?? []).find((x) => x.id === id)?.naam ?? id;
      const zon = opZon[id] === true || buffers.some((b) => b.id === id && b.soort === 'stekker');
      uit.push({ id, naam, icoon: 'stekker', zin: [plekZin(id), zon ? t('toev.opZonKort') : null].filter(Boolean).join(' · '), nieuw: zonder.has(id), wat: 'stekker' });
    }
  } else if (soort === 'schakelaars') {
    for (const s of schakelaars) uit.push({ id: s.id, naam: s.keuze?.naam || s.naam, icoon: s.ir ? 'warm' : 'apparaat', zin: s.keuze ? `${schakelaarZin(s)} · ${t(`toev.wat.${s.keuze.wat}`)}` : `${schakelaarZin(s)} · ${t('toev.nietIngesteld')}`, nieuw: !s.keuze, wat: 'schakelaar' });
  } else if (soort === 'losse') {
    for (const [id, l] of Object.entries(losse.laadpalen ?? {})) uit.push({ id, naam: l.naam, icoon: 'laadpaal', zin: t('toev.losse.n', { n: l.sensoren.length }), nieuw: false, wat: 'losse' });
  } else if (soort === 'anders') {
    // Zonder kamer en van geen soort hierboven: alleen bij Nieuw gevonden, met Waar en Verbergen.
    for (const d of huisData?.zonderRuimte ?? []) if (d.soort !== 'klimaat' && d.soort !== 'licht' && !isStekker(d.id)) uit.push({ id: d.id, naam: d.naam, icoon: 'apparaat', zin: t('toev.nogGeenKamer'), nieuw: true, wat: 'buffer' });
  }
  // Verborgen (bij Toevoegen of in Je huis) staat nergens, ook niet als het in een andere lijst van de dienst nog voorkomt (Ricardo, 18-11).
  const verborgen = new Set((huisData?.verborgen ?? []).map((d) => d.id));
  return uit.filter((x) => !verborgen.has(x.id));
}

/** Alles wat nieuw is, van elke soort, met de soort erbij. */
function nieuwAlles() {
  return [...ORDE.map(([s]) => s), 'anders'].flatMap((s) => itemsVan(s).filter((x) => x.nieuw).map((x) => ({ ...x, soort: s })));
}

/** Het adres: [soort, id]. Oude adressen (#s-id, #schakelaars, #losse) kloppen nog. */
function adres() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('s-')) return ['schakelaars', h.slice(2)];
  const [soort, ...rest] = h.split('/');
  return [soort || null, rest.join('/') || null];
}
const href = (soort, id) => `#${encodeURIComponent(soort)}${id ? `/${encodeURIComponent(id)}` : ''}`;

/** Links: Nieuw gevonden, en de negen soorten met wat er nieuw is of klaar staat. */
function soortenHtml(nu, tel) {
  const nieuw = nieuwAlles().length;
  const regel = (soort, icoon, naam, rechts, nieuwKleur) => `<a class="srt${soort === nu ? ' aan' : ''}" href="${href(soort)}" data-soort="${soort}"><span class="ik">${icoon}</span><b>${esc(naam)}</b><small class="${nieuwKleur ? 'nieuw' : ''}">${esc(rechts)}${tel ? ' ›' : ''}</small></a>`;
  const kop = regel('nieuw', '<span class="plus" aria-hidden="true">+</span>', t('toev.nieuw'), nieuw ? String(nieuw) : '', nieuw > 0);
  const per = ORDE.filter(([s]) => s !== 'schakelaars' || schakelaars.length > 0)
    .map(([s, icoon]) => {
      const items = itemsVan(s);
      const n = items.filter((x) => x.nieuw).length;
      return regel(s, iconen.svg(icoon), t(`apparaten.soort.${s}`), n ? t('toev.nNieuw', { n }) : items.length ? t('toev.nKlaar', { n: items.length }) : '', n > 0);
    })
    .join('');
  return tel ? `<section class="glas groep">${kop}</section><h4 class="tussen">${esc(t('toev.perSoort'))}</h4><section class="glas groep">${per}</section>` : `${kop}<h4 class="tussen">${esc(t('toev.perSoort'))}</h4>${per}`;
}

/** Een rij in het midden: nieuw met een oranje zin, klaar met een vinkje. */
function itemRij(x, soort, gekozen) {
  return `<a class="vond${x.id === gekozen ? ' aan' : ''}" href="${href(soort, x.id)}" data-item="${esc(x.id)}"><span class="ik">${iconen.svg(x.icoon)}</span><span class="tekst"><b>${esc(x.naam)}</b><small class="${x.nieuw ? 'nieuw' : ''}">${esc(x.zin)}</small></span>${x.nieuw ? '<span class="r" aria-hidden="true">›</span>' : `<span class="r af" aria-label="${esc(t('toev.staatKlaar'))}">✓</span>`}</a>`;
}

/** Wat verborgen is: uit Je huis (een apparaat) en bij Schakelaars. */
function verborgenLijst() {
  return [...(huisData?.verborgen ?? []).map((x) => ({ id: x.id, naam: x.naam, waar: 'huis' })), ...schakelaarsVerborgen.map((x) => ({ id: x.id, naam: x.naam, waar: 'schakelaar' }))];
}

/** Het midden: wat SunArc van die soort vond; of Nieuw gevonden, of Verborgen. */
function middenHtml(soort, gekozen, tel) {
  if (soort === 'verborgen') {
    const lijst = verborgenLijst();
    return `<h3>${esc(t('toev.verborgen'))}</h3><p class="lead">${esc(t('toev.verborgenLead'))}</p>${lijst.length ? `<div class="groep">${lijst.map((x) => `<div class="vond"><span class="ik">${iconen.svg('verborgen')}</span><span class="tekst"><b>${esc(x.naam)}</b></span><button type="button" class="terughalen" data-terughalen="${esc(x.id)}" data-waar="${x.waar}">${esc(t('toev.terughalen'))}</button></div>`).join('')}</div>` : `<p class="leeg">${esc(t('toev.geenVerborgen'))}</p>`}`;
  }
  if (soort === 'losse' && tel) return `<div class="glas paneel" data-rechts data-hand>${lossePaneel()}</div>`;
  const items = soort === 'nieuw' ? nieuwAlles() : itemsVan(soort);
  const nieuw = items.filter((x) => x.nieuw);
  const klaar = items.filter((x) => !x.nieuw);
  const titel = soort === 'nieuw' ? t('toev.nieuw') : t(`apparaten.soort.${soort}`);
  const lead = soort === 'nieuw' ? t('toev.nieuwLead') : soort === 'losse' ? t('toev.losse.lead') : t('toev.vond', { n: items.length });
  const rijSoort = (x) => (soort === 'nieuw' ? x.soort : soort);
  const naamSoort = (x) => (soort === 'nieuw' && x.soort !== 'anders' ? { ...x, zin: `${t(`apparaten.soort.${x.soort}`)} · ${x.zin}` } : x);
  const groep = (lijst) => (tel ? `<section class="glas groep">${lijst}</section>` : `<div class="groep">${lijst}</div>`);
  const max = tel ? 99 : Math.max(2, 7 - nieuw.length);
  const nieuwDeel = nieuw.length ? `<h4 class="tussen nieuw">${esc(t('toev.nieuwTussen'))}</h4>${groep(nieuw.map((x) => itemRij(naamSoort(x), rijSoort(x), gekozen)).join(''))}` : '';
  const klaarDeel = klaar.length ? `<h4 class="tussen">${esc(t('toev.klaarTussen'))}</h4>${groep(klaar.slice(0, max).map((x) => itemRij(x, rijSoort(x), gekozen)).join(''))}${klaar.length > max ? `<p class="meer">${esc(t('toev.enNog', { n: klaar.length - max }))}</p>` : ''}` : '';
  const leeg = !items.length ? `<p class="leeg">${esc(t(soort === 'nieuw' ? 'toev.geenNieuw' : soort === 'losse' ? 'toev.losse.geenLaadpaal' : 'toev.geenSoort'))}</p>` : '';
  const aantalVerborgen = verborgenLijst().length;
  const voet = `<div class="tvoet">${aantalVerborgen ? `<a class="verborgenregel" href="${href('verborgen')}"><span>${esc(t('toev.verborgen'))}</span><em>${aantalVerborgen} ›</em></a>` : ''}<span>${esc(t(soort === 'nieuw' ? 'toev.kiesSoort' : 'toev.nietErbij'))}</span></div>`;
  return `<h3>${esc(titel)}</h3><p class="lead">${esc(lead)}</p>${nieuwDeel}${klaarDeel}${leeg}${voet}`;
}

/** Wat SunArc nu van het apparaat weet, onder zijn naam. */
function nuZin(x) {
  const ding = { stekker: t('toev.ding.stekker'), witgoed: t('apparaten.soort.witgoed'), klimaat: t('toev.ding.klimaat'), licht: t('toev.ding.licht'), buffer: t('toev.ding.anders') }[x.wat] ?? '';
  return [ding, x.zin].filter(Boolean).join(' · ');
}

/** Rechts: het blad om hem klaar te zetten, met dezelfde regels als zijn kaart. */
function bladHtml(soort, id) {
  if (soort === 'losse') return lossePaneel();
  if (soort === 'verborgen') return `<div class="kies"><p>${esc(t('toev.verborgenUitleg'))}</p></div>`;
  const items = soort === 'nieuw' ? nieuwAlles() : itemsVan(soort);
  const x = items.find((y) => y.id === id) ?? (soort === 'nieuw' || !id ? null : null);
  if (!x) return `<div class="kies"><p>${esc(t(items.length ? 'toev.kies' : 'toev.kiesLeeg'))}</p></div>`;
  if (x.wat === 'schakelaar') {
    const s = schakelaars.find((y) => y.id === x.id);
    return s ? paneel(s) : '';
  }
  const kiezen = instellen.kiezen(x.id, x.naam);
  if (kiezen) return kiezen;
  let regels;
  if (x.wat === 'stekker') regels = instellen.regels('stekker', x.id, { naam: x.naam, nuW: buffers.find((b) => b.id === x.id)?.vermogenW ?? null, kanSchakelen: stekkerAan });
  else if (x.wat === 'witgoed') regels = `${instellen.regels('witgoed', x.id, { naam: x.naam })}<p class="hoe">${esc(t('apparaten.opZonHoe'))}</p>`;
  else if (x.wat === 'laden') regels = instellen.regels('laden', x.id);
  else if (x.wat === 'accu') regels = instellen.regels('accu', x.id);
  else regels = instellen.regels('buffer', x.id);
  // Een klimaatapparaat (keuze Ricardo, 18 november): de taak bij Klimaat, niet hier.
  const r = ruimteVan(x.id);
  const klimaatKamer = x.wat === 'klimaat' && r ? (r.zones ?? []).find((z) => z.id === (r.apparaten ?? []).find((a) => a.id === x.id)?.zone)?.regeling?.zoneId ?? r.zoneId ?? r.id : null;
  const taak = x.wat === 'klimaat' ? `<div class="in-rij"><div class="l"><b>${esc(t('toev.taakKlimaat'))}</b><span>${esc(t('toev.taakKlimaatZin'))}</span></div>${klimaatKamer ? `<a class="w zon" href="comfort.html#${esc(encodeURIComponent(klimaatKamer))}">${esc(t('toev.bijKlimaat'))} ›</a>` : ''}</div>` : '';
  // Verbergen: een stekker, of iets zonder kamer (keuze Ricardo: Verbergen in plaats van Dit is geen apparaat).
  const verbergbaar = x.wat === 'stekker' || (x.nieuw && zonderKamer().has(x.id));
  const verberg = verbergbaar ? `<button type="button" class="verberg" data-verberg="${esc(x.id)}">${iconen.svg('verborgen')}<span>${esc(t('toev.verbergen'))}<small>${esc(t('toev.verbergenZin'))}</small></span></button>` : '<span></span>';
  const kaart = x.wat === 'witgoed' ? `apparaten.html#wg-${encodeURIComponent(x.id)}` : x.wat === 'laden' ? `apparaten.html#laden-${encodeURIComponent(x.id)}` : x.wat === 'accu' ? 'apparaten.html#accu' : x.wat === 'licht' || x.wat === 'klimaat' ? (r ? `kamer.html#${encodeURIComponent(r.id)}` : 'apparaten.html') : 'apparaten.html';
  // Nieuw en nog zonder kamer: Zet klaar opent Waar staat hij? (instellen.js); klaar: naar zijn kaart, of bij klimaat naar Klimaat.
  const hoofd = x.nieuw && zonderKamer().has(x.id)
    ? `<button type="button" class="zet" data-in-waar="${esc(x.id)}">${esc(t(x.wat === 'klimaat' ? 'toev.zetKlaarKlimaat' : 'toev.zetKlaar'))}</button>`
    : x.nieuw
      ? ''
      : klimaatKamer
        ? `<a class="zet" href="comfort.html#${esc(encodeURIComponent(klimaatKamer))}">${esc(t('toev.naarKlimaat'))} ›</a>`
        : `<a class="zet stil" href="${kaart}">${esc(t('toev.naarKaart'))} ›</a>`;
  const staat = x.nieuw ? '' : `<p class="staatklaar">✓ ${esc(t('toev.staatKlaar'))}</p>`;
  return `<div class="wie"><span class="ik">${iconen.svg(x.icoon)}</span><div><h2>${esc(x.naam)}</h2><small>${esc(nuZin(x))}</small></div></div>
    <div class="regels">${regels}${taak}</div>
    ${staat}
    <p class="fout" data-fout aria-live="polite"></p>
    <div class="onderbalk">${verberg}${hoofd}</div>`;
}

/* ---------------------------------------------------- verbergen (versie 3) */

/** Een apparaat verbergen in de indeling (zoals in Je huis), of terughalen. */
async function verbergInIndeling(id, verbergen) {
  let info;
  try {
    info = await haal('api/indeling');
  } catch {
    $$('[data-fout]').forEach((el) => (el.textContent = t('kamer.geenVerbinding')));
    return;
  }
  const basis = info?.indeling ?? info?.voorstel;
  if (!basis) return;
  const next = JSON.parse(JSON.stringify(basis));
  next.verborgen = verbergen ? [...new Set([...(next.verborgen ?? []), id])] : (next.verborgen ?? []).filter((x) => x !== id);
  if (verbergen && next.apparaten) delete next.apparaten[id];
  const res = await deur('api/indeling', next);
  if (!res) return;
  if (!res.ok) {
    const uit = await res.json().catch(() => ({}));
    $$('[data-fout]').forEach((el) => (el.textContent = res.status === 403 ? t('indeling.beheerder') : (uit.fout ?? t('indeling.nietBewaard'))));
    return;
  }
  // Weg uit de lijst: het blad gaat dicht, de lijst van de soort blijft.
  if (verbergen) location.hash = href(adres()[0] ?? 'nieuw');
  void laad();
}

document.addEventListener('click', (e) => {
  const v = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-verberg], [data-terughalen]'));
  if (!v) return;
  if (v.dataset.verberg) return void verbergInIndeling(v.dataset.verberg, true);
  if (v.dataset.waar === 'schakelaar') return void bewaar({ id: v.dataset.terughalen, weg: true });
  void verbergInIndeling(v.dataset.terughalen ?? '', false);
});

/* ------------------------------------------------------------ tekenen */

function teken() {
  app.schaal();
  let [soort, id] = adres();
  const tel = app.telStand();
  // Op de wand altijd een soort: eerst wat nieuw is, anders de eerste soort met iets erin.
  if (!soort && !tel) soort = nieuwAlles().length ? 'nieuw' : (ORDE.find(([s]) => itemsVan(s).length)?.[0] ?? 'stekkers');
  // Op de wand meteen het eerste nieuwe apparaat in het blad.
  if (!tel && soort && !id && soort !== 'losse' && soort !== 'verborgen') id = (soort === 'nieuw' ? nieuwAlles() : itemsVan(soort)).find((x) => x.nieuw)?.id ?? null;
  const open = soort === 'schakelaars' && id ? schakelaars.find((s) => s.id === id) : null;
  if (!open) concept = null;
  const actief = document.activeElement?.matches?.('input, select') ? document.activeElement : null;
  const focus = actief ? actief.dataset : null;
  // Waar de cursor stond (issue 167): een opnieuw getekend veld begint vooraan, en dan kwam elke letter vóór het woord.
  let cursor = null;
  try {
    if (actief?.selectionStart != null) cursor = [actief.selectionStart, actief.selectionEnd];
  } catch {
    // Een getalveld kent geen cursorplek.
  }
  // Een item uit Nieuw gevonden opent zijn eigen soort in het blad.
  const bladSoort = soort === 'nieuw' && id ? (nieuwAlles().find((x) => x.id === id)?.soort ?? 'nieuw') : soort;

  // De wand: drie kolommen.
  $$('#wand [data-soorten]').forEach((el) => (el.innerHTML = soortenHtml(soort, false)));
  $$('#wand [data-midden]').forEach((el) => (el.innerHTML = middenHtml(soort, id, false)));
  $$('#wand [data-rechts]').forEach((el) => (el.innerHTML = bladHtml(bladSoort === 'anders' ? 'nieuw' : bladSoort, id)));

  // De telefoon: drie stappen, het blad van onderen.
  const stap = $$('#tel [data-stap]')[0];
  if (stap) stap.innerHTML = !soort ? `<p class="lead">${esc(t('toev.telLead'))}</p>${soortenHtml(null, true)}` : middenHtml(soort, id, true);
  const laag = $$('#tel [data-laag]')[0];
  if (laag) {
    const blad = tel && soort && id && soort !== 'losse' ? bladHtml(bladSoort === 'anders' ? 'nieuw' : bladSoort, id) : '';
    laag.hidden = !blad;
    laag.innerHTML = blad ? `<a class="achter" href="${href(soort)}" aria-label="${esc(t('algemeen.sluiten'))}"></a><div class="blad" data-rechts data-hand role="dialog" aria-modal="true"><span class="greep" aria-hidden="true"></span>${blad}</div>` : '';
  }
  // Terug: van het blad naar de lijst, van de lijst naar de soorten, anders naar Apparaten.
  $$('#tel a.terug').forEach((a) => {
    a.href = soort ? 'toevoegen.html' : 'apparaten.html';
    a.lastElementChild.textContent = t(soort ? 'toev.titelKort' : 'nav.apparaten');
  });
  $$('#tel [data-telkop]').forEach((el) => (el.textContent = soort ? (soort === 'nieuw' ? t('toev.nieuw') : soort === 'verborgen' ? t('toev.verborgen') : t(`apparaten.soort.${soort}`)) : t('toev.titelKort')));

  // Wie aan het typen was, blijft in hetzelfde veld.
  if (focus) {
    const veldKeuze = `[data-rechts] ${focus.knop ? `[data-knop="${focus.knop}"]` : focus.naam != null ? '[data-naam]' : focus.vermogen != null ? '[data-vermogen]' : focus.lzoek != null ? '[data-lzoek]' : focus.lnaam != null ? '[data-lnaam]' : focus.inW != null ? `[data-in-w="${focus.inW}"]` : '[data-kamer]'}`;
    const veld = $$(veldKeuze).find((x) => x.offsetParent);
    veld?.focus();
    if (veld && cursor) {
      try {
        veld.setSelectionRange(cursor[0], cursor[1]);
      } catch {
        // Niet elk veld kent een cursorplek.
      }
    }
  }
}

async function laad() {
  const [h, a, s, st, ls, z] = await Promise.allSettled([haal('api/huis'), haal('api/aansluiting'), haal('api/schakelaars'), haal('api/stekker'), haal('api/losse-laadpaal'), haal('api/state')]);
  if (ls.status === 'fulfilled' && ls.value) losse = { laadpalen: ls.value.laadpalen ?? {}, sensoren: ls.value.sensoren ?? [] };
  if (st.status === 'fulfilled') {
    stekkers = (st.value?.stekkers ?? []).map((x) => ({ id: x.id, naam: x.naam }));
    stekkerAan = !!st.value?.aan;
  }
  if (h.status === 'fulfilled') huisData = h.value;
  if (a.status === 'fulfilled') aansluiting = a.value;
  if (z.status === 'fulfilled') buffers = z.value?.bewoner?.warmtebuffers ?? [];
  if (s.status === 'fulfilled') {
    schakelaars = s.value?.schakelaars ?? [];
    schakelaarsMagBedienen = s.value?.bedienen === true;
    schakelaarsVerborgen = s.value?.verborgen ?? [];
  }
  void schakelaarsMagBedienen;
  teken();
}

addEventListener('standwissel', teken);
addEventListener('hashchange', teken);
// instellen.js tekent zijn regels opnieuw (Waar staat hij? open of dicht); na bewaren alles opnieuw ophalen.
addEventListener('instellen', teken);
addEventListener('handveranderd', () => void laad());
app.start('apparaten');
void instellen.laad();
teken();
void laad();
