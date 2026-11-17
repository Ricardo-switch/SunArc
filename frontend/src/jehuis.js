/*
 * Je huis (besluit 308, stap 2 tot 5): de tekentafel in de standen Vorm, Kamers,
 * Apparaten en Huis (het huis in 3D uit de tekening, kit/huistekenen-3d.js), met de echte etages, kamers, zones en apparaten uit de indeling. De schets is de maatstaf
 * (design/app2/Wand-Huis-Tekenen en Tel-Huis-Tekenen); de motor staat in
 * kit/huistekenen.js en is dezelfde als in de schets.
 *
 * Alles gaat door één deur, `api/huistekening`: lezen geeft de vorm van het
 * huis (de gebouwen van Daken en panelen, of een rechthoek uit het
 * woningtype), de etages, de kamers, de apparaten en wat er al getekend is;
 * bewaren zet alleen de tekening, de zonelijnen, en per apparaat de kamer en
 * de plek in de indeling (een plek naast een zonelijn zet ook de zone). Er gaat niets naar Home
 * Assistant. Bewaren gebeurt na het loslaten, en het antwoord tekent de
 * tekening niet opnieuw: wat onder je vinger ligt, blijft liggen.
 *
 * Bij Vorm (stap 4) staat wat elke bron van het huis vindt: de 3D-kaart, de
 * plattegrond of zonder kaart, met de hoogte. Een andere bron kiezen geldt ook
 * bij Daken en panelen; een buitenmuur rechttrekken blijft in de tekening. De
 * kaarten vraagt hij pas na de melding van Daken en panelen (besluit 256).
 *
 * Ricardo keurde Je huis goed op 17 november 2026 (kwaliteitsronde, stap 3).
 * Sinds 0.191.0 kan hier ook wat eerst alleen bij Kamers en indeling kon: de
 * etage, de soort en naam van een kamer, buiten en verbergen (zie "de
 * indeling" hieronder). Kamers en indeling gaat weg in dezelfde versie als het
 * blad Klimaat per kamer, waar Verwarmen en koelen heen gaat.
 */
'use strict';

const { haal, deur, esc } = app;
const $ = (s, r = document) => r.querySelector(s);
const WIJS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2"/><path d="M15 11a1.5 1.5 0 0 1 3 0v3.5c0 3.6-2.2 6-5.6 6-2.4 0-3.7-.9-5-2.9L5 14.3c-.6-1 .6-2.2 1.6-1.4L9 15"/></svg>';

let tekenaar = null;
/** De standen: Huis is het huis in 3D uit de tekening (stap 5). */
const STANDEN = ['vorm', 'kamers', 'apparaten', 'huis'];
/** Wat de dienst als bron en als hoek van het hoofdhuis gaf; een andere bron gaat alleen mee als je hem koos. */
const dienst = { bron: null, nul: null };
/** De kaarten vragen: bezig, of wat er misging. */
const kijk = { bezig: false, fout: null };

