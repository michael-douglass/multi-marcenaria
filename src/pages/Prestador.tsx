import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useMinhaPontuaGarbo, type ComissaoLead } from '@/hooks/usePontuaGarboFinanceiro';
import { LogOut, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { defaultPathForIdentity, isPortalOnly } from '@/lib/crm-identity';
import { PrestadorRadialMenu, type PrestadorSection } from '@/components/prestador/PrestadorRadialMenu';
import { PrestadorGarboBrand } from '@/components/prestador/PrestadorGarboBrand';
import { PrestadorPerfil } from '@/components/prestador/PrestadorPerfil';
import { PrestadorSaldo } from '@/components/prestador/PrestadorSaldo';
import { PrestadorClientes } from '@/components/prestador/PrestadorClientes';
import { PrestadorPortalLeadsPanel } from '@/components/prestador/PrestadorPortalLeadsPanel';
import { PrestadorLeadDetailDialog } from '@/components/prestador/PrestadorLeadDetailDialog';
import { PrestadorPortalResumo } from '@/components/prestador/PrestadorPortalResumo';
import { PrestadorBannerSlideshow } from '@/components/prestador/PrestadorBannerSlideshow';
import { PrestadorPortalAtmosphere } from '@/components/prestador/PrestadorPortalAtmosphere';
import { PrestadorPortalHero } from '@/components/prestador/PrestadorPortalHero';
import { resolvePrestadorBannerSlides } from '@/lib/empresa-banner-slides';
import { GARBO_APRESENTACAO_THEME } from '@/components/marketing/apresentacao-empresa/garbo-apresentacao-theme';
import { useMinhasPermissoes, normalizePermissao } from '@/hooks/useLeadPrestadorPermissoes';
import { podeVerAlgumAnexo } from '@/lib/prestador-visibilidade';
import { toast } from 'sonner';

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
`;

type GarboPortalData = {
  leads: ComissaoLead[];
  totalAGanar: number;
  totalComissaoCarteira?: number;
  totalComissaoGanha: number;
  ganhoMesAtual: number;
  mediaMensalGanhos: number;
  ganhosPorMes: { key: string; label: string; valor: number }[];
  saldoParaSacar: number;
  totalRetirado: number;
  totalAjustes?: number;
  totalComissao?: number;
};

function PortalLeadsAndResumo({
  garbo,
  podeAbrirLead,
  onOpenDetalhes,
  onSemPermissao,
}: {
  garbo: GarboPortalData;
  podeAbrirLead: (leadId: number) => boolean;
  onOpenDetalhes: (lead: ComissaoLead) => void;
  onSemPermissao: () => void;
}) {
  const hasLeads = garbo.leads.length > 0;
  const hasResumo =
    (garbo.totalAGanar ?? 0) > 0 ||
    garbo.saldoParaSacar > 0 ||
    garbo.totalComissaoGanha > 0 ||
    garbo.totalRetirado > 0;

  if (!hasLeads && !hasResumo) return null;

  return (
    <div
      className="relative z-10 px-6 md:px-14 pb-8 anim-fade"
      style={{ animationDelay: '1300ms' }}
    >
      <div className="flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-10">
        {/* Resumo no topo no celular; à direita no desktop */}
        {hasResumo && (
          <div className="order-1 lg:order-2 w-full lg:w-[min(380px,38%)] lg:sticky lg:top-8">
            <PrestadorPortalResumo
              totalAGanar={garbo.totalAGanar ?? garbo.totalComissao ?? 0}
              totalComissaoCarteira={
                garbo.totalComissaoCarteira ??
                (garbo.totalAGanar ?? 0) + (garbo.totalComissaoGanha ?? 0)
              }
              totalComissaoGanha={garbo.totalComissaoGanha}
              ganhoMesAtual={garbo.ganhoMesAtual}
              mediaMensalGanhos={garbo.mediaMensalGanhos}
              ganhosPorMes={garbo.ganhosPorMes}
              saldoParaSacar={garbo.saldoParaSacar}
              totalRetirado={garbo.totalRetirado}
              totalAjustes={garbo.totalAjustes}
            />
          </div>
        )}

        {hasLeads && (
          <div className="order-2 lg:order-1 flex-1 min-w-0">
            <PrestadorPortalLeadsPanel
              leads={garbo.leads}
              totalRetirado={garbo.totalRetirado}
              podeAbrirLead={podeAbrirLead}
              onOpenDetalhes={onOpenDetalhes}
              onSemPermissao={onSemPermissao}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function PortalSection({
  nome,
  titulo,
  hasContent,
  garbo,
  podeAbrirLead,
  onOpenDetalhes,
  onSemPermissao,
}: {
  nome: string;
  titulo: string;
  hasContent: boolean;
  garbo: GarboPortalData | null | undefined;
  podeAbrirLead: (leadId: number) => boolean;
  onOpenDetalhes: (lead: ComissaoLead) => void;
  onSemPermissao: () => void;
}) {
  return (
    <>
      <PrestadorPortalHero nome={nome} titulo={titulo} hasContent={hasContent} />

      {garbo && (
        <PortalLeadsAndResumo
          garbo={garbo}
          podeAbrirLead={podeAbrirLead}
          onOpenDetalhes={onOpenDetalhes}
          onSemPermissao={onSemPermissao}
        />
      )}

      {/* Bottom accent */}
      <div
        className="h-px mt-auto anim-fade"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(240,210,140,0.3), transparent)',
          animationDelay: '1200ms',
        }}
      />
    </>
  );
}

export default function Prestador() {
  const { signOut } = useAuth();
  const { roles, userProfile, crmProfile } = useApp();
  const navigate = useNavigate();
  const showBackToCrm = !isPortalOnly(userProfile, crmProfile);
  const backPath = defaultPathForIdentity(roles, userProfile, crmProfile);
  const { empresa, schemaEmpresa, queriesReady, recarregarEmpresa } = useEmpresa();
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentUserProfile();
  const { data: garbo } = useMinhaPontuaGarbo(profile?.id);
  const [isMobile, setIsMobile] = useState(false);
  const [section, setSection] = useState<PrestadorSection>('portal');
  const [sectionVisible, setSectionVisible] = useState(true);
  const [detailLead, setDetailLead] = useState<ComissaoLead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { data: permissoes = [] } = useMinhasPermissoes(profile?.id);

  const getLeadPermRaw = useCallback(
    (leadId: number) => {
      const found = permissoes.find((perm) => perm.lead_id === leadId);
      return normalizePermissao(found, leadId, profile?.id ?? '');
    },
    [permissoes, profile?.id],
  );

  const getLeadPerm = useCallback(
    (leadId: number) => {
      const p = getLeadPermRaw(leadId);
      return {
        podeVerDetalhes: p.pode_ver_detalhes,
        podeVerLousa: p.pode_ver_lousa,
        podeVerAnexos: p.pode_ver_anexos || podeVerAlgumAnexo(p),
        podeVerObservacoes: p.pode_ver_anotacoes,
        prestadorPerm: p,
      };
    },
    [getLeadPermRaw],
  );

  const podeAbrirLead = useCallback(
    (leadId: number) => {
      const p = getLeadPermRaw(leadId);
      return (
        p.pode_ver_detalhes ||
        p.pode_ver_lousa ||
        podeVerAlgumAnexo(p) ||
        p.pode_ver_orcamento
      );
    },
    [getLeadPermRaw],
  );

  const handleOpenLeadDetalhes = useCallback((lead: ComissaoLead) => {
    setDetailLead(lead);
    setDetailOpen(true);
  }, []);

  const handleSemPermissaoDetalhes = useCallback(() => {
    toast.info('Visualização não liberada', {
      description:
        'O administrador ainda não autorizou ver detalhes, lousa, arquivos ou orçamentos deste lead.',
    });
  }, []);

  const detailPerm = detailLead ? getLeadPerm(detailLead.leadId) : null;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  /** Atualiza banners/slides salvos pelo admin (evita cache antigo no localStorage) */
  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) void recarregarEmpresa(session.user.id);
    });
  }, [recarregarEmpresa]);

  /** Recarrega comissões/leads quando empresa e perfil do prestador estiverem prontos */
  useEffect(() => {
    if (!queriesReady || !profile?.id || !schemaEmpresa) return;
    void queryClient.invalidateQueries({
      queryKey: ['minha-pontua-garbo', schemaEmpresa, profile.id],
    });
  }, [queriesReady, profile?.id, schemaEmpresa, queryClient]);

  const handleSectionChange = (s: PrestadorSection) => {
    if (s === section) return;
    setSectionVisible(false);
    setTimeout(() => {
      setSection(s);
      setSectionVisible(true);
    }, 150);
  };

  const bannerSlides = resolvePrestadorBannerSlides(empresa, isMobile);

  const nome       = profile?.nome ?? '';
  const titulo     = profile?.titulo || 'Prestador de Serviço';
  const hasContent =
    (garbo?.totalAGanar ?? garbo?.totalComissao ?? 0) > 0 ||
    (garbo?.saldoParaSacar ?? 0) > 0 ||
    (garbo?.leads?.length ?? 0) > 0;
  const isPortal   = section === 'portal';

  return (
    <>
      <style>{css}</style>

      <div
        className="relative w-full overflow-x-hidden flex flex-col"
        style={{ backgroundColor: GARBO_APRESENTACAO_THEME.bgBase, minHeight: '100dvh' }}
      >
        {isPortal && (
          <div
            className="absolute top-0 left-0 right-0 overflow-hidden pointer-events-none anim-banner"
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

        {/* ── Header — always visible ── */}
        <header className="relative z-20 flex items-start justify-between gap-4 px-6 pt-6 sm:px-8 sm:pt-8 md:px-12 md:pt-10 shrink-0 pointer-events-none">
          <div className="anim-down pointer-events-auto" style={{ animationDelay: '200ms' }}>
            <PrestadorGarboBrand
              overBanner={isPortal}
              animate={false}
              onGoHome={() => handleSectionChange('portal')}
            />
          </div>

          <div className="pointer-events-auto flex items-center gap-3 shrink-0">
            {showBackToCrm && (
              <button
                type="button"
                onClick={() => navigate(backPath)}
                className="anim-fade pointer-events-auto flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors text-sm"
                style={{ animationDelay: '350ms' }}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline" style={{ fontFamily: 'Raleway, sans-serif' }}>
                  Voltar
                </span>
              </button>
            )}
            <button
              onClick={() => void signOut()}
              className="anim-fade pointer-events-auto flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors text-sm group shrink-0"
              style={{ animationDelay: '400ms' }}
            >
              <span className="hidden sm:inline" style={{ fontFamily: 'Raleway, sans-serif' }}>Sair</span>
              <LogOut className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </header>

        {/* ── Section content ── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            opacity: sectionVisible ? 1 : 0,
            transition: 'opacity 0.15s ease',
          }}
        >
          {section === 'portal' && (
            <PortalSection
              nome={nome}
              titulo={titulo}
              hasContent={hasContent}
              garbo={garbo}
              podeAbrirLead={podeAbrirLead}
              onOpenDetalhes={handleOpenLeadDetalhes}
              onSemPermissao={handleSemPermissaoDetalhes}
            />
          )}
          {section === 'perfil'   && <PrestadorPerfil />}
          {section === 'saldo'    && <PrestadorSaldo />}
          {section === 'clientes' && (
            <PrestadorClientes
              podeAbrirLead={podeAbrirLead}
              onOpenDetalhes={handleOpenLeadDetalhes}
              onSemPermissao={handleSemPermissaoDetalhes}
            />
          )}
        </div>

        {/* ── Radial menu — always fixed at bottom ── */}
        <PrestadorRadialMenu active={section} onChange={handleSectionChange} />

        <PrestadorLeadDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          lead={detailLead}
          podeVerDetalhes={detailPerm?.podeVerDetalhes ?? false}
          podeVerLousa={detailPerm?.podeVerLousa ?? false}
          podeVerAnexos={detailPerm?.podeVerAnexos ?? false}
          podeVerObservacoes={detailPerm?.podeVerObservacoes ?? false}
          prestadorPerm={detailPerm?.prestadorPerm ?? null}
        />
      </div>
    </>
  );
}
