import { supabase } from '@/lib/supabase'
import { resolveLeadsQueryConfig } from '@/lib/empresa-tables'
import type { SidebarLeadIndexRow } from '@/lib/sidebar-search'

const PAGE_SIZE = 1000

/** Só id, nome e telefone — para achar o lead no menu sem carregar o card inteiro. */
export async function fetchSidebarLeadsIndex(
  schemaEmpresa?: string | null,
): Promise<SidebarLeadIndexRow[]> {
  const config = resolveLeadsQueryConfig(schemaEmpresa)
  const db = config.schema ? supabase.schema(config.schema) : supabase
  const rows: SidebarLeadIndexRow[] = []
  let from = 0

  while (true) {
    const { data, error } = await db
      .from(config.leadsTable)
      .select('id, nome, telefone')
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(error.message)
    if (!data?.length) break

    for (const row of data) {
      const id = Number((row as { id?: unknown }).id)
      if (!Number.isFinite(id)) continue
      rows.push({
        id,
        nome: String((row as { nome?: unknown }).nome ?? ''),
        telefone: (row as { telefone?: string | null }).telefone
          ? String((row as { telefone: string }).telefone)
          : null,
      })
    }

    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}