const getal = (n) => n.toLocaleString(window.taal?.locale ?? 'nl-NL', { maximumFractionDigits: 1 });
const komma = (n) => n.toLocaleString(window.taal?.locale ?? 'nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Een etagenaam kort: zonder "verdieping" of "floor" erachter, als er dan nog iets staat. */
const kortNaam = (naam) => naam.replace(/\s+(verdieping|etage|floor|storey)$/i, '') || naam;

/** "huis, garage en uitbouw". */
function opsomming(lijst) {
  try {
    return new Intl.ListFormat(window.taal?.locale ?? 'nl-NL', { type: 'conjunction' }).format(lijst);
  } catch {
    return lijst.join(', ');
  }
}

/**
 * Wat een bron van het huis vindt, in woorden (stap 4): de naam, wat hij vond,
 * wat hij weet, en de hoogte. Zonder kaart heet een rechthoek uit het
 * woningtype Basishuis, en wat je bij Daken zelf tekende Zelf getekend.
 */
function bronVoorMotor(id, b, woning) {
  const hoofd = b.blokken.find((x) => x.soort === 'hoofdhuis') ?? b.blokken[0] ?? { b: 0, d: 0 };
  const soort = id === 'zelf' ? (b.zelfGetekend ? 'zelf' : 'basis') : id;
  const maat = { b: getal(hoofd.b), d: getal(hoofd.d) };
  const wat = opsomming([...new Set(b.blokken.map((x) => x.soort))].map((x) => t(`ht.bron.blok.${x}`)));
  const vond = soort === 'basis' ? t('ht.bron.basisVond', { woning: t(`ht.bron.woning.${woning && ['vrijstaand', 'tweekap', 'hoek', 'rij', 'appartement'].includes(woning) ? woning : 'vrijstaand'}`), ...maat }) : soort === 'zelf' ? t('ht.bron.zelfVond', maat) : t('ht.bron.gevonden', { wat });
  const weet = t(`ht.bron.weet.${soort === 'bag3d' && !b.gemeten ? 'bag3dZonder' : soort === 'osm' && b.gemeten ? 'osmMetBag' : soort}`);
  return { naam: t(`ht.bron.${soort}`), vond, weet, gemeten: b.gemeten, hoogte: t(b.gootLaag != null ? 'ht.bron.hoogteScheef' : 'ht.bron.hoogte', { goot: komma(b.goot), nok: komma(b.nok), laag: komma(b.gootLaag ?? b.goot) }),
    // Voor het huis in 3D (stap 5): de goot, de lage goot bij een scheef dak, de nok, en per gebouw het dak.
    goot: b.goot,
    ...(b.gootLaag != null ? { gootLaag: b.gootLaag } : {}),
    nok: b.nok,
    blokken: b.blokken,
    // 0.185.0: de gebouwen van de kaart eromheen, om bij Vorm aan te wijzen.
    omgeving: b.omgeving ?? [],
  };
}

/**
 * Het huis voor de motor: de etages van boven naar beneden, de begane grond
 * met alle gebouwen (garage, uitbouw), de etages erboven en eronder alleen op
 * het hoofdhuis.
 */
function huisVoorMotor(d) {
  const beneden = d.etages.some((e) => e.id === 'bg') ? 'bg' : d.etages.at(-1)?.id;
  const hoofd = d.vorm.blokken.filter((b) => b.soort === 'hoofdhuis');
  // Stap 4: elke bron op hetzelfde ruitjespapier, met wat hij vond; de kaarten die het huis niet kennen, in een regel.
  const bronnen = Object.fromEntries(Object.entries(d.bronnen ?? {}).map(([id, b]) => [id, bronVoorMotor(id, b, d.woning)]));
  const nietGevonden = ['bag3d', 'osm'].filter((k) => d.kaarten?.[k] && d.kaarten[k] !== 'huis').map((k) => ({ naam: t(`ht.bron.${k}`), zin: t(`ht.bron.niet.${d.kaarten[k]}`) }));
  // Vragen kan als de plek bekend is en een kaart vandaag nog niets (of een fout) zei.
  const kanKijken = d.kaarten != null && ['bag3d', 'osm'].some((k) => d.kaarten[k] == null || d.kaarten[k] === 'fout');
  return {
    maat: d.vorm.maat,
    beneden,
    ...(Object.keys(bronnen).length ? { bron: d.bron, bronnen } : {}),
    nietGevonden,
    ...(kanKijken ? { kijk } : {}),
    // Kort voor de balk op de telefoon en het huis opzij: "Eerste verdieping" wordt "Eerste", "First floor" wordt "First".
    etages: d.etages.map((e) => ({ id: e.id, naam: e.naam, kort: kortNaam(e.naam), hoogte: e.hoogte, dak: !!e.dak, blokken: e.id === beneden ? d.vorm.blokken : hoofd })),
    kamers: d.kamers.map((k) => ({ id: k.id, naam: k.naam, soort: k.soort ?? null, etage: k.etage, zones: k.zones })),
    // Stap 3: de apparaten binnen, in hun kamer of nog zonder (de strook).
    apparaten: d.apparaten ?? [],
    verborgen: d.verborgen ?? 0,
    // Stap 3: om ze in Je huis terug te halen.
    verborgenLijst: d.verborgenLijst ?? [],
  };
}

/* ------------------------------------------------------------ de indeling */

/*
 * Stap 3 van de kwaliteitsronde (17 november 2026, schets Wand-Huis-Aanvulling):
 * wat eerst alleen bij Kamers en indeling kon, staat in de bladen van Je huis.
 * De etage (naam, onder het dak, volgorde, erbij of weg), de soort en de naam
 * van een kamer, wat er rond het huis is en waar de thuisaccu staat, en een
 * apparaat verbergen of terughalen. Het bewaart in dezelfde indeling als
 * Kamers en indeling, met dezelfde regels (`api/indeling`).
 */
let info = null;
let huisData = null;
async function laadIndeling() {
  const [i, h] = await Promise.allSettled([haal('api/indeling'), haal('api/huis')]);
  if (i.status === 'fulfilled') info = i.value;
  if (h.status === 'fulfilled') huisData = h.value;
}
function concept() {
  const basis = info?.indeling ?? info?.voorstel;
  return basis ? JSON.parse(JSON.stringify(basis)) : null;
}
const volgordeVan = (d) => (d.volgorde?.length ? [...d.volgorde] : (info?.etages ?? []).map((e) => e.id).filter((id) => id !== 'buiten'));
// Een lijstje van vóór 6 november 2026 kent de border niet: die stond er toen altijd.
const rondVan = (d) => (d?.rond ? { border: true, allebei: false, ...d.rond } : huismodel.rondNu(huisData));
/** Een vaste etage op zijn plek: de kelder onderaan, de derde verdieping bovenaan. */
function opZijnPlek(volgorde, id) {
  const plek = (x) => (info?.standaard ?? []).findIndex((s) => s.id === x);
  const mijn = plek(id);
  const voor = volgorde.findIndex((x) => plek(x) > mijn && plek(x) !== -1);
  const uit = [...volgorde];
  uit.splice(voor === -1 ? uit.length : voor, 0, id);
  return uit;
}

const indeling = {
  /** Wat de bladen tonen. */
  gegevens() {
    const d = concept();
    if (!d || !tekenaar) return null;
    const v = volgordeVan(d);
    const e = tekenaar.st.etage;
    const i = v.indexOf(e);
    const rond = rondVan(d);
    const accu = huisData?.opslag?.batterij ?? null;
    const accuNu = d.accu?.plek === 'binnen' ? `binnen:${d.accu.kamer}` : d.accu?.plek === 'garage' && rond.garage ? 'garage' : 'gevel';
    const binnen = (d.kamers ?? []).filter((k) => k.etage !== 'buiten' && !huismodel.isBuiten({ id: k.etage }, k));
    return {
      etage: { kanHoger: i > 0, kanLager: i >= 0 && i < v.length - 1, kanWeg: e !== 'bg' && !(d.kamers ?? []).some((k) => k.etage === e) },
      nieuweEtages: (info?.standaard ?? []).filter((s) => s.id !== 'buiten' && !v.includes(s.id)).map((s) => [s.id, s.naam]),
      // Wat aan iets anders hangt (de auto aan de oprit, de border aan de tuin), alleen als dat er is.
      rond: huismodel.rondom()
        .filter(([w]) => !huismodel.hangtAan(w) || huismodel.rondAan(rond, huismodel.hangtAan(w)))
        .map(([w, naam, , icoon]) => ({ w, naam, icoon, aan: huismodel.rondAan(rond, w) })),
      huisje: huismodel.rondAan(rond, 'tuinhuis') ? { nu: huismodel.huisjeVan(rond), opties: huismodel.HUISJES.map(([x, sleutel]) => [x, t(sleutel)]) } : null,
      accu: accu
        ? { naam: accu.naam, nu: accuNu, opties: [['gevel', t('indeling.accu.gevel')], ...(rond.garage ? [['garage', t('indeling.accu.garage')]] : []), ...binnen.map((k) => [`binnen:${k.id}`, k.naam])] }
        : null,
      soorten: huismodel.KAMER_SOORTEN,
    };
  },

  /** Een tik of een veld: de indeling aanpassen en bewaren, daarna het blad en de tekening opnieuw. */
  async doe(actie, w) {
    if (actie === 'klimaat') {
      // Verwarmen en koelen staat tot het blad Klimaat per kamer er is nog bij Kamers en indeling.
      location.href = `indeling.html#${encodeURIComponent(w)}/warmte`;
      return;
    }
    const next = concept();
    if (!next || !tekenaar) return;
    const etage = tekenaar.st.etage;
    /** @type {string | boolean} Een etage erbij of weg: naar welke etage daarna; verschoven: true. */
    let structuur = false;
    if (actie === 'etage-naam') {
      const standaard = info.etages.find((x) => x.id === etage)?.standaardNaam;
      if (!w || w === standaard) delete next.etages[etage];
      else next.etages[etage] = w;
    } else if (actie === 'dak') {
      if (w === '1') next.dak = etage;
      else if (huisData?.dakEtage === etage || next.dak === etage) next.dak = 'geen';
      else return;
    } else if (actie === 'schuif') {
      const v = volgordeVan(next);
      const i = v.indexOf(etage);
      const j = i + Number(w);
      if (i < 0 || j < 0 || j >= v.length) return;
      [v[i], v[j]] = [v[j], v[i]];
      next.volgorde = v;
      structuur = true;
    } else if (actie === 'etage-erbij') {
      next.volgorde = opZijnPlek(volgordeVan(next), w);
      structuur = w;
    } else if (actie === 'etage-weg') {
      next.volgorde = volgordeVan(next).filter((x) => x !== etage);
      delete next.etages[etage];
      if (next.dak === etage) delete next.dak;
      structuur = 'bg';
    } else if (actie === 'kamer-soort' || actie === 'kamer-naam') {
      const k = (next.kamers ?? []).find((x) => x.id === w?.kamer);
      if (!k) return;
      if (actie === 'kamer-naam') {
        if (!w.w || w.w === k.naam) return;
        k.naam = w.w;
      } else if (w.w) k.soort = w.w;
      else delete k.soort;
    } else if (actie === 'rond') next.rond = huismodel.rondWissel(rondVan(next), w);
    else if (actie === 'huisje') next.rond = { ...rondVan(next), schuur: w === 'schuur', allebei: w === 'beide' };
    else if (actie === 'accu') {
      if (w === 'gevel') delete next.accu;
      else next.accu = w === 'garage' ? { plek: 'garage', kamer: null } : { plek: 'binnen', kamer: w.slice(7) };
    } else if (actie === 'verberg') {
      next.verborgen = [...new Set([...(next.verborgen ?? []), w])];
      delete next.apparaten[w];
    } else if (actie === 'terug') next.verborgen = (next.verborgen ?? []).filter((x) => x !== w);
    else return;
    const res = await deur('api/indeling', next);
    const body = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      tekenaar.st.fout = res?.status === 403 ? t('indeling.beheerder') : (body.fout ?? t('jehuis.nietBewaard'));
      tekenaar.ververs();
      return;
    }
    tekenaar.st.fout = null;
    info = { ...info, indeling: body };
    // Een etage erbij, weg of verschoven: het huis opzij verandert, dus de pagina opnieuw, op de goede etage.
    if (structuur) {
      if (typeof structuur === 'string') location.hash = `#${encodeURIComponent(structuur)}`;
      location.reload();
      return;
    }
    await vernieuw();
  },
};

