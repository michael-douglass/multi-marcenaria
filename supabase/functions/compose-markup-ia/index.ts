import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';
import {
  applyMarkupIAPromptPlaceholders,
  MARKUP_IA_ALLOWED_MODELS,
  MARKUP_IA_DEFAULT_MODEL,
  MARKUP_IA_DEFAULT_PROMPT,
  MARKUP_IA_DEFAULT_AUDITOR_MODEL,
  normalizarAgentPromptsFromRow,
  parseAuditoriaJson,
  parseAuditoriaProjetistaJson,
  parseComposeMarkupJson,
  validateComposeAgainstCatalog,
  type MarkupIAAgentPrompts,
  type MarkupCatalogDespesa,
  type MarkupCatalogParametros,
  type MarkupCatalogProduct,
  type MarkupCatalogServico,
  type ComposeMarkupParsed,
} from '../_shared/markup-ia-prompts.ts';
import {
  calcularSubtotalMateriais,
  contarLinhasMateriais,
  deduplicateImageParts,
  detectCortecloudContext,
  extrairSubtotalDocumento,
  formatCatalogLookupTable,
  mapearInventarioParaLinhas,
  garantirInventarioNaComposicao,
  getCortecloudInventarioHint,
  construirComodosDeInventario,
} from '../_shared/markup-cortecloud.ts';
import {
  encodeStreamEvent,
  flattenComposicaoLinhas,
  formatChecklistForCategoria,
  formatChecklistForPrompt,
  mergeInventarioCategorias,
  normalizarChecklistVerificacao,
  parseInventarioCategoriaJson,
  criarResultadoVazioCategoria,
  avaliarItensCriticos,
  runVerificacaoChecklist,
  type MarkupIAVerificacaoCategoria,
  type MarkupIAVerificacaoCategoriaResultado,
  type StreamEvent,
} from '../_shared/markup-ia-verificacao.ts';
import {
  formatRetrievedContext,
  resolveDb,
  searchLeadKnowledge,
} from '../_shared/lead-knowledge.ts';
import {
  auditarItensProjetista,
  coletarProdutosOrigemProjetista,
  contarLinhasComposicao,
  detectarLacunasCriticas,
  enriquecerLevantamentoCompleto,
  extrairAmbientesEsperados,
  parseProjetistaJson,
  projetistaFallbackMinimo,
  projetistaToInventario,
  validarLevantamentoCompleto,
  type LacunaCriticaId,
  type MarkupIAProjetistaResult,
} from '../_shared/markup-ia-projetista.ts';

const MAX_ITEMS = 10;
const MAX_IMAGES_TOTAL = 40;

interface AnalysisItem {
  source: string;
  id: string;
  label: string;
  imageUrl?: string;
  pagesBase64?: string[];
}

interface ComposeMarkupRequest {
  leadId: number;
  empresaSchema?: string | null;
  leadName?: string;
  itens?: AnalysisItem[];
  stream?: boolean;
}

type EmitFn = (event: StreamEvent) => void;

const MAX_RETRIES_INVENTARIO = 2;

