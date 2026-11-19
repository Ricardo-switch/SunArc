/*
 * Instellingen (besluit 130; sinds besluit 321 in vier tegels, schets
 * Wand-Instellingen-Vier #tegels). Achter het tandwiel: de stand als één regel,
 * en vier groepen met hun onderdelen als knoppen, elk met wat er nu staat.
 * Bedienen doe je in het huis; hier stel je in.
 */
'use strict';

const { $$, nl, esc, haal } = app;

/** Alles wat de pagina leest, per deur; null zolang die niets gaf. */
const d = { energie: null, aansluiting: null, huis: null, functies: null, comfort: null, site: null, sessie: null, export: null, health: null, zon: null, bewoners: null, divergence: null, sluip: null, klaar: null, tekening: null, helpen: null };

async function laadAlles() {
  const deuren = { energie: 'api/energie', aansluiting: 'api/aansluiting', huis: 'api/huis', functies: 'api/functies', comfort: 'api/comfort', site: 'api/site', sessie: 'api/sessie', export: 'api/export/info', health: 'api/health', zon: 'api/zon', bewoners: 'api/bewoners', divergence: 'api/divergence', sluip: 'api/sluipverbruik', klaar: 'api/klaarzetten', tekening: 'api/huistekening', helpen: 'api/helpen' };
  const r = await Promise.allSettled(Object.values(deuren).map((p) => haal(p)));
  Object.keys(deuren).forEach((k, i) => {
    if (r[i].status === 'fulfilled') d[k] = r[i].value;
  });
  teken();
}

/* ------------------------------------------------- de stand, één regel */

/*
 * Instellingen in vier tegels (schets Wand-Instellingen-Vier #tegels, goedgekeurd
 * 17 november 2026). Bovenaan de stand als één regel: de zonnewaaier van Hoe ver
 * je huis is en wat er nog mist (het eerste, met een knop). De hele regel
 * opent Wat je huis kan (18 november 2026: eerst stond er ook een tweede knop
 * naar dezelfde pagina).
 */
function standregel() {
  // Dezelfde som als Wat je huis kan (19 november 2026): stand.eerstDit en stand.erbij.
  const mis = isGast() ? [] : stand.eerstDit(d);
  const v = window.waaier ? stand.voortgang(d) : null;
  const titel = mis.length ? t('inst4.mist', { n: mis.length }) : t('instellingen.allesGoed');
  const zin = mis.length ? mis[0].wat : v ? t('inst4.kanZin', { werkt: v.tel('werkt'), bij: stand.erbij(d).length }) : '';
  const waaierDeel = v?.onderwerpen.length ? `<svg viewBox="0 0 190 110" aria-hidden="true" data-mini></svg>` : '';
  const doe = mis.length ? `<a class="doe" href="${mis[0].href}">${esc(mis[0].knop)}</a>` : '';
  return `<a class="hoever" href="huis-kan.html">${waaierDeel}<span class="tekst"><b>${mis.length ? '' : '<i class="punt" aria-hidden="true"></i>'}${esc(titel)}</b><span class="zin">${esc(zin)}</span></span><span class="pijl" aria-hidden="true">›</span></a>${doe}`;
}

/* --------------------------------------------------------- de tegels */

const ICOON = {
  jehuis: iconen.svg('thuis'),
  klimaat: iconen.svg('comfort'),
  energie: iconen.svg('zon'),
  app: iconen.svg('inloggen'),
};

const euro = (v) => (v == null ? null : `${taal.valuta()} ${nl(v, 2)}`);

