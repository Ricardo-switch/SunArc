/*
 * Apparaten, in ontwerp 2 (besluit 104; schets Wand-Apparaten-Nu, besluit 140).
 * Het nu, naast Vandaag dat de tijd is: per apparaat een kaart met wat het
 * doet, wat het nu vraagt, wat het vandaag gebruikte en welk deel op eigen
 * zon, of hoe lang het aan stond als er geen meter is. Wat iets doet, staat
 * bovenaan. Een uitstelbaar apparaat kiest hier "klaar voor" (besluit 101), een
 * jacuzzi "klaar om" (besluit 186). De zinnen en de keuzes komen kant-en-klaar van de dienst
 * (besluit 94); de pagina zet ze neer en rekent alleen de resterende tijd uit.
 *
 * Sinds besluit 294 in soorten (Klimaat, Licht, Warm water en bad, Witgoed,
 * Auto en laden, Thuisaccu, Stekkers), met bovenaan een rij om te springen,
 * en alle lampen per kamer met een schakelaar. De pagina mag op de wand scrollen.
 *
 * Eerlijk over wat er is (besluit 104): een batterij of een auto staat hier pas
 * als het huis er een heeft. De tijd kiezen gaat naar de dienst, nooit naar
 * Home Assistant.
 */
'use strict';

const { $$, nl, esc, klokVan, haal, deur } = app;
// De teksten staan in kit/teksten.*.js (besluit 185).
const { t } = taal;

let state = null;
let vandaag = null;
let zon = null;
let aansluiting = null;
let huisData = null;
/** De schakelaars met de keuzes van de bewoner (besluit 297), en of SunArc ze hier kan bedienen. */
let schakelaarData = null;
let opbrengst = null;
/** Het antwoord op de laatste keuze per apparaat, tot het volgende besluit het overneemt. */
const gezegd = new Map();

async function laadAlles() {
  const [s, v, z, a, h, o, sch] = await Promise.allSettled([haal('api/state'), haal('api/vandaag'), haal('api/zon'), haal('api/aansluiting'), haal('api/huis'), haal('api/opbrengst?soort=dag'), haal('api/schakelaars')]);
  if (h.status === 'fulfilled') huisData = h.value;
  if (sch.status === 'fulfilled') schakelaarData = sch.value;
  if (o.status === 'fulfilled') opbrengst = o.value;
  if (s.status === 'fulfilled') state = s.value;
  if (v.status === 'fulfilled') vandaag = v.value;
  if (z.status === 'fulfilled') zon = z.value;
  if (a.status === 'fulfilled') aansluiting = a.value;
  teken();
}

/* ------------------------------------------------------------ de ring */

const RING = 2 * Math.PI * 27;

function ring({ deel = 0, kleur = '#F7B548', tekst = '', label, gestippeld = false, binnen = false }) {
  const spoor = gestippeld
    ? `<circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="2" stroke-dasharray="4 6"/>`
    : `<circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6"/>`;
  const boog = deel > 0 ? `<circle cx="32" cy="32" r="27" fill="none" stroke="${kleur}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(deel * RING).toFixed(1)} ${RING.toFixed(1)}" transform="rotate(-90 32 32)"/>` : '';
  const kern = binnen ? `<circle cx="32" cy="32" r="11" fill="none" stroke="#B8C4CF" stroke-width="3"/>` : '';
  const woord = tekst ? `<text x="32" y="37" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="600" font-size="15" fill="#EEF3F7">${esc(tekst)}</text>` : '';
  return `<svg class="ring" viewBox="0 0 64 64" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>${spoor}${boog}${kern}${woord}</svg>`;
}

const duurTekst = (min) => (min >= 60 ? t('thuis.apparaat.uren', { u: Math.floor(min / 60), m: String(Math.round(min % 60)).padStart(2, '0') }) : t('thuis.apparaat.minuten', { m: Math.max(1, Math.round(min)) }));

/* ------------------------------------------------------- een apparaat */

/**
 * Wanneer een draaiend apparaat begon en klaar is. Draait hij nog, dan is de
 * laatste strook van vandaag open: zijn begin is de start. Klaar is de start
 * plus de duur van het programma, zoals het apparaat die meldt.
 */
function looptijd(d) {
  const spans = (vandaag?.uitstelbaar ?? []).find((u) => u.id === d.id);
  const laatste = spans?.draaide?.[spans.draaide.length - 1];
  const open = d.stand === 'running' && laatste && Date.now() - laatste.totMs < 5 * 60_000 && laatste.vanMs > (vandaag?.vanMs ?? 0);
  if (!open) return null;
  // De resterende tijd van het apparaat gaat voor de duur van het programma (besluit 167).
  return { start: laatste.vanMs, klaar: d.restMin != null ? Date.now() + d.restMin * 60_000 : d.duurMin ? laatste.vanMs + d.duurMin * 60_000 : null };
}

function kaart(d) {
  const spans = (vandaag?.uitstelbaar ?? []).find((u) => u.id === d.id);
  const nu = Date.now();
  const start = looptijd(d)?.start ?? null;
  const zouOm = spans?.zouStarten?.[0]?.vanMs;

  let boven;
  let toon = '';
  let zin = d.zin;
  let rest = null;
  if (d.stand === 'running' && d.klaarSindsMs != null) {
    // Klaar met drogen; de trommel draait nog tegen kreuken (besluit 167). Dat zegt de kop van de dienst.
    toon = 'mint-t';
    boven = ring({ deel: 1, kleur: '#6EE7B7', tekst: '✓', label: t('vandaag.isKlaar', { naam: d.naam }) });
  } else if (d.stand === 'running') {
    toon = 'zon-t';
    const klaarOm = looptijd(d)?.klaar ?? null;
    if (start != null && klaarOm != null) {
      const gelopen = (nu - start) / 60_000;
      const over = Math.max(0, (klaarOm - nu) / 60_000);
      const klaar = klaarOm;
      boven = ring({ deel: Math.min(1, gelopen / Math.max(1, gelopen + over)), tekst: duurTekst(over), label: t('apparaten.nogMinuten', { naam: d.naam, n: Math.round(over) }) });
      toon = 'zon-t';
      zin = `${t('apparaten.begon', { klok: klokVan(start) })}${zouOm != null && zouOm < start ? ` ${t('apparaten.zou', { klok: klokVan(zouOm) })}` : ''}`;
      rest = over > 0 ? { van: nu, tot: klaar } : null;
      d = { ...d, kop: t('apparaten.klaarRond', { kop: d.kop, klok: klokVan(klaar) }) };
    } else {
      boven = ring({ deel: 1, label: t('kamer.draait', { naam: d.naam }) });
    }
  } else if (d.stand === 'would_start') {
    toon = 'zon-t';
    boven = ring({ gestippeld: true, binnen: true, deel: 0.08 });
  } else if (d.stand === 'waiting') {
    boven = ring({ gestippeld: true, binnen: true });
  } else {
    boven = ring({ gestippeld: true });
  }
  void rest;
  const draaide = (spans?.draaide ?? []).reduce((som, x) => som + (x.totMs - x.vanMs), 0);
  // Draait hij, dan zette de bewoner hem aan: SunArc start nog niets zelf (de schaduw,
  // besluit 64). Dan niet "Start op zon", dat las alsof de zon hem startte (25 oktober 2026).
  const label = d.stand === 'running' && !d.doorSmartClimate ? `<span class="label">${esc(t('apparaten.zelfGestart'))}</span>` : `<span class="label zon">${esc(t('apparaten.startOpZon'))}</span>`;
  const el = document.createElement('section');
  el.className = 'glas app';
  el.dataset.actief = String(d.stand === 'running' || d.stand === 'would_start' || d.stand === 'waiting');
  // Voor de kop van de soort (besluit 293): wachten op zon is niet hetzelfde als bezig.
  el.dataset.wacht = String(d.stand === 'would_start' || d.stand === 'waiting');
  el.innerHTML = `
    <div class="boven">${boven}<div><b>${esc(d.naam)}</b><span class="klein ${toon}">${esc(d.kop)}</span></div></div>
    <p class="mini zin">${esc(zin)}</p>
    <div class="labels">${label}</div>
    <div class="vandaag"><span>${esc(t('thuis.kaart.vandaag'))}</span><b>${esc(draaide > 0 ? t('apparaten.gedraaid', { duur: uren(draaide) }) : t('apparaten.nietGedraaid'))}</b></div>`;

  // Een tik opent altijd het blad (besluit 245): wacht hij op zon, dan uiterlijk klaar en Nu starten
  // (besluit 238); anders hoe je hem klaarzet, zodat je ziet dat er iets mee kan.
  el.dataset.blad = 'witgoed';
  el.dataset.wg = d.id;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', t(d.kanKiezen ? 'witgoed.openBlad' : 'witgoed.openUitleg', { naam: d.naam }));
  const regel = (tekst) => el.querySelector('.zin').insertAdjacentHTML('afterend', `<p class="mini wg-regel">${esc(tekst)}</p>`);
  if (d.kanKiezen && d.klaarVoor) regel(t('witgoed.klaarVoorKort', { klok: d.klaarVoor }));
  else if (!d.kanKiezen && d.stand !== 'running') regel(t('witgoed.hoeKlaarzetten'));
  witgoedNu.set(d.id, d);
  return el;
}

