/*
 * Deel van inrichten.js (opgesplitst op 22 november 2026): klimaat. Een gewoon script dat na
 * inrichten-huis.js laadt en zijn bovenste namen deelt met de andere delen van de pagina.
 */
'use strict';
/* global bewaarAansluiting, binnen, concept, d, dakVoorstelStap, energieNu, esc, klimaatIn, knop, lijstje, nl, rolKnoppen, rolVan, sleutel, stuur, teken, waarVan */
/* exported antwoorden, bewaarKamers, bewaarKort, dagKeuze, dagNu, kanBereik, kanOpen, kanStap, kanToestellen, kanVraagOpen, ligStaat, liggingStap, standaard, zonStap */

/*
 * Wat elk apparaat kan (besluit 197, schets Wand-Inrichten-Klimaat): per
 * klimaatapparaat wat Home Assistant ervan zegt en wat de koppeling betekent.
 * Groen werkt; een halve stip werkt met een omweg, en de zin zegt welke; een
 * vraagteken vraagt iets dat Home Assistant niet weet; een streep kan dat
 * apparaat niet. Links de lijst, rechts het apparaat dat open staat; op de
 * telefoon klapt het open in de lijst. Een bereik dat niet kan kloppen (onder
 * 4° of boven 35°) wordt een voorstel dat de bewoner aanpast; een open vraag
 * staat bij Mist nog.
 */
// Wat kan kloppen: 4° is de vorstbeveiliging van een radiatorknop; daaronder of boven 35° niet.
const BEREIK = [4, 35];
const IR = new Set(['smartir', 'broadlink', 'ir', 'irblaster', 'tuya_ir']);
const KOPPELING = { lg_thinq: 'LG ThinQ', smartthinq_sensors: 'SmartThinQ', nest: 'Google Nest', zha: 'ZHA', mqtt: 'Zigbee2MQTT', tuya: 'Tuya', smartir: t('inr.kan.ir'), broadlink: t('inr.kan.ir'), daikin: 'Daikin', midea_ac_lan: 'Midea', tado: 'tado°', netatmo: 'Netatmo', honeywell: 'Honeywell', generic_thermostat: t('inr.kan.generiek') };
const koppelingNaam = (k) => (k ? KOPPELING[k] ?? k : t('inr.kan.onbekend'));
/** De tip per koppeling; de LG's staan er vaak twee keer in. */
const TIP = { lg_thinq: 'lg', smartthinq_sensors: 'lg', nest: 'nest', tuya: 'tuya', smartir: 'ir', broadlink: 'ir' };
let kanOpen = null;
const kanToestellen = () => binnen().flatMap((r) => klimaatIn(r).map((a) => ({ a, r })));
const kanKeus = (a) => concept()?.apparaten?.[sleutel(a)] ?? {};
/** Een voorstel binnen wat een kamer kan zijn, als Home Assistant iets opgeeft wat niet kan kloppen. */
function kanBereik(a) {
  const h = a.klimaat?.ha ?? {};
  const eigen = kanKeus(a).bereik;
  // Een stooklijn of watertemperatuur (testerronde, november 2026): geen kamerbereik, dus niets te verbeteren.
  if (h.doel && h.doel !== 'kamer') return { min: h.minC, max: h.maxC, fout: false, eigen: false, ha: [h.minC, h.maxC] };
  if (eigen) return { min: eigen[0], max: eigen[1], fout: false, eigen: true, ha: [h.minC, h.maxC] };
  const fout = (h.minC != null && h.minC < BEREIK[0]) || (h.maxC != null && h.maxC > BEREIK[1]);
  if (!fout) return { min: h.minC, max: h.maxC, fout: false, eigen: false, ha: [h.minC, h.maxC] };
  const koel = a.klimaat?.kanKoelen;
  return { min: Math.max(h.minC ?? 0, koel ? 16 : 10), max: Math.min(h.maxC ?? 99, koel ? 30 : 25), fout: true, eigen: false, ha: [h.minC, h.maxC] };
}
const isKetel = (a) => huismodel.isKetelKoppeling(a) || huismodel.cvThermostaat(d.huis, antwoorden().verwarming)?.sleutel === sleutel(a);
/** Of een thermostaat moet zeggen wat hij verwarmt: niet de airco, niet de radiatorknop of de ketel, en zonder stroommeter. */
const vraagtWarmte = (a) => !a.klimaat?.kanKoelen && !a.radiatorknop && a.klimaat?.kanVerwarmen && a.klimaat?.vermogenW === undefined && !a.klimaat?.energieMeter && !isKetel(a);
const kanVraagOpen = (a) => vraagtWarmte(a) && !kanKeus(a).warmte;

