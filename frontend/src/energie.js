/*
 * Energie (besluit 130, schets Wand-Instellingen-Energie): je panelen, je
 * aansluiting, je meters, wat je betaalt en je verwarming, in één groep.
 * Hier kwamen Zon en aansluiting (besluiten 103, 117, 122) en Meters en prijzen
 * (102, 110, 116) samen: het contract stond bij het een en de prijzen bij het
 * ander. Twee deuren in de dienst, één pagina; wat je verandert, wordt meteen
 * bewaard. Bewaren vraagt een beheerder.
 */
'use strict';

const { $$, esc, haal, nl } = app;

let zon = null;
/** Het huis (besluit 167): de thermostaten, voor wie de ketel aanzet. */
let huisData = null;
/** De aansluiting: wat de dienst zegt (`api/aansluiting`), en de antwoorden zoals ze nu zijn. */
let aInfo = null;
let a = null;
/** De meters en prijzen (`api/energie`). */
let eInfo = null;
let e = null;
/** Normaal en dal gekozen; los van de prijs, want die kan nog leeg zijn. */
let dubbel = false;
/** Een eigen hoofdzekering invullen; zolang die niet compleet is, staat hij hier. */
let zelf = null;
/**
 * Aanpassen van hoe de panelen liggen (besluit 157, panelen.js). `zelf`: Zelf
 * aanpassen is open, met de kant en het aantal (besluit 187).
 */
const ligStaat = { aanpassen: false, concept: null, zelf: false, na: () => teken() };
/** Daken en panelen (besluit 254, dakvlakken.js): welk scherm, en het vlak dat open staat. */
/** Of de rondleiding van Daken en panelen al geprobeerd is, op deze pagina. */
let rondjeGeprobeerd = false;
const dakStaat = { scherm: 'alle', concept: null, origineel: null, genomen: false, zicht: 'boven', gebouw: null, kandidaat: null, kaart: null, achterGezien: (() => {
  try {
    return localStorage.getItem('sc-dak-gezien');
  } catch {
    return null;
  }
})() };
/** Het deel dat het laatst getekend werd: wie Daken en panelen opent, begint bij de vlakken. */
let vorigDeel = null;
/** Auto en laadpaal (besluit 259, laden.js): welk apparaat rechts openstaat. */
const ladenStaat = { wie: null };

const leeg = () => ({ versie: 1, bron: 'zelf', net: { afname: [], teruglevering: [] }, zon: [], gas: null, apparaten: [], prijzen: { stroom: null, teruglevering: null, gas: null, vastPerMaand: null } });
/** Tarief 1 van een slimme meter is het daltarief (zelfde regel als de dienst, tarief.ts). */
const raadDal = (id) => /(?:tarief|tariff|tarif)[ _-]?1(?![0-9])|_t1(?![0-9a-z])|\blaag\b|\blow\b|dal[ _-]?tarief|(?:^|[^a-z])dal(?:[^a-z]|$)/i.test(id);

/** Vult aan wat een oudere instelling nog niet had, zodat het scherm één vorm kent. */
function aanvullen(c) {
  const p = c.prijzen;
  p.stroomDal ??= null;
  p.dalUren ??= 'nl';
  p.dalEigen ??= { van: 23, tot: 7, weekend: true };
  p.salderen ??= true;
  p.vanaf2027 ??= { vergoeding: null, kosten: null };
  p.vast ??= [];
  p.contractStart ??= null;
  if (p.vastPerMaand != null && !p.vast.length) p.vast.push({ naam: t('energie.vasteKosten'), bedrag: p.vastPerMaand, per: 'maand', soort: 'stroom' });
  p.vastPerMaand = null;
  c.net.dal ??= [...c.net.afname, ...c.net.teruglevering].filter(raadDal);
  return c;
}

async function laadAlles() {
  const [ai, ei, z, h] = await Promise.allSettled([haal('api/aansluiting'), haal('api/energie'), haal('api/zon'), haal('api/huis')]);
  if (z.status === 'fulfilled') zon = z.value;
  // De thermostaten uit het huis (besluit 167): welke de ketel stuurt.
  if (h.status === 'fulfilled') huisData = h.value;
  if (ai.status === 'fulfilled') {
    aInfo = ai.value;
    const x = aInfo.antwoorden;
    a = {
      panelen: { ligging: x?.panelen.ligging ?? null, aantal: x?.panelen.aantal ?? null, voorkant: x?.panelen.voorkant ?? null, achterkant: x?.panelen.achterkant ?? null },
      zekering: x?.zekering ?? null,
      tarief: x?.tarief ?? null,
      verwarming: { soort: x?.verwarming?.soort ?? null, aanvoerC: x?.verwarming?.aanvoerC ?? null, thermostaat: x?.verwarming?.thermostaat ?? null },
      voorkantZon: x?.voorkantZon ?? null,
      dak: x?.dak ?? null,
      // Panelen op de garage, carport of het tuinhuis (besluit 187).
      elders: { ...(x?.elders ?? {}) },
      // Daken en panelen (besluit 254): elk vlak apart, als de bewoner ze bewaarde.
      daken: x?.daken ?? null,
      opZon: { ...(x?.opZon ?? {}) },
      // Apparaten uit de configuratie die van zon zijn gehaald (besluit 167): gaan mee.
      opZonUit: [...(x?.opZonUit ?? [])],
      // Auto en laadpaal (besluit 259): wat de bewoner uitzette of zelf koos, en per auto de instelling.
      laden: JSON.parse(JSON.stringify(x?.laden ?? { aan: {}, rol: {}, instelling: {} })),
    };
  }
  if (ei.status === 'fulfilled') {
    eInfo = ei.value;
    e = aanvullen(JSON.parse(JSON.stringify(eInfo.instellingen ?? eInfo.voorstel ?? leeg())));
    dubbel = e.prijzen.stroomDal != null;
  }
  teken();
}

/* ------------------------------------------------------------ hulpjes */

const gelijk = (x, y) => JSON.stringify(x) === JSON.stringify(y);

/** Een rij keuzes waarvan er één aan staat; de waarde staat als JSON op de knop. */
function keuzes(label, sleutel, opties, huidig, uit = false) {
  return `<div class="keuzes" role="group" aria-label="${esc(label)}">${opties.map(([w, x]) => `<button type="button" data-kies="${esc(sleutel)}" data-waarde='${esc(JSON.stringify(w))}' aria-pressed="${gelijk(w, huidig)}" ${uit ? 'disabled' : ''}>${esc(x)}</button>`).join('')}</div>`;
}
function bedragVeld(label, pad, waarde, hint = '', min = '0', leegIsFout = false) {
  return `<label class="veldnaam">${esc(label)}<input class="invoer${leegIsFout && waarde == null ? ' leeg' : ''}" type="number" inputmode="decimal" step="any" ${min === '' ? '' : `min="${min}"`} data-prijs="${esc(pad)}" value="${waarde ?? ''}" placeholder="${esc(hint)}"></label>`;
}
const kop = (titel, rechts = '') => `<div class="kopregel"><h2 class="kop-2">${esc(titel)}</h2>${rechts}</div>`;
const blok = (titel, inhoud) => `<div class="deelvraag">${titel ? `<h3 class="kop-3">${esc(titel)}</h3>` : ''}${inhoud}</div>`;
/** Op de wand twee kolommen naast elkaar, zodat een deel zonder scrollen past (besluit 163); op de telefoon onder elkaar. */
const kolommen = (links, rechts) => `<div class="kolommen"><div>${links}</div><div>${rechts}</div></div>`;
const naamVan = (id) => eInfo?.meters?.find((m) => m.id === id)?.naam ?? id;

/* ------------------------------------------------------------ de delen */

function zekeringNu() {
  return a?.zekering && a.zekering !== 'weetniet' ? a.zekering : aInfo?.configuratie?.zekering ?? null;
}