/** Het witgoed op de kaarten, voor het blad. */
const witgoedNu = new Map();
/** Van Te doen (apparaten.html#wg-droger): dat blad meteen open, één keer. */
let wgUitAdres = location.hash.startsWith('#wg-') ? decodeURIComponent(location.hash.slice(4)) : null;
function openUitAdres() {
  if (!wgUitAdres || !witgoedNu.has(wgUitAdres)) return;
  void hand.openWitgoed(witgoedNu.get(wgUitAdres));
  wgUitAdres = null;
}

/* ------------------------------------------- de boiler en de jacuzzi */

let tankNr = 0;
/** De tank van de boiler, gevuld tot de temperatuur, met een streep bij het doel op zon (besluit 186). */
function tank(b) {
  const deel = b.temperatuurC == null ? 0.5 : Math.max(0.08, Math.min(1, (b.temperatuurC - 20) / Math.max(1, b.zonC - 20)));
  const hoog = Math.round(52 * deel);
  // Een eigen naam per tekening: wand en telefoon staan allebei in de pagina, en een verborgen verloop tekent niet.
  const id = `tank-${b.id}-${++tankNr}`;
  const tekst = b.temperatuurC == null ? '' : `<text x="32" y="44" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="600" font-size="13" fill="#fff">${esc(nl(b.temperatuurC, 0))}°</text>`;
  const label = b.temperatuurC == null ? b.naam : t('apparaten.tank', { naam: b.naam, temp: nl(b.temperatuurC, 0) });
  return `<svg class="ring" viewBox="0 0 64 64" role="img" aria-label="${esc(label)}"><defs><linearGradient id="${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#4d86c9"/><stop offset="0.55" stop-color="#ff9a6b"/><stop offset="1" stop-color="#ff6a3d"/></linearGradient><clipPath id="${id}-v"><rect x="18" y="6" width="28" height="52" rx="12"/></clipPath></defs><rect x="18" y="6" width="28" height="52" rx="12" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.16)" stroke-width="1.5"/><g clip-path="url(#${id}-v)"><rect x="18" y="${58 - hoog}" width="28" height="${hoog}" fill="url(#${id})"/></g>${b.bron === 'zon' ? '<path d="M14 13h36" stroke="#F7B548" stroke-width="1.5" stroke-dasharray="3 3"/>' : ''}${tekst}</svg>`;
}

/**
 * Een slimme stekker (besluit 264): het vaste stekkericoon, de naam uit Home
 * Assistant, wat hij nu trekt, en of hij op zon aan zou gaan of uit. SunArc
 * kijkt mee; schakelen doet hij nog niet.
 */
function stekkerKaart(b) {
  const aan = b.stookt;
  // Zoals bij de airco's: op zon of wachtend op zon geel, aan zonder zon gloed.
  const kleur = (aan && b.stand === 'waiting') || b.bron === 'net' ? 'var(--gloed)' : b.stand === 'would_heat' || b.stand === 'waiting' ? 'var(--zon)' : 'var(--net)';
  const kw = b.vermogenW != null && b.vermogenW >= 5 ? `${nl(b.vermogenW / 1000)}<span>${esc(t('apparaten.kwNu'))}</span>` : '';
  const el = document.createElement('section');
  el.className = 'glas app';
  el.dataset.actief = String(aan || b.stand === 'would_heat');
  el.dataset.wacht = String(!aan && b.stand === 'waiting');
  // Met de hand (besluit 265): in zonkleur, met tot wanneer.
  const st = hand.stekker(b.id);
  const metHand = st?.actief;
  // Op zon, echt geschakeld (besluit 267): dan zegt de kop wat er nu gebeurt, niet wat zou.
  const zon = st?.zon;
  const kop = zon?.schakelt && b.stand === 'would_heat' && !aan ? t('apparaten.stekkerGaatAan') : zon?.vanSunArc && aan && b.stand === 'waiting' ? t('apparaten.stekkerGaatUit') : b.kop;
  const zin = zon?.rustTot ? t('apparaten.stekkerRust') : zon?.schakelt && aan && !zon.vanSunArc && b.stand === 'waiting' ? `${b.zin} ${t('apparaten.stekkerZelfAan')}` : b.zin;
  const etiket = zon?.schakelt ? 'apparaten.stekkerSchakelt' : st?.toegelaten ? 'apparaten.stekkerMag' : 'apparaten.kijktMee';
  el.innerHTML = `
    <div class="kopje"><span class="ik">${iconen.svg('stekker')}</span><div><b>${esc(b.naam)}</b><span class="mini">${esc(t('apparaten.stekker'))}</span></div><div class="kw">${kw}</div></div>
    <div class="stand"><i style="background: ${kleur}"></i>${esc(kop)}</div>
    ${metHand ? `<p class="mini zin" style="color: var(--zon-t); font-weight: 600">${esc(t(metHand.aan ? 'hand.stekkerAanTot' : 'hand.stekkerUitTot', { klok: klokVan(metHand.totMs) }))}</p>` : `<p class="mini zin">${esc(zin)}</p>`}
    <p class="mini etiket">${esc(t(aan ? 'apparaten.stekkerAan' : 'apparaten.stekkerUit'))} · ${esc(t(etiket))}</p>`;
  return stekkerBlad(el, b.id, b.naam);
}

/** Een tik op een stekker opent zijn blad (besluit 265): aan of uit, met een eind. */
function stekkerBlad(el, id, naam) {
  el.dataset.blad = 'stekker';
  el.dataset.stekker = id;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', t('apparaten.stekkerOpen', { naam }));
  return el;
}

function bufferKaart(b) {
  if (b.soort === 'stekker') return stekkerKaart(b);
  const kleur = b.bron === 'zon' ? '#F7B548' : b.bron === 'net' ? '#ff9a6b' : '#6EE7B7';
  const toon = b.bron === 'zon' ? 'zon-t' : b.bron === 'net' ? 'gloed-t' : b.stand === 'full' ? 'mint-t' : '';
  const deel = b.temperatuurC == null ? 0 : Math.max(0, Math.min(1, (b.temperatuurC - 20) / Math.max(1, b.zonC - 20)));
  const boven = b.soort === 'boiler' ? tank(b) : ring({ deel, kleur, tekst: b.temperatuurC == null ? '' : `${nl(b.temperatuurC, 0)}°`, label: b.temperatuurC == null ? b.naam : t('apparaten.tank', { naam: b.naam, temp: nl(b.temperatuurC, 0) }) });
  const el = document.createElement('section');
  el.className = 'glas app';
  el.dataset.actief = String(b.stand === 'would_heat' || b.stookt);
  el.innerHTML = `
    <div class="boven">${boven}<div><b>${esc(b.naam)}</b><span class="klein ${toon}">${esc(b.kop)}</span></div></div>
    <p class="mini zin">${esc(b.zin)}</p>
    <div class="labels"><span class="label zon">${esc(t('apparaten.warmteOpZon'))}</span></div>`;
  if (b.keuzes.length > 0) {
    const opties = [{ tekst: t('apparaten.geenHaast'), waarde: null }, ...b.keuzes];
    const blok = document.createElement('div');
    blok.innerHTML = `<div class="mini" style="margin-bottom: 6px">${esc(t('apparaten.klaarOm'))}</div><div class="keuze" role="group" aria-label="${esc(t('apparaten.klaarOmVan', { naam: b.naam }))}"></div><p class="mini gezegd" aria-live="polite" style="margin: 8px 0 0">${esc(gezegd.get(b.id) ?? '')}</p>`;
    const groep = blok.querySelector('.keuze');
    const antwoord = blok.querySelector('.gezegd');
    for (const o of opties) {
      const knop = document.createElement('button');
      knop.type = 'button';
      knop.textContent = o.tekst;
      knop.setAttribute('aria-pressed', String(o.waarde == null ? b.klaarOm == null : b.klaarOm?.atMs === o.waarde));
      knop.addEventListener('click', () => void kiesKlaarOm(b, o, groep, knop, antwoord));
      groep.append(knop);
    }
    el.append(blok);
  }
  // Een tik op de kaart (niet op een keuze) opent het blad van de boiler of jacuzzi (besluit 298).
  return metBlad(el, `buffer:${b.id}`, b.naam);
}