/** Wat een apparaat kan, als punten, met de tip en hoe het ervoor staat. */
function kanVan(a, r) {
  const k = a.klimaat ?? {};
  const h = k.ha ?? {};
  const ir = IR.has(h.koppeling);
  const airco = !!k.kanKoelen;
  const meter = k.vermogenW !== undefined || !!k.energieMeter;
  const warmte = kanKeus(a).warmte;
  const p = [];
  const punt = (soort, titel, zin, extra = '') => p.push({ soort, titel, zin, extra });
  const graden = (x) => (x == null ? '?' : nl(x, Number.isInteger(x) ? 0 : 1));
  const b = kanBereik(a);
  // Wat hij kan, en van hoe laag tot hoe hoog.
  const wat = airco && k.kanVerwarmen ? t('inr.kan.koelWarm') : airco ? t('w.koelen') : t('w.verwarmen');
  const bereikZin = b.min != null && b.max != null ? t('inr.kan.vanTot', { min: graden(b.min), max: graden(b.max) }) : t('inr.kan.geenBereik');
  if (h.doel === 'stooklijn' || h.doel === 'water') {
    punt('ok', `${wat} · ${t(h.doel === 'stooklijn' ? 'inr.kan.stooklijn' : 'inr.kan.water')}`, t(h.doel === 'stooklijn' ? 'inr.kan.stooklijnZin' : 'inr.kan.waterZin', { min: graden(b.min), max: graden(b.max) }));
  } else if (b.fout || b.eigen) {
    const opties = (w) => Array.from({ length: BEREIK[1] - BEREIK[0] + 1 }, (_, i) => BEREIK[0] + i).map((x) => `<option value="${x}" ${x === w ? 'selected' : ''}>${x}°</option>`).join('');
    const kiezen = `<div class="chips"><select class="invoer invoer-klein" data-kan-bereik="${esc(sleutel(a))}" data-kant="min" aria-label="${esc(t('inr.kan.laagst'))}">${opties(b.min)}</select><select class="invoer invoer-klein" data-kan-bereik="${esc(sleutel(a))}" data-kant="max" aria-label="${esc(t('inr.kan.hoogst'))}">${opties(b.max)}</select></div>`;
    // Wat hij kan en het bereik in één regel, zodat de rest in beeld blijft.
    punt('om', `${wat} · ${t('inr.kan.geeftOp', { min: graden(b.ha[0]), max: graden(b.ha[1]) })}`, t(b.eigen ? 'inr.kan.houdtEigen' : 'inr.kan.kanNiet', { min: graden(b.min), max: graden(b.max) }), kiezen);
  } else punt('ok', wat, `${bereikZin}${k.kanDrogen ? t('inr.kan.drogen') : ''}${a.radiatorknop ? t('inr.kan.cvWater') : ''}`);
  // "Verwarmen en koelen" bij een thermostaat die alleen verwarmt.
  if (!airco && (h.standen ?? []).includes('heat_cool') && !(h.standen ?? []).includes('cool')) punt('om', t('inr.kan.ookKoelen'), t('inr.kan.ookKoelenZin'));
  // Zegt hij wat hij doet?
  if (ir) punt('nee', t('inr.kan.irNiets'), t('inr.kan.irNietsZin'));
  else if (h.zegtActie) punt('ok', t('inr.kan.zegt'), k.actie ? t('inr.kan.zegtNu', { actie: k.actie }) : t('inr.kan.zegtZin'));
  else if (meter) punt('om', t('inr.kan.zegtNiet'), t('inr.kan.zegtNietMeter'));
  else punt('om', airco ? t('inr.kan.zegtNiet') : t('inr.kan.stooktNiet'), t('inr.kan.zegtNietTemp'));
  // De stroom.
  if (meter) punt('ok', t('inr.kan.meter'), k.vermogenW != null ? t('inr.kan.meterNu', { w: Math.round(k.vermogenW) }) : t('inr.kan.meterZin'));
  else if (a.radiatorknop || warmte === 'cv' || isKetel(a)) punt('nee', t('inr.kan.meterNiet'), t('inr.kan.meterNietCv'));
  else if (airco) punt('om', t('inr.kan.geenMeter'), t('inr.kan.geenMeterAirco'));
  else if (warmte === 'elektrisch') punt('om', t('inr.kan.geenMeter'), t('inr.kan.geenMeterElektrisch'));
  // Filter en batterij.
  if (k.filter) punt('ok', t('inr.kan.filter'), k.filter.uren != null ? t('inr.kan.filterUren', { n: Math.round(k.filter.uren) }) : t('inr.kan.filterPct', { pct: Math.round(k.filter.pct) }));
  if (a.batterijPct != null) punt(app.bijnaOp(a.batterijPct, 'batterij', d.huis) ? 'om' : 'ok', t('inr.kan.batterij'), t('inr.kan.batterijZin', { pct: Math.round(a.batterijPct) }));
  // Meet hij de kamer?
  const temp = a.meting?.temperatuurC;
  if (temp == null) punt('om', t('inr.kan.meetNiet'), t('inr.kan.meetNietZin', { kamer: r.naam }), `<div class="chips"><a class="chip" href="#meten">${esc(t('inr.kan.naarMeten'))}</a></div>`);
  else if (a.radiatorknop) punt('om', t('inr.kan.meetRadiator'), t('inr.kan.meetRadiatorZin', { c: graden(temp) }));
  else punt('ok', t('inr.kan.meet'), t('inr.kan.meetZin', { c: graden(temp) }));
  // Wat verwarmt hij? Alleen als hij het niet zegt.
  if (vraagtWarmte(a)) {
    const chips = ['cv', 'elektrisch', 'weetniet'].map((w) => knop(`data-kan-warmte="${esc(sleutel(a))}" data-waarde="${w}"`, t(`inr.kan.warmte.${w}`), warmte === w)).join('');
    punt(warmte ? 'ok' : 'vraag', t('inr.kan.watWarmt'), t('inr.kan.watWarmtZin'), `<div class="chips">${chips}</div>`);
  }
  // De tip: een tweede koppeling, of wat bij deze koppeling hoort.
  const tweede = h.tweede ? t('inr.kan.tweemaal', { een: koppelingNaam(h.koppeling), twee: koppelingNaam(h.tweede.koppeling) }) : '';
  const soort = ir ? 'ir' : a.radiatorknop ? 'knop' : TIP[h.koppeling] ?? null;
  const weet = [tweede, soort ? t(`inr.kan.tip.${soort}`) : ''].filter(Boolean).join(' ');
  const omwegen = p.filter((x) => x.soort === 'om').length;
  const vragen = p.filter((x) => x.soort === 'vraag').length;
  const rol = rolVan(concept()?.kamers.find((x) => x.id === r.id), r, sleutel(a));
  const stand = ir ? ['beperkt', t('inr.kan.st.ir')] : vragen ? ['om', t(vragen === 1 ? 'inr.kan.st.vraag' : 'inr.kan.st.vragen', { n: vragen })] : rol === 'kijken' ? ['mee', t('inr.kan.st.mee')] : omwegen ? ['ok', t(omwegen === 1 ? 'inr.kan.st.omweg' : 'inr.kan.st.omwegen', { n: omwegen })] : ['ok', t('inr.kan.st.helemaal')];
  return { punten: p, weet, stand, rol, ir, vragen };
}

