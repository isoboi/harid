import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('рисует шапку с навигацией и подвал', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
    const f = TestBed.createComponent(AppComponent);
    f.detectChanges();
    const text = f.nativeElement.textContent as string;
    for (const s of ['Харид', 'Продавцам', 'Избранное', 'Войти', 'Корзина', 'Покупателям']) {
      expect(text).toContain(s);
    }
  });
});
