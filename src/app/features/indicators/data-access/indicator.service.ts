import { inject, Injectable } from '@angular/core';
import { IndicatorRepository } from './indicator.repository';
import { IndicatorAnalysisRepository } from './indicator-analysis.repository';
import type { IndicatorAnalysis } from './indicator-analysis.model';
import type { Process, Ticket } from '@core/models/database';
import type { Indicator, IndicatorHistoryEntry } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class IndicatorService {
  private readonly analysisRepository = inject(IndicatorAnalysisRepository);
  private readonly repository = inject(IndicatorRepository);

  recordValue(indicator: Indicator, period: string, value: number): Promise<Indicator> {
    return this.repository.recordValue(indicator.id, period, value);
  }

  generateAnalysis(
    indicator: Indicator,
    process: Process | null,
    tickets: Ticket[],
  ): Promise<IndicatorAnalysis | null> {
    return this.analysisRepository.generate(indicator, process, tickets);
  }

  async fetchHistories(indicators: Indicator[]): Promise<Record<string, IndicatorHistoryEntry[]>> {
    const entries = await Promise.all(
      indicators.map((indicator) => this.fetchHistoryEntry(indicator)),
    );
    return Object.fromEntries(entries);
  }

  private async fetchHistoryEntry(
    indicator: Indicator,
  ): Promise<readonly [string, IndicatorHistoryEntry[]]> {
    return [indicator.id, await this.repository.fetchIndicatorHistory(indicator.id)];
  }

  fetchIndicators(): Promise<Indicator[]> {
    return this.repository.fetchIndicators();
  }

  createIndicator(
    input: Partial<Omit<Indicator, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Indicator> {
    return this.repository.createIndicator(input);
  }

  updateIndicator(
    id: string,
    patch: Partial<Omit<Indicator, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Indicator> {
    return this.repository.updateIndicator(id, patch);
  }

  deleteIndicator(id: string): Promise<void> {
    return this.repository.deleteIndicator(id);
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
