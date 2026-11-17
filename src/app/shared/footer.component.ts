import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="ftr">
      <div><b>Покупателям</b><a routerLink="/" fragment="cash">Оплата наличными курьеру</a><a routerLink="/me/orders">Мои заказы</a></div>
      <div><b>Продавцам</b><a routerLink="/sell">Открыть лавку</a></div>
    </footer>
  `,
  styles: `
    .ftr { display:flex; gap:48px; padding:32px 16px; border-top:1px solid var(--line); margin-top:48px; color:var(--muted) }
    .ftr div { display:flex; flex-direction:column; gap:8px } .ftr a { color:var(--muted); text-decoration:none }
  `,
})
export class FooterComponent {}
