/**
 * Modifiche manuali allo schema scomposto: ripitturazione di singole celle e
 * sostituzione di un colore dell'intera legenda. Funzioni pure che ricostruiscono
 * palette e conteggi (fondendo colori uguali e rimuovendo quelli inutilizzati).
 */
import { FlossColor } from '@crosstitch/floss-colors';
import { DecompositionResult, PaletteEntry } from './decompose';

/** Ricostruisce palette e conteggi da un colore per cella (null = non ricamata). */
export function rebuildFromCellColors(
  width: number,
  height: number,
  cellColors: readonly (FlossColor | null)[],
): DecompositionResult {
  const indexByDmc = new Map<string, number>();
  const palette: PaletteEntry[] = [];
  const cells = new Int16Array(width * height).fill(-1);
  for (let i = 0; i < cellColors.length; i++) {
    const color = cellColors[i];
    if (!color) {
      continue;
    }
    let index = indexByDmc.get(color.dmc);
    if (index === undefined) {
      index = palette.length;
      indexByDmc.set(color.dmc, index);
      palette.push({ color, count: 0 });
    }
    palette[index].count++;
    cells[i] = index;
  }
  return { width, height, cells, palette };
}

function toCellColors(d: DecompositionResult): (FlossColor | null)[] {
  const colors: (FlossColor | null)[] = new Array(d.cells.length);
  for (let i = 0; i < d.cells.length; i++) {
    const index = d.cells[i];
    colors[i] = index < 0 ? null : d.palette[index].color;
  }
  return colors;
}

/**
 * Sostituisce il colore di una voce di legenda: tutte le celle che lo usavano
 * passano a `newColor`. Se `newColor` è già presente, le voci si fondono.
 */
export function recolorEntry(
  d: DecompositionResult,
  entryIndex: number,
  newColor: FlossColor,
): DecompositionResult {
  if (entryIndex < 0 || entryIndex >= d.palette.length) {
    return d;
  }
  const targetDmc = d.palette[entryIndex].color.dmc;
  const cellColors = toCellColors(d).map((color) =>
    color && color.dmc === targetDmc ? newColor : color,
  );
  return rebuildFromCellColors(d.width, d.height, cellColors);
}

/**
 * Assegna `newColor` (o null per "non ricamata") alle celle indicate.
 */
export function paintCells(
  d: DecompositionResult,
  indices: Iterable<number>,
  newColor: FlossColor | null,
): DecompositionResult {
  const cellColors = toCellColors(d);
  for (const i of indices) {
    if (i >= 0 && i < cellColors.length) {
      cellColors[i] = newColor;
    }
  }
  return rebuildFromCellColors(d.width, d.height, cellColors);
}
