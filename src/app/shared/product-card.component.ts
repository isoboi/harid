import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../core/models';
import { IconComponent } from './icon.component';
import { MoneyPipe } from './money.pipe';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, MoneyPipe, IconComponent],
  template: `
    @let p = product();
    <a class="card" [routerLink]="['/product', p.id]">
      <div class="img">@if (p.image) { <img [src]="p.image" [alt]="p.title" loading="lazy" /> } @else { <span class="ph">Нет фото</span> }</div>
      <div class="price"><b>{{ p.price | money }}</b>@if (p.old_price) { <s>{{ p.old_price | money }}</s> }</div>
      <div class="title">{{ p.title }}</div>
      <div class="shop muted">&#64;{{ p.shop_handle }}</div>
      <div class="cod" data-test="cod"><app-icon name="banknote" [size]="14" />Оплата при получении</div>
    </a>
  `,
  styles: `
    .card { display:block; color:inherit; text-decoration:none }
    .img { aspect-ratio:1; border-radius:var(--radius); overflow:hidden; background:var(--surface); display:grid; place-items:center }
    .img img { width:100%; height:100%; object-fit:cover } .ph { color:var(--muted); font-size:13px }
    .price { margin-top:8px; display:flex; gap:8px; align-items:baseline } .price s { color:var(--muted); font-size:13px }
    .title { font-size:14px; line-height:1.3 } .shop { font-size:13px }
    /* Тихая пометка: обещание видно в ленте, но не спорит с ценой */
    .cod { display:flex; align-items:center; gap:5px; margin-top:4px; font-size:12px; color:var(--muted) }
  `,
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
}
