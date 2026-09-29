import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IconDirective } from '@shared/components/icon/icon.directive';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [IconDirective],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private readonly route = inject(ActivatedRoute);
  readonly placeholder = this.route.snapshot.data['mode'] === 'engine';
  readonly sections = [
    {
      title: 'Parametrização',
      icon: 'SlidersHorizontal',
      description: 'Configure campos customizados, formulários e fluxos de trabalho.',
      items: ['Campos customizados (JSONB)', 'Formulários dinâmicos', 'Fluxos de aprovação'],
    },
    {
      title: 'Banco de Dados',
      icon: 'Database',
      description: 'Estrutura de tabelas e integração com Supabase.',
      items: ['Tabelas e migrações', 'Políticas de RLS', 'Funções e triggers'],
    },
    {
      title: 'Notificações',
      icon: 'Bell',
      description: 'Alertas de vencimento de documentos, não-conformidades e ações pendentes.',
      items: ['E-mail de alerta', 'Notificações in-app', 'Webhooks'],
    },
    {
      title: 'Aparência',
      icon: 'Palette',
      description: 'Personalização visual do sistema.',
      items: ['Tema e cores', 'Logo da empresa', 'Layout do painel'],
    },
    {
      title: 'Segurança',
      icon: 'Shield',
      description: 'Controle de acesso, perfis e permissões.',
      items: ['Usuários e perfis', 'Permissões por módulo', 'Auditoria de ações'],
    },
  ];
}
