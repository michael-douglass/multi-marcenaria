import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  deleteBriefingAnexo,
  enrichBriefingAnexos,
  uploadBriefingAnexo,
  type PendingBriefingAnexo,
} from '@/lib/briefing-storage'
import type {
  BriefingPergunta,
  BriefingStatus,
  ObraBriefing,
  ObraBriefingAnexo,
  ObraBriefingResposta,
} from '@/types'
import { useAuthReady } from './useAuthReady'

export interface BriefingRespostaDraft {
  pergunta_id: string
  valor_texto?: string | null
  valor_numero?: number | null
  unidade?: string | null
  valor_opcoes?: string[] | null
}

function countAnswered(perguntas: BriefingPergunta[], respostas: ObraBriefingResposta[]): number {
  const byPergunta = new Map(respostas.map(r => [r.pergunta_id, r]))
  return perguntas.filter(p => {
    if (!p.ativo) return false
    const r = byPergunta.get(p.id)
    if (!r) return false
    if (p.tipo === 'texto') return !!r.valor_texto?.trim()
    if (p.tipo === 'numero') return r.valor_numero != null
    if (p.tipo === 'multipla_escolha') return (r.valor_opcoes?.length ?? 0) > 0
    if (['fotos', 'videos', 'pdf', 'desenho'].includes(p.tipo)) return (r.anexos?.length ?? 0) > 0
    return false
  }).length
}

export function getBriefingProgress(briefing: ObraBriefing): { answered: number; total: number } {
  const perguntas = (briefing.perguntas ?? []).filter(p => p.ativo)
  const respostas = briefing.respostas ?? []
  return { answered: countAnswered(perguntas, respostas), total: perguntas.length }
}

