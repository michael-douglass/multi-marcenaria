import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthReady } from '@/hooks/useAuthReady'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import {
  EMPTY_MKT_BOOT,
  parseGastosBoot,
  parseMarketingBoot,
  parseMarketingMedias,
  type MktBoot,
  type MktFonte,
  type MktGastoColuna,
  type MktLancamento,
  type MktMedia,
  type MktSubFonte,
} from '@/lib/crm-marketing'
import { withTimeout } from '@/lib/with-timeout'

export function useCrmMarketing(enabled = true) {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<MktBoot>(EMPTY_MKT_BOOT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isReady || !enabled) return
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const { data: raw, error: err } = await supabase.rpc('movelaria_crm_marketing_boot')
      if (err) throw err
      setData(parseMarketingBoot(raw))
    } catch (err) {
      if (!opts?.silent) setError(err instanceof Error ? err.message : 'Erro ao abrir o marketing.')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [isReady, enabled])

  useEffect(() => { void load() }, [load])
  useAutoRefresh(() => { void load({ silent: true }) })

  const salvarColuna = async (id: string | null, nome: string) => {
    const { error: err } = await supabase.rpc('movelaria_crm_marketing_salvar_coluna', {
      p_id: id,
      p_nome: nome,
    })
    if (err) throw new Error(err.message)
    await load({ silent: true })
  }

  const salvarCard = async (input: { id: string | null; titulo: string; scriptCopy: string; columnId: string; urgente?: boolean }) => {
    const { error: err } = await supabase.rpc('movelaria_crm_marketing_salvar_card', {
      p_id: input.id,
      p_titulo: input.titulo,
      p_script_copy: input.scriptCopy,
      p_column_id: input.columnId,
      p_urgente: input.urgente ?? false,
    })
    if (err) throw new Error(err.message)
    await load({ silent: true })
  }

  const moverCard = async (id: string, columnId: string) => {
    const { error: err } = await supabase.rpc('movelaria_crm_marketing_mover_card', {
      p_id: id,
      p_column_id: columnId,
    })
    if (err) throw new Error(err.message)
    setData(prev => ({
      ...prev,
      cards: prev.cards.map(c => c.id === id ? { ...c, columnId } : c),
    }))
  }

  const excluirCard = async (id: string) => {
    const { error: err } = await supabase.rpc('movelaria_crm_marketing_excluir_card', { p_id: id })
    if (err) throw new Error(err.message)
    await load({ silent: true })
  }

  const salvarTarefa = async (input: { id: string | null; titulo: string; data: string; status?: string }) => {
    const { error: err } = await supabase.rpc('movelaria_crm_marketing_salvar_tarefa', {
      p_id: input.id,
      p_titulo: input.titulo,
      p_data: input.data,
      p_status: input.status ?? 'pendente',
    })
    if (err) throw new Error(err.message)
    await load({ silent: true })
  }

  const salvarNode = async (input: { id: string | null; titulo: string; conteudo: string }) => {
    const { error: err } = await supabase.rpc('movelaria_crm_marketing_salvar_node', {
      p_id: input.id,
      p_titulo: input.titulo,
      p_conteudo: input.conteudo,
    })
    if (err) throw new Error(err.message)
    await load({ silent: true })
  }

  return { data, loading, error, reload: load, salvarColuna, salvarCard, moverCard, excluirCard, salvarTarefa, salvarNode }
}

export function useCrmMarketingMedias() {
  const { isReady } = useAuthReady()
  const [items, setItems] = useState<MktMedia[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [semPasta, setSemPasta] = useState(false)
  const [busca, setBusca] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 48

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    try {
      const { data: raw, error: err } = await supabase.rpc('movelaria_crm_marketing_medias', {
        p_folder_id: semPasta ? null : folderId,
        p_busca: busca,
        p_limit: limit,
        p_offset: offset,
        p_sem_pasta: semPasta,
      })
      if (err) throw err
      const parsed = parseMarketingMedias(raw)
      setItems(parsed.items)
      setTotal(parsed.total)
    } finally {
      setLoading(false)
    }
  }, [isReady, folderId, semPasta, busca, offset])

  useEffect(() => { void load() }, [load])

  return {
    items, total, loading, folderId, setFolderId, semPasta, setSemPasta, busca, setBusca, offset, setOffset, limit, reload: load,
  }
}

export function useCrmGastos(enabled = true) {
  const { isReady } = useAuthReady()
  const [fontes, setFontes] = useState<MktFonte[]>([])
  const [subFontes, setSubFontes] = useState<MktSubFonte[]>([])
  const [colunas, setColunas] = useState<MktGastoColuna[]>([])
  const [lancamentos, setLancamentos] = useState<MktLancamento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isReady || !enabled) return
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const { data: raw, error: err } = await supabase.rpc('movelaria_crm_gastos_boot')
      if (err) throw err
      const parsed = parseGastosBoot(raw)
      setFontes(parsed.fontes)
      setSubFontes(parsed.subFontes)
      setColunas(parsed.colunas)
      setLancamentos(parsed.lancamentos)
    } catch (err) {
      if (!opts?.silent) setError(err instanceof Error ? err.message : 'Erro ao abrir os gastos.')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [isReady, enabled])

  useEffect(() => { void load() }, [load])

  const salvarFonte = async (id: string | null, nome: string) => {
    const { error: err } = await supabase.rpc('movelaria_crm_gastos_salvar_fonte', { p_id: id, p_nome: nome })
    if (err) throw new Error(err.message)
    await load({ silent: true })
  }

  const salvarSubfonte = async (id: string | null, fonteId: string, nome: string) => {
    const { error: err } = await supabase.rpc('movelaria_crm_gastos_salvar_subfonte', {
      p_id: id, p_fonte_id: fonteId, p_nome: nome,
    })
    if (err) throw new Error(err.message)
    await load({ silent: true })
  }

  const salvarLancamento = async (input: { id: string | null; colunaId: string; data: string; valor: number; observacao: string }) => {
    const { error: err } = await supabase.rpc('movelaria_crm_gastos_salvar_lancamento', {
      p_id: input.id,
      p_coluna_id: input.colunaId,
      p_data: input.data,
      p_valor: input.valor,
      p_observacao: input.observacao,
    })
    if (err) throw new Error(err.message)
    await load({ silent: true })
  }

  return { fontes, subFontes, colunas, lancamentos, loading, error, salvarFonte, salvarSubfonte, salvarLancamento }
}

