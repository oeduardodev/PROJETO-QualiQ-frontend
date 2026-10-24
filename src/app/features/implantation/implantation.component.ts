import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  Establishment,
  EstablishmentModule,
  ModuleCatalogEntry,
  QualiqPlan,
} from '@core/models/database';
import { SupabaseService } from '@core/supabase/supabase.service';

interface TenantUser {
  id: string;
  name: string;
  email: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}
type EstablishmentForm = Omit<Establishment, 'created_at' | 'updated_at'>;

@Component({
  selector: 'app-implantation',
  imports: [FormsModule],
  templateUrl: './implantation.component.html',
})
export class ImplantationComponent {
  private readonly client = inject(SupabaseService).client;
  readonly establishments = signal<Establishment[]>([]);
  readonly modules = signal<EstablishmentModule[]>([]);
  readonly catalog = signal<ModuleCatalogEntry[]>([]);
  readonly plans = signal<QualiqPlan[]>([]);
  readonly users = signal<TenantUser[]>([]);
  readonly search = signal('');
  readonly statusFilter = signal('all');
  readonly selectedId = signal<string | null>(null);
  readonly editing = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly adminName = signal('');
  readonly adminEmail = signal('');
  readonly adminCode = signal('');
  readonly form = signal<EstablishmentForm>(this.emptyForm());
  readonly selected = computed(
    () => this.establishments().find((item) => item.id === this.selectedId()) ?? null,
  );
  readonly baseModules = computed(() => this.catalog().filter((item) => item.is_base));
  readonly additionalModules = computed(() => this.catalog().filter((item) => !item.is_base));
  readonly filtered = computed(() =>
    this.establishments().filter((item) => {
      const query = this.search().toLocaleLowerCase('pt-BR').trim();
      return (
        (this.statusFilter() === 'all' || item.status === this.statusFilter()) &&
        (!query ||
          [item.name, item.legal_name, item.registration_number, item.contact_email].some((value) =>
            value?.toLocaleLowerCase('pt-BR').includes(query),
          ))
      );
    }),
  );
  readonly activeCount = computed(
    () => this.establishments().filter((item) => item.status === 'active').length,
  );
  readonly suspendedCount = computed(
    () => this.establishments().filter((item) => item.status === 'suspended').length,
  );
  readonly addOnCount = computed(
    () =>
      new Set(
        this.modules()
          .filter((item) => item.enabled)
          .map((item) => item.establishment_id),
      ).size,
  );

  constructor() {
    void this.load();
  }

  private emptyForm(): EstablishmentForm {
    return {
      id: '',
      name: '',
      legal_name: null,
      registration_number: null,
      contact_email: null,
      status: 'active',
      plan_id: 'start',
      ai_mode: 'disabled',
      ai_monthly_limit: 0,
    };
  }

  private async invoke<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.client.functions.invoke<T>('implantation', { body });
    if (error) {
      let message = error.message;
      if ('context' in error && error.context instanceof Response) {
        const detail = await error.context.json().catch(() => null);
        message = detail?.error ?? message;
      }
      throw new Error(message);
    }
    if (!data) throw new Error('Resposta vazia do servidor.');
    return data;
  }

  async load(): Promise<void> {
    this.error.set('');
    try {
      const data = await this.invoke<{
        establishments: Establishment[];
        modules: EstablishmentModule[];
        catalog: ModuleCatalogEntry[];
        plans: QualiqPlan[];
      }>({ action: 'list' });
      this.establishments.set(data.establishments ?? []);
      this.modules.set(data.modules ?? []);
      this.catalog.set(data.catalog ?? []);
      this.plans.set(data.plans ?? []);
    } catch (error) {
      this.error.set(this.message(error));
    }
  }

  newEstablishment(): void {
    this.selectedId.set(null);
    this.users.set([]);
    this.form.set(this.emptyForm());
    this.editing.set(true);
    this.notice.set('');
  }

  async select(item: Establishment): Promise<void> {
    this.selectedId.set(item.id);
    this.form.set({
      id: item.id,
      name: item.name,
      legal_name: item.legal_name,
      registration_number: item.registration_number,
      contact_email: item.contact_email,
      status: item.status,
      plan_id: item.plan_id,
      ai_mode: item.ai_mode,
      ai_monthly_limit: item.ai_monthly_limit,
    });
    this.editing.set(true);
    this.users.set([]);
    this.error.set('');
    try {
      const { users } = await this.invoke<{ users: TenantUser[] }>({
        action: 'users',
        establishment_id: item.id,
      });
      if (this.selectedId() === item.id) this.users.set(users ?? []);
    } catch (error) {
      this.error.set(this.message(error));
    }
  }

  patchForm(patch: Partial<EstablishmentForm>): void {
    this.form.update((current) => ({ ...current, ...patch }));
  }

  async save(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      const { establishment } = await this.invoke<{ establishment: Establishment }>({
        action: 'save',
        ...this.form(),
        id: this.form().id || undefined,
      });
      await this.load();
      await this.select(establishment);
      this.notice.set('Estabelecimento salvo.');
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  async changeStatus(status: Establishment['status']): Promise<void> {
    this.patchForm({ status });
    await this.save();
  }

  moduleEnabled(moduleId: string): boolean {
    return this.modules().some(
      (item) =>
        item.establishment_id === this.selectedId() && item.module_id === moduleId && item.enabled,
    );
  }

  async toggleModule(moduleId: string): Promise<void> {
    if (!this.selectedId() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await this.invoke({
        action: 'module',
        establishment_id: this.selectedId(),
        module_id: moduleId,
        enabled: !this.moduleEnabled(moduleId),
      });
      await this.load();
      this.notice.set('Disponibilidade atualizada.');
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  async createAdmin(): Promise<void> {
    if (!this.selectedId() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await this.invoke({
        action: 'create_admin',
        establishment_id: this.selectedId(),
        name: this.adminName(),
        email: this.adminEmail(),
        registration_code: this.adminCode(),
      });
      const current = this.selected();
      if (current) await this.select(current);
      this.adminName.set('');
      this.adminEmail.set('');
      this.adminCode.set('');
      this.notice.set('Administrador convidado. O acesso será concluído pelo e-mail enviado.');
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  planName(id: string): string {
    return this.plans().find((item) => item.id === id)?.name ?? id;
  }

  planCount(id: string): number {
    return this.establishments().filter((item) => item.plan_id === id).length;
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : 'Erro inesperado.';
  }
}
