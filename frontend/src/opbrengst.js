/*
 * Opbrengst, in ontwerp 2 (besluit 104; schetsen Wand-Opbrengst en Opbrengst).
 * De dienst rekent alles uit (`api/opbrengst`, besluit 102); deze pagina tekent
 * het: wat er van je eigen dak kwam, de kosten, de sankey op schaal, per
 * apparaat en per dag.
 *
 * Eerlijk: "wat SunArc scheelde" staat er pas als het huis zelf
 * schakelt (stap B); in de schaduw valt er niets te schelen. Een lopende
 * periode heet niet "76% minder" dan een volle: de vorige staat er als getal.
 */
'use strict';

const { $$, nl, esc, haal, zet } = app;
// De teksten staan in kit/teksten.*.js (besluit 185). De namen van de periodes komen nog van de dienst.
const { t } = taal;

const keuze = { soort: 'maand', datum: null };
let data = null;
let melding = null;
let zon = null;
/** Per dak (besluit 254, stap 5): de vlakken van deze periode, en of Per dak aan staat. */
let daken = null;
let perDak = false;

const getal = (n) => nl(n, Math.abs(n) >= 100 ? 0 : 1);
/** Een meternaam zoals de bewoner hem zegt: "Airco woonkamer", niet "Airconditioning woonkamer". */
const kort = (naam) => String(naam).replace(/^airconditioning\b/i, t('vandaag.airco')).replace(/\s+(energie|energy|verbruik|kwh)$/i, '');
/** Bij Jaar in hele euro's (Ricardo, 8 november 2026): met centen paste het bedrag niet in zijn vak. */
const euro = (n) => `${taal.valuta()} ${nl(n, keuze.soort === 'jaar' ? 0 : 2)}`;
const ZON = '#F7B548';
const NET = '#9AAABB';
/** Zoveel apparaten met hun naam in het stroombeeld; meer gaan samen onder Overig. */
const MAX_APPARATEN = 6;
const TERUG = '#6EE7B7';
/** De thuisaccu (besluit 272): ijsblauw, zoals de lijn uit de batterij in de tekening. */
const ACCU = '#6FD3FF';
const KLEUREN = ['#6FD3FF', '#8FD9FF', '#FFB088', '#C4BCFF', '#9EE6FF', '#FFD08A'];

/** Het sluipverbruik (besluit 192): een kaart naar zijn eigen scherm, met vannacht erop. */
let sluip = null;
const sluipIngang = () => (sluip
  ? `<a class="glas kaart sluipingang" href="sluipverbruik.html"><div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px"><h2 class="kop-3">${esc(t('sluip.titel'))}</h2><span class="getal" style="font-size: 22px${sluip.hoog ? '; color: var(--gloed-t)' : ''}">${nl(sluip.vannacht.w, 0)} W</span></div><p class="klein" style="margin: 6px 0 0">${esc(sluip.hoog ? t('sluip.ingangHoog', { boven: nl(sluip.bovenW, 0) }) : sluip.vaak ? t('sluip.ingangVaak', { n: sluip.vaak.nachten, meer: nl(sluip.vaak.meerW, 0) }) : t('sluip.ingangGewoon', { gewoon: nl(sluip.gewoonW, 0) }))} ›</p></a>`
  : '');

async function laad() {
  // Nu (5 november 2026): live, uit de meters van dit moment.
  if (keuze.soort === 'nu') return laadNu();
  const q = new URLSearchParams({ soort: keuze.soort, ...(keuze.datum ? { datum: keuze.datum } : {}) });
  try {
    const res = await fetch(`api/opbrengst?${q}`, { cache: 'no-store', headers: { 'x-taal': taal.code } });
    const body = await res.json();
    if (res.status === 409) {
      data = null;
      melding = 'meters';
    } else if (!res.ok) {
      data = null;
      melding = body.fout ?? body.wachten ?? t('opbrengst.nietBeschikbaar');
    } else {
      data = body;
      melding = null;
    }
  } catch {
    data = null;
    melding = t('kamer.geenVerbinding');
  }
  teken();
  // Per dak (besluit 254, stap 5): dezelfde periode, los; zonder daken blijft het leeg.
  haal(`api/opbrengst/daken?${q}`).then((x) => {
    daken = x;
    teken();
  }).catch(() => {
    daken = null;
  });
}

/* ------------------------------------------------------------ de delen */

/** Panelen zonder slimme meter (besluit 196): zelf gebruikt en terug zijn geschat. */
const geschatLabel = () => `<span class="geschat">${esc(t('opbrengst.geschat'))}</span>`;

function titel(r) {
  if (r.geschat && r.zon) return t('opbrengst.panelenLeverden', { kwh: getal(r.zon.opgewektKwh) });
  if (r.heeft.zon && r.stroom.eigenZonPct != null) return t('opbrengst.eigenPanelen', { pct: r.stroom.eigenZonPct });
  return t('opbrengst.gebruikte', { kwh: getal(r.stroom.verbruikKwh) });
}

