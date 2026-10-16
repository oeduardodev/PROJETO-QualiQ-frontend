import { computed, inject, Injectable, signal } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '@core/models/database';
import { SupabaseService } from '@core/supabase/supabase.service';
import { ProfileRepository } from '@core/data-access/profile.repository';

type PermissionAction = 'read' | 'create' | 'update' | 'delete';
type AppRole = 'admin' | 'gestor' | 'operador';

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
    return role === 'admin' || role === 'gestor' || role === 'operador' ? role : null;
  });
  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly isGestor = computed(() => this.role() === 'gestor');
  readonly isOperador = computed(() => this.role() === 'operador');
  private initialized = false;
  private sessionRequestId = 0;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    this.supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void this.applySession(session), 0);
    });
    try {
      const { data, error } = await this.supabase.auth.getSession();
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

  can(action: PermissionAction, resource: string): boolean {
    const role = this.role();
    if (!role) return false;
    if (role === 'admin') return true;
    return PERMISSIONS[role][resource]?.includes(action) ?? false;
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
      const profile = await this.profiles.findById(session.user.id);
      if (requestId === this.sessionRequestId) this.profile.set(profile);
    } catch {
      if (requestId === this.sessionRequestId) this.profile.set(null);
    } finally {
      if (requestId === this.sessionRequestId) this.loading.set(false);
    }
  }
}
