import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { AccessibilityService } from '@core/services/accessibility.service';

@Component({
  selector: 'app-accessibility-tools',
  standalone: true,
  templateUrl: './accessibility-tools.component.html',
  styleUrl: './accessibility-tools.component.scss',
  host: { '(document:keydown.escape)': 'close()' },
})
export class AccessibilityToolsComponent {
  readonly accessibility = inject(AccessibilityService);
  readonly open = signal(false);

  @ViewChild('trigger') trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('firstOption') firstOption?: ElementRef<HTMLButtonElement>;

  toggle(): void {
    if (this.open()) this.close();
    else {
      this.open.set(true);
      queueMicrotask(() => this.firstOption?.nativeElement.focus());
    }
  }

  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    queueMicrotask(() => this.trigger?.nativeElement.focus());
  }
}
