import type { MarkupIAVerificacaoCategoria } from '@/lib/markup-ia-verificacao';
import type { MarkupIAVerificacaoCategoriaResultado } from '@/lib/markup-ia-verificacao';
import type {
  MarkupIAProjetistaComodo,
  MarkupIAProjetistaMaterial,
  MarkupIAProjetistaMovel,
  MarkupIAProjetistaResult,
  MarkupLinhaOrigemIA,
} from '@/lib/markup-types';
import { chaveCatalogo, normalizarTextoCatalogo } from '@/lib/markup-cortecloud';
import type { MarkupProduto } from '@/lib/markup-types';

export const PROJETISTA_ESP_MDF_PADRAO = '15';
export const PROJETISTA_FITA_PADRAO = '22';
export const PROJETISTA_COR_MDF_PADRAO = 'MDF BRANCO';

export type MarkupIAProjetistaMaterialTipo = 'chapa' | 'fita' | 'ferragem';

export interface MarkupIAProjetistaMaterialParsed extends MarkupIAProjetistaMaterial {
  tipo?: MarkupIAProjetistaMaterialTipo;
}

function normalizarNomeMaterial(nome: string): string {
  const n = normalizarTextoCatalogo(nome);
  if (n.includes('CORREDIÇA') || n.includes('CORREDICA')) {
    if (n.includes('OCULTA')) return 'CORREDIÇA OCULTA';
    if (n.includes('TELES')) return 'CORREDIÇA TELES';
    return 'CORREDIÇA OCULTA';
  }
  if (n.includes('DOBRADIÇA') || n.includes('DOBRADICA')) return 'DOBRADIÇA';
  if (n.includes('PISTAO') || n.includes('PISTÃO')) return 'PISTÃO';
  if (n.includes('FITA') || n.includes('BORDA')) {
    if (n.includes('MADEIRA') || n.includes('ITAPUA') || n.includes('ITAPUÃ')) return 'MADEIRA';
    return PROJETISTA_COR_MDF_PADRAO;
  }
  if (
    n.includes('ITAPUA') ||
    n.includes('ITAPUÃ') ||
    n.includes('MADEIRA') ||
    n.includes('CARVALHO') ||
    n.includes('NOGAL') ||
    n.includes('FREIJO')
  ) {
    return 'MADEIRA';
  }
  if (n.includes('NEUTRO')) return 'NEUTRO';
  if (n.includes('ULTRA')) return 'ULTRA';
  if (n.includes('BRANCO')) return 'MDF BRANCO';
  return n;
}

/** Mapeia cor textual do projeto para nome de chapa no catálogo. */
export function normalizarCorMdf(texto?: string | null): string {
  if (!texto?.trim()) return PROJETISTA_COR_MDF_PADRAO;
  const n = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (
    n.includes('ITAPUA') ||
    n.includes('MADEIRA') ||
    n.includes('CARVALHO') ||
    n.includes('NOGAL') ||
    n.includes('FREIJO') ||
    n.includes('DURATEX')
  ) {
    return 'MADEIRA';
  }
  if (n.includes('NEUTRO')) return 'NEUTRO';
  if (n.includes('ULTRA')) return 'ULTRA';
  if (n.includes('BRANCO')) return 'MDF BRANCO';
  return PROJETISTA_COR_MDF_PADRAO;
}

function inferirTipoMaterial(
  nome: string,
  variacao: string | null,
  tipoExplicito?: MarkupIAProjetistaMaterialTipo,
): MarkupIAProjetistaMaterialTipo {
  if (tipoExplicito) return tipoExplicito;
  const n = normalizarTextoCatalogo(nome);
  if (n.includes('CORREDIÇA') || n.includes('DOBRADIÇA') || n.includes('PISTAO')) {
    return 'ferragem';
  }
  const v = variacao ?? '';
  if (['22', '35', '64'].includes(v)) return 'fita';
  return 'chapa';
}

function parseConfianca(raw: unknown): 'alta' | 'media' | 'baixa' {
  const v = String(raw ?? 'media');
  return v === 'alta' || v === 'baixa' ? v : 'media';
}

function slugifyComodo(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'ambiente';
}

function temDimensoesValidas(d?: MarkupIAProjetistaMovel['dimensoes_cm']): boolean {
  if (!d) return false;
  return [d.largura, d.altura, d.profundidade].some((v) => v != null && v > 0);
}

/** Infere medidas padrão conforme tipo de móvel identificado no nome. */
export function inferirMedidasPadraoMovel(nome: string): {
  largura: number;
  altura: number;
  profundidade: number;
} {
  const n = normalizarTextoCatalogo(nome);
  if (n.includes('SUPERIOR') || n.includes('AEREO') || n.includes('AÉREO') || n.includes('SUSPENSO')) {
    return { largura: 60, altura: 72, profundidade: 35 };
  }
  if (n.includes('TORRE') || n.includes('PANELEIRO') || n.includes('COLUNA')) {
    return { largura: 60, altura: 210, profundidade: 60 };
  }
  if (n.includes('NICHO') || n.includes('PRATELEIRA')) {
    return { largura: 60, altura: 40, profundidade: 35 };
  }
  return { largura: 60, altura: 91, profundidade: 60 };
}

/** Preenche dimensões quando ausentes e marca medidas_padrao_aplicadas. */
export function aplicarMedidasPadraoMovel(movel: MarkupIAProjetistaMovel): MarkupIAProjetistaMovel {
  if (temDimensoesValidas(movel.dimensoes_cm)) {
    return { ...movel, medidas_padrao_aplicadas: movel.medidas_padrao_aplicadas ?? false };
  }
  const padrao = inferirMedidasPadraoMovel(movel.nome);
  return {
    ...movel,
    dimensoes_cm: padrao,
    medidas_padrao_aplicadas: true,
    confianca: movel.confianca ?? 'baixa',
    observacoes: [
      movel.observacoes,
      `Medidas padrão aplicadas (${padrao.largura}×${padrao.altura}×${padrao.profundidade} cm) — sem cota na prancha`,
    ]
      .filter(Boolean)
      .join('. '),
  };
}

