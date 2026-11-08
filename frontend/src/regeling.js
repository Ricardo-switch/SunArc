/*
 * Regeling (besluit 130): wie wat regelt, en welke apparaten op zon mogen
 * starten. Wat hier stond bij "Wie stuurt" op de oude Instellingen, en de
 * apparaten op zon van Zon en aansluiting.
 *
 * Eerlijk over de stand: klimaat kijkt mee tot het bewijs er is (besluit 64);
 * dan staat er "Kijkt mee", met hoe ver het is. Licht en screens regelt het huis
 * niet: die staan bij Functies (besluit 167).
 */
'use strict';

const { $$, nl, esc, haal } = app;

let site = null;
let terugblik = null;
let huisData = null;
let aInfo = null;
let opZon = {};
/** Apparaten uit de configuratie die de bewoner van zon haalde (besluit 167). */
let opZonUit = [];
/** Wat de bewoner opgaf bij een stekker zonder eigen meter (besluit 264), in W. */
let vermogen = {};
/** De stekkers die SunArc mag schakelen (besluit 265). */
let bedienen = new Set();
/** Hoe lang een stekker per dag minstens aan moet, en uiterlijk wanneer (besluit 267). */
let minimum = {};
let zon = null;
/** Bijspringen per kamer (besluit 283): waar de airco de verwarming helpt, en wanneer. */
let bij = null;

async function laadAlles() {
  const [s, d, h, a, z, b] = await Promise.allSettled([haal('api/site'), haal('api/divergence'), haal('api/huis'), haal('api/aansluiting'), haal('api/zon'), haal('api/bijspringen')]);
  if (s.status === 'fulfilled') site = s.value;
  if (d.status === 'fulfilled') terugblik = d.value;
  if (h.status === 'fulfilled') huisData = h.value;
  if (a.status === 'fulfilled') {
    aInfo = a.value;
    opZon = { ...(aInfo.antwoorden?.opZon ?? {}) };
    opZonUit = [...(aInfo.antwoorden?.opZonUit ?? [])];
    vermogen = { ...(aInfo.antwoorden?.vermogen ?? {}) };
    bedienen = new Set(aInfo.antwoorden?.bedienen ?? []);
    minimum = { ...(aInfo.antwoorden?.minimum ?? {}) };
  }
  if (z.status === 'fulfilled') zon = z.value;
  if (b.status === 'fulfilled') bij = b.value;
  teken();
}

/* ------------------------------------------------------------ de delen */

const klimaat = () => site?.actuators ?? [];
const uitstelbaar = () => (huisData?.etages ?? []).flatMap((e) => e.ruimtes).flatMap((r) => r.apparaten).filter((x) => x.soort === 'apparaat');

function delen() {
  const opZonAan = Object.values(opZon).filter(Boolean).length + (aInfo?.configuratie?.apparaten ?? []).filter((x) => !opZonUit.includes(x.id)).length;
  return [
    { id: 'klimaat', titel: t('regeling.klimaat'), zin: huisData ? t('regeling.kamersMee', { n: kamersMee().length }) : klimaat().length ? t('regeling.apparatenMee', { n: klimaat().length }) : '…', stand: site ? 'goed' : null },
    { id: 'opzon', titel: t('instellingen.opZon'), zin: aInfo ? (opZonAan ? t('regeling.nOpZon', { n: opZonAan }) : t('instellingen.geen')) : '…', stand: aInfo ? 'goed' : null },
  ];
}

const FASEN = ['leren', 'kijken', 'regelen'].map((k) => [k, t(`regeling.fase.${k}`)]);
const fase = (nu) => `<span class="fase" role="img" aria-label="${FASEN.find(([k]) => k === nu)[1]}">${FASEN.map(([k, l]) => `<i class="${k === nu ? k : ''}">${l}</i>`).join('')}</span>`;

/*
 * Per kamer wat er regelt (besluit 138). Vastleggen gebeurt bij de kamer, in
 * Indeling bij Verwarmen en koelen; hier het overzicht, met een tik erheen.
 */