interface ComposeSuccessPayload {
  comodos: ComposeMarkupParsed['comodos'];
  servicos: ComposeMarkupParsed['servicos'];
  despesas: ComposeMarkupParsed['despesas'];
  resumo_texto: string;
  itens_nao_catalogados: string[];
  verificacao_categorias: MarkupIAVerificacaoCategoriaResultado[];
  levantamento_projetista?: MarkupIAProjetistaResult;
  produtos_origem_projetista?: string[];
  modelo_usado: string;
  itens_processados: number;
  bloqueado?: boolean;
  faltantes_criticos?: string[];
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isEmpresaSchema(schema: string | null | undefined): boolean {
  return !!schema && /^emp_[a-z0-9_]+$/.test(schema);
}

function pipelineConfigTable(empresaSchema?: string | null): string {
  return isEmpresaSchema(empresaSchema)
    ? 'pipeline_lead_ai_config'
    : 'CRM-multi-empresas>pipeline_lead_ai_config<';
}

function markupConfigTable(empresaSchema?: string | null): string {
  return isEmpresaSchema(empresaSchema)
    ? 'markup_config'
    : 'CRM-multi-empresas>markup_config<';
}

function analisesTable(empresaSchema?: string | null): string {
  return isEmpresaSchema(empresaSchema)
    ? 'lead_ai_analises'
    : 'CRM-multi-empresas>lead_ai_analises<';
}

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

async function buildImageParts(itens: AnalysisItem[]): Promise<OpenAIContentPart[]> {
  const parts: OpenAIContentPart[] = [];
  let imageCount = 0;

  for (const item of itens) {
    if (imageCount >= MAX_IMAGES_TOTAL) break;

    if (item.pagesBase64?.length) {
      for (const page of item.pagesBase64) {
        if (imageCount >= MAX_IMAGES_TOTAL) break;
        const url = page.startsWith('data:') ? page : `data:image/jpeg;base64,${page}`;
        parts.push({ type: 'image_url', image_url: { url, detail: 'auto' } });
        imageCount++;
      }
      continue;
    }

    if (item.imageUrl) {
      let url = item.imageUrl;
      if (!url.startsWith('data:')) {
        const converted = await urlToBase64(url);
        if (!converted) continue;
        url = converted;
      }
      parts.push({ type: 'image_url', image_url: { url, detail: 'auto' } });
      imageCount++;
    }
  }

  return deduplicateImageParts(parts);
}

function deveRetentarComposicao(
  parsed: ComposeMarkupParsed,
  catalog: MarkupCatalogProduct[],
  modoCortecloud: boolean,
  labelsAnexos: string[],
  verificacao: MarkupIAVerificacaoCategoriaResultado[],
  inventario: MarkupIAVerificacaoCategoriaResultado[],
  checklist: MarkupIAVerificacaoCategoria[],
): { retry: boolean; motivo: string; faltantes: string[] } {
  const criticos = avaliarItensCriticos(verificacao, inventario, checklist, modoCortecloud);
  if (!criticos.ok) {
    return { retry: true, motivo: criticos.motivo, faltantes: criticos.faltantes };
  }

  if (!modoCortecloud) {
    return { retry: false, motivo: '', faltantes: [] };
  }

  const catalogById = new Map(catalog.map((p) => [p.id, p]));
  const subtotal = calcularSubtotalMateriais(parsed.comodos, catalogById);
  const linhas = contarLinhasMateriais(parsed.comodos);
  const subtotalDoc = extrairSubtotalDocumento(parsed.resumo_texto ?? '');

  if (linhas < 3) {
    return { retry: true, motivo: 'Poucas linhas de material', faltantes: ['Mínimo de 3 linhas de materiais'] };
  }

  if (subtotalDoc != null && subtotal > 0) {
    const divergencia = Math.abs(subtotal - subtotalDoc) / subtotalDoc;
    if (divergencia > 0.03) {
      return {
        retry: true,
        motivo: `Subtotal divergente (${(divergencia * 100).toFixed(1)}%)`,
        faltantes: ['Subtotal de materiais não confere com documento'],
      };
    }
  }

  const textoLabels = labelsAnexos.join(' ').toLowerCase();
  if (textoLabels.includes('cortecloud') && linhas < 5 && subtotal < 2000) {
    return { retry: true, motivo: 'Composição incompleta para Cortecloud', faltantes: ['Linhas insuficientes'] };
  }

  return { retry: false, motivo: '', faltantes: [] };
}

async function callOpenAIChat(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string | OpenAIContentPart[] }>,
): Promise<string> {
  const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
    }),
  });

  if (!openAiRes.ok) {
    const errText = await openAiRes.text();
    console.error('OpenAI error:', openAiRes.status, errText);
    let message = 'Erro ao chamar a API da OpenAI';
    try {
      const parsed = JSON.parse(errText);
      message = parsed?.error?.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const openAiData = await openAiRes.json();
  const content = openAiData?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('A IA não retornou conteúdo');
  return content;
}

function despesaTemplatesTable(empresaSchema?: string | null): string {
  return isEmpresaSchema(empresaSchema)
    ? 'markup_despesa_templates'
    : 'CRM-multi-empresas>markup_despesa_templates<';
}

function servicoTemplatesTable(empresaSchema?: string | null): string {
  return isEmpresaSchema(empresaSchema)
    ? 'markup_servico_templates'
    : 'CRM-multi-empresas>markup_servico_templates<';
}

async function loadServicoTemplates(
  db: ReturnType<typeof resolveDb>,
  empresaSchema?: string | null,
): Promise<MarkupCatalogServico[]> {
  const { data, error } = await db
    .from(servicoTemplatesTable(empresaSchema))
    .select('id, nome, valor_hora_padrao, ordem')
    .eq('ativo', true)
    .order('ordem', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((s: {
    id: string;
    nome: string;
    valor_hora_padrao?: number | string;
    ordem: number;
  }) => ({
    id: s.id,
    nome: s.nome,
    valor_hora_padrao: Number(s.valor_hora_padrao) || 0,
    ordem: s.ordem ?? 0,
  }));
}

async function loadDespesaTemplates(
  db: ReturnType<typeof resolveDb>,
  empresaSchema?: string | null,
): Promise<MarkupCatalogDespesa[]> {
  const { data, error } = await db
    .from(despesaTemplatesTable(empresaSchema))
    .select('id, nome, valor_padrao, ordem')
    .eq('ativo', true)
    .order('ordem', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((d: {
    id: string;
    nome: string;
    valor_padrao: number | string;
    ordem: number;
  }) => ({
    id: d.id,
    nome: d.nome,
    valor_padrao: Number(d.valor_padrao) || 0,
    ordem: d.ordem ?? 0,
  }));
}

async function loadMarkupParametros(
  db: ReturnType<typeof resolveDb>,
  empresaSchema?: string | null,
): Promise<MarkupCatalogParametros> {
  const { data, error } = await db
    .from(markupConfigTable(empresaSchema))
    .select('valor_hora_marcenaria, fator_sobras, margem_lucro, percentual_imposto, taxas_financeiras')
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return {
    valor_hora_marcenaria: Number(data?.valor_hora_marcenaria ?? 80),
    fator_sobras: Number(data?.fator_sobras ?? 5),
    margem_lucro: Number(data?.margem_lucro ?? 30),
    percentual_imposto: Number(data?.percentual_imposto ?? 0),
    taxas_financeiras: Number(data?.taxas_financeiras ?? 0),
  };
}

async function loadCatalog(
  db: ReturnType<typeof resolveDb>,
  empresaSchema?: string | null,
): Promise<MarkupCatalogProduct[]> {
  const produtosTable = isEmpresaSchema(empresaSchema)
    ? 'markup_produtos'
    : 'CRM-multi-empresas>markup_produtos<';
  const categoriasTable = isEmpresaSchema(empresaSchema)
    ? 'markup_categorias'
    : 'CRM-multi-empresas>markup_categorias<';

  const { data: produtos, error: prodError } = await db
    .from(produtosTable)
    .select('id, nome, variacao, unidade, preco_unitario, categoria_id, ativo')
    .eq('ativo', true);

  if (prodError) throw prodError;

  const { data: categorias, error: catError } = await db
    .from(categoriasTable)
    .select('id, nome, subcategoria');

  if (catError) throw catError;

  const catMap = new Map(
    (categorias ?? []).map((c: { id: string; nome: string; subcategoria: string | null }) => [
      c.id,
      c.subcategoria ? `${c.nome} (${c.subcategoria})` : c.nome,
    ]),
  );

  return (produtos ?? [])
    .filter((p: { preco_unitario: number | null }) => p.preco_unitario != null)
    .map((p: {
      id: string;
      nome: string;
      variacao: string | null;
      unidade: string;
      preco_unitario: number | null;
      categoria_id: string;
    }) => ({
      id: p.id,
      nome: p.nome,
      variacao: p.variacao,
      unidade: p.unidade,
      preco_unitario: p.preco_unitario != null ? Number(p.preco_unitario) : null,
      categoria: catMap.get(p.categoria_id) ?? 'Sem categoria',
    }));
}

async function loadLatestAnalise(
  db: ReturnType<typeof resolveDb>,
  leadId: number,
  empresaSchema?: string | null,
): Promise<string> {
  const { data } = await db
    .from(analisesTable(empresaSchema))
    .select('conteudo')
    .eq('lead_id', leadId)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.conteudo as string | undefined)?.trim() ?? '';
}

async function runInventarioFase(
  openAiKey: string,
  model: string,
  checklist: MarkupIAVerificacaoCategoria[],
  imageParts: OpenAIContentPart[],
  inventariantePrompt: string,
  levantamentoProjetista: MarkupIAProjetistaResult | null,
  modoCortecloud: boolean,
  emit?: EmitFn,
): Promise<MarkupIAVerificacaoCategoriaResultado[]> {
  const categoriasAtivas = checklist.filter((c) => c.ativo);
  const parciais: MarkupIAVerificacaoCategoriaResultado[] = [];
  const levantamentoJson = levantamentoProjetista
    ? JSON.stringify(levantamentoProjetista, null, 2)
    : 'null';

  if (imageParts.length === 0) {
    for (const cat of categoriasAtivas) {
      const vazio = criarResultadoVazioCategoria(cat);
      emit?.({
        type: 'category_result',
        message: `${cat.nome}: sem anexos para inventariar`,
        data: vazio,
      });
      parciais.push(vazio);
    }
    return mergeInventarioCategorias(parciais, checklist);
  }

  for (const cat of categoriasAtivas) {
    emit?.({
      type: 'category_scanning',
      message: `Inventariante: verificando ${cat.nome}…`,
      data: { categoriaId: cat.id, nome: cat.nome },
    });

    const catPrompt = applyMarkupIAPromptPlaceholders(inventariantePrompt, {
      categoriaId: cat.id,
      categoriaNome: cat.nome,
      checklistCategoria: formatChecklistForCategoria(cat),
      levantamentoProjetistaJson: levantamentoJson,
    });

    try {
      const hintCortecloud = modoCortecloud ? getCortecloudInventarioHint(cat.id) : '';
      const userIntro = modoCortecloud
        ? `Inventarie a categoria "${cat.nome}". Use QUANT da planilha Cortecloud quando existir; cruze com o levantamento do projetista.`
        : `Inventarie a categoria "${cat.nome}". Estime quantidades com base no levantamento do projetista e nos anexos.`;
      const raw = await callOpenAIChat(openAiKey, model, [
        { role: 'system', content: catPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: hintCortecloud ? `${userIntro}\n\n${hintCortecloud}` : userIntro,
            },
            ...imageParts,
          ],
        },
      ]);
      const resultado = parseInventarioCategoriaJson(raw, cat);
      const encontrados = resultado.itens.filter((i) => i.status === 'encontrado').length;
      emit?.({
        type: 'category_result',
        message: `${cat.nome}: ${encontrados} item(ns) com quantidade`,
        data: resultado,
      });
      parciais.push(resultado);
    } catch (err) {
      console.warn(`Inventário categoria ${cat.id} falhou:`, err);
      const vazio = criarResultadoVazioCategoria(cat);
      emit?.({
        type: 'category_result',
        message: `${cat.nome}: falha na verificação`,
        data: vazio,
      });
      parciais.push(vazio);
    }
  }

  return mergeInventarioCategorias(parciais, checklist);
}

