# Wat is er nieuw · What is new

## 0.164.0

*11 november 2026 · 0.163.0 – 0.164.0*

**Beter**

- Een slimme stekker heeft bij Regeling › Op zon nog één schakelaar: op zon betekent dat SunArc hem echt aan- en uitzet
- Met de hand schakelen sta je toe in het blad van de stekker zelf, met Toestaan, en daar kan het ook weer weg
- Op zon aan- of uitzetten gaat meteen in, zonder SunArc opnieuw te starten
- Kamers en indeling werkt weer zoals je gewend bent. Je huis, met het huisontwerp, de etages en de kamers als vakken, komt later terug

**Opgelost**

- Een stekker die je van zon haalde, zei nog "Wacht op zon" tot SunArc opnieuw startte
- Bij een stekker of boiler stond "0.8 kW" met een punt in plaats van een komma

*English*

**Improved**

- A smart plug has one switch left in Control › On solar: on solar means SunArc really switches it on and off
- You allow switching by hand in the plug sheet itself, with Allow, and you can take it back there too
- Putting something on solar, or taking it off, works straight away, without restarting SunArc
- Rooms and layout works as you are used to again. Your home, with the house design, the floors and the rooms as boxes, will come back later

**Fixed**

- A plug you took off solar still said "Waiting for sun" until SunArc restarted
- A plug or boiler showed "0.8 kW" with a point instead of a comma in Dutch

## 0.157.1

*8 november 2026 · 0.156.2 – 0.157.1*

**Nieuw**

- De stand van het huis zegt wat er meespeelt: de airco springt bij, iets gaat met de hand, niemand is thuis, vakantie, of het is nog Dag omdat er licht brandt. Op de wand in de knop rechtsboven, op de telefoon naast de begroeting
- Het blad van de stand toont de dag als balk met de dagdelen en hun temperatuur, en alles wat er nu meespeelt

**Beter**

- Zet "Handmatig koelen" in Home Assistant het huis op Handmatig, dan zegt de stand dat, met sinds wanneer
- Bij vakantie zegt de stand sinds wanneer
- Een scène in een vaste taak zegt nu in welke kamer hij hoort, en bij Aanpassen welke lampen hij zet

**Opgelost**

- Kiest Home Assistant de stand Voorverwarmen, dan zegt Thuis dat nu ook, in plaats van Automatisch

*English*

**New**

- The mode of the house says what plays a part: the air conditioner helps out, something runs by hand, nobody is home, holiday, or it is still Day because a light is on. On the wall in the button at the top right, on the phone next to the greeting
- The mode sheet shows the day as a bar with the parts of the day and their temperature, and everything that plays a part now

**Improved**

- If "Handmatig koelen" (cooling by hand) in Home Assistant sets the house to Manual, the mode now says so, with since when
- On holiday the mode says since when
- A scene in a fixed task now says which room it belongs to, and under Edit which lights it sets

**Fixed**

- If Home Assistant picks the Preheat mode, Home now says so too, instead of Automatic

## 0.156.1

*8 november 2026 · 0.151.0 – 0.156.1*

**Nieuw**

- Bij Regeling › Klimaat kies je per kamer of de airco bijspringt als de verwarming het niet bijhoudt, en wanneer: na hoeveel minuten stoken en vanaf hoeveel graden te koud
- Voorverwarmen heeft een eigen temperatuur per kamer, bij Comfort › Dagdelen. Tot je er een kiest, wordt het net zo warm als overdag
- Laden met de hand kan ook met een zin tegen de assistent: "laad de auto met 10 ampère tot zes uur", "pauzeer het laden", "laad weer" of "laat de laadpaal zelf kiezen". Met evcc: "laad snel" of "laad op zon". Alleen als het bij Energie › Auto en laadpaal is toegelaten
- In het blad Laden zie je de komende 24 uur: de zon die naar verwachting over is, de prijs per uur met de goedkoopste uren, tot wanneer je met de hand laadt, en wanneer de auto op zijn laadgrens is. Tik op de balk om tot een andere tijd te kiezen
- Met evcc in huis zet je de stand van evcc met de hand: Uit, Zon, Min + zon of Snel, tot een tijd, een % of tot de kabel eruit gaat. Daarna staat evcc weer zoals daarvoor
- Bij Energie › Auto en laadpaal kies je per laadpunt van evcc of SunArc de stand mag zetten
- Een laadpaal van Easee bedien je nu ook met de hand: de laadstroom, of pauzeren, altijd met een eind. Valt SunArc stil, dan gaat de laadpaal op het eind vanzelf terug

**Beter**

- Tijdens voorverwarmen in de ochtend springt de airco niet meer bij, zodat zijn piepje niemand wakker maakt. Voorverwarmen doet dan alleen de ketel; overdag helpt de airco weer mee
- Zet je in Home Assistant bij je Easee de sensor voor de dynamische laadstroom aan (die staat standaard uit), dan zie je ook op welke stroom hij nu staat

**Opgelost**

- Bij Opbrengst staan de airco's en slimme stekkers met een eigen meter nu ook bij Dag, Week en Maand in het stroombeeld, niet alleen bij Jaar
- Bij Jaar staan de bedragen in hele euro's, zodat ze in hun vak passen

*English*

**New**

- In Control › Climate you choose per room whether the air conditioner helps out when the heating falls behind, and when: after how many minutes of heating and from how many degrees too cold
- Preheating has its own temperature per room, in Comfort › Times of day. Until you choose one, it gets as warm as during the day
- Charging by hand also works with a sentence to the assistant: "charge the car at 10 amps until six", "pause charging", "resume charging" or "let the charger decide". With evcc: "charge fast" or "charge on solar". Only when allowed in Energy › Car and charger
- The Charging sheet shows the next 24 hours: the sun expected to be spare, the price per hour with the cheapest hours, until when you charge by hand, and when the car reaches its charge limit. Tap the bar to choose another time
- With evcc in your home you set the evcc mode by hand: Off, Solar, Min + solar or Fast, until a time, a % or until the cable comes out. After that evcc is back as it was
- In Energy › Car and charger you choose per evcc charge point whether SunArc may set the mode
- You can now control an Easee charger by hand too: the charging current, or pause, always with an end. If SunArc stops, the charger goes back by itself at the end

**Improved**

- During preheating in the morning the air conditioner no longer helps out, so its beep wakes no one. The boiler preheats on its own; during the day the air conditioner helps again
- If you turn on the sensor for the dynamic charging current of your Easee in Home Assistant (it is off by default), you also see what current it is set to now

**Fixed**

- In Energy the air conditioners and smart plugs with their own meter now also show in the flow diagram for Day, Week and Month, not only for Year
- For Year the amounts are in whole euros, so they fit in their box

## 0.150.0

*7 november 2026 · 0.145.0 – 0.150.0*

**Nieuw**

- Meldingen over je thuisaccu: als hij een half uur niets meer zegt, als hij een fout meldt, en als hij vol is terwijl de zon naar het net gaat. Op je telefoon komen ze overdag, als je Onderhoud aan hebt bij Jij
- Meer dan één thuisaccu: ze staan samen op één kaart, met per accu een regel met hoe vol hij is en wat hij doet
- Bij Energie › Thuisaccu vul je de maat van je accu in. Dan zie je hoeveel kWh erin zit, hoe laat hij vol is als hij laadt, en hoe lang hij het huis nog voedt als hij levert
- Bij Wat je huis kan staat wat je accu deze maand aan het huis leverde, en wat dat vanaf 2027 ongeveer waard is
- Laadt je thuisaccu met zon, dan rekent SunArc ernaast uit wat hij zou doen als die zon over was, zoals een airco op zon of de droger. Bij Apparaten staat het bij je accu. Alleen ter vergelijking: er verandert niets aan wat SunArc doet
- Op Thuis loopt nu een lijn naar je thuisaccu als hij laadt, en eruit naar het huis als hij levert, met erbij hoeveel. Ook als de accu binnen in een kamer staat
- Bij Opbrengst › Nu staat je thuisaccu in Waar je stroom nu heen gaat: Naar de accu als hij laadt, Uit de accu als hij levert
- Opbrengst rekent je thuisaccu mee: onder je panelen staat wat hij laadde, waarvan uit de zon, en wat hij aan het huis leverde. In Waar je stroom heen ging staan Uit de accu en Naar de accu
- Bij Energie staat nu Thuisaccu. Je ziet welke accu SunArc vond, en je kiest er zelf een als hij er niet bij staat, ook als hij via Homey binnenkomt met losse sensoren
- Per accu kies je welke sensor zegt hoe vol hij is, wat hij nu laadt of levert, en hoeveel hij in totaal laadde en leverde. Je kiest ook of plus laden of leveren is, en ziet meteen wat de accu nu doet

**Beter**

- Een thuisaccu die even niets zegt, blijft in beeld in plaats van te verdwijnen

**Opgelost**

- Met een thuisaccu klopte het verbruik niet: wat de accu laadde telde als verbruik, en wat hij leverde telde nergens. Nu klopt het verbruik van nu, per uur en per apparaat

*English*

**New**

- Notifications about your home battery: when it has said nothing for half an hour, when it reports a fault, and when it is full while the sun goes to the grid. On your phone they arrive during the day, if you have Maintenance on in You
- More than one home battery: they share one card, with a line per battery for how full it is and what it does
- In Energy › Home battery you fill in the size of your battery. Then you see how many kWh are in it, when it is full while charging, and how long it can still power the home while delivering
- What your house can do shows what your battery delivered to the home this month, and roughly what that is worth from 2027
- When your home battery charges from the sun, SunArc works out alongside what it would do if that sun were spare, such as an air conditioner on sun or the dryer. Devices shows it with your battery. Only for comparison: nothing changes in what SunArc does
- On Home a line now runs to your home battery when it charges, and out to the home when it delivers, with how much. Also when the battery stands inside in a room
- In Yield › Now your home battery shows in Where your power is going now: To the battery when it charges, From the battery when it delivers
- Yield now counts your home battery: under your panels it shows what it charged, how much of that came from the sun, and what it delivered to the home. Where your power went shows From the battery and To the battery
- Energy now has Home battery. You see which battery SunArc found, and you choose one yourself if it is not listed, also when it comes in through Homey with separate sensors
- For each battery you choose which sensor says how full it is, what it is charging or delivering now, and how much it charged and delivered in total. You also choose whether plus is charging or delivering, and see right away what the battery is doing

**Improved**

- A home battery that goes quiet for a moment stays in view instead of disappearing

**Fixed**

- With a home battery the use was wrong: what the battery charged counted as use, and what it delivered counted nowhere. The use now adds up, right now, per hour and per device

## 0.144.2

*7 november 2026 · 0.142.1 – 0.144.2*

**Nieuw**

- Je thuisaccu staat nu in de tekening, op zijn plek: aan de gevel, in de garage of binnen in een kamer. Je kiest het bij Kamers en indeling › Buiten
- Staat de accu in de garage, dan zie je op Thuis in het blad van de garage hoe vol hij is en wat hij doet, met de auto als die in de garage staat
- Buiten heeft nu echte plekken voor apparaten, ook zonder gebied in Home Assistant: de voordeur altijd, en elk deel rond het huis dat aan staat, zoals de oprit, de garage en de tuin. Bij Kamers en indeling › Buiten zie je per plek hoeveel apparaten er hangen
- Bij een apparaat kies je een kamer binnen of een plek buiten, apart onder elkaar. Een plek die er nog niet was, komt erbij als je bewaart
- Op Thuis opent een tik op de voordeur zijn blad, met de lampen en de camera

**Beter**

- Wijkt de helling uit de meting af van de 3D-kaart, dan zegt het vlak dat de 3D-kaart voor de helling nauwkeuriger is
- Bij Te doen staat wat met de hand loopt nu in de kolom Vast en gepland, niet meer los erboven. Een stekker die met de hand aan staat, zegt daar Zet uit in plaats van Terug
- Elke taak bij Vast en gepland op Te doen heeft naast de schakelaar een × om hem weg te halen
- Zet uit bij een stekker zet hem meteen uit, zonder hoe lang of een eindtijd
- Bij Wat kan bij jouw huis zegt elke kaart Zoekt… zolang SunArc de omtrek en de 3D-kaart nog opvraagt
- Bij een prijs per uur tellen de uren waarin Home Assistant de kosten nog niet telde tegen je gemiddelde, met "deels geschat" bij Kosten. Over een heel jaar telt wat je boven je verbruik teruglevert tegen de vergoeding

**Opgelost**

- Nam je bij Daken en panelen de richting en helling over uit de 3D-kaart, dan stond er Zelf ingesteld. Nu staat er uit de 3D-kaart, zolang het vlak met de kaart klopt
- Op een Android-wand kon je de tijd van een stekker pas instellen na een tik op het toetsenbord. Tot hoe laat kies je nu uit een lijst per kwartier, net als Om bij Elke dag
- Bij Daken en panelen gingen lengte en breedte van een blok samen omhoog of omlaag zodra de breedte groter werd dan de lengte. Nu blijft elke maat van zichzelf, ook bij een huis van 6 bij 11 meter
- Een plat dak met panelen op rekken bleef op Thuis een puntdak als de kaart een puntdak gaf. Je panelen gaan nu voor
- Klaarzetten vroeg om je slimme meter of omvormer te koppelen, ook als je hem in de app al had gekozen. De melding zegt nu ook wat je moet doen
- Een weerdienst die alleen een verwachting per uur geeft, zoals OpenWeatherMap soms, gaf geen verwachting voor de komende dagen. SunArc maakt er nu zelf dagen van
- Laden met de hand houdt zich aan je hoofdzekering, ook zonder stroommeter per fase
- Liggen er panelen op het huis én op de garage, dan stroomt de zon op Thuis nu ook van de garage
- Koos je bij Inrichten een plat dak, dan bleef het huis soms een puntdak. Plat dak bij Inrichten gaat nu voor, ook voor de dakvorm uit de kaart
- Met een prijs per uur telde Opbrengst stroom en teruglevering soms niet mee, en gas tegen één vaste prijs. Nu telt het zoals Home Assistant, ook het gas. Ontbreekt er een prijs, dan staat bij Kosten wat er niet in zit

*English*

**New**

- Your home battery now shows in the drawing, in its place: on the outside wall, in the garage or inside in a room. You pick it in Rooms and layout › Outside
- If the battery is in the garage, the garage sheet on Home shows how full it is and what it does, with the car if it is in the garage
- Outside now has real places for devices, also without an area in Home Assistant: the front door always, and every part around the house that is on, such as the driveway, the garage and the garden. Rooms and layout › Outside shows how many devices each place has
- For a device you pick a room inside or a place outside, listed apart. A place that did not exist yet is added when you save
- On Home, tapping the front door opens its sheet, with the lights and the camera

**Improved**

- If the tilt from the measurement differs from the 3D map, the face says the 3D map is more accurate for the tilt
- In To do, what runs by hand now shows in the Fixed and planned column, no longer on its own above it. A plug switched on by hand says Switch off there instead of Back
- Every task in Fixed and planned on To do has an × next to the switch to remove it
- Switch off on a plug switches it off right away, without how long or an end time
- In What your house allows, each map says Searching… while SunArc still looks up the outline and the 3D map
- With an hourly price, hours in which Home Assistant did not count the costs yet count at your average, with "partly estimated" at Costs. Over a whole year, what you export above your use counts at the payment rate

**Fixed**

- If you took the direction and tilt from the 3D map in Roofs and panels, it said Set by you. It now says from the 3D map, as long as the face matches the map
- On an Android wall panel you could only set the time of a plug after tapping the keyboard. Until when is now picked from a list per quarter of an hour, as is At for Every day
- In Roofs and panels, the length and width of a block went up or down together once the width got larger than the length. Each size now stays its own, also for a house of 6 by 11 metres
- A flat roof with panels on racks stayed a pitched roof on Home when the map gave a pitched roof. Your panels now come first
- Getting ready asked you to connect your smart meter or inverter, even if you had already picked it in the app. The message now also says what to do
- A weather service that only gives an hourly forecast, like OpenWeatherMap at times, gave no forecast for the coming days. SunArc now makes days out of it
- Charging by hand keeps to your main fuse, also without a current meter per phase
- With panels on the house and on the garage, the sun on Home now also flows from the garage
- If you picked a flat roof in Set up, the house sometimes kept a pitched roof. A flat roof in Set up now comes first, also over the roof shape from the map
- With an hourly price, Energy sometimes left out electricity and export, and counted gas at one fixed price. It now counts as Home Assistant does, gas included. If a price is missing, Costs says what is not included

## 0.142.0

*7 november 2026 · 0.138.0 – 0.142.0*

**Nieuw**

- In het blad van een stekker kies je ook Wanneer: nu, of vast elke dag, op werkdagen of in het weekend om een tijd. Vast komt bij Vast en gepland, en staat ook in het blad
- Een slimme stekker op zon schakelt SunArc nu echt, als je hem toeliet: aan als er zon over is, uit als die wegvalt. Wat je zelf aan- of uitzet, laat SunArc met rust
- Een minimum per dag voor een stekker, bij Regeling › Op zon: bijvoorbeeld minstens 2 uur, uiterlijk 22:00. Haalt de zon het niet, dan gaat hij op het laatst aan van het net
- Een slimme stekker op vaste tijden: bij Nieuw in Vast en gepland kies je hem, wanneer (elke dag, werkdagen, een tijd of bij zonsondergang), aan of uit, en hoe lang
- Een slimme stekker met de hand: tik op de kaart bij Apparaten en zet hem aan of uit voor 30 minuten, een of twee uur, of tot een tijd. Daarna staat hij weer zoals hij was
- Per stekker kies je bij Regeling › Op zon of SunArc hem mag aan- en uitzetten; weg is nee
- Wat met de hand aan of uit staat, zie je ook bij Te doen, met Terug
- Slimme stekkers: SunArc vindt ze zelf en zegt het bij de bel. Zet er een op zon bij Regeling, dan zie je bij Apparaten wanneer hij aan kan op eigen zon
- Meet de stekker zijn eigen verbruik, dan vraagt de bel om de meter toe te voegen; daarna staat hij bij Opbrengst
- Meet hij zijn vermogen zelf, dan onthoudt SunArc wat hij trekt. Zonder meter vul je het in

**Beter**

- Het blad van een stekker zegt Zet aan of Zet uit, met de stand apart bovenaan; zonder add-on alleen de stand
- Bij Nieuwe taak kies je een scène bij de lampen, onder Wat doen ze, in plaats van los tussen de apparaten
- Bij Energie › Meters staan meters per dag, gisteren of maand niet meer tussen die van een apparaat, en twee meters met dezelfde naam krijgen hun id erachter

**Opgelost**

- Na 22:00 lag "de eerstvolgende keer 22:00" twee dagen vooruit in plaats van één, bijvoorbeeld bij "tot een tijd" in het blad van een stekker

*English*

**New**

