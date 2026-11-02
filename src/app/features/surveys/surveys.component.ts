import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { IconDirective } from '@shared/components/icon/icon.directive';
import type { Process } from '@core/models/database';
import { errorMessage } from '@shared/utils/error.utils';
import { SurveyRepository } from './survey.repository';
import { overallLikert, overallNps, questionMetrics } from './survey.metrics';
import type {
  Survey,
  SurveyCriterion,
  SurveyLink,
  SurveyQuestion,
  SurveyResponse,
} from './survey.models';

type SurveyEditor = Pick<
  Survey,
  'title' | 'description' | 'process_id' | 'questions' | 'status'
> & { id?: string };

@Component({
  selector: 'app-surveys',
  host: { class: 'ui-standard-fields' },
  imports: [FormsModule, RouterLink, DecimalPipe, DatePipe, IconDirective],
  templateUrl: './surveys.component.html',
  styleUrl: './surveys.component.scss',
})
export class SurveysComponent {
  private readonly repository = inject(SurveyRepository);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  readonly setup = this.route.snapshot.routeConfig?.path === 'pesquisas/parametrizacao';
  readonly surveys = signal<Survey[]>([]);
  readonly criteria = signal<SurveyCriterion[]>([]);
  readonly processes = signal<Process[]>([]);
  readonly links = signal<SurveyLink[]>([]);
  readonly responses = signal<SurveyResponse[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly aiLoading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly selectedSurveyId = signal('');
  readonly selectedResponseId = signal('');
  readonly selectedLinkId = signal('');
  readonly survey = computed(
    () => this.surveys().find((item) => item.id === this.selectedSurveyId()) ?? null,
  );
  readonly surveyResponses = computed(() =>
    this.responses().filter(
      (item) =>
        item.survey_id === this.selectedSurveyId() &&
        (!this.selectedLinkId() || item.link_id === this.selectedLinkId()),
    ),
  );
  readonly surveyLinks = computed(() =>
    this.links().filter((item) => item.survey_id === this.selectedSurveyId()),
  );
  readonly selectedResponse = computed(
    () => this.surveyResponses().find((item) => item.id === this.selectedResponseId()) ?? null,
  );
  readonly metrics = computed(() =>
    this.survey() ? questionMetrics(this.survey()!, this.surveyResponses()) : [],
  );
  readonly sectorSummaries = computed(() => {
    const sectors = new Map<string, ReturnType<typeof questionMetrics>>();
    for (const metric of this.metrics()) {
      const criterion = this.criteria().find((item) => item.id === metric.question.criterion_id);
      const sector = criterion?.sector ?? 'Sem setor';
      sectors.set(sector, [...(sectors.get(sector) ?? []), metric]);
    }
    return [...sectors].map(([sector, metrics]) => ({
      sector,
      evaluations: metrics.reduce((sum, metric) => sum + metric.count, 0),
      likert: overallLikert(metrics),
      nps: overallNps(metrics),
    }));
  });
  readonly likert = computed(() => overallLikert(this.metrics()));
  readonly nps = computed(() => overallNps(this.metrics()));
  readonly pending = computed(
    () => this.surveyResponses().filter((item) => item.review_status === 'pending').length,
  );
  editor: SurveyEditor = this.blankEditor();
  criterionSector = '';
  criterionInputName = '';
  linkProcessId = '';
  reviewAnalysis = '';
  reviewAction = '';

  constructor() {
    void this.load();
  }

  private blankEditor(): SurveyEditor {
    return { title: '', description: '', process_id: null, questions: [], status: 'draft' };
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [surveys, criteria, processes, links, responses] = await Promise.all([
        this.repository.listSurveys(),
        this.repository.listCriteria(),
        this.repository.listProcesses(),
        this.repository.listLinks(),
        this.repository.listResponses(),
      ]);
      this.surveys.set(surveys);
      this.criteria.set(criteria);
      this.processes.set(processes);
      this.links.set(links);
      this.responses.set(responses);
      const responseFromUrl = this.route.snapshot.queryParamMap.get('resposta');
      const linkedResponse = responses.find((item) => item.id === responseFromUrl);
      const selectedId =
        linkedResponse?.survey_id ?? (this.selectedSurveyId() || surveys[0]?.id || '');
      this.selectSurvey(selectedId);
      if (linkedResponse) this.selectResponse(linkedResponse.id);
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível carregar as pesquisas.'));
    } finally {
      this.loading.set(false);
    }
  }

  selectSurvey(id: string): void {
    this.selectedSurveyId.set(id);
    const survey = this.surveys().find((item) => item.id === id);
    this.editor = survey
      ? {
          id: survey.id,
          title: survey.title,
          description: survey.description,
          process_id: survey.process_id,
          status: survey.status,
          questions: survey.questions.map((question) => ({ ...question })),
        }
      : this.blankEditor();
    this.linkProcessId = survey?.process_id ?? '';
    this.selectedLinkId.set('');
    this.selectedResponseId.set('');
    this.reviewAnalysis = '';
    this.reviewAction = '';
  }

  newSurvey(): void {
    this.selectSurvey('');
  }

  addQuestion(type: SurveyQuestion['type']): void {
    this.editor.questions.push({
      id: crypto.randomUUID(),
      type,
      prompt: '',
      required: true,
      criterion_id: null,
      low_label: type === 'nps' ? 'Nada provável' : 'Discordo totalmente',
      high_label: type === 'nps' ? 'Muito provável' : 'Concordo totalmente',
    });
  }

