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
  /** Se true, item não entra como material (ex.: Serviço) */
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
        nota: 'Não incluir em materiais — apenas referência de mão de obra/processamento.',
      },
    ],
  },
];

export function normalizarChecklistVerificacao(
  raw: MarkupIAVerificacaoCategoria[] | null | undefined,
): MarkupIAVerificacaoCategoria[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return structuredClone(MARKUP_IA_VERIFICACAO_PADRAO);
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

function slugifyVerificacao(nome: string): string {
  return (
    nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'item'
  );
}

export function coletarIdsChecklist(checklist: MarkupIAVerificacaoCategoria[]): Set<string> {
  const ids = new Set<string>();
  for (const cat of checklist) {
    ids.add(cat.id);
    for (const item of cat.itens) ids.add(item.id);
  }
  return ids;
}

export function slugVerificacaoId(nome: string, existentes: Set<string>): string {
  const base = slugifyVerificacao(nome);
  let id = base;
  let n = 2;
  while (existentes.has(id)) {
    id = `${base}_${n}`;
    n += 1;
  }
  existentes.add(id);
  return id;
}

export function parseVariacoesTexto(texto: string): string[] {
  return texto
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function criarCategoriaVerificacao(
  nome: string,
  ordem: number,
  idsExistentes: Set<string>,
): MarkupIAVerificacaoCategoria {
  return {
    id: slugVerificacaoId(nome, idsExistentes),
    nome: nome.trim(),
    ordem,
    ativo: true,
    itens: [],
  };
}

export function criarItemVerificacao(
  nome: string,
  variacoesTexto: string,
  options?: Partial<Pick<MarkupIAVerificacaoItem, 'prioridade' | 'somente_referencia' | 'nota'>>,
  idsExistentes?: Set<string>,
): MarkupIAVerificacaoItem {
  const ids = idsExistentes ?? new Set<string>();
  return {
    id: slugVerificacaoId(nome, ids),
    nome: nome.trim().toUpperCase(),
    variacoes: parseVariacoesTexto(variacoesTexto),
    ativo: true,
    prioridade: options?.prioridade === 'alta' ? 'alta' : 'normal',
    somente_referencia: options?.somente_referencia,
    nota: options?.nota?.trim() || undefined,
  };
}

export function contarChecklistAtivo(checklist: MarkupIAVerificacaoCategoria[]): {
  categorias: number;
  itens: number;
} {
  const categoriasAtivas = checklist.filter((c) => c.ativo);
  const itens = categoriasAtivas.reduce(
    (acc, c) => acc + c.itens.filter((i) => i.ativo).length,
    0,
  );
  return { categorias: categoriasAtivas.length, itens };
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
          const ref = i.somente_referencia ? ' [SOMENTE REFERÊNCIA — não é material]' : '';
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
    return 'Incluído na composição sem QUANT na planilha — possível item inventado.';
  }
  if (comp && comp.quantidade > 0) {
    return `Incluído na composição (${comp.quantidade} un).`;
  }
  if (inv?.motivo) return inv.motivo;
  if (inv?.status === 'encontrado') return `Documento: ${inv.quantidade ?? '?'} un.`;
  return 'Sem QUANT na planilha — apenas tabela de referência ou ausente.';
}

export const MARKUP_IA_INVENTARIO_PROMPT = `Você está na FASE 1 — INVENTÁRIO do orçamento Cortecloud.

Analise as imagens/PDFs e, para CADA categoria do checklist abaixo, liste os itens que aparecem com coluna QUANT > 0 na planilha.

REGRAS:
- Linhas só com preço unitário, sem QUANT, são referência — marque como referencia_apenas.
- SERVIÇO nunca é material.
- Não invente quantidades.

Retorne APENAS JSON:
{
  "categorias": [
    {
      "categoria_id": "id-da-categoria",
      "itens": [
        { "nome": "MDF BRANCO", "variacao": "15", "status": "encontrado", "quantidade": 2, "motivo": "QUANT=2 na planilha" }
      ]
    }
  ]
}

Status permitidos: encontrado | ausente_documento | referencia_apenas

--- CHECKLIST ---
{{checklist_verificacao}}`;

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

  if (!categoriaTemAlgumEncontrado(verMap.get('chapas_mdf'))) {
    faltantes.push('Chapas de MDF (nenhuma chapa na composição)');
  }

  const ferragens = verMap.get('ferragens_corr_dobr');
  const temDobradica = categoriaTemItemEncontrado(ferragens, ['DOBRADIÇA', 'DOBRADICA']);
  const temCorredica = categoriaTemItemEncontrado(ferragens, ['CORREDIÇA', 'CORREDICA']);
  if (!temDobradica && !temCorredica) {
    faltantes.push('Ferragens: falta dobradiça ou corrediça na composição');
  }

  if (!categoriaTemAlgumEncontrado(verMap.get('fita_borda'))) {
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
