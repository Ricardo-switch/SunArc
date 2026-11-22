/**
 * Klaarzetten per niveau (besluit 246, schets Wand-Klaarzetten): per functie
 * wat er nodig is, en wat SunArc al ziet. Drie niveaus: voor iedereen (alles
 * blijft in huis), gevorderd (een dienst buiten je huis) en expert (je eigen
 * netwerk). Een stap vinkt zichzelf af zodra SunArc hem ziet.
 *
 * SunArc installeert en verandert hier niets: een stap opent de juiste pagina
 * in Home Assistant, of een pagina in de app. Alleen de spraakassistent maken
 * gaat met een tik, langs de deur van besluit 203.
 *
 * Alleen tellen en namen van diensten, nooit een entity-ID in de zin (besluit 45).
 */

import type { Lang } from './assistant.js';
import type { KlaarPunt } from './klaarzetten.js';
import type { InHuisStand } from './stem-in-huis.js';
import type { SpraakKeuze } from './functies.js';

export type Niveau = 'iedereen' | 'gevorderd' | 'expert';

/** Klaar, nog te doen, kan erbij (niet nodig), of niet te zien vanuit SunArc. */
export type StapStand = 'klaar' | 'open' | 'kan' | 'onbekend';

export interface KlaarStap {
  readonly id: string;
  readonly titel: string;
  readonly zin: string;
  readonly stand: StapStand;
  /** Een pagina in Home Assistant, als pad voor zijn navigatie. */
  readonly ha: string | null;
  /** Of een pagina in de app. */
  readonly app: string | null;
  /** Wat SunArc na een tik zelf doet; alleen de spraakassistent (besluit 203). */
  readonly doe: 'spraakassistent' | null;
}

export interface KlaarFunctie {
  readonly id: string;
  readonly niveau: Niveau;
  readonly titel: string;
  /** Wat de functie doet, boven de stappen. */
  readonly wat: string;
  /** Onder de naam in de lijst: wat er staat, of hoeveel er nog open is. */
  readonly zin: string;
  readonly stappen: readonly KlaarStap[];
  /** Hoeveel er klaar is van wat telt (klaar en open); kan erbij en onbekend tellen niet. */
  readonly klaar: number;
  readonly van: number;
  /** Bij de cloud: welke routes er al staan. */
  readonly wolken?: readonly Wolk[];
}

/** Wat de wand zelf over Fully Kiosk meldt (besluit 246). */
export interface WandMelding {
  /** De pagina draait in Fully Kiosk Browser. */
  readonly fully: boolean;
  /** De JavaScript-interface van Fully staat aan. */
  readonly js: boolean;
  /** De camera kijkt mee voor beweging; null als Fully het niet zegt. */
  readonly camera: boolean | null;
  readonly ms: number;
}

/** Een diensten-platform voor verstaan of stem buiten huis. */
export type Wolk = 'cloud' | 'google' | 'openai';

export interface KlaarExtra {
  readonly addOn: boolean;
  readonly eigenPoort: boolean;
  /** De naam van deze add-on bij de Supervisor, voor de pagina met zijn instellingen. */
  readonly eigenSlug: string | null;
  /** Helemaal in huis (besluit 203); null buiten de add-on. */
  readonly inHuis: InHuisStand | null;
  /** Het model van Whisper; undefined als SunArc het niet kan lezen. */
  readonly whisperModel: string | null | undefined;
  /** Of de Tailscale-add-on draait; null als SunArc het niet kan lezen. */
  readonly tailscale: boolean | null;
  /** Wat de wand het laatst meldde, of null. */
  readonly wand: WandMelding | null;
  /** Of er een scherm aan de wand is (een account voor de wand, of een melding). */
  readonly heeftWand: boolean;
  /** Functies › Scherm: uit 's nachts of als niemand thuis is, en wat hem wekt. */
  readonly schermUit: boolean;
  readonly wekker: string | null;
  /** De diensten buiten huis die verstaan of een stem geven. */
  readonly wolken: readonly Wolk[];
  readonly spraak: readonly SpraakKeuze[];
  /** Hoe laat het is, voor "gezien om". */
  readonly tijd: (ms: number) => string;
}

/** Modellen van Whisper die huiswoorden als "screen" en "zolder" slecht verstaan. */
const KLEIN_MODEL = /^(tiny|base)(-int8)?$|^auto$/;
const TAILSCALE = 'a0d7b954_tailscale';

