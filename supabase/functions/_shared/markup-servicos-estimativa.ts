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

/** Horas que a IA pode preencher: oficina (produção) e casa do cliente (instalação). */
export function servicoDeveReceberHorasIa(nome: string): boolean {
  if (nomeIndicaTipo(nome, ['produção', 'producao', 'oficina', 'fabricação', 'fabricacao'])) {
    return true;
  }
  if (nomeIndicaTipo(nome, ['instalação', 'instalacao'])) {
    return !nomeIndicaTipo(nome, ['montador', 'comição', 'comissao', 'comissão']);
  }
  return false;
}

function contarEscopoComposicao(
  comodos: Array<{ moveis?: Array<{ linhas?: unknown[] }> }>,
) {
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

export function estimarHorasServicosPorComposicao(
  comodos: Array<{ moveis?: Array<{ linhas?: unknown[] }> }>,
  templates: ServicoTemplateEstimativa[],
): Map<string, number> {
  const map = new Map<string, number>();
  if (!templates.length) return map;

  const { totalComodos, totalMoveis, totalLinhas } = contarEscopoComposicao(comodos);

  for (const template of templates) {
    const nome = template.nome;
    if (!servicoDeveReceberHorasIa(nome)) continue;

    if (nomeIndicaTipo(nome, ['produção', 'producao', 'oficina', 'fabricação', 'fabricacao'])) {
      map.set(template.id, arredondarMeiaHora(totalLinhas * 0.75 + totalMoveis * 5));
      continue;
    }

    if (nomeIndicaTipo(nome, ['instalação', 'instalacao'])) {
      map.set(template.id, arredondarMeiaHora(totalComodos * 3 + totalMoveis * 2.5));
    }
  }

  return map;
}

export function mesclarHorasServicosIA(
  horasIa: Map<string, number>,
  estimativa: Map<string, number>,
  templates: ServicoTemplateEstimativa[] = [],
): Map<string, number> {
  const resultado = new Map<string, number>();
  const permitidos = new Set(
    templates.filter((t) => servicoDeveReceberHorasIa(t.nome)).map((t) => t.id),
  );

  for (const [templateId, horasEstimadas] of estimativa) {
    if (permitidos.size > 0 && !permitidos.has(templateId)) continue;
    const horasDaIa = horasIa.get(templateId) ?? 0;
    resultado.set(templateId, horasDaIa > 0 ? horasDaIa : horasEstimadas);
  }

  for (const [templateId, horas] of horasIa) {
    if (permitidos.size > 0 && !permitidos.has(templateId)) continue;
    if (!resultado.has(templateId) && horas > 0) {
      resultado.set(templateId, horas);
    }
  }

  return resultado;
}
