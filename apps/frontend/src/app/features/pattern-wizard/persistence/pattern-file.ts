/**
 * Formato del file schema salvato localmente e funzioni pure di
 * (de)serializzazione. Il file è un JSON autocontenuto che include tutte le
 * opzioni e l'immagine originale, così da poter essere riaperto per
 * modificare o rigenerare lo schema ("scambio o riutilizzo").
 *
 * Le parti non direttamente serializzabili in JSON vengono codificate:
 * - le immagini (blob in memoria) come data URL base64;
 * - la griglia `cells` (Int16Array) come base64 del suo buffer.
 *
 * Le funzioni qui non toccano il DOM e sono testabili in isolamento; la
 * conversione dei blob e l'I/O su file vivono in PatternFileService.
 */
import { TranslationKey } from '../../../i18n/it';
import { PaletteEntry } from '../decompose/decompose';
import { DecompositionSettings } from '../pattern-draft-store';

/** Marcatore di formato: distingue i nostri file da altri JSON. */
export const PATTERN_FILE_FORMAT = 'crosstitch-pattern';
/** Versione dello schema del file; incrementare a ogni cambio non compatibile. */
export const PATTERN_FILE_VERSION = 1;
/** Estensione dei file schema salvati localmente. */
export const PATTERN_FILE_EXTENSION = '.xstitch';
/** MIME type usato per il salvataggio. */
export const PATTERN_FILE_MIME = 'application/json';

/** Immagine sorgente serializzata: pixel come data URL, più i metadati. */
export interface SerializedSourceImage {
  /** data URL completo, es. "data:image/png;base64,…" */
  dataUrl: string;
  fileName?: string;
  sourceUrl?: string;
  width: number;
  height: number;
  size: number;
}

/** Immagine elaborata serializzata (PNG con trasparenza) come data URL. */
export interface SerializedEditedImage {
  dataUrl: string;
  width: number;
  height: number;
}

/** Scomposizione serializzata: la griglia come base64 dell'Int16Array. */
export interface SerializedDecomposition {
  width: number;
  height: number;
  /** base64 del buffer (little-endian) dell'Int16Array delle celle */
  cells: string;
  palette: PaletteEntry[];
  settings: DecompositionSettings;
  widthCm: number;
  heightCm: number;
}

/** Struttura completa del file schema (radice del JSON). */
export interface PatternFile {
  format: typeof PATTERN_FILE_FORMAT;
  version: number;
  /** timestamp ISO del salvataggio */
  savedAt: string;
  /** nome scelto dall'utente per lo schema, se presente */
  name?: string;
  source: SerializedSourceImage | null;
  edited: SerializedEditedImage | null;
  decomposition: SerializedDecomposition | null;
}

/**
 * Errore di caricamento con una chiave i18n (`code`) per il messaggio
 * localizzato; `message` resta un fallback tecnico in chiaro.
 */
export class PatternFileError extends Error {
  constructor(
    readonly code: TranslationKey,
    message: string,
  ) {
    super(message);
  }
}

/** Codifica il buffer di un Int16Array in base64 (endianness nativa). */
export function encodeCells(cells: Int16Array): string {
  return bytesToBase64(
    new Uint8Array(cells.buffer, cells.byteOffset, cells.byteLength),
  );
}

/** Decodifica una stringa base64 nell'Int16Array delle celle. */
export function decodeCells(base64: string): Int16Array {
  const bytes = base64ToBytes(base64);
  if (bytes.byteLength % Int16Array.BYTES_PER_ELEMENT !== 0) {
    throw new PatternFileError(
      'errors.data-corrupted',
      'Dati dello schema corrotti.',
    );
  }
  // il buffer di base64ToBytes parte da offset 0 ed è dedicato: uso diretto
  return new Int16Array(bytes.buffer);
}

/**
 * Valida e interpreta un testo JSON come PatternFile della versione
 * supportata. Solleva PatternFileError con un messaggio adatto all'utente.
 */
export function parsePatternFile(text: string): PatternFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new PatternFileError(
      'errors.file-not-json',
      'Il file non è un JSON valido.',
    );
  }
  if (!isRecord(raw) || raw['format'] !== PATTERN_FILE_FORMAT) {
    throw new PatternFileError(
      'errors.not-crosstitch',
      'Il file non è uno schema Crosstitch.',
    );
  }
  if (raw['version'] !== PATTERN_FILE_VERSION) {
    throw new PatternFileError(
      'errors.unsupported-version',
      `Versione del file non supportata (${String(raw['version'])}).`,
    );
  }
  if (
    !('source' in raw) ||
    !('edited' in raw) ||
    !('decomposition' in raw)
  ) {
    throw new PatternFileError(
      'errors.file-incomplete',
      'File schema incompleto o danneggiato.',
    );
  }
  return raw as unknown as PatternFile;
}

/**
 * Riconoscimento leggero: true se il testo è un JSON col nostro marcatore di
 * formato. Non valida versione né struttura completa (lo fa parsePatternFile
 * in fase di caricamento); serve solo a distinguere un nostro documento da
 * un'immagine quando si apre un file.
 */
export function looksLikePatternFile(text: string): boolean {
  try {
    const raw = JSON.parse(text) as { format?: unknown };
    return !!raw && raw.format === PATTERN_FILE_FORMAT;
  } catch {
    return false;
  }
}

/** Restituisce un nome file sicuro (senza caratteri non validi) + estensione. */
export function toPatternFileName(name: string): string {
  const cleaned = name
    .replace(/[/\\:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const base = cleaned || 'Schema punto croce';
  return base.endsWith(PATTERN_FILE_EXTENSION)
    ? base
    : `${base}${PATTERN_FILE_EXTENSION}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Converte byte in base64 a blocchi, evitando lo stack overflow da spread. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Converte base64 in un Uint8Array con buffer dedicato (offset 0). */
function base64ToBytes(base64: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new PatternFileError(
      'errors.data-corrupted',
      'Dati dello schema corrotti.',
    );
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
