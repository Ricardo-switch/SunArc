/*
 * Deel van inrichten.js (opgesplitst op 22 november 2026): tekenen. Een gewoon script dat na
 * inrichten-voorstellen.js laadt en zijn bovenste namen deelt met de andere delen van de pagina.
 */
'use strict';
/* global $$, AANPAS, BEVESTIG, HOOFD, STAPPEN, assistentNogAan, bewaarIndeling, bewonersHoofd, binnen, concept, d, delenVan, esc, haal, hoofdVan, jeHuisStap, kanBereik, kanOpen:writable, kanStap, kanToestellen, klaarStap, klimaatIn, laad, lijst:writable, markeer, melding, meterStap, model, naar, naarRondleiding, panelenStap, prijzenHoofd, rolVan, sd, sleutel, stapGedaan, stapNagelopen, stapNu, tekenWelkom, verder, verwarmingStap, volgende, vorige, welkom, zeg, zetAssistentAan */
/* exported teken, terugKnop */
/* ------------------------------------------------------------ tekenen */

/** Lijsten die verder gaan dan de kaart, lopen zichtbaar uit (besluit 158). */
function markeerMeer() {
  $$('[data-kaart] .rijen, [data-kaart] > .midden').forEach((el) => {
    const zet = () => el.classList.toggle('meer', el.scrollHeight > el.clientHeight + 2 && el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    el.onscroll = zet;
    zet();
  });
}

/** Welke stap er het laatst getekend is: binnen dezelfde stap blijft de lijst waar hij was. */
let getekend = null;
/** Onderaan (besluit 158 en 190): Terug, en rechts Later en Volgende. Later gaat door zonder te bewaren. */
const terugKnop = () => `<button type="button" class="zachtknop" data-terug>${esc(t('w.terug'))}</button>`;
const volgendeKnoppen = () => `<span class="rechts"><button type="button" class="zachtknop" data-later>${esc(t('w.later'))}</button><button type="button" class="knop knop-licht" data-volgende>${esc(t('inr.volgende'))}</button></span>`;
/** De wand in het klein bij De wand: dit huis, zoals het nu getekend is. */
function tekenNu() {
  app.schaal();
  app.luchtVan(d.zon, 0);
  const nu = stapNu();
  const hier = hoofdVan(nu);
  // Zeven stappen (besluit 323): bovenin als knoppen, met een vinkje wat nagelopen is; al ingevuld uit Home Assistant omlijnd (besluit 158).
  const standVan = (id) => (id === hier ? 'nu' : id !== 'klaar' && stapNagelopen(id) ? 'klaar' : id !== 'klaar' && stapGedaan(id) ? 'half' : '');
  $$('[data-stappen]').forEach((el) => {
    el.innerHTML = STAPPEN.map(([id, naam], i) => {
      const s = standVan(id);
      return `<a class="stap ${s}" href="#${id}" ${s === 'nu' ? 'aria-current="step"' : ''}><span class="n" aria-hidden="true">${s === 'klaar' ? '✓' : i + 1}</span><span class="naam">${esc(naam)}</span></a>`;
    }).join('');
  });
  // Op de telefoon (schets Tel-Inrichten-Kort): bovenin de stap en hoe ver je bent, zeven streepjes.
  const i = HOOFD.indexOf(hier);
  $$('[data-telwaar]').forEach((el) => {
    el.innerHTML = i < 0 ? `<b>${esc(nu === 'welkom' ? t('w.welkom') : t(`inr.stap.${nu}`))}</b><span>${esc(t('inr.telStappen', { n: STAPPEN.length }))}</span>` : `<b>${i + 1}. ${esc(STAPPEN[i][1])}</b><span>${esc(t('inr.stapVan', { i: i + 1, n: STAPPEN.length }))}</span>`;
  });
  $$('[data-voortgang]').forEach((el) => {
    el.innerHTML = STAPPEN.map(([id]) => `<i class="${{ nu: 'nu', klaar: 'al', half: 'half' }[standVan(id)] ?? ''}"></i>`).join('');
  });
  const v = { welkom, jehuis: jeHuisStap, meter: meterStap, panelen: panelenStap, prijzen: prijzenHoofd, verwarming: verwarmingStap, apparaat: kanStap, bewoners: bewonersHoofd, klaar: klaarStap }[nu]();
  // Onderaan overal hetzelfde (besluit 158): Terug, Later en Volgende, tenzij de stap iets anders zegt.
  const [links, rechts] = v.voet ?? [terugKnop(), volgendeKnoppen()];
  const actief = document.activeElement;
  // Niet onder de vinger opnieuw opbouwen terwijl iemand typt.
  if (actief && actief.matches?.('[data-kaart] input[type="text"], [data-kaart] input:not([type])') && actief.closest('[data-kaart]')) return;
  // Waar je was in de lijst blijft staan als er iets verandert (besluit 167): eerst sprong hij steeds naar boven.
  const zelfde = getekend === nu;
  getekend = nu;
  $$('[data-kaart]').forEach((el) => {
    const was = zelfde ? el.querySelector('.rijen')?.scrollTop ?? 0 : 0;
    const wasMidden = zelfde ? el.querySelector(':scope > .midden')?.scrollTop ?? 0 : 0;
    el.innerHTML = `<span class="waar">${esc(v.waar)}</span>
      <h1 class="${v.groot ? 'kop-1' : 'kop-2'}" style="${v.groot ? 'font-size: 40px; line-height: 1.05' : ''}">${esc(v.kop)}</h1>
      ${v.uitleg ? `<p class="uitleg">${esc(v.uitleg)}</p>` : ''}
      <div class="midden${nu === 'apparaat' ? ' groei' : ''}">${v.inhoud}</div>
      <span class="melding-inr${melding.fout ? ' fout' : ''}" data-melding>${esc(melding.tekst)}</span>
      <div class="voet">${links || '<span></span>'}${rechts}</div>`;
    const rijen = el.querySelector('.rijen');
    if (rijen && was) rijen.scrollTop = was;
    const midden = el.querySelector(':scope > .midden');
    if (midden && wasMidden) midden.scrollTop = wasMidden;
    app.segmenten(el);
  });
  markeerMeer();
  // Klaar (besluit 323): de zonnewaaier van de standpagina, klein.
  const kw = document.querySelector(`${app.zicht()} [data-klaarwaaier]`);
  if (kw) {
    const vg = stand.voortgang(sd);
    waaier.teken(kw, { groepen: vg.groepen, cx: 195, cy: 204, r0: 62, R: 178, getal: `${vg.totaal}%`, onder: t('voortgang.zo'), groei: false });
  }
  const m = model(nu);
  // Het grote welkom (besluit 200) over het hele scherm, zonder de stappen.
  const groot = nu === 'welkom' && !lijst;
  document.body.classList.toggle('inr-groot', groot);
  if (groot) {
    tekenWelkom(m);
    return;
  }
  // Wat elk apparaat kan (besluit 197): lijst en details naast elkaar, dus een bredere kaart.
  document.querySelector('#wand .veldje')?.classList.toggle('breed', nu === 'apparaat');
  // Zo groot als het vak echt is (besluit 166): op een breder scherm is het vak breder. Het eiland van Thuis (besluit 190).
  const vak = document.querySelector('[data-podium="wand"]');
  if (!app.telStand()) huis.teken(vak, m, { breedte: vak.clientWidth || 700, hoogte: vak.clientHeight || 640, meubels: true, marge: 0.04, zoom: 1, schuifY: 10 });
  // Op de telefoon zonder namen in het kleine huis, zoals op Thuis.
  else huis.teken(document.querySelector('[data-podium="tel"]'), { ...m, etages: m.etages.map((e) => ({ ...e, kamers: e.kamers.map((k) => ({ ...k, stil: true })) })) }, { breedte: 390, hoogte: 250, marge: 0.03, zoom: 1 });
}
const teken = app.gebundeld(tekenNu);

/* ------------------------------------------------------------ doen */

let bezig = false;
document.addEventListener('click', async (e) => {
  const el = e.target.closest('button, a');
  if (!el) return;
  if (el.hasAttribute('data-film')) {
    // Het filmpje (besluit 139), en daarna de rondleiding op Thuis. Moet de assistent nog aan
    // (besluit 202), dan herstart Home Assistant terwijl de film speelt; de film heeft zijn cijfers dan al.
    let aan = null;
    const nogAan = assistentNogAan();
    void film.speel({
      opGeladen: nogAan ? () => (aan = zetAssistentAan()) : undefined,
      opEinde: async () => {
        await aan;
        await naarRondleiding();
      },
    });
    return;
  }
  // Overslaan: ook dan gaat de assistent eerst aan, met de voortgang in beeld.
  if (el.hasAttribute('data-naar-rond') && assistentNogAan()) {
    e.preventDefault();
    await zetAssistentAan();
    await naarRondleiding();
    return;
  }
  if (el.hasAttribute('data-naar-thuis')) {
    // Naar Thuis (besluit 323): de rondleiding is een keuze, dus niet meer vanzelf; de assistent gaat wel eerst aan.
    e.preventDefault();
    try {
      localStorage.setItem('sc-rondleiding-gezien', '1');
    } catch {
      // Zonder opslag begint de rondleiding op Thuis, zoals eerst.
    }
    if (assistentNogAan()) await zetAssistentAan();
    location.href = 'thuis.html';
    return;
  }
  if (el.hasAttribute('data-terug')) {
    naar(vorige(stapNu()));
    return;
  }
  if (el.hasAttribute('data-aanpassen')) {
    // Aanpassen en Invullen (besluit 352): de pagina bij Instellingen, met de balk terug naar deze stap.
    const h = stapNu();
    const doel = AANPAS[h]?.();
    if (!doel) return;
    if (doel.startsWith('#')) return naar(doel.slice(1));
    app.onthoudInrichten('app', h);
    location.href = doel;
    return;
  }
  if (el.hasAttribute('data-ja')) {
    // Ja (besluit 323): wat er staat, geldt; Volgende van elk deel bewaart wat er in beeld zou staan, zoals eerst (besluit 158).
    if (bezig) return;
    const h = stapNu();
    bezig = true;
    el.disabled = true;
    try {
      for (const deel of delenVan(h)) {
        if (BEVESTIG[deel] && !(await BEVESTIG[deel]())) return;
        markeer(deel);
      }
      markeer(h);
      naar(volgende(h));
    } finally {
      bezig = false;
      el.disabled = false;
    }
    return;
  }
  if (el.hasAttribute('data-volgende')) {
    // Volgende bewaart wat er staat (besluit 158); twee keer tikken bewaart één keer.
    if (bezig) return;
    const nu = stapNu();
    bezig = true;
    el.disabled = true;
    try {
      if (BEVESTIG[nu] && !(await BEVESTIG[nu]())) return;
      verder(nu);
    } finally {
      bezig = false;
      el.disabled = false;
    }
    return;
  }
  if (el.hasAttribute('data-later')) {
    // Later (besluit 190): door zonder te bewaren; de stap staat dan bij Mist nog. Uit een deel naar de volgende stap.
    const nu = stapNu();
    naar(hoofdVan(nu) && hoofdVan(nu) !== nu ? volgende(hoofdVan(nu)) : volgende(nu));
    return;
  }
  // De assistent met één knop (besluit 202).
  if (el.hasAttribute('data-assistent-aan')) {
    el.disabled = true;
    await zetAssistentAan();
    teken();
    return;
  }
  if (el.dataset.lijst !== undefined) {
    lijst = el.dataset.lijst || null;
    teken();
    return;
  }
  if (el.dataset.kanOpen) {
    // Wat elk apparaat kan: een ander apparaat open; op de telefoon dicht als het al open was.
    kanOpen = app.telStand() && kanOpen === el.dataset.kanOpen ? null : el.dataset.kanOpen;
    teken();
    return;
  }
  if (el.dataset.kanWarmte) {
    const key = el.dataset.kanWarmte;
    const x = kanToestellen().find(({ a }) => sleutel(a) === key);
    const next = concept();
    if (!x || !next) return;
    next.apparaten[key] = { ...(next.apparaten[key] ?? { kamer: x.r.id, zone: null }), warmte: el.dataset.waarde };
    await bewaarIndeling(next);
    return;
  }
  if (el.dataset.rolwaarde) {
    // Wat de regeling met een apparaat doet (besluit 138), met de knoppen van de schets.
    const seg = el.closest('[data-rol]');
    const next = concept();
    const k = next?.kamers.find((x) => x.id === seg.dataset.rolkamer);
    const r = binnen().find((x) => x.id === seg.dataset.rolkamer);
    if (!k || !r) return;
    const rollen = Object.fromEntries(klimaatIn(r).map((a) => [sleutel(a), rolVan(k, r, sleutel(a))]));
    k.rollen = { ...(k.rollen ?? {}), ...rollen, [seg.dataset.rol]: el.dataset.rolwaarde };
    await bewaarIndeling(next);
    return;
  }
});

document.addEventListener('change', async (e) => {
  const el = e.target;
  if (!el.dataset.kanBereik) return;
  // Wat elk apparaat kan: het bereik dat de regeling aanhoudt; de laagste blijft onder de hoogste.
  const key = el.dataset.kanBereik;
  const x = kanToestellen().find(({ a }) => sleutel(a) === key);
  const next = concept();
  if (!x || !next) return;
  const b = kanBereik(x.a);
  let [lo, hi] = [b.min, b.max];
  if (el.dataset.kant === 'min') lo = Number(el.value);
  else hi = Number(el.value);
  if (lo >= hi) return void zeg(t('inr.kan.laagOnderHoog'), true);
  next.apparaten[key] = { ...(next.apparaten[key] ?? { kamer: x.r.id, zone: null }), bereik: [lo, hi] };
  await bewaarIndeling(next);
});

addEventListener('standwissel', teken);
addEventListener('hashchange', () => {
  if (stapNu() !== 'welkom') lijst = null;
  zeg('');
  teken();
  // Klaarzetten: opnieuw kijken, want de bewoner kan net in Home Assistant iets hebben gedaan.
  if (stapNu() === 'klaar') {
    haal('api/klaarzetten').then((x) => {
      d.klaar = x;
      teken();
    }).catch(() => {});
  }
});

app.start('instellingen');
// Weer in Inrichten (besluit 227): de terugknoppen elders gaan weer naar Instellingen. Een link naar een
// andere pagina onthoudt deze stap, zodat die pagina "‹ Inrichten" zegt.
app.vergeetInrichten();
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href]');
  const href = a?.getAttribute('href') ?? '';
  if (!a || href.startsWith('#') || /^[a-z]+:/i.test(href) || /^inrichten\.html/.test(href)) return;
  app.onthoudInrichten('app', location.hash.slice(1));
}, true);
void laad();