const CATEGORIAS_INVENTARIO_RETRY = ['chapas_mdf', 'ferragens_corr_dobr', 'fita_borda'] as const;

function categoriasParaRetry(
  lacunas: LacunaCriticaId[],
  faltantes: string[],
): string[] {
  const ids = new Set<string>();
  for (const lac of lacunas) {
    if (CATEGORIAS_INVENTARIO_RETRY.includes(lac as typeof CATEGORIAS_INVENTARIO_RETRY[number])) {
      ids.add(lac);
    }
  }
  const texto = faltantes.join(' ').toLowerCase();
  if (texto.includes('chapa') || texto.includes('mdf')) ids.add('chapas_mdf');
  if (texto.includes('dobradi') || texto.includes('corredi') || texto.includes('ferragem')) {
    ids.add('ferragens_corr_dobr');
  }
  if (texto.includes('fita')) ids.add('fita_borda');
  return Array.from(ids);
}

function avaliarAuditoriaInventarioDeterministico(
  inventario: MarkupIAVerificacaoCategoriaResultado[],
  checklist: MarkupIAVerificacaoCategoria[],
  catalog: MarkupCatalogProduct[],
  modoCortecloud: boolean,
  levantamentoProjetista?: MarkupIAProjetistaResult | null,
): { ok: boolean; faltantes: string[]; lacunas: LacunaCriticaId[] } {
  const linhas = mapearInventarioParaLinhas(inventario, catalog);
  const verificacao = runVerificacaoChecklist(linhas, inventario, checklist, catalog);
  const criticos = avaliarItensCriticos(verificacao, inventario, checklist, modoCortecloud);
  const lacunas = detectarLacunasCriticas(verificacao);
  const faltantes = [
    ...criticos.faltantes,
    ...lacunas.map((l) => `Lacuna crítica: ${l}`),
  ];

  // Se há MDF BRANCO mas falta MADEIRA e o projetista indicou cor madeira/noce → forçar retry chapas
  const chapas = inventario.find((c) => c.categoria_id === 'chapas_mdf');
  const temBranco = (chapas?.itens ?? []).some(
    (i) =>
      i.status === 'encontrado' &&
      (i.quantidade ?? 0) > 0 &&
      i.nome.toUpperCase().includes('BRANCO'),
  );
  const temMadeira = (chapas?.itens ?? []).some(
    (i) =>
      i.status === 'encontrado' &&
      (i.quantidade ?? 0) > 0 &&
      i.nome.toUpperCase().includes('MADEIRA'),
  );
  const coresTxt = JSON.stringify(levantamentoProjetista?.cores_identificadas ?? {}).toLowerCase();
  const moveisTxt = (levantamentoProjetista?.moveis ?? [])
    .map((m) => `${m.cor_mdf ?? ''} ${m.cor_fita ?? ''}`)
    .join(' ')
    .toLowerCase();
  const sugereMadeira =
    /madeira|noce|am[eê]ndoa|itapu[aã]|freij[oó]|carvalho|nogueira/.test(coresTxt + ' ' + moveisTxt);
  if (temBranco && !temMadeira && sugereMadeira) {
    faltantes.push('Chapas: falta MADEIRA (cor de madeira indicada no projetista)');
    if (!lacunas.includes('chapas_mdf')) lacunas.push('chapas_mdf');
  }

  // Se há chapa 15 mas não há 6mm e o documento/checklist costuma ter fundo 6mm — hint suave via fita? skip
  // Se há dobradiça mas corrediça zerada e projetista descreveu gavetas → retry ferragens
  const ferragens = inventario.find((c) => c.categoria_id === 'ferragens_corr_dobr');
  const temDobr = (ferragens?.itens ?? []).some(
    (i) => i.status === 'encontrado' && (i.quantidade ?? 0) > 0 && i.nome.toUpperCase().includes('DOBRADI'),
  );
  const temCorr = (ferragens?.itens ?? []).some(
    (i) => i.status === 'encontrado' && (i.quantidade ?? 0) > 0 && i.nome.toUpperCase().includes('CORREDI'),
  );
  const textoMoveis = (levantamentoProjetista?.moveis ?? [])
    .map((m) => `${m.nome} ${m.observacoes ?? ''}`)
    .join(' ')
    .toLowerCase();
  if (temDobr && !temCorr && textoMoveis.includes('gaveta')) {
    faltantes.push('Ferragens: há gavetas descritas mas nenhuma corrediça no inventário');
    if (!lacunas.includes('ferragens_corr_dobr')) lacunas.push('ferragens_corr_dobr');
  }

  return {
    ok: faltantes.length === 0 && lacunas.length === 0,
    faltantes: [...new Set(faltantes)],
    lacunas: [...new Set(lacunas)],
  };
}

