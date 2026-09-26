import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error';
export interface ToastMessage {
  id: number;
  message: string;
  kind: ToastKind;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly messages = signal<ToastMessage[]>([]);
  private nextId = 0;

  show(message: string, kind: ToastKind = 'success'): void {
    const id = ++this.nextId;
    this.messages.update((items) => [...items, { id, message, kind }]);
    window.setTimeout(() => this.dismiss(id), 3500);
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error');
  }

  dismiss(id: number): void {
    this.messages.update((items) => items.filter((item) => item.id !== id));
  }
}
