# Project: SunArc OS (with the HEMS roadmap)

*Updated 1 October 2026. English translation of [Architecture.md](Architecture.md),
made 12 November 2026. The Dutch version leads: when the two differ, it is right.*

This document is the map of how things are now: which parts exist, how a
decision comes about, and where what runs. The why — which alternatives were
dropped and what a choice cost — is in [DECISIONS.md](DECISIONS.md) (in Dutch),
and this map refers to it.

**Agreement:** every commit that changes the structure or the behaviour updates
this map in the same commit. A machine cannot check prose for correctness;
that is why this is an agreement and not a test. The decision log does have a
test (decision 54 and the index).

**Language:** names in the code are English, everything else is Dutch,
including the Dutch original of this document. Keys in files and in the API
stay as they are, because old logs must stay readable (decision 59). That is
why many routes, files and fields below have Dutch names; the tables explain
what each one is.

## 1. The vision

An independent, predictive operating system for autonomous climate control,
which later grows into a full Home Energy Management System. Home Assistant is
only the hardware layer; the logic, the forecasting and the interface run in a
separate Node.js stack.

What has been added since the first version is the insight that **the
difficulty is not in the control logic but in proving it works**. The YAML
system we are replacing mostly worked; what was missing was a way to see
whether it was right. And the same kind of fault — something that is there and
does nothing — came back in this project itself, until a machine started
looking for it systematically (decision 54).

## 2. How a decision comes about

```
Home Assistant ──websocket──▶ EntityStore ──▶ buildSystemState ──▶ decide()
   (read only)                (filter, 16)    (one translation)     (pure core)
                                                     ▲                    │
                          OwnState (mode, timers) ───┤                    ▼
                 ShadowActuators (own state, 49) ────┘              Decision
                                                                         │
                ┌─────────────────────┬──────────────────────┬──────────┘
                ▼                     ▼                      ▼
          decision log           display (SSE)        ShadowActuators.follow
      decisions-*.ndjson                              OwnState.apply
```

**The core (`backend/src/core`).** One pure function,
`decide({ config, state, strategies })`. No I/O, no clock — the time is part of
the state — and no network. The same input gives the same output; a test with
thousands of generated states guards that and a handful of other rules
(decision 56). The core knows no entity IDs and no room names: whatever is
specific to a house lives in configuration.

Three strategies propose, one arbiter decides (decision 4):

- **comfort** keeps every zone at the target of the current mode, with the main
  device. It asks for no power budget: comfort does not fail because the sun is
  not shining. Where no main device can cool, comfort defends a ceiling — for
  this house 26 °C — on grid power if need be (decision 50).
- **pv-surplus** charges the building with power that would otherwise go to the
  grid, within a buffer band beyond the target. It pays from the budget.
- **heat-assist** lets the heat pump help out when the boiler has been heating
  for a while and the zone lags behind.

The **arbiter** shares out a budget: the surplus, plus what the controlled
devices are actually drawing now, plus a small tolerance (decisions 3, 49b).
Per device it checks the minimum run and rest time, the stabilisation after a
start or a parking period (decision 61), settling after a switch, and whether
there is enough margin to *start* rather than just keep running (decision 51).
Per decision it starts at most one device on the budget (decision 68). What
nobody wants any more, it winds down: first to standby, and after the
stabilisation, off (decision 5).

Besides power it guards the **current per phase** (decision 78), when the
configuration knows the connection (`grid.phases`, with the main fuse and a
margin). A start may not bring the current on any phase above the fuse minus
the margin; otherwise the result is `insufficient_current_budget`, with the
requested and remaining amps in the detail. The current comes from the P1
meter; if that is missing it is estimated from the grid power, and if both are
missing it starts nothing. With one phase the direction follows from the grid
power (feeding in makes a start lighter); with three phases the extra current
always adds on top. Winding down, adjusting and the failsafe never go through
this budget. The log records `fasen` (phases) for each decision, and
`stroomGeweigerd` (current refused) when a start failed on it.

Every decision carries an **`Explanation`**: mode, budget, per zone the
temperature, target and demand, plus outdoor temperature and solar yield as
observations. That contract is shared by the log, the display, the analysis and
the resident dashboard (decision 29).

