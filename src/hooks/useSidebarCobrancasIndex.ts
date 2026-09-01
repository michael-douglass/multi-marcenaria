import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { fetchSidebarCobrancasIndex } from '@/lib/sidebar-cobrancas-index'

export function useSidebarCobrancasIndex(enabled: boolean) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['sidebar-cobrancas-index', user?.id],
    queryFn: fetchSidebarCobrancasIndex,
    enabled: enabled && Boolean(user?.id),
    staleTime: 60_000,
  })
}
