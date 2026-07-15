/**
 * Scomposizione dell'immagine in schema punto croce: quantizzazione dei
 * colori (median-cut) e aggancio alla palette di filati più vicina
 * (distanza percettiva CIEDE2000). Funzioni pure, testabili senza DOM.
 */
import { createFlossMatcher, FlossColor } from '@crosstitch/floss-colors';
import { RawImage } from '../editor/raw-image';

/** Celle con alpha sotto questa soglia diventano "non ricamate". */
const ALPHA_THRESHOLD = 128;

export interface PaletteEntry {
  color: FlossColor;
  /** Numero di punti (celle) che usano questo colore */
  count: number;
}

export interface DecompositionResult {
  /** Larghezza della griglia in punti */
  width: number;
  /** Altezza della griglia in punti */
  height: number;
  /** Indice in `palette` per ogni cella (riga per riga); -1 = non ricamata */
  cells: Int16Array;
  palette: PaletteEntry[];
}

/**
 * Scompone l'immagine-griglia (1 pixel = 1 punto croce) in uno schema con al
 * massimo `maxColors` colori presi da `palette`.
 */
export function decompose(
  image: RawImage,
  maxColors: number,
  palette: readonly FlossColor[],
): DecompositionResult {
  const { width, height, data } = image;
  const total = width * height;
  const cells = new Int16Array(total).fill(-1);

  const opaque: number[] = [];
  for (let i = 0; i < total; i++) {
    if (data[i * 4 + 3] >= ALPHA_THRESHOLD) {
      opaque.push(i);
    }
  }
  if (opaque.length === 0) {
    return { width, height, cells, palette: [] };
  }

  const boxes = medianCut(data, opaque, Math.max(1, maxColors));
  const matcher = createFlossMatcher(palette);

  // centroide di ogni box → filato più vicino, con dedup dei filati uguali
  const byDmc = new Map<string, { entry: PaletteEntry; index: number }>();
  const entries: PaletteEntry[] = [];
  for (const box of boxes) {
    let r = 0;
    let g = 0;
    let b = 0;
    for (const idx of box) {
      r += data[idx * 4];
      g += data[idx * 4 + 1];
      b += data[idx * 4 + 2];
    }
    const n = box.length;
    const floss = matcher({
      r: Math.round(r / n),
      g: Math.round(g / n),
      b: Math.round(b / n),
    });
    let found = byDmc.get(floss.dmc);
    if (!found) {
      found = { entry: { color: floss, count: 0 }, index: entries.length };
      byDmc.set(floss.dmc, found);
      entries.push(found.entry);
    }
    found.entry.count += n;
    for (const idx of box) {
      cells[idx] = found.index;
    }
  }

  return { width, height, cells, palette: entries };
}

/**
 * Median-cut: partiziona i pixel indicati in al più `maxBoxes` gruppi,
 * dividendo ogni volta il gruppo con la maggiore escursione di canale.
 */
function medianCut(
  data: Uint8ClampedArray,
  indices: number[],
  maxBoxes: number,
): number[][] {
  const boxes: number[][] = [indices.slice()];
  while (boxes.length < maxBoxes) {
    let bestBox = -1;
    let bestRange = 0;
    let bestChannel = 0;
    for (let bi = 0; bi < boxes.length; bi++) {
      const box = boxes[bi];
      if (box.length < 2) {
        continue;
      }
      for (let c = 0; c < 3; c++) {
        let min = 255;
        let max = 0;
        for (const idx of box) {
          const v = data[idx * 4 + c];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        const range = max - min;
        if (range > bestRange) {
          bestRange = range;
          bestBox = bi;
          bestChannel = c;
        }
      }
    }
    // nessun gruppo divisibile: meno colori distinti di maxBoxes
    if (bestBox < 0 || bestRange === 0) {
      break;
    }
    const box = boxes[bestBox];
    box.sort((a, b) => data[a * 4 + bestChannel] - data[b * 4 + bestChannel]);
    const mid = box.length >> 1;
    boxes.splice(bestBox, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes;
}
