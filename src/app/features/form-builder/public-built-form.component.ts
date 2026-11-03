import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorMessage } from '@shared/utils/error.utils';
import { FormBuilderRepository } from './form-builder.repository';
import type { FormAnswer, FormQuestion, PublicBuiltForm } from './form-builder.models';

@Component({
  selector: 'app-public-built-form',
  imports: [FormsModule],
  template: `
    <main class="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <section
        class="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div class="h-2 bg-blue-600"></div>
        <div class="p-6 sm:p-9">
          @if (submitted()) {
            <h1 class="text-2xl font-semibold">Resposta enviada</h1>
            <p class="mt-3 text-slate-600">{{ form()?.thank_you_message }}</p>
          } @else if (form(); as f) {
            <h1 class="text-2xl font-semibold">{{ f.title }}</h1>
            @if (f.description) {
              <p class="mt-2 whitespace-pre-wrap text-slate-600">{{ f.description }}</p>
            }
            @if (f.process || f.sector) {
              <p class="mt-3 text-sm text-slate-500">
                {{ f.process }}{{ f.process && f.sector ? ' · ' : '' }}{{ f.sector }}
              </p>
            }
            <form class="mt-7 space-y-7" (submit)="submit($event)">
              @for (question of f.questions; track question.id; let i = $index) {
                <fieldset class="space-y-3 border-t border-slate-100 pt-5">
                  <legend class="font-medium">
                    {{ i + 1 }}. {{ question.title }}{{ question.required ? ' *' : '' }}
                  </legend>
                  @if (question.description) {
                    <p class="text-sm text-slate-500">{{ question.description }}</p>
                  }
                  @if (question.type === 'short') {
                    <input
                      class="w-full rounded-lg border border-slate-300 p-3"
                      maxlength="500"
                      [value]="textAnswer(question.id)"
                      (input)="setText(question.id, $event)"
                      [attr.aria-label]="question.title"
                    />
                  } @else if (question.type === 'long') {
                    <textarea
                      class="w-full rounded-lg border border-slate-300 p-3"
                      rows="4"
                      maxlength="4000"
                      [value]="textAnswer(question.id)"
                      (input)="setText(question.id, $event)"
                      [attr.aria-label]="question.title"
                    ></textarea>
                  } @else if (question.type === 'date') {
                    <input
                      type="date"
                      class="rounded-lg border border-slate-300 p-3"
                      [value]="textAnswer(question.id)"
                      (change)="setText(question.id, $event)"
                      [attr.aria-label]="question.title"
                    />
                  } @else if (question.type === 'rating') {
                    <div class="flex flex-wrap gap-2">
                      @for (score of [1, 2, 3, 4, 5]; track score) {
                        <label
                          class="cursor-pointer rounded-lg border px-4 py-2 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50"
                        >
                          <input
                            type="radio"
                            class="sr-only"
                            [name]="question.id"
                            [value]="score"
                            [checked]="answers()[question.id] === score"
                            (change)="setAnswer(question.id, score)"
                          />{{ score }}
                        </label>
                      }
                    </div>
                  } @else if (question.type === 'single') {
                    <div class="space-y-2">
                      @for (option of question.options; track option) {
                        <label class="flex items-center gap-2 text-sm"
                          ><input
                            type="radio"
                            [name]="question.id"
                            [value]="option"
                            [checked]="answers()[question.id] === option"
                            (change)="setAnswer(question.id, option)"
                          />{{ option }}</label
                        >
                      }
                    </div>
                  } @else {
                    <div class="space-y-2">
                      @for (option of question.options; track option) {
                        <label class="flex items-center gap-2 text-sm"
                          ><input
                            type="checkbox"
                            [checked]="isChecked(question.id, option)"
                            (change)="toggleOption(question.id, option, $event)"
                          />{{ option }}</label
                        >
                      }
                    </div>
                  }
                </fieldset>
              }
              @if (error()) {
                <p role="alert" class="text-sm text-rose-700">{{ error() }}</p>
              }
              <button type="submit" class="ui-button-primary" [disabled]="saving()">
                {{ saving() ? 'Enviando...' : 'Enviar resposta' }}
              </button>
            </form>
          } @else if (error()) {
            <p role="alert" class="text-rose-700">{{ error() }}</p>
          } @else {
            <p>Carregando formulário...</p>
          }
        </div>
      </section>
    </main>
  `,
})
export class PublicBuiltFormComponent {
  private readonly repository = inject(FormBuilderRepository);
  private readonly token = window.location.pathname.split('/')[2] ?? '';
  readonly form = signal<PublicBuiltForm | null>(null);
  readonly answers = signal<Record<string, FormAnswer>>({});
  readonly error = signal('');
  readonly saving = signal(false);
  readonly submitted = signal(false);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.form.set(await this.repository.readPublic(this.token));
    } catch (error) {
      this.error.set(errorMessage(error, 'Este link não está disponível.'));
    }
  }

  textAnswer(id: string): string {
    return String(this.answers()[id] ?? '');
  }

  setText(id: string, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    if (!value) {
      this.answers.update((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      return;
    }
    this.setAnswer(id, value);
  }

  setAnswer(id: string, answer: FormAnswer): void {
    this.answers.update((current) => ({ ...current, [id]: answer }));
  }

  isChecked(id: string, option: string): boolean {
    const answer = this.answers()[id];
    return Array.isArray(answer) && answer.includes(option);
  }

  toggleOption(id: string, option: string, event: Event): void {
    const current = this.answers()[id];
    const options = Array.isArray(current) ? current : [];
    this.setAnswer(
      id,
      (event.target as HTMLInputElement).checked
        ? [...options, option]
        : options.filter((item) => item !== option),
    );
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    const form = this.form();
    if (!form || this.saving()) return;
    const missing = form.questions.find((question: FormQuestion) => {
      const answer = this.answers()[question.id];
      return (
        question.required &&
        (answer === undefined ||
          (typeof answer === 'string' && !answer.trim()) ||
          (Array.isArray(answer) && answer.length === 0))
      );
    });
    if (missing) {
      this.error.set(`Responda: ${missing.title}`);
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      await this.repository.submitPublic(this.token, this.answers());
      this.submitted.set(true);
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível enviar a resposta.'));
    } finally {
      this.saving.set(false);
    }
  }
}