function kanStap() {
  const lijst = kanToestellen();
  if (!lijst.length) return { waar: waarVan('apparaat'), kop: t('inr.kan.kop'), uitleg: t('inr.kan.zin'), inhoud: `<p class="zacht">${esc(t('inr.kan.geen'))}</p>` };
  if (!lijst.some((x) => sleutel(x.a) === kanOpen)) kanOpen = sleutel(lijst[0].a);
  const al = lijst.map((x) => ({ ...x, kan: kanVan(x.a, x.r) }));
  const los = ({ a, r, kan }) => {
    const punten = kan.punten.map((x) => `<div class="kpunt ${x.soort}"><i aria-hidden="true">${x.soort === 'ok' ? '✓' : x.soort === 'vraag' ? '?' : x.soort === 'nee' ? '–' : ''}</i><span><b>${esc(x.titel)}</b>${x.zin ? `<small>${esc(x.zin)}</small>` : ''}${x.extra}</span></div>`).join('');
    const knoppen = rolKnoppen(a, kan.rol);
    return `<div class="klos" data-klos="${esc(sleutel(a))}">
      <div class="kkop"><b>${esc(a.naam)}</b><span>${esc(a.radiatorknop ? t('inr.kan.knopVia', { via: koppelingNaam(a.klimaat?.ha?.koppeling) }) : koppelingNaam(a.klimaat?.ha?.koppeling))}</span></div>
      <div class="kpunten">${punten}</div>
      ${kan.weet ? `<div class="kweet"><b>${esc(t('inr.kan.goedOmTeWeten'))}</b> ${esc(kan.weet)}</div>` : ''}
      <div class="krol"><b>${esc(t('inr.kan.watDoetHij'))}</b><div class="keuze" role="group" aria-label="${esc(t('inr.watMet', { naam: a.naam }))}" data-rol="${esc(sleutel(a))}" data-rolkamer="${esc(r.id)}">${knoppen}</div></div>
    </div>`;
  };
  const rij = (x) => {
    const open = sleutel(x.a) === kanOpen;
    const koel = !!x.a.klimaat?.kanKoelen;
    return `<button type="button" class="kapp${open ? ' open' : ''}" data-kan-open="${esc(sleutel(x.a))}" aria-expanded="${open}"><span class="kik ${koel ? 'koel' : 'warm'}" aria-hidden="true">${koel ? '❄' : '♨'}</span><span><b>${esc(x.a.naam)}</b><small>${esc(x.r.naam)} · <span class="kst ${x.kan.stand[0]}">${esc(x.kan.stand[1])}</span></small></span></button>${app.telStand() && open ? los(x) : ''}`;
  };
  // Samen in één zin: hoeveel er werken, meekijken, een vraag hebben of niets terugzeggen.
  const tel = (f) => al.filter(f).length;
  const delen = [
    t('inr.kan.samen.ok', { n: tel((x) => !x.kan.ir && !x.kan.vragen && x.kan.rol !== 'kijken') }),
    tel((x) => !x.kan.ir && !x.kan.vragen && x.kan.rol === 'kijken') ? t('inr.kan.samen.mee', { n: tel((x) => !x.kan.ir && !x.kan.vragen && x.kan.rol === 'kijken') }) : '',
    tel((x) => x.kan.vragen) ? t('inr.kan.samen.vraag', { n: tel((x) => x.kan.vragen) }) : '',
    tel((x) => x.kan.ir) ? t('inr.kan.samen.ir', { n: tel((x) => x.kan.ir) }) : '',
  ].filter(Boolean);
  const samen = `${t('inr.kan.samen.n', { n: al.length })} ${lijstje(delen)}.`;
  const lijstHtml = `<div class="klijst">${al.map(rij).join('')}<button type="button" class="kmist" data-kan-mist>${esc(t('inr.kan.mist'))}</button><p class="ksamen">${esc(samen)}</p></div>`;
  const open = al.find((x) => sleutel(x.a) === kanOpen);
  return {
    waar: waarVan('apparaat'),
    kop: t('inr.kan.kop'),
    uitleg: t('inr.kan.zin'),
    inhoud: app.telStand() ? lijstHtml : `<div class="kanstap">${lijstHtml}${open ? los(open) : ''}</div>`,
  };
}

