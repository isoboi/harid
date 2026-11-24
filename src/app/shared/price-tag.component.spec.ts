import { TestBed } from '@angular/core/testing';
import { PriceTagComponent } from './price-tag.component';

describe('PriceTagComponent', () => {
  const render = (inputs: Record<string, unknown>) => {
    const f = TestBed.createComponent(PriceTagComponent);
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  };

  it('со старой ценой — бейдж −N% с округлением вниз', () => {
    expect(render({ price: 425, old: 500 }).textContent).toContain('−15%');
    expect(render({ price: 449, old: 500 }).textContent).toContain('−10%');
  });

  it('срок акции по Душанбе: конец дня 30 ноября — «до 30 ноября»', () => {
    expect(render({ price: 425, old: 500, endsAt: '2026-11-30T18:59:59Z' }).textContent).toContain('до 30 ноября');
  });

  it('без старой цены — ни бейджа, ни срока', () => {
    const el = render({ price: 425, old: null, endsAt: null });
    expect(el.textContent).not.toContain('%');
    expect(el.textContent).not.toContain('до ');
  });
});
