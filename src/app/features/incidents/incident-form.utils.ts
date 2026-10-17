import type { FormFieldSchema, IncidentClassification, IncidentType } from '@core/models/database';

export function classificationSchema(
  type: IncidentType | undefined,
  classifications: IncidentClassification[],
): FormFieldSchema[] {
  return (
    classifications.find((c) => c.id === type?.classification_id)?.form_schema ??
    type?.form_schema ??
    []
  );
}

export function validateSchema(fields: FormFieldSchema[]): string | null {
  const names = new Set<string>();
  for (const field of fields) {
    if (!/^[a-z][a-z0-9_]{0,49}$/.test(field.name) || !field.label.trim())
      return 'Informe identificadores válidos e rótulos para todos os campos.';
    if (names.has(field.name)) return 'Os identificadores dos campos devem ser únicos.';
    names.add(field.name);
    if (field.type === 'select' && !field.options?.length)
      return 'Informe as opções de cada lista.';
  }
  return null;
}

export function validateAnswers(
  fields: FormFieldSchema[],
  answers: Record<string, unknown>,
): string | null {
  for (const field of fields) {
    const value = answers[field.name];
    const empty = value == null || String(value).trim() === '';
    if (field.required && empty) return `Preencha o campo ${field.label}.`;
    if (!empty && field.type === 'select' && !field.options?.includes(String(value)))
      return `Selecione uma opção válida em ${field.label}.`;
    if (!empty && field.type === 'number' && !Number.isFinite(Number(value)))
      return `Informe um número em ${field.label}.`;
  }
  return null;
}
