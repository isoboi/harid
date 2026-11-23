import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MoneyPipe } from '../../shared/money.pipe';
import { ChatMessage } from '../../core/models';
import { chatTime } from './chat-time';

/**
 * Одно сообщение. Свои — справа, лазурью; лавки — слева, туманом. Подряд идущие сообщения одной
 * стороны прижаты друг к другу (grouped), «хвост» скругления только у первого в серии.
 * Карточка товара ведёт на товар.
 */
@Component({
  selector: 'app-chat-bubble',
  standalone: true,
  imports: [RouterLink, MoneyPipe],
  template: `
    @let m = message();
    <div class="bubble" [class.mine]="m.sender === mine()" [class.grouped]="grouped()" data-test="bubble">
      @if (m.product) {
        <a class="product" [routerLink]="['/product', m.product.id]">
          @if (m.product.image) { <img [src]="m.product.image" alt="" width="44" height="44" /> }
          <span class="pmeta"><span class="pt">{{ m.product.title }}</span><span class="pp">{{ m.product.price | money }}</span></span>
        </a>
      }
      <p class="text">{{ m.text }}<time class="time" [attr.datetime]="m.created_at">{{ time(m.created_at) }}</time></p>
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column }
    .bubble { max-width: min(78%, 480px); margin-top: 10px; padding: 8px 12px 7px; border-radius: 18px 18px 18px 6px; background: var(--color-mist); color: var(--color-ink); align-self: flex-start }
    .bubble.grouped { margin-top: 2px; border-top-left-radius: 6px }
    .bubble.mine { align-self: flex-end; border-radius: 18px 18px 6px 18px; background: var(--color-lapis); color: var(--color-paper) }
    .bubble.mine.grouped { border-top-left-radius: 18px; border-top-right-radius: 6px }
    /* Карточка товара внутри пузыря: подложка на тон светлее/темнее самого пузыря */
    .product { display: flex; gap: 10px; align-items: center; margin: 0 -6px 8px; padding: 6px; border-radius: 12px; background: var(--color-paper); color: var(--color-ink); text-decoration: none }
    .mine .product { background: rgb(255 255 255 / .14); color: var(--color-paper) }
    .product img { flex: none; border-radius: 8px; object-fit: cover; background: var(--color-line) }
    .pmeta { min-width: 0 }
    .pt { display: block; overflow: hidden; font-size: 14px; font-weight: 600; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap }
    .pp { display: block; font-size: 13px; font-variant-numeric: tabular-nums; opacity: .8 }
    @media (hover: hover) { .product:hover .pt { text-decoration: underline; text-underline-offset: 2px } }
    .text { margin: 0; font-size: 15px; line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere }
    /* Время «плавает» в конце последней строки, как в мессенджерах */
    .time { float: right; margin: 6px 0 -2px 10px; font-size: 11px; line-height: 1; font-variant-numeric: tabular-nums; color: var(--color-ink-soft) }
    .mine .time { color: rgb(255 255 255 / .78) }
  `,
})
export class ChatBubbleComponent {
  readonly message = input.required<ChatMessage>();
  /** Чьи сообщения справа: у покупателя — 'buyer'. */
  readonly mine = input<'buyer' | 'shop'>('buyer');
  /** Продолжение серии той же стороны — меньше отступ и без «хвоста». */
  readonly grouped = input(false);
  readonly time = chatTime;
}
