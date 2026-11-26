import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Shop } from '../core/models';
import { ShopAvatarComponent } from './shop-avatar.component';

/** Лента лавок как сторис: кружок 72px с кольцом и ник под ним, листается вбок. Пока shops не пришли (undefined) — серые кружки. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-shop-strip',
  standalone: true,
  imports: [RouterLink, ShopAvatarComponent],
  template: `
    <section aria-label="Лавки" class="strip-wrap">
      @if (shops(); as list) {
        <ul class="strip">
          @for (s of list; track s.handle) {
            <li>
              <a class="shop" [routerLink]="['/shop', s.handle]">
                <app-shop-avatar [name]="s.name || s.handle" [color]="s.avatar_color" [fresh]="s.has_fresh" [avatarUrl]="s.avatar_url" [handle]="s.handle" [size]="72" />
                <span class="h">{{ s.handle }}</span>
              </a>
            </li>
          }
        </ul>
      } @else {
        <span class="sr-only" role="status">Загрузка…</span>
        <ul class="strip" aria-hidden="true" data-test="skel-shops">
          @for (n of skeleton; track n) { <li class="shop"><span class="skel skel--round ava"></span><span class="skel skel--line h-skel"></span></li> }
        </ul>
      }
    </section>
  `,
  styles: `
    .strip-wrap { padding-top: 20px }
    .strip { display: flex; gap: 16px; margin-inline: -16px; padding: 0 16px 4px; overflow-x: auto; scroll-snap-type: x proximity; scrollbar-width: none }
    .strip::-webkit-scrollbar { display: none }
    @media (min-width: 640px) { .strip { margin-inline: -24px; padding-inline: 24px } }
    /* Телефон: привязка к кружку учитывает поле 16px, первая лавка не прилипает к краю экрана */
    @media (max-width: 640px) { .strip { scroll-padding-inline: 16px } }
    li { scroll-snap-align: start }
    .shop { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 76px; border-radius: var(--radius-lg) }
    .ava { width: 72px; height: 72px }
    .h-skel { height: 12px; width: 52px; margin-block: 3px }
    .h { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; font-size: 12px; color: var(--color-ink-soft) }
  `,
})
export class ShopStripComponent {
  /** undefined — ещё грузятся. */
  readonly shops = input.required<Shop[] | undefined>();
  readonly skeleton = [1, 2, 3, 4, 5, 6, 7, 8];
}
