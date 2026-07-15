/**
 * Salvataggio e apertura di uno schema come file locale autocontenuto.
 *
 * Usa la File System Access API (showSaveFilePicker/showOpenFilePicker) dove
 * disponibile — che consente di risalvare direttamente sullo stesso file — e
 * ripiega su download + input file sui browser che non la supportano
 * (Firefox, Safari). La (de)serializzazione delle immagini e della griglia
 * si appoggia alle funzioni pure di pattern-file.ts.
 */
import { inject, Injectable, signal } from '@angular/core';
import {
  EditedImage,
  PatternDecomposition,
  PatternDraftStore,
  SourceImage,
} from '../pattern-draft-store';
import {
  decodeCells,
  encodeCells,
  parsePatternFile,
  PatternFile,
  PatternFileError,
  PATTERN_FILE_EXTENSION,
  PATTERN_FILE_FORMAT,
  PATTERN_FILE_MIME,
  PATTERN_FILE_VERSION,
  SerializedDecomposition,
  SerializedEditedImage,
  SerializedSourceImage,
  toPatternFileName,
} from './pattern-file';

// --- Tipi minimi della File System Access API (assenti in lib.dom) ---------

interface FilePickerType {
  description?: string;
  accept: Record<string, string[]>;
}
interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerType[];
}
interface FileSystemWritableLike {
  write(data: Blob | string): Promise<void>;
  close(): Promise<void>;
}
interface FileSystemFileHandleLike {
  readonly name: string;
  createWritable(): Promise<FileSystemWritableLike>;
  queryPermission?(d: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(d: {
    mode: 'read' | 'readwrite';
  }): Promise<PermissionState>;
}
interface FileSystemWindow {
  showSaveFilePicker?(o?: SaveFilePickerOptions): Promise<FileSystemFileHandleLike>;
}

const PICKER_TYPE: FilePickerType = {
  description: 'Schema Crosstitch',
  accept: { [PATTERN_FILE_MIME]: [PATTERN_FILE_EXTENSION] },
};

@Injectable({ providedIn: 'root' })
export class PatternFileService {
  private readonly store = inject(PatternDraftStore);

  /** Handle del file associato: consente "Salva" senza richiedere di nuovo dove. */
  private handle: FileSystemFileHandleLike | null = null;

  /** Nome del file attualmente associato (per l'interfaccia); null se nessuno. */
  readonly fileName = signal<string | null>(null);

  /** Contatore incrementato a ogni apertura, per reagire al caricamento. */
  readonly loaded = signal(0);

  /** true se il browser offre i dialog nativi di salvataggio/apertura. */
  get supportsFileSystemAccess(): boolean {
    return typeof this.fsWindow.showSaveFilePicker === 'function';
  }

  private get fsWindow(): FileSystemWindow {
    return window as unknown as FileSystemWindow;
  }

  // --- Salvataggio -----------------------------------------------------------

  /**
   * Salva lo stato corrente. Alla prima volta chiede dove salvare (o scarica,
   * nel fallback); in seguito riscrive sullo stesso file, se il browser lo
   * consente. Restituisce false se l'utente annulla il dialog.
   */
  async save(explicitName?: string): Promise<boolean> {
    const name = explicitName?.trim() || this.deriveName();
    const json = JSON.stringify(await this.buildFile(name));
    const suggestedName = toPatternFileName(name);
    const picker = this.fsWindow.showSaveFilePicker;

    if (!picker) {
      this.downloadJson(json, suggestedName);
      this.fileName.set(suggestedName);
      return true;
    }

    let handle = this.handle;
    if (!handle) {
      try {
        handle = await picker.call(this.fsWindow, {
          suggestedName,
          types: [PICKER_TYPE],
        });
      } catch (error) {
        if (isAbort(error)) {
          return false;
        }
        throw error;
      }
    }
    if (!(await ensureWritable(handle))) {
      throw new PatternFileError(
        'errors.write-denied',
        'Permesso di scrittura sul file negato.',
      );
    }
    const writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
    this.handle = handle;
    this.fileName.set(handle.name);
    return true;
  }

  // --- Apertura --------------------------------------------------------------

  /**
   * Interpreta il testo di un file e idrata lo store. L'apertura passa dagli
   * input del primo step (SourceImportService), non da un picker dedicato.
   */
  async load(text: string): Promise<void> {
    const parsed = parsePatternFile(text);
    // un documento aperto non è ancora legato a un handle scrivibile
    this.resetTarget();
    this.store.hydrate({
      source: await deserializeSource(parsed.source),
      edited: await deserializeEdited(parsed.edited),
      decomposition: deserializeDecomposition(parsed.decomposition),
      title: parsed.name ?? '',
    });
    this.loaded.update((n) => n + 1);
  }

