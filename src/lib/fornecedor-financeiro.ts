import type { ContaPagar, Fornecedor } from '../types'

/** Soma parcelas pendentes (não pagas) vinculadas ao fornecedor */
export function totalAPagarFornecedor(fornecedorId: string, contas: ContaPagar[]): number {
  return contas
    .filter(c => c.fornecedor_id === fornecedorId && c.status !== 'pago')
    .reduce((s, c) => s + Number(c.valor_parcela ?? 0), 0)
}

export function limiteDisponivel(limite: number, utilizado: number): number {
  return limite - utilizado
}

export interface ResumoFinanceiroFornecedor {
  limite: number
  aPagar: number
  disponivel: number
  caixa: number
}

export function resumoFornecedor(
  fornecedor: Fornecedor,
  contas: ContaPagar[],
  getSaldo: (id: string) => number,
): ResumoFinanceiroFornecedor {
  const limite = Number(fornecedor.limite_com_fornecedor ?? 0)
  const aPagar = totalAPagarFornecedor(fornecedor.id, contas)
  return {
    limite,
    aPagar,
    disponivel: limiteDisponivel(limite, aPagar),
    caixa: getSaldo(fornecedor.id),
  }
}

export interface TotaisFornecedoresPagina {
  limiteTotal: number
  aPagarTotal: number
  disponivelTotal: number
  caixaTotal: number
}

export function totaisPaginaFornecedores(
  fornecedores: Fornecedor[],
  contas: ContaPagar[],
  getSaldo: (id: string) => number,
): TotaisFornecedoresPagina {
  let limiteTotal = 0
  let aPagarTotal = 0
  let caixaTotal = 0

  for (const f of fornecedores) {
    limiteTotal += Number(f.limite_com_fornecedor ?? 0)
    aPagarTotal += totalAPagarFornecedor(f.id, contas)
    caixaTotal += getSaldo(f.id)
  }

  return {
    limiteTotal,
    aPagarTotal,
    disponivelTotal: limiteTotal - aPagarTotal,
    caixaTotal,
  }
}