  removeQuestion(id: string): void {
    this.editor.questions = this.editor.questions.filter((item) => item.id !== id);
  }

  async saveSurvey(publish = false): Promise<void> {
    if (this.busy()) return;
    this.error.set('');
    if (this.editor.title.trim().length < 3) {
      this.error.set('Informe um título com ao menos 3 caracteres.');
      return;
    }
    if (this.editor.questions.some((question) => question.prompt.trim().length < 3)) {
      this.error.set('Preencha o texto de todas as perguntas.');
      return;
    }
    if (publish && !this.editor.questions.some((question) => question.type !== 'text')) {
      this.error.set('Inclua ao menos uma pergunta Likert ou NPS.');
      return;
    }
    this.busy.set(true);
    try {
      const saved = await this.repository.saveSurvey({
        ...this.editor,
        status: publish ? 'published' : this.editor.status,
      });
      await this.load();
      this.selectSurvey(saved.id);
      this.notice.set(
        publish ? 'Pesquisa publicada. Agora crie os links de resposta.' : 'Pesquisa salva.',
      );
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível salvar a pesquisa.'));
    } finally {
      this.busy.set(false);
    }
  }

  async closeSurvey(): Promise<void> {
    if (!this.survey() || this.busy()) return;
    this.busy.set(true);
    try {
      await this.repository.saveSurvey({ ...this.editor, status: 'closed' });
      await this.load();
      this.notice.set('Pesquisa encerrada; os links deixaram de aceitar respostas.');
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível encerrar.'));
    } finally {
      this.busy.set(false);
    }
  }

  async addCriterion(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const item = await this.repository.createCriterion(
        this.criterionSector,
        this.criterionInputName,
      );
      this.criteria.update((items) => [...items, item]);
      this.criterionSector = '';
      this.criterionInputName = '';
      this.notice.set('Critério criado.');
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível criar o critério.'));
    } finally {
      this.busy.set(false);
    }
  }

  async addLink(): Promise<void> {
    const survey = this.survey();
    if (!survey || this.busy()) return;
    const processId = this.linkProcessId || null;
    this.busy.set(true);
    this.error.set('');
    try {
      const link = await this.repository.createLink(survey.id, processId);
      this.links.update((items) => [link, ...items]);
      this.notice.set('Link público criado.');
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível criar o link.'));
    } finally {
      this.busy.set(false);
    }
  }

  async toggleLink(link: SurveyLink): Promise<void> {
    try {
      await this.repository.setLinkActive(link.id, !link.active);
      this.links.update((items) =>
        items.map((item) => (item.id === link.id ? { ...item, active: !item.active } : item)),
      );
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível alterar o link.'));
    }
  }

  publicUrl(link: SurveyLink): string {
    return `${window.location.origin}/pesquisa-publica/${link.token}`;
  }

  async copyLink(link: SurveyLink): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.publicUrl(link));
      this.notice.set('Link copiado.');
    } catch {
      this.error.set('Copie o endereço exibido no campo.');
    }
  }

  selectResponse(id: string): void {
    this.selectedResponseId.set(id);
    const response = this.selectedResponse();
    this.reviewAnalysis = response?.critical_analysis ?? '';
    this.reviewAction = response?.action_taken ?? '';
  }

  async review(): Promise<void> {
    const response = this.selectedResponse();
    if (!response || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const saved = await this.repository.review(
        response.id,
        this.reviewAnalysis,
        this.reviewAction,
      );
      this.responses.update((items) => items.map((item) => (item.id === saved.id ? saved : item)));
      this.notice.set('Análise crítica e ação registradas.');
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível registrar a análise crítica.'));
    } finally {
      this.busy.set(false);
    }
  }

  async analyze(): Promise<void> {
    const response = this.selectedResponse();
    if (!response || this.busy()) return;
    this.busy.set(true);
    this.aiLoading.set(true);
    this.error.set('');
    try {
      const analysis = await this.repository.analyze(response.id);
      this.responses.update((items) =>
        items.map((item) =>
          item.id === response.id
            ? {
                ...item,
                sentiment: analysis.sentiment,
                sentiment_summary: analysis.summary,
                sentiment_alignment: analysis.alignment,
              }
            : item,
        ),
      );
      this.notice.set('Análise de sentimento concluída.');
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível analisar o sentimento.'));
    } finally {
      this.aiLoading.set(false);
      this.busy.set(false);
    }
  }

  processName(id: string | null): string {
    return this.processes().find((item) => item.id === id)?.title ?? 'Sem processo';
  }

  criterionName(id: string | null): string {
    const criterion = this.criteria().find((item) => item.id === id);
    return criterion ? `${criterion.sector} · ${criterion.name}` : 'Sem critério';
  }

  answer(question: SurveyQuestion, response: SurveyResponse): string {
    const value = response.answers[question.id];
    return value === undefined || value === '' ? 'Não respondida' : String(value);
  }

  hasOpenAnswers(response: SurveyResponse): boolean {
    return !!this.survey()?.questions.some(
      (question) => question.type === 'text' && String(response.answers[question.id] ?? '').trim(),
    );
  }

  linkLabel(link: SurveyLink): string {
    const process = link.process_id ? `${this.processName(link.process_id)} · ` : '';
    return `${process}Link ${link.token.slice(0, 8)}`;
  }

  responseLinkLabel(response: SurveyResponse): string {
    const link = this.links().find((item) => item.id === response.link_id);
    return link ? this.linkLabel(link) : this.processName(response.process_id);
  }
}
