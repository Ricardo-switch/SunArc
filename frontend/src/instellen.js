/*
 * Een apparaat instellen op zijn kaart (besluit 318, schets Wand-Apparaat-Kaart):
 * de regels bovenaan het blad van een stekker, witgoed of een boiler. Waar staat
 * hij (dezelfde kamers als in Je huis), op zon, wat hij trekt, minstens per dag
 * en of SunArc hem met de hand mag schakelen. Dit stond eerst bij Regeling ›
 * Apparaten op zon; daar staat het niet meer.
 *
 * Bewaren gaat zoals eerst: op zon, het vermogen, het minimum en de toestemming
 * bij de aansluiting (`api/aansluiting`, met de rest zoals het was), de kamer in
 * de indeling (`api/indeling`). Na elke wijziging stuurt dit bestand het
 * venster-event `instellen`, zodat het blad zichzelf opnieuw tekent.
 */
(function (global) {
  'use strict';
  if (global.instellen) return;

  const { esc, nl, haal, deur } = global.app;
  const t = (k, p) => global.t(k, p);

  let aans = null;
  let huis = null;
  let indeling = null;
  let laden = null;
  /** Het apparaat waarvan Waar staat hij? open is, of null. */
  let kiest = null;
  let fout = '';

  const meld = () => global.dispatchEvent(new CustomEvent('instellen'));

  /** De gegevens ophalen; een tweede vraag tijdens het laden wacht op de eerste. */
  function laad() {
    laden ??= (async () => {
      const [a, h, i] = await Promise.allSettled([haal('api/aansluiting'), haal('api/huis'), haal('api/indeling')]);
      if (a.status === 'fulfilled') aans = a.value;
      if (h.status === 'fulfilled') huis = h.value;
      if (i.status === 'fulfilled') indeling = i.value;
      laden = null;
      meld();
    })();
    return laden;
  }

  /* ------------------------------------------------------------ lezen */

  const antwoorden = () => aans?.antwoorden ?? {};
  /** Waar een apparaat nu staat: de ruimte uit het huis, of null zonder plek. */
  function ruimteVan(id) {
    for (const e of huis?.etages ?? []) for (const r of e.ruimtes ?? []) if ((r.apparaten ?? []).some((a) => a.id === id)) return { r, e };
    return null;
  }
  const kentHuis = (id) => ruimteVan(id) != null || (huis?.zonderRuimte ?? []).some((a) => a.id === id);
  const uitConfiguratie = (id) => (aans?.configuratie?.apparaten ?? []).some((x) => x.id === id);
  const gevonden = (id) => (aans?.gevonden?.apparaten ?? []).find((x) => x.id === id) ?? null;

  /* ------------------------------------------------------------ tekenen */

  /**
   * Op zon staat op één plek (besluit 345): Energie › De zon verdelen. Hier alleen een regel zonder knop, met een tik
   * erheen. De knoppen erbij en uit de lijst gebruiken `zetOpZon` hieronder.
   */
  const zonRegel = (aan) => `<a class="in-rij in-knop" href="energie.html#zon"><span class="l"><b>${esc(t('w.opZon'))}</b><span>${esc(t(aan ? 'in.opZonBij' : 'in.opZonNiet'))}</span></span><span class="pijl" aria-hidden="true">›</span></a>`;

  const schakel = (aan, attr, label, uit = false) => `<button type="button" class="schakelaar" role="switch" aria-checked="${aan}" aria-label="${esc(label)}" ${attr}${uit ? ' disabled' : ''}></button>`;
  function rij(wat, zin, rechts, extra = '') {
    return `<div class="in-rij${extra}"><div class="l"><b>${esc(wat)}</b>${zin ? `<span>${esc(zin)}</span>` : ''}</div>${rechts}</div>`;
  }
  const groep = (kop, rijen) => (rijen.filter(Boolean).length ? `<div class="in-groep"><h4>${esc(kop)}</h4>${rijen.filter(Boolean).join('')}</div>` : '');

  /** Waar staat hij? Een tik opent de kamers; zonder plek de oranje regel. */
  function waarRij(id) {
    if (!kentHuis(id)) return '';
    const plek = ruimteVan(id);
    const naam = plek ? plek.r.naam : t('in.geenPlek');
    return `<button type="button" class="in-rij in-knop${plek ? '' : ' mist'}" data-in-waar="${esc(id)}"><span class="l"><b>${esc(t('in.waar'))}</b></span><span class="w">${esc(naam)}</span><span class="pijl" aria-hidden="true">›</span></button>`;
  }

  const DUREN = [30, 60, 120, 180, 240, 360, 480];
  const duurNaam = (m) => (m < 60 ? t('w.minuten', { n: m }) : t(m === 60 ? 'hand.uur1' : 'regeling.uren', { n: m / 60 }));
  function klokKeuze(huidig, attr, label) {
    const tijden = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);
    return `<select class="invoer in-klein" ${attr} aria-label="${esc(label)}">${tijden.map((x) => `<option value="${x}" ${x === huidig ? 'selected' : ''}>${x}</option>`).join('')}</select>`;
  }

  /**
   * De regels voor een slimme stekker. `nuW` is wat hij nu trekt;
   * `kanSchakelen` of SunArc hier stekkers mag schakelen (in de add-on, of met
   * HEMS_DEUREN op een eigen server).
   */
  /** @param {string} id @param {{ naam?: string, nuW?: number | null, kanSchakelen?: boolean }} opties */
  function stekkerRegels(id, { naam = '', nuW = null, kanSchakelen = false } = {}) {
    const a = antwoorden();
    // Uit het instellingenbestand staat hij vast op zon: dat zet je hier niet uit (het bestand gaat voor).
    const vast = uitConfiguratie(id);
    const opZon = vast || a.opZon?.[id] === true;
    const g = gevonden(id);
    const w = a.vermogen?.[id] ?? null;
    const min = a.minimum?.[id] ?? null;
    const mag = (a.bedienen ?? []).includes(id);
    const trekt = g?.meet
      ? rij(t('in.trekt'), null, `<span class="w">${esc(nuW != null && nuW >= 5 ? t('in.gemetenNu', { kw: nl(nuW / 1000) }) : t('in.gemeten'))}</span>`)
      : rij(t('in.trekt'), t('in.trektZin'), `<span class="in-invul"><input class="invoer in-klein" type="number" inputmode="numeric" min="50" max="3680" step="10" data-in-w="${esc(id)}" value="${w ?? ''}" placeholder="1000" aria-label="${esc(t('regeling.stekkerVermogen'))}"><span>W</span></span>`);
    const minuten = `<select class="invoer in-klein" data-in-min="${esc(id)}" aria-label="${esc(t('regeling.stekkerMinimumVan', { naam }))}"><option value="">${esc(t('regeling.stekkerMinimumGeen'))}</option>${DUREN.map((m) => `<option value="${m}" ${min?.minuten === m ? 'selected' : ''}>${esc(duurNaam(m))}</option>`).join('')}</select>`;
    return [
      groep(t('w.waar'), [waarRij(id)]),
      groep(t('w.opZon'), [
        vast ? rij(t('w.opZon'), t('in.uitBestand'), '') : zonRegel(opZon),
        opZon && !vast ? trekt : '',
        opZon && !vast ? rij(t('in.minstens'), min ? t('regeling.stekkerMinimumUitleg') : null, minuten) : '',
        opZon && !vast && min ? rij(t('in.uiterlijk'), null, klokKeuze(min.klok, `data-in-klok="${esc(id)}"`, t('regeling.stekkerUiterlijkVan', { naam }))) : '',
      ]),
      kanSchakelen
        ? groep(t('w.metDeHand'), [rij(t('in.mag'), t(opZon ? 'in.magZon' : mag ? 'in.magAan' : 'in.magUit'), schakel(opZon || mag, `data-in-mag="${esc(id)}"`, t('in.mag'), opZon))])
        : '',
      fout ? `<p class="hand-fout">${esc(fout)}</p>` : '',
    ].join('');
  }

  /** Witgoed: start hij op zon (uit de configuratie of uit Home Assistant), en waar staat hij. */
  /** @param {string} id */
  function witgoedRegels(id) {
    const a = antwoorden();
    const conf = uitConfiguratie(id);
    const g = !conf ? gevonden(id) : null;
    const aan = conf ? !(a.opZonUit ?? []).includes(id) : a.opZon?.[id] === true;
    const zon = conf || g ? zonRegel(aan) : '';
    return [groep(t('w.waar'), [waarRij(id)]), groep(t('w.opZon'), [zon]), fout ? `<p class="hand-fout">${esc(fout)}</p>` : ''].join('');
  }

  /** Een boiler of jacuzzi: waar hij staat; op zon staat in het instellingenbestand. */
  function bufferRegels(id) {
    const zon = uitConfiguratie(id) ? rij(t('w.opZon'), t('in.uitBestand'), '') : '';
    return [groep(t('w.waar'), [waarRij(id)]), groep(t('w.opZon'), [zon])].join('');
  }

  /** Een kopie van de antwoorden om in te veranderen, zoals Energie dat deed (laden.js, thuisaccu.js). */
  const werk = () => JSON.parse(JSON.stringify(aans?.antwoorden ?? {}));
  /** Welke auto, laadpaal of accu er gekozen is; in een blad is dat het apparaat zelf. */
  const staat = { wie: null };
  const foutRegel = () => (fout ? `<p class="hand-fout">${esc(fout)}</p>` : '');

  /** De regels voor een apparaat in het blad; leeg zolang de gegevens er niet zijn. */
  function regels(soort, id, opties = {}) {
    if (!aans && !huis) {
      void laad();
      return '';
    }
    // Een auto of laadpaal, en de thuisaccu (besluit 318): dezelfde keuzes als eerst bij Energie.
    if (soort === 'laden') return `${global.laden?.blad(aans, werk(), id)?.html ?? ''}${foutRegel()}`;
    // De hele lijst, zoals eerst bij Energie: wat gevonden is met een schakelaar, en een ander apparaat kiezen.
    if (soort === 'accu') return `${global.thuisaccu?.blad(aans, id)?.html ?? ''}${foutRegel()}`;
    if (soort === 'stekker') return stekkerRegels(id, opties);
    if (soort === 'witgoed') return witgoedRegels(id);
    return bufferRegels(id);
  }

  /** Waar staat hij? open: de kamers per etage, met Buiten; anders null. */
  function kiezen(id, naam) {
    if (kiest !== id) return null;
    const nu = ruimteVan(id)?.r.id ?? null;
    const etages = (huis?.etages ?? []).filter((e) => (e.ruimtes ?? []).length);
    return `<button type="button" class="hand-terug in-terug" data-in-terug>‹ ${esc(naam)}</button>
      <div><h2 class="in-kop">${esc(t('in.waar'))}</h2><p class="mini geen-marge boven-4">${esc(t('in.waarZin'))}</p></div>
      ${etages.map((e) => `<div class="in-groep"><h4>${esc(e.naam)}</h4><div class="in-twee">${e.ruimtes.map((r) => `<button type="button" class="in-plek${r.id === nu ? ' aan' : ''}" aria-pressed="${r.id === nu}" data-in-plek="${esc(r.id)}">${esc(r.naam)}</button>`).join('')}</div></div>`).join('')}
      ${fout ? `<p class="hand-fout">${esc(fout)}</p>` : ''}
      <p class="mini geen-marge">${esc(t('in.waarVoet'))}</p>`;
  }

  /* ------------------------------------------------------------ bewaren */

  /** Bewaart bij de aansluiting: de rest zoals het was, met `wijzig` erop. */
  async function bewaarAansluiting(wijzig) {
    let x;
    try {
      x = (await haal('api/aansluiting'))?.antwoorden ?? {};
    } catch {
      fout = t('kamer.geenVerbinding');
      return meld();
    }
    const body = {
      panelen: x.panelen ?? { ligging: null, aantal: null, voorkant: null, achterkant: null },
      zekering: x.zekering ?? null,
      tarief: x.tarief ?? null,
      verwarming: x.verwarming ?? { soort: null, aanvoerC: null },
      voorkantZon: x.voorkantZon ?? null,
      dak: x.dak ?? null,
      ...(x.elders ? { elders: x.elders } : {}),
      opZon: Object.fromEntries(Object.entries(x.opZon ?? {}).filter(([, v]) => typeof v === 'boolean')),
      opZonUit: [...(x.opZonUit ?? [])],
    };
    wijzig(body);
    const res = await deur('api/aansluiting', body);
    if (!res) return;
    const uit = await res.json().catch(() => ({}));
    if (!res.ok) fout = res.status === 403 ? t('groep.beheerder') : (uit.fout ?? t('groep.nietBewaard'));
    else {
      fout = '';
      aans = uit;
    }
    meld();
    global.dispatchEvent(new CustomEvent('handveranderd'));
  }

  /** Zet een apparaat in een kamer, in de indeling (dezelfde keuze als in Je huis). */
  async function bewaarPlek(id, kamer) {
    try {
      indeling = await haal('api/indeling');
    } catch {
      fout = t('kamer.geenVerbinding');
      return meld();
    }
    const basis = indeling?.indeling ?? indeling?.voorstel;
    if (!basis) return;
    const next = JSON.parse(JSON.stringify(basis));
    const oud = next.apparaten?.[id] ?? {};
    // Een plek in de tekening hoort bij de oude kamer: in een andere kamer kiest Je huis er weer een.
    const { plek: _plek, raam: _raam, ...rest } = oud;
    next.apparaten = { ...(next.apparaten ?? {}), [id]: { ...(oud.kamer === kamer ? oud : rest), kamer, zone: oud.kamer === kamer ? (oud.zone ?? null) : null } };
    next.verborgen = (next.verborgen ?? []).filter((x) => x !== id);
    const res = await deur('api/indeling', next);
    if (!res) return;
    if (!res.ok) {
      const uit = await res.json().catch(() => ({}));
      fout = res.status === 403 ? t('indeling.beheerder') : (uit.fout ?? t('groep.nietBewaard'));
      return meld();
    }
    fout = '';
    kiest = null;
    try {
      huis = await haal('api/huis');
    } catch {
      // De volgende keer opnieuw.
    }
    meld();
    global.dispatchEvent(new CustomEvent('handveranderd'));
  }

  document.addEventListener('click', (e) => {
    const knop = /** @type {HTMLButtonElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('[data-in-waar], [data-in-terug], [data-in-plek], [data-in-mag]'));
    if (!knop || knop.disabled) return;
    if (knop.dataset.inWaar) {
      kiest = knop.dataset.inWaar;
      fout = '';
      return meld();
    }
    if (knop.hasAttribute('data-in-terug')) {
      kiest = null;
      return meld();
    }
    if (knop.dataset.inPlek && kiest) return void bewaarPlek(kiest, knop.dataset.inPlek);
    const aan = knop.getAttribute('aria-checked') !== 'true';
    knop.setAttribute('aria-checked', String(aan));
    if (knop.dataset.inMag) {
      const id = knop.dataset.inMag;
      return void bewaarAansluiting((b) => {
        b.bedienen = { [id]: aan };
      });
    }
  });

  /** Een keuze bij laden of de accu, in het blad: bewaren zoals Energie, met de rest zoals het was. */
  async function ladenOfAccu(el, wat) {
    if (!aans) return;
    const a = werk();
    staat.wie = el.dataset.id ?? staat.wie;
    const r = wat(a);
    if (r === 'teken') return meld();
    if (r === true) await bewaarAansluiting((b) => {
      if (a.laden) b.laden = a.laden;
      if (a.accu) b.accu = a.accu;
    });
  }
  document.addEventListener('click', (e) => {
    const knop = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('[data-hand] [data-laad], [data-hand] [data-accu]'));
    if (!knop || /** @type {HTMLButtonElement} */ (knop).disabled) return;
    void ladenOfAccu(knop, (a) => (knop.dataset.laad ? global.laden.klik(knop, aans, a, staat) : global.thuisaccu.klik(knop, aans, a, staat)));
  });
  document.addEventListener('change', (e) => {
    const el = /** @type {HTMLInputElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('[data-hand] select, [data-hand] input'));
    if (!el || !(el.matches('[data-laad-kies], [data-laad-accu], [data-laad-kabelom], [data-laad-paal], [data-accu-kies], [data-accu-maat], [data-accu-sensor]'))) return;
    void ladenOfAccu(el, (a) => global.laden?.verander(el, aans, a, staat) || global.thuisaccu?.verander(el, aans, a, staat));
  });

  document.addEventListener('change', (e) => {
    const veld = /** @type {HTMLInputElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('[data-in-w], [data-in-min], [data-in-klok]'));
    if (!veld) return;
    if (veld.dataset.inW) {
      const id = veld.dataset.inW;
      const w = Math.round(Number(veld.value));
      return void bewaarAansluiting((b) => {
        b.vermogen = { [id]: veld.value === '' ? null : Math.min(3680, Math.max(50, w)) };
      });
    }
    if (veld.dataset.inMin) {
      const id = veld.dataset.inMin;
      const klok = antwoorden().minimum?.[id]?.klok ?? '22:00';
      return void bewaarAansluiting((b) => {
        b.minimum = { [id]: veld.value === '' ? null : { minuten: Number(veld.value), klok } };
      });
    }
    const id = veld.dataset.inKlok;
    const nu = antwoorden().minimum?.[id];
    if (!nu || !/^([01]\d|2[0-3]):[0-5]\d$/.test(veld.value)) return;
    return void bewaarAansluiting((b) => {
      b.minimum = { [id]: { ...nu, klok: veld.value } };
    });
  });

  /**
   * Op zon aan of uit bij de aansluiting (besluit 345: vanuit De zon verdelen): een stekker of witgoed uit Home
   * Assistant, of witgoed uit het instellingenbestand (dan via `opZonUit`). Geeft of het bewaard is.
   */
  async function zetOpZon(id, aan) {
    if (!aans) await laad();
    await bewaarAansluiting((b) => {
      if (uitConfiguratie(id)) b.opZonUit = aan ? b.opZonUit.filter((x) => x !== id) : [...new Set([...b.opZonUit, id])];
      else b.opZon[id] = aan;
    });
    return !fout;
  }
  /** Wat op zon kan bij de aansluiting: gevonden in Home Assistant of uit het instellingenbestand, met of het aan staat. */
  function opZonApparaten() {
    const a = antwoorden();
    const conf = (aans?.configuratie?.apparaten ?? []).map((x) => ({ id: x.id, naam: x.naam ?? x.id, soort: x.soort ?? 'witgoed', aan: !(a.opZonUit ?? []).includes(x.id) }));
    const gev = (aans?.gevonden?.apparaten ?? []).filter((x) => !conf.some((c) => c.id === x.id)).map((x) => ({ id: x.id, naam: x.naam, soort: x.soort, aan: a.opZon?.[x.id] === true }));
    return [...conf, ...gev];
  }

  global.instellen = { laad, regels, kiezen, zetOpZon, opZonApparaten, fout: () => fout, sluit: () => (kiest = null), kiest: () => kiest };
})(window);
