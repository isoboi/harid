import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Shop } from '../core/models';

/** Лента лавок: кружок с первой буквой и ник. */
@Component({
  selector: 'app-shop-strip',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="strip">
      @for (s of shops(); track s.handle) {
        <a class="shop" [routerLink]="['/shop', s.handle]">
          <span class="ava" [class.fresh]="s.has_fresh" [style.background]="s.avatar_color">{{ s.handle.charAt(0).toUpperCase() }}</span>
          <span class="h">{{ s.handle }}</span>
        </a>
      }
    </div>
  `,
  styles: `
    .strip { display:flex; gap:16px; overflow-x:auto; padding:8px 0 }
    .shop { display:flex; flex-direction:column; align-items:center; gap:6px; color:inherit; text-decoration:none; min-width:72px }
    .ava { width:60px; height:60px; border-radius:50%; display:grid; place-items:center; color:#fff; font-weight:700; font-size:22px }
    .ava.fresh { outline:3px solid var(--accent); outline-offset:2px } .h { font-size:12px }
  `,
})
export class ShopStripComponent {
  readonly shops = input.required<Shop[]>();
}
