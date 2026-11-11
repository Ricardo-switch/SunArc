/*
 * Je huis op maat (schets huisontwerp, 8 november 2026): één beschrijving in
 * meters, waaruit drie tekeningen komen.
 *
 *   vanBoven()      het perceel met de gebouwen, zoals bij Daken en panelen
 *   doorsnede()     het huis opzij doorgesneden, met de etages en hun hoogte
 *   plattegrond()   één etage van boven, met de kamers als vakken
 *   sjabloon()      een kleine plattegrond voor de keuze "Kies een indeling"
 *
 * De kamers op een etage zijn vakken die ontstaan door lijnen te zetten: elk
 * vak kan in tweeën, dwars of overlangs. Zo sluiten ze altijd op elkaar aan,
 * zonder gaten of overlap, en is een indeling te bewaren als een kleine boom:
 *   { k: 'woonkamer' }                       een vak met een kamer uit Home Assistant
 *   { naam: 'Toilet' }                       een vak zonder kamer, alleen voor de tekening
 *   { as: 'x', op: 3, a: …, b: … }           een lijn van voor naar achter, 3 m van links
 *   { as: 'y', op: 5.2, a: …, b: … }         een lijn dwars, 5,2 m achter de voorgevel
 * Meters vanaf de linker voorhoek van het gebouw; de straat ligt onder.
 */
'use strict';

