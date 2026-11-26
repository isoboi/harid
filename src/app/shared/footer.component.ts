import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PwaService } from '../core/pwa.service';
import { TPipe } from '../core/i18n';
import { IconComponent } from './icon.component';
import { LangSwitchComponent } from './lang-switch.component';
import { LogoComponent } from './logo.component';

/** Подвал прототипа: тёмно-синий, логотип с обещанием и две колонки ссылок, внизу строка ©. */
@Component({
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
        <p class="wrap legal">{{ '© {year} Харид, Таджикистан. Instagram — товарный знак Meta Platforms, Inc.' | t: { year } }}</p>
      </div>
    </footer>
  `,
  styles: `
    /* bg-ink text-paper/80: белый 80% на #13235b — контраст выше 10:1 */
    .ftr { margin-top: 96px; background: var(--color-ink); color: rgb(255 255 255 / .8) }
    .cols { display: grid; gap: 40px; padding-block: 48px }
    @media (min-width: 768px) { .cols { grid-template-columns: 1.4fr 1fr 1fr } }
    .about { max-width: 34ch }
    .logo { color: var(--color-paper) }
    .pitch { margin-top: 16px; font-size: 15px; line-height: 1.625 }
    /* Выбранный язык — белая заливка с тёмным текстом, как кнопки на тёмном подвале */
    .lang { display: block; margin-top: 20px; --lang-switch-bg: var(--color-paper); --lang-switch-fg: var(--color-ink) }
    .install { display: inline-flex; align-items: center; gap: 8px; height: 44px; margin-top: 20px; padding: 0 16px; border: 1px solid rgb(255 255 255 / .3); border-radius: 10px; color: var(--color-paper); font-size: 15px; font-weight: 600; cursor: pointer }
    @media (hover: hover) { .install:hover { border-color: var(--color-paper) } }
    .install:focus-visible { outline: 2px solid var(--color-saffron); outline-offset: 2px }
    .h { font-weight: 600; color: var(--color-paper) }
    .links { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; font-size: 15px }
    .links a { display: inline-block }
    @media (hover: hover) { .links a:hover { color: var(--color-paper) } }
    /* Телефон: строка ссылки 44px высотой — палец не промахивается */
    @media (max-width: 639.98px) { .links { gap: 0; margin-top: 4px } .links a { padding-block: 11px } }
    .bottom { border-top: 1px solid rgb(255 255 255 / .1) }
    /* text-paper/60 на ink — около 6:1 */
    .legal { padding-block: 20px; font-size: 13px; color: rgb(255 255 255 / .6) }
    a:focus-visible { outline-color: var(--color-saffron) }
  `,
})
export class FooterComponent {
  protected readonly pwa = inject(PwaService);
  /** Год для строки ©. Сервер и браузер рендерят в один день — расхождения при гидратации нет. */
  readonly year = new Date().getFullYear();
}
