import { inject, Injectable } from '@angular/core';
import { IndicatorRepository, type SaveIndicatorDefinitionInput } from './indicator.repository';
import { IndicatorAnalysisRepository } from './indicator-analysis.repository';
import type { IndicatorAnalysis } from './indicator-analysis.model';
import type { IndicatorObservationContext } from './indicator-analysis.model';
import type {
  IndicatorFrequencyOption,
  IndicatorStatusOption,
  IndicatorUnitOption,
} from '@core/models/database';
import type {
  Indicator,
  IndicatorDefinitionHistory,
  IndicatorHistoryEntry,
} from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class IndicatorService {
  private readonly analysisRepository = inject(IndicatorAnalysisRepository);
  private readonly repository = inject(IndicatorRepository);

  fetchResultActors(): Promise<Record<string, string>> {
    return this.repository.fetchResultActors();
  }

  fetchStatusOptions(): Promise<IndicatorStatusOption[]> {
    return this.repository.fetchStatusOptions();
  }

  recordValue(
    indicator: Indicator,
    period: string,
    value: number,
    lateJustification: string,
    analysis: string,
  ): Promise<{ indicator: Indicator; history: IndicatorHistoryEntry }> {
    return this.repository.recordValue(indicator.id, period, value, lateJustification, analysis);
  }

  generateAnalysis(
    indicator: Indicator,
    observation?: IndicatorObservationContext,
  ): Promise<IndicatorAnalysis | null> {
    return this.analysisRepository.generate(indicator, observation);
  }

  async fetchHistories(indicators: Indicator[]): Promise<Record<string, IndicatorHistoryEntry[]>> {
    const grouped = Object.fromEntries(indicators.map((indicator) => [indicator.id, []])) as Record<
      string,
      IndicatorHistoryEntry[]
    >;
    for (const entry of await this.repository.fetchHistories(indicators.map((item) => item.id))) {
      grouped[entry.indicator_id]?.push(entry);
    }
    return grouped;
  }

  fetchIndicators(): Promise<Indicator[]> {
    return this.repository.fetchIndicators();
  }

  saveDefinition(input: SaveIndicatorDefinitionInput): Promise<Indicator> {
    return this.repository.saveDefinition(input);
  }

  fetchDefinitionHistory(indicatorId: string): Promise<IndicatorDefinitionHistory[]> {
    return this.repository.fetchDefinitionHistory(indicatorId);
  }

  fetchUnitOptions(): Promise<IndicatorUnitOption[]> {
    return this.repository.fetchUnitOptions();
  }

  fetchFrequencyOptions(): Promise<IndicatorFrequencyOption[]> {
    return this.repository.fetchFrequencyOptions();
  }

  fetchIndicatorHistory(indicatorId: string): Promise<IndicatorHistoryEntry[]> {
    return this.repository.fetchIndicatorHistory(indicatorId);
  }

  fetchIndicatorsByProcess(processId: string): Promise<Indicator[]> {
    return this.repository.fetchIndicatorsByProcess(processId);
  }

  fetchIndicatorsByStep(stepId: string): Promise<Indicator[]> {
    return this.repository.fetchIndicatorsByStep(stepId);
  }
}
