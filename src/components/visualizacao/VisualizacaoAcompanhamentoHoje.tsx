import { EvolucaoPainelGrupos } from '@/components/obras/EvolucaoPainelGrupos'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import type { EvolucaoGrupoObra } from '@/hooks/useObraEvolucao'
import type { Obra } from '@/types'

export function filterEvolucaoGruposPorObras(
  grupos: EvolucaoGrupoObra[],
  obras: Obra[],
): EvolucaoGrupoObra[] {
  const ids = new Set(obras.map(obra => obra.id))
  return grupos.filter(grupo => ids.has(grupo.obra_id))
}

interface VisualizacaoAcompanhamentoHojeProps {
  grupos: EvolucaoGrupoObra[]
  loading: boolean
  error: string | null
  obrasDoDiaCount: number
}

export function VisualizacaoAcompanhamentoHoje({
  grupos,
  loading,
  error,
  obrasDoDiaCount,
}: VisualizacaoAcompanhamentoHojeProps) {
  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <EvolucaoPainelGrupos
      grupos={grupos}
      emptyMessage="Nenhuma foto das obras de hoje"
      emptySubmessage={
        obrasDoDiaCount === 0
          ? 'Não há obras agendadas para hoje.'
          : 'As obras de hoje ainda não receberam fotos dos montadores.'
      }
    />
  )
}
