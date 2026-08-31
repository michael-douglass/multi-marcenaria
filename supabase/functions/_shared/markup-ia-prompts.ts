import { estimarHorasServicosPorComposicao, mesclarHorasServicosIA, servicoDeveReceberHorasIa } from './markup-servicos-estimativa.ts';
import type { MarkupIAVerificacaoCategoriaResultado } from './markup-ia-verificacao.ts';
import { MARKUP_IA_INVENTARIO_CATEGORIA_PROMPT } from './markup-ia-verificacao.ts';

export const MARKUP_IA_ALLOWED_MODELS = new Set(['gpt-4o-mini', 'gpt-4o', 'gpt-4.1']);

export const MARKUP_IA_DEFAULT_MODEL = 'gpt-4o';



export const MARKUP_IA_DEFAULT_PROMPT = `Você é a Íris, especialista em marcenaria planejada e orçamento de custo interno.



Sua tarefa: analisar o material do lead (imagens, PDFs, textos e relatórios) e compor um ORÇAMENTO COMPLETO de markup interno, preenchendo MATERIAIS, SERVIÇOS (mão de obra) e DESPESAS.



REGRAS OBRIGATÓRIAS:

1. Leia TODO o material anexado: imagens, PDFs (todas as páginas), análise prévia e conhecimento indexado.

   a) Identifique fotos DUPLICADAS (mesmo ambiente, mesmo ângulo, mesma imagem repetida). Conte cada cena única apenas UMA vez.

   b) Se houver planilha Cortecloud E fotos de ambiente: materiais vêm SOMENTE da planilha; fotos servem apenas para descrever cômodos/móveis no resumo_texto (opcional), NUNCA para inventar quantidades.

2. MODO PLANILHA CORTECLOUD (prioridade ABSOLUTA quando existir PDF/planilha "Orçamento Cortecloud"):

   a) Transcreva SOMENTE linhas com coluna QUANT preenchida (> 0). Linhas só com VALOR UNITÁRIO, sem QUANT, são tabela de referência de preços — NÃO inclua como material.

   b) Coluna VARI = variação no catálogo: espessura (15, 18, 22, 35, 45, 64) ou tipo (RETA, CURVA, S CURVA). Cruze MATERIAL + VARI com campos nome + variacao do catálogo usando a tabela de lookup abaixo.

   c) Cabeçalho "SERVIÇO" e "VALOR TOTAL" do documento NÃO são materiais. Não some SERVIÇO (ex.: R$ 1.000,00 de serviço) em materiais.

   d) Estrutura única: cômodo "Orçamento Cortecloud" → móvel "Materiais do documento" com todas as linhas transcritas. Não divida por cômodos quando a planilha já lista os itens.

   e) PROIBIDO estimar/inventar materiais a partir de fotos quando a planilha informar QUANT. Não adicione puxadores, chapas ou ferragens que não estejam na planilha com QUANT > 0.

   f) Copie o nome comercial da coluna MATERIAL (Branco eucatex, Beige Matt Arauco). Cruze com o catálogo. Não use apelido MDF BRANCO/ULTRA se o PDF tiver marca.

   g) Ao final, calcule o subtotal de materiais (soma quantidade × preco_unitario do catálogo) e informe no resumo_texto: "Subtotal de materiais calculado: R$ X" e "Subtotal no documento: R$ Y", destacando divergências.

   h) Exemplo de método (NÃO copie estes números — use o QUANT do documento atual): MDF BRANCO/15/QTY N + MADEIRA/15/QTY N + CORREDIÇA OCULTA/45/QTY N + DOBRADIÇA RETA/QTY N + FITA MDF BRANCO/22/QTY N.

3. Se NÃO houver planilha Cortecloud, organize materiais por CÔMODOS e, dentro de cada cômodo, por MÓVEIS identificados nas fotos únicas.

4. Materiais: use SOMENTE produto_id do catálogo {{catalogo}}. Não invente produtos.

5. Serviços (mão de obra):

   - Use SOMENTE template_id do catálogo {{servicos_catalogo}}.

   - Preencha horas > 0 SOMENTE em "Horas produção" (oficina) e "Horas instalação" (casa do cliente).

   - Demais templates (projeto, JR, Pontua, comissão, outros): horas 0.

   - O sistema calcula custo = horas × valor_hora_padrao do catálogo (NÃO informe valores em R$ em servicos).

   - Produção: corte, colagem, montagem em oficina (~0,75h por linha + ~5h por móvel).

   - Instalação: montagem no local (~3h por ambiente + ~2,5h por móvel).

6. Despesas: use SOMENTE template_id do catálogo {{despesas_catalogo}}.

   - Para cada despesa do catálogo, defina ativo (true/false) e valor em reais.

   - Ative despesas plausíveis para o projeto (ex.: gasolina e pedágio se houver instalação externa).

   - Use valor_padrao do catálogo como base e ajuste se o contexto justificar.

7. resumo_texto: markdown completo para o vendedor com visão geral, cômodos, materiais, mão de obra, despesas e observações. Inclua subtotal de materiais calculado.

8. Quantidades de materiais devem ser números positivos. Na planilha Cortecloud, use exatamente o QUANT informado.

9. Retorne APENAS um JSON válido (sem markdown externo, sem texto extra):



{

  "comodos": [

    {

      "nome": "Nome do cômodo",

      "moveis": [

        {

          "nome": "Nome do móvel",

          "descricao": "Descrição técnica resumida",

          "linhas": [{ "produto_id": "uuid-do-catalogo", "quantidade": 2 }]

        }

      ]

    }

  ],

  "servicos": [

    { "template_id": "uuid-servico", "horas": 20 }

  ],

  "despesas": [

    { "template_id": "uuid-despesa", "ativo": true, "valor": 100 }

  ],

  "resumo_texto": "Resumo completo em markdown",

  "itens_nao_catalogados": ["material que não existe no catálogo"],

  "verificacao_categorias": [

    {

      "categoria_id": "chapas_mdf",

      "nome": "Chapas de MDF",

      "itens": [

        { "item_id": "mdf_branco_15", "nome": "MDF BRANCO", "variacao": "15", "status": "encontrado", "quantidade": 2, "motivo": "QUANT=2 na planilha" }

      ]

    }

  ]

}



Lead: {{nome_lead}}



--- PARÂMETROS PADRÃO DA EMPRESA (referência para serviços) ---

{{parametros}}



--- CATÁLOGO DE PRODUTOS (use somente estes IDs em linhas) ---

{{catalogo}}

--- TABELA DE LOOKUP CORTECLOUD (nome + variacao → produto_id) ---

{{catalogo_lookup}}



--- CATÁLOGO DE SERVIÇOS / MÃO DE OBRA (use somente estes template_id em servicos) ---

{{servicos_catalogo}}



--- CATÁLOGO DE DESPESAS (use somente estes template_id em despesas) ---

{{despesas_catalogo}}



--- ANÁLISE VISUAL PRÉVIA DO LEAD ---

{{analise}}



--- CONHECIMENTO INDEXADO DO LEAD ---

{{conhecimento}}

--- CHECKLIST DE VERIFICAÇÃO (percorra TODAS as categorias ativas antes de compor) ---

{{checklist_verificacao}}`;

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