const ROL_ZIN = { houdt: 'regeling.rol.houdt', zon: 'regeling.rol.zon' };
const binnenKamers = () => (huisData?.etages ?? []).filter((e) => e.id !== 'buiten').flatMap((e) => e.ruimtes ?? []);
const actiefIn = (r) => (r.apparaten ?? []).filter((a) => a.soort === 'klimaat' && a.klimaat?.rol && a.klimaat.rol !== 'kijken').sort((a, b) => (a.klimaat.rol === b.klimaat.rol ? 0 : a.klimaat.rol === 'houdt' ? -1 : 1));
const kamersMee = () => binnenKamers().filter((r) => actiefIn(r).length);
const naarKamer = (r) => `indeling.html#${encodeURIComponent(r.id)}/warmte`;

/**
 * Bijspringen (besluit 283): onder een kamer waar een airco de verwarming kan
 * helpen een schakelaar, en als die aan staat na hoeveel minuten stoken en
 * vanaf hoeveel graden te koud.
 */
function bijspringenRij(r) {
  const z = bij?.zones?.find((x) => x.zoneId === r.zoneId);
  if (!z) return '';
  const wie = z.apparaten.join(` ${t('algemeen.en')} `);
  const zin = z.aan ? t('regeling.bij.aan', { wie, min: z.naMin, graden: `${nl(z.vanafC, 1)}°` }) : t('regeling.bij.uit', { wie });
  const stap = (veld, stapje, label, tekst) => `<div class="bijstap"><span>${esc(label)}</span><button type="button" data-bij="${esc(z.zoneId)}:${veld}:-${stapje}" aria-label="${esc(t('regeling.bij.minder', { wat: label }))}">−</button><b>${esc(tekst)}</b><button type="button" data-bij="${esc(z.zoneId)}:${veld}:${stapje}" aria-label="${esc(t('regeling.bij.meer', { wat: label }))}">+</button></div>`;
  const getallen = z.aan
    ? `<div class="regelrij bijgetallen" style="padding-left: 22px">${stap('naMin', 1, t('regeling.bij.na'), t('regeling.bij.minuten', { n: z.naMin }))}${stap('vanafC', 0.1, t('regeling.bij.vanaf'), t('regeling.bij.graden', { graden: `${nl(z.vanafC, 1)}°` }))}</div>`
    : '';
  return `<div class="regelrij" style="padding-left: 22px"><div class="l"><b style="font-weight: 500">${esc(t('regeling.bij.titel'))}</b><span>${esc(zin)}</span></div><button type="button" class="schakelaar" role="switch" aria-checked="${z.aan}" aria-label="${esc(t('regeling.bij.van', { kamer: r.naam }))}" data-bij-aan="${esc(z.zoneId)}"></button></div>${getallen}`;
}

function klimaatVorm() {
  const winter = terugblik?.dataset?.seizoenen?.find((x) => x.seizoen === 'winter');
  const van = terugblik?.dataset?.vanMs ?? terugblik?.vanMs;
  const sinds = van ? taal.datum(van, { day: 'numeric', month: 'long' }) : null;
  const rijen = huisData
    ? kamersMee().map((r) => {
        // Kamers die meedoen met deze (besluit 142), erbij genoemd.
        const mee = binnenKamers().filter((x) => x.meedoenMet?.kamerId === r.id).map((x) => x.naam);
        const wat = actiefIn(r).map((a) => t(ROL_ZIN[a.klimaat.rol], { naam: a.naam })).join(', ');
        return `<a class="regelrij kamerrij" href="${naarKamer(r)}"><div class="l"><b>${esc([r.naam, ...mee].join(` ${t('algemeen.en')} `))}</b><span>${esc(wat)}</span></div><span class="pijl" aria-hidden="true">›</span></a>${bijspringenRij(r)}`;
      }).join('')
    : '';
  const nietMee = binnenKamers().filter((r) => !actiefIn(r).length && !r.meedoenMet);
  const rest = nietMee.length
    ? `<p class="klein" style="margin: 0">${esc(t('regeling.nietMee'))} ${nietMee.map((r) => `<a href="${naarKamer(r)}">${esc(r.naam)}</a>`).join(', ')}. ${esc(t('regeling.kiesBijKamer'))}</p>`
    : '';
  const stand = `<div class="regelrij"><div class="l"><b>${esc(sinds ? t('regeling.kijktSinds', { datum: sinds }) : t('regeling.fase.kijken'))}</b><span>${esc(t('regeling.zegtWat'))}</span></div>${fase('kijken')}</div>`;
  const bewijs = winter
    ? `<div class="bewijs"><span class="mini">${esc(t('regeling.winterdagen', { n: nl(winter.dagen, 0), doel: winter.doel }))}</span><span class="balkje"><i style="width: ${Math.min(100, (winter.dagen / winter.doel) * 100).toFixed(0)}%"></i></span></div>
       <p class="mini" style="margin: 0">${esc(t('regeling.pasZelf', { doel: winter.doel }))}</p>`
    : '';
  return `<h2 class="kop-2">${esc(t('regeling.klimaat'))}</h2>
    <p class="klein" style="margin: 0">${esc(t('regeling.perKamer'))}</p>
    ${stand}
    <div>${rijen || `<p class="klein">${esc(t('regeling.geenKamer'))}</p>`}</div>
    ${rest}
    ${bewijs}`;
}