/** Garante chapa MDF, fita 22 e ferragem mínima por móvel. */
export function garantirMateriaisMinimosMovel(movel: MarkupIAProjetistaMovel): MarkupIAProjetistaMovel {
  const corChapa = normalizarCorMdf(movel.cor_mdf);
  const materiais = [...(movel.materiais ?? [])];
  const tem = (tipo: MarkupIAProjetistaMaterialTipo) =>
    materiais.some((m) => inferirTipoMaterial(m.nome, m.variacao) === tipo);

  if (!tem('chapa')) {
    materiais.push({
      nome: corChapa,
      variacao: PROJETISTA_ESP_MDF_PADRAO,
      quantidade: 1,
      motivo: `Chapa estimada — ${movel.nome}`,
    });
  }
  if (!tem('fita')) {
    materiais.push({
      nome: corChapa,
      variacao: PROJETISTA_FITA_PADRAO,
      quantidade: 1,
      motivo: `Fita de borda 22mm — ${movel.nome}`,
    });
  }
  if (!tem('ferragem')) {
    materiais.push({
      nome: 'DOBRADIÇA',
      variacao: 'RETA',
      quantidade: 4,
      motivo: `Ferragem mínima (2 portas × 2) — ${movel.nome}`,
    });
  }

  return { ...movel, materiais };
}

/** Monta array comodos[] pontuado a partir dos móveis (ou do JSON da IA). */
export function derivarComodosPontuados(
  result: Pick<MarkupIAProjetistaResult, 'moveis' | 'comodos'>,
): MarkupIAProjetistaComodo[] {
  if (result.comodos?.length) {
    return result.comodos.map((c, i) => ({
      id: c.id || `comodo_${i + 1}`,
      nome: c.nome?.trim() || 'Ambiente',
      pontuacao: Math.min(100, Math.max(0, Number(c.pontuacao) || 50)),
      confianca: parseConfianca(c.confianca),
      moveis_identificados:
        c.moveis_identificados ??
        result.moveis.filter((m) => m.comodo.trim() === c.nome.trim()).length,
      observacoes: c.observacoes,
    }));
  }

  const mapa = new Map<string, MarkupIAProjetistaMovel[]>();
  for (const movel of result.moveis) {
    const nome = movel.comodo.trim() || 'Ambiente';
    const lista = mapa.get(nome) ?? [];
    lista.push(movel);
    mapa.set(nome, lista);
  }

  return Array.from(mapa.entries()).map(([nome, moveis], i) => {
    const comMedidas = moveis.filter((m) => temDimensoesValidas(m.dimensoes_cm) && !m.medidas_padrao_aplicadas).length;
    const ratio = moveis.length > 0 ? comMedidas / moveis.length : 0;
    const pontuacao = Math.round(40 + ratio * 60);
    const confianca: 'alta' | 'media' | 'baixa' =
      pontuacao >= 75 ? 'alta' : pontuacao >= 50 ? 'media' : 'baixa';
    return {
      id: `comodo_${slugifyComodo(nome)}_${i + 1}`,
      nome,
      pontuacao,
      confianca,
      moveis_identificados: moveis.length,
      observacoes:
        moveis.some((m) => m.medidas_padrao_aplicadas)
          ? 'Alguns móveis usaram medidas padrão por falta de cota'
          : undefined,
    };
  });
}

export interface ValidacaoLevantamentoResult {
  ok: boolean;
  lacunas: string[];
}

/** Valida se o levantamento cobre cômodos, móveis e materiais mínimos. */
export function validarLevantamentoCompleto(
  result: MarkupIAProjetistaResult,
  ambientesEsperados?: string[],
): ValidacaoLevantamentoResult {
  const lacunas: string[] = [];

  if (result.moveis.length === 0) {
    lacunas.push('Nenhum móvel identificado');
  }

  for (const movel of result.moveis) {
    if (!movel.materiais?.length) {
      lacunas.push(`Móvel "${movel.nome}" sem materiais`);
    }
    if (!movel.nome?.trim()) {
      lacunas.push('Móvel sem nome identificado');
    }
  }

  const comodosNomes = new Set(result.comodos.map((c) => c.nome.trim().toLowerCase()));
  for (const esperado of ambientesEsperados ?? []) {
    const norm = esperado.trim().toLowerCase();
    if (norm && !comodosNomes.has(norm) && !result.moveis.some((m) => m.comodo.trim().toLowerCase() === norm)) {
      lacunas.push(`Cômodo esperado ausente: ${esperado}`);
    }
  }

  if (result.comodos.length === 0 && result.moveis.length > 0) {
    lacunas.push('Array comodos vazio — pontuação por ambiente ausente');
  }

  return { ok: lacunas.length === 0, lacunas };
}

/** Enriquece levantamento com medidas padrão, materiais mínimos e comodos pontuados. */
export function enriquecerLevantamentoCompleto(
  result: MarkupIAProjetistaResult,
  ambientesEsperados?: string[],
): MarkupIAProjetistaResult {
  let moveis = result.moveis.map((m) => garantirMateriaisMinimosMovel(aplicarMedidasPadraoMovel(m)));
  const comodosEsperados = ambientesEsperados ?? [];

  for (const ambiente of comodosEsperados) {
    const norm = ambiente.trim().toLowerCase();
    if (!norm) continue;
    const temMovel = moveis.some((m) => m.comodo.trim().toLowerCase() === norm);
    if (!temMovel) {
      const padrao = aplicarMedidasPadraoMovel({
        id: `movel_auto_${slugifyComodo(ambiente)}`,
        nome: `Módulo estimado — ${ambiente}`,
        comodo: ambiente,
        cor_mdf: PROJETISTA_COR_MDF_PADRAO,
        materiais: [],
        observacoes: 'Móvel inferido — ambiente visível sem detalhamento na prancha',
      });
      moveis.push(garantirMateriaisMinimosMovel(padrao));
    }
  }

  moveis = enriquecerFerragens(moveis);
  const comodos = derivarComodosPontuados({ moveis, comodos: result.comodos });
  const totais = result.totais_consolidados.length > 0
    ? result.totais_consolidados
    : consolidarTotais(moveis);

  const defaults = [...result.defaults_aplicados];
  if (moveis.some((m) => m.medidas_padrao_aplicadas)) {
    defaults.push('Medidas padrão aplicadas em móveis sem cota na prancha');
  }

  return {
    ...result,
    moveis,
    comodos,
    totais_consolidados: totais,
    defaults_aplicados: [...new Set(defaults)],
  };
}