async function runInventarioRetryPorLacunas(
  openAiKey: string,
  model: string,
  checklist: MarkupIAVerificacaoCategoria[],
  imageParts: OpenAIContentPart[],
  inventarianteRetryPrompt: string,
  inventario: MarkupIAVerificacaoCategoriaResultado[],
  levantamentoProjetista: MarkupIAProjetistaResult | null,
  faltantes: string[],
  lacunas: LacunaCriticaId[],
  modoCortecloud: boolean,
  emit?: EmitFn,
): Promise<MarkupIAVerificacaoCategoriaResultado[]> {
  const catIds = categoriasParaRetry(lacunas, faltantes);
  if (catIds.length === 0 || imageParts.length === 0) return inventario;

  const levantamentoJson = levantamentoProjetista
    ? JSON.stringify(levantamentoProjetista, null, 2)
    : 'null';
  const parciais = [...inventario];

  for (const catId of catIds) {
    const cat = checklist.find((c) => c.id === catId);
    if (!cat) continue;

    emit?.({
      type: 'inventariante_retry',
      message: `Inventariante (retry): reescaneando ${cat.nome}…`,
      data: { categoriaId: catId, faltantes },
    });

    const catPrompt = applyMarkupIAPromptPlaceholders(inventarianteRetryPrompt, {
      categoriaId: cat.id,
      categoriaNome: cat.nome,
      checklistCategoria: formatChecklistForCategoria(cat),
      levantamentoProjetistaJson: levantamentoJson,
      faltantesCriticos: faltantes.join('\n- '),
    });
    const hint = modoCortecloud ? getCortecloudInventarioHint(cat.id) : '';

    try {
      const raw = await callOpenAIChat(openAiKey, model, [
        { role: 'system', content: catPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Corrija lacunas na categoria "${cat.nome}". Faltantes: ${faltantes.join('; ')}${hint ? `\n\n${hint}` : ''}`,
            },
            ...imageParts,
          ],
        },
      ]);
      const resultado = parseInventarioCategoriaJson(raw, cat);
      const idx = parciais.findIndex((p) => p.categoria_id === catId);
      if (idx >= 0) parciais[idx] = resultado;
      else parciais.push(resultado);
      emit?.({
        type: 'category_result',
        message: `${cat.nome} (retry): ${resultado.itens.filter((i) => i.status === 'encontrado').length} item(ns)`,
        data: resultado,
      });
    } catch (err) {
      console.warn(`Retry inventário ${catId} falhou:`, err);
    }
  }

  return mergeInventarioCategorias(parciais, checklist);
}

async function runAuditoriaInventarioFase(
  openAiKey: string,
  model: string,
  auditorModel: string,
  auditorPrompt: string,
  inventario: MarkupIAVerificacaoCategoriaResultado[],
  levantamentoProjetista: MarkupIAProjetistaResult | null,
  checklist: MarkupIAVerificacaoCategoria[],
  catalog: MarkupCatalogProduct[],
  modoCortecloud: boolean,
  leadName: string | undefined,
  emit?: EmitFn,
): Promise<{ faltantes: string[]; resumo_auditoria: string }> {
  emit?.({ type: 'auditor_inventario', message: 'Auditor validando inventário e checklist…' });

  const det = avaliarAuditoriaInventarioDeterministico(
    inventario,
    checklist,
    catalog,
    modoCortecloud,
  );

  const modeloAuditor = MARKUP_IA_ALLOWED_MODELS.has(auditorModel) ? auditorModel : model;
  const levantamentoJson = levantamentoProjetista
    ? JSON.stringify(levantamentoProjetista, null, 2)
    : 'null';

  try {
    const systemPrompt = applyMarkupIAPromptPlaceholders(auditorPrompt, {
      nomeLead: leadName,
      inventarioJson: JSON.stringify(inventario, null, 2),
      levantamentoProjetistaJson: levantamentoJson,
      checklistVerificacao: formatChecklistForPrompt(checklist),
    });
    const raw = await callOpenAIChat(openAiKey, modeloAuditor, [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Audite o inventário. Pendências determinísticas: ${det.faltantes.join('; ') || 'nenhuma'}.`,
      },
    ]);
    const auditoria = parseAuditoriaJson(raw);
    return {
      faltantes: [...new Set([...det.faltantes, ...(auditoria.itens_ausentes ?? [])])],
      resumo_auditoria: auditoria.resumo_auditoria ?? auditoria.resumo_texto ?? '',
    };
  } catch (err) {
    console.warn('Auditoria inventário LLM falhou:', err);
    return { faltantes: det.faltantes, resumo_auditoria: '' };
  }
}

/**
 * Materiais de custo vêm SEMPRE do inventário consolidado (1 linha por produto).
 * Nunca espalhar quantidades do projetista por móvel — isso soma 20 dobradiças × N móveis.
 */
function montarComposicaoMateriais(
  inventario: MarkupIAVerificacaoCategoriaResultado[],
  levantamentoProjetista: MarkupIAProjetistaResult | null,
  catalog: MarkupCatalogProduct[],
  _modoCortecloud: boolean,
): ComposeMarkupParsed['comodos'] {
  const linhas = mapearInventarioParaLinhas(inventario, catalog);
  if (linhas.length > 0) {
    return construirComodosDeInventario(linhas);
  }

  const totais = levantamentoProjetista?.totais_consolidados ?? [];
  if (totais.length === 0) return [];

  const inventarioTotais = totais.map((t) => {
    const nomeUp = t.nome.toUpperCase();
    const vari = t.variacao ?? '';
    let categoria_id = 'chapas_mdf';
    if (nomeUp.includes('DOBRADI') || nomeUp.includes('CORREDI') || nomeUp.includes('PIST')) {
      categoria_id = 'ferragens_corr_dobr';
    } else if (vari === '22' || vari === '35' || vari === '64') {
      categoria_id = 'fita_borda';
    }
    return {
      categoria_id,
      itens: [{
        nome: t.nome,
        variacao: t.variacao,
        status: 'encontrado' as const,
        quantidade: t.quantidade,
      }],
    };
  });

  // Agrupar por categoria_id
  const porCat = new Map<string, typeof inventarioTotais[0]['itens']>();
  for (const cat of inventarioTotais) {
    const lista = porCat.get(cat.categoria_id) ?? [];
    lista.push(...cat.itens);
    porCat.set(cat.categoria_id, lista);
  }
  const agrupado = Array.from(porCat.entries()).map(([categoria_id, itens]) => ({
    categoria_id,
    itens,
  }));
  const linhasTotais = mapearInventarioParaLinhas(agrupado, catalog);
  if (linhasTotais.length === 0) return [];
  return construirComodosDeInventario(
    linhasTotais,
    'Levantamento projetista',
    'Totais consolidados',
  );
}

/** Contexto do projetista para o inventariante — sem quantidades (evita viés / cópia). */
function projetistaContextoParaInventariante(
  levantamento: MarkupIAProjetistaResult | null,
): MarkupIAProjetistaResult | null {
  if (!levantamento) return null;
  return {
    ...levantamento,
    totais_consolidados: [],
    moveis: (levantamento.moveis ?? []).map((m) => ({
      ...m,
      materiais: [],
    })),
  };
}

async function runProjetistaFase(
  openAiKey: string,
  model: string,
  imageParts: OpenAIContentPart[],
  catalogLookup: string,
  analise: string,
  conhecimento: string,
  leadName: string | undefined,
  projetistaPrompt: string,
  emit?: EmitFn,
  options?: {
    modoReconcile?: boolean;
    lacunas?: LacunaCriticaId[];
    inventarioBase?: MarkupIAVerificacaoCategoriaResultado[];
  },
): Promise<MarkupIAProjetistaResult> {
  const modoReconcile = options?.modoReconcile === true;
  const lacunas = options?.lacunas ?? [];

  emit?.({
    type: modoReconcile ? 'projetista_reconcile' : 'projetista_scanning',
    message: modoReconcile
      ? `Projetista complementando lacunas: ${lacunas.join(', ')}…`
      : 'Agente projetista analisando pranchas e cotas…',
    data: modoReconcile ? { lacunas } : undefined,
  });

  if (imageParts.length === 0) {
    const fallback = projetistaFallbackMinimo(1);
    emit?.({
      type: 'projetista_result',
      message: `Levantamento mínimo: ${fallback.moveis.length} móvel(is) estimado(s)`,
      data: fallback,
    });
    return fallback;
  }

  const systemPrompt = applyMarkupIAPromptPlaceholders(projetistaPrompt, {
    nomeLead: leadName,
    catalogoLookup: catalogLookup,
    analise: analise || 'Nenhuma análise visual prévia.',
    conhecimento,
    lacunasCriticas: modoReconcile ? lacunas.join(', ') : 'nenhuma',
    inventarioJson: modoReconcile
      ? JSON.stringify(options?.inventarioBase ?? [], null, 2)
      : '[]',
  });

  const userText = modoReconcile
    ? `Complemente SOMENTE as lacunas (${lacunas.join(', ')}) nas ${imageParts.length} imagem(ns). Não altere quantidades do inventário base.`
    : `Analise as ${imageParts.length} imagem(ns) de projeto e retorne o levantamento completo por móvel.`;

  let result: MarkupIAProjetistaResult | null = null;
  const ambientesEsperados = extrairAmbientesEsperados(analise, conhecimento);

  const chamarProjetista = async (retryMsg?: string) => {
    const userContent = retryMsg
      ? `${retryMsg}\n\n${userText}`
      : userText;
    const raw = await callOpenAIChat(openAiKey, model, [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userContent },
          ...imageParts,
        ],
      },
    ]);
    return parseProjetistaJson(raw);
  };

  try {
    result = await chamarProjetista();
    if (result) {
      const validacao = validarLevantamentoCompleto(result, ambientesEsperados);
      if (!validacao.ok) {
        emit?.({
          type: 'log',
          message: `Projetista: reanalisando ambientes (${validacao.lacunas.slice(0, 3).join('; ')})…`,
        });
        const retry = await chamarProjetista(
          `COMPLETE o levantamento. Lacunas: ${validacao.lacunas.join('; ')}. Liste TODOS os cômodos com pontuacao e todos os móveis com materiais.`,
        );
        if (retry) result = retry;
      }
      result = enriquecerLevantamentoCompleto(result, ambientesEsperados);
    }
  } catch (err) {
    console.warn('Projetista fase 0 falhou:', err);
  }

  if (!result || result.moveis.length === 0) {
    result = enriquecerLevantamentoCompleto(
      projetistaFallbackMinimo(imageParts.length),
      ambientesEsperados,
    );
    result.defaults_aplicados = [
      ...result.defaults_aplicados,
      modoReconcile
        ? `Complemento automático para lacunas: ${lacunas.join(', ')}`
        : 'Fallback automático — IA não retornou levantamento válido',
    ];
  } else if (modoReconcile) {
    result.defaults_aplicados = [
      ...result.defaults_aplicados,
      `Complemento projetista para: ${lacunas.join(', ')}`,
    ];
  }

  emit?.({
    type: 'projetista_result',
    message: modoReconcile
      ? `Complemento: ${result.totais_consolidados.length} item(ns) estimado(s)`
      : `${result.moveis.length} móvel(is) · confiança ${result.confianca}`,
    data: result,
  });

  return result;
}

