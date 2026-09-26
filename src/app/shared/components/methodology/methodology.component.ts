import { Component, input, output } from '@angular/core';
import { IconDirective } from '../icon/icon.directive';
import { ModalComponent } from '../modal/modal.component';
import type { MethodologyInfo } from '@shared/data/methodologies';

@Component({
  selector: 'app-methodology',
  standalone: true,
  imports: [IconDirective, ModalComponent],
  templateUrl: './methodology.component.html',
  styleUrl: './methodology.component.scss',
})
export class MethodologyComponent {
  readonly open = input(false);
  readonly info = input.required<MethodologyInfo>();
  readonly closed = output<void>();
}
