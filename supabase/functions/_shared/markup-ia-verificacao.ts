export type MarkupIAVerificacaoPrioridade = 'alta' | 'normal';

export type MarkupIAVerificacaoItemStatus =
  | 'encontrado'
  | 'ausente_documento'
  | 'referencia_apenas'
  | 'inventado'
  | 'pendente'
  | 'nao_aplicavel';

export interface MarkupIAVerificacaoItem {
  id: string;
  nome: string;
  variacoes: string[];
  ativo: boolean;
  prioridade: MarkupIAVerificacaoPrioridade;
  nota?: string;
  somente_referencia?: boolean;
}

export interface MarkupIAVerificacaoCategoria {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  itens: MarkupIAVerificacaoItem[];
}

export interface MarkupIAVerificacaoItemResultado {
  item_id: string;
  nome: string;
  variacao: string | null;
  status: MarkupIAVerificacaoItemStatus;
  quantidade?: number;
  motivo?: string;
}

export interface MarkupIAVerificacaoCategoriaResultado {
  categoria_id: string;
  nome: string;
  itens: MarkupIAVerificacaoItemResultado[];
}

export const MARKUP_IA_VERIFICACAO_PADRAO: MarkupIAVerificacaoCategoria[] = [
  {
    id: 'chapas_mdf',
    nome: 'Chapas de MDF',
    ordem: 1,
    ativo: true,
    itens: [
      { id: 'mdf_branco', nome: 'MDF BRANCO', variacoes: ['15', '18', '6'], ativo: true, prioridade: 'alta' },
      { id: 'madeira', nome: 'MADEIRA', variacoes: ['15', '18', '6'], ativo: true, prioridade: 'alta' },
      { id: 'neutro', nome: 'NEUTRO', variacoes: ['15', '18', '6'], ativo: true, prioridade: 'normal' },
      { id: 'ultra', nome: 'ULTRA', variacoes: ['15', '18', '6'], ativo: true, prioridade: 'normal' },
    ],
  },
  {
    id: 'ferragens_corr_dobr',
    nome: 'Ferragens (Corrediças, Dobradiças e Pistões)',
    ordem: 2,
    ativo: true,
    itens: [
      { id: 'corr_teles', nome: 'CORREDIÇA TELES', variacoes: ['25', '30', '35', '40', '45'], ativo: true, prioridade: 'alta' },
      { id: 'corr_oculta', nome: 'CORREDIÇA OCULTA', variacoes: ['25', '30', '35', '40', '45'], ativo: true, prioridade: 'alta' },
      { id: 'dobradica', nome: 'DOBRADIÇA', variacoes: ['RETA', 'CURVA', 'S CURVA', 'GAFAN'], ativo: true, prioridade: 'alta' },
      { id: 'pistao', nome: 'PISTÃO', variacoes: ['CIMA', 'BAIXO'], ativo: true, prioridade: 'normal' },
    ],
  },
  {
    id: 'fita_borda',
    nome: 'Fitas de Borda',
    ordem: 3,
    ativo: true,
    itens: [
      { id: 'fita_mdf_branco', nome: 'MDF BRANCO', variacoes: ['22', '35', '64'], ativo: true, prioridade: 'alta' },
      { id: 'fita_madeira', nome: 'MADEIRA', variacoes: ['22', '35', '64'], ativo: true, prioridade: 'alta' },
      { id: 'fita_neutro', nome: 'NEUTRO', variacoes: ['22', '35', '64'], ativo: true, prioridade: 'normal' },
      { id: 'fita_especial', nome: 'ESPECIAL', variacoes: ['22', '35', '64'], ativo: true, prioridade: 'normal' },
    ],
  },
  {
    id: 'outras_ferragens',
    nome: 'Outras Ferragens e Componentes',
    ordem: 4,
    ativo: true,
    itens: [
      { id: 'trilho_inferior', nome: 'TRILHO INFERIOR/B', variacoes: [], ativo: true, prioridade: 'normal' },
      { id: 'trilho_superior', nome: 'TRILHO SUPERIOR/B', variacoes: [], ativo: true, prioridade: 'normal' },
      { id: 'disp_correr', nome: 'DESPOSITIVO/P/CORRER/B', variacoes: [], ativo: true, prioridade: 'normal' },
      { id: 'puxador_bl', nome: 'PUXADOR ALUMINIO/B/L', variacoes: [], ativo: true, prioridade: 'normal' },
      { id: 'puxador_bp', nome: 'PUXADOR DE ALUMINIO/B/P', variacoes: [], ativo: true, prioridade: 'normal' },
      { id: 'puxador_alca', nome: 'PUXADOR ALÇA', variacoes: [], ativo: true, prioridade: 'normal' },
      { id: 'fecho_toque', nome: 'FECHO TOQUE', variacoes: [], ativo: true, prioridade: 'normal' },
      { id: 'cabideiro', nome: 'CABIDEIRO OVAL', variacoes: [], ativo: true, prioridade: 'normal' },
      { id: 'dominus_2', nome: 'DOMINUS 2 PORTAS', variacoes: [], ativo: true, prioridade: 'normal' },
      { id: 'dominus_3', nome: 'DOMINUS 3 PORTAS', variacoes: [], ativo: true, prioridade: 'normal' },
      { id: 'sequenziato_45', nome: 'SEQUENZIATO 45MM', variacoes: [], ativo: true, prioridade: 'normal' },
      { id: 'sequenziato_40', nome: 'SEQUENZIATO 40MM', variacoes: [], ativo: true, prioridade: 'normal' },
      { id: 'sequenziato_35', nome: 'SEQUENZIATO 35MM', variacoes: [], ativo: true, prioridade: 'normal' },
      { id: 'ro82', nome: 'RO82', variacoes: [], ativo: true, prioridade: 'normal' },
      { id: 'tab_15', nome: 'TAB 15 PCT/10UNI', variacoes: [], ativo: true, prioridade: 'normal' },
    ],
  },
  {
    id: 'iluminacao',
    nome: 'Iluminação',
    ordem: 5,
    ativo: true,
    itens: [
      { id: 'rm330', nome: 'RM-330 CANTO 45 GRAUS', variacoes: [], ativo: true, prioridade: 'normal' },
      { id: 'rm329', nome: 'RM-329 SOBREPOR', variacoes: [], ativo: true, prioridade: 'normal' },
      { id: 'rm331', nome: 'RM-331 PERFIL DE LED EMB', variacoes: [], ativo: true, prioridade: 'normal' },
    ],
  },
  {
    id: 'servicos',
    nome: 'Serviços',
    ordem: 6,
    ativo: true,
    itens: [
      {
        id: 'servico_geral',
        nome: 'SERVIÇO',
        variacoes: [],
        ativo: true,
        prioridade: 'alta',
        somente_referencia: true,
        nota: 'Não incluir em materiais.',
      },
    ],
  },
];

