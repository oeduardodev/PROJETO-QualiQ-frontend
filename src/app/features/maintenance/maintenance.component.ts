import { Component, inject } from '@angular/core';
import { MaintenanceService } from '@core/services/maintenance.service';
import { IconDirective } from '@shared/components/icon/icon.directive';

@Component({
  selector: 'app-maintenance',
  imports: [IconDirective],
  templateUrl: './maintenance.component.html',
  styleUrl: './maintenance.component.scss',
})
export class MaintenanceComponent {
  readonly maintenance = inject(MaintenanceService);
  readonly year = new Date().getFullYear();

  checkAvailability(): void {
    void this.maintenance.refresh();
  }
}
