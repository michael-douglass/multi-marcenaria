import {
  aplicarConfiguracaoFixaNosModulos,
  calcularLinhaProduto,
  recalcularModulos,
} from '@/lib/markup-calculo';
import { validarComposicaoContraSistema, type ValidacaoComposicaoIA } from '@/lib/markup-compose-validate';
import { casarProdutoNoCatalogo, confiancaEhSugerivel } from '@/lib/markup-match';
import type { MarkupServicoTemplateEfetivo } from '@/lib/markup-servicos';
import { normalizarUnidadeCobranca } from '@/lib/markup-servicos';
import { sincronizarServicosComTemplates } from '@/lib/markup-servicos';
import {
  estimarHorasServicosPorComposicao,
  mesclarHorasServicosIA,
  servicoDeveReceberHorasIa,
} from '@/lib/markup-servicos-estimativa';
import {
  criarModulosVazios,
  type MarkupComposeIADespesa,
  type MarkupComposeIAServicoLinha,
  type MarkupComposeIAResult,
  type MarkupComposicaoAnterior,
  type MarkupConfig,
  type MarkupDespesaTemplate,
  type MarkupIAResumoComodo,
  type MarkupLinhaDespesa,
  type MarkupLinhaOrigemIA,
  type MarkupLinhaProduto,
  type MarkupModulos,
  type MarkupModulosMeta,
  type MarkupModulosServicos,
  type MarkupProduto,
  type MarkupServicoTemplate,
} from '@/lib/markup-types';
import { rotuloCategoriaProdutoMarkup } from '@/lib/markup-ui';

type ServicoTemplateCompose = MarkupServicoTemplate | MarkupServicoTemplateEfetivo;

export type { ValidacaoComposicaoIA };

function mapLinhasMateriaisPlano(modulos: MarkupModulos): Map<string, MarkupLinhaProduto> {
  return new Map(
    (modulos.materiais?.linhas ?? [])
      .filter((l) => l.produto_id)
      .map((l) => [l.produto_id!, l]),
  );
}

/** Valor da linha no resumo por cômodo/móvel — usa qtd local × preço unitário, sem repetir o total agregado. */
function valorMaterialResumoAlinhado(
  mat: { produto_id?: string | null; descricao: string; quantidade: number; valor_total: number; ativo?: boolean },
  linhasPlana: Map<string, MarkupLinhaProduto>,
): number {
  if (mat.ativo === false) return 0;

  if (!mat.produto_id) {
    return Math.max(0, mat.valor_total);
  }

  const linhaPlana = linhasPlana.get(mat.produto_id);
  if (linhaPlana?.ativo === false) return 0;

  const quantidade = Math.max(0, Number(mat.quantidade) || 0);
  if (quantidade <= 0) return 0;

  const valorUnitario =
    linhaPlana?.valor_unitario ??
    (mat.valor_total > 0 && quantidade > 0 ? mat.valor_total / quantidade : 0);

  return calcularLinhaProduto({
    produto_id: mat.produto_id,
    descricao: mat.descricao,
    quantidade,
    valor_unitario: valorUnitario,
    valor_total: quantidade * valorUnitario,
    ativo: true,
  });
}

function recalcularSubtotaisComodosResumo(comodos: MarkupIAResumoComodo[]): MarkupIAResumoComodo[] {
  return comodos.map((comodo) => {
    const moveis = (comodo.moveis ?? []).map((movel) => {
      const materiais = movel.materiais ?? [];
      const subtotal =
        Math.round(materiais.reduce((acc, m) => acc + (m.valor_total ?? 0), 0) * 100) / 100;
      return { ...movel, subtotal };
    });
    const subtotal =
      Math.round(moveis.reduce((acc, m) => acc + m.subtotal, 0) * 100) / 100;
    return { ...comodo, moveis, subtotal };
  });
}

function somarSubtotaisComodosResumo(comodos: MarkupIAResumoComodo[]): number {
  return Math.round(
    comodos.reduce((acc, comodo) => acc + (comodo.subtotal ?? 0), 0) * 100,
  ) / 100;
}

