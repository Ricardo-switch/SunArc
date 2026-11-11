/*
 * Apparaat toevoegen (besluit 293, schets Wand-Apparaat-Toevoegen): een eigen
 * scherm in de tab Apparaten, in plaats van Regeling › Op zon.
 *
 * Links wat SunArc in Home Assistant vond en nog niet is ingedeeld: zonder
 * kamer, nog niet op zon, of een auto, laadpaal of accu die uit staat. Rechts
 * zelf kiezen per soort. Elk gaat naar de plek waar het al ingesteld wordt
 * (Indeling, Regeling › Op zon, Energie › Auto en laadpaal of Thuisaccu,
 * Inrichten › Klimaat). Schakelaars en losse sensoren komen in een volgende stap.
 */
'use strict';

const { $$, esc, haal } = app;
const { t } = taal;

let huisData = null;
let aansluiting = null;

/** Per soort: het icoon, het vlak erachter en waar je hem toevoegt. */
const SOORTEN = [
  ['klimaat', 'airco', '111, 211, 255', 'inrichten.html#klimaat'],
  ['licht', 'lamp', '247, 181, 72', 'indeling.html'],
  ['water', 'boiler', '255, 122, 77', 'regeling.html#opzon'],
  ['witgoed', 'witgoed', '110, 231, 183', 'regeling.html#opzon'],
  ['auto', 'auto', '143, 134, 255', 'energie.html#auto'],
  ['energie', 'batterij', '110, 231, 183', 'energie.html#accu'],
  ['stekkers', 'stekker', '201, 211, 220', 'regeling.html#opzon'],
];

/** Het icoon en de naam van een ding, voor de regel links. */
const DING = {
  licht: ['lamp', 'toev.ding.licht'],
  klimaat: ['airco', 'toev.ding.klimaat'],
  stekker: ['stekker', 'toev.ding.stekker'],
  boiler: ['boiler', 'toev.ding.boiler'],
  jacuzzi: ['jacuzzi', 'toev.ding.jacuzzi'],
  auto: ['auto', 'toev.ding.auto'],
  laadpaal: ['laadpaal', 'toev.ding.laadpaal'],
  accu: ['batterij', 'toev.ding.accu'],
};
const ding = (soort) => DING[soort] ?? ['apparaat', 'toev.ding.anders'];

/**
 * Wat nieuw gevonden is en nog niet ingedeeld: zonder kamer (naar Indeling),
 * nog niet op zon (naar Regeling), of uit bij Energie. Dezelfde telling staat
 * op de knop Toevoegen bij Apparaten.
 */
function nieuwGevonden() {
  const uit = [];
  for (const d of huisData?.zonderRuimte ?? []) uit.push({ naam: d.naam, soort: d.soort, zin: 'toev.zonderKamer', href: 'indeling.html#los' });
  const opZon = aansluiting?.antwoorden?.opZon ?? {};
  for (const d of aansluiting?.gevonden?.apparaten ?? []) if (opZon[d.id] !== true) uit.push({ naam: d.naam, soort: d.soort, zin: 'toev.nietOpZon', href: 'regeling.html#opzon' });
  for (const d of aansluiting?.laden?.apparaten ?? []) if (!d.aan) uit.push({ naam: d.naam, soort: d.rol, zin: 'toev.uit', href: 'energie.html#auto' });
  for (const d of aansluiting?.accu?.apparaten ?? []) if (!d.aan) uit.push({ naam: d.naam, soort: 'accu', zin: 'toev.uit', href: 'energie.html#accu' });
  return uit;
}

function teken() {
  app.schaal();
  const lijst = nieuwGevonden();
  const rijen = lijst.length
    ? lijst
        .map((d) => {
          const [icoon, wat] = ding(d.soort);
          return `<a class="rij" href="${d.href}"><span class="ik">${iconen.svg(icoon)}</span><b>${esc(d.naam)}</b><small>${esc(t(d.zin, { wat: t(wat) }))}</small><span class="pijl" aria-hidden="true">›</span></a>`;
        })
        .join('')
    : `<p class="leeg">${esc(t('toev.geenNieuw'))}</p>`;
  $$('[data-nieuw]').forEach((el) => (el.innerHTML = rijen));
  const tegels = SOORTEN.map(([id, icoon, vlak, href]) => `<a class="soort" href="${href}" data-soort="${id}"><span class="ik" style="background: rgba(${vlak}, 0.14)">${iconen.svg(icoon)}</span><b>${esc(t(`apparaten.soort.${id}`))}</b><span>${esc(t(`toev.soort.${id}`))}</span></a>`).join('');
  $$('[data-soorten]').forEach((el) => (el.innerHTML = tegels));
}

async function laad() {
  const [h, a] = await Promise.allSettled([haal('api/huis'), haal('api/aansluiting')]);
  if (h.status === 'fulfilled') huisData = h.value;
  if (a.status === 'fulfilled') aansluiting = a.value;
  teken();
}

addEventListener('standwissel', teken);
app.start('apparaten');
teken();
void laad();
