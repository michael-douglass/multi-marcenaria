/**
 * Motor de cálculo determinístico — Epic 3 (prd-markup-ia-composicao-visual.md).
 * Fórmulas adaptadas da seção 4.1/5.1 de docs/sistemadeprecificacaocomia.md.
 *
 * Cópia irmã em supabase/functions/_shared/markup-motor-calculo.ts (Deno não importa
 * de src/) — qualquer mudança de fórmula precisa ir nos dois arquivos.
 *
 * Escopo deliberado: a IA (fase Projetista) extrai dimensões, tipo de móvel, cor e
 * contagem de portas/gavetas — fatos que ela lê bem de foto/PDF. Este módulo só faz a
 * CONTA a partir desses fatos (dobradiça por altura, corrediça por profundidade, chapas
 * por área). Não é um motor de otimização de corte completo — a decomposição de caixa
 * em `estimarPecasCaixaSimplificado` usa só as 4 fórmulas geométricas que o documento de
 * referência realmente define (seção 4.1); não inventa chapéu separado, módulos de
 * canto, etc. Isso é uma aproximação de área, suficiente pra estimar consumo de chapa —
 * não substitui um plano de corte de marcenaria feito por humano quando a peça for atípica.
 */

export interface FaixaDobradica {
  altura_max_mm: number | null;
  qtd: number;
}

export interface RegraConstrutiva {
  tipo_movel: string;
  espessura_corpo_mm: number;
  espessura_porta_mm: number;
  espessura_fundo_mm: number;
  rebaixo_fundo_mm: number;
  regra_dobradicas: FaixaDobradica[];
  folga_corredica_mm: number;
  folga_puxador_mm: number;
  perda_chapa_pct: number;
  perda_fita_borda_pct: number;
  area_chapa_padrao_m2: number;
}

export interface PecaCorte {
  comprimento_mm: number;
  largura_mm: number;
  qtd: number;
}

export interface DimensoesMovelMm {
  largura_mm: number;
  altura_mm: number;
  profundidade_mm: number;
}

/** Área bruta total (m²) — seção 5.1: Σ(comprimento × largura / 1.000.000 × quantidade). */
export function calcularAreaBrutaM2(pecas: PecaCorte[]): number {
  return pecas.reduce(
    (soma, p) => soma + ((p.comprimento_mm * p.largura_mm) / 1_000_000) * p.qtd,
    0,
  );
}

/** Chapas inteiras a comprar, com margem de perda — seção 5.1. */
export function calcularChapasInteiras(areaBrutaM2: number, regra: RegraConstrutiva): number {
  if (areaBrutaM2 <= 0) return 0;
  const areaComPerda = areaBrutaM2 * (1 + regra.perda_chapa_pct / 100);
  return Math.ceil(areaComPerda / regra.area_chapa_padrao_m2);
}

/** Rolos de fita de borda, com margem de perda — seção 5.1 (rolo padrão 20m, mas aceita outro). */
export function calcularRolosFitaBorda(
  perimetroAplicadoM: number,
  regra: RegraConstrutiva,
  tamanhoRoloM = 20,
): number {
  if (perimetroAplicadoM <= 0) return 0;
  const metrosComPerda = perimetroAplicadoM * (1 + regra.perda_fita_borda_pct / 100);
  return Math.ceil(metrosComPerda / tamanhoRoloM);
}

/** Quantidade de dobradiças por porta, pela altura — seção 4.1 (faixas editáveis via regra). */
export function calcularQtdDobradicas(alturaPortaMm: number, regra: RegraConstrutiva): number {
  const faixas = [...regra.regra_dobradicas].sort(
    (a, b) => (a.altura_max_mm ?? Infinity) - (b.altura_max_mm ?? Infinity),
  );
  const faixa = faixas.find((f) => f.altura_max_mm === null || alturaPortaMm <= f.altura_max_mm);
  return faixa?.qtd ?? 2;
}

/**
 * Corrediças são vendidas em tamanhos comerciais fixos, não em qualquer medida —
 * fontes de marcenaria (ver docs/referencia-caixaria-mdf.md) confirmam a linha
 * 250/300/350/400/450/500/550/600mm como padrão de mercado (Blum/Hettich/genérico).
 */
export const CORREDICA_TAMANHOS_COMERCIAIS_MM = [250, 300, 350, 400, 450, 500, 550, 600] as const;

