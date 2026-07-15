import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { FlossColor, getFlossColors } from '@crosstitch/floss-colors';
import { blobToRaw, resampleRaw } from '../editor/canvas-ops';
import { RawImage } from '../editor/raw-image';
import { decompose, DecompositionResult, PaletteEntry } from '../decompose/decompose';
import { paintCells, recolorEntry } from '../decompose/pattern-edits';
import {
  FlossColorPicker,
  FlossPickerData,
} from './floss-color-picker';
import {
  FlossStandard,
  PatternDecomposition,
  PatternDraftStore,
} from '../pattern-draft-store';
import { I18nService } from '../../../i18n/i18n.service';
import { TranslatePipe } from '../../../i18n/translate-pipe';
import { TranslationKey } from '../../../i18n/it';

interface FabricPreset {
  /** Chiave i18n dell'etichetta mostrata nel select */
  key: TranslationKey;
  /** Punti per pollice (count effettivo) */
  count: number;
}

/** Tele più comuni; per il lino il count effettivo è su 2 fili. */
const FABRICS: FabricPreset[] = [
  { key: 'decomposition.fabric.aida-11', count: 11 },
  { key: 'decomposition.fabric.aida-14', count: 14 },
  { key: 'decomposition.fabric.aida-16', count: 16 },
  { key: 'decomposition.fabric.aida-18', count: 18 },
  { key: 'decomposition.fabric.aida-20', count: 20 },
  { key: 'decomposition.fabric.linen-25', count: 12.5 },
  { key: 'decomposition.fabric.linen-28', count: 14 },
  { key: 'decomposition.fabric.linen-32', count: 16 },
];

const MIN_STITCHES = 10;
const MAX_STITCHES = 500;
const CM_PER_INCH = 2.54;
const COMPUTE_DEBOUNCE_MS = 250;
/** Valori iniziali dei parametri, ripristinati al cambio di immagine. */
const DEFAULT_FABRIC_COUNT = 14;
const DEFAULT_WIDTH_CM = 30;
const DEFAULT_MAX_COLORS = 30;
/** Colore della tela nuda per le celle non ricamate (écru neutro). */
const FABRIC_COLOR = '#f0e9dc';
/** Dimensione cella (px per punto) minima e massima dell'anteprima. */
const MIN_CELL = 1;
const MAX_CELL = 30;

type EditTool = 'paint' | 'erase';
type SortMode = 'count' | 'hue' | 'code';

/** Tonalità (0-360) di un colore hex, per l'ordinamento per tinta. */
function hexHue(hex: string): number {
  const value = parseInt(hex.slice(1), 16);
  const r = ((value >> 16) & 0xff) / 255;
  const g = ((value >> 8) & 0xff) / 255;
  const b = (value & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) {
    return -1; // grigi/neutri: raggruppati all'inizio
  }
  let hue: number;
  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }
  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

@Component({
  selector: 'app-decomposition-step',
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSliderModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './decomposition-step.html',
  styleUrl: './decomposition-step.scss',
})
export class DecompositionStep {
  protected readonly store = inject(PatternDraftStore);
  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(I18nService);
  protected readonly fabrics = FABRICS;

  private readonly previewRef =
    viewChild<ElementRef<HTMLCanvasElement>>('preview');
  private readonly viewportRef =
    viewChild<ElementRef<HTMLDivElement>>('previewViewport');

  protected readonly fabricCount = signal(DEFAULT_FABRIC_COUNT);
  protected readonly widthCm = signal(DEFAULT_WIDTH_CM);
  protected readonly maxColors = signal(DEFAULT_MAX_COLORS);
  protected readonly standard = signal<FlossStandard>('dmc');
  protected readonly computing = signal(false);
  /** px per punto scelti dall'utente; 0 = adatta automaticamente */
  protected readonly requestedCell = signal(0);
  /** px per punto effettivamente usati nell'ultimo disegno */
  protected readonly effectiveCell = signal(0);

  /** true dopo la prima modifica manuale: blocca i parametri di scomposizione */
  protected readonly manualEdited = signal(false);
  /** strumento di ritocco attivo (null = navigazione) */
  protected readonly editTool = signal<EditTool | null>(null);
  /** colore attivo per lo strumento "assegna colore" */
  protected readonly paintColor = signal<FlossColor | null>(null);
  protected readonly canUndo = signal(false);
  protected readonly canRedo = signal(false);
  /** avviso temporaneo di accorpamento colori */
  protected readonly mergeNotice = signal<string | null>(null);
  /** colore della tela (celle non ricamate), personalizzabile */
  protected readonly fabricColor = signal(FABRIC_COLOR);
  /** criterio di ordinamento della legenda */
  protected readonly sortMode = signal<SortMode>('hue');
  /** codice DMC evidenziato dal click sull'anteprima */
  protected readonly highlightedDmc = signal<string | null>(null);
  /** forza un ricalcolo anche a parametri invariati (pulsante Rigenera) */
  private readonly regenToken = signal(0);

