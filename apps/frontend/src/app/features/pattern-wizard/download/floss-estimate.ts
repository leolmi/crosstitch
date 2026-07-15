/**
 * Stima (indicativa) del consumo di filato per colore.
 *
 * Il consumo reale dipende da capi usati, count della tela e spreco
 * (partenze, fermature, filo sul retro). Il modello è geometrico e regolabile.
 */

const CM_PER_INCH = 2.54;
/** Percorso del filo per punto ≈ 2 diagonali sul davanti + ~1 sul retro. */
const PATH_FACTOR = 4.24;
const STRANDS_PER_SKEIN = 6;
/** Lunghezza standard di una matassina DMC/Anchor (filo a 6 capi). */
export const DEFAULT_SKEIN_METERS = 8;
export const DEFAULT_WASTE = 0.15;

export interface FlossEstimateParams {
  stitches: number;
  /** Punti per pollice della tela (count). */
  fabricCount: number;
  /** Numero di capi usati per ricamare. */
  strands: number;
  skeinMeters?: number;
  wasteFactor?: number;
}

export interface FlossEstimate {
  /** Metri di filo (ai capi indicati) effettivamente ricamati. */
  meters: number;
  /** Matassine da acquistare (arrotondate per eccesso). */
  skeins: number;
}

export function estimateFloss(params: FlossEstimateParams): FlossEstimate {
  const { stitches, fabricCount, strands } = params;
  if (stitches <= 0 || fabricCount <= 0 || strands <= 0) {
    return { meters: 0, skeins: 0 };
  }
  const skeinMeters = params.skeinMeters ?? DEFAULT_SKEIN_METERS;
  const waste = params.wasteFactor ?? DEFAULT_WASTE;

  const cellCm = CM_PER_INCH / fabricCount;
  const pathPerStitchM = (cellCm * PATH_FACTOR * (1 + waste)) / 100;
  const meters = stitches * pathPerStitchM;

  // consumo grezzo in "metri-capo" rapportato alla capacità della matassina
  const strandMeters = meters * strands;
  const skeinCapacity = skeinMeters * STRANDS_PER_SKEIN;
  const skeins = Math.max(1, Math.ceil(strandMeters / skeinCapacity));

  return { meters, skeins };
}
