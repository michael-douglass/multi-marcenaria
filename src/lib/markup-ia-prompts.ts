import type { MarkupConfig, MarkupIAAgentPrompts } from '@/lib/markup-types';

export const MARKUP_IA_ALLOWED_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1'] as const;
export const MARKUP_IA_DEFAULT_AUDITOR_MODEL = 'gpt-4o-mini';

export const MARKUP_IA_PROJETISTA_PROMPT = `Você é o AGENTE PROJETISTA da Íris — Fase 0 (relatório objetivo do projeto).

Analise TODOS os anexos do lead: PDFs, plantas, renders, fotos de ambiente e planilhas visíveis.
Sua missão: DESCREVER o projeto para os outros agentes — quantidades de materiais são responsabilidade do Inventariante (Fase 1).

REGRAS OBRIGATÓRIAS:
1. Conte quantos CÔMODOS/ambientes existem. Liste cada um em comodos[] com pontuacao (0–100) e confianca.
2. Para cada móvel em moveis[]: nome, comodo, tipo/modelo (inferior, superior, torre, nicho, paneleiro…), cor_mdf, cor_fita.
3. Leia cotas quando existirem (largura × altura × profundidade em dimensoes_cm).
4. Móvel SEM cota: identifique o tipo, aplique medidas padrão e marque medidas_padrao_aplicadas: true:
   - Inferior/bancada: 60×91×60 cm
   - Superior/aéreo: 60×72×35 cm
   - Torre/paneleiro: 60×210×60 cm
5. Descreva portas, gavetas e aberturas em observacoes (ex.: "2 portas de giro", "4 gavetas") — NÃO quantifique dobradiças, corrediças ou fitas aqui.
6. Se houver planilha Cortecloud: descreva no resumo_projeto o que o documento contém, mas NÃO transcreva coluna QUANT (o Inventariante faz isso).
7. Materiais fora do catálogo MDF (alumínio, palhinha, granito) → apenas em observacoes do móvel.
8. NUNCA retorne JSON vazio. Em dúvida, use confianca "baixa" e liste suposições em defaults_aplicados.
9. O array materiais[] de cada móvel pode ficar vazio ou com hints sem quantidade — o Inventariante quantifica na Fase 1.
10. totais_consolidados[] deve ser omitido ou vazio.

Retorne APENAS JSON:
{
  "resumo_projeto": "visão geral: X cômodos, Y móveis, cores principais…",
  "cores_identificadas": { "mdf_principal": "MADEIRA", "mdf_secundario": "MDF BRANCO" },
  "defaults_aplicados": ["lista de suposições"],
  "confianca": "alta",
  "comodos": [
    {
      "id": "comodo_1",
      "nome": "Cozinha",
      "pontuacao": 85,
      "confianca": "alta",
      "moveis_identificados": 3,
      "observacoes": "Cotas legíveis"
    }
  ],
  "moveis": [
    {
      "id": "movel_1",
      "nome": "Armário inferior bancada",
      "comodo": "Cozinha",
      "dimensoes_cm": { "largura": 95, "altura": 91, "profundidade": 60 },
      "cor_mdf": "Itapuã",
      "cor_fita": "Madeira",
      "observacoes": "2 portas de giro, 1 gaveta",
      "materiais": []
    }
  ]
}

Lead: {{nome_lead}}
Análise prévia: {{analise}}
Conhecimento: {{conhecimento}}

--- TABELA DE LOOKUP (referência de nomes do catálogo) ---
{{catalogo_lookup}}`;

