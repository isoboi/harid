import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Shop } from '../core/models';
import { ShopAvatarComponent } from './shop-avatar.component';

/** Лента лавок как сторис: кружок 72px с кольцом и ник под ним, листается вбок. */
@Component({
  selector: 'app-shop-strip',
  standalone: true,
  imports: [RouterLink, ShopAvatarComponent],
  template: `
    <section aria-label="Лавки" class="strip-wrap">
      <ul class="strip">
        @for (s of shops(); track s.handle) {
          <li>
            <a class="shop" [routerLink]="['/shop', s.handle]">
              <app-shop-avatar [name]="s.name || s.handle" [color]="s.avatar_color" [fresh]="s.has_fresh" [avatarUrl]="s.avatar_url" [handle]="s.handle" [size]="72" />
              <span class="h">{{ s.handle }}</span>
            </a>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    .strip-wrap { padding-top: 20px }
    .strip { display: flex; gap: 16px; margin-inline: -16px; padding: 0 16px 4px; overflow-x: auto; scroll-snap-type: x proximity; scrollbar-width: none }
    .strip::-webkit-scrollbar { display: none }
    @media (min-width: 640px) { .strip { margin-inline: -24px; padding-inline: 24px } }
    li { scroll-snap-align: start }
    .shop { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 76px; border-radius: var(--radius-lg) }
    .h { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; font-size: 12px; color: var(--color-ink-soft) }
  `,
})
export class ShopStripComponent {
  readonly shops = input.required<Shop[]>();
}
