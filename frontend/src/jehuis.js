/*
 * Je huis (besluit 308, stap 2 tot 5): de tekentafel in de standen Vorm, Kamers,
 * Apparaten en Huis (het huis in 3D uit de tekening, kit/huistekenen-3d.js), met de echte etages, kamers, zones en apparaten uit de indeling. De schets is de maatstaf
 * (design/app2/Wand-Huis-Tekenen en Tel-Huis-Tekenen); de motor staat in
 * kit/huistekenen.js en is dezelfde als in de schets.
 *
 * Alles gaat door één deur, `api/huistekening`: lezen geeft de vorm van het
 * huis (de gebouwen van Daken en panelen, of een rechthoek uit het
 * woningtype), de etages, de kamers, de apparaten en wat er al getekend is;
 * bewaren zet alleen de tekening, de zonelijnen, en per apparaat de kamer en
 * de plek in de indeling (een plek naast een zonelijn zet ook de zone). Er gaat niets naar Home
 * Assistant. Bewaren gebeurt na het loslaten, en het antwoord tekent de
 * tekening niet opnieuw: wat onder je vinger ligt, blijft liggen.
 *
 * Bij Vorm (stap 4) staat wat elke bron van het huis vindt: de 3D-kaart, de
 * plattegrond of zonder kaart, met de hoogte. Een andere bron kiezen geldt ook
 * bij Daken en panelen; een buitenmuur rechttrekken blijft in de tekening. De
 * kaarten vraagt hij pas na de melding van Daken en panelen (besluit 256).
 *
 * Ricardo keurde Je huis goed op 17 november 2026 (kwaliteitsronde, stap 3).
 * Sinds 0.191.0 kan hier ook wat eerst alleen bij Kamers en indeling kon: de
 * etage, de soort en naam van een kamer, buiten en verbergen (zie "de
 * indeling" hieronder). Kamers en indeling gaat weg in dezelfde versie als het
 * blad Klimaat per kamer, waar Verwarmen en koelen heen gaat.
 */
'use strict';

const { haal, deur, esc } = app;
const $ = (s, r = document) => r.querySelector(s);
const WIJS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2"/><path d="M15 11a1.5 1.5 0 0 1 3 0v3.5c0 3.6-2.2 6-5.6 6-2.4 0-3.7-.9-5-2.9L5 14.3c-.6-1 .6-2.2 1.6-1.4L9 15"/></svg>';

let tekenaar = null;
/** De standen: Huis is het huis in 3D uit de tekening (stap 5). */
const STANDEN = ['vorm', 'dak', 'kamers', 'apparaten', 'huis'];
/** Wat de dienst als bron en als hoek van het hoofdhuis gaf; een andere bron gaat alleen mee als je hem koos. */
const dienst = { bron: null, nul: null };
/** De kaarten vragen: bezig, of wat er misging. */
const kijk = { bezig: false, fout: null };

