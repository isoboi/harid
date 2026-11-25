import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, filter, map, of, Subject, switchMap } from 'rxjs';
import { MarketApi } from '../core/market-api.service';
import { RecentSearchesService } from '../core/recent-searches.service';
import { SearchSuggestions } from '../core/models';
import { IconComponent } from './icon.component';
import { MoneyPipe } from './money.pipe';
import { plural } from './plural';
import { highlight, moveActive, SUGGEST_DEBOUNCE_MS, SUGGEST_MIN_LENGTH, SuggestOption, suggestOptions } from './search-suggest';
import { ShopAvatarComponent } from './shop-avatar.component';

/** Ответ сервера вместе с запросом, на который он пришёл: подсветка — по нему, а не по полю. */
interface Answer { query: string; data: SearchSuggestions }

/** Пункты истории: недавний запрос и последним — «Очистить историю». */
type HistoryOption = { kind: 'recent'; query: string } | { kind: 'clear-history' };

const GROUPS: { kind: SuggestOption['kind']; label: string }[] = [
  { kind: 'shop', label: 'Лавки' },
  { kind: 'category', label: 'Категории' },
  { kind: 'product', label: 'Товары' },
];

/**
 * Поле поиска в шапке с подсказками при наборе (решение 0009): с 2 символов, через 200 мс после
 * последней клавиши; новый ответ отменяет старый запрос, а пока он идёт — виден прежний список.
 * Ошибка сервера подсказки просто прячет: искать по Enter можно всегда.
 * Клавиатура как у combobox: ↑/↓ — пункты по кругу, Enter — выбранный пункт или полный поиск, Esc — закрыть.
 * В пустом поле вместо подсказок — недавние запросы из этого браузера; Delete убирает выбранный.
 */