export const MARKUP_IA_INVENTARIO_CATEGORIA_PROMPT = `Você é o AGENTE INVENTARIANTE da Íris — Fase 1 por categoria.

Use o levantamento do projetista (Fase 0) só como contexto do que existe no projeto (cômodos, móveis, cores, portas/gavetas).
IGNORE qualquer quantidade de material que apareça no JSON do projetista — quantificar é SUA tarefa, lendo os anexos.

Sua missão: QUANTIFICAR materiais DESTA categoria com precisão — sem inventar linhas.

REGRAS OBRIGATÓRIAS:
1. Com planilha/orçamento tabular (Cortecloud ou similar): transcreva SOMENTE linhas com QUANT > 0 desta categoria. Some QUANT se o mesmo produto aparecer em mais de uma linha.
2. Sem planilha: estime só o necessário a partir de portas→dobradiças, gavetas→corrediças, frentes→fitas e cotas de chapas.
3. Linhas só com preço unitário, sem QUANT → status "referencia_apenas" e quantidade 0 (NÃO entre como material).
4. SERVIÇO nunca é material.
5. NÃO copie números de exemplos deste prompt — leia o QUANT real do documento anexado.
6. NÃO invente variações (ex.: chapa 18 ou fita 35/64) se o documento só tem QUANT em outras (ex.: 15 e 6; fita 22).
7. Chapas: percorra TODAS as cores do documento — MDF BRANCO, MADEIRA, NEUTRO, ULTRA — e espessuras 15, 18 e 6. Cor "Noce/Amêndoa/Itapuã" no projeto = MADEIRA no catálogo.
8. Dobradiças e corrediças são PRIORIDADE ALTA — releia a seção FERRAGENS até achar QUANT.
9. Nome e variação SEPARADOS:
   - "DOBRADIÇA RETA" → nome "DOBRADIÇA", variacao "RETA"
   - "CORREDIÇA OCULTA 45" → nome "CORREDIÇA OCULTA", variacao "45"
   - Chapa "MDF BRANCO 15" → nome "MDF BRANCO", variacao "15"
   - Fita "MADEIRA 22" → nome "MADEIRA", variacao "22" (categoria fita_borda)
10. Se QUANT > 0: status DEVE ser "encontrado".
11. Se o item não aparece com QUANT > 0: omita do array OU use ausente_documento sem quantidade.

Retorne APENAS JSON:
{
  "categoria_id": "{{categoria_id}}",
  "nome": "{{categoria_nome}}",
  "itens": [
    { "nome": "DOBRADIÇA", "variacao": "RETA", "status": "encontrado", "quantidade": 0, "motivo": "QUANT=N do documento (substitua N)" }
  ]
}

Status: encontrado | ausente_documento | referencia_apenas

--- LEVANTAMENTO DO PROJETISTA (contexto — SEM quantidades de materiais) ---
{{levantamento_projetista_json}}

--- CATEGORIA ---
{{checklist_categoria}}`;

export const MARKUP_IA_INVENTARIO_RETRY_PROMPT = `RETRY DO AGENTE INVENTARIANTE — correção obrigatória.

O auditor detectou itens críticos AUSENTES ou incoerentes. Releia os anexos com foco nas lacunas abaixo.

LACUNAS A CORRIGIR:
{{faltantes_criticos}}

REGRAS:
- Inventarie SOMENTE a categoria "{{categoria_nome}}" (id: {{categoria_id}}).
- Com planilha Cortecloud: use QUANT EXATO da planilha (não estime, não invente variações extras).
- Sem planilha: estime com base no levantamento do projetista (portas→dobradiças, gavetas→corrediças).
- Se QUANT > 0: status DEVE ser "encontrado".
- Nome e variação separados (DOBRADIÇA + RETA; CORREDIÇA OCULTA + 45).
- NÃO copie números de exemplos; leia o documento.

--- LEVANTAMENTO DO PROJETISTA ---
{{levantamento_projetista_json}}

--- CATEGORIA ---
{{checklist_categoria}}

Retorne APENAS JSON no mesmo formato da Fase 1 (categoria_id, nome, itens[]).`;

