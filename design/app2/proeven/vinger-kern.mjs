// Proef: de open begane grond met een kern natekenen met een nagebootste vinger, vanaf een lege etage.
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
  await p.goto(`${basis}/${bestand}#open`);
  await p.waitForTimeout(900);
  const cdp = await ctx.newCDPSession(p);
  let stappen = 0;
  // Een punt in meters vanaf de linker voorhoek naar het scherm; de tekening eerst in beeld.
  const scherm = async (u, v) => {
    await p.evaluate(() => document.getElementById('tekening').scrollIntoView({ block: 'center' }));
    return p.evaluate(([u, v]) => {
      const t = window.tekenaar; const r = document.getElementById('tekening').getBoundingClientRect();
      const g = document.querySelector('#tekening [data-l="vlak"] g').getAttribute('transform');
      const [, ox, oy, k] = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)/.exec(g).map(Number);
      return [r.left + ox + (t.MARGE + u * 10) * k, r.top + oy - (t.MARGE + v * 10) * k];
    }, [u, v]);
  };
  const veeg = async (a, b) => {
    stappen++;
    const van = await scherm(...a); const naar = await scherm(...b);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: van[0], y: van[1] }] });
    for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: van[0] + ((naar[0] - van[0]) * i) / 10, y: van[1] + ((naar[1] - van[1]) * i) / 10 }] }); await p.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(300);
  };
  const tik = async (u, v) => { stappen++; const [x, y] = await scherm(u, v); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(300); };
  const kies = async (sel) => { stappen++; await p.click(sel); await p.waitForTimeout(200); };
  const stand = () => p.evaluate(() => { const t = window.tekenaar; const v = t.vloer(); const m = t.maten(); const o = {}; for (const [id, r] of Object.entries(v.ruimtes)) o[t.naamVan(r) ?? `vak${id}`] = { x0: m[id].x0 - t.MARGE, y0: m[id].y0 - t.MARGE, x1: m[id].x1 - t.MARGE, y1: m[id].y1 - t.MARGE, n: m[id].n }; return { o, zone: v.zones.woonkamer ? { as: v.zones.woonkamer.as, op: v.zones.woonkamer.op - t.MARGE } : null }; });

  // 1. De hele etage is de woonkamer.
  await tik(2, 6);
  await kies('[data-ht="noem"][data-kamer="woonkamer"]');
  // 2. De hal: een vak van de voorgevel naar achter. De vinger begint en eindigt er slordig naast.
  await veeg([2.93, 0.12], [4.83, 3.96]);
  await kies('[data-ht="noem"][data-kamer="hal"]');
  // 3. Het toilet, tegen de hal aan.
  await veeg([4.9, 1.43], [6.04, 3.9]);
  await kies('[data-ht="noem"][data-naam="Toilet"]');
  // 4. De trap ervoor.
  await veeg([4.9, 0.1], [5.9, 1.3]);
  await kies('[data-ht="noem"][data-naam="Trap"]');
  // 5. De meterkast in de hoek van de hal.
  await veeg([3.0, 3.9], [3.62, 3.04]);
  await kies('[data-ht="noem"][data-naam="Meterkast"]');
  // 6. De zones: de lijn aanzetten in de woonkamer en naar 4 meter slepen.
  await tik(8, 6);
  await kies('[data-ht="zone"][data-wat="zet"]');
  const z0 = (await stand()).zone;
  await veeg([z0.op / 10, 6], [4.03, 6.1]);
  const s = await stand();
  const is = (r, x0, y0, x1, y1) => !!r && r.x0 === x0 && r.y0 === y0 && r.x1 === x1 && r.y1 === y1;
  zeg(is(s.o.Hal, 29, 0, 48, 40), `hal 1,9 bij 4,0 m in het midden aan de voorkant (${JSON.stringify(s.o.Hal)})`);
  zeg(is(s.o.Toilet, 48, 14, 60, 40), `toilet 1,2 bij 2,6 m naast de hal (${JSON.stringify(s.o.Toilet)})`);
  zeg(is(s.o.Trap, 48, 0, 60, 14), `trap 1,2 bij 1,4 m ervoor (${JSON.stringify(s.o.Trap)})`);
  zeg(is(s.o.Meterkast, 29, 30, 36, 40), `meterkast 0,7 bij 1,0 m in de hoek van de hal (${JSON.stringify(s.o.Meterkast)})`);
  zeg(!!s.o.Woonkamer && s.o.Woonkamer.n === 7600 - 31 * 40, 'de woonkamer is alles eromheen, als één ruimte');
  zeg(s.zone?.as === 'x' && s.zone.op === 40, `de zonelijn staat op 4,0 m (${JSON.stringify(s.zone)})`);
  zeg(Object.keys(s.o).length === 5, `vijf ruimtes, geen losse stukken (${Object.keys(s.o).join(', ')})`);
  console.log(`      ${stappen} handelingen`);
  await p.evaluate(() => window.tekenaar.kies(null));
  await p.waitForTimeout(900);
  if (uit) await p.screenshot({ path: `${uit}/${naam}-kern.png`, fullPage: breed < 600 });
  await ctx.close();
}
await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
