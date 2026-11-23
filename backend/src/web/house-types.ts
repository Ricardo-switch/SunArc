/*
 * Het huis: de vormen van wat de dienst over het huis vertelt (22 november 2026, opgesplitst uit web/house.ts).
 *
 * Alleen typen: een etage, een kamer, een apparaat met zijn stand, een scène, de batterijen, de toegang en de
 * ligging van het huis.
 */
import { type Opslag } from './opslag.js';
import { type DoelSoort } from './doelsoort.js';
import type { Warmtebron } from './warmte.js';
import { type Gevaar } from './rookmelders.js';
import type { ZigbeeGroep } from '../adapters/homeassistant/client.js';
import type { HaArea, HaDevice, HaFloor, HaRegistryEntity } from '../adapters/homeassistant/discovery.js';
import { type RoomKind } from './assistant.js';
import { type FloorId, type LayoutAccu, type LayoutAround, type Woning, type LayoutOutside, type OutsideZoneType, type RoomType } from './layout.js';

export interface HouseRegisters {
  readonly floors: readonly HaFloor[];
  readonly areas: readonly HaArea[];
  readonly devices: readonly HaDevice[];
  readonly entities: readonly HaRegistryEntity[];
  /** De groepen van Zigbee2MQTT met hun lampen (besluit 221); Home Assistant noemt die lampen niet. */
  readonly zigbeeGroepen?: readonly ZigbeeGroep[];
}

/**
 * `apparaat`: een uitstelbaar apparaat (besluit 98), zoals de droger; `camera`: om te bekijken (besluit 106);
 * `rookmelder`: een rookmelder zoals de Nest Protect (21 oktober 2026), alleen lezen.
 */
export type DeviceKind = 'klimaat' | 'screen' | 'licht' | 'meter' | 'apparaat' | 'camera' | 'rookmelder';

/** Wat een klimaatapparaat of meter meet, uit Home Assistant. */
export interface HouseReading {
  readonly temperatuurC: number | null;
  readonly vochtPct: number | null;
  /**
   * Beweging (15 oktober 2026): van een bewegingsmelder bij hetzelfde
   * apparaat. `nu` als hij nu beweging ziet; `sindsMs` wanneer dat veranderde.
   * Weg als het apparaat geen beweging meet. `id` is de melder in Home
   * Assistant: die kan de wand wekken (besluit 164).
   */
  readonly beweging?: { readonly nu: boolean; readonly sindsMs: number | null; readonly id: string };
}

/** Wat een klimaatapparaat kan en doet: de knoppen volgen wat het kan. */
export interface HouseClimate {
  readonly kanKoelen: boolean;
  readonly kanVerwarmen: boolean;
  /** Kan drogen (`dry` in Home Assistant, besluit 129); weg is nee. */
  readonly kanDrogen?: boolean;
  /**
   * Hoeveel het filter nog meegaat (besluit 129): in procenten, of in uren als
   * de koppeling alleen dat geeft. Ook van een tweede koppeling van hetzelfde
   * apparaat, zoals SmartThinQ naast LG ThinQ.
   */
  readonly filter?: { readonly pct: number | null; readonly uren: number | null };
  /** Het doel dat Home Assistant nu heeft, of null. */
  readonly doelC: number | null;
  /** Wat het apparaat nu werkelijk doet, in de taal van de app: "verwarmt", "koelt", "staat stil", of null. */
  readonly actie: string | null;
  /** Hetzelfde als vaste code (besluit 185), om op te letten: de woorden verschillen per taal. */
  readonly actieCode: ActieCode | null;
  /**
   * Wat de regeling ermee doet (besluit 138): houdt de kamer op temperatuur,
   * helpt op zon, of kijkt alleen.
   */
  readonly rol: 'houdt' | 'zon' | 'kijken';
  /** Wat het nu vraagt, in W, als er een stroommeter bij is (Apparaten, 15 oktober 2026); anders weg. */
  readonly vermogenW?: number | null;
  /** De kWh-meter van hetzelfde apparaat in Home Assistant, om het verbruik van vandaag te vinden. */
  readonly energieMeter?: string;
  /** Wat Home Assistant van het apparaat zegt (besluit 197), voor Inrichten › Wat elk apparaat kan. */
  readonly ha?: HouseClimateHa;
}

