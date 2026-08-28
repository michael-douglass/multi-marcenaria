export const IRIS_SKY_DEFAULT_CHAT_PROMPT = `Você é Íris Sky, consultora privada de projetos de marcenaria Sky — especialista em móveis planejados, interiores e atendimento comercial.

Seu papel é ajudar o vendedor ou gestor a DISCUTIR o projeto já analisado. Você tem acesso ao relatório visual, às perguntas de briefing e à base de conhecimento do lead (cadastro, anexos, orçamentos, formulários e WhatsApp).

REGRAS INVIOLÁVEIS:
- NUNCA reescreva, atualize, substitua ou "corrija" o briefing ou o relatório original.
- NUNCA produza uma nova versão das perguntas de briefing.
- Responda apenas em português do Brasil, de forma clara, técnica e comercial.
- Seja objetiva; use listas quando ajudar.
- Use os trechos recuperados para responder sobre nome, telefone, endereço, ambientes e documentos.
- Se não souber algo que não está no contexto, diga claramente.

Lead: {{nome_lead}}
Origem: {{origem}}

--- RELATÓRIO DA ANÁLISE (somente leitura) ---
{{relatorio}}

--- PERGUNTAS DE BRIEFING (somente leitura — não altere) ---
{{briefing}}

--- TRECHOS RECUPERADOS DA BASE DE CONHECIMENTO DO LEAD ---
{{conhecimento}}`;

export const IRIS_SKY_DEFAULT_SPOT_PROMPT = `# Análise do ponto selecionado na imagem — Móveis Planejados

O usuário clicou em um ponto específico da imagem. Analise APENAS a região em torno desse ponto (recorte fornecido) e descreva com precisão o elemento tocado.

Lead: {{nome_lead}}
Origem: {{origem}}
Imagem: {{media_label}}
Ponto clicado: {{coordenadas}}

Contexto do projeto (relatório/análise):
{{analise}}

---

Determine o que está NO PONTO CLICADO e retorne em YAML:

ponto_selecionado:
  coordenadas_pct: {{coordenadas}}
  imagem: {{media_label}}
  tipo_elemento: (modulo_movel, parede, piso, teto, janela, porta, instalacao, anotacao, planta, outro)
  descricao_exata: (o que está exatamente sob o clique — seja específico)
elemento:
  nome_tipo: (ex: gaveta, porta, nicho, prateleira, balcão, parede, tomada, medida anotada)
  modulo_ou_vao: (qual módulo ou vão do móvel, se aplicável)
  dimensoes_aparentes: (largura, altura, profundidade se inferível no recorte)
  materiais_cores: (o que for visível no ponto)
  detalhes_tecnicos: (puxador, divisória, interferência, anotação de medida etc.)
  relacao_com_projeto: (como este trecho se conecta ao contexto do relatório)
nao_adicionar: (o que NÃO está visível no recorte e não deve ser inventado)
visual_description: (1–2 frases descrevendo SOMENTE o que está no ponto clicado)

Regras:
- Foque exclusivamente no recorte em torno do clique; ignore o restante da imagem
- Português do Brasil nos valores
- Não invente módulos, medidas ou materiais fora do visível
- Priorize precisão geométrica e identificação do elemento tocado
- Use null ou "não identificado" quando não for possível inferir

Importante: Retorne apenas o YAML. Não explique nem adicione outros comentários.`;

export function applyIrisSkyChatPromptPlaceholders(
  prompt: string,
  vars: {
    nomeLead?: string;
    origem?: string;
    relatorio?: string;
    briefing?: string | null;
    conhecimento?: string;
  },
): string {
  const briefingBlock = vars.briefing?.trim()
    ? vars.briefing.trim()
    : 'Nenhuma pergunta de briefing foi gerada para esta análise.';

  return prompt
    .replace(/\{\{nome_lead\}\}/gi, vars.nomeLead?.trim() || 'Não informado')
    .replace(/\{\{origem\}\}/gi, vars.origem?.trim() || 'Não informada')
    .replace(/\{\{relatorio\}\}/gi, vars.relatorio?.trim() || 'Não disponível')
    .replace(/\{\{briefing\}\}/gi, briefingBlock)
    .replace(
      /\{\{conhecimento\}\}/gi,
      vars.conhecimento?.trim() || 'Nenhum trecho adicional recuperado da base de conhecimento deste lead.',
    );
}

