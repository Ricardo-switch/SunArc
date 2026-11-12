/*
 * Je huis (besluit 308, stap 2): de tekentafel in de stand Kamers, met de
 * echte etages, kamers en zones uit de indeling. De schets is de maatstaf
 * (design/app2/Wand-Huis-Tekenen en Tel-Huis-Tekenen); de motor staat in
 * kit/huistekenen.js en is dezelfde als in de schets.
 *
 * Alles gaat door één deur, `api/huistekening`: lezen geeft de vorm van het
 * huis (de gebouwen van Daken en panelen, of een rechthoek uit het
 * woningtype), de etages, de kamers en wat er al getekend is; bewaren zet
 * alleen de tekening en de zonelijnen in de indeling. Er gaat niets naar Home
 * Assistant. Bewaren gebeurt na het loslaten, en het antwoord tekent de
 * tekening niet opnieuw: wat onder je vinger ligt, blijft liggen.
 *
 * Kamers en indeling blijft zoals hij was, met een ingang hiernaartoe; pas als
 * Ricardo zegt dat deze goed is, gaat de oude eruit.
 */
'use strict';

const { haal, deur, esc } = app;
const $ = (s, r = document) => r.querySelector(s);
const WIJS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2"/><path d="M15 11a1.5 1.5 0 0 1 3 0v3.5c0 3.6-2.2 6-5.6 6-2.4 0-3.7-.9-5-2.9L5 14.3c-.6-1 .6-2.2 1.6-1.4L9 15"/></svg>';

let tekenaar = null;

/**
 * Het huis voor de motor: de etages van boven naar beneden, de begane grond
 * met alle gebouwen (garage, uitbouw), de etages erboven en eronder alleen op
 * het hoofdhuis.
 */
function huisVoorMotor(d) {
  const beneden = d.etages.some((e) => e.id === 'bg') ? 'bg' : d.etages.at(-1)?.id;
  const hoofd = d.vorm.blokken.filter((b) => b.soort === 'hoofdhuis');
  return {
    maat: d.vorm.maat,
    etages: d.etages.map((e) => ({ id: e.id, naam: e.naam, kort: e.naam, blokken: e.id === beneden ? d.vorm.blokken : hoofd })),
    kamers: d.kamers.map((k) => ({ id: k.id, naam: k.naam, soort: k.soort ?? null, etage: k.etage, zones: k.zones })),
    // De apparaten komen in stap 3 (Apparaten).
    apparaten: [],
  };
}

const wacht = (ms) => new Promise((ok) => setTimeout(ok, ms));
/** Naar de dienst; bij even te veel achter elkaar nog een paar keer, daarna zegt het label het. */
async function opslaan(x) {
  for (let poging = 0; ; poging++) {
    const res = await deur('api/huistekening', { tekening: x.tekening, zones: x.zones });
    if (res?.ok) return;
    if (res?.status === 429 && poging < 3) {
      await wacht(5000);
      continue;
    }
    const fout = await res?.json().catch(() => null);
    throw new Error(fout?.fout ?? String(res?.status ?? ''));
  }
}

/** De tekening, de zin eronder en het blad staan één keer op de pagina: zet ze bij de wand of de telefoon. */
function plaats() {
  const kant = app.telStand() ? '#tel' : '#wand';
  const tafel = $(`${kant} [data-plek="tafel"]`);
  tafel.append($('#tafel'));
  // Op de wand staat de zin onder de tekening in het vak, op de telefoon eronder.
  (kant === '#wand' ? tafel : $(`${kant} [data-plek="uitleg"]`)).append($('#uitleg'));
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
  // Het adres onthoudt de etage, zodat je na vernieuwen op dezelfde plek staat.
  if (location.hash.slice(1) !== st.etage) history.replaceState(null, '', `#${encodeURIComponent(st.etage)}`);
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
  const huis = huisVoorMotor(d);
  if (!huis.etages.length) {
    $('#blad').innerHTML = `<p class="jh-leeg">${esc(t('jehuis.geenEtages'))}</p>`;
    return;
  }
  const gevraagd = decodeURIComponent(location.hash.slice(1));
  const etage = huis.etages.some((e) => e.id === gevraagd) ? gevraagd : (huis.etages.find((e) => e.id === 'bg') ?? huis.etages.at(-1)).id;
  const tk = huistekenen.maak($('#tekening'), huis, { stand: 'kamers', etage, tekening: d, opslaan, wacht: 900 });
  tekenaar = tk;
  window.tekenaar = tk;
  huistekenen.paneel($('#blad'), tk);
  huistekenen.stapel($('#stapel'), tk);
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
