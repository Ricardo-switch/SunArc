/*
 * De fasekaart op Thuis (besluit 302, schetsen Wand-Fasekaart en Tel-Fasekaart;
 * testerronde stap 7). Een kaart die je kiest bij Thuis aanpassen: per fase een
 * balk tot de zekering, met een streep waar SunArc onder blijft. Een tik opent
 * het blad met de dag per fase in één grafiek, de pieken van vandaag, en wat
 * SunArc doet als het krap wordt. Geen melding: SunArc grijpt zelf in.
 *
 * Zonder stroommeter per fase zegt de kaart het totaal tegen wat de
 * aansluiting samen kan, met de weg naar Energie › Aansluiting.
 */
(function (global) {
  'use strict';

  const { esc } = global.app;
  const t = (k, v) => global.t(k, v);
  const { getal, klok } = global.taal;

  /** De kleuren van de fasen in de grafiek en de legenda. */
  const KLEUR = ['#6fd3ff', '#f7b548', '#8f86ff'];
  /** Groen, geel vanaf twee derde, oranje vlak bij de zekering (zoals de schets). */
  const kleurVan = (deel) => (deel >= 0.88 ? 'var(--gloed)' : deel >= 0.65 ? 'var(--zon)' : 'var(--mint)');
  const amp = (a) => (a == null ? '–' : `${getal(a, a < 10 && a % 1 ? 1 : 0)} A`);

  let v = null;
  let open = false;

  /** Hooguit elke twintig tellen; de dienst haalt de dag zelf hooguit elke vijf minuten. */
  let opMs = 0;
  async function laad() {
    if (Date.now() - opMs < 20_000) return v;
    opMs = Date.now();
    try {
      const res = await fetch('api/fasen', { cache: 'no-store' });
      v = res.ok ? await res.json() : null;
    } catch {
      // De volgende keer.
    }
    if (open) tekenBlad();
    return v;
  }

  /** Heeft dit huis de kaart? Met meters per fase, of met een zekering uit Energie. */
  const hier = () => !!v && (v.meters ? v.fasen.length > 0 : !!v.zekering);

  /** De grens van een fase: de zekering min de marge. */
  const grens = (f) => f.zekeringA - v.margeA;
  /** De fase met de minste ruimte nu. */
  function krapst() {
    const metA = v.fasen.filter((f) => f.nuA != null);
    if (!metA.length) return null;
    return metA.map((f) => ({ f, over: grens(f) - f.nuA })).sort((a, b) => a.over - b.over)[0];
  }

  /** De zekering in de kop: "3 × 25 A" of "35 A". */
  function zekeringKort() {
    if (v.meters) return v.fasen.length === 1 ? `${v.fasen[0].zekeringA} A` : `${v.fasen.length} × ${v.fasen[0].zekeringA} A`;
    return v.zekering.fasen === 1 ? `${v.zekering.ampere} A` : `3 × ${v.zekering.ampere} A`;
  }

  /** De zin onder de balken. */
  function zin() {
    const k = krapst();
    if (!k) return { tekst: t('fasen.geenMeting'), kleur: '' };
    if (k.over <= 1) return { tekst: t('fasen.bijnaVol', { fase: k.f.id }), kleur: 'var(--gloed-t)', kort: t('fasen.bijnaVolKort', { fase: k.f.id }) };
    const over = getal(Math.max(0, k.over), 0);
    return { tekst: v.fasen.length > 1 ? t('fasen.krapst', { fase: k.f.id, a: over }) : t('fasen.ruimte', { a: over }), kleur: '', kort: v.fasen.length > 1 ? t('fasen.krapstKort', { fase: k.f.id, a: over }) : t('fasen.ruimte', { a: over }) };
  }

  /** Per fase een balk tot de zekering, met een streep waar SunArc onder blijft. */
  function balken() {
    if (!v.meters) {
      const maxKw = ((v.zekering.fasen === 1 ? 1 : 3) * v.zekering.ampere * 230) / 1000;
      const nuKw = Math.max(0, (v.netW ?? 0) / 1000);
      const deel = Math.min(1, nuKw / maxKw);
      return `<div class="fs-totaal"><b>${v.netW == null ? '–' : `${getal(nuKw, 1)} kW`}</b><span>${esc(t('fasen.vanSamen', { kw: getal(maxKw, 1) }))}</span></div>
        <div class="fs-balk"><i style="width: ${(deel * 100).toFixed(1)}%; background: ${kleurVan(deel)}"></i></div>
        <p class="fs-zin"><span class="fs-mist">${esc(t('fasen.meterMist'))}</span> ${esc(t('fasen.zonderMeter'))}</p>`;
    }
    const rijen = v.fasen
      .map((f) => {
        const deel = f.nuA == null ? 0 : Math.min(1, f.nuA / f.zekeringA);
        const streep = (grens(f) / f.zekeringA) * 100;
        return `<div class="fs-rij"><span class="fs-naam">${esc(f.id)}</span><div class="fs-balk"><i style="width: ${(deel * 100).toFixed(1)}%; background: ${kleurVan(deel)}"></i><em style="left: ${streep.toFixed(1)}%"></em></div><b>${amp(f.nuA)}</b></div>`;
      })
      .join('');
    const z = zin();
    return `<div class="fs-balken">${rijen}</div><p class="fs-zin"${z.kleur ? ` style="color: ${z.kleur}"` : ''}>${esc(z.tekst)}</p>`;
  }

  /** Drie staande staafjes voor de smalle tegel op de wand. */
  function staafjes() {
    if (!v.meters) return '';
    const w = 8;
    const hoog = 30;
    const staaf = (f, i) => {
      const deel = f.nuA == null ? 0 : Math.min(1, f.nuA / f.zekeringA);
      const h = Math.max(2, deel * hoog);
      return `<rect x="${i * (w + 4)}" y="0" width="${w}" height="${hoog}" rx="3" fill="rgb(255 255 255 / 0.1)"/><rect x="${i * (w + 4)}" y="${(hoog - h).toFixed(1)}" width="${w}" height="${h.toFixed(1)}" rx="3" fill="${kleurVan(deel)}"/>`;
    };
    return `<svg class="beeld" width="${v.fasen.length * (w + 4)}" height="${hoog}" viewBox="0 0 ${v.fasen.length * (w + 4)} ${hoog}" aria-hidden="true">${v.fasen.map(staaf).join('')}</svg>`;
  }

  /** Voor de tegel op de wand: het hoogste nu, en de zin. */
  function tegelWaarden() {
    if (!v.meters) return { waarde: v.netW == null ? '–' : `${getal(Math.max(0, v.netW) / 1000, 1)} <small>kW</small>`, zin: t('fasen.meterMist'), toon: 'var(--gloed-t)' };
    const k = krapst();
    const z = zin();
    return { waarde: k ? `${getal(k.f.nuA, 0)} <small>A</small>` : '–', zin: z.kort ?? z.tekst, toon: z.kleur };
  }

  /* ---------------------------------------------------------- het blad */

  /** De dag per fase in één grafiek, met de zekering en waar SunArc onder blijft. */
  function dag() {
    const breed = 400;
    const hoog = 120;
    const zek = Math.max(...v.fasen.map((f) => f.zekeringA));
    const g = Math.max(...v.fasen.map((f) => grens(f)));
    const max = zek * 1.04;
    const n = v.fasen[0]?.dag.length ?? 96;
    const x = (i) => (i / n) * breed;
    const y = (a) => hoog - (Math.min(a, max) / max) * hoog;
    const lijnen = v.fasen
      .map((f, k) => {
        // Een stuk zonder meting breekt de lijn.
        const stukken = [];
        let stuk = [];
        f.dag.forEach((a, i) => {
          if (a == null) {
            if (stuk.length) stukken.push(stuk);
            stuk = [];
          } else stuk.push(`${x(i + 0.5).toFixed(1)},${y(a).toFixed(1)}`);
        });
        if (stuk.length) stukken.push(stuk);
        return stukken.map((s) => `<polyline points="${s.join(' ')}" fill="none" stroke="${KLEUR[k % 3]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
      })
      .join('');
    const uren = [0, 6, 12, 18, 24].map((u) => `<text x="${x((u * n) / 24).toFixed(1)}" y="${hoog + 16}" text-anchor="${u === 0 ? 'start' : u === 24 ? 'end' : 'middle'}" class="fs-as">${u}</text>`).join('');
    const nuX = x(((v.nuMs - v.dagStartMs) / 86_400_000) * n);
    return `<svg class="fs-dag" viewBox="0 -18 ${breed} ${hoog + 38}" role="img" aria-label="${esc(t('fasen.dagLabel'))}">
      <line x1="0" x2="${breed}" y1="${y(zek)}" y2="${y(zek)}" stroke="#ff7a4d" stroke-width="1.5"/>
      <text x="${breed}" y="${y(zek) - 5}" text-anchor="end" class="fs-zek">${esc(t('fasen.zekeringA', { a: zek }))}</text>
      <line x1="0" x2="${breed}" y1="${y(g)}" y2="${y(g)}" stroke="#ff7a4d" stroke-width="1" stroke-dasharray="4 5" opacity="0.6"/>
      ${lijnen}
      <line x1="${nuX.toFixed(1)}" x2="${nuX.toFixed(1)}" y1="0" y2="${hoog}" class="fs-nu"/>
      ${uren}
    </svg>`;
  }

  function bladHtml() {
    const sluit = `<button type="button" class="sluit" data-fasen-sluit aria-label="${esc(t('algemeen.sluiten'))}">×</button>`;
    if (!v.meters) {
      const g = v.zekering.ampere - v.margeA;
      return `<div class="hand-boven"><div><h2>${esc(t('fasen.titel'))}</h2><p class="nu">${esc(t('fasen.kopZonder', { zek: zekeringKort() }))}</p></div>${sluit}</div>
        <div class="fs-blok">${balken()}</div>
        <div class="fs-uitleg"><h3>${esc(t('fasen.ookPerFase'))}</h3><p>${esc(t('fasen.ookPerFaseZin', { a: g }))}</p><a class="knop knop-licht" href="energie.html#aansluiting">${esc(t('fasen.naarAansluiting'))}</a></div>`;
    }
    const een = v.fasen.length === 1;
    const zek = v.fasen[0].zekeringA;
    const kop = een ? t('fasen.kopEen', { a: zek, grens: zek - v.margeA }) : t('fasen.kopDrie', { a: zek, grens: zek - v.margeA });
    const legenda = een ? '' : `<div class="fs-legenda">${v.fasen.map((f, k) => `<span><i style="background: ${KLEUR[k % 3]}"></i>${esc(f.id)}</span>`).join('')}</div>`;
    const pieken = v.fasen.map((f) => `<div class="fs-piek"><span>${esc(f.id)}</span><b>${amp(f.piekA)}</b><small>${f.piekMs == null ? '' : esc(t('fasen.om', { tijd: klok(f.piekMs) }))}</small></div>`).join('');
    return `<div class="hand-boven"><div><h2>${esc(t('fasen.titel'))}</h2><p class="nu">${esc(kop)}</p></div>${sluit}</div>
      <div class="fs-blok">${balken()}</div>
      <div class="fs-dagblok"><div class="fs-dagkop"><h3>${esc(t('fasen.vandaag'))}</h3>${legenda}</div>${dag()}</div>
      <div><h3 class="fs-h3">${esc(t('fasen.hoogst'))}</h3><div class="fs-pieken" style="grid-template-columns: repeat(${v.fasen.length}, minmax(0, 1fr))">${pieken}</div></div>
      <div class="fs-uitleg"><h3>${esc(t('fasen.krapKop'))}</h3><p>${esc(t('fasen.krapZin'))}</p></div>`;
  }

  function tekenBlad() {
    let laag = document.querySelector('[data-fasenblad]');
    if (!open || !v || !hier()) {
      laag?.remove();
      open = false;
      return;
    }
    const tel = global.app.telStand();
    if (!laag) {
      laag = document.createElement('div');
      laag.className = 'hand-laag';
      laag.setAttribute('data-fasenblad', '');
      laag.setAttribute('role', 'dialog');
      laag.setAttribute('aria-modal', 'true');
      laag.setAttribute('aria-label', t('fasen.titel'));
      (tel ? document.body : (document.getElementById('wand') ?? document.body)).append(laag);
      laag.innerHTML = `<div class="hand-achter" data-fasen-sluit></div><div class="hand-vel"><section class="glas hand-blad fs-blad"></section></div>`;
    }
    laag.classList.toggle('op-tel', tel);
    const html = bladHtml();
    const blad = laag.querySelector('.fs-blad');
    if (blad.dataset.html !== html) {
      blad.innerHTML = html;
      blad.dataset.html = html;
    }
  }

  function openBlad() {
    if (!hier()) return;
    open = true;
    tekenBlad();
    document.querySelector('[data-fasenblad] .sluit')?.focus();
  }
  function sluitBlad() {
    open = false;
    tekenBlad();
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-fasen-sluit]')) {
      sluitBlad();
      return;
    }
    if (e.target.closest('[data-fasen]')) {
      e.preventDefault();
      openBlad();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) sluitBlad();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-fasen]')) {
      e.preventDefault();
      openBlad();
    }
  });

  global.fasekaart = { laad, hier, balken, staafjes, tegelWaarden, zekeringKort, openBlad, sluitBlad, nu: () => v };
})(window);
