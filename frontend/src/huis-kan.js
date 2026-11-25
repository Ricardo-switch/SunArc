/*
 * Wat je huis kan: de ene standpagina (besluit 322, schets Wand-Stand-Een en
 * Tel-Stand-Een). Wat je huis kan, Hoe ver je huis is en Nog te doen zijn hier
 * één pagina. Links de zonnewaaier met daaronder wat er nog bij kan, elk met
 * de knop op de regel; rechts eerst wat echt ontbreekt, dan elke functie op
 * één regel met zijn stand, in dezelfde groepen als de waaier; onderaan de weg
 * naar zelf regelen. Een tik op een functie of een straal opent het blad met
 * de uitleg. Wat er staat, rekent stand.js uit; deze pagina zet het neer.
 */
'use strict';

const { $$, esc } = app;

const d = { site: null, huis: null, functies: null, energie: null, aansluiting: null, state: null, divergence: null, opbrengst: null, accu: null, thermisch: null, zon: null, klaar: null, sluip: null };

async function laadAlles() {
  const deuren = { site: 'api/site', huis: 'api/huis', functies: 'api/functies', energie: 'api/energie', aansluiting: 'api/aansluiting', state: 'api/state', divergence: 'api/divergence', opbrengst: 'api/opbrengst?soort=maand', accu: 'api/accu', thermisch: 'api/thermisch', zon: 'api/zon', klaar: 'api/klaarzetten', sluip: 'api/sluipverbruik' };
  // Tekenen zodra het huis bekend is, en bij elke bron die daarna binnenkomt (basis.js).
  await app.laadBronnen(deuren, d, teken, ['site', 'huis', 'functies']);
  // De som van de thuisbatterij loopt op de achtergrond (eerst 503 met wachten): even later nog eens, tot een minuut.
  for (let i = 0; i < 12 && d.accu == null; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch('api/accu', { cache: 'no-store' }).catch(() => null);
    if (res?.ok) {
      d.accu = await res.json().catch(() => null);
      teken();
    } else if (res?.status !== 503) break;
  }
}

const DAG = 86_400_000;
const TREDEN = ['gevonden', 'geleerd', 'kijkt', 'werkt'];
const KLEUR = { ...waaier.KLEUR, uit: 'var(--gedempt)', mis: 'var(--gloed)' };
// Hoe je huis warmte vasthoudt is sinds besluit 345 deel van Op tijd warm of koel: een oude link komt daar uit.
const gekozen = () => { const id = decodeURIComponent(location.hash.slice(1)); return id === 'thermisch' ? 'optijd' : id; };
const datum = (ms) => taal.datum(ms, { day: 'numeric', month: 'long' });
const pct = (n) => `${Math.round(n)}%`;

/* ------------------------------------------------------------ tekenen */

/** Bovenin: hoeveel er werkt, meekijkt en leert, en hoeveel er nog bij kan. */
function tellers(v, erbij) {
  const rij = (kleur, naam, n) => (n ? `<span><i class="stip" style="background: ${kleur}"></i>${esc(naam)} <b>${n}</b></span>` : '');
  return ['werkt', 'kijkt', 'leert'].map((s) => rij(KLEUR[s], t(`kan.stand.${s}`), v.tel(s))).join('') + rij('var(--zon)', t('stand1.kanErbij'), erbij.length);
}

/** Eerst dit en Kan er nog bij: de som staat in stand.js, dezelfde als op Instellingen. */
const eerstLijst = () => stand.eerstDit(d);
const erbijLijst = () => stand.erbij(d);

