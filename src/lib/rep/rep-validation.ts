import type { FuncionarioJornada, PontoMarcacao, RepConfig } from '@/types'

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

export function cnpjValido(cnpj: string): boolean {
  return somenteDigitos(cnpj).length === 14
}

export function cpfValido(cpf: string): boolean {
  return somenteDigitos(cpf).length === 11
}

export interface RepExportChecklist {
  ok: boolean
  erros: string[]
  avisos: string[]
}

export interface ValidarRepExportInput {
  tipo: 'afd' | 'aej'
  repConfig: RepConfig | null
  funcionarioCpf: string
  jornada: FuncionarioJornada | null
  marcacoes: PontoMarcacao[]
  periodoInicio: string
  periodoFim: string
}

function filterMarcacoesPeriodo(
  marcacoes: PontoMarcacao[],
  inicio: string,
  fim: string,
): PontoMarcacao[] {
  const i = new Date(inicio + 'T00:00:00')
  const f = new Date(fim + 'T23:59:59')
  return marcacoes.filter(m => {
    const d = new Date(m.registrado_em)
    return d >= i && d <= f
  })
}

export function validarExportacaoRep(input: ValidarRepExportInput): RepExportChecklist {
  const erros: string[] = []
  const avisos: string[] = []

  if (!input.repConfig?.cnpj || !cnpjValido(input.repConfig.cnpj)) {
    erros.push('Configure o CNPJ da empresa em Configurações → Ponto Eletrônico.')
  }

  if (!input.repConfig?.razao_social?.trim()) {
    erros.push('Configure a razão social da empresa em Configurações → Ponto Eletrônico.')
  }

  if (!input.jornada) {
    erros.push('Configure a jornada de trabalho do funcionário antes de exportar.')
  }

  if (!cpfValido(input.funcionarioCpf)) {
    erros.push('Cadastre o CPF do funcionário na aba Admissão (11 dígitos).')
  }

  if (!input.periodoInicio || !input.periodoFim) {
    erros.push('Informe o período de início e fim da exportação.')
  } else if (input.periodoInicio > input.periodoFim) {
    erros.push('A data de início não pode ser posterior à data de fim.')
  }

  const marcacoesPeriodo = filterMarcacoesPeriodo(
    input.marcacoes,
    input.periodoInicio,
    input.periodoFim,
  )

  if (marcacoesPeriodo.length === 0) {
    erros.push('Não há registros de ponto no período selecionado.')
  }

  if (input.tipo === 'aej' && !input.repConfig?.versao_software?.trim()) {
    erros.push('Configure a versão do software REP-P em Configurações → Ponto Eletrônico.')
  }

  if (!input.repConfig?.inpi_registro?.trim()) {
    avisos.push('Registro INPI do software não informado (recomendado para conformidade REP-P).')
  }

  if (!input.repConfig?.certificado_configurado) {
    avisos.push('Certificado digital não enviado. Configure em Configurações → Ponto Eletrônico.')
  } else if (!input.repConfig.certificado_senha_configurada) {
    avisos.push('Senha do certificado digital não configurada.')
  }

  if (input.repConfig?.certificado_valido_ate) {
    const validade = new Date(input.repConfig.certificado_valido_ate + 'T23:59:59')
    if (validade < new Date()) {
      avisos.push('Certificado digital vencido. Atualize o arquivo e a validade em Configurações.')
    }
  } else if (input.repConfig?.certificado_configurado) {
    avisos.push('Informe a data de validade do certificado em Configurações.')
  }

  return { ok: erros.length === 0, erros, avisos }
}

export function formatarCnpj(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}
