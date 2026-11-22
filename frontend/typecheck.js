/**
 * De typecontrole op het script van de app (kwaliteitsronde stap 2, 17
 * november 2026).
 *
 *   npm run typecheck              controleren tegen de basis
 *   npm run typecheck -- --basis   de basis opnieuw vastleggen (alleen omlaag)
 *
 * De scripts zijn gewone browserscripts die elke pagina in een eigen rij
 * laadt. Lees je ze allemaal als één programma, dan botst de `const esc` van
 * Thuis met die van Energie. Daarom controleert dit per pagina: de scripts uit
 * de <script>-regels van die pagina, in hun volgorde, als één programma, zoals
 * de browser ze ziet.
 *
 * Wat de kit en basis.js op `window` zetten (app, t, huis, ...), kent
 * TypeScript niet als losse naam; die krijgen hier een `declare var` met type
 * any, behalve op een pagina die de naam zelf al gebruikt.
 *
 * Er staan nog meldingen open uit de tijd zonder controle. Die staan per
 * bestand in typecheck-basis.json; de controle faalt als een bestand er meer
 * heeft dan zijn basis (een nieuwe fout), en zegt het als het er minder zijn
 * (dan kan de basis omlaag). Zo gaat het aantal alleen omlaag, tot nul.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const hier = dirname(fileURLToPath(import.meta.url));
const SRC = join(hier, 'src');
const KIT = join(hier, 'kit');
const BASIS = join(hier, 'typecheck-basis.json');
const opnieuw = process.argv.includes('--basis');

/** De namen die de kit en basis.js op window zetten (zie ook eslint.config.js). */
const OP_WINDOW = [
  'app', 't', 'taal', 'iconen', 'nav', 'huis', 'huisMaat', 'huismodel', 'huistekenen', 'huistekenen3d', 'woningDeel', 'autoTekening', 'warmte', 'instellen', 'laden', 'thuisaccu',
  'waaier', 'zon', 'sankey', 'stromen', 'tekenaar', 'tedoen', 'stroomblad', 'stroomNu', 'stand', 'rondleiding', 'plannen',
  'paalblad', 'niemand', 'melden', 'luisteren', 'klaarstappen', 'hand', 'groep', 'gevoel', 'film', 'fasekaart', 'eigen',
  'buitenBlad', 'scThema', 'scVoorbeeldVerschil', 'qrcode', 'huisModellen', 'huisVoor', 'huisThuis', 'weergaveDeel',
];

const OPTIES = {
  allowJs: true,
  checkJs: true,
  noEmit: true,
  target: ts.ScriptTarget.ES2023,
  lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  strict: false,
  skipLibCheck: true,
  types: [],
};

/** De scripts van een pagina, in volgorde; alleen gewone scripts uit src en kit. */
function scriptsVan(html) {
  const lijst = [];
  for (const m of html.matchAll(/<script\b([^>]*)>/g)) {
    const src = /\bsrc="([^"]+)"/.exec(m[1])?.[1];
    if (!src || /type="module"/.test(m[1])) continue;
    const pad = src.startsWith('kit/') ? join(KIT, src.slice(4)) : join(SRC, src);
    if (existsSync(pad)) lijst.push(pad);
  }
  return lijst;
}

/** De namen die bovenaan een script gedeclareerd worden (const, let, var, function, class). */
function bovensteNamen(bestand, tekst) {
  const sf = ts.createSourceFile(bestand, tekst, ts.ScriptTarget.ES2023, false, ts.ScriptKind.JS);
  const namen = new Set();
  const voeg = (n) => {
    if (ts.isIdentifier(n)) namen.add(n.text);
    else if (ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n)) for (const e of n.elements) if (!ts.isOmittedExpression(e)) voeg(e.name);
  };
  for (const s of sf.statements) {
    if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) voeg(d.name);
    else if ((ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s)) && s.name) namen.add(s.name.text);
  }
  return namen;
}

