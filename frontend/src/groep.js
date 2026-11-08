/*
 * Eén opbouw voor elke groep achter het tandwiel (besluit 130; schetsen
 * Wand-Instellingen-Groep en Instellingen-Tel-Groep, besluit 163): de delen
 * van de groep als regels met een icoon, wat mist bovenaan; het deel dat je
 * kiest; waarvoor het nodig is; en onderaan door naar het vorige of volgende
 * deel. Wat je verandert, wordt meteen bewaard.
 *
 * Op de wand staan de delen links en het gekozen deel rechts, met de uitleg
 * achter "Waarvoor is dit?". Op de telefoon eerst alleen de lijst; een deel
 * opent als eigen scherm, met terug naar de groep.
 *
 * Een pagina geeft haar delen en tekent zelf het deel in `[data-vorm]` en de
 * uitleg in `[data-naast]`. Het gekozen deel staat in het adres
 * (`comfort.html#woonkamer`), zodat terug en vooruit gewoon werken.
 */
'use strict';

(function (global) {
  const { $$, esc } = global.app;
  const t = (k, p) => global.taal.t(k, p);

  const S = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  /** Per deel een icoon en zijn kleur; een kamer krijgt er een naar zijn naam. */
  const ICOON = {
    panelen: ['var(--zon)', iconen.binnen('panelen')],
    aansluiting: ['var(--ijs)', iconen.binnen('aansluiting')],
    meters: ['var(--mint)', iconen.binnen('meter')],
    prijzen: ['var(--zon)', iconen.binnen('prijzen')],
    verwarming: ['var(--gloed)', iconen.binnen('verwarming')],
    // Auto en laadpaal bij Energie (besluit 259).
    auto: ['var(--mint)', iconen.binnen('auto')],
    accu: ['var(--mint)', iconen.binnen('accu')],
    dagdelen: ['var(--ijs)', iconen.binnen('dagdelen')],
    voorrang: ['var(--violet)', iconen.binnen('voorrang')],
    // Terug naar standaard (besluit 204): een pijl die terugdraait.
    standaard: ['var(--zacht)', iconen.binnen('standaard')],
    afwezig: ['var(--zon)', iconen.binnen('afwezig')],
    klimaat: ['var(--ijs)', iconen.binnen('klimaat')],
    opzon: ['var(--zon)', iconen.binnen('opzon')],
    licht: ['var(--zon)', iconen.binnen('licht')],
    cameras: ['var(--zacht)', iconen.binnen('camera')],
    deurbel: ['var(--violet)', iconen.binnen('deurbel')],
    weer: ['var(--ijs)', iconen.binnen('weer')],
    meldingen: ['var(--gloed)', iconen.binnen('meldingen')],
    praten: ['var(--violet)', iconen.binnen('praten')],
    // Stem en luisteren (besluit 212): een luidspreker met geluid.
    stem: ['var(--mint)', iconen.binnen('stem')],
    // Te doen (besluit 216): het lijstje van de tab, sinds 0.92.0 overal hetzelfde.
    tedoen: ['var(--mint)', iconen.binnen('tedoen')],
    bewoners: ['var(--mint)', iconen.binnen('bewoners')],
    inloggen: ['var(--ijs)', iconen.binnen('inloggen')],
    scherm: ['var(--zacht)', iconen.binnen('wand')],
    // Weergave bij Functies (besluit 167): het always-on display (een scherm met een klok) en scherm uit (een maan).
    aod: ['var(--ijs)', iconen.binnen('aod')],
    uit: ['var(--violet)', iconen.binnen('uit')],
    assistent: ['var(--violet)', iconen.binnen('assistent')],
    gegevens: ['var(--mint)', iconen.binnen('gegevens')],
    versie: ['var(--zacht)', iconen.binnen('versie')],
    bed: ['var(--mint)', iconen.binnen('bed')],
    bank: ['var(--mint)', iconen.binnen('woonkamer')],
    dak: ['var(--mint)', iconen.binnen('dak')],
    kamer: ['var(--mint)', iconen.binnen('kamer')],
    // Kamers en indeling (besluit 193): de etages, buiten, en wat nog geen plek heeft of verborgen is.
    trap: ['var(--mint)', iconen.binnen('trap')],
    deur: ['var(--mint)', iconen.binnen('deur')],
    kelder: ['var(--mint)', iconen.binnen('kelder')],
    buiten: ['var(--mint)', iconen.binnen('buiten')],
    // Je huis (besluit 288): Kamers met de etage bovenin, en Apparaten indelen.
    kamers: ['var(--mint)', iconen.binnen('kamers')],
    etages: ['var(--mint)', iconen.binnen('etages')],
    apparaten: ['var(--zon)', iconen.binnen('apparaten')],
    los: ['var(--zon)', iconen.binnen('los')],
    verborgen: ['var(--zacht)', iconen.binnen('verborgen')],
  };
  function icoonVan(d) {
    const naam = (d.titel ?? '').toLowerCase();
    const sleutel = ICOON[d.icoon] ? d.icoon : ICOON[d.id] ? d.id : /slaap|logeer/.test(naam) ? 'bed' : /woon|zit/.test(naam) ? 'bank' : /zolder|boven/.test(naam) ? 'dak' : 'kamer';
    const [kleur, pad] = ICOON[sleutel];
    return `<span class="ik" style="color: ${global.app.tekstKleur(d.stand === 'mist' ? 'var(--gloed)' : kleur)}">${S(pad)}</span>`;
  }

  /** Wat mist bovenaan, binnen elk kopje; verder de volgorde van de pagina. */
  function volgorde(delen) {
    const uit = [];
    let stuk = [];
    const leeg = () => {
      uit.push(...stuk.filter((d) => d.stand === 'mist'), ...stuk.filter((d) => d.stand !== 'mist'));
      stuk = [];
    };
    for (const d of delen) {
      if (d.kop) {
        leeg();
        uit.push(d);
      } else stuk.push(d);
    }
    leeg();
    return uit;
  }

  /** Het deel uit het adres, of null. */
  function gekozen(delen) {
    const id = decodeURIComponent(location.hash.slice(1));
    return delen.some((d) => !d.kop && !d.href && d.id === id) ? id : null;
  }

  /** Het deel uit het adres, of het bovenste. */
  function actief(delen) {
    // Een deel dat naar een eigen pagina gaat (`href`, besluit 227), staat nooit open.
    return gekozen(delen) ?? volgorde(delen).find((d) => !d.kop && !d.erbij && !d.href)?.id ?? null;
  }

  let vorigNu;
  let vanLijst = false;

  /**
   * De delen: [{ id, titel, zin, stand: 'goed' | 'mist' | 'leeg', icoon }], met
   * tussenkoppen als { kop: 'Kamers' }. Een deel met `erbij` is een stippelregel
   * om iets toe te voegen, zoals "+ Etage erbij" (besluit 193): het telt niet mee
   * bij wat er mist of klaar is, en niet bij Vorige en Volgende.
   */
  function tekenDelen(delen) {
    const rij = volgorde(delen);
    const nu = actief(delen);
    const open = gekozen(delen) != null;
    // Alleen wat ontbreekt krijgt een bolletje; wat goed staat, zegt niets extra (15 oktober).
    const stip = (d) => (d.stand === 'mist' ? `<span class="stip" style="background: var(--gloed)" aria-label="${esc(t('groep.ermist'))}"></span>` : '');
    const html = rij
      .map((d) => (d.kop
        ? `<h4>${esc(d.kop)}</h4>`
        : d.erbij
          ? `<a class="deel erbij${d.id === nu ? ' nu' : ''}" href="#${encodeURIComponent(d.id)}" ${d.id === nu ? 'aria-current="page"' : ''}>${esc(d.titel)}</a>`
          : `<a class="deel${d.id === nu ? ' nu' : ''}${d.stand === 'mist' ? ' mist' : ''}" href="${d.href ? esc(d.href) : `#${encodeURIComponent(d.id)}`}" ${d.id === nu ? 'aria-current="page"' : ''}>${icoonVan(d)}<b>${esc(d.titel)}</b><span class="zin">${esc(d.zin ?? '')}</span><span class="eind">${d.nog ? `<span class="nog">${esc(d.nog)}</span>` : ''}${stip(d)}<span class="pijl" aria-hidden="true">›</span></span></a>`))
      .join('');
    $$('[data-delen]').forEach((el) => (el.innerHTML = html));

    // Bovenaan in één oogopslag hoe de groep ervoor staat.
    const echt = rij.filter((d) => !d.kop && !d.erbij);
    const mist = echt.filter((d) => d.stand === 'mist').length;
    // Alleen wat mist (besluit 227): een groen "4 klaar" naast elke kop zei niets wat je nodig had.
    const samen = mist ? `<span class="mis">${esc(t('instellingen.mist', { n: mist }))}</span>` : '';
    $$('[data-samen]').forEach((el) => (el.innerHTML = samen));
    // Geen "1 van 8" met Vorige en Volgende meer (besluit 227): doorlopen hoort bij Inrichten; hier is de lijst links de weg.
    $$('[data-verder]').forEach((el) => (el.innerHTML = ''));

    // De telefoon: eerst de lijst, een deel als eigen scherm met terug naar de groep.
    document.documentElement.classList.toggle('deel-open', open);
    const naam = document.querySelector('#tel h1')?.textContent?.trim() ?? '';
    $$('#tel [data-terug]').forEach((el) => {
      // Vanuit Inrichten terug naar die stap (besluit 227), anders naar Instellingen.
      const k = global.app.terugknop();
      el.textContent = open ? `‹ ${naam}` : t(k.sleutel);
      el.setAttribute('href', open ? location.pathname + location.search : k.href);
    });
    if (nu !== vorigNu) {
      $$('[data-waarvoor-vak].open').forEach(sluitWaarvoor);
      if (vorigNu !== undefined && global.app.telStand()) global.scrollTo(0, 0);
      vorigNu = nu;
    }
    return nu;
  }

  /* -------------------------------------------- waarvoor is dit? (de wand) */

  function sluitWaarvoor(vak) {
    vak.classList.remove('open');
    vak.querySelector('[data-waarvoor]')?.setAttribute('aria-expanded', 'false');
  }
  document.addEventListener('click', (e) => {
    const knop = e.target.closest?.('[data-waarvoor]');
    if (knop) {
      const vak = knop.closest('[data-waarvoor-vak]');
      const open = !vak.classList.contains('open');
      vak.classList.toggle('open', open);
      knop.setAttribute('aria-expanded', String(open));
      return;
    }
    // Vorige en volgende vervangen het adres: terug gaat naar de lijst, niet langs elk deel.
    const stap = e.target.closest?.('[data-stap]');
    if (stap) {
      e.preventDefault();
      location.replace(stap.getAttribute('href'));
      return;
    }
    if (e.target.closest?.('#tel [data-delen] .deel')) vanLijst = true;
    // Terug naar de groep: kwam je uit de lijst, dan gewoon een stap terug.
    const terug = e.target.closest?.('#tel [data-terug]');
    if (terug && document.documentElement.classList.contains('deel-open')) {
      e.preventDefault();
      if (vanLijst) {
        vanLijst = false;
        history.back();
      } else {
        history.replaceState(null, '', location.pathname + location.search);
        global.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest?.('[data-waarvoor-vak] .naast, [data-waarvoor]')) $$('[data-waarvoor-vak].open').forEach(sluitWaarvoor);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') $$('[data-waarvoor-vak].open').forEach(sluitWaarvoor);
  });

  /* ---------------------------------------------------- meteen bewaren */

  let wacht = null;
  let bezig = Promise.resolve();
  function zegBewaard(stand, tekst) {
    // Een bolletje alleen als het misging; anders gewoon de tekst.
    const kleur = { rust: 'var(--gedempt)', bezig: 'var(--zacht)', ok: 'var(--mint)', fout: 'var(--gloed)' }[stand];
    $$('[data-bewaard]').forEach((el) => {
      el.style.color = kleur;
      el.innerHTML = `${stand === 'fout' ? `<span class="stip" style="background: ${kleur}"></span>` : ''}${esc(tekst)}`;
    });
  }

  /**
   * Bewaart even na de laatste wijziging. `doe` stuurt en geeft
   * { ok: true } of { ok: false, fout: 'reden' }; null is "even naar de inlog".
   */
  function bewaarStraks(doe, ms = 600) {
    clearTimeout(wacht);
    zegBewaard('bezig', t('groep.bewaren'));
    wacht = setTimeout(() => {
      bezig = bezig.then(async () => {
        try {
          const uit = await doe();
          if (uit == null) return;
          if (uit.ok) zegBewaard('ok', t('groep.bewaard'));
          else zegBewaard('fout', uit.fout ?? t('groep.nietBewaard'));
        } catch {
          zegBewaard('fout', t('groep.geenVerbinding'));
        }
      });
    }, ms);
  }

  /** Stuurt een POST en vertaalt het antwoord voor `bewaarStraks`. */
  async function stuur(pad, body) {
    const res = await global.app.deur(pad, body);
    if (res === null) return null;
    const uit = await res.json().catch(() => ({}));
    if (res.status === 403) return { ok: false, fout: t('groep.beheerder') };
    if (!res.ok) return { ok: false, fout: uit.fout ?? t('groep.nietBewaard') };
    return { ok: true, antwoord: uit };
  }

  global.groep = { actief, tekenDelen, bewaarStraks, stuur, zegBewaard };
  // Bij het openen staat er wat er geldt.
  addEventListener('DOMContentLoaded', () => zegBewaard('rust', t('groep.meteen')));
})(window);
