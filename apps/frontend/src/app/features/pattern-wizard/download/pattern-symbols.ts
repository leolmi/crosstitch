import { FlossColor } from '@crosstitch/floss-colors';

/**
 * Simboli distinti per la legenda e lo schema. Solo caratteri disponibili nel
 * set WinAnsi (font standard Helvetica di pdf-lib), scelti per essere ben
 * distinguibili tra loro anche a piccole dimensioni.
 */
export const PATTERN_SYMBOLS: readonly string[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'K', 'L',
  'M', 'N', 'P', 'R', 'S', 'T', 'V', 'X', 'Y', 'Z',
  'a', 'b', 'c', 'd', 'e', 'f', 'h', 'k', 'm', 'n',
  'p', 'r', 's', 't', 'v', 'y', 'z', '2', '3', '4',
  '5', '6', '7', '8', '9', '@', '#', '$', '%', '&',
  '=', '+', '?', '/', '\\', '<', '>', '~', '!', 'o',
];

/** Colore della palette con l'indice con cui è referenziato dalle celle. */
export interface OrderedEntry {
  color: FlossColor;
  count: number;
  /** indice nella palette originale (valore memorizzato nelle celle) */
  paletteIndex: number;
}

export interface SymbolAssignment extends OrderedEntry {
  symbol: string;
}

/**
 * Assegna un simbolo a ciascun colore, nell'ordine dato (quello con cui verrà
 * mostrata la legenda). Oltre i simboli disponibili riparte con suffisso numerico.
 */
export function assignSymbols(
  ordered: readonly OrderedEntry[],
): SymbolAssignment[] {
  return ordered.map((entry, i) => ({
    ...entry,
    symbol:
      i < PATTERN_SYMBOLS.length
        ? PATTERN_SYMBOLS[i]
        : `${PATTERN_SYMBOLS[i % PATTERN_SYMBOLS.length]}${Math.floor(i / PATTERN_SYMBOLS.length)}`,
  }));
}