async function runPrecificacaoFase(
  openAiKey: string,
  model: string,
  inventario: MarkupIAVerificacaoCategoriaResultado[],
  catalog: MarkupCatalogProduct[],
  despesaTemplates: MarkupCatalogDespesa[],
  servicoTemplates: MarkupCatalogServico[],
  parametros: MarkupCatalogParametros,
  leadName: string | undefined,
  levantamentoProjetista: MarkupIAProjetistaResult | null,
  comodosBase: ComposeMarkupParsed['comodos'],
  faltantesRetry: string[] | null,
  agentPrompts: MarkupIAAgentPrompts,
  emit?: EmitFn,
): Promise<ComposeMarkupParsed> {
  const inventarioJson = JSON.stringify(inventario, null, 2);
  const levantamentoJson = levantamentoProjetista
    ? JSON.stringify(levantamentoProjetista, null, 2)
    : 'null';
  const composicaoJson = JSON.stringify({ comodos: comodosBase }, null, 2);

  const promptBase = faltantesRetry?.length
    ? agentPrompts.precificador_retry
    : agentPrompts.precificador;

  const systemPrompt = applyMarkupIAPromptPlaceholders(promptBase, {
    nomeLead: leadName,
    inventarioJson,
    levantamentoProjetistaJson: levantamentoJson,
    composicaoJson,
    servicosCatalogo: JSON.stringify(servicoTemplates, null, 2),
    despesasCatalogo: JSON.stringify(despesaTemplates, null, 2),
    parametros: JSON.stringify(parametros, null, 2),
    faltantesCriticos: faltantesRetry?.join('\n- ') ?? '',
  });

  emit?.({
    type: 'composing',
    message: faltantesRetry?.length
      ? 'Precificador ajustando serviços e despesas…'
      : 'Agente precificador estimando horas e resumo…',
  });

  const rawContent = await callOpenAIChat(openAiKey, model, [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content:
        'Materiais já estão na composição. Estime horas de serviços, despesas e gere o resumo_texto. Não altere comodos.',
    },
  ]);

  const parsed = parseComposeMarkupJson(rawContent);

  return {
    comodos: comodosBase,
    servicos: parsed.servicos ?? [],
    despesas: parsed.despesas ?? [],
    resumo_texto: parsed.resumo_texto ?? '',
    itens_nao_catalogados: parsed.itens_nao_catalogados ?? [],
  };
}

