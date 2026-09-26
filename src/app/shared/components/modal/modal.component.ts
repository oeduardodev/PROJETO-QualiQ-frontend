import { Component, input, output } from '@angular/core';
import { IconDirective } from '../icon/icon.directive';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [IconDirective],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class ModalComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly width = input('max-w-3xl');
  readonly closed = output<void>();
}
