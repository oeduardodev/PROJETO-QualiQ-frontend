import { describe, expect, it } from 'vitest';
import { normalizeProcessTag, PROCESS_TAG_INPUT_PATTERN, processTag } from './process-code.utils';
import { toProcessPayload } from './process.mapper';

describe('process tags', () => {
  it('extracts tags from existing numbered codes and bare legacy tags', () => {
    expect(processTag('fin-004')).toBe('FIN');
    expect(processTag('ARQ')).toBe('ARQ');
    expect(processTag('FNA4-001')).toBe('');
    expect(processTag('AB-001')).toBe('');
    expect(processTag('old custom code')).toBe('');
    expect(processTag(null)).toBe('');
  });

  it('sends a normalized tag as the complete process code', () => {
    expect(normalizeProcessTag(' f n a ')).toBe('FNA');
    expect(normalizeProcessTag('  ')).toBeNull();
    expect(
      toProcessPayload({
        title: ' Atendimento ',
        tag: ' a r q ',
        category_id: 'category-1',
        owner: '',
        owner_id: '',
        participant_ids: [],
        description: '',
        objective: '',
        obsolete: false,
        impact_score: 5,
        complexity_score: 5,
        maturity_level: 1,
      }),
    ).toMatchObject({ title: 'Atendimento', code: 'ARQ', owner: null });
  });

  it('accepts only three letters after whitespace is removed', () => {
    expect(PROCESS_TAG_INPUT_PATTERN.test(' A R Q ')).toBe(true);
    expect(PROCESS_TAG_INPUT_PATTERN.test('   ')).toBe(true);
    expect(PROCESS_TAG_INPUT_PATTERN.test('AR')).toBe(false);
    expect(PROCESS_TAG_INPUT_PATTERN.test('ARQX')).toBe(false);
    expect(PROCESS_TAG_INPUT_PATTERN.test('AR4')).toBe(false);
  });
});
