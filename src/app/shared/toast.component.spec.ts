import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ToastService } from '../core/toast.service';
import { ToastComponent } from './toast.component';

describe('ToastComponent', () => {
  async function render() {
    await TestBed.configureTestingModule({ imports: [ToastComponent], providers: [provideRouter([{ path: '**', children: [] }])] }).compileComponents();
    const f = TestBed.createComponent(ToastComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const q = (t: string) => el.querySelector<HTMLElement>(`[data-test="${t}"]`);
    return { f, el, q, toasts: TestBed.inject(ToastService) };
  }
  afterEach(() => TestBed.resetTestingModule());

  it('область role="status" есть и без плашки; плашка появляется с текстом', async () => {
    const { f, el, q, toasts } = await render();
    expect(el.querySelector('[role="status"]')).not.toBeNull();
    expect(q('toast')).toBeNull();
    toasts.show({ text: 'Ссылка скопирована' });
    f.detectChanges();
    expect(q('toast')?.textContent).toContain('Ссылка скопирована');
    expect(q('toast-action')).toBeNull();
  });

  it('кнопка-действие выполняет run, крестик закрывает', async () => {
    const { f, q, toasts } = await render();
    const run = jest.fn();
    toasts.show({ text: 'Товар убран', action: { label: 'Вернуть', run } });
    f.detectChanges();
    q('toast-action')!.click();
    expect(run).toHaveBeenCalled();
    toasts.show({ text: 'Снова в сети' });
    f.detectChanges();
    q('toast-close')!.click();
    expect(toasts.current()?.leaving).toBe(true);
  });

  it('действие-ссылка ведёт по адресу и закрывает плашку', async () => {
    const { f, q, toasts } = await render();
    toasts.show({ text: 'Добавлено в избранное', action: { label: 'Открыть', link: '/favorites' } });
    f.detectChanges();
    const a = q('toast-action') as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('/favorites');
    const act = jest.spyOn(toasts, 'act');
    a.click();
    await f.whenStable();
    expect(TestBed.inject(Router).url).toBe('/favorites');
    expect(act).toHaveBeenCalled();
  });

  it('ошибка помечена классом error', async () => {
    const { f, q, toasts } = await render();
    toasts.error('Не удалось обновить');
    f.detectChanges();
    expect(q('toast')?.classList).toContain('error');
  });
});
