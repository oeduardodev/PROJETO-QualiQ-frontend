import { inject, Injectable } from '@angular/core';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type { Process } from '@core/models/database';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { Audit, AuditItem, AuditKind, AuditRiskImpact, AuditTemplate } from './audit.models';

@Injectable({ providedIn: 'root' })
export class AuditRepository {
  private readonly client = inject(SupabaseService).client;

  listTemplates(): Promise<AuditTemplate[]> {
    return fetchAllPages((from, to) =>
      this.client.from('audit_templates').select('*').order('kind').range(from, to),
    );
  }

  listAudits(): Promise<Audit[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('audits')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  listItems(): Promise<AuditItem[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('audit_items')
        .select('*')
        .order('audit_id')
        .order('subject_label')
        .order('criterion')
        .order('id')
        .range(from, to),
    );
  }

  listImpacts(): Promise<AuditRiskImpact[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('audit_risk_impacts')
        .select('*')
        .order('applied_at', { ascending: false })
        .range(from, to),
    );
  }

  listProcesses(): Promise<Process[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('processes')
        .select('*')
        .eq('obsolete', false)
        .order('title')
        .order('id')
        .range(from, to),
    );
  }

  async saveTemplate(template: AuditTemplate, checks: string[]): Promise<AuditTemplate> {
    const { data, error } = await this.client
      .from('audit_templates')
      .update({
        title: template.title.trim(),
        checks,
        auto_apply_risk: template.kind === 'risk' && template.auto_apply_risk,
      })
      .eq('id', template.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async create(
    kind: AuditKind,
    title: string,
    processId: string | null,
    checks: string[],
    autoApplyRisk: boolean,
  ): Promise<Audit> {
    const { data, error } = await this.client.rpc('create_audit', {
      p_kind: kind,
      p_title: title,
      p_process_id: processId,
      p_checks: checks,
      p_auto_apply_risk: autoApplyRisk,
    });
    if (error) throw error;
    return data;
  }

  async saveItem(item: AuditItem): Promise<AuditItem> {
    const { data, error } = await this.client.rpc('save_audit_item', {
      p_id: item.id,
      p_result: item.result,
      p_evidence: item.evidence,
      p_improvement: item.improvement,
      p_action_proposal: item.action_proposal,
      p_notification_proposal: item.notification_proposal,
    });
    if (error) throw error;
    return data;
  }

  async complete(id: string, summary: string): Promise<Audit> {
    const { data, error } = await this.client.rpc('complete_audit', {
      p_id: id,
      p_summary: summary,
    });
    if (error) throw error;
    return data;
  }
}