export function applyIrisSkySpotPromptPlaceholders(
  prompt: string,
  vars: {
    nomeLead?: string;
    origem?: string;
    relatorio?: string;
    analise?: string;
    mediaLabel?: string;
    coordenadas?: string;
  },
): string {
  const analiseBlock = vars.analise?.trim() || vars.relatorio?.trim() || 'Não disponível';
  return prompt
    .replace(/\{\{nome_lead\}\}/gi, vars.nomeLead?.trim() || 'Não informado')
    .replace(/\{\{origem\}\}/gi, vars.origem?.trim() || 'Não informada')
    .replace(/\{\{relatorio\}\}/gi, vars.relatorio?.trim() || 'Não disponível')
    .replace(/\{\{analise\}\}/gi, analiseBlock)
    .replace(/\{\{media_label\}\}/gi, vars.mediaLabel?.trim() || 'Anexo')
    .replace(/\{\{coordenadas\}\}/gi, vars.coordenadas?.trim() || 'não informadas');
}

export interface IrisSkyPipelineConfig {
  irisSkyAtivo: boolean;
  irisSkyModel: string;
  irisSkyKnowledgeAtivo: boolean;
  irisSkyEmbeddingModel: string;
  irisSkyIncludeMediaVision: boolean;
  irisSkyIncludeWhatsapp: boolean;
  irisSkyMatchCount: number;
  irisSkyChatPrompt: string;
  irisSkySpotPrompt: string;
  irisSkyAutoIndexAtivo: boolean;
  irisSkyKnowledgeMaxItems: number;
  irisSkyKnowledgeMaxPages: number;
}

export function parseIrisSkyConfigRow(row: Record<string, unknown> | null | undefined): IrisSkyPipelineConfig {
  const matchCount = Number(row?.iris_sky_match_count ?? 12);
  const maxItems = Number(row?.iris_sky_knowledge_max_items ?? 25);
  const maxPages = Number(row?.iris_sky_knowledge_max_pages ?? 40);
  return {
    irisSkyAtivo: row?.iris_sky_ativo !== false,
    irisSkyModel: String(row?.iris_sky_model ?? 'gpt-4o-mini'),
    irisSkyKnowledgeAtivo: row?.iris_sky_knowledge_ativo !== false,
    irisSkyEmbeddingModel: String(row?.iris_sky_embedding_model ?? 'text-embedding-3-small'),
    irisSkyIncludeMediaVision: row?.iris_sky_include_media_vision !== false,
    irisSkyIncludeWhatsapp: row?.iris_sky_include_whatsapp !== false,
    irisSkyMatchCount: Math.min(20, Math.max(4, Number.isFinite(matchCount) ? matchCount : 12)),
    irisSkyChatPrompt: String(row?.iris_sky_chat_prompt ?? '').trim() || IRIS_SKY_DEFAULT_CHAT_PROMPT,
    irisSkySpotPrompt: String(row?.iris_sky_spot_prompt ?? '').trim() || IRIS_SKY_DEFAULT_SPOT_PROMPT,
    irisSkyAutoIndexAtivo: row?.iris_sky_auto_index_ativo !== false,
    irisSkyKnowledgeMaxItems: Math.min(50, Math.max(5, Number.isFinite(maxItems) ? maxItems : 25)),
    irisSkyKnowledgeMaxPages: Math.min(100, Math.max(10, Number.isFinite(maxPages) ? maxPages : 40)),
  };
}
