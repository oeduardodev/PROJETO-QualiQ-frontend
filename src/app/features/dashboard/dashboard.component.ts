import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import type {
  DashboardIdentity,
  DashboardPost,
  DashboardScheduledPlan,
  Indicator,
  IndicatorHistoryEntry,
  Profile,
} from '@core/models/database';
import { IndicatorService } from '@features/indicators/data-access/indicator.service';
import { formatIndicatorValue } from '@features/indicators/data-access/indicator-unit.utils';
import { todayInSaoPaulo } from '@features/indicators/indicator-deadline.utils';
import { isOnTarget } from '@features/indicators/indicator-panel.utils';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { errorMessage } from '@shared/utils/error.utils';
import { DashboardRepository } from './dashboard.repository';
import { latestInMonth, shiftMonth } from './dashboard-period.utils';

interface IndicatorMonthRow {
  indicator: Indicator;
  current: IndicatorHistoryEntry | null;
  previous: IndicatorHistoryEntry | null;
  onTarget: boolean | null;
  movement: 'better' | 'worse' | 'same' | 'unknown';
}
interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  plan: string;
  overdue: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IconDirective, ModalComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly repository = inject(DashboardRepository);
  private readonly indicatorService = inject(IndicatorService);
  readonly auth = inject(AuthService);
  readonly today = todayInSaoPaulo();
  readonly currentMonth = this.today.slice(0, 7);
  readonly previousMonth = shiftMonth(this.currentMonth, -1);
  readonly calendarMonth = signal(this.currentMonth);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly postOpen = signal(false);
  readonly identityOpen = signal(false);
  readonly editingPost = signal<DashboardPost | null>(null);
  readonly posts = signal<DashboardPost[]>([]);
  readonly identity = signal<DashboardIdentity | null>(null);
  readonly companyName = signal('');
  readonly birthdays = signal<Profile[]>([]);
  readonly indicators = signal<Indicator[]>([]);
  readonly histories = signal<IndicatorHistoryEntry[]>([]);
  readonly plans = signal<DashboardScheduledPlan[]>([]);

  readonly postForm = new FormGroup({
    kind: new FormControl<'news' | 'announcement'>('announcement', { nonNullable: true }),
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(160)],
    }),
    body: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(5000)],
    }),
    expires: new FormControl('', { nonNullable: true }),
  });
  readonly identityForm = new FormGroup({
    logo_url: new FormControl('', { nonNullable: true, validators: Validators.maxLength(1000) }),
    mission: new FormControl('', { nonNullable: true, validators: Validators.maxLength(2000) }),
    vision: new FormControl('', { nonNullable: true, validators: Validators.maxLength(2000) }),
    values: new FormControl('', { nonNullable: true, validators: Validators.maxLength(2000) }),
  });

  readonly monthLabel = computed(() => this.formatMonth(this.calendarMonth()));
  readonly previousMonthLabel = this.formatMonth(this.previousMonth);
  readonly indicatorRows = computed<IndicatorMonthRow[]>(() => {
    const byIndicator = new Map<string, IndicatorHistoryEntry[]>();
    for (const entry of this.histories()) {
      const entries = byIndicator.get(entry.indicator_id) ?? [];
      entries.push(entry);
      byIndicator.set(entry.indicator_id, entries);
    }
    return this.indicators()
      .filter((item) => !item.obsolete)
      .map((indicator) => {
        const entries = byIndicator.get(indicator.id) ?? [];
        const current = latestInMonth(entries, this.currentMonth);
        const previous = latestInMonth(entries, this.previousMonth);
        const onTarget = current
          ? isOnTarget(
              current.value,
              current.goal,
              indicator.goal_direction,
              indicator.acceptable_variation,
            )
          : null;
        const delta = current && previous ? current.value - previous.value : null;
        const movement =
          delta === null
            ? 'unknown'
            : delta === 0
              ? 'same'
              : (indicator.goal_direction === 'lower' ? delta < 0 : delta > 0)
                ? 'better'
                : 'worse';
        return { indicator, current, previous, onTarget, movement };
      });
  });
  readonly indicatorSummary = computed(() => ({
    on: this.indicatorRows().filter((row) => row.onTarget === true).length,
    off: this.indicatorRows().filter((row) => row.onTarget === false).length,
    pending: this.indicatorRows().filter((row) => row.onTarget === null).length,
    improved: this.indicatorRows().filter((row) => row.movement === 'better').length,
  }));
  readonly visiblePosts = computed(() =>
    this.posts().filter((post) => !post.expires_at || post.expires_at >= new Date().toISOString()),
  );
  readonly announcements = computed(() =>
    this.visiblePosts()
      .filter((post) => post.kind === 'announcement')
      .slice(0, 4),
  );
  readonly news = computed(() =>
    this.visiblePosts()
      .filter((post) => post.kind === 'news')
      .slice(0, 4),
  );
  readonly monthBirthdays = computed(() =>
    this.birthdays()
      .filter((person) => person.birth_date?.slice(5, 7) === this.currentMonth.slice(5, 7))
      .sort((a, b) => (a.birth_date?.slice(8) ?? '').localeCompare(b.birth_date?.slice(8) ?? '')),
  );
  readonly calendarEvents = computed<CalendarEvent[]>(() => {
    return this.plans()
      .flatMap((plan) => {
        const events: CalendarEvent[] = [];
        if (plan.due_date && /^\d{4}-\d{2}-\d{2}$/.test(plan.due_date))
          events.push({
            id: `${plan.id}-plan`,
            date: plan.due_date,
            title: plan.title,
            plan: plan.code,
            overdue: plan.due_date < this.today,
          });
        for (const task of plan.tasks ?? []) {
          if (!task.completed && /^\d{4}-\d{2}-\d{2}$/.test(task.due_date))
            events.push({
              id: `${plan.id}-${task.id}`,
              date: task.due_date,
              title: task.title,
              plan: plan.code,
              overdue: task.due_date < this.today,
            });
        }
        return events;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  });
  readonly alerts = computed(() => {
    const end = new Date(`${this.today}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 7);
    const events = this.calendarEvents();
    const overdue = events
      .filter((event) => event.overdue)
      .reverse()
      .slice(0, 3);
    const upcoming = events
      .filter((event) => !event.overdue && event.date <= end.toISOString().slice(0, 10))
      .slice(0, 6 - overdue.length);
    return [...overdue, ...upcoming];
  });
  readonly calendarDays = computed(() => {
    const [year, month] = this.calendarMonth().split('-').map(Number);
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const days: (string | null)[] = Array(firstWeekday).fill(null);
    for (let day = 1; day <= count; day++)
      days.push(`${this.calendarMonth()}-${String(day).padStart(2, '0')}`);
    while (days.length % 7) days.push(null);
    return days;
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const establishmentId = this.auth.profile()?.establishment_id;
    const results = await Promise.allSettled([
      this.indicatorService.fetchIndicators(),
      this.repository.fetchRecentIndicatorHistory(
        this.previousMonth,
        shiftMonth(this.currentMonth, 1),
      ),
      this.repository.fetchScheduledPlans(),
      this.repository.fetchPosts(),
      this.repository.fetchIdentity(),
      this.repository.fetchBirthdays(),
      establishmentId ? this.repository.fetchCompanyName(establishmentId) : Promise.resolve(''),
    ] as const);
    if (results[0].status === 'fulfilled') this.indicators.set(results[0].value);
    if (results[1].status === 'fulfilled') this.histories.set(results[1].value);
    if (results[2].status === 'fulfilled') this.plans.set(results[2].value);
    if (results[3].status === 'fulfilled') this.posts.set(results[3].value);
    if (results[4].status === 'fulfilled') this.identity.set(results[4].value);
    if (results[5].status === 'fulfilled') this.birthdays.set(results[5].value);
    if (results[6].status === 'fulfilled') this.companyName.set(results[6].value);
    const rejected = results.filter((result) => result.status === 'rejected');
    if (rejected.length)
      this.error.set(
        `Algumas informações não puderam ser carregadas. ${errorMessage(rejected[0].reason, '')}`,
      );
    this.loading.set(false);
  }

  changeMonth(offset: number): void {
    this.calendarMonth.update((month) => shiftMonth(month, offset));
  }

  eventsOn(date: string): CalendarEvent[] {
    return this.calendarEvents().filter((event) => event.date === date);
  }

  formatMonth(month: string): string {
    const [year, number] = month.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, number - 1, 1)));
  }

  formatDate(date: string): string {
    return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
  }

  localTimestampDate(timestamp: string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(timestamp));
  }

  formatTimestamp(timestamp: string): string {
    return this.formatDate(this.localTimestampDate(timestamp));
  }

  formatValue(value: number, indicator: Indicator): string {
    return formatIndicatorValue(value, indicator.unit, indicator.decimal_places);
  }

  openNewPost(): void {
    this.editingPost.set(null);
    this.postForm.reset({ kind: 'announcement', title: '', body: '', expires: '' });
    this.formError.set(null);
    this.postOpen.set(true);
  }

  openPost(post: DashboardPost): void {
    this.editingPost.set(post);
    this.postForm.reset({
      kind: post.kind,
      title: post.title,
      body: post.body,
      expires: post.expires_at ? this.localTimestampDate(post.expires_at) : '',
    });
    this.formError.set(null);
    this.postOpen.set(true);
  }

  async savePost(): Promise<void> {
    if (this.postForm.invalid || this.saving()) {
      this.postForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    try {
      const value = this.postForm.getRawValue();
      await this.repository.savePost(
        {
          kind: value.kind,
          title: value.title.trim(),
          body: value.body.trim(),
          expires_at: value.expires ? `${value.expires}T23:59:59-03:00` : null,
        },
        this.editingPost()?.id,
      );
      this.posts.set(await this.repository.fetchPosts());
      this.postOpen.set(false);
    } catch (error) {
      this.formError.set(errorMessage(error, 'Não foi possível salvar a publicação.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deletePost(): Promise<void> {
    const post = this.editingPost();
    if (!post || this.saving() || !window.confirm('Excluir esta publicação?')) return;
    this.saving.set(true);
    this.formError.set(null);
    try {
      await this.repository.deletePost(post.id);
      this.posts.update((posts) => posts.filter((item) => item.id !== post.id));
      this.postOpen.set(false);
    } catch (error) {
      this.formError.set(errorMessage(error, 'Não foi possível excluir a publicação.'));
    } finally {
      this.saving.set(false);
    }
  }

  openIdentity(): void {
    const identity = this.identity();
    this.identityForm.reset({
      logo_url: identity?.logo_url ?? '',
      mission: identity?.mission ?? '',
      vision: identity?.vision ?? '',
      values: identity?.values ?? '',
    });
    this.formError.set(null);
    this.identityOpen.set(true);
  }

  async saveIdentity(): Promise<void> {
    if (this.identityForm.invalid || this.saving()) {
      this.identityForm.markAllAsTouched();
      return;
    }
    const value = this.identityForm.getRawValue();
    if (value.logo_url && !/^https:\/\/\S+$/i.test(value.logo_url.trim())) {
      this.formError.set('Informe uma URL HTTPS para o logo.');
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    try {
      this.identity.set(await this.repository.saveIdentity(value));
      this.identityOpen.set(false);
    } catch (error) {
      this.formError.set(errorMessage(error, 'Não foi possível salvar a identidade.'));
    } finally {
      this.saving.set(false);
    }
  }
}
