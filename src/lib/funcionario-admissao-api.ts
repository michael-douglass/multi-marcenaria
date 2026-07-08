import type { FuncionarioAdmissaoDados, FuncionarioAdmissaoStatus, FuncionarioInput } from '@/types'

export function buildAdmissaoSavePayload(
  dados: FuncionarioAdmissaoDados,
  currentDados: FuncionarioAdmissaoDados,
  currentStatus: FuncionarioAdmissaoStatus,
  finalizar: boolean,
): Partial<FuncionarioInput> {
  const merged = { ...currentDados, ...dados }
  const cpf = String(merged.cpf ?? '').trim()
  const telefone = String(merged.telefone ?? '').trim()
  const email = String(merged.email_pessoal ?? merged.email ?? '').trim()

  let admissao_status = currentStatus
  if (finalizar) {
    admissao_status = 'preenchido_funcionario'
  } else if (currentStatus === 'pendente') {
    admissao_status = 'pendente'
  }

  return {
    admissao_dados: merged,
    admissao_status,
    cpf: cpf || null,
    telefone: telefone || null,
    email: email || null,
  }
}
