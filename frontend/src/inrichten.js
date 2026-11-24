/*
 * Inrichten in zeven stappen (besluit 323, schets Wand-Inrichten-Kort): je
 * huis, meter en zekering, panelen, prijzen, verwarming, wie woont hier, en
 * klaar. Elke stap is een voorstel uit wat Home Assistant al weet, met "Klopt
 * dit?": één tik als het goed is. Achter Aanpassen staan de schermen van eerst
 * (hieronder), als delen van die stap. Wat er niet meer in zit (je dag,
 * comfort, afwezig, op zon, licht, de wand, de stem) opent nog met een link;
 * de standpagina biedt het aan (besluit 322). SunArc begint met een basis
 * (besluit 312).
 *
 * Van eerst: Inrichten in één keer (besluit 139, 144 en 190, schets Wand-Inrichten-3).
 * Acht hoofdstukken op één pagina, zonder menu, met kleine stappen erin: je huis
 * (wat voor huis, de kamers, de apparaten), buiten, wie er woont, klimaat (wat
 * elk apparaat doet, meten, comfort, afwezig en vakantie), energie (zekering,
 * panelen, hoe ze liggen, op zon, prijzen), gemak, je schermen, en klaar (wat
 * er in Home Assistant klaar moet staan, en de film). Na Inrichten is de app af.
 * Links groeit het huis mee op zijn eiland, rechts staat één vraag. Wat Home
 * Assistant al weet, staat klaar; de bewoner kijkt of het klopt.
 *
 * Elke keuze gaat meteen naar de dienst, langs dezelfde deuren als de pagina's
 * bij Instellingen (indeling, comfort, aansluiting, energie). Onderaan staat
 * overal hetzelfde (besluit 158): links Terug, rechts Volgende. Volgende bewaart
 * wat er in beeld staat, ook als je niets aanraakte, en de stap telt dan als
 * nagelopen. Wat nog niet is nagelopen, staat bij Klaar, en alles is later te
 * openen.
 */
'use strict';
/* global antwoorden, dagMoment, dagUur, kanOpen, kanToestellen, kanVraagOpen, teken */
/* exported $$, HOOFD, IK, S, STAPPEN, bewaarIndeling, binnen, buitenRuimtes, concept, d, delenVan, deur, energieNu, esc, gedaan, geenKlimaat, haal, hoofdVan, idVan, klimaatIn, knop, laad, lijst, lijstje, markeer, melding, model, naar, nl, regel, rij, schakel, schakelaar, sleutel, stapGedaan, stapNagelopen, stapNu, stuur, tekenWelkom, tellingen, tip, verder, volgende, vorige, waarVan, welkom, zeg */

const { $$, esc, haal, deur, nl } = app;

const d = { huis: null, ind: null, comfort: null, aans: null, energie: null, zon: null, functies: null, sessie: null, bewoners: null, klaar: null, voork: null, integ: null, inHuis: null };

async function laad() {
  const namen = ['huis', 'ind', 'comfort', 'aans', 'energie', 'zon', 'functies', 'sessie', 'bewoners', 'klaar', 'voork', 'integ', 'inHuis'];
  const uit = await Promise.allSettled(['api/huis', 'api/indeling', 'api/comfort', 'api/aansluiting', 'api/energie', 'api/zon', 'api/functies', 'api/sessie', 'api/bewoners', 'api/klaarzetten', 'api/voorkeuren', 'api/integratie', 'api/stem-in-huis'].map((p) => haal(p)));
  uit.forEach((r, i) => {
    if (r.status === 'fulfilled') d[namen[i]] = r.value;
  });
  teken();
}

/*
 * De zon elke tien minuten opnieuw: eerst alleen bij het
 * openen, en ging dat net mis (na een herstart), dan bleef het hier nacht.
 */
setInterval(() => {
  haal('api/zon').then((z) => {
    d.zon = z;
    teken();
  }, () => {});
}, 10 * 60_000);

/* ------------------------------------------------------------ de stappen */

/*
 * Zeven stappen (besluit 323, schets Wand-Inrichten-Kort), elk met de delen
 * die Aanpassen opent: de schermen van eerst. Prijzen en Wie woont hier zijn
 * één scherm: het voorstel, of met Aanpassen de vragen.
 */
/** @type {[string, string[]][]} */
const ZEVEN = [
  ['jehuis', ['woning', 'huis', 'apparaten', 'buiten']],
  ['meter', ['zekering', 'vermogen']],
  ['panelen', ['zon', 'ligging']],
  ['prijzen', ['prijzen']],
  ['verwarming', ['warmte', 'apparaat', 'meten']],
  ['bewoners', ['bewoners']],
  ['klaar', []],
];
/** Niet meer in de zeven stappen, maar met een link nog te openen (de standpagina biedt het aan). */
const LOS = ['dag', 'comfort', 'afwezig', 'opzon', 'functies', 'account', 'wand', 'ha', 'stem'];
const HOOFD = ZEVEN.map(([id]) => id);
const STAPPEN = ZEVEN.map(([id]) => [id, t(`inr.k.${id}`)]);
const ALLE = [...new Set(['welkom', ...ZEVEN.flatMap(([id, delen]) => [id, ...delen]), ...LOS])];
const hoofdVan = (id) => ZEVEN.find(([h, delen]) => h === id || delen.includes(id))?.[0] ?? null;
const delenVan = (h) => ZEVEN.find(([x]) => x === h)?.[1] ?? [];
/** "2 van 7 · Meter en zekering"; een deel achter Aanpassen zegt ook welk deel. */
function waarVan(id) {
  const h = hoofdVan(id);
  if (!h) return t(`inr.stap.${id}`);
  const i = HOOFD.indexOf(h);
  const deel = id !== h && delenVan(h).length > 1 ? ` · ${t(`inr.stap.${id}`)}` : '';
  return `${t('inr.k.van', { i: i + 1, n: HOOFD.length })} · ${STAPPEN[i][1]}${deel}`;
}

