/**
 * Motor das variáveis do contrato (funções puras). Ver docs/contrato-padrao/DESIGN.md §4.
 *
 * Ordem de resolução de um modelo:
 *   1. valores = empresa (`{{empresa_*}}`) < calculadas < digitadas pelo usuário (não vazias);
 *   2. blocos `{{#se nome}}…{{/se}}` (mantidos quando o valor é "sim"/vazio, removidos com "nao");
 *   3. troca dos `{{nome}}` (o que não tiver valor continua `{{nome}}` — fica visível na prévia).
 *
 * Calculadas (nunca pedidas ao usuário):
 *   - `{{X_extenso}}` para toda variável X do tipo `valor` (reais) ou `numero`;
 *   - com `valor_total` + `percentual_entrada`: `valor_entrada`, `valor_saldo`, `percentual_saldo`
 *     e os `_extenso` de entrada/saldo.
 */
import { numeroPorExtenso, parseValorMonetarioBr, valorMonetarioPorExtenso } from '@/lib/valor-monetario-extenso';

export interface VariavelContratoBase {
  nome: string;
  tipo: string;
  label?: string;
  valor_padrao?: string | null;
}

const RE_VAR = /\{\{(\w+)\}\}/g;
/** `{{#se nome}}` … `{{/se}}` — a quebra de linha logo após cada marcador é consumida junto. */
const RE_SE = /\{\{#se (\w+)\}\}\r?\n?([\s\S]*?)\{\{\/se\}\}\r?\n?/g;

export const VAR_VALOR_TOTAL = 'valor_total';
export const VAR_PERCENTUAL_ENTRADA = 'percentual_entrada';

/** Calculadas fixas (dependem de `valor_total` + `percentual_entrada`). */
export const VARIAVEIS_CALCULADAS: ReadonlyArray<{ nome: string; label: string }> = [
  { nome: 'valor_entrada', label: 'Valor da entrada (total × %)' },
  { nome: 'valor_entrada_extenso', label: 'Valor da entrada por extenso' },
  { nome: 'valor_saldo', label: 'Saldo (total − entrada)' },
  { nome: 'valor_saldo_extenso', label: 'Saldo por extenso' },
  { nome: 'percentual_saldo', label: 'Percentual do saldo (100 − entrada)' },
];

const NOMES_CALCULADAS_FIXAS = new Set(VARIAVEIS_CALCULADAS.map((v) => v.nome));

/** Nome que o sistema preenche sozinho — não pode virar campo manual. */
export function nomeReservadoContrato(nome: string): boolean {
  return nome.startsWith('empresa_') || NOMES_CALCULADAS_FIXAS.has(nome) || nome.endsWith('_extenso');
}

/** "nao"/"não"/"false"/"0"/"off" → falso; qualquer outra coisa (inclusive vazio) → verdadeiro. */
export function valorSimNao(valor: string | undefined | null): boolean {
  const v = (valor ?? '').trim().toLowerCase();
  return !['nao', 'não', 'n', 'false', '0', 'off', 'no'].includes(v);
}

/** Nomes usados em `{{#se nome}}`. */
export function extrairCondicionais(template: string): string[] {
  const nomes = new Set<string>();
  for (const m of template.matchAll(/\{\{#se (\w+)\}\}/g)) nomes.add(m[1]);
  return [...nomes];
}

/** Todos os nomes que o modelo usa (`{{x}}` e `{{#se x}}`). */
export function nomesUsadosNoModelo(template: string): Set<string> {
  const nomes = new Set<string>(extrairCondicionais(template));
  for (const m of template.matchAll(RE_VAR)) nomes.add(m[1]);
  return nomes;
}

export function aplicarBlocosCondicionais(template: string, valores: Record<string, string>): string {
  // Repete para suportar blocos aninhados simples (o regex pega o mais interno primeiro só se não houver outro #se dentro).
  let atual = template;
  for (let i = 0; i < 5; i++) {
    const prox = atual.replace(RE_SE, (_, nome: string, corpo: string) => (valorSimNao(valores[nome]) ? corpo : ''));
    if (prox === atual) break;
    atual = prox;
  }
  return atual;
}

/** "10.000,00" (sem "R$"). */
export function formatValorBr(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "40" / "37,5" (sem zeros sobrando). */
export function formatNumeroBr(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

/** Valores calculados a partir do que já foi preenchido. */
export function valoresCalculados(
  variaveis: ReadonlyArray<VariavelContratoBase>,
  valores: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of variaveis) {
    const raw = (valores[v.nome] ?? '').trim();
    if (!raw) continue;
    if (v.tipo === 'valor') {
      const t = valorMonetarioPorExtenso(raw);
      if (t) out[`${v.nome}_extenso`] = t;
    } else if (v.tipo === 'numero') {
      const t = numeroPorExtenso(raw);
      if (t) out[`${v.nome}_extenso`] = t;
    }
  }

  const total = parseValorMonetarioBr(valores[VAR_VALOR_TOTAL] ?? '');
  const pct = parseValorMonetarioBr(valores[VAR_PERCENTUAL_ENTRADA] ?? '');
  if (total != null && pct != null && pct <= 100) {
    // Em centavos inteiros: entrada + saldo sempre fecham o total.
    const totalCent = Math.round(total * 100);
    const entradaCent = Math.round((totalCent * pct) / 100);
    const saldoCent = totalCent - entradaCent;
    out.valor_entrada = formatValorBr(entradaCent / 100);
    out.valor_saldo = formatValorBr(saldoCent / 100);
    out.valor_entrada_extenso = valorMonetarioPorExtenso(entradaCent / 100) ?? '';
    out.valor_saldo_extenso = valorMonetarioPorExtenso(saldoCent / 100) ?? '';
    out.percentual_saldo = formatNumeroBr(Math.round((100 - pct) * 100) / 100);
  }
  return out;
}

/** Valor padrão de cada campo, com `{{empresa_*}}` resolvido (ex.: chave PIX = CNPJ). */
export function resolverValoresPadrao(
  variaveis: ReadonlyArray<VariavelContratoBase>,
  valoresEmpresa: Record<string, string> = {},
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of variaveis) {
    const padrao = v.valor_padrao?.trim();
    if (!padrao) continue;
    const resolvido = padrao.replace(RE_VAR, (m, nome: string) => valoresEmpresa[nome]?.trim() || m).trim();
    // Padrão que depende de um dado da empresa ainda vazio fica em branco (o usuário preenche).
    if (resolvido && !/\{\{\w+\}\}/.test(resolvido)) out[v.nome] = resolvido;
  }
  return out;
}

/**
 * Monta o texto final. `valores` já deve vir com as datas formatadas (ver `buildConteudoContrato`).
 * Valores vazios da empresa não são aplicados: o `{{empresa_x}}` continua visível na prévia.
 */
export function montarTextoContrato(
  template: string,
  variaveis: ReadonlyArray<VariavelContratoBase>,
  valores: Record<string, string>,
  valoresEmpresa: Record<string, string> = {},
): string {
  const empresa: Record<string, string> = {};
  for (const [k, v] of Object.entries(valoresEmpresa)) if (v?.trim()) empresa[k] = v;
  const calculadas = valoresCalculados(variaveis, valores);
  const todos: Record<string, string> = { ...empresa, ...calculadas };
  for (const [k, v] of Object.entries(valores)) {
    // Valor vazio do usuário não apaga um valor automático.
    if (v?.trim() || !(k in todos)) todos[k] = v;
  }
  const comBlocos = aplicarBlocosCondicionais(template, todos);
  return comBlocos.replace(RE_VAR, (m, nome: string) => todos[nome] ?? m);
}

/** `{{empresa_*}}` usadas no modelo que estão sem valor no cadastro da empresa. */
export function variaveisEmpresaFaltando(template: string, valoresEmpresa: Record<string, string>): string[] {
  return [...nomesUsadosNoModelo(template)].filter((n) => n.startsWith('empresa_') && !valoresEmpresa[n]?.trim());
}
