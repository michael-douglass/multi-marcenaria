/** Texto padrão gravado pelo detector automático de faltas. */
export const OBS_FALTA_AUTOMATICA = 'Falta detectada automaticamente.'

/** Motivo real (≠ vazio e ≠ texto automático). */
export function faltaTemJustificativa(observacao?: string | null): boolean {
  const t = observacao?.trim() ?? ''
  return t.length > 0 && t !== OBS_FALTA_AUTOMATICA
}

/**
 * Falta que deve aparecer / contar como débito no caixa:
 * flag abater_banco_horas OU ainda sem justificativa real.
 */
export function faltaDebitaCaixa(f: {
  abater_banco_horas?: boolean | null
  observacao?: string | null
}): boolean {
  if (f.abater_banco_horas) return true
  return !faltaTemJustificativa(f.observacao)
}