/**
 * Wat Home Assistant van een klimaatapparaat zegt (besluit 197): via welke
 * koppeling, welk bereik en welke standen het opgeeft, en of het zegt wat het
 * doet (`hvac_action`). Staat hetzelfde apparaat er via een tweede koppeling,
 * dan die erbij, zoals een LG via LG ThinQ en via SmartThinQ.
 */
export interface HouseClimateHa {
  /** Het platform in Home Assistant: `lg_thinq`, `nest`, `zha`, `mqtt`, `tuya`, `smartir`; null als het onbekend is. */
  readonly koppeling: string | null;
  readonly minC: number | null;
  readonly maxC: number | null;
  readonly standen: readonly string[];
  readonly zegtActie: boolean;
  readonly tweede?: { readonly id: string; readonly koppeling: string | null; readonly minC: number | null; readonly maxC: number | null };
  /** Wat het doel is (testerronde, november 2026): een kamer, een correctie op de stooklijn, of een watertemperatuur. */
  readonly doel: DoelSoort;
}

export interface HouseDevice {
  /** Voor de pagina, als sleutel; de bewoner ziet hem nooit (45). */
  readonly id: string;
  /**
   * Witgoed (22 november 2026): een uitstelbaar apparaat zoals de droger. Het
   * deelt de soort `apparaat` met een losse stekker en een warmtebuffer, maar
   * staat op de kamerpagina apart en heeft in de tekening een eigen soort.
   */
  readonly witgoed?: true;
  /** De naam in de app: de eigen naam uit de indeling, anders die uit Home Assistant. */
  readonly naam: string;
  /** De naam zoals Home Assistant hem kent, voor wie hem hernoemt. */
  readonly haNaam: string;
  /** Een lamp achter een schakelaar (besluit 297): waarlangs, zoals "Shelly 1 mini". */
  readonly via?: string;
  /**
   * Eén apparaat, één bolletje (20 november 2026): dit is een bijfunctie van
   * een ander apparaat in Home Assistant, zoals de schijnwerper of de
   * bewegingsmelder van een camera. Het id van dat hoofdapparaat.
   */
  readonly hoortBij?: string;
  readonly soort: DeviceKind;
  /** De stand in woorden, in de taal van de app: "aan · 70%", "60% dicht", "koelen naar 22°". */
  readonly stand: string;
  /**
   * De stand als vaste code (besluit 185): de app let hierop, niet op de
   * woorden, die per taal verschillen. Een scherm dat beweegt is `gaat-open`
   * of `gaat-dicht`.
   */
  readonly standCode: StandCode;
  readonly aan: boolean;
  readonly helderheidPct: number | null;
  /** Zoals Home Assistant het zegt: 100 is open, 0 is dicht. */
  readonly positiePct: number | null;
  /** Het klimaatapparaat uit de configuratie, voor "wat zou ik doen". */
  readonly actuatorId: string | null;
  /** De zone in de kamer waar het staat, of null. */
  readonly zone: string | null;
  /** De lampgroepen in Home Assistant waar het in zit: context bij een naam die vaker voorkomt. */
  readonly groepen: readonly string[];
  /** Een lamp die meer kan dan aan en uit. */
  readonly dimbaar: boolean;
  /** Een lamp die warm, neutraal of koel kan (kleurtemperatuur, of kleur). */
  readonly kleurtemp: boolean;
  /**
   * Wat een lamp in wit en kleur kan (besluit 100): het bereik in kelvin, of null,
   * en of hij kleur kan. Met de stand van nu, voor wat er gekozen staat.
   */
  readonly licht?: {
    readonly wit: { readonly minK: number; readonly maxK: number } | null;
    readonly kleur: boolean;
    readonly kelvin: number | null;
    /** Tint 0–360 en verzadiging 0–100, als hij nu in kleur staat. */
    readonly tint: readonly [number, number] | null;
  };
  /** Temperatuur en luchtvochtigheid, voor een meter of een klimaatapparaat. */
  readonly meting: HouseReading | null;
  /** Alleen bij klimaat. */
  readonly klimaat: HouseClimate | null;
  /** Een meter die de temperatuur van een regelgebied levert. */
  readonly meetKamer: boolean;
  /**
   * Alleen bij een scherm (besluit 121): of het zijn stand terugmeldt (Somfy io)
   * of niet (Somfy RTS: de stand is een aanname), en of je een stand kunt kiezen.
   * Alleen een scherm met terugmelding mag later in de regeling.
   */
  readonly scherm?: {
    readonly terugmelding: boolean;
    readonly standKiezen: boolean;
    /** Een zonnescherm (`awning`, besluit 128): dat vouw je uit en klap je in. */
    readonly zonnescherm?: boolean;
    /**
     * De gevel waar het scherm hangt (besluit 145): gekozen bij Indeling, of
     * een voorstel uit de naam. Weg als het huis het niet weet; dan zegt de
     * app niet of de zon erop staat.
     */
    readonly gevel?: { readonly id: string; readonly naam: string; readonly gekozen: boolean };
    /**
     * Zonder terugmelding: de laatste opdracht, open (uitgevouwen) of dicht
     * (ingeklapt), van Home Assistant of uit de app (besluit 128). Niet zeker:
     * een afstandsbediening hoort niemand.
     */
    readonly laatste?: 'open' | 'dicht';
  };
  /** De batterij van het apparaat in procenten, als het er een heeft (besluit 122). */
  readonly batterijPct?: number;
  /**
   * Alleen bij een boiler of jacuzzi (besluit 186, huis 3.0): wat het is, voor
   * de tekening, en de watertemperatuur met waar hij heen wil. De tekening zet
   * de boiler in zijn kamer en de jacuzzi in de tuin.
   */
  readonly warmte?: {
    /** Een stekker (besluit 264) heeft geen graden: tempC en doelC zijn dan null. */
    readonly soort: 'boiler' | 'jacuzzi' | 'stekker';
    readonly tempC: number | null;
    readonly doelC: number | null;
    readonly minC: number;
    readonly zonC: number;
    /** Wacht hij op zon, of verwarmt hij er nu mee. */
    readonly opZon: boolean;
    /** Wat hij nu trekt, in W, als er een meter is (besluit 315): voor het label en de lijn in de tekening. */
    readonly vermogenW?: number | null;
  };
  /**
   * Alleen bij een rookmelder (21 oktober 2026): wat hij ziet (rook, koolmonoxide
   * of hitte) en sinds wanneer, of zijn batterij een probleem meldt, wanneer hij
   * vervangen moet en wanneer hij getest is (`JJJJ-MM-DD`).
   */
  readonly rookmelder?: { readonly gevaar: Gevaar | null; readonly sindsMs: number | null; readonly batterijProbleem: boolean; readonly vervangenVoor: string | null; readonly getestOp: string | null };
  /**
   * Een radiatorknop (besluit 126), zoals de Sonoff TRVZB: hoe hij gekoppeld is
   * (ZHA of Zigbee2MQTT), en hoe ver de klep open staat als hij dat meldt.
   * Alleen kijken: tot stap B bedient SunArc geen klimaat.
   */
  readonly radiatorknop?: { readonly koppeling: 'zha' | 'zigbee2mqtt' | 'anders'; readonly klepPct: number | null };
}

