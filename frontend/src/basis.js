/*
 * Wat elke tab van ontwerp 2 deelt (besluit 104): de wand van 800 hoog (en 1280 of breder) die
 * als geheel naar het scherm schaalt, de navigatie, de lucht van het moment,
 * de klok, ophalen, de deuren met de inlog (besluit 99) en de live-stroom.
 *
 * Een tab is een eigen pagina met een #wand en een #tel; deze basis zet de
 * stand en de navigatie, de tab tekent zijn eigen inhoud.
 */
'use strict';

(function (global) {
  /*
   * Het voorbeeldhuis (besluit 237): onder `voorbeeld/` loopt de klok van de
   * pagina mee met die van het voorbeeld (de dagschuif), en komt de balk van
   * voorbeeld.js erbij. Het verschil met de echte tijd blijft tussen pagina's
   * bewaard, zodat de klok niet eerst even de echte tijd toont.
   */
  if (/\/voorbeeld\//.test(global.location.pathname)) {
    const Echt = global.Date;
    const echtNu = Echt.now.bind(Echt);
    let verschil = 0;
    try {
      verschil = Number(JSON.parse(global.sessionStorage.getItem('sc-voorbeeld-klok') ?? 'null')?.verschil) || 0;
    } catch {}
    class VoorbeeldDate extends Echt {
      constructor(...a) {
        if (a.length === 0) super(echtNu() + verschil);
        // @ts-expect-error -- Date kent meer vormen; de echte Date krijgt wat de pagina gaf.
        else super(...a);
      }
      static now() {
        return echtNu() + verschil;
      }
    }
    global.Date = /** @type {DateConstructor} */ (/** @type {unknown} */ (VoorbeeldDate));
    global.scVoorbeeldVerschil = (nuMs) => {
      verschil = nuMs - echtNu();
      try {
        global.sessionStorage.setItem('sc-voorbeeld-klok', JSON.stringify({ verschil }));
      } catch {}
    };
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('script');
      s.src = 'voorbeeld.js';
      document.body.appendChild(s);
    });
  }

  /*
   * De overgang tussen pagina's (@view-transition in basis.css). Breekt de
   * browser die af, omdat de pagina al te zien was, dan meldt hij dat als een
   * fout die niemand opvangt (CI). Die vangen we hier: de
   * pagina staat er gewoon, alleen zonder overgang.
   */
  const vangOvergang = (e) => {
    const v = e.viewTransition;
    if (!v) return;
    for (const p of [v.ready, v.finished, v.updateCallbackDone]) p?.catch?.(() => {});
  };
  global.addEventListener('pagereveal', vangOvergang);
  global.addEventListener('pageswap', vangOvergang);

  const $$ = (sel) => [...document.querySelectorAll(sel)];
  /** Een getal in de taal van de app (besluit 185); de naam is van voor er talen waren. */
  const nl = (n, d = 1) => global.taal.getal(n, d);
  const zet = (sel, text) => $$(sel).forEach((e) => (e.textContent = text));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  /**
   * Bijna op (besluit 149): onder de drempel die de bewoner koos bij Functies,
   * per soort ('batterij' of 'filter'). Zonder huis 10%; null is nooit.
   */
  const bijnaOp = (pct, soort, huis) => {
    const d = huis?.drempels?.[soort];
    return pct != null && (d === undefined ? pct < 10 : d != null && pct < d);
  };
  const klokVan = (ms) => global.taal.klok(ms);
  /**
   * Wanneer iets was: de klok vandaag, "gisteren" met de klok, of de datum.
   * Kort (voor een melding): binnen het uur in minuten, en gisteren zonder klok.
   */
  function wanneer(ms, { kort = false } = {}) {
    const min = Math.round((Date.now() - ms) / 60_000);
    const t = global.t;
    if (kort && min < 60) return t('algemeen.minuten', { n: Math.max(1, min) });
    const d = new Date(ms);
    const vandaag = new Date();
    if (d.toDateString() === vandaag.toDateString()) return klokVan(ms);
    const gisteren = new Date(vandaag.getTime() - 86_400_000);
    if (d.toDateString() === gisteren.toDateString()) return kort ? t('algemeen.gisteren') : t('algemeen.gisterenOm', { klok: klokVan(ms) });
    return global.taal.datum(d, { day: 'numeric', month: 'long' });
  }

  /* Waar de tabs staan: tot ze in ontwerp 2 zijn, in de proefomgeving. */
  const LINKS = {
    thuis: 'thuis.html',
    vandaag: 'vandaag.html',
    tedoen: 'tedoen.html',
    apparaten: 'apparaten.html',
    opbrengst: 'opbrengst.html',
    assistent: 'assistent.html',
    instellingen: 'instellingen.html',
  };

  /**
   * De telefoonweergave alleen staand, of op een heel smal scherm. Een telefoon
   * die ligt, krijgt de wand van de tablet, verkleind tot hij past. Dezelfde
   * regel staat in het script in de <head> van elke pagina.
   */
  function telStand() {
    return innerHeight > innerWidth || innerWidth < 560;
  }

  /** De stand en de schaal, op <html>; het script in de <head> deed dit al vóór de eerste weergave. */
  /** Een onzichtbaar vak om de inkeping van een telefoon te meten (safe-area). */
  let peil = null;
  function inzet() {
    if (!peil) {
      peil = document.createElement('div');
      peil.setAttribute('aria-hidden', 'true');
      peil.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
      document.documentElement.append(peil);
    }
    const s = getComputedStyle(peil);
    // Boven en onder ook (besluit 129): op een liggende telefoon tekent de browser
    // tot onder de balk met de veegstreep, en daar viel de onderkant van de wand weg.
    return { l: parseFloat(s.paddingLeft) || 0, r: parseFloat(s.paddingRight) || 0, t: parseFloat(s.paddingTop) || 0, b: parseFloat(s.paddingBottom) || 0 };
  }

  /**
   * Het schermtoetsenbord (besluit 124): komt het in beeld, dan wordt het scherm
   * even hoog als wat erboven overblijft. Dat is geen nieuwe stand: de wand
   * houdt zijn maat, en schuift alleen omhoog tot het veld waarin je typt
   * zichtbaar is. Gaat het toetsenbord weg, dan staat alles weer op zijn plek.
   */
  let maat = { w: 0, h: 0 };
  const typt = () => /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '');
  function toetsenbord() {
    const d = document.documentElement;
    const veld = document.activeElement;
    if (telStand() || !typt() || !veld?.closest?.('#wand')) {
      d.style.setProperty('--toetsschuif', '0px');
      return;
    }
    const zicht = global.visualViewport?.height ?? innerHeight;
    const r = veld.getBoundingClientRect();
    const nu = parseFloat(getComputedStyle(d).getPropertyValue('--toetsschuif')) || 0;
    const nodig = Math.max(0, r.bottom + nu + 12 - zicht);
    d.style.setProperty('--toetsschuif', `${Math.round(nodig)}px`);
  }

  function schaal() {
    const d = document.documentElement;
    // Een toetsenbord: zelfde breedte, minder hoog, en je typt. Dan niets herschalen.
    if (maat.w === innerWidth && innerHeight < maat.h && typt()) {
      toetsenbord();
      return;
    }
    maat = { w: innerWidth, h: innerHeight };
    d.style.setProperty('--toetsschuif', '0px');
    d.classList.toggle('tel-stand', telStand());
    // Een liggende telefoon heeft een inkeping aan de zijkant: de wand blijft ernaast.
    const { l, r, t, b } = inzet();
    const vrij = innerWidth - l - r;
    const hoog = innerHeight - t - b;
    // Een breder scherm dan 16:10 (een tablet zonder de balken van het systeem):
    // de wand groeit mee in de breedte, de hoogte blijft 800. Zo vult hij het scherm.
    const breed = Math.min(1700, Math.max(1280, Math.round((800 * vrij) / hoog)));
    d.style.setProperty('--wandbreedte', `${breed}px`);
    d.style.setProperty('--wandschaal', String(Math.min(vrij / breed, hoog / 800)));
    d.style.setProperty('--wandmidden', `${(l - r) / 2}px`);
    d.style.setProperty('--wandmiddenY', `${(t - b) / 2}px`);
  }

  /**
   * Wat nu onderweg is, per pad: Thuis vroeg bij het openen
   * vier keer tegelijk om api/voorkeuren en drie keer om api/bewoners. Wie
   * hetzelfde vraagt terwijl het onderweg is, wacht op dat antwoord en krijgt
   * een eigen kopie; daarna vraagt de volgende weer vers.
   */
  const onderweg = new Map();
  function haal(pad) {
    let p = onderweg.get(pad);
    if (!p) {
      p = haalVers(pad).finally(() => onderweg.delete(pad));
      onderweg.set(pad, p);
    }
    return p.then((x) => structuredClone(x));
  }
  async function haalVers(pad, opnieuw = false) {
    let res;
    try {
      // De taal van de app (besluit 185): de dienst zet zijn uitleg in die taal.
      res = await fetch(pad, { cache: 'no-store', headers: { 'x-taal': global.taal.code } });
    } catch (fout) {
      // Geen antwoord van de NAS: de laatste stand blijft, grijs (besluit 82).
      offline();
      throw fout;
    }
    online();
    // De toegang van Home Assistant verliep: vernieuwen en nog eens.
    if (ingressDicht(res)) {
      if (!opnieuw && (await verseToegang())) return haalVers(pad, true);
      throw new Error(`${pad}: Home Assistant laat even niet door`);
    }
    // Niet (meer) ingelogd (besluit 147): naar het inloggen, met de weg terug naar deze pagina.
    if (res.status === 401) {
      location.href = `inloggen.html?terug=${encodeURIComponent(location.pathname + location.hash)}`;
      throw new Error(`${pad}: log eerst in`);
    }
    if (!res.ok) throw new Error(`${pad}: ${res.status}`);
    return res.json();
  }

  /*
   * Zonder verbinding (besluit 82): de pagina houdt de laatste stand, grijs, met
   * sinds wanneer. De regeling draait op de NAS gewoon door; alleen deze pagina
   * hoort niets meer. Komt er weer antwoord, dan is het weg.
   */
  let wegSinds = null;
  function offline(sinds = Date.now()) {
    if (wegSinds != null) return;
    wegSinds = sinds;
    document.body.classList.add('offline');
    const balk = document.createElement('div');
    balk.className = 'geenverbinding';
    balk.setAttribute('role', 'status');
    balk.textContent = global.t('basis.offline', { klok: klokVan(sinds) });
    document.body.append(balk);
  }
  function online() {
    if (wegSinds == null) return;
    wegSinds = null;
    document.body.classList.remove('offline');
    document.querySelector('.geenverbinding')?.remove();
  }

  /**
   * Een deur van de dienst (POST). Zonder inlog stuurt de dienst 401; dan naar
   * de inlog van Home Assistant, en daarna terug naar deze plek (besluit 99).
   */
  async function deur(pad, body, opnieuw = false) {
    const res = await fetch(pad, { method: 'POST', headers: { 'content-type': 'application/json', 'x-taal': global.taal.code }, body: JSON.stringify(body) });
    if (ingressDicht(res)) return !opnieuw && (await verseToegang()) ? deur(pad, body, true) : res;
    if (res.status === 401) {
      location.href = `auth/login?terug=${encodeURIComponent(location.pathname + location.hash)}`;
      return null;
    }
    return res;
  }

  /** Dag, ochtend, avond of nacht, uit de zon van de dienst (`api/zon`). */
  function tijdVanDeDag(zon) {
    const d = zon?.dag;
    // Geen zonnestand van de dienst: dan de klok, in plaats van altijd nacht.
    if (!zon?.zon) {
      const u = new Date().getHours();
      return u >= 7 && u < 9 ? 'ochtend' : u >= 9 && u < 18 ? 'dag' : u >= 18 && u < 21 ? 'avond' : 'nacht';
    }
    if (!zon.zon.boven) {
      const na = d?.onderMs != null ? Date.now() - d.onderMs : Infinity;
      const voor = d?.opMs != null ? d.opMs - Date.now() : Infinity;
      if ((na > 0 && na < 60 * 60_000) || (voor > 0 && voor < 45 * 60_000)) return na < Infinity && na > 0 ? 'avond' : 'ochtend';
      return 'nacht';
    }
    if (d?.fractie < 0.1) return 'ochtend';
    if (d?.fractie > 0.9) return 'avond';
    return 'dag';
  }

  /**
   * Het seizoen van nu (besluit 187), voor elke pagina hetzelfde: kale bomen van
   * december tot en met februari, oranje in oktober en november. Eerder rekende
   * elke pagina zelf, en stond november bij de etages al op winter.
   */
  function seizoenNu(datum = new Date()) {
    const maand = datum.getMonth() + 1;
    return maand === 12 || maand <= 2 ? 'winter' : maand >= 10 ? 'herfst' : 'zomer';
  }

  function lucht(tijd, seizoen, wolken) {
    const b = document.body.classList;
    for (const c of [...b]) if (c.startsWith('lucht-')) b.remove(c);
    b.add(seizoen === 'winter' && tijd !== 'nacht' ? 'lucht-winter' : tijd === 'nacht' ? 'lucht-nacht' : tijd === 'avond' ? 'lucht-avond' : tijd === 'ochtend' ? 'lucht-ochtend' : wolken > 0.6 ? 'lucht-bewolkt' : 'lucht-dag');
    luchtAchterVak();
  }

  /**
   * In Home Assistant laadt een andere pagina in het vak van het paneel, en
   * tot die er staat is het vak leeg: zwart op de tablet, langer dan op de
   * NAS omdat alles via Home Assistant komt. Het vak krijgt de lucht van nu
   * als achtergrond, zodat je die ziet in plaats van zwart.
   */
  function luchtAchterVak() {
    try {
      const vak = inHA() ? global.frameElement : null;
      if (!vak) return;
      vak.style.backgroundColor = getComputedStyle(document.body).backgroundColor;
      vak.style.backgroundImage = getComputedStyle(document.body, '::before').backgroundImage;
    } catch {
      // Een vak van een andere herkomst: dan niets.
    }
  }

  /** De lucht van nu, voor een tab zonder huis: uit de zon en wat de panelen leveren. */
  function luchtVan(zon, zonKw) {
    const helder = zon?.heldereLuchtW ?? 0;
    const wolken = zon?.zon?.boven && helder > 300 ? (zonKw * 1000 < helder * 0.35 ? 0.8 : zonKw * 1000 < helder * 0.7 ? 0.4 : 0.1) : 0.3;
    lucht(tijdVanDeDag(zon), seizoenNu(), wolken);
  }

  function klok() {
    const nu = new Date();
    zet('[data-tijd]', klokVan(nu));
    zet('[data-datum]', global.taal.datum(nu, { weekday: 'long', day: 'numeric', month: 'long' }));
  }

  /**
   * De stippellijn bij de zon van vandaag (besluit 105): de verwachting uit het
   * weer en wat de panelen leerden, en zonder weer de zon bij een heldere lucht.
   */
  function verwachting(zon, weer) {
    const kw = weer?.vandaag?.kwartieren ?? [];
    if (kw.length) return { punten: kw.map((q) => ({ tMs: q.tMs, w: q.verwachtW })), naam: global.t('algemeen.verwachting') };
    return { punten: (zon?.kwartieren ?? []).map((q) => ({ tMs: q.tMs, w: q.heldereLuchtW ?? 0 })), naam: global.t('algemeen.heldereLucht') };
  }

  /** Eén live-stroom per pagina: de besluiten, en de deurbel (besluit 107). */
  let bron = null;
  let opLive = null;
  function stroom() {
    if (bron) return bron;
    try {
      bron = new EventSource(`api/events?taal=${global.taal.code}`);
      if (opLive) bron.onmessage = opLive;
      // Valt de stroom weg en komt hij niet snel terug, dan zonder verbinding.
      let wacht = null;
      let wasWeg = false;
      const deze = bron;
      deze.addEventListener('error', () => {
        wasWeg = true;
        const toen = Date.now();
        clearTimeout(wacht);
        wacht = setTimeout(() => deze.readyState !== EventSource.OPEN && offline(toen), 15_000);
        // Dicht en niet vanzelf terug (een 401 van Home Assistant):
        // de toegang vernieuwen en zelf opnieuw verbinden.
        if (deze.readyState === EventSource.CLOSED && bron === deze) {
          bron = null;
          setTimeout(() => void verseToegang().finally(() => stroom()), 5_000);
        }
      });
      deze.addEventListener('open', () => {
        clearTimeout(wacht);
        online();
        // Terug na een onderbreking: wat er intussen veranderde, haalt de pagina nu op.
        if (wasWeg) {
          for (const soort of ['huis', 'bewoners']) signaal(soort, true);
          void meldLaad();
        }
        wasWeg = false;
      });
      // Het huis of wie er thuis is veranderde: de pagina haalt het op.
      for (const soort of ['huis', 'bewoners']) {
        deze.addEventListener(soort, (ev) => {
          let snel = true;
          try {
            snel = JSON.parse(ev.data).snel !== false;
          } catch {
            // Een half bericht: dan maar meteen.
          }
          signaal(soort, snel);
        });
      }
      // Een nieuwe melding, of een die weg is: meteen bij de bel.
      deze.addEventListener('meldingen', () => void meldLaad());
      // De gekozen bewegingsmelder ziet iemand (besluit 164): de wand wordt wakker.
      deze.addEventListener('wekken', () => dispatchEvent(new CustomEvent('sc-wek', { detail: 'beweging' })));
      // Een rookmelder ziet iets, of niet meer.
      deze.addEventListener('alarm', (ev) => {
        try {
          alarm(JSON.parse(ev.data));
        } catch {
          // Een half bericht.
        }
      });
      deze.addEventListener('aanbellen', (ev) => {
        try {
          aanbellen(JSON.parse(ev.data));
        } catch {
          // Een half bericht.
        }
      });
    } catch {
      // Geen EventSource: het verversen per minuut doet het werk.
    }
    return bron;
  }

  /*
   * Het huis en wie er thuis is, live. De dienst zegt het als
   * er iets veranderde; de pagina haalt het dan op, alleen als ze in beeld is.
   * Wat je bedient of ziet bewegen meteen; een temperatuur of verbruik dat
   * verschuift hooguit eens per `rustig`, zoals de pagina het eerst zelf vroeg.
   */
  const bijSoort = new Map();
  function signaal(soort, snel) {
    for (const a of bijSoort.get(soort) ?? []) a(snel);
  }
  function bijVerandering(soort, opnieuw, { rustig = 15_000 } = {}) {
    let laatst = Date.now();
    let bezig = false;
    let nogEens = false;
    let later = null;
    let verborgen = false;
    const haalOp = async () => {
      clearTimeout(later);
      later = null;
      if (bezig) return void (nogEens = true);
      bezig = true;
      laatst = Date.now();
      try {
        await opnieuw();
      } catch {
        // Dan de volgende keer.
      } finally {
        bezig = false;
        if (nogEens) {
          nogEens = false;
          void haalOp();
        }
      }
    };
    const prik = (snel) => {
      if (document.visibilityState !== 'visible') return void (verborgen = true);
      if (snel || Date.now() - laatst >= rustig) return void haalOp();
      later ??= setTimeout(() => void haalOp(), laatst + rustig - Date.now());
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && verborgen) {
        verborgen = false;
        void haalOp();
      }
    });
    bijSoort.set(soort, [...(bijSoort.get(soort) ?? []), prik]);
  }

  /*
   * Op je startscherm. Chrome biedt het installeren aan met
   * `beforeinstallprompt`, alleen over https en buiten Home Assistant; dat
   * bewaren we, zodat de knop bij Functies › Weergave het kan vragen.
   */
  let installeerVraag = null;
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installeerVraag = e;
    dispatchEvent(new Event('sc-installeer'));
  });
  addEventListener('appinstalled', () => {
    installeerVraag = null;
    dispatchEvent(new Event('sc-installeer'));
  });
  const kanInstalleren = () => installeerVraag != null;
  const geinstalleerd = () => global.matchMedia?.('(display-mode: standalone)').matches === true || /** @type {any} */ (global.navigator).standalone === true;
  async function installeer() {
    const vraag = installeerVraag;
    if (!vraag) return false;
    installeerVraag = null;
    await vraag.prompt();
    const keuze = await vraag.userChoice.catch(() => null);
    dispatchEvent(new Event('sc-installeer'));
    return keuze?.outcome === 'accepted';
  }

  /** De live-stroom van besluiten; zonder valt de tab terug op verversen per minuut. */
  function live(opState) {
    opLive = (ev) => {
      try {
        opState(JSON.parse(ev.data));
      } catch {
        // Een half bericht: de volgende komt zo.
      }
    };
    const b = stroom();
    if (b) b.onmessage = opLive;
  }

  /*
   * Rook, koolmonoxide of hitte (schets Wand-Rook): op elke
   * pagina, zoals aanbellen, rood en schermvullend, met de kamer en wat de
   * andere melders zien. Sluiten haalt het weg tot een melder iets nieuws ziet;
   * ziet niemand meer iets, dan gaat het vanzelf weg. SunArc zet het
   * alarm zelf niet uit: dat doe je op de melder.
   */
  /** Wat een melder ziet: rook, co of hitte; als kop en in een zin (teksten.*.js). */
  const GEVAAR = (g) => global.t(`basis.alarm.gevaar.${g}`);
  const WAT = (g) => global.t(`basis.alarm.wat.${g}`);
  let alarmGesloten = '';
  function alarm(m) {
    const aan = (m.melders ?? []).filter((x) => x.gevaar);
    const sleutel = aan.map((x) => `${x.id}:${x.gevaar}`).join('|');
    let laag = document.querySelector('.alarmlaag');
    if (!aan.length || sleutel === alarmGesloten) {
      if (!aan.length) alarmGesloten = '';
      laag?.remove();
      return;
    }
    dispatchEvent(new CustomEvent('sc-wek', { detail: 'alarm' }));
    try {
      global.fully?.turnScreenOn?.();
      global.fully?.bringToForeground?.();
    } catch {
      // Geen Fully Kiosk.
    }
    if (!laag) {
      laag = document.createElement('div');
      laag.className = 'alarmlaag';
      laag.setAttribute('role', 'alertdialog');
      laag.addEventListener('click', (e) => {
        if (!e.target.closest('[data-alarm-dicht]')) return;
        alarmGesloten = laag.dataset.sleutel;
        laag.remove();
      });
      document.body.append(laag);
    }
    laag.dataset.sleutel = sleutel;
    const eerste = aan[0];
    const kamers = [...new Set(aan.filter((x) => x.gevaar === eerste.gevaar).map((x) => metLidwoord(x.kamer)))];
    const waar = kamers.length > 1 ? `${kamers.slice(0, -1).join(', ')} ${global.t('algemeen.en')} ${kamers.at(-1)}` : kamers[0];
    const titel = global.t('basis.alarm.titel', { gevaar: GEVAAR(eerste.gevaar), waar });
    const raad = global.t(eerste.gevaar === 'co' ? 'basis.alarm.raadCo' : 'basis.alarm.raad');
    const ziet = eerste.sindsMs ? global.t('basis.alarm.zietSinds', { kamer: metLidwoord(eerste.kamer), wat: WAT(eerste.gevaar), klok: klokVan(eerste.sindsMs) }) : global.t('basis.alarm.ziet', { kamer: metLidwoord(eerste.kamer), wat: WAT(eerste.gevaar) });
    laag.setAttribute('aria-label', titel);
    laag.innerHTML = `<div class="alarm-in">
      <span class="alarm-puls" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 20c-2.5 0-4-1.8-4-3.8 0-2.6 2.4-3.4 2.4-6.2 2 1 3 2.8 3 4.4.6-.8 1-2 1-3.4 2.4 1.4 4.6 3.6 4.6 6.6 0 1.7-1.3 2.4-2 2.4"/><path d="M14 6c1-1 1-2.5 0-3.5M18 8c1-1 1-2.5 0-3.5"/></svg></span>
      <h1>${esc(titel)}</h1>
      <p class="alarm-zin">${esc(`${ziet} ${raad}`)}</p>
      <div class="alarm-lijst">${(m.melders ?? []).map((x) => `<div><b>${esc(x.kamer)}</b><span class="${x.gevaar ? '' : 'ok'}">${esc(x.gevaar ? WAT(x.gevaar) : global.t('w.niets'))}</span></div>`).join('')}</div>
      <button type="button" class="knop knop-licht" data-alarm-dicht>${esc(global.t('algemeen.sluiten'))}</button>
      <p class="alarm-klein">${esc(global.t('basis.alarm.uitzetten'))}</p>
    </div>`;
    laag.querySelector('[data-alarm-dicht]').focus();
  }

  /*
   * Er wordt aangebeld (besluit 107): het beeld van de deurbel schermvullend,
   * op elke pagina, en na de ingestelde tijd weer weg (besluit 109). In Fully Kiosk Browser gaat
   * ook het scherm aan; een gewone browser kan dat niet.
   */
  let belTimer = null;
  function aanbellen(m) {
    // Een wand in de nachtstand of in rust wordt wakker (besluit 164).
    dispatchEvent(new CustomEvent('sc-wek', { detail: 'bel' }));
    // Het scherm aan, als dat zo is ingesteld (besluit 109); kan alleen in Fully Kiosk.
    if (m.schermAan !== false) {
      try {
        global.fully?.turnScreenOn?.();
        global.fully?.bringToForeground?.();
      } catch {
        // Geen Fully Kiosk.
      }
    }
    /** De laag van de deurbel, met de camera die hij nu toont. @type {(HTMLElement & { camera?: any }) | null} */
    let laag = document.querySelector('.aanbel');
    if (!laag) {
      laag = document.createElement('div');
      laag.className = 'aanbel';
      laag.setAttribute('role', 'dialog');
      laag.setAttribute('aria-label', m.titel ?? global.t('basis.bel.titel'));
      laag.addEventListener('click', (e) => {
        if (e.target.closest('[data-bel-dicht]')) sluitBel();
        // Een andere camera kiezen (besluit 201): dat beeld groot, de rij blijft.
        const w = e.target.closest('[data-bel-wissel]');
        const m0 = laag.camera;
        if (w && m0?.andere) {
          const a = m0.andere[Number(w.dataset.belWissel)];
          if (a) aanbellen({ ...m0, camera: a.camera, reserve: a.reserve, naam: a.naam, zin: a.zin, voorrang: a.voorrang });
        }
      });
      document.body.append(laag);
    }
    // Belt er opnieuw iemand terwijl het beeld er staat: eerst het oude beeld stoppen.
    stopBeelden(laag);
    laag.camera = m;
    // Van de kaart Camera's (besluit 201): de regel van de camera, en de andere camera's eronder om te wisselen.
    const onder = m.zin ? `${esc(m.naam ?? '')} · ${esc(m.zin)}` : `${esc(m.naam ?? global.t('w.deurbel'))}, ${klokVan(m.tMs ?? Date.now())}`;
    const rij = Array.isArray(m.andere) && m.andere.length > 1
      ? `<div class="aanbel-rij" role="group" aria-label="${esc(global.t('basis.bel.andere'))}">${m.andere.map((a, i) => `<button type="button" data-bel-wissel="${i}" aria-pressed="${a.camera === m.camera}">${a.plaatje ? `<img alt="" src="${a.plaatje}">` : ''}<span>${esc(a.naam)}</span></button>`).join('')}</div>`
      : '';
    laag.innerHTML = `<div class="aanbel-kop"><span class="bol adem" style="width: 34px; height: 34px"></span><div><b>${esc(m.titel ?? global.t('basis.bel.titel'))}</b><span>${onder}</span></div><button type="button" class="knop" data-bel-dicht>${esc(global.t('algemeen.sluiten'))}</button></div>
      <div class="aanbel-beeld"><p class="zacht">${esc(global.t('basis.bel.komt'))}</p></div>${rij}`;
    void belBeeld(laag, [m.camera, ...(Array.isArray(m.reserve) ? m.reserve : [])], m.naam ?? global.t('thuis.deurbel.deDeurbel'), m.voorrang !== false);
    laag.querySelector('[data-bel-dicht]').focus();
    clearTimeout(belTimer);
    belTimer = setTimeout(sluitBel, Math.max(30, Math.min(600, Number(m.seconden) || 120)) * 1000);
  }
  /*
   * Het beeld van de deurbel, zoals in Kamer: eerst een
   * plaatje, dan het live beeld eroverheen zodra dat er is. Eerst wachtte de
   * laag alleen op het live beeld, en bleef hij zwart als dat niet kwam,
   * terwijl dezelfde camera in Kamer meteen beeld gaf. Geeft een beeld geen
   * plaatje, dan het volgende beeld van dezelfde camera; komt live niet, dan
   * elke seconde een nieuw plaatje.
   */
  let belVers = null;
  /** Het live beeld dat nog laadt; buiten de pagina, dus apart stoppen. */
  let belStroom = null;
  /** Het live beeld opnieuw starten, bijvoorbeeld als het scherm net aanging. */
  let belOpnieuw = null;
  /*
   * Meteen het vloeiende beeld: het live beeld start tegelijk
   * met het plaatje, niet erna, en met voorrang (`bel=1`): telefoons met een
   * camera open tellen dan niet mee in de grens van vier. Valt het weg of komt
   * het niet, dan opnieuw; tot dan na anderhalve tel elke seconde een vers
   * plaatje. Gaat het scherm net aan (een tablet die sliep), dan begint het
   * live beeld opnieuw: de oude stroom is dan dood.
   */
  async function belBeeld(laag, ids, naam, voorrang = true) {
    const vak = laag.querySelector('.aanbel-beeld');
    let live = false;
    let id = encodeURIComponent(ids[0]);
    let pogingen = 0;
    const startLive = () => {
      if (!laag.isConnected) return;
      belStroom?.removeAttribute('src');
      const stroom = new Image();
      belStroom = stroom;
      live = false;
      stroom.alt = global.t('basis.bel.liveVan', { naam });
      stroom.onload = () => {
        if (!laag.isConnected || belStroom !== stroom) return void stroom.removeAttribute('src');
        live = true;
        const nu = vak.querySelector('img');
        if (nu && nu !== stroom) nu.replaceWith(stroom);
        else if (!nu) vak.replaceChildren(stroom);
      };
      stroom.onerror = () => {
        if (belStroom !== stroom || !laag.isConnected || pogingen >= 4) return;
        pogingen += 1;
        setTimeout(startLive, 1500);
      };
      // Voorrang alleen voor de deurbel; een andere camera telt mee in de grens van vier live beelden.
      stroom.src = `api/camera?id=${id}&live=1${voorrang ? '&bel=1' : ''}&t=${Date.now()}`;
    };
    belOpnieuw = () => {
      pogingen = 0;
      startLive();
    };
    startLive();
    let res = null;
    for (const kandidaat of ids) {
      id = encodeURIComponent(kandidaat);
      res = await fetch(`api/camera?id=${id}`, { cache: 'no-store' }).catch(() => null);
      if (!laag.isConnected) return;
      if (res?.ok || res?.status === 401) break;
    }
    if (!res?.ok) {
      if (live) return;
      vak.innerHTML = res?.status === 401
        ? `<p>${esc(global.t('basis.bel.inloggen'))} <a href="auth/login?terug=${encodeURIComponent(location.pathname + location.hash)}">${esc(global.t('w.inloggen'))}</a></p>`
        : `<p>${esc(global.t('basis.bel.geenBeeld'))}</p>`;
      return;
    }
    // Het eerste beeld gaf niets: het live beeld van het beeld dat wel werkt.
    if (id !== encodeURIComponent(ids[0])) startLive();
    const url = URL.createObjectURL(await res.blob());
    if (!laag.isConnected) return URL.revokeObjectURL(url);
    // Is het live beeld er al, dan het plaatje niet eroverheen.
    if (!live) vak.innerHTML = `<img alt="${esc(global.t('w.beeldVan', { naam }))}" src="${url}">`;
    else URL.revokeObjectURL(url);
    clearInterval(belVers);
    let bezig = false;
    setTimeout(() => {
      if (live || !laag.isConnected) return;
      belVers = setInterval(async () => {
        if (live || bezig || !laag.isConnected) return;
        const img = vak.querySelector('img');
        if (!img || img === belStroom) return;
        bezig = true;
        const r = await fetch(`api/camera?id=${id}`, { cache: 'no-store' }).catch(() => null);
        bezig = false;
        if (!r?.ok || live || !laag.isConnected || !img.isConnected) return;
        const oud = img.src;
        img.src = URL.createObjectURL(await r.blob());
        URL.revokeObjectURL(oud);
      }, 1000);
    }, 1500);
  }
  // Het scherm gaat aan terwijl het beeld er staat: het live beeld opnieuw.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && document.querySelector('.aanbel')) belOpnieuw?.();
  });
  function sluitBel() {
    clearTimeout(belTimer);
    clearInterval(belVers);
    const laag = document.querySelector('.aanbel');
    if (laag) stopBeelden(laag);
    laag?.remove();
  }
  /** Zonder bron stopt de stroom; alleen weghalen laat hem soms doorlopen. */
  function stopBeelden(laag) {
    clearInterval(belVers);
    belStroom?.removeAttribute('src');
    belStroom = null;
    belOpnieuw = null;
    laag.querySelectorAll('img').forEach((img) => img.removeAttribute('src'));
  }

  /**
   * Tekenen, gebundeld: hoe vaak er ook om gevraagd wordt (een klik, de
   * live-stroom, een verversing), hooguit één keer per beeld. Zonder dit liep
   * de pagina vast bij snel klikken: elke klik tekende het hele huis opnieuw.
   */
  function gebundeld(fn) {
    let gepland = false;
    return () => {
      if (gepland) return;
      gepland = true;
      requestAnimationFrame(() => {
        gepland = false;
        fn();
      });
    };
  }

  /**
   * Veel bronnen tegelijk, en tekenen zodra er iets is: eerst
   * als de bronnen in `eerst` er zijn, daarna opnieuw bij elke bron die
   * binnenkomt. Eén trage bron houdt zo nooit meer de hele pagina tegen. Een
   * bron die niet antwoordt, houdt wat hij de vorige keer gaf.
   */
  async function laadBronnen(deuren, d, teken, eerst = []) {
    let getekend = false;
    const een = (k) =>
      haal(deuren[k])
        .then((v) => {
          d[k] = v;
        }, () => undefined)
        .then(() => {
          if (getekend) teken();
        });
    const alle = Object.fromEntries(Object.keys(deuren).map((k) => [k, een(k)]));
    await Promise.all(eerst.filter((k) => k in alle).map((k) => alle[k]));
    getekend = true;
    teken();
    await Promise.all(Object.values(alle));
  }

  /** Welke stand er te zien is: '#wand' of '#tel'. Alleen die wordt getekend. */
  const zicht = () => (telStand() ? '#tel' : '#wand');

  /**
   * Een gast verandert geen instellingen (besluit 151). De dienst weigert het
   * al; hier ziet hij het ook: een instellingenpagina gaat terug naar
   * Instellingen, die hem alleen Bewoners en toegang laat zien (om uit te
   * loggen) en Wat je huis kan.
   */
  async function gastGrens() {
    const pagina = location.pathname.split('/').pop() || '';
    if (['instellingen.html', 'toegang.html', 'huis-kan.html'].includes(pagina)) return;
    const ik = await haal('api/bewoners').then((b) => b.ik, () => null);
    if (ik?.soort === 'gast') location.replace('instellingen.html');
  }

  /*
   * Volledig scherm in Home Assistant (besluit 155), per apparaat.
   *
   * Achter Ingress staat de app in een paneel van Home Assistant, met de
   * zijbalk en een kopbalk eromheen. Home Assistant kent zelf een kioskstand
   * voor een app: die vraagt de app met een bericht (`subscribe-properties`
   * met `kioskMode`), en het paneel zet hem zelf weer uit als je het verlaat.
   * Een andere pagina van de app laat hem staan. Voor de balken van de
   * browser zelf vraagt de app het hele scherm, op het document van Home
   * Assistant: dat blijft staan als de app een andere pagina laadt. Dat mag
   * alleen na een tik, dus bij de eerste.
   *
   * De keuze staat in dit apparaat (localStorage). Standaard aan (25 oktober
   * 2026, besluit 202): zo voelt de app van Home Assistant als een eigen app;
   * de rondleiding wijst de knop terug naar Home Assistant. Uit is '0'.
   */
  const VOLLEDIG = 'sc-volledig-scherm';
  const inHA = () => global.parent !== global && /^\/api\/hassio_ingress\//.test(location.pathname);

  /*
   * De toegang via Home Assistant. In Home Assistant opent
   * de app via ingress, met een sessie die na een tijd verloopt; Home
   * Assistant houdt hem elke minuut vast. Sliep de tablet aan de wand, dan
   * verliep hij toch, en gaf de eerstvolgende vraag 401 van Home Assistant
   * zelf. De app dacht dat je moest inloggen en ging naar de inlogpagina, en
   * ook die weigerde Home Assistant: "401: Unauthorized" tot iemand ververste.
   * Nu houdt de app de sessie zelf ook vast, vernieuwt hij hem bij zo'n 401
   * en vraagt hij het opnieuw. Een 401 van de dienst zelf is JSON, en gaat
   * nog steeds naar het inloggen.
   */
  const SESSIE = 'ingress_session';
  function haHass() {
    try {
      return /** @type {any} */ (global.parent.document.querySelector('home-assistant'))?.hass ?? null;
    } catch {
      return null;
    }
  }
  const sessieNu = () => document.cookie.split('; ').find((c) => c.startsWith(`${SESSIE}=`))?.slice(SESSIE.length + 1) ?? null;
  /** Een 401 van Home Assistant zelf, niet van de dienst: dan is de sessie verlopen. */
  const ingressDicht = (res) => res.status === 401 && inHA() && !(res.headers.get('content-type') ?? '').includes('json');
  let verversen = null;
  /** Een nieuwe sessie bij Home Assistant, zoals het paneel van Home Assistant dat doet. */
  function verseToegang() {
    if (!inHA()) return Promise.resolve(false);
    verversen ??= (async () => {
      const hass = haHass();
      if (!hass?.callWS) return false;
      try {
        const r = await hass.callWS({ type: 'supervisor/api', endpoint: '/ingress/session', method: 'post' });
        if (!r?.session) return false;
        document.cookie = `${SESSIE}=${r.session};path=/api/hassio_ingress/;SameSite=Strict${location.protocol === 'https:' ? ';Secure' : ''}`;
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => (verversen = null), 0);
      }
    })();
    return verversen;
  }
  /** De sessie vasthouden: nog geldig, dan langer; anders een nieuwe. Elke minuut, en voor een nieuwe pagina. */
  async function houToegang() {
    if (!inHA()) return true;
    const hass = haHass();
    const s = sessieNu();
    if (!hass?.callWS) return false;
    if (s) {
      try {
        await hass.callWS({ type: 'supervisor/api', endpoint: '/ingress/validate_session', method: 'post', data: { session: s } });
        return true;
      } catch {
        // Verlopen: een nieuwe.
      }
    }
    return verseToegang();
  }
  if (inHA()) {
    setInterval(() => document.visibilityState === 'visible' && void houToegang(), 60_000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void houToegang());
    addEventListener('online', () => void houToegang());
  }
  function volledigGekozen() {
    try {
      return localStorage.getItem(VOLLEDIG) !== '0';
    } catch {
      return true;
    }
  }
  /*
   * Naar Home Assistant zet het volledige scherm even uit: je blijft in de app,
   * met de zijbalk en de kopbalk van Home Assistant, en kiest daar zelf waar je
   * heen gaat. Dat geldt voor dit paneel; de volgende keer dat je de app opent
   * (een nieuw vak), of met dezelfde knop, is het er weer. Het onthouden staat
   * bij Home Assistant, want het vak laadt bij elke pagina opnieuw.
   */
  const PAUZE = '__scVolledigPauze';
  function gepauzeerd() {
    try {
      return !!global.frameElement && global.parent[PAUZE] === global.frameElement;
    } catch {
      return false;
    }
  }
  const volledigNu = () => inHA() && volledigGekozen() && !gepauzeerd();
  /** Een bericht aan het paneel van Home Assistant om de app heen; alleen naar dezelfde herkomst. */
  const aanHA = (bericht) => global.parent.postMessage(bericht, location.origin);
  /** Het document van Home Assistant, als het mag; anders null. */
  function haDocument() {
    try {
      return global.parent.document;
    } catch {
      return null;
    }
  }
  /**
   * Een telefoon krijgt nooit het hele scherm van de browser, alleen de
   * kioskstand: dan ziet hij eruit als de app van de NAS, met de statusbalk
   * erboven. Met het hele scherm schoof de statusbalk na de terugknop over de
   * pagina, of was hij er op de ene pagina wel en op de andere niet. Een
   * telefoon is een scherm met een kortste kant onder 600, ook liggend.
   */
  const isTelefoon = () => Math.min(global.screen?.width ?? 0, global.screen?.height ?? 0) < 600;
  function heelScherm(e) {
    // De eerste tik is Naar Home Assistant: dan juist niet.
    if (e?.target?.closest?.('[data-naar-ha]') || isTelefoon()) return;
    const doc = haDocument();
    if (doc && volledigNu() && !doc.fullscreenElement) doc.documentElement.requestFullscreen?.().catch(() => {});
  }
  /** Bij de eerste tik het hele scherm, en na de terugknop van Android weer bij de volgende. */
  const opTik = () => addEventListener('click', heelScherm, { once: true, capture: true });
  function volledig() {
    if (!inHA() || !volledigGekozen()) return;
    const doc = haDocument();
    const weer = () => {
      if (!doc.fullscreenElement && volledigNu()) opTik();
    };
    doc?.addEventListener('fullscreenchange', weer);
    // Het document van Home Assistant blijft; de luisteraar gaat mee met deze pagina.
    addEventListener('pagehide', () => doc?.removeEventListener('fullscreenchange', weer));
    // Een telefoon die het hele scherm nog had van een eerdere versie: weer met statusbalk.
    if (isTelefoon() && doc?.fullscreenElement) doc.exitFullscreen().catch(() => {});
    if (!volledigNu()) return;
    aanHA({ type: 'home-assistant/subscribe-properties', kioskMode: true });
    statusbalk(true);
    opTik();
  }
  /** Het hele scherm en de balken van Home Assistant uit, of weer aan. */
  /*
   * De statusbalk in de kleur van de app (#0b1424, licht #e9eff6), zoals de app van de NAS.
   * De app van Home Assistant kleurt de statusbalk en de balk onderin naar het
   * thema van Home Assistant (`--app-header-background-color` en
   * `--primary-background-color`), en leest die opnieuw bij het bericht
   * `theme-update`. Zolang SunArc volledig scherm heeft, zet de app die
   * twee op het document van Home Assistant; daarna komt het thema terug. Dat
   * terugzetten leeft bij Home Assistant zelf, want deze pagina is dan al weg
   * als je het paneel verlaat. Alleen in de app van Home Assistant.
   */
  const statusbalkKleur = () => (document.documentElement.classList.contains('sc-licht') ? '#e9eff6' : '#0b1424');
  const STATUSBALK_CODE = `
    const html = document.documentElement;
    const namen = ['--app-header-background-color', '--primary-background-color'];
    const meld = () => {
      try {
        document.querySelector('home-assistant')?.hass?.auth?.external?.fireMessage({ type: 'theme-update' });
      } catch {}
    };
    const balk = {
      oud: null,
      pad: '',
      zet(kleur) {
        if (!balk.oud) balk.oud = namen.map((n) => [n, html.style.getPropertyValue(n)]);
        for (const n of namen) html.style.setProperty(n, kleur);
        balk.pad = location.pathname;
        addEventListener('location-changed', balk.weg);
        meld();
      },
      terug() {
        removeEventListener('location-changed', balk.weg);
        if (!balk.oud) return;
        for (const [n, v] of balk.oud) v ? html.style.setProperty(n, v) : html.style.removeProperty(n);
        balk.oud = null;
        meld();
      },
      weg() {
        if (location.pathname !== balk.pad) balk.terug();
      },
    };
    return balk;`;
  function statusbalk(aan) {
    try {
      const w = global.parent;
      if (!(/** @type {any} */ (w.document.querySelector('home-assistant'))?.hass?.auth?.external)) return;
      w.__scStatusbalk ??= new w.Function(STATUSBALK_CODE)();
      if (aan) w.__scStatusbalk.zet(statusbalkKleur());
      else w.__scStatusbalk.terug();
    } catch {
      // Een vak van een andere herkomst, of Home Assistant laat het niet toe.
    }
  }
  /*
   * Wisselt het thema (de telefoon draait, of hij wordt 's avonds donker), dan
   * de balken van Home Assistant mee, anders bleven ze licht om een donkere
   * pagina staan, of andersom.
   */
  let lichtWas = document.documentElement.classList.contains('sc-licht');
  new MutationObserver(() => {
    const licht = document.documentElement.classList.contains('sc-licht');
    if (licht === lichtWas) return;
    lichtWas = licht;
    if (inHA() && volledigNu() && !gepauzeerd()) statusbalk(true);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  function balkenVanHA(terug) {
    statusbalk(!terug);
    if (terug) {
      aanHA({ type: 'home-assistant/unsubscribe-properties' });
      const doc = haDocument();
      if (doc?.fullscreenElement) doc.exitFullscreen().catch(() => {});
    } else {
      aanHA({ type: 'home-assistant/subscribe-properties', kioskMode: true });
      heelScherm();
    }
  }
  /** Aan of uit op dit apparaat, en meteen zo. */
  function zetVolledig(aan) {
    try {
      localStorage.setItem(VOLLEDIG, aan ? '1' : '0');
    } catch {
      // Geen opslag (privévenster): dan alleen voor nu.
    }
    if (!inHA()) return;
    pauze(false);
    knoppenNaarHA();
    balkenVanHA(!aan);
  }
  function pauze(aan) {
    try {
      if (aan) global.parent[PAUZE] = global.frameElement;
      else if (gepauzeerd()) delete global.parent[PAUZE];
    } catch {
      // Een vak van een andere herkomst.
    }
  }
  /** Naar Home Assistant: het volledige scherm uit, en de balken van Home Assistant terug. */
  function naarHA() {
    pauze(true);
    balkenVanHA(true);
    knoppenNaarHA();
  }
  /*
   * Een scherm van Home Assistant openen (besluit 179), zoals Instellingen ›
   * Personen. De app draait in een paneel van dezelfde herkomst; Home Assistant
   * navigeert zelf als zijn adres verandert en het "location-changed" hoort.
   * Het volledige scherm gaat eerst uit, zoals bij de knop naar Home Assistant.
   */
  function naarHAScherm(pad) {
    if (!inHA()) return false;
    try {
      naarHA();
      global.parent.history.pushState(null, '', pad);
      global.parent.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
      return true;
    } catch {
      return false;
    }
  }
  /** Weer volledig scherm, met dezelfde knop. */
  function weerVolledig() {
    pauze(false);
    balkenVanHA(false);
    knoppenNaarHA();
  }
  /**
   * De knop naar Home Assistant: op de wand boven de bel, op de telefoon naast
   * het tandwiel. Staat het volledige scherm even uit, dan zet dezelfde knop
   * het weer aan.
   */
  function knoppenNaarHA() {
    $$('[data-naar-ha-knop]').forEach((k) => k.remove());
    if (!inHA() || !volledigGekozen()) return;
    const uit = gepauzeerd();
    const label = esc(global.t(uit ? 'w.volledigScherm' : 'basis.naarHA'));
    const wat = uit ? `data-weer-volledig aria-label="${label}" title="${label}"` : `data-naar-ha aria-label="${label}" title="${label}"`;
    const icoon = uit ? VOLLEDIG_ICOON : NAAR_HA;
    document.getElementById('balk')?.querySelector('[data-meldbel]')?.insertAdjacentHTML('beforebegin', `<button type="button" class="meldbel naarha" data-naar-ha-knop ${wat}>${icoon}</button>`);
    $$('#tel [data-tandwiel]').forEach((t) => {
      const naast = t.parentElement.querySelector(':scope > [data-meldbel]') ?? t;
      naast.insertAdjacentHTML('beforebegin', `<button type="button" class="pil naarha" data-naar-ha-knop ${wat}>${icoon}</button>`);
    });
  }
  const NAAR_HA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h5"/><path d="M14 15.5h7M18 12.5l3 3-3 3"/></svg>';
  const VOLLEDIG_ICOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  document.addEventListener('click', (e) => {
    if (e.target.closest?.('[data-naar-ha]')) naarHA();
    else if (e.target.closest?.('[data-weer-volledig]')) weerVolledig();
  });

  /**
   * Eén bovenbalk op de telefoon (besluit 187): op elke tab de hulp, de bel en
   * het tandwiel, even groot (36 px) en op dezelfde plek, rechtsboven, naast de
   * titel als de tab er een heeft. Thuis heeft ze al in zijn kopregel, met het
   * weer ervoor. De hulp is de rondleiding, vanaf deze tab.
   */
  const TEL_TABS = ['vandaag', 'apparaten', 'opbrengst', 'assistent'];
  function telBalk(tab) {
    const tel = document.getElementById('tel');
    if (!tel || !TEL_TABS.includes(tab) || tel.querySelector('[data-meldbel]')) return;
    // Elke tab laadt de rondleiding; soms pas na deze regel, dus niet op global.rondleiding wachten.
    const hulp = `<button type="button" class="pil telknop uitlegknop" aria-label="${esc(global.t('thuis.uitleg'))}" data-tel-hulp>?</button>`;
    const knoppen = `<span class="telknoppen">${hulp}<button type="button" class="pil telknop meldbel" aria-label="${esc(global.t('nav.meldingen'))}" aria-haspopup="dialog" data-meldbel data-meldicoon><b data-meldaantal hidden></b></button><a class="pil telknop" aria-label="${esc(global.t('nav.instellingen'))}" data-tandwiel></a></span>`;
    const oud = tel.querySelector('[data-tandwiel]');
    // Alleen een titel die bovenaan staat; op Opbrengst staat de periode erboven.
    const titel = tel.querySelector('.inhoud > h1.kop-1:first-child');
    if (oud) oud.outerHTML = knoppen;
    else if (titel) titel.outerHTML = `<div class="telbalk metkop">${titel.outerHTML}${knoppen}</div>`;
    else (tel.querySelector('.inhoud') ?? tel).insertAdjacentHTML('afterbegin', `<div class="telbalk">${knoppen}</div>`);
  }
  document.addEventListener('click', (e) => e.target.closest?.('[data-tel-hulp]') && global.rondleiding?.start());

  /*
   * Wat het huis heeft (besluit 196): een slimme meter en een zonnemeting.
   * Zonder panelen heet Opbrengst Verbruik, zonder meter is wat er over is
   * geschat. Onthouden, zodat de navigatie het bij de volgende pagina meteen
   * goed zegt; null zolang de dienst het nog niet zei.
   */
  let soort = (() => {
    try {
      return JSON.parse(localStorage.getItem('sc-huissoort')) ?? null;
    } catch {
      return null;
    }
  })();
  const huisSoort = () => soort;
  function zetNav(tab) {
    const balk = document.getElementById('balk');
    const tabs = document.getElementById('tabs');
    if (balk) nav.balk(balk, tab, LINKS);
    if (tabs) nav.tabs(tabs, tab, LINKS);
  }
  async function leesHuisSoort(tab) {
    let s;
    try {
      s = await haal('api/site');
    } catch {
      return;
    }
    // De valuta van het huis (testerronde, november 2026): een andere dan onthouden, dan de pagina opnieuw met het goede teken.
    if (global.taal?.zetValuta?.(s.valuta)) {
      location.reload();
      return;
    }
    const nieuw = { meter: s.meter !== false, zon: s.zonMeter !== false };
    if (JSON.stringify(nieuw) === JSON.stringify(soort)) return;
    soort = nieuw;
    try {
      localStorage.setItem('sc-huissoort', JSON.stringify(nieuw));
    } catch {
      // Dan zegt de navigatie het pas na het laden goed.
    }
    // De bel staat in de navigatie: zijn getal opnieuw, en de knop naar Home Assistant ervoor.
    zetNav(tab);
    knoppenNaarHA();
    void meldLaad();
    dispatchEvent(new Event('huissoort'));
  }

  /** Zet de navigatie, de stand en de klok voor een tab. */
  /*
   * Terug naar Inrichten (besluit 227). Wie vanuit een stap van Inrichten naar
   * een andere pagina gaat, of naar een scherm in Home Assistant, komt op die stap
   * terug. Inrichten bewaart de stap per tabblad, een uur lang.
   */
  const TERUG_INR = 'sc-inrichten-terug';
  const TERUG_HA = 'sc-ha-terug';
  function leesTerug(sleutel) {
    try {
      const w = JSON.parse(sessionStorage.getItem(sleutel) ?? 'null');
      return w && w.tot > Date.now() ? w : null;
    } catch {
      return null;
    }
  }
  function bewaarTerug(sleutel, stap) {
    try {
      sessionStorage.setItem(sleutel, JSON.stringify({ stap, tot: Date.now() + 3_600_000 }));
    } catch {
      // Zonder opslag gewoon zoals altijd.
    }
  }
  /** De terugknop van een pagina: naar Inrichten als je daarvandaan kwam, anders naar Instellingen. */
  function terugknop() {
    const w = leesTerug(TERUG_INR);
    return w ? { href: `inrichten.html${w.stap ? `#${w.stap}` : ''}`, sleutel: 'inr.terugNaar' } : { href: 'instellingen.html', sleutel: 'jij.terugInstellingen' };
  }
  function zetTerugknoppen() {
    const k = terugknop();
    if (k.sleutel === 'jij.terugInstellingen') return;
    for (const a of $$('a.terugje[href="instellingen.html"]')) {
      a.setAttribute('href', k.href);
      a.setAttribute('data-t', k.sleutel);
      a.textContent = global.t(k.sleutel);
    }
  }
  /** Terug uit Home Assistant: open weer de stap van Inrichten waar je wegging, niet Thuis. */
  function terugUitHA() {
    const w = leesTerug(TERUG_HA);
    if (!w || /inrichten\.html$/.test(location.pathname)) return false;
    try {
      sessionStorage.removeItem(TERUG_HA);
    } catch {
      // Dan blijft hij tot het uur om is.
    }
    location.replace(`inrichten.html${w.stap ? `#${w.stap}` : ''}`);
    return true;
  }

  /** Inrichten onthoudt de stap: 'app' voor een andere pagina, 'ha' voor een scherm in Home Assistant. */
  const onthoudInrichten = (soort, stap) => bewaarTerug(soort === 'ha' ? TERUG_HA : TERUG_INR, stap);
  /** Weer in Inrichten: de terugknoppen gaan weer naar Instellingen. */
  function vergeetInrichten() {
    try {
      sessionStorage.removeItem(TERUG_INR);
      sessionStorage.removeItem(TERUG_HA);
    } catch {
      // Dan na een uur.
    }
  }

  /**
   * Minder bubbels (besluit 228): een rij van twee tot vier knoppen waarvan er één
   * kan aanstaan, wordt een segmentbalk. Een rij met `data-meer` (meer tegelijk
   * kiezen), of met een link of ander element erin, blijft zoals hij is.
   */
  function segmenten(root = document) {
    for (const rij of root.querySelectorAll('.chips:not([data-meer])')) {
      const k = [...rij.children];
      const ok = k.length >= 2 && k.length <= 4 && k.every((x) => x.matches('button.chip[aria-pressed]')) && k.filter((x) => x.getAttribute('aria-pressed') === 'true').length <= 1;
      rij.classList.toggle('seg', ok);
    }
  }

  /*
   * De wand meldt zelf hoe Fully Kiosk staat (besluit 246): draait de pagina
   * in Fully, staat de JavaScript-interface aan, en kijkt de camera mee. Voor
   * Klaarzetten; hooguit eens per tien minuten, en alleen in Fully.
   */
  function meldWand() {
    let f = null;
    try {
      f = global.fully ?? null;
    } catch {
      // Geen Fully.
    }
    const inFully = f != null || /fully/i.test(navigator.userAgent);
    if (!inFully) return;
    try {
      const vorige = Number(sessionStorage.getItem('sc-wand-gemeld') ?? 0);
      if (Date.now() - vorige < 10 * 60_000) return;
      sessionStorage.setItem('sc-wand-gemeld', String(Date.now()));
    } catch {
      // Zonder opslag meldt hij bij elke pagina.
    }
    let camera = null;
    try {
      camera = f?.isMotionDetectionRunning?.() ?? null;
    } catch {
      // Een oudere Fully.
    }
    void deur('api/wand', { fully: true, js: f != null, camera: typeof camera === 'boolean' ? camera : null }).catch(() => {});
  }

  function start(tab) {
    if (terugUitHA()) return;
    zetNav(tab);
    zetTerugknoppen();
    void leesHuisSoort(tab);
    telBalk(tab);
    // Volledig scherm in Home Assistant (besluit 155): de weg terug staat boven de bel.
    knoppenNaarHA();
    luchtAchterVak();
    $$('[data-tandwiel]').forEach((a) => {
      a.innerHTML = nav.svg('instellingen');
      a.setAttribute('href', LINKS.instellingen);
    });
    // De live-stroom, ook voor de deurbel op een pagina zonder live gegevens.
    stroom();
    // Om de app te installeren; dat kan alleen over HTTPS (of met een uitzondering in Chrome).
    if ('serviceWorker' in navigator && global.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
    addEventListener('keydown', (e) => e.key === 'Escape' && sluitBel());
    // Het toetsenbord gaat weg als het veld de focus verliest: dan weer op zijn plek.
    global.visualViewport?.addEventListener('resize', toetsenbord);
    document.addEventListener('focusin', () => setTimeout(toetsenbord, 350));
    document.addEventListener('focusout', () => setTimeout(() => {
      if (!typt()) schaal();
    }, 50));
    // Wisselt de stand (de tablet draait), dan tekent de pagina de andere opnieuw.
    let stand = telStand();
    addEventListener('resize', () => {
      schaal();
      if (telStand() !== stand) {
        stand = telStand();
        dispatchEvent(new Event('standwissel'));
      }
    });
    schaal();
    klok();
    setInterval(klok, 10_000);
    nieuweVersie();
    meldingenStart();
    luisterStart();
    teDoenStart();
    meldWand();
    void weergaveLaden();
    niemandStart();
    if (tab === 'instellingen') void gastGrens();
  }

  /*
   * Weergave (besluit 164): eenvoudig of uitgebreid, grotere letters en minder
   * beweging, bewaard bij je account. Hier ook onthouden, zodat de pagina
   * meteen goed staat; de dienst heeft het laatste woord.
   */
  const WEERGAVE = 'sc-weergave';
  const GEEN_WEERGAVE = { eenvoudig: false, groteLetters: false, minderBeweging: false, seizoen: true, weer: true, feestdagen: true, zonnebaan: true, getekend: true };
  let weergaveNu = GEEN_WEERGAVE;
  function zetWeergave(w, onthoud = true) {
    weergaveNu = { ...GEEN_WEERGAVE, ...w };
    const d = document.documentElement.classList;
    d.toggle('sc-eenvoudig', weergaveNu.eenvoudig);
    d.toggle('sc-groot', weergaveNu.groteLetters);
    d.toggle('sc-stil', weergaveNu.minderBeweging);
    // Het seizoen, het weer en de feestdagen in het huis: de tekening leest het.
    d.toggle('sc-geen-seizoen', weergaveNu.seizoen === false);
    d.toggle('sc-geen-weer', weergaveNu.weer === false);
    d.toggle('sc-geen-feest', weergaveNu.feestdagen === false);
    // De baan van de zon (besluit 205): uit, dan alleen de zon zelf.
    d.toggle('sc-geen-zonnebaan', weergaveNu.zonnebaan === false);
    if (onthoud) {
      try {
        localStorage.setItem(WEERGAVE, JSON.stringify(weergaveNu));
      } catch {
        // Dan alleen voor nu.
      }
    }
    dispatchEvent(new Event('weergave'));
  }
  try {
    const w = JSON.parse(localStorage.getItem(WEERGAVE) ?? 'null');
    if (w) zetWeergave(w, false);
  } catch {
    // Niets onthouden.
  }
  /*
   * Wat geldt op dit scherm: op een scherm aan de wand de
   * weergave, het thema, de kleur en de taal van wie de wand volgt, net als zijn
   * kaarten; anders die van jou. `volgt` is dan diens naam.
   */
  function persoonlijk(v) {
    const p = v?.scherm && v.wand?.persoon ? v.wand.persoon : null;
    return {
      weergave: p?.weergave ?? v?.tel?.weergave ?? null,
      thema: p?.thema ?? v?.tel?.thema,
      taal: p?.taal ?? v?.tel?.taal,
      kleur: p ? v.wand.kleur : v?.tel?.kleur,
      scherm: v?.scherm === true && !p,
      volgt: p ? (v.wand.naam ?? '') : null,
    };
  }
  async function weergaveLaden() {
    try {
      const v = await haal('api/voorkeuren');
      const w = persoonlijk(v).weergave;
      if (w) zetWeergave(w);
      zetThema(v);
    } catch {
      // Zonder logmap: zoals het was.
    }
  }

  /*
   * Het thema en de kleur (besluit 181): op de telefoon jouw thema en kleur,
   * op de wand de kleur van wiens comfort geldt. Het script in de <head> zet
   * ze vóór de eerste weergave uit wat het onthield; hier houden we dat bij.
   * De kleuren van alle bewoners zijn voor de begroeting en de rondjes.
   */
  let kleurenNu = {};
  function zetThema(v) {
    if (!v?.tel) return;
    // Op een scherm dat iemand volgt, diens thema, kleur en taal.
    const p = persoonlijk(v);
    global.scThema?.({ thema: p.thema, kleur: p.kleur, wandKleur: v.wand?.kleur, scherm: p.scherm });
    // De taal bij Jij (besluit 185); een scherm zonder bewoners volgt zijn account.
    global.taal.zetKeuze(p.taal, { scherm: p.scherm });
    const nieuw = v.kleuren ?? {};
    if (JSON.stringify(nieuw) === JSON.stringify(kleurenNu)) return;
    kleurenNu = nieuw;
    dispatchEvent(new Event('sc-kleuren'));
  }
  /** Een betekeniskleur als tekst: in het lichte thema de donkere tint, anders haalt hij het contrast niet. */
  const tekstKleur = (k) => String(k).replace(/var\(--(zon|ijs|mint|gloed)\)/, 'var(--$1-t)').replace('var(--violet)', 'var(--violet-t)');
  /** De kleur van een bewoner (zijn id): `data-kleur="${app.kleurVan(id)}"` kleurt met var(--accent). */
  const kleurVan = (bewonerId) => kleurenNu[bewonerId] ?? 'lucht';

  /** De wand als niemand kijkt (besluit 164): op Thuis en de pagina's om naar te kijken. */
  function niemandStart() {
    if (global.niemand || !/\/(thuis|vandaag|apparaten|opbrengst|assistent|kamer)\.html$/.test(location.pathname)) return;
    const s = document.createElement('script');
    s.src = 'niemand.js';
    document.head.append(s);
  }

  /**
   * "Hé huis" (besluit 150): op een scherm waar luisteren aan staat, laadt elke pagina het
   * luisteren erbij. Op een telefoon nooit vanzelf; daar tik je op de microfoon.
   */
  /**
   * Te doen (besluit 216): op een groot scherm laadt elke pagina het moment
   * van een herinnering erbij; Thuis heeft het al voor de kaart.
   */
  function teDoenStart() {
    // Ook op de telefoon: voor het getal bij de tab Te doen (besluit 217).
    if (global.tedoen || document.querySelector('script[src^="tedoen.js"]')) return;
    const s = document.createElement('script');
    s.src = 'tedoen.js';
    document.head.appendChild(s);
  }

  function luisterStart() {
    let aan;
    try {
      aan = localStorage.getItem('sc-luisteren') === 'aan';
    } catch {
      aan = false;
    }
    if (!aan || telStand() || global.luisteren || !global.isSecureContext) return;
    const s = document.createElement('script');
    s.src = 'luisteren.js';
    document.head.appendChild(s);
  }

  // meldingen: in src/basis-meldingen.js (opgesplitst op 22 november 2026). Wat het deel van de tekenaar deelt:
  const cmeldingen = {};
  Object.defineProperties(cmeldingen, {
    volledig: { get: () => volledig }, wanneer: { get: () => wanneer }, esc: { get: () => esc }, global: { get: () => global },
    $$: { get: () => $$ }, haal: { get: () => haal }, bijnaOp: { get: () => bijnaOp }, deur: { get: () => deur },
    houToegang: { get: () => houToegang }, typt: { get: () => typt }, telStand: { get: () => telStand },
    volledigGekozen: { get: () => volledigGekozen }, zetVolledig: { get: () => zetVolledig }, luisterStart: { get: () => luisterStart },
  });
  const meldingenDeel = global.basisMeldingen(cmeldingen);
  function meldLaad(...a) {
    return meldingenDeel.meldLaad(...a);
  }
  function bijwerkVenster(...a) {
    return meldingenDeel.bijwerkVenster(...a);
  }
  function koffieKnop(...a) {
    return meldingenDeel.koffieKnop(...a);
  }
  function jouwMeldingen(...a) {
    return meldingenDeel.jouwMeldingen(...a);
  }
  function laadHulp(...a) {
    return meldingenDeel.laadHulp(...a);
  }
  function meldingenStart(...a) {
    return meldingenDeel.meldingenStart(...a);
  }
  function nieuweVersie(...a) {
    return meldingenDeel.nieuweVersie(...a);
  }
  function metLidwoord(...a) {
    return meldingenDeel.metLidwoord(...a);
  }
  function kanApparaatSpreken(...a) {
    return meldingenDeel.kanApparaatSpreken(...a);
  }
  function zegMetApparaat(...a) {
    return meldingenDeel.zegMetApparaat(...a);
  }
  const { updateKlaar } = meldingenDeel;
  global.app = { laadBronnen, kanApparaatSpreken, zegMetApparaat, huisSoort, persoonlijk, $$, metLidwoord, nl, zet, esc, bijnaOp, klokVan, wanneer, LINKS, telStand, schaal, haal, deur, tijdVanDeDag, seizoenNu, lucht, luchtVan, klok, live, start, verwachting, gebundeld, zicht, aanbellen, offline, online, inHA, volledigGekozen, zetVolledig, naarHA, zetWeergave, weergave: () => weergaveNu, zetThema, kleurVan, tekstKleur, houToegang, updateKlaar, bijwerkVenster, bijVerandering, kanInstalleren, geinstalleerd, installeer, naarHAScherm, terugknop, onthoudInrichten, vergeetInrichten, segmenten, koffieKnop, jouwMeldingen, laadHulp };
})(window);
