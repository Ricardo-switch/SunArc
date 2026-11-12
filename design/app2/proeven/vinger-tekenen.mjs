// Proef: de nieuwe schets met een nagebootste vinger, dezelfde gebaren als bij 0.162.0.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../backend/package.json', import.meta.url));
const { chromium } = require('playwright');

const basis = process.argv[2] ?? 'http://localhost:4173/design/app2';
const uit = process.argv[3];
const browser = await chromium.launch({ channel: 'msedge' });
let fouten = 0;
const zeg = (goed, tekst) => { if (!goed) fouten++; console.log(`${goed ? 'goed' : 'FOUT'}  ${tekst}`); };

async function pagina(bestand, breed, hoog) {
  const ctx = await browser.newContext({ viewport: { width: breed, height: hoog }, hasTouch: true, isMobile: breed < 600, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => zeg(false, `fout in de pagina: ${e.message}`));
  await p.goto(`${basis}/${bestand}`);
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    window.__log = [];
    for (const n of ['pointerdown', 'pointerup', 'pointercancel']) document.addEventListener(n, () => window.__log.push(n), true);
  });
  return { p, cdp: await ctx.newCDPSession(p), ctx };
}
async function veeg(cdp, p, punten, stappen = 10) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: punten[0][0], y: punten[0][1] }] });
  for (let s = 1; s < punten.length; s++) {
    for (let i = 1; i <= stappen; i++) {
      const x = punten[s - 1][0] + ((punten[s][0] - punten[s - 1][0]) * i) / stappen;
      const y = punten[s - 1][1] + ((punten[s][1] - punten[s - 1][1]) * i) / stappen;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
      await p.waitForTimeout(18);
    }
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(400);
}
const tik = (cdp, p, x, y) => veeg(cdp, p, [[x, y]], 0);
const log = (p) => p.evaluate(() => { const l = window.__log.join(' '); window.__log = []; return l; });
// Van ruitjes naar het scherm, en de stand van het huis.
const stand = (p) => p.evaluate(() => {
  const t = window.tekenaar; const v = t.vloer(); const m = t.maten();
  const svg = document.getElementById('tekening').getBoundingClientRect();
  const kamers = {};
  for (const [id, r] of Object.entries(v.ruimtes)) kamers[t.naamVan(r) ?? `vak${id}`] = { id: Number(id), n: m[id].n, x0: m[id].x0, y0: m[id].y0, x1: m[id].x1, y1: m[id].y1 };
  return { kamers, svg: [svg.left, svg.top, svg.width, svg.height], aantal: Object.keys(v.ruimtes).length, kies: t.st.kies, apparaten: t.st.apparaten.map((a) => ({ id: a.id, kamer: a.kamer, plek: a.plek ?? null })) };
});
// Een punt in ruitjes naar het scherm: via de tekenaar zelf (plekOp is het omgekeerde, dus zoeken we het met de maten).
const scherm = (p, x, y) => p.evaluate(([x, y]) => {
  document.getElementById("tekening").scrollIntoView({ block: "center" });
  const t = window.tekenaar; const r = document.getElementById('tekening').getBoundingClientRect();
  // Twee bekende punten geven de schaal: gebruik plekOp op de hoeken van de tekening.
  const a = t.plekOp(r.left + 1, r.top + 1), b = null;
  const g = document.querySelector('#tekening [data-l="vlak"] g').getAttribute('transform');
  const [, ox, oy, k] = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)/.exec(g).map(Number);
  return [r.left + ox + x * k, r.top + oy - y * k];
}, [x, y]);

