/*
 * SunArc: je huis tekenen, deel 1 van de motor (22 november 2026, opgesplitst uit kit/huistekenen.js).
 *
 * De vaste waarden (ruitjes van 10 cm, kleuren per soort ruimte) en de losse rekenfuncties op het ruitjespapier:
 * een nieuwe vloer, vakken vullen, randen en muren, de maten van een ruimte, deuren en ramen op een muur, de begin-
 * indeling en de omzetting naar en van meters. Niets hier tekent of houdt een stand bij; de tekenaar (huistekenen.js)
 * en zijn delen (huistekenen-blad.js, -teken.js, -gebaar.js) gebruiken het via global.htVloer.
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
  /** Het draaiende icoon tijdens het zoeken van de kaarten (ronde 2). */
  const DRAAI = '<svg class="kv-draai" viewBox="0 0 24 24" fill="none" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="rgb(111 211 255 / 0.2)"/><path d="M12 3a9 9 0 0 1 9 9" stroke="#6fd3ff"/></svg>';

  const TINT = { woon: '110 231 183', keuken: '247 181 72', slaap: '143 134 255', nat: '111 211 255', hal: '184 196 207', garage: '154 170 187', groen: '120 196 110', huis: '96 112 136', leeg: '255 255 255' };
  // Buiten (19 november 2026): de tuin groen, de oprit grijs, het terras warm, de gebouwen als de garage, het huis donker.
  const SOORT_TINT = { woonkamer: 'woon', woonkeuken: 'keuken', keuken: 'keuken', eetkamer: 'keuken', slaapkamer: 'slaap', kinderkamer: 'slaap', logeerkamer: 'slaap', werkkamer: 'slaap', zolder: 'slaap', badkamer: 'nat', toilet: 'nat', wasruimte: 'nat', hal: 'hal', overloop: 'hal', trap: 'hal', berging: 'hal', garage: 'garage', kelder: 'garage', tuin: 'groen', voortuin: 'groen', zijtuin: 'groen', border: 'groen', oprit: 'hal', pad: 'hal', terras: 'keuken', dakterras: 'keuken', balkon: 'keuken', carport: 'garage', tuinhuis: 'garage', schuur: 'garage', jacuzzi: 'nat', thuis: 'huis' };
  /** Ruimtes die niet in Home Assistant hoeven te staan. */
  const EIGEN_SLEUTELS = [['hal', 'hal'], ['toilet', 'toilet'], ['overloop', 'overloop'], ['trap', 'trap'], ['berging', 'berging'], ['berging', 'meterkast']];
  /** Buiten (19 november 2026): wat er op een erf staat zonder dat Home Assistant het kent. */
  const EIGEN_BUITEN = [['berging', 'schuur'], ['berging', 'fietsenhok'], ['berging', 'kas'], ['berging', 'pad']];
  /** [soort, naam] in de taal van de app; buiten andere namen. */
  const eigenNamen = (buiten = false) => (buiten ? EIGEN_BUITEN : EIGEN_SLEUTELS).map(([soort, k]) => [soort, T(`ht.eigen.${k}`)]);
  const APP_KLEUR = { licht: '#f7b548', airco: '#6fd3ff', screen: '#6fd3ff', meter: '#ff9a6b', thermostaat: '#ff9a6b', stekker: '#f7b548', witgoed: '#c9d4df', radiator: '#ff9a6b', buitenunit: '#6fd3ff', koffie: '#f7b548', camera: '#a99cff', beweging: '#a99cff', auto: '#9aaabb', accu: '#6ee7b7', droger: '#6fd3ff', vaat: '#6fd3ff', rookmelder: '#ff9a6b', boiler: '#ff9a6b', jacuzzi: '#6fd3ff' };
  const APP_ICOON = { meter: 'klimaat', radiator: 'verwarming', buitenunit: 'airco' };

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

  global.htVloer = { CEL, BUITEN, MARGE, MIN, FONT, esc, T, nl, meter, klem, ik, DRAAI, TINT, SOORT_TINT, EIGEN_SLEUTELS, EIGEN_BUITEN, eigenNamen, APP_KLEUR, APP_ICOON, nieuweVloer, vulRecht, kopie, zoneStukken, ordenen, randen, isMuur, lijnPad, OPENING_BREED, OPENING_SOORTEN, BINNEN_SOORTEN, MET_SCHARNIER, richtingVan, openingPlaatje, openingMuur, openingBinnen, TRAP_RICHTING, muurDelen, vlakPaden, stroken, maten, omtrek, muurRuimte, muurNaar, GEWICHT, VOOR, rond1, verdeel, rijen, indelingen, boomOpVloer, vloerUitIndeling, inpakken, uitpakken, m1, vloerNaarMeters, vloerUitMeters, klein };
})(typeof window !== 'undefined' ? window : globalThis);
