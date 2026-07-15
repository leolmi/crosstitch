import { describe, expect, it } from 'vitest';
import { deltaE2000, hexToRgb, rgbToLab } from './color-math';
import { FLOSS_COLORS } from './floss-colors.data';
import {
  createFlossMatcher,
  findByAnchor,
  findByDmc,
  nearestFlossColor,
} from './floss-colors';

describe('dataset FLOSS_COLORS', () => {
  it('contiene i colori attesi con codici DMC unici e hex validi', () => {
    expect(FLOSS_COLORS.length).toBe(456);
    const codes = new Set(FLOSS_COLORS.map((c) => c.dmc));
    expect(codes.size).toBe(FLOSS_COLORS.length);
    for (const color of FLOSS_COLORS) {
      expect(color.hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(color.name.length).toBeGreaterThan(0);
    }
  });

  it('mappa i codici Anchor noti', () => {
    expect(findByDmc('310')).toMatchObject({
      name: 'Black',
      hex: '#000000',
      anchor: '403',
    });
    expect(findByDmc('white')?.anchor).toBe('2');
    expect(findByAnchor('403')?.dmc).toBe('310');
  });
});

describe('color-math', () => {
  it('converte hex in RGB', () => {
    expect(hexToRgb('#ff8000')).toEqual({ r: 255, g: 128, b: 0 });
    expect(() => hexToRgb('#12345')).toThrow();
  });

  it('converte bianco e nero sRGB in Lab', () => {
    const white = rgbToLab({ r: 255, g: 255, b: 255 });
    expect(white.l).toBeCloseTo(100, 1);
    expect(white.a).toBeCloseTo(0, 1);
    expect(white.b).toBeCloseTo(0, 1);

    const black = rgbToLab({ r: 0, g: 0, b: 0 });
    expect(black.l).toBeCloseTo(0, 3);
  });

  it('calcola CIEDE2000 secondo i dati di test di Sharma et al.', () => {
    // Coppie 1-3 del dataset ufficiale CIEDE2000
    expect(
      deltaE2000(
        { l: 50, a: 2.6772, b: -79.7751 },
        { l: 50, a: 0, b: -82.7485 },
      ),
    ).toBeCloseTo(2.0425, 4);
    expect(
      deltaE2000(
        { l: 50, a: 3.1571, b: -77.2803 },
        { l: 50, a: 0, b: -82.7485 },
      ),
    ).toBeCloseTo(2.8615, 4);
    expect(
      deltaE2000(
        { l: 50, a: 2.8361, b: -74.02 },
        { l: 50, a: 0, b: -82.7485 },
      ),
    ).toBeCloseTo(3.4412, 4);
  });

  it('è simmetrica', () => {
    const lab1 = { l: 61.2, a: 12.4, b: -33.1 };
    const lab2 = { l: 40.7, a: -5.2, b: 18.9 };
    expect(deltaE2000(lab1, lab2)).toBeCloseTo(deltaE2000(lab2, lab1), 10);
  });
});

describe('nearestFlossColor', () => {
  it('trova il colore esatto quando presente in palette', () => {
    expect(nearestFlossColor('#000000').dmc).toBe('310');
    expect(nearestFlossColor('#ffffff').dmc).toBe('White');
  });

  it('trova un colore percettivamente vicino', () => {
    const nearRed = nearestFlossColor('#c00000');
    const lab = rgbToLab(hexToRgb(nearRed.hex));
    const target = rgbToLab(hexToRgb('#c00000'));
    expect(deltaE2000(lab, target)).toBeLessThan(10);
  });

  it('il matcher precalcolato dà gli stessi risultati', () => {
    const matcher = createFlossMatcher();
    expect(matcher({ r: 0, g: 0, b: 0 }).dmc).toBe('310');
    expect(matcher(hexToRgb('#1a5c3f')).dmc).toBe(
      nearestFlossColor('#1a5c3f').dmc,
    );
  });

  it('rifiuta una palette vuota', () => {
    expect(() => createFlossMatcher([])).toThrow();
  });
});
