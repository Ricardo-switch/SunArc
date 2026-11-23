/**
 * Zet de proefhuizen naast elkaar (besluit 336): per huis de versie, hoe de
 * container erbij staat, wat SunArc vandaag deed en of er fouten in het
 * logboek staan.
 *
 *   npm run huizen            een tabel
 *   npm run huizen -- --json  de ruwe gegevens per huis
 *
 * Alleen lezen. Per huis via SSH: `docker inspect`, `stats` en `logs`, en
 * binnen de container een `fetch` naar de eigen api op 127.0.0.1 (zoals bij
 * HEMS_LOKAAL_LEZEN, besluit 311). Er wordt nooit iets geschreven.
 *
 * De lijst met huizen staat in `.claude/huizen.json` (of in het pad uit
 * HUIZEN). Die blijft lokaal: de repository is openbaar en de adressen horen
 * er niet in. Voorbeeld:
 *
 *   { "huizen": [
 *     { "naam": "Thuis", "ssh": "192.168.1.10", "docker": "sudo docker",
 *       "container": "hems-shadow", "poort": 8080 } ] }
 *
 * `ssh` is wat je achter `ssh` zou typen; gebruiker, sleutel en versleuteling
 * komen uit ~/.ssh/config.
 */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export interface Huis {
  naam: string;
  ssh: string;
  docker: string;
  container: string;
  poort: number;
}

export interface Meting {
  naam: string;
  bereikbaar: boolean;
  fout?: string;
  container?: { gestartOp: string; herstarts: number; staat: string };
  stats?: { geheugen: string; cpu: string };
  foutregels24u?: number;
  api?: ApiSamenvatting;
}

export interface ApiSamenvatting {
  health: {
    versie?: { nummer?: string; installatie?: string; commit?: string; gebouwd?: string };
    laatsteBesluitMs?: number | null;
  } | null;
  vandaag: {
    zonWh: number | null;
    netAfWh: number | null;
    netTerugWh: number | null;
    besluiten: number | null;
    zones: number | null;
    apparaten: number | null;
  } | null;
  vandaagStatus: number;
  meldingen: number | null;
  analyse: { dagen: number | null; momenten: number | null; failsafe: number | null } | null;
}

/** Wat binnen de container draait. Gewoon JavaScript: daar staat alleen Node. */
const BINNEN = `
const poort = process.argv[1];
const lees = async (pad) => {
  try {
    const r = await fetch('http://127.0.0.1:' + poort + pad, { signal: AbortSignal.timeout(30000) });
    return { status: r.status, json: r.ok ? await r.json() : null };
  } catch {
    return { status: 0, json: null };
  }
};
const lengte = (x) => (Array.isArray(x) ? x.length : null);
const getal = (x) => (typeof x === 'number' ? x : null);
(async () => {
  const [h, v, m, d] = await Promise.all(['/api/health', '/api/vandaag', '/api/meldingen', '/api/divergence'].map(lees));
  console.log(JSON.stringify({
    health: h.json,
    vandaag: v.json && {
      zonWh: getal(v.json.zonWh), netAfWh: getal(v.json.netAfWh), netTerugWh: getal(v.json.netTerugWh),
      besluiten: lengte(v.json.besluiten), zones: lengte(v.json.zones), apparaten: lengte(v.json.apparaten),
    },
    vandaagStatus: v.status,
    meldingen: m.json ? lengte(m.json.actief) : null,
    analyse: d.json && { dagen: lengte(d.json.dagen), momenten: getal(d.json.momenten), failsafe: getal(d.json.failsafeMomenten) },
  }));
})();
`;

