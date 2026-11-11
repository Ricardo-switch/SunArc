import { describe, expect, it } from 'vitest';
import { KWARTIEREN, faseHistorie, fasenView, kwartierMax, piekVan } from '../src/web/fasen.js';

/** De fasekaart (besluit 302): de dag per kwartier, de piek, en zonder meters. */
const START = Date.UTC(2026, 10, 11, 23, 0) - 86_400_000; // middernacht in Amsterdam, 11 november
const MIN = 60_000;

describe('faseHistorie', () => {
  it('leest de korte vorm van Home Assistant, als grootte, zonder wat geen getal is', () => {
    const h = faseHistorie({
      'sensor.l1': [{ s: '4.2', lu: (START + MIN) / 1000 }, { s: 'unavailable', lu: (START + 2 * MIN) / 1000 }, { s: '-6', lu: (START + 3 * MIN) / 1000 }],
      'sensor.l2': 'onzin',
    });
    expect(h.get('sensor.l1')).toEqual([
      { ms: START + MIN, a: 4.2 },
      { ms: START + 3 * MIN, a: 6 },
    ]);
    expect(h.has('sensor.l2')).toBe(false);
  });
});

describe('kwartierMax', () => {
  it('neemt de stand van vóór een kwartier mee, en laat de toekomst leeg', () => {
    const punten = [
      { ms: START - 10 * MIN, a: 3 },
      { ms: START + 20 * MIN, a: 9 },
      { ms: START + 25 * MIN, a: 2 },
    ];
    const k = kwartierMax(punten, START, START + 50 * MIN);
    expect(k).toHaveLength(KWARTIEREN);
    expect(k.slice(0, 5)).toEqual([3, 9, 2, 2, null]);
  });

  it('is leeg zonder enige meting', () => {
    expect(kwartierMax([], START, START + 60 * MIN).every((x) => x == null)).toBe(true);
  });
});

describe('piekVan', () => {
  it('het hoogste van vandaag, en een hoge stand van gisteren telt als middernacht', () => {
    expect(piekVan([{ ms: START + 5 * MIN, a: 7 }, { ms: START + 9 * MIN, a: 12 }], START, START + 60 * MIN)).toEqual({ a: 12, ms: START + 9 * MIN });
    expect(piekVan([{ ms: START - MIN, a: 20 }, { ms: START + 9 * MIN, a: 12 }], START, START + 60 * MIN)).toEqual({ a: 20, ms: START });
    expect(piekVan([], START, START + 60 * MIN)).toBeNull();
  });
});

describe('fasenView', () => {
  const grid = { phases: [{ id: 'L1', current: 'sensor.l1', maxA: 25 }, { id: 'L2', current: 'sensor.l2', maxA: 25 }], marginA: 2 };

  it('per fase de stroom nu, de zekering, de piek en de dag; de stand van nu telt mee', () => {
    const v = fasenView({
      grid,
      nu: [{ id: 'L1', currentA: 18, bron: 'gemeten' }, { id: 'L2', currentA: null, bron: 'onbekend' }],
      historie: new Map([['sensor.l1', [{ ms: START + MIN, a: 5 }]]]),
      dagStartMs: START,
      nuMs: START + 40 * MIN,
      zekering: null,
      netW: null,
    });
    expect(v.meters).toBe(true);
    if (!v.meters) return;
    expect(v.margeA).toBe(2);
    expect(v.fasen[0]).toMatchObject({ id: 'L1', nuA: 18, zekeringA: 25, piekA: 18, piekMs: START + 40 * MIN });
    expect(v.fasen[0]!.dag.slice(0, 4)).toEqual([5, 5, 18, null]);
    expect(v.fasen[1]).toMatchObject({ id: 'L2', nuA: null, bron: 'onbekend', piekA: null });
  });

  it('zonder stroommeters per fase: de zekering uit Energie en het net', () => {
    const v = fasenView({ grid: null, nu: null, historie: new Map(), dagStartMs: START, nuMs: START, zekering: { fasen: 3, ampere: 25 }, netW: 5100 });
    expect(v).toEqual({ meters: false, zekering: { fasen: 3, ampere: 25 }, netW: 5100, margeA: 2 });
  });
});
