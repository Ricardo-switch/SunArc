/*
 * De hoofdzekering (stap 4, keuze Ricardo 19 november 2026: eerst de soort,
 * dan de rest). Eerst 1 fase of 3 fasen (of Weet ik niet), dan de ampère als
 * knoppen, met Anders voor een eigen waarde (32 A is in België gewoon). Dezelfde
 * vraag bij Energie › Aansluiting en bij Inrichten › Aanpassen; elke pagina
 * bewaart zelf.
 *
 * `vorm(z)` geeft de knoppen; `klik(el, z)` en `verander(el, z)` geven de
 * nieuwe zekering ({ fasen, ampere } of 'weetniet'), 'teken' als alleen het
 * beeld verandert, of undefined als het niet over de zekering ging.
 */
'use strict';

const zekering = (() => {
  const esc = (s) => window.app.esc(s);
  const t = (k, p) => window.taal.t(k, p);
  const AMPERES = [16, 20, 25, 32, 35, 40, 50, 63];
  /** Of de bewoner een eigen waarde aan het invullen is (Anders). */
  let zelf = false;
  const knop = (attr, tekst, aan) => `<button type="button" ${attr} aria-pressed="${aan}">${esc(tekst)}</button>`;
  const echt = (z) => (z && z !== 'weetniet' ? z : null);

  function vorm(z) {
    const zek = echt(z);
    const fasen = `<div class="keuzes zk-rij" role="group" aria-label="${esc(t('energie.fasen'))}">${knop('data-zk-fasen="1"', t('energie.eenFase'), zek?.fasen === 1)}${knop('data-zk-fasen="3"', t('energie.drieFasen'), zek?.fasen === 3)}${knop('data-zk-weetniet', t('energie.weetNiet'), z === 'weetniet')}</div>`;
    if (z === 'weetniet') return `${fasen}<p class="mini">${esc(t('inr.zekWeetNiet'))}</p>`;
    if (!zek) return `${fasen}<p class="mini">${esc(t('zk.eerstFasen'))}</p>`;
    const lijst = zek.ampere != null && !AMPERES.includes(zek.ampere) ? [...AMPERES, zek.ampere].sort((a, b) => a - b) : AMPERES;
    const amp = `<div class="zk-kop">${esc(t('zk.ampere'))}</div><div class="keuzes zk-rij" role="group" aria-label="${esc(t('inr.zekAmpere'))}">${lijst.map((x) => knop(`data-zk-ampere="${x}"`, `${x} A`, !zelf && zek.ampere === x)).join('')}${knop('data-zk-anders', t('energie.anders'), zelf)}</div>`;
    const eigen = zelf ? `<label class="veldnaam zk-eigen">${esc(t('inr.zekAmpere'))}<input class="invoer" type="number" inputmode="numeric" min="6" max="250" step="1" data-zk-zelf value="${zek.ampere ?? ''}"></label>` : '';
    return fasen + amp + eigen;
  }

  function klik(el, z) {
    const k = el.closest?.('[data-zk-fasen], [data-zk-weetniet], [data-zk-ampere], [data-zk-anders]');
    if (!k) return undefined;
    const zek = echt(z);
    if (k.hasAttribute('data-zk-weetniet')) {
      zelf = false;
      return 'weetniet';
    }
    if (k.dataset.zkFasen) {
      const fasen = Number(k.dataset.zkFasen);
      return { fasen, ampere: zek?.ampere ?? (fasen === 1 ? 35 : 25) };
    }
    if (k.hasAttribute('data-zk-anders')) {
      zelf = true;
      return 'teken';
    }
    if (k.dataset.zkAmpere && zek) {
      zelf = false;
      return { ...zek, ampere: Number(k.dataset.zkAmpere) };
    }
    return undefined;
  }

  function verander(el, z) {
    if (!el.matches?.('[data-zk-zelf]')) return undefined;
    const zek = echt(z);
    const ampere = Number(el.value);
    if (!zek || !Number.isInteger(ampere) || ampere < 6 || ampere > 250) return undefined;
    zelf = false;
    return { ...zek, ampere };
  }

  return { vorm, klik, verander };
})();
window.zekering = zekering;
