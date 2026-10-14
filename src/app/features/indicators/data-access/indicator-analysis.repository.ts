import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { Indicator, Process, Ticket } from '@core/models/database';
import type { IndicatorAnalysis, IndicatorObservationContext } from './indicator-analysis.model';

@Injectable({ providedIn: 'root' })
export class IndicatorAnalysisRepository {
  private readonly client = inject(SupabaseService).client;

  async generate(
    indicator: Indicator,
    process: Process | null,
    tickets: Ticket[],
    observation?: IndicatorObservationContext,
  ): Promise<IndicatorAnalysis | null> {
    const { data, error } = await this.client.functions.invoke<IndicatorAnalysis>('ai-analysis', {
      body: { indicator, process, tickets, observation },
    });
    if (error) throw error;
    return data;
  }
}
