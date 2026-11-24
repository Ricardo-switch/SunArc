/*
 * Deel van inrichten.js (opgesplitst op 22 november 2026): tekenen. Een gewoon script dat na
 * inrichten-voorstellen.js laadt en zijn bovenste namen deelt met de andere delen van de pagina.
 */
'use strict';
/* global $$, BEVESTIG, HOOFD, STAPPEN, aanpas:writable, accountStap, afwezigBasis, afwezigKeuze:writable, afwezigStap, antwoorden, apparatenStap, assistentNogAan, bewaarAansluiting, bewaarAfwezig, bewaarDag, bewaarFuncties, bewaarIndeling, bewaarKort, bewaarPrijzen, bewaarVoorkeur, bewonersHoofd, binnen, buitenStap, cfDoel, cfNu, comfortStap, concept, contractKeuze:writable, d, dagBalk, dagMet, dagMoment, dagNu, dagStap, dagUur, delenVan, deur, energieNu, esc, functiesNu, functiesStap, haStap, haal, hoofdVan, huisDoel, huisStap, idVan, jeHuisStap, kanBereik, kanOpen:writable, kanStap, kanToestellen, klaarStap, klimaatIn, laad, ligStaat, liggingStap, lijst:writable, markeer, melding, metEtage, metenStap, meterStap, model, naar, naarRondleiding, nl, openKamer:writable, openApparaat:writable, openBewoner:writable, opzonStap, panelenStap, prijzenHoofd, rolVan, rondVanConcept, samenvoegen, sd, sleutel, standaard, stapGedaan, stapNagelopen, stapNu, stemStap, stuurBewoner, tekenMini, tekenWelkom, toevoeg:writable, toevoegenIn:writable, verder, vermogenStap, verplaatsKamer, verwarmingStap, volgende, vorige, wandStap, warmteStap, weghalen:writable, welkom, wnKaart, woningNu, woningStap, zeg, zekeringStap, zetAssistentAan, zetCf, zonStap */
// eslint-disable-next-line no-unused-vars -- alleen teruggezet; gelezen in een ander deel
/* global cfKeuze:writable, dagGreep:writable, dagKeuze:writable, zonderKlimaat:writable */
/* exported teken, terugKnop, volgendeKnoppen */
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
const terugKnop = () => `<button type="button" class="zachtknop" data-terug>${esc(t('panelen.terug'))}</button>`;
const volgendeKnoppen = () => `<span class="rechts"><button type="button" class="zachtknop" data-later>${esc(t('inr.later'))}</button><button type="button" class="knop knop-licht" data-volgende>${esc(t('inr.volgende'))}</button></span>`;
/** De wand in het klein bij De wand: dit huis, zoals het nu getekend is. */
function tekenWandje(el, m) {
  huis.teken(el, { ...m, labels: [], etages: m.etages.map((e) => ({ ...e, kamers: e.kamers.map((k) => ({ ...k, stil: true })) })) }, { breedte: el.clientWidth || 200, hoogte: el.clientHeight || 120, marge: 0.06 });
}
function tekenNu() {
  app.schaal();
  app.luchtVan(d.zon, 0);
  // Je dag: de lucht van het uur bij de grens die je het laatst bewoog (ook in de winter de ochtend en de avond).
  if (stapNu() === 'dag') app.lucht(dagMoment(dagUur()).tijd, 'zomer', 0.3);
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
    el.innerHTML = i < 0 ? `<b>${esc(nu === 'welkom' ? t('inr.welkom') : t(`inr.stap.${nu}`))}</b><span>${esc(t('inr.telStappen', { n: STAPPEN.length }))}</span>` : `<b>${i + 1}. ${esc(STAPPEN[i][1])}</b><span>${esc(t('inr.stapVan', { i: i + 1, n: STAPPEN.length }))}</span>`;
  });
  $$('[data-voortgang]').forEach((el) => {
    el.innerHTML = STAPPEN.map(([id]) => `<i class="${{ nu: 'nu', klaar: 'al', half: 'half' }[standVan(id)] ?? ''}"></i>`).join('');
  });
  const v = { welkom, jehuis: jeHuisStap, meter: meterStap, panelen: panelenStap, verwarming: verwarmingStap, woning: woningStap, huis: huisStap, buiten: buitenStap, bewoners: bewonersHoofd, apparaten: apparatenStap, meten: metenStap, warmte: warmteStap, apparaat: kanStap, dag: dagStap, comfort: comfortStap, afwezig: afwezigStap, zon: zonStap, ligging: liggingStap, zekering: zekeringStap, vermogen: vermogenStap, opzon: opzonStap, prijzen: prijzenHoofd, functies: functiesStap, wand: wandStap, ha: haStap, stem: stemStap, klaar: klaarStap, account: accountStap }[nu]();
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
      <p class="uitleg">${esc(v.uitleg)}</p>
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
  // Een kamer die open gaat, schuift in beeld.
  document.querySelector(`${app.zicht()} [data-kaart] .bewerk`)?.scrollIntoView({ block: 'nearest' });
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
  // De kleine huisjes bij Wat voor huis, en de wand in het klein.
  document.querySelectorAll(`${app.zicht()} [data-kaart] [data-mini]`).forEach((el) => (el.dataset.mini === 'wand' ? tekenWandje(el, m) : tekenMini(el)));
  // Zo groot als het vak echt is (besluit 166): op een breder scherm is het vak breder. Het eiland van Thuis (besluit 190).
  const vak = document.querySelector('[data-podium="wand"]');
  // Bij Klopt je huis? zijn de kamers in het huis aan te tikken en te slepen (besluit 166).
  if (!app.telStand()) huis.teken(vak, m, { breedte: vak.clientWidth || 700, hoogte: vak.clientHeight || 640, meubels: true, marge: 0.04, zoom: 1, schuifY: 10, tik: nu === 'huis' });
  // Op de telefoon zonder namen in het kleine huis, zoals op Thuis.
  else huis.teken(document.querySelector('[data-podium="tel"]'), { ...m, etages: m.etages.map((e) => ({ ...e, kamers: e.kamers.map((k) => ({ ...k, stil: true })) })) }, { breedte: 390, hoogte: 250, marge: 0.03, zoom: 1 });
}
const teken = app.gebundeld(tekenNu);

