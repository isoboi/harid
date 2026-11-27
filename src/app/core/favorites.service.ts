import { isPlatformBrowser } from '@angular/common';
import { computed, DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
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

/**
 * Избранное — id товаров в браузере и цены для «Подешевело». Стартует пустым, данные — из hydrate().
 * Хранилище общее для всех вкладок: цены пишутся сами (лента, фоновая проверка), поэтому перед каждой записью
 * метки перечитываются и меняется только своя запись, а событие storage подхватывает изменения из других вкладок —
 * иначе старая вкладка затирала бы цену товара, добавленного в новой, и возвращала погашенную точку.
 */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly store = inject(BrowserStorage);
  private readonly haptics = inject(Haptics);
  private readonly toasts = inject(ToastService);
  private readonly i18n = inject(I18n);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
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
    this.state.set(this.readIds());
    this.marksState.set(this.readMarks());
    this.readyState.set(true);
    if (!this.browser) return;
    // key === null — другая вкладка очистила всё хранилище
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY || e.key === null) this.state.set(this.readIds());
      if (e.key === PRICES_KEY || e.key === null) this.marksState.set(this.readMarks());
    };
    window.addEventListener('storage', onStorage);
    this.destroyRef.onDestroy(() => window.removeEventListener('storage', onStorage));
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
      if (item) this.updateMarks((m) => { m[id] = { base: item.price, now: item.price, stock: item.in_stock }; });
      this.haptics.light();
      const onFavorites = (this.router?.url ?? '').startsWith('/favorites');
      this.toasts.show({ text: this.i18n.t('Добавлено в избранное'), action: onFavorites ? undefined : { label: this.i18n.t('Открыть'), link: '/favorites' } });
      return;
    }
    const mark = this.marksState()[id];
    this.save(this.state().filter((x) => x !== id));
    this.updateMarks((m) => { delete m[id]; });
    this.toasts.show({ text: this.i18n.t('Убрано из избранного'), action: { label: this.i18n.t('Вернуть'), run: () => this.restore(id, index, mark) } });
  }

  /**
   * Свежая цена товара из избранного (фоновая проверка, лента, страница товара). Цена, которой не было при добавлении
   * («по запросу», избранное старше «Подешевело»), становится точкой отсчёта — снижения от неё нет.
   */
  observe(id: string, item: Priced): void {
    if (!this.has(id)) return;
    // Частый вызов (каждая карточка ленты): без изменений — без чтения и записи хранилища
    if (same(this.marksState()[id], item)) return;
    this.updateMarks((m) => {
      const prev = m[id];
      m[id] = { ...prev, base: prev?.base ?? item.price, now: item.price, stock: item.in_stock };
    });
  }

  /** На сколько сомони подешевел с момента добавления; null — плашки нет. */
  drop(id: string): number | null { return dropOf(this.marksState()[id]); }

  /**
   * Покупатель увидел эти товары на странице избранного: их снижения больше не зажигают точку
   * (пока не станет ещё дешевле). Не загрузившиеся товары не передаются — их точка остаётся.
   */
  markSeen(ids: readonly string[]): void {
    if (!ids.some((id) => isFreshDrop(this.marksState()[id]))) return;
    this.updateMarks((m) => {
      for (const id of ids) if (isFreshDrop(m[id])) m[id] = { ...m[id], seen: m[id].now! };
    });
  }

  /** «Вернуть»: на прежнее место и с прежней меткой цены; если товар уже добавили снова — ничего не меняется. */
  private restore(id: string, index: number, mark: PriceMark | undefined): void {
    const list = this.state();
    if (list.includes(id)) return;
    const at = Math.min(index, list.length);
    this.save([...list.slice(0, at), id, ...list.slice(at)]);
    if (mark) this.updateMarks((m) => { m[id] = mark; });
  }

  private save(list: string[]): void {
    this.state.set(list);
    this.store.set(KEY, list);
  }

  private readIds(): string[] {
    const saved = this.store.get<unknown>(KEY, []);
    return Array.isArray(saved) ? saved.filter((x): x is string => typeof x === 'string') : [];
  }

  private readMarks(): Record<string, PriceMark> { return parseMarks(this.store.get<unknown>(PRICES_KEY, {})); }

  /** Перечитать метки из хранилища (там могут быть записи других вкладок), поменять свои и записать. */
  private updateMarks(change: (marks: Record<string, PriceMark>) => void): void {
    const marks = this.browser ? this.readMarks() : { ...this.marksState() };
    change(marks);
    this.marksState.set(marks);
    this.store.set(PRICES_KEY, marks);
  }
}

/** Метка уже знает эту цену и наличие, и base появиться не может — записывать нечего. */
function same(m: PriceMark | undefined, item: Priced): boolean {
  return !!m && m.now === item.price && m.stock === item.in_stock && (m.base !== null || item.price === null);
}
