import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { BRIEFING_SEED_MODELOS } from '@/lib/briefing-seed-data'
import type { BriefingModelo, BriefingModeloInput, BriefingPergunta, BriefingPerguntaInput } from '@/types'
import { useAuthReady } from './useAuthReady'

let seedingPromise: Promise<void> | null = null

async function seedBriefingModelosIfEmpty(): Promise<void> {
  const { count, error: countError } = await supabase
    .from('movelaria_briefing_modelos')
    .select('id', { count: 'exact', head: true })
  if (countError) throw new Error(countError.message)
  if ((count ?? 0) > 0) return

  for (const modelo of BRIEFING_SEED_MODELOS) {
    const { data: inserted, error } = await supabase
      .from('movelaria_briefing_modelos')
      .insert({
        nome: modelo.nome,
        descricao: modelo.descricao ?? null,
        ordem: modelo.ordem,
        ativo: true,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)

    const perguntas = modelo.perguntas.map((p, idx) => ({
      modelo_id: inserted.id,
      enunciado: p.enunciado,
      tipo: p.tipo,
      opcoes: p.opcoes ?? null,
      obrigatoria: p.obrigatoria ?? false,
      texto_ajuda: p.texto_ajuda ?? null,
      unidade_padrao: p.unidade_padrao ?? null,
      ordem: idx + 1,
      ativo: true,
    }))
    const { error: pErr } = await supabase.from('movelaria_briefing_perguntas').insert(perguntas)
    if (pErr) throw new Error(pErr.message)
  }
}

async function runSeedIfNeeded(): Promise<void> {
  try {
    await seedBriefingModelosIfEmpty()
  } catch (err) {
    seedingPromise = null
    throw err
  }
}

type ModeloRow = BriefingModelo & {
  movelaria_briefing_perguntas?: BriefingPergunta[]
}

export function useBriefingModelos() {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<BriefingModelo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) {
      setLoading(true)
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (!seedingPromise) {
        seedingPromise = runSeedIfNeeded()
      }
      await seedingPromise

      const { data: modelos, error: modelosError } = await supabase
        .from('movelaria_briefing_modelos')
        .select('*, movelaria_briefing_perguntas(*)')
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true })

      if (modelosError) throw new Error(modelosError.message)

      setData(
        ((modelos ?? []) as ModeloRow[]).map((modelo) => {
          const { movelaria_briefing_perguntas, ...rest } = modelo
          return {
            ...rest,
            perguntas: [...(movelaria_briefing_perguntas ?? [])].sort((a, b) => a.ordem - b.ordem),
          }
        }),
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível carregar os briefings.'
      setError(message)
      console.error('[useBriefingModelos]', err)
    } finally {
      setLoading(false)
    }
  }, [isReady])

  useEffect(() => { void load() }, [load])

  const create = async (input: BriefingModeloInput) => {
    const { data: row, error } = await supabase
      .from('movelaria_briefing_modelos')
      .insert(input)
      .select()
      .single()
    if (error) throw new Error(error.message)
    await load()
    return row as BriefingModelo
  }

  const update = async (id: string, input: Partial<BriefingModeloInput>) => {
    const { data, error } = await supabase
      .from('movelaria_briefing_modelos')
      .update(input)
      .eq('id', id)
      .select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) {
      throw new Error('Sem permissão para editar este ambiente de briefing.')
    }
    await load()
  }

  const remove = async (id: string) => {
    const { data, error } = await supabase
      .from('movelaria_briefing_modelos')
      .delete()
      .eq('id', id)
      .select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) {
      throw new Error('Sem permissão para excluir este ambiente de briefing.')
    }
    setData(prev => prev.filter(m => m.id !== id))
  }

  const duplicate = async (modelo: BriefingModelo) => {
    const novo = await create({
      nome: `${modelo.nome} (cópia)`,
      descricao: modelo.descricao ?? null,
      ordem: modelo.ordem + 1,
      ativo: true,
    })
    const perguntas = (modelo.perguntas ?? []).map(p => ({
      modelo_id: novo.id,
      enunciado: p.enunciado,
      tipo: p.tipo,
      opcoes: p.opcoes ?? null,
      obrigatoria: p.obrigatoria,
      texto_ajuda: p.texto_ajuda ?? null,
      unidade_padrao: p.unidade_padrao ?? null,
      ordem: p.ordem,
      ativo: p.ativo,
    }))
    if (perguntas.length) {
      const { error } = await supabase.from('movelaria_briefing_perguntas').insert(perguntas)
      if (error) throw new Error(error.message)
    }
    await load()
    return novo
  }

  const createPergunta = async (input: BriefingPerguntaInput) => {
    const { data, error } = await supabase
      .from('movelaria_briefing_perguntas')
      .insert(input)
      .select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) {
      throw new Error('Sem permissão para adicionar perguntas ao briefing.')
    }
    await load()
  }

  const updatePergunta = async (id: string, input: Partial<BriefingPerguntaInput>) => {
    const { data, error } = await supabase
      .from('movelaria_briefing_perguntas')
      .update(input)
      .eq('id', id)
      .select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) {
      throw new Error('Sem permissão para editar esta pergunta do briefing.')
    }
    await load()
  }

  const removePergunta = async (id: string) => {
    const { data, error } = await supabase
      .from('movelaria_briefing_perguntas')
      .delete()
      .eq('id', id)
      .select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) {
      throw new Error('Sem permissão para excluir esta pergunta do briefing.')
    }
    await load()
  }

  const reorderPerguntas = async (modeloId: string, orderedIds: string[]) => {
    const results = await Promise.all(
      orderedIds.map((id, idx) =>
        supabase
          .from('movelaria_briefing_perguntas')
          .update({ ordem: idx + 1 })
          .eq('id', id)
          .eq('modelo_id', modeloId)
          .select('id'),
      ),
    )
    for (const result of results) {
      if (result.error) throw new Error(result.error.message)
      if (!result.data?.length) {
        throw new Error('Sem permissão para reordenar perguntas do briefing.')
      }
    }
    await load()
  }

  return {
    data,
    loading,
    error,
    create,
    update,
    remove,
    duplicate,
    createPergunta,
    updatePergunta,
    removePergunta,
    reorderPerguntas,
    reload: load,
  }
}
