/*
 * Kosten als regels op Opbrengst, en prijzen per contractjaar (schets, 11
 * november 2026; issue 128, de rest). De inhoud voor Wand-Opbrengst-Kosten en
 * Tel-Opbrengst-Kosten, zodat wand en telefoon hetzelfde zeggen.
 *
 * Standen (de hash van de pagina):
 *   (zonder)   juli 2026, vaste prijs normaal en dal, salderen, vaste kosten ingesteld
 *   #geschat   november 2026 met een prijs per uur: een deel geschat, gas zonder prijs
 *   #jaar      het contractjaar 18 nov 2025 – 17 nov 2026, met andere prijzen in het vorige jaar
 *   #contract  Energie › Contract en prijzen, per contractjaar
 */
(function (global) {
  'use strict';

  const nl = (x, d = 2) => x.toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d });
  const euro = (x) => `${x < 0 ? '− ' : ''}€ ${nl(Math.abs(x))}`;

  /** Per stand: de periode, de regels, het totaal en de vergelijking. */
  function stand(naam) {
    if (naam === 'geschat') {
      return {
        titel: 'November 2026',
        regels: [
          { naam: 'Stroom', uitleg: '118 kWh, per uur zoals Home Assistant telde', euro: 31.42, let: 'deels geschat', letZin: '9 kWh van voor je de prijs per uur koppelde, tegen het gemiddelde van € 0,26' },
          { naam: 'Teruggeleverd', uitleg: '41 kWh, per uur zoals Home Assistant telde', euro: -4.18 },
          { naam: 'Gas', uitleg: '62 m³, geen prijs', euro: null, let: 'telt als € 0', letZin: 'Vul de gasprijs in, of koppel de kosten van gas in Home Assistant' },
          { naam: 'Vaste kosten', uitleg: '11 dagen, 5 posten', euro: 9.35, onder: [['Vaste leveringskosten', '€ 0,21 per dag', 2.31], ['Netbeheer stroom', '€ 1,10 per dag', 12.10], ['Vermindering energiebelasting', '− € 1,64 per dag', -18.04], ['Netbeheer gas', '€ 0,59 per dag', 6.49], ['Vaste leveringskosten gas', '€ 0,59 per dag', 6.49]] },
        ],
        totaal: 36.59,
        vorige: 'oktober € 88,10 over de hele maand',
        bron: 'Stroom en teruglevering per uur uit het Energie-dashboard van Home Assistant.',
      };
    }
    if (naam === 'jaar') {
      return {
        titel: 'Contractjaar 2024–2025',
        sub: '18 nov 2024 – 17 nov 2025',
        regels: [
          { naam: 'Stroom normaal', uitleg: '1.212 kWh', euro: 336.12, prijzen: [['tot 31 mrt', '€ 0,29'], ['vanaf 1 apr', '€ 0,27']] },
          { naam: 'Stroom dal', uitleg: '1.868 kWh', euro: 470.86, prijzen: [['tot 31 mrt', '€ 0,26'], ['vanaf 1 apr', '€ 0,25']] },
          { naam: 'Teruggeleverd', uitleg: '3.410 kWh, gesaldeerd tegen je stroomprijs', euro: -892.44 },
          { naam: 'Boven je verbruik', uitleg: '330 kWh × € 0,08 in plaats van je stroomprijs', euro: 62.1 },
          { naam: 'Gas', uitleg: '742 m³ × € 1,37', euro: 1016.54 },
          { naam: 'Vaste kosten', uitleg: '365 dagen, 5 posten', euro: 310.25 },
        ],
        totaal: 1303.43,
        vorige: 'je jaarafrekening zei € 1.316',
        bron: 'Twee prijzen: op 1 april ging je stroom omlaag. Elke dag rekent met de prijs van toen.',
      };
    }
    return {
      titel: 'Juli 2026',
      regels: [
        { naam: 'Stroom normaal', uitleg: '22,7 kWh × € 0,27', euro: 6.14 },
        { naam: 'Stroom dal', uitleg: '76,7 kWh × € 0,25', euro: 19.16 },
        { naam: 'Teruggeleverd', uitleg: '292,5 kWh, gesaldeerd tegen je stroomprijs', euro: -77.59 },
        { naam: 'Vaste kosten', uitleg: '31 dagen, 5 posten', euro: 26.35, onder: [['Vaste leveringskosten', '€ 0,21 per dag', 6.51], ['Netbeheer stroom', '€ 1,10 per dag', 34.10], ['Vermindering energiebelasting', '− € 1,64 per dag', -50.84], ['Netbeheer gas', '€ 0,59 per dag', 18.29], ['Vaste leveringskosten gas', '€ 0,59 per dag', 18.29]] },
      ],
      totaal: -25.94,
      vorige: 'juni € −54,01',
      bron: 'Stroom en teruglevering uit je P1-meter, met je eigen prijzen.',
    };
  }

  /** De kaart Kosten: per regel wat, hoe het telt, en het bedrag; onderaan het totaal. */
  function kaart(s, { open = 'Vaste kosten' } = {}) {
    const regels = s.regels
      .map((r) => {
        const bedrag = r.euro == null ? '<b class="leeg">–</b>' : `<b class="${r.euro < 0 ? 'min' : ''}">${euro(r.euro)}</b>`;
        const let_ = r.let ? `<span class="let">${r.let}</span>` : '';
        const prijzen = r.prijzen ? `<span class="prijzen">${r.prijzen.map(([w, p]) => `${w} <b>${p}</b>`).join(', ')}</span>` : '';
        const onder = r.onder && r.naam === open ? `<div class="onder">${r.onder.map(([n, u, e]) => `<div class="krij"><span>${n}<small>${u}</small></span><b class="${e < 0 ? 'min' : ''}">${euro(e)}</b></div>`).join('')}</div>` : '';
        return `<div class="kregel${r.onder ? ' klap' : ''}${r.naam === open && r.onder ? ' open' : ''}"><div class="kboven"><span class="knaam">${r.naam}${r.onder ? '<i>›</i>' : ''}</span>${bedrag}</div><div class="kuitleg">${r.uitleg}${prijzen ? ` · ${prijzen}` : ''}${let_}</div>${r.letZin ? `<div class="kletzin">${r.letZin}</div>` : ''}${onder}</div>`;
      })
      .join('');
    return `<section class="glas kostenkaart">
      <div class="kkop"><h2 class="kop-3">Kosten</h2><span>${s.sub ?? s.titel}</span></div>
      <div class="kregels">${regels}</div>
      <div class="ktotaal"><span>Samen</span><b>${euro(s.totaal)}</b></div>
      <p class="kvorig">${s.vorige}</p>
      <p class="kbron">${s.bron} <a>Contract en prijzen ›</a></p>
    </section>`;
  }

  /** Energie › Contract en prijzen per contractjaar: bovenaan de jaren, daaronder de prijzen van het gekozen jaar. */
  function contract(breed) {
    const jaren = [
      ['Nu', '18 nov 2025 – 17 nov 2026', true],
      ['2024–2025', '18 nov 2024 – 17 nov 2025', false],
      ['2023–2024', '18 nov 2023 – 17 nov 2024', false],
    ];
    const tabs = jaren.map(([n, d, aan]) => `<button class="jaar${aan ? ' aan' : ''}"><b>${n}</b><small>${d}</small></button>`).join('');
    const prijs = (label, waarde, klein = '') => `<label class="vak"><span>${label}</span><div class="invoer">${waarde}</div>${klein ? `<small>${klein}</small>` : ''}</label>`;
    return `<div class="ckop"><h2 class="kop-2">Contract en prijzen</h2><p>Elk jaar loopt vanaf de startdatum van je contract. Opbrengst rekent elke dag met de prijzen van zijn eigen jaar.</p></div>
      <div class="jaren">${tabs}<button class="jaar erbij"><b>+ Eerder jaar</b><small>voor oude maanden</small></button></div>
      <div class="cvak${breed ? ' breed' : ''}">
        <div class="ckolom">
          <h3>Dit contractjaar</h3>
          <div class="regelvak"><span>Begint op</span><b>18 november</b><small>elk jaar, zoals je jaarafrekening</small></div>
          <h3>Stroom</h3>
          <div class="chips seg"><span class="chip">Eén tarief</span><span class="chip aan">Normaal en dal</span><span class="chip">Per uur</span></div>
          <div class="twee">${prijs('Normaal, € per kWh', '0,27')}${prijs('Dal, € per kWh', '0,25')}</div>
          <div class="wissel-in"><b>Andere prijs in dit jaar?</b><span>+ Vanaf een datum</span></div>
        </div>
        <div class="ckolom">
          <h3>Gas</h3>
          ${prijs('€ per m³', '1,37')}
          <h3>Teruglevering</h3>
          <div class="chips seg"><span class="chip aan">Salderen tot 2027</span><span class="chip">Geen salderen</span></div>
          ${prijs('Vergoeding boven je verbruik, € per kWh', '0,08')}
          <h3>Vaste kosten</h3>
          <div class="posten"><span>Netbeheer stroom <b>€ 1,10 per dag</b></span><span>Vermindering energiebelasting <b>− € 1,64 per dag</b></span><span>Vaste leveringskosten <b>€ 0,21 per dag</b></span><span class="meer">+ 2 andere</span></div>
          <p class="cnote">Een nieuw contractjaar begint met de prijzen van het vorige; pas aan wat er anders werd.</p>
        </div>
      </div>`;
  }

  global.kostenSchets = { stand, kaart, contract };
})(window);