  /** Dissocia il file corrente: il prossimo salvataggio chiederà dove salvare. */
  resetTarget(): void {
    this.handle = null;
    this.fileName.set(null);
  }

  // --- Helpers ---------------------------------------------------------------

  /** Nome di default: file associato → nome dell'immagine → generico. */
  private deriveName(): string {
    const current = this.fileName();
    if (current) {
      const base = current.replace(/\.[^./\\]+$/, '').trim();
      if (base) {
        return base;
      }
    }
    const source = this.store.source()?.fileName;
    if (source) {
      const base = source.replace(/\.[^./\\]+$/, '').trim();
      if (base) {
        return base;
      }
    }
    return 'Schema punto croce';
  }

  private async buildFile(name: string): Promise<PatternFile> {
    const source = this.store.source();
    const edited = this.store.edited();
    const decomposition = this.store.decomposition();
    return {
      format: PATTERN_FILE_FORMAT,
      version: PATTERN_FILE_VERSION,
      savedAt: new Date().toISOString(),
      name: name.trim() || undefined,
      source: source ? await serializeSource(source) : null,
      edited: edited ? await serializeEdited(edited) : null,
      decomposition: decomposition
        ? serializeDecomposition(decomposition)
        : null,
    };
  }

  private downloadJson(json: string, filename: string): void {
    const blob = new Blob([json], { type: PATTERN_FILE_MIME });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function ensureWritable(
  handle: FileSystemFileHandleLike,
): Promise<boolean> {
  if (!handle.queryPermission) {
    return true;
  }
  const opts = { mode: 'readwrite' as const };
  if ((await handle.queryPermission(opts)) === 'granted') {
    return true;
  }
  return (
    !!handle.requestPermission &&
    (await handle.requestPermission(opts)) === 'granted'
  );
}

async function serializeSource(
  image: SourceImage,
): Promise<SerializedSourceImage> {
  return {
    dataUrl: await objectUrlToDataUrl(image.objectUrl),
    fileName: image.fileName,
    sourceUrl: image.sourceUrl,
    width: image.width,
    height: image.height,
    size: image.size,
  };
}

async function deserializeSource(
  s: SerializedSourceImage | null,
): Promise<SourceImage | null> {
  if (!s) {
    return null;
  }
  return {
    objectUrl: await dataUrlToObjectUrl(s.dataUrl),
    fileName: s.fileName,
    sourceUrl: s.sourceUrl,
    width: s.width,
    height: s.height,
    size: s.size,
  };
}

async function serializeEdited(
  image: EditedImage,
): Promise<SerializedEditedImage> {
  return {
    dataUrl: await objectUrlToDataUrl(image.objectUrl),
    width: image.width,
    height: image.height,
  };
}

async function deserializeEdited(
  e: SerializedEditedImage | null,
): Promise<EditedImage | null> {
  if (!e) {
    return null;
  }
  return {
    objectUrl: await dataUrlToObjectUrl(e.dataUrl),
    width: e.width,
    height: e.height,
  };
}

function serializeDecomposition(
  d: PatternDecomposition,
): SerializedDecomposition {
  return {
    width: d.width,
    height: d.height,
    cells: encodeCells(d.cells),
    palette: d.palette,
    settings: d.settings,
    widthCm: d.widthCm,
    heightCm: d.heightCm,
  };
}

function deserializeDecomposition(
  d: SerializedDecomposition | null,
): PatternDecomposition | null {
  if (!d) {
    return null;
  }
  return {
    width: d.width,
    height: d.height,
    cells: decodeCells(d.cells),
    palette: d.palette,
    settings: d.settings,
    widthCm: d.widthCm,
    heightCm: d.heightCm,
  };
}

/** blob object URL → data URL base64 (leggendo il blob in memoria). */
async function objectUrlToDataUrl(objectUrl: string): Promise<string> {
  const blob = await (await fetch(objectUrl)).blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(
        new PatternFileError('errors.image-read', 'Impossibile leggere l’immagine.'),
      );
    reader.readAsDataURL(blob);
  });
}

/** data URL base64 → nuovo blob object URL utilizzabile in canvas/img. */
async function dataUrlToObjectUrl(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  return URL.createObjectURL(blob);
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
