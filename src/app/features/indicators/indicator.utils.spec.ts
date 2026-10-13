import { indicatorStatus } from './indicator.utils';

const statuses = [
  { key: 'no_alvo', min_goal_ratio: 1, order_index: 10, is_active: true },
  { key: 'atencao', min_goal_ratio: 0.8, order_index: 20, is_active: true },
  { key: 'critico', min_goal_ratio: null, order_index: 30, is_active: true },
];

describe('indicatorStatus', () => {
  it('marks values at or above the goal as on target', () => {
    expect(indicatorStatus(100, 100, statuses)).toBe('no_alvo');
    expect(indicatorStatus(120, 100, statuses)).toBe('no_alvo');
  });

  it('marks the 80% threshold as requiring attention', () => {
    expect(indicatorStatus(80, 100, statuses)).toBe('atencao');
    expect(indicatorStatus(79, 100, statuses)).toBe('critico');
  });
});
