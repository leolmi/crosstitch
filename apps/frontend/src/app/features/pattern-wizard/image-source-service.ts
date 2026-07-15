import { inject, Injectable } from '@angular/core';
import { I18nService } from '../../i18n/i18n.service';
import { SourceImage } from './pattern-draft-store';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** Carica immagini da file locale o da URL e le normalizza in SourceImage. */
@Injectable({ providedIn: 'root' })
export class ImageSourceService {
  private readonly i18n = inject(I18nService);

  async fromFile(file: File): Promise<SourceImage> {
    if (!file.type.startsWith('image/')) {
      throw new Error(this.i18n.t('errors.not-an-image'));
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(this.i18n.t('errors.image-too-large'));
    }
    return this.toSourceImage(file, { fileName: file.name });
  }

  async fromUrl(url: string): Promise<SourceImage> {
    const parsed = this.parseHttpUrl(url);
    const blob = await this.fetchImageBlob(parsed.href);
    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error(this.i18n.t('errors.image-too-large'));
    }
    return this.toSourceImage(blob, { sourceUrl: parsed.href });
  }

  private parseHttpUrl(url: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      throw new Error(this.i18n.t('errors.url-invalid'));
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(this.i18n.t('errors.url-http-only'));
    }
    return parsed;
  }

  /**
   * Prova il download diretto (funziona se il server remoto espone CORS),
   * altrimenti passa dal proxy del backend per evitare il canvas "tainted".
   */
  private async fetchImageBlob(url: string): Promise<Blob> {
    try {
      const direct = await fetch(url, { mode: 'cors' });
      if (direct.ok) {
        const blob = await direct.blob();
        if (blob.type.startsWith('image/')) {
          return blob;
        }
      }
    } catch {
      // CORS o rete: si tenta col proxy
    }

    const proxied = await fetch(
      `/api/image-proxy?url=${encodeURIComponent(url)}`,
    );
    if (!proxied.ok) {
      const detail = await proxied
        .json()
        .then((body: { message?: string }) => body.message)
        .catch(() => undefined);
      throw new Error(detail ?? this.i18n.t('errors.download-failed'));
    }
    const blob = await proxied.blob();
    if (!blob.type.startsWith('image/')) {
      throw new Error(this.i18n.t('errors.url-not-image'));
    }
    return blob;
  }

  private async toSourceImage(
    blob: Blob,
    origin: Pick<SourceImage, 'fileName' | 'sourceUrl'>,
  ): Promise<SourceImage> {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const { width, height } = await this.readDimensions(objectUrl);
      return { objectUrl, width, height, size: blob.size, ...origin };
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
  }

  private readDimensions(
    objectUrl: string,
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () =>
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () =>
        reject(new Error(this.i18n.t('errors.format-unrecognized')));
      image.src = objectUrl;
    });
  }
}
