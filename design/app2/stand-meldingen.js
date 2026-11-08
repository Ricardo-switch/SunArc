/*
 * De stand van het huis met wat er meespeelt (schets, 8 november 2026), voor
 * Wand-Thuis-Stand en Tel-Thuis-Stand. De achtergrond is de echte Thuis uit het
 * voorbeeldhuis op een winterdag (screens/Stand-achtergrond-*), zonder de
 * begroeting, de kop en de stand-knop: die tekent dit bestand per stand.
 *
 * Wat anders is dan nu:
 * - Op de wand blijft de knop rechtsboven, met erin wat er speelt: "Dag · de
 *   airco springt bij" (Ricardo, 8 november). De woorden staan in
 *   stand-achtergrond.mjs, dat de echte knop zo laat tekenen.
 * - Op de telefoon staat de stand als regel naast de begroeting: "Goedemorgen ·
 *   De airco springt bij". Daar is de stand voortaan altijd te openen (nu
 *   alleen als hij afwijkt). Zonder iets bijzonders: "Dag tot 22:00".
 * - Speelt er iets mee, dan zegt de knop of regel dat, met een stip in de kleur ervan.
 *   Eén ding tegelijk, het belangrijkste eerst: met de hand, bijspringen,
 *   vakantie, afwezig, er brandt nog licht.
 * - Het blad zegt bovenaan de stand van nu met de dag als balk, daaronder wat er
 *   meespeelt, en rechts (op de telefoon eronder) de standen zoals nu.
 *
 * Standen (hash), met -blad erachter het blad open:
 *   (geen)     10:15, de airco springt bij in de woonkamer
 *   #gewoon    10:15, niets bijzonders: Dag tot 22:00
 *   #hand      10:15, airco zolder met de hand en de Nest met de hand
 *   #licht     22:40, nog Dag: het sfeerlicht in de woonkamer brandt
 *   #afwezig   22:40, niemand thuis
 *   #vakantie  22:40, vakantie, gekozen in Home Assistant
 */
