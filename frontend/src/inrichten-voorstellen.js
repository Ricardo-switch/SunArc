/*
 * Deel van inrichten.js (opgesplitst op 22 november 2026): voorstellen. Een gewoon script dat na
 * inrichten-energie.js laadt en zijn bovenste namen deelt met de andere delen van de pagina.
 */
'use strict';
/* global STAPPEN, antwoorden, assistentBlok, bewaarIndeling, binnen, buitenNu, buitenRuimtes, concept, contractNu, d, energieNu, esc, geenKlimaatToestel, kanBereik, kanToestellen, klimaatIn, lijstje, nl, regel, rolVan, sleutel, stapGedaan, stapNagelopen, stuur, teken, tellingen, terugKnop, waarVan, woningNu */
/* exported AANPAS, BEVESTIG, bewonersHoofd, jeHuisStap, klaarStap, meterStap, panelenStap, prijzenHoofd, sd, verwarmingStap */
/* ------------------------------------------------------------ de voorstellen */

/*
 * Elke stap een voorstel (besluit 323, schets Wand-Inrichten-Kort): wat SunArc
 * vond, met een vinkje, en Klopt dit? met Ja en Aanpassen. Vond het iets
 * belangrijks niet, dan staat er een vraagteken en is de knop Invullen.
 */
/**
 * Waar Aanpassen en Invullen heen gaan (besluit 352): de pagina bij Instellingen waar het later ook staat, met de
 * balk terug naar deze stap. Bij Verwarming is dat Wat elk apparaat kan, zodra de soort verwarming bekend is.
 */
const soortNu = () => (antwoorden().verwarming.soort && antwoorden().verwarming.soort !== 'weetniet' ? antwoorden().verwarming.soort : null);
const AANPAS = {
  jehuis: () => 'jehuis.html?van=inrichten',
  meter: () => (vermogens.netNu(d.aans, null) ? 'energie.html#aansluiting' : 'energie.html#meters'),
  panelen: () => 'energie.html#panelen',
  prijzen: () => 'energie.html#prijzen',
  verwarming: () => (!soortNu() ? 'comfort.html#verwarming' : kanToestellen().length ? '#apparaat' : 'comfort.html#meten'),
  bewoners: () => 'toegang.html#bewoners',
};
const kW = (w) => (Math.abs(w) >= 1000 ? `${nl(w / 1000, 1)} kW` : `${Math.round(w)} W`);
function vond(regels) {
  return `<div class="vond">${regels.map((r) => `<div class="vondregel${r.mist ? ' mist' : ''}"><span class="vink" aria-hidden="true">${r.mist ? '?' : '✓'}</span><span class="tekst"><b>${esc(r.b)}</b>${r.zin ? `<span>${esc(r.zin)}</span>` : ''}</span></div>`).join('')}</div>`;
}
function voorstel(h, { kop, zin = '', regels, mist = false, noot = '', aanpassen = t('inr.k.aanpassen') }) {
  const klopt = mist
    ? `<div class="klopt"><b>${esc(t('inr.k.mist'))}</b><button type="button" class="knop knop-licht" data-aanpassen>${esc(t('inr.k.invullen'))}</button></div>`
    : `<div class="klopt"><b>${esc(t('inr.k.klopt'))}</b><button type="button" class="kloptknop" data-aanpassen>${esc(aanpassen)}</button><button type="button" class="knop knop-licht" data-ja>${esc(t('inr.k.ja'))}</button></div>`;
  return {
    waar: waarVan(h),
    kop,
    uitleg: zin,
    inhoud: `${vond(regels)}${noot ? `<p class="noot-k">${esc(noot)}</p>` : ''}${klopt}`,
    voet: [terugKnop(), `<span class="rechts"><button type="button" class="zachtknop" data-later>${esc(t('w.later'))}</button></span>`],
  };
}