/** Extrai nomes de ambientes mencionados na análise/conhecimento. */
export function extrairAmbientesEsperados(analise: string, conhecimento: string): string[] {
  const texto = `${analise}\n${conhecimento}`;
  const encontrados = new Set<string>();
  const padroes = [
    /\b(cozinha|suite|suíte|quarto|banheiro|lavanderia|sala|closet|escritório|escritorio|varanda|área gourmet|area gourmet|despensa|hall|corredor)\b/gi,
  ];
  for (const re of padroes) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) {
      const nome = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
      encontrados.add(nome.replace('Suite', 'Suíte').replace('Escritorio', 'Escritório'));
    }
  }
  return Array.from(encontrados);
}

export interface AuditoriaProjetistaDetalhe {
  ok: boolean;
  faltantes: string[];
  itens_verificados: number;
  resumo_secao: string;
}

/** Verifica deterministicamente se itens do projetista estão no inventário e na composição. */
export function auditarItensProjetista(
  levantamento: MarkupIAProjetistaResult,
  inventario: MarkupIAVerificacaoCategoriaResultado[],
  composicaoLinhas: Array<{ produto_id: string; quantidade: number }>,
  catalog: Array<{ id: string; nome: string; variacao: string | null }>,
): AuditoriaProjetistaDetalhe {
  const lookup = new Map<string, string>();
  for (const p of catalog) {
    lookup.set(chaveCatalogo(p.nome, p.variacao), p.id);
    lookup.set(normalizarTextoCatalogo(p.nome), p.id);
  }

  const qtdComp = new Map<string, number>();
  for (const l of composicaoLinhas) {
    qtdComp.set(l.produto_id, (qtdComp.get(l.produto_id) ?? 0) + l.quantidade);
  }

  const invEncontrados = new Set<string>();
  for (const cat of inventario) {
    for (const item of cat.itens) {
      if (item.status === 'encontrado' && (item.quantidade ?? 0) > 0) {
        const pid =
          lookup.get(chaveCatalogo(item.nome, item.variacao)) ??
          lookup.get(normalizarTextoCatalogo(item.nome));
        if (pid) invEncontrados.add(pid);
      }
    }
  }

  const faltantes: string[] = [];
  let verificados = 0;

  for (const mat of levantamento.totais_consolidados) {
    const pid =
      lookup.get(chaveCatalogo(mat.nome, mat.variacao)) ??
      lookup.get(normalizarTextoCatalogo(mat.nome));
    if (!pid) {
      faltantes.push(`${mat.nome}${mat.variacao ? ` (${mat.variacao})` : ''} — não mapeado ao catálogo`);
      continue;
    }
    verificados += 1;
    const qtd = qtdComp.get(pid) ?? 0;
    if (qtd <= 0) {
      faltantes.push(`${mat.nome} — ausente na composição/tabela de custo`);
    } else if (!invEncontrados.has(pid)) {
      faltantes.push(`${mat.nome} — não consta no inventário validado`);
    }
  }

  const linhasComodo = levantamento.comodos
    .map((c) => `| ${c.nome} | ${c.pontuacao}/100 | ${c.confianca} | ${c.moveis_identificados} móvel(is) |`)
    .join('\n');

  const resumo_secao = [
    '### Auditoria do projetista',
    '',
    '| Cômodo | Pontuação | Confiança | Móveis |',
    '|--------|-----------|-----------|--------|',
    linhasComodo || '| — | — | — | — |',
    '',
    faltantes.length > 0
      ? `**Itens do projetista pendentes:** ${faltantes.join('; ')}`
      : '**Todos os itens do projetista constam na composição.**',
  ].join('\n');

  return {
    ok: faltantes.length === 0,
    faltantes,
    itens_verificados: verificados,
    resumo_secao,
  };
}

function parseComodoPontuado(raw: Record<string, unknown>, index: number): MarkupIAProjetistaComodo | null {
  const nome = String(raw.nome ?? '').trim();
  if (!nome) return null;
  return {
    id: String(raw.id ?? `comodo_${index + 1}`),
    nome,
    pontuacao: Math.min(100, Math.max(0, Number(raw.pontuacao) || 50)),
    confianca: parseConfianca(raw.confianca),
    moveis_identificados: Number(raw.moveis_identificados) || 0,
    observacoes: raw.observacoes ? String(raw.observacoes) : undefined,
  };
}

function categoriaIdParaTipo(tipo: MarkupIAProjetistaMaterialTipo): string {
  switch (tipo) {
    case 'fita':
      return 'fita_borda';
    case 'ferragem':
      return 'ferragens_corr_dobr';
    default:
      return 'chapas_mdf';
  }
}

function normalizarMaterial(
  raw: Record<string, unknown>,
): MarkupIAProjetistaMaterialParsed | null {
  const nomeRaw = String(raw.nome ?? '').trim();
  if (!nomeRaw) return null;
  const nome = normalizarNomeMaterial(nomeRaw);
  let variacao = raw.variacao != null ? String(raw.variacao).trim() : null;
  const tipo = inferirTipoMaterial(
    nome,
    variacao,
    raw.tipo as MarkupIAProjetistaMaterialTipo | undefined,
  );
  if (!variacao) {
    variacao = tipo === 'chapa' ? PROJETISTA_ESP_MDF_PADRAO : tipo === 'fita' ? PROJETISTA_FITA_PADRAO : null;
  }
  const quantidade = Number(raw.quantidade ?? 0);
  if (!Number.isFinite(quantidade) || quantidade <= 0) return null;
  return {
    nome,
    variacao,
    quantidade: Math.round(quantidade * 100) / 100,
    motivo: String(raw.motivo ?? 'Estimativa do projetista').trim(),
    tipo,
  };
}

function contarPortasGavetasNoTexto(texto: string): { portas: number; gavetas: number } {
  const t = texto.toLowerCase();
  const portasMatch = t.match(/(\d+)\s*porta/);
  const gavetasMatch = t.match(/(\d+)\s*gaveta/);
  return {
    portas: portasMatch ? Number(portasMatch[1]) : 0,
    gavetas: gavetasMatch ? Number(gavetasMatch[1]) : 0,
  };
}

