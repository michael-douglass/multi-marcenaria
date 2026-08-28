import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'https://esm.sh/zod@3.23.8';
import { corsHeaders } from '../_shared/cors.ts';

const GenerationTypeSchema = z.enum([
  'Criar aleatoriamente',
  'Criar com Script',
  'Criar com sugestão',
]);

type GenerationType = z.infer<typeof GenerationTypeSchema>;

const RequestSchema = z.object({
  tipo_geracao: GenerationTypeSchema,
  titulo: z.string().optional().nullable().default(''),
  script_copy: z.string().nullable().optional(),
  sugestao: z.string().optional(),
  card_id: z.string().optional(),
  personality_id: z.string().uuid({
    message: 'Selecione uma personalidade no Gerar com IA',
  }),
});

interface AgentRow {
  slug: string;
  nome: string;
  system_prompt: string;
  user_prompt_template: string;
  model: string | null;
  ativo: boolean;
}

interface PersonalityRow {
  id: string;
  nome: string;
  system_prompt: string;
  user_prompt_template: string;
  model: string | null;
  ativo: boolean;
  is_default: boolean;
}

interface CopyVoice {
  source: 'personality' | 'agent';
  id: string;
  nome: string;
  system_prompt: string;
  user_prompt_template: string;
  model: string | null;
}

interface StudioConfig {
  id: string;
  ativo: boolean;
  model_pesquisa: string;
  model_copy: string;
}

interface StudioSecrets {
  openai_api_key: string | null;
  serp_api_key: string | null;
}

class ProviderError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fillTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.split(`{{${key}}}`).join(value || '(não informado)'),
    template
  );
}

function parseCopyOutput(raw: string): { titulo?: string; conteudo: string } {
  const texto = raw.trim();
  const tituloMatch = texto.match(/T[íi]tulo\s*:\s*(.+?)(?:\n|$)/i);
  const conteudoMatch = texto.match(/Conte[úu]do\s*:\s*([\s\S]+)/i);

  const titulo = tituloMatch?.[1]?.trim();
  let conteudo = conteudoMatch?.[1]?.trim();

  if (!conteudo) {
    conteudo = texto;
  }

  if (titulo && conteudoMatch) {
    return {
      titulo,
      conteudo: `Título: ${titulo}\n\n${conteudo}`,
    };
  }

  return { titulo, conteudo };
}

function modeInstruction(tipo: GenerationType, personalityNome: string): string {
  const isCriadora = /criadora/i.test(personalityNome);

  const extrasCriadora = isCriadora
    ? `
REGRAS OBRIGATÓRIAS (personalidade Criadora de Conteúdo):
1) COMPRIMENTO: o Conteúdo deve ser LONGO — mínimo 350 palavras, ideal 400–550 palavras (roteiro de ~2,5 a 4 minutos falados). Proibido roteiro curtinho de 1 minuto.
2) Desenvolva bem a ENTREGA: explique com exemplos, passos e ritmo (não resuma em 3 frases).
3) CTA: feche APENAS pedindo para SEGUIR o perfil (ex.: "me segue para mais conteúdos como este").
PROIBIDO no fechamento: vender, aula experimental, link de compra, "clique na bio para método pago", CTA comercial.`
    : '';

  if (tipo === 'Criar com Script') {
    return `INSTRUÇÃO DO MODO (obrigatória):
Aprimore e reescreva o script fornecido em "Base de conhecimento/Script".
Mantenha a ideia central, corrija clareza e fortaleça a estrutura da personalidade ativa.
Não ignore o script original — ele é a base.${extrasCriadora}`;
  }

  if (tipo === 'Criar com sugestão') {
    return `INSTRUÇÃO DO MODO (obrigatória):
O tema veio da sugestão do usuário. O Briefing de pesquisa traz fatos, números e ângulo sobre ESSE tema.
Use a sugestão como norte e o briefing como base de autoridade.
Proibido: texto genérico ou superficial. Entregue valor concreto com dado/fato do briefing.
Não invente estatísticas que não estejam no briefing.${extrasCriadora}`;
  }

  return `INSTRUÇÃO DO MODO (obrigatória):
Use o Briefing de pesquisa como base do tema (ele já veio de uma semente ALEATÓRIA).
Não force o tema "frações" nem matemática se o briefing for de outro pilar.
Proibido: texto genérico — use o insight e os dados do briefing.${extrasCriadora}`;
}

