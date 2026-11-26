/*
 * Jij (besluit 181, schets Instellingen-Tel-Jij): alles wat van één bewoner
 * is op één plek. Het thema en je kleur kies je hier; de rest wijst naar waar
 * het al stond: de weergave op Thuis, je comfort bij Comfort, je naam en hoe
 * het huis weet dat je thuis bent bij Bewoners, je gegevens bij Bewoners en
 * toegang. Een scherm of een gast heeft geen profiel.
 *
 * Scherm (stap 4 punt 2): dit scherm, het always-on display, scherm uit en op
 * je startscherm staan hier, elk in een blad (ditscherm.js); eerst stonden ze
 * bij Extra's onder Weergave.
 */
'use strict';

const { $$, esc, haal, deur } = app;

/** De zes kleuren, in de volgorde waarin bewoners er een krijgen (voorkeuren.ts). */
const KLEUREN = ['lucht', 'framboos', 'zeegroen', 'violet', 'koper', 'grafiet'].map((k) => [k, t(`jij.kleur.${k}`)]);
const THEMAS = ['donker', 'licht', 'systeem'].map((x) => [x, t(`jij.thema.${x}`)]);
const IK = {
  kleur: iconen.binnen('kleur'),
  weergave: iconen.binnen('weergave'),
  letters: iconen.binnen('letters'),
  beweging: iconen.binnen('beweging'),
  kaarten: iconen.binnen('kaarten'),
  favorieten: iconen.binnen('favorieten'),
  wand: iconen.binnen('wand'),
  comfort: iconen.binnen('comfort'),
  thuis: iconen.binnen('thuis'),
  naam: iconen.binnen('naam'),
  downloaden: iconen.binnen('downloaden'),
  bel: iconen.binnen('meldingen'),
  taal: iconen.binnen('taal'),
  terug: iconen.binnen('terug'),
  agenda: iconen.binnen('agenda'),
  tel: iconen.binnen('telefoon'),
  scherm: iconen.binnen('wand'),
  aod: iconen.binnen('aod'),
  uit: iconen.binnen('uit'),
  startscherm: iconen.binnen('telefoon'),
};
/** De taal (besluit 185): vanzelf die van je account in Home Assistant, of zelf gekozen. De teksten in kit/teksten.*.js. */
const TALEN = ['auto', 'nl', 'en'];
const ik = (id) => `<span class="ik"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IK[id]}</svg></span>`;

let v = null;
let b = null;
/** De agenda's van Home Assistant om uit te kiezen (besluit 216), of null zonder te doen. */
let agendas = null;

async function laad() {
  const [vk, bw] = await Promise.allSettled([haal('api/voorkeuren'), haal('api/bewoners'), haal('api/te-doen?alleen=agendas').then((x) => (agendas = x?.aan ? x.agendas : null), () => null)]);
  if (vk.status === 'fulfilled') {
    v = vk.value;
    app.zetThema(v);
  }
  if (bw.status === 'fulfilled') b = bw.value;
  await ditScherm.laad();
  ditScherm.zet(v, () => {
    teken();
    tekenBladAls();
  }, (nieuw) => {
    v = nieuw;
  });
  teken();
  // jij.html#aod, #uit, #scherm of #startscherm (oude adressen van Functies): dat blad meteen open.
  openSchermUitAdres();
  // Vanuit Te doen of Functies: jij.html#agenda opent meteen je agenda's.
  if (location.hash === '#agenda' && agendas && b?.ik?.soort === 'bewoner') openBlad('agenda');
  // jij.html#weergave (de zoeker, oude adressen): het blad Weergave meteen open.
  if (location.hash === '#weergave' && v) openBlad('weergave');
}

async function bewaar(wat) {
  try {
    const res = await deur('api/voorkeuren', { plek: 'tel', ...wat });
    if (res?.ok) {
      v = await res.json();
      app.zetThema(v);
      if (wat.weergave) app.zetWeergave(app.persoonlijk(v).weergave ?? v.tel.weergave);
    }
  } catch {
    // De volgende keer.
  }
  teken();
}

