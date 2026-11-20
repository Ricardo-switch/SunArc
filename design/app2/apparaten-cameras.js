/*
 * Camera's bij Apparaten (schets, 20 november 2026): een eigen soort naast
 * Licht, voor Wand-Apparaten-Cameras en Tel-Apparaten-Cameras. Bouwt op
 * apparaten-soorten.js: dezelfde pagina, met Camera's erbij.
 *
 * Eén camera is één kaart, zoals in Je huis één icoon (0.209.4): het beeld,
 * of hij nu iets ziet, en wat er ook in zit (de schijnwerper, de
 * bewegingsmelder). De deurbel is een camera met een bel. Welke camera's op
 * Thuis staan, kies je nog steeds bij Licht, camera's en weer; hier staan
 * ze allemaal.
 *
 * Het voorbeeld is het huis van nu: Camera oprit met schijnwerper en
 * bewegingsmelder, en de deurbel aan de voordeur met zijn bewegingsmelder.
 */
(function (global) {
  'use strict';
  const s = global.schets;
  const ik = s.ik;

  const SCENE = {
    oprit: '<svg class="scene" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice"><rect width="320" height="180" fill="#9fb4c4"/><rect y="70" width="320" height="110" fill="#6d6a66"/><polygon points="0,180 120,70 200,70 320,180" fill="#8d8781"/><rect x="0" y="40" width="80" height="70" fill="#7a4536"/><rect x="250" y="36" width="70" height="74" fill="#7a4536"/><rect x="132" y="96" width="70" height="34" rx="8" fill="#c9d3dc"/><rect x="140" y="84" width="52" height="18" rx="6" fill="#a9b6c2"/><circle cx="148" cy="132" r="7" fill="#2a2f36"/><circle cx="188" cy="132" r="7" fill="#2a2f36"/><rect x="0" y="100" width="22" height="80" fill="#3c6b3a"/><rect x="300" y="96" width="20" height="84" fill="#3c6b3a"/><g fill="#33302d"><circle cx="232" cy="104" r="7"/><rect x="226" y="111" width="12" height="26" rx="5"/></g></svg>',
    deurbel: '<svg class="scene" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice"><rect width="320" height="180" fill="#cfd6dc"/><rect y="0" width="320" height="38" fill="#e9edf0"/><rect x="0" y="38" width="190" height="142" fill="#8a4a3a"/><g stroke="#6f3a2d" stroke-width="1">' + Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="${48 + i * 11}" x2="190" y2="${48 + i * 11}"/>`).join('') + '</g><rect x="196" y="44" width="124" height="136" fill="#eef1f3"/><g stroke="#cfd6dc">' + Array.from({ length: 11 }, (_, i) => `<line x1="${206 + i * 11}" y1="44" x2="${206 + i * 11}" y2="180"/>`).join('') + '</g><rect x="122" y="104" width="38" height="66" rx="4" fill="#3d7a46"/><rect x="0" y="120" width="34" height="60" fill="#3c6b3a"/><rect x="0" y="168" width="320" height="12" fill="#7d6f62"/></svg>',
  };

  /*
   * `nu`: ziet hij nu iets (gloeiende rand, zoals op Thuis). `bel`: wanneer er
   * het laatst is aangebeld. `vandaag`: hoe vaak hij vandaag iets zag, uit de
   * geschiedenis van de bewegingsmelder in Home Assistant.
   */
  const CAMERAS = [
    {
      soort: 'cameras', id: 'oprit', naam: 'Camera oprit', waar: 'Oprit', scene: 'oprit', nu: true, aan: true,
      beeld: 'Persoon, nu', stand: ['Ziet nu iemand', 'var(--gloed)'], vandaag: '7 keer beweging',
      bij: [
        { icoon: 'lamp', naam: 'Schijnwerper', zin: 'Aan sinds 17:12', schakel: true, aan: true },
        { icoon: 'beweging', naam: 'Bewegingsmelder', zin: 'Ziet nu iemand' },
      ],
    },
    {
      soort: 'cameras', id: 'deurbel', naam: 'Deurbel', waar: 'Voordeur', scene: 'deurbel', bel: true,
      beeld: 'Aangebeld om 13:07', stand: ['Rustig · laatst 13:07', 'rgba(255,255,255,0.28)'], vandaag: '1 keer aangebeld, 4 keer beweging',
      bij: [
        { icoon: 'beweging', naam: 'Bewegingsmelder', zin: 'Niets sinds 13:07' },
      ],
    },
  ];

  const SOORT = { id: 'cameras', naam: 'Camera’s', icoon: 'camera', kleur: '169, 156, 255', vorm: 'camera', wat: 'Camera’s en de deurbel' };
  // Na Licht: ze komen samen uit Licht, camera's en weer.
  s.SOORTEN.splice(s.SOORTEN.findIndex((x) => x.id === 'licht') + 1, 0, SOORT);
  s.APPARATEN.push(...CAMERAS);

  const vlak = `background: rgba(${SOORT.kleur}, 0.14); color: rgb(${SOORT.kleur})`;

  /** Het beeld met wat hij ziet erop, zoals de kaart op Thuis. */
  function beeld(c, groot) {
    return `<div class="beeld${c.nu ? ' ziet-nu' : ''}${c.bel ? ' bel' : ''}${groot ? ' groot' : ''}">${SCENE[c.scene]}
      ${c.bel ? `<span class="naam">${ik('deurbel')}Deurbel</span>` : ''}
      <span class="wanneer"><i></i>${c.beeld}</span>${groot ? '<span class="live">live</span>' : ''}</div>`;
  }

  /** Wat er ook in zit: een regel per deel, de schijnwerper met een schakelaar. */
  function bijRegels(c) {
    return `<div class="erin">${c.bij
      .map((b) => `<div class="deel"><span class="lik${b.aan ? ' aan' : ''}">${ik(b.icoon)}</span><span class="lnaam">${b.naam}<small>${b.zin}</small></span>${b.schakel ? `<span class="schakel${b.aan ? '' : ' uit'}" role="switch" aria-checked="${!!b.aan}" aria-label="${b.naam}"></span>` : ''}</div>`)
      .join('')}</div>`;
  }

  function cameraKaart(c) {
    return `<section class="app glas cam${c.nu ? ' ziet' : ''}" data-cam="${c.id}">
      <div class="kopje"><span class="ik" style="${vlak}">${ik(c.bel ? 'deurbel' : 'camera')}</span><div><b>${c.naam}</b><span class="waar">${c.waar}</span></div><div></div></div>
      ${beeld(c)}
      <div class="stand"><i style="background: ${c.stand[1]}"></i>${c.stand[0]}</div>
      ${bijRegels(c)}
      <div class="vandaag"><span>Vandaag</span><b>${c.vandaag}</b></div>
    </section>`;
  }

  /** De soort Camera's: wat nu iets ziet eerst. */
  function cameraBlok() {
    const voor = [...CAMERAS.filter((c) => c.nu), ...CAMERAS.filter((c) => !c.nu)];
    const ziet = CAMERAS.filter((c) => c.nu).length;
    return `<section class="soort" id="soort-cameras" style="--breed: ${Math.min(3, voor.length)}">
      <h2><span class="ik" style="${vlak}">${ik('camera')}</span>${SOORT.naam}<small>${ziet ? `${ziet} ziet nu iets` : 'alles rustig'}</small></h2>
      <div class="kaarten">${voor.map(cameraKaart).join('')}</div>
    </section>`;
  }

  /*
   * Het blad van een camera (#blad): het beeld groot en live, wat er ook in
   * zit, en of hij op Thuis staat (dezelfde keuze als bij Licht, camera's en
   * weer). Openen in Home Assistant voor de opnames: die bewaart SunArc niet.
   */
  function cameraBlad(id = 'oprit') {
    const c = CAMERAS.find((x) => x.id === id);
    return `<aside class="blad glas camblad">
      <div class="bkop"><div><h2>${c.naam}</h2><p>${c.waar} · ${c.stand[0].toLowerCase()}</p></div><span class="sluit">×</span></div>
      ${beeld(c, true)}
      <div><h3 class="bh">Zit er ook in</h3>${bijRegels(c)}</div>
      <div class="instelling"><span class="ik" style="${vlak}">${ik('camera')}</span><div><b>Op Thuis</b><small>Op de kaart Camera’s, net als bij Licht, camera’s en weer.</small></div><span class="schakel" role="switch" aria-checked="true" aria-label="Op Thuis"></span></div>
      <div class="vandaag"><span>Vandaag</span><b>${c.vandaag}</b></div>
      <p class="hoe">Opnames terugkijken gaat in Home Assistant of de app van je camera. SunArc bewaart geen beelden.</p>
      <div class="bonder"><button class="zet zacht">Openen in Home Assistant</button></div>
    </aside>`;
  }

  const oudBlok = s.soortBlok;
  s.soortBlok = (x) => (x.id === 'cameras' ? cameraBlok() : oudBlok(x));
  Object.assign(s, { CAMERAS, cameraBlok, cameraBlad, cameraKaart });
})(window);
