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

  for (const name of ['search', 'store', 'heart', 'user', 'bag', 'package', 'banknote', 'circle-check', 'truck', 'shield-check', 'star', 'map-pin', 'x', 'minus', 'plus', 'instagram', 'play', 'pause', 'volume-2', 'volume-x', 'maximize', 'minimize', 'rotate-ccw']) {
    it(`иконка «${name}» рисует svg с фигурами`, async () => {
      const el = await render(name);
      const svg = el.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.querySelector('path, circle, rect')).not.toBeNull();
      // элементы должны быть в SVG-пространстве имён, иначе браузер их не отрисует
      expect(svg?.querySelector('path, circle, rect')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    });
  }

  it('«package» — коробка Lucide из четырёх путей', async () => {
    const el = await render('package');
    const paths = el.querySelectorAll('svg path');
    expect(paths.length).toBe(4);
    expect(paths[1].getAttribute('d')).toBe('M12 22V12');
  });

  it('«banknote» — купюра: прямоугольник и кружок', async () => {
    const el = await render('banknote');
    expect(el.querySelector('svg rect')).not.toBeNull();
    expect(el.querySelector('svg circle')?.getAttribute('r')).toBe('2');
  });

  it('неизвестное имя не рисует svg', async () => {
    const el = await render('unknown');
    expect(el.querySelector('svg')).toBeNull();
  });
});
