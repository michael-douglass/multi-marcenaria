import { useCallback, useEffect, useState } from 'react'
import {
  MARKUP_CUSTOS_FILTRO_DEFAULT,
  type MarkupCustosFiltrosPorObra,
} from '@/lib/obra-markup-custos'
import { supabase } from '@/lib/supabase'
import type { MarkupCustosFiltro } from '@/types'

interface MarkupCustosFiltroRow {
  obra_id: string
  incluir_materiais: boolean
  incluir_servicos: boolean
  incluir_despesas: boolean
}

function rowToFiltro(row: MarkupCustosFiltroRow): MarkupCustosFiltro {
  return {
    materiais: row.incluir_materiais !== false,
    servicos: row.incluir_servicos !== false,
    despesas: row.incluir_despesas !== false,
  }
}

function mapRows(rows: MarkupCustosFiltroRow[] | null | undefined): MarkupCustosFiltrosPorObra {
  const out: MarkupCustosFiltrosPorObra = {}
  for (const row of rows ?? []) {
    if (!row?.obra_id) continue
    out[row.obra_id] = rowToFiltro(row)
  }
  return out
}

/**
 * Carrega e grava no banco as categorias Mat./Serv./Desp. por obra.
 * Compartilhado entre Admin/Financeiro (não fica só no navegador).
 */
export function useMarkupCustosFiltrosPorObra(enabled: boolean) {
  const [filtrosPorObra, setFiltrosPorObra] = useState<MarkupCustosFiltrosPorObra>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingObraId, setSavingObraId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setFiltrosPorObra({})
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data, error: qError } = await supabase
        .from('movelaria_obra_markup_custos_filtro')
        .select('obra_id, incluir_materiais, incluir_servicos, incluir_despesas')

      if (qError) throw qError
      setFiltrosPorObra(mapRows(data as MarkupCustosFiltroRow[] | null))
    } catch (e) {
      setFiltrosPorObra({})
      setError(e instanceof Error ? e.message : 'Erro ao carregar filtros de custos.')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  // Outro usuário mudou → atualiza na tela
  useEffect(() => {
    if (!enabled) return

    const channel = supabase
      .channel('movelaria-obra-markup-custos-filtro')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'movelaria_obra_markup_custos_filtro',
        },
        payload => {
          const row = (payload.new ?? payload.old) as Partial<MarkupCustosFiltroRow> | null
          const obraId = row?.obra_id
          if (!obraId) return

          if (payload.eventType === 'DELETE') {
            setFiltrosPorObra(prev => {
              if (!(obraId in prev)) return prev
              const next = { ...prev }
              delete next[obraId]
              return next
            })
            return
          }

          const novo = payload.new as MarkupCustosFiltroRow
          setFiltrosPorObra(prev => ({
            ...prev,
            [obraId]: rowToFiltro(novo),
          }))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled])

  const salvarFiltroObra = useCallback(
    async (obraId: string, filtro: MarkupCustosFiltro) => {
      const next: MarkupCustosFiltro = {
        materiais: filtro.materiais !== false,
        servicos: filtro.servicos !== false,
        despesas: filtro.despesas !== false,
      }

      // Atualiza na hora na tela; se falhar, volta
      let previous: MarkupCustosFiltro | undefined
      setFiltrosPorObra(prev => {
        previous = prev[obraId]
        return { ...prev, [obraId]: next }
      })
      setSavingObraId(obraId)
      setError(null)

      try {
        const { error: rpcError } = await supabase.rpc('movelaria_salvar_obra_markup_custos_filtro', {
          p_obra_id: obraId,
          p_materiais: next.materiais,
          p_servicos: next.servicos,
          p_despesas: next.despesas,
        })
        if (rpcError) throw rpcError
      } catch (e) {
        setFiltrosPorObra(prev => {
          const restored = { ...prev }
          if (previous) restored[obraId] = previous
          else delete restored[obraId]
          return restored
        })
        const msg = e instanceof Error ? e.message : 'Não foi possível salvar o filtro desta obra.'
        setError(msg)
        throw e instanceof Error ? e : new Error(msg)
      } finally {
        setSavingObraId(null)
      }
    },
    [],
  )

  return {
    filtrosPorObra,
    loading,
    error,
    savingObraId,
    salvarFiltroObra,
    reload,
    defaultFiltro: MARKUP_CUSTOS_FILTRO_DEFAULT,
  }
}
