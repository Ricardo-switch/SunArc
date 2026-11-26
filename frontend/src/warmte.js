/*
 * Wat er in een kamer verwarmt en koelt (besluiten 132, 138, 142, 167, 306;
 * sinds besluit 317 bij Klimaat): per klimaatapparaat wat SunArc ermee doet,
 * wat er aan de cv hangt, met welke sensor de kamer meet, en of een zone apart
 * regelt. Eerst stond dit bij Kamers en indeling, als tab Verwarmen en koelen;
 * het verhuisde mee naar het blad van de kamer bij Klimaat (stap 3 van de
 * kwaliteitsronde).
 *
 * De pagina geeft wat ze weet in `ctx`: de indeling (`info`, uit api/indeling),
 * het huis (`huis`, uit api/huis), de verwarming uit Energie, de gekozen kamer
 * van de indeling, en hoe er bewaard en getekend wordt. Bewaren gaat met de hele
 * indeling, zoals bij Kamers en indeling.
 */
'use strict';

(function (global) {
  const { esc, nl } = global.app;
  const t = (k, p) => global.taal.t(k, p);
  const { huismodel, iconen } = global;

  /**
   * @param {{ info: any, huis: any, verwarming: any, kamer: string | null,
   *   bewaar: (next: any, zin: string) => Promise<boolean>, teken: () => void,
   *   bijToestel?: (sleutel: string) => string, kort?: boolean, zone?: string | null }} ctx
   */
  function maak(ctx) {
    /** De indeling om te bewerken: de eigen, of anders het voorstel uit Home Assistant. */
    function concept() {
      const basis = ctx.info?.indeling ?? ctx.info?.voorstel;
      return basis ? JSON.parse(JSON.stringify(basis)) : null;
    }
    /** De ruimte zoals het huis hem toont, met zijn apparaten. */
    function ruimteVan(id) {
      for (const e of ctx.huis?.etages ?? []) for (const r of e.ruimtes ?? []) if (r.id === id) return r;
      return null;
    }
    /** Een id uit een naam, zoals de dienst ze aanneemt. */
    function idVan(tekst, bezet) {
      const basis =
        tekst
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 36) || 'kamer';
      let id = basis;
      for (let i = 2; bezet.has(id); i++) id = `${basis}-${i}`;
      return id;
    }
    const alleBuitenEtage = (k) => k.etage === 'buiten' || huismodel.isBuiten({ id: k.etage }, k);
    const cvThermo = () => huismodel.cvThermostaat(ctx.huis, ctx.verwarming);
    /** Wat er nu in het veld Vermogen staat, ook als het nog niet bewaard is. */
    const veldW = () => /** @type {HTMLInputElement | null} */ (document.querySelector(`${app.zicht()} [data-bron-w]`))?.value;

    /**
     * De regeling van een kamer (besluit 142): de eigen regeling, een zone die nog
     * geen kamer heeft, of meedoen met een kamer die er een heeft. Staat bij
     * Verwarmen en koelen (besluit 167), samen met Meten met.
     */
    function regelingKeuze(d, k) {
      if (k.etage === 'buiten') return '';
      const vrij = ctx.info.regelzones.filter((z) => !d.kamers.some((x) => x.id !== k.id && x.regelzone === z.id));
      const andere = d.kamers.filter((x) => x.id !== k.id && x.etage !== 'buiten' && !x.meedoenMet && (x.regelzone || Object.values(x.rollen ?? {}).some((r) => r !== 'kijken')));
      const regel = [['', t('inr.nietMee')], ...vrij.map((z) => [`zone:${z.id}`, z.id === k.regelzone ? t('indeling.eigenRegeling') : t('indeling.geregeldAls', { naam: z.naam })]), ...andere.map((x) => [`kamer:${x.id}`, t('indeling.doetMee', { naam: x.naam })])];
      const regelNu = k.meedoenMet ? `kamer:${k.meedoenMet}` : k.regelzone ? `zone:${k.regelzone}` : '';
      return `<div><label class="label" for="regel-${esc(k.id)}">${esc(t('groep.regeling'))}</label><select class="invoer" id="regel-${esc(k.id)}" data-actie="regeling">${regel.map(([v, x]) => `<option value="${esc(v)}" ${v === regelNu ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>`;
    }

    /* ------------------------------------------------- verwarmen en koelen (besluit 132) */

    /*
     * Per kamer wat er verwarmt en koelt (schets Wand-Indeling-Warmte). Wat Home
     * Assistant al weet, staat er als "gevonden": een airco, een radiatorknop, een
     * thermostaat. Wat de bewoner toevoegt, gaat met de indeling mee. Een
     * elektrische bron die slim aangaat, krijgt een vermogen en mag op zon; wat
     * met de hand gaat, krijgt een idee in plaats van een tekort.
     */
    const BRON_KEUZE = ['radiator', 'vloer', 'paneel', 'kachel', 'airco'].map((b) => [b, huismodel.metHoofdletter(t(`bron.${b}`))]);
    const AAN_KEUZE = ['thermostaat', 'knop', 'stekker', 'hand'].map((a) => [a, t(`indeling.aan.${a}`)]);
    /** Het formulier van een bron, of null. */
    let bronVorm = null;
    /** De zone waar Eigen regeling werd getikt zonder klimaatapparaat erin: daar staat de uitleg. */
    let zoneUitleg = null;

    /** De klimaatapparaten die het huis kent, met de sleutel waarmee een bron ernaar wijst. */
    function klimaatToestellen() {
      return (ctx.huis?.etages ?? []).flatMap((e) => (e.ruimtes ?? []).flatMap((r) => (r.apparaten ?? []).filter((a) => a.soort === 'klimaat').map((a) => ({ sleutel: a.actuatorId ?? a.id, a, kamer: r }))));
    }
    const toestelNaam = (sleutel) => klimaatToestellen().find((x) => x.sleutel === sleutel)?.a.naam ?? (ctx.huis?.etages ?? []).flatMap((e) => e.ruimtes ?? []).flatMap((r) => r.apparaten ?? []).find((a) => a.id === sleutel)?.naam ?? sleutel;

    const ICOON_WARM = iconen.svg('warm');
    const ICOON_RADIATOR = iconen.svg('verwarming');
    const ICOON_KOEL = iconen.svg('airco');
    const ICOON_THERMO = iconen.svg('klimaat');

    /*
     * De regeling per kamer (besluit 138, schets Wand-Indeling-Regeling): per
     * klimaatapparaat wat de regeling ermee doet. Wat de kamer nog niet vastlegde,
     * staat zoals de dienst het nu regelt.
     */
    const ROL_KEUZE = ['houdt', 'zon', 'kijken'].map((r) => [r, t(`indeling.rol.${r}`), t(`indeling.rol.${r}Zin`)]);
    /** Helpt op zon, als regel met een tik naar De zon verdelen: daar zet je het aan en uit (besluit 345). */
    const zonLink = () => `<a class="rolzon" href="energie.html#zon">${esc(t('indeling.rol.zon'))} ›</a>`;
    function rolVan(k, sleutel) {
      if (k.rollen) return k.rollen[sleutel] ?? 'kijken';
      return klimaatToestellen().find((x) => x.sleutel === sleutel)?.a.klimaat?.rol ?? 'kijken';
    }
    /** Alle klimaatapparaten in de kamer met hun rol, zoals ze nu staan. */
    function rollenNu(k) {
      const rollen = {};
      for (const a of (ruimteVan(k.id)?.apparaten ?? []).filter((x) => x.soort === 'klimaat')) rollen[a.actuatorId ?? a.id] = rolVan(k, a.actuatorId ?? a.id);
      for (const [s, r] of Object.entries(k.rollen ?? {})) if (!(s in rollen)) rollen[s] = r;
      return rollen;
    }
    /** Wat de app voorstelt voor een apparaat dat erbij komt: een airco helpt op zon, de eerste verwarming houdt de kamer warm. */
    function rolVoorstel(k, sleutel) {
      const a = klimaatToestellen().find((x) => x.sleutel === sleutel)?.a;
      if (a?.klimaat?.kanKoelen) return 'zon';
      const alHoudt = Object.entries(rollenNu(k)).some(([s, r]) => s !== sleutel && r === 'houdt');
      return alHoudt ? 'kijken' : 'houdt';
    }
    function rolRegel(k, sleutel) {
      const rol = rolVan(k, sleutel);
      const id = `rol-${sleutel.replace(/[^a-z0-9_-]/gi, '-')}`;
      // Een radiatorknop of de thermostaat van een gasketel helpt niet op zon (besluit 291); stond het er toch, dan blijft het zichtbaar.
      const a = klimaatToestellen().find((x) => x.sleutel === sleutel)?.a;
      // Helpt op zon kies je bij De zon verdelen (besluit 345); staat hij erop, dan zegt de regel dat met een tik erheen.
      if (rol === 'zon') return `<div class="rolrij"><span>${esc(t('indeling.deRegeling'))}</span>${zonLink()}</div>`;
      const keuzes = ROL_KEUZE.filter(([w]) => w !== 'zon');
      void a;
      return `<div class="rolrij"><label for="${esc(id)}">${esc(t('indeling.deRegeling'))}</label><select class="invoer invoer-klein rolkeuze" id="${esc(id)}" data-rol="${esc(sleutel)}">${keuzes.map(([w, x]) => `<option value="${w}" ${w === rol ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>${rol === 'zon' ? `<p class="rolzin">${esc(t('indeling.rolZon'))}</p>` : ''}`;
    }
    /** Alleen de keuze, voor op de regel van een apparaat (besluit 317): wat SunArc ermee doet. */
    function rolKort(k, sleutel, naam) {
      const rol = rolVan(k, sleutel);
      const a = klimaatToestellen().find((x) => x.sleutel === sleutel)?.a;
      if (rol === 'zon') return zonLink();
      const keuzes = ROL_KEUZE.filter(([w]) => w !== 'zon');
      void a;
      // Met een vraagteken erachter (Hulp op de plek, besluit 325): wat die taak betekent.
      const hulp = window.hulp?.vraag({ houdt: 'houdt-op-temperatuur', zon: 'helpt-op-zon', kijken: 'doet-niet-mee' }[rol]) ?? '';
      const keuze = `<select class="invoer invoer-klein rolkeuze kort" data-rol="${esc(sleutel)}" aria-label="${esc(`${t('indeling.deRegeling')}: ${naam}`)}">${keuzes.map(([w, x]) => `<option value="${w}" ${w === rol ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
      return hulp ? `<span class="metvraag">${keuze}${hulp}</span>` : keuze;
    }
    /** De temperatuur in een zone: van de eigen regeling, of het gemiddelde van wat er in die zone meet. */
    function zoneTemp(kamerId, zoneId) {
      const r = ruimteVan(kamerId);
      const reg = (r?.zones ?? []).find((x) => x.id === zoneId)?.regeling?.temperatuurC;
      if (reg != null) return reg;
      const c = (r?.apparaten ?? []).filter((a) => a.zone === zoneId && a.meting?.temperatuurC != null).map((a) => a.meting.temperatuurC);
      return c.length ? c.reduce((s, x) => s + x, 0) / c.length : null;
    }
    /**
     * Wat ervoor zorgt, per zone (zones als deel van de kamer, schets Wand-Klimaat-Subzone):
     * een kop met de naam en wat daar gemeten wordt, en rechts met de kamer mee of een eigen temperatuur.
     * Een eigen temperatuur kan alleen met een klimaatapparaat in die zone, zoals een radiatorknop.
     */
    function perZone(k, kaarten) {
      const zones = k.zones ?? [];
      if (!zones.length) return kaarten.map((x) => x.html).join('');
      const r = ruimteVan(k.id);
      const groepen = zones.map((z) => {
        const lijst = kaarten.filter((x) => x.zone === z.id);
        const toestellen = (r?.apparaten ?? []).filter((a) => a.soort === 'klimaat' && a.zone === z.id);
        const eigen = !!z.rollen && Object.values(z.rollen).some((x) => x !== 'kijken');
        const temp = zoneTemp(k.id, z.id);
        const rechts = eigen
          ? `${z.regelzone && (ctx.info?.regelzones ?? []).some((x) => x.id === z.regelzone) ? `<a class="zone-eigen" href="#${esc(encodeURIComponent(z.regelzone))}">${esc(t('indeling.zone.eigenTemp'))} ›</a>` : ''}<button type="button" class="schakelaar" role="switch" aria-checked="true" aria-label="${esc(t('indeling.zone.eigenTemp'))}" data-zone-regeling="${esc(z.id)}" data-waarde="kamer"></button>`
          : toestellen.length
            ? `<span>${esc(t('indeling.zone.eigenTemp'))}</span><button type="button" class="schakelaar" role="switch" aria-checked="false" aria-label="${esc(t('indeling.zone.eigenTemp'))}" data-zone-regeling="${esc(z.id)}" data-waarde="eigen"></button>`
            : `<span>${esc(t('indeling.zone.metKamer'))}</span>`;
        const kop = `<div class="zonekop${ctx.zone === z.id ? ' aan' : ''}" data-zonekop="${esc(z.id)}"><b>${esc(z.naam)}</b>${temp != null ? `<em>${esc(nl(temp, 1))}°</em>` : ''}<span class="r">${rechts}</span></div>`;
        return `<div class="zonegroep${ctx.zone === z.id ? ' aan' : ''}">${kop}${lijst.map((x) => x.html).join('') || `<p class="mini geen-marge rechts-4 links-4">${esc(t('indeling.zone.leeg'))}</p>`}</div>`;
      });
      const los = kaarten.filter((x) => !x.zone || !zones.some((z) => z.id === x.zone));
      const heel = los.length ? `<div class="zonegroep"><div class="zonekop"><b>${esc(t('w.heleKamer'))}</b></div>${los.map((x) => x.html).join('')}</div>` : '';
      return groepen.join('') + heel;
    }

    /** De taak in een zone met een eigen regeling, op de regel van het apparaat (schrijft `zones[].rollen`). */
    function zoneRolKort(k, z, a) {
      const sleutel = a.actuatorId ?? a.id;
      const rol = z.rollen?.[sleutel] ?? 'kijken';
      const keuzes = ROL_KEUZE.filter(([w]) => w !== 'zon' || rol === 'zon' || huismodel.kanOpZon(a, ctx.huis, ctx.verwarming));
      return `<select class="invoer invoer-klein rolkeuze kort" data-zone-rol="${esc(`${k.id}|${z.id}|${sleutel}`)}" aria-label="${esc(`${t('indeling.deRegeling')}: ${a.naam}`)}">${keuzes.map(([w, x]) => `<option value="${w}" ${w === rol ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
    }
    /** Een apparaat dat een zone regelt (besluit 306): de taak kies je in de zone; een knop erheen (18-11). */
    function naarZone(z) {
      return z.regelzone ? `<a class="knop knop-klein naarzone" href="#${esc(encodeURIComponent(z.regelzone))}">${esc(t('indeling.zone.naarZone', { naam: z.naam }))} ›</a>` : `<span class="mini">${esc(t('indeling.zone.regelt', { naam: z.naam }))}</span>`;
    }
    /**
     * In het blad van een zone (18-11): de apparaten van de zone met hun taak.
     * Schrijft `zones[].rollen` in de indeling, zoals de kamer `rollen`.
     */
    function zoneTaken(kamerId, zoneId) {
      const d = concept();
      const k = d?.kamers.find((x) => x.id === kamerId);
      const z = k?.zones?.find((x) => x.id === zoneId);
      if (!k || !z) return '';
      const toestellen = (ruimteVan(k.id)?.apparaten ?? []).filter((a) => a.soort === 'klimaat' && a.zone === z.id);
      return toestellen
        .map((a) => {
          const sleutel = a.actuatorId ?? a.id;
          const rol = z.rollen?.[sleutel] ?? 'kijken';
          const keuzes = ROL_KEUZE.filter(([w]) => w !== 'zon');
          const select = rol === 'zon' ? zonLink() : `<select class="invoer invoer-klein rolkeuze kort" data-zone-rol="${esc(`${k.id}|${z.id}|${sleutel}`)}" aria-label="${esc(`${t('indeling.deRegeling')}: ${a.naam}`)}">${keuzes.map(([w, x]) => `<option value="${w}" ${w === rol ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
          const soort = a.klimaat?.kanKoelen ? t('indeling.airco') : a.radiatorknop ? t('indeling.knopRadiator') : huismodel.metHoofdletter(t('kan.thermostaat'));
          return bronKaart(a.naam, soort, a.klimaat?.kanKoelen ? ICOON_KOEL : a.radiatorknop ? ICOON_RADIATOR : ICOON_THERMO, !!a.klimaat?.kanKoelen, select, rol === 'zon' ? `<p class="rolzin">${esc(t('indeling.rolZon'))}</p>` : '', ' data-kort');
        })
        .join('');
    }
    function rolKeuzes(gekozen) {
      return `<div class="keuzes" role="radiogroup" aria-label="${esc(t('indeling.watRegeling'))}">${ROL_KEUZE.map(([w, x, u]) => `<button type="button" class="keuze${w === gekozen ? ' aan' : ''}" role="radio" aria-checked="${w === gekozen}" data-bron-rol="${w}"><i></i><span><b>${esc(x)}</b><span>${esc(u)}</span></span></button>`).join('')}</div>`;
    }

    function bronKaart(kop, wat, ikoon, koel, rechts, regels = '', attrs = '') {
      return `<div class="bron"${attrs}><div class="boven"><span class="ikoon${koel ? ' koel' : ''}">${ikoon}</span><div><b>${esc(kop)}</b><span class="wat">${esc(wat)}</span></div>${rechts}</div>${regels}</div>`;
    }

    function warmteBlad(d, k) {
      const kop = '';
      if (bronVorm) return kop + bronFormulier(k);
      const r = ruimteVan(k.id);

      const bronnen = k.bronnen ?? [];
      // Elk klimaatapparaat staat er zelf, met zijn taak, ook als een radiator het volgt (zones als deel van de kamer,
      // 18 november 2026): eerst verdween de Nest, en stond zijn taak onder de radiator.
      const gevonden = (r?.apparaten ?? []).filter((a) => a.soort === 'klimaat');
      // Slim is weg (woordenlijst, besluit 316): een radiator op de cv volgt zijn thermostaat.
      const slim = '';
      const volgt = (sleutel) => `<span class="volgt">${esc(t('w.volgt2', { naam: toestelNaam(sleutel) }))}</span>`;
      const via = (naam) => `${esc(t('indeling.via'))} <b>${esc(naam)}</b>`;
      /** @type {{ zone: string | null, html: string }[]} */
      const kaarten = [];
      const zoneVan = (a) => a.zone ?? null;
      for (const a of gevonden) {
        const sleutel = a.actuatorId ?? a.id;
        if (ctx.kort) {
          // Eén regel per apparaat (besluit 317, Klimaat op de wand): de naam, wat het is, en de taak ernaast.
          const zoneEigen = (k.zones ?? []).find((z) => z.rollen?.[sleutel] != null && z.rollen[sleutel] !== 'kijken');
          // In de zone waar hij hangt meteen de taak van de zone; hangt hij elders, een knop erheen.
          const taak = zoneEigen ? (zoneEigen.id === a.zone ? zoneRolKort(k, zoneEigen, a) : naarZone(zoneEigen)) : rolKort(k, sleutel, a.naam);
          const ketel = cvThermo()?.sleutel === sleutel;
          const soort = a.klimaat?.kanKoelen ? t('indeling.airco') : a.radiatorknop ? t('indeling.knopRadiator') : ketel ? t('indeling.cvThermostaat') : huismodel.metHoofdletter(t('kan.thermostaat'));
          const meer = [a.klimaat?.filter?.pct != null ? t('w.filter', { pct: a.klimaat.filter.pct }) : null, a.radiatorknop?.klepPct != null ? t('indeling.klepPct', { pct: a.radiatorknop.klepPct }) : null].filter(Boolean).join(' · ');
          // Wat hangt eraan? alleen zolang er nog niets aan hangt.
          const vraag = !a.klimaat?.kanKoelen && !a.radiatorknop && !bronnen.some((b) => b.apparaat === sleutel) ? `<button type="button" class="vraagknop" data-bron-nieuw="${esc(sleutel)}">${esc(t('indeling.watHangt'))}</button>` : '';
          const icoon = a.klimaat?.kanKoelen ? ICOON_KOEL : a.radiatorknop ? ICOON_RADIATOR : ICOON_THERMO;
          kaarten.push({ zone: zoneVan(a), html: bronKaart(a.naam, [soort, meer].filter(Boolean).join(' · '), icoon, !!a.klimaat?.kanKoelen, taak, `${ctx.bijToestel?.(sleutel) ?? ''}${vraag}`, ' data-kort') });
          continue;
        }
        const viaRegel = `<div class="regelt">${via(a.naam)}${a.klimaat?.filter?.pct != null ? `<span class="mini">${esc(t('w.filter', { pct: a.klimaat.filter.pct }))}</span>` : ''}${a.radiatorknop?.klepPct != null ? `<span class="mini">${esc(t('indeling.klepPct', { pct: a.radiatorknop.klepPct }))}</span>` : ''}</div>`;
        const zoneEigen = (k.zones ?? []).find((z) => z.rollen?.[sleutel] != null && z.rollen[sleutel] !== 'kijken');
        const rol = zoneEigen ? naarZone(zoneEigen) : rolRegel(k, sleutel);
        const z = zoneVan(a);
        if (a.klimaat?.kanKoelen) kaarten.push({ zone: z, html: bronKaart(t('indeling.airco'), huismodel.opsomming([t('w.koelt'), a.klimaat.kanVerwarmen ? t('w.verwarmt') : null, a.klimaat.kanDrogen ? t('indeling.droogt') : null].filter(Boolean)), ICOON_KOEL, true, slim, viaRegel + rol + (ctx.bijToestel?.(sleutel) ?? '')) });
        else if (a.radiatorknop) kaarten.push({ zone: z, html: bronKaart(t('indeling.knopRadiator'), t('indeling.opCv'), ICOON_RADIATOR, false, slim, viaRegel + rol) });
        // De thermostaat van de ketel (besluit 167): wat eraan hangt, gaat mee. Wat dat is, kies je
        // zoals bij elke thermostaat (issue 140): anders bleef het een radiator, ook bij vloerverwarming.
        else if (cvThermo()?.sleutel === sleutel) kaarten.push({ zone: z, html: bronKaart(t('indeling.cvThermostaat'), t('indeling.cvThermostaatZin'), ICOON_THERMO, false, slim, `${viaRegel}${rol}<button type="button" class="vraagknop" data-bron-nieuw="${esc(sleutel)}">${esc(t('indeling.watHangt'))}</button>`) });
        else kaarten.push({ zone: z, html: bronKaart(t('kan.thermostaat').replace(/^./, (c) => c.toUpperCase()), t('w.gevondenInHomeAssistant'), ICOON_THERMO, false, slim, `${viaRegel}${rol}<button type="button" class="vraagknop" data-bron-nieuw="${esc(sleutel)}">${esc(t('indeling.watHangt'))}</button>`) });
      }
      for (const b of bronnen) {
        const elektrisch = b.soorten.some((x) => huismodel.ELEKTRISCH.has(x));
        const wat = b.aan === 'hand' ? t('indeling.metHand') : [elektrisch ? t('indeling.elektrisch') : b.soorten.includes('airco') ? null : t('indeling.opCv'), b.soorten.length > 1 ? t('indeling.samenAan') : null].filter(Boolean).join(', ') || AAN_KEUZE.find(([v]) => v === b.aan)?.[1].toLowerCase();
        // Wat aan een thermostaat of knop hangt, volgt die: dat zegt de regel, de taak staat bij het apparaat zelf.
        const rechts = b.aan === 'hand' ? `<span class="stand hand">${esc(t('indeling.aan.hand'))}</span>` : b.apparaat ? volgt(b.apparaat) : b.vermogenW ? `<span class="w">${b.vermogenW} W</span>` : slim;
        const ikoon = b.soorten.includes('airco') ? ICOON_KOEL : b.soorten.includes('radiator') ? ICOON_RADIATOR : ICOON_WARM;
        let regels = '';
        if (b.apparaat && b.vermogenW && !ctx.kort) regels += `<div class="regelt"><span class="w">${b.vermogenW} W</span></div>`;
        // Op zon (besluit 132): alleen elektrisch, met vermogen, en een apparaat van de regeling in deze kamer.
        const vanRegeling = !!b.apparaat && !!r?.zoneId && (r?.apparaten ?? []).some((a) => a.soort === 'klimaat' && a.actuatorId === b.apparaat);
        // Op zon zet je bij De zon verdelen (besluit 345); hier een regel als hij erop staat.
        if (huismodel.isElektrischSlim(b) && b.vermogenW && vanRegeling && b.opZon) regels += `<div class="opzon">${zonLink()}</div>`;
        if (b.aan === 'hand' && elektrisch) regels += `<div class="idee"><b>${esc(t('indeling.maakSlim'))}</b>${esc(t('indeling.maakSlimZin'))}</div>`;
        kaarten.push({ zone: b.zone ?? null, html: bronKaart(huismodel.bronNaam(b), wat, ikoon, b.soorten.includes('airco'), rechts, regels, ` data-bron-open="${esc(b.id)}" role="group" aria-label="${esc(huismodel.bronNaam(b))}" tabindex="0"${ctx.kort ? ' data-kort' : ''}`) });
      }
      const leeg = !kaarten.length ? `<p class="klein geen-marge">${esc(t('indeling.nogNietsWarm'))}</p>` : '';
      const doetMee = Object.values(rollenNu(k)).some((x) => x !== 'kijken');
      // Meedoen met een andere kamer (besluit 142): dat zegt de kaart, in plaats van "doet nog niet mee".
      const met = k.meedoenMet ? concept()?.kamers.find((x) => x.id === k.meedoenMet) : null;
      const nietMee = met
        ? `<div class="uitleg"><b>${esc(t('indeling.doetMeePunt', { naam: met.naam }))}</b>${esc(t('indeling.doetMeeZin'))}</div>`
        : kaarten.length && !doetMee ? `<div class="uitleg"><b>${esc(t('indeling.nietMee'))}</b>${esc(t('indeling.nietMeeZin'))}</div>` : '';
      // De apparaten (schets Wand-Klimaat-Kamer), per zone als de kamer zones heeft (schets Wand-Klimaat-Subzone).
      // Waarmee de kamer meet en wie hem regelt, staat sinds besluit 345 bij Klimaat › Meten en regeling.
      return `${kop}${perZone(k, kaarten)}${leeg}${nietMee}
        <button type="button" class="plus" data-bron-nieuw="">${esc(t('w.ietsToevoegen'))}</button>`;
    }

    /*
     * Een zone apart regelen (besluit 306, schets Wand-Zones #indeling): per zone
     * met de kamer mee, of een eigen regeling met de klimaatapparaten in die zone,
     * zoals een radiatorknop in de keuken. Een eigen regeling heeft een eigen doel
     * en tijden bij Comfort, en meet met het eerste apparaat van de zone.
     */
    function zonesBlok(k) {
      if (alleBuitenEtage(k) || !k.zones?.length) return '';
      const r = ruimteVan(k.id);
      const rijen = k.zones.map((z) => {
        const toestellen = (r?.apparaten ?? []).filter((a) => a.soort === 'klimaat' && a.zone === z.id);
        const eigen = !!z.rollen && Object.values(z.rollen).some((x) => x !== 'kijken');
        const reg = (r?.zones ?? []).find((x) => x.id === z.id)?.regeling ?? null;
        const wat = toestellen.length ? toestellen.map((a) => a.naam).join(', ') : t('indeling.zone.geenKnop');
        const temp = eigen && reg?.temperatuurC != null ? `<span class="zone-temp">${nl(reg.temperatuurC)}°${reg.doelC != null ? ` · ${esc(t('indeling.zone.doel', { c: nl(reg.doelC) }))}` : ''}</span>` : '';
        const seg = `<div class="keuze" role="group" aria-label="${esc(t('indeling.zone.regeling', { naam: z.naam }))}"><button type="button" aria-pressed="${!eigen}" data-zone-regeling="${esc(z.id)}" data-waarde="kamer">${esc(t('indeling.zone.metKamer'))}</button><button type="button" aria-pressed="${eigen}" data-zone-regeling="${esc(z.id)}" data-waarde="eigen"${toestellen.length ? '' : ' data-leeg aria-describedby="zone-uitleg-' + esc(z.id) + '"'}>${esc(t('indeling.eigenRegeling'))}</button></div>`;
        // Zonder klimaatapparaat in de zone kan het nog niet: een tik zegt waarom en wat je doet.
        const uitleg = !toestellen.length && zoneUitleg === `${k.id}/${z.id}` ? `<p class="zone-uitleg" id="zone-uitleg-${esc(z.id)}" role="status">${esc(t('indeling.zone.nogNiet', { naam: z.naam }))}</p>` : '';
        return `<div class="zone-regel"><div class="zone-kop"><b>${esc(z.naam)}</b>${temp}</div><span class="mini">${esc(wat)}</span>${seg}${uitleg}</div>`;
      });
      return `<div class="zones-blok"><span class="label">${esc(t('indeling.zone.kop'))}</span>${rijen.join('')}<p class="mini geen-marge">${esc(t('indeling.zone.uitleg'))}</p></div>`;
    }

    /** Een zone met de kamer mee, of een eigen regeling (besluit 306). */
    async function zoneKlik(knop) {
      if (!knop.dataset.zoneRegeling) return false;
      const next = concept();
      const k = next?.kamers.find((x) => x.id === ctx.kamer);
      const z = k?.zones.find((x) => x.id === knop.dataset.zoneRegeling);
      if (!k || !z) return true;
      const r = ruimteVan(k.id);
      if (knop.dataset.waarde === 'eigen') {
        const toestellen = (r?.apparaten ?? []).filter((a) => a.soort === 'klimaat' && a.zone === z.id).map((a) => a.actuatorId ?? a.id);
        if (!toestellen.length) {
          zoneUitleg = zoneUitleg === `${k.id}/${z.id}` ? null : `${k.id}/${z.id}`;
          ctx.teken();
          return true;
        }
        // Wat de kamer er al mee deed, blijft; anders houdt de zone hem op temperatuur.
        z.rollen = Object.fromEntries(toestellen.map((id) => [id, k.rollen?.[id] && k.rollen[id] !== 'kijken' ? k.rollen[id] : 'houdt']));
        if (k.rollen) for (const id of toestellen) delete k.rollen[id];
      } else {
        if (z.rollen && k.rollen) for (const [id, rol] of Object.entries(z.rollen)) k.rollen[id] = rol;
        delete z.rollen;
        delete z.meten;
        delete z.regelzone;
      }
      await ctx.bewaar(next, t(knop.dataset.waarde === 'eigen' ? 'indeling.zone.isEigen' : 'indeling.zone.isKamer', { naam: z.naam }));
      return true;
    }

    function bronFormulier(k) {
      const v = bronVorm;
      const chip = (attr, waarde, tekst, aan) => `<button type="button" class="chip${aan ? ' aan' : ''}" data-${attr}="${esc(waarde)}" aria-pressed="${aan}">${esc(tekst)}</button>`;
      const vloer = v.soorten.has('vloer');
      const elektrisch = v.soorten.has('paneel') || v.soorten.has('kachel') || (vloer && v.vloer === 'elektrisch');
      // Op de cv (besluit 167): een radiator of vloerverwarming op water gaat aan met de
      // thermostaat van de ketel, een slimme radiatorknop of met de hand.
      const cv = !elektrisch && !v.soorten.has('airco') && (v.soorten.has('radiator') || vloer);
      const ketel = cvThermo();
      const aanOpties = cv
        ? [['thermostaat', ketel ? t('indeling.cvThermoNaam', { naam: ketel.naam }) : t('indeling.cvThermo')], ...(v.soorten.has('radiator') ? [['knop', t('indeling.aan.knop')]] : []), ['hand', t('indeling.aan.hand')]]
        : AAN_KEUZE.filter(([w]) => w !== 'knop');
      const toestellen = klimaatToestellen();
      // Een radiatorknop kies je uit de knoppen; met de thermostaat van de ketel hoeft er niets gekozen.
      const kiesbaar = v.aan === 'knop' ? toestellen.filter((x) => x.a.radiatorknop) : toestellen;
      const welke = v.aan && v.aan !== 'hand' && !(cv && v.aan === 'thermostaat')
        ? `<div class="vraag"><label class="label" for="bron-apparaat">${esc(t(v.aan === 'knop' ? 'indeling.welkeKnop' : 'indeling.welkApparaat'))}</label><select class="invoer" id="bron-apparaat" data-bron-apparaat><option value="">${esc(t('indeling.kies'))}</option>${kiesbaar.map((x) => `<option value="${esc(x.sleutel)}" ${x.sleutel === v.apparaat ? 'selected' : ''}>${esc(t('energie.naamKamer', { naam: x.a.naam, kamer: x.kamer.naam }))}</option>`).join('')}</select></div>`
        : '';
      // Wat de regeling ermee doet, alleen voor een apparaat dat in deze kamer komt; de thermostaat van de ketel blijft waar hij hangt.
      const rol = v.apparaat && v.aan && v.aan !== 'hand' && v.apparaat !== ketel?.sleutel && toestellen.some((x) => x.sleutel === v.apparaat)
        ? `<div class="vraag"><span class="label">${esc(t('indeling.watDoet'))}</span>${rolKeuzes(v.rol ?? rolVoorstel(k, v.apparaat))}</div>`
        : '';
      const vermogen = elektrisch && v.aan && v.aan !== 'hand'
        ? `<div class="vraag"><label class="label" for="bron-w">${esc(t(v.soorten.size > 1 ? 'indeling.samenVermogen' : 'indeling.vermogen'))}</label><div class="invoer-met"><input id="bron-w" inputmode="numeric" data-bron-w value="${v.vermogenW ?? ''}" placeholder="${esc(t('indeling.bv800'))}"><span>${esc(t('indeling.watt'))}</span></div><span class="mini">${esc(t('indeling.genoegZon'))}</span></div>`
        : '';
      return `<div class="bladkop boven-4"><h3 class="kop-3 geen-marge">${esc(t(v.id ? 'w.aanpassen' : 'indeling.ietsToevoegen'))}</h3></div>
        <div class="vraag"><span class="label">${esc(t('indeling.watHangtEr'))}</span><div class="chips">${BRON_KEUZE.map(([w, x]) => chip('bron-soort', w, x, v.soorten.has(w))).join('')}</div></div>
        ${vloer ? `<div class="vraag"><span class="label">${esc(t('indeling.vloerIs'))}</span><div class="chips">${chip('bron-vloer', 'water', t('indeling.opWater'), v.vloer !== 'elektrisch')}${chip('bron-vloer', 'elektrisch', huismodel.metHoofdletter(t('indeling.elektrisch')), v.vloer === 'elektrisch')}</div></div>` : ''}
        ${v.soorten.size ? `<div class="vraag"><span class="label">${esc(t('indeling.hoeAan'))}</span><div class="chips">${aanOpties.map(([w, x]) => chip('bron-aan', w, x, v.aan === w)).join('')}</div></div>` : ''}
        ${welke}
        ${vermogen}
        ${rol}
        ${(k.zones ?? []).length ? `<div class="vraag"><span class="label">${esc(t('indeling.bronWaar'))}</span><div class="chips">${[...k.zones.map((z) => [z.id, z.naam]), ['', t('w.heleKamer')]].map(([w, x]) => chip('bron-zone', w, x, (v.zone ?? '') === w)).join('')}</div></div>` : ''}
        <div class="knoppenrij" style="margin-top: auto">${v.id ? `<button type="button" class="knop gevaar" data-bron-weg>${esc(t('w.weghalen'))}</button>` : ''}<button type="button" class="knop" data-bron-annuleer>${esc(t('indeling.annuleren'))}</button><button type="button" class="knop knop-licht" data-bron-bewaar ${v.soorten.size && v.aan ? '' : 'disabled'}>${esc(t(v.id ? 'w.bewaren' : 'w.toevoegen'))}</button></div>`;
    }

    /** Het formulier naar een bron zoals de dienst hem bewaart. */
    function bronUitVorm(k) {
      const v = bronVorm;
      const soorten = [...v.soorten].map((x) => (x === 'vloer' && v.vloer === 'elektrisch' ? 'vloer-elektrisch' : x));
      const w = Number(String(veldW() ?? v.vermogenW ?? '').replace(/\D/g, ''));
      const b = { id: v.id ?? idVan(soorten.join('-'), new Set((k.bronnen ?? []).map((x) => x.id))), soorten, aan: v.aan };
      // Op de cv met de thermostaat van de ketel (besluit 167): die is het apparaat.
      const cv = !soorten.some((x) => huismodel.ELEKTRISCH.has(x)) && !soorten.includes('airco') && (soorten.includes('radiator') || soorten.includes('vloer'));
      const ketel = cvThermo();
      if (cv && v.aan === 'thermostaat') {
        if (ketel) b.apparaat = ketel.sleutel;
      } else if (v.aan !== 'hand' && v.apparaat) b.apparaat = v.apparaat;
      if (huismodel.isElektrischSlim(b) && w >= 50) b.vermogenW = Math.round(w);
      if (v.opZon && b.vermogenW) b.opZon = true;
      // Waar hij hangt, als de kamer zones heeft (zones als deel van de kamer).
      if (v.zone && (k.zones ?? []).some((z) => z.id === v.zone)) b.zone = v.zone;
      return b;
    }

    async function bronKlik(knop) {
      const next = concept();
      const k = next?.kamers.find((x) => x.id === ctx.kamer);
      if (!k) return false;
      if (knop.dataset.bronNieuw !== undefined) {
        const a = knop.dataset.bronNieuw;
        // Aan de thermostaat van de ketel hangt vloerverwarming op water, niet elektrisch.
        bronVorm = { id: null, soorten: new Set(), vloer: a && a === cvThermo()?.sleutel ? 'water' : 'elektrisch', aan: a ? 'thermostaat' : null, apparaat: a || null, vermogenW: null, rol: null, zone: knop.dataset.bronZoneVan ?? ctx.zone ?? null };
        ctx.teken();
      } else if (knop.dataset.bronOpen) {
        const b = (k.bronnen ?? []).find((x) => x.id === knop.dataset.bronOpen);
        if (!b) return true;
        bronVorm = { id: b.id, soorten: new Set(b.soorten.map((x) => (x === 'vloer-elektrisch' ? 'vloer' : x))), vloer: b.soorten.includes('vloer-elektrisch') ? 'elektrisch' : 'water', aan: b.aan, apparaat: b.apparaat ?? null, vermogenW: b.vermogenW ?? null, opZon: !!b.opZon, zone: b.zone ?? null };
        ctx.teken();
      } else if (knop.dataset.bronSoort) {
        const w = knop.dataset.bronSoort;
        if (bronVorm.soorten.has(w)) bronVorm.soorten.delete(w);
        else bronVorm.soorten.add(w);
        if (bronVorm.aan === 'knop' && !bronVorm.soorten.has('radiator')) bronVorm.aan = null;
        ctx.teken();
      } else if (knop.dataset.bronZone !== undefined) {
        bronVorm.vermogenW = Number(veldW()) || bronVorm.vermogenW;
        bronVorm.zone = knop.dataset.bronZone || null;
        ctx.teken();
      } else if (knop.dataset.bronVloer) {
        bronVorm.vloer = knop.dataset.bronVloer;
        ctx.teken();
      } else if (knop.dataset.bronAan) {
        bronVorm.vermogenW = Number(veldW()) || bronVorm.vermogenW;
        bronVorm.aan = knop.dataset.bronAan;
        ctx.teken();
      } else if (knop.dataset.bronRol) {
        bronVorm.vermogenW = Number(veldW()) || bronVorm.vermogenW;
        bronVorm.rol = knop.dataset.bronRol;
        ctx.teken();
      } else if (knop.hasAttribute('data-bron-annuleer')) {
        bronVorm = null;
        ctx.teken();
      } else if (knop.hasAttribute('data-bron-bewaar')) {
        const b = bronUitVorm(k);
        k.bronnen = [...(k.bronnen ?? []).filter((x) => x.id !== b.id), b];
        // Een klimaatapparaat (besluit 138): het komt in deze kamer, met wat de regeling ermee doet.
        // De thermostaat van de ketel blijft waar hij hangt (besluit 167): hij zet alleen de ketel aan.
        if (b.apparaat && b.apparaat !== cvThermo()?.sleutel && klimaatToestellen().some((x) => x.sleutel === b.apparaat)) {
          const rol = bronVorm.rol ?? rolVoorstel(k, b.apparaat);
          for (const x of next.kamers) if (x.id !== k.id && x.rollen && b.apparaat in x.rollen) delete x.rollen[b.apparaat];
          k.rollen = { ...rollenNu(k), [b.apparaat]: rol };
          next.apparaten[b.apparaat] = { ...(next.apparaten[b.apparaat] ?? {}), kamer: k.id, zone: next.apparaten[b.apparaat]?.kamer === k.id ? (next.apparaten[b.apparaat].zone ?? null) : null };
        }
        const naam = huismodel.bronNaam(b);
        if (await ctx.bewaar(next, t('indeling.bewaard', { naam }))) bronVorm = null;
        ctx.teken();
      } else if (knop.hasAttribute('data-bron-weg')) {
        const id = bronVorm?.id;
        k.bronnen = (k.bronnen ?? []).filter((x) => x.id !== id);
        if (!k.bronnen.length) delete k.bronnen;
        if (await ctx.bewaar(next, t('indeling.weggehaald'))) bronVorm = null;
        ctx.teken();
      } else return false;
      return true;
    }

    /*
     * Meten met (besluit 123): één of meer sensoren, waarvan het gemiddelde de
     * temperatuur van de kamer is. Eerst wat in de kamer staat; een sensor uit een
     * andere kamer kan erbij.
     */
    function temperatuurBronnen() {
      return (ctx.huis?.etages ?? []).flatMap((e) => (e.ruimtes ?? []).flatMap((r) => (r.apparaten ?? []).filter((d) => d.meting?.temperatuurC != null).map((d) => ({ id: d.id, naam: d.naam, kamerId: r.id, kamer: r.naam, c: d.meting.temperatuurC }))));
    }
    function metenKeuze(k) {
      if (k.etage === 'buiten' || huismodel.isBuiten({ id: k.etage }, k)) return '';
      const bronnen = temperatuurBronnen();
      const gekozen = new Set(k.meten ?? []);
      // Wat de app zelf koos, als er niets gekozen is (issue 134): die staat aan, zodat je hem kunt uitzetten.
      const ruimte = ruimteVan(k.id);
      const auto = k.meten == null && !k.regelzone ? bronnen.find((b) => b.kamerId === k.id && b.naam === ruimte?.gemetenDoor) ?? null : null;
      const geen = Array.isArray(k.meten) && k.meten.length === 0;
      const hier = bronnen.filter((b) => b.kamerId === k.id || gekozen.has(b.id));
      const elders = bronnen.filter((b) => b.kamerId !== k.id && !gekozen.has(b.id));
      const graad = (c) => `${nl(Math.round(c * 10) / 10, Number.isInteger(Math.round(c * 10) / 10) ? 0 : 1)}°`;
      const aan = (b) => gekozen.has(b.id) || auto?.id === b.id;
      const chip = (b) => `<button type="button" class="chip${aan(b) ? '' : ' uitchip'}" data-meten="${esc(b.id)}" aria-pressed="${aan(b)}">${esc(b.naam)}${b.kamerId !== k.id ? ` (${esc(b.kamer)})` : ''} · ${graad(b.c)}</button>`;
      const uitleg = geen
        ? t(k.meedoenMet ? 'indeling.meten.geenMeedoen' : 'indeling.meten.geen')
        : t(auto ? 'indeling.meten.auto' : !gekozen.size ? (k.regelzone ? 'indeling.meten.zoals' : 'indeling.meten.app') : k.regelzone ? 'indeling.meten.telt' : 'indeling.meten.gemiddelde');
      const terug = geen || (gekozen.size && !k.regelzone) ? ` <button type="button" class="knop-tekst" data-meten-auto>${esc(t('indeling.meten.laatKiezen'))}</button>` : '';
      return `<div><span class="label">${esc(t('zoek.meten'))}</span>
        <div class="chips" role="group" aria-label="${esc(t('zoek.meten'))}">${hier.length ? hier.map(chip).join('') : `<span class="mini">${esc(t('indeling.geenThermometer'))}</span>`}</div>
        ${elders.length ? `<select class="invoer boven-8" data-actie="meten-erbij" aria-label="${esc(t('indeling.sensorElders'))}"><option value="">${esc(t('indeling.sensorElders'))}…</option>${elders.map((b) => `<option value="${esc(b.id)}">${esc(b.naam)} (${esc(b.kamer)}) · ${graad(b.c)}</option>`).join('')}</select>` : ''}
        <p class="mini geen-marge boven-8">${esc(uitleg)}${terug}</p></div>`;
    }

    /**
     * Waarmee een kamer meet en wie hem regelt, voor de lijst bij Klimaat › Meten en regeling (besluit 345):
     * de namen van de meters, de regeling als zin en als soort, en de zones met hun meter.
     */
    function metenSamen(d, k) {
      const ruimte = ruimteVan(k.id);
      // Waarmee de kamer echt meet (besluit 138): de sensoren van de regeling, of wat bij Meten met gekozen is.
      const namen = ruimte?.meetMet?.length ? ruimte.meetMet : (k.meten ?? []).map((id) => temperatuurBronnen().find((x) => x.id === id)?.naam).filter(Boolean);
      const meet = Array.isArray(k.meten) && !k.meten.length ? t('klimaat.meetNiets') : namen.length ? namen.join(', ') : ruimte?.gemetenDoor ?? t('klimaat.geenMeter');
      const met = k.meedoenMet ? d.kamers.find((x) => x.id === k.meedoenMet) : null;
      const soort = met ? 'mee' : k.regelzone ? 'eigen' : 'geen';
      const regel = met ? t('indeling.doetMee', { naam: met.naam }) : k.regelzone ? t('indeling.eigenRegeling') : t('inr.nietMee');
      const zones = (k.zones ?? []).map((z) => {
        const toestellen = (ruimte?.apparaten ?? []).filter((a) => a.soort === 'klimaat' && a.zone === z.id);
        const eigen = !!z.rollen && Object.values(z.rollen).some((x) => x !== 'kijken');
        const reg = (ruimte?.zones ?? []).find((x) => x.id === z.id)?.regeling ?? null;
        return { id: z.id, naam: z.naam, temp: reg?.temperatuurC ?? null, zin: `${toestellen.length ? t('klimaat.meten.meetMet', { naam: toestellen.map((a) => a.naam).join(', ') }) : t('indeling.zone.geenKnop')} · ${eigen ? t('indeling.eigenRegeling') : t('indeling.zone.metKamer')}` };
      });
      return { meet, gemeten: !!namen.length || !!ruimte?.gemetenDoor, temp: ruimte?.temperatuurC ?? null, regel, soort, zones };
    }

    /** De kamers voor Meten en regeling: alleen binnen, in de volgorde van de indeling. */
    function metenKamers() {
      const d = concept();
      if (!d) return [];
      return d.kamers.filter((k) => !alleBuitenEtage(k)).map((k) => ({ id: k.id, naam: k.naam, etage: k.etage, ...metenSamen(d, k) }));
    }

    /** De keuzes van één kamer bij Meten en regeling: meten met, wie hem regelt, de zones (besluit 123, 142, 306). */
    function meten() {
      const d = concept();
      const k = kamerIn(d);
      if (!d || !k) return '';
      return `${metenKeuze(k)}${regelingKeuze(d, k)}${zonesBlok(k)}<p class="mini geen-marge">${esc(t('indeling.zekeringMee'))}</p>`;
    }

    /** De kamer van de indeling, in een nieuwe indeling om te bewaren. */
    function kamerIn(next) {
      return next?.kamers.find((x) => x.id === ctx.kamer) ?? null;
    }

    /** Het blad: wat ervoor zorgt, of het formulier van een bron. */
    function blad() {
      const d = concept();
      const k = kamerIn(d);
      if (!d || !k) return '';
      return warmteBlad(d, k);
    }

    /** Een tik in het blad; true als het van hier was. */
    async function klik(el) {
      if (await bronKlik(el)) return true;
      if (await zoneKlik(el)) return true;
      if (el.dataset.meten) {
        // Meten met (besluit 123): een sensor aan of uit voor deze kamer.
        const next = concept();
        const k = kamerIn(next);
        if (!k) return true;
        // Wat de app zelf koos, uitzetten (issue 134): dan geen meter, niet weer dezelfde.
        const auto = k.meten == null && !k.regelzone && ruimteVan(k.id)?.gemetenDoor;
        const lijst = new Set(k.meten ?? []);
        if (lijst.has(el.dataset.meten)) lijst.delete(el.dataset.meten);
        else if (!(auto && temperatuurBronnen().find((b) => b.id === el.dataset.meten)?.naam === auto)) lijst.add(el.dataset.meten);
        // Leeg: bij een kamer met regeling meet de regeling zoals ingesteld; anders bewust geen meter.
        if (lijst.size) k.meten = [...lijst].slice(0, 6);
        else if (k.regelzone) delete k.meten;
        else k.meten = [];
        await ctx.bewaar(next, t('indeling.metenBewaard'));
        return true;
      }
      if (el.hasAttribute('data-meten-auto')) {
        // Weer laten kiezen (issue 134): niets gekozen, dan neemt de app een meter in de kamer.
        const next = concept();
        const k = kamerIn(next);
        if (!k) return true;
        delete k.meten;
        await ctx.bewaar(next, t('indeling.metenBewaard'));
        return true;
      }
      return false;
    }

    /** Een keuze in een lijst of een veld; true als het van hier was. */
    async function wissel(el) {
      // Het apparaat en het vermogen van een bron: pas bewaard bij Toevoegen (besluit 132).
      if (el.hasAttribute('data-bron-apparaat') && bronVorm) {
        bronVorm.apparaat = el.value || null;
        return true;
      }
      if (el.hasAttribute('data-bron-w') && bronVorm) {
        bronVorm.vermogenW = Number(el.value.replace(/\D/g, '')) || null;
        return true;
      }
      const next = concept();
      // De taak van een apparaat in een zone (18-11): in de zone van die kamer.
      if (el.dataset.zoneRol) {
        const [kamerId, zoneId, sleutel] = el.dataset.zoneRol.split('|');
        const z = next?.kamers.find((x) => x.id === kamerId)?.zones?.find((x) => x.id === zoneId);
        if (!z) return true;
        z.rollen = { ...(z.rollen ?? {}), [sleutel]: el.value };
        await ctx.bewaar(next, t(['houdt', 'zon'].includes(el.value) ? `indeling.rolGezet.${el.value}` : 'indeling.rolGezet.kijken', { naam: toestelNaam(sleutel) }));
        return true;
      }
      const k = kamerIn(next);
      if (!k) return false;
      const v = el.value.trim();
      if (el.dataset.rol) {
        k.rollen = { ...rollenNu(k), [el.dataset.rol]: el.value };
        const naam = toestelNaam(el.dataset.rol);
        await ctx.bewaar(next, t(['houdt', 'zon'].includes(el.value) ? `indeling.rolGezet.${el.value}` : 'indeling.rolGezet.kijken', { naam }));
        return true;
      }
      if (el.dataset.actie === 'regeling') {
        // Een eigen regeling, of meedoen met die van een andere kamer (besluit 142).
        const [soort, wie] = v.split(':');
        delete k.meedoenMet;
        k.regelzone = soort === 'zone' ? wie : null;
        if (soort === 'kamer') k.meedoenMet = wie;
        // Wie met deze kamer meedeed, en hij heeft geen regeling meer: niet meer meedoen.
        if (soort !== 'zone') for (const x of next.kamers) if (x.meedoenMet === k.id) delete x.meedoenMet;
        const doel = next.kamers.find((x) => x.id === wie);
        await ctx.bewaar(next, soort === 'kamer' && doel ? t('indeling.doetMeeMet', { naam: k.naam, met: doel.naam }) : t('indeling.regelingBewaard'));
        return true;
      }
      if (el.dataset.actie === 'meten-erbij' && v) {
        // Een sensor uit een andere kamer erbij (besluit 123).
        k.meten = [...new Set([...(k.meten ?? []), v])].slice(0, 6);
        await ctx.bewaar(next, t('indeling.metenBewaard'));
        return true;
      }
      return false;
    }

    /** Een andere kamer: het formulier van een bron gaat dicht. */
    function sluit() {
      bronVorm = null;
      zoneUitleg = null;
    }

    return { blad, meten, metenKamers, klik, wissel, sluit, open: () => bronVorm != null, klimaatToestellen, rollenNu, toestelNaam, zoneTaken };
  }

  // Een bronkaart opent met Enter of spatie, net als een knop.
  document.addEventListener('keydown', (e) => {
    const doel = /** @type {HTMLElement} */ (e.target);
    if ((e.key === 'Enter' || e.key === ' ') && doel.matches?.('[data-bron-open]')) {
      e.preventDefault();
      doel.click();
    }
  });

  global.warmte = { maak };
})(window);
