import { useMemo, useState } from 'react';
import type { ComissaoLead } from '@/hooks/usePontuaGarboFinanceiro';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useMeusSaquePedidos } from '@/hooks/useSaquePedidos';
import { PrestadorPortalLeadCard } from '@/components/prestador/PrestadorPortalLeadCard';
import {
  buildPrestadorLeadEtiquetasMap,
  getPrestadorLeadEtiquetas,
  leadClienteJaPagou,
  type PrestadorLeadEtiqueta,
} from '@/lib/prestador-lead-etiquetas';
import { sumSaquesPendentes } from '@/lib/pontua-garbo-saque';
import { splitLeadsByCurrentMonth } from '@/lib/prestador-leads-por-mes';
import {
  prestadorLeadMatchesSearch,
  sortPrestadorLeadsBySearchRelevance,
} from '@/lib/prestador-lead-search';
import { BadgeCheck, CalendarDays, Layers, Search, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const panelCss = `
  .prestador-leads-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(240, 210, 140, 0.45) rgba(255, 255, 255, 0.06);
  }
  .prestador-leads-scroll::-webkit-scrollbar {
    width: 6px;
  }
  .prestador-leads-scroll::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.04);
    border-radius: 999px;
  }
  .prestador-leads-scroll::-webkit-scrollbar-thumb {
    background: rgba(240, 210, 140, 0.4);
    border-radius: 999px;
  }
  .prestador-leads-scroll--pago {
    scrollbar-color: rgba(74, 222, 128, 0.45) rgba(255, 255, 255, 0.06);
  }
  .prestador-leads-scroll--pago::-webkit-scrollbar-thumb {
    background: rgba(74, 222, 128, 0.4);
  }
  @keyframes prestador-pago-shimmer {
    0% { transform: translateX(-120%); }
    100% { transform: translateX(220%); }
  }
  @keyframes prestador-pago-card-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .prestador-pago-header-shine::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      105deg,
      transparent 35%,
      rgba(74, 222, 128, 0.14) 50%,
      transparent 65%
    );
    animation: prestador-pago-shimmer 4.5s ease-in-out infinite;
    pointer-events: none;
  }
  .prestador-pago-card-anim {
    animation: prestador-pago-card-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
`;

type ContainerVariant = 'default' | 'pago';

interface PrestadorPortalLeadsPanelProps {
  leads: ComissaoLead[];
  totalRetirado?: number;
  podeAbrirLead: (leadId: number) => boolean;
  onOpenDetalhes: (lead: ComissaoLead) => void;
  onSemPermissao: () => void;
}

interface LeadsScrollContainerProps {
  title: string;
  subtitle: string;
  icon: typeof CalendarDays;
  count: number;
  leads: ComissaoLead[];
  emptyMessage: string;
  searchActive: boolean;
  podeAbrirLead: (leadId: number) => boolean;
  onOpenDetalhes: (lead: ComissaoLead) => void;
  onSemPermissao: () => void;
  scrollHeightClass?: string;
  etiquetasMap: Map<string, PrestadorLeadEtiqueta[]>;
  variant?: ContainerVariant;
}

function LeadsScrollContainer({
  title,
  subtitle,
  icon: Icon,
  count,
  leads,
  emptyMessage,
  searchActive,
  podeAbrirLead,
  onOpenDetalhes,
  onSemPermissao,
  scrollHeightClass = 'h-[min(42vh,360px)]',
  etiquetasMap,
  variant = 'default',
}: LeadsScrollContainerProps) {
  const emptyText = searchActive
    ? 'Nenhum lead encontrado para esta busca.'
    : emptyMessage;
  const isPago = variant === 'pago';

  const accent = isPago
    ? {
        border: 'rgba(74,222,128,0.28)',
        shadow:
          '0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(74,222,128,0.08), inset 0 1px 0 rgba(74,222,128,0.18)',
        bg: 'linear-gradient(165deg, rgba(12,28,18,0.96) 0%, rgba(8,14,10,0.98) 48%, rgba(6,10,8,1) 100%)',
        iconBg: 'rgba(74,222,128,0.14)',
        iconBorder: 'rgba(74,222,128,0.35)',
        iconColor: 'rgba(74,222,128,0.95)',
        badgeColor: 'rgba(74,222,128,0.98)',
        badgeBg: 'rgba(74,222,128,0.12)',
        badgeBorder: 'rgba(74,222,128,0.32)',
        headerBorder: 'rgba(74,222,128,0.18)',
        fadeTop: 'linear-gradient(to bottom, rgba(8,14,10,0.95), transparent)',
        fadeBottom: 'linear-gradient(to top, rgba(6,10,8,0.98), transparent)',
      }
    : {
        border: 'rgba(240,210,140,0.2)',
        shadow: '0 12px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(240,210,140,0.1)',
        bg: 'linear-gradient(165deg, rgba(22,18,12,0.92) 0%, rgba(10,10,10,0.96) 55%, rgba(8,8,8,1) 100%)',
        iconBg: 'rgba(240,210,140,0.12)',
        iconBorder: 'rgba(240,210,140,0.28)',
        iconColor: 'rgba(240,210,140,0.9)',
        badgeColor: 'rgba(240,210,140,0.95)',
        badgeBg: 'rgba(240,210,140,0.1)',
        badgeBorder: 'rgba(240,210,140,0.25)',
        headerBorder: 'rgba(240,210,140,0.15)',
        fadeTop: 'linear-gradient(to bottom, rgba(10,10,10,0.95), transparent)',
        fadeBottom: 'linear-gradient(to top, rgba(8,8,8,0.98), transparent)',
      };

  return (
    <section
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: accent.bg,
        border: `1px solid ${accent.border}`,
        boxShadow: accent.shadow,
      }}
    >
      <header
        className={cn(
          'shrink-0 relative flex items-start justify-between gap-3 px-4 py-3.5 border-b overflow-hidden',
          isPago && 'prestador-pago-header-shine',
        )}
        style={{ borderColor: accent.headerBorder }}
      >
        <div className="relative z-[1] flex items-start gap-3 min-w-0">
          <div
            className="shrink-0 flex items-center justify-center rounded-lg"
            style={{
              width: 36,
              height: 36,
              background: accent.iconBg,
              border: `1px solid ${accent.iconBorder}`,
            }}
          >
            <Icon size={16} style={{ color: accent.iconColor }} />
          </div>
          <div className="min-w-0">
            <h3
              className="font-display text-base tracking-wide capitalize truncate"
              style={{ color: 'rgba(255,255,255,0.92)' }}
            >
              {title}
            </h3>
            <p
              className="text-[11px] mt-0.5 truncate"
              style={{ color: 'rgba(255,255,255,0.38)', fontFamily: 'Raleway, sans-serif' }}
            >
              {subtitle}
            </p>
          </div>
        </div>
        <span
          className="relative z-[1] shrink-0 text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full"
          style={{
            color: accent.badgeColor,
            background: accent.badgeBg,
            border: `1px solid ${accent.badgeBorder}`,
            fontFamily: 'Raleway, sans-serif',
          }}
        >
          {count}
        </span>
      </header>

      <div
        className={cn(
          'prestador-leads-scroll overflow-y-auto overflow-x-hidden min-h-0 relative',
          scrollHeightClass,
          isPago && 'prestador-leads-scroll--pago',
        )}
      >
        <div
          className="pointer-events-none sticky top-0 left-0 right-0 h-4 z-[1]"
          style={{ background: accent.fadeTop }}
        />
        {leads.length === 0 ? (
          <p
            className="px-4 py-10 text-center text-sm"
            style={{ color: 'rgba(255,255,255,0.28)', fontFamily: 'Raleway, sans-serif' }}
          >
            {emptyText}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-3 pb-3 pt-1">
            {leads.map((lead, index) => (
              <div
                key={`${lead.leadId}-${lead.fieldId}`}
                className={isPago ? 'prestador-pago-card-anim' : undefined}
                style={isPago ? { animationDelay: `${Math.min(index, 8) * 45}ms` } : undefined}
              >
                <PrestadorPortalLeadCard
                  lead={lead}
                  etiquetas={getPrestadorLeadEtiquetas(lead, etiquetasMap)}
                  podeAbrir={podeAbrirLead(lead.leadId)}
                  onOpenDetalhes={onOpenDetalhes}
                  onSemPermissao={onSemPermissao}
                />
              </div>
            ))}
          </div>
        )}
        <div
          className="pointer-events-none sticky bottom-0 left-0 right-0 h-6 z-[1]"
          style={{ background: accent.fadeBottom }}
        />
      </div>
    </section>
  );
}