const binnen = () => (d.huis?.etages ?? []).filter((e) => e.id !== 'buiten').flatMap((e) => (e.ruimtes ?? []).filter((r) => !huismodel.isBuiten(e, r)));
const buitenRuimtes = () => (d.huis?.etages ?? []).flatMap((e) => (e.ruimtes ?? []).filter((r) => huismodel.isBuiten(e, r)));
const klimaatIn = (r) => (r.apparaten ?? []).filter((a) => a.soort === 'klimaat');
const sleutel = (a) => a.actuatorId ?? a.id;
const energieNu = () => d.energie?.instellingen ?? d.energie?.voorstel ?? null;

/**
 * Of een stap al ingevuld is, aan wat de dienst nu zegt. Dat kan uit Home
 * Assistant komen; nagelopen is het pas als de bewoner er op Volgende drukte.
 */
function gedaan(id) {
  if (id === 'woning') return d.ind?.indeling?.woning != null;
  if (id === 'huis') return d.huis?.indeling === 'eigen';
  if (id === 'apparaten') return d.huis != null && (d.huis.zonderRuimte ?? []).length === 0;
  if (id === 'warmte') return binnen().some((r) => klimaatIn(r).some((a) => a.klimaat?.rol && a.klimaat.rol !== 'kijken'));
  // Wat elk apparaat kan (besluit 197): geen open vraag meer.
  if (id === 'apparaat') return kanToestellen().length > 0 && !kanToestellen().some(({ a }) => kanVraagOpen(a));
  if (id === 'dag' || id === 'comfort' || id === 'afwezig') return (d.comfort?.kamers ?? []).some((k) => k.uitApp);
  // Op zon (besluit 167): iets mag al op zon. Klaarzetten: niets mist meer in Home Assistant.
  if (id === 'opzon') return Object.values(d.aans?.antwoorden?.opZon ?? {}).some(Boolean) || (d.aans?.configuratie?.apparaten ?? []).length > 0;
  if (id === 'ha') return (d.klaar?.punten ?? []).length > 0 && d.klaar.punten.every((p) => p.stand !== 'mist');
  if (id === 'buiten') return d.huis?.rond != null;
  if (id === 'meten') return binnen().filter((r) => r.zoneId).every((r) => (r.meetMet ?? []).length > 0);
  if (id === 'zon') return d.aans?.antwoorden?.panelen?.ligging != null || !!d.aans?.daken?.bewaard;
  // Hoe ze liggen (besluit 157): geen panelen, of met dakvlakken (besluit 254) geen vlak meer geschat.
  if (d.aans?.antwoorden?.panelen?.ligging === 'geen' && id === 'ligging') return true;
  if (id === 'ligging' && d.aans?.daken?.bewaard) return d.aans.daken.vlakken.some((v) => v.bron !== 'schatting');
  if (id === 'ligging') return ['bevestigd', 'configuratie'].includes(d.aans?.ligging?.stand);
  if (id === 'zekering') return d.aans?.antwoorden?.zekering != null;
  // De netmeter (testerronde, november 2026): gekozen, of de regeling heeft er al een.
  if (id === 'vermogen') return vermogens.netNu(d.aans, null) != null;
  // Een prijs per uur is ook een stroomprijs (issue 126).
  if (id === 'prijzen') return d.energie?.instellingen?.prijzen?.stroom != null || !!d.energie?.instellingen?.prijzen?.dynamisch;
  if (id === 'functies') return d.functies?.instellingen != null;
  if (id === 'wand' || id === 'account') return (d.bewoners?.schermen ?? []).length > 0;
  if (id === 'bewoners') return (d.bewoners?.bewoners ?? []).length > 0;
  return false;
}

/*
 * Nagelopen (besluit 158): de stappen waar de bewoner op Volgende drukte. Dat
 * hoort bij dit apparaat, zoals de rondleiding; wie op een ander apparaat
 * verder gaat, ziet wat al ingevuld is als omlijnd.
 */
const NAGELOPEN = 'sc-inrichten-bevestigd';
const nagelopen = (() => {
  try {
    return new Set(JSON.parse(localStorage.getItem(NAGELOPEN) ?? '[]'));
  } catch {
    return new Set();
  }
})();
function markeer(id) {
  nagelopen.add(id);
  try {
    localStorage.setItem(NAGELOPEN, JSON.stringify([...nagelopen]));
  } catch {
    // Zonder opslag telt het alleen op deze pagina.
  }
}

// Klaar in Je huis (stap 4): Je huis bewaart zelf, dus die stap is dan nagelopen.
{
  const u = new URL(location.href);
  if (u.searchParams.get('nagelopen') === 'jehuis') {
    for (const id of ['jehuis', ...delenVan('jehuis')]) markeer(id);
    u.searchParams.delete('nagelopen');
    history.replaceState(null, '', `${u.pathname}${u.search}${u.hash}`);
  }
}