/** Arredonda pro maior tamanho comercial que ainda cabe no espaço disponível. */
export function arredondarParaTamanhoComercialCorredica(idealMm: number): number {
  const menor = CORREDICA_TAMANHOS_COMERCIAIS_MM[0];
  const maiorQueCabe = [...CORREDICA_TAMANHOS_COMERCIAIS_MM]
    .reverse()
    .find((tamanho) => tamanho <= idealMm);
  return maiorQueCabe ?? menor;
}

/**
 * Profundidade da corrediça = profundidade da caixa menos a folga da regra — seção 4.1 —
 * arredondada pro tamanho comercial real (corrediça de 483mm não existe na loja).
 */
export function calcularProfundidadeCorredicaMm(
  profundidadeCaixaMm: number,
  regra: RegraConstrutiva,
): number {
  const ideal = Math.max(0, profundidadeCaixaMm - regra.folga_corredica_mm);
  return arredondarParaTamanhoComercialCorredica(ideal);
}

/** Largura do puxador = largura da porta/gaveta menos a folga de ponteiras — seção 4.1. */
export function calcularLarguraPuxadorMm(
  larguraPortaOuGavetaMm: number,
  regra: RegraConstrutiva,
): number {
  return Math.max(0, larguraPortaOuGavetaMm - regra.folga_puxador_mm);
}

/**
 * Decompõe as dimensões externas do móvel nas peças de corpo (laterais, base, fundo),
 * usando só as fórmulas da seção 4.1. Não inclui portas/frentes/gavetas — essas entram
 * como peças à parte, medidas pelo próprio projetista (variam demais por modelo pra ter
 * fórmula fixa). É uma aproximação de área para consumo de chapa, não um plano de corte.
 *
 * Simplificação conhecida: usa altura_mm cheia como altura da lateral. O documento de
 * referência desconta a altura do rodapé antes ("Altura Lateral = Altura Total - Altura
 * do Rodapé") — não modelamos rodapé como campo da regra ainda, então em móveis com
 * rodapé isso soma uns 8-12cm de "chapa a mais" na estimativa (superestima levemente o
 * consumo, nunca subestima — viés seguro pra compra de material, não pra corte exato).
 */
export function estimarPecasCorpoSimplificado(
  dim: DimensoesMovelMm,
  regra: RegraConstrutiva,
): PecaCorte[] {
  const alturaLateral = dim.altura_mm;
  const profundidadeLateral = Math.max(0, dim.profundidade_mm - regra.espessura_porta_mm);
  const comprimentoBase = Math.max(0, dim.largura_mm - 2 * regra.espessura_corpo_mm);
  const comprimentoFundo = comprimentoBase + 12;
  const alturaFundo = alturaLateral + 12;

  return [
    { comprimento_mm: alturaLateral, largura_mm: profundidadeLateral, qtd: 2 }, // laterais esq + dir
    { comprimento_mm: comprimentoBase, largura_mm: profundidadeLateral, qtd: 2 }, // base + topo
    { comprimento_mm: comprimentoFundo, largura_mm: alturaFundo, qtd: 1 }, // fundo (espessura menor, chapa separada)
  ];
}

/**
 * Mesma classificação por palavra-chave já usada em inferirMedidasPadraoMovel
 * (_shared/markup-ia-projetista.ts) — mantém os dois pontos de "que tipo é esse móvel"
 * consistentes entre o levantamento do projetista e a regra construtiva aplicada.
 */
export function classificarTipoMovel(nome: string): string {
  const n = nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase();
  if (n.includes('SUPERIOR') || n.includes('AEREO') || n.includes('SUSPENSO')) return 'superior';
  if (n.includes('TORRE') || n.includes('PANELEIRO') || n.includes('COLUNA')) return 'torre';
  return 'inferior';
}

/** Acha a regra do tipo classificado; cai pra 'padrao'; cai pra qualquer regra ativa como último recurso. */
export function resolverRegraParaMovel(
  nome: string,
  regras: RegraConstrutiva[],
): RegraConstrutiva | null {
  if (regras.length === 0) return null;
  const tipo = classificarTipoMovel(nome);
  return (
    regras.find((r) => r.tipo_movel === tipo) ??
    regras.find((r) => r.tipo_movel === 'padrao') ??
    regras[0]
  );
}
