import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, PLATFORM_ID, signal } from '@angular/core';
import { SeoService } from '../core/seo.service';
import { ToastService } from '../core/toast.service';
import { IconComponent } from './icon.component';

/** Ссылки «поделиться» в мессенджерах: в Telegram ссылка и текст идут отдельно, в WhatsApp — одной строкой. */
export function shareLinks(url: string, text: string): { telegram: string; whatsapp: string } {
  const u = encodeURIComponent(url);
  return {
    telegram: `https://t.me/share/url?url=${u}&text=${encodeURIComponent(text)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  };
}

let nextId = 0;

/**
 * Кнопка «Поделиться» с меню: Telegram, WhatsApp, копирование ссылки и — где есть — системное меню телефона.
 * Ссылка полная, с адресом витрины (SeoService.origin), чтобы в мессенджере открывалась и подтягивала превью.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-share',
  standalone: true,
  imports: [IconComponent],
  host: { '(document:keydown.escape)': 'close(true)', '(document:click)': 'outside($event)' },
  template: `
    <button #trigger type="button" class="trigger" data-test="share" [attr.aria-expanded]="open()" [attr.aria-controls]="menuId" (click)="toggle()">
      <app-icon name="share" [size]="20" />Поделиться
    </button>
    @if (open()) {
      <div class="menu" [id]="menuId" data-test="share-menu">
        <a class="item" data-test="share-telegram" [href]="links().telegram" target="_blank" rel="noopener" (click)="close()">
          <span class="ico tg"><app-icon name="send" [size]="16" [stroke]="2" /></span>Telegram
        </a>
        <a class="item" data-test="share-whatsapp" [href]="links().whatsapp" target="_blank" rel="noopener" (click)="close()">
          <span class="ico wa"><app-icon name="message-circle" [size]="16" [stroke]="2" /></span>WhatsApp
        </a>
        <button type="button" class="item" data-test="share-copy" (click)="copy()">
          <span class="ico"><app-icon name="link" [size]="16" [stroke]="2" /></span>Копировать ссылку
        </button>
        @if (native) {
          <button type="button" class="item" data-test="share-native" (click)="nativeShare()">
            <span class="ico"><app-icon name="ellipsis" [size]="16" [stroke]="2.5" /></span>Другие приложения
          </button>
        }
      </div>
    }
  `,
  styles: `
    :host { position: relative; display: inline-block }
    .trigger { display: inline-flex; align-items: center; gap: 8px; height: 48px; padding: 0 16px; border: 1px solid var(--color-line); border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer }
    @media (hover: hover) { .trigger:hover { border-color: var(--color-ink) } }
    .trigger[aria-expanded="true"] { border-color: var(--color-ink) }
    /* Меню под кнопкой; на узком экране не вылезает за правый край */
    .menu { position: absolute; z-index: 20; top: calc(100% + 8px); left: 0; display: flex; flex-direction: column; min-width: 232px; padding: 6px; border: 1px solid var(--color-line); border-radius: 14px; background: var(--color-raised); box-shadow: var(--shadow-pop) }
    @media (max-width: 479.98px) { .menu { left: auto; right: 0 } }
    .item { display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 0 10px; border-radius: 10px; font-size: 15px; font-weight: 500; text-align: left; color: var(--color-ink); cursor: pointer }
    @media (hover: hover) { .item:hover { background: var(--color-mist) } }
    .item:focus-visible { outline: 2px solid var(--color-lapis); outline-offset: -2px }
    .ico { display: grid; place-items: center; flex: none; width: 28px; height: 28px; border-radius: 50%; background: var(--color-mist); color: var(--color-ink) }
    /* Фирменные цвета мессенджеров — их узнают с первого взгляда */
    .ico.tg { background: #229ed9; color: #fff }
    .ico.wa { background: #25d366; color: #fff }
  `,
})
export class ShareComponent {
  /** Путь страницы на витрине, например /product/16. */
  readonly path = input.required<string>();
  /** Подпись к ссылке в сообщении. */
  readonly text = input.required<string>();

  private readonly seo = inject(SeoService);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  /** Системное меню «Поделиться» есть в основном на телефонах. */
  protected readonly native = this.browser && typeof navigator.share === 'function';

  protected readonly menuId = `share-menu-${nextId++}`;
  private readonly toasts = inject(ToastService);
  readonly open = signal(false);
  readonly url = computed(() => this.seo.origin() + this.path());
  readonly links = computed(() => shareLinks(this.url(), this.text()));

  toggle(): void { this.open.update((v) => !v); }

  /** focus — вернуть фокус на кнопку (закрыли с клавиатуры, а не уходом на другой элемент). */
  close(focus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (focus) this.host.nativeElement.querySelector<HTMLElement>('.trigger')?.focus();
  }

  outside(e: Event): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  copy(): void {
    this.close(true);
    if (!this.browser || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(this.url()).then(
      () => this.toasts.show({ text: 'Ссылка скопирована' }),
      () => this.toasts.error('Не удалось скопировать ссылку'),
    );
  }

  nativeShare(): void {
    this.close();
    // Отмена в системном меню — тоже отказ промиса; ничего не делаем
    navigator.share({ title: this.text(), text: this.text(), url: this.url() }).catch(() => undefined);
  }
}
