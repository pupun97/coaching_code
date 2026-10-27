import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const toast = inject(ToastService);

  const token = authService.getAccessToken();
  const cloned = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : req;

  return next(cloned).pipe(
    catchError((err: HttpErrorResponse) => {
      if (
        err.status === 401 &&
        !req.url.includes('/auth/login') &&
        !req.url.includes('/auth/refresh') &&
        authService.getRefreshToken()
      ) {
        return authService.refreshSession().pipe(
          switchMap((res) => {
            const retried = req.clone({
              setHeaders: {
                Authorization: `Bearer ${res.accessToken}`,
              },
            });
            return next(retried);
          }),
          catchError((refreshErr) => {
            authService.logout();
            return throwError(() => refreshErr);
          }),
        );
      }

      const serverMsg =
        typeof err.error?.message === 'string'
          ? err.error.message
          : Array.isArray(err.error?.message)
          ? err.error.message.join(', ')
          : err.message || 'Request failed';

      if (err.status !== 401 || req.url.includes('/auth/login')) {
        toast.error('Operation Error', serverMsg);
      }

      return throwError(() => err);
    }),
  );
};