/**
 * Scherm (stap 4 punt 2): je wand (always-on en scherm uit, van jou als je
 * bewoner bent) en dit apparaat (dit scherm, op je startscherm), elk een rij
 * die zijn blad opent.
 */
function schermBlok(vanBewoner) {
  if (!v) return '';
  ditScherm.zet(v, undefined, undefined, vanBewoner);
  const rijen = (groep) => ditScherm.delen(groep).map((d) => knop(`data-scherm-open="${d.id}"`, d.id, d.titel, d.zin)).join('');
  return `<section class="glas lijst" aria-labelledby="kop-scherm">
      <h2 id="kop-scherm">${esc(t(vanBewoner ? 'jij.scherm.jouwWand' : 'jij.scherm.kop'))}</h2>
      ${rijen('wand')}
      <p class="uitleg">${esc(t(vanBewoner ? 'jij.scherm.wandUitleg' : 'jij.scherm.wandUitlegScherm'))}</p>
    </section>
    <section class="glas lijst" aria-labelledby="kop-apparaat">
      <h2 id="kop-apparaat">${esc(t('jij.scherm.apparaat'))}</h2>
      ${rijen('apparaat')}
      <p class="uitleg">${esc(t('jij.scherm.apparaatUitleg'))}</p>
    </section>`;
}
function openSchermUitAdres() {
  const h = location.hash.slice(1);
  if (ditScherm.DELEN.includes(h) && v && b?.ik?.soort !== 'gast') openBlad(`scherm:${h}`);
}

const link = (href, icoon, titel, onder, rechts = '') => `<a class="rij" href="${href}">${ik(icoon)}<b>${esc(titel)}</b><small>${esc(onder)}</small><span class="pijl">${rechts}›</span></a>`;
const knop = (data, icoon, titel, onder, rechts = '') => `<button type="button" class="rij" ${data}>${ik(icoon)}<b>${esc(titel)}</b><small>${esc(onder)}</small><span class="pijl">${rechts}›</span></button>`;
const schakel = (sleutel, icoon, titel, onder, aan) => `<div class="rij">${ik(icoon)}<b>${esc(titel)}</b><small>${esc(onder)}</small><span class="pijl"><button type="button" class="schakelaar" role="switch" aria-checked="${aan}" aria-label="${esc(titel)}" data-weergave="${sleutel}"></button></span></div>`;

/** De telefoon waar je meldingen heen gaan: gekozen, of die aan je persoon hangt. */
function mijnTelefoon() {
  const lijst = v?.telefoons ?? [];
  const keus = v?.tel?.meldingen?.telefoon;
  return keus ? (lijst.find((t) => t.id === keus) ?? null) : (lijst.find((t) => t.eigen) ?? null);
}