@Component({
  selector: 'app-search-box',
  standalone: true,
  imports: [RouterLink, IconComponent, ShopAvatarComponent, MoneyPipe],
  host: { '(focusout)': 'onFocusOut($event)' },
  template: `
    <div class="anchor">
    <!-- Без FormsModule: поиск в шапке есть на каждой странице, а модуль форм (~40 КБ) иначе попадал бы в начальную загрузку.
         preventDefault — вместо NgForm: отправка формы не перезагружает страницу -->
    <form role="search" (submit)="$event.preventDefault(); submit()">
      <label class="box">
        <app-icon class="search-icon" name="search" [size]="18" />
        <span class="sr-only">Поиск по товарам</span>
        <input #field name="q" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false"
          placeholder="Платье, кроссовки, @магазин"
          role="combobox" aria-autocomplete="list" aria-controls="search-suggest"
          [attr.aria-expanded]="visible()"
          [attr.aria-activedescendant]="visible() && active() >= 0 ? 'sg-' + active() : null"
          [value]="q()" (input)="onInput(field.value)"
          (focus)="open.set(true)" (keydown)="onKey($event)" />
        @if (q()) {
          <button type="button" class="clear" aria-label="Очистить поиск" (click)="clear()"><app-icon name="x" [size]="16" /></button>
        }
      </label>
    </form>

    <div id="search-suggest" class="panel" role="listbox" aria-label="Подсказки поиска" [hidden]="!visible()" (mousedown)="$event.preventDefault()">
      @if (history()) {
        <div class="group" role="group" aria-label="Недавние запросы" data-test="recent-searches">
          <p class="group-label" aria-hidden="true">Недавние запросы</p>
          @for (r of recent.items(); track r; let i = $index) {
            <div class="recent">
              <a class="opt" role="option" tabindex="-1" data-test="recent-search" [id]="'sg-' + i" [attr.aria-selected]="i === active()"
                [class.is-active]="i === active()" routerLink="/search" [queryParams]="{ q: r }" (click)="picked()" (mousemove)="active.set(i)">
                <app-icon class="hist-ico" name="history" [size]="18" />
                <span class="txt"><span class="title">{{ r }}</span></span>
              </a>
              <!-- С клавиатуры и в скринридере запрос убирает Delete, поэтому кнопка от них скрыта -->
              <button type="button" class="forget" tabindex="-1" aria-hidden="true" data-test="forget-search" [title]="'Удалить «' + r + '» из истории'" (click)="forget(r)">
                <app-icon name="x" [size]="16" />
              </button>
            </div>
          }
        </div>
        <div class="opt opt--clear" role="option" tabindex="-1" data-test="clear-history" [id]="'sg-' + recent.items().length"
          [attr.aria-selected]="recent.items().length === active()" [class.is-active]="recent.items().length === active()"
          (click)="clearHistory()" (mousemove)="active.set(recent.items().length)">
          <span class="txt"><span class="title">Очистить историю</span></span>
        </div>
      } @else if (visible()) {
        @if (empty()) {
          <p class="empty">Ничего не нашлось — попробуйте иначе</p>
        }
        @for (g of groups(); track g.kind) {
          <div class="group" role="group" [attr.aria-label]="g.label">
            <p class="group-label" aria-hidden="true">{{ g.label }}</p>
            @for (it of g.items; track it.index) {
              <a class="opt" role="option" tabindex="-1" [id]="'sg-' + it.index" [attr.aria-selected]="it.index === active()"
                [class.is-active]="it.index === active()" [routerLink]="it.opt.link" (click)="picked()" (mousemove)="active.set(it.index)">
                @switch (it.opt.kind) {
                  @case ('shop') {
                    <app-shop-avatar [name]="it.opt.shop.name" [handle]="it.opt.shop.handle" [color]="it.opt.shop.avatar_color" [avatarUrl]="it.opt.shop.avatar_url" [size]="36" />
                    <span class="txt">
                      <span class="title">@for (m of marks(it.opt.shop.name); track $index) {@if (m.hit) {<mark>{{ m.text }}</mark>} @else {<span>{{ m.text }}</span>}}</span>
                      <span class="sub">&#64;{{ it.opt.shop.handle }}</span>
                    </span>
                  }
                  @case ('category') {
                    <span class="badge-ico" aria-hidden="true"><app-icon name="layout-grid" [size]="18" /></span>
                    <span class="txt"><span class="title">@for (m of marks(it.opt.category.name); track $index) {@if (m.hit) {<mark>{{ m.text }}</mark>} @else {<span>{{ m.text }}</span>}}</span></span>
                  }
                  @case ('product') {
                    <img class="thumb" [src]="it.opt.product.image" alt="" loading="lazy" referrerpolicy="no-referrer" />
                    <span class="txt">
                      <span class="title">@for (m of marks(it.opt.product.title); track $index) {@if (m.hit) {<mark>{{ m.text }}</mark>} @else {<span>{{ m.text }}</span>}}</span>
                      <span class="sub">&#64;{{ it.opt.product.shop_handle }}</span>
                    </span>
                    @if (it.opt.product.price !== null) { <span class="price">{{ it.opt.product.price | money }}</span> }
                  }
                }
              </a>
            }
          </div>
        }
        <a class="opt opt--all" role="option" tabindex="-1" data-test="suggest-all" [id]="'sg-' + allIndex()" [attr.aria-selected]="allIndex() === active()"
          [class.is-active]="allIndex() === active()" routerLink="/search" [queryParams]="{ q: query() }" (click)="picked()" (mousemove)="active.set(allIndex())">
          <app-icon name="search" [size]="18" />
          <span class="txt"><span class="title">{{ empty() ? 'Искать' : 'Все результаты по' }} «{{ query() }}»</span></span>
          <app-icon class="chev" name="chevron-right" [size]="18" />
        </a>
      }
    </div>
    </div>
    <p class="sr-only" aria-live="polite">{{ announce() }}</p>
  `,
  styles: `
    :host { display: block }
    /* Список выравнивается по полю, а не по хосту: у хоста в шапке есть внешние отступы */
    .anchor { position: relative }
    /* Поиск: h-11 rounded-[10px] bg-mist, кольцо лазури при фокусе */
    .box { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 4px 0 12px; border-radius: 10px; background: var(--color-mist) }
    .box:focus-within { box-shadow: 0 0 0 2px var(--color-lapis) }
    .search-icon { color: var(--color-ink-soft) }
    /* 16px на всех ширинах: меньший шрифт заставляет iOS Safari увеличивать страницу при фокусе */
    .box input { width: 100%; min-width: 0; height: 100%; border: 0; background: transparent; font-size: 16px; outline: none; -webkit-appearance: none; appearance: none }
    .box input::-webkit-search-cancel-button { -webkit-appearance: none }
    .clear { display: grid; place-items: center; flex-shrink: 0; width: 36px; height: 36px; border-radius: 8px; color: var(--color-ink-soft) }
    @media (hover: hover) { .clear:hover { background: var(--color-line) } }

    .panel { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 40; max-height: min(72vh, 560px); overflow-y: auto; overscroll-behavior: contain; padding: 6px; border: 1px solid var(--color-line); border-radius: 12px; background: var(--color-paper); box-shadow: var(--shadow-pop) }
    .panel[hidden] { display: none }
    .group + .group, .group + .opt--all { margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--color-mist) }
    .group-label { padding: 8px 10px 4px; color: var(--color-ink-soft); font-size: 12px; font-weight: 600; letter-spacing: .02em }
    .empty { padding: 14px 10px 10px; color: var(--color-ink-soft) }
    .opt { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 6px 10px; border-radius: 8px; cursor: pointer }
    .opt.is-active { background: var(--color-mist) }
    .txt { display: flex; flex: 1; flex-direction: column; min-width: 0 }
    .title { overflow: hidden; white-space: nowrap; text-overflow: ellipsis }
    .sub { overflow: hidden; color: var(--color-ink-soft); font-size: 13px; white-space: nowrap; text-overflow: ellipsis }
    mark { background: none; color: inherit; font-weight: 700 }
    .thumb { flex-shrink: 0; width: 44px; height: 44px; border-radius: 8px; object-fit: cover; background: var(--color-mist) }
    .badge-ico { display: grid; place-items: center; flex-shrink: 0; width: 36px; height: 36px; border-radius: 9999px; background: var(--color-mist); color: var(--color-lapis) }
    .opt.is-active .badge-ico { background: var(--color-paper) }
    .price { flex-shrink: 0; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap }
    .opt--all { color: var(--color-lapis); font-weight: 600 }
    .opt--all .chev { margin-left: auto }
    /* Недавние запросы: крестик справа поверх строки, сама строка — ссылка на поиск */
    .recent { position: relative }
    .recent .opt { padding-right: 48px }
    .hist-ico { color: var(--color-ink-soft) }
    .forget { position: absolute; top: 50%; right: 6px; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 8px; color: var(--color-ink-soft); transform: translateY(-50%) }
    @media (hover: hover) { .forget:hover { background: var(--color-line); color: var(--color-ink) } }
    .opt--clear { margin-top: 4px; border-top: 1px solid var(--color-mist); border-radius: 0 0 8px 8px; color: var(--color-ink-soft); font-size: 14px; font-weight: 600 }
    /* Телефон: список до нижней панели вкладок, не под ней */
    @media (max-width: 640px) {
      .panel { max-height: calc(100dvh - 140px - var(--tabbar-h)) }
    }
  `,
})
export class SearchBoxComponent {
  private readonly api = inject(MarketApi);
  protected readonly recent = inject(RecentSearchesService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  private readonly typed$ = new Subject<string>();

  readonly q = signal('');
  /** Фокус в поле: список виден, если есть что показать. */
  readonly open = signal(false);
  /** Индекс активного пункта в suggestOptions; -1 — ни один. */
  readonly active = signal(-1);
  private readonly answer = signal<Answer | null>(null);

  readonly query = computed(() => this.answer()?.query ?? this.q().trim());
  readonly options = computed(() => suggestOptions(this.answer()?.data ?? null, this.query()));
  readonly allIndex = computed(() => this.options().length - 1);
  readonly groups = computed(() => {
    const items = this.options().map((opt, index) => ({ opt, index }));
    return GROUPS.map((g) => ({ ...g, items: items.filter((it) => it.opt.kind === g.kind) })).filter((g) => g.items.length);
  });
  readonly empty = computed(() => this.options().length === 1);
  /** Поле пустое и есть история — показываем её вместо подсказок. */
  readonly history = computed(() => this.open() && !this.q().trim() && this.recent.items().length > 0);
  private readonly historyOptions = computed((): HistoryOption[] => [
    ...this.recent.items().map((query): HistoryOption => ({ kind: 'recent', query })),
    { kind: 'clear-history' },
  ]);
  /** То, по чему ходят стрелками сейчас: история или подсказки. */
  private readonly current = computed((): (SuggestOption | HistoryOption)[] => (this.history() ? this.historyOptions() : this.options()));
  private readonly suggesting = computed(() => this.open() && this.answer() !== null && this.q().trim().length >= SUGGEST_MIN_LENGTH);
  readonly visible = computed(() => this.history() || this.suggesting());
  readonly announce = computed(() => {
    if (this.history()) {
      const n = this.recent.items().length;
      return `${n} ${plural(n, ['недавний запрос', 'недавних запроса', 'недавних запросов'])}`;
    }
    if (!this.visible()) return '';
    const n = this.options().length - 1;
    return n ? `${n} ${plural(n, ['подсказка', 'подсказки', 'подсказок'])}` : 'Ничего не нашлось';
  });

  constructor() {
    this.recent.hydrate();
    this.typed$.pipe(
      map((v) => v.trim()),
      debounceTime(SUGGEST_DEBOUNCE_MS),
      distinctUntilChanged(),
      switchMap((query) => query.length < SUGGEST_MIN_LENGTH
        ? of(null)
        : this.api.suggest(query).pipe(map((data): Answer => ({ query, data })), catchError(() => of(null)))),
      takeUntilDestroyed(),
    ).subscribe((answer) => {
      this.answer.set(answer);
      this.active.set(-1);
    });

    // На странице поиска в поле — её запрос; в подсказки он не уходит, пока его не начнут править
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe((e) => {
      const tree = this.router.parseUrl(e.urlAfterRedirects);
      const path = tree.root.children['primary']?.segments.map((s) => s.path).join('/');
      if (path !== 'search') return;
      const q = tree.queryParams['q'] ?? '';
      this.q.set(q);
      // В историю — любой открытый поиск: из поля, из «Все результаты», по ссылке или «назад»
      if (typeof q === 'string' && q.trim()) this.recent.add(q);
    });
  }

  marks(label: string) { return highlight(label, this.query()); }

  onInput(value: string): void {
    // История и подсказки — разные списки: выбранный пункт одного в другом ничего не значит
    if (!value.trim() !== !this.q().trim()) this.active.set(-1);
    this.q.set(value);
    this.open.set(true);
    this.typed$.next(value);
  }

  onKey(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        if (!this.visible()) { this.open.set(true); return; }
        this.active.set(moveActive(this.active(), e.key === 'ArrowDown' ? 1 : -1, this.current().length));
        this.scrollToActive();
        return;
      case 'Enter': {
        const opt = this.visible() ? this.current()[this.active()] : undefined;
        if (!opt) return; // обычная отправка формы — полный поиск
        e.preventDefault();
        this.go(opt);
        return;
      }
      case 'Delete': {
        const opt = this.history() ? this.current()[this.active()] : undefined;
        if (opt?.kind !== 'recent') return;
        e.preventDefault();
        this.forget(opt.query);
        return;
      }
      case 'Escape':
        if (this.visible()) { e.preventDefault(); this.close(); }
        return;
    }
  }

