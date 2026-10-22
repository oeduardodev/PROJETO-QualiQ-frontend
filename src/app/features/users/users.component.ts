import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import type { Process, Profile, UserRole, ValueChainCategory } from '@core/models/database';
import { ProcessService } from '@features/processes/data-access/process.service';
import { SideDrawerComponent } from '@shared/components/side-drawer/side-drawer.component';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { ToastService } from '@shared/services/toast.service';
import { errorMessage } from '@shared/utils/error.utils';
import { UserManagementService } from './data-access/user-management.service';

const ALL_MODULES = [
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
];

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [ReactiveFormsModule, SideDrawerComponent, IconDirective],
  templateUrl: './users.component.html',
})
export class UsersComponent {
  private readonly processService = inject(ProcessService);
  private readonly userManagement = inject(UserManagementService);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly profileOnly = inject(ActivatedRoute).snapshot.routeConfig?.path === 'perfil';

  readonly users = signal<Profile[]>([]);
  readonly processes = signal<Process[]>([]);
  readonly categories = signal<ValueChainCategory[]>([]);
  readonly loading = signal(true);
  readonly pageError = signal<string | null>(null);
  readonly activeTab = signal<'users' | 'profile' | 'settings'>(
    this.profileOnly ? 'profile' : 'users',
  );
  readonly search = signal('');
  readonly statusFilter = signal<'all' | 'active' | 'inactive'>('active');
  readonly formOpen = signal(false);
  readonly editing = signal<Profile | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly autoModules = signal(true);

  readonly roles: { value: UserRole; label: string; description: string }[] = [
    {
      value: 'admin',
      label: 'Administrador',
      description: 'Acesso total ao sistema e aos usuários.',
    },
    {
      value: 'gestor',
      label: 'Gestor',
      description: 'Aprova planos de ação e gerencia indicadores e SLAs da área.',
    },
    {
      value: 'analista',
      label: 'Analista',
      description: 'Alimenta dados, registra incidentes e executa tarefas.',
    },
    {
      value: 'auditor',
      label: 'Auditor',
      description: 'Consulta global de evidências e compliance, sem edição.',
    },
    {
      value: 'visualizador',
      label: 'Assistente',
      description: 'Consulta painéis e dashboards.',
    },
  ];

  readonly moduleOptions = [
    { key: 'dashboard', label: 'Dashboard', description: 'Visão geral e indicadores de resumo.' },
    {
      key: 'strategy',
      label: 'Estratégia',
      description: 'Matriz de valor e dimensões estratégicas.',
    },
    {
      key: 'indicators',
      label: 'Indicadores',
      description: 'Painel, alimentação e análise crítica.',
    },
    { key: 'processes', label: 'Processos', description: 'SIPOC, mapeamento e gerenciamento.' },
    { key: 'slas', label: 'SLAs', description: 'Painel e gerenciamento dos acordos.' },
    { key: 'risks', label: 'Riscos', description: 'Painel e gerenciamento de riscos.' },
    { key: 'documents', label: 'Documentos', description: 'Consulta e gestão documental.' },
    {
      key: 'incidents',
      label: 'Incidentes',
      description: 'Registro e acompanhamento de incidentes.',
    },
    {
      key: 'helpdesk',
      label: 'Helpdesk',
      description: 'Chamados de TI, manutenção e almoxarifado.',
    },
    {
      key: 'action_plans',
      label: 'Planos de ação',
      description: 'Execução e acompanhamento de ações.',
    },
  ];

