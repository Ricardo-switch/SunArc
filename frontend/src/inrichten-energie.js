/*
 * Deel van inrichten.js (opgesplitst op 22 november 2026): energie. Een gewoon script dat na
 * inrichten-klimaat.js laadt en zijn bovenste namen deelt met de andere delen van de pagina.
 */
'use strict';
/* global antwoorden, d, deur, energieNu, esc, haal, lijstje, nl, regel, stuur, teken, tip, waarVan */
/* exported assistentBlok, assistentNogAan, bewaarAansluiting, bewaarFuncties, bewaarPrijzen, contractKeuze, contractNu, dakVoorstelStap, functiesNu, naarRondleiding, prijzenStap, vermogenStap, zekeringStap, zetAssistentAan */
/*
 * Zo liggen ze, denken we (schets Wand-Inrichten-Daken #voorstel): elk vlak
 * met zijn letter, in de kleur van waar het vandaan komt. Zolang de meting
 * nog niets vond, zegt de stap dat en kun je door.
 */
function dakVoorstelStap(dk) {
  const gemeten = dk.vlakken.some((v) => v.bron === 'gemeten');
  const rijen = dk.vlakken.map((v) => {
    const n = dakvlakken.panelen(v);
    return `<a class="kp-vlak" href="energie.html#panelen"><span class="kp-letter" style="background: ${dakvlakken.STANDKLEUR[v.bron] ?? dakvlakken.STANDKLEUR.schatting}">${esc(v.letter)}</span><span><b>${esc(dakvlakken.naam(v, dk.vlakken))}</b><small>${esc(dakvlakken.waar(v))} · ${esc(t(`daken.stand.${v.bron}`))}</small></span><em>${esc(t('inr.dak.nPanelen', { n }))}</em></a>`;
  });
  // Eén omvormer voor meer vlakken: wat hij meet, gaat naar wat elk vlak bij heldere lucht levert.
  const perMeter = new Map();
  for (const v of dk.vlakken) if (v.meter) perMeter.set(v.meter, [...(perMeter.get(v.meter) ?? []), v.letter]);
  const samen = [...perMeter.values()].find((l) => l.length > 1);
  const tip = samen ? `<div class="kp-tip">${esc(t('inr.dak.eenMeter', { letters: lijstje(samen) }))}</div>` : '';
  const rechts = `<span class="rechts"><a class="zachtknop" href="energie.html#panelen">${esc(t('w.aanpassen'))}</a><button type="button" class="knop knop-licht" data-volgende>${esc(t(gemeten ? 'inr.dak.klopt' : 'inr.volgende'))}</button></span>`;
  return {
    waar: waarVan('ligging'),
    kop: t(gemeten ? 'inr.dak.voorstelKop' : 'inr.dak.wachtKop'),
    uitleg: t(gemeten ? 'inr.dak.voorstelZin' : 'inr.dak.wachtZin'),
    // Wat kan bij jouw huis: de kaarten, met een link naar Daken en panelen.
    inhoud: `<div class="kp-vlakken">${rijen.join('')}</div>${tip}${dakvlakken.watKanZin(dk)}`,
    voet: [`<button type="button" class="zachtknop" data-terug>${esc(t('w.terug'))}</button>`, rechts],
  };
}

/*
 * De netmeter en de omvormers (testerronde, november 2026): welke sensor het
 * vermogen van nu geeft. Uit vermogens.js, net als bij Energie.
 */
function vermogenStap() {
  const a = antwoorden();
  const panelen = a.panelen.ligging !== 'geen';
  return {
    waar: waarVan('vermogen'),
    kop: t('inr.verKop'),
    uitleg: t('inr.verZin'),
    inhoud: `<div class="kolom"><div class="etagekop">${esc(t('energie.vermogenKop'))}</div>${vermogens.netBlok(d.aans, a)}</div>
      ${panelen ? `<div class="kolom"><div class="etagekop">${esc(t('energie.omvormersKop'))}</div>${vermogens.zonBlok(d.aans, a)}</div>` : ''}
      ${d.aans?.volgendeStart ? `<p class="mini">${esc(t('energie.later'))} <button type="button" class="chip" data-herstart>${esc(t('basis.herstart'))}</button></p>` : ''}`,
  };
}

