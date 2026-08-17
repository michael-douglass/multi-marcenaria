import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { desfazerReservaDestinatarioMes } from '../lib/caixa-desfazer-reserva'
import { useAutoRefresh } from './useAutoRefresh'
import { canUseRealtime } from '../lib/device'
import type {
  CaixaDestinatario,
  CaixaMovimentacao,
  ResumoCaixa,
  ReservaConsolidada,
  TipoMovimentacaoCaixa,
} from '../types'
import { useAuthReady } from './useAuthReady'
import { todayISO } from '../lib/utils'
import { ordenarReservasCaixa } from '../lib/caixa-ordenar-reservas'

const CAIXA_REALTIME_CHANNEL = 'movelaria-caixa-sync'
const AJUSTE_MANUAL_PREFIX = 'Ajuste manual'
const EPS = 0.009

/** Linha de reserva sem destinatário cadastrado no caixa (só dívida operacional). */
export function isCaixaDestinatarioVirtual(destinatarioId: string): boolean {
  return destinatarioId.startsWith('__virtual__:')
}

export interface AjustarTotalConsolidadoParams {
  destinatarioId: string
  mes: number
  ano: number
  tipo: TipoMovimentacaoCaixa
  novoTotal: number
}

export interface ContaPagarResumoCaixa {
  id: string
  descricao: string | null
  valor_parcela: number
  status: string
  data_vencimento: string
}

export interface AjustarValorRealParams {
  destinatarioNome: string
  mes: number
  ano: number
  novoTotal: number
}

function periodoMes(mes: number, ano: number) {
  const startOfMonth = `${ano}-${String(mes).padStart(2, '0')}-01`
  const endOfMonth = new Date(ano, mes, 0).toISOString().split('T')[0]
  return { startOfMonth, endOfMonth }
}

function nomeFornecedorKey(nome: string): string {
  return nome.toLowerCase().trim()
}

function isMovimentacaoAjusteManual(mov: {
  conta_pagar_id?: string | null
  descricao?: string | null
}): boolean {
  if (!mov.conta_pagar_id) return true
  return (mov.descricao ?? '').startsWith(AJUSTE_MANUAL_PREFIX)
}

