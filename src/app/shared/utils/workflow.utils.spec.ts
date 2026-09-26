import { nextWorkflowStatus } from './workflow.utils';

describe('nextWorkflowStatus', () => {
  const statuses = ['rascunho', 'em_revisao', 'aprovado'] as const;

  it('advances to the next status', () => {
    expect(nextWorkflowStatus('rascunho', statuses)).toBe('em_revisao');
  });

  it('stays at the final status', () => {
    expect(nextWorkflowStatus('aprovado', statuses)).toBe('aprovado');
  });

  it('uses the first status when the current one is unknown', () => {
    expect(nextWorkflowStatus('desconhecido', statuses)).toBe('rascunho');
  });
});
