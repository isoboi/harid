import { afterNextRender, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { HeaderComponent } from './shared/header.component';
import { FooterComponent } from './shared/footer.component';
import { OfflineBannerComponent } from './shared/offline-banner.component';
import { ToastComponent } from './shared/toast.component';
import { isChatThread, pathOf, TabBarComponent } from './shared/tab-bar.component';
import { AuthService } from './core/auth.service';
import { CartService } from './core/cart.service';
import { FavoritesService } from './core/favorites.service';
import { RecentlyViewedService } from './core/recently-viewed.service';
import { ChatSocket } from './core/chat-socket.service';
import { PwaService } from './core/pwa.service';
import { WebVitals } from './core/web-vitals.service';

/**
 * Каркас как в прототипе: шапка, main на всю ширину (каждая страница сама задаёт контейнер .wrap,
 * чтобы полосы вроде «Оплата наличными» шли от края до края) и подвал, прижатый к низу.
 * На телефоне снизу — панель вкладок; отступ под неё задаёт styles.scss (правило app-root:has(.tabbar)).
 * Открытая переписка (/chats/:id) — экран мессенджера: без подвала, а на телефоне и без шапки сайта —
 * сверху своя строка с лавкой, снизу поле сообщения.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, TabBarComponent, OfflineBannerComponent, ToastComponent],
  template: `<app-header [class.chat-hide]="chatThread()" /><main class="page"><router-outlet /></main>@if (!chatThread()) { <app-footer /> }<app-tab-bar /><div class="dock"><app-toast /><app-offline-banner /></div>`,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100vh; padding-bottom: env(safe-area-inset-bottom) }
    .page { flex: 1 }
    @media (max-width: 640px) { app-header.chat-hide { display: none } }
  `,
})
export class AppComponent {
  private readonly router = inject(Router);
  private readonly path = toSignal(
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), map((e) => pathOf(e.urlAfterRedirects))),
    { initialValue: pathOf(this.router.url) },
  );
  readonly chatThread = computed(() => isChatThread(this.path()));

  constructor() {
    const cart = inject(CartService);
    const fav = inject(FavoritesService);
    const recent = inject(RecentlyViewedService);
    const auth = inject(AuthService);
    const chat = inject(ChatSocket);
    // Создаётся сразу: предложение установки может прийти раньше первого рендера
    const pwa = inject(PwaService);
    const vitals = inject(WebVitals);
    // Только в браузере и после гидратации: сервер и первый рендер клиента одинаковы (пустое состояние).
    afterNextRender(() => {
      cart.hydrate();
      fav.hydrate();
      recent.hydrate();
      pwa.hydrate();
      auth.hydrate();
      // Сокет чата: подключается после входа, на сервере не стартует
      chat.start();
      // Скорость у живых покупателей (LCP, INP, CLS…) — на наш сервер, см. src/vitals.ts
      vitals.start();
    });
  }
}
