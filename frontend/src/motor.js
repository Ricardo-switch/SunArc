/*
 * De motor (23 november 2026, kwaliteitsronde stap 4 punt 4; schets design/app2/Wand-Motor.html en Tel-Motor.html).
 *
 * De schaduwpagina in de vorm van de app, achter zeven tikken op het versienummer bij Over deze app. Eén regel
 * blijft: hier wordt niets uitgerekend. Alles komt zoals de kern het meegeeft (api/state, live bij elke ronde); de
 * pagina vertaalt alleen een vaste code naar een gewoon woord, met de code klein erachter.
 *
 * - Nu: wat hij meet, wat er naast hem op zon draait, de oude regeling, wat er te verdelen is, wat elke kamer vraagt,
 *   en wat hij besluit en afwijst.
 * - Vandaag: elk kwartier van vandaag uit het logboek (api/motor/dag), en één ronde terugkijken (api/motor/ronde),
 *   met bladeren per ronde.
 * - Kopieer de stand: het besluit van nu als tekst, zonder namen of adressen, voor bij een melding.
 */
'use strict';

const { esc, haal } = app;
const getal = (n, d = 0) => taal.getal(n, d);
const W = (w) => `${getal(Math.round(w))} W`;
const klok = (ms) => new Date(ms).toLocaleTimeString(taal.locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
/** Een tekst als hij er is, anders de code zelf (een nieuwe code die nog geen woord heeft). */
const woord = (sleutel, code) => {
  // Zonder waarschuwing: een code die de kern later bedenkt, staat dan gewoon als code.
  const teksten = /** @type {any} */ (window).TALEN ?? {};
  return teksten[taal.code]?.[sleutel] != null || teksten.nl?.[sleutel] != null ? t(sleutel) : code;
};

let snap = null;
let site = null;
let huisData = null;
let stekkers = null;
let hand = null;
let dag = null;
let ronde = null;
let gekozenKw = null;
let deel = location.hash === '#vandaag' ? 'vandaag' : 'nu';
let fout = '';

const actNaam = (id) => site?.actuators?.find((a) => a.id === id)?.name ?? id;
const zoneNaam = (id) => site?.zones?.find((z) => z.id === id)?.name ?? id;
const ikVan = (id) => {
  const n = `${id} ${actNaam(id)}`;
  return /airco|\bac-/i.test(n) ? 'airco' : /radiator/i.test(n) ? 'verwarming' : /nest|thermostaat/i.test(n) ? 'thermostaat' : 'klimaat';
};
const tag = (soort, tekst) => `<span class="mo-tag ${soort}">${esc(tekst)}</span>`;
const code = (c) => (c ? ` <code>${esc(c)}</code>` : '');
const rij = (wat, waarde, c, onder) => `<div class="mo-rij"><span>${esc(wat)}</span><b>${waarde}</b>${c || onder ? `<em>${onder ? esc(onder) : ''}${code(c)}</em>` : ''}</div>`;
/** De uitleg van de oude regeling is HTML uit Home Assistant: alleen de tekst. */
const oudTekst = (s) =>
  String(s ?? '')
    .replace(/<br\s*\/?>/gi, ' · ')
    .replace(/<[^>]+>/g, '')
    .replace(/&emsp;|&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    // De tekens die Home Assistant ervoor zet (een slaapje, een klok): alleen de woorden.
    .replace(/[\p{Extended_Pictographic}️]/gu, '')
    .replace(/\s*·\s*/g, ' · ')
    .replace(/:\s*·\s*/g, ': ')
    .replace(/(\s*·\s*)+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
const actieTag = (a) => tag(a === 'heat' ? 'warm' : a === 'cool' ? 'koel' : '', woord(`motor.actie.${a}`, a));
/** Wat een apparaat nu doet, uit de waarneming (`heat@20`) en wat het zelf zegt (`heating`). */
function nuZin(id) {
  const obs = snap?.observed?.[id];
  if (!obs) return '';
  const [stand, doel] = obs.split('@');
  const doet = snap?.observedAction?.[id];
  if (stand === 'off') return t('motor.nu.uit');
  const op = doel ? t('motor.nu.op', { doel: `${getal(Number(doel), Number(doel) % 1 ? 1 : 0)}°` }) : woord(`motor.actie.${stand}`, stand);
  const wat = doet === 'heating' ? t('motor.nu.verwarmt') : doet === 'cooling' ? t('motor.nu.koelt') : doet === 'idle' ? t('motor.nu.stil') : '';
  return wat ? `${op}: ${wat}` : op;
}

/* ---------------------------------------------------------------- Nu */

function tekenNu() {
  const e = snap.explanation;
  const b = e.budget;
  const accu = huisData?.opslag?.batterij ?? null;
  const twijfel = e.failsafe?.unreliable?.length ?? 0;
  const metHand = (hand?.apparaten ?? []).filter((a) => a.actief).length;
  const meet = `<section class="glas mo-kaart" style="--o: 4"><h2>${esc(t('motor.meet.kop'))} <small>${esc(t('motor.meet.ronde', { tijd: klok(snap.atMs) }))}</small></h2>
      ${rij(t('motor.meet.stand'), esc(woord(`motor.stand.${e.mode}`, e.mode)), e.mode, `${t(e.modeSource === 'override' ? 'motor.meet.zelf' : 'motor.meet.schema')}, ${t(e.occupied ? 'motor.meet.thuis' : 'motor.meet.niemand')}`)}
      ${e.outdoorTemperatureC != null ? rij(t('motor.meet.buiten'), `${getal(e.outdoorTemperatureC, 1)}°`) : ''}
      ${e.solarProductionW != null ? rij(t('motor.meet.zon'), W(e.solarProductionW)) : ''}
      ${rij(t('motor.meet.net'), esc(b.gridPowerW >= 0 ? t('motor.meet.vanNet', { w: W(b.gridPowerW) }) : t('motor.meet.terug', { w: W(-b.gridPowerW) })))}
      ${(e.phases ?? []).map((f) => `<div class="mo-rij"><span>${esc(t('motor.meet.fase', { id: f.id }))}</span><b>${getal(f.currentA, 1)} A <small style="color: var(--gedempt); font-weight: 600">${esc(t('motor.meet.vanA', { a: getal(f.limitA) }))}</small></b><div class="mo-balk"><i style="width: ${Math.min(100, (f.currentA / Math.max(1, f.limitA)) * 100)}%; background: var(--violet)"></i></div></div>`).join('')}
      ${accu?.pct != null ? `<div class="mo-rij"><span>${esc(t('motor.meet.accu'))}</span><b>${esc(t(accu.stand === 'laadt' ? 'motor.meet.accuLaadt' : accu.stand === 'levert' ? 'motor.meet.accuLevert' : 'motor.meet.accuRust', { pct: getal(accu.pct), kw: getal(Math.abs(accu.vermogenW ?? 0) / 1000, 1) }))}</b><div class="mo-balk"><i style="width: ${accu.pct}%; background: var(--mint)"></i></div></div>` : ''}
      <div class="mo-veilig">${e.failsafe?.active ? tag('nee', t('motor.veilig.terugAan')) : tag('goed', t('motor.veilig.terugNiet'))}${twijfel ? tag('nee', t('motor.veilig.twijfel', { n: twijfel })) : tag('goed', t('motor.veilig.goed'))}${tag('', metHand ? t('motor.veilig.hand', { n: metHand }) : t('motor.veilig.geenHand'))}</div>
    </section>`;

  const opZon = [
    ...(stekkers?.stekkers ?? []).filter((s) => s.zon?.schakelt).map((s) => ({ ik: 'stekker', naam: s.naam, tag: ['zon', t('motor.zon.stekker')], zin: `${t(s.aan ? 'motor.zon.stekkerAan' : 'motor.zon.stekkerUit')}${s.vermogenW ? ` · ${W(s.vermogenW)}` : ''}`, code: 'stekker-zon' })),
    ...(snap.bewoner?.warmtebuffers ?? []).map((w) => ({ ik: 'boiler', naam: w.naam, tag: ['zon', t('motor.zon.buffer')], zin: [w.kop, w.zin].filter(Boolean).join(' · '), code: w.stand ?? 'warmtebuffer' })),
    ...(snap.bewoner?.uitstelbaar ?? []).map((u) => ({ ik: 'witgoed', naam: u.naam, tag: ['', t('motor.zon.uitstel')], zin: [u.kop, u.zin].filter(Boolean).join(' · '), code: (e.deferrables ?? []).find((d) => d.id === u.id)?.reason ?? u.stand })),
  ];
  const zon = `<section class="glas mo-kaart" style="--o: 5"><h2>${esc(t('motor.zon.kop'))} <small>${esc(t('motor.zon.los'))}</small></h2>
      ${opZon.length ? opZon.map((x) => `<div class="mo-besluit"><span class="ik">${iconen.svg(x.ik)}</span><b>${esc(x.naam)}</b>${tag(x.tag[0], x.tag[1])}<span class="zin">${esc(x.zin)}${code(x.code)}</span></div>`).join('') : `<p class="mo-zin" style="margin: 0">${esc(t('motor.zon.niets'))}</p>`}
    </section>`;
  const oud = snap.legacy ? `<section class="glas mo-kaart" style="--o: 6"><h2>${esc(t('motor.oud.kop'))} <small>${esc(t('motor.oud.tot'))}</small></h2><p class="mo-zin" style="margin: 0">${esc(oudTekst(snap.legacy))}</p></section>` : '';

  // Wat er te verdelen is: per apparaat wat het kreeg, in de kleur van wat het doet.
  const kreeg = new Map();
  for (const a of snap.accepted ?? []) if (a.budgetW > 0) kreeg.set(a.actuatorId, { w: (kreeg.get(a.actuatorId)?.w ?? 0) + a.budgetW, actie: a.action });
  const vrij = Math.max(0, b.availableW - b.allocatedW);
  const kleur = (a) => (a === 'cool' ? 'var(--ijs)' : 'var(--gloed)');
  const totaal = Math.max(1, b.availableW, b.allocatedW);
  const verdeel = `<section class="glas mo-kaart" style="--o: 3"><h2>${esc(t('motor.verdeel.kop'))} <small>${esc(t('motor.verdeel.budget'))}</small></h2>
      <div class="mo-groot">${getal(Math.round(b.availableW))}<small>W</small></div>
      <div class="mo-stapel">${[...kreeg].map(([id, k]) => `<i style="width: ${(k.w / totaal) * 100}%; background: ${kleur(k.actie)}">${k.w / totaal > 0.3 ? esc(actNaam(id)) : ''}</i>`).join('')}</div>
      <div class="mo-leg">${[...kreeg].map(([id, k]) => `<span style="--k: ${kleur(k.actie)}">${esc(actNaam(id))} ${W(k.w)}</span>`).join('')}<span style="--k: rgb(255 255 255 / 0.15)">${esc(t('motor.verdeel.vrij', { w: W(vrij) }))}</span></div>
      <div style="margin-top: 8px">${rij(t('motor.verdeel.toegewezen'), W(b.allocatedW), 'allocatedW')}${rij(t('motor.verdeel.overschot'), W(b.surplusW), 'surplusW')}${rij(t('motor.verdeel.terug'), W(b.reclaimableW), 'reclaimableW', t('motor.verdeel.terugZin'))}</div>
    </section>`;
  const kamers = `<section class="glas mo-kaart mo-vul" style="--o: 2"><h2>${esc(t('motor.kamer.kop'))}</h2>
      ${(e.perZone ?? []).map((z) => `<div class="mo-kamer"><b>${esc(zoneNaam(z.zoneId))}</b><span class="t">${z.temperatureC != null ? `${getal(z.temperatureC, 1)}°` : '–'} <small>${z.targetC != null ? esc(t('motor.kamer.naar', { doel: `${getal(z.targetC, 1)}°` })) : ''}</small></span><span>${z.demand === 'heat' ? tag('warm', t('motor.kamer.warm')) : z.demand === 'cool' ? tag('koel', t('motor.kamer.koel')) : tag('', t('motor.kamer.niets'))} ${esc(woord(`motor.reden.${z.reason}`, z.reason ?? ''))}${code(z.reason)}</span></div>`).join('')}
    </section>`;

  const acc = snap.accepted ?? [];
  const rej = snap.rejected ?? [];
  const MAX = 4;
  const besluit = `<section class="glas mo-kaart mo-vul" style="--o: 1"><h2>${esc(t('motor.besluit.kop'))} <small>${esc(t('motor.besluit.zou'))}</small></h2>
      ${acc.length ? acc.map((a) => `<div class="mo-besluit"><span class="ik">${iconen.svg(ikVan(a.actuatorId))}</span><b>${esc(actNaam(a.actuatorId))}</b>${actieTag(a.action)}<span class="zin">${esc(woord(`motor.regel.${a.strategyId}`, a.strategyId))}${a.budgetW ? ` · ${W(a.budgetW)}` : ''} · ${esc(t('motor.besluit.voorrang', { n: a.priority }))}${code(a.strategyId)}${nuZin(a.actuatorId) ? `<br>${esc(t('motor.besluit.nu', { zin: nuZin(a.actuatorId) }))}${code(snap.observed?.[a.actuatorId])}` : ''}</span></div>`).join('') : `<p class="mo-zin" style="margin: 0">${esc(t('motor.besluit.niets'))}</p>`}
      ${rej.length ? `<div class="mo-tussen">${esc(t('motor.besluit.afgewezen'))}</div>${rej.slice(0, MAX).map((r) => `<div class="mo-besluit"><span class="ik">${iconen.svg(ikVan(r.intent.actuatorId))}</span><b>${esc(actNaam(r.intent.actuatorId))}</b>${tag('nee', t('motor.besluit.nee', { wat: woord(`motor.actie.${r.intent.action}`, r.intent.action) }))}<span class="zin">${esc(woord(`motor.blok.${r.blockedBy}`, r.blockedBy))}${r.blockedBy === 'insufficient_power_budget' && r.intent.budgetW ? `: ${esc(t('motor.blok.vraagt', { w: W(r.intent.budgetW), vrij: W(vrij) }))}` : ''}${code(r.blockedBy)}</span></div>`).join('')}${rej.length > MAX ? `<p class="mo-zin">${esc(t('motor.besluit.en', { n: rej.length - MAX }))}</p>` : ''}` : ''}
    </section>`;
  return `<div class="mo-kol">${meet}${zon}${oud}</div><div class="mo-kol">${verdeel}${kamers}</div><div class="mo-kol">${besluit}</div>`;
}

/* ---------------------------------------------------------------- Vandaag */

const dagStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

function tekenVandaag() {
  if (!dag) return `<div class="mo-kol"><section class="glas mo-kaart mo-melding">${esc(fout || t('algemeen.laden'))}</section></div>`;
  const ks = dag.kwartieren;
  const nuKw = Math.floor((Date.now() - dagStart()) / 900_000);
  const maxZon = Math.max(1, ...ks.map((k) => k?.zonW ?? 0));
  const cel = (kw, soort, extra = '') => `<i class="${soort}" data-kw="${kw}"${extra}></i>`;
  const rijVan = (naam, f) => `<span class="naam">${esc(naam)}</span><div class="rij">${ks.map((k, kw) => (kw > nuKw || !k ? cel(kw, 'leeg') : f(k, kw))).join('')}${gekozenKw != null ? `<span class="mo-gekozen" style="left: calc(${(gekozenKw / 96) * 100}% - 2px); width: calc(${100 / 96}% + 2px)"></span>` : ''}</div>`;
  const regels = [
    rijVan(t('motor.dag.zon'), (k, kw) => (k.zonW > 30 ? cel(kw, 'zon', ` style="opacity: ${(0.35 + 0.65 * (k.zonW / maxZon)).toFixed(2)}"`) : cel(kw, ''))),
    rijVan(t('motor.dag.net'), (k, kw) => (k.netW > 100 ? cel(kw, 'net', ` style="opacity: ${Math.min(1, 0.35 + k.netW / 3000).toFixed(2)}"`) : k.netW < -100 ? cel(kw, 'terug') : cel(kw, ''))),
    '<div class="scheid"></div>',
    ...dag.apparaten.map((id) => rijVan(actNaam(id), (k, kw) => {
      const a = k.apparaten[id];
      if (!a) return cel(kw, '');
      const soort = a.zou === 'heat' ? 'heat' : a.zou === 'cool' ? 'cool' : '';
      return cel(kw, `${soort}${a.zouDraaien !== a.draaide ? ' anders' : ''}`);
    })),
    '<div class="scheid"></div>',
    rijVan(t('motor.dag.oud'), (k, kw) => cel(kw, k.oud ? 'oud' : '')),
  ].join('');
  const as = `<span></span><div class="as">${['00', '03', '06', '09', '12', '15', '18', '21', '24'].map((u) => `<span>${u}</span>`).join('')}</div>`;
  const leg = `<div class="mo-leg" style="margin-top: 14px"><span style="--k: var(--gloed)">${esc(t('motor.dag.leg.warm'))}</span><span style="--k: var(--ijs)">${esc(t('motor.dag.leg.koel'))}</span><span style="--k: var(--zon)">${esc(t('motor.dag.leg.zon'))}</span><span style="--k: var(--violet)">${esc(t('motor.dag.leg.net'))}</span><span style="--k: color-mix(in srgb, var(--violet) 70%, transparent)">${esc(t('motor.dag.leg.oud'))}</span><span class="anders">${esc(t('motor.dag.leg.anders'))}</span></div>`;
  const tijdlijn = `<section class="glas mo-kaart" style="flex: 1"><h2>${esc(t('motor.dag.kop'))} <small>${esc(t('motor.dag.uitleg'))}</small></h2>
      <div class="mo-tijd">${regels}${as}</div>${leg}<p class="mo-zin">${esc(t('motor.dag.zin'))}</p></section>`;
  return `<div class="mo-kol">${tijdlijn}</div><div class="mo-kol">${tekenRonde()}</div>`;
}

function tekenRonde() {
  if (!ronde) return `<section class="glas mo-kaart mo-melding">${esc(t('algemeen.laden'))}</section>`;
  const m = ronde.meet;
  const b = m.budget ?? {};
  const zou = (ronde.besluit.accepted ?? []).filter((a) => a.action === 'heat' || a.action === 'cool').map((a) => `${actNaam(a.actuatorId)} → ${woord(`motor.actie.${a.action}`, a.action).toLowerCase()} (${woord(`motor.regel.${a.strategyId}`, a.strategyId ?? '')})`);
  const af = (ronde.besluit.rejected ?? []).map((r) => `${actNaam(r.intent.actuatorId)} ${woord(`motor.actie.${r.intent.action}`, r.intent.action).toLowerCase()}: ${woord(`motor.blok.${r.blockedBy}`, r.blockedBy)}`);
  const regel = (wat, waarde) => `<div class="mo-rij onder"><span>${esc(wat)}</span><b>${esc(waarde)}</b></div>`;
  const oud = ronde.besluit.vanMs != null && ronde.besluit.vanMs < ronde.tMs - 1000 ? `<p class="mo-zin">${esc(t('motor.ronde.besluitVan', { tijd: klok(ronde.besluit.vanMs) }))}</p>` : '';
  return `<section class="glas mo-kaart"><h2>${esc(t('motor.ronde.kop', { tijd: klok(ronde.tMs) }))} <small>${esc(t('motor.ronde.van', { n: ronde.n, van: ronde.van }))}</small></h2>
      <div class="mo-blader"><button type="button" data-ronde-t="${ronde.vorigeMs ?? ''}" ${ronde.vorigeMs ? '' : 'disabled'}>${esc(t('motor.ronde.eerder'))}</button><button type="button" data-ronde-t="${ronde.volgendeMs ?? ''}" ${ronde.volgendeMs ? '' : 'disabled'}>${esc(t('motor.ronde.later'))}</button></div>
      ${regel(t('motor.meet.stand'), woord(`motor.stand.${m.mode}`, m.mode ?? ''))}
      ${regel(t('motor.ronde.zon'), t('motor.ronde.zonNet', { zon: W(m.zonW ?? 0), net: W(b.gridPowerW ?? 0) }))}
      ${regel(t('motor.ronde.verdelen'), t('motor.ronde.verdelenZin', { w: W(b.availableW ?? 0), toegewezen: W(b.allocatedW ?? 0) }))}
      ${regel(t('motor.ronde.zouSturen'), zou.join(' · ') || t('motor.ronde.niets'))}
      ${af.length ? regel(t('motor.ronde.weesAf'), af.join(' · ')) : ''}
      ${m.legacy ? regel(t('motor.ronde.oud'), oudTekst(m.legacy)) : ''}
      ${oud}<p class="mo-zin">${esc(t('motor.ronde.uitLogboek'))}</p></section>`;
}

/* ---------------------------------------------------------------- de pagina */

function teken() {
  const kop = `<header class="mo-kop">
      <div><a class="mo-terug" href="over.html">‹ ${esc(t('motor.terug'))}</a><h1 class="kop-2">${esc(t('motor.titel'))}</h1><p class="mo-onder">${snap ? taal.html('motor.onder', { tijd: klok(snap.atMs) }) : ''}</p></div>
      <div class="mo-rechts"><div class="chips seg" role="group" aria-label="${esc(t('motor.delen'))}">${['nu', 'vandaag'].map((d) => `<button type="button" class="chip" aria-pressed="${d === deel}" data-deel="${d}">${esc(t(`motor.deel.${d}`))}</button>`).join('')}</div><button type="button" class="mo-kopie" data-kopie>${esc(t('motor.kopie'))}</button></div>
    </header>`;
  const inhoud = deel === 'vandaag' ? tekenVandaag() : snap ? tekenNu() : `<div class="mo-kol"><section class="glas mo-kaart mo-melding">${esc(fout || t('motor.nogNiet'))}</section></div>`;
  document.querySelectorAll('[data-motor]').forEach((el) => {
    // Bij het bladeren door de rondes blijft de tijdlijn waar hij was (de telefoon schuift hem opzij).
    const oud = el.querySelector('.mo-tijd')?.scrollLeft ?? null;
    el.innerHTML = `${kop}<section class="mo-deel ${deel}">${inhoud}</section>`;
    const tl = el.querySelector('.mo-tijd');
    if (tl && tl.scrollWidth > tl.clientWidth) tl.scrollLeft = oud ?? Math.max(0, (((gekozenKw ?? 0) + 4) / 96) * tl.scrollWidth - tl.clientWidth);
  });
}

/** Het besluit van nu als tekst, zonder namen of adressen: de kamers en apparaten als nummers. */
function standTekst() {
  if (!snap) return '';
  const e = snap.explanation;
  const nr = new Map();
  const naam = (id, soort) => {
    if (!nr.has(id)) nr.set(id, `${soort}${[...nr.keys()].filter((k) => nr.get(k).startsWith(soort)).length + 1}`);
    return nr.get(id);
  };
  const b = e.budget;
  return [
    `SunArc ${document.documentElement.dataset.versie ?? ''} · De motor · ${new Date(snap.atMs).toISOString()}`,
    `stand ${e.mode} (${e.modeSource}), ${e.occupied ? 'thuis' : 'niemand'}; buiten ${e.outdoorTemperatureC ?? '?'}°; zon ${e.solarProductionW ?? '?'} W`,
    `budget beschikbaar ${b.availableW} W, toegewezen ${b.allocatedW}, overschot ${b.surplusW}, terug ${b.reclaimableW}, net ${b.gridPowerW}`,
    `fasen ${(e.phases ?? []).map((f) => `${f.id} ${f.currentA}/${f.limitA} A`).join(', ') || '-'}; failsafe ${e.failsafe?.active ? 'actief' : 'nee'}${e.failsafe?.unreliable?.length ? `, twijfel ${e.failsafe.unreliable.length}` : ''}`,
    ...(e.perZone ?? []).map((z) => `${naam(z.zoneId, 'kamer')}: ${z.temperatureC}° naar ${z.targetC}°, ${z.demand}, ${z.reason}`),
    ...(snap.accepted ?? []).map((a) => `aan: ${naam(a.actuatorId, 'apparaat')} ${a.action} ${a.strategyId} voorrang ${a.priority} ${a.budgetW} W, nu ${snap.observed?.[a.actuatorId] ?? '?'} ${snap.observedAction?.[a.actuatorId] ?? ''}`.trim()),
    ...(snap.rejected ?? []).map((r) => `af: ${naam(r.intent.actuatorId, 'apparaat')} ${r.intent.action} ${r.intent.strategyId} ${r.intent.budgetW ?? 0} W: ${r.blockedBy}`),
    `oude regeling: ${oudTekst(snap.legacy) || '-'}`,
  ].join('\n');
}

async function kopieer(knop) {
  const tekst = standTekst();
  try {
    await navigator.clipboard.writeText(tekst);
  } catch {
    // Zonder https: via een veld dat niemand ziet.
    const v = document.createElement('textarea');
    v.value = tekst;
    v.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.append(v);
    v.select();
    document.execCommand('copy');
    v.remove();
  }
  knop.textContent = t('motor.gekopieerd');
  knop.classList.add('klaar');
  setTimeout(() => {
    knop.textContent = t('motor.kopie');
    knop.classList.remove('klaar');
  }, 1600);
}

async function laadRonde(tMs) {
  ronde = await haal(`api/motor/ronde?t=${Math.round(tMs)}`).catch(() => ronde);
  if (ronde) gekozenKw = Math.floor((ronde.tMs - dagStart()) / 900_000);
  teken();
}

async function laadDag() {
  try {
    dag = await haal('api/motor/dag');
    fout = '';
  } catch {
    dag = null;
    fout = t('motor.dag.geen');
  }
  if (dag && gekozenKw == null) {
    const laatste = dag.kwartieren.findLastIndex((k) => k);
    if (laatste >= 0) {
      gekozenKw = laatste;
      await laadRonde(Date.now());
      return;
    }
  }
  teken();
}

document.addEventListener('click', (e) => {
  const doel = /** @type {Element} */ (e.target);
  const d = /** @type {HTMLElement | null} */ (doel.closest?.('[data-deel]'));
  if (d) {
    deel = d.dataset.deel;
    history.replaceState(null, '', deel === 'vandaag' ? '#vandaag' : location.pathname);
    teken();
    if (deel === 'vandaag' && !dag) void laadDag();
    return;
  }
  const kw = /** @type {HTMLElement | null} */ (doel.closest?.('[data-kw]'));
  if (kw && !kw.classList.contains('leeg')) {
    gekozenKw = Number(kw.dataset.kw);
    void laadRonde(dagStart() + (gekozenKw + 1) * 900_000 - 1000);
    return;
  }
  const r = /** @type {HTMLElement | null} */ (doel.closest?.('[data-ronde-t]'));
  if (r && r.dataset.rondeT) {
    void laadRonde(Number(r.dataset.rondeT));
    return;
  }
  const k = /** @type {HTMLElement | null} */ (doel.closest?.('[data-kopie]'));
  if (k) void kopieer(k);
});

async function laad() {
  const [s, st, h, k, ha] = await Promise.allSettled([haal('api/site'), haal('api/state'), haal('api/huis'), haal('api/stekker'), haal('api/hand')]);
  if (s.status === 'fulfilled') site = s.value;
  if (st.status === 'fulfilled') snap = st.value;
  else fout = t('motor.nogNiet');
  if (h.status === 'fulfilled') huisData = h.value;
  if (k.status === 'fulfilled') stekkers = k.value;
  if (ha.status === 'fulfilled') hand = ha.value;
  teken();
  if (deel === 'vandaag') void laadDag();
}

app.start('instellingen');
// Elke ronde live (zoals op Thuis): Nu tekent opnieuw; bij Vandaag alleen de kop met de tijd.
app.live((nieuw) => {
  snap = nieuw;
  if (deel === 'nu') teken();
  else document.querySelectorAll('[data-motor] .mo-onder').forEach((el) => (el.innerHTML = taal.html('motor.onder', { tijd: klok(snap.atMs) })));
});
app.bijVerandering('huis', async () => {
  huisData = await haal('api/huis').catch(() => huisData);
});
// Vandaag loopt door: elke vijf minuten het logboek opnieuw.
setInterval(() => {
  if (deel === 'vandaag') void haal('api/motor/dag').then((d) => ((dag = d), teken())).catch(() => {});
}, 5 * 60_000);
void laad();