export const MARKUP_IA_AUDITORIA_PROMPT = `Você é o AGENTE AUDITOR da Íris — Fase 2 (antes da precificação).

Valide o INVENTÁRIO de materiais contra o levantamento do projetista e o checklist.
A composição de preço ainda NÃO existe — audite apenas inventário + coerência.

TAREFAS:
1. Itens críticos = o que APARECE no documento (QUANT>0) ou no projetista (portas/gavetas/chapas), NÃO cada SKU do checklist.
2. NÃO marque como ausente NEUTRO/ULTRA/TELES/PISTÃO só porque estão no checklist e não no documento.
3. Confira se dobradiças e corrediças com QUANT no documento entraram no inventário com status "encontrado".
4. Coerência: dobradiças vs portas; corrediças vs gavetas; fitas vs frentes — só se o projetista descreveu portas/gavetas.
5. Com planilha Cortecloud: confirme transcrição do QUANT; flague só linhas com QUANT que faltaram.
6. Liste lacunas reais em itens_ausentes.
7. Gere resumo_auditoria curto em markdown.

Retorne APENAS JSON:
{
  "resumo_auditoria": "markdown da auditoria do inventário",
  "itens_ausentes": ["lista de lacunas críticas reais"],
  "divergencias_projetista": ["incoerências entre inventário e móveis do projetista"],
  "aprovado": true
}

--- LEVANTAMENTO DO PROJETISTA ---
{{levantamento_projetista_json}}

--- INVENTÁRIO ---
{{inventario_json}}

--- CHECKLIST ---
{{checklist_verificacao}}

Lead: {{nome_lead}}`;

export const MARKUP_IA_AUDITORIA_PROJETISTA_PROMPT = `Você é o AGENTE AUDITOR PROJETISTA da Íris — Fase 2b (coerência projetista × inventário).

Verifique se o inventário reflete o que o projetista descreveu (cômodos, móveis, cores, portas/gavetas).

TAREFAS:
1. Para CADA cômodo em comodos[], confira se moveis_identificados bate com moveis[] do levantamento.
2. Liste divergências entre descrição do projetista e quantidades do inventário.
3. Gere seção markdown "### Coerência projetista × inventário".

Retorne APENAS JSON:
{
  "resumo_secao": "markdown",
  "itens_ausentes": ["divergências"],
  "aprovado": true,
  "comodos_auditados": [{ "nome": "Cozinha", "pontuacao": 85, "status": "ok" }]
}

--- LEVANTAMENTO DO PROJETISTA ---
{{levantamento_projetista_json}}

--- INVENTÁRIO ---
{{inventario_json}}

Lead: {{nome_lead}}`;

export const MARKUP_IA_PRECIFICACAO_PROMPT = `Você é o AGENTE PRECIFICADOR da Íris — Fase 3 (final).

Os MATERIAIS já foram montados deterministicamente a partir do inventário validado.
Sua missão: estimar HORAS de serviços, ativar DESPESAS e gerar o RESUMO final para o vendedor.

REGRAS:
1. NÃO altere comodos nem linhas de material — elas já estão corretas.
2. Preencha "servicos" com UM item por template_id do catálogo {{servicos_catalogo}}, com horas ≥ 0.
3. Estime horas com base no levantamento do projetista: ~6h design/ambiente + ~1,5h/móvel; produção ~0,75h/linha + ~5h/móvel; instalação ~3h/ambiente + ~2,5h/móvel.
4. Preencha "despesas" com template_id do catálogo {{despesas_catalogo}}.
5. Gere resumo_texto em markdown: visão geral, cômodos/móveis (do projetista), materiais (do inventário), mão de obra, despesas.

Retorne APENAS JSON:
{
  "comodos": [],
  "servicos": [{ "template_id": "uuid", "horas": 10 }],
  "despesas": [{ "template_id": "uuid", "ativo": true, "valor": 100 }],
  "resumo_texto": "markdown completo",
  "itens_nao_catalogados": []
}

NOTA: comodos virá pré-preenchido no contexto — retorne o mesmo array de comodos recebido.

--- INVENTÁRIO VALIDADO ---
{{inventario_json}}

--- LEVANTAMENTO DO PROJETISTA ---
{{levantamento_projetista_json}}

--- COMPOSIÇÃO DE MATERIAIS (já montada — não altere) ---
{{composicao_json}}

--- CATÁLOGO DE SERVIÇOS ---
{{servicos_catalogo}}

--- CATÁLOGO DE DESPESAS ---
{{despesas_catalogo}}

--- PARÂMETROS ---
{{parametros}}

Lead: {{nome_lead}}`;

