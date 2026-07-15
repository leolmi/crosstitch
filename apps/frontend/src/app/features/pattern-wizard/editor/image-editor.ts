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
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { I18nService } from '../../../i18n/i18n.service';
import { TranslatePipe } from '../../../i18n/translate-pipe';
import { PatternDraftStore } from '../pattern-draft-store';
import {
  applyCssFilter,
  blobToRaw,
  rawToBlob,
  rawToImageData,
  rotateByAngle,
} from './canvas-ops';
import {
  cloneImage,
  cropImage,
  eraseCircle,
  eraseStroke,
  flipHorizontal,
  floodErase,
  RawImage,
  Rect,
  rotate90,
} from './raw-image';

type Tool = 'wand' | 'eraser' | 'crop';

/** Lato massimo dell'immagine di lavoro (limita memoria e cronologia). */
const MAX_SIDE = 1600;
const MAX_HISTORY = 15;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

@Component({
  selector: 'app-image-editor',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './image-editor.html',
  styleUrl: './image-editor.scss',
})
export class ImageEditor {
  protected readonly store = inject(PatternDraftStore);
  private readonly i18n = inject(I18nService);

  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly overlayRef =
    viewChild<ElementRef<HTMLCanvasElement>>('overlay');
  private readonly viewportRef =
    viewChild<ElementRef<HTMLDivElement>>('viewport');

  protected readonly defaultTolerance = 25;
  protected readonly defaultBrushSize = 24;

  /** Strumento puntatore attivo; null = nessuno (il canvas non si modifica). */
  protected readonly tool = signal<Tool | null>(null);
  protected readonly tolerance = signal(this.defaultTolerance);
  protected readonly contiguous = signal(true);
  protected readonly brushSize = signal(this.defaultBrushSize);
  protected readonly zoom = signal(1);
  protected readonly fineAngle = signal(0);
  protected readonly brightness = signal(0);
  protected readonly contrast = signal(0);
  protected readonly saturation = signal(0);
  protected readonly cropRect = signal<Rect | null>(null);
  protected readonly size = signal<{ width: number; height: number } | null>(
    null,
  );
  protected readonly canUndo = signal(false);
  protected readonly canRedo = signal(false);
  protected readonly wandFeedback = signal<string | null>(null);

  /** True quando l'immagine è caricata e l'editor è utilizzabile. */
  readonly ready = computed(() => this.size() !== null);

  protected readonly hasAdjustments = computed(
    () =>
      this.brightness() !== 0 ||
      this.contrast() !== 0 ||
      this.saturation() !== 0,
  );

  /** Anteprima live delle regolazioni, applicata via CSS al canvas. */
  protected readonly cssFilter = computed(() => {
    if (!this.hasAdjustments()) {
      return 'none';
    }
    const b = 1 + this.brightness() / 100;
    const c = 1 + this.contrast() / 100;
    const s = 1 + this.saturation() / 100;
    return `brightness(${b}) contrast(${c}) saturate(${s})`;
  });

  /** Anteprima live della rotazione fine, applicata via CSS al canvas. */
  protected readonly previewTransform = computed(() =>
    this.fineAngle() === 0 ? 'none' : `rotate(${this.fineAngle()}deg)`,
  );

  protected readonly stageWidth = computed(
    () => (this.size()?.width ?? 0) * this.zoom(),
  );
  protected readonly stageHeight = computed(
    () => (this.size()?.height ?? 0) * this.zoom(),
  );
  protected readonly zoomPercent = computed(() =>
    Math.round(this.zoom() * 100),
  );

  private working: RawImage | null = null;
  private original: RawImage | null = null;
  private history: RawImage[] = [];
  private redoStack: RawImage[] = [];
  private loadedUrl: string | null = null;
  private loadToken = 0;

  private stroke: { last: { x: number; y: number }; backup: RawImage } | null =
    null;
  private cropDrag: {
    mode: 'draw' | 'move';
    startX: number;
    startY: number;
    origin: Rect | null;
  } | null = null;

  constructor() {
    effect(() => {
      const canvas = this.canvasRef();
      const source = this.store.source();
      if (!canvas || !source || source.objectUrl === this.loadedUrl) {
        return;
      }
      untracked(() => void this.load(source.objectUrl));
    });
  }

  /** Esporta l'immagine elaborata (PNG) e la salva nella bozza. */
  async commit(): Promise<void> {
    if (!this.working) {
      return;
    }
    const blob = await rawToBlob(this.working);
    this.store.setEdited({
      objectUrl: URL.createObjectURL(blob),
      width: this.working.width,
      height: this.working.height,
    });
  }

  // ------------------------------------------------------------- strumenti

