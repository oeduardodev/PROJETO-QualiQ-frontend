// Central type definitions for the QMS (Sistema de Gestão da Qualidade).
// All tables support a `custom_fields` JSONB column for user-defined parametrization.

// Write contracts remain partial to match the existing repository APIs and database defaults.
interface TableDefinition<Row, Generated extends keyof Row = never> {
  Row: { [Key in keyof Row]: Row[Key] };
  Insert: Partial<Omit<Row, 'id' | 'created_at' | 'updated_at' | Generated>>;
  Update: Partial<Omit<Row, 'id' | 'created_at' | 'updated_at' | Generated>>;
  Relationships: [];
}

export interface Database {
  public: {
    Tables: {
      value_chain_categories: TableDefinition<ValueChainCategory>;
      processes: TableDefinition<Process>;
      sipoc_nodes: TableDefinition<SipocNode>;
      sipoc_node_associations: TableDefinition<SipocNodeAssociation>;
      sipoc_step_associations: TableDefinition<SipocStepAssociation>;
      tickets: TableDefinition<Ticket>;
      helpdesk_tickets: TableDefinition<HelpdeskTicket>;
      action_plans: TableDefinition<ActionPlan>;
      indicators: TableDefinition<Indicator>;
      indicator_history: TableDefinition<IndicatorHistoryEntry>;
      profiles: TableDefinition<Profile>;
      dimension_versions: TableDefinition<DimensionVersion>;
      dimensions: TableDefinition<Dimension>;
      dimension_links: TableDefinition<DimensionLink>;
      risks: TableDefinition<Risk, 'risk_score' | 'risk_level'>;
      risk_factors: TableDefinition<RiskFactor>;
      risk_preventive_actions: TableDefinition<RiskPreventiveAction>;
      risk_contingency_plans: TableDefinition<RiskContingencyPlan>;
      document_types: TableDefinition<DocumentType>;
      documents: TableDefinition<GEDDocument>;
      document_workflows: TableDefinition<DocumentWorkflow, 'changed_at'>;
      controlled_copies: TableDefinition<ControlledCopy>;
      slas: TableDefinition<SLA>;
      notification_types: TableDefinition<NotificationType>;
      notification_classifications: TableDefinition<NotificationClassification>;
    };
    Views: Record<string, never>;
    Functions: {
      advance_document: {
        Args: {
          p_document_id: string;
          p_expected_status: DocumentStatus;
          p_next_status: DocumentStatus;
        };
        Returns: GEDDocument;
      };
      save_document: {
        Args: {
          p_document_id: string | null;
          p_expected_status: DocumentStatus | null;
          p_status: DocumentStatus;
          p_title: string;
          p_type_id: string | null;
          p_process_id: string | null;
          p_drive_link: string | null;
          p_print_allowed: boolean;
        };
        Returns: GEDDocument;
      };
      record_indicator_value: {
        Args: {
          p_indicator_id: string;
          p_period: string;
          p_value: number;
        };
        Returns: Indicator;
      };
      create_sipoc_node_with_steps: {
        Args: {
          p_title: string;
          p_description: string;
          p_node_type: NodeType;
          p_process_id: string;
          p_step_ids: string[];
        };
        Returns: SipocNode;
      };
      create_action_plans_from_suggestions: {
        Args: { p_ticket_id: string; p_suggestions: unknown };
        Returns: ActionPlan[];
      };
      consume_ai_quota: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      create_dimension_version: {
        Args: { p_label: string };
        Returns: DimensionVersion;
      };
      save_dimension_with_links: {
        Args: {
          p_id: string | null;
          p_version_id: string;
          p_name: string;
          p_description: string;
          p_objective: string;
          p_classification_key: string;
          p_color_key: string;
          p_order_index: number;
          p_indicator_ids: string[];
          p_plan_ids: string[];
        };
        Returns: Dimension;
      };
    };
    Enums: Record<string, never>;
  };
}

export interface ValueChainCategory {
  id: string;
  name: string;
  description: string | null;
  color_key: string;
  order_index: number;
  created_at: string;
}

export type NodeType = 'S' | 'I' | 'P' | 'O' | 'C';