function teken() {
  // Meldingen op je telefoon (besluit 183): een eigen scherm, jij.html#meldingen.
  const meldingen = location.hash === '#meldingen';
  $$('.jij > .terugje').forEach((a) => {
    a.href = meldingen ? 'jij.html' : 'instellingen.html';
    a.textContent = t(meldingen ? 'jij.terugJij' : 'jij.terugInstellingen');
  });
  if (meldingen && v && b?.ik?.soort === 'bewoner') return tekenMeldingen();
  const mij = b?.ik;
  const wie = mij?.soort === 'bewoner' ? (b.bewoners ?? []).find((x) => x.id === mij.id) : null;
  // Een gast heeft niets dat bewaard wordt; een scherm of een account zonder bewoner alleen hoe de app eruitziet.
  if (!v || mij?.soort === 'gast') {
    const zin = t(mij?.soort === 'gast' ? 'jij.gast' : 'algemeen.laden');
    $$('[data-jij]').forEach((el) => (el.innerHTML = `<section class="glas gast"><h1 class="kop-2">${esc(t('jij.kop'))}</h1><p class="klein geen-marge boven-8">${esc(zin)}</p></section>`));
    return;
  }
  const kleurNaam = KLEUREN.find(([k]) => k === v.tel.kleur)?.[1] ?? KLEUREN[0][1];
  const themaNaam = THEMAS.find(([x]) => x === v.tel.thema)?.[1] ?? THEMAS[0][1];
  const w = v.tel.weergave;
  // Terug naar standaard (besluit 204): het thema, de kleur van je plek en de weergave.
  const std = v.standaard;
  const uiterlijkAnders = std && (v.tel.thema !== std.thema || v.tel.kleur !== std.kleur || Object.keys(std.weergave).some((k) => w[k] !== std.weergave[k]));
  const kaartenAnders = std && JSON.stringify(v.tel.kaarten) !== JSON.stringify(std.kaarten);
  const terug = (data) => `<button type="button" class="rij terugstd" ${data}>${ik('terug')}<b>${esc(t('w.terugNaarStandaard'))}</b><small></small><span class="pijl"></span></button>`;
  const uiterlijk = `
    <section class="glas lijst" aria-labelledby="kop-uiterlijk">
      <h2 id="kop-uiterlijk">${esc(t('jij.uiterlijk'))}</h2>
      ${knop('data-thema-open', 'kleur', t('jij.themaKleur'), `${themaNaam} · ${kleurNaam.toLowerCase()}`, '<span class="staal" aria-hidden="true"></span>')}
      ${knop('data-weergave-open', 'weergave', t('jij.weergave'), t(w.eenvoudig ? 'jij.eenvoudig' : 'jij.uitgebreid'))}
      ${schakel('groteLetters', 'letters', t('jij.letters'), t('jij.lettersZin'), w.groteLetters)}
      ${schakel('minderBeweging', 'beweging', t('jij.beweging'), t('jij.bewegingZin'), w.minderBeweging)}
      ${uiterlijkAnders ? terug('data-std-uiterlijk') : ''}
    </section>`;
  if (!wie) {
    const zin = t(mij?.soort === 'scherm' ? 'jij.scherm' : 'jij.geenProfiel');
    $$('[data-jij]').forEach((el) => (el.innerHTML = `<div class="wie"><div><h1 class="kop-1">${esc(t(mij?.soort === 'scherm' ? 'w.ditScherm' : 'jij.kop'))}</h1><small>${esc(zin)}</small></div></div>${uiterlijk}${schermBlok(false)}`));
    return;
  }
  const hoofd = (b.bewoners ?? []).find((x) => x.hoofd);
  const thuis = wie.thuis == null ? '' : t(wie.thuis ? 'jij.thuisNu' : 'jij.wegNu');
  const soort = wie.comfort === 'eigen' ? t('jij.eigenTemperaturen') : t('w.volgt', { naam: hoofd?.naam ?? t('jij.deHoofdgebruiker') });
  const comfort = wie.geldt ? t('jij.geldtNu', { comfort: soort }) : soort;
  const html = `
    <div class="wie"><span class="rondje" aria-hidden="true">${esc(wie.naam.charAt(0).toUpperCase())}</span><div><h1 class="kop-1">${esc(wie.naam)}</h1><small>${esc(wie.hoofd ? t('w.hoofdgebruiker') : t('jij.plek', { plek: wie.plek }))}${thuis}</small></div></div>
    ${uiterlijk.replace('</section>', `${knop('data-taal-open', 'taal', t('jij.taal.kop'), t(`jij.taal.${v.tel.taal}`))}</section>`)}
    ${schermBlok(true)}
    <section class="glas lijst" aria-labelledby="kop-thuis">
      <h2 id="kop-thuis">${esc(t('jij.thuis'))}</h2>
      ${link('thuis.html#aanpassen', 'kaarten', t('w.kaarten'), t('jij.kaartenZin', { n: v.tel.kaarten.length }))}
      ${link('thuis.html#favorieten', 'favorieten', t('w.favorieten'), t('jij.favorietenZin', { n: v.tel.favorieten.length }))}
      ${kaartenAnders ? terug('data-std-kaarten') : ''}
      <p class="uitleg">${esc(t('jij.wandUitleg'))}</p>
    </section>
    <section class="glas lijst" aria-labelledby="kop-meldingen">
      <h2 id="kop-meldingen">${esc(t('w.meldingen'))}</h2>
      ${link('jij.html#meldingen', 'bel', t('jij.meldingenTel'), mijnTelefoon() ? t('jij.naarTel', { naam: mijnTelefoon().naam }) : t('jij.geenTel'))}
    </section>
    ${agendaBlok()}
    <section class="glas lijst" aria-labelledby="kop-comfort">
      <h2 id="kop-comfort">${esc(t('w.comfort'))}</h2>
      ${link('comfort.html', 'comfort', t('jij.jouwComfort'), comfort.charAt(0).toUpperCase() + comfort.slice(1))}
      ${link('bewoners.html', 'thuis', t('w.thuisVolgens'), wie.aanwezigheidNaam ?? t('jij.nogNietGekozen'))}
    </section>
    <section class="glas lijst" aria-labelledby="kop-over">
      <h2 id="kop-over">${esc(t('jij.overJou'))}</h2>
      ${link('bewoners.html', 'naam', t('jij.jeNaam'), wie.naam)}
      ${link('toegang.html#gegevens', 'downloaden', t('w.jeGegevens'), t('jij.gegevensZin'))}
    </section>`;
  $$('[data-jij]').forEach((el) => (el.innerHTML = html));
  // Staat het blad open, dan alleen de keuze bijwerken: zo blijft de focus waar hij was.
  for (const el of $$('[data-blad] [data-thema]')) el.setAttribute('aria-checked', String(el.dataset.thema === v.tel.thema));
  for (const el of $$('[data-blad] [data-kies-kleur]')) el.setAttribute('aria-checked', String(el.dataset.kiesKleur === v.tel.kleur));
  for (const el of $$('[data-blad] [data-kies-taal]')) el.setAttribute('aria-checked', String(el.dataset.kiesTaal === v.tel.taal));
}

