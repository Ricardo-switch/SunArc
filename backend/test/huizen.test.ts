import { describe, expect, it } from 'vitest';

import { controleerHuis, geleden, leesUitvoer, scriptVoorHuis, tabel } from '../tools/huizen.js';

describe('de proefhuizen naast elkaar (besluit 336)', () => {
  const huis = { naam: 'Ouders', ssh: '100.64.0.1', docker: 'sudo docker', container: 'app_x_hems_climate', poort: 8099 };

  it('neemt een huis aan, maar weigert tekens die op afstand iets anders doen', () => {
    expect(controleerHuis(huis)).toEqual(huis);
    expect(() => controleerHuis({ ...huis, container: "x'; rm -rf /" })).toThrow(/tekens/);
    expect(() => controleerHuis({ ...huis, docker: 'docker $(echo)' })).toThrow(/tekens/);
    expect(() => controleerHuis({ ...huis, poort: '8099' })).toThrow(/poort/);
  });

  it('leest alleen, en stuurt de code voor binnen de container als base64 mee', () => {
    const script = scriptVoorHuis();
    expect(script).toMatch(/base64 -d/);
    expect(script).not.toMatch(/\b(rm|restart|stop|kill|POST)\b/);
  });

  it('leest de uitvoer van een huis', () => {
    const api = {
      health: { versie: { nummer: '0.229.0', installatie: 'add-on', commit: '0635b9f' }, laatsteBesluitMs: 1_000 },
      vandaag: { zonWh: 3689, netAfWh: 7695, netTerugWh: 457, besluiten: 59, zones: 3, apparaten: 5 },
      vandaagStatus: 200,
      meldingen: 0,
      analyse: { dagen: 80, momenten: 10, failsafe: 2 },
    };
    const m = leesUitvoer('Ouders', [
      '** een waarschuwing van ssh',
      '@@container 2026-11-23T12:00:00Z|1|running',
      '@@stats 37.5MiB / 7.6GiB|0.03%',
      '@@fouten 5',
      `@@api ${JSON.stringify(api)}`,
    ].join('\n'));
    expect(m).toMatchObject({ bereikbaar: true, foutregels24u: 5, container: { herstarts: 1, staat: 'running' }, stats: { geheugen: '37.5MiB' } });
    expect(m.fout).toBeUndefined();
    const t = tabel([m], Date.parse('2026-11-23T12:30:00Z'));
    expect(t).toContain('0.229.0');
    expect(t).toMatch(/Zon vandaag\s+3,7 kWh/);
    expect(t).toMatch(/Draait sinds\s+30 min/);
  });

  it('zegt het als een huis niet bereikbaar is of geen container heeft', () => {
    expect(leesUitvoer('Weg', '').fout).toBe('niet bereikbaar');
    expect(leesUitvoer('Leeg', '@@container \n@@fouten 0').fout).toBe('container niet gevonden');
  });

  it('zegt kort hoe lang geleden', () => {
    expect(geleden(null, 0)).toBe('–');
    expect(geleden(0, 40_000)).toBe('40 s');
    expect(geleden(0, 12 * 60_000)).toBe('12 min');
    expect(geleden(0, 3 * 3_600_000)).toBe('3 u');
    expect(geleden(0, 2 * 86_400_000)).toBe('2 d');
  });
});
