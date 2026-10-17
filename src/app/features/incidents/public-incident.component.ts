import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IncidentTicketService } from './data-access/incident-ticket.service';
import { validateAnswers } from './incident-form.utils';
import { errorMessage } from '@shared/utils/error.utils';
import type { FormFieldSchema } from '@core/models/database';

@Component({
  selector: 'app-public-incident',
  imports: [ReactiveFormsModule],
  host: { class: 'ui-standard-fields' },
  template: `
    <main class="min-h-screen bg-slate-50 p-5 sm:p-10">
      <section class="mx-auto max-w-2xl rounded-xl border bg-white p-6 space-y-5">
        <h1 class="text-2xl font-semibold">Registrar incidente</h1>
        @if (error()) {
          <p role="alert" class="text-sm text-rose-600">{{ error() }}</p>
        }
        @if (receipt()) {
          <p role="status">
            Incidente recebido. Guarde o protocolo: <strong>{{ receipt() }}</strong>
          </p>
        } @else if (definition(); as d) {
          <p class="text-sm text-slate-500">{{ d.classification }} · {{ d.process }}</p>
          <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
            <label class="ui-form-label"
              >Tipo *<select formControlName="notification_type_id">
                <option value="">Selecionar...</option>
                @for (t of d.types; track t.id) {
                  <option [value]="t.id">{{ t.name }}</option>
                }
              </select></label
            >
            <label class="ui-form-label"
              >Título *<input formControlName="title" maxlength="200"
            /></label>
            <label class="ui-form-label"
              >Descrição<textarea
                rows="4"
                formControlName="description"
                maxlength="10000"
              ></textarea>
            </label>
            @for (f of d.schema; track f.name) {
              <div class="ui-form-label">
                <label [for]="'public-field-' + f.name"
                  >{{ f.label }}{{ f.required ? ' *' : '' }}</label
                >
                @if (f.type === 'select') {
                  <select [id]="'public-field-' + f.name" [formControl]="control(f.name)">
                    <option value="">Selecionar...</option>
                    @for (o of f.options || []; track o) {
                      <option [value]="o">{{ o }}</option>
                    }
                  </select>
                } @else {
                  <input
                    [id]="'public-field-' + f.name"
                    [type]="f.type"
                    [formControl]="control(f.name)"
                  />
                }
              </div>
            }
            <button class="ui-button-primary" type="submit" [disabled]="saving()">
              Enviar incidente
            </button>
          </form>
        } @else if (!error()) {
          <p>Carregando formulário...</p>
        }
      </section>
    </main>
  `,
})
export class PublicIncidentComponent {
  private readonly service = inject(IncidentTicketService);
  private readonly token = window.location.pathname.split('/')[2] ?? '';
  readonly definition = signal<{
    classification: string;
    process: string;
    schema: FormFieldSchema[];
    types: { id: string; name: string }[];
  } | null>(null);
  readonly error = signal<string | null>(null);
  readonly receipt = signal('');
  readonly saving = signal(false);
  readonly controls = new Map<string, FormControl<string | number>>();
  readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    description: new FormControl('', { nonNullable: true }),
    notification_type_id: new FormControl('', {
      nonNullable: true,
      validators: Validators.required,
    }),
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.definition.set(await this.service.publicForm(this.token));
    } catch (e) {
      this.error.set(errorMessage(e, 'Link inválido ou expirado.'));
    }
  }

  control(name: string): FormControl<string | number> {
    if (!this.controls.has(name))
      this.controls.set(name, new FormControl<string | number>('', { nonNullable: true }));
    return this.controls.get(name)!;
  }

  async submit(): Promise<void> {
    if (this.saving()) return;
    const answers = Object.fromEntries([...this.controls].map(([k, v]) => [k, v.value]));
    const invalid = validateAnswers(this.definition()?.schema ?? [], answers);
    if (this.form.invalid || invalid) {
      this.error.set(invalid ?? 'Preencha o título e o tipo.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      this.receipt.set(
        await this.service.submitPublic(this.token, {
          ...this.form.getRawValue(),
          custom_fields: answers,
        }),
      );
    } catch (e) {
      this.error.set(errorMessage(e, 'Não foi possível registrar o incidente.'));
    } finally {
      this.saving.set(false);
    }
  }
}
