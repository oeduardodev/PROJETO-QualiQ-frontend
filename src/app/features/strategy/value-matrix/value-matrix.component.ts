import { errorMessage } from '@shared/utils/error.utils';
import { ProcessService } from '@features/processes/data-access/process.service';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import type { Process, ValueChainCategory } from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { MethodologyComponent } from '@shared/components/methodology/methodology.component';
import { METHODOLOGIES } from '@shared/data/methodologies';

interface CategoryLane extends ValueChainCategory {
  processes: Process[];
}
@Component({
  selector: 'app-value-matrix',
  standalone: true,
  imports: [IconDirective, MethodologyComponent],
  templateUrl: './value-matrix.component.html',
  styleUrl: './value-matrix.component.scss',
})
export class ValueMatrixComponent {
  private readonly processService = inject(ProcessService);
  readonly auth = inject(AuthService);
  readonly methodology = METHODOLOGIES['valor'];
  readonly methodologyOpen = signal(false);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly categories = signal<CategoryLane[]>([]);
  readonly total = computed(() =>
    this.categories().reduce((sum, item) => sum + item.processes.length, 0),
  );

  constructor() {
    void this.loadValueMatrix();
  }

  async loadValueMatrix(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [categories, processes] = await Promise.all([
        this.processService.fetchCategories(),
        this.processService.fetchProcesses(),
      ]);
      this.categories.set(
        categories.map((category) => ({
          ...category,
          processes: processes.filter((process) => process.category_id === category.id),
        })),
      );
    } catch (error) {
      this.error.set(errorMessage(error, 'Erro ao carregar dados'));
    } finally {
      this.loading.set(false);
    }
  }

  laneClass(color: string): string {
    return color === 'green'
      ? 'bg-emerald-50/40 border-emerald-200/60'
      : color === 'orange'
        ? 'bg-orange-50/40 border-orange-200/60'
        : 'bg-blue-50/40 border-blue-200/60';
  }

  dotClass(color: string): string {
    return color === 'green'
      ? 'bg-emerald-500'
      : color === 'orange'
        ? 'bg-orange-500'
        : 'bg-blue-500';
  }

  labelClass(color: string): string {
    return color === 'green'
      ? 'text-emerald-700'
      : color === 'orange'
        ? 'text-orange-700'
        : 'text-blue-700';
  }
}
