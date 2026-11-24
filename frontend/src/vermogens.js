/*
 * De netmeter en de omvormers (testerronde, november 2026): welke sensor zegt
 * wat er nu van en naar het net gaat, en welke omvormers samen de opbrengst
 * van nu zijn. Voor Inrichten en Energie samen. De dienst zoekt de sensoren
 * in W en kW (`api/aansluiting`, veld `vermogens`, met wat ze nu zeggen); deze
 * kant zet ze neer en zet de keuze in de antwoorden (`netmeter`, `omvormers`).
 * Leeg is: wat de regeling nu gebruikt (`inGebruik`).
 */
'use strict';

const vermogens = (() => {
  const { esc } = app;
  const t = (k, p) => window.taal.t(k, p);
  const watt = (w) => (w == null ? t('vermogens.niets') : Math.abs(w) >= 1000 ? `${(w / 1000).toLocaleString(window.taal.locale, { maximumFractionDigits: 1 })} kW` : `${Math.round(w).toLocaleString(window.taal.locale)} W`);

  const lijst = (info) => info?.vermogens ?? [];
  const van = (info, id) => lijst(info).find((v) => v.id === id) ?? null;
  const naam = (info, id) => van(info, id)?.naam ?? id;

  /** De netmeter zoals hij nu geldt: de keuze van de bewoner, anders wat de regeling gebruikt. */
  const netNu = (info, a) => a?.netmeter ?? info?.antwoorden?.netmeter ?? info?.inGebruik?.netmeter ?? null;
  const zonNu = (info, a) => {
    const gekozen = a?.omvormers ?? info?.antwoorden?.omvormers ?? [];
    return gekozen.length ? gekozen : info?.inGebruik?.omvormers ?? [];
  };

  /** Een keuzelijst: eerst wat op deze rol lijkt, dan de rest; met wat elke sensor nu zegt. */
  function keuze(info, attrs, label, rol, huidig, leeg, zonder = []) {
    const vrij = lijst(info).filter((v) => !zonder.includes(v.id));
    const opt = (v) => `<option value="${esc(v.id)}" ${v.id === huidig ? 'selected' : ''}>${esc(`${v.naam} · ${watt(v.w)}`)}</option>`;
    const past = vrij.filter((v) => v.rol === rol);
    const rest = vrij.filter((v) => v.rol !== rol);
    const opties = past.length && rest.length
      ? `<optgroup label="${esc(t('w.pastHierbij'))}">${past.map(opt).join('')}</optgroup><optgroup label="${esc(t('w.andereSensoren'))}">${rest.map(opt).join('')}</optgroup>`
      : vrij.map(opt).join('');
    return `<label class="veldnaam">${esc(label)}<select class="invoer" ${attrs}>${leeg != null ? `<option value="" ${huidig ? '' : 'selected'}>${esc(leeg)}</option>` : ''}${opties}</select></label>`;
  }

  /** Van en naar het net: één sensor die onder nul gaat, of twee (afname en teruglevering). */
  function netBlok(info, a) {
    if (!lijst(info).length) return `<p class="uitleg">${esc(t('vermogens.geenSensoren'))}</p>`;
    const net = netNu(info, a);
    const afname = net ? van(info, net.afname) : null;
    const terug = net?.terug ? van(info, net.terug) : null;
    const nu = afname && afname.w != null && (!net.terug || terug?.w != null) ? afname.w - (terug?.w ?? 0) : null;
    const stand = !net ? '' : nu == null
      ? `<p class="mini">${esc(t('vermogens.netGeeftNiets'))}</p>`
      : `<p class="mini">${esc(t(nu < 0 ? 'vermogens.netTerug' : 'vermogens.netAf', { w: watt(Math.abs(nu)) }))}</p>`;
    return `<p class="uitleg">${esc(t('vermogens.netUitleg'))}</p>
      ${keuze(info, 'data-netmeter="afname"', t('w.vanHetNet2'), 'net', net?.afname ?? null, net ? null : t('vermogens.kies'))}
      ${net ? keuze(info, 'data-netmeter="terug"', t('vermogens.naarNet'), 'terug', net.terug, t('vermogens.zitErin'), [net.afname]) : ''}
      ${stand}
      <p class="mini">${esc(t('vermogens.netHint'))}</p>`;
  }

  /** De omvormers: elk met wat hij nu levert, en samen opgeteld. */
  function zonBlok(info, a) {
    if (!lijst(info).length) return `<p class="uitleg">${esc(t('vermogens.geenSensoren'))}</p>`;
    const ids = zonNu(info, a);
    const chips = ids.map((id) => {
      const w = van(info, id)?.w ?? null;
      const weg = ids.length > 1 ? `<button type="button" data-omvormer-weg="${esc(id)}" aria-label="${esc(t('w.weghalen2', { naam: naam(info, id) }))}">${esc(naam(info, id))} · ${esc(watt(w))}<span aria-hidden="true">×</span></button>` : `<span class="meterchip-tekst">${esc(naam(info, id))} · ${esc(watt(w))}</span>`;
      return `<span class="meterchip${w == null ? ' leeg' : ''}">${weg}</span>`;
    }).join('');
    const som = ids.map((id) => van(info, id)?.w).filter((w) => w != null);
    const mist = ids.length - som.length;
    const samen = ids.length > 1 ? `<p class="mini">${esc(t('vermogens.samen', { w: watt(som.reduce((x, y) => x + y, 0)) }))}${mist ? ` ${esc(t('vermogens.zonderMist', { n: mist }))}` : ''}</p>` : '';
    return `<p class="uitleg">${esc(t('vermogens.zonUitleg'))}</p>
      ${ids.length ? `<div class="meterchips">${chips}</div>` : ''}
      ${samen}
      ${keuze(info, 'data-omvormer-erbij', ids.length ? t('vermogens.nogEen') : t('w.omvormer'), 'zon', null, t('vermogens.kies'), ids)}`;
  }

  /** Een keuze in een lijst; zet hem in de antwoorden en zegt of er iets te bewaren is. */
  function verander(el, info, a) {
    if (el.dataset.netmeter) {
      const net = netNu(info, a);
      if (el.dataset.netmeter === 'afname') {
        if (!el.value) return false;
        a.netmeter = { afname: el.value, terug: net?.terug && net.terug !== el.value ? net.terug : null };
      } else {
        a.netmeter = { afname: net.afname, terug: el.value || null };
      }
      return true;
    }
    if (el.hasAttribute('data-omvormer-erbij')) {
      if (!el.value) return false;
      a.omvormers = [...zonNu(info, a).filter((id) => id !== el.value), el.value];
      return true;
    }
    if (el.dataset.faseMeter) {
      a.faseKeuze = { ...(a.faseKeuze ?? {}), [el.dataset.faseMeter]: el.value || null };
      return true;
    }
    return false;
  }

  /**
   * Per fase de meter (bij de ouders van Ricardo: drie fasen,
   * maar er was maar één meter te kiezen). Een stroommeter in A, of anders het
   * vermogen op die fase in W; dan rekent SunArc de stroom uit. Staat een fase op
   * W, dan zegt de hint hoe het preciezer kan.
   */
  function faseBlok(info, a, fasen) {
    const meters = info?.faseMeters ?? [];
    if (fasen !== 3 && fasen !== 1) return '';
    const waarde = (m) => (m.waarde == null ? t('vermogens.niets') : m.eenheid === 'A' ? `${m.waarde.toLocaleString(window.taal.locale, { maximumFractionDigits: 1 })} A` : watt(m.waarde));
    const rijen = (fasen === 3 ? [1, 2, 3] : [1]).map((n) => {
      const id = `L${n}`;
      const nu = a.faseKeuze?.[id] ?? info?.faseMeter?.[id]?.id ?? '';
      const opties = meters.filter((m) => m.fase === n).map((m) => `<option value="${esc(m.id)}" ${m.id === nu ? 'selected' : ''}>${esc(`${m.naam} · ${waarde(m)}`)}</option>`).join('');
      return `<label class="veldnaam">${esc(t('vermogens.fase', { n }))}<select class="invoer" data-fase-meter="${id}"><option value="" ${nu ? '' : 'selected'}>${esc(t('vermogens.geenFaseMeter'))}</option>${opties}</select></label>`;
    }).join('');
    const opWatt = (fasen === 3 ? [1, 2, 3] : [1]).some((n) => {
      const id = a.faseKeuze?.[`L${n}`] ?? info?.faseMeter?.[`L${n}`]?.id;
      return meters.find((m) => m.id === id)?.eenheid === 'W';
    });
    const hint = !meters.length ? t('vermogens.faseGeen') : opWatt ? t('vermogens.faseWatt') : '';
    return `<p class="uitleg">${esc(t('vermogens.faseUitleg'))}</p>${rijen}${hint ? `<p class="mini" data-fase-hint>${esc(hint)}</p>` : ''}`;
  }

  /** Een omvormer weghalen; de laatste blijft. */
  function klik(el, info, a) {
    const id = el.closest('[data-omvormer-weg]')?.dataset.omvormerWeg;
    if (!id) return false;
    const rest = zonNu(info, a).filter((x) => x !== id);
    if (!rest.length) return false;
    a.omvormers = rest;
    return true;
  }

  return { netBlok, zonBlok, faseBlok, verander, klik, netNu, zonNu };
})();
