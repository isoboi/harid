import { TestBed } from '@angular/core/testing';
import { clampPan, clampScale, MAX_SCALE, PhotoViewerComponent, zoomAt } from './photo-viewer.component';

describe('математика увеличения', () => {
  it('clampPan: край увеличенного фото не отходит от края экрана', () => {
    // 2× на экране 400×300: запас по 200 и 150 в каждую сторону
    expect(clampPan({ x: 500, y: -500 }, 2, 400, 300)).toEqual({ x: 200, y: -150 });
    expect(clampPan({ x: 50, y: 20 }, 2, 400, 300)).toEqual({ x: 50, y: 20 });
    expect(clampPan({ x: 50, y: 20 }, 1, 400, 300)).toEqual({ x: 0, y: 0 });
  });
  it('zoomAt: точка под пальцем остаётся на месте', () => {
    const p = { x: 100, y: -40 };
    const pan = zoomAt({ x: 0, y: 0 }, 1, 2, p);
    // Точка картинки под пальцем до (p / 1) и после ((p - pan) / 2) — одна и та же
    expect((p.x - pan.x) / 2).toBeCloseTo(p.x);
    expect((p.y - pan.y) / 2).toBeCloseTo(p.y);
  });
  it('clampScale: от 1 до MAX_SCALE', () => {
    expect(clampScale(0.3)).toBe(1);
    expect(clampScale(9)).toBe(MAX_SCALE);
  });
});

/** В jsdom нет PointerEvent: собираем из MouseEvent с нужными полями. */
function ptr(type: string, x: number, y: number, id = 1): Event {
  const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperties(e, { pointerId: { value: id }, pointerType: { value: 'touch' }, isPrimary: { value: id === 1 } });
  return e;
}

describe('PhotoViewerComponent', () => {
  async function render(start = 0) {
    await TestBed.configureTestingModule({ imports: [PhotoViewerComponent] }).compileComponents();
    const f = TestBed.createComponent(PhotoViewerComponent);
    f.componentRef.setInput('photos', ['a.jpg', 'b.jpg', 'c.jpg']);
    f.componentRef.setInput('start', start);
    f.componentRef.setInput('alt', 'Платье');
    const closed = jest.fn();
    f.componentInstance.closed.subscribe(closed);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const stage = el.querySelector('[data-test="photo-viewer"]') as HTMLElement;
    const swipe = (x0: number, y0: number, x1: number, y1: number) => {
      stage.dispatchEvent(ptr('pointerdown', x0, y0));
      stage.dispatchEvent(ptr('pointermove', (x0 + x1) / 2, (y0 + y1) / 2));
      stage.dispatchEvent(ptr('pointermove', x1, y1));
      stage.dispatchEvent(ptr('pointerup', x1, y1));
      f.detectChanges();
    };
    return { f, el, stage, closed, swipe, c: f.componentInstance };
  }
  afterEach(() => TestBed.resetTestingModule());

  it('открывается на выбранном фото, счётчик «2 / 3»', async () => {
    const { el } = await render(1);
    expect(el.querySelector('[data-test="viewer-count"]')?.textContent?.trim()).toBe('2 / 3');
  });

  it('свайп влево — следующее фото, вправо — предыдущее; короткий — остаёмся', async () => {
    const { c, swipe } = await render(0);
    swipe(300, 200, 150, 205);
    expect(c.index()).toBe(1);
    swipe(150, 200, 300, 200);
    expect(c.index()).toBe(0);
    swipe(300, 200, 270, 200);
    expect(c.index()).toBe(0);
  });

  it('свайп вниз закрывает с номером текущего фото', async () => {
    const { closed, swipe } = await render(2);
    swipe(200, 100, 205, 260);
    expect(closed).toHaveBeenCalledWith(2);
  });

  it('двойное нажатие увеличивает, повторное — возвращает', async () => {
    const { c, stage, f } = await render(0);
    const tap = () => { stage.dispatchEvent(ptr('pointerdown', 10, 10)); stage.dispatchEvent(ptr('pointerup', 10, 10)); f.detectChanges(); };
    tap(); tap();
    expect(c.scale()).toBeGreaterThan(1);
    tap(); tap();
    expect(c.scale()).toBe(1);
  });

  it('щипок двумя пальцами увеличивает, увеличенное фото не листается свайпом', async () => {
    const { c, stage, f, swipe } = await render(0);
    stage.dispatchEvent(ptr('pointerdown', 100, 100, 1));
    stage.dispatchEvent(ptr('pointerdown', 140, 100, 2));
    stage.dispatchEvent(ptr('pointermove', 180, 100, 2));
    stage.dispatchEvent(ptr('pointerup', 180, 100, 2));
    stage.dispatchEvent(ptr('pointerup', 100, 100, 1));
    f.detectChanges();
    expect(c.scale()).toBeCloseTo(2);
    swipe(300, 200, 100, 200);
    expect(c.index()).toBe(0);
  });

  it('Esc закрывает, стрелки листают', async () => {
    const { c, closed } = await render(0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(c.index()).toBe(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(c.index()).toBe(0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).toHaveBeenCalledWith(0);
  });
});