export function normalizarChecklistVerificacao(
  raw: MarkupIAVerificacaoCategoria[] | null | undefined,
): MarkupIAVerificacaoCategoria[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return JSON.parse(JSON.stringify(MARKUP_IA_VERIFICACAO_PADRAO));
  }
  return raw.map((cat) => ({
    ...cat,
    ativo: cat.ativo !== false,
    itens: (cat.itens ?? []).map((item) => ({
      ...item,
      ativo: item.ativo !== false,
      prioridade: item.prioridade === 'alta' ? 'alta' : 'normal',
      variacoes: Array.isArray(item.variacoes) ? item.variacoes : [],
    })),
  }));
}

/** Categorias obrigatórias em orçamentos de móveis planejados */
export const ITENS_CRITICOS_CATEGORIAS = [
  'chapas_mdf',
  'ferragens_corr_dobr',
  'fita_borda',
] as const;

export interface AvaliacaoItensCriticos {
  ok: boolean;
  faltantes: string[];
  motivo: string;
}

export interface AvaliacaoGateComposicao extends AvaliacaoItensCriticos {
  retrySubtotal: boolean;
  retryCriticos: boolean;
}

export function formatChecklistForCategoria(cat: MarkupIAVerificacaoCategoria): string {
  const itens = cat.itens
    .filter((i) => i.ativo)
    .map((i) => {
      const vari = i.variacoes.length ? ` (variações: ${i.variacoes.join(', ')})` : '';
      const ref = i.somente_referencia ? ' [SOMENTE REFERÊNCIA]' : '';
      const prio = i.prioridade === 'alta' ? ' [prioridade alta]' : '';
      return `    - ${i.nome}${vari}${prio}${ref}`;
    })
    .join('\n');
  return `### ${cat.nome} (id: ${cat.id})\n${itens || '    (nenhum item ativo)'}`;
}