const getal = (n) => n.toLocaleString(window.taal?.locale ?? 'nl-NL', { maximumFractionDigits: 1 });
const komma = (n) => n.toLocaleString(window.taal?.locale ?? 'nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Een etagenaam kort: zonder "verdieping" of "floor" erachter, als er dan nog iets staat. */
const kortNaam = (naam) => naam.replace(/\s+(verdieping|etage|floor|storey)$/i, '') || naam;

/** "huis, garage en uitbouw". */
function opsomming(lijst) {
  try {
    return new Intl.ListFormat(window.taal?.locale ?? 'nl-NL', { type: 'conjunction' }).format(lijst);
  } catch {
    return lijst.join(', ');
  }
}

/**
 * Wat een bron van het huis vindt, in woorden (stap 4): de naam, wat hij vond,
 * wat hij weet, en de hoogte. Zonder kaart heet een rechthoek uit het
 * woningtype Basishuis, en wat je bij Daken zelf tekende Zelf getekend.
 */
function bronVoorMotor(id, b, woning) {
  const hoofd = b.blokken.find((x) => x.soort === 'hoofdhuis') ?? b.blokken[0] ?? { b: 0, d: 0 };
  const soort = id === 'zelf' ? (b.zelfGetekend ? 'zelf' : 'basis') : id;
  const maat = { b: getal(hoofd.b), d: getal(hoofd.d) };
  const wat = opsomming([...new Set(b.blokken.map((x) => x.soort))].map((x) => t(`ht.bron.blok.${x}`)));
  const vond = soort === 'basis' ? t('ht.bron.basisVond', { woning: t(`ht.bron.woning.${woning && ['vrijstaand', 'tweekap', 'hoek', 'rij', 'appartement'].includes(woning) ? woning : 'vrijstaand'}`), ...maat }) : soort === 'zelf' ? t('ht.bron.zelfVond', maat) : t('ht.bron.gevonden', { wat });
  const weet = t(`ht.bron.weet.${soort === 'bag3d' && !b.gemeten ? 'bag3dZonder' : soort === 'osm' && b.gemeten ? 'osmMetBag' : soort}`);
  return { naam: t(`ht.bron.${soort}`), vond, weet, gemeten: b.gemeten, hoogte: t(b.gootLaag != null ? 'ht.bron.hoogteScheef' : 'ht.bron.hoogte', { goot: komma(b.goot), nok: komma(b.nok), laag: komma(b.gootLaag ?? b.goot) }),
    // Voor het huis in 3D (stap 5): de goot, de lage goot bij een scheef dak, de nok, en per gebouw het dak.
    goot: b.goot,
    ...(b.gootLaag != null ? { gootLaag: b.gootLaag } : {}),
    nok: b.nok,
    blokken: b.blokken,
    // 0.185.0: de gebouwen van de kaart eromheen, om bij Vorm aan te wijzen.
    omgeving: b.omgeving ?? [],
  };
}

/**
 * Het huis voor de motor: de etages van boven naar beneden, de begane grond
 * met alle gebouwen (garage, uitbouw), de etages erboven en eronder alleen op
 * het hoofdhuis.
 */
/*
 * Buiten als eigen tekening (19 november 2026, schets Wand-Huis-Buiten): het
 * erf is een etage. Het huis ligt erop als één vast vak (HUIS_OP_ERF); de
 * gebouwen van de kaart die los staan, liggen op het erf. Een deel van een
 * ruimte buiten (het terras in de tuin) is een eigen vak: `kamer~zone`.
 */
const HUIS_OP_ERF = '@huis';
const BUITEN_ETAGE = 'buiten';
/** De soort van een deel buiten uit zijn naam, voor het icoon en de kleur: het terras, de border, het tuinhuis. */
function deelSoort(naam) {
  const n = naam.toLowerCase();
  return /terras|patio/.test(n) ? 'terras' : /border|bed|perk/.test(n) ? 'border' : /tuinhuis|schuur|shed/.test(n) ? 'tuinhuis' : /oprit|pad|drive/.test(n) ? 'oprit' : 'tuin';
}
/** Welke ruimte buiten bij een gebouw van de kaart hoort: dezelfde soort, of dezelfde naam. */
function ruimteVoorBlok(blok, kamers, gehad) {
  const soort = blok.soort === 'anders' ? null : blok.soort;
  return kamers.find((k) => !gehad.has(k.id) && soort && (k.soort === soort || k.naam.toLowerCase() === t(`ht.bron.blok.${soort}`).toLowerCase())) ?? null;
}
/** Wat er buiten vanzelf op zijn plek komt, als er nog niets getekend is: het huis, de tuin op het erf, en de gebouwen van de kaart. */
function erfBegin(d, blokken) {
  const buiten = d.kamers.filter((k) => k.etage === BUITEN_ETAGE);
  const garageBinnen = d.kamers.some((k) => k.etage !== BUITEN_ETAGE && k.soort === 'garage');
  const boom = {};
  const gekoppeld = [];
  const gehad = new Set();
  const tuin = buiten.find((k) => k.soort === 'tuin');
  if (tuin && d.buiten?.erf) {
    boom.erf = { kamer: tuin.id };
    gehad.add(tuin.id);
  }
  for (const b of blokken) {
    const huisDeel = b.soort === 'hoofdhuis' || b.soort === 'uitbouw' || (b.soort === 'garage' && garageBinnen);
    if (huisDeel) {
      boom[b.id] = { kamer: HUIS_OP_ERF };
      continue;
    }
    const k = ruimteVoorBlok(b, buiten, gehad);
    if (!k) continue;
    boom[b.id] = { kamer: k.id };
    gehad.add(k.id);
    gekoppeld.push({ blok: b.id, kamer: k.id, naam: k.naam });
  }
  return { boom, gekoppeld, garageBinnen };
}

/**
 * Een leeg vak zonder naam dat op een gebouw ligt dat nu op het erf staat (de
 * garage, het tuinhuis), hoort niet meer op de begane grond: daar was het een
 * vak dat niemand een naam gaf. Bij de eerste keer bewaren is het weg.
 */
function zonderLosBuiten(d, huis) {
  if (!huis.etages.some((e) => e.buiten) || !d.tekening) return d;
  const los = (d.bronnen?.[d.bron]?.blokken ?? []).filter((b) => ['tuinhuis', 'carport', 'anders'].includes(b.soort) || (b.soort === 'garage' && !huis.garageBinnen));
  if (!los.length) return d;
  const op = (vak) => los.some((b) => vak[0] >= b.u - 0.15 && vak[1] >= b.v - 0.15 && vak[0] + vak[2] <= b.u + b.b + 0.15 && vak[1] + vak[3] <= b.v + b.d + 0.15);
  const tekening = Object.fromEntries(Object.entries(d.tekening).map(([e, lijst]) => [e, e === BUITEN_ETAGE ? lijst : lijst.filter((r) => r.kamer || r.naam || !r.vakken.every(op))]));
  return { ...d, tekening };
}

/**
 * Wat voor huis (schets Wand-Huis-Woning, 20 november 2026): koos de bewoner
 * de muren tegen de buren nog niet, dan geldt wat de kaart ziet, met de vraag
 * Klopt dit? boven de tekening.
 */
function woningVoorMotor(d) {
  const gekozen = Array.isArray(d.buren);
  const kaart = d.woningKaart ?? null;
  const soort = gekozen || !kaart ? d.woning : kaart.soort;
  // Een appartement: op welke verdieping en hoeveel erboven (20 november 2026).
  return { soort, buren: gekozen ? d.buren : (kaart?.buren ?? []), kaart, gekozen, verdieping: d.verdieping ?? null, erboven: d.erboven ?? null };
}

function huisVoorMotor(d) {
  const beneden = d.etages.some((e) => e.id === 'bg') ? 'bg' : d.etages.at(-1)?.id;
  const hoofd = d.vorm.blokken.filter((b) => b.soort === 'hoofdhuis');
  // Stap 4: elke bron op hetzelfde ruitjespapier, met wat hij vond; de kaarten die het huis niet kennen, in een regel.
  const bronnen = Object.fromEntries(Object.entries(d.bronnen ?? {}).map(([id, b]) => [id, bronVoorMotor(id, b, d.woning)]));
  const nietGevonden = ['bag3d', 'osm'].filter((k) => d.kaarten?.[k] && d.kaarten[k] !== 'huis').map((k) => ({ naam: t(`ht.bron.${k}`), zin: t(`ht.bron.niet.${d.kaarten[k]}`) }));
  // Vragen kan als de plek bekend is en een kaart vandaag nog niets (of een fout) zei.
  const kanKijken = d.kaarten != null && ['bag3d', 'osm'].some((k) => d.kaarten[k] == null || d.kaarten[k] === 'fout');
  const metErf = !!d.buiten;
  const erfBlokken = d.bronnen?.[d.bron]?.blokken ?? d.vorm.blokken;
  const erf = metErf ? erfBegin(d, erfBlokken) : null;
  return {
    maat: d.vorm.maat,
    beneden,
    // Buiten (19 november 2026): het erf om het huis, en of de garage binnen hoort (dan blijft hij op de begane grond).
    ...(metErf ? { erf: d.buiten.erf ? { id: 'erf', soort: 'erf', ...d.buiten.erf } : null, garageBinnen: erf.garageBinnen, begin: { [BUITEN_ETAGE]: erf.boom }, erfGekoppeld: erf.gekoppeld } : {}),
    ...(Object.keys(bronnen).length ? { bron: d.bron, bronnen } : {}),
    nietGevonden,
    ...(kanKijken ? { kijk } : {}),
    woning: woningVoorMotor(d),
    // Kort voor de balk op de telefoon en het huis opzij: "Eerste verdieping" wordt "Eerste", "First floor" wordt "First".
    etages: [
      ...d.etages.map((e) => ({ id: e.id, naam: e.naam, kort: kortNaam(e.naam), hoogte: e.hoogte, dak: !!e.dak, blokken: e.id === beneden ? d.vorm.blokken : hoofd })),
      ...(metErf ? [{ id: BUITEN_ETAGE, naam: d.buiten.naam, kort: d.buiten.naam, hoogte: 0.1, buiten: true, blokken: [] }] : []),
    ],
    kamers: [
      ...d.kamers.map((k) => ({ id: k.id, naam: k.naam, soort: k.soort ?? null, etage: k.etage, zones: k.etage === BUITEN_ETAGE ? [] : k.zones })),
      // Elk deel van een ruimte buiten is een eigen vak, en het huis staat er vast op.
      ...d.kamers.filter((k) => k.etage === BUITEN_ETAGE).flatMap((k) => (k.delen ?? []).map((z) => ({ id: `${k.id}~${z.id}`, naam: z.naam, soort: z.soort ?? deelSoort(z.naam), etage: BUITEN_ETAGE, zones: [], deelVan: k.id }))),
      ...(metErf ? [{ id: HUIS_OP_ERF, naam: t('ht.buiten.huis'), soort: 'thuis', etage: BUITEN_ETAGE, zones: [] }] : []),
    ],
    // Stap 3: de apparaten binnen, in hun kamer of nog zonder (de strook).
    apparaten: d.apparaten ?? [],
    verborgen: d.verborgen ?? 0,
    // Stap 3: om ze in Je huis terug te halen.
    verborgenLijst: d.verborgenLijst ?? [],
  };
}

/* ------------------------------------------------------------ de indeling */

/*
 * Stap 3 van de kwaliteitsronde (17 november 2026, schets Wand-Huis-Aanvulling):
 * wat eerst alleen bij Kamers en indeling kon, staat in de bladen van Je huis.
 * De etage (naam, onder het dak, volgorde, erbij of weg), de soort en de naam
 * van een kamer, wat er rond het huis is en waar de thuisaccu staat, en een
 * apparaat verbergen of terughalen. Het bewaart in dezelfde indeling als
 * Kamers en indeling, met dezelfde regels (`api/indeling`).
 */
let info = null;
let huisData = null;
async function laadIndeling() {
  const [i, h] = await Promise.allSettled([haal('api/indeling'), haal('api/huis')]);
  if (i.status === 'fulfilled') info = i.value;
  if (h.status === 'fulfilled') huisData = h.value;
}
function concept() {
  const basis = info?.indeling ?? info?.voorstel;
  return basis ? JSON.parse(JSON.stringify(basis)) : null;
}
const volgordeVan = (d) => (d.volgorde?.length ? [...d.volgorde] : (info?.etages ?? []).map((e) => e.id).filter((id) => id !== 'buiten'));
// Een lijstje van vóór 6 november 2026 kent de border niet: die stond er toen altijd.
const rondVan = (d) => (d?.rond ? { border: true, allebei: false, ...d.rond } : huismodel.rondNu(huisData));

/*
 * De plekken buiten voor een apparaat (besluit 269; sinds besluit 317 hier, eerst
 * bij Kamers en indeling): de voordeur altijd, en elk deel rond het huis;
 * wat nog niet aan staat, gaat aan als je het kiest (18-11). Een plek zonder ruimte krijgt er een als je er een apparaat zet.
 */
const binnenEtage = (k) => k.etage !== 'buiten' && !huismodel.isBuiten({ id: k.etage }, k);
const ruimteVanId = (id) => (huisData?.etages ?? []).flatMap((e) => e.ruimtes ?? []).find((r) => r.id === id) ?? null;
const buitenSoort = (k) => (k.buiten ?? ruimteVanId(k.id)?.buiten ?? huismodel.soortBuiten(k)).soort;
function plekNaam(soort, rond) {
  if (soort === 'voordeur') return t('huis.buiten.voordeur');
  if (soort === 'tuinhuis') return t(huismodel.huisjeNaam(rond));
  if (soort === 'carport') return t('soort.buiten.carport');
  return t(`huis.buiten.${soort}`);
}
/** [{ waarde: kamer-id of `plek:soort`, naam }] */
function plekkenBuiten(d) {
  const rond = rondVan(d);
  const kamers = (d?.kamers ?? []).filter((k) => !binnenEtage(k));
  // Ook wat nog niet aan staat (18-11), na wat aan staat: kiezen zet het aan (plekErbij).
  const delen = huismodel.rondom().filter(([, , s]) => s);
  const soorten = ['voordeur', ...delen.filter(([w]) => huismodel.rondAan(rond, w)).map(([, , s]) => s), ...delen.filter(([w]) => !huismodel.rondAan(rond, w)).map(([, , s]) => s)];
  // Een deel dat al een zone is van een ruimte buiten (het terras in de tuin), staat niet nog eens los (18 november 2026).
  const alsZone = new Set(kamers.flatMap((k) => (k.zones ?? []).flatMap((z) => [z.id, z.naam.toLowerCase()])));
  const vast = soorten.filter((soort) => kamers.some((x) => buitenSoort(x) === soort) || !alsZone.has(soort)).map((soort) => {
    const k = kamers.find((x) => buitenSoort(x) === soort);
    return { waarde: k ? k.id : `plek:${soort}`, naam: k?.naam ?? plekNaam(soort, rond) };
  });
  const rest = kamers.filter((k) => !vast.some((p) => p.waarde === k.id)).map((k) => ({ waarde: k.id, naam: k.naam }));
  // De delen van een ruimte buiten (18 november 2026), zoals het terras en de border in de tuin, elk achter zijn ruimte.
  return [...vast, ...rest].flatMap((p) => {
    const k = kamers.find((x) => x.id === p.waarde);
    // Een ruimte met delen krijgt een eigen kopje: Achtertuin met Tuinhuis, Border en Terras.
    return k?.zones?.length ? [{ ...p, groep: k.naam }, ...k.zones.map((z) => ({ waarde: `${k.id}~${z.id}`, naam: z.naam, groep: k.naam }))] : [p];
  });
}
/** De ruimte van een plek in een indeling, of een nieuwe als hij er nog niet is. Geeft het id. */
function plekErbij(next, soort) {
  const bestaat = next.kamers.find((k) => !binnenEtage(k) && buitenSoort(k) === soort);
  if (bestaat) return bestaat.id;
  let rond = rondVan(next);
  // Een deel dat nog niet aan stond, gaat aan, met waar het aan hangt (de carport aan de oprit).
  const deel = huismodel.rondom().find(([, , s]) => s === soort)?.[0];
  if (deel && !huismodel.rondAan(rond, deel)) {
    const aan = huismodel.hangtAan(deel);
    if (aan && !rond[aan]) rond = huismodel.rondWissel(rond, aan);
    if (!rond[deel]) rond = huismodel.rondWissel(rond, deel);
    next.rond = rond;
  }
  const naam = plekNaam(soort, rond);
  let id = naam.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'buiten';
  for (let i = 2, basis = id; next.kamers.some((k) => k.id === id); i++) id = `${basis}-${i}`;
  next.kamers.push({ id, naam, etage: 'buiten', buiten: { soort, auto: (soort === 'oprit' || soort === 'carport') && !!rond.auto, tuinhuis: false }, zones: [], regelzone: null, haGebied: null });
  return id;
}
/** Een vaste etage op zijn plek: de kelder onderaan, de derde verdieping bovenaan. */
function opZijnPlek(volgorde, id) {
  const plek = (x) => (info?.standaard ?? []).findIndex((s) => s.id === x);
  const mijn = plek(id);
  const voor = volgorde.findIndex((x) => plek(x) > mijn && plek(x) !== -1);
  const uit = [...volgorde];
  uit.splice(voor === -1 ? uit.length : voor, 0, id);
  return uit;
}

const indeling = {
  /** Wat de bladen tonen. */
  gegevens() {
    const d = concept();
    if (!d || !tekenaar) return null;
    const v = volgordeVan(d);
    const e = tekenaar.st.etage;
    const i = v.indexOf(e);
    const rond = rondVan(d);
    const accu = huisData?.opslag?.batterij ?? null;
    const accuNu = d.accu?.plek === 'binnen' ? `binnen:${d.accu.kamer}` : d.accu?.plek === 'garage' && rond.garage ? 'garage' : 'gevel';
    const binnen = (d.kamers ?? []).filter((k) => k.etage !== 'buiten' && !huismodel.isBuiten({ id: k.etage }, k));
    return {
      etage: { kanHoger: i > 0, kanLager: i >= 0 && i < v.length - 1, kanWeg: e !== 'bg' && !(d.kamers ?? []).some((k) => k.etage === e) },
      nieuweEtages: (info?.standaard ?? []).filter((s) => s.id !== 'buiten' && !v.includes(s.id)).map((s) => [s.id, s.naam]),
      // Wat aan iets anders hangt (de auto aan de oprit, de border aan de tuin), alleen als dat er is.
      // Het tuinhuis en het schuurtje als twee losse knoppen (18 november 2026): je kunt ze allebei hebben.
      rond: huismodel.rondom()
        .filter(([w]) => !huismodel.hangtAan(w) || huismodel.rondAan(rond, huismodel.hangtAan(w)))
        .flatMap(([w, naam, , icoon]) => (w === 'tuinhuis'
          ? ['tuinhuis', 'schuurtje'].map((x) => ({ w: `huisje:${x}`, naam: t(x === 'tuinhuis' ? 'inr.tuinhuis' : 'inr.schuurtje'), icoon: x === 'tuinhuis' ? 'tuinhuis' : 'schuur', aan: huismodel.huisjesVan(rond)[x] }))
          : [{ w, naam, icoon, aan: huismodel.rondAan(rond, w) }])),
      huisje: null,
      accu: accu
        ? { naam: accu.naam, nu: accuNu, opties: [['gevel', t('indeling.accu.gevel')], ...(rond.garage ? [['garage', t('indeling.accu.garage')]] : []), ...binnen.map((k) => [`binnen:${k.id}`, k.naam])] }
        : null,
      soorten: huismodel.KAMER_SOORTEN,
      plekken: plekkenBuiten(d),
      // Wat buiten nog geen ruimte is (de voortuin, de achtertuin, de oprit…), om een vak meteen zo te noemen.
      nieuwBuiten: plekkenBuiten(d)
        .filter((p) => p.waarde.startsWith('plek:') && !['voordeur', 'garage', 'tuinhuis', 'schuur'].includes(p.waarde.slice(5)))
        .map((p) => ({ soort: p.waarde.slice(5), naam: p.naam, icoon: p.waarde.slice(5) === 'oprit' ? 'oprit' : 'tuin' })),
    };
  },

  /** Een tik of een veld: de indeling aanpassen en bewaren, daarna het blad en de tekening opnieuw. */
  async doe(actie, w) {
    if (actie === 'klimaat') {
      // Verwarmen en koelen staat bij Klimaat, in het blad van de kamer (besluit 317).
      location.href = `comfort.html#${encodeURIComponent(w)}`;
      return;
    }
    const next = concept();
    if (!next || !tekenaar) return;
    const etage = tekenaar.st.etage;
    /** @type {string | boolean} Een etage erbij of weg: naar welke etage daarna; verschoven: true. */
    let structuur = false;
    if (actie === 'etage-naam') {
      const standaard = info.etages.find((x) => x.id === etage)?.standaardNaam;
      if (!w || w === standaard) delete next.etages[etage];
      else next.etages[etage] = w;
    } else if (actie === 'dak') {
      if (w === '1') next.dak = etage;
      else if (huisData?.dakEtage === etage || next.dak === etage) next.dak = 'geen';
      else return;
    } else if (actie === 'schuif') {
      const v = volgordeVan(next);
      const i = v.indexOf(etage);
      const j = i + Number(w);
      if (i < 0 || j < 0 || j >= v.length) return;
      [v[i], v[j]] = [v[j], v[i]];
      next.volgorde = v;
      structuur = true;
    } else if (actie === 'etage-erbij') {
      next.volgorde = opZijnPlek(volgordeVan(next), w);
      structuur = w;
    } else if (actie === 'etage-weg') {
      next.volgorde = volgordeVan(next).filter((x) => x !== etage);
      delete next.etages[etage];
      if (next.dak === etage) delete next.dak;
      structuur = 'bg';
    } else if (actie === 'kamer-soort' || actie === 'kamer-naam') {
      const k = (next.kamers ?? []).find((x) => x.id === w?.kamer);
      if (!k) return;
      if (actie === 'kamer-naam') {
        if (!w.w || w.w === k.naam) return;
        k.naam = w.w;
      } else if (w.w) k.soort = w.w;
      else delete k.soort;
    } else if (actie === 'woning' || actie === 'buur' || actie === 'woning-ja' || actie === 'flat') {
      // Wat voor huis (20 november 2026): de soort en de muren tegen de buren, samen bewaard.
      const w0 = tekenaar.huis.woning ?? {};
      if (actie === 'flat') {
        // Een appartement: de verdieping of erboven een hoger of lager.
        const f = woningDeel.stap({ verdieping: next.verdieping ?? w0.verdieping, erboven: next.erboven ?? w0.erboven }, w.wat, w.d);
        next.verdieping = f.verdieping;
        next.erboven = f.erboven;
      } else if (actie === 'woning-ja' && w0.kaart) {
        next.woning = w0.kaart.soort;
        next.buren = w0.kaart.buren;
      } else if (actie === 'woning') {
        next.woning = w;
        next.buren = woningDeel.burenBij(w, w0.kaart, next.buren ?? w0.buren);
      } else if (actie === 'buur') {
        next.buren = woningDeel.wissel(next.buren ?? w0.buren, w);
        const soort = next.woning ?? w0.soort;
        // Een muur erbij bij een vrijstaand huis maakt het een twee-onder-een-kap; geen enkele meer: vrijstaand.
        if (next.buren.length && (!soort || soort === 'vrijstaand')) next.woning = next.buren.filter((k) => k !== 'achter').length > 1 ? 'rij' : 'tweekap';
        else if (!next.buren.length && soort !== 'appartement') next.woning = 'vrijstaand';
        else next.woning = soort;
      }
    } else if (actie === 'rond') next.rond = String(w).startsWith('huisje:') ? huismodel.huisjeWissel(rondVan(next), w.slice(7)) : huismodel.rondWissel(rondVan(next), w);
    else if (actie === 'huisje') next.rond = { ...rondVan(next), schuur: w === 'schuur', allebei: w === 'beide' };
    else if (actie === 'accu') {
      if (w === 'gevel') delete next.accu;
      else next.accu = w === 'garage' ? { plek: 'garage', kamer: null } : { plek: 'binnen', kamer: w.slice(7) };
    } else if (actie === 'verberg') {
      // De kamer blijft bewaard (18 november 2026): Terughalen zet hem weer waar hij stond.
      next.verborgen = [...new Set([...(next.verborgen ?? []), w])];
      tekenaar.st.wapen = null;
      tekenaar.st.kies = null;
    } else if (actie === 'terug') next.verborgen = (next.verborgen ?? []).filter((x) => x !== w);
    else if (actie === 'samenvoegen') {
      // Een gebouw dat ook als deel van de tuin stond (19 november 2026): wat in dat deel stond, gaat naar het gebouw; het deel is weg.
      const van = next.kamers.find((k) => k.id === w.van);
      if (!van || !next.kamers.some((k) => k.id === w.kamer)) return;
      for (const a of Object.values(next.apparaten)) {
        if (a.kamer === w.van && a.zone === w.zone) {
          a.kamer = w.kamer;
          a.zone = null;
          delete a.plek;
        }
      }
      van.zones = (van.zones ?? []).filter((z) => z.id !== w.zone);
    } else if (actie === 'vak-buiten') {
      // Een vak buiten wordt een plek die er nog niet was (19 november 2026): eerst de ruimte in de indeling, daarna noemt de tekening het vak zo.
      const vak = tekenaar.st.kies?.soort === 'ruimte' ? tekenaar.st.kies.id : null;
      naNoem = { vak, kamer: plekErbij(next, String(w)) };
    } else if (actie === 'app-buiten') {
      // Een apparaat buiten (besluit 269 en 317): bij de voordeur, in de garage; een plek zonder ruimte komt er nu bij.
      // Ook in een deel van een ruimte buiten (18 november 2026), zoals het terras of de border in de tuin: `kamer~zone`.
      const [app, plek] = String(w).split('|');
      const [ruimte, zone = null] = plek.split('~');
      const kamer = ruimte.startsWith('plek:') ? plekErbij(next, ruimte.slice(5)) : ruimte;
      next.apparaten[app] = { ...(next.apparaten[app] ?? {}), kamer, zone };
      // Eén apparaat, één bolletje (20 november 2026): wat erin zit, zoals de schijnwerper van een camera, gaat mee.
      for (const b of tekenaar.st.apparaten.find((x) => x.id === app)?.bij ?? []) {
        if (b.id === app) continue;
        const { plek: _plek, ...oud } = next.apparaten[b.id] ?? {};
        next.apparaten[b.id] = { ...oud, kamer, zone };
      }
      next.verborgen = (next.verborgen ?? []).filter((x) => x !== app);
      tekenaar.st.wapen = null;
      tekenaar.st.kies = null;
    } else return;
    const res = await deur('api/indeling', next);
    const body = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      tekenaar.st.fout = res?.status === 403 ? t('indeling.beheerder') : (body.fout ?? t('jehuis.nietBewaard'));
      tekenaar.ververs();
      return;
    }
    tekenaar.st.fout = null;
    info = { ...info, indeling: body };
    // Een etage erbij, weg of verschoven: het huis opzij verandert, dus de pagina opnieuw, op de goede etage.
    if (structuur) {
      if (typeof structuur === 'string') location.hash = `#${encodeURIComponent(structuur)}`;
      location.reload();
      return;
    }
    await vernieuw();
    if (naNoem?.vak != null) tekenaar.noem(naNoem.vak, { kamer: naNoem.kamer });
    naNoem = null;
  },
};
/** Na een nieuwe plek buiten: welk vak en welke ruimte (actie vak-buiten). */
let naNoem = null;

