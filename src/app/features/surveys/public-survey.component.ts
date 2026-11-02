import { Component, inject, signal } from '@angular/core';
import { SurveyRepository } from './survey.repository';
import type { PublicSurvey, SurveyQuestion } from './survey.models';
import { errorMessage } from '@shared/utils/error.utils';

@Component({
  selector: 'app-public-survey',
  template: `
    <main class="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <section
        class="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9"
      >
        @if (submitted()) {
          <h1 class="text-2xl font-semibold">Obrigado pela sua resposta</h1>
          <p class="mt-3 text-slate-600">Sua avaliação foi registrada com sucesso.</p>
        } @else if (survey(); as s) {
          <h1 class="text-2xl font-semibold">{{ s.title }}</h1>
          @if (s.description) {
            <p class="mt-2 text-slate-600">{{ s.description }}</p>
          }
          @if (s.process) {
            <p class="mt-2 text-sm text-slate-500">{{ s.process }}</p>
          }
          <form (submit)="submit($event)" class="mt-7 space-y-7">
            @for (q of s.questions; track q.id; let i = $index) {
              <fieldset class="space-y-3 border-t border-slate-100 pt-5">
                <legend class="font-medium">
                  {{ i + 1 }}. {{ q.prompt }}{{ q.required ? ' *' : '' }}
                </legend>
                @if (q.type === 'text') {
                  <textarea
                    rows="4"
                    maxlength="4000"
                    class="w-full rounded-lg border border-slate-300 p-3"
                    [value]="answer(q.id)"
                    (input)="setText(q.id, $event)"
                    aria-label="Resposta aberta"
                  ></textarea>
                } @else {
                  <p class="text-sm text-slate-500">
                    {{
                      q.low_label || (q.type === 'nps' ? 'Nada provável' : 'Discordo totalmente')
                    }}
                    →
                    {{
                      q.high_label || (q.type === 'nps' ? 'Muito provável' : 'Concordo totalmente')
                    }}
                  </p>
                  <div class="flex flex-wrap gap-2">
                    @for (score of scale(q); track score) {
                      <label
                        class="cursor-pointer rounded-lg border px-3 py-2 text-sm has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50"
                      >
                        <input
                          type="radio"
                          class="sr-only"
                          [name]="q.id"
                          [value]="score"
                          [checked]="answer(q.id) === score"
                          (change)="setScore(q.id, score)"
                        />{{ score }}
                      </label>
                    }
                  </div>
                }
              </fieldset>
            }
            @if (error()) {
              <p role="alert" class="text-sm text-rose-700">{{ error() }}</p>
            }
            <button type="submit" class="ui-button-primary" [disabled]="saving()">
              {{ saving() ? 'Enviando...' : 'Enviar respostas' }}
            </button>
          </form>
        } @else if (error()) {
          <p role="alert" class="text-rose-700">{{ error() }}</p>
        } @else {
          <p>Carregando pesquisa...</p>
        }
      </section>
    </main>
  `,
})
export class PublicSurveyComponent {
  private readonly repository = inject(SurveyRepository);
  private readonly token = window.location.pathname.split('/')[2] ?? '';
  readonly survey = signal<PublicSurvey | null>(null);
  readonly answers = signal<Record<string, string | number>>({});
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly submitted = signal(false);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.survey.set(await this.repository.readPublic(this.token));
    } catch (error) {
      this.error.set(errorMessage(error, 'Este link não está disponível.'));
    }
  }

  scale(question: SurveyQuestion): number[] {
    return Array.from(
      { length: question.type === 'nps' ? 11 : 5 },
      (_, index) => index + (question.type === 'nps' ? 0 : 1),
    );
  }

  answer(id: string): string | number {
    return this.answers()[id] ?? '';
  }

  setScore(id: string, score: number): void {
    this.answers.update((current) => ({ ...current, [id]: score }));
  }

  setText(id: string, event: Event): void {
    this.answers.update((current) => ({
      ...current,
      [id]: (event.target as HTMLTextAreaElement).value,
    }));
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving() || !this.survey()) return;
    const missing = this.survey()!.questions.find(
      (q) =>
        q.required &&
        (this.answers()[q.id] === undefined || String(this.answers()[q.id]).trim() === ''),
    );
    if (missing) {
      this.error.set(`Responda: ${missing.prompt}`);
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.repository.submitPublic(this.token, this.answers());
      this.submitted.set(true);
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível enviar a pesquisa.'));
    } finally {
      this.saving.set(false);
    }
  }
}