/** Wat er nu staat, per knop: [label, wat er staat, adres]. Null als het nog niet geladen is. */
function knoppenVan(id) {
  const kamers = (d.huis?.etages ?? []).flatMap((e) => e.ruimtes ?? []);
  const laden = '…';
  switch (id) {
    case 'jehuis': {
      const etages = (d.huis?.etages ?? []).filter((e) => e.id !== 'buiten' && e.ruimtes?.length).length;
      const apps = kamers.reduce((n, r) => n + r.apparaten.length, 0);
      const zonder = d.huis?.zonderRuimte?.length ?? 0;
      const bron = d.tekening?.bron ? t(`ht.bron.${d.tekening.bron}`) : null;
      return [
        [t('inst4.vorm'), bron ?? (d.tekening ? t('instellingen.nogKiezen') : laden), 'jehuis.html#bg/vorm'],
        [t('instellingen.etagesKamers'), d.huis ? `${t('instellingen.etages', { n: etages })}, ${t('instellingen.kamers', { n: kamers.length })}` : laden, 'jehuis.html#bg'],
        [t('inst4.waar'), d.huis ? (zonder ? t('instellingen.vanTotaal', { a: apps, b: apps + zonder }) : t('inst4.allePlek', { n: apps })) : laden, 'jehuis.html#bg/apparaten'],
        [t('inst4.daken'), panelenZin() ?? (d.aansluiting ? t('instellingen.nogKiezen') : laden), 'energie.html#panelen'],
      ];
    }
    case 'klimaat': {
      const c = d.comfort;
      const dd = c?.dagdelen;
      const eerst = c?.voorrang?.verwarmen?.[0];
      const naam = (zoneId) => c?.kamers?.find((k) => k.id === zoneId)?.naam ?? zoneId;
      const soort = d.aansluiting?.antwoorden?.verwarming?.soort;
      const aircos = d.helpen?.aircos?.length ?? 0;
      return [
        [t('inst4.hoeWarm'), c ? t('inst4.kamersMee', { n: c.kamers.length }) : laden, 'comfort.html'],
        [t('instellingen.dagdelen'), dd ? t('instellingen.van', { van: `${dd.dag}:00`, tot: `${dd.nacht}:00` }) : laden, 'comfort.html#dagdelen'],
        [t('comfort.voorrang'), eerst ? t('inst4.eerst', { naam: naam(eerst).toLowerCase() }) : c ? t('inst4.geenVoorrang') : laden, 'comfort.html#voorrang'],
        [t('comfort.afwezig'), c ? t('inst4.vanzelf') : laden, 'comfort.html#afwezig'],
        [t('klimaat.soort'), soort ? t(`energie.soort.${soort}`) : d.aansluiting ? t('instellingen.nogKiezen') : laden, 'energie.html#verwarming'],
        ...(aircos ? [[t('regeling.helpen'), t('inst4.aircos', { n: aircos }), 'comfort.html#helpen']] : []),
      ];
    }
    case 'energie': {
      const a = d.aansluiting;
      const zAntwoord = a?.antwoorden?.zekering;
      // "Weet ik niet" is geen zekering: dan die uit de configuratie, of nog kiezen.
      const z = (zAntwoord && zAntwoord !== 'weetniet' ? zAntwoord : null) ?? a?.configuratie?.zekering ?? null;
      const omv = a?.antwoorden?.omvormers?.length ?? 0;
      const p = d.energie?.instellingen?.prijzen;
      return [
        [t('inst4.zekering'), z ? `${z.fasen} × ${z.ampere} A` : a ? t('instellingen.nogKiezen') : laden, 'energie.html#aansluiting'],
        [t('inst4.meters'), a ? (omv ? t('inst4.omvormers', { n: omv }) : t('inst4.slimmeMeter')) : laden, 'energie.html#meters'],
        [t('inst4.prijzen'), euro(p?.stroom) ?? (d.energie ? t('instellingen.nogInvullen') : laden), 'energie.html#prijzen'],
      ];
    }
    case 'app': {
      const f = d.functies?.instellingen ?? d.functies?.voorstel;
      const weer = (d.functies?.gevonden?.weerbronnen ?? []).find((b) => b.id === f?.weer?.bron)?.naam ?? (f?.weer?.bron ? f.weer.bron : t('instellingen.geen'));
      const namen = d.bewoners ? d.bewoners.bewoners.map((b) => b.naam).join(', ') || t('instellingen.nogNiemand') : laden;
      return [
        [t('inst4.bewoners'), namen, 'toegang.html#bewoners'],
        [t('groep.assistent'), f ? t(f.praten?.taalmodel ? 'functies.deel.eigen' : 'functies.deel.vast') : laden, 'functies.html?groep=assistent'],
        [t('inst4.licht'), f ? t('inst4.weer', { weer: weer.replace(' (via internet)', '') }) : laden, 'functies.html'],
        [t('inst4.meldingen'), f ? t('inst4.meldingenZin') : laden, 'functies.html#meldingen'],
        // Inrichten staat hier niet meer (besluit 323): de standpagina biedt het aan, en Klaarzetten staat bij Kan er nog bij (besluit 322).
        [t('inst4.versie'), d.health?.versie?.nummer ?? laden, 'toegang.html#versie'],
      ];
    }
    default:
      return [];
  }
}

