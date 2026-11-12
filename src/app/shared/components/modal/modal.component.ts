import {
  Component,
  ElementRef,
  input,
  OnChanges,
  OnDestroy,
  output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { IconDirective } from '../icon/icon.directive';
import { trapTabKey } from '@shared/utils/focus-trap.utils';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [IconDirective],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
  host: {
    '(document:keydown.escape)': 'requestClose()',
    '(document:keydown.tab)': 'onTab($event)',
  },
})
export class ModalComponent implements OnChanges, OnDestroy {
  readonly open = input(false);
  readonly title = input('');
  readonly width = input('max-w-3xl');
  readonly closed = output<void>();
  @ViewChild('panel') panel?: ElementRef<HTMLElement>;
  private previousFocus: HTMLElement | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open']) return;
    if (this.open()) {
      this.previousFocus =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      queueMicrotask(() => {
        const panel = this.panel?.nativeElement;
        if (!this.open() || !panel) return;
        (panel.querySelector<HTMLElement>('[data-autofocus]') ?? panel).focus();
      });
    } else {
      queueMicrotask(() => this.restoreFocus());
    }
  }

  ngOnDestroy(): void {
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
}