function stapNu() {
  const h = decodeURIComponent(location.hash.slice(1));
  return ALLE.includes(h) ? h : 'welkom';
}
const naar = (id) => (location.hash = id);
/** Na een voorstel de volgende stap; na een deel het volgende deel, en na het laatste de volgende stap. Wat los is, gaat naar Klaar. */
function volgende(id) {
  const h = hoofdVan(id);
  if (!h) return id === 'welkom' ? HOOFD[0] : 'klaar';
  const delen = delenVan(h);
  const j = delen.indexOf(id);
  if (id !== h && j < delen.length - 1) return delen[j + 1];
  return HOOFD[Math.min(HOOFD.length - 1, HOOFD.indexOf(h) + 1)];
}
/** Terug: het vorige deel, dan het voorstel van de stap, dan de stap ervoor. */
function vorige(id) {
  const h = hoofdVan(id);
  if (!h) return id === 'welkom' ? 'welkom' : 'klaar';
  const delen = delenVan(h);
  if (id !== h) return delen.indexOf(id) > 0 ? delen[delen.indexOf(id) - 1] : h;
  return HOOFD.indexOf(h) > 0 ? HOOFD[HOOFD.indexOf(h) - 1] : 'welkom';
}
/** Nagelopen is een stap als hij zelf, of elk deel ervan, nagelopen is (wie eerst de 23 stappen deed). */
const stapNagelopen = (h) => nagelopen.has(h) || (delenVan(h).length > 0 && delenVan(h).every((x) => nagelopen.has(x)));
const stapGedaan = (h) => delenVan(h).some(gedaan);
/** Door naar wat volgt; wie het laatste deel van een stap afrondt, rondt de stap af. */
function verder(nu) {
  markeer(nu);
  const nx = volgende(nu);
  const h = hoofdVan(nu);
  if (h && hoofdVan(nx) !== h) markeer(h);
  naar(nx);
}

/* ------------------------------------------------------------ opslaan */

let melding = { tekst: '', fout: false };
function zeg(tekst, fout = false) {
  melding = { tekst, fout };
  $$('[data-melding]').forEach((el) => {
    el.textContent = tekst;
    el.classList.toggle('fout', fout);
  });
}

/** Een deur van de dienst: het antwoord, of null als het niet lukte (de reden staat dan in beeld). */
async function stuur(pad, body) {
  zeg(t('groep.bewaren'));
  let res;
  try {
    res = await deur(pad, body);
  } catch {
    zeg(t('groep.geenVerbinding'), true);
    return null;
  }
  if (res === null) return null;
  const uit = await res.json().catch(() => ({}));
  if (!res.ok) {
    zeg(res.status === 403 ? t('groep.beheerder') : (uit.fout ?? t('groep.nietBewaard')), true);
    return null;
  }
  zeg(t('groep.bewaard'));
  return uit;
}

/** De indeling om te veranderen: de eigen, of het voorstel uit Home Assistant. */
const concept = () => JSON.parse(JSON.stringify(d.ind?.indeling ?? d.ind?.voorstel ?? null));
async function bewaarIndeling(next, tekst = '') {
  const uit = await stuur('api/indeling', next);
  if (!uit) return false;
  d.ind = { ...d.ind, indeling: uit };
  // Opnieuw de indeling erbij: een nieuwe etage staat pas in de lijst als de dienst hem kent.
  const [huisNu, indNu] = await Promise.all([haal('api/huis').catch(() => d.huis), haal('api/indeling').catch(() => null)]);
  d.huis = huisNu;
  if (indNu) d.ind = indNu;
  if (tekst) zeg(tekst);
  teken();
  return true;
}

function idVan(naam, bezet) {
  const basis = naam.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'kamer';
  let id = basis;
  for (let i = 2; bezet.has(id); i++) id = `${basis}-${i}`;
  return id;
}

/* ------------------------------------------------------------ het huis */

/**
 * Het huis zoals het nu is, voor links (besluit 190): het eiland van Thuis, dat
 * per hoofdstuk iets krijgt. Eerst de vorm, bij de kamers de namen, dan de
 * apparaten, buiten, de temperatuur, de panelen; bij Klaar is het avond.
 */
