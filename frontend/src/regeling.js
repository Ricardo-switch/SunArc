/*
 * Regeling (besluit 130): welke apparaten op zon mogen starten, de apparaten op
 * zon van Zon en aansluiting. Licht en screens regelt het huis niet: die staan
 * bij Functies (besluit 167).
 *
 * Klimaat en Helpen bij de cv stonden hier ook; sinds besluit 317 staan ze bij
 * Klimaat, per kamer en onder Het hele huis. Een oude link gaat daarheen.
 */
'use strict';

{
  const oud = location.hash.slice(1);
  if (oud === 'klimaat' || oud === 'helpen') location.replace(oud === 'helpen' ? 'comfort.html#helpen' : 'comfort.html');
}

const { $$, esc, haal } = app;

let huisData = null;
let aInfo = null;
let opZon = {};
/** Apparaten uit de configuratie die de bewoner van zon haalde (besluit 167). */
let opZonUit = [];
/** Wat de bewoner opgaf bij een stekker zonder eigen meter (besluit 264), in W. */
let vermogen = {};
/** Hoe lang een stekker per dag minstens aan moet, en uiterlijk wanneer (besluit 267). */
let minimum = {};
let zon = null;

async function laadAlles() {
  const [h, a, z] = await Promise.allSettled([haal('api/huis'), haal('api/aansluiting'), haal('api/zon')]);
  if (h.status === 'fulfilled') huisData = h.value;
  if (a.status === 'fulfilled') {
    aInfo = a.value;
    opZon = { ...(aInfo.antwoorden?.opZon ?? {}) };
    opZonUit = [...(aInfo.antwoorden?.opZonUit ?? [])];
    vermogen = { ...(aInfo.antwoorden?.vermogen ?? {}) };
    minimum = { ...(aInfo.antwoorden?.minimum ?? {}) };
  }
  if (z.status === 'fulfilled') zon = z.value;
  teken();
}

/* ------------------------------------------------------------ de delen */

const uitstelbaar = () => (huisData?.etages ?? []).flatMap((e) => e.ruimtes).flatMap((r) => r.apparaten).filter((x) => x.soort === 'apparaat');

function delen() {
  const opZonAan = Object.values(opZon).filter(Boolean).length + (aInfo?.configuratie?.apparaten ?? []).filter((x) => !opZonUit.includes(x.id)).length;
  return [
    // Klimaat per kamer en Helpen bij de cv staan bij Klimaat (besluit 317): een regel erheen.
    { id: 'klimaat', titel: t('groep.comfort'), zin: t('regeling.naarKlimaat'), stand: 'goed', href: 'comfort.html' },
    { id: 'opzon', titel: t('instellingen.opZon'), zin: aInfo ? (opZonAan ? t('regeling.nOpZon', { n: opZonAan }) : t('instellingen.geen')) : '…', stand: aInfo ? 'goed' : null },
  ];
}

/** Een schakelaar per apparaat (besluit 167): aan start hij op zon, uit niet. Ook voor wat de configuratie noemt. */
function opZonRij(naam, aan, data) {
  return `<div class="regelrij"><div class="l"><b>${esc(naam)}</b><span>${esc(t(aan ? 'regeling.startZon' : 'regeling.startNiet'))}</span></div><button type="button" class="schakelaar" role="switch" aria-checked="${aan}" aria-label="${esc(t('regeling.naamOpZon', { naam }))}" ${data}></button></div>`;
}

/**
 * Een slimme stekker (besluit 264): met zijn icoon, aan als er zon over is.
 * Eén schakelaar (besluit 290): op zon is ook de toestemming, SunArc zet hem echt aan en uit.
 * Meet hij zijn vermogen niet zelf, dan vraagt de rij hoeveel hij trekt.
 */
