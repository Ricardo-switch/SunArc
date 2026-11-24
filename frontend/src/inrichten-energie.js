/*
 * Deel van inrichten.js (opgesplitst op 22 november 2026): energie. Een gewoon script dat na
 * inrichten-klimaat.js laadt en zijn bovenste namen deelt met de andere delen van de pagina.
 */
'use strict';
/* global IK, S, antwoorden, appAdres, d, deur, energieNu, esc, haal, knop, lijstje, nl, qrVan, regel, rij, schakel, schakelaar, stuur, teken, tip, waarVan */
/* exported accountStap, assistentBlok, assistentNogAan, bewaarAansluiting, bewaarFuncties, bewaarPrijzen, bewaarVoorkeur, contractKeuze, contractNu, dakVoorstelStap, functiesNu, functiesStap, haStap, naarRondleiding, prijzenStap, stemStap, vermogenStap, wandStap, zekeringStap, zetAssistentAan */
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
 * daarbij horen, met gas en wat je vanaf 2027 voor teruglevering krijgt en
 * betaalt. Het salderen stopt op 1 januari 2027.
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
    : `<div class="paar">${veld('stroom', t(soort === 'dynamisch' ? 'inr.stroomGemiddeld' : 'energie.stroomKop'), p.stroom)}${gas}</div>`;
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
function functiesStap() {
  const c = functiesNu();
  const f = d.functies;
  const cams = f?.gevonden?.cameras ?? [];
  // Elk deel met een schakelaar (besluit 190): aan is bedienen in de app, uit alleen kijken.
  const een = (icoon, titel, attr, aan, zinAan, zinUit) => regel({ ik: icoon, titel, zin: aan ? zinAan : zinUit, rechts: schakelaar(`${attr}="${!aan}"`, titel, aan) });
  return {
    waar: waarVan('functies'),
    kop: t('inr.gemakKop'),
    uitleg: t('inr.functiesZin'),
    inhoud: c
      ? `<div class="rijen lijst">
          ${f.lichtMogelijk ? een('lamp', t('inr.licht'), 'data-flicht', c.licht?.bedienen === true, t('functies.bedienen'), t('functies.kijken')) : ''}
          ${f.schermMogelijk ? een('screen', t('inr.zonneschermen'), 'data-fscherm', c.schermen?.bedienen === true, t('functies.bedienen'), t('functies.kijken')) : ''}
          ${cams.length ? een('camera', t('functies.cameras'), 'data-fcam', c.cameras?.aan === true, lijstje(cams.map((x) => x.naam)), t('functies.nietTonen')) : ''}
          ${een('praat', t('inr.assistent'), 'data-fpraat', c.praten?.bedienen !== false, t('inr.assistentAan'), t('inr.assistentUit'))}
          ${een('lijst', t('nav.tedoen'), 'data-ftedoen', c.tedoen?.aan === true, t('inr.tedoenAan'), t('inr.tedoenUit'))}
        </div>${tip(t('inr.gemakTip'))}`
      : `<p class="zacht">${esc(t('inr.lezen'))}</p>`,
  };
}
async function bewaarFuncties(c) {
  const uit = await stuur('api/functies', c);
  if (!uit) return false;
  d.functies = await haal('api/functies').catch(() => d.functies);
  teken();
  return true;
}
/*
 * De wand (besluit 158): dat doe je op de tablet zelf, niet hier. Wie hier
 * inricht, ziet hoe, met een code om te scannen, en welke schermen er al zijn.
 */
/*
 * Per scherm (besluit 166): het hele scherm en luisteren naar "Hé huis". De
 * dienst bewaart het, de tablet neemt het over; zo zet je het ook vanaf de pc.
 */
function schermRij(s) {
  const mag = d.bewoners?.ik?.magBeheren || s.ik;
  const o = s.opties ?? {};
  return `<div class="waarderij">${esc(s.naam)}<span>${esc(t(s.ik ? 'inr.ditScherm' : 'inr.scherm'))}</span></div>
    <div class="rondom onder-8">
      ${schakel(`data-sopt="volledig" data-scherm="${esc(s.id)}"`, t('w.volledigScherm'), o.volledig === true, !mag)}
      ${schakel(`data-sopt="luisteren" data-scherm="${esc(s.id)}"`, t('bewoners.luistert'), o.luisteren === true, !mag)}
    </div>`;
}
/*
 * Een eigen account voor de wand (besluit 202, schets Wand-Inrichten-Klaarzetten
 * #wand): een tablet aan de muur logt het beste in met een eigen account in
 * Home Assistant, geen beheerder. Waarom, en hoe in drie stappen, met een knop
 * naar Personen. Is er al een scherm, dan staat dat er; zonder inlog (op het
 * thuisnetwerk) is er geen account nodig.
 */
