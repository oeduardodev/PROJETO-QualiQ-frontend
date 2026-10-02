const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
} as const;

interface IndicatorContext {
  title: string;
  current_value: number;
  goal_value: number;
  unit: string;
  status: string;
  frequency: string;
}

interface ProcessContext {
  title: string;
  code: string | null;
  owner: string | null;
}

interface TicketContext {
  title: string;
  description: string | null;
  severity: string;
  status: string;
  ishikawa: {
    maquina: string;
    metodo: string;
    mao_de_obra: string;
    material: string;
    meio_ambiente: string;
    medida: string;
  };
}

interface AnalysisRequest {
  indicator: IndicatorContext;
  process: ProcessContext | null;
  tickets: TicketContext[];
}

interface AIAnalysis {
  diagnostic: string;
  suggestions: {
    title: string;
    what: string;
    why: string;
    who: string;
    how: string;
    how_much: string;
  }[];
}

function buildSystemPrompt(): string {
  return `Você é um Engenheiro de Produção e Consultor Sênior de Qualidade com profunda experiência em metodologias Lean, Seis Sigma, Ishikawa (6Ms) e análise de causa raiz (RCA). Sua análise deve ser técnica, prática e acionável, sempre em português brasileiro.`;
}

function buildUserPrompt(req: AnalysisRequest): string {
  const ind = req.indicator;
  const proc = req.process;
  const tickets = req.tickets;

  const gap = ind.current_value - ind.goal_value;
  const lowerIsBetter = ind.unit !== '%';
  const direction = lowerIsBetter ? 'acima' : 'abaixo';
  const gapDescription =
    ind.goal_value === 0
      ? 'não calculável em percentual (meta zero)'
      : `${Math.abs((gap / ind.goal_value) * 100).toFixed(1)}% ${direction} da meta`;

  let prompt = `## CENÁRIO\n\n`;
  prompt += `**Indicador:** ${ind.title}\n`;
  prompt += `**Valor Atual:** ${ind.current_value} ${ind.unit}\n`;
  prompt += `**Meta:** ${ind.goal_value} ${ind.unit}\n`;
  prompt += `**Desvio:** ${gapDescription}\n`;
  prompt += `**Status:** ${ind.status}\n`;
  prompt += `**Frequência de medição:** ${ind.frequency}\n\n`;

  if (proc) {
    prompt += `**Processo Vinculado:** ${proc.code ?? ''} ${proc.title}\n`;
    prompt += `**Responsável:** ${proc.owner ?? 'Não definido'}\n\n`;
  }

  prompt += `## EVIDÊNCIAS — Não-Conformidades Vinculadas\n\n`;

  if (tickets.length === 0) {
    prompt += `Nenhum chamado de não-conformidade vinculado a este processo no momento.\n\n`;
  } else {
    prompt += `Total de chamados: ${tickets.length}\n\n`;
    tickets.forEach((t, i) => {
      prompt += `### Chamado ${i + 1}: ${t.title}\n`;
      prompt += `- **Severidade:** ${t.severity}\n`;
      prompt += `- **Status:** ${t.status}\n`;
      if (t.description) prompt += `- **Descrição:** ${t.description}\n`;
      const ishi = t.ishikawa;
      const filled6M = Object.entries(ishi).filter(([, v]) => v.trim());
      if (filled6M.length > 0) {
        prompt += `- **Análise Ishikawa (6Ms):**\n`;
        filled6M.forEach(([k, v]) => {
          const labels: Record<string, string> = {
            maquina: 'Máquina',
            metodo: 'Método',
            mao_de_obra: 'Mão de Obra',
            material: 'Material',
            meio_ambiente: 'Meio Ambiente',
            medida: 'Medida',
          };
          prompt += `  - **${labels[k] ?? k}:** ${v}\n`;
        });
      }
      prompt += `\n`;
    });
  }

  prompt += `## TAREFA\n\n`;
  prompt += `Analise as evidências acima, identifique a correlação entre o desvio do indicador e as falhas registradas nos 6Ms do Ishikawa, e gere exatamente 2 Planos de Ação práticos para corrigir o problema.\n\n`;
  prompt += `## FORMATO DE RESPOSTA (OBRIGATÓRIO)\n\n`;
  prompt += `Responda APENAS com um JSON válido, sem markdown, sem comentários, sem texto antes ou depois. O JSON deve ter exatamente esta estrutura:\n\n`;
  prompt += `{\n`;
  prompt += `  "diagnostic": "Texto do diagnóstico técnico correlacionando o desvio do indicador com as causas raiz identificadas nos 6Ms. Deve citar especificamente quais dos 6Ms estão falhando e por quê. Mínimo 3 frases, máximo 6 frases.",\n`;
  prompt += `  "suggestions": [\n`;
  prompt += `    {\n`;
  prompt += `      "title": "Título curto e acionável do plano de ação",\n`;
  prompt += `      "what": "O que fazer — descrição objetiva da ação",\n`;
  prompt += `      "why": "Por que fazer — justificativa técnica baseada na análise de causa raiz",\n`;
  prompt += `      "who": "Quem é o responsável pela execução (use o responsável do processo se disponível, senão sugira o cargo adequado)",\n`;
  prompt += `      "how": "Como fazer — passo a passo numerado (1. 2. 3. 4.) das etapas de execução",\n`;
  prompt += `      "how_much": "Quanto custa — estimativa de custo ou recurso necessário (pode ser qualitativa se não houver dados)"\n`;
  prompt += `    },\n`;
  prompt += `    {\n`;
  prompt += `      "title": "Título do segundo plano de ação (foco em prevenção/contenção)",\n`;
  prompt += `      "what": "...",\n`;
  prompt += `      "why": "...",\n`;
  prompt += `      "who": "...",\n`;
  prompt += `      "how": "...",\n`;
  prompt += `      "how_much": "..."\n`;
  prompt += `    }\n`;
  prompt += `  ]\n`;
  prompt += `}\n`;

  return prompt;
}

