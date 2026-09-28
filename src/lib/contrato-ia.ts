import { sugerirCamposPorExtenso } from '@/lib/valor-monetario-extenso';

export interface ContratoIAVariavelInput {
  nome: string;
  label: string;
  tipo: 'texto' | 'data' | 'valor' | 'cpf';
  obrigatorio: boolean;
}

export interface ContratoIADocumentReplacement {
  find: string;
  replace: string;
}

export interface ContratoIASugestaoCorrecao {
  id: string;
  titulo: string;
  descricao: string;
  find: string;
  replace: string;
}

export interface ContratoIARequest {
  message: string;
  etapa: 1 | 2;
  variaveis: ContratoIAVariavelInput[];
  valores: Record<string, string>;
  conteudoContrato?: string | null;
  modeloConteudo?: string | null;
  empresaSchema?: string | null;
}

export interface ContratoIAResponse {
  ok: boolean;
  reply: string;
  fieldPatches: Record<string, string>;
  documentPatch: string | null;
  documentReplacements: ContratoIADocumentReplacement[];
  sugestoesCorrecao: ContratoIASugestaoCorrecao[];
  warnings: string[];
  skipped: string[];
  modelo?: string;
  error?: string;
  aguardandoAplicacao?: boolean;
}

export interface ContratoIAPendingPatch {
  fieldPatches: Record<string, string>;
  documentPatch: string | null;
  documentReplacements: ContratoIADocumentReplacement[];
  sugestoesCorrecao: ContratoIASugestaoCorrecao[];
  warnings: string[];
  skipped: string[];
  reply: string;
  aguardandoAplicacao?: boolean;
}

const META_KEYS = new Set(['__modelo_id', '__etapa', '__texto_editado']);

/** Mantém só chaves de variáveis conhecidas (ignora meta do rascunho). */
export function filtrarFieldPatches(
  patches: Record<string, string> | null | undefined,
  nomesPermitidos: Iterable<string>,
): Record<string, string> {
  if (!patches) return {};
  const allowed = new Set(nomesPermitidos);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(patches)) {
    if (META_KEYS.has(key)) continue;
    if (!allowed.has(key)) continue;
    if (typeof value !== 'string' || !value.trim()) continue;
    out[key] = value;
  }
  return out;
}

export function sanitizeDocumentReplacements(
  raw: unknown,
): ContratoIADocumentReplacement[] {
  if (!Array.isArray(raw)) return [];
  const out: ContratoIADocumentReplacement[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const find = typeof (item as { find?: unknown }).find === 'string'
      ? (item as { find: string }).find
      : typeof (item as { from?: unknown }).from === 'string'
        ? (item as { from: string }).from
        : '';
    const replace = typeof (item as { replace?: unknown }).replace === 'string'
      ? (item as { replace: string }).replace
      : typeof (item as { to?: unknown }).to === 'string'
        ? (item as { to: string }).to
        : '';
    if (!find.trim() || find === replace) continue;
    out.push({ find, replace });
    if (out.length >= 40) break;
  }
  return out;
}

/** Aplica documentPatch ou replacements sobre o texto atual da pré-visualização. */
export function aplicarEdicoesNoDocumento(
  textoAtual: string,
  patch: Pick<
    ContratoIAPendingPatch,
    'documentPatch' | 'documentReplacements' | 'sugestoesCorrecao'
  >,
): { texto: string; alterou: boolean; aplicadas: number } {
  if (patch.documentPatch?.trim()) {
    const next = patch.documentPatch;
    return {
      texto: next,
      alterou: next !== textoAtual,
      aplicadas: 1,
    };
  }

  const replacements =
    (patch.documentReplacements?.length ?? 0) > 0
      ? patch.documentReplacements
      : sugestoesParaReplacements(patch.sugestoesCorrecao ?? []);

  let texto = textoAtual;
  let aplicadas = 0;
  for (const { find, replace } of replacements ?? []) {
    if (!find || !texto.includes(find)) continue;
    texto = texto.split(find).join(replace);
    aplicadas += 1;
  }
  return {
    texto,
    alterou: aplicadas > 0 && texto !== textoAtual,
    aplicadas,
  };
}

