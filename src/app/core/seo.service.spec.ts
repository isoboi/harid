import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  it('ставит title и og-теги', () => {
    TestBed.configureTestingModule({});
    TestBed.inject(SeoService).set({ title: 'Наушники — Харид', description: '540 смн', image: 'http://x/a.jpg' });
    expect(TestBed.inject(Title).getTitle()).toBe('Наушники — Харид');
    const meta = TestBed.inject(Meta);
    expect(meta.getTag('property="og:title"')?.content).toBe('Наушники — Харид');
    expect(meta.getTag('property="og:image"')?.content).toBe('http://x/a.jpg');
    expect(meta.getTag('name="description"')?.content).toBe('540 смн');
  });
});
