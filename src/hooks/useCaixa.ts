import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { 
  CaixaDestinatario, 
  CaixaMovimentacao, 
  CaixaSaldoAcumulado, 
  ResumoCaixa, 
  ReservaConsolidada
} from '../types'
import { useAuthReady } from './useAuthReady'

/** Linha de reserva sem destinatário cadastrado no caixa (só dívida operacional). */
export function isCaixaDestinatarioVirtual(destinatarioId: string): boolean {
  return destinatarioId.startsWith('__virtual__:')
}

export function useCaixa(mes: number, ano: number) {
  const { isReady } = useAuthReady()
  const [destinatarios, setDestinatarios] = useState<CaixaDestinatario[]>([])
  const [movimentacoes, setMovimentacoes] = useState<CaixaMovimentacao[]>([])
  const [resumo, setResumo] = useState<ResumoCaixa>({
    total_reservado: 0,
    total_pago: 0,
    saldo_disponivel: 0,
    saldo_meses_anteriores: 0
  })
  const [reservasConsolidadas, setReservasConsolidadas] = useState<ReservaConsolidada[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)

    try {
      // 1. Destinatários
      const { data: dests } = await supabase
        .from('movelaria_caixa_destinatarios')
        .select('*')
        .eq('ativo', true)
        .order('nome')

      // 2. Movimentações do mês
      const { data: movs } = await supabase
        .from('movelaria_caixa_movimentacoes')
        .select('*, movelaria_caixa_destinatarios(id, nome, tipo)')
        .eq('mes_referencia', mes)
        .eq('ano_referencia', ano)
        .order('data_movimentacao', { ascending: false })

      // 3. Saldos Acumulados do mês
      const { data: saldos } = await supabase
        .from('movelaria_caixa_saldo_acumulado')
        .select('*')
        .eq('mes_referencia', mes)
        .eq('ano_referencia', ano)

      // 4. Saldo meses anteriores
      const { data: saldosAnteriores } = await supabase
        .from('movelaria_caixa_saldo_acumulado')
        .select('saldo')
        .or(`ano_referencia.lt.${ano},and(ano_referencia.eq.${ano},mes_referencia.lt.${mes})`)

      const saldoAnterior = (saldosAnteriores ?? []).reduce((acc, curr) => acc + (curr.saldo || 0), 0)

      // 5. Operational Data (Valor Total Real)
      // Para despesas: movelaria_contas_pagar
      const startOfMonth = `${ano}-${String(mes).padStart(2, '0')}-01`
      const endOfMonthStr = new Date(ano, mes, 0).toISOString().split('T')[0]

      // Dívida operacional do mês: pendentes (comissão gerada) + pagas
      const { data: contasPagar } = await supabase
        .from('movelaria_contas_pagar')
        .select('fornecedor_nome, valor_parcela, data_vencimento, status, prestador_id')
        .in('status', ['pendente', 'parcialmente_pago', 'pago'])
        .gte('data_vencimento', startOfMonth)
        .lte('data_vencimento', endOfMonthStr)

      // Consolidação
      const operationalMap = new Map<string, { total: number, count: number, vencimento?: string, nomeExibicao: string }>()
      contasPagar?.forEach(cp => {
        const nome = cp.fornecedor_nome?.toLowerCase().trim() || ''
        if (!nome) return
        const entry = operationalMap.get(nome) || {
          total: 0,
          count: 0,
          nomeExibicao: cp.fornecedor_nome?.trim() || nome,
        }
        entry.total += cp.valor_parcela
        entry.count += 1
        if (!entry.vencimento || cp.data_vencimento < entry.vencimento) {
          entry.vencimento = cp.data_vencimento
        }
        operationalMap.set(nome, entry)
      })

      const consolidado: ReservaConsolidada[] = (dests ?? []).map(d => {
        const saldo = saldos?.find(s => s.destinatario_id === d.id)
        const oper = operationalMap.get(d.nome.toLowerCase().trim())

        return {
          destinatario_id: d.id,
          destinatario_nome: d.nome,
          tipo_destinatario: d.tipo,
          data_vencimento: oper?.vencimento || undefined,
          valor_total_real: oper?.total || 0,
          valor_em_reserva: saldo?.total_reservado ?? 0,
          total_pago: saldo?.total_pago ?? 0,
          totalLancamentosMes: oper?.count || 0,
          totalItensConcluidosMes: 0,
          mes_referencia: mes,
          ano_referencia: ano,
        }
      })

      // Linhas virtuais: dívida operacional sem destinatário cadastrado ainda
      for (const [nomeKey, oper] of operationalMap) {
        if (consolidado.some(c => c.destinatario_nome.toLowerCase().trim() === nomeKey)) continue
        consolidado.push({
          destinatario_id: `__virtual__:${nomeKey}`,
          destinatario_nome: oper.nomeExibicao,
          tipo_destinatario: 'marceneiro',
          data_vencimento: oper.vencimento,
          valor_total_real: oper.total,
          valor_em_reserva: 0,
          total_pago: 0,
          totalLancamentosMes: oper.count,
          totalItensConcluidosMes: 0,
          mes_referencia: mes,
          ano_referencia: ano,
        })
      }

      setDestinatarios(dests ?? [])
      setMovimentacoes((movs as any) ?? [])
      setResumo({
        total_reservado: (saldos ?? []).reduce((acc, s) => acc + (s.total_reservado || 0), 0),
        total_pago: (saldos ?? []).reduce((acc, s) => acc + (s.total_pago || 0), 0),
        saldo_disponivel: (saldos ?? []).reduce((acc, s) => acc + (s.saldo || 0), 0),
        saldo_meses_anteriores: saldoAnterior
      })
      setReservasConsolidadas(
        consolidado.filter(
          item =>
            item.valor_total_real > 0
            || item.valor_em_reserva > 0
            || item.total_pago > 0,
        ),
      )
    } catch (err) {
      console.error('[useCaixa] Erro ao carregar dados:', err)
    } finally {
      setLoading(false)
    }
  }, [isReady, mes, ano])

  useEffect(() => { load() }, [load])

  const registrarMovimentacao = async (mov: Omit<CaixaMovimentacao, 'id' | 'criado_em' | 'criado_por'>) => {
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('movelaria_caixa_movimentacoes')
      .insert({ ...mov, criado_por: userData.user?.id })
    if (error) throw error
    await load()
  }

  const addDestinatario = async (dest: Omit<CaixaDestinatario, 'id' | 'criado_em' | 'atualizado_em'>) => {
    const { error } = await supabase
      .from('movelaria_caixa_destinatarios')
      .insert(dest)
    if (error) throw error
    await load()
  }

  const removeDestinatario = async (id: string) => {
    const { error } = await supabase
      .from('movelaria_caixa_destinatarios')
      .update({ ativo: false })
      .eq('id', id)
    if (error) throw error
    await load()
  }

  return {
    destinatarios,
    movimentacoes,
    resumo,
    reservasConsolidadas,
    loading,
    registrarMovimentacao,
    addDestinatario,
    removeDestinatario,
    reload: load
  }
}
