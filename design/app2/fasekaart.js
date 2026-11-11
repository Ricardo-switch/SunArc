/*
 * De fasekaart (schets, 11 november 2026; testerronde stap 7, besluit 78):
 * de inhoud voor Wand-Fasekaart en Tel-Fasekaart, zodat wand en telefoon
 * hetzelfde zeggen. Een aansluiting van 3 × 25 A (zoals het huis eind 2026
 * krijgt), op een winteravond om 18:10.
 *
 * Standen (de hash van de pagina):
 *   (zonder)  3 × 25 A, rustig: de meeste ruimte op L3
 *   #krap     L2 bijna vol: de laadpaal gaat terug naar 6 A
 *   #een      1 × 35 A, één fase (het huis nu)
 *   #geen     3 × 25 A zonder stroommeter per fase: alleen het totaal
 */
(function (global) {
  'use strict';

  const nl = (x, d = 0) => x.toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d });

  /** Per stand: de zekering, de stroom nu per fase, de piek van vandaag en de lijn van de dag (elk kwartier, 06:00–24:00). */
  function stand(naam) {
    const lijn = (basis, piek, piekUur) => Array.from({ length: 73 }, (_, i) => {
      const uur = 6 + i / 4;
      const golf = Math.max(0, 1 - Math.abs(uur - piekUur) / 2.2);
      const ruis = (Math.sin(i * 1.7) + Math.sin(i * 0.6)) * 0.8;
      return Math.max(0.5, basis + (piek - basis) * golf + ruis);
    });
    if (naam === 'een') {
      return { zekering: 35, fasen: [{ naam: 'L1', nu: 21, piek: 29, piekOm: '18:05', lijn: lijn(6, 29, 18.1) }], marge: 2, meters: true };
    }
    if (naam === 'geen') {
      return { zekering: 25, fasen: null, totaalKw: 5.1, marge: 2, meters: false };
    }
    if (naam === 'krap') {
      return {
        zekering: 25,
        marge: 2,
        meters: true,
        fasen: [
          { naam: 'L1', nu: 14, piek: 17, piekOm: '17:40', lijn: lijn(4, 17, 17.7) },
          { naam: 'L2', nu: 22.6, piek: 23.1, piekOm: '18:10', lijn: lijn(5, 23.1, 18.2) },
          { naam: 'L3', nu: 12, piek: 15, piekOm: '18:00', lijn: lijn(3, 15, 18) },
        ],
        melding: { kleur: 'gloed', kop: 'Bijna vol op L2', zin: 'De oven en de laadpaal samen: de laadpaal gaat even terug naar 6 A, tot er weer ruimte is.' },
      };
    }
    return {
      zekering: 25,
      marge: 2,
      meters: true,
      fasen: [
        { naam: 'L1', nu: 11, piek: 17, piekOm: '17:40', lijn: lijn(4, 17, 17.7) },
        { naam: 'L2', nu: 16, piek: 21, piekOm: '18:10', lijn: lijn(5, 21, 18.2) },
        { naam: 'L3', nu: 6, piek: 12, piekOm: '18:00', lijn: lijn(3, 12, 18) },
      ],
    };
  }

  const kleurVan = (a, max) => (a / max >= 0.88 ? 'var(--gloed)' : a / max >= 0.65 ? 'var(--zon)' : 'var(--mint)');

  /** De kaart op Thuis: per fase een balk tot de zekering, met de ruimte van nu. */
  function kaart(s) {
    if (!s.fasen) {
      const max = (s.zekering * 230 * 3) / 1000;
      const deel = s.totaalKw / max;
      return `<a class="glas kaart fasekaart">
        <div class="kop"><span class="ik">${global.iconen.svg('aansluiting')}</span><h2 class="kop-3">Aansluiting</h2><span class="klein">3 × ${s.zekering} A</span><span class="pijl">›</span></div>
        <div class="totaal"><b>${nl(s.totaalKw, 1)} kW</b><span>van ${nl(max, 1)} kW samen</span></div>
        <div class="fbalk"><i style="width: ${(deel * 100).toFixed(1)}%; background: ${kleurVan(deel, 1)}"></i></div>
        <p class="mist-regel"><span class="mist">Meter per fase mist</span> Zonder stroommeter per fase ziet SunArc alleen het totaal, niet welke fase vol raakt.</p>
      </a>`;
    }
    const ruimte = s.fasen.map((f) => ({ f, over: s.zekering - s.marge - f.nu })).sort((a, b) => a.over - b.over)[0];
    const kop = s.melding
      ? `<p class="fzin" style="color: var(--${s.melding.kleur}-t)"><b>${s.melding.kop}.</b> ${s.melding.zin}</p>`
      : `<p class="fzin">${s.fasen.length > 1 ? `Het krapst op ${ruimte.f.naam}: nog ${nl(ruimte.over)} A ruimte.` : `Nog ${nl(ruimte.over)} A ruimte.`}</p>`;
    const balken = s.fasen
      .map((f) => {
        const deel = Math.min(1, f.nu / s.zekering);
        const grens = ((s.zekering - s.marge) / s.zekering) * 100;
        return `<div class="frij"><span class="fnaam">${f.naam}</span><div class="fbalk"><i style="width: ${(deel * 100).toFixed(1)}%; background: ${kleurVan(f.nu, s.zekering)}"></i><em style="left: ${grens.toFixed(1)}%" title="Hier blijft SunArc onder"></em></div><b>${nl(f.nu, f.nu % 1 ? 1 : 0)} A</b></div>`;
      })
      .join('');
    return `<a class="glas kaart fasekaart">
      <div class="kop"><span class="ik">${global.iconen.svg('aansluiting')}</span><h2 class="kop-3">Aansluiting</h2><span class="klein">${s.fasen.length === 1 ? '' : '3 × '}${s.zekering} A</span><span class="pijl">›</span></div>
      <div class="fbalken">${balken}</div>
      ${kop}
    </a>`;
  }

  /** De dag per fase als lijn, met de zekering en waar SunArc onder blijft. */
  function dag(s, breed, hoog) {
    const max = s.zekering * 1.04;
    const x = (i) => (i / 72) * breed;
    const y = (a) => hoog - (a / max) * hoog;
    const kleuren = ['#6fd3ff', '#f7b548', '#8f86ff'];
    const lijnen = s.fasen
      .map((f, k) => `<polyline points="${f.lijn.map((a, i) => `${x(i).toFixed(1)},${y(a).toFixed(1)}`).join(' ')}" fill="none" stroke="${kleuren[k]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`)
      .join('');
    const uren = [6, 9, 12, 15, 18, 21, 24].map((u) => `<text x="${x((u - 6) * 4).toFixed(1)}" y="${hoog + 16}" text-anchor="${u === 6 ? 'start' : u === 24 ? 'end' : 'middle'}" font-size="11" fill="#7f8e9c">${u}</text>`).join('');
    const nu = x((18 + 10 / 60 - 6) * 4);
    return `<svg class="fdag" viewBox="0 -18 ${breed} ${hoog + 38}" role="img" aria-label="De stroom per fase vandaag">
      <line x1="0" x2="${breed}" y1="${y(s.zekering)}" y2="${y(s.zekering)}" stroke="#ff7a4d" stroke-width="1.5"/>
      <text x="${breed}" y="${y(s.zekering) - 5}" text-anchor="end" font-size="11" fill="#ff9d6e">zekering ${s.zekering} A</text>
      <line x1="0" x2="${breed}" y1="${y(s.zekering - s.marge)}" y2="${y(s.zekering - s.marge)}" stroke="#ff7a4d" stroke-width="1" stroke-dasharray="4 5" opacity="0.6"/>
      ${lijnen}
      <line x1="${nu}" x2="${nu}" y1="0" y2="${hoog}" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
      ${uren}
    </svg>`;
  }

  /** Het blad: de fasen nu, de dag, de pieken, en wat SunArc doet als het krap wordt. */
  function blad(s, breed) {
    if (!s.fasen) {
      return `<div class="bkop"><div><h2>Aansluiting</h2><p>3 × ${s.zekering} A · zonder meter per fase</p></div><span class="sluit">×</span></div>
        ${kaartInhoud(s)}
        <div class="uitleg"><h3>Zo ziet SunArc ook per fase</h3><p>Kies bij Energie › Aansluiting een stroommeter per fase, bijvoorbeeld van je P1-meter (stroom L1, L2 en L3). Dan houdt SunArc elke fase apart onder ${s.zekering - s.marge} A, en zie je hier welke vol raakt.</p><a class="knopje">Naar Energie › Aansluiting ›</a></div>`;
    }
    const legenda = s.fasen.map((f, k) => `<span><i style="background: ${['#6fd3ff', '#f7b548', '#8f86ff'][k]}"></i>${f.naam}</span>`).join('');
    const pieken = s.fasen.map((f) => `<div class="piek"><span>${f.naam}</span><b>${nl(f.piek, f.piek % 1 ? 1 : 0)} A</b><small>om ${f.piekOm}</small></div>`).join('');
    return `<div class="bkop"><div><h2>Aansluiting</h2><p>${s.fasen.length === 1 ? `1 fase · ${s.zekering} A` : `3 fasen · ${s.zekering} A per fase`} · SunArc blijft onder ${s.zekering - s.marge} A</p></div><span class="sluit">×</span></div>
      ${kaartInhoud(s)}
      <div class="dagblok"><div class="dagkop"><h3>Vandaag</h3><div class="legenda">${legenda}</div></div>${dag(s, breed, 120)}</div>
      <div class="pieken"><h3>Het hoogst vandaag</h3><div class="pieklijst">${pieken}</div></div>
      <div class="uitleg"><h3>Als het krap wordt</h3><p>SunArc zet eerst de laadpaal lager, dan wacht een airco of stekker op zon. Wat jij zelf aanzet, zoals de oven, gaat altijd voor.</p></div>`;
  }

  /** De balken van de kaart, zonder de kop: voor in het blad. */
  function kaartInhoud(s) {
    const html = kaart(s);
    const binnen = html.slice(html.indexOf('</div>') + 6, html.lastIndexOf('</a>'));
    return `<div class="bbalken">${binnen}</div>`;
  }

  global.fasekaart = { stand, kaart, blad };
})(window);
