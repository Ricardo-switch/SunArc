/*
 * De stappen van Klaarzetten (besluit 246, schets Wand-Klaarzetten): dezelfde
 * rij op de pagina Klaarzetten, bij Functies en op de tegel Inrichten. Een stap
 * vinkt zichzelf af zodra SunArc hem ziet en heeft hooguit één knop: een
 * pagina in Home Assistant, een pagina in de app, of de spraakassistent maken.
 */
'use strict';

(function (global) {
  const { esc, haal, deur } = global.app;

  /** Wat telt: klaar en open. Kan erbij en niet te zien tellen niet mee. */
  const open = (f) => f.stappen.filter((s) => s.stand === 'open');

  /** Een ring met hoe ver een functie is; helemaal klaar is een vinkje. */
  function ring(f) {
    // Niets dat telt: een lege ring, geen vinkje.
    const deel = f.van ? f.klaar / f.van : 0;
    const r = 14;
    const o = 2 * Math.PI * r;
    if (deel >= 1) return '<svg class="kz-ring" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="14" fill="rgba(110,231,183,0.14)"/><path d="M11 17.5l4 4 8-9" fill="none" stroke="var(--mint)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const boog = f.van ? `<circle cx="17" cy="17" r="${r}" fill="none" stroke="var(--zon)" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="${(o * Math.max(0.04, deel)).toFixed(1)} ${o.toFixed(1)}" transform="rotate(-90 17 17)"/>` : '';
    return `<svg class="kz-ring" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="${r}" fill="none" stroke="rgb(var(--wit) / 0.12)" stroke-width="3.5"/>${boog}</svg>`;
  }

  /** De knop van een stap: alleen bij wat nog open is of niet te zien. */
  function knop(s) {
    if (s.stand === 'klaar') return `<span class="kz-doe klaar">${esc(t('kz.klaar'))}</span>`;
    if (s.doe === 'spraakassistent') return `<button type="button" class="kz-doe zelf" data-kz-doe="${esc(s.doe)}">${esc(t('kz.zetKlaar'))}</button>`;
    if (s.app) return `<a class="kz-doe ha" href="${esc(s.app)}">${esc(t('kz.open'))}</a>`;
    if (s.ha) return global.app.inHA() ? `<button type="button" class="kz-doe ha naar" data-ha-pad="${esc(s.ha)}">${esc(t('kz.inHA'))}</button>` : `<span class="kz-doe mini">${esc(t('kz.inHA'))}</span>`;
    return '';
  }

  /** Eén stap: een nummer (of vinkje), wat het is, en zijn knop. De eerste open stap is aan de beurt. */
  function stap(s, i, nu) {
    const teken = s.stand === 'klaar' ? '✓' : s.stand === 'onbekend' ? '?' : s.stand === 'kan' ? '·' : String(i + 1);
    return `<li class="${s.stand}${nu ? ' nu' : ''}"><i aria-hidden="true">${teken}</i><b>${esc(s.titel)}</b><span>${esc(s.zin)}</span>${knop(s)}</li>`;
  }

  function lijst(stappen) {
    const eerste = stappen.findIndex((s) => s.stand === 'open');
    return `<ol class="kz-rij">${stappen.map((s, i) => stap(s, i, i === eerste)).join('')}</ol>`;
  }

  /** Bij Functies: wat nog open is van een functie, met een weg naar alles. */
  function nog(f, kop) {
    const o = open(f);
    if (!o.length) return '';
    return `<div class="kz-nog"><header><span>${esc(kop ?? f.zin)}</span><a href="klaarzetten.html#${esc(f.id)}">${esc(t('kz.alles'))}</a></header>${lijst(o)}</div>`;
  }

  /** De spraakassistent maken (besluit 203); daarna opnieuw kijken. */
  async function doe(knopje, klaar) {
    if (knopje.dataset.kzDoe !== 'spraakassistent') return;
    knopje.disabled = true;
    const res = await deur('api/stem-in-huis', { maak: true }).catch(() => null);
    // Niet gelukt: de knop zegt waarom, en de stap blijft open.
    if (!res?.ok) {
      knopje.textContent = res?.status === 403 ? t('groep.beheerder') : t('groep.nietBewaard');
      return;
    }
    // Het maken loopt even: na een paar tellen opnieuw lezen.
    setTimeout(klaar, 4000);
  }

  /** Klikken op een stap: Home Assistant openen, of SunArc iets laten doen. */
  function klik(e, klaar) {
    const ha = e.target.closest('[data-ha-pad]');
    const zelf = e.target.closest('[data-kz-doe]');
    if (ha && ha.closest('.kz-rij')) {
      global.app.naarHAScherm(ha.dataset.haPad);
      return true;
    }
    if (zelf) {
      void doe(zelf, klaar);
      return true;
    }
    return false;
  }

  const laad = () => haal('api/klaarzetten');

  global.klaarstappen = { open, ring, lijst, nog, klik, laad };
})(window);
