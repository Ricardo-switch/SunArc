/*
 * De zon verdelen (besluit 343, schets Wand-Energie-Zon-Verdelen): een eigen deel bij Energie. Bovenaan wat er nu over
 * is en wie het krijgt, dan één lijst om te slepen (kamers, apparaten op zon, boiler, jacuzzi, stekkers en de
 * laadpaal), met per plek Nu eerst, Vandaag overslaan en Uit de lijst; rechts de marge voor het hele huis en hoe het
 * op Thuis in de strook staat. De volgorde gaat naar de regeling zoals Op zon dat deed; de marge en de keuzes met de
 * hand worden bewaard en getoond, en gaan in zodra SunArc de zon zelf verdeelt.
 *   zonVerdelen.laad()  de lijst van de dienst (api/zon-verdelen)
 *   zonVerdelen.vorm()  het deel, voor wand en telefoon
 *   zonVerdelen.zin()   de korte zin in de lijst met delen
 *   zonVerdelen.strook(v)  "De zon gaat nu naar …, daarna …", ook voor Thuis
 *   zonVerdelen.na      wat er na laden of bewaren getekend moet worden
 */
const zonVerdelen = (function (global) {
  'use strict';
  const t = (k, p) => global.taal.t(k, p);
  const esc = (s) => global.app.esc(s);
  const ik = (n) => global.iconen?.svg?.(n) ?? '';

  /** Wat de dienst zegt (api/zon-verdelen), of null. */
  let data = null;
  /** De plek waarvan de knoppen met de hand openstaan. */
  let open = null;
  const KLEUREN = ['var(--ijs)', 'var(--zon)', 'var(--violet)', 'var(--mint)', 'var(--gloed)'];

  const w = (x) => (x == null ? '' : x < 1000 ? `${Math.round(x / 10) * 10} W` : `${global.app.nl(x / 1000, 1)} kW`);
  const soortVan = (x) => t(`zv.soort.${x.soort === 'buffer' ? x.icoon : x.soort}`);
  // Midden in een zin met een kleine letter, behalve een naam als "EV" of "ACThor".
  const naamKlein = (x) => (/^.[a-zà-ÿ]/.test(x.naam) ? x.naam.charAt(0).toLowerCase() + x.naam.slice(1) : x.naam);
  const hoofd = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const krijgt = (x) => (x.stand === 'zon' || x.stand === 'laadt') && x.krijgtW > 0;

  async function laad() {
    try {
      data = await global.app.haal('api/zon-verdelen');
    } catch {
      data = null;
    }
    zelf.na?.();
    return data;
  }

  /** Wie nu zon krijgt en wie daarna, als zin; null als er niemand in de lijst staat. */
  function strook(v = data) {
    if (!v?.lijst?.length) return null;
    const nu = v.lijst.filter(krijgt).map((x) => t('zv.de', { naam: naamKlein(x) }));
    const daarna = v.lijst.find((x) => x.stand === 'wacht');
    const en = ` ${t('algemeen.en')} `;
    const rij = (l) => (l.length > 1 ? `${l.slice(0, -1).join(', ')}${en}${l.at(-1)}` : l[0]);
    if (!nu.length) return daarna ? t('zv.strook.niemand', { naam: t('zv.de', { naam: naamKlein(daarna) }) }) : null;
    return daarna ? t('zv.strook.daarna', { nu: rij(nu), naam: t('zv.de', { naam: naamKlein(daarna) }) }) : t('zv.strook.nu', { nu: rij(nu) });
  }

  const zin = () => (data ? t('zv.inLijst', { n: data.lijst.length }) : '…');

  function balk() {
    const v = data;
    const gekregen = v.lijst.filter(krijgt);
    const kleur = (x) => KLEUREN[v.lijst.indexOf(x) % KLEUREN.length];
    const rest = v.restW ?? 0;
    const stukken = gekregen.map((x) => `<i style="flex: ${x.krijgtW}; background: ${kleur(x)}" title="${esc(x.naam)}"></i>`).join('') + (rest > 50 || !gekregen.length ? `<i class="rest" style="flex: ${Math.max(rest, 1)}"></i>` : '');
    const namen = gekregen.map((x) => `<span><i style="background: ${kleur(x)}"></i>${esc(x.naam)} <b>${esc(w(x.krijgtW))}</b></span>`).join('') + (rest > 50 ? `<span><i class="rest"></i>${esc(t('zv.nogOver'))} <b>${esc(w(rest))}</b></span>` : '');
    const volgende = v.lijst.find((x) => x.stand === 'wacht' && x.tekortW > 0);
    const rechts = v.overW == null ? t('zv.geenBesluit') : volgende ? hoofd(t('zv.volgende', { naam: t('zv.de', { naam: naamKlein(volgende) }), w: w(volgende.tekortW) })) : '';
    return `<section class="zv-nu">
      <div class="zv-nukop"><span class="zv-label">${esc(t('zv.nuOver'))}</span><b class="zv-over">${v.overW == null ? '–' : esc(w(v.overW))}</b><span class="zv-wacht">${esc(rechts)}</span></div>
      <div class="zv-balk">${stukken}</div>
      ${namen ? `<div class="zv-namen">${namen}</div>` : ''}
    </section>`;
  }

  function stand(x) {
    if (x.stand === 'zon') return `<span class="zv-stand zon">${esc(t('zv.stand.zon', { w: w(x.krijgtW) }))}</span>`;
    if (x.stand === 'laadt') return `<span class="zv-stand zon">${esc(t('zv.stand.laadt', { w: w(x.krijgtW) }))}</span>`;
    if (x.stand === 'wacht') return `<span class="zv-stand wacht">${esc(x.tekortW > 0 ? t('zv.stand.tekort', { w: w(x.tekortW) }) : t('w.wacht'))}</span>`;
    if (x.stand === 'draait') return `<span class="zv-stand wacht">${esc(t('zv.stand.draait'))}</span>`;
    if (x.stand === 'net') return `<span class="zv-stand wacht">${esc(t('zv.stand.net'))}</span>`;
    if (x.stand === 'klaar') return `<span class="zv-stand klaar">${esc(t('zv.stand.klaar'))}</span>`;
    if (x.stand === 'overgeslagen') return `<span class="zv-stand over">${esc(t('zv.stand.over'))}</span>`;
    return `<span class="zv-stand over">${esc(t('zv.stand.rust'))}</span>`;
  }

  function rij(x, i, n) {
    const isOpen = open === x.sleutel;
    const s = esc(x.sleutel);
    const vermogen = x.vermogenW == null ? t('zv.onbekend') : t(`zv.bron.${x.bron}`, { w: w(x.vermogenW) });
    const hand = isOpen
      ? `<div class="zv-hand">
          ${x.eerst ? `<button type="button" class="knop knop-klein" data-zv-hand="${s}:geen">${esc(t('zv.nietEerst'))}</button>` : `<button type="button" class="knop knop-klein" data-zv-hand="${s}:eerst">${esc(t('zv.eerst'))}</button>`}
          ${x.stand === 'overgeslagen' ? `<button type="button" class="knop knop-klein" data-zv-hand="${s}:geen">${esc(t('zv.tochVandaag'))}</button>` : `<button type="button" class="knop knop-klein" data-zv-hand="${s}:overslaan">${esc(t('zv.overslaan'))}</button>`}
          <button type="button" class="knop knop-klein zv-weg" data-zv-uit="${s}">${esc(t('zv.uit'))}</button>
        </div>`
      : '';
    return `<li class="zv-rij${isOpen ? ' open' : ''}${x.stand === 'overgeslagen' ? ' gedimd' : ''}" data-zv-rij="${s}">
      <button type="button" class="zv-greep" data-zv-greep="${i}" aria-label="${esc(t('zv.verplaats', { naam: x.naam, plek: i + 1, n }))}">${ik('greep')}</button>
      <span class="zv-nr">${i + 1}</span>
      <span class="zv-ik">${ik(x.icoon)}</span>
      <button type="button" class="zv-tekst" data-zv-open="${s}" aria-expanded="${isOpen}"><b>${esc(x.naam)}</b><small>${esc(soortVan(x))} · ${esc(vermogen)}</small>${x.eerst ? `<em class="zv-eerst">${esc(t('zv.eerstNu'))}</em>` : ''}</button>
      ${stand(x)}
      ${hand}
    </li>`;
  }

  function uitLijst() {
    if (!data.uit.length) return '';
    return `<section class="zv-uit"><span class="zv-label">${esc(t('zv.doetNiet'))}</span>${data.uit
      .map((x) => `<span class="zv-uitrij"><span class="zv-ik klein">${ik(x.icoon)}</span>${esc(x.naam)}<button type="button" class="knop-tekst" data-zv-terug="${esc(x.sleutel)}">${esc(t('zv.terug'))}</button></span>`)
      .join('')}</section>`;
  }

  function lijst(metUit) {
    const n = data.lijst.length;
    return `<section class="zv-lijstvak">
      <div class="zv-lijstkop"><h3 class="kop-3">${esc(t('zv.wie'))}</h3>${n > 1 ? `<span class="zv-sleep">${esc(t('zv.sleep'))}</span>` : ''}</div>
      ${n ? `<ol class="zv-lijst" data-zv-lijst>${data.lijst.map((x, i) => rij(x, i, n)).join('')}</ol>` : `<p class="zv-noot">${esc(t('zv.leeg'))}</p>`}
      ${metUit ? uitLijst() : ''}
    </section>`;
  }

  function stapper(sleutel, label, waarde, uitleg, r, huidig) {
    return `<div class="zv-stap"><span class="zv-stapnaam">${esc(label)}</span><span class="zv-stapper"><button type="button" data-zv-marge="${sleutel}:-1" aria-label="${esc(t('zv.minder', { naam: label }))}" ${huidig <= r.min ? 'disabled' : ''}>−</button><b>${esc(waarde)}</b><button type="button" data-zv-marge="${sleutel}:1" aria-label="${esc(t('zv.meer', { naam: label }))}" ${huidig >= r.max ? 'disabled' : ''}>+</button></span><small>${esc(uitleg)}</small></div>`;
  }

  function marge() {
    const m = data.marge;
    const b = data.bereik;
    return `<section class="zv-marge">
      <h3 class="kop-3">${esc(t('zv.marge'))}</h3>
      ${stapper('extraW', t('zv.margeW'), t('zv.extra', { w: w(m.extraW) }), t('zv.margeWUitleg'), b.extraW, m.extraW)}
      ${stapper('minuten', t('zv.margeMin'), t('w.minuten', { n: m.minuten }), t('zv.margeMinUitleg'), b.minuten, m.minuten)}
      <p class="zv-noot">${esc(t('zv.margeNoot'))}</p>
    </section>`;
  }

  function thuis() {
    const z = strook();
    return `<section class="zv-thuis">
      <span class="zv-label">${esc(t('zv.opThuis'))}</span>
      <div class="zv-strook"><span class="zv-stip"></span><span>${esc(z ?? t('zv.strook.leeg'))}</span></div>
      <small>${esc(t('zv.opThuisUitleg'))}</small>
    </section>`;
  }

  function vorm() {
    const kop = `<div class="kopregel zv-kop"><h2 class="kop-2">${esc(t('zv.titel'))}</h2><span class="mini">${esc(t('zv.kijktMee'))}</span></div>`;
    if (!data) return `${kop}<p class="klein">${esc(t('algemeen.laden'))}…</p>`;
    if (global.app.telStand()) return `${kop}<div class="zv">${balk()}${lijst(true)}${marge()}${thuis()}</div>`;
    return `${kop}<div class="zv">${balk()}<div class="zv-twee">${lijst(false)}<div class="zv-rechts">${marge()}${thuis()}${uitLijst()}</div></div></div>`;
  }

  /* ------------------------------------------------------------ bewaren */

  function bewaar(body, meteen) {
    // Meteen zo laten zien; de dienst stuurt daarna de lijst zoals hij hem bewaarde.
    if (meteen) {
      meteen();
      zelf.na?.();
    }
    global.groep.bewaarStraks(async () => {
      const uit = await global.groep.stuur('api/zon-verdelen', body);
      if (uit?.ok) data = uit.antwoord;
      zelf.na?.();
      return uit;
    });
  }

  const plekVan = (s) => {
    const [soort, ...id] = s.split(':');
    return { soort, id: id.join(':') };
  };
  /** De hele volgorde: wat in de lijst staat, dan wat eruit is. */
  const volgorde = (lijst) => [...lijst, ...data.uit].map((x) => plekVan(x.sleutel));

  function verplaats(van, naar) {
    if (van === naar || naar < 0 || naar >= data.lijst.length) return;
    const l = [...data.lijst];
    const [x] = l.splice(van, 1);
    l.splice(naar, 0, x);
    bewaar({ volgorde: volgorde(l) }, () => (data = { ...data, lijst: l }));
  }

  const vandaag = () => new Intl.DateTimeFormat('en-CA').format(new Date());
  const middernacht = () => {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.getTime();
  };

  document.addEventListener('click', (ev) => {
    const knop = ev.target.closest('[data-zv-open], [data-zv-hand], [data-zv-uit], [data-zv-terug], [data-zv-marge]');
    if (!knop || knop.disabled || !data) return;
    const d = knop.dataset;
    if (d.zvOpen != null) {
      open = open === d.zvOpen ? null : d.zvOpen;
      zelf.na?.();
    } else if (d.zvHand) {
      const i = d.zvHand.lastIndexOf(':');
      const s = d.zvHand.slice(0, i);
      const wat = d.zvHand.slice(i + 1);
      const keuze = wat === 'eerst' ? { soort: 'eerst', totMs: middernacht() } : wat === 'overslaan' ? { soort: 'overslaan', datum: vandaag() } : null;
      bewaar({ hand: { [s]: keuze } });
    } else if (d.zvUit) {
      open = null;
      bewaar({ uit: [...data.uit.map((x) => x.sleutel), d.zvUit], hand: { [d.zvUit]: null } });
    } else if (d.zvTerug) {
      bewaar({ uit: data.uit.map((x) => x.sleutel).filter((s) => s !== d.zvTerug) });
    } else if (d.zvMarge) {
      const [sleutel, stap] = d.zvMarge.split(':');
      const r = data.bereik[sleutel];
      const m = { ...data.marge, [sleutel]: Math.max(r.min, Math.min(r.max, data.marge[sleutel] + Number(stap) * r.stap)) };
      bewaar({ marge: m }, () => (data = { ...data, marge: m }));
    }
  });

  // Met de pijltjes op de greep: een plek hoger of lager.
  document.addEventListener('keydown', (ev) => {
    const g = ev.target.closest?.('[data-zv-greep]');
    if (!g || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
    ev.preventDefault();
    const i = Number(g.dataset.zvGreep);
    verplaats(i, i + (ev.key === 'ArrowUp' ? -1 : 1));
    requestAnimationFrame(() => document.querySelector(`${global.app.zicht()} [data-zv-greep="${i + (ev.key === 'ArrowUp' ? -1 : 1)}"]`)?.focus());
  });

  // Slepen aan de greep, met een vinger of de muis: de rij schuift mee, loslaten bewaart.
  document.addEventListener('pointerdown', (ev) => {
    const g = ev.target.closest?.('[data-zv-greep]');
    if (!g || !data) return;
    const rijEl = g.closest('.zv-rij');
    const ol = rijEl.parentElement;
    const van = Number(g.dataset.zvGreep);
    const y0 = ev.clientY;
    let naar = van;
    // De wand is geschaald: een pixel van de vinger is minder dan een pixel in de lijst.
    const schaal = rijEl.getBoundingClientRect().height / rijEl.offsetHeight || 1;
    const rijen = [...ol.children];
    const midden = rijen.map((r) => {
      const b = r.getBoundingClientRect();
      return b.top + b.height / 2;
    });
    g.setPointerCapture(ev.pointerId);
    rijEl.classList.add('sleept');
    ev.preventDefault();
    const beweeg = (e) => {
      const dy = e.clientY - y0;
      rijEl.style.transform = `translateY(${dy / schaal}px)`;
      const y = midden[van] + dy;
      // De nieuwe plek: hoeveel andere rijen er boven het midden van de gesleepte rij liggen.
      naar = midden.filter((m, i) => i !== van && m < y).length;
      rijen.forEach((r, i) => {
        if (i === van) return;
        const h = rijEl.offsetHeight + 6;
        r.style.transform = naar < van && i >= naar && i < van ? `translateY(${h}px)` : naar > van && i <= naar && i > van ? `translateY(${-h}px)` : '';
      });
    };
    const los = () => {
      g.removeEventListener('pointermove', beweeg);
      g.removeEventListener('pointerup', los);
      g.removeEventListener('pointercancel', los);
      rijen.forEach((r) => (r.style.transform = ''));
      rijEl.classList.remove('sleept');
      if (naar !== van) verplaats(van, naar);
    };
    g.addEventListener('pointermove', beweeg);
    g.addEventListener('pointerup', los);
    g.addEventListener('pointercancel', los);
  });

  // Elke minuut opnieuw, zolang het deel openstaat: wat er over is verandert met de zon.
  setInterval(() => {
    if (location.hash === '#zon' && !document.querySelector('.zv-rij.sleept')) void laad();
  }, 60_000);

  /** @type {{ laad: typeof laad, vorm: typeof vorm, zin: typeof zin, strook: typeof strook, na: null | (() => void), readonly data: any }} */
  const zelf = { laad, vorm, zin, strook, na: null, get data() { return data; } };
  return zelf;
})(window);
window.zonVerdelen = zonVerdelen;
