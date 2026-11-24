/*
 * Geen nieuw dagboek in de code (besluit 340): per bestand niet meer datums of namen in het commentaar dan de basis.
 * Het waarom staat in het besluitenlog; in de code staat wat het nu doet, eventueel met "(besluit N)".
 */
import { describe, expect, it } from 'vitest';
import { leesBasis, telDagboek } from '../tools/dagboek.js';

describe('geen dagboek in de code (besluit 340)', () => {
  it('heeft per bestand niet meer datums of namen in het commentaar dan de basis', () => {
    const basis = leesBasis();
    const meer = Object.entries(telDagboek())
      .filter(([b, n]) => n > (basis[b] ?? 0))
      .map(([b, n]) => `${b}: ${n} (basis ${basis[b] ?? 0}); haal de datum of naam uit het commentaar, het waarom hoort in DECISIONS.md`);
    expect(meer).toEqual([]);
  });
});