/** De panelen kort: hoeveel, of de vlakken uit de configuratie, of wat Inrichten bevestigde. */
function panelenZin() {
  const a = d.aansluiting;
  const aantal = a?.antwoorden?.panelen?.aantal;
  // Een ligging die je bij Inrichten bevestigde, telt ook (30 oktober 2026: "Klopt" gaf hier toch "nog kiezen").
  const lig = ['bevestigd', 'configuratie'].includes(a?.ligging?.stand) ? a.ligging.nu : null;
  return aantal ? (a.antwoorden.panelen.ligging === 'beide' ? t('instellingen.tweeKanten', { n: aantal }) : t('inst4.panelen', { n: aantal })) : (a?.configuratie?.panelen ?? []).length ? t('instellingen.vlakken', { n: a.configuratie.panelen.length }) : lig ? (lig.vermogenKort ?? lig.vermogen ?? lig.richting ?? null) : null;
}

/*
 * Vier tegels (schets #tegels): Je huis, Klimaat, Energie, App en bewoners. Elke
 * tegel een kop die naar de groep gaat, en de onderdelen als knoppen met wat er
 * nu staat. Wat mist, telt per tegel (de groepen van Nog te doen vallen erin).
 */
const TEGELS = [
  ['jehuis', 'jehuis.html', ['huis']],
  ['klimaat', 'comfort.html', ['comfort']],
  ['energie', 'energie.html', ['energie']],
  ['app', 'toegang.html', ['functies', 'assistent', 'toegang', 'inrichten', 'klaarzetten']],
];

function groepen() {
  const mis = isGast() ? [] : stand.eerstDit(d);
  // Een gast (besluit 151) ziet alleen App en bewoners.
  return TEGELS.filter(([id]) => !isGast() || id === 'app').map(([id, href, oud]) => {
    const hier = mis.filter((x) => oud.includes(x.groep));
    const n = hier.length;
    // Wat mist, staat bovenaan de tegel met een tik ernaartoe (Ricardo, 19 november 2026: "1 mist", maar wat?).
    const mistKnoppen = hier.map((x) => `<a class="deelknop mist" href="${x.href}"><span><b><i class="stip" aria-hidden="true"></i>${esc(x.wat)}</b><span>${esc(x.zin)}</span></span><span class="pijl" aria-hidden="true">›</span></a>`).join('');
    const knoppen = mistKnoppen + knoppenVan(id)
      .map(([naam, waarde, adres]) => `<a class="deelknop" href="${adres}"><span><b>${esc(naam)}</b><span>${esc(waarde ?? '')}</span></span><span class="pijl" aria-hidden="true">›</span></a>`)
      .join('');
    return `<section class="glas tegel${n ? ' aandacht' : ''}" data-tegel="${id}">
      <a class="titel" href="${href}"><span class="icoon">${ICOON[id]}</span><span class="kop"><h3>${esc(t(`inst4.${id}`))}</h3><span class="zin">${esc(t(`inst4.${id}Zin`))}</span></span>${n ? `<span class="stand mis">${esc(t('instellingen.mist', { n }))}</span>` : ''}<span class="pijl" aria-hidden="true">›</span></a>
      <div class="deelknoppen">${knoppen}</div>
    </section>`;
  }).join('');
}

/* -------------------------------------------------------------- zoeken */

const ZOEKVELD = `<label class="zoek"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" data-zoek placeholder="${esc(t('instellingen.zoek'))}" aria-label="${esc(t('instellingen.zoekLabel'))}" autocomplete="off"></label><div class="gevonden" data-gevonden hidden></div>`;

