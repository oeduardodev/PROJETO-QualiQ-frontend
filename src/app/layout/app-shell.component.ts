import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '@core/services/auth.service';
import { OperationInboxService } from '@core/services/operation-inbox.service';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { NAV_GROUPS, ROUTE_SUBTITLES, visibleNavigation } from './navigation';

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
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly collapsed = signal(false);
  readonly mobileOpen = signal(false);
  readonly userMenuOpen = signal(false);
  readonly expandedGroups = signal(new Set(NAV_GROUPS.map((g) => g.id)));
  readonly expandedSubs = signal(new Set(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id))));
  readonly route = signal(this.router.url.slice(1).split('?')[0] || 'dashboard');
  readonly groups = computed(() => visibleNavigation(this.auth.isOperador(), this.auth.isAdmin()));
  readonly leaves = computed(() =>
    this.groups().flatMap((group) => group.items.flatMap((item) => item.leaves)),
  );
  readonly activeLabel = computed(() =>
    this.route() === 'dashboard'
      ? 'Dashboard'
      : (this.leaves().find((leaf) => leaf.route === this.route())?.label ?? 'Dashboard'),
  );
  readonly subtitle = computed(() => ROUTE_SUBTITLES[this.route()] ?? '');
  readonly initial = computed(() => (this.auth.profile()?.name ?? '?').charAt(0).toUpperCase());
  readonly roleColor = computed(() =>
    this.auth.isAdmin()
      ? 'bg-blue-50 text-blue-600'
      : this.auth.isGestor()
        ? 'bg-emerald-50 text-emerald-600'
        : 'bg-amber-50 text-amber-600',
  );

  constructor() {
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
