import { Component, inject } from '@angular/core';
import { IconDirective } from '../icon/icon.directive';
import { ToastService } from '@shared/services/toast.service';

@Component({
  selector: 'app-toast-outlet',
  standalone: true,
  imports: [IconDirective],
  templateUrl: './toast-outlet.component.html',
  styleUrl: './toast-outlet.component.scss',
})
export class ToastOutletComponent {
  readonly service = inject(ToastService);
}
