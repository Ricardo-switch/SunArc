# Ontwerp 2: het huis in zijn eigen lucht

Een nieuwe ronde schetsen voor de bewonersapp, na de vergelijking van de
schetsen met de proefomgeving op 8 oktober 2026. De vorige set staat in
`../app/`. Ontwerp 2 is een voorstel; of het de maatstaf van besluit 71 wordt,
beslist de bewoner.

Te bekijken als overzicht op claude.ai (privé): <https://claude.ai/artifact/19gvuet85uv5fsxLGQnSYH>

## Wat er anders is

- **Het huis in 3D.** Een opengewerkt poppenhuis, schuin van voren, getekend
  door `frontend/kit/huis.js` (SVG, geen 3D-motor: licht genoeg voor de tablet). Het
  bouwt zich op uit een beschrijving: etages en kamers uit de indeling, en
  alleen wat het huis heeft: panelen, buitenunit, batterij, laadpaal met auto.
  Wat er nog niet is, kan gestippeld staan (`spook`).
- **De lucht van het moment.** De achtergrond is dag, avond, nacht, bewolkt of
  winter. Zo ziet ook een moment zonder zon er levend uit.
- **Getallen op het huis.** Labels wijzen naar de panelen, de batterij, de
  auto. Het vermogen staat bij de panelen, niet bij de zon.
- **Kamers kleuren naar wat er gebeurt:** ijs koelt, gloed verwarmt, amber
  wacht op zon, mint is goed; 's avonds de kleur van de lampen die branden.
- **Vijf tabs:** Thuis, Vandaag, Apparaten, Opbrengst, Assistent. Bedienen doe
  je in het huis (etage, kamer, apparaat). De modus staat bovenin op Thuis.
  Instellen zit achter het tandwiel. Vandaag is Waarom en Plan samen.
- **De uitleg van het huis** de eerste keer als rondleiding over het echte
  huis, daarna achter "Zo werkt het huis".
- **De indeling** zit achter het tandwiel (Instellingen › Kamers en
  indeling): een bewerkstand op het huis zelf, waar je apparaten naar een kamer
  sleept, zones maakt en kamers en etages toevoegt. Komt er een apparaat bij in
  Home Assistant, dan staat er op Thuis één regel die ernaar wijst.

## Schermen

