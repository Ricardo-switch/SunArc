/*
 * Bewoners (besluit 147, schets Wand-Bewoners). Wie hier woont, op volgorde:
 * de eerste die thuis is, bepaalt het comfort; de hoofdgebruiker staat
 * bovenaan. Je eigen naam, wat je thuis volgt en je comfort zet je zelf; de
 * hoofdgebruiker en een beheerder kunnen dat ook voor een ander, en zetten de
 * volgorde. Alles gaat meteen naar de dienst, nooit naar Home Assistant.
 */
'use strict';

const { $$, esc, haal } = app;

let data = null;
let zon = null;
/** De volgorde tijdens het slepen, voordat hij bewaard is. */
let sleepVolgorde = null;
/** Iemand toevoegen (besluit 351): met inloggen, of alleen een tracker. */
const TOEVOEGEN = 'toevoegen';
let toevoegWeg = 'inloggen';

const KLEUREN = ['#6fd3ff', '#f7b548', '#6ee7b7', '#8f86ff', '#ff7a4d', '#e7a6ff'];
const kleur = (i) => KLEUREN[i % KLEUREN.length];
const tijd = (ms) => taal.klok(ms);
const dag = (ms) => taal.datum(ms, { day: 'numeric', month: 'long' });

/** Bewoners en gasten samen, om er een te kiezen. */
const iedereen = () => [...(data?.bewoners ?? []), ...(data?.gasten ?? [])];
/** Een scherm (besluit 149) kies je met `#scherm:<account>`. */
const SCHERM = 'scherm:';
function gekozenScherm() {
  const id = decodeURIComponent(location.hash.slice(1));
  return id.startsWith(SCHERM) ? (data?.schermen ?? []).find((s) => s.id === id.slice(SCHERM.length)) ?? null : null;
}
const kiestToevoegen = () => decodeURIComponent(location.hash.slice(1)) === TOEVOEGEN;
function gekozen() {
  const id = decodeURIComponent(location.hash.slice(1));
  return iedereen().find((b) => b.id === id) ?? iedereen().find((b) => b.ik) ?? data?.bewoners[0] ?? data?.gasten?.[0] ?? null;
}
const mag = (b) => data?.ik.magBeheren || b?.ik;