  /** Attiva lo strumento, o lo disattiva se era già attivo. */
  protected toggleTool(tool: Tool): void {
    this.tool.set(this.tool() === tool ? null : tool);
    this.wandFeedback.set(null);
    this.clearCropSelection();
  }

  protected rotate(direction: 'cw' | 'ccw'): void {
    if (this.working) {
      this.commitOp(rotate90(this.working, direction));
    }
  }

  protected flip(): void {
    if (this.working) {
      this.commitOp(flipHorizontal(this.working));
    }
  }

  protected applyFineRotation(): void {
    if (this.working && this.fineAngle() !== 0) {
      this.commitOp(rotateByAngle(this.working, this.fineAngle()));
      this.fineAngle.set(0);
    }
  }

  protected applyAdjustments(): void {
    if (this.working && this.hasAdjustments()) {
      this.commitOp(applyCssFilter(this.working, this.cssFilter()));
      this.resetAdjustments();
    }
  }

  protected resetAdjustments(): void {
    this.brightness.set(0);
    this.contrast.set(0);
    this.saturation.set(0);
  }

  protected applyCrop(): void {
    const rect = this.cropRect();
    if (this.working && rect) {
      this.commitOp(cropImage(this.working, rect));
    }
  }

  protected clearCropSelection(): void {
    this.cropRect.set(null);
    this.drawOverlay();
  }

  // ------------------------------------------------------------ cronologia

  protected undo(): void {
    const previous = this.history.pop();
    if (previous && this.working) {
      this.redoStack.push(this.working);
      this.setWorking(previous);
    }
  }

  protected redo(): void {
    const next = this.redoStack.pop();
    if (next && this.working) {
      this.history.push(this.working);
      this.setWorking(next);
    }
  }

  protected resetToOriginal(): void {
    if (this.original) {
      this.commitOp(cloneImage(this.original));
      this.fineAngle.set(0);
      this.resetAdjustments();
    }
  }

  // ------------------------------------------------------------------ zoom

  protected zoomIn(): void {
    this.zoom.set(Math.min(MAX_ZOOM, this.zoom() * 1.25));
  }

  protected zoomOut(): void {
    this.zoom.set(Math.max(MIN_ZOOM, this.zoom() / 1.25));
  }