/**
 * Wat er op een niveau aan staat, in woorden (ONTWERP §4: "2 lampen aan",
 * "Screens 60% dicht", "Er draait niets"). De dienst zegt het, de pagina toont het.
 */
export interface HouseSummary {
  readonly lampenAan: number;
  /** De stand van de screens, of null als er geen zijn. */
  readonly screens: string | null;
  /** Hoeveel klimaatapparaten draaien, en dat in woorden. */
  readonly draait: number;
  readonly klimaat: string;
}

export interface HouseRoom {
  readonly id: string;
  readonly naam: string;
  /** Het regelgebied uit de configuratie dat deze kamer is, of null. */
  readonly zoneId: string | null;
  /** De delen van de kamer (95), leeg als hij er geen heeft. */
  readonly zones: readonly {
    readonly id: string;
    readonly naam: string;
    readonly soort?: RoomType | OutsideZoneType;
    /** Een eigen regeling (besluit 306): het regelgebied, de temperatuur, het doel en de stand. */
    readonly regeling?: { readonly zoneId: string; readonly temperatuurC: number | null; readonly doelC: number | null; readonly status: { readonly soort: string; readonly zin: string } | null };
  }[];
  /** Van het regelgebied, of anders van een meter in de kamer. */
  readonly temperatuurC: number | null;
  readonly vochtPct: number | null;
  /** De meter waar de temperatuur vandaan komt, als het niet het regelgebied is. */
  readonly gemetenDoor: string | null;
  /**
   * Waarmee de kamer meet (besluit 138): de namen van de sensoren of
   * apparaten waar de regeling mee rekent, of die bij Meten met gekozen zijn.
   * Leeg als er niets meet.
   */
  readonly meetMet: readonly string[];
  readonly status: { readonly soort: RoomKind; readonly zin: string } | null;
  readonly lampenAan: number;
  readonly samenvatting: HouseSummary;
  readonly apparaten: readonly HouseDevice[];
  /** De scènes van deze ruimte, uit Hue (besluit 100); de laatst gekozen is actief. */
  readonly scenes: readonly HouseScene[];
  /**
   * Een buitenruimte (besluit 109): wat voor ruimte, en of er een auto of een
   * tuinhuis bij hoort. Zoals de bewoner het in de indeling vastlegde, of
   * anders een voorstel uit de naam. Null voor een kamer binnen.
   */
  readonly buiten: LayoutOutside | null;
  /**
   * Wat voor kamer het is, voor de inrichting in de tekening (besluit 119):
   * zoals de bewoner koos, of een voorstel uit de naam; null buiten, of als
   * de naam niets zegt.
   */
  readonly soort: RoomType | null;
  /** Of de soort door de bewoner gekozen is, of een voorstel. */
  readonly soortGekozen: boolean;
  /** Wat er verwarmt en koelt, zoals de bewoner het vastlegde (besluit 132); leeg als nog niets. */
  readonly bronnen: readonly Warmtebron[];
  /**
   * Doet mee met de regeling van een andere kamer (besluit 142): welke kamer,
   * en zijn regelzone. Dan komen de stand en, zonder eigen meter, de
   * temperatuur van die regeling. Null als de kamer niet meedoet.
   */
  readonly meedoenMet: { readonly kamerId: string; readonly naam: string; readonly zoneId: string | null } | null;
}

