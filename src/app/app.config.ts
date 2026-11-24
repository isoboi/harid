import { ApplicationConfig, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Прокрутка вверх при переходе, возврат на место при «назад», якоря (#cash) работают
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // Клики до гидратации запоминаются и проигрываются после неё (кнопка «В корзину» не теряется)
    provideClientHydration(withHttpTransferCacheOptions({ includePostRequests: false }), withEventReplay()),
    // PWA: офлайн-каркас и кэш каталога (ngsw-config.json). В разработке выключен — не мешает живой перезагрузке.
    // Регистрация — когда приложение успокоилось (не дольше 30 с), чтобы не отнимать сеть у первой загрузки.
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' }),
  ],
};
