import { DOCUMENT } from '@angular/common';
import { Component, computed, ElementRef, HostListener, inject, input, signal } from '@angular/core';
import { Analytics } from '../core/analytics.service';
import { telegramShareUrl, whatsappShareUrl, withUtm } from '../core/share';
import { IconComponent } from './icon.component';

/**
 * Кнопка «Поделиться» для товара и лавки. На телефонах открывает системное окно «Поделиться»,
 * на компьютере — меню: Telegram, WhatsApp, копирование ссылки. К адресу добавляются UTM-метки,
 * чтобы в аналитике было видно, сколько людей приводят такие ссылки.
 */
@Component({
  selector: 'app-share',
  standalone: true,
  imports: [IconComponent],
  template: `
    <button type="button" class="btn btn--ghost trigger" data-test="share" aria-haspopup="true" [attr.aria-expanded]="open()" (click)="toggle()">
      <app-icon name="share" [size]="20" />{{ label() }}
    </button>
    @if (open()) {
      <div class="menu" data-test="share-menu">
        <a data-test="share-telegram" [href]="telegram()" target="_blank" rel="noopener" (click)="sent('telegram')">Telegram</a>
        <a data-test="share-whatsapp" [href]="whatsapp()" target="_blank" rel="noopener" (click)="sent('whatsapp')">WhatsApp</a>
        <button type="button" data-test="share-copy" (click)="copy()">{{ copied() ? 'Ссылка скопирована' : 'Копировать ссылку' }}</button>
        @if (copyFailed()) { <p class="fail" role="alert">Не удалось скопировать — скопируйте адрес из браузера</p> }
      </div>
    }
  `,
  styles: `
    :host { position: relative; display: inline-block }
    .trigger { gap: 8px }
    .menu { position: absolute; top: calc(100% + 8px); left: 0; z-index: 40; min-width: 220px; max-width: calc(100vw - 32px); padding: 6px; border: 1px solid var(--color-line); border-radius: 12px; background: var(--color-paper); box-shadow: 0 8px 24px rgb(19 35 91 / .14) }
    .menu a, .menu button { display: flex; align-items: center; width: 100%; min-height: 44px; padding: 0 12px; border-radius: 8px; font-size: 15px; font-weight: 500; text-align: left }
    @media (hover: hover) { .menu a:hover, .menu button:hover { background: var(--color-mist) } }
    .fail { padding: 4px 12px 8px; font-size: 13px; line-height: 1.4; color: var(--color-anor) }
  `,
})
export class ShareComponent {
  private readonly doc = inject(DOCUMENT);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly analytics = inject(Analytics);

  /** Путь страницы, например «/product/5»; адрес сайта подставляется в браузере. */
  readonly path = input.required<string>();
  readonly title = input('');
  /** Текст сообщения: «Кроссовки — 540 смн на Хариде». */
  readonly text = input('');
  readonly kind = input<'product' | 'shop'>('product');
  readonly label = input('Поделиться');

  readonly open = signal(false);
  readonly copied = signal(false);
  readonly copyFailed = signal(false);

  readonly telegram = computed(() => telegramShareUrl(this.url('telegram'), this.text()));
  readonly whatsapp = computed(() => whatsappShareUrl(this.url('whatsapp'), this.text()));

  private url(medium: string): string {
    return withUtm(`${this.doc.location?.origin ?? ''}${this.path()}`, 'share', medium);
  }

  async toggle(): Promise<void> {
    const nav = this.doc.defaultView?.navigator;
    if (typeof nav?.share === 'function') {
      try {
        await nav.share({ title: this.title(), text: this.text(), url: this.url('native') });
        this.sent('native');
      } catch { /* окно закрыли, не выбрав получателя, — это не ошибка */ }
      return;
    }
    this.open.update((v) => !v);
    this.copied.set(false);
    this.copyFailed.set(false);
  }

  async copy(): Promise<void> {
    const clipboard = this.doc.defaultView?.navigator?.clipboard;
    try {
      if (!clipboard?.writeText) throw new Error('clipboard unavailable');
      await clipboard.writeText(this.url('copy'));
      this.copied.set(true);
      this.copyFailed.set(false);
      this.sent('copy');
    } catch { this.copyFailed.set(true); }
  }

  sent(method: string): void {
    this.analytics.track('share', { method, kind: this.kind() });
  }

  /** Клик мимо меню и Escape закрывают его. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(e: Event): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  @HostListener('keydown.escape')
  onEscape(): void { this.open.set(false); }
}
