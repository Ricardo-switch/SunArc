/**
 * De geschiedenis hoort in het besluitenlog, niet in de code (besluit 340). Dit telt per codebestand wat er nog als
 * dagboek in het commentaar staat: een datum ("21 november 2026") of een naam ("Ricardo, ..."). Een verwijzing als
 * "(besluit 168)" telt niet: dat is de link naar het waarom.
 *
 *   npm run dagboek              de stand per bestand, de grootste eerst
 *   npm run dagboek -- --basis   de basis opnieuw vastleggen (alleen omlaag)
 *
 * test/dagboek.test.ts faalt als een bestand er meer heeft dan zijn basis: nieuw werk schrijft geen datums of namen in
 * het commentaar, en wie een bestand aanraakt, mag het opruimen (dan kan de basis omlaag).
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = fileURLToPath(new URL('.', import.meta.url));
export const REPO = join(HIER, '..', '..');
export const BASIS = join(HIER, '..', 'test', 'dagboek-basis.json');
const MAPPEN = ['backend/src', 'frontend/src', 'frontend/kit'];
const MAAND = '(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)';
const DAGBOEK = new RegExp(`\\b\\d{1,2} ${MAAND}\\b|\\bRicardo\\b`, 'g');

/** Het commentaar van een bestand: /* *\/, // tot het eind van de regel, en <!-- --> in html. */
function commentaarVan(tekst: string): string[] {
  return [...tekst.matchAll(/\/\*[\s\S]*?\*\/|(?<![:'"`\\])\/\/[^\n]*|<!--[\s\S]*?-->/g)].map((m) => m[0]);
}

function bestanden(map: string): string[] {
  return readdirSync(map, { withFileTypes: true }).flatMap((e) => {
    const p = join(map, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : bestanden(p);
    return /\.(ts|js|css|html)$/.test(e.name) && !/\.(en|nl)\.js$/.test(e.name) ? [p] : [];
  });
}

/** Per bestand (pad vanaf de repo, met /) hoeveel datums en namen er in het commentaar staan. */
export function telDagboek(): Record<string, number> {
  const uit: Record<string, number> = {};
  for (const map of MAPPEN) {
    for (const p of bestanden(join(REPO, map))) {
      const n = commentaarVan(readFileSync(p, 'utf-8')).reduce((s, c) => s + (c.match(DAGBOEK)?.length ?? 0), 0);
      if (n) uit[relative(REPO, p).split('\\').join('/')] = n;
    }
  }
  return Object.fromEntries(Object.entries(uit).sort(([a], [b]) => a.localeCompare(b)));
}

export function leesBasis(): Record<string, number> {
  return existsSync(BASIS) ? (JSON.parse(readFileSync(BASIS, 'utf-8')) as Record<string, number>) : {};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const nu = telDagboek();
  const totaal = Object.values(nu).reduce((s, n) => s + n, 0);
  if (process.argv.includes('--basis')) {
    const basis = leesBasis();
    const meer = Object.entries(nu).filter(([b, n]) => existsSync(BASIS) && n > (basis[b] ?? 0));
    if (meer.length) {
      console.error(`De basis gaat alleen omlaag. Meer in: ${meer.map(([b, n]) => `${b} (${n}, basis ${basis[b] ?? 0})`).join(', ')}`);
      process.exit(1);
    }
    writeFileSync(BASIS, `${JSON.stringify(nu, null, 2)}\n`);
    console.log(`Basis vastgelegd: ${totaal} datums en namen in ${Object.keys(nu).length} bestanden.`);
  } else {
    console.log(`Dagboek in het commentaar: ${totaal} datums en namen in ${Object.keys(nu).length} bestanden.`);
    for (const [b, n] of Object.entries(nu).sort(([, x], [, y]) => y - x).slice(0, 20)) console.log(`  ${String(n).padStart(4)}  ${b}`);
  }
}
