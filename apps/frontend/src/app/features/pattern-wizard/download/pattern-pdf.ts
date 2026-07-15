import {
  PDFDocument,
  PDFFont,
  PDFPage,
  rgb,
  RGB,
  StandardFonts,
} from 'pdf-lib';
import { hexToRgb } from '@crosstitch/floss-colors';
import type { PatternDecomposition } from '../pattern-draft-store';
import {
  DEFAULT_SKEIN_METERS,
  DEFAULT_WASTE,
  estimateFloss,
} from './floss-estimate';
import { assignSymbols, OrderedEntry, SymbolAssignment } from './pattern-symbols';
import { TranslationKey } from '../../../i18n/it';

/** Traduttore e lingua passati dal chiamante per stringhe e date del PDF. */
export interface PdfI18n {
  t(key: TranslationKey, params?: Record<string, string | number>): string;
  /** Locale per la formattazione della data (es. 'it', 'en'). */
  lang: string;
}

export interface PatternPdfOptions {
  decomposition: PatternDecomposition;
  /** Palette ordinata come mostrata in legenda, con l'indice originale. */
  ordered: OrderedEntry[];
  /** Nome dello schema, usato in intestazione. */
  title: string;
  /** Capi usati per la stima del consumo filato. */
  strands: number;
  /** PNG dell'anteprima a colori per la copertina. */
  previewPng?: Uint8Array;
  /** Traduttore e lingua per il testo del PDF. */
  i18n: PdfI18n;
}

// A4 in punti
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - 2 * MARGIN;

const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.45, 0.45, 0.45);
const GRID_MINOR = rgb(0.8, 0.8, 0.8);
const GRID_MAJOR = rgb(0.5, 0.5, 0.5);

function toRgb(hex: string): RGB {
  const { r, g, b } = hexToRgb(hex);
  return rgb(r / 255, g / 255, b / 255);
}

/** Nero o bianco a seconda della luminanza del colore di fondo. */
function contrastInk(hex: string): RGB {
  const { r, g, b } = hexToRgb(hex);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 140 ? rgb(0, 0, 0) : rgb(1, 1, 1);
}

interface Ctx {
  pdf: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
}

export async function buildPatternPdf(
  options: PatternPdfOptions,
): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { pdf, font, bold };

  const symbols = assignSymbols(options.ordered);

  await drawCover(ctx, options);
  drawFlossList(ctx, options, symbols);
  await drawChart(ctx, options, symbols);

  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

// --------------------------------------------------------------- copertina

