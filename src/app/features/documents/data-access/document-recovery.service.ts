import { Injectable } from '@angular/core';
import type { DocumentBody } from '@core/models/document-content';
import type { DocumentFormValue } from './document.mapper';

export interface DocumentRecovery {
  body: DocumentBody;
  form: DocumentFormValue;
  baseUpdatedAt: string | null;
  savedAt: string;
}

/** Per-user, local crash recovery. The canonical document always lives in Supabase. */
@Injectable({ providedIn: 'root' })
export class DocumentRecoveryService {
  private database?: Promise<IDBDatabase>;
  private queue: Promise<unknown> = Promise.resolve();

  private db(): Promise<IDBDatabase> {
    return (this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('orbis-document-recovery', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('drafts');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));
  }

  async read(key: string): Promise<DocumentRecovery | undefined> {
    await this.queue.catch(() => undefined);
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const request = db.transaction('drafts').objectStore('drafts').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  write(key: string, value?: DocumentRecovery): Promise<void> {
    const operation = this.queue
      .catch(() => undefined)
      .then(async () => {
        const db = await this.db();
        return new Promise<void>((resolve, reject) => {
          const transaction = db.transaction('drafts', 'readwrite');
          const store = transaction.objectStore('drafts');
          if (value) store.put(value, key);
          else store.delete(key);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        });
      });
    this.queue = operation;
    return operation;
  }
}