async function kiesKlaarOm(b, optie, groep, knop, antwoord) {
  antwoord.textContent = t('apparaten.even');
  try {
    const res = await deur('api/klaarom', { id: b.id, klaarOm: optie.waarde });
    if (res === null) return;
    const uit = await res.json().catch(() => ({}));
    const tekst = !res.ok
      ? uit.fout ?? t('kamer.mislukt')
      : optie.waarde
        ? t('apparaten.klaarOmGenoteerd', { tekst: optie.tekst, doel: uit.klaarOm?.targetC ?? b.zonC })
        : t('apparaten.klaarOmWeg', { min: b.ondergrensC });
    if (res.ok) [...groep.children].forEach((x) => x.setAttribute('aria-pressed', String(x === knop)));
    gezegd.set(b.id, tekst);
    antwoord.textContent = tekst;
  } catch {
    antwoord.textContent = t('kamer.geenVerbinding');
  }
}

/* ------------------------------------------------------- het klimaat */

const uren = (ms) => {
  const min = Math.round(ms / 60_000);
  return min < 60 ? t('vandaag.minuten', { n: Math.max(1, min) }) : t('apparaten.uren', { uren: nl(min / 60) });
};
/** De rol van een klimaatapparaat: houdt, zon of kijken (teksten.*.js). */
const ROL = (rol) => t(`apparaten.rol.${rol}`);
const IK = {
  airco: iconen.svg('airco'),
  warm: iconen.svg('boiler'),
};

/** Elk klimaatapparaat in een kamer, met zijn kamer. */
const klimaat = () => (huisData?.etages ?? []).flatMap((e) => (e.ruimtes ?? []).flatMap((r) => (r.apparaten ?? []).filter((a) => a.soort === 'klimaat').map((a) => ({ a, r }))));

/**
 * Een klimaatapparaat nu: wat het doet (uit wat de dienst zegt, of wat Home
 * Assistant meldt), wat het vraagt, en wat het vandaag deed.
 */
function klimaatKaart({ a, r }) {
  const id = a.actuatorId ?? a.id;
  const bew = state?.bewoner?.apparaten?.find((x) => x.actuatorId === id);
  const wacht = (state?.rejected ?? []).find((x) => x.blockedBy === 'insufficient_power_budget' && x.intent?.actuatorId === id && x.intent?.budgetW > 0);
  const code = a.klimaat?.actieCode ?? '';
  const doet = /^(koelt|verwarmt|verwarmt-voor|droogt|ventileert)$/.test(code);
  const stand = bew?.soort === 'wait' ? [t('apparaten.wachtZon'), 'var(--zon)'] : doet ? [huismodel.metHoofdletter(a.klimaat.actie), code === 'koelt' ? 'var(--ijs)' : 'var(--gloed)'] : [huismodel.metHoofdletter(a.stand ?? t('apparaten.onbekend')), 'var(--mint)'];
  // Niet twee keer hetzelfde (29 oktober 2026): de zin begon met de stand ("Verwarmen naar 20° · onder het doel"),
  // en een stand die het doel al noemt ("Automatisch naar 18°") kreeg "Doel 18°." eronder. Een radiatorknop noemt het ook al.
  // Een warmtepomp met een stooklijn of watertemperatuur als doel (testerronde, november 2026): dat zegt hij, geen kamer.
  const soortDoel = a.klimaat?.ha?.doel ?? 'kamer';
  const getalDoel = a.klimaat?.doelC != null ? nl(a.klimaat.doelC, Number.isInteger(a.klimaat.doelC) ? 0 : 1) : null;
  const doel = getalDoel == null ? null : soortDoel === 'stooklijn' ? t('apparaten.stooklijn', { doel: `${a.klimaat.doelC > 0 ? '+' : ''}${getalDoel}` }) : soortDoel === 'water' ? t('apparaten.water', { doel: getalDoel }) : `${getalDoel}°`;
  const standLaag = stand[0].toLowerCase();
  const rest = bew?.tekst?.toLowerCase().startsWith(standLaag) ? bew.tekst.slice(standLaag.length).replace(/^[\s·,.;:–-]+/, '') : bew?.tekst;
  // Twee doelen bij één thermostaat (30 oktober 2026): bovenaan wat het apparaat zelf zegt ("Automatisch naar 18°"),
  // eronder wat SunArc zou doen. Doet het apparaat het niet zelf, dan zegt de zin van wie hij is.
  const vanSC = rest && !doet && bew?.soort !== 'wait' ? t('apparaten.zouKiezen', { wat: rest }) : rest ? `${huismodel.metHoofdletter(rest)}.` : '';
  const zin = bew?.tekst
    ? [vanSC, wacht ? t('apparaten.begintBij', { kw: nl(wacht.intent.budgetW / 1000) }) : ''].filter(Boolean).join(' ')
    : doel && !standLaag.includes(doel) && !(a.radiatorknop && a.standCode !== 'uit' && a.standCode !== 'geen-verbinding') ? t('vandaag.doel', { doel }) : '';
  // Zonder meter niets rechtsboven (besluit 226): een streepje met "geen meter" zei alleen wat er niet is.
  const kw = a.klimaat?.vermogenW != null ? `${nl(a.klimaat.vermogenW / 1000)}<span>${esc(t('apparaten.kwNu'))}</span>` : '';
  // Vandaag: uit de kWh-meter van het apparaat (Opbrengst), anders hoe lang het aan stond.
  const meter = (opbrengst?.apparaten ?? []).find((m) => m.id === a.klimaat?.energieMeter);
  const aan = (vandaag?.apparaten ?? []).find((x) => x.actuatorId === id)?.huidig ?? [];
  const aanMs = aan.reduce((som, x) => som + (x.totMs - x.vanMs), 0);
  const zonPct = meter && meter.kwh > 0 ? Math.round((meter.zonKwh / meter.kwh) * 100) : 0;
  const vandaagKop = `<span>${esc(t('thuis.kaart.vandaag'))}</span>`;
  const dag = meter
    ? `<div class="vandaag">${vandaagKop}<b>${esc(t('apparaten.eigenZon', { kwh: nl(meter.kwh), pct: zonPct }))}</b></div><div class="verdeel"><i style="width: ${zonPct}%; background: var(--zon)"></i><i style="width: ${100 - zonPct}%; background: #8796a8"></i></div>`
    : `<div class="vandaag">${vandaagKop}<b>${esc(aanMs > 0 ? t('apparaten.aan', { duur: uren(aanMs) }) : t('apparaten.nietAan'))}</b></div>`;
  // Gewone tekst in één regel, geen etiketjes (besluit 228): "Houdt op temperatuur · filter 20%".
  const labels = [a.klimaat?.rol ? ROL(a.klimaat.rol) : '', a.klimaat?.filter?.pct != null ? t('apparaten.filter', { pct: a.klimaat.filter.pct }) : ''].filter(Boolean).join(' · ');
  const el = document.createElement('a');
  el.className = 'glas app';
  el.href = `kamer.html#${encodeURIComponent(r.id)}/${encodeURIComponent(a.id)}`;
  el.dataset.actief = String(doet || bew?.soort === 'wait');
  el.dataset.wacht = String(!doet && bew?.soort === 'wait');
  // Alleen "SunArc zou: …": dan kan hij samen met de andere kaarten bovenaan (besluit 226).
  if (vanSC && zin === vanSC && rest && !doet && bew?.soort !== 'wait') el.dataset.zou = rest;
  // Met de hand (besluit 235): in zonkleur, met wanneer het terug gaat. Een tik opent het blad (besluit 238).
  const bijHand = hand.bij({ actuatorId: id, id: a.id });
  const metHand = bijHand?.actief ? bijHand : null;
  if (bijHand) {
    // Geen link naar de kamer meer, maar het blad hier (de link ging voor de klik van de pagina).
    el.removeAttribute('href');
    el.dataset.blad = 'klimaat';
    el.dataset.klimaat = bijHand.id;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
  }
  el.innerHTML = `
    <div class="kopje"><span class="ik${a.klimaat?.kanKoelen ? '' : ' warm'}">${a.klimaat?.kanKoelen ? IK.airco : IK.warm}</span><div><b>${esc(a.naam)}</b><span class="mini">${esc(r.naam)}</span></div><div class="kw">${kw}</div></div>
    <div class="stand"><i style="background: ${stand[1]}"></i>${esc(stand[0])}</div>
    ${metHand ? `<p class="mini zin" style="color: var(--zon-t); font-weight: 600">${esc(huismodel.metHoofdletter(hand.nuZin(metHand)))}</p>` : zin ? `<p class="mini zin">${esc(zin)}</p>` : ''}
    ${labels ? `<p class="mini etiket">${esc(labels)}</p>` : ''}
    ${dag}
    <button type="button" class="meld-app" data-meld-probleem data-apparaat="${esc(a.id)}" data-naam="${esc(a.naam)}">${esc(t('melden.klopt'))}</button>`;
  return el;
}