async function runAuditoriaFase(
  openAiKey: string,
  model: string,
  auditorModel: string,
  auditorPrompt: string,
  parsed: ComposeMarkupParsed,
  inventario: MarkupIAVerificacaoCategoriaResultado[],
  catalog: MarkupCatalogProduct[],
  analise: string,
  leadName: string | undefined,
  levantamentoProjetista: MarkupIAProjetistaResult | null,
  emit?: EmitFn,
): Promise<{ resumo_texto: string; itens_ausentes: string[] }> {
  emit?.({ type: 'validating', message: 'Agente auditor validando preço e resumo…' });

  const modeloAuditor = MARKUP_IA_ALLOWED_MODELS.has(auditorModel) ? auditorModel : model;
  const levantamentoJson = levantamentoProjetista
    ? JSON.stringify(levantamentoProjetista, null, 2)
    : 'null';
  const systemPrompt = applyMarkupIAPromptPlaceholders(auditorPrompt, {
    nomeLead: leadName,
    inventarioJson: JSON.stringify(inventario, null, 2),
    levantamentoProjetistaJson: levantamentoJson,
    composicaoJson: JSON.stringify({
      comodos: parsed.comodos,
      servicos: parsed.servicos,
      despesas: parsed.despesas,
    }, null, 2),
    catalogo: JSON.stringify(catalog, null, 2),
    analise,
  });

  try {
    const raw = await callOpenAIChat(openAiKey, modeloAuditor, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Audite a composição e gere o resumo markdown completo.' },
    ]);
    const auditoria = parseAuditoriaJson(raw);
    return {
      resumo_texto: auditoria.resumo_texto || parsed.resumo_texto,
      itens_ausentes: auditoria.itens_ausentes ?? [],
    };
  } catch (err) {
    console.warn('Auditoria fase 3 falhou:', err);
    return { resumo_texto: parsed.resumo_texto, itens_ausentes: [] };
  }
}