function model(stap) {
  // Per stap van de zeven (besluit 323): het huis met wat er al nagelopen is; wat los is, telt als Klaar.
  const plek = (id) => (id === 'welkom' ? -1 : HOOFD.indexOf(hoofdVan(id) ?? 'klaar'));
  const i = plek(stap);
  // Bij het grote welkom (besluit 200) staat alles er al wat Home Assistant weet: de namen, de apparaten, buiten en de panelen.
  const groot = stap === 'welkom' && !lijst;
  const na = (id) => groot || i >= plek(id);
  // De tekening uit huismodel, net als op Thuis (5S), met de kelder in de grond.
  const a = antwoorden();
  const tek = huismodel.tekening(d.huis, {
    zon: d.zon,
    kamer: (r) => {
      const k = huismodel.kamerModel(r, null);
      if (!na('huis')) k.stil = true;
      if (!na('apparaten')) k.apparaten = [];
      if (!na('comfort') || groot) k.temp = null;
      // Bij Wat elk apparaat kan: de kamer van het apparaat dat open staat.
      if (stap === 'apparaat' && kanToestellen().find(({ a }) => sleutel(a) === kanOpen)?.r.id === r.id) k.gekozen = true;
      if (stap === 'comfort' && r.zoneId) k.stand = 'goed';
      // Je dag: bij voorverwarmen gloeien de kamers die meedoen.
      if (stap === 'dag' && r.zoneId && dagMoment(dagUur()).voor) k.stand = 'verwarmt';
      return k;
    },
  });
  const metZon = na('zon');
  const buiten = na('buiten');
  // Wat de bewoner net koos, ook voordat de dienst het terugzegt.
  const woning = concept()?.woning ?? tek.woning ?? 'vrijstaand';
  // Zoals op Thuis (besluit 166): het aantal dat je opgaf, per kant bij beide kanten; en op de garage, carport of het tuinhuis.
  const opDak = metZon ? huismodel.panelenOpDak(a.panelen, tek.piekW) : { panelen: 0, panelenLinks: 0 };
  const elders = metZon ? a.elders : {};
  return {
    beschrijving: t('inr.beschrijving'),
    tijd: stap === 'ha' || stap === 'klaar' ? 'nacht' : groot ? 'ochtend' : stap === 'dag' ? dagMoment(dagUur()).tijd : app.tijdVanDeDag(d.zon),
    wolken: 0.3,
    zon: { stand: d.zon?.dag?.fractie ?? 0.4, hoogte: d.zon?.dag?.hoogteDeel ?? 0.6, aandeel: metZon ? 0.6 : 0.2, opRechts: huismodel.zonOpRechts(d.aans?.ligging, a.panelen) ?? undefined, ...opDak },
    // Het huis zelf, zoals elke pagina het tekent (besluit 191); buiten pas vanaf de stap Buiten.
    ...huismodel.huisDelen(tek, elders),
    ...(buiten ? {} : { oprit: null, tuin: null, terras: null, balkon: null, voortuin: null, garage: null }),
    woning,
    // Een appartement: de verdiepingen eronder en erboven zoals gekozen, hooguit drie en twee in beeld.
    ...(woning === 'appartement' ? { gebouw: ((f) => ({ onder: Math.min(3, f.verdieping), boven: Math.min(2, f.erboven) }))(woningDeel.flatVan(concept() ?? tek.gebouw ?? {})) } : {}),
    buitenunit: na('apparaten') && tek.buitenunit ? { ...tek.buitenunit, aan: false } : null,
    net: true,
    stromen: [],
    // Hoe ze liggen (besluit 157): op de panelen, zoals de schets.
    // Met dakvlakken (besluit 254): per vlak zijn letter op het huis, zoals bij Daken en panelen.
    labels: stap === 'ligging' && d.aans?.daken?.vlakken?.length && a.panelen.ligging !== 'geen' ? dakvlakken.opHetHuis(d.aans.daken, a, tek).labels : stap === 'ligging' && d.aans?.ligging?.nu ? [{ bij: 'panelen', titel: d.aans.ligging.nu.richting, toon: 'zon', regels: [`${Math.round(d.aans.ligging.nu.hellingDeg / 5) * 5}° · ${(d.aans.ligging.nu.peakW / 1000).toLocaleString(taal.locale, { maximumFractionDigits: 1 })} kWp`], dx: -40, dy: -60 }] : [],
  };
}

/* ------------------------------------------------------------ de vragen */

const knop = (attrs, tekst, aan = false, klasse = '') => `<button type="button" class="chip${aan ? ' aan' : ''}${klasse ? ` ${klasse}` : ''}" ${attrs} aria-pressed="${aan}">${esc(tekst)}</button>`;
const rij = (kop, inhoud, extra = '') => `<div class="rij"><b>${esc(kop)}</b><div class="chips">${inhoud}</div>${extra}</div>`;
/** "a, b en c". */
const lijstje = (xs) => huismodel.opsomming(xs);
const schakel = (attr, tekst, aan, uit = false) => `<button type="button" class="schakelrij" role="switch" aria-checked="${aan}" ${attr} ${uit ? 'disabled' : ''}><span>${esc(tekst)}</span><i class="schakelaar-teken" aria-hidden="true"></i></button>`;

/*
 * De bouwstenen van Inrichten 3.0 (besluit 190, schets Wand-Inrichten-3): een
 * regel met een icoon, een naam met een zin eronder en rechts een waarde of
 * schakelaar; eronder mag nog iets, zoals een keuze.
 */