**The shadow service (`backend/src/adapters/homeassistant`).** `HaClient`
connects to Home Assistant and refuses every `callService` while writing is
off; `query()` only knows a list of read commands (decision 15). The
`EntityStore` follows only the entities from the configuration. One translation
(`mapping.ts`) turns them into a state, for the live service and the replay
alike. `ShadowRunner` decides on every relevant change and every heartbeat,
with a minimum gap between evaluations and a watchdog that shuts down if it
gets stuck (decision 18).

Because the shadow does not switch anything, it keeps track itself of what it
would have done:

- **`OwnState`** — mode and timers, owned by the service (decision 39). For
  this house the stabilisation timer comes from here and not from the old
  system (decision 60).
- **`ShadowActuators`** — the state the arbiter would give the devices, so run
  times and hysteresis measure its own history (decision 49). The budget uses
  what the meter actually saw, and while the resident is in control the
  bookkeeping lets go (decision 49b).

**Startup (`backend/src/startup.ts`).** One pure function derives from the
environment how the service runs: add-on or not, the display, the write door,
the timings (decision 55). `main.ts` only carries it out.

**Configuration as data (`config/sites/*.json`).** Validated at startup, with
consistency checks; only what truly cannot be missing is an error, the rest
falls back safely (decision 40). Discovery proposes a configuration from the
Home Assistant registries and decides nothing (decision 41). A silence test
requires every field to be read somewhere or to be on a list with a reason
(decision 54).

**The display (`frontend/`).** Vanilla JS: `index.html` for the shadow
(Tailwind built locally), and the resident app in design 2 (decision 104), one
page per tab: `thuis.html` (home), `vandaag.html` (today), `apparaten.html`
(devices), `opbrengst.html` (yield), `assistent.html` (assistant), `kamer.html`
(room), `instellingen.html` (settings), `indeling.html` (rooms and layout),
`aansluiting.html` (connection), `meters.html` and `huis-kan.html` (what your
house can do), with the drawing engine from `frontend/kit/`. They read what the
service hands them ready-made and recalculate nothing. The shadow service
serves them itself:

