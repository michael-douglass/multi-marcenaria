import { fmtCur, fmtDate } from './utils'
import { gerarPixPayload } from './pixBrcode'
import type { ContaReceber } from '../types'

export interface TemplateCobranca {
  id: string
  nome: string
  conteudo: string
  ordem: number
}

export interface PixConfigData {
  chave_pix: string
  nome_beneficiario?: string | null
}

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function processarTemplate(
  conta: ContaReceber,
  template: TemplateCobranca,
  pixConfig: PixConfigData | null,
): string {
  const vencimento = conta.data_vencimento ?? ''
  const [ano, mes] = vencimento ? vencimento.split('-').map(Number) : [0, 0]

  const pixPayload = pixConfig?.chave_pix
    ? gerarPixPayload({
        chave: pixConfig.chave_pix,
        valor: conta.valor_parcela,
        nomeBeneficiario: pixConfig.nome_beneficiario ?? 'GARBO MOVELARIA',
      })
    : '(PIX não configurado — configure em Cobranças > ⚙️)'

  const vars: Record<string, string> = {
    nome_cliente: conta.cliente_nome ?? '',
    valor_fatura: fmtCur(conta.valor_parcela),
    data_vencimento: fmtDate(conta.data_vencimento),
    mes_referencia: mes ? MESES_PT[mes - 1] : '',
    ano_referencia: ano ? String(ano) : '',
    telefone: (conta as any).cliente_telefone ?? '',
    numero_parcela: String(conta.numero_parcela),
    total_parcelas: String(conta.total_parcelas),
    descricao_cobranca:
      conta.total_parcelas > 1
        ? `Parcela ${conta.numero_parcela}/${conta.total_parcelas}`
        : '',
    pix_copia_cola: pixPayload,
  }

  let msg = template.conteudo
  for (const [key, val] of Object.entries(vars)) {
    msg = msg.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val)
  }
  return msg
}
