import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthReady } from './useAuthReady'
import type { TemplateCobranca } from '../lib/processarTemplate'

export type { TemplateCobranca }

export const TEMPLATE_PADRAO: TemplateCobranca = {
  id: '__default__',
  nome: 'Padrão',
  ordem: 0,
  conteudo: `Olá {{nome_cliente}}, tudo bem? 😊

Passando para lembrar que sua parcela {{numero_parcela}}/{{total_parcelas}} de {{mes_referencia}}/{{ano_referencia}} vence em *{{data_vencimento}}*.

💰 Valor: *{{valor_fatura}}*
{{descricao_cobranca}}

Para pagar via PIX, copie o código abaixo:
{{pix_copia_cola}}

Qualquer dúvida, estamos à disposição!
*GARBO Movelaria* 🪵`,
}

export function useTemplatesCobranca() {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<TemplateCobranca[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('movelaria_fin_templates_copia')
      .select('id, nome, conteudo, ordem')
      .eq('ativo', true)
      .order('ordem', { ascending: true })
    if (err) {
      setError(err.message)
    } else {
      setData(rows ?? [])
      setError(null)
    }
    setLoading(false)
  }, [isReady])

  useEffect(() => { load() }, [load])

  const templates: TemplateCobranca[] = data.length > 0 ? data : [TEMPLATE_PADRAO]

  const criar = async (input: { nome: string; conteudo: string; ordem: number }) => {
    const { data: row, error: err } = await supabase
      .from('movelaria_fin_templates_copia')
      .insert(input)
      .select('id, nome, conteudo, ordem')
      .single()
    if (err) throw new Error(err.message)
    setData(prev => [...prev, row])
    return row as TemplateCobranca
  }

  const editar = async (id: string, input: { nome: string; conteudo: string; ordem: number }) => {
    const { data: row, error: err } = await supabase
      .from('movelaria_fin_templates_copia')
      .update({ ...input, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select('id, nome, conteudo, ordem')
      .single()
    if (err) throw new Error(err.message)
    setData(prev => prev.map(t => (t.id === id ? (row as TemplateCobranca) : t)))
  }

  const excluir = async (id: string) => {
    const { error: err } = await supabase
      .from('movelaria_fin_templates_copia')
      .update({ ativo: false, atualizado_em: new Date().toISOString() })
      .eq('id', id)
    if (err) throw new Error(err.message)
    setData(prev => prev.filter(t => t.id !== id))
  }

  return { templates, data, loading, error, criar, editar, excluir, reload: load }
}
