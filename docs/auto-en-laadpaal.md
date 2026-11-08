# Auto en laadpaal: het bouwplan

Stand 6 november 2026. Het ontwerp is besloten ([besluit 259](../DECISIONS.md#259-auto-en-laadpaal-een-eigen-pagina-en-met-de-hand-laden-ontwerp));
alle zes stappen zijn gebouwd: 1 in 0.131.0, 2 in 0.132.0, 3 in 0.133.0, 4 in
0.135.0, 5 in 0.136.0 en 6 in 0.137.0 (zie "wat er gebouwd is"). Wat nog open
staat, staat onder "Nog open". Dit document is de overdracht: alles wat nodig is
om het in een nieuwe sessie op te pakken, zonder het gesprek van 6 november.

## Waarom

Auto en laadpaal is de functie waar testers het vaakst om vragen, en hoort bij
de kern van een energie-app. Het is stap 6 uit het plan van de testerronde.

- **Idee #123** (René, SA-XSNV): zelf kiezen welk apparaat uit Home Assistant
  de auto in de tekening is; de auto ook in de garage (nu alleen oprit of
  carport); later de thuisbatterij in de garage. Hem is gevraagd welke
  autokoppeling hij heeft; nog geen antwoord.
- **Melding #132** (BZBHL, dicht): de klimaatregeling van een Nissan MICRA
  (`climate`, koppeling `nissan_connect`) stond als klimaatapparaat in huis.
  Dat hoort niet: het klimaat van een auto is van de auto.

## De keuzes van de bewoner (6 november 2026)

Ronde 1, het plan:

1. **Bedienen met de hand**, zoals klimaat met de hand (besluit 235): de
   hoogste laadstroom in A en pauzeren, alleen als de laadpaal het kan, nooit
   boven wat de laadpaal en de hoofdzekering toestaan. Automatisch laden op
   zon komt pas in B (besluit 85). Met evcc in huis zet SunArc de stand van
   evcc, niet de laadpaal zelf.
2. **Plek:** bij Energie › Auto en laadpaal stel je in; een eigen pagina Auto
   is om te kijken en te bedienen.
3. **Meerdere** auto's en laadpalen, elk apart te koppelen.
4. **Extra's:** laadbeurten (kWh, kosten, deel eigen zon), advies bij zon en
   prijs (met de ruimte op de zekering), en meldingen. Niet gekozen: een
   overzicht voor de werkgever.

Ronde 2, na de schetsen:

5. **De auto zelf is de meter:** de tekening vult zich van achter naar voren
   tot de lading, met een streep bij de laadgrens.
6. **Geen eigen tab:** de pagina opent vanaf de Thuis-kaart van de auto en
   vanaf de auto bij Apparaten; in het menu licht Apparaten op.
7. **Hoe lang** bij Laden: 1 uur, tot een tijd, **tot een %** (los van de
   laadgrens in de auto, nooit erboven; daarna kiest de laadpaal weer zelf),
   en tot de kabel eruit gaat.
8. **Het advies** staat er alleen als het iets zegt, en krijgt **een eigen
   kaart op Thuis**, met één tik "Laad met 8 A".

## De schetsen

In `design/app2/`, met beelden in `screens/` (zie de README daar):

| Schets | Standen | Wat |
| --- | --- | --- |
| `Wand-Auto.html` | (zonder), `#hand`, `#beurten`, `#paal`, `#twee` | De pagina Auto op de wand: de auto als meter, de kabel, laadgrens en laadbeurt, het advies, het blad Laden |
| `Tel-Auto.html` | (zonder), `#laden` | Dezelfde pagina op de telefoon, Laden als blad van onderen |
| `Wand-Energie-Auto.html` | (zonder), `#evcc`, `#niets` | Energie › Auto en laadpaal |
| `Thuis-Tel-Auto-Advies.html` | (zonder), `#goedkoop`, `#niets` | De advieskaart op Thuis naast de kaart van de auto |
| `frontend/kit/auto-tekening.js` | | De tekening van de auto als meter; sinds stap 2 in de kit, voor schets en app samen |

De schets is de code (besluit 104): de app gebruikt dezelfde tekening.

Twee dingen om bij het bouwen recht te zetten: in de schets van Energie staat
"SunArc mag de Easee bedienen" onder de tab van de Model 3; dat hoort bij de
tab van de laadpaal. En de uitleg-alinea onder de schets van Thuis is uitleg
voor de bewoner bij de schets, geen tekst voor de app.

## Wat er nu al is

- `backend/src/web/opslag.ts` (besluit 182): herkent **één** auto en **één**
  laadpaal aan de koppeling (`AUTO_KOPPELING`, `LAADPAAL_KOPPELING`) en aan
  wat ze meten. Geeft `Auto { pct, aangesloten, laadt, vermogenW, bereikKm }`.
  Zonder auto in Home Assistant is de laadpaal de auto.
- `frontend/src/thuis.js` (de kaart `auto`, rond regel 700) en
  `frontend/src/apparaten.js` (de kaart van de auto, rond regel 293).
- `backend/src/web/house.ts` rond regel 1690: een buitenruimte is `oprit` of
  `carport` met een auto; de garage kent nog geen auto.
  `frontend/kit/huis.js` tekent de auto op de oprit of onder de carport.
- `backend/src/web/hand.ts`: klimaat met de hand, met een eindtijd en
  `handbediening.json`; wie intussen zelf iets verzette, wint. Het voorbeeld
  voor laden met de hand.
- `backend/src/adapters/homeassistant/client.ts`: schrijven is dicht, op een
  paar smalle deuren na (`isHandCall`, `isKnopCall`, `isStartCall`, ...). Laden
  wordt een nieuwe smalle deur.
- `backend/src/web/aansluiting.ts`: de zekering (fasen × A) en de
  stroommeters per fase; nodig voor de ruimte op de zekering.
- Energie heeft nu de delen Contract en prijzen, Daken en panelen, Aansluiting,
  Meters en Verwarming (`frontend/src/energie.js`, rond regel 128).

## Welke gegevens we willen

Herkennen per rol, niet per merk: Home Assistant heeft geen vaste soort voor
een auto of een laadpaal. Eerst op `device_class`, dan op koppeling en naam.

**De auto**

| Wat | Hoe te herkennen | Nodig voor |
| --- | --- | --- |
| Lading % | `sensor`, klasse `battery`, eenheid % | de meter |
| Bereik | `sensor`, klasse `distance`, naam range/bereik | de meter |
| Laadt ja/nee | `binary_sensor` klasse `battery_charging`, of de stand | de stand |
| Kabel erin | `binary_sensor` klasse `plug` | de stand |
| Laadgrens % | `number` of `sensor` met charge limit / target SoC | de streep, tot een % |
| Klaar om | `sensor` klasse `timestamp` of `duration` (charge end, remaining) | vol om |
| Thuis of weg | `device_tracker` van het apparaat (`home`) | onderweg |
| Kilometerstand | `sensor` klasse `distance`, naam odometer | later, kWh per 100 km |
| Klimaat | `climate` van het apparaat | **niet** als klimaat in huis (#132) |
| Accu in kWh | geeft bijna geen koppeling: de bewoner vult hem in | vol om |

**De laadpaal**

| Wat | Hoe te herkennen | Nodig voor |
| --- | --- | --- |
| Stand | `sensor` (enum) met status/state; woorden als charging, connected, awaiting, completed, error, disconnected | de stand, fouten |
| Vermogen nu | `sensor` klasse `power` | kW, laadbeurt |
| Stroom per fase | `sensor` klasse `current` (per fase) | A, fasen in gebruik |
| Energie deze sessie | `sensor` klasse `energy`, naam session/sessie | laadbeurt |
| Energie totaal | `sensor` klasse `energy`, `total_increasing` | laadbeurten uit de statistiek |
| Hoogste stroom | `number` in A (max/dynamic current, charging current) | **bedienen** |
| Laadmodus | `select` (bijvoorbeeld zappi, Peblar, Ohme, go-e) | later |
| Pauzeren | `switch` of `button` (charge, pause/resume) | **bedienen** |

**Per merk, uit kennis en niet getoetst.** Dit huis heeft geen auto of
laadpaal. Vóór het bouwen echte gegevens van testers verzamelen met de
deelknop bij Apparaten (besluit 250): vraag in de Facebookgroep wie een
laadpaal of elektrische auto in Home Assistant heeft.

- Stroom in A te zetten: Wallbox, Peblar, Ohme, OCPP, go-e, Easee (via een
  eigen dienst `easee.set_charger_dynamic_limit`), Zaptec (op de installatie),
  Alfen. Alleen lezen: Tesla Wall Connector.
- Een eigen zonnestand: zappi (Eco, Eco+), Peblar, go-e.
- Auto's: Tesla (Fleet, Teslemetry, Tessie) geeft veel, ook de laadstroom en
  de laadgrens; Kia/Hyundai, Volkswagen, Renault, BMW, Polestar, MG en
  Nissan geven lading, bereik, kabel en vaak de laadgrens.
- **evcc** (HACS): per laadpunt een stand (Uit, Zon, Zon en net, Snel), de
  lading, de laadgrens en het vermogen. Is evcc er, dan bedient SunArc evcc.

## Rekenregels

- **Stroom en vermogen:** W = A × 230 × fasen (3 × 6 A ≈ 4,1 kW, 3 × 8 A ≈
  5,5 kW).
- **Zon over voor de auto:** opgewekt min wat het huis zonder de auto
  gebruikt. "Op zon tot X A" is de hoogste stroom die daarin past.
- **Ruimte op de zekering:** de zekering per fase min de stroom van het huis
  zonder de auto, per fase gemeten; zonder stroommeters per fase niet tonen.
  Nooit een stroom aanbieden boven de laadpaal of boven die ruimte.
- **Vol om:** (laadgrens − lading) × accu in kWh / vermogen nu. Zonder accu
  in kWh of zonder lading: niet tonen, tenzij de auto zelf een eindtijd geeft.
- **Een laadbeurt:** van kabel erin tot kabel eruit (of van laden tot
  stoppen). Per kwartier: wat de auto nam, en welk deel daarvan zon over was;
  de rest kwam van het net. **Kosten** = het deel van het net × de prijs van
  dat moment (Contract en prijzen, bij een prijs per uur de prijs van dat
  uur). Eigen zon telt als gratis; zo staat het ook onder de lijst.
- **Goedkoopste uren:** alleen met een prijs per uur, uit de prijzen van
  morgen en vannacht (besluit 251).
- Bedragen alleen als ze uit eigen meters en prijzen kloppen (besluit 88).

## Bedienen: de smalle deur

Naar Home Assistant schrijft de app alleen door smalle deuren (besluit 15, de
lijst in `client.ts`). Laden wordt er een, naar het voorbeeld van `isHandCall`:

- alleen de laadpalen die de bewoner bij Energie aanzette voor bedienen;
- alleen de hoogste stroom (`number.set_value` op die ene entiteit, of de
  eigen dienst van het merk) binnen het bereik van de entiteit, en nooit boven
  de ruimte op de zekering; en pauzeren of hervatten;
- met evcc: alleen de stand van het laadpunt (`select`);
- altijd met een eindtijd (1 uur, tot een tijd, tot een %, tot de kabel
  eruit). Daarna terug naar de stand van vóór, maar alleen als die nog staat
  zoals de app hem zette: wie intussen zelf iets verzette, wint. Bewaren in
  een bestand naast `handbediening.json`, zodat een herstart het niet vergeet;
- de stroom gaat met de hand niet vanzelf omlaag bij een wolk; dat is B.

## Stap 1: wat er gebouwd is (0.131.0)

- `backend/src/web/opslag.ts`: `vindOpslag` geeft `autos` (en `auto`, de
  eerste, voor Thuis en Apparaten), met per auto `plek`, `accuKWh` en
  `laadpaal`. `ladenView` geeft Energie wat gevonden is, met per apparaat wat
  het meet (`wat`) en bij een laadpaal de stroom van tot (`stroomA`), de
  kandidaten om zelf te kiezen en de laadpunten van evcc (`evcc_intg`).
  `autoApparaten` is de lijst auto's voor melding 132. `leesLaden` leest wat
  de pagina stuurt.
- De keuzes staan in `aansluiting.json` onder `laden`: `aan` per apparaat (weg
  is aan), `rol` voor wat de bewoner zelf koos, en `instelling` per auto (of
  per laadpaal zonder auto): `accuKWh`, `laadpaal`, `plek`. Niet meegestuurd
  blijft zoals het was. Ze gaan meteen in, zonder herstart.
- Het huis leest de auto's in `main.ts` (`huisNu`) uit alle standen, met de
  keuzes; `buildHouse` zelf kent ze niet.
- Het klimaat en de meters van een auto staan niet meer in het huis
  (`house.ts`) en niet in het voorstel bij het inrichten (`discovery.ts`).
- De pagina: `frontend/src/laden.js`, als deel `auto` in `energie.js`. Het
  vinkje "SunArc mag de laadpaal bedienen" uit de schets komt pas in stap 5.
- De tekening: `huismodel.autosOpHunPlek` zet de auto in de garage, op de
  oprit of onder de carport; `huis.js` tekent een garage met de deur omhoog en
  de auto erin (`bouwAutoInGarage`). Zonder plek beslist de indeling, zoals
  eerst.

## Stap 2: wat er gebouwd is (0.132.0)

- `opslag.ts` geeft per auto ook `paalNaam`, `paalStroomA`, `laadgrens`,
  `stroomA` (per fase, gemeten; een grens zoals de dynamische stroom van een
  Easee telt niet), `volOm`, `thuis`, `kabelSinds` en `wegSinds`. `volOm` is
  de tijd van de auto zelf (een tijdstip, of een resterende duur zoals de
  "Charge Time" van NissanConnect uit melding 132), anders (grens − lading) ×
  accu / vermogen, op vijf minuten naar boven; zonder accu niet.
- De pagina: `frontend/src/auto.html` en `auto.js`, de tekening in
  `frontend/kit/auto-tekening.js` (de schetsen laden hem daarvandaan). Op zon
  of van het net volgt uit het net nu (`api/state`). Met meer auto's een keuze
  bovenaan; `auto.html#id` opent een bepaalde auto.
- De Thuis-kaart opent `auto.html` en tekent de auto als meter; de auto bij
  Apparaten opent `auto.html#id`. Elke tekening krijgt een eigen naam voor
  zijn verlopen (`naam`), want wand en telefoon staan op dezelfde pagina.
- Het voorbeeldhuis heeft een laadgrens van 90%, de stroom van de laadpaal op
  één fase, en de auto is 's avonds van half zeven tot negen weg.

## Stap 3: wat er gebouwd is (0.133.0)

- `backend/src/web/laadbeurten.ts`: per auto de laatste zeven dagen uit
  `recorder/statistics_during_period` per vijf minuten (`mean` in W), van de
  meter van het laadvermogen en van het net (afname min teruglevering). Home
  Assistant bewaart die vakken tien dagen. Vijf minuten bewaard per auto.
- Welke meter: `laadMeters()` in `opslag.ts`, dezelfde keuze als het
  vermogen op de pagina (van de laadpaal, anders een laadvermogen van de
  auto). Zonder meter geen kaart.
- Een beurt: vakken vanaf 150 W, met hooguit een uur pauze ertussen; korter
  dan 0,2 kWh telt niet. Eigen zon per vak = laadvermogen min wat het net
  leverde, tussen 0 en het laadvermogen (een thuisbatterij die de auto laadt,
  telt zo als eigen). Kosten = de rest × de prijs van dat moment: bij een
  dynamisch contract het uurgemiddelde van de prijs-entiteit (€/MWh wordt
  €/kWh), anders normaal of dal (`isDal`). Zonder netmeter geen zon en geen
  bedrag; een uur zonder prijs geeft die beurt geen bedrag.
- `GET api/laadbeurten?auto=id` geeft `{ beurten }`: de beurten (nieuwste
  eerst, `bezig` als het laatste vak van de laatste twintig minuten is), de
  som, `perUur` en `statistiek` (of Home Assistant het laadvermogen bewaart).
- De pagina: rechts onder de laadpaal de kaart Laadbeurten (samen, dan per
  beurt met een zonbalk); op de wand zoveel beurten als er passen, met "En n
  eerder", en Instellen als link bovenin. Tijdens het laden staat "Deze
  laadbeurt" onder de auto, in plaats van de accu.
- Het voorbeeldhuis laadt mee in zijn statistiek: vandaag op zon van elf tot
  half vijf, de dagen ervoor op zon, 's avonds en 's nachts (`laadWOp` in
  `nep-ha.ts`); het net neemt het laadvermogen mee af.

## Stap 4: wat er gebouwd is (0.135.0)

- `backend/src/web/laadadvies.ts`: per auto `zon` en `goedkoop`, elk null als
  het niets zegt. `GET api/laadadvies` geeft `{ adviezen }` op auto-id; de
  dienst rekent met het net en de stroom per fase uit het laatste besluit
  (`explanation.budget`, `explanation.phases`) en de prijzen per uur uit de
  attributen van de prijs-entiteit van Energie (`main.ts`, `laadadviezen`).
- **Zon:** `meer` als hij laadt en er gaat stroom terug: de hoogste stroom per
  fase die op zon past (wat hij neemt plus wat teruggaat, gedeeld door 230 ×
  fasen). `minder` als er stroom van het net komt en een lagere stroom (vanaf
  de laagste van de laadpaal) wel op zon past. `start` als de kabel erin zit,
  hij niet laadt en niet vol is, en de zon genoeg is voor de laagste stroom
  (zonder te laden telt de app de fasen die de laadpaal meet: de veilige
  kant). Nooit boven de laadpaal (zonder opgave 6 tot 16 A) en nooit boven de
  ruimte op de zekering: de zekering min de marge min wat er op de drukste
  fase loopt, alleen als elke fase gemeten is. Wat er overblijft op de
  zekering staat erbij (`overA`).
- Een thuisbatterij die de zon opneemt, gaat voor (besluit 85): wat naar de
  batterij gaat, is niet over. In het voorbeeldhuis is er daarom meestal geen
  zonadvies.
- **Goedkoop:** alleen met een prijs per uur. `prijzenVooruit` leest Nord
  Pool, ENTSO-e, EnergyZero, Frank Energie, Zonneplan, Amber en wat er zo
  uitziet (een lijst met tijd en prijs); kwartieren worden uren, en de schaal
  volgt uit de prijs van nu. Het goedkoopste aaneengesloten blok in de komende
  24 uur, zo lang als de auto nodig heeft tot zijn laadgrens met de hoogste
  stroom van de laadpaal (zonder accu drie uur, hooguit acht), en alleen als
  het minstens € 0,05 per kWh scheelt met nu en niet nu al begint. Tibber geeft
  geen lijst in zijn attributen; daar staat het advies er (nog) niet.
  `nietNodig` als hij nu op zon laadt en vóór dat blok vol is.
- De pagina Auto: het advies onder de auto (op de wand in twee kolommen,
  passend zonder scrollen). Thuis: een eigen kaart direct boven de kaart van
  de auto, alleen als die op Thuis staat; eerst de zon, anders de goedkope
  uren (niet als ze vandaag niet nodig zijn). Geen eigen keuze bij Kaart
  toevoegen: het advies hoort bij de kaart van de auto. "Laad met 8 A" komt
  in stap 5.
- De bewaking per fase uit de testerronde (stap 7, de schets van een kaart
  per fase) is nog niet gebouwd; het advies leest de fasen zelf.

## Stap 5: wat er gebouwd is (0.136.0, besluit 262)

- **Herkennen** (`opslag.ts`, `laadBedieningen`): per auto het apparaat met de
  knoppen, de laadpaal eerst en anders de auto. De stroom: een `number` in A,
  bij voorkeur met dynamic, charg, laad, current of amp in de naam en niet
  circuit, fase of min; onder 6 A begint het bij 6. Pauzeren: een `switch`
  met charg, laad, pause of resume (bij alleen "pause" is aan de pauze), of
  anders een paar knoppen (pause/stop en resume/start). Klimaat, klep, schema
  en herstart vallen af.
- **Mag het:** `bedienen` per apparaat in `aansluiting.json` onder `laden`
  (weg is nee); bij Energie de schakelaar "SunArc mag … bedienen" bij het
  apparaat dat het kan. Met evcc in huis nooit.
- **De dienst** (`laadhand.ts`, `Laadhand`): `zet` (stroom of pauze, met
  `tot` uur, tijd, pct of kabel), `terugNu`, en elke minuut `ronde`. Terug
  alleen wat nog staat zoals de app het zette; bij knoppen hervat hij als de
  auto niet laadt en de kabel erin zit. Bewaard in `laadhand.json`. De grens
  op de zekering komt uit `zekeringVoor` in `main.ts`.
- **De deur:** `isLaadCall` in `client.ts`, met `laadMag()` als lijst: wat mag,
  en wat er nog terug moet (ook onder 6 A, zoals het stond).
- **`api/laden`:** GET per auto `stroom`, `pauze`, `mag`, `evcc`,
  `zekeringA` en `actief`, met `aan: false` op de NAS; POST `{ auto, stroomA
  | pauze, tot, totMs?, pct? }` of `{ auto, terug: true }`. Voor de rol
  bewoner.
- **De pagina:** het blad Laden (de lagen van het blad bij Apparaten): de
  stroom met min en plus en een balk met wat op zon past en wat de zekering
  toelaat, hoe lang, wat erna gebeurt, Pauzeer of Terug naar de laadpaal, en
  Laad met n A. Op de telefoon een regel onder het advies; op de wand een rij
  in de kaart van de laadpaal (daar zonder vermogen en "kan", die staan bij de
  auto en in het blad; de wand scrolt nooit). `auto.html?laden#id` opent het
  blad meteen.
- **Laad met 8 A** bij het advies, op de pagina en op Thuis (met Meer keuzes),
  tot de kabel eruit gaat; niet bij "start" (dan laadt de auto niet, en zet
  een stroom hem niet aan).
- **Het voorbeeldhuis:** de laadpaal heeft `number.laadpaal_laadstroom` (6 tot
  16 A) en `switch.laadpaal_laden`, en laadt met die stroom; bedienen staat
  daar aan.
- **Easee (0.151.0, besluit 277):** geen getal maar de eigen dienst op het
  apparaat: `set_charger_dynamic_limit` met een levensduur tot het eind
  (hooguit 18 uur, daarna vernieuwd zolang het met de hand duurt) en
  `action_command` met `pause` of `resume`. De stroom van nu en de grens komen
  uit de sensoren `dynamic_charger_limit` en `max_charger_limit`, die Home
  Assistant standaard uit zet; zonder grens tot 32 A, zonder stroom van nu terug
  naar de grens.
- **evcc (0.152.0, besluit 278):** de keuzelijst met de stand van een laadpunt
  (`off`, `pv`, `minpv`, `now`, of `off`, `smart`, `now`), per laadpunt toe te
  laten bij Energie; met een eind en daarna terug naar de stand van daarvoor.
  Eén laadpunt hoort bij elke auto, bij meer het laadpunt met de naam van de
  auto of de laadpaal.
- **De balk van de dag (0.153.0, besluit 279):** `laaddag.ts` geeft per auto
  24 uur met de zon over (verwacht, in A per fase), de prijs, de goedkoopste
  uren en vol om; `main.ts` zet hem als `dag` bij het advies. Het blad tekent
  hem bij Hoe lang; een tik kiest Tot hh:00.
- **De assistent (0.154.0, besluit 280):** `laadzin.ts` maakt van een zin een
  stap voor `/api/laden` (stroom, snel, pauze, weer, terug; met evcc de stand),
  met een eind; alleen voor wat bij Energie toegelaten is. Stap 5 is daarmee af.

## Stap 6: wat er gebouwd is (0.137.0, besluit 263)

- **De bel** (`meldingen.ts`, `autoMeldingen`): soort `auto`, met per auto
  `AutoBel` uit `main.ts` (`autoBel`): lading, laadgrens, kabel, thuis, de
  fout van de laadpaal (`Auto.fout` in `opslag.ts`: een stand met error,
  fault, fout of storing), sinds wanneer de kabel erin zit, en kabel vergeten
  als minuut van de dag en %. De klok van het huis gaat mee (`minuut`, `dag`,
  `gisteren`).
- **Vol:** `auto-vol:<auto>:<kabel erin sinds>`, zolang de kabel erin zit en
  hij op de laadgrens (of 100%) staat. **Fout:** `auto-fout:<auto>:<…>`.
  **Kabel vergeten:** `auto-kabel:<auto>:<avond>`, van de tijd tot zes uur,
  thuis, zonder kabel en onder het %. **Met de hand klaar:**
  `auto-hand:<auto>:<ms>`, een half uur, uit `Laadhand.klaar` (alleen op de
  tijd of het %, niet als de kabel eruit ging).
- **De keuze:** `kabel: { om, pct }` per auto onder `laden.instelling` in
  `aansluiting.json`; weg is 21:00 en 50%, `pct` null is uit. Bij Energie bij
  een auto die zijn lading meet: Uit, Onder 30/50/70% en de tijd.
- **De telefoon** (`push.ts`): groep `auto`, standaard aan, niet dringend
  (dus niet in de nachtrust); een bewaarde keuze zonder `auto` telt als aan.
  Bij Jij › Meldingen op de telefoon de regel De auto.
- In het voorbeeldhuis komt rond half vijf "Elektrische auto is vol".

## De stappen, elk een eigen versie

1. **Kiezen en herkennen.** `opslag.ts` naar lijsten van auto's en laadpalen,
   met de rollen van hierboven en evcc. Energie › Auto en laadpaal: wat
   gevonden is met een schakelaar, een ander apparaat kiezen, per auto de accu
   in kWh, aan welke laadpaal hij laadt en de plek (oprit, carport, garage).
   De garage krijgt een auto in `house.ts` en `huis.js` (#123). Het klimaat van
   een auto telt niet meer als klimaat in huis (#132). Bewaren bij de
   antwoorden (`aansluiting.json`), zoals de daken.
2. **De pagina Auto (kijken).** `frontend/src/auto.html` en `auto.js`, de
   tekening naar `frontend/kit/`. Per auto: lading, laden, kW, A per fase,
   kabel, bereik, laadgrens, vol om, onderweg. De Thuis-kaart en Apparaten
   openen de pagina; de Thuis-kaart toont de auto als meter.
3. **Laadbeurten.** Uit de statistiek van Home Assistant (de energie van de
   laadpaal, het net, de zon), per beurt kWh, kosten en deel eigen zon; deze
   week en de som.
4. **Advies.** Zon over en de goedkoopste uren onder de auto, alleen als het
   iets zegt, met de ruimte op de zekering; de eigen advieskaart op Thuis.
   Loopt samen met stap 7 van de testerronde (bewaking per fase).
5. **Met de hand.** Het blad Laden en de smalle deur van hierboven; "Laad met
   8 A" op de advieskaart. Een aanvulling op de schrijfgrens, dus een eigen
   besluit bij het bouwen.
6. **Meldingen.** Auto vol, laden gestopt met een fout, kabel vergeten. Voor
   "kabel vergeten" is een vertrektijd nodig: eerst vragen waar die vandaan komt.

Daarna, in B: automatisch laden op zon, binnen de volgorde van besluit 85
(comfort, dan de batterij, dan de auto).

## Nog open

- Echte gegevens van testers per merk (zie hierboven).
- René (#123): welke autokoppeling.
- Een vertrektijd (uit de auto of de agenda) voor kabel vergeten: gekozen is
  een vaste avondcheck (besluit 263); later eventueel erbij.
- Een auto die aan meer laadpalen laadt, en een laadpaal met twee punten.
- Laders op één fase, en wisselen tussen één en drie fasen.
- De Engelse teksten (de app is tweetalig, besluit 185).

## Werkwijze bij het bouwen

- Eerst `git fetch` en beta bijwerken: er werken soms meer sessies tegelijk.
- Elke stap is een versie: `VERSIE` en een regel bovenaan `NIEUW` in
  `backend/src/version.ts`, hetzelfde nummer in `backend/` en `frontend/`
  `package.json` en `package-lock.json` en in `addon/config.yaml`. Vóór elke
  versie de issues op GitHub nalopen; lost een versie een melding op, dan de
  meldcode meegeven (besluit 250).
- Vóór elke push in `backend/`: `npm run typecheck`, `npm run lint` en
  `TZ=UTC npx vitest run`; raakt het `frontend/`, dan eerst daar bouwen en de
  paginatest draaien. Na een nieuw besluit `npm run decisions:index`.
- Werk op beta; naar main gaat het via een PR die de bewoner samenvoegt. Bij
  een PR naar main de versie in `OP_MAIN` en `npm run changelog` (besluit 258).
- Teksten kort en gewoon, geen ik-vorm; altijd "verwarmen", nooit het kale
  werkwoord zonder "ver-" (de test in `teksten.test.ts`); weinig bubbels:
  segmentbalk, regel met waarde, schakelaar.