/** Garante mínimos de ferragens com base em portas/gavetas descritas. */
export function enriquecerFerragens(moveis: MarkupIAProjetistaMovel[]): MarkupIAProjetistaMovel[] {
  return moveis.map((movel) => {
    const materiais = [...(movel.materiais ?? [])];
    const texto = `${movel.nome} ${movel.observacoes ?? ''}`.toLowerCase();
    const { portas, gavetas } = contarPortasGavetasNoTexto(texto);

    const portasEstimadas =
      portas ||
      (texto.includes('porta') && !texto.includes('gaveta') ? 2 : texto.includes('porta') ? 2 : 0);
    const gavetasEstimadas = gavetas || (texto.includes('gaveta') ? 4 : 0);

    const somaDobr = (tipo: string) =>
      materiais
        .filter((m) => m.nome === 'DOBRADIÇA' && (m.variacao ?? '').toUpperCase() === tipo)
        .reduce((a, m) => a + m.quantidade, 0);

    const somaCorr = materiais
      .filter((m) => m.nome.includes('CORREDIÇA'))
      .reduce((a, m) => a + m.quantidade, 0);

    const prof = movel.dimensoes_cm?.profundidade ?? 45;
    const tamCorr = prof >= 50 ? '45' : prof >= 40 ? '40' : '35';

    if (portasEstimadas > 0 && somaDobr('RETA') < portasEstimadas * 2) {
      const falta = portasEstimadas * 2 - somaDobr('RETA');
      materiais.push({
        nome: 'DOBRADIÇA',
        variacao: 'RETA',
        quantidade: falta,
        motivo: `${portasEstimadas} porta(s) × 2 dobradiças reta`,
      });
    }

    if (gavetasEstimadas > 0 && somaCorr < gavetasEstimadas) {
      materiais.push({
        nome: 'CORREDIÇA OCULTA',
        variacao: tamCorr,
        quantidade: gavetasEstimadas - somaCorr,
        motivo: `${gavetasEstimadas} gaveta(s) × 1 par de corrediça`,
      });
    }

    return { ...movel, materiais };
  });
}

export function consolidarTotais(
  moveis: MarkupIAProjetistaMovel[],
): MarkupIAProjetistaMaterial[] {
  const mapa = new Map<string, MarkupIAProjetistaMaterial>();
  for (const movel of moveis) {
    for (const mat of movel.materiais ?? []) {
      const chave = `${mat.nome}|${mat.variacao ?? ''}`;
      const existente = mapa.get(chave);
      if (existente) {
        existente.quantidade += mat.quantidade;
        existente.motivo = `${existente.motivo}; ${movel.nome}: ${mat.motivo}`;
      } else {
        mapa.set(chave, { ...mat, motivo: `${movel.nome}: ${mat.motivo}` });
      }
    }
  }
  return Array.from(mapa.values());
}

export function parseProjetistaJson(raw: string): MarkupIAProjetistaResult | null {
  try {
    let text = raw.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) text = fence[1].trim();
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return normalizarProjetistaResult(parsed);
  } catch {
    return null;
  }
}

export function normalizarProjetistaResult(
  parsed: Record<string, unknown>,
): MarkupIAProjetistaResult | null {
  const moveisRaw = Array.isArray(parsed.moveis) ? parsed.moveis : [];
  const moveis: MarkupIAProjetistaMovel[] = moveisRaw
    .map((m, index) => {
      const movel = m as Record<string, unknown>;
      const matsRaw = Array.isArray(movel.materiais) ? movel.materiais : [];
      const materiais = matsRaw
        .map((item) => normalizarMaterial(item as Record<string, unknown>))
        .filter((x): x is MarkupIAProjetistaMaterialParsed => x !== null)
        .map(({ tipo: _t, ...rest }) => rest);

      const dim = movel.dimensoes_cm as Record<string, unknown> | undefined;
      return {
        id: String(movel.id ?? `movel_${index + 1}`),
        nome: String(movel.nome ?? `Móvel ${index + 1}`).trim() || `Móvel ${index + 1}`,
        comodo: String(movel.comodo ?? 'Ambiente').trim() || 'Ambiente',
        dimensoes_cm: dim
          ? {
              largura: dim.largura != null ? Number(dim.largura) : undefined,
              altura: dim.altura != null ? Number(dim.altura) : undefined,
              profundidade: dim.profundidade != null ? Number(dim.profundidade) : undefined,
            }
          : undefined,
        cor_mdf: movel.cor_mdf ? String(movel.cor_mdf) : undefined,
        cor_fita: movel.cor_fita ? String(movel.cor_fita) : undefined,
        materiais,
        observacoes: movel.observacoes ? String(movel.observacoes) : undefined,
        medidas_padrao_aplicadas: movel.medidas_padrao_aplicadas === true,
        confianca: movel.confianca ? parseConfianca(movel.confianca) : undefined,
      };
    })
    .filter((m) => m.nome);

  if (moveis.length === 0) return null;

  const enriquecidos = enriquecerFerragens(moveis);
  const totaisRaw = Array.isArray(parsed.totais_consolidados) ? parsed.totais_consolidados : [];
  const totaisParsed = totaisRaw
    .map((item) => normalizarMaterial(item as Record<string, unknown>))
    .filter((x): x is MarkupIAProjetistaMaterialParsed => x !== null)
    .map(({ tipo: _t, ...rest }) => rest);

  const totais = totaisParsed.length > 0 ? totaisParsed : consolidarTotais(enriquecidos);

  const confiancaRaw = String(parsed.confianca ?? 'media');
  const confianca = parseConfianca(confiancaRaw);

  const comodosRaw = Array.isArray(parsed.comodos) ? parsed.comodos : [];
  const comodosParsed = comodosRaw
    .map((c, i) => parseComodoPontuado(c as Record<string, unknown>, i))
    .filter((c): c is MarkupIAProjetistaComodo => c !== null);

  const base: MarkupIAProjetistaResult = {
    resumo_projeto: String(parsed.resumo_projeto ?? 'Levantamento de materiais por prancha de projeto.'),
    cores_identificadas:
      parsed.cores_identificadas && typeof parsed.cores_identificadas === 'object'
        ? (parsed.cores_identificadas as Record<string, string>)
        : {},
    defaults_aplicados: Array.isArray(parsed.defaults_aplicados)
      ? parsed.defaults_aplicados.map((d) => String(d))
      : [],
    confianca,
    comodos: comodosParsed,
    moveis: enriquecidos,
    totais_consolidados: totais,
  };

  return enriquecerLevantamentoCompleto(base);
}

