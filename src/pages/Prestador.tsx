import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useMinhaPontuaGarbo, type ComissaoLead } from '@/hooks/usePontuaGarboFinanceiro';
import { LogOut, ChevronDown } from 'lucide-react';
import { PrestadorRadialMenu, type PrestadorSection } from '@/components/prestador/PrestadorRadialMenu';
import { PrestadorGarboBrand } from '@/components/prestador/PrestadorGarboBrand';
import { PrestadorPerfil } from '@/components/prestador/PrestadorPerfil';
import { PrestadorSaldo } from '@/components/prestador/PrestadorSaldo';
import { PrestadorClientes } from '@/components/prestador/PrestadorClientes';
import { PrestadorPortalLeadsPanel } from '@/components/prestador/PrestadorPortalLeadsPanel';
import { PrestadorLeadDetailDialog } from '@/components/prestador/PrestadorLeadDetailDialog';
import { PrestadorPortalResumo } from '@/components/prestador/PrestadorPortalResumo';
import { PrestadorBannerSlideshow } from '@/components/prestador/PrestadorBannerSlideshow';
import { resolvePrestadorBannerSlides } from '@/lib/empresa-banner-slides';
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
      {/* Identity block */}
      <div
        className="relative z-10 px-8 pb-10 md:px-14 md:pb-12"
        style={{ marginTop: 'auto', paddingTop: hasContent ? '4rem' : undefined }}
      >
        <div
          className="anim-rule h-px bg-amber-400/70 mb-7"
          style={{ animationDelay: '500ms', width: 0 }}
        />

        <h1
          className="font-display text-white leading-none anim-up"
          style={{
            fontSize: 'clamp(3rem, 9vw, 7rem)',
            letterSpacing: '0.02em',
            textShadow: '0 2px 40px rgba(0,0,0,0.6)',
            animationDelay: '600ms',
          }}
        >
          {nome}
        </h1>

        <div className="mt-5 anim-fade inline-flex" style={{ animationDelay: '900ms' }}>
          <span
            className="inline-flex items-center px-4 py-1.5 rounded-full text-xs tracking-widest uppercase font-medium"
            style={{
              border: '1px solid rgba(240,210,140,0.4)',
              background: 'rgba(240,210,140,0.08)',
              color: '#f2d892',
              letterSpacing: '0.18em',
              backdropFilter: 'blur(8px)',
            }}
          >
            {titulo}
          </span>
        </div>

        <p
          className="mt-4 text-sm anim-fade prestador-welcome-glow"
          style={{ animationDelay: '1100ms', letterSpacing: '0.08em', fontFamily: 'Raleway, sans-serif' }}
        >
          Bem-vindo ao seu portal
        </p>

        {hasContent && (
          <div className="mt-8 anim-scroll">
            <ChevronDown className="h-5 w-5 text-white/30" />
          </div>
        )}
      </div>

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
        style={{ backgroundColor: '#2a1812', minHeight: '100dvh' }}
      >
        {/* Banner slideshow — portal only */}
        {isPortal && bannerSlides.length > 0 && (
          <div
            className="absolute top-0 left-0 right-0 anim-banner pointer-events-none overflow-hidden"
            style={{ height: hasContent ? 'min(100dvh, 700px)' : '100dvh' }}
          >
            <PrestadorBannerSlideshow slides={bannerSlides} />
          </div>
        )}

        {/* Gradient overlays — portal only */}
        {isPortal && (
          <>
            <div
              className="absolute top-0 left-0 right-0 pointer-events-none"
              style={{
                height: hasContent ? 'min(100dvh, 700px)' : '100dvh',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 40%, rgba(8,8,8,0.95) 100%)',
                zIndex: 2,
              }}
            />
            <div
              className="absolute top-0 left-0 right-0 h-full pointer-events-none"
              style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.35), transparent 60%)', zIndex: 2 }}
            />

          </>
        )}

        {/* Noise + ambient glow — portal, no banner */}
        {isPortal && bannerSlides.length === 0 && (
          <>
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.03]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                backgroundSize: '200px',
              }}
            />
            <div
              className="absolute pointer-events-none"
              style={{
                top: '30%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '60vw',
                height: '40vh',
                background: 'radial-gradient(ellipse, rgba(240,210,140,0.07) 0%, transparent 70%)',
              }}
            />
          </>
        )}

        {/* ── Header — always visible ── */}
        <header className="relative z-20 flex items-start justify-between gap-4 px-6 pt-6 sm:px-8 sm:pt-8 md:px-12 md:pt-10 shrink-0 pointer-events-none">
          <div className="anim-down pointer-events-auto" style={{ animationDelay: '200ms' }}>
            <PrestadorGarboBrand
              overBanner={isPortal && bannerSlides.length > 0}
              animate={false}
              onGoHome={() => handleSectionChange('portal')}
            />
          </div>

          <button
            onClick={() => void signOut()}
            className="anim-fade pointer-events-auto flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors text-sm group shrink-0"
            style={{ animationDelay: '400ms' }}
          >
            <span className="hidden sm:inline" style={{ fontFamily: 'Raleway, sans-serif' }}>Sair</span>
            <LogOut className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
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
