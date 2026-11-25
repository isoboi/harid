import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PwaService } from '../core/pwa.service';
import { FooterComponent } from './footer.component';
import { OfflineBannerComponent } from './offline-banner.component';

describe('OfflineBannerComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('плашка появляется без сети и пропадает, когда сеть вернулась; область status — всегда', () => {
    const f = TestBed.createComponent(OfflineBannerComponent);
    TestBed.inject(PwaService).hydrate();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[role="status"]')).not.toBeNull();
    expect(el.querySelector('[data-test="offline"]')).toBeNull();
    window.dispatchEvent(new Event('offline'));
    f.detectChanges();
    expect(el.querySelector('[data-test="offline"]')?.textContent).toContain('Нет интернета');
    window.dispatchEvent(new Event('online'));
    f.detectChanges();
    expect(el.querySelector('[data-test="offline"]')).toBeNull();
  });
});

describe('FooterComponent — «Установить приложение»', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('кнопка есть, только когда браузер предложил установку; нажатие открывает системный диалог', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(FooterComponent);
    const pwa = TestBed.inject(PwaService);
    pwa.hydrate();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[data-test="install-app"]')).toBeNull();
    const e = Object.assign(new Event('beforeinstallprompt'), { prompt: jest.fn(() => Promise.resolve()), userChoice: Promise.resolve({ outcome: 'accepted' }) });
    window.dispatchEvent(e);
    f.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-test="install-app"]')!.click();
    f.detectChanges();
    expect(e.prompt).toHaveBeenCalled();
    expect(el.querySelector('[data-test="install-app"]')).toBeNull();
  });
});