function stekkerRij(x) {
  const aan = opZon[x.id] === true;
  const veld = aan && !x.meet
    ? `<label class="veldnaam" style="margin-top: 6px">${esc(t('regeling.stekkerVermogen'))}<input class="invoer" type="number" inputmode="numeric" min="50" max="3680" step="10" data-vermogen="${esc(x.id)}" value="${vermogen[x.id] ?? ''}" placeholder="1000"></label>`
    : '';
  // Minstens zo lang per dag, uiterlijk om (besluit 267): twee velden, elk met zijn eigen naam.
  const min = minimum[x.id] ?? null;
  const duren = [30, 60, 120, 180, 240, 360, 480];
  const keuze = `<option value="">${esc(t('regeling.stekkerMinimumGeen'))}</option>${duren.map((m) => `<option value="${m}"${min?.minuten === m ? ' selected' : ''}>${esc(m < 60 ? t('regeling.minuten', { n: m }) : t(m === 60 ? 'regeling.uur1' : 'regeling.uren', { n: m / 60 }))}</option>`).join('')}`;
  const minRij = aan
    ? `<div class="regelrij" style="padding-left: 22px; flex-wrap: wrap; gap: 8px 12px"><label class="veldnaam" style="margin: 0">${esc(t('regeling.stekkerMinimum'))}<select class="invoer" data-minimum="${esc(x.id)}" aria-label="${esc(t('regeling.stekkerMinimumVan', { naam: x.naam }))}">${keuze}</select></label>${min ? `<label class="veldnaam" style="margin: 0">${esc(t('regeling.stekkerUiterlijk'))}<input class="invoer" type="time" step="900" data-uiterlijk="${esc(x.id)}" value="${esc(min.klok)}" aria-label="${esc(t('regeling.stekkerUiterlijkVan', { naam: x.naam }))}"></label>` : ''}<p class="mini" style="margin: 0; flex-basis: 100%">${esc(t(min ? 'regeling.stekkerMinimumUitleg' : 'regeling.stekkerMinimumGeenUitleg'))}</p></div>`
    : '';
  return `<div class="regelrij"><div class="l"><b><span aria-hidden="true" style="display: inline-flex; vertical-align: -3px">${iconen.svg('stekker', { grootte: 16 })}</span> ${esc(x.naam)}</b><span>${esc(t(aan ? 'regeling.stekkerZon' : 'regeling.stekkerNiet'))}</span>${veld}</div><button type="button" class="schakelaar" role="switch" aria-checked="${aan}" aria-label="${esc(t('regeling.naamOpZon', { naam: x.naam }))}" data-opzon="${esc(x.id)}"></button></div>${minRij}`;
}

function opZonVorm() {
  if (!aInfo) return `<p class="klein">${esc(t('algemeen.laden'))}…</p>`;
  const vast = new Set(aInfo.configuratie.apparaten.map((x) => x.id));
  const rijen = [];
  for (const x of aInfo.configuratie.apparaten) rijen.push(opZonRij(x.naam, !opZonUit.includes(x.id), `data-opzon-vast="${esc(x.id)}"`));
  for (const x of aInfo.gevonden.apparaten) if (!vast.has(x.id)) rijen.push(x.soort === 'stekker' ? stekkerRij(x) : opZonRij(x.naam, opZon[x.id] === true, `data-opzon="${esc(x.id)}"`));
  const nu = uitstelbaar().map((x) => `<div class="regelrij"><div class="l"><b>${esc(x.naam)}</b><span>${esc(x.stand)}</span></div></div>`).join('');
  return `<h2 class="kop-2">${esc(t('instellingen.opZon'))}</h2>
    <p class="klein" style="margin: 0">${esc(t('regeling.opZonUitleg'))}</p>
    <div>${rijen.length ? rijen.join('') : `<p class="klein">${esc(t('regeling.geenApparaten'))}</p>`}</div>
    ${nu ? `<h3 class="kop-3" style="margin: 6px 0 0">${esc(t('regeling.nu'))}</h3><div>${nu}</div>` : ''}
    <p class="mini" style="margin: 0">${esc(t('regeling.opAfstand'))}</p>`;
}

/** Per deel een kopje en drie of twee punten (regeling.naast.*). */
const NAAST = { opzon: 2 };

function naast(id) {
  const deel = 'opzon';
  const lijst = Array.from({ length: NAAST[deel] }, (_, i) => t(`regeling.naast.${deel}.${i + 1}`));
  const later = aInfo?.volgendeStart && id === 'opzon' ? `<div class="glas"><h3>${esc(t('regeling.ingaat'))}</h3><p style="margin: 0">${esc(t('regeling.ingaatZin'))}</p><button type="button" class="knop" data-herstart style="align-self: start; margin-top: 8px">${esc(t('basis.herstart'))}</button></div>` : '';
  return `<div class="glas"><h3>${esc(t(`regeling.naast.${deel}`))}</h3><ul>${lijst.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>${later}`;
}

