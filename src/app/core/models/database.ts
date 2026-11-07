import type { Database as GeneratedDatabase } from './database.generated';
import type {
  Audit,
  AuditItem,
  AuditRiskImpact,
  AuditTemplate,
} from '@features/audits/audit.models';
import type { DocumentContent } from './document-content';
import type {
  BuiltForm,
  BuiltFormResponse,
  FormAnswer,
  PublicBuiltForm,
} from '@features/form-builder/form-builder.models';
import type {
  Survey,
  SurveyCriterion,
  SurveyLink,
  SurveyResponse,
  PublicSurvey,
} from '@features/surveys/survey.models';
import type {
  LearningItem,
  LearningTrackCourse,
  LearningStage,
  LearningQuiz,
  LearningQuestion,
  LearningStageProgress,
  LearningQuizAttempt,
  LearningAttendance,
  PublicLearningQuestion,
  QuizResult,
} from '@features/education/education.models';
export type { Database } from './database.generated';

// Application contracts for the QMS. Database is the generated schema; AppDatabase is the
// compatibility contract used by existing repositories.

// Write contracts remain partial to match the existing repository APIs and database defaults.
interface TableDefinition<Row, Generated extends keyof Row = never> {
  Row: { [Key in keyof Row]: Row[Key] };
  Insert: Partial<Omit<Row, 'id' | 'created_at' | 'updated_at' | Generated>>;
  Update: Partial<Omit<Row, 'id' | 'created_at' | 'updated_at' | Generated>>;
  Relationships: [];
}