export const MARKUP_IA_PRECIFICACAO_PROMPT = `Você é o AGENTE PRECIFICADOR da Íris — Fase 3 (final).

Os MATERIAIS já foram montados deterministicamente a partir do inventário validado.
Sua missão: estimar HORAS de serviços, ativar DESPESAS e gerar o RESUMO final para o vendedor.

REGRAS:
1. NÃO altere comodos nem linhas de material — elas já estão corretas.
2. Preencha "servicos" com UM item por template_id do catálogo {{servicos_catalogo}}.
3. Horas > 0 SOMENTE em "Horas produção" (montar na oficina) e "Horas instalação" (montar na casa do cliente). Os outros templates (projeto, JR, Pontua, comissão, outros) devem ter horas 0.
4. Estimativa: produção ~0,75h/linha de material + ~5h/móvel; instalação ~3h/ambiente + ~2,5h/móvel.
5. Preencha "despesas" com template_id do catálogo {{despesas_catalogo}}.
6. Gere resumo_texto em markdown: visão geral, cômodos/móveis, materiais, mão de obra (produção + instalação).

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

export interface ComposeAuditoriaParsed {
  resumo_texto: string;
  resumo_auditoria?: string;
  subtotal_calculado?: number;
  subtotal_documento?: number;
  divergencia_percentual?: number;
  itens_ausentes?: string[];
  aprovado?: boolean;
}

export function parseAuditoriaJson(raw: string): ComposeAuditoriaParsed {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const parsed = JSON.parse(text) as Record<string, unknown>;
  return {
    resumo_texto: String(parsed.resumo_texto ?? parsed.resumo_auditoria ?? '').trim(),
    resumo_auditoria: parsed.resumo_auditoria != null ? String(parsed.resumo_auditoria) : undefined,
    subtotal_calculado: parsed.subtotal_calculado != null ? Number(parsed.subtotal_calculado) : undefined,
    subtotal_documento: parsed.subtotal_documento != null ? Number(parsed.subtotal_documento) : undefined,
    divergencia_percentual: parsed.divergencia_percentual != null
      ? Number(parsed.divergencia_percentual)
      : undefined,
    itens_ausentes: Array.isArray(parsed.itens_ausentes)
      ? parsed.itens_ausentes.map((i) => String(i))
      : undefined,
    aprovado: parsed.aprovado === true,
  };
}

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

export interface ComposeAuditoriaProjetistaParsed {
  resumo_secao: string;
  itens_ausentes?: string[];
  aprovado?: boolean;
  comodos_auditados?: Array<{ nome: string; pontuacao?: number; status?: string }>;
}

export function parseAuditoriaProjetistaJson(raw: string): ComposeAuditoriaProjetistaParsed {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const parsed = JSON.parse(text) as Record<string, unknown>;
  return {
    resumo_secao: String(parsed.resumo_secao ?? '').trim(),
    itens_ausentes: Array.isArray(parsed.itens_ausentes)
      ? parsed.itens_ausentes.map((i) => String(i))
      : undefined,
    aprovado: parsed.aprovado === true,
    comodos_auditados: Array.isArray(parsed.comodos_auditados)
      ? parsed.comodos_auditados.map((c) => {
          const o = c as Record<string, unknown>;
          return {
            nome: String(o.nome ?? ''),
            pontuacao: o.pontuacao != null ? Number(o.pontuacao) : undefined,
            status: o.status ? String(o.status) : undefined,
          };
        })
      : undefined,
  };
}

export function applyMarkupIAPromptPlaceholders(
  prompt: string,
  vars: {
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
    yamlFidelidade?: string;
  },
): string {
  return prompt
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
    .replace(/\{\{lacunas_criticas\}\}/gi, vars.lacunasCriticas?.trim() || 'nenhuma')
    .replace(/\{\{yaml_fidelidade\}\}/gi, vars.yamlFidelidade?.trim() || 'null');
}

export interface MarkupIAAgentPrompts {
  projetista: string;
  inventariante: string;
  inventariante_retry: string;
  auditor: string;
  auditor_projetista: string;
  precificador: string;
  precificador_retry: string;
}

export const MARKUP_IA_DEFAULT_AUDITOR_MODEL = 'gpt-4o-mini';

export const MARKUP_IA_AGENT_PROMPTS_DEFAULT: MarkupIAAgentPrompts = {
  projetista: MARKUP_IA_PROJETISTA_PROMPT,
  inventariante: MARKUP_IA_INVENTARIO_CATEGORIA_PROMPT,
  inventariante_retry: MARKUP_IA_INVENTARIO_RETRY_PROMPT,
  auditor: MARKUP_IA_AUDITORIA_PROMPT,
  auditor_projetista: MARKUP_IA_AUDITORIA_PROJETISTA_PROMPT,
  precificador: MARKUP_IA_PRECIFICACAO_PROMPT,
  precificador_retry: MARKUP_IA_PRECIFICACAO_RETRY_PROMPT,
};

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

export function normalizarAgentPromptsFromRow(raw: unknown): MarkupIAAgentPrompts {
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

export interface MarkupCatalogProduct {

  id: string;

  nome: string;

  variacao: string | null;

  unidade: string;

  preco_unitario: number | null;

  categoria: string;

}



export interface MarkupCatalogDespesa {

  id: string;

  nome: string;

  valor_padrao: number;

  ordem: number;

}



export interface MarkupCatalogServico {

  id: string;

  nome: string;

  valor_hora_padrao: number;

  ordem: number;

}



export interface MarkupCatalogParametros {

  valor_hora_marcenaria: number;

  fator_sobras: number;

  margem_lucro: number;

  percentual_imposto: number;

  taxas_financeiras: number;

}



export interface ComposeMarkupServicoLinha {

  template_id: string;

  horas: number;

}



export interface ComposeMarkupDespesa {

  template_id: string;

  ativo: boolean;

  valor: number;

}



export interface ComposeMarkupParsed {

  comodos: Array<{

    nome: string;

    moveis: Array<{

      nome: string;

      descricao?: string;

      linhas: Array<{ produto_id: string; quantidade: number; origem_ia?: string }>;

    }>;

  }>;

  servicos: ComposeMarkupServicoLinha[];

  despesas: ComposeMarkupDespesa[];

  resumo_texto: string;

  itens_nao_catalogados: string[];

  verificacao_categorias?: MarkupIAVerificacaoCategoriaResultado[];

}



function clampNonNegative(value: unknown): number {

  const n = Number(value);

  if (!Number.isFinite(n) || n < 0) return 0;

  return Math.round(n * 100) / 100;

}



function parseServicosLegacy(raw: Record<string, unknown>): ComposeMarkupServicoLinha[] {

  const legacy: ComposeMarkupServicoLinha[] = [];

  const keys = ['horas_projeto', 'horas_producao', 'horas_instalacao'] as const;

  for (const key of keys) {

    const horas = clampNonNegative(raw[key]);

    if (horas > 0) {

      legacy.push({ template_id: key, horas });

    }

  }

  return legacy;

}



export function parseComposeMarkupJson(raw: string): ComposeMarkupParsed {

  let text = raw.trim();

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fence) text = fence[1].trim();



  const parsed = JSON.parse(text) as Record<string, unknown>;

  const comodosRaw = Array.isArray(parsed.comodos) ? parsed.comodos : [];



  const comodos = comodosRaw.map((c) => {

    const comodo = c as Record<string, unknown>;

    const moveisRaw = Array.isArray(comodo.moveis) ? comodo.moveis : [];

    const moveis = moveisRaw.map((m) => {

      const movel = m as Record<string, unknown>;

      const linhasRaw = Array.isArray(movel.linhas) ? movel.linhas : [];

      const linhas = linhasRaw

        .map((l) => {

          const linha = l as Record<string, unknown>;

          const produto_id = String(linha.produto_id ?? '').trim();

          const quantidade = Number(linha.quantidade ?? 0);

          if (!produto_id || quantidade <= 0) return null;

          return { produto_id, quantidade };

        })

        .filter((l): l is { produto_id: string; quantidade: number } => l !== null);



      return {

        nome: String(movel.nome ?? 'Móvel').trim() || 'Móvel',

        descricao: movel.descricao ? String(movel.descricao) : undefined,

        linhas,

      };

    });



    return {

      nome: String(comodo.nome ?? 'Ambiente').trim() || 'Ambiente',

      moveis,

    };

  });



  let servicos: ComposeMarkupServicoLinha[] = [];

  if (Array.isArray(parsed.servicos)) {

    servicos = (parsed.servicos as unknown[])

      .map((item) => {

        const s = item as Record<string, unknown>;

        const template_id = String(s.template_id ?? '').trim();

        if (!template_id) return null;

        return { template_id, horas: clampNonNegative(s.horas) };

      })

      .filter((s): s is ComposeMarkupServicoLinha => s !== null);

  } else if (parsed.servicos && typeof parsed.servicos === 'object') {

    servicos = parseServicosLegacy(parsed.servicos as Record<string, unknown>);

  }



  const despesasRaw = Array.isArray(parsed.despesas) ? parsed.despesas : [];

  const despesas = despesasRaw

    .map((d) => {

      const item = d as Record<string, unknown>;

      const template_id = String(item.template_id ?? '').trim();

      if (!template_id) return null;

      return {

        template_id,

        ativo: item.ativo !== false,

        valor: clampNonNegative(item.valor),

      };

    })

    .filter((d): d is ComposeMarkupDespesa => d !== null);



  const itens_nao_catalogados = Array.isArray(parsed.itens_nao_catalogados)

    ? parsed.itens_nao_catalogados.map((i) => String(i)).filter(Boolean)

    : [];

  const verificacao_categorias = Array.isArray(parsed.verificacao_categorias)
    ? (parsed.verificacao_categorias as MarkupIAVerificacaoCategoriaResultado[])
    : undefined;

  return {

    comodos,

    servicos,

    despesas,

    resumo_texto: String(parsed.resumo_texto ?? '').trim(),

    itens_nao_catalogados,

    verificacao_categorias,

  };

}



export function validateComposeAgainstCatalog(

  parsed: ComposeMarkupParsed,

  catalogIds: Set<string>,

  despesaIds: Set<string>,

  servicoIds: Set<string>,

  servicoTemplates: MarkupCatalogServico[],

  parametros: MarkupCatalogParametros,

): ComposeMarkupParsed {

  const itens_nao_catalogados = [...(parsed.itens_nao_catalogados ?? [])];



  const comodos = (parsed.comodos ?? []).map((comodo) => ({

    ...comodo,

    moveis: (comodo.moveis ?? []).map((movel) => ({

      ...movel,

      linhas: (movel.linhas ?? []).filter((linha) => {

        if (catalogIds.has(linha.produto_id)) return true;

        itens_nao_catalogados.push(`ID inválido no catálogo: ${linha.produto_id}`);

        return false;

      }),

    })),

  }));



  const despesas = (parsed.despesas ?? []).filter((d) => {

    if (despesaIds.has(d.template_id)) return true;

    itens_nao_catalogados.push(`Despesa inválida no catálogo: ${d.template_id}`);

    return false;

  });



  const servicoMap = new Map(servicoTemplates.map((s) => [s.id, s]));

  const servicosParsed = (parsed.servicos ?? []).filter((s) => {

    if (servicoIds.has(s.template_id)) return true;

    itens_nao_catalogados.push(`Serviço inválido no catálogo: ${s.template_id}`);

    return false;

  });

  const horasIaMap = new Map(
    servicosParsed.map((s) => [s.template_id, Math.max(0, s.horas)] as const),
  );
  const estimativaHoras = estimarHorasServicosPorComposicao(comodos, servicoTemplates);
  const horasFinais = mesclarHorasServicosIA(horasIaMap, estimativaHoras, servicoTemplates);

  const servicos: ComposeMarkupServicoLinha[] = servicoTemplates.map((template) => ({
    template_id: template.id,
    horas: servicoDeveReceberHorasIa(template.nome)
      ? (horasFinais.get(template.id) ?? 0)
      : 0,
  }));



  return {

    ...parsed,

    comodos,

    servicos,

    despesas,

    itens_nao_catalogados: [...new Set(itens_nao_catalogados)],

  };

}


