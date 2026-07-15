/**
 * Operazioni pure su immagini RGBA rappresentate come buffer piatto.
 * Nessuna dipendenza dal DOM: tutte testabili in ambiente Node.
 */

export interface RawImage {
  width: number;
  height: number;
  /** RGBA, 4 byte per pixel, riga per riga */
  data: Uint8ClampedArray<ArrayBuffer>;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function createImage(width: number, height: number): RawImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function cloneImage(img: RawImage): RawImage {
  return { width: img.width, height: img.height, data: img.data.slice() };
}

export function rotate90(img: RawImage, direction: 'cw' | 'ccw'): RawImage {
  const { width: w, height: h, data: src } = img;
  const out = createImage(h, w);
  const dst = out.data;
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < h; x++) {
      // (x, y) nella destinazione h×w
      const srcX = direction === 'cw' ? y : w - 1 - y;
      const srcY = direction === 'cw' ? h - 1 - x : x;
      const s = (srcY * w + srcX) * 4;
      const d = (y * h + x) * 4;
      dst[d] = src[s];
      dst[d + 1] = src[s + 1];
      dst[d + 2] = src[s + 2];
      dst[d + 3] = src[s + 3];
    }
  }
  return out;
}

export function flipHorizontal(img: RawImage): RawImage {
  const { width: w, height: h, data: src } = img;
  const out = createImage(w, h);
  const dst = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + (w - 1 - x)) * 4;
      const d = (y * w + x) * 4;
      dst[d] = src[s];
      dst[d + 1] = src[s + 1];
      dst[d + 2] = src[s + 2];
      dst[d + 3] = src[s + 3];
    }
  }
  return out;
}

/** Ritaglia l'immagine sul rettangolo indicato (clampato ai bordi). */
export function cropImage(img: RawImage, rect: Rect): RawImage {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(img.width, Math.ceil(rect.x + rect.width));
  const y1 = Math.min(img.height, Math.ceil(rect.y + rect.height));
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const out = createImage(w, h);
  for (let y = 0; y < h; y++) {
    const srcStart = ((y0 + y) * img.width + x0) * 4;
    out.data.set(img.data.subarray(srcStart, srcStart + w * 4), y * w * 4);
  }
  return out;
}

/** Cancella (alpha 0) i pixel dentro il cerchio. Modifica l'immagine in place. */
export function eraseCircle(
  img: RawImage,
  cx: number,
  cy: number,
  radius: number,
): void {
  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(img.width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(img.height - 1, Math.ceil(cy + radius));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        img.data[(y * img.width + x) * 4 + 3] = 0;
      }
    }
  }
}

/** Cancella lungo il segmento tra due punti, con pennello circolare. */
export function eraseStroke(
  img: RawImage,
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
): void {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / Math.max(1, radius / 2)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    eraseCircle(img, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, radius);
  }
}

const MAX_RGB_DISTANCE = Math.sqrt(255 * 255 * 3);

/**
 * "Bacchetta magica": rende trasparenti i pixel simili al pixel cliccato.
 * Con `contiguous` limita l'effetto all'area connessa al punto di partenza,
 * altrimenti agisce su tutta l'immagine. Tolleranza 0-100.
 * Modifica l'immagine in place e restituisce il numero di pixel cancellati.
 */
export function floodErase(
  img: RawImage,
  startX: number,
  startY: number,
  tolerance: number,
  contiguous: boolean,
): number {
  const { width: w, height: h, data } = img;
  const x0 = Math.floor(startX);
  const y0 = Math.floor(startY);
  if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) {
    return 0;
  }
  const seed = (y0 * w + x0) * 4;
  if (data[seed + 3] === 0) {
    return 0;
  }
  const sr = data[seed];
  const sg = data[seed + 1];
  const sb = data[seed + 2];
  const maxDist2 = Math.pow((tolerance / 100) * MAX_RGB_DISTANCE, 2);

  const matches = (i: number): boolean => {
    if (data[i + 3] === 0) {
      return false;
    }
    const dr = data[i] - sr;
    const dg = data[i + 1] - sg;
    const db = data[i + 2] - sb;
    return dr * dr + dg * dg + db * db <= maxDist2;
  };

  let erased = 0;

  if (!contiguous) {
    for (let i = 0; i < data.length; i += 4) {
      if (matches(i)) {
        data[i + 3] = 0;
        erased++;
      }
    }
    return erased;
  }

  const visited = new Uint8Array(w * h);
  const stack: number[] = [y0 * w + x0];
  visited[y0 * w + x0] = 1;
  while (stack.length > 0) {
    const p = stack.pop() as number;
    const i = p * 4;
    if (!matches(i)) {
      continue;
    }
    data[i + 3] = 0;
    erased++;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0 && !visited[p - 1]) {
      visited[p - 1] = 1;
      stack.push(p - 1);
    }
    if (x < w - 1 && !visited[p + 1]) {
      visited[p + 1] = 1;
      stack.push(p + 1);
    }
    if (y > 0 && !visited[p - w]) {
      visited[p - w] = 1;
      stack.push(p - w);
    }
    if (y < h - 1 && !visited[p + w]) {
      visited[p + w] = 1;
      stack.push(p + w);
    }
  }
  return erased;
}