function delen() {
  const p = e?.prijzen;
  const vlakken = aInfo?.daken?.vlakken ?? [];
  const geen = a?.panelen.ligging === 'geen';
  const z = zekeringNu();
  // Een prijs per uur is ook een stroomprijs (issue 126).
  const prijsMist = e && ((p.stroom == null && !p.dynamisch) || (e.gas && p.gas == null));
  const soort = a?.verwarming.soort ? t(`energie.soort.${a.verwarming.soort}`) : null;
  return [
    { id: 'panelen', titel: t('daken.titel'), zin: dakvlakken.kortZin(aInfo?.daken) ?? (geen ? t('daken.geen') : t('instellingen.nogKiezen')), stand: !aInfo ? null : vlakken.length || geen ? 'goed' : 'mist' },
    { id: 'aansluiting', titel: t('energie.aansluiting'), zin: z ? `${z.fasen} × ${z.ampere} A` : t('energie.zekeringKiezen'), stand: !aInfo ? null : z ? 'goed' : 'mist' },
    { id: 'meters', titel: t('energie.meters'), zin: e ? [e.net.afname.length ? t('energie.stroom') : null, e.gas ? t('energie.gas') : null, e.apparaten.length ? t('energie.nApparaten', { n: e.apparaten.length }) : null].filter(Boolean).join(', ') || t('instellingen.nogKiezen') : '…', stand: !e ? null : e.net.afname.length ? 'goed' : 'mist' },
    { id: 'prijzen', titel: t('energie.prijzen'), zin: !e ? '…' : p.dynamisch ? t('energie.prijsPerUur') : p.stroom == null ? t('energie.prijsMist') : t('energie.prijsPerKwh', { prijs: nl(p.stroom, 2) }), stand: !e ? null : prijsMist ? 'mist' : 'goed' },
    { id: 'verwarming', titel: t('energie.verwarming'), zin: soort ? (a.verwarming.aanvoerC ? t('energie.aanvoer', { soort, c: a.verwarming.aanvoerC }) : soort) : t('instellingen.nogKiezen'), stand: !aInfo ? null : a.verwarming.soort ? 'goed' : 'leeg' },
    // Auto en laadpaal (besluit 259): niets gevonden mist niet; niet elk huis heeft een auto.
    { id: 'auto', titel: t('laden.titel'), zin: laden.kortZin(aInfo) ?? '…', stand: !aInfo ? null : (aInfo.laden?.apparaten ?? []).some((x) => x.aan) ? 'goed' : 'leeg' },
  ];
}

/* Zonnepanelen */

function elke(s) {
  if (s == null) return null;
  if (s < 90) return t('energie.elkeMinuut');
  if (s < 5400) return t('energie.elkeMinuten', { n: Math.round(s / 60) });
  return t('energie.elkUur', { n: Math.round(s / 3600) });
}

/** Het huis bij Zonnepanelen (besluit 187): de gemeten ligging op het dak, met de graden erbij. */
function tekenPanelenHuis() {
  const el = document.querySelector(`${app.zicht()} [data-pan-podium]`);
  if (!el || !huisData || !a) return;
  const tek = huismodel.tekening(huisData, { zon, kamer: (r) => ({ ...huismodel.kamerModel(r, null), stil: true, temp: null, zin: null, stand: null }) });
  const v = aInfo?.ligging;
  const el2 = a.elders ?? {};
  const delen = huismodel.huisDelen(tek, el2);
  const d = aInfo?.daken;
  const leert = !d?.vlakken.length || d.vlakken.every((x) => x.bron === 'schatting');
  // Per vlak de letter op het huis (besluit 254), voor zover de tekening het vlak kent.
  const op = d ? dakvlakken.opHetHuis(d, a, tek) : { labels: [], mist: [] };
  // Op de telefoon geen labels: daar passen ze niet, en de lijst eronder zegt hetzelfde.
  const labels = app.telStand() ? [] : op.labels;
  huis.teken(el, {
    beschrijving: t('panelen3.huisLabel'),
    tijd: 'dag',
    seizoen: 'zomer',
    // De echte zon met de ring van vandaag (besluit 205); op de telefoon zonder ring.
    zon: { stand: 0.68, aandeel: 0.8, ...(huismodel.zonNu(zon) ?? {}), ...(app.telStand() ? { geenRing: true } : {}), ...huismodel.panelenOpDak(a.panelen, tek.piekW) },
    ...(leert ? { spook: ['panelen'] } : {}),
    wolken: 0.1,
    ...(huismodel.kompasVan(v, a.panelen) ? { kompas: { ...huismodel.kompasVan(v, a.panelen), groot: true } } : {}),
    // Het huis zelf, zoals elke pagina het tekent (besluit 191), met de panelen op een ander dak.
    ...delen,
    buitenunit: null,
    balkon: null,
    voortuin: null,
    // Zonder auto op de oprit: daar staat het grote kompas.
    oprit: delen.oprit ? { ...delen.oprit, auto: null } : null,
    labels,
  }, { breedte: el.clientWidth || 440, hoogte: el.clientHeight || 420, marge: 0.05, schuifY: 16 });
  const noot = dakvlakken.nietGetekend(op.mist);
  if (noot) el.insertAdjacentHTML('beforeend', `<p class="dk-noot">${esc(noot)}</p>`);
}

function zonnesensorBlok() {
  const z = aInfo.zonnesensor;
  if (!z) return '';
  const chip = z.snelGenoeg == null ? ['', t('energie.sensor.gemeten')] : z.snelGenoeg ? ['goed', t('energie.sensor.snel')] : ['traag', t('energie.sensor.traag')];
  const sensorZin = z.intervalS == null ? t('energie.sensor.meet') : z.snelGenoeg ? (z.merk ? t('energie.sensor.snelMerk', { merk: z.merk, elke: elke(z.intervalS) }) : t('energie.sensor.snelZin', { elke: elke(z.intervalS) })) : t('energie.sensor.traagZin', { elke: elke(z.intervalS) });
  return blok('', `<div class="kopregel"><h3 class="kop-3">${esc(t('energie.sensor.kop'))}</h3><span class="label-chip ${chip[0]}">${esc(chip[1])}</span></div>
    <p class="uitleg">${esc(sensorZin)}</p>
    ${z.snelGenoeg === false && z.weg ? `<p class="mini">${esc(t('energie.sensor.lokaal', { weg: z.weg }))}</p>` : ''}`);
}

/** Daken en panelen (besluit 254): elk vlak apart, met het huis ernaast. */
function panelenVorm() {
  return dakvlakken.vorm(aInfo.daken, dakStaat, {
    helderW: zon?.heldereLuchtW ?? null,
    omvormers: blok(t('energie.omvormersKop'), vermogens.zonBlok(aInfo, a)),
    // De zonnesensor alleen als hij te traag is: dan is er iets te doen.
    sensor: aInfo.zonnesensor?.snelGenoeg === false ? zonnesensorBlok() : '',
    geen: a.panelen.ligging === 'geen',
  });
}

/* Aansluiting */

const GANGBAAR = [
  { fasen: 1, ampere: 25 },
  { fasen: 1, ampere: 35 },
  { fasen: 1, ampere: 40 },
  { fasen: 3, ampere: 25 },
  { fasen: 3, ampere: 35 },
  { fasen: 3, ampere: 40 },
  { fasen: 3, ampere: 50 },
];

function aansluitingVorm() {
  const uitConfig = aInfo.configuratie.zekering;
  const huidig = a.zekering ?? uitConfig;
  const anders = huidig && huidig !== 'weetniet' && !GANGBAAR.some((z) => gelijk(z, huidig));
  const fasen = aInfo.gevonden.fasen.length;
  const noot = a.zekering == null && uitConfig
    ? t('energie.uitConfig', { fasen: uitConfig.fasen, ampere: uitConfig.ampere })
    : fasen === 0
      ? t('energie.geenFase')
      : a.zekering?.fasen === 3 && fasen < 3
        ? t('energie.meetFasen', { fasen: t('energie.fase', { n: fasen }) })
        : t('energie.waarZekering');
  return `${kop(t('energie.aansluiting'))}
    ${zekeringNu() ? '' : `<div class="melding"><span class="stip" style="background: var(--gloed)"></span>${esc(t('energie.zonderZekering'))}</div>`}
    ${blok(t('instellingen.zekering'), `<p class="uitleg">${esc(t('energie.zekeringUitleg'))}</p>
      ${keuzes(t('instellingen.zekering'), 'zekering', [...GANGBAAR.map((z) => [z, `${z.fasen} × ${z.ampere} A`]), ...(anders ? [[huidig, `${huidig.fasen} × ${huidig.ampere} A`]] : []), ['anders', t('energie.anders')], ['weetniet', t('energie.weetNiet')]], zelf != null ? 'anders' : huidig)}
      ${zelf != null ? `<div class="twee"><label class="veldnaam">${esc(t('energie.fasen'))}<select class="invoer" data-zekering="fasen"><option value="1" ${zelf.fasen === 1 ? 'selected' : ''}>${esc(t('energie.eenFase'))}</option><option value="3" ${zelf.fasen === 3 ? 'selected' : ''}>${esc(t('energie.drieFasen'))}</option></select></label><label class="veldnaam">${esc(t('energie.ampere'))}<input class="invoer" type="number" inputmode="numeric" min="6" max="250" step="1" data-zekering="ampere" value="${zelf.ampere ?? ''}"></label></div>` : ''}
      <p class="mini">${esc(noot)}</p>`)}`;
}