/** Een schakelaar per apparaat (besluit 167): aan start hij op zon, uit niet. Ook voor wat de configuratie noemt. */
function opZonRij(naam, aan, data) {
  return `<div class="regelrij"><div class="l"><b>${esc(naam)}</b><span>${esc(t(aan ? 'regeling.startZon' : 'regeling.startNiet'))}</span></div><button type="button" class="schakelaar" role="switch" aria-checked="${aan}" aria-label="${esc(t('regeling.naamOpZon', { naam }))}" ${data}></button></div>`;
}

/**
 * Een slimme stekker (besluit 264): met zijn icoon, aan als er zon over is.
 * Meet hij zijn vermogen niet zelf, dan vraagt de rij hoeveel hij trekt.
 */
function stekkerRij(x) {
  const aan = opZon[x.id] === true;
  const veld = aan && !x.meet
    ? `<label class="veldnaam" style="margin-top: 6px">${esc(t('regeling.stekkerVermogen'))}<input class="invoer" type="number" inputmode="numeric" min="50" max="3680" step="10" data-vermogen="${esc(x.id)}" value="${vermogen[x.id] ?? ''}" placeholder="1000"></label>`
    : '';
  // Mag SunArc hem schakelen (besluit 265): met de hand, op tijden en op zon (267); weg is nee.
  const mag = bedienen.has(x.id);
  // Minstens zo lang per dag, uiterlijk om (besluit 267): twee velden, elk met zijn eigen naam.
  const min = minimum[x.id] ?? null;
  const duren = [30, 60, 120, 180, 240, 360, 480];
  const keuze = `<option value="">${esc(t('regeling.stekkerMinimumGeen'))}</option>${duren.map((m) => `<option value="${m}"${min?.minuten === m ? ' selected' : ''}>${esc(m < 60 ? t('regeling.minuten', { n: m }) : t(m === 60 ? 'regeling.uur1' : 'regeling.uren', { n: m / 60 }))}</option>`).join('')}`;
  const minRij = aan
    ? `<div class="regelrij" style="padding-left: 22px; flex-wrap: wrap; gap: 8px 12px"><label class="veldnaam" style="margin: 0">${esc(t('regeling.stekkerMinimum'))}<select class="invoer" data-minimum="${esc(x.id)}" aria-label="${esc(t('regeling.stekkerMinimumVan', { naam: x.naam }))}">${keuze}</select></label>${min ? `<label class="veldnaam" style="margin: 0">${esc(t('regeling.stekkerUiterlijk'))}<input class="invoer" type="time" step="900" data-uiterlijk="${esc(x.id)}" value="${esc(min.klok)}" aria-label="${esc(t('regeling.stekkerUiterlijkVan', { naam: x.naam }))}"></label>` : ''}<p class="mini" style="margin: 0; flex-basis: 100%">${esc(t(min ? 'regeling.stekkerMinimumUitleg' : 'regeling.stekkerMinimumGeenUitleg'))}</p></div>`
    : '';
  const bedien = `<div class="regelrij" style="padding-left: 22px"><div class="l"><b style="font-weight: 500">${esc(t('regeling.stekkerBedienen'))}</b><span>${esc(t(mag ? 'regeling.stekkerBedienenJa' : 'regeling.stekkerBedienenNee'))}</span></div><button type="button" class="schakelaar" role="switch" aria-checked="${mag}" aria-label="${esc(t('regeling.stekkerBedienenVan', { naam: x.naam }))}" data-bedienen="${esc(x.id)}"></button></div>`;
  return `<div class="regelrij"><div class="l"><b><span aria-hidden="true" style="display: inline-flex; vertical-align: -3px">${iconen.svg('stekker', { grootte: 16 })}</span> ${esc(x.naam)}</b><span>${esc(t(aan ? 'regeling.stekkerZon' : 'regeling.stekkerNiet'))}</span>${veld}</div><button type="button" class="schakelaar" role="switch" aria-checked="${aan}" aria-label="${esc(t('regeling.naamOpZon', { naam: x.naam }))}" data-opzon="${esc(x.id)}"></button></div>${minRij}${bedien}`;
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
const NAAST = { klimaat: 3, opzon: 2 };

function naast(id) {
  const deel = NAAST[id] ? id : 'klimaat';
  const lijst = Array.from({ length: NAAST[deel] }, (_, i) => t(`regeling.naast.${deel}.${i + 1}`));
  const later = aInfo?.volgendeStart && id === 'opzon' ? `<div class="glas"><h3>${esc(t('regeling.ingaat'))}</h3><p style="margin: 0">${esc(t('regeling.ingaatZin'))}</p><button type="button" class="knop" data-herstart style="align-self: start; margin-top: 8px">${esc(t('basis.herstart'))}</button></div>` : '';
  return `<div class="glas"><h3>${esc(t(`regeling.naast.${deel}`))}</h3><ul>${lijst.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>${later}`;
}

/* ------------------------------------------------------------ tekenen */

function tekenNu() {
  app.schaal();
  app.luchtVan(zon, 0);
  const nu = groep.tekenDelen(delen());
  const vorm = { klimaat: klimaatVorm, opzon: opZonVorm }[nu]?.() ?? '';
  $$('[data-vorm]').forEach((el) => (el.innerHTML = vorm));
  $$('[data-naast]').forEach((el) => (el.innerHTML = naast(nu)));
}

/* ------------------------------------------------------------ bewaren */

// Bijspringen per kamer (besluit 283): meteen bewaard, per kamer.
document.addEventListener('click', (e) => {
  const knop = e.target.closest('[data-bij-aan], [data-bij]');
  if (!knop || !bij) return;
  const id = knop.dataset.bijAan ?? knop.dataset.bij.split(':')[0];
  const z = bij.zones.find((x) => x.zoneId === id);
  if (!z) return;
  const nieuw = { zone: id, aan: z.aan, naMin: z.naMin, vanafC: z.vanafC };
  if (knop.dataset.bijAan) nieuw.aan = !z.aan;
  else {
    const [, veld, stap] = knop.dataset.bij.split(':');
    const { min, max } = bij.bereik[veld];
    nieuw[veld] = Math.round(Math.min(max, Math.max(min, z[veld] + Number(stap))) * 10) / 10;
  }
  bij = { ...bij, zones: bij.zones.map((x) => (x.zoneId === id ? { ...x, ...nieuw } : x)) };
  teken();
  groep.bewaarStraks(async () => {
    const uit = await groep.stuur('api/bijspringen', nieuw);
    if (uit?.ok) {
      bij = uit.antwoord;
      teken();
    }
    return uit;
  });
});

document.addEventListener('click', (e) => {
  const knop = e.target.closest('[data-opzon], [data-opzon-vast], [data-bedienen]');
  if (!knop || !aInfo) return;
  const aan = knop.getAttribute('aria-checked') !== 'true';
  if (knop.dataset.bedienen) {
    bedienen = new Set(bedienen);
    if (aan) bedienen.add(knop.dataset.bedienen);
    else bedienen.delete(knop.dataset.bedienen);
  } else if (knop.dataset.opzon) opZon[knop.dataset.opzon] = aan;
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
    // Per stekker ja of nee (besluit 265): alleen de stekkers die er nu zijn.
    bedienen: Object.fromEntries((aInfo.gevonden?.apparaten ?? []).filter((x) => x.soort === 'stekker').map((x) => [x.id, bedienen.has(x.id)])),
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
