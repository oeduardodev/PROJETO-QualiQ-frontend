import type { IndicatorStatus, IndicatorStatusOption } from '@core/models/database';

export function indicatorStatus(
  value: number,
  goal: number,
  options: Pick<IndicatorStatusOption, 'key' | 'min_goal_ratio' | 'order_index' | 'is_active'>[],
): IndicatorStatus | null {
  return (
    [...options]
      .filter((option) => option.is_active)
      .sort((a, b) =>
        b.min_goal_ratio === null
          ? -1
          : a.min_goal_ratio === null
            ? 1
            : b.min_goal_ratio - a.min_goal_ratio ||
              a.order_index - b.order_index ||
              a.key.localeCompare(b.key),
      )
      .find((option) => option.min_goal_ratio === null || value >= goal * option.min_goal_ratio)
      ?.key ?? null
  );
}