/* Meters */

function inGebruik() {
  return new Set([...e.net.afname, ...e.net.teruglevering, ...e.zon, ...(e.gas ? [e.gas] : []), ...e.apparaten.map((x) => x.id)]);
}

function meterKeuze(label, plek, rol, soort, leegTekst = t('energie.meterErbij')) {
  const bezet = inGebruik();
  const vrij = (eInfo.meters ?? []).filter((m) => m.soort === soort && !bezet.has(m.id));
  if (!vrij.length) return '';
  const past = vrij.filter((m) => m.rol === rol);
  const rest = vrij.filter((m) => m.rol !== rol);
  // Dezelfde naam twee keer, zoals de stand en de maand van een stekker (besluit 264): dan het id erachter.
  const dubbel = new Set(vrij.map((m) => m.naam).filter((n, i, alle) => alle.indexOf(n) !== i));
  const opt = (m) => `<option value="${esc(m.id)}">${esc(dubbel.has(m.naam) ? `${m.naam} (${m.id.replace(/^sensor\./, '')})` : m.naam)}</option>`;
  const lijst = past.length && rest.length ? `<optgroup label="${esc(t('energie.pastHierbij'))}">${past.map(opt).join('')}</optgroup><optgroup label="${esc(t('energie.andereMeters'))}">${rest.map(opt).join('')}</optgroup>` : vrij.map(opt).join('');
  return `<select class="invoer" aria-label="${esc(label)}" data-meer="${plek}"><option value="">${esc(leegTekst)}</option>${lijst}</select>`;
}

function rol(plek, ids, rolNaam, soort, een = false) {
  const titel = t(`energie.rol.${plek}`);
  const tarief = (plek === 'afname' || plek === 'teruglevering') && dubbel;
  const dal = new Set(e.net.dal ?? []);
  const chips = ids.length
    ? ids.map((id) => `<span class="meterchip"><button type="button" data-weg="${plek}" data-id="${esc(id)}" aria-label="${esc(t('energie.weghalen', { naam: naamVan(id) }))}">${esc(naamVan(id))}<span aria-hidden="true">×</span></button>${tarief ? `<button type="button" class="tariefknop" data-tarief="${esc(id)}" aria-label="${esc(t('energie.dalOfNormaal', { naam: naamVan(id) }))}">${esc(t(dal.has(id) ? 'energie.dal' : 'energie.normaal'))}</button>` : ''}</span>`).join('')
    : `<span class="mini">${esc(t('energie.geen'))}</span>`;
  return `<div style="display: flex; flex-direction: column; gap: 6px; padding: 6px 0">
    <b style="font-size: 14px">${esc(titel)}</b>
    <div class="meterchips">${chips}</div>
    ${!een || !ids.length ? meterKeuze(t('energie.erbijLabel', { titel }), plek, rolNaam, soort) : ''}
  </div>`;
}

function metersVorm() {
  const v = eInfo.voorstel;
  const wat = v ? [
    v.net.afname.length ? t('energie.wat.afname') : null,
    v.net.teruglevering.length ? t('energie.wat.teruglevering') : null,
    v.zon.length ? t('energie.wat.zon') : null,
    v.gas ? t('energie.wat.gas') : null,
    v.apparaten.length ? t('energie.wat.apparaten', { n: v.apparaten.length }) : null,
  ].filter(Boolean) : [];
  const lijst = wat.length > 1 ? `${wat.slice(0, -1).join(', ')} ${t('algemeen.en')} ${wat.at(-1)}` : wat[0];
  const uitHa = v
    ? blok(t('energie.uitHA'), `<p class="uitleg">${esc(t('energie.inDashboard', { lijst: lijst ?? t('energie.geenMeters') }))}</p><button type="button" class="knop" data-overnemen style="align-self: start">${esc(t('energie.overnemen'))}</button>`)
    : blok(t('energie.uitHA'), `<p class="uitleg">${esc(eInfo.fout ?? t('energie.geenDashboard'))}</p>`);
  const rijen = e.apparaten.map((x, i) => `<div class="regelrij"><div class="l"><input class="invoer" data-apparaatnaam="${i}" value="${esc(x.naam)}" maxlength="40" aria-label="${esc(t('energie.naamVan', { naam: naamVan(x.id) }))}"><span>${esc(naamVan(x.id))}</span></div><button type="button" class="knop" data-apparaat-weg="${i}" aria-label="${esc(t('energie.weghalen', { naam: x.naam }))}">${esc(t('energie.weg'))}</button></div>`).join('');
  const apparatenBlok = blok(t('energie.eigenMeter'), `${rijen || `<p class="uitleg">${esc(t('energie.nogGeenApparaat'))}</p>`}${meterKeuze(t('energie.apparaatErbij'), 'apparaat', 'apparaat', 'energy', t('energie.apparaatErbijLeeg'))}`);
  return `${kop(t('energie.meters'))}
    ${e.net.afname.length ? '' : `<div class="melding"><span class="stip" style="background: var(--gloed)"></span>${esc(t('stand.metersZin'))}</div>`}
    ${kolommen(`${uitHa}${aInfo && a ? blok(t('energie.vermogenKop'), vermogens.netBlok(aInfo, a)) : ''}${apparatenBlok}`, blok(t('energie.welkeMeter'), `${rol('afname', e.net.afname, 'afname', 'energy')}${rol('teruglevering', e.net.teruglevering, 'teruglevering', 'energy')}${rol('zon', e.zon, 'zon', 'energy')}${rol('gas', e.gas ? [e.gas] : [], 'gas', 'volume', true)}${dubbel ? `<p class="mini">${esc(t('energie.tikDal'))}</p>` : ''}`))}`;
}

/* Contract en prijzen */

/** Eigen daltijden (besluit 178): van welk uur tot welk uur, en het weekend. */
function eigenDal(d) {
  const uren = (sleutel, huidig) => `<select class="invoer" data-daleigen="${sleutel}" aria-label="${esc(t(sleutel === 'van' ? 'energie.dalVanaf' : 'energie.dalTot'))}">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === huidig ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('')}</select>`;
  return `<div class="twee"><label class="veldnaam">${esc(t('energie.vanaf'))}${uren('van', d.van)}</label><label class="veldnaam">${esc(t('energie.tot'))}${uren('tot', d.tot)}</label></div>
    ${keuzes(t('energie.weekend'), 'dalWeekend', [[true, t('energie.weekendDal')], [false, t('energie.weekendGewoon')]], d.weekend)}
    <p class="mini">${esc(t('energie.feestdagen'))}</p>`;
}

/** Posten om mee te beginnen, in de taal van de app; de naam wordt bewaard zoals hij er dan staat. */
const VOORSTELLEN = [
  { naam: 'leveringStroom', per: 'dag', soort: 'stroom' },
  { naam: 'netStroom', per: 'dag', soort: 'stroom' },
  { naam: 'vermindering', per: 'dag', soort: 'stroom' },
  { naam: 'terugleverkosten', per: 'dag', soort: 'stroom' },
  { naam: 'leveringGas', per: 'dag', soort: 'gas' },
  { naam: 'netGas', per: 'dag', soort: 'gas' },
].map((x) => ({ ...x, naam: t(`energie.post.${x.naam}`) }));

