import { inject, Pipe, PipeTransform } from '@angular/core';
import { I18nService } from './i18n.service';
import { TranslationKey } from './it';

/**
 * Pipe `t` per tradurre nei template: {{ 'common.next' | t }} oppure con
 * parametri {{ 'editor.wand.tolerance' | t: { tolerance: tolerance() } }}.
 *
 * È impura per rivalutarsi al cambio di lingua (il cui signal non fa parte
 * degli argomenti della pipe); il costo è trascurabile per questa app.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(
    key: TranslationKey,
    params?: Record<string, string | number>,
  ): string {
    return this.i18n.t(key, params);
  }
}