/** Pilares rotativos para o modo Aleatório — evita sempre cair no mesmo tema (ex.: frações). */
const RANDOM_TOPIC_SEEDS: Array<{ pillar: string; query: string; hint: string }> = [
  {
    pillar: 'Português',
    query: 'alfabetização português sílabas acentos compreensão leitora defasagem Brasil estatísticas',
    hint: 'Gramática, sílabas, acentos ou interpretação de texto',
  },
  {
    pillar: 'Matemática — operações',
    query: 'tabuada multiplicação divisão dificuldades alunos ensino fundamental Brasil',
    hint: 'Tabuada, multiplicação ou divisão — NÃO foque em frações',
  },
  {
    pillar: 'Matemática — lógica',
    query: 'raciocínio lógico resolução problemas matemática educação Brasil crianças',
    hint: 'Lógica e resolução de problemas — NÃO foque em frações',
  },
  {
    pillar: 'Exames ENEM',
    query: 'ENEM 2025 2026 calendário mudanças dicas estudo redação estatísticas',
    hint: 'ENEM, redação ou calendário de provas',
  },
  {
    pillar: 'Exames CEFET / militares',
    query: 'CEFET vestibulinho concurso militar colégio naval preparação estudo',
    hint: 'CEFET, vestibulinho ou concursos militares',
  },
  {
    pillar: 'Curiosidade científica',
    query: 'curiosidades científicas crianças escola neurociência descobertas 2025 2026',
    hint: 'Curiosidade científica ou fato contraintuitivo',
  },
  {
    pillar: 'Curiosidade histórica',
    query: 'curiosidades história Brasil escola fatos pouco conhecidos educação',
    hint: 'Fato histórico com ângulo de storytelling',
  },
  {
    pillar: 'Neuroeducação',
    query: 'neuroeducação memória atenção aprendizado crianças estudo métodos Brasil',
    hint: 'Memória, atenção ou método de estudo',
  },
  {
    pillar: 'Leitura infantil',
    query: 'hábito leitura infantil Brasil defasagem compreensão textual estatísticas',
    hint: 'Leitura e compreensão textual',
  },
  {
    pillar: 'Matemática — frações (raro)',
    query: 'frações equivalentes dificuldades 6 ano ensino fundamental Brasil estatísticas',
    hint: 'Frações — use este pilar SÓ porque a semente caiu nele',
  },
];

function pickRandomTopicSeed(): {
  seed: number;
  pillar: string;
  query: string;
  hint: string;
} {
  const seed = Date.now() + Math.floor(Math.random() * 10_000);
  // Frações só no último slot (~10% das vezes)
  const index = seed % RANDOM_TOPIC_SEEDS.length;
  const picked = RANDOM_TOPIC_SEEDS[index];
  return { seed, ...picked };
}

interface SerpSearchResult {
  ok: boolean;
  text: string;
  warning?: string;
}