function prijzenVorm() {
  const p = e.prijzen;
  const perMeter = () => {
    const dal = new Set(e.net.dal ?? []);
    return e.net.afname.some((id) => dal.has(id)) && e.net.afname.some((id) => !dal.has(id));
  };
  const dalTijden = !dubbel ? '' : perMeter()
    ? `<p class="mini">${esc(t('energie.meterApart'))}</p>`
    : `<span class="veldnaam">${esc(t('energie.wanneerDal'))}</span>${keuzes(t('energie.daltarief'), 'dalUren', ['nl', 'zuid', 'eigen'].map((x) => [x, t(`energie.dal.${x}`)]), p.dalUren)}${p.dalUren === 'eigen' ? eigenDal(p.dalEigen) : ''}`;
  const opt = (lijst, huidig) => lijst.map(([w, x]) => `<option value="${w}" ${w === huidig ? 'selected' : ''}>${esc(x)}</option>`).join('');
  const posten = p.vast.map((v, i) => `<div class="vastrij">
      <input class="invoer" data-vast="naam" data-i="${i}" value="${esc(v.naam)}" maxlength="40" aria-label="${esc(t('energie.naamPost'))}">
      <div class="vastregel">
        <input class="invoer${v.bedrag == null ? ' leeg' : ''}" type="number" inputmode="decimal" step="any" data-vast="bedrag" data-i="${i}" value="${v.bedrag ?? ''}" aria-label="${esc(t('energie.bedragVan', { naam: v.naam }))}">
        <select class="invoer" data-vast="per" data-i="${i}" aria-label="${esc(t('energie.per'))}">${opt(['dag', 'maand', 'jaar'].map((x) => [x, t(`energie.per.${x}`)]), v.per)}</select>
        <select class="invoer" data-vast="soort" data-i="${i}" aria-label="${esc(t('energie.stroomOfGas'))}">${opt([['stroom', t('energie.stroom')], ['gas', t('energie.gas')]], v.soort)}</select>
        <button type="button" class="knop" data-vast-weg="${i}" aria-label="${esc(t('energie.weghalen', { naam: v.naam }))}">×</button>
      </div>
    </div>`).join('');
  const erbij = VOORSTELLEN.filter((x) => !p.vast.some((v) => v.naam.toLowerCase() === x.naam.toLowerCase()));
  // Bij een prijs per uur is een vaste stroomprijs niet nodig (issue 126).
  const mist = p.stroom == null && !p.dynamisch ? t('energie.mistStroom') : e.gas && p.gas == null ? t('energie.mistGas') : '';
  // Een prijs per uur (testerronde, november 2026): Opbrengst rekent dan met de kostentellers van Home Assistant.
  const dynKan = !p.dynamisch ? eInfo?.voorstel?.prijzen?.dynamisch ?? null : null;
  // Kent Home Assistant de prijs per uur nog niet, dan zegt het hier wat er mist en welke sensor hem al geeft (issue 119).
  const sensor = eInfo?.prijsSensoren?.[0] ?? null;
  const uurprijsMist = a?.tarief === 'dynamisch' && !p.dynamisch && !dynKan
    ? `<div class="melding" data-uurprijs-mist><span class="stip" style="background: var(--gloed)"></span><span>${esc(t('energie.uurprijsMist'))}${sensor ? ` ${esc(t(sensor.prijs != null ? 'energie.uurprijsSensor' : 'energie.uurprijsSensorZonder', { naam: sensor.naam, prijs: sensor.prijs != null ? taal.geld(sensor.prijs, 2) : '' }))}` : ''} ${app.inHA() ? `<button type="button" class="knop-tekst" data-uurprijs-ha>${esc(t('energie.uurprijsOpenHA'))}</button> ` : ''}<button type="button" class="knop-tekst" data-uurprijs-opnieuw>${esc(t('energie.uurprijsOpnieuw'))}</button></span></div>`
    : '';
  const uurprijs = p.dynamisch
    ? `<div class="melding"><span class="stip" style="background: var(--mint)"></span><span>${esc(eInfo?.prijsNu != null ? t('energie.uurprijsAan', { prijs: taal.geld(eInfo.prijsNu, 2) }) : t('energie.uurprijsAanZonder'))} <button type="button" class="knop-tekst" data-uurprijs-uit>${esc(t('energie.uurprijsUit'))}</button></span></div>`
    : dynKan
      ? `<div class="melding"><span class="stip" style="background: var(--gloed)"></span><span>${esc(t('energie.uurprijsKan'))} <button type="button" class="knop-tekst" data-uurprijs>${esc(t('energie.uurprijsOvernemen'))}</button></span></div>`
      : uurprijsMist;
  // Met een prijs per uur (issue 126): geen normaal en dal, en de stroomprijs is een gemiddelde dat mag ontbreken.
  const stroomBlok = p.dynamisch
    ? `<p class="uitleg">${esc(t('energie.stroomPerUur'))}</p>
      ${bedragVeld(t('energie.stroomGemiddeld'), 'stroom', p.stroom, nl(0.25, 2))}`
    : `${keuzes(t('energie.tarief'), 'stroomtarief', [['enkel', t('energie.enkel')], ['dubbel', t('energie.dubbel')]], dubbel ? 'dubbel' : 'enkel')}
      <div class="${dubbel ? 'twee' : ''}">${bedragVeld(t(dubbel ? 'energie.normaalKwh' : 'energie.perKwh'), 'stroom', p.stroom, nl(0.27, 2), '0', true)}${dubbel ? bedragVeld(t('energie.dalKwh'), 'stroomDal', p.stroomDal, nl(0.25, 2), '0', true) : ''}</div>
      <p class="mini">${esc(t('energie.totaalprijs'))}</p>${dalTijden}`;
  // Teruglevering per uur, als Home Assistant die telt; anders zegt het wat er mist, en blijven de bedragen.
  const terugKan = p.dynamisch && !p.dynamisch.terug.length && eInfo?.voorstel?.prijzen?.dynamisch?.terug?.length;
  const terugVast = `${keuzes(t('energie.salderen'), 'salderen', [[true, t('energie.salderenTot')], [false, t('energie.geenSalderen')]], p.salderen)}
      ${p.salderen ? `<p class="uitleg">${esc(t(p.dynamisch ? 'energie.salderenUurprijs' : 'energie.salderenUitleg'))}</p>
      ${bedragVeld(t('energie.vergoedingBoven'), 'teruglevering', p.teruglevering, nl(0.15, 2))}` : `<p class="uitleg">${esc(t('energie.zonderSalderen'))}</p>`}
      <span class="veldnaam" style="margin-top: 4px">${esc(t(p.salderen ? 'energie.vanaf2027' : 'energie.krijgenBetalen'))}</span>
      <div class="twee">${bedragVeld(t('energie.jeKrijgt'), 'vanaf2027.vergoeding', p.vanaf2027.vergoeding, nl(0.07, 2))}${bedragVeld(t('energie.jeBetaalt'), 'vanaf2027.kosten', p.vanaf2027.kosten, nl(0.06, 2))}</div>`;
  const terugBlok = !p.dynamisch
    ? terugVast
    : p.dynamisch.terug.length
      ? `<div class="melding"><span class="stip" style="background: var(--mint)"></span><span>${esc(t('energie.terugPerUur'))}</span></div>`
      : `<div class="melding" data-terug-niet-per-uur><span class="stip" style="background: var(--gloed)"></span><span>${esc(t(terugKan ? 'energie.terugPerUurKan' : 'energie.terugNietPerUur'))} ${terugKan ? `<button type="button" class="knop-tekst" data-uurprijs>${esc(t('energie.uurprijsOvernemen'))}</button>` : `${app.inHA() ? `<button type="button" class="knop-tekst" data-uurprijs-ha>${esc(t('energie.uurprijsOpenHA'))}</button> ` : ''}<button type="button" class="knop-tekst" data-uurprijs-opnieuw>${esc(t('energie.uurprijsOpnieuw'))}</button>`}</span></div>
      ${terugVast}`;
  return `${kop(t('energie.prijzen'))}
    ${mist ? `<div class="melding"><span class="stip" style="background: var(--gloed)"></span>${esc(mist)}</div>` : ''}
    ${kolommen(`${blok(t('energie.soortContract'), `${keuzes(t('energie.soortContract'), 'contract', [['vast', t('energie.contract.vast')], ['dynamisch', t('energie.contract.dynamisch')], ['weetniet', t('energie.weetNiet')]], a?.tarief ?? null, !a)}
      <p class="mini">${esc(t('energie.dynamischUitleg'))}</p>
      ${uurprijs}
      <label class="veldnaam">${esc(t('energie.contractStart'))}<input class="invoer" type="date" data-contract value="${esc(p.contractStart ?? '')}" min="2000-01-01" max="2100-12-31"></label>
      <p class="mini">${esc(t('energie.contractUitleg'))}</p>`)}${blok(t('energie.stroomKop'), stroomBlok)}${e.gas ? blok(t('energie.gasKop'), `${bedragVeld(t('energie.perM3'), 'gas', p.gas, nl(1.36, 2), '0', true)}<p class="mini">${esc(t('energie.gasTotaal'))}</p>`) : ''}`, `${blok(t('energie.teruglevering'), terugBlok)}${blok(t('energie.vasteKosten'), `${posten || `<p class="uitleg">${esc(t('energie.geenPosten'))}</p>`}
      <div class="meterchips">${erbij.map((x) => `<button type="button" data-vast-erbij="${esc(x.naam)}">+ ${esc(x.naam)}</button>`).join('')}<button type="button" data-vast-erbij="">${esc(t('energie.anderePost'))}</button></div>
      <p class="mini">${esc(t('energie.postUitleg'))}</p>`)}`)}`;
}