- In the sheet of a plug you also pick When: now, or fixed every day, on weekdays or at the weekend at a time. Fixed goes to Fixed and planned, and shows in the sheet too
- SunArc now really switches a smart plug on solar, if you allowed it: on when there is solar to spare, off when it goes. What you switch on or off yourself, SunArc leaves alone
- A daily minimum for a plug, in Control › On solar: for example at least 2 hours, by 22:00 at the latest. If the sun does not make it, it switches on from the grid at the last moment
- A smart plug on fixed times: in New in Fixed and planned you pick it, when (every day, weekdays, a time or at sunset), on or off, and for how long
- A smart plug by hand: tap its card in Devices and switch it on or off for 30 minutes, one or two hours, or until a time. Then it is back as it was
- For each plug you choose in Control › On solar whether SunArc may switch it on and off; the default is no
- What is on or off by hand also shows in To do, with Back
- Smart plugs: SunArc finds them itself and tells you at the bell. Put one on solar in Control, and Devices shows when it can be on with your own solar
- If the plug measures its own use, the bell asks you to add the meter; then it shows under Yield
- If it measures its power itself, SunArc remembers what it draws. Without a meter you fill it in

**Improved**

- The sheet of a plug says Switch on or Switch off, with the state on its own at the top; without the add-on only the state
- In New task you pick a scene with the lights, under What do they do, instead of loose between the devices
- In Energy › Meters, meters per day, yesterday or month no longer sit among those of a device, and two meters with the same name get their id added

**Fixed**

- After 22:00, "the next time it is 22:00" was two days ahead instead of one, for example with "until a time" in the sheet of a plug

## 0.137.0

*7 november 2026 · 0.135.0 – 0.137.0*

**Nieuw**

- Meldingen van de auto: vol, laden gestopt met een fout van de laadpaal, en laden met de hand dat klaar is
- Kabel vergeten: staat de auto 's avonds thuis zonder kabel en te leeg, dan krijg je een melding. De tijd en het % kies je bij Energie › Auto en laadpaal
- Op de telefoon een eigen keuze De auto, standaard aan, niet in je nachtrust
- Laden met de hand op de pagina Auto: de hoogste stroom per fase of pauzeren, voor een uur, tot een tijd, tot een % of tot de kabel eruit gaat. Daarna kiest de laadpaal weer zelf
- Laad met 8 A met één tik op de advieskaart, als er meer zon over is
- Bij Energie › Auto en laadpaal zet je aan of SunArc de laadpaal mag bedienen; nooit boven de laadpaal of je zekering
- Advies bij de auto: is er meer zon over dan de auto neemt, dan zie je met hoeveel ampère hij nog op eigen zon laadt, binnen je laadpaal en je zekering
- Met een prijs per uur: de goedkoopste uren om te laden, hoe ver de auto dan komt en wat het ongeveer kost
- Het advies staat onder de auto en als eigen kaart op Thuis, boven de kaart van de auto, en alleen als er iets te winnen is

**Beter**

- Bij Zelf tekenen opent Teken je huis meteen je huis om te schuiven, te draaien en op maat te zetten, en de tekening zegt dat je op de naam van een gebouw tikt

*English*

**New**

- Notifications for the car: full, charging stopped by a charger error, and charging by hand that is done
- Cable forgotten: if the car is home in the evening without the cable and too low, you get a notification. Choose the time and the % in Energy › Car and charger
- On the phone its own choice The car, on by default, not during your night rest
- Charging by hand on the Car page: the highest current per phase or pausing, for an hour, until a time, until a % or until the cable comes out. After that the charger decides again
- Charge at 8 A with one tap on the advice card, when there is more solar to spare
- In Energy › Car and charger you allow SunArc to control the charger; never above the charger or your main fuse
- Advice for the car: when there is more solar to spare than the car takes, you see how many amps it can charge with on your own solar, within your charger and your main fuse
- With an hourly price: the cheapest hours to charge, how far the car gets and roughly what it costs
- The advice shows under the car and as its own card on Home, above the car card, and only when there is something to gain

**Improved**

- Under Draw it yourself, Draw your house opens your house right away to move, turn and resize it, and the drawing says to tap a building's name

## 0.134.0

*6 november 2026 · 0.132.0 – 0.134.0*

**Nieuw**

- Bij Daken en panelen zie je wat kan bij jouw huis: zelf tekenen, je plek uit Home Assistant, de plattegrond en de 3D-kaart van Nederland, elk met wat ze vonden. Jij kiest waar je huis uit getekend wordt
- Zelf tekenen: tik een gebouw aan en sleep het op zijn plek, draai het met het rondje, en zet de lengte en breedte. Een gebouw zonder panelen zet je erbij via Dak of vlak erbij
- Komt je huis uit de 3D-kaart van Nederland, dan staat bij elk schuin vlak op het huis wat de laser mat, naast de meting, met Neem over
- De laadbeurten van de laatste week op de pagina Auto: per beurt hoeveel er geladen is, wat het kostte en welk deel eigen zon was, en alles samen
- Tijdens het laden staat onder de auto wat deze laadbeurt tot nu toe nam en kostte
- Een eigen pagina Auto: hoe vol de auto is, of hij laadt en met hoeveel, de stroom per fase, de laadgrens, hoe laat hij vol is, de kabel en of hij onderweg is. De auto zelf is de meter
- De kaart van de auto op Thuis toont de auto als meter en opent de pagina Auto, net als de auto bij Apparaten

**Beter**

- Kijk wat kan neemt niets over: eerst zie je of je huis, alleen je wijk of niets in de kaart staat. Staat je plek uit, dan brengt Stel in je naar die instelling in Home Assistant
- De stap Hoe ze liggen in Inrichten zegt wat kan bij jouw huis, met een link naar Daken en panelen
- SunArc leest bij meer auto’s hoe lang het laden nog duurt, zoals bij NissanConnect

**Opgelost**

- Een plat dak blijft plat op Thuis, ook nadat je de panelen aanpast. Ook Plat dak bij Inrichten telt mee
- Bij Daken en panelen heet Naar één kant nu Op rekken: daar stel je de helling in van panelen die schuin op een plat dak staan

*English*

**New**

- Roofs and panels shows what your house allows: drawing it yourself, your location from Home Assistant, the street map and the 3D map of the Netherlands, each with what they found. You choose what your house is drawn from
- Draw it yourself: tap a building and drag it into place, rotate it with the circle, and set its length and width. Add a building without panels under Add a roof or plane
- If your house comes from the 3D map of the Netherlands, each sloped plane on the house shows what the laser measured, next to the measurement, with Use this
- The charging sessions of the last week on the Car page: per session how much was charged, what it cost and how much was own solar, and the total
- While charging, the car shows what this session has taken and cost so far
- A Car page of its own: how full the car is, whether it charges and how fast, the current per phase, the charge limit, when it is full, the cable and whether it is away. The car itself is the meter
- The car card on Home shows the car as a meter and opens the Car page, as does the car under Devices

**Improved**

- See what works takes nothing over: first you see whether your house, only your area or nothing is on the map. If your location is not set, Set it takes you to that setting in Home Assistant
- The step How they lie in Set up says what your house allows, with a link to Roofs and panels
- SunArc reads how long charging still takes for more cars, such as with NissanConnect

**Fixed**

- A flat roof stays flat on Home, also after you change the panels. Flat roof in Set up counts too
- In Roofs and panels, One direction is now called On racks: that is where you set the tilt of panels tilted on a flat roof

## 0.131.2

*6 november 2026 · 0.131.0 – 0.131.2*

**Nieuw**

- Bij Energie staat Auto en laadpaal: wat SunArc vond, elk met een schakelaar, en zelf een ander apparaat kiezen. Meerdere auto’s en laadpalen kan ook
- Per auto vul je de accu in, aan welke laadpaal hij laadt en waar hij in de tekening staat: op de oprit, onder de carport of in de garage

**Beter**

- Bij Daken en panelen staat een rood pijltje bij de N van het kompas

**Opgelost**

- Aan de thermostaat van de cv-ketel kies je nu wat eraan hangt, zoals vloerverwarming. Het huis tekent dan geen radiator meer
- Het seizoen is overal hetzelfde: bij de etages, de kamers en Inrichten staat nu ook de herfst van Thuis
- Bij Auto en laadpaal staan geen iBeacons, Proximity of andere apparaten die alleen een afstand meten meer als auto
- De klimaatregeling van een auto telt niet meer als klimaat in huis

*English*

**New**

- Energy has Car and charger: what SunArc found, each with a switch, and choose another device yourself. Several cars and chargers work too
- For each car you fill in the battery, which charger it uses and where it stands in the drawing: on the driveway, under the carport or in the garage

**Improved**

- Roofs and panels has a small red arrow at the N of the compass

**Fixed**

- For the boiler thermostat you now choose what is connected to it, such as underfloor heating. The house no longer draws a radiator then
- The season is the same everywhere: the floors, the rooms and setup now show the same autumn as Home
- Car and charger no longer lists iBeacons, Proximity or other devices that only measure a distance as a car
- A car’s climate control no longer counts as climate in the home

## 0.130.0

*6 november 2026 · 0.129.4 – 0.130.0*

**Nieuw**

- Inrichten heeft een stap Je dag: schuif wanneer het huis voorverwarmt, overdag begint en 's nachts, en de lucht boven het huis schuift mee
- Bij Hoe warm wil je het zet je per kamer overdag en 's nachts, verwarmen en koelen; een kamer volgt het hele huis tot je hem een eigen getal geeft
- Buiten bij Inrichten kent de border, en in de tuin kan een tuinhuis, een schuurtje of allebei

**Opgelost**

- Zet je bij Buiten het terras of de border uit, dan staan ze ook niet meer in de tekening
- Bij de panelen kies je hoeveel kanten van het dak er panelen hebben, zonder Weet ik niet
- Wat je huis kan en Hoe ver je huis is staan meteen op het scherm, ook als een onderdeel nog laadt
- Hoe je huis warmte vasthoudt wordt elke nacht uitgerekend, met veel minder geheugen, en loopt niet meer vast

*English*

**New**

- Set up has a Your day step: drag when the house preheats, when day starts and when night starts, and the sky above the house moves along
- Under How warm do you want it you set each room by day and at night, heating and cooling; a room follows the whole house until you give it its own number
- Outside in Set up knows the flower border, and the garden can have a summer house, a shed or both

**Fixed**

- Turn off the terrace or the border under Outside, and they no longer show in the drawing
- For the panels you pick how many sides of the roof have panels, without Not sure
- What your house can do and How far your house is show up right away, even while one part is still loading
- How your home holds heat is worked out every night, with far less memory, and no longer gets stuck

## 0.129.3

*6 november 2026*

**Beter**

- Wat er nieuw is, staat in één overzicht sinds je vorige versie, ook als er versies tussen zaten: in de app, bij Home Assistant en op GitHub
- Wie iets meldde via Meld een probleem, ziet na deze update wat ermee gebeurde: oost-west op een plat dak, het platte dak op Thuis, de richting van de panelen en Hoe voelt het huis

*English*

**Improved**

- What is new comes in one overview since your previous version, also when versions came in between: in the app, in Home Assistant and on GitHub
- If you reported something via Report a problem, this update tells you what happened to it: east-west on a flat roof, the flat roof on Home, the direction of the panels and How does the house feel

## 0.129.2

*5 november 2026 · 0.122.0 – 0.129.2*

**Nieuw**

- Opbrengst heeft Nu: live waar je stroom heen gaat, met de zon per dak, wat er aan staat en wat terug gaat naar het net
- Geef een dakvlak een eigen naam: tik op de naam bovenaan een open vlak
- In Nederland komt je huis uit 3D BAG: de omtrek en de vorm van het dak met de nok; OpenStreetMap vult aan wat er niet in staat, zoals een tuinhuis
- Voor je de kaart gebruikt, zegt SunArc dat het experimenteel is, wat het doet en hoe je privacy geregeld is
- Zonder kaart zet je huis altijd terug naar een rechthoek; je dakvlakken blijven staan
- Inrichten vraagt kort waar je panelen liggen: tik de plekken aan met hoeveel, bij het hoofddak per kant; elke plek wordt een dakvlak dat SunArc daarna zelf goed zet
- De eerste keer Daken en panelen krijg je een korte rondleiding
- Opbrengst in drie gelijke kolommen, met een nieuw stroombeeld: de zon per dakvlak, het net met wat het kostte, terug met wat het opbracht, Altijd aan (je sluipverbruik) apart, en kleine stromen samen
- Gas staat apart onder het stroombeeld, met m³ en euro’s
- Thuis: met meer dakvlakken een tik op de panelen voor De zon op je daken, met per vlak wat het nu levert en wat het bij heldere lucht zou leveren
- Opbrengst: bij Je panelen een wissel Samen of Per dak, met per vlak de kWh en wat een paneel daar opleverde
- Blijft een dakvlak achter, dan zegt SunArc het: bovenaan Daken en panelen met de lijn van de zonnige dagen, bij Opbrengst en, na drie zonnige dagen, in de bel. Met één omvormer zegt hij wanneer het dak minder geeft en welk vlak dan waarschijnlijk de zon heeft
- De meting per dakvlak: SunArc begint bij wat je invulde en zoekt per vlak de richting en de helling die bij de zonnige dagen passen. Gemeten vlakken volgen de meting vanzelf; bij een vlak dat je zelf instelde staat het voorstel, met Neem over
- Elke omvormer zijn eigen grens: uit het typenummer, of zelf in te vullen bij Omvormers en meters. Een garage met een eigen omvormer kapt niet meer af op die van het huis
- Meet één omvormer meer vlakken, dan zie je bij Omvormers en meters de dag van gisteren, verdeeld per vlak
- Daken en panelen: het huis van boven, met elk dakvlak om aan te tikken. Een leeg dakvlak aantikken legt er panelen op; met een vlak open verplaats je het naar een ander dakvlak
- Per gebouw een dakvorm (zadeldak, schilddak, lessenaar of plat), met een voorstel uit de vlakken die er al zijn
- De omtrek uit de kaart: OpenStreetMap krijgt alleen de wijk te zien, en SunArc kiest zelf je huis. Gebouwen ernaast staan grijs; tik er een aan als hij bij je huis hoort
- Een wissel tussen Van boven en Het huis
- Energie › Daken en panelen: elk dakvlak apart, met een letter. Een uitbouw met panelen oost-west, een garage, panelen op de grond of aan de gevel: elk vlak met zijn eigen richting, helling, aantal en omvormer
- Panelen op de garage, de carport en het tuinhuis tellen nu mee in de verwachting van de zon

**Beter**

- Daken en panelen op de telefoon: de kaart en de uitleg staan onder de tekening, en het vraagteken staat klein rechts naast de titel
- Liggen er meer vlakken op dezelfde plek, dan staat de richting erbij, zoals Hoofddak oost en Hoofddak west, ook bij Opbrengst
- Daken en panelen heeft bovenin een vraagteken om de rondleiding opnieuw te zien, en de rondleiding laat ook je huis met de panelen zien
- Wat je huis kan en de zonnewaaier zeggen dat het huis nog leert zolang alle dakvlakken geschat zijn, en noemen hoeveel vlakken je hebt
- Met bewaarde daken vraagt de bel niet meer om de gemeten panelen te bevestigen
- Van boven tekent SunArc zoveel panelen als je invulde, in rijen vanaf de nok, in plaats van het hele dakvlak vol
- Heeft de kaart je huis en garage als één gebouw, dan wordt het grootste blok het huis met de dakvorm; de rest staat grijs ernaast, om aan te tikken als garage of uitbouw
- Van de gebouwen ernaast alleen wat binnen 12 meter staat, hooguit acht
- Daken en panelen: onder Omvormers en meters heet de knop nu Dakvlakken instellen, met een zin wat je daar doet
- Daken en panelen: bij Gemeten door staan alleen de omvormers die je bij Omvormers en meters koos, in plaats van elke sensor met een vermogen
- Liggen meer vlakken aan één omvormer, dan kies je hem bij elk vlak; met één omvormer staat hij er vanzelf, en Hoort bij zet hem bij alle vlakken zonder meter

**Opgelost**

- Hoe voelt het huis gaf "Niet gelukt" voor een kamer die er via Inrichten bij kwam; nu telt hij meteen mee
- Meten met: een meter uitzetten blijft uit, ook de meter die de app zelf koos; de app neemt geen watertemperatuur van een boiler of warmtepomp als kamertemperatuur
- Een huis met een plat dak krijgt op Thuis een plat dak, met de panelen erop in rijen
- Opbrengst telde de zon alleen uit de omvormer, ook van vóór hij gekoppeld was: dan gaf het stroombeeld 0% zon en Per dak veel te weinig. Waar de omvormer nog niets meet, telt nu de zonnemeter
- Alle dakvlakken weghalen betekent nu echt geen panelen, ook als het instellingenbestand nog een dak had
- Thuis: een tik op de panelen opent De zon op je daken, niet meer de zolder
- Een breed label op het huis valt niet meer buiten beeld, zoals bij de panelen op de telefoon
- Opgewekt komt uit je omvormer als die er is: een zonnemeter die achterliep, gaf te weinig, en dan klopten zelf gebruikt en terug niet
- Op de kaart (de voorkant opmeten) zocht bij de afgeronde plek van het huis, en vond zo niet je eigen huis
- Na het verdraaien van een dakvlak zocht de meting nog maar één kant van het dak; nu zoekt hij weer vrij, en zegt een vlak wat de meting wel ziet
- Daken en panelen opent weer bij de dakvlakken, ook als je eerder bij Omvormers en meters was

*English*

**New**

- Yield has Now: live where your power goes, with the sun per roof, what is on and what goes back to the grid
- Give a roof plane its own name: tap the name at the top of an open plane
- In the Netherlands your house comes from 3D BAG: the outline and the roof shape with its ridge; OpenStreetMap adds what is missing, like a garden shed
- Before you use the map, SunArc says it is experimental, what it does and how your privacy is handled
- Without map always puts your house back to a rectangle; your roof planes stay
- Setup asks briefly where your panels are: tap the places with how many, per side for the main roof; each place becomes a roof plane that SunArc then sets right itself
- The first time you open Roofs and panels you get a short tour
- Yield in three equal columns, with a new flow picture: the sun per roof plane, the grid with what it cost, export with what it earned, Always on (your standby use) apart, and small flows together
- Gas sits apart under the flow picture, with m³ and euros
- Home: with several roof planes, tap the panels for The sun on your roofs, with per plane what it delivers now and what it would with a clear sky
- Yield: a Together or Per roof switch at Your panels, with per plane the kWh and what one panel delivered there
- When a roof plane falls behind, SunArc says so: at the top of Roofs and panels with the line of the sunny days, in Yield and, after three sunny days, in the bell. With one inverter it says when the roof gives less and which plane probably has the sun then
- Measuring per roof plane: SunArc starts from what you entered and looks per plane for the direction and tilt that fit the sunny days. Measured planes follow the measurement by themselves; a plane you set yourself shows the suggestion, with Use it
- Every inverter has its own limit: from the model number, or set yourself under Inverters and meters. A garage with its own inverter no longer clips at the limit of the house
- When one inverter measures several planes, Inverters and meters shows yesterday, split per plane
- Roofs and panels: the house from above, with every roof plane to tap. Tapping an empty roof plane puts panels on it; with a plane open, you move it to another roof plane
- A roof shape per building (gable, hip, lean-to or flat), suggested from the planes that are already there
- The outline from the map: OpenStreetMap only gets to see the neighbourhood, and SunArc picks your house itself. Buildings next door are grey; tap one if it is part of your house
- A switch between From above and The house
- Energy › Roofs and panels: every roof plane on its own, with a letter. An extension with east-west panels, a garage, panels on the ground or on a wall: each plane with its own direction, tilt, number and inverter
- Panels on the garage, carport and shed now count in the solar forecast

