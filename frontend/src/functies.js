/*
 * Functies (besluiten 109, 111 en 130). Welke camera's de app toont en met
 * welk beeld, welke melder de deurbel is, of je licht en screens bedient in de
 * app, en waar het weer vandaan komt. Praten met je huis (besluit 148): welk
 * taalmodel uit Home Assistant de assistent laat praten in eigen woorden, en of
 * hij met een zin mag bedienen. Meldingen (besluit 149 en 346): wat er in de
 * bel komt, per soort, en wanneer een batterij of airco-filter. In de opbouw van elke groep (130): links
 * de delen, wat je kiest wordt meteen bewaard. Bewaren vraagt een beheerder.
 * De dienst doet een voorstel uit wat Home Assistant heeft.
 *
 * Licht en screens heeft per kamer de lampen, scènes en screens, met een
 * schakelaar om er een uit de app te halen. Dit scherm, het always-on display,
 * scherm uit en op je startscherm (eerst hier onder Weergave, besluit 167)
 * staan sinds stap 4 punt 2 bij Jij (ditscherm.js); hun oude adres gaat daarheen.
 */
'use strict';

const { $$, esc, haal } = app;

/*
 * De assistent (besluit 217): Praten met je huis, Stem en luisteren en Te doen
 * staan als eigen groep bij Instellingen (functies.html?groep=assistent). Een
 * oud adres als functies.html#praten gaat vanzelf naar die groep, en andersom.
 */
const ASSISTENT = ['praten', 'stem', 'tedoen'];
const isAssistent = new URLSearchParams(location.search).get('groep') === 'assistent';
{
  const h = decodeURIComponent(location.hash.slice(1));
  if (['scherm', 'aod', 'uit', 'startscherm'].includes(h)) location.replace(`jij.html#${h}`);
  else if (!isAssistent && ASSISTENT.includes(h)) location.replace(`functies.html?groep=assistent#${h}`);
  else if (isAssistent && h && !ASSISTENT.includes(h)) location.replace(`functies.html#${h}`);
  if (isAssistent) {
    document.title = `${t('groep.assistent')} · SunArc`;
    $$('h1[data-t="groep.functies"]').forEach((el) => {
      el.dataset.t = 'groep.assistent';
      el.textContent = t('groep.assistent');
    });
  }
}

let info = null;
let concept = null;
let zon = null;
/** Het laatste proefantwoord van het taalmodel (besluit 148): vast naast eigen woorden. */
let proef = null;
/** Hoeveel vragen er naar het taalmodel gingen en hoe snel (besluit 213); null tot hij geladen is. */
let teller = null;
/** Het huis en de indeling: de lampen, scènes en screens per kamer. */
let huisData = null;
let indeling = null;
/** Hoe de schermen luisteren (besluit 208): wie het wekwoord hoort, en hoe vaak het huis vandaag wakker werd. */
let luisterStand = null;
/** De stemmen om uit te kiezen (besluit 212), en vrouw of man in beeld. */
let stemmen = null;
let geslacht = null;
/** Klaarzetten per niveau (besluit 246): wat er nog open is voor de assistent en het scherm. */
let klaar = null;
/** Voor Meldingen (besluit 346): of er een wintertest loopt, en hoeveel bewoners er zijn. */
let site = null;
let bewoners = null;

async function laadKlaar() {
  klaar = await klaarstappen.laad().catch(() => klaar);
  teken();
}
/*
 * De functie van Klaarzetten bij dit deel (besluit 246): de assistent bij Stem
 * en luisteren, de wand bij Scherm uit. Niet meer bij Praten:
 * die stappen gaan over "Hé huis", en op de telefoon begonnen Praten en Stem
 * daardoor met hetzelfde blok, alsof het één pagina was.
 */
function klaarVan(deel) {
  const id = { stem: 'assistent' }[deel];
  return id ? ((klaar?.functies ?? []).find((x) => x.id === id) ?? null) : null;
}
/** Hoeveel stappen er nog open zijn, voor rechts in de lijst; leeg als niets. */
function nogTekst(deel) {
  const f = klaarVan(deel);
  const n = f ? klaarstappen.open(f).length : 0;
  return n ? t('kz.nogKort', { n }) : null;
}
/*
 * De open stappen boven het deel, alleen op de telefoon: op de wand is Praten
 * en Scherm uit al vol, en de wand scrolt nooit. Daar staat het rechts in de lijst.
 */
function nogKlaar(deel) {
  const f = klaarVan(deel);
  if (!f || !app.telStand()) return '';
  const n = klaarstappen.open(f).length;
  return klaarstappen.nog(f, t(f.id === 'wand' ? 'kz.nogScherm' : 'kz.nogHeHuis', { n }));
}
async function laad() {
  const [f, z, h, i] = await Promise.allSettled([haal('api/functies'), haal('api/zon'), haal('api/huis'), haal('api/indeling'), haal('api/luister-stand').then((x) => (luisterStand = x)), haal('api/stemmen').then((x) => (stemmen = x)), laadKlaar(), haal('api/site').then((x) => (site = x)), haal('api/bewoners').then((x) => (bewoners = x))]);
  if (z.status === 'fulfilled') zon = z.value;
  if (h.status === 'fulfilled') huisData = h.value;
  if (i.status === 'fulfilled') indeling = i.value;
  if (f.status === 'fulfilled') {
    info = f.value;
    concept = JSON.parse(JSON.stringify(info.instellingen ?? info.voorstel));
    concept.weer ??= info.voorstel.weer;
    concept.licht ??= info.voorstel.licht;
    concept.schermen ??= info.voorstel.schermen ?? { bedienen: true };
    concept.praten ??= info.voorstel.praten ?? { taalmodel: null, bedienen: true };
    concept.tedoen ??= info.voorstel.tedoen ?? { aan: false, boodschappen: null, todo: null, afval: null, gezin: null };
    concept.praten.spraak ??= null;
    concept.meldingen ??= info.voorstel.meldingen ?? { batterij: 10, filter: 10 };
    concept.meldingen.uit ??= ['comfort'];
  }
  teken();
}

/* ------------------------------------------------------------ tekenen */

function keuzes(label, sleutel, opties, huidig, uit = false) {
  return `<div class="keuzes" role="group" aria-label="${esc(label)}">${opties.map(([w, x]) => `<button type="button" data-kies="${esc(sleutel)}" data-waarde='${esc(JSON.stringify(w))}' aria-pressed="${JSON.stringify(w) === JSON.stringify(huidig)}" ${uit ? 'disabled' : ''}>${esc(x)}</button>`).join('')}</div>`;
}
const aanUit = () => [[true, t('w.aan')], [false, t('w.uit')]];

/** Het beeld dat van deze camera in de lijst staat, of null als hij niet getoond wordt. */
const gekozenBeeld = (c) => c.beelden.find((b) => concept.cameras.lijst.includes(b.id))?.id ?? null;