/* Verwarming */

/**
 * De thermostaat die de ketel stuurt (besluit 167), zoals een Nest. Niets
 * gekozen: het voorstel uit Home Assistant. De radiatoren gaan daarmee aan.
 */
function thermostaatKeuze(v) {
  const lijst = huismodel.thermostaten(huisData);
  const voorstel = lijst[0];
  const nu = v.thermostaat ?? '';
  const opties = [['', voorstel ? t('energie.thermostaatUitHA', { naam: voorstel.naam, kamer: voorstel.kamer }) : t('energie.geenThermostaatHA')], ...lijst.map((x) => [x.sleutel, t('energie.naamKamer', { naam: x.naam, kamer: x.kamer })]), ['geen', t('energie.geenThermostaat')]];
  return `<label class="veldnaam">${esc(t('energie.thermostaatKetel'))}<select class="invoer" data-thermostaat>${opties.map(([w, x]) => `<option value="${esc(w)}" ${w === nu ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      <p class="mini">${esc(t('energie.thermostaatUitleg'))}</p>`;
}

function verwarmingVorm() {
  const v = a.verwarming;
  return `${kop(t('energie.verwarming'))}
    ${blok(t('energie.waarWarmte'), `${keuzes(t('energie.verwarming'), 'verwarming', [...['cv', 'warmtepomp', 'hybride', 'stadsverwarming'].map((x) => [x, t(`energie.bron.${x}`)]), ['weetniet', t('energie.weetNiet')]], v.soort)}
      <label class="veldnaam">${esc(t('energie.aanvoerLabel'))}<input class="invoer" type="number" inputmode="numeric" min="25" max="90" step="1" data-aanvoer value="${v.aanvoerC ?? ''}" placeholder="${esc(t('energie.bijvoorbeeld60'))}"></label>
      <p class="mini">${esc(t('energie.aanvoerUitleg'))}</p>
      ${v.soort === 'stadsverwarming' ? '' : thermostaatKeuze(v)}`)}`;
}

/* Ernaast */

/** Per deel hoeveel punten er bij "Waarvoor dit nodig is" staan (energie.naast.<deel>.<n>). */
const NAAST = { panelen: 2, aansluiting: 2, meters: 2, prijzen: 3, verwarming: 2, auto: 2 };

function naast(id) {
  const deel = NAAST[id] ? id : 'panelen';
  const lijst = Array.from({ length: NAAST[deel] }, (_, i) => t(`energie.naast.${deel}.${i + 1}`));
  // De ligging van de panelen gaat meteen in (besluit 157); de zekering, de netmeter en de omvormers na een start.
  const laterZin = { aansluiting: 'energie.zekeringLater', meters: 'energie.later', panelen: 'energie.later' }[id];
  // Met een knop om meteen opnieuw te starten (testerronde, november 2026).
  const later = aInfo?.volgendeStart && laterZin ? `<div class="glas"><h3>${esc(t('regeling.ingaat'))}</h3><p style="margin: 0">${esc(t(laterZin))}</p><button type="button" class="knop" data-herstart style="align-self: start; margin-top: 8px">${esc(t('basis.herstart'))}</button></div>` : '';
  return `<div class="glas"><h3>${esc(t('energie.waarvoor'))}</h3><ul>${lijst.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <div class="glas"><h3>${esc(t('energie.waarVind'))}</h3><p style="margin: 0">${esc(t(`energie.naast.${deel}.waar`))}</p></div>${later}`;
}
/* ------------------------------------------------------------ tekenen */

function tekenNu() {
  app.schaal();
  app.luchtVan(zon, 0);
  if (!aInfo && !eInfo) return;
  // Niet onder de vinger opnieuw opbouwen.
  if (document.activeElement?.matches('input:not([type="date"]):not([type="range"])')) return;
  const nu = groep.tekenDelen(delen());
  // Op de telefoon is de lijst zonder deel in het adres: dan staat er geen deel open.
  const open = location.hash.length > 1 ? nu : null;
  if (open === 'panelen' && vorigDeel !== 'panelen') Object.assign(dakStaat, { scherm: 'alle', concept: null, origineel: null, genomen: false, gebouw: null, kandidaat: null });
  vorigDeel = open;
  const wacht = `<p class="klein">${esc(t('algemeen.laden'))}…</p>`;
  const vorm = {
    panelen: () => (a ? panelenVorm() : wacht),
    aansluiting: () => (a ? aansluitingVorm() : wacht),
    meters: () => (e ? metersVorm() : wacht),
    prijzen: () => (e ? prijzenVorm() : wacht),
    verwarming: () => (a ? verwarmingVorm() : wacht),
    auto: () => (a ? laden.vorm(aInfo, a, ladenStaat) : wacht),
  }[nu]?.() ?? wacht;
  // Een eigen voorvoegsel per scherm voor de namen in de tekening van boven (besluit 254): wand en telefoon staan allebei in de pagina.
  // Wat schuift (de rechterkolom van Daken en panelen) houdt zijn plek bij opnieuw tekenen (6 november 2026).
  $$('[data-vorm]').forEach((el, i) => {
    const plek = [...el.querySelectorAll('.pan-rechts')].map((x) => x.scrollTop);
    el.innerHTML = vorm.replaceAll('dkid-', `dk${i}-`);
    el.querySelectorAll('.pan-rechts').forEach((x, j) => (x.scrollTop = plek[j] ?? 0));
  });
  $$('[data-naast]').forEach((el) => (el.innerHTML = naast(nu)));
  if (nu === 'panelen') tekenPanelenHuis();
  // De eerste keer Daken en panelen (besluit 254): een eigen korte rondleiding, als de vlakken er staan.
  if (open === 'panelen' && aInfo?.daken && dakStaat.scherm === 'alle' && !rondjeGeprobeerd) {
    rondjeGeprobeerd = true;
    window.rondleiding?.eigen('daken', dakvlakken.RONDJE);
  }
}

/* ------------------------------------------------------------ bewaren */

/** `ookEnergie`: de uurprijs hoort bij het soort contract (issue 119), dan gaan ze samen in één keer. */
function bewaarAansluiting(ookEnergie = false, zonOok = false) {
  if (ookEnergie && energieFout()) return groep.zegBewaard('fout', energieFout());
  groep.bewaarStraks(async () => {
    const opZon = Object.fromEntries(Object.entries(a.opZon).filter(([, v]) => typeof v === 'boolean'));
    // De netmeter en de omvormers alleen als ze hier gekozen zijn; anders houdt de dienst wat er stond.
    const uit = await groep.stuur('api/aansluiting', { panelen: a.panelen, zekering: a.zekering, tarief: a.tarief, verwarming: a.verwarming, voorkantZon: a.voorkantZon, dak: a.dak, elders: a.elders, daken: a.daken, opZon, opZonUit: a.opZonUit, netmeter: a.netmeter, omvormers: a.omvormers, laden: a.laden });
    if (uit?.ok) {
      aInfo = uit.antwoord;
      // Het dak zoals de dienst het bewaarde: "klopt" en "aanpassen" worden een gewoon dak.
      a.dak = aInfo.antwoorden?.dak ?? null;
      a.daken = aInfo.antwoorden?.daken ?? null;
      teken();
      // Andere vlakken: de zon bij heldere lucht opnieuw (besluit 254).
      if (zonOok) {
        zon = await haal('api/zon').catch(() => zon);
        teken();
      }
    }
    if (uit?.ok && ookEnergie) return stuurEnergie();
    return uit;
  });
}

/** Wat er nog mist voor de prijzen bewaard kunnen worden, of null. */
function energieFout() {
  if (dubbel && e.prijzen.stroomDal == null && !e.prijzen.dynamisch) return t('energie.vulDal');
  const leegBedrag = e.prijzen.vast.find((v) => v.bedrag == null);
  return leegBedrag ? t('energie.vulBedrag', { naam: leegBedrag.naam }) : null;
}

async function stuurEnergie() {
  const uit = await groep.stuur('api/energie', { ...e, bron: e.bron ?? 'zelf' });
  if (uit?.ok) {
    eInfo = { ...eInfo, instellingen: uit.antwoord };
    teken();
  }
  return uit;
}

function bewaarEnergie() {
  if (energieFout()) return groep.zegBewaard('fout', energieFout());
  groep.bewaarStraks(stuurEnergie);
}

/* ------------------------------------------------------------ doen */

/** Daken en panelen bewaren (besluit 254), met de oude antwoorden erbij voor wat die nog leest. */
function bewaarDaken(w) {
  const d = aInfo.daken;
  if (w.geen) {
    a.panelen = { ligging: 'geen', aantal: null, voorkant: null, achterkant: null };
    a.elders = {};
    a.daken = null;
    a.dak = null;
  } else {
    // De gebouwen van boven gaan mee (besluit 254, stap 2a): wat de tekening nu laat zien.
    const gebouwen = w.gebouwen ?? dakvlakken.gebouwenUit(d);
    const omgeving = w.omgeving ?? d.tekening?.omgeving ?? [];
    // Wat elke omvormer hooguit levert (stap 4): wat de bewoner invulde blijft staan.
    const grenzen = w.grenzen ?? a.daken?.grenzen ?? {};
    // Wat de kaarten zeiden (6 november 2026) blijft staan tot de bewoner opnieuw kijkt.
    const kaartStand = w.kaartStand ?? a.daken?.kaartStand ?? d.kaartStand ?? null;
    // Het dak uit 3D BAG (6 november 2026): zolang het hoofdhuis uit 3D BAG komt.
    const uitBag = gebouwen.some((g) => g.soort === 'hoofdhuis' && g.bron === 'kaart' && g.kaart === 'bag3d');
    const kaartDak = !uitBag ? null : w.kaartDak !== undefined ? w.kaartDak : (a.daken?.kaartDak ?? d.kaartDak ?? null);
    a.daken = w.vlakken.length || gebouwen.length ? { vlakken: w.vlakken, voorgevelDeg: d.voorgevelDeg, omvormerW: d.omvormerW, gebouwen, omgeving, ...(Object.keys(grenzen).length ? { grenzen } : {}), ...(kaartStand ? { kaartStand } : {}), ...(kaartDak?.length ? { kaartDak } : {}) } : null;
    const oud = dakvlakken.oudeAntwoorden(w.vlakken, d.voorgevelDeg, a.panelen);
    a.panelen = oud.panelen;
    a.elders = oud.elders;
    // Meteen zo laten zien; de dienst stuurt het daarna terug.
    // Een verschoven blok staat meteen op zijn nieuwe plek (stap 2b); de dienst tekent het daarna precies.
    aInfo = { ...aInfo, daken: { ...d, ...(w.tekening ? { tekening: w.tekening } : {}), kaartStand, kaartDak, bewaard: w.vlakken.length > 0, vlakken: w.vlakken.map((v) => ({ ...v, peakW: Math.round(dakvlakken.piek(v)) })) } };
  }
  teken();
  bewaarAansluiting(false, true);
}

function zetMeters(plek, ids) {
  if (plek === 'afname') e.net.afname = ids;
  else if (plek === 'teruglevering') e.net.teruglevering = ids;
  else if (plek === 'zon') e.zon = ids;
  else if (plek === 'gas') e.gas = ids[0] ?? null;
}
function leesMeters(plek) {
  if (plek === 'afname') return e.net.afname;
  if (plek === 'teruglevering') return e.net.teruglevering;
  if (plek === 'zon') return e.zon;
  return e.gas ? [e.gas] : [];
}
function netDalBij() {
  const net = new Set([...e.net.afname, ...e.net.teruglevering]);
  e.net.dal = (e.net.dal ?? []).filter((id) => net.has(id));
}

/* ------------------------------------------------------------ de kaart */

/**
 * Kijk wat kan bij jouw huis (6 november 2026): beide kaarten vragen en
 * bewaren wat ze zeiden; de bewoner kiest daarna. Tikte hij al een kaart aan
 * (na het opnieuw openen van de pagina), dan neemt SunArc die meteen.
 */
async function haalDeKaart() {
  dakStaat.kaart = 'bezig';
  teken();
  const stand = await dakvlakken.kijk(dakStaat);
  const keuze = dakStaat.naKijken;
  dakStaat.naKijken = null;
  teken();
  if (!stand || !aInfo?.daken) return;
  const w = keuze ? dakvlakken.vanKaart(aInfo.daken, dakStaat, keuze) : null;
  bewaarDaken({ ...(w ?? { vlakken: aInfo.daken.vlakken.map(dakvlakken.kaal) }), kaartStand: stand });
}

/** Een kaart kiezen: met wat er net gevonden is, anders eerst kijken (met de melding). */
function kiesKaart(bron) {
  const w = dakvlakken.vanKaart(aInfo.daken, dakStaat, bron);
  if (w) return bewaarDaken(w);
  dakStaat.naKijken = bron;
  openVenster(dakvlakken.kaartVenster());
}

/*
 * Blokken slepen en draaien (besluit 254, stap 2b): het gekozen blok in de
 * tekening van boven, met de vinger of de muis. Tijdens het slepen schuiven
 * het blok, zijn panelen en zijn letters mee; bij loslaten bewaart de pagina.
 */
let sleep = null;
/** Na slepen geen tik: anders legt het loslaten op een dakvlak er een vlak neer. */
let sleepTik = false;
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-dak-sleep], [data-dak-draaigreep]');
  if (!el || !aInfo?.daken) return;
  const svg = el.closest('svg');
  const groep = svg?.querySelector(`.dk-gebouw[data-dak-sleep]`);
  const m = svg?.getScreenCTM()?.inverse();
  if (!groep || !m) return;
  const pt = (ev) => {
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m);
    return [p.x, p.y];
  };
  const id = groep.dataset.dakSleep;
  sleep = {
    id,
    draai: el.hasAttribute('data-dak-draaigreep'),
    van: pt(e),
    pt,
    c: [Number(groep.dataset.cx), Number(groep.dataset.cy)],
    delen: [...svg.querySelectorAll(`[data-dak-van="${CSS.escape(id)}"]`)],
    dx: 0,
    dy: 0,
    graden: 0,
  };
  groep.classList.add('sleept');
  el.setPointerCapture?.(e.pointerId);
  e.preventDefault();
});
document.addEventListener('pointermove', (e) => {
  if (!sleep) return;
  const p = sleep.pt(e);
  if (sleep.draai) {
    const hoek = (q) => (Math.atan2(q[1] - sleep.c[1], q[0] - sleep.c[0]) * 180) / Math.PI;
    sleep.graden = Math.round(hoek(p) - hoek(sleep.van));
  } else {
    sleep.dx = p[0] - sleep.van[0];
    sleep.dy = p[1] - sleep.van[1];
  }
  // In de tekening is y naar beneden: draaien met de klok mee is hier gewoon rotate.
  const zet = sleep.draai ? `rotate(${sleep.graden} ${sleep.c[0]} ${sleep.c[1]})` : `translate(${sleep.dx.toFixed(2)} ${sleep.dy.toFixed(2)})`;
  for (const el of sleep.delen) {
    // Wat het deel al had (een letter staat op zijn plek met translate), komt erachter.
    el.dataset.vast ??= el.getAttribute('transform') ?? '';
    el.setAttribute('transform', `${zet} ${el.dataset.vast}`);
  }
});
function sleepKlaar() {
  if (!sleep) return;
  const { id, dx, dy, graden, delen } = sleep;
  sleep = null;
  const zet = { dx: Math.round(dx * 100) / 100, dy: Math.round(-dy * 100) / 100, graden: ((graden % 360) + 360) % 360 };
  // Niet bewogen: een gewone tik (bijvoorbeeld op een dakvlak), dan niets opnieuw tekenen.
  if (Math.hypot(zet.dx, zet.dy) < 0.15 && !zet.graden) {
    for (const el of delen) if (el.dataset.vast != null) el.setAttribute('transform', el.dataset.vast);
    document.querySelector('.dk-gebouw.sleept')?.classList.remove('sleept');
    return;
  }
  sleepTik = true;
  setTimeout(() => (sleepTik = false), 0);
  const w = dakvlakken.verplaats(aInfo.daken, id, zet);
  if (w) bewaarDaken(w);
  else teken();
}
document.addEventListener('pointerup', sleepKlaar);
// Vegen door een lijst geeft ook pointercancel: alleen opnieuw tekenen als er echt een blok gesleept werd.
document.addEventListener('pointercancel', () => {
  if (!sleep) return;
  sleep = null;
  teken();
});
document.addEventListener(
  'click',
  (e) => {
    if (!sleepTik) return;
    sleepTik = false;
    e.stopPropagation();
    e.preventDefault();
  },
  true,
);

/** Een venster over de hele pagina: de melding voor de kaart, of de vraag voor Zonder kaart. */
let venster = null;
function sluitVenster() {
  venster?.remove();
  venster = null;
  removeEventListener('keydown', venstertoets);
}
const venstertoets = (e) => e.key === 'Escape' && sluitVenster();
function openVenster(html) {
  sluitVenster();
  venster = document.createElement('div');
  venster.className = 'kk-scherm';
  venster.innerHTML = html;
  venster.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-kk-dicht], [data-kk-kaart], [data-kk-zonder]');
    if (!el) return;
    sluitVenster();
    if (el.hasAttribute('data-kk-kaart')) await haalDeKaart();
    else if (el.hasAttribute('data-kk-zonder') && aInfo?.daken) bewaarDaken(dakvlakken.zonderKaart(aInfo.daken));
  });
  document.body.append(venster);
  addEventListener('keydown', venstertoets);
  venster.querySelector('[data-kk-kaart], [data-kk-zonder]')?.focus();
}

document.addEventListener('click', async (ev) => {
  // De dakvlakken en gebouwen in de tekening van boven zijn geen knoppen, maar wel aan te tikken (besluit 254).
  const knop = ev.target.closest('button, [data-dak-dakvlak], [data-dak-kandidaat], [data-dak-gebouw]');
  if (!knop || knop.disabled) return;
  // Auto en laadpaal (besluit 259).
  if (a) {
    const wat = laden.klik(knop, aInfo, a, ladenStaat);
    if (wat === 'teken') return teken();
    if (wat) {
      teken();
      return bewaarAansluiting();
    }
  }
  // Het vraagteken bij Daken en panelen (Ricardo, 5 november 2026): de rondleiding opnieuw, zoals op Thuis.
  if (knop.hasAttribute('data-dak-uitleg')) {
    if (dakStaat.scherm !== 'alle') {
      Object.assign(dakStaat, { scherm: 'alle', concept: null, origineel: null });
      teken();
    }
    window.rondleiding?.eigen('daken', dakvlakken.RONDJE, true);
    return;
  }
  // De kaart is experimenteel (5 november 2026): eerst de melding, en Zonder kaart vraagt het even.
  if (a && knop.hasAttribute('data-dak-kaart')) return openVenster(dakvlakken.kaartVenster());
  if (a && knop.hasAttribute('data-dak-zonderkaart')) return openVenster(dakvlakken.zonderVenster());
  // De plek staat uit: naar die instelling in Home Assistant (6 november 2026).
  if (knop.hasAttribute('data-dak-plekha')) return void app.naarHAScherm('/config/general');
  // Daken en panelen (besluit 254).
  if (a && Object.keys(knop.dataset).some((k) => k.startsWith('dak'))) {
    const wat = dakvlakken.klik(knop, aInfo?.daken, dakStaat);
    if (wat === 'teken') teken();
    else if (wat?.kaart) await haalDeKaart();
    else if (wat?.bron) kiesKaart(wat.bron);
    else if (wat) bewaarDaken(wat);
    return;
  }
  // Het overzicht van de panelen (besluit 187): een paneel erbij of eraf, een ander dak, zelf aanpassen.
  if (a && knop.dataset.panStap) {
    const d = Number(knop.dataset.d);
    const [s, plek] = knop.dataset.panStap.split(':');
    if (s === 'elders') {
      const n = Math.min(200, (a.elders[plek] ?? 0) + d);
      if (n > 0) a.elders[plek] = n;
      else delete a.elders[plek];
    } else a.panelen[s] = Math.min(200, Math.max(1, (a.panelen[s] ?? 0) + d));
    teken();
    return bewaarAansluiting();
  }
  if (a && knop.dataset.panErbij) {
    a.elders[knop.dataset.panErbij] = 1;
    teken();
    return bewaarAansluiting();
  }
  if (knop.hasAttribute('data-pan-zelf') || knop.hasAttribute('data-pan-klaar')) {
    ligStaat.zelf = knop.hasAttribute('data-pan-zelf');
    return teken();
  }
  // Een omvormer weghalen (testerronde, november 2026).
  if (a && vermogens.klik(knop, aInfo, a)) {
    teken();
    return bewaarAansluiting();
  }
  // Hoe de panelen liggen (besluit 157).
  if (a && Object.keys(knop.dataset).some((k) => k.startsWith('lig'))) {
    const wat = ligging.klik(knop, aInfo?.ligging, a, ligStaat);
    if (wat) teken();
    if (wat === 'bewaar') bewaarAansluiting();
    return;
  }
  if (knop.dataset.kies) {
    const w = JSON.parse(knop.dataset.waarde);
    const s = knop.dataset.kies;
    // De aansluiting.
    if (a && ['ligging', 'zekering', 'contract', 'verwarming'].includes(s)) {
      // Wie hier de kant kiest, blijft in dit formulier tot Klaar (besluit 187): eerst het aantal.
      if (s === 'ligging') {
        a.panelen.ligging = w;
        ligStaat.zelf = true;
      }
      else if (s === 'zekering') {
        if (w === 'anders') {
          zelf = { fasen: a.zekering?.fasen ?? 1, ampere: a.zekering?.ampere ?? null };
          return teken();
        }
        zelf = null;
        a.zekering = w;
      } else if (s === 'contract') {
        a.tarief = w;
        // Per uur neemt de uurprijs van Home Assistant over, een vaste prijs zet hem uit (issue 119).
        const dyn = eInfo?.voorstel?.prijzen?.dynamisch;
        if (e && w === 'dynamisch' && !e.prijzen.dynamisch && dyn && eInfo?.instellingen) {
          e.prijzen.dynamisch = JSON.parse(JSON.stringify(dyn));
          // Een prijs per uur kent geen normaal en dal (issue 126).
          dubbel = false;
          e.prijzen.stroomDal = null;
          teken();
          return bewaarAansluiting(true);
        }
        if (e && w === 'vast' && e.prijzen.dynamisch && eInfo?.instellingen) {
          delete e.prijzen.dynamisch;
          teken();
          return bewaarAansluiting(true);
        }
      }
      else if (s === 'verwarming') a.verwarming.soort = w;
      teken();
      return bewaarAansluiting();
    }
    // De prijzen.
    if (e && s === 'stroomtarief') {
      dubbel = w === 'dubbel';
      if (!dubbel) e.prijzen.stroomDal = null;
    } else if (e && s === 'dalUren') e.prijzen.dalUren = w;
    else if (e && s === 'salderen') e.prijzen.salderen = w;
    else if (e && s === 'dalWeekend') e.prijzen.dalEigen = { ...e.prijzen.dalEigen, weekend: w };
    else return;
    teken();
    return bewaarEnergie();
  }
  // Energie in Home Assistant, om de prijs per uur daar te zetten (issue 119); daarna opnieuw kijken.
  if (knop.hasAttribute('data-uurprijs-ha')) return void app.naarHAScherm('/config/energy');
  if (knop.hasAttribute('data-uurprijs-opnieuw')) return void laadAlles();
  if (!e) return;
  const p = e.prijzen;
  if (knop.dataset.weg) {
    zetMeters(knop.dataset.weg, leesMeters(knop.dataset.weg).filter((x) => x !== knop.dataset.id));
    netDalBij();
  } else if (knop.dataset.tarief) {
    const dal = new Set(e.net.dal ?? []);
    if (dal.has(knop.dataset.tarief)) dal.delete(knop.dataset.tarief);
    else dal.add(knop.dataset.tarief);
    e.net.dal = [...dal];
  } else if (knop.dataset.apparaatWeg != null) {
    e.apparaten.splice(Number(knop.dataset.apparaatWeg), 1);
  } else if (knop.dataset.vastWeg != null) {
    p.vast.splice(Number(knop.dataset.vastWeg), 1);
  } else if (knop.dataset.vastErbij != null) {
    const v = VOORSTELLEN.find((x) => x.naam === knop.dataset.vastErbij);
    p.vast.push({ naam: v?.naam ?? t('energie.post.vast'), bedrag: null, per: v?.per ?? 'dag', soort: v?.soort ?? 'stroom' });
    teken();
    // Meteen het bedrag invullen; bewaard wordt pas als er een bedrag staat.
    requestAnimationFrame(() => document.querySelector(`${app.zicht()} [data-vast="bedrag"][data-i="${p.vast.length - 1}"]`)?.focus());
    return;
  } else if (knop.hasAttribute('data-overnemen')) {
    const v = JSON.parse(JSON.stringify(eInfo.voorstel));
    // Met de uurprijs, als Home Assistant er een kent (testerronde, november 2026).
    e = aanvullen({ ...v, prijzen: { ...p, stroom: p.stroom ?? v.prijzen.stroom, gas: p.gas ?? v.prijzen.gas, teruglevering: p.teruglevering ?? v.prijzen.teruglevering, ...(v.prijzen.dynamisch ? { dynamisch: v.prijzen.dynamisch } : {}) } });
  } else if (knop.hasAttribute('data-uurprijs') || knop.hasAttribute('data-uurprijs-uit')) {
    const aan = knop.hasAttribute('data-uurprijs');
    if (aan) {
      e.prijzen.dynamisch = JSON.parse(JSON.stringify(eInfo.voorstel.prijzen.dynamisch));
      // Een prijs per uur kent geen normaal en dal (issue 126).
      dubbel = false;
      e.prijzen.stroomDal = null;
    } else delete e.prijzen.dynamisch;
    // Het soort contract gaat mee (issue 119).
    const tarief = aan ? 'dynamisch' : 'vast';
    if (a && a.tarief !== tarief) {
      a.tarief = tarief;
      teken();
      return bewaarAansluiting(true);
    }
  } else return;
  teken();
  bewaarEnergie();
});

document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (ligging.verander(t, ligStaat)) return teken();
  const dak = dakvlakken.verander(t, dakStaat, aInfo?.daken);
  if (dak === 'teken') return teken();
  if (dak) return bewaarDaken(dak);
  // Auto en laadpaal (besluit 259).
  if (a && laden.verander(t, aInfo, a, ladenStaat)) {
    teken();
    return bewaarAansluiting();
  }
  // De netmeter en de omvormers (testerronde, november 2026).
  if (a && vermogens.verander(t, aInfo, a)) {
    teken();
    return bewaarAansluiting();
  }
  // De aansluiting.
  const z = t.closest('[data-zekering]');
  if (z && zelf && a) {
    zelf[z.dataset.zekering] = z.value === '' ? null : Math.round(Number(z.value));
    if (zelf.fasen && zelf.ampere >= 6 && zelf.ampere <= 250) {
      a.zekering = { fasen: zelf.fasen, ampere: zelf.ampere };
      bewaarAansluiting();
    }
    return;
  }
  if (t.matches('[data-thermostaat]') && a) {
    a.verwarming.thermostaat = t.value || null;
    teken();
    return bewaarAansluiting();
  }
  if (t.matches('[data-aanvoer]') && a) {
    const n = Math.round(Number(t.value));
    a.verwarming.aanvoerC = t.value === '' || !Number.isFinite(n) ? null : Math.min(90, Math.max(25, n));
    if (a.verwarming.aanvoerC != null) t.value = String(a.verwarming.aanvoerC);
    return bewaarAansluiting();
  }
  if (t.dataset.aantal && a) {
    a.panelen[t.dataset.aantal] = t.value === '' ? null : Math.round(Number(t.value));
    return bewaarAansluiting();
  }
  // De meters en prijzen.
  if (!e) return;
  const p = e.prijzen;
  if (t.dataset.meer) {
    if (!t.value) return;
    if (t.dataset.meer === 'apparaat') e.apparaten.push({ id: t.value, naam: naamVan(t.value).slice(0, 40) });
    else {
      zetMeters(t.dataset.meer, [...leesMeters(t.dataset.meer), t.value]);
      if ((t.dataset.meer === 'afname' || t.dataset.meer === 'teruglevering') && raadDal(t.value)) e.net.dal = [...(e.net.dal ?? []), t.value];
    }
    teken();
  } else if (t.dataset.prijs) {
    const v = t.value === '' ? null : Number(t.value);
    const [x, y] = t.dataset.prijs.split('.');
    if (y) p[x][y] = v;
    else p[x] = v;
    t.classList.toggle('leeg', v == null && t.classList.contains('leeg'));
  } else if (t.dataset.daleigen) {
    // Eigen daltijden (besluit 178): van en tot verschillend, anders blijft het zoals het was.
    const d = { ...p.dalEigen, [t.dataset.daleigen]: Number(t.value) };
    if (d.van === d.tot) {
      t.value = String(p.dalEigen[t.dataset.daleigen]);
      return;
    }
    p.dalEigen = d;
  } else if (t.hasAttribute('data-contract')) {
    p.contractStart = /^\d{4}-\d{2}-\d{2}$/.test(t.value) ? t.value : null;
  } else if (t.dataset.vast) {
    const post = p.vast[Number(t.dataset.i)];
    if (!post) return;
    if (t.dataset.vast === 'bedrag') {
      let v = t.value === '' ? null : Number(t.value);
      // Een vermindering of korting is een aftrek, ook als hij zonder min is ingevuld.
      if (v != null && v > 0 && /vermindering|korting|teruggave|reduction|discount|rebate/i.test(post.naam)) v = -v;
      post.bedrag = v;
      if (v != null && String(v) !== t.value) t.value = String(v);
    } else if (t.dataset.vast === 'naam') post.naam = t.value.trim() || post.naam;
    else post[t.dataset.vast] = t.value;
  } else if (t.dataset.apparaatnaam != null) {
    const x = e.apparaten[Number(t.dataset.apparaatnaam)];
    if (x) x.naam = t.value.trim() || x.naam;
  } else return;
  bewaarEnergie();
});

// Na het invullen van een veld de delen links bijwerken (de stip en de zin).
// Alleen na een veld: een knop die de focus verliest (bij vegen door een lijst) tekende anders alles opnieuw.
document.addEventListener('focusout', (ev) => {
  if (ev.target?.matches?.('input, select, textarea')) setTimeout(teken, 0);
});

/* ------------------------------------------------------------ starten */

/** Gebundeld: hooguit één keer per beeld (basis.js). */
const teken = app.gebundeld(tekenNu);
addEventListener('standwissel', teken);
addEventListener('hashchange', teken);

app.start('instellingen');
void laadAlles();
