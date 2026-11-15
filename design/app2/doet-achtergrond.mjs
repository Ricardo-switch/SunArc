// Maakt de achtergronden voor Wand-Thuis-Doet en Tel-Thuis-Doet (15 november 2026): de echte Thuis uit het
// voorbeeldhuis op een winterochtend (10:15), zonder begroeting, kop en zin (die tekent de schets),
// met de plek voor de strook vrijgemaakt zoals de bouw dat doet. Schrijft ook
// wat de dienst op dat moment zegt (kop, zin, per kamer) naar screens/Doet-achtergrond.json, zodat de schets
// dezelfde getallen gebruikt als het huis op de achtergrond.
// Gebruik: node design/app2/doet-achtergrond.mjs (vanuit de repo, na npm run build in frontend).
import { fork } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..').replaceAll('\\', '/');
const require = createRequire(`${repo}/backend/package.json`);
const { chromium } = require('playwright');
const tsx = pathToFileURL(`${repo}/backend/node_modules/tsx/dist/esm/index.mjs`).href;
const env = { PATH: process.env.PATH, TZ: 'Europe/Amsterdam', HEMS_WEB_DIR: `${repo}/backend/web`, HEMS_VOORBEELD_TAAL: 'nl', HEMS_VOORBEELD_KLOK: '615:winter' };
const p = fork(`${repo}/backend/src/voorbeeld/start.ts`, [], { env, execArgv: ['--import', tsx], stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
const poort = await new Promise((ok) => p.on('message', (b) => b.klaar && ok(b.klaar)));
const zet = (klok) => new Promise((ok) => { p.once('message', ok); p.send({ klok }); });

const out = `${repo}/design/app2/screens`;
await zet({ minuut: 615, seizoen: 'winter' });
const browser = await chromium.launch();
let staat = null;
for (const [scherm, w, h] of [['wand', 1280, 800], ['tel', 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, timezoneId: 'Europe/Amsterdam' });
  await ctx.addInitScript(() => localStorage.setItem('sc-rondleiding-gezien', '1'));
  // De plek van de strook: op de wand het huis 16 punten lager af (596 in plaats van 612), zodat de strook
  // tussen het huis en de vraagbalk past; op de telefoon 68 punten ruimte tussen het huis en de stromen.
  await ctx.addInitScript(() => addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = '#wand .podium { height: 596px !important; } #tel .podium { margin-bottom: 68px !important; }';
    document.head.append(st);
  }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-11-08T10:15:00+01:00'));
  await page.goto(`http://127.0.0.1:${poort}/thuis.html`);
  await page.waitForTimeout(3500);
  if (!staat) {
    staat = await page.evaluate(async () => {
      const s = await (await fetch('api/state')).json();
      const b = s.bewoner ?? {};
      const d = await (await fetch('api/divergence')).json().catch(() => null);
      const winter = d?.dataset?.seizoenen?.find((x) => x.seizoen === 'winter') ?? null;
      return { kop: b.kop, rust: b.rust, kamers: b.kamers, stand: b.stand?.kort, uitstelbaar: b.uitstelbaar?.map((u) => ({ naam: u.naam, stand: u.stand, kop: u.kop, zin: u.zin })), warmtebuffers: b.warmtebuffers?.map((u) => ({ naam: u.naam, kop: u.kop, zin: u.zin })), winter: winter && { dagen: winter.dagen, doel: winter.doel }, vanMs: d?.vanMs ?? null, perZone: s.explanation?.perZone?.map((z) => ({ zoneId: z.zoneId, temperatureC: z.temperatureC, targetC: z.targetC, demand: z.demand })) };
    });
  }
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) if (b.textContent.trim() === 'Oké') b.click();
    for (const el of document.querySelectorAll('[data-groet], [data-kop], [data-zin]')) el.style.visibility = 'hidden';
    // Op de telefoon staat de stand naast de begroeting: die tekent de schets mee.
    for (const el of document.querySelectorAll('#tel .groetregel')) el.style.visibility = 'hidden';
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/Doet-achtergrond-${scherm}.png`, animations: 'disabled' });
  console.log('ok', scherm);
  await ctx.close();
}
writeFileSync(`${out}/Doet-achtergrond.json`, `${JSON.stringify(staat, null, 2)}\n`);
await browser.close();
p.kill();
process.exit(0);