/** Na bewaren: de namen, de soorten en de apparaten opnieuw van de dienst, in de tekenaar die er staat. */
async function vernieuw() {
  const [d] = await Promise.all([haal('api/huistekening'), laadIndeling()]);
  const nieuw = huisVoorMotor(d);
  const tk = tekenaar;
  if (nieuw.etages.map((e) => e.id).join() !== tk.huis.etages.map((e) => e.id).join()) return location.reload();
  for (const e of tk.huis.etages) Object.assign(e, nieuw.etages.find((x) => x.id === e.id));
  tk.huis.kamers.splice(0, tk.huis.kamers.length, ...nieuw.kamers);
  for (const k of nieuw.kamers) tk.kamers[k.id] = Object.assign(tk.kamers[k.id] ?? {}, k);
  tk.huis.verborgen = nieuw.verborgen;
  tk.huis.verborgenLijst = nieuw.verborgenLijst;
  // Wat verborgen is, gaat uit de tekening; wat terug is, komt erbij (in de strook als het geen kamer heeft).
  const ids = new Set(nieuw.apparaten.map((a) => a.id));
  tk.st.apparaten = [...tk.st.apparaten.filter((a) => ids.has(a.id)), ...nieuw.apparaten.filter((a) => !tk.st.apparaten.some((b) => b.id === a.id))];
  tk.teken();
  tk.ververs();
}

