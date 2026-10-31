import {
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '@core/services/auth.service';
import { ProfileService } from '@core/services/profile.service';
import { ActionPlanService } from '@features/actions/data-access/action-plan.service';
import type { ActionPlan, Profile } from '@core/models/database';
import { errorMessage } from '@shared/utils/error.utils';
import { EducationService } from './data-access/education.service';
import type {
  LearningAttendance,
  LearningItem,
  LearningQuestion,
  LearningQuiz,
  LearningQuizAttempt,
  LearningStage,
  LearningStageProgress,
  LearningTrackCourse,
  PublicLearningQuestion,
} from './education.models';

interface YoutubePlayer {
  getCurrentTime(): number;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
}
interface YoutubeApi {
  Player: new (element: string, options: Record<string, unknown>) => YoutubePlayer;
}
declare global {
  interface Window {
    YT?: YoutubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

@Component({
  selector: 'app-education',
  imports: [FormsModule],
  templateUrl: './education.component.html',
  styleUrl: './education.component.scss',
  host: { class: 'ui-standard-fields' },
})
export class EducationComponent implements OnDestroy {
  @ViewChild('audioPlayer') audioPlayer?: ElementRef<HTMLAudioElement>;
  private readonly service = inject(EducationService);
  private readonly planService = inject(ActionPlanService);
  private readonly profileService = inject(ProfileService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  readonly auth = inject(AuthService);
  readonly mode = this.route.snapshot.routeConfig?.path?.split('/')[1] ?? 'treinamentos';
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly items = signal<LearningItem[]>([]);
  readonly courses = signal<LearningTrackCourse[]>([]);
  readonly stages = signal<LearningStage[]>([]);
  readonly quizzes = signal<LearningQuiz[]>([]);
  readonly progress = signal<LearningStageProgress[]>([]);
  readonly attendance = signal<LearningAttendance[]>([]);
  readonly attempts = signal<LearningQuizAttempt[]>([]);
  readonly plans = signal<ActionPlan[]>([]);
  readonly profiles = signal<Profile[]>([]);
  readonly expandedId = signal<string | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly selectedStageId = signal<string | null>(null);
  readonly activeQuizId = signal<string | null>(null);
  readonly publicQuestions = signal<PublicLearningQuestion[]>([]);
  readonly authorQuestions = signal<LearningQuestion[]>([]);
  readonly editingItemId = signal<string | null>(null);
  readonly editingStageId = signal<string | null>(null);
  readonly editingQuizId = signal<string | null>(null);
  readonly editingQuestionId = signal<string | null>(null);
  readonly editorOpen = signal(false);
  readonly stageEditorOpen = signal(false);
  readonly quizEditorOpen = signal(false);
  readonly questionEditorOpen = signal(false);
  readonly search = signal('');
  readonly selectedItem = computed(
    () => this.items().find((i) => i.id === this.selectedId()) ?? null,
  );
  readonly selectedStage = computed(
    () => this.stages().find((s) => s.id === this.selectedStageId()) ?? null,
  );
  readonly activeQuiz = computed(
    () => this.quizzes().find((q) => q.id === this.activeQuizId()) ?? null,
  );
  readonly visibleItems = computed(() =>
    this.items().filter(
      (i) =>
        (this.mode === 'gerenciamento' ? i.owner_id === this.auth.user()?.id : i.published) &&
        `${i.title} ${i.description}`
          .toLocaleLowerCase('pt-BR')
          .includes(this.search().toLocaleLowerCase('pt-BR')),
    ),
  );
  readonly ownerItems = computed(() =>
    this.items().filter((i) => i.owner_id === this.auth.user()?.id),
  );
  readonly totalParticipants = computed(() =>
    this.ownerItems().reduce((sum, i) => sum + this.participants(i).length, 0),
  );
  readonly totalCompletions = computed(() =>
    this.ownerItems().reduce((sum, i) => sum + this.completionCount(i), 0),
  );
  readonly totalAccessSeconds = computed(() => {
    const trainingIds = new Set(
      this.ownerItems().flatMap((i) =>
        i.kind === 'training' ? [i.id] : this.coursesFor(i.id).map((c) => c.training_id),
      ),
    );
    const stageIds = new Set(
      this.stages()
        .filter((s) => trainingIds.has(s.training_id))
        .map((s) => s.id),
    );
    return this.progress()
      .filter((p) => stageIds.has(p.stage_id))
      .reduce((sum, p) => sum + p.access_seconds, 0);
  });
  readonly completionRate = computed(() =>
    this.totalParticipants()
      ? Math.round((100 * this.totalCompletions()) / this.totalParticipants())
      : 0,
  );

  itemDraft = {
    kind: 'training' as 'training' | 'track',
    title: '',
    description: '',
    action_plan_id: '',
    published: false,
  };
  stageDraft = {
    title: '',
    resource_kind: 'youtube' as LearningStage['resource_kind'],
    resource_url: '',
    duration_seconds: 0,
  };
  quizDraft = { title: '', cue_seconds: 0, passing_score: 70 };
  questionDraft = { prompt: '', options: '', correct_index: 0 };
  answers: number[] = [];
  signature = '';
  courseToAdd = '';
  private player: YoutubePlayer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private mediaPlaying = false;
  private tickBusy = false;
  private readonly pdfCache = new Map<string, SafeResourceUrl>();

  constructor() {
    void this.load();
  }

  ngOnDestroy(): void {
    this.stopMedia();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.service.load();
      this.items.set(data.items);
      this.courses.set(data.courses);
      this.stages.set(data.stages);
      this.quizzes.set(data.quizzes);
      this.progress.set(data.progress);
      this.attendance.set(data.attendance);
      this.attempts.set(data.attempts);
      const requestedItem = this.route.snapshot.queryParamMap.get('item');
      if (requestedItem && data.items.some((item) => item.id === requestedItem))
        this.selectedId.set(requestedItem);
      if (this.mode === 'gerenciamento') {
        try {
          this.plans.set(await this.planService.fetchActionPlans());
        } catch {
          this.plans.set([]);
        }
      }
      if (this.mode === 'painel') this.profiles.set(await this.profileService.findAll());
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível carregar a educação continuada.'));
    } finally {
      this.loading.set(false);
    }
  }

  stagesFor(trainingId: string): LearningStage[] {
    return this.stages()
      .filter((s) => s.training_id === trainingId)
      .sort((a, b) => a.position - b.position);
  }

  quizzesFor(stageId: string): LearningQuiz[] {
    return this.quizzes()
      .filter((q) => q.stage_id === stageId)
      .sort((a, b) => a.position - b.position);
  }

  coursesFor(trackId: string): LearningTrackCourse[] {
    return this.courses()
      .filter((c) => c.track_id === trackId)
      .sort((a, b) => a.position - b.position);
  }

  courseInTrack(trackId: string, trainingId: string): boolean {
    return this.courses().some((c) => c.track_id === trackId && c.training_id === trainingId);
  }

  courseName(id: string): string {
    return this.items().find((i) => i.id === id)?.title ?? 'Treinamento removido';
  }

  planName(id: string | null): string {
    return this.plans().find((p) => p.id === id)?.title ?? 'Plano de ação vinculado';
  }

  mine(stageId: string): LearningStageProgress | undefined {
    return this.progress().find(
      (p) => p.stage_id === stageId && p.user_id === this.auth.user()?.id,
    );
  }

  signed(itemId: string): boolean {
    return this.attendance().some(
      (a) => a.item_id === itemId && a.user_id === this.auth.user()?.id,
    );
  }

  canOpenStage(stage: LearningStage): boolean {
    return this.stagesFor(stage.training_id)
      .filter((s) => s.position < stage.position)
      .every((s) => !!this.mine(s.id)?.completed_at);
  }

  canOpenCourse(course: LearningTrackCourse): boolean {
    return this.coursesFor(course.track_id)
      .filter((c) => c.position < course.position)
      .every((c) => this.signed(c.training_id));
  }

  canSign(item: LearningItem): boolean {
    return item.kind === 'training'
      ? this.stagesFor(item.id).length > 0 &&
          this.stagesFor(item.id).every((s) => !!this.mine(s.id)?.completed_at)
      : this.coursesFor(item.id).length > 0 &&
          this.coursesFor(item.id).every((c) => this.signed(c.training_id));
  }

  participants(item: LearningItem): string[] {
    const stageIds =
      item.kind === 'training'
        ? this.stagesFor(item.id).map((s) => s.id)
        : this.coursesFor(item.id).flatMap((c) => this.stagesFor(c.training_id).map((s) => s.id));
    return [
      ...new Set([
        ...this.progress()
          .filter((p) => stageIds.includes(p.stage_id))
          .map((p) => p.user_id),
        ...this.attendance()
          .filter((a) => a.item_id === item.id)
          .map((a) => a.user_id),
      ]),
    ];
  }

  completionCount(item: LearningItem): number {
    return this.attendance().filter((a) => a.item_id === item.id).length;
  }

  attemptsForItem(item: LearningItem): number {
    const trainingIds =
      item.kind === 'training' ? [item.id] : this.coursesFor(item.id).map((c) => c.training_id);
    const stageIds = this.stages()
      .filter((s) => trainingIds.includes(s.training_id))
      .map((s) => s.id);
    const quizIds = this.quizzes()
      .filter((q) => stageIds.includes(q.stage_id))
      .map((q) => q.id);
    return this.attempts().filter((a) => quizIds.includes(a.quiz_id)).length;
  }

  passRate(item: LearningItem): number {
    const quizIds = this.quizIdsFor(item);
    const attempts = this.attempts().filter((a) => quizIds.includes(a.quiz_id));
    return attempts.length
      ? Math.round((100 * attempts.filter((a) => a.passed).length) / attempts.length)
      : 0;
  }

  participantDetails(
    item: LearningItem,
  ): { id: string; name: string; seconds: number; completed: boolean; bestScore: number | null }[] {
    const trainingIds =
      item.kind === 'training' ? [item.id] : this.coursesFor(item.id).map((c) => c.training_id);
    const stageIds = this.stages()
      .filter((s) => trainingIds.includes(s.training_id))
      .map((s) => s.id);
    const quizIds = this.quizIdsFor(item);
    return this.participants(item).map((id) => {
      const attempts = this.attempts().filter(
        (a) => a.user_id === id && quizIds.includes(a.quiz_id),
      );
      return {
        id,
        name: this.profiles().find((p) => p.id === id)?.name ?? id,
        seconds: this.progress()
          .filter((p) => p.user_id === id && stageIds.includes(p.stage_id))
          .reduce((sum, p) => sum + p.access_seconds, 0),
        completed: this.attendance().some((a) => a.item_id === item.id && a.user_id === id),
        bestScore: attempts.length ? Math.max(...attempts.map((a) => a.score)) : null,
      };
    });
  }

  private quizIdsFor(item: LearningItem): string[] {
    const trainingIds =
      item.kind === 'training' ? [item.id] : this.coursesFor(item.id).map((c) => c.training_id);
    const stageIds = this.stages()
      .filter((s) => trainingIds.includes(s.training_id))
      .map((s) => s.id);
    return this.quizzes()
      .filter((q) => stageIds.includes(q.stage_id))
      .map((q) => q.id);
  }

  accessSeconds(item: LearningItem): number {
    const stageIds =
      item.kind === 'training'
        ? this.stagesFor(item.id).map((s) => s.id)
        : this.coursesFor(item.id).flatMap((c) => this.stagesFor(c.training_id).map((s) => s.id));
    return this.progress()
      .filter((p) => stageIds.includes(p.stage_id))
      .reduce((sum, p) => sum + p.access_seconds, 0);
  }

  completionPercent(item: LearningItem): number {
    const count = this.participants(item).length;
    return count ? Math.round((100 * this.completionCount(item)) / count) : 0;
  }

  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours ? `${hours}h ${minutes}min` : `${minutes}min`;
  }

  formatDuration(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  safePdf(url: string): SafeResourceUrl {
    if (!this.pdfCache.has(url))
      this.pdfCache.set(url, this.sanitizer.bypassSecurityTrustResourceUrl(url));
    return this.pdfCache.get(url)!;
  }

  itemProgress(item: LearningItem): number {
    if (this.signed(item.id)) return 100;
    const units =
      item.kind === 'training'
        ? this.stagesFor(item.id).map((s) => !!this.mine(s.id)?.completed_at)
        : this.coursesFor(item.id).map((c) => this.signed(c.training_id));
    return units.length ? Math.round((100 * units.filter(Boolean).length) / units.length) : 0;
  }

  openItem(item: LearningItem): void {
    this.stopMedia();
    this.selectedId.set(item.id);
    this.selectedStageId.set(null);
    this.activeQuizId.set(null);
    this.notice.set('');
  }

  back(): void {
    this.stopMedia();
    this.selectedStageId.set(null);
    this.selectedId.set(null);
    this.activeQuizId.set(null);
  }

  backToItem(): void {
    this.stopMedia();
    this.selectedStageId.set(null);
    this.activeQuizId.set(null);
  }

  openCourse(course: LearningTrackCourse): void {
    if (!this.canOpenCourse(course)) return;
    const item = this.items().find((i) => i.id === course.training_id);
    if (item) this.openItem(item);
  }

  openStage(stage: LearningStage): void {
    if (!this.canOpenStage(stage)) return;
    this.stopMedia();
    this.selectedStageId.set(stage.id);
    this.notice.set('');
    this.timer = setInterval(() => void this.heartbeat(), 5000);
    if (stage.resource_kind === 'youtube') setTimeout(() => void this.initYoutube(stage), 0);
    void this.service
      .tick(stage.id, 0)
      .then((progress) => {
        if (this.selectedStageId() === stage.id) {
          this.setProgress(progress);
          void this.checkCue();
        }
      })
      .catch((error) => this.notice.set(errorMessage(error, 'Não foi possível abrir a etapa.')));
  }

  private stopMedia(): void {
    this.mediaPlaying = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.player?.destroy();
    this.player = null;
  }

  private async initYoutube(stage: LearningStage): Promise<void> {
    const videoId = this.youtubeId(stage.resource_url);
    if (!videoId) {
      this.notice.set('Link do YouTube inválido. Avise o responsável pelo treinamento.');
      return;
    }
    try {
      const api = await this.youtubeApi();
      if (this.selectedStageId() !== stage.id) return;
      this.player = new api.Player('education-youtube-player', {
        width: '100%',
        height: '100%',
        videoId,
        playerVars: { playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onStateChange: (event: { data: number }) => {
            if (event.data === 1 && this.activeQuizId()) {
              this.player?.pauseVideo();
              return;
            }
            this.mediaPlaying = event.data === 1;
            if (event.data === 0) void this.checkCue();
          },
        },
      });
    } catch {
      this.notice.set('Não foi possível carregar o player do YouTube.');
    }
  }

  private youtubeId(url: string): string | null {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, '');
      const id =
        host === 'youtu.be'
          ? parsed.pathname.slice(1)
          : ['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)
            ? (parsed.searchParams.get('v') ??
              parsed.pathname.split('/').filter(Boolean).at(-1) ??
              '')
            : '';
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    } catch {
      return null;
    }
  }

  private youtubeApi(): Promise<YoutubeApi> {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    return new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        if (window.YT?.Player) resolve(window.YT);
        else reject(new Error('YouTube indisponível'));
      };
      if (!document.getElementById('youtube-iframe-api')) {
        const script = document.createElement('script');
        script.id = 'youtube-iframe-api';
        script.src = 'https://www.youtube.com/iframe_api';
        script.onerror = () => reject(new Error('YouTube indisponível'));
        document.head.appendChild(script);
      }
    });
  }

  onAudioPlay(): void {
    this.mediaPlaying = true;
  }

  onAudioPause(): void {
    this.mediaPlaying = false;
  }

  onMediaTime(): void {
    const stage = this.selectedStage();
    if (!stage) return;
    const watched = this.mine(stage.id)?.watched_seconds ?? 0;
    const time = this.mediaTime();
    if (time > watched + 8) this.seekMedia(Math.max(0, watched));
    else void this.checkCue();
  }

  private mediaTime(): number {
    return this.selectedStage()?.resource_kind === 'youtube'
      ? (this.player?.getCurrentTime() ?? 0)
      : (this.audioPlayer?.nativeElement.currentTime ?? 0);
  }

  private seekMedia(seconds: number): void {
    if (this.player) this.player.seekTo(seconds, true);
    if (this.audioPlayer) this.audioPlayer.nativeElement.currentTime = seconds;
  }

  private pauseMedia(): void {
    this.player?.pauseVideo();
    this.audioPlayer?.nativeElement.pause();
    this.mediaPlaying = false;
  }

  private async heartbeat(): Promise<void> {
    const stage = this.selectedStage();
    if (!stage || this.tickBusy || document.hidden || this.activeQuizId()) return;
    if (['youtube', 'audio'].includes(stage.resource_kind) && !this.mediaPlaying) return;
    if (
      ['youtube', 'audio'].includes(stage.resource_kind) &&
      this.mediaTime() > (this.mine(stage.id)?.watched_seconds ?? 0) + 8
    ) {
      this.seekMedia(this.mine(stage.id)?.watched_seconds ?? 0);
      return;
    }
    this.tickBusy = true;
    try {
      const progress = await this.service.tick(stage.id, 5);
      if (this.selectedStageId() === stage.id) {
        this.setProgress(progress);
        await this.checkCue();
      }
    } catch (error) {
      this.notice.set(errorMessage(error, 'Não foi possível registrar o tempo de acesso.'));
      this.pauseMedia();
    } finally {
      this.tickBusy = false;
    }
  }

  private setProgress(value: LearningStageProgress): void {
    this.progress.update((rows) => [
      ...rows.filter((p) => !(p.stage_id === value.stage_id && p.user_id === value.user_id)),
      value,
    ]);
  }

  private async checkCue(): Promise<void> {
    const stage = this.selectedStage();
    if (!stage || this.activeQuizId()) return;
    const state = this.mine(stage.id);
    const quiz = this.quizzesFor(stage.id).find(
      (q) =>
        !state?.quiz_passes.includes(q.id) &&
        (state?.watched_seconds ?? 0) >=
          (state?.replay_required && ['youtube', 'audio'].includes(stage.resource_kind)
            ? stage.duration_seconds
            : q.cue_seconds) &&
        (stage.resource_kind === 'pdf' ||
          stage.resource_kind === 'link' ||
          this.mediaTime() >= q.cue_seconds),
    );
    if (!quiz) return;
    this.pauseMedia();
    this.activeQuizId.set(quiz.id);
    this.answers = [];
    try {
      this.publicQuestions.set(await this.service.questions(quiz.id));
    } catch (error) {
      this.notice.set(errorMessage(error, 'Não foi possível abrir a avaliação.'));
      this.activeQuizId.set(null);
    }
  }

  async submitQuiz(): Promise<void> {
    const quiz = this.activeQuiz();
    if (!quiz || this.busy()) return;
    if (
      this.answers.length !== this.publicQuestions().length ||
      this.answers.some((a) => a === undefined)
    ) {
      this.notice.set('Responda todas as questões.');
      return;
    }
    this.busy.set(true);
    try {
      const result = await this.service.submit(quiz.id, this.answers);
      this.notice.set(
        result.passed
          ? `Aprovado com ${result.score}% (mínimo ${result.passing_score}%).`
          : `Resultado ${result.score}%. Assista ou ouça o material novamente antes de refazer a avaliação.`,
      );
      const data = await this.service.load();
      this.progress.set(data.progress);
      this.attempts.set(data.attempts);
      this.activeQuizId.set(null);
      this.publicQuestions.set([]);
      if (!result.passed) this.seekMedia(0);
    } catch (error) {
      this.notice.set(errorMessage(error, 'Não foi possível enviar a avaliação.'));
    } finally {
      this.busy.set(false);
    }
  }

  canCompleteStage(): boolean {
    const stage = this.selectedStage();
    if (!stage) return false;
    const p = this.mine(stage.id);
    return (
      !p?.replay_required &&
      (stage.resource_kind === 'pdf' ||
        stage.resource_kind === 'link' ||
        (p?.watched_seconds ?? 0) >= stage.duration_seconds) &&
      this.quizzesFor(stage.id).every((q) => p?.quiz_passes.includes(q.id))
    );
  }

  async completeStage(): Promise<void> {
    const stage = this.selectedStage();
    if (!stage || this.busy()) return;
    this.busy.set(true);
    try {
      this.setProgress(await this.service.complete(stage.id));
      this.notice.set('Etapa concluída.');
      this.backToItem();
    } catch (error) {
      this.notice.set(errorMessage(error, 'Não foi possível concluir a etapa.'));
    } finally {
      this.busy.set(false);
    }
  }

  async signAttendance(): Promise<void> {
    const item = this.selectedItem();
    if (!item || this.busy()) return;
    this.busy.set(true);
    try {
      const signed = await this.service.sign(item.id, this.signature);
      this.attendance.update((rows) => [...rows, signed]);
      this.notice.set('Presença assinada e conclusão registrada.');
    } catch (error) {
      this.notice.set(errorMessage(error, 'Não foi possível assinar a presença.'));
    } finally {
      this.busy.set(false);
    }
  }

  newItem(kind: 'training' | 'track'): void {
    this.editingItemId.set(null);
    this.itemDraft = { kind, title: '', description: '', action_plan_id: '', published: false };
    this.editorOpen.set(true);
  }

  editItem(item: LearningItem): void {
    this.editingItemId.set(item.id);
    this.itemDraft = {
      kind: item.kind,
      title: item.title,
      description: item.description,
      action_plan_id: item.action_plan_id ?? '',
      published: item.published,
    };
    this.editorOpen.set(true);
  }

  async saveItem(): Promise<void> {
    if (!this.itemDraft.title.trim() || this.busy()) return;
    this.busy.set(true);
    try {
      const item = await this.service.saveItem(this.editingItemId(), {
        ...this.itemDraft,
        title: this.itemDraft.title.trim(),
        description: this.itemDraft.description.trim(),
        action_plan_id: this.itemDraft.action_plan_id || null,
        ...(!this.editingItemId() ? { owner_id: this.auth.user()?.id } : {}),
      });
      this.editorOpen.set(false);
      await this.load();
      this.selectedId.set(item.id);
      this.notice.set('Salvo com sucesso.');
    } catch (error) {
      this.notice.set(errorMessage(error, 'Não foi possível salvar.'));
    } finally {
      this.busy.set(false);
    }
  }

  async togglePublish(item: LearningItem): Promise<void> {
    this.busy.set(true);
    try {
      await this.service.saveItem(item.id, { published: !item.published });
      await this.load();
      this.notice.set(
        item.published ? 'Treinamento retirado da publicação.' : 'Publicado com sucesso.',
      );
    } catch (error) {
      this.notice.set(errorMessage(error, 'Não foi possível alterar a publicação.'));
    } finally {
      this.busy.set(false);
    }
  }

  async deleteItem(item: LearningItem): Promise<void> {
    if (!window.confirm(`Excluir ${item.title} e todo o histórico de participantes?`)) return;
    try {
      await this.service.deleteItem(item.id);
      this.back();
      await this.load();
    } catch (error) {
      this.notice.set(errorMessage(error, 'Não foi possível excluir.'));
    }
  }

  newStage(): void {
    this.editingStageId.set(null);
    this.stageDraft = {
      title: '',
      resource_kind: 'youtube',
      resource_url: '',
      duration_seconds: 0,
    };
    this.stageEditorOpen.set(true);
  }

  editStage(stage: LearningStage): void {
    this.editingStageId.set(stage.id);
    this.stageDraft = {
      title: stage.title,
      resource_kind: stage.resource_kind,
      resource_url: stage.resource_url,
      duration_seconds: stage.duration_seconds,
    };
    this.stageEditorOpen.set(true);
  }

  async saveStage(): Promise<void> {
    const item = this.selectedItem();
    if (!item || !this.stageDraft.title.trim() || !this.stageDraft.resource_url.trim()) return;
    if (
      this.stageDraft.resource_kind === 'youtube' &&
      !this.youtubeId(this.stageDraft.resource_url)
    ) {
      this.notice.set('Informe um link válido do YouTube.');
      return;
    }
    this.busy.set(true);
    try {
      await this.service.saveStage(this.editingStageId(), {
        training_id: item.id,
        position: this.editingStageId()
          ? this.stages().find((s) => s.id === this.editingStageId())?.position
          : Math.max(0, ...this.stagesFor(item.id).map((s) => s.position)) + 1,
        title: this.stageDraft.title.trim(),
        resource_kind: this.stageDraft.resource_kind,
        resource_url: this.stageDraft.resource_url.trim(),
        duration_seconds: ['youtube', 'audio'].includes(this.stageDraft.resource_kind)
          ? Math.round(this.stageDraft.duration_seconds)
          : 0,
      });
      this.stageEditorOpen.set(false);
      await this.load();
      this.notice.set('Etapa salva.');
    } catch (error) {
      this.notice.set(errorMessage(error, 'Não foi possível salvar a etapa.'));
    } finally {
      this.busy.set(false);
    }
  }

  async deleteStage(stage: LearningStage): Promise<void> {
    if (!window.confirm(`Excluir a etapa ${stage.title}?`)) return;
    try {
      await this.service.deleteStage(stage.id);
      await this.load();
    } catch (error) {
      this.notice.set(errorMessage(error, 'Não foi possível excluir a etapa.'));
    }
  }

  async addCourse(): Promise<void> {
    const item = this.selectedItem();
    if (!item || !this.courseToAdd) return;
    try {
      await this.service.addCourse(
        item.id,
        this.courseToAdd,
        Math.max(0, ...this.coursesFor(item.id).map((c) => c.position)) + 1,
      );
      this.courseToAdd = '';
      await this.load();
    } catch (error) {
      this.notice.set(errorMessage(error, 'Não foi possível adicionar o treinamento.'));
    }
  }

  async removeCourse(course: LearningTrackCourse): Promise<void> {
    try {
      await this.service.removeCourse(course.id);
      await this.load();
    } catch (error) {
      this.notice.set(errorMessage(error, 'Não foi possível remover o treinamento.'));
    }
  }

  newQuiz(stage: LearningStage): void {
    this.selectedStageId.set(stage.id);
    this.editingQuizId.set(null);
    this.quizDraft = { title: '', cue_seconds: 0, passing_score: 70 };
    this.quizEditorOpen.set(true);
  }

  editQuiz(quiz: LearningQuiz): void {
    this.selectedStageId.set(quiz.stage_id);
    this.editingQuizId.set(quiz.id);
    this.quizDraft = {
      title: quiz.title,
      cue_seconds: quiz.cue_seconds,
      passing_score: quiz.passing_score,
    };
    this.quizEditorOpen.set(true);
  }

  async saveQuiz(): Promise<void> {
    const stage = this.selectedStage();
    if (!stage || !this.quizDraft.title.trim()) return;
    this.busy.set(true);
    try {
      await this.service.saveQuiz(this.editingQuizId(), {
        ...this.quizDraft,
        stage_id: stage.id,
        position: this.editingQuizId()
          ? this.quizzes().find((q) => q.id === this.editingQuizId())?.position
          : Math.max(0, ...this.quizzesFor(stage.id).map((q) => q.position)) + 1,
      });
      this.quizEditorOpen.set(false);
      await this.load();
      this.notice.set('Avaliação salva.');
    } catch (error) {
      this.notice.set(errorMessage(error, 'Não foi possível salvar a avaliação.'));
    } finally {
      this.busy.set(false);
    }
  }

  async deleteQuiz(quiz: LearningQuiz): Promise<void> {
    if (!window.confirm(`Excluir a avaliação ${quiz.title}?`)) return;
    try {
      await this.service.deleteQuiz(quiz.id);
      await this.load();
    } catch (error) {
      this.notice.set(errorMessage(error, 'Não foi possível excluir a avaliação.'));
    }
  }

  async manageQuestions(quiz: LearningQuiz): Promise<void> {
    this.editingQuizId.set(quiz.id);
    this.questionEditorOpen.set(true);
    this.newQuestion();
    try {
      this.authorQuestions.set(await this.service.authorQuestions(quiz.id));
    } catch (error) {
      this.notice.set(errorMessage(error, 'Não foi possível carregar as questões.'));
    }
  }

  newQuestion(): void {
    this.editingQuestionId.set(null);
    this.questionDraft = { prompt: '', options: '', correct_index: 0 };
  }

  editQuestion(q: LearningQuestion): void {
    this.editingQuestionId.set(q.id);
    this.questionDraft = {
      prompt: q.prompt,
      options: q.options.join('\n'),
      correct_index: q.correct_index,
    };
  }

  async saveQuestion(): Promise<void> {
    const quizId = this.editingQuizId();
    if (!quizId) return;
    const options = this.questionDraft.options
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean);
    if (
      !this.questionDraft.prompt.trim() ||
      options.length < 2 ||
      this.questionDraft.correct_index >= options.length
    ) {
      this.notice.set('Informe a pergunta, pelo menos duas opções e a resposta correta.');
      return;
    }
    this.busy.set(true);
    try {
      await this.service.saveQuestion(this.editingQuestionId(), {
        quiz_id: quizId,
        prompt: this.questionDraft.prompt.trim(),
        options,
        correct_index: Number(this.questionDraft.correct_index),
        position: this.editingQuestionId()
          ? this.authorQuestions().find((q) => q.id === this.editingQuestionId())?.position
          : Math.max(0, ...this.authorQuestions().map((q) => q.position)) + 1,
      });
      this.authorQuestions.set(await this.service.authorQuestions(quizId));
      this.newQuestion();
      this.notice.set('Questão salva.');
    } catch (error) {
      this.notice.set(errorMessage(error, 'Não foi possível salvar a questão.'));
    } finally {
      this.busy.set(false);
    }
  }

  async deleteQuestion(q: LearningQuestion): Promise<void> {
    try {
      await this.service.deleteQuestion(q.id);
      this.authorQuestions.set(await this.service.authorQuestions(q.quiz_id));
    } catch (error) {
      this.notice.set(errorMessage(error, 'Não foi possível excluir a questão.'));
    }
  }
}
