import { computed, inject, Injectable, signal } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile, UserRole } from '@core/models/database';
import { SupabaseService } from '@core/supabase/supabase.service';
import { ProfileRepository } from '@core/data-access/profile.repository';

type PermissionAction = 'read' | 'create' | 'update' | 'delete';
type AppRole = UserRole;

const PERMISSIONS: Record<Exclude<AppRole, 'admin'>, Record<string, PermissionAction[]>> = {
  gestor: {
    processes: ['read'],
    sipoc_nodes: ['read'],
    tickets: ['read', 'create', 'update', 'delete'],
    indicators: ['read', 'create', 'update', 'delete'],
    action_plans: ['read', 'create', 'update', 'delete'],
    indicator_history: ['read', 'create', 'update', 'delete'],
    value_chain_categories: ['read'],
    documents: ['read', 'create', 'update', 'delete'],
    document_types: ['read'],
    controlled_copies: ['read', 'create', 'update', 'delete'],
    slas: ['read', 'create', 'update'],
  },
  operador: {
    processes: ['read'],
    sipoc_nodes: ['read'],
    tickets: ['read', 'create', 'update', 'delete'],
    documents: ['read'],
    controlled_copies: ['read', 'create'],
    slas: ['read'],
  },
  analista: {
    processes: ['read'],
    sipoc_nodes: ['read'],
    tickets: ['read', 'create', 'update', 'delete'],
    indicators: ['read', 'create'],
    indicator_history: ['read', 'create'],
    action_plans: ['read', 'update'],
    documents: ['read'],
    controlled_copies: ['read'],
    slas: ['read'],
  },
  auditor: {},
  visualizador: {
    processes: ['read'],
    tickets: ['read'],
    indicators: ['read'],
  },
};

const DEFAULT_MODULES: Record<AppRole, string[]> = {
  admin: [
    'dashboard',
    'strategy',
    'indicators',
    'processes',
    'slas',
    'risks',
    'documents',
    'incidents',
    'helpdesk',
    'action_plans',
  ],
  gestor: [
    'dashboard',
    'strategy',
    'indicators',
    'processes',
    'slas',
    'risks',
    'documents',
    'incidents',
    'helpdesk',
    'action_plans',
  ],
  operador: [
    'dashboard',
    'strategy',
    'indicators',
    'processes',
    'slas',
    'risks',
    'documents',
    'incidents',
    'helpdesk',
    'action_plans',
  ],
  analista: [
    'dashboard',
    'strategy',
    'indicators',
    'processes',
    'slas',
    'risks',
    'documents',
    'incidents',
    'helpdesk',
    'action_plans',
  ],
  auditor: [
    'dashboard',
    'strategy',
    'indicators',
    'processes',
    'slas',
    'risks',
    'documents',
    'incidents',
    'helpdesk',
    'action_plans',
  ],
  visualizador: ['dashboard'],
};

const RESOURCE_MODULE: Record<string, string> = {
  value_chain_categories: 'strategy',
  dimensions: 'strategy',
  dimension_links: 'strategy',
  processes: 'processes',
  sipoc_nodes: 'processes',
  indicators: 'indicators',
  indicator_history: 'indicators',
  tickets: 'incidents',
  action_plans: 'action_plans',
  documents: 'documents',
  document_types: 'documents',
  controlled_copies: 'documents',
  slas: 'slas',
  risks: 'risks',
  helpdesk_tickets: 'helpdesk',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly profiles = inject(ProfileRepository);
  private readonly supabase = inject(SupabaseService).client;
  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly loading = signal(true);
  readonly role = computed<AppRole | null>(() => {
    const role = this.profile()?.role?.toLowerCase();
    return role && role in DEFAULT_MODULES ? (role as AppRole) : null;
  });
  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly isGestor = computed(() => this.role() === 'gestor');
  readonly isOperador = computed(() => this.role() === 'operador' || this.role() === 'analista');
  readonly isAnalista = computed(() => this.role() === 'analista');
  readonly isAuditor = computed(() => this.role() === 'auditor');
  readonly isVisualizador = computed(() => this.role() === 'visualizador');
  private initialized = false;
  private sessionRequestId = 0;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    this.supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void this.applySession(session), 0);
    });
    try {
      const { data, error } = await this.withTimeout(this.supabase.auth.getSession(), 10000);
      if (error) throw error;
      await this.applySession(data.session);
    } catch {
      this.session.set(null);
      this.user.set(null);
      this.profile.set(null);
      this.loading.set(false);
    }
  }

  async signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
    await this.applySession(null);
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await this.supabase.auth.updateUser({ password });
    if (error) throw error;
  }

  can(action: PermissionAction, resource: string): boolean {
    const role = this.role();
    if (!role) return false;
    if (role === 'admin') return true;
    const module = RESOURCE_MODULE[resource];
    if (module && !this.hasModuleAccess(module)) return false;
    if (role === 'auditor') return action === 'read';
    return PERMISSIONS[role][resource]?.includes(action) ?? false;
  }

  hasModuleAccess(module: string): boolean {
    const role = this.role();
    if (!role) return false;
    if (module === 'profile' || role === 'admin') return true;
    if (role === 'visualizador') return module === 'dashboard';
    const explicitModules = this.profile()?.module_access;
    return explicitModules?.length
      ? explicitModules.includes(module)
      : DEFAULT_MODULES[role].includes(module);
  }

  async refreshProfile(): Promise<void> {
    const user = this.user();
    if (!user) return;
    this.profile.set(await this.profiles.findById(user.id));
  }

  private async applySession(session: Session | null): Promise<void> {
    const requestId = ++this.sessionRequestId;
    this.loading.set(true);
    this.session.set(session);
    this.user.set(session?.user ?? null);
    if (!session) {
      this.profile.set(null);
      this.loading.set(false);
      return;
    }
    try {
      // A stalled network request must not leave the entire app on its splash screen.
      const profile = await this.withTimeout(this.profiles.findById(session.user.id), 10000);
      if (requestId !== this.sessionRequestId) return;
      if (profile?.is_active === false) {
        this.profile.set(null);
        this.session.set(null);
        this.user.set(null);
        this.loading.set(false);
        void this.supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      } else {
        this.profile.set(profile);
      }
    } catch {
      if (requestId === this.sessionRequestId) this.profile.set(null);
    } finally {
      if (requestId === this.sessionRequestId) this.loading.set(false);
    }
  }

  private async withTimeout<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Tempo esgotado ao carregar a sessão.')), milliseconds);
    });
    try {
      return await Promise.race([operation, timeout]);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