function eerst(lijst) {
  if (!lijst.length) return '';
  // Hooguit drie, elk met zijn knop; het eerste heet Eerst dit.
  const rest = lijst.length - 3;
  const regel = (x, i) => `<div class="regel"><div class="tekst"><b>${i ? '' : '<i class="stip"></i>'}${esc(i ? x.wat : t('stand1.eerst', { wat: x.wat }))}</b><span class="zin">${esc(x.zin)}${i === 2 && rest > 0 ? ` <span class="daarna">${esc(t('stand1.daarna', { n: rest }))}</span>` : ''}</span></div><a class="knopje" href="${x.href}">${esc(x.knop)} ›</a></div>`;
  return `<div class="eerst">${lijst.slice(0, 3).map(regel).join('')}</div>`;
}

function erbij(lijst) {
  if (!lijst.length) return '';
  const knop = (x) => (x.href ? `<a class="knopje zacht" href="${x.href}">${esc(x.knop)} ›</a>` : `<button type="button" class="knopje zacht" data-open="${x.open}">${esc(x.knop)} ›</button>`);
  return `<div class="glas groep erbij"><h3>${esc(t('stand1.erbij'))}</h3>${lijst.map((x) => `<div class="func"><span class="naam">${esc(x.titel)}<span>${esc(x.zin ?? '')}</span></span>${knop(x)}</div>`).join('')}</div>`;
}

/** Elke functie op één regel met zijn stand, in dezelfde groepen als de waaier. */
function groep(g) {
  const naam = t(g.id === 'leert' ? 'kan.groep.leert' : `kan.groep.${g.id}`);
  const rij = (x) => `<button type="button" class="func${gekozen() === x.id ? ' gekozen' : ''}" data-open="${x.id}"><span class="naam">${esc(x.titel)}<span${x.let ? ' class="let"' : ''}>${esc(x.nu ?? '')}</span></span><span class="stand ${x.stand}"><i class="stip"></i>${esc(x.label)}</span></button>`;
  return `<div class="glas groep"><h3>${esc(naam)}</h3>${g.onderwerpen.map(rij).join('')}</div>`;
}

function groepen(v) {
  const vol = v.groepen.filter((g) => g.onderwerpen.length);
  // Op de wand twee kolommen: links gemak, overzicht en comfort, rechts wat het leert, op zon en kosten.
  const links = vol.filter((g) => ['gemak', 'overzicht', 'comfort'].includes(g.id));
  const rechts = vol.filter((g) => !links.includes(g));
  return `<div class="kolom">${links.map(groep).join('')}</div><div class="kolom">${rechts.map(groep).join('')}</div>`;
}

/** Of dit het huis met de wintertest is: een oude regeling ernaast (besluit 312, api/site › migrating). */
const wintertest = () => d.site?.migrating === true;

/**
 * De mijlpalen op de weg naar zelf regelen. De winter telt van december tot en
 * met februari; het moment met genoeg winterdagen is op zijn vroegst, want ook
 * elke stand moet gezien zijn.
 */
