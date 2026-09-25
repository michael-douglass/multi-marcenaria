/** Status da liberação de comissão após venda concluída. */
export const COMISSAO_LIBERACAO_AGUARDANDO = 'aguardando_liberacao' as const;
export const COMISSAO_LIBERACAO_LIBERADA = 'liberada' as const;

export type ComissaoLiberacaoStatus =
  | typeof COMISSAO_LIBERACAO_AGUARDANDO
  | typeof COMISSAO_LIBERACAO_LIBERADA;

export const COMISSAO_LIBERACAO_LABEL_AGUARDANDO =
  'Venda concluída · Liberar comissão' as const;

export interface ComissaoLiberacaoRow {
  id: string;
  lead_id: number;
  field_id: string;
  prestador_id: string;
  valor_comissao: number;
  percentual: number;
  valor_base: number;
  status: ComissaoLiberacaoStatus;
  /** Conta a pagar gerada no financeiro quando entra em aguardando liberação. */
  conta_pagar_id?: string | null;
  criado_em: string;
  liberado_em: string | null;
  liberado_por: string | null;
}

export function isComissaoLiberadaParaSaque(
  vendaGanha: boolean,
  liberacao: Pick<ComissaoLiberacaoRow, 'status'> | null | undefined,
): boolean {
  if (!vendaGanha) return false;
  return liberacao?.status === COMISSAO_LIBERACAO_LIBERADA;
}

/** Tabela ainda sem grant na API ou migration não aplicada — não quebra o Financeiro. */
export function isErroTabelaLiberacaoIndisponivel(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('not found')
  );
}

export function isComissaoAguardandoLiberacao(
  vendaGanha: boolean,
  liberacao: Pick<ComissaoLiberacaoRow, 'status'> | null | undefined,
): boolean {
  if (!vendaGanha) return false;
  return !isComissaoLiberadaParaSaque(vendaGanha, liberacao);
}