export function projetistaFallbackMinimo(imageCount: number): MarkupIAProjetistaResult {
  const qtdMoveis = Math.max(1, imageCount);
  const moveis: MarkupIAProjetistaMovel[] = Array.from({ length: qtdMoveis }, (_, i) => {
    const comodo = `Ambiente ${i + 1}`;
    const base = aplicarMedidasPadraoMovel({
      id: `movel_fallback_${i + 1}`,
      nome: `Módulo estimado ${i + 1} (prancha ${i + 1})`,
      comodo,
      cor_mdf: PROJETISTA_COR_MDF_PADRAO,
      materiais: [],
      observacoes: 'Estimativa mínima — revise cotas e materiais na prancha.',
      medidas_padrao_aplicadas: true,
      confianca: 'baixa',
    });
    return garantirMateriaisMinimosMovel(base);
  });

  const base: MarkupIAProjetistaResult = {
    resumo_projeto:
      'Não foi possível ler todos os detalhes das pranchas. Aplicamos valores padrão (MDF Branco 15mm, fita 22mm) para montar um orçamento inicial.',
    cores_identificadas: { mdf: PROJETISTA_COR_MDF_PADRAO },
    defaults_aplicados: [
      `MDF ${PROJETISTA_COR_MDF_PADRAO} ${PROJETISTA_ESP_MDF_PADRAO}mm`,
      `Fita ${PROJETISTA_FITA_PADRAO}mm`,
      '2 dobradiças reta por porta estimada',
      `${qtdMoveis} ambiente(s) com móvel estimado por imagem`,
    ],
    confianca: 'baixa',
    comodos: [],
    moveis,
    totais_consolidados: consolidarTotais(moveis),
  };

  return enriquecerLevantamentoCompleto(base);
}

function acharItemChecklist(
  checklist: MarkupIAVerificacaoCategoria[],
  nome: string,
  variacao: string | null,
  tipo: MarkupIAProjetistaMaterialTipo,
): { categoria_id: string; item_id: string } | null {
  const catId = categoriaIdParaTipo(tipo);
  const cat = checklist.find((c) => c.id === catId);
  if (!cat) return null;

  const nomeNorm = normalizarTextoCatalogo(nome);
  for (const item of cat.itens) {
    const itemNorm = normalizarTextoCatalogo(item.nome);
    if (itemNorm === nomeNorm || nomeNorm.includes(itemNorm) || itemNorm.includes(nomeNorm)) {
      return { categoria_id: cat.id, item_id: item.id };
    }
  }
  return { categoria_id: cat.id, item_id: `${cat.id}_${slugify(nome)}` };
}

function slugify(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 32);
}

/** Converte levantamento do projetista em inventário por categoria (status encontrado). */
export function projetistaToInventario(
  result: MarkupIAProjetistaResult,
  checklist: MarkupIAVerificacaoCategoria[],
): MarkupIAVerificacaoCategoriaResultado[] {
  const porCategoria = new Map<string, MarkupIAVerificacaoCategoriaResultado>();

  for (const cat of checklist.filter((c) => c.ativo)) {
    porCategoria.set(cat.id, { categoria_id: cat.id, nome: cat.nome, itens: [] });
  }

  for (const total of result.totais_consolidados) {
    const tipo = inferirTipoMaterial(total.nome, total.variacao);
    const ref = acharItemChecklist(checklist, total.nome, total.variacao, tipo);
    const catId = ref?.categoria_id ?? categoriaIdParaTipo(tipo);
    let cat = porCategoria.get(catId);
    if (!cat) {
      const catDef = checklist.find((c) => c.id === catId);
      cat = { categoria_id: catId, nome: catDef?.nome ?? catId, itens: [] };
      porCategoria.set(catId, cat);
    }

    const existente = cat.itens.find(
      (i) =>
        normalizarTextoCatalogo(i.nome) === normalizarTextoCatalogo(total.nome) &&
        (i.variacao ?? '') === (total.variacao ?? ''),
    );
    if (existente) {
      existente.quantidade = (existente.quantidade ?? 0) + total.quantidade;
      existente.motivo = total.motivo;
    } else {
      cat.itens.push({
        item_id: ref?.item_id ?? slugify(total.nome),
        nome: total.nome,
        variacao: total.variacao,
        status: 'encontrado',
        quantidade: total.quantidade,
        motivo: total.motivo,
      });
    }
  }

  return Array.from(porCategoria.values()).filter((c) => c.itens.length > 0);
}

export interface ProjetistaComodoHint {
  nome: string;
  moveis: Array<{ nome: string; descricao?: string }>;
}

/** Mapa cômodo → móveis para orientar o precificador. */
export function projetistaToComodosHint(result: MarkupIAProjetistaResult): ProjetistaComodoHint[] {
  const mapa = new Map<string, ProjetistaComodoHint>();
  for (const movel of result.moveis) {
    const comodo = movel.comodo.trim() || 'Ambiente';
    let entry = mapa.get(comodo);
    if (!entry) {
      entry = { nome: comodo, moveis: [] };
      mapa.set(comodo, entry);
    }
    const dims = movel.dimensoes_cm;
    const dimStr =
      dims?.largura || dims?.altura || dims?.profundidade
        ? ` (${[dims.largura, dims.altura, dims.profundidade].filter(Boolean).join('×')} cm)`
        : '';
    const corStr = movel.cor_mdf ? ` — ${movel.cor_mdf}` : '';
    entry.moveis.push({
      nome: movel.nome,
      descricao: `${movel.nome}${dimStr}${corStr}${movel.observacoes ? `. ${movel.observacoes}` : ''}`,
    });
  }
  return Array.from(mapa.values());
}

export interface LinhaProjetistaComposicao {
  produto_id: string;
  quantidade: number;
  origem_ia?: MarkupLinhaOrigemIA;
}

