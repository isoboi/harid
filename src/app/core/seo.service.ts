import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

/** Заголовок и Open Graph — для превью ссылок в Telegram/Instagram. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  set(p: { title: string; description: string; image?: string; url?: string }): void {
    this.title.setTitle(p.title);
    this.meta.updateTag({ name: 'description', content: p.description });
    this.meta.updateTag({ property: 'og:title', content: p.title });
    this.meta.updateTag({ property: 'og:description', content: p.description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    if (p.image) this.meta.updateTag({ property: 'og:image', content: p.image });
    if (p.url) this.meta.updateTag({ property: 'og:url', content: p.url });
  }
}
