import { calcularLinhaProduto } from './markup-calculo';
import {
  calcularSubtotalMateriaisComposicao,
  contarLinhasMateriais,
  detectCortecloudContext,
  extrairSubtotalDocumento,
} from './markup-cortecloud';
import type {
  MarkupComposeIAResult,
  MarkupConfig,
  MarkupProduto,
} from './markup-types';
export interface ValidacaoComposicaoIA {
  erros: string[];
  avisos: string[];
  subtotalMateriais: number;
  bloquearSave: boolean;
}

function textoIndicaCortecloud(texto: string): boolean {
  return detectCortecloudContext(texto);
}

export function validarComposicaoContraSistema(
  resultado: MarkupComposeIAResult,
  produtos: MarkupProduto[],
  servicoTemplates: Array<{ id: string }>,
  despesaTemplates: Array<{ id: string }>,
  _config: MarkupConfig,
): ValidacaoComposicaoIA {
  const erros: string[] = [];
  const avisos: string[] = [];
  const produtoIds = new Set(produtos.map((p) => p.id));
  const servicoIds = new Set(servicoTemplates.map((t) => t.id));
  const despesaIds = new Set(despesaTemplates.map((t) => t.id));
  const produtoMap = new Map(produtos.map((p) => [p.id, p]));

  let subtotalMateriais = 0;

  for (const comodo of resultado.comodos ?? []) {
    for (const movel of comodo.moveis ?? []) {
      for (const linha of movel.linhas ?? []) {
        if (!produtoIds.has(linha.produto_id)) {
          erros.push(`Material com produto_id inválido: ${linha.produto_id}`);
          continue;
        }
        const produto = produtoMap.get(linha.produto_id)!;
        const qtd = Math.max(0, linha.quantidade);
        const preco = produto.preco_unitario ?? 0;
        subtotalMateriais += calcularLinhaProduto({
          produto_id: linha.produto_id,
          descricao: produto.nome,
          quantidade: qtd,
          valor_unitario: preco,
          valor_total: qtd * preco,
          ativo: true,
        });
      }
    }
  }

  subtotalMateriais = Math.round(subtotalMateriais * 100) / 100;

  for (const s of resultado.servicos ?? []) {
    if (!servicoIds.has(s.template_id)) {
      erros.push(`Serviço com template_id inválido: ${s.template_id}`);
    }
    if (s.horas < 0) {
      avisos.push(`Horas negativas corrigidas para serviço ${s.template_id}`);
    }
  }

  const totalHorasServicos = (resultado.servicos ?? []).reduce(
    (acc, s) => acc + Math.max(0, s.horas),
    0,
  );
  if (totalHorasServicos <= 0 && servicoTemplates.length > 0) {
    avisos.push('Nenhuma hora de mão de obra foi calculada para este orçamento.');
  }

  for (const d of resultado.despesas ?? []) {
    if (!despesaIds.has(d.template_id)) {
      erros.push(`Despesa com template_id inválido: ${d.template_id}`);
    }
  }

  if (resultado.itens_nao_catalogados?.length) {
    for (const item of resultado.itens_nao_catalogados) {
      avisos.push(`Item não catalogado: ${item}`);
    }
  }

  const textoCompleto = [
    resultado.resumo_texto ?? '',
    ...resultado.comodos.map((c) => c.nome ?? ''),
  ].join(' ');

  if (textoIndicaCortecloud(textoCompleto)) {
    const linhasMateriais = contarLinhasMateriais(resultado);
    if (linhasMateriais < 3) {
      avisos.push(
        'Poucas linhas de material para planilha Cortecloud — verifique se a IA transcreveu todas as linhas com QUANT > 0.',
      );
    }

    const subtotalDoc = extrairSubtotalDocumento(resultado.resumo_texto ?? '');
    const subtotalCalculado = calcularSubtotalMateriaisComposicao(resultado, produtos);
    if (subtotalDoc != null && subtotalCalculado > 0) {
      const divergencia = Math.abs(subtotalCalculado - subtotalDoc) / subtotalDoc;
      if (divergencia > 0.05) {
        avisos.push(
          `Subtotal materiais (R$ ${subtotalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) diverge >5% do documento (R$ ${subtotalDoc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
        );
      }
    } else if (subtotalMateriais > 0 && subtotalMateriais < 2000 && linhasMateriais < 5) {
      avisos.push(
        'Subtotal de materiais parece baixo para planilha Cortecloud — confira se não faltam chapas, ferragens ou fitas.',
      );
    }
  }

  if (resultado.bloqueado || (resultado.faltantes_criticos?.length ?? 0) > 0) {
    const faltantes = resultado.faltantes_criticos ?? [];
    avisos.push(
      faltantes.length > 0
        ? `Composição incompleta — faltam itens críticos: ${faltantes.slice(0, 4).join('; ')}${faltantes.length > 4 ? '…' : ''}`
        : 'Composição incompleta — faltam itens críticos (dobradiças, corrediças ou fitas).',
    );
  }

  return {
    erros,
    avisos,
    subtotalMateriais,
    bloquearSave: erros.length > 0,
  };
}
