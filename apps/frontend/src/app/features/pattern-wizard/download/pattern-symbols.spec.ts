import { describe, expect, it } from 'vitest';
import { FlossColor } from '@crosstitch/floss-colors';
import { assignSymbols, OrderedEntry, PATTERN_SYMBOLS } from './pattern-symbols';

function ordered(count: number): OrderedEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    color: { dmc: String(i), name: `Colore ${i}`, hex: '#000000' } as FlossColor,
    count: 1,
    paletteIndex: i,
  }));
}

describe('assignSymbols', () => {
  it('assegna simboli distinti entro il set disponibile', () => {
    const result = assignSymbols(ordered(5));
    const symbols = result.map((r) => r.symbol);
    expect(symbols).toEqual(PATTERN_SYMBOLS.slice(0, 5));
    expect(new Set(symbols).size).toBe(5);
  });

  it('mantiene l’indice di palette originale', () => {
    const input = ordered(3);
    const result = assignSymbols(input);
    expect(result.map((r) => r.paletteIndex)).toEqual([0, 1, 2]);
  });

  it('oltre il set disponibile aggiunge un suffisso numerico', () => {
    const n = PATTERN_SYMBOLS.length + 2;
    const result = assignSymbols(ordered(n));
    expect(new Set(result.map((r) => r.symbol)).size).toBe(n);
    expect(result[PATTERN_SYMBOLS.length].symbol).toBe(`${PATTERN_SYMBOLS[0]}1`);
  });
});