async function drawCover(ctx: Ctx, options: PatternPdfOptions): Promise<void> {
  const { decomposition: d, title } = options;
  const page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  page.drawText(title, { x: MARGIN, y: y - 20, size: 22, font: ctx.bold, color: INK });
  y -= 40;

  const t = options.i18n.t;
  page.drawText(t('pdf.generated-by'), {
    x: MARGIN,
    y: y - 10,
    size: 9,
    font: ctx.font,
    color: MUTED,
  });
  y -= 13;
  const generatedAt = new Date().toLocaleString(options.i18n.lang, {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  page.drawText(t('pdf.generated-on', { date: generatedAt }), {
    x: MARGIN,
    y: y - 10,
    size: 9,
    font: ctx.font,
    color: MUTED,
  });
  y -= 24;

  const summary = [
    t('pdf.summary.dimensions', { width: d.width, height: d.height }),
    t('pdf.summary.measure', {
      width: d.widthCm.toFixed(1),
      height: d.heightCm.toFixed(1),
    }),
    t('pdf.summary.fabric', { count: d.settings.fabricCount }),
    t('pdf.summary.colors', { count: d.palette.length }),
    t('pdf.summary.total-stitches', { count: totalStitches(d) }),
    t('pdf.summary.standard', {
      name: d.settings.standard === 'anchor' ? 'Anchor' : 'DMC',
    }),
  ];
  for (const line of summary) {
    page.drawText(line, { x: MARGIN, y: y - 12, size: 11, font: ctx.font, color: INK });
    y -= 18;
  }
  y -= 12;

  if (options.previewPng) {
    const png = await ctx.pdf.embedPng(options.previewPng);
    const maxW = CONTENT_W;
    const maxH = y - MARGIN;
    const scale = Math.min(maxW / png.width, maxH / png.height);
    const w = png.width * scale;
    const h = png.height * scale;
    page.drawImage(png, {
      x: MARGIN + (CONTENT_W - w) / 2,
      y: y - h,
      width: w,
      height: h,
    });
  }
}

// ------------------------------------------------------- lista filati / spesa

interface Column {
  key: string;
  width: number;
  align?: 'left' | 'center';
}

const LIST_COLUMNS: Column[] = [
  { key: 'Simbolo', width: 40, align: 'center' },
  { key: 'Colore', width: 30, align: 'center' },
  { key: 'DMC', width: 42 },
  { key: 'Anchor', width: 46 },
  { key: 'Nome', width: 116 },
  { key: 'Punti', width: 36, align: 'center' },
  { key: 'Metri', width: 40, align: 'center' },
  { key: 'Matass.', width: 44, align: 'center' },
  { key: 'Ho', width: 26, align: 'center' },
  { key: 'Compra', width: 48, align: 'center' },
];

/**
 * Etichette i18n delle colonne. Le chiavi logiche (col.key) restano invariate
 * — servono per i confronti e per i dati di riga — mentre l'intestazione usa
 * queste traduzioni. DMC e Anchor non compaiono: sono nomi standard.
 */
const COLUMN_LABEL: Partial<Record<string, TranslationKey>> = {
  Simbolo: 'pdf.col.symbol',
  Colore: 'pdf.col.color',
  Nome: 'pdf.col.name',
  Punti: 'pdf.col.points',
  Metri: 'pdf.col.meters',
  'Matass.': 'pdf.col.skeins',
  Ho: 'pdf.col.have',
  Compra: 'pdf.col.buy',
};

const LIST_ROW_H = 22;

function drawFlossList(
  ctx: Ctx,
  options: PatternPdfOptions,
  symbols: SymbolAssignment[],
): void {
  const { strands } = options;
  const fabricCount = options.decomposition.settings.fabricCount;
  const rowsPerPage = Math.floor((PAGE_H - 2 * MARGIN - 88) / LIST_ROW_H);
  const pages = Math.max(1, Math.ceil(symbols.length / rowsPerPage));

  // totali stimati per la nota informativa
  let totalMeters = 0;
  let totalSkeins = 0;
  for (const entry of symbols) {
    const est = estimateFloss({ stitches: entry.count, fabricCount, strands });
    totalMeters += est.meters;
    totalSkeins += est.skeins;
  }

  for (let p = 0; p < pages; p++) {
    const page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    const t = options.i18n.t;
    page.drawText(t('pdf.floss-list-title'), {
      x: MARGIN,
      y: y - 18,
      size: 18,
      font: ctx.bold,
      color: INK,
    });
    if (pages > 1) {
      page.drawText(t('pdf.page-of', { current: p + 1, total: pages }), {
        x: PAGE_W - MARGIN - 90,
        y: y - 16,
        size: 10,
        font: ctx.font,
        color: MUTED,
      });
    }
    y -= 32;
    page.drawText(t('pdf.checklist-hint'), {
      x: MARGIN,
      y: y - 10,
      size: 9,
      font: ctx.font,
      color: MUTED,
    });
    y -= 14;
    page.drawText(
      t('pdf.estimate-note', {
        strands,
        skeinMeters: DEFAULT_SKEIN_METERS,
        waste: Math.round(DEFAULT_WASTE * 100),
        skeins: totalSkeins,
        meters: totalMeters.toFixed(0),
      }),
      { x: MARGIN, y: y - 10, size: 8, font: ctx.font, color: MUTED },
    );
    y -= 22;

    // intestazione tabella
    drawListRowBackground(page, y, GRID_MINOR);
    let x = MARGIN;
    for (const col of LIST_COLUMNS) {
      const labelKey = COLUMN_LABEL[col.key];
      const label = labelKey ? t(labelKey) : col.key;
      drawCellText(page, ctx.bold, label, x, y, col, 9);
      x += col.width;
    }
    y -= LIST_ROW_H;

    const slice = symbols.slice(p * rowsPerPage, (p + 1) * rowsPerPage);
    for (const entry of slice) {
      drawListRow(page, ctx, entry, y, fabricCount, strands);
      y -= LIST_ROW_H;
    }
  }
}

function drawListRowBackground(page: PDFPage, top: number, color: RGB): void {
  page.drawLine({
    start: { x: MARGIN, y: top - LIST_ROW_H + 4 },
    end: { x: PAGE_W - MARGIN, y: top - LIST_ROW_H + 4 },
    thickness: 0.5,
    color,
  });
}

function drawListRow(
  page: PDFPage,
  ctx: Ctx,
  entry: SymbolAssignment,
  top: number,
  fabricCount: number,
  strands: number,
): void {
  drawListRowBackground(page, top, GRID_MINOR);
  const est = estimateFloss({ stitches: entry.count, fabricCount, strands });
  const cells: Record<string, string> = {
    Simbolo: entry.symbol,
    DMC: entry.color.dmc,
    Anchor: entry.color.anchor ?? '—',
    Nome: entry.color.name,
    Punti: String(entry.count),
    Metri: est.meters.toFixed(1),
    'Matass.': String(est.skeins),
  };
  let x = MARGIN;
  for (const col of LIST_COLUMNS) {
    if (col.key === 'Colore') {
      // campione colore
      const size = 12;
      page.drawRectangle({
        x: x + (col.width - size) / 2,
        y: top - LIST_ROW_H + 7,
        width: size,
        height: size,
        color: toRgb(entry.color.hex),
        borderColor: MUTED,
        borderWidth: 0.5,
      });
    } else if (col.key === 'Ho' || col.key === 'Compra') {
      // casella da spuntare
      const box = 11;
      page.drawRectangle({
        x: x + (col.width - box) / 2,
        y: top - LIST_ROW_H + 7,
        width: box,
        height: box,
        borderColor: MUTED,
        borderWidth: 0.8,
      });
    } else {
      let text = cells[col.key] ?? '';
      if (col.key === 'Nome') {
        text = truncate(text, ctx.font, 9, col.width - 6);
      }
      drawCellText(page, ctx.font, text, x, top, col, 9);
    }
    x += col.width;
  }
}

function drawCellText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  top: number,
  col: Column,
  size: number,
): void {
  const textWidth = font.widthOfTextAtSize(text, size);
  const tx =
    col.align === 'center'
      ? x + (col.width - textWidth) / 2
      : x + 3;
  page.drawText(text, { x: tx, y: top - LIST_ROW_H + 8, size, font, color: INK });
}

function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return text;
  }
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + '…', size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