async function runAuditoriaProjetistaFase(
  openAiKey: string,
  model: string,
  auditorModel: string,
  auditorProjetistaPrompt: string,
  parsed: ComposeMarkupParsed,
  inventario: MarkupIAVerificacaoCategoriaResultado[],
  catalog: MarkupCatalogProduct[],
  leadName: string | undefined,
  levantamentoProjetista: MarkupIAProjetistaResult,
  auditoriaDet: ReturnType<typeof auditarItensProjetista>,
  emit?: EmitFn,
): Promise<MarkupIAProjetistaResult['auditoria_projetista']> {
  emit?.({
    type: 'auditor_projetista',
    message: 'Auditor projetista: coerência levantamento × inventário…',
  });

  const modeloAuditor = MARKUP_IA_ALLOWED_MODELS.has(auditorModel) ? auditorModel : model;
  const levantamentoJson = JSON.stringify(levantamentoProjetista, null, 2);
  const systemPrompt = applyMarkupIAPromptPlaceholders(auditorProjetistaPrompt, {
    nomeLead: leadName,
    inventarioJson: JSON.stringify(inventario, null, 2),
    levantamentoProjetistaJson: levantamentoJson,
    composicaoJson: JSON.stringify({ comodos: parsed.comodos }, null, 2),
    catalogo: JSON.stringify(catalog, null, 2),
  });

  try {
    const raw = await callOpenAIChat(openAiKey, modeloAuditor, [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Audite o levantamento do projetista. Pendências determinísticas: ${auditoriaDet.faltantes.join('; ') || 'nenhuma'}.`,
      },
    ]);
    const auditoria = parseAuditoriaProjetistaJson(raw);
    return {
      ok: auditoria.aprovado !== false && auditoriaDet.ok,
      faltantes: [
        ...auditoriaDet.faltantes,
        ...(auditoria.itens_ausentes ?? []),
      ],
      itens_verificados: auditoriaDet.itens_verificados,
      resumo_secao: auditoria.resumo_secao || auditoriaDet.resumo_secao,
    };
  } catch (err) {
    console.warn('Auditoria projetista falhou:', err);
    return {
      ok: auditoriaDet.ok,
      faltantes: auditoriaDet.faltantes,
      itens_verificados: auditoriaDet.itens_verificados,
      resumo_secao: auditoriaDet.resumo_secao,
    };
  }
}

async function processComposition(
  ctx: {
    openAiKey: string;
    model: string;
    promptBase: string;
    catalog: MarkupCatalogProduct[];
    despesaTemplates: MarkupCatalogDespesa[];
    servicoTemplates: MarkupCatalogServico[];
    parametros: MarkupCatalogParametros;
    analise: string;
    conhecimento: string;
    leadName?: string;
    itens: AnalysisItem[];
    checklist: MarkupIAVerificacaoCategoria[];
    agentPrompts: MarkupIAAgentPrompts;
    auditorModel: string;
  },
  emit?: EmitFn,
): Promise<ComposeSuccessPayload> {
  const {
    openAiKey,
    model,
    catalog,
    despesaTemplates,
    servicoTemplates,
    parametros,
    analise,
    conhecimento,
    leadName,
    itens,
    checklist,
    agentPrompts,
    auditorModel,
  } = ctx;

  emit?.({ type: 'log', message: 'Preparando anexos e imagens únicas…' });
  const imageParts = await buildImageParts(itens);
  emit?.({
    type: 'media_ready',
    message: `${imageParts.length} imagem(ns) única(s) de ${itens.length} anexo(s)`,
    data: { images: imageParts.length, items: itens.length },
  });

  const catalogLookup = formatCatalogLookupTable(catalog);
  const labelsAnexos = itens.map((i) => i.label ?? '');
  const modoCortecloud = detectCortecloudContext(...labelsAnexos, analise, conhecimento);
  emit?.({
    type: 'cortecloud_mode',
    message: modoCortecloud ? 'Planilha Cortecloud detectada' : 'Pipeline sequencial (projetista → inventariante → auditor)',
    data: { active: modoCortecloud },
  });

  let levantamentoProjetista: MarkupIAProjetistaResult | null = null;

  // Fase 0 — Projetista (sempre primeiro quando há anexos)
  if (imageParts.length > 0) {
    levantamentoProjetista = await runProjetistaFase(
      openAiKey,
      model,
      imageParts,
      catalogLookup,
      analise,
      conhecimento,
      leadName,
      agentPrompts.projetista,
      emit,
    );
  } else {
    levantamentoProjetista = projetistaFallbackMinimo(1);
  }

  // Fase 1 — Inventariante (contexto do projetista SEM quantidades, para não copiar erros)
  const projetistaParaInventario = projetistaContextoParaInventariante(levantamentoProjetista);
  let inventario = await runInventarioFase(
    openAiKey,
    model,
    checklist,
    imageParts,
    agentPrompts.inventariante,
    projetistaParaInventario,
    modoCortecloud,
    emit,
  );

  // Fase 2 — Auditor inventário (antes da precificação)
  let auditoriaInventario = await runAuditoriaInventarioFase(
    openAiKey,
    model,
    auditorModel,
    agentPrompts.auditor,
    inventario,
    levantamentoProjetista,
    checklist,
    catalog,
    modoCortecloud,
    leadName,
    emit,
  );

  // Fase 2b — Retry inventariante se faltar crítico
  let tentativasInventario = 0;
  let detInventario = avaliarAuditoriaInventarioDeterministico(
    inventario,
    checklist,
    catalog,
    modoCortecloud,
    levantamentoProjetista,
  );
  while (
    (auditoriaInventario.faltantes.length > 0 || !detInventario.ok) &&
    tentativasInventario < MAX_RETRIES_INVENTARIO &&
    imageParts.length > 0
  ) {
    tentativasInventario += 1;
    inventario = await runInventarioRetryPorLacunas(
      openAiKey,
      model,
      checklist,
      imageParts,
      agentPrompts.inventariante_retry,
      inventario,
      projetistaParaInventario,
      auditoriaInventario.faltantes,
      detInventario.lacunas,
      modoCortecloud,
      emit,
    );
    auditoriaInventario = await runAuditoriaInventarioFase(
      openAiKey,
      model,
      auditorModel,
      agentPrompts.auditor,
      inventario,
      levantamentoProjetista,
      checklist,
      catalog,
      modoCortecloud,
      leadName,
      emit,
    );
    detInventario = avaliarAuditoriaInventarioDeterministico(
      inventario,
      checklist,
      catalog,
      modoCortecloud,
      levantamentoProjetista,
    );
  }

  // Fase 2b — Auditor projetista (coerência)
  if (levantamentoProjetista) {
    const linhasInv = mapearInventarioParaLinhas(inventario, catalog);
    const auditoriaDet = auditarItensProjetista(
      levantamentoProjetista,
      inventario,
      linhasInv,
      catalog,
    );
    const auditoriaProjetista = await runAuditoriaProjetistaFase(
      openAiKey,
      model,
      auditorModel,
      agentPrompts.auditor_projetista,
      { comodos: [], servicos: [], despesas: [], resumo_texto: '', itens_nao_catalogados: [] },
      inventario,
      catalog,
      leadName,
      levantamentoProjetista,
      auditoriaDet,
      emit,
    );
    levantamentoProjetista = {
      ...levantamentoProjetista,
      auditoria_projetista: auditoriaProjetista,
    };
  }

  const linhasMapeadas = mapearInventarioParaLinhas(inventario, catalog);
  emit?.({
    type: 'catalogo',
    message: `${linhasMapeadas.length} item(ns) mapeado(s) do inventário para o catálogo`,
    data: { mapeados: linhasMapeadas.length },
  });

  // Fase 3 — Materiais determinísticos
  let comodosMateriais = montarComposicaoMateriais(
    inventario,
    levantamentoProjetista,
    catalog,
    modoCortecloud,
  );
  let parsed: ComposeMarkupParsed = {
    comodos: comodosMateriais,
    servicos: [],
    despesas: [],
    resumo_texto: auditoriaInventario.resumo_auditoria || '',
    itens_nao_catalogados: [],
  };

  const injetadoInv = garantirInventarioNaComposicao(parsed, inventario, catalog);
  parsed = { ...parsed, comodos: injetadoInv.comodos };

  if (contarLinhasComposicao(parsed.comodos) === 0 && linhasMapeadas.length > 0) {
    parsed = { ...parsed, comodos: construirComodosDeInventario(linhasMapeadas) };
  }
  if (contarLinhasComposicao(parsed.comodos) === 0 && levantamentoProjetista) {
    inventario = projetistaToInventario(levantamentoProjetista, checklist);
    const linhasFallback = mapearInventarioParaLinhas(inventario, catalog);
    if (linhasFallback.length > 0) {
      parsed = { ...parsed, comodos: construirComodosDeInventario(linhasFallback) };
    }
    emit?.({
      type: 'log',
      message: 'Fallback de emergência: inventário estimado a partir do levantamento do projetista',
    });
  }

  // Fase 3 — Precificador (serviços, despesas, resumo)
  parsed = await runPrecificacaoFase(
    openAiKey,
    model,
    inventario,
    catalog,
    despesaTemplates,
    servicoTemplates,
    parametros,
    leadName,
    levantamentoProjetista,
    parsed.comodos,
    null,
    agentPrompts,
    emit,
  );

  const catalogIds = new Set(catalog.map((p) => p.id));
  const despesaIds = new Set(despesaTemplates.map((d) => d.id));
  const servicoIds = new Set(servicoTemplates.map((s) => s.id));

  let validated = validateComposeAgainstCatalog(
    parsed,
    catalogIds,
    despesaIds,
    servicoIds,
    servicoTemplates,
    parametros,
  );
  parsed = validated;

  // Auditoria final leve — subtotal materiais vs documento
  const catalogById = new Map(catalog.map((p) => [p.id, p]));
  const subtotal = calcularSubtotalMateriais(validated.comodos, catalogById);
  const subtotalDoc = extrairSubtotalDocumento(analise);
  let resumoFinal = validated.resumo_texto;
  if (auditoriaInventario.resumo_auditoria) {
    resumoFinal = `${auditoriaInventario.resumo_auditoria}\n\n${resumoFinal}`;
  }
  if (levantamentoProjetista?.auditoria_projetista?.resumo_secao) {
    resumoFinal = `${resumoFinal}\n\n${levantamentoProjetista.auditoria_projetista.resumo_secao}`;
  }
  if (modoCortecloud && subtotal > 0) {
    const subtotalLinha = `Subtotal de materiais calculado: R$ ${subtotal.toFixed(2)}`;
    const docLinha = subtotalDoc != null
      ? `Subtotal no documento: R$ ${subtotalDoc.toFixed(2)}`
      : '';
    resumoFinal = `${resumoFinal}\n\n### Auditoria Cortecloud\n${subtotalLinha}${docLinha ? `\n${docLinha}` : ''}`;
  }
  parsed = { ...parsed, resumo_texto: resumoFinal };

  validated = validateComposeAgainstCatalog(
    parsed,
    catalogIds,
    despesaIds,
    servicoIds,
    servicoTemplates,
    parametros,
  );

  let linhas = flattenComposicaoLinhas(validated.comodos);
  let verificacao = runVerificacaoChecklist(linhas, inventario, checklist, catalog);
  const criticos = avaliarItensCriticos(verificacao, inventario, checklist, modoCortecloud);
  const itensFinais = contarLinhasComposicao(validated.comodos);

  const produtosOrigemProjetista = coletarProdutosOrigemProjetista(
    validated.comodos,
    levantamentoProjetista,
    catalog,
  );

  let faltantesAuditoria = [
    ...criticos.faltantes,
    ...auditoriaInventario.faltantes,
    ...(levantamentoProjetista?.auditoria_projetista?.faltantes ?? []),
  ];
  const faltantesUnicos = [...new Set(faltantesAuditoria)];

  const bloqueado =
    !criticos.ok ||
    (levantamentoProjetista?.auditoria_projetista?.ok === false);

  return {
    comodos: validated.comodos,
    servicos: validated.servicos,
    despesas: validated.despesas,
    resumo_texto: validated.resumo_texto,
    itens_nao_catalogados: validated.itens_nao_catalogados,
    verificacao_categorias: verificacao,
    levantamento_projetista: levantamentoProjetista ?? undefined,
    produtos_origem_projetista: produtosOrigemProjetista,
    modelo_usado: model,
    itens_processados: itensFinais,
    bloqueado,
    faltantes_criticos: faltantesUnicos.length > 0 ? faltantesUnicos : criticos.faltantes,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Não autorizado' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: 'Usuário não autenticado' }, 401);
    }

    let body: ComposeMarkupRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corpo da requisição inválido (JSON)' }, 400);
    }

    const { leadId, empresaSchema, leadName, itens = [], stream: streamRequested } = body;

    if (!leadId || typeof leadId !== 'number') {
      return jsonResponse({ error: 'leadId é obrigatório' }, 400);
    }

    if (itens.length > MAX_ITEMS) {
      return jsonResponse({ error: `Máximo de ${MAX_ITEMS} itens por composição` }, 400);
    }

    const db = resolveDb(supabase, empresaSchema);

    const { data: pipelineConfig, error: pipelineError } = await db
      .from(pipelineConfigTable(empresaSchema))
      .select('ativo, openai_api_key')
      .eq('singleton_key', 'default')
      .maybeSingle();

    if (pipelineError) {
      console.error('Erro ao carregar config pipeline IA:', pipelineError);
      return jsonResponse({ error: 'Erro ao carregar configuração de IA' }, 500);
    }

    if (!pipelineConfig?.ativo) {
      return jsonResponse({ error: 'IA do pipeline desativada nas configurações' }, 403);
    }

    const openAiKey =
      (pipelineConfig.openai_api_key?.trim() || '') || Deno.env.get('OPENAI_API_KEY') || '';
    if (!openAiKey) {
      return jsonResponse(
        {
          error:
            'Chave da OpenAI não configurada. Defina em Pipeline → Configurações → Configuração IA.',
        },
        500,
      );
    }

    const { data: markupConfig, error: markupConfigError } = await db
      .from(markupConfigTable(empresaSchema))
      .select('markup_ia_prompt, markup_ia_model, markup_ia_ativo, markup_ia_verificacao, markup_ia_agent_prompts, markup_ia_auditor_model')
      .limit(1)
      .maybeSingle();

    if (markupConfigError) {
      console.error('Erro ao carregar config markup IA:', markupConfigError);
      return jsonResponse({ error: 'Erro ao carregar configuração de markup IA' }, 500);
    }

    if (markupConfig?.markup_ia_ativo === false) {
      return jsonResponse({ error: 'Composição com IA desativada nas configurações de markup' }, 403);
    }

    const catalog = await loadCatalog(db, empresaSchema);
    if (catalog.length === 0) {
      return jsonResponse(
        { error: 'Catálogo de produtos vazio. Cadastre materiais em Markup → Configurações.' },
        400,
      );
    }

    const despesaTemplates = await loadDespesaTemplates(db, empresaSchema);
    const servicoTemplates = await loadServicoTemplates(db, empresaSchema);
    const parametros = await loadMarkupParametros(db, empresaSchema);

    const analise = await loadLatestAnalise(db, leadId, empresaSchema);
    const knowledgeHits = await searchLeadKnowledge(
      supabase,
      leadId,
      empresaSchema,
      openAiKey,
      'materiais móveis planejados quantidades chapas ferragens ambientes cômodos',
      12,
    );
    const conhecimento = formatRetrievedContext(knowledgeHits);

    if (itens.length === 0 && !analise && knowledgeHits.length === 0) {
      return jsonResponse(
        {
          error:
            'Nenhum material encontrado. Anexe imagens/PDFs ao lead ou execute a análise visual da Íris.',
        },
        400,
      );
    }

    const modelRaw = (markupConfig?.markup_ia_model as string | undefined)?.trim() || MARKUP_IA_DEFAULT_MODEL;
    const model = MARKUP_IA_ALLOWED_MODELS.has(modelRaw) ? modelRaw : MARKUP_IA_DEFAULT_MODEL;

    const promptBase = (markupConfig?.markup_ia_prompt as string | undefined)?.trim() ||
      MARKUP_IA_DEFAULT_PROMPT;

    const checklist = normalizarChecklistVerificacao(
      markupConfig?.markup_ia_verificacao as MarkupIAVerificacaoCategoria[] | undefined,
    );

    const agentPrompts = normalizarAgentPromptsFromRow(markupConfig?.markup_ia_agent_prompts);
    const auditorModelRaw = (markupConfig?.markup_ia_auditor_model as string | undefined)?.trim() ||
      MARKUP_IA_DEFAULT_AUDITOR_MODEL;
    const auditorModel = MARKUP_IA_ALLOWED_MODELS.has(auditorModelRaw)
      ? auditorModelRaw
      : MARKUP_IA_DEFAULT_AUDITOR_MODEL;

    const composeCtx = {
      openAiKey,
      model,
      promptBase,
      catalog,
      despesaTemplates,
      servicoTemplates,
      parametros,
      analise,
      conhecimento,
      leadName,
      itens,
      checklist,
      agentPrompts,
      auditorModel,
    };

    if (streamRequested) {
      const sseStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const emit: EmitFn = (event) => {
            controller.enqueue(encoder.encode(encodeStreamEvent(event)));
          };
          try {
            const result = await processComposition(composeCtx, emit);
            emit({ type: 'complete', message: 'Composição concluída', data: result });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao compor markup';
            emit({ type: 'error', message });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(sseStream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    try {
      const result = await processComposition(composeCtx);
      return jsonResponse(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao compor markup com IA';
      if (message.includes('mapear materiais')) {
        return jsonResponse({ error: message }, 422);
      }
      return jsonResponse({ error: message }, 502);
    }
  } catch (err) {
    console.error('compose-markup-ia error:', err);
    const message =
      err instanceof Error ? err.message : 'Erro interno ao compor markup com IA';
    return jsonResponse({ error: message }, 500);
  }
});