export function criarResultadoVazioCategoria(
  cat: MarkupIAVerificacaoCategoria,
): MarkupIAVerificacaoCategoriaResultado {
  return {
    categoria_id: cat.id,
    nome: cat.nome,
    itens: cat.itens
      .filter((i) => i.ativo)
      .flatMap((item) => {
        if (item.variacoes.length === 0) {
          return [{
            item_id: item.id,
            nome: item.nome,
            variacao: null,
            status: 'ausente_documento' as MarkupIAVerificacaoItemStatus,
            motivo: 'Não verificado ou ausente no documento.',
          }];
        }
        return item.variacoes.map((vari) => ({
          item_id: `${item.id}_${vari}`,
          nome: item.nome,
          variacao: vari,
          status: 'ausente_documento' as MarkupIAVerificacaoItemStatus,
          motivo: 'Não verificado ou ausente no documento.',
        }));
      }),
  };
}

export function mergeInventarioCategorias(
  parciais: MarkupIAVerificacaoCategoriaResultado[],
  checklist: MarkupIAVerificacaoCategoria[],
): MarkupIAVerificacaoCategoriaResultado[] {
  const map = new Map<string, MarkupIAVerificacaoCategoriaResultado>();
  for (const cat of checklist.filter((c) => c.ativo)) {
    map.set(cat.id, criarResultadoVazioCategoria(cat));
  }
  for (const parcial of parciais) {
    const base = map.get(parcial.categoria_id);
    if (!base) {
      map.set(parcial.categoria_id, parcial);
      continue;
    }
    const itensMap = new Map(base.itens.map((i) => [`${i.nome}|${i.variacao ?? ''}`, i]));
    for (const item of parcial.itens) {
      const key = `${item.nome}|${item.variacao ?? ''}`;
      itensMap.set(key, item);
    }
    map.set(parcial.categoria_id, {
      ...base,
      itens: Array.from(itensMap.values()),
    });
  }
  return Array.from(map.values()).sort((a, b) => {
    const ordA = checklist.find((c) => c.id === a.categoria_id)?.ordem ?? 0;
    const ordB = checklist.find((c) => c.id === b.categoria_id)?.ordem ?? 0;
    return ordA - ordB;
  });
}

function categoriaTemItemEncontrado(
  cat: MarkupIAVerificacaoCategoriaResultado | undefined,
  nomesAlvo: string[],
): boolean {
  if (!cat) return false;
  return cat.itens.some(
    (i) =>
      i.status === 'encontrado' &&
      (i.quantidade ?? 0) > 0 &&
      nomesAlvo.some((n) => i.nome.toUpperCase().includes(n)),
  );
}

function categoriaTemAlgumEncontrado(cat: MarkupIAVerificacaoCategoriaResultado | undefined): boolean {
  if (!cat) return false;
  return cat.itens.some((i) => i.status === 'encontrado' && (i.quantidade ?? 0) > 0);
}