| Wand (1280 × 800) | Telefoon (390 breed) |
| --- | --- |
| `Wand-Thuis` zomermiddag, `Wand-Thuis-avond`, `Wand-Thuis-winter` | `Thuis` |
| `Wand-Vandaag` | `Vandaag` |
| `Wand-Apparaten` | `Apparaten` |
| `Wand-Kamer`, `Wand-Bedienen` (screen, airco, thermostaat) | `Lamp` |
| `Wand-Opbrengst` | `Opbrengst` |
| `Wand-Opbrengst-Stromen` (drie gelijke kolommen; het stroombeeld met de daken per vlak, het net met de kosten, terug met de opbrengst, accu en auto, kleine stromen samen, gas apart; `#zomer` juli met accu en auto; schets 5 november 2026, nog niet gebouwd); de getallen en het stroombeeld staan in `opbrengst-stromen.js` | `Tel-Opbrengst-Stromen` (`#zomer`) |
| `Wand-Huis-groeit` (wat je huis kan) | `Instellingen`, `Onboarding-Zon` |
| `Wand-Assistent` | |
| `Wand-Indeling` (kamers en indeling, de bewerkstand) | |
| `Wand-Indeling-Groep` (Kamers en indeling als groep zoals Energie: `#buiten` met wat er rond het huis is, `#los`; besluit 193) | `Tel-Indeling-Groep` (de lijst, `#deel`, `#buiten`) |
| `Wand-Indeling-Buiten` (buiten als echte plekken, ook zonder gebied in Home Assistant: op elke plek wat er hangt, de voordeur erbij; `#garage` met de auto en de thuisaccu, `#voordeur`, `#apparaat` kies binnen of buiten; issues 152, 153 en 123, schets 7 november 2026, nog niet besloten) | |
| `Wand-Huis-Maat` (het huis op echte maat, in de echte motor: `frontend/kit/huis3d.js` met de vakken uit `huisvorm.js`; opengewerkt met lage binnenmuren, vanaf de straat schuin van rechtsvoor, het dak naar de kijker doorzichtig, een garage dicht met zijn naam op het dak; het voorbeeldhuis, `#jouw` het huis uit de 3D-kaart met de nok uit het midden, `#avond`; schets 8 november 2026, nog niet in huis.js) | |
| `Wand-Huis-Ontwerp` (Je huis op maat: Kamers en indeling als groep met vier delen die op elkaar bouwen; Huisontwerp de gebouwen van boven uit de kaart, dezelfde als bij Daken en panelen; `#zonder` zonder kaart: woningtype, dakvorm en maten als begin, de buren dicht en grijs, de helling van de panelen; `#etages` het huis opzij met de lagen, goot en nok; `#kamers` per etage van boven met Kies een indeling; `#lijnen` zelf lijnen zetten, elk vak in tweeën; `#hal` een ruimte erin zetten, de rest blijft de kamer eromheen (een L of U, vakken met dezelfde kamer zijn één ruimte), zones als stippellijn om te verschuiven; `#apparaten` apparaten op hun plek in de plattegrond; schets 8 november 2026, nog niet besloten); de tekeningen staan in `huisontwerp.js` | |
| `Wand-Leren` (leren, meekijken, regelen per apparaat) | |
| `Wand-Uitleg` (de rondleiding de eerste keer) | |
| `Wand-Inrichten-Panelen` (hoe de panelen liggen: voorstel, `#aanpassen`, `#wachten`; besluit 157) | `Panelen-Tel` |
| `Wand-Daken` (daken en panelen van boven, elk vlak een letter; `#vlak` de uitbouw oost-west, `#erbij`, `#meters` wat bij welke meter hoort, `#klopt` een vlak dat minder levert, `#huis` naast de 3D-tekening; schets 4 november 2026, nog niet besloten), `Wand-Inrichten-Daken` (de korte stap: waar liggen ze en hoeveel; `#voorstel`), `Wand-Daken-Elders` (per vlak op Thuis en `#opbrengst`); de tekening staat in `daken.js` | `Tel-Daken` (`#vlak` als blad, `#klopt`) |
| `Wand-Daken-Kaart` (de kaart is experimenteel: de melding met wat het doet, de privacy en altijd terug, 3D BAG naast OpenStreetMap; `#kaart` na het ophalen met Zonder kaart, `#terug` de vraag; op de echte pagina als achtergrond, 1340 breed; besluit 256, gebouwd in 0.128.0) | `Tel-Daken-Kaart` (de melding als blad) |
| `Wand-Daken-Watkan` (wat kan bij jouw huis: zelf tekenen, je plek, plattegrond en 3D-kaart van Nederland met hun stand, de bewoner kiest; `#na`, `#wijk`, `#geenplek`; op de echte pagina als achtergrond, 1340 breed; besluit 261, gebouwd in 0.134.0) | (op de telefoon dezelfde kaart onder de vlakken) |
| `Wand-Inrichten-Klimaat` (wat elk apparaat kan, per koppeling; `#badkamer`, `#keuken`, `#ir`; schets, nog niet besloten) | |
| `Wand-Sluipverbruik` (Opbrengst › Sluipverbruik: `#maanden`, en `#kaarten` met de tegel, de melding, de assistent en Wat je huis kan; schets, nog niet besloten) | `Tel-Sluipverbruik` |
| `Wand-Huis-Zonder` (een huis met minder: `#zonderpanelen`, `#verbruik`, `#zondermeter`, `#zondermeter-opbrengst`; schets, nog niet besloten) | |
| `Wand-Thuis` blijft | `Thuis-Tel` (Thuis opnieuw: de Assistent altijd boven de tabs; besluit 159) |
| `Wand-Thuis-Stand` (de stand-knop rechtsboven zegt wat er meespeelt: bijspringen, `#gewoon`, `#hand`, `#licht`, `#afwezig`, `#vakantie`, en met `-blad` het blad met de dag als balk; op de echte Thuis van het voorbeeldhuis op een winterdag, gemaakt met `stand-achtergrond.mjs`; inhoud in `stand-meldingen.js`; schets 8 november 2026; gebouwd in 0.157.0, besluit 286) | `Tel-Thuis-Stand` (de stand als regel naast de begroeting, ook zonder melding: "Dag tot 22:00") |
| `Wand-Thuis-Eigen` (de wand naar eigen smaak: `#aanpassen`, `#kiezen`), `Wand-Nacht` (avondstand, dagstand `#rust`, uit `#uit`, `#kiezen`; besluiten 164 en 165) | `Thuis-Tel-Eigen` (favorieten, `#aanpassen`, `#toevoegen`, `#favorieten`, `#weergave`, `#eenvoudig`) |
| `Wand-Thuis-3` (huis 3.0: het eiland met `#dag`, `#avond`, `#nacht`, `#winter`, `#regen`, en `#aanpassen` met smal of breed), `Wand-Huis-3` (de woningtypes `#rij`, `#hoek`, `#tweekap`, `#appartement`, `#minder`, `#zoom`), `Wand-Energie-Panelen-3` (`#gemeten`, `#leert`, `#garage`, `#zelf`), `Wand-Huis-kan-3` (zes groepen, `#ligging`); besluit 187 | `Tel-Huis-3` (één bovenbalk en het net onder het huis; `#avond`, `#balk`) |
| `Wand-Favorieten` (twaalf favorieten, vier per pagina, met het icoon van de kamer; `#kiezen` het kiesblad met de volgorde en een filter), `Wand-Rook` (het alarm bij rook; `#onderhoud` de rookmelders bij Onderhoud; besluit 170) | |
| `Wand-Instellingen-Groep` (een groep op de wand: grote regels links, wat mist bovenaan, het deel zonder scrollen, uitleg achter "Waarvoor is dit?"; `#hulp`) | `Instellingen-Tel-Groep` (een groep instellingen: de delen onder elkaar in plaats van een rij om opzij te schuiven; `#deel`, `#comfort`, `#nu`) |
| `Wand-Voortgang` (Hoe ver je huis is: de zonnewaaier met alles uit Home Assistant, vier ringen van gevonden tot werkt, en de weg naar zelf regelen; `#optijd` een onderwerp open, `#graat` de visgraat, `#ingang` waar je het opent; gebouwd als `voortgang.html`, de waaier staat in `frontend/kit/waaier.js`) | `Tel-Voortgang` (de waaier zonder namen, de lijst per groep met vier streepjes, `#optijd` het blad van onderen) |
| `Wand-Auto` (de pagina Auto: de auto als meter die zich vult tot zijn lading, de kabel van de laadpaal, laadgrens en laadbeurt, advies bij zon en prijs, en het blad Laden met de hoogste stroom en hoe lang; `#hand` met de hand op 8 A, `#beurten` de laadbeurten, `#paal` alleen de laadpaal in Home Assistant, `#twee` de tweede auto onderweg; de tekening staat in `frontend/kit/auto-tekening.js`), `Wand-Energie-Auto` (Energie › Auto en laadpaal: wat gevonden is, accu, laadpaal, plek in de tekening en bedienen; `#evcc`, `#niets`); schets 6 november 2026, nog niet besloten | `Tel-Auto` (`#laden` het blad van onderen; `#dag` en `#dag-avond` de balk van de dag in het blad, 8 november 2026: zon over, de goedkoopste uren en tot wanneer, een tik kiest de tijd; gebouwd in 0.153.0, besluit 279), `Thuis-Tel-Auto-Advies` (de eigen kaart met het advies op Thuis, alleen als er iets te winnen is: `#goedkoop`, `#niets`) |
| | `Instellingen-Tel-Meldingen` (Jij › Meldingen op je telefoon; `#melding` het slotscherm, `#geen` zonder telefoon; besluit 183) |
| | `Thuis-Tel-Kaarten` (de auto, de batterij, deze maand en de deurbel als kaart; `#licht`, `#anders` andere standen; besluit 182) |
| `Wand-Thuis-Profiel` (de wand in de kleur, met de kaarten en favorieten, van wiens comfort geldt; ieder die thuis is in zijn eigen kleur; besluit 181) | `Thuis-Tel-Licht` (Thuis in het lichte thema, met violet), `Instellingen-Tel-Jij` (Jij: alles van één bewoner; `#thema` het blad Thema en kleur, `#donker` hetzelfde in het donker) |

Voorbeeldgetallen. Schermafdrukken in `screens/`, opnieuw te maken met
`node render.cjs Wand-Thuis.html:1280:800 Thuis.html:390:844:vol`.

De tekenmotor en de stijlbasis staan in `frontend/kit/` en niet hier: de app
gebruikt precies die bestanden (besluit 104), en de NAS checkt `design/` niet
uit. De schetsen laden ze via `../../frontend/kit/`. Voor het overzicht op
claude.ai gaan ze mee als `kit/…`, met de verwijzingen in een kopie herschreven.
