import { Component, Inject, Optional, RESPONSE_INIT } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TPipe } from '../../core/i18n';

/** 404: на сервере ставит статус ответа. */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, TPipe],
  template: `<section class="wrap nf"><h1 class="page-title">{{ 'Страница не найдена' | t }}</h1><p class="muted">{{ 'Возможно, товар уже продан или ссылка устарела.' | t }}</p><a class="btn" routerLink="/">{{ 'На главную' | t }}</a></section>`,
  styles: `.nf { padding-block: 80px; text-align: center } .nf p { margin-top: 8px } .nf .btn { margin-top: 24px }`,
})
export class NotFoundComponent {
  constructor(@Optional() @Inject(RESPONSE_INIT) res: ResponseInit | null) {
    if (res) (res as { status?: number }).status = 404;
  }
}