/*
 * Een vraag boven de tekening van buiten (19 november 2026, schets
 * Wand-Huis-Buiten): de kaart vond gebouwen en koppelde ze aan je ruimtes
 * (Klopt dit?), of een gebouw staat twee keer: als deel van de tuin en als
 * eigen ruimte (samenvoegen). Zo laten onthoudt de browser.
 */
const VRAAG_WEG = 'sc-jehuis-vraag-weg';
const vraagWeg = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(VRAAG_WEG) ?? '[]'));
  } catch {
    return new Set();
  }
};
let koppelGezien = false;
/** De ruimte buiten die ook als deel van een andere ruimte buiten staat (het tuinhuis in de tuin). */
function dubbel(d) {
  const buiten = d.kamers.filter((k) => k.etage === BUITEN_ETAGE);
  for (const k of buiten) {
    for (const p of buiten) {
      if (p.id === k.id) continue;
      const z = (p.delen ?? []).find((x) => x.id === k.id || x.naam.toLowerCase() === k.naam.toLowerCase());
      if (z) return { kamer: k, van: p, zone: z };
    }
  }
  return null;
}
function vraag(tk, d) {
  const el = $('#vraag');
  if (!el) return;
  const opErf = tk.huis.etages.find((e) => e.id === tk.st.etage)?.buiten && tk.st.stand !== 'huis';
  const gekoppeld = tk.huis.erfGekoppeld ?? [];
  const twee = dubbel(d);
  const weg = vraagWeg();
  let html = '';
  if (opErf && !koppelGezien && gekoppeld.length && !(d.tekening?.[BUITEN_ETAGE] ?? []).length) {
    const namen = opsomming(gekoppeld.map((g) => g.naam.toLowerCase()));
    html = `<span class="jh-vraag-ik">${iconen.svg('garage')}</span><div class="jh-vraag-tekst"><b>${esc(t('jehuis.koppel.kop', { namen }))}</b><span>${esc(t('jehuis.koppel.zin'))}</span></div><div class="jh-vraag-knoppen"><button type="button" class="jh-zacht" data-vraag-doe="koppel-anders">${esc(t('jehuis.koppel.anders'))}</button><button type="button" class="jh-hoofd" data-vraag-doe="koppel-ja">${esc(t('jehuis.koppel.ja'))}</button></div>`;
  } else if (tk.st.stand === 'dak' && tk.hoofdBlok()?.kapelVraag && tk.st.kapellen.length) {
    // Een dakkapel op de 3D-kaart (stap 4 punt 3): klopt hij? Ja houdt hem, nee haalt hem weg.
    const k = tk.st.kapellen[0];
    const m = tk.dakMaat();
    const kant = m?.langs ? t(k.kant === 0 ? 'ht.dakkapel.links' : 'ht.dakkapel.rechts') : t(k.kant === 0 ? 'ht.dakkapel.voor' : 'ht.dakkapel.achter');
    const etage = tk.huis.etages.find((e) => e.id === (k.etage ?? tk.dakEtage()));
    html = `<span class="jh-vraag-ik">${iconen.svg('dak')}</span><div class="jh-vraag-tekst"><b>${esc(t('jehuis.kapel.kop'))}</b><span>${esc(t('jehuis.kapel.zin', { kant: kant.toLowerCase(), etage: (etage?.kort ?? etage?.naam ?? '').toLowerCase(), breed: (Math.round((k.tot - k.van) * 10) / 10).toLocaleString(taal.locale ?? 'nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }))}</span></div><div class="jh-vraag-knoppen"><button type="button" class="jh-zacht" data-vraag-doe="kapel-nee">${esc(t('jehuis.kapel.nee'))}</button><button type="button" class="jh-hoofd" data-vraag-doe="kapel-ja">${esc(t('jehuis.kapel.ja'))}</button></div>`;
  } else if (tk.st.stand === 'vorm' && !opErf && tk.huis.woning?.kaart && !tk.huis.woning.gekozen && !weg.has('woning')) {
    // Wat voor huis volgens de kaart (20 november 2026): ja houdt het, nee laat de bewoner zelf kiezen in het blad.
    const k = tk.huis.woning.kaart;
    const kanten = opsomming(k.buren.map((x) => t(`wn.kantKlein.${x}`)));
    html = `<span class="jh-vraag-ik">${iconen.svg('thuis')}</span><div class="jh-vraag-tekst"><b>${esc(t('jehuis.wn.kop', { soort: t(`wn.soort.${k.soort}`).toLowerCase() }))}</b><span>${esc(t(k.buren.length === 0 ? 'jehuis.wn.zinGeen' : k.buren.length === 1 ? 'jehuis.wn.zinEen' : 'jehuis.wn.zinMeer', { kanten }))}</span></div><div class="jh-vraag-knoppen"><button type="button" class="jh-zacht" data-vraag-doe="woning-nee">${esc(t('jehuis.wn.nee'))}</button><button type="button" class="jh-hoofd" data-vraag-doe="woning-ja">${esc(t('jehuis.wn.ja'))}</button></div>`;
  } else if (opErf && info && twee && !weg.has(`dubbel:${twee.kamer.id}`)) {
    html = `<span class="jh-vraag-ik">${iconen.svg('tuinhuis')}</span><div class="jh-vraag-tekst"><b>${esc(t('jehuis.dubbel.kop', { naam: twee.kamer.naam }))}</b><span>${esc(t('jehuis.dubbel.zin', { ruimte: twee.van.naam }))}</span></div><div class="jh-vraag-knoppen"><button type="button" class="jh-zacht" data-vraag-doe="dubbel-nee">${esc(t('jehuis.dubbel.nee'))}</button><button type="button" class="jh-hoofd" data-vraag-doe="dubbel-ja">${esc(t('jehuis.dubbel.ja'))}</button></div>`;
  }
  el.hidden = !html;
  if (el.innerHTML !== html) el.innerHTML = html;
}
async function vraagDoe(tk, d, wat) {
  if (wat === 'kapel-ja' || wat === 'kapel-nee') {
    // De dakkapel van de 3D-kaart: ja houdt hem (de vraag gaat weg), nee haalt hem weg; de pagina laadt opnieuw.
    return gebouw({ dak: 'hoofd', kaartKapel: wat === 'kapel-ja' ? 'ja' : 'nee' });
  }
  if (wat === 'woning-ja') {
    await indeling.doe('woning-ja');
    return vraag(tk, d);
  }
  if (wat === 'woning-nee') {
    const weg = vraagWeg();
    weg.add('woning');
    // Zelf kiezen: het blad Wat voor huis open.
    tk.st.wnOpen = true;
    tk.ververs();
    try {
      localStorage.setItem(VRAAG_WEG, JSON.stringify([...weg]));
    } catch {
      // Dan komt de vraag de volgende keer terug.
    }
    return vraag(tk, d);
  }
  if (wat === 'koppel-ja') {
    koppelGezien = true;
    tk.bewaarNu();
  } else if (wat === 'koppel-anders') {
    koppelGezien = true;
    // Het eerste gebouw open: wat is dit?
    const g = tk.huis.erfGekoppeld?.[0];
    const v = tk.vloer();
    const id = g ? Number(Object.entries(v.ruimtes).find(([, r]) => r.kamer === g.kamer)?.[0]) : NaN;
    if (Number.isFinite(id)) tk.kies({ soort: 'ruimte', id });
  } else if (wat === 'dubbel-nee') {
    const twee = dubbel(d);
    const weg = vraagWeg();
    if (twee) weg.add(`dubbel:${twee.kamer.id}`);
    try {
      localStorage.setItem(VRAAG_WEG, JSON.stringify([...weg]));
    } catch {
      // Dan komt de vraag de volgende keer terug.
    }
  } else if (wat === 'dubbel-ja') {
    const twee = dubbel(d);
    if (twee) await indeling.doe('samenvoegen', { kamer: twee.kamer.id, van: twee.van.id, zone: twee.zone.id });
    return location.reload();
  }
  vraag(tk, d);
}

