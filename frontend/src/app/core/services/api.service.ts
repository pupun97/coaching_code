import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly baseUrl =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3000/api'
      : 'http://3.110.11.46:3000/api';

  constructor(
    private readonly http: HttpClient,
    private readonly toast: ToastService,
  ) {}

  private buildParams(query?: Record<string, any>): HttpParams {
    let params = new HttpParams();
    if (!query) return params;
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    }
    return params;
  }

  get<T = any>(path: string, query?: Record<string, any>): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${path}`, {
      params: this.buildParams(query),
    });
  }

  post<T = any>(path: string, body: any = {}): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${path}`, body);
  }

  put<T = any>(path: string, body: any = {}): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}/${path}`, body);
  }

  patch<T = any>(path: string, body: any = {}): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}/${path}`, body);
  }

  delete<T = any>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}/${path}`);
  }

  downloadFile(path: string, filename: string, query?: Record<string, any>) {
    this.http
      .get(`${this.baseUrl}/${path}`, {
        params: this.buildParams(query),
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.toast.success('Download Ready', `Downloaded ${filename}`);
        },
        error: () => {
          this.toast.error('Download Failed', 'Unable to generate document. Please try again.');
        },
      });
  }
}