/** Garante arrays aninhados na resposta da IA (evita crash em moveis/linhas ausentes). */
export function normalizarResultadoComposicaoIA(
  resultado: MarkupComposeIAResult,
): MarkupComposeIAResult {
  return {
    ...resultado,
    comodos: (resultado.comodos ?? []).map((comodo) => ({
      ...comodo,
      nome: comodo.nome?.trim() || 'Ambiente',
      moveis: (comodo.moveis ?? []).map((movel) => ({
        ...movel,
        nome: movel.nome?.trim() || 'Móvel',
        descricao: movel.descricao,
        linhas: (movel.linhas ?? []).filter(
          (linha) => linha && typeof linha.produto_id === 'string' && linha.produto_id.length > 0,
        ),
      })),
    })),
    servicos: resultado.servicos ?? [],
    despesas: resultado.despesas ?? [],
    resumo_texto: resultado.resumo_texto ?? '',
    itens_nao_catalogados: resultado.itens_nao_catalogados ?? [],
  };
}

export function agregarLinhasPorProduto(
  resultado: MarkupComposeIAResult,
  produtos: MarkupProduto[],
): MarkupLinhaProduto[] {
  const resultadoNormalizado = normalizarResultadoComposicaoIA(resultado);
  const produtoMap = new Map(produtos.map((p) => [p.id, p]));
  const qtdPorProduto = new Map<string, number>();
  const origemPorProduto = new Map<string, MarkupLinhaOrigemIA>();

  const prioridadeOrigem = (a?: MarkupLinhaOrigemIA, b?: MarkupLinhaOrigemIA) => {
    const rank = (o?: MarkupLinhaOrigemIA) =>
      o === 'projetista_complemento' ? 3 : o === 'projetista' ? 2 : o === 'cortecloud' || o === 'documento' ? 1 : 0;
    return rank(a) >= rank(b) ? a : b;
  };

  for (const comodo of resultadoNormalizado.comodos) {
    for (const movel of comodo.moveis ?? []) {
      for (const linha of movel.linhas ?? []) {
        const atual = qtdPorProduto.get(linha.produto_id) ?? 0;
        qtdPorProduto.set(linha.produto_id, atual + Math.max(0, linha.quantidade));
        if (linha.origem_ia) {
          origemPorProduto.set(
            linha.produto_id,
            prioridadeOrigem(origemPorProduto.get(linha.produto_id), linha.origem_ia) ?? linha.origem_ia,
          );
        }
      }
    }
  }

  for (const pid of resultadoNormalizado.produtos_origem_projetista ?? []) {
    origemPorProduto.set(
      pid,
      prioridadeOrigem(origemPorProduto.get(pid), 'projetista') ?? 'projetista',
    );
  }

  for (const linha of resultadoNormalizado.comodos.flatMap((c) =>
    (c.moveis ?? []).flatMap((m) => m.linhas ?? []),
  )) {
    if (linha.origem_ia === 'cortecloud' && linha.produto_id) {
      origemPorProduto.set(
        linha.produto_id,
        prioridadeOrigem(origemPorProduto.get(linha.produto_id), 'cortecloud') ?? 'cortecloud',
      );
    }
  }

  // Fallback: material que o projetista estimou por móvel (dimensões reais) mas que o
  // Inventariante não achou de nenhuma forma (0 no scan real) — sem isso, um móvel inteiro
  // podia ficar de fora do orçamento só porque a planilha Cortecloud não tinha QUANT pra ele.
  // Nunca soma em cima de uma quantidade real já encontrada — só preenche o que está zerado.
  const levantamento = resultadoNormalizado.levantamento_projetista;
  if (levantamento) {
    for (const mat of levantamento.totais_consolidados ?? []) {
      const match = casarProdutoNoCatalogo(mat.nome, mat.variacao, produtos);
      if (!match.produto || !confiancaEhSugerivel(match.confianca)) continue;
      const jaEncontradoPeloScanReal = (qtdPorProduto.get(match.produto.id) ?? 0) > 0;
      if (jaEncontradoPeloScanReal) continue;
      qtdPorProduto.set(match.produto.id, Math.max(0, mat.quantidade));
      origemPorProduto.set(match.produto.id, 'projetista');
    }
  }

  const linhas: MarkupLinhaProduto[] = [];
  for (const [produtoId, quantidade] of qtdPorProduto) {
    const produto = produtoMap.get(produtoId);
    if (!produto || quantidade <= 0) continue;
    const valorUnitario = produto.preco_unitario ?? 0;
    const origem_ia = origemPorProduto.get(produtoId);
    const catLabel = rotuloCategoriaProdutoMarkup(produto);
    linhas.push({
      produto_id: produtoId,
      descricao: produto.nome,
      variacao: produto.variacao,
      unidade: produto.unidade,
      categoria: catLabel === '—' ? null : catLabel,
      quantidade,
      valor_unitario: valorUnitario,
      valor_total: quantidade * valorUnitario,
      ativo: true,
      origem_ia,
      observacao:
        origem_ia === 'projetista_complemento'
          ? 'Complemento projetista'
          : origem_ia === 'projetista'
            ? 'Estimado pelo projetista'
            : origem_ia === 'documento'
              ? 'Extraído do documento'
              : undefined,
    });
  }

  return linhas.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
}

