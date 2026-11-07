import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

let handler;
globalThis.Deno = {
  env: {
    get: (name) =>
      ({
        SUPABASE_URL: 'https://db.example',
        SUPABASE_ANON_KEY: 'test-anon-key',
        AI_API_KEY: 'test-ai-key',
      })[name],
  },
  serve: (callback) => {
    handler = callback;
  },
};

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const indicatorId = '11111111-1111-4111-8111-111111111111';
const processId = '22222222-2222-4222-8222-222222222222';
const originalFetch = globalThis.fetch;
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const gemini = (suggestions) =>
  json({
    candidates: [{ content: { parts: [{ text: JSON.stringify({ suggestions }) }] } }],
  });

function mockData(primary, fallback) {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('/rpc/user_can_edit')) return json(true);
    if (url.includes('/rpc/consume_ai_quota')) return json(true);
    if (url.includes('/indicators?'))
      return json([
        {
          id: indicatorId,
          title: 'Índice de perdas',
          process_id: processId,
          current_value: 12,
          goal_value: 5,
          goal_direction: 'lower',
          status: 'critico',
          unit: 'percentual',
        },
      ]);
    if (url.includes('/processes?')) return json([{ id: processId, title: 'Produção' }]);
    if (url.includes('/rest/v1/')) return json([]);
    if (url.includes('gemini-3.5-flash-lite')) return primary();
    if (url.includes('gemini-3.6-flash')) return fallback();
    throw new Error(`Unexpected fetch: ${url}`);
  };
}

const request = () =>
  new Request('https://db.example/functions/v1/intelligent-action-plans', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token' },
  });

test('retries a timed out Gemini call with the fallback model', async () => {
  mockData(
    () => {
      throw new DOMException('Signal timed out.', 'TimeoutError');
    },
    () =>
      json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    suggestions: [
                      {
                        source_type: 'indicator',
                        source_id: indicatorId,
                        title: 'Revisar perdas',
                        what: 'Medir perdas por etapa',
                        why: 'Resultado 12% acima da meta de 5%',
                        where: 'Produção',
                        how: 'Mapear causas e revisar processo',
                        how_much: 'A estimar',
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
  );
  try {
    const response = await handler(request());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.suggestions[0].source_id, indicatorId);
    assert.equal(body.suggestions[0].process_id, processId);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns a clear 503 when both models are unavailable', async () => {
  mockData(
    () => json({ error: 'overloaded' }, 503),
    () => {
      throw new DOMException('Signal timed out.', 'TimeoutError');
    },
  );
  try {
    const response = await handler(request());
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.match(body.error, /temporariamente indisponível/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('accepts empty optional fields without inventing source facts', async () => {
  mockData(
    () =>
      gemini([
        {
          title: 'Reduzir perdas',
          what: 'Mapear perdas por etapa',
          why: '',
          where: '',
          how: '',
          how_much: '',
          source_id: 'invalid-id',
        },
      ]),
    () => {
      throw new Error('Fallback should not run');
    },
  );
  try {
    const response = await handler(request());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.suggestions[0].source_id, indicatorId);
    assert.equal(body.suggestions[0].where, 'Produção');
    assert.equal(body.suggestions[0].how_much, 'A estimar na central');
    assert.match(body.suggestions[0].why, /12/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('tries the fallback model when the first response has no usable plan', async () => {
  let fallbackCalled = false;
  mockData(
    () => gemini([{}]),
    () => {
      fallbackCalled = true;
      return gemini([{ title: 'Revisar perdas', what: 'Medir perdas' }]);
    },
  );
  try {
    const response = await handler(request());
    assert.equal(response.status, 200);
    assert.equal(fallbackCalled, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