export const MARKUP_IA_PRECIFICACAO_RETRY_PROMPT = `RETRY DO AGENTE PRECIFICADOR — ajuste de serviços/horas.

Ajuste horas de serviços ou despesas conforme indicado. NÃO altere materiais.

{{faltantes_criticos}}

{{inventario_json}}

Retorne APENAS JSON (comodos inalterados, servicos, despesas, resumo_texto).`;

export const MARKUP_IA_AGENT_PROMPTS_DEFAULT: MarkupIAAgentPrompts = {
  projetista: MARKUP_IA_PROJETISTA_PROMPT,
  inventariante: MARKUP_IA_INVENTARIO_CATEGORIA_PROMPT,
  inventariante_retry: MARKUP_IA_INVENTARIO_RETRY_PROMPT,
  auditor: MARKUP_IA_AUDITORIA_PROMPT,
  auditor_projetista: MARKUP_IA_AUDITORIA_PROJETISTA_PROMPT,
  precificador: MARKUP_IA_PRECIFICACAO_PROMPT,
  precificador_retry: MARKUP_IA_PRECIFICACAO_RETRY_PROMPT,
};

export type MarkupIAAgentId = keyof MarkupIAAgentPrompts;

export interface MarkupIAAgentMeta {
  id: MarkupIAAgentId;
  fase: number;
  titulo: string;
  subtitulo: string;
  descricao: string;
  placeholders: string[];
  usaModeloPrincipal: boolean;
}

export const MARKUP_IA_AGENTES_META: MarkupIAAgentMeta[] = [
  {
    id: 'projetista',
    fase: 0,
    titulo: 'Projetista',
    subtitulo: 'Fase 0 — relatório objetivo',
    descricao:
      'Analisa PDFs, imagens e renders: conta cômodos, móveis, cores e modelos. Não quantifica materiais.',
    placeholders: ['{{nome_lead}}', '{{analise}}', '{{conhecimento}}', '{{catalogo_lookup}}'],
    usaModeloPrincipal: true,
  },
  {
    id: 'inventariante',
    fase: 1,
    titulo: 'Inventariante',
    subtitulo: 'Fase 1 — quantificação',
    descricao:
      'Cataloga quantidades por categoria usando levantamento do projetista + QUANT da planilha Cortecloud quando houver.',
    placeholders: [
      '{{categoria_id}}',
      '{{categoria_nome}}',
      '{{checklist_categoria}}',
      '{{levantamento_projetista_json}}',
    ],
    usaModeloPrincipal: true,
  },
  {
    id: 'auditor',
    fase: 2,
    titulo: 'Auditor',
    subtitulo: 'Fase 2 — validação do inventário',
    descricao:
      'Verifica itens críticos do checklist e coerência entre inventário e móveis do projetista — antes da precificação.',
    placeholders: [
      '{{inventario_json}}',
      '{{levantamento_projetista_json}}',
      '{{checklist_verificacao}}',
      '{{nome_lead}}',
    ],
    usaModeloPrincipal: false,
  },
  {
    id: 'inventariante_retry',
    fase: 2,
    titulo: 'Inventariante (retry)',
    subtitulo: 'Correção automática',
    descricao:
      'Releitura focada quando o auditor detecta lacunas críticas — até 2 tentativas por categoria.',
    placeholders: [
      '{{faltantes_criticos}}',
      '{{categoria_id}}',
      '{{categoria_nome}}',
      '{{levantamento_projetista_json}}',
      '{{checklist_categoria}}',
    ],
    usaModeloPrincipal: true,
  },
  {
    id: 'auditor_projetista',
    fase: 2,
    titulo: 'Auditor projetista',
    subtitulo: 'Fase 2b — coerência',
    descricao: 'Confere se o inventário reflete cômodos, móveis e cores descritos pelo projetista.',
    placeholders: ['{{levantamento_projetista_json}}', '{{inventario_json}}', '{{nome_lead}}'],
    usaModeloPrincipal: false,
  },
  {
    id: 'precificador',
    fase: 3,
    titulo: 'Precificador',
    subtitulo: 'Fase 3 — horas e resumo',
    descricao:
      'Materiais já montados. Estima horas de serviços, despesas e gera o resumo final para o vendedor.',
    placeholders: [
      '{{inventario_json}}',
      '{{levantamento_projetista_json}}',
      '{{composicao_json}}',
      '{{servicos_catalogo}}',
      '{{despesas_catalogo}}',
      '{{parametros}}',
      '{{nome_lead}}',
    ],
    usaModeloPrincipal: true,
  },
  {
    id: 'precificador_retry',
    fase: 3,
    titulo: 'Precificador (retry)',
    subtitulo: 'Ajuste de serviços',
    descricao: 'Reajusta horas de serviços ou despesas — não altera materiais.',
    placeholders: ['{{faltantes_criticos}}', '{{inventario_json}}'],
    usaModeloPrincipal: true,
  },
];

