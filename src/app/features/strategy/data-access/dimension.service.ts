import { inject, Injectable } from '@angular/core';
import { DimensionRepository } from './dimension.repository';
import type { Dimension, DimensionItemType, DimensionLink } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class DimensionService {
  private readonly repository = inject(DimensionRepository);

  fetchDimensions(): Promise<Dimension[]> {
    return this.repository.fetchDimensions();
  }

  createDimension(
    input: Partial<Omit<Dimension, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Dimension> {
    return this.repository.createDimension(input);
  }

  updateDimension(
    id: string,
    patch: Partial<Omit<Dimension, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Dimension> {
    return this.repository.updateDimension(id, patch);
  }

  deleteDimension(id: string): Promise<void> {
    return this.repository.deleteDimension(id);
  }

  fetchDimensionLinks(dimensionId: string): Promise<DimensionLink[]> {
    return this.repository.fetchDimensionLinks(dimensionId);
  }

  fetchAllDimensionLinks(): Promise<DimensionLink[]> {
    return this.repository.fetchAllDimensionLinks();
  }

  createDimensionLink(input: {
    dimension_id: string;
    item_type: DimensionItemType;
    item_id: string;
    process_id: string;
  }): Promise<void> {
    return this.repository.createDimensionLink(input);
  }

  deleteDimensionLink(
    dimensionId: string,
    itemType: DimensionItemType,
    itemId: string,
  ): Promise<void> {
    return this.repository.deleteDimensionLink(dimensionId, itemType, itemId);
  }
}
