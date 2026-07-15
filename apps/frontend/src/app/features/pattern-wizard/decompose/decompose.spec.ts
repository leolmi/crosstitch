import { describe, expect, it } from 'vitest';
import { getFlossColors } from '@crosstitch/floss-colors';
import { createImage, RawImage } from '../editor/raw-image';
import { decompose } from './decompose';

function fromPixels(rows: number[][][]): RawImage {
  const height = rows.length;
  const width = rows[0].length;
  const img = createImage(width, height);
  rows.forEach((row, y) =>
    row.forEach((pixel, x) => {
      img.data.set(pixel, (y * width + x) * 4);
    }),
  );
  return img;
}

const BLACK = [0, 0, 0, 255];
const WHITE = [255, 255, 255, 255];
const TRASPARENTE = [0, 0, 0, 0];

describe('decompose', () => {
  it('mappa i colori esatti sui filati corrispondenti', () => {
    const img = fromPixels([
      [BLACK, WHITE],
      [WHITE, WHITE],
    ]);
    const result = decompose(img, 8, getFlossColors());
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.palette).toHaveLength(2);

    const codes = result.palette.map((p) => p.color.dmc).sort();
    expect(codes).toEqual(['310', 'White']);

    const black = result.palette.findIndex((p) => p.color.dmc === '310');
    const white = result.palette.findIndex((p) => p.color.dmc === 'White');
    expect(result.cells[0]).toBe(black);
    expect(result.cells[1]).toBe(white);
    expect(result.palette[white].count).toBe(3);
    expect(result.palette[black].count).toBe(1);
  });

  it('le celle trasparenti restano non ricamate (-1)', () => {
    const img = fromPixels([[BLACK, TRASPARENTE]]);
    const result = decompose(img, 4, getFlossColors());
    expect(result.cells[0]).not.toBe(-1);
    expect(result.cells[1]).toBe(-1);
    expect(result.palette.reduce((sum, p) => sum + p.count, 0)).toBe(1);
  });

  it('rispetta il numero massimo di colori', () => {
    // 4 colori ben distinti, ma maxColors = 2
    const img = fromPixels([
      [
        [255, 0, 0, 255],
        [0, 255, 0, 255],
        [0, 0, 255, 255],
        [255, 255, 0, 255],
      ],
    ]);
    const result = decompose(img, 2, getFlossColors());
    expect(result.palette.length).toBeLessThanOrEqual(2);
    for (const cell of result.cells) {
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThan(result.palette.length);
    }
  });

  it('immagine tutta trasparente → nessun colore', () => {
    const img = createImage(3, 3);
    const result = decompose(img, 10, getFlossColors());
    expect(result.palette).toHaveLength(0);
    expect([...result.cells].every((c) => c === -1)).toBe(true);
  });

  it('i conteggi coprono tutte le celle opache', () => {
    const img = createImage(10, 10);
    // gradiente sintetico opaco
    for (let i = 0; i < 100; i++) {
      img.data[i * 4] = Math.round((i / 99) * 255);
      img.data[i * 4 + 1] = 128;
      img.data[i * 4 + 2] = 255 - Math.round((i / 99) * 255);
      img.data[i * 4 + 3] = 255;
    }
    const result = decompose(img, 5, getFlossColors());
    expect(result.palette.length).toBeLessThanOrEqual(5);
    expect(result.palette.reduce((sum, p) => sum + p.count, 0)).toBe(100);
  });
});