export interface HouseScene {
  readonly id: string;
  readonly naam: string;
  /** De laatst aangezette van zijn Hue-groep: Hue zegt zelf niet welke er "aan" staat. */
  readonly actief: boolean;
  /**
   * De Hue-kamer of -zone waar hij bij hoort ("Tuinhuis overstek"), of null
   * voor een scène uit Home Assistant. Een lamp toont alleen de scènes van zijn
   * eigen groep: zo staan "Energie" van de border en van het tuinhuis niet
   * naast elkaar.
   */
  readonly groep: string | null;
  /** Wanneer hij voor het laatst aan ging; null als nooit. De lijst begint met de recentste. */
  readonly gebruiktMs: number | null;
  /** Zijn kleuren, zoals de lampen ze lieten zien, of die bij zijn naam; leeg als onbekend. */
  readonly kleuren: readonly string[];
  /** Een plaatje uit `scene-plaatjes/` als de bewoner dat heeft (scene-pictures.ts), anders null. */
  readonly plaatje: string | null;
  /** Zet hij alleen wit? Dan kan een lamp zonder kleur hem ook; anders niet (scene-colors.ts). */
  readonly wit: boolean;
}

export interface HouseFloor {
  readonly id: FloorId;
  readonly naam: string;
  readonly lampenAan: number;
  readonly samenvatting: HouseSummary;
  readonly ruimtes: readonly HouseRoom[];
}

