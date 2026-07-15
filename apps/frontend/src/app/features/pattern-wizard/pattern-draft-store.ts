import { computed, Injectable, signal } from '@angular/core';
import { DecompositionResult } from './decompose/decompose';

/** Immagine di partenza scelta dall'utente per il nuovo schema. */
export interface SourceImage {
  /** Object URL locale (sempre same-origin, utilizzabile in canvas) */
  objectUrl: string;
  /** Nome file, se caricata dal PC */
  fileName?: string;
  /** URL di origine, se caricata da link */
  sourceUrl?: string;
  width: number;
  height: number;
  /** Dimensione in byte */
  size: number;
}

/** Immagine risultante dallo step di elaborazione (PNG con trasparenza). */
export interface EditedImage {
  objectUrl: string;
  width: number;
  height: number;
}

export type FlossStandard = 'dmc' | 'anchor';

/** Parametri scelti nello step di scomposizione. */
export interface DecompositionSettings {
  /** Punti per pollice della tela (count) */
  fabricCount: number;
  /** Larghezza del disegno in cm */
  widthCm: number;
  maxColors: number;
  standard: FlossStandard;
}

/** Schema calcolato: griglia di punti + palette filati + misure reali. */
export interface PatternDecomposition extends DecompositionResult {
  settings: DecompositionSettings;
  widthCm: number;
  heightCm: number;
}

/**
 * Stato (a signals) della bozza di schema in lavorazione nel wizard.
 * Gli step successivi (scomposizione, risultato) aggiungeranno qui i propri
 * dati.
 */
@Injectable({ providedIn: 'root' })
export class PatternDraftStore {
  private readonly _source = signal<SourceImage | null>(null);
  private readonly _edited = signal<EditedImage | null>(null);
  private readonly _decomposition = signal<PatternDecomposition | null>(null);
  private readonly _title = signal('');

  readonly source = this._source.asReadonly();
  readonly hasSource = computed(() => this._source() !== null);

  readonly edited = this._edited.asReadonly();
  readonly hasEdited = computed(() => this._edited() !== null);

  readonly decomposition = this._decomposition.asReadonly();
  readonly hasDecomposition = computed(
    () => (this._decomposition()?.palette.length ?? 0) > 0,
  );

  /**
   * Titolo del documento: segue il nome dell'immagine importata o quello del
   * documento aperto; modificabile solo nello step finale. Fonte unica per la
   * toolbar, il nome del PDF e il nome del file schema.
   */
  readonly title = this._title.asReadonly();

  setSource(image: SourceImage): void {
    this.revokeSource();
    this._source.set(image);
    // il titolo di default segue il nome dell'immagine appena importata
    this._title.set(deriveTitle(image));
    // una nuova sorgente invalida l'elaborazione precedente
    this.clearEdited();
  }

  clearSource(): void {
    this.revokeSource();
    this._source.set(null);
    this._title.set('');
    this.clearEdited();
  }

  setEdited(image: EditedImage): void {
    this.revokeEdited();
    this._edited.set(image);
    // una nuova elaborazione invalida la scomposizione precedente
    this._decomposition.set(null);
  }

  clearEdited(): void {
    this.revokeEdited();
    this._edited.set(null);
    this._decomposition.set(null);
  }

  setDecomposition(decomposition: PatternDecomposition): void {
    this._decomposition.set(decomposition);
  }

  /** Aggiorna il titolo del documento (modificabile nello step finale). */
  setTitle(title: string): void {
    this._title.set(title);
  }

  /**
   * Ricarica in blocco uno stato completo (tipicamente da file), sostituendo
   * sorgente/elaborazione/scomposizione senza le invalidazioni a cascata di
   * setSource/setEdited. Revoca gli object URL correnti prima di sostituirli.
   */
  hydrate(state: {
    source: SourceImage | null;
    edited: EditedImage | null;
    decomposition: PatternDecomposition | null;
    title: string;
  }): void {
    this.revokeSource();
    this.revokeEdited();
    this._source.set(state.source);
    this._edited.set(state.edited);
    this._decomposition.set(state.decomposition);
    this._title.set(state.title);
  }

  private revokeSource(): void {
    const current = this._source();
    if (current) {
      URL.revokeObjectURL(current.objectUrl);
    }
  }

  private revokeEdited(): void {
    const current = this._edited();
    if (current) {
      URL.revokeObjectURL(current.objectUrl);
    }
  }
}

/** Titolo di default dalla sorgente: nome file o ultimo segmento dell'URL. */
function deriveTitle(image: SourceImage): string {
  if (image.fileName) {
    const base = stripExtension(image.fileName);
    if (base) {
      return base;
    }
  }
  if (image.sourceUrl) {
    try {
      const path = new URL(image.sourceUrl).pathname;
      const last = decodeURIComponent(
        path.substring(path.lastIndexOf('/') + 1),
      );
      const base = stripExtension(last);
      if (base) {
        return base;
      }
    } catch {
      // URL non interpretabile: nessun titolo derivato
    }
  }
  return '';
}

function stripExtension(name: string): string {
  return name.replace(/\.[^./\\]+$/, '').trim();
}
