/*
 * Energie › Thuisaccu (besluit 271, schets Wand-Energie-Accu, issue 145):
 * naast Auto en laadpaal, met dezelfde opbouw. Links wat de app in Home
 * Assistant vond, elk met een schakelaar, en zelf een apparaat kiezen, zoals
 * een apparaat van Homey met losse sensoren. Rechts per accu welke sensor wat
 * is: hoe vol, het vermogen (met wat plus betekent), en hoeveel hij in totaal
 * laadde en leverde. SunArc kijkt alleen; hij stuurt de accu niet.
 *
 * De dienst zoekt de accu's en de sensoren (`api/aansluiting`, veld `accu`);
 * deze kant zet de keuzes in de antwoorden (`accu`): `aan` per apparaat,
 * `zelf` voor wat de bewoner koos, en per accu de `instelling`.
 */
'use strict';

const thuisaccu = (() => {
  const { esc } = app;
  const t = (k, p) => window.taal.t(k, p);
  const nl = (n, d = 1) => window.taal.getal(n, d);
  const ROLLEN = ['lading', 'vermogen', 'geladen', 'geleverd'];
  /** Welke soort sensor bij een rol past. */
  const SOORT = { lading: 'lading', vermogen: 'vermogen', geladen: 'energie', geleverd: 'energie' };

  const keuzeVan = (a) => (a.accu ??= { aan: {}, zelf: [], instelling: {} });
  const lijst = (info) => info?.accu?.apparaten ?? [];
  const aan = (info) => lijst(info).filter((x) => x.aan);

  /** Het korte zinnetje bij Energie in de lijst links. */
  function kortZin(info) {
    if (!info?.accu) return null;
    const n = aan(info).length;
    if (!n) return t('accu.nietsKort');
    // Met de maat erbij als die van elke accu bekend is (besluit 275).
    const maten = aan(info).map((x) => x.maatKWh);
    const samen = maten.every((m) => m != null) ? maten.reduce((s, m) => s + m, 0) : null;
    return samen != null ? t('accu.nAccusMaat', { n, kwh: nl(samen, samen % 1 ? 1 : 0) }) : t('accu.nAccus', { n });
  }

  /** Wat een sensor nu zegt, met zijn eenheid; een vermogen vanaf 1000 W in kW. */
  function waarde(s) {
    if (!s || s.staat == null) return '';
    const min = s.staat < 0 ? '−' : '';
    const n = Math.abs(s.staat);
    if (s.eenheid === 'W' && n >= 1000) return `${min}${nl(n / 1000, 1)} kW`;
    if (s.eenheid === '%') return `${min}${nl(n, 0)}%`;
    return `${min}${nl(n, n >= 100 ? 0 : 1)} ${s.eenheid}`.trim();
  }

  /** Het zinnetje in het lijstje links: wie het levert en wat hij meet, of dat hij uit staat. */
  function watZin(x) {
    if (!x.aan) return t('accu.uitZin');
    const wat = ['lading', 'vermogen'].filter((r) => x.sensoren[r]).map((r) => t(`accu.wat.${r}`));
    if (x.sensoren.geladen || x.sensoren.geleverd) wat.push(t('accu.wat.totaal'));
    return [x.zelf ? t('accu.zelfGekozen') : x.merk, wat.join(', ') || t('accu.watNiets')].filter(Boolean).join(' · ');
  }

  const VERBERG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3 4.1M6.1 6.1C3.9 7.5 2.5 9.7 2 12c1 2.5 5 7 10 7a9.6 9.6 0 0 0 5.9-2.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  /** Een ander apparaat kiezen. */
  function kiezen(info, label) {
    const k = info.accu.kandidaten;
    if (!k.length) return '';
    return `<select class="invoer" data-accu-kies aria-label="${esc(label)}"><option value="">${esc(label)}</option>${k.map((x) => `<option value="${esc(x.id)}">${esc(x.naam)}</option>`).join('')}</select>`;
  }

  /** Eén rol: de sensoren van dit apparaat eerst, dan de andere van dezelfde soort. */
  function sensorKeuze(info, x, rol) {
    const alle = info.accu.sensoren.filter((s) => s.soort === SOORT[rol]);
    const huidig = x.sensoren[rol];
    const nu = info.accu.sensoren.find((s) => s.id === huidig);
    // Bij een sensor van dit apparaat zonder de naam van het apparaat ervoor: "battery" in plaats van "Laadplan Controller battery".
    const kort = (s) => (s.apparaat === x.id && s.naam.toLowerCase().startsWith(`${x.naam.toLowerCase()} `) ? s.naam.slice(x.naam.length + 1) : s.naam);
    const optie = (s) => `<option value="${esc(s.id)}" ${s.id === huidig ? 'selected' : ''}>${esc(kort(s))}</option>`;
    const eigen = alle.filter((s) => s.apparaat === x.id);
    const ander = alle.filter((s) => s.apparaat !== x.id);
    const label = t(`accu.rol.${rol}`);
    return `<label class="ac-sensor"><span class="veldnaam">${esc(label)}${nu?.staat != null ? `<em>${esc(waarde(nu))}</em>` : ''}</span>
      <select class="invoer" data-accu-sensor="${rol}" data-id="${esc(x.id)}" aria-label="${esc(label)}"><option value="">${esc(t('accu.geen'))}</option>${eigen.map(optie).join('')}${ander.length ? `<optgroup label="${esc(t('accu.andere'))}">${ander.map(optie).join('')}</optgroup>` : ''}</select></label>`;
  }

  /** Wat de accu nu doet, met het teken toegepast: zo zie je of de keuze klopt. */
  function nuZin(x) {
    const w = x.vermogenW;
    if (w == null) return { kleur: 'var(--net)', zin: t('accu.nuOnbekend') };
    const kw = `${w < 0 ? '−' : ''}${nl(Math.abs(w) / 1000, Math.abs(w) >= 10_000 ? 0 : 1)} kW`;
    if (w > 40) return { kleur: 'var(--zon)', zin: t('accu.nuLaadt', { kw }) };
    if (w < -40) return { kleur: 'var(--violet)', zin: t('accu.nuLevert', { kw }) };
    return { kleur: 'var(--net)', zin: t('accu.nuRust') };
  }

  /** Rechts: welke sensor wat is, en wat plus betekent. */
  function instellen(info, x) {
    const nu = nuZin(x);
    const teken = x.ontlaadVermogen
      ? `<p class="mini">${esc(t('accu.tweeVermogens'))}</p>`
      : `<div class="keuzes" role="group">${['laden', 'leveren'].map((w) => `<button type="button" data-accu="teken" data-id="${esc(x.id)}" data-waarde="${w}" aria-pressed="${x.teken === w}">${esc(t(`accu.plus.${w}`))}</button>`).join('')}</div>`;
    const weg = x.zelf ? `<button type="button" class="knop" data-accu="weg" data-id="${esc(x.id)}" style="align-self: start">${esc(t('accu.weghalen'))}</button>` : '';
    return `<div class="ld-vraag"><b>${esc(t('accu.welkeSensor'))}</b><div class="ac-sensoren">${ROLLEN.map((r) => sensorKeuze(info, x, r)).join('')}</div></div>
      <div class="ld-vraag"><b>${esc(t('accu.plusKop'))}</b>${teken}<span class="ac-nu"><i style="background: ${nu.kleur}"></i>${esc(nu.zin)}</span></div>
      <label class="veldnaam">${esc(t('accu.maat'))}<span class="ld-met ac-maat"><input class="invoer" type="number" inputmode="decimal" min="1" max="200" step="0.1" data-accu-maat="${esc(x.id)}" value="${x.maatKWh ?? ''}" placeholder="${esc(t('accu.maatVoorbeeld'))}"><span>kWh</span></span></label>
      <p class="mini" style="margin-top: -6px">${esc(t('accu.maatUitleg'))}</p>
      <div class="ld-evcc ac-kijkt"><span class="stip" style="background: var(--ijs)"></span><span>${esc(t('accu.kijkt'))}</span></div>${weg}`;
  }

  /** Een tik; true als er iets te bewaren is, 'teken' als alleen het beeld verandert. */
  function klik(el, info, a, staat) {
    const knop = el.closest('[data-accu]');
    if (!knop) return false;
    const { accu: wat, id } = knop.dataset;
    const k = keuzeVan(a);
    if (wat === 'aan') {
      const nu = knop.getAttribute('aria-checked') === 'true';
      const zelf = lijst(info).find((y) => y.id === id)?.zelf;
      // Wat de app vond, staat zonder keuze aan; uit is een keuze.
      if (!nu && !zelf) delete k.aan[id];
      else k.aan[id] = !nu;
      return true;
    }
    if (wat === 'teken') {
      k.instelling[id] = { ...(k.instelling[id] ?? {}), teken: knop.dataset.waarde };
      return true;
    }
    if (wat === 'weg') {
      k.zelf = k.zelf.filter((x) => x !== id);
      delete k.aan[id];
      delete k.instelling[id];
      if (staat.wie === id) staat.wie = null;
      return true;
    }
    return false;
  }

  /** Een keuzelijst; true als er iets te bewaren is. */
  function verander(el, info, a, staat) {
    const k = keuzeVan(a);
    if (el.matches('[data-accu-kies]')) {
      if (!el.value) return false;
      k.zelf = [...new Set([...k.zelf, el.value])];
      k.aan[el.value] = true;
      staat.wie = el.value;
      return true;
    }
    if (el.dataset.accuMaat) {
      const n = Number(el.value.replace(',', '.'));
      const maat = el.value === '' || !Number.isFinite(n) ? null : Math.min(200, Math.max(1, Math.round(n * 10) / 10));
      if (maat != null) el.value = String(maat);
      k.instelling[el.dataset.accuMaat] = { ...(k.instelling[el.dataset.accuMaat] ?? {}), maatKWh: maat };
      return true;
    }
    if (el.dataset.accuSensor) {
      const { accuSensor: rol, id } = el.dataset;
      k.instelling[id] = { ...(k.instelling[id] ?? {}), [rol]: el.value || null };
      return true;
    }
    return false;
  }

  /** Het blad van één thuisaccu bij Apparaten (besluit 318): of hij meedoet, en welke sensor wat is. */
  function blad(info, id) {
    const x = lijst(info).find((y) => y.id === id) ?? aan(info)[0] ?? null;
    if (!x) return null;
    // Verborgen (stap 4): terughalen; anders de keuzes en onderaan Verbergen.
    if (!x.aan) return { naam: x.naam, html: `<p class="uitleg">${esc(t('accu.verborgenZin'))}</p><button type="button" class="knop" data-accu="aan" data-id="${esc(x.id)}" aria-checked="false" style="align-self: start">${esc(t('toev.terughalen'))}</button>` };
    const verberg = `<button type="button" class="ld-verberg" data-accu="aan" data-id="${esc(x.id)}" aria-checked="true">${VERBERG}<span>${esc(t('toev.verbergen'))}<small>${esc(t('accu.verbergZin'))}</small></span></button>`;
    return { naam: x.naam, html: `${instellen(info, x)}<a class="ac-waar geen-marge" href="jehuis.html#buiten/rond">${esc(t('accu.waarStaat'))}</a>${verberg}` };
  }

  /** Zelf een apparaat kiezen (Toevoegen › Thuisaccu, stap 4). */
  function zelfKiezen(info) {
    if (!info?.accu) return `<p class="uitleg">${esc(t('accu.geenHA'))}</p>`;
    const keuze = kiezen(info, t('accu.eenKiezen'));
    return keuze ? `<label class="veldnaam">${esc(t('accu.zelfVraag'))}${keuze}</label><p class="mini">${esc(t('accu.anderUitleg'))}</p>` : `<p class="uitleg">${esc(t('laden.zelfGeen'))}</p>`;
  }

  return { klik, verander, kortZin, blad, lijst, zelfKiezen, watZin };
})();
// Ook als window.thuisaccu, voor het blad bij Apparaten (instellen.js, besluit 318).
window.thuisaccu = thuisaccu;