/* -------------------------------------------------- agenda en herinneringen */

/*
 * Agenda (besluit 216, schets Tel-Te-doen#jij; 0.90.1 zonder de rij "Herinneringen
 * naar", die naar dezelfde telefoon wees als Meldingen): je eigen
 * agenda's uit Home Assistant, meer tegelijk, ook de gezinsagenda, of uit; en
 * waar je herinneringen heen gaan. Ben je thuis, dan staan je agenda's ook op
 * de wand (besluit 219); sinds stap 4 punt 2 kun je dat uitzetten.
 */
function agendaKeus() {
  return v?.tel?.agenda ?? { aan: true, ids: [] };
}
function agendaBlok() {
  if (!agendas) return '';
  const k = agendaKeus();
  const namen = agendas.filter((a) => k.ids.includes(a.id)).map((a) => a.naam);
  const zin = !k.aan ? t('w.uit') : namen.length ? namen.join(taal.code === 'en' ? ' and ' : ' en ') : t('jij.agenda.geen');
  return `<section class="glas lijst" aria-labelledby="kop-agenda">
      <h2 id="kop-agenda">${esc(t('w.agenda'))}</h2>
      ${knop('data-agenda-open', 'agenda', t('w.jouwAgendaS'), zin)}
      <p class="uitleg">${esc(t('jij.agenda.uitleg'))}</p>
    </section>`;
}
function agendaBlad() {
  const k = agendaKeus();
  return `
    <div class="bladkop"><h2 class="kop-2" id="bladkop">${esc(t('w.jouwAgendaS'))}</h2><button type="button" class="knop knop-klein knop-licht" data-blad-dicht>${esc(t('algemeen.klaar'))}</button></div>
    <div class="rij rij-zonder"><b>${esc(t('jij.agenda.gebruiken'))}</b><small>${esc(t('jij.agenda.gebruikenZin'))}</small><span class="pijl"><button type="button" class="schakelaar" role="switch" aria-checked="${k.aan}" aria-label="${esc(t('jij.agenda.gebruiken'))}" data-agenda-aan></button></span></div>
    <p class="betekenis">${esc(t('jij.agenda.kies'))}</p>
    <div class="rij rij-zonder${k.aan ? '' : ' uitgezet'}"><b>${esc(t('jij.agenda.opWand'))}</b><small>${esc(t('jij.agenda.opWandZin'))}</small><span class="pijl"><button type="button" class="schakelaar" role="switch" aria-checked="${k.wand !== false}" aria-label="${esc(t('jij.agenda.opWand'))}" data-agenda-wand ${k.aan ? '' : 'disabled'}></button></span></div>
    <div class="agendas${k.aan ? '' : ' uitgezet'}" role="group" aria-labelledby="bladkop">${agendas
      .map((a) => `<button type="button" role="checkbox" aria-checked="${k.ids.includes(a.id)}" data-agenda-id="${esc(a.id)}" ${k.aan ? '' : 'disabled'}><i aria-hidden="true"></i><b>${esc(a.naam)}</b>${a.huis === 'gezin' ? `<span>${esc(t('jij.agenda.ookWand'))}</span>` : a.huis === 'afval' ? `<span class="afval">${esc(t('jij.agenda.afval'))}</span>` : ''}</button>`)
      .join('')}</div>`;
}

