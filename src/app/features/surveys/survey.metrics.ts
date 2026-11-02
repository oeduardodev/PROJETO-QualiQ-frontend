import type { Survey, SurveyQuestion, SurveyResponse } from './survey.models';

export interface QuestionMetric {
  question: SurveyQuestion;
  count: number;
  average: number | null;
  favorablePercent: number | null;
  nps: number | null;
  promoters: number;
  passives: number;
  detractors: number;
}

export function questionMetrics(survey: Survey, responses: SurveyResponse[]): QuestionMetric[] {
  return survey.questions
    .filter((q) => q.type !== 'text')
    .map((question) => {
      const scores = responses
        .map((response) => response.answers[question.id])
        .filter((value): value is number => typeof value === 'number');
      const count = scores.length;
      const promoters = scores.filter((score) => score >= 9).length;
      const passives = scores.filter((score) => score >= 7 && score <= 8).length;
      const detractors = scores.filter((score) => score <= 6).length;
      return {
        question,
        count,
        average:
          count && question.type === 'likert' ? scores.reduce((a, b) => a + b, 0) / count : null,
        favorablePercent:
          count && question.type === 'likert'
            ? (100 * scores.filter((score) => score >= 4).length) / count
            : null,
        nps:
          count && question.type === 'nps'
            ? Math.round((100 * (promoters - detractors)) / count)
            : null,
        promoters: question.type === 'nps' ? promoters : 0,
        passives: question.type === 'nps' ? passives : 0,
        detractors: question.type === 'nps' ? detractors : 0,
      };
    });
}

export function overallNps(metrics: QuestionMetric[]): number | null {
  const nps = metrics.filter((metric) => metric.question.type === 'nps');
  const total = nps.reduce((sum, metric) => sum + metric.count, 0);
  if (!total) return null;
  return Math.round(
    (100 * nps.reduce((sum, metric) => sum + metric.promoters - metric.detractors, 0)) / total,
  );
}

export function overallLikert(metrics: QuestionMetric[]): number | null {
  const likert = metrics.filter((metric) => metric.question.type === 'likert');
  const count = likert.reduce((sum, metric) => sum + metric.count, 0);
  if (!count) return null;
  return likert.reduce((sum, metric) => sum + (metric.average ?? 0) * metric.count, 0) / count;
}
