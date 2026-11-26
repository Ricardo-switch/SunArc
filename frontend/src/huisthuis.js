/*
 * Het huis zoals getekend, op Thuis, een kamer en het always-on display
 * (stap a van de nieuwe tekenaar; schets design/app2/thuis-nieuw.js).
 *
 * De nieuwe tekenaar (kit/huis-maat.js) tekent het huis zoals het in Je huis
 * staat, met de vaste lijst van modellen (kit/huis-modellen.js). Dit bestand
 * bouwt daarvoor de tekenaar van Je huis op uit `api/huistekening`, alleen om
 * te tekenen (er wordt niets bewaard), en zet wat Thuis al weet (de
 * temperaturen, wat aan staat, de screens, de stroom, de zon) om naar zijn
 * opties.
 *
 * Voorlopig staat het poppenhuis (kit/huis.js) er nog: de nieuwe tekenaar komt
 * alleen als hij aan staat (`?tekenaar=maat` in het adres, `?tekenaar=poppenhuis`
 * zet hem weer uit; daarna onthoudt dit scherm het). De keuze bij Weergave komt
 * in een volgende stap. Zonder tekening in Je huis, of als er iets misgaat,
 * blijft het poppenhuis. De motor en de modellen laadt het pas als hij aan staat.
 *
 * huisThuis.teken(el, model, { soort, breedte, hoogte, huisData, kamerId, avond, opnieuw })
 * tekent in `el` en geeft true; false betekent: teken het poppenhuis. `opnieuw`
 * wordt aangeroepen zodra de tekenaar klaar is (de eerste keer laden).
 */