function cameras() {
  const lijst = info.gevonden.cameras;
  const aan = concept.cameras.aan;
  const rijen = lijst
    .map((c, i) => {
      const beeld = gekozenBeeld(c);
      const opties = [[null, t('functies.nietTonen')], ...c.beelden.map((b) => [b.id, b.naam.charAt(0).toUpperCase() + b.naam.slice(1)])];
      return `<div class="regelrij" style="flex-direction: column; align-items: stretch"><div class="l"><b>${esc(c.naam)}</b><span>${esc(t(beeld ? 'functies.inKamer' : 'functies.nietInApp'))}</span></div>${keuzes(t('w.beeldVan', { naam: c.naam }), `camera:${i}`, opties, beeld, !aan)}</div>`;
    })
    .join('');
  return `<h2 class="kop-2">${esc(t('functies.cameras'))}</h2>
    ${keuzes(t('functies.camerasInApp'), 'camerasAan', aanUit(), aan)}
    <div>${lijst.length ? rijen : `<p class="uitleg">${esc(t('functies.geenCameras'))}</p>`}</div>
    <p class="mini">${esc(t('functies.vloeiend'))}</p>`;
}

function deurbel() {
  const d = concept.deurbel;
  const melders = info.gevonden.melders;
  const beelden = info.gevonden.cameras.flatMap((c) => c.beelden.map((b) => ({ id: b.id, naam: c.beelden.length > 1 ? `${c.naam}, ${b.naam}` : c.naam })));
  const opt = (lijst, huidig, leeg) => `<option value="">${esc(leeg)}</option>${lijst.map((x) => `<option value="${esc(x.id)}" ${x.id === huidig ? 'selected' : ''}>${esc(x.naam)}</option>`).join('')}`;
  const zeker = melders.filter((m) => m.zeker);
  const misschien = melders.filter((m) => !m.zeker);
  const melderOpties = `<option value="">${esc(t('functies.kiesMelder'))}</option>${zeker.length ? `<optgroup label="${esc(t('functies.eenDeurbel'))}">${zeker.map((m) => `<option value="${esc(m.id)}" ${m.id === d.melder ? 'selected' : ''}>${esc(m.naam)}</option>`).join('')}</optgroup>` : ''}${misschien.length ? `<optgroup label="${esc(t('functies.heetDeurbel'))}">${misschien.map((m) => `<option value="${esc(m.id)}" ${m.id === d.melder ? 'selected' : ''}>${esc(m.naam)}</option>`).join('')}</optgroup>` : ''}`;
  const uit = !d.aan;
  return `<h2 class="kop-2">${esc(t('w.deurbel'))}</h2>
    ${keuzes(t('w.deurbel'), 'belAan', aanUit(), d.aan, !melders.length)}
    ${melders.length ? '' : `<p class="uitleg">${esc(t('functies.geenDeurbel'))}</p>`}
    <label class="veldnaam">${esc(t('functies.melder'))}<select class="invoer" data-veld="melder" ${uit ? 'disabled' : ''}>${melderOpties}</select></label>
    <label class="veldnaam">${esc(t('functies.beeld'))}<select class="invoer" data-veld="camera" ${uit ? 'disabled' : ''}>${opt(beelden, d.camera, t('functies.kiesCamera'))}</select></label>
    <span class="veldnaam">${esc(t('functies.schermAan'))}</span>
    ${keuzes(t('functies.schermAanLabel'), 'schermAan', [[true, t('w.ja')], [false, t('functies.nee')]], d.schermAan, uit)}
    <span class="veldnaam">${esc(t('functies.hoeLang'))}</span>
    ${keuzes(t('functies.hoeLangLabel'), 'seconden', [60, 120, 300].map((s) => [s, t('w.minuten2', { n: s / 60 })]), d.seconden, uit)}`;
}

/*
 * Licht en screens (besluit 167): bedienen in de app of alleen kijken, en per
 * kamer de lampen, scènes en screens, met een schakelaar om er een uit de app
 * te halen (dat is verbergen, zoals bij Kamers en indeling). Bij een screen of
 * hij zijn stand terugmeldt: alleen zo'n screen mag later in de regeling.
 * SunArc regelt licht en screens niet; dat doe je zelf.
 */
function lichtPerKamer() {
  const lay = indeling?.indeling ?? indeling?.voorstel;
  const weg = new Set(lay?.verborgen ?? []);
  const kamers = [];
  for (const e of huisData?.etages ?? []) {
    for (const r of e.ruimtes ?? []) {
      const dingen = (r.apparaten ?? []).filter((d) => d.soort === 'licht' || d.soort === 'screen');
      kamers.push({ id: r.id, naam: r.naam, dingen, scenes: r.scenes ?? [] });
    }
  }
  // Wat verborgen is, staat bij de kamer waar het stond.
  for (const v of huisData?.verborgen ?? []) {
    if (v.soort !== 'licht' && v.soort !== 'screen') continue;
    const k = kamers.find((x) => x.id === lay?.apparaten?.[v.id]?.kamer);
    if (k) k.dingen.push({ ...v, verborgen: true });
  }
  return kamers.filter((k) => k.dingen.length || k.scenes.length).map((k) => ({ ...k, dingen: k.dingen.map((d) => ({ ...d, verborgen: d.verborgen || weg.has(d.id) })) }));
}

function licht() {
  const mag = info.lichtMogelijk === true;
  const schermMag = info.schermMogelijk === true;
  const kamers = lichtPerKamer();
  const bedienen = () => [[true, t('functies.bedienen')], [false, t('functies.kijken')]];
  // Per kamer een knopje per lamp en screen: aan staat hij in de app. Compact, zodat het op de wand past.
  const knopje = (d) => {
    const terug = d.soort === 'screen' ? t(d.scherm?.terugmelding ? 'functies.meldtTerug' : d.scherm?.terugmelding === false ? 'functies.geenTerug' : 'functies.screen') : '';
    return `<button type="button" data-in-app="${esc(d.id)}" aria-pressed="${!d.verborgen}" aria-label="${esc(t('functies.inApp', { naam: d.naam }))}">${esc(d.naam)}${terug ? `<small> · ${esc(terug)}</small>` : ''}</button>`;
  };
  const lijst = kamers
    .map((k) => {
      // Op de wand alleen hoeveel scènes, anders schoof het blad; op de telefoon de namen, elke naam één keer.
      const namen = [...new Set(k.scenes.map((x) => x.naam))];
      const tel = namen.length ? `<span class="scenetal" title="${esc(namen.join(', '))}"> · ${esc(t('functies.scenesTal', { n: namen.length }))}</span>` : '';
      return `<div class="lichtkamer"><b>${esc(k.naam)}${tel}</b>${k.dingen.length ? `<div class="keuzes">${k.dingen.map(knopje).join('')}</div>` : ''}${namen.length ? `<span class="mini scenelijst">${esc(t('functies.scenes', { namen: namen.join(', ') }))}</span>` : ''}</div>`;
    })
    .join('');
  // Alleen wat deze installatie toestaat (besluit 130): een knop die niets kan, staat er niet.
  return `<h2 class="kop-2">${esc(t('functies.licht'))}</h2>
    <div class="lichtbedienen">${mag ? `<div><span class="veldnaam">${esc(t('functies.lichtScenes'))}</span>${keuzes(t('functies.lichtBedienen'), 'lichtAan', bedienen(), concept.licht.bedienen)}</div>` : ''}
    ${schermMag ? `<div><span class="veldnaam">${esc(t('functies.screens'))}</span>${keuzes(t('functies.schermenBedienen'), 'schermenAan', bedienen(), concept.schermen.bedienen)}</div>` : ''}</div>
    <p class="mini">${esc(t(mag || schermMag ? 'functies.bedienenHuis' : 'functies.nietToegestaan'))}</p>
    ${lijst ? `<h3 class="kop-3 geen-marge boven-8">${esc(t('functies.inDeApp'))}</h3><p class="mini">${esc(t('functies.tikUit'))}${kamers.some((k) => k.dingen.some((d) => d.soort === 'screen')) ? ` ${esc(t('functies.somfy'))}` : ''}</p><div class="lichtkamers">${lijst}</div>` : ''}`;
}

