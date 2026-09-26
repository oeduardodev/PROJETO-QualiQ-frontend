import type { Dimension } from '@core/models/database';

export interface DimensionFormValue {
  name: string;
  description: string;
  color_key: string;
  order_index: number;
}

export function toDimensionPayload(value: DimensionFormValue): Partial<Dimension> {
  return { ...value, description: value.description || null, custom_fields: null };
}
