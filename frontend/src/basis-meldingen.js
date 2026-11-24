/*
 * SunArc: meldingen, bijwerken en de stem van het apparaat (opgesplitst uit src/basis.js).
 *
 * De bel met meldingen, wat er nieuw is na een update, het venster om bij te werken en opnieuw te starten, de
 * koffieknop, hulp op de plek, en zeggen met de stem van dit apparaat.
 *
 * global.basisMeldingen(kern) maakt dit deel voor één tekenaar; `kern` geeft wat de tekenaar deelt (zie maak() in huistekenen.js).
 */
(function (global) {
  'use strict';

  global.basisMeldingen = function (kern) {
    /* ------------------------------------------------- meldingen (besluit 136) */

    /*
     * De bel in het menu (schets Wand-Meldingen): een getal als er iets aandacht
     * vraagt, een blad met Vraagt aandacht, Eerder en Onderhoud. Elke twee
     * minuten bij, en als je de app weer opent. Na een update één keer "Wat is
     * er nieuw", als pop-up.
     */
    let meld = { actief: [], eerder: [] };
    let meldZicht = 'lijst';
    const MELDICOON = {
      // Wat niet klopt (besluit 314): een keuze die niet is overgenomen, iets dat mislukte, een bron die wegblijft.
      klopt: ['geel', '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4.5M12 17.4v.1"/>'],
      mislukt: ['rood', '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4h4"/><path d="M12 9v3.5M12 15.4v.1"/>'],
      bron: ['blauw', '<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.6A3.5 3.5 0 0 0 7 18z"/><path d="M4 4l16 16"/>'],
      nieuw: ['blauw', iconen.binnen('nieuw')],
      // Weg uit Home Assistant: een min in een rondje.
      weg: ['geel', iconen.binnen('weg')],
      stil: ['rood', iconen.binnen('stil')],
      batterij: ['geel', iconen.binnen('batterij')],
      filter: ['geel', iconen.binnen('filter')],
      meter: ['rood', iconen.binnen('meter')],
      versie: ['paars', iconen.binnen('versie')],
      mijlpaal: ['blauw', iconen.binnen('mijlpaal')],
      // Wiens comfort geldt (besluit 147): een persoon.
      comfort: ['geel', iconen.binnen('comfort')],
      // De panelen zijn gemeten (besluit 157): een zon.
      // Een nieuwe versie die klaarstaat: een pijl omlaag.
      update: ['blauw', iconen.binnen('update')],
      // De auto (besluit 263): vol, een fout, kabel vergeten, met de hand klaar.
      auto: ['blauw', iconen.binnen('auto')],
      // De thuisaccu (besluit 276): stil, een fout, of vol met zon over.
      accu: ['blauw', iconen.binnen('accu')],
      panelen: ['geel', iconen.binnen('panelen')],
      // Een dakvlak dat achterblijft (besluit 254, stap 5).
      dak: ['geel', iconen.binnen('panelen')],
      // Een rookmelder: rook, koolmonoxide of hitte, of vervangen.
      rook: ['rood', iconen.binnen('rook')],
      goed: ['groen', iconen.binnen('goed')],
      onderhoud: ['grijs', iconen.binnen('onderhoud')],
    };
    const meldIcoon = (soort) => {
      const [kleur, pad] = MELDICOON[soort] ?? MELDICOON.nieuw;
      return `<span class="ik ${kleur}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pad}</svg></span>`;
    };
    const wanneerMeld = (ms) => kern.wanneer(ms, { kort: true });

    /*
     * Elke melding is aan te tikken en weg te halen (aangevuld 15 oktober): een
     * versie opent weer wat er nieuw was, de rest gaat naar het apparaat.
     */
    const weg = (m) => `<button type="button" class="meldweg" data-meld-weg="${kern.esc(m.id)}" aria-label="${kern.esc(kern.global.t('basis.meld.verwijder', { titel: m.titel }))}">×</button>`;
    const doel = (m) => (m.soort === 'versie' ? `data-meld-versie="${kern.esc(m.id.replace(/^versie:/, ''))}"` : m.soort === 'update' ? 'data-meld-update' : m.actie ? `data-meld-href="${kern.esc(m.actie.href)}"` : '');
    function meldLijst() {
      const kaart = (m) => `<div class="melding" ${doel(m)}>${meldIcoon(m.soort)}<b>${kern.esc(m.titel)}</b>${weg(m)}<p>${kern.esc(m.tekst)}</p>
        <div class="acties">${m.actie ? `<a class="licht" href="${kern.esc(m.actie.href)}">${kern.esc(m.actie.label)}</a>` : ''}${m.laat ? `<button type="button" data-meld-weg="${kern.esc(m.id)}">${kern.esc(kern.global.t('basis.meld.laatZo'))}</button>` : ''}<span class="tijd">${kern.esc(wanneerMeld(m.sindsMs))}</span></div></div>`;
      const oud = (m) => `<div class="melding oud" ${doel(m)}>${meldIcoon(m.soort === 'versie' || m.soort === 'mijlpaal' ? m.soort : 'goed')}<b>${kern.esc(m.titel)}</b>${weg(m)}<p>${kern.esc(m.tekst)}</p></div>`;
      const aandacht = meld.actief.length
        ? `<h3>${kern.esc(kern.global.t('basis.meld.aandacht'))}</h3>${meld.actief.map(kaart).join('')}`
        : `<div class="stil"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--mint)" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg><b>${kern.esc(kern.global.t('basis.meld.allesWerkt'))}</b>${kern.esc(kern.global.t('basis.meld.allesWerktZin'))}</div>`;
      const eerder = meld.eerder.length ? `<h3>${kern.esc(kern.global.t('w.eerder'))}</h3>${meld.eerder.slice(0, 5).map(oud).join('')}` : '';
      // Alles wissen (besluit 187): alleen als er iets te wissen is.
      const alles = meld.actief.length || meld.eerder.length ? `<button type="button" class="meldalles" data-meld-alles>${kern.esc(kern.global.t('basis.meld.allesWissen'))}</button>` : '';
      return `<div class="kop"><h2 class="kop-2">${kern.esc(kern.global.t('nav.meldingen'))}</h2>${alles}<button type="button" class="sluit" data-meld-sluit aria-label="${kern.esc(kern.global.t('algemeen.sluiten'))}">×</button></div>
        ${aandacht}${eerder}
        ${onderhoudKnop()}
        <button type="button" class="meld-probleem-regel" data-meld-probleem>${kern.esc(kern.global.t('melden.kop'))}</button>`;
    }

    /*
     * Wat bij Onderhoud bijna op is (besluit 167): uit dezelfde batterijen en
     * filters als de sleutel op Thuis, ook als de melding al weg is getikt. Eerst
     * keek de knop alleen naar de meldingen, en zei hij "Alle batterijen en
     * filters" terwijl Thuis een lege batterij liet zien.
     */
    let onderhoudOp = null;
    async function onderhoudBij() {
      try {
        const huis = await kern.haal('api/huis');
        onderhoudOp = [
          ...(huis?.batterijen ?? []).filter((b) => kern.bijnaOp(b.pct, 'batterij', huis)).map((b) => ({ soort: 'batterij', naam: b.naam, pct: b.pct })),
          ...(huis?.filters ?? []).map((f) => ({ soort: 'filter', naam: f.naam, pct: f.pct })),
        ];
      } catch {
        // Dan wat de meldingen zeggen.
      }
      kern.$$('[data-meldblad] [data-meld-onderhoud]').forEach((k) => (k.outerHTML = onderhoudKnop()));
    }

    /** De knop naar Onderhoud: een geel stipje en wat bijna op is, anders gewoon. */
    function onderhoudKnop() {
      const op = onderhoudOp ?? meld.actief.filter((m) => m.soort === 'batterij' || m.soort === 'filter').map((m) => ({ soort: m.soort, naam: null }));
      const een = op[0];
      const t = kern.global.t;
      const zin = !op.length
        ? t('basis.onderhoud.inOrde')
        : op.length === 1
          ? een.soort === 'batterij'
            ? (een.naam ? (een.pct != null ? t('thuis.onderhoud.batterijLang', { naam: een.naam, pct: een.pct }) : t('basis.onderhoud.batterijNaam', { naam: een.naam })) : t('basis.onderhoud.batterij'))
            : (een.naam ? t('basis.onderhoud.filterNaam', { naam: een.naam }) : t('basis.onderhoud.filter'))
          : t('basis.onderhoud.meer', { n: op.length });
      return `<button type="button" class="onderhoud${op.length ? ' aandacht' : ''}" data-meld-onderhoud>${meldIcoon(op.length ? een.soort : 'onderhoud')}<span><b>${kern.esc(t('basis.onderhoud.kop'))}${op.length ? `<span class="stip links-8" style="background: var(--zon)" aria-label="${kern.esc(t('basis.onderhoud.aandacht'))}"></span>` : ''}</b><span>${kern.esc(zin)}</span></span><span class="pijl" aria-hidden="true">›</span></button>`;
    }

    /** Wanneer er een melding komt, in een zin (besluit 149). */
    function drempelZin(d) {
      const b = d ? d.batterij : 10;
      const f = d ? d.filter : 10;
      const t = kern.global.t;
      if (b == null && f == null) return t('basis.drempel.nooit');
      if (b === f) return t('basis.drempel.onder', { pct: b });
      const deel = (pct, wat) => (pct == null ? t('basis.drempel.deelNooit', { wat: t(wat) }) : t('basis.drempel.deelOnder', { wat: t(wat), pct }));
      return t('basis.drempel.apart', { batterij: deel(b, 'basis.drempel.batterij'), filter: deel(f, 'basis.drempel.filter') });
    }

    async function meldOnderhoud() {
      let huis = null;
      try {
        huis = await kern.haal('api/huis');
      } catch {
        // Dan een lege lijst.
      }
      const balk = (pct, soort) => `<div class="meter"><i style="width: ${Math.max(2, pct)}%; background: ${kern.bijnaOp(pct, soort, huis) ? 'var(--gloed)' : pct < 40 ? 'var(--zon)' : 'var(--mint)'}"></i></div>`;
      const regel = (naam, onder, pct, soort) => `<div class="regel"><div><b>${kern.esc(naam)}</b><span>${kern.esc(onder ?? '')}</span></div>${balk(pct, soort)}<span class="pct">${pct}%</span></div>`;
      // De rookmelders apart: de batterij, de laatste test en wanneer vervangen.
      const melders = (huis?.etages ?? []).flatMap((e) => (e.ruimtes ?? []).flatMap((r) => (r.apparaten ?? []).filter((a) => a.soort === 'rookmelder').map((a) => ({ ...a, kamer: r.naam }))));
      const datum = (d, opties) => (d ? kern.global.taal.datum(new Date(`${d}T12:00:00`), opties) : null);
      const t = kern.global.t;
      const melderRegel = (m) => {
        const r = m.rookmelder ?? {};
        const onder = [m.kamer, r.getestOp ? t('basis.melder.getest', { datum: datum(r.getestOp, { day: 'numeric', month: 'long' }) }) : null, r.vervangenVoor ? t('basis.melder.vervangen', { datum: datum(r.vervangenVoor, { month: 'short', year: 'numeric' }) }) : null, r.batterijProbleem ? t('basis.melder.batterijOp') : null].filter(Boolean).join(' · ');
        return m.batterijPct != null ? regel(m.naam, onder, m.batterijPct, 'batterij') : `<div class="regel"><div><b>${kern.esc(m.naam)}</b><span>${kern.esc(onder)}</span></div></div>`;
      };
      const melderNamen = new Set(melders.map((m) => m.naam));
      const batt = (huis?.batterijen ?? []).filter((b) => !melderNamen.has(b.naam));
      const filters = (huis?.etages ?? []).flatMap((e) => (e.ruimtes ?? []).flatMap((r) => (r.apparaten ?? []).filter((a) => a.klimaat?.filter?.pct != null).map((a) => ({ naam: a.naam, kamer: r.naam, pct: a.klimaat.filter.pct }))));
      return `<div class="kop"><div><button type="button" class="terugmeld" data-meld-terug>‹ ${kern.esc(t('nav.meldingen'))}</button><h2 class="kop-2 geen-marge boven-4">${kern.esc(t('basis.onderhoud.kop'))}</h2></div><button type="button" class="sluit" data-meld-sluit aria-label="${kern.esc(t('algemeen.sluiten'))}">×</button></div>
        ${melders.length ? `<h3>${kern.esc(t('basis.melder.kop'))}</h3>${melders.map(melderRegel).join('')}` : ''}
        <h3>${kern.esc(t('basis.onderhoud.batterijen'))}</h3>
        ${batt.length ? batt.map((b) => regel(b.naam, b.kamer, b.pct, 'batterij')).join('') : `<p class="mini geen-marge">${kern.esc(t('thuis.batterijen.geen'))}</p>`}
        ${filters.length ? `<h3>${kern.esc(t('basis.onderhoud.filters'))}</h3>${filters.map((f) => regel(f.naam, f.kamer, f.pct, 'filter')).join('')}` : ''}
        <p class="mini" style="margin: auto 0 0">${kern.esc(drempelZin(huis?.drempels))} <a href="functies.html#meldingen">${kern.esc(t('basis.onderhoud.wanneer'))}</a> ${kern.esc(t('thuis.batterijen.nietBij'))}</p>`;
    }

    /*
     * Gelezen: wat je in het blad zag, telt niet meer mee in het
     * getal bij de bel. De melding blijft staan tot hij is opgelost of weg is.
     * Onthouden in deze browser.
     */
    const GELEZEN = 'sc-meldingen-gelezen';
    const gelezen = () => {
      try {
        return new Set(JSON.parse(localStorage.getItem(GELEZEN) ?? '[]'));
      } catch {
        return new Set();
      }
    };
    function markeerGelezen() {
      try {
        localStorage.setItem(GELEZEN, JSON.stringify(meld.actief.map((m) => m.id)));
      } catch {
        // Dan telt hij de volgende keer nog mee.
      }
      meldGetal();
    }
    function meldGetal() {
      const al = gelezen();
      const n = meld.actief.filter((m) => !al.has(m.id)).length;
      kern.$$('[data-meldaantal]').forEach((b) => {
        b.hidden = n === 0;
        b.textContent = n > 9 ? '9+' : String(n);
      });
      kern.$$('[data-meldbel]').forEach((b) => b.setAttribute('aria-label', n ? kern.global.t('basis.meld.bel', { n }) : kern.global.t('nav.meldingen')));
    }

    async function meldLaad() {
      try {
        meld = await kern.haal('api/meldingen');
      } catch {
        return;
      }
      meldGetal();
      const blad = document.querySelector('[data-meldblad]');
      if (blad && !blad.hidden && meldZicht === 'lijst') blad.innerHTML = meldLijst();
      // Het display aan de wand toont een nieuwe versie ook (niemand.js).
      dispatchEvent(new Event('sc-meldingen'));
    }
    /** De melding van een nieuwe versie die klaarstaat, of null. */
    const updateKlaar = () => meld.actief.find((m) => m.soort === 'update') ?? null;

    function meldBlad() {
      let blad = document.querySelector('[data-meldblad]');
      if (!blad) {
        document.body.insertAdjacentHTML('beforeend', `<div class="meldachter" data-meld-achter hidden></div><aside class="glas meldblad" role="dialog" aria-label="${kern.esc(kern.global.t('nav.meldingen'))}" data-meldblad hidden></aside>`);
        blad = document.querySelector('[data-meldblad]');
      }
      return blad;
    }
    async function meldOpen(zicht = 'lijst') {
      const blad = meldBlad();
      meldZicht = zicht;
      blad.innerHTML = zicht === 'lijst' ? meldLijst() : await meldOnderhoud();
      if (zicht === 'lijst') void onderhoudBij();

      blad.hidden = false;
      if (zicht === 'lijst') markeerGelezen();
      document.querySelector('[data-meld-achter]').hidden = false;
      kern.$$('[data-meldbel]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
      blad.querySelector('[data-meld-sluit]')?.focus();
    }
    function meldDicht() {
      kern.$$('[data-meldblad], [data-meld-achter]').forEach((el) => (el.hidden = true));
      kern.$$('[data-meldbel]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    }

    /** Na een update één keer: wat is er nieuw (besluit 136). De eerste keer ooit niet: dan is alles nieuw. */
    const VERSIE_GEZIEN = 'sc-versie-gezien';
  /*
     * Een nieuwe versie: wat er nieuw is, uit de releasenotes
     * van Home Assistant, en een knop Bijwerken voor de beheerder. De dienst
     * vraagt Home Assistant de add-on bij te werken; de app start daarna opnieuw,
     * en deze pagina laadt vanzelf als de nieuwe versie draait.
     */
    const UPDATE_SOORT = ['nieuw', 'beter', 'opgelost'];
    const soortNaam = (k) => kern.global.t(`basis.versie.${k}`);
    async function bijwerkVenster() {
      let u;
      try {
        u = await kern.haal('api/update');
      } catch {
        return;
      }
      kern.$$('[data-nieuwpop], [data-nieuw-achter]').forEach((el) => el.remove());
      if (!u?.beschikbaar) {
        document.body.insertAdjacentHTML('beforeend', `<div class="meldachter" data-nieuw-achter></div><div class="glas nieuwpop" role="dialog" aria-modal="true" aria-labelledby="nieuwkop" data-nieuwpop><h2 class="kop-2 geen-marge" id="nieuwkop">${kern.esc(kern.global.t('basis.versie.nieuwste'))}</h2><p class="klein geen-marge">${kern.esc(kern.global.t('basis.versie.isBij', { versie: u?.nu ?? '' }))}</p><div class="knoppen"><button type="button" class="knop knop-licht" data-nieuw-dicht>${kern.esc(kern.global.t('algemeen.oke'))}</button></div></div>`);
        document.querySelector('[data-nieuw-dicht]').focus();
        return;
      }
      const meer = u.notities.length > 1;
      const notities = u.notities.length
        ? u.notities.map((n) => `${meer ? `<h3 class="kop-3 geen-marge boven-8">${kern.esc(n.versie)}</h3>` : ''}${UPDATE_SOORT.filter((k) => n[k].length).map((k) => `<div class="soort ${k}"><span class="label">${kern.esc(soortNaam(k))}</span><ul>${n[k].map((p) => `<li>${kern.esc(p)}</li>`).join('')}</ul></div>`).join('')}`).join('')
        : `<p class="klein geen-marge">${kern.esc(kern.global.t('basis.versie.inHA'))}</p>`;
      const knop = u.bezig
        ? `<button type="button" class="knop knop-licht" disabled>${kern.esc(kern.global.t('basis.versie.bezig'))}</button>`
        : u.magBijwerken
          ? `<button type="button" class="knop knop-licht" data-bijwerken>${kern.esc(kern.global.t('basis.versie.bijwerken'))}</button>`
          : '';
      document.body.insertAdjacentHTML('beforeend', `<div class="meldachter" data-nieuw-achter></div><div class="glas nieuwpop" role="dialog" aria-modal="true" aria-labelledby="nieuwkop" data-nieuwpop>
        <span class="mini">${kern.esc(kern.global.t('basis.versie.jeHebt', { versie: u.nu }))}</span><h2 class="kop-2 geen-marge boven-4" id="nieuwkop">${kern.esc(kern.global.t('basis.versie.klaar', { versie: u.nieuwste }))}</h2>${notities}
        <p class="mini geen-marge" data-bijwerk-zin>${kern.esc(kern.global.t(u.bezig ? 'basis.versie.wordtBijgewerkt' : u.magBijwerken ? 'basis.versie.duurt' : 'basis.versie.beheerder'))}</p>
        <div class="knoppen"><button type="button" class="knop" data-nieuw-dicht>${kern.esc(kern.global.t('basis.versie.later'))}</button>${knop}</div></div>`);
      (document.querySelector('[data-bijwerken]') ?? document.querySelector('[data-nieuw-dicht]')).focus();
      if (u.bezig) void wachtOpNieuweVersie(u.nu);
    }
    async function bijwerken(knop) {
      knop.disabled = true;
      knop.textContent = kern.global.t('basis.versie.bezig');
      const zin = document.querySelector('[data-bijwerk-zin]');
      const res = await kern.deur('api/update', {}).catch(() => null);
      if (!res?.ok) {
        const f = res ? await res.json().catch(() => ({})) : {};
        knop.disabled = false;
        knop.textContent = kern.global.t('basis.versie.bijwerken');
        if (zin) zin.textContent = kern.global.t('basis.versie.mislukt', { fout: String(f.fout ?? kern.global.t('basis.versie.geenVerbinding')).replace(/\.$/, '') });
        return;
      }
      const u = await res.json().catch(() => null);
      if (zin) zin.textContent = kern.global.t('basis.versie.wordtBijgewerktLaadt');
      void wachtOpNieuweVersie(u?.nu ?? null);
    }
    /** Tot de nieuwe versie draait: elke vijf tellen kijken, ook als de dienst even weg is. */
    async function wachtOpNieuweVersie(was) {
      for (let i = 0; i < 180; i++) {
        await new Promise((ok) => setTimeout(ok, 5000));
        try {
          const h = await (await fetch('api/health', { cache: 'no-store' })).json();
          if (h?.versie?.nummer && h.versie.nummer !== was) {
            await kern.houToegang();
            location.reload();
            return;
          }
        } catch {
          // De dienst start opnieuw.
        }
      }
    }

    /*
     * Zoeken naar updates (testerronde, november 2026): de dienst laat Home
     * Assistant de add-on-winkel opnieuw lezen. Daarna hetzelfde venster als bij
     * de melding: een nieuwe versie met Bijwerken, of "Je hebt de nieuwste".
     */
    async function zoekUpdates(knop) {
      const tekst = knop.textContent;
      knop.disabled = true;
      knop.textContent = kern.global.t('basis.versie.zoekt');
      const res = await kern.deur('api/update/zoek', {}).catch(() => null);
      knop.disabled = false;
      knop.textContent = tekst;
      if (!res?.ok) {
        const f = res ? await res.json().catch(() => ({})) : {};
        zegBijKnop(knop, kern.global.t('basis.versie.mislukt', { fout: String(f.fout ?? kern.global.t('basis.versie.geenVerbinding')).replace(/\.$/, '') }));
        return;
      }
      // Home Assistant zet de nieuwe versie een tel later op de update-entiteit.
      await new Promise((ok) => setTimeout(ok, 1500));
      await bijwerkVenster();
    }

    /*
     * SunArc opnieuw starten (testerronde, november 2026), voor een keuze die pas
     * bij de start ingaat. Een venster met even geduld, en de pagina laadt vanzelf
     * als de dienst weer antwoordt.
     */
    async function herstart(knop) {
      knop.disabled = true;
      const res = await kern.deur('api/herstart', {}).catch(() => null);
      if (!res?.ok) {
        knop.disabled = false;
        const f = res ? await res.json().catch(() => ({})) : {};
        zegBijKnop(knop, kern.global.t('basis.versie.mislukt', { fout: String(f.fout ?? kern.global.t('basis.versie.geenVerbinding')).replace(/\.$/, '') }));
        return;
      }
      kern.$$('[data-nieuwpop], [data-nieuw-achter]').forEach((el) => el.remove());
      document.body.insertAdjacentHTML('beforeend', `<div class="meldachter" data-nieuw-achter></div><div class="glas nieuwpop" role="dialog" aria-modal="true" aria-labelledby="herstartkop" data-nieuwpop data-herstart-pop><h2 class="kop-2 geen-marge" id="herstartkop">${kern.esc(kern.global.t('basis.herstart.kop'))}</h2><p class="klein geen-marge" data-herstart-zin>${kern.esc(kern.global.t('basis.herstart.zin'))}</p></div>`);
      // Eerst weg, dan weer terug: pas dan draait de nieuwe start.
      let weg = false;
      for (let i = 0; i < 90; i++) {
        await new Promise((ok) => setTimeout(ok, 2000));
        try {
          const r = await fetch('api/health', { cache: 'no-store' });
          if (!r.ok) weg = true;
          else if (weg || i >= 5) {
            await kern.houToegang();
            location.reload();
            return;
          }
        } catch {
          weg = true;
        }
        if (i === 45) kern.$$('[data-herstart-zin]').forEach((el) => (el.textContent = kern.global.t('basis.herstart.lang')));
      }
    }
    /** Steunen: een kop koffie via PayPal, bij Over deze app en Versie. Nooit als melding. */
    function koffieKnop() {
      return `<a class="knop knop-koffie" href="https://paypal.me/sunarc" target="_blank" rel="noopener">${kern.global.iconen ? kern.global.iconen.svg('koffie') : ''}${kern.esc(kern.global.t('over.koffie'))}</a>`;
    }
    /** Een korte zin onder een knop, voor wat niet lukte. */
    function zegBijKnop(knop, tekst) {
      let zin = knop.parentElement?.querySelector('[data-knop-zin]');
      if (!zin) {
        knop.insertAdjacentHTML('afterend', '<p class="mini geen-marge boven-4" data-knop-zin></p>');
        zin = knop.parentElement.querySelector('[data-knop-zin]');
      }
      zin.textContent = tekst;
    }

    /*
     * Wat er met je eigen meldingen gebeurde (testerronde, november 2026): de
     * meldcodes op dit toestel die bij een versie staan, elk één keer. Er gaat
     * niets het huis uit; de lijst komt met de update mee.
     */
    /** Je eigen meldingen op dit toestel (`sc-meldingen`, uit melden.js). */
    function eigenMeldingen() {
      try {
        const l = JSON.parse(localStorage.getItem('sc-meldingen') ?? '[]');
        return Array.isArray(l) ? l : [];
      } catch {
        return [];
      }
    }
    function zetEigen(code, wijzig) {
      try {
        localStorage.setItem('sc-meldingen', JSON.stringify(eigenMeldingen().map((m) => (m.code === code ? { ...m, ...wijzig } : m))));
      } catch {
        // Zonder opslag zegt de app het de volgende keer nog eens.
      }
    }
    /**
     * Werkt nu of Werkt nog niet, na opgelost of een
     * instelling. Werkt nu blijft in de app; Werkt nog niet opent het issue.
     */
    function meldTerugzeg(m) {
      if (!['opgelost', 'instelling'].includes(m.uitkomst) || m.bevestigd === 'werkt') return '';
      return `<span class="meld-terugzeg"><button type="button" class="knop knop-klein" data-meldwerkt="${kern.esc(m.code)}">${kern.esc(kern.global.t('melden.werkt'))}</button><button type="button" class="knop knop-klein" data-meldnietgoed="${kern.esc(m.code)}">${kern.esc(kern.global.t('melden.werktNiet'))}</button></span>`;
    }
    /** Je meldingen bij Over › Versie: de stand van elk, met dezelfde knoppen. */
    function jouwMeldingen() {
      const mijn = eigenMeldingen().slice(-10).reverse();
      if (!mijn.length) return '';
      const stand = (m) => kern.global.t(`melden.stand.${m.bevestigd ?? m.uitkomst ?? 'open'}`, { versie: m.versie ?? '' });
      const regel = (m) => `<li><span><b>${kern.esc(m.code)}</b> ${kern.esc(m.titel ?? '')}</span><span class="mini" data-meldstand>${kern.esc(stand(m))}</span>${meldTerugzeg(m)}</li>`;
      return `<h3 class="kop-3 geen-marge boven-8">${kern.esc(kern.global.t('melden.jouw'))}</h3><ul class="jouw-meldingen">${mijn.map(regel).join('')}</ul>`;
    }

    function eigenUitkomsten(nieuw) {
      const mijn = eigenMeldingen();
      if (!mijn.length) return '';
      const open = new Map(mijn.filter((m) => !m.uitkomst).map((m) => [m.code, m]));
      const uit = [];
      for (const n of nieuw ?? []) {
        for (const u of n.meldingen ?? []) {
          if (!open.has(u.code)) continue;
          uit.push({ ...u, versie: n.versie });
          open.delete(u.code);
        }
      }
      if (!uit.length) return '';
      try {
        localStorage.setItem('sc-meldingen', JSON.stringify(mijn.map((m) => {
          const u = uit.find((x) => x.code === m.code);
          return u ? { ...m, uitkomst: u.uitkomst, versie: u.versie, ...(u.issue ? { issue: u.issue } : {}) } : m;
        })));
      } catch {
        // Dan zegt hij het de volgende keer nog eens.
      }
      const regel = (u) => `<li>${kern.esc(kern.global.t(`melden.uitkomst.${u.uitkomst}`, { code: u.code, versie: u.versie }))}${u.tekst ? ` ${kern.esc(u.tekst)}` : ''}${u.href ? ` <a href="${kern.esc(u.href)}">${kern.esc(kern.global.t('melden.naarPlek'))}</a>` : ''}${meldTerugzeg(u)}</li>`;
      return `<div class="soort nieuw"><span class="label">${kern.esc(kern.global.t('melden.jouw'))}</span><ul>${uit.map(regel).join('')}</ul></div>`;
    }

    async function watIsErNieuw(welke = null) {
      let v;
      try {
        v = await kern.haal('api/versie');
      } catch {
        return;
      }
      let n;
      if (welke) {
        // Opnieuw geopend vanuit Meldingen.
        n = (v.nieuw ?? []).find((x) => x.versie === welke);
        if (!n) {
          location.href = 'toegang.html#versie';
          return;
        }
      } else {
        // Niet in het voorbeeldhuis: wat er nieuw is, hoort bij je eigen huis, en daar zie je het straks.
        if (/\/voorbeeld\//.test(kern.global.location.pathname)) return;
        let gezien;
        try {
          gezien = localStorage.getItem(VERSIE_GEZIEN);
          localStorage.setItem(VERSIE_GEZIEN, v.nummer);
        } catch {
          return;
        }
        n = v.nieuw?.[0];
        if (gezien == null || gezien === v.nummer || !n || n.versie !== v.nummer) return;
        // Eén overzicht van alles sinds de versie die je eerder zag, niet alleen de nieuwste.
        const sinds = [];
        for (const x of v.nieuw) {
          if (x.versie === gezien) break;
          sinds.push(x);
        }
        if (sinds.length > 1) n = { ...n, ...Object.fromEntries(UPDATE_SOORT.map((k) => [k, [...new Set(sinds.flatMap((x) => x[k] ?? []))]])) };
      }
      const delen = (welke ? '' : eigenUitkomsten(v.nieuw)) + UPDATE_SOORT.filter((k) => (n[k] ?? []).length).map((k) => `<div class="soort ${k}"><span class="label">${kern.esc(soortNaam(k))}</span><ul>${n[k].map((p) => `<li>${kern.esc(p)}</li>`).join('')}</ul></div>`).join('');
      document.body.insertAdjacentHTML('beforeend', `<div class="meldachter" data-nieuw-achter></div><div class="glas nieuwpop" role="dialog" aria-modal="true" aria-labelledby="nieuwkop" data-nieuwpop>
        <span class="mini">${kern.esc(welke ? kern.global.taal.datum(new Date(`${n.datum}T12:00:00Z`), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : kern.global.t('basis.versie.bijgewerkt'))}</span><h2 class="kop-2 geen-marge boven-4" id="nieuwkop">${kern.esc(kern.global.t('basis.versie.watNieuw', { versie: n.versie }))}</h2>${delen}
        <div class="knoppen"><a class="knop" href="toegang.html#versie">${kern.esc(kern.global.t('basis.versie.alle'))}</a><button type="button" class="knop knop-licht" data-nieuw-dicht>${kern.esc(kern.global.t('algemeen.oke'))}</button></div></div>`);
      document.querySelector('[data-nieuw-dicht]').focus();
    }

    /*
     * Meld een probleem (testerronde, november 2026): elke knop met
     * `data-meld-probleem`, ook in een link of kaart. melden.js laadt pas bij de
     * eerste tik, zonder stempel: met de stempel van dit
     * bestand bleef een oude melden.js een jaar bewaard als alleen die veranderde.
     * Zonder stempel vraagt de browser altijd na; ongewijzigd is dat een leeg 304.
     */
    let meldenLaden = null;
    document.addEventListener('click', (e) => {
      // Werkt nu: alleen hier afgevinkt, er gaat niets naar GitHub.
      const werkt = e.target.closest('[data-meldwerkt]');
      if (werkt) {
        zetEigen(werkt.dataset.meldwerkt, { bevestigd: 'werkt', bevestigdMs: Date.now() });
        const standregel = werkt.closest('li')?.querySelector('[data-meldstand]');
        if (standregel) standregel.textContent = kern.global.t('melden.stand.werkt');
        werkt.closest('.meld-terugzeg')?.replaceWith(Object.assign(document.createElement('span'), { className: 'mini meld-terugzeg', textContent: kern.global.t('melden.werktDank') }));
        return;
      }
      const k = e.target.closest('[data-meld-probleem], [data-meldnietgoed]');
      if (!k) return;
      e.preventDefault();
      e.stopPropagation();
      if (document.querySelector('[data-meldblad]:not([hidden])')) meldDicht();
      // Werkt nog niet vanuit Wat is er nieuw: dat blad eerst dicht.
      if (k.dataset.meldnietgoed) document.querySelectorAll('[data-nieuwpop], [data-nieuw-achter]').forEach((el) => el.remove());
      meldenLaden ??= new Promise((ok, fout) => {
        const s = document.createElement('script');
        s.src = 'melden.js';
        s.onload = ok;
        s.onerror = fout;
        document.head.append(s);
      });
      meldenLaden.then(() => (k.dataset.meldnietgoed ? kern.global.melden.vervolg(k.dataset.meldnietgoed) : kern.global.melden.open({ apparaat: k.dataset.apparaat ?? null, naam: k.dataset.naam ?? null, wat: k.dataset.meldWat ?? '', soort: k.dataset.meldSoort ?? null, hulp: k.dataset.hulpId ?? null })), () => (meldenLaden = null));
    }, true);

    /*
     * Hulp op de plek (besluit 325): op Klimaat, Je huis, Apparaten en Energie
     * staat hulp.js in de pagina; elders laadt het pas bij de eerste tik op een
     * vraagteken of de handleiding, zonder stempel zoals melden.js. Melden en de
     * assistent halen het ook zo, voor de woordzoeker.
     */
    let hulpLaden = null;
    function laadHulp() {
      if (kern.global.hulp) return Promise.resolve(kern.global.hulp);
      hulpLaden ??= new Promise((ok, fout) => {
        const s = document.createElement('script');
        s.src = 'hulp.js';
        s.onload = () => ok(kern.global.hulp);
        s.onerror = () => {
          hulpLaden = null;
          fout(new Error('hulp.js'));
        };
        document.head.append(s);
      });
      return hulpLaden;
    }
    document.addEventListener('click', (e) => {
      if (kern.global.hulp) return;
      const k = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-hulp], [data-hulplijst]'));
      if (!k) return;
      e.preventDefault();
      e.stopPropagation();
      void laadHulp().then((h) => (k.dataset.hulp ? h.open(k.dataset.hulp, k) : h.lijst(k.dataset.hulplijst || null, k.dataset.hulpplek || null)), () => {});
    }, true);

    function meldingenStart() {
      kern.$$('[data-meldicoon]').forEach((b) => b.insertAdjacentHTML('afterbegin', nav.svg('meldingen')));
      void meldLaad();
      setInterval(() => void meldLaad(), 2 * 60_000);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void meldLaad());
      setTimeout(() => void watIsErNieuw(), 1200);
      document.addEventListener('click', async (e) => {
        const t = e.target.closest('[data-meldbel], [data-meld-sluit], [data-meld-achter], [data-meld-onderhoud], [data-meld-terug], [data-meld-weg], [data-meld-alles], [data-nieuw-dicht], [data-nieuw-achter], a, [data-meld-versie], [data-meld-update], [data-meld-href], [data-bijwerken], [data-zoek-update], [data-herstart]');
        if (!t || (t.matches('a') && !t.closest('[data-meldblad]'))) return;
        if (t.matches('a')) return meldDicht();
        if (t.matches('[data-nieuw-dicht], [data-nieuw-achter]')) {
          kern.$$('[data-nieuwpop], [data-nieuw-achter]').forEach((el) => el.remove());
        } else if (t.matches('[data-meldbel]')) {
          if (document.querySelector('[data-meldblad]:not([hidden])')) meldDicht();
          else await meldOpen('lijst');
        } else if (t.matches('[data-meld-sluit], [data-meld-achter]')) meldDicht();
        else if (t.matches('[data-meld-onderhoud]')) await meldOpen('onderhoud');
        else if (t.matches('[data-meld-terug]')) await meldOpen('lijst');
        else if (t.matches('[data-meld-alles]')) {
          kern.$$('[data-meldblad] .melding').forEach((m) => m.classList.add('gaat'));
          const res = await kern.deur('api/meldingen', { alles: true }).catch(() => null);
          if (res?.ok) meld = await res.json();
          meldGetal();
          await meldOpen('lijst');
        } else if (t.dataset.meldWeg) {
          t.closest('.melding')?.classList.add('gaat');
          const res = await kern.deur('api/meldingen', { verwijder: t.dataset.meldWeg }).catch(() => null);
          if (res?.ok) meld = await res.json();
          meldGetal();
          await meldOpen('lijst');
        } else if (t.matches('[data-meld-update]')) {
          meldDicht();
          await bijwerkVenster();
        } else if (t.matches('[data-zoek-update]')) {
          void zoekUpdates(t);
        } else if (t.matches('[data-herstart]')) {
          void herstart(t);
        } else if (t.matches('[data-bijwerken]')) {
          await bijwerken(t);
        } else if (t.dataset.meldVersie) {
          meldDicht();
          await watIsErNieuw(t.dataset.meldVersie);
        } else if (t.dataset.meldHref) {
          location.href = t.dataset.meldHref;
        }
      });
      addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (document.querySelector('[data-nieuwpop]')) kern.$$('[data-nieuwpop], [data-nieuw-achter]').forEach((el) => el.remove());
        else meldDicht();
      });
    }

    /*
     * Een nieuwe versie op de server (besluit 133): de app op een telefoon of
     * tablet blijft vaak open staan met de pagina van toen. Is er intussen een
     * andere versie, dan laadt de pagina opnieuw: als je de app weer opent, of
     * hooguit elke tien minuten, en nooit terwijl je typt.
     */
    let draaitNu = null;
    async function versieNu() {
      try {
        const r = await fetch('api/health', { cache: 'no-store' });
        const h = await r.json();
        return h?.versie?.commit && h.versie.commit !== 'onbekend' ? h.versie.commit : null;
      } catch {
        return null;
      }
    }
    /*
     * Kwam deze pagina uit de opslag van de browser, zoals een
     * geïnstalleerde app die Android terugzet, dan wist hij niet dat hij oud was:
     * de eerste versie die hij zag, was al de nieuwe. Nu vergelijkt hij de
     * stempel van basis.js met die in de pagina op de server; één keer per
     * stempel, zodat hij nooit blijft herladen.
     */
    async function paginaOud() {
      const eigen = document.querySelector('script[src*="basis.js"]')?.getAttribute('src')?.match(/[?&]v=([0-9a-f]+)/)?.[1];
      if (!eigen) return false;
      try {
        const html = await (await fetch(location.pathname + location.search, { cache: 'no-store' })).text();
        const daar = html.match(/basis\.js\?v=([0-9a-f]+)/)?.[1];
        if (!daar || daar === eigen || sessionStorage.getItem('sc-herladen') === daar) return false;
        sessionStorage.setItem('sc-herladen', daar);
        return true;
      } catch {
        return false;
      }
    }
    let pageNagekeken = false;
    async function kijkVersie() {
      // Eerst of deze pagina zelf al oud is; dat hangt niet af van de commit, die soms onbekend is.
      if (!pageNagekeken && !kern.typt()) {
        pageNagekeken = true;
        if (await paginaOud()) {
          await kern.houToegang();
          location.reload();
          return;
        }
      }
      const v = await versieNu();
      if (!v) return;
      if (draaitNu == null) draaitNu = v;
      else if (v !== draaitNu && !kern.typt() && !document.querySelector('dialog[open]')) {
        await kern.houToegang();
        location.reload();
      }
    }
    function nieuweVersie() {
      void kijkVersie();
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void kijkVersie());
      setInterval(() => void kijkVersie(), 10 * 60_000);
    }

    // Op elke pagina, ook die zonder menu (inrichten, het welkom).
    kern.volledig();

    /*
     * Een scherm zoals de wand neemt over wat er bij De wand voor hem gekozen is
     * (besluit 166): het hele scherm en luisteren naar "Hé huis", ook als dat
     * vanaf de pc of de telefoon werd gezet. Niets gekozen: zoals dit apparaat
     * het zelf heeft. Uitzetten geldt vanaf de volgende pagina.
     */
    async function schermOpties() {
      if (kern.telStand()) return;
      let b;
      try {
        const res = await fetch('api/bewoners', { cache: 'no-store' });
        if (!res.ok) return;
        b = await res.json();
      } catch {
        return;
      }
      const o = (b?.schermen ?? []).find((s) => s.ik)?.opties;
      if (!o) return;
      if (o.volledig != null && o.volledig !== kern.volledigGekozen()) {
        kern.zetVolledig(o.volledig);
        if (o.volledig) kern.volledig();
      }
      if (o.luisteren == null) return;
      try {
        if ((localStorage.getItem('sc-luisteren') === 'aan') === o.luisteren) return;
        localStorage.setItem('sc-luisteren', o.luisteren ? 'aan' : 'uit');
      } catch {
        return;
      }
      // Aan: luisteren.js erbij, die meteen begint; staat hij er al, dan zelf starten.
      if (o.luisteren) {
        if (kern.global.luisteren) kern.global.luisteren.start();
        else kern.luisterStart();
      }
    }
    setTimeout(() => void schermOpties(), 1500);

    /*
     * Gewone kamerwoorden en hun lidwoord (besluit 131): "de zolder", "het
     * kantoor", en een eigen naam zoals "Beneden" zoals hij is. Dezelfde lijst als
     * `backend/src/web/kamerwoorden.ts`; een test houdt ze gelijk.
     */
    const KAMERWOORDEN = {
      zolder: 'de', vliering: 'de', woonkamer: 'de', huiskamer: 'de', woonkeuken: 'de', keuken: 'de', bijkeuken: 'de',
      eetkamer: 'de', zithoek: 'de', serre: 'de', slaapkamer: 'de', kinderkamer: 'de', logeerkamer: 'de', speelkamer: 'de',
      studeerkamer: 'de', werkkamer: 'de', hobbykamer: 'de', kamer: 'de', badkamer: 'de', wasruimte: 'de', hal: 'de',
      gang: 'de', entree: 'de', overloop: 'de', trap: 'de', berging: 'de', garage: 'de', kelder: 'de', meterkast: 'de',
      schuur: 'de', zone: 'de', tuin: 'de', achtertuin: 'de', voortuin: 'de', oprit: 'de', carport: 'de',
      kantoor: 'het', toilet: 'het', washok: 'het', portaal: 'het', atelier: 'het', tuinhuis: 'het', terras: 'het', balkon: 'het',
    };
    const EERSTE_WOORD = new RegExp(`^(${Object.keys(KAMERWOORDEN).join('|')})\\b`, 'i');
    /** "Zolder" wordt "de zolder", "Kantoor" "het kantoor", "Beneden" blijft "Beneden". */
    function metLidwoord(naam) {
      // Het lidwoord is Nederlands; in een andere taal blijft de naam zoals hij is (besluit 185).
      if (kern.global.taal.code !== 'nl') return naam;
      const m = EERSTE_WOORD.exec(String(naam ?? '').trim());
      const lw = m ? KAMERWOORDEN[m[1].toLowerCase()] : null;
      return lw ? `${lw} ${naam.charAt(0).toLowerCase()}${naam.slice(1)}` : naam;
    }

    /**
     * De stem van dit apparaat zelf (besluit 212). De browser
     * als die kan spreken; anders Fully Kiosk, want de webweergave aan de wand
     * heeft geen eigen spraak. Chrome slaat een zin over die vlak na "stop"
     * begint, dus even wachten. Geeft false als dit scherm geen stem heeft.
     */
    let uiting = null;
    function kanApparaatSpreken() {
      return (!!kern.global.speechSynthesis && typeof kern.global.SpeechSynthesisUtterance !== 'undefined') || typeof kern.global.fully?.textToSpeech === 'function';
    }
    function zegMetApparaat(tekst, taalCode = kern.global.taal?.code) {
      const lang = taalCode === 'en' ? 'en-GB' : 'nl-NL';
      const duur = Math.max(1500, String(tekst).length * 70);
      if (kern.global.speechSynthesis && typeof kern.global.SpeechSynthesisUtterance !== 'undefined') {
        return new Promise((ok) => {
          let klaar = false;
          const einde = (gelukt) => {
            if (klaar) return;
            klaar = true;
            clearTimeout(vangnet);
            ok(gelukt);
          };
          // Zonder einde (een stem die niet start): na de tijd die de zin zou duren.
          const vangnet = setTimeout(() => einde(true), duur + 4000);
          kern.global.speechSynthesis.cancel();
          setTimeout(() => {
            // Vastgehouden, anders ruimt Chrome hem op en komt er geen einde.
            uiting = new kern.global.SpeechSynthesisUtterance(tekst);
            uiting.lang = lang;
            const stem = kern.global.speechSynthesis.getVoices().find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
            if (stem) uiting.voice = stem;
            uiting.onend = () => einde(true);
            uiting.onerror = (e) => einde(e?.error === 'interrupted' || e?.error === 'canceled');
            kern.global.speechSynthesis.resume?.();
            kern.global.speechSynthesis.speak(uiting);
          }, 120);
        });
      }
      if (typeof kern.global.fully?.textToSpeech === 'function') {
        try {
          kern.global.fully.stopTextToSpeech?.();
          kern.global.fully.textToSpeech(tekst, lang.replace('-', '_'));
        } catch {
          return Promise.resolve(false);
        }
        return new Promise((ok) => setTimeout(() => ok(true), duur));
      }
      return Promise.resolve(false);
    }


    return { meldLaad, updateKlaar, bijwerkVenster, koffieKnop, jouwMeldingen, laadHulp, meldingenStart, nieuweVersie, metLidwoord, kanApparaatSpreken, zegMetApparaat };
  };
})(window);