/** Monta cômodos/móveis com linhas de catálogo a partir do levantamento. */
export function construirComodosDeProjetista(
  result: MarkupIAProjetistaResult,
  produtos: Array<Pick<MarkupProduto, 'id' | 'nome' | 'variacao'>>,
  origem: MarkupLinhaOrigemIA = 'projetista',
): Array<{
  nome: string;
  moveis: Array<{ nome: string; descricao?: string; linhas: LinhaProjetistaComposicao[] }>;
}> {
  const lookup = new Map<string, string>();
  for (const p of produtos) {
    lookup.set(chaveCatalogo(p.nome, p.variacao), p.id);
    lookup.set(normalizarTextoCatalogo(p.nome), p.id);
  }

  const comodosMap = new Map<
    string,
    { nome: string; moveis: Array<{ nome: string; descricao?: string; linhas: LinhaProjetistaComposicao[] }> }
  >();

  for (const movel of result.moveis) {
    const comodoNome = movel.comodo.trim() || 'Ambiente';
    if (!comodosMap.has(comodoNome)) {
      comodosMap.set(comodoNome, { nome: comodoNome, moveis: [] });
    }
    const linhas: LinhaProjetistaComposicao[] = [];
    const seen = new Set<string>();

    for (const mat of movel.materiais ?? []) {
      const produtoId =
        lookup.get(chaveCatalogo(mat.nome, mat.variacao)) ??
        lookup.get(normalizarTextoCatalogo(mat.nome));
      if (!produtoId) continue;
      const key = produtoId;
      const existente = linhas.find((l) => l.produto_id === key);
      if (existente) {
        existente.quantidade += mat.quantidade;
      } else if (!seen.has(key)) {
        seen.add(key);
        linhas.push({ produto_id: produtoId, quantidade: mat.quantidade, origem_ia: origem });
      }
    }

    const dims = movel.dimensoes_cm;
    const dimStr =
      dims?.largura || dims?.altura || dims?.profundidade
        ? `${[dims.largura, dims.altura, dims.profundidade].filter(Boolean).join('×')} cm`
        : undefined;

    comodosMap.get(comodoNome)!.moveis.push({
      nome: movel.nome,
      descricao: [dimStr, movel.cor_mdf, movel.observacoes].filter(Boolean).join(' · ') || undefined,
      linhas,
    });
  }

  return Array.from(comodosMap.values()).filter((c) => c.moveis.some((m) => m.linhas.length > 0));
}

export type LacunaCriticaId = 'chapas_mdf' | 'ferragens_corr_dobr' | 'fita_borda';

function categoriaTemAlgumEncontrado(
  cat: MarkupIAVerificacaoCategoriaResultado | undefined,
): boolean {
  if (!cat) return false;
  return cat.itens.some((i) => i.status === 'encontrado' && (i.quantidade ?? 0) > 0);
}

function categoriaTemItemEncontrado(
  cat: MarkupIAVerificacaoCategoriaResultado | undefined,
  nomes: string[],
): boolean {
  if (!cat) return false;
  const alvos = nomes.map((n) => normalizarTextoCatalogo(n));
  return cat.itens.some(
    (i) =>
      i.status === 'encontrado' &&
      (i.quantidade ?? 0) > 0 &&
      alvos.some((a) => normalizarTextoCatalogo(i.nome).includes(a)),
  );
}

/** Detecta categorias críticas zeradas na verificação pós-composição. */
export function detectarLacunasCriticas(
  verificacao: MarkupIAVerificacaoCategoriaResultado[],
): LacunaCriticaId[] {
  const lacunas: LacunaCriticaId[] = [];
  const verMap = new Map(verificacao.map((c) => [c.categoria_id, c]));

  if (!categoriaTemAlgumEncontrado(verMap.get('chapas_mdf'))) {
    lacunas.push('chapas_mdf');
  }

  const ferragens = verMap.get('ferragens_corr_dobr');
  const temDobradica = categoriaTemItemEncontrado(ferragens, ['DOBRADIÇA', 'DOBRADICA']);
  const temCorredica = categoriaTemItemEncontrado(ferragens, ['CORREDIÇA', 'CORREDICA']);
  if (!temDobradica && !temCorredica) {
    lacunas.push('ferragens_corr_dobr');
  }

  if (!categoriaTemAlgumEncontrado(verMap.get('fita_borda'))) {
    lacunas.push('fita_borda');
  }

  return lacunas;
}

function materialPertenceLacuna(
  mat: MarkupIAProjetistaMaterial,
  lacuna: LacunaCriticaId,
): boolean {
  const tipo = inferirTipoMaterial(mat.nome, mat.variacao);
  if (lacuna === 'chapas_mdf') return tipo === 'chapa';
  if (lacuna === 'fita_borda') return tipo === 'fita';
  return tipo === 'ferragem';
}

function inventarioTemItem(
  inventario: MarkupIAVerificacaoCategoriaResultado[],
  nome: string,
  variacao: string | null,
): boolean {
  const nomeNorm = normalizarTextoCatalogo(nome);
  for (const cat of inventario) {
    for (const item of cat.itens) {
      if (
        item.status === 'encontrado' &&
        (item.quantidade ?? 0) > 0 &&
        normalizarTextoCatalogo(item.nome) === nomeNorm &&
        (item.variacao ?? '') === (variacao ?? '')
      ) {
        return true;
      }
    }
  }
  return false;
}

function clonarInventario(
  inventario: MarkupIAVerificacaoCategoriaResultado[],
): MarkupIAVerificacaoCategoriaResultado[] {
  return inventario.map((cat) => ({
    ...cat,
    itens: cat.itens.map((i) => ({ ...i })),
  }));
}

export interface ComplementoInventarioResult {
  inventario: MarkupIAVerificacaoCategoriaResultado[];
  complemento: MarkupIAVerificacaoCategoriaResultado[];
}

/**
 * Mescla inventário base com itens do projetista SOMENTE nas categorias com lacuna.
 * Em modo Cortecloud, não altera itens já encontrados no documento.
 */
export function complementarInventarioComProjetista(
  base: MarkupIAVerificacaoCategoriaResultado[],
  levantamento: MarkupIAProjetistaResult,
  lacunas: LacunaCriticaId[],
  checklist: MarkupIAVerificacaoCategoria[],
  modoCortecloud: boolean,
): ComplementoInventarioResult {
  const inventario = clonarInventario(base);
  const complementoCats: MarkupIAVerificacaoCategoriaResultado[] = [];
  const lacunaSet = new Set(lacunas);

  const materiaisComplemento = levantamento.totais_consolidados.filter((mat) =>
    lacunas.some((lac) => materialPertenceLacuna(mat, lac)),
  );

  for (const mat of materiaisComplemento) {
    if (modoCortecloud && inventarioTemItem(inventario, mat.nome, mat.variacao)) {
      continue;
    }

    const tipo = inferirTipoMaterial(mat.nome, mat.variacao);
    const ref = acharItemChecklist(checklist, mat.nome, mat.variacao, tipo);
    const catId = ref?.categoria_id ?? categoriaIdParaTipo(tipo);
    if (!lacunaSet.has(catId as LacunaCriticaId)) continue;

    const motivo = `Complemento projetista: orçamento não previa ${mat.nome}${mat.variacao ? ` (${mat.variacao})` : ''}`;
    const novoItem = {
      item_id: ref?.item_id ?? slugify(mat.nome),
      nome: mat.nome,
      variacao: mat.variacao,
      status: 'encontrado' as const,
      quantidade: mat.quantidade,
      motivo,
    };

    let catInv = inventario.find((c) => c.categoria_id === catId);
    if (!catInv) {
      const catDef = checklist.find((c) => c.id === catId);
      catInv = { categoria_id: catId, nome: catDef?.nome ?? catId, itens: [] };
      inventario.push(catInv);
    }

    const existente = catInv.itens.find(
      (i) =>
        normalizarTextoCatalogo(i.nome) === normalizarTextoCatalogo(mat.nome) &&
        (i.variacao ?? '') === (mat.variacao ?? ''),
    );
    if (existente && modoCortecloud) continue;

    if (existente && !modoCortecloud) {
      existente.quantidade = (existente.quantidade ?? 0) + mat.quantidade;
      existente.motivo = motivo;
    } else if (!existente) {
      catInv.itens.push(novoItem);
    }

    let catComp = complementoCats.find((c) => c.categoria_id === catId);
    if (!catComp) {
      const catDef = checklist.find((c) => c.id === catId);
      catComp = { categoria_id: catId, nome: catDef?.nome ?? catId, itens: [] };
      complementoCats.push(catComp);
    }
    catComp.itens.push({ ...novoItem });
  }

  return { inventario, complemento: complementoCats };
}