/** Na bewaren: de namen, de soorten en de apparaten opnieuw van de dienst, in de tekenaar die er staat. */
async function vernieuw() {
  const [d] = await Promise.all([haal('api/huistekening'), laadIndeling()]);
  const nieuw = huisVoorMotor(d);
  const tk = tekenaar;
  if (nieuw.etages.map((e) => e.id).join() !== tk.huis.etages.map((e) => e.id).join()) return location.reload();
  for (const e of tk.huis.etages) Object.assign(e, nieuw.etages.find((x) => x.id === e.id));
  tk.huis.kamers.splice(0, tk.huis.kamers.length, ...nieuw.kamers);
  for (const k of nieuw.kamers) tk.kamers[k.id] = Object.assign(tk.kamers[k.id] ?? {}, k);
  tk.huis.verborgen = nieuw.verborgen;
  tk.huis.verborgenLijst = nieuw.verborgenLijst;
  tk.huis.woning = nieuw.woning;
  // Wat verborgen is, gaat uit de tekening; wat terug is, komt erbij (in de strook als het geen kamer heeft).
  const ids = new Set(nieuw.apparaten.map((a) => a.id));
  tk.st.apparaten = [...tk.st.apparaten.filter((a) => ids.has(a.id)), ...nieuw.apparaten.filter((a) => !tk.st.apparaten.some((b) => b.id === a.id))];
  tk.teken();
  tk.ververs();
}

