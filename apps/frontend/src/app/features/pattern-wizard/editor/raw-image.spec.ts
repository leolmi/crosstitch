import { describe, expect, it } from 'vitest';
import {
  cloneImage,
  createImage,
  cropImage,
  eraseCircle,
  eraseStroke,
  flipHorizontal,
  floodErase,
  RawImage,
  rotate90,
} from './raw-image';

/** Crea un'immagine da una matrice di "colori" compatti [r,g,b,a]. */
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

function pixelAt(img: RawImage, x: number, y: number): number[] {
  const i = (y * img.width + x) * 4;
  return [...img.data.subarray(i, i + 4)];
}

const R = [255, 0, 0, 255];
const G = [0, 255, 0, 255];
const B = [0, 0, 255, 255];
const W = [255, 255, 255, 255];

describe('rotate90', () => {
  //  R G     ruotata in senso orario:  B R
  //  B W                               W G
  it('ruota in senso orario', () => {
    const img = fromPixels([
      [R, G],
      [B, W],
    ]);
    const out = rotate90(img, 'cw');
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    expect(pixelAt(out, 0, 0)).toEqual(B);
    expect(pixelAt(out, 1, 0)).toEqual(R);
    expect(pixelAt(out, 0, 1)).toEqual(W);
    expect(pixelAt(out, 1, 1)).toEqual(G);
  });

  it('cw e ccw sono inverse', () => {
    const img = fromPixels([[R, G, B]]);
    const out = rotate90(rotate90(img, 'cw'), 'ccw');
    expect(out).toEqual(img);
  });

  it('scambia larghezza e altezza', () => {
    const img = fromPixels([[R, G, B]]); // 3×1
    const out = rotate90(img, 'cw');
    expect(out.width).toBe(1);
    expect(out.height).toBe(3);
  });
});

describe('flipHorizontal', () => {
  it('specchia i pixel', () => {
    const img = fromPixels([[R, G, B]]);
    const out = flipHorizontal(img);
    expect(pixelAt(out, 0, 0)).toEqual(B);
    expect(pixelAt(out, 1, 0)).toEqual(G);
    expect(pixelAt(out, 2, 0)).toEqual(R);
  });
});

describe('cropImage', () => {
  it('estrae il rettangolo richiesto', () => {
    const img = fromPixels([
      [R, G, B],
      [B, W, R],
      [G, R, W],
    ]);
    const out = cropImage(img, { x: 1, y: 1, width: 2, height: 2 });
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    expect(pixelAt(out, 0, 0)).toEqual(W);
    expect(pixelAt(out, 1, 1)).toEqual(W);
    expect(pixelAt(out, 0, 1)).toEqual(R);
  });

  it('clampa il rettangolo ai bordi', () => {
    const img = fromPixels([
      [R, G],
      [B, W],
    ]);
    const out = cropImage(img, { x: -5, y: 1, width: 100, height: 100 });
    expect(out.width).toBe(2);
    expect(out.height).toBe(1);
    expect(pixelAt(out, 0, 0)).toEqual(B);
  });
});

describe('eraseCircle / eraseStroke', () => {
  it('azzera l’alpha dentro il cerchio', () => {
    const img = createImage(5, 5);
    img.data.fill(255);
    eraseCircle(img, 2, 2, 1);
    expect(pixelAt(img, 2, 2)[3]).toBe(0);
    expect(pixelAt(img, 1, 2)[3]).toBe(0);
    expect(pixelAt(img, 0, 0)[3]).toBe(255);
    expect(pixelAt(img, 4, 4)[3]).toBe(255);
  });

  it('la pennellata copre il segmento', () => {
    const img = createImage(10, 3);
    img.data.fill(255);
    eraseStroke(img, { x: 0, y: 1 }, { x: 9, y: 1 }, 1);
    for (let x = 0; x < 10; x++) {
      expect(pixelAt(img, x, 1)[3]).toBe(0);
    }
  });
});

describe('floodErase', () => {
  it('in modalità contigua cancella solo l’area connessa', () => {
    // Due zone bianche separate da una colonna rossa
    const img = fromPixels([
      [W, R, W],
      [W, R, W],
    ]);
    const erased = floodErase(img, 0, 0, 10, true);
    expect(erased).toBe(2);
    expect(pixelAt(img, 0, 0)[3]).toBe(0);
    expect(pixelAt(img, 0, 1)[3]).toBe(0);
    expect(pixelAt(img, 2, 0)[3]).toBe(255); // zona non connessa intatta
    expect(pixelAt(img, 1, 0)[3]).toBe(255); // colore diverso intatto
  });

  it('in modalità globale cancella tutti i pixel simili', () => {
    const img = fromPixels([
      [W, R, W],
      [W, R, W],
    ]);
    const erased = floodErase(img, 0, 0, 10, false);
    expect(erased).toBe(4);
    expect(pixelAt(img, 2, 1)[3]).toBe(0);
    expect(pixelAt(img, 1, 0)[3]).toBe(255);
  });

  it('la tolleranza include i colori vicini', () => {
    const almostWhite = [250, 250, 250, 255];
    const img = fromPixels([[W, almostWhite, B]]);
    expect(floodErase(cloneImage(img), 0, 0, 0, true)).toBe(1);
    const withTolerance = cloneImage(img);
    expect(floodErase(withTolerance, 0, 0, 5, true)).toBe(2);
    expect(pixelAt(withTolerance, 2, 0)[3]).toBe(255);
  });

  it('ignora i click fuori immagine o su pixel già trasparenti', () => {
    const img = createImage(2, 2);
    expect(floodErase(img, 5, 5, 50, true)).toBe(0);
    expect(floodErase(img, 0, 0, 50, true)).toBe(0); // alpha già 0
  });
});
