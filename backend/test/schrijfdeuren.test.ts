/**
 * De deuren waardoor SunArc schrijft (besluit 348): `SECURITY.md` noemt elke
 * deur uit `SCHRIJFDEUREN`, en die lijst volgt de toetsen in `callService`.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { SCHRIJFDEUREN } from '../src/adapters/homeassistant/client.js';

const client = readFileSync(new URL('../src/adapters/homeassistant/client.ts', import.meta.url), 'utf8');
const security = readFileSync(new URL('../../SECURITY.md', import.meta.url), 'utf8');

describe('de deuren waardoor SunArc schrijft', () => {
  it('heeft voor elke toets in callService een regel, en geen regel zonder toets', () => {
    const begin = client.indexOf('async callService(');
    const eind = client.indexOf('if (!allowed)', begin);
    const toetsen = [...client.slice(begin, eind).matchAll(/\b(is[A-Z][A-Za-z]*Call)\(/g)].map((m) => m[1]);
    expect(new Set(toetsen)).toEqual(new Set(SCHRIJFDEUREN.map((d) => d.toets)));
  });

  it('staat met precies dezelfde zin in SECURITY.md', () => {
    for (const d of SCHRIJFDEUREN) expect(security, d.toets).toContain(`- ${d.en}\n`);
  });

  it('noemt in SECURITY.md niet meer deuren dan er zijn', () => {
    const deel = security.split('## What SunArc may write to Home Assistant')[1]!.split('\n## ')[0]!;
    const regels = deel.split('\n').filter((r) => r.startsWith('- '));
    expect(regels).toHaveLength(SCHRIJFDEUREN.length);
  });
});
