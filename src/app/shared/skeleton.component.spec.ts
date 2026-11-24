import { TestBed } from '@angular/core/testing';
import { SkelProductsComponent, SkelSummaryComponent } from './skeleton.component';

describe('SkelProductsComponent', () => {
  it('рисует count карточек в сетке .products и объявляет загрузку', async () => {
    await TestBed.configureTestingModule({ imports: [SkelProductsComponent] }).compileComponents();
    const f = TestBed.createComponent(SkelProductsComponent);
    f.componentRef.setInput('count', 3);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.card').length).toBe(3);
    expect(el.querySelector('.products[role="status"]')?.textContent).toContain('Загрузка');
  });

  it('по умолчанию — 8 карточек', async () => {
    await TestBed.configureTestingModule({ imports: [SkelProductsComponent] }).compileComponents();
    const f = TestBed.createComponent(SkelProductsComponent);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelectorAll('.card').length).toBe(8);
  });
});

describe('SkelSummaryComponent', () => {
  it('с кнопкой по умолчанию, без actions — только строки сумм', async () => {
    await TestBed.configureTestingModule({ imports: [SkelSummaryComponent] }).compileComponents();
    const f = TestBed.createComponent(SkelSummaryComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.row').length).toBe(3);
    expect(el.querySelector('.cta')).not.toBeNull();
    f.componentRef.setInput('actions', false);
    f.detectChanges();
    expect(el.querySelector('.cta')).toBeNull();
  });
});