/** De standaard voor een nieuw huis (besluit 204), zoals de dienst hem geeft. */
const standaard = () => d.comfort?.standaard ?? { warm: { dag: 20, nacht: 16, afwezig: 15, vakantie: 12 }, koel: { dag: 25, nacht: 25, afwezig: 27, vakantie: 28 }, dagdelen: { voorverwarmen: 6, dag: 7, nacht: 22 } };
/** Je dag: de dagdelen zoals ze bewaard worden (het voorstel neemt ze mee). */
let dagKeuze = null;
const dagNu = () => dagKeuze ?? { ...standaard().dagdelen, ...(d.comfort?.dagdelen ?? {}) };
/** Bewaar comfort: de kamers die veranderden, en de rest zoals ze zijn; met de dagdelen. */
async function bewaarKamers(nieuw, dagdelen = null) {
  const kamers = Object.fromEntries(d.comfort.kamers.map((k) => [k.id, { modi: nieuw.get(k.id) ?? k.modi, nooitWarmerC: k.nooitWarmerC, voorrang: k.voorrang, opZonC: k.opZonC }]));
  const body = { kamers, dagdelen: { ...standaard().dagdelen, ...(d.comfort.dagdelen ?? {}), ...(dagdelen ?? {}) }, ...(d.comfort.voorrang ? { voorrang: { koelen: d.comfort.voorrang.koelen, verwarmen: d.comfort.voorrang.verwarmen } } : {}) };
  const uit = await stuur('api/comfort', body);
  if (uit) d.comfort = uit;
  teken();
  return !!uit;
}

