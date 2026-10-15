import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, ElementRef, inject, ViewChild } from '@angular/core';
import { AlertDialogService } from '@shared/services/alert-dialog.service';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { ModalComponent } from '@shared/components/modal/modal.component';

@Component({
  selector: 'app-alert-dialog-outlet',
  standalone: true,
  imports: [IconDirective, ModalComponent],
  templateUrl: './alert-dialog-outlet.component.html',
})
export class AlertDialogOutletComponent {
  readonly dialog = inject(AlertDialogService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private previousFocus: HTMLElement | null = null;

  @ViewChild('cancelButton')
  set cancelButton(button: ElementRef<HTMLButtonElement> | undefined) {
    if (button) {
      const active = this.document.activeElement;
      this.previousFocus = active instanceof HTMLElement ? active : null;
      queueMicrotask(() => {
        if (this.dialog.current() && button.nativeElement.isConnected) button.nativeElement.focus();
      });
    } else {
      const previous = this.previousFocus;
      this.previousFocus = null;
      queueMicrotask(() => {
        if (previous?.isConnected) previous.focus();
      });
    }
  }

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.dialog.current()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.dialog.answer(false);
  };

  constructor() {
    this.document.addEventListener('keydown', this.onKeydown, true);
    this.destroyRef.onDestroy(() =>
      this.document.removeEventListener('keydown', this.onKeydown, true),
    );
  }
}