**Improved**

- Roofs and panels on the phone: the map and the explanation are below the drawing, and the question mark sits small to the right of the title
- If several planes are in the same place, the direction is added, like Main roof east and Main roof west, also in Yield
- Roofs and panels has a question mark at the top to see the tour again, and the tour also shows your house with the panels
- What your house can do and the sun fan say the house is still learning while all roof planes are estimated, and name how many planes you have
- With saved roofs the bell no longer asks to confirm the measured panels
- From above, SunArc draws as many panels as you entered, in rows from the ridge, instead of filling the whole roof plane
- If the map has your house and garage as one building, the largest block becomes the house with the roof shape; the rest is grey beside it, to tap as garage or extension
- Of the buildings around, only those within 12 metres, eight at most
- Roofs and panels: under Inverters and meters the button is now called Set up roof planes, with a line on what you do there
- Roofs and panels: Measured by only shows the inverters you chose under Inverters and meters, instead of every sensor with a power reading
- When several planes share one inverter, you choose it at each plane; with one inverter it is filled in already, and Belongs to sets it for all planes without a meter

**Fixed**

- How does the house feel said "Did not work" for a room added in Setup; it now counts straight away
- Measure with: switching a meter off stays off, also the meter the app picked itself; the app no longer takes a water temperature of a boiler or heat pump as the room temperature
- A house with a flat roof gets a flat roof on Home, with the panels on it in rows
- Yield counted the sun only from the inverter, also from before it was connected: the flow picture then showed 0% sun and Per roof far too little. Where the inverter does not measure yet, the solar meter counts now
- Removing all roof planes now really means no panels, even if the settings file still had a roof
- Home: tapping the panels opens The sun on your roofs, no longer the attic
- A wide label on the house no longer falls off the screen, like the one at the panels on the phone
- Generated now comes from your inverter when there is one: a solar meter that lagged gave too little, and then self-use and export did not add up
- On the map (measuring the front) searched around the rounded location of the house, and so did not find your own house
- After turning a roof plane the measurement only searched one side of the roof; now it searches freely again, and a plane says what the measurement does see
- Roofs and panels opens on the roof planes again, even if you were at Inverters and meters before

## 0.121.2

*5 november 2026 · 0.121.1 – 0.121.2*

**Opgelost**

- Met een prijs per uur vraagt Contract en prijzen niet meer om een vaste stroomprijs of een dalprijs; Per uur werd bij Normaal en dal zelfs niet bewaard
- Teruglevering telt bij een prijs per uur ook per uur, zoals Home Assistant het bijhoudt; telt Home Assistant dat nog niet, dan staat er wat je daar zet
- De eerste start loopt niet meer vast op "zo niet bruikbaar": wat SunArc nog niet begrijpt, laat hij weg, en dat staat op het scherm en in het logboek
- Het grote welkom van Inrichten heeft weer een kruisje rechtsboven, naar Thuis

*English*

**Fixed**

- With an hourly price, Contract and prices no longer asks for a fixed electricity price or an off-peak price; with Peak and off-peak, Per hour was not even saved
- With an hourly price, export also counts per hour, as Home Assistant tracks it; if Home Assistant does not count it yet, it says what to set there
- The first start no longer gets stuck on "cannot be used like this": SunArc leaves out what it does not understand yet, and says so on screen and in the log
- The big welcome of Setup has a close button at the top right again, back to Home

## 0.121.0

*4 november 2026*

**Nieuw**

- Meld een probleem kan het logboek meesturen: de laatste waarschuwingen en fouten, zonder adressen of sleutels; je ziet vooraf wat er meegaat
- Bij Versie kun je het logboek zelf lezen
- Gaat de eerste start mis, dan staat er een knop Meld dit, met de fout en het logboek al ingevuld

**Opgelost**

- Een app op je telefoon of tablet die de browser terugzet, laadt zichzelf opnieuw als hij een oude versie draait; eerst hielp alleen de cache wissen
- Op de telefoon begonnen Praten met je huis en Stem en luisteren met hetzelfde blok, alsof het één pagina was; de stappen voor "Hé huis" staan nu alleen bij Stem en luisteren
- Bij de eerste start staat onder "De configuratie is zo niet bruikbaar" nu wat er precies mis is, en het logboek van de add-on schrijft het ook op

*English*

**New**

- Report a problem can send the log: the latest warnings and errors, without addresses or keys; you see beforehand what is sent
- Under Version you can read the log yourself
- If the first start goes wrong, there is a Report this button, with the error and the log already filled in

**Fixed**

- An app on your phone or tablet that the browser restores reloads itself when it runs an old version; before, only clearing the cache helped
- On the phone, Talk to your house and Voice and listening started with the same block, as if they were one page; the steps for "Hey house" are now only under Voice and listening
- At the first start, "The configuration cannot be used like this" now shows what exactly is wrong, and the add-on log writes it down too

## 0.120.0

*4 november 2026*

**Nieuw**

- Na een opgeloste melding kun je zeggen of het werkt: Werkt nog niet opent je issue op GitHub om te reageren. Bij Versie staan je meldingen met hun stand

**Opgelost**

- Inrichten op de wand: past een stap niet op de kaart, dan schuift hij, en Volgende blijft in beeld; bij Meter van nu viel de knop eerst weg
- Energie › Prijzen: Per uur kiezen neemt de uurprijs van Home Assistant over; kent Home Assistant die nog niet, dan staat er wat er mist en welke sensor de prijs al geeft
- Een eigen kostensensor in Home Assistant, zoals die van Tibber, telt nu ook als prijs per uur
- Thuis en Inrichten tonen overdag dag, ook als de dienst de stand van de zon niet geeft of de panelen nog niet kent; eerst was het dan altijd nacht
- De browsers van Browser Mod staan niet meer als lamp tussen je apparaten, ook niet bij Inrichten

*English*

**New**

- After a fixed report you can say whether it works: Still not working opens your issue on GitHub to reply. Under Version your reports are listed with their status

**Fixed**

- Setup on the wall: when a step does not fit on the card it scrolls, and Next stays in view; at Live meter the button dropped out of sight before
- Energy › Prices: choosing Per hour takes over the hourly price from Home Assistant; if Home Assistant does not know it yet, it says what is missing and which sensor already gives the price
- An own cost sensor in Home Assistant, such as the one from Tibber, now also counts as an hourly price
- Home and Setup show day in daytime, even when the service gives no sun position or does not know the panels yet; before, it was always night then
- Browsers from Browser Mod no longer show up as lights among your devices, also not in Setup

## 0.119.0

*4 november 2026*

**Nieuw**

- Energie › Prijzen toont de prijs van nu, met een knop om de uurprijs over te nemen

**Opgelost**

- Bij een prijs per uur (zoals Zonneplan of Tibber) rekent Opbrengst met de kosten zoals Home Assistant ze telt, met de prijs van elk uur; eerst bleef de prijs staan op het moment van overnemen

*English*

**New**

- Energy › Prices shows the price right now, with a button to take over the hourly price

**Fixed**

- With an hourly price (such as Zonneplan or Tibber) Energy counts the costs as Home Assistant does, at the price of each hour; before, the price stayed at the moment it was taken over

## 0.118.0

*4 november 2026*

**Nieuw**

- Meld een probleem: in het menu, bij Versie, Over deze app en bij elk apparaat. Na een update zegt de app wat er met je melding gebeurde
- Bij een apparaat dat niet klopt, gaan zijn gegevens mee in de melding, zonder namen of adressen

**Beter**

- Een warmtepomp met een stooklijn of watertemperatuur als doel (zoals Luxtronik of Midea) toont dat ook, en telt niet meer als kamertemperatuur

*English*

**New**

- Report a problem: in the menu, under Version, About this app and on every device. After an update the app tells you what happened with your report
- For a device that is not right, its data goes with the report, without names or addresses

**Improved**

- A heat pump with a heating curve or water temperature as its target (such as Luxtronik or Midea) shows that, and no longer counts as a room temperature

## 0.117.1

*4 november 2026*

**Beter**

- Bedragen staan in de valuta die in Home Assistant is ingesteld; de euro blijft de standaard

*English*

**Improved**

- Amounts are shown in the currency set in Home Assistant; the euro stays the default

## 0.117.0

*4 november 2026*

**Nieuw**

- SunArc zoekt elke drie uur zelf naar een nieuwe versie, en bij Versie staat een knop Zoek naar updates: niet meer zelf zoeken in Home Assistant
- Een knop Herstart SunArc bij Versie, en meteen waar een keuze pas na een nieuwe start ingaat; de app laadt vanzelf als SunArc terug is
- Bij Inrichten › Kamers kun je een etage toevoegen

**Beter**

- Elke etage uit Home Assistant wordt een eigen etage met zijn naam, ook een derde verdieping of een etage zonder niveau; eerst viel alles vanaf de tweede samen
- De koppeling voor Assist (2.0.1) haalt bij verwijderen alleen haar eigen zinnenbestand weg, en ruimt geen bestand met de oude naam meer op

*English*

**New**

- SunArc checks for a new version by itself every three hours, and Version has a Check for updates button: no more checking in Home Assistant yourself
- A Restart SunArc button under Version, and right where a choice only takes effect after a new start; the app reloads by itself once SunArc is back
- Under Set up › Rooms you can add a floor

**Improved**

- Every floor from Home Assistant becomes its own floor with its name, including a third floor or a floor without a level; before, everything from the second floor up merged
- The Assist integration (2.0.1) only removes its own sentences file when removed, and no longer cleans up a file with the old name

## 0.116.0

*4 november 2026*

**Nieuw**

- De netmeter kies je zelf bij Energie › Meters en in Inrichten: elke sensor in W of kW, met wat hij nu zegt; ook afname en teruglevering apart, zoals DSMR
- Meer omvormers kies je bij Energie › Panelen; SunArc telt ze op tot de opbrengst van nu

**Beter**

- Bij het begin vindt SunArc ook DSMR, HomeWizard, Homey en een sensor zonder soort, aan de eenheid W of kW

**Opgelost**

- Een meter of omvormer in kW telde als watt: 0,45 kW werd 0,45 W
- Inrichten, zekering "Weet ik niet": geen lijst meer met "kies eerst de fasen"

*English*

**New**

- Choose the grid meter yourself under Energy › Meters and in Set up: every sensor in W or kW, with what it reports now; also import and export as two sensors, like DSMR
- Choose more inverters under Energy › Solar panels; SunArc adds them up to the output right now

**Improved**

- At the start SunArc also finds DSMR, HomeWizard, Homey and a sensor without a class, by the unit W or kW

**Fixed**

- A meter or inverter in kW counted as watts: 0.45 kW became 0.45 W
- Set up, main fuse "Not sure": no longer a list saying "choose the phases first"

## 0.115.2

*4 november 2026*

**Beter**

- Bij Inrichten kun je de hoofdzekering ook op 32 A zetten, of zelf een waarde invullen
- De Engelse teksten zijn natuurlijker: "on solar" en "manually" in plaats van letterlijk vertaald

**Opgelost**

- Wat je huis kan toonde "undefined × undefined A" bij de zekering als je "Weet ik niet" koos; Instellingen ook
- Een thuisbatterij die het huis al heeft, staat bij Wat je huis kan niet meer als "Batterij nodig"

*English*

**Improved**

- In Set up the main fuse can now be 32 A, or a value you enter yourself
- More natural English: "on solar", "surplus solar" and "manually" instead of "on sun", "spare sun" and "by hand"

**Fixed**

- What your house can do showed "undefined × undefined A" for the fuse after choosing "I don't know"; Settings too
- A home battery the house already has no longer shows as "Battery needed" under What your house can do

## 0.115.1

*2 november 2026*

**Opgelost**

- Bij Inrichten ontbraken iconen, zoals bij buiten en de apparaten; daar stond een huisje

*English*

**Fixed**

- Set up was missing icons, such as for outside and the devices; a little house showed instead

## 0.115.0

*2 november 2026*

**Nieuw**

- Nieuwe iconen overal: één set, met een fijne lijn en een zacht vlak in de kleur van het onderwerp; in het menu krijgt waar je bent zijn kleur

*English*

**New**

- New icons everywhere: one set, with a fine line and a soft fill in the colour of the subject; in the menu, where you are gets its colour

## 0.114.4

*2 november 2026*

**Beter**

- Een bewoner zonder account, zoals een kind, is bij Klaarzetten geen open stap meer

**Opgelost**

- Op de telefoon kon het tankje van de boiler op Thuis zijn kleur missen

*English*

**Improved**

- A resident without an account, such as a child, is no longer an open step in Getting ready

**Fixed**

- On the phone, the boiler tank on Home could lose its colour

## 0.114.3

*2 november 2026*

**Opgelost**

- Klaarzetten zei na een update dat de wand nog niet was ingesteld; nu noemt het bij de wand alleen wat de wand zelf zegt dat mist, en onthoudt het zijn melding

*English*

**Fixed**

- After an update, Getting ready said the wall screen was not set up; now it only lists what the wall screen itself reports as missing, and remembers its report

## 0.114.2

*2 november 2026*

**Beter**

- Klaarzetten ziet op welk model Whisper staat en of Tailscale draait: de add-on mag dat nu lezen bij de Supervisor, en verder niets

*English*

**Improved**

- Getting ready sees which model Whisper uses and whether Tailscale is running: the add-on may now read that from the Supervisor, and nothing more

## 0.114.1

*2 november 2026*

**Beter**

- Apparaten zonder ruimte in Home Assistant zijn geen open stap meer: hun kamer kies je in de app
- Terug uit Klaarzetten gaat naar Instellingen, of naar Inrichten als je daarvandaan kwam; Inrichten heeft op de wand ook een sluitknop

**Opgelost**

- Op de telefoon ontbrak de boog van je dag bij Vast en gepland op Te doen
- Met grote letters op de telefoon schoof het tandwiel op Thuis naar een tweede regel; nu blijft alles op één regel en wordt de klok kleiner

*English*

**Improved**

- Devices without an area in Home Assistant are no longer an open step: you choose their room in the app
- Back from Getting ready goes to Settings, or to Set up if you came from there; Set up also has a close button on the wall screen

**Fixed**

- On the phone, the arc of your day was missing under Regular and planned on To do
- With large text on the phone, the gear on Home moved to a second line; now everything stays on one line and the clock gets smaller

## 0.114.0

*2 november 2026*

**Nieuw**

- Klaarzetten per functie, als laatste deel van Inrichten: voor iedereen, gevorderd en expert, met stappen die zichzelf afvinken zodra SunArc ze ziet
- De wand meldt zelf of Fully Kiosk goed staat: de koppeling met de pagina, en of de camera meekijkt
- Bij Functies staan de open stappen voor "Hé huis" en voor het scherm, en de tegel Inrichten noemt wat er nog open is

*English*

**New**

- Getting ready per feature, as the last part of Set up: for everyone, advanced and expert, with steps that tick themselves off as soon as SunArc sees them
- The wall screen reports itself whether Fully Kiosk is set up well: the link with the page, and whether the camera watches
- Features shows the open steps for "Hey house" and for the screen, and the Set up tile says what is still open

## 0.113.0

*2 november 2026*

**Beter**

- Te doen is rustiger: drie kolommen, boodschappen en to-do als tabbladen onder de herinneringen, en je agenda’s ingeklapt tot één regel
- De droger, de wasmachine en de vaatwasser zijn altijd aan te tikken; staat hij nog niet klaar, dan zie je hoe je hem klaarzet
- Over deze app staat ook bij Bewoners en toegang

**Opgelost**

- Op een brede telefoon liet het blad van een apparaat rechts een strook open

*English*

**Improved**

- To do is calmer: three columns, shopping and to-do as tabs under the reminders, and your calendars folded into one line
- The dryer, washing machine and dishwasher can always be tapped; if it is not ready yet, you see how to get it ready
- About this app is also under Residents and access

**Fixed**

- On a wide phone, the sheet of a device left a strip open on the right

## 0.112.0

*2 november 2026*

**Nieuw**

- Een taak als één zin: kies meerdere apparaten per kamer, en lees meteen wat het huis gaat doen. "Elke werkdag om 07:00 gaan de keukenlamp en de hal aan."
- Op Te doen één knop + Nieuw voor een herinnering of een taak, en Vast en gepland als eigen kolom

**Beter**

- Wordt de zolder gebruikt, dan staat het dak in de tekening op een muurtje, zodat de zolder hoger is

*English*

**New**

- A task as one sentence: choose several devices per room, and read right away what the house will do. "Every weekday at 07:00 the kitchen light and the hall turn on."
- On To do one + New button for a reminder or a task, and Regular and planned as its own column

**Improved**

- When the attic is in use, the roof in the drawing stands on a low wall, so the attic is taller

## 0.111.0

*2 november 2026*

**Nieuw**

- Weer in het voorbeeldhuis: een bui op een zomermiddag, sneeuw op een winterochtend, of kies zelf. De panelen, de screens en de regeling doen mee

**Beter**

- In het voorbeeldhuis begint Vandaag om middernacht, ook als je het later op de dag opent
- De add-on is beter afgeschermd: hij kan alleen nog in zijn eigen mappen schrijven
- Begint het te regenen, dan zie je dat meteen, niet pas na tien minuten

**Opgelost**

- Bij Hoe ver je huis is viel in het vak Samen een getal van twee cijfers weg

*English*

**New**

- Weather in the example home: a shower on a summer afternoon, snow on a winter morning, or pick it yourself. The panels, the screens and the control follow along

**Improved**

- In the example home, Today starts at midnight, even when you open it later in the day
- The add-on is better shielded: it can only write in its own folders
- When it starts to rain, you see it right away, not ten minutes later

**Fixed**

- On How far your home is, a two-digit number dropped out of the Together box

## 0.110.1

*2 november 2026*

**Beter**

- Het adres en de sleutel voor Assist staan ingeklapt: met de add-on heb je ze niet nodig

**Opgelost**

- Na verwijderen in HACS bleef de oude map van de koppeling met Assist staan, en verscheen de knop niet. De knop ruimt die map nu op en zet SunArc neer

*English*

**Improved**

- The address and key for Assist are folded away: with the add-on you do not need them

**Fixed**

- After removing it in HACS, the old folder of the Assist link stayed behind and the button did not appear. The button now clears that folder and puts SunArc in

## 0.110.0

*1 november 2026*

**Beter**

- De koppeling met Assist heet nu sunarc: de add-on zet hem over, met één tik bij Bewoners en toegang

*English*

**Improved**

- The Assist link is now called sunarc: the add-on moves it over, with one tap under Residents and access

## 0.109.0

*1 november 2026*

**Nieuw**

- Nieuw bij Vast en gepland: zeg het, of kies het zelf in vier stappen
- De zin en de boog groeien mee terwijl je kiest, en Klaar laat je komende dagen zien
- Klimaat met de hand en witgoed kun je nu ook op een tijd zetten

*English*

**New**

- New under Fixed and planned: say it, or choose it yourself in four steps
- The sentence and the arc grow while you choose, and Done shows your coming days
- Climate by hand and appliances can now be set for a time too

## 0.108.0

*1 november 2026*

**Nieuw**

- Het voorbeeldhuis heeft prijzen, panelen en een aansluiting, en de lijn van nu loopt mee als je de dag afspeelt
- De uitleg in Home Assistant is opnieuw geschreven voor wie begint

**Beter**