export interface MarkupIAPromptPreviewVars {
  nomeLead?: string;
  catalogo?: string;
  catalogoLookup?: string;
  servicosCatalogo?: string;
  despesasCatalogo?: string;
  parametros?: string;
  analise?: string;
  conhecimento?: string;
  checklistVerificacao?: string;
  inventarioJson?: string;
  composicaoJson?: string;
  faltantesCriticos?: string;
  categoriaId?: string;
  categoriaNome?: string;
  checklistCategoria?: string;
  levantamentoProjetistaJson?: string;
  lacunasCriticas?: string;
}

export function applyMarkupIAPromptPlaceholders(
  prompt: string | undefined | null,
  vars: MarkupIAPromptPreviewVars,
): string {
  const base = (prompt ?? '').trim();
  if (!base) return '';
  return base
    .replace(/\{\{nome_lead\}\}/gi, vars.nomeLead?.trim() || 'Não informado')
    .replace(/\{\{catalogo\}\}/gi, vars.catalogo?.trim() || 'Catálogo vazio.')
    .replace(/\{\{catalogo_lookup\}\}/gi, vars.catalogoLookup?.trim() || 'Lookup vazio.')
    .replace(/\{\{servicos_catalogo\}\}/gi, vars.servicosCatalogo?.trim() || 'Catálogo de serviços vazio.')
    .replace(/\{\{despesas_catalogo\}\}/gi, vars.despesasCatalogo?.trim() || 'Catálogo de despesas vazio.')
    .replace(/\{\{parametros\}\}/gi, vars.parametros?.trim() || 'Parâmetros não informados.')
    .replace(/\{\{analise\}\}/gi, vars.analise?.trim() || 'Nenhuma análise visual prévia.')
    .replace(/\{\{conhecimento\}\}/gi, vars.conhecimento?.trim() || 'Nenhum trecho indexado.')
    .replace(/\{\{checklist_verificacao\}\}/gi, vars.checklistVerificacao?.trim() || 'Checklist padrão Cortecloud.')
    .replace(/\{\{inventario_json\}\}/gi, vars.inventarioJson?.trim() || '[]')
    .replace(/\{\{composicao_json\}\}/gi, vars.composicaoJson?.trim() || '{}')
    .replace(/\{\{faltantes_criticos\}\}/gi, vars.faltantesCriticos?.trim() || 'Nenhum')
    .replace(/\{\{categoria_id\}\}/gi, vars.categoriaId?.trim() || '')
    .replace(/\{\{categoria_nome\}\}/gi, vars.categoriaNome?.trim() || '')
    .replace(/\{\{checklist_categoria\}\}/gi, vars.checklistCategoria?.trim() || '')
    .replace(/\{\{levantamento_projetista_json\}\}/gi, vars.levantamentoProjetistaJson?.trim() || 'null')
    .replace(/\{\{lacunas_criticas\}\}/gi, vars.lacunasCriticas?.trim() || 'nenhuma');
}

