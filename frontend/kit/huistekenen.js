/*
 * SunArc: je huis tekenen (schets, 11 november 2026).
 *
 * Opnieuw ontworpen na Je huis 0.158-0.162 (besluit 288, teruggedraaid in
 * 0.163.0). Wat er anders is:
 *
 * - Een etage is ruitjespapier van 10 cm. Elk ruitje hoort bij één ruimte of
 *   ligt buiten. Er is dus nooit een gat of een overlap, en een ruimte mag elke
 *   rechte vorm hebben (een L, een U). De oude boom van lijnen is weg: een muur
 *   schuiven verandert alleen de twee ruimtes ernaast.
 * - Eén manier van tekenen: trek een vak met je vinger (een nieuwe ruimte), pak
 *   een muur om hem te schuiven, tik iets aan om te zeggen wat het is.
 * - Alles gaat via één luisteraar op de tekening zelf, die de vinger vasthoudt
 *   (`setPointerCapture`, `touch-action: none`). Wat je raakt rekent de motor
 *   uit de meters, niet uit het element onder je vinger. Tijdens het slepen
 *   blijft de tekening staan; er wordt niets bewaard tot je loslaat.
 * - Een apparaat hoeft geen plek: zonder plek kiest de tekening er een die bij
 *   de soort past (airco aan de achterwand, screen aan de gevel, lamp in het
 *   midden). Verplaatsen kan, en bij een muur klikt het vast.
 *
 * Gebruik: huistekenen.maak(svg, huis, opties) geeft de tekenaar;
 * huistekenen.paneel(el, tekenaar) en huistekenen.stapel(el, tekenaar) vullen
 * het blad ernaast en de etages. De assen: x naar rechts langs de voorgevel,
 * y van de straat naar achter, in ruitjes.
 *
 * Sinds besluit 308 (stap 1) staat de motor in frontend/kit: de app (Je huis)
 * en de schetsen in design/app2 gebruiken hetzelfde bestand. De teksten staan
 * in teksten.nl.js en teksten.en.js onder `ht.`. Bewaren gaat in de app via
 * `opties.opslaan` (de dienst), in de schets via `opties.bewaar` (de browser);
 * `opties.tekening` is wat er al bewaard was, in meters (`t.uitvoer()`).
 */
