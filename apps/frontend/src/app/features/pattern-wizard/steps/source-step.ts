import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { I18nService } from '../../../i18n/i18n.service';
import { TranslatePipe } from '../../../i18n/translate-pipe';
import { PatternDraftStore } from '../pattern-draft-store';
import { SourceImportService } from '../source-import-service';

@Component({
  selector: 'app-source-step',
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    TranslatePipe,
  ],
  templateUrl: './source-step.html',
  styleUrl: './source-step.scss',
})
export class SourceStep {
  private readonly importer = inject(SourceImportService);
  private readonly i18n = inject(I18nService);
  protected readonly store = inject(PatternDraftStore);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dragOver = signal(false);
  protected readonly url = signal('');

  protected onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      void this.loadFile(file);
    }
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  protected onDragLeave(): void {
    this.dragOver.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      void this.loadFile(file);
    }
  }

  protected loadFromUrl(): void {
    const url = this.url().trim();
    if (!url) {
      return;
    }
    void this.run(() => this.importer.importFromUrl(url));
  }

  protected remove(): void {
    this.store.clearSource();
    this.error.set(null);
  }

  private loadFile(file: File): Promise<void> {
    return this.run(() => this.importer.importFile(file));
  }

  /** Esegue un'azione di import gestendo stato di caricamento ed errori. */
  private async run(action: () => Promise<void>): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (error) {
      this.error.set(this.i18n.errorText(error, 'errors.load-generic'));
    } finally {
      this.loading.set(false);
    }
  }
}