/** Het script voor de shell van het huis. `$D` blijft ongequote: "sudo docker" zijn twee woorden. */
export function scriptVoorHuis(): string {
  const js = Buffer.from(BINNEN, 'utf-8').toString('base64');
  return [
    'D="$1"; C="$2"; P="$3"',
    `echo "@@container $($D inspect -f '{{.State.StartedAt}}|{{.RestartCount}}|{{.State.Status}}' "$C" 2>/dev/null)"`,
    `echo "@@stats $($D stats --no-stream --format '{{.MemUsage}}|{{.CPUPerc}}' "$C" 2>/dev/null)"`,
    `echo "@@fouten $($D logs --since 24h "$C" 2>&1 | grep -ciE 'fout|error|mislukt|exception')"`,
    `echo "@@api $($D exec "$C" node -e "$(echo ${js} | base64 -d)" "$P" 2>/dev/null)"`,
    '',
  ].join('\n');
}

const VEILIG = /^[\w./@:-]+( [\w./@:-]+)*$/;

/** Weigert een huis met tekens die in de opdracht op afstand iets anders zouden doen. */
export function controleerHuis(x: unknown): Huis {
  const h = x as Partial<Huis>;
  for (const veld of ['naam', 'ssh', 'docker', 'container'] as const) {
    if (typeof h[veld] !== 'string' || h[veld].length === 0) throw new Error(`huis zonder ${veld}: ${JSON.stringify(x)}`);
  }
  if (!Number.isInteger(h.poort)) throw new Error(`huis ${h.naam} zonder poort`);
  for (const veld of ['ssh', 'docker', 'container'] as const) {
    if (!VEILIG.test(h[veld]!)) throw new Error(`huis ${h.naam}: ${veld} bevat tekens die niet mogen`);
  }
  return h as Huis;
}

/** Leest wat het script terugschreef: regels die met @@ beginnen. */
export function leesUitvoer(naam: string, tekst: string): Meting {
  const regels = new Map<string, string>();
  for (const regel of tekst.split(/\r?\n/)) {
    const m = /^@@(\w+) ?(.*)$/.exec(regel);
    if (m) regels.set(m[1]!, m[2]!.trim());
  }
  const meting: Meting = { naam, bereikbaar: regels.size > 0 };
  const container = regels.get('container');
  if (container) {
    const [gestartOp = '', herstarts = '', staat = ''] = container.split('|');
    meting.container = { gestartOp, herstarts: Number(herstarts), staat };
  }
  const stats = regels.get('stats');
  if (stats) {
    const [geheugen = '', cpu = ''] = stats.split('|');
    meting.stats = { geheugen: geheugen.split('/')[0]!.trim(), cpu };
  }
  const fouten = regels.get('fouten');
  if (fouten !== undefined && /^\d+$/.test(fouten)) meting.foutregels24u = Number(fouten);
  const api = regels.get('api');
  if (api) {
    try {
      meting.api = JSON.parse(api) as ApiSamenvatting;
    } catch {
      meting.fout = 'de api gaf geen leesbaar antwoord';
    }
  }
  if (!meting.bereikbaar) meting.fout ??= 'niet bereikbaar';
  else if (!container) meting.fout ??= 'container niet gevonden';
  return meting;
}

function meet(huis: Huis): Promise<Meting> {
  return new Promise((resolve) => {
    const ssh = spawn('ssh', [
      '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', huis.ssh,
      `sh -s -- '${huis.docker}' '${huis.container}' '${huis.poort}'`,
    ]);
    let uit = '';
    let fout = '';
    const klok = setTimeout(() => ssh.kill(), 90_000);
    ssh.stdout.on('data', (b: Buffer) => (uit += b.toString('utf-8')));
    ssh.stderr.on('data', (b: Buffer) => (fout += b.toString('utf-8')));
    ssh.on('error', (e) => {
      clearTimeout(klok);
      resolve({ naam: huis.naam, bereikbaar: false, fout: e.message });
    });
    ssh.on('close', () => {
      clearTimeout(klok);
      const meting = leesUitvoer(huis.naam, uit);
      if (!meting.bereikbaar) {
        const reden = fout.split(/\r?\n/).find((r) => r.trim() && !r.startsWith('**'));
        if (reden) meting.fout = reden.trim();
      }
      resolve(meting);
    });
    ssh.stdin.end(scriptVoorHuis());
  });
}

const kwh = (wh: number | null | undefined) => (typeof wh === 'number' ? `${(wh / 1000).toFixed(1).replace('.', ',')} kWh` : '–');