// ------------------------------------------------------------------- schema

const CHART_CELL = 15;
const CHART_LABEL_PAD = 16; // spazio per le coordinate
const CHART_TOP_Y = PAGE_H - MARGIN - 24;

/** Un riquadro dello schema che diventerà una pagina del PDF. */
export interface ChartTile {
  /** numero di pagina progressivo (1-based) tra i soli riquadri con punti */
  index: number;
  col0: number;
  row0: number;
  cols: number;
  rows: number;
}

function chartCapacity(): { colsPerPage: number; rowsPerPage: number } {
  return {
    colsPerPage: Math.max(
      1,
      Math.floor((CONTENT_W - CHART_LABEL_PAD) / CHART_CELL),
    ),
    rowsPerPage: Math.max(1, Math.floor((CHART_TOP_Y - MARGIN) / CHART_CELL)),
  };
}

function tileHasStitches(
  cells: Int16Array,
  width: number,
  col0: number,
  row0: number,
  cols: number,
  rows: number,
): boolean {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cells[(row0 + r) * width + (col0 + c)] >= 0) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Suddivide la griglia nei riquadri che diventeranno pagine, escludendo quelli
 * privi di punti (tutte celle vuote). Numerazione progressiva sui soli riquadri
 * mantenuti. Usata sia dal PDF sia dall'anteprima, così coincidono.
 */
export function computeChartTiles(d: {
  width: number;
  height: number;
  cells: Int16Array;
}): ChartTile[] {
  const { colsPerPage, rowsPerPage } = chartCapacity();
  const tilesX = Math.ceil(d.width / colsPerPage);
  const tilesY = Math.ceil(d.height / rowsPerPage);
  const tiles: ChartTile[] = [];
  let page = 0;
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const col0 = tx * colsPerPage;
      const row0 = ty * rowsPerPage;
      const cols = Math.min(colsPerPage, d.width - col0);
      const rows = Math.min(rowsPerPage, d.height - row0);
      if (tileHasStitches(d.cells, d.width, col0, row0, cols, rows)) {
        tiles.push({ index: ++page, col0, row0, cols, rows });
      }
    }
  }
  return tiles;
}