export interface HouseReport {
  /** "eigen" als de bewoner de indeling vastlegde, anders "voorstel" uit Home Assistant. */
  readonly indeling: 'eigen' | 'voorstel';
  /** De etage onder het schuine dak (besluit 111), of null: dan geen schuin dak in de tekening. */
  readonly dakEtage: FloorId | null;
  /** Wat er rond het huis is, zoals de bewoner het zei (besluit 157); null: de buitenruimtes zeggen het. */
  readonly rond: LayoutAround | null;
  /** Waar de thuisaccu staat (besluit 270); null: aan de gevel. */
  readonly accu: LayoutAccu | null;
  /** Wat voor huis het is (besluit 190): vrijstaand als de bewoner niets koos. */
  readonly woning: Woning;
  /** Bij een appartement (20 november 2026): hoeveel verdiepingen van het gebouw eronder en erboven liggen; anders null. */
  readonly gebouw: { readonly onder: number; readonly boven: number } | null;
  /**
   * Hoe het huis ligt, voor de tekening (28 oktober 2026, besluit 205): waar
   * de voorgevel naartoe kijkt, hoe de nok loopt en hoe steil het dak is. Null
   * zolang de ligging niet bekend is; dan tekent de app het zoals eerst.
   */
  readonly ligging: HuisLigging | null;
  readonly etages: readonly HouseFloor[];
  readonly lampenAan: number;
  readonly samenvatting: HouseSummary;
  /**
   * Wat in geen kamer staat. Het huis kan het nergens tonen; de bewoner deelt
   * het in (95), met als voorstel het gebied uit Home Assistant als dat er is.
   */
  readonly zonderRuimte: readonly {
    readonly id: string;
    readonly naam: string;
    readonly soort: DeviceKind;
    readonly voorstel: string | null;
    /** De lampgroepen waar het in zit, zoals "Hal alles" of de Hue-kamer "Keuken". */
    readonly groepen: readonly string[];
    /** De kamer die bij een van die groepen lijkt te horen, of null. */
    readonly voorstelKamer: string | null;
    /** Een bijfunctie van een ander apparaat (20 november 2026), zie `HouseDevice.hoortBij`. */
    readonly hoortBij?: string;
    /** Bij een lamp: of hij aan staat, voor Apparaten › Licht (besluit 293). */
    readonly aan?: boolean;
    /** Een boiler of jacuzzi zonder kamer (besluit 315): de tekening geeft hem dan zelf een plek. */
    readonly warmte?: NonNullable<HouseDevice['warmte']>;
  }[];
  /**
   * De lampgroepen uit Home Assistant: groepen en Hue-kamers en -zones. Ze staan
   * niet als apparaat in het huis (dan telt een lamp dubbel), maar zeggen wel welke
   * lampen bij elkaar horen.
   */
  readonly lampgroepen: readonly {
    readonly id: string;
    readonly naam: string;
    readonly leden: readonly string[];
    readonly hue: boolean;
    /** Een groep die een heel gebied schakelt ("Etage 2 alles"), geen lamp. */
    readonly overzicht: boolean;
  }[];
  /** Wat de bewoner in de app niet wil zien (96), om terug te kunnen zetten. */
  readonly verborgen: readonly { readonly id: string; readonly naam: string; readonly soort: DeviceKind }[];
  /**
   * Lampen die in Home Assistant uitgezet of verborgen zijn en alleen nog in een
   * groep als "Etage 2 alles" zitten. Het huis kan ze nergens tonen; ze weer
   * aanzetten in Home Assistant, of in een eigen Hue-zone, maakt ze zichtbaar.
   */
  readonly onvindbaar: readonly { readonly id: string; readonly naam: string; readonly groepen: readonly string[] }[];
  /**
   * Elk apparaat met een batterij (besluit 122), de leegste eerst: de naam van
   * het apparaat, het percentage en de kamer waar het hoort, als die er is. Onder
   * de 10% meldt het startscherm het.
   */
  readonly batterijen: readonly HouseBattery[];
  /** Filters van airco's die bijna op zijn (onder de drempel, besluit 129), de leegste eerst. */
  readonly filters: readonly HouseBattery[];
  /**
   * Garagedeuren, poorten en deuren (besluit 206): alleen om te bekijken. Open
   * of dicht doet de app nooit (besluit 148); null is onbekend.
   */
  readonly toegang: readonly HouseToegang[];
  /** Onder welk percentage een batterij of filter een melding geeft (besluit 149); null is nooit. */
  readonly drempels: Drempels;
  /** De thuisbatterij en de auto, als het huis ze heeft (besluit 182). */
  readonly opslag: Opslag;
}