/* -------------------------------------------------- meldingen op je telefoon */

/*
 * Meldingen op je telefoon (besluit 183, schets Instellingen-Tel-Meldingen):
 * welke meldingen, welke telefoon, en de nachtrust. Rook en wat de regeling
 * raakt komen altijd, ook 's nachts; batterij of filter en een nieuwe versie
 * overdag. Komt iets vanzelf goed, dan wordt de melding stil vervangen.
 */
let proef = '';
function tekenMeldingen() {
  // De auto (besluit 263) staat aan zolang je niets koos.
  const m = { auto: true, ...v.tel.meldingen };
  const lijst = v.telefoons ?? [];
  const tel = mijnTelefoon();
  const keus = (sleutel, titel, onder, dringend) =>
    `<div class="rij rij-zonder"><b>${esc(titel)}${dringend ? `<span class="dringend">${esc(t('jij.meld.dringend'))}</span>` : ''}</b><small>${esc(onder)}</small><span class="pijl"><button type="button" class="schakelaar" role="switch" aria-checked="${m[sleutel]}" aria-label="${esc(titel)}" data-melding="${sleutel}"></button></span></div>`;
  const eigen = lijst.find((t) => t.eigen);
  const opties = [`<option value="" ${m.telefoon ? '' : 'selected'}>${esc(eigen ? t('jij.meld.vanJou', { naam: eigen.naam }) : t('jij.meld.kiesTel'))}</option>`, ...lijst.filter((t) => !t.eigen).map((t) => `<option value="${esc(t.id)}" ${m.telefoon === t.id ? 'selected' : ''}>${esc(t.naam)}</option>`)].join('');
  const html = `
    <div class="wie"><div><h1 class="kop-1">${esc(t('jij.meldingenTel'))}</h1><small>${esc(t('jij.meld.via'))}</small></div></div>
    <section class="glas lijst" aria-labelledby="kop-altijd">
      <h2 id="kop-altijd">${esc(t('jij.meld.altijd'))}</h2>
      ${keus('rook', t('jij.meld.rook'), t('jij.meld.rookZin'), true)}
      ${keus('regeling', t('jij.meld.regeling'), t('jij.meld.regelingZin'), false)}
      <h2>${esc(t('jij.meld.overdag'))}</h2>
      ${keus('onderhoud', t('jij.meld.onderhoud'), t('jij.meld.onderhoudZin', { tot: m.tot }), false)}
      ${keus('versie', t('jij.meld.versie'), t('jij.meld.versieZin'), false)}
      ${keus('sluip', t('jij.meld.sluip'), t('jij.meld.sluipZin', { tot: m.tot }), false)}
      ${keus('auto', t('w.deAuto'), t('jij.meld.autoZin'), false)}
      <p class="uitleg">${esc(t('jij.meld.weerGoed'))}</p>
    </section>
    ${lijst.length
      ? `<section class="glas lijst" aria-labelledby="kop-waar">
      <h2 id="kop-waar">${esc(t('jij.meld.waar'))}</h2>
      <label class="rij rij-zonder"><b>${esc(t('jij.meld.telefoon'))}</b><small>${esc(t('jij.meld.uitApp'))}</small><span class="pijl"><select class="kiezer" data-melding-telefoon aria-label="${esc(t('jij.meld.telefoon'))}">${opties}</select></span></label>
      <div class="rij rij-zonder stapel"><b>${esc(t('jij.meld.nachtrust'))}</b><small>${esc(t('jij.meld.nachtrustZin'))}</small><span class="pijl tijden"><input type="time" value="${esc(m.van)}" data-melding-tijd="van" aria-label="${esc(t('jij.meld.vanaf'))}"> ${esc(t('jij.meld.tot'))} <input type="time" value="${esc(m.tot)}" data-melding-tijd="tot" aria-label="${esc(t('jij.meld.totLabel'))}"></span></div>
    </section>
    <div class="proefrij"><button type="button" class="knop" data-proef ${tel ? '' : 'disabled'}>${esc(t('jij.meld.proef'))}</button><span class="mini" data-proef-zin aria-live="polite">${esc(proef)}</span></div>`
      : `<section class="glas gast"><h2 class="kop-3">${esc(t('jij.meld.geenTel'))}</h2><p class="klein geen-marge boven-8">${esc(t('jij.meld.geenTelZin'))}</p></section>`}`;
  $$('[data-jij]').forEach((el) => {
    // Een keuzelijst of tijd met de focus niet onder de vinger weghalen.
    if (el.contains(document.activeElement) && document.activeElement.matches('select, input')) return;
    el.innerHTML = html;
  });
}

