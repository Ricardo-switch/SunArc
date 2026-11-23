/**
 * Bouwt de weergave naar `backend/web`, waar de schaduwdienst hem uitserveert.
 *
 *   npm run build
 *
 * Waarom een scriptje en geen `cp` in package.json: dit draait zowel op Windows
 * tijdens het ontwikkelen als in een Alpine-container tijdens het uitrollen, en
 * die twee delen geen enkel shell-commando. Node is de enige tolk die er op
 * allebei staat.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src');
const out = process.env['HEMS_WEB_OUT'] ?? join(here, '..', 'backend', 'web');

await mkdir(out, { recursive: true });

/**
 * Alles gaat ongewijzigd mee. Tot 0.232.0 bouwde Tailwind hier de opmaak van de oude schaduwpagina (besluit 24); die
 * pagina is De motor geworden (besluit 337), en de app heeft zijn eigen opmaak in kit/ en basis.css.
 */
async function copyStatic() {
  const names = await readdir(src);
  await Promise.all(names.map((n) => copyFile(join(src, n), join(out, n))));
  return names;
}

const copied = await copyStatic();

/*
 * De tekenmotor en de stijlbasis van ontwerp 2 (besluit 104): de schets is de
 * code. Ze staan in frontend/kit; de schetsen in design/app2 laden ze daarvandaan.
 */
const kitDir = join(here, 'kit');
await mkdir(join(out, 'kit'), { recursive: true });
for (const n of await readdir(kitDir)) {
  await copyFile(join(kitDir, n), join(out, 'kit', n));
  copied.push(`kit/${n}`);
}

/*
 * De lettertypen staan in de dienst zelf, niet bij Google: de app werkt zo ook
 * zonder internet, en een bezoek lekt niets naar buiten. Uit de npm-pakketten
 * van Fontsource (OFL), alleen de Latijnse set: die heeft ook €, ³, ° en −.
 */
const FONTS = {
  'figtree.woff2': '@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2',
  'bricolage-grotesque.woff2': '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2',
};
for (const [name, from] of Object.entries(FONTS)) {
  await copyFile(join(here, 'node_modules', from), join(out, name));
  copied.push(name);
}
/* De QR-code bij Bewoners (besluit 147): qrcode-generator (MIT), lokaal, zonder internet. */
await copyFile(join(here, 'node_modules', 'qrcode-generator/dist/qrcode.js'), join(out, 'qrcode.js'));
copied.push('qrcode.js');

/**
 * Zet een versiestempel achter de verwijzingen naar de scripts en de opmaak.
 *
 * De bestandsnamen blijven gelijk, dus een browser die er ooit een met een
 * `max-age` heeft opgehaald houdt die vast tot die vervalt — ook als de server
 * inmiddels iets anders zegt. Dat is precies één keer misgegaan: nieuwe HTML,
 * oude JS, een pagina die half werkt zonder één foutmelding.
 *
 * Een korte hash van de inhoud in de URL maakt dat onmogelijk: wijzigt het
 * bestand, dan wijzigt de URL, en dan is er niets om uit de cache te halen.
 * Wijzigt het niet, dan blijft de URL gelijk en werkt de cache gewoon.
 */
async function stempel() {
  /*
   * Elke pagina, en elk script en elke opmaak die ze zelf laadt (`src="…"` of
   * `href="…"`, een bestand hiernaast). Eerst stond dit als lijst met de hand
   * hier; die vergat de microfoon op Assistent en het huismodel bij Energie.
   */
  /*
   * Ook de scripts die een script zelf laden (22 november 2026): `huisthuis.js` laadt de tekenmotor, `basis.js` het
   * scherm als niemand kijkt. Zonder stempel kon de wand na een update de oude code houden. Eerst de bestanden die
   * zelf niets laden, dan wie alleen die laadt, enzovoort, zodat elke stempel van de laatste inhoud komt. Niet de
   * service worker: die blijft op zijn eigen adres.
   */
  const scripts = [...(await readdir(out)).filter((n) => n.endsWith('.js')), ...(existsSync(join(out, 'kit')) ? (await readdir(join(out, 'kit'))).filter((n) => n.endsWith('.js')).map((n) => `kit/${n}`) : [])];
  const verwijst = new Map();
  for (const naam of scripts) {
    const tekst = await readFile(join(out, naam), 'utf-8');
    // Ook een naam met een punt erin, zoals 'kit/teksten.nl.js' (kit/teksten.js kiest de taal, 23 november 2026).
    const ref = [...new Set([...tekst.matchAll(/'((?:kit\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.js)'/g)].map((m) => m[1]))].filter((r) => r !== 'sw.js' && r !== naam && scripts.includes(r));
    verwijst.set(naam, ref);
  }
  const klaar = new Set(scripts.filter((n) => !verwijst.get(n).length));
  const jsHash = async (naam) => createHash('sha256').update(await readFile(join(out, naam))).digest('hex').slice(0, 8);
  for (let ronde = 0; klaar.size < scripts.length && ronde < 10; ronde++) {
    for (const naam of scripts) {
      if (klaar.has(naam) || !verwijst.get(naam).every((r) => klaar.has(r))) continue;
      let tekst = await readFile(join(out, naam), 'utf-8');
      for (const r of verwijst.get(naam)) tekst = tekst.replaceAll(`'${r}'`, `'${r}?v=${await jsHash(r)}'`);
      await writeFile(join(out, naam), tekst, 'utf-8');
      klaar.add(naam);
    }
  }
  const paginas = (await readdir(out)).filter((n) => n.endsWith('.html'));
  const hashes = new Map();
  const hashVan = async (naam) => {
    if (!hashes.has(naam)) hashes.set(naam, createHash('sha256').update(await readFile(join(out, naam))).digest('hex').slice(0, 8));
    return hashes.get(naam);
  };
  for (const pagina of paginas) {
    const html = join(out, pagina);
    let inhoud = await readFile(html, 'utf-8');
    const namen = new Set([...inhoud.matchAll(/(?:src|href)="([^":#?]+\.(?:js|css))"/g)].map((m) => m[1]));
    for (const naam of namen) {
      if (!existsSync(join(out, naam))) continue;
      inhoud = inhoud.replaceAll(`"${naam}"`, `"${naam}?v=${await hashVan(naam)}"`);
    }
    await writeFile(html, inhoud, 'utf-8');
  }
}

await stempel();
console.log(`Weergave gebouwd naar ${out}`);
console.log(`  ${copied.sort().join(', ')}`);