/*
 * De auto en de thuisbatterij (besluit 182): hoe vol, wat ze doen en met
 * hoeveel. Alleen lezen; een tik op de kaart op Thuis komt hier uit
 * (apparaten.html#auto, #batterij).
 */
const LADING_IK = {
  auto: iconen.svg('auto'),
  batterij: iconen.svg('batterij'),
};
/**
 * De thuisaccu in de schaduw (besluit 274): laadt hij met zon, dan wat SunArc
 * zou aanzetten als dat zon over was. Alleen kijken; er gaat niets naar het huis.
 */
function accuSchaduwZin() {
  const a = state?.bewoner?.accu;
  if (!a) return null;
  const kw = nl(a.zonKw);
  const wat = a.zou.length > 1 ? `${a.zou.slice(0, -1).join(', ')} ${t('algemeen.en')} ${a.zou.at(-1)}` : a.zou[0];
  return a.zou.length ? t('apparaten.accuSchaduw', { kw, wat }) : t('apparaten.accuSchaduwNiets', { kw });
}

/** Met de maat (besluit 275): hoeveel kWh erin zit, en hoe laat hij vol is of hoe lang hij het huis nog voedt. */
function accuMaatZin(b) {
  if (b?.maatKWh == null || b.nogKWh == null) return '';
  const deel = t('apparaten.accuNog', { nog: nl(b.nogKWh), maat: nl(b.maatKWh, b.maatKWh % 1 ? 1 : 0) });
  const erbij = b.volOm ? t('apparaten.accuVolOm', { tijd: window.taal.klok(Date.parse(b.volOm)) }) : b.urenNog != null ? t('apparaten.accuUren', { uren: nl(b.urenNog) }) : '';
  return [deel, erbij].filter(Boolean).join(' · ');
}

/** Bij meer accu's (besluit 275): elk een regel met hoe vol en wat hij doet. */
function accuRegels(lijst) {
  if (!lijst || lijst.length < 2) return '';
  const doet = (b) => (b.stand === 'laadt' ? t('thuis.lading.laadt') : b.stand === 'levert' ? t('apparaten.levert') : b.stand === 'rust' ? t('thuis.lading.rust') : '');
  return `<div class="accuregels">${lijst.map((b) => `<div class="accuregel"><b>${esc(b.naam)}</b><span>${esc([b.pct != null ? `${nl(b.pct, 0)}%` : null, doet(b), b.vermogenW != null && Math.abs(b.vermogenW) >= 50 ? `${nl(Math.abs(b.vermogenW) / 1000)} kW` : null].filter(Boolean).join(' · '))}</span></div>`).join('')}</div>`;
}

function ladingKaart(soort, o) {
  const w = o.vermogenW;
  const kw = w != null && Math.abs(w) >= 50 ? `${nl(Math.abs(w) / 1000)}<span>${esc(t(soort === 'batterij' && w < 0 ? 'apparaten.kwNaarHuis' : 'apparaten.kwLaden'))}</span>` : '–<span>kW</span>';
  const [sleutel, kleur] =
    soort === 'auto'
      ? o.laadt ? ['thuis.lading.laadt', 'var(--mint)'] : o.aangesloten === true ? ['thuis.lading.aangesloten', 'var(--net)'] : o.aangesloten === false ? ['thuis.lading.nietAangesloten', 'var(--net)'] : ['apparaten.onbekend', 'var(--net)']
      : o.stand === 'laadt' ? ['thuis.lading.laadt', 'var(--zon)'] : o.stand === 'levert' ? ['apparaten.levert', 'var(--violet)'] : o.stand === 'rust' ? ['thuis.lading.rust', 'var(--net)'] : ['apparaten.onbekend', 'var(--net)'];
  const tekst = t(sleutel);
  const pct = o.pct == null ? null : Math.max(0, Math.min(100, o.pct));
  const zin = soort === 'auto'
    ? [o.bereikKm != null ? t('apparaten.bereik', { km: nl(o.bereikKm, 0) }) : '', o.pct == null ? t('apparaten.laadpaal') : ''].filter(Boolean).join(' ')
    : [accuMaatZin(o), accuSchaduwZin() ?? t('apparaten.batterijKijkt')].filter(Boolean).join(' ');
  const lijstAccus = soort === 'batterij' ? huisData?.opslag?.batterijen : null;
  const naam = lijstAccus?.length > 1 ? t('apparaten.accuSamen', { n: lijstAccus.length }) : o.naam;
  // De auto opent zijn eigen pagina (besluit 259, stap 2).
  const el = document.createElement(soort === 'auto' ? 'a' : 'div');
  if (soort === 'auto') el.href = `auto.html#${encodeURIComponent(o.id)}`;
  el.className = 'glas app';
  el.dataset.lading = soort;
  el.dataset.actief = String(soort === 'auto' ? !!o.laadt : o.stand === 'laadt' || o.stand === 'levert');
  el.innerHTML = `
    <div class="kopje"><span class="ik">${LADING_IK[soort]}</span><div><b>${esc(naam)}</b><span class="mini">${esc(t(soort === 'auto' ? 'thuis.kaart.auto' : 'apparaten.thuisbatterij'))}</span></div><div class="kw">${kw}</div></div>
    <div class="stand"><i style="background: ${kleur}"></i>${esc(tekst)}</div>
    <div class="vandaag"><span>${esc(t('apparaten.lading'))}</span><b>${pct == null ? esc(t('apparaten.onbekendKlein')) : `${nl(pct, 0)}%`}</b></div>
    <div class="verdeel"><i style="width: ${pct ?? 0}%; background: ${kleur}"></i></div>
    ${accuRegels(lijstAccus)}
    ${zin ? `<p class="mini zin">${esc(zin)}</p>` : ''}`;
  // De thuisaccu opent zijn blad (besluit 298); de auto heeft zijn eigen pagina.
  if (soort === 'batterij') return metBlad(el, 'accu', naam);
  return el;
}

