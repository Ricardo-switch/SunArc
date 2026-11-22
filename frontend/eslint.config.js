// De linter voor het script van de app (kwaliteitsronde stap 2, 17 november
// 2026). Zoals bij de dienst (besluit 57): regels die echte fouten vangen,
// geen stijlgids.
//
// De scripts zijn gewone browserscripts, geen modules: elke pagina laadt de
// kit, basis.js en zijn eigen script, en die delen namen op twee manieren: via
// `window` (app, t, iconen, huis, ...) en via een `const` bovenaan een bestand
// (dakvlakken, laden, ...), want gewone scripts delen hun bovenste laag. Die
// namen staan hieronder, zodat een verschreven naam wel opvalt. Een pagina mag
// een gedeelde naam voor iets eigens gebruiken (een eigen `zon` of `stand`):
// dat werkt in de browser, dus daar klaagt hij niet over.
//
// Alleen app.js (De motor, index.html) is een module.
import js from '@eslint/js';
import globals from 'globals';

const GEDEELD = [
  // Via window, uit de kit en basis.js.
  'app', 't', 'taal', 'iconen', 'nav', 'huis', 'huisMaat', 'huismodel', 'huistekenen', 'huistekenen3d', 'woningDeel', 'autoTekening', 'warmte', 'instellen', 'laden', 'thuisaccu',
  'waaier', 'zon', 'sankey', 'stromen', 'tekenaar', 'tedoen', 'stroomblad', 'stroomNu', 'stand', 'rondleiding', 'plannen',
  'paalblad', 'niemand', 'melden', 'luisteren', 'klaarstappen', 'hand', 'groep', 'gevoel', 'film', 'fasekaart', 'eigen',
  'buitenBlad', 'scThema', 'scVoorbeeldVerschil', 'huisModellen', 'huisVoor', 'huisThuis',
  // Via een const bovenaan een gedeeld script.
  'dakvlakken', 'laden', 'thuisaccu', 'vermogens', 'ligging', 'zekering', 'contract', 'ditScherm', 'weergaveDeel', 'htVloer', 'htBlad', 'htTeken', 'htGebaar',
];

const REGELS = {
  ...js.configs.recommended.rules,
  // Een eigen naam die ook gedeeld is, mag (zie boven).
  'no-redeclare': ['error', { builtinGlobals: false }],
  // Een lege catch is hier bewust: localStorage kan in een privévenster weigeren.
  'no-empty': ['error', { allowEmptyCatch: true }],
  // Een naam met een liggend streepje is met opzet ongebruikt; een gedeeld script zet zijn naam voor de anderen neer.
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_|^(' + GEDEELD.join('|') + ')$', caughtErrors: 'none', ignoreRestSiblings: true }],
};

export default [
  { ignores: ['node_modules/**'] },
  {
    files: ['src/**/*.js', 'kit/**/*.js'],
    ignores: ['src/app.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      // `open` is ook window.open; een pagina gebruikt het voor een eigen open-of-dicht.
      globals: { ...globals.browser, open: 'writable', ...Object.fromEntries(GEDEELD.map((n) => [n, 'writable'])) },
    },
    rules: REGELS,
  },
  {
    files: ['src/app.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser },
    rules: REGELS,
  },
  {
    files: ['build.js', 'eslint.config.js', 'typecheck.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: js.configs.recommended.rules,
  },
];
