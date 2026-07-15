import { describe, expect, it } from 'vitest';
import {
  decodeCells,
  encodeCells,
  parsePatternFile,
  PATTERN_FILE_EXTENSION,
  PATTERN_FILE_FORMAT,
  PATTERN_FILE_VERSION,
  PatternFile,
  PatternFileError,
  toPatternFileName,
} from './pattern-file';

describe('encodeCells / decodeCells', () => {
  it('esegue il round-trip mantenendo i valori (inclusi negativi)', () => {
    const cells = Int16Array.from([-1, 0, 1, 2, -1, 32767, -32768, 500]);
    const restored = decodeCells(encodeCells(cells));
    expect([...restored]).toEqual([...cells]);
  });

  it('gestisce una griglia vuota', () => {
    const restored = decodeCells(encodeCells(new Int16Array(0)));
    expect(restored).toHaveLength(0);
  });

  it('gestisce una griglia grande senza errori di stack', () => {
    const cells = new Int16Array(200 * 300);
    for (let i = 0; i < cells.length; i++) {
      cells[i] = (i % 61) - 1; // valori tra -1 e 59, con molti -1
    }
    const restored = decodeCells(encodeCells(cells));
    expect(restored.length).toBe(cells.length);
    expect(restored[0]).toBe(-1);
    expect(restored[cells.length - 1]).toBe(cells[cells.length - 1]);
  });

  it('rifiuta base64 con numero dispari di byte', () => {
    // 'AA==' decodifica in un solo byte: non allineabile a Int16 (2 byte)
    expect(() => decodeCells('AA==')).toThrow(PatternFileError);
  });
});

describe('parsePatternFile', () => {
  const valid: PatternFile = {
    format: PATTERN_FILE_FORMAT,
    version: PATTERN_FILE_VERSION,
    savedAt: '2026-07-15T00:00:00.000Z',
    name: 'Gatto',
    source: null,
    edited: null,
    decomposition: null,
  };

  it('accetta un file valido', () => {
    const parsed = parsePatternFile(JSON.stringify(valid));
    expect(parsed.name).toBe('Gatto');
    expect(parsed.format).toBe(PATTERN_FILE_FORMAT);
  });

  it('rifiuta un JSON non valido', () => {
    expect(() => parsePatternFile('{ non-json')).toThrow(PatternFileError);
  });

  it('rifiuta un formato diverso', () => {
    const other = JSON.stringify({ ...valid, format: 'qualcos-altro' });
    expect(() => parsePatternFile(other)).toThrow(PatternFileError);
  });

  it('rifiuta una versione non supportata', () => {
    const future = JSON.stringify({ ...valid, version: 999 });
    expect(() => parsePatternFile(future)).toThrow(PatternFileError);
  });

  it('rifiuta un file a cui mancano i campi principali', () => {
    const incomplete = JSON.stringify({
      format: PATTERN_FILE_FORMAT,
      version: PATTERN_FILE_VERSION,
      savedAt: valid.savedAt,
    });
    expect(() => parsePatternFile(incomplete)).toThrow(PatternFileError);
  });
});

describe('toPatternFileName', () => {
  it('aggiunge l’estensione e rimuove i caratteri non validi', () => {
    expect(toPatternFileName('Gatto: rosso/blu')).toBe(
      `Gatto rosso blu${PATTERN_FILE_EXTENSION}`,
    );
  });

  it('non duplica l’estensione se già presente', () => {
    const name = `Fiori${PATTERN_FILE_EXTENSION}`;
    expect(toPatternFileName(name)).toBe(name);
  });

  it('usa un nome di default se vuoto', () => {
    expect(toPatternFileName('   ')).toBe(
      `Schema punto croce${PATTERN_FILE_EXTENSION}`,
    );
  });
});
