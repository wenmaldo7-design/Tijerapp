import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const allowedRoles: UserRole[] = route.data['roles'] ?? [];

  if (!auth.isLoggedIn()) return router.createUrlTree(['/auth/login']);
  if (allowedRoles.length === 0 || auth.hasRole(...allowedRoles)) return true;
  return router.createUrlTree(['/dashboard']);
};