/*
 * Slepen in het huis (besluit 166): bij Klopt je huis? pak je een kamer in de
 * tekening en laat je hem los op een andere kamer; hij neemt die plek in, ook
 * op een andere etage. Een tik zonder slepen opent de kamer in de lijst.
 */
{
  const vak = document.querySelector('[data-podium="wand"]');
  let sleep = null;
  const kamerOnder = (x, y) => document.elementFromPoint(x, y)?.closest?.('[data-podium="wand"] [data-kamer]') ?? null;
  const markeer = (el) => {
    vak.querySelectorAll('.sc-doel').forEach((x) => x.classList.remove('sc-doel'));
    el?.classList.add('sc-doel');
  };
  vak?.addEventListener('pointerdown', (/** @type {PointerEvent} */ e) => {
    const el = e.target.closest('[data-kamer]');
    if (stapNu() !== 'huis' || !el || !binnen().some((r) => r.id === el.dataset.kamer)) return;
    e.preventDefault();
    sleep = { id: el.dataset.kamer, x: e.clientX, y: e.clientY, bezig: false };
    el.classList.add('sc-gepakt');
  });
  document.addEventListener('pointermove', (e) => {
    if (!sleep) return;
    if (!sleep.bezig && Math.hypot(e.clientX - sleep.x, e.clientY - sleep.y) > 10) sleep.bezig = true;
    if (!sleep.bezig) return;
    const doel = kamerOnder(e.clientX, e.clientY);
    markeer(doel && doel.dataset.kamer !== sleep.id && binnen().some((r) => r.id === doel.dataset.kamer) ? doel : null);
  });
  const los = async (e) => {
    if (!sleep) return;
    const { id, bezig: gesleept } = sleep;
    sleep = null;
    vak.querySelectorAll('.sc-gepakt').forEach((x) => x.classList.remove('sc-gepakt'));
    markeer(null);
    if (!gesleept) {
      openKamer = openKamer === id ? null : id;
      weghalen = null;
      teken();
      return;
    }
    const doel = e.type === 'pointerup' ? kamerOnder(e.clientX, e.clientY)?.dataset.kamer : null;
    const next = concept();
    if (!doel || !next) return;
    const naam = next.kamers.find((x) => x.id === id)?.naam;
    if (verplaatsKamer(next, id, { doelId: doel })) {
      openKamer = id;
      await bewaarIndeling(next, t('inr.nieuwePlek', { naam }));
    }
  };
  document.addEventListener('pointerup', los);
  document.addEventListener('pointercancel', los);
}

/* ------------------------------------------------------------ doen */