export interface AppDatabase {
  public: {
    Tables: {
      system_settings: TableDefinition<SystemSettings>;
      establishments: TableDefinition<Establishment>;
      establishment_modules: TableDefinition<EstablishmentModule>;
      module_catalog: TableDefinition<ModuleCatalogEntry>;
      plans: TableDefinition<QualiqPlan>;
      value_chain_categories: TableDefinition<ValueChainCategory>;
      processes: TableDefinition<Process>;
      process_history: TableDefinition<ProcessHistory>;
      edit_history: TableDefinition<EditHistory>;
      sla_history: TableDefinition<SlaHistory>;
      sla_approvals: TableDefinition<SlaApproval>;
      sipoc_nodes: TableDefinition<SipocNode>;
      sipoc_node_associations: TableDefinition<SipocNodeAssociation>;
      sipoc_step_associations: TableDefinition<SipocStepAssociation>;
      tickets: TableDefinition<Ticket>;
      ticket_history: TableDefinition<TicketHistory>;
      ticket_statuses: TableDefinition<TicketStatusOption>;
      helpdesk_tickets: TableDefinition<HelpdeskTicket>;
      helpdesk_statuses: TableDefinition<HelpdeskStatusOption>;
      helpdesk_categories: TableDefinition<HelpdeskCategoryOption>;
      helpdesk_priorities: TableDefinition<HelpdeskPriorityOption>;
      operation_inbox: TableDefinition<OperationInbox>;
      profile_processes: TableDefinition<ProfileProcess>;
      action_plan_comments: TableDefinition<ActionPlanComment>;
      action_plan_evidence: TableDefinition<ActionPlanEvidence>;
      action_plan_history: TableDefinition<ActionPlanHistory>;
      action_plans: TableDefinition<ActionPlan>;
      action_plan_statuses: TableDefinition<ActionPlanStatusOption>;
      learning_items: TableDefinition<LearningItem>;
      learning_track_courses: TableDefinition<LearningTrackCourse>;
      learning_stages: TableDefinition<LearningStage>;
      learning_quizzes: TableDefinition<LearningQuiz>;
      learning_questions: TableDefinition<LearningQuestion>;
      learning_stage_progress: TableDefinition<LearningStageProgress>;
      learning_quiz_attempts: TableDefinition<LearningQuizAttempt>;
      learning_attendance: TableDefinition<LearningAttendance>;
      indicators: TableDefinition<Indicator>;
      indicator_statuses: TableDefinition<IndicatorStatusOption>;
      indicator_history: TableDefinition<IndicatorHistoryEntry>;
      indicator_definition_history: TableDefinition<IndicatorDefinitionHistory>;
      indicator_result_analyses: TableDefinition<IndicatorResultAnalysis>;
      profiles: TableDefinition<Profile>;
      dimension_versions: TableDefinition<DimensionVersion>;
      dimensions: TableDefinition<Dimension>;
      dimension_classifications: TableDefinition<DimensionClassificationOption>;
      dimension_colors: TableDefinition<DimensionColorOption>;
      dimension_links: TableDefinition<DimensionLink>;
      risks: TableDefinition<Risk, 'risk_score' | 'risk_level'>;
      risk_history: TableDefinition<RiskHistory>;
      risk_matrix_classifications: TableDefinition<RiskMatrixClassification>;
      risk_statuses: TableDefinition<RiskStatusOption>;
      risk_types: TableDefinition<RiskTypeOption>;
      risk_factors: TableDefinition<RiskFactor>;
      risk_preventive_actions: TableDefinition<RiskPreventiveAction>;
      risk_preventive_action_statuses: TableDefinition<RiskPreventiveActionStatusOption>;
      risk_contingency_plans: TableDefinition<RiskContingencyPlan>;
      risk_contingency_plan_statuses: TableDefinition<RiskContingencyPlanStatusOption>;
      document_versions: TableDefinition<DocumentVersion>;
      document_decisions: TableDefinition<DocumentDecision>;
      document_types: TableDefinition<DocumentType>;
      document_levels: TableDefinition<DocumentLevel>;
      document_type_history: TableDefinition<DocumentTypeHistory>;
      documents: TableDefinition<GEDDocument>;
      document_workflows: TableDefinition<DocumentWorkflow, 'changed_at'>;
      controlled_copies: TableDefinition<ControlledCopy>;
      slas: TableDefinition<SLA>;
      sla_statuses: TableDefinition<SlaStatusOption>;
      // Legacy Supabase names for Incidents; these are not user notifications.
      notification_types: TableDefinition<IncidentType>;
      notification_classifications: TableDefinition<IncidentClassification>;
      notification_severities: TableDefinition<IncidentSeverityOption>;
      analysis_tools: TableDefinition<AnalysisToolOption>;
      form_field_types: TableDefinition<FormFieldTypeOption>;
      survey_criteria: TableDefinition<SurveyCriterion>;
      surveys: TableDefinition<Survey>;
      survey_links: TableDefinition<SurveyLink>;
      survey_responses: TableDefinition<SurveyResponse>;
      built_forms: TableDefinition<BuiltForm>;
      built_form_responses: TableDefinition<BuiltFormResponse>;
      audit_templates: TableDefinition<AuditTemplate>;
      audits: TableDefinition<Audit>;
      audit_items: TableDefinition<AuditItem>;
      audit_risk_impacts: TableDefinition<AuditRiskImpact>;
    };
    Views: Record<string, never>;
    Functions: {
      create_audit: {
        Args: {
          p_kind: string;
          p_title: string;
          p_process_id: string | null;
          p_checks: string[];
          p_auto_apply_risk: boolean;
        };
        Returns: Audit;
      };
      save_audit_item: {
        Args: {
          p_id: string;
          p_result: string;
          p_evidence: string;
          p_improvement: string;
          p_action_proposal: string;
          p_notification_proposal: string;
        };
        Returns: AuditItem;
      };
      complete_audit: { Args: { p_id: string; p_summary: string }; Returns: Audit };
      read_public_built_form: { Args: { p_token: string }; Returns: PublicBuiltForm };
      submit_public_built_form: {
        Args: { p_token: string; p_answers: Record<string, FormAnswer> };
        Returns: string;
      };
      read_public_survey: { Args: { p_token: string }; Returns: PublicSurvey };
      submit_public_survey: {
        Args: { p_token: string; p_answers: Record<string, string | number> };
        Returns: string;
      };
      review_survey_response: {
        Args: { p_id: string; p_analysis: string; p_action: string };
        Returns: SurveyResponse;
      };
      learning_public_questions: { Args: { p_quiz: string }; Returns: PublicLearningQuestion[] };
      learning_record_access: {
        Args: { p_stage: string; p_seconds: number };
        Returns: LearningStageProgress;
      };
      learning_submit_quiz: { Args: { p_quiz: string; p_answers: number[] }; Returns: QuizResult };
      learning_complete_stage: { Args: { p_stage: string }; Returns: LearningStageProgress };
      learning_sign_attendance: {
        Args: { p_item: string; p_name: string };
        Returns: LearningAttendance;
      };
      save_operation_plan: {
        Args: {
          p_id: string | null;
          p_expected_updated_at: string | null;
          p_payload: Record<string, unknown>;
          p_reason: string;
        };
        Returns: ActionPlan;
      };
      import_intelligent_action_plan: {
        Args: { p_payload: Record<string, unknown> };
        Returns: ActionPlan;
      };
      update_operation_task: {
        Args: {
          p_id: string;
          p_expected_updated_at: string;
          p_task: string;
          p_completed: boolean;
          p_reason: string;
        };
        Returns: ActionPlan;
      };
      transition_operation_plan: {
        Args: { p_id: string; p_expected_updated_at: string; p_action: string; p_reason: string };
        Returns: ActionPlan;
      };
      save_operation_ticket: {
        Args: {
          p_id: string | null;
          p_expected_updated_at: string | null;
          p_payload: Record<string, unknown>;
          p_reason: string;
        };
        Returns: Ticket;
      };
      transition_operation_ticket: {
        Args: {
          p_id: string;
          p_expected_updated_at: string;
          p_action: string;
          p_manager: string | null;
          p_reason: string;
        };
        Returns: Ticket;
      };
      create_public_notification_link: {
        Args: { p_classification: string; p_process: string };
        Returns: string;
      };
      read_public_notification_form: {
        Args: { p_token: string };
        Returns: {
          classification: string;
          process: string;
          schema: FormFieldSchema[];
          types: { id: string; name: string }[];
        };
      };
      submit_public_notification: {
        Args: { p_token: string; p_payload: Record<string, unknown> };
        Returns: string;
      };
      save_operation_document: {
        Args: {
          p_id: string | null;
          p_expected_updated_at: string | null;
          p_payload: Record<string, unknown>;
          p_reason: string;
        };
        Returns: GEDDocument;
      };
      transition_operation_document: {
        Args: {
          p_id: string;
          p_expected_updated_at: string;
          p_action: string;
          p_reason: string;
          p_pdf_path?: string;
        };
        Returns: GEDDocument;
      };
      save_document_content: {
        Args: {
          p_id: string;
          p_expected_updated_at: string;
          p_json: DocumentContent;
          p_html: string;
          p_reason: string;
        };
        Returns: GEDDocument;
      };
      request_operation_copy: {
        Args: { p_document_id: string; p_reason: string; p_due_date: string };
        Returns: ControlledCopy;
      };
      transition_operation_copy: {
        Args: {
          p_id: string;
          p_expected_status: CopyStatus;
          p_status: CopyStatus;
          p_reason: string;
        };
        Returns: ControlledCopy;
      };
      update_risk_with_reason: {
        Args: { p_id: string; p_patch: Record<string, unknown>; p_justification: string };
        Returns: Risk;
      };
      save_risk_matrix_classifications: {
        Args: { p_items: RiskMatrixClassificationInput[] };
        Returns: RiskMatrixClassification[];
      };
      update_process_with_reason: {
        Args: { p_id: string; p_patch: Record<string, unknown>; p_justification: string };
        Returns: Process;
      };
      update_sla_with_reason: {
        Args: { p_id: string; p_patch: Record<string, unknown>; p_justification: string };
        Returns: SLA;
      };
      create_sla_draft: {
        Args: { p_payload: Record<string, unknown> };
        Returns: SLA;
      };
      activate_sla: { Args: { p_id: string }; Returns: SLA };
      submit_sla_for_approval: { Args: { p_id: string }; Returns: SLA };
      decide_sla_approval: {
        Args: { p_id: string; p_approve: boolean; p_reason: string };
        Returns: SLA;
      };
      deactivate_sla: { Args: { p_id: string; p_reason: string }; Returns: SLA };
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
      save_document_level: {
        Args: { p_level: number | null; p_name: string };
        Returns: DocumentLevel;
      };
      save_document_level_with_reason: {
        Args: { p_level: number | null; p_name: string; p_justification: string | null };
        Returns: DocumentLevel;
      };
      update_audited_record: {
        Args: {
          p_entity: string;
          p_id: string;
          p_patch: Record<string, unknown>;
          p_justification: string;
        };
        Returns: Record<string, unknown>;
      };
      save_document_type: {
        Args: {
          p_type_id: string | null;
          p_name: string;
          p_acronym: string;
          p_level: number;
          p_validity_days: number;
          p_review_days: number;
          p_approval_days: number;
          p_publication_days: number;
          p_print_allowed: boolean;
          p_public_panel: boolean;
          p_active: boolean;
          p_justification: string | null;
        };
        Returns: DocumentType;
      };
      record_indicator_value: {
        Args: {
          p_indicator_id: string;
          p_period: string;
          p_value: number;
        };
        Returns: Indicator;
      };
      record_indicator_result: {
        Args: {
          p_indicator_id: string;
          p_period: string;
          p_value: number;
          p_late_justification: string | null;
          p_analysis: string | null;
        };
        Returns: { indicator: Indicator; history: IndicatorHistoryEntry };
      };
      save_indicator_definition: {
        Args: {
          p_id: string | null;
          p_title: string;
          p_objective: string;
          p_process_id: string;
          p_step_id: string | null;
          p_frequency: IndicatorFrequency;
          p_indicator_type: IndicatorClassification;
          p_requires_critical_analysis: boolean;
          p_goal_value: number;
          p_acceptable_variation: number;
          p_unit: IndicatorUnitType;
          p_goal_direction: 'higher' | 'lower';
          p_strategic: boolean;
          p_dimension_id: string | null;
          p_calculation_type: IndicatorCalculationType;
          p_simple_formula: string;
          p_result_source: string;
          p_formula_expression: string;
          p_formula_tokens: IndicatorFormulaToken[];
          p_decimal_places: number;
          p_obsolete: boolean;
          p_justification: string | null;
        };
        Returns: Indicator;
      };
      indicator_result_actors: {
        Args: never;
        Returns: { id: string; name: string }[];
      };
      get_indicator_unit_options: {
        Args: never;
        Returns: IndicatorUnitOption[];
      };
      get_indicator_frequency_options: {
        Args: never;
        Returns: IndicatorFrequencyOption[];
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
      create_plans_for_indicator_analysis: {
        Args: { p_analysis_id: string; p_ticket_id: string };
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
      save_dimension_with_reason: {
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
          p_justification: string | null;
        };
        Returns: Dimension;
      };
    };
    Enums: GeneratedDatabase['public']['Enums'];
  };
}

export interface SystemSettings {
  id: boolean;
  active_maintenance: boolean;
  updated_at: string;
}

export interface ValueChainCategory {
  id: string;
  name: string;
  description: string | null;
  color_key: string;
  order_index: number;
  created_at: string;
}

export type NodeType = GeneratedDatabase['public']['Tables']['sipoc_nodes']['Row']['node_type'];

export interface Process {
  id: string;
  category_id: string;
  order_index: number;
  title: string;
  code: string;
  impact_score: number;
  complexity_score: number;
  maturity_level: number;
  owner: string | null;
  owner_id: string | null;
  participant_ids: string[];
  description: string;
  objective: string;
  obsolete: boolean;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessHistory {
  id: string;
  process_id: string;
  action: 'baseline' | 'created' | 'updated';
  justification: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown>;
  changed_by: string | null;
  changed_at: string;
}

export interface EditHistory {
  id: number | string;
  entity_name: string;
  record_id: string;
  action: string;
  justification: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown>;
  changed_by: string | null;
  changed_at: string;
}

export interface TicketHistory {
  id: string;
  ticket_id: string;
  action: string;
  reason: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown>;
  changed_by: string | null;
  changed_at: string;
}

export interface SlaHistory {
  id: string;
  sla_id: string;
  action: 'baseline' | 'created' | 'updated';
  justification: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown>;
  changed_by: string | null;
  changed_at: string;
}

export interface SlaApproval {
  id: string;
  sla_id: string;
  revision: number;
  approver_id: string | null;
  process_ids: string[];
  decision: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason: string | null;
  requested_at: string;
  decided_at: string | null;
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

export type TicketStatus = GeneratedDatabase['public']['Tables']['tickets']['Row']['status'];
export type TicketStatusOption = GeneratedDatabase['public']['Tables']['ticket_statuses']['Row'];
export type TicketSeverity = GeneratedDatabase['public']['Tables']['tickets']['Row']['severity'];

export interface Ticket {
  created_by: string | null;
  assigned_to: string | null;
  due_at: string | null;
  treatment: string | null;
  classification_id: string | null;
  analysis_tool_snapshot: string | null;
  requires_root_cause_snapshot: boolean;
  id: string;
  code: string;
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

export type HelpdeskCategory =
  GeneratedDatabase['public']['Tables']['helpdesk_tickets']['Row']['category'];
export type HelpdeskStatus =
  GeneratedDatabase['public']['Tables']['helpdesk_tickets']['Row']['status'];
export type HelpdeskStatusOption =
  GeneratedDatabase['public']['Tables']['helpdesk_statuses']['Row'];
export type HelpdeskPriority =
  GeneratedDatabase['public']['Tables']['helpdesk_tickets']['Row']['priority'];

export type HelpdeskCategoryOption =
  GeneratedDatabase['public']['Tables']['helpdesk_categories']['Row'];
export type HelpdeskPriorityOption =
  GeneratedDatabase['public']['Tables']['helpdesk_priorities']['Row'];

export interface HelpdeskTicket {
  id: string;
  code: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  category: HelpdeskCategory;
  status: HelpdeskStatus;
  status_changed_at: string;
  priority: HelpdeskPriority;
  requester_id: string | null;
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

export type ActionPlanStatus =
  GeneratedDatabase['public']['Tables']['action_plans']['Row']['status'];
export type ActionPlanStatusOption =
  GeneratedDatabase['public']['Tables']['action_plan_statuses']['Row'];

export interface ActionPlanTask {
  id: string;
  title: string;
  due_date: string;
  completed: boolean;
}
export interface OperationInbox {
  id: string;
  user_id: string;
  actor_id: string | null;
  actor_name: string | null;
  event_type: string;
  title: string;
  route: string;
  record_id: string;
  created_at: string;
  read_at: string | null;
}
export interface ActionPlanComment {
  id: string;
  plan_id: string;
  body: string;
  created_by: string;
  created_at: string;
}
export interface ActionPlanEvidence {
  id: string;
  plan_id: string;
  name: string;
  storage_path: string;
  mime_type: string;
  created_by: string;
  created_at: string;
}
export interface ActionPlanHistory {
  id: string;
  plan_id: string;
  action: string;
  justification: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown>;
  changed_by: string | null;
  changed_at: string;
}
export interface ActionPlan {
  process_id: string | null;
  origin: 'manual' | 'notification' | 'critical_analysis' | 'system' | 'ai';
  owner_id: string | null;
  controller_id: string | null;
  participant_ids: string[];
  how_mode: 'text' | 'tasks';
  tasks: ActionPlanTask[];
  progress: number;
  approved_progress: number;
  review_state: 'none' | 'pending' | 'approved' | 'rejected';
  active: boolean;
  id: string;
  code: string;
  title: string;
  ticket_id: string | null;
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

export type UserRole = GeneratedDatabase['public']['Enums']['user_role'];

export interface Establishment {
  id: string;
  name: string;
  legal_name: string | null;
  registration_number: string | null;
  admin_name: string | null;
  admin_email: string | null;
  status: 'active' | 'suspended' | 'inactive';
  plan_id: 'start' | 'pro' | 'corporate';
  ai_mode: 'disabled' | 'enabled';
  ai_monthly_limit: number;
  created_at: string;
  updated_at: string;
}

export interface EstablishmentModule {
  establishment_id: string;
  module_id: string;
  enabled: boolean;
  updated_at: string;
}

export interface ModuleCatalogEntry {
  id: string;
  name: string;
  is_base: boolean;
  implemented: boolean;
}

export interface QualiqPlan {
  id: string;
  name: string;
  description: string;
}

export interface Profile {
  id: string;
  name: string;
  email?: string | null;
  short_name?: string | null;
  registration_code?: string | null;
  birth_date?: string | null;
  role: UserRole;
  establishment_id?: string | null;
  category_id: string | null;
  is_active?: boolean;
  receive_email_alerts?: boolean;
  theme_preference?: 'light' | 'dark';
  is_department_head?: boolean;
  module_access?: string[];
  edit_access?: string[];
  custom_role_id?: string | null;
  custom_role_name?: string | null;
  avatar_path?: string | null;
  process_ids?: string[];
  created_at: string;
}

export interface CustomRole {
  id: string;
  name: string;
  description: string;
  module_access: string[];
  edit_access: string[];
}

export interface ProfileProcess {
  profile_id: string;
  process_id: string;
  created_at: string;
}

export type IndicatorFrequency = GeneratedDatabase['public']['Enums']['indicator_frequency_type'];

export interface IndicatorFrequencyOption {
  value: IndicatorFrequency;
  label: string;
}
export type IndicatorStatus = GeneratedDatabase['public']['Tables']['indicators']['Row']['status'];
export type IndicatorStatusOption =
  GeneratedDatabase['public']['Tables']['indicator_statuses']['Row'];
export type IndicatorUnitType = GeneratedDatabase['public']['Enums']['indicator_unit_type'];

export interface IndicatorUnitOption {
  value: IndicatorUnitType;
  label: string;
}

export type IndicatorClassification = 'estrutura' | 'processo' | 'resultado';
export type IndicatorCalculationType = 'simple' | 'composite';
export type IndicatorFormulaToken =
  | { kind: 'indicator'; id: string }
  | { kind: 'number'; value: number }
  | { kind: 'operator'; value: '+' | '-' | '*' | '/' };

export interface Indicator {
  id: string;
  code: string;
  title: string;
  process_id: string;
  step_id: string | null;
  goal_value: number;
  unit: IndicatorUnitType;
  current_value: number;
  frequency: IndicatorFrequency;
  status: IndicatorStatus;
  requires_critical_analysis: boolean;
  indicator_type: string;
  goal_direction: 'higher' | 'lower';
  objective: string;
  acceptable_variation: number;
  strategic: boolean;
  dimension_id: string | null;
  decimal_places: number;
  calculation_type: IndicatorCalculationType;
  simple_formula: string;
  result_source: string;
  formula_expression: string;
  formula_tokens: IndicatorFormulaToken[];
  obsolete: boolean;
  created_at: string;
  updated_at: string;
}

export interface IndicatorHistoryEntry {
  id: string;
  indicator_id: string;
  period: string;
  period_date: string | null;
  value: number;
  goal: number;
  created_at: string;
  created_by: string | null;
  late_justification: string | null;
}

export interface IndicatorDefinitionHistory {
  id: string;
  indicator_id: string;
  action: 'created' | 'updated';
  justification: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown>;
  changed_by: string | null;
  changed_at: string;
}

export interface IndicatorResultAnalysis {
  id: string;
  indicator_id: string;
  history_id: string | null;
  observed_value: number;
  observed_goal: number;
  observed_period: string;
  diagnostic: string;
  suggestions: IndicatorActionPlanSuggestion[];
  action_plan_ids: string[];
  created_by: string;
  created_at: string;
}

export interface IndicatorActionPlanSuggestion {
  title: string;
  what: string;
  why: string;
  who: string;
  how: string;
  how_much: string;
}

export type DimensionColor =
  GeneratedDatabase['public']['Tables']['dimension_colors']['Row']['key'];
export type DimensionColorOption = GeneratedDatabase['public']['Tables']['dimension_colors']['Row'];
export type DimensionClassification =
  GeneratedDatabase['public']['Tables']['dimension_classifications']['Row']['classification_key'];

export interface DimensionClassificationOption {
  classification_key: DimensionClassification;
  label: string;
  icon: string;
  order_index: number;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

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
  GeneratedDatabase['public']['Tables']['dimension_links']['Row']['item_type'];

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
export type DocumentStatus =
  GeneratedDatabase['public']['Enums']['document_status'] | 'em_validacao';
export type CopyStatus =
  GeneratedDatabase['public']['Enums']['copy_status'] | 'aprovada' | 'recusada';

export interface DocumentType {
  id: string;
  name: string;
  acronym: string;
  hierarchy_level: number;
  validity_days: number;
  sla_review_days: number;
  sla_approval_days: number;
  sla_publication_days: number;
  print_allowed: boolean;
  public_panel: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentLevel {
  level: number;
  name: string;
  created_at: string;
}

export interface DocumentTypeHistory {
  id: string;
  type_id: string;
  action: 'created' | 'updated' | 'deactivated' | 'reactivated';
  justification: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown>;
  changed_by: string | null;
  changed_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version: number;
  snapshot: GEDDocument;
  recorded_at: string;
  recorded_by: string | null;
  justification: string;
}
export interface DocumentDecision {
  id: string;
  document_id: string;
  version: number;
  approver_id: string;
  approved: boolean;
  comment: string;
  decided_at: string;
}
export interface GEDDocument {
  content_json: DocumentContent | null;
  content_schema_version: number;
  content_revision: number;
  content_origin: 'native' | 'legacy_html' | 'legacy_pending';
  content_pdf_path: string | null;
  content_synced_version: number | null;
  deleted_at: string | null;
  step_id: string | null;
  approver_ids: string[];
  version: number;
  content_html: string | null;
  id: string;
  code: string | null;
  legacy_code: string | null;
  title: string;
  type_id: string | null;
  process_id: string | null;
  drive_link: string | null;
  status: DocumentStatus;
  owner_id: string | null;
  print_allowed: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentWorkflow {
  version: number;
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
  justification: string | null;
  due_date: string | null;
  document_version: number | null;
  decision_reason: string | null;
  approved_by: string | null;
  emailed_at: string | null;
  id: string;
  document_id: string;
  user_id: string | null;
  request_date: string;
  delivery_date: string | null;
  return_date: string | null;
  status: CopyStatus;
  created_at: string;
}

export type RiskStatus = GeneratedDatabase['public']['Tables']['risks']['Row']['status'];
export type RiskStatusOption = GeneratedDatabase['public']['Tables']['risk_statuses']['Row'];
export type RiskLevel = NonNullable<
  GeneratedDatabase['public']['Tables']['risks']['Row']['risk_level']
>;
export type RiskType = GeneratedDatabase['public']['Tables']['risks']['Row']['risk_type'];
export type RiskTypeOption = GeneratedDatabase['public']['Tables']['risk_types']['Row'];
export type RiskApprovalState = 'draft' | 'pending' | 'approved' | 'rejected';

export interface RiskHistory {
  id: string;
  audit_id: string | null;
  risk_id: string;
  entity: 'risk' | 'factor' | 'action' | 'plan';
  entity_id: string;
  action:
    | 'baseline'
    | 'created'
    | 'updated'
    | 'deactivated'
    | 'reactivated'
    | 'submitted'
    | 'approved'
    | 'rejected'
    | 'added'
    | 'removed';
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  changed_by: string | null;
  changed_by_name: string | null;
  justification: string | null;
  changed_at: string;
}

export interface RiskMatrixClassification {
  min_score: number;
  max_score: number;
  label: string;
  background_color: string;
  text_color: string;
}

export type RiskMatrixClassificationInput = Omit<RiskMatrixClassification, 'min_score'>;

export interface Risk {
  id: string;
  code: string;
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
  owner_id: string | null;
  custom_fields: Record<string, unknown> | null;
  approval_state: RiskApprovalState;
  submitted_at: string | null;
  submitted_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  is_active: boolean;
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

export type PreventiveActionStatus =
  GeneratedDatabase['public']['Tables']['risk_preventive_actions']['Row']['status'];
export type RiskPreventiveActionStatusOption =
  GeneratedDatabase['public']['Tables']['risk_preventive_action_statuses']['Row'];

export interface RiskPreventiveAction {
  id: string;
  risk_id: string;
  factor_id: string | null;
  description: string;
  responsible: string | null;
  status: PreventiveActionStatus;
  created_at: string;
}

export type ContingencyPlanStatus =
  GeneratedDatabase['public']['Tables']['risk_contingency_plans']['Row']['status'];
export type RiskContingencyPlanStatusOption =
  GeneratedDatabase['public']['Tables']['risk_contingency_plan_statuses']['Row'];

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
export type SlaStatus = GeneratedDatabase['public']['Tables']['slas']['Row']['status'];
export type SlaStatusOption = GeneratedDatabase['public']['Tables']['sla_statuses']['Row'];
export type SlaCriticality = GeneratedDatabase['public']['Enums']['sla_criticality_level'];

export interface SLA {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  business_rules: string | null;
  supplier_process_id: string | null;
  client_process_id: string | null;
  sipoc_input_id: string | null;
  lead_time_hours: number;
  quality_criteria: string | null;
  criticality: SlaCriticality | null;
  status: SlaStatus;
  approval_state: 'draft' | 'pending' | 'approved' | 'rejected' | 'legacy';
  approval_revision: number;
  submitted_at: string | null;
  approved_at: string | null;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Incident configuration — severity and analysis tools
// =====================================================
export type IncidentSeverity = TicketSeverity;
export type IncidentSeverityOption =
  GeneratedDatabase['public']['Tables']['notification_severities']['Row'];
export type AnalysisTool = GeneratedDatabase['public']['Tables']['analysis_tools']['Row']['key'];
export type AnalysisToolOption = GeneratedDatabase['public']['Tables']['analysis_tools']['Row'];

// =====================================================
// Incident Classifications — form template + treatment rules
// =====================================================
export interface IncidentClassification {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  default_severity: IncidentSeverity;
  sla_hours: number | null;
  analysis_tool: AnalysisTool;
  requires_root_cause: boolean;
  form_schema: FormFieldSchema[] | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Incident Types — specific named incidents within a classification
// =====================================================
export interface IncidentType {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  classification_id: string | null;
  default_severity: IncidentSeverity;
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

export type FormFieldType = GeneratedDatabase['public']['Tables']['form_field_types']['Row']['key'];
export type FormFieldTypeOption = GeneratedDatabase['public']['Tables']['form_field_types']['Row'];

export interface FormFieldSchema {
  name: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: string[];
}