- Verwarmt of koelt een apparaat echt, dan staat dat er, ook als SunArc het anders zou doen
- Een kamer op of boven het doel heet niet meer fris
- Vandaag zegt alleen "ging verwarmen" als het apparaat het echt deed, en "met de zon mee" alleen als de zon de reden was
- Overal gewone woorden voor verwarmen

**Opgelost**

- Het comfort wisselde twee keer als twee bewoners vlak na elkaar thuiskwamen
- Het voorbeeldhuis viel weg bij het afspelen van de dag
- De assistent verstaat "zet melk op de boodschappenlijst"
- Op de telefoon viel het blad achter de balk van het voorbeeld
- Vandaag zei na een herstart dat de droger klaar was na 0 minuten

*English*

**New**

- The example home has prices, panels and a connection, and the now line follows when you play the day
- The guide in Home Assistant is rewritten for new users

**Improved**

- When a device really heats or cools, the app says so, even if SunArc would do otherwise
- A room at or above its target is no longer called chilly
- Today only says "started heating" when the device really did, and "along with the sun" only when the sun was the reason
- Plain words for heating everywhere

**Fixed**

- Comfort switched twice when two residents came home shortly after each other
- The example home dropped out while playing the day
- The assistant understands "put milk on the shopping list"
- On the phone the sheet fell behind the example bar
- After a restart, Today said the dryer was done after 0 minutes

## 0.107.0

*1 november 2026*

**Nieuw**

- Tik op een apparaat bij Apparaten: hetzelfde blad als in het huis, met hoe lang, en nieuw: tot het doel
- De droger aanklikbaar: kies hoe laat hij uiterlijk klaar moet zijn, of start hem nu
- SunArc start de droger zelf op zon, of op tijd voor je eindtijd
- Bij Te doen staat bovenaan wat nu met de hand of op zon loopt

**Opgelost**

- Klimaat met de hand: een opdracht kwam niet door bij de dienst

*English*

**New**

- Tap a device on Devices: the same sheet as in the house, with how long, and new: until the target
- The dryer can be tapped: choose when it must be done at the latest, or start it now
- SunArc starts the dryer itself on sun, or in time for your end time
- To do shows at the top what runs by hand or on sun right now

**Fixed**

- Climate by hand: a command did not get through to the service

## 0.106.1

*1 november 2026*

**Beter**

- Het logo op het always-on display van de wand staat klein rechtsboven; de klok staat weer alleen
- De links in de app wijzen naar de nieuwe naam van de repository: SunARC-HA-APP

*English*

**Improved**

- The logo on the always-on display of the wall sits small in the top right; the clock stands on its own again
- The links in the app point to the new name of the repository: SunARC-HA-APP

## 0.106.0

*1 november 2026*

**Nieuw**

- Een voorbeeldhuis om mee te spelen: vanaf het welkom en Inrichten een huis met alles erin, waar elke knop werkt
- Schuif door een zomer- of winterdag en zie wat het huis doet: koelen op zon, de droger, de batterij die 's avonds het huis voedt

**Beter**

- Het welkom toont het logo voluit

*English*

**New**

- An example home to play with: from the welcome and Setup, a home with everything in it, where every button works
- Slide through a summer or winter day and see what the home does: cooling on sun, the dryer, the battery powering the home in the evening

**Improved**

- The welcome shows the full logo

## 0.105.0

*1 november 2026*

**Beter**

- Een eigen beveiligingsprofiel: Home Assistant geeft SunArc nu het hoogste cijfer, 8
- De add-on wordt ondertekend gebouwd, op een vaste basis, en staat als experimenteel tot het echte regelen
- De uitleg van de add-on zegt welke rechten hij vraagt, en waarom

*English*

**Improved**

- Its own security profile: Home Assistant now gives SunArc the highest rating, 8
- The add-on is built signed, on a fixed base, and is marked experimental until real control
- The add-on documentation says which permissions it asks for, and why

## 0.104.0

*1 november 2026*

**Nieuw**

- Klimaat met de hand: op Apparaten zet je de Nest, de airco's, de badkamer, de radiatorknop in de keuken of een paneel op een stekker tot een tijd
- Verwarmen van de zolder gaat nu ook zonder zon: de app zet de airco zelf op verwarmen, en op tijd weer uit

*English*

**New**

- Climate by hand: on Devices you set the Nest, the air conditioners, the bathroom, the kitchen radiator valve or a panel on a plug until a time
- Heating the attic now works without sun too: the app turns the air conditioner to heat itself, and off again on time

## 0.103.0

*1 november 2026*

**Nieuw**

- Vast en gepland: zeg "elke werkdag een kwartier voor zonsondergang de screens dicht", en het huis doet het steeds
- Een eigen pagina met je dag als boog, een schakelaar om te pauzeren, en Aanpassen voor de tijd, de zon en hoe vaak

*English*

**New**

- Regular and planned: say "close the screens a quarter of an hour before sunset every weekday", and the house keeps doing it
- A page of its own with your day as an arc, a switch to pause, and Change for the time, the sun and how often

## 0.102.1

*1 november 2026*

**Beter**

- De assistent verstaat woorden van je huis beter: airco, screen, jacuzzi, plafonnière en welterusten

*English*

**Improved**

- The assistant understands words of your home better: air conditioning, screen, jacuzzi, ceiling light and good night

## 0.102.0

*1 november 2026*

**Nieuw**

- Over deze app: het logo groot en voluit, de versie, wat de naam betekent en waar de broncode staat

**Beter**

- Het logo staat naast de klok, op Thuis staand en op het scherm van de wand als niemand kijkt; een tik opent Over deze app

*English*

**New**

- About this app: the logo large and in full, the version, what the name means and where the source code is

**Improved**

- The logo sits next to the clock, on Home upright and on the wall screen when nobody is looking; a tap opens About this app

## 0.101.0

*1 november 2026*

**Nieuw**

- Onder Wat het huis eerst leert: hoe je huis warmte vasthoudt. Per kamer hoe snel hij afkoelt, wat de zon en elk apparaat doen, en hoe zeker dat al is

**Beter**

- Op tijd warm of koel zegt nu eerlijk dat het wacht tot het huis het stoken kent

*English*

**New**

- Under What the house learns first: how your home holds heat. Per room how fast it cools down, what the sun and each device do, and how sure that is

**Improved**

- Warm or cool on time now honestly says it waits until the house knows the heating

## 0.100.0

*31 oktober 2026*

**Nieuw**

- Bij een thuisbatterij staat welke maat bij je huis past, wat er dan nog van het net kwam, en per uur wanneer hij had bijgesprongen, uit je eigen jaar

**Beter**

- Wat je huis kan en Hoe ver je huis is blijven twee pagina's, rustiger: de tellers en de standen als tekst met een stipje

*English*

**New**

- A home battery shows which size fits your home, what would still have come from the grid, and per hour when it would have stepped in, from your own year

**Improved**

- What your house can do and How far your house is stay two pages, calmer: counts and states as text with a dot

## 0.99.0

*31 oktober 2026*

**Beter**

- Minder losse knoppen: een keuze uit een paar is één balk, en de kaarten van de wand zijn schakelaars
- Onderaan Thuis staan de voorbeeldvragen als tekst, en op Apparaten staan de etiketten in één regel

*English*

**Improved**

- Fewer loose buttons: a choice between a few is one bar, and the wall cards are switches
- At the bottom of Home the example questions are plain text, and Devices shows its tags on one line

## 0.98.0

*31 oktober 2026*

**Beter**

- Ga je vanuit Inrichten naar Home Assistant of een andere pagina, dan kom je op dezelfde stap terug
- Instellingen zonder "1 van 8" en Volgende, en alleen een pil bij wat mist
- Bewoners opent meteen, en de sleutel voor de assistent staat er alleen als hij nog nodig is

*English*

**Improved**

- Go from Set up to Home Assistant or another page, and you come back to the same step
- Settings without "1 of 8" and Next, and a pill only for what is missing
- Residents opens straight away, and the key for the assistant only shows when it is still needed

## 0.97.0

*31 oktober 2026*

**Beter**

- Een kaart die iets meldt, zoals de droger die draait of de GFT aan de straat, staat bovenaan
- Thuis is rustiger: geen sleutel en geen "Kijkt mee" meer, en wat het huis alleen zou doen gloeit niet oranje
- Apparaten zegt "SunArc zou" één keer in plaats van op elke kaart, en noemt ook je panelen bij de stroom
- Vandaag zegt het doel niet meer twee keer

*English*

**Improved**

- A card with news, such as the dryer running or the bins going out, is at the top
- Home is calmer: no spanner and no "Watching", and what the house only would do no longer glows orange
- Devices says "SunArc would" once instead of on every card, and shows your panels in the power bar
- Today no longer repeats the target

## 0.96.0

*31 oktober 2026*

**Beter**

- De kop op Thuis volgt het dagdeel en het weer, zoals "Frisse ochtend" of "Rustige avond", en wisselt een paar keer per dag
- Eronder één samenvatting in plaats van "zou verwarmen" per kamer
- De assistent begroet je met je naam en hoe het nu is, en wisselt zijn vraag en zijn afscheid af
- Chirp en de stem van je toestel zeggen "app" en "airco" weer gewoon

**Opgelost**

- Bij twee kamers stond er "de de zolder"

*English*

**Improved**

- The heading on Home follows the time of day and the weather, such as "A crisp morning" or "A quiet evening", and changes a few times a day
- Below it one summary instead of "would heat" per room
- The assistant greets you by name with how things are now, and varies its question and its goodbye
- Chirp and your device voice say "app" and "airco" normally again

**Fixed**

- With two rooms the text said "the the attic"

## 0.95.0

*31 oktober 2026*

**Nieuw**

- De assistent heeft de zon als stem: de stralen ademen, luisteren mee, draaien als hij nadenkt en springen als hij praat

**Beter**

- De assistent verstaat "dichtdoen", "opendraaien" en "neerlaten", ook als één woord
- Noem je niet welk screen, dan vraagt hij welke; ook als er in de kamer twee hangen
- Een opdracht met een tijd houdt altijd die tijd; begrijpt hij niet wat, dan zegt hij dat eerlijk

**Opgelost**

- "Om half acht" werd soms gelezen als een screen dat half dichtgaat

*English*

**New**

- The assistant has the sun as its voice: the rays breathe, listen along, turn while it thinks and jump when it speaks

**Improved**

- The assistant understands Dutch verbs such as "dichtdoen" and "opendraaien", also written as one word
- If you do not say which screen, it asks which one; also when a room has two
- A command with a time always keeps that time; if it does not understand what, it says so

**Fixed**

- "Om half acht" (half past seven) was sometimes read as a screen going half closed

## 0.94.1

*31 oktober 2026*

**Opgelost**

- De assistent in Home Assistant heeft het teken van SunArc, op licht en donker
- Het tabblad in de browser en de app op je startscherm halen het nieuwe icoon op
- Het logo van de add-on is ook op het donkere thema leesbaar
- In de zijbalk van Home Assistant staat de zon op de horizon
- Bij Inrichten › Een eigen account staat de regel van je tablet niet meer tegen het blok eronder, en de zin eronder is heel

*English*

**Fixed**

- The assistant in Home Assistant shows the SunArc mark, in light and dark
- The browser tab and the app on your home screen fetch the new icon
- The add-on logo is readable in the dark theme too
- The Home Assistant sidebar shows the sun on the horizon
- In Setup › An own account, the row for your tablet no longer touches the block below, and its sentence is no longer cut off

## 0.94.0

*31 oktober 2026*

**Nieuw**

- Smart Climate heet nu SunArc: Autonomous Residential Climate, met een eigen teken van de zon op de horizon
- Een nieuw icoon voor je startscherm, en de add-on heeft een eigen icoon en logo in Home Assistant

**Beter**

- Het teken staat bovenaan de zijbalk, bij Welkom, Inrichten en Inloggen, en aan het eind van de film
- Assist verstaat ook "SunArc"; "Smart Climate" blijft werken

**Opgelost**

- Je spraakassistent "Smart Climate" en de update van de add-on worden met de nieuwe naam nog herkend; er komt geen tweede bij

*English*

**New**

- Smart Climate is now called SunArc: Autonomous Residential Climate, with its own mark of the sun on the horizon
- A new icon for your home screen, and the add-on has its own icon and logo in Home Assistant

**Improved**

- The mark sits at the top of the sidebar, in Welcome, Setup and Sign in, and at the end of the film
- Assist also understands "SunArc"; "Smart Climate" keeps working

**Fixed**

- Your "Smart Climate" voice assistant and the add-on update are still recognised under the new name; no second one is added

## 0.93.0

*30 oktober 2026*

**Nieuw**

- Een groep van Zigbee2MQTT, zoals een plafonnière van drie spots, is één lamp in de app; de spots staan niet meer los

**Beter**

- Bij Praten met je huis staat "vaste antwoorden, zonder AI" of "eigen woorden, met een AI" in plaats van "vaste zinnen"
- Op Apparaten zegt een zin "Smart Climate zou: …" als dat een ander doel is dan het apparaat zelf noemt
- Opbrengst zegt bij je panelen "van je zon" achter het percentage
- Op Thuis telt alleen de bel; de sleutel staat op de telefoon naast de bel en opent meteen de lijst
- Staat "Hé huis" nog niet in de spraakassistent, dan brengen twee knoppen je naar de plekken in Home Assistant

*English*

**New**

- A Zigbee2MQTT group, such as a ceiling light of three spots, is one light in the app; the spots no longer show separately

**Improved**

- Talk to your house says "fixed answers, without AI" or "own words, with an AI" instead of "fixed sentences"
- On Devices a sentence says "Smart Climate would: …" when that is a different target than the device itself names
- Energy says "of your sun" after the percentage at your panels
- On Home only the bell counts; on the phone the wrench sits next to the bell and opens the list straight away
- If "Hey house" is not in the voice assistant yet, two buttons take you to the places in Home Assistant

## 0.92.0

*30 oktober 2026*

**Beter**

- Bij Inrichten kies je bij vloerverwarming of hij op water of elektrisch is; elektrisch gaat aan met elke thermostaat, zoals die in de badkamer
- Lampen zonder kamer krijgen een kamer voorgesteld op een woord uit hun naam, zoals "Spot 1 Matts" bij Slaapkamer Matts of "Spot hal" bij de Entree
- De add-on heeft in Home Assistant een eigen uitleg, en zijn instellingen hebben een naam; de technische staan bij de ongebruikte opties
- Wat na Inrichten nog mist, heet nu Mist nog; een stap die al is ingevuld, telt daar niet meer mee
- Thuis zegt in de schaduw "Het huis kijkt mee"

**Opgelost**

- Op de eerste dag zeiden de assistent en het weer dat de panelen bijna niets leverden; ze lezen de dag nu net als Vandaag uit Home Assistant
- Een buitentemperatuur die in één woord heet, zoals Buitentemperatuur, wordt bij het begin gevonden
- Een lampgroep die in Home Assistant niet beschikbaar is, staat niet meer als losse lamp naast zijn lampen
- Het welkom telt de etages zoals Inrichten, en gaat na het opslaan meteen naar de eerste stap
- Een bevestigde ligging van de panelen telt bij Instellingen als gekozen

*English*

**Improved**

- In Set up you choose whether underfloor heating runs on water or electricity; electric runs on any thermostat, such as the one in the bathroom
- Lights without a room get one suggested from a word in their name, such as "Spot 1 Matts" for Bedroom Matts or "Hall spot" for the Entrance
- The add-on has its own documentation in Home Assistant, and its settings have a name; the technical ones are with the unused options
- What is still missing after Set up is now called Still missing; a step that is already filled in no longer counts there
- Home says "The house is watching" while in shadow mode

**Fixed**

- On the first day the assistant and the weather said the panels delivered almost nothing; they now read the day from Home Assistant, like Today
- An outdoor temperature named as one word, such as Buitentemperatuur, is found at the start
- A light group that is unavailable in Home Assistant no longer shows as a separate light next to its lights
- The welcome counts the floors like Set up, and goes straight to the first step after saving
- A confirmed panel orientation counts as chosen under Settings

## 0.91.0

*30 oktober 2026*

**Nieuw**

- Ben je thuis, dan staan je eigen agenda’s ook op de wand, met je naam erbij; ga je weg, dan verdwijnen ze weer

*English*

**New**

- When you are home your own calendars also show on the wall, with your name; when you leave they disappear again

## 0.90.1

*30 oktober 2026*

**Beter**

- Bij Instellingen is Inrichten een tegel, op de wand en op je telefoon; de losse knop bovenin is weg
- Op Thuis staat geen knop Buiten meer: buiten tik je aan op het huis, zoals een kamer
- Bij Jij staat geen rij Herinneringen naar meer: een herinnering gaat naar dezelfde telefoon als je meldingen

*English*

**Improved**

- Under Settings, Set up is a tile, on the wall and on your phone; the separate button at the top is gone
- Home no longer has an Outside button: tap outside on the house, like a room
- You no longer has a Reminders go to row: a reminder goes to the same phone as your notifications

## 0.90.0

*30 oktober 2026*

**Nieuw**

- Vraag iets voor later: "zet over vijf minuten de lamp in de keuken aan" of "doe na zonsondergang de screens dicht". Het staat bij Te doen onder Gepland, met een kruisje om te annuleren
- Bij de boodschappen en to-do haal je de afgevinkte in één keer weg
- Bij Instellingen een tegel Jij; op de wand staat daar Dit scherm

**Beter**

- De assistent kent ook "wat staat er dinsdag op de agenda", overmorgen en volgende week
- Op de wand staat geen knop meer naar jouw agenda’s: een scherm heeft er geen
- Op een lange lijst zie je alles wat open is en alleen de laatste vijf afgevinkte

**Opgelost**

- "Over 5 minuten" zette de lamp op 5% in plaats van hem later aan te doen
- Afvinken deed niets als dezelfde naam al eens afgevinkt op de lijst stond

*English*

**New**

- Ask for something later: "turn on the kitchen light in five minutes" or "close the screens after sunset". It shows under To do, Planned, with a cross to cancel
- On the shopping and to-do lists you remove the ticked items in one go
- Settings has a You tile; on the wall it shows This screen

**Improved**

- The assistant also knows "what is on the calendar on Tuesday", the day after tomorrow and next week
- The wall no longer shows a button to your calendars: a screen has none
- On a long list you see everything open and only the last five ticked items

**Fixed**

- "In 5 minutes" set the light to 5% instead of turning it on later
- Ticking an item did nothing when the same name was ticked on the list before

## 0.89.0

*30 oktober 2026*

**Nieuw**

- Te doen is een eigen tab: je herinneringen, de agenda van twee weken en de boodschappen en to-do op één pagina
- Instellingen heeft een groep Assistent, met Praten met je huis, Stem en luisteren en Te doen bij elkaar

**Beter**

- Op de telefoon staan de tabs als iconen; de tab waar je bent staat er met zijn naam bij
- De kaart Te doen op Thuis is een gewone kaart: verbergen en verplaatsen doe je bij Thuis aanpassen
- Te doen loopt mee in Inrichten, de rondleiding, Wat je huis kan en de zonnewaaier

**Opgelost**

- Een tik op een straal van de zonnewaaier geeft geen blauw vak meer

*English*

**New**

- To do is a tab of its own: your reminders, two weeks of calendar and the shopping and to-do lists on one page
- Settings has an Assistant group, with Talk to your house, Voice and listening and To do together