/** Een apparaat openen; de verborgen apparaten staan in een eigen blad (zonder indeling: bij Apparaten). */
function naar(wat, a) {
  if (wat === 'verborgen') {
    if (tekenaar?.indeling) tekenaar.toonBlad('verborgen');
    else location.href = 'apparaten.html';
    return;
  }
  location.href = `kamer.html#${encodeURIComponent(a.kamer)}/${encodeURIComponent(a.id)}`;
}

const wacht = (ms) => new Promise((ok) => setTimeout(ok, ms));
/** Naar de dienst; bij even te veel achter elkaar nog een paar keer, daarna zegt het label het. */
async function opslaan(x) {
  for (let poging = 0; ; poging++) {
    // De bron alleen als je een andere koos (ook met stap terug): die geldt dan ook bij Daken en panelen.
    const bron = x.bron && x.bron !== dienst.bron ? { bron: x.bron } : {};
    const res = await deur('api/huistekening', { tekening: x.tekening, zones: x.zones, plekken: x.plekken, apparaten: x.apparaten, nul: dienst.nul, ...(x.openingen ? { openingen: x.openingen, ramen: x.ramen } : {}), ...bron });
    if (res?.ok) {
      if (bron.bron) dienst.bron = bron.bron;
      return;
    }
    if (res?.status === 429 && poging < 3) {
      await wacht(5000);
      continue;
    }
    const fout = await res?.json().catch(() => null);
    throw new Error(fout?.fout ?? String(res?.status ?? ''));
  }
}

