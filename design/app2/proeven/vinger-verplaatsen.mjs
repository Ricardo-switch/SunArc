// Proef: een ruimte in zijn geheel verplaatsen, weghalen, een andere bron kiezen en het huis draaien, met een nagebootste vinger.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../backend/package.json', import.meta.url));
const { chromium } = require('playwright');
const basis = process.argv[2] ?? 'http://localhost:4173/design/app2';
const uit = process.argv[3];
const browser = await chromium.launch({ channel: 'msedge' });
let fouten = 0;
const zeg = (goed, tekst) => { if (!goed) fouten++; console.log(`${goed ? 'goed' : 'FOUT'}  ${tekst}`); };

for (const [naam, bestand, breed, hoog] of [['WAND', 'Wand-Huis-Tekenen.html', 1280, 800], ['TELEFOON', 'Tel-Huis-Tekenen.html', 390, 844]]) {
  console.log(`\n== ${naam} ==`);
  const ctx = await browser.newContext({ viewport: { width: breed, height: hoog }, hasTouch: true, isMobile: breed < 600 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => zeg(false, `fout in de pagina: ${e.message}`));
  const cdp = await ctx.newCDPSession(p);
  const open = async (hash) => { await p.goto(`${basis}/${bestand}?v=${Math.random()}#${hash}`); await p.waitForTimeout(900); await p.evaluate(() => { window.__log = []; for (const n of ['pointerdown', 'pointerup', 'pointercancel']) document.addEventListener(n, () => window.__log.push(n), true); }); };
  const log = () => p.evaluate(() => { const l = window.__log.join(' '); window.__log = []; return l; });
  const scherm = async (u, v) => { await p.evaluate(() => document.getElementById('tekening').scrollIntoView({ block: 'center' })); return p.evaluate(([u, v]) => { const t = window.tekenaar; const r = document.getElementById('tekening').getBoundingClientRect(); const g = document.querySelector('#tekening [data-l="vlak"] g').getAttribute('transform'); const [, ox, oy, k] = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)/.exec(g).map(Number); return [r.left + ox + (t.MARGE + u * 10) * k, r.top + oy - (t.MARGE + v * 10) * k]; }, [u, v]); };
  const veegPx = async (van, naar) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: van[0], y: van[1] }] }); for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: van[0] + ((naar[0] - van[0]) * i) / 10, y: van[1] + ((naar[1] - van[1]) * i) / 10 }] }); await p.waitForTimeout(16); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(350); };
  const veeg = async (a, b) => veegPx(await scherm(...a), await scherm(...b));
  const tik = async (u, v) => { const [x, y] = await scherm(u, v); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(300); };
  const stand = () => p.evaluate(() => { const t = window.tekenaar; const v = t.vloer(); const m = t.maten(); const o = {}; for (const [id, r] of Object.entries(v.ruimtes)) o[t.naamVan(r) ?? `vak${id}`] = { x0: m[id].x0 - t.MARGE, y0: m[id].y0 - t.MARGE, x1: m[id].x1 - t.MARGE, y1: m[id].y1 - t.MARGE, n: m[id].n }; return o; });

  // 1. Het toilet in zijn geheel verplaatsen: aantikken, het blauwe rondje pakken, 2 meter naar rechts en tegen de achtergevel.
  await open('kern');
  const voor = await stand();
  await tik(5.4, 2.7);
  await veeg([5.4, 2.7], [7.43, 6.15]);
  const na = await stand();
  zeg((await log()).endsWith('pointerdown pointerup'), 'verplaatsen: de vinger blijft bij de tekening');
  zeg(na.Toilet.x1 - na.Toilet.x0 === 12 && na.Toilet.y1 - na.Toilet.y0 === 26 && na.Toilet.n === voor.Toilet.n, 'het toilet houdt zijn maat (1,2 bij 2,6 m)');
  zeg(na.Toilet.y1 === 76 && na.Toilet.x0 === 68, `het staat 2 m verder en klikte vast tegen de achtergevel (${JSON.stringify(na.Toilet)})`);
  zeg(na.Woonkamer.n === voor.Woonkamer.n && na.Hal.n === voor.Hal.n && na.Trap.n === voor.Trap.n, 'waar het stond is weer woonkamer; hal en trap zijn niet veranderd');
  if (uit) await p.screenshot({ path: `${uit}/${naam}-verplaatst.png`, fullPage: breed < 600 });
  await p.click('#terug');
  zeg((await stand()).Toilet.x0 === 48, 'stap terug zet het terug');

  // 2. De meterkast weghalen.
  await tik(3.25, 3.5);
  await p.click('[data-ht="weg"]'); await p.waitForTimeout(250);
  const weg = await stand();
  zeg(!weg.Meterkast && weg.Hal.n === voor.Hal.n + voor.Meterkast.n, 'weghalen: de meterkast is weg en hoort weer bij de hal');

  // 3. Een andere bron kiezen: het huis verandert, de kamers blijven.
  await open('vorm');
  const b0 = await p.evaluate(() => ({ bron: window.tekenaar.st.bron, o: window.tekenaar.omtrek(), kamers: Object.values(window.tekenaar.vloer().ruimtes).map((r) => r.kamer).filter(Boolean).sort().join(',') }));
  await p.click('[data-ht="bron"][data-bron="osm"]'); await p.waitForTimeout(350);
  const b1 = await p.evaluate(() => ({ bron: window.tekenaar.st.bron, o: window.tekenaar.omtrek(), kamers: Object.values(window.tekenaar.vloer().ruimtes).map((r) => r.kamer).filter(Boolean).sort().join(',') }));
  zeg(b0.bron === '3d' && b1.bron === 'osm' && b1.o.y1 < b0.o.y1, `OpenStreetMap gekozen: het huis is zonder uitbouw (diep ${(b0.o.y1 - b0.o.y0) / 10} -> ${(b1.o.y1 - b1.o.y0) / 10} m)`);
  zeg(b1.kamers === 'garage,hal,woonkamer', `de kamers die nog passen blijven staan (${b1.kamers}); de keuken stond in de uitbouw`);
  if (uit) await p.screenshot({ path: `${uit}/${naam}-bron.png`, fullPage: breed < 600 });
  await p.click('#terug');
  zeg((await p.evaluate(() => window.tekenaar.st.bron)) === '3d', 'stap terug: weer de 3D-kaart');

  // 4. Het huis in 3D draaien met een vinger.
  await open('huis-kern');
  const h0 = await p.evaluate(() => window.tekenaar.st.hoek);
  const r = await p.evaluate(() => { document.getElementById('tekening').scrollIntoView({ block: 'center' }); const b = document.getElementById('tekening').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  await veegPx(r, [r[0] - 90, r[1] + 4]);
  const h1 = await p.evaluate(() => window.tekenaar.st.hoek);
  zeg((await log()) === 'pointerdown pointerup' && h1 < h0 - 20, `het huis draait mee met de vinger (${h0}° -> ${Math.round(h1)}°)`);
  await ctx.close();
}
await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