  protected readonly pointsPerCm = computed(
    () => this.fabricCount() / CM_PER_INCH,
  );
  protected readonly gridWidth = computed(() =>
    Math.min(
      MAX_STITCHES,
      Math.max(MIN_STITCHES, Math.round(this.widthCm() * this.pointsPerCm())),
    ),
  );
  protected readonly gridHeight = computed(() => {
    const edited = this.store.edited();
    if (!edited) {
      return 0;
    }
    const height = Math.round(
      (this.gridWidth() * edited.height) / edited.width,
    );
    return Math.min(MAX_STITCHES, Math.max(1, height));
  });
  protected readonly heightCm = computed(
    () => this.gridHeight() / this.pointsPerCm(),
  );

  protected readonly paletteForStandard = computed(() =>
    this.standard() === 'anchor'
      ? getFlossColors().filter((c) => c.anchor)
      : getFlossColors(),
  );
  protected readonly anchorPaletteSize = getFlossColors().filter(
    (c) => c.anchor,
  ).length;

  protected readonly sortedPalette = computed(() => {
    const decomposition = this.store.decomposition();
    if (!decomposition) {
      return [];
    }
    const entries = [...decomposition.palette];
    switch (this.sortMode()) {
      case 'hue':
        return entries.sort(
          (a, b) =>
            hexHue(a.color.hex) - hexHue(b.color.hex) || b.count - a.count,
        );
      case 'code':
        return entries.sort((a, b) =>
          this.primaryCode(a).localeCompare(this.primaryCode(b), 'en', {
            numeric: true,
          }),
        );
      case 'count':
      default:
        return entries.sort((a, b) => b.count - a.count);
    }
  });
  protected readonly totalStitches = computed(() =>
    this.sortedPalette().reduce((sum, entry) => sum + entry.count, 0),
  );

  private editedCache: { url: string; raw: RawImage } | null = null;
  private computeTimer: ReturnType<typeof setTimeout> | undefined;
  private computeToken = 0;
  /** Ultimo regenToken per cui è partito un ricalcolo (guardia di coerenza). */
  private lastRegenToken = 0;

  private history: PatternDecomposition[] = [];
  private redoStack: PatternDecomposition[] = [];
  private stroke: Set<number> | null = null;

  constructor() {
    // al cambio di sorgente (nuova immagine, rimozione, documento aperto) lo
    // stato locale dello step si riallinea allo store. Creato per primo, così
    // gira prima del ricalcolo nello stesso flush.
    effect(() => {
      this.store.source();
      untracked(() => this.syncWithSource());
    });

    // ricalcola (con debounce) quando cambiano immagine o parametri.
    // Mentre ci sono modifiche manuali i controlli sono bloccati, quindi il
    // ricalcolo riparte solo da "Rigenera schema" (regenToken).
    effect(() => {
      const edited = this.store.edited();
      const width = this.gridWidth();
      const height = this.gridHeight();
      const maxColors = this.maxColors();
      const palette = this.paletteForStandard();
      const regen = this.regenToken();
      if (!edited || height === 0) {
        return;
      }
      untracked(() => {
        // schema già coerente coi parametri (es. appena caricato da file):
        // niente ricalcolo, preserva anche gli eventuali ritocchi manuali
        const current = this.store.decomposition();
        if (
          regen === this.lastRegenToken &&
          current &&
          current.width === width &&
          current.height === height &&
          current.settings.maxColors === maxColors &&
          current.settings.standard === this.standard() &&
          current.settings.fabricCount === this.fabricCount()
        ) {
          clearTimeout(this.computeTimer);
          return;
        }
        this.lastRegenToken = regen;
        this.scheduleCompute(edited.objectUrl, width, height, maxColors, palette);
      });
    });

    // ridisegna l'anteprima quando cambiano risultato, zoom o colore tela
    effect(() => {
      const decomposition = this.store.decomposition();
      const canvas = this.previewRef()?.nativeElement;
      const cell = this.requestedCell();
      this.fabricColor();
      if (decomposition && canvas) {
        untracked(() => this.drawPreview(decomposition, canvas, cell));
      }
    });

    // ri-adatta l'anteprima quando il viewport cambia dimensione: entrando
    // nello step il pannello passa da nascosto a dimensionato e il fit iniziale
    // va ricalcolato con le misure reali.
    effect((onCleanup) => {
      const viewport = this.viewportRef()?.nativeElement;
      if (!viewport) {
        return;
      }
      const observer = new ResizeObserver(() => {
        if (this.requestedCell() !== 0) {
          return; // l'utente ha impostato uno zoom manuale: non toccarlo
        }
        const decomposition = untracked(() => this.store.decomposition());
        const canvas = this.previewRef()?.nativeElement;
        if (decomposition && canvas) {
          this.drawPreview(decomposition, canvas, 0);
        }
      });
      observer.observe(viewport);
      onCleanup(() => observer.disconnect());
    });
  }