| Route | What |
| --- | --- |
| `/api/state`, `/api/events` | the latest decision, and a stream of each next one; alongside it `bewoner` (resident) for the trial environment: the state per room, the heading of Home, the flows (rounded so they add up), what would happen per device and the words for a decision (decision 94, `web/resident.ts`) |
| `/api/divergence` | the review over the logs, updated every quarter hour from the checkpoint (decisions 26, 63) |
| `/api/site` | names and devices per zone, for the display |
| `/api/vandaag` | the day so far: sun per quarter hour, when each device ran according to SunArc and according to the current control, and the decisions; held for a minute |
| `/api/vraag` | the assistant that explains: a fixed question (`v=nu`, `waarom`, `straks`, `zon`, `doe` — now, why, later, sun, do) with an answer in words from the latest decision, in Dutch or English; every number comes with its source in `feiten` (facts) (decision 88); read only, also for a command (ONTWERP §7, phase 1) |
| `/api/zon` | the incoming sun: where the sun is, which façade it falls on and at what angle, and what the panels would deliver under a clear sky, now and per quarter hour of today; it uses `geometry` from the configuration and the location of the house from Home Assistant to one decimal, which is stored nowhere. The house learns that line from its own yield: per finished day the sun per quarter hour in `zon-kwartieren.json` (without location), and from that a factor on the model per position of the sun; `heldereLucht` (clear sky) says whether it is learned or still estimated, and with which factor; the shadow display shows that next to the dataset, the app only draws the line (decision 93) |
| `/api/huis` | the house as navigation: floors (top to bottom), rooms with their zone, temperature and the assistant's sentence, and the devices in them (climate from the configuration, sun shading, lights without groups, except a group whose lights are hidden or disabled: that group is the light itself, but an "all" group never is) with their state in words; from the Home Assistant registries, which the service rereads every quarter hour (ONTWERP §4, decision 94); with the resident's layout, or otherwise a proposal from Home Assistant (95); without what the resident hid, and with `lichtBedienen` (light control) (97); per house, floor and room a `samenvatting` (summary: lights on, screens, what is running), per light whether it dims and can go warm or cool; meters (temperature and humidity sensors in a room) as a device, per climate device what it measures, the target, what it does and whether it can cool and heat, and per room the humidity and, without a control area, the temperature from a meter |
| `GET`/`POST /api/indeling` | the layout of the house: fixed floors, rooms with zones and control area, and per device its own name and place; strictly checked (a device Home Assistant no longer knows drops out, and the place of a disabled light goes to its group), written to `indeling.json` in the log folder and never to Home Assistant; the control does not read it (decision 96). Also `verborgen` (hidden): devices the app does not show |
| `GET /api/sessie`, `GET /auth/login`, `GET /auth/callback`, `POST /auth/logout` | who is logged in, and logging in through Home Assistant: to the login screen, back with a code, a session of our own (cookie `HttpOnly`, `SameSite=Strict`; only a fingerprint in `sessies.json`) and the Home Assistant token discarded. Every write door needs a resident, the layout and the onboarding an administrator; looking stays open, and the service only answers on known host names (decision 99) |
| `POST /api/licht` | lights on or off, with brightness or warm/neutral/cool: one light, or all lights off in a room, on a floor or in the house; for one light also white in kelvin or a colour, if that light can do it (decision 100); only the lights the house shows, only `light.turn_on`/`light.turn_off`, with a rate limit; exists only with `HEMS_LIGHTS=1` or behind Ingress (decision 97) |
| `POST /api/scene` | turn on a Hue scene (`scene.turn_on`), only a scene the house shows in a room; the same switch and rate limit as the lights (decision 100) |
| `GET /api/aansluiting`, `POST /api/aansluiting` | the sun and your connection: panels, main fuse, power contract and devices on solar (`aansluiting.json` in the log folder). The page only sends answers; the service finds the power meters and devices itself, and fills in the configuration at startup where it is silent. Saving needs an administrator (decision 103) |
| `GET /api/energie`, `POST /api/energie` | the meters and prices for Yield: what the app stores (`energie.json` in the log folder), the proposal from the Home Assistant Energy dashboard and the meters to choose from; saving needs an administrator (decision 102) |
| `GET /api/opbrengst?soort=dag\|week\|maand\|jaar&datum=…` | looking back (day, week, month, year): power, sun, gas, per device (sun and grid allocated per hour), per day, the Sankey, costs, and comparing with the periods before and a year earlier, from the Home Assistant statistics (decision 102) |
| `POST /api/uitstel` | "ready by" for a deferrable device: `{ id, klaarVoor: "18:00" }` or `null`, only when it is ready to go; written to `uitstel.json` in the log folder, never to Home Assistant; the core works back to the latest start (decision 101) |
| `/api/health` | is it alive, when did it last decide, and which version (decision 54) |
| `/api/export`, `/api/export/info` | the whole dataset as tar.gz (decision 48) |
| `POST /api/onboarding` | writes the configuration, only behind Ingress (decision 42) |
| `GET`/`POST /api/gevoel` | the resident's feeling and comment, in fixed words, written to `gevoel.ndjson` in the log folder and never to Home Assistant (decision 84) |

Everything that is not GET or HEAD gets a 405 before routing — except those
doors, and they only exist when `main.ts` passes them in.

**The data.** Side by side in the log folder:

- `decisions-YYYY-MM-DD.ndjson` — every decision; in full when it changes,
  short when it stays the same (decision 11).
- `history-YYYY-MM-DD.ndjson` — every change of the followed entities, the raw
  history with which you can decide again later (decision 52). It also holds
  what is recorded only for later, such as gas and ventilation (`recordOnly`,
  decision 65).
- Days older than a week become `.ndjson.gz` (decision 58). All readers go
  through `divergence/read.ts`, which knows both forms.
- `runs.ndjson` — one line per start: which commit and which configuration
  decided from then on (decision 66). Included in the export.
- `own-state.json` — the service's own state (mode, timers, the assumed device
  state), so a restart does not wipe it (decision 62).
- `review-checkpoint.bin` — the checkpoint of the review after the last
  finished day (decision 63). Deleting it is fine: it then recalculates
  everything once.

**The harnesses (`backend/src/replay`, `backend/src/divergence`).** The replay
plays recorded history minute by minute and asks what the arbiter would do; it
is a shadow comparison, not a closed simulation, so temperature effects cannot
be seen. One day is a fixed test in git (decision 54). The divergence tool sets
the log against what the old system did.

**Two applications, not one.** What is described here is the *engine room*.
The dashboard for a resident becomes a separate application (phase 8), sharing
only the `Explanation` contract (decision 29). **The shadow mode stays** after
the switch too: it is the instrument with which every next home begins
(decision 28).

## 3. Design principles

- **No logic in the frontend.** The old dashboard duplicated the state machine
  in ~500 lines of JS; that was a source of divergence.
