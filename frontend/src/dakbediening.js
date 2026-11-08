/*
 * De bediening van de tekening van boven (besluit 254, stap 2b; besluit 288):
 * blokken slepen en draaien, de kaart ophalen met de melding ervoor, en een
 * kaart kiezen. Eerst stond dit alleen in energie.js; Je huis › Huisontwerp
 * gebruikt het hier. Een pagina geeft mee waar de daken staan, hoe ze bewaard
 * worden, en hoe ze opnieuw tekent.
 *
 *   const b = dakbediening.maak({ daken: () => d, staat, bewaar: (w) => …, teken });
 *   if (await b.klik(knop)) return;   // in de klik van de pagina
 */
'use strict';

const dakbediening = (() => {
  function maak({ daken, staat, bewaar, teken }) {
    /* ------------------------------------------------ het venster */
    let venster = null;
    const toets = (e) => e.key === 'Escape' && sluit();
    function sluit() {
      venster?.remove();
      venster = null;
      removeEventListener('keydown', toets);
    }
    function open(html) {
      sluit();
      venster = document.createElement('div');
      venster.className = 'kk-scherm';
      venster.innerHTML = html;
      venster.addEventListener('click', async (e) => {
        const el = e.target.closest('[data-kk-dicht], [data-kk-kaart], [data-kk-zonder]');
        if (!el) return;
        sluit();
        if (el.hasAttribute('data-kk-kaart')) await haalDeKaart();
        else if (el.hasAttribute('data-kk-zonder') && daken()) bewaar(dakvlakken.zonderKaart(daken()));
      });
      document.body.append(venster);
      addEventListener('keydown', toets);
      venster.querySelector('[data-kk-kaart], [data-kk-zonder]')?.focus();
    }

    /* ------------------------------------------------ de kaart */
    /** Beide kaarten vragen en bewaren wat ze zeiden; tikte de bewoner al een kaart aan, dan die meteen. */
    async function haalDeKaart() {
      staat.kaart = 'bezig';
      teken();
      const stand = await dakvlakken.kijk(staat);
      const keuze = staat.naKijken;
      staat.naKijken = null;
      teken();
      const d = daken();
      if (!stand || !d) return;
      const w = keuze ? dakvlakken.vanKaart(d, staat, keuze) : null;
      bewaar({ ...(w ?? { vlakken: d.vlakken.map(dakvlakken.kaal) }), kaartStand: stand });
    }
    /** Een kaart kiezen: met wat er net gevonden is, anders eerst kijken (met de melding). */
    function kiesKaart(bron) {
      const w = dakvlakken.vanKaart(daken(), staat, bron);
      if (w) return bewaar(w);
      staat.naKijken = bron;
      open(dakvlakken.kaartVenster());
    }

    /* ------------------------------------------------ slepen en draaien */
    let sleep = null;
    /** Na slepen geen tik: anders opent het loslaten iets anders. */
    let sleepTik = false;
    document.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('[data-dak-sleep], [data-dak-draaigreep]');
      if (!el || !daken()) return;
      const svg = el.closest('svg');
      const groep = svg?.querySelector('.dk-gebouw[data-dak-sleep]');
      const m = svg?.getScreenCTM()?.inverse();
      if (!groep || !m) return;
      const pt = (ev) => {
        const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m);
        return [p.x, p.y];
      };
      const id = groep.dataset.dakSleep;
      sleep = { id, draai: el.hasAttribute('data-dak-draaigreep'), van: pt(e), pt, c: [Number(groep.dataset.cx), Number(groep.dataset.cy)], delen: [...svg.querySelectorAll(`[data-dak-van="${CSS.escape(id)}"]`)], dx: 0, dy: 0, graden: 0 };
      groep.classList.add('sleept');
      el.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    document.addEventListener('pointermove', (e) => {
      if (!sleep) return;
      const p = sleep.pt(e);
      if (sleep.draai) {
        const hoek = (q) => (Math.atan2(q[1] - sleep.c[1], q[0] - sleep.c[0]) * 180) / Math.PI;
        sleep.graden = Math.round(hoek(p) - hoek(sleep.van));
      } else {
        sleep.dx = p[0] - sleep.van[0];
        sleep.dy = p[1] - sleep.van[1];
      }
      // In de tekening is y naar beneden: draaien met de klok mee is hier gewoon rotate.
      const zet = sleep.draai ? `rotate(${sleep.graden} ${sleep.c[0]} ${sleep.c[1]})` : `translate(${sleep.dx.toFixed(2)} ${sleep.dy.toFixed(2)})`;
      for (const el of sleep.delen) {
        el.dataset.vast ??= el.getAttribute('transform') ?? '';
        el.setAttribute('transform', `${zet} ${el.dataset.vast}`);
      }
    });
    function sleepKlaar() {
      if (!sleep) return;
      const { id, dx, dy, graden, delen } = sleep;
      sleep = null;
      const zet = { dx: Math.round(dx * 100) / 100, dy: Math.round(-dy * 100) / 100, graden: ((graden % 360) + 360) % 360 };
      if (Math.hypot(zet.dx, zet.dy) < 0.15 && !zet.graden) {
        for (const el of delen) if (el.dataset.vast != null) el.setAttribute('transform', el.dataset.vast);
        document.querySelector('.dk-gebouw.sleept')?.classList.remove('sleept');
        return;
      }
      sleepTik = true;
      setTimeout(() => (sleepTik = false), 0);
      const w = dakvlakken.verplaats(daken(), id, zet);
      if (w) bewaar(w);
      else teken();
    }
    document.addEventListener('pointerup', sleepKlaar);
    document.addEventListener('pointercancel', () => {
      if (!sleep) return;
      sleep = null;
      teken();
    });
    document.addEventListener(
      'click',
      (e) => {
        if (!sleepTik) return;
        sleepTik = false;
        e.stopPropagation();
        e.preventDefault();
      },
      true,
    );

    /* ------------------------------------------------ een tik */
    /** Een tik op iets van de tekening of het blad: waar als het hier is afgehandeld. */
    async function klik(knop) {
      if (!knop || !daken()) return false;
      if (knop.hasAttribute('data-dak-kaart')) return open(dakvlakken.kaartVenster()), true;
      if (knop.hasAttribute('data-dak-zonderkaart')) return open(dakvlakken.zonderVenster()), true;
      if (knop.hasAttribute('data-dak-plekha')) return void app.naarHAScherm('/config/general'), true;
      if (!Object.keys(knop.dataset).some((k) => k.startsWith('dak'))) return false;
      const wat = dakvlakken.klik(knop, daken(), staat);
      if (wat === 'teken') teken();
      else if (wat?.kaart) await haalDeKaart();
      else if (wat?.bron) kiesKaart(wat.bron);
      else if (wat && !wat.geen) bewaar(wat);
      return true;
    }
    /** Een keuze in een lijst of veld van het blad. */
    function verander(el) {
      const wat = dakvlakken.verander(el, staat, daken());
      if (wat === 'teken') teken();
      else if (wat && !wat.geen) bewaar(wat);
      return !!wat;
    }
    return { klik, verander, open, sluit };
  }
  return { maak };
})();