  /** Zoom massimo che fa stare l'intera immagine nell'area visibile. */
  protected fitZoom(): void {
    const viewport = this.viewportRef()?.nativeElement;
    const size = this.size();
    if (!viewport || !size) {
      return;
    }
    const fit = Math.min(
      (viewport.clientWidth - 24) / size.width,
      (viewport.clientHeight - 24) / size.height,
    );
    this.zoom.set(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fit)));
  }

  /** Dimensione reale: 1 pixel immagine = 1 pixel schermo (zoom 100%). */
  protected realSize(): void {
    this.zoom.set(1);
  }

  // -------------------------------------------------------------- puntatore

  protected onPointerDown(event: PointerEvent): void {
    const tool = this.tool();
    if (!this.working || !tool) {
      return;
    }
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    const point = this.toImageCoords(event);

    switch (tool) {
      case 'wand': {
        const next = cloneImage(this.working);
        const erased = floodErase(
          next,
          point.x,
          point.y,
          this.tolerance(),
          this.contiguous(),
        );
        if (erased > 0) {
          this.commitOp(next);
          this.wandFeedback.set(
            this.i18n.t('editor.wand.removed', { count: erased }),
          );
        } else {
          this.wandFeedback.set(this.i18n.t('editor.wand.none'));
        }
        break;
      }
      case 'eraser': {
        this.stroke = { last: point, backup: cloneImage(this.working) };
        eraseCircle(this.working, point.x, point.y, this.brushSize() / 2);
        this.redraw();
        break;
      }
      case 'crop': {
        const rect = this.cropRect();
        if (rect && this.isInsideRect(point, rect)) {
          this.cropDrag = {
            mode: 'move',
            startX: point.x,
            startY: point.y,
            origin: { ...rect },
          };
        } else {
          this.cropDrag = {
            mode: 'draw',
            startX: point.x,
            startY: point.y,
            origin: null,
          };
          this.cropRect.set({ x: point.x, y: point.y, width: 0, height: 0 });
        }
        this.drawOverlay();
        break;
      }
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.working) {
      return;
    }
    const point = this.toImageCoords(event);

    if (this.tool() === 'eraser' && this.stroke) {
      eraseStroke(this.working, this.stroke.last, point, this.brushSize() / 2);
      this.stroke.last = point;
      this.redraw();
      return;
    }

    if (this.tool() === 'crop' && this.cropDrag) {
      const { mode, startX, startY, origin } = this.cropDrag;
      const size = this.size();
      if (!size) {
        return;
      }
      if (mode === 'draw') {
        this.cropRect.set(
          this.normalizeRect(startX, startY, point.x, point.y, size),
        );
      } else if (origin) {
        const dx = point.x - startX;
        const dy = point.y - startY;
        this.cropRect.set({
          x: Math.max(0, Math.min(size.width - origin.width, origin.x + dx)),
          y: Math.max(0, Math.min(size.height - origin.height, origin.y + dy)),
          width: origin.width,
          height: origin.height,
        });
      }
      this.drawOverlay();
    }
  }

  protected onPointerUp(): void {
    if (this.stroke) {
      this.pushHistory(this.stroke.backup);
      this.stroke = null;
    }
    if (this.cropDrag) {
      this.cropDrag = null;
      const rect = this.cropRect();
      if (rect && (rect.width < 3 || rect.height < 3)) {
        this.cropRect.set(null);
      }
      this.drawOverlay();
    }
  }

  // ------------------------------------------------------------------ interni

  private async load(url: string): Promise<void> {
    const token = ++this.loadToken;
    this.loadedUrl = url;
    try {
      const blob = await (await fetch(url)).blob();
      const raw = await blobToRaw(blob, MAX_SIDE);
      if (token !== this.loadToken) {
        return;
      }
      this.original = cloneImage(raw);
      this.history = [];
      this.redoStack = [];
      this.fineAngle.set(0);
      this.resetAdjustments();
      this.wandFeedback.set(null);
      // strumento e selezione appartengono all'immagine precedente
      this.tool.set(null);
      this.cropRect.set(null);
      this.stroke = null;
      this.cropDrag = null;
      this.setWorking(raw);
      this.fitZoom();
    } catch {
      if (token === this.loadToken) {
        this.loadedUrl = null;
      }
    }
  }

  /** Sostituisce l'immagine corrente salvando quella precedente nell'undo. */
  private commitOp(next: RawImage): void {
    if (this.working) {
      this.pushHistory(this.working);
    }
    this.setWorking(next);
  }

  private pushHistory(previous: RawImage): void {
    this.history.push(previous);
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
    this.redoStack = [];
    this.syncHistoryFlags();
  }

  private setWorking(img: RawImage): void {
    this.working = img;
    this.size.set({ width: img.width, height: img.height });
    this.cropRect.set(null);
    // il feedback della bacchetta si riferisce all'immagine precedente:
    // chi lo vuole mostrare (es. il caso 'wand') lo reimposta dopo il commit
    this.wandFeedback.set(null);
    this.syncHistoryFlags();
    this.redraw();
  }

  private syncHistoryFlags(): void {
    this.canUndo.set(this.history.length > 0);
    this.canRedo.set(this.redoStack.length > 0);
  }

  private redraw(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const overlay = this.overlayRef()?.nativeElement;
    if (!canvas || !overlay || !this.working) {
      return;
    }
    if (
      canvas.width !== this.working.width ||
      canvas.height !== this.working.height
    ) {
      canvas.width = this.working.width;
      canvas.height = this.working.height;
      overlay.width = this.working.width;
      overlay.height = this.working.height;
    }
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.putImageData(rawToImageData(this.working), 0, 0);
    this.drawOverlay();
  }

  private drawOverlay(): void {
    const overlay = this.overlayRef()?.nativeElement;
    if (!overlay) {
      return;
    }
    const ctx = overlay.getContext('2d') as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const rect = this.cropRect();
    if (!rect || rect.width < 1 || rect.height < 1) {
      return;
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, overlay.width, overlay.height);
    ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, 2 / this.zoom());
    ctx.setLineDash([6 / this.zoom(), 4 / this.zoom()]);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  }

  private toImageCoords(event: PointerEvent): { x: number; y: number } {
    const overlay = this.overlayRef()?.nativeElement;
    const size = this.size();
    if (!overlay || !size) {
      return { x: 0, y: 0 };
    }
    const bounds = overlay.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * size.width;
    const y = ((event.clientY - bounds.top) / bounds.height) * size.height;
    return {
      x: Math.max(0, Math.min(size.width - 1, x)),
      y: Math.max(0, Math.min(size.height - 1, y)),
    };
  }

  private normalizeRect(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    size: { width: number; height: number },
  ): Rect {
    const x = Math.max(0, Math.min(x0, x1));
    const y = Math.max(0, Math.min(y0, y1));
    return {
      x,
      y,
      width: Math.min(size.width, Math.max(x0, x1)) - x,
      height: Math.min(size.height, Math.max(y0, y1)) - y,
    };
  }

  private isInsideRect(point: { x: number; y: number }, rect: Rect): boolean {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }
}
