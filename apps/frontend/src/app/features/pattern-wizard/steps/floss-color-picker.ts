import { Component, computed, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FlossColor, getFlossColors } from '@crosstitch/floss-colors';
import { TranslatePipe } from '../../../i18n/translate-pipe';
import { FlossStandard } from '../pattern-draft-store';

export interface FlossPickerData {
  standard: FlossStandard;
  /** Colori già presenti nello schema, mostrati per primi. */
  paletteInUse: readonly FlossColor[];
  current?: FlossColor;
}

@Component({
  selector: 'app-floss-color-picker',
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslatePipe,
  ],
  templateUrl: './floss-color-picker.html',
  styleUrl: './floss-color-picker.scss',
})
export class FlossColorPicker {
  private readonly data = inject<FlossPickerData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<FlossColorPicker, FlossColor>>(MatDialogRef);

  protected readonly standard = this.data.standard;
  protected readonly current = this.data.current;
  protected readonly inUse = this.data.paletteInUse;
  protected readonly query = signal('');

  private readonly catalog =
    this.standard === 'anchor'
      ? getFlossColors().filter((c) => c.anchor)
      : getFlossColors();

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) {
      return this.catalog;
    }
    return this.catalog.filter(
      (c) =>
        c.dmc.toLowerCase().includes(q) ||
        (c.anchor ?? '').toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q),
    );
  });

  protected code(color: FlossColor): string {
    return this.standard === 'anchor' ? (color.anchor ?? '—') : color.dmc;
  }

  protected altCode(color: FlossColor): string {
    return this.standard === 'anchor'
      ? `DMC ${color.dmc}`
      : color.anchor
        ? `Anchor ${color.anchor}`
        : 'Anchor —';
  }

  protected isCurrent(color: FlossColor): boolean {
    return color.dmc === this.current?.dmc;
  }

  protected pick(color: FlossColor): void {
    this.ref.close(color);
  }
}