export function useObraBriefing(obraId: string | null | undefined) {
  const { isReady, userId } = useAuthReady()
  const [briefings, setBriefings] = useState<ObraBriefing[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!isReady || !obraId) {
      setBriefings([])
      return
    }
    setLoading(true)
    try {
      const { data: rows, error } = await supabase
        .from('movelaria_obra_briefings')
        .select(`
          *,
          modelo:movelaria_briefing_modelos(id, nome, descricao, ordem, ativo)
        `)
        .eq('obra_id', obraId)
        .order('criado_em')
      if (error) throw new Error(error.message)

      const modeloIds = [...new Set((rows ?? []).map((r: { modelo_id: string }) => r.modelo_id))]
      let perguntas: BriefingPergunta[] = []
      if (modeloIds.length) {
        const { data: pRows, error: pErr } = await supabase
          .from('movelaria_briefing_perguntas')
          .select('*')
          .in('modelo_id', modeloIds)
          .eq('ativo', true)
          .order('ordem')
        if (pErr) throw new Error(pErr.message)
        perguntas = (pRows ?? []) as BriefingPergunta[]
      }

      const briefingIds = (rows ?? []).map((r: { id: string }) => r.id)
      let respostas: ObraBriefingResposta[] = []
      if (briefingIds.length) {
        const { data: rRows, error: rErr } = await supabase
          .from('movelaria_obra_briefing_respostas')
          .select('*')
          .in('obra_briefing_id', briefingIds)
        if (rErr) throw new Error(rErr.message)
        respostas = (rRows ?? []) as ObraBriefingResposta[]
      }

      const respostaIds = respostas.map(r => r.id)
      let anexos: ObraBriefingAnexo[] = []
      if (respostaIds.length) {
        const { data: aRows, error: aErr } = await supabase
          .from('movelaria_obra_briefing_anexos')
          .select('*')
          .in('resposta_id', respostaIds)
          .order('ordem')
        if (aErr) throw new Error(aErr.message)
        anexos = await enrichBriefingAnexos((aRows ?? []) as ObraBriefingAnexo[])
      }

      const anexosByResposta = new Map<string, ObraBriefingAnexo[]>()
      for (const a of anexos) {
        const list = anexosByResposta.get(a.resposta_id) ?? []
        list.push(a)
        anexosByResposta.set(a.resposta_id, list)
      }

      const respostasByBriefing = new Map<string, ObraBriefingResposta[]>()
      for (const r of respostas) {
        const enriched = { ...r, anexos: anexosByResposta.get(r.id) ?? [] }
        const list = respostasByBriefing.get(r.obra_briefing_id) ?? []
        list.push(enriched)
        respostasByBriefing.set(r.obra_briefing_id, list)
      }

      const perguntasByModelo = new Map<string, BriefingPergunta[]>()
      for (const p of perguntas) {
        const list = perguntasByModelo.get(p.modelo_id) ?? []
        list.push(p)
        perguntasByModelo.set(p.modelo_id, list)
      }

      setBriefings(
        (rows ?? []).map((row: Record<string, unknown>) => {
          const modelo = row.modelo as { nome: string } | null
          const modeloId = row.modelo_id as string
          const id = row.id as string
          return {
            ...(row as ObraBriefing),
            modelo_nome: modelo?.nome,
            perguntas: perguntasByModelo.get(modeloId) ?? [],
            respostas: respostasByBriefing.get(id) ?? [],
          }
        }),
      )
    } finally {
      setLoading(false)
    }
  }, [isReady, obraId])

  useEffect(() => { void load() }, [load])

  const linkModelos = async (modeloIds: string[]) => {
    if (!obraId) return
    const currentIds = new Set(briefings.map(b => b.modelo_id))
    const targetIds = new Set(modeloIds)

    const toAdd = modeloIds.filter(id => !currentIds.has(id))
    const toRemove = briefings.filter(b => !targetIds.has(b.modelo_id))

    for (const b of toRemove) {
      const { error } = await supabase.from('movelaria_obra_briefings').delete().eq('id', b.id)
      if (error) throw new Error(error.message)
    }

    if (toAdd.length) {
      const { error } = await supabase.from('movelaria_obra_briefings').insert(
        toAdd.map(modelo_id => ({ obra_id: obraId, modelo_id, status: 'rascunho' as BriefingStatus })),
      )
      if (error) throw new Error(error.message)
    }

    await load()
  }

  const upsertResposta = async (
    obraBriefingId: string,
    draft: BriefingRespostaDraft,
  ): Promise<ObraBriefingResposta> => {
    const existing = briefings
      .find(b => b.id === obraBriefingId)
      ?.respostas?.find(r => r.pergunta_id === draft.pergunta_id)

    if (existing) {
      const { data, error } = await supabase
        .from('movelaria_obra_briefing_respostas')
        .update({
          valor_texto: draft.valor_texto ?? null,
          valor_numero: draft.valor_numero ?? null,
          unidade: draft.unidade ?? null,
          valor_opcoes: draft.valor_opcoes ?? null,
        })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      await load()
      return data as ObraBriefingResposta
    }

    const { data, error } = await supabase
      .from('movelaria_obra_briefing_respostas')
      .insert({
        obra_briefing_id: obraBriefingId,
        pergunta_id: draft.pergunta_id,
        valor_texto: draft.valor_texto ?? null,
        valor_numero: draft.valor_numero ?? null,
        unidade: draft.unidade ?? null,
        valor_opcoes: draft.valor_opcoes ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    await load()
    return data as ObraBriefingResposta
  }

  const ensureResposta = async (obraBriefingId: string, perguntaId: string): Promise<string> => {
    const existing = briefings
      .find(b => b.id === obraBriefingId)
      ?.respostas?.find(r => r.pergunta_id === perguntaId)
    if (existing) return existing.id

    const row = await upsertResposta(obraBriefingId, { pergunta_id: perguntaId })
    return row.id
  }

  const uploadAnexo = async (
    obraBriefingId: string,
    perguntaId: string,
    pending: PendingBriefingAnexo,
  ) => {
    if (!obraId) throw new Error('Obra não informada')
    const respostaId = await ensureResposta(obraBriefingId, perguntaId)
    const ordem = briefings
      .find(b => b.id === obraBriefingId)
      ?.respostas?.find(r => r.id === respostaId)
      ?.anexos?.length ?? 0
    await uploadBriefingAnexo(obraId, obraBriefingId, respostaId, pending, ordem)
    await load()
  }

  const removeAnexo = async (anexo: ObraBriefingAnexo) => {
    await deleteBriefingAnexo(anexo)
    await load()
  }

  const setStatus = async (obraBriefingId: string, status: BriefingStatus) => {
    const { error } = await supabase
      .from('movelaria_obra_briefings')
      .update({
        status,
        preenchido_por: userId ?? null,
      })
      .eq('id', obraBriefingId)
    if (error) throw new Error(error.message)
    await load()
  }

  return {
    briefings,
    loading,
    reload: load,
    linkModelos,
    upsertResposta,
    uploadAnexo,
    removeAnexo,
    setStatus,
    getBriefingProgress,
  }
}

export function useBriefingAutosave(
  saveFn: () => Promise<void>,
  deps: unknown[],
  enabled: boolean,
  delayMs = 2000,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (savingRef.current) return
      savingRef.current = true
      void saveFn().finally(() => { savingRef.current = false })
    }, delayMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
