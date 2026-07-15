import { describe, expect, it } from 'vitest';
import { FlossColor } from '@crosstitch/floss-colors';

/** jsdom non implementa Blob.arrayBuffer(): legge i byte via FileReader. */
function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}
import type { PatternDecomposition } from '../pattern-draft-store';
import { buildPatternPdf, computeChartTiles } from './pattern-pdf';
import { OrderedEntry } from './pattern-symbols';

const RED: FlossColor = { dmc: '666', name: 'Red', hex: '#ff0000', anchor: '46' };
const BLUE: FlossColor = { dmc: '820', name: 'Blue', hex: '#0000ff' };

function decomposition(): PatternDecomposition {
  // griglia 2×2: due celle rosse, una blu, una vuota
  const cells = new Int16Array([0, 1, -1, 0]);
  return {
    width: 2,
    height: 2,
    cells,
    palette: [
      { color: RED, count: 2 },
      { color: BLUE, count: 1 },
    ],
    settings: { fabricCount: 14, widthCm: 10, maxColors: 8, standard: 'dmc' },
    widthCm: 10,
    heightCm: 10,
  };
}

function ordered(d: PatternDecomposition): OrderedEntry[] {
  return d.palette.map((e, i) => ({
    color: e.color,
    count: e.count,
    paletteIndex: i,
  }));
}

/** i18n di prova: restituisce la chiave così com'è, lingua italiana. */
const i18n = { t: (key: string) => key, lang: 'it' };

describe('computeChartTiles', () => {
  it('esclude i riquadri privi di punti', () => {
    const width = 100;
    const height = 1;
    const cells = new Int16Array(width * height).fill(-1);
    cells[0] = 0; // un solo punto, nel primo riquadro
    const tiles = computeChartTiles({ width, height, cells });
    expect(tiles).toHaveLength(1);
    expect(tiles[0].index).toBe(1);
    expect(tiles[0].col0).toBe(0);
  });

  it('numera progressivamente i riquadri mantenuti', () => {
    const width = 100;
    const height = 1;
    const cells = new Int16Array(width * height).fill(0); // tutte piene
    const tiles = computeChartTiles({ width, height, cells });
    expect(tiles.length).toBeGreaterThan(1);
    expect(tiles.map((t) => t.index)).toEqual(tiles.map((_, i) => i + 1));
  });
});

describe('buildPatternPdf', () => {
  it('produce un PDF valido non vuoto', async () => {
    const d = decomposition();
    const blob = await buildPatternPdf({
      decomposition: d,
      ordered: ordered(d),
      title: 'Test schema',
      strands: 2,
      i18n,
    });
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);

    const bytes = await readBytes(blob);
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('non fallisce con molti colori (oltre il set di simboli)', async () => {
    const palette = Array.from({ length: 70 }, (_, i) => ({
      color: { dmc: String(i), name: `C${i}`, hex: '#123456' } as FlossColor,
      count: 1,
    }));
    const d: PatternDecomposition = {
      width: 70,
      height: 1,
      cells: Int16Array.from({ length: 70 }, (_, i) => i),
      palette,
      settings: { fabricCount: 14, widthCm: 20, maxColors: 70, standard: 'dmc' },
      widthCm: 20,
      heightCm: 1,
    };
    const blob = await buildPatternPdf({
      decomposition: d,
      ordered: ordered(d),
      title: 'Molti colori',
      strands: 2,
      i18n,
    });
    expect(blob.size).toBeGreaterThan(0);
  });
});
