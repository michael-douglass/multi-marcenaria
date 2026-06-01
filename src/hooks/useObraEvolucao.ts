import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  listObraEvolucao, uploadObraEvolucao, deleteObraEvolucao, addEvolucaoUrls,
  type ObraEvolucaoItem, type EvolucaoPainelItem, type EvolucaoPainelItemComUrl,
} from '../lib/obra-evolucao'
import type { EvolucaoItemComUrl } from '../lib/obra-evolucao'
import { useAuthReady } from './useAuthReady'

// ── Hook para modal de detalhe (por obra) ────────────────────
export function useObraEvolucao(obraId: string | null) {
  const [data, setData] = useState<EvolucaoItemComUrl[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    if (!obraId) { setData([]); return }
    setLoading(true)
    try {
      const items = await listObraEvolucao(obraId)
      const comUrls = await addEvolucaoUrls(items)
      setData(comUrls)
    } catch { setData([]) } finally { setLoading(false) }
  }, [obraId])

  useEffect(() => { void load() }, [load])

  const upload = async (file: File) => {
    if (!obraId) return
    setUploading(true)
    try {
      await uploadObraEvolucao(obraId, file)
      await load()
    } finally { setUploading(false) }
  }

  const remove = async (item: ObraEvolucaoItem) => {
    await deleteObraEvolucao(item)
    setData(prev => prev.filter(x => x.id !== item.id))
  }

  return { data, loading, uploading, upload, remove, reload: load }
}

// ── Hook para painel geral (por período) ─────────────────────
export type FiltroPeriodo = 'hoje' | 'semana' | 'mes'

function getPeriodo(filtro: FiltroPeriodo): { inicio: string; fim: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const toISO = (d: Date) => d.toISOString()

  if (filtro === 'hoje') {
    const inicio = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const fim    = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    return { inicio: toISO(inicio), fim: toISO(fim) }
  }
  if (filtro === 'semana') {
    const dow   = now.getDay()
    const mon   = new Date(now); mon.setDate(now.getDate() - dow); mon.setHours(0, 0, 0, 0)
    const sun   = new Date(mon); sun.setDate(mon.getDate() + 6);   sun.setHours(23, 59, 59, 999)
    return { inicio: toISO(mon), fim: toISO(sun) }
  }
  // mês
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
  const fim    = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  return { inicio: toISO(inicio), fim: toISO(fim) }
}

export interface EvolucaoGrupoObra {
  obra_id: string
  obra_nome: string
  dias: {
    data: string      // YYYY-MM-DD
    fotos: EvolucaoPainelItemComUrl[]
  }[]
}

export function useEvolucaoPainel(filtro: FiltroPeriodo) {
  const { isReady } = useAuthReady()
  const [raw, setRaw] = useState<EvolucaoPainelItemComUrl[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      const { inicio, fim } = getPeriodo(filtro)
      const { data: rows, error: err } = await supabase.rpc('movelaria_painel_evolucao', {
        p_inicio: inicio,
        p_fim: fim,
      })
      if (err) throw err
      const items = (rows ?? []) as EvolucaoPainelItem[]
      const comUrls = await addEvolucaoUrls(items) as EvolucaoPainelItemComUrl[]
      setRaw(comUrls)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar evolução.')
    } finally { setLoading(false) }
  }, [isReady, filtro])

  useEffect(() => { void load() }, [load])

  // Agrupa por obra e depois por dia
  const grupos: EvolucaoGrupoObra[] = []
  const obraMap = new Map<string, EvolucaoGrupoObra>()

  for (const foto of raw) {
    if (!obraMap.has(foto.obra_id)) {
      const g: EvolucaoGrupoObra = { obra_id: foto.obra_id, obra_nome: foto.obra_nome, dias: [] }
      obraMap.set(foto.obra_id, g)
      grupos.push(g)
    }
    const grupo = obraMap.get(foto.obra_id)!
    const dia = foto.tirado_em.slice(0, 10)
    let diaEntry = grupo.dias.find(d => d.data === dia)
    if (!diaEntry) { diaEntry = { data: dia, fotos: [] }; grupo.dias.push(diaEntry) }
    diaEntry.fotos.push(foto)
  }

  return { grupos, loading, error, reload: load }
}
