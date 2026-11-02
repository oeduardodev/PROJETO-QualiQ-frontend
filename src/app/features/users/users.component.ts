import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import type {
  CustomRole,
  Process,
  Profile,
  UserRole,
  ValueChainCategory,
} from '@core/models/database';
import { ACCESS_PAGES } from '@core/models/access';
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
  'surveys',
  'education',
  'users',
];

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [ReactiveFormsModule, SideDrawerComponent, IconDirective],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
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
  readonly customRoles = signal<CustomRole[]>([]);
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
  readonly roleOpen = signal(false);
  readonly roleEditing = signal<CustomRole | null>(null);
  readonly roleError = signal<string | null>(null);
  readonly avatarFile = signal<File | null>(null);
  readonly avatarPreview = signal<string | null>(null);
  readonly expandedUserModules = signal<string[]>([]);
  readonly expandedRoleModules = signal<string[]>([]);
  readonly pages = ACCESS_PAGES;

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
    { value: 'operador', label: 'Operador', description: 'Registra e acompanha operações.' },
    {
      value: 'auditor',
      label: 'Auditor',
      description: 'Consulta de evidências e conformidade; edição conforme autorização.',
    },
    {
      value: 'visualizador',
      label: 'Assistente',
      description: 'Consulta painéis; módulos e edição conforme autorização.',
    },
  ];

  readonly moduleOptions = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      description: 'Visualização geral e acesso rápido às principais informações.',
      icon: 'LayoutDashboard',
      tone: 'blue',
    },
    {
      key: 'strategy',
      label: 'Estratégia',
      description: 'Planejamento estratégico e objetivos organizacionais.',
      icon: 'Target',
      tone: 'violet',
    },
    {
      key: 'indicators',
      label: 'Indicadores',
      description: 'Monitoramento e análise de indicadores.',
      icon: 'ChartLine',
      tone: 'emerald',
    },
    {
      key: 'processes',
      label: 'Processos',
      description: 'Gerenciamento de processos e mapeamentos.',
      icon: 'Cog',
      tone: 'slate',
    },
    {
      key: 'slas',
      label: 'SLAs',
      description: 'Definição e acompanhamento de acordos de nível de serviço.',
      icon: 'Clock3',
      tone: 'amber',
    },
    {
      key: 'risks',
      label: 'Riscos',
      description: 'Gestão de riscos e planos de mitigação.',
      icon: 'Shield',
      tone: 'rose',
    },
    {
      key: 'documents',
      label: 'Documentos',
      description: 'Consulta e gestão documental.',
      icon: 'FileText',
      tone: 'cyan',
    },
    {
      key: 'incidents',
      label: 'Incidentes',
      description: 'Registro e acompanhamento de incidentes.',
      icon: 'CircleAlert',
      tone: 'orange',
    },
    {
      key: 'helpdesk',
      label: 'Helpdesk',
      description: 'Chamados de TI, manutenção e almoxarifado.',
      icon: 'Headphones',
      tone: 'indigo',
    },
    {
      key: 'action_plans',
      label: 'Planos de ação',
      description: 'Execução e acompanhamento de ações.',
      icon: 'ClipboardList',
      tone: 'teal',
    },
    {
      key: 'surveys',
      label: 'Pesquisa de Satisfação',
      description: 'Criação de questionários, resultados e análise crítica.',
      icon: 'MessageSquare',
      tone: 'blue',
    },
    {
      key: 'education',
      label: 'Educação Continuada',
      description: 'Acesso automático para todos os perfis quando habilitado no estabelecimento.',
      icon: 'BookOpen',
      tone: 'blue',
    },
    {
      key: 'users',
      label: 'Usuários',
      description: 'Cadastro de pessoas, cargos e acessos.',
      icon: 'Users',
      tone: 'purple',
    },
  ];

  readonly pageDetails: Record<string, { icon: string; description: string }> = {
    dashboard: { icon: 'ChartLine', description: 'Permite personalizar widgets e layouts.' },
    valor: { icon: 'Grid3X3', description: 'Permite criar e modificar a matriz de valor.' },
    dimensoes: { icon: 'ChartLine', description: 'Permite gerenciar dimensões estratégicas.' },
    'indicadores/painel': { icon: 'Gauge', description: 'Permite editar o painel de indicadores.' },
    'indicadores/alimentacao': {
      icon: 'Activity',
      description: 'Permite inserir dados e registrar análises.',
    },
    'indicadores/cadastro': {
      icon: 'FileText',
      description: 'Permite criar e editar fichas de indicadores.',
    },
    'processos/gerenciamento': { icon: 'Cog', description: 'Permite gerenciar processos.' },
    'processos/sipoc': { icon: 'Workflow', description: 'Permite editar SIPOCs e mapeamentos.' },
    'processos/slas/painel': { icon: 'Gauge', description: 'Permite editar o painel de SLAs.' },
    'processos/slas/gerenciamento': {
      icon: 'Clock3',
      description: 'Permite gerenciar acordos de nível de serviço.',
    },
    'riscos/painel': { icon: 'Gauge', description: 'Permite editar o painel de riscos.' },
    'riscos/gerenciamento': {
      icon: 'Shield',
      description: 'Permite gerenciar riscos e tratamentos.',
    },
    'documentos/painel': {
      icon: 'FileText',
      description: 'Permite editar o painel de documentos.',
    },
    'documentos/hierarquia': {
      icon: 'Layers',
      description: 'Permite organizar a hierarquia documental.',
    },
    'documentos/gerenciamento': { icon: 'Cog', description: 'Permite criar e alterar documentos.' },
    'documentos/copias': { icon: 'Printer', description: 'Permite gerenciar cópias controladas.' },
    'incidentes/realizacao': { icon: 'CircleAlert', description: 'Permite registrar incidentes.' },
    'incidentes/painel': { icon: 'Gauge', description: 'Permite editar o painel de incidentes.' },
    'incidentes/parametrizacao': {
      icon: 'Settings',
      description: 'Permite configurar tipos de incidentes.',
    },
    helpdesk: { icon: 'Headphones', description: 'Permite abrir e gerenciar chamados.' },
    'planos-acao': { icon: 'ClipboardList', description: 'Permite criar e editar planos de ação.' },
    'pesquisas/painel': {
      icon: 'ChartLine',
      description: 'Permite analisar respostas e registrar ações.',
    },
    'pesquisas/parametrizacao': {
      icon: 'SlidersHorizontal',
      description: 'Permite criar questionários, critérios e links.',
    },
    'educacao/painel': { icon: 'ChartLine', description: 'Permite consultar os indicadores.' },
    'educacao/treinamentos': { icon: 'BookOpen', description: 'Permite realizar treinamentos.' },
    'educacao/gerenciamento': {
      icon: 'BookOpen',
      description: 'Permite montar treinamentos e trilhas.',
    },
    usuarios: { icon: 'Users', description: 'Permite gerenciar usuários, cargos e acessos.' },
  };

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
    role: new FormControl('analista', {
      nonNullable: true,
      validators: Validators.required,
    }),
    new_role_name: new FormControl('', { nonNullable: true }),
    category_id: new FormControl('', { nonNullable: true }),
    process_ids: new FormControl<string[]>([], { nonNullable: true }),
    module_access: new FormControl<string[]>(['dashboard'], { nonNullable: true }),
    edit_access: new FormControl<string[]>([], { nonNullable: true }),
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

  readonly roleForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(80)],
    }),
    description: new FormControl('', { nonNullable: true, validators: Validators.maxLength(500) }),
    module_access: new FormControl<string[]>([], { nonNullable: true }),
    edit_access: new FormControl<string[]>([], { nonNullable: true }),
  });

  constructor() {
    if (!this.profileOnly && this.auth.hasModuleAccess('users')) void this.loadUsers();
    if (this.profileOnly) this.loading.set(false);
    this.resetSelfForm();
  }

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    this.pageError.set(null);
    try {
      const [users, processes, categories, customRoles] = await Promise.all([
        this.userManagement.listUsers(),
        this.processService.fetchProcesses(),
        this.processService.fetchCategories(),
        this.userManagement.listRoles(),
      ]);
      this.users.set(users);
      this.processes.set(processes.filter((process) => !process.obsolete));
      this.categories.set(categories);
      this.customRoles.set(customRoles);
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
    this.form.reset({
      name: '',
      short_name: '',
      registration_code: '',
      birth_date: '',
      email: '',
      role: 'analista',
      new_role_name: '',
      category_id: '',
      process_ids: [],
      module_access: this.defaultModules('analista'),
      edit_access: this.defaultEdits('analista'),
      is_active: true,
      receive_email_alerts: true,
      is_department_head: false,
    });
    this.updateRoleValidators();
    this.expandedUserModules.set([...this.form.controls.module_access.value]);
    this.formError.set(null);
    this.formOpen.set(true);
  }

  openEditUser(user: Profile): void {
    this.editing.set(user);
    this.form.reset({
      name: user.name,
      short_name: user.short_name ?? '',
      registration_code: user.registration_code ?? '',
      birth_date: user.birth_date ?? '',
      email: user.email ?? '',
      role: user.custom_role_id ? `custom:${user.custom_role_id}` : user.role,
      new_role_name: '',
      category_id: user.category_id ?? '',
      process_ids: user.process_ids ?? [],
      module_access: [
        ...new Set([...(user.module_access ?? this.defaultModules(user.role)), 'education']),
      ],
      edit_access: user.edit_access ?? this.defaultEdits(user.role),
      is_active: user.is_active ?? true,
      receive_email_alerts: user.receive_email_alerts ?? true,
      is_department_head: user.is_department_head ?? false,
    });
    this.updateRoleValidators();
    this.expandedUserModules.set([...this.form.controls.module_access.value]);
    this.formError.set(null);
    this.formOpen.set(true);
  }

  roleChanged(): void {
    this.updateRoleValidators();
    const selected = this.form.controls.role.value;
    const custom = selected.startsWith('custom:')
      ? this.customRoles().find((role) => role.id === selected.slice(7))
      : null;
    if (selected === 'other') {
      this.form.controls.module_access.setValue(['education']);
      this.form.controls.edit_access.setValue([]);
    } else if (custom) {
      this.form.controls.module_access.setValue([
        ...new Set([...custom.module_access, 'education']),
      ]);
      this.form.controls.edit_access.setValue([...custom.edit_access]);
    } else {
      this.form.controls.module_access.setValue(this.defaultModules(selected as UserRole));
      this.form.controls.edit_access.setValue(this.defaultEdits(selected as UserRole));
    }
    this.expandedUserModules.set([...this.form.controls.module_access.value]);
  }

  private updateRoleValidators(): void {
    const category = this.form.controls.category_id;
    if (this.form.controls.role.value === 'gestor') category.setValidators(Validators.required);
    else category.clearValidators();
    category.updateValueAndValidity({ emitEvent: false });

    const newRoleName = this.form.controls.new_role_name;
    if (this.form.controls.role.value === 'other') {
      newRoleName.setValidators([
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(80),
      ]);
    } else {
      newRoleName.clearValidators();
    }
    newRoleName.updateValueAndValidity({ emitEvent: false });
  }

  toggleModule(key: string): void {
    if (key === 'education') return;
    const control = this.form.controls.module_access;
    const selected = new Set(control.value);
    if (selected.has(key)) selected.delete(key);
    else selected.add(key);
    control.setValue([...selected]);
    this.expandedUserModules.update((expanded) =>
      selected.has(key)
        ? [...new Set([...expanded, key])]
        : expanded.filter((item) => item !== key),
    );
    this.form.controls.edit_access.setValue(
      this.form.controls.edit_access.value.filter((page) =>
        selected.has(this.pages.find((entry) => entry.key === page)?.module ?? ''),
      ),
    );
  }

  toggleEdit(page: string): void {
    const control = this.form.controls.edit_access;
    const selected = new Set(control.value);
    if (selected.has(page)) selected.delete(page);
    else selected.add(page);
    control.setValue([...selected]);
  }

  toggleModuleEdit(module: string): void {
    const keys = this.pages.filter((page) => page.module === module).map((page) => page.key);
    const selected = new Set(this.form.controls.edit_access.value);
    if (keys.every((key) => selected.has(key))) keys.forEach((key) => selected.delete(key));
    else keys.forEach((key) => selected.add(key));
    this.form.controls.edit_access.setValue([...selected]);
  }

  pagesForModule(module: string) {
    return this.pages.filter((page) => page.module === module);
  }

  toggleUserModuleExpanded(key: string): void {
    this.expandedUserModules.update((expanded) =>
      expanded.includes(key) ? expanded.filter((item) => item !== key) : [...expanded, key],
    );
  }

  moduleFullyEditable(module: string): boolean {
    const pages = this.pagesForModule(module);
    return (
      pages.length > 0 &&
      pages.every((page) => this.form.controls.edit_access.value.includes(page.key))
    );
  }

  toggleProcess(id: string): void {
    const control = this.form.controls.process_ids;
    const selected = new Set(control.value);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    control.setValue([...selected]);
  }

  async saveUser(): Promise<void> {
    if (!this.auth.canEditPage('usuarios') || this.saving()) return;
    if (this.form.controls.role.value === 'other') {
      const name = this.form.controls.new_role_name.value.trim();
      if (name.length < 2) {
        this.form.controls.new_role_name.setErrors({ minlength: true });
      } else if (
        [
          ...this.roles.map((role) => role.label),
          ...this.customRoles().map((role) => role.name),
        ].some(
          (existing) => existing.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'),
        )
      ) {
        this.formError.set('Já existe um cargo com este nome. Selecione-o na lista.');
        return;
      }
    }
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
      let selectedRole = value.role;
      if (selectedRole === 'other') {
        const name = value.new_role_name.trim();
        const id = await this.userManagement.saveRole({
          name,
          description: '',
          module_access: value.module_access,
          edit_access: value.edit_access,
        });
        this.customRoles.update((roles) => [
          ...roles,
          {
            id,
            name,
            description: '',
            module_access: value.module_access,
            edit_access: value.edit_access,
          },
        ]);
        selectedRole = `custom:${id}`;
        this.form.controls.role.setValue(selectedRole);
        this.updateRoleValidators();
      }
      const custom_role_id = selectedRole.startsWith('custom:') ? selectedRole.slice(7) : null;
      await this.userManagement.save({
        action: current ? 'update' : 'create',
        ...(current ? { id: current.id } : {}),
        name: value.name,
        short_name: value.short_name,
        registration_code: value.registration_code,
        email: value.email,
        process_ids: value.process_ids,
        module_access: value.module_access,
        edit_access: value.edit_access,
        is_active: value.is_active,
        receive_email_alerts: value.receive_email_alerts,
        is_department_head: value.is_department_head,
        role: custom_role_id ? 'admin' : selectedRole,
        custom_role_id,
        category_id: selectedRole === 'gestor' ? value.category_id : null,
        birth_date: value.birth_date || null,
      });
      await this.loadUsers();
      this.formOpen.set(false);
      this.toast.success(current ? 'Usuário atualizado' : 'Convite enviado por e-mail');
    } catch (error) {
      const message = errorMessage(error, 'Não foi possível salvar o usuário.');
      this.formError.set(message);
      this.toast.error(current ? message : `Não foi possível enviar o convite: ${message}`);
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
    let uploadedAvatar: string | null = null;
    try {
      const value = this.selfForm.getRawValue();
      const avatarFile = this.avatarFile();
      uploadedAvatar =
        avatarFile && this.auth.user()
          ? await this.userManagement.uploadAvatar(this.auth.user()!.id, avatarFile)
          : null;
      await this.userManagement.save({
        action: 'update_self',
        ...value,
        birth_date: value.birth_date || null,
        ...(uploadedAvatar ? { avatar_path: uploadedAvatar } : {}),
      });
      await this.auth.refreshProfile();
      this.resetSelfForm();
      this.avatarFile.set(null);
      if (this.avatarPreview()) URL.revokeObjectURL(this.avatarPreview()!);
      this.avatarPreview.set(null);
      this.toast.success('Perfil atualizado');
    } catch (error) {
      if (uploadedAvatar) await this.userManagement.removeAvatar(uploadedAvatar);
      this.toast.error(errorMessage(error, 'Não foi possível atualizar o perfil.'));
    } finally {
      this.saving.set(false);
    }
  }

  roleLabel(role: string): string {
    const custom = this.customRoles().find((item) => item.id === role);
    if (custom) return custom.name;
    return this.roles.find((option) => option.value === role)?.label ?? role;
  }

  userRoleLabel(user: Profile): string {
    return user.custom_role_name ?? this.roleLabel(user.role);
  }

  avatarUrl(path: string | null | undefined): string | null {
    return this.userManagement.avatarUrl(path);
  }

  selectAvatar(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      this.toast.error('Selecione uma imagem JPG, PNG ou WebP de até 2 MB.');
      return;
    }
    this.avatarFile.set(file);
    if (this.avatarPreview()) URL.revokeObjectURL(this.avatarPreview()!);
    this.avatarPreview.set(URL.createObjectURL(file));
  }

  openCreateRole(): void {
    this.roleEditing.set(null);
    this.roleForm.reset({
      name: '',
      description: '',
      module_access: ['education'],
      edit_access: [],
    });
    this.expandedRoleModules.set([]);
    this.roleError.set(null);
    this.roleOpen.set(true);
  }

  openEditRole(role: CustomRole): void {
    this.roleEditing.set(role);
    this.roleForm.reset({
      ...role,
      module_access: [...new Set([...role.module_access, 'education'])],
    });
    this.expandedRoleModules.set([...role.module_access]);
    this.roleError.set(null);
    this.roleOpen.set(true);
  }

  toggleRoleModule(module: string): void {
    if (module === 'education') return;
    const selected = new Set(this.roleForm.controls.module_access.value);
    if (selected.has(module)) selected.delete(module);
    else selected.add(module);
    this.roleForm.controls.module_access.setValue([...selected]);
    this.expandedRoleModules.update((expanded) =>
      selected.has(module)
        ? [...new Set([...expanded, module])]
        : expanded.filter((item) => item !== module),
    );
    this.roleForm.controls.edit_access.setValue(
      this.roleForm.controls.edit_access.value.filter((page) =>
        selected.has(this.pages.find((entry) => entry.key === page)?.module ?? ''),
      ),
    );
  }

  toggleRoleEdit(page: string): void {
    const selected = new Set(this.roleForm.controls.edit_access.value);
    if (selected.has(page)) selected.delete(page);
    else selected.add(page);
    this.roleForm.controls.edit_access.setValue([...selected]);
  }

  toggleRoleModuleExpanded(key: string): void {
    this.expandedRoleModules.update((expanded) =>
      expanded.includes(key) ? expanded.filter((item) => item !== key) : [...expanded, key],
    );
  }

  roleModuleFullyEditable(module: string): boolean {
    const pages = this.pagesForModule(module);
    return (
      pages.length > 0 &&
      pages.every((page) => this.roleForm.controls.edit_access.value.includes(page.key))
    );
  }

  toggleRoleModuleEdit(module: string): void {
    const keys = this.pagesForModule(module).map((page) => page.key);
    const selected = new Set(this.roleForm.controls.edit_access.value);
    if (keys.every((key) => selected.has(key))) keys.forEach((key) => selected.delete(key));
    else keys.forEach((key) => selected.add(key));
    this.roleForm.controls.edit_access.setValue([...selected]);
  }

  async saveRole(): Promise<void> {
    if (!this.auth.canEditPage('usuarios') || this.saving() || this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.roleError.set(null);
    try {
      await this.userManagement.saveRole({
        ...this.roleForm.getRawValue(),
        ...(this.roleEditing() ? { id: this.roleEditing()!.id } : {}),
      });
      this.customRoles.set(await this.userManagement.listRoles());
      this.roleOpen.set(false);
      this.toast.success(this.roleEditing() ? 'Cargo atualizado' : 'Cargo criado');
    } catch (error) {
      this.roleError.set(errorMessage(error, 'Não foi possível salvar o cargo.'));
    } finally {
      this.saving.set(false);
    }
  }

  processName(id: string): string {
    const process = this.processes().find((item) => item.id === id);
    return process ? `${process.code} · ${process.title}` : id;
  }

  private defaultModules(role: UserRole): string[] {
    if (role === 'visualizador') return ['dashboard', 'education'];
    if (role === 'admin') return [...ALL_MODULES];
    return ALL_MODULES.filter(
      (module) => module !== 'users' && (role === 'gestor' || module !== 'surveys'),
    );
  }

  private defaultEdits(role: UserRole): string[] {
    if (role === 'admin') return this.pages.map((page) => page.key);
    if (role === 'gestor')
      return this.pages
        .filter(
          (page) =>
            ![
              'indicadores/cadastro',
              'processos/gerenciamento',
              'documentos/gerenciamento',
              'documentos/copias',
              'incidentes/parametrizacao',
              'pesquisas/parametrizacao',
              'usuarios',
            ].includes(page.key),
        )
        .map((page) => page.key);
    if (role === 'operador') return ['incidentes/realizacao', 'incidentes/painel', 'helpdesk'];
    if (role === 'analista')
      return [
        'indicadores/alimentacao',
        'incidentes/realizacao',
        'incidentes/painel',
        'helpdesk',
        'planos-acao',
      ];
    return [];
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
