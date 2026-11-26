import { Component, inject } from '@angular/core';
import { I18n, Lang } from '../core/i18n';

/**
 * Русский / тоҷикӣ — две кнопки рядом. Каждый язык подписан на нём самом (и lang у кнопки —
 * диктор читает правильным голосом). Выбор — cookie и перезагрузка той же страницы.
 * Рамка от currentColor, заливка выбранной — из --lang-switch-bg/-fg: годится и для тёмного подвала, и для светлой страницы.
 */
@Component({
  selector: 'app-lang-switch',
  standalone: true,
  template: `
    <div class="sw" role="group" [attr.aria-label]="i18n.t('Язык')">
      @for (l of langs; track l.code) {
        <button type="button" [attr.lang]="l.code" [attr.aria-pressed]="i18n.lang === l.code" (click)="i18n.setLang(l.code)">{{ l.name }}</button>
      }
    </div>
  `,
  styles: `
    .sw { display: inline-flex; padding: 3px; border: 1px solid color-mix(in srgb, currentColor 30%, transparent); border-radius: 12px }
    button { min-height: 38px; padding: 0 14px; border-radius: 9px; font-size: 15px; font-weight: 600; color: inherit; cursor: pointer }
    /* Выбранная — заливка; на тёмном фоне (подвал) родитель меняет цвета через --lang-switch-bg/-fg */
    button[aria-pressed='true'] { background: var(--lang-switch-bg, var(--color-ink)); color: var(--lang-switch-fg, var(--color-paper)) }
    @media (hover: hover) { button[aria-pressed='false']:hover { background: color-mix(in srgb, currentColor 12%, transparent) } }
    button:focus-visible { outline: 2px solid var(--color-saffron); outline-offset: 2px }
  `,
})
export class LangSwitchComponent {
  protected readonly i18n = inject(I18n);
  protected readonly langs: { code: Lang; name: string }[] = [
    { code: 'ru', name: 'Русский' },
    { code: 'tg', name: 'Тоҷикӣ' },
  ];
}