for (const [naam, bestand, breed, hoog] of [['WAND', 'Wand-Huis-Tekenen.html', 1280, 800], ['TELEFOON', 'Tel-Huis-Tekenen.html', 390, 844]]) {
  console.log(`\n== ${naam} ==`);
  // 1. Een muur schuiven met een vinger: alleen de twee ruimtes ernaast veranderen.
  {
    const { p, cdp, ctx } = await pagina(`${bestand}#kamers`, breed, hoog);
    const voor = await stand(p);
    const hal = voor.kamers.Hal;
    const [x, y] = await scherm(p, hal.x1, (hal.y0 + hal.y1) / 2);
    const [x2] = await scherm(p, hal.x1 + 12, 0);
    await veeg(cdp, p, [[x, y], [x2, y + 3]]);
    const na = await stand(p);
    const l = await log(p);
    zeg(l === 'pointerdown pointerup', `muur slepen: de vinger blijft bij de tekening (${l})`);
    zeg(na.kamers.Hal.x1 === hal.x1 + 12, `de muur staat 1,2 m verder (hal ${hal.x1 - hal.x0} -> ${na.kamers.Hal.x1 - na.kamers.Hal.x0} ruitjes breed)`);
    zeg(na.kamers.Woonkamer.x0 === voor.kamers.Woonkamer.x0 + 12 && na.kamers.Woonkamer.x1 === voor.kamers.Woonkamer.x1, 'de woonkamer werd evenveel smaller, haar andere muur bleef staan');
    zeg(na.kamers.Garage.n === voor.kamers.Garage.n && na.kamers.Keuken.n === voor.kamers.Keuken.n, 'garage en keuken zijn niet veranderd');
    zeg(na.kies?.soort === 'muur', 'de muur blijft gekozen, met de maat in het blad');
    // Terug.
    await p.click('#terug');
    const terug = await stand(p);
    zeg(terug.kamers.Hal.x1 === hal.x1, 'stap terug zet de muur terug');
    if (uit) await p.screenshot({ path: `${uit}/${naam}-muur.png` });
    await ctx.close();
  }
  // 2. Een vak trekken met een vinger: een nieuwe ruimte, de rest blijft de woonkamer.
  {
    const { p, cdp, ctx } = await pagina(`${bestand}#kamers`, breed, hoog);
    const voor = await stand(p);
    const w = voor.kamers.Woonkamer;
    // Begin slordig bij de hoek rechtsvoor, eindig slordig 2,1 bij 1,6 m verder.
    const a = await scherm(p, w.x1 - 1.4, w.y0 + 1.2);
    const b = await scherm(p, w.x1 - 21.3, w.y0 + 16.4);
    await veeg(cdp, p, [a, b]);
    const na = await stand(p);
    const l = await log(p);
    const nieuw = Object.entries(na.kamers).find(([n]) => n.startsWith('vak'));
    zeg(l === 'pointerdown pointerup', `vak trekken: de vinger blijft bij de tekening (${l})`);
    zeg(!!nieuw && nieuw[1].x1 === w.x1 && nieuw[1].y0 === w.y0, 'het vak klikte vast in de hoek, ook al begon de vinger ernaast');
    zeg(!!nieuw && nieuw[1].x1 - nieuw[1].x0 === 21 && nieuw[1].y1 - nieuw[1].y0 === 16, `het vak is 2,1 bij 1,6 m (${nieuw ? `${nieuw[1].x1 - nieuw[1].x0}x${nieuw[1].y1 - nieuw[1].y0}` : '-'})`);
    zeg(na.kamers.Woonkamer.n === w.n - 21 * 16, 'de rest blijft de woonkamer, om het vak heen');
    zeg(na.kies?.soort === 'ruimte' && na.kies.id === nieuw?.[1].id, 'het nieuwe vak is gekozen: wat is dit?');
    // Zeg wat het is: Toilet.
    await p.click('[data-ht="noem"][data-naam="Toilet"]');
    const genoemd = await stand(p);
    zeg(!!genoemd.kamers.Toilet, 'een tik maakt er het toilet van');
    if (uit) await p.screenshot({ path: `${uit}/${naam}-vak.png` });
    // De muur van het toilet schuiven: de woonkamer geeft mee, er komt geen gat.
    const tt = genoemd.kamers.Toilet;
    const m1 = await scherm(p, (tt.x0 + tt.x1) / 2, tt.y1);
    const m2 = await scherm(p, (tt.x0 + tt.x1) / 2, tt.y1 + 6);
    await veeg(cdp, p, [m1, m2]);
    const groter = await stand(p);
    zeg(groter.kamers.Toilet.y1 === tt.y1 + 6 && groter.kamers.Toilet.n + groter.kamers.Woonkamer.n === genoemd.kamers.Toilet.n + genoemd.kamers.Woonkamer.n, 'de muur van het toilet schuift 60 cm; samen blijven ze even groot');
    await ctx.close();
  }
  // 3. Een apparaat verzetten met een vinger, en er een uit de strook slepen.
  {
    const { p, cdp, ctx } = await pagina(`${bestand}#apparaten`, breed, hoog);
    const voor = await stand(p);
    const punten = await p.evaluate(() => window.tekenaar.apparaatPunten().map((q) => ({ id: q.a.id, x: q.x, y: q.y })));
    const lamp = punten.find((q) => q.id === 'plafond');
    const w = voor.kamers.Woonkamer;
    const a = await scherm(p, lamp.x, lamp.y);
    const b = await scherm(p, w.x1 - 3, w.y1 - 30);
    await veeg(cdp, p, [a, [b[0], b[1] + 30]]);
    const na = await stand(p);
    const l = await log(p);
    const plek = na.apparaten.find((x) => x.id === 'plafond').plek;
    zeg(l === 'pointerdown pointerup', `apparaat slepen: de vinger blijft bij de tekening (${l})`);
    zeg(!!plek && Math.abs(plek.x - (w.x1 - 2)) < 0.01, `de lamp klikte vast aan de rechtermuur (${plek ? `${(w.x1 - plek.x).toFixed(1)} ruitjes van de muur` : 'geen plek'})`);
    zeg(na.kies?.soort === 'apparaat', 'er springt niets open: de lamp is alleen gekozen');
    // Naar een andere kamer: loslaten bovenop een ander apparaat mag gewoon.
    const meter = punten.find((q) => q.id === 'meter-keuken');
    const van = await scherm(p, punten.find((q) => q.id === 'sfeer').x, punten.find((q) => q.id === 'sfeer').y);
    const naar = await scherm(p, meter.x, meter.y);
    await veeg(cdp, p, [van, [naar[0], naar[1] + 30]]);
    const na2 = await stand(p);
    zeg(na2.apparaten.find((x) => x.id === 'sfeer').kamer === 'keuken', 'de sfeerlamp losgelaten bovenop de meter in de keuken: staat nu in de keuken');
    // Uit de strook.
    const chip = await p.evaluate(() => { const r = document.querySelector('[data-los="koffie"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await p.evaluate(() => document.querySelector('[data-los="koffie"]').scrollIntoView({ block: 'center' }));
    const k = (await stand(p)).kamers.Keuken;
    const doel = await scherm(p, (k.x0 + k.x1) / 2, (k.y0 + k.y1) / 2);
    const chip2 = await p.evaluate(() => { const r = document.querySelector('[data-los="koffie"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await veeg(cdp, p, [chip2, [doel[0], doel[1] + 46]], 14);
    const na3 = await stand(p);
    zeg(na3.apparaten.find((x) => x.id === 'koffie').kamer === 'keuken', `de stekker uit de strook naar de keuken gesleept (${await log(p)})`);
    // De andere: tikken, dan de kamer tikken.
    const chip3 = await p.evaluate(() => { const r = document.querySelector('[data-los="staand"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await tik(cdp, p, chip3[0], chip3[1]);
    await p.evaluate(() => document.getElementById('tekening').scrollIntoView({ block: 'center' }));
    const w2 = (await stand(p)).kamers.Woonkamer;
    const midden = await scherm(p, (w2.x0 + w2.x1) / 2, (w2.y0 + w2.y1) / 2 + 12);
    await tik(cdp, p, midden[0], midden[1]);
    const na4 = await stand(p);
    zeg(na4.apparaten.find((x) => x.id === 'staand').kamer === 'woonkamer', 'de staande lamp: tik in de strook, tik in de woonkamer');
    if (uit) await p.screenshot({ path: `${uit}/${naam}-apparaten.png`, fullPage: breed < 600 });
    await ctx.close();
  }
  // 4. Hoe groot is wat je moet raken?
  {
    const { p, ctx } = await pagina(`${bestand}#kamer`, breed, hoog);
    await p.waitForTimeout(500);
    const m = await p.evaluate(() => {
      const r = document.querySelector('#tekening [data-ap] circle').getBoundingClientRect();
      const s = document.getElementById('tekening').getBoundingClientRect();
      return { icoon: Math.round(r.width), tekening: [Math.round(s.width), Math.round(s.height)], pagina: document.documentElement.scrollHeight, blad: document.getElementById('blad').scrollHeight > document.getElementById('blad').clientHeight + 1 };
    });
    console.log(`      tekening ${m.tekening.join(' x ')} px, icoon ${m.icoon} px, pagina ${m.pagina} px hoog${naam === 'WAND' ? `, blad schuift: ${m.blad}` : ''}`);
    if (naam === 'WAND') zeg(m.pagina <= 800 && !m.blad, 'de wand schuift nergens');
    if (uit) await p.screenshot({ path: `${uit}/${naam}-kamer.png`, fullPage: breed < 600 });
    await ctx.close();
  }
}
await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);