function rotuloAjuste(tipo: TipoMovimentacaoCaixa): string {
  return tipo === 'reserva'
    ? `${AJUSTE_MANUAL_PREFIX} — reservado`
    : `${AJUSTE_MANUAL_PREFIX} — pago`
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
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

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isReady) return
    if (!opts?.silent) setLoading(true)

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

      // Dívida operacional do mês (Contas a Pagar).
      // "Valor real" = soma de TODAS as parcelas do mês (abertas + já pagas),
      // para não cair quando uma parcela é paga/reservada (ex.: JR 21.937 →
      // pagar 8.805 deve manter valor real e só aumentar o reservado).
      // Fantasmas só-pagos sem movimento no Caixa continuam ocultos.
      const { data: contasPagar } = await supabase
        .from('movelaria_contas_pagar')
        .select('fornecedor_nome, valor_parcela, data_vencimento, status, prestador_id')
        .in('status', ['pendente', 'parcialmente_pago', 'pago'])
        .gte('data_vencimento', startOfMonth)
        .lte('data_vencimento', endOfMonthStr)

      type OperEntry = { total: number, count: number, vencimento?: string, nomeExibicao: string }
      const operationalOpen = new Map<string, OperEntry>()
      const operationalAll = new Map<string, OperEntry>()

      const bumpOper = (map: Map<string, OperEntry>, cp: {
        fornecedor_nome: string | null
        valor_parcela: number
        data_vencimento: string
      }) => {
        const nome = cp.fornecedor_nome?.toLowerCase().trim() || ''
        if (!nome) return
        const entry = map.get(nome) || {
          total: 0,
          count: 0,
          nomeExibicao: cp.fornecedor_nome?.trim() || nome,
        }
        entry.total += cp.valor_parcela
        entry.count += 1
        if (!entry.vencimento || cp.data_vencimento < entry.vencimento) {
          entry.vencimento = cp.data_vencimento
        }
        map.set(nome, entry)
      }

      contasPagar?.forEach(cp => {
        bumpOper(operationalAll, cp)
        if (cp.status === 'pendente' || cp.status === 'parcialmente_pago') {
          bumpOper(operationalOpen, cp)
        }
      })

      // Linha aparece se há dívida aberta OU movimento no Caixa.
      // Valor real sempre usa o total do mês (all), não só o que ainda está aberto.
      const resolveOper = (nomeKey: string, temCaixa: boolean): OperEntry | undefined => {
        const aberto = operationalOpen.get(nomeKey)
        const todos = operationalAll.get(nomeKey)
        if (aberto || temCaixa) return todos ?? aberto
        return undefined
      }

      const consolidado: ReservaConsolidada[] = (dests ?? []).map(d => {
        const saldo = saldos?.find(s => s.destinatario_id === d.id)
        const temCaixa =
          (saldo?.total_reservado ?? 0) > 0
          || (saldo?.total_pago ?? 0) > 0
        const oper = resolveOper(d.nome.toLowerCase().trim(), temCaixa)

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

      // Linhas virtuais: dívida em aberto sem destinatário cadastrado ainda
      for (const [nomeKey, oper] of operationalOpen) {
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
        ordenarReservasCaixa(
          consolidado.filter(
            item =>
              item.valor_total_real > 0
              || item.valor_em_reserva > 0
              || item.total_pago > 0,
          ),
        ),
      )
    } catch (err) {
      console.error('[useCaixa] Erro ao carregar dados:', err)
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [isReady, mes, ano])

  const silentReload = useCallback(() => {
    void load({ silent: true })
  }, [load])

  useEffect(() => { void load() }, [load])
  useAutoRefresh(silentReload)

  useEffect(() => {
    if (!isReady || !canUseRealtime()) return

    const channel = supabase
      .channel(CAIXA_REALTIME_CHANNEL)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movelaria_caixa_movimentacoes' },
        silentReload,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movelaria_caixa_saldo_acumulado' },
        silentReload,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movelaria_caixa_destinatarios' },
        silentReload,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movelaria_contas_pagar' },
        silentReload,
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [isReady, silentReload])

  const registrarMovimentacao = async (mov: Omit<CaixaMovimentacao, 'id' | 'criado_em' | 'criado_por'>) => {
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('movelaria_caixa_movimentacoes')
      .insert({ ...mov, criado_por: userData.user?.id })
    if (error) throw error
    await load({ silent: true })
  }

  const addDestinatario = async (dest: Omit<CaixaDestinatario, 'id' | 'criado_em' | 'atualizado_em'>) => {
    const { error } = await supabase
      .from('movelaria_caixa_destinatarios')
      .insert(dest)
    if (error) throw error
    await load({ silent: true })
  }

  const removeDestinatario = async (id: string) => {
    const { error } = await supabase
      .from('movelaria_caixa_destinatarios')
      .update({ ativo: false })
      .eq('id', id)
    if (error) throw error
    await load({ silent: true })
  }

  const desfazerReserva = async (item: ReservaConsolidada) => {
    if (isCaixaDestinatarioVirtual(item.destinatario_id)) {
      throw new Error('Cadastre este destinatário em Destinatários antes de desfazer.')
    }
    if (item.valor_em_reserva <= 0) {
      throw new Error('Não há valor reservado para desfazer nesta linha.')
    }

    await desfazerReservaDestinatarioMes({
      destinatarioId: item.destinatario_id,
      mes: item.mes_referencia,
      ano: item.ano_referencia,
    })
    await load({ silent: true })
  }

  /**
   * Remove a linha do Caixa no mês: apaga movimentações e Contas a Pagar
   * do mesmo destinatário/fornecedor naquele período (RPC no banco).
   */
  const excluirLinhaCaixa = async (item: ReservaConsolidada) => {
    const { error } = await supabase.rpc('movelaria_excluir_linha_caixa', {
      p_destinatario_id: item.destinatario_id,
      p_destinatario_nome: item.destinatario_nome,
      p_mes: item.mes_referencia,
      p_ano: item.ano_referencia,
    })
    if (error) throw error
    await load({ silent: true })
  }

  const excluirMovimentacao = async (movimentacaoId: string) => {
    const { error } = await supabase.rpc('movelaria_excluir_movimentacao_caixa', {
      p_movimentacao_id: movimentacaoId,
    })
    if (error) throw error
    await load({ silent: true })
  }

  /** Contas a pagar do destinatário no mês (base do "Valor real"). */
  const listarContasValorReal = async (
    destinatarioNome: string,
    mesRef: number,
    anoRef: number,
  ): Promise<ContaPagarResumoCaixa[]> => {
    const { startOfMonth, endOfMonth } = periodoMes(mesRef, anoRef)
    const nomeKey = nomeFornecedorKey(destinatarioNome)

    const { data, error } = await supabase
      .from('movelaria_contas_pagar')
      .select('id, fornecedor_nome, descricao, valor_parcela, status, data_vencimento')
      .in('status', ['pendente', 'parcialmente_pago', 'pago'])
      .gte('data_vencimento', startOfMonth)
      .lte('data_vencimento', endOfMonth)
      .order('data_vencimento', { ascending: true })

    if (error) throw error

    return (data ?? [])
      .filter(cp => nomeFornecedorKey(cp.fornecedor_nome ?? '') === nomeKey)
      .map(cp => ({
        id: cp.id,
        descricao: cp.descricao ?? null,
        valor_parcela: Number(cp.valor_parcela) || 0,
        status: cp.status,
        data_vencimento: cp.data_vencimento,
      }))
  }

  /**
   * Ajusta o total operacional (Valor real) redistribuindo nas contas a pagar do mês.
   */
  const ajustarValorReal = async ({
    destinatarioNome,
    mes: mesRef,
    ano: anoRef,
    novoTotal,
  }: AjustarValorRealParams) => {
    if (!Number.isFinite(novoTotal) || novoTotal < 0) {
      throw new Error('Informe um valor válido (zero ou positivo).')
    }

    const alvo = roundMoney(novoTotal)
    const { startOfMonth, endOfMonth } = periodoMes(mesRef, anoRef)
    const nomeKey = nomeFornecedorKey(destinatarioNome)

    const { data, error } = await supabase
      .from('movelaria_contas_pagar')
      .select('id, fornecedor_nome, valor_parcela, valor_total, valor_pago, status, total_parcelas')
      .in('status', ['pendente', 'parcialmente_pago', 'pago'])
      .gte('data_vencimento', startOfMonth)
      .lte('data_vencimento', endOfMonth)

    if (error) throw error

    const contas = (data ?? []).filter(
      cp => nomeFornecedorKey(cp.fornecedor_nome ?? '') === nomeKey,
    )

    if (contas.length === 0) {
      throw new Error(
        'Não há lançamentos em Contas a Pagar para este destinatário neste mês.',
      )
    }

    const somaAtual = roundMoney(
      contas.reduce((acc, c) => acc + (Number(c.valor_parcela) || 0), 0),
    )
    if (Math.abs(alvo - somaAtual) <= EPS) return

    const updatedAt = new Date().toISOString()
    let alocado = 0

    for (let i = 0; i < contas.length; i++) {
      const conta = contas[i]
      const valorAtual = Number(conta.valor_parcela) || 0
      const ehUltima = i === contas.length - 1

      let novoParcela: number
      if (ehUltima) {
        novoParcela = roundMoney(alvo - alocado)
      } else if (somaAtual <= EPS) {
        novoParcela = 0
      } else {
        novoParcela = roundMoney((valorAtual / somaAtual) * alvo)
        alocado = roundMoney(alocado + novoParcela)
      }

      const totalParcelas = Number(conta.total_parcelas) || 1
      const valorPagoAtual = Number(conta.valor_pago) || 0
      const payload: Record<string, unknown> = {
        valor_parcela: novoParcela,
        atualizado_em: updatedAt,
      }

      if (totalParcelas <= 1) {
        payload.valor_total = novoParcela
      }

      if (valorPagoAtual > novoParcela + EPS) {
        payload.valor_pago = novoParcela
        payload.status = novoParcela <= EPS ? 'pendente' : 'pago'
      } else if (
        conta.status === 'parcialmente_pago'
        && valorPagoAtual > 0
        && Math.abs(valorPagoAtual - novoParcela) <= EPS
      ) {
        payload.status = 'pago'
      }

      const { error: updError } = await supabase
        .from('movelaria_contas_pagar')
        .update(payload)
        .eq('id', conta.id)

      if (updError) throw updError
    }

    await load({ silent: true })
  }

  /**
   * Define o total consolidado (reservado ou já pago) do destinatário no mês,
   * inserindo/ajustando/removendo movimentações até a soma bater com o valor desejado.
   */
  const ajustarTotalConsolidado = async ({
    destinatarioId,
    mes: mesRef,
    ano: anoRef,
    tipo,
    novoTotal,
  }: AjustarTotalConsolidadoParams) => {
    if (isCaixaDestinatarioVirtual(destinatarioId)) {
      throw new Error('Cadastre este destinatário em Destinatários antes de editar o valor.')
    }
    if (!Number.isFinite(novoTotal) || novoTotal < 0) {
      throw new Error('Informe um valor válido (zero ou positivo).')
    }

    const alvo = roundMoney(novoTotal)

    const { data: movs, error: fetchError } = await supabase
      .from('movelaria_caixa_movimentacoes')
      .select('id, valor, conta_pagar_id, descricao, criado_em, data_movimentacao')
      .eq('destinatario_id', destinatarioId)
      .eq('mes_referencia', mesRef)
      .eq('ano_referencia', anoRef)
      .eq('tipo_movimentacao', tipo)
      .order('criado_em', { ascending: false })

    if (fetchError) throw fetchError

    const atuais = movs ?? []
    const somaAtual = roundMoney(atuais.reduce((acc, m) => acc + (Number(m.valor) || 0), 0))
    const diff = roundMoney(alvo - somaAtual)

    if (Math.abs(diff) <= EPS) {
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    const descricaoAjuste = rotuloAjuste(tipo)

    if (diff > 0) {
      const { error } = await supabase.from('movelaria_caixa_movimentacoes').insert({
        destinatario_id: destinatarioId,
        tipo_movimentacao: tipo,
        valor: diff,
        data_movimentacao: todayISO(),
        mes_referencia: mesRef,
        ano_referencia: anoRef,
        descricao: descricaoAjuste,
        criado_por: userData.user?.id,
      })
      if (error) throw error
      await load({ silent: true })
      return
    }

    // Reduzir: prioriza ajustes manuais / sem vínculo com conta a pagar
    let restanteReduzir = roundMoney(-diff)
    const ordenadas = [...atuais].sort((a, b) => {
      const aManual = isMovimentacaoAjusteManual(a)
      const bManual = isMovimentacaoAjusteManual(b)
      if (aManual !== bManual) return aManual ? -1 : 1
      const ta = a.criado_em ?? a.data_movimentacao ?? ''
      const tb = b.criado_em ?? b.data_movimentacao ?? ''
      return tb.localeCompare(ta)
    })

    for (const mov of ordenadas) {
      if (restanteReduzir <= EPS) break
      const valorMov = Number(mov.valor) || 0
      if (valorMov <= EPS) continue

      if (valorMov <= restanteReduzir + EPS) {
        const { error } = await supabase
          .from('movelaria_caixa_movimentacoes')
          .delete()
          .eq('id', mov.id)
        if (error) throw error
        restanteReduzir = roundMoney(restanteReduzir - valorMov)
      } else {
        const novoValor = roundMoney(valorMov - restanteReduzir)
        const { error } = await supabase
          .from('movelaria_caixa_movimentacoes')
          .update({ valor: novoValor })
          .eq('id', mov.id)
        if (error) throw error
        restanteReduzir = 0
      }
    }

    if (restanteReduzir > EPS) {
      const { error } = await supabase.from('movelaria_caixa_movimentacoes').insert({
        destinatario_id: destinatarioId,
        tipo_movimentacao: tipo,
        valor: roundMoney(-restanteReduzir),
        data_movimentacao: todayISO(),
        mes_referencia: mesRef,
        ano_referencia: anoRef,
        descricao: descricaoAjuste,
        criado_por: userData.user?.id,
      })
      if (error) throw error
    }

    await load({ silent: true })
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
    desfazerReserva,
    excluirLinhaCaixa,
    excluirMovimentacao,
    ajustarTotalConsolidado,
    listarContasValorReal,
    ajustarValorReal,
    reload: load
  }
}