/* De panelen (besluit 158): eerst of ze er zijn, dan de kant van het dak, dan hoeveel. */
function antwoorden() {
  const x = d.aans?.antwoorden;
  return {
    panelen: { ligging: x?.panelen?.ligging ?? null, aantal: x?.panelen?.aantal ?? null, voorkant: x?.panelen?.voorkant ?? null, achterkant: x?.panelen?.achterkant ?? null },
    zekering: x?.zekering ?? null,
    tarief: x?.tarief ?? null,
    verwarming: { soort: x?.verwarming?.soort ?? null, aanvoerC: x?.verwarming?.aanvoerC ?? null, thermostaat: x?.verwarming?.thermostaat ?? null },
    // Hoe de panelen liggen (besluit 157): bewaart de stap daarna, hier gaat het alleen mee.
    voorkantZon: x?.voorkantZon ?? null,
    dak: x?.dak ?? null,
    opZon: { ...(x?.opZon ?? {}) },
    // Apparaten uit de configuratie die van zon zijn gehaald (besluit 167): gaan mee.
    opZonUit: [...(x?.opZonUit ?? [])],
    // Panelen op de garage, carport of het tuinhuis (besluit 187): gaan mee, anders vallen ze weg.
    elders: { ...(x?.elders ?? {}) },
  };
}
/** Een plaatje per plek, zoals de schets Wand-Inrichten-Daken. */
const KORT_BEELD = {
  hoofddak: '<path d="M4 22 22 8l18 14"/><path d="M8 19v13h28V19"/><path d="M26 13l8 6" stroke-width="4" stroke="#4d7eac"/>',
  uitbouw: '<path d="M4 18 16 8l12 10v14H4z"/><path d="M28 22h12v10H28z"/><path d="M29 21h10" stroke-width="3" stroke="#4d7eac"/>',
  garage: '<path d="M5 14h34v18H5z"/><path d="M11 32V21h22v11"/><path d="M8 13h28" stroke-width="3" stroke="#4d7eac"/>',
  grond: '<path d="M4 32h36"/><path d="M8 30 20 16h16L24 30" fill="#4d7eac" stroke="#9cc0e4"/>',
  carport: '<path d="M5 12h34M8 12v20M36 12v20"/><path d="M7 10h30" stroke-width="3" stroke="#4d7eac"/>',
  tuinhuis: '<path d="M8 18l14-9 14 9v14H8z"/><path d="M19 32v-8h6v8"/><path d="M24 12l9 6" stroke-width="3" stroke="#4d7eac"/>',
  gevel: '<path d="M8 6h20v26H8z"/><path d="M28 14l8 3v10l-8-3z" fill="#4d7eac" stroke="#9cc0e4"/>',
};
/** Een teller: − het aantal + (het aantal is ook in te typen, voor 48 panelen). */
const teller = (attr, n, naam) => `<span class="kp-teller"><button type="button" ${attr} data-kort-stap="-1" aria-label="${esc(t('inr.dak.minder', { naam }))}">−</button><input inputmode="numeric" ${attr} value="${n}" aria-label="${esc(t('inr.dak.aantalVan', { naam }))}"><button type="button" ${attr} data-kort-stap="1" aria-label="${esc(t('inr.dak.meer', { naam }))}">+</button></span>`;