/**
 * De kaarten vragen (stap 4): eerst de melding van Daken en panelen
 * (experimenteel, je privacy, altijd terug), dan dezelfde zoekactie. Daarna
 * opnieuw laden: de bronnen en het ruitjespapier komen dan van de dienst.
 */
function vraagKaarten() {
  const scherm = document.createElement('div');
  scherm.className = 'kk-scherm';
  scherm.innerHTML = dakvlakken.kaartVenster();
  const dicht = () => {
    scherm.remove();
    removeEventListener('keydown', toets);
  };
  const toets = (e) => e.key === 'Escape' && dicht();
  scherm.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-kk-dicht], [data-kk-kaart]');
    if (!el) return;
    dicht();
    if (el.hasAttribute('data-kk-kaart')) await haalKaarten();
  });
  document.body.append(scherm);
  addEventListener('keydown', toets);
  scherm.querySelector('[data-kk-kaart]')?.focus();
}

async function haalKaarten() {
  kijk.bezig = true;
  kijk.fout = null;
  tekenaar.ververs();
  // Eerst wat je net tekende bewaren, dan pas de kaart (20 november 2026): andersom kon de tekening op een ander papier vallen.
  for (let i = 0; i < 40 && !tekenaar.st.bewaard && !tekenaar.st.fout; i++) await wacht(100);
  let res;
  try {
    res = await deur('api/huistekening', { kijk: true });
  } catch {
    res = null;
  }
  if (!res?.ok) {
    // De dienst zegt het in het Nederlands; de pagina zegt het in de taal van de app.
    kijk.bezig = false;
    kijk.fout = t(res?.status === 503 ? 'ht.vorm.geenPlek' : 'ht.vorm.geenAntwoord');
    tekenaar.ververs();
    return;
  }
  // Eerst wat nog bewaard moest worden, dan opnieuw: dezelfde etage en stand.
  for (let i = 0; i < 40 && !tekenaar.st.bewaard && !tekenaar.st.fout; i++) await wacht(100);
  location.reload();
}