/** Een schakelaar, zoals bij Praten met je huis. */
const schakel = (aan, data, label, uit = false) => `<button type="button" class="schakelaar" role="switch" aria-checked="${aan}" aria-label="${esc(label)}" ${data} ${uit ? 'disabled' : ''}></button>`;

/** Een lamp of screen uit de app halen, of terug (besluit 167): verbergen in de indeling. */
async function inApp(id, aan) {
  const lay = JSON.parse(JSON.stringify(indeling?.indeling ?? indeling?.voorstel ?? null));
  if (!lay) return;
  lay.verborgen = aan ? (lay.verborgen ?? []).filter((x) => x !== id) : [...new Set([...(lay.verborgen ?? []), id])];
  // Zichtbaar zolang de dienst bewaart; daarna het huis opnieuw.
  indeling = { ...indeling, indeling: lay };
  teken();
  groep.bewaarStraks(async () => {
    const uit = await groep.stuur('api/indeling', lay);
    if (uit?.ok) {
      const [h, i] = await Promise.allSettled([haal('api/huis'), haal('api/indeling')]);
      if (h.status === 'fulfilled') huisData = h.value;
      if (i.status === 'fulfilled') indeling = i.value;
      teken();
    }
    return uit;
  }, 200);
}

/**
 * Te doen (besluit 216, schets Wand-Te-doen): aan of uit, en welke lijst van
 * Home Assistant de boodschappen en de to-do is, en welke agenda het afval en
 * het gezin. Het voorstel kiest ze vanzelf op hun naam.
 */
function teDoenVorm() {
  const td = concept.tedoen;
  const lijsten = info.gevonden.lijsten ?? [];
  const agendas = info.gevonden.agendas ?? [];
  // Een keuzelijst per vak: een rij knoppen met elf agenda's was onoverzichtelijk.
  const keus = (sleutel, label, opties) =>
    `<label class="veldnaam tdkeus">${esc(label)}<select class="invoer" data-tedoen-keus="${sleutel}" ${td.aan ? '' : 'disabled'}><option value="">${esc(t('w.geen'))}</option>${opties
      .map((x) => `<option value="${esc(x.id)}" ${td[sleutel] === x.id ? 'selected' : ''}>${esc(x.naam)}</option>`)
      .join('')}</select></label>`;
  return `<h2 class="kop-2">${esc(t('w.teDoen'))}</h2>
    ${keuzes(t('w.teDoen'), 'tedoen:aan', aanUit(), td.aan)}
    <p class="mini">${esc(t('functies.tedoen.uitleg'))}</p>
    ${lijsten.length ? `<div class="tdkeuzes">${keus('boodschappen', t('functies.tedoen.boodschappen'), lijsten)}${keus('todo', t('w.toDo'), lijsten)}</div>` : `<p class="uitleg">${esc(t('functies.tedoen.geenLijsten'))}</p>`}
    ${agendas.length ? `<div class="tdkeuzes">${keus('afval', t('w.afval'), agendas)}${keus('gezin', t('functies.tedoen.gezin'), agendas)}</div>` : ''}
    <p class="mini">${esc(t('functies.tedoen.jij'))} <a href="jij.html#agenda">${esc(t('w.jouwAgendaS'))} ›</a></p>`;
}

/**
 * Praten met je huis (besluit 148, 213; schets Wand-Instellingen-Praten, 30
 * oktober 2026). Zoals Stem en luisteren: links het brein (welk model, hoe
 * vaak en hoe snel, proberen), rechts wat de assistent mag bedienen, met
 * zinnen om te proberen en wat er naar buiten gaat.
 */
function praten() {
  const modellen = info.gevonden.taalmodellen ?? [];
  const p = concept.praten;
  if (p.taalmodel && teller == null) {
    teller = 'bezig';
    void haal('api/praten/teller').then(
      (r) => ((teller = r), teken()),
      () => (teller = { dagen: [] }),
    );
  }
  const status = p.taalmodel ? breinStatus() : null;
  const kaart = (id, naam, soort) =>
    `<button type="button" class="breinkaart" data-kies="taalmodel" data-waarde='${esc(JSON.stringify(id))}' aria-pressed="${p.taalmodel === id}"><b>${esc(naam)}</b><span>${esc(soort)}</span></button>`;
  const links = `<div class="stemlinks">
      <div class="stemkop"><h2 class="kop-2">${esc(t('functies.praten.kop'))}</h2>${status ? `<span class="breinpil ${status.soort}">${esc(status.tekst)}</span>` : ''}</div>
      <p class="uitleg">${esc(t('functies.praten.uitleg'))}</p>
      ${modellen.length
        ? `<div class="breinkaarten" role="group" aria-label="${esc(t('functies.praten.taalmodel'))}">${modellen.map((m) => kaart(m.id, m.naam, aanbieder(m.id))).join('')}${kaart(null, t('w.uit'), t('functies.praten.alleenVast'))}</div>`
        : `<p class="uitleg">${esc(t('functies.praten.geenAI'))}</p>`}
      ${p.taalmodel ? gebruikHtml() : ''}
      ${p.taalmodel ? proefHtml() : ''}
      <div class="buiten"><div><b class="wel">${esc(t('functies.praten.gaatNaar'))}</b><span>${esc(t('functies.praten.gaatNaarZin'))}</span></div><div><b class="niet">${esc(t('functies.praten.blijft'))}</b><span>${esc(t('functies.praten.blijftZin'))}</span></div></div>
    </div>`;
  return `<div class="stemtwee">${links}${bedienHtml()}</div>`;
}

