import { Component, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { estimateFloss } from '../download/floss-estimate';
import { buildPatternPdf, computeChartTiles } from '../download/pattern-pdf';
import { OrderedEntry } from '../download/pattern-symbols';
import { PatternDecomposition, PatternDraftStore } from '../pattern-draft-store';
import { PatternFileService } from '../persistence/pattern-file-service';
import { I18nService } from '../../../i18n/i18n.service';
import { TranslatePipe } from '../../../i18n/translate-pipe';

@Component({
  selector: 'app-download-step',
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    TranslatePipe,
  ],
  templateUrl: './download-step.html',
  styleUrl: './download-step.scss',
})
export class DownloadStep {
  protected readonly store = inject(PatternDraftStore);
  private readonly patternFiles = inject(PatternFileService);
  private readonly i18n = inject(I18nService);

  protected readonly generating = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  /** capi usati per la stima del consumo filato */
  protected readonly strands = signal(2);

  constructor() {
    // al cambio di sorgente (nuova immagine, rimozione, documento aperto)
    // lo step riparte pulito
    effect(() => {
      this.store.source();
      this.strands.set(2);
      this.error.set(null);
    });
  }

  /** Il titolo è tenuto nello store (fonte unica per toolbar, PDF e file). */
  protected setTitle(value: string): void {
    this.store.setTitle(value);
  }

  protected readonly totalStitches = computed(() => {
    const d = this.store.decomposition();
    return d ? d.palette.reduce((sum, e) => sum + e.count, 0) : 0;
  });

  /** stima totale del filato (matassine e metri) al variare dei capi */
  protected readonly flossTotals = computed(() => {
    const d = this.store.decomposition();
    if (!d) {
      return { skeins: 0, meters: 0 };
    }
    const strands = this.strands();
    let skeins = 0;
    let meters = 0;
    for (const entry of d.palette) {
      const est = estimateFloss({
        stitches: entry.count,
        fabricCount: d.settings.fabricCount,
        strands,
      });
      skeins += est.skeins;
      meters += est.meters;
    }
    return { skeins, meters };
  });

  /** Metri di filato arrotondati, per l'etichetta (evita pipe annidate nel template). */
  protected readonly metersRounded = computed(() =>
    Math.round(this.flossTotals().meters),
  );

  protected async download(): Promise<void> {
    const decomposition = this.store.decomposition();
    if (!decomposition) {
      return;
    }
    this.generating.set(true);
    this.error.set(null);
    try {
      const ordered = this.orderedPalette(decomposition);
      const previewPng = await this.renderPreviewPng(decomposition);
      const title =
        this.store.title().trim() || this.i18n.t('download.default-title');
      const blob = await buildPatternPdf({
        decomposition,
        ordered,
        title,
        previewPng,
        strands: this.strands(),
        i18n: {
          t: (key, params) => this.i18n.t(key, params),
          lang: this.i18n.lang(),
        },
      });
      this.triggerDownload(blob, `${this.safeFileName(title)}.pdf`);
    } catch (err) {
      this.error.set(this.i18n.errorText(err, 'errors.pdf-generation'));
    } finally {
      this.generating.set(false);
    }
  }

  /** Salva lo schema come nostro documento (.xstitch). */
  protected async save(): Promise<void> {
    if (!this.store.hasDecomposition()) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.patternFiles.save(this.store.title());
    } catch (err) {
      this.error.set(this.i18n.errorText(err, 'errors.save-pattern'));
    } finally {
      this.saving.set(false);
    }
  }

  /** Rende il nome sicuro come file (rimuove caratteri non validi). */
  private safeFileName(name: string): string {
    const cleaned = name
      .replace(/[/\\:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || this.i18n.t('download.default-title');
  }

  /** Palette con indice originale, ordinata per numero di punti decrescente. */
  private orderedPalette(d: PatternDecomposition): OrderedEntry[] {
    return d.palette
      .map((entry, index) => ({
        color: entry.color,
        count: entry.count,
        paletteIndex: index,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /** Anteprima a colori (celle vuote bianche) per la copertina del PDF. */
  private async renderPreviewPng(d: PatternDecomposition): Promise<Uint8Array> {
    const cellPx = Math.max(1, Math.floor(1000 / Math.max(d.width, d.height)));
    const canvas = document.createElement('canvas');
    canvas.width = d.width * cellPx;
    canvas.height = d.height * cellPx;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < d.height; y++) {
      for (let x = 0; x < d.width; x++) {
        const index = d.cells[y * d.width + x];
        if (index >= 0) {
          ctx.fillStyle = d.palette[index].color.hex;
          ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
        }
      }
    }

    // sovrappone i riquadri che diventeranno pagine dello schema
    this.drawTileOverlay(ctx, d, cellPx);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!blob) {
      throw new Error(this.i18n.t('errors.preview-generation'));
    }
    return new Uint8Array(await blob.arrayBuffer());
  }

  /** Evidenzia sull'anteprima i riquadri numerati che diventeranno pagine. */
  private drawTileOverlay(
    ctx: CanvasRenderingContext2D,
    d: PatternDecomposition,
    cellPx: number,
  ): void {
    const tiles = computeChartTiles(d);
    if (tiles.length < 2) {
      return; // un solo riquadro: nessuna suddivisione da mostrare
    }
    const lw = Math.max(1, Math.min(2.5, cellPx * 0.12));
    for (const tile of tiles) {
      const x = tile.col0 * cellPx;
      const y = tile.row0 * cellPx;
      const w = tile.cols * cellPx;
      const h = tile.rows * cellPx;

      // bordo sottile con lieve alone chiaro per restare visibile su ogni colore
      ctx.lineWidth = lw + 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
      ctx.lineWidth = lw;
      ctx.strokeStyle = 'rgba(20,20,20,0.7)';
      ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);

      // numero del riquadro
      const label = String(tile.index);
      const fontSize = Math.max(14, Math.min(w, h) * 0.3);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textBaseline = 'top';
      const pad = fontSize * 0.25;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillRect(x + lw, y + lw, tw + pad * 2, fontSize + pad);
      ctx.fillStyle = 'rgba(20,20,20,0.95)';
      ctx.fillText(label, x + lw + pad, y + lw + pad / 2);
    }
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
