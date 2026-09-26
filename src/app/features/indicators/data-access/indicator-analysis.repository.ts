import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { Indicator, Process, Ticket } from '@core/models/database';
import type { IndicatorAnalysis } from './indicator-analysis.model';

@Injectable({ providedIn: 'root' })
export class IndicatorAnalysisRepository {
  private readonly client = inject(SupabaseService).client;

  async generate(
    indicator: Indicator,
    process: Process | null,
    tickets: Ticket[],
  ): Promise<IndicatorAnalysis | null> {
    const { data, error } = await this.client.functions.invoke<IndicatorAnalysis>('ai-analysis', {
      body: { indicator, process, tickets },
    });
    if (error) throw error;
    return data;
  }
}