- **Absence of demand is not a strategy's job.** Strategies express demand; the
  arbiter winds down, because only it knows what a device is doing right now.
- **Time is input.** In the core and in the layer around it. A test that
  depends on the hour it runs tests nothing; tests wait for a condition, not
  for the clock.
- **A fault should fail loudly, not fall back quietly.** A setpoint out of range
  is rejected; a heartbeat of "30s" makes the service refuse to start.
- **What you cannot measure, you do not know.** Every claim about savings comes
  from a harness, with its limitations — and a headline number is first broken
  down by cause before it goes into the decision log (decision 49b).
- **A machine watches along.** What can go wrong should be found by a test, not
  by someone who happens to look (decision 54).

## 4. Roadmap

Phases 0 to 6 are done: core and replay, the shadow mode on the NAS,
configuration as data, the divergence tool, the display with export, and the
add-on with onboarding. The numbering after that uses letters, because steps
were added that were not in it; "phase 7" and "phase 8" keep their names,
because that is how they appear in the decision log and in the code.

| | What | Why | Status |
| --- | --- | --- | --- |
| **A** | **An honest shadow.** Own device state (49, 49b), comfort ceiling (50), start threshold (51), recording the raw history ourselves (52) | Without this the shadow measures the wrong things, or data gets lost | **done** |
| — | **The safety net.** CI before the NAS, fixed replay, silence test, version in health (54), startup (55), invariants (56), linter (57), compression (58), index on the decision log | The quality report of 30 September | **done** |
| **B** | **Really switching.** The actuator layer on, first for one device. Beforehand: a way back, the add-on on again as the place that controls (53), and recognising that the resident intervenes (74) | The moment the old system can go | after a winter and all functions (64); the way back a few weeks before |
| **C** | **Universal.** Every setup works, also with one air conditioner, cooling only, or a heat pump via SG-Ready (70); a deliberate table of defaults, a login on the display (23), a review that does not assume "the old system" (28), a dataset meter that counts only what the house can do (27, 70) | Needed for a second home | separate from B |
| **E** | **Looking ahead** — one half of phase 7. PV forecast, weather, dynamic tariffs | From reacting to optimising | after B, before D: this need not wait for a winter of data |
| **D** | **The thermal model** — the other half of phase 7. Learns per zone how fast it heats up and cools down and what the sun does; preheating is calculated, and the replay also works out the temperature | The learning part (46), and the only way to measure comfort gains | after a winter: spring 2027 |
| **F** | **The resident dashboard** — phase 8. Live power and climate in plain language, without entity IDs (45), on the phone and on a tablet on the wall. The sketches in `design/app/` are the standard (71); how it fits together is in `design/app/ONTWERP.md`, with rooms and zones (72) and the three phases (73) | What a resident sees | already running in the trial environment, next to C (94, 96); done after B |
| **G** | **The assistant** (44). Questions in language or by voice, locally. A fourth proposer, not a boss | The conversation with the house | after F |
| **H** | **Product** (34). Several homes, remote updates, support | From this house to other houses | after C and F |

Two things set the pace. **D is tied to the season**: a winter cannot be
hurried. That is why E comes before D: forecasts and tariffs work straight
after B, the model only once the winter is in it. **B is the moment of
handover**: everything before B may fail without anyone getting cold,
everything after it may not.

## 5. Where we stand

The shadow mode runs unattended on the Synology, connected to Home Assistant on
the Pi, and writes away every decision and every change. It switches nothing.

What the first month showed (26 days, over 210,000 moments, up to 30 September
2026):

- the arbiter agrees with the old system 95.4% (living room) and 93.2% (attic)
  of the time, with no gaps in the recording
- in shadow mode the run times guarded nothing, because they read the history
  of the real device; since decision 49 they measure its own switching
- there was no comfort path for cooling; the living room was above its target
  96.6% of the time. Since decision 50 a ceiling of 26 °C applies
- the grid power that the minimum run time costs is about 2 kWh per ten days
  (decision 49b; a first measurement of 22 kWh turned out to be a fault in the
  shadow itself)
- the configured start threshold of 1000 W was enforced by nothing; since
  decision 51 it is

Quality control: 282 tests in 17 files, typecheck at the strictest setting, a
linter, and a CI that runs on every push and only then lets the NAS roll out.
The fixed replay and the invariants guard the behaviour of the core, the
silence test the configuration, the index test the decision log.