function accountStap() {
  const schermen = d.bewoners?.schermen ?? [];
  const inlog = d.sessie?.toegang === 'sessions' || app.inHA();
  const waarom = `<div class="accblok"><div class="acckop"><span class="ik">${S(IK.tablet)}</span><div><b>${esc(t('inr.acc.waarom'))}</b><span>${esc(t('inr.acc.waaromZin'))}</span></div></div>
    <ul class="accwaarom">${['w1', 'w2', 'w3'].map((k) => `<li>${esc(t(`inr.acc.${k}`))}</li>`).join('')}</ul></div>`;
  let inhoud;
  if (!inlog) inhoud = `${tip(t('inr.acc.geenInlog'))}`;
  else if (schermen.length) inhoud = `${regel({ ik: 'tablet', titel: t('inr.acc.al', { naam: schermen.map((s) => s.naam).join(', ') }), zin: t('inr.acc.alZin'), rechts: '✓', toon: 'mint' })}${waarom}`;
  else {
    const stappen = ['s1', 's2', 's3'].map((k, i) => `<li><span class="nr">${i + 1}</span><span>${esc(t(`inr.acc.${k}`))}</span></li>`).join('');
    const open = app.inHA() ? `<button type="button" class="knop" data-ha-pad="/config/person">${esc(t('inr.acc.open'))}</button>` : '';
    inhoud = `${waarom}<div class="accblok"><b>${esc(t('inr.acc.hoe'))}</b><ol class="accstappen">${stappen}</ol>${open}</div>`;
  }
  return { waar: waarVan('account'), kop: t('inr.acc.kop'), uitleg: t('inr.acc.zin'), inhoud: `<div class="rijen">${inhoud}</div>` };
}
/*
 * De wand (besluit 158, 166 en 190): hoe hij eruitziet, in het klein, met de
 * kaarten om aan of uit te zetten; 's nachts uit en de taal. Dezelfde indeling
 * als op je telefoon (niet dubbel). Daaronder elk scherm.
 */
const WAND_KAARTEN = ['favorieten', 'vandaag', 'apparaat', 'gevoel', 'morgen', 'auto', 'batterij', 'maand', 'deurbel', 'boiler', 'sluip', 'fasen', 'tedoen'];
function wandStap() {
  const schermen = d.bewoners?.schermen ?? [];
  const inlog = d.sessie?.toegang === 'sessions';
  const v = d.voork;
  const kaarten = v?.wand?.kaarten ?? [];
  const breed = new Set(v?.wand?.breed ?? []);
  const wandje = `<div class="wandje" aria-hidden="true"><span class="huisvak" data-mini="wand"></span><span class="kaartjes">${kaarten.slice(0, 8).map((k) => `<i class="${breed.has(k) ? 'breed' : ''}"></i>`).join('')}</span></div>`;
  const n = v?.wand?.niemand;
  const taal = v?.tel?.taal ?? 'auto';
  const instellen = v
    ? `${wandje}
       ${`<div class="schakelblok"><b>${esc(t('w.kaarten'))}</b><div class="kolom schakels">${WAND_KAARTEN.map((k) => schakel(`data-wkaart="${k}"`, t(`inr.kaart.${k}`), kaarten.includes(k))).join('')}</div></div>`}
       ${n ? rij(t('inr.alsNiemand'), knop('data-wnacht', t('inr.nachtsUit', { van: n.van, tot: n.tot }), n.nacht === true)) : ''}
       ${v.scherm ? '' : rij(t('jij.taal.kop'), ['auto', 'nl', 'en'].map((x) => knop(`data-wtaal="${x}"`, t(`jij.taal.${x}`), taal === x)).join(''))}`
    : '';
  return {
    waar: waarVan('wand'),
    kop: t('inr.wandKop'),
    uitleg: t(schermen.length ? 'inr.wandPerScherm' : inlog ? 'inr.wandInlog' : 'inr.wandHA'),
    inhoud: `<div class="rijen">${instellen}
        ${schermen.length ? schermen.map(schermRij).join('') : ''}
        ${!schermen.length && inlog ? `<div class="erbij"><div class="qr" role="img" aria-label="${esc(t('bewoners.qr'))}">${qrVan(appAdres())}</div><span class="zacht" style="padding: 0">${esc(t('inr.geenBewoner'))}</span></div>` : ''}
      </div>`,
  };
}
async function bewaarVoorkeur(body) {
  const uit = await stuur('api/voorkeuren', body);
  if (uit) d.voork = uit;
  teken();
  return uit;
}