/* De zekering (stap 4): hetzelfde deel als bij Energie › Aansluiting, eerst de fasen en dan de ampère (zekering.js). */
function zekeringStap() {
  return {
    waar: waarVan('zekering'),
    kop: t('inr.zekKop'),
    uitleg: t('inr.zekZin'),
    inhoud: `<span class="zelfde-als">${esc(t('zk.zelfdeAls'))}</span>${zekering.vorm(antwoorden().zekering)}`,
  };
}

/*
 * De prijzen (besluit 158): eerst het soort contract, dan alleen de velden die
 * daarbij horen, met gas en wat je voor teruglevering krijgt en betaalt
 * (sinds 2027 zonder salderen, besluit 334).
 */
let contractKeuze = null;
/** Het soort contract (stap 4): dezelfde rij als bij Energie › Contract en prijzen (contract.js). */
function contractNu() {
  if (contractKeuze) return contractKeuze;
  const p = energieNu()?.prijzen ?? {};
  return contract.van(antwoorden().tarief, p.stroomDal != null) ?? (p.stroom != null ? 'enkel' : null);
}
function prijzenStap() {
  const e = energieNu();
  const meters = [e?.net?.afname?.length ? t('inr.meter.net') : null, e?.zon?.length ? t('inr.meter.panelen') : null, e?.gas ? t('energie.gas') : null].filter(Boolean);
  const p = e?.prijzen ?? {};
  const soort = contractNu();
  const veld = (sleutel, label, waarde, eenheid = 'kWh') => `<label class="invul"><span>${esc(label)}</span><span class="waarde">${taal.valuta()}<input inputmode="decimal" data-prijs="${sleutel}" data-eenheid="${eenheid}" value="${waarde != null ? nl(waarde, String(waarde).split('.')[1]?.length ?? 0) : ''}" placeholder="${esc(t('inr.invullen'))}" aria-label="${esc(t('inr.perEenheid', { label, eenheid }))}"></span></label>`;
  // Twee vakken naast elkaar, zodat alles op de kaart past: stroom (en dal), dan gas.
  const gas = e?.gas ? veld('gas', t('inr.gasM3'), p.gas, 'm³') : '';
  const stroom = soort === 'dagnacht'
    ? `<div class="paar">${veld('stroom', t('inr.stroomNormaal'), p.stroom)}${veld('stroomDal', t('inr.stroomDal'), p.stroomDal)}</div>${gas}`
    : `<div class="paar">${veld('stroom', t(soort === 'dynamisch' ? 'inr.stroomGemiddeld' : 'opbrengst.stroom'), p.stroom)}${gas}</div>`;
  const velden = soort
    ? `${stroom}
       <span class="vraagje">${esc(t('inr.terug2027'))}</span><div class="paar">${veld('vanaf2027.vergoeding', t('inr.jeKrijgt'), p.vanaf2027?.vergoeding)}${veld('vanaf2027.kosten', t('inr.jeBetaalt'), p.vanaf2027?.kosten)}</div>`
    : '';
  return {
    waar: waarVan('prijzen'),
    kop: t('inr.prijsKop'),
    uitleg: meters.length ? t('inr.prijsMeters', { meters: lijstje(meters) }) : t('inr.prijsZin'),
    inhoud: `<span class="zelfde-als">${esc(t('ct.zelfdeAls'))}</span>${contract.vorm(soort)}
      ${soort === 'dynamisch' ? uurprijsTip(p) : ''}
      ${velden ? `<div class="rijen kolom">${velden}</div>` : ''}
      <div class="noot">${esc(t('inr.prijsNoot'))}</div>`,
  };
}

/**
 * Bij een dynamisch contract (issue 119): rekent Opbrengst met de uurprijs van
 * Home Assistant, of wat er daar nog mist, met de sensor die hem al geeft.
 */
