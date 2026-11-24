/**
 * De zinnen van de dienst in het Nederlands (besluit 344), per onderwerp. Het Engels (en.ts) heeft precies dezelfde
 * onderwerpen en sleutels; de typecontrole bewaakt dat. Bij elk onderwerp staat het bestand dat hem gebruikt.
 */
import type { ActieCode } from '../web/house-types.js';
import type { Gevaar } from '../web/rookmelders.js';
import { metLidwoord } from '../web/kamerwoorden.js';
import { hoofdletter, inSentence, lijst, telling } from './hulp.js';
import type { BlockCode, ReasonCode } from '../core/decision.js';
import type { Mode } from '../core/model.js';
import type { Wish } from '../web/assistant-types.js';
import type { Wanneer } from '../web/doet.js';

export const nl = {
  // web/weather.ts
  weer: {
    zon: 'Zonnig',
    half: ['Zon en wolken', 'Zon en wolken, kans op een bui'],
    bewolkt: ['Bewolkt', 'Bewolkt, kans op regen'],
    regen: ['Bewolkt, af en toe een bui', 'Bewolkt met regen'],
    onweer: 'Kans op onweer',
    sneeuw: 'Sneeuw',
    mist: 'Mist',
  },
  // web/tarief.ts
  tarief: {
    stroom: 'Stroom van het net',
    normaal: 'Stroom normaal',
    dal: 'Stroom dal',
    terug: 'Teruggeleverd',
    terugNa: 'Teruggeleverd, zonder salderen',
    gas: 'Gas',
    vastStroom: 'Vaste kosten stroom',
    vastGas: 'Vaste kosten gas',
    vast: 'Vaste kosten',
    geenPrijs: (wat: string) => `${wat}, prijs nog niet ingesteld`,
    keer: (wat: string, prijs: string) => `${wat} × ${prijs}`,
    gesaldeerdGeenPrijs: (wat: string) => `${wat}, gesaldeerd; prijs nog niet ingesteld`,
    gesaldeerdBoven: (gesaldeerd: string, boven: string, prijs: string) => `${gesaldeerd} gesaldeerd, ${boven} boven je verbruik × ${prijs}`,
    gesaldeerd: (wat: string) => `${wat}, gesaldeerd tegen je stroomprijs`,
    geenVergoeding: (wat: string, vanaf2027: boolean) => `${wat}, vergoeding${vanaf2027 ? ' vanaf 2027' : ''} nog niet ingesteld`,
    vergoeding: (wat: string, prijs: string, kosten: string | null) => `${wat} × ${prijs} vergoeding${kosten ? `, min ${kosten} kosten` : ''}`,
    perMaand: (prijs: string) => `${prijs} per maand`,
    nietIngesteld: 'nog niet ingesteld',
    uurprijs: (wat: string) => `${wat}, met de prijs van elk uur, zoals Home Assistant telt`,
    zoalsHa: (wat: string) => `${wat}, zoals Home Assistant telt`,
    deels: (uitleg: string, open: string) => `${uitleg}; ${open} geschat tegen je gemiddelde`,
    boven: (uitleg: string, boven: string, prijs: string) => `${uitleg}; ${boven} boven je verbruik × ${prijs}`,
  },
  // web/yield.ts
  opbrengst: {
    maanden: ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
    kort: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
    dagen: ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'],
    dagErvoor: 'de dag ervoor',
    vorigeWeek: 'vorige week',
    rest: 'Rest van het huis',
  },
  // web/ligging.ts
  ligging: {
    locale: 'nl-NL',
    maanden: ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
    eenKant: (kant: string) => `Op het ${kant}en`,
    en: ' en ',
    bijnaPlat: (r: number) => `Rond ${r}°, bijna plat`,
    dak: (r: number, deg: number) => `Rond ${r}°, ${deg < 32 ? 'een flauw' : deg < 45 ? 'een gewoon' : 'een steil'} dak`,
    samen: (kwp: string) => `Samen ${kwp}`,
    zoEen: (kwp: string) => `zo'n ${kwp}`,
    perPaneel: (wp: number, zeker: boolean) => (zeker ? `${wp} Wp per paneel` : `ongeveer ${wp} Wp per paneel`),
    elkeKant: (n: number) => `${n} panelen op elke kant`,
    voorAchter: (voor: number, achter: number) => `${voor} aan de voorkant, ${achter} aan de achterkant`,
    panelen: (n: number) => `${n} panelen`,
  },
  // web/klaarzetten.ts
  klaarzetten: {
    waar: {
      algemeen: 'Instellingen › Systeem › Algemeen',
      ruimtes: 'Instellingen › Gebieden, etages en labels',
      personen: 'Instellingen › Personen',
      integraties: 'Instellingen › Apparaten en diensten',
      energie: 'Instellingen › Dashboards › Energie',
      spraak: 'Instellingen › Spraakassistenten',
      addons: 'Instellingen › Add-ons',
    },
    locatie: ['Locatie en tijdzone', 'Home Assistant weet waar het huis staat: voor de zon, het weer en de gevels.', 'Zet de locatie van je huis en de tijdzone.'],
    ruimtes: {
      titel: 'Etages en ruimtes',
      klaar: (ruimtes: number, etages: number) => `${telling(ruimtes, 'ruimte', 'ruimtes')} op ${telling(etages, 'etage', 'etages')}, elk apparaat in zijn ruimte.`,
      geen: 'Maak etages en ruimtes, en zet elk apparaat in zijn ruimte. De app neemt ze over als voorstel.',
      geenEtage: 'Zet de ruimtes op een etage; dan staat het huis goed in de tekening.',
      /*
       * Geen tekort: de app heeft een eigen indeling, en
       * daar kies je de kamer van elk apparaat. Een ruimte in Home Assistant
       * is alleen het voorstel.
       */
      klaarZonder: (ruimtes: number, etages: number, n: number) => `${telling(ruimtes, 'ruimte', 'ruimtes')} op ${telling(etages, 'etage', 'etages')}. ${telling(n, 'apparaat staat', 'apparaten staan')} in Home Assistant in geen ruimte; hun kamer kies je in de app.`,
    },
    personen: {
      titel: 'Een persoon per bewoner',
      klaar: (n: number) => `${telling(n, 'persoon', 'personen')}, elk met een eigen account.`,
      geen: 'Maak een persoon per bewoner, gekoppeld aan een account. Zonder persoon is iemand een gast.',
      geenAccount: 'Nog niemand heeft een account. Koppel er een aan een persoon, dan kan die inloggen en een eigen comfort kiezen.',
      // Geen tekort: een kind of iemand die niet inlogt, heeft geen account nodig.
      klaarZonder: (n: number, zonder: number) => `${telling(n, 'persoon', 'personen')}; ${telling(zonder, 'heeft', 'hebben')} geen account en ${zonder === 1 ? 'logt' : 'loggen'} dus niet in.`,
    },
    telefoon: {
      titel: 'Thuis of weg',
      klaar: (met: number, van: number) => `${met} van ${van} ${van === 1 ? 'persoon wordt' : 'personen worden'} gevolgd, met de app van Home Assistant.`,
      mist: 'Installeer de app van Home Assistant op elke telefoon, met locatie aan. Wie er thuis is, bepaalt het comfort.',
    },
    klimaat: { titel: 'Thermostaten en airco’s', klaar: (n: number) => `${telling(n, 'apparaat', 'apparaten')} voor verwarmen of koelen.`, mist: 'Voeg je thermostaat en airco’s toe in Home Assistant, met hun eigen koppeling.' },
    temperatuur: { titel: 'Temperatuur per kamer', klaar: (n: number) => `${telling(n, 'thermometer', 'thermometers')} in een ruimte.`, mist: 'Een thermometer per kamer, in zijn ruimte, of een thermostaat die de kamertemperatuur meldt.' },
    netmeter: ['De slimme meter', 'De meter geeft wat er van en naar het net gaat.', 'SunArc vindt geen meter voor wat er nu van en naar het net gaat. Staat je slimme meter (P1) al in Home Assistant? Kies hem dan bij Instellingen › Energie › Meters. Zo niet: voeg hem hier toe met zijn koppeling, liefst lokaal, zoals HomeWizard of DSMR.'],
    omvormer: {
      titel: 'De omvormer',
      traag: (min: number) => `Gevonden, maar hij meldt maar eens per ${min} minuten. Lokaal gaat sneller.`,
      klaar: 'De opbrengst van je panelen komt binnen.',
      mist: 'Koppel je omvormer, liefst lokaal, voor de opbrengst van nu.',
    },
    energiedashboard: ['Het Energie-dashboard', 'Ingevuld; Opbrengst neemt de meters over.', 'Vul het in; dan neemt Opbrengst je meters en prijzen over.'],
    opzon: { titel: 'Apparaten op zon', klaar: (n: number) => `${telling(n, 'apparaat kan', 'apparaten kunnen')} op zon draaien.`, mist: 'Een droger, wasmachine of vaatwasser met "op afstand starten", zoals via Home Connect, LG ThinQ, SmartThings of Miele. Of een boiler of jacuzzi die Home Assistant kan aanzetten, zoals een Intex via de koppeling Intex Spa.' },
    lampen: { titel: 'Lampen en scènes', klaar: (n: number) => `${telling(n, 'lamp', 'lampen')}.`, mist: 'Lampen in Home Assistant; met Philips Hue ook de kleuren van je scènes.' },
    schermen: { titel: 'Screens en zonneschermen', klaar: (n: number) => `${telling(n, 'scherm', 'schermen')}.`, mist: 'Screens en zonneschermen als scherm in Home Assistant.' },
    cameras: { titel: 'Camera’s en de deurbel', klaar: (n: number, deurbel: boolean) => `${telling(n, 'camera', 'camera’s')}${deurbel ? ', met een deurbel' : ''}.`, mist: 'Camera’s, en een deurbel met een melder, zoals van Reolink, Ring, Nest of UniFi.' },
    rookmelders: { titel: 'Rookmelders', klaar: (n: number) => `${telling(n, 'rookmelder', 'rookmelders')}.`, mist: 'Rookmelders die rook, koolmonoxide of hitte melden.' },
    weer: { titel: 'Een weerbron', klaar: (n: number) => `${telling(n, 'weerdienst', 'weerdiensten')}.`, mist: 'Een weerdienst zoals Buienradar; zonder werkt Open-Meteo ook.' },
    spraak: { titel: 'Een spraakassistent', klaar: (namen: string) => `${namen}, met spraak naar tekst.`, mist: 'Een spraakassistent met spraak naar tekst (Whisper of Home Assistant Cloud) en Piper voor de stem.' },
    wekwoord: {
      titel: 'Het wekwoord',
      heHuis: 'Hé huis staat bij een spraakassistent.',
      bij: (namen: string) => `Een wekwoord staat bij ${namen}.`,
      addOn: 'Herstart de openWakeWord-add-on één keer en kies he_huis bij een spraakassistent; de add-on zette het klaar.',
      mist: 'De openWakeWord-add-on, met een wekwoord bij een spraakassistent.',
    },
    taalmodel: { titel: 'Een taalmodel', klaar: (n: number) => `${telling(n, 'AI-taak', 'AI-taken')}; kies er een bij Instellingen › Assistent › Praten.`, mist: 'Een AI-taak, zoals van OpenAI, Anthropic of Ollama, als de assistent het in eigen woorden mag zeggen.' },
    beweging: { titel: 'Een bewegingsmelder', klaar: (n: number) => `${telling(n, 'melder', 'melders')}; de wand wordt wakker als er iemand langsloopt.`, mist: 'Een bewegingsmelder bij de wand, om hem te wekken.' },
    tailscale: ['SunArc op je telefoon', 'De eigen poort staat open; installeer de app bij Profiel › Op je startscherm.', 'Met de Tailscale-add-on en de eigen poort zet je SunArc als app op je telefoon.'],
  },
  // web/klaarzetten-functies.ts
  klaarFuncties: {
    nog: (n: number) => (n === 1 ? 'Nog 1 stap' : `Nog ${n} stappen`),
    kan: 'Kan erbij',
    huis: ['Het huis', 'Waar het huis staat, de kamers en wie er woont. Hier begint alles mee.', 'Ligging, kamers en bewoners'],
    klimaat: ['Klimaat', 'Wat er verwarmt en koelt, en de temperatuur in elke kamer.', 'Apparaten en thermometers'],
    energie: ['Zon en energie', 'Wat er van en naar het net gaat, en wat je panelen opleveren.', 'Netmeter, panelen en meters'],
    licht: ['Licht en schermen', 'Lampen, scènes en screens bedienen vanuit de app.', 'Lampen en screens'],
    witgoed: ['Witgoed op zon', 'De droger, wasmachine of vaatwasser starten als de zon schijnt.', 'Op afstand starten'],
    weer: ['Het weer', 'Regen en wind voor de screens, en de zon van morgen.', 'Een weerdienst'],
    assistent: ['De assistent in huis', 'Praten met je huis zonder dat er iets naar buiten gaat: verstaan, antwoorden en het wekwoord "Hé huis", allemaal op je eigen Home Assistant.', 'Verstaan, stem en wekwoord'],
    wand: ['De wand', 'Het scherm gaat uit als er niemand is, en wakker als er iemand langsloopt. Dat kan met Fully Kiosk Browser op de tablet; de wand vertelt SunArc zelf hoe hij staat.', 'Fully Kiosk en scherm uit'],
    taalmodel: ['Een taalmodel', 'De assistent zegt het in eigen woorden, met een taalmodel als AI-taak in Home Assistant.', 'Een AI-taak'],
    cloud: ['De assistent via de cloud', 'Beter verstaan en een rijkere stem, maar wat je zegt gaat dan naar een dienst buiten je huis. Kies er één.', 'Kies een route'],
    tel: ['Losse app op je telefoon', 'Zonder de Home Assistant-app: SunArc op je beginscherm, ook onderweg. Dat gaat veilig via Tailscale, je eigen netwerk; niets staat open naar internet.', 'Via Tailscale'],
    geenWand: 'Hangt er een tablet aan de muur? Open SunArc daar; dan staat hier wat erbij hoort.',
    s: {
      whisper: ['Whisper verstaat wat je zegt', 'De add-on draait.', 'Installeer de add-on Whisper in Home Assistant.'],
      model: {
        titel: 'Whisper op small-int8',
        klaar: (m: string) => `Staat op ${m}.`,
        open: (m: string) => `Staat op ${m}: snel, maar het verstaat "screen" en "zolder" slecht. Kies small-int8 bij de instellingen van Whisper.`,
        onbekend: 'Kies small-int8 bij de instellingen van Whisper: dat verstaat huiswoorden als "screen" en "zolder" beter.',
      },
      piper: ['Piper geeft de stem', 'De add-on draait.', 'Installeer de add-on Piper in Home Assistant.'],
      owv: {
        titel: 'openWakeWord hoort "Hé huis"',
        klaar: 'Het wekwoord staat bij de spraakassistent.',
        add: 'Installeer de add-on openWakeWord; SunArc zet "Hé huis" erbij, in het Engels "Hey house".',
        kies: 'Herstart openWakeWord één keer en kies he_huis bij de spraakassistent.',
      },
      gevonden: 'Home Assistant vond hem; de spraakassistent bevestigt hem.',
      maak: ['De spraakassistent van SunArc', 'Verstaan, stem en wekwoord samen.', 'Verstaan, stem en wekwoord samen, met één tik.', 'Eerst Whisper en Piper.'],
      fully: { titel: 'Fully Kiosk Browser', nogNiet: 'Nog niet gemeld. Draait de wand in Fully, dan meldt hij zich zodra SunArc daar een pagina opent.', klaar: (tijd: string) => `De wand draait in Fully (gezien om ${tijd}).`, open: 'Installeer Fully Kiosk Browser op de tablet en open SunArc daarin. De wand meldt zich dan zelf.', anders: (tijd: string) => `De wand draait in een gewone browser (gezien om ${tijd}). Met Fully kan het scherm uit en aan.` },
      js: ['De koppeling met de pagina', 'JavaScript Interface staat aan: SunArc kan het scherm uit en aan zetten.', 'In Fully: Instellingen › Advanced Web Settings › Enable JavaScript Interface.'],
      camera: { titel: 'Wakker op beweging', fully: 'De camera van de tablet kijkt mee.', melder: 'Een bewegingsmelder in huis wekt de wand.', open: 'In Fully: Instellingen › Motion Detection › Enable Visual Motion Detection (vraagt Fully Plus). Of kies een bewegingsmelder bij Functies › Scherm.' },
      uit: ['Scherm uit als niemand kijkt', 'Staat aan bij Profiel › Scherm uit.', 'Zet het aan bij Profiel › Scherm uit: \'s nachts, of als niemand thuis is.'],
      wolk: { titel: 'Een dienst in Home Assistant', klaar: (namen: string) => `${namen} staat erin.`, open: 'Voeg een van de drie routes hierboven toe in Home Assistant.' },
      naarWolk: ['De spraakassistent naar de cloud', 'Een spraakassistent verstaat via de cloud; het wekwoord blijft in huis.', 'Kies bij een spraakassistent in Home Assistant de dienst voor spraak naar tekst.'],
      ts: { titel: 'De Tailscale-add-on', klaar: 'De add-on draait.', open: 'Installeer de add-on Tailscale en log één keer in.', onbekend: 'Installeer de add-on Tailscale en log één keer in; SunArc kan niet zien of hij draait.' },
      poort: ['Een eigen poort voor SunArc', 'Staat open, alleen bereikbaar via Tailscale.', 'Zet bij de instellingen van de add-on SunArc een poort, zoals 8100.'],
      opTel: ['Op je telefoon', 'Tailscale op je telefoon, dan SunArc in Chrome openen en Toevoegen aan beginscherm.'],
    },
    wolk: { cloud: 'Home Assistant Cloud', google: 'Google Cloud', openai: 'OpenAI' },
  },
  // web/house.ts
  huis: {
    geenVerbinding: 'geen verbinding',
    onbereikbaar: 'onbereikbaar',
    onbekend: 'onbekend',
    aan: 'aan',
    aanPct: (pct: number) => `aan · ${pct}%`,
    uit: 'uit',
    scherm: {
      zonderTerugmelding: 'zonder terugmelding',
      gaatOpen: 'gaat open',
      gaatDicht: 'gaat dicht',
      vouwtUit: 'vouwt uit',
      klaptIn: 'klapt in',
      open: 'open',
      dicht: 'dicht',
      uitgevouwen: 'uitgevouwen',
      ingeklapt: 'ingeklapt',
      pctUitgevouwen: (pct: number) => `${pct}% uitgevouwen`,
      pctDicht: (pct: number) => `${pct}% dicht`,
      naOpdracht: (wat: string) => `${wat}, volgens de laatste opdracht`,
      deelsDicht: 'deels dicht',
    },
    modus: { cool: 'koelen', heat: 'verwarmen', heat_cool: 'automatisch', auto: 'automatisch', dry: 'drogen', fan_only: 'ventileren' } as Readonly<Record<string, string>>,
    naar: (wat: string, graden: string) => `${wat} naar ${graden}°`,
    actie: { verwarmt: 'verwarmt', 'verwarmt-voor': 'verwarmt voor', koelt: 'koelt', droogt: 'droogt', ventileert: 'ventileert', stil: 'staat stil', uit: 'uit' } satisfies Record<ActieCode, string>,
    staatKlaar: 'staat klaar',
    doel: (graden: string) => `doel ${graden}°`,
    apparaat: { running: 'draait', would_start: 'zou nu starten', waiting: 'klaargezet', not_ready: 'uit' } as Readonly<Record<string, string>>,
    // Een boiler of jacuzzi (besluit 186).
    buffer: { stookt: 'verwarmt', would_heat: 'zou nu verwarmen', waiting: 'wacht op zon', full: 'warm', unknown: 'niet te lezen' } as Readonly<Record<string, string>>,
    stekker: { stookt: 'aan', would_heat: 'zou nu aangaan', waiting: 'wacht op zon', full: 'aan, vraagt niets', unknown: 'niet te lezen' } as Readonly<Record<string, string>>,
    // Nog geen melding van het apparaat: dat is iets anders dan kapot (besluit 131).
    meldtNogNiets: 'meldt nog niets',
    live: 'live te bekijken',
    nietBereikbaar: 'niet bereikbaar',
    gezien: { rook: 'rook gezien', co: 'koolmonoxide gezien', hitte: 'hitte gezien' } satisfies Record<Gevaar, string>,
    batterijVervangen: 'batterij vervangen',
    allesGoed: 'alles goed',
    geenMeting: 'geen meting',
    draaitNiets: 'Er draait niets',
    nDraaien: (n: number) => `${n} apparaten draaien`,
    doetMee: (kamer: string) => `Doet mee met de regeling van ${kamer}.`,
  },
  // web/meldingen.ts
  meldingen: {
    minuten: (n: number) => `${n} minuten`,
    uren: (n: number) => `${n} uur`,
    dagen: (n: number) => `${n} dagen`,
    bekijk: 'Bekijk',
    nieuw: { titel: (naam: string) => `Nieuw in Home Assistant: ${naam}`, tekst: 'Zet het in een kamer, dan staat het in het huis en kun je het bedienen.', actie: 'Zet in een kamer' },
    weg: {
      titel: (naam: string) => `Weg uit Home Assistant: ${naam}`,
      inKamer: (kamer: string) => `Het stond in ${kamer}. Haalde je het zelf weg, dan kun je deze melding weghalen; komt het terug, dan staat het er weer.`,
      los: 'Haalde je het zelf weg, dan kun je deze melding weghalen; komt het terug, dan staat het er weer.',
      actie: 'Bekijk de indeling',
    },
    stil: {
      titel: (naam: string) => `${naam} reageert niet meer`,
      tekst: (duur: string, kamer: string) => `Al ${duur} geen bericht, in ${kamer}. Staat de stekker erin, of is de verbinding weg?`,
      klaar: (naam: string) => `${naam} weer goed`,
      klaarTekst: (duur: string) => `Na ${duur} zonder verbinding.`,
    },
    batterij: {
      titel: (naam: string) => `Batterij bijna leeg: ${naam}`,
      tekst: (pct: number) => `Nog ${pct}%. Een nieuwe batterij en het doet het weer maanden.`,
      klaar: (naam: string) => `Nieuwe batterij in ${naam}`,
      klaarTekst: (pct: number | null) => `Weer boven de ${pct}%.`,
    },
    filter: {
      titel: (naam: string) => `Filter bijna vol: ${naam}`,
      tekst: (pct: number) => `Nog ${pct}%. Een schoon filter koelt en verwarmt zuiniger.`,
      klaar: (naam: string) => `Filter schoon: ${naam}`,
      klaarTekst: 'Het filter is weer goed.',
    },
    gevaar: { rook: 'rook', co: 'koolmonoxide', hitte: 'hitte' },
    rook: {
      titel: (wat: string, kamer: string) => `${hoofdletter(wat)} in ${kamer}`,
      tekst: (wat: string, om: string) => `De rookmelder ziet ${wat} sinds ${om}. Ga bij brand naar buiten en bel 112.`,
      klaar: (wat: string, kamer: string) => `Geen ${wat} meer in ${kamer}`,
      klaarTekst: (wat: string, om: string) => `Om ${om} zag de rookmelder ${wat}.`,
    },
    rookBatterij: {
      titel: (naam: string) => `Batterij op: ${naam}`,
      tekst: 'De rookmelder zegt dat zijn batterij vervangen moet. Zonder batterij waarschuwt hij niet.',
      klaar: (naam: string) => `Nieuwe batterij in ${naam}`,
      klaarTekst: 'De rookmelder is weer goed.',
    },
    vervangen: {
      titel: (naam: string) => `${naam} vervangen`,
      tekst: (datum: string) => `Een rookmelder gaat tien jaar mee. Deze moet vervangen worden voor ${datum}.`,
      klaarTekst: 'Er hangt een nieuwe melder.',
    },
    update: {
      titel: (nieuw: string) => `Versie ${nieuw} staat klaar`,
      tekst: (nu: string) => `Je hebt ${nu}. Tik om te zien wat er nieuw is, en om bij te werken.`,
      klaar: (nieuw: string) => `Bijgewerkt naar ${nieuw}`,
      klaarTekst: 'De nieuwe versie draait.',
    },
    meter: {
      titel: (naam: string) => `${naam} levert niets meer`,
      sinds: (om: string) => `Sinds ${om} geen meting.`,
      geen: 'Geen meting.',
      waarom: 'Zonder deze meter kloppen de cijfers en de zon niet.',
      klaar: (naam: string) => `${naam} levert weer`,
      klaarTekst: 'De metingen komen weer binnen.',
    },
    dak: {
      titel: (letter: string | null) => (letter ? `Dakvlak ${letter} levert minder` : 'Je dak levert minder'),
      wanneer: { ochtend: "'s ochtends", middag: "'s middags", avond: "'s avonds", dag: 'de hele dag' },
      tekst: (pct: number, wanneer: string, zeker: boolean) => `Op zonnige dagen ${wanneer} ${pct}% minder dan bij heldere lucht${zeker ? '' : ', waarschijnlijk door schaduw'}. Kijk of er iets voor staat.`,
      klaar: 'Je daken leveren weer zoals verwacht',
      klaarTekst: 'Op de zonnige dagen klopt het weer.',
    },
    panelen: {
      titel: 'Je panelen zijn gemeten',
      tekst: 'Uit een heldere dag volgt hoe ze liggen. Kijk of de richting, de helling en het vermogen kloppen.',
      klaar: 'Je panelen staan erin',
      klaarTekst: 'Zon, het weer en de verwachting rekenen ermee.',
    },
    // Sluipverbruik (besluit 192, besluit 88): het wat en het hoeveel, geen apparaat.
    sluip: {
      titel: (boven: number) => `Vannacht ${boven} W meer dan gewoon`,
      reeks: (n: number) => `Al ${n} nachten meer dan gewoon`,
      tekst: (w: number, gewoon: number) => `${w} W tegen je gewone ${gewoon} W. Staat er iets aan?`,
      klaar: 'Sluipverbruik weer gewoon',
      klaarTekst: 'De nacht lag weer rond je gewone nacht.',
    },
    versie: { titel: (nummer: string) => `Versie ${nummer}: wat is er nieuw`, tekst: 'Kijk wat er beter is.', actie: 'Lees' },
    mijlpaal: {
      titel: (n: number) => `${n} winterdagen meegekeken`,
      nog: (n: number) => `Nog ${n} te gaan, dan weet het huis genoeg om zelf te regelen.`,
      genoeg: 'Genoeg om zelf te regelen. Wanneer dat begint, kies jij.',
    },
    comfort: {
      gekozen: 'Gekozen op een scherm, tot er iemand thuiskomt of weggaat.',
      niemand: 'Er is niemand thuis.',
      thuis: (naam: string) => `${naam} is thuis.`,
      wissel: (hoofd: string, naam: string) => `${hoofd} is weg; ${naam} is thuis.`,
      weer: (naam: string) => `Het comfort van ${naam} geldt weer`,
      nu: (naam: string) => `Het comfort van ${naam} geldt nu`,
      actie: 'Bewoners',
    },
    auto: {
      vol: (naam: string) => `${naam} is vol`,
      volTekst: (pct: number, grens: boolean) => `Op ${pct}%${grens ? ', de laadgrens' : ''}. De kabel mag eruit.`,
      volKlaar: (naam: string) => `${naam}: kabel eruit`,
      volKlaarTekst: (pct: number) => `Vol geladen tot ${pct}%.`,
      fout: (naam: string) => `Laden gestopt: ${naam}`,
      foutTekst: (stand: string) => `De laadpaal meldt een fout (${stand}). Kijk in de app van de laadpaal.`,
      foutKlaar: (naam: string) => `${naam}: laadpaal weer goed`,
      foutKlaarTekst: 'De fout is weg.',
      kabel: (naam: string) => `${naam} hangt niet aan de kabel`,
      kabelTekst: (pct: number, onder: number) => `Hij staat op ${pct}%, onder de ${onder}% die je koos. Doe je de kabel erin?`,
      kabelKlaar: (naam: string) => `Kabel vergeten: ${naam}`,
      kabelKlaarTekst: 'Niet meer nodig.',
      hand: (naam: string) => `${naam}: met de hand klaar`,
      handPct: (pct: number) => `Op ${pct}%. De laadpaal kiest weer zelf.`,
      handTijd: (tijd: string) => `Om ${tijd}. De laadpaal kiest weer zelf.`,
    },
    accu: {
      stil: (naam: string) => `${naam} zegt niets meer`,
      stilTekst: 'Home Assistant krijgt al een half uur geen lading of vermogen van de accu. Kijk of hij aan staat en verbinding heeft.',
      stilKlaar: (naam: string) => `${naam} zegt weer iets`,
      stilKlaarTekst: 'De lading komt weer binnen.',
      fout: (naam: string) => `Fout bij ${naam}`,
      foutTekst: (stand: string) => `De accu meldt een fout (${stand}). Kijk in de app van de accu.`,
      foutKlaar: (naam: string) => `${naam}: weer goed`,
      foutKlaarTekst: 'De fout is weg.',
      vol: (naam: string) => `${naam} is vol`,
      volTekst: 'De zon gaat nu naar het net. Een goed moment voor de wasmachine of de vaatwasser.',
      volKlaar: (naam: string) => `${naam} was vol`,
      volKlaarTekst: 'Vandaag vol geweest, met zon over.',
    },
    stekker: {
      titel: (naam: string) => `Stekker gevonden: ${naam}`,
      tekst: 'Zet hem op zon, dan kijkt SunArc mee wanneer hij aan kan.',
      actie: 'Op zon zetten',
      meter: (naam: string) => `Meter van ${naam} toevoegen`,
      meterTekst: 'Hij meet zijn eigen verbruik. Voeg de meter toe, dan zie je wat hij gebruikt en hoeveel op eigen zon.',
      meterActie: 'Toevoegen',
      meterKlaar: (naam: string) => `Meter van ${naam} staat erbij`,
      meterKlaarTekst: 'Je ziet hem bij Opbrengst.',
    },
    om: (tijd: string) => `Om ${tijd}.`,
    inKamer: (kamer: string) => metLidwoord(kamer),
  },
  // web/buffers-bewoner.ts
  buffers: {
    kop: {
      zon: 'Zou nu verwarmen op zon',
      onder: 'Zou nu verwarmen',
      klaarOm: 'Zou nu beginnen voor klaar om',
      goedkoop: 'Zou nu beginnen, goedkope uren',
      legionella: 'Zou nu naar 60° gaan',
      wachtZon: 'Wacht op zon',
      wacht: 'Wacht even',
      warm: 'Warm genoeg',
      vol: 'Vol',
      onbekend: 'Niet te lezen',
    },
    zon: (doel: number | null) => (doel != null ? `Er is zon over: hij zou nu verwarmen naar ${doel}°.` : 'Er is zon over: hij zou nu aangaan tot hij vol is.'),
    onder: (min: number) => `Onder ${min}°: hij zou nu verwarmen, ook zonder zon.`,
    klaarOm: (by: string, doel: number) => `Anders is hij om ${by} niet op ${doel}°. Daarom zou hij nu beginnen, ook zonder zon.`,
    goedkoop: (by: string | null, doel: number | null) =>
      by && doel != null ? `Nu zijn de goedkoopste uren, en om ${by} is hij dan op ${doel}°.` : 'Nu zijn de goedkoopste uren: hij zou nu een keer vol gaan.',
    legionella: (c: number) => `Eens per week naar ${c}° tegen legionella. Er was deze week geen zon voor, dus nu in de goedkoopste uren.`,
    wachtZon: (zon: number | null, min: number, latest: string | null, by: string | null) =>
      latest && by
        ? `Hij verwarmt zodra er zon over is. Komt die niet, dan begint hij om ${latest}, op tijd voor ${by}.`
        : zon != null
          ? `Hij verwarmt zodra er zon over is, tot ${zon}°. Minstens ${min}° houdt hij altijd vast.`
          : 'Hij gaat aan zodra er zon over is, tot hij vol is.',
    stabilisatie: 'Er startte net iets anders. Over een paar minuten kijkt het huis opnieuw.',
    failsafe: 'Een meter is even niet te lezen; de regeling wacht.',
    handmatig: 'De regeling staat op handmatig.',
    zekering: 'De hoofdzekering kan er nu niet nog een bij hebben.',
    warm: (t: number, min: number) => `${t}°: warm genoeg. Minstens ${min}° houdt hij vast.`,
    vol: (t: number | null) => (t != null ? `${t}°: vol tot de zon weer schijnt.` : 'Vol: hij trekt niets meer.'),
    onbekend: 'Home Assistant geeft nu geen temperatuur door.',
    vanavond: 'Vanavond',
    morgen: 'Morgen',
    locale: 'nl-NL',
  },
  // web/aansluiting.ts
  aansluiting: {
    kwh: 'Een kWh-meter op de groep van de panelen, naast de P1-meter: zelf te doen of door een installateur.',
    solaredge: 'Zet Modbus TCP aan in SetApp en gebruik de integratie SolarEdge Modbus Multi. Geavanceerd, soms via de installateur.',
    growatt: 'RS485 naar het netwerk (bijvoorbeeld een Elfin EW11) of een USB-stick aan Home Assistant. Geavanceerd.',
  },
  // web/assistant-kort.ts
  kort: {
    failsafe: 'Storing: veilig gezet',
    taken: 'Jij hebt het overgenomen',
    takenUntil: (t: string) => `Jij hebt het tot ${t}`,
    run: { cool: 'Koelt', heat: 'Verwarmt' },
    // Tijdens de schaduw doet het apparaat het niet echt: "zou" (besluit 124).
    wouldRun: { cool: 'Zou koelen', heat: 'Zou verwarmen' },
    onSun: ' op zon',
    parked: 'Staat klaar om verder te gaan',
    noMeasurement: 'Geen meting',
    waitSun: 'Wacht op meer zon',
    // De zon is nog niet op, of komt vandaag niet meer.
    waitSunOp: 'Op zon zodra hij op is',
    waitSunMorgen: 'Morgen weer op zon',
    wait: (why: string) => `Wacht: ${why}`,
    ok: 'Op temperatuur',
    idle: 'Niets te doen',
    idleWhy: (why: string) => `Niets te doen: ${why}`,
    off: 'uit',
    block: {
      min_run_not_elapsed: 'draait nog even door',
      min_rest_not_elapsed: 'pauzeert even na het uitgaan',
      stabilisation_active: 'wacht tot het verbruik stabiel is',
      settling_after_switch: 'is net van stand gewisseld',
      insufficient_power_budget: 'te weinig zon over',
      start_threshold_not_met: 'net te weinig zon om te starten',
      capability_missing: 'het apparaat kan dit niet',
      setpoint_out_of_range: 'doel buiten bereik van het apparaat',
      superseded_by_higher_priority: 'een andere kamer ging voor',
      no_change_needed: 'niets te veranderen',
      resident_override: 'jij hebt het overgenomen',
      insufficient_current_budget: 'de hoofdzekering zou te zwaar belast worden',
    } satisfies Record<BlockCode, string>,
    reason: {
      zone_below_setpoint: 'onder het doel',
      zone_above_setpoint: 'boven het doel',
      zone_satisfied: 'op temperatuur',
      buffering_free_energy: 'zon over, dus alvast op voorraad',
      surplus_available: 'er is zon over',
      surplus_insufficient: 'te weinig zon over',
      importing_from_grid: 'het huis haalt stroom van het net',
      outside_active_hours: 'buiten de actieve uren',
      mode_excludes_action: 'past niet bij deze modus',
      nobody_home: 'niemand thuis',
      failsafe_unreliable_input: 'een meting is onbetrouwbaar',
    } satisfies Record<ReasonCode, string>,
    // Ook de standen die een thermostaat in Home Assistant zelf kent (0.190.1): anders stond er "heat_cool naar 18°".
    action: { cool: 'koelen', heat: 'verwarmen', standby: 'geparkeerd', off: 'uit', heat_cool: 'verwarmen of koelen', auto: 'automatisch', dry: 'drogen', fan_only: 'ventileren' } as Record<string, string>,
    towards: 'naar',
  },
  // web/assistant.ts
  assistent: {
    mode: {
      dag: 'de dagstand',
      nacht: 'de nachtstand',
      voorverwarmen: 'voorverwarmen',
      afwezig: 'afwezig',
      vakantie: 'vakantie',
      handmatig: 'handmatig',
    } satisfies Record<Mode, string>,
    wish: { koelen: 'koelen', verwarmen: 'verwarmen', drogen: 'drogen', uit: 'uit', aan: 'aan' } satisfies Record<Wish, string>,
    doing: { cool: 'koelt', heat: 'verwarmt' },
    infinitive: { cool: 'koelen', heat: 'verwarmen' },
    // Een kamer met alleen hulpapparaten (role assist): die verwarmen of koelen alleen op zon.
    alleenZon: { cool: 'hier alleen met zon over gekoeld wordt', heat: 'hier alleen met zon over verwarmd wordt' },
    observed: {
      cool: 'koelen',
      heat: 'verwarmen',
      off: 'uit',
      heat_cool: 'automatisch',
      auto: 'automatisch',
      dry: 'drogen',
      fan_only: 'ventileren',
    } as Record<string, string>,
    reason: {
      zone_below_setpoint: 'het er kouder is dan het doel',
      zone_above_setpoint: 'het er warmer is dan het doel',
      zone_satisfied: 'de kamer op temperatuur is',
      buffering_free_energy: 'er gratis zonnestroom is om op te slaan',
      surplus_available: 'er zon over is',
      surplus_insufficient: 'er te weinig zon over is',
      importing_from_grid: 'het huis stroom van het net haalt',
      outside_active_hours: 'het buiten de actieve uren is',
      mode_excludes_action: 'dat niet past bij de stand van nu',
      nobody_home: 'er niemand thuis is',
      failsafe_unreliable_input: 'een meting niet betrouwbaar is',
    } satisfies Record<ReasonCode, string>,
    // Bijzinnen: ze staan na "omdat", dus het werkwoord achteraan.
    block: {
      min_run_not_elapsed: 'het apparaat eerst een minimale tijd moet blijven draaien',
      min_rest_not_elapsed: 'het apparaat na het uitgaan eerst even moet pauzeren, dat spaart de compressor',
      stabilisation_active: 'het verbruik eerst even stabiel moet zijn',
      settling_after_switch: 'het apparaat net van stand is gewisseld',
      insufficient_power_budget: 'er te weinig zon over is',
      start_threshold_not_met: 'er net te weinig zon over is om te starten',
      capability_missing: 'het apparaat dat niet kan',
      setpoint_out_of_range: 'het doel buiten het bereik van het apparaat valt',
      superseded_by_higher_priority: 'een andere kamer voorgaat',
      no_change_needed: 'er niets te veranderen is',
      resident_override: 'jij het zelf hebt overgenomen',
      insufficient_current_budget: 'de stroom op de hoofdzekering dan te hoog zou worden',
    } satisfies Record<BlockCode, string>,
  },
  // web/doet.ts
  doet: {
    doen: { heat: 'verwarmen', cool: 'koelen' },
    doet: { heat: 'verwarmt', cool: 'koelt' },
    wanneer: { pauze: 'na een pauze', zon: 'zodra er zon over is', nog: 'als de zon op is', morgen: 'morgen op zon', zo: 'over een paar minuten', beurt: 'na een andere kamer', zekering: 'zodra de zekering ruimte heeft' },
    // De zin van de strook.
    zouNu: (kamer: string, doen: string) => `Zou nu ${kamer} ${doen}`,
    zouNiet: (kamer: string, doen: string) => `Zou ${kamer} nu niet ${doen}`,
    zouVeel: (n: number) => `Zou het in ${n} kamers anders doen`,
    zouStraks: (kamers: string, doen: string, wanneer: Wanneer, hoe: string) => (wanneer === 'morgen' ? `Zou ${kamers} ${hoe} ${doen}` : `Zou ${kamers} ${doen} ${hoe}`),
    zelfde: 'Zou nu hetzelfde doen',
    storing: 'Staat stil door een storing',
    nKamers: (n: number) => `${n} kamers`,
    en: ' en ',
    // Nu in huis, per apparaat een zinnetje.
    bezig: (naam: string, doet: string, doel: string | null) => `${naam} ${doet}${doel != null ? ` naar ${doel}°` : ''}`,
    stil: (naam: string, doel: string | null) => (doel != null ? `${naam} staat op ${doel}° en staat stil` : `${naam} staat aan en staat stil`),
    uit: (naam: string) => `${naam} staat uit`,
    allesUit: 'Alles staat uit',
    // Onder de kop "SunArc zou".
    hetzelfde: 'Hetzelfde doen',
    naar: (doen: string, doel: string | null, met: string | null) => hoofdletter(`${doen}${doel != null ? ` naar ${doel}°` : ''}${met ? ` met ${met}` : ''}`),
    wachten: (doen: string, wanneer: Wanneer, hoe: string) => (wanneer === 'morgen' ? `Wachten, en ${hoe} ${doen}` : `Wachten, en ${doen} ${hoe}`),
    genoeg: { heat: 'Niets doen, het is er warm genoeg', cool: 'Niets doen, het is er koel genoeg' },
    niets: 'Niets doen',
    hand: 'Niets, je bedient het met de hand',
    geenMeting: 'Niets, er is geen meting',
  },
  // web/klopt.ts
  klopt: {
    bekijk: 'Bekijk',
    zekering: {
      titel: 'De zekering telt nog niet mee',
      tekst: (fasen: number, ampere: number, meters: number) =>
        `Je koos ${fasen} × ${ampere} A, maar er ${meters === 0 ? 'is geen stroommeter' : meters === 1 ? 'is één stroommeter' : `zijn ${meters} stroommeters`} per fase gevonden. Zonder die meters bewaakt SunArc de zekering niet.`,
      actie: 'Kies de meters',
      klaar: ['De zekering telt weer mee', 'De stroommeters per fase zijn er.'],
    },
    vermogen: {
      titel: (naam: string) => `${hoofdletter(naam)} helpt nog niet op zon`,
      tekst: 'Je koos helpt op zon, maar daarvoor is zijn vermogen nodig. Tot dan doet hij niet mee.',
      actie: 'Vul het vermogen in',
      klaar: (naam: string) => [`${hoofdletter(naam)} helpt op zon`, 'Het vermogen is ingevuld.'],
    },
    geenKlimaat: {
      titel: (naam: string) => `${hoofdletter(naam)} kan geen kamer regelen`,
      tekst: (kamer: string) => `Het staat bij ${kamer} als verwarming of koeling, maar het is geen klimaatapparaat.`,
      actie: 'Kies iets anders',
    },
    kanNiet: {
      titel: (naam: string) => `${hoofdletter(naam)} doet nog niet mee`,
      tekst: 'Home Assistant zegt niet of het kan verwarmen of koelen. Is het apparaat bereikbaar?',
    },
    alleenHelpt: {
      titel: (kamer: string) => `Niets houdt ${kamer} op temperatuur`,
      tekst: 'Wat er hangt, helpt alleen als er zon over is. Zonder zon wordt de kamer niet verwarmd of gekoeld.',
      // Er hangt een radiator of vloer die een thermostaat in een andere kamer volgt.
      titelMee: (kamer: string, met: string) => `${hoofdletter(kamer)} verwarmt mee met ${met}`,
      tekstMee: 'SunArc kan deze kamer niet apart verwarmen. Wat er verder hangt, helpt alleen als er zon over is.',
      actie: 'Kies wat regelt',
    },
    terug: {
      titel: (naam: string) => `${hoofdletter(naam)} staat nog met de hand`,
      tekst: 'Met de hand was voorbij, maar terugzetten lukte niet. Zet het apparaat zelf terug.',
    },
    opZon: {
      titel: (naam: string) => `${hoofdletter(naam)} ging niet aan op zon`,
      tekst: 'Er was zon over, maar Home Assistant nam het aanzetten niet aan. SunArc probeert het opnieuw.',
    },
    gepland: { titel: 'Een geplande taak is niet gedaan', tekst: (wat: string) => `“${wat}” lukte niet.` },
    weer: {
      titel: 'Geen weersverwachting',
      tekst: (uren: number) => `De weerbron geeft al ${uren} uur geen verwachting. De zon van morgen en het laadadvies kloppen dan minder goed.`,
      actie: 'Kies een weerbron',
      klaar: ['De weersverwachting is er weer', 'De weerbron geeft weer een verwachting.'],
    },
  },
  // web/onboarding.ts
  onboarding: {
    geenVoorstel: 'Er is nog geen voorstel opgehaald om te bewaren.',
    alEen: 'Er staat al een configuratie; er is niets geschreven.',
    staatIn: (f: string, map: string) => `${f} staat in ${map}`,
    opnieuw: [
      'Wil je opnieuw beginnen, verplaats of hernoem dat bestand dan eerst.',
      'Twee configuraties naast elkaar maakt niet duidelijk welke geldt, en',
      'dan start de dienst niet meer.',
    ],
    nietBruikbaar: 'De configuratie is zo niet bruikbaar.',
    bestaatAl: (pad: string) => `${pad} bestaat al; er is niets geschreven.`,
    verplaats: 'Verplaats of hernoem dat bestand eerst.',
  },
  // web/resident.ts
  modus: { dag: 'Dag', nacht: 'Nacht', voorverwarmen: 'Voorverwarmen', afwezig: 'Afwezig', vakantie: 'Vakantie', handmatig: 'Handmatig' },
  // web/resident.ts
  kop: {
    now: 'Nu',
    chosen: ' (gekozen)',
    fault: ['Er is een storing', 'Een meting is onbetrouwbaar; SunArc zet de hulpapparaten veilig uit.'],
    one: (room: string, cool: boolean) => `${hoofdletter(room)} wordt ${cool ? 'gekoeld' : 'verwarmd'}`,
    many: 'Het huis wordt geregeld',
    // Tijdens de schaduw gebeurt het niet echt (besluit 124).
    oneWould: (room: string, cool: boolean) => `${hoofdletter(room)} zou ${cool ? 'koelen' : 'verwarmen'}`,
    // "Het huis zou regelen" las krom voor wie net begint; de kamers eronder zeggen wat het zou doen.
    manyWould: 'Het huis kijkt mee',
    // De schaduw wil wat er al echt gebeurt (besluit 188): zoals het in huis is.
    manyReal: (rooms: string, cool: boolean) => `${hoofdletter(rooms)} worden ${cool ? 'gekoeld' : 'verwarmd'}`,
    // Onder de kop over één kamer de getallen, niet nog eens de kop.
    numbers: (temp: string, goal: string | null) => `Het is er ${temp}°${goal != null ? `, het doel is ${goal}°` : ''}.`,
    ownSun: ' Dat kan op eigen zon.',
    waitSun: 'Het huis wacht op zon',
    // Koelen of verwarmen naar wat de kamers willen; eerst stond er altijd koelen.
    waitSunWhy: (rooms: string, many: boolean, doen: string) => `${hoofdletter(rooms)} ${many ? 'willen' : 'wil'} ${doen} zodra er genoeg zon over is.`,
    // De zon is nog niet op, of komt vandaag niet meer genoeg.
    waitSunNog: 'Nog geen zon',
    waitSunNogWhy: (rooms: string, many: boolean, doen: string) => `${hoofdletter(rooms)} ${many ? 'willen' : 'wil'} op zon ${doen} zodra de zon op is.`,
    waitSunWeg: 'Vandaag geen zon meer',
    waitSunWegWhy: (rooms: string, many: boolean, doen: string) => `${hoofdletter(rooms)} ${many ? 'kunnen' : 'kan'} morgen weer op zon ${doen}.`,
    doen: { heat: 'verwarmen', cool: 'koelen', beide: 'verwarmen of koelen' },
    waitOther: 'Er wacht iets',
    nothing: 'Er draait niets',
    // Een droger of wasmachine draait, en het klimaat is rustig (besluit 166).
    running: (names: string, many: boolean) => `${hoofdletter(names)} ${many ? 'draaien' : 'draait'}`,
    done: (names: string, many: boolean) => `${hoofdletter(names)} ${many ? 'zijn' : 'is'} klaar`,
    nothingSun: 'Geen kamer heeft iets nodig.',
    nothingDark: 'Geen zon, en geen kamer heeft iets nodig.',
    // Zonder slimme regeling (besluit 194): geen kamers om naar te kijken.
    nothingSunNoRooms: 'De zon schijnt, en er hoeft niets te draaien.',
    nothingDarkNoRooms: 'Geen zon, en er hoeft niets te draaien.',
    // De namen hebben hun lidwoord al (withArticle): eerst stond er "de de zolder".
    and: ' en ',
    comma: ', ',
    towards: 'naar',
    would: (what: string, why: string) => `zou ${what}, maar ${why}`,
    quiet: (names: string) => `${names}: niets te doen`,
    goal: (c: string) => `doel ${c}°`,
    stabilise: (min: number) => `Stabiliseren, ${min} minuten`,
    timer: (id: string) => `Timer ${id}`,
    deferrable: {
      surplus_available: () => 'zou nu starten: er is genoeg zon over',
      latest_start_reached: (t: string) => `zou nu starten: het is na ${t}`,
      ready_by_reached: () => 'zou nu starten: anders is hij niet op tijd klaar',
      surplus_insufficient: (t: string) => `wacht op zon, uiterlijk tot ${t}`,
      stabilisation_active: () => 'wacht een ronde: er is net iets gestart',
      insufficient_current_budget: () => 'wacht: de hoofdzekering zou te zwaar belast worden',
      failsafe_unreliable_input: () => 'wacht: een meting is onbetrouwbaar',
      mode_excludes_action: () => 'wacht: je regelt het huis nu zelf',
      program_running: () => 'draait een programma',
    } as Record<string, (t: string) => string>,
  },
  // web/resident.ts
  sfeer: {
    koud: { nacht: ['Koele nacht'], ochtend: ['Frisse ochtend', 'Koude start van de dag'], middag: ['Frisse middag', 'Het mag wat warmer'], avond: ['Koele avond', 'Het mag wat warmer'] },
    warm: { nacht: ['Warme nacht'], ochtend: ['Warme ochtend'], middag: ['Warme middag', 'Het mag wat koeler'], avond: ['Warme avond', 'Het mag wat koeler'] },
    rustig: { nacht: ['Rustige nacht', 'Het huis slaapt'], ochtend: ['Rustige ochtend', 'Alles op temperatuur'], middag: ['Alles op temperatuur', 'Rustig in huis'], avond: ['Rustige avond', 'Alles op temperatuur'] },
    zon: ['Alles op temperatuur', 'Zon op het dak', 'Rustig in huis'],
    fris: (room: string) => `${hoofdletter(room)} is fris`,
    warmKamer: (room: string) => `${hoofdletter(room)} is warm`,
    binnen: (lo: string, hi: string) => (lo === hi ? `Binnen ${lo}°` : `Binnen ${lo} tot ${hi}°`),
    buiten: (b: string) => `buiten ${b}°`,
    kouder: (kamers: string, veel: boolean) => `${hoofdletter(kamers)} ${veel ? 'zijn' : 'is'} kouder dan je wilt.`,
    warmer: (kamers: string, veel: boolean) => `${hoofdletter(kamers)} ${veel ? 'zijn' : 'is'} warmer dan je wilt.`,
    gemengd: 'Een paar kamers zijn kouder of warmer dan je wilt.',
    tel: (n: number) => `${['', 'Eén', 'Twee', 'Drie', 'Vier', 'Vijf', 'Zes', 'Zeven', 'Acht', 'Negen', 'Tien'][n] ?? n} kamers`,
    panelen: (kw: string) => `Je panelen geven ${kw} kW.`,
    niets: 'Geen kamer heeft iets nodig.',
    buitenZin: (b: string) => `Buiten is het ${b}°.`,
  },
  // web/resident.ts
  uitstelbaar: {
    kop: {
      not_ready: 'Niet klaargezet',
      finished: 'Klaar · het programma is afgelopen',
      unknown: 'Niet te lezen',
      running: 'Draait',
      done: 'Klaar · draait nog tegen kreuken',
      waiting: 'Klaargezet · wacht op zon',
      waitingOther: 'Klaargezet · wacht',
      would_start: 'Klaargezet · zou nu starten',
    },
    notReady: (n: string) => `Kies een programma, sluit de deur en zet "op afstand starten" aan op de ${n}. Dan kiest SunArc het moment.`,
    finished: 'Het programma is afgelopen. Zet een nieuw programma klaar om hem weer op zon te laten draaien.',
    unknown: 'Home Connect geeft nu geen stand door.',
    running: (by: string | null) => (by ? `Het programma loopt; hij is op tijd voor ${by}.` : 'Het programma loopt.'),
    done: (sinds: string) => `Het drogen is klaar sinds ${sinds}. De trommel draait nog af en toe tegen kreuken, tot je de deur opent.`,
    waitSun: (latest: string, by: string | null) =>
      by
        ? `Ik begin zodra er zon over is. Komt er niet genoeg, dan begin ik om ${latest}, op tijd voor ${by}.`
        : `Ik begin zodra er zon over is, en uiterlijk om ${latest}.`,
    waitOther: (why: string) => `${why[0]!.toUpperCase()}${why.slice(1)}.`,
    sun: 'Er is genoeg zon over: ik zou hem nu starten.',
    late: (latest: string) => `Het is na ${latest}: ik zou hem nu starten, ook zonder zon.`,
    readyBy: (by: string) => `Ik zou hem nu starten, anders is hij niet op tijd klaar voor ${by}.`,
  },
  // web/stand-nu.ts
  standNu: {
    stand: { dag: 'Dag', nacht: 'Nacht', voorverwarmen: 'Voorverwarmen', afwezig: 'Afwezig', vakantie: 'Vakantie', handmatig: 'Handmatig' } as Record<Mode, string>,
    tot: (k: string) => `tot ${k}`,
    sinds: (k: string) => `sinds ${k}`,
    gekozenHa: 'gekozen in Home Assistant',
    gekozen: 'gekozen',
    kortGekozen: (s: string) => `${s}, gekozen`,
    kortTot: (s: string, k: string) => `${s} tot ${k}`,
    onderAuto: (k: string, s: string) => `uit de dagdelen · om ${k} ${s}`,
    onderLicht: (k: string) => `langer dan ${k} · daarna nacht`,
    onderNiemand: 'vanzelf · niemand thuis',
    niet: 'niet',
    graden: (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')}°`,
    uitleg: (p: number, d: number, n: number, kamer: string | null) => `Voorverwarmen ${p}:00, dag ${d}:00, nacht ${n}:00.${kamer ? ` De graden van ${kamer}.` : ''}`,
    uitlegPlat: 'Geldt de hele dag.',
    // Met de hand
    handKnop: (n: string) => `${inSentence(n)} met de hand`,
    handKort: (n: string, k: string) => `${n} tot ${k}`,
    handWat: (n: string) => `${n} met de hand`,
    handHoe: (doel: string | null, totDoel: boolean) => (doel ? `Op ${doel}, ` : 'Aan, ') + (totDoel ? 'tot het doel er is; daarna weer zoals het was.' : 'daarna weer zoals het was.'),
    zelfHoe: 'Iemand bediende hem zelf.',
    handNoot: 'Wat met de hand gaat, wint van de stand tot het eind.',
    // Bijspringen
    bijKnop: (meer: boolean, zou: boolean) => (zou ? (meer ? "de airco's zouden bijspringen" : 'de airco zou bijspringen') : meer ? "de airco's springen bij" : 'de airco springt bij'),
    bijWat: (n: string, kamer: string, zou: boolean) => `${n} ${zou ? 'zou bijspringen' : 'springt bij'} in ${kamer}`,
    bijHoe: (te: string | null) => (te ? `De verwarming houdt het niet bij: het is ${te} te koud.` : 'De verwarming houdt het niet bij.'),
    bijNoot: (min: number, te: string) => `Hij springt bij na ${min} minuten stoken en vanaf ${te} te koud. In de nacht, bij voorverwarmen, afwezig en vakantie niet.`,
    nietBij: 'De airco springt niet bij zolang deze stand geldt.',
    // Vakantie en afwezig
    vakWat: 'Zo zuinig mogelijk',
    vakHoe: (ha: boolean) => (ha ? 'Tot je hem in Home Assistant terugzet.' : 'Tot je hem terugzet.'),
    vakKort: 'Vakantie',
    vakKortSinds: (d: string) => `Vakantie sinds ${d}`,
    // Handmatig door een knop in Home Assistant, zoals "Handmatig koelen"
    koelKnop: 'koelen met de hand',
    koelKort: 'Koelen met de hand',
    koelWat: 'Koelen met de hand',
    knopKnop: (st: string) => `${st} in Home Assistant`,
    knopHoe: (naam: string | null, st: string) => `In Home Assistant staat ${naam ? `"${naam}"` : 'een knop'} op "${st}". Zolang regelt het huis niets.`,
    knopNoot: 'Zet je hem in Home Assistant terug, dan regelt het huis weer zelf.',
    knopOnder: (st: string) => `door "${st}" in Home Assistant`,
    dag: (ms: number, tz: string) => new Intl.DateTimeFormat('nl-NL', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(ms).replace(/\./g, ''),
    afwKnop: 'niemand thuis',
    afwKort: 'Niemand thuis',
    afwWat: 'Iedereen is weg',
    afwHoe: 'Is iemand terug, dan weer de dagdelen.',
    afwGekozenWat: 'Afwezig gekozen',
    // Licht
    lichtKnop: 'er brandt nog licht',
    lichtKort: 'Nog Dag: er brandt licht',
    lichtWat: (lampen: readonly string[]) => (lampen.length ? `${lijst(lampen, ' en ')} ${lampen.length > 1 ? 'branden' : 'brandt'} nog` : 'Er brandt nog licht'),
    lichtHoe: 'Gaat het uit, dan wordt het Nacht.',
    lichtNoot: 'Welke lampen de dag langer maken, staat in de configuratie van het huis.',
    gewoonNoot: 'Niets bijzonders: het huis volgt de dagdelen.',
    bijApparaat: (naam: string | undefined) => hoofdletter(`de ${inSentence(naam ?? 'airco')}`),
  },
  // web/woordzoeker.ts
  afscheid: {
    slaap: ['Welterusten.', 'Welterusten, slaap lekker.', 'Slaap lekker.'],
    dag: ['Tot ziens.', 'Tot straks.', 'Tot later.'],
    dank: ['Graag gedaan.', 'Graag gedaan, hoor.', 'Fijn dat ik kon helpen.'],
    rest: ['Prima. Ik ben er als je me nodig hebt.', 'Goed. Roep maar als er iets is.', 'Prima. Zeg maar "Hé huis" als je me nodig hebt.'],
  },
  // web/woordzoeker.ts: per onderwerp het antwoord en de knop
  onderwerpen: {
    'indeling': {
      antwoord:
        'De indeling pas je aan bij Instellingen, onder Je huis. Daar teken je de kamers, zet je een apparaat in een kamer, voeg je een etage toe of haal je er een weg, en kies je wat er buiten is, zoals een tuin of een oprit.',
      label: 'Naar Je huis',
    },
    'prijzen': {
      antwoord:
        'De prijzen vul je in bij Instellingen, onder Energie: Contract en prijzen. Neem ze over van je contract: stroom normaal en dal, teruglevering, gas, en eventueel de vaste kosten per dag, maand of jaar.',
      label: 'Naar Contract en prijzen',
    },
    'aansluiting': {
      antwoord:
        'Je aansluiting stel je in bij Instellingen, onder Energie: waar je panelen liggen, je hoofdzekering en je verwarming. Welke apparaten op zon mogen starten, staat bij Apparaten, op de kaart van elk apparaat.',
      label: 'Naar Energie',
    },
    'batterijen': {
      antwoord: 'Alle apparaten met een batterij, de leegste eerst, en de filters van de airco staan op Thuis. Onder de 10% komt er vanzelf een melding bij.',
      label: 'Naar de batterijen',
    },
    'comfort': {
      antwoord: 'Hoe warm of koel je het wilt, zet je bij Instellingen, onder Klimaat: per kamer en per dagdeel, en wanneer de dag en de nacht beginnen. Daar staat ook wat er in elke kamer verwarmt en koelt. De regeling rekent er meteen mee.',
      label: 'Naar Klimaat',
    },
    'functies': {
      antwoord:
        'Camera’s, de deurbel, licht bedienen en het weer stel je in bij Instellingen, onder Licht, camera’s en weer. Daar kies je welke camera’s de app toont, wat er gebeurt als er wordt aangebeld, en waar het weer vandaan komt.',
      label: 'Naar Licht, camera’s en weer',
    },
    'inrichten': {
      antwoord:
        'Bij Inrichten loop je stap voor stap langs alles wat per huis anders is: je huis, klimaat, zon en aansluiting, meters en prijzen, en functies. Je vindt het bovenaan bij Instellingen.',
      label: 'Naar Inrichten',
    },
    'inloggen': {
      antwoord:
        'Je logt in met je account van Home Assistant; de hele app vraagt dat. Uitloggen kan bij Instellingen, onder Bewoners en toegang.',
      label: 'Naar Bewoners en toegang',
    },
    'opbrengst': {
      antwoord:
        'Wat de zon en het slimme schakelen opleveren, staat bij Opbrengst: per dag, week, maand en jaar, in kWh en in euro’s.',
      label: 'Naar Opbrengst',
    },
    'vandaag': {
      antwoord: 'Het verbruik en de zon van vandaag staan bij Vandaag, kwartier voor kwartier, met wat elk apparaat deed.',
      label: 'Naar Vandaag',
    },
    'apparaten': {
      antwoord: 'Alle apparaten staan bij Apparaten, per kamer, met wat ze nu doen.',
      label: 'Naar Apparaten',
    },
    'laadpaal': {
      antwoord:
        'Je laadpaal staat bij Apparaten, met per auto hoe hij laadt: op zon, als stroom goedkoop is, of met de hand. Op zon laadt hij alleen met wat er over is, dus bij weinig zon langzamer. En hij blijft altijd onder je hoofdzekering, zodat die er niet uit gaat.',
      label: 'Naar je laadpaal',
    },
    'boiler': {
      antwoord:
        'De boiler staat bij Apparaten en in de tekening van je huis, met zijn temperatuur en het doel. Met zon over maakt hij het water alvast heet, zodat het daarna minder stroom van het net kost. Zie je hem niet, voeg hem dan toe bij Apparaten › Toevoegen en zet hem bij Je huis op zijn plek.',
      label: 'Naar Apparaten',
    },
    'bedienen': {
      antwoord:
        'Bedienen doe je in het huis op Thuis: tik op een kamer of een apparaat. Daarvoor moet je ingelogd zijn.',
      label: 'Naar Thuis',
    },
    'schakelen': {
      antwoord:
        'SunArc kijkt nu mee: het zegt wat het zou doen en leert van je huis, maar schakelt het klimaat nog niet zelf. Bij Wat je huis kan zie je per functie hoe het ervoor staat.',
      label: 'Naar Wat je huis kan',
    },
  },
  // web/buffers-bewoner.ts
  stekker: {
    kop: { aan: 'Aan op zon', zouAan: 'Zou nu aangaan', zouUit: 'Zou nu uitgaan', wachtZon: 'Wacht op zon', niets: 'Aan, vraagt niets', minimum: 'Aan voor zijn minimum', zouMinimum: 'Zou nu aangaan voor zijn minimum' },
    aan: 'Er is genoeg zon over om hem aan te laten.',
    zouAan: 'Er is genoeg zon over voor hem.',
    zouUit: 'Er is te weinig zon over: hij haalt nu stroom van het net.',
    wachtZon: (kw: string | null) => (kw ? `Hij gaat aan zodra er ${kw} kW zon over is.` : 'Hij gaat aan zodra er zon over is.'),
    niets: 'Hij staat aan, maar trekt nu niets.',
    onbekend: 'Home Assistant geeft hem nu niet door.',
    // Het minimum per dag (besluit 267).
    minimum: (duur: string, by: string) => `Zo staat hij vóór ${by} toch ${duur} aan, ook zonder zon.`,
    anders: (latest: string, duur: string, by: string) => `Komt die niet, dan gaat hij om ${latest} aan: zo staat hij vóór ${by} toch ${duur} aan.`,
    gehaald: (duur: string, by: string) => `Zijn ${duur} vóór ${by} heeft hij al.`,
    duur: (min: number) => (min % 60 === 0 ? `${min / 60} uur` : min > 60 ? `${String(Math.round((min / 60) * 100) / 100).replace('.', ',')} uur` : `${min} minuten`),
  },
  // web/push.ts
  weerGoed: { titel: (t: string) => `${t}: weer goed`, tekst: 'Het is vanzelf weer goed gekomen.' },
  // web/assistant.ts: losse zinnen
  antwoord: {
    zonNergens: 'De zon staat nu op geen van de gevels.',
    verbind: ' en ',
    zonOp: (a: string | number) => `De zon staat nu op ${a}.`,
    enWoord: 'en',
    komtVandaagNogOngeveer: (a: string | number) => `Er komt vandaag nog ongeveer ${a} zon bij.`,
    vandaagKomtWeinigZon: (a: string | number) => `Vandaag komt er weinig zon meer bij; morgen verwacht ik ${a} van je panelen.`,
    vandaagKomtWeinigZon2: 'Vandaag komt er weinig zon meer bij.',
    locale: 'nl-NL',
    hetApparaat: (a: string | number, _b: string | number) => `de ${a}`,
    temperatuurIn: (a: string | number) => `de temperatuur in ${a}`,
    slimmeMeter: 'de slimme meter',
    zonnepanelen: 'de zonnepanelen',
    meting: 'een meting',
    verbind2: ' en ',
    hetIsEr: (a: string | number) => `het is er ${a}`,
    doelIs: (a: string | number) => `het doel is ${a}`,
    verbind3: ' en ',
    gaatNuBijnaNiets: 'Er gaat nu bijna niets van of naar het net.',
    gaatNuTerugNaar: (a: string | number, _b: string | number) => `Er gaat nu ${a} terug naar het net.`,
    huisHaaltNuVan: (a: string | number) => `Het huis haalt nu ${a} van het net.`,
    panelenLeverenNu: (a: string | number) => `Je panelen leveren nu ${a}.`,
    panelenLeverenNuPrecies: (a: string | number) => `Je panelen leveren nu ${a}, precies genoeg voor het huis.`,
    panelenLeverenNuEn: (a: string | number, b: string | number) => `Je panelen leveren nu ${a}, en ${b} daarvan gaat terug naar het net.`,
    panelenLeverenNuHuis: (a: string | number, b: string | number) => `Je panelen leveren nu ${a}; het huis haalt er ${b} van het net bij.`,
    apparaatNu: (a: string | number, b: string | number, _c: string | number) => `${a} ${b} nu.`,
    hebtZelfInHanden: (a: string | number, b: string | number, _c: string | number) => `Je hebt ${a} zelf in handen. ${b} eraf tot je hem teruggeeft.`,
    hebtZelfInHanden2: (a: string | number, b: string | number, c: string | number, _d: string | number) => `Je hebt ${a} zelf in handen, tot ${b}. Tot dan ${c} eraf.`,
    panelenLeverenDusDat: (a: string | number) => `Je panelen leveren ${a}, dus dat kan op eigen stroom.`,
    evenStilzettenStaatEven: (a: string | number, b: string | number, c: string | number, _d: string | number) => `${a} ${b}, omdat ${c}. Komt er genoeg zon terug, dan gaat hij verder.`,
    wilDatWachtNog: (a: string | number, b: string | number, c: string | number, d: string | number) => `${a} wil ${b}: ${c}. Dat wacht nog even, omdat ${d}.`,
    geenDoel: (a: string | number, b: string | number, c: string | number, _d: string | number, _e: string | number) => `${a} is het ${b}. Er is nu geen doel${c}.`,
    nuStaat: (a: string | number) => `Nu staat ${a}.`,
    hoeStaatWeetIk: (a: string | number) => `Hoe ${a} staat, weet ik niet.`,
    kenIkNietAls: (a: string | number, b: string | number) => `"${a}" ken ik niet als kamer. Ik ken ${b}.`,
    ikBenNetOpgestart: 'Ik ben net opgestart en heb nog niets besloten. Vraag het me zo nog eens.',
    geenTempIk: (plek: string, _zn: string) => `Ik meet ${plek} nu geen temperatuur.`,
    geenTemp: (plek: string, _zn: string) => `${hoofdletter(plek)} is nu geen temperatuur gemeten.`,
  },
  // web/house-apparaat.ts: losse zinnen
  apparaatZin: {
    uit: 'uit',
  },
  // web/opdracht.ts: losse zinnen
  opdracht: {
    aan: 'aan',
    scene: 'scène',
    sceneStaatAan: (a: string | number) => `Scène ${a} staat aan.`,
    scene2: (a: string | number, _b: string | number) => `Scène, ${a}`,
    lichtUit: (naam: string, inZin: string) => [{ label: `Licht ${inZin} uit`, tekst: `licht ${naam} uit` }],
  },
  // web/resident.ts: losse zinnen
  bewonerZin: {
    morgen: 'morgen',
    morgen2: 'morgen',
  },
  // web/routes/assistent.ts: losse zinnen
  vraagRoute: {
    zegWatEnWanneer: 'Zeg wat en wanneer, bijvoorbeeld: elke dag na zonsondergang de screens dicht.',
    ietsOpLijstZetten: 'Iets op een lijst zetten doe ik via de app, op de wand of je telefoon. Via deze spraakassistent kan het met "Opdrachten bij voorkeur lokaal afhandelen" aan in Home Assistant.',
    klimaatBedienIkNiet: 'Het klimaat bedien ik niet: de klimaatbrug staat uit.',
  },
  // web/routes/huis.ts: losse zinnen
  huisRoute: {
    buitenunit: 'Buitenunit',
  },
  // web/stem.ts: losse zinnen
  stem: {
    stemInHomeAssistant: 'de stem in Home Assistant heeft geen Nederlands',
  },
  // web/woordzoeker.ts: losse zinnen
  woordzoekerZin: {
    datBegrijpIkNog: 'Dat begrijp ik nog niet. Vraag iets over je huis of over de app, bijvoorbeeld:',
    datBegrijpIkNog2: (a: string | number, _b: string | number) => `Dat begrijp ik nog niet. Vraag bijvoorbeeld ${a}.`,
  },
  // Overal: de taal van getallen en datums
  algemeen: {
    locale: 'nl-NL',
    decimaal: ',',
    stemCodes: ['nl_nl', 'nl'] as readonly string[],
    verstaanCodes: ['nl', 'nl-NL', 'nl_NL', 'nl-BE'] as readonly string[],
    maandInZin: (m: string) => m.toLowerCase(),
  },
} as const;
