import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@shared/services/toast.service';
import { errorMessage } from '@shared/utils/error.utils';
import { ActionPlanService } from './data-access/action-plan.service';
import type { IntelligentPlanSuggestion } from './data-access/intelligent-plan.model';

@Component({
  selector: 'app-intelligent-plans',
  imports: [RouterLink],
  templateUrl: './intelligent-plans.component.html',
  host: { class: 'ui-standard-fields' },
})
export class IntelligentPlansComponent {
  private readonly service = inject(ActionPlanService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly generating = signal(false);
  readonly generated = signal(false);
  readonly suggestions = signal<IntelligentPlanSuggestion[]>([]);
  readonly sourcesAnalyzed = signal(0);
  readonly error = signal<string | null>(null);
  readonly importing = signal<number | null>(null);
  readonly imported = signal<Record<number, string>>({});

  canGenerate(): boolean {
    return (
      this.auth.canEditPage('planos-acao') &&
      (this.auth.role() === 'admin' || this.auth.role() === 'gestor')
    );
  }

  sourceTypeLabel(type: IntelligentPlanSuggestion['source_type']): string {
    return {
      indicator: 'Indicador',
      risk: 'Risco',
      incident: 'Incidente',
      audit: 'Auditoria',
    }[type];
  }

  async generate(): Promise<void> {
    if (!this.canGenerate() || this.generating() || this.importing() !== null) return;
    this.generating.set(true);
    this.error.set(null);
    try {
      const result = await this.service.generateIntelligentPlans();
      this.suggestions.set(result.suggestions);
      this.sourcesAnalyzed.set(result.sources_analyzed);
      this.imported.set({});
      this.generated.set(true);
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível gerar sugestões.'));
    } finally {
      this.generating.set(false);
    }
  }

  async importPlan(suggestion: IntelligentPlanSuggestion, index: number): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!this.canGenerate() || !userId || this.importing() !== null || this.imported()[index])
      return;
    this.importing.set(index);
    try {
      const plan = await this.service.importIntelligentPlan(suggestion, userId);
      this.imported.update((items) => ({ ...items, [index]: plan.id }));
      this.toast.success('Plano importado para a Central de Planos de Ação.');
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível importar o plano.'));
    } finally {
      this.importing.set(null);
    }
  }
}
