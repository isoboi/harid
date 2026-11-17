import { Component, Inject, Optional, RESPONSE_INIT } from '@angular/core';
import { RouterLink } from '@angular/router';

/** 404: на сервере ставит статус ответа. */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `<section class="nf"><h1>Страница не найдена</h1><a routerLink="/">На главную</a></section>`,
  styles: `.nf { text-align:center; padding:80px 0 }`,
})
export class NotFoundComponent {
  constructor(@Optional() @Inject(RESPONSE_INIT) res: ResponseInit | null) {
    if (res) (res as { status?: number }).status = 404;
  }
}
