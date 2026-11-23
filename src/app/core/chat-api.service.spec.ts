import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChatApi } from './chat-api.service';
import { environment } from '../../environments/environment';

describe('ChatApi', () => {
  const base = `${environment.apiUrl}/market/chats`;
  let api: ChatApi; let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ChatApi); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('маршруты /market/chats', () => {
    api.list().subscribe(); http.expectOne({ method: 'GET', url: base }).flush([]);
    api.unread().subscribe(); http.expectOne({ method: 'GET', url: `${base}/unread` }).flush({ unread_total: 0 });
    api.start({ shop_handle: 'zebo.style', text: 'Есть M?', product_id: 42 }).subscribe();
    const start = http.expectOne({ method: 'POST', url: base });
    expect(start.request.body).toEqual({ shop_handle: 'zebo.style', text: 'Есть M?', product_id: 42 });
    start.flush({});
    api.messages(10, { before: 5 }).subscribe(); http.expectOne(`${base}/10/messages?before=5`).flush([]);
    api.messages(10).subscribe(); http.expectOne(`${base}/10/messages`).flush([]);
    api.send(10, { text: 'x' }).subscribe(); http.expectOne({ method: 'POST', url: `${base}/10/messages` }).flush({});
    api.read(10).subscribe(); http.expectOne({ method: 'POST', url: `${base}/10/read` }).flush({ unread_total: 0 });
  });
});