Not yet shown: whether the arbiter does better in practice, and how much cooler
or warmer the house gets from it. The first needs winter data, the second the
thermal model — and that winter data is being collected now.

## 6. Repository and infrastructure

Monorepo at `github.com/Ricardo-switch/SunArc` (public; until 1 November 2026 it
was called `hems-climate`, and GitHub redirects that address).

```
.github/        The CI: typecheck, lint, tests, builds and the image, and the stable branch
backend/        Node.js: core, adapters, replay, divergence, web server
  src/            the service
  test/           the tests, with fixtures/ for the fixed replay
  tools/          tools: recorder export, merging history, index
frontend/       The display; builds to backend/web
design/app2/    The app sketches, design 2: the standard, and the sketch is the code (104)
design/app/     Design 1: only ONTWERP.md, with how it fits together (71)
addon/          The Home Assistant add-on, ready-made from GitHub (153)
config/sites/   Configuration per installation
deploy/         Compose, rollout script, manual for the NAS
docs/oude-regeling/  The YAML system being replaced, and the repairs to it
HA export/      Reference: helpers, entity registry, dashboards
```

**Building.** The Dockerfile has three stages: the display, the backend, and
the run stage that keeps only `dist` and `web`. The build context is the
project root, with the `.dockerignore` there. The commit and the build time go
into the image as build arguments (decision 54). The image contains zero
runtime dependencies; the linter and the test tools stay in the build stage.

**Rollout.** Every five minutes the NAS runs `deploy.sh` from the Synology Task
Scheduler. The script follows the branch checked out on the NAS: `stable`. That
branch only moves when the CI is green — including building the image with the
same Dockerfile and context as the NAS; a push to `main` that fails therefore
never reaches the NAS (decision 54). The script only builds when something in
`backend/` changed, builds *first* and only then switches over, tests the
running configuration against the new image (decision 33), and keeps track in
`.deployed` of which commit is really running. Which commit that is, the
service tells itself in `/api/health`.

**One running shadow.** Only the NAS (decision 53). The add-on on the Pi is
idle and comes back in step B, as the place where control happens.

**The Task Scheduler is a different environment from a shell** (decision 22):

1. No `PATH` to docker and git — they are looked up explicitly.
2. No `HOME=/root` — the SSH key is passed explicitly.
3. Called as `sh script`, so bash runs in POSIX mode — the script restarts
   itself with a real bash.
4. Line endings — `.gitattributes` fixes LF for everything that runs on Linux.
5. Overwriting during a run — bash reads a script from disk while running it.
   Since 30 September the script in git is wrapped in braces with an `exit`
   inside, so a running run finishes its own version. On the NAS that holds
   from the first copy of that version; make that one copy just after a
   "Nothing to do" line in the journal.

Test a change to the rollout script through *Run* in the Task Scheduler, not
from the command line. Git commands on the NAS go with `sudo -H`: the working
folder and the SSH key belong to root.

**What stays outside git, and so goes to the NAS by hand:** the HA token
(`.env`), `docker-compose.yml`, `deploy.sh` itself (decision 20) and
`config/sites/*.json` (decision 21). The rollout script reports when one of
them differs from git, but does not copy them over. A configuration change is
only active after you copy it yourself and restart the container.

**The data stays outside git too.** The logs and the history are on the NAS;
`/api/export` fetches them. Since 30 September 2026 the Home Assistant recorder
keeps sixty days and is the safety net for gaps in our own history, via
`backend/tools/export-history.ts`.

## 7. Why it is this way

This document describes the current state. *Why* these choices were made is in
[DECISIONS.md](DECISIONS.md), with an index by subject at the top. That is the
document you will need in half a year, because the code tells you the what and
not the why.

## 8. Next step

Step A, the safety net and the agreement on the language of names (decision
59) are done.

Now: let the shadow measure. Since decisions 60 and 61 the stabilisation runs
on its own timer, and since decision 62 its own state survives a restart.
Real switching only happens when the dataset meter shows thirty winter days and
one hundred percent function coverage (decision 64), at the earliest at the end
of December 2026. The way back (one switch that decides who is in control, and
a dead man's switch in Home Assistant) and the add-on belong to that step. They
come a few weeks before it, so the sign of life has already been running before
anyone relies on it. C can run alongside, but is only needed for a second home.
D waits for the winter.