**Improved**

- On the phone the tabs are icons; the tab you are on shows its name too
- The To do card on Home is a regular card: hide and move it under Customise Home
- To do is part of Set up, the tour, What your house can do and the sun fan

**Fixed**

- Tapping a ray of the sun fan no longer shows a blue box

## 0.88.1

*30 oktober 2026*

**Beter**

- De kaart Te doen staat altijd op Thuis als Te doen aan staat, ook als er niets is, met het afval van de hele week
- Bij Functies › Te doen kies je de lijsten en agenda’s uit een keuzelijst in plaats van een rij knoppen
- Vanuit Te doen en Functies kom je met één tik bij je eigen agenda’s bij Jij, waar je er meer tegelijk kiest

*English*

**Improved**

- The To do card is always on Home when To do is on, even when there is nothing, with the waste collection of the whole week
- Under Features › To do you choose the lists and calendars from a drop-down instead of a row of buttons
- From To do and Features one tap takes you to your own calendars under You, where you choose several at once

## 0.88.0

*30 oktober 2026*

**Nieuw**

- Te doen: zeg "herinner me om acht uur aan de container" of "zet melk op de boodschappen". Op het tijdstip zegt de wand het hardop en krijg je een melding op je telefoon
- Een kaart Te doen op Thuis met het afval van morgen, je volgende herinnering en de boodschappen; een tik opent je herinneringen, de week en je lijsten om af te vinken
- Vraag "wanneer komt het GFT?", "wat staat er op de boodschappenlijst?" of "wat staat er morgen?"
- Kies bij Jij je eigen agenda’s, ook de gezinsagenda, of zet het uit; bij Functies welke lijsten en agenda’s van het huis zijn

*English*

**New**

- To do: say "remind me at eight about the bin" or "put milk on the shopping list". At that time the wall says it out loud and you get a notification on your phone
- A To do card on Home with tomorrow’s waste collection, your next reminder and the shopping list; a tap opens your reminders, the week and your lists to tick off
- Ask "when is the green bin collected?", "what is on the shopping list?" or "what is on tomorrow?"
- Choose your own calendars under You, including the family calendar, or turn it off; under Features which lists and calendars belong to the house

## 0.87.1

*30 oktober 2026*

**Beter**

- Het huis zet een bijna goed verstaan woord ook op klank recht: "sitoek" is de zithoek, "koot" is koud. Zo verstaat het snellere Whisper-model (base-int8) je net zo goed als het grote, in een derde van de tijd

**Opgelost**

- Met de tv aan of geroezemoes in de kamer luisterde het huis soms nog lang door na je zin; nu is je eigen stem de maat, en na twee seconden zonder woord van jou is je zin klaar

*English*

**Improved**

- The house also corrects a nearly understood word by sound, so the faster Whisper model (base-int8) understands you as well as the large one, in a third of the time

**Fixed**

- With the TV on or chatter in the room the house sometimes kept listening long after your sentence; now your own voice is the measure, and after two seconds without a word from you your sentence is done

## 0.87.0

*30 oktober 2026*

**Beter**

- Praten met je huis bij Functies opnieuw ingedeeld, zoals Stem en luisteren: links het brein met het model als kaart, vandaag in drie getallen en de week in staafjes; rechts wat de assistent mag bedienen, met zinnen om te proberen
- Te traag of fouten zie je meteen naast de kop

*English*

**Improved**

- Talking to your home under Features rearranged, like Voice and listening: on the left the brain with the model as a card, today in three numbers and the week in bars; on the right what the assistant may operate, with sentences to try
- Too slow or errors shows right next to the heading

## 0.86.1

*29 oktober 2026*

**Beter**

- Is het taalmodel te traag, dan hoor je meteen het vaste antwoord in plaats van eerst vijf seconden te wachten; eens in de tien minuten probeert de assistent het opnieuw

*English*

**Improved**

- If the language model is too slow, you hear the fixed answer straight away instead of waiting five seconds first; every ten minutes the assistant tries again

## 0.86.0

*29 oktober 2026*

**Nieuw**

- Hoe ver je huis is: alles wat je huis met Home Assistant doet als zonnewaaier, met hoe ver het is en wanneer het klimaat zelf regelt
- Tik op een straal voor wat het huis al weet en wat nog komt
- Open het met de kleine waaier op de kaart Wat je huis kan bij Instellingen, of met de knop op Wat je huis kan

**Beter**

- Leert nog heeft een eigen kleur, zodat je het onderscheidt van Kijkt mee

*English*

**New**

- How far your house is: everything your house does with Home Assistant as a sun fan, with how far along it is and when the climate takes over
- Tap a ray to see what the house already knows and what is still to come
- Open it with the small fan on the What your house can do card in Settings, or with the button on What your house can do

**Improved**

- Still learning has its own colour, so you can tell it apart from Watching

## 0.85.0

*29 oktober 2026*

**Nieuw**

- De assistent onthoudt het gesprek: zeg "doe maar terug" en het licht, de screens of de verwarming staan weer zoals ze waren
- Meer in één zin: "screens dicht en de lamp in de zithoek aan" doet allebei
- Met een taalmodel maakt de assistent een plan ("het is hier zo donker en ik ga film kijken") en beantwoordt hij vragen over vandaag en gisteren
- Bij Functies › Praten zie je hoeveel vragen er vandaag naar het taalmodel gingen en hoe snel het antwoordde

**Beter**

- Een getal met een komma klinkt nu goed: "21 komma 5 graden"

**Opgelost**

- Bij "Dit apparaat" hoor je het voorbeeld nu ook echt; aan de wand spreekt Fully Kiosk als het scherm zelf geen stem heeft

*English*

**New**

- The assistant remembers the conversation: say "undo" and the lights, the screens or the heating are back the way they were
- More in one sentence: "screens down and the lamp in the sitting area on" does both
- With a language model the assistant makes a plan ("it is so dark here and I am going to watch a film") and answers questions about today and yesterday
- Under Features › Talking you see how many questions went to the language model today and how fast it answered

**Improved**

- A number with a decimal comma now sounds right in Dutch

**Fixed**

- With "This device" you now really hear the example; on the wall Fully Kiosk speaks when the screen itself has no voice

## 0.84.0

*29 oktober 2026*

**Nieuw**

- Kies de stem van je huis bij Functies › Stem en luisteren: vrouw of man, de heldere stemmen van Google of een stem in huis, en tik op ▶ om hem eerst te horen

**Beter**

- Stem en luisteren staan samen op één plek; de lijst met spraakassistenten en "Waar de stem vandaan komt" zijn weg, want de app regelt dat zelf
- Kies je de stem van dit apparaat, dan spreekt ook de wand daarmee

*English*

**New**

- Choose the voice of your house under Features › Voice and listening: female or male, the clear Google voices or a voice at home, and tap ▶ to hear it first

**Improved**

- Voice and listening are together in one place; the list of voice assistants and "Where the voice comes from" are gone, because the app takes care of it
- If you choose the voice of this device, the wall speaks with it too

## 0.83.0

*29 oktober 2026*

**Beter**

- Het huis verstaat je veel sneller: je zin gaat rechtstreeks naar Whisper in huis, in plaats van via de spraakassistent van Home Assistant
- "Doe de screens naar beneden" doet ze allebei; bij één screen vraagt het huis welke, en "allebei" kan ook
- Na een opdracht sluit het venster vanzelf; het luistert alleen door als het huis iets terugvraagt

**Opgelost**

- Op een keuze tikken, zoals "groot", werd soms een andere vraag

*English*

**Improved**

- The house understands you much faster: your sentence goes straight to Whisper at home instead of through the Home Assistant voice assistant
- "Lower the screens" lowers both; with one screen the house asks which, and "both" works too
- After a command the window closes by itself; it only keeps listening when the house asks something back

**Fixed**

- Tapping a choice, such as "large", sometimes turned into a different question

## 0.82.0

*29 oktober 2026*

**Nieuw**

- "Het is koud in de woonkamer" maakt het nu echt warmer: de assistent zet de dagtemperatuur van je eigen regeling een graad hoger, tot 22:00, en daarna weer terug. Aan te zetten bij Functies › Praten

**Beter**

- 's Nachts zet de assistent de verwarming eerst weer aan; je eigen timer zet hem na twee uur terug

*English*

**New**

- "It is cold in the living room" now really makes it warmer: the assistant raises the day temperature of your own control by one degree until 22:00, then sets it back. Turn it on under Features › Talking to your house

**Improved**

- At night the assistant first turns the heating back on; your own timer sets it back after two hours

## 0.81.0

*29 oktober 2026*

**Nieuw**

- Zeg wat je voelt: "het is donker in de keuken" doet het licht aan, "het is hier zo fel" dimt het, en "het is koud in de woonkamer" begrijpt het huis als verwarmen
- Licht dat bij het moment past: overdag helder, 's avonds warm, 's nachts zacht
- 's Avonds vraagt het huis of je de sfeerverlichting wilt

**Beter**

- Zijn er twee screens of meer kamers, dan vraagt het huis welke ("klein of groot?") en begrijpt het "de grote"; tikken op een keuze kan ook
- De assistent kent de delen van een kamer, zoals de zithoek

*English*

**New**

- Say how it feels: "it is dark in the kitchen" turns the light on, "it is too bright here" dims it, and "it is cold in the living room" is understood as heating
- Light that suits the moment: bright during the day, warm in the evening, soft at night
- In the evening the house asks whether you would like the mood lighting

**Improved**

- With two screens or several rooms, the house asks which one ("small or large?") and understands "the large one"; you can also tap a choice
- The assistant knows the parts of a room, such as the seating area

## 0.80.0

*29 oktober 2026*

**Nieuw**

- Stel per scherm in hoe gevoelig "Hé huis" is: de app hoort het wekwoord nu zelf, en Functies › Praten zegt hoe vaak het huis vandaag wakker werd
- Kies hoe lang het huis wacht na je laatste woord: Vlot, Normaal of Rustig

**Beter**

- Hoort het huis "Hé huis" maar komt er geen vraag, dan sluit het stil, zonder "niet verstaan"
- Een halve zin ("zet de lamp in de …") wacht op de rest, in plaats van meteen te antwoorden

**Opgelost**

- Het huis antwoordde soms al voordat je uitgesproken was

*English*

**New**

- Set per screen how sensitive "Hé huis" is: the app now hears the wake word itself, and Features › Talking to your house shows how often the house woke up today
- Choose how long the house waits after your last word: Quick, Normal or Relaxed

**Improved**

- If the house hears "Hé huis" but no question follows, it closes quietly instead of saying it did not understand
- Half a sentence ("turn on the …") waits for the rest instead of being answered straight away

**Fixed**

- The house sometimes answered before you had finished speaking

## 0.79.3

*29 oktober 2026*

**Nieuw**

- Het always-on display toont overdag de baan van de zon rond het huis, met een stip per uur

*English*

**New**

- The always-on display shows the path of the sun around the house during the day, with a dot for each hour

## 0.79.2

*29 oktober 2026*

**Nieuw**

- Vraag de assistent of er iemand thuis is, hoeveel er vandaag terugging naar het net, of de droger nog draait

**Beter**

- Wat kost de stroom? noemt eerst het hele huis deze maand, met het gas en de vaste kosten, en dan de apparaten met een meter
- De borderverlichting gloeit zachter, alleen in de border zelf

**Opgelost**

- Zet de airco aan zegt wat hij zou doen en dat schakelen nog niet mag, in plaats van hoe het nu staat; zonder kamer vraagt hij welke

*English*

**New**

- Ask the assistant whether anyone is home, how much went back to the grid today, or whether the dryer is still running

**Improved**

- What does electricity cost? first gives the whole house this month, with gas and the fixed costs, then the devices with a meter
- The border lights glow more softly, only in the border itself

**Fixed**

- Turn on the air conditioner says what it would do and that it may not switch yet, instead of how things are now; without a room it asks which

## 0.79.1

*29 oktober 2026*

**Opgelost**

- De film toont bij Je apparaten weer de temperatuur in het rondje, en is ook in het lichte thema goed te lezen
- De assistent kent de woonkamer ook als huiskamer of living room en de zolder als attic, en zegt een onbekende kamer zonder sfeerzinnetje erachter

*English*

**Fixed**

- The film shows the temperature in the ring at Your devices again, and is easy to read in the light theme too
- The assistant also knows the living room and the attic by those names, and says an unknown room without a friendly sentence after it

## 0.79.0

*29 oktober 2026*

**Nieuw**

- Sluipverbruik: tik op een staaf voor die nacht of maand, met hoeveel het boven of onder je gewone nacht lag
- Sluipverbruik ziet het ook als het vaak meer is maar niet elke nacht, zoals hier sinds augustus; wat je zegt dat het is, blijft gelden
- De wand in Fully Kiosk: de camera van de wand wekt het scherm, en bij Functies › Scherm uit zie je of het werkt

**Beter**

- Buiten heeft elk deel en elke zone een vaste plek: geen Naar links en Naar rechts meer, en Weghalen in plaats van Kamer weghalen
- Een lamp die uit is, toont de helderheid niet meer vol, en geen scène als gekozen
- Apparaten zegt het niet meer twee keer: geen "Verwarmen naar 20°" onder "Verwarmen naar 20°"
- Hoe voelt het nu? begint bij de kamer beneden, en de pagina’s laden sneller doordat ze niets dubbel ophalen

**Opgelost**

- Zet Fully Kiosk het scherm aan, dan staat de klok erop in plaats van een zwarte pagina; zonder bewegingsmelder staat er niet meer dat beweging het scherm aanzet
- Waarom een kamer met alleen een airco op zon wacht: omdat die alleen op zon verwarmt of koelt, niet "omdat het er kouder is dan het doel"
- Een kamer opent ook op de naam van zijn regeling, en anders de kamer beneden in plaats van de zolder

*English*

**New**

- Standby use: tap a bar for that night or month, with how far it was above or below your usual night
- Standby use also notices when it is often higher but not every night, as here since August; what you say it is keeps counting
- The wall screen in Fully Kiosk: the camera of the wall screen wakes it, and Features › Screen off shows whether it works

**Improved**

- Outside, each part and each zone has a fixed place: no more To the left and To the right, and Remove instead of Remove room
- A light that is off no longer shows full brightness, nor a scene as chosen
- Devices no longer says things twice: no "Heating to 20°" under "Heating to 20°"
- How does it feel? starts with the room downstairs, and pages load faster because nothing is fetched twice

**Fixed**

- When Fully Kiosk turns the screen on, the clock shows instead of a black page; without a motion sensor it no longer says movement turns the screen on
- Why a room with only an air conditioner on sun waits: because it only heats or cools on sun, not "because it is colder than the target"
- A room also opens by the name of its zone, and otherwise the room downstairs instead of the attic

## 0.78.1

*28 oktober 2026*

**Beter**

- Licht buiten is goed te zien: de border kleurt over de hele lengte mee, het tuinhuis straalt naar buiten en de spots onder het overstek geven een plas licht
- Wat is er rond je huis?: alleen aanvinken, het komt op zijn vaste plek; bij elk deel een knop naar zijn lampen en zones
- Bij de zones staat hoe je een lamp in een zone zet, en het blad buiten heeft er een link naar

**Opgelost**

- Een lamp buiten schakelen slaat meteen om, ook in het huis; eerst wachtte de schakelaar op de lamp

*English*

**Improved**

- Outdoor light is easy to see: the border lights up along its whole length, the shed glows outward and the canopy spots cast a pool of light
- What is around your house?: just tick it, it goes in its fixed place; for each part a button to its lights and zones
- The zones explain how to put a light in a zone, and the outdoor sheet links to it

**Fixed**

- Switching an outdoor light flips at once, in the house too; before, the switch waited for the light

## 0.78.0

*28 oktober 2026*

**Nieuw**

- Buiten op Thuis: een tik op de oprit, de garage of een zone in de tuin opent een blad met de lampen, en je blijft op Thuis
- Alles buiten: elk deel aan of uit, en alles buiten uit in één keer, met de knop Buiten op de wand
- De tuin in zones: de border, het terras, het gazon en het tuinhuis met zijn overstek, elk aan te tikken

**Beter**

- De lampen in de border staan op hun plek in hun eigen kleur; het terras en het overstek lichten op
- Bij de oprit de auto aan de lader, en de garagedeur open of dicht (alleen bekijken)
- De helderheid van het always-on display met een schuif van 0 tot 100, standaard 75 overdag en 25 in de avond
- De helling van het dak vul je precies in bij Zonnepanelen › Zelf aanpassen

**Opgelost**

- De baan van de zon uit bij Weergave haalt nu ook de stippelboog op Thuis weg; eerst veranderde daar niets

*English*

**New**

- Outside on Home: tap the driveway, the garage or a garden zone to open a sheet with its lights, and you stay on Home
- Everything outside: each part on or off, and everything outside off at once, with the Outside button on the wall
- The garden in zones: the border, the patio, the lawn and the shed with its canopy, each one tappable

**Improved**

- The border lights are drawn where they are, in their own colour; the patio and the canopy light up
- At the driveway the car on the charger, and the garage door open or closed (view only)
- The brightness of the always-on display with a slider from 0 to 100, by default 75 by day and 25 in the evening
- Enter the exact roof pitch in Solar panels › Adjust yourself

**Fixed**

- Turning off the path of the sun in Display now also removes the dotted arc on Home; before, nothing changed there

## 0.77.0

*28 oktober 2026*

**Nieuw**

- Bij Zonnepanelen staat de echte zon, met een ring van de dag rond het huis: elk uur een stip, en de tijd van opkomst en ondergang
- Zonnepanelen › Zelf aanpassen: kies of de nok langs of haaks op de straat loopt
- Jij › Weergave: de baan van de zon aan of uit

**Beter**

- Het dak volgt je huis: met de nok langs de straat liggen de panelen op de voorkant, en het dak is zo steil als gemeten
- Het kompas draait met de voorgevel, en op Thuis staat de zon aan de goede kant

*English*

**New**

- Solar panels shows the real sun, with a ring of the day around the house: a dot every hour, and the time of sunrise and sunset
- Solar panels › Adjust yourself: choose whether the ridge runs along or at right angles to the street
- You › Display: the path of the sun on or off

**Improved**

- The roof follows your house: with the ridge along the street the panels are on the front, and the roof is as steep as measured
- The compass turns with the front of the house, and on Home the sun is on the right side

## 0.76.0

*28 oktober 2026*

**Nieuw**

- Terug naar standaard: bij een kamer en voor het hele huis in Comfort, bij elk onderdeel van Functies, en bij Jij voor het uiterlijk en de kaarten

**Beter**

- Een nieuw huis begint zuinig: 20° overdag, 16° 's nachts, weg 15°, koelen vanaf 25°, de dag vanaf 7:00
- Comfort en Inrichten blijven binnen wat de apparaten van een kamer kunnen; eerst werd het hele comfort dan geweigerd

*English*

**New**

- Back to default: for a room and for the whole house in Comfort, for every part of Features, and in You for the look and the cards

**Improved**

- A new house starts economical: 20° during the day, 16° at night, away 15°, cooling from 25°, the day from 7:00
- Comfort and Set up stay within what the devices in a room can do; before, the whole comfort was refused

## 0.75.0

*28 oktober 2026*

**Nieuw**

