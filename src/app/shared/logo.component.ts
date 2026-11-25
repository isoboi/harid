import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Логотип прототипа: шафрановая бирка с дырочкой, наклонённая на −6°, и слово «харид». */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-logo',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a routerLink="/" class="logo" aria-label="Харид — на главную">
      <svg width="30" height="22" viewBox="0 0 30 22" aria-hidden="true" focusable="false">
        <path fill-rule="evenodd" fill="#FFC93C" d="M9 0H28a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H9L0 11 9 0Zm-1 13.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z" />
      </svg>
      <span class="word">харид</span>
    </a>
  `,
  styles: `
    :host { display: inline-flex }
    /* Поле нажатия 44px по высоте, а вёрстка шапки как у 24px-логотипа */
    .logo { display: flex; align-items: center; gap: 8px; min-height: 44px; margin-block: -10px; color: inherit }
    svg { rotate: -6deg }
    .word { font-size: 24px; line-height: 1; font-weight: 800; letter-spacing: -0.04em }
  `,
})
export class LogoComponent {}
