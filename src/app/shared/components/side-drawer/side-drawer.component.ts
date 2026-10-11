import {
  Component,
  input,
  OnChanges,
  OnDestroy,
  output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { IconDirective } from '../icon/icon.directive';

const CLOSE_ANIMATION_MS = 260;

@Component({
  selector: 'app-side-drawer',
  standalone: true,
  imports: [IconDirective],
  templateUrl: './side-drawer.component.html',
  styleUrl: './side-drawer.component.scss',
  host: { '(document:keydown.escape)': 'requestClose()' },
})
export class SideDrawerComponent implements OnChanges, OnDestroy {
  readonly open = input(false);
  readonly title = input('');
  readonly subtitle = input('');
  readonly width = input('max-w-lg');
  readonly closed = output<void>();
  readonly rendered = signal(false);
  readonly closing = signal(false);
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open']) return;

    if (this.open()) {
      this.clearCloseTimer();
      this.closing.set(false);
      this.rendered.set(true);
    } else if (this.rendered()) {
      this.closing.set(true);
      const reducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const duration = reducedMotion ? 0 : CLOSE_ANIMATION_MS;
      this.closeTimer = setTimeout(() => {
        this.rendered.set(false);
        this.closing.set(false);
        this.closeTimer = null;
      }, duration);
    }
  }

  ngOnDestroy(): void {
    this.clearCloseTimer();
  }

  requestClose(): void {
    if (this.open()) this.closed.emit();
  }

  private clearCloseTimer(): void {
    if (this.closeTimer === null) return;
    clearTimeout(this.closeTimer);
    this.closeTimer = null;
  }
}