/** Wanneer een batterij of filter een melding geeft (besluit 149): onder dit percentage; null is nooit. */
export interface Drempels {
  readonly batterij: number | null;
  readonly filter: number | null;
}

export interface HouseBattery {
  /** Het apparaat in Home Assistant. */
  readonly id: string;
  readonly naam: string;
  readonly pct: number;
  /** De kamer in de indeling, met naam en id, of null. */
  readonly kamer: string | null;
  readonly kamerId: string | null;
  /** Onder de drempel (besluit 149): dan meldt de app het. */
  readonly leeg: boolean;
}

/** De stand van een apparaat als vaste code (besluit 185); de woorden staan in `WOORDEN`. */
export type StandCode =
  | 'geen-verbinding'
  | 'onbekend'
  | 'aan'
  | 'uit'
  // Een scherm; bij een zonnescherm is open uitgevouwen en dicht ingeklapt.
  | 'gaat-open'
  | 'gaat-dicht'
  | 'open'
  | 'dicht'
  | 'deels'
  | 'zonder-terugmelding'
  | 'na-opdracht'
  // Een klimaatapparaat uit de configuratie: de stand die Home Assistant heeft.
  | 'koelen'
  | 'verwarmen'
  | 'automatisch'
  | 'drogen'
  | 'ventileren'
  // Een radiatorknop: wat hij echt doet.
  | 'verwarmt'
  | 'koelt'
  | 'klaar'
  // Een uitstelbaar apparaat (besluit 98).
  | 'draait'
  | 'zou-starten'
  | 'klaargezet'
  | 'meldt-niets'
  // Een camera, een rookmelder, een meter.
  | 'live'
  | 'gevaar'
  | 'batterij'
  | 'goed'
  | 'meting'
  | 'geen-meting';

/** Wat een klimaatapparaat werkelijk doet (`hvac_action`), als vaste code. */
export type ActieCode = 'verwarmt' | 'verwarmt-voor' | 'koelt' | 'droogt' | 'ventileert' | 'stil' | 'uit';

/** Een slimme stekker die het huis kent (besluit 318): de naam uit Home Assistant, en de schakelaar. */
export interface HuisStekker {
  readonly id: string;
  readonly naam: string;
  /** De schakelaar van de stekker in Home Assistant. */
  readonly actuator: string;
  /** Het gebied in Home Assistant, voor een voorstel van de kamer. */
  readonly gebied: string | null;
}

/** Een garagedeur, poort of deur, alleen om te bekijken (besluit 206). */
export interface HouseToegang {
  readonly id: string;
  readonly naam: string;
  readonly open: boolean | null;
  /** De ruimte waar hij bij hoort, uit het gebied in Home Assistant. */
  readonly kamerId: string | null;
}

/** Hoe het huis ligt (besluit 205). */
export interface HuisLigging {
  readonly voorgevelDeg: number;
  readonly nok: 'langs' | 'haaks';
  /** De helling van het schuine dak, of null bij een plat dak of zonder panelen. */
  readonly hellingDeg: number | null;
  /** Een plat dak op het hoofdhuis (issue 131), zoals de bewoner het opgaf; dan tekent de app geen puntdak. */
  readonly plat?: boolean;
}