/** Gemini, OpenAI of Claude, uit het id van de AI-taak; anders niets. */
function aanbieder(id) {
  return /google|gemini/.test(id) ? 'Gemini' : /openai|chatgpt/.test(id) ? 'OpenAI' : /anthropic|claude/.test(id) ? 'Claude' : /ollama/.test(id) ? 'Ollama' : t('functies.praten.taalmodel');
}

/** De dag van vandaag in de teller, of null. */
function tellerVandaag() {
  if (!teller || teller === 'bezig') return null;
  const vandaag = teller.vandaag ?? new Intl.DateTimeFormat('en-CA').format(new Date());
  return teller.dagen.find((x) => x.dag === vandaag) ?? null;
}

/** Hoe het model het doet (besluit 213): werkt, te traag, of alleen fouten vandaag. */
function breinStatus() {
  const d = tellerVandaag();
  if (!d || !d.vragen) return null;
  if (d.fouten === d.vragen) return { soort: 'fout', tekst: t('functies.praten.status.fout') };
  if (teller.eigenWoorden === false || (d.gemiddeldMs != null && d.gemiddeldMs > teller.wachtMs)) return { soort: 'traag', tekst: t('functies.praten.status.traag') };
  return { soort: 'werkt', tekst: t('functies.praten.status.werkt') };
}

/** Vandaag in drie getallen, en per dag van de afgelopen week een staafje (besluit 213). */
function gebruikHtml() {
  if (!teller || teller === 'bezig') return '';
  const d = tellerVandaag();
  const s = (ms) => (ms == null ? '–' : `${taal.getal(ms / 1000, 1)} s`);
  const vak = (getal, label, kleur = '') => `<div class="breingetal${kleur}"><b>${esc(getal)}</b><span>${esc(label)}</span></div>`;
  const traag = d?.gemiddeldMs != null && d.gemiddeldMs > teller.wachtMs;
  // De week: zeven dagen tot en met vandaag, ook de dagen zonder vragen.
  const eind = Date.parse(`${teller.vandaag ?? new Intl.DateTimeFormat('en-CA').format(new Date())}T12:00:00Z`);
  const dagen = Array.from({ length: 7 }, (_, i) => {
    const ms = eind - (6 - i) * 86_400_000;
    const dag = new Date(ms).toISOString().slice(0, 10);
    return { dag, ms, vragen: teller.dagen.find((x) => x.dag === dag)?.vragen ?? 0 };
  });
  const hoogst = Math.max(1, ...dagen.map((x) => x.vragen));
  const kort = new Intl.DateTimeFormat(taal.code === 'en' ? 'en-GB' : 'nl-NL', { weekday: 'narrow', timeZone: 'UTC' });
  const week = dagen.reduce((n, x) => n + x.vragen, 0);
  const staven = `<div class="breinweek" role="img" aria-label="${esc(t('functies.praten.teller.week', { n: week }))}">${dagen
    .map((x, i) => `<div class="staaf${i === 6 ? ' nu' : ''}"><i style="height: ${Math.round((x.vragen / hoogst) * 100)}%"></i><span>${esc(kort.format(x.ms))}</span></div>`)
    .join('')}</div>`;
  const noot = teller.eigenWoorden === false ? t('functies.praten.teller.overslaan') : traag ? t('functies.praten.teller.traag', { w: taal.getal(teller.wachtMs / 1000, 0) }) : d?.fouten ? t('functies.praten.teller.fouten', { n: d.fouten }) : null;
  return `<div class="breingebruik">
      <div class="breingetallen">${vak(String(d?.vragen ?? 0), t('functies.praten.vandaagVragen'))}${vak(s(d?.gemiddeldMs), t('functies.praten.gemiddeld'), traag ? ' traag' : '')}${vak(s(d?.langsteMs), t('functies.praten.langste'))}</div>
      ${staven}
    </div>
    ${noot ? `<p class="mini${traag || teller.eigenWoorden === false ? ' breinlet' : ''}">${esc(noot)}</p>` : ''}`;
}

/** Proberen (besluit 148): het vaste antwoord naast eigen woorden, met hoe lang het duurde. */
function proefHtml() {
  const knop = `<button type="button" class="knop knop-licht" data-proef ${proef === 'bezig' ? 'disabled' : ''}>${esc(t(proef === 'bezig' ? 'functies.praten.proberen' : proef ? 'functies.praten.nogEens' : 'functies.praten.probeer'))}</button>`;
  if (!proef || proef === 'bezig') return `<div>${knop}</div>`;
  return `<div class="proef"><div><span>${esc(t('functies.praten.vast'))}</span>${esc(proef.vast)}</div><div class="eigen"><span>${esc(t('functies.praten.eigen'))}</span>${esc(proef.eigen ?? t('functies.praten.lukteNiet'))}</div></div>
    <div class="breinproef">${knop}${proef.snel && proef.ms != null ? `<span class="mini">${esc(t('functies.praten.na', { s: taal.getal(proef.ms / 1000, 1) }))}</span>` : ''}</div>
    ${proef.reden ? `<p class="mini breinlet">${esc(proef.reden)}</p>` : ''}`;
}

