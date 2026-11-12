<p align="center"><img src="frontend/kit/merk.svg" alt="" width="180"></p>

<h1 align="center">SunArc</h1>

<p align="center"><sub>AUTONOMOUS RESIDENTIAL CLIMATE</sub></p>

<p align="center"><b>Climate and sun in one app, for Home Assistant.</b><br>
Your home thinks along with the sun: it watches your heating, air conditioners and solar panels,<br>
and explains every decision it makes.</p>

<p align="center">
<a href="https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FRicardo-switch%2FSunArc"><img src="https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg" alt="Add the repository to your Home Assistant"></a>
</p>

<p align="center">
<a href="https://paypal.me/sunarc"><img alt="Buy me a coffee" src="https://img.shields.io/badge/Buy_me_a_coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black" height="44"></a>
</p>

<p align="center">
<img alt="Version" src="https://img.shields.io/badge/dynamic/yaml?url=https%3A%2F%2Fraw.githubusercontent.com%2FRicardo-switch%2FSunArc%2Fmain%2Faddon%2Fconfig.yaml&query=%24.version&label=add-on&color=f7b548">
<img alt="Stage: experimental" src="https://img.shields.io/badge/stage-experimental-e58a3a">
<img alt="aarch64 and amd64" src="https://img.shields.io/badge/arch-aarch64%20%7C%20amd64-6fd3ff">
<img alt="License AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-8f86ff">
</p>

<p align="center"><b>English</b> · <a href="README.nl.md">Nederlands</a></p>

<p align="center"><img src="design/app2/screens/github/en-wand-thuis.png" alt="Home on a wall tablet: the house in 3D, with the sun, the solar panels and the temperature in every room" width="900"></p>

<p align="center"><sub>Screenshots from the app, in the example house.</sub></p>

> **One thing to install: the add-on.** It contains the whole app and the controller.
> The **SunArc integration** (the release called *Assist integration 2.0.0 (optional)*) is **optional**: you only need it to ask SunArc questions through Home Assistant's Assist. The add-on versions are the `0.x` releases.

---

## In short

- **What it is:** a Home Assistant add-on with its own app for a wall tablet and your phone. It draws your home as an open dollhouse, built from what Home Assistant already knows.
- **What it does:** comfort per room, your own solar power used in your own home first, and a clear view of energy and costs. Every decision comes with the reason, in plain words.
- **Where it stands:** SunArc is **watching**. It decides and records everything, but does not switch your heating and air conditioners on its own yet. Real control comes after a full winter of watching, with a report that proves it does better than your current setup. Lights, scenes, blinds and manual climate control (always with an end time) already work from the app.
- **Your data stays home.** Everything runs on your own Home Assistant; only the weather forecast is fetched.

## Contents