/** Een apparaat dat de dienst vond maar dat (nog) niet op zon staat. */
function nietOpZon(a) {
  // Een stekker opent zijn blad, ook als hij niet op zon staat (besluit 265).
  if (a.soort === 'stekker') {
    const s = hand.stekker(a.id);
    const el = document.createElement('section');
    el.className = 'glas app niet';
    el.innerHTML = `
    <div class="kopje"><span class="ik">${iconen.svg('stekker')}</span><div><b>${esc(a.naam)}</b><span class="mini">${esc(t('apparaten.nietOpZon'))}</span></div></div>
    ${s?.actief ? `<p class="mini zin" style="color: var(--zon-t); font-weight: 600">${esc(hand.stekkerZin(s))}</p>` : `<p class="mini zin">${esc(t('apparaten.stekkerOpZon'))}</p>`}`;
    return stekkerBlad(el, a.id, a.naam);
  }
  const el = document.createElement('a');
  el.className = 'glas app niet';
  el.href = 'regeling.html#opzon';
  el.innerHTML = `
    <div class="boven">${ring({ gestippeld: true })}<div><b>${esc(a.naam)}</b><span class="klein">${esc(t('apparaten.nietOpZon'))}</span></div></div>
    <p class="mini zin">${esc(t('apparaten.zetOpZon'))}</p>`;
  return el;
}

/* ------------------------------------------------------------- de zon */

const ZON = '<svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="9" fill="#F7B548"/><g stroke="#F7B548" stroke-width="2.4" stroke-linecap="round"><path d="M20 3v4M20 33v4M3 20h4M33 20h4M8 8l3 3M29 29l3 3M8 32l3-3M29 11l3-3"/></g></svg>';
const MAAN = '<svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true"><path d="M26 8a13 13 0 1 0 6 20A11 11 0 0 1 26 8z" fill="#B8C4CF"/></svg>';

/**
 * Hoeveel zon er over is, met eronder een strook: waar de stroom nu heen gaat
 * (de airco's, de rest van het huis, terug naar het net). Sinds besluit 293
 * één blok bovenaan in plaats van een balk onder de kaarten, die nu scrollen.
 */
function tekenZonchip() {
  const s = state?.bewoner?.stromen ?? {};
  const zonKw = s.zonKw ?? 0;
  const overKw = Math.max(0, (state?.explanation?.budget?.surplusW ?? 0) / 1000);
  let kop;
  let onder;
  if (zonKw < 0.05) {
    kop = t('apparaten.geenZon');
    onder = t('apparaten.leverenNiets');
  } else if (overKw < 0.05) {
    kop = t('apparaten.geenZonOver');
    onder = t('apparaten.naarHuis', { kw: nl(zonKw) });
  } else {
    kop = t('apparaten.over', { kw: nl(overKw) });
    onder = t((s.aircoKw ?? 0) > 0.05 ? 'apparaten.vanZonAirco' : 'apparaten.vanZon', { kw: nl(zonKw) });
  }
  const delen = [
    [t('apparaten.deAircos'), s.aircoKw ?? 0, 'var(--ijs)'],
    // 's Avonds geeft de omvormer niets door: dan is wat van het net komt het huis (besluit 226).
    [t('apparaten.restHuis'), s.huisKw ?? Math.max(0, (s.netKw ?? 0) - (s.aircoKw ?? 0)), '#B8C4CF'],
    [t('apparaten.terugNet'), Math.max(0, -(s.netKw ?? 0)), 'var(--mint)'],
  ].filter(([, kw]) => kw >= 0.05);
  const totaal = delen.reduce((som, [, kw]) => som + kw, 0);
  const uitleg = `${t((s.zonKw ?? 0) >= 0.05 ? 'apparaten.waarHeen' : 'apparaten.watGebruikt')}: ${delen.map(([naam, kw]) => `${naam} ${nl(kw)} kW`).join(', ')}`;
  const strook = totaal > 0 ? `<div class="strook" role="img" aria-label="${esc(uitleg)}" title="${esc(uitleg)}">${delen.map(([, kw, kleur]) => `<i style="width: ${((kw / totaal) * 100).toFixed(1)}%; background: ${kleur}"></i>`).join('')}</div>` : '';
  $$('[data-zonchip]').forEach((el) => (el.innerHTML = `${zonKw < 0.05 ? MAAN : ZON}<div><div class="kop-3">${esc(kop)}</div><div class="mini">${esc(onder)}</div></div>${strook}`));
}

/* ------------------------------------------------- de soorten (293) */

/** De soorten, in deze volgorde op de pagina; een lege soort staat er niet. */
const SOORTEN = ['klimaat', 'licht', 'water', 'witgoed', 'auto', 'energie', 'stekkers', 'schakelaars'];
const SOORT_IK = { klimaat: 'airco', licht: 'lamp', water: 'boiler', witgoed: 'witgoed', auto: 'auto', energie: 'batterij', stekkers: 'stekker', schakelaars: 'apparaat' };
/** Het vlak achter het icoon van de soort, als r, g, b. */
const SOORT_VLAK = { klimaat: '111, 211, 255', licht: '247, 181, 72', water: '255, 122, 77', witgoed: '110, 231, 183', auto: '143, 134, 255', energie: '110, 231, 183', stekkers: '201, 211, 220', schakelaars: '201, 211, 220' };
/** Wat de dienst vond maar nog niet op zon staat: een stekker, een boiler of jacuzzi, of witgoed. */
const soortVanGevonden = (s) => (s === 'stekker' ? 'stekkers' : s === 'boiler' || s === 'jacuzzi' ? 'water' : 'witgoed');

/**
 * Waar een apparaat in huis staat: de kamer met dat apparaat open. In het blad
 * (besluit 298) als tweede weg, naast bedienen in het blad zelf. Null als het
 * huis het in geen kamer kent.
 */
function plekVan(...ids) {
  for (const e of huisData?.etages ?? []) {
    for (const r of e.ruimtes ?? []) {
      const a = (r.apparaten ?? []).find((x) => ids.includes(x.id) || (x.actuatorId != null && ids.includes(x.actuatorId)));
      if (a) return `kamer.html#${encodeURIComponent(r.id)}/${encodeURIComponent(a.id)}`;
    }
  }
  return null;
}

/** Een kaart die zijn blad opent (besluit 298): een tik of Enter, behalve op een knop erin. */
function metBlad(el, sleutel, naam) {
  el.dataset.vrij = sleutel;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', t('apparaten.openIn', { naam }));
  return el;
}

/** Wat je net tikte, tot Home Assistant de nieuwe stand doorgeeft. */
const lampWens = new Map();
const lampAan = (d) => (lampWens.has(d.id) ? lampWens.get(d.id) : d.aan === true);

/** Alle lampen per kamer, in de volgorde van het huis; zonder kamer achteraan. */
function lampenPerKamer() {
  const vakken = (huisData?.etages ?? []).flatMap((e) => (e.ruimtes ?? []).map((r) => ({ id: r.id, naam: r.naam, lampen: (r.apparaten ?? []).filter((a) => a.soort === 'licht') }))).filter((v) => v.lampen.length > 0);
  const los = (huisData?.zonderRuimte ?? []).filter((a) => a.soort === 'licht');
  return los.length ? [...vakken, { naam: null, lampen: los }] : vakken;
}

/** Een kamer met zijn lampen, elk met een schakelaar als licht bedienen mag (besluit 97). */
function kamerVak({ id: kamer, naam, lampen }) {
  const mag = huisData?.lichtBedienen === true;
  const aan = lampen.filter(lampAan).length;
  const kop = naam
    ? `<b>${esc(naam)}</b><small>${esc(aan ? t('apparaten.lampenAan', { n: aan, m: lampen.length }) : t('apparaten.lampenUit'))}</small>`
    : `<b>${esc(t('apparaten.zonderKamer'))}</b><a class="mist" href="indeling.html#los">${esc(t('apparaten.kiesKamer'))}</a>`;
  const rijen = lampen
    .map((d) => {
      const op = lampAan(d);
      // Een tik op de naam opent het blad van de lamp (besluit 298).
      void kamer;
      return `<div class="lamp${op ? ' aan' : ''}"><span class="lik">${iconen.svg('lamp')}</span><button type="button" class="lnaam" data-vrij="lamp:${esc(d.id)}" aria-label="${esc(t('apparaten.openIn', { naam: d.naam }))}">${esc(d.naam)}${d.via ? `<small>${esc(t('apparaten.via', { via: d.via }))}</small>` : ''}</button><button type="button" class="schakel${op ? '' : ' uit'}" role="switch" aria-checked="${op}" aria-label="${esc(t('apparaten.lampAanUit', { naam: d.naam }))}" data-lamp="${esc(d.id)}" ${mag ? '' : 'disabled'}></button></div>`;
    })
    .join('');
  const el = document.createElement('div');
  el.className = 'glas kamervak';
  el.innerHTML = `<div class="kkop">${kop}</div>${rijen}`;
  return el;
}