  readonly filteredUsers = computed(() => {
    const term = this.search().trim().toLocaleLowerCase('pt-BR');
    const status = this.statusFilter();
    return this.users().filter((user) => {
      const matchesStatus = status === 'all' || user.is_active === (status === 'active');
      const matchesText =
        !term ||
        [user.name, user.short_name, user.email, user.registration_code].some((value) =>
          value?.toLocaleLowerCase('pt-BR').includes(term),
        );
      return matchesStatus && matchesText;
    });
  });

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    short_name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    registration_code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    birth_date: new FormControl('', { nonNullable: true }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(254)],
    }),
    role: new FormControl<UserRole>('analista', {
      nonNullable: true,
      validators: Validators.required,
    }),
    category_id: new FormControl('', { nonNullable: true }),
    process_ids: new FormControl<string[]>([], { nonNullable: true }),
    module_access: new FormControl<string[]>(['dashboard'], { nonNullable: true }),
    is_active: new FormControl(true, { nonNullable: true }),
    receive_email_alerts: new FormControl(true, { nonNullable: true }),
    is_department_head: new FormControl(false, { nonNullable: true }),
  });

  readonly selfForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    short_name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    birth_date: new FormControl('', { nonNullable: true }),
    receive_email_alerts: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    if (!this.profileOnly && this.auth.isAdmin()) void this.loadUsers();
    if (this.profileOnly) this.loading.set(false);
    this.resetSelfForm();
  }

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    this.pageError.set(null);
    try {
      const [users, processes, categories] = await Promise.all([
        this.userManagement.listUsers(),
        this.processService.fetchProcesses(),
        this.processService.fetchCategories(),
      ]);
      this.users.set(users);
      this.processes.set(processes.filter((process) => !process.obsolete));
      this.categories.set(categories);
    } catch (error) {
      this.pageError.set(errorMessage(error, 'Não foi possível carregar usuários e processos.'));
    } finally {
      this.loading.set(false);
    }
  }

  setTab(tab: 'users' | 'profile' | 'settings'): void {
    this.activeTab.set(tab);
    if (tab === 'profile') this.resetSelfForm();
  }

  openCreateUser(): void {
    this.editing.set(null);
    this.autoModules.set(true);
    this.form.reset({
      name: '',
      short_name: '',
      registration_code: '',
      birth_date: '',
      email: '',
      role: 'analista',
      category_id: '',
      process_ids: [],
      module_access: this.defaultModules('analista'),
      is_active: true,
      receive_email_alerts: true,
      is_department_head: false,
    });
    this.updateRoleValidators();
    this.formError.set(null);
    this.formOpen.set(true);
  }

  openEditUser(user: Profile): void {
    this.editing.set(user);
    this.autoModules.set(false);
    this.form.reset({
      name: user.name,
      short_name: user.short_name ?? '',
      registration_code: user.registration_code ?? '',
      birth_date: user.birth_date ?? '',
      email: user.email ?? '',
      role: user.role,
      category_id: user.category_id ?? '',
      process_ids: user.process_ids ?? [],
      module_access: user.module_access ?? this.defaultModules(user.role),
      is_active: user.is_active ?? true,
      receive_email_alerts: user.receive_email_alerts ?? true,
      is_department_head: user.is_department_head ?? false,
    });
    this.updateRoleValidators();
    this.formError.set(null);
    this.formOpen.set(true);
  }

  roleChanged(): void {
    this.updateRoleValidators();
    if (this.autoModules()) {
      this.form.controls.module_access.setValue(this.defaultModules(this.form.controls.role.value));
    }
  }

  private updateRoleValidators(): void {
    const category = this.form.controls.category_id;
    if (this.form.controls.role.value === 'gestor') category.setValidators(Validators.required);
    else category.clearValidators();
    category.updateValueAndValidity({ emitEvent: false });
  }

  toggleModule(key: string): void {
    if (
      this.form.controls.role.value === 'admin' ||
      this.form.controls.role.value === 'visualizador'
    )
      return;
    this.autoModules.set(false);
    const control = this.form.controls.module_access;
    const selected = new Set(control.value);
    if (key === 'dashboard') return;
    if (selected.has(key)) selected.delete(key);
    else selected.add(key);
    selected.add('dashboard');
    control.setValue([...selected]);
  }

  toggleProcess(id: string): void {
    const control = this.form.controls.process_ids;
    const selected = new Set(control.value);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    control.setValue([...selected]);
  }

  async saveUser(): Promise<void> {
    if (!this.auth.isAdmin() || this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Preencha os campos obrigatórios com valores válidos.');
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    const value = this.form.getRawValue();
    const current = this.editing();
    try {
      await this.userManagement.save({
        action: current ? 'update' : 'create',
        ...(current ? { id: current.id } : {}),
        ...value,
        category_id: value.role === 'gestor' ? value.category_id : null,
        birth_date: value.birth_date || null,
      });
      await this.loadUsers();
      this.formOpen.set(false);
      this.toast.success(current ? 'Usuário atualizado' : 'Convite enviado por e-mail');
    } catch (error) {
      this.formError.set(errorMessage(error, 'Não foi possível salvar o usuário.'));
    } finally {
      this.saving.set(false);
    }
  }

  async saveOwnProfile(): Promise<void> {
    if (this.saving() || this.selfForm.invalid) {
      this.selfForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const value = this.selfForm.getRawValue();
      await this.userManagement.save({
        action: 'update_self',
        ...value,
        birth_date: value.birth_date || null,
      });
      await this.auth.refreshProfile();
      this.resetSelfForm();
      this.toast.success('Perfil atualizado');
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível atualizar o perfil.'));
    } finally {
      this.saving.set(false);
    }
  }

  roleLabel(role: string): string {
    return this.roles.find((option) => option.value === role)?.label ?? role;
  }

  processName(id: string): string {
    const process = this.processes().find((item) => item.id === id);
    return process ? `${process.code} · ${process.title}` : id;
  }

  private defaultModules(role: UserRole): string[] {
    return role === 'visualizador' ? ['dashboard'] : [...ALL_MODULES];
  }

  private resetSelfForm(): void {
    const profile = this.auth.profile();
    this.selfForm.reset({
      name: profile?.name ?? '',
      short_name: profile?.short_name ?? '',
      birth_date: profile?.birth_date ?? '',
      receive_email_alerts: profile?.receive_email_alerts ?? true,
    });
  }
}