/**
 * Een gebouw van de kaart erbij of weg (0.185.0), zoals bij Daken en panelen:
 * eerst wat nog bewaard moest worden, dan de dienst, dan opnieuw laden (de vorm
 * en het ruitjespapier komen van de dienst).
 */
/** De dakkapellen van het huis (stap 4 punt 3, Je huis › Dak): bewaren zonder de pagina opnieuw te laden; de tekening heeft ze al. */
let kapelBezig = Promise.resolve();
function kapel(lijst) {
  kapelBezig = kapelBezig.then(() => deur('api/huistekening', { gebouw: { dak: 'hoofd', dakkapellen: lijst } }).catch(() => null));
}

async function gebouw(wat) {
  for (let i = 0; i < 60 && !tekenaar.st.bewaard && !tekenaar.st.fout; i++) await wacht(100);
  let res;
  try {
    res = await deur('api/huistekening', { gebouw: wat });
  } catch {
    res = null;
  }
  if (res?.ok) {
    location.reload();
    return;
  }
  tekenaar.st.gebouwFout = t('ht.gebouw.fout');
  tekenaar.ververs();
}

/** De tekening, de zin eronder en het blad staan één keer op de pagina: zet ze bij de wand of de telefoon. */
function plaats() {
  const kant = app.telStand() ? '#tel' : '#wand';
  const tafel = $(`${kant} [data-plek="tafel"]`);
  tafel.append($('#tafel'));
  // Op de wand staan de strook en de zin onder de tekening in het vak, op de telefoon eronder: eerst de zin, dan de strook.
  if (kant === '#wand') tafel.append($('#strook'), $('#uitleg'));
  else {
    $(`${kant} [data-plek="uitleg"]`).append($('#uitleg'), $('#strook'));
    // Op de telefoon staat de vraag van buiten boven de tekening, niet erover (19 november 2026).
    tafel.before($('#vraag'));
  }
  $(`${kant} [data-plek="blad"]`).append($('#blad'));
}