/** Een lamp aan of uit, via dezelfde deur als bij een kamer (`api/licht`). */
async function schakelLamp(id, aan) {
  lampWens.set(id, aan);
  teken();
  try {
    await deur('api/licht', { doel: 'lamp', id, aan });
  } catch {
    // Geen verbinding: de stand van Home Assistant komt vanzelf terug.
  }
  for (const ms of [800, 2500]) setTimeout(() => void laadAlles(), ms);
  setTimeout(() => {
    lampWens.delete(id);
    teken();
  }, 6000);
}

/* --------------------------------------------- een schakelaar (297) */

/** Het icoon bij wat er aan een schakelaar hangt. */
const WAT_IK = { lamp: 'lamp', kachel: 'warm', ventilator: 'ventilatie', pomp: 'vocht', boiler: 'boiler', fietslader: 'stekker', anders: 'apparaat' };
/** Wat je net tikte bij een schakelaar, tot Home Assistant het doorgeeft. */
const knopWens = new Map();

/** De naam van een knop: wat de bewoner koos, anders de naam van het apparaat (met een nummer bij meer knoppen). */
function knopNaam(s, knop, i) {
  const eigen = s.keuze?.knoppen?.[knop.id]?.trim();
  if (eigen) return eigen;
  const basis = s.keuze?.naam?.trim() || s.naam;
  return s.knoppen.length > 1 ? `${basis} ${i + 1}` : basis;
}

/**
 * Een schakelaar met iets anders dan een lamp (besluit 297): per knop of hij
 * aan staat, met een schakelaar als de bewoner met de hand toeliet en SunArc
 * hier mag schakelen (in de add-on).
 */
function knopRijen(s) {
  const mag = schakelaarData?.bedienen === true && s.keuze?.mag === 'hand';
  return s.knoppen
    .map((k, i) => {
      const aan = knopWens.has(k.id) ? knopWens.get(k.id) : k.aan === true;
      const stand = `${t(aan ? 'apparaten.stekkerAan' : 'apparaten.stekkerUit')}${s.aanname ? ` · ${t('apparaten.laatstGestuurd')}` : ''}`;
      const knop = mag ? `<button type="button" class="schakel${aan ? '' : ' uit'}" role="switch" aria-checked="${aan}" aria-label="${esc(t('apparaten.lampAanUit', { naam: knopNaam(s, k, i) }))}" data-knop="${esc(k.id)}"></button>` : '';
      return `<div class="lamp${aan ? ' aan' : ''}"><span class="lnaam">${esc(s.knoppen.length > 1 ? knopNaam(s, k, i) : stand)}${s.knoppen.length > 1 ? `<small>${esc(stand)}</small>` : ''}</span>${knop}</div>`;
    })
    .join('');
}

function schakelaarKaart(s) {
  const mag = schakelaarData?.bedienen === true && s.keuze?.mag === 'hand';
  const rijen = knopRijen(s);
  const el = document.createElement('section');
  el.className = 'glas app';
  el.dataset.actief = String(s.knoppen.some((k) => (knopWens.has(k.id) ? knopWens.get(k.id) : k.aan === true)));
  el.innerHTML = `
    <div class="kopje"><span class="ik" style="background: rgba(201, 211, 220, 0.14)">${iconen.svg(WAT_IK[s.keuze.wat] ?? 'apparaat')}</span><div><b>${esc(s.keuze.naam || s.naam)}</b><span class="mini">${esc(t(`toev.wat.${s.keuze.wat}`))} · ${esc(t('apparaten.via', { via: s.model ?? s.koppeling }))}</span></div><div class="kw">${s.nuW != null ? `${nl(s.nuW / 1000)}<span>${esc(t(s.meet ? 'apparaten.kwNu' : 'apparaten.kwIngevuld'))}</span>` : ''}</div></div>
    <div class="knoprijen">${rijen}</div>
    ${mag ? '' : `<p class="mini etiket">${esc(t(schakelaarData?.bedienen ? 'apparaten.kijktMee' : 'apparaten.schakelaarAddon'))}</p>`}`;
  return metBlad(el, `schakelaar:${s.id}`, s.keuze.naam || s.naam);
}

/* ------------------------------------------ het blad van elk apparaat (298) */

/** Een regel in een blad: links wat, rechts de waarde of een knop. */
const regel = (wat, rechts) => `<div class="vrij-rij"><span>${esc(wat)}</span>${rechts}</div>`;
const onder = (links) => `<div class="hand-onder">${links.map(([href, tekst]) => `<a class="hand-terug" href="${href}">${esc(tekst)}</a>`).join('')}</div>`;

/** Een lamp, in een kamer of zonder kamer, met de naam van zijn kamer. */
function vindLamp(id) {
  for (const e of huisData?.etages ?? []) for (const r of e.ruimtes ?? []) {
    const d = (r.apparaten ?? []).find((x) => x.id === id && x.soort === 'licht');
    if (d) return { d, kamer: r };
  }
  const los = (huisData?.zonderRuimte ?? []).find((x) => x.id === id);
  return los ? { d: los, kamer: null } : null;
}

function lampBlad(id) {
  const v = vindLamp(id);
  if (!v) return null;
  const { d, kamer } = v;
  const mag = huisData?.lichtBedienen === true;
  const op = lampAan(d);
  const zin = [kamer?.naam ?? t('apparaten.zonderKamer'), t(op ? 'apparaten.stekkerAan' : 'apparaten.stekkerUit'), d.via ? t('apparaten.via', { via: d.via }) : null].filter(Boolean).join(' · ');
  const schakel = `<button type="button" class="schakel${op ? '' : ' uit'}" role="switch" aria-checked="${op}" aria-label="${esc(t('apparaten.lampAanUit', { naam: d.naam }))}" data-lamp="${esc(d.id)}" ${mag ? '' : 'disabled'}></button>`;
  const helder = mag && d.dimbaar ? regel(t('apparaten.blad.helder'), `<input type="range" min="1" max="100" step="1" value="${d.helderheidPct ?? 100}" data-helder="${esc(d.id)}" aria-label="${esc(t('apparaten.blad.helder'))}">`) : '';
  const plek = kamer ? `kamer.html#${encodeURIComponent(kamer.id)}/${encodeURIComponent(d.id)}` : 'indeling.html#los';
  return {
    naam: d.naam,
    zin,
    html: `${regel(t('apparaten.blad.aan'), schakel)}${helder}${mag ? '' : `<p class="hand-hoe">${esc(t('kamer.lichtUit'))}</p>`}${onder([[plek, t(kamer ? 'apparaten.blad.inKamer' : 'apparaten.kiesKamer')]])}`,
  };
}

function bufferBlad(id) {
  const b = (state?.bewoner?.warmtebuffers ?? []).find((x) => x.id === id);
  if (!b) return null;
  const temp = b.temperatuurC == null ? null : regel(t('apparaten.blad.nu'), `<b>${nl(b.temperatuurC, 0)}°</b>`);
  const kw = b.vermogenW != null ? regel(t('apparaten.blad.vermogen'), `<b>${nl(b.vermogenW / 1000)} kW</b>`) : '';
  const kamer = plekVan(b.id, b.actuator);
  return {
    naam: b.naam,
    zin: b.kop,
    html: `<p class="hand-hoe">${esc(b.zin)}</p>${temp ?? ''}${kw}${onder([...(kamer ? [[kamer, t('apparaten.blad.inKamer')]] : []), ['regeling.html#opzon', t('apparaten.blad.instellen')]])}`,
  };
}