export function avaliarItensCriticos(
  verificacao: MarkupIAVerificacaoCategoriaResultado[],
  inventario: MarkupIAVerificacaoCategoriaResultado[],
  _checklist: MarkupIAVerificacaoCategoria[],
  modoCortecloud: boolean,
): AvaliacaoItensCriticos {
  const faltantes: string[] = [];
  const verMap = new Map(verificacao.map((c) => [c.categoria_id, c]));
  const invMap = new Map(inventario.map((c) => [c.categoria_id, c]));

  const chapas = verMap.get('chapas_mdf');
  if (!categoriaTemAlgumEncontrado(chapas)) {
    faltantes.push('Chapas de MDF (nenhuma chapa na composição)');
  }

  const ferragens = verMap.get('ferragens_corr_dobr');
  const temDobradica = categoriaTemItemEncontrado(ferragens, ['DOBRADIÇA', 'DOBRADICA']);
  const temCorredica = categoriaTemItemEncontrado(ferragens, ['CORREDIÇA', 'CORREDICA']);
  if (!temDobradica && !temCorredica) {
    faltantes.push('Ferragens: falta dobradiça ou corrediça na composição');
  }

  const fitas = verMap.get('fita_borda');
  if (!categoriaTemAlgumEncontrado(fitas)) {
    faltantes.push('Fitas de borda (nenhuma fita na composição)');
  }

  if (modoCortecloud) {
    for (const catId of ITENS_CRITICOS_CATEGORIAS) {
      const inv = invMap.get(catId);
      const ver = verMap.get(catId);
      if (!inv || !ver) continue;
      for (const itemInv of inv.itens) {
        if (itemInv.status !== 'encontrado' || (itemInv.quantidade ?? 0) <= 0) continue;
        const match = ver.itens.find(
          (v) =>
            v.nome.toUpperCase() === itemInv.nome.toUpperCase() &&
            (v.variacao ?? '') === (itemInv.variacao ?? '') &&
            v.status === 'encontrado' &&
            (v.quantidade ?? 0) > 0,
        );
        if (!match) {
          const label = itemInv.variacao
            ? `${itemInv.nome} (${itemInv.variacao})`
            : itemInv.nome;
          faltantes.push(`Documento tem QUANT para ${label}, mas não entrou na composição`);
        }
      }
    }
  }

  const uniq = [...new Set(faltantes)];
  return {
    ok: uniq.length === 0,
    faltantes: uniq,
    motivo: uniq.length
      ? `Itens críticos ausentes: ${uniq.slice(0, 4).join('; ')}${uniq.length > 4 ? '…' : ''}`
      : 'Todos os itens críticos verificados.',
  };
}

export function formatChecklistForPrompt(checklist: MarkupIAVerificacaoCategoria[]): string {
  const ativos = checklist.filter((c) => c.ativo);
  if (!ativos.length) return 'Nenhuma categoria de verificação ativa.';

  return ativos
    .map((cat) => {
      const itens = cat.itens
        .filter((i) => i.ativo)
        .map((i) => {
          const vari = i.variacoes.length ? ` (variações: ${i.variacoes.join(', ')})` : '';
          const ref = i.somente_referencia ? ' [SOMENTE REFERÊNCIA]' : '';
          const prio = i.prioridade === 'alta' ? ' [prioridade alta]' : '';
          return `    - ${i.nome}${vari}${prio}${ref}`;
        })
        .join('\n');
      return `### ${cat.nome}\n${itens || '    (nenhum item ativo)'}`;
    })
    .join('\n\n');
}

interface CatalogProductLike {
  id: string;
  nome: string;
  variacao: string | null;
}

interface ComposicaoLinhaLike {
  produto_id: string;
  quantidade: number;
}

export function flattenComposicaoLinhas(
  comodos: Array<{ moveis?: Array<{ linhas?: ComposicaoLinhaLike[] }> }>,
): ComposicaoLinhaLike[] {
  const linhas: ComposicaoLinhaLike[] = [];
  for (const comodo of comodos ?? []) {
    for (const movel of comodo.moveis ?? []) {
      for (const linha of movel.linhas ?? []) {
        if (linha.quantidade > 0) linhas.push(linha);
      }
    }
  }
  return linhas;
}