const S = (pad) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pad}</svg>`;
const IK = {
  huis: iconen.binnen('thuis'),
  oprit: iconen.binnen('oprit'),
  auto: iconen.binnen('auto'),
  laadpaal: iconen.binnen('laadpaal'),
  carport: iconen.binnen('carport'),
  garage: iconen.binnen('garage'),
  tuin: iconen.binnen('tuin'),
  tuinhuis: iconen.binnen('tuinhuis'),
  schuur: iconen.binnen('schuur'),
  terras: iconen.binnen('terras'),
  border: iconen.binnen('border'),
  jacuzzi: iconen.binnen('jacuzzi'),
  balkon: iconen.binnen('balkon'),
  thermo: iconen.binnen('klimaat'),
  droger: iconen.binnen('droger'),
  vaat: iconen.binnen('vaat'),
  boiler: iconen.binnen('boiler'),
  accu: iconen.binnen('accu'),
  lamp: iconen.binnen('licht'),
  screen: iconen.binnen('screen'),
  camera: iconen.binnen('camera'),
  lijst: iconen.binnen('lijst'),
  praat: iconen.binnen('praten'),
  zon: iconen.binnen('zon'),
  stekker: iconen.binnen('stekker'),
  meter: iconen.binnen('meter'),
  tablet: iconen.binnen('tablet'),
  koffer: iconen.binnen('koffer'),
  tel: iconen.binnen('telefoon'),
};
/** Een regel; `tag: 'button'` maakt hem aan te tikken. Zin en rechts zijn al tekst of HTML. */
function regel({ ik: icoon, titel, zin = '', rechts = '', toon = '', klasse = '', attrs = '', onder = '', tag = 'div' }) {
  return `<${tag} ${tag === 'button' ? 'type="button" ' : ''}class="regel ${klasse}" ${attrs}><span class="ik">${S(IK[icoon] ?? IK.huis)}</span><span class="tekst"><b>${esc(titel)}</b>${zin ? `<span>${esc(zin)}</span>` : ''}</span><span class="rechts ${toon}">${rechts}</span>${onder ? `<span class="onder">${onder}</span>` : ''}</${tag}>`;
}
/** De schakelaar rechts in een regel. */
const schakelaar = (attr, naam, aan, uit = false) => `<button type="button" class="schakelaar" role="switch" aria-checked="${aan}" aria-label="${esc(naam)}" ${attr} ${uit ? 'disabled' : ''}></button>`;
const tip = (tekst) => `<div class="tip">${esc(tekst)}</div>`;

/* Het startscherm (besluit 158): de getallen tikken open tot een lijst. */
let lijst = null; // 'etages', 'kamers', 'apparaten', 'klimaat' of null
function tellingen() {
  const etages = (d.huis?.etages ?? []).filter((e) => e.id !== 'buiten' && (e.ruimtes ?? []).some((r) => !huismodel.isBuiten(e, r))).length;
  // Apparaten en wat verwarmt of koelt apart (besluit 166): niets telt twee keer.
  const apparaten = [...(d.huis?.etages ?? []).flatMap((e) => e.ruimtes ?? []).flatMap((r) => r.apparaten ?? []), ...(d.huis?.zonderRuimte ?? [])].filter((a) => a.soort !== 'klimaat').length;
  const p = antwoorden().panelen;
  const panelen = p.ligging === 'beide' ? (p.voorkant ?? 0) + (p.achterkant ?? 0) : (p.aantal ?? 0);
  return { etages, kamers: binnen().length, buiten: buitenRuimtes().length, apparaten, klimaat: binnen().flatMap(klimaatIn).length, panelen, cameras: (d.functies?.gevonden?.cameras ?? []).length };
}
/* Het startscherm (besluit 190): zes getallen, de eerste vier tikken open tot een lijst. */
/** Naar het voorbeeldhuis (besluit 237): een huis met alles erin, om eerst mee te spelen. */
function voorbeeldRegel() {
  return `<a class="voorbeeld-regel" href="voorbeeld/thuis.html?van=inrichten">
      <span class="huisje" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></svg></span>
      <span><b>${esc(t('voorbeeld.ingang'))}</b><span>${esc(t('voorbeeld.ingangZin'))}</span></span>
      <i aria-hidden="true">›</i>
    </a>`;
}

function welkom() {
  if (lijst) return welkomLijst();
  const n = tellingen();
  const vak = (soort, getal, tekst) => (soort
    ? `<button type="button" class="teller" data-lijst="${soort}"><b>${getal}</b><span>${esc(tekst)}</span></button>`
    : `<div class="teller"><b>${getal}</b><span>${esc(tekst)}</span></div>`);
  const tellers = [
    vak('etages', n.etages, t(n.buiten ? 'inr.tel.etagesBuiten' : 'inr.tel.etages', { n: n.etages })),
    vak('kamers', n.kamers, n.buiten ? t('inr.tel.kamersBuiten', { n: n.kamers, buiten: n.buiten }) : t('inr.tel.kamers', { n: n.kamers })),
    vak('apparaten', n.apparaten, t('inr.tel.apparaten', { n: n.apparaten })),
    vak('klimaat', n.klimaat, t('inr.tel.klimaat')),
    ...(n.panelen ? [vak(null, n.panelen, t('inr.tel.panelen', { n: n.panelen }))] : []),
    ...(n.cameras ? [vak(null, n.cameras, t('inr.tel.cameras', { n: n.cameras }))] : []),
  ];
  return {
    waar: t('w.welkom'),
    kop: t('inr.welkomKop'),
    groot: true,
    uitleg: t('inr.welkomZin'),
    inhoud: d.huis
      ? `<div class="tellen">${tellers.join('')}</div>${tip(t('inr.welkomNoot'))}`
      : `<p class="zacht">${esc(t('inr.huisLezen'))}</p>`,
    voet: ['', `<a class="knop knop-licht" href="#jehuis">${esc(t('inr.begin'))}</a>`],
  };
}
/*
 * Groot welkom (besluit 200, schets Wand-Inrichten-Welkom): het eerste wat een
 * nieuwe bewoner ziet, over het hele scherm en nog zonder de stappen; die
 * komen na Begin. Het huis bouwt zich op uit wat Home Assistant al weet, etage
 * na etage, dan buiten en de panelen. Wat er gevonden is, hangt op de wand als
 * labels aan het huis zelf en staat op de telefoon als een rij getallen; een
 * tik geeft de lijst, zoals eerst bij de getallen.
 */
let opbouw = null; // hoeveel etages er al staan tijdens het opbouwen
let opgebouwd = false;
const stilGewenst = () => document.documentElement.classList.contains('sc-stil') || (matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
const PIJL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const WK_IK = {
  etages: iconen.binnen('etages'),
  kamers: iconen.binnen('kamers'),
  apparaten: iconen.binnen('apparaat'),
  klimaat: IK.thermo,
  panelen: IK.zon,
  cameras: IK.camera,
};
function welkomSkelet(tel) {
  const belofte = (ik, kleur, b, zin) => `<li><span class="wk-ik" style="color: ${kleur}">${S(IK[ik])}</span><div><b>${esc(t(b))}</b><span>${esc(t(zin))}</span></div></li>`;
  const beloftes = `<ul class="wk-beloof">${belofte('thermo', 'var(--gloed)', 'inr.wk.b1', 'inr.wk.b1z')}${belofte('zon', 'var(--zon)', 'w.opJeEigenZon', 'inr.wk.b2z')}${belofte('praat', 'var(--violet)', 'inr.wk.b3', 'inr.wk.b3z')}</ul>`;
  const woorden = `<span class="wk-hallo" data-wk-hallo></span><h1 class="wk-kop">${esc(t('w.welkom'))} <em>${esc(t('w.thuis2'))}</em></h1><p class="wk-zin">${esc(t('inr.wk.zin'))} <b>${esc(t('inr.wk.klopt'))}</b></p>${beloftes}`;
  const begin = `<a class="knop knop-licht wk-begin" href="#jehuis">${esc(t('inr.begin'))}${PIJL}</a>`;
  const terug = `<a class="wk-terug" href="toegang.html">${esc(t('inr.wk.backup'))}</a>`;
  // Het logo voluit: het teken, de naam en wat ARC betekent.
  const merk = `<span class="wk-merk"><img src="kit/merk.svg" alt=""><span><span class="wk-woord">SunArc</span><span class="wk-arc">${t('over.arc')}</span></span></span>`;
  // Ook bij het welkom een kruisje: de balk met het kruisje staat hier niet.
  const sluit = `<a class="wk-sluit" href="thuis.html" aria-label="${esc(t('inr.sluiten'))}"><span aria-hidden="true">×</span></a>`;
  if (tel) {
    return `${sluit}${merk}<div class="wk-podium" data-wk-podium aria-hidden="true"></div><div class="wk-getallen" data-wk-getallen></div>
      <div class="wk-tekst">${woorden}</div>
      <div class="wk-doen">${begin}${voorbeeldRegel()}<div class="wk-onder"><span>${esc(t('inr.telStappen', { n: STAPPEN.length }))}</span>${terug}</div></div>`;
  }
  return `${sluit}<div class="wk-podium" data-wk-podium aria-hidden="true"></div><svg class="wk-lijn" data-wk-lijn aria-hidden="true"></svg><div class="wk-labels" data-wk-labels></div>
    <div class="wk-links">${merk}<div class="wk-midden">${woorden}<div class="wk-doen">${begin}${terug}</div>${voorbeeldRegel()}</div><span class="wk-voet">${esc(t('inr.wk.voet', { n: STAPPEN.length }))}</span></div>
    <div class="glas wk-zoekt" data-wk-zoekt aria-live="polite"><i aria-hidden="true"></i><span></span></div>`;
}
/** Wat er gevonden is, met hoeveel er tijdens het opbouwen al staat. */
function welkomGetallen(n, m, zoveel, klaar) {
  const staan = m.etages.slice(0, zoveel);
  const etages = klaar ? n.etages : Math.min(n.etages, staan.length);
  const kamers = klaar ? n.kamers : staan.reduce((s, e) => s + e.kamers.length, 0);
  return [
    { soort: 'etages', getal: etages, tekst: t(klaar && n.buiten ? 'inr.tel.etagesBuiten' : 'inr.tel.etages', { n: etages }) },
    { soort: 'kamers', getal: kamers, tekst: klaar && n.buiten ? t('inr.tel.kamersBuiten', { n: kamers, buiten: n.buiten }) : t('inr.tel.kamers', { n: kamers }) },
    klaar && { soort: 'apparaten', getal: n.apparaten, tekst: t('inr.tel.apparaten', { n: n.apparaten }) },
    klaar && n.klimaat > 0 && { soort: 'klimaat', getal: n.klimaat, tekst: t('inr.tel.klimaat') },
    klaar && n.panelen > 0 && { soort: 'panelen', getal: n.panelen, tekst: t('inr.tel.panelen', { n: n.panelen }), vast: true },
    klaar && n.cameras > 0 && { soort: 'cameras', getal: n.cameras, tekst: t('inr.tel.cameras', { n: n.cameras }), vast: true },
  ].filter((x) => x && (x.getal > 0 || x.soort === 'etages'));
}
function tekenWelkom(m) {
  const tel = app.telStand();
  const box = document.querySelector(`${tel ? '#tel' : '#wand'} [data-welkom]`);
  if (!box) return;
  if (!box.dataset.klaar) {
    box.innerHTML = welkomSkelet(tel);
    box.dataset.klaar = '1';
  }
  const ik = (d.bewoners?.bewoners ?? []).find((x) => x.ik)?.naam;
  box.querySelector('[data-wk-hallo]').textContent = ik ? t('inr.wk.hallo', { naam: ik }) : t('inr.wk.halloLeeg');
  const alle = m.etages ?? [];
  // Eén keer per bezoek bouwt het huis zich op, etage na etage; met minder beweging staat het er meteen.
  if (d.huis && alle.length && !opgebouwd && opbouw == null) {
    opgebouwd = true;
    if (!stilGewenst()) {
      opbouw = 1;
      const klok = setInterval(() => {
        opbouw += 1;
        if (opbouw > alle.length) {
          opbouw = null;
          clearInterval(klok);
        }
        teken();
      }, 1100);
    }
  }
  const zoveel = opbouw ?? alle.length + 1;
  const klaar = !!d.huis && zoveel > alle.length;
  const mm = klaar ? m : { ...m, etages: alle.slice(0, zoveel), zon: { ...m.zon, panelen: 0, panelenLinks: 0 }, oprit: null, tuin: null, terras: null, balkon: null, voortuin: null, garage: null, buitenunit: null };
  const podium = box.querySelector('[data-wk-podium]');
  const getallen = welkomGetallen(tellingen(), m, zoveel, klaar);
  const vak = (x) => `<span class="wk-ik">${S(WK_IK[x.soort])}</span><b>${x.getal}</b><span>${esc(x.tekst)}</span>`;
  if (tel) {
    huis.teken(podium, { ...mm, etages: mm.etages.map((e) => ({ ...e, kamers: e.kamers.map((k) => ({ ...k, stil: true })) })) }, { breedte: podium.clientWidth || 410, hoogte: podium.clientHeight || 300, marge: 0.04 });
    box.querySelector('[data-wk-getallen]').innerHTML = d.huis
      ? getallen.map((x) => (x.vast ? `<span class="glas wk-getal">${vak(x)}</span>` : `<button type="button" class="glas wk-getal" data-lijst="${x.soort}">${vak(x)}</button>`)).join('')
      : `<span class="wk-lezen">${esc(t('inr.huisLezen'))}</span>`;
    return;
  }
  huis.teken(podium, mm, { breedte: podium.clientWidth || 900, hoogte: podium.clientHeight || 760, marge: 0.1, meubels: true, tik: true });
  const zoekt = box.querySelector('[data-wk-zoekt]');
  zoekt.classList.toggle('klaar', klaar);
  zoekt.querySelector('span').textContent = t(klaar ? 'inr.wk.gevonden' : 'inr.huisLezen');
  // De labels aan het huis: elk met een puntje op zijn plek in de tekening.
  const br = box.getBoundingClientRect();
  const sch = br.width / (box.offsetWidth || br.width) || 1;
  const plek = (k) => {
    const el = k && podium.querySelector(`.sc-tik[data-kamer="${CSS.escape(String(k.id ?? k.naam))}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const v = { l: (r.left - br.left) / sch, t: (r.top - br.top) / sch, r: (r.right - br.left) / sch, b: (r.bottom - br.top) / sch };
    return { ...v, x: (v.l + v.r) / 2, y: (v.t + v.b) / 2 };
  };
  const staan = mm.etages;
  const onder = plek(staan[0]?.kamers[0]);
  const midden = plek((staan[1] ?? staan[0])?.kamers.at(-1));
  const boven = plek(staan.at(-1)?.kamers.at(-1));
  const klimaatKamer = binnen().find((r) => klimaatIn(r).length);
  const warm = plek(staan.flatMap((e) => e.kamers).find((k) => k.id === klimaatKamer?.id)) ?? onder;
  // Het hele huis, voor waar de labels komen: rechts ervan onder elkaar, en twee eronder.
  const alleVakken = staan.flatMap((e) => e.kamers).map(plek).filter(Boolean);
  const hb = alleVakken.length ? { l: Math.min(...alleVakken.map((v) => v.l)), t: Math.min(...alleVakken.map((v) => v.t)), r: Math.max(...alleVakken.map((v) => v.r)), b: Math.max(...alleVakken.map((v) => v.b)) } : null;
  podium.querySelectorAll('.sc-tik').forEach((x) => x.remove());
  const waar = {
    panelen: boven && { punt: [boven.r - 30, boven.t + 30], kant: 'rechts' },
    apparaten: boven && { punt: [boven.x, boven.y], kant: 'rechts' },
    kamers: midden && { punt: [midden.x, midden.y], kant: 'rechts' },
    klimaat: warm && { punt: [warm.x, warm.y + 10], kant: 'rechts' },
    etages: onder && { punt: [onder.l + 14, onder.y], kant: 'onder' },
    cameras: onder && { punt: [onder.l + 8, onder.b - 10], kant: 'onder' },
  };
  const labels = getallen.filter((x) => waar[x.soort]);
  const laag = box.querySelector('[data-wk-labels]');
  laag.innerHTML = labels.map((x, i) => {
    const attr = `class="glas wk-label" style="animation-delay: ${(i * 0.12).toFixed(2)}s"`;
    return x.vast ? `<span ${attr}>${vak(x)}</span>` : `<button type="button" ${attr} data-lijst="${x.soort}">${vak(x)}</button>`;
  }).join('');
  // Binnen het scherm, en niet over de woorden links.
  const W = box.offsetWidth, H = box.offsetHeight;
  const links = (box.querySelector('.wk-links')?.offsetLeft ?? 0) + (box.querySelector('.wk-links')?.offsetWidth ?? 0) + 16;
  const els = [...laag.children];
  // Rechts van boven naar onder zoals het huis: de panelen bij het dak, wat verwarmt onderaan.
  const VOLG = ['panelen', 'apparaten', 'kamers', 'klimaat'];
  const rechts = els.filter((el, i) => waar[labels[i].soort].kant === 'rechts').sort((a, b) => VOLG.indexOf(labels[els.indexOf(a)].soort) - VOLG.indexOf(labels[els.indexOf(b)].soort));
  let onderX = Math.max(links, hb?.l ?? links);
  els.forEach((el, i) => {
    const w = waar[labels[i].soort];
    const half = el.offsetWidth / 2, hoog = el.offsetHeight / 2;
    if (!hb) return;
    if (w.kant === 'rechts') {
      const j = rechts.indexOf(el);
      const van = hb.t - 30, tot = hb.b + 10;
      w.x = Math.min(W - half - 16, hb.r + 30 + half);
      w.y = rechts.length > 1 ? van + (j * (tot - van)) / (rechts.length - 1) : (van + tot) / 2;
    } else {
      w.x = onderX + half;
      w.y = Math.min(H - 110, hb.b + 130);
      onderX += el.offsetWidth + 16;
    }
    w.x = Math.max(links + half, Math.min(W - half - 16, w.x));
    w.y = Math.max(hoog + 16, Math.min(H - hoog - 80, w.y));
    el.style.left = `${Math.round(w.x)}px`;
    el.style.top = `${Math.round(w.y)}px`;
  });
  const lijn = box.querySelector('[data-wk-lijn]');
  lijn.setAttribute('viewBox', `0 0 ${W} ${H}`);
  lijn.innerHTML = labels.map((x) => {
    const w = waar[x.soort];
    return `<line x1="${Math.round(w.x)}" y1="${Math.round(w.y)}" x2="${Math.round(w.punt[0])}" y2="${Math.round(w.punt[1])}" stroke="rgba(255,255,255,0.35)" stroke-width="1.2" stroke-dasharray="3 4"/><circle cx="${Math.round(w.punt[0])}" cy="${Math.round(w.punt[1])}" r="4.5" fill="#EEF3F7"/><circle cx="${Math.round(w.punt[0])}" cy="${Math.round(w.punt[1])}" r="10" fill="none" stroke="rgba(255,255,255,0.25)"/>`;
  }).join('');
}

