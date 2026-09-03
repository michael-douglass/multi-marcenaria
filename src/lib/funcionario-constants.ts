import type { FuncionarioCategoria, FuncionarioTipo } from '@/types'

export const FUNCIONARIO_TIPO_LABEL: Record<FuncionarioTipo, string> = {
  design: 'Design',
  projetista: 'Projetista',
  montador: 'Montador',
  montador_admin: 'Montador Admin',
  administrador_obras: 'Adm. Obras',
  financeiro: 'Financeiro',
  administrativo: 'Administrativo',
  outro: 'Outro',
}

/** Ordem amigável no select de nova pasta. */
export const FUNCIONARIO_TIPOS_CADASTRO: readonly FuncionarioTipo[] = [
  'design',
  'projetista',
  'montador',
  'montador_admin',
  'administrador_obras',
  'financeiro',
  'administrativo',
  'outro',
]

export const FUNCIONARIO_CATEGORIA_LABEL: Record<FuncionarioCategoria, string> = {
  design: 'Design',
  projetista: 'Projetista',
  montador: 'Montador',
  financeiro: 'Financeiro',
  administrativo: 'Administrativo',
  outro: 'Outro',
}

export const FUNCIONARIO_CATEGORIAS = Object.keys(
  FUNCIONARIO_CATEGORIA_LABEL,
) as FuncionarioCategoria[]

/** Alinha a categoria de cargo ao tipo de pasta escolhido. */
export function categoriaPadraoPorTipo(tipo: FuncionarioTipo): FuncionarioCategoria {
  switch (tipo) {
    case 'design':
      return 'design'
    case 'projetista':
      return 'projetista'
    case 'montador':
    case 'montador_admin':
      return 'montador'
    case 'financeiro':
      return 'financeiro'
    case 'administrador_obras':
    case 'administrativo':
      return 'administrativo'
    default:
      return 'outro'
  }
}

/** Só tipos que batem com perfil de login no sistema. */
export const FUNCIONARIO_TIPO_PERFIL: Partial<Record<FuncionarioTipo, string>> = {
  montador: 'montador',
  montador_admin: 'montador_admin',
  administrador_obras: 'administrador_obras',
  financeiro: 'financeiro',
}

/** Todo funcionário ativo (exceto marceneiro) ganha folha de ponto. */
export const TIPOS_FUNCIONARIO_PONTO: readonly FuncionarioTipo[] = [
  'design',
  'projetista',
  'montador',
  'montador_admin',
  'administrador_obras',
  'financeiro',
  'administrativo',
  'outro',
]

export function podeBaterPontoPorTipo(tipo: string | null | undefined): boolean {
  return Boolean(tipo && (TIPOS_FUNCIONARIO_PONTO as readonly string[]).includes(tipo))
}

/** Perfis de login que geram pasta automática em Funcionários */
export const PERFIS_FUNCIONARIO_AUTO = [
  'financeiro',
  'montador',
  'montador_admin',
  'administrador_obras',
] as const

export const ADMISSAO_DOC_TIPOS = [
  { id: 'ctps', label: 'CTPS (págs. 1 a 6)' },
  { id: 'pis', label: 'Número do PIS' },
  { id: 'foto_3x4', label: 'Foto 3×4 recente' },
  { id: 'certidao_nascimento_casamento', label: 'Certidão de nascimento ou casamento' },
  { id: 'certidao_filho', label: 'Certidão de nascimento de filho(a) até 21 anos' },
  { id: 'carteira_vacinacao_filho', label: 'Carteira de vacinação de filho(a) até 5 anos' },
  { id: 'rg_cpf_cnh', label: 'RG / CPF ou CNH' },
  { id: 'titulo_eleitor', label: 'Título de eleitor' },
  { id: 'certificado_militar', label: 'Certificado de alistamento militar' },
  { id: 'comprovante_endereco', label: 'Comprovante de endereço (30 dias)' },
] as const

export type AdmissaoDocTipo = (typeof ADMISSAO_DOC_TIPOS)[number]['id']

export const ADMISSAO_STATUS_LABEL = {
  pendente: 'Aguardando preenchimento',
  preenchido_funcionario: 'Enviado pelo funcionário',
  completo: 'Admissão completa',
} as const

export const RECIBO_STATUS_LABEL = {
  gerado: 'Gerado',
  aguardando_assinatura: 'Aguardando assinatura',
  assinado: 'Assinado',
} as const

export const PONTO_TIPO_LABEL: Record<string, string> = {
  entrada: 'Entrada',
  saida_intervalo: 'Saída almoço',
  retorno_intervalo: 'Retorno almoço',
  saida: 'Saída',
}

export const PONTO_STATUS_DIA_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  em_dia: 'Em dia',
  atraso: 'Atraso',
  completo: 'Completo',
  folga: 'Folga',
  falta: 'Falta',
}

export const PONTO_OCORRENCIA_LABEL: Record<string, string> = {
  folga: 'Folga',
  falta: 'Falta',
  abono: 'Abono',
}

export const DIAS_SEMANA_LABEL = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const

export const WHATSAPP_ADMISSAO = '(31) 9.9277-6813'
