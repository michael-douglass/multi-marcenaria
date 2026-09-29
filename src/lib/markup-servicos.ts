import type {
  MarkupConfig,
  MarkupLinhaServico,
  MarkupModulos,
  MarkupModulosServicos,
  MarkupServicoTemplate,
  MarkupServicoUnidade,
} from './markup-types';

function arredondarServico(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function normalizarUnidadeCobranca(raw: unknown): MarkupServicoUnidade {
  return raw === 'dia' ? 'dia' : 'hora';
}

export function rotuloUnidadeCobranca(unidade: MarkupServicoUnidade | undefined): {
  quantidade: string;
  valor: string;
  sufixo: string;
  formula: string;
} {
  if (unidade === 'dia') {
    return {
      quantidade: 'Dias',
      valor: 'Valor/dia',
      sufixo: 'd',
      formula: 'dias × valor/dia = custo',
    };
  }
  return {
    quantidade: 'Horas',
    valor: 'Valor/hora',
    sufixo: 'h',
    formula: 'horas × valor/hora = custo',
  };
}

const LEGACY_SERVICO_CAMPOS: Array<{ key: string; descricao: string }> = [
  { key: 'horas_projeto', descricao: 'Horas projeto/design' },
  { key: 'horas_producao', descricao: 'Horas produção' },
  { key: 'horas_instalacao', descricao: 'Horas instalação' },
];

const LEGACY_SERVICO_PADRAO: Array<{
  configKey: keyof Pick<
    MarkupConfig,
    'horas_projeto_padrao' | 'horas_producao_padrao' | 'horas_instalacao_padrao'
  >;
  descricao: string;
  ordem: number;
}> = [
  { configKey: 'horas_projeto_padrao', descricao: 'Horas projeto/design', ordem: 1 },
  { configKey: 'horas_producao_padrao', descricao: 'Horas produção', ordem: 2 },
  { configKey: 'horas_instalacao_padrao', descricao: 'Horas instalação', ordem: 3 },
];

export type MarkupServicoTemplateEfetivo = Pick<
  MarkupServicoTemplate,
  'id' | 'nome' | 'valor_hora_padrao' | 'unidade_cobranca' | 'ordem'
>;

/** Templates do banco ou, se vazio, campos legados da markup_config. */
export function resolverServicoTemplatesEfetivos(
  templates: MarkupServicoTemplate[],
  config?: Pick<MarkupConfig, 'valor_hora_marcenaria'>,
): MarkupServicoTemplateEfetivo[] {
  if (templates.length > 0) {
    return [...templates]
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((t) => ({
        id: t.id,
        nome: t.nome,
        valor_hora_padrao: t.valor_hora_padrao,
        unidade_cobranca: normalizarUnidadeCobranca(t.unidade_cobranca),
        ordem: t.ordem,
      }));
  }

  if (!config) return [];

  const valorHoraFallback = Math.max(0, Number(config.valor_hora_marcenaria) || 0);

  return LEGACY_SERVICO_PADRAO.map(({ descricao, ordem, configKey }) => ({
    id: `legacy-${configKey}`,
    nome: descricao,
    valor_hora_padrao: valorHoraFallback,
    unidade_cobranca: 'hora' as const,
    ordem,
  }));
}

export function servicoTemplatesPrecisamSincronizar(
  templates: MarkupServicoTemplateEfetivo[],
  linhas: MarkupLinhaServico[],
): boolean {
  if (templates.length === 0) return false;
  if (linhas.length === 0) return true;

  return templates.some(
    (t) =>
      !linhas.some(
        (l) => l.template_id === t.id || l.descricao.trim() === t.nome.trim(),
      ),
  );
}

export interface SincronizarServicosOptions {
  /** Preenche valor/hora zerado com o padrão do template. */
  preencherValorHoraPadrao?: boolean;
  /** Valor/hora padrão anterior por template (propaga alterações em Configurações). */
  valorHoraPadraoAnteriores?: Map<string, number>;
  /** Valor/hora global de fallback (markup_config.valor_hora_marcenaria). */
  valorHoraFallback?: number;
}

/** Decodifica assinatura `id:nome:valor_hora|...` usada na sincronização da calculadora. */
export function parseAssinaturaServicoTemplates(assinatura: string | null): Map<string, number> {
  const map = new Map<string, number>();
  if (!assinatura) return map;

  for (const parte of assinatura.split('|')) {
    const [id, , valorStr] = parte.split(':');
    if (!id) continue;
    map.set(id, Math.max(0, parseFloat(valorStr) || 0));
  }

  return map;
}

export function resolverValorHoraLinhaServico(
  linha: MarkupLinhaServico,
  valorHoraFallback = 0,
): number {
  const valorLinha = Number(linha.valor_hora);
  if (Number.isFinite(valorLinha) && valorLinha > 0) return valorLinha;
  return Math.max(0, valorHoraFallback);
}

/** Converte formato antigo (horas_projeto etc.) para linhas dinâmicas. */
export function normalizarServicosModulos(
  servicos: unknown,
  templates: Array<
    Pick<MarkupServicoTemplate, 'id' | 'nome' | 'valor_hora_padrao'> & {
      unidade_cobranca?: MarkupServicoUnidade;
    }
  > = [],
  valorHoraFallback = 0,
): MarkupModulosServicos {
  const raw = (servicos ?? {}) as Record<string, unknown>;
  const fallback = Math.max(0, Number(raw.valor_hora) || valorHoraFallback);

  if (Array.isArray(raw.linhas)) {
    return {
      valor_hora: fallback,
      linhas: (raw.linhas as MarkupLinhaServico[]).map((l) => ({
        template_id: l.template_id ?? null,
        descricao: String(l.descricao ?? '').trim() || 'Serviço',
        horas: Math.max(0, Number(l.horas) || 0),
        valor_hora: resolverValorHoraLinhaServico(l, fallback),
        unidade: normalizarUnidadeCobranca(l.unidade),
        ativo: l.ativo !== false,
      })),
    };
  }

  const linhasLegado: MarkupLinhaServico[] = LEGACY_SERVICO_CAMPOS.map(({ key, descricao }, i) => {
    const template = templates[i];
    return {
      template_id: template?.id ?? null,
      descricao: template?.nome ?? descricao,
      horas: Math.max(0, Number(raw[key]) || 0),
      valor_hora: Math.max(0, Number(template?.valor_hora_padrao) || fallback),
      unidade: normalizarUnidadeCobranca(template?.unidade_cobranca),
      ativo: true,
    };
  }).filter((l) => l.horas > 0 || templates.some((t) => t.id === l.template_id));

  if (linhasLegado.length > 0) {
    return {
      valor_hora: fallback,
      linhas: linhasLegado,
    };
  }

  return {
    valor_hora: fallback,
    linhas: [],
  };
}

/** Espelha templates de configuração nas linhas do orçamento. */
export function sincronizarServicosComTemplates(
  templates: MarkupServicoTemplateEfetivo[],
  existentes?: MarkupLinhaServico[],
  options: SincronizarServicosOptions = {},
): MarkupLinhaServico[] {
  const preencherValorHoraPadrao = options.preencherValorHoraPadrao ?? true;
  const valorHoraPadraoAnteriores = options.valorHoraPadraoAnteriores;
  const valorHoraFallback = Math.max(0, options.valorHoraFallback ?? 0);
  const normalizados = normalizarServicosModulos(
    { linhas: existentes ?? [] },
    templates,
    valorHoraFallback,
  );

  return templates.map((t) => {
    const existente = normalizados.linhas.find(
      (e) => e.template_id === t.id || e.descricao.trim() === t.nome.trim(),
    );
    const valorHoraPadrao = Math.max(0, Number(t.valor_hora_padrao) || 0);
    const valorHoraSalvo = Math.max(0, Number(existente?.valor_hora) || 0);
    const valorHoraPadraoAnterior = valorHoraPadraoAnteriores?.get(t.id);

    let valorHora: number;
    if (!existente) {
      valorHora = valorHoraPadrao > 0 ? valorHoraPadrao : valorHoraFallback;
    } else if (
      valorHoraPadraoAnterior !== undefined &&
      valorHoraPadraoAnterior !== valorHoraPadrao &&
      valorHoraSalvo === valorHoraPadraoAnterior
    ) {
      valorHora = valorHoraPadrao > 0 ? valorHoraPadrao : valorHoraFallback;
    } else if (preencherValorHoraPadrao && valorHoraSalvo === 0) {
      valorHora = valorHoraPadrao > 0 ? valorHoraPadrao : valorHoraFallback;
    } else if (valorHoraPadrao > 0 && valorHoraSalvo !== valorHoraPadrao) {
      // Espelha sempre o valor/hora padrão definido em Configurações.
      valorHora = valorHoraPadrao;
    } else {
      valorHora = valorHoraSalvo > 0 ? valorHoraSalvo : valorHoraPadrao || valorHoraFallback;
    }

    return {
      template_id: t.id,
      descricao: t.nome,
      horas: Math.max(0, Number(existente?.horas) || 0),
      valor_hora: valorHora,
      unidade: normalizarUnidadeCobranca(t.unidade_cobranca),
      ativo: existente?.ativo !== false,
    };
  });
}

export function calcularHorasTotaisServicos(linhas: MarkupLinhaServico[]): number {
  return linhas.reduce((acc, l) => {
    if (l.ativo === false) return acc;
    if (normalizarUnidadeCobranca(l.unidade) !== 'hora') return acc;
    return acc + Math.max(0, l.horas);
  }, 0);
}

export function calcularDiasTotaisServicos(linhas: MarkupLinhaServico[]): number {
  return linhas.reduce((acc, l) => {
    if (l.ativo === false) return acc;
    if (normalizarUnidadeCobranca(l.unidade) !== 'dia') return acc;
    return acc + Math.max(0, l.horas);
  }, 0);
}

export function calcularCustoServicoHoras(horas: number, valorHora: number): number {
  return arredondarServico(Math.max(0, horas) * Math.max(0, valorHora));
}

export function calcularCustoServicosFromLinhas(
  linhas: MarkupLinhaServico[],
  valorHoraFallback = 0,
): number {
  return arredondarServico(
    linhas.reduce((acc, l) => {
      if (l.ativo === false) return acc;
      const valorHora = resolverValorHoraLinhaServico(l, valorHoraFallback);
      return acc + calcularCustoServicoHoras(l.horas, valorHora);
    }, 0),
  );
}

/** Garante defaults de legado (ativo, desconto, preco_final_bruto). */
export function normalizarModulosServicos(modulos: MarkupModulos): MarkupModulos {
  const totais = modulos.totais ?? {
    custo_materiais: 0,
    custo_materiais_ajustado: 0,
    custo_servicos: 0,
    custo_despesas: 0,
    subtotal_custo: 0,
    custo_com_impostos: 0,
    preco_final_bruto: 0,
    preco_final: 0,
  };
  const valorHoraFallback = Math.max(0, modulos.servicos?.valor_hora ?? 0);

  return {
    ...modulos,
    materiais: {
      ...modulos.materiais,
      linhas: (modulos.materiais?.linhas ?? []).map((l) => ({
        ...l,
        ativo: l.ativo !== false,
      })),
    },
    servicos: {
      ...modulos.servicos,
      linhas: (modulos.servicos?.linhas ?? []).map((l) => ({
        ...l,
        valor_hora: resolverValorHoraLinhaServico(l, valorHoraFallback),
        unidade: normalizarUnidadeCobranca(l.unidade),
        ativo: l.ativo !== false,
      })),
    },
    margem: {
      ...modulos.margem,
      desconto_final_percent: Math.min(
        100,
        Math.max(0, modulos.margem?.desconto_final_percent ?? 0),
      ),
    },
    totais: {
      ...totais,
      preco_final_bruto: totais.preco_final_bruto ?? totais.preco_final ?? 0,
    },
  };
}

export interface MarkupResumoIAServicos {
  linhas: MarkupLinhaServico[];
  custo_total: number;
}

/** Aceita resumo_ia.servicos no formato novo (linhas) ou legado (horas_projeto etc.). */
export function normalizarResumoIAServicos(servicos: unknown): MarkupResumoIAServicos | null {
  if (!servicos || typeof servicos !== 'object') return null;
  const raw = servicos as Record<string, unknown>;

  if (Array.isArray(raw.linhas)) {
    const linhas = (raw.linhas as MarkupLinhaServico[]).map((l) => ({
      template_id: l.template_id ?? null,
      descricao: String(l.descricao ?? '').trim() || 'Serviço',
      horas: Math.max(0, Number(l.horas) || 0),
      valor_hora: Math.max(0, Number(l.valor_hora) || 0),
      unidade: normalizarUnidadeCobranca(l.unidade),
      ativo: l.ativo !== false,
    }));
    if (linhas.length === 0) return null;
    return {
      linhas,
      custo_total: Math.max(0, Number(raw.custo_total) || 0),
    };
  }

  const linhas = LEGACY_SERVICO_CAMPOS.map(({ key, descricao }) => ({
    template_id: null as string | null,
    descricao,
    horas: Math.max(0, Number(raw[key]) || 0),
    valor_hora: 0,
  }));

  const temHoras = linhas.some((l) => l.horas > 0);
  const custoTotal = Math.max(0, Number(raw.custo_total) || 0);
  if (!temHoras && custoTotal <= 0) return null;

  return { linhas, custo_total: custoTotal };
}

function isTabelaMarkupInexistente(error: { code?: string; message?: string }): boolean {
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find') ||
    (msg.includes('relation') && msg.includes('not exist'))
  );
}

export { isTabelaMarkupInexistente };