(function (global) {
  'use strict';

  const CEL = 0.1;
  const BUITEN = -1;
  const MARGE = 30;
  const MIN = 6;
  const FONT = 'font-family="Figtree, system-ui, sans-serif"';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  /** Een tekst uit teksten.*.js (taal.js); zonder taal.js de sleutel zelf. */
  const T = (sleutel, p) => (typeof global.t === 'function' ? global.t(sleutel, p) : sleutel);
  const nl = (n, d = 1) => n.toLocaleString(global.taal?.locale ?? 'nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d });
  const meter = (cellen) => `${nl(cellen * CEL)} m`;
  const klem = (n, a, b) => Math.min(b, Math.max(a, n));
  const ik = (naam) => (global.iconen ? global.iconen.svg(global.iconen.heeft(naam) ? naam : 'apparaat') : '');

  const TINT = { woon: '110 231 183', keuken: '247 181 72', slaap: '143 134 255', nat: '111 211 255', hal: '184 196 207', garage: '154 170 187', groen: '120 196 110', huis: '96 112 136', leeg: '255 255 255' };
  // Buiten (19 november 2026): de tuin groen, de oprit grijs, het terras warm, de gebouwen als de garage, het huis donker.
  const SOORT_TINT = { woonkamer: 'woon', woonkeuken: 'keuken', keuken: 'keuken', eetkamer: 'keuken', slaapkamer: 'slaap', kinderkamer: 'slaap', logeerkamer: 'slaap', werkkamer: 'slaap', zolder: 'slaap', badkamer: 'nat', toilet: 'nat', wasruimte: 'nat', hal: 'hal', overloop: 'hal', trap: 'hal', berging: 'hal', garage: 'garage', kelder: 'garage', tuin: 'groen', voortuin: 'groen', zijtuin: 'groen', border: 'groen', oprit: 'hal', pad: 'hal', terras: 'keuken', dakterras: 'keuken', balkon: 'keuken', carport: 'garage', tuinhuis: 'garage', schuur: 'garage', jacuzzi: 'nat', thuis: 'huis' };
  /** Ruimtes die niet in Home Assistant hoeven te staan. */
  const EIGEN_SLEUTELS = [['hal', 'hal'], ['toilet', 'toilet'], ['overloop', 'overloop'], ['trap', 'trap'], ['berging', 'berging'], ['berging', 'meterkast']];
  /** Buiten (19 november 2026): wat er op een erf staat zonder dat Home Assistant het kent. */
  const EIGEN_BUITEN = [['berging', 'schuur'], ['berging', 'fietsenhok'], ['berging', 'kas'], ['berging', 'pad']];
  /** [soort, naam] in de taal van de app; buiten andere namen. */
  const eigenNamen = (buiten = false) => (buiten ? EIGEN_BUITEN : EIGEN_SLEUTELS).map(([soort, k]) => [soort, T(`ht.eigen.${k}`)]);
  const APP_KLEUR = { licht: '#f7b548', airco: '#6fd3ff', screen: '#6fd3ff', meter: '#ff9a6b', thermostaat: '#ff9a6b', stekker: '#f7b548', koffie: '#f7b548', camera: '#a99cff', beweging: '#a99cff', auto: '#9aaabb', accu: '#6ee7b7', droger: '#6fd3ff', vaat: '#6fd3ff', rookmelder: '#ff9a6b', boiler: '#ff9a6b', jacuzzi: '#6fd3ff' };
  const APP_ICOON = { meter: 'klimaat' };
  /**
   * Eén apparaat, één bolletje (20 november 2026): wat er ook in een apparaat
   * zit, zoals de schijnwerper en de bewegingsmelder van een camera. De naam
   * zonder die van het apparaat zelf; is er niets over, dan wat het doet.
   */
  function bijBlad(a) {
    if (!a.bij?.length) return '';
    const kort = (x) => {
      const n = (x.naam ?? '').trim();
      const rest = n.toLowerCase().startsWith((a.naam ?? '').toLowerCase()) ? n.slice((a.naam ?? '').length).trim() : n;
      return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : null;
    };
    const wat = (x) => T(`ht.bij.${['licht', 'beweging', 'meter', 'camera'].includes(x.soort) ? x.soort : 'anders'}`);
    return `<h4>${esc(T('ht.app.zitErin'))}</h4>${a.bij.map((x) => rij({ ik: APP_ICOON[x.soort] ?? x.soort, kleur: APP_KLEUR[x.soort], titel: kort(x) ?? wat(x), zin: kort(x) ? wat(x) : '', data: 'disabled' })).join('')}`;
  }

  /* ================================================================ de vloer: ruitjes */

  /** Een lege vloer in de maat van het hele huis; `blokken` in meters, elk een eigen ruimte zonder naam. */
  function nieuweVloer(maat, blokken) {
    const W = Math.round(maat.breed / CEL) + 2 * MARGE;
    const H = Math.round(maat.diep / CEL) + 2 * MARGE;
    const v = { W, H, cel: new Int16Array(W * H).fill(BUITEN), ruimtes: {}, zones: {}, volg: 1 };
    for (const b of blokken) {
      const id = v.volg++;
      v.ruimtes[id] = { blok: b.id };
      vulRecht(v, MARGE + Math.round(b.u / CEL), MARGE + Math.round(b.v / CEL), MARGE + Math.round((b.u + b.b) / CEL), MARGE + Math.round((b.v + b.d) / CEL), id, true);
    }
    return v;
  }
  function vulRecht(v, x0, y0, x1, y1, id, ookBuiten) {
    let n = 0;
    for (let y = Math.max(0, y0); y < Math.min(v.H, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(v.W, x1); x++) {
        const i = y * v.W + x;
        if (!ookBuiten && v.cel[i] === BUITEN) continue;
        if (ookBuiten === 'alleen' && v.cel[i] !== BUITEN) continue;
        v.cel[i] = id;
        n++;
      }
    }
    return n;
  }
  const kopie = (v) => ({ W: v.W, H: v.H, cel: v.cel.slice(), ruimtes: JSON.parse(JSON.stringify(v.ruimtes)), zones: JSON.parse(JSON.stringify(v.zones ?? {})), volg: v.volg, openingen: JSON.parse(JSON.stringify(v.openingen ?? [])) });

  /**
   * Een zone is een stippellijn in één kamer, geen muur: de stukken van die
   * lijn die aan beide kanten in de ruimte liggen. Zo stopt hij vanzelf bij
   * een hal of een kast die in de kamer staat.
   */
  function zoneStukken(v, id, as, op) {
    const uit = [];
    const n = as === 'x' ? v.H : v.W;
    let start = -1;
    for (let j = 0; j <= n; j++) {
      const erin = j < n && (as === 'x' ? v.cel[j * v.W + op - 1] === id && v.cel[j * v.W + op] === id : v.cel[(op - 1) * v.W + j] === id && v.cel[op * v.W + j] === id);
      if (erin && start < 0) start = j;
      if (!erin && start >= 0) {
        uit.push({ as, op, van: start, tot: j });
        start = -1;
      }
    }
    return uit;
  }

  /**
   * Na elke verandering: een ruimte die in losse stukken viel houdt zijn
   * grootste stuk, de rest wordt een vak zonder naam. Een ruimte zonder
   * ruitjes verdwijnt (zijn kamer staat dan weer bij "nog geen plek").
   */
  function ordenen(v) {
    const { W, H, cel } = v;
    const merk = new Int32Array(W * H);
    const delen = {};
    const stapel = [];
    let label = 0;
    for (let i = 0; i < W * H; i++) {
      if (cel[i] === BUITEN || merk[i]) continue;
      const id = cel[i];
      label++;
      let n = 0;
      stapel.push(i);
      merk[i] = label;
      while (stapel.length) {
        const j = stapel.pop();
        n++;
        const x = j % W;
        for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, j - W, j + W]) {
          if (k < 0 || k >= W * H || merk[k] || cel[k] !== id) continue;
          merk[k] = label;
          stapel.push(k);
        }
      }
      (delen[id] ??= []).push({ label, n });
    }
    const om = {};
    for (const [id, lijst] of Object.entries(delen)) {
      lijst.sort((a, b) => b.n - a.n);
      for (const stuk of lijst.slice(1)) {
        const nieuw = v.volg++;
        v.ruimtes[nieuw] = {};
        om[stuk.label] = nieuw;
      }
      if (!v.ruimtes[id]) v.ruimtes[id] = {};
    }
    if (Object.keys(om).length) for (let i = 0; i < W * H; i++) if (om[merk[i]]) cel[i] = om[merk[i]];
    for (const id of Object.keys(v.ruimtes)) if (!delen[id]) delete v.ruimtes[id];
  }

  /** Lijnen waar twee buren verschillen: `pred(links, rechts)` geeft 0 of een soort. Loodrechte stukken op één lijn zijn één stuk. */
  function randen(v, pred) {
    const { W, H, cel } = v;
    const uit = [];
    for (let x = 1; x < W; x++) {
      let start = 0;
      let soort = 0;
      for (let y = 0; y <= H; y++) {
        const s = y < H ? pred(cel[y * W + x - 1], cel[y * W + x]) : 0;
        if (s === soort) continue;
        if (soort) uit.push({ as: 'x', op: x, van: start, tot: y, soort });
        start = y;
        soort = s;
      }
    }
    for (let y = 1; y < H; y++) {
      let start = 0;
      let soort = 0;
      for (let x = 0; x <= W; x++) {
        const s = x < W ? pred(cel[(y - 1) * W + x], cel[y * W + x]) : 0;
        if (s === soort) continue;
        if (soort) uit.push({ as: 'y', op: y, van: start, tot: x, soort });
        start = x;
        soort = s;
      }
    }
    return uit;
  }
  /** Muren: 1 tussen twee ruimtes, 2 de buitenmuur. */
  const isMuur = (a, b) => (a === b ? 0 : a === BUITEN || b === BUITEN ? 2 : 1);
  const lijnPad = (r) => (r.as === 'x' ? `M${r.op} ${r.van}V${r.tot}` : `M${r.van} ${r.op}H${r.tot}`);

  /*
   * Deuren, ramen en de voordeur (schets 13 november 2026, keuze Ricardo: op de
   * muur bij Kamers). Een opening ligt op een muurlijn: `as` en `op` zoals een
   * muur, van..tot langs de muur, in ruitjes. Hij hoort bij de vloer
   * (`v.openingen`); ligt er geen muur meer, dan telt hij niet.
   */
  const OPENING_BREED = { deur: 9, voordeur: 10, raam: 12, achterdeur: 10, dubbel: 14, schuifpui: 30 };
  /*
   * Deuren en ramen (schets Wand-Huis-Deuren, 20 november 2026): zes soorten.
   * Een deur draait om zijn scharnier (`scharnier` van of tot) naar een kant
   * (`kant` 1 of -1, weg: de kamer in); openslaande deuren (dubbel) hebben aan
   * elk eind een scharnier; een schuifpui schuift naar een eind (`schuift`).
   */
  const OPENING_SOORTEN = ['deur', 'voordeur', 'achterdeur', 'dubbel', 'schuifpui', 'raam'];
  /** Wat er in een binnenmuur kan: geen voordeur, achterdeur of raam. */
  const BINNEN_SOORTEN = ['deur', 'dubbel', 'schuifpui'];
  /** Een deur met één blad: daar hoort een scharnier bij. */
  const MET_SCHARNIER = new Set(['deur', 'voordeur', 'achterdeur']);
  /** Het scharnier, de kant en het schuiven, alleen wat er is. */
  const richtingVan = (o) => ({ ...(o.scharnier === 'tot' || o.scharnier === 'van' ? { scharnier: o.scharnier } : {}), ...(o.kant === 1 || o.kant === -1 ? { kant: o.kant } : {}), ...(o.schuift === 'tot' || o.schuift === 'van' ? { schuift: o.schuift } : {}) });
  /** Een klein plaatje per soort, van boven, zoals in de tekening. */
  function openingPlaatje(soort) {
    const c = { raam: '#a9e6ff', voordeur: '#f7b548', achterdeur: '#f7b548', schuifpui: '#a9e6ff' }[soort] ?? '#dfe6ec';
    const muur = '<line x1="4" y1="30" x2="12" y2="30" stroke="#eef3f7" stroke-width="3"/><line x1="44" y1="30" x2="52" y2="30" stroke="#eef3f7" stroke-width="3"/>';
    let s;
    if (soort === 'raam') s = `<line x1="12" y1="28.5" x2="44" y2="28.5" stroke="${c}" stroke-width="1.8"/><line x1="12" y1="31.5" x2="44" y2="31.5" stroke="${c}" stroke-width="1.8"/>`;
    else if (soort === 'schuifpui') s = `<line x1="12" y1="28" x2="30" y2="28" stroke="${c}" stroke-width="2.4"/><line x1="26" y1="32" x2="44" y2="32" stroke="${c}" stroke-width="2.4"/><path d="M34 22h-12m3-3-3 3 3 3" stroke="${c}" stroke-width="1.5" fill="none"/>`;
    else if (soort === 'dubbel') s = `<line x1="12" y1="30" x2="12" y2="14" stroke="${c}" stroke-width="2"/><path d="M28 30A16 16 0 0 0 12 14" stroke="${c}" stroke-dasharray="2 2" fill="none"/><line x1="44" y1="30" x2="44" y2="14" stroke="${c}" stroke-width="2"/><path d="M28 30A16 16 0 0 1 44 14" stroke="${c}" stroke-dasharray="2 2" fill="none"/>`;
    else s = `<line x1="12" y1="30" x2="12" y2="0" stroke="${c}" stroke-width="2"/><path d="M44 30A32 32 0 0 0 12 -2" stroke="${c}" stroke-dasharray="2 2" fill="none"/>`;
    return `<svg viewBox="0 0 56 36" width="56" height="36" aria-hidden="true"><g transform="translate(0 2)">${muur}${s}</g></svg>`;
  }
  /** 0: geen muur (meer), 1: een binnenmuur, 2: (deels) de buitenmuur. */
  function openingMuur(v, o) {
    let buiten = false;
    for (let j = o.van; j < o.tot; j++) {
      const [a, b] = o.as === 'x' ? [v.cel[j * v.W + o.op - 1], v.cel[j * v.W + o.op]] : [v.cel[(o.op - 1) * v.W + j], v.cel[o.op * v.W + j]];
      const m = isMuur(a, b);
      if (!m) return 0;
      if (m === 2) buiten = true;
    }
    return buiten ? 2 : 1;
  }
  /** Aan welke kant van de muur de ruimte ligt bij een buitenmuur (+1 of -1); bij een binnenmuur +1. */
  function openingBinnen(v, o) {
    const mid = Math.floor((o.van + o.tot) / 2);
    const plus = o.as === 'x' ? v.cel[mid * v.W + o.op] : v.cel[o.op * v.W + mid];
    return plus === BUITEN ? -1 : 1;
  }
  /** De trap: waar hij omhoog gaat, als richting in ruitjes. n is naar achter, z naar de straat. */
  const TRAP_RICHTING = { n: [0, 1], z: [0, -1], o: [1, 0], w: [-1, 0] };
  /**
   * Een muur in stukken van hooguit `stap` ruitjes voor het huis in 3D, met
   * per stuk wat erin zit: niets, een raam, een deur of de voordeur.
   */
  function muurDelen(v, run, stap = 10) {
    const op = (v.openingen ?? []).filter((o) => o.as === run.as && o.op === run.op && o.van >= run.van && o.tot <= run.tot && openingMuur(v, o)).sort((a, b) => a.van - b.van);
    const uit = [];
    const knip = (van, tot, soort, id) => {
      for (let a = van; a < tot; a += stap) uit.push({ van: a, tot: Math.min(tot, a + stap), soort, id });
    };
    let nu = run.van;
    for (const o of op) {
      if (o.van < nu) continue;
      knip(nu, o.van, null);
      uit.push({ van: o.van, tot: o.tot, soort: o.soort, id: o.id });
      nu = o.tot;
    }
    knip(nu, run.tot, null);
    return uit;
  }

  /** Per ruimte een pad van rechthoeken, voor de kleur. */
  function vlakPaden(v) {
    const d = {};
    for (const [id, lijst] of Object.entries(stroken(v))) d[id] = lijst.map(([x0, y0, x1, y1]) => `M${x0} ${y0}H${x1}V${y1}H${x0}Z`).join('');
    return d;
  }
  /** Per ruimte de rechthoeken waaruit hij bestaat, in ruitjes: [x0, y0, x1, y1]. Rijen met dezelfde stukken worden één. */
  function stroken(v) {
    const { W, H, cel } = v;
    const open = new Map();
    const d = {};
    for (let y = 0; y <= H; y++) {
      const nu = new Set();
      if (y < H) {
        let x = 0;
        while (x < W) {
          const id = cel[y * W + x];
          let x1 = x + 1;
          while (x1 < W && cel[y * W + x1] === id) x1++;
          if (id !== BUITEN) {
            const sleutel = `${id}:${x}:${x1}`;
            nu.add(sleutel);
            if (!open.has(sleutel)) open.set(sleutel, [id, x, x1, y]);
          }
          x = x1;
        }
      }
      for (const [sleutel, [id, x0, x1, y0]] of [...open]) {
        if (nu.has(sleutel)) continue;
        (d[id] ??= []).push([x0, y0, x1, y]);
        open.delete(sleutel);
      }
    }
    return d;
  }

  /** Per ruimte: hoeveel ruitjes, de rechthoek eromheen, en de grootste rechthoek die erin past (voor de naam en de apparaten). */
  function maten(v) {
    const { W, H, cel } = v;
    const uit = {};
    const hoog = new Int32Array(W);
    const boven = new Int16Array(W).fill(BUITEN);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const id = cel[y * W + x];
        hoog[x] = id === BUITEN ? 0 : id === boven[x] ? hoog[x] + 1 : 1;
        boven[x] = id;
        if (id === BUITEN) continue;
        const m = (uit[id] ??= { n: 0, x0: x, y0: y, x1: x + 1, y1: y + 1, r: null, a: 0 });
        m.n++;
        m.x0 = Math.min(m.x0, x);
        m.x1 = Math.max(m.x1, x + 1);
        m.y1 = y + 1;
      }
      let x = 0;
      while (x < W) {
        const id = cel[y * W + x];
        let x1 = x + 1;
        while (x1 < W && cel[y * W + x1] === id) x1++;
        if (id !== BUITEN) {
          // De grootste rechthoek onder dit stuk van de rij (de bekende stapel).
          const st = [];
          for (let i = x; i <= x1; i++) {
            const h = i < x1 ? hoog[i] : 0;
            let links = i;
            while (st.length && st[st.length - 1][1] >= h) {
              const [sx, sh] = st.pop();
              // Liever een vak waar een naam in past dan een lange smalle strook.
              const a = (i - sx) * sh * Math.min(1, Math.min(i - sx, sh) / 14);
              if (a > uit[id].a) {
                uit[id].a = a;
                uit[id].r = { x0: sx, y0: y + 1 - sh, x1: i, y1: y + 1 };
              }
              links = sx;
            }
            st.push([links, h]);
          }
        }
        x = x1;
      }
    }
    for (const m of Object.values(uit)) m.recht = m.n === (m.x1 - m.x0) * (m.y1 - m.y0);
    return uit;
  }
  /** De rechthoek om het hele huis op deze vloer. */
  function omtrek(v) {
    let x0 = v.W;
    let y0 = v.H;
    let x1 = 0;
    let y1 = 0;
    for (let i = 0; i < v.W * v.H; i++) {
      if (v.cel[i] === BUITEN) continue;
      const x = i % v.W;
      const y = (i / v.W) | 0;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x + 1);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y + 1);
    }
    return x1 ? { x0, y0, x1, y1 } : { x0: MARGE, y0: MARGE, x1: v.W - MARGE, y1: v.H - MARGE };
  }

  /* ---------------------------------------------- een muur schuiven */

  /**
   * Hoe ver een muur mag: aan de kant waar hij heen gaat houdt elke ruimte
   * minstens 60 cm. Buiten is ook een kant (bij Vorm): daar mag hij tot de rand.
   */
  /**
   * Hoe ver een muur kan: aan elke kant blijft de ruimte minstens MIN ruitjes.
   * `erf` (19 november 2026, Ricardo: bij een twee-onder-een-kap loopt het erf
   * gelijk met het huis): de rand van het erf mag tot tegen het volgende vak,
   * de strook ertussen mag helemaal weg.
   */
  function muurRuimte(v, run, erf = false) {
    const { W, H, cel } = v;
    const langs = run.as === 'x' ? H : W;
    const dwars = run.as === 'x' ? W : H;
    const op = (i, j) => (run.as === 'x' ? cel[j * W + i] : cel[i * W + j]);
    let min = 2;
    let max = dwars - 2;
    for (let j = Math.max(0, run.van); j < Math.min(langs, run.tot); j++) {
      const na = op(run.op, j);
      const voor = op(run.op - 1, j);
      const rand = erf && (na === BUITEN || voor === BUITEN);
      let k = 0;
      while (run.op + k < dwars && op(run.op + k, j) === na) k++;
      max = Math.min(max, na === BUITEN ? dwars - 2 : run.op + Math.max(0, k - (rand ? 0 : MIN)));
      k = 0;
      while (run.op - 1 - k >= 0 && op(run.op - 1 - k, j) === voor) k++;
      min = Math.max(min, voor === BUITEN ? 2 : run.op - Math.max(0, k - (rand ? 0 : MIN)));
    }
    return { min: Math.min(min, run.op), max: Math.max(max, run.op) };
  }
  /** De vloer met de muur op een nieuwe plek, altijd uit de stand van het begin. */
  function muurNaar(begin, run, nieuw) {
    const v = kopie(begin);
    const { W } = v;
    const zet = (i, j, id) => (run.as === 'x' ? (v.cel[j * W + i] = id) : (v.cel[i * W + j] = id));
    const lees = (i, j) => (run.as === 'x' ? begin.cel[j * W + i] : begin.cel[i * W + j]);
    for (let j = run.van; j < run.tot; j++) {
      if (nieuw > run.op) for (let i = run.op; i < nieuw; i++) zet(i, j, lees(run.op - 1, j));
      else for (let i = nieuw; i < run.op; i++) zet(i, j, lees(run.op, j));
    }
    return v;
  }

  /* ---------------------------------------------- een begin: indelingen */

  const GEWICHT = { woonkamer: 2.2, woonkeuken: 2.2, eetkamer: 1.3, keuken: 1.2, slaapkamer: 1.3, kinderkamer: 1, logeerkamer: 1, werkkamer: 0.9, badkamer: 0.8, toilet: 0.35, hal: 0.7, overloop: 0.7, berging: 0.5, garage: 1.5, zolder: 2 };
  const VOOR = new Set(['woonkamer', 'woonkeuken', 'slaapkamer', 'kinderkamer', 'werkkamer', 'logeerkamer']);
  const rond1 = (n) => Math.round(n * 10) / 10;
  function verdeel(kamers, as, lengte) {
    if (!kamers.length) return {};
    if (kamers.length === 1) return { kamer: kamers[0].id };
    const totaal = kamers.reduce((s, k) => s + (GEWICHT[k.soort] ?? 1), 0);
    const op = rond1((lengte * (GEWICHT[kamers[0].soort] ?? 1)) / totaal);
    return { as, op, a: { kamer: kamers[0].id }, b: verdeel(kamers.slice(1), as, lengte - op) };
  }
  function rijen(voor, achter, b, d) {
    if (!voor.length) return verdeel(achter, 'u', b);
    if (!achter.length) return verdeel(voor, 'u', b);
    return { as: 'v', op: rond1(d * 0.55), a: verdeel(voor, 'u', b), b: verdeel(achter, 'u', b) };
  }
  /** Een paar indelingen voor de kamers van een etage: een boom van lijnen voor het hoofdhuis, de rest per blok. */
  function indelingen(kamers, blokken) {
    const hoofd = blokken.find((g) => g.soort === 'hoofdhuis') ?? blokken[0];
    if (!hoofd || !kamers.length) return [];
    const vast = {};
    let rest = [...kamers];
    const pak = (blok, soorten) => {
      const k = blok && rest.find((x) => soorten.includes(x.soort));
      if (!k) return;
      vast[blok.id] = { kamer: k.id };
      rest = rest.filter((x) => x !== k);
    };
    pak(blokken.find((g) => g.soort === 'garage'), ['garage']);
    pak(blokken.find((g) => g.soort === 'uitbouw'), ['keuken', 'woonkeuken', 'eetkamer']);
    const B = hoofd.b;
    const D = hoofd.d;
    const hal = rest.find((k) => k.soort === 'hal' || k.soort === 'overloop');
    const zonderHal = rest.filter((k) => k !== hal);
    const voor = rest.filter((k) => VOOR.has(k.soort));
    const achter = rest.filter((k) => !VOOR.has(k.soort));
    const uit = [];
    const met = (naam, boom) => uit.push({ naam, bomen: { ...vast, [hoofd.id]: boom } });
    met(T('ht.indeling.naastElkaar'), verdeel(rest, 'u', B));
    if (voor.length && achter.length) met(T('ht.indeling.voorAchter'), rijen(voor, achter, B, D));
    if (hal && zonderHal.length) {
      const strook = Math.min(2.4, rond1(B * 0.28));
      met(T('ht.indeling.halOpzij'), { as: 'u', op: strook, a: { kamer: hal.id }, b: zonderHal.length > 2 ? rijen(zonderHal.filter((k) => VOOR.has(k.soort)), zonderHal.filter((k) => !VOOR.has(k.soort)), B - strook, D) : verdeel(zonderHal, 'v', D) });
      if (zonderHal.length >= 2) {
        const links = zonderHal.filter((_, i) => i % 2 === 0);
        const rechts = zonderHal.filter((_, i) => i % 2 === 1);
        const l = rond1((B - 1.6) / 2);
        met(T('ht.indeling.gangMidden'), { as: 'u', op: l, a: verdeel(links, 'v', D), b: { as: 'u', op: 1.6, a: { kamer: hal.id }, b: verdeel(rechts, 'v', D) } });
      }
    } else if (rest.length >= 2) {
      met(T('ht.indeling.achterElkaar'), verdeel(rest, 'v', D));
    }
    return uit;
  }
  /** De boom van een blok op de vloer zetten. */
  function boomOpVloer(v, blok, boom, perKamer) {
    const loop = (n, r) => {
      if (n.as === 'u') {
        const op = klem(n.op, 0.6, r.b - 0.6);
        loop(n.a, { ...r, b: op });
        loop(n.b, { ...r, u: r.u + op, b: r.b - op });
      } else if (n.as === 'v') {
        const op = klem(n.op, 0.6, r.d - 0.6);
        loop(n.a, { ...r, d: op });
        loop(n.b, { ...r, v: r.v + op, d: r.d - op });
      } else {
        let id = n.kamer ? perKamer[n.kamer] : null;
        if (!id) {
          id = v.volg++;
          v.ruimtes[id] = n.kamer ? { kamer: n.kamer } : {};
          if (n.kamer) perKamer[n.kamer] = id;
        }
        vulRecht(v, MARGE + Math.round(r.u / CEL), MARGE + Math.round(r.v / CEL), MARGE + Math.round((r.u + r.b) / CEL), MARGE + Math.round((r.v + r.d) / CEL), id, true);
      }
    };
    loop(boom ?? {}, { u: blok.u, v: blok.v, b: blok.b, d: blok.d });
  }
  function vloerUitIndeling(maat, blokken, bomen) {
    const v = { W: Math.round(maat.breed / CEL) + 2 * MARGE, H: Math.round(maat.diep / CEL) + 2 * MARGE, cel: null, ruimtes: {}, zones: {}, volg: 1 };
    v.cel = new Int16Array(v.W * v.H).fill(BUITEN);
    const perKamer = {};
    for (const b of blokken) boomOpVloer(v, b, bomen[b.id], perKamer);
    ordenen(v);
    return v;
  }

  /* ---------------------------------------------- bewaren (in de schets: in de browser) */

  function inpakken(v) {
    const rijen = [];
    let vorige = v.cel[0];
    let n = 0;
    for (let i = 0; i <= v.cel.length; i++) {
      if (i < v.cel.length && v.cel[i] === vorige) n++;
      else {
        rijen.push(vorige, n);
        vorige = v.cel[i];
        n = 1;
      }
    }
    return { W: v.W, H: v.H, r: rijen, ruimtes: v.ruimtes, zones: v.zones ?? {}, volg: v.volg, openingen: v.openingen ?? [] };
  }
  function uitpakken(p) {
    const cel = new Int16Array(p.W * p.H);
    let i = 0;
    for (let k = 0; k < p.r.length; k += 2) {
      cel.fill(p.r[k], i, i + p.r[k + 1]);
      i += p.r[k + 1];
    }
    return { W: p.W, H: p.H, cel, ruimtes: p.ruimtes, zones: p.zones ?? {}, volg: p.volg, openingen: p.openingen ?? [] };
  }

  /* ---------------------------------------------- bewaren in de dienst: meters (besluit 308) */

  const m1 = (cellen) => Math.round(cellen) / 10;
  /**
   * Een vloer als lijst ruimtes, elk met zijn rechthoeken in meters: [x, y,
   * breed, diep] vanaf de linker voorhoek van het huis. Een vak zonder naam
   * gaat ook mee: het is ook een ruimte, met zijn eigen muren.
   */
  function vloerNaarMeters(v) {
    const uit = [];
    for (const [id, lijst] of Object.entries(stroken(v))) {
      const r = v.ruimtes[id] ?? {};
      uit.push({ ...(r.kamer ? { kamer: r.kamer } : r.naam ? { naam: r.naam, ...(r.soort ? { soort: r.soort } : {}), ...(r.soort === 'trap' && r.omhoog ? { omhoog: r.omhoog } : {}) } : {}), vakken: lijst.map(([x0, y0, x1, y1]) => [m1(x0 - MARGE), m1(y0 - MARGE), m1(x1 - x0), m1(y1 - y0)]) });
    }
    return uit;
  }
  /**
   * Een vloer uit de dienst, op de gebouwen van nu: wat niet meer in het huis
   * valt, valt weg, en wat nergens bij hoort blijft een vak zonder naam. Met
   * `eigen` (stap 4: getekend op dezelfde bron) is de tekening zelf de
   * buitenkant, ook waar je een buitenmuur rechttrok of een vak buiten het huis
   * trok.
   */
  function vloerUitMeters(maat, blokken, ruimtes, zones, eigen) {
    const v = nieuweVloer(maat, eigen ? [] : blokken);
    const cel = (m) => MARGE + Math.round(m / CEL);
    for (const r of ruimtes ?? []) {
      const id = v.volg++;
      v.ruimtes[id] = r.kamer ? { kamer: r.kamer } : r.naam ? { naam: r.naam, ...(r.soort ? { soort: r.soort } : {}), ...(r.omhoog ? { omhoog: r.omhoog } : {}) } : {};
      for (const [x, y, b, d] of r.vakken ?? []) vulRecht(v, cel(x), cel(y), cel(x + b), cel(y + d), id, !!eigen);
    }
    // Een gebouw dat er later bij kwam (aangewezen bij Vorm) en nog niets getekend heeft: een eigen ruimte op zijn plek.
    if (eigen) {
      for (const b of blokken) {
        const [x0, y0, x1, y1] = [cel(b.u), cel(b.v), cel(b.u + b.b), cel(b.v + b.d)];
        let leeg = true;
        for (let y = y0; y < y1 && leeg; y++) for (let x = x0; x < x1; x++) if (v.cel[y * v.W + x] !== BUITEN) leeg = false;
        if (!leeg) continue;
        const id = v.volg++;
        v.ruimtes[id] = { blok: b.id };
        vulRecht(v, x0, y0, x1, y1, id, 'alleen');
      }
    }
    // Een strookje zonder naam van hooguit 20 cm (een verschil in afronding tussen de tekening en de kaart) gaat op in het vak ernaast (20 november 2026).
    const m = maten(v);
    /*
     * Een strook zonder naam langs een buitengevel, hooguit 1 m breed en
     * minstens 3 m lang (20 november 2026, Ricardo: na een dieper huis op de
     * kaart bleef op elke etage 5,6 bij 0,9 m over): de kamers ernaast lopen
     * door tot de gevel, elk stukje naar de kamer er recht naast.
     */
    for (const [rid, r] of Object.entries(v.ruimtes)) {
      const mm = m[rid];
      if (r.kamer || r.naam || r.blok || !mm) continue;
      const [bx, by] = [mm.x1 - mm.x0, mm.y1 - mm.y0];
      const smal = Math.min(bx, by);
      if (smal <= 2 || smal > 10 || Math.max(bx, by) < 30 || mm.n < 0.9 * bx * by) continue;
      const id = Number(rid);
      const opY = by <= bx;
      const tegenGevel = opY ? [mm.y0 - 1, mm.y1].some((y) => y < 0 || y >= v.H || v.cel[y * v.W + Math.floor((mm.x0 + mm.x1) / 2)] === BUITEN) : [mm.x0 - 1, mm.x1].some((x) => x < 0 || x >= v.W || v.cel[Math.floor((mm.y0 + mm.y1) / 2) * v.W + x] === BUITEN);
      if (!tegenGevel) continue;
      const naar = (x, y) => {
        // Langs de smalle kant zoeken naar de eerste kamer die er niet bij hoort.
        for (let d = 1; d <= smal + 1; d++) {
          for (const t of opY ? [[x, y - d], [x, y + d]] : [[x - d, y], [x + d, y]]) {
            const [tx, ty] = t;
            if (tx < 0 || ty < 0 || tx >= v.W || ty >= v.H) continue;
            const n = v.cel[ty * v.W + tx];
            if (n !== id && n !== BUITEN) return n;
          }
        }
        return null;
      };
      const nieuw = [];
      for (let y = mm.y0; y < mm.y1; y++) for (let x = mm.x0; x < mm.x1; x++) if (v.cel[y * v.W + x] === id) nieuw.push([y * v.W + x, naar(x, y)]);
      if (nieuw.every(([, n]) => n != null)) for (const [i, n] of nieuw) v.cel[i] = n;
    }
    for (const [rid, r] of Object.entries(v.ruimtes)) {
      const mm = m[rid];
      if (r.kamer || r.naam || r.blok || !mm || Math.min(mm.x1 - mm.x0, mm.y1 - mm.y0) > 2) continue;
      const id = Number(rid);
      const buren = {};
      for (let i = 0; i < v.cel.length; i++) {
        if (v.cel[i] !== id) continue;
        for (const j of [i - 1, i + 1, i - v.W, i + v.W]) {
          const n = v.cel[j];
          if (j >= 0 && j < v.cel.length && n !== id && n !== BUITEN) buren[n] = (buren[n] ?? 0) + 1;
        }
      }
      const naar = Number(Object.entries(buren).sort((x, y) => y[1] - x[1])[0]?.[0]);
      if (naar) for (let i = 0; i < v.cel.length; i++) if (v.cel[i] === id) v.cel[i] = naar;
    }
    ordenen(v);
    for (const r of Object.values(v.ruimtes)) {
      const z = r.kamer ? zones?.[r.kamer] : null;
      if (z) v.zones[r.kamer] = { as: z.as === 'u' ? 'x' : 'y', op: cel(z.op) };
    }
    return v;
  }

  /** Een klein plaatje van een vloer, voor de keuze van een indeling. */
  function klein(v, kamers, B, H) {
    const o = omtrek(v);
    const k = Math.min((B - 8) / (o.x1 - o.x0), (H - 8) / (o.y1 - o.y0));
    const ox = (B - (o.x1 - o.x0) * k) / 2 - o.x0 * k;
    const oy = H - (H - (o.y1 - o.y0) * k) / 2 + o.y0 * k;
    const paden = vlakPaden(v);
    const m = maten(v);
    let s = `<svg viewBox="0 0 ${B} ${H}" width="${B}" height="${H}" aria-hidden="true"><g transform="translate(${ox} ${oy}) scale(${k} ${-k})">`;
    for (const [id, d] of Object.entries(paden)) {
      const km = kamers[v.ruimtes[id]?.kamer];
      s += `<path d="${d}" fill="rgb(${TINT[SOORT_TINT[km?.soort] ?? (km ? 'woon' : 'leeg')]} / ${km ? 0.3 : 0.08})"/>`;
    }
    for (const r of randen(v, isMuur)) s += `<path d="${lijnPad(r)}" stroke="${r.soort === 2 ? '#dfe6ec' : '#aab6c2'}" stroke-width="${r.soort === 2 ? 2 : 1.2}" vector-effect="non-scaling-stroke" fill="none"/>`;
    s += '</g>';
    for (const [id, mm] of Object.entries(m)) {
      const km = kamers[v.ruimtes[id]?.kamer];
      if (!km || !mm.r || (mm.r.x1 - mm.r.x0) * k < 30) continue;
      s += `<text x="${ox + ((mm.r.x0 + mm.r.x1) / 2) * k}" y="${oy - ((mm.r.y0 + mm.r.y1) / 2) * k + 3}" text-anchor="middle" ${FONT} font-size="9" font-weight="700" fill="rgb(255 255 255 / 0.85)">${esc(km.naam.length > 8 ? `${km.naam.slice(0, 7)}.` : km.naam)}</text>`;
    }
    return `${s}</svg>`;
  }

  /* ================================================================ de tekenaar */

  /**
   * huis: { maat: {breed, diep}, etages: [{id, naam, kort, blokken: [{id, soort, naam, u, v, b, d}]}] van boven naar beneden,
   *         kamers: [{id, naam, soort, etage}], apparaten: [{id, naam, soort, kamer, ha}], verborgen: hoeveel apparaten verborgen zijn,
   *         begin: { etage: [boom per blok] } }
   */
  function maak(svg, huis, opties = {}) {
    const kamers = Object.fromEntries(huis.kamers.map((k) => [k.id, k]));
    /** Deuren, ramen, screens aan een raam en een trap met een richting (schets, nog niet in de dienst). */
    const metOpeningen = !!opties.openingen;
    const st = {
      stand: opties.stand ?? 'kamers',
      etage: opties.etage ?? huis.etages[huis.etages.length - 1].id,
      vloeren: {},
      apparaten: JSON.parse(JSON.stringify(huis.apparaten)),
      kies: null,
      /** Stap 3 (17 november 2026): een blad van de indeling, zolang er niets gekozen is: etage, buiten of verborgen. */
      blad: null,
      wapen: null,
      zoom: null,
      terug: [],
      vooruit: [],
      bewaard: true,
      bron: huis.bronnen ? (huis.bron ?? Object.keys(huis.bronnen)[0]) : null,
      hoek: 28,
      dicht: false,
    };
    /** De gebouwen van de gekozen bron: beneden allemaal, erboven alleen het hoofdhuis. */
    /** De gebouwen van de kaart eromheen (bij Vorm, om aan te wijzen), en de gebouwen naast het hoofdhuis. */
    const omgeving = () => huis.bronnen?.[st.bron]?.omgeving ?? [];
    const bijBlokken = () => (huis.bronnen?.[st.bron]?.blokken ?? []).filter((b) => b.soort !== 'hoofdhuis');
    const binnen = (pp, x, y) => {
      let erin = false;
      for (let i = 0, j = pp.length - 1; i < pp.length; j = i++) {
        const [xi, yi] = pp[i];
        const [xj, yj] = pp[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) erin = !erin;
      }
      return erin;
    };
    /** Wat er bij Vorm onder de vinger ligt: een gebouw dat erbij hoort (niet het hoofdhuis), of een grijs gebouw van de kaart. */
    const gebouwOp = (cx, cy) => {
      const [x, y] = [(cx - MARGE) * CEL, (cy - MARGE) * CEL];
      const b = bijBlokken().find((q) => x >= q.u && x <= q.u + q.b && y >= q.v && y <= q.v + q.d);
      if (b) return { soort: 'blok', id: b.id };
      const o = omgeving().find((q) => binnen(q.punten, x, y));
      return o ? { soort: 'omgeving', i: o.i } : null;
    };
    /*
     * Buiten (19 november 2026): wat los in de tuin staat (een tuinhuis, een
     * carport, iets anders, en de garage als die niet binnen hoort) ligt op het
     * erf en niet meer op de begane grond. Het huis ligt op het erf als één vast vak.
     */
    const losBuiten = (x) => ['tuinhuis', 'carport', 'anders'].includes(x.soort) || (x.soort === 'garage' && !huis.garageBinnen);
    /*
     * Bij Vorm op de begane grond (Ricardo, 20 november 2026: "zodra ik de
     * garage of schuur toewijs verdwijnen ze"): wat op het erf staat, blijft
     * te zien met zijn naam en "bij Buiten"; een tik brengt je daarheen.
     */
    const opErfBlokken = () => (etageVan(st.etage)?.buiten || !huis.etages.some((e) => e.buiten) ? [] : bijBlokken().filter((x) => losBuiten(x)));
    const zetBlokken = () => {
      const b = huis.bronnen?.[st.bron];
      if (!b) return;
      // De begane grond (`huis.beneden`, anders de onderste) krijgt alle gebouwen; een kelder en de etages erboven alleen het hoofdhuis.
      const beneden = huis.beneden ?? huis.etages.filter((e) => !e.buiten).at(-1)?.id;
      const metErf = huis.etages.some((e) => e.buiten);
      huis.etages.forEach((e) => (e.blokken = e.buiten ? [...(huis.erf ? [huis.erf] : []), ...b.blokken] : b.blokken.filter((x) => x.soort === 'hoofdhuis' || (e.id === beneden && !(metErf && losBuiten(x))))));
    };
    zetBlokken();
    /* ---------- het dak en de dakkapellen (stap 4 punt 3, Je huis › Dak, schets Wand-Huis-Dakkapel) */
    const hoofdBlok = () => (huis.bronnen?.[st.bron]?.blokken ?? []).find((b) => b.soort === 'hoofdhuis') ?? null;
    /**
     * De muren van het hoofdhuis tegen de buren (schets Wand-Huis-Woning, 20
     * november 2026), als muurlijnen in rastercellen: links, rechts en achter,
     * van de straat af gezien. Buiten en zonder hoofdhuis: geen.
     */
    const buurMuren = () => {
      const h = hoofdBlok();
      const kanten = huis.woning?.soort === 'vrijstaand' ? [] : (huis.woning?.buren ?? []);
      if (!h || !kanten.length || etageVan(st.etage)?.buiten) return [];
      const x0 = MARGE + h.u / CEL;
      const x1 = MARGE + (h.u + h.b) / CEL;
      const y0 = MARGE + h.v / CEL;
      const y1 = MARGE + (h.v + h.d) / CEL;
      return kanten.map((k) => (k === 'links' ? { as: 'x', op: x0, van: y0, tot: y1 } : k === 'rechts' ? { as: 'x', op: x1, van: y0, tot: y1 } : { as: 'y', op: y1, van: x0, tot: x1 }));
    };
    /** Ligt een muur op een muur tegen de buren? Dan komt er geen raam of voordeur. */
    const opBuurMuur = (run) => buurMuren().some((b) => b.as === run.as && Math.abs(b.op - run.op) <= 2 && Math.min(b.tot, run.tot) - Math.max(b.van, run.van) > 3);
    /** De etage onder het dak (de zolder), anders de bovenste. */
    const dakEtage = () => huis.etages.find((e) => e.dak && !e.buiten)?.id ?? huis.etages.find((e) => !e.buiten)?.id ?? null;
    /** De dakkapellen van het blok als die van de bewoner: kant, van..tot langs de nok, diep vanaf de goot, en de etage. */
    const kapelsVan = (b) => (b?.dakkapellen ?? []).map((k) => ({ kant: k.kant, van: k.van, tot: k.tot, diep: Math.max(0.5, Math.round((k.achter - k.voor) * 10) / 10), etage: k.etage ?? null }));
    st.kapellen = kapelsVan(hoofdBlok());
    /**
     * Het dak van het hoofdhuis in meters: `a` loopt langs de nok, `c` er
     * dwars op (kant 0 is de kant met de kleinste c: voor of links). Met de
     * goot van elke kant, de nok en hoe ver de nok van elke goot ligt. Null bij
     * een plat dak.
     */
    const dakMaat = () => {
      const b = hoofdBlok();
      if (!b || !b.dak || b.dak === 'plat') return null;
      const langs = b.nokLangs === 'y';
      const [a0, la, c0, lc] = langs ? [b.v, b.d, b.u, b.b] : [b.u, b.b, b.v, b.d];
      const naar0 = b.nokVan0 ?? lc / 2;
      return { b, langs, a0, la, c0, lc, naar: [naar0, lc - naar0], goot: [b.goot0 ?? b.goot1 ?? 3, b.goot1 ?? b.goot0 ?? 3], nok: b.nok ?? 8 };
    };
    /** Hoe hoog de vloer van een etage ligt: de etages eronder bij elkaar. */
    const vloerHoogte = (id) => {
      const lijst = huis.etages.filter((e) => !e.buiten);
      const i = lijst.findIndex((e) => e.id === id);
      return i < 0 ? 0 : lijst.slice(i + 1).reduce((t, e) => t + (e.hoogte ?? 2.6), 0);
    };
    /** Per kant hoe ver vanaf de goot het dak lager is dan 1,5 m boven de vloer van deze etage. */
    const laagStrook = (id) => {
      const m = dakMaat();
      if (!m) return [0, 0];
      const z = vloerHoogte(id) + 1.5;
      return [0, 1].map((k) => {
        const helling = (m.nok - m.goot[k]) / Math.max(0.1, m.naar[k]);
        return helling <= 0 ? 0 : Math.max(0, Math.min(m.naar[k], (z - m.goot[k]) / helling));
      });
    };
    /** De etages waar een dakkapel op kan: onder het schuine dak (een strook van minstens 20 cm). */
    const kapelEtages = () => (dakMaat() ? huis.etages.filter((e) => !e.buiten && (e.id === dakEtage() || Math.max(...laagStrook(e.id)) >= 0.2)).map((e) => e.id) : []);
    /** Waar een dakkapel ligt, in meters op het papier. */
    const kapelRecht = (k, m) => {
      const a = [m.a0 + k.van, m.a0 + k.tot];
      const c = k.kant === 0 ? [m.c0 + 0.3, m.c0 + 0.3 + k.diep] : [m.c0 + m.lc - 0.3 - k.diep, m.c0 + m.lc - 0.3];
      return m.langs ? { u0: c[0], u1: c[1], v0: a[0], v1: a[1] } : { u0: a[0], u1: a[1], v0: c[0], v1: c[1] };
    };
    const opDezeEtage = () => st.kapellen.map((k, i) => ({ k, i })).filter(({ k }) => (k.etage ?? dakEtage()) === st.etage);
    /** Na elke verandering: het blok (voor Huis in 3D) en de dienst. */
    const kapelBewaar = () => {
      const b = hoofdBlok();
      if (b) {
        b.dakkapellen = st.kapellen.map((k) => ({ kant: k.kant, van: k.van, tot: k.tot, voor: 0.3, achter: Math.round((0.3 + k.diep) * 10) / 10, ...(k.etage ? { etage: k.etage } : {}) }));
        b.kapelBron = 'bewoner';
        delete b.kapelVraag;
      }
      opties.kapel?.(st.kapellen.map((k) => ({ kant: k.kant, van: k.van, tot: k.tot, diep: k.diep, ...(k.etage ? { etage: k.etage } : {}) })));
    };
    const r1 = (n) => Math.round(n * 10) / 10;
    let luisteraars = [];
    const meld = () => luisteraars.forEach((f) => f());

    /* ---------- begin: uit de browser, of de eerste indeling */
    const sleutel = opties.bewaar ?? null;
    const begin = () => {
      for (const e of huis.etages) {
        const boom = huis.begin?.[e.id];
        st.vloeren[e.id] = boom ? vloerUitIndeling(huis.maat, e.blokken, boom) : nieuweVloer(huis.maat, e.blokken);
      }
      st.apparaten = JSON.parse(JSON.stringify(huis.apparaten));
    };
    begin();
    // Wat er in de dienst bewaard was (besluit 308): per etage de ruimtes in meters, de zonelijnen en de plekken.
    const bewaarde = opties.tekening;
    if (bewaarde?.tekening) {
      // Getekend op de bron van nu: de buitenmuur van de tekening telt. Een andere bron: de ruimtes vallen op de nieuwe vorm.
      const eigen = !bewaarde.tekeningBron || bewaarde.tekeningBron === st.bron;
      for (const e of huis.etages) if (bewaarde.tekening[e.id]?.length) st.vloeren[e.id] = vloerUitMeters(huis.maat, e.blokken, bewaarde.tekening[e.id], bewaarde.zones, eigen);
    }
    if (bewaarde?.plekken) {
      for (const a of st.apparaten) {
        const p = bewaarde.plekken[a.id];
        if (p && st.vloeren[p.etage]) a.plek = { etage: p.etage, x: MARGE + p.u / CEL, y: MARGE + p.v / CEL };
      }
    }
    // De deuren en ramen (0.187.0): u is x, v is y; en welk screen voor welk raam hangt.
    const celVan = (meter) => MARGE + Math.round(meter / CEL);
    if (bewaarde?.openingen) {
      for (const [etage, lijst] of Object.entries(bewaarde.openingen)) {
        if (!st.vloeren[etage]) continue;
        st.vloeren[etage].openingen = lijst.map((o) => ({ id: o.id, soort: o.soort, as: o.as === 'u' ? 'x' : 'y', op: celVan(o.op), van: celVan(o.van), tot: celVan(o.tot), ...richtingVan(o) }));
      }
    }
    if (bewaarde?.ramen) for (const a of st.apparaten) if (bewaarde.ramen[a.id] && a.plek) a.raam = bewaarde.ramen[a.id];
    /** De hele tekening in meters, zoals de dienst hem bewaart. */
    const uitvoer = () => {
      herstelErf();
      const tekening = {};
      const zones = {};
      for (const [etage, v] of Object.entries(st.vloeren)) {
        tekening[etage] = vloerNaarMeters(v);
        for (const [kamer, z] of Object.entries(v.zones ?? {})) zones[kamer] = { as: z.as === 'x' ? 'u' : 'v', op: m1(z.op - MARGE) };
      }
      const plekken = {};
      // Per apparaat de kamer waar het staat (stap 3); wat nog geen kamer heeft, ontbreekt.
      const apparaten = {};
      for (const a of st.apparaten) {
        if (a.plek) plekken[a.id] = { etage: a.plek.etage, u: Math.round((a.plek.x - MARGE) * 10) / 100, v: Math.round((a.plek.y - MARGE) * 10) / 100 };
        if (a.kamer) apparaten[a.id] = a.kamer;
      }
      // De deuren en ramen (0.187.0), in meters; en per screen het raam waar het voor hangt.
      const openingen = {};
      for (const [etage, v] of Object.entries(st.vloeren)) {
        const lijst = (v.openingen ?? []).filter((o) => openingMuur(v, o));
        if (lijst.length) openingen[etage] = lijst.map((o) => ({ id: o.id, soort: o.soort, as: o.as === 'x' ? 'u' : 'v', op: m1(o.op - MARGE), van: m1(o.van - MARGE), tot: m1(o.tot - MARGE), ...richtingVan(o) }));
      }
      const ramen = {};
      for (const a of st.apparaten) if (a.raam && a.plek) ramen[a.id] = a.raam;
      // Stap 4: op welke bron dit getekend is; een andere dan bij Daken en panelen zet die daar ook.
      return { tekening, zones, plekken, apparaten, bron: st.bron, ...(metOpeningen ? { openingen, ramen } : {}) };
    };
    if (sleutel) {
      try {
        const p = JSON.parse(localStorage.getItem(sleutel) ?? 'null');
        if (p?.vloeren && huis.etages.every((e) => p.vloeren[e.id]?.W === st.vloeren[e.id].W)) {
          for (const e of huis.etages) st.vloeren[e.id] = uitpakken(p.vloeren[e.id]);
          st.apparaten = p.apparaten;
          if (p.bron && huis.bronnen?.[p.bron]) {
            st.bron = p.bron;
            zetBlokken();
          }
        }
      } catch {
        // Zonder opslag begint de schets gewoon opnieuw.
      }
    }
    /*
     * Het huis op het erf is altijd precies het huis (20 november 2026,
     * Ricardo: het huis was 313 m² op zijn erf, met losse vakken eromheen).
     * Wat binnen het huis valt, is het vaste vak; wat daarbuiten nog "huis"
     * heette, wordt weer de tuin. Zo herstelt een kapotte tekening zichzelf.
     */
    const herstelErf = () => {
      const kamer = opties.vast?.[0];
      if (!kamer) return false;
      let veranderd = false;
      for (const e of huis.etages) {
        const vl = e.buiten ? st.vloeren[e.id] : null;
        if (!vl) continue;
        const delen = (e.blokken ?? []).filter((b) => b.soort === 'hoofdhuis' || b.soort === 'uitbouw' || (b.soort === 'garage' && huis.garageBinnen));
        if (!delen.length) continue;
        const celVan = (m) => MARGE + Math.round(m / CEL);
        const inHuis = new Uint8Array(vl.cel.length);
        for (const b of delen) for (let y = celVan(b.v); y < celVan(b.v + b.d); y++) for (let x = celVan(b.u); x < celVan(b.u + b.b); x++) if (x >= 0 && y >= 0 && x < vl.W && y < vl.H) inHuis[y * vl.W + x] = 1;
        let hid = Number(Object.entries(vl.ruimtes).find(([, r]) => r.kamer === kamer)?.[0]) || 0;
        // Echt kapot (meer dan 15% van het huis verkeerd): Buiten begint opnieuw zoals de eerste keer, op de kaart.
        let fout = 0;
        let huisCellen = 0;
        for (let i = 0; i < vl.cel.length; i++) {
          if (inHuis[i]) huisCellen++;
          if (inHuis[i] !== (hid && vl.cel[i] === hid ? 1 : 0)) fout++;
        }
        if (huis.begin?.[e.id] && (!hid || fout > huisCellen * 0.15)) {
          st.vloeren[e.id] = vloerUitIndeling(huis.maat, e.blokken, huis.begin[e.id]);
          veranderd = true;
          continue;
        }
        const tuinKamer = huis.begin?.[e.id]?.erf?.kamer ?? null;
        let tid = tuinKamer ? Number(Object.entries(vl.ruimtes).find(([, r]) => r.kamer === tuinKamer)?.[0]) || 0 : 0;
        for (let i = 0; i < vl.cel.length; i++) {
          if (inHuis[i]) {
            if (!hid) {
              hid = vl.volg++;
              vl.ruimtes[hid] = { kamer };
            }
            if (vl.cel[i] !== hid) {
              vl.cel[i] = hid;
              veranderd = true;
            }
          } else if (hid && vl.cel[i] === hid) {
            if (!tid) {
              tid = vl.volg++;
              vl.ruimtes[tid] = tuinKamer ? { kamer: tuinKamer } : {};
            }
            vl.cel[i] = tid;
            veranderd = true;
          }
        }
        if (veranderd) ordenen(vl);
      }
      return veranderd;
    };
    const erfHersteld = herstelErf();
    /*
     * De deurbel bij de voordeur (20 november 2026, stap 4 punt 3): heeft de
     * camera van de deurbel nog geen plek en is er een voordeur, dan staat hij
     * buiten naast de voordeur, 30 cm van de muur. Daarna sleep je hem waarheen
     * je wilt. Op het erf als dat er is (dezelfde maat), anders op de etage van de deur.
     */
    function deurbelBijVoordeur() {
      const bel = st.apparaten.find((a) => !a.plek && a.soort === 'camera' && (a.deurbel || /deurbel|doorbell/i.test(`${a.id} ${a.naam ?? ''}`)));
      if (!bel) return false;
      for (const e of huis.etages) {
        const vl = st.vloeren[e.id];
        const o = e.buiten ? null : (vl?.openingen ?? []).find((x) => x.soort === 'voordeur');
        if (!o) continue;
        const cel = (x, y) => (x < 0 || y < 0 || x >= vl.W || y >= vl.H ? BUITEN : vl.cel[y * vl.W + x]);
        const mid = Math.floor((o.van + o.tot) / 2);
        // Een muur langs x ligt tussen rij op-1 en op; buiten is de kant zonder ruimte.
        const naarBuiten = o.as === 'x' ? (cel(mid, o.op) === BUITEN ? 1 : -1) : cel(o.op, mid) === BUITEN ? 1 : -1;
        const opMuur = o.op + (naarBuiten > 0 ? 3 : -3);
        const langs = o.tot + 2;
        const erf = huis.etages.find((x) => x.buiten);
        bel.plek = o.as === 'x' ? { etage: erf?.id ?? e.id, x: langs, y: opMuur } : { etage: erf?.id ?? e.id, x: opMuur, y: langs };
        return true;
      }
      return false;
    }
    const belGezet = deurbelBijVoordeur();
    let bewaarTimer = null;
    /** In de app: elke keer de laatste stand naar de dienst, één tegelijk; onder de vinger gebeurt er niets. */
    let bezigMet = null;
    let nogEens = false;
    const naarDienst = () => {
      if (bezigMet) {
        nogEens = true;
        return;
      }
      bezigMet = Promise.resolve()
        .then(() => opties.opslaan(uitvoer()))
        .then(
          () => {
            st.fout = null;
          },
          (e) => {
            st.fout = e?.message ?? String(e);
          },
        )
        .finally(() => {
          bezigMet = null;
          if (nogEens) {
            nogEens = false;
            naarDienst();
            return;
          }
          st.bewaard = !st.fout;
          meld();
        });
    };
    const bewaar = () => {
      st.bewaard = false;
      clearTimeout(bewaarTimer);
      bewaarTimer = setTimeout(() => {
        if (opties.opslaan) return naarDienst();
        if (sleutel) {
          try {
            localStorage.setItem(sleutel, JSON.stringify({ vloeren: Object.fromEntries(Object.entries(st.vloeren).map(([id, v]) => [id, inpakken(v)])), apparaten: st.apparaten, bron: st.bron }));
          } catch {
            // Dan blijft het bij deze keer.
          }
        }
        st.bewaard = true;
        meld();
      }, opties.wacht ?? 700);
    };

    const vloer = () => st.vloeren[st.etage];
    const etageVan = (id) => huis.etages.find((e) => e.id === id);
    if ((erfHersteld || belGezet) && opties.opslaan) setTimeout(() => bewaar(), 0);
    // De etage eronder; buiten (het erf) ligt onder geen enkele etage.
    const onder = () => {
      const lijst = huis.etages.filter((e) => !e.buiten);
      const i = lijst.findIndex((e) => e.id === st.etage);
      return i >= 0 && i < lijst.length - 1 ? lijst[i + 1] : null;
    };
    const naamVan = (r) => (r?.kamer ? kamers[r.kamer]?.naam : r?.naam) ?? null;
    /** Een vast vak (19 november 2026): het huis op het erf. Geen muur te pakken, er gaat niets in, een tik gaat naar binnen. */
    const vastId = (v, id) => id != null && id !== BUITEN && !!opties.vast?.includes(v.ruimtes[id]?.kamer);
    /** De zonelijnen op een vloer: per kamer de lijn en de stukken die in de ruimte liggen. */
    const zonesOp = (v) => {
      const uit = [];
      for (const [kamer, z] of Object.entries(v.zones ?? {})) {
        const id = Number(Object.entries(v.ruimtes).find(([, r]) => r.kamer === kamer)?.[0]);
        if (!id) continue;
        const stukken = zoneStukken(v, id, z.as, z.op);
        if (stukken.length) uit.push({ kamer, id, z, stukken, namen: kamers[kamer]?.zones ?? [] });
      }
      return uit;
    };
    const soortVan = (r) => (r?.kamer ? kamers[r.kamer]?.soort : r?.soort) ?? null;

    /* ---------- terug en vooruit */
    const foto = () => ({ vloeren: Object.fromEntries(Object.entries(st.vloeren).map(([id, v]) => [id, kopie(v)])), apparaten: JSON.parse(JSON.stringify(st.apparaten)), etage: st.etage, bron: st.bron });
    const zetFoto = (f) => {
      st.bron = f.bron;
      zetBlokken();
      st.vloeren = f.vloeren;
      st.apparaten = f.apparaten;
      st.etage = f.etage;
      st.kies = null;
    };
    /** Vóór elke verandering: de stand onthouden. */
    const stap = (f = foto()) => {
      st.terug.push(f);
      if (st.terug.length > 40) st.terug.shift();
      st.vooruit = [];
    };
    const klaar = () => {
      bewaar();
      teken();
      meld();
    };

    /* ---------- kijken: van ruitjes naar het scherm */
    let B = 600;
    let Hpx = 500;
    let kijk = null;
    let k = 1;
    let ox = 0;
    let oy = 0;
    const heleKijk = () => {
      // Het hele huis, over alle etages: in de app kan er een kelder onder de begane grond liggen, op alleen het hoofdhuis.
      // Buiten (het erf) heeft zijn eigen beeld, en telt binnen niet mee (19 november 2026).
      const opErf = !!etageVan(st.etage)?.buiten;
      const os = huis.etages.filter((e) => !!e.buiten === opErf).map((e) => omtrek(st.vloeren[e.id]));
      const o = { x0: Math.min(...os.map((x) => x.x0)), y0: Math.min(...os.map((x) => x.y0)), x1: Math.max(...os.map((x) => x.x1)), y1: Math.max(...os.map((x) => x.y1)) };
      const rand = st.stand === 'vorm' ? 16 : 7;
      if (st.stand === 'vorm') {
        const randpunten = [...omgeving().flatMap((q) => q.punten), ...opErfBlokken().flatMap((q) => [[q.u, q.v], [q.u + q.b, q.v + q.d]])];
        for (const [x, y] of randpunten) {
          o.x0 = Math.min(o.x0, MARGE + x / CEL);
          o.x1 = Math.max(o.x1, MARGE + x / CEL);
          o.y0 = Math.min(o.y0, MARGE + y / CEL);
          o.y1 = Math.max(o.y1, MARGE + y / CEL);
        }
      }
      return { x0: o.x0 - rand, y0: o.y0 - rand - 3, x1: o.x1 + rand, y1: o.y1 + rand };
    };
    /** Het dak bij Dak: wat lager is dan 1,5 m gestreept (niet onder een dakkapel), de nok, en de dakkapellen met hun grepen. */
    const dakLaag = () => {
      const m = dakMaat();
      if (!m) return '';
      const P = (u, w) => [X(MARGE + u / CEL), Y(MARGE + w / CEL)];
      const vak = (u0, v0, u1, v1, extra) => {
        const [x0, y0] = P(u0, v1);
        const [x1, y1] = P(u1, v0);
        return `<rect x="${Math.min(x0, x1).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${Math.abs(x1 - x0).toFixed(1)}" height="${Math.abs(y1 - y0).toFixed(1)}" ${extra}/>`;
      };
      const opAC = (a0, a1, c0, c1, extra) => (m.langs ? vak(c0, a0, c1, a1, extra) : vak(a0, c0, a1, c1, extra));
      let s = `<defs><pattern id="ht-laag" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="rgb(255 255 255 / 0.03)"/><line x1="0" y1="0" x2="0" y2="9" stroke="rgb(255 255 255 / 0.18)" stroke-width="3"/></pattern></defs>`;
      const hier = opDezeEtage();
      const strook = laagStrook(st.etage);
      let label = null;
      for (const kant of [0, 1]) {
        const w = strook[kant];
        if (w < 0.2) continue;
        const [c0, c1] = kant === 0 ? [m.c0, m.c0 + w] : [m.c0 + m.lc - w, m.c0 + m.lc];
        const gaten = hier.filter(({ k }) => k.kant === kant).map(({ k }) => [m.a0 + k.van, m.a0 + k.tot]).sort((x, y) => x[0] - y[0]);
        let a = m.a0;
        const stukken = [];
        for (const [g0, g1] of gaten) {
          if (g0 > a) stukken.push([a, g0]);
          a = Math.max(a, g1);
        }
        if (a < m.a0 + m.la) stukken.push([a, m.a0 + m.la]);
        for (const [a0, a1] of stukken) s += opAC(a0, a1, c0, c1, 'fill="url(#ht-laag)" pointer-events="none"');
        // Het label op het langste stuk, dicht bij de gevel: niet in een dakkapel.
        const lang = stukken.sort((x, y) => y[1] - y[0] - (x[1] - x[0]))[0];
        if (lang && lang[1] - lang[0] > 1.6 && (!label || w > label.w)) label = { w, a: (lang[0] + lang[1]) / 2, c: kant === 0 ? m.c0 + Math.min(w / 2, 0.45) : m.c0 + m.lc - Math.min(w / 2, 0.45) };
      }
      if (label) {
        const [x, y] = m.langs ? P(label.c, label.a) : P(label.a, label.c);
        s += `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" ${FONT} font-size="11.5" font-weight="600" fill="rgb(255 255 255 / 0.6)" pointer-events="none">${esc(T('ht.dakkapel.laag'))}</text>`;
      }
      // De nok: een stippellijn over het huis.
      const nc = m.c0 + m.naar[0];
      const [[nx0, ny0], [nx1, ny1]] = m.langs ? [P(nc, m.a0), P(nc, m.a0 + m.la)] : [P(m.a0, nc), P(m.a0 + m.la, nc)];
      s += `<line x1="${nx0.toFixed(1)}" y1="${ny0.toFixed(1)}" x2="${nx1.toFixed(1)}" y2="${ny1.toFixed(1)}" stroke="rgb(255 255 255 / 0.4)" stroke-width="1.5" stroke-dasharray="3 5" pointer-events="none"/>`;
      s += `<text x="${(Math.max(nx0, nx1) + 8).toFixed(1)}" y="${(Math.min(ny0, ny1) + (m.langs ? -8 : 4)).toFixed(1)}" ${FONT} font-size="11.5" font-weight="700" fill="rgb(255 255 255 / 0.5)" pointer-events="none">${esc(T('ht.dakkapel.nok'))}</text>`;
      // De dakkapellen op deze etage.
      const uitKaart = hoofdBlok()?.kapelBron === 'kaart';
      for (const { k, i } of hier) {
        const r = kapelRecht(k, m);
        const [x0, y0] = P(r.u0, r.v1);
        const [x1, y1] = P(r.u1, r.v0);
        const [l, t2, b, h] = [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)];
        const gekozen = st.kies?.soort === 'kapel' && st.kies.i === i;
        s += `<rect x="${l.toFixed(1)}" y="${t2.toFixed(1)}" width="${b.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="rgb(111 211 255 / ${gekozen ? 0.26 : 0.18})" stroke="#6fd3ff" stroke-width="${gekozen ? 3.5 : 2.5}" ${uitKaart ? 'stroke-dasharray="7 5"' : ''}/>`;
        const [cx, cy] = [l + b / 2, t2 + h / 2];
        s += `<text x="${cx.toFixed(1)}" y="${(cy + 2).toFixed(1)}" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="#eef3f7" pointer-events="none">${esc(T('ht.dakkapel.naam'))}</text>`;
        if (b > 90 && h > 40) s += `<text x="${cx.toFixed(1)}" y="${(cy + 16).toFixed(1)}" text-anchor="middle" ${FONT} font-size="11" font-weight="600" fill="rgb(169 230 255 / 0.85)" pointer-events="none">${esc(T(uitKaart ? 'ht.dakkapel.vanKaart' : 'ht.dakkapel.staan'))}</text>`;
        if (gekozen) {
          // De maat langs de nok, en grepen op de twee zijkanten die je rekt.
          const breed = `${nl(k.tot - k.van)} m`;
          const [px, py] = m.langs ? [l - 34, cy] : [cx, t2 - 20];
          s += `<g transform="translate(${px.toFixed(1)} ${py.toFixed(1)})" pointer-events="none"><rect x="-27" y="-13" width="54" height="26" rx="9" fill="#0b1424" stroke="#6ee7b7" stroke-width="1.5"/><text y="5" text-anchor="middle" ${FONT} font-size="13" font-weight="700" fill="#6ee7b7">${esc(breed)}</text></g>`;
          const grepen = m.langs ? [[cx, t2], [cx, t2 + h]] : [[l, cy], [l + b, cy]];
          for (const [gx, gy] of grepen) s += m.langs ? `<rect x="${(gx - 22).toFixed(1)}" y="${(gy - 5).toFixed(1)}" width="44" height="10" rx="5" fill="#6fd3ff" stroke="#0b1424" stroke-width="2" pointer-events="none"/>` : `<rect x="${(gx - 5).toFixed(1)}" y="${(gy - 22).toFixed(1)}" width="10" height="44" rx="5" fill="#6fd3ff" stroke="#0b1424" stroke-width="2" pointer-events="none"/>`;
        }
      }
      return s;
    };
    /** Welke dakkapel onder de vinger ligt, en of het een zijkant (rekken) is of het midden (schuiven). */
    const kapelOp = (p, tolPx) => {
      const m = dakMaat();
      if (!m) return null;
      const tol = (tolPx * CEL) / k;
      const [u, w] = [(p.x - MARGE) * CEL, (p.y - MARGE) * CEL];
      const [a, c] = m.langs ? [w, u] : [u, w];
      for (const { k: kk, i } of opDezeEtage()) {
        const r = kapelRecht(kk, m);
        const [ra0, ra1, rc0, rc1] = m.langs ? [r.v0, r.v1, r.u0, r.u1] : [r.u0, r.u1, r.v0, r.v1];
        if (a < ra0 - tol || a > ra1 + tol || c < rc0 - tol || c > rc1 + tol) continue;
        const wat = Math.abs(a - ra0) <= tol ? 'van' : Math.abs(a - ra1) <= tol ? 'tot' : 'schuif';
        return { i, wat, m };
      }
      return null;
    };
    const zetKijk = (kk) => {
      kijk = kk;
      k = Math.min(B / (kk.x1 - kk.x0), Hpx / (kk.y1 - kk.y0));
      ox = (B - (kk.x1 - kk.x0) * k) / 2 - kk.x0 * k;
      oy = Hpx - (Hpx - (kk.y1 - kk.y0) * k) / 2 + kk.y0 * k;
    };
    const X = (x) => ox + x * k;
    const Y = (y) => oy - y * k;
    let anim = null;
    const kijkNaar = (doel, meteen) => {
      cancelAnimationFrame(anim);
      if (meteen || !kijk) {
        zetKijk(doel);
        teken();
        return;
      }
      const van = { ...kijk };
      const t0 = performance.now();
      const loop = (t) => {
        const f = Math.min(1, (t - t0) / 260);
        const e = 1 - (1 - f) ** 3;
        zetKijk({ x0: van.x0 + (doel.x0 - van.x0) * e, y0: van.y0 + (doel.y0 - van.y0) * e, x1: van.x1 + (doel.x1 - van.x1) * e, y1: van.y1 + (doel.y1 - van.y1) * e });
        teken();
        if (f < 1) anim = requestAnimationFrame(loop);
      };
      anim = requestAnimationFrame(loop);
    };
    const zoomDoel = () => {
      if (st.eigen) return st.eigen;
      if (st.zoom == null) return heleKijk();
      const m = maten(vloer())[st.zoom];
      if (!m) return heleKijk();
      const rand = Math.max(8, Math.round(Math.max(m.x1 - m.x0, m.y1 - m.y0) * 0.14));
      return { x0: m.x0 - rand, y0: m.y0 - rand, x1: m.x1 + rand, y1: m.y1 + rand };
    };
    function pasAan() {
      const r = svg.getBoundingClientRect();
      B = Math.max(200, Math.round(r.width));
      Hpx = Math.max(200, Math.round(r.height));
      svg.setAttribute('viewBox', `0 0 ${B} ${Hpx}`);
      zetKijk(zoomDoel());
      teken();
    }

    /* ---------- apparaten: waar staan ze */
    const kamerPlek = () => {
      const uit = {};
      for (const [etage, v] of Object.entries(st.vloeren)) for (const [id, r] of Object.entries(v.ruimtes)) if (r.kamer) uit[r.kamer] = { etage, id: Number(id) };
      return uit;
    };
    /** De apparaten van deze etage met hun plek in ruitjes: bewaard, of gekozen naar hun soort. */
    function apparaatPunten() {
      const v = vloer();
      const m = maten(v);
      const waar = kamerPlek();
      const uit = [];
      const zonder = {};
      for (const a of st.apparaten) {
        // Een deel buiten zonder eigen vak (de border in de tuin): zijn apparaten staan in de ruimte zelf (19 november 2026).
        const w = a.kamer ? (waar[a.kamer] ?? (kamers[a.kamer]?.deelVan ? waar[kamers[a.kamer].deelVan] : null)) : null;
        if (!w || w.etage !== st.etage) continue;
        const p = a.plek;
        const zelf = !!p && p.etage === st.etage && v.cel[Math.floor(p.y) * v.W + Math.floor(p.x)] === w.id;
        if (zelf) uit.push({ a, x: p.x, y: p.y, ruimte: w.id, zelf: true });
        // Ook wie zelf een plek heeft telt mee in de verdeling: zo verspringt de rest niet als je er één verzet.
        (zonder[w.id] ??= []).push({ a, zelf });
      }
      for (const [id, lijst] of Object.entries(zonder)) {
        const r = m[id]?.r;
        if (!r) continue;
        const bb = r.x1 - r.x0;
        const dd = r.y1 - r.y0;
        const per = {};
        for (const { a, zelf } of lijst) {
          const groep = a.soort === 'licht' || a.soort === 'rookmelder' ? 'midden' : a.soort === 'airco' ? 'achter' : a.soort === 'screen' ? 'voor' : a.soort === 'meter' || a.soort === 'beweging' || a.soort === 'thermostaat' ? 'rechts' : 'links';
          (per[groep] ??= []).push(zelf ? null : a);
        }
        const zet = (a, x, y) => a && uit.push({ a, x: klem(x, r.x0 + 2, r.x1 - 2), y: klem(y, r.y0 + 2, r.y1 - 2), ruimte: Number(id), zelf: false });
        (per.midden ?? []).forEach((a, i, l) => {
          const kol = l.length <= 3 ? l.length : Math.ceil(l.length / 2);
          const rij = l.length <= 3 ? 0 : Math.floor(i / kol);
          const rijenN = l.length <= 3 ? 1 : 2;
          zet(a, r.x0 + (bb * ((i % kol) + 0.5)) / kol, r.y0 + (dd * (rij + 1)) / (rijenN + 1) - (rijenN === 1 ? dd * 0.08 : 0));
        });
        // Iets uit het midden: daar staat bij twee zones de naam van de tweede.
        (per.achter ?? []).forEach((a, i, l) => zet(a, r.x0 + bb * ((i + 1) / (l.length + 1) + (l.length === 1 ? 0.2 : 0)), r.y1 - 3));
        (per.voor ?? []).forEach((a, i, l) => zet(a, r.x0 + (bb * (i + 1)) / (l.length + 1), r.y0 + 2));
        (per.rechts ?? []).forEach((a, i, l) => zet(a, r.x1 - 3, r.y0 + (dd * (i + 1)) / (l.length + 1)));
        (per.links ?? []).forEach((a, i, l) => zet(a, r.x0 + 3, r.y0 + (dd * (i + 1)) / (l.length + 1)));
      }
      return uit;
    }
    /** Hoe een plek heet in gewone woorden. */
    function plekNaam(p) {
      if (!p.zelf) return T('ht.plek.sunarc');
      const v = vloer();
      const tot = (dx, dy) => {
        let n = 0;
        let x = Math.floor(p.x);
        let y = Math.floor(p.y);
        while (n < 400 && v.cel[y * v.W + x] === p.ruimte) {
          x += dx;
          y += dy;
          n++;
        }
        return n;
      };
      const kanten = [[T('ht.plek.links'), tot(-1, 0)], [T('ht.plek.rechts'), tot(1, 0)], [T('ht.plek.voor'), tot(0, -1)], [T('ht.plek.achter'), tot(0, 1)]].sort((a, b) => a[1] - b[1]);
      return kanten[0][1] <= 5 ? kanten[0][0] : T('ht.plek.midden');
    }

    /* ---------- tekenen */
    svg.classList.add('ht');
    svg.style.touchAction = 'none';
    svg.innerHTML = `<defs><pattern id="ht-leeg" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V3.2" stroke="rgb(247 181 72 / 0.13)" stroke-width="0.7"/></pattern></defs><g data-l="onder"></g><g data-l="vlak"></g><g data-l="namen"></g><g data-l="app"></g><g data-l="over"></g><g data-l="knop"></g>`;
    const laag = (n) => svg.querySelector(`[data-l="${n}"]`);
    const pil = (x, y, tekst, kleur = '#a9e6ff', draai = false) => {
      const bw = tekst.length * 6.9 + 16;
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})${draai ? ' rotate(-90)' : ''}" pointer-events="none"><rect x="${-bw / 2}" y="-12" width="${bw}" height="24" rx="8" fill="#0d1a30" stroke="${kleur}" stroke-opacity="0.55"/><text y="4.5" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="${kleur}">${esc(tekst)}</text></g>`;
    };
    /** Wat er tijdens een gebaar bovenop ligt (een vak in wording, de maten bij een muur). */
    let over = '';

    function teken() {
      if (!kijk) return;
      // Het huis in 3D: de buitenkant van de kaart, de binnenkant uit de tekening (huistekenen-3d.js).
      if (st.stand === 'huis' && global.huistekenen3d) {
        for (const n of ['onder', 'namen', 'app', 'over', 'knop']) laag(n).innerHTML = '';
        laag('vlak').innerHTML = global.huistekenen3d.teken(t, B, Hpx);
        return;
      }
      const v = actie?.voorbeeld ?? vloer();
      const m = maten(v);
      const tf = `translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${k.toFixed(4)} ${(-k).toFixed(4)})`;
      const app = st.stand === 'apparaten';
      const vorm = st.stand === 'vorm';

      // De etage eronder, als stippellijn om muren boven elkaar te zetten.
      const eronder = onder();
      let s = '';
      if (eronder && st.stand === 'kamers') {
        const d = randen(st.vloeren[eronder.id], isMuur).filter((r) => r.soort === 1).map(lijnPad).join('');
        s = `<g transform="${tf}"><path d="${d}" fill="none" stroke="rgb(255 255 255 / 0.2)" stroke-width="1.5" stroke-dasharray="5 6" vector-effect="non-scaling-stroke"/></g>`;
      }
      // Het trapgat: waar de trap van de etage eronder hier uitkomt.
      if (metOpeningen && eronder && st.stand !== 'vorm') {
        const vo = st.vloeren[eronder.id];
        const mo = maten(vo);
        for (const [id, r] of Object.entries(vo.ruimtes)) {
          if (soortVan(r) !== 'trap' || !mo[id]) continue;
          const b = mo[id];
          s += `<g transform="${tf}"><rect x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${b.y1 - b.y0}" fill="rgb(255 255 255 / 0.05)" stroke="#a9e6ff" stroke-opacity="0.6" stroke-width="1.5" stroke-dasharray="6 5" vector-effect="non-scaling-stroke"/></g>`;
          s += `<text x="${X((b.x0 + b.x1) / 2).toFixed(1)}" y="${(Y((b.y0 + b.y1) / 2) + 4).toFixed(1)}" text-anchor="middle" ${FONT} font-size="12" font-weight="700" fill="#a9e6ff" pointer-events="none">${esc(T('ht.trap.gat'))}</text>`;
        }
      }
      laag('onder').innerHTML = s;

      // De ruimtes in hun kleur, en de muren.
      const paden = vlakPaden(v);
      s = `<g transform="${tf}">`;
      // Bij Vorm: de gebouwen van de kaart eromheen, grijs, om aan te wijzen.
      if (vorm) {
        for (const q of omgeving()) {
          const aan = st.kies?.soort === 'omgeving' && st.kies.i === q.i;
          s += `<polygon class="ht-omgeving" points="${q.punten.map(([x, y]) => `${(MARGE + x / CEL).toFixed(1)},${(MARGE + y / CEL).toFixed(1)}`).join(' ')}" fill="${aan ? 'rgb(111 211 255 / 0.22)' : 'rgb(255 255 255 / 0.07)'}" stroke="${aan ? '#6fd3ff' : 'rgb(255 255 255 / 0.35)'}" stroke-width="${aan ? 3 : 1.5}" stroke-dasharray="${aan ? '' : '6 5'}" vector-effect="non-scaling-stroke"/>`;
        }
        // Wat bij je huis hoort maar op het erf staat: een lichte, doorgetrokken rand.
        for (const q of opErfBlokken()) s += `<rect class="ht-op-erf" x="${(MARGE + q.u / CEL).toFixed(1)}" y="${(MARGE + q.v / CEL).toFixed(1)}" width="${(q.b / CEL).toFixed(1)}" height="${(q.d / CEL).toFixed(1)}" fill="rgb(169 230 255 / 0.08)" stroke="#a9e6ff" stroke-opacity="0.7" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
      }
      for (const [id, d] of Object.entries(paden)) {
        const r = v.ruimtes[id];
        const naam = naamVan(r);
        const gekozen = st.kies?.soort === 'ruimte' && st.kies.id === Number(id);
        const doel = actie?.doel === Number(id);
        const dim = app && st.zoom != null && st.zoom !== Number(id);
        const tint = TINT[SOORT_TINT[soortVan(r)] ?? (r?.kamer ? 'woon' : naam ? 'hal' : 'leeg')];
        const sterk = vorm ? 0.1 : doel ? 0.42 : gekozen ? 0.34 : naam ? (dim ? 0.07 : 0.19) : 0.05;
        s += `<path d="${d}" fill="rgb(${tint} / ${sterk})"/>`;
        // Bij Dak geen arcering voor een vak zonder naam: daar zijn de strepen voor wat lager is dan 1,5 m (20 november 2026).
        if (!naam && !vorm && st.stand !== 'dak') s += `<path d="${d}" fill="url(#ht-leeg)" opacity="${dim ? 0.3 : 1}"/>`;
      }
      const muren = randen(v, isMuur);
      const binnen = muren.filter((r) => r.soort === 1).map(lijnPad).join('');
      const buiten = muren.filter((r) => r.soort === 2).map(lijnPad).join('');
      if (!vorm) s += `<path d="${binnen}" fill="none" stroke="#c9d3dc" stroke-width="3" stroke-linecap="square" vector-effect="non-scaling-stroke"/>`;
      s += `<path d="${buiten}" fill="none" stroke="#eef3f7" stroke-width="${vorm ? 6 : 5}" stroke-linecap="square" vector-effect="non-scaling-stroke"/>`;
      if (vorm || st.stand === 'kamers') {
        const bm = buurMuren().map(lijnPad).join('');
        if (bm) s += `<path d="${bm}" fill="none" stroke="#ffb07a" stroke-width="${vorm ? 7 : 6}" vector-effect="non-scaling-stroke"/><path d="${bm}" fill="none" stroke="#0b1424" stroke-width="${vorm ? 7 : 6}" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>`;
      }
      if (metOpeningen && !vorm) s += openingenPad(v);
      if (metOpeningen && !vorm) s += trapPad(v, m);
      // Wat gekozen is: de rand van de ruimte, of de muur zelf.
      if (st.kies?.soort === 'ruimte' && m[st.kies.id]) {
        const id = st.kies.id;
        s += `<path d="${randen(v, (a, b) => ((a === id) !== (b === id) ? 1 : 0)).map(lijnPad).join('')}" fill="none" stroke="#6fd3ff" stroke-width="4" stroke-linecap="square" vector-effect="non-scaling-stroke"/>`;
      }
      if (actie?.doel != null && m[actie.doel]) {
        const id = actie.doel;
        s += `<path d="${randen(v, (a, b) => ((a === id) !== (b === id) ? 1 : 0)).map(lijnPad).join('')}" fill="none" stroke="#6ee7b7" stroke-width="4" stroke-linecap="square" vector-effect="non-scaling-stroke"/>`;
      }
      // Zones: een groene stippellijn in de kamer, geen muur.
      const zones = vorm ? [] : zonesOp(v);
      for (const zz of zones) s += `<path d="${zz.stukken.map(lijnPad).join('')}" fill="none" stroke="#6ee7b7" stroke-width="${actie?.type === 'zone' && actie.kamer === zz.kamer ? 5 : 3}" stroke-dasharray="9 7" vector-effect="non-scaling-stroke"/>`;
      const muur = actie?.type === 'muur' ? actie.nu : st.kies?.soort === 'muur' ? st.kies.run : actie?.kandidaat?.soort === 'muur' && !actie.type ? actie.kandidaat.m : null;
      if (muur) s += `<path d="${lijnPad(muur)}" fill="none" stroke="#6fd3ff" stroke-width="7" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
      s += '</g>';
      // De greep op een gekozen muur: laat zien dat hij te pakken is.
      if (muur) {
        const mid = (muur.van + muur.tot) / 2;
        const gx = muur.as === 'x' ? X(muur.op) : X(mid);
        const gy = muur.as === 'x' ? Y(mid) : Y(muur.op);
        const pijl = muur.as === 'x' ? 'M-5 0h10M-5 0l3-3M-5 0l3 3M5 0l-3-3M5 0l-3 3' : 'M0-5v10M0-5l-3 3M0-5l3 3M0 5l-3-3M0 5l3-3';
        s += `<g transform="translate(${gx.toFixed(1)} ${gy.toFixed(1)})" pointer-events="none"><circle r="15" fill="#6fd3ff"/><path d="${pijl}" stroke="#0b1424" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>`;
      }
      // Het scharnier van de gekozen deur: een stip om te tikken.
      const sp = metOpeningen ? scharnierStip(v) : null;
      if (sp) s += `<g transform="translate(${X(sp.x).toFixed(1)} ${Y(sp.y).toFixed(1)})" pointer-events="none"><circle r="10" fill="#6fd3ff" stroke="#0b1424" stroke-width="2.5"/><path d="M-3.5 -1.5a3.6 3.6 0 1 1 0 3" stroke="#0b1424" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>`;
      // De greep om een gekozen ruimte in zijn geheel te verplaatsen.
      const greep = !actie || actie.type === 'verplaats' ? greepPlek(v) : null;
      if (greep) s += `<g transform="translate(${greep.px.toFixed(1)} ${greep.py.toFixed(1)})" pointer-events="none"><circle r="17" fill="#6fd3ff" stroke="#0b1424" stroke-width="2"/><path d="M-9 0h18M0-9v18M-9 0l3-3M-9 0l3 3M9 0l-3-3M9 0l-3 3M0-9l-3 3M0-9l3 3M0 9l-3-3M0 9l3-3" stroke="#0b1424" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>`;
      laag('vlak').innerHTML = s;

      // De namen: in het grootste rechte stuk van de ruimte.
      s = '';
      for (const [id, mm] of Object.entries(m)) {
        const r = v.ruimtes[id];
        if (!mm.r) continue;
        const naam = naamVan(r);
        const pb = (mm.r.x1 - mm.r.x0) * k;
        const pd = (mm.r.y1 - mm.r.y0) * k;
        const m2 = `${nl(mm.n * CEL * CEL, 0)} m²`;
        const dim = app && st.zoom != null && st.zoom !== Number(id);
        if (vorm) continue;
        if (app) {
          // Bij apparaten staat de naam klein in de hoek: het midden is voor de apparaten.
          // Een kamer met zones heet ook hier naar zijn zones: elke kant van de stippellijn zijn eigen naam.
          const zz = zones.find((x) => x.id === Number(id));
          if (zz) {
            const label = (x, y, tekst) => `<text x="${(X(x) + 9).toFixed(1)}" y="${(Y(y) + 19).toFixed(1)}" ${FONT} font-size="12.5" font-weight="700" fill="rgb(110 231 183 / ${dim ? 0.3 : 0.85})" pointer-events="none">${esc(tekst)}</text>`;
            s += zz.z.as === 'x' ? label(mm.x0, mm.y1, zz.namen[0] ?? '') + label(zz.z.op, mm.y1, zz.namen[1] ?? '') : label(mm.x0, zz.z.op, zz.namen[0] ?? '') + label(mm.x0, mm.y1, zz.namen[1] ?? '');
            continue;
          }
          if (pb > 50 && pd > 26) s += `<text x="${(X(mm.r.x0) + 9).toFixed(1)}" y="${(Y(mm.r.y1) + 19).toFixed(1)}" ${FONT} font-size="12.5" font-weight="700" fill="rgb(255 255 255 / ${dim ? 0.25 : 0.62})" pointer-events="none">${esc(naam ?? '')}</text>`;
          continue;
        }
        // Een kamer met zones heet naar zijn zones, bij de lijn.
        if (zones.some((zz) => zz.id === Number(id)) && !actie?.type) continue;
        const cx = X((mm.r.x0 + mm.r.x1) / 2);
        const cy = Y((mm.r.y0 + mm.r.y1) / 2);
        // Bij Dak alleen de namen, klein en bescheiden: het dak en de dakkapel staan voorop.
        if (st.stand === 'dak') {
          if (naam && pb > naam.length * 7 && pd > 18) s += `<text x="${cx.toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle" ${FONT} font-size="12" font-weight="700" fill="rgb(255 255 255 / 0.4)" pointer-events="none">${esc(naam)}</text>`;
          continue;
        }
        const tekst = naam ?? T('ht.watIsDit');
        const fs = pb < 74 || pd < 44 ? 11.5 : pb > 200 && pd > 120 ? 17 : 14.5;
        if (pb < tekst.length * fs * 0.5 || pd < 18) continue;
        const kleur = naam ? (r.kamer ? '#eef3f7' : 'rgb(255 255 255 / 0.72)') : '#ffd38a';
        // Met de greep in het midden staat de naam erboven, als daar plek is.
        if (greep && st.kies.id === Number(id)) {
          if (pd > 78) s += `<text x="${cx.toFixed(1)}" y="${(cy - 26).toFixed(1)}" text-anchor="middle" ${FONT} font-size="${fs}" font-weight="700" fill="${kleur}" pointer-events="none">${esc(tekst)}</text>`;
          continue;
        }
        const metMaat = pd > 46 && pb > 60;
        s += `<text x="${cx.toFixed(1)}" y="${(cy + (metMaat ? -2 : 4)).toFixed(1)}" text-anchor="middle" ${FONT} font-size="${fs}" font-weight="700" fill="${kleur}" pointer-events="none">${esc(tekst)}</text>`;
        if (metMaat) s += `<text x="${cx.toFixed(1)}" y="${(cy + 15).toFixed(1)}" text-anchor="middle" ${FONT} font-size="11.5" fill="rgb(255 255 255 / 0.5)" pointer-events="none">${m2}${naam && !r.kamer && pb > 150 ? ` · ${esc(T('ht.nietInHA'))}` : ''}</text>`;
      }
      // De namen van de zones aan weerszijden van hun lijn, bij het langste stuk.
      if (!app && !actie?.type) {
        for (const zz of zones) {
          const st2 = zz.stukken.reduce((a, b) => (b.tot - b.van > a.tot - a.van ? b : a));
          if ((st2.tot - st2.van) * k < 60) continue;
          const mid = (st2.van + st2.tot) / 2;
          const [een, twee] = [zz.namen[0] ?? '', zz.namen[1] ?? ''];
          const half = (tekst) => (tekst.length * 6.9 + 16) / 2 + 9;
          if (zz.z.as === 'x') s += pil(X(zz.z.op) - half(een), Y(mid), een, '#6ee7b7') + pil(X(zz.z.op) + half(twee), Y(mid), twee, '#6ee7b7');
          else s += pil(X(mid), Y(zz.z.op) + 19, een, '#6ee7b7') + pil(X(mid), Y(zz.z.op) - 19, twee, '#6ee7b7');
        }
      }
      // De maten van wat gekozen is, of van het hele huis bij Vorm.
      if (!actie?.type) {
        if (vorm) {
          for (const r of muren.filter((x) => x.soort === 2 && x.tot - x.van >= 20)) {
            const mid = (r.van + r.tot) / 2;
            const buitenkant = (r.as === 'x' ? v.cel[Math.floor(mid) * v.W + r.op] : v.cel[r.op * v.W + Math.floor(mid)]) === BUITEN ? 1 : -1;
            s += r.as === 'x' ? pil(X(r.op) + buitenkant * 22, Y(mid), meter(r.tot - r.van), '#6ee7b7', true) : pil(X(mid), Y(r.op) - buitenkant * 20, meter(r.tot - r.van), '#6ee7b7');
          }
        } else if (st.kies?.soort === 'ruimte' && m[st.kies.id]?.r && !app) {
          const r = m[st.kies.id].r;
          // Alleen waar ze de naam niet in de weg zitten; de maat staat ook in het blad.
          if ((r.x1 - r.x0) * k > 150 && (r.y1 - r.y0) * k > 110) {
            s += pil(X((r.x0 + r.x1) / 2), Y(r.y1) + 20, meter(r.x1 - r.x0));
            s += pil(X(r.x0) + 20, Y((r.y0 + r.y1) / 2), meter(r.y1 - r.y0), '#a9e6ff', true);
          }
        }
      }
      // Bij Vorm: wat er naast het hoofdhuis staat, met zijn naam; een gekozen gebouw met een blauwe rand.
      if (vorm && !actie?.type) {
        for (const b of bijBlokken()) {
          const aan = st.kies?.soort === 'blok' && st.kies.id === b.id;
          const [x0, y0, x1, y1] = [X(MARGE + b.u / CEL), Y(MARGE + b.v / CEL), X(MARGE + (b.u + b.b) / CEL), Y(MARGE + (b.v + b.d) / CEL)];
          if (aan) s += `<rect x="${Math.min(x0, x1).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${Math.abs(x1 - x0).toFixed(1)}" height="${Math.abs(y1 - y0).toFixed(1)}" fill="rgb(111 211 255 / 0.14)" stroke="#6fd3ff" stroke-width="3" pointer-events="none"/>`;
          const naam = T(`ht.bron.blok.${b.soort}`);
          const Naam = esc(naam.charAt(0).toUpperCase() + naam.slice(1));
          const past = Math.abs(x1 - x0) > naam.length * 6.5;
          // Op het erf (20 november 2026): de naam met "bij Buiten", erboven als het gebouw te smal is.
          if (opErfBlokken().some((q) => q.id === b.id)) {
            const ty = past ? (y0 + y1) / 2 - 2 : Math.min(y0, y1) - 22;
            s += `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="#a9e6ff" pointer-events="none">${Naam}</text>`;
            s += `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${(ty + 14).toFixed(1)}" text-anchor="middle" ${FONT} font-size="11" font-weight="600" fill="rgb(169 230 255 / 0.75)" pointer-events="none">${esc(T('ht.gebouw.bijBuiten'))}</text>`;
          } else if (past) s += `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${((y0 + y1) / 2 + 4).toFixed(1)}" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="rgb(255 255 255 / 0.7)" pointer-events="none">${Naam}</text>`;
        }
      }
      if (st.stand === 'dak') s += dakLaag();
      laag('namen').innerHTML = s;

      // De apparaten: een rond icoon; dichtbij ook de naam.
      s = '';
      if (app) {
        // Van ver klein genoeg om elkaar niet te dekken; dichtbij groot genoeg voor een vinger.
        const R = klem(k * 3.4, 12, 25);
        const dichtbij = st.zoom != null;
        for (const p of apparaatPunten()) {
          const gekozen = st.kies?.soort === 'apparaat' && st.kies.id === p.a.id;
          const dim = st.zoom != null && st.zoom !== p.ruimte;
          const sleept = actie?.type === 'apparaat' && actie.a.id === p.a.id;
          const x = sleept ? actie.px : X(p.x);
          const y = sleept ? actie.py : Y(p.y);
          const kleur = APP_KLEUR[p.a.soort] ?? '#eef3f7';
          s += `<g class="ht-ap${gekozen ? ' gekozen' : ''}${sleept ? ' sleept' : ''}" data-ap="${esc(p.a.id)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" opacity="${dim ? 0.3 : 1}" style="color: ${kleur}"><circle r="${gekozen || sleept ? R + 3 : R}" fill="#0d1a30" stroke="${gekozen || sleept ? '#6fd3ff' : p.zelf ? 'rgb(255 255 255 / 0.55)' : 'rgb(255 255 255 / 0.28)'}" stroke-width="${gekozen || sleept ? 3 : 1.5}"${p.zelf ? '' : ' stroke-dasharray="3 3"'}/>${ik(APP_ICOON[p.a.soort] ?? p.a.soort).replace('<svg ', `<svg x="${-R * 0.56}" y="${-R * 0.56}" width="${R * 1.12}" height="${R * 1.12}" `)}${(dichtbij && !dim) || gekozen ? `<text y="${R + 15}" text-anchor="middle" ${FONT} font-size="12" font-weight="600" fill="#eef3f7" paint-order="stroke" stroke="#0d1a30" stroke-width="4">${esc(p.a.naam)}</text>` : ''}</g>`;
        }
      }
      laag('app').innerHTML = s;
      laag('over').innerHTML = over;
      // Ingezoomd: een knop terug naar het hele huis.
      const hk = heelKnop();
      laag('knop').innerHTML = hk ? `<g transform="translate(${hk.x} ${hk.y})" pointer-events="none"><rect width="${hk.b}" height="${hk.h}" rx="10" fill="#0d1a30" stroke="#6fd3ff" stroke-opacity="0.7"/><text x="${hk.b / 2}" y="${hk.h / 2 + 4.5}" text-anchor="middle" ${FONT} font-size="13" font-weight="700" fill="#a9e6ff">${esc(T('ht.heleHuis'))}</text></g>` : '';
    }
    /** De deuren, ramen en de voordeur op de plattegrond (in ruitjes, binnen de transform). */
    function openingenPad(v) {
      let s2 = '';
      for (const o of v.openingen ?? []) {
        const mu = openingMuur(v, o);
        if (!mu) continue;
        const gekozen = (st.kies?.soort === 'opening' && st.kies.id === o.id) || actie?.kandidaat?.o?.id === o.id;
        const lijn = (e, a = o.van, b = o.tot) => (o.as === 'x' ? `M${o.op + e} ${a}V${b}` : `M${a} ${o.op + e}H${b}`);
        // Het gat in de muur.
        s2 += `<path d="${lijn(0)}" stroke="#1a2740" stroke-width="${mu === 2 ? 7 : 5}" vector-effect="non-scaling-stroke" fill="none"/>`;
        const kleur = gekozen ? '#6fd3ff' : o.soort === 'raam' || o.soort === 'schuifpui' ? '#a9e6ff' : o.soort === 'voordeur' || o.soort === 'achterdeur' ? '#f7b548' : '#dfe6ec';
        if (o.soort === 'schuifpui') {
          // Twee glazen delen, een beetje verschoven, en binnen een pijl naar waar hij schuift.
          const mid = (o.van + o.tot) / 2;
          const binnenKant = openingBinnen(v, o);
          s2 += `<path d="${lijn(-0.6, o.van, mid + 1.5)}${lijn(0.6, mid - 1.5, o.tot)}" stroke="${kleur}" stroke-width="${gekozen ? 3.2 : 2.4}" vector-effect="non-scaling-stroke" fill="none"/>`;
          const r = o.schuift === 'tot' ? 1 : -1;
          const e = binnenKant * 4;
          const [a0, a1] = [mid - r * 4, mid + r * 4];
          const pt = (langs, uit) => (o.as === 'x' ? `${o.op + uit} ${langs}` : `${langs} ${o.op + uit}`);
          s2 += `<path d="M${pt(a0, e)}L${pt(a1, e)}M${pt(a1 - r * 1.6, e - 1.2)}L${pt(a1, e)}L${pt(a1 - r * 1.6, e + 1.2)}" stroke="${kleur}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill="none"/>`;
        } else if (o.soort === 'raam') {
          s2 += `<path d="${lijn(-0.45)}${lijn(0.45)}" stroke="${kleur}" stroke-width="${gekozen ? 2.6 : 1.8}" vector-effect="non-scaling-stroke" fill="none"/>`;
          // Een screen voor dit raam: een oranje streep aan de buitenkant.
          if (st.apparaten.some((a) => a.raam === o.id && a.plek?.etage === st.etage)) s2 += `<path d="${lijn(-openingBinnen(v, o) * 1.6, o.van + 0.5, o.tot - 0.5)}" stroke="#ff9a6b" stroke-width="2.4" stroke-dasharray="4 3" vector-effect="non-scaling-stroke" fill="none"/>`;
        } else {
          // Een deur: per blad het blad open en de boog waar hij draait; openslaande deuren aan elk eind een blad.
          for (const b of deurBladen(v, o)) {
            const veeg = (b.sx - b.hx) * (b.ly - b.hy) - (b.sy - b.hy) * (b.lx - b.hx) > 0 ? 1 : 0;
            s2 += `<path d="M${b.hx} ${b.hy}L${b.lx} ${b.ly}" stroke="${kleur}" stroke-width="${gekozen ? 3 : 2}" stroke-linecap="round" vector-effect="non-scaling-stroke" fill="none"/>`;
            s2 += `<path d="M${b.sx} ${b.sy}A${b.w} ${b.w} 0 0 ${veeg} ${b.lx} ${b.ly}" stroke="${kleur}" stroke-width="1.2" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" fill="none" opacity="0.8"/>`;
          }
        }
      }
      return s2;
    }
    /**
     * De bladen van een deur, in ruitjes: het scharnier (h), het open blad (l)
     * en waar het blad dicht tegen de muur ligt (s), met de breedte w.
     */
    function deurBladen(v, o) {
      const kant = o.kant ?? openingBinnen(v, o);
      const at = (langs, uit) => (o.as === 'x' ? [o.op + uit, langs] : [langs, o.op + uit]);
      const blad = (h, vrij) => {
        const w = Math.abs(vrij - h);
        const [hx, hy] = at(h, 0);
        const [lx, ly] = at(h, kant * w);
        const [sx, sy] = at(vrij, 0);
        return { hx, hy, lx, ly, sx, sy, w };
      };
      if (o.soort === 'dubbel') {
        const mid = (o.van + o.tot) / 2;
        return [blad(o.van, mid), blad(o.tot, mid)];
      }
      return o.scharnier === 'tot' ? [blad(o.tot, o.van)] : [blad(o.van, o.tot)];
    }
    /** De stip op het scharnier van de gekozen deur: een tik zet het naar het andere eind. */
    function scharnierStip(v) {
      if (st.stand !== 'kamers' || st.kies?.soort !== 'opening') return null;
      const o = (v.openingen ?? []).find((x) => x.id === st.kies.id);
      if (!o || !MET_SCHARNIER.has(o.soort) || !openingMuur(v, o)) return null;
      const b = deurBladen(v, o)[0];
      return { x: b.hx, y: b.hy, o };
    }
    /** De trap: treden dwars op de richting, en een pijl naar boven. */
    function trapPad(v, mm) {
      let s2 = '';
      for (const [id, r] of Object.entries(v.ruimtes)) {
        if (soortVan(r) !== 'trap' || !mm[id]?.r) continue;
        const b = mm[id].r;
        const [rx, ry] = TRAP_RICHTING[r.omhoog ?? 'n'];
        const langs = rx ? [b.x0, b.x1] : [b.y0, b.y1];
        let d = '';
        for (let t2 = langs[0] + 2.5; t2 < langs[1] - 0.5; t2 += 2.5) d += rx ? `M${t2} ${b.y0 + 1}V${b.y1 - 1}` : `M${b.x0 + 1} ${t2}H${b.x1 - 1}`;
        s2 += `<path d="${d}" stroke="rgb(255 255 255 / 0.4)" stroke-width="1.2" vector-effect="non-scaling-stroke" fill="none"/>`;
        // De pijl van onder naar boven.
        const [cx, cy] = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
        const half = ((rx ? b.x1 - b.x0 : b.y1 - b.y0) / 2) * 0.75;
        const [ax, ay, bx, by] = [cx - rx * half, cy - ry * half, cx + rx * half, cy + ry * half];
        const pk = 2.2;
        s2 += `<path d="M${ax} ${ay}L${bx} ${by}M${bx - rx * pk - ry * pk} ${by - ry * pk - rx * pk}L${bx} ${by}L${bx - rx * pk + ry * pk} ${by - ry * pk + rx * pk}" stroke="#a9e6ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill="none"/>`;
      }
      return s2;
    }
    /** Waar de knop Hele huis staat, als er ingezoomd is. */
    function heelKnop() {
      if (!st.eigen) return null;
      const b = T('ht.heleHuis').length * 7.4 + 24;
      return { x: B - b - 10, y: 10, b, h: 32 };
    }

    /* ---------- wat ligt er onder de vinger */
    const punt = (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) * B) / r.width;
      const py = ((e.clientY - r.top) * Hpx) / r.height;
      return { px, py, x: (px - ox) / k, y: (oy - py) / k };
    };
    const ruimteOp = (v, x, y) => {
      const cx = Math.floor(x);
      const cy = Math.floor(y);
      if (cx < 0 || cy < 0 || cx >= v.W || cy >= v.H) return BUITEN;
      return v.cel[cy * v.W + cx];
    };
    /** De deur of het raam vlak bij de vinger, op deze vloer. */
    function openingBij(p, tolPx) {
      const tol = tolPx / k;
      let best = null;
      const v = vloer();
      for (const o of v.openingen ?? []) {
        if (!openingMuur(v, o)) continue;
        const dw = Math.abs((o.as === 'x' ? p.x : p.y) - o.op);
        const l = o.as === 'x' ? p.y : p.x;
        if (dw > tol || l < o.van - 1 || l > o.tot + 1) continue;
        if (!best || dw < best.d) best = { d: dw, o };
      }
      return best?.o ?? null;
    }
    /** De muurlijn waar een opening op ligt (langer of korter dan de opening). */
    const muurVan = (v, o) => randen(v, isMuur).find((r) => r.as === o.as && r.op === o.op && r.van <= o.van && r.tot >= o.tot) ?? null;
    /** Het raam vlak bij een plek (een screen dat je erheen sleept), binnen 80 cm. */
    function raamBij(v, x, y) {
      let best = null;
      for (const o of v.openingen ?? []) {
        if (o.soort !== 'raam' || !openingMuur(v, o)) continue;
        const dw = Math.abs((o.as === 'x' ? x : y) - o.op);
        const l = o.as === 'x' ? y : x;
        const buiten = Math.max(0, o.van - l, l - o.tot);
        const d = Math.hypot(dw, buiten);
        if (d <= 8 && (!best || d < best.d)) best = { d, o };
      }
      return best?.o ?? null;
    }
    function muurBij(p, tolPx) {
      const tol = tolPx / k;
      let best = null;
      for (const r of randen(vloer(), isMuur)) {
        if (r.soort !== (st.stand === 'vorm' ? 2 : 1) && !(metOpeningen && st.stand === 'kamers' && r.soort === 2)) continue;
        const dwars = Math.abs((r.as === 'x' ? p.x : p.y) - r.op);
        const langs = r.as === 'x' ? p.y : p.x;
        // Vlak bij een hoek liever niets pakken dan de verkeerde muur.
        if (dwars > tol || langs < r.van + Math.min(1.5, (r.tot - r.van) / 4) || langs > r.tot - Math.min(1.5, (r.tot - r.van) / 4)) continue;
        // In een smalle ruimte pak je de muur alleen vlak erbij: het midden blijft om de ruimte zelf aan te tikken.
        const vl = vloer();
        const kant = (r.as === 'x' ? p.x : p.y) < r.op ? -1 : 1;
        const lees = (i) => (r.as === 'x' ? ruimteOp(vl, i, langs) : ruimteOp(vl, langs, i));
        if (vastId(vl, lees(r.op - 1)) || vastId(vl, lees(r.op))) continue;
        const eigen = lees(kant < 0 ? r.op - 1 : r.op);
        let breed = 0;
        while (breed < 60 && lees(kant < 0 ? r.op - 1 - breed : r.op + breed) === eigen) breed++;
        if (dwars > Math.max(1, breed * 0.3)) continue;
        if (!best || dwars < best.d) best = { d: dwars, r };
      }
      return best?.r ?? null;
    }
    /** De ruimte waar een ruimte het meest aan grenst: die komt terug waar hij weggaat. Zonder buur: null. */
    function buurVoor(v, id) {
      const tel = {};
      const groot = {};
      const { W, H, cel } = v;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          groot[cel[y * W + x]] = (groot[cel[y * W + x]] ?? 0) + 1;
          if (cel[y * W + x] !== id) continue;
          for (const b of [x > 0 ? cel[y * W + x - 1] : BUITEN, x < W - 1 ? cel[y * W + x + 1] : BUITEN, y > 0 ? cel[(y - 1) * W + x] : BUITEN, y < H - 1 ? cel[(y + 1) * W + x] : BUITEN]) if (b !== BUITEN && b !== id) tel[b] = (tel[b] ?? 0) + 1;
        }
      }
      // Bij gelijke stand de kleinste buur: een kast in de hoek van de hal hoort bij de hal, niet bij de kamer erachter.
      const best = Object.entries(tel).sort((a, b) => b[1] - a[1] || groot[a[0]] - groot[b[0]])[0];
      return best ? Number(best[0]) : null;
    }
    /** Een ruimte is te verplaatsen als hij in een grotere staat of ertegenaan ligt; de grote kamer zelf niet. */
    function verplaatsbaar(v, id) {
      if (vastId(v, id)) return false;
      const b = buurVoor(v, id);
      if (b == null) return false;
      let eigen = 0;
      let buur = 0;
      for (let i = 0; i < v.cel.length; i++) {
        if (v.cel[i] === id) eigen++;
        else if (v.cel[i] === b) buur++;
      }
      return eigen < buur;
    }
    /** Waar de greep staat om een gekozen ruimte te verplaatsen: midden in zijn grootste rechte stuk. */
    function greepPlek(v) {
      if (st.stand !== 'kamers' || st.kies?.soort !== 'ruimte') return null;
      const r = maten(v)[st.kies.id]?.r;
      if (!r || !verplaatsbaar(v, st.kies.id)) return null;
      return { px: X((r.x0 + r.x1) / 2), py: Y((r.y0 + r.y1) / 2) };
    }
    function zoneBij(p, tolPx) {
      const tol = tolPx / k;
      for (const zz of zonesOp(vloer())) {
        for (const r of zz.stukken) {
          const dwars = Math.abs((r.as === 'x' ? p.x : p.y) - r.op);
          const langs = r.as === 'x' ? p.y : p.x;
          if (dwars <= tol && langs >= r.van && langs <= r.tot) return { kamer: zz.kamer, id: zz.id, m: r };
        }
      }
      return null;
    }
    function apparaatBij(p, tolPx) {
      let best = null;
      for (const q of apparaatPunten()) {
        if (st.zoom != null && st.zoom !== q.ruimte) continue;
        const d = Math.hypot(X(q.x) - p.px, Y(q.y) - p.py);
        if (d <= tolPx && (!best || d < best.d)) best = { d, q };
      }
      return best?.q ?? null;
    }
    /** De muurlijnen op deze etage en die eronder: daar klikt een vak of een muur aan vast. */
    function magneten(as, zonder) {
      const uit = new Set();
      for (const r of randen(vloer(), isMuur)) if (r.as === as && r !== zonder && !(zonder && r.op === zonder.op && r.as === zonder.as)) uit.add(r.op);
      const e = onder();
      if (e && st.stand === 'kamers') for (const r of randen(st.vloeren[e.id], isMuur)) if (r.as === as) uit.add(r.op);
      return [...uit];
    }
    const klik = (n, lijst, bereik) => {
      let best = Math.round(n);
      let d = bereik;
      for (const m of lijst) {
        if (Math.abs(n - m) < d) {
          d = Math.abs(n - m);
          best = m;
        }
      }
      return best;
    };

    /* ---------- zoomen: knijpen met twee vingers, of het wieltje */
    /** Hoe groot het hele huis past: verder uitzoomen hoeft niet. */
    const pasK = () => {
      const h = heleKijk();
      return Math.min(B / (h.x1 - h.x0), Hpx / (h.y1 - h.y0));
    };
    /** Zoom naar schaal `k1`, met ruitje `g` onder schermpunt `m`. */
    function zoomNaar(k1, g, m) {
      cancelAnimationFrame(anim);
      const kp = pasK();
      k1 = klem(k1, kp, Math.max(kp * 1.01, 16));
      if (k1 <= kp * 1.03) {
        st.eigen = null;
        zetKijk(zoomDoel());
        return teken();
      }
      const ox1 = m.px - g.x * k1;
      const oy1 = m.py + g.y * k1;
      const r = { x0: -ox1 / k1, x1: (B - ox1) / k1, y0: (oy1 - Hpx) / k1, y1: oy1 / k1 };
      // Het midden van wat je ziet blijft boven het huis.
      const h = heleKijk();
      const cx = (r.x0 + r.x1) / 2;
      const cy = (r.y0 + r.y1) / 2;
      const sx = klem(cx, h.x0, h.x1) - cx;
      const sy = klem(cy, h.y0, h.y1) - cy;
      st.eigen = { x0: r.x0 + sx, x1: r.x1 + sx, y0: r.y0 + sy, y1: r.y1 + sy };
      zetKijk(st.eigen);
      teken();
    }
    const opScherm = (c) => {
      const r = svg.getBoundingClientRect();
      return { px: ((c.x - r.left) * B) / r.width, py: ((c.y - r.top) * Hpx) / r.height };
    };
    /** De vingers die nu op de tekening staan. */
    const wijzers = new Map();
    let knijp = null;
    function beginKnijp() {
      const [a, b] = [...wijzers.values()].map(opScherm);
      const m = { px: (a.px + b.px) / 2, py: (a.py + b.py) / 2 };
      knijp = { ids: [...wijzers.keys()], d0: Math.max(20, Math.hypot(a.px - b.px, a.py - b.py)), k0: k, g: { x: (m.px - ox) / k, y: (oy - m.py) / k } };
    }
    function knijpVerder() {
      const [a, b] = knijp.ids.map((id) => opScherm(wijzers.get(id)));
      const m = { px: (a.px + b.px) / 2, py: (a.py + b.py) / 2 };
      zoomNaar((knijp.k0 * Math.hypot(a.px - b.px, a.py - b.py)) / knijp.d0, knijp.g, m);
    }
    function heelHuis() {
      st.eigen = null;
      kijkNaar(zoomDoel());
    }
    svg.addEventListener(
      'wheel',
      (e) => {
        if (st.stand === 'huis' || actie) return;
        e.preventDefault();
        const m = opScherm({ x: e.clientX, y: e.clientY });
        zoomNaar(k * Math.exp(-e.deltaY * 0.0015), { x: (m.px - ox) / k, y: (oy - m.py) / k }, m);
      },
      { passive: false },
    );

    /* ---------- het gebaar */
    let actie = null;
    function neer(e) {
      if (e.button > 0) return;
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {
        // Een nagebootste vinger kan dat niet; de luisteraars doen het dan nog.
      }
      e.preventDefault();
      wijzers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (wijzers.size > 1) {
        // Een tweede vinger: knijpen en schuiven. Wat de eerste vinger begon, gaat niet door.
        if (wijzers.size === 2 && !knijp && st.stand !== 'huis') {
          if (actie) afgebroken();
          beginKnijp();
        }
        return;
      }
      if (actie || knijp) return;
      const p = punt(e);
      const vinger = e.pointerType !== 'mouse';
      actie = { wijzer: e.pointerId, start: p, vinger, type: null, kandidaat: { soort: 'niets' } };
      if (st.stand === 'huis') {
        // Opzij slepen draait het huis.
        actie.type = 'draai';
        actie.hoek0 = st.hoek;
        return;
      }
      // Dak (stap 4 punt 3): een dakkapel pakken om te schuiven of aan een zijkant te rekken; ernaast tikken laat hem los.
      if (st.stand === 'dak') {
        const raak = kapelOp(p, vinger ? 16 : 8);
        if (raak) {
          Object.assign(actie, { type: 'kapel', kapel: { ...raak, was: { ...st.kapellen[raak.i] } } });
          st.kies = { soort: 'kapel', i: raak.i };
          st.kapelErbij = null;
        } else {
          actie.type = 'niets';
          st.kies = null;
        }
        teken();
        meld();
        return;
      }
      const hk = heelKnop();
      if (hk && p.px >= hk.x - 6 && p.px <= hk.x + hk.b + 6 && p.py >= hk.y - 6 && p.py <= hk.y + hk.h + 6) {
        actie.kandidaat = { soort: 'heel' };
        return;
      }
      // De stip op het scharnier: een tik zet het scharnier aan het andere eind (20 november 2026).
      const sp = metOpeningen ? scharnierStip(vloer()) : null;
      if (sp && Math.hypot(X(sp.x) - p.px, Y(sp.y) - p.py) <= (vinger ? 24 : 14)) {
        actie.kandidaat = { soort: 'scharnier', o: sp.o };
        return;
      }
      // Een deur of raam: aantikken of langs de muur schuiven.
      const op = metOpeningen && st.stand === 'kamers' ? openingBij(p, vinger ? 22 : 10) : null;
      if (op) {
        actie.kandidaat = { soort: 'opening', o: op };
        teken();
        return;
      }
      // Een gekozen ruimte sleep je in zijn geheel weg: overal binnen de ruimte, of aan de greep in het midden.
      const g = greepPlek(vloer());
      const dg = g ? Math.hypot(g.px - p.px, g.py - p.py) : Infinity;
      const opGreep = dg <= (vinger ? 30 : 20);
      if (g && ruimteOp(vloer(), p.x, p.y) === st.kies.id) actie.gekozen = st.kies.id;
      if (opGreep || actie.gekozen != null) {
        // Vlak bij een muur pak je de muur: wat het dichtst bij de vinger ligt, wint (in een klein vak ligt de muur ook bij de greep).
        const mg = muurBij(p, vinger ? 20 : 9);
        const dm = mg ? Math.abs((mg.as === 'x' ? p.x : p.y) - mg.op) * k : Infinity;
        if (dm >= dg || (!opGreep && !mg)) {
          actie.kandidaat = { soort: 'verplaats', id: st.kies.id, greep: opGreep };
          return;
        }
      }
      if (st.stand === 'apparaten') {
        const q = apparaatBij(p, vinger ? 32 : 24);
        if (q) actie.kandidaat = { soort: 'apparaat', q };
      } else {
        const m = muurBij(p, vinger ? 20 : 9);
        const z = !m && st.stand === 'kamers' ? zoneBij(p, vinger ? 20 : 9) : null;
        actie.kandidaat = m ? { soort: 'muur', m } : z ? { soort: 'zone', ...z } : { soort: 'vak' };
        if (m) teken();
      }
    }
    function beweeg(e) {
      if (wijzers.has(e.pointerId)) wijzers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (knijp) {
        if (knijp.ids.includes(e.pointerId)) knijpVerder();
        return;
      }
      if (!actie || e.pointerId !== actie.wijzer) return;
      const p = punt(e);
      const dx = p.px - actie.start.px;
      const dy = p.py - actie.start.py;
      if (actie.type === 'kapel') {
        const { i, wat, m, was } = actie.kapel;
        const da = (m.langs ? p.y - actie.start.y : p.x - actie.start.x) * CEL;
        const breed = was.tot - was.van;
        const kk = st.kapellen[i];
        if (wat === 'schuif') {
          kk.van = r1(klem(was.van + da, 0, m.la - breed));
          kk.tot = r1(kk.van + breed);
        } else if (wat === 'van') kk.van = r1(klem(was.van + da, 0, was.tot - 0.6));
        else kk.tot = r1(klem(was.tot + da, was.van + 0.6, m.la));
        if (Math.abs(da) > 0.05) actie.kapel.verschoven = true;
        teken();
        return;
      }
      if (actie.type === 'draai') {
        st.hoek = klem(actie.hoek0 + dx * 0.35, -65, 65);
        teken();
        return;
      }
      if (!actie.type) {
        if (Math.hypot(dx, dy) < (actie.vinger ? 10 : 5)) return;
        let kd = actie.kandidaat;
        // In een gekozen ruimte bij een muur: recht van de muur af schuift de muur, schuin of erlangs verplaatst de ruimte.
        if (actie.gekozen != null && (kd.soort === 'muur' || kd.soort === 'zone') && !(Math.abs(kd.m.as === 'x' ? dx : dy) > Math.abs(kd.m.as === 'x' ? dy : dx) * 1.4)) {
          kd = actie.kandidaat = { soort: 'verplaats', id: actie.gekozen, greep: false };
        }
        if (kd.soort === 'verplaats') {
          // De ruimte optillen: waar hij stond komt de ruimte terug waar hij het meest aan grenst.
          const v0 = vloer();
          actie.type = 'verplaats';
          actie.cellen = [];
          for (let i = 0; i < v0.cel.length; i++) if (v0.cel[i] === kd.id) actie.cellen.push(i);
          actie.basis = kopie(v0);
          const vul = buurVoor(v0, kd.id);
          for (const c of actie.cellen) actie.basis.cel[c] = vul;
          actie.bb = maten(v0)[kd.id];
          actie.d = [0, 0];
          const lijnen = randen(actie.basis, isMuur);
          actie.mx = [...new Set(lijnen.filter((r) => r.as === 'x').map((r) => r.op))];
          actie.my = [...new Set(lijnen.filter((r) => r.as === 'y').map((r) => r.op))];
        } else if (kd.soort === 'muur') {
          // Recht van de muur af is schuiven; schuin of erlangs is een vak trekken dat bij de muur begint.
          const dwars = Math.abs(kd.m.as === 'x' ? dx : dy);
          const langs = Math.abs(kd.m.as === 'x' ? dy : dx);
          // Buiten is de buitenmuur de erfgrens: die schuif je ook bij Kamers (19 november 2026).
          const opErf = !!etageVan(st.etage)?.buiten;
          if (dwars > langs * 1.4 && !(kd.m.soort === 2 && st.stand === 'kamers' && !opErf)) {
            actie.type = 'muur';
            actie.begin = kopie(vloer());
            actie.ruimte = muurRuimte(actie.begin, kd.m, opErf);
            actie.nu = { ...kd.m };
            actie.magneet = magneten(kd.m.as, kd.m);
          } else actie.type = 'vak';
        } else if (kd.soort === 'zone') {
          const dwars = Math.abs(kd.m.as === 'x' ? dx : dy);
          const langs = Math.abs(kd.m.as === 'x' ? dy : dx);
          if (dwars > langs * 1.4) {
            actie.type = 'zone';
            actie.kamer = kd.kamer;
            actie.nuOp = kd.m.op;
            actie.magneet = magneten(kd.m.as);
          } else actie.type = 'vak';
        } else if (kd.soort === 'opening') {
          actie.type = 'opening';
          actie.begin = foto();
          actie.o0 = { ...kd.o };
          actie.run = muurVan(vloer(), kd.o);
          if (!actie.run) {
            actie.type = 'niets';
            return;
          }
        } else if (kd.soort === 'apparaat') {
          actie.type = 'apparaat';
          actie.a = kd.q.a;
          actie.van = kd.q;
          // De vinger dekt het icoon af: til het er een stukje boven.
          actie.dx = X(kd.q.x) - actie.start.px;
          actie.dy = Y(kd.q.y) - actie.start.py - (actie.vinger ? 30 : 0);
        } else if (kd.soort === 'vak') actie.type = 'vak';
        else if (kd.soort === 'heel') {
          // Van de knop af geschoven: dan niets.
          actie.type = 'niets';
          return;
        } else return;
        if (actie.type === 'vak') {
          const sx = klik(actie.start.x, magneten('x'), 3.2);
          const sy = klik(actie.start.y, magneten('y'), 3.2);
          actie.hoek = { x: sx, y: sy };
          teken();
        }
      }
      if (actie.type === 'opening') {
        const o0 = actie.o0;
        const o = vloer().openingen.find((x) => x.id === o0.id);
        const w = o0.tot - o0.van;
        const van = Math.round(klem(o0.van + (o0.as === 'x' ? -dy : dx) / k, actie.run.van + 1, actie.run.tot - 1 - w));
        if (o && van !== o.van) {
          o.van = van;
          o.tot = van + w;
          st.kies = { soort: 'opening', id: o.id };
          teken();
          meld();
        }
        return;
      }
      if (actie.type === 'muur') {
        const m = actie.kandidaat.m;
        const ruw = m.op + (m.as === 'x' ? dx : -dy) / k;
        const nieuw = klem(klik(ruw, actie.magneet, 1.3), actie.ruimte.min, actie.ruimte.max);
        if (nieuw === actie.nu.op) return;
        actie.nu = { ...m, op: nieuw };
        actie.gelijk = actie.magneet.includes(nieuw);
        actie.voorbeeld = muurNaar(actie.begin, m, nieuw);
        over = muurMaten(actie.voorbeeld, actie.nu, m.as === 'x' ? p.y : p.x, actie.gelijk);
        teken();
        meld();
      } else if (actie.type === 'verplaats') {
        const { bb, basis, cellen } = actie;
        // Een kant van de ruimte klikt vast aan een muur in de buurt.
        const klikKant = (d, lo, hi, lijst) => {
          let best = Math.round(d);
          let afstand = 1.6;
          for (const m of lijst) {
            for (const rand of [lo, hi]) {
              const a = Math.abs(rand + d - m);
              if (a < afstand) {
                afstand = a;
                best = m - rand;
              }
            }
          }
          return best;
        };
        const ddx = klikKant(dx / k, bb.x0, bb.x1, actie.mx);
        const ddy = klikKant(-dy / k, bb.y0, bb.y1, actie.my);
        if (ddx === actie.d[0] && ddy === actie.d[1]) return;
        // Alleen waar hij helemaal in het huis past.
        const W = basis.W;
        const past = cellen.every((c) => {
          const x = (c % W) + ddx;
          const y = ((c / W) | 0) + ddy;
          return x >= 0 && y >= 0 && x < W && y < basis.H && basis.cel[y * W + x] !== BUITEN;
        });
        if (!past) return;
        actie.d = [ddx, ddy];
        const v = kopie(basis);
        for (const c of cellen) v.cel[c + ddy * W + ddx] = actie.kandidaat.id;
        actie.voorbeeld = v;
        const o = omtrek(basis);
        over = pil(X((bb.x0 + bb.x1) / 2 + ddx), Y(bb.y1 + ddy) - 18, T('ht.vanLinksVoor', { links: meter(bb.x0 + ddx - o.x0), voor: meter(bb.y0 + ddy - o.y0) }));
        teken();
      } else if (actie.type === 'zone') {
        // De zonelijn schuift binnen zijn kamer; de muren blijven staan.
        const m = actie.kandidaat.m;
        const mm = maten(vloer())[actie.kandidaat.id];
        const ruw = m.op + (m.as === 'x' ? dx : -dy) / k;
        const [lo, hi] = m.as === 'x' ? [mm.x0 + MIN, mm.x1 - MIN] : [mm.y0 + MIN, mm.y1 - MIN];
        const nieuw = klem(klik(ruw, actie.magneet, 1.3), lo, hi);
        if (nieuw === actie.nuOp) return;
        actie.nuOp = nieuw;
        actie.voorbeeld = kopie(vloer());
        actie.voorbeeld.zones[actie.kamer].op = nieuw;
        const langs = m.as === 'x' ? p.y : p.x;
        const [a, b] = m.as === 'x' ? [nieuw - mm.x0, mm.x1 - nieuw] : [nieuw - mm.y0, mm.y1 - nieuw];
        over = m.as === 'x' ? pil(X(nieuw - a / 2), Y(langs), meter(a), '#6ee7b7') + pil(X(nieuw + b / 2), Y(langs), meter(b), '#6ee7b7') : pil(X(langs), Y(nieuw - a / 2), meter(a), '#6ee7b7') + pil(X(langs), Y(nieuw + b / 2), meter(b), '#6ee7b7');
        teken();
      } else if (actie.type === 'vak') {
        const x = klik(p.x, magneten('x'), 3.2);
        const y = klik(p.y, magneten('y'), 3.2);
        const r = { x0: Math.min(actie.hoek.x, x), y0: Math.min(actie.hoek.y, y), x1: Math.max(actie.hoek.x, x), y1: Math.max(actie.hoek.y, y) };
        actie.recht = r;
        const goed = r.x1 - r.x0 >= MIN - 1 && r.y1 - r.y0 >= MIN - 1;
        const kleur = goed ? '#6fd3ff' : 'rgb(255 255 255 / 0.4)';
        over = `<rect x="${X(r.x0)}" y="${Y(r.y1)}" width="${(r.x1 - r.x0) * k}" height="${(r.y1 - r.y0) * k}" rx="3" fill="rgb(111 211 255 / ${goed ? 0.16 : 0.05})" stroke="${kleur}" stroke-width="2.5" stroke-dasharray="8 6" pointer-events="none"/>`;
        if (goed) over += pil(X((r.x0 + r.x1) / 2), Y((r.y0 + r.y1) / 2), `${nl((r.x1 - r.x0) * CEL)} × ${nl((r.y1 - r.y0) * CEL)} m`);
        laag('over').innerHTML = over;
      } else if (actie.type === 'apparaat') {
        let px = p.px + actie.dx;
        let py = p.py + actie.dy;
        const v = vloer();
        let x = (px - ox) / k;
        let y = (oy - py) / k;
        const id = ruimteOp(v, x, y);
        let muurBijPlek = false;
        if (id !== BUITEN) {
          // Bij een muur klikt het vast, op 20 cm ervan.
          const tot = (ddx, ddy) => {
            let n = 0;
            while (n < 6 && ruimteOp(v, x + ddx * (n + 0.5), y + ddy * (n + 0.5)) === id) n++;
            return n;
          };
          for (const [ddx, ddy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const n = tot(ddx, ddy);
            if (n > 4) continue;
            muurBijPlek = true;
            // De muur ligt op de rand van het eerste ruitje dat niet meer van de ruimte is.
            if (ddx < 0) x = Math.floor(x - n - 0.5) + 1 + 2;
            else if (ddx > 0) x = Math.floor(x + n + 0.5) - 2;
            else if (ddy < 0) y = Math.floor(y - n - 0.5) + 1 + 2;
            else y = Math.floor(y + n + 0.5) - 2;
          }
          px = X(x);
          py = Y(y);
        }
        const kan = id !== BUITEN && !!v.ruimtes[id]?.kamer && !vastId(v, id);
        const anders = actie.doel !== (kan ? id : null);
        actie.doel = kan ? id : null;
        actie.px = px;
        actie.py = py;
        actie.plek = kan ? { etage: st.etage, x, y } : null;
        const naam = id === BUITEN ? T('ht.buitenHuis') : kan ? `${naamVan(v.ruimtes[id])}${muurBijPlek ? ` · ${T('ht.aanDeMuur')}` : ''}` : T('ht.nogGeenKamer');
        over = pil(px, py - 44, naam, kan ? '#6ee7b7' : '#ffb090');
        if (anders) teken();
        else {
          const g = svg.querySelector(`[data-ap="${CSS.escape(actie.a.id)}"]`);
          if (g) g.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
          else teken();
          laag('over').innerHTML = over;
        }
      }
    }
    /** De maten aan weerszijden van een muur, op de hoogte van de vinger. */
    function muurMaten(v, run, langs, gelijk) {
      const j = klem(Math.floor(langs), run.van, run.tot - 1);
      const lees = (i) => (run.as === 'x' ? ruimteOp(v, i, j) : ruimteOp(v, j, i));
      const tel = (start, d) => {
        const id = lees(start);
        let n = 0;
        while (n < 600 && lees(start + d * n) === id && id !== BUITEN) n++;
        return n;
      };
      const a = tel(run.op - 1, -1);
      const b = tel(run.op, 1);
      let s = '';
      const zet = (midden, tekst) => (run.as === 'x' ? pil(X(midden), Y(j + 0.5), tekst) : pil(X(j + 0.5), Y(midden), tekst));
      if (a) s += zet(run.op - a / 2, meter(a));
      if (b) s += zet(run.op + b / 2, meter(b));
      if (gelijk) {
        // Op één lijn met een andere muur: een dunne lijn over het hele huis.
        s += run.as === 'x' ? `<path d="M${X(run.op)} 0V${Hpx}" stroke="#6ee7b7" stroke-opacity="0.6" stroke-dasharray="3 5"/>` : `<path d="M0 ${Y(run.op)}H${B}" stroke="#6ee7b7" stroke-opacity="0.6" stroke-dasharray="3 5"/>`;
      }
      return s;
    }
    /** Een vinger van de tekening af: na het knijpen gebeurt er niets tot ze allebei los zijn. */
    function vingerWeg(id) {
      wijzers.delete(id);
      if (knijp && !wijzers.size) knijp = null;
    }
    function los(e) {
      vingerWeg(e.pointerId);
      if (!actie || e.pointerId !== actie.wijzer) return;
      const a = actie;
      actie = null;
      over = '';
      if (a.type === 'draai') return meld();
      if (a.type === 'niets') return;
      if (a.type === 'kapel') {
        if (a.kapel.verschoven) kapelBewaar();
        teken();
        return meld();
      }
      if (!a.type) return a.kandidaat.soort === 'heel' ? heelHuis() : tik(a);
      if (a.type === 'verplaats') {
        if (a.voorbeeld && (a.d[0] || a.d[1])) {
          stap();
          // Wat in de ruimte een eigen plek had, verhuist mee.
          const inRuimte = new Set(a.cellen);
          for (const dev of st.apparaten) {
            const pl = dev.plek;
            if (pl && pl.etage === st.etage && inRuimte.has(Math.floor(pl.y) * a.basis.W + Math.floor(pl.x))) dev.plek = { ...pl, x: pl.x + a.d[0], y: pl.y + a.d[1] };
          }
          st.vloeren[st.etage] = a.voorbeeld;
          ordenen(vloer());
          st.kies = vloer().ruimtes[a.kandidaat.id] ? { soort: 'ruimte', id: a.kandidaat.id } : null;
        }
        return klaar();
      }
      if (a.type === 'muur') {
        if (a.nu.op !== a.kandidaat.m.op) {
          stap();
          st.vloeren[st.etage] = a.voorbeeld;
          ordenen(vloer());
          st.kies = { soort: 'muur', run: muurOpnieuw(a.nu) };
        }
        return klaar();
      }
      if (a.type === 'opening') {
        const o = vloer().openingen.find((x) => x.id === a.o0.id);
        if (o && o.van !== a.o0.van) stap(a.begin);
        st.kies = { soort: 'opening', id: a.o0.id };
        return klaar();
      }
      if (a.type === 'zone') {
        if (a.voorbeeld) {
          stap();
          vloer().zones[a.kamer].op = a.nuOp;
          st.kies = { soort: 'ruimte', id: a.kandidaat.id };
        }
        return klaar();
      }
      if (a.type === 'vak') {
        const r = a.recht;
        if (r && r.x1 - r.x0 >= MIN - 1 && r.y1 - r.y0 >= MIN - 1) nieuwVak(r);
        else teken();
        return meld();
      }
      if (a.type === 'apparaat') {
        if (a.plek && a.doel != null) {
          stap();
          const dev = st.apparaten.find((x) => x.id === a.a.id);
          const doelKamer = vloer().ruimtes[a.doel].kamer;
          // Binnen de tuin verschoven terwijl zijn deel nog geen vak heeft: het blijft in dat deel.
          const deelVan = dev.kamer ? kamers[dev.kamer]?.deelVan : null;
          dev.kamer = deelVan && deelVan === doelKamer && !kamerPlek()[dev.kamer] ? dev.kamer : doelKamer;
          dev.plek = a.plek;
          if (metOpeningen && dev.soort === 'screen') {
            const r = raamBij(vloer(), a.plek.x, a.plek.y);
            if (r) {
              dev.raam = r.id;
              // Vlak voor het raam, in het midden.
              const kant = openingBinnen(vloer(), r) * (openingMuur(vloer(), r) === 2 ? 1 : 1);
              const mid = (r.van + r.tot) / 2;
              dev.plek = r.as === 'x' ? { etage: st.etage, x: r.op + kant * 3, y: mid } : { etage: st.etage, x: mid, y: r.op + kant * 3 };
            } else delete dev.raam;
          }
          st.kies = { soort: 'apparaat', id: dev.id };
          if (st.zoom != null && st.zoom !== a.doel) st.zoom = a.doel;
        }
        return klaar();
      }
    }
    function afgebroken(e) {
      if (e) vingerWeg(e.pointerId);
      if (!actie || (e && e.pointerId !== actie.wijzer)) return;
      actie = null;
      over = '';
      teken();
      meld();
    }
    /** De muur na het schuiven terugvinden: hij kan langer of korter geworden zijn. */
    function muurOpnieuw(run) {
      const mid = (run.van + run.tot) / 2;
      const soort = st.stand === 'vorm' ? 2 : 1;
      const lijst = randen(vloer(), isMuur).filter((r) => r.as === run.as && r.op === run.op && r.soort === soort);
      return lijst.find((r) => r.van <= mid && r.tot >= mid) ?? lijst[0] ?? null;
    }

    function tik(a) {
      const p = a.start;
      const v = vloer();
      const id = ruimteOp(v, p.x, p.y);
      // Het huis op het erf: een tik geeft zijn blad, met de weg naar binnen (20 november 2026: eerst sprong hij meteen naar de begane grond, ook als je aan het tekenen was).
      if (vastId(v, id) && a.kandidaat.soort !== 'apparaat') {
        st.blad = null;
        st.kies = { soort: 'erfhuis', id };
        teken();
        return meld();
      }
      if (st.stand === 'apparaten') {
        if (a.kandidaat.soort === 'apparaat') {
          st.kies = { soort: 'apparaat', id: a.kandidaat.q.a.id };
        } else if (id !== BUITEN && st.wapen?.apparaat && v.ruimtes[id]?.kamer) {
          // Een apparaat uit de lijst gekozen, dan de kamer aangetikt: daar staat het.
          zetApparaat(st.wapen.apparaat, v.ruimtes[id].kamer, { etage: st.etage, x: p.x, y: p.y });
          return;
        } else if (id !== BUITEN && id !== st.zoom) {
          st.zoom = id;
          st.eigen = null;
          st.kies = { soort: 'ruimte', id };
          kijkNaar(zoomDoel());
        } else if (id === BUITEN && st.zoom != null) {
          st.zoom = null;
          st.eigen = null;
          st.kies = null;
          kijkNaar(zoomDoel());
        } else st.kies = id !== BUITEN ? { soort: 'ruimte', id } : null;
        teken();
        return meld();
      }
      if (a.kandidaat.soort === 'verplaats' && a.kandidaat.greep) return teken();
      if (a.kandidaat.soort === 'scharnier') {
        stap();
        a.kandidaat.o.scharnier = a.kandidaat.o.scharnier === 'tot' ? 'van' : 'tot';
        return klaar();
      }
      if (a.kandidaat.soort === 'opening') st.kies = { soort: 'opening', id: a.kandidaat.o.id };
      else if (a.kandidaat.soort === 'muur') st.kies = { soort: 'muur', run: a.kandidaat.m, bij: a.kandidaat.m.as === 'x' ? p.y : p.x };
      else if (a.kandidaat.soort === 'zone') st.kies = { soort: 'ruimte', id: a.kandidaat.id };
      else if (st.stand === 'vorm') st.kies = gebouwOp(p.x, p.y);
      else if (id === BUITEN) st.kies = null;
      else if (st.wapen?.kamer) {
        noem(id, { kamer: st.wapen.kamer });
        return;
      } else st.kies = st.kies?.soort === 'ruimte' && st.kies.id === id ? null : { soort: 'ruimte', id };
      teken();
      meld();
    }

    svg.addEventListener('pointerdown', neer);
    svg.addEventListener('pointermove', beweeg);
    svg.addEventListener('pointerup', los);
    svg.addEventListener('pointercancel', afgebroken);
    svg.addEventListener('lostpointercapture', (e) => {
      // Kwijt zonder loslaten (een melding eroverheen): terug naar hoe het was.
      setTimeout(() => {
        vingerWeg(e.pointerId);
        if (actie && actie.wijzer === e.pointerId) afgebroken();
      }, 50);
    });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => pasAan()).observe(svg);

    /* ---------- wat je kunt doen */
    function nieuwVak(r) {
      const v = kopie(vloer());
      const id = v.volg++;
      v.ruimtes[id] = {};
      let n = vulRecht(v, r.x0, r.y0, r.x1, r.y1, id, st.stand === 'vorm' ? 'alleen' : false);
      // Over het huis op het erf heen trek je geen vak: dat blijft staan.
      const was = vloer();
      for (let i = 0; i < v.cel.length; i++) {
        if (v.cel[i] === id && vastId(was, was.cel[i])) {
          v.cel[i] = was.cel[i];
          n--;
        }
      }
      if (n <= 0) return teken();
      stap();
      // Wat helemaal onder het nieuwe vak verdween, geeft zijn naam eraan door: dan was het vak over die ruimte heen getrokken.
      const oud = vloer();
      const weg = Object.keys(oud.ruimtes).filter((x) => !v.cel.includes(Number(x)));
      if (weg.length === 1) v.ruimtes[id] = { ...oud.ruimtes[weg[0]] };
      ordenen(v);
      st.vloeren[st.etage] = v;
      if (st.wapen?.kamer && !v.ruimtes[id].kamer) {
        for (const x of Object.values(v.ruimtes)) if (x.kamer === st.wapen.kamer) delete x.kamer;
        v.ruimtes[id] = { kamer: st.wapen.kamer };
        st.wapen = null;
      }
      st.kies = st.stand === 'vorm' ? null : { soort: 'ruimte', id };
      klaar();
    }
    /** Zeggen wat een ruimte is. Stond die kamer al ergens, dan wisselen ze. */
    function noem(id, wat) {
      const v = vloer();
      if (!v.ruimtes[id]) return;
      stap();
      const oud = { ...v.ruimtes[id] };
      if (wat.kamer) {
        const ander = Object.entries(v.ruimtes).find(([x, r]) => Number(x) !== id && r.kamer === wat.kamer);
        if (ander) v.ruimtes[ander[0]] = { ...oud, blok: v.ruimtes[ander[0]].blok };
      }
      v.ruimtes[id] = wat.kamer ? { kamer: wat.kamer } : wat.naam ? { naam: wat.naam, soort: wat.soort } : {};
      st.wapen = null;
      st.kies = { soort: 'ruimte', id };
      klaar();
    }
    /** Twee ruimtes worden één: de muur ertussen is weg. `blijft` houdt zijn naam. */
    function voegSamen(blijft, weg) {
      const v = vloer();
      stap();
      for (let i = 0; i < v.cel.length; i++) if (v.cel[i] === weg) v.cel[i] = blijft;
      ordenen(v);
      st.kies = { soort: 'ruimte', id: blijft };
      klaar();
    }
    /** De ruimtes die een muur delen met deze. */
    function buren(id) {
      const v = vloer();
      const uit = new Set();
      for (let y = 0; y < v.H; y++) {
        for (let x = 0; x < v.W; x++) {
          if (v.cel[y * v.W + x] !== id) continue;
          for (const b of [x > 0 ? v.cel[y * v.W + x - 1] : BUITEN, x < v.W - 1 ? v.cel[y * v.W + x + 1] : BUITEN, y > 0 ? v.cel[(y - 1) * v.W + x] : BUITEN, y < v.H - 1 ? v.cel[(y + 1) * v.W + x] : BUITEN]) if (b !== BUITEN && b !== id) uit.add(b);
        }
      }
      return [...uit];
    }
    /** Wat er aan weerszijden van de gekozen muur ligt, halverwege. */
    function muurKanten(run) {
      const v = vloer();
      const j = Math.floor((run.van + run.tot) / 2);
      const a = run.as === 'x' ? ruimteOp(v, run.op - 1, j) : ruimteOp(v, j, run.op - 1);
      const b = run.as === 'x' ? ruimteOp(v, run.op, j) : ruimteOp(v, j, run.op);
      return [a, b];
    }
    function muurWeg() {
      if (st.kies?.soort !== 'muur') return;
      const [a, b] = muurKanten(st.kies.run);
      if (a === BUITEN || b === BUITEN) return;
      const v = vloer();
      const m = maten(v);
      // De ruimte met een kamer blijft; bij twee de grootste.
      const sterk = (id) => (v.ruimtes[id]?.kamer ? 2 : naamVan(v.ruimtes[id]) ? 1 : 0) * 1e6 + (m[id]?.n ?? 0);
      const [blijft, weg] = sterk(a) >= sterk(b) ? [a, b] : [b, a];
      voegSamen(blijft, weg);
    }
    /** De gekozen muur een stap, of naar een maat vanaf de gevel. */
    function muurZet(nieuw) {
      if (st.kies?.soort !== 'muur') return;
      const run = st.kies.run;
      const begin = kopie(vloer());
      const ruimte = muurRuimte(begin, run, !!etageVan(st.etage)?.buiten);
      const op = klem(Math.round(nieuw), ruimte.min, ruimte.max);
      if (op === run.op) return;
      stap();
      st.vloeren[st.etage] = muurNaar(begin, run, op);
      ordenen(vloer());
      st.kies = { soort: 'muur', run: muurOpnieuw({ ...run, op }) };
      klaar();
    }
    /** Een ruimte weghalen: hij wordt weer deel van de ruimte waar hij het meest aan grenst. */
    function haalWeg(id) {
      const v = vloer();
      if (!v.ruimtes[id]) return;
      const b = buurVoor(v, id);
      stap();
      if (b == null) v.ruimtes[id] = {};
      else {
        for (let i = 0; i < v.cel.length; i++) if (v.cel[i] === id) v.cel[i] = b;
        ordenen(v);
      }
      st.kies = null;
      klaar();
    }
    /**
     * Een andere bron voor de buitenkant: de gebouwen van die bron. De kamers
     * blijven staan waar ze nog in het huis vallen; wat erbij komt is een vak
     * zonder naam.
     */
    function kiesBron(id) {
      if (!huis.bronnen?.[id] || id === st.bron) return;
      stap();
      st.bron = id;
      st.eigen = null;
      zetBlokken();
      for (const e of huis.etages) {
        const oud = st.vloeren[e.id];
        const nv = nieuweVloer(huis.maat, e.blokken);
        const erbij = nv.volg;
        for (let i = 0; i < nv.cel.length; i++) if (nv.cel[i] !== BUITEN && oud.cel[i] !== BUITEN) nv.cel[i] = oud.cel[i] + erbij;
        for (const [rid, r] of Object.entries(oud.ruimtes)) nv.ruimtes[Number(rid) + erbij] = r;
        nv.volg = erbij + oud.volg;
        nv.zones = oud.zones ?? {};
        ordenen(nv);
        st.vloeren[e.id] = nv;
      }
      st.kies = null;
      zetKijk(zoomDoel());
      klaar();
    }
    /** De zones van een kamer als lijn: in het midden beginnen, draaien, of weg. */
    function zetZone(kamer, wat) {
      const v = vloer();
      const id = Number(Object.entries(v.ruimtes).find(([, r]) => r.kamer === kamer)?.[0]);
      if (!id) return;
      stap();
      if (wat === 'weg') delete v.zones[kamer];
      else {
        const as = wat === 'draai' ? (v.zones[kamer]?.as === 'x' ? 'y' : 'x') : 'x';
        // Begin waar de lijn het langst is: in het midden van de hele kamer.
        const m = maten(v)[id];
        v.zones[kamer] = { as, op: Math.round(as === 'x' ? (m.x0 + m.x1) / 2 : (m.y0 + m.y1) / 2) };
      }
      st.kies = { soort: 'ruimte', id };
      klaar();
    }
    function zetApparaat(id, kamer, plek) {
      const dev = st.apparaten.find((x) => x.id === id);
      if (!dev) return;
      stap();
      dev.kamer = kamer;
      if (plek) dev.plek = plek;
      else delete dev.plek;
      st.wapen = null;
      const w = kamerPlek()[kamer];
      if (w && w.etage !== st.etage) {
        st.etage = w.etage;
        st.zoom = null;
      }
      st.kies = { soort: 'apparaat', id };
      klaar();
    }
    function kiesIndeling(i) {
      const e = etageVan(st.etage);
      const lijst = indelingen(huis.kamers.filter((x) => x.etage === st.etage), e.blokken);
      if (!lijst[i]) return;
      stap();
      st.vloeren[st.etage] = vloerUitIndeling(huis.maat, e.blokken, lijst[i].bomen);
      st.kies = null;
      klaar();
    }
    /** De muren van de etage eronder overnemen, zonder namen. */
    function zoalsBeneden() {
      const e = onder();
      if (!e) return;
      stap();
      const v = vloer();
      const b = st.vloeren[e.id];
      const om = {};
      for (let i = 0; i < v.cel.length; i++) {
        if (v.cel[i] === BUITEN || b.cel[i] === BUITEN) continue;
        om[b.cel[i]] ??= v.volg++;
        v.cel[i] = om[b.cel[i]];
      }
      const houd = { ...v.ruimtes };
      v.ruimtes = {};
      for (const id of new Set(v.cel)) if (id !== BUITEN) v.ruimtes[id] = Object.values(om).includes(id) ? {} : (houd[id] ?? {});
      ordenen(v);
      st.kies = null;
      klaar();
    }
    function leeg() {
      stap();
      st.vloeren[st.etage] = nieuweVloer(huis.maat, etageVan(st.etage).blokken);
      st.kies = null;
      klaar();
    }
    /** Buiten opnieuw vanaf de kaart (20 november 2026, Ricardo): het erf, het huis en de gebouwen zoals de eerste keer; Stap terug haalt het terug. */
    function vanKaart() {
      const e = etageVan(st.etage);
      if (!e?.buiten) return;
      stap();
      st.vloeren[e.id] = huis.begin?.[e.id] ? vloerUitIndeling(huis.maat, e.blokken, huis.begin[e.id]) : nieuweVloer(huis.maat, e.blokken);
      st.kies = null;
      st.zoom = null;
      klaar();
    }

    const t = {
      CEL,
      huis,
      st,
      kamers,
      op: (f) => luisteraars.push(f),
      /** Het blad en de rest opnieuw, als de pagina iets veranderde (de kaarten zoeken). */
      ververs: () => meld(),
      teken,
      pasAan,
      vloer,
      maten: () => maten(vloer()),
      omtrek: () => omtrek(vloer()),
      naamVan,
      soortVan,
      buren,
      muurKanten,
      apparaatPunten,
      plekNaam,
      kamerPlek,
      bezig: () => actie,
      heelHuis,
      /** Naar een andere pagina (de app): `verborgen`, of `apparaat` met { id, kamer }. Weg in de schets. */
      naar: opties.naar ?? null,
      /**
       * Stap 3 (Kamers en indeling weg): de indeling van de pagina, als die er is. `gegevens()` geeft wat de
       * bladen tonen (etage, buiten, soorten, verborgen), `doe(actie, waarde)` bewaart. Zonder (de schets) geen bladen.
       */
      indeling: opties.indeling ?? null,
      /** Vaste vakken (het huis op het erf): niet in de lijsten. */
      vast: opties.vast ?? [],
      /** Nu bewaren, ook zonder dat er iets veranderde: wat de kaart voorstelde, klopt (19 november 2026). */
      bewaarNu() {
        bewaar();
        meld();
      },
      /** Een blad van de indeling tonen, of weer weg (null). */
      toonBlad(naam) {
        st.blad = naam ? { naam, etage: st.etage, stand: st.stand } : null;
        st.kies = null;
        meld();
      },
      /** Stap 4: de kaarten vragen (na de melding), als de pagina dat kan. */
      kijk: opties.kijk ?? null,
      metOpeningen,
      openingMuur: (o) => openingMuur(vloer(), o),
      /** Een deur, raam of voordeur op de gekozen muur, waar je tikte. */
      plaatsOpening(soort) {
        const kz = st.kies;
        if (kz?.soort !== 'muur' || !kz.run) return;
        const run = kz.run;
        const w = Math.min(OPENING_BREED[soort] ?? 9, run.tot - run.van - 2);
        if (w < 5) return;
        const mid = kz.bij ?? (run.van + run.tot) / 2;
        const van = Math.round(klem(mid - w / 2, run.van + 1, run.tot - 1 - w));
        const v = vloer();
        stap();
        const lijst = v.openingen ?? [];
        const id = `o${Math.max(0, ...lijst.map((o) => Number(o.id.slice(1)) || 0)) + 1}`;
        v.openingen = [...lijst, { id, soort, as: run.as, op: run.op, van, tot: van + w }];
        st.kies = { soort: 'opening', id };
        // Een voordeur erbij: de deurbel komt ernaast, als hij nog geen plek had.
        if (soort === 'voordeur') deurbelBijVoordeur();
        klaar();
      },
      /** De gekozen opening een andere soort, scharnier, kant of schuifrichting (20 november 2026). */
      openingZet(wat, w) {
        const v = vloer();
        const o = (v.openingen ?? []).find((x) => x.id === st.kies?.id);
        if (!o) return;
        stap();
        if (wat === 'soort' && OPENING_SOORTEN.includes(w)) {
          const was = o.soort;
          o.soort = w;
          // Breder of smaller als de soort een andere maat heeft, om het midden, binnen de muur.
          const run = muurVan(v, o);
          if (run && (OPENING_BREED[w] ?? 9) !== (OPENING_BREED[was] ?? 9)) {
            const bw = Math.min(OPENING_BREED[w] ?? 9, run.tot - run.van - 2);
            const van = Math.round(klem((o.van + o.tot) / 2 - bw / 2, run.van + 1, run.tot - 1 - bw));
            o.van = van;
            o.tot = van + bw;
          }
          if (w !== 'raam') for (const a of st.apparaten) if (a.raam === o.id) delete a.raam;
          if (w === 'voordeur') deurbelBijVoordeur();
        } else if (wat === 'scharnier' && (w === 'van' || w === 'tot')) o.scharnier = w;
        else if (wat === 'kant' && (w === '1' || w === '-1')) o.kant = Number(w);
        else if (wat === 'schuift' && (w === 'van' || w === 'tot')) o.schuift = w;
        klaar();
      },
      openingKant: (o) => o.kant ?? openingBinnen(vloer(), o),
      openingBinnen: (o) => openingBinnen(vloer(), o),
      /** De gekozen opening breder (+1) of smaller (-1), tien centimeter per stap, om zijn midden. */
      openingBreed(d) {
        const v = vloer();
        const o = (v.openingen ?? []).find((x) => x.id === st.kies?.id);
        const run = o && muurVan(v, o);
        if (!run) return;
        const w = klem(o.tot - o.van + d, 5, Math.min(40, run.tot - run.van - 2));
        const van = Math.round(klem((o.van + o.tot) / 2 - w / 2, run.van + 1, run.tot - 1 - w));
        if (w === o.tot - o.van && van === o.van) return;
        stap();
        o.van = van;
        o.tot = van + w;
        klaar();
      },
      openingWeg() {
        const v = vloer();
        const id = st.kies?.id;
        if (!(v.openingen ?? []).some((x) => x.id === id)) return;
        stap();
        v.openingen = v.openingen.filter((x) => x.id !== id);
        for (const a of st.apparaten) if (a.raam === id) delete a.raam;
        st.kies = null;
        klaar();
      },
      /** De trap in een ruimte: naar welke kant hij omhoog gaat. */
      zetTrap(id, richting) {
        const r = vloer().ruimtes[id];
        if (!r || !TRAP_RICHTING[richting]) return;
        stap();
        r.omhoog = richting;
        klaar();
      },
      /** 0.185.0: een gebouw van de kaart erbij ({ erbij, soort }) of weg ({ weg }); de pagina bewaart en laadt opnieuw. */
      gebouw: opties.gebouw ?? null,
      omgeving,
      /** Een gebouw weg: zijn ruitjes op de begane grond worden weer buiten, en de tekening wordt bewaard. */
      blokWeg(id) {
        const b = bijBlokken().find((q) => q.id === id);
        const beneden = huis.beneden ?? huis.etages.at(-1)?.id;
        const v = b && st.vloeren[beneden];
        if (!v) return;
        stap();
        const rest = huis.etages.find((e) => e.id === beneden).blokken.filter((q) => q.id !== id);
        const inRest = (x, y) => rest.some((q) => x >= MARGE + q.u / CEL && x < MARGE + (q.u + q.b) / CEL && y >= MARGE + q.v / CEL && y < MARGE + (q.v + q.d) / CEL);
        for (let y = Math.round(MARGE + b.v / CEL); y < Math.round(MARGE + (b.v + b.d) / CEL); y++) for (let x = Math.round(MARGE + b.u / CEL); x < Math.round(MARGE + (b.u + b.b) / CEL); x++) if (!inRest(x, y)) v.cel[y * v.W + x] = BUITEN;
        ordenen(v);
        st.kies = null;
        klaar();
      },
      zetStand(s) {
        // Vorm en het huis in 3D gaan over het huis zelf: vanaf buiten naar de begane grond.
        if ((s === 'vorm' || s === 'huis') && etageVan(st.etage)?.buiten) st.etage = huis.beneden ?? huis.etages.filter((e) => !e.buiten).at(-1)?.id;
        // Dak (stap 4 punt 3): de etage onder het dak, als je niet al op een etage onder het schuine dak stond.
        if (s === 'dak' && !kapelEtages().includes(st.etage)) st.etage = dakEtage() ?? st.etage;
        st.kapelErbij = null;
        st.stand = s;
        st.kies = null;
        st.wapen = null;
        st.zoom = null;
        st.eigen = null;
        kijkNaar(zoomDoel());
        meld();
      },
      zetEtage(id) {
        st.etage = id;
        if (etageVan(id)?.buiten && (st.stand === 'vorm' || st.stand === 'huis' || st.stand === 'dak')) st.stand = 'kamers';
        // Bij Huis zet een etage aantikken die etage open, ook als het huis dicht was.
        if (st.stand === 'huis') st.dicht = false;
        st.kies = null;
        st.wapen = null;
        st.zoom = null;
        kijkNaar(zoomDoel(), true);
        meld();
      },
      kies(k2) {
        st.kies = k2;
        teken();
        meld();
      },
      wapen(w) {
        st.wapen = w;
        st.kies = null;
        teken();
        meld();
      },
      zoom(id) {
        st.zoom = id;
        st.eigen = null;
        if (id != null) st.kies = { soort: 'ruimte', id };
        kijkNaar(zoomDoel());
        meld();
      },
      noem,
      vak: nieuwVak,
      haalWeg,
      kiesBron,
      /** Of een gebouw bij Vorm op het erf staat (20 november 2026), en de etage Buiten. */
      opErf: (id) => opErfBlokken().some((q) => q.id === id),
      erfEtage: () => huis.etages.find((e) => e.buiten)?.id ?? null,
      buurVoor: (id) => buurVoor(vloer(), id),
      verplaatsbaar: (id) => verplaatsbaar(vloer(), id),
      zones: () => zonesOp(vloer()),
      /** In welke zone een apparaat staat: aan welke kant van de stippellijn. */
      zoneVan(p) {
        const zz = zonesOp(vloer()).find((x) => x.id === p.ruimte);
        return zz ? (zz.namen[(zz.z.as === 'x' ? p.x : p.y) < zz.z.op ? 0 : 1] ?? null) : null;
      },
      bronPlaatje: (id, b, h) => klein(nieuweVloer(huis.maat, huis.bronnen[id].blokken), kamers, b, h),
      zetZone,
      MARGE,
      voegSamen,
      muurWeg,
      muurZet,
      zetApparaat,
      kiesIndeling,
      zoalsBeneden,
      leeg,
      vanKaart,
      /* Het dak en de dakkapellen (stap 4 punt 3). */
      dakMaat,
      dakEtage,
      kapelEtages,
      laagStrook,
      vloerHoogte,
      hoofdBlok,
      opBuurMuur,
      kapelErbij() {
        const m = dakMaat();
        if (!m) return;
        const strook = laagStrook(st.etage);
        st.kapelErbij = { kant: strook[1] >= strook[0] ? 1 : 0, etage: kapelEtages().includes(st.etage) ? st.etage : dakEtage() };
        st.kies = null;
        teken();
        meld();
      },
      kapelKeus(wat, w) {
        if (!st.kapelErbij) return;
        st.kapelErbij = { ...st.kapelErbij, [wat]: wat === 'kant' ? Number(w) : w };
        meld();
      },
      kapelZet() {
        const m = dakMaat();
        const keus = st.kapelErbij;
        if (!m || !keus) return;
        const breed = r1(Math.min(3, Math.max(0.6, m.la - 1)));
        const van = r1((m.la - breed) / 2);
        const diep = r1(Math.max(0.5, Math.min(2, m.naar[keus.kant] - 0.6)));
        st.kapellen.push({ kant: keus.kant, van, tot: r1(van + breed), diep, etage: keus.etage === dakEtage() ? null : keus.etage });
        st.kapelErbij = null;
        if (st.etage !== (keus.etage ?? dakEtage())) st.etage = keus.etage ?? dakEtage();
        st.kies = { soort: 'kapel', i: st.kapellen.length - 1 };
        kapelBewaar();
        teken();
        meld();
      },
      kapelNiet() {
        st.kapelErbij = null;
        meld();
      },
      kapelAnders(i, wat, d) {
        const m = dakMaat();
        const kk = st.kapellen[i];
        if (!m || !kk) return;
        if (wat === 'kant') kk.kant = kk.kant === 0 ? 1 : 0;
        else if (wat === 'etage') {
          const lijst = kapelEtages();
          const nu = kk.etage ?? dakEtage();
          const volgende = lijst[(lijst.indexOf(nu) + 1) % Math.max(1, lijst.length)] ?? nu;
          kk.etage = volgende === dakEtage() ? null : volgende;
          st.etage = volgende;
        } else if (wat === 'breed') {
          const breed = klem(r1(kk.tot - kk.van + d), 0.6, m.la);
          kk.tot = r1(Math.min(m.la, kk.van + breed));
          kk.van = r1(kk.tot - breed);
        } else if (wat === 'diep') kk.diep = r1(klem(kk.diep + d, 0.5, Math.max(0.5, m.naar[kk.kant] - 0.3)));
        kapelBewaar();
        teken();
        meld();
      },
      kapelWeg(i) {
        st.kapellen.splice(i, 1);
        st.kies = null;
        kapelBewaar();
        teken();
        meld();
      },
      indelingen: () => indelingen(huis.kamers.filter((x) => x.etage === st.etage), etageVan(st.etage).blokken),
      plaatje: (i, b, h) => {
        const e = etageVan(st.etage);
        const lijst = indelingen(huis.kamers.filter((x) => x.etage === st.etage), e.blokken);
        return lijst[i] ? klein(vloerUitIndeling(huis.maat, e.blokken, lijst[i].bomen), kamers, b, h) : '';
      },
      /** Nog niets ingedeeld: elke ruimte is nog een heel blok zonder naam. */
      isLeeg: () => !etageVan(st.etage)?.buiten && Object.values(vloer().ruimtes).every((r) => !r.kamer && !r.naam) && Object.keys(vloer().ruimtes).length <= etageVan(st.etage).blokken.length,
      terug() {
        const f = st.terug.pop();
        if (!f) return;
        st.vooruit.push(foto());
        zetFoto(f);
        st.zoom = null;
        zetKijk(zoomDoel());
        klaar();
      },
      vooruit() {
        const f = st.vooruit.pop();
        if (!f) return;
        st.terug.push(foto());
        zetFoto(f);
        st.zoom = null;
        zetKijk(zoomDoel());
        klaar();
      },
      opnieuw() {
        stap();
        begin();
        st.kies = null;
        st.zoom = null;
        zetKijk(zoomDoel());
        klaar();
      },
      /** Voor iets dat van buiten de tekening wordt gesleept (een apparaat uit de strook): wat ligt daar. */
      plekOp(clientX, clientY) {
        const p = punt({ clientX, clientY });
        const id = ruimteOp(vloer(), p.x, p.y);
        return id !== BUITEN && vloer().ruimtes[id]?.kamer ? { ruimte: id, kamer: vloer().ruimtes[id].kamer, plek: { etage: st.etage, x: p.x, y: p.y } } : null;
      },
      zweef(clientX, clientY) {
        const w = clientX == null ? null : t.plekOp(clientX, clientY);
        const doel = w?.ruimte ?? null;
        if ((actie?.doel ?? null) === doel) return;
        actie = doel == null ? null : { type: 'zweef', doel, kandidaat: {} };
        teken();
      },
    };
    requestAnimationFrame(pasAan);
    return t;
  }

  /* ================================================================ het blad ernaast */

  const rij = (o) => `<button type="button" class="ht-rij${o.mist ? ' mist' : ''}${o.aan ? ' aan' : ''}" ${o.data}>${o.ik ? `<span class="ik"${o.kleur ? ` style="color: ${o.kleur}"` : ''}>${ik(o.ik)}</span>` : ''}<span class="t"><b>${esc(o.titel)}</b>${o.zin ? `<small>${esc(o.zin)}</small>` : ''}</span>${o.rechts ? `<em>${esc(o.rechts)}</em>` : ''}</button>`;
  /*
   * Het dak van een gebouw (stap 4, keuze Ricardo 19 november 2026): het dak
   * teken je in Je huis, Zonnepanelen legt de panelen erop. De vier vormen en de
   * nok een kwart draaien; alleen in de app (`t.gebouw`), niet in een schets.
   */
  /** De naamsvermelding van de kaarten bij Vorm (stap 4: de kaart staat alleen hier): 3D BAG met "vorm aangepast", OpenStreetMap voor de plattegrond en de gebouwen eromheen. */
  const vermelding = (bron, omgeving) => {
    const links = [
      ...(bron === 'bag3d' ? [`<a href="https://docs.3dbag.nl/en/copyright" target="_blank" rel="noopener">${esc(T('daken.kk.bag'))}</a>`] : []),
      ...(bron === 'osm' || ((bron === 'bag3d' || bron === 'osm') && omgeving) ? [`<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">${esc(T('daken.kk.osm'))}</a>`] : []),
    ].join(' · ');
    return links ? `<p class="ht-voet ht-vermelding">${links}</p>` : '';
  };
  const dakDeel = (t, b) => {
    if (!b || !t.gebouw) return '';
    const vormen = ['zadel', 'schild', 'lessenaar', 'plat'];
    const nok = b.dak === 'plat' ? '' : `<button type="button" class="ht-dakknop" data-ht="gebouw-nok" data-id="${esc(b.id)}" title="${esc(T('ht.dak.nokZin'))}">${esc(T(b.dak === 'lessenaar' ? 'daken.andereKant' : 'daken.nokDraaien'))}</button>`;
    return `<h4 class="ht-dakkop">${esc(T('ht.dak.kop'))}${nok}</h4><div class="ht-twee vier">${vormen.map((v) => `<button type="button" class="ht-klein${b.dak === v ? ' aan' : ''}" data-ht="gebouw-dak" data-id="${esc(b.id)}" data-dakvorm="${v}" aria-pressed="${b.dak === v}">${esc(T(`daken.dakvorm.${v}`))}</button>`).join('')}</div>`;
  };

  /** Een doorsnede van het huis (de straat of links aan het begin): de etages, het dak, en de dakkapel op zijn kant en etage. */
  function doorsnede(t, kant, etage, [w, h]) {
    const m = t.dakMaat();
    if (!m) return '';
    const pad = 7;
    const hoog = Math.max(m.nok, ...m.goot) + 0.3;
    const sx = (w - 2 * pad) / m.lc;
    const sy = (h - 2 * pad - 10) / hoog;
    const P = (pp) => pp.map(([c, z]) => `${(pad + c * sx).toFixed(1)},${(h - pad - 10 - z * sy).toFixed(1)}`).join(' ');
    const dakOp = (c) => (c <= m.naar[0] ? m.goot[0] + ((m.nok - m.goot[0]) * c) / Math.max(0.1, m.naar[0]) : m.goot[1] + ((m.nok - m.goot[1]) * (m.lc - c)) / Math.max(0.1, m.naar[1]));
    let s = `<polygon points="${P([[0, 0], [0, m.goot[0]], [m.naar[0], m.nok], [m.lc, m.goot[1]], [m.lc, 0]])}" fill="rgb(255 255 255 / 0.07)" stroke="rgb(255 255 255 / 0.55)" stroke-width="1.5" stroke-linejoin="round"/>`;
    for (const e of t.huis.etages.filter((x) => !x.buiten)) {
      const z = t.vloerHoogte(e.id);
      if (z <= 0) continue;
      const tot = (c) => dakOp(c) > z;
      let c0 = 0;
      while (c0 < m.lc && !tot(c0)) c0 += 0.05;
      let c1 = m.lc;
      while (c1 > 0 && !tot(c1)) c1 -= 0.05;
      s += `<polyline points="${P([[c0, z], [c1, z]])}" fill="none" stroke="${kant != null && e.id === etage ? 'rgb(111 211 255 / 0.75)' : 'rgb(255 255 255 / 0.3)'}" stroke-width="${kant != null && e.id === etage ? 2 : 1}"/>`;
    }
    if (kant != null) {
      const z = t.vloerHoogte(etage) + 2.4;
      const gevel = kant === 0 ? 0.3 : m.lc - 0.3;
      const tot = kant === 0 ? ((z - m.goot[0]) * m.naar[0]) / Math.max(0.1, m.nok - m.goot[0]) : m.lc - ((z - m.goot[1]) * m.naar[1]) / Math.max(0.1, m.nok - m.goot[1]);
      if (Math.abs(tot - gevel) > 0.2) {
        s += `<polygon points="${P([[gevel, dakOp(gevel)], [gevel, z], [tot, z]])}" fill="rgb(111 211 255 / 0.32)" stroke="#6fd3ff" stroke-width="2" stroke-linejoin="round"/>`;
        s += `<polyline points="${P([[gevel, dakOp(gevel) + 0.3], [gevel, z - 0.4]])}" fill="none" stroke="#a9e6ff" stroke-width="3" stroke-linecap="round"/>`;
      }
    }
    const [l, r] = m.langs ? [T('ht.dakkapel.links'), T('ht.dakkapel.rechts')] : [T('ht.dakkapel.straat'), T('ht.dakkapel.tuin')];
    s += `<text x="${pad}" y="${h - 2}" ${FONT} font-size="9.5" font-weight="700" fill="rgb(255 255 255 / 0.4)">${esc(l.toUpperCase())}</text><text x="${w - pad}" y="${h - 2}" text-anchor="end" ${FONT} font-size="9.5" font-weight="700" fill="rgb(255 255 255 / 0.4)">${esc(r.toUpperCase())}</text>`;
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${s}</svg>`;
  }
  /** De naam van een kant: voor en achter als de nok langs de straat loopt, anders links en rechts. */
  const kantNaam = (t, kant) => {
    const m = t.dakMaat();
    return m?.langs ? [T(kant === 0 ? 'ht.dakkapel.links' : 'ht.dakkapel.rechts'), T('ht.dakkapel.zijZin')] : [T(kant === 0 ? 'ht.dakkapel.voor' : 'ht.dakkapel.achter'), T(kant === 0 ? 'ht.dakkapel.voorZin' : 'ht.dakkapel.achterZin')];
  };
  const etageNaam = (t, id) => {
    const e = t.huis.etages.find((x) => x.id === id);
    return e?.kort ?? e?.naam ?? id;
  };
  /*
   * Je huis › Dak (stap 4 punt 3, schets Wand-Huis-Dakkapel): het dak (de vorm
   * en de nok, eerst bij Vorm), een dakkapel erbij met de kant en de etage, of
   * een gekozen dakkapel met zijn maten.
   */
  function dakBlad(t) {
    const st = t.st;
    const m = t.dakMaat();
    const b = t.hoofdBlok();
    const stap = (wat, titel, waarde, i) => `<div class="ht-stapper"><span>${esc(titel)}</span><button type="button" data-ht="kapel-anders" data-i="${i}" data-wat="${wat}" data-d="-0.1" aria-label="${esc(T('ht.dakkapel.kleiner'))}">−</button><b>${esc(waarde)}</b><button type="button" data-ht="kapel-anders" data-i="${i}" data-wat="${wat}" data-d="0.1" aria-label="${esc(T('ht.dakkapel.groter'))}">+</button></div>`;
    if (st.kapelErbij && m) {
      const keus = st.kapelErbij;
      const kantKnop = (kant) => {
        const [naam, zin] = kantNaam(t, kant);
        return `<button type="button" class="ht-kant${keus.kant === kant ? ' aan' : ''}" data-ht="kapel-keus" data-wat="kant" data-waarde="${kant}" aria-pressed="${keus.kant === kant}">${doorsnede(t, kant, keus.etage, [118, 64])}<b>${esc(naam)}</b><small>${esc(zin)}</small></button>`;
      };
      const etages = t.kapelEtages();
      return `<header><h3>${esc(T('ht.dakkapel.erbijKop'))}</h3><span>${esc(etageNaam(t, keus.etage))}</span></header>
        <p class="ht-zin">${esc(T('ht.dakkapel.erbijUitleg'))}</p>
        <h4>${esc(T('ht.dakkapel.welkeKant'))}</h4>
        <div class="ht-kanten">${kantKnop(0)}${kantKnop(1)}</div>
        ${etages.length > 1 ? `<h4>${esc(T('ht.dakkapel.welkeEtage'))}</h4><div class="ht-twee twee">${etages.map((id) => `<button type="button" class="ht-klein${keus.etage === id ? ' aan' : ''}" data-ht="kapel-keus" data-wat="etage" data-waarde="${esc(id)}" aria-pressed="${keus.etage === id}">${esc(etageNaam(t, id))}</button>`).join('')}</div><p class="ht-zin">${esc(T('ht.dakkapel.etageUitleg'))}</p>` : ''}
        <div class="ht-knoppen"><button type="button" class="knop" data-ht="kapel-niet">${esc(T('ht.dakkapel.annuleer'))}</button><button type="button" class="knop knop-licht" data-ht="kapel-zet">${esc(T('ht.dakkapel.zet'))}</button></div>`;
    }
    const kk = st.kies?.soort === 'kapel' ? st.kapellen[st.kies.i] : null;
    if (kk && m) {
      const i = st.kies.i;
      const uitKaart = b?.kapelBron === 'kaart';
      const [kant, kantZin] = kantNaam(t, kk.kant);
      const etage = kk.etage ?? t.dakEtage();
      return `<header><h3>${esc(T('ht.dakkapel.naam'))}</h3><span>${nl(kk.tot - kk.van)} × ${nl(kk.diep)} m</span></header>
        <div class="ht-door">${doorsnede(t, kk.kant, etage, [268, 118])}</div>
        <p class="ht-zin">${esc(T(uitKaart ? 'ht.dakkapel.kaartZin' : 'ht.dakkapel.eigenZin'))}</p>
        ${rij({ ik: 'dak', titel: kant, zin: kantZin, rechts: T('ht.dakkapel.andere'), data: `data-ht="kapel-anders" data-i="${i}" data-wat="kant"` })}
        ${t.kapelEtages().length > 1 ? rij({ ik: 'etages', titel: etageNaam(t, etage), zin: T('ht.dakkapel.etageZin'), rechts: T('ht.dakkapel.wijzig'), data: `data-ht="kapel-anders" data-i="${i}" data-wat="etage"` }) : ''}
        ${stap('breed', T('ht.dakkapel.breed'), `${nl(kk.tot - kk.van)} m`, i)}
        ${stap('diep', T('ht.dakkapel.diep'), `${nl(kk.diep)} m`, i)}
        ${rij({ ik: 'kruis', titel: T('ht.dakkapel.weg'), zin: uitKaart ? T('ht.dakkapel.wegKaart') : '', data: `data-ht="kapel-weg" data-i="${i}"` })}`;
    }
    const naam = b ? T(`daken.dakvorm.${b.dak ?? 'zadel'}`) : '';
    const etage = t.huis.etages.find((e) => e.id === st.etage);
    const onder = t.kapelEtages().includes(st.etage);
    return `<header><h3>${esc(T('ht.dakkapel.kop'))}</h3><span>${esc(b?.nok ? `${naam.toLowerCase()} · ${T('ht.dakkapel.nok')} ${nl(b.nok)} m` : naam)}</span></header>
      <p class="ht-zin">${esc(!m ? T('ht.dakkapel.plat') : onder ? T('ht.dakkapel.zin', { etage: (etage?.kort ?? etage?.naam ?? '').toLowerCase() }) : T('ht.dakkapel.geenEtage'))}</p>
      ${st.gebouwBezig ? `<p class="ht-zin">${esc(T('ht.gebouw.bezig'))}</p>` : dakDeel(t, b)}
      ${m ? rij({ ik: 'dak', titel: T('ht.dakkapel.erbij'), zin: T('ht.dakkapel.erbijZin'), rechts: '+', data: 'data-ht="kapel-erbij"' }) : ''}`;
  }

  /** Het blad rechts (wand) of onder (telefoon): wat je hier kunt, in regels. */
  const metOpeningenVan = (t) => !!t.metOpeningen;
  /*
   * De bladen van de indeling (stap 3, 17 november 2026, schets Wand-Huis-Aanvulling): wat eerst alleen
   * bij Kamers en indeling kon. De pagina geeft de gegevens en bewaart; hier alleen hoe het eruitziet.
   */
  function indelingBlad(t, blad, ix, etage, hier) {
    const knop = (actie, waarde, tekst, aan, uit) => `<button type="button" class="ht-klein${aan ? ' aan' : ''}" data-ht="ix" data-actie="${actie}" data-waarde="${esc(waarde)}"${uit ? ' disabled' : ''}>${esc(tekst)}</button>`;
    if (blad === 'etage') {
      const e = ix.etage;
      let s = `<header><h3>${esc(etage.naam)}</h3><span>${esc(T('ht.kamers', { n: hier.length }))}</span></header>
        <h4>${esc(T('ht.etage.naam'))}</h4><input class="ht-naam" data-ht-ix="etage-naam" value="${esc(etage.naam)}" maxlength="40" aria-label="${esc(T('ht.etage.naam'))}">
        <h4>${esc(T('ht.etage.dak'))}</h4><div class="ht-twee twee">${knop('dak', '1', T('ht.ja'), !!etage.dak)}${knop('dak', '0', T('ht.nee'), !etage.dak)}</div>
        <h4>${esc(T('ht.etage.volgorde'))}</h4><div class="ht-twee twee">${knop('schuif', '-1', T('ht.etage.hoger'), false, !e.kanHoger)}${knop('schuif', '1', T('ht.etage.lager'), false, !e.kanLager)}</div>`;
      if (ix.nieuweEtages.length) s += `<h4>${esc(T('ht.etage.erbij'))}</h4>${ix.nieuweEtages.map(([id, naam]) => rij({ ik: id === 'kelder' ? 'kelder' : 'etages', titel: naam, rechts: '+', data: `data-ht="ix" data-actie="etage-erbij" data-waarde="${esc(id)}"` })).join('')}`;
      s += `<div class="ht-onder">${e.kanWeg ? rij({ ik: 'kruis', kleur: 'var(--gloed)', titel: T('ht.etage.weg'), zin: T('ht.etage.wegZin'), data: 'data-ht="ix" data-actie="etage-weg" data-waarde=""' }) : ''}${rij({ ik: 'terug', titel: T('ht.etage.klaar'), zin: '', data: 'data-ht="blad" data-blad=""' })}</div>`;
      return s;
    }
    if (blad === 'buiten') {
      let s = `<header><h3>${esc(T('ht.buiten.kop'))}</h3><span>${esc(T('ht.buiten.span'))}</span></header><p class="ht-zin">${esc(T('ht.buiten.zin'))}</p><h4>${esc(T('ht.buiten.rond'))}</h4>`;
      // Knoppen in twee kolommen, aan of uit: als regels liep het blad op de wand onder de rand (de wand schuift nooit).
      s += `<div class="ht-twee twee">${ix.rond.map((r) => `<button type="button" class="ht-klein${r.aan ? ' aan' : ''}" data-ht="ix" data-actie="rond" data-waarde="${esc(r.w)}" aria-pressed="${r.aan}">${esc(r.naam)}</button>`).join('')}</div>`;
      if (ix.huisje) s += `<h4>${esc(T('ht.buiten.tuin'))}</h4><div class="ht-twee">${ix.huisje.opties.map(([w, naam]) => knop('huisje', w, naam, ix.huisje.nu === w)).join('')}</div>`;
      if (ix.accu) s += `<h4>${esc(T('ht.buiten.accu', { naam: ix.accu.naam }))}</h4><select class="ht-naam" data-ht-ix="accu" aria-label="${esc(T('ht.buiten.accu', { naam: ix.accu.naam }))}">${ix.accu.opties.map(([w, naam]) => `<option value="${esc(w)}"${ix.accu.nu === w ? ' selected' : ''}>${esc(naam)}</option>`).join('')}</select>`;
      return s;
    }
    // Verborgen: om terug te halen.
    const lijst = t.huis.verborgenLijst ?? [];
    return `<header><h3>${esc(T('ht.verborgen.kop'))}${window.hulp?.vraag('verbergen') ?? ''}</h3><span>${esc(T('ht.apparaten', { n: lijst.length }))}</span></header>
      <p class="ht-zin">${esc(T(lijst.length ? 'ht.verborgen.zin' : 'ht.verborgen.leeg'))}</p>
      ${lijst.map((a) => rij({ ik: APP_ICOON[a.soort] ?? a.soort ?? 'apparaat', titel: a.naam, rechts: T('ht.verborgen.terug'), data: `data-ht="ix" data-actie="terug" data-waarde="${esc(a.id)}"` })).join('')}
      <div class="ht-onder">${rij({ ik: 'terug', titel: T('ht.verborgen.naarApparaten'), zin: '', data: 'data-ht="blad" data-blad=""' })}</div>`;
  }
  /** Bij een kamer die in Home Assistant bestaat: de soort, de naam in de app, en de weg naar Verwarmen en koelen. */
  function kamerIndeling(t, kamer, ix) {
    const k = t.kamers[kamer];
    return `<h4>${esc(T('ht.kamer.soort'))}</h4><select class="ht-naam" data-ht-ix="kamer-soort" data-kamer="${esc(kamer)}" aria-label="${esc(T('ht.kamer.soort'))}"><option value="">${esc(T('ht.kamer.soortUitNaam'))}</option>${ix.soorten.map(([w, naam]) => `<option value="${esc(w)}"${k.soort === w ? ' selected' : ''}>${esc(naam)}</option>`).join('')}</select>
      <h4>${esc(T('ht.kamer.naam'))}</h4><input class="ht-naam" data-ht-ix="kamer-naam" data-kamer="${esc(kamer)}" value="${esc(k.naam)}" maxlength="40" aria-label="${esc(T('ht.kamer.naam'))}">
      <p class="ht-voet">${esc(T('ht.kamer.naamZin'))}</p>
      <h4>${esc(T('ht.kamer.klimaat'))}</h4>${rij({ ik: 'klimaat', kleur: 'var(--gloed)', titel: T('ht.kamer.klimaatRij'), zin: T('ht.kamer.klimaatZin'), rechts: '›', data: `data-ht="ix" data-actie="klimaat" data-waarde="${esc(kamer)}"` })}`;
  }

  function paneel(el, t) {
    const teken = () => {
      // Wie een maat aan het typen is, houdt zijn veld.
      if (document.activeElement?.matches?.('[data-ht-maat], [data-ht-naam], [data-ht-ix]') && el.contains(document.activeElement)) return;
      const st = t.st;
      const v = t.vloer();
      const m = t.maten();
      const etage = t.huis.etages.find((e) => e.id === st.etage);
      const hier = t.huis.kamers.filter((k) => k.etage === st.etage && !t.vast?.includes(k.id));
      const waar = t.kamerPlek();
      let s;
      const ix = t.indeling?.gegevens?.() ?? null;
      const blad = ix && st.blad && !st.kies && st.blad.etage === st.etage && st.blad.stand === st.stand ? st.blad.naam : null;
      if (blad) s = indelingBlad(t, blad, ix, etage, hier);
      else if (st.stand === 'dak') s = dakBlad(t);
      else if (st.kies?.soort === 'erfhuis') {
        // Het huis op het erf (20 november 2026): het volgt de vorm van je huis; die pas je aan bij Vorm.
        const opp = m[st.kies.id] ? Math.round(m[st.kies.id].n * CEL * CEL) : null;
        s = `<header><h3>${esc(T('ht.erfhuis.kop'))}</h3>${opp ? `<span>${opp} m²</span>` : ''}</header>
          <p class="ht-zin">${esc(T('ht.erfhuis.zin'))}</p>
          ${rij({ ik: 'etages', titel: T('ht.erfhuis.binnen'), zin: T('ht.erfhuis.binnenZin'), rechts: '›', data: 'data-ht="naar-binnen"' })}
          ${rij({ ik: 'thuis', titel: T('ht.erfhuis.vorm'), zin: T('ht.erfhuis.vormZin'), rechts: '›', data: 'data-ht="naar-vorm"' })}`;
      } else if (st.stand === 'vorm' && st.kies?.soort === 'omgeving') {
        // Een grijs gebouw van de kaart aangetikt: wat is het? Zoals bij Daken en panelen, en het geldt op allebei.
        s = `<header><h3>${esc(T('ht.gebouw.kop'))}</h3></header>
          <p class="ht-zin">${esc(T('ht.gebouw.zin'))}</p>
          ${st.gebouwFout ? `<p class="ht-niet">${esc(st.gebouwFout)}</p>` : ''}
          ${st.gebouwBezig ? `<p class="ht-zin">${esc(T('ht.gebouw.bezig'))}</p>` : ['uitbouw', 'garage', 'carport', 'tuinhuis', 'anders'].map((soort) => rij({ ik: 'thuis', titel: T(`daken.gebouw.${soort}`), zin: T(`ht.gebouw.zin.${soort}`), rechts: '+', data: `data-ht="gebouw-erbij" data-soort="${soort}"` })).join('')}
          ${rij({ ik: 'kruis', titel: T('ht.gebouw.niet'), zin: T('ht.gebouw.nietZin'), data: 'data-ht="gebouw-terug"' })}`;
      } else if (st.stand === 'vorm' && st.kies?.soort === 'blok') {
        const b = (t.huis.bronnen?.[st.bron]?.blokken ?? []).find((q) => q.id === st.kies.id);
        const naam = b ? T(`ht.bron.blok.${b.soort}`) : '';
        s = `<header><h3>${esc(naam.charAt(0).toUpperCase() + naam.slice(1))}</h3>${b ? `<span>${nl(b.b)} × ${nl(b.d)} m</span>` : ''}</header>
          <p class="ht-zin">${esc(T(b && t.opErf(b.id) ? 'ht.gebouw.blokZinErf' : 'ht.gebouw.blokZin'))}</p>
          ${b && t.opErf(b.id) && t.erfEtage() ? rij({ ik: 'tuin', titel: T('ht.gebouw.naarBuiten'), zin: T('ht.gebouw.naarBuitenZin'), rechts: '›', data: 'data-ht="naar-buiten"' }) : ''}
          ${st.gebouwFout ? `<p class="ht-niet">${esc(st.gebouwFout)}</p>` : ''}
          ${st.gebouwBezig ? `<p class="ht-zin">${esc(T('ht.gebouw.bezig'))}</p>` : `${dakDeel(t, b)}${rij({ ik: 'kruis', titel: T('ht.gebouw.weg'), zin: T('ht.gebouw.wegZin'), data: 'data-ht="gebouw-weg"' })}`}
          ${rij({ ik: 'thuis', titel: T('ht.gebouw.terug'), zin: '', data: 'data-ht="gebouw-terug"' })}`;
      } else if (st.stand === 'vorm' && st.wnOpen && t.huis.woning && global.woningDeel) {
        // Wat voor huis (20 november 2026): de vijf soorten en de muren tegen de buren.
        s = `<header><h3>${esc(T('ht.vorm.woning'))}</h3><span>${esc(T(`wn.soort.${t.huis.woning.soort}`).toLowerCase())}</span></header>
          <div class="wn-breed wn-twee">${global.woningDeel.html({ ...t.huis.woning, ht: true })}</div>
          <div class="ht-onder">${rij({ ik: 'terug', titel: T('ht.vorm.woningKlaar'), zin: '', data: 'data-ht="wn-dicht"' })}</div>`;
      } else if (st.stand === 'vorm') {
        // Vorm is ook de plek waar je ziet wat elke bron van je huis vindt, en waar je kiest.
        const o = t.omtrek();
        const nu = t.huis.bronnen?.[st.bron];
        s = `<header><h3>${esc(T('ht.vorm.kop'))}</h3><span>${nl((o.x1 - o.x0) * CEL)} × ${nl((o.y1 - o.y0) * CEL)} m</span></header>
          ${t.huis.woning && global.woningDeel ? rij({ ik: 'thuis', titel: T(`wn.soort.${t.huis.woning.soort}`), zin: t.huis.woning.soort === 'vrijstaand' ? T('wn.zin.vrijstaand') : T('ht.vorm.woningTegen', { kanten: (t.huis.woning.buren ?? []).map((k) => T(`wn.kantKlein.${k}`)).join(', ') || '—' }), rechts: T('ht.vorm.woningWijzig'), data: 'data-ht="wn-open"' }) : ''}
          <p class="ht-zin">${esc(T('ht.vorm.zin'))}</p>
          ${Object.entries(t.huis.bronnen ?? {})
            .map(([id, b]) => `<button type="button" class="ht-bron${st.bron === id ? ' aan' : ''}" data-ht="bron" data-bron="${esc(id)}" aria-pressed="${st.bron === id}"><span class="pl">${t.bronPlaatje(id, 92, 70)}</span><span class="t"><b>${esc(b.naam)}</b><small>${esc(b.vond)}</small><small>${esc(b.weet)}</small><em>${esc(st.bron === id ? T('ht.vorm.inGebruik') : T('ht.vorm.gebruik'))}</em></span></button>`)
            .join('')}
          ${(t.huis.nietGevonden ?? []).map((x) => `<p class="ht-niet"><b>${esc(x.naam)}</b> ${esc(x.zin)}</p>`).join('')}
          ${t.kijk && t.huis.kijk ? rij({ ik: 'dak', titel: t.huis.kijk.bezig ? T('ht.vorm.kijkt') : T('ht.vorm.kijk'), zin: t.huis.kijk.fout ?? T('ht.vorm.kijkZin'), rechts: '›', data: t.huis.kijk.bezig ? 'disabled' : 'data-ht="kijk"' }) : ''}
          ${rij({ ik: 'etages', titel: T('ht.hoogte'), zin: nu?.hoogte ?? '', rechts: nu?.gemeten ? T('ht.gemeten') : T('ht.geschat'), data: 'disabled' })}
          ${st.gebouwFout ? `<p class="ht-niet">${esc(st.gebouwFout)}</p>` : ''}
          ${st.gebouwBezig ? `<p class="ht-zin">${esc(T('ht.gebouw.bezig'))}</p>` : ''}
          <p class="ht-voet">${esc(T(t.kijk ? 'ht.vorm.voetApp' : 'ht.vorm.voet'))}</p>${vermelding(st.bron, (t.huis.bronnen?.[st.bron]?.omgeving ?? []).length > 0)}`;
      } else if (st.stand === 'kamers' && st.kies?.soort === 'opening' && (v.openingen ?? []).some((x) => x.id === st.kies.id)) {
        // Een deur, raam of de voordeur: de breedte, en weghalen.
        const o = v.openingen.find((x) => x.id === st.kies.id);
        const screen = o.soort === 'raam' ? st.apparaten.find((a) => a.raam === o.id && a.plek?.etage === st.etage) : null;
        const buitenmuur = t.openingMuur(o) === 2;
        const soorten = (buitenmuur ? OPENING_SOORTEN : BINNEN_SOORTEN).map((x) => `<button type="button" class="dr-soort${x === o.soort ? ' aan' : ''}" data-ht="opening-zet" data-wat="soort" data-w="${x}" aria-pressed="${x === o.soort}">${openingPlaatje(x)}<b>${esc(T(`ht.opening.${x}`))}</b></button>`).join('');
        const keus = (wat, opties, nu) => `<div class="ht-twee twee">${opties.map(([w, naam]) => `<button type="button" class="ht-klein${String(nu) === String(w) ? ' aan' : ''}" data-ht="opening-zet" data-wat="${wat}" data-w="${w}" aria-pressed="${String(nu) === String(w)}">${esc(naam)}</button>`).join('')}</div>`;
        // Het scharnier en de schuifrichting heten links en rechts zoals je ze in de tekening ziet: langs de muur van links naar rechts, of van onder naar boven.
        const eindNaam = (w) => T(o.as === 'y' ? (w === 'van' ? 'ht.opening.links' : 'ht.opening.rechts') : w === 'van' ? 'ht.opening.voorkant' : 'ht.opening.achterkant');
        const binnenKant = t.openingBinnen(o);
        const [ka, kb] = t.muurKanten({ as: o.as, op: o.op, van: o.van, tot: o.tot });
        const kamerNaam = (k) => (buitenmuur ? T(k === binnenKant ? 'ht.opening.naarBinnen' : 'ht.opening.naarBuiten') : (t.naamVan(v.ruimtes[k === -1 ? ka : kb]) ?? T('ht.vakZonderNaam')));
        const richting = o.soort === 'raam'
          ? ''
          : o.soort === 'schuifpui'
            ? `<h4 class="ht-dakkop">${esc(T('ht.opening.schuiftNaar'))}</h4>${keus('schuift', [['van', eindNaam('van')], ['tot', eindNaam('tot')]], o.schuift ?? 'van')}`
            : `${MET_SCHARNIER.has(o.soort) ? `<h4 class="ht-dakkop">${esc(T('ht.opening.scharnier'))}</h4>${keus('scharnier', [['van', eindNaam('van')], ['tot', eindNaam('tot')]], o.scharnier ?? 'van')}` : ''}
              <h4 class="ht-dakkop">${esc(T('ht.opening.draait'))}</h4>${keus('kant', buitenmuur ? [[binnenKant, kamerNaam(binnenKant)], [-binnenKant, kamerNaam(-binnenKant)]] : [[-1, kamerNaam(-1)], [1, kamerNaam(1)]], t.openingKant(o))}`;
        s = `<header><h3>${esc(T(`ht.opening.${o.soort}`))}</h3><span>${esc(meter(o.tot - o.van))}</span></header>
          <div class="dr-soorten">${soorten}</div>
          ${richting}
          <p class="ht-zin">${esc(T(`ht.opening.${o.soort}Zin`))}</p>
          <div class="ht-veld"><label>${esc(T('ht.opening.breed'))}</label>
            <div class="ht-stap"><button type="button" data-ht="opening-breed" data-d="-1" aria-label="${esc(T('ht.opening.smaller'))}">−</button><input readonly value="${nl((o.tot - o.van) * CEL)}" aria-label="${esc(T('ht.opening.breed'))}"><span>m</span><button type="button" data-ht="opening-breed" data-d="1" aria-label="${esc(T('ht.opening.breder'))}">+</button></div></div>
          ${o.soort === 'raam' ? rij({ ik: 'screen', titel: T('ht.opening.screen'), zin: screen ? T('ht.opening.screenErvoor', { naam: screen.naam }) : T('ht.opening.screenZin'), data: 'disabled' }) : ''}
          <div class="ht-onder">${rij({ ik: 'kruis', kleur: 'var(--gloed)', titel: T('ht.opening.weg'), zin: T('ht.opening.wegZin'), data: 'data-ht="opening-weg"' })}</div>`;
      } else if (st.stand === 'kamers' && metOpeningenVan(t) && st.kies?.soort === 'muur' && st.kies.run?.soort === 2) {
        // Een buitenmuur bij Kamers: schuiven doe je bij Vorm; hier een raam of de voordeur.
        const run = st.kies.run;
        s = t.opBuurMuur(run)
          ? `<header><h3>${esc(T('ht.opening.buurmuur'))}</h3><span>${esc(T('ht.muur.lang', { maat: meter(run.tot - run.van) }))}</span></header>
          <p class="ht-zin">${esc(T('ht.opening.buurmuurZin'))}</p>`
          : `<header><h3>${esc(T('ht.opening.buitenmuur'))}</h3><span>${esc(T('ht.muur.lang', { maat: meter(run.tot - run.van) }))}</span></header>
          <p class="ht-zin">${esc(T('ht.opening.buitenmuurZin'))}</p>
          <div class="dr-soorten">${OPENING_SOORTEN.map((x) => `<button type="button" class="dr-soort" data-ht="opening-plaats" data-soort="${x}">${openingPlaatje(x)}<b>${esc(T(`ht.opening.${x}`))}</b></button>`).join('')}</div>`;
      } else if (st.stand === 'kamers') {
        if (st.kies?.soort === 'muur' && st.kies.run) {
          const run = st.kies.run;
          const o = t.omtrek();
          const [a, b] = t.muurKanten(run);
          const na = t.naamVan(v.ruimtes[a]) ?? T('ht.vakZonderNaam');
          const nb = t.naamVan(v.ruimtes[b]) ?? T('ht.vakZonderNaam');
          const vanaf = run.as === 'x' ? run.op - o.x0 : run.op - o.y0;
          s = `<header><h3>${esc(T('ht.muur.kop'))}</h3><span>${esc(T('ht.muur.lang', { maat: meter(run.tot - run.van) }))}</span></header>
            <p class="ht-zin">${esc(T('ht.muur.zin', { a: na, b: nb }))}</p>
            <div class="ht-veld"><label for="ht-maat">${esc(run.as === 'x' ? T('ht.muur.vanLinks') : T('ht.muur.vanVoor'))}</label>
              <div class="ht-stap"><button type="button" data-ht="muur-stap" data-d="-1" aria-label="${esc(T('ht.muur.terug'))}">−</button><input id="ht-maat" inputmode="decimal" value="${nl(vanaf * CEL)}" data-ht-maat data-nul="${run.as === 'x' ? o.x0 : o.y0}" aria-label="${esc(T('ht.muur.meter'))}"><span>m</span><button type="button" data-ht="muur-stap" data-d="1" aria-label="${esc(T('ht.muur.verder'))}">+</button></div></div>
            ${metOpeningenVan(t) ? `<h4 class="ht-dakkop">${esc(T('ht.opening.watHier'))}</h4><div class="dr-soorten">${BINNEN_SOORTEN.map((x) => `<button type="button" class="dr-soort" data-ht="opening-plaats" data-soort="${x}">${openingPlaatje(x)}<b>${esc(T(`ht.opening.${x}`))}</b></button>`).join('')}</div>` : ''}
            ${rij({ ik: 'kruis', titel: T('ht.muur.weg'), zin: T('ht.muur.wegZin'), data: 'data-ht="muur-weg"' })}`;
        } else if (st.kies?.soort === 'ruimte' && v.ruimtes[st.kies.id]) {
          const id = st.kies.id;
          const r = v.ruimtes[id];
          const mm = m[id];
          const naam = t.naamVan(r);
          const maat = mm.recht ? `${nl((mm.x1 - mm.x0) * CEL)} × ${nl((mm.y1 - mm.y0) * CEL)} m` : T('ht.metHoek');
          s = `<header><h3>${esc(naam ?? T('ht.nieuwVak'))}</h3><span>${maat} · ${nl(mm.n * CEL * CEL, 0)} m²</span></header><h4>${esc(T('ht.watIsDit'))}</h4>`;
          for (const km of hier) {
            const w = waar[km.id];
            const aan = r.kamer === km.id;
            s += rij({ ik: km.soort, titel: km.naam, zin: aan ? T('ht.staatHier') : w ? T('ht.wisselen') : T('ht.nogGeenPlek'), mist: !w, aan, rechts: aan ? '✓' : '', data: `data-ht="noem" data-kamer="${esc(km.id)}"` });
          }
          // Buiten: een plek die nog niet bestaat, zoals de voortuin (Ricardo, 19 november 2026); kiezen zet hem in de indeling, met dit vak.
          if (etage.buiten && ix?.nieuwBuiten?.length) for (const p of ix.nieuwBuiten) s += rij({ ik: p.icoon ?? 'tuin', titel: p.naam, zin: T('ht.buiten.komtErbij'), rechts: '+', data: `data-ht="ix" data-actie="vak-buiten" data-waarde="${esc(p.soort)}"` });
          // Zones: alleen bij een kamer die er in Home Assistant meer dan één heeft.
          const zn = r.kamer ? (t.kamers[r.kamer]?.zones ?? []) : [];
          if (zn.length > 1 && !etage.buiten) {
            const z = v.zones?.[r.kamer];
            s += `<h4>${esc(T('ht.zones.kop', { namen: zn.join(` ${T('algemeen.en')} `) }))}</h4>`;
            s += z
              ? `<div class="ht-twee twee">${`<button type="button" class="ht-klein" data-ht="zone" data-wat="draai">${esc(T('ht.zones.draai'))}</button><button type="button" class="ht-klein" data-ht="zone" data-wat="weg">${esc(T('ht.zones.weg'))}</button>`}</div>`
              : rij({ ik: 'kamers', titel: T('ht.zones.zet'), zin: T('ht.zones.zetZin'), data: 'data-ht="zone" data-wat="zet"' });
          }
          const EIGEN = eigenNamen(!!etage.buiten);
          const eigen = r.naam && !EIGEN.some(([, n]) => n === r.naam) ? r.naam : '';
          // Een trap: naar welke kant hij omhoog gaat.
          if (metOpeningenVan(t) && t.soortVan(r) === 'trap') {
            s += `<h4>${esc(T('ht.trap.omhoog'))}</h4><div class="ht-twee">${['n', 'z', 'w', 'o'].map((x) => `<button type="button" class="ht-klein${(r.omhoog ?? 'n') === x ? ' aan' : ''}" data-ht="trap" data-r="${x}">${esc(T(`ht.trap.${x}`))}</button>`).join('')}</div>`;
          }
          s += `<h4>${esc(T('ht.geenKamerHA'))}</h4><div class="ht-twee">${EIGEN.map(([soort, n]) => `<button type="button" class="ht-klein${r.naam === n ? ' aan' : ''}" data-ht="noem" data-naam="${esc(n)}" data-soort="${soort}">${esc(n)}</button>`).join('')}</div>
            <input class="ht-naam" id="ht-naam" data-ht-naam value="${esc(eigen)}" placeholder="${esc(T('ht.eigenNaam'))}" maxlength="30" aria-label="${esc(T('ht.eigenNaamLabel'))}">`;
          if (ix && r.kamer && t.kamers[r.kamer] && !etage.buiten) s += kamerIndeling(t, r.kamer, ix);
          // Weghalen: het vak wordt weer deel van de ruimte waar het het meest aan grenst.
          const bw = t.buurVoor(id);
          const bwNaam = bw != null ? t.naamVan(v.ruimtes[bw]) : null;
          s += `<div class="ht-onder">${rij({ ik: 'kruis', kleur: 'var(--gloed)', titel: bw != null ? T('ht.weghalen') : T('ht.naamWeghalen'), zin: bw != null ? T('ht.weerDeelVan', { naam: bwNaam ?? T('ht.vakErnaast') }) : T('ht.vakBlijft'), data: 'data-ht="weg"' })}</div>`;
        } else if (t.isLeeg()) {
          const lijst = t.indelingen();
          s = `<header><h3>${esc(etage.naam)}</h3><span>${esc(T('ht.kamers', { n: hier.length }))}</span></header><h4>${esc(T('ht.begin.kop'))}</h4>
            <div class="ht-keus">${lijst.map((x, i) => `<button type="button" data-ht="indeling" data-i="${i}"><span>${t.plaatje(i, 116, 78)}</span><b>${esc(x.naam)}</b></button>`).join('')}</div>
            ${st.etage !== t.huis.etages[t.huis.etages.length - 1].id ? rij({ ik: 'etages', titel: T('ht.begin.beneden'), zin: T('ht.begin.benedenZin'), data: 'data-ht="beneden"' }) : ''}
            <p class="ht-voet">${esc(T('ht.begin.voet'))}</p>
            ${ix ? `<div class="ht-onder">${rij({ ik: 'etages', titel: T('ht.etage.instellen'), zin: T('ht.etage.instellenZin'), rechts: '›', data: 'data-ht="blad" data-blad="etage"' })}</div>` : ''}`;
        } else {
          const zonder = hier.filter((k) => !waar[k.id]);
          s = `<header><h3>${esc(etage.naam)}</h3><span>${esc(zonder.length ? T('ht.zonderPlek', { n: zonder.length }) : T('ht.allesPlek'))}</span></header>`;
          for (const km of hier) {
            const w = waar[km.id];
            const mm = w ? m[w.id] : null;
            s += rij({ ik: km.soort, titel: km.naam, zin: w ? '' : st.wapen?.kamer === km.id ? T('ht.tikVak') : T('ht.nogGeenPlek'), mist: !w, aan: st.wapen?.kamer === km.id, rechts: mm ? `${nl(mm.n * CEL * CEL, 0)} m²` : '', data: `data-ht="kamer" data-kamer="${esc(km.id)}"` });
          }
          for (const [id, r] of Object.entries(v.ruimtes)) if (r.naam) s += rij({ ik: r.soort ?? 'kamer', titel: r.naam, zin: T('ht.nietInHA'), rechts: `${nl(m[id].n * CEL * CEL, 0)} m²`, data: `data-ht="ruimte" data-id="${id}"`, kleur: 'var(--gedempt)' });
          // Buiten: wat er rond het huis is (voor Thuis) in plaats van de etage, en geen andere indeling.
          s += etage.buiten
            ? `<div class="ht-onder">${ix ? rij({ ik: 'buiten', titel: T('ht.buiten.rond'), zin: T('ht.buiten.rondZin'), rechts: '›', data: 'data-ht="blad" data-blad="buiten"' }) : ''}${rij({ ik: 'dak', titel: T('ht.buiten.vanKaart'), zin: T('ht.buiten.vanKaartZin'), data: 'data-ht="van-kaart"' })}</div>`
            : `${metOpeningenVan(t) ? rij({ ik: 'deur', titel: T('ht.opening.uitleg'), zin: T('ht.opening.uitlegZin', { n: (v.openingen ?? []).filter((o) => t.openingMuur(o)).length }), data: 'disabled' }) : ''}<div class="ht-onder">${ix ? rij({ ik: 'etages', titel: T('ht.etage.instellen'), zin: T('ht.etage.instellenZin'), rechts: '›', data: 'data-ht="blad" data-blad="etage"' }) : ''}${rij({ ik: 'kamers', titel: T('ht.andereIndeling'), zin: T('ht.andereIndelingZin'), data: 'data-ht="leeg"' })}</div>`;
        }
      } else if (st.stand === 'huis') {
        const b = t.huis.bronnen?.[st.bron];
        const n = Object.values(v.ruimtes).filter((r) => t.naamVan(r)).length;
        s = `<header><h3>${esc(T('ht.huis.kop'))}</h3><span>${esc(st.dicht ? T('ht.huis.dicht') : T('ht.huis.open', { etage: etage.kort ?? etage.naam }))}</span></header>
          <p class="ht-zin">${esc(T('ht.huis.zin'))}</p>
          ${rij({ ik: 'thuis', titel: T('ht.vorm.kop'), zin: b?.naam ?? T('ht.huis.zelf'), data: 'disabled' })}
          ${rij({ ik: 'etages', titel: T('ht.hoogte'), zin: b?.hoogte ?? '', rechts: b?.gemeten ? T('ht.gemeten') : T('ht.geschat'), data: 'disabled' })}
          ${rij({ ik: 'kamers', titel: T('ht.huis.binnen'), zin: T('ht.huis.ruimtes', { n }), data: 'disabled' })}
          <h4>${esc(T('ht.huis.kijken'))}</h4>
          <div class="ht-twee twee"><button type="button" class="ht-klein${st.dicht ? '' : ' aan'}" data-ht="dicht" data-d="0">${esc(T('ht.huis.openKnop'))}</button><button type="button" class="ht-klein${st.dicht ? ' aan' : ''}" data-ht="dicht" data-d="1">${esc(T('ht.huis.dichtKnop'))}</button></div>
          <p class="ht-voet">${esc(T('ht.huis.voet'))}</p>`;
      } else {
        const punten = t.apparaatPunten();
        const kies = st.kies?.soort === 'apparaat' ? t.st.apparaten.find((a) => a.id === st.kies.id) : null;
        const los = t.st.apparaten.filter((a) => !a.kamer);
        if (st.wapen?.apparaat || (kies && st.wapen?.lijst)) {
          const a = t.st.apparaten.find((x) => x.id === (st.wapen.apparaat ?? kies.id));
          s = `<header><h3>${esc(a.naam)}</h3><span>${esc(T('ht.app.waar'))}</span></header><p class="ht-zin">${esc(T('ht.app.waarZin'))}</p>`;
          for (const e of t.huis.etages) {
            const ks = t.huis.kamers.filter((k) => k.etage === e.id && waar[k.id] && !t.vast?.includes(k.id));
            if (!ks.length) continue;
            s += `<h4>${esc(e.naam)}</h4><div class="ht-twee">${ks.map((k) => `<button type="button" class="ht-klein${a.ha === k.id ? ' tip' : ''}${a.kamer === k.id ? ' aan' : ''}" data-ht="app-kamer" data-app="${esc(a.id)}" data-kamer="${esc(k.id)}">${esc(k.naam)}</button>`).join('')}</div>`;
          }
          // Buiten (besluit 269 en 317): de voordeur en wat er rond het huis is; een plek zonder ruimte komt erbij.
          // Een ruimte buiten met delen (de tuin met het terras en de border) onder zijn eigen kopje (18 november 2026).
          const groepen = [];
          // Wat al in de tekening van buiten staat, staat daar al bij de etage Buiten.
          for (const p of (ix?.plekken ?? []).filter((x) => !waar[x.waarde])) {
            const g = p.groep ?? T('ht.buiten.kop');
            const x = groepen.find(([y]) => y === g) ?? groepen[groepen.push([g, []]) - 1];
            x[1].push(p);
          }
          s += groepen.map(([g, ps]) => `<h4>${esc(g)}</h4><div class="ht-twee">${ps.map((p) => `<button type="button" class="ht-klein" data-ht="ix" data-actie="app-buiten" data-waarde="${esc(`${a.id}|${p.waarde}`)}">${esc(p.naam)}</button>`).join('')}</div>`).join('');
          if (a.ha) s += `<p class="ht-voet">${esc(T('ht.app.inHA', { naam: t.kamers[a.ha]?.naam ?? a.ha }))}</p>`;
          // Verbergen kan ook hier (18 november 2026): eerst alleen bij een apparaat dat al een kamer had.
          if (ix) s += `<div class="ht-onder">${rij({ ik: 'verborgen', titel: T('ht.app.verbergen'), zin: T('ht.app.verbergenZin'), data: `data-ht="ix" data-actie="verberg" data-waarde="${esc(a.id)}"` })}</div>`;
        } else if (kies) {
          const p = punten.find((x) => x.a.id === kies.id);
          s = `<header><h3>${esc(kies.naam)}</h3><span>${esc(t.kamers[kies.kamer]?.naam ?? T('ht.app.geenKamer'))}</span></header>
            ${rij({ ik: t.kamers[kies.kamer]?.soort ?? 'kamer', titel: T('ht.app.kamer'), zin: t.kamers[kies.kamer]?.naam ?? T('ht.app.nietGekozen'), rechts: '›', data: `data-ht="app-waar" data-app="${esc(kies.id)}"` })}
            ${rij({ ik: 'standaard', titel: T('ht.app.plek'), zin: p ? [t.zoneVan(p), t.plekNaam(p)].filter(Boolean).join(' · ') : T('ht.app.andereEtage'), rechts: p?.zelf ? T('ht.app.laatKiezen') : '', data: p?.zelf ? `data-ht="app-vrij" data-app="${esc(kies.id)}"` : 'disabled' })}
            ${rij({ ik: 'apparaat', titel: T('ht.app.openen'), zin: T('ht.app.openenZin'), rechts: '›', data: t.naar && kies.kamer ? `data-ht="openen" data-app="${esc(kies.id)}"` : 'disabled' })}
            ${bijBlad(kies)}
            <p class="ht-voet">${esc(T('ht.app.voet'))}</p>
            ${ix ? `<div class="ht-onder">${rij({ ik: 'verborgen', titel: T('ht.app.verbergen'), zin: T('ht.app.verbergenZin'), data: `data-ht="ix" data-actie="verberg" data-waarde="${esc(kies.id)}"` })}</div>` : ''}`;
        } else if (st.zoom != null && v.ruimtes[st.zoom]) {
          const lijst = punten.filter((p) => p.ruimte === st.zoom);
          s = `<header><h3>${esc(t.naamVan(v.ruimtes[st.zoom]) ?? T('ht.vakZonderNaamKop'))}</h3><span>${esc(T('ht.apparaten', { n: lijst.length }))}</span></header>`;
          s += lijst.map((p) => rij({ ik: APP_ICOON[p.a.soort] ?? p.a.soort, kleur: APP_KLEUR[p.a.soort], titel: p.a.naam, zin: [t.zoneVan(p), t.plekNaam(p)].filter(Boolean).join(' · '), data: `data-ht="app" data-app="${esc(p.a.id)}"` })).join('') || `<p class="ht-zin">${esc(T('ht.app.leeg'))}</p>`;
          s += `<div class="ht-onder">${rij({ ik: 'terug', titel: T('ht.app.heleEtage'), zin: '', data: 'data-ht="uit"' })}</div>`;
        } else {
          s = `<header><h3>${esc(etage.naam)}</h3><span>${esc(T('ht.apparaten', { n: punten.length }))}</span></header>`;
          for (const km of hier.filter((x) => waar[x.id])) {
            const n = punten.filter((p) => p.ruimte === waar[km.id].id).length;
            s += rij({ ik: km.soort, titel: km.naam, zin: `${(km.zones ?? []).length > 1 && v.zones?.[km.id] ? `${T('ht.zones.aantal', { n: km.zones.length })} · ` : ''}${T('ht.apparaten', { n })}`, rechts: '›', data: `data-ht="zoom" data-id="${waar[km.id].id}"` });
          }
          const zonderVak = hier.filter((x) => !waar[x.id]);
          if (zonderVak.length) s += `<p class="ht-zin mist">${esc(T('ht.app.zonderVak', { namen: zonderVak.map((x) => x.naam).join(', ') }))}</p>${rij({ ik: 'kamers', titel: T('ht.app.naarKamers'), zin: '', rechts: '›', data: 'data-ht="naar-kamers"' })}`;
          s += `<div class="ht-onder">${los.length ? '' : `<p class="ht-voet">${esc(T('ht.app.allesKamer'))}</p>`}${t.huis.verborgen ? rij({ ik: 'verborgen', titel: T('ht.app.verborgen'), zin: T('ht.apparaten', { n: t.huis.verborgen }), rechts: '›', data: t.naar ? 'data-ht="verborgen"' : 'disabled' }) : ''}</div>`;
        }
      }
      el.innerHTML = s;
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ht]');
      if (!b || b.disabled) return;
      const d = b.dataset;
      const st = t.st;
      if (d.ht === 'noem') t.noem(st.kies.id, d.kamer ? { kamer: d.kamer } : { naam: d.naam, soort: d.soort });
      else if (d.ht === 'zone') t.zetZone(t.vloer().ruimtes[st.kies.id].kamer, d.wat);
      else if (d.ht === 'bron') t.kiesBron(d.bron);
      else if (d.ht === 'wn-open' || d.ht === 'wn-dicht') {
        st.wnOpen = d.ht === 'wn-open';
        t.ververs();
      } else if (d.ht === 'woning') void t.indeling?.doe?.('woning', d.woning);
      else if (d.ht === 'buur') void t.indeling?.doe?.('buur', d.buur);
      else if (d.ht === 'kijk') t.kijk?.();
      else if (d.ht === 'gebouw-terug') t.kies(null);
      else if (d.ht === 'opening-plaats') t.plaatsOpening(d.soort);
      else if (d.ht === 'opening-breed') t.openingBreed(Number(d.d));
      else if (d.ht === 'opening-zet') t.openingZet(d.wat, d.w);
      else if (d.ht === 'opening-weg') t.openingWeg();
      else if (d.ht === 'trap') t.zetTrap(st.kies.id, d.r);
      else if ((d.ht === 'gebouw-dak' || d.ht === 'gebouw-nok') && t.gebouw && !st.gebouwBezig) {
        st.gebouwBezig = true;
        teken();
        Promise.resolve(t.gebouw(d.ht === 'gebouw-nok' ? { dak: d.id, nok: true } : { dak: d.id, dakvorm: d.dakvorm })).finally(() => {
          st.gebouwBezig = false;
          teken();
        });
      }
      else if (d.ht === 'naar-buiten' && t.erfEtage()) t.zetEtage(t.erfEtage());
      else if (d.ht === 'naar-binnen' || d.ht === 'naar-vorm') {
        const binnen = t.huis.beneden ?? t.huis.etages.filter((e) => !e.buiten).at(-1)?.id;
        t.st.kies = null;
        t.zetEtage(binnen);
        if (d.ht === 'naar-vorm') t.zetStand('vorm');
      }
      else if ((d.ht === 'gebouw-erbij' || d.ht === 'gebouw-weg') && t.gebouw && !st.gebouwBezig) {
        st.gebouwBezig = true;
        teken();
        const wat = d.ht === 'gebouw-erbij' ? { erbij: st.kies.i, soort: d.soort } : { weg: st.kies.id };
        if (wat.weg) t.blokWeg(wat.weg);
        Promise.resolve(t.gebouw(wat)).finally(() => {
          st.gebouwBezig = false;
          teken();
        });
      }
      else if (d.ht === 'weg') t.haalWeg(st.kies.id);
      else if (d.ht === 'dicht') {
        st.dicht = d.d === '1';
        t.teken();
        teken();
      } else if (d.ht === 'hoort') t.voegSamen(Number(d.bij), st.kies.id);
      else if (d.ht === 'muur-weg') t.muurWeg();
      else if (d.ht === 'muur-stap') t.muurZet(st.kies.run.op + Number(d.d));
      else if (d.ht === 'indeling') t.kiesIndeling(Number(d.i));
      else if (d.ht === 'beneden') t.zoalsBeneden();
      else if (d.ht === 'leeg') t.leeg();
      else if (d.ht === 'van-kaart') t.vanKaart();
      else if (d.ht === 'kapel-erbij') t.kapelErbij();
      else if (d.ht === 'kapel-keus') t.kapelKeus(d.wat, d.waarde);
      else if (d.ht === 'kapel-zet') t.kapelZet();
      else if (d.ht === 'kapel-niet') t.kapelNiet();
      else if (d.ht === 'kapel-anders') t.kapelAnders(Number(d.i), d.wat, Number(d.d ?? 0));
      else if (d.ht === 'kapel-weg') t.kapelWeg(Number(d.i));
      else if (d.ht === 'kamer') {
        const w = t.kamerPlek()[d.kamer];
        if (w) t.kies({ soort: 'ruimte', id: w.id });
        else t.wapen(st.wapen?.kamer === d.kamer ? null : { kamer: d.kamer });
      } else if (d.ht === 'ruimte') t.kies({ soort: 'ruimte', id: Number(d.id) });
      else if (d.ht === 'zoom') t.zoom(Number(d.id));
      else if (d.ht === 'uit') t.zoom(null);
      else if (d.ht === 'app') t.kies({ soort: 'apparaat', id: d.app });
      else if (d.ht === 'app-waar') {
        st.wapen = { lijst: true };
        teken();
      } else if (d.ht === 'app-kamer') t.zetApparaat(d.app, d.kamer, null);
      else if (d.ht === 'app-vrij') t.zetApparaat(d.app, st.apparaten.find((a) => a.id === d.app).kamer, null);
      else if (d.ht === 'openen') t.naar('apparaat', st.apparaten.find((a) => a.id === d.app));
      else if (d.ht === 'verborgen') {
        if (t.indeling) t.toonBlad('verborgen');
        else t.naar('verborgen');
      } else if (d.ht === 'blad') t.toonBlad(d.blad || null);
      else if (d.ht === 'ix' && t.indeling) Promise.resolve(t.indeling.doe(d.actie, d.waarde)).finally(() => teken());
      else if (d.ht === 'naar-kamers') t.zetStand('kamers');
    });
    el.addEventListener('change', (e) => {
      const ixVeld = e.target.closest('[data-ht-ix]');
      if (ixVeld && t.indeling) {
        const w = ixVeld.value.trim().replace(/\s+/g, ' ');
        ixVeld.blur();
        const waarde = ixVeld.dataset.kamer ? { kamer: ixVeld.dataset.kamer, w } : w;
        Promise.resolve(t.indeling.doe(ixVeld.dataset.htIx, waarde)).finally(() => teken());
        return;
      }
      const naam = e.target.closest('[data-ht-naam]');
      if (naam) {
        const tekst = naam.value.trim().replace(/\s+/g, ' ');
        naam.blur();
        if (tekst && t.st.kies?.soort === 'ruimte') t.noem(t.st.kies.id, { naam: tekst, soort: 'berging' });
        return teken();
      }
      const inp = e.target.closest('[data-ht-maat]');
      if (!inp) return;
      const n = Number(inp.value.replace(',', '.'));
      const nul = Number(inp.dataset.nul);
      inp.blur();
      if (Number.isFinite(n)) t.muurZet(nul + Math.round(n / CEL));
      teken();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-ht-maat], [data-ht-naam], input[data-ht-ix]')) e.target.blur();
    });
    t.op(teken);
    teken();
  }

  /** De etages als het huis opzij: tik een laag aan. */
  function stapel(el, t) {
    const teken = () => {
      const waar = t.kamerPlek();
      const erf = t.huis.etages.find((e) => e.buiten);
      const zonderBuiten = erf ? t.huis.kamers.filter((k) => k.etage === erf.id && !t.vast?.includes(k.id) && !waar[k.id]).length : 0;
      el.innerHTML = `<div class="ht-dak" aria-hidden="true"></div>${t.huis.etages
        .filter((e) => !e.buiten)
        .map((e) => {
          const zonder = t.huis.kamers.filter((k) => k.etage === e.id && !waar[k.id]).length;
          return `<button type="button" class="ht-laag${e.id === t.st.etage ? ' aan' : ''}" data-etage="${esc(e.id)}" aria-pressed="${e.id === t.st.etage}"><b>${esc(e.kort ?? e.naam)}</b><small>${esc(t.st.stand === 'vorm' ? T('ht.stapel.hoog', { maat: nl(e.hoogte ?? 2.8) }) : zonder && t.st.stand === 'kamers' ? T('ht.zonderPlek', { n: zonder }) : T('ht.kamers', { n: t.huis.kamers.filter((k) => k.etage === e.id).length }))}</small>${zonder && t.st.stand === 'kamers' ? '<i></i>' : ''}</button>`;
        })
        .join('')}<div class="ht-grond" aria-hidden="true"></div>${erf
        // Buiten als eigen tekening (19 november 2026): een etage zoals de andere.
        ? `<button type="button" class="ht-laag buiten${t.st.etage === erf.id ? ' aan' : ''}" data-etage="${esc(erf.id)}" aria-pressed="${t.st.etage === erf.id}"><b>${esc(erf.kort ?? erf.naam)}</b><small>${esc(zonderBuiten && t.st.stand === 'kamers' ? T('ht.zonderPlek', { n: zonderBuiten }) : T('ht.stapel.buitenZin'))}</small>${zonderBuiten && t.st.stand === 'kamers' ? '<i></i>' : ''}</button>`
        : `<button type="button" class="ht-laag buiten${t.st.blad?.naam === 'buiten' ? ' aan' : ''}" ${t.indeling ? 'data-buiten-blad' : 'disabled'}><b>${esc(T('ht.stapel.buiten'))}</b><small>${esc(T('ht.stapel.buitenZin'))}</small></button>`}`;
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-etage]');
      // De etage die al gekozen is, nog eens aantikken: zijn blad (naam, dak, volgorde); buiten wat er rond het huis is.
      if (b && t.indeling && b.dataset.etage === t.st.etage && !t.st.blad) t.toonBlad(t.huis.etages.find((x) => x.id === b.dataset.etage)?.buiten ? 'buiten' : 'etage');
      else if (b) {
        t.st.blad = null;
        t.zetEtage(b.dataset.etage);
      }
      if (e.target.closest('[data-buiten-blad]')) t.toonBlad('buiten');
    });
    t.op(teken);
    teken();
  }

  /**
   * De strook onder de tekening bij Apparaten: wat nog geen kamer heeft. Sleep
   * een apparaat de tekening in, of tik het aan en dan de kamer.
   */
  function strook(el, t) {
    let sleep = null;
    const teken = () => {
      // Onder de vinger blijft de strook staan: opnieuw tekenen zou het gesleepte apparaat weghalen.
      if (sleep) return;
      const los = t.st.apparaten.filter((a) => !a.kamer);
      el.hidden = t.st.stand !== 'apparaten' || !los.length;
      el.innerHTML = `<div class="ht-n"><b>${los.length}</b><span>${esc(T('ht.strook.zonder'))}</span></div>${los.map((a) => `<button type="button" class="ht-los${t.st.wapen?.apparaat === a.id ? ' aan' : ''}" data-los="${esc(a.id)}" style="color: ${APP_KLEUR[a.soort] ?? '#eef3f7'}"><span class="ik">${ik(APP_ICOON[a.soort] ?? a.soort)}</span><span class="t"><b>${esc(a.naam)}</b><small>${esc(a.ha ? T('ht.strook.ha', { naam: t.kamers[a.ha]?.naam ?? a.ha }) : T('ht.strook.sleep'))}</small></span></button>`).join('')}`;
    };
    el.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-los]');
      if (!b || e.button > 0 || sleep) return;
      // De strook zelf houdt de vinger vast, niet de knop: die mag opnieuw getekend worden.
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Zonder vasthouden werkt het binnen de strook nog steeds.
      }
      sleep = { b, id: b.dataset.los, x: e.clientX, y: e.clientY, kaart: null, vinger: e.pointerType !== 'mouse' };
    });
    el.addEventListener('pointermove', (e) => {
      if (!sleep) return;
      if (!sleep.kaart) {
        if (Math.hypot(e.clientX - sleep.x, e.clientY - sleep.y) < 10) return;
        sleep.kaart = sleep.b.cloneNode(true);
        sleep.kaart.classList.add('zweeft');
        document.body.append(sleep.kaart);
        sleep.b.classList.add('weg');
      }
      // Boven de vinger, zodat je ziet waar het neerkomt.
      const y = e.clientY - (sleep.vinger ? 46 : 0);
      sleep.kaart.style.transform = `translate(${e.clientX}px, ${y}px) translate(-50%, -50%)`;
      sleep.px = e.clientX;
      sleep.py = y;
      t.zweef(e.clientX, y);
    });
    const klaar = (e, afgebroken) => {
      if (!sleep) return;
      const s = sleep;
      sleep = null;
      s.kaart?.remove();
      s.b.classList.remove('weg');
      t.zweef(null);
      if (afgebroken) return teken();
      if (!s.kaart) {
        // Getikt: dan de kamer kiezen, in de tekening of in het blad.
        t.wapen(t.st.wapen?.apparaat === s.id ? null : { apparaat: s.id });
        return;
      }
      const w = t.plekOp(s.px, s.py);
      if (w) t.zetApparaat(s.id, w.kamer, w.plek);
      else teken();
    };
    el.addEventListener('pointerup', (e) => klaar(e, false));
    el.addEventListener('pointercancel', (e) => klaar(e, true));
    t.op(teken);
    teken();
  }

  /** De zin onder de tekening: wat je hier kunt, of wat er nu gebeurt. */
  function uitleg(t) {
    const st = t.st;
    const a = t.bezig();
    if (a?.type === 'muur') return a.gelijk ? T('ht.uitleg.opLijn') : T('ht.uitleg.muurLos');
    if (a?.type === 'verplaats') return T('ht.uitleg.verplaatsLos');
    if (a?.type === 'vak') return T('ht.uitleg.vakLos');
    if (a?.type === 'apparaat') return T('ht.uitleg.apparaatLos');
    if (a?.type === 'opening') return T('ht.uitleg.openingLos');
    if (st.stand === 'huis') return T('ht.uitleg.huis');
    if (st.stand === 'vorm') return T('ht.uitleg.vorm');
    if (st.stand === 'dak') return T(a?.type === 'kapel' || st.kies?.soort === 'kapel' ? 'ht.uitleg.dakKapel' : 'ht.uitleg.dak');
    if (st.stand === 'kamers') {
      if (st.wapen?.kamer) return T('ht.uitleg.wapen', { naam: t.kamers[st.wapen.kamer].naam.toLowerCase() });
      if (st.kies?.soort === 'ruimte' && t.verplaatsbaar(st.kies.id)) return T('ht.uitleg.greep');
      if (st.kies?.soort === 'opening') return T('ht.uitleg.opening');
      if (st.kies?.soort === 'muur' && st.kies.run?.soort === 2) return T('ht.uitleg.buitenmuur');
      if (st.kies?.soort === 'muur') return T('ht.uitleg.muur');
      // Buiten (19 november 2026): de oprit, de tuin en hun delen; het huis aantikken is naar binnen.
      if (t.huis.etages.find((e) => e.id === st.etage)?.buiten) return T('ht.uitleg.buiten');
      return T('ht.uitleg.kamers');
    }
    if (st.wapen?.apparaat) return T('ht.uitleg.appWapen');
    if (st.zoom != null) return T('ht.uitleg.appZoom');
    if (t.huis.etages.find((e) => e.id === st.etage)?.buiten) return T('ht.uitleg.appBuiten');
    return T('ht.uitleg.apparaten');
  }

  global.huistekenen = { maak, paneel, stapel, strook, uitleg, CEL, MARGE, BUITEN, randen, isMuur, maten, omtrek, TINT, SOORT_TINT, APP_KLEUR, muurDelen, openingBinnen, TRAP_RICHTING };
})(typeof window !== 'undefined' ? window : globalThis);
