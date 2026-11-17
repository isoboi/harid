import { afterNextRender, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header.component';
import { FooterComponent } from './shared/footer.component';
import { AuthService } from './core/auth.service';
import { CartService } from './core/cart.service';
import { FavoritesService } from './core/favorites.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  template: `<app-header /><main class="page"><router-outlet /></main><app-footer />`,
  styles: `.page { max-width: 1200px; margin: 0 auto; padding: 16px }`,
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