function aplicarServicosIA(
  iaServicos: MarkupComposeIAServicoLinha[] | undefined,
  servicosAtuais: MarkupModulosServicos,
  templates: ServicoTemplateCompose[],
  comodos: MarkupComposeIAResult['comodos'] = [],
): MarkupModulosServicos {
  const base: MarkupModulosServicos = {
    valor_hora: servicosAtuais?.valor_hora ?? 0,
    linhas: servicosAtuais?.linhas ?? [],
  };

  if (!templates.length) return base;

  const horasIaMap = new Map(
    (iaServicos ?? []).map((s) => [s.template_id, Math.max(0, s.horas)] as const),
  );
  const estimativaHoras = estimarHorasServicosPorComposicao(comodos, templates);
  const horasFinais = mesclarHorasServicosIA(horasIaMap, estimativaHoras, templates);

  const linhas = templates.map((t) => {
    const existente = base.linhas.find(
      (l) => l.template_id === t.id || l.descricao.trim() === t.nome.trim(),
    );
    const permitido = servicoDeveReceberHorasIa(t.nome);
    const horas = permitido ? (horasFinais.get(t.id) ?? 0) : (existente?.horas ?? 0);

    return {
      template_id: t.id,
      descricao: t.nome,
      horas: Math.max(0, horas),
      valor_hora: Math.max(0, Number(t.valor_hora_padrao) || 0),
      unidade: normalizarUnidadeCobranca(
        'unidade_cobranca' in t ? t.unidade_cobranca : 'hora',
      ),
      ativo: existente?.ativo !== false,
    };
  });

  return { ...base, linhas };
}

function aplicarDespesasIA(
  iaDespesas: MarkupComposeIADespesa[] | undefined,
  templates: MarkupDespesaTemplate[],
  existentes: MarkupLinhaDespesa[],
): MarkupLinhaDespesa[] {
  const iaMap = new Map((iaDespesas ?? []).map((d) => [d.template_id, d]));

  const linhasTemplate = templates.map((t) => {
    const ia = iaMap.get(t.id);
    const existente = existentes.find((e) => e.template_id === t.id || e.descricao === t.nome);

    if (ia) {
      return {
        template_id: t.id,
        descricao: t.nome,
        valor: ia.valor >= 0 ? ia.valor : t.valor_padrao,
        ativo: ia.ativo !== false,
      };
    }

    if (existente && existente.valor > 0) {
      return {
        template_id: t.id,
        descricao: t.nome,
        valor: existente.valor,
        ativo: existente.ativo !== false,
      };
    }

    return {
      template_id: t.id,
      descricao: t.nome,
      valor: t.valor_padrao,
      ativo: true,
    };
  });

  const extras = existentes.filter(
    (e) => !e.template_id && !templates.some((t) => t.nome.trim() === e.descricao.trim()),
  );

  return [...linhasTemplate, ...extras];
}

