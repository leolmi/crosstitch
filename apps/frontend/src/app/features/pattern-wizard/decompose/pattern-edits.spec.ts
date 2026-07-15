import { describe, expect, it } from 'vitest';
import { FlossColor } from '@crosstitch/floss-colors';
import { DecompositionResult } from './decompose';
import { paintCells, recolorEntry, rebuildFromCellColors } from './pattern-edits';

const RED: FlossColor = { dmc: '666', name: 'Red', hex: '#ff0000' };
const GREEN: FlossColor = { dmc: '700', name: 'Green', hex: '#00ff00' };
const BLUE: FlossColor = { dmc: '820', name: 'Blue', hex: '#0000ff' };

/** Costruisce un DecompositionResult da una matrice di colori (null = vuota). */
function build(rows: (FlossColor | null)[][]): DecompositionResult {
  const height = rows.length;
  const width = rows[0].length;
  return rebuildFromCellColors(width, height, rows.flat());
}

function paletteCodes(d: DecompositionResult): string[] {
  return d.palette.map((p) => p.color.dmc);
}

describe('rebuildFromCellColors', () => {
  it('conta le celle e assegna gli indici', () => {
    const d = build([
      [RED, RED],
      [GREEN, null],
    ]);
    expect(d.palette).toHaveLength(2);
    const red = d.palette.find((p) => p.color.dmc === '666');
    const green = d.palette.find((p) => p.color.dmc === '700');
    expect(red?.count).toBe(2);
    expect(green?.count).toBe(1);
    expect(d.cells[3]).toBe(-1);
  });
});

describe('recolorEntry', () => {
  it('sostituisce il colore in tutte le celle collegate', () => {
    const d = build([[RED, RED, GREEN]]);
    const redIndex = d.palette.findIndex((p) => p.color.dmc === '666');
    const result = recolorEntry(d, redIndex, BLUE);
    expect(paletteCodes(result).sort()).toEqual(['700', '820']);
    const blue = result.palette.find((p) => p.color.dmc === '820');
    expect(blue?.count).toBe(2);
  });

  it('fonde due voci quando il nuovo colore è già presente', () => {
    const d = build([[RED, GREEN, GREEN]]);
    const redIndex = d.palette.findIndex((p) => p.color.dmc === '666');
    const result = recolorEntry(d, redIndex, GREEN);
    expect(result.palette).toHaveLength(1);
    expect(result.palette[0].color.dmc).toBe('700');
    expect(result.palette[0].count).toBe(3);
    expect([...result.cells].every((c) => c === 0)).toBe(true);
  });

  it('ignora indici fuori intervallo', () => {
    const d = build([[RED]]);
    expect(recolorEntry(d, 5, BLUE)).toBe(d);
  });
});

describe('paintCells', () => {
  it('assegna un colore a celle vuote', () => {
    const d = build([[RED, null, null]]);
    const result = paintCells(d, [1], GREEN);
    expect(result.cells[1]).toBeGreaterThanOrEqual(0);
    const green = result.palette.find((p) => p.color.dmc === '700');
    expect(green?.count).toBe(1);
  });

  it('ripittura celle esistenti e rimuove i colori non più usati', () => {
    const d = build([[RED, GREEN]]);
    const result = paintCells(d, [0, 1], BLUE);
    expect(result.palette).toHaveLength(1);
    expect(result.palette[0].color.dmc).toBe('820');
    expect(result.palette[0].count).toBe(2);
  });

  it('cancella celle con newColor null', () => {
    const d = build([[RED, RED]]);
    const result = paintCells(d, [0], null);
    expect(result.cells[0]).toBe(-1);
    const red = result.palette.find((p) => p.color.dmc === '666');
    expect(red?.count).toBe(1);
  });
});