function mijlpalen(v) {
  const ds = v.dataset;
  const g = v.gereedheid;
  const nu = Date.now();
  const standen = g.dekking >= 100 ? t('voortgang.weg.standen') : t('voortgang.weg.standenPct', { pct: g.dekking });
  // Zonder oude regeling ernaast geen wintertest (besluit 312): SunArc leert per kamer en regelt waar jij dat kiest.
  if (!wintertest()) {
    return [
      { soort: 'klaar', titel: t('voortgang.weg.begin'), zin: datum(ds.vanMs) },
      { soort: 'nu', titel: t('w.nu2'), zin: `${t('voortgang.weg.dagen', { n: Math.round(ds.dagenOpgenomen) })}, ${standen}` },
      { soort: 'doel', titel: t('voortgang.weg.zelf'), zin: t('voortgang.weg.perKamer') },
    ];
  }
  const doel = v.winter?.doel ?? 30;
  const rest = Math.max(0, Math.ceil(doel - (v.winter?.dagen ?? 0)));
  const jaar = new Date(nu).getFullYear();
  const maand = new Date(nu).getMonth();
  const inWinter = maand === 11 || maand <= 1;
  // Het begin en eind van deze of de volgende winter.
  const begin = inWinter ? new Date(maand === 11 ? jaar : jaar - 1, 11, 1).getTime() : new Date(jaar, 11, 1).getTime();
  const eind = new Date(new Date(begin).getFullYear() + 1, 2, 1).getTime();
  let genoeg = null;
  if (rest > 0) {
    const start = Math.max(nu, begin);
    genoeg = start + rest * DAG;
    // Past het niet meer in deze winter, dan de rest in de volgende.
    if (genoeg > eind) genoeg = new Date(new Date(eind).getFullYear(), 11, 1).getTime() + (rest - Math.round((eind - start) / DAG)) * DAG;
  }
  return [
    { soort: 'klaar', titel: t('voortgang.weg.begin'), zin: datum(ds.vanMs) },
    { soort: 'nu', titel: t('w.nu2'), zin: `${t('voortgang.weg.dagen', { n: Math.round(ds.dagenOpgenomen) })}, ${standen}` },
    !inWinter && begin > nu ? { soort: 'winter', titel: t('voortgang.weg.winter'), zin: t('voortgang.weg.winterZin', { datum: datum(begin) }), alleenTel: true } : null,
    { soort: genoeg ? 'straks' : 'klaar', titel: t('voortgang.weg.genoeg', { n: doel }), zin: genoeg ? t('voortgang.weg.vroegst', { datum: datum(genoeg) }) : t('voortgang.weg.gehaald') },
    { soort: 'doel', titel: t('voortgang.weg.zelf'), zin: t('voortgang.weg.ja') },
  ].filter(Boolean);
}

/** De weg naar zelf regelen: de haltes, en drie maten voor hoe ver het meekijken is. */
function weg(v, tel) {
  const g = v.gereedheid;
  const haltes = mijlpalen(v).filter((h) => tel || !h.alleenTel);
  const i = haltes.findIndex((h) => h.soort === 'nu');
  const w = wintertest() ? v.winter : null;
  const maten = [
    w ? [t('voortgang.as.winter'), `${Math.floor(w.dagen)} / ${w.doel}`, w.dagen / w.doel] : null,
    [t('voortgang.as.dekking'), pct(g.dekking), g.dekking / 100],
    w ? [t('voortgang.as.samen'), pct(g.totaal), g.totaal / 100] : null,
  ].filter(Boolean);
  const halte = (h) => `<div class="halte ${h.soort}"><i></i><b>${esc(h.titel)}</b><span>${esc(h.zin)}</span></div>`;
  return `<div class="wegkop"><h3>${esc(t('voortgang.weg.kop'))}</h3><p>${esc(t(!w ? 'voortgang.weg.kamerZin' : g.totaal >= 100 ? 'voortgang.zelf.klaarZin' : 'stand1.wegZin'))}</p></div>
    <div class="lijn" style="--n: ${haltes.length}; --gedaan: ${haltes.length > 1 ? Math.round((i / (haltes.length - 1)) * 100) : 0}%">${haltes.map(halte).join('')}</div>
    <div class="maten">${maten.map(([n, getal, p]) => `<div class="maat">${esc(n)}<span class="meter"><i style="width: ${Math.max(3, Math.min(100, p * 100))}%"></i></span><b>${esc(getal)}</b></div>`).join('')}</div>`;
}

/**
 * Wanneer de accu bijsprong (besluit 230): per uur van de dag wat hij gemiddeld
 * leverde. Een staaf per uur, de hoogste vol; zes, twaalf en zes uur eronder.
 */
function bijspringen(uren) {
  const top = Math.max(...uren, 0.1);
  const staven = uren.map((k, h) => `<i style="height: ${Math.max(k > 0 ? 6 : 2, Math.round((k / top) * 100))}%"${k > 0 ? ' class="aan"' : ''} title="${String(h).padStart(2, '0')}:00 · ${app.nl(k)} kWh"></i>`).join('');
  return `<div class="uren" role="img" aria-label="${esc(t('kan.accu.urenUitleg'))}">${staven}</div><div class="assen"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>`;
}

