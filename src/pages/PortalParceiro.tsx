import { useCallback, useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import { useApp } from '@/context/AppContext'
import { useCrmPortal } from '@/hooks/useCrmPortal'
import { showToast } from '@/lib/toast'
import {
  normalizePermissao,
  podeAbrirLeadPortal,
  type PortalComissaoLead,
  type PortalLeadDetalhe,
} from '@/lib/crm-portal'
import { PortalBrand } from '@/components/crm/portal/PortalBrand'
import { PrestadorRadialMenu, type PrestadorSection } from '@/components/crm/portal/PortalRadialMenu'
import { PortalLeadsPanel } from '@/components/crm/portal/PortalLeadsPanel'
import { PortalResumoCard } from '@/components/crm/portal/PortalResumoCard'
import { PortalPerfilSection } from '@/components/crm/portal/PortalPerfilSection'
import { PortalSaldoSection } from '@/components/crm/portal/PortalSaldoSection'
import { PortalClientesSection } from '@/components/crm/portal/PortalClientesSection'
import { PortalLeadDialog } from '@/components/crm/portal/PortalLeadDialog'
import { PrestadorBannerSlideshow } from '@/components/prestador/PrestadorBannerSlideshow'
import { PrestadorPortalAtmosphere } from '@/components/prestador/PrestadorPortalAtmosphere'
import { PrestadorPortalHero } from '@/components/prestador/PrestadorPortalHero'
import { resolvePrestadorBannerSlides } from '@/lib/empresa-banner-slides'
import { GARBO_APRESENTACAO_THEME } from '@/components/marketing/apresentacao-empresa/garbo-apresentacao-theme'

const css = `
  @keyframes prestador-banner {
    from { opacity: 0; transform: scale(1.04); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes prestador-slide-down {
    from { opacity: 0; transform: translateY(-16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes prestador-slide-up {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes prestador-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes prestador-rule {
    from { width: 0; }
    to   { width: 3.5rem; }
  }
  @keyframes prestador-scroll-hint {
    0%, 100% { transform: translateY(0); opacity: 0.4; }
    50% { transform: translateY(4px); opacity: 0.8; }
  }
  .prestador-welcome-glow {
    color: rgba(255, 255, 255, 0.52);
    text-shadow:
      0 0 8px rgba(255, 255, 255, 0.95),
      0 0 18px rgba(255, 255, 255, 0.65),
      0 0 36px rgba(255, 255, 255, 0.35),
      0 1px 3px rgba(255, 255, 255, 0.5);
  }
  .anim-banner  { animation: prestador-banner    1s cubic-bezier(.22,1,.36,1) both; }
  .anim-down    { animation: prestador-slide-down .7s cubic-bezier(.22,1,.36,1) both; }
  .anim-up      { animation: prestador-slide-up   .7s cubic-bezier(.22,1,.36,1) both; }
  .anim-fade    { animation: prestador-fade       .6s ease both; }
  .anim-rule    { animation: prestador-rule       .8s cubic-bezier(.22,1,.36,1) both; }
  .anim-scroll  { animation: prestador-scroll-hint 2s ease-in-out infinite; animation-delay: 2s; }
`

interface PortalParceiroProps {
  /** Dentro da sidebar (ficha da fábrica + parceiro). Sem isto, ocupa a tela inteira. */
  embedded?: boolean
}

export function PortalParceiro({ embedded = false }: PortalParceiroProps) {
  const { signOut } = useApp()
  const { data, loading, error, salvarPerfil, solicitarSaque, obterLead } = useCrmPortal()
  const [section, setSection] = useState<PrestadorSection>('portal')
  const [sectionVisible, setSectionVisible] = useState(true)
  const [detailLead, setDetailLead] = useState<PortalComissaoLead | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detalhe, setDetalhe] = useState<PortalLeadDetalhe | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [savingPerfil, setSavingPerfil] = useState(false)

  const permOf = useCallback((leadId: number) => {
    return normalizePermissao(
      data.permissoes.find(p => p.leadId === leadId),
      leadId,
      data.perfil.id,
    )
  }, [data.permissoes, data.perfil.id])

  const podeAbrirLead = useCallback((leadId: number) => {
    return podeAbrirLeadPortal(permOf(leadId))
  }, [permOf])

  const handleSemPermissao = useCallback(() => {
    showToast('Visualização não liberada. O administrador ainda não autorizou este lead.', 'error')
  }, [])

  const handleOpenLead = useCallback((lead: PortalComissaoLead) => {
    setDetailLead(lead)
    setDetailOpen(true)
    setDetalhe(null)
    setDetailLoading(true)
    void obterLead(lead.leadId)
      .then(setDetalhe)
      .catch(err => {
        showToast(err instanceof Error ? err.message : 'Visualização não liberada', 'error')
        setDetailOpen(false)
      })
      .finally(() => setDetailLoading(false))
  }, [obterLead])

  const handleSectionChange = (next: PrestadorSection) => {
    if (next === section) return
    setSectionVisible(false)
    window.setTimeout(() => {
      setSection(next)
      setSectionVisible(true)
    }, 150)
  }

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const hasContent =
    data.resumo.leads.length > 0
    || data.resumo.totalAGanar > 0
    || data.resumo.saldoParaSacar > 0
    || data.resumo.totalComissaoGanha > 0
  const isPortal = section === 'portal'
  const chavePix = data.perfil.chavePix ?? ''
  const bannerSlides = resolvePrestadorBannerSlides(null, isMobile)

  const body = (
    <>
      <style>{css}</style>
      <div
        className="relative flex w-full flex-col overflow-x-hidden"
        style={{ backgroundColor: GARBO_APRESENTACAO_THEME.bgBase, minHeight: embedded ? '100%' : '100dvh' }}
      >
        {isPortal && (
          <div
            className="pointer-events-none absolute left-0 right-0 top-0 overflow-hidden anim-banner"
            style={{ height: hasContent ? 'min(100dvh, 700px)' : '100dvh' }}
          >
            {bannerSlides.length > 0 && <PrestadorBannerSlideshow slides={bannerSlides} />}
            <div
              className="absolute inset-0 z-[2]"
              style={{
                background: `
                  radial-gradient(ellipse 70% 50% at 72% 42%, rgba(242,216,146,0.12), transparent 62%),
                  linear-gradient(180deg, rgba(8,6,4,0.42) 0%, rgba(8,6,4,0.14) 38%, rgba(10,9,8,0.92) 100%),
                  linear-gradient(90deg, rgba(8,6,4,0.62) 0%, rgba(8,6,4,0.18) 48%, rgba(8,6,4,0.08) 100%)
                `,
              }}
            />
            <PrestadorPortalAtmosphere active={isPortal} />
            <div className="absolute inset-0 z-[4] grain-overlay opacity-30" />
          </div>
        )}

        <header className="pointer-events-none relative z-20 flex shrink-0 items-start justify-between gap-4 px-6 pt-6 sm:px-8 sm:pt-8 md:px-12 md:pt-10">
          <div className="anim-down pointer-events-auto" style={{ animationDelay: '200ms' }}>
            <PortalBrand onGoHome={() => handleSectionChange('portal')} />
          </div>
          {!embedded && (
            <button
              type="button"
              onClick={() => void signOut()}
              className="anim-fade pointer-events-auto flex shrink-0 items-center gap-2 text-sm text-white/40 transition-colors hover:text-white/80"
              style={{ animationDelay: '400ms' }}
            >
              <span className="hidden sm:inline" style={{ fontFamily: 'Raleway, sans-serif' }}>Sair</span>
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </header>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            opacity: sectionVisible ? 1 : 0,
            transition: 'opacity 0.15s ease',
          }}
        >
          {loading && <LoadingState variant="page" message="Abrindo o seu portal..." />}
          {!loading && error && (
            <div className="px-8 py-16">
              <ErrorState message={error.includes('Acesso negado')
                ? 'Este portal é só para o acesso de arquiteto/parceiro.'
                : error}
              />
            </div>
          )}
          {!loading && !error && section === 'portal' && (
            <PortalHome
              nome={data.perfil.nome || 'Parceiro'}
              titulo={data.perfil.titulo}
              hasContent={hasContent}
              leads={data.resumo.leads}
              saques={data.saques}
              resumo={data.resumo}
              chavePix={chavePix}
              tipoChavePix={data.perfil.tipoChavePix}
              podeAbrirLead={podeAbrirLead}
              onOpen={handleOpenLead}
              onSemPermissao={handleSemPermissao}
              onSolicitar={solicitarSaque}
            />
          )}
          {!loading && !error && section === 'perfil' && (
            <PortalPerfilSection
              perfil={data.perfil}
              saving={savingPerfil}
              onSave={async input => {
                setSavingPerfil(true)
                try {
                  await salvarPerfil(input)
                } finally {
                  setSavingPerfil(false)
                }
              }}
            />
          )}
          {!loading && !error && section === 'saldo' && (
            <PortalSaldoSection
              resumo={data.resumo}
              saques={data.saques}
              chavePix={chavePix}
              tipoChavePix={data.perfil.tipoChavePix}
              onSolicitar={solicitarSaque}
            />
          )}
          {!loading && !error && section === 'clientes' && (
            <PortalClientesSection
              leads={data.resumo.leads}
              churnedLeads={data.resumo.churnedLeads}
              permissoes={data.permissoes}
              prestadorId={data.perfil.id}
              saques={data.saques}
              totalRetirado={data.resumo.totalRetirado}
              onOpen={handleOpenLead}
              onSemPermissao={handleSemPermissao}
            />
          )}
        </div>

        <PrestadorRadialMenu active={section} onChange={handleSectionChange} />
        <PortalLeadDialog
          open={detailOpen}
          lead={detailLead}
          detalhe={detalhe}
          loading={detailLoading}
          onClose={() => setDetailOpen(false)}
        />
      </div>
    </>
  )

  return body
}

