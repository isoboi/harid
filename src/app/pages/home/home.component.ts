import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { MarketApi } from '../../core/market-api.service';
import { SeoService } from '../../core/seo.service';
import { ProductCardComponent } from '../../shared/product-card.component';
import { plural } from '../../shared/plural';
import { ShopStripComponent } from '../../shared/shop-strip.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ProductCardComponent, ShopStripComponent],
  template: `
    <app-shop-strip [shops]="shops()" />
    <section class="hero">
      <h1>Покупайте в Instagram-магазинах Душанбе без предоплаты</h1>
      <p class="muted">{{ shops().length }} {{ plural(shops().length, shopForms) }} уже здесь. Платите наличными курьеру, когда заказ у вас в руках.</p>
      <div class="cta"><a class="btn" href="#new">Смотреть товары</a><a class="btn btn--ghost" routerLink="/sell">У меня Instagram-магазин</a></div>
    </section>
    <h2 id="new">Новое в лавках</h2>
    <nav class="cats"><a routerLink="/">Всё</a>@for (c of categories(); track c.slug) { <a [routerLink]="['/c', c.slug]">{{ c.name }}</a> }</nav>
    @if (products().length) { <div class="grid">@for (p of products(); track p.id) { <app-product-card [product]="p" /> }</div> }
    @else { <p class="muted">Пока пусто</p> }
    <section id="cash" class="how">
      <h2>Оплата наличными курьеру</h2>
      <p class="muted">Не нужно переводить предоплату на карту незнакомому человеку из директа.</p>
      <ol>
        <li><b>Оформляете заказ</b> — без оплаты на сайте.</li>
        <li><b>Лавка собирает заказ</b> и передаёт курьеру.</li>
        <li><b>Курьер привозит</b> в выбранное время.</li>
        <li><b>Проверяете при курьере и платите наличными.</b> Не подошло — не берёте.</li>
      </ol>
    </section>
  `,
  styles: `
    .hero { padding:32px 0 } .hero h1 { font-size:clamp(26px,4vw,40px); margin:0 0 8px } .cta { display:flex; gap:12px; flex-wrap:wrap; margin-top:16px } .cta a { text-decoration:none }
    .cats { display:flex; gap:8px; overflow-x:auto; margin-bottom:16px } .cats a { padding:6px 14px; border:1px solid var(--line); border-radius:999px; color:inherit; text-decoration:none; white-space:nowrap; font-size:14px }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:16px }
    .how { margin-top:48px } .how ol { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:16px; padding-left:18px }
  `,
})
export class HomeComponent {
  readonly plural = plural;
  readonly shopForms: [string, string, string] = ['лавка', 'лавки', 'лавок'];
  private readonly api = inject(MarketApi);
  readonly shops = toSignal(this.api.shops().pipe(catchError(() => of([]))), { initialValue: [] });
  readonly categories = toSignal(this.api.categories().pipe(catchError(() => of([]))), { initialValue: [] });
  readonly products = toSignal(this.api.products({ limit: 24 }).pipe(catchError(() => of([]))), { initialValue: [] });
  constructor() {
    inject(SeoService).set({ title: 'Харид — Instagram-магазины Душанбе', description: 'Товары Instagram-лавок Душанбе с оплатой наличными курьеру.' });
  }
}
