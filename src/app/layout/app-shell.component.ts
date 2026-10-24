import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '@core/services/auth.service';
import { OperationInboxService } from '@core/services/operation-inbox.service';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { NAV_GROUPS, ROUTE_SUBTITLES, visibleNavigation } from './navigation';
import { UserManagementService } from '@features/users/data-access/user-management.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet, IconDirective],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  readonly inbox = inject(OperationInboxService);
  readonly inboxOpen = signal(false);
  readonly auth = inject(AuthService);
  private readonly userManagement = inject(UserManagementService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly collapsed = signal(false);
  readonly mobileOpen = signal(false);
  readonly userMenuOpen = signal(false);
  readonly expandedGroups = signal(new Set(NAV_GROUPS.map((g) => g.id)));
  readonly expandedSubs = signal(new Set(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id))));
  readonly route = signal(this.router.url.slice(1).split('?')[0] || 'dashboard');
  readonly groups = computed(() =>
    this.auth.isImplantation()
      ? [
          {
            id: 'implantation',
            label: 'Administração global',
            color: 'bg-blue-400',
            items: [
              {
                id: 'establishments',
                label: 'Implantação',
                icon: 'Building2',
                leaves: [
                  {
                    id: 'implantacao',
                    label: 'Implantação',
                    icon: 'Building2',
                    route: 'implantacao',
                  },
                ],
              },
            ],
          },
        ]
      : visibleNavigation(
          (module) => this.auth.hasModuleAccess(module),
          (page) => this.auth.canEditPage(page),
        ),
  );
  readonly leaves = computed(() =>
    this.groups().flatMap((group) => group.items.flatMap((item) => item.leaves)),
  );
  readonly activeLabel = computed(() =>
    this.route() === 'dashboard'
      ? 'Dashboard'
      : (this.leaves().find((leaf) => leaf.route === this.route())?.label ??
        (this.route() === 'perfil' ? 'Meu perfil' : 'Dashboard')),
  );
  readonly subtitle = computed(() => ROUTE_SUBTITLES[this.route()] ?? '');
  readonly roleLabel = computed(() => {
    if (this.auth.profile()?.custom_role_name) return this.auth.profile()!.custom_role_name!;
    const role = this.auth.role();
    if (!role) return 'Usuário';
    const labels: Record<NonNullable<typeof role>, string> = {
      admin: 'Administrador',
      implantacao: 'Implantação',
      gestor: 'Gestor',
      analista: 'Analista',
      operador: 'Operador',
      auditor: 'Auditor',
      visualizador: 'Assistente',
    };
    return labels[role];
  });
  readonly initial = computed(() =>
    (this.auth.profile()?.short_name ?? this.auth.profile()?.name ?? '?').charAt(0).toUpperCase(),
  );
  readonly avatarUrl = computed(() =>
    this.userManagement.avatarUrl(this.auth.profile()?.avatar_path),
  );
  readonly roleColor = computed(() =>
    this.auth.isAdmin()
      ? 'bg-blue-50 text-blue-600'
      : this.auth.isGestor()
        ? 'bg-emerald-50 text-emerald-600'
        : this.auth.isAuditor()
          ? 'bg-violet-50 text-violet-600'
          : this.auth.isVisualizador()
            ? 'bg-slate-100 text-slate-600'
            : 'bg-amber-50 text-amber-600',
  );

  constructor() {
    // The first route can activate while the login screen is visible, before
    // the profile is available to the route guard. Re-enter the global area
    // when the shell mounts with the completed authentication state.
    if (this.auth.isImplantation() && this.router.url !== '/implantacao') {
      void this.router.navigateByUrl('/implantacao');
    }
    void this.inbox.load();
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.route.set(event.urlAfterRedirects.slice(1).split('?')[0] || 'dashboard');
        void this.inbox.load();
      });
  }

  toggleGroup(id: string): void {
    this.expandedGroups.update((current) => this.toggleSet(current, id));
  }

  toggleSub(id: string): void {
    this.expandedSubs.update((current) => this.toggleSet(current, id));
  }

  logout(): Promise<void> {
    this.userMenuOpen.set(false);
    return this.auth.signOut();
  }

  private toggleSet(current: Set<string>, id: string): Set<string> {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }
}
