import { afterNextRender, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header.component';
import { FooterComponent } from './shared/footer.component';
import { AuthService } from './core/auth.service';
import { CartService } from './core/cart.service';
import { FavoritesService } from './core/favorites.service';
import { injectUrl, isCheckoutUrl } from './core/route-url';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  host: { '[class.no-tabbar]': 'noTabbar()' },
  template: `<app-header /><main class="page"><router-outlet /></main><app-footer />`,
  styles: `
    :host { display:block }
    .page { max-width: 1200px; margin: 0 auto; padding: 16px }
    /* Телефон: снизу закреплена панель навигации (~61px + безопасная зона) — контент и подвал не прячутся под ней */
    @media (max-width: 640px) {
      :host { padding-bottom: calc(64px + env(safe-area-inset-bottom)) }
      /* На оформлении заказа панели нет (см. HeaderComponent) — оставляем только безопасную зону */
      :host(.no-tabbar) { padding-bottom: env(safe-area-inset-bottom) }
    }
  `,
})
export class AppComponent {
  private readonly url = injectUrl();
  readonly noTabbar = computed(() => isCheckoutUrl(this.url()));
  constructor() {
    const cart = inject(CartService);
    const fav = inject(FavoritesService);
    const auth = inject(AuthService);
    // Только в браузере и после гидратации: сервер и первый рендер клиента одинаковы (пустое состояние).
    afterNextRender(() => {
      cart.hydrate();
      fav.hydrate();
      auth.hydrate();
    });
  }
}
