import { TestBed } from '@angular/core/testing';
import { IconComponent } from './icon.component';

describe('IconComponent', () => {
  async function render(name: string) {
    await TestBed.configureTestingModule({ imports: [IconComponent] }).compileComponents();
    const f = TestBed.createComponent(IconComponent);
    f.componentRef.setInput('name', name);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  for (const name of ['search', 'store', 'heart', 'user', 'bag']) {
    it(`иконка «${name}» рисует svg с фигурами`, async () => {
      const el = await render(name);
      const svg = el.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.querySelector('path, circle')).not.toBeNull();
      // элементы должны быть в SVG-пространстве имён, иначе браузер их не отрисует
      expect(svg?.querySelector('path, circle')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    });
  }

  it('неизвестное имя не рисует svg', async () => {
    const el = await render('unknown');
    expect(el.querySelector('svg')).toBeNull();
  });
});