export interface ComodoComposicaoParsed {
  nome: string;
  moveis: Array<{
    nome: string;
    descricao?: string;
    linhas: LinhaProjetistaComposicao[];
  }>;
}

/** Injeta linhas do complemento na composição sem duplicar produto_id existente. */
export function injetarLacunasNaComposicao(
  parsed: { comodos: ComodoComposicaoParsed[] },
  complemento: MarkupIAVerificacaoCategoriaResultado[],
  catalog: Array<{ id: string; nome: string; variacao: string | null }>,
  modoCortecloud: boolean,
  levantamento: MarkupIAProjetistaResult | null,
): { comodos: ComodoComposicaoParsed[] } {
  const linhasNovas = mapearInventarioParaLinhasComplemento(complemento, catalog);
  if (linhasNovas.length === 0) return parsed;

  const comodos = parsed.comodos.map((c) => ({
    ...c,
    moveis: (c.moveis ?? []).map((m) => ({
      ...m,
      linhas: [...(m.linhas ?? [])],
    })),
  }));

  const idsExistentes = new Set<string>();
  for (const comodo of comodos) {
    for (const movel of comodo.moveis ?? []) {
      for (const linha of movel.linhas ?? []) {
        idsExistentes.add(linha.produto_id);
      }
    }
  }

  const linhasParaInjetar = linhasNovas.filter((l) => !idsExistentes.has(l.produto_id));
  if (linhasParaInjetar.length === 0) return parsed;

  if (!modoCortecloud && levantamento && levantamento.moveis.length > 0) {
    const comodosProjetista = construirComodosDeProjetista(
      levantamento,
      catalog,
      'projetista_complemento',
    );
    if (comodosProjetista.length > 0) {
      return { comodos: mesclarComodos(comodos, comodosProjetista, linhasParaInjetar) };
    }
  }

  const nomeComodo = modoCortecloud ? 'Orçamento Cortecloud' : 'Projeto';
  const nomeMovel = modoCortecloud ? 'Materiais do documento' : 'Materiais complementados';

  let comodo = comodos.find((c) => c.nome === nomeComodo);
  if (!comodo) {
    comodo = { nome: nomeComodo, moveis: [] };
    comodos.push(comodo);
  }

  let movel = comodo.moveis.find((m) => m.nome === nomeMovel);
  if (!movel) {
    movel = { nome: nomeMovel, linhas: [] };
    comodo.moveis.push(movel);
  }

  for (const linha of linhasParaInjetar) {
    const existente = movel!.linhas.find((l) => l.produto_id === linha.produto_id);
    if (existente) {
      existente.quantidade += linha.quantidade;
      existente.origem_ia = 'projetista_complemento';
    } else {
      movel!.linhas.push({ ...linha, origem_ia: 'projetista_complemento' });
    }
  }

  return { comodos };
}

function mapearInventarioParaLinhasComplemento(
  inventario: MarkupIAVerificacaoCategoriaResultado[],
  catalog: Array<{ id: string; nome: string; variacao: string | null }>,
): LinhaProjetistaComposicao[] {
  const lookup = new Map<string, string>();
  for (const p of catalog) {
    lookup.set(chaveCatalogo(p.nome, p.variacao), p.id);
    lookup.set(normalizarTextoCatalogo(p.nome), p.id);
  }

  const linhas: LinhaProjetistaComposicao[] = [];
  const seen = new Set<string>();

  for (const cat of inventario) {
    for (const item of cat.itens) {
      if (item.status !== 'encontrado' || (item.quantidade ?? 0) <= 0) continue;
      const produtoId =
        lookup.get(chaveCatalogo(item.nome, item.variacao)) ??
        lookup.get(normalizarTextoCatalogo(item.nome));
      if (!produtoId || seen.has(produtoId)) continue;
      seen.add(produtoId);
      linhas.push({
        produto_id: produtoId,
        quantidade: item.quantidade!,
        origem_ia: 'projetista_complemento',
      });
    }
  }
  return linhas;
}

function mesclarComodos(
  base: ComodoComposicaoParsed[],
  projetista: ComodoComposicaoParsed[],
  linhasExtras: LinhaProjetistaComposicao[],
): ComodoComposicaoParsed[] {
  const mapa = new Map(base.map((c) => [c.nome, { ...c, moveis: [...c.moveis] }]));

  for (const comodoP of projetista) {
    const existente = mapa.get(comodoP.nome);
    if (!existente) {
      mapa.set(comodoP.nome, comodoP);
      continue;
    }
    for (const movelP of comodoP.moveis) {
      const movelE = existente.moveis.find((m) => m.nome === movelP.nome);
      if (!movelE) {
        existente.moveis.push(movelP);
      } else {
        for (const linha of movelP.linhas) {
          const linhaE = movelE.linhas.find((l) => l.produto_id === linha.produto_id);
          if (linhaE) linhaE.quantidade += linha.quantidade;
          else movelE.linhas.push(linha);
        }
      }
    }
  }

  if (linhasExtras.length > 0) {
    const primeiro = Array.from(mapa.values())[0];
    if (primeiro) {
      const movel = primeiro.moveis[0] ?? { nome: 'Materiais complementados', linhas: [] };
      if (!primeiro.moveis.length) primeiro.moveis.push(movel);
      for (const linha of linhasExtras) {
        const linhaE = movel.linhas.find((l) => l.produto_id === linha.produto_id);
        if (linhaE) linhaE.quantidade += linha.quantidade;
        else movel.linhas.push(linha);
      }
    }
  }

  return Array.from(mapa.values());
}