function bij() {
  const st = tekenaar.st;
  // Een appartement met verdiepingen erboven heeft geen eigen dak: de tab Dak staat er dan niet (20 november 2026).
  const eigenDak = woningDeel.eigenDak(tekenaar.huis.woning);
  if (!eigenDak && st.stand === 'dak') return tekenaar.zetStand('vorm');
  /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-stand="dak"]')).forEach((b) => (b.hidden = !eigenDak));
  document.querySelectorAll('[data-stand]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.stand === st.stand)));
  document.querySelectorAll('[data-etage-kies]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.etageKies === st.etage)));
  document.querySelectorAll('[data-stap-terug]').forEach((b) => (b.disabled = !st.terug.length));
  document.querySelectorAll('[data-stap-vooruit]').forEach((b) => (b.disabled = !st.vooruit.length));
  document.querySelectorAll('[data-bewaard]').forEach((el) => {
    el.textContent = st.fout ? t('jehuis.nietBewaard') : st.bewaard ? t('jehuis.bewaard') : t('jehuis.bewaren');
    el.classList.toggle('bezig', !st.bewaard && !st.fout);
    el.classList.toggle('fout', !!st.fout);
    el.title = st.fout ?? '';
  });
  $('#uitleg').innerHTML = `${WIJS}<span>${esc(huistekenen.uitleg(tekenaar))}</span>`;
  // Het adres onthoudt de etage en de stand, zodat je na vernieuwen op dezelfde plek staat.
  const adres = `#${encodeURIComponent(st.etage)}${st.stand === 'kamers' ? '' : `/${st.stand}`}`;
  if (location.hash !== adres) history.replaceState(null, '', adres);
}

/**
 * Vanuit Inrichten › Aanpassen (stap 4, zoals de schets Wand-Inrichten-Aanpassen):
 * de terugknop wordt Terug naar Inrichten, met de stap eronder, en rechtsboven
 * Klaar, terug naar Inrichten. Je huis bewaart zelf; Klaar gaat naar de volgende stap.
 */
function vanInrichten() {
  if (new URLSearchParams(location.search).get('van') !== 'inrichten') return;
  document.body.classList.add('van-inrichten');
  // Je huis is stap 1 van de zeven van Inrichten.
  const waar = `${t('inr.k.van', { i: 1, n: 7 })} · ${t('inr.k.jehuis')}`;
  document.querySelectorAll('.terugje').forEach((a) => {
    a.removeAttribute('data-t');
    a.setAttribute('href', 'inrichten.html#jehuis');
    a.classList.add('jh-terug');
    a.innerHTML = `<span>${esc(t('jehuis.terugInrichten'))}</span><small>${esc(waar)}</small>`;
  });
  document.querySelectorAll('.hm-rechts').forEach((el) => el.insertAdjacentHTML('beforeend', `<a class="knop knop-licht jh-klaar" href="inrichten.html?nagelopen=jehuis#meter">${esc(t('jehuis.klaarInrichten'))}</a>`));
}

async function start() {
  plaats();
  vanInrichten();
  let d;
  try {
    [d] = await Promise.all([haal('api/huistekening'), laadIndeling()]);
  } catch {
    $('#blad').innerHTML = `<p class="jh-leeg">${esc(t('jehuis.geenHuis'))}</p>`;
    return;
  }
  dienst.bron = d.bron ?? null;
  dienst.nul = d.nul ?? null;
  const huis = huisVoorMotor(d);
  if (!huis.etages.length) {
    $('#blad').innerHTML = `<p class="jh-leeg">${esc(t('jehuis.geenEtages'))}</p>`;
    return;
  }
  // Het adres: de etage, en bij Apparaten ook de stand (#bg/apparaten).
  const [gevraagd, gevraagdeStand] = decodeURIComponent(location.hash.slice(1)).split('/');
  const etage = huis.etages.some((e) => e.id === gevraagd) ? gevraagd : (huis.etages.find((e) => e.id === 'bg') ?? huis.etages.at(-1)).id;
  const stand = STANDEN.includes(gevraagdeStand) ? gevraagdeStand : 'kamers';
  const tk = huistekenen.maak($('#tekening'), huis, { stand, etage, tekening: zonderLosBuiten(d, huis), opslaan, wacht: 900, naar, kijk: vraagKaarten, gebouw, kapel, openingen: true, vast: [HUIS_OP_ERF], ...(info ? { indeling } : {}) });
  tekenaar = tk;
  window.tekenaar = tk;
  huistekenen.paneel($('#blad'), tk);
  huistekenen.stapel($('#stapel'), tk);
  huistekenen.strook($('#strook'), tk);
  // Op de telefoon de etages als balk; buiten als laatste knop, een etage zoals de andere (19 november 2026).
  const erfEtage = huis.etages.find((e) => e.buiten);
  $('[data-etages]').innerHTML = `${huis.etages.filter((e) => !e.buiten).map((e) => `<button type="button" data-etage-kies="${esc(e.id)}">${esc(e.kort ?? e.naam)}</button>`).join('')}${erfEtage ? `<button type="button" class="tk-buiten" data-etage-kies="${esc(erfEtage.id)}" aria-label="${esc(erfEtage.naam)}" title="${esc(erfEtage.naam)}">${iconen.svg('buiten')}</button>` : info ? `<button type="button" class="tk-buiten" data-buiten-kies aria-label="${esc(t('ht.buiten.kop'))}" title="${esc(t('ht.buiten.kop'))}">${iconen.svg('buiten')}</button>` : ''}`;
  document.querySelectorAll('[data-ik]').forEach((el) => el.insertAdjacentHTML('afterbegin', iconen.svg(el.dataset.ik)));
  tk.op(bij);
  // Op de telefoon staat het blad onder de tekening: een blad dat opengaat (Buiten, een etage), in beeld schuiven (18-11).
  let vorigBlad = null;
  tk.op(() => {
    const nu = tk.st.blad?.naam ?? null;
    if (nu && nu !== vorigBlad && app.telStand()) requestAnimationFrame(() => $('#blad').scrollIntoView({ block: 'start', behavior: 'smooth' }));
    vorigBlad = nu;
  });
  bij();
  // Een oude link naar Kamers en indeling (`#buiten`, `#verborgen`): dat blad meteen open (besluit 317); buiten is nu een etage.
  if (info && (gevraagd === 'verborgen' || (gevraagd === 'buiten' && !erfEtage))) tk.toonBlad(gevraagd);
  // `#buiten/rond`: buiten, met het blad van wat er rond het huis is (de plek van de thuisaccu).
  if (info && erfEtage && gevraagd === 'buiten' && gevraagdeStand === 'rond') tk.toonBlad('buiten');
  // Buiten: de kaart vraagt Klopt dit?, en een ruimte die twee keer staat, kan samen (19 november 2026).
  tk.op(() => vraag(tk, d));
  vraag(tk, d);

  document.addEventListener('click', (e) => {
    const doel = /** @type {HTMLElement} */ (e.target);
    const et = /** @type {HTMLElement | null} */ (doel.closest('[data-etage-kies]'));
    // Op de telefoon: de etage die al gekozen is nog eens, dan zijn blad; Buiten als laatste knop.
    if (et && info && et.dataset.etageKies === tk.st.etage && !tk.st.blad) tk.toonBlad(tk.huis.etages.find((x) => x.id === et.dataset.etageKies)?.buiten ? 'buiten' : 'etage');
    else if (et) {
      tk.st.blad = null;
      tk.zetEtage(et.dataset.etageKies);
    }
    if (doel.closest('[data-buiten-kies]')) tk.toonBlad('buiten');
    const v = /** @type {HTMLElement | null} */ (doel.closest('[data-vraag-doe]'));
    if (v) void vraagDoe(tk, d, v.dataset.vraagDoe ?? '');
    const s = /** @type {HTMLButtonElement | null} */ (doel.closest('[data-stand]'));
    if (s && !s.disabled) tk.zetStand(s.dataset.stand);
    if (doel.closest('[data-stap-terug]')) tk.terug();
    if (doel.closest('[data-stap-vooruit]')) tk.vooruit();
  });
  // Een ander adres op dezelfde pagina (een link, terug in de browser): naar die etage en stand.
  addEventListener('hashchange', () => {
    const [e, s] = decodeURIComponent(location.hash.slice(1)).split('/');
    if (huis.etages.some((x) => x.id === e) && e !== tk.st.etage) tk.zetEtage(e);
    const stand = STANDEN.includes(s) ? s : 'kamers';
    if (stand !== tk.st.stand) tk.zetStand(stand);
  });
  addEventListener('standwissel', () => {
    plaats();
    tk.pasAan();
  });
}

app.start('instellingen');
void start();
