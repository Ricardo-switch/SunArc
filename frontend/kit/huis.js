/*
 * SunArc, ontwerp 2: het huis in 3D.
 *
 * Tekent het huis als een opengewerkt poppenhuis, schuin van voren (een
 * axonometrie, geen echte 3D-motor: licht genoeg voor een tablet aan de muur).
 * Het huis bouwt zich op uit een beschrijving: de etages en kamers uit de
 * indeling, en alleen wat het huis heeft: panelen, een buitenunit, een
 * batterij, een laadpaal met auto. Komt er iets bij, dan groeit het huis.
 *
 * Energie is licht dat over draden loopt, met een kleur per bron. Het vermogen
 * staat bij de panelen, niet bij de zon: de zon is alleen het licht.
 *
 * Gebruik: huis.teken(element, model, { breedte, hoogte }).
 */
(function (global) {
  'use strict';
  // De vaste waarden en losse hulpjes staan in kit/huis-basis.js (opgesplitst op 22 november 2026).
  const { stilGekozen, KLEUR, TEKST_LICHT, MEUBEL, WITGOED, TOESTEL, MEUBELS_ALS, zoneNaam, zoneSoort, soortVanKamer, soortVan, tintenVan, kleurlampVan, esc, metRing, voorDegVan, spook, feestdagVan, FH, AIRCO, RADIATOR, AX, AY, BX, BY, opbouw, gebouwVan, lagenVan, KAMER_ICOON } = global.huisBasis;
  let D = 1.5; // diepte van het huis; dieper met de nok langs de straat (zie svg)
  // Hoogte van het dak; hoger als er kamers onder liggen, zoals een zolderverdieping.
  let R = 1.15;
  const proj = (x, y, z) => [x * AX + (D - y) * BX, x * AY - (D - y) * BY - z];

  let uid = 0;




  /* ------------------------------------------------------------ de opbouw */



  /**
   * De wereld (huis 3.0): het perceel als een eiland in de lucht, met de
   * voorkant als één doorsnede door huis en grond. Alleen met `opts.wereld`,
   * en niet ingezoomd of bij een appartement. Null: het gewone perceel.
   */
  function eilandVan(model, W, opts) {
    if (!opts.wereld || model.woning === 'appartement') return null;
    const nis = !!model.kelder;
    return {
      x0: model.auto || model.oprit || model.garage || spook(model, 'auto') ? -3.35 : -1.3,
      // Een tuin krijgt ruimte: alles erin moet tegelijk kunnen zonder op elkaar te staan.
      x1: model.tuin ? W + 3.0 : model.terras ? W + 2.45 : W + 1.35,
      y0: model.tuin ? -2.9 : model.garage ? -2.6 : -1.1,
      yF: D + 0.8,
      nis,
      // Een dunne plaat grond: net diep genoeg voor de kelder, de kabel en een paar lagen.
      T: nis ? FH + 0.3 : 0.55,
    };
  }


  /** Alle punten die in beeld moeten, om de schaal te bepalen. */
  /*
   * De ring van de zon (schets Wand-Huis-Ligging): ruim om het
   * huis, met het midden boven de nok. Zo loopt de zon vóór een huis op het
   * zuiden over het dak heen en niet erdoorheen. De hoogte is wat opgerekt, zodat
   * de middag duidelijk boven de ochtend en de avond staat.
   */
  function ringPunt(model, W, Ht, { az, el }) {
    const r = Math.PI / 180;
    const Rd = Math.max(W, D) * 0.7 + 2.8;
    const zc = Ht + R + 1.4;
    const v = voorDegVan(model) ?? 180;
    const c = Math.cos(el * r);
    return [W / 2 - Rd * c * Math.sin((az - v) * r), D / 2 + Rd * c * Math.cos((az - v) * r), zc + Rd * Math.sin(Math.max(0, el) * r)];
  }

  function omtrek(model, g, opts = {}) {
    const { W, Ht } = g;
    const lagen = lagenVan(model);
    const pts = [
      [0, 0, Ht + (model.zonderDak ? 0.1 : R + 0.1)],
      [W, 0, Ht],
      [W, D, 0],
      [0, D, 0],
      [-0.4, D + (model.zonderDak ? 0.7 : 0.6), 0],
      [W + 0.8, D + (model.zonderDak ? 0.7 : 0.6), 0],
      [W + 0.6, -0.2, 0],
    ];
    if (model.auto || spook(model, 'auto') || opts.ruimte) pts.push([-2.7, D + 0.7, 0], [-2.7, D - 1.8, 0.9]);
    if (opts.ruimte) pts.push([-0.9, D + 1.4, 0], [g.W / 2, D / 2, g.Ht + R + 1.6]);
    if (model.net) pts.push([-0.9, D + 1.4, 0]);
    if (model.oprit) pts.push([-2.9, D + 1.5, 0], [-2.8, D + 1.4, 1.5], [-2.7, D - 1.8, 0.9]);
    if (model.tuin) pts.push([g.W + 2.0, -1.9, 0], [g.W + 2.0, -1.9, 1.0]);
    if (model.garage) pts.push([-2.95, -2.0, 0], [-2.95, -2.0, 1.2], [-1.05, -2.0, 1.2]);
    if (model.oprit?.carport) pts.push([-2.95, D + 1.5, 1.1]);
    if (model.terras) pts.push([g.W + 2.0, D + 0.4, 0], [g.W + 2.0, 0.4, 0.8]);
    if (model.voortuin) pts.push([W + 0.1, D + 1.7, 0], [1.3, D + 1.7, 0]);
    if (model.zon) pts.push([W / 2, D / 2, Ht + R + 1.6]);
    // De ring van de zon past in beeld; zonder ring alleen de zon zelf.
    if (metRing(model)) model.zon.baan.filter((p, i) => i % 3 === 0 && p.el > -1.5).forEach((p) => pts.push(ringPunt(model, W, Ht, p)));
    else if (model.zon?.nu && voorDegVan(model) != null && model.zon.nu.el > 0) pts.push(ringPunt(model, W, Ht, model.zon.nu));
    // Een appartement (huis 3.0): de verdiepingen eronder en erboven.
    if (model.woning === 'appartement') {
      const ge = gebouwVan(model);
      pts.push([-0.2, D, -ge.onder * FH - 0.1], [W + 0.6, D, -ge.onder * FH - 0.1], [0, 0, Ht + ge.boven * FH + 0.3]);
    }
    // Het eiland (huis 3.0): de hoeken en de diepte van de doorsnede.
    const ei = eilandVan(model, W, opts);
    // Een etage hoger (de vage lagen): het eiland een etage lager, en alleen de bovenkant in beeld; de rots loopt toch weg.
    if (ei && lagen?.zak) pts.push([ei.x0, ei.yF, -lagen.zak - 0.4], [ei.x1, ei.yF, -lagen.zak - 0.4], [ei.x0, ei.y0, -lagen.zak], [ei.x1, ei.y0, -lagen.zak]);
    else if (ei) pts.push([ei.x0, ei.yF, -ei.T - 0.3], [ei.x1, ei.yF, -ei.T * 0.75], [ei.x0, ei.y0, 0], [ei.x1, ei.y0, 0], [ei.x0 + 0.4, ei.y0 + 0.45, 1.6], [ei.x1 - 0.45, ei.y0 + 0.4, 1.8]);
    // Erboven de vage etage of het dak, tot waar hij wegloopt.
    if (lagen) pts.push([0, 0, Ht + (lagen.dak ? R : FH * 0.6)], [W, 0, Ht + (lagen.dak ? 0.2 : FH * 0.6)]);
    // De kelder (huis 3.0): onder de grond, met de aarde eromheen.
    if (model.kelder) pts.push([-0.4, D, -FH - 0.35], [W + 0.4, D, -FH - 0.35]);
    return pts;
  }


  /* -------------------------------------------------------------- tekenen */

  function teken(el, model, opts = {}) {
    el.innerHTML = svg(model, opts);
    beweegApart(el);
  }

  /** Wat in de tekening beweegt: de stroom, een ventilator, damp, regen; en wat met SMIL beweegt, zoals de ring van een camera. */
  const BEWEEGT = '.sc-stroom, .sc-trommel, .sc-fan, .sc-damp, .sc-puls, .sc-vlam, .sc-lucht, .sc-regen, .sc-sneeuw, .sc-vlieg';

  /**
   * Wat beweegt in een eigen laag. Beweegt er iets in de
   * tekening, dan schildert de browser bij elk beeldje alles eronder opnieuw:
   * het eiland, de bomen, de verlopen. Op een oudere tablet aan de wand liep de
   * pagina daar op vast (gemeten op een pc: 316 ms schilderwerk per seconde,
   * zo 15 ms). Nu staat wat beweegt in een tweede, doorzichtige tekening
   * erboven, die de browser apart houdt; het huis eronder staat stil.
   */
  function beweegApart(el) {
    const basis = el.querySelector(':scope > svg.sc-huis');
    if (!basis) return;
    const alles = [...basis.querySelectorAll(BEWEEGT), ...[...basis.querySelectorAll('animate, animateTransform, animateMotion')].map((a) => a.parentElement)];
    // Alleen het buitenste: wat in iets bewegends zit, gaat al mee.
    const stukken = [...new Set(alles)].filter((x) => !alles.some((y) => y !== x && y.contains(x)));
    if (!stukken.length) return;
    const laag = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    laag.setAttribute('viewBox', basis.getAttribute('viewBox'));
    laag.setAttribute('class', 'sc-beweegt');
    laag.setAttribute('aria-hidden', 'true');
    for (const stuk of stukken) {
      // Met de groepen eromheen: een verschuiving, doorzichtigheid of een filter blijft zo gelden.
      let doel = laag;
      const keten = [];
      for (let p = stuk.parentElement; p && p !== basis; p = p.parentElement) keten.unshift(p);
      for (const g of keten) {
        const kopie = g.cloneNode(false);
        kopie.removeAttribute('id');
        doel.appendChild(kopie);
        doel = kopie;
      }
      doel.appendChild(stuk);
    }
    // Een vak dat nergens stond, gaat de laag dragen; zonder verschuiving, want een top of left
    // uit een regel voor de wand telde eerst niet (op de telefoon zakte het huis 96 px).
    if (getComputedStyle(el).position === 'static') {
      el.style.position = 'relative';
      el.style.inset = 'auto';
    }
    basis.after(laag);
  }


  function svg(model, kies = {}) {
    // route: in kit/huis-route.js (opgesplitst op 22 november 2026). Wat het deel van de tekenaar deelt:
    const croute = {};
    Object.defineProperties(croute, {
      accuPlek: { get: () => accuPlek }, model: { get: () => model }, plek: { get: () => plek }, voordeur: { get: () => voordeur },
      D: { get: () => D }, nGarage: { get: () => nGarage }, nHuis: { get: () => nHuis }, hub: { get: () => hub },
      voetPaneel: { get: () => voetPaneel }, W: { get: () => W }, zt: { get: () => zt }, eiland: { get: () => eiland },
      netStraat: { get: () => netStraat }, vindKamer: { get: () => vindKamer }, kamers: { get: () => kamers },
    });
    const routeDeel = global.huisRoute(croute);
    function route(...a) {
      return routeDeel.route(...a);
    }

    // kamers: in kit/huis-kamers.js (opgesplitst op 22 november 2026). Wat het deel van de tekenaar deelt:
    const ckamers = {};
    Object.defineProperties(ckamers, {
      kamers: { get: () => kamers }, nacht: { get: () => nacht }, P: { get: () => P }, k: { get: () => k }, huis: { get: () => huis },
      id: { get: () => id }, D: { get: () => D }, stilGekozen: { get: () => stilGekozen }, KLEUR: { get: () => KLEUR },
      soortVanKamer: { get: () => soortVanKamer }, tik: { get: () => tik }, poly: { get: () => poly }, schemer: { get: () => schemer },
      kleurWas: { get: () => kleurWas }, line: { get: () => line }, labels: { get: () => labels }, esc: { get: () => esc },
      opts: { get: () => opts }, controle: { get: () => controle }, winter: { get: () => winter }, zoneNaam: { get: () => zoneNaam },
      KAMER_ICOON: { get: () => KAMER_ICOON }, AX: { get: () => AX }, TOESTEL: { get: () => TOESTEL }, erBoven: { get: () => erBoven },
      model: { get: () => model }, AIRCO: { get: () => AIRCO }, BY: { get: () => BY }, W: { get: () => W },
      RADIATOR: { get: () => RADIATOR }, aircoDak: { get: () => aircoDak }, plek: { get: () => plek }, tintenVan: { get: () => tintenVan },
      omhulsel: { get: () => omhulsel }, WITGOED: { get: () => WITGOED }, zoneSoort: { get: () => zoneSoort },
      soortVan: { get: () => soortVan }, MEUBELS_ALS: { get: () => MEUBELS_ALS }, MEUBEL: { get: () => MEUBEL },
      blokKamer: { get: () => blokKamer, set: (w) => {
          blokKamer = w;
        } },
      dezeKamer: { get: () => dezeKamer, set: (w) => {
          dezeKamer = w;
        } },
      radiatorZij: { get: () => radiatorZij, set: (w) => {
          radiatorZij = w;
        } },
    });
    const kamersDeel = global.huisKamers(ckamers);
    function vindKamer(...a) {
      return kamersDeel.vindKamer(...a);
    }
    function kleurAchter(...a) {
      return kamersDeel.kleurAchter(...a);
    }
    function sfeer(...a) {
      return kamersDeel.sfeer(...a);
    }
    function tekenKamer(...a) {
      return kamersDeel.tekenKamer(...a);
    }
    function kamerLabel(...a) {
      return kamersDeel.kamerLabel(...a);
    }
    function doos(...a) {
      return kamersDeel.doos(...a);
    }
    function aircoOnderDak(...a) {
      return kamersDeel.aircoOnderDak(...a);
    }
    function apparaat(...a) {
      return kamersDeel.apparaat(...a);
    }
    function inrichten(...a) {
      return kamersDeel.inrichten(...a);
    }

    // buiten: in kit/huis-buiten.js (opgesplitst op 22 november 2026). Wat het deel van de tekenaar deelt:
    const cbuiten = {};
    Object.defineProperties(cbuiten, {
      D: { get: () => D }, buiten: { get: () => buiten }, line: { get: () => line }, doos: { get: () => doos }, P: { get: () => P },
      k: { get: () => k }, winter: { get: () => winter }, nacht: { get: () => nacht }, huis: { get: () => huis }, poly: { get: () => poly },
      plek: { get: () => plek }, KLEUR: { get: () => KLEUR }, stilGekozen: { get: () => stilGekozen }, accuPlek: { get: () => accuPlek },
      buitenAchter: { get: () => buitenAchter }, model: { get: () => model }, id: { get: () => id }, schaduw: { get: () => schaduw },
      zonKracht: { get: () => zonKracht }, tikkenBoven: { get: () => tikkenBoven }, esc: { get: () => esc }, W: { get: () => W },
      eiland: { get: () => eiland }, FH: { get: () => FH }, voordeur: { get: () => voordeur }, netStraat: { get: () => netStraat },
      licht: { get: () => licht }, lagen: { get: () => lagen }, Ht: { get: () => Ht }, R: { get: () => R },
      burenVoor: { get: () => burenVoor }, lichter: { get: () => lichter }, defs: { get: () => defs }, grond: { get: () => grond },
      spook: { get: () => spook }, echteZon: { get: () => echteZon }, boom: { get: () => boom }, lantaarn: { get: () => lantaarn },
      opGrond: { get: () => opGrond }, omhulsel: { get: () => omhulsel }, opkomst: { get: () => opkomst }, kompas: { get: () => kompas },
    });
    const buitenDeel = global.huisBuiten(cbuiten);
    function bouwBuitenunit(...a) {
      return buitenDeel.bouwBuitenunit(...a);
    }
    function bouwVoordeur(...a) {
      return buitenDeel.bouwVoordeur(...a);
    }
    function bouwBatterij(...a) {
      return buitenDeel.bouwBatterij(...a);
    }
    function bouwGarage(...a) {
      return buitenDeel.bouwGarage(...a);
    }
    function plaatPanelen(...a) {
      return buitenDeel.plaatPanelen(...a);
    }
    function bouwJacuzzi(...a) {
      return buitenDeel.bouwJacuzzi(...a);
    }
    function bouwCarport(...a) {
      return buitenDeel.bouwCarport(...a);
    }
    function bouwAuto(...a) {
      return buitenDeel.bouwAuto(...a);
    }
    function bouwCamera(...a) {
      return buitenDeel.bouwCamera(...a);
    }
    function bouwTerras(...a) {
      return buitenDeel.bouwTerras(...a);
    }
    function bouwVoortuin(...a) {
      return buitenDeel.bouwVoortuin(...a);
    }
    function bouwBalkon(...a) {
      return buitenDeel.bouwBalkon(...a);
    }
    function bouwTuin(...a) {
      return buitenDeel.bouwTuin(...a);
    }
    function bouwNet(...a) {
      return buitenDeel.bouwNet(...a);
    }
    function bouwLagen(...a) {
      return buitenDeel.bouwLagen(...a);
    }
    function bouwEiland(...a) {
      return buitenDeel.bouwEiland(...a);
    }

    // tuin: in kit/huis-tuin.js (opgesplitst op 22 november 2026). Wat het deel van de tekenaar deelt:
    const ctuin = {};
    Object.defineProperties(ctuin, {
      grond: { get: () => grond }, poly: { get: () => poly }, nacht: { get: () => nacht }, KLEUR: { get: () => KLEUR }, P: { get: () => P },
      k: { get: () => k }, labels: { get: () => labels }, model: { get: () => model }, id: { get: () => id }, winter: { get: () => winter },
      defs: { get: () => defs }, schemer: { get: () => schemer }, buiten: { get: () => buiten }, doos: { get: () => doos },
      eiland: { get: () => eiland }, W: { get: () => W }, plek: { get: () => plek }, licht: { get: () => licht }, line: { get: () => line },
      bouwJacuzzi: { get: () => bouwJacuzzi }, plaatPanelen: { get: () => plaatPanelen },
      tuinVakken: { get: () => tuinVakken, set: (w) => {
          tuinVakken = w;
        } },
      tuinhuisVak: { get: () => tuinhuisVak, set: (w) => {
          tuinhuisVak = w;
        } },
    });
    const tuinDeel = global.huisTuin(ctuin);
    function kompas(...a) {
      return tuinDeel.kompas(...a);
    }
    function omhulsel(...a) {
      return tuinDeel.omhulsel(...a);
    }
    function boom(...a) {
      return tuinDeel.boom(...a);
    }
    function lantaarn(...a) {
      return tuinDeel.lantaarn(...a);
    }
    function bouwTuin3(...a) {
      return tuinDeel.bouwTuin3(...a);
    }
    function schaduw(...a) {
      return tuinDeel.schaduw(...a);
    }

    // Huis 3.0 overal (besluit 191): het eiland is de standaard, met de lucht van
    // de pagina erachter. Een pagina die het oude perceel wil, zegt `wereld: false`;
    // een eigen lucht achter het eiland is `eigenLucht: true`.
    /**
     * @type {{ wereld: boolean, eigenLucht: boolean, breedte?: number, hoogte?: number, marge?: number, zoom?: number,
     *   schuifX?: number, schuifY?: number, tik?: boolean, ruimte?: boolean, meubels?: boolean, controle?: boolean }}
     */
    const opts = { wereld: true, eigenLucht: false, ...kies };
    // Bij Weergave: het seizoen en het weer kunnen uit; dan een gewone groene dag.
    const klassen = typeof document !== 'undefined' ? document.documentElement.classList : null;
    // Zegt de pagina geen seizoen, dan dat van nu: Indeling en Inrichten
    // tekenden anders een zomer, terwijl Thuis al herfst had. Een schets zonder app blijft zoals hij is.
    if (!('seizoen' in model) && global.app?.seizoenNu) model = { ...model, seizoen: global.app.seizoenNu() };
    if (klassen?.contains('sc-geen-seizoen')) model = { ...model, seizoen: undefined };
    if (klassen?.contains('sc-geen-weer')) model = { ...model, weer: undefined };
    // De ring van de zon met de uren kan uit bij Weergave; de zon zelf blijft.
    // De baan van de zon uit bij Weergave (besluit 205): geen ring, en op Thuis ook geen stippelboog (`geenBaan`).
    if (klassen?.contains('sc-geen-zonnebaan') && model.zon) model = { ...model, zon: { ...model.zon, geenRing: true, geenBaan: true } };
    // De feestdag: wat het model zegt (een schets), anders vandaag, op het eiland, als het aan staat.
    const feest = model.feest !== undefined ? model.feest : opts.wereld && !klassen?.contains('sc-geen-feest') ? feestdagVan(Date.now()) : null;
    const id = `h${++uid}`;
    R = (model.etages ?? []).some((e) => e.dak && (e.kamers ?? []).length > 0) ? 2.0 : 1.15;
    // Met de nok langs de straat een dieper huis, zodat het dak met zijn echte helling een zolder overhoudt.
    D = model.dak?.nok === 'langs' ? 2.3 : 1.5;
    const breed = opts.breedte ?? 760;
    const hoog = opts.hoogte ?? 560;
    const g = opbouw(model);
    const { W, Ht } = g;
    /*
     * De gemeten helling (schets Wand-Huis-Ligging): de nok zo
     * hoog als de helling zegt, over de halve diepte (langs de straat) of de
     * halve breedte (haaks). Binnen grenzen, zodat de zolder een kamer blijft.
     */
    if (model.dak?.hellingDeg != null) {
      const halfweg = model.dak.nok === 'langs' ? D / 2 : W / 2;
      R = Math.max(0.9, Math.min(2.4, halfweg * Math.tan((model.dak.hellingDeg * Math.PI) / 180)));
    }

    // Schaal en oorsprong zo dat alles past, met marge.
    const raw = omtrek(model, g, opts).map(([x, y, z]) => proj(x, y, z));
    const minX = Math.min(...raw.map((p) => p[0]));
    const maxX = Math.max(...raw.map((p) => p[0]));
    const minY = Math.min(...raw.map((p) => p[1]));
    const maxY = Math.max(...raw.map((p) => p[1]));
    const marge = opts.marge ?? 0.08;
    const k = Math.min((breed * (1 - 2 * marge)) / (maxX - minX), (hoog * (1 - 2 * marge)) / (maxY - minY)) * (opts.zoom ?? 1);
    const ox = breed / 2 - ((minX + maxX) / 2) * k + (opts.schuifX ?? 0);
    const oy = hoog / 2 - ((minY + maxY) / 2) * k + (opts.schuifY ?? 0);
    const P = (x, y, z = 0) => {
      const [a, b] = proj(x, y, z);
      return [ox + a * k, oy + b * k];
    };
    const pt = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    const poly = (pts3, attrs) => `<polygon points="${pts3.map((p) => pt(P(...p))).join(' ')}" ${attrs}/>`;
    const line = (pts3, attrs) => `<polyline points="${pts3.map((p) => pt(P(...p))).join(' ')}" fill="none" ${attrs}/>`;

    const tijd = model.tijd ?? 'dag';
    const nacht = tijd === 'nacht';
    const schemer = tijd === 'avond' || tijd === 'ochtend';
    const winter = model.seizoen === 'winter';
    const zonKracht = model.zon?.aandeel ?? 0;
    /** Het lichte thema (besluit 181): het huis houdt zijn kleuren, de grond wordt lichter. */
    const licht = typeof document !== 'undefined' && document.documentElement.classList.contains('sc-licht');
    /**
     * In het licht is het donkere huis een zwarte vlek in een lichte lucht. Elke
     * donkere kleur van het huis, de verlopen en wat buiten staat gaat een tint
     * omhoog, tot leisteen: licht genoeg om niet zwart te zijn, donker genoeg
     * voor de witte namen en temperaturen op de muren. Lichte kleuren, zoals een
     * lamp die brandt, blijven zoals ze zijn.
     */
    const lichter = (tekst) => (!licht ? tekst : tekst.replace(/#([0-9a-f]{6})\b/gi, (m, h) => {
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      if (l >= 0.45) return m;
      const d = max - min;
      const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      const tint = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      const l2 = 0.24 + 0.78 * l;
      const c = (1 - Math.abs(2 * l2 - 1)) * sat;
      const x = c * (1 - Math.abs((tint % 2) - 1));
      const [r1, g1, b1] = tint < 1 ? [c, x, 0] : tint < 2 ? [x, c, 0] : tint < 3 ? [0, c, x] : tint < 4 ? [0, x, c] : tint < 5 ? [x, 0, c] : [c, 0, x];
      const hex = (v) => Math.round((v + l2 - c / 2) * 255).toString(16).padStart(2, '0');
      return `#${hex(r1)}${hex(g1)}${hex(b1)}`;
    }));

    const defs = [];
    const lucht = [];
    const grond = [];
    const huis = [];
    /** Een kamer in de kleur van zijn gekleurde lamp, 's avonds (besluit 129): een verloop per kleur. */
    const wassen = new Map();
    function kleurWas(kamer) {
      const kleur = kleurlampVan(kamer);
      if (!kleur) return null;
      if (!wassen.has(kleur)) {
        const n = `k${wassen.size}`;
        wassen.set(kleur, n);
        huis.push(`<defs><linearGradient id="${id}-w-${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${kleur}" stop-opacity="0.3"/><stop offset="1" stop-color="${kleur}" stop-opacity="0.58"/></linearGradient></defs>`);
      }
      return wassen.get(kleur);
    }
    const buiten = [];
    /** Wat buiten achter het huis staat, zoals de bomen en de haag van het eiland (huis 3.0). */
    const buitenAchter = [];
    const stromen = [];
    const labels = [];
    const kamers = [];
    // Met `opts.tik`: per kamer een onzichtbaar vlak om op te tikken, bovenop alles.
    const tikken = [];
    /** Wat boven de kamers ligt om op te tikken: de panelen (besluit 254, stap 5). */
    const tikkenBoven = [];
    /** De kamers onder het dak (de zolder): boven de panelen, anders vangt het dak de tik. */
    const tikkenDak = [];
    const tik = (kamer, pts, extra = '', onderDak = false) => {
      if (!opts.tik) return;
      const naam = esc(kamer.naam ?? '');
      (onderDak ? tikkenDak : tikken).push(poly(pts, `class="sc-tik" data-kamer="${esc(kamer.id ?? kamer.naam)}"${extra} fill="transparent" role="link" tabindex="0" aria-label="${naam}"`));
    };
    // Waar apparaten staan, voor de labels.
    const plek = {};
    /** Waar het tuinhuis echt getekend is, om erop te tikken (het vak stond ernaast). */
    let tuinhuisVak = null;
    /** Waar de zones van de tuin liggen (besluit 206): per soort een vak op de grond, om op te tikken. */
    let tuinVakken = {};
    /**
     * Onder het dak: waar de airco hangt (besluit 166), tegen de linkermuur of
     * op de achtermuur bij de nok; de droger staat er niet onder.
     */
    let aircoDak = null;
    /** Heeft de inrichting de achterwand nodig, dan hangt de radiator aan de zijmuur. */
    let radiatorZij = false;
    /** Is er een etage boven de kamer die nu getekend wordt? Alleen dan een trap. */
    let erBoven = false;
    /** De kamer waarvan nu de apparaten getekend worden, voor de controle. */
    let blokKamer = null;
    /** En die kamer zelf: de airco zoekt een plek naast het raam (besluit 131). */
    let dezeKamer = null;
    /** Met `opts.controle`: elk meubel en apparaat als blok, voor de tests. */
    const controle = [];

    /* ---- verlopen ---- */
    defs.push(`
      <linearGradient id="${id}-muur" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${nacht ? '#1b2639' : winter ? '#2a3546' : '#2b3a4c'}"/>
        <stop offset="1" stop-color="${nacht ? '#121a28' : winter ? '#1e2836' : '#1d2836'}"/>
      </linearGradient>
      <linearGradient id="${id}-rand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${KLEUR.zon}" stop-opacity="${(0.16 * zonKracht).toFixed(2)}"/><stop offset="1" stop-color="${KLEUR.zon}" stop-opacity="0"/></linearGradient>
      <linearGradient id="${id}-dak" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${nacht ? '#172133' : '#26344a'}"/>
        <stop offset="1" stop-color="${nacht ? '#0f1726' : '#1a2536'}"/>
      </linearGradient>
      <linearGradient id="${id}-paneel" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${zonKracht > 0 ? '#3b5c86' : '#1f3049'}"/>
        <stop offset="1" stop-color="${zonKracht > 0 ? '#1d3354' : '#152238'}"/>
      </linearGradient>
      <linearGradient id="${id}-glans" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${KLEUR.zon}" stop-opacity="0"/>
        <stop offset="0.5" stop-color="${KLEUR.zon}" stop-opacity="${(0.55 * zonKracht).toFixed(2)}"/>
        <stop offset="1" stop-color="${KLEUR.zon}" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="${id}-vloer" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#363e4b"/><stop offset="1" stop-color="#262d38"/></linearGradient>
      ${[['lamp', '#FFB765', 0.5], ['koelt', KLEUR.ijs, 0.62], ['wacht', KLEUR.zon, 0.42], ['goed', KLEUR.mint, 0.34], ['verwarmt', KLEUR.gloed, 0.6], ['rust', '#9fb3c8', 0.1]]
        .map(([st, c, o]) => `<linearGradient id="${id}-w-${st}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="${(o * 0.5).toFixed(2)}"/><stop offset="1" stop-color="${c}" stop-opacity="${o}"/></linearGradient>`)
        .join('')}
      <linearGradient id="${id}-hoek" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.38"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
      <linearGradient id="${id}-gras" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${licht ? (winter ? '#c4cfda' : nacht ? '#8fa79a' : '#a3c2ad') : winter ? '#2b3a4a' : nacht ? '#0f1a1a' : '#1b2c27'}"/><stop offset="1" stop-color="${licht ? (winter ? '#b3c0cd' : nacht ? '#7f988b' : '#8fb39b') : winter ? '#1f2b38' : nacht ? '#0b1414' : '#14211e'}"/></linearGradient>
      <radialGradient id="${id}-zon"><stop offset="0" stop-color="#FFE7A8"/><stop offset="0.35" stop-color="${KLEUR.zon}"/><stop offset="1" stop-color="${KLEUR.zon}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}-licht"><stop offset="0" stop-color="#FFD9A0" stop-opacity="0.55"/><stop offset="1" stop-color="#FFD9A0" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}-koel"><stop offset="0" stop-color="${KLEUR.ijs}" stop-opacity="0.45"/><stop offset="1" stop-color="${KLEUR.ijs}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}-warm"><stop offset="0" stop-color="${KLEUR.gloed}" stop-opacity="0.45"/><stop offset="1" stop-color="${KLEUR.gloed}" stop-opacity="0"/></radialGradient>
      <filter id="${id}-zacht" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(k * 0.12).toFixed(1)}"/></filter>
      <filter id="${id}-gloed" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(k * 0.05).toFixed(1)}"/></filter>
    `);

    /*
     * ---- de verte (huis 3.0) ----
     * In de wereld: heuvels aan de horizon, in lagen die naar achteren lichter
     * en vager worden, en een gloed van de lucht erachter. Zo krijgt het eiland
     * diepte zonder dat het de aandacht trekt.
     * Met `opts.eigenLucht: false` (de telefoon) niet: dan staat het eiland in
     * de lucht van de pagina.
     */
    if (eilandVan(model, W, opts) && opts.eigenLucht !== false) {
      const horizon = hoog * 0.78;
      // Een eigen lucht per moment: overdag licht naar de horizon toe, 's avonds warm, 's nachts diep.
      const bewolkt = (model.wolken ?? 0) > 0.7 || model.weer === 'regen';
      const verloop = nacht ? ['#060c1c', '#0d1830', '#1a2a4c'] : schemer ? ['#1e1a40', '#5a3a68', '#e88a5e'] : model.weer === 'sneeuw' || (winter && !bewolkt) ? ['#33435a', '#62809e', '#c3d2e0'] : bewolkt ? ['#26323f', '#45566a', '#7d8d9e'] : ['#173563', '#2d68a3', '#8fc6e8'];
      lucht.push(`<defs><linearGradient id="${id}-hemel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${verloop[0]}"/><stop offset="0.6" stop-color="${verloop[1]}"/><stop offset="1" stop-color="${verloop[2]}"/></linearGradient></defs>`);
      lucht.push(`<rect x="0" y="0" width="${breed}" height="${hoog}" fill="url(#${id}-hemel)"/>`);
      const tint = nacht ? ['#101a30', '#16223c', '#1c2a48'] : schemer ? ['#5a3a5a', '#6e4660', '#8a5566'] : winter ? ['#8fa3b8', '#a7b8ca', '#bccbda'] : model.weer === 'regen' ? ['#4a5868', '#5a6878', '#6b7988'] : ['#3d6f8f', '#5a8fae', '#7fb0cb'];
      lucht.push(`<defs><radialGradient id="${id}-horizon" cx="0.5" cy="1" r="0.8"><stop offset="0" stop-color="${schemer ? '#ff9a6b' : nacht ? '#4a5f9a' : '#8fc0e8'}" stop-opacity="${schemer ? 0.32 : nacht ? 0.18 : 0.22}"/><stop offset="1" stop-color="#8fc0e8" stop-opacity="0"/></radialGradient></defs>`);
      lucht.push(`<rect x="0" y="${(horizon - hoog * 0.55).toFixed(0)}" width="${breed}" height="${(hoog * 0.7).toFixed(0)}" fill="url(#${id}-horizon)"/>`);
      [0.0, 0.06, 0.12].forEach((dy, i) => {
        const y = horizon + dy * hoog;
        const pts = Array.from({ length: 13 }, (_, j) => {
          const x = (breed * j) / 12;
          return `${x.toFixed(0)},${(y - Math.abs(Math.sin(j * 0.9 + i * 1.7)) * hoog * (0.05 - i * 0.012)).toFixed(0)}`;
        });
        lucht.push(`<polygon points="0,${hoog} ${pts.join(' ')} ${breed},${hoog}" fill="${tint[2 - i]}" opacity="${(0.55 + i * 0.15).toFixed(2)}"/>`);
      });
    }

    /* ---- lucht: zon, maan, sterren, wolken (achter het huis) ---- */
    const mid = P(W / 2, D / 2, Ht + R * 0.6);
    const boog = k * Math.max(W, 4.2) * 0.95;
    /*
     * Waar de zon opkomt: aan de kant van het oosten. Rechts
     * in de tekening ligt de richting van het kompas min 90° (zie kompas);
     * `zon.opRechts` zegt het, anders het kompas van het model, anders links.
     * Eerst kwam hij altijd links op, ook als daar het westen lag.
     */
    const opRechts = model.zon?.opRechts ?? (voorDegVan(model) != null ? Math.cos(((180 - voorDegVan(model)) * Math.PI) / 180) > 0.5 : false);
    const opkomst = opRechts ? 1 : -1;
    /*
     * De echte zon (schets Wand-Huis-Ligging): met `zon.nu`
     * ({ az, el } in graden) en het kompas staat hij waar hij echt staat. Een
     * richting op de grond ligt in de tekening zoals het kompas hem tekent; de
     * lucht laat zien hoe die richting van links naar rechts valt, en hoe hoog
     * de zon staat. `zon.baan` is de baan van vandaag, van opkomst tot ondergang.
     */
    const voorgevelDeg = voorDegVan(model);
    const echteZon = model.zon?.nu && voorgevelDeg != null ? model.zon.nu : null;
    const opGrond = (az) => [-Math.sin(((az - voorgevelDeg) * Math.PI) / 180), Math.cos(((az - voorgevelDeg) * Math.PI) / 180)];
    /*
     * De baan van de dag als een ring rond het huis: in 3D,
     * van opkomst tot ondergang, zo hoog als de zon staat. Wat achter het huis
     * loopt, valt achter het huis; wat ervoor loopt, ervoor (`zonVoor`). Wat al
     * voorbij is, doorgetrokken; wat nog komt, gestippeld. Laag oranje, hoog
     * lichtgeel. Bij de uren een stip, bij opkomst en ondergang de tijd.
     */
    const zonVoor = [];
    /** Waar de zon nu in beeld staat, voor de bundel naar het dakvlak dat licht vangt. */
    let zonInBeeld = null;
    if (echteZon && !nacht) {
      const rad = Math.PI / 180;
      const op3 = (p) => ringPunt(model, W, Ht, p);
      // Uit bij Weergave (`geenRing`): geen ring en geen uren, alleen de zon.
      const baan = metRing(model) ? model.zon.baan.filter((p) => p.el > -1.5) : [];
      const top = Math.max(20, ...baan.map((p) => p.el));
      const kleur = (el) => {
        const f = Math.max(0, Math.min(1, el / top));
        const mix = (a, b) => Math.round(a + (b - a) * f).toString(16).padStart(2, '0');
        return `#${mix(0xff, 0xff)}${mix(0x8a, 0xe8)}${mix(0x4c, 0xa8)}`;
      };
      const voor = (p) => op3(p)[1] > D / 2 + 0.4;
      // Een zachte gloed onder de hele ring, achter het huis.
      if (baan.length > 1) lucht.push(`<polyline points="${baan.map((p) => pt(P(...op3(p)))).join(' ')}" fill="none" stroke="#FFC46B" stroke-width="${(k * 0.16).toFixed(1)}" stroke-opacity="0.07" stroke-linecap="round" filter="url(#${id}-zacht)"/>`);
      for (let i = 0; i < baan.length - 1; i++) {
        const a = baan[i];
        const b = baan[i + 1];
        const gedaan = echteZon.t != null && b.t != null && b.t <= echteZon.t;
        const laag = voor({ az: (a.az + b.az) / 2, el: (a.el + b.el) / 2 }) ? zonVoor : lucht;
        laag.push(`<line x1="${P(...op3(a))[0].toFixed(1)}" y1="${P(...op3(a))[1].toFixed(1)}" x2="${P(...op3(b))[0].toFixed(1)}" y2="${P(...op3(b))[1].toFixed(1)}" stroke="${kleur((a.el + b.el) / 2)}" stroke-width="${gedaan ? 2.6 : 1.6}" stroke-opacity="${laag === zonVoor ? (gedaan ? 0.42 : 0.28) : gedaan ? 0.85 : 0.6}" stroke-linecap="round" ${gedaan ? '' : 'stroke-dasharray="1 6"'}/>`);
      }
      // De uren, om de drie uur, en de tijd van opkomst en ondergang.
      for (const p of baan) {
        if (p.uur == null || p.uur % 3 !== 0 || p.el < 1) continue;
        const q = P(...op3(p));
        const laag = voor(p) ? zonVoor : lucht;
        laag.push(`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3" fill="${kleur(p.el)}" opacity="0.85"/>`);
        laag.push(`<text x="${q[0].toFixed(1)}" y="${(q[1] - 9).toFixed(1)}" text-anchor="middle" font-family="Figtree, sans-serif" font-size="11.5" font-weight="700" fill="${kleur(p.el)}" opacity="0.8" stroke="#0a1220" stroke-opacity="0.6" stroke-width="3" paint-order="stroke">${p.uur}</text>`);
      }
      for (const [p, pijl] of [[baan[0], '↑'], [baan[baan.length - 1], '↓']]) {
        if (!p?.klok) continue;
        const q = P(...op3({ ...p, el: Math.max(0, p.el) }));
        const laag = voor(p) ? zonVoor : lucht;
        laag.push(`<path d="M ${(q[0] - 9).toFixed(1)} ${q[1].toFixed(1)} a 9 9 0 0 1 18 0 z" fill="#FF9A55" opacity="0.85"/><line x1="${(q[0] - 14).toFixed(1)}" y1="${q[1].toFixed(1)}" x2="${(q[0] + 14).toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="#FFB27A" stroke-width="1.5" opacity="0.8"/>`);
        laag.push(`<text x="${q[0].toFixed(1)}" y="${(q[1] + 18).toFixed(1)}" text-anchor="middle" font-family="Figtree, sans-serif" font-size="12" font-weight="700" fill="#FFC79A" stroke="#0a1220" stroke-opacity="0.6" stroke-width="3" paint-order="stroke">${pijl} ${esc(p.klok)}</text>`);
      }
      // De zon zelf: een gloed, een krans van stralen en een kern.
      if (echteZon.el > 0) {
        const q = P(...op3(echteZon));
        zonInBeeld = q;
        const laag = voor(echteZon) ? zonVoor : lucht;
        // Vóór het huis wat zachter: het huis blijft leesbaar.
        const helder = (1 - 0.5 * (model.wolken ?? 0)) * (laag === zonVoor ? 0.8 : 1);
        defs.push(`<radialGradient id="${id}-kern"><stop offset="0" stop-color="#FFFBEA"/><stop offset="0.55" stop-color="#FFE29A"/><stop offset="1" stop-color="#FFB547"/></radialGradient>`);
        laag.push(`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${(k * 1.1).toFixed(1)}" fill="url(#${id}-zon)" opacity="${(0.55 * helder).toFixed(2)}"/>`);
        laag.push(`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${(k * 0.5).toFixed(1)}" fill="#FFD27A" opacity="${(0.16 * helder).toFixed(2)}" filter="url(#${id}-zacht)"/>`);
        const stralen = Array.from({ length: 12 }, (_, i) => {
          const h = (i * 30 + 15) * rad;
          const [r0, r1] = [k * 0.32, k * (i % 2 ? 0.44 : 0.52)];
          return `<line x1="${(q[0] + Math.cos(h) * r0).toFixed(1)}" y1="${(q[1] + Math.sin(h) * r0).toFixed(1)}" x2="${(q[0] + Math.cos(h) * r1).toFixed(1)}" y2="${(q[1] + Math.sin(h) * r1).toFixed(1)}"/>`;
        }).join('');
        laag.push(`<g stroke="#FFD98A" stroke-width="2" stroke-linecap="round" opacity="${(0.7 * helder).toFixed(2)}">${stralen}</g>`);
        laag.push(`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${(k * 0.24).toFixed(1)}" fill="url(#${id}-kern)" opacity="${helder.toFixed(2)}"/>`);
      }
    } else if (model.zon?.stand != null && !nacht) {
      // De zon staat óp de boog: een halve ellips van opkomst tot ondergang,
      // en `stand` is de hoek erlangs. Zo valt hij nooit naast de stippellijn,
      // ook niet halverwege de ochtend.
      const f = Math.max(0, Math.min(1, model.zon.stand));
      const voet = mid[1] + boog * 0.12;
      // Nooit boven de tekening uit: daar staat op een pagina de tekst.
      // Dan wordt de hele boog lager, niet alleen de zon: zo blijft hij op de lijn.
      const ry = Math.min(boog * 0.74, voet - k * 0.3);
      const sx = mid[0] + opkomst * boog * Math.cos(Math.PI * f);
      const sy = voet - ry * Math.sin(Math.PI * f);
      if (!model.zon.geenBaan) lucht.push(`<path d="M ${mid[0] - boog} ${voet} A ${boog} ${ry} 0 0 1 ${mid[0] + boog} ${voet}" fill="none" stroke="${KLEUR.zon}" stroke-opacity="0.16" stroke-width="1.5" stroke-dasharray="2 7"/>`);
      const r = k * 0.22;
      lucht.push(`<circle cx="${sx}" cy="${sy}" r="${r * 3.2}" fill="url(#${id}-zon)" opacity="${(0.22 + 0.3 * (1 - (model.wolken ?? 0))).toFixed(2)}"/>`);
      lucht.push(`<circle cx="${sx}" cy="${sy}" r="${r}" fill="#FFD27A" opacity="${(1 - 0.55 * (model.wolken ?? 0)).toFixed(2)}"/>`);
    }
    if (nacht) {
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 46; i++) {
        lucht.push(`<circle cx="${(rnd() * breed).toFixed(0)}" cy="${(rnd() * hoog * 0.5).toFixed(0)}" r="${(0.5 + rnd() * 1.1).toFixed(1)}" fill="#fff" opacity="${(0.25 + rnd() * 0.5).toFixed(2)}"/>`);
      }
      const mx = mid[0] + boog * 0.5;
      const my = Math.max(k * 0.5, mid[1] - boog * 0.55);
      lucht.push(`<circle cx="${mx}" cy="${my}" r="${k * 0.42}" fill="${licht ? '#ffffff' : '#E8EEF8'}" opacity="${licht ? 0.5 : 0.08}"/><circle cx="${mx}" cy="${my}" r="${k * 0.2}" fill="${licht ? '#ffffff' : '#E9EEF6'}"/><circle cx="${mx + k * 0.08}" cy="${my - k * 0.05}" r="${k * 0.18}" fill="${licht ? '#d6dcea' : '#101a2b'}"/>`);
    }
    if (model.wolken) {
      const n = Math.round(2 + model.wolken * 3);
      for (let i = 0; i < n; i++) {
        const cx = mid[0] + (i / Math.max(1, n - 1) - 0.5) * boog * 1.7;
        const cy = mid[1] - boog * (0.35 + 0.18 * ((i * 37) % 3) / 2);
        const s = k * (0.7 + ((i * 53) % 5) * 0.12);
        // In het lichte thema grijs: witte wolken waren tegen de lichte lucht niet te zien.
        const wolkOnder = licht ? '#aab7c8' : opts.wereld && !nacht ? '#ffffff' : winter ? '#9fb0c2' : '#8a9bb0';
        const wolkBoven = licht ? '#bcc7d6' : opts.wereld && !nacht ? '#f4f7fb' : winter ? '#aebdcc' : '#94a5b9';
        lucht.push(`<g opacity="${((licht ? 0.6 : 0.25) + 0.35 * model.wolken).toFixed(2)}" filter="url(#${id}-zacht)"><ellipse cx="${cx}" cy="${cy}" rx="${s * 1.5}" ry="${s * 0.42}" fill="${wolkOnder}"/><ellipse cx="${cx + s * 0.4}" cy="${cy - s * 0.25}" rx="${s * 0.8}" ry="${s * 0.45}" fill="${wolkBoven}"/></g>`);
      }
    }

    /*
     * De voordeur (rapport 15 oktober): in de hal op de begane grond, anders in
     * de eerste kamer. Het huis is aan de voorkant open, dus de deur staat in de
     * snijlijn: het kozijn, en de deur half open naar binnen. Ernaast de
     * deurbel, en in de hal de meterkast. Alleen als het model een voordeur
     * vraagt, en niet ingezoomd op één etage.
     */
    const begane = g.etages.filter((e) => !e.dak)[0];
    const voordeur = (() => {
      if (!model.voordeur || !begane || model.zonderDak) return null;
      const tot = begane.kamers.reduce((t, x) => t + (x.gewicht ?? 1), 0);
      let x = 0;
      let hal = null;
      let eerste = null;
      for (const kamer of begane.kamers) {
        const b = (W * (kamer.gewicht ?? 1)) / tot;
        eerste ??= { x0: x, x1: x + b };
        if (!hal && soortVanKamer(kamer) === 'hal') hal = { x0: x, x1: x + b };
        x += b;
      }
      const r = hal ?? eerste;
      if (!r) return null;
      const breed = 0.48;
      const xd = Math.min(r.x1 - breed - 0.14, Math.max(r.x0 + 0.18, (r.x0 + r.x1) / 2 - breed / 2 + 0.12));
      return { x0: xd, x1: xd + breed, kamer: r, deurbel: model.voordeur.deurbel ?? null };
    })();

    /*
     * De wereld (huis 3.0): het perceel als een eiland in de lucht, met de
     * voorkant als één doorsnede door huis en grond. Alleen met `opts.wereld`,
     * en niet ingezoomd of bij een appartement.
     */
    const eiland = eilandVan(model, W, opts);
    /** Waar de batterij staat: op het eiland (huis 3.0) dun aan de zijgevel achteraan, ver van de buitenunit voorin. */
    // In de garage (besluit 270): plat tegen de voorgevel van de garage, rechts naast de kanteldeur.
    const accuPlek = model.batterij?.plek === 'garage' && model.garage ? { x: -1.3, y: -0.5, garage: true } : eiland ? { x: W + 0.02, y: 0.12, wand: true } : { x: W + 0.02, y: D - 0.75 };

    /** Waar de kabel van het net het perceel in komt: aan de straat, voor de meterkast. */
    const netStraat = eiland ? [eiland.x0 + 0.45, eiland.yF - 0.28] : voordeur ? [Math.max(0.2, voordeur.x0 - 0.35), D + 1.8] : [-0.6, D + 1.1];

    /* ---- grond: het perceel, de oprit ---- */
    // Ingezoomd op een etage: alleen een smalle rand grond om het huis.
    // Zonder dak strak om het huis, tenzij de oprit of de tuin erbij hoort (de begane grond).
    const gx0 = model.auto || model.oprit || spook(model, 'auto') || opts.ruimte ? -3.0 : model.zonderDak ? -0.45 : -1.4;
    const gx1 = model.tuin || model.terras ? W + 2.1 : model.zonderDak ? W + 0.75 : W + 1.3;
    const gy0 = model.tuin || model.garage ? -2.1 : model.zonderDak ? -0.35 : -0.6;
    const gy1 = model.oprit || model.voortuin ? D + 1.9 : model.zonderDak ? D + 0.7 : D + 1.9;
    grond.push(poly([[gx0, gy0, 0], [gx1, gy0, 0], [gx1, gy1, 0], [gx0, gy1, 0]], `fill="url(#${id}-gras)"`));
    // De rand van het perceel, als een dikke plaat.
    grond.push(poly([[gx0, gy1, 0], [gx1, gy1, 0], [gx1, gy1, -0.18], [gx0, gy1, -0.18]], `fill="${licht ? '#6f8a79' : '#0b1219'}"`));
    grond.push(poly([[gx1, gy0, 0], [gx1, gy1, 0], [gx1, gy1, -0.18], [gx1, gy0, -0.18]], `fill="${licht ? '#5e7768' : '#080e14'}"`));
    // Een pad van tegels naar de voordeur.
    const padX = voordeur ? [voordeur.x0, voordeur.x1] : [0.5, 1.0];
    for (let i = 0; i < (model.zonderDak ? 0 : 4); i++) {
      const y0 = D + 0.18 + i * 0.36;
      grond.push(poly([[padX[0], y0, 0.004], [padX[1], y0, 0.004], [padX[1], y0 + 0.26, 0.004], [padX[0], y0 + 0.26, 0.004]], `fill="#ffffff" opacity="${voordeur ? 0.08 : 0.05}"`));
    }
    // Een tuin is gras, en lichter dan de rest van het perceel; met een terras onder het zonnescherm.
    if (model.tuin && !model.zonderDak) {
      grond.push(poly([[W + 0.3, -1.95, 0.003], [W + 2.05, -1.95, 0.003], [W + 2.05, 0.25, 0.003], [W + 0.3, 0.25, 0.003]], `fill="${licht ? (winter ? '#d3dce5' : '#86b294') : winter ? '#33465a' : nacht ? '#173326' : '#26503a'}"`));
      if (model.tuin.zonnescherm) {
        const tx0 = W + 0.06;
        const tx1 = W + 1.05;
        grond.push(poly([[tx0, 0.06, 0.005], [tx1, 0.06, 0.005], [tx1, 1.0, 0.005], [tx0, 1.0, 0.005]], `fill="${licht ? '#c3cad2' : '#3b4652'}"`));
        for (let x = tx0 + 0.25; x < tx1 - 0.05; x += 0.25) grond.push(line([[x, 0.06, 0.007], [x, 1.0, 0.007]], 'stroke="#2c353f" stroke-width="1"'));
        for (let y = 0.31; y < 0.97; y += 0.25) grond.push(line([[tx0, y, 0.007], [tx1, y, 0.007]], 'stroke="#2c353f" stroke-width="1"'));
      }
    }
    if (model.auto || model.oprit || spook(model, 'auto')) {
      grond.push(poly([[-2.75, -0.4, 0.005], [-1.2, -0.4, 0.005], [-1.2, D + 1.7, 0.005], [-2.75, D + 1.7, 0.005]], `fill="${licht ? '#b9c2cb' : '#1d2933'}"`));
    }
    // Schaduw onder het huis.
    grond.push(`<g filter="url(#${id}-zacht)" opacity="0.6">${poly([[0.1, 0.1, 0], [W + 0.25, 0.1, 0], [W + 0.25, D + 0.25, 0], [0.1, D + 0.25, 0]], `fill="${licht ? '#3a4a58' : '#05090d'}"`)}</g>`);
    // De wereld vervangt het perceel (huis 3.0).
    const lagen = lagenVan(model);
    if (eiland) {
      grond.length = 0;
      const [vanAchter, vanBuiten, vanLabels] = [buitenAchter.length, buiten.length, labels.length];
      bouwEiland();
      // Een etage hoger (de vage lagen): het hele eiland, met zijn bomen en lantaarn, een etage omlaag.
      if (lagen?.zak) {
        const omlaag = (lijst, van) => {
          const stuk = lijst.splice(van).join('');
          if (stuk) lijst.push(`<g transform="translate(0 ${(lagen.zak * k).toFixed(1)})">${stuk}</g>`);
        };
        omlaag(grond, 0);
        omlaag(buitenAchter, vanAchter);
        omlaag(buiten, vanBuiten);
        omlaag(labels, vanLabels);
      }
    }

    /*
     * ---- de kelder (huis 3.0): opengewerkt in de grond ----
     * Onder de begane grond, net zo open als de rest. Eromheen de aarde als
     * doorsnede, met een paar lagen, zodat je ziet dat hij onder de grond ligt.
     * Geen ramen in de achtermuur; de rechtergevel is aarde.
     */
    if (model.kelder && !model.zonderDak) {
      const kz = -FH;
      const bodem = kz - 0.3;
      const aarde = licht ? ['#a08c74', '#8c7963', '#7a6955'] : ['#2b241e', '#231d18', '#1c1713'];
      // In de wereld ligt de kelder in een nis in de doorsnede: daar is de aarde al.
      if (!eiland) {
      // De zijkant van de aarde rechts, dan de voorkant.
      huis.push(poly([[W + 0.35, D, 0], [W + 0.35, -0.6, 0], [W + 0.35, -0.6, bodem], [W + 0.35, D, bodem]], `fill="${aarde[2]}"`));
      huis.push(poly([[-0.35, D, 0], [W + 0.35, D, 0], [W + 0.35, D, bodem], [-0.35, D, bodem]], `fill="${aarde[0]}"`));
      for (const [f, o] of [[0.22, 0.5], [0.55, 0.35], [0.85, 0.25]]) {
        const zl = bodem * f;
        huis.push(line([[-0.35, D + 0.002, zl], [W * 0.3, D + 0.002, zl - 0.04], [W * 0.65, D + 0.002, zl + 0.03], [W + 0.35, D + 0.002, zl - 0.02]], `stroke="${aarde[1]}" stroke-opacity="${o}" stroke-width="3"`));
      }
      // Een paar steentjes in de aarde.
      for (const [x, z] of [[-0.2, -0.5], [W + 0.2, -1.1], [-0.15, -1.4], [W + 0.22, -0.35]]) {
        const c = P(x, D + 0.003, z);
        huis.push(`<ellipse cx="${c[0]}" cy="${c[1]}" rx="${(k * 0.06).toFixed(1)}" ry="${(k * 0.035).toFixed(1)}" fill="${aarde[1]}"/>`);
      }
      }
      const kamersK = model.kelder.kamers ?? [];
      const totaalK = kamersK.reduce((s2, k2) => s2 + (k2.gewicht ?? 1), 0) || 1;
      let xk = 0;
      erBoven = true;
      for (const kamer of kamersK) {
        const x1 = xk + (W * (kamer.gewicht ?? 1)) / totaalK;
        tekenKamer({ ...kamer, geenRaam: true }, xk, x1, kz, 0, false);
        xk = x1;
      }
      // Het plafond van de kelder als doorsnede, en de grondlijn erboven.
      huis.push(poly([[0, D, 0], [W, D, 0], [W, D, -0.09], [0, D, -0.09]], `fill="#3c4a5b"`));
      if (!eiland) huis.push(line([[-0.35, D + 0.004, 0], [W + 0.35, D + 0.004, 0]], `stroke="${licht ? '#6f8a79' : '#3f6b52'}" stroke-width="3"`));
    }

    // Wat na het huis komt en ervoor ligt, zoals de verdiepingen boven een appartement.
    const burenVoor = [];
    if (lagen) bouwLagen();
    /*
     * ---- een appartement (huis 3.0) ----
     * Jouw verdieping in het gebouw: de verdiepingen eronder en erboven als
     * vage gevels die naar boven en onder vervagen, zonder perceel eromheen.
     * Panelen op het gezamenlijke dak, als die er zijn.
     */
    const appartement = model.woning === 'appartement' && !model.zonderDak ? gebouwVan(model) : null;
    if (appartement) {
      grond.length = 0;
      const gid = `${id}-gebouw`;
      const kleur = licht ? '#9fb0c2' : '#41536a';
      defs.push(`<linearGradient id="${gid}-o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${kleur}" stop-opacity="0.8"/><stop offset="1" stop-color="${kleur}" stop-opacity="0.05"/></linearGradient><linearGradient id="${gid}-b" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${kleur}" stop-opacity="0.75"/><stop offset="1" stop-color="${kleur}" stop-opacity="0.1"/></linearGradient>`);
      const zo = -appartement.onder * FH;
      const zb = Ht + appartement.boven * FH;
      const vlak = (z0v, z1v, verloop) => {
        grond.push(poly([[W, 0, z0v], [W, D, z0v], [W, D, z1v], [W, 0, z1v]], `fill="url(#${gid}-${verloop})" opacity="0.7"`));
        grond.push(poly([[0, D, z0v], [W, D, z0v], [W, D, z1v], [0, D, z1v]], `fill="url(#${gid}-${verloop})"`));
        for (let z = z0v; z < z1v - 0.01; z += FH) {
          for (const rx of [0.3, W * 0.55]) grond.push(poly([[rx, D + 0.002, z + 0.45], [rx + 0.7, D + 0.002, z + 0.45], [rx + 0.7, D + 0.002, z + FH - 0.35], [rx, D + 0.002, z + FH - 0.35]], `fill="${nacht ? '#F4C27E' : '#8fb1d1'}" opacity="${nacht ? 0.22 : 0.12}"`));
          grond.push(line([[0, D + 0.003, z], [W, D + 0.003, z]], 'stroke="#C9D6E2" stroke-opacity="0.15" stroke-width="1.2"'));
        }
      };
      if (appartement.onder > 0) vlak(zo, 0, 'o');
      // Erboven alleen de gevels: het dak van het gebouw ligt erop, de kamers blijven te zien.
      if (appartement.boven > 0) burenVoor.push((() => {
        const voor = grond.length;
        vlak(Ht, zb, 'b');
        grond.push(poly([[0, 0, zb], [W, 0, zb], [W, D, zb], [0, D, zb]], `fill="${kleur}" opacity="0.35"`));
        return grond.splice(voor).join('');
      })());
      if (appartement.panelen) {
        const voor = buiten.length;
        plaatPanelen(0.2, 0.15, W - 0.4, D - 0.3, zb + 0.02, appartement.panelen);
        burenVoor.push(buiten.splice(voor).join(''));
        plek.panelenGebouw = [W / 2, D / 2, zb + 0.2];
      }
    }

    /* ---- het huis, etage voor etage, van onder naar boven ---- */
    let z0 = 0;
    const gewoon = g.etages.filter((e) => !e.dak);
    const dakEtage = g.etages.find((e) => e.dak);
    for (const [ei, etage] of gewoon.entries()) {
      const z1 = z0 + FH;
      // Een etage die alleen getekend wordt (ingezoomd), zegt het zelf: `erBoven`.
      erBoven = ei < gewoon.length - 1 || (dakEtage?.kamers ?? []).length > 0 || etage.erBoven === true;
      const totaal = etage.kamers.reduce((s, k2) => s + (k2.gewicht ?? 1), 0);
      let x0 = 0;
      for (const kamer of etage.kamers) {
        const x1 = x0 + (W * (kamer.gewicht ?? 1)) / totaal;
        tekenKamer(kamer, x0, x1, z0, z1, false);
        x0 = x1;
      }
      // De vloer als doorsnede: een strook aan de voorkant.
      huis.push(poly([[0, D, z0], [W, D, z0], [W, D, z0 - 0.09], [0, D, z0 - 0.09]], `fill="#3c4a5b"`));
      z0 = z1;
    }

    // Een plat dak op het hoofdhuis (issue 131): geen puntdak, maar een plaat met een rand, en de panelen erop in rijen.
    const platDak = !model.zonderDak && !appartement && model.dak?.plat === true;
    const dak = !model.zonderDak && !appartement && !platDak;
    // De zoldervloer (zv) en de dakvoet (zt): daartussen het knieschot, als de zolder gebruikt wordt.
    const zv = z0;
    const zt = z0 + (dak ? g.knie : 0);
    /** Het knieschot achter en opzij: een rechte wand van de vloer tot de dakvoet. */
    const knieschot = (pts, kleur) => {
      if (zt > zv) huis.push(poly(pts, `fill="${kleur}"`));
    };
    /*
     * De nok langs de straat (schets Wand-Huis-Ligging): de
     * dakvlakken liggen voor en achter, de gevels links en rechts lopen door tot
     * de nok. Het voorste dakvlak is van glas, zodat je de zolder blijft zien;
     * de achterwand van de zolder is het achterste dakvlak, van binnen gezien.
     * Zonder `dak.nok` blijft het zoals het was: de nok van voor naar achter.
     */
    const nokLangs = dak && model.dak?.nok === 'langs';
    /** Hoe fel de zon nu op een dakvlak schijnt (0 tot 1), met de echte zon; null zonder. */
    const opVlak = (vlakDeg) => {
      if (!echteZon || echteZon.el <= 0) return null;
      const r = Math.PI / 180;
      const helling = (model.dak?.hellingDeg ?? 45) * r;
      const c = Math.sin(echteZon.el * r) * Math.cos(helling) + Math.cos(echteZon.el * r) * Math.sin(helling) * Math.cos((echteZon.az - vlakDeg) * r);
      return Math.max(0, Math.min(1, c));
    };
    if (nokLangs) {
      const onderDak = dakEtage?.kamers ?? [];
      const nok = D / 2;
      const totaal = onderDak.reduce((t, k2) => t + (k2.gewicht ?? 1), 0) || 1;
      let x0 = 0;
      for (const kamer of onderDak.length ? onderDak : [null]) {
        const x1 = kamer ? x0 + (W * (kamer.gewicht ?? 1)) / totaal : W;
        const lampAan = (kamer?.apparaten ?? []).some((a) => a.soort === 'lamp' && a.aan);
        const donker = nacht && !lampAan;
        // De achterwand: het knieschot recht omhoog, dan het dakvlak schuin naar de nok.
        const achter = [[x0, 0, zv], [x1, 0, zv], [x1, 0, zt], [x1, nok, zt + R], [x0, nok, zt + R], [x0, 0, zt]];
        huis.push(poly(achter, `fill="${donker ? '#141c29' : kleurAchter(kamer)}"`));
        if (kamer && !donker) huis.push(poly(achter, `fill="url(#${id}-w-${(nacht || schemer) && lampAan ? kleurWas(kamer) ?? 'lamp' : kamer.stand ?? 'rust'})"`));
        huis.push(poly([[x0, 0, zv], [x1, 0, zv], [x1, D, zv], [x0, D, zv]], `fill="${donker ? '#0f151f' : '#1a2330'}"`));
        if (x0 > 0) huis.push(poly([[x0, 0, zv], [x0, D, zv], [x0, D, zt], [x0, nok, zt + R], [x0, 0, zt]], `fill="${donker ? '#121a26' : '#3a4a60'}"`));
        if (kamer) {
          sfeer(kamer, x0, x1, zv, zt + R * 0.8);
          // De inrichting en de apparaten, tegen de achterwand: die is laag, want daar zit de goot.
          const dakPlafond = () => zt + R * 0.55;
          erBoven = false;
          aircoDak = (kamer.apparaten ?? []).some((a) => a.soort === 'airco') ? aircoOnderDak(x0, x1, zv, dakPlafond) : null;
          inrichten(kamer, x0, x1, zv, zt + R * 0.85, dakPlafond, donker);
          blokKamer = kamer.id ?? kamer.naam;
          dezeKamer = kamer;
          for (const app of kamer.apparaten ?? []) apparaat(app, x0, x1, zv, zt + R * 0.85, true, dakPlafond);
          aircoDak = null;
          const xm = (x0 + x1) / 2;
          kamers.push({ id: kamer.id, naam: kamer.naam, xm, z0: zv, z1: zt + R });
          tik(kamer, [[x0, D, zv], [x1, D, zv], [x1, nok, zt + R], [x0, nok, zt + R]], '', true);
          kamerLabel(kamer, xm, zv + (zt + R - zv) * 0.4, true, (x1 - x0) * 0.8, R * 0.7);
        }
        x0 = x1;
      }
      huis.push(poly([[0, D, zv], [W, D, zv], [W, D, zv - 0.09], [0, D, zv - 0.09]], `fill="#3c4a5b"`));
    }
    if (dak && !nokLangs) {
    // Het dak, met de kamers eronder; elk met zijn stuk van de schuine wand.
    const onderDak = dakEtage?.kamers ?? [];
    const dakZ = (x) => zt + R * (1 - Math.abs(x - W / 2) / (W / 2));
    // Vanaf de zoldervloer: met een knieschot loopt de gevel eerst recht omhoog tot de dakvoet.
    const stukGevel = (x0, x1) => {
      const pts = [[x0, 0, zv], [x1, 0, zv], [x1, 0, dakZ(x1)]];
      if (x0 < W / 2 && x1 > W / 2) pts.push([W / 2, 0, zt + R]);
      pts.push([x0, 0, dakZ(x0)]);
      return pts;
    };
    if (onderDak.length === 0) huis.push(poly(stukGevel(0, W), `fill="${kleurAchter(null)}"`));
    {
      const totaal = onderDak.reduce((t, k2) => t + (k2.gewicht ?? 1), 0);
      let x0 = 0;
      for (const kamer of onderDak) {
        const x1 = x0 + (W * (kamer.gewicht ?? 1)) / totaal;
        const xm = (x0 + x1) / 2;
        const lampAan = (kamer.apparaten ?? []).some((a) => a.soort === 'lamp' && a.aan);
        const donker = nacht && !lampAan;
        if (x0 > 0) huis.push(poly([[x0, 0, zv], [x0, D, zv], [x0, D, dakZ(x0)], [x0, 0, dakZ(x0)]], `fill="${donker ? '#121a26' : '#3a4a60'}"`));
        // Links het knieschot, net als de zijmuur van een kamer eronder.
        else knieschot([[0, 0, zv], [0, D, zv], [0, D, zt], [0, 0, zt]], donker ? '#121a26' : '#3a4a60');
        huis.push(poly(stukGevel(x0, x1), `fill="${donker ? '#141c29' : kleurAchter(kamer)}"`));
        const tint = (nacht || schemer) && lampAan ? kleurWas(kamer) ?? 'lamp' : kamer.stand ?? 'rust';
        if (!donker) huis.push(poly(stukGevel(x0, x1), `fill="url(#${id}-w-${tint})"`));
        huis.push(poly([[x0, 0, zv], [x1, 0, zv], [x1, D, zv], [x0, D, zv]], `fill="${donker ? '#0f151f' : '#1a2330'}"`));
        sfeer(kamer, x0, x1, zv, zt + R * 0.8);
        erBoven = false;
        // Onder het dak volgt alles de schuine wand: het plafond is het dak zelf.
        const dakPlafond = (x) => dakZ(x) - 0.06;
        aircoDak = (kamer.apparaten ?? []).some((a) => a.soort === 'airco') ? aircoOnderDak(x0, x1, zv, dakPlafond) : null;
        inrichten(kamer, x0, x1, zv, zt + R * 0.85, dakPlafond, donker);
        blokKamer = kamer.id ?? kamer.naam;
        dezeKamer = kamer;
        for (const app of kamer.apparaten ?? []) apparaat(app, x0, x1, zv, zt + R * 0.85, true, dakPlafond);
        aircoDak = null;
        if (x0 > 0) huis.push(line([[x0, D, zv], [x0, D, dakZ(x0)]], `stroke="#C9D6E2" stroke-opacity="0.35" stroke-width="1.6"`));
        kamers.push({ id: kamer.id, naam: kamer.naam, xm, z0: zv, z1: zt + R });
        tik(kamer, stukGevel(x0, x1).map(([x, , z]) => [x, D, z]), '', true);
        // Staat er een droger, dan de naam ernaast in plaats van eroverheen.
        let xl = xm;
        let laag = false;
        const toestel = (kamer.apparaten ?? []).find((a) => a.soort === 'droger' || a.soort === 'wasmachine' || a.soort === 'vaatwasser');
        const opDePlek = toestel ? plek[toestel.soort] : null;
        if (opDePlek) {
          // Op het scherm vergelijken: de droger staat achterin en schuift daardoor naar rechts.
          const half = ((kamer.naam ?? '').length * 6.9 + (kamer.temp ?? '').length * 8.8 + 6) / 2 / k;
          const rechts = opDePlek[0] * AX + (D - opDePlek[1]) * BX + 0.3 * AX;
          if (xm * AX - half < rechts + 0.08) xl = Math.min(x1 - half / AX - 0.05, (rechts + 0.08 + half) / AX);
          // Is de kamer daar te smal voor, dan de naam laag aan de voorkant, onder de droger (besluit 166).
          const links = rechts - 0.6 * AX;
          laag = xl * AX - half < rechts + 0.08 && xl * AX + half > links - 0.08;
        }
        const vrij = dakZ(xl) - zv;
        kamerLabel(kamer, xl, laag ? zv + 0.22 : vrij * k < 96 ? zv + vrij * 0.58 : zv + vrij * 0.5, true, (x1 - x0) * (onderDak.length > 1 ? 0.8 : 0.6), laag ? 0 : vrij);
        x0 = x1;
      }
    }
    huis.push(poly([[0, D, zv], [W, D, zv], [W, D, zv - 0.09], [0, D, zv - 0.09]], `fill="#3c4a5b"`));

    }

    // De rechtergevel, per etage, met ramen.
    z0 = 0;
    for (const etage of gewoon) {
      const z1 = z0 + FH;
      huis.push(poly([[W, 0, z0], [W, D, z0], [W, D, z1], [W, 0, z1]], `fill="url(#${id}-muur)"`));
      if (zonKracht > 0) huis.push(poly([[W, 0, z0], [W, D, z0], [W, D, z1], [W, 0, z1]], `fill="url(#${id}-rand)"`));
      const laatste = etage.kamers[etage.kamers.length - 1];
      const brandt = nacht || schemer ? (laatste?.apparaten ?? []).some((a) => a.soort === 'lamp' && a.aan) : false;
      const ramen = 2;
      for (let i = 0; i < ramen; i++) {
        // Waar de accu aan de gevel hangt (huis 3.0), zit geen raam.
        if (accuPlek.wand && (model.batterij || spook(model, 'batterij')) && i === 0 && z0 < 0.01) continue;
        const y0 = 0.22 + i * (D - 0.3) / ramen;
        const y1 = y0 + (D - 0.3) / ramen - 0.22;
        const ra = [[W + 0.001, y0, z0 + 0.35], [W + 0.001, y1, z0 + 0.35], [W + 0.001, y1, z1 - 0.28], [W + 0.001, y0, z1 - 0.28]];
        huis.push(poly(ra, `fill="${brandt ? '#F4C27E' : nacht ? '#0f1a2a' : '#1b3047'}" ${brandt ? `opacity="0.9"` : ''} stroke="#4a5a6c" stroke-width="1"`));
        if (brandt) huis.push(`<g filter="url(#${id}-zacht)" opacity="0.5">${poly(ra, 'fill="#FFB765"')}</g>`);
        if (!brandt && !nacht) huis.push(poly([ra[0], [W + 0.001, (y0 + y1) / 2, z0 + 0.35], [W + 0.001, y0 + 0.05, z1 - 0.28]], 'fill="#ffffff" opacity="0.05"'));
        // Een screen voor het raam, als die er is.
        const screen = (laatste?.apparaten ?? []).find((a) => a.soort === 'screen');
        if (screen && i === 0) {
          const dicht = screen.dicht ?? 0;
          const zb = z1 - 0.28 - dicht * (z1 - 0.28 - (z0 + 0.35));
          huis.push(poly([[W + 0.02, y0 - 0.03, z1 - 0.25], [W + 0.02, y1 + 0.03, z1 - 0.25], [W + 0.02, y1 + 0.03, zb], [W + 0.02, y0 - 0.03, zb]], `fill="#3a4757" opacity="0.92"`));
          for (let s = 1; s < 6; s++) {
            const zz = z1 - 0.25 - (s / 6) * (z1 - 0.25 - zb);
            huis.push(line([[W + 0.021, y0 - 0.03, zz], [W + 0.021, y1 + 0.03, zz]], 'stroke="#536376" stroke-width="0.8"'));
          }
        }
      }
      z0 = z1;
    }
    // Het knieschot aan de buitenkant rechts, onder de dakrand (met de nok langs de straat zit het in de puntgevel).
    if (dak && !nokLangs && zt > zv) {
      const strook = [[W, 0, zv], [W, D, zv], [W, D, zt], [W, 0, zt]];
      huis.push(poly(strook, `fill="url(#${id}-muur)"`));
      if (zonKracht > 0) huis.push(poly(strook, `fill="url(#${id}-rand)"`));
    }
    // De nok langs de straat (schets Wand-Huis-Ligging): rechts een puntgevel, voor een dakvlak van glas.
    if (dak && nokLangs) {
      const nok = D / 2;
      const voorDeg = voorDegVan(model) ?? 180;
      const puntgevel = [[W, 0, zv], [W, D, zv], [W, D, zt], [W, nok, zt + R], [W, 0, zt]];
      huis.push(poly(puntgevel, `fill="url(#${id}-muur)"`));
      if (zonKracht > 0) huis.push(poly(puntgevel, `fill="url(#${id}-rand)"`));
      // De nok, en de goot achter: van het achterste dakvlak zie je van voren alleen de rand.
      huis.push(poly([[-0.08, nok - 0.05, zt + R + 0.04], [W + 0.14, nok - 0.05, zt + R + 0.04], [W + 0.14, nok + 0.05, zt + R + 0.04], [-0.08, nok + 0.05, zt + R + 0.04]], 'fill="#2c3542"'));
      // Panelen in rijen over een dakvlak, van de goot (u 0) naar de nok (u 1), over de breedte (v).
      const rij = (n, q, stijl) => {
        const aantal = Math.max(0, Math.min(36, Math.round(n)));
        if (!aantal) return;
        const rijen = aantal <= 6 ? 1 : aantal <= 16 ? 2 : 3;
        const kol = Math.ceil(aantal / rijen);
        const hoog = (0.78 - (rijen - 1) * 0.04) / rijen;
        const breed = (W - 0.4) / kol;
        for (let i = 0; i < aantal; i++) {
          const r = Math.floor(i / kol);
          const c = i % kol;
          const u0 = 0.14 + r * (hoog + 0.04);
          const v0 = 0.2 + c * breed;
          huis.push(poly([q(u0, v0), q(u0, v0 + breed - 0.06), q(u0 + hoog, v0 + breed - 0.06), q(u0 + hoog, v0)], stijl));
        }
      };
      const voorQ = (u, v) => [v, D + 0.08 - u * (D + 0.08 - nok), zt - 0.06 + u * (R + 0.06) + 0.02];
      const achterQ = (u, v) => [v, -0.06 + u * (nok + 0.06), zt - 0.06 + u * (R + 0.06) + 0.02];
      const voorN = model.zon?.panelen ?? 0;
      const achterN = model.zon?.panelenLinks ?? 0;
      // Achter: door het glas heen alleen de omtrek, zoals het andere dakvlak eerst.
      rij(achterN, achterQ, `fill="#4d7eac" fill-opacity="0.18" stroke="#9cc0e4" stroke-opacity="0.6" stroke-width="1"`);
      const achterLicht = opVlak(voorDeg + 180);
      if (achterLicht) rij(achterN, achterQ, `fill="#FFC24D" fill-opacity="${(0.4 * achterLicht).toFixed(2)}"`);
      // Het glas van het voorste dakvlak, met een rand en een zweem.
      const glas = [[-0.06, D + 0.1, zt - 0.08], [W + 0.14, D + 0.1, zt - 0.08], [W + 0.14, nok, zt + R], [-0.06, nok, zt + R]];
      huis.push(poly(glas, `fill="#9cc0e4" fill-opacity="0.06" stroke="#C9D6E2" stroke-opacity="0.5" stroke-width="1.2" stroke-linejoin="round"`));
      rij(voorN, voorQ, spook(model, 'panelen') ? `fill="none" stroke="${KLEUR.zon}" stroke-opacity="0.5" stroke-dasharray="3 3"` : `fill="url(#${id}-paneel)" fill-opacity="0.5" stroke="#8fb3d9" stroke-opacity="0.8" stroke-width="0.9"`);
      const voorLicht = opVlak(voorDeg);
      if (voorLicht) rij(voorN, voorQ, `fill="#FFC24D" fill-opacity="${(0.42 * voorLicht).toFixed(2)}"`);
      bundel(voorLicht, glas);
      // Een tik op de panelen (besluit 254, stap 5), ook bij de nok langs de straat.
      if (model.zon?.tik && opts.tik) {
        const aria = esc(model.zon.tikLabel ?? '');
        const attr = `class="sc-tik" data-tik="${esc(model.zon.tik)}" fill="transparent" role="button" tabindex="0"${aria ? ` aria-label="${aria}"` : ''}`;
        if (voorN > 0) tikkenBoven.push(poly(glas, attr));
        if (achterN > 0) tikkenBoven.push(poly([achterQ(0.04, 0.1), achterQ(0.04, W - 0.1), achterQ(0.96, W - 0.1), achterQ(0.96, 0.1)], attr));
      }
    }
    /*
     * Een zachte bundel van de zon naar een dakvlak dat licht vangt, en een warme
     * glans erover (schets Wand-Huis-Ligging): hoe meer licht, hoe sterker.
     */
    function bundel(licht, vlak) {
      if (!zonInBeeld || !licht || licht < 0.15) return;
      const hoeken = vlak.map((p) => P(...p));
      const midden = hoeken.reduce((s, p) => [s[0] + p[0] / hoeken.length, s[1] + p[1] / hoeken.length], [0, 0]);
      const gid = `${id}-bundel-${Math.round(licht * 100)}-${Math.round(midden[0])}`;
      defs.push(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${zonInBeeld[0].toFixed(1)}" y1="${zonInBeeld[1].toFixed(1)}" x2="${midden[0].toFixed(1)}" y2="${midden[1].toFixed(1)}"><stop offset="0" stop-color="#FFD27A" stop-opacity="${(0.45 * licht).toFixed(2)}"/><stop offset="0.65" stop-color="#FFB547" stop-opacity="${(0.14 * licht).toFixed(2)}"/><stop offset="1" stop-color="#FFA53D" stop-opacity="0.02"/></linearGradient>`);
      // Van de zon naar de twee hoeken die het verst uit elkaar liggen, gezien vanaf de zon.
      const hoek = (p) => Math.atan2(p[1] - zonInBeeld[1], p[0] - zonInBeeld[0]);
      const opHoek = [...hoeken].sort((a, b) => hoek(a) - hoek(b));
      zonVoor.push(`<polygon points="${pt(zonInBeeld)} ${pt(opHoek[0])} ${pt(midden)} ${pt(opHoek[opHoek.length - 1])}" fill="url(#${gid})"/>`);
      zonVoor.push(`<polygon points="${hoeken.map(pt).join(' ')}" fill="#FFB547" opacity="${(0.14 * licht).toFixed(2)}"/>`);
    }
    if (dak && !nokLangs) {
    // Rechter dakvlak met panelen.
    huis.push(poly([[W / 2, -0.08, zt + R], [W + 0.14, -0.08, zt - 0.08], [W + 0.14, D + 0.08, zt - 0.08], [W / 2, D + 0.08, zt + R]], `fill="url(#${id}-dak)"`));
    // Panelen alleen als het huis ze heeft: `panelen: 0` is geen panelen.
    if ((model.zon && (model.zon.panelen !== 0 || (model.zon.panelenLinks ?? 0) > 0)) || spook(model, 'panelen')) {
      // Precies zoveel panelen als er liggen (besluit 166), in rijen over het dakvlak;
      // de onderste rij mag korter zijn. Eerst werd het afgerond op twee rijen van 3 tot 6.
      const raster = (n, q, stijl) => {
        const aantal = Math.max(0, Math.min(36, Math.round(n)));
        if (!aantal) return;
        const rijen = aantal <= 4 ? 1 : aantal <= 16 ? 2 : 3;
        const kol = Math.ceil(aantal / rijen);
        const hoog = (0.8 - (rijen - 1) * 0.04) / rijen;
        const breed = (D - 0.24) / kol;
        for (let i = 0; i < aantal; i++) {
          const r = Math.floor(i / kol);
          const c = i % kol;
          const u0 = 0.12 + r * (hoog + 0.04);
          const u1 = u0 + hoog;
          const v0 = 0.12 + c * breed;
          const v1 = v0 + breed - Math.min(0.06, breed * 0.15);
          huis.push(poly([q(u0, v0), q(u0, v1), q(u1, v1), q(u1, v0)], stijl));
        }
      };
      raster(
        model.zon?.panelen ?? 6,
        (u, v) => [W - u * (W / 2) + 0.02, v, zt + u * R + 0.02],
        spook(model, 'panelen') ? `fill="none" stroke="${KLEUR.zon}" stroke-opacity="0.5" stroke-dasharray="3 3"` : `fill="url(#${id}-paneel)" stroke="#5b7aa0" stroke-opacity="0.6" stroke-width="0.8"`,
      );
      // Panelen op het andere dakvlak (besluit 111): dat vlak is open om de zolder te
      // tonen, dus daar alleen de omtrek en een zweem, zodat de zolder zichtbaar blijft.
      raster(model.zon?.panelenLinks ?? 0, (u, v) => [u * (W / 2) - 0.02, v, zt + u * R + 0.02], `fill="#4d7eac" fill-opacity="0.22" stroke="#9cc0e4" stroke-opacity="0.75" stroke-width="1"`);
      // Een tik op de panelen (besluit 254, stap 5): `zon.tik` komt als data-tik op een vlak boven de zolder.
      if (model.zon?.tik && opts.tik) {
        const aria = esc(model.zon.tikLabel ?? '');
        const vlak = (q) => poly([q(0.06, 0.04), q(0.06, D - 0.04), q(0.94, D - 0.04), q(0.94, 0.04)], `class="sc-tik" data-tik="${esc(model.zon.tik)}" fill="transparent" role="button" tabindex="0"${aria ? ` aria-label="${aria}"` : ''}`);
        if (model.zon.panelen !== 0) tikkenBoven.push(vlak((u, v) => [W - u * (W / 2) + 0.02, v, zt + u * R + 0.02]));
        if ((model.zon.panelenLinks ?? 0) > 0) tikkenBoven.push(vlak((u, v) => [u * (W / 2) - 0.02, v, zt + u * R + 0.02]));
      }
      if (zonKracht > 0) {
        // Het licht dat de panelen vangen, als een glans over het dakvlak.
        const q = (u, v) => [W - u * (W / 2) + 0.03, v, zt + u * R + 0.03];
        huis.push(`<g class="sc-glans">${poly([q(0.1, 0.05), q(0.1, D - 0.05), q(0.92, D - 0.05), q(0.92, 0.05)], `fill="url(#${id}-glans)"`)}</g>`);
      }
    }
    // De bundel naar het rechter dakvlak (schets Wand-Huis-Ligging), als de zon erop staat.
    if (echteZon) bundel(opVlak((voorDegVan(model) ?? 180) - 90), [[W / 2, -0.08, zt + R], [W + 0.14, -0.08, zt - 0.08], [W + 0.14, D + 0.08, zt - 0.08], [W / 2, D + 0.08, zt + R]]);
    // Sneeuw op het dak (huis 3.0): een witte laag, ook over de panelen.
    if (model.weer === 'sneeuw') huis.push(poly([[W / 2, -0.08, zt + R + 0.03], [W + 0.14, -0.08, zt - 0.05], [W + 0.14, D + 0.08, zt - 0.05], [W / 2, D + 0.08, zt + R + 0.03]], 'fill="#eef3f8" opacity="0.9"'));
    }
    // De doorsnede: de omtrek van het huis aan de voorkant, als een snijlijn.
    if (dak && nokLangs) {
      // Met de nok langs de straat: de rechthoek van de etages, de nok, en de rand van de puntgevel.
      huis.push(line([[0, D, 0], [0, D, zt], [W, D, zt], [W, D, 0]], `stroke="#C9D6E2" stroke-opacity="0.55" stroke-width="2.2" stroke-linejoin="round"`));
      huis.push(line([[W, D, zt], [W, D / 2, zt + R], [W, 0, zt], [W, 0, zv]], `stroke="#C9D6E2" stroke-opacity="0.35" stroke-width="1.4" stroke-linejoin="round"`));
      huis.push(line([[0, D / 2, zt + R], [W, D / 2, zt + R]], `stroke="#C9D6E2" stroke-opacity="0.45" stroke-width="1.4"`));
    } else if (dak) {
      huis.push(line([[0, D, 0], [0, D, zt], [W / 2, D, zt + R], [W, D, zt], [W, D, 0]], `stroke="#C9D6E2" stroke-opacity="0.55" stroke-width="2.2" stroke-linejoin="round"`));
      huis.push(line([[W / 2, D, zt + R], [W / 2, 0, zt + R]], `stroke="#C9D6E2" stroke-opacity="0.25" stroke-width="1.2"`));
    } else {
      huis.push(line([[0, D, 0], [0, D, zt], [W, D, zt], [W, D, 0]], `stroke="#C9D6E2" stroke-opacity="0.55" stroke-width="2.2" stroke-linejoin="round"`));
      huis.push(line([[0, D, zt], [0, 0, zt], [W, 0, zt], [W, D, zt]], `stroke="#C9D6E2" stroke-opacity="0.3" stroke-width="1.4" stroke-linejoin="round"`));
    }
    // Een plat dak op het hoofdhuis (issue 131): een plaat met een rand, de panelen erop in rijen, zoals op de garage.
    if (platDak) {
      const sneeuw = model.weer === 'sneeuw';
      const plaat = [[-0.06, -0.06, zt], [W + 0.06, -0.06, zt], [W + 0.06, D + 0.06, zt], [-0.06, D + 0.06, zt]];
      huis.push(poly(plaat, `fill="${sneeuw ? '#eef3f8' : '#55626f'}"`));
      huis.push(poly([[-0.06, D + 0.06, zt], [W + 0.06, D + 0.06, zt], [W + 0.06, D + 0.06, zt + 0.12], [-0.06, D + 0.06, zt + 0.12]], 'fill="#3d4957"'));
      huis.push(poly([[W + 0.06, -0.06, zt], [W + 0.06, D + 0.06, zt], [W + 0.06, D + 0.06, zt + 0.12], [W + 0.06, -0.06, zt + 0.12]], 'fill="#46525f"'));
      const n = (model.zon?.panelen ?? 0) + (model.zon?.panelenLinks ?? 0);
      if (n > 0 && !sneeuw) {
        plaatPanelen(0.2, 0.15, W - 0.4, D - 0.3, zt + 0.13, n, huis);
        plek.panelen = [W / 2, D / 2, zt + 0.4];
      }
      // Een tik op de panelen (besluit 254, stap 5), net als op een schuin dak.
      if (n > 0 && model.zon?.tik && opts.tik) {
        const aria = esc(model.zon.tikLabel ?? '');
        tikkenBoven.push(poly(plaat, `class="sc-tik" data-tik="${esc(model.zon.tik)}" fill="transparent" role="button" tabindex="0"${aria ? ` aria-label="${aria}"` : ''}`));
      }
    }
    // Schoorsteen of afvoer van de cv, als die er is.
    if (model.cv && dak && !nokLangs) {
      const cx = W * 0.32;
      const zz = zt + R * (cx / (W / 2)) - 0.1;
      huis.push(poly([[cx, 0.4, zz], [cx + 0.18, 0.4, zz], [cx + 0.18, 0.4, zz + 0.55], [cx, 0.4, zz + 0.55]], 'fill="#3a4656"'));
      if (model.cv.aan) {
        for (let i = 0; i < 3; i++) {
          const p = P(cx + 0.09, 0.4, zz + 0.7 + i * 0.28);
          huis.push(`<circle class="sc-damp" style="animation-delay:${i * 0.8}s" cx="${p[0]}" cy="${p[1]}" r="${k * (0.09 + i * 0.04)}" fill="#cfd8e2" opacity="0.18"/>`);
        }
      }
    }

    if (voordeur) bouwVoordeur(voordeur);

    /* ---- buiten: buitenunit, batterij, laadpaal en auto, het net ---- */
    if (model.buitenunit) bouwBuitenunit(model.buitenunit, W);
    // De garage vóór de batterij: die kan ertegenaan staan (huis 3.0).
    if (model.garage && eiland) bouwGarage(model.garage);
    if (eiland) {
      plek.oprit = [-1.95, D - 0.2, 0.2];
      plek.garage = [-2.0, -1.25, 1.15];
    }
    // In de garage zonder eiland komt de accu na de garage, anders tekent die eroverheen.
    if ((model.batterij || spook(model, 'batterij')) && !(accuPlek.garage && !eiland)) bouwBatterij(model.batterij, spook(model, 'batterij'));
    // Op het eiland (huis 3.0) heeft de tuin een vaste indeling, met het terras erin.
    if (model.tuin && eiland) bouwTuin3(model.tuin);
    else if (model.tuin) bouwTuin(model.tuin);
    if (model.terras && !(model.tuin && eiland)) bouwTerras(model.terras);
    if (model.voortuin) bouwVoortuin(model.voortuin);
    if (model.balkon && g.etages.filter((e) => !e.dak).length >= 2) bouwBalkon(model.balkon);
    else if (model.balkon && appartement) bouwBalkon(model.balkon, 0);
    if (model.auto || spook(model, 'auto')) bouwAuto(model.auto, spook(model, 'auto'), true);
    else if (model.oprit?.auto) bouwAuto({ stand: 'geparkeerd', kleur: model.oprit.auto.kleur }, false, false);
    if (model.oprit?.camera) bouwCamera(model.oprit.camera);
    // Een losse garage achter de oprit, en een carport boven de auto (besluit 166); ook zonder dak (besluit 193).
    if (model.garage && !eiland) bouwGarage(model.garage);
    if (model.batterij && accuPlek.garage && !eiland) bouwBatterij(model.batterij, false);
    if (model.oprit?.carport) bouwCarport();
    if (model.net) bouwNet();

    /* ---- stromen ---- */
    const hub = [W + 0.25, D + 0.35, 0.02];
    const voetPaneel = [W + 0.12, D - 0.2, zt - 0.05];
    /*
     * Panelen op het huis én op de garage (issue 151): elk dak een eigen
     * stroom, zo dik als zijn deel van de panelen. Eerst kwam de zon alleen van
     * het huis, en van de garage alleen als daar de enige panelen lagen.
     */
    const nHuis = (model.zon?.panelen ?? 0) + (model.zon?.panelenLinks ?? 0);
    const nGarage = model.garage?.panelen ?? 0;
    const zonGarage = nHuis > 0 && nGarage > 0 ? nGarage / (nHuis + nGarage) : 0;
    const alleStromen = (model.stromen ?? []).flatMap((s) => {
      if (s.van !== 'zon' || !zonGarage) return [s];
      const sterkte = s.sterkte ?? 0.5;
      return [
        { ...s, sterkte: sterkte * (1 - zonGarage) },
        { ...s, van: 'zonGarage', sterkte: sterkte * zonGarage },
      ];
    });
    for (const s of alleStromen) {
      // Zon goud, terug naar het net groen, van het net violet, uit de batterij blauw (huis 3.0).
      const kleur = s.naar === 'net' ? KLEUR.mint : s.van === 'net' ? KLEUR.violet : s.van === 'batterij' ? KLEUR.ijs : KLEUR.zon;
      const pad = route(s.van, s.naar);
      if (!pad) continue;
      const d = pad.map((p) => pt(P(...p))).join(' ');
      const dik = 1.6 + 2.2 * (s.sterkte ?? 0.5);
      stromen.push(`<polyline points="${d}" fill="none" stroke="${kleur}" stroke-opacity="0.18" stroke-width="${dik + 3}" stroke-linejoin="round" stroke-linecap="round"/>`);
      stromen.push(`<polyline class="sc-stroom" style="animation-duration:${(2.6 - 1.6 * (s.sterkte ?? 0.5)).toFixed(2)}s" points="${d}" fill="none" stroke="${kleur}" stroke-width="${dik}" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="1 11"/>`);
      // Een stroom om aan te tikken (idee 135): een brede, onzichtbare lijn erover met `tik` als data-tik.
      if (s.tik && opts.tik) tikkenBoven.push(`<polyline class="sc-tik" data-tik="${esc(s.tik)}" points="${d}" fill="none" stroke="transparent" stroke-width="22" stroke-linejoin="round" stroke-linecap="round" role="button" tabindex="-1"${s.tikLabel ? ` aria-label="${esc(s.tikLabel)}"` : ''} style="cursor: pointer"/>`);
    }

    /* ---- labels: getallen op het huis ---- */
    const anker = {
      // Met de nok langs de straat (schets Wand-Huis-Ligging): voor op het glas, achter bij de nok.
      panelen: nokLangs ? [W * 0.62, D * 0.8, zt + R * 0.38] : [W * 0.76, D * 0.55, zt + R * 0.48],
      // Het andere dakvlak (huis 3.0): voor een label bij panelen aan die kant.
      panelenLinks: nokLangs ? [W * 0.3, D * 0.22, zt + R * 0.62] : [W * 0.24, D * 0.55, zt + R * 0.48],
      batterij: plek.batterij ?? [W + 0.32, D - 0.47, 1.0],
      auto: [-1.95, D - 1.0, 0.86],
      laadpaal: [-0.95, D + 0.1, 0.75],
      net: eiland ? [netStraat[0], netStraat[1], 0.42] : voordeur ? [netStraat[0], netStraat[1], 0.02] : [-0.6, D + 1.25, 0.55],
      buitenunit: [W + 0.15, D - 0.4, 0.4],
      deurbel: plek.deurbel ?? [W / 2, D, 0.7],
      camera: plek.camera ?? [-0.1, D, FH],
    };
    /*
     * De plekken buiten (besluit 269): waar een label "Oprit · 2
     * apparaten" aan hangt. Alleen een plek die getekend is; anders geen label.
     */
    const tweeHoog = g.etages.filter((e) => !e.dak).length >= 2;
    const buitenPlek = {
      voordeur: plek.voordeur ?? null,
      oprit: model.oprit || model.auto ? (eiland ? plek.oprit : [-1.95, D + 0.7, 0.03]) : null,
      carport: model.oprit?.carport ? [-1.98, D * 0.5 + 0.5, 1.1] : null,
      garage: model.garage ? (plek.garage ?? [-2.0, -1.25, 1.1]) : null,
      tuin: model.tuin ? (plek.gazon ?? [W + 1.3, -0.7, 0.05]) : null,
      tuinhuis: model.tuin && model.tuin.tuinhuis !== false ? (plek.tuinhuis ?? [W + 1.37, -1.27, 0.9]) : null,
      terras: model.terras ? (plek.terras ?? [W + 1.17, (0.85 + D) / 2, 0.05]) : null,
      voortuin: model.voortuin ? [W * 0.6 + 0.5, eiland ? D + 0.45 : D + 1.0, 0.05] : null,
      balkon: model.balkon && (tweeHoog || appartement) ? [W + 0.28, 0.75, (tweeHoog ? FH : 0) + 0.4] : null,
    };
    const zoek = (bij) => {
      if (Array.isArray(bij)) return bij;
      if (typeof bij === 'string' && bij.startsWith('buiten:')) return buitenPlek[bij.slice(7)] ?? null;
      if (anker[bij]) return anker[bij];
      if (plek[bij]) return plek[bij];
      if (bij.startsWith('kamer:')) {
        const k2 = vindKamer(bij.slice(6));
        if (k2) return [k2.xm, D, (k2.z0 + Math.min(k2.z1, k2.z0 + FH)) / 2];
      }
      return [W / 2, D / 2, 0];
    };
    const geplaatst = [];
    for (const l of model.labels ?? []) {
      const plekA = zoek(l.bij);
      if (!plekA) continue;
      const a = P(...plekA);
      const fs = l.groot ? 26 : 14;
      const regels = [l.titel, ...(l.regels ?? [])].filter(Boolean);
      const breedte = Math.max(...regels.map((r, i) => r.length * (i === 0 && l.groot ? fs * 0.56 : (i === 0 ? 14 : 12.5) * 0.53))) + 24;
      const hoogte = (l.groot ? 34 : 22) + (regels.length - 1) * 17 + 10;
      const lx = a[0] + (l.dx ?? 40);
      const ly = a[1] + (l.dy ?? -40);
      // Binnen de tekening: een breed label viel op de telefoon links buiten beeld.
      const bx = Math.max(6, Math.min((opts.breedte ?? 760) - breedte - 6, l.dx < 0 ? lx - breedte : lx));
      const binnenY = (y) => Math.max(6, Math.min((opts.hoogte ?? 560) - hoogte - 6, y));
      let by = binnenY(ly - hoogte / 2);
      // Labels die uit elkaar moeten (de plekken buiten): botst er een
      // met een eerder label, dan schuift hij op of neer naar de dichtste vrije plek.
      if (l.wijk) {
        const botst = (y) => geplaatst.some((p) => bx < p.x + p.b + 4 && p.x < bx + breedte + 4 && y < p.y + p.h + 4 && p.y < y + hoogte + 4);
        const stap = hoogte + 6;
        const vrij = [0, 1, -1, 2, -2, 3, -3, 4, -4].map((i) => binnenY(by + i * stap)).find((y) => !botst(y));
        // Nergens plek: dan liever geen label dan twee over elkaar.
        if (vrij === undefined) continue;
        by = vrij;
        geplaatst.push({ x: bx, y: by, b: breedte, h: hoogte });
      }
      const kleur = KLEUR[l.toon] ?? KLEUR.zacht;
      // In het licht een wit kaartje met donkere tekst, zoals de rest van de app (besluit 181).
      const tl = licht ? (k) => TEKST_LICHT[k] ?? k : (k) => k;
      // Een label om aan te tikken (besluit 254, stap 5): `tik` komt als data-tik op de groep.
      labels.push(`<g class="sc-label"${l.tik ? ` data-tik="${esc(l.tik)}" role="button" tabindex="0" style="cursor: pointer"${l.tikLabel ? ` aria-label="${esc(l.tikLabel)}"` : ''}` : ''}>
        <polyline points="${a[0]},${a[1]} ${l.dx < 0 ? bx + breedte : bx},${by + hoogte / 2}" fill="none" stroke="${kleur}" stroke-opacity="0.55" stroke-width="1"/>
        <circle cx="${a[0]}" cy="${a[1]}" r="3" fill="${kleur}"/>
        <rect x="${bx}" y="${by}" width="${breedte}" height="${hoogte}" rx="12" fill="${licht ? '#ffffff' : '#0E1828'}" fill-opacity="${licht ? 0.88 : 0.78}" stroke="${kleur}" stroke-opacity="${licht ? 0.6 : 0.35}"/>
        ${regels
          .map((r, i) =>
            i === 0
              ? `<text x="${bx + 12}" y="${by + (l.groot ? 30 : 19)}" fill="${tl(l.groot ? kleur : KLEUR.tekst)}" font-family="Bricolage Grotesque, Figtree, sans-serif" font-weight="600" font-size="${l.groot ? fs : 14}">${esc(r)}</text>`
              : `<text x="${bx + 12}" y="${by + (l.groot ? 30 : 19) + i * 17}" fill="${tl(i === 1 ? kleur : KLEUR.zacht)}" font-family="Figtree, sans-serif" font-size="12.5" font-weight="${i === 1 ? 600 : 500}">${esc(r)}</text>`,
          )
          .join('')}
      </g>`);
    }


    /* ---- buiten ---- */

    // Buiten om op te tikken: de oprit en de tuin, als ze een kamer in de indeling zijn.
    // Gekozen (in Kamer): een omlijning; zonder dak staat de naam erbij op de grond.
    // Op het eiland zo groot als wat er getekend is: de tuin loopt tot de rand.
    const vlakOprit = eiland ? [[-2.9, -0.4, 0.01], [-1.15, -0.4, 0.01], [-1.15, eiland.yF, 0.01], [-2.9, eiland.yF, 0.01]] : [[-2.9, -0.4, 0.01], [-1.15, -0.4, 0.01], [-1.15, D + 1.7, 0.01], [-2.9, D + 1.7, 0.01]];
    const vlakTuin = eiland
      ? [[W + 0.3, eiland.y0 + 0.3, 0.01], [eiland.x1 - 0.12, eiland.y0 + 0.3, 0.01], [eiland.x1 - 0.12, eiland.yF - 0.12, 0.01], [W + 0.3, eiland.yF - 0.12, 0.01]]
      : [[W + 0.3, -1.95, 0.01], [W + 2.05, -1.95, 0.01], [W + 2.05, 0.25, 0.01], [W + 0.3, 0.25, 0.01]];
    const vlakTerras = [[W + 0.3, 0.45, 0.01], [W + 2.05, 0.45, 0.01], [W + 2.05, D + 0.4, 0.01], [W + 0.3, D + 0.4, 0.01]];
    const vlakVoortuin = [[1.3, D + 0.3, 0.01], [W + 0.1, D + 0.3, 0.01], [W + 0.1, D + 1.7, 0.01], [1.3, D + 1.7, 0.01]];
    const vlakBalkon = [[W, 0.35, FH], [W + 0.55, 0.35, FH], [W + 0.55, 1.15, FH], [W, 1.15, FH]];
    // Het tuinhuis zelf, als het een eigen ruimte in Home Assistant is (besluit 166): de omtrek van het huisje.
    const th = [W + 0.85, -1.75];
    const tv = tuinhuisVak ?? { x0: th[0], y0: th[1], x1: th[0] + 1.05, y1: th[1] + 0.95, h: 0.88 };
    const vlakTuinhuis = [[tv.x0, tv.y1, 0], [tv.x1, tv.y1, 0], [tv.x1, tv.y0, 0], [tv.x1, tv.y0, tv.h], [tv.x0, tv.y0, tv.h], [tv.x0, tv.y1, tv.h]];
    const tuinhuis = model.tuin && model.tuin.tuinhuis !== false && model.tuin.tuinhuisId ? { id: model.tuin.tuinhuisId, naam: model.tuin.tuinhuisNaam ?? 'Tuinhuis', gekozen: model.tuin.tuinhuisGekozen } : null;
    const vlakGarage = [[-2.9, -0.5, 0], [-1.1, -0.5, 0], [-1.1, -2.0, 0], [-1.1, -2.0, 1.1], [-2.9, -2.0, 1.1], [-2.9, -0.5, 1.1]];
    const metBalkon = model.balkon && g.etages.filter((e) => !e.dak).length >= 2 ? model.balkon : null;
    for (const [deel, vlak, midden] of [
      [model.oprit, vlakOprit, [-2.02, D + 0.65, 0]],
      [model.tuin, vlakTuin, [W + 1.18, -0.85, 0]],
      [model.terras, vlakTerras, [W + 1.18, D / 2 + 0.4, 0]],
      [model.voortuin, vlakVoortuin, [(1.3 + W) / 2, D + 1.0, 0]],
      [metBalkon, vlakBalkon, [W + 0.28, 0.75, FH]],
      // Na de tuin: het huisje ligt erbovenop.
      [tuinhuis, vlakTuinhuis, [(tv.x0 + tv.x1) / 2, tv.y1 + 0.25, 0]],
      // Na de oprit: de garage staat erachter, maar ligt in beeld deels over de oprit.
      [model.garage, vlakGarage, [-2.0, -0.2, 0]],
    ]) {
      if (!deel) continue;
      if (deel.gekozen) grond.push(poly(vlak, `fill="${KLEUR.ijs}" fill-opacity="0.06" stroke="${KLEUR.ijs}" stroke-width="2" stroke-dasharray="7 5"`));
      if (model.zonderDak && deel.naam) {
        const t = P(...midden);
        labels.push(`<text x="${t[0]}" y="${t[1] + 30}" text-anchor="middle" font-family="Figtree, sans-serif" font-size="13" font-weight="700" fill="${deel.gekozen ? KLEUR.ijs : KLEUR.zacht}">${esc(deel.naam)}</text>`);
      }
      if (deel.id) tik(deel, vlak);
    }
    // De zones van de tuin (besluit 206), na de tuin zelf: die liggen erbovenop. Het
    // tuinhuis als zone van de tuin heeft zijn eigen omtrek, net als een losse ruimte.
    // Is het tuinhuis een eigen ruimte, dan opent het huisje die ruimte en niet de zone.
    for (const [soort, zone] of Object.entries((model.tuin?.id && model.tuin.zones) || {})) {
      const v = tuinVakken[soort];
      const huisje = v != null && v === tuinhuisVak;
      if (!v || !zone?.id || (huisje && tuinhuis)) continue;
      const pts = huisje ? [[v.x0, v.y1, 0], [v.x1, v.y1, 0], [v.x1, v.y0, 0], [v.x1, v.y0, v.h], [v.x0, v.y0, v.h], [v.x0, v.y1, v.h]] : [[v.x0, v.y0, 0], [v.x1, v.y0, 0], [v.x1, v.y1, 0], [v.x0, v.y1, 0]];
      tik({ id: model.tuin.id, naam: zone.naam }, pts, ` data-zone="${esc(zone.id)}"`);
    }
    // De voordeur (besluit 269): een plek buiten, om op te tikken aan de gevel rond de deur en de bel.
    if (voordeur && model.voordeur?.id) {
      const vlak = [[voordeur.x0 - 0.08, D + 0.01, 0], [voordeur.x1 + 0.22, D + 0.01, 0], [voordeur.x1 + 0.22, D + 0.01, 1.32], [voordeur.x0 - 0.08, D + 0.01, 1.32]];
      if (model.voordeur.gekozen) buiten.push(poly(vlak, `fill="${KLEUR.ijs}" fill-opacity="0.08" stroke="${KLEUR.ijs}" stroke-width="2" stroke-dasharray="7 5"`));
      tik({ id: model.voordeur.id, naam: model.voordeur.naam }, vlak);
    }

    /*
     * De feestdagen, alleen bij het hele huis: een pompoen bij
     * de deur met Halloween, lichtjes langs de gevel met Kerst, vuurwerk in de
     * lucht met Oud en Nieuw, eieren in het gras met Pasen. Stil, zonder
     * beweging: dat kost een oude tablet niets.
     */
    if (feest && dak) {
      const avond = nacht || schemer;
      if (feest === 'halloween') {
        // Op het pad, net naast de deur.
        const px = voordeur ? Math.min(W - 0.2, voordeur.x1 + 0.22) : 0.45;
        const py = D + 0.45;
        const c = P(px, py, 0.11);
        const rx = k * 0.19;
        const ry = k * 0.135;
        if (avond) buiten.push(`<ellipse cx="${c[0].toFixed(1)}" cy="${(c[1] + ry * 0.6).toFixed(1)}" rx="${(rx * 2.2).toFixed(1)}" ry="${(ry * 1.4).toFixed(1)}" fill="#FF9A3C" opacity="0.28" filter="url(#${id}-zacht)"/>`);
        buiten.push(`<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="#E8792B"/>`);
        for (const f of [-0.45, 0, 0.45]) buiten.push(`<ellipse cx="${(c[0] + rx * f).toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(rx * 0.32).toFixed(1)}" ry="${(ry * 0.96).toFixed(1)}" fill="none" stroke="#C25E1A" stroke-width="1"/>`);
        buiten.push(`<path d="M ${c[0].toFixed(1)} ${(c[1] - ry).toFixed(1)} q ${(rx * 0.15).toFixed(1)} ${(-ry * 0.5).toFixed(1)} ${(rx * 0.35).toFixed(1)} ${(-ry * 0.55).toFixed(1)}" stroke="#4E6B2F" stroke-width="${(k * 0.025).toFixed(1)}" fill="none" stroke-linecap="round"/>`);
        // Het gezicht: 's avonds brandt er een kaarsje in.
        const oog = avond ? '#FFD36B' : '#5A2A0E';
        const ox = rx * 0.38;
        const oy = ry * 0.22;
        const s = rx * 0.17;
        buiten.push(`<path d="M ${(c[0] - ox - s).toFixed(1)} ${(c[1] - oy + s).toFixed(1)} l ${s.toFixed(1)} ${(-2 * s).toFixed(1)} l ${s.toFixed(1)} ${(2 * s).toFixed(1)} z M ${(c[0] + ox - s).toFixed(1)} ${(c[1] - oy + s).toFixed(1)} l ${s.toFixed(1)} ${(-2 * s).toFixed(1)} l ${s.toFixed(1)} ${(2 * s).toFixed(1)} z" fill="${oog}"/>`);
        buiten.push(`<path d="M ${(c[0] - rx * 0.45).toFixed(1)} ${(c[1] + ry * 0.3).toFixed(1)} q ${(rx * 0.45).toFixed(1)} ${(ry * 0.45).toFixed(1)} ${(rx * 0.9).toFixed(1)} 0" fill="none" stroke="${oog}" stroke-width="${(k * 0.022).toFixed(1)}" stroke-linecap="round"/>`);
      }
      if (feest === 'kerst') {
        // Lichtjes langs de voorgevel en de dakgoot rechts; 's avonds met een gloed.
        const KLEUREN = ['#FF5A4A', '#FFD36B', '#6EE7B7', '#6FD3FF'];
        const langs = [[[0, D, zt], [W / 2, D, zt + R]], [[W / 2, D, zt + R], [W, D, zt]], [[W, D, zt], [W, 0, zt]]];
        let i = 0;
        for (const [a, b] of langs) {
          const lengte = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
          const n = Math.max(2, Math.round(lengte / 0.17));
          for (let j = 0; j < n; j++, i++) {
            const f = (j + 0.5) / n;
            // Een slinger: elk lampje net onder de lijn, om en om iets lager.
            const q = P(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f + 0.01, a[2] + (b[2] - a[2]) * f - 0.05 - (j % 2) * 0.03);
            const kl = KLEUREN[i % KLEUREN.length];
            if (avond) buiten.push(`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${(k * 0.07).toFixed(1)}" fill="${kl}" opacity="0.35" filter="url(#${id}-zacht)"/>`);
            buiten.push(`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${(k * 0.026).toFixed(1)}" fill="${kl}"/>`);
          }
        }
      }
      if (feest === 'oudnieuw') {
        // Drie pijlen vuurwerk boven het huis, 's avonds.
        for (const [fx, fz, kl] of [[W * 0.1, zt + R + 1.4, '#FFD36B'], [W * 0.85, zt + R + 1.8, '#FF6FA0'], [W * 0.5, zt + R + 2.3, '#6FD3FF']]) {
          const c = P(fx, D / 2, fz);
          const r = k * 0.42;
          const stralen = Array.from({ length: 14 }, (_, j) => {
            const h = (j / 14) * Math.PI * 2;
            return `M ${(c[0] + Math.cos(h) * r * 0.25).toFixed(1)} ${(c[1] + Math.sin(h) * r * 0.25).toFixed(1)} L ${(c[0] + Math.cos(h) * r).toFixed(1)} ${(c[1] + Math.sin(h) * r).toFixed(1)}`;
          }).join(' ');
          lucht.push(`<g opacity="${avond ? 0.95 : 0.6}"><path d="${stralen}" stroke="${kl}" stroke-width="2" stroke-linecap="round"/><circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(r * 1.1).toFixed(1)}" fill="${kl}" opacity="0.12"/></g>`);
        }
      }
      if (feest === 'pasen') {
        // Zes eieren in het gras voor het huis, rechts van de voordeur.
        const EI = ['#F6D36B', '#F2A7C3', '#9FD3EA', '#B5E3B0', '#C4BCFF', '#FFB088'];
        for (let j = 0; j < 6; j++) {
          const q = P(W + 0.25 + (j % 3) * 0.32, D + 0.2 + Math.floor(j / 3) * 0.28 + (j % 2) * 0.06, 0.04);
          buiten.push(`<ellipse cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" rx="${(k * 0.045).toFixed(1)}" ry="${(k * 0.06).toFixed(1)}" fill="${EI[j]}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1"/>`);
        }
      }
    }

    /*
     * Het weer (huis 3.0): regen als schuine strepen, sneeuw als vlokken, en
     * 's nachts in de wereld een paar vuurvliegjes boven het gras. Met minder
     * beweging staan ze stil.
     */
    const weer = [];
    {
      let zaad = 5;
      const rnd = () => ((zaad = (zaad * 16807) % 2147483647) / 2147483647);
      const beweeg = !stilGekozen();
      if (model.weer === 'regen') {
        for (let i = 0; i < 70; i++) {
          const x = rnd() * breed;
          const y = rnd() * hoog;
          weer.push(`<line class="${beweeg ? 'sc-regen' : ''}" style="animation-delay:-${(rnd() * 1.2).toFixed(2)}s" x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x - 6).toFixed(0)}" y2="${(y + 18).toFixed(0)}" stroke="#a9c4e0" stroke-opacity="0.35" stroke-width="1.2" stroke-linecap="round"/>`);
        }
      }
      if (model.weer === 'sneeuw') {
        for (let i = 0; i < 80; i++) {
          weer.push(`<circle class="${beweeg ? 'sc-sneeuw' : ''}" style="animation-delay:-${(rnd() * 8).toFixed(2)}s" cx="${(rnd() * breed).toFixed(0)}" cy="${(rnd() * hoog).toFixed(0)}" r="${(1 + rnd() * 2).toFixed(1)}" fill="#ffffff" opacity="${(0.45 + rnd() * 0.4).toFixed(2)}"/>`);
        }
      }
      if (eiland && nacht && !winter) {
        for (let i = 0; i < 9; i++) {
          const c = P(eiland.x0 + rnd() * (eiland.x1 - eiland.x0), eiland.y0 + rnd() * (eiland.yF - eiland.y0), 0.2 + rnd() * 0.6);
          weer.push(`<circle class="${beweeg ? 'sc-vlieg' : ''}" style="animation-delay:-${(rnd() * 4).toFixed(2)}s" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="1.8" fill="#f6e7a0" filter="url(#${id}-gloed)"/>`);
        }
      }
    }
    const weerStijl = weer.length
      ? '<style>.sc-regen{animation:sc-regen 0.9s linear infinite}@keyframes sc-regen{from{transform:translate(0,-40px)}to{transform:translate(-12px,40px)}}.sc-sneeuw{animation:sc-sneeuw 8s linear infinite}@keyframes sc-sneeuw{from{transform:translate(0,-30px)}to{transform:translate(14px,30px)}}.sc-vlieg{animation:sc-vlieg 4s ease-in-out infinite alternate}@keyframes sc-vlieg{from{transform:translate(0,0);opacity:.2}to{transform:translate(6px,-8px);opacity:1}}</style>'
      : '';

    // Met kamers om op te tikken een groep, geen plaatje: anders ziet een schermlezer de kamers niet (besluit 86, de controle van 22 oktober 2026).
    return `<svg class="sc-huis${opts.meubels ? ' sc-ingericht' : ''}" viewBox="0 0 ${breed} ${hoog}" width="100%" height="100%" role="${tikken.length ? 'group' : 'img'}" aria-label="${esc(model.beschrijving ?? global.t?.('thuis.hetHuis') ?? '')}">
      <defs>${lichter(defs.join(''))}</defs>
      <g>${lucht.join('')}</g>
      <g>${grond.join('')}</g>
      ${buitenAchter.length ? `<g>${lichter(buitenAchter.join(''))}</g>` : ''}
      <g>${lichter(huis.join(''))}</g>
      ${burenVoor.length ? `<g>${burenVoor.join('')}</g>` : ''}
      ${eiland && stromen.length ? `<g filter="url(#${id}-gloed)" opacity="0.7">${stromen.join('').replace(/ class="sc-stroom"/g, '')}</g>` : ''}
      <g>${stromen.join('')}</g>
      <g>${lichter(buiten.join(''))}</g>
      ${zonVoor.length ? `<g>${zonVoor.join('')}</g>` : ''}
      ${weer.length ? `${weerStijl}<g>${weer.join('')}</g>` : ''}
      <g>${labels.join('')}</g>
      ${tikken.length ? `<g>${tikken.join('')}</g>` : ''}
      ${tikkenBoven.length ? `<g>${tikkenBoven.join('')}</g>` : ''}
      ${tikkenDak.length ? `<g>${tikkenDak.join('')}</g>` : ''}
      ${opts.controle ? `<desc class="sc-controle">${esc(JSON.stringify(controle))}</desc>` : ''}
    </svg>`;
  }

  global.huis = { teken, svg, KLEUR, KAMER_ICOON, soortVan, feestdagVan };
})(window);
