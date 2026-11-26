import { ApplicationConfig, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, TitleStrategy, withComponentInputBinding, withInMemoryScrolling, withPreloading } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { ShopperPreloading } from './core/shopper-preloading';
import { provideI18n } from './core/i18n';
import { I18nTitleStrategy } from './core/i18n-title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Прокрутка вверх при переходе, возврат на место при «назад», якоря (#cash) работают.
    // Предзагрузка: код страниц с data.preload качается заранее, пока браузер простаивает (core/shopper-preloading.ts).
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      withPreloading(ShopperPreloading),
    ),
    // Язык из cookie lang; таджикский словарь грузится до первого рендера. Заголовки вкладок из роутов — в переводе.
    provideI18n(),
    { provide: TitleStrategy, useClass: I18nTitleStrategy },
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // Клики до гидратации запоминаются и проигрываются после неё (кнопка «В корзину» не теряется)
    provideClientHydration(withHttpTransferCacheOptions({ includePostRequests: false }), withEventReplay()),
    // PWA: офлайн-каркас и кэш каталога (ngsw-config.json). В разработке выключен — не мешает живой перезагрузке.
    // Регистрация — когда приложение успокоилось (не дольше 30 с), чтобы не отнимать сеть у первой загрузки.
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' }),
  ],
};
