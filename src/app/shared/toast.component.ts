import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToastService } from '../core/toast.service';
import { IconComponent } from './icon.component';

/**
 * Плашка ToastService внизу экрана. Положение задаёт .dock в styles.scss (над вкладками и липкой
 * кнопкой покупки, над плашкой «Нет интернета»). Область role="status" есть всегда — меняется
 * только содержимое, так скринридер объявит каждое сообщение.
 */
@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="live" role="status">
      @if (toasts.current(); as t) {
        <div class="toast" data-test="toast" [class.error]="t.kind === 'error'" [class.leaving]="t.leaving"
          (mouseenter)="toasts.pause()" (mouseleave)="toasts.resume()" (focusin)="toasts.pause()" (focusout)="toasts.resume()">
          <span class="text">{{ t.text }}</span>
          @if (t.action; as a) {
            @if (a.link) {
              <a class="act" data-test="toast-action" [routerLink]="a.link" (click)="toasts.act()">{{ a.label }}</a>
            } @else {
              <button type="button" class="act" data-test="toast-action" (click)="toasts.act()">{{ a.label }}</button>
            }
          }
          <button type="button" class="close" data-test="toast-close" aria-label="Закрыть сообщение" (click)="toasts.dismiss()">
            <app-icon name="x" [size]="16" [stroke]="2.5" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: contents }
    .live { display: flex; justify-content: center; width: 100% }
    .toast { display: flex; align-items: center; gap: 4px; max-width: 480px; min-height: 48px; padding-left: 16px; border-radius: 12px; background: var(--color-ink); color: var(--color-paper); font-size: 15px; line-height: 1.35; box-shadow: var(--shadow-pop); pointer-events: auto }
    .toast.error { background: var(--color-anor) }
    .text { flex: 1 1 auto; min-width: 0; padding-block: 12px }
    .act { flex: none; display: inline-flex; align-items: center; min-height: 44px; padding: 0 10px; border-radius: 8px; font-weight: 600; color: var(--color-saffron); white-space: nowrap }
    .error .act { color: var(--color-paper); text-decoration: underline; text-underline-offset: 3px }
    .close { flex: none; display: grid; place-items: center; width: 44px; height: 44px; margin-left: -4px; border-radius: 10px; color: rgb(255 255 255 / .7) }
    .act:focus-visible, .close:focus-visible { outline: 2px solid var(--color-saffron); outline-offset: -2px }
    @media (hover: hover) { .act:hover { text-decoration: underline } .close:hover { color: var(--color-paper) } }
    .leaving { pointer-events: none }
    @media (prefers-reduced-motion: no-preference) {
      .toast { animation: toast-in .22s cubic-bezier(.2, .8, .2, 1) }
      .toast.leaving { animation: toast-out .16s ease-in forwards }
    }
    @media (prefers-reduced-motion: reduce) { .toast.leaving { opacity: 0 } }
    @keyframes toast-in { from { opacity: 0; transform: translateY(12px) scale(.97) } }
    @keyframes toast-out { to { opacity: 0; transform: translateY(8px) } }
  `,
})
export class ToastComponent {
  protected readonly toasts = inject(ToastService);
}