export function montarResumoIA(
  resultado: MarkupComposeIAResult,
  modulos: MarkupModulos,
  produtos: MarkupProduto[],
): MarkupModulosMeta {
  const resultadoNormalizado = normalizarResultadoComposicaoIA(resultado);
  const produtoMap = new Map(produtos.map((p) => [p.id, p]));
  const ativoPorProduto = new Map(
    (modulos.materiais?.linhas ?? [])
      .filter((l) => l.produto_id)
      .map((l) => [l.produto_id!, l.ativo !== false]),
  );

  const comodos: MarkupIAResumoComodo[] = resultadoNormalizado.comodos.map((comodo) => {
    const moveis = (comodo.moveis ?? []).map((movel) => {
      const materiais = (movel.linhas ?? [])
        .map((linha) => {
          const produto = produtoMap.get(linha.produto_id);
          if (!produto) return null;
          const valorUnitario = produto.preco_unitario ?? 0;
          const ativo = ativoPorProduto.get(linha.produto_id) ?? true;
          const valorTotal = calcularLinhaProduto({
            produto_id: linha.produto_id,
            descricao: produto.nome,
            quantidade: linha.quantidade,
            valor_unitario: valorUnitario,
            valor_total: linha.quantidade * valorUnitario,
            ativo,
          });
          return {
            produto_id: linha.produto_id,
            descricao: produto.variacao
              ? `${produto.nome} (${produto.variacao})`
              : produto.nome,
            quantidade: linha.quantidade,
            valor_total: valorTotal,
            ativo,
          };
        })
        .filter((m): m is NonNullable<typeof m> => m !== null);

      const subtotal = materiais.reduce((acc, m) => acc + m.valor_total, 0);
      return {
        nome: movel.nome,
        descricao: movel.descricao,
        materiais,
        subtotal: Math.round(subtotal * 100) / 100,
      };
    });

    const subtotal = moveis.reduce((acc, m) => acc + m.subtotal, 0);
    return {
      nome: comodo.nome,
      moveis,
      subtotal: Math.round(subtotal * 100) / 100,
    };
  });

  const despesasResumo = (modulos.despesas ?? []).map((d) => ({
    template_id: d.template_id,
    descricao: d.descricao,
    valor: d.valor,
    ativo: d.ativo !== false,
  }));

  return {
    resumo_ia: {
      gerado_em: new Date().toISOString(),
      comodos,
      preco_final: modulos.totais?.preco_final ?? 0,
      texto_resumo: resultadoNormalizado.resumo_texto,
      itens_nao_catalogados: resultadoNormalizado.itens_nao_catalogados,
      itens_extraidos: resultadoNormalizado.itens_extraidos,
      limites_anexos: resultadoNormalizado.limites_anexos,
      verificacao_categorias: resultadoNormalizado.verificacao_categorias,
      levantamento_projetista: resultadoNormalizado.levantamento_projetista,
      produtos_origem_projetista: resultadoNormalizado.produtos_origem_projetista,
      bloqueado: resultadoNormalizado.bloqueado,
      faltantes_criticos: resultadoNormalizado.faltantes_criticos,
      yaml_fidelidade: resultadoNormalizado.yaml_fidelidade,
      servicos: {
        linhas: (modulos.servicos?.linhas ?? []).map((l) => ({
          ...l,
          ativo: l.ativo !== false,
        })),
        custo_total: modulos.totais?.custo_servicos ?? 0,
      },
      despesas: despesasResumo,
      custo_materiais: modulos.totais?.custo_materiais ?? 0,
      custo_servicos: modulos.totais?.custo_servicos ?? 0,
      custo_despesas: modulos.totais?.custo_despesas ?? 0,
    },
  };
}

