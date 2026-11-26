import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { MarketApi } from '../../core/market-api.service';
import { Buyer } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { initialsOf, ProfileComponent } from './profile.component';

const BUYER: Buyer = { id: 1, phone: '+992931110002', name: 'Мадина' };

async function setup(api: Partial<Record<'me' | 'updateMe', jest.Mock>>, login = true) {
  await TestBed.configureTestingModule({
    imports: [ProfileComponent],
    providers: [provideRouter([]), { provide: MarketApi, useValue: { me: jest.fn(() => of(BUYER)), updateMe: jest.fn(), ...api } }],
  }).compileComponents();
  const auth = TestBed.inject(AuthService);
  if (login) auth.setSession({ token: 't', buyer: BUYER, is_new: false });
  else auth.hydrate();
  const nav = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const f = TestBed.createComponent(ProfileComponent);
  f.detectChanges();
  return { f, nav, auth, el: f.nativeElement as HTMLElement };
}

describe('ProfileComponent', () => {
  beforeEach(() => localStorage.clear());

  it('без входа — на /login с возвратом в /me, профиль не запрашивается', async () => {
    const me = jest.fn();
    const { nav } = await setup({ me }, false);
    expect(nav).toHaveBeenCalledWith(['/login'], { queryParams: { return: '/me' } });
    expect(me).not.toHaveBeenCalled();
  });

  it('карточка: аватар с инициалом, имя, номер — формы нет; ссылки на разделы', async () => {
    const { f, el } = await setup({});
    await f.whenStable(); f.detectChanges();
    expect(el.querySelector('[data-test="avatar"]')?.textContent?.trim()).toBe('М');
    expect(el.querySelector('[data-test="name"]')?.textContent).toBe('Мадина');
    expect(el.querySelector('[data-test="phone"]')?.textContent).toBe('+992 93 111 00 02');
    expect(el.querySelector('#profile-name')).toBeNull();
    for (const href of ['/me/orders', '/favorites', '/chats', '/sell']) expect(el.querySelector(`a[href="${href}"]`)).not.toBeNull();
  });

  it('без имени — иконка в аватаре и «Укажите имя»', async () => {
    const { f, el } = await setup({ me: jest.fn(() => of({ ...BUYER, name: null })) });
    f.detectChanges();
    expect(el.querySelector('[data-test="avatar"] app-icon')).not.toBeNull();
    expect(el.querySelector('[data-test="name"]')?.textContent).toBe('Укажите имя');
  });

  it('нажатие на карточку — форма с именем и номером только для чтения; «Отмена» и Esc возвращают карточку', async () => {
    const { f, el } = await setup({});
    (el.querySelector('[data-test="profile-card"]') as HTMLButtonElement).click();
    f.detectChanges(); await f.whenStable();
    expect((el.querySelector('#profile-name') as HTMLInputElement).value).toBe('Мадина');
    expect(el.querySelector('input[type="tel"]')).toBeNull();
    (el.querySelector('[data-test="cancel-edit"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el.querySelector('[data-test="profile-card"]')).not.toBeNull();
    f.componentInstance.edit(); f.detectChanges();
    el.querySelector('form')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    f.detectChanges();
    expect(el.querySelector('#profile-name')).toBeNull();
  });

  it('initialsOf: две первые буквы, пробелы не мешают', () => {
    expect(initialsOf('  мадина   рахимова  ахмедовна')).toBe('МР');
    expect(initialsOf('Мадина')).toBe('М');
    expect(initialsOf('   ')).toBe('');
  });

  it('свежее имя с сервера подменяет сохранённое, пока поле не трогали', async () => {
    const { f, auth } = await setup({ me: jest.fn(() => of({ ...BUYER, name: 'Зарина' })) });
    expect(f.componentInstance.name()).toBe('Зарина');
    expect(auth.buyer()?.name).toBe('Зарина');
  });

  it('«Сохранить» выключена, пока имя пустое или прежнее', async () => {
    const { f } = await setup({});
    const c = f.componentInstance;
    expect(c.canSave()).toBe(false);
    c.name.set('   ');
    expect(c.canSave()).toBe(false);
    c.name.set('Мадина Р.');
    expect(c.canSave()).toBe(true);
  });

  it('сохранение: PATCH с обрезанным именем, профиль в сессии и всплывашка', async () => {
    const updateMe = jest.fn(() => of({ ...BUYER, name: 'Мадина Р.' }));
    const { f, auth } = await setup({ updateMe });
    const toast = jest.spyOn(TestBed.inject(ToastService), 'show');
    f.componentInstance.name.set('  Мадина Р.  ');
    f.componentInstance.save();
    expect(updateMe).toHaveBeenCalledWith('Мадина Р.');
    expect(auth.buyer()?.name).toBe('Мадина Р.');
    expect(JSON.parse(localStorage.getItem('harid.buyer')!).name).toBe('Мадина Р.');
    expect(toast).toHaveBeenCalledWith({ text: 'Имя сохранено' });
    expect(f.componentInstance.editing()).toBe(false);
  });

  it('ошибка сохранения — текст под полем, имя в сессии прежнее', async () => {
    const updateMe = jest.fn(() => throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'Напишите, как к вам обращаться' } })));
    const { f, el, auth } = await setup({ updateMe });
    f.componentInstance.edit();
    f.componentInstance.name.set('Х');
    f.componentInstance.save();
    f.detectChanges();
    expect(el.querySelector('[data-test="name-error"]')).not.toBeNull();
    expect(auth.buyer()?.name).toBe('Мадина');
    expect(f.componentInstance.editing()).toBe(true);
  });

  it('«Выйти» — сессия очищена, переход на главную', async () => {
    const { f, nav, auth, el } = await setup({});
    (el.querySelector('[data-test="logout"]') as HTMLButtonElement).click();
    expect(auth.loggedIn()).toBe(false);
    expect(nav).toHaveBeenCalledWith(['/']);
    expect(f).toBeTruthy();
  });
});
