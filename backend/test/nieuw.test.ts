/*
 * De lijst met wat er per versie nieuw is staat sinds 24 november 2026 (besluit 340) als gegevens in src/nieuw.json.
 * TypeScript controleert die vorm daar niet meer; deze test wel: elke versie zoals de interface Nieuw hem wil.
 */
import { describe, expect, it } from 'vitest';
import { NIEUW, VERSIE } from '../src/version.js';

const SOORTEN = ['nieuw', 'beter', 'opgelost'] as const;
const UITKOMST = ['opgelost', 'instelling', 'later', 'dubbel', 'afgewezen', 'geenreactie'];
const isTeksten = (x: unknown): boolean => Array.isArray(x) && x.length > 0 && x.every((r) => typeof r === 'string' && r.trim() !== '');

describe('wat er nieuw is (src/nieuw.json, besluit 340)', () => {
  it('begint bij de versie van nu, de nieuwste eerst, zonder dubbele', () => {
    expect(NIEUW[0]?.versie).toBe(VERSIE);
    expect(new Set(NIEUW.map((n) => n.versie)).size).toBe(NIEUW.length);
  });

  it('heeft per versie alleen de velden van Nieuw, met de goede soort', () => {
    const fouten: string[] = [];
    for (const n of NIEUW as unknown as readonly Record<string, unknown>[]) {
      const naam = String(n['versie']);
      for (const k of Object.keys(n)) if (!['versie', 'datum', ...SOORTEN, 'en', 'meldingen'].includes(k)) fouten.push(`${naam}: onbekend veld ${k}`);
      if (!/^\d+\.\d+\.\d+$/.test(naam)) fouten.push(`${naam}: geen versienummer`);
      if (typeof n['datum'] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(n['datum'])) fouten.push(`${naam}: datum`);
      if (!SOORTEN.some((s) => n[s] != null)) fouten.push(`${naam}: geen nieuw, beter of opgelost`);
      for (const s of SOORTEN) if (n[s] != null && !isTeksten(n[s])) fouten.push(`${naam}: ${s} is geen lijst met teksten`);
      const en = n['en'] as Record<string, unknown> | undefined;
      if (en != null) {
        for (const k of Object.keys(en)) if (!(SOORTEN as readonly string[]).includes(k)) fouten.push(`${naam}: en.${k}`);
        for (const s of SOORTEN) if (en[s] != null && !isTeksten(en[s])) fouten.push(`${naam}: en.${s}`);
      }
      const m = n['meldingen'];
      if (m != null) {
        if (!Array.isArray(m)) fouten.push(`${naam}: meldingen`);
        else for (const u of m as Record<string, unknown>[]) {
          if (typeof u['code'] !== 'string' || !UITKOMST.includes(String(u['uitkomst']))) fouten.push(`${naam}: melding ${String(u['code'])}`);
          for (const k of Object.keys(u)) if (!['code', 'uitkomst', 'tekst', 'tekstEn', 'href', 'issue'].includes(k)) fouten.push(`${naam}: melding.${k}`);
          if (u['issue'] != null && typeof u['issue'] !== 'number') fouten.push(`${naam}: melding.issue`);
        }
      }
    }
    expect(fouten).toEqual([]);
  });
});