- Praten werkt meteen met de stem van je telefoon of tablet: hij leest voor en verstaat je via de browser, zonder iets te installeren
- Helemaal in huis: Inrichten zet Whisper, Piper en openWakeWord op een rij, en één knop maakt de spraakassistent
- Inrichten heeft een stap Hoe praat je huis?, en Functies › Praten de keuze waar de stem vandaan komt

**Beter**

- Op je startscherm staat bij Functies onder Gevorderd: de app van Home Assistant is de gewone weg

**Opgelost**

- Op de telefoon kun je bij een kamer vanuit elke etage naar elke andere; de lucht van het huis lag over de knoppen
- Bij sluipverbruik op de telefoon staat het hele getal op de as, ook boven de 1.000 W
- Inrichten op de telefoon: geen welkom meer onder elke stap, en Terug, Later en Volgende blijven onderin

*English*

**New**

- Talking works right away with the voice of your phone or tablet: it reads aloud and understands you through the browser, with nothing to install
- Entirely at home: Set up lists Whisper, Piper and openWakeWord, and one button makes the voice assistant
- Set up has a step How does your house talk?, and Features › Talking the choice where the voice comes from

**Improved**

- On your home screen is now under Advanced in Features: the Home Assistant app is the usual way

**Fixed**

- On the phone you can go from every floor to every other floor in a room; the sky of the house lay over the buttons
- Standby use on the phone shows the whole number on the axis, also above 1,000 W
- Set up on the phone: no welcome below every step any more, and Back, Later and Next stay at the bottom

## 0.74.0

*28 oktober 2026*

**Nieuw**

- De assistent gaat vanzelf aan bij Inrichten › Klaar, terwijl de film speelt: de koppeling erin, Home Assistant herstart, Smart Climate toegevoegd; daarna begint de rondleiding. Bij Toegang met één knop
- Inrichten heeft een stap Een eigen account voor de wand: waarom, en hoe je het maakt

**Beter**

- In de app van Home Assistant staat Smart Climate meteen over het hele scherm; de rondleiding wijst de knop terug naar Home Assistant aan

*English*

**New**

- The assistant turns on by itself at Set up › Done, while the film plays: the integration goes in, Home Assistant restarts, Smart Climate is added; then the tour begins. In Access with one button
- Set up has a step Its own account for the wall: why, and how to make it

**Improved**

- In the Home Assistant app, Smart Climate now opens full screen; the tour points out the button back to Home Assistant

## 0.73.1

*25 oktober 2026*

**Nieuw**

- Bij de bel een melding als een apparaat uit Home Assistant verdwijnt, net als bij een nieuw apparaat; wat je zelf verbergt telt niet, en komt het terug, dan gaat de melding weg

*English*

**New**

- The bell now also tells you when a device disappears from Home Assistant, just like a new device; what you hide yourself does not count, and if it comes back the notification goes away

## 0.73.0

*25 oktober 2026*

**Nieuw**

- De kaart Deurbel is de kaart Camera’s: kies zoveel camera’s als je wilt, ze schikken zich naar de maat van de kaart, en een tik maakt het beeld groot en live, met de andere camera’s eronder
- Bij elk beeld wat de camera nu ziet (een persoon, een voertuig, een dier of beweging) of wanneer het laatst; bij de deurbel wanneer er werd aangebeld

*English*

**New**

- The Doorbell card is now the Cameras card: choose as many cameras as you like, they arrange themselves to the size of the card, and a tap makes the picture large and live, with the other cameras below
- With each picture what the camera sees now (a person, a vehicle, an animal or motion) or when it last did; with the doorbell when someone rang

## 0.72.1

*25 oktober 2026*

**Opgelost**

- Bij Inrichten › Je schermen blijft de kleine wand met het huis binnen zijn kader, ook met veel kaarten

*English*

**Fixed**

- In Setup › Your screens the small wall with the house stays inside its frame, also with many cards

## 0.72.0

*25 oktober 2026*

**Nieuw**

- De film is een trailer: een camera vliegt over je huis, door de etages en naar het dak, de apparaten en de assistent komen voorbij, en hij eindigt met Naar je huis of Nog een keer
- Inrichten begint met een groot welkom: je huis bouwt zich op uit Home Assistant, met wat er gevonden is als labels eraan

**Opgelost**

- Gewoner Nederlands bij verwarmen: een kamer wordt verwarmd, de zolder wordt warm

*English*

**New**

- The film is a trailer: a camera flies over your house, through the floors and to the roof, the devices and the assistant pass by, and it ends with To your house or Play again
- Setup starts with a big welcome: your house builds itself up from Home Assistant, with what was found as labels on it

**Fixed**

- Clearer wording when a room is being heated

## 0.71.0

*25 oktober 2026*

**Beter**

- De wand neemt de weergave, het thema en de taal over van wie hij volgt, net als de kaarten en de kleur
- Seizoenen, het weer en feestdagen staan bij Weergave, onder Huis

*English*

**Improved**

- The wall takes the display, theme and language of the person it follows, like the cards and the colour
- Seasons, the weather and holidays are in Display, under House

## 0.70.0

*25 oktober 2026*

**Nieuw**

- Bij Weergave: seizoenen, het weer en feestdagen in het huis aan of uit, met een pompoen met Halloween, lichtjes met Kerst, vuurwerk met Oud en Nieuw en eieren met Pasen

**Beter**

- Bij aanbellen staat het live beeld van de deurbel er meteen, ook als er al schermen meekijken of het scherm net aangaat
- Is de zon onder of komt hij vandaag niet meer, dan zegt het huis dat, in plaats van dat het op zon wacht

**Opgelost**

- Een kamer heet alleen nog verwarmd als het apparaat echt stookt, niet als het alleen op verwarmen staat
- De zon komt in het huis op aan de kant van het oosten, en de schaduw valt van de zon af
- De tuin en het tuinhuis zijn in het huis aan te tikken
- Een droger die je zelf startte, heet zo, en niet Start op zon

*English*

**New**

- In Display: seasons, the weather and holidays in the house on or off, with a pumpkin at Halloween, lights at Christmas, fireworks at New Year and eggs at Easter

**Improved**

- When someone rings, the live doorbell picture is there right away, also when other screens are watching or the screen has just turned on
- When the sun is down or will not come back today, the house says so instead of waiting for sun

**Fixed**

- A room is only called heated when the device really heats, not when it is just set to heat
- The sun rises in the house on the east side, and the shadow falls away from the sun
- The garden and the shed can be tapped in the house
- A dryer you started yourself says so, not Start on sun

## 0.69.0

*25 oktober 2026*

**Nieuw**

- Inrichten zegt per airco en thermostaat wat hij kan: wat Home Assistant zegt, met een tip per merk, een voorstel als het bereik niet kan kloppen, en een vraag als hij iets niet zegt

**Beter**

- Als thermostaat van de ketel stelt de app eerst een Nest, tado of Netatmo voor

*English*

**New**

- Setup shows for each air conditioner and thermostat what it can do: what Home Assistant says, with a tip per brand, a suggestion when the range cannot be right, and a question when it does not say something

**Improved**

- As the boiler thermostat the app now suggests a Nest, tado or Netatmo first

## 0.68.0

*25 oktober 2026*

**Nieuw**

- Een huis zonder panelen: de tab heet Verbruik, en de kaart Vandaag zegt wat het huis gebruikte en kostte, met de daluren van vandaag
- Een huis zonder slimme meter: de app schat wat je panelen over hebben en wat je zelf gebruikte, en zegt het erbij

**Beter**

- Wat je huis kan zegt wat er zonder slimme meter of zonder panelen bij kan

*English*

**New**

- A house without solar panels: the tab is called Usage, and the Today card shows what the house used and cost, with the off-peak hours of today
- A house without a smart meter: the app estimates what your panels have spare and what you used yourself, and says so

**Improved**

- What your house can do says what can be added without a smart meter or solar panels

## 0.67.2

*25 oktober 2026*

**Opgelost**

- Op de telefoon staat het huis op Thuis weer boven de stroombalk; sinds 0.67.1 zakte het eronder

*English*

**Fixed**

- On the phone the house on Home sits above the power bar again; since 0.67.1 it slid underneath

## 0.67.1

*25 oktober 2026*

**Beter**

- Een verdieping staat in de kamer op hoogte, met de verdieping eronder en erboven vaag erbij

**Opgelost**

- Thuis loopt weer vlot op een oudere tablet aan de wand: wat beweegt in het huis, kost het beeld eronder geen schilderwerk meer
- In de grafiek Vandaag loopt een blokje van de airco niet meer door de naam
- Bij Aanpassen op de wand staan de knoppen van een smalle kaart weer heel in beeld, ook bij Sluipverbruik

*English*

**Improved**

- A floor sits at its height in the room view, with the floors below and above faintly shown

**Fixed**

- Home runs smoothly again on an older tablet on the wall: what moves in the house no longer repaints the picture underneath
- In the Today chart an air conditioning block no longer runs through its name
- When customising the wall, the buttons of a narrow card are fully visible again, Standby use included

## 0.67.0

*25 oktober 2026*

**Nieuw**

- De app werkt ook in een huis zonder slimme verwarming of airco: licht, schermen, energie, op zon en de assistent, en comfort per kamer kan erbij

**Opgelost**

- De test van het sluipverbruik hangt niet meer af van hoe laat hij draait

*English*

**New**

- The app also works in a house without smart heating or air conditioning: lights, blinds, energy, on sun and the assistant, and comfort per room can be added

**Fixed**

- The standby use test no longer depends on the time it runs

## 0.66.0

*25 oktober 2026*

**Nieuw**

- Sluipverbruik: wat je huis elke nacht gebruikt als er niets draait, met een eigen scherm onder Opbrengst, elke nacht en elke maand sinds je meter
- Een melding de ochtend erna als een nacht 50 W of meer boven je gewone nacht lag, en een kaart Sluipverbruik voor Thuis

**Beter**

- De assistent weet je sluipverbruik, en Wat je huis kan heeft het bij Kosten

*English*

**New**

- Standby use: what your house uses every night when nothing runs, with its own screen under Energy, every night and every month since your meter
- A notification the morning after when a night was 50 W or more above your usual night, and a Standby use card for Home

**Improved**

- The assistant knows your standby use, and What your house can do lists it under Costs

## 0.65.0

*24 oktober 2026*

**Nieuw**

- Kamers en indeling werkt zoals Energie: op de telefoon eerst de lijst met etages, Buiten en wat nog in te delen is; op de wand de lijst en het gekozen deel naast elkaar
- Bij Buiten zet je aan wat er rond het huis is, met hetzelfde lijstje als bij Inrichten

**Opgelost**

- Een garage of carport die je buiten toevoegt, staat nu ook in de tekening, ook bij Kamers en indeling en bij een kamer
- Een ruimte die een carport is, kun je bij Inrichten nu aan de carport koppelen

*English*

**New**

- Rooms and layout works like Energy: on the phone first the list of floors, Outside and what is still to arrange; on the wall the list and the chosen part side by side
- At Outside you turn on what is around the house, with the same list as in Set up

**Fixed**

- A garage or carport you add outside now shows in the drawing, also in Rooms and layout and for a room
- An area that is a carport can now be linked to the carport in Set up

## 0.63.1

*24 oktober 2026*

**Beter**

- Het huis staat nu overal op zijn eiland: ook bij een kamer, Kamers en indeling, de assistent, het begin, de film, het inlogscherm en het always-on display

*English*

**Improved**

- The house now stands on its island everywhere: also for a room, Rooms and layout, the assistant, the start, the film, the sign-in screen and the always-on display

## 0.63.0

*24 oktober 2026*

**Nieuw**

- Inrichten in acht hoofdstukken, met het huis op zijn eiland dat bij elke stap iets krijgt
- Bij Inrichten: wat voor huis het is, afwezig en vakantie, wat er op zon mag, en wat er in Home Assistant klaar moet staan

**Beter**

- Het tuinhuis heeft twee spots onder het overstek die omlaag schijnen, elk in de kleur van zijn lamp
- Buiten bij Inrichten kent de jacuzzi en het schuurtje; de wand zie je in het klein, met de kaarten om te kiezen

**Opgelost**

- Panelen op de garage, carport of het tuinhuis vielen weg als je Op zon bij Regeling of Inrichten veranderde

*English*

**New**

- Set up in eight chapters, with the house on its island gaining something at every step
- In Set up: what kind of house it is, away and holiday, what may run on sun, and what has to be ready in Home Assistant

**Improved**

- The garden house has two spots under the overhang shining down, each in the colour of its lamp
- Outside in Set up knows the hot tub and the shed; you see the wall screen in miniature, with the cards to choose

**Fixed**

- Panels on the garage, carport or garden house were dropped when you changed On sun in Control or Set up

## 0.62.2

*24 oktober 2026*

**Beter**

- Het tuinhuis heeft een plat dak met een overstek op twee palen, een vlonder en een glazen pui; heet het een schuur of berging, dan blijft het het houten schuurtje met puntdak

*English*

**Improved**

- The garden house has a flat roof with an overhang on two posts, a deck and a glass front; when it is called a shed, it stays the wooden shed with a pitched roof

## 0.62.1

*24 oktober 2026*

**Beter**

- Het kompas staat niet meer op Thuis; bij Zonnepanelen wel, bij de ligging

*English*

**Improved**

- The compass is no longer on Home; it stays on Solar panels, with how they lie

## 0.62.0

*24 oktober 2026*

**Nieuw**

- Een kaart Boiler: hoe warm de boiler of jacuzzi is, en of hij op zon verwarmt

**Beter**

- Een smalle kaart op de wand is een tegel met een groot getal en een beeldje: een ring voor de auto, een staaf voor de batterij, balkjes voor de maand

**Opgelost**

- In een smalle kaart blijft alles binnen de kaart, ook de grafiek van Vandaag

*English*

**New**

- A water heater card: how warm the water heater or hot tub is, and whether it heats on sun

**Improved**

- A narrow card on the wall is a tile with a large number and a small picture: a ring for the car, a bar for the battery, bars for the month

**Fixed**

- In a narrow card everything stays inside the card, including the chart of Today

## 0.61.1

*24 oktober 2026*

**Beter**

- Doet de oude regeling al wat Smart Climate wil, dan zegt Thuis "De badkamer wordt verwarmd" in plaats van "zou verwarmen"
- Op de telefoon staan zon, huis en net onder het huis als drie vakjes, zonder pijl

**Opgelost**

- Op de wand loopt de lucht weer door achter het huis
- Bij Wat je huis kan valt het label van de auto niet meer over het menu

*English*

**Improved**

- When the old system already does what Smart Climate wants, Home says "The bathroom is being heated" instead of "would heat"
- On the phone sun, home and grid sit below the house as three tiles, without an arrow

**Fixed**

- On the wall the sky runs on behind the house again
- On What your home can do the car label no longer falls over the menu

## 0.61.0

*24 oktober 2026*

**Nieuw**

- Het huis staat nu op een eigen stukje grond, met de kelder eronder, het weer van nu en de seizoenen: regen en sneeuw vallen, de bomen kleuren mee
- Panelen kunnen ook op de garage, de carport of het tuinhuis liggen, elk met hun eigen aantal
- Bij Meldingen wis je alles in één keer

**Beter**

- Zonnepanelen laat het huis zien met hoe de panelen liggen, in graden vanaf het noorden, met per dak het aantal
- De kaarten op de wand staan in twee kolommen; elke kaart kies je smal of breed
- Elke stroom op het huis heeft zijn eigen kleur: zon goud, terug naar het net groen, van het net violet
- Op de telefoon staan de hulp, de bel en het tandwiel op elke tab op dezelfde plek, en onder het huis zie je wat er van of naar het net gaat
- Wat je huis kan staat in zes groepen, met de boiler, de jacuzzi en wat het huis eerst leert

**Opgelost**

- Een boiler stond in het huis als droger getekend; nu als boiler

*English*

**New**

- The house now stands on its own patch of ground, with the basement below, the weather of now and the seasons: rain and snow fall, the trees change colour
- Panels can also lie on the garage, the carport or the garden shed, each with its own number
- Under Notifications you clear everything at once

**Improved**

- Solar panels shows the house with how the panels lie, in degrees from north, with the number per roof
- The cards on the wall stand in two columns; you choose each card narrow or wide
- Every flow on the house has its own colour: sun gold, back to the grid green, from the grid violet
- On the phone help, the bell and the gear sit in the same place on every tab, and below the house you see what goes from or to the grid
- What your home can do is in six groups, with the water heater, the hot tub and what the house learns first

**Fixed**

- A water heater was drawn in the house as a dryer; now as a water heater

## 0.60.0

*23 oktober 2026*

**Nieuw**

- Een boiler of jacuzzi kan op zon: hij verwarmt met wat er over is, houdt een ondergrens vast en is zonder zon op tijd warm in de daluren
- Bij de jacuzzi kies je klaar om: vanavond, morgen of later, en hij is dan op badtemperatuur

**Opgelost**

- Op de telefoon loopt de tekst van de assistent weer mee terwijl hij praat, ook als de browser niet zegt bij welk woord hij is

*English*

**New**

- A water heater or hot tub can run on sun: it heats up with what is spare, keeps a minimum and is warm in time during off-peak hours without sun
- For the hot tub you choose a ready time: tonight, tomorrow or later, and it will be at bath temperature by then

**Fixed**

- On the phone the text of the assistant follows along again while it speaks, even when the browser does not say which word it is at

## 0.59.11

*23 oktober 2026*

**Beter**

- Wat er nieuw is bij een update staat in Home Assistant nu in het Nederlands en het Engels; de app toont het in jouw taal
- Lukt het bewaren bij het begin niet, dan zegt de app waarom in jouw taal

*English*

**Improved**

- What is new in an update is now in Dutch and English in Home Assistant; the app shows it in your language
- If saving at the start does not work, the app says why in your language

## 0.59.10

*23 oktober 2026*

**Opgelost**

- Bij Kamers en indeling gaat een wijziging niet meer verloren als je snel achter elkaar iets verandert

*English*

**Fixed**

- In Rooms and layout a change is no longer lost when you change things quickly one after another

## 0.59.9

*23 oktober 2026*

**Opgelost**

- De app op je startscherm vraagt niet meer na elk sluiten opnieuw om in te loggen bij Home Assistant

*English*

**Fixed**

- The app on your home screen no longer asks you to sign in to Home Assistant again every time you close it

## 0.59.8

*23 oktober 2026*

**Beter**

- Smart Climate op een eigen server, zoals een beta, heeft een eigen naam en een icoon met BETA erop, zodat hij op je startscherm niet lijkt op de add-on

**Opgelost**

- De knop Open in Chrome bij Op je startscherm heeft zijn tekst weer netjes in het midden

*English*

**Improved**

- Smart Climate on its own server, such as a beta, has its own name and an icon with BETA on it, so on your home screen it no longer looks like the add-on

**Fixed**

- The Open in Chrome button under On your home screen has its text neatly centred again

## 0.59.7

*23 oktober 2026*

**Nieuw**

- Automatisch kiest Engels bij een Engels account of een Engelse browser; Engels is geen proef meer

**Beter**

- Bij Automatisch komt een melding op je telefoon in de taal waarin je de app het laatst opende

*English*

**New**

- Automatic chooses English for an English account or browser; English is no longer a trial

**Improved**

- With Automatic, a notification on your phone comes in the language you last opened the app in

## 0.59.6

