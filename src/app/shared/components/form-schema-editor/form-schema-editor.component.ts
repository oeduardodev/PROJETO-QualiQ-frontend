import { Component, input, output } from '@angular/core';
import type { FormFieldSchema } from '@core/models/database';

@Component({
  selector: 'app-form-schema-editor',
  template: `
    <div class="space-y-4">
      @for (field of fields(); track $index; let i = $index) {
        <fieldset class="rounded-lg border border-slate-200 p-3 grid grid-cols-2 gap-3">
          <legend class="text-xs">Campo {{ i + 1 }}</legend>
          <label class="ui-form-label"
            >Identificador<input
              #name
              [value]="field.name"
              (change)="update(i, 'name', name.value)"
              placeholder="ex: local_ocorrencia"
          /></label>
          <label class="ui-form-label"
            >Rótulo<input #label [value]="field.label" (change)="update(i, 'label', label.value)"
          /></label>
          <label class="ui-form-label"
            >Tipo<select #type [value]="field.type" (change)="update(i, 'type', type.value)">
              <option value="text">Texto</option>
              <option value="number">Número</option>
              <option value="date">Data</option>
              <option value="select">Lista de opções</option>
            </select></label
          >
          <label class="flex items-center gap-2 text-sm"
            ><input
              #required
              type="checkbox"
              [checked]="field.required"
              (change)="update(i, 'required', required.checked)"
            />Obrigatório</label
          >
          @if (field.type === 'select') {
            <label class="ui-form-label col-span-2"
              >Opções (uma por linha)<textarea
                #options
                [value]="
                  field.options?.join(
                    '
'
                  ) || ''
                "
                (change)="
                  update(
                    i,
                    'options',
                    options.value.split(
                      '
'
                    )
                  )
                "
              ></textarea>
            </label>
          }
          <button type="button" class="ui-action-danger text-xs text-left" (click)="remove(i)">
            Remover campo
          </button>
        </fieldset>
      }
      <button type="button" class="ui-button-secondary" (click)="add()">Adicionar campo</button>
    </div>
  `,
})
export class FormSchemaEditorComponent {
  readonly fields = input<FormFieldSchema[]>([]);
  readonly fieldsChange = output<FormFieldSchema[]>();

  add(): void {
    this.fieldsChange.emit([
      ...this.fields(),
      { name: '', label: '', type: 'text', required: false },
    ]);
  }

  remove(index: number): void {
    this.fieldsChange.emit(this.fields().filter((_, i) => i !== index));
  }

  update(index: number, key: string, value: string | boolean | string[]): void {
    this.fieldsChange.emit(
      this.fields().map((f, i) =>
        i === index
          ? {
              ...f,
              [key]: Array.isArray(value) ? value.map((v) => v.trim()).filter(Boolean) : value,
            }
          : f,
      ),
    );
  }
}