/** "2025-02-05" wordt "5 februari 2025", in de taal van de app. */
const datumNl = (iso) => taal.datum(new Date(`${iso}T12:00:00Z`), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function periode(r) {
  const p = r.periode;
  // Begint de meting later dan de periode, dan zegt de regel dat eerst.
  const vorige = r.dekking
    ? `<span class="mini" style="margin-left: 6px" data-dekking>${esc(t('opbrengst.gemetenVanaf', { datum: datumNl(r.dekking.vanaf), dagen: r.dekking.dagen, van: r.dekking.vanDagen }))}</span>`
    : r.geschat ? `<span class="mini" style="margin-left: 6px">${esc(t('opbrengst.zelfGeschat'))}</span>`
    : r.stroom.vorigeKwh != null ? `<span class="mini" style="margin-left: 6px">${esc(t('opbrengst.vorigeGebruikt', { naam: p.vorigeNaam, kwh: getal(r.stroom.vorigeKwh) }))}</span>` : '';
  return `<button type="button" aria-label="${esc(t('vandaag.eerder'))}" data-naar="${esc(p.vorige)}">‹</button><span class="kop-3" style="font-size: 17px">${esc(p.label)}</span><button type="button" aria-label="${esc(t('vandaag.later'))}" ${p.volgende ? `data-naar="${esc(p.volgende)}"` : 'disabled'}>›</button>${vorige}`;
}

/** Panelen zonder slimme meter (besluit 196): opgewekt is gemeten, zelf gebruikt en bespaard geschat. */
function cijfersGeschat(r, klein) {
  const z = r.zon;
  const bespaard = z.bespaardEuro == null ? null : `± ${euro(z.bespaardEuro)}`;
  const gas = r.gas ? `<div class="cijfer"><div class="mini">${esc(t('opbrengst.gas'))}</div><div class="getal">${getal(r.gas.m3)}<small>m³</small></div></div>` : '';
  if (klein) {
    const blok = (naam, waarde, onder) => `<div class="glas-klein"><span class="mini">${naam}</span><span class="getal">${waarde}</span><span class="mini">${onder}</span></div>`;
    return `<div class="drie">${blok(esc(t('opbrengst.opgewekt')), getal(z.opgewektKwh), 'kWh')}${blok(esc(t('opbrengst.zelfGebruikt')), `± ${getal(z.zelfKwh)}`, `kWh, ${esc(t('opbrengst.geschat'))}`)}${bespaard ? blok(esc(t('opbrengst.bespaard')), `± ${taal.valuta()} ${nl(z.bespaardEuro, 0)}`, esc(t('opbrengst.geschat'))) : ''}</div>`;
  }
  return `<div class="cijfer"><div class="mini">${esc(t('opbrengst.opgewekt'))}</div><div class="getal">${getal(z.opgewektKwh)}<small>kWh</small></div><div class="klein">${esc(t('opbrengst.gemetenOmvormer'))}</div></div>
    <div class="cijfer"><div class="mini">${esc(t('opbrengst.zelfGebruikt'))}</div><div class="getal">± ${getal(z.zelfKwh)}<small>kWh</small></div><div class="klein">${geschatLabel()}</div></div>
    ${bespaard ? `<div class="cijfer"><div class="mini">${esc(t('opbrengst.bespaard'))}</div><div class="getal">${bespaard}</div><div class="klein">${esc(t('opbrengst.bespaardOnder'))}</div></div>` : ''}${gas}`;
}

/** Een kaart die een slimme meter aanraadt, of panelen (besluit 196). */
function erbijKaart(r) {
  if (r.geschat) return `<section class="glas kaart meterkaart"><h2 class="kop-3">${esc(t('opbrengst.meter.titel'))}</h2><p class="klein" style="margin: 6px 0 12px">${esc(t('opbrengst.meter.zin'))}</p><a class="pil" href="energie.html#meters">${esc(t('opbrengst.meter.knop'))}</a></section>`;
  if (!r.heeft.zon) return `<section class="glas kaart"><h2 class="kop-3">${esc(t('opbrengst.panelenErbij.titel'))}</h2><p class="klein" style="margin: 6px 0 12px">${esc(t('opbrengst.panelenErbij.zin'))}</p><a class="pil" href="huis-kan.html">${esc(t('opbrengst.panelenErbij.knop'))}</a></section>`;
  return '';
}

function cijfers(r, klein = false) {
  if (r.geschat && r.zon) return cijfersGeschat(r, klein);
  const s = r.stroom;
  const k = r.kosten;
  const stroom = `<div class="cijfer"><div class="mini">${esc(t('opbrengst.stroomGebruikt'))}</div><div class="getal">${getal(s.verbruikKwh)}<small>kWh</small></div><div class="klein">${esc(r.heeft.zon ? t('opbrengst.vanNetRest', { kwh: getal(s.vanNetKwh) }) : t('opbrengst.vanNet'))}</div></div>`;
  const vast = k.regels.find((x) => x.soort === 'vast');
  // Wat zonder prijs als nul telt, staat erbij (issue 128): eerst stroom, teruglevering en gas, dan de vaste kosten.
  // Telde Home Assistant de kosten een deel van de tijd niet, dan is dat deel geschat (issue 128).
  const zonder = [...(k.geschat?.length ? [t('opbrengst.deelsGeschat')] : []), ...(k.zonderPrijs ?? []).map((x) => t(`opbrengst.zonder.${x}`)), ...(vast?.euro == null ? [t('opbrengst.zonderVast')] : [])];
  const kostenOnder = [r.dekking ? t('opbrengst.gemetenDagen', { n: r.dekking.dagen }) : k.vorige != null ? `${r.periode.vorigeNaam} ${euro(k.vorige)}` : '', ...zonder].filter(Boolean).join(', ');
  const kosten = k.totaal == null ? '' : `<div class="cijfer"><div class="mini">${esc(t('opbrengst.kosten'))}</div><div class="getal">${euro(k.totaal)}</div><div class="klein">${esc(kostenOnder)}</div></div>`;
  const gas = r.gas ? `<div class="cijfer"><div class="mini">${esc(t('opbrengst.gas'))}</div><div class="getal">${getal(r.gas.m3)}<small>m³</small></div><div class="klein">${r.gas.vorigeM3 != null ? `${esc(r.periode.vorigeNaam)} ${getal(r.gas.vorigeM3)} m³` : ''}</div></div>` : '';
  if (klein) {
    const blok = (naam, waarde, onder) => `<div class="glas-klein"><span class="mini">${naam}</span><span class="getal">${waarde}</span><span class="mini">${onder}</span></div>`;
    return `<div class="drie">${blok(esc(t('opbrengst.stroom')), getal(s.verbruikKwh), 'kWh')}${k.totaal == null ? '' : blok(esc(t('opbrengst.kosten')), `${taal.valuta()} ${nl(k.totaal, 0)}`, k.vorige != null ? `${esc(/^\d/.test(r.periode.vorigeNaam) ? r.periode.vorigeNaam : `${r.periode.vorigeNaam.slice(0, 4)}.`)} ${taal.valuta()} ${nl(k.vorige, 0)}` : '')}${r.gas ? blok(esc(t('opbrengst.gas')), getal(r.gas.m3), 'm³') : ''}</div>`;
  }
  return `${stroom}${kosten}${gas}`;
}

/**
 * De naam van een dakvlak (Ricardo, 5 november 2026), zoals bij Daken en
 * panelen: de eigen naam, of de plek; met meer vlakken op dezelfde plek de
 * richting erbij ("Hoofddak oost").
 */
const RICHTINGEN = ['n', 'no', 'o', 'zo', 'z', 'zw', 'w', 'nw'];
function dakNaam(v, alle) {
  if (v.naam) return v.naam;
  const plek = t(`daken.plek.${v.plek}`);
  if (v.azimuthDeg == null || !alle.some((x) => x.letter !== v.letter && x.plek === v.plek && !x.naam)) return plek;
  const kort = (d) => t(`panelen3.kort.${RICHTINGEN[Math.round((((d % 360) + 360) % 360) / 45) % 8]}`);
  const richting = v.opstelling === 'plat' ? t('daken.opstelling.plat') : v.opstelling === 'oostwest' ? `${kort(v.azimuthDeg)}-${kort(v.azimuthDeg + 180)}` : kort(v.azimuthDeg);
  return `${plek} ${richting.toLowerCase()}`;
}

/** De thuisaccu in deze periode (besluit 272): wat hij laadde, waarvan uit de zon, en wat hij leverde. */
function accuRegel(a) {
  if (!a || (a.geladenKwh < 0.1 && a.geleverdKwh < 0.1)) return '';
  return `<p class="mini accuregel" style="margin: 8px 0 0"><i style="background: ${ACCU}"></i>${esc(t('opbrengst.accu.regel', { geladen: getal(a.geladenKwh), zon: getal(a.uitZonKwh), geleverd: getal(a.geleverdKwh) }))}</p>`;
}

function panelen(r) {
  if (!r.zon || r.geschat) return '';
  const z = r.zon;
  const zelf = z.opgewektKwh > 0 ? (z.zelfKwh / z.opgewektKwh) * 100 : 0;
  // Samen of per dak (besluit 254, stap 5): bij meer dakvlakken.
  const vlakken = daken?.vlakken ?? [];
  const wissel = vlakken.length > 1 ? `<div class="blik" role="group" aria-label="${esc(t('opbrengst.daken.wissel'))}" style="margin-top: 8px"><button type="button" data-perdak="0" aria-pressed="${!perDak}">${esc(t('opbrengst.daken.samen'))}</button><button type="button" data-perdak="1" aria-pressed="${perDak}">${esc(t('opbrengst.daken.perDak'))}</button></div>` : '';
  if (perDak && vlakken.length > 1) {
    const top = Math.max(1, ...vlakken.map((v) => v.kWh));
    const achter = daken.achter?.letter;
    const rij = (v) => `<div class="dakrij"><span class="dakletter" style="background: ${achter === v.letter ? '#ff8a6b' : 'var(--zon)'}">${esc(v.letter)}</span><span class="daknaam">${esc(dakNaam(v, vlakken))}<span class="dakstaaf"><i style="width: ${((v.kWh / top) * 100).toFixed(1)}%; background: ${achter === v.letter ? '#ff8a6b' : 'var(--zon)'}"></i></span></span><b>${getal(v.kWh)} kWh<small>${esc(t('opbrengst.daken.perPaneel', { kwh: nl(v.aantal ? v.kWh / v.aantal : 0, 1) }))}</small></b></div>`;
    return `<section class="glas kaart">
    <div style="display: flex; justify-content: space-between; align-items: baseline"><h2 class="kop-3">${esc(t('opbrengst.panelen'))}</h2><span class="getal zon-t" style="font-size: 22px">${getal(z.opgewektKwh)} kWh</span></div>
    ${wissel}
    <div class="dakrijen">${vlakken.map(rij).join('')}</div>
    <p class="mini" style="margin: 8px 0 0">${esc(t('opbrengst.daken.uitleg'))}</p>
    ${daken.achter ? `<p class="dakopval">${esc(dakvlakken.achterZin(daken.achter))}</p>` : ''}
  </section>`;
  }
  return `<section class="glas kaart">
    <div style="display: flex; justify-content: space-between; align-items: baseline"><h2 class="kop-3">${esc(t('opbrengst.panelen'))}</h2><span class="getal zon-t" style="font-size: 22px">${getal(z.opgewektKwh)} kWh</span></div>
    ${wissel}
    <div class="verdeel" style="height: 10px; margin-top: 12px"><i style="width: ${zelf.toFixed(1)}%; background: var(--zon)"></i><i style="width: ${(100 - zelf).toFixed(1)}%; background: var(--mint)"></i></div>
    <div class="klein" style="margin-top: 8px; display: flex; justify-content: space-between"><span>${z.opgewektKwh > 0 ? taal.html('opbrengst.zelfPct', { kwh: getal(z.zelfKwh), pct: Math.round(zelf) }) : esc(t('opbrengst.zelf', { kwh: getal(z.zelfKwh) }))}</span><span>${esc(t('opbrengst.naarNet', { kwh: getal(z.terugKwh) }))}</span></div>
    ${z.besteDag ? `<p class="mini" style="margin: 8px 0 0">${esc(t('opbrengst.besteDag', { dag: z.besteDag.label, kwh: getal(z.besteDag.kwh) }))}</p>` : ''}
    ${accuRegel(r.accu)}
    ${verwachtRegel(r.verwacht, r.periode.soort)}
  </section>`;
}

/**
 * Verwacht naast echt (besluit 137): wat de dag ervoor werd verwacht, opgeteld
 * over de dagen van de periode waarvan het bewaard is.
 */
function verwachtRegel(v, soort) {
  if (!v || !(v.verwachtKwh > 0)) return '';
  const p = Math.round(((v.werkelijkKwh - v.verwachtKwh) / v.verwachtKwh) * 100);
  const af = p > 0 ? `+${p}%` : p < 0 ? `−${-p}%` : t('opbrengst.precies');
  const zin = t(soort === 'dag' ? 'opbrengst.verwachtDag' : 'opbrengst.verwachtDagen', { verwacht: getal(v.verwachtKwh), echt: getal(v.werkelijkKwh), af, n: v.dagen });
  return `<p class="mini" style="margin: 6px 0 0">${esc(zin)}</p>`;
}

/** De kleuren van de dakvlakken, zoals bij Per dak. */
const DAKKLEUR = ['#F7B548', '#F3D48A', '#D98C3A', '#FFC970'];

/** Wat een paar kostenregels samen zijn, of null zonder prijs. */
function kostenVan(r, soorten) {
  const l = r.kosten.regels.filter((x) => soorten.includes(x.soort) && x.euro != null);
  return l.length ? l.reduce((s, x) => s + x.euro, 0) : null;
}

/**
 * Altijd aan (sluipverbruik, besluit 192): het gewone verbruik 's nachts over
 * de uren van de periode, uit de rest van het huis. Een schatting: hooguit 90%
 * van de rest.
 */
function altijdAan(r) {
  const rest = r.apparaten.find((a) => a.rest);
  if (!sluip?.gewoonW || !rest || rest.kwh <= 0 || r.geschat) return null;
  const uren = Math.max(0, (Math.min(r.periode.totMs, Date.now()) - r.periode.vanMs) / 3_600_000);
  const kwh = Math.min(rest.kwh * 0.9, (sluip.gewoonW * uren) / 1000);
  return kwh > 0.05 ? { kwh, deel: kwh / rest.kwh } : null;
}

/**
 * Het stroombeeld (schets Wand-Opbrengst-Stromen, 5 november 2026): de zon per
 * dakvlak als die er zijn, het net met wat het kostte; rechts de apparaten, de
 * rest van het huis, Altijd aan en terug met wat het opbracht. Meer dan zes
 * apparaten: de kleinste samen onder Overig.
 */
function stroomModel(r) {
  let stroom = r.stromen.filter((s) => s.van !== 'gas' && s.kwh > 0.05);
  if (!stroom.length) return null;
  const altijd = altijdAan(r);
  if (altijd) stroom = stroom.flatMap((s) => (s.naar === 'rest' ? [{ ...s, kwh: s.kwh * (1 - altijd.deel) }, { ...s, naar: 'altijd', kwh: s.kwh * altijd.deel }] : [s]));
  const perDoel = new Map();
  for (const s of stroom) perDoel.set(s.naar, (perDoel.get(s.naar) ?? 0) + s.kwh);
  /*
   * Een apparaat met een eigen meter staat er met zijn naam, ook als het in
   * deze periode weinig gebruikte (Ricardo, 8 november 2026: de airco's en
   * stekkers stonden alleen bij Jaar; op een dag vielen ze onder de 2%). Pas
   * boven de zes gaan de kleinste samen onder Overig, zodat het leesbaar blijft.
   */
  const apparaten = [...perDoel].filter(([id]) => !['terug', 'rest', 'altijd', 'naarAccu'].includes(id)).sort((a, b) => b[1] - a[1]);
  const klein = new Set(apparaten.length > MAX_APPARATEN ? apparaten.slice(MAX_APPARATEN - 1).map(([id]) => id) : []);
  stroom = stroom.map((s) => (klein.has(s.naar) ? { ...s, naar: 'overig' } : s));
  // Het deel zon in wat uit de accu kwam (besluit 272): het deel zon in wat erin ging.
  const accuZon = r.accu?.geladenKwh > 0 ? r.accu.uitZonKwh / r.accu.geladenKwh : 1;
  // De zon per dakvlak, naar hun aandeel in deze periode (besluit 254).
  const vlakken = (daken?.vlakken ?? []).filter((v) => v.kWh > 0);
  const dakSom = vlakken.reduce((t, v) => t + v.kWh, 0);
  const zonDelen = vlakken.length > 1 && dakSom > 0 && !r.geschat
    ? vlakken.map((v, i) => ({ id: `dak-${v.letter}`, naam: `${v.letter} · ${dakNaam(v, daken?.vlakken ?? [])}`, deel: v.kWh / dakSom, kleur: DAKKLEUR[i % DAKKLEUR.length] }))
    : [{ id: 'zon', naam: t('vandaag.zon'), deel: 1, kleur: ZON }];
  const st = stroom.flatMap((s) => (s.van === 'zon' ? zonDelen.map((z) => ({ van: z.id, naar: s.naar, kwh: s.kwh * z.deel })) : [s]));
  const van = (id, kant) => st.filter((s) => s[kant] === id).reduce((t, s) => t + s.kwh, 0);
  const zonIn = (id) => st.filter((s) => s.naar === id && s.van !== 'net').reduce((t, s) => t + s.kwh * (s.van === 'accu' ? accuZon : 1), 0);
  const netEuro = kostenVan(r, ['stroom', 'normaal', 'dal']);
  const terugEuro = kostenVan(r, ['terug', 'terug-na']);
  const bronnen = [
    ...zonDelen.map((z) => ({ ...z, regels: [{ t: `${getal(van(z.id, 'van'))} kWh` }] })),
    { id: 'net', naam: t('opbrengst.net'), kleur: NET, regels: [{ t: `${getal(van('net', 'van'))} kWh` }, ...(netEuro != null ? [{ t: euro(netEuro), vet: true }] : [])] },
    // Uit de thuisaccu (besluit 272), als hij iets leverde.
    ...(van('accu', 'van') > 0.05 ? [{ id: 'accu', naam: t('opbrengst.accu.uit'), kleur: ACCU, regels: [{ t: `${getal(van('accu', 'van'))} kWh` }] }] : []),
  ];
  const namen = new Map(r.apparaten.map((a) => [a.id, a.rest ? t('opbrengst.rest') : kort(a.naam)]));
  const zonRegel = (id) => {
    const k = van(id, 'naar');
    const pct = k > 0 ? Math.round((zonIn(id) / k) * 100) : 0;
    return [{ t: r.heeft.zon && !r.geschat ? t('opbrengst.stromen.kwhZon', { kwh: getal(k), pct }) : `${getal(k)} kWh` }];
  };
  const ids = [...new Set(st.map((s) => s.naar))];
  const volgorde = (id) => (id === 'terug' ? 5 : id === 'naarAccu' ? 4 : id === 'altijd' ? 3 : id === 'rest' ? 2 : id === 'overig' ? 1 : 0);
  ids.sort((a, b) => volgorde(a) - volgorde(b) || van(b, 'naar') - van(a, 'naar'));
  const doelen = ids.map((id, i) => {
    if (id === 'terug') {
      return { id, naam: r.geschat ? t('opbrengst.naarHetNetGeschat') : t('opbrengst.naarHetNet'), kleur: TERUG, regels: [{ t: `${getal(van(id, 'naar'))} kWh` }, ...(terugEuro != null && terugEuro < 0 ? [{ t: `+ ${euro(-terugEuro)}`, vet: true, kleur: 'var(--mint-t)' }] : [])] };
    }
    if (id === 'altijd') return { id, naam: t('opbrengst.stromen.altijd'), kleur: '#FFB39F', regels: zonRegel(id) };
    if (id === 'naarAccu') return { id, naam: t('opbrengst.accu.naar'), kleur: ACCU, regels: zonRegel(id) };
    if (id === 'overig') return { id, naam: t('opbrengst.stromen.overig'), kleur: 'rgba(233,239,246,0.55)', regels: zonRegel(id) };
    return { id, naam: namen.get(id) ?? id, kleur: id === 'rest' ? NET : KLEUREN[i % KLEUREN.length], regels: zonRegel(id) };
  });
  return { bronnen, doelen, stromen: st };
}

function sankeyVan(r, breedte, hoogte, links = 104, rechts = 136) {
  const m = stroomModel(r);
  if (!m) return `<p class="klein">${esc(t('opbrengst.nietsGemeten'))}</p>`;
  const schema = stromen.svg({ breedte, hoogte, links, rechts, id: `st${breedte}`, beschrijving: t('opbrengst.sankey'), ...m });
  // Zonder meter (besluit 196): zeggen hoe het geschat is.
  return r.geschat ? `${schema}<p class="mini" style="margin: 14px 0 0">${esc(t('opbrengst.geschatUitleg'))}</p>` : schema;
}

/** Gas apart onder het stroombeeld: op dezelfde schaal zou het alles wegdrukken. */
function gasRegel(r) {
  if (!r.gas || !(r.gas.m3 > 0)) return '';
  const e = kostenVan(r, ['gas']);
  return `<div class="gasregel"><svg viewBox="0 0 24 24" fill="none" stroke="#ff8a6b" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1 1.5 2 1.5 3 1.5-1.5 1.5-5 1.5-8z"/></svg><span>${taal.html('opbrengst.stromen.gas')}<small>${esc(t('opbrengst.stromen.gasZin'))}</small></span><b>${getal(r.gas.m3)} m³${e != null ? `<small>${euro(e)}</small>` : ''}</b></div>`;
}

function perApparaat(r) {
  // Zonder meter (besluit 196) is van de rest van het huis alleen de zon bekend: die staat in het schema, niet hier.
  const altijd = altijdAan(r);
  const lijst = r.apparaten
    .filter((a) => (a.kwh >= 0.05 || a.rest) && !(a.rest && r.geschat))
    .flatMap((a) => (a.rest && altijd
      ? [
          { ...a, kwh: a.kwh - altijd.kwh, zonKwh: a.zonKwh * (1 - altijd.deel), netKwh: a.netKwh * (1 - altijd.deel), kosten: a.kosten == null ? null : a.kosten * (1 - altijd.deel) },
          { ...a, id: 'altijd', naam: t('opbrengst.stromen.altijd'), rest: false, kwh: altijd.kwh, zonKwh: a.zonKwh * altijd.deel, netKwh: a.netKwh * altijd.deel, kosten: a.kosten == null ? null : a.kosten * altijd.deel },
        ]
      : [a]))
    .sort((x, y) => y.kwh - x.kwh);
  if (!lijst.length) return `<h2 class="kop-3">${esc(t('opbrengst.perApparaat'))}</h2><p class="mini" style="margin: 6px 0 0">${esc(t('opbrengst.geenMeters'))}</p>`;
  const rij = (a) => {
    const zonPct = a.kwh > 0 ? (a.zonKwh / a.kwh) * 100 : 0;
    return `<div class="rij"><div class="boven"><b>${esc(a.rest ? t('opbrengst.rest') : a.id === 'altijd' ? a.naam : kort(a.naam))}</b><span>${getal(a.kwh)} kWh${a.kosten != null ? `, ${euro(a.kosten)}` : ''}</span></div><div class="verdeel"><i style="width: ${zonPct.toFixed(1)}%; background: var(--zon)"></i><i style="width: ${(100 - zonPct).toFixed(1)}%; background: ${NET}"></i></div></div>`;
  };
  return `<h2 class="kop-3" style="margin-bottom: 4px">${esc(t('opbrengst.perApparaat'))}</h2>${lijst.map(rij).join('')}
    <p class="mini legenda">${legendaZonNet(r)}</p>`;
}

/*
 * De grafiek: deze periode (per uur, dag of maand), of vergelijken met de
 * periodes ervoor en hetzelfde een jaar eerder. Een tik op een staaf zegt
 * wat erin zit.
 */
const grafiek = { blik: 'periode', maat: 'stroom', gekozen: null };
/** Wat je vergelijkt, met zijn eenheid; de naam in teksten.*.js (opbrengst.maat.*). */
const MATEN = { stroom: 'kWh', zon: 'kWh', gas: 'm³', kosten: '€' };
/** Zonder panelen (besluit 196) alleen het net. */
const legendaZonNet = (r) => `${r?.heeft?.zon === false ? '' : `<span><span class="stip" style="background: var(--zon)"></span>${esc(t('opbrengst.zonKlein'))}</span>`}<span><span class="stip" style="background: ${NET}"></span>${esc(t('opbrengst.netKlein'))}</span>`;
const waarde = (n, eenheid) => (n == null ? '–' : eenheid === '€' ? euro(n) : `${getal(n)} ${eenheid}`);

function staven(r) {
  if (grafiek.blik === 'periode') {
    const b = r.perBucket;
    const max = Math.max(0.1, ...b.map((x) => x.zonKwh + x.netKwh));
    return {
      titel: t(`opbrengst.per.${r.periode.soort}`),
      as: b.map((x) => x.label),
      html: b.map((x, i) => `<button type="button" class="staaf" data-staaf="${i}" aria-pressed="${grafiek.gekozen === i}" aria-label="${esc(t('opbrengst.staaf', { label: x.label, zon: getal(x.zonKwh), net: getal(x.netKwh) }))}"><i class="net" style="height: ${((x.netKwh / max) * 100).toFixed(1)}%"></i><i class="zon" style="height: ${((x.zonKwh / max) * 100).toFixed(1)}%"></i></button>`),
      detail: (i) => t('opbrengst.staafDetail', { label: b[i].label, zon: getal(b[i].zonKwh), net: getal(b[i].netKwh) }),
      legenda: legendaZonNet(r),
    };
  }
  const reeks = r.vergelijk[grafiek.maat] ?? [];
  const naam = t(`opbrengst.maat.${grafiek.maat}`);
  const eenheid = MATEN[grafiek.maat];
  const metEerder = (p) => (p.jaarEerder != null ? t('opbrengst.metEerder', { label: p.label, nu: waarde(p.nu, eenheid), eerder: waarde(p.jaarEerder, eenheid) }) : `${p.label}: ${waarde(p.nu, eenheid)}`);
  const max = Math.max(0.1, ...reeks.map((p) => Math.max(p.nu ?? 0, p.jaarEerder ?? 0)));
  const kleur = { stroom: '#6FD3FF', zon: ZON, gas: '#FF8A4C', kosten: '#C4BCFF' }[grafiek.maat];
  return {
    titel: t('opbrengst.vergeleken', { naam }),
    as: reeks.map((p) => p.label),
    html: reeks.map((p, i) => `<button type="button" class="staaf" data-staaf="${i}" aria-pressed="${grafiek.gekozen === i}" aria-label="${esc(metEerder(p))}">${p.jaarEerder != null ? `<i class="eerder" style="height: ${((p.jaarEerder / max) * 100).toFixed(1)}%"></i>` : ''}<i style="height: ${(((p.nu ?? 0) / max) * 100).toFixed(1)}%; background: ${kleur}"></i></button>`),
    detail: (i) => metEerder(reeks[i]),
    legenda: `<span><span class="stip" style="background: ${kleur}"></span>${esc(t(r.periode.soort === 'jaar' ? 'opbrengst.perJaar' : 'opbrengst.dezePeriodes'))}</span>${reeks.some((p) => p.jaarEerder != null) ? `<span><span class="stip" style="background: rgb(var(--wit) / 0.25)"></span>${esc(t('opbrengst.jaarEerder'))}</span>` : ''}`,
  };
}

function perDag(r) {
  const g = staven(r);
  if (!g.as.length) return '';
  const as = [g.as[0], g.as[Math.floor(g.as.length / 2)], g.as[g.as.length - 1]];
  const gekozen = grafiek.gekozen != null && grafiek.gekozen < g.as.length ? grafiek.gekozen : null;
  const maten = grafiek.blik === 'vergelijk'
    ? `<div class="maten" role="group" aria-label="${esc(t('opbrengst.watVergelijken'))}">${Object.keys(MATEN)
        .filter((k) => (k !== 'gas' || r.heeft.gas) && (k !== 'zon' || r.heeft.zon) && (k !== 'kosten' || r.heeft.prijzen))
        .map((k) => `<button type="button" data-maat="${k}" aria-pressed="${k === grafiek.maat}">${esc(t(`opbrengst.maat.${k}`))}</button>`)
        .join('')}</div>`
    : '';
  return `<div class="grafiekkop"><h2 class="kop-3">${esc(g.titel)}</h2><div class="blik" role="group" aria-label="${esc(t('opbrengst.grafiek'))}"><button type="button" data-blik="periode" aria-pressed="${grafiek.blik === 'periode'}">${esc(t('opbrengst.dezePeriode'))}</button><button type="button" data-blik="vergelijk" aria-pressed="${grafiek.blik === 'vergelijk'}">${esc(t('opbrengst.vergelijken'))}</button></div></div>
    ${maten}
    <div class="staven">${g.html.join('')}</div>
    <div class="asje"><span>${esc(as[0])}</span><span>${esc(as[1])}</span><span>${esc(as[2])}</span></div>
    <p class="mini detail" aria-live="polite">${esc(gekozen != null ? g.detail(gekozen) : t('opbrengst.tikStaaf'))}</p>
    <p class="mini legenda">${g.legenda}</p>`;
}

/* ------------------------------------------------------------ nu */

/*
 * Nu (Ricardo, 5 november 2026): naast dag, week, maand en jaar het huis van
 * dit moment, live. Links de zon, het huis en het net in kW en per dakvlak
 * wat het nu levert; in het midden het stroombeeld van nu: de zon per dakvlak
 * en het net naar de apparaten die nu stroom vragen, de rest van het huis,
 * Altijd aan en terug; rechts wat er nu aan staat. Elke vijf tellen opnieuw,
 * de dakvlakken elke halve minuut.
 */
let live = null;
let liveKlok = null;
let liveDaken = null;
const kw = (w) => nl(w / 1000, w >= 10_000 ? 0 : w >= 1000 ? 1 : 2);

async function laadNu() {
  const dakenOud = !liveDaken || Date.now() - liveDaken.at > 30_000;
  const [s, h, a] = await Promise.allSettled([haal('api/state'), haal('api/huis'), dakenOud ? haal('api/aansluiting') : Promise.resolve(null)]);
  if (a.status === 'fulfilled' && a.value) liveDaken = { at: Date.now(), daken: a.value.daken ?? null };
  const st = s.status === 'fulfilled' ? s.value?.bewoner?.stromen ?? null : null;
  // De apparaten met een eigen meter die nu stroom vragen.
  const apparaten = h.status === 'fulfilled'
    ? (h.value?.etages ?? []).flatMap((e) => (e.ruimtes ?? []).flatMap((r) => (r.apparaten ?? []).filter((d) => typeof d.vermogenW === 'number' && d.vermogenW >= 30).map((d) => ({ id: d.id, naam: d.naam, w: d.vermogenW }))))
    : [];
  live = st ? { st, apparaten, at: Date.now() } : null;
  if (!live) melding = s.status === 'rejected' ? t('kamer.geenVerbinding') : t('opbrengst.nu.wachten');
  teken();
}

function startNu() {
  stopNu();
  liveKlok = setInterval(() => document.visibilityState === 'visible' && void laadNu(), 5_000);
}
function stopNu() {
  if (liveKlok) clearInterval(liveKlok);
  liveKlok = null;
}

/** Wat er nu stroomt, in W: bronnen, doelen en de stromen ertussen, zoals het stroombeeld ze tekent. */
function nuModel() {
  const st = live.st;
  const zonW = Math.max(0, (st.zonKw ?? 0) * 1000);
  const netW = (st.netKw ?? 0) * 1000;
  const vanNet = Math.max(0, netW);
  const terug = Math.max(0, -netW);
  // De thuisaccu (besluit 273): wat hij laadt komt eerst uit de zon, wat hij levert gaat naar het huis.
  const accuW = (st.accuKw ?? 0) * 1000;
  const laden = Math.max(0, accuW);
  const leveren = Math.max(0, -accuW);
  const verbruik = st.verbruikKw != null ? st.verbruikKw * 1000 : Math.max(0, zonW + netW - accuW);
  const ladenZon = Math.min(laden, Math.max(0, zonW - terug));
  const zonHuis = Math.max(0, Math.min(verbruik, zonW - terug - ladenZon));
  const uitAccu = Math.min(leveren, Math.max(0, verbruik - zonHuis));
  // De grootste apparaten van nu, samen nooit meer dan het huis; een meter die meer zegt dan het huis is geen apparaat.
  let ruimte = verbruik;
  const apps = [...live.apparaten].filter((d) => d.w <= verbruik * 1.05).sort((x, y) => y.w - x.w).slice(0, 5).map((d) => {
    const w = Math.min(d.w, ruimte);
    ruimte -= w;
    return { ...d, w };
  }).filter((d) => d.w >= 30);
  const rest = Math.max(0, ruimte);
  // Altijd aan: het gewone sluipverbruik, hooguit 90% van de rest (besluit 192).
  const altijd = sluip?.gewoonW ? Math.min(rest * 0.9, sluip.gewoonW) : 0;
  const doelen = [
    ...apps.map((d, i) => ({ id: `app-${d.id}`, naam: kort(d.naam), w: d.w, kleur: KLEUREN[i % KLEUREN.length] })),
    ...(rest - altijd >= 30 ? [{ id: 'rest', naam: t('opbrengst.rest'), w: rest - altijd, kleur: NET }] : []),
    ...(altijd >= 30 ? [{ id: 'altijd', naam: t('opbrengst.stromen.altijd'), w: altijd, kleur: '#FFB39F' }] : []),
  ];
  const zonDeel = verbruik > 0 ? zonHuis / verbruik : 0;
  const accuDeel = verbruik > 0 ? uitAccu / verbruik : 0;
  // De zon per dakvlak, naar wat elk vlak nu levert (besluit 254).
  const dk = liveDaken?.daken;
  const nu = dk?.nu ?? {};
  const vlakken = (dk?.vlakken ?? []).filter((v) => (nu[v.letter]?.w ?? 0) > 0);
  const dakSom = vlakken.reduce((s, v) => s + nu[v.letter].w, 0);
  const zonDelen = vlakken.length > 1 && dakSom > 0
    ? vlakken.map((v, i) => ({ id: `dak-${v.letter}`, naam: `${v.letter} · ${dakNaam(v, dk.vlakken)}`, deel: nu[v.letter].w / dakSom, kleur: DAKKLEUR[i % DAKKLEUR.length] }))
    : [{ id: 'zon', naam: t('vandaag.zon'), deel: 1, kleur: ZON }];
  const stromen = [];
  for (const d of doelen) {
    for (const z of zonDelen) if (zonDeel > 0) stromen.push({ van: z.id, naar: d.id, kwh: d.w * zonDeel * z.deel });
    if (accuDeel > 0) stromen.push({ van: 'accu', naar: d.id, kwh: d.w * accuDeel });
    if (zonDeel + accuDeel < 1) stromen.push({ van: 'net', naar: d.id, kwh: d.w * (1 - zonDeel - accuDeel) });
  }
  // Naar de accu: uit de zon, de rest van het net.
  if (laden >= 30) {
    for (const z of zonDelen) if (ladenZon > 0) stromen.push({ van: z.id, naar: 'naarAccu', kwh: ladenZon * z.deel });
    if (laden - ladenZon >= 30) stromen.push({ van: 'net', naar: 'naarAccu', kwh: laden - ladenZon });
  }
  if (terug >= 30) for (const z of zonDelen) stromen.push({ van: z.id, naar: 'terug', kwh: terug * z.deel });
  const van = (id) => stromen.filter((s) => s.van === id).reduce((t, s) => t + s.kwh, 0);
  const naar = (id) => stromen.filter((s) => s.naar === id).reduce((t, s) => t + s.kwh, 0);
  const zonNaar = (id) => stromen.filter((s) => s.naar === id && s.van !== 'net' && s.van !== 'accu').reduce((t, s) => t + s.kwh, 0);
  return {
    zonW, vanNet, terug, verbruik, zonHuis, apps,
    bronnen: [
      ...zonDelen.map((z) => ({ ...z, regels: [{ t: `${kw(van(z.id))} kW` }] })),
      { id: 'net', naam: t('opbrengst.net'), kleur: NET, regels: [{ t: `${kw(van('net'))} kW` }] },
      ...(uitAccu >= 30 ? [{ id: 'accu', naam: t('opbrengst.accu.uit'), kleur: ACCU, regels: [{ t: `${kw(uitAccu)} kW` }] }] : []),
    ],
    doelen: [
      ...doelen.map((d) => ({ id: d.id, naam: d.naam, kleur: d.kleur, regels: [{ t: zonW > 0 ? t('opbrengst.nu.kwZon', { kw: kw(naar(d.id)), pct: naar(d.id) > 0 ? Math.round((zonNaar(d.id) / naar(d.id)) * 100) : 0 }) : `${kw(naar(d.id))} kW` }] })),
      ...(laden >= 30 ? [{ id: 'naarAccu', naam: t('opbrengst.accu.naar'), kleur: ACCU, regels: [{ t: `${kw(laden)} kW` }] }] : []),
      ...(terug >= 30 ? [{ id: 'terug', naam: t('opbrengst.naarHetNet'), kleur: TERUG, regels: [{ t: `${kw(terug)} kW` }] }] : []),
    ],
    stromen,
  };
}

function nuCijfers(m, klein = false) {
  const pct = m.verbruik > 0 ? Math.round((m.zonHuis / m.verbruik) * 100) : 0;
  const net = m.terug >= 30 ? { naam: t('opbrengst.nu.terug'), w: m.terug, kleur: 'var(--mint-t)' } : { naam: t('opbrengst.nu.vanNet'), w: m.vanNet, kleur: '' };
  const dk = liveDaken?.daken;
  const helder = Object.values(dk?.nu ?? {}).reduce((s, n) => s + (n?.helderW ?? 0), 0);
  if (klein) {
    const blok = (naam, waarde, onder) => `<div class="glas-klein"><span class="mini">${esc(naam)}</span><span class="getal">${waarde}</span><span class="mini">${esc(onder)}</span></div>`;
    return `<div class="drie">${blok(t('opbrengst.nu.zon'), kw(m.zonW), 'kW')}${blok(t('opbrengst.nu.huis'), kw(m.verbruik), 'kW')}${blok(net.naam, kw(net.w), 'kW')}</div>`;
  }
  return `<div class="cijfer"><div class="mini">${esc(t('opbrengst.nu.zon'))}</div><div class="getal zon-t">${kw(m.zonW)}<small>kW</small></div><div class="klein">${helder > 0 ? esc(t('opbrengst.nu.helder', { kw: kw(helder) })) : ''}</div></div>
    <div class="cijfer"><div class="mini">${esc(t('opbrengst.nu.huis'))}</div><div class="getal">${kw(m.verbruik)}<small>kW</small></div><div class="klein">${m.zonW > 0 ? esc(t('opbrengst.nu.uitZon', { pct })) : ''}</div></div>
    <div class="cijfer"><div class="mini">${esc(net.naam)}</div><div class="getal"${net.kleur ? ` style="color: ${net.kleur}"` : ''}>${kw(net.w)}<small>kW</small></div><div class="klein"></div></div>`;
}

/** Per dakvlak wat het nu levert, met een streepje voor de heldere lucht, zoals De zon op je daken op Thuis. */
function nuPanelen() {
  const dk = liveDaken?.daken;
  const vlakken = dk?.vlakken ?? [];
  const nu = dk?.nu ?? {};
  if (vlakken.length < 2 || !Object.keys(nu).length) return '';
  const top = Math.max(1, ...vlakken.map((v) => Math.max(nu[v.letter]?.w ?? 0, nu[v.letter]?.helderW ?? 0)));
  const achter = dk.achter?.letter;
  const rij = (v) => {
    const n = nu[v.letter] ?? { w: null, helderW: 0 };
    const kleur = achter === v.letter ? '#ff8a6b' : 'var(--zon)';
    return `<div class="dakrij"><span class="dakletter" style="background: ${kleur}">${esc(v.letter)}</span><span class="daknaam">${esc(dakNaam(v, vlakken))}<span class="dakstaaf"><i style="width: ${(((n.w ?? 0) / top) * 100).toFixed(1)}%; background: ${kleur}"></i><em style="left: ${((n.helderW / top) * 100).toFixed(1)}%"></em></span></span><b>${n.w == null ? '–' : `${kw(n.w)} kW`}</b></div>`;
  };
  return `<section class="glas kaart"><h2 class="kop-3">${esc(t('opbrengst.nu.panelen'))}</h2><div class="dakrijen">${vlakken.map(rij).join('')}</div><p class="mini" style="margin: 8px 0 0">${esc(t('daken.nu.streep'))}</p></section>`;
}

/** Wat er nu aan staat, met zijn deel zon. */
function nuApparaten(m) {
  if (!m.apps.length) return `<h2 class="kop-3">${esc(t('opbrengst.nu.apparaten'))}</h2><p class="mini" style="margin: 6px 0 0">${esc(t('opbrengst.nu.geenApparaten'))}</p>`;
  const zonDeel = m.verbruik > 0 ? m.zonHuis / m.verbruik : 0;
  const rij = (a) => `<div class="rij"><div class="boven"><b>${esc(kort(a.naam))}</b><span>${kw(a.w)} kW</span></div><div class="verdeel"><i style="width: ${(zonDeel * 100).toFixed(1)}%; background: var(--zon)"></i><i style="width: ${((1 - zonDeel) * 100).toFixed(1)}%; background: ${NET}"></i></div></div>`;
  return `<h2 class="kop-3" style="margin-bottom: 4px">${esc(t('opbrengst.nu.apparaten'))}</h2>${m.apps.map(rij).join('')}<p class="mini legenda">${legendaZonNet(null)}</p>`;
}

function tekenLive() {
  if (!live) {
    const tekst = `<p class="klein">${esc(melding ?? t('opbrengst.nu.wachten'))}</p>`;
    $$('[data-titel]').forEach((el) => (el.textContent = t('opbrengst.soort.nu')));
    document.querySelector('[data-links]').innerHTML = tekst;
    document.querySelector('[data-telinhoud]').innerHTML = tekst;
    ['[data-sankey]', '[data-gas]', '[data-apparaten]', '[data-perdag]'].forEach((s) => (document.querySelector(s).innerHTML = ''));
    $$('[data-periode]').forEach((el) => (el.innerHTML = ''));
    return;
  }
  const m = nuModel();
  const titelNu = m.zonW >= 50 ? t('opbrengst.nu.titelZon', { kw: kw(m.zonW) }) : t('opbrengst.nu.titel', { kw: kw(m.verbruik) });
  $$('[data-titel]').forEach((el) => (el.textContent = titelNu));
  const klok = taal.tijd ? taal.tijd(live.at) : new Date(live.at).toLocaleTimeString(taal.locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  $$('[data-periode]').forEach((el) => (el.innerHTML = `<span class="livelabel"><i aria-hidden="true"></i>${esc(t('opbrengst.nu.live', { tijd: klok }))}</span>`));
  const beeld = (b, h, l, r) => (m.stromen.length ? stromen.svg({ breedte: b, hoogte: h, links: l, rechts: r, id: `nu${b}`, beschrijving: t('opbrengst.sankey'), bronnen: m.bronnen, doelen: m.doelen, stromen: m.stromen }) : `<p class="klein">${esc(t('opbrengst.nietsGemeten'))}</p>`);
  document.querySelector('[data-links]').innerHTML = `<div class="cijfers">${nuCijfers(m)}</div>${nuPanelen()}${sluipIngang()}`;
  document.querySelector('[data-sankey]').innerHTML = beeld(380, 470, 104, 136);
  document.querySelector('[data-gas]').innerHTML = '';
  zet('[data-waarheen]', t('opbrengst.nu.waarHeen'));
  document.querySelector('[data-apparaten]').innerHTML = nuApparaten(m);
  document.querySelector('[data-perdag]').innerHTML = '';
  document.querySelector('[data-telinhoud]').innerHTML = `${nuCijfers(m, true)}
    <section class="glas kaart"><h2 class="kop-3">${esc(t('opbrengst.nu.waarHeen'))}</h2><div class="telstromen">${beeld(358, 400, 96, 128)}</div></section>
    ${nuPanelen()}
    <section class="glas kaart">${nuApparaten(m)}</section>${sluipIngang()}`;
}

/* ------------------------------------------------------------ tekenen */

function tekenNu() {
  app.schaal();
  app.luchtVan(zon, 0);
  const soorten = ['nu', 'dag', 'week', 'maand', 'jaar'];
  $$('[data-wissel]').forEach((el) => (el.innerHTML = soorten.map((k) => `<button type="button" data-soort="${k}" aria-pressed="${k === keuze.soort}">${esc(t(`opbrengst.soort.${k}`))}</button>`).join('')));
  // Bij Nu is er geen Per dag: die kaart weg, zodat er geen lege staat.
  document.querySelector('[data-perdag]').hidden = keuze.soort === 'nu';
  if (keuze.soort === 'nu') return tekenLive();

  if (!data) {
    const tekst = melding === 'meters'
      ? `<section class="glas kaart"><h2 class="kop-3">${esc(t('opbrengst.eerstMeters'))}</h2><p class="klein" style="margin: 8px 0 12px">${esc(t('opbrengst.metersUitleg'))}</p><a class="pil" href="energie.html#meters">${esc(t('opbrengst.metersInstellen'))}</a></section>`
      : `<p class="klein">${esc(melding ?? t('kamer.camera.laden'))}</p>`;
    $$('[data-titel]').forEach((el) => (el.textContent = melding ? t('nav.opbrengst') : t('algemeen.laden')));
    document.querySelector('[data-links]').innerHTML = tekst + sluipIngang();
    document.querySelector('[data-telinhoud]').innerHTML = tekst + sluipIngang();
    ['[data-sankey]', '[data-gas]', '[data-apparaten]', '[data-perdag]'].forEach((s) => (document.querySelector(s).innerHTML = ''));
    $$('[data-periode]').forEach((el) => (el.innerHTML = ''));
    return;
  }
  const r = data;
  $$('[data-titel]').forEach((el) => (el.textContent = titel(r)));
  $$('[data-periode]').forEach((el) => (el.innerHTML = periode(r)));
  document.querySelector('[data-links]').innerHTML = `<div class="cijfers">${cijfers(r)}</div>${panelen(r)}${sluipIngang()}${erbijKaart(r)}`;
  document.querySelector('[data-sankey]').innerHTML = sankeyVan(r, 380, 470);
  document.querySelector('[data-gas]').innerHTML = gasRegel(r);
  zet('[data-waarheen]', t(r.geschat ? 'opbrengst.waarHeenZon' : 'opbrengst.waarHeen'));
  document.querySelector('[data-apparaten]').innerHTML = perApparaat(r);
  document.querySelector('[data-perdag]').innerHTML = perDag(r);
  document.querySelector('[data-telinhoud]').innerHTML = `${cijfers(r, true)}
    <section class="glas kaart"><h2 class="kop-3">${esc(t(r.geschat ? 'opbrengst.waarHeenZon' : 'opbrengst.waarHeen'))}</h2><div class="telstromen">${sankeyVan(r, 358, 400, 96, 128)}</div>${gasRegel(r)}</section>
    ${panelen(r)}${sluipIngang()}${erbijKaart(r)}
    <section class="glas kaart">${perApparaat(r)}</section>
    <section class="glas kaart">${perDag(r)}</section>`;
}

/* -------------------------------------------------------------- starten */

/** Gebundeld: hooguit één keer per beeld (basis.js). */
const teken = app.gebundeld(tekenNu);
addEventListener('standwissel', teken);

app.start('opbrengst');
document.addEventListener('click', (e) => {
  const staaf = e.target.closest('[data-staaf]');
  if (staaf) {
    grafiek.gekozen = Number(staaf.dataset.staaf);
    teken();
    return;
  }
  const pd = e.target.closest('[data-perdak]');
  if (pd) {
    perDak = pd.dataset.perdak === '1';
    teken();
    return;
  }
  const blik = e.target.closest('[data-blik]');
  if (blik) {
    grafiek.blik = blik.dataset.blik;
    grafiek.gekozen = null;
    teken();
    return;
  }
  const maat = e.target.closest('[data-maat]');
  if (maat) {
    grafiek.maat = maat.dataset.maat;
    grafiek.gekozen = null;
    teken();
    return;
  }
  const soort = e.target.closest('[data-soort]');
  if (soort) {
    keuze.soort = soort.dataset.soort;
    keuze.datum = null;
    grafiek.gekozen = null;
    // Nu ververst zichzelf; de andere periodes niet.
    if (keuze.soort === 'nu') startNu();
    else stopNu();
    void laad();
    return;
  }
  const naar = e.target.closest('[data-naar]');
  if (naar) {
    keuze.datum = naar.dataset.naar;
    void laad();
  }
});
void laad();
haal('api/zon').then((z) => ((zon = z), teken())).catch(() => {});
haal('api/sluipverbruik').then((s) => ((sluip = s), teken())).catch(() => {});
setInterval(() => keuze.soort !== 'nu' && void laad(), 5 * 60_000);