function PortalHome({
  nome,
  titulo,
  hasContent,
  leads,
  saques,
  resumo,
  chavePix,
  tipoChavePix,
  podeAbrirLead,
  onOpen,
  onSemPermissao,
  onSolicitar,
}: {
  nome: string
  titulo: string
  hasContent: boolean
  leads: PortalComissaoLead[]
  saques: ReturnType<typeof useCrmPortal>['data']['saques']
  resumo: ReturnType<typeof useCrmPortal>['data']['resumo']
  chavePix: string
  tipoChavePix: ReturnType<typeof useCrmPortal>['data']['perfil']['tipoChavePix']
  podeAbrirLead: (leadId: number) => boolean
  onOpen: (lead: PortalComissaoLead) => void
  onSemPermissao: () => void
  onSolicitar: ReturnType<typeof useCrmPortal>['solicitarSaque']
}) {
  const hasLeads = leads.length > 0
  const hasResumo =
    resumo.totalAGanar > 0
    || resumo.saldoParaSacar > 0
    || resumo.totalComissaoGanha > 0
    || resumo.totalRetirado > 0

  return (
    <>
      <PrestadorPortalHero nome={nome} titulo={titulo} hasContent={hasContent} />

      {(hasLeads || hasResumo) && (
        <div className="relative z-10 px-6 pb-8 md:px-14 anim-fade" style={{ animationDelay: '1300ms' }}>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
            {hasResumo && (
              <div className="order-1 w-full lg:order-2 lg:sticky lg:top-8 lg:w-[min(380px,38%)]">
                <PortalResumoCard
                  resumo={resumo}
                  saques={saques}
                  chavePix={chavePix}
                  tipoChavePix={tipoChavePix}
                  onSolicitar={onSolicitar}
                />
              </div>
            )}
            {hasLeads && (
              <div className="order-2 min-w-0 flex-1 lg:order-1">
                <PortalLeadsPanel
                  leads={leads}
                  saques={saques}
                  totalRetirado={resumo.totalRetirado}
                  podeAbrirLead={podeAbrirLead}
                  onOpen={onOpen}
                  onSemPermissao={onSemPermissao}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className="mt-auto h-px anim-fade"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(240,210,140,0.3), transparent)',
          animationDelay: '1200ms',
        }}
      />
    </>
  )
}
