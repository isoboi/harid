import { PLATFORM_ID, REQUEST } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18n, LANG_DICT } from '../core/i18n';
import { LangSwitchComponent } from './lang-switch.component';

const req = (cookie: string) => ({ headers: { get: (k: string) => (k === 'cookie' ? cookie : null) } });

function render(cookie: string) {
  TestBed.configureTestingModule({
    imports: [LangSwitchComponent],
    providers: [{ provide: PLATFORM_ID, useValue: 'server' }, { provide: REQUEST, useValue: req(cookie) }, { provide: LANG_DICT, useValue: { 'Язык': 'Забон' } }],
  });
  const f = TestBed.createComponent(LangSwitchComponent);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const buttons = [...el.querySelectorAll('button')];
  return { el, buttons, i18n: TestBed.inject(I18n) };
}

describe('LangSwitchComponent', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('каждый язык подписан на нём самом — его узнают и не читая по-русски', () => {
    const { buttons } = render('');
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Русский', 'Тоҷикӣ']);
    expect(buttons.map((b) => b.getAttribute('lang'))).toEqual(['ru', 'tg']);
  });
  it('текущий язык отмечен aria-pressed', () => {
    expect(render('').buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    TestBed.resetTestingModule();
    expect(render('lang=tg').buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });
  it('подпись группы — на текущем языке', () => {
    expect(render('lang=tg').el.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Забон');
  });
  it('нажатие — смена языка', () => {
    const { buttons, i18n } = render('');
    const set = jest.spyOn(i18n, 'setLang').mockImplementation(() => undefined);
    buttons[1].click();
    expect(set).toHaveBeenCalledWith('tg');
  });
});
