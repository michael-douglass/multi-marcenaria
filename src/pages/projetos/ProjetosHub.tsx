import { lazy, Suspense, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { EmptyState, LoadingState } from '@/components/ui/EmptyState'
import { ProjetosSetorTabs } from '@/components/projetos-hub/ProjetosSetorTabs'
import { useApp } from '@/context/AppContext'
import { canAccessProjetosBoard, isCrmAdmin } from '@/lib/crm-identity'
import { canAccessProjetosProducao } from '@/lib/projetos-producao'
import {
  PROJETOS_ABA_PARAM,
  isProjetosAba,
  resolveProjetosAba,
  visibleProjetosAbas,
  type ProjetosAba,
} from '@/lib/projetos-hub'

const ProjetosAtelie = lazy(() => import('@/pages/Projetos'))
const ProjetosProducao = lazy(() => import('@/pages/ProjetosProducao'))

/**
 * /projetos — moldura com abas: Ateliê (quadro de Projetos) e Oficina (Produção).
 * Só a aba ativa fica montada (Radix desmonta a outra), então o realtime
 * do quadro escondido não fica ligado.
 */
export default function ProjetosHub() {
  const { roles, crmProfile } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()

  const acesso = useMemo(
    () => ({
      canAtelie: canAccessProjetosBoard(crmProfile),
      canProducao: canAccessProjetosProducao(
        crmProfile,
        roles,
        isCrmAdmin(crmProfile) || roles.includes('Administrador'),
      ),
    }),
    [crmProfile, roles],
  )
  const abas = visibleProjetosAbas(acesso)
  const active = resolveProjetosAba(searchParams.get(PROJETOS_ABA_PARAM), acesso)

  const handleChange = useCallback(
    (value: string) => {
      if (!isProjetosAba(value)) return
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set(PROJETOS_ABA_PARAM, value)
        // O ?id= abre o lead do quadro anterior — não deve vazar para o outro.
        next.delete('id')
        return next
      })
    },
    [setSearchParams],
  )

  if (!active) return <EmptyState message="Você não tem acesso a Projetos nem à Produção." />

  return (
    <Tabs value={active} onValueChange={handleChange} className="relative min-w-0">
      <ProjetosSetorTabs abas={abas} active={active} />
      {abas.map((aba) => (
        <TabsContent
          key={aba}
          value={aba}
          className="mt-0 duration-300 animate-in fade-in-0 slide-in-from-bottom-1 focus-visible:ring-0 motion-reduce:animate-none"
        >
          <Suspense fallback={<LoadingState variant="page" message={LOADING_COPY[aba]} />}>
            {aba === 'atelie' ? <ProjetosAtelie /> : <ProjetosProducao />}
          </Suspense>
        </TabsContent>
      ))}
    </Tabs>
  )
}

const LOADING_COPY: Record<ProjetosAba, string> = {
  atelie: 'Abrindo a prancheta...',
  producao: 'Abrindo a oficina...',
}