let bezig = false;
document.addEventListener('click', async (e) => {
  const el = e.target.closest('button, a');
  if (!el) return;
  // Een omvormer weghalen (testerronde, november 2026).
  if (el.hasAttribute('data-omvormer-weg')) {
    const va = antwoorden();
    if (vermogens.klik(el, d.aans, va)) await bewaarAansluiting(va);
    return;
  }
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
    // Terug uit de vragen van Prijzen of Wie woont hier: naar het voorstel.
    if (aanpas && aanpas === stapNu()) {
      aanpas = null;
      teken();
      return;
    }
    naar(vorige(stapNu()));
    return;
  }
  if (el.hasAttribute('data-aanpassen')) {
    // Aanpassen (besluit 323): de schermen van eerst, als delen van deze stap.
    const h = stapNu();
    // Je huis (stap 4): dezelfde tekentafel als bij Instellingen, met een balk terug naar hier.
    if (h === 'jehuis') {
      location.href = 'jehuis.html?van=inrichten';
      return;
    }
    const delen = delenVan(h);
    if (delen.length === 1 && delen[0] === h) {
      aanpas = h;
      teken();
    } else if (delen.length) naar(delen[0]);
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
      aanpas = null;
      verder(nu);
    } finally {
      bezig = false;
      el.disabled = false;
    }
    return;
  }
  if (el.hasAttribute('data-later')) {
    // Later (besluit 190): door zonder te bewaren; de stap staat dan bij Mist nog. Uit een deel naar de volgende stap.
    aanpas = null;
    const nu = stapNu();
    naar(hoofdVan(nu) && hoofdVan(nu) !== nu ? volgende(hoofdVan(nu)) : volgende(nu));
    return;
  }
  if (el.dataset.woning || el.dataset.dak || el.dataset.schuur) {
    // Wat voor huis, en welk dak (besluit 190); in de tuin het tuinhuis of het schuurtje.
    const next = concept();
    if (!next) return;
    if (el.dataset.woning) {
      next.woning = el.dataset.woning;
      next.buren = woningDeel.burenBij(next.woning, wnKaart, next.buren);
    }
    if (el.dataset.dak) {
      const boven = (d.huis?.etages ?? []).find((e) => e.id !== 'buiten' && e.id !== 'kelder' && (e.ruimtes ?? []).length);
      if (el.dataset.dak === 'plat') next.dak = 'geen';
      else if (d.huis?.dakEtage || boven) next.dak = d.huis?.dakEtage ?? boven.id;
    }
    // Het tuinhuis, het schuurtje of allebei.
    if (el.dataset.schuur) next.rond = { ...rondVanConcept(next), schuur: el.dataset.schuur === 'schuur', allebei: el.dataset.schuur === 'beide' };
    await bewaarIndeling(next);
    return;
  }
  if (el.dataset.flat) {
    // Een appartement: de verdieping of erboven een hoger of lager, zoals in Je huis.
    const next = concept();
    if (!next) return;
    Object.assign(next, woningDeel.stap(next, el.dataset.flat, Number(el.dataset.stap)));
    await bewaarIndeling(next);
    return;
  }
  if (el.dataset.buur) {
    // Welke muur tegen de buren staat: hetzelfde als in Je huis.
    const next = concept();
    if (!next) return;
    next.buren = woningDeel.wissel(next.buren ?? (wnKaart?.soort === woningNu() ? wnKaart.buren : []), el.dataset.buur);
    if (next.buren.length && woningNu() === 'vrijstaand') next.woning = next.buren.filter((k) => k !== 'achter').length > 1 ? 'rij' : 'tweekap';
    else if (!next.buren.length && woningNu() !== 'appartement') next.woning = 'vrijstaand';
    await bewaarIndeling(next);
    return;
  }
  if (el.dataset.kelder) {
    // Een kelder (besluit 190): erbij als kamer op de etage Kelder; weg kan alleen als er niets in staat.
    const next = concept();
    if (!next) return;
    const kelder = next.kamers.filter((k) => k.etage === 'kelder');
    if (el.dataset.kelder === 'ja') {
      if (kelder.length) return;
      const naam = t('inr.kelderNaam');
      next.kamers.push({ id: idVan(naam, new Set(next.kamers.map((k) => k.id))), naam, etage: 'kelder', soort: 'kelder', zones: [], regelzone: null, haGebied: null });
      await bewaarIndeling(next, t('indeling.toegevoegd', { naam }));
      return;
    }
    if (!kelder.length) return;
    const vol = kelder.some((k) => (binnen().find((r) => r.id === k.id)?.apparaten ?? []).length > 0 || Object.values(next.apparaten).some((a) => a.kamer === k.id));
    if (vol) return zeg(t('inr.kelderVol'), true);
    next.kamers = next.kamers.filter((k) => k.etage !== 'kelder');
    await bewaarIndeling(next);
    return;
  }
  if (el.dataset.zonderklimaat) {
    zonderKlimaat = el.dataset.zonderklimaat === '1';
    teken();
    return;
  }
  if (el.dataset.afw) {
    // Afwezig en vakantie (besluit 190): een halve graad per tik, met een graad tussen verwarmen en koelen.
    const [m, s, stap] = el.dataset.afw.split(':');
    const b = JSON.parse(JSON.stringify(afwezigKeuze ?? afwezigBasis()));
    const grens = s === 'heat' ? [5, 28] : [16, 32];
    b[m][s] = Math.min(grens[1], Math.max(grens[0], b[m][s] + Number(stap)));
    if (s === 'heat' && b[m].cool < b[m].heat + 1) b[m].cool = b[m].heat + 1;
    if (s === 'cool' && b[m].heat > b[m].cool - 1) b[m].heat = b[m].cool - 1;
    afwezigKeuze = b;
    await bewaarAfwezig();
    return;
  }
  if (el.dataset.opzon || el.dataset.opzonVast) {
    // Op zon (besluit 167): aan start hij als er zon over is.
    const a = antwoorden();
    const aan = el.getAttribute('aria-checked') !== 'true';
    if (el.dataset.opzon) a.opZon[el.dataset.opzon] = aan;
    else a.opZonUit = aan ? a.opZonUit.filter((x) => x !== el.dataset.opzonVast) : [...new Set([...a.opZonUit, el.dataset.opzonVast])];
    await bewaarAansluiting(a);
    return;
  }
  if (el.dataset.wkaart) {
    // De kaarten op de wand (besluit 190): dezelfde indeling als op je telefoon.
    const nu = d.voork?.wand?.kaarten ?? [];
    const k = el.dataset.wkaart;
    const kaarten = nu.includes(k) ? nu.filter((x) => x !== k) : [...nu, k];
    if (kaarten.length) await bewaarVoorkeur({ plek: 'wand', kaarten });
    return;
  }
  if (el.hasAttribute('data-wnacht')) {
    await bewaarVoorkeur({ plek: 'wand', niemand: { nacht: d.voork?.wand?.niemand?.nacht !== true } });
    return;
  }
  if (el.dataset.wtaal) {
    // Een andere taal laadt de pagina opnieuw (taal.js).
    const uit = await bewaarVoorkeur({ plek: 'tel', taal: el.dataset.wtaal });
    if (uit) taal.zetKeuze(uit.tel.taal, { scherm: uit.scherm === true });
    return;
  }
  // De assistent met één knop (besluit 202).
  if (el.hasAttribute('data-assistent-aan')) {
    el.disabled = true;
    await zetAssistentAan();
    teken();
    return;
  }
  if (el.dataset.haPad) {
    // Terug uit Home Assistant op deze stap (besluit 227).
    app.onthoudInrichten('ha', location.hash.slice(1));
    app.naarHAScherm(el.dataset.haPad);
    return;
  }
  // Hoe de panelen liggen (besluit 157); Klopt telt als nagelopen en gaat door.
  if (Object.keys(el.dataset).some((k) => k.startsWith('lig'))) {
    const a = antwoorden();
    const klopt = el.hasAttribute('data-lig-klopt');
    const wat = ligging.klik(el, d.aans?.ligging, a, ligStaat);
    if (wat === 'bewaar') await bewaarAansluiting(a);
    else if (wat === 'teken') teken();
    if (klopt && d.aans?.ligging?.stand === 'bevestigd') verder('ligging');
    return;
  }
  if (el.dataset.lijst !== undefined) {
    lijst = el.dataset.lijst || null;
    teken();
    return;
  }
  if (el.dataset.sopt) {
    const s = (d.bewoners?.schermen ?? []).find((x) => x.id === el.dataset.scherm);
    if (!s) return;
    const aan = !(s.opties?.[el.dataset.sopt] === true);
    await stuurBewoner({ actie: 'schermOpties', id: s.id, opties: { [el.dataset.sopt]: aan } }, t(aan ? 'inr.schermAan' : 'inr.schermUit', { naam: s.naam }));
    return;
  }
  if (el.dataset.bewoner) {
    openBewoner = openBewoner === el.dataset.bewoner ? null : el.dataset.bewoner;
    teken();
    return;
  }
  if (el.dataset.bvolg && openBewoner) {
    const v = (d.bewoners?.bewoners ?? []).map((x) => x.id);
    const i = v.indexOf(openBewoner);
    const j = i + Number(el.dataset.bvolg);
    if (i < 0 || j < 0 || j >= v.length) return;
    [v[i], v[j]] = [v[j], v[i]];
    await stuurBewoner({ actie: 'volgorde', volgorde: v });
    return;
  }
  if (el.hasAttribute('data-bhoofd') && openBewoner) {
    await stuurBewoner({ actie: 'hoofd', id: openBewoner });
    return;
  }
  if (el.dataset.bcomfort && openBewoner) {
    await stuurBewoner({ actie: 'comfort', id: openBewoner, comfort: el.dataset.bcomfort });
    return;
  }
  if (el.dataset.apparaat) {
    openApparaat = openApparaat === el.dataset.apparaat ? null : el.dataset.apparaat;
    teken();
    return;
  }
  if (el.dataset.verberg) {
    const next = concept();
    if (!next) return;
    const id = el.dataset.verberg;
    const naam = [...(d.huis?.zonderRuimte ?? []), ...(d.huis?.etages ?? []).flatMap((x) => x.ruimtes ?? []).flatMap((r) => r.apparaten ?? [])].find((a) => a.id === id)?.naam ?? t('indeling.hetApparaat');
    next.verborgen = [...new Set([...(next.verborgen ?? []), id])];
    openApparaat = null;
    await bewaarIndeling(next, t('indeling.naamWeg', { naam }));
    return;
  }
  if (el.dataset.kamer) {
    openKamer = openKamer === el.dataset.kamer ? null : el.dataset.kamer;
    weghalen = null;
    teken();
    return;
  }
  if (el.hasAttribute('data-nieuw')) {
    openKamer = 'nieuw';
    teken();
    setTimeout(() => document.querySelector(`${app.zicht()} [data-nieuwnaam]`)?.focus(), 50);
    return;
  }
  // Een etage erbij (testerronde, november 2026).
  if (el.hasAttribute('data-inr-etage-open') || el.hasAttribute('data-inr-etage-dicht')) {
    openKamer = el.hasAttribute('data-inr-etage-open') ? 'etage' : null;
    teken();
    return;
  }
  if (el.dataset.inrEtage || el.hasAttribute('data-inr-etage-eigen')) {
    const next = concept();
    if (!next) return;
    let id = el.dataset.inrEtage;
    const naam = id ? null : document.querySelector(`${app.zicht()} [data-inr-etage-naam]`)?.value.trim();
    if (!id) {
      if (!naam) return;
      const bezet = new Set([...(d.ind?.etages ?? []).map((e) => e.id), ...(d.ind?.standaard ?? []).map((s) => s.id), 'buiten']);
      id = idVan(naam, bezet);
    }
    next.volgorde = metEtage(next, id, !el.dataset.inrEtage);
    if (naam) next.etages = { ...(next.etages ?? {}), [id]: naam };
    openKamer = 'nieuw';
    await bewaarIndeling(next, t('indeling.toegevoegd', { naam: naam ?? el.textContent.trim() }));
    return;
  }
  if (el.hasAttribute('data-voegtoe')) {
    const naam = document.querySelector(`${app.zicht()} [data-nieuwnaam]`)?.value.trim();
    if (!naam) return;
    const next = concept();
    const id = idVan(naam, new Set(next.kamers.map((k) => k.id)));
    next.kamers.push({ id, naam, etage: document.querySelector(`${app.zicht()} [data-nieuwetage]`)?.value || 'bg', zones: [], regelzone: null, haGebied: null });
    openKamer = null;
    await bewaarIndeling(next, t('indeling.toegevoegd', { naam }));
    return;
  }
  if (el.dataset.kamerweg) {
    // Twee tikken: de eerste vraagt het nog eens.
    if (weghalen !== el.dataset.kamerweg) {
      weghalen = el.dataset.kamerweg;
      teken();
      return;
    }
    const next = concept();
    const k = next.kamers.find((x) => x.id === weghalen);
    if (!k) return;
    next.kamers = next.kamers.filter((x) => x.id !== k.id);
    // Wat in deze kamer stond, gaat naar "nog in te delen", net als bij Indeling.
    for (const [id, a] of Object.entries(next.apparaten)) if (a.kamer === k.id) delete next.apparaten[id];
    for (const x of next.kamers) if (x.meedoenMet === k.id) delete x.meedoenMet;
    openKamer = null;
    weghalen = null;
    await bewaarIndeling(next, t('indeling.naamWeg', { naam: k.naam }));
    return;
  }
  if (el.dataset.schuifkamer) {
    const next = concept();
    if (next && verplaatsKamer(next, openKamer, { stap: Number(el.dataset.schuifkamer) })) await bewaarIndeling(next);
    return;
  }
  if (el.dataset.zoneweg) {
    const next = concept();
    const k = next.kamers.find((x) => x.id === openKamer);
    const z = k?.zones.find((x) => x.id === el.dataset.zoneweg);
    if (!z) return;
    k.zones = k.zones.filter((x) => x.id !== z.id);
    for (const a of Object.values(next.apparaten)) if (a.kamer === k.id && a.zone === z.id) a.zone = null;
    await bewaarIndeling(next, t('indeling.zoneWeg', { naam: z.naam }));
    return;
  }
  if (el.dataset.erbij) {
    toevoegenIn = el.dataset.erbij;
    toevoeg = null;
    teken();
    return;
  }
  // Iets toevoegen (besluit 167): wat er hangt, hoe het aangaat, en bewaren.
  if (el.dataset.toevoegSoort) {
    toevoeg = { soort: el.dataset.toevoegSoort, aan: null, apparaat: null, vloer: null };
    teken();
    return;
  }
  if (el.dataset.toevoegVloer && toevoeg) {
    toevoeg = { ...toevoeg, vloer: el.dataset.toevoegVloer, aan: null, apparaat: null };
    teken();
    return;
  }
  if (el.dataset.toevoegAan && toevoeg) {
    toevoeg = { ...toevoeg, aan: el.dataset.toevoegAan, apparaat: null };
    teken();
    return;
  }
  if (el.hasAttribute('data-toevoeg-annuleer')) {
    toevoegenIn = null;
    toevoeg = null;
    teken();
    return;
  }
  if (el.hasAttribute('data-toevoeg-bewaar') && toevoeg && toevoegenIn) {
    const next = concept();
    const k = next?.kamers.find((x) => x.id === toevoegenIn);
    if (!k) return;
    const v = toevoeg;
    const elektrisch = v.soort === 'vloer' && v.vloer === 'elektrisch';
    const cv = v.soort === 'radiator' || (v.soort === 'vloer' && !elektrisch);
    const ketel = huismodel.cvThermostaat(d.huis, antwoorden().verwarming);
    // Elektrische vloerverwarming bewaart de dienst als vloer-elektrisch, zoals Kamers en indeling.
    const soorten = [elektrisch ? 'vloer-elektrisch' : v.soort];
    const bezet = new Set((k.bronnen ?? []).map((x) => x.id));
    let id = v.soort;
    for (let i = 2; bezet.has(id); i++) id = `${v.soort}-${i}`;
    const b = { id, soorten, aan: v.aan };
    if (cv && v.aan === 'thermostaat') {
      if (ketel) b.apparaat = ketel.sleutel;
    } else if (v.aan !== 'hand' && v.apparaat) b.apparaat = v.apparaat;
    k.bronnen = [...(k.bronnen ?? []), b];
    toevoegenIn = null;
    toevoeg = null;
    await bewaarIndeling(next, t('inr.toegevoegdBij', { naam: huismodel.bronNaam(b), kamer: k.naam }));
    return;
  }
  // Je dag: een grens een uur eerder of later, of een stuk van de dag aantikken.
  if (el.dataset.dg) {
    const [g, stap] = el.dataset.dg.split(':');
    const dg = dagNu();
    dagGreep = g;
    await bewaarDag(dagMet(dg, g, dg[g] + Number(stap)));
    return;
  }
  if (el.dataset.dgDeel) {
    // De tekening laat dat dagdeel zien: overdag de grens van de dag, 's nachts die van de nacht.
    dagGreep = el.dataset.dgDeel === 'dag' ? 'dag' : 'nacht';
    teken();
    return;
  }
  // Hoe warm wil je het: een getal kiezen, en het aanpassen.
  if (el.dataset.cf) {
    const [kamer, deel, soort] = el.dataset.cf.split('|');
    cfKeuze = { kamer, deel, soort };
    teken();
    return;
  }
  if (el.dataset.cfDeel) {
    const sel = cfNu();
    cfKeuze = { ...sel, deel: el.dataset.cfDeel };
    teken();
    return;
  }
  if (el.dataset.cfStap || el.hasAttribute('data-cf-uit') || el.hasAttribute('data-cf-huis')) {
    const sel = cfNu();
    const nu = cfDoel(sel.kamer, sel.deel, sel.soort);
    const s = standaard();
    const gewoon = sel.soort === 'heat' ? s.warm[sel.deel] : s.koel[sel.deel];
    const b = d.comfort.bereik?.[sel.soort === 'heat' ? 'verwarmen' : 'koelen'] ?? { min: 5, max: 32 };
    let v;
    if (el.dataset.cfStap) v = Math.min(b.max, Math.max(b.min, Math.round(((nu ?? gewoon) + Number(el.dataset.cfStap)) * 2) / 2));
    else if (el.hasAttribute('data-cf-uit')) v = nu == null ? gewoon : null;
    else v = huisDoel(sel.deel, sel.soort);
    await zetCf(sel, v);
    return;
  }
  if (el.dataset.kanOpen) {
    // Wat elk apparaat kan: een ander apparaat open; op de telefoon dicht als het al open was.
    kanOpen = app.telStand() && kanOpen === el.dataset.kanOpen ? null : el.dataset.kanOpen;
    teken();
    return;
  }
  if (el.hasAttribute('data-kan-mist')) {
    // Iets toevoegen kan bij Verwarmen en koelen, per kamer.
    naar('warmte');
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
  // De hoofdzekering (stap 4, zekering.js).
  {
    const a = antwoorden();
    const z = zekering.klik(el, a.zekering);
    if (z === 'teken') return teken();
    if (z !== undefined) {
      a.zekering = z;
      await bewaarAansluiting(a);
      return;
    }
  }
  if (el.dataset.verwarming) {
    const a = antwoorden();
    a.verwarming = { ...a.verwarming, soort: el.dataset.verwarming };
    await bewaarAansluiting(a);
    return;
  }
  if (el.dataset.panelen === 'geen') {
    const a = antwoorden();
    a.panelen = { ligging: 'geen', aantal: null, voorkant: null, achterkant: null };
    a.elders = {};
    // Ook de vlakken van Daken en panelen weg (besluit 254): anders tellen ze nog.
    await bewaarAansluiting(a, null);
    return;
  }
  // De korte stap Daken (besluit 254, stap 3): een plek aantikken, een teller, de kanten van het hoofddak.
  if (el.dataset.kortPlek) {
    const p = el.dataset.kortPlek;
    const piekW = (d.zon?.panelen ?? []).reduce((som, x) => som + (x.wattpiek ?? 0), 0);
    const leeg = !Object.keys(dakvlakken.kortVan(d.aans?.daken).aan).length;
    // Het hoofddak begint bij wat Home Assistant al weet, als het de eerste plek is.
    const n = p === 'hoofddak' && leeg && piekW > 0 ? Math.max(1, Math.round(piekW / 430)) : p === 'hoofddak' ? 10 : 8;
    await bewaarKort({ plek: p, n });
    return;
  }
  if (el.dataset.kortStap) {
    const kort = dakvlakken.kortVan(d.aans?.daken);
    const stap = Number(el.dataset.kortStap);
    if (el.dataset.kortN) await bewaarKort({ plek: el.dataset.kortN, n: (kort.aan[el.dataset.kortN] ?? 0) + stap });
    else if (el.dataset.kortKant) {
      const i = Number(el.dataset.kortKant);
      await bewaarKort({ kant: i, n: (kort.perKant[i] ?? 0) + stap });
    }
    return;
  }
  if (el.dataset.kortKanten) {
    await bewaarKort({ kanten: Number(el.dataset.kortKanten) });
    return;
  }
  if (contract.klik(el) !== undefined) {
    // Het soort contract (besluit 158, stap 4: dezelfde rij als bij Energie): één tarief laat het daltarief vallen.
    contractKeuze = contract.klik(el);
    const a = antwoorden();
    const tarief = contract.tarief(contractKeuze);
    if (a.tarief !== tarief) {
      a.tarief = tarief;
      await bewaarAansluiting(a);
    }
    const wijzig = {};
    if (contractKeuze !== 'dagnacht' && energieNu()?.prijzen?.stroomDal != null) wijzig.stroomDal = null;
    // De uurprijs van Home Assistant gaat mee met het contract (issue 119).
    const dyn = d.energie?.voorstel?.prijzen?.dynamisch;
    const heeft = !!energieNu()?.prijzen?.dynamisch;
    if (tarief === 'dynamisch' && !heeft && dyn) wijzig.dynamisch = JSON.parse(JSON.stringify(dyn));
    if (tarief === 'vast' && heeft) wijzig.dynamisch = null;
    if (Object.keys(wijzig).length) await bewaarPrijzen(wijzig);
    else teken();
    return;
  }
  if (el.dataset.rond) {
    // Wat er rond het huis is (besluit 158): elk deel apart aan of uit.
    const next = concept();
    if (!next) return;
    next.rond = el.dataset.rond.startsWith('huisje:') ? huismodel.huisjeWissel(rondVanConcept(next), el.dataset.rond.slice(7)) : huismodel.rondWissel(rondVanConcept(next), el.dataset.rond);
    await bewaarIndeling(next);
    return;
  }
  if (el.dataset.meet) {
    // Meten met (besluit 123): een thermometer aan of uit voor deze kamer.
    const next = concept();
    const k = next?.kamers.find((x) => x.id === el.dataset.meetkamer);
    if (!k) return;
    const lijst = new Set(k.meten ?? []);
    if (lijst.has(el.dataset.meet)) lijst.delete(el.dataset.meet);
    else lijst.add(el.dataset.meet);
    if (lijst.size) k.meten = [...lijst].slice(0, 6);
    else delete k.meten;
    await bewaarIndeling(next);
    return;
  }
  if (el.dataset.flicht || el.dataset.fscherm || el.dataset.fcam || el.dataset.fpraat || el.dataset.ftedoen) {
    const c = functiesNu();
    if (!c) return;
    if (el.dataset.flicht) c.licht = { ...c.licht, bedienen: el.dataset.flicht === 'true' };
    if (el.dataset.fscherm) c.schermen = { ...c.schermen, bedienen: el.dataset.fscherm === 'true' };
    if (el.dataset.fcam) c.cameras = { ...c.cameras, aan: el.dataset.fcam === 'true' };
    if (el.dataset.fpraat) c.praten = { ...c.praten, bedienen: el.dataset.fpraat === 'true' };
    // Te doen (besluit 217): de lijsten en agenda's die het huis vond, die kies je bij Instellingen › Assistent.
    if (el.dataset.ftedoen) c.tedoen = { boodschappen: null, todo: null, afval: null, gezin: null, ...c.tedoen, aan: el.dataset.ftedoen === 'true' };
    await bewaarFuncties(c);
  }
  // Hoe praat je huis (besluit 203): waar de stem vandaan komt, en of de browser mag verstaan.
  if (el.dataset.stembron || el.dataset.stemverstaan) {
    const c = functiesNu();
    if (!c) return;
    if (el.dataset.stembron) c.praten = { ...c.praten, stem: el.dataset.stembron };
    if (el.dataset.stemverstaan) c.praten = { ...c.praten, verstaan: el.dataset.stemverstaan === 'true' };
    await bewaarFuncties(c);
    return;
  }
  // Helemaal in huis: de spraakassistent maken; de stap kijkt daarna elke drie tellen.
  if (el.hasAttribute('data-inhuis-maak')) {
    el.disabled = true;
    const res = await deur('api/stem-in-huis', { maak: true }).catch(() => null);
    if (res?.ok) d.inHuis = await res.json().catch(() => d.inHuis);
    teken();
    return;
  }
});