async function proefmelding(knop) {
  knop.disabled = true;
  proef = t('jij.meld.versturen');
  $$('[data-proef-zin]').forEach((el) => (el.textContent = proef));
  try {
    const res = await deur('api/proefmelding', {});
    const body = await res?.json().catch(() => ({}));
    proef = res?.ok ? t('jij.meld.verstuurd', { naam: body.naam }) : t('jij.meld.lukteNiet', { fout: String(body?.fout ?? t('jij.meld.geenAntwoord')).replace(/\.$/, '') });
  } catch {
    proef = t('jij.meld.lukteNiet', { fout: t('jij.meld.geenVerbinding') });
  }
  teken();
}

document.addEventListener('change', (e) => {
  const el = e.target;
  if (!v) return;
  if (/** @type {HTMLElement} */ (el).closest?.('[data-scherm-deel]') && ditScherm.verander(el)) return;
  if (el.matches('[data-melding-telefoon]')) void bewaar({ meldingen: { telefoon: el.value || null } });
  else if (el.matches('[data-melding-tijd]') && /^\d{2}:\d{2}$/.test(el.value)) void bewaar({ meldingen: { [el.dataset.meldingTijd]: el.value } });
});
addEventListener('hashchange', () => {
  proef = '';
  teken();
  scrollTo(0, 0);
  openSchermUitAdres();
});

/* ------------------------------------------------------------ het blad */