const WOORDEN = {
  nl: {
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
  en: {
    nog: (n: number) => (n === 1 ? '1 step to go' : `${n} steps to go`),
    kan: 'Can be added',
    huis: ['The house', 'Where the house is, the rooms and who lives there. Everything starts here.', 'Location, rooms and residents'],
    klimaat: ['Climate', 'What heats and cools, and the temperature in every room.', 'Devices and thermometers'],
    energie: ['Sun and energy', 'What goes to and from the grid, and what your panels produce.', 'Grid meter, panels and meters'],
    licht: ['Lights and screens', 'Control lights, scenes and screens from the app.', 'Lights and screens'],
    witgoed: ['Appliances on solar', 'Start the dryer, washing machine or dishwasher when the sun shines.', 'Remote start'],
    weer: ['The weather', 'Rain and wind for the screens, and tomorrow\'s sun.', 'A weather service'],
    assistent: ['The assistant at home', 'Talk to your house without anything leaving it: understanding, answering and the wake word "Hey house", all on your own Home Assistant.', 'Understanding, voice and wake word'],
    wand: ['The wall screen', 'The screen goes off when nobody is there, and wakes when someone walks past. That works with Fully Kiosk Browser on the tablet; the wall screen tells SunArc itself how it is set up.', 'Fully Kiosk and screen off'],
    taalmodel: ['A language model', 'The assistant puts things in its own words, with a language model as an AI task in Home Assistant.', 'An AI task'],
    cloud: ['The assistant through the cloud', 'Better understanding and a richer voice, but what you say then goes to a service outside your house. Pick one.', 'Pick a route'],
    tel: ['A separate app on your phone', 'Without the Home Assistant app: SunArc on your home screen, also when you are out. Safely through Tailscale, your own network; nothing is open to the internet.', 'Through Tailscale'],
    geenWand: 'Is there a tablet on the wall? Open SunArc there; then this shows what goes with it.',
    s: {
      whisper: ['Whisper understands what you say', 'The add-on is running.', 'Install the Whisper add-on in Home Assistant.'],
      model: {
        titel: 'Whisper on small-int8',
        klaar: (m: string) => `Set to ${m}.`,
        open: (m: string) => `Set to ${m}: fast, but it mishears words like "screen" and "attic". Choose small-int8 in the Whisper settings.`,
        onbekend: 'Choose small-int8 in the Whisper settings: it understands words like "screen" and "attic" better.',
      },
      piper: ['Piper gives the voice', 'The add-on is running.', 'Install the Piper add-on in Home Assistant.'],
      owv: {
        titel: 'openWakeWord hears "Hey house"',
        klaar: 'The wake word is set on the voice assistant.',
        add: 'Install the openWakeWord add-on; SunArc adds "Hey house" to it.',
        kies: 'Restart openWakeWord once and choose he_huis on the voice assistant.',
      },
      gevonden: 'Home Assistant found it; the voice assistant confirms it.',
      maak: ['The SunArc voice assistant', 'Understanding, voice and wake word together.', 'Understanding, voice and wake word together, with one tap.', 'Whisper and Piper first.'],
      fully: { titel: 'Fully Kiosk Browser', nogNiet: 'Not reported yet. If the wall screen runs in Fully, it reports itself as soon as SunArc opens a page there.', klaar: (tijd: string) => `The wall screen runs in Fully (seen at ${tijd}).`, open: 'Install Fully Kiosk Browser on the tablet and open SunArc in it. The wall screen then reports itself.', anders: (tijd: string) => `The wall screen runs in an ordinary browser (seen at ${tijd}). With Fully the screen can go off and on.` },
      js: ['The link with the page', 'JavaScript Interface is on: SunArc can switch the screen off and on.', 'In Fully: Settings › Advanced Web Settings › Enable JavaScript Interface.'],
      camera: { titel: 'Wake on motion', fully: 'The tablet\'s camera watches for motion.', melder: 'A motion sensor in the house wakes the wall screen.', open: 'In Fully: Settings › Motion Detection › Enable Visual Motion Detection (needs Fully Plus). Or choose a motion sensor in Features › Screen.' },
      uit: ['Screen off when nobody is looking', 'On in Profile › Screen off.', 'Switch it on in Profile › Screen off: at night, or when nobody is home.'],
      wolk: { titel: 'A service in Home Assistant', klaar: (namen: string) => `${namen} is set up.`, open: 'Add one of the three routes above in Home Assistant.' },
      naarWolk: ['The voice assistant to the cloud', 'A voice assistant understands through the cloud; the wake word stays at home.', 'Choose the speech-to-text service on a voice assistant in Home Assistant.'],
      ts: { titel: 'The Tailscale add-on', klaar: 'The add-on is running.', open: 'Install the Tailscale add-on and log in once.', onbekend: 'Install the Tailscale add-on and log in once; SunArc cannot see whether it is running.' },
      poort: ['A port of its own for SunArc', 'Open, only reachable through Tailscale.', 'Set a port in the SunArc add-on settings, such as 8100.'],
      opTel: ['On your phone', 'Tailscale on your phone, then open SunArc in Chrome and Add to home screen.'],
    },
    wolk: { cloud: 'Home Assistant Cloud', google: 'Google Cloud', openai: 'OpenAI' },
  },
} as const satisfies Record<Lang, unknown>;

const stap = (id: string, titel: string, zin: string, stand: StapStand, ha: string | null = null, app: string | null = null, doe: KlaarStap['doe'] = null): KlaarStap => ({ id, titel, zin, stand, ha, app, doe });

/** Een stap uit Klaarzetten in Home Assistant (besluit 179): wat ontbreekt en niet nodig is, kan erbij. */
const uitPunt = (p: KlaarPunt | undefined): KlaarStap[] => (p ? [stap(p.id, p.titel, p.zin, p.stand === 'klaar' ? 'klaar' : p.stand === 'mist' ? 'open' : 'kan', p.stand === 'klaar' ? null : p.pad)] : []);

export function klaarFuncties(punten: readonly KlaarPunt[], x: KlaarExtra, lang: Lang = 'nl'): KlaarFunctie[] {
  const w = WOORDEN[lang];
  const s = w.s;
  const p = (id: string) => punten.find((q) => q.id === id);
  const functie = (id: string, niveau: Niveau, [titel, wat, rust]: readonly [string, string, string], stappen: readonly KlaarStap[]): KlaarFunctie => {
    const tel = stappen.filter((q) => q.stand === 'klaar' || q.stand === 'open');
    const klaar = tel.filter((q) => q.stand === 'klaar').length;
    const open = tel.length - klaar;
    // Niets dat telt (alles kan erbij): geen vinkje, want er staat ook niets.
    return { id, niveau, titel, wat, zin: open ? w.nog(open) : tel.length ? rust : w.kan, stappen, klaar, van: tel.length };
  };

  // De assistent in huis: in de add-on de drie add-ons en de spraakassistent (besluit 203); daarbuiten wat Home Assistant zegt.
  const ih = x.inHuis;
  const addon = (id: string) => ih?.addons.find((a) => a.id === id);
  const staat = (id: string): StapStand => (addon(id)?.staat === 'aan' ? 'klaar' : 'open');
  const pagina = (id: string) => `/hassio/addon/${addon(id)?.slug ?? `core_${id}`}/info`;
  const zinVan = (id: string, [, klaar, open]: readonly string[]) => (addon(id)?.staat === 'aan' ? klaar! : addon(id)?.staat === 'gevonden' ? s.gevonden : open!);
  const model = x.whisperModel;
  const owvAan = addon('openwakeword')?.staat === 'aan';
  const wekwoord = ih?.assistent?.wekwoord != null || x.spraak.some((q) => q.wekwoord);
  const kanMaken = ih != null && ['whisper', 'piper'].every((id) => addon(id)?.staat !== 'nee');
  const assistent = ih
    ? [
        stap('whisper', s.whisper[0], zinVan('whisper', s.whisper), staat('whisper'), staat('whisper') === 'klaar' ? null : pagina('whisper')),
        model === undefined
          ? stap('model', s.model.titel, s.model.onbekend, 'onbekend', pagina('whisper'))
          : model == null
            ? stap('model', s.model.titel, s.model.onbekend, 'kan', pagina('whisper'))
            : KLEIN_MODEL.test(model)
              ? stap('model', s.model.titel, s.model.open(model), 'open', pagina('whisper'))
              : stap('model', s.model.titel, s.model.klaar(model), 'klaar'),
        stap('piper', s.piper[0], zinVan('piper', s.piper), staat('piper'), staat('piper') === 'klaar' ? null : pagina('piper')),
        stap('wekwoord', s.owv.titel, wekwoord ? s.owv.klaar : owvAan ? s.owv.kies : s.owv.add, wekwoord ? 'klaar' : 'open', wekwoord ? null : owvAan ? '/config/voice-assistants/assistants' : pagina('openwakeword')),
        stap('spraakassistent', s.maak[0], ih.assistent ? s.maak[1] : kanMaken ? s.maak[2] : s.maak[3], ih.assistent ? 'klaar' : 'open', null, null, ih.assistent || ih.bezig || !kanMaken ? null : 'spraakassistent'),
      ]
    : [...uitPunt(p('spraak')), ...uitPunt(p('wekwoord'))];

  /*
   * De wand: wat hij zelf meldt (besluit 246), en Functies › Scherm. Open is
   * alleen wat de wand zelf zegt dat mist (2 november 2026): de koppeling met
   * de pagina, of de camera als die de wand moet wekken. Nog niet gemeld, geen
   * wekker of het scherm aan laten is een keuze, geen tekort.
   */
  const m = x.wand;
  const tijd = m ? x.tijd(m.ms) : '';
  const fully = m?.fully === true;
  const beweging: StapStand = x.wekker != null && x.wekker !== 'fully' ? 'klaar' : x.wekker === 'fully' ? (!fully || m?.camera == null ? 'onbekend' : m.camera ? 'klaar' : 'open') : 'kan';
  const wand = !x.heeftWand
    ? [stap('fully', s.fully.titel, w.geenWand, 'kan')]
    : fully
      ? [
          stap('fully', s.fully.titel, s.fully.klaar(tijd), 'klaar'),
          stap('js', s.js[0], m?.js ? s.js[1] : s.js[2], m?.js ? 'klaar' : 'open'),
          stap('beweging', s.camera.titel, beweging === 'klaar' ? s.camera[x.wekker === 'fully' ? 'fully' : 'melder'] : s.camera.open, beweging, null, beweging === 'klaar' ? null : 'jij.html#uit'),
          stap('uit', s.uit[0], x.schermUit ? s.uit[1] : s.uit[2], x.schermUit ? 'klaar' : 'kan', null, x.schermUit ? null : 'jij.html#uit'),
        ]
      : [
          stap('fully', s.fully.titel, m ? s.fully.anders(tijd) : s.fully.nogNiet, 'kan'),
          stap('uit', s.uit[0], x.schermUit ? s.uit[1] : s.uit[2], x.schermUit ? 'klaar' : 'kan', null, x.schermUit ? null : 'jij.html#uit'),
        ];

  // De cloud: welke dienst er al staat, en of een spraakassistent hem gebruikt.
  const wolkNamen = x.wolken.map((q) => w.wolk[q]).join(', ');
  const naarWolk = x.spraak.some((q) => q.wolk === true);
  const cloud = [
    stap('wolk', s.wolk.titel, x.wolken.length ? s.wolk.klaar(wolkNamen) : s.wolk.open, x.wolken.length ? 'klaar' : 'open'),
    stap('naarWolk', s.naarWolk[0], naarWolk ? s.naarWolk[1] : s.naarWolk[2], naarWolk ? 'klaar' : 'open', naarWolk ? null : '/config/voice-assistants/assistants'),
  ];

  // De losse app (besluit 108 en 160): alleen in de add-on.
  const tsStand: StapStand = x.tailscale === true || x.eigenPoort ? 'klaar' : x.tailscale === false ? 'open' : 'onbekend';
  const tel = [
    stap('tailscale', s.ts.titel, tsStand === 'klaar' ? s.ts.klaar : tsStand === 'open' ? s.ts.open : s.ts.onbekend, tsStand, tsStand === 'klaar' ? null : `/hassio/addon/${TAILSCALE}/info`),
    stap('poort', s.poort[0], x.eigenPoort ? s.poort[1] : s.poort[2], x.eigenPoort ? 'klaar' : 'open', x.eigenPoort || !x.eigenSlug ? null : `/hassio/addon/${x.eigenSlug}/config`),
    // Of het op een telefoon staat, kan SunArc niet zien.
    stap('optel', s.opTel[0], s.opTel[1], 'onbekend', null, 'jij.html#startscherm'),
  ];

  return [
    functie('huis', 'iedereen', w.huis, [...uitPunt(p('locatie')), ...uitPunt(p('ruimtes')), ...uitPunt(p('personen')), ...uitPunt(p('telefoon'))]),
    functie('klimaat', 'iedereen', w.klimaat, [...uitPunt(p('klimaat')), ...uitPunt(p('temperatuur'))]),
    functie('energie', 'iedereen', w.energie, [...uitPunt(p('netmeter')), ...uitPunt(p('omvormer')), ...uitPunt(p('energiedashboard'))]),
    functie('licht', 'iedereen', w.licht, [...uitPunt(p('lampen')), ...uitPunt(p('schermen'))]),
    functie('witgoed', 'iedereen', w.witgoed, uitPunt(p('opzon'))),
    functie('weer', 'iedereen', w.weer, uitPunt(p('weer'))),
    functie('assistent', 'iedereen', w.assistent, assistent),
    functie('wand', 'iedereen', w.wand, wand),
    functie('taalmodel', 'gevorderd', w.taalmodel, uitPunt(p('taalmodel'))),
    { ...functie('cloud', 'gevorderd', w.cloud, cloud), wolken: x.wolken },
    ...(x.addOn ? [functie('telefoon', 'expert', w.tel, tel)] : []),
  ];
}

/** De diensten buiten huis die als spraak naar tekst of stem in Home Assistant staan, aan hun platform. */
export function wolkenVan(entiteiten: readonly { readonly entity_id: string; readonly platform?: string | null }[]): Wolk[] {
  const uit = new Set<Wolk>();
  for (const e of entiteiten) {
    if (!/^(stt|tts)\./.test(e.entity_id)) continue;
    const p = e.platform ?? '';
    if (p === 'cloud') uit.add('cloud');
    else if (p === 'google_cloud') uit.add('google');
    else if (p.startsWith('openai')) uit.add('openai');
  }
  return [...uit];
}