/*
 * De korte stap (besluit 254, stap 3; schets Wand-Inrichten-Daken): alleen
 * waar panelen liggen en hoeveel. Elke plek wordt een vlak bij Daken en
 * panelen; richting en helling zoekt SunArc daarna op in wat ze leveren.
 */
function zonStap() {
  const a = antwoorden();
  const dk = d.aans?.daken ?? null;
  // Ook wat SunArc al afleidt (de meting, het bestand): dat telt nu al mee.
  const kort = dakvlakken.kortVan(dk);
  const piekW = (d.zon?.panelen ?? []).reduce((som, p) => som + (p.wattpiek ?? 0), 0);
  const meter = (energieNu()?.zon ?? []).length > 0;
  const geen = a.panelen.ligging === 'geen';
  // Wat Home Assistant al weet, bij de uitleg (zonder eigen rij: de stap past zo zonder schuiven).
  const gevonden = piekW > 0 ? ` <span class="chip gevonden">${esc(t('inr.kwpGevonden', { kwp: nl(piekW / 1000) }))}</span>` : meter ? ` <span class="chip gevonden">${esc(t('inr.meterGevonden'))}</span>` : '';
  const ICOON = (p) => `<svg viewBox="0 0 44 36" fill="none" stroke="#f7b548" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${KORT_BEELD[p]}</svg>`;
  const meerKanten = kort.kanten >= 2;
  const plaats = (p) => {
    const naam = t(p === 'grond' ? 'inr.dak.grond' : `daken.plek.${p}`);
    const n = kort.aan[p];
    if (!n) return `<button type="button" class="kp-plaats" data-kort-plek="${p}">${ICOON(p)}<b>${esc(naam)}</b><span class="kp-niet">${esc(t('inr.dak.tikAan'))}</span></button>`;
    // Bij meer kanten telt het hoofddak per kant, eronder.
    const onder = p === 'hoofddak' && meerKanten ? `<span class="kp-som">${esc(t('inr.dak.nPanelen', { n }))}</span>` : `${teller(`data-kort-n="${p}"`, n, naam)}`;
    return `<div class="kp-plaats aan">${ICOON(p)}<b>${esc(naam)}</b>${onder}</div>`;
  };
  const hoofd = kort.aan.hoofddak > 0;
  // Hoeveel kanten weet iedereen, of zoekt het even uit: geen "Weet ik niet" meer.
  const kantKeuze = String(Math.min(3, Math.max(1, kort.kanten)));
  const kanten = hoofd
    ? `<div class="kp-kanten"><b>${esc(t('inr.dak.kantenVraag'))}</b>${[['1', '1'], ['2', '2'], ['3', t('inr.dak.drieOfMeer')]].map(([w, x]) => knop(`data-kort-kanten="${w}"`, x, kantKeuze === w)).join('')}</div>
      ${meerKanten ?`<div class="kp-perkant">${kort.perKant.map((n, i) => `<label class="kp-kant"><span>${esc(dakvlakken.kantNaam(dk, i))}</span>${teller(`data-kort-kant="${i}"`, n, dakvlakken.kantNaam(dk, i))}</label>`).join('')}</div>` : ''}`
    : '';
  return {
    waar: waarVan('zon'),
    kop: t('inr.dak.kop'),
    uitleg: t('inr.dak.zin'),
    // Geen panelen: een regel onder de plekken; een plek aantikken zet ze weer aan.
    inhoud: `<div class="kp-plekken">${dakvlakken.KORT_PLEKKEN.map(plaats).join('')}</div>
      ${geen ? `<p class="kp-geen">${esc(t('inr.dak.geen'))}</p>` : `${kanten}<div class="kp-onder"><button type="button" class="lig-link" data-panelen="geen">${esc(t('daken.geenPanelen'))}</button>${gevonden}</div>`}
      ${Object.keys(kort.aan).length ? '' : `<div class="kp-tip">${esc(t('inr.dak.tip'))}</div>`}`,
  };
}