/*
 * Staat alles klaar? (besluit 179 en 190): wat SunArc in Home Assistant
 * gebruikt, zoals bij Wat je huis kan. Oranje mist nog; in Home Assistant
 * opent een tik dat scherm.
 */
const KLAAR_STIP = { klaar: 'var(--mint)', mist: 'var(--gloed)', optioneel: 'var(--gedempt)' };
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
/** Naar Klaarzetten per functie (besluit 246): hoeveel er voor iedereen nog open is. */
function klaarRegel() {
  const open = (d.klaar?.functies ?? []).filter((f) => f.niveau === 'iedereen').reduce((n, f) => n + f.stappen.filter((s) => s.stand === 'open').length, 0);
  return `<div class="lijst">${regel({ tag: 'a', attrs: 'href="klaarzetten.html"', ik: 'lijst', titel: t('inr.kz.titel'), zin: t('inr.kz.zin'), rechts: open ? String(open) : '›', toon: open ? 'zon' : '' })}</div>`;
}
function haStap() {
  const punten = d.klaar?.punten ?? [];
  const inHA = app.inHA();
  const rijen = punten.map((p) => `<div class="klaarregel"><i style="background: ${KLAAR_STIP[p.stand] ?? 'var(--gedempt)'}"></i><span class="tekst"><b>${esc(p.titel)}</b><span>${esc(p.zin)}</span>${!inHA && p.waar && p.stand !== 'klaar' ? `<small>${esc(p.waar)}</small>` : ''}</span>${inHA && p.pad && p.stand !== 'klaar' ? `<button type="button" class="chip" data-ha-pad="${esc(p.pad)}" aria-label="${esc(t('kan.klaar.openIn', { titel: p.titel }))}">${esc(t('kan.klaar.open'))}</button>` : '<span></span>'}</div>`).join('');
  return {
    waar: waarVan('ha'),
    kop: t('inr.ha.kop'),
    uitleg: t(inHA ? 'inr.ha.zin' : 'inr.ha.zinBuiten'),
    inhoud: `${assistentBlok()}${klaarRegel()}<div class="rijen lijst klaarlijst">${rijen || `<p class="zacht">${esc(t('inr.lezen'))}</p>`}</div>${tip(t('inr.ha.tip'))}`,
  };
}

/*
 * Hoe praat je huis (besluit 203, schets Wand-Inrichten-Klaarzetten #stem): met
 * dit apparaat, zonder iets te installeren; of helemaal in huis met Whisper,
 * Piper en openWakeWord. Die installeer je zelf (de knop opent hun pagina in
 * Home Assistant); daarna maakt de add-on de spraakassistent met één tik.
 */
