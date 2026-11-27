import { inject, Injectable, signal } from '@angular/core';
import { BrowserStorage } from './browser-storage.service';
import { Router } from '@angular/router';
import { Haptics } from './haptics.service';
import { I18n } from './i18n';
import { ToastService } from './toast.service';

const KEY = 'harid.fav';

/** Избранное — id товаров в браузере. Стартует пустым, данные — из hydrate(). */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly store = inject(BrowserStorage);
  private readonly haptics = inject(Haptics);
  private readonly toasts = inject(ToastService);
  private readonly i18n = inject(I18n);
  /** Только чтобы не предлагать «Открыть» на самой странице избранного; в тестах сервиса роутера может не быть. */
  private readonly router = inject(Router, { optional: true });
  private loaded = false;
  private readonly state = signal<string[]>([]);
  private readonly readyState = signal(false);
  readonly ready = this.readyState.asReadonly();
  readonly ids = this.state.asReadonly();

  /** Загрузка из localStorage один раз; нестроковые значения отбрасываются. */
  hydrate(): void {
    if (this.loaded) return;
    this.loaded = true;
    const saved = this.store.get<unknown>(KEY, []);
    this.state.set(Array.isArray(saved) ? saved.filter((x): x is string => typeof x === 'string') : []);
    this.readyState.set(true);
  }
  has(id: string): boolean { return this.state().includes(id); }
  /**
   * Сердечко на карточке, на странице товара, двойной тап по видео.
   * Добавление — лёгкая вибрация и «Добавлено в избранное · Открыть» (на самой странице избранного — без ссылки);
   * удаление — «Убрано из избранного · Вернуть», товар возвращается на прежнее место.
   */
  toggle(id: string): void {
    this.hydrate();
    const index = this.state().indexOf(id);
    if (index < 0) {
      this.save([...this.state(), id]);
      this.haptics.light();
      const onFavorites = (this.router?.url ?? '').startsWith('/favorites');
      this.toasts.show({ text: this.i18n.t('Добавлено в избранное'), action: onFavorites ? undefined : { label: this.i18n.t('Открыть'), link: '/favorites' } });
      return;
    }
    this.save(this.state().filter((x) => x !== id));
    this.toasts.show({ text: this.i18n.t('Убрано из избранного'), action: { label: this.i18n.t('Вернуть'), run: () => this.restore(id, index) } });
  }

  /** «Вернуть»: на прежнее место; если товар уже добавили снова — ничего не меняется. */
  private restore(id: string, index: number): void {
    const list = this.state();
    if (list.includes(id)) return;
    const at = Math.min(index, list.length);
    this.save([...list.slice(0, at), id, ...list.slice(at)]);
  }

  private save(list: string[]): void {
    this.state.set(list);
    this.store.set(KEY, list);
  }
}
