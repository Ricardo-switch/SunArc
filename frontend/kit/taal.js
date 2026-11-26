/*
 * De taal van de app (besluit 185, stap 8 van het stappenplan; besluit 86).
 *
 * Alle teksten staan per taal op één plek: teksten.nl.js en teksten.en.js
 * (een pagina laadt alleen die van zijn taal, via teksten.js),
 * met een sleutel per tekst. De code vraagt ze op met `t('thuis.vandaag')`, en
 * de HTML met `data-t="thuis.vandaag"` (de tekst) of `data-t-aria-label="…"`
 * (een attribuut). `{naam}` vult zich met wat je meegeeft. Meervoud staat per
 * taal als `{ one: '…', other: '…' }` met `n` erbij (zie `vorm`); een functie
 * mag ook, voor wat per taal echt anders loopt.
 *
 * Welke taal: wat de bewoner bij Jij koos (op de telefoon, onthouden in
 * `sc-taal`), anders de taal van zijn account in Home Assistant, anders die
 * van de browser. De wand heeft geen profiel en volgt zijn eigen account.
 * Getallen, tijden en datums volgen de taal; Engels in Britse stijl: 22:00 en
 * 20.5°.
 *
 * Laden onderaan de pagina, na de tekstbestanden en voor de rest: de taal
 * staat vast voordat er iets getekend wordt. Een andere keuze laadt de pagina
 * opnieuw.
 */
