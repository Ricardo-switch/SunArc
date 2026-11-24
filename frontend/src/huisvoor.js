/*
 * Het huis voor de tekenmotor (stap a van de nieuwe tekenaar):
 * uit wat `api/huistekening` geeft, het huis zoals kit/huistekenen.js het wil.
 * Eerst stond dit in jehuis.js; Thuis, een kamer en het always-on display
 * bouwen er nu ook de tekenaar mee op (alleen om te tekenen, zonder bewaren).
 */
(function (global) {
  'use strict';
  const t = (k, p) => global.t(k, p);
  const getal = (n) => n.toLocaleString(window.taal?.locale ?? 'nl-NL', { maximumFractionDigits: 1 });
  const komma = (n) => n.toLocaleString(window.taal?.locale ?? 'nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  /** Een etagenaam kort: zonder "verdieping" of "floor" erachter, als er dan nog iets staat. */
  const kortNaam = (naam) => naam.replace(/\s+(verdieping|etage|floor|storey)$/i, '') || naam;

  /** "huis, garage en uitbouw". */
  function opsomming(lijst) {
    try {
      return new Intl.ListFormat(window.taal?.locale ?? 'nl-NL', { type: 'conjunction' }).format(lijst);
    } catch {
      return lijst.join(', ');
    }
  }

  /**
   * Wat een bron van het huis vindt, in woorden (stap 4): de naam, wat hij vond,
   * wat hij weet, en de hoogte. Zonder kaart heet een rechthoek uit het
   * woningtype Basishuis, en wat je bij Daken zelf tekende Zelf getekend.
   */
  function bronVoorMotor(id, b, woning) {
    const hoofd = b.blokken.find((x) => x.soort === 'hoofdhuis') ?? b.blokken[0] ?? { b: 0, d: 0 };
    const soort = id === 'zelf' ? (b.zelfGetekend ? 'zelf' : 'basis') : id;
    const maat = { b: getal(hoofd.b), d: getal(hoofd.d) };
    const wat = opsomming([...new Set(b.blokken.map((x) => x.soort))].map((x) => t(`ht.bron.blok.${x}`)));
    const vond = soort === 'basis' ? t('ht.bron.basisVond', { woning: t(`ht.bron.woning.${woning && ['vrijstaand', 'tweekap', 'hoek', 'rij', 'appartement'].includes(woning) ? woning : 'vrijstaand'}`), ...maat }) : soort === 'zelf' ? t('ht.bron.zelfVond', maat) : t('ht.bron.gevonden', { wat });
    const weet = t(`ht.bron.weet.${soort === 'bag3d' && !b.gemeten ? 'bag3dZonder' : soort === 'osm' && b.kaartWeet ? 'osmLabels' : soort === 'osm' && b.gemeten ? 'osmMetBag' : soort}`);
    return { naam: t(`ht.bron.${soort}`), vond, weet, gemeten: b.gemeten, hoogte: t(b.gootLaag != null ? 'ht.bron.hoogteScheef' : 'ht.bron.hoogte', { goot: komma(b.goot), nok: komma(b.nok), laag: komma(b.gootLaag ?? b.goot) }),
      // Voor het huis in 3D (stap 5): de goot, de lage goot bij een scheef dak, de nok, en per gebouw het dak.
      goot: b.goot,
      ...(b.gootLaag != null ? { gootLaag: b.gootLaag } : {}),
      nok: b.nok,
      blokken: b.blokken,
      // 0.185.0: de gebouwen van de kaart eromheen, om bij Vorm aan te wijzen.
      omgeving: b.omgeving ?? [],
      // Ronde 2: wat er niet meer staat, en het afdak dat er volgens de bewoner niet is, met Terug.
      ...(b.weg ? { weg: b.weg } : {}),
      ...(b.afdakWeg ? { afdakWeg: b.afdakWeg } : {}),
      // Ronde 2 versie 2: wat de plattegrond van een huis zonder 3D-kaart weet, en het dak.
      ...(b.kaartWeet ? { kaartWeet: b.kaartWeet } : {}),
      dakvorm: b.dakvorm,
    };
  }

  /**
   * Het huis voor de motor: de etages van boven naar beneden, de begane grond
   * met alle gebouwen (garage, uitbouw), de etages erboven en eronder alleen op
   * het hoofdhuis.
   */
  /*
   * Buiten als eigen tekening (schets Wand-Huis-Buiten): het
   * erf is een etage. Het huis ligt erop als één vast vak (HUIS_OP_ERF); de
   * gebouwen van de kaart die los staan, liggen op het erf. Een deel van een
   * ruimte buiten (het terras in de tuin) is een eigen vak: `kamer~zone`.
   */
  const HUIS_OP_ERF = '@huis';
  const BUITEN_ETAGE = 'buiten';
  /** De soort van een deel buiten uit zijn naam, voor het icoon en de kleur: het terras, de border, het tuinhuis. */
  function deelSoort(naam) {
    const n = naam.toLowerCase();
    return /terras|patio/.test(n) ? 'terras' : /border|bed|perk/.test(n) ? 'border' : /tuinhuis|schuur|shed/.test(n) ? 'tuinhuis' : /oprit|pad|drive/.test(n) ? 'oprit' : 'tuin';
  }
  /** Welke ruimte buiten bij een gebouw van de kaart hoort: dezelfde soort, of dezelfde naam. */
  function ruimteVoorBlok(blok, kamers, gehad) {
    const soort = blok.soort === 'anders' ? null : blok.soort;
    return kamers.find((k) => !gehad.has(k.id) && soort && (k.soort === soort || k.naam.toLowerCase() === t(`ht.bron.blok.${soort}`).toLowerCase())) ?? null;
  }
  /** Wat er buiten vanzelf op zijn plek komt, als er nog niets getekend is: het huis, de tuin op het erf, en de gebouwen van de kaart. */
  function erfBegin(d, blokken) {
    const buiten = d.kamers.filter((k) => k.etage === BUITEN_ETAGE);
    const garageBinnen = d.kamers.some((k) => k.etage !== BUITEN_ETAGE && k.soort === 'garage');
    const boom = {};
    const gekoppeld = [];
    const gehad = new Set();
    const tuin = buiten.find((k) => k.soort === 'tuin');
    if (tuin && d.buiten?.erf) {
      boom.erf = { kamer: tuin.id };
      gehad.add(tuin.id);
    }
    for (const b of blokken) {
      const huisDeel = b.soort === 'hoofdhuis' || b.soort === 'uitbouw' || (b.soort === 'garage' && garageBinnen);
      if (huisDeel) {
        boom[b.id] = { kamer: HUIS_OP_ERF };
        continue;
      }
      const k = ruimteVoorBlok(b, buiten, gehad);
      if (!k) continue;
      boom[b.id] = { kamer: k.id };
      gehad.add(k.id);
      gekoppeld.push({ blok: b.id, kamer: k.id, naam: k.naam });
    }
    return { boom, gekoppeld, garageBinnen };
  }

  /**
   * Een leeg vak zonder naam dat op een gebouw ligt dat nu op het erf staat (de
   * garage, het tuinhuis), hoort niet meer op de begane grond: daar was het een
   * vak dat niemand een naam gaf. Bij de eerste keer bewaren is het weg.
   */
  function zonderLosBuiten(d, huis) {
    if (!huis.etages.some((e) => e.buiten) || !d.tekening) return d;
    const los = (d.bronnen?.[d.bron]?.blokken ?? []).filter((b) => ['tuinhuis', 'carport', 'anders'].includes(b.soort) || (b.soort === 'garage' && !huis.garageBinnen));
    if (!los.length) return d;
    const op = (vak) => los.some((b) => vak[0] >= b.u - 0.15 && vak[1] >= b.v - 0.15 && vak[0] + vak[2] <= b.u + b.b + 0.15 && vak[1] + vak[3] <= b.v + b.d + 0.15);
    const tekening = Object.fromEntries(Object.entries(d.tekening).map(([e, lijst]) => [e, e === BUITEN_ETAGE ? lijst : lijst.filter((r) => r.kamer || r.naam || !r.vakken.every(op))]));
    return { ...d, tekening };
  }

  /**
   * Wat voor huis (schets Wand-Huis-Woning): koos de bewoner
   * de muren tegen de buren nog niet, dan geldt wat de kaart ziet, met de vraag
   * Klopt dit? boven de tekening.
   */
  function woningVoorMotor(d) {
    const gekozen = Array.isArray(d.buren);
    const kaart = d.woningKaart ?? null;
    const soort = gekozen || !kaart ? d.woning : kaart.soort;
    // Een appartement: op welke verdieping en hoeveel erboven.
    return { soort, buren: gekozen ? d.buren : (kaart?.buren ?? []), kaart, gekozen, verdieping: d.verdieping ?? null, erboven: d.erboven ?? null };
  }

  function huisVoorMotor(d, kijk = null) {
    const beneden = d.etages.some((e) => e.id === 'bg') ? 'bg' : d.etages.at(-1)?.id;
    const hoofd = d.vorm.blokken.filter((b) => b.soort === 'hoofdhuis');
    // Stap 4: elke bron op hetzelfde ruitjespapier, met wat hij vond; de kaarten die het huis niet kennen, in een regel.
    const bronnen = Object.fromEntries(Object.entries(d.bronnen ?? {}).map(([id, b]) => [id, bronVoorMotor(id, b, d.woning)]));
    const nietGevonden = ['bag3d', 'osm'].filter((k) => d.kaarten?.[k] && d.kaarten[k] !== 'huis').map((k) => ({ naam: t(`ht.bron.${k}`), zin: t(`ht.bron.niet.${d.kaarten[k]}`) }));
    // Vragen kan als de plek bekend is en een kaart vandaag nog niets (of een fout) zei.
    const kanKijken = d.kaarten != null && ['bag3d', 'osm'].some((k) => d.kaarten[k] == null || d.kaarten[k] === 'fout');
    const metErf = !!d.buiten;
    const erfBlokken = d.bronnen?.[d.bron]?.blokken ?? d.vorm.blokken;
    const erf = metErf ? erfBegin(d, erfBlokken) : null;
    return {
      maat: d.vorm.maat,
      beneden,
      // Buiten: het erf om het huis, en of de garage binnen hoort (dan blijft hij op de begane grond).
      ...(metErf ? { erf: d.buiten.erf ? { id: 'erf', soort: 'erf', ...d.buiten.erf } : null, garageBinnen: erf.garageBinnen, begin: { [BUITEN_ETAGE]: erf.boom }, erfGekoppeld: erf.gekoppeld } : {}),
      ...(Object.keys(bronnen).length ? { bron: d.bron, bronnen } : {}),
      nietGevonden,
      ...(kanKijken && kijk ? { kijk } : {}),
      woning: woningVoorMotor(d),
      // Ronde 2 versie 2: de straten bij het huis (de kant, de afstand, en of het die van het adres is), en of er al getekend is.
      straat: { lijst: d.straten ?? [], bevestigd: !!d.straatBevestigd, getekend: !!d.getekend },
      // Kort voor de balk op de telefoon en het huis opzij: "Eerste verdieping" wordt "Eerste", "First floor" wordt "First".
      etages: [
        ...d.etages.map((e) => ({ id: e.id, naam: e.naam, kort: kortNaam(e.naam), hoogte: e.hoogte, dak: !!e.dak, blokken: e.id === beneden ? d.vorm.blokken : hoofd })),
        ...(metErf ? [{ id: BUITEN_ETAGE, naam: d.buiten.naam, kort: d.buiten.naam, hoogte: 0.1, buiten: true, blokken: [] }] : []),
      ],
      kamers: [
        ...d.kamers.map((k) => ({ id: k.id, naam: k.naam, soort: k.soort ?? null, etage: k.etage, zones: k.etage === BUITEN_ETAGE ? [] : k.zones })),
        // Elk deel van een ruimte buiten is een eigen vak, en het huis staat er vast op.
        ...d.kamers.filter((k) => k.etage === BUITEN_ETAGE).flatMap((k) => (k.delen ?? []).map((z) => ({ id: `${k.id}~${z.id}`, naam: z.naam, soort: z.soort ?? deelSoort(z.naam), etage: BUITEN_ETAGE, zones: [], deelVan: k.id }))),
        ...(metErf ? [{ id: HUIS_OP_ERF, naam: t('ht.buiten.huis'), soort: 'thuis', etage: BUITEN_ETAGE, zones: [] }] : []),
      ],
      // Stap 3: de apparaten binnen, in hun kamer of nog zonder (de strook).
      apparaten: d.apparaten ?? [],
      verborgen: d.verborgen ?? 0,
      // Stap 3: om ze in Je huis terug te halen.
      verborgenLijst: d.verborgenLijst ?? [],
    };
  }


  global.huisVoor = { getal, komma, kortNaam, opsomming, bronVoorMotor, HUIS_OP_ERF, BUITEN_ETAGE, deelSoort, ruimteVoorBlok, erfBegin, zonderLosBuiten, woningVoorMotor, huisVoorMotor };
})(window);