function uurprijsTip(p) {
  const nu = d.energie?.prijsNu;
  if (p.dynamisch) return tip(nu != null ? t('energie.uurprijsAan', { prijs: taal.geld(nu, 2) }) : t('energie.uurprijsAanZonder'));
  const sensor = d.energie?.prijsSensoren?.[0] ?? null;
  const erbij = sensor ? ` ${t(sensor.prijs != null ? 'energie.uurprijsSensor' : 'energie.uurprijsSensorZonder', { naam: sensor.naam, prijs: sensor.prijs != null ? taal.geld(sensor.prijs, 2) : '' })}` : '';
  return tip(`${t('energie.uurprijsMist')}${erbij}`);
}

/* Gemak: licht en camera's in de app (besluit 130), en de wand die één keer inlogt. */
const functiesNu = () => {
  const f = d.functies;
  if (!f) return null;
  const c = JSON.parse(JSON.stringify(f.instellingen ?? f.voorstel));
  c.licht ??= f.voorstel.licht;
  c.schermen ??= f.voorstel.schermen ?? { bedienen: true };
  c.weer ??= f.voorstel.weer;
  c.praten ??= f.voorstel.praten ?? { taalmodel: null, bedienen: true, spraak: null };
  c.tedoen ??= f.voorstel.tedoen;
  return c;
};
async function bewaarFuncties(c) {
  const uit = await stuur('api/functies', c);
  if (!uit) return false;
  d.functies = await haal('api/functies').catch(() => d.functies);
  teken();
  return true;
}

/*
 * De assistent met één knop (besluit 202, schets Wand-Inrichten-Klaarzetten
 * #assistent en #bezig): de add-on zet de integratie neer, herstart Home
 * Assistant en voegt hem toe. Alleen voor de beheerder, en alleen in de add-on.
 */
const AAN_STAPPEN = ['neerzetten', 'herstarten', 'toevoegen'];
let aanKijk = null;
function assistentBlok() {
  const i = d.integ;
  if (!i) return '';
  if (i.toegevoegd === true && !i.oudeKoppeling && !i.aanzetten?.bezig) return regel({ ik: 'praat', titel: t('inr.as.aan'), zin: t('inr.as.aanZin'), rechts: '✓', toon: 'mint' });
  const a = i.aanzetten;
  if (!a) return '';
  // Loopt het, dan elke drie tellen kijken waar het is; ook als de pagina tijdens het herstarten opnieuw laadde.
  if (a.bezig && !aanKijk) {
    aanKijk = setTimeout(async () => {
      aanKijk = null;
      d.integ = await haal('api/integratie').catch(() => d.integ);
      if (!d.integ?.aanzetten?.bezig) d.klaar = await haal('api/klaarzetten').catch(() => d.klaar);
      teken();
    }, 3000);
  }
  const nog = a.stap === 'herstarten' && a.herstartMs ? Math.max(5, 60 - Math.round((Date.now() - a.herstartMs) / 1000)) : null;
  const lijst = i.oudeKoppeling || a.stap === 'oudeWeg' || a.klaar.includes('oudeWeg') ? [...AAN_STAPPEN, 'oudeWeg'] : AAN_STAPPEN;
  const stappen = lijst.map((s, n) => {
    const klaar = a.klaar.includes(s);
    const nu = a.bezig && a.stap === s;
    return `<li><span class="nr${klaar ? ' klaar' : nu ? ' bezig' : ''}">${klaar ? '✓' : nu ? '' : n + 1}</span><span>${esc(t(`inr.as.s.${s}`))}</span><small>${nu && nog != null ? esc(t('inr.as.nog', { n: nog })) : ''}</small></li>`;
  }).join('');
  // Zonder fout gaat hij vanzelf aan bij Klaar, terwijl de film speelt; alleen na een fout een knop.
  const zin = a.bezig ? t(a.stap === 'herstarten' ? 'inr.as.bezigZin' : 'inr.as.even') : a.fout ? t('inr.as.fout', { fout: a.fout }) : t('inr.as.bijKlaar');
  const knop = a.bezig || !a.fout ? '' : `<button type="button" class="knop knop-licht" data-assistent-aan>${esc(t('inr.as.opnieuw'))}</button>`;
  return `<div class="asblok" aria-live="polite"><div class="askop"><span class="bol" aria-hidden="true"></span><div><b>${esc(t('w.praatMetJeHuis'))}</b><span${a.fout && !a.bezig ? ' class="fout"' : ''}>${esc(zin)}</span></div></div><ol class="accstappen asstappen">${stappen}</ol>${knop}</div>`;
}
/** Of de assistent nog aan moet (besluit 202): in de add-on, niet via HACS, nog niet toegevoegd en niet al bezig. */
function assistentNogAan() {
  const i = d.integ;
  return !!(i?.aanzetten && !i.aanzetten.bezig && i.staat !== 'anders' && (i.toegevoegd !== true || i.oudeKoppeling === true));
}
async function zetAssistentAan() {
  const res = await deur('api/integratie', { aanzetten: true }).catch(() => null);
  if (res?.ok) d.integ = await res.json().catch(() => d.integ);
}
/*
 * Naar de rondleiding op Thuis. Herstart Home Assistant nog (besluit 202), dan
 * eerst wachten met de voortgang in beeld: Thuis openen kan pas als hij terug
 * is. Na zeven minuten gaat hij toch; de dienst geeft het eerder op.
 */
