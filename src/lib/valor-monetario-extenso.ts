/**
 * Converte valores monetários PT-BR para texto por extenso.
 * Determinístico — não usa IA (evita inventar valores).
 */

const UNIDADES = [
  '',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
] as const;

const DEZENAS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
] as const;

const CENTENAS = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
] as const;

function tresDigitosPorExtenso(n: number): string {
  if (n <= 0) return '';
  if (n === 100) return 'cem';
  if (n < 20) return UNIDADES[n];

  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];

  if (c > 0) partes.push(CENTENAS[c]);

  if (resto > 0) {
    if (resto < 20) {
      partes.push(UNIDADES[resto]);
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      if (u === 0) partes.push(DEZENAS[d]);
      else partes.push(`${DEZENAS[d]} e ${UNIDADES[u]}`);
    }
  }

  return partes.join(' e ');
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'zero';
  if (n < 0 || !Number.isFinite(n) || !Number.isInteger(n)) return '';

  const bilhoes = Math.floor(n / 1_000_000_000);
  const milhoes = Math.floor((n % 1_000_000_000) / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1_000);
  const resto = n % 1_000;

  const partes: string[] = [];

  if (bilhoes > 0) {
    partes.push(
      bilhoes === 1 ? 'um bilhão' : `${tresDigitosPorExtenso(bilhoes)} bilhões`,
    );
  }
  if (milhoes > 0) {
    partes.push(
      milhoes === 1 ? 'um milhão' : `${tresDigitosPorExtenso(milhoes)} milhões`,
    );
  }
  if (milhares > 0) {
    partes.push(milhares === 1 ? 'mil' : `${tresDigitosPorExtenso(milhares)} mil`);
  }
  if (resto > 0) {
    partes.push(tresDigitosPorExtenso(resto));
  }

  if (partes.length === 0) return 'zero';
  if (partes.length === 1) return partes[0];
  if (partes.length === 2) return `${partes[0]} e ${partes[1]}`;
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

/** Interpreta strings como "1.500,00", "1500", "R$ 1.500,50". */
export function parseValorMonetarioBr(raw: string): number | null {
  const s = raw.trim().replace(/R\$\s*/gi, '').replace(/\s/g, '');
  if (!s) return null;

  let normalized = s;
  if (s.includes(',')) {
    // Formato BR: 1.500,50 ou 1500,50
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // Só milhares: 1.500
    normalized = s.replace(/\./g, '');
  }

  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function valorMonetarioPorExtenso(raw: string | number): string | null {
  const valor =
    typeof raw === 'number' ? (Number.isFinite(raw) && raw >= 0 ? raw : null) : parseValorMonetarioBr(raw);
  if (valor == null) return null;

  const centavosTotais = Math.round(valor * 100);
  const reais = Math.floor(centavosTotais / 100);
  const centavos = centavosTotais % 100;

  const partes: string[] = [];

  if (reais === 0 && centavos === 0) {
    return 'zero reais';
  }

  if (reais > 0) {
    const texto = inteiroPorExtenso(reais);
    partes.push(reais === 1 ? `${texto} real` : `${texto} reais`);
  }

  if (centavos > 0) {
    const texto = inteiroPorExtenso(centavos);
    partes.push(centavos === 1 ? `${texto} centavo` : `${texto} centavos`);
  }

  return partes.join(' e ');
}

/** Calcula percentual do valor e retorna por extenso (ex.: 60% → 0.6). */
export function percentualValorPorExtenso(
  raw: string | number,
  percentual: number,
): string | null {
  const valor =
    typeof raw === 'number' ? (Number.isFinite(raw) && raw >= 0 ? raw : null) : parseValorMonetarioBr(raw);
  if (valor == null || !Number.isFinite(percentual) || percentual < 0) return null;
  const parcial = Math.round(valor * percentual * 100) / 100;
  return valorMonetarioPorExtenso(parcial);
}

export interface ContratoVariavelExtensoHint {
  nome: string;
  label: string;
  tipo?: string;
}

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isCampoExtenso60(v: ContratoVariavelExtensoHint): boolean {
  const t = `${norm(v.nome)} ${norm(v.label)}`;
  return t.includes('extenso') && (t.includes('60') || t.includes('sessenta'));
}

function isCampoExtensoTotal(v: ContratoVariavelExtensoHint): boolean {
  const t = `${norm(v.nome)} ${norm(v.label)}`;
  if (!t.includes('extenso')) return false;
  if (isCampoExtenso60(v)) return false;
  return (
    t.includes('valor') ||
    t.includes('servico') ||
    t.includes('total') ||
    t.includes('contrato')
  );
}

function acharFonteValor(
  variaveis: ContratoVariavelExtensoHint[],
  valores: Record<string, string>,
): { nome: string; valor: string } | null {
  const comValorTipo = variaveis.filter(
    (v) => v.tipo === 'valor' && (valores[v.nome] ?? '').trim(),
  );
  for (const v of comValorTipo) {
    const raw = (valores[v.nome] ?? '').trim();
    if (parseValorMonetarioBr(raw) != null) return { nome: v.nome, valor: raw };
  }

  for (const v of variaveis) {
    const t = `${norm(v.nome)} ${norm(v.label)}`;
    if (t.includes('extenso')) continue;
    if (
      (t.includes('valor') && (t.includes('servico') || t.includes('total') || t.includes('rs'))) ||
      t.includes('valor_servico') ||
      t.includes('valor_do_servico')
    ) {
      const raw = (valores[v.nome] ?? '').trim();
      if (raw && parseValorMonetarioBr(raw) != null) return { nome: v.nome, valor: raw };
    }
  }

  return null;
}

/**
 * Sugestões seguras de preenchimento por extenso a partir dos campos já preenchidos.
 * Só preenche chaves cujo valor atual está vazio.
 */
export function sugerirCamposPorExtenso(
  variaveis: ContratoVariavelExtensoHint[],
  valores: Record<string, string>,
  opts?: { sobrescrever?: boolean },
): Record<string, string> {
  const fonte = acharFonteValor(variaveis, valores);
  if (!fonte) return {};

  const patches: Record<string, string> = {};
  const sobrescrever = opts?.sobrescrever === true;

  for (const v of variaveis) {
    const atual = (valores[v.nome] ?? '').trim();
    if (atual && !sobrescrever) continue;

    if (isCampoExtenso60(v)) {
      const texto = percentualValorPorExtenso(fonte.valor, 0.6);
      if (texto) patches[v.nome] = texto;
      continue;
    }

    if (isCampoExtensoTotal(v) || (norm(v.label).includes('extenso') && !isCampoExtenso60(v))) {
      const texto = valorMonetarioPorExtenso(fonte.valor);
      if (texto) patches[v.nome] = texto;
    }
  }

  return patches;
}