const teksten = new Map();
const lees = (p) => {
  if (!teksten.has(p)) teksten.set(p, readFileSync(p, 'utf-8'));
  return teksten.get(p);
};
const bronnen = new Map();
const host = ts.createCompilerHost(OPTIES);
const gewoon = host.getSourceFile.bind(host);
host.getSourceFile = (naam, taal) => {
  if (naam.endsWith('__gedeeld.d.ts')) return undefined;
  if (!bronnen.has(naam)) bronnen.set(naam, gewoon(naam, taal));
  return bronnen.get(naam);
};

const paginas = readdirSync(SRC).filter((n) => n.endsWith('.html')).sort();
const gezien = new Map();
for (const pagina of paginas) {
  const scripts = scriptsVan(await readFile(join(SRC, pagina), 'utf-8'));
  if (!scripts.length) continue;
  const eigen = new Set(scripts.flatMap((p) => [...bovensteNamen(p, lees(p))]));
  const decl = `${OP_WINDOW.filter((n) => !eigen.has(n)).map((n) => `declare var ${n}: any;`).join('\n')}\ninterface Window { [naam: string]: any }\n`;
  // TypeScript werkt met schuine strepen naar rechts, ook op Windows.
  const declNaam = join(hier, `${pagina}.__gedeeld.d.ts`).split('\\').join('/');
  const h = { ...host, getSourceFile: (naam, taal) => (naam === declNaam ? ts.createSourceFile(naam, decl, taal) : host.getSourceFile(naam, taal)), fileExists: (n) => n === declNaam || host.fileExists(n) };
  const programma = ts.createProgram({ rootNames: [declNaam, ...scripts], options: OPTIES, host: h });
  for (const d of ts.getPreEmitDiagnostics(programma)) {
    if (!d.file || d.file.fileName === declNaam) continue;
    const sleutel = `${d.file.fileName}:${d.start}:${d.code}`;
    if (gezien.has(sleutel)) continue;
    const { line } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
    gezien.set(sleutel, { bestand: relative(hier, d.file.fileName).split('\\').join('/'), regel: line + 1, code: d.code, tekst: ts.flattenDiagnosticMessageText(d.messageText, ' ') });
  }
}

const meldingen = [...gezien.values()].sort((a, b) => a.bestand.localeCompare(b.bestand) || a.regel - b.regel);
const perBestand = {};
for (const m of meldingen) perBestand[m.bestand] = (perBestand[m.bestand] ?? 0) + 1;

if (process.argv.includes('--lijst')) for (const m of meldingen) console.log(`${m.bestand}:${m.regel}  TS${m.code}  ${m.tekst.slice(0, 160)}`);

const basis = existsSync(BASIS) ? JSON.parse(await readFile(BASIS, 'utf-8')) : {};
const meer = Object.entries(perBestand).filter(([b, n]) => n > (basis[b] ?? 0));
const minder = Object.entries(basis).filter(([b, n]) => (perBestand[b] ?? 0) < n);
const totaal = meldingen.length;

if (opnieuw) {
  if (meer.length && existsSync(BASIS)) {
    console.error(`De basis gaat alleen omlaag. Meer dan de basis in: ${meer.map(([b, n]) => `${b} (${n}, basis ${basis[b] ?? 0})`).join(', ')}`);
    process.exit(1);
  }
  await writeFile(BASIS, `${JSON.stringify(Object.fromEntries(Object.entries(perBestand).sort()), null, 2)}\n`);
  console.log(`Basis vastgelegd: ${totaal} meldingen in ${Object.keys(perBestand).length} bestanden.`);
  process.exit(0);
}

console.log(`Typecontrole van de app: ${totaal} meldingen open (basis ${Object.values(basis).reduce((s, n) => s + n, 0)}), ${paginas.length} pagina's.`);
if (minder.length) console.log(`Minder dan de basis in ${minder.map(([b]) => b).join(', ')}: zet hem omlaag met npm run typecheck -- --basis.`);
if (meer.length) {
  console.error('Nieuwe meldingen:');
  for (const [b] of meer) for (const m of meldingen.filter((x) => x.bestand === b)) console.error(`  ${m.bestand}:${m.regel}  TS${m.code}  ${m.tekst.slice(0, 200)}`);
  process.exit(1);
}
