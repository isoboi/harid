import { computed, inject, Injectable, signal } from '@angular/core';
import { BrowserStorage } from './browser-storage.service';
import { Router } from '@angular/router';
import { Haptics } from './haptics.service';
import { I18n } from './i18n';
import { Product } from './models';
import { dropOf, isFreshDrop, parseMarks, PriceMark } from './price-watch';
import { ToastService } from './toast.service';

const KEY = 'harid.fav';
/** Цены избранного для «Подешевело»: отдельный ключ, чтобы формат harid.fav (список id) не менялся. */
const PRICES_KEY = 'harid.fav.prices';

/** Что нужно о товаре, чтобы следить за его ценой. */
export type Priced = Pick<Product, 'price' | 'in_stock'>;

/** Избранное — id товаров в браузере и цены для «Подешевело». Стартует пустым, данные — из hydrate(). */
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
  private readonly marksState = signal<Record<string, PriceMark>>({});
  private readonly readyState = signal(false);
  readonly ready = this.readyState.asReadonly();
  readonly ids = this.state.asReadonly();
  /** Метки цен по id (см. price-watch.ts). */
  readonly marks = this.marksState.asReadonly();
  /** Есть подешевевший товар, которого покупатель ещё не видел, — точка на вкладке «Избранное» и в шапке. */
  readonly hasFreshDrop = computed(() => {
    const marks = this.marksState();
    return this.state().some((id) => isFreshDrop(marks[id]));
  });

  /** Загрузка из localStorage один раз; нестроковые значения и испорченные метки отбрасываются. */
  hydrate(): void {
    if (this.loaded) return;
    this.loaded = true;
    const saved = this.store.get<unknown>(KEY, []);
    this.state.set(Array.isArray(saved) ? saved.filter((x): x is string => typeof x === 'string') : []);
    this.marksState.set(parseMarks(this.store.get<unknown>(PRICES_KEY, {})));
    this.readyState.set(true);
  }
  has(id: string): boolean { return this.state().includes(id); }

  /**
   * Сердечко на карточке, на странице товара, двойной тап по видео. item — цена и наличие в момент добавления
   * (с ней потом сравнивается «Подешевело»).
   * Добавление — лёгкая вибрация и «Добавлено в избранное · Открыть» (на самой странице избранного — без ссылки);
   * удаление — «Убрано из избранного · Вернуть», товар возвращается на прежнее место с прежней ценой.
   */
  toggle(id: string, item?: Priced): void {
    this.hydrate();
    const index = this.state().indexOf(id);
    if (index < 0) {
      this.save([...this.state(), id]);
      if (item) this.setMark(id, { base: item.price, now: item.price, stock: item.in_stock });
      this.haptics.light();
      const onFavorites = (this.router?.url ?? '').startsWith('/favorites');
      this.toasts.show({ text: this.i18n.t('Добавлено в избранное'), action: onFavorites ? undefined : { label: this.i18n.t('Открыть'), link: '/favorites' } });
      return;
    }
    const mark = this.marksState()[id];
    this.save(this.state().filter((x) => x !== id));
    this.setMark(id, undefined);
    this.toasts.show({ text: this.i18n.t('Убрано из избранного'), action: { label: this.i18n.t('Вернуть'), run: () => this.restore(id, index, mark) } });
  }

  /**
   * Свежая цена товара из избранного (фоновая проверка, лента, страница товара). Цена, которой не было при добавлении
   * («по запросу», избранное старше «Подешевело»), становится точкой отсчёта — снижения от неё нет.
   */
  observe(id: string, item: Priced): void {
    if (!this.has(id)) return;
    const prev = this.marksState()[id];
    const next: PriceMark = { ...prev, base: prev?.base ?? item.price, now: item.price, stock: item.in_stock };
    if (prev && prev.base === next.base && prev.now === next.now && prev.stock === next.stock) return;
    this.setMark(id, next);
  }

  /** На сколько сомони подешевел с момента добавления; null — плашки нет. */
  drop(id: string): number | null { return dropOf(this.marksState()[id]); }

  /** Покупатель открыл избранное: увиденные снижения больше не зажигают точку (пока не станет ещё дешевле). */
  markSeen(): void {
    const marks = this.marksState();
    const seen = this.state().filter((id) => isFreshDrop(marks[id]));
    if (!seen.length) return;
    const next = { ...marks };
    for (const id of seen) next[id] = { ...marks[id], seen: marks[id].now! };
    this.saveMarks(next);
  }

  /** «Вернуть»: на прежнее место и с прежней меткой цены; если товар уже добавили снова — ничего не меняется. */
  private restore(id: string, index: number, mark: PriceMark | undefined): void {
    const list = this.state();
    if (list.includes(id)) return;
    const at = Math.min(index, list.length);
    this.save([...list.slice(0, at), id, ...list.slice(at)]);
    if (mark) this.setMark(id, mark);
  }

  private save(list: string[]): void {
    this.state.set(list);
    this.store.set(KEY, list);
  }

  private setMark(id: string, mark: PriceMark | undefined): void {
    const marks = this.marksState();
    if (!mark && !(id in marks)) return;
    const next = { ...marks };
    if (mark) next[id] = mark; else delete next[id];
    this.saveMarks(next);
  }

  private saveMarks(marks: Record<string, PriceMark>): void {
    this.marksState.set(marks);
    this.store.set(PRICES_KEY, marks);
  }
}
