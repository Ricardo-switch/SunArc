/*
 * Dit scherm (stap 4 punt 2): wat bij het scherm hoort staat bij Jij, niet
 * meer bij Extra's (besluit 167 zette het daar onder
 * Weergave). Vier delen: Dit scherm (volledig scherm, alleen in Home
 * Assistant), het always-on display van de wand (besluiten 164, 165, 168 en
 * 206), Scherm uit (met de camera van Fully als bewegingsmelder) en Op je
 * startscherm.
 *
 * Always-on en scherm uit zijn per bewoner: op je
 * eigen Jij die van jou, op de wand die van wie hij volgt. Dit scherm en op je
 * startscherm gelden alleen voor het apparaat.
 *
 * Jij toont elk deel in zijn blad: `delen()` geeft de rijen, `titel(id)` en
 * `vorm(id)` het blad, `klik`, `verander` en `invoer` doen wat er getikt of
 * geschoven wordt. Wat de wand doet als niemand kijkt, bewaart dit deel zelf
 * bij de voorkeuren van de wand; `op(fn)` hoort het nieuwe antwoord.
 */
'use strict';

const ditScherm = (() => {
  const esc = (s) => window.app.esc(s);
  const t = (k, p) => window.taal.t(k, p);
  const app = window.app;
  const DELEN = ['scherm', 'aod', 'uit', 'startscherm'];

  let voorkeur = null;
  let zon = null;
  let huis = null;
  let startscherm = null;
  let teken = () => {};
  let nieuw = (_v) => {};
  /** Een bewoner op zijn eigen Jij (stap 4 punt 2): always-on en scherm uit zijn van hem (plek tel). */
  let eigen = false;

  /** De zon (zonsopgang en -ondergang), het huis (de bewegingsmelders) en of de eigen poort openstaat. */
  async function laad() {
    const [z, h, st] = await Promise.allSettled([app.haal('api/zon'), app.haal('api/huis'), app.haal('api/startscherm')]);
    if (z.status === 'fulfilled') zon = z.value;
    if (h.status === 'fulfilled') huis = h.value;
    if (st.status === 'fulfilled') startscherm = st.value;
  }
  /** De voorkeuren van de pagina; `tekenOpnieuw` na een wijziging, `bewaard` met het antwoord van de dienst. */
  function zet(v, tekenOpnieuw, bewaard, vanBewoner) {
    voorkeur = v;
    if (vanBewoner !== undefined) eigen = vanBewoner;
    if (tekenOpnieuw) teken = tekenOpnieuw;
    if (bewaard) nieuw = bewaard;
  }

  /* ------------------------------------------------------------ hulpjes */

  const NIEMAND = { nacht: true, van: '23:00', tot: '07:00', rustMin: 5, aanMin: 5, weg: true, dag: true, avond: true, helderDag: 75, helderAvond: 25, melder: null };
  const niemandNu = () => ({ ...NIEMAND, ...(eigen ? voorkeur?.tel?.niemand : voorkeur?.wand?.niemand) });
  const magWand = () => eigen || !!voorkeur?.wand?.magAanpassen;
  const schakel = (aan, data, label, uit = false) => `<button type="button" class="schakelaar" role="switch" aria-checked="${aan}" aria-label="${esc(label)}" ${data} ${uit ? 'disabled' : ''}></button>`;
  const nkKeuzes = (label, attr, opties, huidig, uit = false) => `<div class="keuzes" role="group" aria-label="${esc(label)}">${opties.map(([w, x]) => `<button type="button" data-${attr}="${w}" aria-pressed="${w === huidig}" ${uit ? 'disabled' : ''}>${esc(x)}</button>`).join('')}</div>`;
  const minuten = (lijst) => lijst.map((n) => [n, t('algemeen.minuten', { n })]);
  /** Een schuif voor de helderheid, van 0 tot 100 (besluit 206); het getal ernaast loopt mee. */
  const nkSchuif = (label, attr, waarde, uit = false) =>
    `<div class="nk-helder"><input class="nk-schuif" type="range" min="0" max="100" step="1" value="${waarde}" data-${attr} aria-label="${esc(label)}" ${uit ? 'disabled' : ''}><b data-nk-pct>${waarde}%</b></div>`;
  const alleenHoofd = () => (magWand() ? '' : `<p class="uitleg" style="color: var(--zon-t)">${esc(t('functies.alleenHoofd'))}</p>`);
  const voorDeWand = () => `<p class="mini">${esc(t('functies.voorDeWand'))}</p>`;
  /** Een uitleg met eigen HTML uit de teksten (<b>, <i>, <code>): wat erin komt, wordt ontsnapt. */
  const metHtml = (sleutel, p = {}) => t(sleutel, Object.fromEntries(Object.entries(p).map(([k, v]) => [k, esc(v)])));

  /* ------------------------------------------------------------ de rijen */

  function startschermZin() {
    if (app.geinstalleerd()) return t('functies.st.staatErop');
    if (app.kanInstalleren()) return t('functies.st.kanNu');
    return t(app.inHA() ? (startscherm?.eigenPoort ? 'functies.st.viaChrome' : 'functies.st.eerstInstellen') : 'functies.st.viaBrowser');
  }
  /**
   * De rijen voor Jij, in twee groepen (alles bij
   * Jij is persoonlijk): `wand` (always-on en scherm uit, van jou; de wand doet
   * het zo als jouw comfort geldt) en `apparaat` (dit scherm alleen in Home
   * Assistant, en op je startscherm), die alleen voor dit apparaat gelden.
   */
  function delen(groep) {
    const n = niemandNu();
    if (groep === 'wand') {
      return [
        { id: 'aod', titel: t('functies.aod.kop'), zin: n.rustMin > 0 ? t('functies.deel.aodAan', { n: n.rustMin }) : t('w.uit2') },
        { id: 'uit', titel: t('functies.uit.kop'), zin: n.nacht ? `${n.van}–${n.tot}` : t(n.weg ? 'w.alsNiemandThuisIs' : 'functies.deel.nooit') },
      ];
    }
    return [
      ...(app.inHA() ? [{ id: 'scherm', titel: t('w.ditScherm'), zin: t(app.volledigGekozen() ? 'functies.deel.volledig' : 'functies.deel.zijbalk') }] : []),
      { id: 'startscherm', titel: t('functies.st.kop'), zin: startschermZin() },
    ];
  }
  /** Van wie de wand-instellingen zijn: van jou, of van wie de wand nu volgt. */
  function vanWie() {
    if (eigen) return t('jij.scherm.vanJou');
    const naam = voorkeur?.wand?.naam;
    return naam ? t('jij.scherm.vanWie', { naam }) : t('jij.scherm.vanWand');
  }
  const titel = (id) => ({ scherm: t('w.ditScherm'), aod: t('functies.aod.kop'), uit: t('functies.uit.kop'), startscherm: t('functies.st.kop') })[id] ?? '';

  /* ------------------------------------------------------------ de bladen */

  /** Dit scherm (besluit 155): volledig scherm, per apparaat; alleen als de app in Home Assistant draait. */
  function scherm() {
    const aan = app.volledigGekozen();
    return `<div class="regelrij"><div class="l"><b>${esc(t('w.volledigScherm'))}</b><span>${esc(t('functies.volledigZin'))}</span></div><button type="button" class="schakelaar" role="switch" aria-checked="${aan}" aria-label="${esc(t('w.volledigScherm'))}" data-volledig></button></div>
    <p class="mini">${esc(t('functies.volledigUitleg'))}</p>
    <div><button type="button" class="knop" data-naar-ha>${esc(t('basis.naarHA'))}</button></div>`;
  }

  /*
   * Op je startscherm. Met het eigen icoon kan alleen als
   * Chrome de app installeert: over https en buiten Home Assistant, dus via de
   * eigen poort in Tailscale (besluit 160). In de app van Home Assistant wijst
   * dit de weg daarheen; staat de eigen poort nog dicht, dan de stappen, met de
   * adressen van dit huis erin.
   */
  const android = /android/i.test(navigator.userAgent);
  const apple = /iphone|ipad/i.test(navigator.userAgent);
  /** Het adres van Home Assistant zoals deze telefoon het opent, als de app erin draait. */
  function haAdres() {
    try {
      return window.top.location.origin;
    } catch {
      return null;
    }
  }
  /** Waar SunArc in Tailscale staat: het adres dat al gebruikt is, of een voorstel uit dat van Home Assistant. */
  function tailscaleAdres() {
    if (startscherm?.adres) return startscherm.adres;
    const tailnet = /\.([a-z0-9-]+\.ts\.net)(?::\d+)?$/i.exec(haAdres() ?? '')?.[1];
    return tailnet ? `https://smartclimate.${tailnet}` : null;
  }
  function startschermVorm() {
    if (app.geinstalleerd()) return `<p class="uitleg">${esc(t('functies.st.geinstalleerd'))}</p>`;
    if (app.kanInstalleren()) {
      return `<p class="uitleg">${esc(t('functies.st.kan'))}</p>
      <div><button type="button" class="knop knop-licht" data-installeer>${esc(t('functies.st.zet'))}</button></div>`;
    }
    const adres = tailscaleAdres();
    if (app.inHA()) {
      if (startscherm?.eigenPoort && adres) {
        const host = adres.replace(/^https:\/\//, '');
        const open = android ? `intent://${host}/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(adres)};end` : adres;
        return `<p class="uitleg">${metHtml('functies.st.inHA')}</p>
        <p class="mini">${metHtml('functies.st.adres', { adres })}</p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap"><a class="knop knop-licht" href="${esc(open)}" target="_blank" rel="noopener">${esc(t('functies.st.openChrome'))}</a><button type="button" class="knop" data-kopieer-adres="${esc(adres)}">${esc(t('functies.st.kopieer'))}</button></div>
        <p class="mini" data-kopieer-zin aria-live="polite"></p>`;
      }
      const ha = haAdres() ?? 'http://homeassistant.local:8123';
      const naam = adres ?? `https://smartclimate.${t('functies.st.tailnet')}.ts.net`;
      return `<p class="uitleg">${esc(t('functies.st.waarom'))}</p>
      <ol class="geen-marge" style="padding-left: 20px; display: grid; gap: 8px">
        <li>${metHtml('functies.st.stap1', { ha })}</li>
        <li>${metHtml('functies.st.stap2')}</li>
        <li>${metHtml('functies.st.stap3')}</li>
        <li>${metHtml('functies.st.stap4')}</li>
        <li>${metHtml('functies.st.stap5', { naam })}</li>
      </ol>
      <p class="mini">${esc(t('functies.st.zonder'))}</p>`;
    }
    if (apple) return `<p class="uitleg">${metHtml('functies.st.safari')}</p>`;
    if (!window.isSecureContext) return `<p class="uitleg">${t('functies.st.https', { adres: adres ? `<b>${esc(adres)}</b>` : esc(t('functies.st.hetAdres')) })}</p>`;
    return `<p class="uitleg">${metHtml(android ? 'functies.st.chrome' : 'functies.st.chromeBalk')}</p>`;
  }

  /** Het always-on display (besluiten 164 en 165): na hoeveel minuten zonder aanraken, en of hij er is. */
  function aod() {
    const n = niemandNu();
    const mag = magWand();
    const aan = n.rustMin > 0;
    const zin = aan ? t('functies.aod.zin', { n: n.rustMin }) : t('functies.aod.blijft');
    // De dagstand en de avondstand (besluit 168): wanneer elk geldt, met de zonsondergang van vandaag.
    const onder = zon?.dag?.onderMs != null ? t('functies.aod.onderOm', { klok: taal.klok(zon.dag.onderMs) }) : t('functies.aod.onder');
    const dagVan = n.nacht ? n.tot : zon?.dag?.opMs != null ? t('functies.aod.opOm', { klok: taal.klok(zon.dag.opMs) }) : t('functies.aod.op');
    const avondTot = n.nacht ? n.van : dagVan;
    const dagZin = !n.avond ? t('functies.aod.dagAltijd') : !n.dag ? t('functies.aod.dagUit') : t('w.tot', { van: dagVan, tot: onder });
    const avondZin = !n.dag ? t('functies.aod.avondAltijd') : !n.avond ? t('functies.aod.avondUit') : t('w.tot', { van: onder, tot: avondTot });
    return `<p class="klein geen-marge" data-nk-zin>${esc(zin)}</p>
    <div class="regelrij"><div class="l"><b>${esc(t('functies.aod.kop'))}</b><span>${esc(t('functies.aod.regel'))}</span></div>${schakel(aan, 'data-nk-aod', t('functies.aod.kop'), !mag)}</div>
    <div class="${aan ? '' : 'uitgezet'}" data-nk-onder><span class="veldnaam">${esc(t('functies.aod.na'))}</span>${nkKeuzes(t('functies.aod.naLabel'), 'nk-rust', minuten([2, 5, 15]), n.rustMin, !mag || !aan)}</div>
    <div class="${aan ? '' : 'uitgezet'}">
      <div class="regelrij"><div class="l"><b>${esc(t('functies.aod.dagstand'))}</b><span data-nk-dagzin>${esc(t('functies.aod.dagZin', { wanneer: dagZin }))}</span></div>${schakel(n.dag, 'data-nk-dag', t('functies.aod.dagstand'), !mag || !aan || (n.dag && !n.avond))}</div>
      <div><span class="veldnaam">${esc(t('functies.aod.helderDag'))}</span>${nkSchuif(t('functies.aod.helderDagLabel'), 'nk-helder-dag', n.helderDag, !mag)}</div>
      <div class="regelrij"><div class="l"><b>${esc(t('functies.aod.avondstand'))}</b><span data-nk-avondzin>${esc(t('functies.aod.avondZin', { wanneer: avondZin }))}</span></div>${schakel(n.avond, 'data-nk-avond', t('functies.aod.avondstand'), !mag || !aan || (n.avond && !n.dag))}</div>
      <div class="${n.avond ? '' : 'uitgezet'}"><span class="veldnaam">${esc(t('functies.aod.helderAvond'))}</span>${nkSchuif(t('functies.aod.helderAvond'), 'nk-helder-avond', n.helderAvond, !mag || !aan || !n.avond)}</div>
    </div>
    ${n.nacht ? `<p class="mini">${esc(t('functies.aod.daarna', { van: n.van, tot: n.tot }))}</p>` : ''}
    <p class="uitleg">${esc(vanWie())}</p>
    ${alleenHoofd()}${voorDeWand()}
    <p class="mini">${esc(t('functies.aod.terug'))}</p>`;
  }

  /** De bewegingsmelders in het huis, met hun kamer. */
  function bewegingsmelders() {
    const uit = [];
    for (const e of huis?.etages ?? []) for (const r of e.ruimtes ?? []) for (const d of r.apparaten ?? []) {
      const id = d.meting?.beweging?.id;
      if (id && !uit.some((m) => m.id === id)) uit.push({ id, naam: d.naam, kamer: r.naam });
    }
    return uit;
  }

  /**
   * Wat Fully Kiosk op dit scherm doet: ziet de app Fully, en
   * kijkt de camera mee. Alleen op het scherm zelf te zien; op een telefoon
   * zegt het niets, behalve dat je het op de wand ziet.
   */
  function fullyHier(n) {
    let f = null;
    try {
      f = window.fully ?? null;
    } catch {
      // Geen Fully.
    }
    if (!f) return n.melder === 'fully' ? `<p class="uitleg">${esc(t('functies.uit.fullyNiet'))}</p>` : '';
    let camera = null;
    try {
      camera = f.isMotionDetectionRunning?.() ?? null;
    } catch {
      // Een oudere Fully.
    }
    const sleutel = n.melder !== 'fully' ? 'functies.uit.fullyGezien' : camera === false ? 'functies.uit.fullyCameraUit' : 'functies.uit.fullyCamera';
    return `<p class="uitleg" style="color: ${n.melder === 'fully' && camera === false ? 'var(--zon-t)' : 'var(--mint-t)'}">${esc(t(sleutel))}</p>`;
  }

  function schermUit() {
    const n = niemandNu();
    const mag = magWand();
    const ergens = n.nacht || n.weg;
    const melders = bewegingsmelders();
    const wanneer = n.nacht && n.weg ? t('functies.uit.beide', { van: n.van, tot: n.tot }) : n.nacht ? t('functies.uit.nacht', { van: n.van, tot: n.tot }) : n.weg ? t('functies.uit.weg') : null;
    const zin = wanneer
      ? [t('functies.uit.zin', { wanneer, n: n.aanMin }), n.melder ? t('functies.uit.beweging') : null, t('functies.uit.tik')].filter(Boolean).join(' ')
      : t('functies.uit.nooit');
    // De camera van de wand zelf, via Fully Kiosk, en de melders uit het huis.
    const opties = `<option value="fully" ${n.melder === 'fully' ? 'selected' : ''}>${esc(t('functies.uit.camera'))}</option>${melders.map((m) => `<option value="${esc(m.id)}" ${m.id === n.melder ? 'selected' : ''}>${esc(t('functies.uit.melder', { kamer: m.kamer, naam: m.naam }))}</option>`).join('')}`;
    return `<p class="klein geen-marge" data-nk-zin>${esc(zin)}</p>
    <div class="regelrij"><div class="l"><b>${esc(t('functies.uit.snachts'))}</b><span>${esc(t('functies.uit.snachtsZin'))}</span></div>${schakel(n.nacht, 'data-nk-nacht', t('functies.uit.snachtsLabel'), !mag)}</div>
    <div class="twee ${n.nacht ? '' : 'uitgezet'}"><label class="veldnaam">${esc(t('w.vanaf'))}<input class="invoer" type="time" step="900" value="${esc(n.van)}" data-nk-van ${mag && n.nacht ? '' : 'disabled'}></label><label class="veldnaam">${esc(t('w.tot2'))}<input class="invoer" type="time" step="900" value="${esc(n.tot)}" data-nk-tot ${mag && n.nacht ? '' : 'disabled'}></label></div>
    <div class="regelrij"><div class="l"><b>${esc(t('w.alsNiemandThuisIs2'))}</b><span>${esc(t('functies.uit.niemandZin'))}</span></div>${schakel(n.weg, 'data-nk-weg', t('w.alsNiemandThuisIs2'), !mag)}</div>
    <div class="${ergens ? '' : 'uitgezet'}"><span class="veldnaam">${esc(t('functies.uit.na'))}</span>${nkKeuzes(t('functies.uit.naLabel'), 'nk-aan', minuten([1, 5, 15, 30]), n.aanMin, !mag || !ergens)}</div>
    <div class="regelrij"><div class="l"><b>${esc(t('functies.uit.wekken'))}</b><span>${esc(t('functies.uit.wekkenZin'))}</span></div>${schakel(!!n.melder, 'data-nk-beweging', t('functies.uit.wekken'), !mag)}</div>
    ${n.melder ? `<label class="veldnaam">${esc(t('functies.uit.welke'))}<select class="invoer" data-nk-melder ${mag ? '' : 'disabled'}>${opties}</select></label>` : ''}
    ${fullyHier(n)}
    <p class="uitleg">${esc(vanWie())}</p>
    ${alleenHoofd()}${voorDeWand()}
    <p class="mini">${esc(t('functies.uit.fully'))}</p>`;
  }

  const vorm = (id) => {
    const deel = ({ scherm, aod, uit: schermUit, startscherm: startschermVorm })[id];
    return deel ? deel() : '';
  };

  /* ------------------------------------------------------------ doen */

  /** Wat de wand doet als niemand kijkt, bewaard bij de voorkeuren van de wand. Alles samen, zodat snel tikken niets kwijtraakt. */
  let wacht = null;
  function bewaarNiemand(wat) {
    const n = { ...niemandNu(), ...wat };
    voorkeur = eigen ? { ...voorkeur, tel: { ...voorkeur?.tel, niemand: n } } : { ...voorkeur, wand: { ...voorkeur?.wand, niemand: n } };
    // De pagina krijgt het meteen, zodat opnieuw tekenen niet de oude stand terugzet.
    nieuw(voorkeur);
    teken();
    clearTimeout(wacht);
    wacht = setTimeout(async () => {
      try {
        // Van jou bij je eigen Jij (plek tel); op de wand of zonder bewoners die van de wand (stap 4 punt 2).
        const res = await app.deur('api/voorkeuren', { plek: eigen ? 'tel' : 'wand', niemand: n });
        if (res?.ok) {
          voorkeur = await res.json();
          nieuw(voorkeur);
        }
      } catch {
        // De volgende keer.
      }
    }, 300);
    return true;
  }

  /** Een tik in een blad: true als het hier hoorde. */
  function klik(knop) {
    if (!knop || knop.disabled) return false;
    // Op je startscherm: Chrome vraagt het zelf.
    if (knop.hasAttribute('data-installeer')) {
      void app.installeer().then(() => teken());
      return true;
    }
    if (knop.dataset.kopieerAdres) {
      const zeg = (s) => document.querySelectorAll('[data-kopieer-zin]').forEach((el) => (el.textContent = s));
      void navigator.clipboard?.writeText(knop.dataset.kopieerAdres).then(() => zeg(t('functies.klembord')), () => zeg(t('functies.kopieerMis')));
      return true;
    }
    if (knop.hasAttribute('data-volledig')) {
      app.zetVolledig(knop.getAttribute('aria-checked') !== 'true');
      teken();
      return true;
    }
    if (knop.hasAttribute('data-naar-ha')) return false;
    const n = niemandNu();
    if (knop.hasAttribute('data-nk-aod')) return bewaarNiemand({ rustMin: n.rustMin > 0 ? 0 : 5 });
    if (knop.dataset.nkRust) return bewaarNiemand({ rustMin: Number(knop.dataset.nkRust) });
    // Dagstand of avondstand uit: de andere neemt het over; de laatste blijft aan (besluit 168).
    if (knop.hasAttribute('data-nk-dag')) return bewaarNiemand({ dag: !n.dag });
    if (knop.hasAttribute('data-nk-avond')) return bewaarNiemand({ avond: !n.avond });
    if (knop.hasAttribute('data-nk-nacht')) return bewaarNiemand({ nacht: !n.nacht });
    if (knop.hasAttribute('data-nk-weg')) return bewaarNiemand({ weg: !n.weg });
    if (knop.dataset.nkAan) return bewaarNiemand({ aanMin: Number(knop.dataset.nkAan) });
    // Aanzetten: op de wand in Fully de eigen camera, anders de eerste melder uit het huis.
    if (knop.hasAttribute('data-nk-beweging')) return bewaarNiemand({ melder: n.melder ? null : window.fully || !bewegingsmelders().length ? 'fully' : bewegingsmelders()[0].id });
    return false;
  }

  /** Een keuzelijst, tijd of schuif losgelaten: true als het hier hoorde. */
  function verander(el) {
    if (el.matches?.('[data-nk-helder-dag]')) return bewaarNiemand({ helderDag: Math.round(Number(el.value)) });
    if (el.matches?.('[data-nk-helder-avond]')) return bewaarNiemand({ helderAvond: Math.round(Number(el.value)) });
    if (el.matches?.('[data-nk-melder]')) return bewaarNiemand({ melder: el.value });
    if (el.matches?.('[data-nk-van], [data-nk-tot]') && /^\d\d:\d\d$/.test(el.value)) return bewaarNiemand({ [el.matches('[data-nk-van]') ? 'van' : 'tot']: el.value });
    return false;
  }

  /** De helderheid: het getal loopt mee met de schuif (besluit 206). */
  function invoer(el) {
    if (el.matches?.('.nk-schuif')) el.parentElement.querySelector('[data-nk-pct]').textContent = `${el.value}%`;
  }

  return { DELEN, laad, zet, delen, titel, vorm, klik, verander, invoer };
})();
window.ditScherm = ditScherm;