async function serpSearch(apiKey: string, query: string): Promise<SerpSearchResult> {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google');
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'pt-br');
  url.searchParams.set('gl', 'br');
  url.searchParams.set('num', '8');
  url.searchParams.set('api_key', apiKey);

  try {
    const response = await fetch(url.toString());
    const rawText = await response.text();
    let data: {
      error?: string;
      organic_results?: Array<{ title?: string; snippet?: string; link?: string }>;
    } = {};

    try {
      data = JSON.parse(rawText) as typeof data;
    } catch {
      return {
        ok: false,
        text: '',
        warning: `SerpAPI respondeu com conteúdo inválido (${response.status}).`,
      };
    }

    // SerpAPI às vezes devolve 200 com { error: "..." } ou 401/400
    if (!response.ok || data.error) {
      const detail = data.error || rawText.slice(0, 180);
      return {
        ok: false,
        text: '',
        warning: `SerpAPI falhou (${response.status}): ${detail}`,
      };
    }

    const organic = Array.isArray(data.organic_results) ? data.organic_results : [];
    if (organic.length === 0) {
      return {
        ok: false,
        text: '',
        warning: 'SerpAPI não retornou resultados orgânicos.',
      };
    }

    return {
      ok: true,
      text: organic
        .slice(0, 8)
        .map(
          (item, index) =>
            `${index + 1}. ${item.title ?? 'Sem título'}\n${item.snippet ?? ''}\nFonte: ${item.link ?? ''}`
        )
        .join('\n\n'),
    };
  } catch (error) {
    return {
      ok: false,
      text: '',
      warning: `SerpAPI indisponível: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function isModelNotFoundError(status: number, body: string): boolean {
  if (status !== 404 && status !== 400) return false;
  const lower = body.toLowerCase();
  return (
    lower.includes('model') &&
    (lower.includes('does not exist') ||
      lower.includes('not found') ||
      lower.includes('invalid') ||
      lower.includes('unsupported'))
  );
}

async function openAiChatOnce(params: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  temperature?: number;
}): Promise<string> {
  console.log('OpenAI request', { model: params.model, temperature: params.temperature ?? 0.7 });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      temperature: params.temperature ?? 0.7,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
    }),
  });

  const errText = response.ok ? '' : await response.text();

  if (!response.ok) {
    console.error('OpenAI error', { status: response.status, body: errText.slice(0, 400) });

    if (response.status === 401 || response.status === 403) {
      throw new ProviderError(
        `Chave OpenAI inválida ou sem permissão (${response.status}). Verifique a chave no Studio.`,
        400
      );
    }

    const err = new ProviderError(
      `OpenAI falhou (${response.status}): ${errText.slice(0, 300)}`,
      response.status >= 500 ? 502 : 400
    );
    (err as ProviderError & { modelIssue?: boolean }).modelIssue = isModelNotFoundError(
      response.status,
      errText
    );
    throw err;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new ProviderError('OpenAI retornou resposta vazia', 502);
  }
  return content.trim();
}

async function openAiChatWithFallback(params: {
  apiKey: string;
  model: string;
  fallbackModel?: string;
  system: string;
  user: string;
  temperature?: number;
}): Promise<{ content: string; modelUsed: string }> {
  const fallback = params.fallbackModel || 'gpt-4o-mini';
  const models = [params.model || fallback, fallback].filter(
    (m, i, arr) => Boolean(m) && arr.indexOf(m) === i
  );

  let lastError: unknown;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const content = await openAiChatOnce({
        apiKey: params.apiKey,
        model,
        system: params.system,
        user: params.user,
        temperature: params.temperature,
      });
      return { content, modelUsed: model };
    } catch (error) {
      lastError = error;

      // Auth inválida: não adianta tentar outro modelo
      if (
        error instanceof ProviderError &&
        (error.message.includes('Chave OpenAI inválida') || error.status === 401)
      ) {
        throw error;
      }

      const hasNext = i < models.length - 1;
      if (hasNext) {
        console.warn(`Falha com modelo ${model}; tentando fallback`, {
          message: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new ProviderError('Falha ao chamar OpenAI', 502);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Método não permitido' }, 405);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Não autorizado' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: 'Usuário não autenticado' }, 401);
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse({ error: 'JSON inválido' }, 400);
    }

    const parsed = RequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonResponse(
        {
          error: 'Payload inválido',
          details: parsed.error.flatten(),
        },
        400
      );
    }

    const { tipo_geracao, titulo, script_copy, sugestao, personality_id } = parsed.data;
    console.log('gerar-marketing-copy start', {
      tipo_geracao,
      user_id: user.id,
      personality_id: personality_id ?? null,
    });

    // Sempre tabelas crm_multiempresas_* (CRM multi empresas)
    const { data: config, error: configError } = await supabase
      .from('crm_multiempresas_marketing_ai_studio_config')
      .select('id, ativo, model_pesquisa, model_copy')
      .limit(1)
      .maybeSingle();

    if (configError || !config) {
      return jsonResponse({ error: 'Studio de IA não configurado' }, 500);
    }

    const studioConfig = config as StudioConfig;
    if (!studioConfig.ativo) {
      return jsonResponse(
        { error: 'Studio de IA desativado. Ative em Configurações.' },
        400
      );
    }

    const { data: secrets, error: secretsError } = await supabase
      .from('crm_multiempresas_marketing_ai_studio_secrets')
      .select('openai_api_key, serp_api_key')
      .eq('config_id', studioConfig.id)
      .maybeSingle();

    if (secretsError || !secrets) {
      return jsonResponse({ error: 'Chaves de API não encontradas. Configure no Studio.' }, 400);
    }

    const studioSecrets = secrets as StudioSecrets;
    if (!studioSecrets.openai_api_key?.trim()) {
      return jsonResponse({ error: 'Chave OpenAI não configurada no Studio.' }, 400);
    }

    const { data: agents, error: agentsError } = await supabase
      .from('crm_multiempresas_marketing_ai_agents')
      .select('slug, nome, system_prompt, user_prompt_template, model, ativo')
      .order('ordem', { ascending: true });

    if (agentsError || !agents?.length) {
      return jsonResponse({ error: 'Agentes de IA não encontrados' }, 500);
    }

    const agentsBySlug = Object.fromEntries(
      (agents as AgentRow[]).map((a) => [a.slug, a])
    ) as Record<string, AgentRow>;

    let copyVoice: CopyVoice | null = null;

    // Personalidade é obrigatória: a voz escolhida no card deve ir para o prompt
    {
      const { data: personality, error: personalityError } = await supabase
        .from('crm_multiempresas_marketing_ai_personalities')
        .select('id, nome, system_prompt, user_prompt_template, model, ativo, is_default')
        .eq('id', personality_id)
        .maybeSingle();

      if (personalityError) {
        return jsonResponse({ error: 'Erro ao carregar personalidade' }, 500);
      }
      if (!personality) {
        return jsonResponse(
          {
            error:
              'Personalidade não encontrada. Volte ao Gerar com IA e escolha Vendedora ou Criadora de Conteudo.',
          },
          400
        );
      }
      if (!(personality as PersonalityRow).ativo) {
        return jsonResponse(
          { error: 'Personalidade desativada. Escolha outra no Gerar com IA.' },
          400
        );
      }

      const p = personality as PersonalityRow;
      if (!p.system_prompt?.trim()) {
        return jsonResponse(
          {
            error: `A personalidade “${p.nome}” está sem system prompt. Abra Configurações → Personalidades, cole o prompt e salve.`,
          },
          400
        );
      }

      copyVoice = {
        source: 'personality',
        id: p.id,
        nome: p.nome,
        system_prompt: p.system_prompt,
        user_prompt_template: p.user_prompt_template,
        model: p.model,
      };
    }

    console.log('copy voice locked', {
      source: copyVoice.source,
      id: copyVoice.id,
      nome: copyVoice.nome,
      system_len: copyVoice.system_prompt.length,
      user_len: copyVoice.user_prompt_template.length,
    });

    const tituloValor = (titulo || '').trim();
    let scriptValor = (script_copy || '').trim();
    const sugestaoUsuario = (sugestao || '').trim();

    // Criar com Script: se o editor estiver vazio, usa o título como semente
    if (tipo_geracao === 'Criar com Script' && !scriptValor && tituloValor) {
      scriptValor = tituloValor;
    }

    if (tipo_geracao === 'Criar com sugestão' && !sugestaoUsuario) {
      return jsonResponse({ error: 'Informe uma sugestão para gerar o conteúdo' }, 400);
    }

    if (tipo_geracao === 'Criar com Script' && !scriptValor) {
      return jsonResponse(
        {
          error:
            'O Script de Copy está vazio. Escreva um rascunho no campo Script (ex.: “futebol”) e tente de novo.',
        },
        400
      );
    }

    let briefingPesquisa = '';
    let serpWarning: string | null = null;

    // Aleatório e Sugestão: mesma esteira Pesquisa → Copy (só muda a semente do tema)
    const needsPesquisa =
      tipo_geracao === 'Criar aleatoriamente' || tipo_geracao === 'Criar com sugestão';

    if (needsPesquisa) {
      const pesquisaAgent = agentsBySlug.pesquisa;
      if (!pesquisaAgent?.ativo) {
        return jsonResponse(
          {
            error:
              'Agente de Pesquisa está desativado (necessário para Aleatório e Com sugestão)',
          },
          400
        );
      }

      const isSugestao = tipo_geracao === 'Criar com sugestão';
      const randomSeed = !isSugestao ? pickRandomTopicSeed() : null;
      const searchQuery = isSugestao
        ? `${sugestaoUsuario} educação Brasil estatísticas aprendizado reforço escolar 2025 2026`
        : randomSeed!.query;

      console.log('pesquisa seed', {
        isSugestao,
        seed: randomSeed?.seed ?? null,
        pillar: randomSeed?.pillar ?? null,
        query: searchQuery,
      });

      let searchResults = '';
      const serpKey = studioSecrets.serp_api_key?.trim() || '';

      if (!serpKey) {
        serpWarning =
          'Chave SerpAPI ausente — gerando com conhecimento da IA (sem pesquisa web).';
        console.warn(serpWarning);
      } else {
        const serp = await serpSearch(serpKey, searchQuery);
        if (serp.ok) {
          searchResults = serp.text;
        } else {
          // Não bloqueia o fluxo: continua só com OpenAI
          serpWarning =
            (serp.warning || 'Falha na SerpAPI') +
            ' — gerando com conhecimento da IA (sem pesquisa web). Confira a chave SerpAPI no Studio.';
          console.warn('serp fallback', { warning: serp.warning });
        }
      }

      const dataHoje = new Date().toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const pesquisaUser = fillTemplate(pesquisaAgent.user_prompt_template, {
        data_hoje: dataHoje,
      });

      const temaDirective = isSugestao
        ? `MODO SUGESTÃO (obrigatório):
O usuário JÁ escolheu o tema. NÃO escolha outro assunto.
Tema informado pelo usuário: "${sugestaoUsuario}"

Sua missão: pesquisar e aprofundar ESSE tema (fatos, dados, ângulo para mães de 6–17 anos).
Entregue o briefing no formato pedido (Tema / Resumo Estratégico / Dados de Autoridade / Insight para o Copy), centrado nesse tema.`
        : `MODO ALEATÓRIO (obrigatório — variar tema a cada geração):
Semente desta geração: ${randomSeed!.seed}
Pilar sorteado: ${randomSeed!.pillar}
Ângulo sugerido: ${randomSeed!.hint}

Escolha UM tema DENTRO deste pilar. Não troque de pilar.
Se o pilar NÃO for sobre frações, é PROIBIDO entregar briefing de frações.
Não escolha sempre o tema mais óbvio — use a semente ${randomSeed!.seed} para variar o recorte.
Entregue o briefing no formato pedido (Tema / Resumo Estratégico / Dados de Autoridade / Insight para o Copy).`;

      const pesquisaPrompt = searchResults
        ? `${pesquisaUser}

${temaDirective}

Resultados da pesquisa web:
${searchResults}

Use esses resultados para montar o briefing no formato pedido. Seja específico: números, datas e ângulo estratégico — sem superficialidade.`
        : `${pesquisaUser}

${temaDirective}

Não há resultados de pesquisa web disponíveis neste momento.
Monte um briefing útil e atual (sem inventar fontes falsas) com base no seu conhecimento sobre o PILAR sorteado, indicando claramente quando algo for estimativa.
Seja específico — sem superficialidade.`;

      const pesquisaResult = await openAiChatWithFallback({
        apiKey: studioSecrets.openai_api_key,
        model: pesquisaAgent.model || studioConfig.model_pesquisa || 'gpt-4o',
        fallbackModel: 'gpt-4o-mini',
        system: pesquisaAgent.system_prompt,
        user: pesquisaPrompt,
        temperature: isSugestao ? 0.7 : 1.05,
      });
      briefingPesquisa = pesquisaResult.content;
      console.log('pesquisa ok', {
        tipo_geracao,
        modelUsed: pesquisaResult.modelUsed,
        usedSerp: Boolean(searchResults),
        pillar: randomSeed?.pillar ?? null,
        serpWarning,
      });
    }

    // No aleatório, a "sugestão" do template é o próprio briefing (não há tema do usuário)
    const sugestaoValor =
      tipo_geracao === 'Criar com sugestão'
        ? sugestaoUsuario
        : tipo_geracao === 'Criar aleatoriamente'
          ? briefingPesquisa
          : tituloValor;

    const copyBase = fillTemplate(copyVoice.user_prompt_template, {
      sugestao: sugestaoValor,
      script_copy: scriptValor,
      briefing_pesquisa: briefingPesquisa,
    });

    // Trava a voz: a personalidade escolhida no card manda no tom (não misturar com outra)
    const copySystem = `IDENTIDADE OBRIGATÓRIA DA GERAÇÃO
Você DEVE escrever exclusivamente como a personalidade abaixo.
Nome da personalidade: ${copyVoice.nome}
Fonte: ${copyVoice.source === 'personality' ? 'personalidade salva no Studio' : 'agente copy'}
Proibido: mudar de voz, misturar outra persona ou ignorar as regras desta personalidade.

--- PERSONALIDADE (system prompt) ---
${copyVoice.system_prompt}`;

    const copyUser = `PERSONALIDADE EM USO AGORA: ${copyVoice.nome}
Siga o system prompt desta personalidade com prioridade máxima sobre qualquer outra tendência de estilo.

${modeInstruction(tipo_geracao, copyVoice.nome)}

${copyBase}`;

    const copyResult = await openAiChatWithFallback({
      apiKey: studioSecrets.openai_api_key,
      model: copyVoice.model || studioConfig.model_copy || 'gpt-4o-mini',
      fallbackModel: 'gpt-4o-mini',
      system: copySystem,
      user: copyUser,
      temperature: tipo_geracao === 'Criar aleatoriamente' ? 0.95 : 0.7,
    });

    console.log('copy ok', {
      tipo_geracao,
      modelUsed: copyResult.modelUsed,
      length: copyResult.content.length,
      personality: copyVoice.nome,
    });

    const result = parseCopyOutput(copyResult.content);

    return jsonResponse({
      success: true,
      tipo_geracao,
      titulo: result.titulo ?? null,
      conteudo: result.conteudo,
      briefing_pesquisa: briefingPesquisa || null,
      model_used: copyResult.modelUsed,
      personality_id: copyVoice.source === 'personality' ? copyVoice.id : null,
      personality_nome: copyVoice.nome,
      warning: serpWarning,
    });
  } catch (error) {
    console.error('gerar-marketing-copy error:', error);

    if (error instanceof ProviderError) {
      return jsonResponse({ error: error.message }, error.status);
    }

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Erro ao gerar conteúdo',
      },
      500
    );
  }
});
