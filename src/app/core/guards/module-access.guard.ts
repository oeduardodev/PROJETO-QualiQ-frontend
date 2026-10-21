import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, filter } from 'rxjs';
import { AuthService } from '@core/services/auth.service';

export const moduleAccessGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.loading()) {
    await firstValueFrom(toObservable(auth.loading).pipe(filter((value) => !value)));
  }

  // The root component handles unauthenticated sessions.
  if (!auth.profile()) return true;

  if (route.data['adminOnly'] && !auth.isAdmin()) return router.createUrlTree(['/perfil']);
  if (route.data['adminOrGestor'] && !auth.isAdmin() && !auth.isGestor()) {
    return router.createUrlTree(['/perfil']);
  }
  const module = route.data['module'];
  if (typeof module === 'string' && !auth.hasModuleAccess(module)) {
    return router.createUrlTree(['/perfil']);
  }
  return true;
};
