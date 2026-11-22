/*
 * Deel van inrichten.js (opgesplitst op 22 november 2026): huis. Een gewoon script dat na
 * inrichten.js laadt en zijn bovenste namen deelt met de andere delen van de pagina.
 */
'use strict';
/* global antwoorden, binnen, buitenRuimtes, concept, d, esc, geenKlimaat, haal, idVan, klimaatIn, knop, lijstje, nl, regel, rij, schakelaar, sleutel, stuur, teken, tip, volgendeKnoppen, waarVan, zeg */
/* exported appAdres, apparatenStap, bewonersStap, buitenNu, buitenStap, geenKlimaatToestel, huisStap, metEtage, metenStap, open, openApparaat, openBewoner, qrVan, rolKnoppen, rolVan, rondVanConcept, samenvoegen, stuurBewoner, tekenMini, toevoeg, toevoegenIn, verplaatsKamer, warmteStap, weghalen, wnKaart, woningNu, woningStap, zonderKlimaat */
/*
 * Klopt je huis? (besluit 158): per etage de kamers. Een kamer aantikken geeft
 * zijn naam, etage en soort, de zones voor een open ruimte, samenvoegen met
 * een andere kamer, en weghalen. Buiten heeft een eigen stap.
 */
let open = null; // de kamer of etage waaraan iets verandert
let weghalen = null; // de kamer die nog één tik nodig heeft om weg te gaan
function bewerkKamer(k, etages, naamVan, c) {
  const r = binnen().find((x) => x.id === k.id);
  const voorstel = r && !r.soortGekozen ? r.soort : null;
  const soortNaam = (w) => huismodel.KAMER_SOORTEN.find(([x]) => x === w)?.[1] ?? '';
  const soorten = [['', voorstel && soortNaam(voorstel) ? t('indeling.uitNaam', { naam: soortNaam(voorstel) }) : t('inr.uitNaam')], ...huismodel.KAMER_SOORTEN];
  const zoneSoorten = [['', t('inr.soort')], ...huismodel.ZONE_SOORTEN];
  const zones = (k.zones ?? []).map((z) => `<div class="zonerij"><input class="veld" data-zonenaam="${esc(z.id)}" value="${esc(z.naam)}" maxlength="40" aria-label="${esc(t('indeling.zone.naam', { naam: z.naam }))}"><select class="veld" data-zonesoort="${esc(z.id)}" aria-label="${esc(t('indeling.zone.soort', { naam: z.naam }))}">${zoneSoorten.map(([v, x]) => `<option value="${v}" ${v === (z.soort ?? '') ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><button type="button" class="chip" data-zoneweg="${esc(z.id)}" aria-label="${esc(t('indeling.zone.weg', { naam: z.naam }))}">×</button></div>`).join('');
  const buren = (c?.kamers ?? []).filter((x) => x.id !== k.id && x.etage === k.etage);
  // Links of rechts op de etage (besluit 166); slepen in het huis kan ook.
  const opEtage = (c?.kamers ?? []).filter((x) => x.etage === k.etage);
  const plek = opEtage.findIndex((x) => x.id === k.id);
  const schuif = opEtage.length > 1 ? `<div class="veldlabel breed"><span>${esc(t('inr.plek'))}</span><div class="chips"><button type="button" class="chip" data-schuifkamer="-1" ${plek <= 0 ? 'disabled' : ''}>${esc(t('inr.links'))}</button><button type="button" class="chip" data-schuifkamer="1" ${plek >= opEtage.length - 1 ? 'disabled' : ''}>${esc(t('inr.rechts'))}</button></div></div>` : '';
  return `<div class="bewerk">
    <label class="veldlabel"><span>${esc(t('indeling.naam'))}</span><input class="veld" data-naam="${esc(k.id)}" value="${esc(k.naam)}" maxlength="40"></label>
    <label class="veldlabel"><span>${esc(t('indeling.etageLabel'))}</span><select class="veld" data-etage="${esc(k.id)}">${etages.map((x) => `<option value="${esc(x.id)}" ${x.id === k.etage ? 'selected' : ''}>${esc(naamVan(x))}</option>`).join('')}</select></label>
    ${k.etage === 'buiten' ? '' : schuif}
    ${k.etage === 'buiten' ? '' : `<label class="veldlabel breed"><span>${esc(t('indeling.soortKamer'))}</span><select class="veld" data-soort="${esc(k.id)}">${soorten.map(([v, x]) => `<option value="${v}" ${v === (k.soort ?? '') ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>`}
    ${k.etage === 'buiten' ? '' : `<div class="veldlabel breed"><span>${esc(t('inr.zones'))}</span>${zones}<input class="veld" data-nieuwezone placeholder="${esc(t('inr.zoneErbij'))}" aria-label="${esc(t('indeling.nieuweZone'))}" maxlength="40"></div>`}
    ${buren.length ? `<label class="veldlabel"><span>${esc(t('inr.eenRuimte'))}</span><select class="veld" data-samen="${esc(k.id)}"><option value="">${esc(t('inr.samenvoegen'))}</option>${buren.map((x) => `<option value="${esc(x.id)}">${esc(x.naam)}</option>`).join('')}</select></label>` : ''}
    <div class="veldlabel"><span>&nbsp;</span><button type="button" class="chip gevaar" data-kamerweg="${esc(k.id)}">${esc(t(weghalen === k.id ? 'inr.nogEens' : 'indeling.kamerWeg'))}</button></div>
  </div>`;
}
/*
 * Wat voor huis het is (besluit 190): vijf soorten, elk met een klein huisje
 * erin, dan of er een kelder is en wat voor dak. De tekening links doet mee.
 */
const woningNu = () => concept()?.woning ?? d.huis?.woning ?? 'vrijstaand';
function dakNu() {
  const c = concept();
  if (c?.dak === 'geen') return 'plat';
  if (c?.dak) return 'schuin';
  return d.huis?.dakEtage ? 'schuin' : 'plat';
}
/**
 * Wat de kaart van het soort huis ziet (20 november 2026): uit Je huis, één
 * keer opgehaald zodra deze stap er staat. Inrichten toont hetzelfde deel als
 * Je huis › Vorm (keuze Ricardo).
 */
let wnKaart;
function laadWnKaart() {
  if (wnKaart !== undefined) return;
  wnKaart = null;
  haal('api/huistekening')
    .then((x) => {
      wnKaart = x?.woningKaart ?? null;
      teken();
    })
    .catch(() => {});
}
function woningStap() {
  const c = concept();
  const nu = woningNu();
  laadWnKaart();
  const gekozen = Array.isArray(c?.buren);
  const kaart = wnKaart ?? null;
  const soort = gekozen || !kaart || c?.woning ? nu : kaart.soort;
  const tegels = `<div class="wn-breed">${woningDeel.html({ soort, buren: gekozen ? c.buren : soort === kaart?.soort ? kaart.buren : woningDeel.burenBij(soort, kaart, []), kaart, gekozen: gekozen || !!c?.woning, verdieping: c?.verdieping, erboven: c?.erboven })}</div>`;
  const kelder = (c?.kamers ?? []).some((k) => k.etage === 'kelder');
  const dak = dakNu();
  // Een appartement heeft geen eigen kelder, en een dak alleen als er niets boven ligt (20 november 2026).
  const dakRij = rij(t('inr.dakVraag'), `${knop('data-dak="schuin"', t('inr.dak.schuin'), dak === 'schuin')}${knop('data-dak="plat"', t('inr.dak.plat'), dak === 'plat')}`);
  const rijen = nu === 'appartement'
    ? (woningDeel.eigenDak({ soort: nu, erboven: c?.erboven }) ? dakRij : '')
    : `${rij(t('inr.kelderVraag'), `${knop('data-kelder="ja"', t('inr.kelderJa'), kelder)}${knop('data-kelder="nee"', t('functies.nee'), !kelder)}`)}
       ${dakRij}`;
  return {
    waar: waarVan('woning'),
    kop: t('inr.woningKop'),
    uitleg: t('inr.woningZin'),
    inhoud: `${tegels}<div class="rijen">${rijen}</div>`,
  };
}
/** De kleine huisjes bij Wat voor huis, zoals de schets: alleen de vorm. */
function tekenMini(el) {
  const w = el.dataset.mini;
  // Vrijstaand is breder, zoals de schets; een rijtjeshuis of hoekhuis is één kamer breed.
  const laag = () => ({ naam: '', kamers: Array.from({ length: w === 'vrijstaand' ? 2 : 1 }, () => ({ naam: '', gewicht: 1, stil: true, apparaten: [] })) });
  const m = w === 'appartement'
    ? { woning: w, gebouw: { onder: 2, boven: 1 }, etages: [laag()] }
    : { woning: w, etages: [laag(), laag(), { dak: true, kamers: [] }], voordeur: {} };
  huis.teken(el, { tijd: app.tijdVanDeDag(d.zon), ...m }, { breedte: el.clientWidth || 120, hoogte: el.clientHeight || 84, marge: 0.12, wereld: false });
}

/*
 * Klopt de indeling? (besluit 190): per etage een regel per kamer, met wat
 * er staat. Een kamer aantikken opent hem eronder; onderaan + Kamer, met de
 * etage erbij.
 */
function huisStap() {
  const c = concept();
  const etages = (d.ind?.etages ?? []).filter((e) => e.id !== 'buiten');
  const naamVan = (e) => c?.etages?.[e.id] ?? e.standaardNaam;
  const soortNaam = (w) => huismodel.KAMER_SOORTEN.find(([x]) => x === w)?.[1] ?? '';
  const delen = etages.map((e) => {
    const kamers = (c?.kamers ?? []).filter((k) => k.etage === e.id);
    // Een etage zonder kamers alleen als de bewoner hem zelf toevoegde (testerronde, november 2026).
    if (!kamers.length) return c?.volgorde?.includes(e.id) ? `<div class="etagekop">${esc(naamVan(e))}</div><p class="zacht" style="padding: 2px 2px 6px">${esc(t('inr.etageLeeg'))}</p>` : '';
    return `<div class="etagekop">${esc(naamVan(e))}</div>${kamers.map((k) => {
      const r = binnen().find((x) => x.id === k.id);
      const n = (r?.apparaten ?? []).length;
      // De soort alleen als die iets toevoegt: "Slaapkamer · Slaapkamer" zegt niets.
      const soort = soortNaam(k.soort ?? r?.soort);
      const zin = k.zones?.length ? t('inr.metZones', { namen: lijstje(k.zones.map((z) => z.naam)) }) : soort.toLowerCase() === k.naam.toLowerCase() ? '' : soort;
      return regel({ tag: 'button', ik: 'huis', titel: k.naam, zin, rechts: n ? esc(t('inr.nApparaten', { n })) : '', klasse: open === k.id ? 'open' : '', attrs: `data-kamer="${esc(k.id)}" aria-expanded="${open === k.id}"` }) + (open === k.id ? bewerkKamer(k, d.ind?.etages ?? [], naamVan, c) : '');
    }).join('')}`;
  }).join('');
  const nieuw = open === 'nieuw'
    ? `<div class="bewerk"><input class="veld" data-nieuwnaam placeholder="${esc(t('inr.kantoor'))}" aria-label="${esc(t('inr.nieuweNaam'))}" maxlength="40"><select class="veld" data-nieuwetage aria-label="${esc(t('indeling.etageLabel'))}">${etages.map((e) => `<option value="${esc(e.id)}" ${e.id === 'bg' ? 'selected' : ''}>${esc(naamVan(e))}</option>`).join('')}</select><button type="button" class="chip aan" data-voegtoe>${esc(t('indeling.toevoegen'))}</button></div>`
    : open === 'etage'
      ? etageErbijBlok(etages)
      : `<div class="chips" data-meer>${knop('data-nieuw', t('inr.plusKamer'), false, 'plus')}${knop('data-inr-etage-open', t('inr.plusEtage'), false, 'plus')}</div>`;
  return {
    waar: waarVan('huis'),
    kop: t('inr.huisKop'),
    uitleg: t('inr.huisZin'),
    // De tip alleen zolang er geen kamer open staat: dan krijgt die de ruimte.
    inhoud: `<div class="rijen lijst">${delen}${nieuw}</div>${open ? '' : tip(t('inr.huisNoot'))}`,
  };
}
/*
 * Een etage erbij (testerronde, november 2026): een tester zag er maar twee en
 * kon pas later bij Indeling een derde maken. De vaste etages die er nog niet
 * zijn, of een eigen naam bovenaan; daarna kies je hem bij + Kamer.
 */
function etageErbijBlok(etages) {
  const nu = new Set(etages.map((e) => e.id));
  const vast = (d.ind?.standaard ?? []).filter((s) => !nu.has(s.id));
  return `<div class="bewerk">
    ${vast.length ? `<div class="chips" data-meer>${vast.map((s) => knop(`data-inr-etage="${esc(s.id)}"`, s.naam, false, 'plus')).join('')}</div>` : ''}
    <input class="veld" data-inr-etage-naam placeholder="${esc(t('indeling.vliering'))}" aria-label="${esc(t('indeling.eigenNaam'))}" maxlength="40">
    <div class="chips" data-meer>${knop('data-inr-etage-eigen', t('inr.etageBovenaan'), true)}${knop('data-inr-etage-dicht', t('algemeen.sluiten'))}</div>
  </div>`;
}
/** De etages van boven naar beneden, met een nieuwe op zijn plek (zoals Indeling). */
function metEtage(next, id, bovenaan) {
  // Zonder eigen volgorde: de etages met kamers, zodat er geen lege etage bij komt die niemand koos.
  const metKamers = new Set(next.kamers.map((k) => k.etage));
  const volgorde = next.volgorde?.length ? [...next.volgorde] : (d.ind?.etages ?? []).map((e) => e.id).filter((x) => x !== 'buiten' && metKamers.has(x));
  if (bovenaan) return [id, ...volgorde];
  const plek = (x) => (d.ind?.standaard ?? []).findIndex((s) => s.id === x);
  const voor = volgorde.findIndex((x) => plek(x) > plek(id) && plek(x) !== -1);
  volgorde.splice(voor === -1 ? volgorde.length : voor, 0, id);
  return volgorde;
}

/*
 * Twee kamers worden één ruimte (besluit 158): de tweede wordt een zone van de
 * eerste, met zijn apparaten. Een eigen regeling kan maar één kamer hebben.
 */
/**
 * Een kamer naar een andere plek (besluit 166): op de plek van `doelId`, op
 * diens etage; zonder doel één plek naar links (-1) of rechts (1). De volgorde
 * van de kamers is de volgorde in het huis, van links naar rechts.
 */
function verplaatsKamer(next, id, { doelId = null, stap = 0 } = {}) {
  const i = next.kamers.findIndex((x) => x.id === id);
  if (i < 0) return false;
  const k = next.kamers[i];
  if (doelId) {
    const doel = next.kamers.find((x) => x.id === doelId);
    if (!doel || doel.id === id || doel.etage === 'buiten') return false;
    const zelfde = doel.etage === k.etage;
    const doelVoor = next.kamers.indexOf(doel);
    next.kamers.splice(i, 1);
    const j = next.kamers.indexOf(doel);
    // Op dezelfde etage van links naar rechts: erachter; anders ervoor.
    next.kamers.splice(zelfde && i <= doelVoor ? j + 1 : j, 0, k);
    if (!zelfde) {
      k.etage = doel.etage;
      delete k.meedoenMet;
    }
    return true;
  }
  const buren = next.kamers.filter((x) => x.etage === k.etage);
  const b = buren[buren.indexOf(k) + stap];
  if (!b) return false;
  const j = next.kamers.indexOf(b);
  [next.kamers[i], next.kamers[j]] = [next.kamers[j], next.kamers[i]];
  return true;
}

function samenvoegen(next, hoofdId, anderId) {
  const k = next.kamers.find((x) => x.id === hoofdId);
  const b = next.kamers.find((x) => x.id === anderId);
  if (!k || !b) return t('inr.nietMeer');
  if (k.regelzone && b.regelzone) return t('inr.tweeRegelingen', { a: k.naam, b: b.naam });
  const bezet = new Set(k.zones.map((z) => z.id));
  if (!k.zones.length) {
    const eigen = { id: idVan(k.naam, bezet), naam: k.naam, ...(k.soort ? { soort: k.soort } : {}) };
    bezet.add(eigen.id);
    k.zones.push(eigen);
    // Wat al in de kamer stond, komt in zijn eigen deel.
    const r = binnen().find((x) => x.id === k.id);
    for (const a of r?.apparaten ?? []) next.apparaten[sleutel(a)] = { ...(next.apparaten[sleutel(a)] ?? {}), kamer: k.id, zone: eigen.id };
  }
  const deel = { id: idVan(b.naam, bezet), naam: b.naam, ...(b.soort ? { soort: b.soort } : {}) };
  k.zones.push(deel);
  const rb = binnen().find((x) => x.id === b.id);
  for (const a of rb?.apparaten ?? []) next.apparaten[sleutel(a)] = { ...(next.apparaten[sleutel(a)] ?? {}), kamer: k.id, zone: deel.id };
  for (const [id, a] of Object.entries(next.apparaten)) if (a.kamer === b.id) next.apparaten[id] = { ...a, kamer: k.id, zone: deel.id };
  if (b.regelzone) k.regelzone = b.regelzone;
  if (b.rollen) k.rollen = { ...(k.rollen ?? {}), ...b.rollen };
  if (b.meten) k.meten = [...new Set([...(k.meten ?? []), ...b.meten])].slice(0, 6);
  for (const x of next.kamers) if (x.meedoenMet === b.id) x.meedoenMet = k.id;
  delete k.meedoenMet;
  next.kamers = next.kamers.filter((x) => x.id !== b.id);
  return null;
}

/*
 * Buiten (besluiten 109, 158 en 166): één lijst met wat er rond het huis is,
 * elk deel aan of uit; zo tekent het huis zijn buitenkant. Onder een deel dat
 * aan staat, welke ruimte uit Home Assistant erbij hoort: daar komen zijn
 * lampen en camera vandaan. Het losse blok met ruimtes is weg.
 */
const buitenKamers = () => (concept()?.kamers ?? []).filter((k) => k.etage === 'buiten');
/**
 * [deel, naam, soort van een ruimte die erbij hoort]; auto en carport horen bij
 * de oprit. Hetzelfde lijstje als Kamers en indeling › Buiten (besluit 193),
 * waar een ruimte nu ook bij de carport kan horen.
 */
const RONDOM = huismodel.rondom();
/** Wat er rond het huis is, uit de indeling die je nu bewerkt; een lijstje van vóór de border heeft hem. */
const rondVanConcept = (next) => huismodel.rondNu(next?.rond ? { rond: next.rond } : d.huis);
function buitenNu(k) {
  const r = buitenRuimtes().find((x) => x.id === k.id);
  return k.buiten ?? r?.buiten ?? huismodel.soortBuiten(k);
}
function buitenStap() {
  const rond = huismodel.rondNu(d.huis);
  const kamers = buitenKamers();
  // De jacuzzi (besluit 186): gevonden in Home Assistant, of alleen getekend.
  const jacuzzi = (d.aans?.gevonden?.apparaten ?? []).find((x) => x.soort === 'jacuzzi');
  const delen = RONDOM.flatMap(([w, naam, , icoon]) => {
    // Aanvinken is genoeg (28 oktober 2026): het deel komt op zijn vaste plek; de ruimte
    // uit Home Assistant die erbij hoort, volgt uit zijn naam of wat hij is bij Kamers en indeling.
    // Het tuinhuis en het schuurtje als twee losse schakelaars (18 november 2026): je kunt ze allebei hebben.
    if (w === 'tuinhuis') {
      const h = huismodel.huisjesVan(rond);
      return ['tuinhuis', 'schuurtje'].map((x) => {
        const n = t(x === 'tuinhuis' ? 'inr.tuinhuis' : 'inr.schuurtje');
        return regel({ ik: x === 'tuinhuis' ? 'tuinhuis' : 'schuur', titel: n, rechts: schakelaar(`data-rond="huisje:${x}"`, n, h[x]) });
      });
    }
    const aan = huismodel.rondAan(rond, w);
    const ouder = huismodel.hangtAan(w);
    const zin = w === 'jacuzzi' ? (jacuzzi ? jacuzzi.naam : t('inr.nietInHA')) : '';
    return [regel({ ik: icoon, titel: naam, zin, rechts: schakelaar(`data-rond="${w}"`, naam, aan, !!ouder && !rond[ouder]) })];
  });
  // Ruimtes die bij geen deel horen dat aan staat: die tekent het huis nergens.
  const los = kamers.filter((k) => !RONDOM.some(([w, , s]) => s && rond[w] && buitenNu(k).soort === s));
  return {
    waar: waarVan('buiten'),
    kop: t('inr.buitenKop'),
    uitleg: t('inr.buitenZin'),
    inhoud: `<div class="rijen lijst">${delen.join('')}</div>${los.length ? tip(t('inr.losBuiten', { n: los.length, namen: lijstje(los.map((k) => k.naam)) })) : ''}`,
  };
}

/*
 * Wie woont hier (besluit 147): wie al ingelogd is, en een code om anderen
 * één keer te laten inloggen. Een bewoner komt er alleen zo bij; de app haalt
 * niet iedereen uit Home Assistant.
 */
const appAdres = () => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}inloggen.html`;
function qrVan(adres) {
  try {
    const q = window.qrcode(0, 'M');
    q.addData(adres);
    q.make();
    return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
  } catch {
    return '';
  }
}
/*
 * Een bewoner aantikken (besluit 166): de naam, waarmee het huis ziet of
 * diegene thuis is, de plek in de volgorde en het comfort; dezelfde deur als
 * Instellingen › Bewoners (`api/bewoners`).
 */
let openBewoner = null;
function bewonerBewerk(x, i, lijst) {
  const b = d.bewoners;
  const kan = b?.ik?.magBeheren || x.ik;
  const hoofd = lijst[0];
  const thuis = x.gekoppeld
    ? `<div class="veldlabel breed"><span>${esc(t('bewoners.thuisVolgens'))}</span><span class="zacht" style="padding: 0">${esc(t('inr.gekoppeld', { naam: x.aanwezigheidNaam ?? '' }))}</span></div>`
    : `<label class="veldlabel breed"><span>${esc(t('bewoners.thuisVolgens'))}</span><select class="veld" data-bbron="${esc(x.id)}" ${kan ? '' : 'disabled'}><option value="">${esc(t('bewoners.geenSensor'))}</option>${(x.kiesbaar ?? []).map((y) => `<option value="${esc(y.id)}" ${y.id === x.aanwezigheid ? 'selected' : ''}>${esc(y.naam)} · ${esc(t(y.soort === 'persoon' ? 'inr.persoon' : 'bewoners.sensor'))}</option>`).join('')}</select></label>`;
  const volgorde = b?.ik?.magBeheren && lijst.length > 1
    ? `<div class="veldlabel breed"><span>${esc(t('inr.volgorde'))}</span><div class="chips"><button type="button" class="chip" data-bvolg="-1" ${i === 0 ? 'disabled' : ''}>${esc(t('inr.hoger'))}</button><button type="button" class="chip" data-bvolg="1" ${i === lijst.length - 1 ? 'disabled' : ''}>${esc(t('inr.lager'))}</button>${x.hoofd ? '' : `<button type="button" class="chip" data-bhoofd>${esc(t('bewoners.maakHoofd'))}</button>`}</div></div>`
    : '';
  const comfort = x.hoofd
    ? `<div class="veldlabel breed"><span>${esc(t('bewoners.comfort'))}</span><span class="zacht" style="padding: 0">${esc(t('inr.comfortHuis'))}</span></div>`
    : `<div class="veldlabel breed"><span>${esc(t('bewoners.comfort'))}</span><div class="chips">${knop('data-bcomfort="eigen"', t('inr.eigenTemp'), x.comfort === 'eigen')}${knop('data-bcomfort="volgt"', t('bewoners.volgtKnop', { naam: hoofd?.naam ?? t('jij.deHoofdgebruiker') }), x.comfort !== 'eigen')}${x.comfort === 'eigen' ? `<a class="chip plus" href="comfort.html?bewoner=${encodeURIComponent(x.id)}">${esc(t('inr.tempInstellen'))}</a>` : ''}</div></div>`;
  return `<div class="bewerk" style="grid-column: 1 / -1">
    <label class="veldlabel breed"><span>${esc(t(x.ik ? 'bewoners.noemt.ik' : 'bewoners.noemt.ander', { naam: x.naam }))}</span><input class="veld" data-bnaam="${esc(x.id)}" value="${esc(x.naam)}" maxlength="40" ${kan ? '' : 'disabled'}></label>
    ${thuis}${volgorde}${comfort}
  </div>`;
}
function bewonersStap() {
  const b = d.bewoners;
  const lijst = b?.bewoners ?? [];
  // Ieder met zijn kleur (besluit 181) en waarmee het huis ziet of hij thuis is (besluit 190, schets Wand-Inrichten-3).
  const rijen = lijst.map((x, i) => {
    const open = x.id === openBewoner;
    const wat = x.hoofd ? t('toegang.hoofdgebruiker') : x.comfort === 'eigen' ? t('toegang.eigenComfort') : t('jij.volgt', { naam: lijst[0]?.naam ?? t('jij.deHoofdgebruiker') });
    const bron = x.gekoppeld ? x.aanwezigheidNaam : (x.kiesbaar ?? []).find((y) => y.id === x.aanwezigheid)?.naam;
    const zin = bron ? `${wat} · ${t('inr.thuisMet', { naam: bron })}` : wat;
    return `<button type="button" class="bewoner${open ? ' open' : ''}" data-bewoner="${esc(x.id)}" aria-expanded="${open}"><span class="gezicht" data-kleur="${esc(app.kleurVan(x.id))}" aria-hidden="true">${esc((x.naam || '?').slice(0, 1).toUpperCase())}</span><span class="tekst"><b>${esc(x.naam)}${x.ik ? esc(t('toegang.jij')) : ''}</b><span>${esc(zin)}</span></span><span class="rechts" aria-hidden="true">›</span></button>${open ? bewonerBewerk(x, i, lijst) : ''}`;
  }).join('');
  return {
    waar: waarVan('bewoners'),
    kop: t('inr.bewonersKop'),
    uitleg: t('inr.bewonersZin'),
    inhoud: `<div class="rijen lijst">${rijen || `<p class="zacht" style="padding: 0">${esc(t('toegang.nogNiemand'))}</p>`}</div>
      ${openBewoner ? '' : `<div class="erbij"><div class="qr" role="img" aria-label="${esc(t('bewoners.qr'))}">${qrVan(appAdres())}</div><span class="zacht" style="padding: 0">${esc(t('inr.scannen'))}</span></div>`}`,
  };
}
async function stuurBewoner(body, tekst) {
  if (!(await stuur('api/bewoners', body))) return;
  d.bewoners = await haal('api/bewoners').catch(() => d.bewoners);
  if (tekst) zeg(tekst);
  teken();
}

/*
 * Apparaten per kamer (besluit 166): alles in de stap zelf, zonder uitstap.
 * Bovenaan wat nog los staat, met een kamer erbij; daaronder per kamer wat er
 * staat. Een apparaat aantikken geeft verplaatsen en weghalen. Wat verwarmt of
 * koelt, staat bij Klimaat.
 */
let openApparaat = null;
function apparatenStap() {
  const los = d.huis?.zonderRuimte ?? [];
  const kamers = (d.huis?.etages ?? []).flatMap((e) => (e.ruimtes ?? []).map((r) => ({ r, e })));
  const nietTonen = `<option value="-">${esc(t('functies.nietTonen'))}</option>`;
  const opties = (voorstel, leeg = t('indeling.kiesKamer')) => `<option value="">${esc(leeg)}</option>${kamers.map(({ r }) => `<option value="${esc(r.id)}" ${r.id === voorstel ? 'selected' : ''}>${esc(r.naam)}</option>`).join('')}${nietTonen}`;
  const losRijen = los.map((a) => `<div class="rij breed"><b>${esc(a.naam)}</b><select class="veld" data-plek="${esc(a.id)}" aria-label="${esc(t('inr.kamerVoor', { naam: a.naam }))}">${opties(a.voorstelKamer)}</select></div>`).join('');
  const perKamer = kamers.filter(({ r }) => geenKlimaat(r.apparaten).length).map(({ r }) => {
    const apps = geenKlimaat(r.apparaten);
    const open = apps.find((a) => a.id === openApparaat);
    const chips = apps.map((a) => knop(`data-apparaat="${esc(a.id)}"`, a.naam, a.id === openApparaat)).join('');
    const bewerk = open
      ? `<div class="bewerk"><label class="veldlabel breed"><span>${esc(t('inr.andereKamer'))}</span><select class="veld" data-verplaats="${esc(sleutel(open))}" aria-label="${esc(t('inr.kamerVoor', { naam: open.naam }))}">${opties(null, t('inr.blijftIn', { naam: r.naam })).replace(nietTonen, '')}</select></label><div class="veldlabel breed"><button type="button" class="chip gevaar" data-verberg="${esc(open.id)}">${esc(t('inr.uitApp'))}</button></div></div>`
      : '';
    return rij(r.naam, chips, bewerk);
  }).join('');
  const ingedeeld = kamers.reduce((som, { r }) => som + geenKlimaat(r.apparaten).length, 0);
  return {
    waar: waarVan('apparaten'),
    kop: los.length === 0 ? t('inr.app.klopt') : t('inr.app.waar', { n: los.length }),
    uitleg: t('inr.app.zin', { n: ingedeeld }),
    inhoud: `<div class="rijen">${losRijen ? `${losRijen}${los.some((a) => a.voorstelKamer) ? `<p class="zacht" style="padding: 4px 0 8px">${esc(t('inr.app.uitNaam'))}</p>` : ''}` : ''}${perKamer}</div>`,
  };
}

/* Meten met (besluit 123): per kamer met een regeling, welke thermometers tellen. */
function metenStap() {
  const c = concept();
  const bronnen = (d.huis?.etages ?? []).flatMap((e) => (e.ruimtes ?? []).flatMap((r) => (r.apparaten ?? []).filter((x) => x.meting?.temperatuurC != null).map((x) => ({ id: x.id, naam: x.naam, kamerId: r.id, c: x.meting.temperatuurC }))));
  const kamers = binnen().filter((r) => r.zoneId || r.meedoenMet || bronnen.some((b) => b.kamerId === r.id));
  const rijen = kamers.map((r) => {
    const k = c?.kamers.find((x) => x.id === r.id);
    const gekozen = new Set(k?.meten ?? []);
    const hier = bronnen.filter((b) => b.kamerId === r.id);
    const chips = hier.map((b) => knop(`data-meet="${esc(b.id)}" data-meetkamer="${esc(r.id)}"`, `${b.naam} · ${nl(b.c)}°`, gekozen.has(b.id))).join('');
    // Zonder eigen thermometer in de kamer: alleen waarmee hij nu meet.
    const nu = r.meetMet?.length ? `<span class="zacht">${esc(t(chips ? 'inr.meet.nu' : 'inr.meet.met', { namen: lijstje(r.meetMet) }))}</span>` : '';
    return rij(r.naam, chips + (nu || (chips ? '' : `<span class="zacht">${esc(t('inr.meet.geen'))}</span>`))).replace('<div class="chips">', '<div class="chips" data-meer>');
  });
  return {
    waar: waarVan('meten'),
    kop: t('inr.meet.kop'),
    uitleg: t('inr.meet.zin'),
    inhoud: `<div class="rijen">${rijen.join('') || `<p class="zacht">${esc(t('inr.meet.nogGeen'))}</p>`}</div>`,
  };
}

/* De regeling per kamer (besluit 138): dezelfde drie keuzes als bij Indeling. */
const ROLLEN = ['houdt', 'zon', 'kijken'].map((r) => [r, t(`inr.rol.${r}`), t(`inr.rol.${r}Kort`)]);
/** De knoppen voor wat een apparaat doet; op zon alleen als het kan (besluit 291), of als het er al stond. */
function rolKnoppen(a, nuRol) {
  return ROLLEN.filter(([w]) => w !== 'zon' || nuRol === 'zon' || huismodel.kanOpZon(a, d.huis, antwoorden().verwarming))
    .map(([w, lang, kort]) => `<button type="button" class="${w === 'zon' ? 'zon' : ''}" data-rolwaarde="${w}" aria-pressed="${w === nuRol}" title="${esc(lang)}">${esc(kort)}</button>`)
    .join('');
}
const rolVan = (k, r, key) => (k?.rollen ? (k.rollen[key] ?? 'kijken') : (klimaatIn(r).find((a) => sleutel(a) === key)?.klimaat?.rol ?? 'kijken'));
/* Waar de warmte vandaan komt (besluit 122); hoort bij Klimaat (besluit 158). */
const VERWARMING = [...['cv', 'warmtepomp', 'hybride', 'stadsverwarming'].map((x) => [x, t(`energie.bron.${x}`)]), ['weetniet', t('energie.weetNiet')]];
let toevoegenIn = null;
/*
 * Iets toevoegen (besluit 167): hetzelfde als bij Kamers en indeling. Eerst wat
 * er hangt, dan hoe het aangaat. Een radiator op de cv gaat aan met de
 * thermostaat van de ketel (zoals een Nest), een slimme radiatorknop, of met
 * de hand. Een airco of thermostaat uit Home Assistant kies je uit de lijst.
 * Vloerverwarming is op water of elektrisch (0.92.0, zoals bij Kamers en
 * indeling): elektrisch gaat aan met een eigen thermostaat, zoals die in de
 * badkamer die een infraroodpaneel en de vloer aanstuurt.
 */
let toevoeg = null;
const TOEVOEG_SOORT = [...['radiator', 'vloer', 'paneel', 'kachel'].map((b) => [b, huismodel.metHoofdletter(t(`bron.${b}`))]), ['ha', t('inr.aircoThermo')]];
function toevoegVorm(r, los, elders) {
  const v = toevoeg ?? { soort: null, aan: null, apparaat: null, vloer: null };
  const cv = v.soort === 'radiator' || (v.soort === 'vloer' && v.vloer !== 'elektrisch');
  const ketel = huismodel.cvThermostaat(d.huis, antwoorden().verwarming);
  const toestellen = binnen().flatMap((x) => klimaatIn(x).map((a) => ({ a, r: x })));
  // Vloerverwarming: eerst op water (de cv) of elektrisch, daarna pas hoe hij aangaat.
  const vloerVraag = v.soort === 'vloer'
    ? `<span class="zacht">${esc(t('indeling.vloerIs'))}</span><div class="chips">${knop('data-toevoeg-vloer="water"', t('indeling.opWater'), v.vloer === 'water')}${knop('data-toevoeg-vloer="elektrisch"', huismodel.metHoofdletter(t('indeling.elektrisch')), v.vloer === 'elektrisch')}</div>`
    : '';
  const vloerKlaar = v.soort !== 'vloer' || v.vloer != null;
  const uitHA = `<select class="veld" data-toevoegen="${esc(r.id)}" aria-label="${esc(t('inr.uitHA'))}"><option value="">${esc(t('inr.kiesUitHA'))}</option>${[...los.map((x) => ({ key: x.id, naam: x.naam, waar: t('inr.nogLos') })), ...elders.filter((x) => x.r.id !== r.id).map((x) => ({ key: sleutel(x.a), naam: x.a.naam, waar: x.r.naam }))].map((x) => `<option value="${esc(x.key)}">${esc(t('energie.naamKamer', { naam: x.naam, kamer: x.waar }))}</option>`).join('')}</select>`;
  const aanOpties = cv
    ? [['thermostaat', ketel ? t('indeling.cvThermoNaam', { naam: ketel.naam }) : t('indeling.cvThermo')], ...(v.soort === 'radiator' ? [['knop', t('indeling.aan.knop')]] : []), ['hand', t('indeling.aan.hand')]]
    : ['thermostaat', 'stekker', 'hand'].map((w) => [w, t(`indeling.aan.${w}`)]);
  const kiesbaar = v.aan === 'knop' ? toestellen.filter((x) => x.a.radiatorknop) : toestellen;
  const welke = v.soort && v.soort !== 'ha' && v.aan && v.aan !== 'hand' && !(cv && v.aan === 'thermostaat')
    ? `<select class="veld" data-toevoeg-apparaat aria-label="${esc(t('inr.welkApparaat'))}"><option value="">${esc(t(v.aan === 'knop' ? 'inr.welkeKnop' : 'inr.welkApparaatVraag'))}</option>${kiesbaar.map((x) => `<option value="${esc(sleutel(x.a))}" ${sleutel(x.a) === v.apparaat ? 'selected' : ''}>${esc(t('energie.naamKamer', { naam: x.a.naam, kamer: x.r.naam }))}</option>`).join('')}</select>`
    : '';
  const klaar = v.soort && v.soort !== 'ha' && vloerKlaar && v.aan && (v.aan === 'hand' || (cv && v.aan === 'thermostaat') || v.apparaat);
  return `<div class="kolom toevoeg" style="width: 100%">
    <span class="zacht">${esc(t('inr.watHangt'))}</span>
    <div class="chips">${TOEVOEG_SOORT.map(([w, x]) => knop(`data-toevoeg-soort="${w}"`, x, v.soort === w)).join('')}</div>
    ${v.soort === 'ha' ? uitHA : ''}
    ${vloerVraag}
    ${v.soort && v.soort !== 'ha' && vloerKlaar ? `<span class="zacht">${esc(t('indeling.hoeAan'))}</span><div class="chips">${aanOpties.map(([w, x]) => knop(`data-toevoeg-aan="${w}"`, x, v.aan === w)).join('')}</div>${welke}` : ''}
    <div class="chips">${knop('data-toevoeg-annuleer', t('indeling.annuleren'))}${v.soort !== 'ha' ? `<button type="button" class="chip aan" data-toevoeg-bewaar ${klaar ? '' : 'disabled'}>${esc(t('indeling.toevoegen'))}</button>` : ''}</div>
    ${v.soort === 'paneel' || v.soort === 'kachel' || (v.soort === 'vloer' && v.vloer === 'elektrisch') ? `<span class="zacht">${esc(t('inr.vermogenLater'))}</span>` : ''}
  </div>`;
}
/*
 * Een huis zonder slimme verwarming (besluit 190): de app regelt dan niet de
 * temperatuur, maar doet de rest wel. Vanzelf als er niets is om te verwarmen
 * of koelen; anders met "Geen slimme regeling" bij de verwarming.
 */
let zonderKlimaat = null;
const geenKlimaatToestel = () => binnen().flatMap(klimaatIn).length === 0 && !(d.huis?.zonderRuimte ?? []).some((x) => x.soort === 'klimaat');
function zonderKlimaatStap() {
  const f = d.functies;
  const r = (icoon, sleutel, ja) => regel({ ik: icoon, titel: t(`inr.zk.${sleutel}`), zin: t(`inr.zk.${sleutel}Zin`), rechts: esc(t(ja ? 'inr.zk.werkt' : 'inr.zk.nietGevonden')), toon: ja ? 'mint' : '' });
  return {
    waar: waarVan('warmte'),
    kop: t('inr.zk.kop'),
    uitleg: t('inr.zk.zin'),
    inhoud: `<div class="rijen lijst">
        ${r('lamp', 'licht', !!f?.lichtMogelijk)}
        ${r('screen', 'schermen', !!f?.schermMogelijk)}
        ${r('zon', 'zon', true)}
        ${r('camera', 'cameras', (f?.gevonden?.cameras ?? []).length > 0)}
        ${r('praat', 'assistent', true)}
        ${regel({ ik: 'thermo', titel: t('inr.zk.comfort'), zin: t('inr.zk.comfortZin'), rechts: esc(t('inr.zk.erbij')), toon: 'zon', klasse: 'uit' })}
      </div>${tip(t('inr.zk.tip'))}`,
    ...(geenKlimaatToestel() ? {} : { voet: [`<button type="button" class="zachtknop" data-zonderklimaat="0">${esc(t('panelen.terug'))}</button>`, volgendeKnoppen()] }),
  };
}
function warmteStap() {
  if (zonderKlimaat ?? geenKlimaatToestel()) return zonderKlimaatStap();
  const c = concept();
  const a = antwoorden();
  const elders = binnen().flatMap((r) => klimaatIn(r).map((x) => ({ a: x, r })));
  const los = (d.huis?.zonderRuimte ?? []).filter((x) => x.soort === 'klimaat');
  const rijen = binnen().map((r) => {
    const k = c?.kamers.find((x) => x.id === r.id);
    // Drie knoppen naast elkaar, zoals de schets: op temperatuur, op zon, kijkt mee (besluit 146).
    const toestellen = klimaatIn(r).map((x) => {
      const nuRol = rolVan(k, r, sleutel(x));
      // Een radiatorknop of de thermostaat van een gasketel helpt niet op zon (besluit 291).
      const knoppen = rolKnoppen(x, nuRol);
      const ketel = huismodel.cvThermostaat(d.huis, a.verwarming)?.sleutel === sleutel(x);
      return `<div class="toestel">${esc(x.naam)}${ketel ? `<span class="zacht"> · ${esc(t('inr.zetKetel'))}</span>` : ''}<div class="seg" role="group" aria-label="${esc(t('inr.watMet', { naam: x.naam }))}" data-rol="${esc(sleutel(x))}" data-rolkamer="${esc(r.id)}">${knoppen}</div></div>`;
    }).join('');
    const bronnen = (r.bronnen ?? []).filter((b) => !b.apparaat).map((b) => `<span class="chip gevonden">${esc(huismodel.bronNaam(b))}</span>`).join('');
    const keuze = toevoegenIn === r.id ? toevoegVorm(r, los, elders) : knop(`data-erbij="${esc(r.id)}"`, t('indeling.plusIets'), false, 'plus');
    // Zonder eigen apparaat: meedoen met een kamer die wel regelt (besluit 142).
    const regelaars = binnen().filter((x) => x.id !== r.id && x.zoneId);
    const mee = !toestellen && regelaars.length ? `<select class="veld" data-meedoen="${esc(r.id)}" aria-label="${esc(t('inr.meedoenVraag', { naam: r.naam }))}"><option value="">${esc(t('inr.nietMee'))}</option>${regelaars.map((x) => `<option value="${esc(x.id)}" ${k?.meedoenMet === x.id ? 'selected' : ''}>${esc(t('indeling.doetMee', { naam: x.naam }))}</option>`).join('')}</select>` : '';
    const inhoud = `<div class="kolom" style="width: 100%">${toestellen}${bronnen ? `<div class="chips">${bronnen}</div>` : ''}${mee}${!toestellen && !bronnen && !mee ? `<span class="zacht">${esc(t('inr.nietsGoed'))}</span>` : ''}<div class="chips">${keuze}</div></div>`;
    return `<div class="rij"><b>${esc(r.naam)}</b>${inhoud}</div>`;
  });
  // De thermostaat die de ketel aanzet (besluit 167), zoals een Nest: niets gekozen is het voorstel uit Home Assistant.
  const lijst = huismodel.thermostaten(d.huis);
  const thermoOpties = [['', lijst[0] ? t('inr.thermo', { naam: lijst[0].naam }) : t('inr.geenThermo')], ...lijst.map((x) => [x.sleutel, t('inr.thermoKamer', { naam: x.naam, kamer: x.kamer })]), ['geen', t('energie.geenThermostaat')]];
  const thermo = a.verwarming.soort === 'stadsverwarming' || !lijst.length ? '' : `<select class="veld" data-inr-thermostaat aria-label="${esc(t('energie.thermostaatKetel'))}" style="width: 100%">${thermoOpties.map(([w, x]) => `<option value="${esc(w)}" ${w === (a.verwarming.thermostaat ?? '') ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
  // De thermostaat onder de knoppen, over de hele breedte: in de smalle kolom ernaast viel de tekst weg.
  const verwarming = `<div class="rij"><b>${esc(t('energie.verwarming'))}</b><div class="kolom" style="width: 100%"><div class="chips">${VERWARMING.map(([w, x]) => knop(`data-verwarming="${w}"`, x, a.verwarming.soort === w)).join('')}<button type="button" class="chip" data-zonderklimaat="1">${esc(t('inr.zk.knop'))}</button></div>${thermo}</div></div>`;
  return {
    waar: waarVan('warmte'),
    kop: t('inr.warmteKop'),
    uitleg: t('inr.warmteZin'),
    inhoud: `<div class="rijen">${verwarming}${rijen.join('') || `<p class="zacht">${esc(t('inr.geenKamers'))}</p>`}</div>`,
  };
}
