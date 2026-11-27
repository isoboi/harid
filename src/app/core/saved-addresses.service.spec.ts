import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { MarketApi } from './market-api.service';
import { Order } from './models';
import { Recipient, recipientKey } from './saved-addresses';
import { SavedAddresses } from './saved-addresses.service';
import { ToastService } from './toast.service';

const mama: Recipient = { name: 'Мама', phone: '931110002', district: 'Вахдат', address: 'ул. Ленина 5' };
const work: Recipient = { name: 'Наим', phone: '927000000', district: 'Сино', address: 'Рудаки 12' };
const home: Recipient = { name: 'Наим', phone: '927000000', district: 'Шоҳмансур', address: 'Айни 3' };
const order = (created_at: string, r: Recipient) => ({ created_at, customer: { ...r, phone: `+992${r.phone}` } }) as unknown as Order;
const stored = (key: string) => JSON.parse(localStorage.getItem(key)!);

function setup(myOrders: jest.Mock = jest.fn(() => of([])), platform = 'browser') {
  TestBed.configureTestingModule({ providers: [{ provide: MarketApi, useValue: { myOrders } }, { provide: PLATFORM_ID, useValue: platform }] });
  const auth = TestBed.inject(AuthService);
  auth.hydrate();
  return { s: TestBed.inject(SavedAddresses), auth, myOrders };
}
const login = (auth: AuthService, token = 't1') => auth.setSession({ token, buyer: { id: 1, phone: '+992927000000', name: null }, is_new: false });