/** Mantém meta.resumo_ia alinhado aos módulos após edições manuais. */
export function sincronizarResumoIADosModulos(modulos: MarkupModulos): MarkupModulos {
  const resumo = modulos.meta?.resumo_ia;
  if (!resumo) return modulos;

  const linhasPlana = mapLinhasMateriaisPlano(modulos);
  const ativoPorProduto = new Map(
    Array.from(linhasPlana.entries()).map(([id, linha]) => [id, linha.ativo !== false]),
  );

  const comodosAtualizados = (resumo.comodos ?? []).map((comodo) => ({
    ...comodo,
    moveis: (comodo.moveis ?? []).map((movel) => ({
      ...movel,
      materiais: (movel.materiais ?? []).map((mat) => {
        const ativo = mat.produto_id
          ? (ativoPorProduto.get(mat.produto_id) ?? mat.ativo !== false)
          : mat.ativo !== false;
        const valorTotal = valorMaterialResumoAlinhado({ ...mat, ativo }, linhasPlana);
        return { ...mat, ativo, valor_total: valorTotal };
      }),
      subtotal: 0,
    })),
  }));

  const comodosComSubtotais = recalcularSubtotaisComodosResumo(comodosAtualizados);

  const produtosOrigemProjetista = Array.from(
    new Set([
      ...(resumo.produtos_origem_projetista ?? []),
      ...Array.from(linhasPlana.entries())
        .filter(
          ([, linha]) =>
            linha.origem_ia === 'projetista' || linha.origem_ia === 'projetista_complemento',
        )
        .map(([id]) => id),
    ]),
  );

  const servicosLinhas = (modulos.servicos?.linhas ?? []).map((l) => ({
    ...l,
    ativo: l.ativo !== false,
  }));

  const despesasResumo = (modulos.despesas ?? []).map((d, index) => {
    const existente = resumo.despesas?.[index];
    return {
      template_id: d.template_id ?? existente?.template_id,
      descricao: d.descricao,
      valor: d.valor,
      ativo: d.ativo !== false,
    };
  });

  return {
    ...modulos,
    meta: {
      ...modulos.meta,
      resumo_ia: {
        ...resumo,
        levantamento_projetista: resumo.levantamento_projetista,
        produtos_origem_projetista: produtosOrigemProjetista,
        comodos: comodosComSubtotais,
        preco_final: modulos.totais?.preco_final ?? resumo.preco_final ?? 0,
        servicos: {
          linhas: servicosLinhas,
          custo_total: modulos.totais?.custo_servicos ?? resumo.custo_servicos ?? 0,
        },
        despesas: despesasResumo,
        custo_materiais:
          modulos.totais?.custo_materiais ??
          somarSubtotaisComodosResumo(comodosComSubtotais) ??
          resumo.custo_materiais ??
          0,
        custo_servicos: modulos.totais?.custo_servicos ?? resumo.custo_servicos ?? 0,
        custo_despesas: modulos.totais?.custo_despesas ?? resumo.custo_despesas ?? 0,
      },
    },
  };
}

/** Indica se o orçamento já tem materiais, serviços, despesas ou resumo da IA preenchidos. */
export function orcamentoTemComposicao(modulos: MarkupModulos): boolean {
  return (
    (modulos.materiais?.linhas ?? []).some((l) => l.quantidade > 0) ||
    (modulos.servicos?.linhas ?? []).some((l) => l.horas > 0) ||
    (modulos.despesas ?? []).some((d) => d.ativo !== false && (d.valor ?? 0) > 0) ||
    Boolean(modulos.meta?.resumo_ia)
  );
}

/**
 * Base zerada para nova composição com IA — não reaproveita linhas do orçamento anterior.
 */