async function naarRondleiding() {
  const tot = Date.now() + 7 * 60_000;
  let wacht = null;
  while (d.integ?.aanzetten?.bezig && Date.now() < tot) {
    if (!wacht) {
      wacht = document.createElement('div');
      wacht.className = 'aswacht';
      document.body.append(wacht);
    }
    wacht.innerHTML = `<div>${assistentBlok()}<p>${esc(t('inr.as.wacht'))}</p></div>`;
    await new Promise((klaar) => setTimeout(klaar, 3000));
    d.integ = await haal('api/integratie').catch(() => d.integ);
  }
  location.href = 'thuis.html#rondleiding';
}

/** `daken`: de vlakken van Daken en panelen (besluit 254); weggelaten blijven ze zoals ze waren, null haalt ze weg. */
async function bewaarAansluiting(a, daken) {
  const opZon = Object.fromEntries(Object.entries(a.opZon).filter(([, v]) => typeof v === 'boolean'));
  // De netmeter en de omvormers alleen als ze gekozen zijn; anders houdt de dienst wat er stond.
  const uit = await stuur('api/aansluiting', { panelen: a.panelen, zekering: a.zekering, tarief: a.tarief, verwarming: a.verwarming, voorkantZon: a.voorkantZon, dak: a.dak, elders: a.elders, ...(daken !== undefined ? { daken } : {}), opZon, opZonUit: a.opZonUit, netmeter: a.netmeter, omvormers: a.omvormers });
  if (uit) {
    d.aans = uit;
    teken();
  }
  return !!uit;
}
/** Een prijs bewaren; `sleutel` mag een pad zijn, zoals "vanaf2027.kosten". */
async function bewaarPrijzen(wijzig) {
  const e = JSON.parse(JSON.stringify(energieNu() ?? { versie: 1, bron: 'zelf', net: { afname: [], teruglevering: [] }, zon: [], gas: null, apparaten: [], prijzen: { stroom: null, teruglevering: null, gas: null, vastPerMaand: null } }));
  e.prijzen.vanaf2027 ??= { vergoeding: null, kosten: null };
  for (const [sleutel, waarde] of Object.entries(wijzig)) {
    const [a, b] = sleutel.split('.');
    if (b) e.prijzen[a][b] = waarde;
    else e.prijzen[a] = waarde;
  }
  const uit = await stuur('api/energie', { ...e, bron: e.bron ?? 'zelf' });
  if (uit) {
    d.energie = { ...d.energie, instellingen: uit };
    teken();
  }
  return !!uit;
}
