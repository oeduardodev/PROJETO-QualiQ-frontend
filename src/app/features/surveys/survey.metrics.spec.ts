import { describe, expect, it } from 'vitest';
import { overallLikert, overallNps, questionMetrics } from './survey.metrics';
import type { Survey, SurveyResponse } from './survey.models';

const survey = {
  questions: [
    { id: 'l', type: 'likert', prompt: 'Atendimento', required: true, criterion_id: null },
    { id: 'n', type: 'nps', prompt: 'Recomendação', required: true, criterion_id: null },
  ],
} as Survey;
const responses = [
  { answers: { l: 5, n: 10 } },
  { answers: { l: 3, n: 8 } },
  { answers: { l: 4, n: 2 } },
] as SurveyResponse[];

describe('métricas de satisfação', () => {
  it('calcula Likert e NPS pelas respectivas escalas', () => {
    const metrics = questionMetrics(survey, responses);
    expect(metrics[0].average).toBe(4);
    expect(metrics[0].favorablePercent).toBeCloseTo(66.67, 1);
    expect(metrics[1].nps).toBe(0);
    expect(metrics[1].promoters).toBe(1);
    expect(metrics[1].passives).toBe(1);
    expect(metrics[1].detractors).toBe(1);
    expect(overallLikert(metrics)).toBe(4);
    expect(overallNps(metrics)).toBe(0);
  });
});
