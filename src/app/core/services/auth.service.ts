import { computed, inject, Injectable, signal } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile, UserRole } from '@core/models/database';
import { SupabaseService } from '@core/supabase/supabase.service';
import { ProfileRepository } from '@core/data-access/profile.repository';
import { pageModule } from '@core/models/access';

type PermissionAction = 'read' | 'create' | 'update' | 'delete';
type AppRole = UserRole;

const DEFAULT_MODULES: Record<AppRole, string[]> = {
  implantacao: ['implantation'],
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
    'users',
    'education',
    'surveys',
    'form_builder',
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
    'education',
    'surveys',
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
    'education',
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
    'education',
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
    'education',
  ],
  visualizador: ['dashboard', 'education'],
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
  surveys: 'surveys',
  built_forms: 'form_builder',
  built_form_responses: 'form_builder',
  survey_responses: 'surveys',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly profiles = inject(ProfileRepository);
  private readonly supabase = inject(SupabaseService).client;
  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly establishmentStatus = signal<string | null>(null);
  readonly enabledAdditionalModules = signal<string[]>([]);
  readonly loading = signal(true);
  readonly role = computed<AppRole | null>(() => {
    const role = this.profile()?.role?.toLowerCase();
    return role && role in DEFAULT_MODULES ? (role as AppRole) : null;
  });
  readonly isAdmin = computed(() => this.role() === 'admin' && !this.profile()?.custom_role_id);
  readonly isImplantation = computed(() => this.role() === 'implantacao');
  readonly isGestor = computed(() => this.role() === 'gestor' && !this.profile()?.custom_role_id);
  readonly isOperador = computed(
    () =>
      !this.profile()?.custom_role_id && (this.role() === 'operador' || this.role() === 'analista'),
  );
  readonly isAnalista = computed(
    () => this.role() === 'analista' && !this.profile()?.custom_role_id,
  );
  readonly isAuditor = computed(() => this.role() === 'auditor' && !this.profile()?.custom_role_id);
  readonly isVisualizador = computed(
    () => this.role() === 'visualizador' && !this.profile()?.custom_role_id,
  );
  private initialized = false;
  private sessionRequestId = 0;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    this.supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        // Refreshing an access token does not change the signed-in user. Keep
        // the current route and feature component mounted while the tab wakes up.
        if (event === 'TOKEN_REFRESHED' && session && session.user.id === this.user()?.id) {
          this.session.set(session);
          this.user.set(session.user);
          void this.loadEstablishment(this.profile(), this.sessionRequestId).catch(() => undefined);
          return;
        }
        void this.applySession(session);
      }, 0);
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

  async verifyPasswordSetupLink(tokenHash: string, type: 'invite' | 'recovery'): Promise<void> {
    const { error } = await this.supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) throw error;
  }

  async sendPasswordSetupLink(email: string): Promise<void> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/definir-senha`,
    });
    if (error) throw error;
  }

  can(action: PermissionAction, resource: string): boolean {
    const module = RESOURCE_MODULE[resource];
    if (!module || !this.hasModuleAccess(module)) return false;
    if (action === 'read') return true;
    const page: Record<string, string> = {
      indicators: 'indicadores/cadastro',
      indicator_history: 'indicadores/alimentacao',
      processes: 'processos/gerenciamento',
      sipoc_nodes: 'processos/sipoc',
      tickets: 'incidentes/painel',
      action_plans: 'planos-acao',
      documents: 'documentos/gerenciamento',
      document_types: 'documentos/hierarquia',
      controlled_copies: 'documentos/copias',
      slas: 'processos/slas/gerenciamento',
      risks: 'riscos/gerenciamento',
      helpdesk_tickets: 'helpdesk',
      built_forms: 'formularios/construcao',
      dimensions: 'dimensoes',
      dimension_links: 'dimensoes',
      value_chain_categories: 'valor',
    };
    return this.canEditPage(page[resource] ?? '');
  }

  canEditPage(page: string): boolean {
    const module = pageModule(page);
    if (!module || !this.hasModuleAccess(module)) return false;
    const editAccess = this.profile()?.edit_access;
    return editAccess ? editAccess.includes(page) : this.isAdmin();
  }

  hasModuleAccess(module: string): boolean {
    const role = this.role();
    if (!role) return false;
    if (role === 'implantacao') return module === 'implantation';
    if (this.establishmentStatus() !== 'active') return false;
    if (module === 'profile') return true;
    if (
      [
        'helpdesk',
        'strategy_tools',
        'surveys',
        'form_builder',
        'education',
        'custom_dashboards',
      ].includes(module) &&
      !this.enabledAdditionalModules().includes(module)
    )
      return false;
    if (module === 'education') return true;
    const explicitModules = this.profile()?.module_access;
    return explicitModules
      ? explicitModules.includes(module)
      : DEFAULT_MODULES[role].includes(module);
  }

  async refreshProfile(): Promise<void> {
    const user = this.user();
    if (!user) return;
    const profile = await this.profiles.findById(user.id);
    this.profile.set(profile);
    await this.loadEstablishment(profile);
  }

  private async loadEstablishment(
    profile: Profile | null,
    requestId = this.sessionRequestId,
  ): Promise<void> {
    if (this.profile()?.id !== profile?.id || this.establishmentStatus() === null) {
      this.establishmentStatus.set(null);
      this.enabledAdditionalModules.set([]);
    }
    if (!profile?.establishment_id || profile.role === 'implantacao') return;
    const [{ data: establishment }, { data: modules }] = await this.withTimeout(
      Promise.all([
        this.supabase
          .from('establishments')
          .select('status')
          .eq('id', profile.establishment_id)
          .maybeSingle(),
        this.supabase
          .from('establishment_modules')
          .select('module_id')
          .eq('establishment_id', profile.establishment_id)
          .eq('enabled', true),
      ]),
      5000,
    );
    if (requestId !== this.sessionRequestId || profile.id !== this.profile()?.id) return;
    this.establishmentStatus.set(establishment?.status ?? null);
    this.enabledAdditionalModules.set(modules?.map((m) => m.module_id) ?? []);
  }

  private async applySession(session: Session | null): Promise<void> {
    const requestId = ++this.sessionRequestId;
    this.loading.set(true);
    this.session.set(session);
    this.user.set(session?.user ?? null);
    if (!session) {
      this.profile.set(null);
      this.establishmentStatus.set(null);
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
        await this.loadEstablishment(profile);
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
      timeoutId = setTimeout(
        () => reject(new Error('Tempo esgotado ao carregar a sessão.')),
        milliseconds,
      );
    });
    try {
      return await Promise.race([operation, timeout]);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