function extractJSON(text: string): unknown {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  // Find the first { and last } to extract the JSON object
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first === -1 || last === -1) {
    throw new Error('Resposta da IA não contém JSON válido');
  }
  cleaned = cleaned.substring(first, last + 1);
  return JSON.parse(cleaned);
}

function validateAnalysis(data: unknown): AIAnalysis {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Resposta da IA não é um objeto válido');
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.diagnostic !== 'string' || !obj.diagnostic.trim()) {
    throw new Error('Diagnóstico ausente ou inválido');
  }
  if (!Array.isArray(obj.suggestions) || obj.suggestions.length === 0) {
    throw new Error('Sugestões de ação ausentes ou inválidas');
  }
  const suggestions = (obj.suggestions as Record<string, unknown>[]).map((s) => ({
    title: String(s.title ?? ''),
    what: String(s.what ?? ''),
    why: String(s.why ?? ''),
    who: String(s.who ?? ''),
    how: String(s.how ?? ''),
    how_much: String(s.how_much ?? ''),
  }));
  return { diagnostic: obj.diagnostic, suggestions };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const publicKey = Deno.env.get('SUPABASE_ANON_KEY');
    const authorization = req.headers.get('authorization');
    const jwt = authorization?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
    if (!jwt || jwt.split('.').length !== 3) {
      return new Response(JSON.stringify({ error: 'Sessão de usuário obrigatória.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!supabaseUrl || !publicKey) {
      return new Response(JSON.stringify({ error: 'Autenticação indisponível.' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userHeaders = { apikey: publicKey, Authorization: `Bearer ${jwt}` };
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: userHeaders,
    });
    if (!userResponse.ok) {
      return new Response(JSON.stringify({ error: 'Sessão inválida.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const user = (await userResponse.json()) as { id?: string };
    if (!user.id) {
      return new Response(JSON.stringify({ error: 'Sessão inválida.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}&limit=1`,
      { headers: userHeaders },
    );
    if (!profileResponse.ok) throw new Error('Não foi possível verificar o perfil.');
    const profiles = (await profileResponse.json()) as { role: string }[];
    if (!['Admin', 'Gestor'].includes(profiles[0]?.role)) {
      return new Response(JSON.stringify({ error: 'Acesso negado.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentLength = Number(req.headers.get('content-length') ?? 0);
    if (contentLength > 65_536) {
      return new Response(JSON.stringify({ error: 'Requisição muito grande.' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const rawBody = await req.text();
    if (rawBody.length > 65_536) {
      return new Response(JSON.stringify({ error: 'Requisição muito grande.' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let body: AnalysisRequest;
    try {
      body = JSON.parse(rawBody) as AnalysisRequest;
    } catch {
      return new Response(JSON.stringify({ error: 'JSON inválido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (
      !body?.indicator ||
      typeof body.indicator.title !== 'string' ||
      !Number.isFinite(body.indicator.current_value) ||
      !Number.isFinite(body.indicator.goal_value) ||
      !Array.isArray(body.tickets) ||
      body.tickets.length > 100
    ) {
      return new Response(JSON.stringify({ error: 'Dados de análise inválidos.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('AI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Chave da API de IA não configurada no servidor.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const quotaResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_ai_quota`, {
      method: 'POST',
      headers: { ...userHeaders, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!quotaResponse.ok) throw new Error('Não foi possível verificar o limite de uso.');
    if ((await quotaResponse.json()) !== true) {
      return new Response(JSON.stringify({ error: 'Limite de análises atingido nesta hora.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(body);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `Erro da API de IA (${geminiResponse.status}). Tente novamente.` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const geminiData = await geminiResponse.json();

    // Gemini 2.5 may return multiple parts — some are "thought" tokens, the last is the actual text
    const parts = geminiData?.candidates?.[0]?.content?.parts ?? [];
    let text = '';
    for (const part of parts) {
      if (part.text && typeof part.text === 'string' && part.text.trim().startsWith('{')) {
        text = part.text;
        break;
      }
    }
    // Fallback: use last part's text
    if (!text && parts.length > 0) {
      text = parts[parts.length - 1]?.text ?? '';
    }
    if (!text) {
      return new Response(JSON.stringify({ error: 'Resposta vazia da API de IA.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = extractJSON(text);
    const analysis = validateAnalysis(parsed);

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Edge function error:', err);
    const message = err instanceof Error ? err.message : 'Erro interno no servidor.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