/** Bewaar de vlakken uit de korte stap, met de oude antwoorden erbij voor het huis en Thuis (zoals Daken en panelen). */
async function bewaarKort(wijziging) {
  const dk = d.aans?.daken ?? null;
  const vlakken = dakvlakken.kortNaar(dk ?? { vlakken: [] }, wijziging);
  const a = antwoorden();
  const oud = dakvlakken.oudeAntwoorden(vlakken, dk?.voorgevelDeg ?? null, a.panelen);
  a.panelen = oud.panelen;
  a.elders = oud.elders;
  const gebouwen = dk?.tekening ? dakvlakken.gebouwenUit(dk) : [];
  const grenzen = d.aans?.antwoorden?.daken?.grenzen;
  const daken = vlakken.length || gebouwen.length
    ? { vlakken, voorgevelDeg: dk?.voorgevelDeg ?? null, omvormerW: dk?.omvormerW ?? null, gebouwen, omgeving: dk?.tekening?.omgeving ?? [], ...(grenzen && Object.keys(grenzen).length ? { grenzen } : {}) }
    : null;
  await bewaarAansluiting(a, daken);
}

/*
 * Hoe de panelen liggen (besluit 157, schets Wand-Inrichten-Panelen): de kaart
 * komt uit panelen.js. Onderaan zijn knoppen: Aanpassen en Klopt bij een
 * voorstel, Terug en Bewaar bij aanpassen, en anders Aanpassen naast Volgende.
 */
const ligStaat = { aanpassen: false, concept: null, na: () => teken() };
function liggingStap() {
  // Met dakvlakken (besluit 254, stap 3): het voorstel per vlak, Aanpassen opent Daken en panelen.
  const dk = d.aans?.daken;
  if (dk?.vlakken?.length && antwoorden().panelen.ligging !== 'geen') return dakVoorstelStap(dk);
  // De antwoorden zoals de stap ze kent, ook als er nog niets bewaard is (besluit 166).
  const k = ligging.kaart(d.aans?.ligging, antwoorden(), ligStaat);
  const rechts = `<span class="rechts lig-knoppen">${k.knoppen}${k.volgende ? `<button type="button" class="knop knop-licht" data-volgende>${esc(t('inr.volgende'))}</button>` : ''}</span>`;
  return {
    waar: waarVan('ligging'),
    kop: k.kop,
    uitleg: k.uitleg,
    inhoud: `<div class="rijen">${k.inhoud}</div>`,
    voet: [ligStaat.aanpassen ? '' : `<button type="button" class="zachtknop" data-terug>${esc(t('w.terug'))}</button>`, rechts],
  };
}