function jeHuisStap() {
  if (!d.huis) return { waar: waarVan('jehuis'), kop: t('inr.k.huisKop'), uitleg: t('inr.huisLezen'), inhoud: '', voet: [terugKnop(), ''] };
  const n = tellingen();
  const etages = (d.huis.etages ?? []).filter((e) => e.id !== 'buiten' && (e.ruimtes ?? []).some((r) => !huismodel.isBuiten(e, r)));
  const los = (d.huis.zonderRuimte ?? []).length;
  const kaart = (d.aans?.daken?.gebouwen ?? []).some((g) => g.bron === 'kaart');
  const regels = [
    { b: `${t('inr.k.etages', { n: n.etages })}, ${t('inr.k.kamers', { n: n.kamers })}`, zin: lijstje(etages.map((e) => e.naam ?? e.id)), mist: n.kamers === 0 },
    ...(n.buiten ? [{ b: t('inr.stap.buiten'), zin: lijstje(buitenRuimtes().map((r) => r.naam.toLowerCase())) }] : []),
    { b: t('inr.k.apparaten', { n: n.apparaten + n.klimaat }), zin: los ? t('ht.zonderPlek', { n: los }) : t('ht.allesPlek') },
    { b: t(`inr.woning.${woningNu()}`), zin: kaart ? t('inr.k.vormKaart') : '' },
  ];
  return voorstel('jehuis', { kop: t('inr.k.huisKop'), regels, mist: n.kamers === 0 });
}

function meterStap() {
  const a = antwoorden();
  const e = energieNu();
  const zek = (a.zekering && a.zekering !== 'weetniet' ? a.zekering : null) ?? d.aans?.configuratie?.zekering ?? null;
  const net = vermogens.netNu(d.aans, null);
  const w = (id) => (d.aans?.vermogens ?? []).find((v) => v.id === id)?.w ?? null;
  const netW = net ? w(net.afname) : null;
  const netTerug = net?.terug ? w(net.terug) : null;
  const nu = netW == null ? null : netW - (netTerug ?? 0);
  const omv = vermogens.zonNu(d.aans, null);
  const zonW = omv.reduce((s, id) => s + (w(id) ?? 0), 0);
  const regels = [
    net || (e?.net?.afname ?? []).length
      ? { b: t('inr.k.slimmeMeter'), zin: nu == null ? '' : t(nu < 0 ? 'inr.k.netTerug' : 'inr.k.netAf', { w: kW(Math.abs(nu)) }) }
      : { b: t('inr.k.slimmeMeter'), zin: t('inr.k.nietGevonden'), mist: true },
    zek ? { b: t('inr.k.zekering', { z: `${zek.fasen} × ${zek.ampere} A` }), zin: t(a.zekering ? 'inr.k.zelfIngevuld' : 'inr.k.uitInstellingen') } : { b: t('instellingen.zekering'), zin: t('inr.k.nogNiet'), mist: true },
    ...(omv.length ? [{ b: t('inr.k.omvormers', { n: omv.length }), zin: t('inr.k.zonNu', { w: kW(zonW) }) }] : []),
    ...(e?.gas ? [{ b: t('inr.k.gas') }] : []),
  ];
  return voorstel('meter', { kop: t('inr.k.meterKop'), regels, mist: !zek });
}

function panelenStap() {
  const a = antwoorden();
  if (a.panelen.ligging === 'geen') return voorstel('panelen', { kop: t('inr.k.panelenKop'), regels: [{ b: t('inr.k.geenPanelen') }] });
  const n = tellingen().panelen;
  const lig = d.aans?.ligging?.nu ?? null;
  const piekW = lig?.peakW ?? (d.zon?.panelen ?? []).reduce((s, p) => s + (p.wattpiek ?? 0), 0);
  const kwp = piekW ? `${nl(piekW / 1000, 2)} kWp` : '';
  const vlakken = d.aans?.daken?.vlakken ?? [];
  const gemeten = vlakken.some((v) => v.bron === 'gemeten') || d.aans?.ligging?.stand === 'bevestigd';
  const regels = [
    n || kwp ? { b: n ? `${t('inr.k.nPanelen', { n })}${kwp ? `, ${kwp}` : ''}` : kwp, zin: '' } : { b: t('inr.k.panelen'), zin: t('inr.k.nogNiet'), mist: true },
    ...(vlakken.length
      ? [{ b: t('inr.k.vlakken', { n: vlakken.length }), zin: lijstje(vlakken.map((v) => dakvlakken.waar(v))) }]
      : lig ? [{ b: lig.richting, zin: lig.helling }] : []),
    ...(n || kwp ? [{ b: t('inr.k.waar'), zin: t(gemeten ? 'inr.k.gemeten' : 'inr.k.leertVanzelf') }] : []),
  ];
  return voorstel('panelen', { kop: t('inr.k.panelenKop'), regels, mist: !n && !kwp });
}