/** Een apparaat openen, of de verborgen apparaten bij Kamers en indeling. */
function naar(wat, a) {
  location.href = wat === 'verborgen' ? 'indeling.html#verborgen' : `kamer.html#${encodeURIComponent(a.kamer)}/${encodeURIComponent(a.id)}`;
}

const wacht = (ms) => new Promise((ok) => setTimeout(ok, ms));
/** Naar de dienst; bij even te veel achter elkaar nog een paar keer, daarna zegt het label het. */
async function opslaan(x) {
  for (let poging = 0; ; poging++) {
    // De bron alleen als je een andere koos (ook met stap terug): die geldt dan ook bij Daken en panelen.
    const bron = x.bron && x.bron !== dienst.bron ? { bron: x.bron } : {};
    const res = await deur('api/huistekening', { tekening: x.tekening, zones: x.zones, plekken: x.plekken, apparaten: x.apparaten, nul: dienst.nul, ...(x.openingen ? { openingen: x.openingen, ramen: x.ramen } : {}), ...bron });
    if (res?.ok) {
      if (bron.bron) dienst.bron = bron.bron;
      return;
    }
    if (res?.status === 429 && poging < 3) {
      await wacht(5000);
      continue;
    }
    const fout = await res?.json().catch(() => null);
    throw new Error(fout?.fout ?? String(res?.status ?? ''));
  }
}

