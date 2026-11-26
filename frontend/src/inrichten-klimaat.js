/*
 * Deel van inrichten.js (opgesplitst op 22 november 2026): klimaat. Een gewoon script dat na
 * inrichten-huis.js laadt en zijn bovenste namen deelt met de andere delen van de pagina.
 */
'use strict';
/* global binnen, concept, d, esc, klimaatIn, knop, lijstje, nl, rolKnoppen, rolVan, sleutel, waarVan */
/* exported antwoorden, kanBereik, kanOpen, kanStap, kanToestellen, kanVraagOpen */

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
  else if (h.zegtActie) punt('ok', t('inr.kan.zegt'), k.actie ? t('inr.kan.zegtNu', { actie: k.actie }) : '');
  else if (meter) punt('om', t('inr.kan.zegtNiet'), t('inr.kan.zegtNietMeter'));
  else punt('om', airco ? t('inr.kan.zegtNiet') : t('inr.kan.stooktNiet'), t('inr.kan.zegtNietTemp'));
  // De stroom.
  if (meter) punt('ok', t('inr.kan.meter'), k.vermogenW != null ? t('inr.kan.zegtNu', { actie: `${Math.round(k.vermogenW)} W` }) : '');
  else if (a.radiatorknop || warmte === 'cv' || isKetel(a)) punt('nee', t('inr.kan.meterNiet'), t('inr.kan.meterNietCv'));
  else if (airco) punt('om', t('inr.kan.geenMeter'), t('inr.kan.geenMeterAirco'));
  else if (warmte === 'elektrisch') punt('om', t('inr.kan.geenMeter'), t('inr.kan.geenMeterElektrisch'));
  // Filter en batterij.
  if (k.filter) punt('ok', t('inr.kan.filter'), k.filter.uren != null ? t('inr.kan.filterUren', { n: Math.round(k.filter.uren) }) : t('inr.kan.filterPct', { pct: Math.round(k.filter.pct) }));
  if (a.batterijPct != null) punt(app.bijnaOp(a.batterijPct, 'batterij', d.huis) ? 'om' : 'ok', t('inr.kan.batterij'), t('inr.kan.batterijZin', { pct: Math.round(a.batterijPct) }));
  // Meet hij de kamer?
  const temp = a.meting?.temperatuurC;
  if (temp == null) punt('om', t('inr.kan.meetNiet'), t('inr.kan.meetNietZin', { kamer: r.naam }), `<div class="chips"><a class="chip" href="comfort.html#meten">${esc(t('inr.kan.naarMeten'))}</a></div>`);
  else if (a.radiatorknop) punt('om', t('inr.kan.meetRadiator'), t('inr.kan.meetRadiatorZin', { c: graden(temp) }));
  else punt('ok', t('inr.kan.meet'), t('inr.kan.zegtNu', { actie: `${graden(temp)}°` }));
  // Wat verwarmt hij? Alleen als hij het niet zegt.
  if (vraagtWarmte(a)) {
    const chips = ['cv', 'elektrisch', 'weetniet'].map((w) => knop(`data-kan-warmte="${esc(sleutel(a))}" data-waarde="${w}"`, t(`inr.kan.warmte.${w}`), warmte === w)).join('');
    punt(warmte ? 'ok' : 'vraag', t('inr.kan.watWarmt'), t('inr.kan.watWarmtZin'), `<div class="chips">${chips}</div>`);
  }
  // Goed om te weten: hij staat er twee keer in (de LG's vaak).
  const weet = h.tweede ? t('inr.kan.tweemaal', { een: koppelingNaam(h.koppeling), twee: koppelingNaam(h.tweede.koppeling) }) : '';
  const omwegen = p.filter((x) => x.soort === 'om').length;
  const vragen = p.filter((x) => x.soort === 'vraag').length;
  const rol = rolVan(concept()?.kamers.find((x) => x.id === r.id), r, sleutel(a));
  const stand = ir ? ['beperkt', t('inr.kan.irNiets')] : vragen ? ['om', t('inr.kan.st.vragen', { n: vragen })] : rol === 'kijken' ? ['mee', t('inr.kan.st.mee')] : omwegen ? ['ok', t('inr.kan.st.omwegen', { n: omwegen })] : ['ok', t('inr.kan.st.helemaal')];
  return { punten: p, weet, stand, rol, ir, vragen };
}

function kanStap() {
  const lijst = kanToestellen();
  if (!lijst.length) return { waar: waarVan('apparaat'), kop: t('inr.kan.kop'), inhoud: `<p class="zacht">${esc(t('inr.kan.geen'))}</p>` };
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
  const lijstHtml = `<div class="klijst">${al.map(rij).join('')}<a class="kmist" href="jehuis.html#bg/apparaten">${esc(t('inr.kan.mist'))}</a><p class="ksamen">${esc(samen)}</p></div>`;
  const open = al.find((x) => sleutel(x.a) === kanOpen);
  return {
    waar: waarVan('apparaat'),
    kop: t('inr.kan.kop'),
    inhoud: app.telStand() ? lijstHtml : `<div class="kanstap">${lijstHtml}${open ? los(open) : ''}</div>`,
  };
}

/** De antwoorden van Energie en Klimaat (api/aansluiting), met wat er nog niet is als null. */
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
