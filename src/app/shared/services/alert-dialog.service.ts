import { Injectable, signal } from '@angular/core';

export interface AlertDialogRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

@Injectable({ providedIn: 'root' })
export class AlertDialogService {
  private readonly currentState = signal<AlertDialogRequest | null>(null);
  readonly current = this.currentState.asReadonly();
  private resolveCurrent: ((confirmed: boolean) => void) | null = null;

  confirm(message: string, title = 'Confirmar exclusão'): Promise<boolean> {
    if (this.currentState()) return Promise.resolve(false);

    return new Promise((resolve) => {
      this.resolveCurrent = resolve;
      this.currentState.set({
        title,
        message,
        confirmLabel: 'Excluir',
        cancelLabel: 'Cancelar',
      });
    });
  }

  answer(confirmed: boolean): void {
    const resolve = this.resolveCurrent;
    if (!resolve) return;
    this.resolveCurrent = null;
    this.currentState.set(null);
    resolve(confirmed);
  }
}