document.addEventListener('change', async (e) => {
  if (ligging.verander(e.target, ligStaat)) return teken();
  const el = e.target;
  // De netmeter en de omvormers (testerronde, november 2026).
  const va = antwoorden();
  if (vermogens.verander(el, d.aans, va)) return bewaarAansluiting(va);
  const kamerNu = (next) => next?.kamers.find((x) => x.id === openKamer);
  if (el.dataset.kanBereik) {
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
    return;
  }
  if (el.dataset.naam) {
    const v = el.value.trim();
    const next = concept();
    const k = next?.kamers.find((x) => x.id === el.dataset.naam);
    if (!k || !v || v === k.naam) return;
    k.naam = v;
    el.blur();
    await bewaarIndeling(next, t('indeling.naamBewaard'));
  } else if (el.dataset.etage) {
    const next = concept();
    const k = next?.kamers.find((x) => x.id === el.dataset.etage);
    if (!k) return;
    k.etage = el.value;
    if (el.value === 'buiten') openKamer = null;
    await bewaarIndeling(next, t('indeling.staatOp', { naam: k.naam, etage: el.selectedOptions[0]?.textContent ?? t('inr.andereEtage') }));
  } else if (el.dataset.soort) {
    // Wat voor kamer (besluit 119); leeg is weer het voorstel uit de naam.
    const next = concept();
    const k = next?.kamers.find((x) => x.id === el.dataset.soort);
    if (!k) return;
    if (el.value) k.soort = el.value;
    else delete k.soort;
    await bewaarIndeling(next, t('indeling.soortBewaard'));
  } else if (el.dataset.zonenaam) {
    const next = concept();
    const z = kamerNu(next)?.zones.find((x) => x.id === el.dataset.zonenaam);
    const v = el.value.trim();
    if (!z || !v || z.naam === v) return;
    z.naam = v;
    await bewaarIndeling(next, t('indeling.zoneHeet', { naam: v }));
  } else if (el.dataset.zonesoort) {
    const next = concept();
    const z = kamerNu(next)?.zones.find((x) => x.id === el.dataset.zonesoort);
    if (!z) return;
    if (el.value) z.soort = el.value;
    else delete z.soort;
    await bewaarIndeling(next, t('indeling.zoneBewaard', { naam: z.naam }));
  } else if (el.hasAttribute('data-nieuwezone')) {
    const next = concept();
    const k = kamerNu(next);
    const v = el.value.trim();
    if (!k || !v) return;
    const bezet = new Set(next.kamers.flatMap((x) => x.zones.map((z) => z.id)));
    // De eerste zone: de kamer zelf wordt het eerste deel, zodat er twee zijn.
    if (!k.zones.length) {
      const eigen = { id: idVan(k.naam, bezet), naam: k.naam };
      bezet.add(eigen.id);
      k.zones.push(eigen);
    }
    k.zones.push({ id: idVan(v, bezet), naam: v });
    await bewaarIndeling(next, t('indeling.zoneErbij', { naam: v }));
  } else if (el.dataset.samen) {
    if (!el.value) return;
    const next = concept();
    const doel = next.kamers.find((x) => x.id === el.value)?.naam;
    const fout = samenvoegen(next, el.dataset.samen, el.value);
    if (fout) {
      el.value = '';
      zeg(fout, true);
      return;
    }
    await bewaarIndeling(next, t('inr.zoneVan', { naam: doel, kamer: next.kamers.find((x) => x.id === el.dataset.samen)?.naam ?? '' }));
  } else if (el.dataset.bnaam) {
    const naam = el.value.trim();
    const x = (d.bewoners?.bewoners ?? []).find((y) => y.id === el.dataset.bnaam);
    if (naam && x && naam !== x.naam) await stuurBewoner({ actie: 'naam', id: x.id, naam });
  } else if (el.dataset.bbron !== undefined) {
    await stuurBewoner({ actie: 'aanwezigheid', id: el.dataset.bbron, bron: el.value || null });
  } else if (el.dataset.verplaats) {
    // Een apparaat naar een andere kamer (besluit 166).
    const next = concept();
    const doel = (d.huis?.etages ?? []).flatMap((e) => e.ruimtes ?? []).find((r) => r.id === el.value);
    if (!next || !doel) return;
    next.apparaten[el.dataset.verplaats] = { ...(next.apparaten[el.dataset.verplaats] ?? {}), kamer: doel.id, zone: null };
    openApparaat = null;
    await bewaarIndeling(next, t('inr.staatIn', { naam: doel.naam }));
  } else if (el.dataset.plek) {
    const next = concept();
    if (!next || !el.value) return;
    if (el.value === '-') next.verborgen = [...new Set([...(next.verborgen ?? []), el.dataset.plek])];
    else next.apparaten[el.dataset.plek] = { ...(next.apparaten[el.dataset.plek] ?? {}), kamer: el.value, zone: null };
    await bewaarIndeling(next);
  } else if (el.matches('[data-zk-zelf]')) {
    const a = antwoorden();
    const z = zekering.verander(el, a.zekering);
    if (z === undefined) return;
    a.zekering = z;
    await bewaarAansluiting(a);
  } else if (el.hasAttribute('data-inr-thermostaat')) {
    const a = antwoorden();
    a.verwarming = { ...a.verwarming, thermostaat: el.value || null };
    await bewaarAansluiting(a);
  } else if (el.hasAttribute('data-toevoeg-apparaat') && toevoeg) {
    toevoeg = { ...toevoeg, apparaat: el.value || null };
    teken();
  } else if (el.dataset.toevoegen) {

    const key = el.value;
    if (!key) return;
    const next = concept();
    const k = next?.kamers.find((x) => x.id === el.dataset.toevoegen);
    const r = binnen().find((x) => x.id === el.dataset.toevoegen);
    if (!k || !r) return;
    // Een airco helpt op zon; de eerste verwarming houdt de kamer op temperatuur, een tweede kijkt mee. Met alleen
    // airco's (besluit 342) houdt de eerste airco de kamer.
    const toestel = binnen().flatMap(klimaatIn).find((a) => sleutel(a) === key);
    const rollen = Object.fromEntries(klimaatIn(r).map((a) => [sleutel(a), rolVan(k, r, sleutel(a))]));
    const houdt = Object.values(rollen).includes('houdt');
    const alleenAirco = antwoorden().verwarming?.soort === 'airco';
    const rol = toestel?.klimaat?.kanKoelen ? (alleenAirco && !houdt ? 'houdt' : 'zon') : houdt ? 'kijken' : 'houdt';
    for (const x of next.kamers) if (x.id !== k.id && x.rollen && key in x.rollen) delete x.rollen[key];
    k.rollen = { ...(k.rollen ?? {}), ...rollen, [key]: rol };
    next.apparaten[key] = { ...(next.apparaten[key] ?? {}), kamer: k.id, zone: null };
    toevoegenIn = null;
    await bewaarIndeling(next);
  } else if (el.matches('input[data-kort-n], input[data-kort-kant]')) {
    // Een aantal getypt in de korte stap Daken; 0 of leeg haalt een plek weg.
    const v = el.value.trim();
    const n = v === '' ? 0 : Number(v);
    if (!(Number.isInteger(n) && n >= 0 && n <= 200)) return zeg(t('inr.aantal200'), true);
    el.blur();
    if (el.dataset.kortN) await bewaarKort({ plek: el.dataset.kortN, n });
    else await bewaarKort({ kant: Number(el.dataset.kortKant), n });
  } else if (el.dataset.prijs) {
    const v = el.value.trim().replace(',', '.');
    const n = v === '' ? null : Number(v);
    const max = el.dataset.eenheid === 'm³' ? 5 : 2;
    if (n != null && !(n >= 0 && n < max)) return zeg(el.dataset.eenheid === 'm³' ? t('inr.prijsM3', { voorbeeld: nl(1.35, 2) }) : t('inr.prijsKwh', { voorbeeld: nl(0.25, 2) }), true);
    el.blur();
    await bewaarPrijzen({ [el.dataset.prijs]: n });
  } else if (el.dataset.meedoen) {
    // Meedoen met een andere kamer (besluit 142).
    const next = concept();
    const k = next?.kamers.find((x) => x.id === el.dataset.meedoen);
    if (!k) return;
    delete k.meedoenMet;
    if (el.value) {
      k.meedoenMet = el.value;
      k.regelzone = null;
    }
    await bewaarIndeling(next);
  }
});