*23 oktober 2026*

**Beter**

- De assistent verstaat Engels: vragen over je huis en de app, en het licht, de schermen en scènes bedienen
- Assist in Home Assistant kent de vragen aan Smart Climate nu ook in het Engels
- Piper leest voor in het Engels als Home Assistant een Engelse stem heeft, met eenheden zoals je ze zegt

*English*

**Improved**

- The assistant understands English: questions about your house and the app, and controlling lights, screens and scenes
- Assist in Home Assistant now knows the questions for Smart Climate in English too
- Piper reads aloud in English if Home Assistant has an English voice, with units as you say them

## 0.59.5

*22 oktober 2026*

**Beter**

- In het Engels nu ook wat de dienst zelf zegt: de stand van je apparaten, het weer, de meldingen, Opbrengst, de besluiten bij Vandaag, de ligging van je panelen, Klaarzetten en de vragen bij het begin
- Een melding op je telefoon komt in de taal die je bij Jij koos
- Wat er nieuw is staat er ook in het Engels

**Opgelost**

- Bij Bewoners en toegang staat je rol in de taal van de app

*English*

**Improved**

- In English now too: what the service says itself, such as the state of your devices, the weather, the notifications, Energy, the decisions in Today, how your panels lie, Getting Home Assistant ready and the questions at the start
- A notification on your phone comes in the language you chose in You
- What is new is in English too

**Fixed**

- Residents and access shows your role in the language of the app

## 0.59.4

*22 oktober 2026*

**Beter**

- In het Engels nu ook Wat je huis kan, Kamers en indeling, Inrichten, het welkom en de film
- Een buitenruimte wordt ook aan een Engelse naam herkend, zoals garden of driveway

*English*

**Improved**

- In English now too: What your house can do, Rooms and layout, Set up, the welcome and the film
- An outdoor space is also recognised by an English name, such as garden or driveway

## 0.59.3

*22 oktober 2026*

**Beter**

- In het Engels nu ook Instellingen: Jij, Comfort, Regeling, Energie, Functies, en Bewoners en toegang
- Zoeken bij Instellingen vindt een instelling ook op Engelse woorden

**Opgelost**

- Een schermlezer noemt de QR-code bij Bewoners nu een afbeelding

*English*

**Improved**

- In English now too: Settings, with You, Comfort, Control, Energy, Functions, and Residents and access
- Searching in Settings also finds a setting by English words

**Fixed**

- A screen reader now calls the QR code in Residents an image

## 0.59.2

*22 oktober 2026*

**Beter**

- In het Engels nu ook Kamer, Vandaag, Apparaten, Opbrengst en de Assistent; de assistent antwoordt in je taal

**Opgelost**

- Een test van de integratie in Home Assistant faalde soms, als Home Assistant de integratie nog aan het herladen was

*English*

**Improved**

- In English now too: Room, Today, Devices, Energy and the Assistant; the assistant answers in your language

**Fixed**

- A test of the integration in Home Assistant sometimes failed while Home Assistant was still reloading the integration

## 0.59.1

*22 oktober 2026*

**Beter**

- In het Engels nu ook de meldingen, Onderhoud, het rookalarm, aanbellen en wat er nieuw is
- Thuis helemaal in het Engels: ook Aanpassen, de favorieten, de rondleiding en de wand als niemand kijkt

*English*

**Improved**

- In English now too: the notifications, Maintenance, the smoke alarm, the doorbell and what is new
- Home entirely in English: also Customise, the favourites, the tour and the wall screen when nobody is looking

## 0.59.0

*22 oktober 2026*

**Nieuw**

- Bij Jij kies je de taal: automatisch die van je account in Home Assistant, Nederlands of English. Engels is een proef: Thuis staat er al in, de rest volgt

**Beter**

- Een schermlezer bereikt de kamers in de tekening van het huis

*English*

**New**

- In You you choose the language: automatically that of your Home Assistant account, Dutch or English. English is a trial: Home is already in it, the rest follows

**Improved**

- A screen reader can reach the rooms in the drawing of the house

## 0.58.3

*22 oktober 2026*

**Opgelost**

- Een kamer zonder regeling en zonder losse meter, zoals de badkamer, toont weer zijn temperatuur: die van de thermostaat in de kamer
- Bij een open keuken met zones staat de keuken in de tekening onder de zone Keuken en de bank onder de andere, in plaats van altijd links de keuken
- Bij Sleutel voor de assistent zie je of de integratie ook is toegevoegd, en zo niet, waar je op Toevoegen en Verzenden klikt
- Assist kent ook de zones in een kamer, zoals de zithoek en de keuken: "hoe staat het met de zithoek" komt bij de goede regeling uit

*English*

**Fixed**

- A room without control and without its own meter, such as the bathroom, shows its temperature again: that of the thermostat in the room
- With an open-plan kitchen with zones, the drawing puts the kitchen under the Kitchen zone and the sofa under the other, instead of always the kitchen on the left
- Key for the assistant shows whether the integration has also been added, and if not, where to click Add and Submit
- Assist also knows the zones in a room, such as the seating area and the kitchen: "how is the seating area doing" reaches the right control

## 0.58.2

*22 oktober 2026*

**Opgelost**

- Na een herstart van Home Assistant bleef de app hangen: het huis bleef laden, Instellingen leeg, de assistent bleef draaien
- In het lichte thema zie je weer welk woord de assistent nu uitspreekt
- De app ziet of Home Assistant de integratie geladen heeft, en vraagt niet voor niets om een herstart

*English*

**Fixed**

- After a restart of Home Assistant the app got stuck: the house kept loading, Settings stayed empty, the assistant kept spinning
- In the light theme you can see again which word the assistant is saying
- The app sees whether Home Assistant has loaded the integration, and does not ask for a restart for nothing

## 0.58.1

*22 oktober 2026*

**Beter**

- De integratie voor Assist heeft een eigen versie: een update van Smart Climate vraagt geen herstart van Home Assistant meer
- In de app staat hoe je de integratie in HACS vindt

**Opgelost**

- Een tik op een melding op je telefoon opent Smart Climate, in plaats van een 404

*English*

**Improved**

- The integration for Assist has its own version: an update of Smart Climate no longer needs a restart of Home Assistant
- The app explains how to find the integration in HACS

**Fixed**

- Tapping a notification on your phone opens Smart Climate, instead of a 404

## 0.58.0

*22 oktober 2026*

**Nieuw**

- Assist van Home Assistant vraagt Smart Climate zonder YAML: de integratie Smart Climate, via HACS of met een knop in de app
- De add-on meldt zich vanzelf aan bij Home Assistant; de zinnen en de kamers van je huis houdt hij zelf bij

*English*

**New**

- Assist in Home Assistant asks Smart Climate without YAML: the Smart Climate integration, via HACS or with a button in the app
- The add-on registers itself with Home Assistant; it keeps the sentences and the rooms of your house up to date itself

## 0.57.0

*22 oktober 2026*

**Nieuw**

- Meldingen op je telefoon via de app van Home Assistant: rook en een haperende regeling meteen, batterij en een nieuwe versie overdag
- Bij Jij kies je wat je wilt horen, naar welke telefoon, en je nachtrust; met een proefmelding

*English*

**New**

- Notifications on your phone through the Home Assistant app: smoke and a faltering control straight away, battery and a new version during the day
- In You you choose what you want to hear, on which phone, and your quiet hours; with a test notification

## 0.56.0

*21 oktober 2026*

**Nieuw**

- Vier nieuwe kaarten voor Thuis: de auto, de batterij, deze maand en de deurbel
- De auto en de thuisbatterij bij Apparaten: hoe vol, en of ze laden of het huis voeden

## 0.55.2

*21 oktober 2026*

**Beter**

- Het lichte thema ook als je telefoon of tablet ligt; alleen het scherm aan de wand blijft donker
- Bij Jij gaan Kaarten en Favorieten elk meteen naar het aanpassen

**Opgelost**

- Favorieten sprongen na een paar tellen terug naar de eerste pagina

## 0.55.1

*21 oktober 2026*

**Beter**

- De wand toont dezelfde kaarten en favorieten als je telefoon: één keer instellen
- Zes kleuren die beter uit elkaar liggen: lucht, framboos, zeegroen, violet, koper en grafiet
- In het licht een lichter huis, witte kaartjes op het huis en een lichte ring om de bewoners

**Opgelost**

- De knop Inrichten heeft zijn tekst weer in het midden

## 0.55.0

*21 oktober 2026*

**Nieuw**

- Jij, bovenaan Instellingen: je kleur, licht of donker, je Thuis en je comfort op één plek
- Op de telefoon een licht thema, of zoals je telefoon het wil
- Een eigen kleur voor het menu, de keuzes en je naam; de wand toont de kleur, kaarten en favorieten van wie het comfort heeft

**Beter**

- Het getal bij de bel is beter te lezen

## 0.54.0

*21 oktober 2026*

**Nieuw**

- Bij Wat je huis kan: wat er in Home Assistant klaar moet staan, wat er mist, en een tik naar dat scherm

## 0.53.0

*21 oktober 2026*

**Nieuw**

- Bij Meters en prijzen eigen daluren, en geen salderen voor een huis buiten Nederland
- Wasmachines, drogers en vaatwassers van LG, Samsung en Miele kunnen op zon, naast die van Bosch en Siemens

**Beter**

- Het vermogen van een elektrische bron bij Indeling telt mee voor de hoofdzekering, ook als hij niet op zon mag

## 0.52.0

*21 oktober 2026*

**Nieuw**

- Het wekwoord Hé huis zit in de add-on: herstart de openWakeWord-add-on één keer, en kies het bij de spraakassistent
- Bij Sleutel voor de assistent staat ook het adres waar Home Assistant zijn vraag stelt

**Beter**

- Een nieuwe melding, zoals een nieuwe versie, staat meteen bij de bel, op elk scherm

## 0.51.0

*21 oktober 2026*

**Nieuw**

- Bij Comfort › Voorrang een lijst Op zon: zet de droger voor of na de kamers die op zon voorkoelen of opwarmen. Comfort gaat altijd voor

## 0.50.1

*21 oktober 2026*

**Opgelost**

- Een lange titel bij Volgende, zoals "Sleutel voor de assistent", breekt op de telefoon af in plaats van dat het begin wegvalt

## 0.50.0

*21 oktober 2026*

**Nieuw**

- Op je startscherm, bij Functies › Weergave: Smart Climate als app met zijn eigen icoon, of de stappen om dat te kunnen

**Beter**

- Bij het kiezen van favorieten staan de gekozen bovenin als tegels, zoals op Thuis, en schuif je ze met een greep
- Een lamp vasthouden bij de favorieten opent op de telefoon meteen die lamp

**Opgelost**

- Een favoriet in een open ruimte noemt zijn zone in plaats van de hele ruimte
- Bij Bewoners op de telefoon staan thuis of weg en geldt nu onder de naam, niet eroverheen
- Iemand erbij: in Home Assistant wijst de QR-code naar Smart Climate in Home Assistant

## 0.49.0

*21 oktober 2026*

**Beter**

- Een lamp, scherm of beweging zie je meteen op Thuis en in de kamer, ook als je het in Home Assistant bedient
- Wie er thuis komt of weggaat, staat meteen bij de rondjes op Thuis

**Opgelost**

- Een verse installatie zei soms even "geen verbinding" terwijl die er wel was

## 0.48.1

*21 oktober 2026*

**Opgelost**

- Een nieuwe versie staat nu ook op de wand als niemand kijkt; een tik geeft wat er nieuw is en Bijwerken

## 0.48.0

*21 oktober 2026*

**Beter**

- Tabbladen openen sneller: wat niet veranderde, haalt de browser niet opnieuw op
- Op de telefoon via Tailscale gaat alles ingepakt, en het huis wordt maar één keer per verandering uitgerekend

## 0.47.1

*21 oktober 2026*

**Opgelost**

- Een kantoor, toilet of tuinhuis heet in een zin "het kantoor", niet "de kantoor"

## 0.47.0

*21 oktober 2026*

**Nieuw**

- Staat er een nieuwe versie klaar, dan zegt Meldingen het. Een tik toont wat er nieuw is, met een knop Bijwerken

## 0.46.1

*21 oktober 2026*

**Opgelost**

- Bij Comfort sleep je de temperatuur met het bolletje; een tik op de balk of ergens anders verschuift niets meer

## 0.46.0

*21 oktober 2026*

**Nieuw**

- Twaalf favorieten, vier per pagina: schuif met de vinger. Screens en het zonnescherm kunnen er ook bij, en elke lamp heeft het icoon en de naam van zijn kamer
- Rookmelders, zoals de Nest Protect: ziet er een rook, koolmonoxide of hitte, dan staat het op elk scherm, en bij Meldingen waar en wanneer. Bij Onderhoud de batterij, de laatste test en wanneer vervangen
- De helderheid van het always-on display kies je zelf, overdag en in de avondstand
- De gevel opmeten op de kaart, bij Zon en aansluiting › Aanpassen

**Beter**

- Zeg "oké, bedankt" of "dat was het" en de assistent sluit af; alleen ruis telt niet meer als vraag
- De rondjes op Thuis volgen meteen wie er thuis is

**Opgelost**

- Het beeld bij aanbellen bleef soms zwart
- De wand toonde na een tijd "401: Unauthorized"
- Het scherm bleef ’s ochtends soms gedimd
- De radiator van een zolderkamer stak door het dak

## 0.45.0

*18 oktober 2026*

**Nieuw**

- Op Thuis een rondje per bewoner: wie thuis is licht op, en wie gevolgd wordt heeft een ring. Een tik en je kiest wiens comfort geldt

**Beter**

- De grote kaart "Comfort van ..." is weg, en de wand begroet alleen wie thuis is

## 0.44.0

*18 oktober 2026*

**Nieuw**

- Het always-on display heeft een dagstand en een avondstand, elk met een schakelaar en de tijden erbij

**Beter**

- Favorieten kies je per kamer: de lampen eerst, de scènes ingeklapt eronder

**Opgelost**

- In de winter begint de dagstand nu op tijd, niet pas bij zonsopkomst
- De keuze voor de thermostaat bij Inrichten past weer

## 0.43.0

*18 oktober 2026*

**Nieuw**

- Weergave bij Functies: dit scherm, het always-on display met een schakelaar, en wanneer het scherm uitgaat
- Buiten eigen soorten en zones, zoals achtertuin, carport, border en tuinhuis
- De Nest als thermostaat van de cv-ketel; een radiator gaat daarmee aan
- Licht en screens per kamer bij Functies, met een schakelaar om er een uit de app te halen
- Een tik op Automatisch legt de standen van het huis uit

**Beter**

- Op de wand zoveel kaarten als je wilt: de kolom schuift, met alleen een greep
- De droger staat tegen de muur, met de echte eindtijd
- Meten met en de regeling staan bij Verwarmen en koelen
- Inrichten blijft staan waar je was, en voegt ook een radiator toe
- Wie je bent staat bij Bewoners; het deel Inloggen is weg
- "Van je panelen" in plaats van "van je dak", en het percentage zelf gebruikt bij Opbrengst

**Opgelost**

- De droger zei nog "draait" terwijl hij al klaar was
- Apparaten op zon zijn weer uit te zetten
- Onderhoud bij de meldingen ziet nu ook een lege batterij
- De uitleg bij "Wat doet de regeling ermee?" liep over de volgende keuze

## 0.42.0

*18 oktober 2026*

**Nieuw**

- Een scherm aan de wand stel je in vanaf elk apparaat: volledig scherm en luisteren naar "Hé huis"
- Kamers verplaats je in het inrichten met pijltjes, of door ze in het huis te slepen
- Buiten een garage en een carport, en een tuinhuis dat je in het huis aantikt
- Op de wand pijltjes per kaart en "+ Kaart", ook voor Favorieten
- De droger op het always-on scherm, en "De droger draait" op Thuis

**Beter**

- Inrichten: apparaten los van verwarmen en koelen, alles per kamer in de stap zelf, buiten één lijst, bewoners om aan te tikken
- De assistent zegt één keer dat hij het niet begrijpt, met voorbeelden, en stopt daarna bij ruis; "app" klinkt als "ep"
- Panelen precies zoals ze liggen, op beide kanten

**Opgelost**

- Het weer van vandaag gaf de zon van morgen
- Huis en knoppen vielen op een breed scherm buiten beeld; de vraagbalk op de wand liep over
- Bewegingsgolven en de airco op zolder stonden buiten het huis
- Prijzen vielen half buiten hun vak

## 0.41.0

*18 oktober 2026*

**Beter**

- Always-on alleen op het scherm aan de wand: overdag de klok, het huis en het weer, na zonsondergang gedimd
- 's Nachts en als niemand thuis is gaat het scherm uit; beweging zet het weer aan, een tik of "Hé huis" opent de app
- In te stellen hoe lang het scherm aan blijft zonder beweging: 1, 5, 15 of 30 minuten

## 0.40.0

*18 oktober 2026*

**Nieuw**

- De wand als niemand kijkt: van bedtijd tot de ochtend een gedimde klok en een rustig huis, overdag na een paar minuten de klok, het huis en het weer
- Een tik, de bewegingsmelder, de deurbel of "Hé huis" wekt de wand
- Weergave: kies eenvoudig of uitgebreid, grotere letters en minder beweging, onderaan Thuis of achter het tandwiel

## 0.39.0

*18 oktober 2026*

**Beter**

- Instellingen op de telefoon: de onderdelen van een groep staan onder elkaar, niet meer in een rij om opzij te schuiven; een onderdeel opent als eigen scherm
- Onderaan elk onderdeel Vorige en Volgende, en wat nog mist staat bovenaan
- Op de wand grotere regels, en alles past zonder scrollen; de uitleg staat achter Waarvoor is dit?

## 0.38.0

*18 oktober 2026*

**Nieuw**

- Thuis aanpassen: schuif de kaarten op je telefoon in je eigen volgorde, verberg wat je niet nodig hebt en zet het weer van morgen erbij
- Favorieten: vier scènes of lampen met één tik op Thuis
- De wand past de hoofdgebruiker aan met het potlood bovenin, voor iedereen in huis

## 0.37.0

*18 oktober 2026*

**Nieuw**

- Smart Climate staat in Home Assistant bij iedereen in de zijbalk, niet alleen bij beheerders

**Beter**

- Ook in Home Assistant stelt alleen een beheerder het huis, de energie en de functies in; een gast kijkt mee
- Bij Inloggen staat in Home Assistant wie je bent, en of je bewoner of beheerder bent

## 0.36.0

*18 oktober 2026*

**Nieuw**

- Smart Climate kan weer als losse app op je telefoon, met een eigen icoon: via een eigen poort van de add-on en Tailscale

## 0.35.0

*18 oktober 2026*

**Nieuw**

- Op de telefoon staat de Assistent op Thuis altijd in beeld, boven de tabs; de microfoon ernaast luistert meteen
- Hoe voelt het nu?, Vandaag en het apparaat dat draait staan nu ook op de telefoon

**Beter**

- Thuis op de telefoon is rustiger: de knoppen bovenin op één regel, de stand naast de begroeting en de kamers in één kaart

## 0.34.4

*18 oktober 2026*

**Beter**

- Op de telefoon ziet Smart Climate in Home Assistant er altijd uit als de app: met de statusbalk erboven, op elke pagina
- In de app van Home Assistant heeft de statusbalk de kleur van Smart Climate in plaats van grijs
- Bij wat er gevonden is in Inrichten staat waarom verwarmen en koelen geen × hebben

