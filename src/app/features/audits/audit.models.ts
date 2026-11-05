export type AuditKind = 'risk' | 'indicator' | 'document' | 'custom';
export type AuditResult = 'pending' | 'conform' | 'partial' | 'nonconform';

export interface AuditTemplate {
  id: string;
  establishment_id: string;
  kind: AuditKind;
  title: string;
  checks: string[];
  auto_apply_risk: boolean;
  updated_at: string;
}

export interface Audit {
  id: string;
  establishment_id: string;
  kind: AuditKind;
  title: string;
  process_id: string | null;
  status: 'open' | 'completed';
  auto_apply_risk: boolean;
  summary: string;
  created_by: string | null;
  created_at: string;
  completed_by: string | null;
  completed_at: string | null;
}

export interface AuditItem {
  id: string;
  establishment_id: string;
  audit_id: string;
  subject_type: AuditKind;
  risk_id: string | null;
  indicator_id: string | null;
  document_id: string | null;
  subject_label: string;
  criterion: string;
  barrier_snapshot: string | null;
  result: AuditResult;
  evidence: string;
  improvement: string;
  action_proposal: string;
  notification_proposal: string;
  updated_at: string;
}

export interface AuditRiskImpact {
  audit_id: string;
  risk_id: string;
  establishment_id: string;
  old_probability: number;
  new_probability: number;
  applied_at: string;
}