(function (global) {
  /** Het voorbeeldhuis: een woning met een uitbouw achter, een garage ernaast en een tuinhuis. */
  const HUIS = {
    gebouwen: [
      { id: 'hoofd', naam: 'Hoofdhuis', x: 0, y: 0, w: 10, d: 8.4, lagen: 3, goot: 6.3, nok: 10.2, dak: 'zadel', bron: 'kaart' },
      { id: 'uitbouw', naam: 'Uitbouw', x: 4.2, y: 8.4, w: 5.8, d: 3.2, lagen: 1, goot: 3.1, nok: 3.1, dak: 'plat', bron: 'kaart' },
      { id: 'garage', naam: 'Garage', x: -3.6, y: 1.0, w: 3.6, d: 6.6, lagen: 1, goot: 2.9, nok: 2.9, dak: 'plat', bron: 'kaart' },
      { id: 'tuinhuis', naam: 'Tuinhuis', x: 5.6, y: 17.2, w: 3.2, d: 2.4, lagen: 1, goot: 2.3, nok: 2.6, dak: 'lessenaar', bron: 'bewoner' },
    ],
    perceel: { x: -6, y: -4, w: 19.5, d: 25 },
    etages: [
      { id: 'zolder', naam: 'Zolder', van: 5.6, tot: 10.2, dak: true, knie: 0.7, op: ['hoofd'] },
      { id: 'e1', naam: 'Eerste verdieping', van: 2.8, tot: 5.6, op: ['hoofd'] },
      { id: 'bg', naam: 'Begane grond', van: 0, tot: 2.8, op: ['hoofd', 'uitbouw', 'garage'] },
    ],
  };

  /** De kamers uit Home Assistant (het voorbeeldhuis), met hun soort voor de kleur. */
  const KAMERS = {
    hal: { naam: 'Hal', soort: 'hal', icoon: 'hal' },
    woonkamer: { naam: 'Woonkamer', soort: 'woon', icoon: 'woonkamer' },
    keuken: { naam: 'Keuken', soort: 'keuken', icoon: 'keuken' },
    garage: { naam: 'Garage', soort: 'garage', icoon: 'garage' },
    slaapkamer: { naam: 'Slaapkamer', soort: 'slaap', icoon: 'slaapkamer' },
    kinderkamer: { naam: 'Kinderkamer', soort: 'slaap', icoon: 'kinderkamer' },
    badkamer: { naam: 'Badkamer', soort: 'nat', icoon: 'badkamer' },
    zolder: { naam: 'Zolder', soort: 'zolder', icoon: 'dak' },
  };
  const TINT = { woon: '110 231 183', keuken: '247 181 72', slaap: '143 134 255', nat: '111 211 255', hal: '184 196 207', garage: '154 170 187', zolder: '255 160 110', leeg: '255 255 255' };

  /** De indeling per etage en per gebouw. */
  const INDELING = {
    bg: {
      hoofd: { as: 'x', op: 3, a: { as: 'y', op: 5.4, a: { k: 'hal' }, b: { naam: 'Toilet', icoon: 'toilet' } }, b: { k: 'woonkamer' } },
      uitbouw: { k: 'keuken' },
      garage: { k: 'garage' },
    },
    e1: {
      hoofd: { as: 'x', op: 4.4, a: { as: 'y', op: 4, a: { k: 'kinderkamer' }, b: { as: 'x', op: 1.5, a: { naam: 'Overloop', icoon: 'trap' }, b: { k: 'badkamer' } } }, b: { k: 'slaapkamer' } },
    },
    zolder: { hoofd: { k: 'zolder' } },
  };

  const g = (id) => HUIS.gebouwen.find((b) => b.id === id);
  const nl = (n, d = 1) => n.toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d });
  const FONT = 'font-family="Figtree, sans-serif"';

  /** De vakken van een boom binnen een rechthoek (meters), met de lijnen ertussen. */
  function vakken(boom, r, uit = { vak: [], lijn: [] }, pad = '') {
    if (!boom.as) { uit.vak.push({ r, blad: boom, pad }); return uit; }
    if (boom.as === 'x') {
      const a = { x: r.x, y: r.y, w: boom.op, d: r.d }, b = { x: r.x + boom.op, y: r.y, w: r.w - boom.op, d: r.d };
      uit.lijn.push({ x1: r.x + boom.op, y1: r.y, x2: r.x + boom.op, y2: r.y + r.d });
      vakken(boom.a, a, uit, pad + 'a'); vakken(boom.b, b, uit, pad + 'b');
    } else {
      const a = { x: r.x, y: r.y, w: r.w, d: boom.op }, b = { x: r.x, y: r.y + boom.op, w: r.w, d: r.d - boom.op };
      uit.lijn.push({ x1: r.x, y1: r.y + boom.op, x2: r.x + r.w, y2: r.y + boom.op });
      vakken(boom.a, a, uit, pad + 'a'); vakken(boom.b, b, uit, pad + 'b');
    }
    return uit;
  }

  /** Een icoon uit de kit als los stukje in een tekening. */
  function icoon(naam, x, y, maat, kleur) {
    if (!global.iconen) return '';
    return `<g style="color: ${kleur}">${global.iconen.svg(naam).replace('<svg ', `<svg x="${x}" y="${y}" width="${maat}" height="${maat}" `)}</g>`;
  }

  /** Een maatlijn met streepjes aan de uiteinden en de maat in het midden. */
  function maat(x1, y1, x2, y2, tekst, o = {}) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, staand = x1 === x2;
    const kl = o.kleur ?? 'rgb(255 255 255 / 0.5)';
    let s = `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${kl}" stroke-width="1.2"/>`;
    s += staand ? `<path d="M${x1 - 5} ${y1}h10M${x2 - 5} ${y2}h10" stroke="${kl}" stroke-width="1.2"/>` : `<path d="M${x1} ${y1 - 5}v10M${x2} ${y2 - 5}v10" stroke="${kl}" stroke-width="1.2"/>`;
    const bw = tekst.length * 6.6 + 12;
    s += staand
      ? `<g transform="translate(${mx} ${my}) rotate(-90)"><rect x="${-bw / 2}" y="-10" width="${bw}" height="20" rx="6" fill="${o.vul ?? '#13213a'}"/><text y="4.5" text-anchor="middle" ${FONT} font-size="12" font-weight="700" fill="${o.tekst ?? 'rgb(255 255 255 / 0.85)'}">${tekst}</text></g>`
      : `<rect x="${mx - bw / 2}" y="${my - 10}" width="${bw}" height="20" rx="6" fill="${o.vul ?? '#13213a'}"/><text x="${mx}" y="${my + 4.5}" text-anchor="middle" ${FONT} font-size="12" font-weight="700" fill="${o.tekst ?? 'rgb(255 255 255 / 0.85)'}">${tekst}</text>`;
    return s;
  }

  /**
   * Het perceel van boven: de gebouwen met hun dak, de straat onder, het
   * noorden schuin (de voorgevel kijkt naar het zuidoosten). opts.kies: het id
   * van het gebouw dat aangetikt is (met grepen en maten); opts.breed/hoog.
   */
  function vanBoven(o = {}) {
    const W = o.breed ?? 520, H = o.hoog ?? 520;
    const huis = o.huis ?? HUIS;
    const p = huis.perceel, s = Math.min(W / (p.w + (huis.buren ? 6 : 2)), (H - 40) / (p.d + 2));
    const ox = (W - p.w * s) / 2 - p.x * s, oy = H - 44 + p.y * s;
    const X = (x) => ox + x * s, Y = (y) => oy - y * s;
    let out = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Het perceel van boven met de gebouwen">`;
    out += '<defs><pattern id="ho-gras" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r="0.8" fill="rgb(110 200 140 / 0.25)"/><circle cx="7" cy="8" r="0.8" fill="rgb(110 200 140 / 0.2)"/></pattern></defs>';
    // Straat en stoep.
    out += `<rect x="0" y="${H - 38}" width="${W}" height="38" fill="rgb(255 255 255 / 0.05)"/><path d="M0 ${H - 19}H${W}" stroke="rgb(255 255 255 / 0.18)" stroke-width="2" stroke-dasharray="14 12"/><text x="${W - 14}" y="${H - 14}" text-anchor="end" ${FONT} font-size="11" font-weight="700" letter-spacing="2" fill="rgb(255 255 255 / 0.4)">STRAAT</text>`;
    // Perceel.
    out += `<rect x="${X(p.x)}" y="${Y(p.y + p.d)}" width="${p.w * s}" height="${p.d * s}" rx="14" fill="rgb(110 190 130 / 0.09)" stroke="rgb(110 190 130 / 0.3)" stroke-dasharray="6 6"/><rect x="${X(p.x)}" y="${Y(p.y + p.d)}" width="${p.w * s}" height="${p.d * s}" rx="14" fill="url(#ho-gras)"/>`;
    // De buren: hun gevels tegen de jouwe, dicht en grijs (geen doorkijk).
    for (const kant of huis.buren ? ['links', 'rechts'] : []) {
      const b = huis.gebouwen[0], bx = kant === 'links' ? p.x - 2.6 : p.x + p.w;
      out += `<rect x="${X(bx)}" y="${Y(b.y + b.d + 0.6)}" width="${2.6 * s}" height="${(b.d + 0.6) * s}" fill="rgb(255 255 255 / 0.07)"/><path d="M${X(kant === 'links' ? p.x : p.x + p.w)} ${Y(b.y)}V${Y(b.y + b.d)}" stroke="rgb(255 255 255 / 0.45)" stroke-width="4"/>`;
      out += `<text transform="translate(${X(bx + 1.3)} ${Y(b.y + b.d / 2)}) rotate(-90)" text-anchor="middle" ${FONT} font-size="11" font-weight="700" letter-spacing="1.5" fill="rgb(255 255 255 / 0.4)">BUREN</text>`;
    }
    // Oprit voor de garage en een pad naar de voordeur.
    if (!o.huis) out += `<rect x="${X(-3.4)}" y="${Y(1)}" width="${3.2 * s}" height="${6 * s}" fill="rgb(255 255 255 / 0.06)"/><rect x="${X(0.9)}" y="${Y(0)}" width="${1.2 * s}" height="${5 * s}" fill="rgb(255 255 255 / 0.05)"/>`;
    // Bomen achterin.
    for (const [bx, by, r] of huis.bomen ?? [[-3.5, 18.5, 1.9], [11.2, 14.5, 1.5], [1.2, 20.2, 1.3]]) out += `<circle cx="${X(bx) + 6}" cy="${Y(by) + 8}" r="${r * s}" fill="rgb(0 0 0 / 0.25)"/><circle cx="${X(bx)}" cy="${Y(by)}" r="${r * s}" fill="#3f8f63" stroke="#6fc08f" stroke-width="1.4"/>`;
    // De gebouwen, met hun dak: een zadeldak met de nok, een plat dak met een rand.
    for (const b of huis.gebouwen) {
      const x = X(b.x), y = Y(b.y + b.d), w = b.w * s, h = b.d * s, kies = o.kies === b.id;
      const rand = b.bron === 'bewoner' ? '#6fd3ff' : b.bron === 'schatting' ? 'rgb(255 255 255 / 0.75)' : '#6ee7b7';
      out += `<rect x="${x + 5}" y="${y + 7}" width="${w}" height="${h}" fill="rgb(0 0 0 / 0.3)"/>`;
      if (b.dak === 'zadel') {
        out += `<rect x="${x}" y="${y}" width="${w}" height="${h / 2}" fill="#5d6a80"/><rect x="${x}" y="${y + h / 2}" width="${w}" height="${h / 2}" fill="#4a566b"/>`;
        out += `<path d="M${x} ${y + h / 2}H${x + w}" stroke="#c9d3dc" stroke-width="2.2"/>`;
        if (o.panelen !== false) for (let r = 0, n = b.kolommen ?? 6; r < 2; r++) for (let k = 0; k < n; k++) out += `<rect x="${x + 12 + k * (w - 24) / n}" y="${y + h / 2 + 8 + r * 0.95 * s}" width="${(w - 24) / n - 3}" height="${0.9 * s}" rx="1.5" fill="#3f6f9e" stroke="#9cc0e4" stroke-width="0.7"/>`;
      } else {
        out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${b.dak === 'lessenaar' ? '#55617a' : '#4f5b70'}"/><rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" fill="none" stroke="rgb(255 255 255 / 0.16)"/>`;
      }
      out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${kies ? '#ffffff' : rand}" stroke-width="${kies ? 3 : 2}" ${b.bron !== 'kaart' && !kies ? 'stroke-dasharray="6 4"' : ''}/>`;
      if (o.namen !== false) out += `<text x="${x + w / 2}" y="${y + (b.dak === 'zadel' ? h / 4 + 5 : h / 2 + 5)}" text-anchor="middle" ${FONT} font-size="${w > 70 ? 13 : 11}" font-weight="700" fill="#eef3f7">${b.naam}</text>`;
      if (kies) {
        for (const [hx, hy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) out += `<rect x="${hx - 6}" y="${hy - 6}" width="12" height="12" rx="3" fill="#fff" stroke="#0b1424" stroke-width="1.5"/>`;
        out += `<circle cx="${x + w + 22}" cy="${y + h + 22}" r="11" fill="#13213a" stroke="#fff" stroke-width="1.5"/><path d="M${x + w + 17} ${y + h + 24}a5.5 5.5 0 1 1 3 4.4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`;
        out += maat(x, y + h + 18, x + w, y + h + 18, `${nl(b.w)} m`) + maat(x + w + (huis.buren ? 2.6 * s + 16 : 20), y, x + w + (huis.buren ? 2.6 * s + 16 : 20), y + h - 14, `${nl(b.d)} m`);
      }
    }
    // Noordpijl.
    out += `<g transform="translate(${W - 34} 34) rotate(-28)"><circle r="17" fill="rgb(255 255 255 / 0.06)" stroke="rgb(255 255 255 / 0.2)"/><path d="M0 -12L5 4L0 1L-5 4Z" fill="#eef3f7"/></g><text x="${W - 34}" y="${68}" text-anchor="middle" ${FONT} font-size="11" font-weight="700" fill="rgb(255 255 255 / 0.55)">N</text>`;
    return out + '</svg>';
  }

  /**
   * Het huis opzij, doorgesneden van voor naar achter: de etages als lagen met
   * hun hoogte, het schuine dak met het knieschot, de uitbouw achter en de
   * garage erachter als silhouet. opts.kies: het id van een etage.
   */
  function doorsnede(o = {}) {
    const W = o.breed ?? 560, H = o.hoog ?? 470;
    const s = 33, oy = H - 76; // 33 px per meter
    const ox = (W - 12.9 * s) / 2 + 1.3 * s;
    const X = (y) => ox + y * s, Z = (z) => oy - z * s;
    const ho = g('hoofd'), ui = g('uitbouw');
    let out = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Het huis opzij doorgesneden, met drie etages">`;
    out += '<defs><pattern id="ho-arc" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V8" stroke="rgb(255 160 110 / 0.35)" stroke-width="2"/></pattern><pattern id="ho-grond" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r="1" fill="rgb(160 120 80 / 0.4)"/><circle cx="9" cy="10" r="1" fill="rgb(160 120 80 / 0.3)"/></pattern></defs>';
    // Grond.
    out += `<rect x="0" y="${oy}" width="${W}" height="${H - oy}" fill="#3a2c22"/><rect x="0" y="${oy}" width="${W}" height="${H - oy}" fill="url(#ho-grond)"/><rect x="0" y="${oy - 4}" width="${W}" height="6" fill="#3f7d55"/>`;
    // De garage, achter de doorsnede (een silhouet).
    // Het hoofdhuis: muren en het dak.
    const knie = HUIS.etages[0].knie, vz = HUIS.etages[0].van;
    const dak = `M${X(0)} ${Z(ho.goot)}L${X(ho.d / 2)} ${Z(ho.nok)}L${X(ho.d)} ${Z(ho.goot)}`;
    // De lagen.
    for (const e of HUIS.etages) {
      const kies = o.kies === e.id;
      const kl = kies ? 'rgb(111 211 255 / 0.20)' : 'rgb(255 255 255 / 0.06)';
      if (e.dak) {
        out += `<path d="M${X(0)} ${Z(e.van)}V${Z(ho.goot)}L${X(ho.d / 2)} ${Z(ho.nok)}L${X(ho.d)} ${Z(ho.goot)}V${Z(e.van)}Z" fill="${kl}"/>`;
        // Lager dan 1,5 m: niet om in te staan.
        const t = (ho.nok - ho.goot) / (ho.d / 2), b = (1.5 - knie) / t;
        out += `<path d="M${X(0)} ${Z(vz)}V${Z(ho.goot)}L${X(b)} ${Z(vz + 1.5)}V${Z(vz)}Z" fill="url(#ho-arc)"/><path d="M${X(ho.d)} ${Z(vz)}V${Z(ho.goot)}L${X(ho.d - b)} ${Z(vz + 1.5)}V${Z(vz)}Z" fill="url(#ho-arc)"/>`;
        out += `<path d="M${X(b)} ${Z(vz + 1.5)}H${X(ho.d - b)}" stroke="rgb(255 160 110 / 0.5)" stroke-dasharray="3 4"/>`;
      } else {
        out += `<rect x="${X(0)}" y="${Z(e.tot)}" width="${ho.d * s}" height="${(e.tot - e.van) * s}" fill="${kl}"/>`;
      }
      if (kies) out += `<path d="M${X(0)} ${Z(e.van)}H${X(e.id === 'bg' ? ui.y + ui.d : ho.d)}" stroke="#6fd3ff" stroke-width="3"/>`;
    }
    // De uitbouw.
    out += `<rect x="${X(ui.y)}" y="${Z(ui.goot)}" width="${ui.d * s}" height="${ui.goot * s}" fill="${o.kies === 'bg' ? 'rgb(111 211 255 / 0.20)' : 'rgb(255 255 255 / 0.06)'}" stroke="#c9d3dc" stroke-width="2.5"/>`;
    // Vloeren en muren.
    out += `<path d="M${X(0)} ${Z(0)}V${Z(ho.goot)}M${X(ho.d)} ${Z(0)}V${Z(ho.goot)}" stroke="#c9d3dc" stroke-width="3"/>`;
    out += `<path d="${dak}" fill="none" stroke="#c9d3dc" stroke-width="3" stroke-linejoin="round"/><path d="M${X(-0.5)} ${Z(ho.goot - 0.45)}L${X(ho.d / 2)} ${Z(ho.nok + 0.05)}L${X(ho.d + 0.5)} ${Z(ho.goot - 0.45)}" fill="none" stroke="#7b879a" stroke-width="5" stroke-linejoin="round"/>`;
    for (const z of [2.8, 5.6]) out += `<path d="M${X(0)} ${Z(z)}H${X(ho.d)}" stroke="#c9d3dc" stroke-width="2.5"/>`;
    // De namen van de lagen, in de lagen.
    const naam = (e, zMid, extra) => `<text x="${X(ho.d / 2)}" y="${Z(zMid) - 2}" text-anchor="middle" ${FONT} font-size="15" font-weight="700" fill="${o.kies === e.id ? '#a9e6ff' : '#eef3f7'}">${e.naam}</text><text x="${X(ho.d / 2)}" y="${Z(zMid) + 16}" text-anchor="middle" ${FONT} font-size="12" fill="rgb(255 255 255 / 0.6)">${extra}</text>`;
    out += naam(HUIS.etages[2], 1.4, '2,8 m hoog');
    out += naam(HUIS.etages[1], 4.2, '2,8 m hoog');
    out += naam(HUIS.etages[0], 7.0, 'knieschot 0,7 m · nok 4,6 m');
    out += `<text x="${X(ui.y + ui.d / 2)}" y="${Z(1.5)}" text-anchor="middle" ${FONT} font-size="12.5" font-weight="700" fill="#eef3f7">Uitbouw</text><text x="${X(ui.y + ui.d / 2)}" y="${Z(1.5) + 16}" text-anchor="middle" ${FONT} font-size="11.5" fill="rgb(255 255 255 / 0.55)">plat dak</text>`;
    // Hoogtes links: goot en nok.
    out += maat(X(-1.3), Z(0), X(-1.3), Z(ho.goot), `goot ${nl(ho.goot)} m`, { kleur: 'rgb(110 231 183 / 0.6)', tekst: '#6ee7b7' });
    out += `<path d="M${X(ho.d / 2)} ${Z(ho.nok) - 10}V${Z(ho.nok) - 26}" stroke="rgb(110 231 183 / 0.6)"/><rect x="${X(ho.d / 2) - 48}" y="${Z(ho.nok) - 48}" width="96" height="22" rx="7" fill="#13213a" stroke="rgb(110 231 183 / 0.4)"/><text x="${X(ho.d / 2)}" y="${Z(ho.nok) - 33}" text-anchor="middle" ${FONT} font-size="12" font-weight="700" fill="#6ee7b7">nok ${nl(ho.nok)} m · 43°</text>`;
    // Kelder erbij, gestippeld onder de grond.
    if (o.kelder !== false) out += `<rect x="${X(0)}" y="${Z(0) + 10}" width="${ho.d * s}" height="34" rx="10" fill="none" stroke="rgb(111 211 255 / 0.55)" stroke-dasharray="6 5"/><text x="${X(ho.d / 2)}" y="${Z(0) + 32}" text-anchor="middle" ${FONT} font-size="13" font-weight="700" fill="#6fd3ff">+ Kelder erbij</text>`;
    // Voor en achter.
    out += `<text x="${X(0)}" y="${oy + 66}" ${FONT} font-size="11" font-weight="700" letter-spacing="1.5" fill="rgb(255 255 255 / 0.4)">‹ STRAAT · VOOR</text><text x="${X(ui.y + ui.d)}" y="${oy + 66}" text-anchor="end" ${FONT} font-size="11" font-weight="700" letter-spacing="1.5" fill="rgb(255 255 255 / 0.4)">ACHTER · TUIN ›</text>`;
    return out + '</svg>';
  }

  /**
   * Eén etage van boven met zijn kamers. opts: etage (id), breed, hoog;
   * indeling (eigen bomen per gebouw); kies (het pad van een vak, 'hoofd:b'),
   * lijn ({ gebouw, as, op, binnen: pad }) een lijn die je net zet;
   * apparaten (lijst { kamer, x, y, icoon, kleur, nieuw }); wachtend: een
   * plek om naartoe te slepen ({ x, y } in meters); gedimd: true om alleen
   * de vormen te tonen.
   */
  function plattegrond(o = {}) {
    const W = o.breed ?? 560, H = o.hoog ?? 470;
    const etage = HUIS.etages.find((e) => e.id === (o.etage ?? 'bg'));
    const indeling = o.indeling ?? INDELING[etage.id];
    // Dezelfde maat voor elke etage: alles wat op de grond staat, behalve het tuinhuis.
    const alle = HUIS.gebouwen.filter((b) => b.id !== 'tuinhuis');
    const minX = Math.min(...alle.map((b) => b.x)) - 1.6, maxX = Math.max(...alle.map((b) => b.x + b.w)) + 1.2;
    const minY = Math.min(...alle.map((b) => b.y)) - 1.2, maxY = Math.max(...alle.map((b) => b.y + b.d)) + 1.6;
    const s = Math.min(W / (maxX - minX), H / (maxY - minY));
    const ox = (W - (maxX - minX) * s) / 2 - minX * s, oy = H - (H - (maxY - minY) * s) / 2 + minY * s;
    const X = (x) => ox + x * s, Y = (y) => oy - y * s;
    let out = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${etage.naam} van boven, met de kamers">`;
    out += '<defs><pattern id="ho-laag" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V7" stroke="rgb(255 160 110 / 0.3)" stroke-width="2"/></pattern></defs>';
    // Wat niet op deze etage staat: gestippeld, met wat het is.
    for (const b of alle.filter((b) => !etage.op.includes(b.id))) {
      out += `<rect x="${X(b.x)}" y="${Y(b.y + b.d)}" width="${b.w * s}" height="${b.d * s}" fill="rgb(255 255 255 / 0.025)" stroke="rgb(255 255 255 / 0.2)" stroke-dasharray="5 5"/>`;
      out += `<text x="${X(b.x + b.w / 2)}" y="${Y(b.y + b.d / 2) + 4}" text-anchor="middle" ${FONT} font-size="11.5" font-weight="600" fill="rgb(255 255 255 / 0.35)">dak ${b.naam.toLowerCase()}</text>`;
    }
    const lijnen = [], omtrek = [];
    for (const id of etage.op) {
      const b = g(id), boom = indeling[id];
      if (!boom) continue;
      const v = vakken(boom, { x: 0, y: 0, w: b.w, d: b.d }, undefined, id + ':');
      // Vakken met dezelfde kamer zijn samen één ruimte: zo kan een kamer om een hal heen lopen (een L of een U).
      const sleutel = (vak) => vak.blad.k ?? `${vak.blad.naam ?? ''}|${vak.pad}`;
      const ruimtes = new Map();
      for (const vak of v.vak) { const k = sleutel(vak); if (!ruimtes.has(k)) ruimtes.set(k, []); ruimtes.get(k).push(vak); }
      const gekozen = (vak) => o.kies === vak.pad || o.kies === `kamer:${vak.blad.k}`;
      for (const vak of v.vak) {
        const r = vak.r, km = vak.blad.k ? KAMERS[vak.blad.k] : null;
        const tint = TINT[km?.soort ?? 'leeg'];
        const x = X(b.x + r.x), y = Y(b.y + r.y + r.d), w = r.w * s, h = r.d * s;
        const kies = gekozen(vak), leeg = !km && !vak.blad.naam;
        out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgb(${tint} / ${o.gedimd ? 0.05 : kies ? 0.3 : km ? 0.16 : 0.06})"/>`;
        if (leeg) out += `<rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h - 12}" rx="10" fill="none" stroke="rgb(247 181 72 / 0.7)" stroke-width="1.6" stroke-dasharray="6 5"/>`;
        // Het lage deel onder het schuine dak.
        if (etage.dak) {
          const b15 = 0.86 * s;
          out += `<rect x="${x}" y="${y}" width="${w}" height="${b15}" fill="url(#ho-laag)"/><rect x="${x}" y="${y + h - b15}" width="${w}" height="${b15}" fill="url(#ho-laag)"/>`;
          out += `<text x="${x + w / 2}" y="${y + b15 / 2 + 4}" text-anchor="middle" ${FONT} font-size="11" font-weight="600" fill="rgb(255 190 150 / 0.8)">lager dan 1,5 m</text><text x="${x + w / 2}" y="${y + h - b15 / 2 + 4}" text-anchor="middle" ${FONT} font-size="11" font-weight="600" fill="rgb(255 190 150 / 0.8)">lager dan 1,5 m</text>`;
        }
      }
      // De naam één keer per ruimte, in zijn grootste vak, met de oppervlakte van alles samen.
      for (const [, delen] of ruimtes) {
        const vak = delen.reduce((a, c) => (c.r.w * c.r.d > a.r.w * a.r.d ? c : a));
        if (o.gedimd || o.geenNamen || vak.blad.wacht) continue;
        const r = vak.r, km = vak.blad.k ? KAMERS[vak.blad.k] : null, tint = TINT[km?.soort ?? 'leeg'];
        const x = X(b.x + r.x), y = Y(b.y + r.y + r.d), w = r.w * s, h = r.d * s, leeg = !km && !vak.blad.naam;
        const cx = x + w / 2, cy = y + h / 2 - (o.apparaten ? h * 0.22 : 0);
        const naam = km?.naam ?? vak.blad.naam ?? 'Nog leeg';
        const m2 = nl(delen.reduce((t, d) => t + d.r.w * d.r.d, 0), 0) + ' m²';
        const klein = w < 90 || h < 70, plat = h < 110;
        const ik = km?.icoon ?? vak.blad.icoon;
        const vorm = delen.length === 3 ? 'U-vorm' : delen.length === 2 ? 'L-vorm' : 'één ruimte';
        if (ik && !klein && !plat && !o.apparaten) out += icoon(ik, cx - 13, cy - 44, 26, `rgb(${tint})`);
        out += `<text x="${cx}" y="${cy + (klein ? 2 : 0)}" text-anchor="middle" ${FONT} font-size="${klein ? 12 : 15.5}" font-weight="700" fill="${km ? '#eef3f7' : leeg ? '#ffd38a' : 'rgb(255 255 255 / 0.7)'}">${naam}</text>`;
        if (!o.apparaten) out += `<text x="${cx}" y="${cy + (klein ? 17 : 19)}" text-anchor="middle" ${FONT} font-size="${klein ? 10.5 : 12}" fill="rgb(255 255 255 / 0.5)">${km || !klein ? m2 : ''}${!km && vak.blad.naam && !klein ? ' · niet in HA' : ''}${delen.length > 1 && km && !klein ? ` · ${vorm}` : ''}</text>`;
      }
      // Muren alleen tussen verschillende ruimtes; de rand van een gekozen ruimte om alle delen heen.
      const bij = (a, c) => Math.abs(a - c) < 0.001;
      const over = (a1, a2, b1, b2) => (Math.max(a1, b1) < Math.min(a2, b2) - 0.001 ? [Math.max(a1, b1), Math.min(a2, b2)] : null);
      for (const A of v.vak) for (const B of v.vak) {
        if (A === B) continue;
        const ra = A.r, rb = B.r;
        let seg = null;
        if (bij(ra.x + ra.w, rb.x)) { const o2 = over(ra.y, ra.y + ra.d, rb.y, rb.y + rb.d); if (o2) seg = [ra.x + ra.w, o2[0], ra.x + ra.w, o2[1]]; }
        if (bij(ra.y + ra.d, rb.y)) { const o2 = over(ra.x, ra.x + ra.w, rb.x, rb.x + rb.w); if (o2) seg = [o2[0], ra.y + ra.d, o2[1], ra.y + ra.d]; }
        if (seg && sleutel(A) !== sleutel(B)) lijnen.push([X(b.x + seg[0]), Y(b.y + seg[1]), X(b.x + seg[2]), Y(b.y + seg[3])]);
      }
      for (const vak of v.vak.filter(gekozen)) {
        const r = vak.r;
        const zelfde = v.vak.filter((w2) => w2 !== vak && sleutel(w2) === sleutel(vak));
        const randen = [['h', r.y, r.x, r.x + r.w, 'onder'], ['h', r.y + r.d, r.x, r.x + r.w, 'boven'], ['v', r.x, r.y, r.y + r.d, 'links'], ['v', r.x + r.w, r.y, r.y + r.d, 'rechts']];
        for (const [as, op, a1, a2, kant] of randen) {
          // Wat van deze rand tegen een deel van dezelfde ruimte ligt, valt weg.
          let stukken = [[a1, a2]];
          for (const z of zelfde) {
            const zr = z.r;
            let tegen = null;
            if (kant === 'boven' && bij(zr.y, op)) tegen = [zr.x, zr.x + zr.w];
            if (kant === 'onder' && bij(zr.y + zr.d, op)) tegen = [zr.x, zr.x + zr.w];
            if (kant === 'rechts' && bij(zr.x, op)) tegen = [zr.y, zr.y + zr.d];
            if (kant === 'links' && bij(zr.x + zr.w, op)) tegen = [zr.y, zr.y + zr.d];
            if (!tegen) continue;
            stukken = stukken.flatMap(([p1, p2]) => [[p1, Math.min(p2, tegen[0])], [Math.max(p1, tegen[1]), p2]].filter(([q1, q2]) => q2 - q1 > 0.001));
          }
          for (const [p1, p2] of stukken) omtrek.push(as === 'h' ? [X(b.x + p1), Y(b.y + op), X(b.x + p2), Y(b.y + op)] : [X(b.x + op), Y(b.y + p1), X(b.x + op), Y(b.y + p2)]);
        }
      }
      // De buitenmuur.
      out += `<rect x="${X(b.x)}" y="${Y(b.y + b.d)}" width="${b.w * s}" height="${b.d * s}" fill="none" stroke="#dfe6ec" stroke-width="5"/>`;
    }
    for (const [x1, y1, x2, y2] of lijnen) out += `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#c9d3dc" stroke-width="2.5"/>`;
    for (const [x1, y1, x2, y2] of omtrek) out += `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#6fd3ff" stroke-width="3.5" stroke-linecap="round"/>`;
    // Zones: een stippellijn binnen een ruimte, met een greep om hem te verschuiven en de namen aan weerszijden.
    for (const z of o.zones ?? []) {
      const b = g(z.gebouw ?? 'hoofd');
      const v = vakken(indeling[b.id], { x: 0, y: 0, w: b.w, d: b.d });
      for (const vak of v.vak.filter((w2) => w2.blad.k === z.kamer && w2.r.y < z.op && w2.r.y + w2.r.d > z.op)) {
        const x1 = X(b.x + vak.r.x) + 4, x2 = X(b.x + vak.r.x + vak.r.w) - 4, yy = Y(b.y + z.op), mid = (x1 + x2) / 2 + 14;
        out += `<path d="M${x1} ${yy}H${x2}" stroke="#6ee7b7" stroke-width="2.5" stroke-dasharray="7 6"/>`;
        const chip = (tekst, cy) => `<rect x="${mid - tekst.length * 3.6 - 10}" y="${cy - 11}" width="${tekst.length * 7.2 + 20}" height="22" rx="11" fill="#173a35" stroke="rgb(110 231 183 / 0.5)"/><text x="${mid}" y="${cy + 4.5}" text-anchor="middle" ${FONT} font-size="12" font-weight="700" fill="#6ee7b7">${tekst}</text>`;
        out += chip(`${z.namen[0]} ↓`, yy + 19) + chip(`${z.namen[1]} ↑`, yy - 19);
        if (z.greep) out += `<circle cx="${x1 + 16}" cy="${yy}" r="11" fill="#6ee7b7" stroke="#0b1424" stroke-width="2"/><path d="M${x1 + 16} ${yy - 5}v10M${x1 + 13} ${yy - 2}l3 -3 3 3M${x1 + 13} ${yy + 2}l3 3 3 -3" stroke="#0b1424" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
      }
    }
    // De voordeur: aan de voorgevel, of opzij als de hal daar ligt.
    if (etage.id === 'bg' && o.deur === 'rechts') {
      const b = g('hoofd'), xx = X(b.x + b.w), y1 = Y(3.6), y2 = Y(4.6);
      out += `<path d="M${xx} ${y1}V${y2}" stroke="#f7b548" stroke-width="5"/><text x="${xx + 9}" y="${(y1 + y2) / 2 + 4}" ${FONT} font-size="11" font-weight="700" fill="#f7b548">deur</text>`;
    } else if (etage.id === 'bg') out += `<path d="M${X(1)} ${Y(0)}a${1 * s} ${1 * s} 0 0 0 ${1 * s} ${-1 * s}" fill="none" stroke="rgb(247 181 72 / 0.7)" stroke-width="1.5"/><path d="M${X(1)} ${Y(0)}h${1 * s}" stroke="#f7b548" stroke-width="5"/><text x="${X(1.5)}" y="${Y(0) + 18}" text-anchor="middle" ${FONT} font-size="11" font-weight="700" fill="#f7b548">voordeur</text>`;
    // Een lijn die je net zet: gestippeld, met grepen en de maten aan weerszijden.
    if (o.lijn) {
      const b = g(o.lijn.gebouw), r = o.lijn.r;
      if (o.lijn.as === 'y') {
        const yy = Y(b.y + r.y + o.lijn.op), x1 = X(b.x + r.x), x2 = X(b.x + r.x + r.w);
        out += `<path d="M${x1} ${yy}H${x2}" stroke="#6fd3ff" stroke-width="3.5" stroke-dasharray="9 6"/>`;
        for (const xx of [x1, x2]) out += `<circle cx="${xx}" cy="${yy}" r="11" fill="#6fd3ff" stroke="#0b1424" stroke-width="2"/><path d="M${xx} ${yy - 5}v10M${xx - 3} ${yy - 2}l3 -3 3 3M${xx - 3} ${yy + 2}l3 3 3 -3" stroke="#0b1424" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
        const mx = X(b.x + r.x) + 30;
        out += maat(mx, Y(b.y + r.y), mx, yy, `${nl(o.lijn.op)} m`, { kleur: 'rgb(111 211 255 / 0.8)', tekst: '#a9e6ff' });
        out += maat(mx, yy, mx, Y(b.y + r.y + r.d), `${nl(r.d - o.lijn.op)} m`, { kleur: 'rgb(111 211 255 / 0.8)', tekst: '#a9e6ff' });
      }
    }
    // Apparaten: een rondje met hun icoon, op hun plek in de kamer.
    for (const a of o.apparaten ?? []) {
      const b = g(a.gebouw ?? 'hoofd'), x = X(b.x + a.x), y = Y(b.y + a.y);
      out += `<circle cx="${x}" cy="${y}" r="15" fill="${a.nieuw ? '#f2f6f9' : '#13213a'}" stroke="${a.nieuw ? '#f7b548' : 'rgb(255 255 255 / 0.3)'}" stroke-width="${a.nieuw ? 2.5 : 1.2}"/>` + icoon(a.icoon, x - 9.5, y - 9.5, 19, a.nieuw ? '#0b1424' : a.kleur ?? '#eef3f7');
    }
    // Maten langs de buitenkant van het hoofdhuis.
    if (o.maten !== false) {
      const b = g('hoofd');
      out += maat(X(b.x), Y(b.y) + 22 + (etage.id === 'bg' ? 12 : 0), X(b.x + b.w), Y(b.y) + 22 + (etage.id === 'bg' ? 12 : 0), `${nl(b.w)} m`);
      if (!etage.op.includes('uitbouw') || etage.id !== 'bg') out += maat(X(b.x + b.w) + 20, Y(b.y), X(b.x + b.w) + 20, Y(b.y + b.d), `${nl(b.d)} m`);
      else out += maat(X(b.x + b.w) + 20, Y(b.y), X(b.x + b.w) + 20, Y(b.y + b.d + g('uitbouw').d), `${nl(b.d + g('uitbouw').d)} m`);
    }
    return out + '</svg>';
  }

  /** Een kleine plattegrond voor de keuze van een indeling: alleen vakken en hun naam. */
  function sjabloon(bomen, o = {}) {
    const W = o.breed ?? 140, H = o.hoog ?? 112;
    const hb = g('hoofd'), ub = g('uitbouw');
    const totW = hb.w, totD = hb.d + ub.d;
    const s = Math.min((W - 12) / totW, (H - 12) / totD);
    const ox = (W - totW * s) / 2, oy = H - (H - totD * s) / 2;
    const X = (x) => ox + x * s, Y = (y) => oy - y * s;
    let out = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`;
    for (const [id, b] of [['hoofd', hb], ['uitbouw', ub]]) {
      const boom = bomen[id];
      if (!boom) continue;
      const v = vakken(boom, { x: 0, y: 0, w: b.w, d: b.d });
      for (const vak of v.vak) {
        const km = vak.blad.k ? KAMERS[vak.blad.k] : null, tint = TINT[km?.soort ?? 'leeg'];
        const x = X(b.x + vak.r.x), y = Y(b.y + vak.r.y + vak.r.d), w = vak.r.w * s, h = vak.r.d * s;
        out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgb(${tint} / ${km ? 0.28 : 0.08})"/>`;
        if (w > 30 && h > 16) out += `<text x="${x + w / 2}" y="${y + h / 2 + 3.5}" text-anchor="middle" ${FONT} font-size="9.5" font-weight="700" fill="rgb(255 255 255 / 0.85)">${(km?.naam ?? vak.blad.naam ?? '').replace('kamer', '').replace(/^Woon$/, 'Woon')}</text>`;
      }
      for (const l of v.lijn) out += `<path d="M${X(b.x + l.x1)} ${Y(b.y + l.y1)}L${X(b.x + l.x2)} ${Y(b.y + l.y2)}" stroke="rgb(255 255 255 / 0.6)" stroke-width="1.3"/>`;
      out += `<rect x="${X(b.x)}" y="${Y(b.y + b.d)}" width="${b.w * s}" height="${b.d * s}" fill="none" stroke="#dfe6ec" stroke-width="2"/>`;
    }
    return out + '</svg>';
  }

  /** Vier gangbare indelingen voor de begane grond van dit huis, met dezelfde drie kamers. */
  const SJABLONEN_BG = [
    { naam: 'Hal opzij', zin: 'woonkamer van voor naar achter', bomen: INDELING.bg },
    { naam: 'Hal voor', zin: 'woonkamer achter, aan de tuin', bomen: { hoofd: { as: 'y', op: 3, a: { as: 'x', op: 4, a: { k: 'hal' }, b: { naam: 'Werk' } }, b: { k: 'woonkamer' } }, uitbouw: { k: 'keuken' } } },
    { naam: 'Open keuken', zin: 'keuken en woonkamer samen', bomen: { hoofd: { as: 'x', op: 3, a: { k: 'hal' }, b: { k: 'woonkamer' } }, uitbouw: { k: 'woonkamer' } } },
    { naam: 'Hal midden', zin: 'kamer links en rechts', bomen: { hoofd: { as: 'x', op: 3.6, a: { k: 'woonkamer' }, b: { as: 'x', op: 2.2, a: { k: 'hal' }, b: { naam: 'Eet' } } }, uitbouw: { k: 'keuken' } } },
  ];

  global.huisontwerp = { HUIS, KAMERS, TINT, INDELING, SJABLONEN_BG, vakken, vanBoven, doorsnede, plattegrond, sjabloon };
})(typeof window !== 'undefined' ? window : globalThis);
