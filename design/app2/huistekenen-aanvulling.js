/*
 * Je huis aangevuld (schets stap 3, 17 november 2026): wat nu nog alleen bij
 * Kamers en indeling kan, krijgt een plek in Je huis, zodat Kamers en indeling
 * weg kan (keuzes Ricardo: verbergen bij Apparaten, buiten bij Buiten). Deze
 * schets zet alleen het blad; de tekening is de echte tekenmotor.
 *   #etage       een etage aangetikt: naam, onder het dak, volgorde, een etage erbij
 *   #kamerblad   een kamer aangetikt: wat het is, de soort, de naam in de app,
 *                en de weg naar Verwarmen en koelen (straks het blad Klimaat)
 *   #buiten      Buiten aangetikt: wat er rond het huis is, en waar de thuisaccu staat
 *   #verbergen   een apparaat aangetikt bij Apparaten, met Verbergen
 *   #verborgen   de lijst met verborgen apparaten
 */
(function () {
  'use strict';
  const adres = location.hash.slice(1);
  const ik = (n) => (window.iconen?.svg(n) ?? '');
  const rij = (o) => `<button type="button" class="ht-rij${o.aan ? ' aan' : ''}${o.mist ? ' mist' : ''}">${o.ik ? `<span class="ik"${o.kleur ? ` style="color: ${o.kleur}"` : ''}>${ik(o.ik)}</span>` : ''}<span class="t"><b>${o.titel}</b>${o.zin ? `<small>${o.zin}</small>` : ''}</span>${o.rechts ? `<em>${o.rechts}</em>` : ''}</button>`;
  const knoppen = (lijst, aan) => `<div class="ht-twee">${lijst.map((x) => `<button type="button" class="ht-klein${x === aan ? ' aan' : ''}">${x}</button>`).join('')}</div>`;
  const schakel = (aan) => `<span class="sk${aan ? ' aan' : ''}" aria-hidden="true"></span>`;

  const BLAD = {
    etage: () => `<header><h3>Begane grond</h3><span>4 kamers</span></header>
      <h4>Naam</h4><input class="ht-naam" value="Begane grond" maxlength="30" aria-label="Naam van de etage">
      <h4>Onder het schuine dak?</h4>${knoppen(['Ja', 'Nee'], 'Nee')}
      <h4>Volgorde</h4>${knoppen(['Hoger', 'Lager'])}
      <h4>Een etage erbij</h4>
      ${rij({ ik: 'etages', titel: 'Erboven', zin: 'een nieuwe etage boven deze', rechts: '+' })}
      ${rij({ ik: 'kelder', titel: 'Een kelder', zin: 'onder de begane grond', rechts: '+' })}
      <p class="ht-voet">Een etage zonder kamers haal je weg met Weghalen; met kamers erin kan dat niet.</p>`,

    kamerblad: () => `<header><h3>Woonkamer</h3><span>7,6 × 8,4 m · 64 m²</span></header>
      <h4>Wat is dit?</h4>
      ${rij({ ik: 'woonkamer', titel: 'Woonkamer', zin: 'staat hier', aan: true, rechts: '✓' })}
      ${rij({ ik: 'keuken', titel: 'Keuken', zin: 'wisselen' })}
      <h4>Soort kamer</h4>${knoppen(['Woonkamer', 'Keuken', 'Slaapkamer', 'Kinderkamer', 'Badkamer', 'Werkkamer'], 'Woonkamer')}
      <h4>Naam in de app</h4><input class="ht-naam" value="Woonkamer" maxlength="30" aria-label="Naam in de app">
      <p class="ht-voet">In Home Assistant heet hij Living. De naam hier geldt alleen in SunArc.</p>
      <h4>Verwarmen en koelen</h4>
      ${rij({ ik: 'klimaat', kleur: 'var(--gloed)', titel: 'Klimaat in deze kamer', zin: 'Warmtepomp houdt op temperatuur, airco helpt op zon', rechts: '›' })}
      <div class="ht-onder">${rij({ ik: 'kruis', kleur: 'var(--gloed)', titel: 'Weghalen', zin: 'wordt weer deel van de hal' })}</div>`,

    buiten: () => `<header><h3>Buiten</h3><span>rond het huis</span></header>
      <p class="ht-zin">Wat er rond je huis is. Op Thuis staat het naast het huis, met wat er hangt.</p>
      <h4>Rond het huis</h4>
      ${[['oprit', 'Oprit', true], ['tuin', 'Tuin', true], ['border', 'Border', false], ['terras', 'Terras', false], ['garage', 'Garage', true], ['carport', 'Carport', false], ['tuinhuis', 'Tuinhuis', true], ['deur', 'Voordeur', true]]
        .map(([icoon, naam, aan]) => `<div class="ht-rij rond">${`<span class="ik">${ik(icoon)}</span>`}<span class="t"><b>${naam}</b>${aan && naam === 'Tuinhuis' ? '<small>met de haard en de terrasheater</small>' : ''}</span>${schakel(aan)}</div>`).join('')}
      <h4>De thuisaccu staat</h4>${knoppen(['Gevel', 'Garage', 'Binnen'], 'Garage')}`,

    verbergen: () => `<header><h3>Airco woonkamer</h3><span>Woonkamer</span></header>
      ${rij({ ik: 'woonkamer', titel: 'Kamer', zin: 'Woonkamer', rechts: '›' })}
      ${rij({ ik: 'standaard', titel: 'Plek', zin: 'aan de achterwand', rechts: 'Laat kiezen' })}
      ${rij({ ik: 'apparaat', titel: 'Openen', zin: 'wat hij nu doet en wat je instelt', rechts: '›' })}
      <div class="ht-onder">${rij({ ik: 'verborgen', titel: 'Verbergen', zin: 'Niet meer in de app en de tekening. SunArc telt hem wel mee; terughalen kan bij Verborgen.' })}</div>`,

    verborgen: () => `<header><h3>Verborgen</h3><span>2 apparaten</span></header>
      <p class="ht-zin">Deze staan niet in de app en de tekening. Wat ze meten, telt wel mee.</p>
      ${rij({ ik: 'stekker', titel: 'Stekker printer', zin: 'Werkkamer', rechts: 'Terughalen' })}
      ${rij({ ik: 'licht', titel: 'Lamp vensterbank', zin: 'Slaapkamer', rechts: 'Terughalen' })}
      <div class="ht-onder">${rij({ ik: 'terug', titel: 'Terug naar Apparaten', zin: '' })}</div>`,
  };
  if (!BLAD[adres]) return;

  const zet = () => {
    const blad = document.getElementById('blad');
    if (blad) blad.innerHTML = BLAD[adres]();
  };
  // Na de tekenaar (huistekenen-schets.js): de stand en wat gekozen is, dan het blad.
  const wacht = () => {
    const t = window.tekenaar;
    if (!t) return requestAnimationFrame(wacht);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const v = t.vloer();
      const ruimte = (kamer) => Number(Object.entries(v.ruimtes).find(([, r]) => r.kamer === kamer)?.[0]);
      if (adres === 'kamerblad') t.kies({ soort: 'ruimte', id: ruimte('woonkamer') });
      if (adres === 'buiten' && t.huis.etages.some((e) => e.id === 'buiten')) t.zetEtage('buiten');
      if (adres === 'verbergen' || adres === 'verborgen') {
        t.zetStand('apparaten');
        const a = t.st.apparaten.find((x) => x.soort === 'airco' && x.kamer === 'woonkamer') ?? t.st.apparaten.find((x) => x.kamer);
        if (adres === 'verbergen' && a) t.kies({ soort: 'apparaat', id: a.id });
      }
      zet();
      // Bij Etage: de etage links als gekozen.
      document.querySelectorAll('[data-etage-kies]').forEach((b) => b.classList.toggle('blad-open', adres === 'etage' && b.getAttribute('aria-pressed') === 'true'));
      t.op(zet);
    }));
  };
  addEventListener('load', wacht);
})();