async function stuur(body) {
  const res = await fetch('api/bewoners', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const uit = await res.json().catch(() => ({}));
  if (!res.ok) {
    zeg(uit.fout ?? t('w.datLukteNiet'));
    return false;
  }
  data = uit;
  zeg('');
  teken();
  return true;
}
function zeg(tekst) {
  $$('[data-fout]').forEach((el) => (el.textContent = tekst));
}

/* ------------------------------------------------------------ tekenen */

function lijst() {
  const volgorde = sleepVolgorde ?? data.bewoners.map((b) => b.id);
  const nu = gekozenScherm() || kiestToevoegen() ? null : gekozen();
  const rijen = volgorde.map((id, i) => {
    const b = data.bewoners.find((x) => x.id === id);
    const onder = [b.hoofd ? t('w.hoofdgebruiker') : null, b.hoofd || b.comfort === 'eigen' ? t('w.eigenComfort') : t('w.volgt', { naam: data.bewoners[0]?.naam ?? '' })].filter(Boolean).join(' · ');
    const thuis = b.thuis == null ? '' : b.thuis ? `<span class="label thuis">${esc(t('w.thuis'))}</span>` : `<span class="label weg">${esc(b.thuisSindsMs ? t('w.wegSinds', { klok: tijd(b.thuisSindsMs) }) : t('w.weg'))}</span>`;
    return `<div class="bewoner${b.id === nu?.id ? ' gekozen' : ''}" role="button" tabindex="0" data-kies="${esc(b.id)}" data-rij="${esc(b.id)}">
      <span class="greep" ${data.ik.magBeheren ? `data-greep="${esc(b.id)}" aria-label="${esc(t('bewoners.verplaatsen', { naam: b.naam }))}" tabindex="0"` : 'aria-hidden="true" style="visibility: hidden"'}>⋮⋮</span>
      <span class="plek${i === 0 ? ' een' : ''}">${i + 1}</span>
      <span class="gezicht" style="background: ${kleur(data.bewoners.indexOf(b))}">${esc(b.naam.charAt(0).toUpperCase())}</span>
      <span><b>${esc(b.naam)}${b.ik ? ` <span class="mini" style="font-weight: 600">${esc(t('bewoners.jij'))}</span>` : ''}</b><span class="onder">${esc(onder)}</span></span>
      <span class="labels">${thuis}${b.geldt ? `<span class="label geldt">${esc(t('bewoners.geldtNu'))}</span>` : ''}</span>
    </div>`;
  });
  const g = data.geldt;
  const hoofd = data.bewoners[0];
  let uitleg = '';
  if (g) {
    const waarom = g.waarom === 'gekozen'
      ? t('bewoners.waarom.gekozen')
      : g.waarom === 'niemand'
        ? t('bewoners.waarom.niemand')
        : g.id === hoofd?.id
          ? t('bewoners.waarom.thuis', { naam: g.naam })
          : t('bewoners.waarom.daarna', { hoofd: hoofd?.naam ?? t('bewoners.deHoofdgebruiker'), naam: g.naam });
    uitleg = `<p class="uitleg"><b>${esc(t('bewoners.nuGeldt', { naam: g.naam }))}</b> ${esc(waarom)} ${esc(t('bewoners.wisselen'))}</p>`;
  } else if (data.bewoners.length) {
    uitleg = `<p class="uitleg">${esc(t('bewoners.wisselt'))}</p>`;
  }
  return `${rijen.length ? rijen.join('') + uitleg : `<p class="klein geen-marge">${esc(t('bewoners.nogNiemand'))}</p>`}${gastenEnSchermen()}`;
}

/*
 * Gasten en schermen in dezelfde lijst (besluit 351): eerst de gasten, ook wie
 * alleen een tracker heeft, dan de schermen, en onderaan Iemand toevoegen.
 */
function gastenEnSchermen() {
  const nu = gekozenScherm() || kiestToevoegen() ? null : gekozen();
  const sc = gekozenScherm();
  const thuis = (g) => (g.thuis == null ? '' : g.thuis ? `<span class="label thuis">${esc(t('w.thuis'))}</span>` : `<span class="label weg">${esc(g.thuisSindsMs ? t('w.wegSinds', { klok: tijd(g.thuisSindsMs) }) : t('w.weg'))}</span>`);
  const gasten = (data.gasten ?? []).map((g) => `<div class="bewoner los${g.id === nu?.id ? ' gekozen' : ''}" role="button" tabindex="0" data-kies="${esc(g.id)}">
      <span class="gezicht" style="background: #9aa8b6">${esc(g.naam.charAt(0).toUpperCase())}</span>
      <span><b>${esc(g.naam)}${g.ik ? ` <span class="mini" style="font-weight: 600">${esc(t('bewoners.jij'))}</span>` : ''}</b><span class="onder">${esc(t(g.account ? 'bewoners.gastAccount' : 'bewoners.gastTracker'))}</span></span>
      <span class="labels">${thuis(g)}</span>
    </div>`);
  const schermen = (data.schermen ?? []).map((s) => `<div class="bewoner los${sc?.id === s.id ? ' gekozen' : ''}" role="button" tabindex="0" data-kies="${esc(SCHERM + s.id)}">
      <span class="gezicht" style="background: #5b6b80">${esc(s.naam.charAt(0).toUpperCase())}</span>
      <span><b>${esc(s.naam)}${s.ik ? esc(t('bewoners.ditScherm')) : ''}</b><span class="onder">${esc(t('bewoners.schermBegroet'))}</span></span>
      <span class="labels"></span>
    </div>`);
  const groep = (kop, rijen) => (rijen.length ? `<h3 class="groepje">${esc(t(kop))}</h3>${rijen.join('')}` : '');
  const toevoegen = data.ik.soort === 'gast' ? '' : `<button type="button" class="knop knop-licht toevoegknop" aria-pressed="${kiestToevoegen()}" data-kies="${TOEVOEGEN}">${esc(t('bewoners.toevoegen'))}</button>`;
  return `${groep('bewoners.gasten', gasten)}${groep('bewoners.schermen', schermen)}${toevoegen}`;
}

/** Een scherm zoals de wand (besluit 149): een andere naam, of weghalen. */
function schermBlad(s) {
  const kan = data.ik.magBeheren || s.ik;
  const uit = kan ? '' : 'disabled';
  return `<div class="kop"><span class="gezicht" style="background: #5b6b80">${esc(s.naam.charAt(0).toUpperCase())}</span><div><h2 class="kop-2 geen-marge">${esc(s.naam)}</h2><span class="mini">${esc(t('bewoners.schermSinds', { datum: dag(s.sindsMs) }))}</span></div></div>
    <div class="vak"><label for="scherm-naam">${esc(t('bewoners.schermNaam'))}</label><input class="invoer" id="scherm-naam" data-schermnaam value="${esc(s.naam)}" maxlength="40" ${uit}><span class="hint">${esc(t('bewoners.inHA', { naam: s.haNaam }))}</span></div>
    <div class="vak"><span>${esc(t('bewoners.watHetDoet'))}</span><span class="hint">${esc(t('bewoners.geenBewoner'))}</span></div>
    <div class="vak"><span>${esc(t('bewoners.hoeWerkt'))}</span><div class="keuze" role="group" aria-label="${esc(t('w.volledigScherm'))}"><button type="button" data-sopt="volledig" data-waarde="ja" aria-pressed="${s.opties?.volledig === true}" ${uit}>${esc(t('w.volledigScherm'))}</button><button type="button" data-sopt="volledig" data-waarde="nee" aria-pressed="${s.opties?.volledig !== true}" ${uit}>${esc(t('bewoners.metBalken'))}</button></div><div class="keuze" role="group" aria-label="${esc(t('bewoners.luisterenLabel'))}"><button type="button" data-sopt="luisteren" data-waarde="ja" aria-pressed="${s.opties?.luisteren === true}" ${uit}>${esc(t('bewoners.luistert'))}</button><button type="button" data-sopt="luisteren" data-waarde="nee" aria-pressed="${s.opties?.luisteren !== true}" ${uit}>${esc(t('bewoners.luistertNiet'))}</button></div><span class="hint">${esc(t('bewoners.neemtOver'))}</span></div>
    <span class="fout" data-fout></span>
    ${kan ? `<div class="knoppenrij"><button type="button" class="knop gevaar" data-schermweg>${esc(t('w.weghalen'))}</button></div><span class="hint">${esc(t(s.ik ? 'bewoners.vraagtOpnieuw.dit' : 'bewoners.vraagtOpnieuw.het'))}</span>` : `<span class="hint">${esc(t('bewoners.schermBeheer'))}</span>`}`;
}

/**
 * Iemand toevoegen (besluit 351): met inloggen (de QR-code), of alleen een
 * tracker. Dat laatste alleen de hoofdgebruiker; zonder account is iemand
 * altijd gast.
 */
function toevoegBlad() {
  const kanTracker = data.ik.hoofd;
  const weg = kanTracker ? toevoegWeg : 'inloggen';
  const keuze = kanTracker
    ? `<div class="keuze" role="group" aria-label="${esc(t('bewoners.toevoegen'))}"><button type="button" data-toevoegweg="inloggen" aria-pressed="${weg === 'inloggen'}">${esc(t('bewoners.metInloggen'))}</button><button type="button" data-toevoegweg="tracker" aria-pressed="${weg === 'tracker'}">${esc(t('bewoners.alleenTracker'))}</button></div>`
    : '';
  const kop = `<h2 class="kop-2 geen-marge">${esc(t('bewoners.toevoegen'))}</h2>${keuze}`;
  if (weg === 'inloggen') return `${kop}${erbij()}`;
  const bronnen = data.trackers ?? [];
  if (!bronnen.length) return `${kop}<p class="klein geen-marge">${esc(t('bewoners.geenTrackers'))}</p>`;
  const opties = bronnen.map((x) => `<option value="${esc(x.id)}">${esc(x.naam)}${x.thuis == null ? '' : ` · ${esc(t(x.thuis ? 'w.thuis' : 'w.weg'))}`}</option>`).join('');
  return `${kop}
    <p class="klein geen-marge">${esc(t('bewoners.trackerZin'))}</p>
    <div class="vak"><label for="tracker-bron">${esc(t('bewoners.welkeTracker'))}</label><select class="invoer" id="tracker-bron" data-tracker-bron><option value="">${esc(t('bewoners.kiesTracker'))}</option>${opties}</select></div>
    <div class="vak"><label for="tracker-naam">${esc(t('ht.kamer.naam'))}</label><input class="invoer" id="tracker-naam" data-tracker-naam maxlength="40" autocomplete="off"></div>
    <span class="hint">${esc(t('bewoners.trackerHint'))}</span>
    <span class="fout" data-fout></span>
    <div class="knoppenrij"><button type="button" class="knop knop-licht" data-tracker-erbij>${esc(t('w.toevoegen'))}</button></div>`;
}

/** Een voorstel voor de naam uit de naam in Home Assistant: "Noor aanwezig (wifi)" wordt "Noor". */
const naamUit = (naam) => (naam ?? '').replace(/\(.*?\)/g, ' ').trim().split(/\s+/)[0] ?? '';
/** Het veld dat te zien is: de wand en de telefoon hebben elk hun eigen blad. */
const zichtbaar = (sel) => [...document.querySelectorAll(sel)].find((x) => x.offsetParent != null) ?? null;

function blad() {
  if (kiestToevoegen()) return toevoegBlad();
  const sc = gekozenScherm();
  if (sc) return schermBlad(sc);
  const b = gekozen();
  if (!b) return `<p class="klein geen-marge">${esc(t('bewoners.kies'))}</p>`;
  const kan = mag(b);
  const hoofd = data.bewoners[0];
  const wie = b.ik ? 'ik' : 'ander';
  /*
   * Thuis volgens: hangt de persoon in Home Assistant aan dit account, dan valt
   * er niets te kiezen. Anders een lijst, met bij elke bron wat het is; een
   * persoon van een ander account en een bron van een ander staan er niet bij.
   */
  const thuisVak = (magKiezen, zonder) => {
    if (b.gekoppeld) {
      return `<div class="vak"><span>${esc(t('w.thuisVolgens'))}</span><div class="invoer vast">${esc(t('bewoners.inHANaam', { naam: b.aanwezigheidNaam ?? '' }))}</div><span class="hint">${esc(t(`bewoners.gekoppeld.${wie}`))} ${esc(thuisHint)}</span></div>`;
    }
    const opties = b.kiesbaar.map((x) => `<option value="${esc(x.id)}" ${x.id === b.aanwezigheid ? 'selected' : ''}>${esc(x.naam)} · ${esc(t(x.soort === 'persoon' ? 'bewoners.persoon' : 'bewoners.sensor'))}</option>`).join('');
    return `<div class="vak"><label for="bron-${esc(b.id)}">${esc(t(`bewoners.welkeSensor.${wie}`, { naam: b.naam }))}</label><select class="invoer" id="bron-${esc(b.id)}" data-bron ${magKiezen ? '' : 'disabled'}><option value="">${esc(t('bewoners.geenSensor'))}</option>${opties}</select><span class="hint">${esc(b.aanwezigheid ? thuisHint : zonder)}</span></div>`;
  };
  const sinds = b.thuisSindsMs ? tijd(b.thuisSindsMs) : null;
  const thuisHint = b.aanwezigheid
    ? b.thuis == null ? t('bewoners.weetNiet') : b.thuis ? (sinds ? t('bewoners.thuisSinds', { klok: sinds }) : t('bewoners.thuisZin')) : sinds ? t('bewoners.wegSindsZin', { klok: sinds }) : t('bewoners.wegZin')
    : t('bewoners.zonder');
  // Bewoner of gast (besluit 147): alleen de hoofdgebruiker zelf kiest (besluit 151), en de hoofdgebruiker is geen gast.
  const soort = data.ik.hoofd && !b.hoofd
    ? `<div class="vak"><span>${esc(t('bewoners.woontOfGast'))}</span><div class="keuze" role="group" aria-label="${esc(t('bewoners.woontLabel', { naam: b.naam }))}">
        <button type="button" data-gast="nee" aria-pressed="${!b.gast}">${esc(t('bewoners.bewoner'))}</button>
        <button type="button" data-gast="ja" aria-pressed="${b.gast}">${esc(t('bewoners.gast'))}</button>
      </div><span class="hint">${esc(t(b.gast ? 'bewoners.gastZin' : 'bewoners.bewonerZin'))}</span></div>`
    : '';
  if (b.gast) {
    // Een ingelogde gast die dezelfde is als een gast met alleen een tracker (besluit 351): samen één gast.
    const losse = (data.gasten ?? []).filter((g) => !g.account);
    const samen = data.ik.hoofd && b.account && losse.length
      ? `<div class="vak"><label for="samen-${esc(b.id)}">${esc(t('bewoners.zelfde'))}</label><div class="samenrij"><select class="invoer" id="samen-${esc(b.id)}" data-samen-met><option value="">${esc(t('ht.nee'))}</option>${losse.map((g) => `<option value="${esc(g.id)}">${esc(g.naam)}</option>`).join('')}</select><button type="button" class="knop" data-samen>${esc(t('bewoners.samenvoegen'))}</button></div><span class="hint">${esc(t('bewoners.samenHint'))}</span></div>`
      : '';
    const naamVak = `<div class="vak"><label for="naam-${esc(b.id)}">${esc(t('bewoners.noemt.ander', { naam: b.naam }))}</label><input class="invoer" id="naam-${esc(b.id)}" data-naam value="${esc(b.naam)}" maxlength="40" ${data.ik.magBeheren ? '' : 'disabled'}>${b.account ? `<span class="hint">${esc(t('bewoners.inHA', { naam: b.haNaam }))}</span>` : ''}</div>`;
    const zonderAccount = `<div class="vak"><span>${esc(t('bewoners.woontOfGast'))}</span><div class="invoer vast">${esc(t('bewoners.gast'))}</div><span class="hint">${esc(t('bewoners.geenAccount'))}</span></div>`;
    return `<div class="kop"><span class="gezicht" style="background: #9aa8b6">${esc(b.naam.charAt(0).toUpperCase())}</span><div><h2 class="kop-2 geen-marge">${esc(b.naam)}</h2><span class="mini">${esc(t(b.account ? 'bewoners.gastSinds' : 'bewoners.trackerSinds', { datum: dag(b.sindsMs) }))}</span></div></div>
      ${naamVak}
      ${thuisVak(data.ik.magBeheren, t('bewoners.gastZonder'))}
      ${b.account ? soort : zonderAccount}
      ${samen}
      <span class="fout" data-fout></span>
      ${data.ik.magBeheren ? `<div class="knoppenrij"><button type="button" class="knop gevaar" data-weg>${esc(t('w.weghalen'))}</button></div>` : ''}`;
  }
  const comfort = b.hoofd
    ? `<div class="keuze"><button type="button" aria-pressed="true" disabled>${esc(t('bewoners.eigen'))}</button></div><span class="hint">${esc(t('bewoners.hoofdComfort'))} <a href="comfort.html">${esc(t('bewoners.bekijk'))}</a></span>`
    : `<div class="keuze" role="group" aria-label="${esc(t('w.comfortVan', { naam: b.naam }))}">
        <button type="button" data-comfort="eigen" aria-pressed="${b.comfort === 'eigen'}" ${kan ? '' : 'disabled'}>${esc(t('bewoners.eigen'))}</button>
        <button type="button" data-comfort="volgt" aria-pressed="${b.comfort === 'volgt'}" ${kan ? '' : 'disabled'}>${esc(t('w.volgt2', { naam: hoofd?.naam ?? t('w.hoofdgebruiker2') }))}</button>
      </div><span class="hint">${esc(b.comfort === 'eigen' ? t('bewoners.eenEigen') : t('bewoners.hetzelfde', { naam: hoofd?.naam ?? t('bewoners.deHoofdgebruiker').toLowerCase() }))} <a href="comfort.html?bewoner=${encodeURIComponent(b.id)}">${esc(t(`bewoners.bekijkComfort.${wie}`))}</a></span>`;
  const knoppen = [
    data.ik.magBeheren && !b.hoofd ? `<button type="button" class="knop" data-hoofd>${esc(t('bewoners.maakHoofd'))}</button>` : '',
    kan && (!b.hoofd || data.bewoners.length === 1) ? `<button type="button" class="knop gevaar" data-weg>${esc(t('w.weghalen'))}</button>` : '',
  ].join('');
  return `<div class="kop"><span class="gezicht" style="background: ${kleur(data.bewoners.indexOf(b))}">${esc(b.naam.charAt(0).toUpperCase())}</span><div><h2 class="kop-2 geen-marge">${esc(b.naam)}</h2><span class="mini">${esc(t('bewoners.ingelogdSinds', { datum: dag(b.sindsMs) }))}</span></div></div>
    <div class="vak"><label for="naam-${esc(b.id)}">${esc(t(`bewoners.noemt.${wie}`, { naam: b.naam }))}</label><input class="invoer" id="naam-${esc(b.id)}" data-naam value="${esc(b.naam)}" maxlength="40" ${kan ? '' : 'disabled'}><span class="hint">${esc(t('bewoners.inHA', { naam: b.haNaam }))}</span></div>
    ${thuisVak(kan, thuisHint)}
    <div class="vak"><span>${esc(t('w.comfort'))}</span>${comfort}</div>
    ${soort}
    <span class="fout" data-fout></span>
    ${knoppen ? `<div class="knoppenrij">${knoppen}</div>` : ''}`;
}

/*
 * Waar iemand die erbij komt SunArc opent. In Home Assistant (de add-on)
 * is dat het paneel in Home Assistant zelf, met de inlog van Home Assistant: het
 * adres van de app binnen Home Assistant werkt alleen voor wie daar al is
 *. Anders de inlogpagina van de app.
 */
function adresVoorErbij() {
  if (app.inHA()) {
    try {
      return `${window.top.location.origin}${window.top.location.pathname}`;
    } catch {
      // Een andere herkomst: dan de pagina zelf.
    }
  }
  return `${location.origin}${location.pathname.replace(/[^/]*$/, '')}inloggen.html`;
}

function erbij() {
  const adres = adresVoorErbij();
  let qr;
  try {
    const q = window.qrcode(0, 'M');
    q.addData(adres);
    q.make();
    qr = q.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
  } catch {
    qr = '';
  }
  const zinnen = [t(app.inHA() ? 'bewoners.erbijHA' : 'bewoners.erbijApp'), data.bewoners.length ? t('bewoners.alsBewonerVan', { naam: data.bewoners[0].naam }) : t('bewoners.alsBewoner'), t('bewoners.alsGast')].join(' ');
  return `<div class="erbij"><div class="qr" role="img" aria-label="${esc(t('bewoners.qr'))}">${qr}</div><span class="klein">${esc(zinnen)} <a href="${esc(adres)}">${esc(adres.replace(/^https?:\/\//, ''))}</a></span></div>`;
}

function tekenNu() {
  app.schaal();
  app.luchtVan(zon, 0);
  if (!data) return;
  // Niet onder de vinger opnieuw opbouwen terwijl iemand een naam typt.
  const actief = document.activeElement;
  if (actief?.matches?.('[data-naam], [data-schermnaam], [data-tracker-naam]')) return;
  // Elk deel apart: lukt er een niet, dan staan de andere er wel, en zegt dat deel wat er misging.
  const deel = (sel, maak) => {
    let html;
    try {
      html = maak();
    } catch (fout) {
      html = `<p class="klein geen-marge" style="color: var(--gloed-t)">${esc(t('bewoners.deelMis', { fout: String(fout?.message ?? fout) }))}</p>`;
    }
    $$(sel).forEach((el) => (el.innerHTML = html));
  };
  deel('[data-lijst]', lijst);
  deel('[data-blad]', blad);
}
const teken = app.gebundeld(tekenNu);
addEventListener('standwissel', teken);
addEventListener('hashchange', teken);

/* ------------------------------------------------------------ wat je doet */

document.addEventListener('click', async (e) => {
  const el = e.target.closest('button, [data-kies]');
  if (!el || !data) return;
  if (el.closest('[data-greep]')) return;
  const b = gekozen();
  const sc = gekozenScherm();
  if (el.dataset.sopt && sc) {
    await stuur({ actie: 'schermOpties', id: sc.id, opties: { [el.dataset.sopt]: el.dataset.waarde === 'ja' } });
    return;
  }
  if (el.dataset.toevoegweg) {
    toevoegWeg = el.dataset.toevoegweg;
    teken();
  } else if (el.hasAttribute('data-tracker-erbij')) {
    // Een gast met alleen een tracker (besluit 351).
    const bron = zichtbaar('[data-tracker-bron]')?.value ?? '';
    const naam = zichtbaar('[data-tracker-naam]')?.value.trim() ?? '';
    if (!bron) return zeg(t('bewoners.kiesEerst'));
    if (!naam) return zeg(t('bewoners.geefNaam'));
    const voor = new Set((data.gasten ?? []).map((g) => g.id));
    if (await stuur({ actie: 'tracker', bron, naam })) {
      const nieuw = (data.gasten ?? []).find((g) => !voor.has(g.id));
      location.hash = nieuw ? encodeURIComponent(nieuw.id) : '';
    }
  } else if (el.hasAttribute('data-samen') && b) {
    const met = zichtbaar('[data-samen-met]')?.value;
    if (!met) return;
    const naar = (data.gasten ?? []).find((g) => g.id === met);
    if (!confirm(t('bewoners.samenVraag', { naam: b.naam, met: naar?.naam ?? '' }))) return;
    if (await stuur({ actie: 'samen', id: b.id, met })) location.hash = encodeURIComponent(met);
  } else if (el.dataset.kies) {
    location.hash = encodeURIComponent(el.dataset.kies);
    // Op de telefoon staat het blad onder de lijst: daarheen, anders lijkt er niets te gebeuren.
    if (document.documentElement.classList.contains('tel-stand')) requestAnimationFrame(() => document.querySelector('#tel [data-blad]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  } else if (el.hasAttribute('data-schermweg') && sc) {
    if (!confirm(t('bewoners.schermWeg', { naam: sc.naam }))) return;
    if (await stuur({ actie: 'schermWeg', id: sc.id })) location.hash = '';
  } else if (el.dataset.gast && b) {
    await stuur({ actie: 'gast', id: b.id, gast: el.dataset.gast === 'ja' });
  } else if (el.dataset.comfort && b) {
    await stuur({ actie: 'comfort', id: b.id, comfort: el.dataset.comfort });
  } else if (el.hasAttribute('data-hoofd') && b) {
    await stuur({ actie: 'hoofd', id: b.id });
  } else if (el.hasAttribute('data-weg') && b) {
    if (!confirm(t(b.ik ? 'bewoners.weg.ik' : 'bewoners.weg.ander', { naam: b.naam }))) return;
    if (await stuur({ actie: 'weg', id: b.id })) location.hash = '';
  }
});
document.addEventListener('keydown', (e) => {
  const rij = e.target.closest?.('[data-kies]');
  if (rij && (e.key === 'Enter' || e.key === ' ') && !e.target.closest('[data-greep]')) {
    e.preventDefault();
    location.hash = encodeURIComponent(rij.dataset.kies);
  }
  // Het greepje met de pijltjes: een plek omhoog of omlaag.
  const greep = e.target.closest?.('[data-greep]');
  if (greep && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    const v = data.bewoners.map((x) => x.id);
    const i = v.indexOf(greep.dataset.greep);
    const j = i + (e.key === 'ArrowUp' ? -1 : 1);
    if (j < 0 || j >= v.length) return;
    [v[i], v[j]] = [v[j], v[i]];
    void stuur({ actie: 'volgorde', volgorde: v });
  }
});
document.addEventListener('change', async (e) => {
  const el = e.target;
  const sc = gekozenScherm();
  if (sc && el.matches('[data-schermnaam]')) {
    const naam = el.value.trim();
    el.blur();
    if (naam && naam !== sc.naam) await stuur({ actie: 'schermNaam', id: sc.id, naam });
    return;
  }
  if (el.matches('[data-tracker-bron]')) {
    // Een voorstel voor de naam, zolang er nog niets staat.
    const naamVeld = el.closest('[data-blad]')?.querySelector('[data-tracker-naam]');
    const x = (data.trackers ?? []).find((y) => y.id === el.value);
    if (naamVeld && !naamVeld.value.trim() && x) naamVeld.value = naamUit(x.naam);
    return;
  }
  const b = gekozen();
  if (!b) return;
  if (el.matches('[data-naam]')) {
    const naam = el.value.trim();
    el.blur();
    if (naam && naam !== b.naam) await stuur({ actie: 'naam', id: b.id, naam });
  } else if (el.matches('[data-bron]')) {
    await stuur({ actie: 'aanwezigheid', id: b.id, bron: el.value || null });
  }
});

/* Slepen aan het greepje: de rij schuift mee, loslaten bewaart de volgorde. */
let sleep = null;
document.addEventListener('pointerdown', (e) => {
  const greep = e.target.closest('[data-greep]');
  if (!greep || !data) return;
  e.preventDefault();
  sleep = { id: greep.dataset.greep, lijst: greep.closest('[data-lijst]') };
  sleepVolgorde = data.bewoners.map((b) => b.id);
  greep.setPointerCapture?.(e.pointerId);
});
document.addEventListener('pointermove', (e) => {
  if (!sleep) return;
  const rijen = [...sleep.lijst.querySelectorAll('[data-rij]')];
  const onder = rijen.find((r) => {
    const box = r.getBoundingClientRect();
    return e.clientY >= box.top && e.clientY <= box.bottom;
  });
  if (!onder || onder.dataset.rij === sleep.id) return;
  // Op de plek van de rij onder de vinger.
  const v = sleepVolgorde.filter((id) => id !== sleep.id);
  v.splice(rijen.indexOf(onder), 0, sleep.id);
  sleepVolgorde = v;
  $$('[data-lijst]').forEach((el) => (el.innerHTML = lijst()));
  sleep.lijst.querySelector(`[data-rij="${CSS.escape(sleep.id)}"]`)?.classList.add('sleept');
});
async function loslaten() {
  if (!sleep) return;
  const v = sleepVolgorde;
  sleep = null;
  sleepVolgorde = null;
  if (v && v.join() !== data.bewoners.map((b) => b.id).join()) await stuur({ actie: 'volgorde', volgorde: v });
  else teken();
}
document.addEventListener('pointerup', () => void loslaten());
document.addEventListener('pointercancel', () => void loslaten());

app.start('instellingen');
(async () => {
  const [b, z] = await Promise.allSettled([haal('api/bewoners'), haal('api/zon')]);
  if (b.status === 'fulfilled') data = b.value;
  if (z.status === 'fulfilled') zon = z.value;
  if (!data) $$('[data-lijst]').forEach((el) => (el.innerHTML = `<p class="klein geen-marge">${esc(t('bewoners.geenLogmap'))}</p>`));
  teken();
})();
