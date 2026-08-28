import type { ContratoVariavel } from '@/hooks/useContratosVariaveis';
import { substituirVariaveis } from '@/lib/contratos-print';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseBRToYMD } from '@/lib/utils';

/** Chaves internas — não entram no texto do contrato (só {{nome}} do modelo). */
export const CONTRATO_META_MODELO = '__modelo_id';
export const CONTRATO_META_ETAPA = '__etapa';
/** Marca que o usuário editou o texto livremente (não regenerar do modelo ao reabrir). */
export const CONTRATO_META_TEXTO_EDITADO = '__texto_editado';

export type ContratoEtapaRascunho = 1 | 2;

export function stripMetaCamposValores(
  campos: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(campos)) {
    if (k.startsWith('__')) continue;
    out[k] = v;
  }
  return out;
}

export function embedMetaCamposValores(
  valores: Record<string, string>,
  meta: {
    modeloId?: string;
    etapa?: ContratoEtapaRascunho;
    textoEditado?: boolean;
  },
): Record<string, string> {
  const base = stripMetaCamposValores(valores);
  if (meta.modeloId) base[CONTRATO_META_MODELO] = meta.modeloId;
  if (meta.etapa) base[CONTRATO_META_ETAPA] = String(meta.etapa);
  if (meta.textoEditado) base[CONTRATO_META_TEXTO_EDITADO] = '1';
  return base;
}

export function parseRascunhoCampos(campos: Record<string, string>): {
  valores: Record<string, string>;
  modeloId?: string;
  etapa?: ContratoEtapaRascunho;
  textoEditado: boolean;
} {
  const valores = stripMetaCamposValores(campos);
  const modeloId = campos[CONTRATO_META_MODELO];
  const etapaRaw = campos[CONTRATO_META_ETAPA];
  const etapa =
    etapaRaw === '2' ? 2 : etapaRaw === '1' ? 1 : undefined;
  const textoEditado = campos[CONTRATO_META_TEXTO_EDITADO] === '1';
  return { valores, modeloId, etapa, textoEditado };
}

const NOMES_VARIAVEL_CLIENTE = ['nome_cliente', 'nome', 'cliente', 'cliente_nome', 'contratante'];

function variavelNomeCliente(variaveis: ContratoVariavel[]): ContratoVariavel | undefined {
  return (
    variaveis.find((v) => NOMES_VARIAVEL_CLIENTE.includes(v.nome)) ??
    variaveis.find(
      (v) =>
        v.tipo === 'texto' &&
        /nome|cliente|contratante/i.test(`${v.nome} ${v.label}`),
    )
  );
}

/** Chave do campo de nome do cliente no formulário de contrato (se existir). */
export function chaveVariavelNomeCliente(variaveis: ContratoVariavel[]): string | null {
  return variavelNomeCliente(variaveis)?.nome ?? null;
}

export function resolverClienteNome(
  valores: Record<string, string>,
  variaveis: ContratoVariavel[],
): string {
  const variavel = variavelNomeCliente(variaveis);
  const nome = variavel ? (valores[variavel.nome] ?? '').trim() : '';
  return nome || 'Rascunho';
}

/** Nome legível na listagem — prioriza campos preenchidos e evita só "Rascunho". */
export function getContratoNomeExibicao(
  contrato: {
    cliente_nome: string;
    identificador: string;
    campos_valores?: Record<string, string>;
  },
  variaveis: ContratoVariavel[],
): string {
  const { valores } = parseRascunhoCampos(contrato.campos_valores ?? {});
  const dosCampos = resolverClienteNome(valores, variaveis);
  const doBanco = (contrato.cliente_nome ?? '').trim();

  if (doBanco && doBanco !== 'Rascunho') return doBanco;
  if (dosCampos && dosCampos !== 'Rascunho') return dosCampos;

  const matchId = contrato.identificador.match(
    /^\d{2}\/\d{2}\/\d{4}\s*-\s*(.+)$/,
  );
  if (matchId) {
    const extraido = matchId[1].trim();
    if (extraido && extraido !== 'Rascunho') return extraido;
  }

  const matchRascunho = contrato.identificador.match(
    /^Rascunho\s*—\s*(.+?)\s*—/,
  );
  if (matchRascunho) {
    const extraido = matchRascunho[1].trim();
    if (extraido && extraido !== 'Rascunho') return extraido;
  }

  return doBanco || dosCampos || 'Cliente não informado';
}

export function identificadorRascunho(clienteNome: string): string {
  const data = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  const base = clienteNome.trim() || 'Rascunho';
  return `Rascunho — ${base} — ${data}`;
}

export function buildConteudoContrato(
  modeloConteudo: string,
  valores: Record<string, string>,
  variaveis: ContratoVariavel[],
): string {
  const limpos = stripMetaCamposValores(valores);
  const extras = Object.fromEntries(
    variaveis
      .filter((v) => v.tipo === 'data' && limpos[v.nome])
      .map((v) => {
        try {
          const raw = limpos[v.nome];
          const ymd =
            /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : parseBRToYMD(raw) || raw;
          const dt = /^\d{4}-\d{2}-\d{2}$/.test(ymd)
            ? parse(ymd, 'yyyy-MM-dd', new Date())
            : new Date(raw);
          return [
            v.nome,
            format(dt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
          ];
        } catch {
          return [v.nome, limpos[v.nome]];
        }
      }),
  );
  return substituirVariaveis(modeloConteudo, { ...limpos, ...extras });
}

export function snapshotContratoForm(
  valores: Record<string, string>,
  modeloId: string | undefined,
  etapa: number,
  extras?: { textoEditado?: boolean; conteudo?: string },
): string {
  return JSON.stringify({
    valores: stripMetaCamposValores(valores),
    modeloId: modeloId ?? null,
    etapa,
    textoEditado: extras?.textoEditado ?? false,
    conteudo: extras?.conteudo ?? '',
  });
}

/**
 * Decide se o texto salvo deve ser reaberto como edição livre
 * (em vez de regenerar a partir do modelo + campos).
 */
export function deveRestaurarTextoEditado(opts: {
  textoEditadoFlag: boolean;
  conteudoSalvo: string;
  conteudoGeradoDoModelo: string;
  isModoEdicao: boolean;
}): boolean {
  const salvo = opts.conteudoSalvo.trim();
  if (!salvo) return false;
  if (opts.textoEditadoFlag) return true;
  // Contrato já finalizado: o texto salvo é a fonte da verdade
  if (opts.isModoEdicao) return true;
  // Compatibilidade com rascunhos antigos (sem a flag): se divergir do modelo, preservar
  return salvo !== opts.conteudoGeradoDoModelo.trim();
}
