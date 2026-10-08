import { describe, expect, it } from 'vitest';
import {
  normalizeProcessTag,
  PROCESS_TAG_INPUT_PATTERN,
  processTag,
  processTagSuggestions,
} from './process-code.utils';
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

  it('suggests distinct existing tags in alphabetical order', () => {
    expect(
      processTagSuggestions([
        { code: 'FNA-002' },
        { code: 'arq-001' },
        { code: 'ARQ-003' },
        { code: 'LONG-004' },
        { code: null },
        { code: 'old custom code' },
      ]),
    ).toEqual(['ARQ', 'FNA']);
  });

  it('sends a normalized tag for database numbering', () => {
    expect(normalizeProcessTag(' f n a ')).toBe('FNA');
    expect(normalizeProcessTag('  ')).toBeNull();
    expect(
      toProcessPayload({
        title: ' Atendimento ',
        tag: ' a r q ',
        category_id: 'category-1',
        owner: '',
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

  it('preserves a legacy free-form code when editing another field', () => {
    const value = {
      title: 'Atendimento atualizado',
      tag: '',
      category_id: 'category-1',
      owner: '',
      impact_score: 5,
      complexity_score: 5,
      maturity_level: 1,
    };
    expect(toProcessPayload(value, { code: 'código antigo' }).code).toBe('código antigo');
    expect(toProcessPayload({ ...value, tag: 'FNA' }, { code: 'código antigo' }).code).toBe('FNA');
  });
});