function prijzenHoofd() {
  // Een voorstel uit wat er al is, ook uit Home Assistant (het dashboard Energie); Ja bewaart het. Zonder prijs: Invullen.
  const p = energieNu()?.prijzen ?? {};
  const geld = (x) => taal.geld(x, 2);
  const c = contractNu();
  const regels = [
    ...(c ? [{ b: t(`ct.${c}`), zin: c === 'dynamisch' && p.dynamisch ? t('inr.k.uurprijs') : '' }] : []),
    ...(p.stroom != null ? [{ b: t('inr.k.stroom', { prijs: geld(p.stroom) }), zin: p.stroomDal != null ? t('inr.k.dal', { prijs: geld(p.stroomDal) }) : '' }] : []),
    ...(p.gas != null ? [{ b: t('inr.k.gasPrijs', { prijs: geld(p.gas) }), zin: '' }] : []),
    ...(p.vanaf2027?.vergoeding != null ? [{ b: t('inr.terug2027'), zin: t('inr.k.terug', { krijgt: geld(p.vanaf2027.vergoeding), betaalt: geld(p.vanaf2027.kosten ?? 0) }) }] : []),
  ];
  const mist = p.stroom == null && !p.dynamisch;
  if (mist) regels.push({ b: t('inr.k.prijzen'), zin: t('inr.k.nogNiet'), mist: true });
  return voorstel('prijzen', { kop: t('inr.k.prijzenKop'), regels, mist });
}

function verwarmingStap() {
  if (geenKlimaatToestel()) return voorstel('verwarming', { kop: t('inr.k.verwKop'), regels: [{ b: t('inr.k.geenKlimaat'), zin: t('inr.k.geenKlimaatZin') }] });
  const a = antwoorden();
  const c = concept();
  const ketel = huismodel.cvThermostaat(d.huis, a.verwarming);
  const doen = [];
  const niet = [];
  for (const r of binnen()) {
    const k = c?.kamers.find((x) => x.id === r.id);
    const wie = klimaatIn(r).map((x) => [x, rolVan(k, r, sleutel(x))]).filter(([, rol]) => rol === 'houdt' || rol === 'zon');
    if (wie.length) doen.push({ b: r.naam, zin: wie.map(([x, rol]) => t(`inr.k.rol.${rol}`, { naam: x.naam })).join(', ') });
    else niet.push(r.naam);
  }
  const soort = soortNu();
  const regels = [
    soort ? { b: t(`energie.bron.${soort}`), zin: ketel ? t('inr.k.ketel', { naam: ketel.naam }) : '' } : { b: t('energie.verwarming'), zin: t('inr.k.nogNiet'), mist: true },
    ...doen,
  ];
  return voorstel('verwarming', { kop: t('inr.k.verwKop'), regels, mist: !soort && !doen.length, noot: niet.length ? t('inr.k.nietMee', { kamers: lijstje(niet) }) : '', aanpassen: t('inr.k.perKamer') });
}

function bewonersHoofd() {
  const lijst = d.bewoners?.bewoners ?? [];
  const regels = lijst.map((x) => {
    const bron = x.gekoppeld ? x.aanwezigheidNaam : (x.kiesbaar ?? []).find((y) => y.id === x.aanwezigheid)?.naam;
    return { b: `${x.naam}${x.ik ? t('toegang.jij') : ''}`, zin: bron ? t('inr.thuisMet', { naam: bron }) : t('inr.k.geenLocatie') };
  });
  if (!lijst.length) regels.push({ b: t('inr.k.bewoners'), zin: t('inr.k.nogNiet'), mist: true });
  return voorstel('bewoners', { kop: t('inr.k.bewKop'), zin: t('inr.k.bewZin'), regels, mist: !lijst.length });
}

/*
 * Klaar (besluit 323): wat SunArc nu doet, met de zonnewaaier van de
 * standpagina, en de rondleiding als keuze. Wat er nog bij kan, staat bij Wat
 * je huis kan (besluit 322).
 */
