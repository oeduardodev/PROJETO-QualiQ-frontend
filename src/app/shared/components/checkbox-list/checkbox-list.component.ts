import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type CheckboxOption = { id: string; name: string };

@Component({
  selector: 'app-checkbox-list',
  standalone: true,
  template: `
    <div class="checkbox-list" (focusout)="onTouched()">
      @for (option of options; track option.id) {
        <label class="checkbox-option">
          <input
            #checkbox
            type="checkbox"
            [checked]="selected.includes(option.id)"
            [disabled]="disabled"
            (change)="toggle(option.id, checkbox.checked)"
          />
          <span>{{ option.name }}</span>
        </label>
      } @empty {
        <span class="empty-list">Nenhum usuário disponível</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .checkbox-list {
      max-height: 10rem;
      min-height: 6.5rem;
      overflow-y: auto;
      margin-top: 0.375rem;
      padding: 0.25rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      background: white;
    }

    .checkbox-list:focus-within {
      border-color: #60a5fa;
    }

    .checkbox-option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.5rem;
      border-radius: 0.375rem;
      color: #334155;
      font-size: 0.875rem;
      font-weight: 400;
      cursor: pointer;
    }

    .checkbox-option:hover {
      background: #f8fafc;
    }

    .checkbox-option input {
      width: 1rem;
      height: 1rem;
      margin: 0;
      accent-color: #2563eb;
      cursor: pointer;
    }

    .checkbox-option input:disabled,
    .checkbox-option:has(input:disabled) {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .empty-list {
      display: block;
      padding: 0.375rem 0.5rem;
      color: #64748b;
      font-size: 0.875rem;
      font-weight: 400;
    }
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxListComponent),
      multi: true,
    },
  ],
})
export class CheckboxListComponent implements ControlValueAccessor {
  @Input({ required: true }) options: readonly CheckboxOption[] = [];

  selected: string[] = [];
  disabled = false;
  onTouched: () => void = () => {};
  private onChange: (value: string[]) => void = () => {};

  writeValue(value: string[] | null): void {
    this.selected = Array.isArray(value) ? [...value] : [];
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }

  toggle(id: string, checked: boolean): void {
    if (this.disabled) return;
    this.selected = checked
      ? [...new Set([...this.selected, id])]
      : this.selected.filter((selectedId) => selectedId !== id);
    this.onChange(this.selected);
    this.onTouched();
  }
}