export function PrestadorPortalLeadsPanel({
  leads,
  totalRetirado = 0,
  podeAbrirLead,
  onOpenDetalhes,
  onSemPermissao,
}: PrestadorPortalLeadsPanelProps) {
  const { data: profile } = useCurrentUserProfile();
  const { pedidos } = useMeusSaquePedidos(profile?.id);
  const [searchQuery, setSearchQuery] = useState('');
  const searchActive = searchQuery.trim().length > 0;

  const etiquetasMap = useMemo(
    () =>
      buildPrestadorLeadEtiquetasMap(
        leads,
        sumSaquesPendentes(pedidos),
        totalRetirado,
      ),
    [leads, pedidos, totalRetirado],
  );

  const filteredLeads = useMemo(() => {
    const matched = leads.filter((l) => prestadorLeadMatchesSearch(l, searchQuery));
    return sortPrestadorLeadsBySearchRelevance(matched, searchQuery);
  }, [leads, searchQuery]);

  const { emAndamento, jaPagaram } = useMemo(() => {
    const emAndamentoList: ComissaoLead[] = [];
    const jaPagaramList: ComissaoLead[] = [];
    for (const lead of filteredLeads) {
      if (leadClienteJaPagou(lead, etiquetasMap)) {
        jaPagaramList.push(lead);
      } else {
        emAndamentoList.push(lead);
      }
    }
    return { emAndamento: emAndamentoList, jaPagaram: jaPagaramList };
  }, [filteredLeads, etiquetasMap]);

  // Mês atual inclui fechados (cliente pagou) — eles também entram no container de pagos.
  const { mesAtual, mesLabel } = splitLeadsByCurrentMonth(filteredLeads);
  const totalLeads = leads.length;
  const filteredTotal = filteredLeads.length;

  return (
    <>
      <style>{panelCss}</style>
      <div className="flex flex-col gap-5">
        {/* Resumo + busca */}
        <div
          className="rounded-2xl px-4 py-4 sm:px-5 sm:py-5 flex flex-col gap-4"
          style={{
            background:
              'linear-gradient(135deg, rgba(240,210,140,0.14) 0%, rgba(12,10,8,0.95) 45%, rgba(8,8,8,0.98) 100%)',
            border: '1px solid rgba(240,210,140,0.28)',
            boxShadow: '0 10px 36px rgba(0,0,0,0.35)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center rounded-xl"
                style={{
                  width: 44,
                  height: 44,
                  background: 'rgba(240,210,140,0.15)',
                  border: '1px solid rgba(240,210,140,0.35)',
                }}
              >
                <Users size={20} style={{ color: 'rgba(240,210,140,0.95)' }} />
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.2em] font-semibold"
                  style={{ color: 'rgba(240,210,140,0.75)', fontFamily: 'Raleway, sans-serif' }}
                >
                  Seus leads
                </p>
                <p className="font-display text-2xl sm:text-3xl leading-none text-white mt-0.5">
                  {searchActive ? (
                    <>
                      {filteredTotal}
                      <span
                        className="text-lg sm:text-xl font-normal ml-1.5"
                        style={{ color: 'rgba(255,255,255,0.4)' }}
                      >
                        / {totalLeads}
                      </span>
                    </>
                  ) : (
                    totalLeads
                  )}
                </p>
                <p
                  className="text-[11px] mt-1"
                  style={{ color: 'rgba(255,255,255,0.38)', fontFamily: 'Raleway, sans-serif' }}
                >
                  {searchActive
                    ? 'Resultados da busca'
                    : totalLeads === 1
                      ? '1 cliente indicado por você'
                      : `${totalLeads} clientes indicados por você`}
                  {!searchActive && jaPagaram.length > 0 && (
                    <span style={{ color: 'rgba(74,222,128,0.75)' }}>
                      {' '}
                      · {jaPagaram.length} já {jaPagaram.length === 1 ? 'pagou' : 'pagaram'}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'rgba(240,210,140,0.55)' }}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, telefone, e-mail, empresa..."
              aria-label="Buscar leads"
              className="w-full rounded-xl pl-10 pr-10 py-3 text-sm outline-none transition-colors"
              style={{
                fontFamily: 'Raleway, sans-serif',
                background: 'rgba(0,0,0,0.45)',
                border: '1px solid rgba(240,210,140,0.25)',
                color: 'rgba(255,255,255,0.9)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(240,210,140,0.55)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(240,210,140,0.25)';
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors hover:bg-white/10"
                aria-label="Limpar busca"
              >
                <X size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
              </button>
            )}
          </div>
          <p
            className="text-[10px] -mt-1"
            style={{ color: 'rgba(255,255,255,0.28)', fontFamily: 'Raleway, sans-serif' }}
          >
            Pesquise por nome, telefone, e-mail, empresa, região ou status do lead.
          </p>
        </div>

        <LeadsScrollContainer
          title="Leads do mês"
          subtitle={mesLabel}
          icon={CalendarDays}
          count={mesAtual.length}
          leads={mesAtual}
          searchActive={searchActive}
          emptyMessage="Nenhum lead neste mês ainda."
          podeAbrirLead={podeAbrirLead}
          onOpenDetalhes={onOpenDetalhes}
          onSemPermissao={onSemPermissao}
          scrollHeightClass="h-[min(38vh,320px)] sm:h-[min(40vh,340px)]"
          etiquetasMap={etiquetasMap}
        />

        <LeadsScrollContainer
          title="Todos os leads"
          subtitle="Em andamento — sem os que já pagaram"
          icon={Layers}
          count={emAndamento.length}
          leads={emAndamento}
          searchActive={searchActive}
          emptyMessage="Nenhum lead em andamento."
          podeAbrirLead={podeAbrirLead}
          onOpenDetalhes={onOpenDetalhes}
          onSemPermissao={onSemPermissao}
          scrollHeightClass="h-[min(48vh,420px)] sm:h-[min(50vh,440px)]"
          etiquetasMap={etiquetasMap}
        />

        <LeadsScrollContainer
          title="Clientes que já pagaram"
          subtitle="Vendas quitadas — comissão confirmada"
          icon={BadgeCheck}
          count={jaPagaram.length}
          leads={jaPagaram}
          searchActive={searchActive}
          emptyMessage="Ainda não há clientes com pagamento confirmado."
          podeAbrirLead={podeAbrirLead}
          onOpenDetalhes={onOpenDetalhes}
          onSemPermissao={onSemPermissao}
          scrollHeightClass="h-[min(42vh,380px)] sm:h-[min(44vh,400px)]"
          etiquetasMap={etiquetasMap}
          variant="pago"
        />
      </div>
    </>
  );
}
