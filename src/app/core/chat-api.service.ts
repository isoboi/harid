import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ChatMessage, ChatSummary, SendMessageInput, StartChatInput } from './models';

/** REST чата покупателя с лавками (/market/chats); токен добавляет authInterceptor. */
@Injectable({ providedIn: 'root' })
export class ChatApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/market/chats`;

  list(): Observable<ChatSummary[]> { return this.http.get<ChatSummary[]>(this.base); }
  unread(): Observable<{ unread_total: number }> { return this.http.get<{ unread_total: number }>(`${this.base}/unread`); }
  start(body: StartChatInput): Observable<{ chat_id: number; message: ChatMessage }> { return this.http.post<{ chat_id: number; message: ChatMessage }>(this.base, body); }
  messages(id: number, q: { before?: number; after?: number } = {}): Observable<ChatMessage[]> {
    let params = new HttpParams();
    if (q.before) params = params.set('before', q.before);
    if (q.after) params = params.set('after', q.after);
    return this.http.get<ChatMessage[]>(`${this.base}/${id}/messages`, { params });
  }
  send(id: number, body: SendMessageInput): Observable<ChatMessage> { return this.http.post<ChatMessage>(`${this.base}/${id}/messages`, body); }
  read(id: number): Observable<{ unread_total: number }> { return this.http.post<{ unread_total: number }>(`${this.base}/${id}/read`, {}); }
}
