import { indicatorStatus } from './indicator.utils';

describe('indicatorStatus', () => {
  it('marks values at or above the goal as on target', () => {
    expect(indicatorStatus(100, 100)).toBe('no_alvo');
    expect(indicatorStatus(120, 100)).toBe('no_alvo');
  });

  it('marks the 80% threshold as requiring attention', () => {
    expect(indicatorStatus(80, 100)).toBe('atencao');
    expect(indicatorStatus(79, 100)).toBe('critico');
  });
});