(function (global) {
  'use strict';
  const TALEN = global.TALEN ?? {};
  /*
   * De talen die je kunt kiezen. Sinds 23 november 2026 laadt een pagina alleen de teksten van zijn eigen taal
   * (kit/teksten.js), dus niet uit wat er geladen is, maar vast; een taal die nog half af is en zelf geladen
   * wordt (een schets), komt erbij.
   */
  const KAN = [...new Set(['nl', 'en', ...Object.keys(TALEN)])];
  /**
   * De talen die de hele app spreekt: alleen die kiest de app vanzelf, uit het
   * account of de browser. Een taal die nog half af is, kies je zelf bij Jij;
   * anders zag iemand met zo'n account op de andere pagina's een mengtaal.
   * Engels sinds stap 9 af is: de app, de dienst en de
   * assistent spreken het.
   */
  const HEEL = ['nl', 'en'];
  const SLEUTEL = 'sc-taal';
  /** Engels in Britse stijl (besluit 185): 24-uursklok, punt als decimaalteken. */
  const LOCALE = { nl: 'nl-NL', en: 'en-GB' };

  /** De taal van het account in Home Assistant: binnen Home Assistant leest de app die van het paneel eromheen. */
  function haTaal() {
    try {
      // Het element van Home Assistant zelf, met zijn eigen `hass`.
      return /** @type {any} */ (global.parent?.document?.querySelector('home-assistant'))?.hass?.language ?? null;
    } catch {
      return null;
    }
  }
  /** "en-GB", "nl" of "EN" wordt een taal die de app kent (of in `lijst` staat), of null. */
  const past = (code, lijst = KAN) => {
    const c = String(code ?? '').toLowerCase().split(/[-_]/)[0];
    return lijst.includes(c) ? c : null;
  };
  function gekozen() {
    try {
      return past(global.localStorage?.getItem(SLEUTEL));
    } catch {
      return null;
    }
  }
  /**
   * Vanzelf: het account, dan de browser; een taal die de app nog niet helemaal
   * spreekt, telt niet. Spreekt iemand alleen een andere taal (Frans, Duits),
   * dan Engels: dat begrijpt hij eerder dan Nederlands.
   * Zonder enige taal blijft het Nederlands.
   */
  const vanzelf = () => {
    const talen = [haTaal(), global.navigator?.language, ...(global.navigator?.languages ?? [])].filter(Boolean);
    return talen.map((x) => past(x, HEEL)).find(Boolean) ?? (talen.length ? 'en' : HEEL[0]);
  };
  // De taal die kit/teksten.js al koos en laadde; zonder dat script (de schetsen) kiest dit bestand zelf.
  const code = past(global.TAAL_GELADEN) ?? gekozen() ?? vanzelf();
  const locale = LOCALE[code] ?? code;
  if (global.document?.documentElement) global.document.documentElement.lang = code;

  /**
   * Meervoud: een tekst als `{ one: '1 lamp', other: '{n} lampen' }` kiest zijn
   * vorm naar `n`, met de regels van de taal (Intl.PluralRules), zodat een taal
   * met meer vormen, zoals later misschien een andere, er gewoon bij kan. Met
   * `zero` een eigen zin voor nul ("geen lampen").
   */
  const MEERVOUD = typeof Intl !== 'undefined' && Intl.PluralRules ? new Intl.PluralRules(LOCALE[code] ?? code) : null;
  function vorm(w, n) {
    if (n === 0 && w.zero != null) return w.zero;
    return w[MEERVOUD?.select(n) ?? (n === 1 ? 'one' : 'other')] ?? w.other;
  }

  /*
   * Dezelfde tekst onder een andere sleutel (besluit 352). Veel sleutels bouwt de code op, zoals
   * `nav.${id}` en `rond.plek.${id}`, en die zeggen soms precies wat een andere al zegt: "Vandaag", "Klimaat".
   * Zo'n tekst staat maar één keer in elk taalbestand; hier staat welke sleutels hem ook gebruiken. Met ^
   * ervoor krijgt hij een hoofdletter ("van het net" wordt "Van het net"). Heeft een taal de sleutel toch
   * zelf, dan wint die: zo kan een vertaling ze weer uit elkaar halen.
   */
  const ZELFDE = {
    'functies.deel.volledig': ['^w.volledigScherm', '^rond.naarHA.kop'],
    'w.deurbel': ['zoek.deurbel'],
    'w.eerder': ['vandaag.eerder'],
    'w.weer': ['zoek.weer'],
    'assistent.feit.netTerugWh': ['^w.terug'],
    'w.nu': ['^w.nu2', '^opbrengst.soort.nu', '^kan.nu', '^motor.deel.nu'],
    'w.vanHetNet': ['^w.vanHetNet2', 'assistent.feit.netAfWh'],
    'w.vandaag2': ['^w.vandaag', '^nav.vandaag', '^rond.plek.vandaag', '^vandaag.vandaag', 'auto.advies.vandaag', '^motor.deel.vandaag'],
    'stroom.leg.zon': ['^w.zon', '^voorbeeld.weer.zon', '^stroom.tab.zon', '^vandaag.zon', '^opbrengst.maat.zon'],
    'stroom.leg.net': ['^w.net', '^stroom.tab.net'],
    'w.sunarcKijktMee': ['hulp.kijkt-mee.kop'],
    'w.klimaat': ['kamer.klimaat', 'apparaten.soort.klimaat', 'groep.comfort', 'inst4.klimaat', 'kan.klaar.klimaat', 'pl.soort.klimaat', 'tk.soort.klimaat', 'hulp.plek.klimaat'],
    'w.deAuto': ['functies.mk.auto'],
    'w.teDoen': ['nav.tedoen', 'rond.plek.tedoen', 'zoek.tedoen', 'kan.tedoen', 'voortgang.kort.tedoen'],
    'w.thuis': ['^nav.thuis', '^rond.plek.thuis', '^jij.thuis', '^zoek.waar.thuis'],
    'w.onbekend2': ['^w.onbekend', '^toegang.onbekend'],
    'w.opZon2': ['^w.opZon', '^kan.groep.zon', '^kan.kort.opzon', '^inr.rol.zonKort'],
    'w.toevoegen': ['kz.route.begin'],
    'eigen.lamp.aan': ['^w.aan', '^pl.aan', 'motor.zon.stekkerAan'],
    'accu.wat.vermogen': ['^w.vermogen', 'laden.wat.vermogen'],
    'w.metDeHand': ['hulp.met-de-hand.kop'],
    'w.weghalen': ['ht.opening.weg'],
    'w.volgt': ['^w.volgt2', 'klimaat.doetMee', '^indeling.doetMee', '^indeling.doetMeePunt'],
    'w.hoofdgebruiker2': ['^w.hoofdgebruiker'],
    'w.meldingen': ['nav.meldingen'],
    'w.comfort': ['kan.groep.comfort', 'kan.kort.temperatuur'],
    'w.watJeHuisKan': ['rond.plek.huisKan', 'zoek.kan'],
    'w.apparaten': ['ht.apparaten'],
    'w.geen': ['^functies.weer.geen'],
    'w.alsNiemandThuisIs': ['^w.alsNiemandThuisIs2'],
    'motor.dag.leg.warm': ['^w.verwarmen'],
    'motor.dag.leg.koel': ['^w.koelen'],
    'functies.deel.nooit': ['^w.nooit'],
    'w.overdag': ['^comfort.naam.dag', 'gevoel.dagdeel.dag'],
    'w.later': ['basis.versie.later', 'vandaag.later'],
    'stand.kamerWoord': ['^w.kamer', '^zv.soort.kamer'],
    'w.uit2': ['^w.uit', 'eigen.lamp.uit', '^kamer.wens.uit', '^evcc.stand.off', '^pl.uit', '^motor.actie.off'],
    'energie.wat.zon': ['^w.zonnepanelen', '^rond.plek.daken', '^inst4.daken', '^zoek.panelen', '^energie.rol.zon'],
    'panelen.weetNiet': ['^w.weetIkNiet', 'energie.soort.weetniet', 'panelen.zon.weetniet'],
    'w.weghalen2': ['hand.stekkerVastWeg'],
    'jij.meld.tot': ['^w.tot2'],
    'w.telefoon': ['^jij.meld.telefoon'],
    'w.bewaar': ['pl.bewaar'],
    'ht.bron.blok.hoofdhuis': ['^w.huis', '^eigen.wg.huis', '^kamer.huis', '^daken.gebouw.hoofdhuis'],
    'w.ja': ['inr.k.ja'],
    'w.minuten2': ['vandaag.minuten'],
    'w.etage': ['kamer.etage'],
    'w.koelt': ['motor.warmte.koelt'],
    'w.verwarmt': ['motor.warmte.verwarmt'],
    'w.sluipverbruik': ['functies.mk.sluip', 'voortgang.kort.sluip'],
    'w.thuis2': ['^bewoners.thuisZin'],
    'w.morgen': ['^thuis.weer.morgen', '^vandaag.morgen', 'auto.advies.morgen'],
    'pl.leeg.wanneer': ['^w.wanneer', '^pl.s.wanneer'],
    'pl.s.klaar': ['algemeen.klaar', 'rond.plek.klaar', 'rond.klaar.kop', 'inr.k.klaar'],
    'algemeen.gisteren': ['^vandaag.gisteren', '^auto.beurt.gisteren'],
    'basis.alarm.wat.rook': ['^basis.alarm.gevaar.rook'],
    'basis.alarm.wat.co': ['^basis.alarm.gevaar.co'],
    'basis.alarm.wat.hitte': ['^basis.alarm.gevaar.hitte'],
    'basis.onderhoud.aandacht': ['^basis.meld.aandacht'],
    'functies.mk.batterij': ['basis.onderhoud.batterij'],
    'pl.titel': ['basis.versie.nieuw', 'ht.afdak.nieuw'],
    'inr.as.fout': ['basis.versie.mislukt'],
    'nav.apparaten': ['rond.plek.apparaten', 'jehuis.apparaten', 'hulp.plek.apparaten', 'hulp.apparaten.kop'],
    'nav.opbrengst': ['rond.plek.opbrengst', 'voortgang.kort.opbrengst'],
    'nav.assistent': ['rond.plek.assistent', 'groep.assistent'],
    'nav.instellingen': ['rond.plek.instellingen', 'zoek.waar.instellingen'],
    'voorbeeld.zomer': ['motor.seizoen.zomer'],
    'voorbeeld.winter': ['motor.seizoen.winter'],
    'niemand.weer.bewolkt': ['^voorbeeld.weer.bewolkt'],
    'niemand.weer.regen': ['^voorbeeld.weer.regen'],
    'niemand.weer.sneeuw': ['^voorbeeld.weer.sneeuw'],
    'jij.taal.auto': ['thuis.stand.automatisch'],
    'thuis.hetHuis': ['daken.zicht.huis'],
    'zoek.inrichten': ['thuis.inrichten', 'groep.inrichten'],
    'paal.naam': ['zv.soort.laadpaal', 'laden.rol.laadpaal'],
    'auto.plek.oprit': ['^paal.plek.oprit'],
    'auto.plek.carport': ['^paal.plek.carport'],
    'auto.plek.garage': ['^paal.plek.garage', '^indeling.accu.garage'],
    'paal.fasen': ['toev.losse.stroom'],
    'laden.wat.stroom': ['^paal.stroom'],
    'stroom.leg.huis': ['^stroom.tab.huis', '^thuis.stromen.huis'],
    'stroom.leg.accu': ['^stroom.tab.accu', 'laden.wat.lading', '^laden.accu'],
    'stroom.net.terug': ['^apparaten.terugNet'],
    'thuis.label.vanNet': ['auto.advies.thuis.vanNet'],
    'thuis.label.accuLevert': ['^opbrengst.accu.uit'],
    'kan.thermisch.dag1': ['^thuis.stand.dag', '^vandaag.dag', '^opbrengst.soort.dag', '^motor.stand.dag'],
    'comfort.legenda.nacht': ['^thuis.stand.nacht', '^motor.stand.nacht'],
    'motor.stand.afwezig': ['thuis.stand.afwezig', 'comfort.naam.afwezig', 'voortgang.kort.afwezig'],
    'motor.stand.vakantie': ['thuis.stand.vakantie', 'comfort.naam.vakantie'],
    'motor.stand.handmatig': ['thuis.stand.handmatig'],
    'voortgang.ring.kijkt': ['^thuis.doet.stand.kijkt', '^stand.label.kijkt', '^regeling.fase.kijken', '^kan.stand.kijkt'],
    'kan.warmte.onbekend': ['thuis.boiler.onbekend'],
    'thuis.water.wachtZon': ['^apparaten.wachtZon'],
    'vandaag.zelf': ['thuis.tegel.zelf'],
    'thuis.tegel.regen': ['vandaag.kansRegenPct'],
    'rond.gevoel.kop': ['thuis.gevoel.kort'],
    'thuis.maand.zelf': ['^opbrengst.zelfGebruikt', 'assistent.feit.zelfPct'],
    'thuis.cam.kop': ['apparaten.soort.cameras', 'voortgang.kort.camera'],
    'inr.persoon': ['^thuis.cam.soort.persoon'],
    'eigen.wg.weer': ['thuis.weer.kop'],
    'thuis.batterijen.kop': ['voortgang.kort.batterijen'],
    'thuis.vraag.nu': ['assistent.vraag.nu'],
    'thuis.vraag.zon': ['assistent.vraag.zon'],
    'huis.kompas.n': ['panelen.windroos.n'],
    'huis.kompas.o': ['panelen.windroos.o'],
    'huis.kompas.z': ['panelen.windroos.z'],
    'huis.kompas.w': ['panelen.windroos.w', 'daken.grens.vul'],
    'kan.licht.aan': ['huis.lampenAan'],
    'ht.dakkapel.tuin': ['huis.buiten.tuin'],
    'laden.plek.oprit': ['huis.buiten.oprit', 'soort.buiten.oprit', 'soort.buitenZone.oprit'],
    'huis.buiten.terras': ['soort.buiten.terras', 'soort.buitenZone.terras'],
    'wn.balkon': ['huis.buiten.balkon', 'soort.buiten.balkon'],
    'huis.buiten.voortuin': ['soort.buiten.voortuin'],
    'ht.bron.blok.garage': ['^huis.buiten.garage', '^laden.plek.garage', '^panelen3.plek.garage', '^daken.plek.garage', '^daken.gebouw.garage', '^daken.tegel.garage'],
    'ht.opening.voordeur': ['huis.buiten.voordeur', 'soort.buiten.voordeur'],
    'buiten.accu.laadt': ['^auto.stand.laadt'],
    'buiten.accu.levert': ['^apparaten.levert'],
    'daken.meters': ['rond.dakMeters.kop'],
    'inr.volgende': ['rond.volgende'],
    'rond.huis.kop': ['film.huis.kicker'],
    'inr.zk.assistentZin': ['^rond.assistent.kop', '^kan.vraag', '^voortgang.kort.vraag'],
    'eigen.breed': ['ht.gebouw.breed'],
    'functies.screen': ['^eigen.soort.screen', '^ht.opening.screen'],
    'ht.bij.licht': ['eigen.soort.lamp', 'toev.wat.lamp', 'toev.ding.licht'],
    'pl.soort.scene': ['eigen.soort.scene'],
    'tedoen.alles': ['^eigen.filter.alles', '^apparaten.alles'],
    'tk.soort.licht': ['eigen.filter.lampen'],
    'pl.soort.scherm': ['eigen.filter.screens', 'voortgang.kort.screens', 'tk.soort.scherm'],
    'jij.eenvoudig': ['eigen.wg.eenvoudig'],
    'jij.uitgebreid': ['eigen.wg.uitgebreid'],
    'jij.letters': ['eigen.wg.letters'],
    'jij.lettersZin': ['eigen.wg.lettersZin'],
    'jij.beweging': ['eigen.wg.beweging'],
    'kamer.zoneDoel': ['indeling.zone.doel'],
    'kamer.licht': ['apparaten.soort.licht'],
    'kan.licht.uit': ['^kamer.allesUit', 'apparaten.lampenUit'],
    'kamer.sensoren': ['toev.losse.sensoren'],
    'kamer.veiligheid': ['functies.mk.groep.veiligheid'],
    'inr.kan.batterij': ['kamer.melder.batterij', 'kan.kort.batterij'],
    'kamer.doel': ['assistent.feit.doel'],
    'vandaag.werk.koelen': ['^kamer.wens.koelen', '^pl.koelen', '^hand.modus.koelen', '^motor.actie.cool'],
    'vandaag.werk.verwarmen': ['^kamer.wens.verwarmen', '^pl.verwarmen', '^hand.modus.verwarmen', '^motor.actie.heat'],
    'vandaag.werk.drogen': ['^kamer.wens.drogen', '^hand.modus.drogen'],
    'inr.kan.filter': ['kamer.filter.kop'],
    'kan.thermostaat': ['^kamer.thermostaat'],
    'hand.verwarmt': ['kamer.verwarmt'],
    'tk.a.open.n': ['kamer.scherm.open', '^kamer.scherm.openKnop', '^buiten.deurOpen', '^kan.klaar.open', '^pl.open'],
    'kamer.scherm.dicht': ['^buiten.deurDicht', '^pl.dicht'],
    'tk.a.dicht.n': ['^kamer.scherm.dichtKnop'],
    'pl.half': ['kamer.scherm.half'],
    'apparaten.blad.helder': ['kamer.lamp.helderheid'],
    'bron.airco': ['^vandaag.airco', '^indeling.airco', 'hand.hulp.lAirco'],
    'vandaag.opgewekt': ['assistent.feit.zonWh'],
    'vandaag.verwacht': ['assistent.feit.vooraf'],
    'vandaag.jePanelen': ['^opbrengst.panelen'],
    'vandaag.dagen': ['motor.stand.dagen'],
    'motor.regel.comfort': ['^apparaten.rol.houdt', '^indeling.rol.houdt', '^hulp.houdt-op-temperatuur.kop'],
    'indeling.rol.zon': ['apparaten.rol.zon', 'hulp.helpt-op-zon.kop'],
    'inr.rol.kijken': ['apparaten.rol.kijken', 'indeling.rol.kijken', 'hulp.doet-niet-mee.kop'],
    'motor.nu.uit': ['^apparaten.stekkerUit'],
    'kan.batterij': ['apparaten.thuisbatterij', 'voortgang.kort.batterij'],
    'accu.wat.lading': ['^apparaten.lading'],
    'pl.soort.witgoed': ['apparaten.soort.witgoed'],
    'motor.meet.accu': ['apparaten.soort.energie', 'functies.mk.accu'],
    'tk.soort.stekker': ['apparaten.soort.stekkers'],
    'accu.rol.vermogen': ['apparaten.blad.vermogen', 'toev.losse.vermogen'],
    'accu.rol.geladen': ['toev.losse.energie2'],
    'toev.geenMeter': ['^vermogens.geenFaseMeter'],
    'toev.wat.ventilator': ['hand.modus.ventilator'],
    'toev.wat.boiler': ['zv.soort.boiler', 'voortgang.kort.boiler'],
    'panelen.anders': ['^toev.wat.anders', '^daken.anders'],
    'ht.app.geenKamer': ['^toev.geenKamer'],
    'laden.nPalen': ['toev.losse.n2'],
    'assistent.feit.euro': ['^opbrengst.kosten', '^opbrengst.maat.kosten', '^kan.groep.kosten'],
    'energie.gas': ['^opbrengst.gas', '^opbrengst.maat.gas', '^energie.rol.gas'],
    'energie.stroom': ['^opbrengst.stroom', '^opbrengst.maat.stroom'],
    'ct.dynamisch': ['opbrengst.per.dag'],
    'energie.per.dag': ['^opbrengst.per.week', '^opbrengst.per.maand'],
    'energie.per.maand': ['^opbrengst.per.jaar', 'kan.idee.batterijWint'],
    'energie.per.jaar': ['opbrengst.perJaar'],
    'opbrengst.vergelijken': ['motor.deel.vergelijken'],
    'assistent.feit.vermogen': ['^opbrengst.nu.zon'],
    'assistent.feit.piekTijd': ['^hand.om'],
    'groep.huis': ['assistent.jeHuis', 'inr.k.jehuis'],
    'tedoen.jij': ['^assistent.jij'],
    'assistent.stopTekst': ['^assistent.stopScherm'],
    'pl.soort.licht': ['jij.thema.licht'],
    'jij.kop': ['zoek.waar.jij'],
    'zoek.thema': ['jij.themaKleur'],
    'jij.weergave': ['zoek.weergave'],
    'jij.deHoofdgebruiker': ['^bewoners.deHoofdgebruiker'],
    'ht.app.nietGekozen': ['^jij.nogNietGekozen', 'inst4.geenVoorrang'],
    'jij.meld.rook': ['functies.mk.rook'],
    'inst4.licht': ['groep.functies'],
    'groep.toegang': ['inst4.bewoners'],
    'jehuis.kop': ['inst4.jehuis', 'hulp.plek.jehuis', 'hulp.je-huis.kop'],
    'inst4.energie': ['functies.mk.groep.energie', 'hulp.plek.energie'],
    'inst4.panelen': ['panelen3.aantal'],
    'inst4.vanzelf': ['^functies.deel.vanzelf'],
    'inst4.slimmeMeter': ['^inr.k.slimmeMeter'],
    'zoek.prijzen': ['inst4.prijzen', 'energie.prijzen'],
    'ht.kamers': ['instellingen.kamers'],
    'zoek.zekering': ['instellingen.zekering', 'hulp.hoofdzekering.kop'],
    'instellingen.alleenKijken': ['^functies.kijken'],
    'instellingen.bedienen': ['^functies.bedienen'],
    'zoek.bewoners': ['instellingen.bewoners', 'kan.klaar.bewoners'],
    'voortgang.ring.werkt': ['^stand.label.werkt', '^kan.stand.werkt'],
    'kan.stand.leert': ['stand.label.leert', 'panelen3.chip.leert'],
    'kan.stand.uit': ['stand.label.uit'],
    'inr.invullen': ['^stand.invullen', '^kan.ga.mis', '^inr.k.invullen'],
    'kan.afwezig': ['zoek.afwezig', 'comfort.afwezig'],
    'zoek.meters': ['energie.meters', 'kan.opbrengst.meters', 'hulp.meters.kop'],
    'zoek.cameras': ['functies.cameras'],
    'zoek.stem': ['functies.deel.stem'],
    'zoek.aod': ['functies.aod.kop'],
    'zoek.uit': ['functies.uit.kop'],
    'zoek.sleutel': ['toegang.sleutel'],
    'kan.batterijen': ['zoek.batterijen'],
    'kz.kop': ['zoek.klaarzetten'],
    'groep.bewaren': ['jehuis.bewaren'],
    'groep.bewaard': ['jehuis.bewaard'],
    'groep.nietBewaard': ['jehuis.nietBewaard'],
    'klimaat.nietMee': ['^inr.nietMee'],
    'klimaat.cv': ['hulp.helpt-de-cv.kop'],
    'klimaat.meten.zones': ['^ht.zones.kop'],
    'comfort.opZonMag': ['hulp.op-zon-mag-het.kop'],
    'comfort.koelenNet': ['hulp.koelen-van-het-net.kop'],
    'comfort.legenda.voorverwarmen': ['^motor.stand.voorverwarmen'],
    'inr.k.verwarming': ['energie.verwarming'],
    'energie.soort.cv': ['^energie.bron.cv'],
    'energie.soort.warmtepomp': ['^energie.bron.warmtepomp'],
    'energie.soort.stadsverwarming': ['^energie.bron.stadsverwarming'],
    'energie.soort.airco': ['^energie.bron.airco'],
    'energie.normaal': ['^functies.luister.stand3', '^functies.luister.normaal'],
    'energie.wat.afname': ['^energie.rol.afname'],
    'energie.wat.teruglevering': ['^energie.rol.teruglevering', '^energie.teruglevering'],
    'gp.h.weekend': ['energie.weekend'],
    'inr.jacuzzi': ['zv.soort.jacuzzi', 'voortgang.kort.jacuzzi'],
    'zv.kachel': ['witgoed.opZon'],
    'laden.wat.laadgrens': ['^auto.feit.laadgrens'],
    'laden.wat.kabel': ['^auto.feit.kabel'],
    'laden.wat.laadt': ['^auto.laden.kop'],
    'laden.wat.stand': ['^auto.paal.stand'],
    'laden.wat.pauzeren': ['^film.pauze'],
    'auto.titel': ['laden.rol.auto'],
    'ht.bron.blok.carport': ['^laden.plek.carport', '^panelen3.plek.carport', '^soort.buiten.carport', '^soort.buitenZone.carport', '^daken.plek.carport', '^daken.gebouw.carport', '^daken.tegel.carport'],
    'ht.app.laatKiezen': ['^accu.geen'],
    'auto.paal.nietGemeten': ['^auto.kabelOnbekend'],
    'ht.nietInHA': ['^auto.nietInHA'],
    'auto.tekening.leeg': ['auto.tekening.leeg.oprit'],
    'auto.laden.dag.tot': ['auto.laden.totKlokKort', '^auto.laden.totTijd'],
    'auto.laden.totKabelKort': ['^auto.laden.totKabel'],
    'auto.laden.deelsNet': ['^auto.advies.minder.kop'],
    'hulp.snap': ['melden.soort.snap'],
    'inr.zk.werkt': ['melden.stand.werkt', '^functies.praten.status.werkt'],
    'kan.ligging.voorstel': ['^panelen3.chip.voorstel'],
    'daken.stand.gemeten': ['panelen3.status.gemeten'],
    'ht.gemeten': ['panelen3.status.voorstel'],
    'inr.k.nogNiet': ['panelen3.nogNiet'],
    'daken.platDak': ['panelen3.plekZin.garage', 'panelen3.plekZin.carport', '^daken.dakvorm.plat'],
    'panelen3.voorkant': ['^ht.dakkapel.voor'],
    'motor.richting.n': ['^panelen3.kort.n'],
    'motor.richting.no': ['^panelen3.kort.no'],
    'motor.richting.o': ['^panelen3.kort.o'],
    'motor.richting.zo': ['^panelen3.kort.zo'],
    'motor.richting.z': ['^panelen3.kort.z'],
    'motor.richting.zw': ['^panelen3.kort.zw'],
    'motor.richting.w': ['^panelen3.kort.w'],
    'motor.richting.nw': ['^panelen3.kort.nw'],
    'kan.licht': ['functies.lichtScenes', 'voortgang.kort.licht'],
    'kan.screens': ['functies.screens'],
    'functies.aod.onder': ['^gp.onder'],
    'functies.aod.op': ['^gp.op'],
    'functies.mk.altijd': ['functies.stem.soort.apparaat', 'kan.vraag.wanneer.1', 'kan.batterijen.wanneer.1'],
    'film.app.groot': ['functies.mk.groep.apparaten'],
    'voortgang.as.winter': ['functies.mk.mijlpaal'],
    'kan.klaar.praten': ['functies.deel.praten'],
    'toegang.rol.bewoner': ['^bewoners.bewoner'],
    'daken.kk.doetKop': ['bewoners.watHetDoet'],
    'bewoners.gastKort': ['^bewoners.gast'],
    'soort.zone.keuken': ['soort.kamer.keuken'],
    'soort.zone.badkamer': ['soort.kamer.badkamer'],
    'ht.eigen.toilet': ['soort.kamer.toilet', 'soort.zone.toilet'],
    'soort.zone.leeg': ['soort.kamer.leeg'],
    'ht.eigen.berging': ['soort.zone.berging'],
    'soort.buiten.tuinhuis': ['soort.buitenZone.tuinhuis'],
    'ht.eigen.pad': ['soort.buitenZone.pad'],
    'bron.radiator': ['^ht.app.radiator'],
    'kan.idee.slimZin': ['^indeling.aan.stekker'],
    'motor.stand.uitleg': ['kan.thermisch.dagen'],
    'kan.apparaten': ['voortgang.kort.apparaten'],
    'kan.goedkoop': ['voortgang.kort.goedkoop'],
    'kan.licht.wanneer.1': ['kan.screens.wanneer.1'],
    'kan.weer': ['voortgang.kort.weer'],
    'kan.bekijk': ['stand1.bekijk'],
    'inr.zk.erbij': ['^stand1.kanErbij'],
    'kan.groep.gemak': ['kan.klaar.gemak'],
    'kan.boiler': ['hulp.boiler.kop'],
    'kan.boiler.wanneer.1': ['kan.jacuzzi.wanneer.1'],
    'kan.boiler.wanneer.2': ['kan.jacuzzi.wanneer.2'],
    'kan.ga.bekijken': ['kz.route.bekijk'],
    'kan.zetAan': ['hand.stekkerZetAanKort'],
    'kz.inHA': ['kan.klaar.inHA'],
    'kan.klaar.klaar': ['^kz.klaar'],
    'kan.kort.auto': ['voortgang.kort.auto'],
    'ht.plek.voor': ['ht.straat.kant.voor', 'jehuis.straat.kant.voor'],
    'wn.soort.vrijstaand': ['inr.woning.vrijstaand'],
    'wn.soort.tweekap': ['inr.woning.tweekap'],
    'wn.soort.hoek': ['inr.woning.hoek'],
    'wn.soort.appartement': ['ht.bron.woning.appartement'],
    'wn.zin.hoek': ['wn.zin.tweekap'],
    'wn.vanKaart': ['ht.weet.kaart'],
    'wn.tegen': ['ht.opening.buurmuur'],
    'wn.kantKlein.links': ['^wn.kant.links', '^ht.opening.links', '^ht.straat.knop.links', '^ht.dakkapel.links'],
    'wn.kantKlein.rechts': ['^wn.kant.rechts', '^ht.opening.rechts', '^ht.straat.knop.rechts', '^ht.dakkapel.rechts'],
    'wn.kantKlein.achter': ['^wn.kant.achter', '^ht.opening.achterkant', '^ht.straat.knop.achter'],
    'tk.en': ['wn.en'],
    'pl.lager': ['wn.lager', 'hand.lager'],
    'pl.hoger': ['wn.hoger', 'hand.hoger'],
    'wn.balkonZin': ['^ht.buiten.kop', '^inr.stap.buiten', '^hulp.buiten.kop'],
    'ht.bron.bag3d': ['daken.wk.bag3d'],
    'ht.bron.zelf': ['ht.huis.zelf'],
    'ht.bron.blok.uitbouw': ['^daken.plek.uitbouw', '^daken.gebouw.uitbouw'],
    'ht.opening.deurZin': ['ht.opening.achterdeurZin', 'ht.opening.voordeurZin'],
    'ht.opening.voorkant': ['ht.straat.knop.voor'],
    'daken.straat': ['^ht.straat.een'],
    'ht.straat.kant.links': ['jehuis.straat.kant.links'],
    'ht.straat.kant.rechts': ['jehuis.straat.kant.rechts'],
    'ht.straat.kant.achter': ['jehuis.straat.kant.achter'],
    'ht.dakkapel.nok': ['^ht.weet.nok'],
    'ht.bron.blok.tuinhuis': ['^inr.tuinhuis'],
    'ht.bron.blok.anders': ['^daken.gebouw.anders'],
    'ht.vakZonderNaam': ['^ht.vakZonderNaamKop'],
    'ht.buiten.span': ['^ht.buiten.rond'],
    'ht.dakkapel.etageZin': ['^ht.dakkapel.welkeEtage'],
    'indeling.elektrisch': ['^inr.kan.warmte.elektrisch'],
    'daken.kk.annuleren': ['indeling.annuleren'],
    'inr.kan.kop': ['inr.stap.apparaat'],
    'sluip.weetNiet': ['inr.kan.warmte.weetniet'],
    'inr.k.panelen': ['inr.k.panelenNaam'],
    'inr.k.prijzen': ['hulp.prijzen.kop'],
    'inr.nietInHA': ['inr.k.nietGevonden'],
    'inr.nApparaten': ['inr.k.apparaten'],
    'sluip.rond': ['^sluip.staaf.rond'],
    'pl.begin': ['inr.begin'],
    'motor.reden.zone_satisfied': ['^inr.rol.houdtKort', '^voortgang.kort.temperatuur'],
    'inr.dak.grond': ['daken.tegel.grond'],
    'inr.meter.panelen': ['^motor.panelen.kop'],
    'hulp.klopt': ['welkom.kloptNiet'],
    'gevoel.woord.te_koud': ['^gevoel.knop.te_koud'],
    'gevoel.woord.goed': ['^gevoel.knop.goed'],
    'gevoel.woord.te_warm': ['^gevoel.knop.te_warm'],
    'voortgang.ring.geleerd': ['^motor.deel.geleerd'],
    'voortgang.weg.standen': ['^voortgang.as.dekking'],
    'gp.gedaan': ['^tedoen.gedaan'],
    'tedoen.herinnering': ['^tedoen.keuze.herinnering'],
    'tk.h.dag': ['^gp.h.dag', '^hand.vast.dag'],
    'pl.leeg.wat': ['^gp.wat', '^pl.s.wat'],
    'pl.zeg': ['pl.hulpLink'],
    'pl.s.hoevaak': ['pl.leeg.hoevaak', 'tk.k.hoevaak'],
    'pl.hoeLang': ['hand.hoeLang'],
    'hand.uur1': ['pl.tot.uur1'],
    'hand.uur2': ['pl.tot.uur2'],
    'hand.min30': ['pl.tot.m30'],
    'hand.uur4': ['pl.tot.uur4'],
    'pl.wat.stekker': ['pl.wat.lichtAan'],
    'pl.wat.plugUit': ['pl.wat.lichtUit'],
    'pl.wat.scene': ['tk.sceneOptie'],
    'pl.om': ['tk.om'],
    'pl.terug': ['daken.terug'],
    'hand.totKlokKort': ['^hand.totKlok'],
    'kz.route.googleKost': ['kz.route.openaiKost'],
    'daken.waar.plat': ['^daken.opstelling.plat'],
    'daken.plek.tuinhuis': ['daken.gebouw.tuinhuis', 'daken.tegel.tuinhuis'],
    'motor.meet.ronde': ['^motor.ronde.kop'],
    'motor.meet.niemand': ['motor.reden.nobody_home'],
    'motor.reden.surplus_insufficient': ['motor.blok.insufficient_power_budget'],
    'w.nietsGevonden': ['^inr.nietsGevonden'],
    'instellingen.nogNiemand': ['^toegang.nogNiemand'],
    'jij.meld.geenAntwoord': ['^kamer.geenAntwoord'],
    'w.weg': ['^bewoners.wegZin'],
    'w.wegSinds': ['^bewoners.wegSindsZin'],
    'basis.versie.geenVerbinding': ['^kamer.geenVerbinding'],
    'apparaten.rustig': ['^niemand.rustig'],
    'inr.k.netAf': ['^vermogens.netAf'],
  };
  /** Per sleutel uit de lijst: de sleutel waar zijn tekst staat, en of hij een hoofdletter krijgt. */
  const VERWIJS = new Map();
  for (const [doel, lijst] of Object.entries(ZELFDE)) for (const k of lijst) VERWIJS.set(k.replace(/^\^/, ''), [doel, k.startsWith('^')]);
  /** De tekst zoals hij in het bestand staat: eigen sleutel, anders via de lijst. */
  function ruw(sleutel) {
    const w = TALEN[code]?.[sleutel] ?? TALEN.nl?.[sleutel];
    if (w != null || !VERWIJS.has(sleutel)) return w;
    const [doel, hoofd] = VERWIJS.get(sleutel);
    const v = TALEN[code]?.[doel] ?? TALEN.nl?.[doel];
    return hoofd && typeof v === 'string' ? v.charAt(0).toUpperCase() + v.slice(1) : v;
  }
  /** Of er een tekst is voor deze sleutel, zonder waarschuwing. */
  const heeft = (sleutel) => ruw(sleutel) != null;

  /** De tekst bij een sleutel, in de taal van de app; mist hij, dan de Nederlandse en een waarschuwing. */
  function t(sleutel, p = {}) {
    const w = ruw(sleutel);
    if (w == null) {
      console.warn(`Geen tekst voor ${sleutel}`);
      return sleutel;
    }
    const s = typeof w === 'function' ? w(p) : typeof w === 'object' ? vorm(w, Number(p.n ?? 0)) : w;
    // `{valuta}` vult zichzelf in met het teken van het huis (testerronde, november 2026).
    return String(s).replace(/\{(\w+)\}/g, (m, k) => (p[k] != null ? String(p[k]) : k === 'valuta' ? valuta() : m));
  }

  /*
   * De valuta van het huis (testerronde, november 2026): uit Home Assistant, via
   * `api/site`; basis.js bewaart hem. Euro tot de dienst iets anders zegt.
   */
  const VALUTA = 'sc-valuta';
  let valutaCode = 'EUR';
  try {
    const v = global.localStorage?.getItem(VALUTA);
    if (v && /^[A-Z]{3}$/.test(v)) valutaCode = v;
  } catch {
    // Zonder opslag euro.
  }
  /** Het teken van de valuta in de taal van de app: €, $ of CHF. */
  function valuta() {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: valutaCode, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((d) => d.type === 'currency')?.value ?? valutaCode;
    } catch {
      return valutaCode;
    }
  }
  /** Een andere valuta onthouden; true als hij anders was. */
  function zetValuta(c) {
    if (typeof c !== 'string' || !/^[A-Z]{3}$/.test(c) || c === valutaCode) return false;
    valutaCode = c;
    try {
      global.localStorage?.setItem(VALUTA, c);
    } catch {
      // Dan alleen op deze pagina.
    }
    return true;
  }
  /** Een bedrag met het teken ervoor, zoals op een bon: "€ 1,25". */
  const geld = (n, d = 2) => `${valuta()} ${getal(n, d)}`;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  /** Dezelfde tekst als HTML: ontsnapt, en `**zo**` vet. Voor een zin met een vet getal erin. */
  const html = (sleutel, p = {}) => esc(t(sleutel, p)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  /** Een getal in de taal van de app, met `d` cijfers achter de komma (of de punt). */
  const getal = (n, d = 1) => Number(n).toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d });
  /** De klok: 14:05. */
  const klok = (ms) => new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  /** Een datum of tijd met de opties van Intl. */
  const datum = (d, opties) => new Date(d).toLocaleDateString(locale, opties);
  const opmaak = (opties) => new Intl.DateTimeFormat(locale, opties);

  /** Vult de vaste teksten in de HTML: `data-t`, `data-t-html` (met **vet**) en `data-t-<attribuut>`. */
  function vul(root = global.document) {
    if (!root?.querySelectorAll) return;
    for (const el of root.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
    for (const el of root.querySelectorAll('[data-t-html]')) el.innerHTML = html(el.dataset.tHtml);
    for (const el of root.querySelectorAll('*')) {
      for (const a of [...el.attributes]) {
        if (a.name.startsWith('data-t-') && a.name !== 'data-t-html') el.setAttribute(a.name.slice('data-t-'.length), t(a.value));
      }
    }
  }

  /**
   * De keuze bij Jij (`auto`, `nl` of `en`), uit de voorkeuren. Op een scherm
   * geldt geen keuze: daar telt het account. Verandert de taal daarmee, dan de
   * pagina opnieuw, zodat alles in die taal staat.
   */
  function zetKeuze(keuze, { scherm = false } = {}) {
    const nieuw = scherm || !past(keuze) ? null : past(keuze);
    try {
      if (nieuw) global.localStorage.setItem(SLEUTEL, nieuw);
      else global.localStorage.removeItem(SLEUTEL);
    } catch {
      return;
    }
    const wordt = nieuw ?? vanzelf();
    if (wordt !== code) global.location.reload();
  }

  global.taal = { code, locale, talen: KAN, t, heeft, zelfde: ZELFDE, html, getal, geld, valuta, zetValuta, klok, datum, opmaak, vul, zetKeuze };
  global.t = t;
  // Het script staat onderaan de pagina: wat erboven staat, is er al.
  vul();
})(window);