(function (global) {
  'use strict';
  if (global.huisThuis) return;
  const SLEUTEL = 'sc-tekenaar';
  const t = (k, p) => global.t(k, p);

  /**
   * Staat de nieuwe tekenaar aan? Bij Weergave (Het huis zoals getekend, voor jou op elk scherm). Het adres kan het op
   * één scherm nog anders zetten (`?tekenaar=maat` of `?tekenaar=poppenhuis`, dat scherm onthoudt het tot je bij
   * Weergave kiest).
   */
  function aan() {
    let keuze = null;
    try {
      keuze = new URLSearchParams(location.search).get('tekenaar');
      if (keuze === 'maat' || keuze === 'poppenhuis') localStorage.setItem(SLEUTEL, keuze);
      else keuze = localStorage.getItem(SLEUTEL);
    } catch {
      // Zonder opslag: alleen wat het adres zegt.
    }
    if (keuze === 'maat' || keuze === 'poppenhuis') return keuze === 'maat';
    return global.app?.weergave?.()?.getekend === true;
  }

  const staat = { tk: null, bezig: null, fout: false, afdruk: null, opnieuw: new Set() };
  /*
   * Of dit scherm de vorige keer een tekening vond: '1' of '0'. Met '1' (of nog onbekend) staat er
   * tijdens het laden een rustige gloed in plaats van even het poppenhuis; met '0' meteen het poppenhuis.
   * Na '0:' de vingerafdruk van de tekening die toen niet lukte: is die niet veranderd, dan laadt dit
   * scherm de tekenaar (vijftien scripts) niet nog eens voor niets (stap 4, Thuis lichter).
   */
  const ER = 'sc-tekening-er';
  const erWas = () => {
    try {
      return localStorage.getItem(ER);
    } catch {
      return null;
    }
  };
  const nietGelukt = () => erWas()?.startsWith('0') === true;
  /** Een korte vingerafdruk van de tekening: verandert hij, dan is er iets getekend of veranderd. */
  const vingerafdruk = (d) => {
    const s = JSON.stringify(d ?? null);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };
  const onthoud = (ja) => {
    try {
      localStorage.setItem(ER, ja ? '1' : staat.afdruk ? `0:${staat.afdruk}` : '0');
    } catch {
      // Zonder opslag: de volgende keer weer de gloed.
    }
  };
  /*
   * Scripts laden: allemaal tegelijk ophalen, en ze draaien in de volgorde van de lijst (async = false), want elk deel
   * leunt op het vorige (eerst één voor één, dat wachtte per script op het netwerk).
   */
  const laadScripts = (lijst) =>
    Promise.all(
      lijst.map(
        (src) =>
          new Promise((ok, fout) => {
            const er = /** @type {HTMLScriptElement | null} */ (document.querySelector(`script[data-huisthuis="${src}"]`));
            if (er) {
              if (er.dataset.klaar) return ok();
              er.addEventListener('load', () => ok());
              er.addEventListener('error', fout);
              return;
            }
            const s = document.createElement('script');
            s.src = src;
            s.async = false;
            s.dataset.huisthuis = src;
            s.onload = () => {
              s.dataset.klaar = '1';
              ok();
            };
            s.onerror = fout;
            document.head.append(s);
          }),
      ),
    );

  /** De motor en de modellen laden, de tekening ophalen en de tekenaar opbouwen, op een svg die niemand ziet. */
  async function laad() {
    // Lukte het de vorige keer niet: eerst de tekening. Is die dezelfde, dan niet de hele tekenaar laden.
    // Lukte het wel: de tekening en de scripts tegelijk.
    const tekening = global.app.haal('api/huistekening');
    if (nietGelukt()) {
      staat.afdruk = vingerafdruk(await tekening);
      if (erWas() === `0:${staat.afdruk}`) throw new Error('nog niets getekend in Je huis (zoals de vorige keer)');
    }
    const [d] = await Promise.all([tekening, laadScripts(['kit/huistekenen-vloer.js', 'kit/huistekenen-blad.js', 'kit/huistekenen-kaart.js', 'kit/huistekenen-teken.js', 'kit/huistekenen-gebaar.js', 'kit/huistekenen.js', 'kit/huis-modellen.js', 'kit/huis-maat-hemel.js', 'kit/huis-maat-buiten.js', 'kit/huis-maat-meubels.js', 'kit/huis-maat-apparaten.js', 'kit/huis-maat-vorm.js', 'kit/huis-maat.js', 'huisvoor.js', 'huisthuis-opties.js'])]);
    staat.afdruk = vingerafdruk(d);
    const hv = global.huisVoor;
    const huis = hv.huisVoorMotor(d);
    if (!huis.etages.length) throw new Error('geen etages');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:fixed;left:-4000px;top:0;width:800px;height:600px;visibility:hidden;pointer-events:none';
    document.body.append(svg);
    const beneden = huis.etages.find((e) => e.id === 'bg')?.id ?? huis.etages.at(-1).id;
    const tk = global.huistekenen.maak(svg, huis, { stand: 'kamers', etage: beneden, tekening: hv.zonderLosBuiten(d, huis), openingen: true, vast: [hv.HUIS_OP_ERF] });
    // Nog niets getekend in Je huis (het voorbeeldhuis, een nieuw huis): geen lege dozen, dan blijft het poppenhuis.
    const binnen = huis.etages.filter((e) => !e.buiten).map((e) => tk.st.vloeren[e.id]);
    if (!binnen.some((v) => Object.values(v?.ruimtes ?? {}).some((r) => r.kamer))) {
      svg.remove();
      throw new Error('nog niets getekend in Je huis');
    }
    staat.tk = tk;
  }

  /** Is de tekenaar er? Zo niet, dan begint het laden, en `opnieuw` tekent als hij klaar is. */
  function klaar(opnieuw) {
    if (staat.tk) return true;
    // Wie wil tekenen, krijgt het seintje (ook als het laden al eerder begon): Thuis, de telefoon, het always-on display.
    if (opnieuw) staat.opnieuw.add(opnieuw);
    if (!staat.bezig && !staat.fout) {
      staat.bezig = laad()
        .then(() => {
          onthoud(true);
          [...staat.opnieuw].forEach((f) => {
            try {
              f();
            } catch (e2) {
              console.warn(e2);
            }
          });
          staat.opnieuw.clear();
        })
        .catch((e) => {
          staat.fout = true;
          onthoud(false);
          console.warn('Het huis zoals getekend laadde niet; het poppenhuis blijft.', e);
          // Er stond een gloed: nu het poppenhuis.
          [...staat.opnieuw].forEach((f) => {
            try {
              f();
            } catch (e2) {
              console.warn(e2);
            }
          });
          staat.opnieuw.clear();
        });
    }
    return false;
  }

  /*
   * Draaien met een vinger of de muis (Ricardo): horizontaal vegen draait het huis om zijn as; een tik
   * blijft een tik (pas vanaf 8 pixels opzij draait het). Na 20 seconden zonder aanraken draait het in een halve seconde
   * terug naar de vaste kant, zodat Thuis altijd hetzelfde begint.
   */
  const draai = new WeakMap();
  /** De laatste tekening per plek: met welke opties, en het svg-element (zie tekenNu). */
  const laatste = new WeakMap();
  const draaiTeken = new WeakMap();
  const TERUG_MS = 20_000;
  function draaiBij(el, tekenNu) {
    draaiTeken.set(el, tekenNu);
    if (el.dataset.draai) return;
    el.dataset.draai = '1';
    let begin = null;
    let gesleept = false;
    let terugTimer = null;
    let raf = 0;
    const opnieuw = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => draaiTeken.get(el)?.());
    };
    const terug = () => {
      clearTimeout(terugTimer);
      terugTimer = setTimeout(() => {
        const van = draai.get(el) ?? 0;
        if (!van) return;
        const t0 = performance.now();
        const stap = (nu) => {
          const f = Math.min(1, (nu - t0) / 500);
          draai.set(el, van * (1 - (1 - (1 - f) ** 3)));
          draaiTeken.get(el)?.();
          if (f < 1) requestAnimationFrame(stap);
          else draai.set(el, 0);
        };
        requestAnimationFrame(stap);
      }, TERUG_MS);
    };
    el.addEventListener('pointerdown', (e) => {
      begin = { x: e.clientX, y: e.clientY, hoek: draai.get(el) ?? 0, id: e.pointerId };
      gesleept = false;
    });
    el.addEventListener('pointermove', (e) => {
      if (!begin || e.pointerId !== begin.id) return;
      const dx = e.clientX - begin.x;
      if (!gesleept && (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - begin.y))) return;
      if (!gesleept) {
        gesleept = true;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // Zonder vangen draait het alleen zolang de vinger op het huis blijft.
        }
      }
      draai.set(el, begin.hoek + dx * 0.45);
      opnieuw();
    });
    const los = (e) => {
      if (!begin || e.pointerId !== begin.id) return;
      begin = null;
      if (gesleept) terug();
    };
    el.addEventListener('pointerup', los);
    el.addEventListener('pointercancel', los);
    // Na slepen geen tik op een kamer.
    el.addEventListener(
      'click',
      (e) => {
        if (!gesleept) return;
        gesleept = false;
        e.stopPropagation();
        e.preventDefault();
      },
      true,
    );
  }

  /** De plek van het huis terwijl het laadt: een zachte gloed, zonder tekst. */
  function gloed(B, H) {
    return `<svg viewBox="0 0 ${B} ${H}" width="${B}" height="${H}" aria-hidden="true" data-huis-laadt><defs><radialGradient id="ht-laadt"><stop offset="0" stop-color="#6fd3ff" stop-opacity="0.10"/><stop offset="1" stop-color="#6fd3ff" stop-opacity="0"/></radialGradient></defs><ellipse cx="${B / 2}" cy="${H * 0.58}" rx="${B * 0.36}" ry="${H * 0.3}" fill="url(#ht-laadt)"/></svg>`;
  }

  /**
   * Tekent het huis zoals getekend in `el`; false: teken het poppenhuis.
   * @param {Element} el
   * @param {any} model
   * @param {{ soort?: string, tel?: boolean, breedte?: number, hoogte?: number, huisData?: any, zonData?: any, kamerId?: string | null, avond?: boolean, opnieuw?: (() => void) | null }} [opts]
   */
  function teken(el, model, { soort = 'thuis', tel = false, breedte, hoogte, huisData = null, zonData = null, kamerId = null, avond = false, opnieuw = null } = {}) {
    if (!el || !aan() || staat.fout) return false;
    const B = Math.round(breedte ?? el.clientWidth ?? 860);
    const H = Math.round(hoogte ?? 612);
    if (!klaar(opnieuw)) {
      // Nog aan het laden: een rustige gloed waar het huis komt, niet even het poppenhuis (Ricardo).
      if (nietGelukt()) return false;
      if (!el.querySelector('[data-huis-laadt]')) el.innerHTML = gloed(B, H);
      return true;
    }
    try {
      const { opties, tuinKorter, alsEtage, alsRust } = global.huisOpties;
      const o = /** @type {any} */ (opties(staat.tk, model, huisData));
      // Op Thuis en het always-on display de tuin ingekort, zodat het huis groot staat; bij een kamer op ware afstand.
      if (soort !== 'kamer') tuinKorter(o, o.huisDoos);
      if (soort === 'kamer') alsEtage(o, staat.tk, huisData, kamerId);
      else if (soort === 'rust') alsRust(o, avond, model);
      /*
       * Thuis en de telefoon (Ricardo: op de telefoon klopte niets). De telefoon toont net als het
       * poppenhuis het hele huis met de ingekorte tuin, de stroomlijnen, het label van de panelen en de zonneboog; alleen
       * de namen staan eronder in plaats van in de tekening.
       */
      else {
        if (soort === 'tel') Object.assign(o, { boven: 0, rand: 8, metDakLabel: true });
        else {
          o.boven = 90;
          // De kop op de wand (groet, titel en zin) ligt over de tekening: de zonneboog loopt er niet doorheen.
          const ti = el.parentElement?.querySelector(':scope > .titel');
          const pr = el.getBoundingClientRect();
          const tr = ti?.getBoundingClientRect();
          if (tr && tr.width && pr.width) {
            const sc = B / pr.width;
            o.vrij = [{ x0: (tr.left - pr.left) * sc, y0: (tr.top - pr.top) * sc, x1: (tr.right - pr.left) * sc, y1: (tr.bottom - pr.top) * sc }].map((v) => Object.fromEntries(Object.entries(v).map(([k, w]) => [k, Math.round(w)])));
          }
        }
        // De baan van de zon om het huis, zoals in het poppenhuis (besluit 205); het huis blijft even groot.
        // De baan en de zon van nu uit api/zon (zoals het always-on display ze krijgt); het model van Thuis heeft alleen de stand.
        const zon = { ...(model?.zon ?? {}), ...(global.huismodel?.zonNu?.(zonData) ?? {}) };
        const voorDeg = model?.voorgevelDeg ?? model?.kompas?.voorgevelDeg;
        if (!o.avond && global.app?.weergave?.()?.zonnebaan !== false && zon?.nu && zon?.baan?.length && voorDeg != null) {
          o.zonBoog = { nu: zon.nu, baan: zon.baan, voorDeg };
          o.boogVrij = true;
          o.hemel = { ...(o.hemel ?? {}), geenZon: true };
        }
      }
      // De telefoon (stap d): klein, dus zonder namen in de tekening; de kamers staan eronder.
      if (soort === 'tel' || tel) Object.assign(o, { stil: true, rand: 6 });
      // Tikken op een kamer, een deel buiten of de panelen, zoals in het poppenhuis (niet als niemand kijkt).
      if (soort !== 'rust') o.tik = true;
      // Draaien op Thuis en de telefoon (Ricardo: vrij, en na 20 seconden terug).
      const draaibaar = soort === 'thuis' || soort === 'tel';
      const tekenNu = () => {
        const o2 = draaibaar ? { ...o, hoek: (o.hoek ?? -58) + (draai.get(el) ?? 0) } : o;
        /*
         * Alleen opnieuw tekenen als er iets veranderde. Thuis tekent bij elke verandering in huis
         * opnieuw, maar meestal is het huis daarna precies hetzelfde (van 17 keer in 75 seconden 12 keer). Dezelfde
         * opties, maat en taal, en de tekening staat er nog: dan blijft hij staan.
         */
        const sleutel = `${B}x${H}|${global.taal?.code ?? ''}|${JSON.stringify(o2)}`;
        const vorige = laatste.get(el);
        if (vorige?.sleutel === sleutel && vorige.svg === el.firstElementChild) return;
        let uit;
        try {
          uit = global.huisMaat.teken(staat.tk, B, H, o2);
        } catch (e) {
          /*
           * Een tekening die mislukt (bij sommige hoeken tijdens het draaien) laat de vorige staan,
           * in plaats van Thuis voor de rest van de dag op het poppenhuis te zetten. Zonder vorige tekening wel.
           */
          if (vorige?.svg && vorige.svg === el.firstElementChild) {
            console.warn('Het huis zoals getekend lukte deze keer niet; de vorige tekening blijft.', e);
            return;
          }
          throw e;
        }
        // Wat nergens paste, voor de proef en om na te lopen.
        staat.overgeslagen = uit.overgeslagen ?? [];
        el.innerHTML = `<svg viewBox="0 0 ${B} ${H}" width="${B}" height="${H}" role="img" aria-label="${global.app.esc(t('thuis.hetHuis'))}"${draaibaar ? ' style="touch-action: pan-y"' : ''}>${uit.svg}</svg>`;
        laatste.set(el, { sleutel, svg: el.firstElementChild });
      };
      tekenNu();
      if (draaibaar) draaiBij(el, tekenNu);
      else draai.delete(el);
      return true;
    } catch (e) {
      staat.fout = true;
      console.warn('Het huis zoals getekend lukte niet; het poppenhuis blijft.', e);
      return false;
    }
  }

  /*
   * Het poppenhuis pas laden als het nodig is. Thuis, een kamer en het always-on display laden
   * vast alleen kit/huis-basis.js (de kleuren, de iconen van de kamers, de feestdagen); de rest van het poppenhuis
   * (ruim 230 kB) komt pas als het getekende huis niet aan staat of niet lukt. `poppenhuis(opnieuw)` zegt of het er
   * is; zo niet, dan begint het laden en tekent `opnieuw` zodra het er is.
   */
  const popWacht = new Set();
  let popLaadt = null;
  function poppenhuis(opnieuw) {
    if (global.huis?.teken) return true;
    if (opnieuw) popWacht.add(opnieuw);
    popLaadt ??= laadScripts(['kit/huis-kamers.js', 'kit/huis-buiten.js', 'kit/huis-tuin.js', 'kit/huis-route.js', 'kit/huis.js'])
      .then(() => {
        [...popWacht].forEach((f) => {
          try {
            f();
          } catch (e) {
            console.warn(e);
          }
        });
        popWacht.clear();
      })
      .catch((e) => {
        popLaadt = null;
        console.warn('Het poppenhuis laadde niet.', e);
      });
    return false;
  }

  global.huisThuis = {
    aan,
    teken,
    laad,
    poppenhuis,
    /** De apparaten die de laatste tekening niet kwijt kon, met waarom. */
    get overgeslagen() {
      return staat.overgeslagen ?? [];
    },
  };
  /*
   * Meteen beginnen met laden, zodra de scripts van de pagina er zijn (basis.js, dat Weergave kent, laadt na dit
   * bestand): het getekende huis als dit scherm de vorige keer een tekening had, het poppenhuis als het getekende huis
   * uit staat of de vorige keer niet lukte.
   */
  setTimeout(() => {
    if (!aan() || nietGelukt()) poppenhuis(null);
    else if (erWas() === '1') klaar(null);
  }, 0);
})(window);