function accuBlad() {
  const o = huisData?.opslag?.batterij;
  if (!o) return null;
  const lijst = huisData?.opslag?.batterijen;
  const naam = lijst?.length > 1 ? t('apparaten.accuSamen', { n: lijst.length }) : o.naam;
  const doet = o.stand === 'laadt' ? t('thuis.lading.laadt') : o.stand === 'levert' ? t('apparaten.levert') : o.stand === 'rust' ? t('thuis.lading.rust') : t('apparaten.onbekend');
  const w = o.vermogenW;
  return {
    naam,
    zin: doet,
    html: `${regel(t('apparaten.lading'), `<b>${o.pct == null ? esc(t('apparaten.onbekendKlein')) : `${nl(o.pct, 0)}%`}</b>`)}${w != null ? regel(t('apparaten.blad.vermogen'), `<b>${nl(Math.abs(w) / 1000)} kW</b>`) : ''}${accuRegels(lijst)}${[accuMaatZin(o), accuSchaduwZin() ?? t('apparaten.batterijKijkt')].filter(Boolean).map((z) => `<p class="hand-hoe">${esc(z)}</p>`).join('')}${onder([['energie.html#accu', t('apparaten.blad.instellen')]])}`,
  };
}

function schakelaarBlad(id) {
  const s = (schakelaarData?.schakelaars ?? []).find((x) => x.id === id);
  if (!s?.keuze) return null;
  const mag = schakelaarData?.bedienen === true && s.keuze.mag === 'hand';
  return {
    naam: s.keuze.naam || s.naam,
    zin: [t(`toev.wat.${s.keuze.wat}`), t('apparaten.via', { via: s.model ?? s.koppeling })].join(' · '),
    html: `<div class="knoprijen vrij-knoppen">${knopRijen(s)}</div>${s.nuW != null ? regel(t('apparaten.blad.vermogen'), `<b>${nl(s.nuW / 1000)} kW</b>`) : ''}${!s.meet && s.keuze.vermogenW != null ? `<p class="hand-hoe">${esc(t('apparaten.ingevuldZin', { w: s.keuze.vermogenW }))}</p>` : ''}${mag ? '' : `<p class="hand-hoe">${esc(t(schakelaarData?.bedienen ? 'apparaten.kijktMee' : 'apparaten.schakelaarAddon'))}</p>`}${onder([[`toevoegen.html#s-${encodeURIComponent(s.id)}`, t('apparaten.blad.instellen')]])}`,
  };
}

/** Het blad bij een sleutel als "lamp:light.x", "buffer:boiler", "accu" of "schakelaar:id". */
function vrijBlad(sleutel) {
  const [soort, ...rest] = sleutel.split(':');
  const id = rest.join(':');
  if (soort === 'lamp') return lampBlad(id);
  if (soort === 'buffer') return bufferBlad(id);
  if (soort === 'accu') return accuBlad();
  if (soort === 'schakelaar') return schakelaarBlad(id);
  return null;
}
const openVrijBlad = (sleutel) => hand.openVrij(sleutel, () => vrijBlad(sleutel));

/** De helderheid van een lamp, zodra je de schuif loslaat; door dezelfde deur als een kamer. */
document.addEventListener('change', (e) => {
  const el = e.target.closest?.('[data-helder]');
  if (!el) return;
  lampWens.set(el.dataset.helder, true);
  void deur('api/licht', { doel: 'lamp', id: el.dataset.helder, aan: true, helderheidPct: Number(el.value) }).catch(() => null);
  for (const ms of [800, 2500]) setTimeout(() => void laadAlles(), ms);
  setTimeout(() => lampWens.delete(el.dataset.helder), 6000);
});

/** Een schakelaar met de hand aan of uit (besluit 297), door dezelfde deur als een stekker. */
async function schakelKnop(knop, aan) {
  knopWens.set(knop, aan);
  teken();
  try {
    await deur('api/schakelaar', { knop, aan });
  } catch {
    // Geen verbinding: de stand van Home Assistant komt vanzelf terug.
  }
  for (const ms of [800, 2500]) setTimeout(() => void laadAlles(), ms);
  setTimeout(() => {
    knopWens.delete(knop);
    teken();
  }, 6000);
}

/** In een paar woorden wat een soort nu doet, voor zijn kop. */
function samenvatting(kaarten) {
  const wacht = kaarten.filter((k) => k.dataset.wacht === 'true').length;
  const bezig = kaarten.filter((k) => k.dataset.actief === 'true' && k.dataset.wacht !== 'true').length;
  return [bezig ? t('apparaten.bezig', { n: bezig }) : '', wacht ? t('apparaten.wachtenOpZon', { n: wacht }) : ''].filter(Boolean).join(' · ') || t('apparaten.rustig');
}

/** Een soort: de kop met het icoon, en de kaarten of de kamers met lampen. */
function soortBlok(soort, inhoud, klein) {
  const el = document.createElement('section');
  el.className = 'soort';
  el.dataset.soort = soort;
  // Zo breed als hij kaarten heeft, hooguit drie: kleine soorten delen een rij op de wand.
  el.style.setProperty('--breed', String(Math.min(3, Math.max(1, inhoud.length))));
  el.innerHTML = `<h2><span class="sik" style="background: rgba(${SOORT_VLAK[soort]}, 0.14)">${iconen.svg(SOORT_IK[soort])}</span>${esc(t(`apparaten.soort.${soort}`))}<small>${esc(klein)}</small></h2><div class="${soort === 'licht' ? 'kamers' : 'kaarten'}"></div>`;
  el.lastElementChild.append(...inhoud);
  return el;
}

/** De rij met soorten bovenaan; een tik toont alleen die soort, Alles weer alles (besluit 296). */
function tekenSoortenRij(soorten, aantal) {
  const nu = gekozenSoort && soorten.includes(gekozenSoort) ? gekozenSoort : 'alles';
  const knop = (id, naam, n) => `<button type="button" data-naar="${id}" aria-pressed="${id === nu}">${esc(naam)}<small>${n}</small></button>`;
  const html = [knop('alles', t('apparaten.alles'), Object.values(aantal).reduce((a, b) => a + b, 0)), ...soorten.map((s) => knop(s, t(`apparaten.soort.${s}`), aantal[s]))].join('');
  $$('[data-soorten]').forEach((el) => {
    if (el.dataset.html !== html) {
      el.innerHTML = html;
      el.dataset.html = html;
    }
  });
}
/** De gekozen soort blijft staan als je terugkomt, op dit toestel. */
let gekozenSoort = (() => {
  try {
    return localStorage.getItem('sc-apparaten-soort');
  } catch {
    return null;
  }
})();

document.addEventListener('click', (e) => {
  const knop = e.target.closest('[data-knop]');
  if (knop && !knop.disabled) {
    void schakelKnop(knop.dataset.knop, knop.getAttribute('aria-checked') !== 'true');
    return;
  }
  const lamp = e.target.closest('[data-lamp]');
  if (lamp && !lamp.disabled) {
    void schakelLamp(lamp.dataset.lamp, lamp.getAttribute('aria-checked') !== 'true');
    return;
  }
  // Het blad van een apparaat (besluit 298): de naam van een lamp, of een kaart buiten een knop of keuze.
  const naam = e.target.closest('button[data-vrij]');
  const kaart = e.target.closest('.app[data-vrij]');
  if (naam || (kaart && !e.target.closest('button, a, input, select'))) {
    openVrijBlad((naam ?? kaart).dataset.vrij);
    return;
  }
  const naar = e.target.closest('[data-naar]');
  if (!naar) return;
  gekozenSoort = naar.dataset.naar;
  try {
    localStorage.setItem('sc-apparaten-soort', gekozenSoort);
  } catch {
    // Zonder opslag geldt de keuze tot de pagina sluit.
  }
  tekenNu();
  // Bovenaan beginnen: op de wand in de lijst, op de telefoon net onder de kop.
  $$('#wand [data-apparaten]').forEach((el) => (el.scrollTop = 0));
  if (app.telStand() && scrollY > 0) document.querySelector('#tel [data-soorten]')?.scrollIntoView({ block: 'start' });
});

/* ------------------------------------------------------------ tekenen */

/*
 * Wat SunArc zou doen, één keer (besluit 226): zeggen twee of meer kaarten
 * hetzelfde ("verwarmen naar 20° · onder het doel"), dan staat dat bovenaan en
 * niet op elke kaart.
 */
