import { afterNextRender, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header.component';
import { FooterComponent } from './shared/footer.component';
import { AuthService } from './core/auth.service';
import { CartService } from './core/cart.service';
import { FavoritesService } from './core/favorites.service';

/**
 * Каркас как в прототипе: шапка, main на всю ширину (каждая страница сама задаёт контейнер .wrap,
 * чтобы полосы вроде «Оплата наличными» шли от края до края) и подвал, прижатый к низу.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  template: `<app-header /><main class="page"><router-outlet /></main><app-footer />`,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100vh; padding-bottom: env(safe-area-inset-bottom) }
    .page { flex: 1 }
  `,
})
export class AppComponent {
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
