/**
 * Een nagebootste vinger voor de paginatest (besluit 308): gebaren via
 * `Input.dispatchTouchEvent`, zoals een aanraakscherm ze stuurt, en niet met de
 * muis. Zo vond de proef bij 0.162.0 dat de browser het slepen afpakte
 * (`pointercancel`); met de muis ging het wel.
 *
 * De tekentafel (frontend/kit/huistekenen.js) staat als `window.tekenaar` op
 * de pagina; een punt in meters vanaf de linker voorhoek van het huis rekent
 * de hulp om naar het scherm met de schaal van de tekening zelf. De code voor
 * de browser staat als tekst: de tests kennen de DOM-typen niet.
 */
import type { CDPSession, Page } from 'playwright';

export type Stand = Record<string, { x0: number; y0: number; x1: number; y1: number; n: number }>;

export interface Vinger {
  /** Van punt naar punt in meters, in tien stapjes per stuk; laat los aan het eind. */
  veeg(...punten: (readonly [number, number])[]): Promise<void>;
  tik(u: number, v: number): Promise<void>;
  /** Wat de pagina sinds de vorige keer aan pointer-gebeurtenissen zag: alleen down, up en cancel. */
  log(): Promise<string>;
  /** De ruimtes op deze etage, op naam (of `vak<id>`), in ruitjes vanaf de linker voorhoek. */
  stand(): Promise<Stand>;
}

const LUISTER = `(() => {
  window.__vinger = [];
  for (const n of ['pointerdown', 'pointerup', 'pointercancel']) document.addEventListener(n, () => window.__vinger.push(n), true);
})()`;

const SCHERM = (sel: string, u: number, v: number) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  const g = el.querySelector('[data-l="vlak"] g').getAttribute('transform');
  const [, ox, oy, k] = /translate\\(([-\\d.]+) ([-\\d.]+)\\) scale\\(([-\\d.]+)/.exec(g).map(Number);
  const M = window.tekenaar.MARGE;
  return [r.left + ox + (M + ${u} * 10) * k, r.top + oy - (M + ${v} * 10) * k];
})()`;

const LOG = `(() => { const l = window.__vinger.join(' '); window.__vinger = []; return l; })()`;

const STAND = `(() => {
  const t = window.tekenaar;
  const m = t.maten();
  const uit = {};
  for (const [id, r] of Object.entries(t.vloer().ruimtes)) {
    const mm = m[id];
    uit[t.naamVan(r) ?? 'vak' + id] = { x0: mm.x0 - t.MARGE, y0: mm.y0 - t.MARGE, x1: mm.x1 - t.MARGE, y1: mm.y1 - t.MARGE, n: mm.n };
  }
  return uit;
})()`;

export async function vinger(p: Page, svg = '#tekening'): Promise<Vinger> {
  const cdp: CDPSession = await p.context().newCDPSession(p);
  await p.evaluate(LUISTER);
  const scherm = (u: number, v: number) => p.evaluate<[number, number]>(SCHERM(svg, u, v));
  const raak = (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number, y?: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x == null || y == null ? [] : [{ x, y }] });
  return {
    async veeg(...punten) {
      const s: [number, number][] = [];
      for (const [u, v] of punten) s.push(await scherm(u, v));
      await raak('touchStart', ...s[0]!);
      for (let i = 1; i < s.length; i++) {
        const [ax, ay] = s[i - 1]!;
        const [bx, by] = s[i]!;
        for (let j = 1; j <= 10; j++) {
          await raak('touchMove', ax + ((bx - ax) * j) / 10, ay + ((by - ay) * j) / 10);
          await p.waitForTimeout(16);
        }
      }
      await raak('touchEnd');
      await p.waitForTimeout(250);
    },
    async tik(u, v) {
      const [x, y] = await scherm(u, v);
      await raak('touchStart', x, y);
      await raak('touchEnd');
      await p.waitForTimeout(250);
    },
    log: () => p.evaluate<string>(LOG),
    stand: () => p.evaluate<Stand>(STAND),
  };
}