export function criarModulosBaseParaComposicaoIA(
  config: Partial<MarkupConfig>,
  despesaTemplates: MarkupDespesaTemplate[],
  servicoTemplates: ServicoTemplateCompose[],
): MarkupModulos {
  const base = criarModulosVazios(config);

  return recalcularModulos(
    aplicarConfiguracaoFixaNosModulos(config, {
      ...base,
      despesas: despesaTemplates.map((t) => ({
        template_id: t.id,
        descricao: t.nome,
        valor: t.valor_padrao,
        ativo: true,
      })),
      servicos: {
        ...base.servicos,
        linhas: sincronizarServicosComTemplates(servicoTemplates, [], {
          preencherValorHoraPadrao: true,
          valorHoraFallback: config.valor_hora_marcenaria ?? 0,
        }),
      },
    }),
  );
}

export function aplicarComposicaoIA(
  modulos: MarkupModulos,
  resultado: MarkupComposeIAResult,
  produtos: MarkupProduto[],
  despesaTemplates: MarkupDespesaTemplate[] = [],
  servicoTemplates: ServicoTemplateCompose[] = [],
  config?: MarkupConfig,
): { modulos: MarkupModulos; validacao: ValidacaoComposicaoIA } {
  const resultadoNormalizado = normalizarResultadoComposicaoIA(resultado);
  const validacao = config
    ? validarComposicaoContraSistema(
        resultadoNormalizado,
        produtos,
        servicoTemplates,
        despesaTemplates,
        config,
      )
    : {
        erros: [],
        avisos: [],
        subtotalMateriais: 0,
        bloquearSave: false,
      };

  const linhas = agregarLinhasPorProduto(resultadoNormalizado, produtos);
  const linhasServicoBase = sincronizarServicosComTemplates(
    servicoTemplates,
    modulos.servicos?.linhas ?? [],
  );
  const servicosModuloBase: MarkupModulosServicos = {
    valor_hora: modulos.servicos?.valor_hora ?? 0,
    linhas: linhasServicoBase,
  };
  const servicos = aplicarServicosIA(
    resultadoNormalizado.servicos,
    servicosModuloBase,
    servicoTemplates,
    resultadoNormalizado.comodos,
  );
  const despesas = aplicarDespesasIA(
    resultadoNormalizado.despesas,
    despesaTemplates,
    modulos.despesas ?? [],
  );

  const parcial = recalcularModulos({
    ...modulos,
    materiais: { ...modulos.materiais, linhas },
    servicos,
    despesas,
  });

  const meta = montarResumoIA(resultadoNormalizado, parcial, produtos);

  return {
    modulos: {
      ...parcial,
      meta: {
        ...modulos.meta,
        ...meta,
        // Mantém ordem customizada do catálogo e snapshot de desfazer ao recompor com IA
        catalogo_ordem_por_categoria: modulos.meta?.catalogo_ordem_por_categoria,
        composicao_anterior: modulos.meta?.composicao_anterior,
      },
    },
    validacao,
  };
}

/** Cria cópia do orçamento imediatamente antes de aplicar a composição da IA. */
export function criarSnapshotComposicaoAnterior(
  modulos: MarkupModulos,
  titulo: string,
  observacoesRodape: string,
): MarkupComposicaoAnterior {
  const modulosLimpos = JSON.parse(JSON.stringify(modulos)) as MarkupModulos;
  if (modulosLimpos.meta) {
    delete modulosLimpos.meta.resumo_ia;
    delete modulosLimpos.meta.composicao_anterior;
    if (Object.keys(modulosLimpos.meta).length === 0) {
      delete modulosLimpos.meta;
    }
  }

  return {
    modulos: modulosLimpos,
    titulo,
    observacoes_rodape: observacoesRodape,
    salvo_em: new Date().toISOString(),
  };
}

export function podeDesfazerComposicaoIA(modulos: MarkupModulos): boolean {
  return Boolean(modulos.meta?.resumo_ia);
}

export function resolverComposicaoAnterior(
  modulos: MarkupModulos,
  ref?: MarkupComposicaoAnterior | null,
): MarkupComposicaoAnterior | null {
  return ref ?? modulos.meta?.composicao_anterior ?? null;
}