async function drawChart(
  ctx: Ctx,
  options: PatternPdfOptions,
  symbols: SymbolAssignment[],
): Promise<void> {
  const { decomposition: d } = options;
  const symbolByIndex = new Map<number, string>();
  const inkByIndex = new Map<number, RGB>();
  for (const s of symbols) {
    symbolByIndex.set(s.paletteIndex, s.symbol);
    inkByIndex.set(s.paletteIndex, contrastInk(s.color.hex));
  }

  const cell = CHART_CELL;
  const originX = MARGIN + CHART_LABEL_PAD;
  const topY = CHART_TOP_Y;
  const tiles = computeChartTiles(d);

  for (const { index, col0, row0, cols, rows } of tiles) {
    const page = ctx.pdf.addPage([PAGE_W, PAGE_H]);

    const tileLabel =
      tiles.length > 1
        ? options.i18n.t('pdf.chart-tile', {
            index,
            total: tiles.length,
            colFrom: col0 + 1,
            colTo: col0 + cols,
            rowFrom: row0 + 1,
            rowTo: row0 + rows,
          })
        : options.i18n.t('pdf.chart-title');
    page.drawText(tileLabel, {
      x: MARGIN,
      y: PAGE_H - MARGIN,
      size: 10,
      font: ctx.font,
      color: MUTED,
    });

    // celle con ricamo: riempimento colore + simbolo. Le celle vuote
    // restano bianche (nessun fondo) per non caricare la stampa.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const index2 = d.cells[(row0 + r) * d.width + (col0 + c)];
        if (index2 < 0) {
          continue;
        }
        const cellX = originX + c * cell;
        const cellY = topY - (r + 1) * cell;
        const color = d.palette[index2].color.hex;
        page.drawRectangle({
          x: cellX,
          y: cellY,
          width: cell,
          height: cell,
          color: toRgb(color),
        });
        const symbol = symbolByIndex.get(index2) ?? '';
        const size = cell * 0.62;
        const w = ctx.font.widthOfTextAtSize(symbol, size);
        page.drawText(symbol, {
          x: cellX + (cell - w) / 2,
          y: cellY + (cell - size) / 2 + 1,
          size,
          font: ctx.font,
          color: inkByIndex.get(index2) ?? INK,
        });
      }
    }

    drawChartGrid(page, ctx, { originX, topY, cell, cols, rows, col0, row0 });
  }
}

interface GridArgs {
  originX: number;
  topY: number;
  cell: number;
  cols: number;
  rows: number;
  col0: number;
  row0: number;
}

function drawChartGrid(page: PDFPage, ctx: Ctx, g: GridArgs): void {
  const right = g.originX + g.cols * g.cell;
  const bottom = g.topY - g.rows * g.cell;

  // linee verticali
  for (let c = 0; c <= g.cols; c++) {
    const absolute = g.col0 + c;
    const major = absolute % 10 === 0;
    const x = g.originX + c * g.cell;
    page.drawLine({
      start: { x, y: g.topY },
      end: { x, y: bottom },
      thickness: major ? 0.8 : 0.3,
      color: major ? GRID_MAJOR : GRID_MINOR,
    });
    if (major && c < g.cols) {
      page.drawText(String(absolute), {
        x: x + 1,
        y: g.topY + 4,
        size: 7,
        font: ctx.font,
        color: MUTED,
      });
    }
  }
  // linee orizzontali
  for (let r = 0; r <= g.rows; r++) {
    const absolute = g.row0 + r;
    const major = absolute % 10 === 0;
    const y = g.topY - r * g.cell;
    page.drawLine({
      start: { x: g.originX, y },
      end: { x: right, y },
      thickness: major ? 0.8 : 0.3,
      color: major ? GRID_MAJOR : GRID_MINOR,
    });
    if (major && r < g.rows) {
      page.drawText(String(absolute), {
        x: MARGIN - 2,
        y: y - g.cell / 2 - 3,
        size: 7,
        font: ctx.font,
        color: MUTED,
      });
    }
  }
}

function totalStitches(d: PatternDecomposition): number {
  return d.palette.reduce((sum, entry) => sum + entry.count, 0);
}
