import { toIncidentTypePayload } from './incident-type.mapper';
import { toIncidentClassificationPayload } from './incident-classification.mapper';

describe('incident configuration payloads', () => {
  it('does not erase a type schema when changing editable metadata', () => {
    const payload = toIncidentTypePayload(
      {
        name: 'Incidente',
        code: 'INC',
        classification_id: '',
        default_severity: 'media',
        sla_hours: null,
        sla_id: '',
        risk_id: '',
        active: true,
      },
      undefined,
    );

    expect(payload).not.toHaveProperty('form_schema');
    expect(payload).not.toHaveProperty('custom_fields_schema');
    expect(payload).not.toHaveProperty('description');
  });

  it('does not erase a classification schema when changing editable metadata', () => {
    const payload = toIncidentClassificationPayload({
      name: 'Ocorrências',
      code: 'OCO',
      default_severity: 'media',
      sla_hours: null,
      analysis_tool: 'Nenhuma',
      requires_root_cause: false,
      active: true,
    });

    expect(payload).not.toHaveProperty('form_schema');
    expect(payload).not.toHaveProperty('description');
  });
});
