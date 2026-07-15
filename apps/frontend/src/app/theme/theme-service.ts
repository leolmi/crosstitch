/**
 * Tema chiaro/scuro a signals, senza dipendenze esterne. La modalità è un
 * signal; il tema Material M3 (token generati con light-dark()) si ribalta
 * impostando `color-scheme` sull'elemento <html>:
 * - 'light' / 'dark' forzano il tema;
 * - 'auto' torna a 'light dark', ossia segue la preferenza di sistema.
 * La scelta è memorizzata nel browser.
 */
import {
  computed,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemeMode = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'crosstitch.theme';
/** Ordine di rotazione del pulsante: chiaro → scuro → auto → chiaro. */
const ORDER: ThemeMode[] = ['light', 'dark', 'auto'];
const ICONS: Record<ThemeMode, string> = {
  light: 'light_mode',
  dark: 'dark_mode',
  auto: 'contrast',
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _mode = signal<ThemeMode>('auto');
  readonly mode = this._mode.asReadonly();

  /** Icona Material corrispondente alla modalità attiva. */
  readonly icon = computed(() => ICONS[this._mode()]);

  constructor() {
    // lato server niente DOM/storage: si resta su 'auto' (segue il sistema)
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      this._mode.set(readSavedMode() ?? 'auto');
      effect(() => {
        const mode = this._mode();
        document.documentElement.style.colorScheme =
          mode === 'auto' ? 'light dark' : mode;
        try {
          localStorage.setItem(STORAGE_KEY, mode);
        } catch {
          // storage non disponibile (es. navigazione privata): si ignora
        }
      });
    }
  }

  setMode(mode: ThemeMode): void {
    this._mode.set(mode);
  }

  /** Passa alla modalità successiva nell'ordine chiaro → scuro → auto. */
  cycle(): void {
    const next = ORDER[(ORDER.indexOf(this._mode()) + 1) % ORDER.length];
    this._mode.set(next);
  }
}

function readSavedMode(): ThemeMode | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' || saved === 'auto'
      ? saved
      : null;
  } catch {
    return null;
  }
}