(function () {
  'use strict';

  /* Het voorbeeldhuis: voorverwarmen 6:00, dag 7:00, nacht 22:00; de woonkamer 19,5°, 20,5°, 's nachts niet. */
  const DAGDELEN = [
    { van: 0, tot: 6, naam: 'Nacht', temp: 'niet', kleur: 'var(--violet)' },
    { van: 6, tot: 7, naam: 'Voor', temp: '19,5°', kleur: 'var(--zon)' },
    { van: 7, tot: 22, naam: 'Dag', temp: '20,5°', kleur: 'var(--ijs)' },
    { van: 22, tot: 24, naam: 'Nacht', temp: 'niet', kleur: 'var(--violet)' },
  ];

  const STANDEN = {
    bijspringen: {
      moment: 'ochtend', nu: 10.25, groet: 'Goedemorgen',
      stand: 'Dag', kort: 'De airco springt bij', kleur: 'var(--gloed)',
      kop: 'De woonkamer wordt verwarmd', zin: 'Het is er 20,1°, het doel is 20,5°. De ketel houdt het niet bij, de airco helpt.',
      onder: 'uit de dagdelen · om 22:00 nacht',
      mee: [
        { kleur: 'var(--gloed)', ik: 'airco', wat: 'De airco springt bij in de woonkamer', hoe: 'De ketel stookt al 6 minuten en het is 0,4° te koud.', waarde: 'sinds 10:02' },
      ],
      noot: 'Hij springt bij na 5 minuten stoken en vanaf 0,3° te koud, bij Regeling › Klimaat. In de nacht, bij voorverwarmen, afwezig en vakantie niet.',
    },
    gewoon: {
      moment: 'ochtend', nu: 10.25, groet: 'Goedemorgen',
      stand: 'Dag', kort: 'Dag tot 22:00', kleur: null,
      kop: 'De woonkamer wordt verwarmd', zin: 'Het is er 20,8°, het doel is 20,5°. Zolder: wacht: pauzeert even na het uitgaan.',
      onder: 'uit de dagdelen · om 22:00 nacht',
      mee: [],
      noot: 'Niets bijzonders: het huis volgt de dagdelen.',
    },
    hand: {
      moment: 'ochtend', nu: 10.25, groet: 'Goedemorgen',
      stand: 'Dag', kort: 'Airco zolder tot 12:00', kleur: 'var(--mint)',
      kop: 'De woonkamer wordt verwarmd', zin: 'Het is er 20,8°, het doel is 20,5°. Zolder: met de hand op 21°, tot 12:00.',
      onder: 'uit de dagdelen · om 22:00 nacht',
      mee: [
        { kleur: 'var(--mint)', ik: 'hand', wat: 'Airco zolder met de hand', hoe: 'Op 21°, daarna weer zoals het was.', waarde: 'tot 12:00' },
        { kleur: 'var(--mint)', ik: 'nest', wat: 'De Nest met de hand', hoe: 'Iemand draaide aan de thermostaat.', waarde: 'tot 13:00' },
      ],
      noot: 'Wat met de hand gaat, wint van de stand tot het eind.',
    },
    licht: {
      moment: 'avond', nu: 22.67, groet: 'Goedenavond', verlengd: true,
      stand: 'Dag', kort: 'Nog Dag: er brandt licht', kleur: 'var(--zon)',
      kop: 'De woonkamer is fris', zin: 'Het is er 19,4°, het doel is 20,5°.',
      onder: 'langer dan 22:00 · daarna nacht',
      mee: [
        { kleur: 'var(--zon)', ik: 'lamp', wat: 'Het sfeerlicht in de woonkamer brandt', hoe: 'Gaat het uit, dan wordt het Nacht.', waarde: 'sinds 22:00' },
      ],
      noot: 'Welke lampen de dag langer maken, staat bij Comfort › Dagdelen.',
    },
    afwezig: {
      moment: 'avond', nu: 22.67, groet: 'Goedenavond', plat: { naam: 'Afwezig', temp: '16°', kleur: 'var(--ijs)' },
      stand: 'Afwezig', kort: 'Niemand thuis', kleur: 'var(--ijs)',
      kop: 'Rustige avond', zin: 'Niemand thuis: zuiniger tot iemand terug is.',
      onder: 'vanzelf · niemand thuis',
      mee: [
        { kleur: 'var(--ijs)', ik: 'weg', wat: 'Iedereen is weg', hoe: 'Sinds 18:30. Is iemand terug, dan weer de dagdelen.', waarde: '16°' },
      ],
      noot: 'De airco springt niet bij zolang het huis op Afwezig staat.',
    },
    vakantie: {
      moment: 'avond', nu: 22.67, groet: 'Goedenavond', plat: { naam: 'Vakantie', temp: '12°', kleur: 'var(--violet)' },
      stand: 'Vakantie', kort: 'Vakantie', kleur: 'var(--violet)',
      kop: 'Rustige avond', zin: 'Langer weg: zo zuinig mogelijk.',
      onder: 'gekozen in Home Assistant',
      mee: [
        { kleur: 'var(--violet)', ik: 'koffer', wat: 'Zo zuinig mogelijk', hoe: 'De airco springt niet bij. Tot je hem in Home Assistant terugzet.', waarde: '12°' },
      ],
      noot: 'Home Assistant kent geen einddatum, dus hier staat geen tot.',
    },
  };

  const LIJST = [
    ['Automatisch', 'Volgt de dagdelen bij Comfort. Is niemand thuis, dan Afwezig.'],
    ['Voorverwarmen', 'Vroeg in de ochtend: op tijd warm voor de dag begint.'],
    ['Dag', 'De temperaturen voor overdag. Brandt er na de nacht nog licht, dan langer.'],
    ['Nacht', 'De temperaturen voor de nacht.'],
    ['Afwezig', 'Niemand thuis: een zuinigere temperatuur.'],
    ['Vakantie', 'Langer weg: zo zuinig mogelijk, tot je terug bent.'],
    ['Handmatig', 'Het huis regelt niets: je bedient alles zelf.'],
  ];

  const IK = {
    airco: '<rect x="3" y="5" width="18" height="8" rx="2"/><path d="M7 17c0 1.5 1 2 1 3M12 17c0 1.5 1 2 1 3M17 17c0 1.5 1 2 1 3"/>',
    hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.2-2.3L4 14.5a1.5 1.5 0 0 1 2.4-1.8L8 14"/>',
    nest: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 1.5"/>',
    lamp: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
    weg: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M15 15h-6"/>',
    koffer: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>',
  };
  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

  /** De dag als balk: de dagdelen met hun temperatuur in de woonkamer, en waar het nu is. */
  function balk(s) {
    const pct = (u) => `${(u / 24) * 100}%`;
    let delen;
    if (s.plat) delen = `<div class="sb-deel plat" style="left: 0; width: 100%; --k: ${s.plat.kleur}"><b>${s.plat.naam}</b><span>${s.plat.temp} de hele dag</span></div>`;
    else {
      // Een naam alleen waar hij past: niet in het uur voorverwarmen en de twee uur nacht na 22:00.
      delen = DAGDELEN.map((d) => `<div class="sb-deel" style="left: ${pct(d.van)}; width: ${pct(d.tot - d.van)}; --k: ${d.kleur}"><b>${d.tot - d.van >= 4 ? d.naam : ''}</b><span>${d.tot - d.van >= 4 ? d.temp : ''}</span></div>`).join('');
      // Er brandt nog licht: de dag loopt door tot nu, gestreept.
      if (s.verlengd) delen += `<div class="sb-deel verlengd" style="left: ${pct(22)}; width: ${pct(s.nu - 22)}; --k: var(--ijs)"></div>`;
    }
    const uren = [0, 6, 12, 18, 24].map((u) => `<i style="left: ${pct(u)}">${String(u).padStart(2, '0')}:00</i>`).join('');
    return `<div class="sb-balk"><div class="sb-delen">${delen}</div><div class="sb-nu" style="left: ${pct(s.nu)}"><em>nu</em></div><div class="sb-uren">${uren}</div></div><p class="sb-bij">${s.plat ? 'Geldt in elke kamer, de hele dag.' : 'Voorverwarmen 6:00, dag 7:00, nacht 22:00. De graden van de woonkamer.'}</p>`;
  }

  function blad(s) {
    const mee = s.mee.length
      ? s.mee.map((m) => `<div class="sb-mee" style="--k: ${m.kleur}"><span class="ik">${svg(IK[m.ik])}</span><span><b>${m.wat}</b><small>${m.hoe}</small></span><span class="waarde">${m.waarde}</span></div>`).join('')
      : '';
    const nu = s.plat ? s.stand : 'Automatisch';
    const lijst = LIJST.map(([naam, uitleg]) => `<div class="modusrij${naam === nu ? ' nu' : ''}"><b>${naam}${naam === nu ? '<span class="mini"> · nu</span>' : ''}</b><span>${uitleg}</span></div>`).join('');
    return `<div class="bladkop"><h2 class="kop-2">De stand van het huis</h2><button type="button" class="knop knop-licht">Klaar</button></div>
      <div class="sb-kolommen">
        <div class="sb-links">
          <div class="sb-held"><span class="sb-stip" style="--k: ${s.kleur ?? 'rgb(var(--wit) / 0.35)'}"></span><b>${s.stand}</b><span>${s.onder}</span></div>
          ${balk(s)}
          <h3>Wat er meespeelt</h3>
          ${mee}
          <p class="sb-noot">${s.noot}</p>
        </div>
        <div class="sb-rechts">
          <h3>De standen</h3>
          ${lijst}
          <p class="mini sb-nog">Kiezen kan hier nog niet. De stand stuurt nu je verwarming via Home Assistant, en SunArc kijkt alleen mee.</p>
        </div>
      </div>`;
  }

  function teken() {
    const scherm = document.body.dataset.scherm;
    const delen = location.hash.slice(1).split('-').filter(Boolean);
    const open = delen.includes('blad');
    const naam = STANDEN[delen.find((d) => d !== 'blad')] ? delen.find((d) => d !== 'blad') : 'bijspringen';
    const s = STANDEN[naam];
    const vlak = document.querySelector('.scherm');
    // Op de wand zit de stand in de knop rechtsboven: die staat per stand in de achtergrond (stand-achtergrond.mjs).
    vlak.style.backgroundImage = `url('screens/Stand-achtergrond-${scherm}-${scherm === 'wand' ? naam : s.moment}.png')`;
    // 's Avonds is de kop op de telefoon één regel: daar staat de zin hoger.
    vlak.dataset.moment = s.moment;
    document.querySelector('[data-groet]').innerHTML = scherm === 'wand'
      ? s.groet
      : `${s.groet}<span class="sep">·</span><button type="button" class="standregel${s.kleur ? ' speelt' : ''}" style="--k: ${s.kleur ?? 'var(--zacht)'}">${s.kleur ? '<span class="stip"></span>' : ''}<span>${s.kort}</span><i>›</i></button>`;
    document.querySelector('[data-kop]').textContent = s.kop;
    document.querySelector('[data-zin]').textContent = s.zin;
    const b = document.querySelector('[data-blad]');
    b.hidden = !open;
    document.querySelector('[data-achter]').hidden = !open;
    if (open) b.innerHTML = blad(s);
  }

  addEventListener('hashchange', teken);
  teken();
})();