/* ------------------------------------------------------------ tekenen */

function tekenNu() {
  app.schaal();
  app.luchtVan(zon, 0);
  const nu = groep.tekenDelen(delen());
  const vorm = nu === 'opzon' ? opZonVorm() : '';
  $$('[data-vorm]').forEach((el) => (el.innerHTML = vorm));
  $$('[data-naast]').forEach((el) => (el.innerHTML = naast(nu)));
}

/* ------------------------------------------------------------ bewaren */

document.addEventListener('click', (e) => {
  const knop = e.target.closest('[data-opzon], [data-opzon-vast]');
  if (!knop || !aInfo) return;
  const aan = knop.getAttribute('aria-checked') !== 'true';
  if (knop.dataset.opzon) opZon[knop.dataset.opzon] = aan;
  else {
    const id = knop.dataset.opzonVast;
    opZonUit = aan ? opZonUit.filter((x) => x !== id) : [...new Set([...opZonUit, id])];
  }
  teken();
  bewaar();
});

// Het vermogen van een stekker zonder eigen meter (besluit 264): bewaard als je het veld verlaat.
document.addEventListener('change', (e) => {
  const veld = e.target.closest?.('[data-vermogen]');
  if (!veld || !aInfo) return;
  const w = Math.round(Number(veld.value));
  vermogen = { ...vermogen, [veld.dataset.vermogen]: veld.value === '' ? null : Math.min(3680, Math.max(50, w)) };
  bewaar();
});

// Het minimum per dag en uiterlijk om (besluit 267): bewaard zodra je kiest.
document.addEventListener('change', (e) => {
  const keuze = e.target.closest?.('[data-minimum]');
  const klok = e.target.closest?.('[data-uiterlijk]');
  if ((!keuze && !klok) || !aInfo) return;
  if (keuze) {
    const id = keuze.dataset.minimum;
    minimum = { ...minimum, [id]: keuze.value === '' ? null : { minuten: Number(keuze.value), klok: minimum[id]?.klok ?? '22:00' } };
  } else {
    const id = klok.dataset.uiterlijk;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(klok.value) || !minimum[id]) return;
    minimum = { ...minimum, [id]: { ...minimum[id], klok: klok.value } };
  }
  teken();
  bewaar();
});

function bewaar() {
  // De aansluiting bewaart alles samen: de rest zoals het was, ook hoe de panelen liggen.
  const x = aInfo.antwoorden ?? {};
  const body = {
    panelen: x.panelen ?? { ligging: null, aantal: null, voorkant: null, achterkant: null },
    zekering: x.zekering ?? null,
    tarief: x.tarief ?? null,
    verwarming: x.verwarming ?? { soort: null, aanvoerC: null },
    voorkantZon: x.voorkantZon ?? null,
    dak: x.dak ?? null,
    // Panelen op de garage, carport of het tuinhuis (besluit 187): anders vallen ze weg.
    ...(x.elders ? { elders: x.elders } : {}),
    opZon: Object.fromEntries(Object.entries(opZon).filter(([, v]) => typeof v === 'boolean')),
    opZonUit,
    vermogen,
    // Toestemming voor met de hand staat in het blad van de stekker (besluit 290): niet meesturen, dan blijft hij.
    minimum: Object.fromEntries((aInfo.gevonden?.apparaten ?? []).filter((x) => x.soort === 'stekker').map((x) => [x.id, minimum[x.id] ?? null])),
  };
  groep.bewaarStraks(async () => {
    const uit = await groep.stuur('api/aansluiting', body);
    if (uit?.ok) {
      aInfo = uit.antwoord;
      teken();
    }
    return uit;
  });
}

/* ------------------------------------------------------------ starten */

/** Gebundeld: hooguit één keer per beeld (basis.js). */
const teken = app.gebundeld(tekenNu);
addEventListener('standwissel', teken);
addEventListener('hashchange', teken);

app.start('instellingen');
void laadAlles();
