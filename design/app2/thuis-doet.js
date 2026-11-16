/*
 * Wat SunArc doet, vast op Thuis (schets, 15 november 2026), voor Wand-Thuis-Doet
 * en Tel-Thuis-Doet. Stap 1 van de kwaliteitsronde, het kernpunt van issue 164:
 * "niet goed kunnen zien waarmee het bezig is".
 *
 * De achtergrond is de echte Thuis uit het voorbeeldhuis op een winterochtend,
 * 10:15 (screens/Doet-achtergrond-*, gemaakt met doet-achtergrond.mjs), zonder
 * begroeting, kop en zin, en met de plek voor de strook vrij: op de wand is het
 * vak van het huis 16 punten lager (het huis blijft bijna even groot), op de telefoon schuift
 * alles onder het huis 68 punten omlaag. De getallen hieronder komen uit wat de
 * dienst op dat moment zei (screens/Doet-achtergrond.json): de woonkamer 20,8°
 * met de warmtepomp aan, de badkamer 21,5° met de thermostaat op 21°, de zolder
 * 17° die naar 18° wil maar eerst even pauzeert, de ontvochtiger die op zon
 * wacht, de droger die niet is klaargezet, en meekijken sinds 13 januari.
 *
 * Wat anders is dan nu:
 * - De kop en de zin zeggen alleen nog wat er in huis echt gebeurt. Wat SunArc
 *   zou doen, staat in de strook. Nu staat dat door elkaar: wacht alleen SunArc
 *   op zon, dan zegt de kop "Het huis wacht op zon", terwijl in huis niets
 *   wacht. Die kop wordt dan "Rustige ochtend", en de strook zegt "Zou de
 *   zolder verwarmen zodra er zon over is". De slotzin "Het huis kijkt nog mee"
 *   en de staart over kamers die wachten gaan uit de kop.
 * - De strook staat op een vaste plek, zolang SunArc meekijkt: SunArc kijkt mee
 *   en één zin. Regelt SunArc zelf, dan is wat het doet hetzelfde als wat er
 *   gebeurt: de kop zegt het dan en de strook is weg (16 november, keuze
 *   Ricardo). Op de wand is hij één regel van 44 punten, zodat het huis zijn
 *   maat houdt (keuze Ricardo); dat SunArc je klimaat nog niet schakelt, staat
 *   daar in het blad. Op de telefoon staat het er wel bij. De zin is, in deze volgorde:
 *     1. wat SunArc nu anders zou doen      "Zou de badkamer nu niet verwarmen"
 *     2. anders, waar SunArc op wacht       "Zou de zolder verwarmen na een pauze"
 *     3. anders                             "Zou nu hetzelfde doen"
 *   Rechts hoeveel kamers gelijk zijn. Gelijk is: nu dezelfde kant op, allebei
 *   verwarmen, allebei koelen of allebei niets. Een kamer die met de hand is
 *   overgenomen of niet meedoet, telt niet mee.
 * - Een tik opent het blad: de stand met dezelfde balk als bij Regeling ›
 *   Klimaat, zonder teller van winterdagen (besluit 312: die test is van het
 *   huis van Ricardo, een nieuw huis wacht er niet op), sinds wanneer SunArc
 *   meekijkt, per kamer wat er nu in huis gebeurt
 *   naast wat SunArc zou doen, en wat SunArc wel zelf schakelt: de apparaten op
 *   zon. Licht en screens staan er niet bij: die bedien je zelf.
 * - De twee vakken per kamer zijn hele zinnetjes (16 november): "Thermostaat
 *   staat op 21° en staat stil", en onder de kop "SunArc zou": "Niets doen",
 *   "Hetzelfde doen", "Wachten, en verwarmen na een pauze". Eerst stond er
 *   "Ook niets" onder "SunArc zou", en dat las niet door.
 * - Een stand "Leert" is er niet: voor klimaat kijkt SunArc vanaf de eerste dag mee.
 *
 * Hash: de stand en -blad.
 *   (geen)    10:15, alles gelijk, SunArc wacht met de zolder op een korte pauze
 *   #anders   bedacht: de thermostaat in de badkamer staat op 22° en verwarmt
 *   #gelijk   bedacht: de zolder heeft niets nodig
 *   -blad     het blad open, zoals #anders-blad
 */