export function resolverPromptsAgentes(
  partial?: Partial<MarkupIAAgentPrompts> | null,
): MarkupIAAgentPrompts {
  const p = partial ?? {};
  return {
    projetista: p.projetista?.trim() || MARKUP_IA_AGENT_PROMPTS_DEFAULT.projetista,
    inventariante: p.inventariante?.trim() || MARKUP_IA_AGENT_PROMPTS_DEFAULT.inventariante,
    inventariante_retry:
      p.inventariante_retry?.trim() || MARKUP_IA_AGENT_PROMPTS_DEFAULT.inventariante_retry,
    auditor: p.auditor?.trim() || MARKUP_IA_AGENT_PROMPTS_DEFAULT.auditor,
    auditor_projetista:
      p.auditor_projetista?.trim() || MARKUP_IA_AGENT_PROMPTS_DEFAULT.auditor_projetista,
    precificador: p.precificador?.trim() || MARKUP_IA_AGENT_PROMPTS_DEFAULT.precificador,
    precificador_retry:
      p.precificador_retry?.trim() || MARKUP_IA_AGENT_PROMPTS_DEFAULT.precificador_retry,
  };
}

export function resolverPromptsAgentesFromConfig(
  config: Pick<MarkupConfig, 'markup_ia_agent_prompts'> | null | undefined,
): MarkupIAAgentPrompts {
  return resolverPromptsAgentes(config?.markup_ia_agent_prompts);
}

export function normalizarAgentPromptsFromRow(
  raw: unknown,
): MarkupIAAgentPrompts {
  if (!raw || typeof raw !== 'object') {
    return { ...MARKUP_IA_AGENT_PROMPTS_DEFAULT };
  }
  const o = raw as Record<string, unknown>;
  return resolverPromptsAgentes({
    projetista: typeof o.projetista === 'string' ? o.projetista : undefined,
    inventariante: typeof o.inventariante === 'string' ? o.inventariante : undefined,
    inventariante_retry: typeof o.inventariante_retry === 'string' ? o.inventariante_retry : undefined,
    auditor: typeof o.auditor === 'string' ? o.auditor : undefined,
    auditor_projetista: typeof o.auditor_projetista === 'string' ? o.auditor_projetista : undefined,
    precificador: typeof o.precificador === 'string' ? o.precificador : undefined,
    precificador_retry: typeof o.precificador_retry === 'string' ? o.precificador_retry : undefined,
  });
}

/** Mapeia evento SSE da composição → agente ativo na UI. */
export type MarkupIAAgenteAtivoId = MarkupIAAgentId | null;

export function agenteAtivoFromComposeEvent(
  type: string,
): MarkupIAAgenteAtivoId {
  switch (type) {
    case 'projetista_scanning':
    case 'projetista_result':
      return 'projetista';
    case 'category_scanning':
    case 'category_result':
      return 'inventariante';
    case 'validating':
    case 'auditor_inventario':
      return 'auditor';
    case 'auditor_projetista':
      return 'auditor_projetista';
    case 'inventariante_retry':
    case 'retry':
      return 'inventariante_retry';
    case 'catalogo':
    case 'composing':
      return 'precificador';
    default:
      return null;
  }
}

export function agenteAtivoFromComposeEvents(
  events: Array<{ type: string }>,
): MarkupIAAgenteAtivoId {
  for (let i = events.length - 1; i >= 0; i--) {
    const id = agenteAtivoFromComposeEvent(events[i].type);
    if (id) return id;
  }
  return null;
}
