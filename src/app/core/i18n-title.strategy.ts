import { inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18n } from './i18n';

/** title из app.routes.ts пишется по-русски; во вкладку уходит перевод на выбранный язык. */
@Injectable({ providedIn: 'root' })
export class I18nTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18n);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const t = this.buildTitle(snapshot);
    if (t !== undefined) this.title.setTitle(this.i18n.t(t));
  }
}
