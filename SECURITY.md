# Security

SunArc runs inside your own home and writes to Home Assistant only through a short list of narrow doors, listed below. A security problem therefore matters, and I would like to hear about it before it is public.

## Reporting a vulnerability

Please use **[Report a vulnerability](https://github.com/Ricardo-switch/SunArc/security/advisories/new)** on GitHub. That keeps the report private between you and the maintainer. Do not open a public issue.

Mention the version (Settings › About this app, or `/api/health`), how SunArc runs (Home Assistant add-on or Docker), and the steps to reproduce. Dutch or English are both fine.

You will get an answer within a week. A fix ships as a new add-on version; the changelog names the problem once the update is out.

## What SunArc may write to Home Assistant

Writing is off by default. Each door below checks the domain, the service, the fields and the target; anything else is refused before it reaches Home Assistant. The list comes from `SCHRIJFDEUREN` in `backend/src/adapters/homeassistant/client.ts`, and a test keeps this page equal to it.

- Lights: `light.turn_on` and `light.turn_off` on `light.` entities only, never an area, device or label.
- Scenes: `scene.turn_on` on one `scene.` entity.
- Blinds and screens: open, close, stop, or a position from 0 to 100 on one `cover.` entity; no tilt, group or area.
- Its own update: `update.install` and `homeassistant.update_entity` on the update entity of the SunArc add-on itself.
- Notifications: `notify.mobile_app_…` with a title, a text and the fixed fields of the companion app.
- Lists: `todo.add_item`, `todo.update_item` (done or not done) and `todo.remove_completed_items` on one `todo.` entity; single items cannot be deleted.
- The climate bridge to an existing automation (add-on only): a number on an allowed `input_number`, or an allowed option on an allowed `input_select`.
- By hand, always with an end time: an air conditioner from the list to heat, a temperature, off, dry or fan only; climate outside the controller (like a garden house) to heat, off or one of its own presets; a smart plug from the list on or off.
- Appliances waiting for sun: `button.press` on one start button from the list.
- Charging by hand, only on a charger you allowed: the charging current within its range, the charge switch, pause or resume; the Easee dynamic limit, pause and resume; or the mode of an evcc charge point.

The controller itself writes nothing until you let SunArc take over a room. Besides these doors, SunArc can ask a Home Assistant AI task for a text (only an `ai_task.` entity you chose), and writes the integration to `custom_components/sunarc` after your tap.

## What is in scope

- The add-on and its web app, including the separate port for Tailscale (decision 160).
- The doors above. Anything that writes outside them is a bug.
- The Home Assistant integration in `custom_components/sunarc`.

## Supported versions

Only the latest version on `main` gets fixes. Home Assistant offers the update in the add-on store.