function tekenBlad() {
  const blad = /** @type {HTMLElement} */ (document.querySelector('[data-blad]'));
  // Een deel van Scherm (stap 4 punt 2): de kop met Klaar, en het deel eronder.
  if (blad.dataset.soort?.startsWith('scherm:')) {
    const id = blad.dataset.soort.slice(7);
    ditScherm.zet(v);
    blad.innerHTML = `
    <div class="bladkop"><h2 class="kop-2" id="bladkop">${esc(ditScherm.titel(id))}</h2><button type="button" class="knop knop-klein knop-licht" data-blad-dicht>${esc(t('algemeen.klaar'))}</button></div>
    <div class="ds-blad" data-scherm-deel="${esc(id)}">${ditScherm.vorm(id)}</div>`;
    return;
  }
  if (blad.dataset.soort === 'agenda') {
    blad.innerHTML = agendaBlad();
    return;
  }
  // Weergave: hier, niet eerst naar Thuis. Grotere letters en minder beweging staan al op Jij zelf.
  if (blad.dataset.soort === 'weergave') {
    const volgt = app.persoonlijk(v).volgt;
    const w = (volgt != null ? app.persoonlijk(v).weergave : null) ?? v.tel.weergave;
    blad.innerHTML = weergaveDeel.html(w, { volgt, telStand: app.telStand(), zonderLetters: true });
    return;
  }
  if (blad.dataset.soort === 'taal') {
    blad.innerHTML = `
    <div class="bladkop"><h2 class="kop-2" id="bladkop">${esc(t('jij.taal.kop'))}</h2><button type="button" class="knop knop-klein knop-licht" data-blad-dicht>${esc(t('algemeen.klaar'))}</button></div>
    <div class="drie talen" role="radiogroup" aria-labelledby="bladkop">${TALEN.map((x) => `<button type="button" role="radio" aria-checked="${v.tel.taal === x}" data-kies-taal="${x}"><b>${esc(t(`jij.taal.${x}`))}</b><small>${esc(t(`jij.taal.${x}Uitleg`))}</small></button>`).join('')}</div>
    <p class="betekenis">${esc(t('jij.taal.uitleg'))}</p>`;
    return;
  }
  blad.innerHTML = `
    <div class="bladkop"><h2 class="kop-2" id="bladkop">${esc(t('jij.themaKleur'))}</h2><button type="button" class="knop knop-klein knop-licht" data-blad-dicht>${esc(t('algemeen.klaar'))}</button></div>
    <h3 id="kop-thema">${esc(t('jij.thema'))}</h3>
    <div class="drie" role="radiogroup" aria-labelledby="kop-thema">${THEMAS.map(([x, naam]) => `<button type="button" role="radio" aria-checked="${v.tel.thema === x}" data-thema="${x}"><div class="mini-tel mini-${x}" aria-hidden="true"><i></i><i></i><i></i></div><b>${esc(naam)}</b></button>`).join('')}</div>
    <p class="klein wand-alleen geen-marge boven-8">${esc(t('jij.themaWand'))}</p>
    <h3 id="kop-kleur">${esc(t('jij.jouwKleur'))}</h3>
    <div class="kleuren" role="radiogroup" aria-labelledby="kop-kleur">${KLEUREN.map(([k, naam]) => `<button type="button" role="radio" aria-checked="${v.tel.kleur === k}" data-kies-kleur="${k}"><span data-kleur="${k}" aria-hidden="true"></span>${esc(naam)}</button>`).join('')}</div>
    <p class="betekenis">${esc(t('jij.kleurUitleg')).replace(/\{(blauw|oranje|amber|groen)\}/g, (m, k) => `<i style="background: var(--${{ blauw: 'ijs', oranje: 'gloed', amber: 'zon', groen: 'mint' }[k]})"></i>`)}</p>`;
}

/** Staat het agendablad of een deel van Scherm open, dan opnieuw tekenen na het bewaren. */
function tekenBladAls() {
  const blad = /** @type {HTMLElement} */ (document.querySelector('[data-blad]'));
  if (blad.hidden) return;
  if (blad.dataset.soort === 'agenda' || blad.dataset.soort === 'weergave' || blad.dataset.soort?.startsWith('scherm:')) {
    tekenBlad();
  }
}

let terugFocus = null;
function openBlad(soort = 'thema') {
  terugFocus = document.activeElement;
  document.querySelector('[data-blad]').dataset.soort = soort;
  tekenBlad();
  document.querySelector('[data-achter]').hidden = false;
  const blad = document.querySelector('[data-blad]');
  blad.hidden = false;
  blad.querySelector('[aria-checked="true"]')?.focus();
}
function sluitBlad() {
  document.querySelector('[data-achter]').hidden = true;
  document.querySelector('[data-blad]').hidden = true;
  terugFocus?.focus?.();
}

// Scherm (stap 4 punt 2): een rij opent zijn blad; wat er in het blad getikt wordt, doet ditscherm.js.
document.addEventListener('click', (e) => {
  const doel = /** @type {HTMLElement} */ (e.target);
  const open = /** @type {HTMLElement | null} */ (doel.closest('[data-scherm-open]'));
  if (open && v) return openBlad(`scherm:${open.dataset.schermOpen}`);
  const knop = doel.closest('[data-scherm-deel] button');
  if (knop && v) ditScherm.klik(knop);
});
document.addEventListener('input', (e) => ditScherm.invoer(e.target));

