/*
 * Deel van inrichten.js (opgesplitst op 22 november 2026): klimaat. Een gewoon script dat na
 * inrichten-huis.js laadt en zijn bovenste namen deelt met de andere delen van de pagina.
 */
'use strict';
/* global bewaarAansluiting, binnen, concept, d, dakVoorstelStap, energieNu, esc, klimaatIn, knop, lijstje, nl, regel, rij, rolKnoppen, rolVan, schakelaar, sleutel, stuur, teken, tip, waarVan */
/* exported afwezigBasis, afwezigKeuze, afwezigStap, antwoorden, bewaarAfwezig, bewaarDag, bewaarKamers, bewaarKort, cfDoel, cfKeuze, cfNu, comfortStap, dagBalk, dagGreep, dagKeuze, dagMet, dagMoment, dagNu, dagStap, dagUur, huisDoel, kanBereik, kanOpen, kanStap, kanToestellen, kanVraagOpen, ligStaat, liggingStap, opzonStap, standaard, zetCf, zonStap */

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
/** Wat de meeste kamers zeggen, of een gewone waarde. */
function meest(lijst, anders) {
  const tel = new Map();
  for (const v of lijst) if (v != null) tel.set(v, (tel.get(v) ?? 0) + 1);
  return [...tel.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? anders;
}

/*
 * Je dag (schets Wand-Inrichten-Comfort #dag): de drie
 * grenzen van de dag in een eigen stap, vóór hoe warm. Een balk van 24 uur
 * met een greep per grens, en per grens een regel met − en +. De lucht boven
 * het huis volgt de grens die je het laatst bewoog; bij voorverwarmen gloeien
 * de kamers die meedoen.
 */
const GRENZEN = ['voorverwarmen', 'dag', 'nacht'];
let dagKeuze = null;
let dagGreep = null;
const dagNu = () => dagKeuze ?? { ...standaard().dagdelen, ...(d.comfort?.dagdelen ?? {}) };
const uurTekst = (u) => `${u}:00`;
const grensNaam = (g) => (g === 'voorverwarmen' ? t('inr.dag.voor') : t(`comfort.naam.${g}`));
/** Binnen wat de dienst aanneemt: voorverwarmen vóór de dag, de dag vóór de nacht. */
function dagMet(dg, grens, u) {
  const n = { ...dg };
  if (grens === 'voorverwarmen') n.voorverwarmen = Math.min(Math.max(u, 0), n.dag - 1);
  if (grens === 'dag') n.dag = Math.min(Math.max(u, n.voorverwarmen + 1), n.nacht - 1);
  if (grens === 'nacht') n.nacht = Math.min(Math.max(u, n.dag + 1), 23);
  return n;
}
/** Welk uur de tekening laat zien: net na de grens die je het laatst bewoog. */
function dagUur() {
  const dg = dagNu();
  return (dagGreep ? dg[dagGreep] : dg.voorverwarmen) + 0.5;
}
/** De lucht en het dagdeel bij een uur van Je dag. */
function dagMoment(u) {
  const dg = dagNu();
  const tijd = u < dg.voorverwarmen || u >= dg.nacht ? 'nacht' : u < dg.dag + 1.5 ? 'ochtend' : u >= dg.nacht - 2.5 ? 'avond' : 'dag';
  return { tijd, voor: u >= dg.voorverwarmen && u < dg.dag, deel: u >= dg.voorverwarmen && u < dg.nacht ? 'dag' : 'nacht' };
}
function dagBalk() {
  const dg = dagNu();
  const pct = (u) => `${((u / 24) * 100).toFixed(2)}%`;
  const op = dagMoment(dagUur()).deel;
  const stuk = (soort, a, b, naam, deel) => `<button type="button" class="dg-stuk ${soort}${deel === op ? ' op' : ''}" data-dg-deel="${deel}" style="width: ${pct(b - a)}" tabindex="-1">${naam ? esc(naam) : ''}</button>`;
  const grepen = GRENZEN.map((g) => `<button type="button" class="dg-greep ${g}${dagGreep === g ? ' nu' : ''}" data-dg-greep="${g}" style="left: ${pct(dg[g])}" aria-label="${esc(t('inr.dag.greep', { naam: grensNaam(g), uur: uurTekst(dg[g]) }))}"><b>${uurTekst(dg[g])}</b></button>`).join('');
  return `<div class="dg-kop"><b>${esc(t('inr.stap.dag'))}</b><span>${esc(t('inr.dag.samen', { dag: dg.nacht - dg.dag, nacht: 24 - dg.nacht + dg.voorverwarmen }))}</span></div>
    <div class="dg-balk">${stuk('nacht', 0, dg.voorverwarmen, t('comfort.naam.nacht'), 'nacht')}${stuk('voor', dg.voorverwarmen, dg.dag, '', 'dag')}${stuk('dag', dg.dag, dg.nacht, t('comfort.naam.dag'), 'dag')}${stuk('nacht', dg.nacht, 24, '', 'nacht')}</div>
    <div class="dg-grepen" data-dg-grepen>${grepen}</div>`;
}
function dagStap() {
  const dg = dagNu();
  const ZIN = { voorverwarmen: t('inr.dag.voorZin', { uur: uurTekst(dg.dag) }), dag: t('inr.dag.dagZin'), nacht: t('inr.dag.nachtZin', { uur: uurTekst(dg.voorverwarmen) }) };
  const regels = GRENZEN.map((g) => {
    const naam = grensNaam(g);
    const stapper = `<span class="stapper"><button type="button" data-dg="${g}:-1" aria-label="${esc(t('inr.dag.eerder', { naam }))}">−</button><b>${uurTekst(dg[g])}</b><button type="button" data-dg="${g}:1" aria-label="${esc(t('inr.dag.later', { naam }))}">+</button></span>`;
    return `<div class="dg-grens ${g}${dagGreep === g ? ' nu' : ''}"><i aria-hidden="true"></i><div><b>${esc(naam)}</b><span>${esc(ZIN[g])}</span></div>${stapper}</div>`;
  }).join('');
  return {
    waar: waarVan('dag'),
    kop: t('inr.dag.kop'),
    uitleg: t('inr.dag.zin'),
    inhoud: `<div class="dg">${dagBalk()}</div><div class="dg-lijst">${regels}</div>${tip(t('inr.dag.tip'))}`,
  };
}
/** Je dag bewaren: een uur verzet gaat meteen naar de dienst. */
async function bewaarDag(dg) {
  dagKeuze = dg;
  if (!d.comfort?.kamers?.length) return teken();
  const ok = await bewaarKamers(new Map(), dg);
  if (ok) dagKeuze = null;
}

/*
 * Hoe warm wil je het (schets Wand-Inrichten-Comfort): per
 * kamer overdag en 's nachts, elk verwarmen en koelen, en elk getal is aan te
 * tikken. Het hele huis is de bovenste regel: wat de meeste kamers hebben.
 * Een kamer volgt het huis zolang hij dat getal heeft; verander je het huis,
 * dan gaan de kamers die volgen mee. Een eigen getal krijgt een stip.
 */
const DELEN = ['dag', 'nacht'];
let cfKeuze = null;
const kanSoort = (k, soort) => (soort === 'heat' ? k.kanVerwarmen : k.kanKoelen);
/** Het doel van een kamer; null is uit, undefined kan niet. */
const kamerDoel = (k, deel, soort) => (kanSoort(k, soort) ? (k.modi?.[deel]?.[soort] ?? null) : undefined);
/** Het getal van het huis: wat de meeste kamers hebben die het kunnen, ook als dat uit is. */
function huisDoel(deel, soort) {
  const lijst = (d.comfort?.kamers ?? []).filter((k) => kanSoort(k, soort)).map((k) => kamerDoel(k, deel, soort));
  if (!lijst.length) return undefined;
  const tel = new Map();
  for (const v of lijst) tel.set(v, (tel.get(v) ?? 0) + 1);
  return [...tel.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
const cfDoel = (id, deel, soort) => (id === 'huis' ? huisDoel(deel, soort) : kamerDoel(d.comfort.kamers.find((k) => k.id === id), deel, soort));
const volgtHuis = (k, deel, soort) => !kanSoort(k, soort) || kamerDoel(k, deel, soort) === huisDoel(deel, soort);
const heeftEigen = (k) => DELEN.some((deel) => ['heat', 'cool'].some((s) => !volgtHuis(k, deel, s)));
const graden = (v) => (v == null ? t('w.uit2') : `${nl(v)}°`);
function cfNu() {
  const kamers = d.comfort?.kamers ?? [];
  const k = cfKeuze && kamers.some((x) => x.id === cfKeuze.kamer || cfKeuze.kamer === 'huis') && cfDoel(cfKeuze.kamer, cfKeuze.deel, cfKeuze.soort) !== undefined ? cfKeuze : null;
  return k ?? { kamer: 'huis', deel: 'dag', soort: kamers.some((x) => x.kanVerwarmen) ? 'heat' : 'cool' };
}
function comfortStap() {
  if (!d.comfort?.kamers?.length) {
    return { waar: waarVan('comfort'), kop: t('inr.comfortKop'), uitleg: t('inr.comfortLater'), inhoud: '' };
  }
  const kamers = d.comfort.kamers;
  const soorten = [...(kamers.some((k) => k.kanVerwarmen) ? ['heat'] : []), ...(kamers.some((k) => k.kanKoelen) ? ['cool'] : [])];
  const sel = cfNu();
  const dg = dagNu();
  const deelNaam = { dag: t('w.overdag'), nacht: t('inr.cf.snachts') };
  const wat = (deel, soort) => t(soort === 'heat' ? 'inr.cf.onder' : 'inr.cf.boven', { deel: deelNaam[deel] });
  const tal = (id, naam, deel, soort) => {
    const v = cfDoel(id, deel, soort);
    if (v === undefined) return '<span class="cf-tal niet" aria-hidden="true">–</span>';
    const k = id === 'huis' ? null : kamers.find((x) => x.id === id);
    const gekozen = sel.kamer === id && sel.deel === deel && sel.soort === soort;
    const volgt = k && volgtHuis(k, deel, soort);
    return `<button type="button" class="cf-tal ${v == null ? 'uit' : soort}${volgt ? ' volgt' : ''}${gekozen ? ' gekozen' : ''}" data-cf="${esc(id)}|${deel}|${soort}" aria-pressed="${gekozen}" aria-label="${esc(t('inr.cf.tal', { kamer: naam, wat: wat(deel, soort), waarde: graden(v) }))}">${esc(graden(v))}</button>`;
  };
  const paren = (id, naam, klasse = '') => DELEN.map((deel) => `<div class="cf-paar${klasse}">${soorten.map((s) => tal(id, naam, deel, s)).join('')}</div>`).join('');
  const volgers = kamers.filter((k) => !heeftEigen(k)).length;
  const telVolgers = (n, m) => (n === m ? t('inr.cf.allen') : t('inr.cf.deel', { n, m }));
  const kop = DELEN.map((deel) => `<button type="button" class="cf-kolkop${sel.deel === deel ? ' aan' : ''}" data-cf-deel="${deel}">${esc(t(`comfort.naam.${deel}`))}<em>${deel === 'dag' ? `${dg.dag}–${dg.nacht}` : `${dg.nacht}–${dg.voorverwarmen}`}</em><small>${soorten.map((s) => `<span class="${s}">${esc(t(s === 'heat' ? 'inr.cf.verwarmen' : 'inr.cf.koelen'))}</span>`).join('')}</small></button>`).join('');
  const huisRij = `<div class="cf-naam huis"><b>${esc(t('w.hetHeleHuis'))}</b><span>${esc(telVolgers(volgers, kamers.length))}</span></div>${paren('huis', t('w.hetHeleHuis'), ' huis')}`;
  const kamerRijen = kamers.map((k) => {
    const eigen = heeftEigen(k);
    const sub = eigen ? t('inr.cf.eigen') : k.kanVerwarmen && k.kanKoelen ? t('inr.cf.beide') : k.kanKoelen ? t('w.koelt') : t('w.verwarmt');
    return `<div class="cf-naam${eigen ? ' eigen' : ''}"><b>${esc(k.naam)}</b><span>${esc(sub)}</span></div>${paren(k.id, k.naam)}`;
  }).join('');
  // Eén regel past het gekozen getal aan, met Uit en Zoals het huis.
  const v = cfDoel(sel.kamer, sel.deel, sel.soort);
  const k = sel.kamer === 'huis' ? null : kamers.find((x) => x.id === sel.kamer);
  const kunnen = kamers.filter((x) => kanSoort(x, sel.soort));
  const onder = !k
    ? `<small>${esc(telVolgers(kunnen.filter((x) => volgtHuis(x, sel.deel, sel.soort)).length, kunnen.length))}</small>`
    : volgtHuis(k, sel.deel, sel.soort)
      ? `<small>${esc(t('inr.cf.volgt'))}</small>`
      : `<button type="button" class="chip" data-cf-huis>${esc(t('inr.cf.zoalsHuis', { waarde: graden(huisDoel(sel.deel, sel.soort)) }))}</button>`;
  const bewerk = `<div class="cf-bewerk"><div><b>${esc(k ? k.naam : t('w.hetHeleHuis'))}</b><span>${esc(wat(sel.deel, sel.soort))}</span></div>
    <span class="stapper"><button type="button" data-cf-stap="-0.5" aria-label="${esc(t('comfort.lager'))}">−</button><b class="${v == null ? 'uit' : sel.soort}">${esc(graden(v))}</b><button type="button" data-cf-stap="0.5" aria-label="${esc(t('comfort.hoger'))}">+</button></span>
    <div class="cf-keuzes">${knop('data-cf-uit', t('w.uit'), v == null)}${onder}</div></div>`;
  return {
    waar: waarVan('comfort'),
    kop: t('inr.comfortKop'),
    uitleg: t('inr.comfortZin'),
    inhoud: `<div class="cf-tabel${soorten.length === 1 ? ' een' : ''}"><span></span>${kop}${huisRij}${kamerRijen}</div>${bewerk}<p class="cf-noot">${esc(t('inr.cf.noot'))}</p>`,
  };
}
/** Binnen wat de apparaten van een kamer kunnen: anders weigert de dienst het hele comfort. */
const haalbaarIn = (k, soort, v) => {
  const r = k.haalbaar?.[soort === 'heat' ? 'verwarmen' : 'koelen'];
  return v == null || !r ? v : Math.min(r[1], Math.max(r[0], v));
};
/** Een doel voor een kamer: binnen wat hij kan, en minstens een graad tussen verwarmen en koelen. */
function doelVoor(k, modi, deel, soort, v) {
  if (v == null) return null;
  let w = haalbaarIn(k, soort, v);
  const ander = modi[deel]?.[soort === 'heat' ? 'cool' : 'heat'];
  if (ander != null) w = soort === 'heat' ? Math.min(w, ander - 1) : Math.max(w, ander + 1);
  return w;
}
/** Zet een doel: voor één kamer, of voor het huis en de kamers die het volgen. */
async function zetCf(sel, v) {
  const oud = huisDoel(sel.deel, sel.soort);
  const nieuw = new Map();
  for (const k of d.comfort.kamers) {
    if (!kanSoort(k, sel.soort)) continue;
    if (sel.kamer === 'huis' ? kamerDoel(k, sel.deel, sel.soort) !== oud : k.id !== sel.kamer) continue;
    const modi = { ...k.modi, [sel.deel]: { ...k.modi[sel.deel] } };
    modi[sel.deel][sel.soort] = doelVoor(k, modi, sel.deel, sel.soort, v);
    nieuw.set(k.id, modi);
  }
  return bewaarKamers(nieuw);
}
/** Bewaar comfort: de kamers die veranderden, en de rest zoals ze zijn; met de dagdelen. */
async function bewaarKamers(nieuw, dagdelen = null) {
  const kamers = Object.fromEntries(d.comfort.kamers.map((k) => [k.id, { modi: nieuw.get(k.id) ?? k.modi, nooitWarmerC: k.nooitWarmerC, voorrang: k.voorrang, opZonC: k.opZonC }]));
  const body = { kamers, dagdelen: { ...standaard().dagdelen, ...(d.comfort.dagdelen ?? {}), ...(dagdelen ?? {}) }, ...(d.comfort.voorrang ? { voorrang: { koelen: d.comfort.voorrang.koelen, verwarmen: d.comfort.voorrang.verwarmen } } : {}) };
  const uit = await stuur('api/comfort', body);
  if (uit) d.comfort = uit;
  teken();
  return !!uit;
}

/*
 * Afwezig en vakantie (besluit 190): voor het hele huis, zoals comfort. Het
 * huis ziet aan de bewoners dat niemand thuis is; vakantie zet je zelf aan.
 */
let afwezigKeuze = null;
function afwezigBasis() {
  const kamers = d.comfort?.kamers ?? [];
  const w = (m, s, anders) => meest(kamers.filter((k) => (s === 'heat' ? k.kanVerwarmen : k.kanKoelen)).map((k) => k.modi[m]?.[s]), anders);
  const s = standaard();
  return { afwezig: { heat: w('afwezig', 'heat', s.warm.afwezig), cool: w('afwezig', 'cool', s.koel.afwezig) }, vakantie: { heat: w('vakantie', 'heat', s.warm.vakantie), cool: w('vakantie', 'cool', s.koel.vakantie) } };
}
function afwezigStap() {
  if (!d.comfort?.kamers?.length) return { waar: waarVan('afwezig'), kop: t('w.alsNiemandThuisIs2'), uitleg: t('inr.comfortLater'), inhoud: '' };
  const b = afwezigKeuze ?? afwezigBasis();
  const warm = d.comfort.kamers.some((k) => k.kanVerwarmen);
  const koelen = d.comfort.kamers.some((k) => k.kanKoelen);
  const stapper = (m, s) => `<span class="stapper"><button type="button" data-afw="${m}:${s}:-0.5" aria-label="${esc(t('comfort.lager'))}">−</button><b>${nl(b[m][s])}°</b><button type="button" data-afw="${m}:${s}:0.5" aria-label="${esc(t('comfort.hoger'))}">+</button></span>`;
  const rijen = [
    warm ? regel({ ik: 'huis', titel: t('inr.afw.weg'), zin: t('inr.afw.wegZin'), rechts: stapper('afwezig', 'heat') }) : '',
    koelen ? regel({ ik: 'huis', titel: t('inr.afw.wegKoel'), zin: t('inr.afw.koelZin'), rechts: stapper('afwezig', 'cool') }) : '',
    warm ? regel({ ik: 'koffer', titel: t('inr.afw.vakantie'), zin: t('inr.afw.vakantieZin'), rechts: stapper('vakantie', 'heat') }) : '',
    koelen ? regel({ ik: 'koffer', titel: t('inr.afw.vakantieKoel'), zin: t('inr.afw.koelZin'), rechts: stapper('vakantie', 'cool') }) : '',
  ];
  return {
    waar: waarVan('afwezig'),
    kop: t('w.alsNiemandThuisIs2'),
    uitleg: t('inr.afw.zin'),
    inhoud: `<div class="rijen lijst">${rijen.join('')}</div>${tip(t('inr.afw.tip'))}`,
  };
}
async function bewaarAfwezig() {
  const b = afwezigKeuze ?? afwezigBasis();
  const kamers = Object.fromEntries(d.comfort.kamers.map((k) => {
    const paar = (m) => ({ heat: k.kanVerwarmen ? haalbaarIn(k, 'heat', b[m].heat) : null, cool: k.kanKoelen ? haalbaarIn(k, 'cool', b[m].cool) : null });
    return [k.id, { modi: { ...k.modi, afwezig: paar('afwezig'), vakantie: paar('vakantie') }, nooitWarmerC: k.nooitWarmerC, voorrang: k.voorrang, opZonC: k.opZonC }];
  }));
  const body = { kamers, dagdelen: { ...(d.comfort.dagdelen ?? {}) }, ...(d.comfort.voorrang ? { voorrang: { koelen: d.comfort.voorrang.koelen, verwarmen: d.comfort.voorrang.verwarmen } } : {}) };
  const uit = await stuur('api/comfort', body);
  if (uit) {
    d.comfort = uit;
    afwezigKeuze = null;
  }
  teken();
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
 * Wat mag er op zon? (besluit 167 en 190): elk apparaat dat kan wachten tot er
 * zon over is, met een schakelaar, ook de boiler en de jacuzzi. Eerst kijkt
 * het mee (de schrijfgrens). Onderaan de aansluiting zoals gevonden.
 */
const OPZON_IK = { droger: 'droger', wasmachine: 'droger', vaatwasser: 'vaat', boiler: 'boiler', jacuzzi: 'jacuzzi', auto: 'laadpaal', laadpaal: 'laadpaal' };
function opzonStap() {
  const x = d.aans;
  if (!x) return { waar: waarVan('opzon'), kop: t('inr.opzon.kop'), uitleg: t('inr.opzon.zin'), inhoud: `<p class="zacht">${esc(t('inr.lezen'))}</p>` };
  const a = antwoorden();
  const vast = new Set((x.configuratie?.apparaten ?? []).map((y) => y.id));
  // Het icoon bij de soort, of anders bij de naam.
  const icoon = (y) => OPZON_IK[y.soort] ?? (/droog|droger|dryer|was/i.test(y.naam) ? 'droger' : /vaat|dish/i.test(y.naam) ? 'vaat' : 'stekker');
  const een = (y, aan, attr) => regel({ ik: icoon(y), titel: y.naam, zin: t(aan ? 'regeling.startZon' : 'regeling.startNiet'), rechts: schakelaar(attr, t('regeling.naamOpZon', { naam: y.naam }), aan) });
  const rijen = [
    ...(x.configuratie?.apparaten ?? []).map((y) => een(y, !a.opZonUit.includes(y.id), `data-opzon-vast="${esc(y.id)}"`)),
    ...(x.gevonden?.apparaten ?? []).filter((y) => !vast.has(y.id)).map((y) => een(y, a.opZon[y.id] === true, `data-opzon="${esc(y.id)}"`)),
  ];
  const meer = regel({ tag: 'a', attrs: 'href="huis-kan.html"', ik: 'accu', titel: t('inr.opzon.meer'), zin: t('inr.opzon.meerZin'), rechts: '›', klasse: 'uit' });
  const zek = a.zekering && a.zekering !== 'weetniet' ? `${a.zekering.fasen} × ${a.zekering.ampere} A` : null;
  const p1 = (energieNu()?.net?.afname ?? []).length > 0;
  const aansluiting = zek || p1 ? rij(t('inr.jeAansluiting'), `${zek ? `<span class="chip gevonden">${esc(zek)}</span>` : ''}${p1 ? `<span class="chip gevonden">${esc(t('inr.slimmeMeter'))}</span>` : ''}`) : '';
  return {
    waar: waarVan('opzon'),
    kop: t('inr.opzon.kop'),
    uitleg: t('inr.opzon.zin'),
    inhoud: `<div class="rijen lijst">${rijen.join('') || `<p class="zacht">${esc(t('regeling.geenApparaten'))}</p>`}${meer}</div>${aansluiting}`,
  };
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
