/*
 * Meld een probleem (testerronde, november 2026): een klein blad met wat er
 * mis is, en bij een apparaat zijn gegevens (zonder namen of adressen, uit
 * `api/apparaat-gegevens`). "Verder op GitHub" opent het issueformulier
 * melding.yml, vooraf ingevuld. Elke melding krijgt een meldcode die alleen op
 * dit toestel bewaard wordt (`sc-meldingen`); staat die code na een update
 * bij een versie, dan zegt de app wat ermee gebeurde (basis.js).
 *
 * basis.js laadt dit bestand pas bij de eerste tik op een knop
 * `data-meld-probleem`, met `data-apparaat` en `data-naam` voor een apparaat.
 */
'use strict';

(function (global) {
  const { esc, haal } = global.app;
  const t = (k, p) => global.taal.t(k, p);
  const REPO = 'https://github.com/Ricardo-switch/SunArc';
  const OPSLAG = 'sc-meldingen';
  /** Langer dan dit wordt een adres te lang voor GitHub; dan gaan de gegevens via het klembord. */
  const MAX_URL = 7500;
  // Ik snap iets niet (besluit 325): met het stukje handleiding dat past, en de pagina en je huis erbij.
  const SOORTEN = ['fout', 'snap', 'apparaat', 'idee'];
  /** Zoveel regels van het logboek gaan hooguit mee: de nieuwste. */
  const LOG_REGELS = 40;

  /** Het logboek als tekst: tijd, soort en wat de dienst schreef. */
  function logTekst(regels) {
    return (regels ?? []).slice(-LOG_REGELS).map((r) => `${new Date(r.ms).toISOString().slice(0, 19).replace('T', ' ')} ${r.niveau === 'fout' ? 'FOUT' : 'LET OP'} ${r.tekst}`).join('\n');
  }

  function meldingen() {
    try {
      const l = JSON.parse(global.localStorage.getItem(OPSLAG) ?? '[]');
      return Array.isArray(l) ? l : [];
    } catch {
      return [];
    }
  }
  function onthoud(m) {
    try {
      global.localStorage.setItem(OPSLAG, JSON.stringify([...meldingen(), m].slice(-50)));
    } catch {
      // Zonder opslag geen terugkoppeling; de melding zelf gaat wel.
    }
  }
  /** Een korte code zonder letters die op elkaar lijken: SA-7F3K. */
  function nieuweCode() {
    const tekens = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const r = global.crypto.getRandomValues(new Uint8Array(4));
    return `SA-${[...r].map((x) => tekens[x % tekens.length]).join('')}`;
  }

  let s = null;
  /** Of melden op pauze staat; null zolang de dienst het nog niet zei. */
  let pauze = null;

  async function open({ apparaat = null, naam = null, wat = '', soort = null, hulp = null } = {}) {
    s = { apparaat, naam, soort: SOORTEN.includes(soort) ? soort : apparaat ? 'apparaat' : 'fout', wat: wat ?? '', mee: !!apparaat, gegevens: null, log: [], metLog: true, code: nieuweCode(), klaar: false, klembord: false, hulp, huisMee: true, huis: null, past: null };
    // De woordzoeker staat in hulp.js; die laadt erbij, net als het huis voor wat er meegaat.
    void global.app.laadHulp?.().then(() => zetPast(), () => {});
    if (s.soort === 'snap') void laadHuis().then(() => s?.soort === 'snap' && s.huisMee && teken());
    await laadErbij();
  }

  /** Het huis zonder namen (besluit 325): per etage de soort kamers en de soort apparaten erin. */
  async function laadHuis() {
    if (!s || s.huis) return;
    const h = await haal('api/huis').catch(() => null);
    if (!s || !h) return;
    s.huis = (h.etages ?? []).map((e, i) => ({ etage: i, kamers: (e.ruimtes ?? []).map((r) => ({ soort: r.soort ?? r.buiten?.soort ?? null, apparaten: (r.apparaten ?? []).map((a) => a.soort) })) }));
  }

  /** Wat er bij Ik snap iets niet meegaat: de pagina, het stukje dat er stond, en het huis. */
  const pagina = () => `${global.location.pathname.split('/').pop() || 'thuis.html'}${global.location.hash}`;
  function snapGegevens() {
    return { pagina: pagina(), stukje: s.past?.id ?? s.hulp ?? null, ...(s.huis ? { huis: s.huis } : {}) };
  }

  /** Het stukje dat past bij wat je typt; zonder tekst dat van het vraagteken. */
  function zetPast() {
    if (!s || s.soort !== 'snap' || !global.hulp) return;
    const wat = document.querySelector('[data-meldwat]')?.value ?? s.wat;
    s.past = (wat.trim() ? global.hulp.zoek(wat, 1)[0] : null) ?? (s.hulp ? global.hulp.stukje(s.hulp) : null);
    const vak = document.querySelector('[data-meldpast]');
    if (vak) vak.innerHTML = pastHtml();
  }
  function pastHtml() {
    const p = s?.past;
    if (!p || s.weg?.has(p.id)) return '';
    return `<div class="meldpast" style="display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border-radius: 16px; background: rgba(111, 211, 255, 0.07); border: 1px solid rgba(111, 211, 255, 0.22)"><span class="mini" style="color: var(--ijs-t); font-weight: 700">${esc(t('melden.pastKop'))}</span><b>${esc(p.kop)}</b><p class="klein geen-marge">${esc(p.tekst)}</p>
      <div class="boven-4" style="display: flex; gap: 8px"><button type="button" class="knop" style="min-height: 36px; padding: 0 14px; font-size: 13px" data-meldhielp>${esc(t('melden.hielp'))}</button><button type="button" class="knop" style="min-height: 36px; padding: 0 14px; font-size: 13px" data-meldnietdit="${esc(p.id)}">${esc(t('melden.nietDit'))}</button></div></div>`;
  }

  /**
   * Werkt nog niet: een melding die opgelost heette. De
   * tekst gaat naar het klembord en het issue opent, om daar te reageren;
   * GitHub kan een reactie niet vooraf invullen.
   */
  async function vervolg(code) {
    const m = meldingen().find((x) => x.code === code);
    if (!m) return;
    s = { vervolg: m, apparaat: m.apparaat ?? null, naam: m.naam ?? null, soort: m.soort ?? 'fout', wat: '', mee: !!m.apparaat, gegevens: null, log: [], metLog: true, code, klaar: false, klembord: false, tekst: '' };
    await laadErbij();
  }

  async function laadErbij() {
    const { apparaat } = s;
    // Een nieuwe melding wacht even op de dienst: staat melden op pauze, dan komt het blad om in te vullen niet eerst in beeld.
    if (s.vervolg || pauze != null) {
      s.pauze = !s.vervolg && pauze === true;
      teken();
    }
    const [g, v, l] = await Promise.all([apparaat ? haal(`api/apparaat-gegevens?id=${encodeURIComponent(apparaat)}`).catch(() => null) : null, haal('api/versie').catch(() => null), haal('api/logboek').catch(() => null)]);
    if (!s) return;
    s.gegevens = g;
    s.versie = v;
    pauze = v?.meldenPauze === true;
    s.pauze = !s.vervolg && pauze;
    s.log = Array.isArray(l?.regels) ? l.regels : [];
    teken();
  }

  function sluit() {
    s = null;
    document.querySelectorAll('[data-meldpop], [data-meldpop-achter]').forEach((el) => el.remove());
  }

  function teken() {
    const was = document.querySelector('[data-meldpop] textarea')?.value;
    if (was != null && s) s.wat = was;
    document.querySelectorAll('[data-meldpop], [data-meldpop-achter]').forEach((el) => el.remove());
    if (!s) return;
    const meeVak = s.apparaat ? `<label class="klein" style="display: flex; gap: 8px; align-items: center"><input type="checkbox" data-meldmee ${s.mee ? 'checked' : ''}>${esc(t('melden.mee', { naam: s.naam ?? '' }))}</label>
          ${s.mee && s.gegevens ? `<details class="klein"><summary>${esc(t('melden.bekijk'))}</summary><pre class="geen-marge boven-8" style="white-space: pre-wrap; font-size: 11.5px; max-height: 180px; overflow: auto">${esc(JSON.stringify(s.gegevens, null, 1))}</pre></details>` : ''}` : '';
    // Het logboek meesturen: wat er meegaat, staat eronder te lezen.
    // Ik snap iets niet: de pagina en het huis gaan mee, tenzij je het vinkje weghaalt (besluit 325).
    const huisVak = s.soort === 'snap' ? `<label class="klein" style="display: flex; gap: 8px; align-items: center"><input type="checkbox" data-meldhuis ${s.huisMee ? 'checked' : ''}><span><b>${esc(t('melden.meeKop'))}</b> ${esc(t('melden.meeHuis', { pagina: pagina() }))}</span></label>
          ${s.huisMee ? `<details class="klein"><summary>${esc(t('melden.bekijk'))}</summary><pre class="geen-marge boven-8" style="white-space: pre-wrap; font-size: 11.5px; max-height: 180px; overflow: auto">${esc(JSON.stringify(snapGegevens(), null, 1))}</pre></details>` : ''}` : '';
    const logVak = s.log.length ? `<label class="klein" style="display: flex; gap: 8px; align-items: center"><input type="checkbox" data-meldlog ${s.metLog ? 'checked' : ''}>${esc(t('melden.logMee', { n: Math.min(s.log.length, LOG_REGELS) }))}</label>
          ${s.metLog ? `<details class="klein"><summary>${esc(t('melden.bekijk'))}</summary><pre class="geen-marge boven-8" style="white-space: pre-wrap; font-size: 11.5px; max-height: 180px; overflow: auto">${esc(logTekst(s.log))}</pre></details>` : ''}` : '';
    // Melden op pauze: waarom, een dankwoord en wanneer het weer kan. Reageren op een eerdere melding (Werkt nog niet) blijft.
    const inhoud = s.pauze
      ? `<h2 class="kop-2 geen-marge" id="meldkop">${esc(t('melden.pauze.kop'))}</h2>
        <p class="klein geen-marge">${esc(t('melden.pauze.waarom'))}</p>
        <p class="klein geen-marge">${esc(t('melden.pauze.dank'))}</p>
        <p class="klein geen-marge">${esc(t('melden.pauze.januari'))}</p>
        <div class="knoppen"><button type="button" class="knop knop-licht" data-meldpop-dicht>${esc(t('algemeen.oke'))}</button></div>`
      : s.vervolg && s.klaar
      ? `<h2 class="kop-2 geen-marge" id="meldkop">${esc(t('melden.vervolgKlaar'))}</h2>
        <p class="klein geen-marge">${esc(t(s.klembord ? 'melden.vervolgKlembord' : 'melden.vervolgZelf'))}</p>
        ${s.klembord ? '' : `<pre class="klein geen-marge" data-meldtekst style="white-space: pre-wrap; user-select: all; max-height: 200px; overflow: auto">${esc(s.tekst)}</pre>`}
        <div class="knoppen"><button type="button" class="knop knop-licht" data-meldpop-dicht>${esc(t('algemeen.oke'))}</button></div>`
      : s.vervolg
      ? `<h2 class="kop-2 geen-marge" id="meldkop">${esc(t('melden.werktNiet'))}</h2>
        <p class="klein geen-marge">${esc(t('melden.vervolgOver', { code: s.code, titel: s.vervolg.titel ?? '' }))}</p>
        <label class="veldnaam">${esc(t('melden.vervolgWat'))}<textarea class="invoer" data-meldwat rows="4" maxlength="2000" style="height: auto; padding: 10px 12px">${esc(s.wat)}</textarea></label>
        ${meeVak}
        ${logVak}
        <p class="mini geen-marge">${esc(t('melden.vervolgGithub'))}</p>
        <div class="knoppen"><button type="button" class="knop" data-meldpop-dicht>${esc(t('basis.versie.later'))}</button><button type="button" class="knop knop-licht" data-meldpop-stuur>${esc(t('melden.verder'))}</button></div>`
      : s.klaar
      ? `<h2 class="kop-2 geen-marge" id="meldkop">${esc(t('melden.bedankt'))}</h2>
        <p class="klein geen-marge">${esc(t('melden.bedanktZin', { code: s.code }))}</p>
        ${s.klembord ? `<p class="klein geen-marge">${esc(t('melden.klembord'))}</p>` : ''}
        <div class="knoppen"><button type="button" class="knop knop-licht" data-meldpop-dicht>${esc(t('algemeen.oke'))}</button></div>`
      : `<h2 class="kop-2 geen-marge" id="meldkop">${esc(t('melden.kop'))}</h2>
        <div class="keuzes" role="group" aria-label="${esc(t('melden.soort'))}">${SOORTEN.filter((k) => k !== 'apparaat' || s.apparaat).map((k) => `<button type="button" data-meldsoort="${k}" aria-pressed="${s.soort === k}">${esc(t(`melden.soort.${k}`))}</button>`).join('')}</div>
        <label class="veldnaam">${esc(t(s.soort === 'idee' ? 'melden.watIdee' : s.soort === 'snap' ? 'melden.watSnap' : 'melden.wat'))}<textarea class="invoer" data-meldwat rows="${s.soort === 'snap' ? 3 : 4}" maxlength="2000" style="height: auto; padding: 10px 12px">${esc(s.wat)}</textarea></label>
        ${s.soort === 'snap' ? `<div data-meldpast>${pastHtml()}</div>` : ''}
        ${meeVak}
        ${huisVak}
        ${s.soort === 'snap' ? '' : logVak}
        <p class="mini geen-marge">${esc(t('melden.github', { code: s.code }))}</p>
        <div class="knoppen"><button type="button" class="knop" data-meldpop-dicht>${esc(t('basis.versie.later'))}</button><button type="button" class="knop knop-licht" data-meldpop-stuur>${esc(t('melden.verder'))}</button></div>`;
    document.body.insertAdjacentHTML('beforeend', `<div class="meldachter" data-meldpop-achter></div><div class="glas nieuwpop" role="dialog" aria-modal="true" aria-labelledby="meldkop" data-meldpop>${inhoud}</div>`);
    (document.querySelector('[data-meldwat]') ?? document.querySelector('[data-meldpop] .knop-licht'))?.focus();
  }

  async function stuur() {
    s.wat = document.querySelector('[data-meldwat]')?.value.trim() ?? '';
    if (!s.wat) {
      document.querySelector('[data-meldwat]')?.focus();
      return;
    }
    if (s.vervolg) return stuurVervolg();
    const v = s.versie;
    if (s.soort === 'snap' && s.huisMee) await laadHuis();
    const gegevens = s.soort === 'snap' ? (s.huisMee ? JSON.stringify(snapGegevens(), null, 1) : '') : s.mee && s.gegevens ? JSON.stringify(s.gegevens, null, 1) : '';
    const titel = `${t(`melden.soort.${s.soort}`)}${s.naam && s.soort === 'apparaat' ? ` (${s.naam.slice(0, 30)})` : ''}: ${s.wat.split('\n')[0].slice(0, 70)}`;
    const velden = {
      template: 'melding.yml',
      title: titel,
      soort: t(`melden.soort.${s.soort}`),
      wat: s.wat,
      versie: v?.nummer ? `${v.nummer} (${v.installatie ?? ''})` : '',
      waar: `${global.location.pathname.split('/').pop() || 'thuis.html'} · ${global.app.telStand() ? t('w.telefoon') : t('w.wand')} · ${global.taal.code}`,
      meldcode: s.code,
    };
    const log = s.soort !== 'snap' && s.metLog && s.log.length ? logTekst(s.log) : '';
    const adres = (extra) => `${REPO}/issues/new?${new URLSearchParams({ ...velden, ...extra })}`;
    let url = adres({ ...(gegevens ? { gegevens } : {}), ...(log ? { logboek: log } : {}) });
    if ((gegevens || log) && url.length > MAX_URL) {
      // Te lang voor een adres: de gegevens en het logboek op het klembord, en een zin in de vakken om ze te plakken.
      const samen = [gegevens ? `${t('melden.kopGegevens')}\n${gegevens}` : '', log ? `${t('melden.kopLogboek')}\n${log}` : ''].filter(Boolean).join('\n\n');
      try {
        await global.navigator.clipboard.writeText(samen);
        s.klembord = true;
      } catch {
        s.klembord = false;
      }
      url = adres({ ...(gegevens ? { gegevens: t('melden.plakHier') } : {}), ...(log ? { logboek: t('melden.plakHier') } : {}) });
    }
    global.open(url, '_blank', 'noopener');
    // Het apparaat erbij, zodat Werkt nog niet later verse gegevens kan meegeven.
    onthoud({ code: s.code, titel: titel.slice(0, 120), soort: s.soort, ms: Date.now(), ...(s.apparaat ? { apparaat: s.apparaat, naam: (s.naam ?? '').slice(0, 60) } : {}) });
    s.klaar = true;
    teken();
  }

  async function stuurVervolg() {
    const v = s.versie;
    const gegevens = s.mee && s.gegevens ? `\n\n\`\`\`json\n${JSON.stringify(s.gegevens, null, 1)}\n\`\`\`` : '';
    const log = s.metLog && s.log.length ? `\n\n${t('melden.kopLogboek')}\n\`\`\`\n${logTekst(s.log)}\n\`\`\`` : '';
    s.tekst = `${t('melden.vervolgRegel', { versie: v?.nummer ?? '?', code: s.code })}\n\n${s.wat}${gegevens}${log}`;
    try {
      await global.navigator.clipboard.writeText(s.tekst);
      s.klembord = true;
    } catch {
      s.klembord = false;
    }
    const m = s.vervolg;
    global.open(m.issue ? `${REPO}/issues/${m.issue}` : `${REPO}/issues?${new URLSearchParams({ q: `${s.code} is:issue` })}`, '_blank', 'noopener');
    try {
      global.localStorage.setItem(OPSLAG, JSON.stringify(meldingen().map((x) => (x.code === s.code ? { ...x, bevestigd: 'nietGoed', bevestigdMs: Date.now() } : x))));
    } catch {
      // Dan staat de knop er de volgende keer nog.
    }
    s.klaar = true;
    teken();
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-meldsoort], [data-meldpop-dicht], [data-meldpop-achter], [data-meldpop-stuur], [data-meldmee], [data-meldlog], [data-meldhuis], [data-meldhielp], [data-meldnietdit]');
    if (!el || !s) return;
    if (el.dataset.meldsoort) {
      s.soort = el.dataset.meldsoort;
      teken();
      if (s.soort === 'snap') {
        zetPast();
        void laadHuis().then(() => s?.soort === 'snap' && s.huisMee && teken());
      }
    } else if (el.matches('[data-meldhielp]')) {
      // Dit helpt: er gaat niets weg.
      sluit();
    } else if (el.dataset.meldnietdit) {
      (s.weg ??= new Set()).add(el.dataset.meldnietdit);
      const vak = document.querySelector('[data-meldpast]');
      if (vak) vak.innerHTML = '';
    } else if (el.matches('[data-meldhuis]')) {
      s.huisMee = el.checked;
      teken();
    } else if (el.matches('[data-meldmee]')) {
      s.mee = el.checked;
      teken();
    } else if (el.matches('[data-meldlog]')) {
      s.metLog = el.checked;
      teken();
    } else if (el.matches('[data-meldpop-stuur]')) void stuur();
    else sluit();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && s) sluit();
  });
  // De woordzoeker onder wat je typt: even wachten tot je stopt.
  let pastWacht = null;
  document.addEventListener('input', (e) => {
    if (!s || s.soort !== 'snap' || !e.target.matches?.('[data-meldwat]')) return;
    clearTimeout(pastWacht);
    pastWacht = setTimeout(zetPast, 350);
  });

  global.melden = { open, vervolg, meldingen };
})(window);