- [What it can do](#what-it-can-do)
- [What is not there yet](#what-is-not-there-yet)
- [What you need](#what-you-need)
- [Install](#install)
- [Optional: ask SunArc through Assist](#optional-ask-sunarc-through-assist)
- [Safe](#safe)
- [How it works](#how-it-works)
- [Contributing](#contributing) · [Support](#support) · [License](#license)

## What it can do

The app has a page **What your house can do** that lists all of this for your own home: what works, what is still learning, and what your setup is missing for the rest.

### Your home in one picture
- **The house in 3D**, from the floors, rooms and devices in Home Assistant. You arrange it by floor, room and zone, add your own floors, and place the panels, the garage or the garden house outside.
- **Per room** the temperature, what is heating or cooling, and which sensor counts.
- **Batteries and filters:** an almost empty sensor battery or a full air conditioner filter shows on Home, with a tap to the device.
- **Doors and gates** to look at; the app never opens or closes them.

### Comfort
- **Comfort per room and per part of the day**, the way you set it.
- **Per resident:** the first one home, in the order you choose, sets the comfort. Everyone signs in with their own Home Assistant account.
- **Away and holiday:** more economical when nobody is home; you switch Holiday on yourself.
- **Learns what you like:** tap "too cold, fine, too warm" on Home, and the house puts it next to the temperature at that moment.
- **How your home holds heat:** per room how fast it cools down, and what the sun and each device add.
- **Heating per room** with a thermostat, smart radiator valves or an electric heater, even with one boiler.

### Sun
- **Cooling and heating on solar:** air conditioners run on the power of your own panels when a room needs it.
- **Appliances on solar:** a dryer, washing machine or dishwasher with remote start waits for sun, and is still done at the time you choose.
- **Water heater and hot tub on solar:** they heat up with what is left over and keep a minimum, so there is always hot water.
- **The weather and tomorrow's sun:** per hour and per day, with what your panels are expected to deliver.
- **How your panels lie:** the house works out which way they face and how steep they are. Panels on a garage, carport or garden house count too.
- **Never more than your fuse:** a power budget per phase, so the main fuse holds. Any fuse from 6 to 250 A, one or three phases.

### Energy and costs
- **Today:** the day on a timeline, with what each device did and why.
- **Energy** per day, week, month or contract year: what you use, what your panels produce and what it costs, with the prices of your own contract (peak and off-peak, net metering and after). The meters come straight from Home Assistant's Energy dashboard.
- **The solar forecast** next to what actually came.
- **Standby use:** every night the house checks what it uses when nothing runs, and tells you when that stands out.
- **A home battery, worked out:** no battery yet? The app replays your past year hour by hour and shows the size that fits. Already have one? It shows how full it is and what it does.
- **The car:** how full it is and whether it is charging.

### Control
- **Lights and Hue scenes**, per room, with one tap.
- **Blinds and awnings:** open, closed, or dragged to any position.
- **Manual climate control:** the thermostat or an air conditioner until a time you choose, then back to your schedule.
- **Regular and planned:** "every weekday, a quarter of an hour before sunset, close the blinds", and the house keeps doing it.
- **Cameras** in the room where they hang, and **the doorbell** image on every screen when someone rings.

### The assistant and To do
- **Ask your house** in your own words ("why is the attic waiting?"), and it answers out loud with the voice from Home Assistant.
- **Fully at home:** understanding, the voice and the wake word **"Hey house"** can all run on your own Home Assistant. On the phone you use the microphone.
- **To do:** reminders, waste collection, your calendars and the shopping list together, in their own tab.

### Wall tablet and phone
- **One app** for the wall and the phone. Each resident sets up their own Home once, for the phone and the wall alike.
- **Screen off when nobody is there:** with Fully Kiosk Browser on the tablet, the screen goes off and wakes when someone walks past.

### Setting up
- **A welcome and a setup of about ten minutes:** your house grows from what Home Assistant knows, and you confirm what it suggests.
- **Getting Home Assistant ready:** a checklist per feature of what Home Assistant needs, such as a smart meter, voice or Fully Kiosk.
- **How far your house is:** one picture of everything that works, learns or is still missing.
- **An example house** to look around first, where every button works.
- **A backup** of your settings in one small file, and restoring it.
- **English and Dutch.**

<table>
<tr>
<td width="50%"><img src="design/app2/screens/github/en-wand-vandaag.png" alt="Today: the sun, the temperature and per device when it ran, with why"></td>
<td width="50%"><img src="design/app2/screens/github/en-wand-assistent.png" alt="The assistant: asking your home a question"></td>
</tr>
<tr>
<td><sub><b>Today</b>: what the house did, and why.</sub></td>
<td><sub><b>The assistant</b>: ask your house.</sub></td>
</tr>
<tr>
<td><img src="design/app2/screens/github/en-wand-huis-kan.png" alt="What your house can do: everything SunArc does for you, and how far it is"></td>
<td align="center"><img src="design/app2/screens/github/en-tel-thuis.png" alt="Home on the phone" width="220"></td>
</tr>
<tr>
<td><sub><b>What your house can do</b>: everything SunArc does for you, and how far it is.</sub></td>
<td align="center"><sub><b>On your phone</b>: the same app.</sub></td>
</tr>
</table>

## What is not there yet

- **Real control** of heating and air conditioners, after a winter of watching with thirty winter days of evidence.
- What the house learns this winter about your boiler and ventilation, used by the controller itself.
- **Steering a home battery or an EV charger.** SunArc shows them, but does not control them.
- **Cheap hours** with a dynamic contract: moving cooling, heating and washing to the cheapest hours.

## What you need

- **Home Assistant with add-ons:** Home Assistant OS or Supervised, on a Raspberry Pi or a regular PC (aarch64 or amd64).
- **Your own devices, of any brand.** SunArc works with what your home has: an air conditioner, a thermostat, radiator valves, a smart meter, solar panels, lights, blinds. It does what your setup allows, and **What your house can do** says what is missing for the rest.
- For the best results: a **smart meter** that reports live power (P1, preferably local), and **rooms (areas)** in Home Assistant.

## Install

1. Tap the **Add repository** button above. Or go to **Settings → Add-ons → Add-on store**, choose the three dots at the top right → **Repositories**, and add:
   ```
   https://github.com/Ricardo-switch/SunArc
   ```
2. Choose **SunArc** → **Install**, then **Start**. Turn on **Show in sidebar**.
3. Open SunArc in the sidebar. A new home starts with a welcome, and one button starts the setup.

That is all you need. Updates come through Home Assistant; turn on **Auto update** on the add-on page if you want them to arrive by themselves. What is new in each version is in the [releases](https://github.com/Ricardo-switch/SunArc/releases) and in the add-on itself.

<a id="ask-sunarc-through-assist"></a>

## Optional: ask SunArc through Assist

The app has its own assistant, so this is not needed. Only if you also want to ask SunArc through Home Assistant's **Assist** ("why is the attic running?", "what are you doing?"), add the small **SunArc** integration. No YAML: the add-on announces itself.

- **Without HACS:** open SunArc → **Settings → Residents and access → Key for the assistant** and tap **Put the integration in Home Assistant**. Then restart Home Assistant.
- **With HACS:** in HACS choose the three dots → **Custom repositories**, add `https://github.com/Ricardo-switch/SunArc` as an **Integration**, install **SunArc** and restart Home Assistant. HACS installs only this integration; the add-on always comes from the add-on store.

Home Assistant then shows **New device discovered: SunArc**; click **Add**. You do this once. The integration has its own version (2.0.1), which only goes up when the integration itself changes; SunArc updates need no restart, because the sentences and answers come from the add-on.

**What it writes:** the integration creates one file per language in your Home Assistant configuration folder, `custom_sentences/<language>/sunarc.yaml`, with the Assist sentences for your rooms. It refreshes that file from the add-on every 30 minutes, and removes it when you remove the integration. It touches no other file.

## Safe

- The app sits behind the Home Assistant login (Ingress). No port is open, unless you turn on the separate port for Tailscale yourself.
- Its own AppArmor profile: security rating 8, the highest.
- The images are built on GitHub and signed with Cosign.
- SunArc writes to Home Assistant only through narrow doors: lights, scenes, blinds, the start button of an appliance waiting for solar power, and manual climate control and manual charging with an end time (charging only when you allow it). A test proves nothing else gets through. Why the add-on may write to the Home Assistant configuration is explained in the add-on documentation.
- Found a weakness? See [SECURITY.md](SECURITY.md).

## How it works

- **A pure core.** Strategies each make a proposal (comfort, heat assist, surplus solar), and one arbiter decides within a power budget. The core does no input or output and reads no clock, so every decision can be recomputed.
- **Everything is recorded.** Every decision, with the state of the house and the version that made it. That is where the evidence for real control comes from.
- **What differs per home is a setting**, not code. What Home Assistant already knows, the app suggests; you confirm.

The project is written in Dutch, including the decision log. Read more:
- [STAND.md](STAND.md): how each part works today.
- [DECISIONS.md](DECISIONS.md): every decision, with why and what it cost.
- [Architecture.en.md](Architecture.en.md): how it is built (an English translation of [Architecture.md](Architecture.md)).
- [design/app2](design/app2): the sketches of the app. The sketch is the code: the app draws the house with the same files.
- [docs/oude-regeling](docs/oude-regeling): the YAML setup that SunArc replaces.

## Contributing

The service is TypeScript on Node 22, the app plain HTML and JavaScript with Tailwind.

```bash
cd backend && npm ci && npm test
```

Work goes to `beta`. CI checks every push (typecheck, lint, tests, the page in a browser and the image), and only a pull request goes to `main`. `main` is what Home Assistant installs. A bug or an idea? Open an [issue](https://github.com/Ricardo-switch/SunArc/issues/new/choose); English or Dutch.

## Support

SunArc is free. Like it? You can [buy me a coffee via PayPal](https://paypal.me/sunarc). Thank you!

## License

SunArc is free software under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). You may use, change and share it. Anyone who distributes a changed version, or offers it as a service or on a device, shares the source code under the same license.

The name SunArc and the mark are not covered by this license.

From others, each with its own license:

- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase, MIT: the QR code for residents.
- The typefaces [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) and [Figtree](https://fonts.google.com/specimen/Figtree), SIL Open Font License 1.1.
- The two front stages of the wake word from [openWakeWord](https://github.com/dscripka/openWakeWord) (`melspectrogram.onnx` and `embedding_model.onnx`), CC BY-NC-SA 4.0: not for commercial use.