/**
 * De kaarten vragen (stap 4): eerst de melding van Daken en panelen
 * (experimenteel, je privacy, altijd terug), dan dezelfde zoekactie. Daarna
 * opnieuw laden: de bronnen en het ruitjespapier komen dan van de dienst.
 */
function vraagKaarten() {
  const scherm = document.createElement('div');
  scherm.className = 'kk-scherm';
  scherm.innerHTML = dakvlakken.kaartVenster();
  const dicht = () => {
    scherm.remove();
    removeEventListener('keydown', toets);
  };
  const toets = (e) => e.key === 'Escape' && dicht();
  scherm.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-kk-dicht], [data-kk-kaart]');
    if (!el) return;
    dicht();
    if (el.hasAttribute('data-kk-kaart')) await haalKaarten();
  });
  document.body.append(scherm);
  addEventListener('keydown', toets);
  scherm.querySelector('[data-kk-kaart]')?.focus();
}

async function haalKaarten() {
  kijk.bezig = true;
  kijk.fout = null;
  tekenaar.ververs();
  let res;
  try {
    res = await deur('api/huistekening', { kijk: true });
  } catch {
    res = null;
  }
  if (!res?.ok) {
    // De dienst zegt het in het Nederlands; de pagina zegt het in de taal van de app.
    kijk.bezig = false;
    kijk.fout = t(res?.status === 503 ? 'ht.vorm.geenPlek' : 'ht.vorm.geenAntwoord');
    tekenaar.ververs();
    return;
  }
  // Eerst wat nog bewaard moest worden, dan opnieuw: dezelfde etage en stand.
  for (let i = 0; i < 40 && !tekenaar.st.bewaard && !tekenaar.st.fout; i++) await wacht(100);
  location.reload();
}

/**
 * Een gebouw van de kaart erbij of weg (0.185.0), zoals bij Daken en panelen:
 * eerst wat nog bewaard moest worden, dan de dienst, dan opnieuw laden (de vorm
 * en het ruitjespapier komen van de dienst).
 */
async function gebouw(wat) {
  for (let i = 0; i < 60 && !tekenaar.st.bewaard && !tekenaar.st.fout; i++) await wacht(100);
  let res;
  try {
    res = await deur('api/huistekening', { gebouw: wat });
  } catch {
    res = null;
  }
  if (res?.ok) {
    location.reload();
    return;
  }
  tekenaar.st.gebouwFout = t('ht.gebouw.fout');
  tekenaar.ververs();
}

/** De tekening, de zin eronder en het blad staan één keer op de pagina: zet ze bij de wand of de telefoon. */
function plaats() {
  const kant = app.telStand() ? '#tel' : '#wand';
  const tafel = $(`${kant} [data-plek="tafel"]`);
  tafel.append($('#tafel'));
  // Op de wand staan de strook en de zin onder de tekening in het vak, op de telefoon eronder: eerst de zin, dan de strook.
  if (kant === '#wand') tafel.append($('#strook'), $('#uitleg'));
  else $(`${kant} [data-plek="uitleg"]`).append($('#uitleg'), $('#strook'));
  $(`${kant} [data-plek="blad"]`).append($('#blad'));
}

