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

  const page = route.routeConfig?.path ?? '';
  if (auth.isImplantation()) {
    return page === 'implantacao' ? true : router.createUrlTree(['/implantacao']);
  }
  if (route.data['adminOnly'] && page === 'usuarios' && !auth.hasModuleAccess('users')) {
    return router.createUrlTree(['/perfil']);
  }
  if (
    (route.data['adminOnly'] || route.data['adminOrGestor']) &&
    page !== 'usuarios' &&
    !auth.canEditPage(page)
  ) {
    return router.createUrlTree(['/perfil']);
  }
  const module = route.data['module'];
  if (typeof module === 'string' && !auth.hasModuleAccess(module)) {
    return router.createUrlTree(['/perfil']);
  }
  return true;
};