export interface Process {
  id: string;
  category_id: string;
  order_index: number;
  title: string;
  code: string | null;
  impact_score: number;
  complexity_score: number;
  maturity_level: number;
  owner: string | null;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SipocNode {
  id: string;
  process_id: string | null;
  node_type: NodeType;
  title: string;
  description: string | null;
  order_index: number;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SipocNodeAssociation {
  id: string;
  node_id: string;
  process_id: string;
  created_at: string;
}

export interface SipocStepAssociation {
  id: string;
  step_node_id: string;
  associated_node_id: string;
  created_at: string;
}

export type TicketStatus = 'aberto' | 'analise' | 'plano' | 'concluido';
export type TicketSeverity = 'baixa' | 'media' | 'alta' | 'critica';
export type TicketClassification = 'incidente' | 'nao_conformidade' | 'melhoria' | 'reclamacao';

export interface Ticket {
  id: string;
  title: string;
  description: string | null;
  process_id: string;
  step_id: string | null;
  status: TicketStatus;
  severity: TicketSeverity;
  classification_flag: string | null;
  incident_type: string | null;
  free_description: string | null;
  incident_datetime: string | null;
  risk_id: string | null;
  sla_id: string | null;
  notification_type_id: string | null;
  analysis_completed: boolean;
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type HelpdeskCategory = 'ti' | 'manutencao' | 'almoxarifado';
export type HelpdeskStatus = 'aberto' | 'em_andamento' | 'resolvido' | 'fechado';
export type HelpdeskPriority = 'baixa' | 'media' | 'alta' | 'urgente';

export interface HelpdeskTicket {
  id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  category: HelpdeskCategory;
  status: HelpdeskStatus;
  priority: HelpdeskPriority;
  requester_name: string | null;
  assigned_to: string | null;
  process_id: string | null;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface IshikawaData {
  maquina: string;
  metodo: string;
  mao_de_obra: string;
  material: string;
  meio_ambiente: string;
  medida: string;
}

export type ActionPlanStatus = 'pendente' | 'andamento' | 'concluido' | 'atrasado';

export interface ActionPlan {
  id: string;
  title: string;
  ticket_id: string;
  what: string | null;
  why: string | null;
  where: string | null;
  when: string | null;
  who: string | null;
  how: string | null;
  how_much: string | null;
  status: ActionPlanStatus;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'Admin' | 'Gestor' | 'Operador' | 'admin' | 'gestor' | 'operador';

export interface Profile {
  id: string;
  name: string;
  role: UserRole;
  category_id: string | null;
  created_at: string;
}

export type IndicatorFrequency = 'diario' | 'semanal' | 'mensal';
export type IndicatorStatus = 'no_alvo' | 'atencao' | 'critico';
export type IndicatorUnitType = 'numero_absoluto' | 'percentual' | 'monetario';

export interface Indicator {
  id: string;
  title: string;
  process_id: string;
  step_id: string | null;
  goal_value: number;
  unit: IndicatorUnitType;
  current_value: number;
  frequency: IndicatorFrequency;
  status: IndicatorStatus;
  requires_critical_analysis: boolean;
  created_at: string;
  updated_at: string;
}

export interface IndicatorHistoryEntry {
  id: string;
  indicator_id: string;
  period: string;
  value: number;
  goal: number;
  created_at: string;
}

export type DimensionColor = 'blue' | 'green' | 'orange' | 'amber' | 'rose' | 'violet';
export type DimensionClassification =
  'financeira' | 'clientes' | 'processos_internos' | 'aprendizado_crescimento';

export interface DimensionVersion {
  id: string;
  version_number: number;
  label: string;
  created_by: string | null;
  created_at: string;
}

export interface Dimension {
  id: string;
  version_id: string;
  code: string;
  classification_key: DimensionClassification;
  name: string;
  description: string | null;
  objective: string | null;
  color_key: string;
  order_index: number;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type DimensionItemType =
  | 'indicator'
  | 'action_plan'
  | 'swot_analysis'
  | 'pestel_analysis'
  | 'porter_five_forces_analysis'
  | 'environmental_analysis';

export interface DimensionLink {
  id: string;
  dimension_id: string;
  version_id: string;
  item_type: DimensionItemType;
  item_id: string;
  process_id: string;
  created_at: string;
}

// =====================================================
// Document Management (GED)
// =====================================================
export type DocumentStatus = 'rascunho' | 'em_revisao' | 'aprovado' | 'publicado' | 'obsoleto';
export type CopyStatus = 'solicitada' | 'entregue' | 'recolhida';

export interface DocumentType {
  id: string;
  name: string;
  hierarchy_level: number;
  sla_review_days: number;
  sla_approval_days: number;
  print_allowed: boolean;
  created_at: string;
}

export interface GEDDocument {
  id: string;
  title: string;
  type_id: string | null;
  process_id: string | null;
  drive_link: string | null;
  status: DocumentStatus;
  owner_id: string | null;
  print_allowed: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentWorkflow {
  id: string;
  document_id: string;
  from_status: DocumentStatus | null;
  to_status: DocumentStatus;
  changed_by: string | null;
  changed_at: string;
  sla_deadline: string | null;
  notes: string | null;
}

export interface ControlledCopy {
  id: string;
  document_id: string;
  user_id: string | null;
  request_date: string;
  delivery_date: string | null;
  return_date: string | null;
  status: CopyStatus;
  created_at: string;
}

export type RiskStatus = 'identificado' | 'em_analise' | 'tratado' | 'monitorado';
export type RiskLevel = 'baixo' | 'moderado' | 'alto' | 'critico';
export type RiskType = 'Operacional' | 'Estratégico' | 'Financeiro' | 'Compliance';

export interface Risk {
  id: string;
  title: string;
  description: string | null;
  process_id: string;
  step_id: string | null;
  probability: number;
  impact: number;
  risk_score: number;
  risk_level: RiskLevel;
  risk_type: RiskType;
  barriers: string | null;
  status: RiskStatus;
  owner: string | null;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface RiskFactor {
  id: string;
  risk_id: string;
  description: string;
  category: string | null;
  created_at: string;
}

export type PreventiveActionStatus = 'pendente' | 'em_andamento' | 'concluida';

export interface RiskPreventiveAction {
  id: string;
  risk_id: string;
  factor_id: string | null;
  description: string;
  responsible: string | null;
  status: PreventiveActionStatus;
  created_at: string;
}

export type ContingencyPlanStatus = 'ativo' | 'inativo';

export interface RiskContingencyPlan {
  id: string;
  risk_id: string;
  description: string;
  trigger: string | null;
  responsible: string | null;
  estimated_cost: string | null;
  status: ContingencyPlanStatus;
  created_at: string;
}

// =====================================================
// SLAs — inter-process service level agreements
// =====================================================
export type SlaStatus = 'Ativo' | 'Em Revisão' | 'Inativo';

export interface SLA {
  id: string;
  title: string;
  supplier_process_id: string | null;
  client_process_id: string | null;
  sipoc_input_id: string | null;
  lead_time_hours: number;
  quality_criteria: string | null;
  status: SlaStatus;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Notification Types — configurable incident/notif types
// =====================================================
export type NotificationSeverity = 'baixa' | 'media' | 'alta' | 'critica';
export type AnalysisTool = 'Ishikawa' | '5 Porquês' | 'Nenhuma';

// =====================================================
// Notification Classifications — form template + treatment rules
// =====================================================
export interface NotificationClassification {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  default_severity: NotificationSeverity;
  sla_hours: number | null;
  analysis_tool: AnalysisTool;
  requires_root_cause: boolean;
  form_schema: FormFieldSchema[] | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Notification Types — specific named notifications within a classification
// =====================================================
export interface NotificationType {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  classification_id: string | null;
  default_severity: NotificationSeverity;
  requires_root_cause: boolean;
  analysis_tool: AnalysisTool;
  sla_hours: number | null;
  custom_fields_schema: Record<string, unknown> | null;
  form_schema: FormFieldSchema[] | null;
  sla_id: string | null;
  risk_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type FormFieldType = 'text' | 'number' | 'date' | 'select';

export interface FormFieldSchema {
  name: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: string[];
}
