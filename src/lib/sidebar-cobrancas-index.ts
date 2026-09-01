import { supabase } from '@/lib/supabase'
import type { SidebarCobrancaIndexRow } from '@/lib/sidebar-search'

const PAGE_SIZE = 1000

/** Só nome, telefone e lead de origem — para achar o cliente no menu sem carregar a cobrança inteira. */
export async function fetchSidebarCobrancasIndex(): Promise<SidebarCobrancaIndexRow[]> {
  const rows: SidebarCobrancaIndexRow[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('movelaria_contas_receber')
      .select('id, cliente_nome, origem_lead_id, movelaria_clientes(telefone)')
      .order('criado_em', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(error.message)
    if (!data?.length) break

    for (const row of data) {
      const raw = row as {
        id?: unknown
        cliente_nome?: unknown
        origem_lead_id?: string | null
        movelaria_clientes?: { telefone?: string | null } | { telefone?: string | null }[] | null
      }
      const id = String(raw.id ?? '')
      if (!id) continue
      const clienteRel = Array.isArray(raw.movelaria_clientes)
        ? raw.movelaria_clientes[0]
        : raw.movelaria_clientes
      rows.push({
        id,
        cliente_nome: String(raw.cliente_nome ?? ''),
        cliente_telefone: clienteRel?.telefone ? String(clienteRel.telefone) : null,
        origem_lead_id: raw.origem_lead_id ? String(raw.origem_lead_id) : null,
      })
    }

    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}
