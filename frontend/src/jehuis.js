/*
 * Je huis (besluit 308, stap 2, 3 en 4): de tekentafel in de standen Vorm, Kamers en
 * Apparaten, met de echte etages, kamers, zones en apparaten uit de indeling. De schets is de maatstaf
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
 * Kamers en indeling blijft zoals hij was, met een ingang hiernaartoe; pas als
 * Ricardo zegt dat deze goed is, gaat de oude eruit.
 */
'use strict';

const { haal, deur, esc } = app;
const $ = (s, r = document) => r.querySelector(s);
const WIJS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2"/><path d="M15 11a1.5 1.5 0 0 1 3 0v3.5c0 3.6-2.2 6-5.6 6-2.4 0-3.7-.9-5-2.9L5 14.3c-.6-1 .6-2.2 1.6-1.4L9 15"/></svg>';

let tekenaar = null;
/** De standen die er al zijn; Huis komt in stap 5. */
const STANDEN = ['vorm', 'kamers', 'apparaten'];
/** Wat de dienst als bron en als hoek van het hoofdhuis gaf; een andere bron gaat alleen mee als je hem koos. */
const dienst = { bron: null, nul: null };
/** De kaarten vragen: bezig, of wat er misging. */
const kijk = { bezig: false, fout: null };

const getal = (n) => n.toLocaleString(window.taal?.locale ?? 'nl-NL', { maximumFractionDigits: 1 });
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
  const weet = t(`ht.bron.weet.${soort === 'bag3d' && !b.gemeten ? 'bag3dZonder' : soort}`);
  return { naam: t(`ht.bron.${soort}`), vond, weet, gemeten: b.gemeten, hoogte: t('ht.bron.hoogte', { goot: b.goot.toLocaleString(window.taal?.locale ?? 'nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), nok: b.nok.toLocaleString(window.taal?.locale ?? 'nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }), blokken: b.blokken };
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
    etages: d.etages.map((e) => ({ id: e.id, naam: e.naam, kort: e.naam, hoogte: e.hoogte, blokken: e.id === beneden ? d.vorm.blokken : hoofd })),
    kamers: d.kamers.map((k) => ({ id: k.id, naam: k.naam, soort: k.soort ?? null, etage: k.etage, zones: k.zones })),
    // Stap 3: de apparaten binnen, in hun kamer of nog zonder (de strook).
    apparaten: d.apparaten ?? [],
    verborgen: d.verborgen ?? 0,
  };
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
    const res = await deur('api/huistekening', { tekening: x.tekening, zones: x.zones, plekken: x.plekken, apparaten: x.apparaten, nul: dienst.nul, ...bron });
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
  let res = null;
  try {
    res = await deur('api/huistekening', { kijk: true });
  } catch {
    res = null;
  }
  if (!res?.ok) {
    const b = await res?.json().catch(() => null);
    kijk.bezig = false;
    kijk.fout = b?.fout ?? b?.wachten ?? t('ht.vorm.geenAntwoord');
    tekenaar.ververs();
    return;
  }
  // Eerst wat nog bewaard moest worden, dan opnieuw: dezelfde etage en stand.
  for (let i = 0; i < 40 && !tekenaar.st.bewaard && !tekenaar.st.fout; i++) await wacht(100);
  location.reload();
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
    d = await haal('api/huistekening');
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
  const tk = huistekenen.maak($('#tekening'), huis, { stand, etage, tekening: d, opslaan, wacht: 900, naar, kijk: vraagKaarten });
  tekenaar = tk;
  window.tekenaar = tk;
  huistekenen.paneel($('#blad'), tk);
  huistekenen.stapel($('#stapel'), tk);
  huistekenen.strook($('#strook'), tk);
  // Op de telefoon de etages als balk.
  $('[data-etages]').innerHTML = huis.etages.map((e) => `<button type="button" data-etage-kies="${esc(e.id)}">${esc(e.kort ?? e.naam)}</button>`).join('');
  document.querySelectorAll('[data-ik]').forEach((el) => el.insertAdjacentHTML('afterbegin', iconen.svg(el.dataset.ik)));
  tk.op(bij);
  bij();

  document.addEventListener('click', (e) => {
    const et = e.target.closest('[data-etage-kies]');
    if (et) tk.zetEtage(et.dataset.etageKies);
    const s = e.target.closest('[data-stand]');
    if (s && !s.disabled) tk.zetStand(s.dataset.stand);
    if (e.target.closest('[data-stap-terug]')) tk.terug();
    if (e.target.closest('[data-stap-vooruit]')) tk.vooruit();
  });
  addEventListener('standwissel', () => {
    plaats();
    tk.pasAan();
  });
}

app.start('instellingen');
void start();
