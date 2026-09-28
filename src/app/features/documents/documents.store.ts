import { errorMessage } from '@shared/utils/error.utils';
import { DocumentService } from '@features/documents/data-access/document.service';
import { ProcessService } from '@features/processes/data-access/process.service';
import { computed, Injectable, signal, inject } from '@angular/core';
import type {
  ControlledCopy,
  DocumentType,
  GEDDocument,
  Process,
  Profile,
} from '@core/models/database';
import { ProfileService } from '@core/services/profile.service';

@Injectable()
export class DocumentsStore {
  private readonly documentService = inject(DocumentService);
  private readonly processService = inject(ProcessService);
  private readonly profileService = inject(ProfileService);
  readonly types = signal<DocumentType[]>([]);
  readonly documents = signal<GEDDocument[]>([]);
  readonly processes = signal<Process[]>([]);
  readonly profiles = signal<Profile[]>([]);
  readonly copies = signal<ControlledCopy[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly published = computed(() =>
    this.documents().filter((document) => document.status === 'publicado'),
  );
  readonly pendingCopies = computed(
    () => this.copies().filter((copy) => copy.status === 'solicitada').length,
  );
  private initialized = false;

  async load(force = false): Promise<void> {
    if (this.initialized && !force) return;
    this.initialized = true;
    this.loading.set(true);
    this.error.set(null);
    try {
      const [types, documents, processes, copies, profiles] = await Promise.all([
        this.documentService.fetchDocumentTypes(),
        this.documentService.fetchDocuments(),
        this.processService.fetchProcesses(),
        this.documentService.fetchControlledCopies(),
        this.profileService.findAll(),
      ]);
      this.types.set(types);
      this.documents.set(documents);
      this.processes.set(processes);
      this.copies.set(copies);
      this.profiles.set(profiles);
    } catch (e) {
      this.error.set(errorMessage(e, 'Erro ao carregar documentos'));
    } finally {
      this.loading.set(false);
    }
  }

  processName(id: string | null): string {
    return this.processes().find((item) => item.id === id)?.title ?? '—';
  }

  typeName(id: string | null): string {
    return this.types().find((item) => item.id === id)?.name ?? 'Sem tipo';
  }

  profileName(id: string | null): string {
    return this.profiles().find((item) => item.id === id)?.name ?? '—';
  }
}
