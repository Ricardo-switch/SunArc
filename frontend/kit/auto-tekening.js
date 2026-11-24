// De auto als meter (besluit 259, schets Wand-Auto en Tel-Auto, 6 november 2026).
// De schets is de code (besluit 104): de pagina Auto en de schetsen tekenen hiermee.
(function (global) {
  let nr = 0;
  /**
   * De auto als meter: de carrosserie vult zich van achter naar voren tot de
   * lading; een streep bij de laadgrens. De kabel van de laadpaal naar de
   * laadklep, met amber voor zon en grijs voor het net.
   *   pct     lading in procenten, of null (de auto zegt het niet)
   *   grens   laadgrens in procenten, of null
   *   kabel   'zon' | 'net' | 'vrij' (geen auto aan de paal) | 'erin' (kabel erin, laadt niet)
   *   auto    false: de auto is weg, alleen de laadpaal
   *   paal    false: geen laadpaal, alleen de auto
   *   tekst   { onbekend, leeg }: de zinnen in de tekening
   *   naam    een vaste naam voor de verlopen, als dezelfde tekening vaker staat
   * Elke tekening krijgt eigen namen voor zijn verlopen: de wand en de
   * telefoon staan op dezelfde pagina, en een verborgen tekening mag de
   * andere niet kleuren.
   */
  /** @param {{ tekst?: { onbekend?: string, leeg?: string }, [rest: string]: any }} o */
  function scene({ pct, grens, kabel, auto = true, paal = true, tekst = {}, naam = null }) {
    const id = naam ?? `auto${++nr}`;
    const t = global.taal?.t ?? ((k) => k);
    const onbekend = tekst.onbekend ?? t('auto.tekening.onbekend');
    const leeg = tekst.leeg ?? t('auto.tekening.leeg');
    const x0 = 210, x1 = 690; // achterkant en neus van de auto
    const romp = 'M222,232 Q206,230 206,212 L208,186 Q210,168 228,164 L300,152 Q352,104 430,96 L548,96 Q598,98 636,140 L668,150 Q690,156 692,178 L694,212 Q694,230 676,232 Z';
    const ramen = 'M318,152 Q362,114 432,108 L486,108 L486,152 Z M500,108 L546,108 Q584,110 616,146 L500,150 Z';
    const p = pct == null ? null : Math.max(0, Math.min(100, pct));
    const g = grens == null || grens >= 100 ? null : Math.max(0, Math.min(100, grens));
    const vul = p == null ? 0 : x0 + ((x1 - x0) * p) / 100;
    const gx = g == null ? null : x0 + ((x1 - x0) * g) / 100;
    const wiel = (cx) => `<circle cx="${cx}" cy="232" r="34" fill="#0a111d" stroke="rgba(255,255,255,0.18)" stroke-width="2"/><circle cx="${cx}" cy="232" r="19" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="5"/><circle cx="${cx}" cy="232" r="5" fill="rgba(255,255,255,0.4)"/>`;
    const kleur = kabel === 'zon' ? '#f7b548' : kabel === 'net' ? '#9aaabb' : 'rgba(255,255,255,0.35)';
    const stroomt = kabel === 'zon' || kabel === 'net';
    const aan = paal && (kabel === 'zon' || kabel === 'net' || kabel === 'erin');
    const kabelPad = 'M92,176 C92,262 150,272 200,262 C226,256 226,206 214,192';
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const laadpaal = paal
      ? `<rect x="40" y="58" width="6" height="208" rx="3" fill="rgba(255,255,255,0.08)"/>
      <rect x="58" y="96" width="68" height="96" rx="16" fill="#1a2638" stroke="rgba(255,255,255,0.16)" stroke-width="2"/>
      <rect x="76" y="116" width="32" height="5" rx="2.5" fill="${stroomt ? kleur : 'rgba(255,255,255,0.25)'}"/>
      <circle cx="92" cy="166" r="9" fill="#0d1624" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>`
      : '';
    return `
      <defs>
        <clipPath id="${id}-romp"><path d="${romp}"/></clipPath>
        <linearGradient id="${id}-lading" x1="0" x2="1"><stop offset="0" stop-color="#6ee7b7" stop-opacity="0.55"/><stop offset="1" stop-color="#6fd3ff" stop-opacity="0.75"/></linearGradient>
        <linearGradient id="${id}-glans" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <radialGradient id="${id}-grond" cx="0.55" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity="0.45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      </defs>
      <line x1="0" y1="266" x2="760" y2="266" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
      ${laadpaal}
      ${auto ? `
        ${aan ? `<path d="${kabelPad}" fill="none" stroke="#0d1624" stroke-width="9" stroke-linecap="round"/>
        <path d="${kabelPad}" fill="none" stroke="${kleur}" stroke-width="4" stroke-linecap="round" ${stroomt ? 'stroke-dasharray="2 12" class="stroomt"' : 'opacity="0.6"'}/>` : ''}
        <ellipse cx="450" cy="262" rx="290" ry="18" fill="url(#${id}-grond)"/>
        <g>
          <path d="${romp}" fill="#162234" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
          <g clip-path="url(#${id}-romp)">
            ${p == null ? '' : `<rect x="${x0}" y="80" width="${(vul - x0).toFixed(1)}" height="170" fill="url(#${id}-lading)"/><rect x="${(vul - 3).toFixed(1)}" y="80" width="3" height="170" fill="#c9fff0"/>`}
            <path d="${romp}" fill="url(#${id}-glans)"/>
          </g>
          <path d="${ramen}" fill="rgba(11,20,36,0.55)" stroke="rgba(255,255,255,0.14)" stroke-width="1.5"/>
          ${gx == null ? '' : `<line x1="${gx.toFixed(1)}" y1="84" x2="${gx.toFixed(1)}" y2="236" stroke="#fff" stroke-width="2" stroke-dasharray="5 5" opacity="0.8"/><text x="${gx.toFixed(1)}" y="74" text-anchor="middle" font-family="Figtree" font-weight="700" font-size="14" fill="#eef3f7">${g}%</text>`}
          <rect x="208" y="186" width="9" height="12" rx="3" fill="${stroomt ? kleur : '#0d1624'}" stroke="rgba(255,255,255,0.25)"/>
          ${wiel(300)}${wiel(600)}
          ${p == null ? `<text x="450" y="200" text-anchor="middle" font-family="Figtree" font-weight="600" font-size="15" fill="#b8c4cf">${esc(onbekend)}</text>` : ''}
        </g>` : `
        ${paal ? `<path d="M92,176 C92,218 118,226 130,218" fill="none" stroke="#0d1624" stroke-width="9" stroke-linecap="round"/>
        <path d="M92,176 C92,218 118,226 130,218" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="4" stroke-linecap="round"/>` : ''}
        <path d="M300,232 L660,232" stroke="rgba(255,255,255,0.12)" stroke-width="2" stroke-dasharray="8 10"/>
        <text x="480" y="200" text-anchor="middle" font-family="Figtree" font-weight="600" font-size="16" fill="#7f8e9c">${esc(leeg)}</text>`}`;
  }
  global.autoTekening = scene;
})(window);