**Opgelost**

- Op de telefoon schuift elke pagina mee, waar je je vinger ook neerzet; in Inrichten ging dat alleen naast de kaart
- De lucht loopt op de telefoon door tot onderaan de pagina

## 0.34.3

*18 oktober 2026*

**Beter**

- Naar Home Assistant laat je in Smart Climate, met de zijbalk van Home Assistant erbij; dezelfde knop zet volledig scherm weer aan
- Op de telefoon staat die knop rechtsboven, naast het tandwiel

## 0.34.2

*18 oktober 2026*

**Opgelost**

- Volledig scherm op de telefoon is weer het hele scherm, zonder grijze balk bovenin

## 0.34.1

*17 oktober 2026*

**Opgelost**

- "Hé huis" en de microfoon werken nu ook in Home Assistant
- Volledig scherm op de telefoon laat de statusbalk en de camera vrij, en de terugknop gaat een pagina terug
- Tussen twee pagina's in Home Assistant zie je de lucht, geen zwart scherm

## 0.34.0

*17 oktober 2026*

**Nieuw**

- Inrichten: kamers samenvoegen tot één ruimte met zones, zoals keuken en zithoek
- Inrichten: per deel aan of uit wat er rond je huis is, van oprit tot tuinhuis
- Inrichten: tik op een getal op het startscherm voor de lijst, en haal weg wat er niet bij hoort
- Prijzen: eerst je soort contract, met gas en wat je vanaf 2027 voor teruglevering krijgt en betaalt

**Beter**

- Inrichten heeft overal Terug en Volgende, en Volgende bewaart wat er staat
- De stappen bovenaan zeggen wat je al nagelopen hebt en wat al klaarstond
- Panelen: ook "geen panelen", en het aantal per kant van het dak
- Een los apparaat krijgt een kamer voorgesteld uit zijn naam
- Comfort voor het hele huis laat kamers met een eigen waarde zoals ze zijn
- Bij de eerste inlog zegt "Klopt iets niet?" waar je het verandert

**Opgelost**

- "Waar staan 1 dit apparaat?" is nu "Waar staat dit apparaat?"
- Het startscherm telt Buiten niet meer als etage
- Na het terugzetten van een back-up laadt de pagina vanzelf opnieuw

## 0.33.0

*17 oktober 2026*

**Nieuw**

- Smart Climate meet zelf hoe je panelen liggen: de richting, de helling en het vermogen, uit een heldere dag. Je bevestigt het bij Inrichten of Energie
- Bij panelen op twee kanten één vraag: wanneer schijnt de zon op de voorkant?

**Beter**

- Een nieuw huis heeft meteen de zon, het weer met opbrengst en de verwachting, eerst met een schatting
- De omvormer haalt Smart Climate uit Home Assistant; die hoef je niet op te zoeken

## 0.32.1

*17 oktober 2026*

**Beter**

- Onder de kop over één kamer staat hoe warm het er is en wat het doel is, in plaats van nog eens hetzelfde
- Een back-up terugzetten in Home Assistant neemt ook de configuratie mee, met je panelen

**Opgelost**

- Vandaag op Thuis toont de hele dag, ook op de eerste dag: wat er nog niet gemeten is, komt uit Home Assistant

## 0.32.0

*17 oktober 2026*

**Nieuw**

- Volledig scherm in Home Assistant, per apparaat: zonder de zijbalk en de balken eromheen, bij Bewoners en toegang › Dit scherm
- Een knop boven de bel brengt je terug naar Home Assistant

**Opgelost**

- De muziek van de film blijft overal binnen de grens, ook bij de hardste tel

## 0.31.0

*17 oktober 2026*

**Nieuw**

- Een welkom voor een leeg huis: je huis groeit uit wat Home Assistant kent, en met één knop ga je inrichten
- Een back-up van een eerdere installatie zet je meteen in het welkom terug

**Beter**

- De add-on opent de app, niet de cijfers
- Vragen bij het inrichten alleen waar Smart Climate echt niet kan kiezen, met de namen uit Home Assistant
- Wie voor het eerst via Home Assistant opent, wordt herkend als bewoner

## 0.30.0

*17 oktober 2026*

**Nieuw**

- Een back-up van je instellingen, en weer terugzetten, bij Bewoners en toegang › Je gegevens
- Opnieuw beginnen met een leeg huis, alleen door de hoofdgebruiker en met eerst een back-up
- Het logboek voor onderzoek, zonder namen en zonder ligging, met alle apparaten en wat Smart Climate ermee doet

**Beter**

- Wie zonder persoon in Home Assistant inlogt, kijkt eerst mee als gast; de hoofdgebruiker maakt er een bewoner van
- Een gast ziet geen instellingen meer die hij toch niet kan veranderen

## 0.29.0

*17 oktober 2026*

**Nieuw**

- Praten met je stem: de wand luistert naar "Hé huis", met een laag over de pagina, een zacht tikje, en het antwoord hardop
- Na het antwoord luistert het huis nog vijf seconden, zodat je zonder "Hé huis" verder kunt praten
- Bij de Assistent een microfoonknop: tikken, praten, en het huis stopt vanzelf als je stil bent
- Bij Functies › Praten met je huis kies je de spraakassistent uit Home Assistant, en of dit scherm luistert

## 0.28.0

*17 oktober 2026*

**Nieuw**

- Bij Functies › Meldingen kies je wanneer een batterij of een airco-filter een melding geeft: onder 5, 10, 20 of 30%, of nooit
- Een scherm zoals de wand beheer je bij Bewoners: een andere naam geven, of weghalen

**Opgelost**

- Een tweede bewoner kan weer een eigen comfort kiezen, ook als er een kamer uit de regeling ging

## 0.27.1

*16 oktober 2026*

**Beter**

- Proberen bij Praten met je huis zegt hoe lang het taalmodel erover deed, en waarom het niet lukte
- Is het gratis gebruik van het taalmodel op, of heeft het het te druk, dan hoor je meteen het vaste antwoord, zonder te wachten

**Opgelost**

- De assistent wacht nu vijf seconden op het taalmodel in plaats van drie

## 0.27.0

*16 oktober 2026*

**Nieuw**

- Lampen, scènes en schermen bedien je met een zin bij de Assistent, zoals "doe het licht beneden wat zachter" of "screen dicht"
- Terwijl een scherm beweegt, stopt "Stop het screen" het scherm en "Stil" het praten; "stop" typen kan ook
- Bij Functies › Praten met je huis kies je een taalmodel uit Home Assistant: dan zegt de assistent het in eigen woorden

**Beter**

- Onder het antwoord staat wat er veranderde, zoals "40%, plafonnière, was 80%", met wat je daarna kunt doen

**Opgelost**

- Een garagedeur, poort of deur staat niet meer als scherm in de app, en gaat dus nooit met een knop open
- Bij Bewoners staan alleen nog je eigen persoon in Home Assistant en sensors om uit te kiezen, geen andere mensen

## 0.26.0

*16 oktober 2026*

**Nieuw**

- Een gast: kijkt mee, en bedient licht en screens alleen als hij thuis is; van een gast wordt niets bewaard

**Opgelost**

- Na het inloggen bij Home Assistant kom je weer echt binnen, in plaats van terug bij het inloggen
- Wie al ingelogd was, kiest bij de eerste pagina of hij hier woont of een scherm is
- Een tablet met een persoon in Home Assistant kan op het welkom "Dit is een scherm" kiezen
- Bij Bewoners staan alleen wie in de app inlogde, niet iedereen uit Home Assistant

## 0.25.0

*16 oktober 2026*

**Nieuw**

- Comfort per bewoner: wie het eerst op de lijst thuis is, bepaalt het comfort; de hoofdgebruiker staat bovenaan
- Het huis begroet je met je naam; de wand begroet wie er thuis is
- Bij Instellingen › Bewoners en toegang: de volgorde, je naam, wat je volgt en je eigen comfort
- De hele app vraagt een inlog; wie voor het eerst inlogt, kiest of hij hier woont of een scherm is

**Beter**

- Toch die van de hoofdgebruiker: het comfort terugzetten met één tik, tot er iemand thuiskomt of weggaat

## 0.24.2

*16 oktober 2026*

**Beter**

- Bij Inrichten kies je per apparaat Op temperatuur, Op zon of Kijkt mee
- Buiten: eerst wat een ruimte is, en daarna met een schakelaar of er een tuinhuis of auto bij hoort

**Opgelost**

- Lijsten schuiven weer met de vinger op de tablet, ook bij Indeling; slepen kan zijwaarts
- De zon staat in de tekening weer op zijn lijn
- Straks op Thuis en de assistent vertellen hetzelfde
- De assistent zegt ook achtergevel goed
- Een camerabeeld stopt nu altijd als je wegtikt, ook als je heel snel wegtikt

## 0.24.1

*16 oktober 2026*

**Opgelost**

- De muziek van de film kan niet meer kraken

## 0.24.0

*16 oktober 2026*

**Nieuw**

- De film is een dag in je huis: de zon komt op, zes beelden met je eigen cijfers, en muziek die opbouwt

**Beter**

- Inrichten zoals de schets: zes hoofdstukken bovenaan, knoppen naast elkaar, en de prijzen en de zekering in vakken

## 0.23.1

*16 oktober 2026*

**Beter**

- Bij Indeling krijgt een zone een soort, zoals zithoek of keuken, en die komt in de tekening
- Kamers en zones schuif je naar links of rechts

**Opgelost**

- Een screen of zonnescherm zegt alleen "zon" als de zon op zijn eigen gevel staat; kies de gevel bij Indeling
- Een bewegingsmelder heeft zijn eigen icoon, ook als hij de temperatuur meet
- De assistent zegt voorgevel met een lange e, niet als voorge-vel

## 0.23.0

*16 oktober 2026*

**Nieuw**

- Inrichten loopt nu langs alles: buiten, welke thermometer telt, de zekering, je prijzen, licht en camera's, en inloggen op de wand
- Een nieuwe film van twintig tellen, met de cijfers van je eigen huis

**Beter**

- De rondleiding komt langs alle tabbladen en een kamer

**Opgelost**

- Een sensor zonder naam in Home Assistant krijgt een leesbare naam

## 0.22.0

*16 oktober 2026*

**Nieuw**

- Het huis heeft een voordeur met de deurbel, de meterkast, de camera op de oprit, de tuin met de border en het terras

**Beter**

- Buitenunits en witgoed op ware grootte, en namen van kamers die binnen hun muren passen

**Opgelost**

- Wat je bij Comfort instelt, geldt nu ook echt; de oude helpers in Home Assistant gingen voor
- De kosten noemen je apparaten zoals in de app

## 0.21.0

*15 oktober 2026*

**Nieuw**

- Een kamer kan meedoen met de regeling van een andere kamer, zoals een slaapkamer met de airco in de kamer ernaast
- Vraag de assistent naar het weer van morgen, en wat je apparaten deze maand kostten

**Beter**

- De assistent antwoordt korter en warmer, en spreekt kilowattuur, tijden en "airco" uit zoals je ze zegt
- Vandaag: een airco die met de zon mee aan en uit gaat, is één regel

**Opgelost**

- Na een tik op Thuis praat de assistent meteen hardop
- Een kamer met een eigen regeling heeft zijn comfort weer terug
- Opbrengst: zelf gebruikt en teruggeleverd tellen precies op tot wat je panelen opwekten
- Een afgeknipte zin, een dubbel doel, en de maan die op de telefoon over de tekst viel

## 0.20.2

*15 oktober 2026*

**Opgelost**

- De assistent spreekt Nederlands: met een Nederlandse stem van Piper, of anders die van het apparaat

## 0.20.1

*15 oktober 2026*

**Nieuw**

- Beweging: een bewegingsmelder laat in de kamer en in het huis zien als hij iemand ziet

**Opgelost**

- Bewegingsmelders staan met hun batterij in de kamer

## 0.20.0

*15 oktober 2026*

**Nieuw**

- De assistent praat: je huis begroet je, leest zijn antwoord voor en vraagt of het nog iets kan doen
- De stem is Piper, in je eigen Home Assistant; de bol leeft mee en de woorden komen mee
- Nieuwe vragen: wat deed je vandaag, en hoe warm is het overal

**Beter**

- Vragen die nu ergens over gaan, met het cijfer erbij
- Zon en straks noemen wat er volgens het weer nog komt

**Opgelost**

- Onderhoud op Thuis heeft een korte, leesbare tekst

## 0.19.2

*15 oktober 2026*

**Opgelost**

- Apparaten vindt ook een kWh-meter die niet aan de airco zelf hangt

## 0.19.1

*15 oktober 2026*

**Nieuw**

- Thuis begroet je: goedemorgen, goedemiddag of goedenavond

**Beter**

- Onderhoud bovenin als een sleutel; een tik laat zien wat er te doen is
- Het getal bij de bel verdwijnt als je de meldingen hebt gezien
- De vraagbalk staat alleen onder het huis; de kaarten rechts krijgen meer ruimte

## 0.19.0

*15 oktober 2026*

**Nieuw**

- Apparaten laat per apparaat zien wat het nu doet en vraagt, en wat het vandaag op eigen zon deed

**Beter**

- Wat nu iets doet, staat bovenaan
- De grafiek van de dag staat alleen nog bij Vandaag

## 0.18.1

*15 oktober 2026*

**Beter**

- Een schakelaar of sensor met een batterij staat bij de kamer, en een melding brengt je erheen

**Opgelost**

- Vandaag toont de temperatuur van elke kamer met een regeling, niet maar twee

## 0.18.0

*15 oktober 2026*

**Nieuw**

- De rondleiding: zeven stops door de app, met je eigen huis, en daarna het filmpje nog eens als je wilt

**Beter**

- Het vraagteken op Thuis start de nieuwe rondleiding

## 0.17.0

*15 oktober 2026*

**Nieuw**

- Het filmpje: hoe je huis leert, in een minuut, met je eigen huis en je eigen cijfers

**Beter**

- Gewone woorden: verwarmen

**Opgelost**

- Gewone kamernamen krijgen weer "de", zoals "de badkamer"

## 0.16.0

*15 oktober 2026*

**Nieuw**

- Inrichten op één pagina: links je huis dat meegroeit, rechts één vraag per stap

**Beter**

- Wat Home Assistant al weet, staat klaar; jij kijkt of het klopt
- Overslaan kan altijd; bij Klaar staat wat nog openstaat

## 0.15.1

*15 oktober 2026*

**Opgelost**

- Bij Meet met staat een gewone naam, ook voor een sensor die het huis verder niet toont

## 0.15.0

*15 oktober 2026*

**Nieuw**

- De regeling per kamer in de app: bij Indeling kies je per apparaat of het de kamer op temperatuur houdt, op zon helpt of alleen kijkt
- Een airco of thermostaat uit Home Assistant doet meteen mee, zonder herstart
- Bij Regeling per kamer wat er regelt, en welke kamers nog niet meedoen

**Beter**

- Bij Verwarmen en koelen staat bovenaan waarmee de kamer meet

## 0.14.2

*15 oktober 2026*

**Beter**

- Een andere sensor bij Meten met telt meteen, zonder herstart

**Opgelost**

- Meten met de airco of de thermostaat zelf telde niet mee: de kamer toont nu het gemiddelde

## 0.14.1

*15 oktober 2026*

**Beter**

- Elke melding is weg te halen met het kruisje
- Een oude melding is weer aan te tikken: een versie toont opnieuw wat er nieuw was
- In de instellingen alleen nog een bolletje waar iets ontbreekt

**Opgelost**

- Onderhoud toont geen groen vinkje meer als een batterij bijna leeg is

## 0.14.0

*15 oktober 2026*

**Nieuw**

- Verwacht naast echt: bij Gisteren hoeveel de panelen opwekten naast wat de dag ervoor werd verwacht
- Zo klopte de verwachting: de afgelopen twee weken per dag naast elkaar
- Bij Opbrengst verwacht naast opgewekt, per dag, week, maand en jaar

**Beter**

- Vandaag en Thuis zetten het opgewekte naast de verwachting
- Het warmste moment staat niet meer over de naam van de kamer

## 0.13.0

*15 oktober 2026*

**Nieuw**

- Meldingen: een bel in het menu, met een getal als er iets aandacht vraagt
- Een melding als iets nieuws in Home Assistant staat, iets niet meer reageert, een batterij of filter bijna op is, of de slimme meter niets meer levert
- Onderhoud: alle batterijen en filters, altijd te bekijken
- Na een update één keer: wat is er nieuw

**Beter**

- Wat vanzelf weer goed komt, schuift naar Eerder
- Op de telefoon staat de stand bovenaan alleen als die niet automatisch is

**Opgelost**

- Op de telefoon liep de kop van Thuis en een lange batterijmelding buiten het scherm

## 0.12.0

*15 oktober 2026*

**Nieuw**

- Voorrang bij koelen en bij verwarmen apart, met een voorstel om mee te beginnen
- Hoe voelt het: na een tik meteen een antwoord, en na een paar keer hetzelfde een voorstel voor Comfort
- Wat het huis leerde: elke tik als een stip op de temperatuur van toen

**Beter**

- Hoe voelt het werkt zonder inlog, voor elke kamer, ook op de kamerpagina

## 0.11.2

*15 oktober 2026*

**Opgelost**

- Een app die open bleef staan, liet na een update nog de oude versie zien; nu laadt hij vanzelf opnieuw

## 0.11.1

*15 oktober 2026*

**Beter**

- Bij Versie staat alleen de nieuwste open, de rest ingeklapt, verdeeld in nieuw, beter en opgelost

## 0.11.0

*15 oktober 2026*

**Nieuw**

- Per kamer kies je hoeveel verder het op zon mag, en of koelen ook van het net mag
- Afwezig en vakantie hebben een eigen deel, per kamer

**Beter**

- Bij Comfort per dagdeel een rustige regel voor verwarmen en voor koelen; een tik zegt wanneer het aan- en uitgaat
- Op de balk het gele stuk: waar het op zon naartoe mag

## 0.10.1

*15 oktober 2026*

**Beter**

- Zoeken vindt ook je kamers en je apparaten

**Opgelost**

- Zoeken bij Instellingen vond meervoud en een deel van een woord niet, zoals "batterij"

## 0.10.0

*15 oktober 2026*

**Nieuw**

- Bij Indeling per kamer wat er verwarmt en koelt: radiator, vloerverwarming, infraroodpaneel, kachel of airco
- Een elektrische bron met een vermogen mag opwarmen op zon
- Haal er meer uit: de drie beste ideeën voor je huis

**Beter**

- Wat Home Assistant al weet, staat er al; een thermostaat vraagt wat eraan hangt
- Wat je huis kan zegt in welke kamers iets werkt

## 0.9.0

*14 oktober 2026*

**Nieuw**

- Een versienummer, en deze lijst met wat er nieuw is
- Alle batterijen en filters zijn altijd te bekijken, ook als niets bijna leeg is

**Beter**

- Elke kamer heet overal zoals in Indeling, ook in de zinnen van het huis
- Bij Comfort per dagdeel een schakelaar voor verwarmen en voor koelen
- De etages naast elkaar van beneden naar boven, onder elkaar zoals het huis staat

**Opgelost**

- De airco in de tekening was te groot en hing voor het raam
