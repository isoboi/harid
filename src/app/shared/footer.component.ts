import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogoComponent } from './logo.component';

/** Подвал прототипа: тёмно-синий, логотип с обещанием и две колонки ссылок, внизу строка ©. */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, LogoComponent],
  template: `
    <footer class="ftr">
      <div class="wrap cols">
        <div class="about">
          <app-logo class="logo" />
          <p class="pitch">Instagram-магазины Таджикистана в одном месте. Платите наличными курьеру, когда заказ у вас в руках.</p>
        </div>
        <div>
          <h2 class="h">Покупателям</h2>
          <ul class="links">
            <li><a routerLink="/" fragment="cash">Оплата наличными курьеру</a></li>
            <li><a routerLink="/cart">Корзина</a></li>
            <li><a routerLink="/me/orders">Мои заказы</a></li>
          </ul>
        </div>
        <div>
          <h2 class="h">Продавцам</h2>
          <ul class="links">
            <li><a routerLink="/sell">Открыть лавку</a></li>
            <li><a routerLink="/sell" fragment="terms">Как это работает</a></li>
          </ul>
        </div>
      </div>
      <div class="bottom">
        <p class="wrap legal">© {{ year }} Харид, Таджикистан. Instagram — товарный знак Meta Platforms, Inc.</p>
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
  /** Год для строки ©. Сервер и браузер рендерят в один день — расхождения при гидратации нет. */
  readonly year = new Date().getFullYear();
}