export function runVerificacaoChecklist(
  composicaoLinhas: ComposicaoLinhaLike[],
  inventarioResultados: MarkupIAVerificacaoCategoriaResultado[] | undefined,
  checklist: MarkupIAVerificacaoCategoria[],
  catalog: CatalogProductLike[],
): MarkupIAVerificacaoCategoriaResultado[] {
  const catalogById = new Map(catalog.map((p) => [p.id, p]));
  const linhasCompostas = composicaoLinhas.map((l) => {
    const prod = catalogById.get(l.produto_id);
    return {
      produto_id: l.produto_id,
      nome: prod?.nome ?? '',
      variacao: prod?.variacao ?? null,
      quantidade: l.quantidade,
    };
  });

  const inventarioMap = new Map<string, MarkupIAVerificacaoItemResultado>();
  for (const cat of inventarioResultados ?? []) {
    for (const item of cat.itens) {
      const key = `${item.nome}|${item.variacao ?? ''}`;
      inventarioMap.set(key, item);
    }
  }

  return checklist
    .filter((c) => c.ativo)
    .map((cat) => ({
      categoria_id: cat.id,
      nome: cat.nome,
      itens: cat.itens
        .filter((i) => i.ativo)
        .flatMap((item) => {
          if (item.variacoes.length === 0) {
            const comp = linhasCompostas.find(
              (l) => l.nome.toUpperCase() === item.nome.toUpperCase(),
            );
            const invKey = `${item.nome}|`;
            const inv = inventarioMap.get(invKey);
            return [{
              item_id: item.id,
              nome: item.nome,
              variacao: null,
              status: resolveStatus(item, comp, inv),
              quantidade: comp?.quantidade ?? inv?.quantidade,
              motivo: resolveMotivo(item, comp, inv),
            }];
          }

          return item.variacoes.map((vari) => {
            const comp = linhasCompostas.find(
              (l) =>
                l.nome.toUpperCase() === item.nome.toUpperCase() &&
                (l.variacao ?? '').toUpperCase() === vari.toUpperCase(),
            );
            const invKey = `${item.nome}|${vari}`;
            const inv = inventarioMap.get(invKey);
            return {
              item_id: `${item.id}_${vari}`,
              nome: item.nome,
              variacao: vari,
              status: resolveStatus(item, comp, inv),
              quantidade: comp?.quantidade ?? inv?.quantidade,
              motivo: resolveMotivo(item, comp, inv),
            };
          });
        }),
    }));
}

function resolveStatus(
  item: MarkupIAVerificacaoItem,
  comp: { quantidade: number } | undefined,
  inv: MarkupIAVerificacaoItemResultado | undefined,
): MarkupIAVerificacaoItemStatus {
  if (item.somente_referencia) {
    return inv?.status === 'encontrado' ? 'referencia_apenas' : 'nao_aplicavel';
  }
  if (comp && comp.quantidade > 0) {
    if (inv?.status === 'ausente_documento') return 'inventado';
    return 'encontrado';
  }
  if (inv?.status === 'encontrado') return 'encontrado';
  if (inv?.status === 'referencia_apenas') return 'referencia_apenas';
  return 'ausente_documento';
}

function resolveMotivo(
  item: MarkupIAVerificacaoItem,
  comp: { quantidade: number } | undefined,
  inv: MarkupIAVerificacaoItemResultado | undefined,
): string | undefined {
  if (item.somente_referencia) {
    return 'Item de serviço — não entra no custo de materiais.';
  }
  if (comp && comp.quantidade > 0 && inv?.status === 'ausente_documento') {
    return 'Incluído na composição sem QUANT na planilha.';
  }
  if (comp && comp.quantidade > 0) {
    return `Incluído na composição (${comp.quantidade} un).`;
  }
  if (inv?.motivo) return inv.motivo;
  if (inv?.status === 'encontrado') return `Documento: ${inv.quantidade ?? '?'} un.`;
  return 'Sem QUANT na planilha.';
}

export const MARKUP_IA_INVENTARIO_PROMPT = `Você está na FASE 1 — INVENTÁRIO do orçamento Cortecloud.

Analise as imagens/PDFs e, para CADA categoria do checklist, liste itens com QUANT > 0 na planilha.

Retorne APENAS JSON:
{
  "categorias": [
    {
      "categoria_id": "chapas_mdf",
      "itens": [
        { "nome": "MDF BRANCO", "variacao": "15", "status": "encontrado", "quantidade": 2, "motivo": "QUANT=2" }
      ]
    }
  ]
}

Status: encontrado | ausente_documento | referencia_apenas

--- CHECKLIST ---
{{checklist_verificacao}}`;

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
7. Chapas: copie o nome comercial do documento (Branco eucatex, Beige Matt Arauco, Freijo…). Apelidos MDF BRANCO/ULTRA só se o PDF não tiver marca.
8. Dobradiças e corrediças são PRIORIDADE ALTA — releia a seção FERRAGENS até achar QUANT.
9. Nome e variação SEPARADOS:
   - "DOBRADIÇA RETA" → nome "DOBRADIÇA", variacao "RETA"
   - "CORREDIÇA OCULTA 45" → nome "CORREDIÇA OCULTA", variacao "45"
   - Chapa "Branco eucatex 15mm" → nome "Branco eucatex", variacao "15mm"
   - Fita "MADEIRA 22" → nome "MADEIRA", variacao "22" (categoria fita_borda)