export function contarAlteracoesPendentes(patch: ContratoIAPendingPatch | null): number {
  if (!patch) return 0;
  const sug = patch.sugestoesCorrecao?.length ?? 0;
  if (sug > 0) return sug + Object.keys(patch.fieldPatches).length;
  return (
    Object.keys(patch.fieldPatches).length +
    (patch.documentPatch ? 1 : 0) +
    (patch.documentReplacements?.length ?? 0)
  );
}

export function temAlteracoesPendentes(patch: ContratoIAPendingPatch | null): boolean {
  return contarAlteracoesPendentes(patch) > 0;
}

export function temEdicaoDeDocumento(patch: ContratoIAPendingPatch | null): boolean {
  if (!patch) return false;
  return (
    Boolean(patch.documentPatch?.trim()) ||
    (patch.documentReplacements?.length ?? 0) > 0 ||
    (patch.sugestoesCorrecao?.length ?? 0) > 0
  );
}

export function sanitizeSugestoesCorrecao(
  raw: unknown,
  fallbackReplacements: ContratoIADocumentReplacement[] = [],
): ContratoIASugestaoCorrecao[] {
  const out: ContratoIASugestaoCorrecao[] = [];
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      if (!item || typeof item !== 'object') continue;
      const find =
        typeof (item as { find?: unknown }).find === 'string'
          ? (item as { find: string }).find
          : '';
      const replace =
        typeof (item as { replace?: unknown }).replace === 'string'
          ? (item as { replace: string }).replace
          : '';
      if (!find.trim() || find === replace) continue;
      const titulo =
        typeof (item as { titulo?: unknown }).titulo === 'string'
          ? (item as { titulo: string }).titulo.trim()
          : `Correção ${i + 1}`;
      const descricao =
        typeof (item as { descricao?: unknown }).descricao === 'string'
          ? (item as { descricao: string }).descricao.trim()
          : 'Sugestão de correção no corpo do contrato.';
      out.push({
        id: `sug-${i + 1}-${find.slice(0, 12)}`,
        titulo: titulo || `Correção ${i + 1}`,
        descricao,
        find,
        replace,
      });
      if (out.length >= 40) break;
    }
  }
  if (out.length === 0 && fallbackReplacements.length > 0) {
    return fallbackReplacements.map((r, i) => ({
      id: `sug-auto-${i + 1}`,
      titulo: `Alteração ${i + 1}`,
      descricao: 'Sugestão gerada após leitura e verificação do contrato.',
      find: r.find,
      replace: r.replace,
    }));
  }
  return out;
}

export function sugestoesParaReplacements(
  sugestoes: ContratoIASugestaoCorrecao[],
): ContratoIADocumentReplacement[] {
  return sugestoes
    .filter((s) => s.find.trim() && s.find !== s.replace)
    .map((s) => ({ find: s.find, replace: s.replace }));
}

/** Atalhos locais (sem OpenAI) para por-extenso. */
export function patchesLocaisPorExtenso(
  variaveis: ContratoIAVariavelInput[],
  valores: Record<string, string>,
): Record<string, string> {
  return sugerirCamposPorExtenso(variaveis, valores);
}

export const CONTRATO_IA_SUGESTOES_ETAPA_1 = [
  'Preencher campos vazios com o que já dá para calcular (sem inventar)',
  'Gerar valores por extenso a partir do valor do serviço',
  'Corrigir ortografia dos campos de texto (sem mudar fatos)',
] as const;

/** Ativa edição do corpo completo na pré-visualização via IA. */
export const CONTRATO_IA_EDITAR_PREVIEW =
  'Editar pré-visualização: leia o corpo inteiro do contrato e aplique só as adaptações que eu pedir a seguir';

/** Lê o contrato, encontra problemas e envia sugestões de correção verificadas. */
export const CONTRATO_IA_AUTOCORRECAO =
  'Autocorreção: leia o corpo inteiro do contrato, corrija o que estiver errado ou incoerente e envie sugestões de correção já verificadas';

export const CONTRATO_IA_SUGESTOES_ETAPA_2 = [
  CONTRATO_IA_EDITAR_PREVIEW,
  CONTRATO_IA_AUTOCORRECAO,
  'Corrigir ortografia do texto do contrato (sem mudar fatos nem valores)',
  'Adaptar este contrato para pessoa jurídica (PJ) — só com dados já preenchidos',
  'Revisar clareza das cláusulas sem inventar informações',
] as const;