/** Rechts: wat de assistent mag bedienen, zinnen om te proberen, en wat er naar buiten gaat. */
function bedienHtml() {
  const p = concept.praten;
  const bedienKan = info.lichtMogelijk === true || info.schermMogelijk === true;
  const icoon = (pad) => `<span class="breinicoon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pad}</svg></span>`;
  const rij = (ik, kop, zin, rechts, klasse = '') => `<div class="regelrij breinrij${klasse}">${ik}<div class="l"><b>${esc(kop)}</b><span>${esc(zin)}</span></div>${rechts}</div>`;
  const rijen = [
    bedienKan
      ? rij(
          icoon('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
          t(info.schermMogelijk ? 'functies.licht' : 'functies.praten.rij.licht'),
          t(info.schermMogelijk ? 'functies.praten.rij.lichtSchermZin' : 'functies.praten.rij.lichtZin'),
          schakel(p.bedienen, `data-kies="pratenBedienen" data-waarde='${!p.bedienen}'`, t('functies.praten.bedienen')),
        )
      : '',
    info.gevonden.klimaatBrug
      ? rij(icoon('<path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"/>'), t('functies.praten.klimaat'), t('functies.praten.rij.klimaatZin'), schakel(p.klimaat === true, `data-kies="pratenKlimaat" data-waarde='${p.klimaat !== true}'`, t('functies.praten.klimaat')))
      : '',
    rij(icoon('<path d="M3 21V9l9-6 9 6v12"/><path d="M7 21v-8h10v8M7 17h10"/>'), t('functies.praten.rij.nooit'), t('functies.praten.rij.nooitZin'), `<span class="breinnooit">${esc(t('w.nooit'))}</span>`, ' grijs'),
  ].join('');
  const zinnen = ['functies.praten.zin1', 'functies.praten.zin2', 'functies.praten.zin3', ...(p.taalmodel ? ['functies.praten.zin4'] : [])];
  return `<div class="stemrechts">
      <h2 class="kop-2 breinrechtskop">${esc(t('functies.praten.bedienKort'))}</h2>
      <div class="breinrijen">${rijen}</div>
      <div><span class="veldnaam">${esc(t('functies.praten.probeerEens'))}</span><div class="breinzinnen">${zinnen.map((k) => `<span>${esc(t(k))}</span>`).join('')}</div></div>
    </div>`;
}

const SPEEL = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

/** De stem die nu spreekt: de keuze, of vanzelf (besluit 212). */
function stemGekozen() {
  const opties = stemmen?.opties ?? [];
  const keuze = concept.praten.stemKeuze ?? null;
  if (keuze && opties.some((o) => o.id === keuze)) return keuze;
  // Vanzelf: de stem die de dienst nu gebruikt, of het apparaat.
  return opties.find((o) => o.id.startsWith(`${stemmen?.nu ?? '-'}|`))?.id ?? 'apparaat';
}

/** Stem en luisteren (besluit 212, schets Wand-Instellingen-Stem): links de stem van je huis. */
function stemVorm() {
  const opties = stemmen?.opties ?? [];
  const gekozen = stemGekozen();
  geslacht ??= opties.find((o) => o.id === gekozen)?.geslacht ?? 'vrouw';
  const kaart = (o) => `<div class="stemkaart" role="button" tabindex="0" data-stem-kies="${esc(o.id)}" aria-pressed="${o.id === gekozen}">
      <b>${esc(o.naam)}</b>
      <button type="button" class="speel" data-stem-speel="${esc(o.id)}" aria-label="${esc(t('functies.stem.laatHoren', { naam: o.naam }))}">${SPEEL}</button>
      <span class="soort"><span class="stemlabel ${o.soort}">${esc(t(`functies.stem.soort.${o.soort}`))}</span>${esc(o.kenmerk[taal.code] ?? o.kenmerk.nl)}</span>
    </div>`;
  const hd = opties.filter((o) => o.soort === 'hd' && o.geslacht === geslacht).slice(0, 6);
  const huis = opties.filter((o) => (o.soort === 'huis' && o.geslacht === geslacht) || o.soort === 'apparaat');
  return `<div class="stemtwee"><div class="stemlinks"><div class="stemkop"><h2 class="kop-2">${esc(t('functies.stem.titel'))}</h2>
      ${keuzes(t('functies.stem.geslacht'), 'stemGeslacht', [['vrouw', t('functies.stem.vrouw')], ['man', t('functies.stem.man')]], geslacht)}</div>
    ${hd.length ? `<span class="veldnaam">${esc(t('functies.stem.hd'))}</span><div class="stemmen">${hd.map(kaart).join('')}</div>` : ''}
    <span class="veldnaam">${esc(t('functies.stem.inHuis'))}</span><div class="stemmen">${huis.map(kaart).join('')}</div>
    <div class="stemzin">${esc(t('functies.stem.voorbeeld'))} <b>"${esc(stemmen?.voorbeeld?.[taal.code] ?? '')}"</b></div>
    <p class="mini">${esc(t(hd.length ? 'functies.stem.hdZin' : 'functies.stem.geenHd'))}</p></div>
    ${luisterVak()}</div>`;
}

/** Rechts ernaast: het luisteren, dat de app zelf doet (besluit 208, 211). */
function luisterVak() {
  let hier;
  try {
    hier = localStorage.getItem('sc-luisteren') === 'aan';
  } catch {
    hier = false;
  }
  const https = window.isSecureContext;
  const verstaan = luisterStand?.verstaan;
  return `<div class="stemrechts">
    <h2 class="kop-2">${esc(t('functies.luister.kop'))}</h2>
    <div class="wekwoord"><span class="bol" aria-hidden="true"></span><div><b>"Hé huis"</b><span>${esc(t('functies.luister.wekwoordZin'))}</span></div></div>
    <span class="veldnaam geen-marge">${esc(t('functies.luister.hier'))}</span>
    <div class="keuzes" role="group" aria-label="${esc(t('functies.luister.hierLabel'))}" style="flex-wrap: nowrap"><button type="button" data-hier="aan" aria-pressed="${hier}" ${https ? '' : 'disabled'}>${esc(t('w.aan'))}</button><button type="button" data-hier="uit" aria-pressed="${!hier}">${esc(t('w.uit'))}</button></div>
    ${https ? '' : `<p class="uitleg" style="color: var(--zon-t)">${esc(t('functies.luister.https'))}</p>`}
    ${hier && https ? schuiven(luisterStand?.zelf === true) : ''}
    <p class="mini">${esc(verstaan ? t('functies.luister.verstaanHuis', { naam: verstaan.replace(/^stt\./, '').replace(/_/g, ' ') }) : t('functies.luister.verstaanHA'))}</p>
    <p class="mini">${esc(t('functies.luister.privacy'))}</p>
  </div>`;
}

/** Het wekwoord zoals je het zegt: "he_huis" is "Hé huis". */

/** Hoe dit scherm luistert (besluit 208): de gevoeligheid van "Hé huis" en de wachttijd na je laatste woord. */
function schuiven(zelf) {
  const lees = (k, std) => {
    try {
      return localStorage.getItem(k) ?? std;
    } catch {
      return std;
    }
  };
  const g = Number(lees('sc-gevoeligheid', '3'));
  const w = lees('sc-wachttijd', 'normaal');
  const v = luisterStand?.vandaag;
  // Vaak wakker zonder vraag: dan is hij waarschijnlijk te gevoelig.
  const vaakVals = v && v.zonderVraag >= 3 && v.zonderVraag * 2 >= v.wakker;
  const gevoel = zelf
    ? `<label class="schuif">${esc(t('functies.luister.gevoelig'))}<b data-gevoelig-naam>${esc(t(`functies.luister.stand${g}`))}</b><input type="range" min="1" max="5" step="1" value="${g}" data-gevoelig aria-label="${esc(t('functies.luister.gevoelig'))}"></label>
    <div style="display: flex; justify-content: space-between" class="mini"><span>${esc(t('functies.luister.strenger'))}</span><span>${esc(t('functies.luister.gevoeliger'))}</span></div>
    ${v ? `<p class="mini">${esc(t(v.wakker === 1 ? 'functies.luister.vandaagEen' : 'functies.luister.vandaag', { n: v.wakker, vals: v.zonderVraag }))}</p>` : ''}
    ${vaakVals && g > 1 ? `<p class="uitleg" style="color: var(--zon-t)">${esc(t('functies.luister.teVaak'))}</p>` : ''}`
    : '';
  return `${gevoel}
    <span class="veldnaam">${esc(t('functies.luister.wachttijd'))}</span>
    ${keuzes(t('functies.luister.wachttijd'), 'wachttijd', [['vlot', t('functies.luister.vlot')], ['normaal', t('functies.luister.normaal')], ['rustig', t('functies.luister.rustig')]], w)}
    <p class="mini">${esc(t('functies.luister.wachttijdZin'))}</p>`;
}

function weer() {
  const bronnen = info.gevonden.weerbronnen ?? [];
  // Open-Meteo voorop (besluit 130): werkt voor elk huis. De rest onder "Andere bron".
  const meteo = bronnen.find((b) => b.id === 'open-meteo');
  const andere = bronnen.filter((b) => b.id !== 'open-meteo');
  const anderGekozen = concept.weer.bron !== 'open-meteo';
  return `<h2 class="kop-2">${esc(t('w.weer'))}</h2>
    ${meteo ? keuzes(t('functies.weer.bron'), 'weerBron', [['open-meteo', t('functies.weer.meteo')]], concept.weer.bron) : ''}
    <p class="mini">${esc(t('functies.weer.waarvoor'))}</p>
    <details ${anderGekozen ? 'open' : ''}><summary class="mini" style="cursor: pointer; font-weight: 700; color: var(--zacht)">${esc(t('functies.weer.andere'))}</summary>
      <div class="boven-8">${keuzes(t('functies.weer.andereLabel'), 'weerBron', [...andere.map((b) => [b.id, b.naam]), [null, t('functies.weer.geen')]], concept.weer.bron)}</div>
    </details>
    <span class="veldnaam">${esc(t('functies.weer.perUur'))}</span>
    ${keuzes(t('functies.weer.perUurLabel'), 'weerUren', [[true, t('functies.weer.bewaren')], [false, t('functies.weer.nietBewaren')]], concept.weer.uren !== false)}
    <p class="mini">${esc(t('functies.weer.uitleg'))}</p>`;
}

/** Meldingen (besluit 149): onder welk percentage een batterij of filter een melding geeft. */
const DREMPELS = () => [[null, t('w.nooit')], [5, '5%'], [10, '10%'], [20, '20%'], [30, '30%']];
/*
 * Meldingen (besluit 346, schets Wand-Instellingen-Meldingen): alles wat de bel
 * kent, in groepen, met een schakelaar per soort. Rook, een meter en wat niet
 * klopt staan altijd aan; batterij en filter houden hun grens. Wat je huis niet
 * heeft (geen auto, geen thuisaccu, geen panelen), staat er niet.
 */
const MELD_ALTIJD = 'altijd';
function meldGroepen() {
  const opslag = huisData?.opslag;
  const heeft = {
    panelen: (zon?.panelen ?? []).length > 0,
    accu: !!opslag?.batterij,
    auto: (opslag?.autos ?? []).length > 0,
    comfort: (bewoners?.bewoners ?? []).length > 1,
    mijlpaal: site?.migrating === true,
  };
  const rij = (soort, keuze = soort) => ({ soort, keuze });
  const groep = (id, rijen) => ({ id, rijen: rijen.filter((x) => heeft[x.soort] !== false) });
  return [
    groep('veiligheid', [rij('rook', MELD_ALTIJD)]),
    groep('apparaten', [rij('nieuw'), rij('weg'), rij('stil'), rij('batterij', 'grens'), rij('filter', 'grens')]),
    groep('energie', [rij('meter', MELD_ALTIJD), rij('sluip'), rij('panelen'), rij('stekker'), rij('accu'), rij('auto')]),
    groep('sunarc', [rij('klopt', MELD_ALTIJD), rij('comfort'), rij('versie'), rij('mijlpaal')]),
  ];
}
function meldRij({ soort, keuze }) {
  const m = concept.meldingen;
  const titel = t(`functies.mk.${soort}`);
  const zin = `<span><b>${esc(titel)}</b><small>${esc(t(`functies.mk.${soort}.zin`))}</small></span>`;
  if (keuze === MELD_ALTIJD) return `<div class="mk-rij">${zin}<span class="mk-altijd">${esc(t('functies.mk.altijd'))}</span></div>`;
  if (keuze === 'grens') return `<div class="mk-rij grens${m[soort] == null ? ' uit' : ''}">${zin}${keuzes(t('functies.mk.onder', { titel }), soort === 'batterij' ? 'drempelBatterij' : 'drempelFilter', DREMPELS(), m[soort])}</div>`;
  const aan = !m.uit.includes(soort);
  return `<div class="mk-rij${aan ? '' : ' uit'}">${zin}<button type="button" class="schakelaar" role="switch" aria-checked="${aan}" aria-label="${esc(titel)}" data-meld-schakel="${esc(soort)}"></button></div>`;
}
function meldingen() {
  const groepen = meldGroepen().filter((g) => g.rijen.length);
  const groepHtml = ({ id, rijen }) => `<section class="mk-groep"><h3>${esc(t(`functies.mk.groep.${id}`))}</h3>${rijen.map(meldRij).join('')}</section>`;
  const telefoon = `<a class="mk-tel" href="jij.html#meldingen"><span><b>${esc(t('functies.mk.telefoon'))}</b><small>${esc(t('functies.mk.telefoonZin'))}</small></span><span class="pijl" aria-hidden="true">›</span></a>`;
  const kop = `<div class="mk-kop"><h2 class="kop-2">${esc(t('w.meldingen'))}</h2><span>${esc(t('functies.mk.uitleg'))}</span></div>`;
  if (app.telStand()) return `${kop}${groepen.map(groepHtml).join('')}${telefoon}`;
  // Op de wand twee kolommen: links veiligheid en je apparaten, rechts energie en SunArc.
  const links = groepen.filter((g) => g.id === 'veiligheid' || g.id === 'apparaten');
  const rechts = groepen.filter((g) => g.id === 'energie' || g.id === 'sunarc');
  return `${kop}<div class="mk-twee"><div class="mk-kol">${links.map(groepHtml).join('')}${telefoon}</div><div class="mk-kol">${rechts.map(groepHtml).join('')}</div></div>`;
}

function delen() {
  const alle = alleDelen();
  if (isAssistent) return alle.filter((x) => ASSISTENT.includes(x.id));
  return alle.filter((x) => !ASSISTENT.includes(x.id));
}

function alleDelen() {
  if (!info || !concept) return [];
  const f = concept;
  const beelden = f.cameras.aan ? f.cameras.lijst.length : 0;
  const weerNaam = (info.gevonden.weerbronnen ?? []).find((b) => b.id === f.weer.bron)?.naam?.replace(' (via internet)', '') ?? t('w.geen');
  const s = f.deurbel.seconden;
  return [
    { id: 'cameras', titel: t('functies.cameras'), zin: f.cameras.aan ? t('functies.deel.inApp', { n: beelden }) : t('w.uit2'), stand: 'goed' },
    { id: 'deurbel', titel: t('w.deurbel'), zin: f.deurbel.aan ? t('instellingen.beeld', { duur: s >= 60 ? t('algemeen.minuten', { n: s / 60 }) : t('instellingen.seconden', { n: s }) }) : t('w.uit2'), stand: f.deurbel.aan && (!f.deurbel.melder || !f.deurbel.camera) ? 'mist' : 'goed' },
    { id: 'licht', titel: t('functies.licht'), zin: t((info.lichtMogelijk || info.schermMogelijk) && f.licht.bedienen ? 'instellingen.bedienen' : 'instellingen.alleenKijken'), stand: 'goed' },
    { id: 'weer', titel: t('w.weer'), zin: weerNaam, stand: f.weer.bron ? 'goed' : 'leeg' },
    { id: 'meldingen', titel: t('w.meldingen'), zin: meldZin(), stand: 'goed' },
    { id: 'praten', titel: t('functies.deel.praten'), zin: f.praten.taalmodel ? (info.gevonden.taalmodellen ?? []).find((m) => m.id === f.praten.taalmodel)?.naam ?? t('functies.deel.eigen') : t('functies.deel.vast'), stand: 'goed' },
    // Stem en luisteren (besluit 212): de stem van je huis, en "Hé huis".
    { id: 'stem', titel: t('functies.deel.stem'), zin: (stemmen?.opties ?? []).find((o) => o.id === stemGekozen())?.naam ?? t('functies.deel.vanzelf'), stand: 'goed' },
    // Te doen (besluit 216): de lijsten en agenda's van Home Assistant.
    { id: 'tedoen', titel: t('w.teDoen'), zin: f.tedoen?.aan ? t('functies.tedoen.zin', { n: ['boodschappen', 'todo', 'afval', 'gezin'].filter((k) => f.tedoen[k]).length }) : t('w.uit2'), stand: 'goed' },
  ];
}

/** Hoeveel soorten de bel meldt (besluit 346): wat je kunt kiezen, en daarvan aan. */
function meldZin() {
  const m = concept.meldingen;
  const rijen = meldGroepen().flatMap((g) => g.rijen).filter((x) => x.keuze !== MELD_ALTIJD);
  const aan = rijen.filter((x) => (x.keuze === 'grens' ? m[x.soort] != null : !m.uit.includes(x.soort))).length;
  return aan === rijen.length ? t('functies.mk.alles') : t('functies.mk.zinAan', { aan, alle: rijen.length });
}

function tekenNu() {
  app.schaal();
  app.luchtVan(zon, 0);
  if (!info || !concept) return;
  const nu = groep.tekenDelen(delen().map((x) => (x.id && nogTekst(x.id) ? { ...x, nog: nogTekst(x.id) } : x)));
  const vorm = { cameras, deurbel, licht, weer, praten, stem: stemVorm, tedoen: teDoenVorm, meldingen }[nu]?.() ?? '';
  // Terug naar standaard (besluit 204): rechtsboven, alleen als dit deel afwijkt van wat de app voorstelt.
  const terug = afwijkend(nu) ? `<button type="button" class="knop stdknop" data-standaard-deel="${esc(nu)}">${esc(t('w.terugNaarStandaard'))}</button>` : '';
  $$('[data-vorm]').forEach((el) => {
    el.innerHTML = terug + nogKlaar(nu) + vorm;
    el.classList.toggle('metstd', !!terug);
  });
  // Geen opsomming meer ernaast (besluit 344): dan is er ook geen knop Hulp.
  $$('[data-naast]').forEach((el) => (el.innerHTML = ''));
}
/** Welke instellingen bij een deel horen (besluit 204), om ze terug te zetten naar het voorstel. */
const STANDAARD_DEEL = { cameras: ['cameras'], deurbel: ['deurbel'], licht: ['licht', 'schermen'], weer: ['weer'], meldingen: ['meldingen'], praten: ['praten'] };
function afwijkend(deel) {
  const sleutels = STANDAARD_DEEL[deel];
  return !!sleutels && sleutels.some((s) => info.voorstel?.[s] != null && JSON.stringify(concept[s]) !== JSON.stringify({ ...info.voorstel[s], ...vulAan(s, concept[s], info.voorstel[s]) }));
}
/** Velden die het voorstel niet noemt maar het concept wel (zoals een lege lijst): die tellen niet als afwijking. */
function vulAan(s, nu, voorstel) {
  return Object.fromEntries(Object.keys(nu ?? {}).filter((k) => !(k in voorstel)).map((k) => [k, nu[k]]));
}

function bewaar() {
  groep.bewaarStraks(async () => {
    const uit = await groep.stuur('api/functies', concept);
    if (uit?.ok) info = uit.antwoord;
    return uit;
  });
}

/* ------------------------------------------------------------ doen */

document.addEventListener('click', (e) => {
  if (klaarstappen.klik(e, laadKlaar)) return;
  const knop = e.target.closest('button');
  if (!knop || knop.disabled || !concept) return;
  // Terug naar standaard (besluit 204): dit deel weer zoals de app het voorstelt.
  if (knop.dataset.standaardDeel) {
    for (const s of STANDAARD_DEEL[knop.dataset.standaardDeel] ?? []) if (info.voorstel?.[s] != null) concept[s] = JSON.parse(JSON.stringify(info.voorstel[s]));
    teken();
    bewaar();
    return;
  }
  // Een soort melding aan of uit (besluit 346).
  if (knop.dataset.meldSchakel) {
    const soort = knop.dataset.meldSchakel;
    const aan = knop.getAttribute('aria-checked') !== 'true';
    concept.meldingen.uit = aan ? concept.meldingen.uit.filter((x) => x !== soort) : [...concept.meldingen.uit, soort];
    teken();
    bewaar();
    return;
  }
  if (knop.dataset.inApp) return void inApp(knop.dataset.inApp, knop.getAttribute('aria-pressed') !== 'true');
  // Dit scherm luistert (besluit 150): alleen in deze browser, niet bij de dienst.
  if (knop.dataset.hier) {
    try {
      localStorage.setItem('sc-luisteren', knop.dataset.hier);
    } catch {
      // Dan niet.
    }
    // Aan: meteen beginnen, zonder de pagina te verversen.
    if (knop.dataset.hier === 'aan' && !window.luisteren) {
      const sc = document.createElement('script');
      sc.src = 'luisteren.js';
      document.head.appendChild(sc);
    }
    teken();
    return groep.zegBewaard('ok', t(knop.dataset.hier === 'aan' ? 'functies.luistertNu' : 'functies.luistertNiet'));
  }
  // Proberen (besluit 148): één vraag aan het gekozen taalmodel, er verandert niets.
  if (knop.hasAttribute('data-proef') && concept.praten.taalmodel) {
    proef = 'bezig';
    teken();
    void haal(`api/praten/proef?model=${encodeURIComponent(concept.praten.taalmodel)}`).then(
      (r) => ((proef = r), (teller = null), teken()),
      () => ((proef = { vast: t('functies.praten.geenAntwoord'), eigen: null }), teken()),
    );
    return;
  }
  if (knop.dataset.kies) {
    const w = JSON.parse(knop.dataset.waarde);
    const s = knop.dataset.kies;
    // De wachttijd hoort bij dit scherm (besluit 208), niet bij de dienst.
    if (s === 'wachttijd') return bewaarHier('sc-wachttijd', w, t('functies.luister.bewaard'));
    // Vrouw of man in beeld (besluit 212): alleen de lijst, er wordt niets bewaard.
    if (s === 'stemGeslacht') return void ((geslacht = w), teken());
    if (s === 'camerasAan') concept.cameras.aan = w;
    else if (s === 'belAan') {
      concept.deurbel.aan = w;
      // Aanzetten zonder keuze: de eerste deurbel, met zijn eigen camera.
      if (w && !concept.deurbel.melder) {
        const m = info.gevonden.melders[0];
        concept.deurbel.melder = m?.id ?? null;
        concept.deurbel.camera ??= m?.camera ?? null;
      }
    } else if (s === 'schermAan') concept.deurbel.schermAan = w;
    else if (s === 'lichtAan') concept.licht.bedienen = w;
    else if (s === 'schermenAan') concept.schermen.bedienen = w;
    else if (s === 'weerBron') concept.weer.bron = w;
    else if (s === 'weerUren') concept.weer.uren = w;
    else if (s === 'taalmodel') {
      concept.praten.taalmodel = w;
      proef = null;
    } else if (s === 'pratenBedienen') concept.praten.bedienen = w;
    // De klimaatbrug (besluit 210): de knoppen van je eigen regeling, tot stap B.
    else if (s === 'pratenKlimaat') concept.praten.klimaat = w;
    // Te doen (besluit 216): aan of uit, en welke lijst en agenda wat is.
    else if (s.startsWith('tedoen:')) concept.tedoen[s.slice(7)] = w;
    else if (s === 'spraak') concept.praten.spraak = w;
    else if (s === 'stemBron') concept.praten.stem = w;
    else if (s === 'stemVerstaan') concept.praten.verstaan = w;
    else if (s === 'seconden') concept.deurbel.seconden = w;
    else if (s === 'drempelBatterij') concept.meldingen.batterij = w;
    else if (s === 'drempelFilter') concept.meldingen.filter = w;
    else if (s.startsWith('camera:')) {
      // Per camera één beeld: het andere beeld van dezelfde camera gaat eruit.
      const c = info.gevonden.cameras[Number(s.slice(7))];
      const anders = new Set(c.beelden.map((b) => b.id));
      concept.cameras.lijst = concept.cameras.lijst.filter((id) => !anders.has(id));
      if (w) concept.cameras.lijst.push(w);
    }
    teken();
    // Een deurbel aan zonder melder of beeld kan de dienst niet bewaren: eerst kiezen.
    if (concept.deurbel.aan && (!concept.deurbel.melder || !concept.deurbel.camera)) return groep.zegBewaard('fout', t('functies.kiesDeurbel'));
    bewaar();
  }
});

/* ------------------------------------------------- stem kiezen en horen (besluit 212) */

let speler = null;
/** Een stem laten horen: uit Home Assistant, of die van het apparaat zelf. */
function speelStem(id, knop) {
  speler?.pause();
  window.speechSynthesis?.cancel();
  $$('.speel.speelt').forEach((k) => k.classList.remove('speelt'));
  const zin = stemmen?.voorbeeld?.[taal.code] ?? stemmen?.voorbeeld?.nl ?? '';
  const klaar = () => knop.classList.remove('speelt');
  knop.classList.add('speelt');
  if (id === 'apparaat') {
    // De stem van dit scherm zelf, of Fully Kiosk aan de wand; zonder stem zeggen we dat, in plaats van stilte.
    if (!app.kanApparaatSpreken()) {
      klaar();
      groep.zegBewaard('fout', t('functies.stem.geenApparaat'));
      return;
    }
    void app.zegMetApparaat(zin.replace(/(\d+),(\d)/g, '$1 komma $2'), taal.code).then((gelukt) => {
      klaar();
      if (!gelukt) groep.zegBewaard('fout', t('functies.stem.geenApparaat'));
    });
    return;
  }
  speler = new Audio(`api/stem?tekst=${encodeURIComponent(zin)}&taal=${taal.code}&keuze=${encodeURIComponent(id)}`);
  speler.onended = klaar;
  speler.onerror = () => {
    klaar();
    groep.zegBewaard('fout', t('functies.stem.lukteNiet'));
  };
  speler.play().catch(klaar);
}

document.addEventListener('click', (e) => {
  const speel = e.target.closest?.('[data-stem-speel]');
  if (speel) {
    e.stopPropagation();
    return speelStem(speel.dataset.stemSpeel, speel);
  }
  const kies = e.target.closest?.('[data-stem-kies]');
  if (!kies || !concept) return;
  concept.praten.stemKeuze = kies.dataset.stemKies;
  // Wie al luistert of praat, gebruikt meteen de nieuwe stem.
  window.luisteren?.stemOpnieuw?.();
  teken();
  bewaar();
  speelStem(kies.dataset.stemKies, kies.querySelector('[data-stem-speel]'));
}, true);

// De helderheid: het getal loopt mee met de schuif, bewaard bij loslaten (besluit 206).
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.matches?.('[data-gevoelig]')) el.parentElement.querySelector('[data-gevoelig-naam]').textContent = t(`functies.luister.stand${el.value}`);
});