const ADDON_NAAM = { whisper: 'Whisper', piper: 'Piper', openwakeword: 'openWakeWord' };
let inHuisKijk = null;
function stemStap() {
  const c = functiesNu();
  const p = c?.praten ?? {};
  const huis = p.stem === 'huis';
  const kanBrowser = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  // Wat bij een keuze hoort, staat alleen onder de gekozen: zo past het op de wand.
  const keuze = (waarde, aan, kop, label, toon, zin, onder) =>
    `<div class="stemkeuze${aan ? ' aan' : ''}"><button type="button" class="keuzekop" data-stembron="${waarde}" aria-pressed="${aan}"><span class="rond" aria-hidden="true"></span><span><b>${esc(kop)} <span class="label ${toon}">${esc(label)}</span></b><span class="zin">${esc(zin)}</span></span></button>${aan && onder ? `<div class="onder">${onder}</div>` : ''}</div>`;
  const verstaan = `<div class="schakelrij"><span>${esc(t('inr.stem.verstaan'))}</span>${schakelaar(`data-stemverstaan="${p.verstaan === false}"`, t('inr.stem.verstaanLabel'), p.verstaan !== false)}</div>${kanBrowser ? '' : `<p class="mini">${esc(t('inr.stem.kanNiet'))}</p>`}`;
  return {
    waar: waarVan('stem'),
    kop: t('inr.stem.kop'),
    uitleg: t('inr.stem.zin'),
    inhoud: c
      ? `<div class="keuzes-stem" role="group" aria-label="${esc(t('inr.stem.kop'))}">
          ${keuze('apparaat', !huis, t('inr.stem.apparaat'), t('inr.stem.meteen'), 'mint', t('inr.stem.apparaatZin'), verstaan)}
          ${keuze('huis', huis, t('inr.stem.huis'), t('inr.stem.gevorderd'), 'gedempt', t('inr.stem.huisZin'), inHuisOnder())}
        </div>`
      : `<p class="zacht">${esc(t('inr.lezen'))}</p>`,
  };
}
/** Onder Helemaal in huis: de drie add-ons, en de spraakassistent maken. */
function inHuisOnder() {
  const ih = d.inHuis;
  // Buiten de add-on (of geen beheerder): wat je zelf in Home Assistant doet.
  if (!ih) return `<p class="mini">${esc(t('inr.stem.zelf'))}</p>`;
  const inHA = app.inHA();
  const rijen = ih.addons
    .map((a) => {
      const rechts = a.staat === 'aan' ? `<span class="ok">${esc(t('inr.stem.staatErin'))}</span>` : a.staat === 'gevonden' ? `<span class="ok gevonden">${esc(t('inr.stem.gevonden'))}</span>` : inHA ? `<button type="button" class="knop knop-klein" data-ha-pad="/hassio/addon/${esc(a.slug)}/info">${esc(t('inr.stem.installeer'))}</button>` : `<span class="mini">${esc(t('inr.stem.inHA'))}</span>`;
      return `<div class="addon"><div><b>${esc(ADDON_NAAM[a.id] ?? a.id)}</b><span>${esc(t(`inr.stem.wat.${a.id}`))}</span></div>${rechts}</div>`;
    })
    .join('');
  // Loopt het, dan elke drie tellen kijken waar het is.
  if (ih.bezig && !inHuisKijk) {
    inHuisKijk = setTimeout(async () => {
      inHuisKijk = null;
      d.inHuis = await haal('api/stem-in-huis').catch(() => d.inHuis);
      if (!d.inHuis?.bezig) d.functies = await haal('api/functies').catch(() => d.functies);
      teken();
    }, 3000);
  }
  const kan = ih.addons.filter((a) => a.id !== 'openwakeword').every((a) => a.staat !== 'nee');
  // Klaar zonder "Hé huis": de laatste twee tikken in Home Assistant, met een knop naar elk.
  const owv = ih.addons.find((a) => a.id === 'openwakeword');
  const wekwoordKnoppen = !ih.assistent?.wekwoord && inHA
    ? `<div class="chips">${owv?.slug ? `<button type="button" class="knop knop-klein" data-ha-pad="/hassio/addon/${esc(owv.slug)}/info">${esc(t('inr.stem.herstartOwv'))}</button>` : ''}<button type="button" class="knop knop-klein" data-ha-pad="/config/voice-assistants/assistants">${esc(t('inr.stem.kiesWekwoord'))}</button></div>`
    : '';
  const onder = ih.assistent
    ? `<p class="mini klaar">${esc(t(ih.assistent.wekwoord ? 'inr.stem.klaarMet' : 'inr.stem.klaarZonder'))}</p>${wekwoordKnoppen}`
    : ih.bezig
      ? `<p class="mini" aria-live="polite">${esc(t('inr.stem.bezig'))}</p>`
      : `${ih.fout ? `<p class="mini fout">${esc(t('inr.as.fout', { fout: ih.fout }))}</p>` : ''}<button type="button" class="knop knop-licht" data-inhuis-maak ${kan ? '' : 'disabled'}>${esc(t(ih.fout ? 'inr.as.opnieuw' : 'inr.stem.maak'))}</button>${kan ? '' : `<p class="mini">${esc(t('inr.stem.eerst'))}</p>`}`;
  return `${rijen}${onder}`;
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
