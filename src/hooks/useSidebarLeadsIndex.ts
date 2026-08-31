import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { fetchSidebarLeadsIndex } from '@/lib/sidebar-leads-index'

export function useSidebarLeadsIndex(enabled: boolean) {
  const { user } = useAuth()
  const { schemaEmpresa, queriesReady } = useEmpresa()

  return useQuery({
    queryKey: ['sidebar-leads-index', user?.id, schemaEmpresa ?? 'master'],
    queryFn: () => fetchSidebarLeadsIndex(schemaEmpresa),
    enabled: enabled && Boolean(user?.id) && queriesReady,
    staleTime: 60_000,
  })
}