  protected zoomIn(): void {
    const current = this.effectiveCell() || MIN_CELL;
    this.requestedCell.set(
      Math.min(MAX_CELL, Math.max(current + 1, Math.round(current * 1.25))),
    );
  }

  protected zoomOut(): void {
    const current = this.effectiveCell() || MIN_CELL;
    this.requestedCell.set(
      Math.max(MIN_CELL, Math.min(current - 1, Math.round(current / 1.25))),
    );
  }

  /** Torna all'adattamento automatico alla finestra. */
  protected fitPreview(): void {
    // 0 = auto; se era già auto forza comunque un ridisegno
    if (this.requestedCell() === 0) {
      const decomposition = this.store.decomposition();
      const canvas = this.previewRef()?.nativeElement;
      if (decomposition && canvas) {
        this.drawPreview(decomposition, canvas, 0);
      }
    } else {
      this.requestedCell.set(0);
    }
  }

  protected setWidthCm(value: string): void {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      this.widthCm.set(Math.min(150, Math.max(2, parsed)));
    }
  }

  protected setWidthStitches(value: string): void {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      const stitches = Math.min(
        MAX_STITCHES,
        Math.max(MIN_STITCHES, parsed),
      );
      this.widthCm.set(stitches / this.pointsPerCm());
    }
  }

  protected primaryCode(entry: { color: { dmc: string; anchor?: string } }): string {
    return this.standard() === 'anchor'
      ? (entry.color.anchor ?? '—')
      : entry.color.dmc;
  }

  // ------------------------------------------------------------- editing colori

  protected toggleTool(tool: EditTool): void {
    const next = this.editTool() === tool ? null : tool;
    this.editTool.set(next);
    if (next === 'paint' && !this.paintColor()) {
      void this.choosePaintColor();
    }
  }

  /** Apre il selettore per scegliere il colore dello strumento "assegna colore". */
  protected async choosePaintColor(): Promise<void> {
    const color = await this.openPicker(this.paintColor() ?? undefined);
    if (color) {
      this.paintColor.set(color);
      this.editTool.set('paint');
    }
  }

  /** Modifica il colore di una voce di legenda (matita). */
  protected async editEntry(entry: PaletteEntry): Promise<void> {
    const current = this.store.decomposition();
    if (!current) {
      return;
    }
    const index = current.palette.findIndex(
      (p) => p.color.dmc === entry.color.dmc,
    );
    if (index < 0) {
      return;
    }
    const newColor = await this.openPicker(entry.color);
    if (!newColor || newColor.dmc === entry.color.dmc) {
      return;
    }
    const mergesWith = current.palette.some(
      (p, i) => i !== index && p.color.dmc === newColor.dmc,
    );
    this.applyEdit(recolorEntry(current, index, newColor));
    if (mergesWith) {
      this.notifyMerge(
        this.i18n.t('decomposition.merge-notice', {
          code: this.codeOf(newColor),
        }),
      );
    }
  }

  private mergeNoticeTimer: ReturnType<typeof setTimeout> | undefined;

  private notifyMerge(message: string): void {
    this.mergeNotice.set(message);
    clearTimeout(this.mergeNoticeTimer);
    this.mergeNoticeTimer = setTimeout(() => this.mergeNotice.set(null), 6000);
  }

  protected dismissMergeNotice(): void {
    clearTimeout(this.mergeNoticeTimer);
    this.mergeNotice.set(null);
  }

  protected undo(): void {
    const previous = this.history.pop();
    const current = this.store.decomposition();
    if (previous && current) {
      this.redoStack.push(current);
      this.store.setDecomposition(previous);
      this.syncHistoryFlags();
    }
  }

  protected redo(): void {
    const next = this.redoStack.pop();
    const current = this.store.decomposition();
    if (next && current) {
      this.history.push(current);
      this.store.setDecomposition(next);
      this.syncHistoryFlags();
    }
  }

  /**
   * Riallinea lo stato locale quando la sorgente cambia dall'esterno:
   * immagine nuova o rimossa → tutto ai valori di default; documento aperto
   * (unico caso in cui la sorgente arriva insieme a una scomposizione) →
   * adotta i parametri con cui lo schema era stato calcolato.
   */
  private syncWithSource(): void {
    // annulla ricalcoli pendenti o in corso sulla vecchia immagine
    clearTimeout(this.computeTimer);
    this.computeToken++;
    this.computing.set(false);

    const settings = this.store.decomposition()?.settings;
    this.fabricCount.set(settings?.fabricCount ?? DEFAULT_FABRIC_COUNT);
    this.widthCm.set(settings?.widthCm ?? DEFAULT_WIDTH_CM);
    this.maxColors.set(settings?.maxColors ?? DEFAULT_MAX_COLORS);
    this.standard.set(settings?.standard ?? 'dmc');

    this.fabricColor.set(FABRIC_COLOR);
    this.sortMode.set('hue');
    this.requestedCell.set(0);
    this.manualEdited.set(false);
    this.editTool.set(null);
    this.paintColor.set(null);
    this.highlightedDmc.set(null);
    this.dismissMergeNotice();
    this.history = [];
    this.redoStack = [];
    this.stroke = null;
    this.syncHistoryFlags();
    this.editedCache = null;
  }

  /** Sblocca i parametri e ricalcola lo schema da capo (perde i ritocchi). */
  protected regenerate(): void {
    this.history = [];
    this.redoStack = [];
    this.syncHistoryFlags();
    this.manualEdited.set(false);
    this.editTool.set(null);
    this.regenToken.update((v) => v + 1);
  }

  // ----------------------------------------------------------- puntatore paint

  protected onPointerDown(event: PointerEvent): void {
    const tool = this.editTool();
    if (!this.store.decomposition()) {
      return;
    }
    // senza strumento attivo il click "ispeziona": evidenzia il colore in legenda
    if (!tool) {
      this.inspectAt(event);
      return;
    }
    if (tool === 'paint' && !this.paintColor()) {
      return;
    }
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.stroke = new Set<number>();
    this.paintAt(event);
  }

  /** Evidenzia in legenda il colore della cella cliccata. */
  private inspectAt(event: PointerEvent): void {
    const cell = this.cellIndexAt(event);
    const decomposition = this.store.decomposition();
    if (cell === null || !decomposition) {
      return;
    }
    const index = decomposition.cells[cell];
    if (index < 0) {
      this.highlightedDmc.set(null);
      return;
    }
    const dmc = decomposition.palette[index].color.dmc;
    this.highlightedDmc.set(dmc);
    // porta in vista la voce evidenziata
    setTimeout(() => {
      document
        .querySelector('.legend-row.highlighted')
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  /** Indice di cella (riga*larghezza+colonna) sotto il puntatore, o null. */
  private cellIndexAt(event: PointerEvent): number | null {
    const canvas = this.previewRef()?.nativeElement;
    const decomposition = this.store.decomposition();
    if (!canvas || !decomposition) {
      return null;
    }
    const cell = this.effectiveCell();
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / cell);
    const y = Math.floor((event.clientY - rect.top) / cell);
    if (x < 0 || y < 0 || x >= decomposition.width || y >= decomposition.height) {
      return null;
    }
    return y * decomposition.width + x;
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.stroke) {
      this.paintAt(event);
    }
  }

  protected onPointerUp(): void {
    const stroke = this.stroke;
    this.stroke = null;
    const current = this.store.decomposition();
    if (!stroke || stroke.size === 0 || !current) {
      return;
    }
    const color = this.editTool() === 'erase' ? null : this.paintColor();
    this.applyEdit(paintCells(current, stroke, color));
  }

  private paintAt(event: PointerEvent): void {
    const canvas = this.previewRef()?.nativeElement;
    const decomposition = this.store.decomposition();
    const index = this.cellIndexAt(event);
    if (!canvas || !decomposition || !this.stroke || index === null) {
      return;
    }
    if (this.stroke.has(index)) {
      return;
    }
    this.stroke.add(index);
    // feedback immediato: dipinge la cella sul canvas (la griglia viene
    // ridisegnata al commit)
    const cell = this.effectiveCell();
    const x = index % decomposition.width;
    const y = Math.floor(index / decomposition.width);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.fillStyle =
      this.editTool() === 'erase'
        ? this.fabricColor()
        : (this.paintColor()?.hex ?? this.fabricColor());
    ctx.fillRect(x * cell, y * cell, cell, cell);
  }

  private applyEdit(result: DecompositionResult): void {
    const current = this.store.decomposition();
    if (!current) {
      return;
    }
    this.history.push(current);
    this.redoStack = [];
    this.manualEdited.set(true);
    this.syncHistoryFlags();
    this.store.setDecomposition({
      ...result,
      settings: current.settings,
      widthCm: current.widthCm,
      heightCm: current.heightCm,
    });
  }

  private syncHistoryFlags(): void {
    this.canUndo.set(this.history.length > 0);
    this.canRedo.set(this.redoStack.length > 0);
  }

  private async openPicker(current?: FlossColor): Promise<FlossColor | undefined> {
    const decomposition = this.store.decomposition();
    const data: FlossPickerData = {
      standard: this.standard(),
      paletteInUse: decomposition
        ? decomposition.palette.map((p) => p.color)
        : [],
      current,
    };
    const ref = this.dialog.open<
      FlossColorPicker,
      FlossPickerData,
      FlossColor
    >(FlossColorPicker, { data, autoFocus: 'dialog' });
    return firstValueFrom(ref.afterClosed());
  }

  private codeOf(color: FlossColor): string {
    return this.standard() === 'anchor'
      ? `Anchor ${color.anchor ?? '—'}`
      : `DMC ${color.dmc}`;
  }

  private scheduleCompute(
    url: string,
    width: number,
    height: number,
    maxColors: number,
    palette: ReturnType<typeof getFlossColors>,
  ): void {
    clearTimeout(this.computeTimer);
    this.computeTimer = setTimeout(
      () => void this.compute(url, width, height, maxColors, palette),
      COMPUTE_DEBOUNCE_MS,
    );
  }

  private async compute(
    url: string,
    width: number,
    height: number,
    maxColors: number,
    palette: ReturnType<typeof getFlossColors>,
  ): Promise<void> {
    const token = ++this.computeToken;
    this.computing.set(true);
    try {
      if (!this.editedCache || this.editedCache.url !== url) {
        const blob = await (await fetch(url)).blob();
        const raw = await blobToRaw(blob, 4096);
        if (token !== this.computeToken) {
          return;
        }
        this.editedCache = { url, raw };
      }
      const gridImage = resampleRaw(this.editedCache.raw, width, height);
      const result = decompose(gridImage, maxColors, palette);
      if (token !== this.computeToken) {
        return;
      }
      // ricalcolo automatico: azzera lo stato di modifica manuale
      this.history = [];
      this.redoStack = [];
      this.syncHistoryFlags();
      this.manualEdited.set(false);
      this.editTool.set(null);
      this.store.setDecomposition({
        ...result,
        settings: {
          fabricCount: this.fabricCount(),
          widthCm: this.widthCm(),
          maxColors,
          standard: this.standard(),
        },
        widthCm: width / this.pointsPerCm(),
        heightCm: height / this.pointsPerCm(),
      });
    } finally {
      if (token === this.computeToken) {
        this.computing.set(false);
      }
    }
  }

  /** Cella che fa stare l'intera griglia nell'area visibile. */
  private fitCell(width: number, height: number): number {
    const viewport = this.viewportRef()?.nativeElement;
    if (!viewport) {
      return Math.max(MIN_CELL, Math.floor(900 / width));
    }
    const fit = Math.floor(
      Math.min(
        (viewport.clientWidth - 24) / width,
        (viewport.clientHeight - 24) / height,
      ),
    );
    return Math.min(MAX_CELL, Math.max(MIN_CELL, fit));
  }

  private drawPreview(
    decomposition: PatternDecomposition,
    canvas: HTMLCanvasElement,
    requestedCell: number,
  ): void {
    const { width, height, cells, palette } = decomposition;
    const cell = requestedCell > 0 ? requestedCell : this.fitCell(width, height);
    this.effectiveCell.set(cell);
    canvas.width = width * cell;
    canvas.height = height * cell;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    // celle non ricamate = tela nuda
    ctx.fillStyle = this.fabricColor();
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = cells[y * width + x];
        if (index >= 0) {
          ctx.fillStyle = palette[index].color.hex;
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }

    if (cell >= 4) {
      this.drawGridLines(ctx, width, height, cell);
    }
  }

  private drawGridLines(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cell: number,
  ): void {
    for (let x = 0; x <= width; x++) {
      const bold = x % 10 === 0 || x === width;
      ctx.strokeStyle = bold ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, height * cell);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y++) {
      const bold = y % 10 === 0 || y === height;
      ctx.strokeStyle = bold ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(width * cell, y * cell + 0.5);
      ctx.stroke();
    }
  }
}
