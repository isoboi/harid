import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { MarketApi } from '../../core/market-api.service';
import { SeoService } from '../../core/seo.service';
import { websiteLd } from '../../core/structured-data';
import { PriceTagComponent } from '../../shared/price-tag.component';
import { ProductCardComponent } from '../../shared/product-card.component';
import { plural } from '../../shared/plural';
import { FeedMoreComponent, ProductFeed } from '../../shared/product-feed';
import { ShopStripComponent } from '../../shared/shop-strip.component';

/** Четыре шага оплаты наличными — в раскладке «Как это работает» прототипа. */
const CASH_STEPS = [
  { title: 'Оформляете заказ', text: 'Без оплаты на сайте и без перевода на карту.' },
  { title: 'Лавка собирает заказ', text: 'И передаёт его курьеру.' },
  { title: 'Курьер привозит', text: 'В выбранное время.' },
  { title: 'Проверяете при курьере и платите наличными', text: 'Не подошло — не берёте.' },
];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ProductCardComponent, ShopStripComponent, PriceTagComponent, FeedMoreComponent],
  template: `
    <div class="wrap">
      <app-shop-strip [shops]="shops()" />
      <section class="hero" [class.solo]="!collage().length">
        <div>
          <h1 class="hero-title">Покупайте в Instagram-магазинах Таджикистана без предоплаты на чужую карту</h1>
          <p class="hero-lead">{{ shops().length }} {{ plural(shops().length, shopForms) }} уже здесь. Платите наличными курьеру, когда заказ у вас в руках.</p>
          <div class="cta"><a class="btn" href="#fresh">Смотреть товары</a><a class="btn btn--ghost" routerLink="/sell">У меня Instagram-магазин</a></div>
        </div>
        <!-- Коллаж из реальных товаров: большое фото и до двух квадратных -->
        @if (collage().length) {
          <div class="collage">
            @for (p of collage(); track p.id; let first = $first) {
              <a class="tile" [class.big]="first" [routerLink]="['/product', p.id]">
                <img [src]="p.image" [alt]="p.title" [attr.loading]="first ? null : 'lazy'" />
                <app-price-tag class="tag" [price]="p.price" [old]="p.old_price" [size]="first ? 'lg' : 'sm'" />
                @if (first) {
                  <span class="cap"><span class="cap-t">{{ p.title }}</span><span class="cap-s">&#64;{{ p.shop_handle }}</span></span>
                }
              </a>
            }
          </div>
        }
      </section>
      <section id="fresh" class="fresh">
        <div class="fresh-head"><h2 class="fresh-title">Новое в лавках</h2></div>
        <nav class="chips" aria-label="Категории">
          <a class="chip chip--on" routerLink="/" aria-current="page">Всё</a>
          @for (c of categories(); track c.slug) { <a class="chip" [routerLink]="['/c', c.slug]">{{ c.name }}</a> }
        </nav>
        <div class="list">
          @if (products().length) { <div class="products">@for (p of products(); track p.id) { <app-product-card [product]="p" /> }</div> }
          @else if (!feed.loading()) { <p class="muted">Пока пусто</p> }
          @if (!feed.done()) { <app-feed-more [feed]="feed" /> }
        </div>
      </section>
    </div>
    <section id="cash" class="how">
      <div class="wrap how-grid">
        <div>
          <h2 class="how-title">Оплата наличными курьеру</h2>
          <p class="how-lead">Не нужно переводить предоплату на карту незнакомому человеку из директа.</p>
        </div>
        <ol class="steps">
          @for (s of steps; track s.title; let i = $index) {
            <li><span class="num" aria-hidden="true">{{ i + 1 }}</span><h3>{{ s.title }}</h3><p>{{ s.text }}</p></li>
          }
        </ol>
      </div>
    </section>
  `,
  styles: `
    .hero { display: grid; align-items: center; gap: 40px; padding-block: 40px }
    @media (min-width: 768px) { .hero { grid-template-columns: 1fr 1.05fr; padding-block: 56px } .hero.solo { grid-template-columns: 1fr } }
    .hero-title { max-width: 17ch; font-size: 38px; line-height: 1.04; font-weight: 800; letter-spacing: -0.035em }
    @media (min-width: 640px) { .hero-title { font-size: 54px } }
    .hero-lead { margin-top: 20px; max-width: 44ch; font-size: 18px; line-height: 1.625; color: var(--color-ink-soft) }
    .cta { margin-top: 28px; display: flex; flex-wrap: wrap; gap: 12px }
    .collage { display: grid; grid-template-columns: 1.35fr 1fr; gap: 12px }
    .tile { position: relative; aspect-ratio: 1; overflow: hidden; border-radius: var(--radius-photo); background: var(--color-mist) }
    .tile.big { grid-row: span 2; aspect-ratio: 4 / 5 }
    /* Один товар с фото — плитка во всю ширину коллажа, но пониже, чтобы не растягивать первый экран */
    .collage:has(.tile:only-child) { grid-template-columns: 1fr }
    .collage:has(.tile:only-child) .tile.big { aspect-ratio: 5 / 4 }
    .tile img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover }
    .tag { position: absolute; top: 12px; left: 10px }
    .big .tag { top: 16px; left: 12px }
    .cap { position: absolute; left: 12px; right: 12px; bottom: 12px; border-radius: var(--radius-lg); background: rgb(255 255 255 / .95); padding: 8px 12px; font-size: 14px; line-height: 1.375 }
    .cap-t { font-weight: 600 }
    .cap-s { display: block; color: var(--color-ink-soft) }
    .fresh { scroll-margin-top: 96px; padding-bottom: 64px }
    /* Телефон: первый экран сразу с товарами — блок-приветствие скрыт стилями (разметка с сервера та же,
       на десктопе он на месте). «Продавцам» на телефоне — в подвале и на странице каталога */
    @media (max-width: 640px) { .hero { display: none } .fresh { margin-top: 28px; scroll-margin-top: 16px } }
    .fresh-head { margin-bottom: 20px; display: flex; align-items: flex-end; justify-content: space-between; gap: 16px }
    .fresh-title { font-size: 26px; font-weight: 800; letter-spacing: -0.02em }
    .list { margin-top: 24px }
    /* Полоса на всю ширину: bg-mist, слева заголовок, справа четыре шага сеткой с линиями 1px */
    .how { scroll-margin-top: 96px; background: var(--color-mist) }
    .how-grid { display: grid; gap: 40px; padding-block: 56px }
    @media (min-width: 768px) { .how-grid { grid-template-columns: .9fr 1.1fr; padding-block: 80px } }
    .how-title { max-width: 16ch; font-size: 32px; line-height: 1.08; font-weight: 800; letter-spacing: -0.03em }
    @media (min-width: 640px) { .how-title { font-size: 40px } }
    .how-lead { margin-top: 16px; max-width: 42ch; font-size: 17px; line-height: 1.625; color: var(--color-ink-soft) }
    .steps { display: grid; gap: 1px; overflow: hidden; border-radius: var(--radius-photo); background: var(--color-line) }
    @media (min-width: 640px) { .steps { grid-template-columns: repeat(2, minmax(0, 1fr)) } }
    .steps li { background: var(--color-paper); padding: 24px }
    .num { font-family: var(--font-hand); font-size: 34px; line-height: 1; font-weight: 700; color: var(--color-lapis) }
    .steps h3 { margin-top: 12px; font-size: 17px; font-weight: 600 }
    .steps p { margin-top: 6px; font-size: 15px; line-height: 1.625; color: var(--color-ink-soft) }
  `,
})
export class HomeComponent {
  readonly plural = plural;
  readonly shopForms: [string, string, string] = ['лавка', 'лавки', 'лавок'];
  readonly steps = CASH_STEPS;
  private readonly api = inject(MarketApi);
  readonly shops = toSignal(this.api.shops().pipe(catchError(() => of([]))), { initialValue: [] });
  readonly categories = toSignal(this.api.categories().pipe(catchError(() => of([]))), { initialValue: [] });
  /** Лента «Новое в лавках»: догружается при прокрутке. */
  readonly feed = new ProductFeed();
  readonly products = this.feed.items;
  /** Для коллажа в первом экране — первые три товара с фото. */
  readonly collage = computed(() => this.products().filter((p) => !!p.image).slice(0, 3));
  constructor() {
    const seo = inject(SeoService);
    seo.set({ title: 'Харид — Instagram-магазины Таджикистана', description: 'Товары Instagram-лавок Таджикистана с оплатой наличными курьеру.', jsonLd: websiteLd(seo.origin()) });
    this.feed.reset({});
  }
}