  submit(): void {
    const q = this.q().trim();
    if (!q) return;
    this.close();
    this.field().nativeElement.blur();
    this.router.navigate(['/search'], { queryParams: { q } });
  }

  clear(): void {
    this.onInput('');
    this.field().nativeElement.focus();
  }

  /** Убрать запрос из истории; выбор остаётся на той же строке — теперь на следующем запросе. */
  forget(query: string): void {
    this.recent.remove(query);
    const last = this.recent.items().length; // индекс «Очистить историю»
    if (this.active() > last) this.active.set(last);
    this.field().nativeElement.focus();
  }

  clearHistory(): void {
    this.recent.clear();
    this.active.set(-1);
    this.field().nativeElement.focus();
  }

  /** Клик по пункту: переход делает routerLink, здесь — закрыть и убрать клавиатуру телефона. */
  picked(): void {
    this.close();
    this.field().nativeElement.blur();
  }

  /** Фокус ушёл за пределы поля и списка — закрыть. */
  onFocusOut(e: FocusEvent): void {
    const next = e.relatedTarget as Node | null;
    if (!next || !this.host.nativeElement.contains(next)) this.close();
  }

  private go(opt: SuggestOption | HistoryOption): void {
    if (opt.kind === 'clear-history') { this.clearHistory(); return; }
    this.picked();
    if (opt.kind === 'recent') this.router.navigate(['/search'], { queryParams: { q: opt.query } });
    else if (opt.kind === 'all') this.router.navigate(opt.link, { queryParams: { q: opt.query } });
    else this.router.navigate(opt.link);
  }

  private close(): void {
    this.open.set(false);
    this.active.set(-1);
  }

  private scrollToActive(): void {
    const el = this.host.nativeElement.querySelector(`#sg-${this.active()}`);
    if (el && 'scrollIntoView' in el) (el as HTMLElement).scrollIntoView({ block: 'nearest' });
  }
}
