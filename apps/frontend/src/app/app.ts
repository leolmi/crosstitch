import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PatternDraftStore } from './features/pattern-wizard/pattern-draft-store';
import { I18nService } from './i18n/i18n.service';
import { TranslatePipe } from './i18n/translate-pipe';
import { TranslationKey } from './i18n/it';
import { ThemeMode, ThemeService } from './theme/theme-service';

/** Etichetta i18n per ciascuna modalità di tema. */
const THEME_LABEL: Record<ThemeMode, TranslationKey> = {
  light: 'theme.light',
  dark: 'theme.dark',
  auto: 'theme.auto',
};

@Component({
  imports: [
    RouterOutlet,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatToolbarModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  /** Nome dell'applicazione (brand, sempre presente in toolbar). */
  protected readonly appName = signal('Crosstitch');
  protected readonly store = inject(PatternDraftStore);
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(ThemeService);

  /** Tooltip/aria del pulsante tema: "Tema: <modalità attiva>". */
  protected readonly themeTooltip = computed(
    () =>
      `${this.i18n.t('toolbar.theme')}: ${this.i18n.t(THEME_LABEL[this.theme.mode()])}`,
  );
}