export function contarLinhasComposicao(
  comodos: Array<{ moveis?: Array<{ linhas?: Array<unknown> }> }>,
): number {
  return comodos.reduce(
    (acc, c) => acc + (c.moveis ?? []).reduce((a, m) => a + (m.linhas ?? []).length, 0),
    0,
  );
}

/** Mapeia totais do levantamento para linhas de catálogo com origem projetista. */
export function mapearLevantamentoParaLinhas(
  levantamento: MarkupIAProjetistaResult,
  catalog: Array<{ id: string; nome: string; variacao: string | null }>,
  origem: MarkupLinhaOrigemIA = 'projetista',
): LinhaProjetistaComposicao[] {
  const lookup = new Map<string, string>();
  for (const p of catalog) {
    lookup.set(chaveCatalogo(p.nome, p.variacao), p.id);
    lookup.set(normalizarTextoCatalogo(p.nome), p.id);
  }

  const qtdPorProduto = new Map<string, number>();

  const fontes = [
    ...levantamento.totais_consolidados,
    ...levantamento.moveis.flatMap((m) => m.materiais ?? []),
  ];

  for (const mat of fontes) {
    const produtoId =
      lookup.get(chaveCatalogo(mat.nome, mat.variacao)) ??
      lookup.get(normalizarTextoCatalogo(mat.nome));
    if (!produtoId || (mat.quantidade ?? 0) <= 0) continue;
    qtdPorProduto.set(produtoId, (qtdPorProduto.get(produtoId) ?? 0) + mat.quantidade);
  }

  return Array.from(qtdPorProduto.entries()).map(([produto_id, quantidade]) => ({
    produto_id,
    quantidade,
    origem_ia: origem,
  }));
}

/**
 * Garante que todos os materiais do levantamento do projetista estejam na composição,
 * com origem_ia marcada — sem reduzir quantidades já existentes.
 */
export function garantirLevantamentoNaComposicao(
  parsed: { comodos: ComodoComposicaoParsed[] },
  levantamento: MarkupIAProjetistaResult,
  catalog: Array<{ id: string; nome: string; variacao: string | null }>,
  modoCortecloud: boolean,
  origem: MarkupLinhaOrigemIA = 'projetista',
): { comodos: ComodoComposicaoParsed[]; produtoIds: string[] } {
  const linhasLevantamento = mapearLevantamentoParaLinhas(levantamento, catalog, origem);
  if (linhasLevantamento.length === 0) {
    return { comodos: parsed.comodos, produtoIds: [] };
  }

  const produtoIds = linhasLevantamento.map((l) => l.produto_id);
  const comodos = parsed.comodos.map((c) => ({
    ...c,
    moveis: (c.moveis ?? []).map((m) => ({
      ...m,
      linhas: [...(m.linhas ?? [])],
    })),
  }));

  const linhaPorProduto = new Map<string, LinhaProjetistaComposicao>();
  for (const comodo of comodos) {
    for (const movel of comodo.moveis ?? []) {
      for (const linha of movel.linhas ?? []) {
        linhaPorProduto.set(linha.produto_id, { ...linha });
      }
    }
  }

  for (const linha of linhasLevantamento) {
    const existente = linhaPorProduto.get(linha.produto_id);
    if (existente) {
      if (existente.quantidade < linha.quantidade) {
        existente.quantidade = linha.quantidade;
      }
      if (!existente.origem_ia || existente.origem_ia === 'cortecloud') {
        existente.origem_ia = origem;
      }
      linhaPorProduto.set(linha.produto_id, existente);
    } else {
      linhaPorProduto.set(linha.produto_id, { ...linha });
    }
  }

  const faltantes = linhasLevantamento.filter((l) => {
    let found = false;
    for (const c of comodos) {
      for (const m of c.moveis ?? []) {
        if (m.linhas?.some((x) => x.produto_id === l.produto_id)) found = true;
      }
    }
    return !found;
  });

  if (faltantes.length > 0) {
    const nomeComodo = modoCortecloud ? 'Orçamento Cortecloud' : 'Projeto';
    const nomeMovel = modoCortecloud
      ? 'Complemento projetista'
      : 'Materiais do projetista';

    let comodo = comodos.find((c) => c.nome === nomeComodo);
    if (!comodo) {
      comodo = { nome: nomeComodo, moveis: [] };
      comodos.push(comodo);
    }

    let movel = comodo.moveis.find((m) => m.nome === nomeMovel);
    if (!movel) {
      movel = { nome: nomeMovel, linhas: [] };
      comodo.moveis.push(movel);
    }

    for (const linha of faltantes) {
      const merged = linhaPorProduto.get(linha.produto_id) ?? linha;
      const idx = movel.linhas.findIndex((x) => x.produto_id === linha.produto_id);
      if (idx >= 0) {
        movel.linhas[idx] = merged;
      } else {
        movel.linhas.push(merged);
      }
    }
  }

  for (const comodo of comodos) {
    for (const movel of comodo.moveis ?? []) {
      movel.linhas = (movel.linhas ?? []).map((linha) => {
        const merged = linhaPorProduto.get(linha.produto_id);
        return merged ?? linha;
      });
    }
  }

  return { comodos, produtoIds };
}

/** Coleta produto_id marcados como origem do projetista na composição. */
export function coletarProdutosOrigemProjetista(
  comodos: Array<{
    moveis?: Array<{ linhas?: Array<{ produto_id: string; origem_ia?: MarkupLinhaOrigemIA }> }>;
  }>,
  levantamento?: MarkupIAProjetistaResult | null,
  catalog?: Array<{ id: string; nome: string; variacao: string | null }>,
): string[] {
  const ids = new Set<string>();
  for (const comodo of comodos) {
    for (const movel of comodo.moveis ?? []) {
      for (const linha of movel.linhas ?? []) {
        if (
          linha.origem_ia === 'projetista' ||
          linha.origem_ia === 'projetista_complemento'
        ) {
          ids.add(linha.produto_id);
        }
      }
    }
  }

  if (ids.size === 0 && levantamento && catalog?.length) {
    for (const linha of mapearLevantamentoParaLinhas(levantamento, catalog)) {
      ids.add(linha.produto_id);
    }
  }

  return Array.from(ids);
}
