import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { I18n } from '../core/i18n';

/**
 * Кружок лавки как в прототипе: кольцо 3px (шафран — есть свежие посты, иначе серое),
 * белая обводка 2px и цветной круг с первой буквой. Буква — 36% диаметра.
 * Если есть avatarUrl (фото профиля Instagram) — внутри кольца круглое фото; при ошибке загрузки
 * возвращается буква. Разметка сервера и первый рендер клиента совпадают: img рисуется по наличию url,
 * а на букву переключает только событие error, которое бывает лишь в браузере.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-shop-avatar',
  standalone: true,
  host: { 'aria-hidden': 'true' },
  template: `
    <span class="ring" [class.fresh]="fresh()" [style.width.px]="size()" [style.height.px]="size()">
      @if (showPhoto()) {
        <img class="face photo" [src]="avatarUrl()" [alt]="alt()" referrerpolicy="no-referrer" (error)="failedUrl.set(avatarUrl())" />
      } @else {
        <span class="face" [style.background]="color() || 'var(--color-lapis-deep)'" [style.font-size.px]="size() * 0.36">{{ letter() }}</span>
      }
    </span>
  `,
  styles: `
    :host { display: inline-flex; flex-shrink: 0 }
    .ring { display: inline-grid; place-items: center; padding: 3px; border-radius: 9999px; background: var(--color-line) }
    .ring.fresh { background: var(--color-saffron) }
    .photo { display: block; object-fit: cover; background: var(--color-line) }
    .face { display: grid; place-items: center; width: 100%; height: 100%; border: 2px solid var(--color-paper); border-radius: 9999px; color: #fff; font-weight: 700; line-height: 1 }
  `,
})
export class ShopAvatarComponent {
  /** Имя или ник лавки: из него берётся первая буква. */
  readonly name = input.required<string>();
  readonly color = input<string>('');
  readonly size = input<number>(72);
  readonly fresh = input<boolean>(false);
  /** Ник без @ для alt; если не задан — берётся из name. */
  readonly handle = input<string>('');
  /** Фото профиля Instagram (avatar_url лавки). */
  readonly avatarUrl = input<string | null | undefined>(null);
  /** Url, который не загрузился: при смене url фото пробуется заново. */
  protected readonly failedUrl = signal<string | null | undefined>(null);
  protected readonly showPhoto = computed(() => !!this.avatarUrl() && this.avatarUrl() !== this.failedUrl());
  private readonly i18n = inject(I18n);
  protected readonly alt = computed(() => this.i18n.t('Аватар @{handle}', { handle: (this.handle() || this.name()).replace(/^@/, '') }));
  protected readonly letter = computed(() => this.name().replace(/^@/, '').charAt(0).toUpperCase());
}
