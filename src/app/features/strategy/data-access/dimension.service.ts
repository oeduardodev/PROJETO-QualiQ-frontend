import { inject, Injectable } from '@angular/core';
import { DimensionRepository } from './dimension.repository';
import type {
  Dimension,
  DimensionItemType,
  DimensionLink,
  DimensionVersion,
} from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class DimensionService {
  private readonly repository = inject(DimensionRepository);

  fetchVersions(): Promise<DimensionVersion[]> {
    return this.repository.fetchVersions();
  }

  createVersion(label: string): Promise<DimensionVersion> {
    return this.repository.createVersion(label);
  }

  saveWithLinks(input: Parameters<DimensionRepository['saveWithLinks']>[0]): Promise<Dimension> {
    return this.repository.saveWithLinks(input);
  }

  fetchDimensions(versionId?: string): Promise<Dimension[]> {
    return this.repository.fetchDimensions(versionId);
  }

  async fetchCurrentData(): Promise<{ dimensions: Dimension[]; links: DimensionLink[] }> {
    const versionId = (await this.fetchVersions())[0]?.id;
    if (!versionId) return { dimensions: [], links: [] };
    const [dimensions, links] = await Promise.all([
      this.fetchDimensions(versionId),
      this.fetchAllDimensionLinks(versionId),
    ]);
    return { dimensions, links };
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

  fetchAllDimensionLinks(versionId?: string): Promise<DimensionLink[]> {
    return this.repository.fetchAllDimensionLinks(versionId);
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