function toonGevonden(veld) {
  const vak = veld.closest('[data-zoekvak]').querySelector('[data-gevonden]');
  const lijst = stand.zoek(veld.value, d);
  vak.hidden = veld.value.trim().length < 2;
  vak.innerHTML = lijst.length ? lijst.map((z) => `<a href="${z.href}">${esc(z.titel)}<span>${esc(z.waar)}</span></a>`).join('') : `<p>${esc(t('instellingen.nietsGevonden'))}</p>`;
}

/* ------------------------------------------------------------ tekenen */

/** Een gast (besluit 151): kijkt mee, en verandert geen instellingen. */
const isGast = () => d.bewoners?.ik?.soort === 'gast';
const GAST = `<h2 class="kop-3">${esc(t('instellingen.gast'))}</h2><p class="mini" style="margin: 2px 0 0">${esc(t('instellingen.gastZin'))}</p>`;

function tekenNu() {
  app.schaal();
  app.luchtVan(d.zon, 0);
  // Zoeken leidt een gast alleen naar pagina's die hij niet kan gebruiken.
  $$('[data-zoekvak]').forEach((el) => (el.hidden = isGast()));
  $$('[data-kan]').forEach((el) => (el.innerHTML = isGast() ? `<div class="gast">${GAST}</div>` : standregel()));
  const v = $$('[data-mini]').length ? stand.voortgang(d) : null;
  $$('[data-mini]').forEach((svg) => waaier.teken(svg, { groepen: v.groepen, cx: 95, cy: 104, r0: 32, R: 92, getal: `${v.totaal}%`, groei: false, knoppen: false }));
  $$('[data-groepen]').forEach((el) => (el.innerHTML = groepen()));
  // Jij (besluit 181): je profiel; een gast heeft er geen, een scherm alleen hoe de app eruitziet.
  const ik = d.bewoners?.ik ?? null;
  const naam = ik?.soort === 'bewoner' && ik.naam ? ik.naam : t(ik?.soort === 'scherm' ? 'jij.ditScherm' : 'jij.kop');
  const letter = ik?.soort === 'bewoner' && ik.naam ? `<span class="jijrondje" aria-hidden="true">${esc(ik.naam.charAt(0).toUpperCase())}</span>` : '';
  const onder = t(ik?.soort === 'bewoner' ? 'instellingen.jijBewoner' : 'instellingen.jijScherm');
  $$('[data-jijregel]').forEach((el) => {
    el.hidden = isGast();
    el.innerHTML = `${letter}<span><b>${esc(naam)}</b><span>${esc(onder)}</span></span><span class="pijl" aria-hidden="true">›</span>`;
  });
  $$('[data-jijpil]').forEach((el) => {
    el.hidden = isGast() || ik?.soort !== 'bewoner';
    el.innerHTML = `${letter}${esc(naam)}`;
  });
  // Het zoekveld één keer neerzetten: anders verdwijnt wat je typt.
  $$('[data-zoekvak]').forEach((el) => {
    if (!el.querySelector('[data-zoek]')) el.innerHTML = ZOEKVELD;
  });
}

/* -------------------------------------------------------------- starten */

/** Gebundeld: hooguit één keer per beeld (basis.js). */
const teken = app.gebundeld(tekenNu);
addEventListener('standwissel', teken);

app.start('instellingen');
document.addEventListener('input', (e) => {
  if (e.target.matches('[data-zoek]')) toonGevonden(e.target);
});
document.addEventListener('keydown', (e) => {
  if (!e.target.matches?.('[data-zoek]')) return;
  if (e.key === 'Enter') {
    const eerste = e.target.closest('[data-zoekvak]').querySelector('[data-gevonden] a');
    if (eerste) location.href = eerste.getAttribute('href');
  } else if (e.key === 'Escape') {
    e.target.value = '';
    toonGevonden(e.target);
  }
});
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('[data-zoekvak]')) $$('[data-gevonden]').forEach((el) => (el.hidden = true));
});
void laadAlles();
setInterval(() => void laadAlles(), 5 * 60_000);