/**
 * Hoe je huis warmte vasthoudt (besluit 231): een dag zonder verwarming per
 * kamer (Newton, met de tijdconstante uit je eigen nachten), twee getallen voor
 * de eerste kamer die het zeker weet, en per kamer wat het weet met vier
 * streepjes voor hoe zeker.
 */
const KLEUREN = ['var(--zon)', 'var(--ijs)', 'var(--violet)', 'var(--mint)'];
function thermischBlok(r) {
  const zones = r.zones.filter((z) => z.k != null).slice(0, 4);
  const W = 520, H = 112, L = 34, R = 128, T = 8, B = 18, BUITEN = 5, START = 20;
  const temp = (z, u) => BUITEN + (START - BUITEN) * Math.exp(-u * z.k);
  const laagste = Math.floor(Math.min(...zones.map((z) => temp(z, 24))));
  const x = (u) => L + (u / 24) * (W - L - R);
  const y = (c) => T + ((START - c) / (START - laagste)) * (H - T - B);
  let svg = '';
  for (let c = START; c >= laagste; c--) svg += `<line x1="${L}" x2="${W - R}" y1="${y(c)}" y2="${y(c)}"/><text x="${L - 8}" y="${y(c) + 4}" text-anchor="end">${c}°</text>`;
  svg += [[0, '23:00'], [8, '07:00'], [16, '15:00'], [24, '23:00']].map(([u, tijd]) => `<text x="${x(u)}" y="${H - 3}" text-anchor="${u === 0 ? 'start' : u === 24 ? 'end' : 'middle'}">${tijd}</text>`).join('');
  // De namen naast de lijnen, zonder dat ze op elkaar vallen.
  const eind = zones.map((z, i) => ({ z, i, y: y(temp(z, 24)) })).sort((a, b) => a.y - b.y);
  eind.forEach((e, n) => { if (n > 0) e.y = Math.max(e.y, eind[n - 1].y + 13); });
  for (const e of eind) {
    const kleur = KLEUREN[e.i];
    svg += `<path d="${Array.from({ length: 25 }, (_, u) => `${u ? 'L' : 'M'}${x(u).toFixed(1)},${y(temp(e.z, u)).toFixed(1)}`).join(' ')}" stroke="${kleur}" class="lijn"/><circle cx="${x(24)}" cy="${y(temp(e.z, 24))}" r="3.5" fill="${kleur}"/><text x="${x(24) + 9}" y="${e.y + 4}" class="naam" fill="${kleur}">${esc(e.z.naam)} ${app.nl(temp(e.z, 24))}°</text>`;
  }
  const eerste = zones.find((z) => z.zeker.afkoelen >= 2) ?? zones[0];
  const half = Math.round(((Math.LN2 * eerste.tauUur) / 24) * 2) / 2;
  const streepjes = (n) => `<span class="zeker" aria-label="${esc(t('kan.thermisch.zeker', { n }))}">${[1, 2, 3, 4].map((i) => `<i${i <= n ? ' class="ja"' : ''}></i>`).join('')}</span>`;
  const teken = (v, d) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${app.nl(Math.abs(v), d)}°`;
  // Een apparaat heet zonder de naam van zijn kamer: "Airco", niet "Airco woonkamer".
  const kort = (a, z) => {
    const i = a.naam.toLowerCase().indexOf(z.naam.toLowerCase());
    return (i < 0 ? a.naam : `${a.naam.slice(0, i)} ${a.naam.slice(i + z.naam.length)}`.replace(/\s+/g, ' ').trim()) || a.naam;
  };
  const regel = (label, waarde, n, nog) => `<div class="weet"><span title="${esc(label)}">${esc(label)}</span>${nog ? `<b class="nog">${esc(waarde)}</b>` : `<b>${esc(waarde)}</b>`}${streepjes(n)}</div>`;
  const kamers = zones.map((z, i) => `<div><h5><i style="background: ${KLEUREN[i]}"></i>${esc(z.naam)}</h5>
      ${regel(t('kan.thermisch.afkoelen'), `${teken(z.k * 10, 2).replace('+', '')}`, z.zeker.afkoelen)}
      ${regel(t('kan.thermisch.zon'), z.zonPerKw == null ? t('kan.thermisch.nogNiet') : teken(z.zonPerKw, 1), z.zeker.zon, z.zonPerKw == null)}
      ${z.apparaten.map((a) => regel(t(`kan.thermisch.${a.stand}`, { naam: kort(a, z) }), a.perUur != null ? teken(a.perUur, 1) : t(a.kwartieren >= 8 ? 'kan.thermisch.onduidelijk' : 'kan.thermisch.nogNiet'), a.zeker, a.perUur == null)).join('')}</div>`).join('');
  return `<div class="thermisch">
      <div class="bovenin">
        <div class="grafiek"><h4>${esc(t('kan.thermisch.dag', { buiten: BUITEN }))}</h4><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(t('kan.thermisch.dagUitleg'))}">${svg}</svg></div>
        <div class="vast"><div><div class="getal">${teken(-eerste.k * 10 * 8, 1)}<small>${esc(t('kan.thermisch.inEenNacht'))}</small></div><p>${esc(t('kan.thermisch.nachtZin', { kamer: eerste.naam.toLowerCase() }))}</p></div>
          <div><div class="getal klein">± ${app.nl(half, half % 1 ? 1 : 0)} ${esc(t(half === 1 ? 'kan.thermisch.dag1' : 'kan.thermisch.dagen'))}</div><p>${esc(t('kan.thermisch.halfZin', { kamer: eerste.naam.toLowerCase() }))}</p></div></div>
      </div>
      <div class="kamers" style="--n: ${zones.length}">${kamers}</div>
    </div>`;
}

function blad(x) {
  const a = x.som;
  const maat = (k) => app.nl(k, k % 1 ? 1 : 0);
  // Een heel jaar heet zo; korter gemeten, dan het aantal dagen.
  const zin = a
    ? [
        t(a.dagen >= 360 ? 'kan.accu.zinJaar' : 'kan.accu.zin', { dagen: a.dagen, net: app.nl(a.vanNetKwh, 0), gedekt: app.nl(a.gedektKwh, 0), tekort: app.nl(a.tekortKwh, 0), kwh: maat(a.kwh) }),
        a.legeDagen ? t('kan.accu.leeg', { n: a.legeDagen, dagen: a.dagen }) : '',
        a.groter ? (a.groter.meerKwh >= 1 ? t('kan.accu.groter', { kwh: maat(a.groter.kwh), meer: app.nl(a.groter.meerKwh, 0) }) : t('kan.accu.groterNiet')) : '',
        t('kan.accu.schatting'),
      ].filter(Boolean).join(' ')
    : '';
  const som = a
    ? `<div class="som"><div class="somtop"><div><h4>${esc(t('kan.accu.past'))}</h4><div class="getal">${maat(a.kwh)} <small>kWh</small></div></div><div><h4>${esc(t('kan.opleveren'))}</h4><div class="getal">± ${taal.valuta()} ${a.euro} <small>${esc(t('kan.perMaand'))}</small></div></div></div>
        <p class="mini geen-marge boven-8">${esc(zin)}</p>
        <h4 class="boven-12">${esc(t('kan.accu.wanneer'))}</h4>${bijspringen(a.uren)}</div>`
    : '';
  // Wat er nodig is, koop je zelf; dan is er geen knop, behalve naar wat het nu oplevert.
  const ga = x.ga ?? (x.stand === 'mis' ? t('kan.ga.mis') : x.stand === 'uit' ? t('kan.ga.uit') : x.stand === 'nodig' ? (x.som ? t('kan.ga.opbrengst') : null) : t('kan.ga.bekijken'));
  // Waar het werkt (besluit 132): per kamer, en wat er nog kan als idee, niet als tekort.
  const waar = x.waar?.length
    ? `<div><h4>${esc(t('kan.waar'))}</h4><div class="waar">${x.waar.map((k) => `<div class="kamerkaart"><b>${esc(k.naam)}</b><span>${esc(k.wat)}</span></div>`).join('')}</div></div>`
    : x.som || x.thermisch ? '' : `<div class="nu"><span class="stand ${x.stand}">${esc(t('kan.nu'))}</span>${esc(x.nu)}</div>`;
  const idee = x.idee ? `<a class="kanook" href="${x.idee.href}"><span class="wanneer">${esc(t('kan.idee'))}</span><b>${esc(x.idee.titel)}</b><p>${esc(x.idee.zin)}, ${esc(x.idee.wint)}.</p><span class="knop">${esc(t(x.idee.soort === 'aan' ? 'kan.zetAan' : 'kan.bekijk'))}</span></a>` : '';
  return `<div class="bovenaan"><div><span class="stand ${x.stand}">${esc(x.label)}</span><h2 class="kop-2 boven-12">${esc(x.titel)}</h2><p class="lead boven-4" style="max-width: 52ch">${esc(x.wat)}</p>${x.extra ? `<p class="mini geen-marge boven-8">${esc(x.extra)}</p>` : ''}</div><button type="button" class="sluit" data-sluit aria-label="${esc(t('algemeen.sluiten'))}">×</button></div>
    ${waar}
    ${idee}
    ${som}
    ${x.thermisch ? thermischBlok(x.thermisch) : ''}
    <div class="twee"><div><h4>${esc(t('kan.zoWerkt'))}</h4><ul class="lijst">${x.zo.map((z) => `<li>${esc(z)}</li>`).join('')}</ul></div><div><h4>${esc(x.wanneerKop ?? t('kan.wanneerWerkt'))}</h4><ul class="lijst">${x.wanneer.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div></div>
    ${ga ? `<div class="onder"><a href="${x.gaHref ?? x.href}">${esc(ga)}</a></div>` : ''}`;
}

/*
 * Klaarzetten in Home Assistant (besluit 179): wat SunArc er gebruikt,
 * per groep, en of het er staat. Groen staat klaar, oranje mist voor de
 * regeling, grijs maakt een functie mogelijk. Een tik opent dat scherm van
 * Home Assistant; buiten Home Assistant staat erbij waar het is.
 */
const KLAAR_GROEPEN = ['basis', 'klimaat', 'energie', 'bewoners', 'gemak', 'praten', 'wand'].map((g) => [g, t(`kan.klaar.${g}`)]);
const KLAAR_STIP = { klaar: 'var(--mint)', mist: 'var(--gloed)', optioneel: 'var(--gedempt)' };
const klaarPunten = () => d.klaar?.punten ?? [];

function klaarBlad() {
  const punten = klaarPunten();
  const inHA = app.inHA();
  const regel = (p) => `<div class="klaarregel ${p.stand}"><span class="stip" style="background: ${KLAAR_STIP[p.stand]}"></span><div><b>${esc(p.titel)}</b><span>${esc(p.zin)}</span>${!inHA && p.waar && p.stand !== 'klaar' ? `<small>${esc(p.waar)}</small>` : ''}</div>${inHA && p.pad ? `<button type="button" class="knop knop-klein" data-ha-pad="${esc(p.pad)}" aria-label="${esc(t('kan.klaar.openIn', { titel: p.titel }))}">${esc(t('kan.klaar.open'))}</button>` : ''}</div>`;
  const groepen = KLAAR_GROEPEN.map(([g, titel]) => {
    const hier = punten.filter((p) => p.groep === g);
    return hier.length ? `<div class="klaargroep"><h4>${esc(titel)}</h4>${hier.map(regel).join('')}</div>` : '';
  }).join('');
  return `<div class="bovenaan"><div><h2 class="kop-2">${esc(t('kan.klaar.kop'))}</h2><p class="lead boven-4" style="max-width: 52ch">${esc(t('kan.klaar.lead'))}</p></div><button type="button" class="sluit" data-sluit aria-label="${esc(t('algemeen.sluiten'))}">×</button></div>
    ${groepen}`;
}

function tekenNu() {
  app.schaal();
  app.luchtVan(d.zon, 0);
  const tel = app.telStand();
  const lijst = stand.kan(d);
  const v = stand.voortgang(d);
  const nogBij = erbijLijst();
  // Zonder slimme regeling of nog zonder meekijken is er geen weg naar zelf regelen.
  const metWeg = !!(v.dataset && v.gereedheid && (d.site?.zones ?? []).length);

  $$('[data-tellers]').forEach((el) => (el.innerHTML = tellers(v, nogBij)));
  $$('[data-eerst]').forEach((el) => (el.innerHTML = eerst(eerstLijst())));
  $$('[data-erbij]').forEach((el) => (el.innerHTML = erbij(nogBij)));
  $$('[data-groepen]').forEach((el) => (el.innerHTML = groepen(v)));
  $$('[data-weg]').forEach((el) => {
    el.hidden = !metWeg;
    if (metWeg) el.innerHTML = weg(v, el.closest('#tel') != null);
  });

  const klaarOpen = gekozen() === 'klaarzetten' && (d.klaar?.punten ?? []).length > 0;
  const x = klaarOpen ? null : lijst.find((y) => y.id === gekozen());
  $$('[data-blad]').forEach((el) => {
    el.hidden = !x && !klaarOpen;
    if (klaarOpen) el.innerHTML = klaarBlad();
    else if (x) el.innerHTML = blad(x);
  });
  $$('[data-achter]').forEach((el) => (el.hidden = !x && !klaarOpen));

  const svg = document.querySelector(tel ? '[data-waaier="tel"]' : '[data-waaier="wand"]');
  if (!svg || !v.onderwerpen.length) return;
  svg.setAttribute('aria-label', t('voortgang.beschrijving', { pct: v.totaal }));
  // Op de telefoon ook de namen van de groepen langs de ring (besluit 345): zonder was het onduidelijk.
  const maat = tel ? { cx: 195, cy: 206, r0: 60, R: 168, groepnamen: true } : { cx: 370, cy: 392, r0: 88, R: 238, namen: true, groepnamen: true, horizon: 140, ringen: TREDEN.map((tr) => t(`voortgang.ring.${tr}`)) };
  waaier.teken(svg, { groepen: v.groepen, ...maat, getal: `${v.totaal}%`, onder: t('voortgang.zo'), gekozen: x?.id ?? null, groei: false });
}

/* -------------------------------------------------------------- starten */

/** Gebundeld: hooguit één keer per beeld (basis.js). */
const teken = app.gebundeld(tekenNu);
addEventListener('standwissel', teken);
addEventListener('hashchange', teken);

app.start('instellingen');
const sluit = () => {
  history.replaceState(null, '', location.pathname);
  teken();
};
document.addEventListener('click', (e) => {
  const open = e.target.closest('[data-open], [data-straal]');
  const ha = e.target.closest('[data-ha-pad]');
  if (ha) app.naarHAScherm(ha.dataset.haPad);
  else if (open) {
    const id = open.dataset.open ?? open.dataset.straal;
    if (id === gekozen()) sluit();
    else location.hash = id;
  } else if (e.target.closest('[data-sluit], [data-achter]')) sluit();
});
addEventListener('keydown', (e) => {
  const straal = e.target.closest?.('[data-straal]');
  if (straal && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    location.hash = straal.dataset.straal;
  } else if (e.key === 'Escape' && gekozen()) sluit();
});
void laadAlles();
setInterval(() => void laadAlles(), 5 * 60_000);
