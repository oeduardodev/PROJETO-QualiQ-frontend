import { inject, Injectable } from '@angular/core';
import { IncidentRepository } from './incident.repository';
import type {
  AnalysisToolOption,
  IncidentClassification,
  IncidentSeverityOption,
  IncidentType,
} from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class IncidentService {
  private readonly repository = inject(IncidentRepository);

  fetchAnalysisTools(): Promise<AnalysisToolOption[]> {
    return this.repository.fetchAnalysisTools();
  }

  fetchIncidentSeverities(): Promise<IncidentSeverityOption[]> {
    return this.repository.fetchIncidentSeverities();
  }

  fetchIncidentClassifications(): Promise<IncidentClassification[]> {
    return this.repository.fetchIncidentClassifications();
  }

  createIncidentClassification(
    input: Partial<Omit<IncidentClassification, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<IncidentClassification> {
    return this.repository.createIncidentClassification(input);
  }

  updateIncidentClassification(
    id: string,
    patch: Partial<Omit<IncidentClassification, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<IncidentClassification> {
    return this.repository.updateIncidentClassification(id, patch);
  }

  deleteIncidentClassification(id: string): Promise<void> {
    return this.repository.deleteIncidentClassification(id);
  }

  fetchIncidentTypes(): Promise<IncidentType[]> {
    return this.repository.fetchIncidentTypes();
  }

  createIncidentType(
    input: Partial<Omit<IncidentType, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<IncidentType> {
    return this.repository.createIncidentType(input);
  }

  updateIncidentType(
    id: string,
    patch: Partial<Omit<IncidentType, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<IncidentType> {
    return this.repository.updateIncidentType(id, patch);
  }

  deleteIncidentType(id: string): Promise<void> {
    return this.repository.deleteIncidentType(id);
  }
}