function zouSamen(kaarten, plek) {
  const tel = new Map();
  for (const k of kaarten) if (k.dataset.zou) tel.set(k.dataset.zou, (tel.get(k.dataset.zou) ?? 0) + 1);
  const samen = [...tel].filter(([, n]) => n > 1);
  for (const k of kaarten) if (samen.some(([wat]) => wat === k.dataset.zou)) k.querySelector('.zin')?.remove();
  const regel = plek?.querySelector('[data-zou-samen]');
  if (!regel) return;
  regel.hidden = !samen.length;
  regel.textContent = samen.map(([wat, n]) => t('apparaten.zouSamen', { n, wat: wat.replace(/\.$/, '') })).join(' ');
}

/** De kaarten per soort, nieuw getekend; wat nu iets doet eerst (besluit 140). */
function kaartenPerSoort() {
  const lijst = state.bewoner?.uitstelbaar ?? [];
  const buffers = state.bewoner?.warmtebuffers ?? [];
  const opZon = new Set([...lijst, ...buffers].map((d) => d.id));
  const gevonden = (aansluiting?.gevonden?.apparaten ?? []).filter((a) => !opZon.has(a.id));
  const opslag = huisData?.opslag ?? {};
  const per = {
    klimaat: klimaat().map(klimaatKaart),
    witgoed: lijst.map(kaart),
    water: buffers.filter((b) => b.soort !== 'stekker').map(bufferKaart),
    stekkers: buffers.filter((b) => b.soort === 'stekker').map(bufferKaart),
    auto: (opslag.autos ?? (opslag.auto ? [opslag.auto] : [])).map((x) => ladingKaart('auto', x)),
    energie: opslag.batterij ? [ladingKaart('batterij', opslag.batterij)] : [],
    // Een schakelaar met iets anders dan een lamp (besluit 297); een lamp staat bij Licht.
    schakelaars: (schakelaarData?.schakelaars ?? []).filter((x) => x.keuze && x.keuze.wat !== 'lamp').map(schakelaarKaart),
  };
  for (const a of gevonden) (per[soortVanGevonden(a.soort)] ??= []).push(nietOpZon(a));
  for (const s of Object.keys(per)) per[s] = [...per[s].filter((k) => k.dataset.actief === 'true'), ...per[s].filter((k) => k.dataset.actief !== 'true')];
  return per;
}

function tekenNu() {
  app.schaal();
  if (!state) return;
  app.luchtVan(zon, state.bewoner?.stromen?.zonKw ?? 0);
  tekenZonchip();
  const vakken = lampenPerKamer();
  let soortenNu = [];
  const aantal = {};
  for (const box of $$('[data-apparaten]')) {
    // Een knop met focus niet onder de vinger weghalen.
    if (box.contains(document.activeElement) && document.activeElement !== document.body && !document.activeElement.matches('[data-lamp], [data-knop]')) continue;
    const per = kaartenPerSoort();
    zouSamen(Object.values(per).flat(), box.closest('#wand, #tel'));
    const blokken = [];
    soortenNu = [];
    for (const s of SOORTEN) {
      if (s === 'licht') {
        if (!vakken.length) continue;
        const lampen = vakken.flatMap((v) => v.lampen);
        const aan = lampen.filter(lampAan).length;
        blokken.push(soortBlok('licht', vakken.map(kamerVak), aan ? t('apparaten.lampenAan', { n: aan, m: lampen.length }) : t('apparaten.lampenUit')));
        aantal.licht = lampen.length;
      } else {
        const kaarten = per[s] ?? [];
        if (!kaarten.length) continue;
        blokken.push(soortBlok(s, kaarten, samenvatting(kaarten)));
        aantal[s] = kaarten.length;
      }
      soortenNu.push(s);
    }
    // Licht is altijd zo breed als de pagina.
    blokken.find((b) => b.dataset.soort === 'licht')?.style.setProperty('--breed', '3');
    // Een soort gekozen in de rij: alleen die soort, over de hele breedte (besluit 296).
    const alleen = gekozenSoort && gekozenSoort !== 'alles' && blokken.some((b) => b.dataset.soort === gekozenSoort) ? gekozenSoort : null;
    for (const b of blokken) {
      b.hidden = alleen != null && b.dataset.soort !== alleen;
      if (alleen) b.style.setProperty('--breed', '3');
    }
    // Waar je stond, blijft staan: het scrollen in de wand gaat niet terug naar boven.
    const top = box.scrollTop;
    box.replaceChildren(...blokken);
    box.scrollTop = top;
  }
  tekenSoortenRij(soortenNu, aantal);
  // Een open blad volgt wat er verandert, zoals een lamp die aan ging.
  hand.verfris();
  // Hoeveel er nieuw gevonden is, zoals het scherm Toevoegen het telt (besluit 293).
  const opZonKeuze = aansluiting?.antwoorden?.opZon ?? {};
  const vast = new Set((aansluiting?.configuratie?.apparaten ?? []).map((x) => x.id));
  const nieuw = (schakelaarData?.schakelaars ?? []).filter((x) => !x.keuze).length + (huisData?.zonderRuimte ?? []).length + (aansluiting?.gevonden?.apparaten ?? []).filter((d) => opZonKeuze[d.id] !== true && !vast.has(d.id)).length + [...(aansluiting?.laden?.apparaten ?? []), ...(aansluiting?.accu?.apparaten ?? [])].filter((d) => !d.aan).length;
  $$('[data-nieuw-tel]').forEach((el) => {
    el.hidden = nieuw === 0;
    el.textContent = String(nieuw);
    el.setAttribute('aria-label', t('apparaten.nieuwGevonden', { n: nieuw }));
  });
  // Van Thuis met #auto of #batterij: naar die kaart (besluit 182), één keer.
  const doel = location.hash.slice(1);
  if ((doel === 'auto' || doel === 'batterij') && !naarKaart) {
    const k = document.querySelector(`${app.telStand() ? '#tel' : '#wand'} [data-lading="${doel}"]`);
    if (k) {
      naarKaart = true;
      k.scrollIntoView({ block: 'center' });
    }
  }
  openUitAdres();
}
let naarKaart = false;

/* -------------------------------------------------------------- starten */

/** Gebundeld: hooguit één keer per beeld (basis.js). */
const teken = app.gebundeld(tekenNu);
addEventListener('standwissel', teken);

app.start('apparaten');
void laadAlles();
// Het blad van een apparaat (besluit 238): een tik op een klimaatapparaat of witgoed dat op zon wacht.
async function laadHand() {
  await Promise.allSettled([hand.laad(), hand.laadStekkers()]);
  teken();
}
void laadHand();
setInterval(() => void laadHand(), 60_000);
addEventListener('handveranderd', () => void laadAlles());
function openBlad(kaartEl) {
  if (kaartEl.dataset.blad === 'klimaat') void hand.openen(kaartEl.dataset.klimaat);
  else if (kaartEl.dataset.blad === 'witgoed' && witgoedNu.has(kaartEl.dataset.wg)) void hand.openWitgoed(witgoedNu.get(kaartEl.dataset.wg));
  else if (kaartEl.dataset.blad === 'stekker') void hand.openStekker(kaartEl.dataset.stekker);
  else return;
  $$('.app.gekozen').forEach((x) => x.classList.remove('gekozen'));
  kaartEl.classList.add('gekozen');
}
document.addEventListener('click', (e) => {
  const k = e.target.closest('.app[data-blad]');
  if (!k || e.target.closest('[data-hand], [data-meld-probleem]')) return;
  e.preventDefault();
  openBlad(k);
});
document.addEventListener('keydown', (e) => {
  const k = e.target.closest?.('.app[data-blad]');
  if (k && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    openBlad(k);
    return;
  }
  // Het blad (besluit 298), alleen als de kaart zelf de focus heeft.
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.app[data-vrij]')) {
    e.preventDefault();
    openVrijBlad(e.target.dataset.vrij);
  }
});

setInterval(() => void laadAlles(), 60_000);
// In het voorbeeldhuis verschuift de klok (besluit 237): dan meteen vers.
addEventListener('voorbeeldklok', () => void laadAlles());
app.live((nieuw) => {
  state = nieuw;
  teken();
});