export function useCrmPontuaAdmin(enabled = true) {
  const { isReady } = useAuthReady()
  const [prestadores, setPrestadores] = useState<Array<{ id: string; nome: string; email: string | null; titulo: string }>>([])
  const [saques, setSaques] = useState<Array<{
    id: string
    prestadorId: string
    valor: number
    chavePix: string
    status: string
    criadoEm: string | null
  }>>([])
  const [liberacoes, setLiberacoes] = useState<Array<{ id: string; leadId: number; prestadorId: string; status: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady || !enabled) return
    setLoading(true)
    setError(null)
    try {
      const { data: raw, error: err } = await withTimeout(
        12_000,
        'O Pontua demorou demais. Tente de novo.',
        () => supabase.rpc('movelaria_crm_pontua_admin_boot'),
      )
      if (err) throw err
      const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
      setPrestadores(Array.isArray(data.prestadores)
        ? data.prestadores.map(item => {
            const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
            return {
              id: String(row.id ?? ''),
              nome: String(row.nome ?? ''),
              email: typeof row.email === 'string' ? row.email : null,
              titulo: String(row.titulo ?? 'Parceiro'),
            }
          }).filter(p => p.id)
        : [])
      setSaques(Array.isArray(data.saques)
        ? data.saques.map(item => {
            const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
            return {
              id: String(row.id ?? ''),
              prestadorId: String(row.prestador_id ?? ''),
              valor: Number(row.valor_solicitado) || 0,
              chavePix: String(row.chave_pix ?? ''),
              status: String(row.status ?? ''),
              criadoEm: typeof row.criado_em === 'string' ? row.criado_em : null,
            }
          }).filter(s => s.id)
        : [])
      setLiberacoes(Array.isArray(data.liberacoes)
        ? data.liberacoes.map(item => {
            const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
            return {
              id: String(row.id ?? ''),
              leadId: Number(row.lead_id) || 0,
              prestadorId: String(row.prestador_id ?? ''),
              status: String(row.status ?? ''),
            }
          }).filter(l => l.id)
        : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao abrir o Pontua.')
    } finally {
      setLoading(false)
    }
  }, [isReady, enabled])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    void load()
  }, [enabled, load])

  const aprovarSaque = async (id: string) => {
    const { error: err } = await supabase.rpc('movelaria_crm_pontua_aprovar_saque', { p_id: id })
    if (err) throw new Error(err.message)
    await load()
  }

  const rejeitarSaque = async (id: string) => {
    const { error: err } = await supabase.rpc('movelaria_crm_pontua_rejeitar_saque', { p_id: id, p_obs: null })
    if (err) throw new Error(err.message)
    await load()
  }

  const liberarComissao = async (id: string) => {
    const { error: err } = await supabase.rpc('movelaria_crm_pontua_liberar_comissao', { p_id: id })
    if (err) throw new Error(err.message)
    await load()
  }

  return { prestadores, saques, liberacoes, loading, error, aprovarSaque, rejeitarSaque, liberarComissao }
}

export function useCrmAutomacoes(enabled = true) {
  const { isReady } = useAuthReady()
  const [atalhos, setAtalhos] = useState<Array<{ id: number; titulo: string; mensagem: string }>>([])
  const [negativados, setNegativados] = useState<Array<{ id: number; telefone: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady || !enabled) return
    setLoading(true)
    setError(null)
    try {
      const { data: raw, error: err } = await supabase.rpc('movelaria_crm_automacoes_boot')
      if (err) throw err
      const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
      setAtalhos(Array.isArray(data.atalhos)
        ? data.atalhos.map(item => {
            const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
            return { id: Number(row.id) || 0, titulo: String(row.titulo ?? ''), mensagem: String(row.mensagem ?? '') }
          }).filter(a => a.id)
        : [])
      setNegativados(Array.isArray(data.negativados)
        ? data.negativados.map(item => {
            const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
            return { id: Number(row.id) || 0, telefone: String(row.telefone ?? '') }
          }).filter(n => n.id)
        : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao abrir automações.')
    } finally {
      setLoading(false)
    }
  }, [isReady, enabled])

  useEffect(() => { void load() }, [load])

  const salvarAtalho = async (id: number | null, titulo: string, mensagem: string) => {
    const { error: err } = await supabase.rpc('movelaria_crm_automacoes_salvar_atalho', {
      p_id: id,
      p_titulo: titulo,
      p_mensagem: mensagem,
    })
    if (err) throw new Error(err.message)
    await load()
  }

  const salvarNegativado = async (telefone: number) => {
    const { error: err } = await supabase.rpc('movelaria_crm_automacoes_salvar_negativado', { p_telefone: telefone })
    if (err) throw new Error(err.message)
    await load()
  }

  return { atalhos, negativados, loading, error, salvarAtalho, salvarNegativado }
}