(function () {
  'use strict';

  const WOONKAMER = { naam: 'Woonkamer', temp: '20,8°', echt: 'Warmtepomp verwarmt naar 20,5°', zou: 'Hetzelfde doen', gelijk: true };
  const BADKAMER = { naam: 'Badkamer', temp: '21,5°', echt: 'Thermostaat staat op 21° en staat stil', zou: 'Niets doen', gelijk: true };
  const ZOLDER = { naam: 'Zolder', temp: '17°', echt: 'Airco zolder staat uit', zou: 'Wachten, en verwarmen na een pauze', gelijk: true };

  const MEEKIJKEN = {
    kleur: 'var(--ijs)',
    naam: 'Kijkt mee',
    onder: 'schakelt je klimaat nog niet',
    sinds: 'sinds 13 januari',
    kop: 'De woonkamer wordt verwarmd',
    zin: 'Het is er 20,8°, het doel is 20,5°.',
  };

  const STANDEN = {
    wacht: { ...MEEKIJKEN, zou: 'Zou de zolder verwarmen na een pauze', tel: { ja: 3, van: 3 }, kamers: [WOONKAMER, BADKAMER, ZOLDER] },
    anders: {
      ...MEEKIJKEN,
      zou: 'Zou de badkamer nu niet verwarmen',
      tel: { ja: 2, van: 3 },
      kamers: [WOONKAMER, { ...BADKAMER, echt: 'Thermostaat verwarmt naar 22°', zou: 'Niets doen, het is er warm genoeg', gelijk: false }, ZOLDER],
    },
    gelijk: { ...MEEKIJKEN, zou: 'Zou nu hetzelfde doen', tel: { ja: 3, van: 3 }, kamers: [WOONKAMER, BADKAMER, { ...ZOLDER, zou: 'Niets doen' }] },
  };

  const FASEN = ['Leren', 'Kijkt mee', 'Regelt'];

  const pijl = '<i class="d-pijl" aria-hidden="true">›</i>';
  const stip = '<span class="stip" aria-hidden="true"></span>';
  const telZin = (t) => `${t.ja} van ${t.van} kamers gelijk`;

  function blokjes(t) {
    return `<span class="blokjes" aria-hidden="true">${Array.from({ length: t.van }, (_, i) => `<i class="${i < t.ja ? 'ja' : ''}"></i>`).join('')}</span>`;
  }

  /** De strook: op de telefoon twee korte regels, op de wand met het aantal kamers dat gelijk is. */
  function strook(s, scherm) {
    if (scherm === 'tel') return `<button type="button" class="doet strook" style="--k: ${s.kleur}">${stip}<span class="d-twee"><span><b>${s.naam}</b> · ${s.onder}</span><span class="d-zou">${s.zou}</span></span>${pijl}</button>`;
    const tel = `<span class="d-tel">${blokjes(s.tel)}${telZin(s.tel)}</span>`;
    return `<button type="button" class="doet strook" style="--k: ${s.kleur}"><span class="d-wie">${stip}<b>SunArc ${s.naam.toLowerCase()}</b></span><span class="d-zou">${s.zou}</span>${tel}${pijl}</button>`;
  }

  function blad(s) {
    const fasen = `<span class="sb-fase" role="img" aria-label="${FASEN[1]}">${FASEN.map((f, i) => `<i class="${i === 1 ? 'nu' : ''}">${f}</i>`).join('')}</span>`;
    // Geen teller van winterdagen (besluit 312): die test is van het huis van Ricardo, niet van elk huis.
    const bewijs = '<p class="sb-bij">Zegt wat het zou doen. Zelf regelen zet je per kamer aan, zodra dat kan.</p>';
    const kamers = '<h3>Nu per kamer</h3><div class="sb-kamer kop"><span></span><span>Nu in huis</span><span>SunArc zou</span><span></span></div>'
        + s.kamers.map((k) => `<div class="sb-kamer"><span><b>${k.naam}</b><small>${k.temp}</small></span><span class="echt">${k.echt}</span><span class="zouhij">${k.zou}</span><span class="gelijk ${k.gelijk ? 'ja' : 'nee'}" aria-label="${k.gelijk ? 'gelijk' : 'anders'}">${k.gelijk ? '=' : '≠'}</span></div>`).join('');
    const zelf = `<h3>Apparaten op zon</h3>
      <div class="sb-wel"><span><b>Ontvochtiger</b></span><span class="waarde" style="color: var(--zon)">Wacht op zon</span></div>
      <div class="sb-wel"><span><b>Droger</b></span><span class="waarde" style="color: var(--gedempt)">Niet klaargezet</span></div>
      <div class="sb-wel"><span><b>Klimaat</b><small>Nog niet. Met de hand kan wel</small></span><span class="waarde" style="color: var(--gedempt)">Kijkt mee</span></div>`;
    return `<div class="bladkop"><h2 class="kop-2">Wat SunArc doet</h2><button type="button" class="knop knop-licht">Klaar</button></div>
      <div class="sb-kolommen">
        <div>
          <div class="sb-held"><span class="sb-stip" style="--k: ${s.kleur}"></span><b>${s.naam}</b><span class="onder">${s.sinds ? `${s.sinds}, ${s.onder}` : s.onder}</span>${fasen}</div>
          ${bewijs}
          ${kamers}
        </div>
        <div>${zelf}<div class="sb-knoppen"><button type="button" class="knop">Naar Vandaag ›</button></div></div>
      </div>`;
  }

  function teken() {
    const scherm = document.body.dataset.scherm;
    const delen = location.hash.slice(1).split('-').filter(Boolean);
    const naam = Object.keys(STANDEN).find((n) => delen.includes(n)) ?? 'wacht';
    const open = delen.includes('blad');
    const s = STANDEN[naam];
    document.querySelector('.scherm').style.backgroundImage = `url('screens/Doet-achtergrond-${scherm}.png')`;

    // Op de telefoon staat de stand van het huis naast de begroeting (besluit 286).
    const stand = scherm === 'tel' ? '<span class="sep">·</span><span class="standregel"><span>Dag tot 22:00</span><i>›</i></span>' : '';
    document.querySelector('[data-groet]').innerHTML = `Goedemorgen${stand}`;
    document.querySelector('[data-kop]').textContent = s.kop;
    document.querySelector('[data-zin]').textContent = s.zin;
    document.querySelector('[data-doet]').innerHTML = strook(s, scherm);

    const b = document.querySelector('[data-blad]');
    b.hidden = !open;
    document.querySelector('[data-achter]').hidden = !open;
    if (open) b.innerHTML = blad(s);
  }

  addEventListener('hashchange', teken);
  teken();
})();
