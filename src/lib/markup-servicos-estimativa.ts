import type { MarkupComposeIAComodo } from './markup-types';

export interface ServicoTemplateEstimativa {
  id: string;
  nome: string;
}

function arredondarMeiaHora(valor: number): number {
  return Math.round(Math.max(0, valor) * 2) / 2;
}

function nomeIndicaTipo(nome: string, termos: string[]): boolean {
  const texto = nome.toLowerCase();
  return termos.some((t) => texto.includes(t));
}

function contarEscopoComposicao(comodos: MarkupComposeIAComodo[]) {
  const comodosValidos = comodos ?? [];
  const totalComodos = comodosValidos.length;
  let totalMoveis = 0;
  let totalLinhas = 0;

  for (const comodo of comodosValidos) {
    const moveis = comodo.moveis ?? [];
    totalMoveis += moveis.length;
    for (const movel of moveis) {
      totalLinhas += (movel.linhas ?? []).length;
    }
  }

  return {
    totalComodos: Math.max(1, totalComodos),
    totalMoveis: Math.max(1, totalMoveis),
    totalLinhas: Math.max(1, totalLinhas),
  };
}

/**
 * Estima horas por template quando a IA não preenche (ou preenche parcialmente).
 * Usa escopo dos materiais compostos: cômodos, móveis e linhas de catálogo.
 */
export function estimarHorasServicosPorComposicao(
  comodos: MarkupComposeIAComodo[],
  templates: ServicoTemplateEstimativa[],
): Map<string, number> {
  const map = new Map<string, number>();
  if (!templates.length) return map;

  const { totalComodos, totalMoveis, totalLinhas } = contarEscopoComposicao(comodos);

  for (const template of templates) {
    const nome = template.nome;

    if (nomeIndicaTipo(nome, ['projeto', 'design', 'medição', 'medicao', 'levantamento'])) {
      map.set(template.id, arredondarMeiaHora(totalComodos * 6 + totalMoveis * 1.5));
      continue;
    }

    if (nomeIndicaTipo(nome, ['produção', 'producao', 'oficina', 'fabricação', 'fabricacao'])) {
      map.set(template.id, arredondarMeiaHora(totalLinhas * 0.75 + totalMoveis * 5));
      continue;
    }

    if (nomeIndicaTipo(nome, ['instalação', 'instalacao', 'montagem', 'entrega'])) {
      map.set(template.id, arredondarMeiaHora(totalComodos * 3 + totalMoveis * 2.5));
      continue;
    }

    map.set(template.id, arredondarMeiaHora(totalMoveis * 3));
  }

  return map;
}

export function mesclarHorasServicosIA(
  horasIa: Map<string, number>,
  estimativa: Map<string, number>,
): Map<string, number> {
  const resultado = new Map<string, number>();

  for (const [templateId, horasEstimadas] of estimativa) {
    const horasDaIa = horasIa.get(templateId) ?? 0;
    resultado.set(templateId, horasDaIa > 0 ? horasDaIa : horasEstimadas);
  }

  for (const [templateId, horas] of horasIa) {
    if (!resultado.has(templateId) && horas > 0) {
      resultado.set(templateId, horas);
    }
  }

  return resultado;
}
