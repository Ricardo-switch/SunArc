// Maakt de achtergronden voor Wand-Thuis-Stand en Tel-Thuis-Stand (8 november 2026): de echte Thuis uit het
// voorbeeldhuis op een winterochtend (10:15) en -avond (22:40), zonder begroeting, kop en zin (die tekent de schets).
// Op de wand blijft de stand-knop rechtsboven, met per stand de tekst van stand-meldingen.js erin, zodat de
// app hem zelf opmaakt. Gebruik: node design/app2/stand-achtergrond.mjs (vanuit de repo, na npm run build in frontend).
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..').replaceAll('\\', '/');
const require = createRequire(`${repo}/backend/package.json`);
const { chromium } = require('playwright');
const tsx = pathToFileURL(`${repo}/backend/node_modules/tsx/dist/esm/index.mjs`).href;
const env = { PATH: process.env.PATH, TZ: 'Europe/Amsterdam', HEMS_WEB_DIR: `${repo}/backend/web`, HEMS_VOORBEELD_TAAL: 'nl' };
const p = fork(`${repo}/backend/src/voorbeeld/start.ts`, [], { env, execArgv: ['--import', tsx], stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
const poort = await new Promise((ok) => p.on('message', (b) => b.klaar && ok(b.klaar)));
const zet = (klok) => new Promise((ok) => { p.once('message', ok); p.send({ klok }); });

/* De knop op de wand per stand; dezelfde woorden als `pil` in stand-meldingen.js. */
const PIL = {
  bijspringen: ['ochtend', 'Dag', 'de airco springt bij', '#ff7a4d'],
  gewoon: ['ochtend', 'Dag', 'tot 22:00', null],
  hand: ['ochtend', 'Dag', 'airco zolder met de hand', '#6ee7b7'],
  licht: ['avond', 'Dag', 'er brandt nog licht', '#f7b548'],
  afwezig: ['avond', 'Afwezig', 'niemand thuis', '#6fd3ff'],
  vakantie: ['avond', 'Vakantie', 'gekozen in Home Assistant', '#8f86ff'],
};
const MOMENT = { ochtend: [615, '2026-11-08T10:15:00+01:00'], avond: [1360, '2026-11-08T22:40:00+01:00'] };

const browser = await chromium.launch();
const out = `${repo}/design/app2/screens`;
async function foto(scherm, moment, naam, pil) {
  const [w, h] = scherm === 'wand' ? [1280, 800] : [390, 844];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, timezoneId: 'Europe/Amsterdam' });
  await ctx.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(MOMENT[moment][1]));
  await page.goto(`http://127.0.0.1:${poort}/thuis.html`);
  await page.waitForTimeout(3500);
  await page.evaluate((pil) => {
    for (const b of document.querySelectorAll('button')) if (b.textContent.trim() === 'Oké') b.click();
    for (const el of document.querySelectorAll('[data-groet], [data-kop], [data-zin]')) el.style.visibility = 'hidden';
    for (const el of document.querySelectorAll('[data-modus]')) {
      if (!pil) { el.style.visibility = 'hidden'; continue; }
      const [, stand, wat, kleur] = pil;
      const stip = kleur ? `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 9px; background: ${kleur}; box-shadow: 0 0 0 4px color-mix(in srgb, ${kleur} 22%, transparent)"></span>` : '';
      el.innerHTML = `${stip}<b>${stand}</b><span style="color: ${kleur ? `color-mix(in srgb, ${kleur} 70%, white)` : 'var(--zacht)'}; font-weight: 500">&nbsp;· ${wat}</span> <span aria-hidden="true" style="color: var(--gedempt)">▾</span>`;
    }
  }, pil);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/Stand-achtergrond-${scherm}-${naam}.png`, animations: 'disabled' });
  console.log('ok', scherm, naam);
  await ctx.close();
}

for (const moment of ['ochtend', 'avond']) {
  await zet({ minuut: MOMENT[moment][0], seizoen: 'winter' });
  // De telefoon zonder knop (de schets zet de stand naast de begroeting), de wand per stand.
  await foto('tel', moment, moment, null);
  for (const [naam, pil] of Object.entries(PIL)) if (pil[0] === moment) await foto('wand', moment, naam, pil);
}
await browser.close();
p.kill();
process.exit(0);
