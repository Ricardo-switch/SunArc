/*
 * Deel van inrichten.js (opgesplitst op 22 november 2026): energie. Een gewoon script dat na
 * inrichten-klimaat.js laadt en zijn bovenste namen deelt met de andere delen van de pagina.
 */
'use strict';
/* global antwoorden, d, deur, energieNu, esc, haal, regel, teken */
/* exported assistentBlok, assistentNogAan, contractNu, naarRondleiding, zetAssistentAan */
/** Het soort contract (stap 4): dezelfde rij als bij Energie › Contract en prijzen (contract.js). */
function contractNu() {
  const p = energieNu()?.prijzen ?? {};
  return contract.van(antwoorden().tarief, p.stroomDal != null) ?? (p.stroom != null ? 'enkel' : null);
}

/*
 * De assistent met één knop (besluit 202, schets Wand-Inrichten-Klaarzetten
 * #assistent en #bezig): de add-on zet de integratie neer, herstart Home
 * Assistant en voegt hem toe. Alleen voor de beheerder, en alleen in de add-on.
 */
const AAN_STAPPEN = ['neerzetten', 'herstarten', 'toevoegen'];
let aanKijk = null;
function assistentBlok() {
  const i = d.integ;
  if (!i) return '';
  if (i.toegevoegd === true && !i.oudeKoppeling && !i.aanzetten?.bezig) return regel({ ik: 'praat', titel: t('inr.as.aan'), zin: t('inr.as.aanZin'), rechts: '✓', toon: 'mint' });
  const a = i.aanzetten;
  if (!a) return '';
  // Loopt het, dan elke drie tellen kijken waar het is; ook als de pagina tijdens het herstarten opnieuw laadde.
  if (a.bezig && !aanKijk) {
    aanKijk = setTimeout(async () => {
      aanKijk = null;
      d.integ = await haal('api/integratie').catch(() => d.integ);
      if (!d.integ?.aanzetten?.bezig) d.klaar = await haal('api/klaarzetten').catch(() => d.klaar);
      teken();
    }, 3000);
  }
  const nog = a.stap === 'herstarten' && a.herstartMs ? Math.max(5, 60 - Math.round((Date.now() - a.herstartMs) / 1000)) : null;
  const lijst = i.oudeKoppeling || a.stap === 'oudeWeg' || a.klaar.includes('oudeWeg') ? [...AAN_STAPPEN, 'oudeWeg'] : AAN_STAPPEN;
  const stappen = lijst.map((s, n) => {
    const klaar = a.klaar.includes(s);
    const nu = a.bezig && a.stap === s;
    return `<li><span class="nr${klaar ? ' klaar' : nu ? ' bezig' : ''}">${klaar ? '✓' : nu ? '' : n + 1}</span><span>${esc(t(`inr.as.s.${s}`))}</span><small>${nu && nog != null ? esc(t('inr.as.nog', { n: nog })) : ''}</small></li>`;
  }).join('');
  // Zonder fout gaat hij vanzelf aan bij Klaar, terwijl de film speelt; alleen na een fout een knop.
  const zin = a.bezig ? t(a.stap === 'herstarten' ? 'inr.as.bezigZin' : 'inr.as.even') : a.fout ? t('inr.as.fout', { fout: a.fout }) : t('inr.as.bijKlaar');
  const knop = a.bezig || !a.fout ? '' : `<button type="button" class="knop knop-licht" data-assistent-aan>${esc(t('inr.as.opnieuw'))}</button>`;
  return `<div class="asblok" aria-live="polite"><div class="askop"><span class="bol" aria-hidden="true"></span><div><b>${esc(t('w.praatMetJeHuis'))}</b><span${a.fout && !a.bezig ? ' class="fout"' : ''}>${esc(zin)}</span></div></div><ol class="accstappen asstappen">${stappen}</ol>${knop}</div>`;
}
/** Of de assistent nog aan moet (besluit 202): in de add-on, niet via HACS, nog niet toegevoegd en niet al bezig. */
function assistentNogAan() {
  const i = d.integ;
  return !!(i?.aanzetten && !i.aanzetten.bezig && i.staat !== 'anders' && (i.toegevoegd !== true || i.oudeKoppeling === true));
}
async function zetAssistentAan() {
  const res = await deur('api/integratie', { aanzetten: true }).catch(() => null);
  if (res?.ok) d.integ = await res.json().catch(() => d.integ);
}
/*
 * Naar de rondleiding op Thuis. Herstart Home Assistant nog (besluit 202), dan
 * eerst wachten met de voortgang in beeld: Thuis openen kan pas als hij terug
 * is. Na zeven minuten gaat hij toch; de dienst geeft het eerder op.
 */
async function naarRondleiding() {
  const tot = Date.now() + 7 * 60_000;
  let wacht = null;
  while (d.integ?.aanzetten?.bezig && Date.now() < tot) {
    if (!wacht) {
      wacht = document.createElement('div');
      wacht.className = 'aswacht';
      document.body.append(wacht);
    }
    wacht.innerHTML = `<div>${assistentBlok()}<p>${esc(t('inr.as.wacht'))}</p></div>`;
    await new Promise((klaar) => setTimeout(klaar, 3000));
    d.integ = await haal('api/integratie').catch(() => d.integ);
  }
  location.href = 'thuis.html#rondleiding';
}
