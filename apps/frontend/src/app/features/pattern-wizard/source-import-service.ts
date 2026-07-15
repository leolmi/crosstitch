/**
 * Smistamento degli input del primo step: un file (o URL) può essere
 * un'immagine da importare come sorgente, oppure un nostro documento schema
 * da riaprire. Qui si decide quale dei due e si delega al servizio giusto,
 * così il source-step resta snello.
 */
import { inject, Injectable } from '@angular/core';
import { I18nService } from '../../i18n/i18n.service';
import { ImageSourceService } from './image-source-service';
import { PatternDraftStore } from './pattern-draft-store';
import { looksLikePatternFile } from './persistence/pattern-file';
import { PatternFileService } from './persistence/pattern-file-service';

@Injectable({ providedIn: 'root' })
export class SourceImportService {
  private readonly store = inject(PatternDraftStore);
  private readonly imageSource = inject(ImageSourceService);
  private readonly patternFiles = inject(PatternFileService);
  private readonly i18n = inject(I18nService);

  /**
   * Importa un file locale: immagine → sorgente; nostro documento → ricarica
   * lo schema; qualsiasi altra cosa → errore.
   */
  async importFile(file: File): Promise<void> {
    if (file.type.startsWith('image/')) {
      this.store.setSource(await this.imageSource.fromFile(file));
      this.patternFiles.resetTarget();
      return;
    }
    const text = await file.text();
    if (looksLikePatternFile(text)) {
      await this.patternFiles.load(text);
      return;
    }
    throw new Error(this.i18n.t('errors.unrecognized-file'));
  }

  /**
   * Importa da URL: prova prima a interpretarlo come nostro documento, poi
   * ricade sul caricamento come immagine (che gestisce CORS e proxy).
   */
  async importFromUrl(url: string): Promise<void> {
    const docText = await tryFetchPatternText(url);
    if (docText) {
      await this.patternFiles.load(docText);
      return;
    }
    this.store.setSource(await this.imageSource.fromUrl(url));
    this.patternFiles.resetTarget();
  }
}

/**
 * Scarica il contenuto di un URL e lo restituisce solo se è un nostro
 * documento; altrimenti null (per proseguire col caricamento come immagine).
 * Legge il corpo solo quando il content-type è testuale/JSON, per non
 * scaricare inutilmente immagini di grandi dimensioni.
 */
async function tryFetchPatternText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      return null;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('json') && !contentType.startsWith('text/')) {
      return null;
    }
    const text = await response.text();
    return looksLikePatternFile(text) ? text : null;
  } catch {
    // rete/CORS: si prosegue trattandolo come immagine
    return null;
  }
}
