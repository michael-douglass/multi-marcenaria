import type { FuncionarioAdmissaoDados } from '@/types'

/**
 * Mescla admissão sem apagar campos que outro salvamento paralelo ainda não mandou.
 * Ex.: salvar só o salário não pode zerar horarios_semana.
 */
export function mergeAdmissaoDados(
  atual: FuncionarioAdmissaoDados | null | undefined,
  patch: FuncionarioAdmissaoDados | null | undefined,
): FuncionarioAdmissaoDados {
  const base = { ...(atual ?? {}) }
  if (!patch) return base

  const next: FuncionarioAdmissaoDados = { ...base, ...patch }

  // Grade de horários: se o patch trouxer a chave, substitui o bloco inteiro.
  if (patch.horarios_semana !== undefined) {
    next.horarios_semana = patch.horarios_semana
  }
  if (patch.horarios_dias_ativos !== undefined) {
    next.horarios_dias_ativos = patch.horarios_dias_ativos
  }

  return next
}
