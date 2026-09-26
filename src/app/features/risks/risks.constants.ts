import type { RiskStatus, RiskType } from '@core/models/database';

export const STATUSES: RiskStatus[] = ['identificado', 'em_analise', 'tratado', 'monitorado'];

export const TYPES: RiskType[] = ['Operacional', 'Estratégico', 'Financeiro', 'Compliance'];
