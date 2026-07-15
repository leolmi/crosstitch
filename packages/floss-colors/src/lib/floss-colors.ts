import { FlossColor } from './floss-color.model';
import { FLOSS_COLORS } from './floss-colors.data';
import { deltaE2000, hexToRgb, Lab, Rgb, rgbToLab } from './color-math';

/** Catalogo completo dei colori DMC (con codice Anchor dove noto). */
export function getFlossColors(): readonly FlossColor[] {
  return FLOSS_COLORS;
}

export function findByDmc(code: string): FlossColor | undefined {
  const normalized = code.trim().toLowerCase();
  return FLOSS_COLORS.find((c) => c.dmc.toLowerCase() === normalized);
}

export function findByAnchor(code: string): FlossColor | undefined {
  const normalized = code.trim();
  return FLOSS_COLORS.find((c) => c.anchor === normalized);
}

export type FlossMatcher = (color: Rgb) => FlossColor;

/**
 * Prepara un matcher "colore più vicino" (distanza CIEDE2000) sulla palette
 * indicata, precalcolando i valori Lab. Da usare per lavorazioni massive
 * (es. quantizzazione di un'immagine pixel per pixel).
 */
export function createFlossMatcher(
  palette: readonly FlossColor[] = FLOSS_COLORS,
): FlossMatcher {
  if (palette.length === 0) {
    throw new Error('La palette non può essere vuota');
  }
  const labs: Lab[] = palette.map((c) => rgbToLab(hexToRgb(c.hex)));
  return (color: Rgb): FlossColor => {
    const lab = rgbToLab(color);
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < labs.length; i++) {
      const distance = deltaE2000(lab, labs[i]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    return palette[bestIndex];
  };
}

/** Colore di filato più vicino (CIEDE2000) a un colore dato. */
export function nearestFlossColor(
  color: string | Rgb,
  palette: readonly FlossColor[] = FLOSS_COLORS,
): FlossColor {
  const rgb = typeof color === 'string' ? hexToRgb(color) : color;
  return createFlossMatcher(palette)(rgb);
}