// Een keuze in het blad Weergave (src/weergave.js): meteen zo laten zien, en bewaren bij je account.
document.addEventListener('click', (e) => {
  const blad = /** @type {HTMLElement} */ (document.querySelector('[data-blad]'));
  if (!v || blad.hidden || blad.dataset.soort !== 'weergave' || app.persoonlijk(v).volgt != null) return;
  const nieuw = weergaveDeel.nieuw(v.tel.weergave, /** @type {HTMLElement} */ (e.target));
  if (!nieuw) return;
  const focus = weergaveDeel.focusVan(/** @type {HTMLElement} */ (e.target));
  app.zetWeergave(nieuw);
  void bewaar({ weergave: nieuw }).then(() => {
    tekenBladAls();
    if (focus) blad.querySelector(focus)?.focus();
  });
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-thema-open], [data-weergave-open], [data-taal-open], [data-agenda-open], [data-agenda-aan], [data-agenda-wand], [data-agenda-id], [data-blad-dicht], [data-achter], [data-thema], [data-kies-kleur], [data-kies-taal], [data-weergave], [data-melding], [data-proef], [data-std-uiterlijk], [data-std-kaarten]');
  if (!el || !v) return;
  // Je agenda's (besluit 216): aan of uit, en welke, meer tegelijk.
  if (el.matches('[data-agenda-open]')) return openBlad('agenda');
  if (el.matches('[data-agenda-aan]')) return void bewaar({ agenda: { ...agendaKeus(), aan: !agendaKeus().aan } }).then(tekenBladAls);
  // Ook op de wand als je thuis bent (besluit 219; een keuze sinds stap 4 punt 2).
  if (el.matches('[data-agenda-wand]')) return void bewaar({ agenda: { ...agendaKeus(), wand: agendaKeus().wand === false } }).then(tekenBladAls);
  if (el.matches('[data-agenda-id]')) {
    const k = agendaKeus();
    const id = el.dataset.agendaId;
    return void bewaar({ agenda: { ...k, ids: k.ids.includes(id) ? k.ids.filter((x) => x !== id) : [...k.ids, id] } }).then(tekenBladAls);
  }
  // Terug naar standaard (besluit 204): het uiterlijk, of de kaarten op Thuis.
  if (el.matches('[data-std-uiterlijk]')) return void bewaar({ thema: v.standaard.thema, kleur: v.standaard.kleur, weergave: { ...v.standaard.weergave } });
  if (el.matches('[data-std-kaarten]')) return void bewaar({ kaarten: [...v.standaard.kaarten], breed: [...v.standaard.breed] });
  if (el.matches('[data-melding]')) return void bewaar({ meldingen: { [el.dataset.melding]: el.getAttribute('aria-checked') !== 'true' } });
  if (el.matches('[data-proef]')) return void proefmelding(el);
  if (el.matches('[data-thema-open]')) openBlad();
  else if (el.matches('[data-weergave-open]')) openBlad('weergave');
  else if (el.matches('[data-taal-open]')) openBlad('taal');
  else if (el.matches('[data-blad-dicht], [data-achter]')) sluitBlad();
  else if (el.matches('[data-thema]')) void bewaar({ thema: el.dataset.thema });
  else if (el.matches('[data-kies-kleur]')) void bewaar({ kleur: el.dataset.kiesKleur });
  // Een andere taal laadt de pagina opnieuw (taal.js); het blad gaat dan vanzelf dicht.
  else if (el.matches('[data-kies-taal]')) void bewaar({ taal: el.dataset.kiesTaal });
  else if (el.matches('[data-weergave]')) void bewaar({ weergave: { [el.dataset.weergave]: el.getAttribute('aria-checked') !== 'true' } });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.querySelector('[data-blad]').hidden) sluitBlad();
});
// Wisselt het thema met de telefoon mee, dan tekent het blad de tinten opnieuw.
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => teken());

// Chrome biedt het installeren aan, of het is gebeurd: Op je startscherm opnieuw tekenen.
addEventListener('sc-installeer', () => {
  teken();
  tekenBladAls();
});

app.start('instellingen');
void laad();