// De schuif laat het getal meteen zien; bewaren gebeurt bij loslaten.
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.dataset?.comfort) return;
  const b = el.closest('.schuif')?.querySelector('b');
  if (b) b.textContent = `${nl(Number(el.value))}°`;
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (e.target.matches?.('[data-nieuwnaam]')) document.querySelector(`${app.zicht()} [data-voegtoe]`)?.click();
  else if (e.target.matches?.('[data-naam], [data-bnaam], [data-prijs], [data-kort-n], [data-kort-kant], [data-zonenaam], [data-nieuwezone]')) e.target.blur();
});

addEventListener('standwissel', teken);
addEventListener('hashchange', () => {
  openKamer = null;
  weghalen = null;
  ligStaat.aanpassen = false;
  toevoegenIn = null;
  aanpas = null;
  afwezigKeuze = null;
  if (stapNu() !== 'welkom') lijst = null;
  zeg('');
  teken();
  // Klaarzetten: opnieuw kijken, want de bewoner kan net in Home Assistant iets hebben gedaan.
  if (stapNu() === 'ha' || stapNu() === 'klaar') {
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
/*
 * Je dag: een greep van de balk schuiven, per heel uur.
 * Tijdens het schuiven tekent alleen de balk mee; bij loslaten bewaart hij,
 * en tekent het huis met de lucht van dat uur.
 */
{
  let greep = null;
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest?.('[data-dg-greep]');
    if (!el || stapNu() !== 'dag') return;
    e.preventDefault();
    greep = { naam: el.dataset.dgGreep, dg: dagNu(), bewogen: false };
    dagGreep = greep.naam;
    el.setPointerCapture?.(e.pointerId);
  });
  document.addEventListener('pointermove', (e) => {
    if (!greep) return;
    const vak = document.querySelector(`${app.zicht()} [data-dg-grepen]`);
    if (!vak) return;
    const r = vak.getBoundingClientRect();
    const u = Math.round(((e.clientX - r.left) / r.width) * 24);
    const dg = dagMet(greep.dg, greep.naam, u);
    if (dg[greep.naam] === dagNu()[greep.naam]) return;
    greep.dg = dg;
    greep.bewogen = true;
    dagKeuze = dg;
    // Alleen de balk opnieuw, zodat de greep onder de vinger blijft.
    for (const b of document.querySelectorAll('.dg')) b.innerHTML = dagBalk();
  });
  const los = async () => {
    if (!greep) return;
    const { dg, bewogen } = greep;
    greep = null;
    if (bewogen) await bewaarDag(dg);
    else teken();
  };
  document.addEventListener('pointerup', los);
  document.addEventListener('pointercancel', los);
}

void laad();
