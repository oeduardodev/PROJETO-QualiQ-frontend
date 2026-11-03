import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import type { Process } from '@core/models/database';
import { errorMessage } from '@shared/utils/error.utils';
import { FormBuilderRepository, type FormInput } from './form-builder.repository';
import type {
  BuiltForm,
  BuiltFormResponse,
  FormAnswer,
  FormQuestion,
  FormQuestionType,
} from './form-builder.models';

@Component({
  selector: 'app-form-builder',
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe],
  host: { class: 'ui-standard-fields' },
  templateUrl: './form-builder.component.html',
})
export class FormBuilderComponent {
  private readonly repository = inject(FormBuilderRepository);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  readonly setup = this.route.snapshot.routeConfig?.path === 'formularios/construcao';
  readonly forms = signal<BuiltForm[]>([]);
  readonly responses = signal<BuiltFormResponse[]>([]);
  readonly processes = signal<Process[]>([]);
  readonly selectedId = signal('');
  readonly selectedResponseId = signal('');
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly selected = computed(
    () => this.forms().find((form) => form.id === this.selectedId()) ?? null,
  );
  readonly formResponses = computed(() =>
    this.responses().filter((response) => response.form_id === this.selectedId()),
  );
  readonly selectedResponse = computed(
    () =>
      this.formResponses().find((response) => response.id === this.selectedResponseId()) ?? null,
  );
  readonly questionResults = computed(() => {
    const form = this.selected();
    if (!form) return [];
    return form.questions.map((question) => {
      const values = this.formResponses()
        .map((response) => response.answers[question.id])
        .filter(
          (value) =>
            value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0),
        );
      const counts = new Map<string, number>();
      for (const option of question.type === 'rating'
        ? ['1', '2', '3', '4', '5']
        : question.options)
        counts.set(option, 0);
      for (const value of values) {
        for (const choice of Array.isArray(value) ? value : [value]) {
          const key = String(choice);
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
      const numeric = values.filter((value): value is number => typeof value === 'number');
      return {
        question,
        answered: values.length,
        average: numeric.length
          ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length
          : null,
        counts: [...counts],
      };
    });
  });
  editor: FormInput = this.blank();

  constructor() {
    void this.load();
  }

  private blank(): FormInput {
    return {
      title: '',
      description: '',
      process_id: null,
      sector: '',
      thank_you_message: 'Obrigado! Sua resposta foi registrada.',
      status: 'draft',
      questions: [],
    };
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [forms, responses, processes] = await Promise.all([
        this.repository.listForms(),
        this.repository.listResponses(),
        this.repository.listProcesses(),
      ]);
      this.forms.set(forms);
      this.responses.set(responses);
      this.processes.set(processes);
      this.select(
        forms.some((form) => form.id === this.selectedId())
          ? this.selectedId()
          : (forms[0]?.id ?? ''),
      );
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível carregar os formulários.'));
    } finally {
      this.loading.set(false);
    }
  }

  select(id: string): void {
    this.selectedId.set(id);
    this.selectedResponseId.set('');
    const form = this.forms().find((item) => item.id === id);
    this.editor = form
      ? {
          id: form.id,
          title: form.title,
          description: form.description,
          process_id: form.process_id,
          sector: form.sector,
          thank_you_message: form.thank_you_message,
          status: form.status,
          questions: form.questions.map((question) => ({
            ...question,
            options: [...question.options],
          })),
        }
      : this.blank();
  }

  addQuestion(type: FormQuestionType): void {
    this.editor.questions = [
      ...this.editor.questions,
      {
        id: crypto.randomUUID(),
        type,
        title: '',
        description: '',
        required: true,
        options: type === 'single' || type === 'multiple' ? ['Opção 1', 'Opção 2'] : [],
      },
    ];
  }

  removeQuestion(id: string): void {
    this.editor.questions = this.editor.questions.filter((question) => question.id !== id);
  }

  moveQuestion(index: number, direction: -1 | 1): void {
    const next = [...this.editor.questions];
    const other = index + direction;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other], next[index]];
    this.editor.questions = next;
  }

  setOptions(question: FormQuestion, value: string): void {
    question.options = value
      .split(/\r?\n/)
      .map((option) => option.trim())
      .filter(Boolean);
  }

  optionsText(question: FormQuestion): string {
    return question.options.join('\n');
  }

  async save(publish = false): Promise<void> {
    if (this.busy()) return;
    this.error.set('');
    this.notice.set('');
    if (this.editor.title.trim().length < 3) {
      this.error.set('Informe um título com pelo menos 3 caracteres.');
      return;
    }
    if (publish && this.editor.questions.length === 0) {
      this.error.set('Adicione pelo menos uma pergunta antes de publicar.');
      return;
    }
    for (const question of this.editor.questions) {
      if (question.title.trim().length < 3) {
        this.error.set('Preencha o enunciado de todas as perguntas.');
        return;
      }
      if (
        ['single', 'multiple'].includes(question.type) &&
        (question.options.length < 2 || new Set(question.options).size !== question.options.length)
      ) {
        this.error.set('Cada escolha precisa de pelo menos duas opções diferentes.');
        return;
      }
    }
    this.busy.set(true);
    try {
      const saved = await this.repository.save({
        ...this.editor,
        status: publish ? 'published' : this.editor.status,
      });
      await this.load();
      this.select(saved.id);
      this.notice.set(
        publish ? 'Formulário publicado. O link já aceita respostas.' : 'Rascunho salvo.',
      );
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível salvar o formulário.'));
    } finally {
      this.busy.set(false);
    }
  }

  async close(): Promise<void> {
    const form = this.selected();
    if (!form || form.status !== 'published' || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.repository.close(form.id);
      await this.load();
      this.notice.set('Formulário encerrado. O link não aceita novas respostas.');
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível encerrar o formulário.'));
    } finally {
      this.busy.set(false);
    }
  }

  publicUrl(form: BuiltForm): string {
    return `${window.location.origin}/formulario-publico/${form.token}`;
  }

  async copyLink(form: BuiltForm): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.publicUrl(form));
      this.notice.set('Link copiado.');
    } catch {
      this.error.set('Copie o endereço exibido no campo.');
    }
  }

  processName(id: string | null): string {
    return (
      this.processes().find((process) => process.id === id)?.title ??
      (id ? 'Processo vinculado' : 'Sem processo')
    );
  }

  typeLabel(type: FormQuestionType): string {
    return {
      short: 'Texto curto',
      long: 'Texto longo',
      single: 'Escolha única',
      multiple: 'Múltipla escolha',
      rating: 'Nota de 1 a 5',
      date: 'Data',
    }[type];
  }

  percentage(count: number, total: number): number {
    return total ? Math.round((count / total) * 100) : 0;
  }

  answer(question: FormQuestion, response: BuiltFormResponse): string {
    const value: FormAnswer | undefined = response.answers[question.id];
    return value === undefined || value === ''
      ? 'Não respondida'
      : Array.isArray(value)
        ? value.join(', ')
        : String(value);
  }
}
