import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatApi } from '../../core/chat-api.service';
import { MarketApi } from '../../core/market-api.service';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/api-error';
import { I18n, TPipe } from '../../core/i18n';
import { Product, Shop } from '../../core/models';
import { MoneyPipe } from '../../shared/money.pipe';
import { ShopAvatarComponent } from '../../shared/shop-avatar.component';

/** Первое сообщение лавке со страницы товара: кому пишем (лавка), о чём (карточка товара) и текст. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-chat-new',
  standalone: true,
  imports: [FormsModule, MoneyPipe, ShopAvatarComponent, TPipe],
  template: `
    <section class="wrap box">
      <h1 class="title">{{ 'Вопрос продавцу' | t }}</h1>
      <div class="to" data-test="new-shop">
        <app-shop-avatar [name]="shopInfo()?.name || shop()" [color]="shopInfo()?.avatar_color || ''" [avatarUrl]="shopInfo()?.avatar_url" [handle]="shop()" [size]="48" />
        <span class="to-text">
          <span class="to-name">{{ shopInfo()?.name || ('@' + shop()) }}</span>
          <span class="to-note">{{ 'Ответ придёт в «Сообщения»' | t }}</span>
        </span>
      </div>
      @if (item(); as p) {
        <div class="product">
          @if (p.image) { <img [src]="p.image" alt="" width="56" height="56" /> }
          <span class="pmeta"><span class="pt">{{ p.title }}</span><span class="pp">{{ p.price | money }}</span></span>
        </div>
      }
      <form (ngSubmit)="submit()">
        <label class="lbl" for="chat-first">{{ 'Ваш вопрос' | t }}</label>
        <textarea id="chat-first" name="text" class="field-control" rows="4" maxlength="2000" [placeholder]="'Например: есть ли размер M?' | t"
          [ngModel]="draft()" (ngModelChange)="draft.set($event)"></textarea>
        <button class="btn btn--block go" type="submit" [disabled]="busy() || !draft().trim()">{{ 'Отправить' | t }}</button>
      </form>
      @if (error()) { <p class="field-error" role="alert">{{ error() }}</p> }
    </section>
  `,
  styles: `
    .box { max-width: 560px; padding-top: 28px; padding-bottom: 40px }
    .title { margin: 0 0 16px; font-size: 28px; font-weight: 800; letter-spacing: -0.02em }
    .to { display: flex; align-items: center; gap: 12px; margin-bottom: 16px }
    .to-text { display: flex; flex-direction: column; min-width: 0 }
    .to-name { overflow: hidden; font-size: 17px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap }
    .to-note { font-size: 14px; color: var(--color-ink-soft) }
    .product { display: flex; gap: 12px; align-items: center; margin-bottom: 20px; padding: 10px; border-radius: 14px; background: var(--color-mist) }
    .product img { flex: none; border-radius: 10px; object-fit: cover; background: var(--color-line) }
    .pmeta { min-width: 0 }
    .pt { display: block; overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap }
    .pp { display: block; color: var(--color-ink-soft); font-variant-numeric: tabular-nums }
    .lbl { display: block; margin-bottom: 6px; font-size: 14px; font-weight: 600 }
    .go { margin-top: 12px }
  `,
})
export class ChatNewComponent implements OnInit {
  private readonly i18n = inject(I18n);
  private readonly api = inject(ChatApi);
  private readonly market = inject(MarketApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  /** ?shop=<ник лавки> */
  readonly shop = input<string>('');
  /** ?product=<id товара>, необязательно */
  readonly product = input<string>('');
  readonly item = signal<Product | null>(null);
  /** Лавка-получатель: имя и аватар; до загрузки показываем @ник. */
  readonly shopInfo = signal<Shop | null>(null);
  readonly draft = signal('');
  readonly busy = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    this.auth.hydrate();
    if (!this.auth.loggedIn()) {
      const back = `/chats/new?shop=${this.shop()}` + (this.product() ? `&product=${this.product()}` : '');
      this.router.navigateByUrl('/login?return=' + encodeURIComponent(back));
      return;
    }
    if (this.shop()) this.market.shop(this.shop()).subscribe({ next: (s) => this.shopInfo.set(s), error: () => undefined });
    if (this.product()) this.market.product(this.product()).subscribe({ next: (p) => this.item.set(p), error: () => undefined });
  }

  submit(): void {
    const text = this.draft().trim();
    if (!text || this.busy()) return;
    this.busy.set(true); this.error.set('');
    const productId = Number(this.product());
    this.api.start({ shop_handle: this.shop(), text, ...(productId ? { product_id: productId } : {}) }).subscribe({
      next: (r) => { this.busy.set(false); this.router.navigateByUrl(`/chats/${r.chat_id}`); },
      error: (e) => { this.busy.set(false); this.error.set(apiErrorMessage(e, this.i18n)); },
    });
  }
}
