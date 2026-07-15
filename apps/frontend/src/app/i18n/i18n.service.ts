/**
 * Localizzazione a signals, senza dipendenze esterne. La lingua attiva è un
 * signal; cambiarla aggiorna all'istante ogni traduzione nei template (via la
 * pipe `t`), riflette `<html lang>` e memorizza la scelta nel browser.
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
import { en } from './en';
import { it, TranslationKey } from './it';

export type Lang = 'it' | 'en';

const STORAGE_KEY = 'crosstitch.lang';
const DICTS: Record<Lang, Record<TranslationKey, string>> = { it, en };

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _lang = signal<Lang>('it');
  readonly lang = this._lang.asReadonly();

  private readonly dict = computed(() => DICTS[this._lang()]);

  constructor() {
    // lato server niente storage/DOM: si resta sul default e si idrata poi
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      this._lang.set(readSavedLang() ?? detectBrowserLang());
      effect(() => {
        const lang = this._lang();
        document.documentElement.lang = lang;
        try {
          localStorage.setItem(STORAGE_KEY, lang);
        } catch {
          // storage non disponibile (es. navigazione privata): si ignora
        }
      });
    }
  }

  setLang(lang: Lang): void {
    this._lang.set(lang);
  }

  /** Traduce una chiave, interpolando gli eventuali parametri {nome}. */
  t(key: TranslationKey, params?: Record<string, string | number>): string {
    const template = this.dict()[key] ?? key;
    if (!params) {
      return template;
    }
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  }

  /**
   * Messaggio d'errore localizzato: usa la chiave `code` dell'errore se
   * presente e valida (es. PatternFileError), poi il messaggio già tradotto
   * dell'Error, infine la chiave di ripiego.
   */
  errorText(err: unknown, fallback: TranslationKey): string {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code?: unknown }).code;
      if (typeof code === 'string' && code in this.dict()) {
        return this.t(code as TranslationKey);
      }
    }
    return err instanceof Error && err.message ? err.message : this.t(fallback);
  }
}

function readSavedLang(): Lang | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'it' || saved === 'en' ? saved : null;
  } catch {
    return null;
  }
}

function detectBrowserLang(): Lang {
  const nav = (navigator.language || '').toLowerCase();
  return nav.startsWith('en') ? 'en' : 'it';
}
