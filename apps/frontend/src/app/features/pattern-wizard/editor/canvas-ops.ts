/**
 * Operazioni immagine che richiedono il canvas del browser
 * (resampling, filtri CSS, codifica PNG).
 */
import { RawImage } from './raw-image';

export function rawToImageData(img: RawImage): ImageData {
  return new ImageData(img.data, img.width, img.height);
}

export function rawToCanvas(img: RawImage): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.putImageData(rawToImageData(img), 0, 0);
  return canvas;
}

function readCanvas(canvas: HTMLCanvasElement): RawImage {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: data.width, height: data.height, data: data.data };
}

/**
 * Decodifica un blob immagine in RawImage, ridimensionando se il lato
 * maggiore supera `maxSide` (limita memoria di lavoro e cronologia undo).
 */
export async function blobToRaw(blob: Blob, maxSide: number): Promise<RawImage> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    return readCanvas(canvas);
  } finally {
    bitmap.close();
  }
}

/** Ruota di un angolo arbitrario (gradi), espandendo il canvas per contenere il risultato. */
export function rotateByAngle(img: RawImage, degrees: number): RawImage {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const width = Math.max(1, Math.round(img.width * cos + img.height * sin));
  const height = Math.max(1, Math.round(img.width * sin + img.height * cos));

  const source = rawToCanvas(img);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(width / 2, height / 2);
  ctx.rotate(radians);
  ctx.drawImage(source, -img.width / 2, -img.height / 2);
  return readCanvas(canvas);
}

/** Applica un filtro CSS (brightness/contrast/saturate…) e restituisce il risultato. */
export function applyCssFilter(img: RawImage, filter: string): RawImage {
  const source = rawToCanvas(img);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.filter = filter;
  ctx.drawImage(source, 0, 0);
  return readCanvas(canvas);
}

/**
 * Ricampiona alle dimensioni indicate (usato per la griglia dello schema:
 * 1 pixel risultante = 1 punto croce, colore = media dell'area).
 */
export function resampleRaw(
  img: RawImage,
  width: number,
  height: number,
): RawImage {
  const source = rawToCanvas(img);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return readCanvas(canvas);
}

/** Codifica in PNG (preserva la trasparenza). */
export function rawToBlob(img: RawImage): Promise<Blob> {
  const canvas = rawToCanvas(img);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Impossibile codificare l’immagine.'));
      }
    }, 'image/png');
  });
}
