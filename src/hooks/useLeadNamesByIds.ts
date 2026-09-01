import { useQuery } from '@tanstack/react-query'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase'

const PUBLIC_LEADS = 'CRM-multi-empresas>leads<' as const

/** Nomes dos clientes para agrupar as gavetas na Biblioteca. */
export function useLeadNamesByIds(ids: number[]) {
  const { schemaEmpresa, queriesReady } = useEmpresa()
  const db = useEmpresaSupabase()
  const table = useTableName()
  const leadsTable = table('leads', PUBLIC_LEADS)
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id)))]

  return useQuery({
    queryKey: ['biblioteca-lead-names', schemaEmpresa ?? 'master', unique.join(',')],
    enabled: queriesReady && unique.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<number, string>> => {
      const map: Record<number, string> = {}
      for (let i = 0; i < unique.length; i += 100) {
        const batch = unique.slice(i, i + 100)
        const { data, error } = await db.from(leadsTable).select('id, nome').in('id', batch)
        if (error) throw error
        for (const row of data ?? []) {
          const id = Number((row as { id: number }).id)
          const nome = String((row as { nome?: string }).nome ?? '').trim()
          if (id) map[id] = nome || `Lead ${id}`
        }
      }
      return map
    },
  })
}
