# Thuisaccu: wat werkt, wat mist, wat de testers vragen

Onderzoek van 7 november 2026, op beta (0.144.2). Ricardo koos daarna alle
voorstellen; gebouwd in 0.145.0 tot 0.150.0, besluiten 271 tot 276 in
`DECISIONS.md`. Hieronder het onderzoek zoals het was.

## In het kort

- SunArc **ziet** één thuisaccu als die herkenbaar is (merk, koppeling of de klasse
  `energy_storage`), en toont hoe vol hij is en of hij laadt of levert: een kaart op
  Thuis en bij Apparaten, en sinds 0.144.0 een kast in de tekening op de plek die je
  kiest.
- Een accu die **niet herkend** wordt, zoals de drie Marstek-accu's van #145 via Homey,
  is nergens te kiezen. Er is geen plek om hem aan te wijzen, ook niet met de hand in
  `aansluiting.json`.
- Verder telt de accu **nergens mee**: niet in de stromen, niet in Opbrengst, niet in de
  regeling. Met een accu kloppen het verbruik per uur, de zon per apparaat en het
  sluipverbruik niet. De kosten van het net kloppen wel.

## De issues

| Issue | Tester | Wat hij wil | Merk en koppeling | Sensoren |
|---|---|---|---|---|
| [#145](https://github.com/Ricardo-switch/SunArc/issues/145), open, nog geen reactie | Jackeelman (6-11, 0.130.0) | De accu met de hand aanwijzen bij Inrichten, met losse sensoren. Of weten welke velden in `aansluiting.json` horen. | 3 × Marstek Venus E, gestuurd vanuit Homey met de app Laadplan Controller. Ze komen via de Homey-koppeling binnen als één apparaat "Laadplan Controller". | `sensor.laadplan_controller_battery` (lading, %), `sensor.laadplan_controller_power` (W, negatief is ontladen), `sensor.laadplan_controller_charged_energy` en `…_discharged_energy` (kWh, totaal geladen en ontladen) |
| [#123](https://github.com/Ricardo-switch/SunArc/issues/123), open | René (renevandijk86-cyber, 4-11) | Apparaten aan de auto en de garage hangen, en "in de toekomst mijn thuisbatterij daar plaatsen". | Merk onbekend; ook welke koppeling hij voor de auto heeft, is nog niet beantwoord (drie keer gevraagd). | Onbekend |
| [#132](https://github.com/Ricardo-switch/SunArc/issues/132), dicht | BZBHL | Ging over de klimaatregeling van een auto, niet over een thuisaccu. | — | — |
| [#128](https://github.com/Ricardo-switch/SunArc/issues/128), open | — | Over prijzen; Ricardo schreef daar dat "batterijen" op de planning staan. | — | — |

Op batterij, Sessy, Powerwall, opslag en storage zijn geen andere issues. De ideeën
[#135](https://github.com/Ricardo-switch/SunArc/issues/135) (live stroom op Thuis) en
[#137](https://github.com/Ricardo-switch/SunArc/issues/137) (zon over verdelen) gaan
niet over een accu, maar raken hem wel: zie hieronder.

**Waarom #145 niet herkend wordt.** Een thuisaccu moet een lading in procenten hebben
én de klasse `energy_storage`, of een koppeling uit de lijst, of een merk of type als
"battery", "accu", "Venus" in de naam van het apparaat
([opslag.ts:288-290](../backend/src/web/opslag.ts:288)). "Laadplan Controller" van de
koppeling Homey heeft geen van drieën: geen `energy_storage`, Homey staat niet in
`BATTERIJ_KOPPELING` ([opslag.ts:197](../backend/src/web/opslag.ts:197)) en de naam
zegt niets. Gevolg:

- hij staat niet op Thuis, niet bij Apparaten, niet in de tekening, en de keuze
  "Waar staat je accu?" bij Buiten verschijnt niet;
- hij staat wél als kandidaat in de keuzelijst bij Energie › Auto en laadpaal, omdat hij
  een lading, vermogen en energie meet ([opslag.ts:219](../backend/src/web/opslag.ts:219),
  [:622](../backend/src/web/opslag.ts:622)). Kiest hij hem daar, dan wordt zijn accu een
  auto;
- werd hij wel herkend, dan klopte het teken toevallig: negatief is ontladen, zoals
  SunArc het ook rekent, en "laadplan" in de naam past op het patroon voor een
  laadvermogen ([opslag.ts:405-415](../backend/src/web/opslag.ts:405));
- de kWh geladen en ontladen gebruikt SunArc nergens;
- drie accu's onder één apparaat is voor hem geen probleem: het is één lading en één
  vermogen.

## Wat er werkt

**Herkennen en lezen** ([backend/src/web/opslag.ts](../backend/src/web/opslag.ts))

- Wat een thuisaccu is: lading in % plus `energy_storage`, of een koppeling (Powerwall,
  Sessy, Marstek, Zendure, Victron, Huawei, SolarEdge, …), of een type in de naam
  (batterij, accu, Luna, Venus, Solarbank, …); nooit een auto, laadpaal of evcc
  ([:197-198](../backend/src/web/opslag.ts:197), [:288-290](../backend/src/web/opslag.ts:288)).
- Wat je als auto of laadpaal koos, is geen accu ([:399-400](../backend/src/web/opslag.ts:399)).
- Het vermogen: eerst een sensor met batterij/accu/laad in de naam; een laad- en een
  ontlaadsensor samen worden laden min ontladen; anders de enige vermogenssensor.
  Powerwall en EcoFlow tellen omgekeerd (`LEVEREN_POSITIEF`,
  [:200](../backend/src/web/opslag.ts:200), [:403-415](../backend/src/web/opslag.ts:403)).
- De stand: laadt, levert of rust, met 40 W als grens voor ruis
  ([:202](../backend/src/web/opslag.ts:202), [:416](../backend/src/web/opslag.ts:416)).
- Wat het huis doorgeeft: één `batterij` met naam, lading, vermogen en stand
  ([:38-46](../backend/src/web/opslag.ts:38), [:93-94](../backend/src/web/opslag.ts:93)),
  in `api/huis` ([house.ts:2125](../backend/src/web/house.ts:2125),
  [main.ts:1725](../backend/src/main.ts:1725)).
- Een thuisaccu staat niet in de lijst kleine batterijen bij Onderhoud
  ([house.ts:441-443](../backend/src/web/house.ts:441)).

**Kaarten**

- Thuis: een kaart met lading, laadt/levert/rust en kW, smal als tegel met een staaf
  ([thuis.js:799-804](../frontend/src/thuis.js:799)); kiesbaar op telefoon en wand.
- Apparaten: een eigen kaart, "kW naar huis" bij leveren, en de zin dat SunArc alleen
  kijkt ([apparaten.js:341-365](../frontend/src/apparaten.js:341),
  [:479](../frontend/src/apparaten.js:479)).
- Het blad van de garage toont de accu als hij daar staat
  ([buitenblad.js:75-80](../frontend/src/buitenblad.js:75), [:101](../frontend/src/buitenblad.js:101)).

**De tekening** (besluit 270)

- De plek staat in de indeling als `accu`: gevel, garage of binnen met de kamer
  ([layout.ts:125](../backend/src/web/layout.ts:125), [:229](../backend/src/web/layout.ts:229),
  [:511-520](../backend/src/web/layout.ts:511)); te kiezen bij Kamers en indeling ›
  Buiten, alleen als er een accu is ([indeling.js:457-464](../frontend/src/indeling.js:457),
  [:1256-1261](../frontend/src/indeling.js:1256)).
- Het model zet hem in de kamer of buiten, met hoe vol
  ([huismodel.js:372-383](../frontend/src/huismodel.js:372), [:423](../frontend/src/huismodel.js:423));
  de tekening bouwt hem aan de gevel, in de garage of als kast binnen
  ([kit/huis.js:725](../frontend/kit/huis.js:725), [:1779-1785](../frontend/kit/huis.js:1779),
  [:2159](../frontend/kit/huis.js:2159)).
- De tekening **kan** al stromen van en naar de accu trekken, in ijsblauw
  ([kit/huis.js:1250-1251](../frontend/kit/huis.js:1250), [:1287](../frontend/kit/huis.js:1287),
  [:1303](../frontend/kit/huis.js:1303)), maar niemand geeft ze door (zie hieronder).

**Wat je huis kan** (besluit 230)

- Zonder accu: het afgelopen jaar per uur nagerekend uit de meters van het net, welke
  maat past (2,5 tot 20 kWh), wat hij oplevert en wanneer hij bijsprong
  ([accu.ts](../backend/src/web/accu.ts), `api/accu`,
  [routes/opbrengst.ts:82-102](../backend/src/web/routes/opbrengst.ts:82)).
- Met een herkende accu: "kijkt mee" met de lading, en geen "Batterij nodig" meer
  ([stand.js:295-296](../frontend/src/stand.js:295), [:369-371](../frontend/src/stand.js:369)).

**Het voorbeeldhuis**

- Een Sessy in de hal met lading en vermogen ([voorbeeld/huis.ts:200](../backend/src/voorbeeld/huis.ts:200),
  [:383-385](../backend/src/voorbeeld/huis.ts:383)); overdag laadt hij met wat over is, 's avonds
  voedt hij het huis ([voorbeeld/dag.ts:109-110](../backend/src/voorbeeld/dag.ts:109)); het net
  rekent hem mee ([voorbeeld/huis.ts:408-409](../backend/src/voorbeeld/huis.ts:408)).

**De auto ernaast**: het laadadvies weet dat wat naar de accu gaat niet over is
([docs/auto-en-laadpaal.md:261-263](auto-en-laadpaal.md)). Dat komt vanzelf: de netmeter
ziet dan minder terug.

## Wat er mist, van belangrijk naar minder belangrijk

1. **Zelf een accu aanwijzen, ook uit losse sensoren.** Er is geen plek voor, en geen
   veld in `aansluiting.json`. Bij de auto kan het wel (Energie › Auto en laadpaal,
   besluit 259). Nodig: een apparaat kiezen, en per rol de sensor: lading, vermogen, of
   negatief laden of ontladen is, en de kWh geladen en ontladen. Zonder dit werkt niets
   anders voor deze tester.
   *Vraagt erom:* Jackeelman (#145), met die woorden. Ook elke accu van een merk dat
   niet in de lijst staat.

2. **De cijfers kloppen niet met een accu.** SunArc rekent verbruik als zon plus net
   ([resident.ts:383](../backend/src/web/resident.ts:383)) en zelf gebruikt als opgewekt
   min terug ([yield.ts:12-13](../backend/src/web/yield.ts:12)). Met een accu:
   - wat overdag in de accu gaat, telt als verbruik; wat hij 's avonds levert, telt
     nergens;
   - per uur is het verbruik overdag te hoog en 's avonds te laag; 's avonds verbruiken
     de apparaten meer dan het "huis", dus de rest en de zon per apparaat zijn fout;
   - Altijd aan en het sluipverbruik: 's nachts voedt de accu het huis en ziet de meter
     bijna niets (al genoemd bij besluit 192, wat afviel);
   - de accu die je in het Energie-dashboard van Home Assistant instelt, slaat SunArc
     over: alleen het net, de zon en gas worden gelezen
     ([energy.ts:207-245](../backend/src/web/energy.ts:207)).

   Wat wel klopt: wat het net kostte en opbracht, want dat meet de netmeter.
   *Vraagt erom:* niemand met zoveel woorden, maar Jackeelman heeft drie accu's en ziet
   dit zodra stap 1 er is. Opbrengst › Nu ([#135](https://github.com/Ricardo-switch/SunArc/issues/135))
   wordt met een accu misleidend.

3. **De stromen van en naar de accu tekenen.** Thuis geeft alleen zon › huis, zon › net
   en net › huis door ([thuis.js:80-84](../frontend/src/thuis.js:80)); het stroombeeld
   bij Opbrengst kent geen accu ([opbrengst.js:429-435](../frontend/src/opbrengst.js:429)).
   De tekening kan het al aan de gevel en in de garage; voor een accu binnen loopt de
   lijn nog naar de gevel. Bewust uitgesteld in besluit 270.
   *Vraagt erom:* René (#123) wil de accu in zijn garage zien; het idee live stroom
   (#135).

4. **De regeling ziet de accu niet.** Laadt de accu met zon, dan ziet de netmeter niets
   terug, en denkt de regeling dat er geen zon over is. In de praktijk gaat de accu dus
   vóór koelen of opwarmen op zon. Besluit 85 zegt het andersom: eerst comfort, dan de
   accu. Er is in de regeling geen enkele regel over een accu (`backend/src/core` en
   `config` kennen hem niet), en wat besluit 85 belooft (doorgeven aan evcc en Predbat
   hoeveel er over is) is niet gebouwd.
   *Vraagt erom:* niemand direct; hangt samen met zon over verdelen (#137).

5. **Meer dan één accu.** Het huis kent er één; de eerste die past, telt
   ([opslag.ts:94](../backend/src/web/opslag.ts:94), [:400](../backend/src/web/opslag.ts:400)).
   Twee Sessy's of een Zendure naast een Marstek: de tweede valt weg.
   *Vraagt erom:* niemand nog. Jackeelman heeft er drie, maar onder één apparaat.

6. **De maat in kWh.** Zonder maat geen "vol om 15:40", "leeg om 23:10" of "nog 6 kWh".
   Weinig koppelingen geven hem; bij de auto vul je hem in (5 tot 250 kWh).
   *Vraagt erom:* niemand nog.

7. **Wat de accu opleverde.** Met kWh geladen en ontladen (die Jackeelman heeft) kan
   SunArc zeggen hoeveel hij per maand van het net scheelde, en hoeveel verlies hij had.
   Nu zegt Wat je huis kan alleen "kijkt mee".
   *Vraagt erom:* indirect de bewoner van besluit 230 (een maat en waar hij bijsprong).

8. **Meldingen.** Geen melding voor een accu: niet als hij niets meer zegt, niet bij een
   fout, niet als hij overdag vol is en de zon toch naar het net gaat
   (`MeldingSoort`, [meldingen.ts:38](../backend/src/web/meldingen.ts:38)).
   *Vraagt erom:* niemand.

9. **Sturen.** SunArc stuurt geen accu (besluit 85, 182; hoort bij stap B en de
   schrijfgrens). Jackeelman stuurt zijn accu's al met Homey; SunArc moet daar niet
   tussen komen.
   *Vraagt erom:* niemand.

## Voorstel voor de volgorde

1. **Zelf kiezen** (punt 1): een blok Thuisaccu bij Energie, net als Auto en laadpaal:
   wat gevonden is met een schakelaar, een ander apparaat kiezen, en per accu de
   sensoren en de maat. Bewaard in `aansluiting.json`. Daarmee is #145 op te lossen en
   René kan zijn merk kiezen als het niet herkend wordt.
2. **De accu in de cijfers** (punt 2): het vermogen van de accu meerekenen in de live
   stromen (verbruik is zon plus net min wat de accu laadt plus wat hij levert), en
   in Opbrengst per uur, uit de accu in het Energie-dashboard of de gekozen sensoren.
3. **De stromen tekenen** (punt 3): zon › accu en accu › huis op Thuis en in het
   stroombeeld van Opbrengst, met de lijn naar de kamer als hij binnen staat.
4. **De regeling laten kijken** (punt 4): wat de accu laadt, telt mee als zon over voor
   comfort, eerst in de schaduw.
5. **Meer accu's, de maat en wat hij opleverde** (punten 5 tot 7), samen in één versie.
6. **Meldingen** (punt 8). Sturen (punt 9) pas in stap B.

Daarna de reacties: Jackeelman uitleggen wat er kan, René vragen welk merk het wordt.

## Keuzes voor Ricardo

1. **Waar kies je de accu?**
   - a. Een eigen blok Energie › Thuisaccu, naast Auto en laadpaal *(voorstel)*
   - b. In Energie › Auto en laadpaal als derde soort (auto, laadpaal, accu)
   - c. Bij Inrichten, in de wizard
2. **Hoe wijs je een accu uit losse sensoren aan?**
   - a. Eerst het apparaat kiezen, dan per rol de sensor, met een keuze voor het teken
     van het vermogen *(voorstel)*
   - b. Alleen de sensoren kiezen, los van een apparaat
   - c. Alleen het apparaat; SunArc zoekt de sensoren zelf
3. **Waar komen de accu-cijfers in Opbrengst vandaan?**
   - a. Eerst de accu in het Energie-dashboard van Home Assistant, anders de gekozen
     sensoren *(voorstel)*
   - b. Alleen de gekozen sensoren
   - c. Alleen het Energie-dashboard
4. **Wat doet de regeling als de accu met zon laadt?**
   - a. Dat telt als zon over voor comfort, eerst in de schaduw (zoals besluit 85)
     *(voorstel)*
   - b. Niets; de accu gaat voor, zoals nu
   - c. De bewoner kiest het, bij Comfort › Voorrang
5. **Meer dan één accu?**
   - a. Nu meteen, met één kaart voor samen en per accu een regel *(voorstel)*
   - b. Later, eerst één goed
   - c. Elke accu een eigen kaart
6. **De maat in kWh?**
   - a. Invullen, zoals bij de auto *(voorstel)*
   - b. Leren uit geladen en ontladen
   - c. Niet nodig
7. **Wat zeggen we nu al tegen Jackeelman (#145)?**
   - a. Dat het in de volgende ronde komt, en vragen of de lading het gemiddelde is van
     de drie accu's *(voorstel)*
   - b. Wachten tot het er is