/**
 * Een apparaat dat je weghaalt, staat daarna bij Indeling onder Verborgen. Wat
 * verwarmt of koelt, staat in een eigen lijst (besluit 166): dat hoort bij de
 * regeling, en heeft geen ×.
 */
const wegChip = (a) => `<button type="button" class="chip weg" data-verberg="${esc(a.id)}" aria-label="${esc(t('w.weghalen2', { naam: a.naam }))}">${esc(a.naam)}<span aria-hidden="true">×</span></button>`;
const geenKlimaat = (lijst) => (lijst ?? []).filter((a) => a.soort !== 'klimaat');
function welkomLijst() {
  const n = tellingen();
  const perEtage = (d.huis?.etages ?? []).filter((e) => (e.ruimtes ?? []).length);
  let kop;
  let uitleg;
  let rijen;
  if (lijst === 'etages' || lijst === 'kamers') {
    kop = lijst === 'etages' ? t('instellingen.etages', { n: n.etages }) : t('instellingen.kamers', { n: n.kamers });
    uitleg = t('inr.lijst.kamers');
    rijen = perEtage.map((e) => rij(e.naam, (e.ruimtes ?? []).map((r) => `<span class="chip stil">${esc(r.naam)}</span>`).join('')));
  } else if (lijst === 'apparaten') {
    kop = t('w.apparaten', { n: n.apparaten });
    uitleg = t('inr.lijst.apparaten');
    rijen = perEtage.flatMap((e) => (e.ruimtes ?? []).filter((r) => geenKlimaat(r.apparaten).length).map((r) => rij(r.naam, geenKlimaat(r.apparaten).map(wegChip).join(''))));
    if (geenKlimaat(d.huis?.zonderRuimte).length) rijen.push(rij(t('inr.zonderKamer'), geenKlimaat(d.huis.zonderRuimte).map(wegChip).join('')));
  } else {
    kop = t('inr.lijst.klimaatKop', { n: n.klimaat });
    uitleg = t('inr.lijst.klimaat');
    rijen = binnen().filter((r) => klimaatIn(r).length).map((r) => rij(r.naam, klimaatIn(r).map((a) => `<span class="chip stil">${esc(a.naam)}</span>`).join('')));
  }
  return {
    waar: t('inr.gevonden'),
    kop,
    uitleg,
    inhoud: `<div class="rijen">${rijen.join('') || `<p class="zacht">${esc(t('inr.nietsGevonden'))}</p>`}</div>`,
    voet: [`<button type="button" class="zachtknop" data-lijst="">${esc(t('w.terug'))}</button>`, `<a class="knop knop-licht" href="#woning">${esc(t('inr.begin'))}</a>`],
  };
}