/** Een schuif van dit scherm (besluit 208): alleen in deze browser, en meteen in gebruik. */
function bewaarHier(sleutel, waarde, zin) {
  try {
    localStorage.setItem(sleutel, waarde);
  } catch {
    // Dan alleen voor nu.
  }
  window.luisteren?.opnieuw?.();
  teken();
  groep.zegBewaard('ok', zin);
}

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches?.('[data-gevoelig]')) return bewaarHier('sc-gevoeligheid', String(el.value), t('functies.luister.bewaard'));
  // Te doen (besluit 216): welke lijst of agenda wat is, uit een keuzelijst.
  if (el.matches?.('[data-tedoen-keus]') && concept) {
    concept.tedoen[el.dataset.tedoenKeus] = el.value || null;
    teken();
    return bewaar();
  }
  const veld = e.target.closest('[data-veld]');

  if (!veld || !concept) return;
  const v = veld.value || null;
  if (veld.dataset.veld === 'melder') {
    concept.deurbel.melder = v;
    // Een melder met een eigen camera neemt die mee, als er nog geen beeld gekozen is.
    const m = info.gevonden.melders.find((x) => x.id === v);
    if (m?.camera && !concept.deurbel.camera) concept.deurbel.camera = m.camera;
  } else if (veld.dataset.veld === 'camera') concept.deurbel.camera = v;
  teken();
  if (concept.deurbel.aan && (!concept.deurbel.melder || !concept.deurbel.camera)) return groep.zegBewaard('fout', t('functies.kiesDeurbel'));
  bewaar();
});

/* ------------------------------------------------------------ starten */

/** Gebundeld: hooguit één keer per beeld (basis.js). */
const teken = app.gebundeld(tekenNu);
addEventListener('standwissel', teken);
addEventListener('hashchange', teken);

app.start('instellingen');
void laad();


