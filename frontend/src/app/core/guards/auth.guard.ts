import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/api.models';
import { ToastService } from '../services/toast.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const toast = inject(ToastService);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }

    const userRole = auth.userRole();
    if (!userRole) {
      return router.createUrlTree(['/login']);
    }

    if (userRole === 'SUPER_ADMIN' && allowedRoles.includes('ADMIN')) {
      return true;
    }

    if (allowedRoles.includes(userRole)) {
      return true;
    }

    toast.warning('Access Restricted', 'Redirected to your authorized portal.');
    return router.createUrlTree([auth.getDefaultDashboardRoute(userRole)]);
  };
};