/** Hoe lang geleden, kort: 40 s, 12 min, 3 u, 2 d. */
export function geleden(ms: number | null | undefined, nu: number): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '–';
  const s = Math.max(0, Math.round((nu - ms) / 1000));
  if (s < 90) return `${s} s`;
  if (s < 90 * 60) return `${Math.round(s / 60)} min`;
  if (s < 36 * 3600) return `${Math.round(s / 3600)} u`;
  return `${Math.round(s / 86400)} d`;
}

const getal = (n: number | null | undefined) => (typeof n === 'number' ? n.toLocaleString('nl-NL') : '–');

/** De tabel: per regel een getal, per kolom een huis. */
export function tabel(metingen: Meting[], nu: number): string {
  const rijen: [string, (m: Meting) => string][] = [
    ['Bereikbaar', (m) => (m.fout ? `nee: ${m.fout}` : 'ja')],
    ['Versie', (m) => m.api?.health?.versie?.nummer ?? '–'],
    ['Soort', (m) => m.api?.health?.versie?.installatie ?? '–'],
    ['Commit', (m) => m.api?.health?.versie?.commit ?? '–'],
    ['Container', (m) => m.container?.staat ?? '–'],
    ['Draait sinds', (m) => (m.container ? geleden(Date.parse(m.container.gestartOp), nu) : '–')],
    ['Herstarts', (m) => getal(m.container?.herstarts)],
    ['Geheugen', (m) => m.stats?.geheugen ?? '–'],
    ['Rekenkracht', (m) => m.stats?.cpu ?? '–'],
    ['Laatste besluit', (m) => geleden(m.api?.health?.laatsteBesluitMs, nu)],
    ['Besluiten vandaag', (m) => getal(m.api?.vandaag?.besluiten)],
    ['Zon vandaag', (m) => kwh(m.api?.vandaag?.zonWh)],
    ['Van het net', (m) => kwh(m.api?.vandaag?.netAfWh)],
    ['Teruggeleverd', (m) => kwh(m.api?.vandaag?.netTerugWh)],
    ['Zones', (m) => getal(m.api?.vandaag?.zones)],
    ['Apparaten', (m) => getal(m.api?.vandaag?.apparaten)],
    ['Meldingen open', (m) => getal(m.api?.meldingen)],
    ['Dagen in de analyse', (m) => getal(m.api?.analyse?.dagen)],
    ['Momenten noodstand', (m) => getal(m.api?.analyse?.failsafe)],
    ['Foutregels (24 u)', (m) => getal(m.foutregels24u)],
  ];
  const cellen = [['', ...metingen.map((m) => m.naam)], ...rijen.map(([label, f]) => [label, ...metingen.map(f)])];
  const breedtes = cellen[0]!.map((_, k) => Math.max(...cellen.map((r) => r[k]!.length)));
  const regel = (r: string[]) => r.map((c, k) => c.padEnd(breedtes[k]!)).join('   ').trimEnd();
  const streep = breedtes.map((b) => '─'.repeat(b)).join('   ');
  return [regel(cellen[0]!), streep, ...cellen.slice(1).map(regel)].join('\n');
}

async function main() {
  const pad = process.env.HUIZEN ?? fileURLToPath(new URL('../../.claude/huizen.json', import.meta.url));
  let lijst: unknown;
  try {
    lijst = JSON.parse(await readFile(pad, 'utf-8'));
  } catch (e) {
    console.error(`Kan de lijst met huizen niet lezen (${pad}): ${(e as Error).message}`);
    process.exitCode = 1;
    return;
  }
  const huizen = ((lijst as { huizen?: unknown[] }).huizen ?? []).map(controleerHuis);
  if (huizen.length === 0) {
    console.error(`Geen huizen in ${pad}.`);
    process.exitCode = 1;
    return;
  }
  const metingen = await Promise.all(huizen.map(meet));
  if (process.argv.includes('--json')) console.log(JSON.stringify(metingen, null, 2));
  else console.log(tabel(metingen, Date.now()));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
