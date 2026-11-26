import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PwaService } from '../core/pwa.service';
import { TPipe } from '../core/i18n';
import { ThemeMode, ThemeService } from '../core/theme.service';
import { IconComponent, IconName } from './icon.component';
import { LangSwitchComponent } from './lang-switch.component';
import { LogoComponent } from './logo.component';

const THEMES: readonly { mode: ThemeMode; label: string; icon: IconName }[] = [
  { mode: 'light', label: 'Светлая', icon: 'sun' },
  { mode: 'dark', label: 'Тёмная', icon: 'moon' },
  { mode: 'system', label: 'Как в системе', icon: 'monitor' },
];

/**
 * Подвал прототипа: тёмно-синий, логотип с обещанием и две колонки ссылок, внизу строка ©.
 * В нижней строке, справа от ©, — выбор темы: «Светлая» (по умолчанию), «Тёмная», «Как в системе» (группа радиокнопок).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, LogoComponent, IconComponent, LangSwitchComponent, TPipe],
  template: `
    <footer class="ftr">
      <div class="wrap cols">
        <div class="about">
          <app-logo class="logo" />
          <p class="pitch">{{ 'Instagram-магазины Таджикистана в одном месте. Платите наличными курьеру, когда заказ у вас в руках.' | t }}</p>
          <app-lang-switch class="lang" />
          <!-- Только там, где браузер разрешил установку (Chrome, Edge, Samsung Internet); в Safari — «Поделиться → На экран Домой» -->
          @if (pwa.canInstall()) {
            <button type="button" class="install" data-test="install-app" (click)="pwa.install()">
              <app-icon name="smartphone" [size]="18" />{{ 'Установить приложение' | t }}
            </button>
          }
        </div>
        <div>
          <h2 class="h">{{ 'Покупателям' | t }}</h2>
          <ul class="links">
            <li><a routerLink="/" fragment="cash">{{ 'Оплата наличными курьеру' | t }}</a></li>
            <li><a routerLink="/cart">{{ 'Корзина' | t }}</a></li>
            <li><a routerLink="/me/orders">{{ 'Мои заказы' | t }}</a></li>
          </ul>
        </div>
        <div>
          <h2 class="h">{{ 'Продавцам' | t }}</h2>
          <ul class="links">
            <li><a routerLink="/sell">{{ 'Открыть лавку' | t }}</a></li>
            <li><a routerLink="/sell" fragment="terms">{{ 'Как это работает' | t }}</a></li>
          </ul>
        </div>
      </div>
      <div class="bottom">
        <div class="wrap bottom-row">
          <p class="legal">{{ '© {year} Харид, Таджикистан. Instagram — товарный знак Meta Platforms, Inc.' | t: { year } }}</p>
          <fieldset class="theme">
            <legend class="theme-h">{{ 'Тема' | t }}</legend>
            <div class="seg">
              @for (t of themes; track t.mode) {
                <label class="opt" [class.on]="theme.mode() === t.mode">
                  <input type="radio" name="theme" class="sr-only" [value]="t.mode" [checked]="theme.mode() === t.mode" (change)="theme.set(t.mode)" [attr.data-test]="'theme-' + t.mode" />
                  <app-icon [name]="t.icon" [size]="16" />{{ t.label | t }}
                </label>
              }
            </div>
          </fieldset>
        </div>
      </div>
    </footer>
  `,
  styles: `
    /* Белый 80%: на #13235b контраст выше 10:1, на подвале тёмной темы (#080c21) — выше 14:1.
       Блик сверху отделяет подвал от страницы в тёмной теме, где фоны близки */
    .ftr { margin-top: 96px; background: var(--color-footer); box-shadow: inset 0 1px 0 rgb(255 255 255 / .08); color: rgb(255 255 255 / .8) }
    .cols { display: grid; gap: 40px; padding-block: 48px }
    @media (min-width: 768px) { .cols { grid-template-columns: 1.4fr 1fr 1fr } }
    .about { max-width: 34ch }
    .logo { color: var(--color-on-night) }
    .pitch { margin-top: 16px; font-size: 15px; line-height: 1.625 }
    /* Выбранный язык — светлая заливка с тёмно-синим текстом: подвал тёмный в обеих темах, поэтому on-night/night, а не paper/ink */
    .lang { display: block; margin-top: 20px; --lang-switch-bg: var(--color-on-night); --lang-switch-fg: var(--color-night) }
    .install { display: inline-flex; align-items: center; gap: 8px; height: 44px; margin-top: 20px; padding: 0 16px; border: 1px solid rgb(255 255 255 / .3); border-radius: 10px; color: var(--color-on-night); font-size: 15px; font-weight: 600; cursor: pointer }
    @media (hover: hover) { .install:hover { border-color: var(--color-on-night) } }
    .install:focus-visible { outline: 2px solid var(--color-saffron); outline-offset: 2px }
    /* Выбор темы справа от ©: «Тема» и сегменты в строку (legend с float встаёт в строку), на телефоне — под ©.
       Выбранный сегмент — светлая подложка; фокус клавиатуры — шафрановая рамка */
    .theme { display: flex; align-items: center; gap: 10px }
    .theme-h { float: left; font-size: 13px; font-weight: 600; color: var(--color-on-night) }
    .seg { display: inline-flex; gap: 2px; padding: 3px; border: 1px solid rgb(255 255 255 / .2); border-radius: 12px }
    .opt { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 10px; border-radius: 9px; font-size: 13px; font-weight: 500; white-space: nowrap; cursor: pointer; transition: background-color .15s, color .15s }
    .opt.on { background: rgb(255 255 255 / .16); color: var(--color-on-night) }
    @media (hover: hover) { .opt:hover { color: var(--color-on-night) } }
    .opt:has(:focus-visible) { outline: 2px solid var(--color-saffron); outline-offset: 2px }
    /* Телефон: сегменты 44px высотой, без иконок — три варианта помещаются в строку на 360px */
    @media (max-width: 639.98px) { .opt { min-height: 44px } .opt app-icon { display: none } }
    .h { font-weight: 600; color: var(--color-on-night) }
    .links { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; font-size: 15px }
    .links a { display: inline-block }
    @media (hover: hover) { .links a:hover { color: var(--color-on-night) } }
    /* Телефон: строка ссылки 44px высотой — палец не промахивается */
    @media (max-width: 639.98px) { .links { gap: 0; margin-top: 4px } .links a { padding-block: 11px } }
    .bottom { border-top: 1px solid rgb(255 255 255 / .1) }
    /* text-paper/60 на ink — около 6:1 */
    .bottom-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 24px; padding-block: 16px }
    .legal { font-size: 13px; color: rgb(255 255 255 / .6) }
    a:focus-visible { outline-color: var(--color-saffron) }
  `,
})
export class FooterComponent {
  protected readonly pwa = inject(PwaService);
  protected readonly theme = inject(ThemeService);
  protected readonly themes = THEMES;
  /** Год для строки ©. Сервер и браузер рендерят в один день — расхождения при гидратации нет. */
  readonly year = new Date().getFullYear();
}
