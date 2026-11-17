import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { apiErrorMessage } from '../../core/api-error';
import { MarketApi } from '../../core/market-api.service';
import { phone9 } from '../../core/phone';

/** Открытие лавки: ник, имя, телефон → SMS-код → лавка и кабинет в админке. */
@Component({
  selector: 'app-sell',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule],
  template: `
    <section class="box">
      <h1>Посты из вашего Instagram станут товарами на Хариде</h1>
      <p class="muted">Импортируйте посты в кабинете, отметьте «На витрине» — покупатели закажут, курьер привезёт и заберёт оплату наличными.</p>
      @switch (step()) {
        @case ('form') {
          <form [formGroup]="form" (ngSubmit)="sendCode()" class="form">
            <label>Ник в Instagram<input formControlName="handle" placeholder="@my.shop" autocapitalize="none" /></label>
            <label>Ваше имя<input formControlName="owner_name" /></label>
            <label>Телефон<input formControlName="phone" inputmode="tel" placeholder="93 123 45 67" /></label>
            <button class="btn" type="submit" [disabled]="form.invalid || busy()">Получить код</button>
          </form>
        }
        @case ('code') {
          <p class="muted">Код отправлен на +992 {{ phone9(form.getRawValue().phone) }}</p>
          <label>Код из SMS<input [ngModel]="code()" (ngModelChange)="code.set($event)" inputmode="numeric" maxlength="6" /></label>
          <button class="btn" type="button" [disabled]="busy() || code().length !== 6" (click)="apply()">Открыть лавку</button>
          <button class="btn btn--ghost" type="button" (click)="step.set('form')">Изменить данные</button>
        }
        @case ('done') {
          <h2>Лавка открыта</h2>
          <p>&#64;{{ handle() }} уже на Хариде. Войдите в кабинет по номеру телефона, чтобы добавить товары.</p>
          <a class="btn" data-test="cabinet" [href]="cabinetUrl">Перейти в кабинет</a>
        }
      }
      @if (error()) { <p class="error">{{ error() }}</p> }
    </section>
  `,
  styles: `.box { max-width:520px; margin:24px auto; display:flex; flex-direction:column; gap:12px } .form { display:flex; flex-direction:column; gap:12px } label { display:flex; flex-direction:column; gap:4px } input { padding:10px 12px; border:1px solid var(--line); border-radius:10px; font:inherit } a.btn { text-decoration:none; text-align:center }`,
})
export class SellComponent {
  private readonly api = inject(MarketApi);
  readonly cabinetUrl = environment.cabinetUrl;
  readonly phone9 = phone9;
  readonly step = signal<'form' | 'code' | 'done'>('form');
  readonly code = signal('');
  readonly handle = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    handle: ['', [Validators.required, Validators.pattern(/^@?[A-Za-z0-9._]{1,30}$/)]],
    owner_name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^\D*(\d\D*){9,12}$/)]],
  });

  sendCode(): void {
    if (this.form.invalid) return;
    this.busy.set(true); this.error.set('');
    this.api.sellerSendCode(phone9(this.form.getRawValue().phone)).subscribe({
      next: () => { this.busy.set(false); this.step.set('code'); },
      error: (e) => { this.busy.set(false); this.error.set(apiErrorMessage(e)); },
    });
  }
  apply(): void {
    const v = this.form.getRawValue();
    this.busy.set(true); this.error.set('');
    this.api.sellerApply({ handle: v.handle.trim(), owner_name: v.owner_name.trim(), phone: phone9(v.phone), code: this.code() }).subscribe({
      next: (r) => { this.busy.set(false); this.handle.set(r.handle); this.step.set('done'); },
      error: (e) => { this.busy.set(false); this.error.set(apiErrorMessage(e)); },
    });
  }
}