describe('SavedAddresses', () => {
  beforeEach(() => localStorage.clear());

  it('переносит старый адрес: lastAddress + lastPhone → первая запись', () => {
    localStorage.setItem('harid.lastAddress', JSON.stringify({ name: 'Мама', district: 'Вахдат', address: 'ул. Ленина 5' }));
    localStorage.setItem('harid.lastPhone', JSON.stringify('931110002'));
    const { s } = setup();
    s.load();
    expect(s.list()).toEqual([mama]);
    expect(stored('harid.addresses')).toEqual([mama]);
  });
  it('новый список уже есть — старый адрес не переносится', () => {
    localStorage.setItem('harid.addresses', JSON.stringify([]));
    localStorage.setItem('harid.lastAddress', JSON.stringify({ name: 'Мама', district: 'Вахдат', address: 'ул. Ленина 5' }));
    localStorage.setItem('harid.lastPhone', JSON.stringify('931110002'));
    const { s } = setup();
    s.load();
    expect(s.list()).toEqual([]);
  });
  it('без входа историю не запрашивает', () => {
    const { s, myOrders } = setup();
    s.load();
    expect(myOrders).not.toHaveBeenCalled();
  });
  it('вошедший: локальные первыми, за ними из истории, без дублей', () => {
    localStorage.setItem('harid.addresses', JSON.stringify([work]));
    const { s, auth } = setup(jest.fn(() => of([order('2026-11-20T10:00:00Z', mama), order('2026-11-01T10:00:00Z', { ...work, name: 'Я' })])));
    login(auth);
    s.load();
    expect(s.list()).toEqual([work, mama]);
  });
  it('история запрашивается один раз на токен', () => {
    const { s, auth, myOrders } = setup();
    login(auth);
    s.load(); s.load();
    expect(myOrders).toHaveBeenCalledTimes(1);
  });
  it('повторный load() перечитывает локальный список', () => {
    const { s } = setup();
    s.load();
    localStorage.setItem('harid.addresses', JSON.stringify([mama]));
    s.load();
    expect(s.list()).toEqual([mama]);
  });
  it('ошибка истории — только локальный список', () => {
    localStorage.setItem('harid.addresses', JSON.stringify([work]));
    const { s, auth } = setup(jest.fn(() => throwError(() => new Error('500'))));
    login(auth);
    expect(() => s.load()).not.toThrow();
    expect(s.list()).toEqual([work]);
  });
  it('после выхода и входа другого покупателя чужой истории нет', () => {
    const myOrders = jest.fn().mockReturnValueOnce(of([order('2026-11-20T10:00:00Z', mama)])).mockReturnValueOnce(of([order('2026-11-21T10:00:00Z', work)]));
    const { s, auth } = setup(myOrders);
    login(auth);
    s.load();
    expect(s.list()).toEqual([mama]);
    auth.logout();
    expect(s.list()).toEqual([]);
    login(auth, 't2');
    s.load();
    expect(myOrders).toHaveBeenCalledTimes(2);
    expect(s.list()).toEqual([work]);
  });
  it('remember: свежий наверх, тот же получатель не дублируется, имя обновляется', () => {
    const { s } = setup();
    s.load();
    s.remember(mama); s.remember(work);
    s.remember({ ...mama, name: 'Модар', address: ' УЛ. Ленина 5 ' });
    expect(s.list().map((r) => r.name)).toEqual(['Модар', 'Наим']);
    expect(stored('harid.addresses')).toHaveLength(2);
  });
  it('remember: не больше 10', () => {
    const { s } = setup();
    s.load();
    for (let i = 0; i < 12; i++) s.remember({ ...mama, address: `дом ${i + 10}` });
    expect(stored('harid.addresses')).toHaveLength(10);
    expect(s.list()[0].address).toBe('дом 21');
  });
  it('remember не затирает запись другой вкладки', () => {
    const { s } = setup();
    s.load();
    localStorage.setItem('harid.addresses', JSON.stringify([home]));
    s.remember(mama);
    expect(stored('harid.addresses')).toEqual([mama, home]);
  });
  it('remember удаляет harid.lastAddress и harid.lastPhone', () => {
    localStorage.setItem('harid.lastAddress', JSON.stringify({ name: 'Мама', district: 'Вахдат', address: 'ул. Ленина 5' }));
    localStorage.setItem('harid.lastPhone', JSON.stringify('931110002'));
    const { s } = setup();
    s.load();
    s.remember(work);
    expect(localStorage.getItem('harid.lastAddress')).toBeNull();
    expect(localStorage.getItem('harid.lastPhone')).toBeNull();
  });
  it('remove скрывает получателя из истории; «Вернуть» показывает снова', () => {
    const { s, auth } = setup(jest.fn(() => of([order('2026-11-20T10:00:00Z', mama)])));
    login(auth);
    s.load();
    s.remove(mama);
    expect(s.list()).toEqual([]);
    expect(stored('harid.addresses.hidden')).toEqual([recipientKey(mama)]);
    const toast = TestBed.inject(ToastService);
    expect(toast.current()).toMatchObject({ text: 'Адрес удалён', action: { label: 'Вернуть' } });
    toast.act();
    expect(s.list()).toEqual([mama]);
    expect(stored('harid.addresses.hidden')).toEqual([]);
  });
  it('remove локального и «Вернуть» — на прежнее место', () => {
    localStorage.setItem('harid.addresses', JSON.stringify([work, mama, home]));
    const { s } = setup();
    s.load();
    s.remove(mama);
    expect(s.list()).toEqual([work, home]);
    TestBed.inject(ToastService).act();
    expect(s.list()).toEqual([work, mama, home]);
    expect(stored('harid.addresses')).toEqual([work, mama, home]);
  });
  it('снова заказали скрытому получателю — он опять виден', () => {
    localStorage.setItem('harid.addresses', JSON.stringify([mama]));
    const { s } = setup();
    s.load();
    s.remove(mama);
    s.remember(mama);
    expect(s.list()).toEqual([mama]);
  });
  it('скрытых хранится не больше 50', () => {
    const { s } = setup();
    s.load();
    for (let i = 0; i < 55; i++) s.remove({ ...mama, address: `дом ${i + 10}` });
    expect(stored('harid.addresses.hidden')).toHaveLength(50);
    expect(stored('harid.addresses.hidden')[49]).toBe(recipientKey({ ...mama, address: 'дом 64' }));
  });
  it('на сервере load() ничего не читает и не запрашивает', () => {
    localStorage.setItem('harid.addresses', JSON.stringify([mama]));
    const { s, auth, myOrders } = setup(jest.fn(() => of([])), 'server');
    login(auth);
    s.load();
    expect(s.list()).toEqual([]);
    expect(myOrders).not.toHaveBeenCalled();
  });
});
