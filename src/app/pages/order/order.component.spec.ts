import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OrderComponent } from './order.component';
import { MarketApi } from '../../core/market-api.service';

describe('OrderComponent', () => {
  it('показывает номер, этап и сумму', async () => {
    const order = jest.fn(() => of({ number: 'R-221526', stage: 'in_delivery', items_total: 640, delivery_total: 15, slot: 'Сегодня, 18:00–21:00', customer: { name: 'Ф', phone: '+992 93 111 00 02', district: 'Сино', address: 'ул' }, lines: [], shops: [] }));
    await TestBed.configureTestingModule({ imports: [OrderComponent], providers: [provideRouter([]), { provide: MarketApi, useValue: { order } }] }).compileComponents();
    const f = TestBed.createComponent(OrderComponent);
    f.componentRef.setInput('number', 'R-221526');
    f.componentRef.setInput('phone', '931110002');
    f.detectChanges();
    const t: string = f.nativeElement.textContent;
    expect(order).toHaveBeenCalledWith('R-221526', '931110002');
    expect(t).toContain('R-221526');
    expect(t).toContain('Курьер в пути');
    expect(t).toContain('655 смн');
  });
});