const sd = {};
let sdGeladen = false;
function laadStand() {
  if (sdGeladen) return;
  sdGeladen = true;
  const deuren = { site: 'api/site', huis: 'api/huis', functies: 'api/functies', energie: 'api/energie', aansluiting: 'api/aansluiting', state: 'api/state', divergence: 'api/divergence', opbrengst: 'api/opbrengst?soort=maand', accu: 'api/accu', thermisch: 'api/thermisch', zon: 'api/zon', klaar: 'api/klaarzetten', sluip: 'api/sluipverbruik' };
  void app.laadBronnen(deuren, sd, teken, ['site', 'huis', 'functies']);
}
function klaarStap() {
  laadStand();
  const open = STAPPEN.filter(([id]) => id !== 'klaar' && !stapNagelopen(id) && !stapGedaan(id));
  const v = sd.huis && sd.functies ? stand.voortgang(sd) : null;
  const namen = (s) => lijstje(v.onderwerpen.filter((x) => x.stand === s).slice(0, 3).map((x) => x.titel.toLowerCase()));
  const regels = v
    ? [['werkt', 'inr.k.werkt'], ['kijkt', 'inr.k.kijkt'], ['leert', 'inr.k.leert']].filter(([s]) => v.tel(s) > 0).map(([s, sleutel]) => ({ b: t(sleutel, { n: v.tel(s) }), zin: namen(s) }))
    : [];
  const nogOpen = open.length ? `<div class="lijst">${regel({ tag: 'a', attrs: `href="#${open[0][0]}"`, ik: 'huis', titel: t('inr.nogTeDoen'), zin: lijstje(open.map(([, naam]) => naam.toLowerCase())), rechts: String(open.length), toon: 'zon' })}</div>` : '';
  const as = d.integ?.aanzetten?.bezig || d.integ?.aanzetten?.fout ? assistentBlok() : '';
  return {
    waar: waarVan('klaar'),
    kop: t('inr.k.klaarKop'),
    uitleg: t('inr.k.klaarZin'),
    inhoud: `${as}${v?.onderwerpen.length ? `<div class="klaarwaaier"><svg viewBox="0 0 390 214" data-klaarwaaier aria-label="${esc(t('voortgang.beschrijving', { pct: v.totaal }))}"></svg></div>` : ''}
      ${regels.length ? vond(regels) : ''}${nogOpen}
      <p class="noot-k">${esc(t('inr.k.later'))} <a href="huis-kan.html">${esc(t('w.watJeHuisKan'))} ›</a></p>`,
    // De knoppen onderaan vast (besluit 158): de rondleiding als keuze, of meteen naar Thuis.
    voet: [terugKnop(), `<span class="rechts"><button type="button" class="kloptknop" data-film>${esc(t('inr.k.laatZien'))}</button><a class="knop knop-licht" href="thuis.html" data-naar-thuis>${esc(t('inr.k.naarThuis'))}</a></span>`],
  };
}

/*
 * Wat Volgende bewaart (besluit 158): wat in beeld staat, ook als de bewoner
 * niets aanraakte. Waar wat in beeld staat al geldt (meten, de regeling,
 * comfort, de zekering), hoeft er niets bewaard te worden. Lukt het niet, dan
 * blijft de stap staan en zegt de melding waarom.
 */
const BEVESTIG = {
  async woning() {
    const next = concept();
    if (!next || d.ind?.indeling?.woning) return true;
    next.woning = woningNu();
    return bewaarIndeling(next);
  },
  async huis() {
    return d.huis?.indeling === 'eigen' || bewaarIndeling(concept());
  },
  async buiten() {
    const next = concept();
    if (!next) return true;
    let anders = !d.huis?.rond;
    next.rond ??= huismodel.rondNu(d.huis);
    for (const k of next.kamers.filter((x) => x.etage === 'buiten' && !x.buiten)) {
      const b = buitenNu(k);
      k.buiten = { soort: b.soort, auto: !!b.auto, tuinhuis: !!b.tuinhuis };
      anders = true;
    }
    return !anders || bewaarIndeling(next);
  },
  // Wat elk apparaat kan (besluit 197): een voorgesteld bereik geldt pas als het bewaard is.
  async apparaat() {
    const next = concept();
    if (!next) return true;
    let anders = false;
    for (const { a, r } of kanToestellen()) {
      const b = kanBereik(a);
      if (!b.fout) continue;
      next.apparaten[sleutel(a)] = { ...(next.apparaten[sleutel(a)] ?? { kamer: r.id, zone: null }), bereik: [b.min, b.max] };
      anders = true;
    }
    return !anders || bewaarIndeling(next);
  },
  async prijzen() {
    if (d.energie?.instellingen || !d.energie?.voorstel) return true;
    const v = JSON.parse(JSON.stringify(d.energie.voorstel));
    const uit = await stuur('api/energie', { ...v, bron: v.bron ?? 'zelf' });
    if (uit) d.energie = { ...d.energie, instellingen: uit };
    return !!uit;
  },
};
