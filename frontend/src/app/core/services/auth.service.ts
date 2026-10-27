import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { AuthResponse, UserProfile, UserRole } from '../models/api.models';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3000/api/auth'
      : 'https://3.110.11.46.sslip.io/api/auth';
  private readonly TOKEN_KEY = 'edunexus_access_token';
  private readonly REFRESH_KEY = 'edunexus_refresh_token';
  private readonly USER_KEY = 'edunexus_user';

  readonly currentUser = signal<UserProfile | null>(this.loadStoredUser());
  readonly isAuthenticated = computed(() => !!this.currentUser() && !!this.getAccessToken());
  readonly userRole = computed<UserRole | null>(() => this.currentUser()?.role || null);

  // Parent Multi-Child Switcher active student ID
  readonly selectedChildId = signal<string | null>(null);

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly toast: ToastService,
  ) {
    const u = this.currentUser();
    if (u?.role === 'PARENT' && u.parentProfile?.children?.length > 0) {
      this.selectedChildId.set(u.parentProfile.children[0].student.id);
    }
  }

  private loadStoredUser(): UserProfile | null {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_KEY);
  }

  private persistSession(res: AuthResponse) {
    localStorage.setItem(this.TOKEN_KEY, res.accessToken);
    localStorage.setItem(this.REFRESH_KEY, res.refreshToken);
    localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
    this.currentUser.set(res.user);
    if (res.user?.role === 'PARENT' && res.user.parentProfile?.children?.length > 0) {
      this.selectedChildId.set(res.user.parentProfile.children[0].student.id);
    }
  }

  login(identifier: string, password: string, rememberMe = false) {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, { identifier, password, rememberMe })
      .pipe(
        tap((res) => {
          this.persistSession(res);
          this.toast.success('Welcome back!', `Signed in as ${res.user.firstName} ${res.user.lastName}`);
        }),
      );
  }

  refreshSession() {
    const refreshToken = this.getRefreshToken();
    return this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, { refreshToken }).pipe(
      tap((res) => {
        this.persistSession(res);
      }),
    );
  }

  logout() {
    const refreshToken = this.getRefreshToken();
    if (this.getAccessToken()) {
      this.http.post(`${this.apiUrl}/logout`, { refreshToken }).subscribe({ error: () => {} });
    }
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.selectedChildId.set(null);
    this.router.navigate(['/login']);
  }

  forgotPassword(email: string) {
    return this.http.post<{ message: string; devResetToken?: string }>(
      `${this.apiUrl}/forgot-password`,
      { email },
    );
  }

  resetPassword(token: string, newPassword: string) {
    return this.http.post<{ message: string }>(`${this.apiUrl}/reset-password`, {
      token,
      newPassword,
    });
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http.post<{ message: string }>(`${this.apiUrl}/change-password`, {
      currentPassword,
      newPassword,
    });
  }

  updateProfile(data: Partial<UserProfile>) {
    return this.http.patch<UserProfile>(`${this.apiUrl}/profile`, data).pipe(
      tap((updated) => {
        const merged = { ...this.currentUser()!, ...updated };
        localStorage.setItem(this.USER_KEY, JSON.stringify(merged));
        this.currentUser.set(merged);
      }),
    );
  }

  getDefaultDashboardRoute(role?: UserRole | null): string {
    const r = role || this.userRole();
    switch (r) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return '/admin/dashboard';
      case 'TEACHER':
        return '/teacher/dashboard';
      case 'STUDENT':
        return '/student/dashboard';
      case 'PARENT':
        return '/parent/dashboard';
      default:
        return '/login';
    }
  }
}