10. Percorra também puxadores, trilhos e LED se esta categoria for a deles.
11. Se QUANT > 0: status DEVE ser "encontrado".
12. Se o item não aparece com QUANT > 0: omita do array OU use ausente_documento sem quantidade.

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

const VARIACOES_FERRAGEM_NOME = [
  'S CURVA',
  'CURVA',
  'RETA',
  'GAFAN',
  'CIMA',
  'BAIXO',
] as const;

/** Normaliza nome+variação e corrige status quando há QUANT > 0. */
export function parseInventarioItem(item: unknown): MarkupIAVerificacaoItemResultado {
  const i = item as Record<string, unknown>;
  let nome = String(i.nome ?? '').trim();
  let variacao = i.variacao != null && String(i.variacao).trim() !== ''
    ? String(i.variacao).trim()
    : null;
  const quantidade = i.quantidade != null && Number.isFinite(Number(i.quantidade))
    ? Number(i.quantidade)
    : undefined;
  let status = String(i.status ?? 'ausente_documento') as MarkupIAVerificacaoItemStatus;

  // "DOBRADIÇA RETA" / "CORREDIÇA OCULTA 45" → nome + variacao
  if (!variacao && nome) {
    const upper = nome.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const v of VARIACOES_FERRAGEM_NOME) {
      if (upper.endsWith(` ${v}`) || upper.endsWith(`/${v}`)) {
        nome = nome.slice(0, nome.length - v.length).replace(/[\s/]+$/u, '').trim();
        variacao = v;
        break;
      }
    }
    if (!variacao) {
      const mm = upper.match(/^(.*?)\s+(\d{1,3})\s*M?M?$/);
      if (mm) {
        nome = nome.replace(/\s+\d{1,3}\s*m?m?$/i, '').trim();
        variacao = mm[2];
      }
    }
  }

  // QUANT positivo nunca pode ficar como ausente_documento
  if ((quantidade ?? 0) > 0 && status !== 'referencia_apenas' && status !== 'nao_aplicavel') {
    status = 'encontrado';
  }
  if (status === 'encontrado' && (quantidade ?? 0) <= 0) {
    status = 'ausente_documento';
  }

  return {
    item_id: `${nome}${variacao ? `_${variacao}` : ''}`,
    nome,
    variacao,
    status,
    quantidade,
    motivo: i.motivo ? String(i.motivo) : undefined,
  };
}

export function parseInventarioCategoriaJson(
  raw: string,
  cat: MarkupIAVerificacaoCategoria,
): MarkupIAVerificacaoCategoriaResultado {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const itensRaw = Array.isArray(parsed.itens) ? parsed.itens : [];
  return {
    categoria_id: String(parsed.categoria_id ?? cat.id),
    nome: String(parsed.nome ?? cat.nome),
    itens: itensRaw.map(parseInventarioItem),
  };
}

export function parseInventarioJson(raw: string): MarkupIAVerificacaoCategoriaResultado[] {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const parsed = JSON.parse(text) as { categorias?: unknown[] };
  const categorias = Array.isArray(parsed.categorias) ? parsed.categorias : [];
  return categorias.map((c) => {
    const cat = c as Record<string, unknown>;
    const itensRaw = Array.isArray(cat.itens) ? cat.itens : [];
    return {
      categoria_id: String(cat.categoria_id ?? ''),
      nome: String(cat.nome ?? ''),
      itens: itensRaw.map(parseInventarioItem),
    };
  });
}

export type StreamEventType =
  | 'media_ready'
  | 'cortecloud_mode'
  | 'projetista_scanning'
  | 'projetista_reconcile'
  | 'projetista_result'
  | 'auditor_projetista'
  | 'auditor_inventario'
  | 'inventariante_retry'
  | 'category_scanning'
  | 'category_result'
  | 'catalogo'
  | 'composing'
  | 'validating'
  | 'retry'
  | 'complete'
  | 'error'
  | 'log';

export interface StreamEvent {
  type: StreamEventType;
  message?: string;
  data?: unknown;
}

export function encodeStreamEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
