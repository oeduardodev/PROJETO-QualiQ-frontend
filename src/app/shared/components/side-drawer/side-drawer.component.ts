import {
  Component,
  ElementRef,
  input,
  OnChanges,
  OnDestroy,
  output,
  signal,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { IconDirective } from '../icon/icon.directive';
import { trapTabKey } from '@shared/utils/focus-trap.utils';

const CLOSE_ANIMATION_MS = 260;

@Component({
  selector: 'app-side-drawer',
  standalone: true,
  imports: [IconDirective],
  templateUrl: './side-drawer.component.html',
  styleUrl: './side-drawer.component.scss',
  host: {
    '(document:keydown.escape)': 'requestClose()',
    '(document:keydown.tab)': 'onTab($event)',
  },
})
export class SideDrawerComponent implements OnChanges, OnDestroy {
  readonly open = input(false);
  readonly title = input('');
  readonly subtitle = input('');
  readonly width = input('max-w-lg');
  readonly closed = output<void>();
  readonly rendered = signal(false);
  readonly closing = signal(false);
  @ViewChild('panel') panel?: ElementRef<HTMLElement>;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private previousFocus: HTMLElement | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open']) return;

    if (this.open()) {
      this.previousFocus =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.clearCloseTimer();
      this.closing.set(false);
      this.rendered.set(true);
      queueMicrotask(() => {
        if (this.open()) this.panel?.nativeElement.focus();
      });
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
        this.restoreFocus();
      }, duration);
    }
  }

  ngOnDestroy(): void {
    this.clearCloseTimer();
    this.restoreFocus();
  }

  requestClose(): void {
    if (this.open()) this.closed.emit();
  }

  onTab(event: Event): void {
    if (event instanceof KeyboardEvent && this.open() && this.panel)
      trapTabKey(event, this.panel.nativeElement);
  }

  private restoreFocus(): void {
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
    this.previousFocus = null;
  }

  private clearCloseTimer(): void {
    if (this.closeTimer === null) return;
    clearTimeout(this.closeTimer);
    this.closeTimer = null;
  }
}
