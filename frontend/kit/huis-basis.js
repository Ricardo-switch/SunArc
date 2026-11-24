/*
 * SunArc: het poppenhuis, de basis (opgesplitst uit kit/huis.js).
 *
 * De vaste kleuren en maten, de soorten kamers en hun meubels en iconen, en losse hulpjes zonder gedeelde stand
 * (kleuren, esc, de ring van de zon, feestdagen). huis.js en zijn delen gebruiken het via global.huisBasis.
 */
(function (global) {
  'use strict';

  /** Minder beweging: zo ingesteld in de browser, of gekozen bij Weergave in de app (besluit 164). */
  const stilGekozen = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || (typeof document !== 'undefined' && document.documentElement.classList.contains('sc-stil'));

  const KLEUR = {
    zon: '#F7B548',
    ijs: '#6FD3FF',
    gloed: '#FF7A4D',
    mint: '#6EE7B7',
    net: '#9AAABB',
    violet: '#8F86FF',
    tekst: '#EEF3F7',
    zacht: '#B8C4CF',
    gedempt: '#7F8E9C',
  };

  /** Dezelfde kleuren als tekst op wit, in het lichte thema (besluit 181): anders halen ze het contrast niet. */
  const TEKST_LICHT = {
    [KLEUR.zon]: '#8a5a00',
    [KLEUR.ijs]: '#0a6f9e',
    [KLEUR.gloed]: '#b83a10',
    [KLEUR.mint]: '#0b7a52',
    [KLEUR.net]: '#46566a',
    [KLEUR.violet]: '#5a4bd1',
    [KLEUR.tekst]: '#0f1b2d',
    [KLEUR.zacht]: '#46566a',
    [KLEUR.gedempt]: '#5a6a7e',
  };

  /* De kleuren en soorten van de inrichting (zie inrichten). */
  const MEUBEL = {
    hout: ['#8a7660', '#76634f', '#634f3f'],
    donker: ['#55647a', '#47556a', '#3b475a'],
    stof: ['#62759a', '#55678a', '#495a79'],
    kussen: ['#7b8eb3', '#6b7ea2', '#5f7091'],
    wit: ['#dfe6ec', '#c9d2db', '#b0bcc7'],
    blad: ['#c3ccd5', '#aeb8c2', '#99a4af'],
    dek: ['#7d93b8', '#6a80a5', '#5c7194'],
    doos: ['#a08460', '#8a7151', '#765f44'],
    groen: '#5d9c78',
    kleed: '#8c7aa8',
  };
  const WITGOED = /^(droger|wasmachine|vaatwasser)$/;
  /** Witgoed op ware grootte: 60 bij 60 bij 85 centimeter, bij een etage van 2,6 meter. */
  const TOESTEL = { b: 0.36, h: 0.5 };
  /**
   * Een lijn-icoon per soort kamer, in de stijl van het menu (24 bij 24, lijn
   * 1,8). Het staat voor de naam van de kamer; op het startscherm is dat alles
   * wat er van de inrichting te zien is.
   */
  const KAMER_ICOON = {
    slaapkamer: iconen.binnen('slaapkamer'),
    logeerkamer: iconen.binnen('bed'),
    kinderkamer: iconen.binnen('kinderkamer'),
    woonkamer: iconen.binnen('woonkamer'),
    woonkeuken: iconen.binnen('keuken'),
    keuken: iconen.binnen('keuken'),
    eetkamer: iconen.binnen('eetkamer'),
    badkamer: iconen.binnen('badkamer'),
    toilet: iconen.binnen('toilet'),
    hal: iconen.binnen('hal'),
    werkkamer: iconen.binnen('werkkamer'),
    wasruimte: iconen.binnen('witgoed'),
    berging: iconen.binnen('berging'),
    kamer: iconen.binnen('kamer'),
    // Besluit 166: bijkeuken, kelder en garage.
    bijkeuken: iconen.binnen('keuken'),
    kelder: iconen.binnen('kelder'),
    garage: iconen.binnen('garage'),
  };
  /** Een soort zonder eigen meubels krijgt die van een soort die erop lijkt (besluit 166). */
  const MEUBELS_ALS = { bijkeuken: 'wasruimte', kelder: 'berging', garage: 'berging' };
  /**
   * De soort van een hele kamer: zoals de dienst hem doorgeeft (`inrichting`,
   * gekozen of voorgesteld, besluit 119), of anders uit de naam en de zones.
   */
  /** Een zone is een naam, of { naam, soort } met een gekozen soort (besluit 145). */
  const zoneNaam = (zone) => (typeof zone === 'string' ? zone : zone?.naam ?? '');
  const zoneSoort = (zone) => (typeof zone === 'object' && zone?.soort ? zone.soort : soortVan(zoneNaam(zone)));
  function soortVanKamer(kamer) {
    if (kamer.inrichting) return kamer.inrichting;
    const zones = (kamer.zones ?? []).map(zoneSoort).filter(Boolean);
    if (zones.includes('keuken') && zones.includes('woonkamer')) return 'woonkeuken';
    return soortVan(kamer.naam) ?? zones[0] ?? null;
  }
  /** De terugval als de dienst geen soort meegeeft; de dienst raadt ruimer (house.ts). */
  function soortVan(naam) {
    const n = String(naam ?? '').toLowerCase();
    if (/woonkeuken|open keuken|leefkeuken/.test(n)) return 'woonkeuken';
    if (/bijkeuken/.test(n)) return 'bijkeuken';
    if (/wasruimte|washok|laundry/.test(n)) return 'wasruimte';
    if (/keuken|kitchen/.test(n)) return 'keuken';
    if (/logeer|gast|guest/.test(n)) return 'logeerkamer';
    if (/kinder|baby|speelkamer/.test(n)) return 'kinderkamer';
    if (/^(hoofd|ouder|grote |master )?slaapkamer$|master|bedroom$/.test(n)) return 'slaapkamer';
    if (/slaap|bedroom/.test(n)) return 'kinderkamer';
    if (/^(toilet|wc)\b/.test(n)) return 'toilet';
    if (/bad|douche|bathroom/.test(n)) return 'badkamer';
    if (/eetkamer|eethoek|dining/.test(n)) return 'eetkamer';
    if (/woon|zithoek|zitkamer|lounge|living|serre|huiskamer/.test(n)) return 'woonkamer';
    if (/trapkast|meterkast/.test(n)) return 'berging';
    if (/^(hal|gang|overloop|entree|portaal|vide|trap|hall|landing)\b/.test(n)) return 'hal';
    if (/werk|kantoor|studeer|hobby|office|studio|bureau|game|atelier/.test(n)) return 'werkkamer';
    if (/garage/.test(n)) return 'garage';
    if (/kelder/.test(n)) return 'kelder';
    if (/zolder|vliering|berg|attic|opslag/.test(n)) return 'berging';
    return null;
  }
  // Afmetingen in eenheden van het huis.

  /**
   * Een gekleurde lamp (besluit 129): drie tinten van zijn kleur, licht tot
   * donker, voor de kap. Null voor wit licht (een hex-kleur).
   */
  function tintenVan(kleur) {
    const m = /^hsl\((\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%/.exec(kleur ?? '');
    if (!m) return null;
    const h = Math.round(Number(m[1]));
    const sat = Math.max(55, Math.min(100, Number(m[2])));
    return [`hsl(${h} ${sat}% 80%)`, `hsl(${h} ${sat}% 66%)`, `hsl(${h} ${sat}% 54%)`];
  }

  /** De kleur van de eerste gekleurde lamp die brandt in een kamer, of null. */
  function kleurlampVan(kamer) {
    return (kamer.apparaten ?? []).find((a) => a.soort === 'lamp' && a.aan && tintenVan(a.kleur))?.kleur ?? null;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Of de ring er is: de echte zon, een kompas en een baan, en niet uitgezet bij Weergave. */
  const metRing = (model) => !!(model.zon?.nu && model.zon.baan?.length && voorDegVan(model) != null && !model.zon.geenRing);

  /** Waar de voorgevel naartoe kijkt (besluit 205): uit het huis, of uit het kompas. */
  function voorDegVan(model) {
    return model.voorgevelDeg ?? model.kompas?.voorgevelDeg ?? null;
  }

  function spook(model, wat) {
    return (model.spook ?? []).includes(wat);
  }

  /**
   * Welke feestdag het is: Halloween (24 oktober tot en met
   * 1 november), Kerst (6 december tot en met 6 januari), Oud en Nieuw (31
   * december vanaf 18:00 tot 1 januari 03:00) of Pasen (Goede Vrijdag tot en
   * met tweede paasdag). Null op een gewone dag.
   */
  function feestdagVan(ms) {
    const d = new Date(ms);
    const m = d.getMonth() + 1;
    const dag = d.getDate();
    const u = d.getHours();
    if ((m === 12 && dag === 31 && u >= 18) || (m === 1 && dag === 1 && u < 3)) return 'oudnieuw';
    if ((m === 12 && dag >= 6) || (m === 1 && dag <= 6)) return 'kerst';
    if ((m === 10 && dag >= 24) || (m === 11 && dag === 1)) return 'halloween';
    const tot = Math.round((Date.UTC(d.getFullYear(), m - 1, dag) - paasdag(d.getFullYear())) / 86_400_000);
    if (tot >= -2 && tot <= 1) return 'pasen';
    return null;
  }

  /** Eerste paasdag (de berekening van Meeus voor de gregoriaanse kalender), als UTC-middernacht. */
  function paasdag(y) {
    const a = y % 19;
    const b = Math.floor(y / 100);
    const c = y % 100;
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - Math.floor(b / 4) - g + 15) % 30;
    const l = (32 + 2 * e + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const maand = Math.floor((h + l - 7 * m + 114) / 31);
    const dag = ((h + l - 7 * m + 114) % 31) + 1;
    return Date.UTC(y, maand - 1, dag);
  }
  const FH = 1.55; // hoogte van een etage
  const KNIE = 0.5; // het muurtje onder een schuin dak met kamers erin
  /** Een binnenunit op ware grootte: zo'n 90 bij 30 centimeter, bij een etage van 2,6 meter (besluit 131). */
  const AIRCO = { b: 0.56, h: 0.19, d: 0.15 };
  /** De radiator op de achtermuur: breedte, hoogte boven de vloer en zelf. */
  const RADIATOR = { b: 0.8, onder: 0.12, h: 0.36 };
  const KAMER = 1.7; // breedte per gewicht van een kamer
  // De kijkhoek: schuin van rechtsvoor, de voorkant bijna recht, de zijgevel
  // wijkt naar achteren. y loopt van achter (0) naar voor (D).
  const AX = 0.97; // breedte, naar rechts
  const AY = 0.13; // en iets omlaag
  const BX = 0.4; // diepte, naar rechtsachter
  const BY = 0.46; // en omhoog

  function opbouw(model) {
    const etages = model.etages ?? [];
    const breedtes = etages.map((e) => (e.dak ? 0 : e.kamers.reduce((s, k) => s + (k.gewicht ?? 1), 0)));
    const W = Math.max(3.4, ...breedtes.map((b) => b * KAMER));
    const gewoon = etages.filter((e) => !e.dak);
    // Wordt de zolder gebruikt, dan staat het dak op een muurtje (knieschot), zodat er stahoogte is.
    const knie = !model.zonderDak && etages.some((e) => e.dak && (e.kamers ?? []).length > 0) ? KNIE : 0;
    const Ht = gewoon.length * FH + knie; // hoogte tot de dakvoet
    const heeftDak = true;
    return { etages, W, Ht, knie, heeftDak };
  }

  /** Een appartement (huis 3.0): hoeveel verdiepingen er onder en boven liggen. */
  const gebouwVan = (model) => ({ onder: model.gebouw?.onder ?? 2, boven: model.gebouw?.boven ?? 1, panelen: model.gebouw?.panelen ?? 0 });

  /**
   * Ingezoomd op één etage (zonder dak): de etages eronder en erboven als vage
   * lagen, zodat een verdieping niet op het gras staat. Het
   * eiland zakt één etage; eronder één vage etage die naar het gras wegloopt,
   * erboven de omtrek van de volgende etage of het dak. Null: zoals het was.
   */
  function lagenVan(model) {
    if (!model.zonderDak || !model.lagen) return null;
    const onder = Math.max(0, model.lagen.onder ?? 0);
    const boven = Math.max(0, model.lagen.boven ?? 0);
    return { onder, boven, zak: onder > 0 ? FH : 0, dak: boven === 0 && model.lagen.dak !== false };
  }
  global.huisBasis = { stilGekozen, KLEUR, TEKST_LICHT, MEUBEL, WITGOED, TOESTEL, KAMER_ICOON, MEUBELS_ALS, zoneNaam, zoneSoort, soortVanKamer, soortVan, tintenVan, kleurlampVan, esc, metRing, voorDegVan, spook, feestdagVan, paasdag, FH, KNIE, AIRCO, RADIATOR, KAMER, AX, AY, BX, BY, opbouw, gebouwVan, lagenVan };
})(window);
