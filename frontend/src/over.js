/*
 * Over deze app (1 november 2026): het logo groot en voluit, wat de naam
 * betekent, de versie met wat er nieuw is, en waar de broncode staat.
 */
'use strict';

const { esc, haal } = app;
const BRON = 'https://github.com/Ricardo-switch/SunArc';
/*
 * De motor (23 november 2026, stap 4 punt 4): zeven tikken op het versienummer, en daarna staat De motor op dit
 * toestel onder de versie. Geen slot: de pagina leest alleen, achter dezelfde inlog als de rest.
 */
const MOTOR = 'sc-motor';
const motorAan = () => {
  try {
    return localStorage.getItem(MOTOR) === '1';
  } catch {
    return false;
  }
};
let laatste = null;
let tikken = 0;
let tikTijd = 0;

function teken(versie) {
  laatste = versie;
  const nieuwste = versie?.nieuw?.[0] ?? null;
  const regels = nieuwste ? ['nieuw', 'beter', 'opgelost'].flatMap((s) => nieuwste[s] ?? []).slice(0, 3) : [];
  const motor = motorAan() ? `<a class="knop boven-12" href="motor.html" style="display: inline-flex; gap: 8px; align-items: center">${esc(t('motor.ingang'))} <span aria-hidden="true">›</span></a><p class="mini geen-marge boven-8">${esc(t('motor.ingangZin'))}</p>` : '<p class="mini geen-marge boven-8" style="min-height: 1em" data-motor-tik></p>';
  const html = `<div class="voluit"><img src="kit/merk.svg" alt=""><div class="woord">SunArc</div><div class="arc">${t('over.arc')}</div></div>
    <div class="glas overvak">
      <div><h2>${esc(t('over.versieKop'))}</h2><div class="versie" style="user-select: none">${esc(versie?.nummer ?? '…')}</div>${regels.length ? `<ul>${regels.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}${motor}</div>
      <div><h2>${esc(t('over.naamKop'))}</h2><p>${esc(t('over.naam'))}</p></div>
      <div><h2>${esc(t('over.openKop'))}</h2><p>${esc(t('over.open'))} <a href="${BRON}" target="_blank" rel="noopener">${esc(t('over.bron'))}</a></p></div>
      <div><h2>${esc(t('over.steunKop'))}</h2><p>${esc(t('over.steun'))}</p><div class="boven-12">${app.koffieKnop()}</div></div>
      <div><h2>${esc(t('melden.overKop'))}</h2><p>${esc(t('melden.overZin'))}</p><div class="boven-12"><button type="button" class="knop" data-meld-probleem>${esc(t('melden.kop'))}</button></div></div>
    </div>`;
  document.querySelectorAll('[data-over]').forEach((el) => (el.innerHTML = html));
}

async function laad() {
  teken(null);
  teken(await haal('api/versie').catch(() => null));
}

// Zeven tikken binnen een paar seconden op het versienummer; vanaf vier zegt de pagina hoeveel er nog komen.
document.addEventListener('click', (e) => {
  if (motorAan() || !(/** @type {Element} */ (e.target)).closest?.('.versie')) return;
  const nu = Date.now();
  if (nu - tikTijd > 2500) tikken = 0;
  tikTijd = nu;
  tikken++;
  if (tikken >= 7) {
    try {
      localStorage.setItem(MOTOR, '1');
    } catch {
      return;
    }
    teken(laatste);
    document.querySelectorAll('[data-over] .versie').forEach((el) => el.parentElement?.insertAdjacentHTML('beforeend', `<p class="mini geen-marge boven-4" style="color: var(--mint)">${esc(t('motor.ingangAan'))}</p>`));
  } else if (tikken >= 4) document.querySelectorAll('[data-motor-tik]').forEach((el) => (el.textContent = t('motor.tikNog', { n: 7 - tikken })));
});

app.start('instellingen');
void laad();
