import { inject, Injectable } from '@angular/core';
import type { SwotAnalysisInput, SwotItemInput } from './swot.repository';
import { SwotRepository } from '@features/strategy/data-access/swot.repository';
import type { SwotAnalysis, SwotItem } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class SwotService {
  private readonly repository = inject(SwotRepository);

  fetchAnalyses(): Promise<SwotAnalysis[]> {
    return this.repository.fetchAnalyses();
  }

  createAnalysis(input: SwotAnalysisInput): Promise<SwotAnalysis> {
    return this.repository.createAnalysis(input);
  }

  updateAnalysis(id: string, patch: SwotAnalysisInput): Promise<SwotAnalysis> {
    return this.repository.updateAnalysis(id, patch);
  }

  deleteAnalysis(id: string): Promise<void> {
    return this.repository.deleteAnalysis(id);
  }

  fetchItems(analysisId: string): Promise<SwotItem[]> {
    return this.repository.fetchItems(analysisId);
  }

  fetchAllItems(): Promise<SwotItem[]> {
    return this.repository.fetchAllItems();
  }

  createItem(input: SwotItemInput): Promise<SwotItem> {
    return this.repository.createItem(input);
  }

  updateItem(id: string, patch: SwotItemInput): Promise<SwotItem> {
    return this.repository.updateItem(id, patch);
  }

  deleteItem(id: string): Promise<void> {
    return this.repository.deleteItem(id);
  }
}