function bij() {
  const st = tekenaar.st;
  document.querySelectorAll('[data-stand]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.stand === st.stand)));
  document.querySelectorAll('[data-etage-kies]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.etageKies === st.etage)));
  document.querySelectorAll('[data-stap-terug]').forEach((b) => (b.disabled = !st.terug.length));
  document.querySelectorAll('[data-stap-vooruit]').forEach((b) => (b.disabled = !st.vooruit.length));
  document.querySelectorAll('[data-bewaard]').forEach((el) => {
    el.textContent = st.fout ? t('jehuis.nietBewaard') : st.bewaard ? t('jehuis.bewaard') : t('jehuis.bewaren');
    el.classList.toggle('bezig', !st.bewaard && !st.fout);
    el.classList.toggle('fout', !!st.fout);
    el.title = st.fout ?? '';
  });
  $('#uitleg').innerHTML = `${WIJS}<span>${esc(huistekenen.uitleg(tekenaar))}</span>`;
  // Het adres onthoudt de etage en de stand, zodat je na vernieuwen op dezelfde plek staat.
  const adres = `#${encodeURIComponent(st.etage)}${st.stand === 'kamers' ? '' : `/${st.stand}`}`;
  if (location.hash !== adres) history.replaceState(null, '', adres);
}

async function start() {
  plaats();
  let d;
  try {
    [d] = await Promise.all([haal('api/huistekening'), laadIndeling()]);
  } catch {
    $('#blad').innerHTML = `<p class="jh-leeg">${esc(t('jehuis.geenHuis'))}</p>`;
    return;
  }
  dienst.bron = d.bron ?? null;
  dienst.nul = d.nul ?? null;
  const huis = huisVoorMotor(d);
  if (!huis.etages.length) {
    $('#blad').innerHTML = `<p class="jh-leeg">${esc(t('jehuis.geenEtages'))}</p>`;
    return;
  }
  // Het adres: de etage, en bij Apparaten ook de stand (#bg/apparaten).
  const [gevraagd, gevraagdeStand] = decodeURIComponent(location.hash.slice(1)).split('/');
  const etage = huis.etages.some((e) => e.id === gevraagd) ? gevraagd : (huis.etages.find((e) => e.id === 'bg') ?? huis.etages.at(-1)).id;
  const stand = STANDEN.includes(gevraagdeStand) ? gevraagdeStand : 'kamers';
  const tk = huistekenen.maak($('#tekening'), huis, { stand, etage, tekening: d, opslaan, wacht: 900, naar, kijk: vraagKaarten, gebouw, openingen: true, ...(info ? { indeling } : {}) });
  tekenaar = tk;
  window.tekenaar = tk;
  huistekenen.paneel($('#blad'), tk);
  huistekenen.stapel($('#stapel'), tk);
  huistekenen.strook($('#strook'), tk);
  // Op de telefoon de etages als balk.
  $('[data-etages]').innerHTML = `${huis.etages.map((e) => `<button type="button" data-etage-kies="${esc(e.id)}">${esc(e.kort ?? e.naam)}</button>`).join('')}${info ? `<button type="button" class="tk-buiten" data-buiten-kies aria-label="${esc(t('ht.buiten.kop'))}" title="${esc(t('ht.buiten.kop'))}">${iconen.svg('buiten')}</button>` : ''}`;
  document.querySelectorAll('[data-ik]').forEach((el) => el.insertAdjacentHTML('afterbegin', iconen.svg(el.dataset.ik)));
  tk.op(bij);
  bij();

  document.addEventListener('click', (e) => {
    const doel = /** @type {HTMLElement} */ (e.target);
    const et = /** @type {HTMLElement | null} */ (doel.closest('[data-etage-kies]'));
    // Op de telefoon: de etage die al gekozen is nog eens, dan zijn blad; Buiten als laatste knop.
    if (et && info && et.dataset.etageKies === tk.st.etage && !tk.st.blad) tk.toonBlad('etage');
    else if (et) {
      tk.st.blad = null;
      tk.zetEtage(et.dataset.etageKies);
    }
    if (doel.closest('[data-buiten-kies]')) tk.toonBlad('buiten');
    const s = /** @type {HTMLButtonElement | null} */ (doel.closest('[data-stand]'));
    if (s && !s.disabled) tk.zetStand(s.dataset.stand);
    if (doel.closest('[data-stap-terug]')) tk.terug();
    if (doel.closest('[data-stap-vooruit]')) tk.vooruit();
  });
  // Een ander adres op dezelfde pagina (een link, terug in de browser): naar die etage en stand.
  addEventListener('hashchange', () => {
    const [e, s] = decodeURIComponent(location.hash.slice(1)).split('/');
    if (huis.etages.some((x) => x.id === e) && e !== tk.st.etage) tk.zetEtage(e);
    const stand = STANDEN.includes(s) ? s : 'kamers';
    if (stand !== tk.st.stand) tk.zetStand(stand);
  });
  addEventListener('standwissel', () => {
    plaats();
    tk.pasAan();
  });
}

app.start('instellingen');
void start();
