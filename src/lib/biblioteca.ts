import { supabase } from '@/lib/supabase'
import { deleteContaPagarAnexo, getAnexoPreviewSignedUrls } from '@/lib/contas-pagar-anexos'
import type { BibliotecaItem, ContaPagarAnexo } from '@/types'

function anexoKind(row: ContaPagarAnexo): 'image' | 'pdf' {
  if (row.tipo_mime === 'application/pdf' || row.nome_arquivo.toLowerCase().endsWith('.pdf')) {
    return 'pdf'
  }
  return 'image'
}

/** Lista todos os uploads do sistema (hoje: anexos de Contas a Pagar) */
export async function fetchBibliotecaItems(): Promise<BibliotecaItem[]> {
  const { data: anexos, error } = await supabase
    .from('movelaria_contas_pagar_anexos')
    .select('*')
    .order('criado_em', { ascending: false })

  if (error) throw new Error(error.message)
  if (!anexos?.length) return []

  const grupoIds = [...new Set(anexos.map(a => a.grupo_lancamento_id))]

  const { data: lancamentos } = await supabase
    .from('movelaria_contas_pagar')
    .select('grupo_lancamento_id, fornecedor_nome, descricao, observacao')
    .in('grupo_lancamento_id', grupoIds)

  const contextoPorGrupo = new Map<string, string>()
  for (const l of lancamentos ?? []) {
    if (!l.grupo_lancamento_id || contextoPorGrupo.has(l.grupo_lancamento_id)) continue
    const partes = [l.fornecedor_nome, l.descricao, l.observacao].filter(Boolean)
    contextoPorGrupo.set(
      l.grupo_lancamento_id,
      partes.length ? partes.join(' · ') : 'Lançamento manual',
    )
  }

  const items: BibliotecaItem[] = await Promise.all(
    anexos.map(async row => {
      let previewUrls: string[] = []
      try {
        previewUrls = await getAnexoPreviewSignedUrls(row as ContaPagarAnexo)
      } catch {
        // URL failed; item shown without preview
      }
      return {
        id: row.id,
        anexoId: row.id,
        nome_arquivo: row.nome_arquivo,
        tipo_mime: row.tipo_mime,
        kind: anexoKind(row as ContaPagarAnexo),
        previewUrl: previewUrls[0] ?? '',
        previewUrls,
        criado_em: row.criado_em,
        origem: 'contas_pagar',
        grupo_lancamento_id: row.grupo_lancamento_id,
        contexto: contextoPorGrupo.get(row.grupo_lancamento_id),
      }
    }),
  )

  return items
}

export async function removeBibliotecaItemById(anexoId: string): Promise<void> {
  const { data, error } = await supabase
    .from('movelaria_contas_pagar_anexos')
    .select('*')
    .eq('id', anexoId)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Anexo não encontrado')
  await deleteContaPagarAnexo(data as ContaPagarAnexo)
}
