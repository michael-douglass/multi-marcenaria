import { useMemo } from 'react';
import { Users, Lock, AlertTriangle } from 'lucide-react';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useMinhaPontuaGarbo, type ComissaoLead } from '@/hooks/usePontuaGarboFinanceiro';
import { useMeusSaquePedidos } from '@/hooks/useSaquePedidos';
import { useMinhasPermissoes, normalizePermissao } from '@/hooks/useLeadPrestadorPermissoes';
import { podeVerAlgumAnexo } from '@/lib/prestador-visibilidade';
import { PrestadorLeadEtiquetas } from '@/components/prestador/PrestadorLeadEtiquetas';
import {
  buildPrestadorLeadEtiquetasMap,
  getPrestadorLeadEtiquetas,
  type PrestadorLeadEtiqueta,
} from '@/lib/prestador-lead-etiquetas';
import { sumSaquesPendentes } from '@/lib/pontua-garbo-saque';

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function statusColor(status: string): string {
  if (status.includes('Venda Realizada'))      return '#22c55e';
  if (status.includes('Negociação'))            return '#3b82f6';
  if (status.includes('Experimental'))          return '#f59e0b';
  if (/perdid/i.test(status))                   return '#ef4444';
  return '#94a3b8';
}

function PermBadge({ label }: { label: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider"
      style={{
        color: 'rgba(240,210,140,0.75)',
        border: '1px solid rgba(240,210,140,0.25)',
        background: 'rgba(240,210,140,0.06)',
        fontFamily: 'Raleway, sans-serif',
      }}
    >
      {label}
    </span>
  );
}

function LeadCard({
  lead,
  etiquetas = [],
  podeAbrir,
  podeVerDetalhes,
  podeVerLousa,
  podeVerFotos,
  podeVerPdfs,
  podeVerOrcamento,
  podeVerAnotacoes,
  onOpenDetalhes,
  onSemPermissao,
}: {
  lead: ComissaoLead;
  etiquetas?: PrestadorLeadEtiqueta[];
  podeAbrir: boolean;
  podeVerDetalhes: boolean;
  podeVerLousa: boolean;
  podeVerFotos: boolean;
  podeVerPdfs: boolean;
  podeVerOrcamento: boolean;
  podeVerAnotacoes: boolean;
  onOpenDetalhes: (lead: ComissaoLead) => void;
  onSemPermissao: () => void;
}) {
  const isChurned = !!lead.churned;
  const color = statusColor(lead.leadStatus);

  const handleHeaderClick = () => {
    if (podeAbrir) {
      onOpenDetalhes(lead);
      return;
    }
    onSemPermissao();
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: isChurned ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isChurned ? 'rgba(239,68,68,0.14)' : 'rgba(255,255,255,0.07)'}`,
      }}
    >
      {/* Always-visible header */}
      <button
        type="button"
        className="w-full text-left p-4 flex items-start justify-between gap-3"
        style={{ cursor: 'pointer', background: 'none', border: 'none' }}
        onClick={handleHeaderClick}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="rounded-full shrink-0 mt-1.5"
            style={{ width: 7, height: 7, background: color }}
          />
          <div className="min-w-0">
            <p
              className="text-sm font-medium leading-tight truncate"
              style={{ color: isChurned ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)', fontFamily: 'Raleway, sans-serif' }}
            >
              {lead.leadNome}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {lead.leadStatus}
            </p>
            {!isChurned && etiquetas.length > 0 && (
              <PrestadorLeadEtiquetas etiquetas={etiquetas} className="mt-1.5" />
            )}
            {!isChurned && (
              <p className="text-xs mt-1.5 font-semibold" style={{ color: '#f2d892' }}>
                {BRL(lead.comissao)}
              </p>
            )}
            {isChurned && (
              <p className="text-xs mt-1" style={{ color: 'rgba(239,68,68,0.55)' }}>
                Não convertido
              </p>
            )}
          </div>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>
          {podeAbrir ? (
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(240,210,140,0.6)' }}>
              Abrir
            </span>
          ) : (
            <Lock size={12} style={{ opacity: 0.35 }} />
          )}
        </div>
      </button>

      {/* Permissões visíveis (sem abrir o modal) */}
      {(podeVerDetalhes || podeVerLousa || podeVerFotos || podeVerPdfs || podeVerOrcamento || podeVerAnotacoes) && (
        <div
          className="flex flex-wrap gap-2 px-4 pb-3"
          style={{ marginTop: -4 }}
        >
          {podeVerDetalhes && <PermBadge label="Detalhes" />}
          {podeVerLousa && <PermBadge label="Lousa" />}
          {podeVerFotos && <PermBadge label="Fotos" />}
          {podeVerPdfs && <PermBadge label="PDFs" />}
          {podeVerOrcamento && <PermBadge label="Orçamentos" />}
          {podeVerAnotacoes && <PermBadge label="Observações" />}
        </div>
      )}
    </div>
  );
}

interface PrestadorClientesProps {
  podeAbrirLead: (leadId: number) => boolean;
  onOpenDetalhes: (lead: ComissaoLead) => void;
  onSemPermissao: () => void;
}

export function PrestadorClientes({
  podeAbrirLead,
  onOpenDetalhes,
  onSemPermissao,
}: PrestadorClientesProps) {
  const { data: profile, isLoading: profileLoading } = useCurrentUserProfile();
  const { data: garbo, isLoading: garboLoading, isError: garboError } = useMinhaPontuaGarbo(profile?.id);
  const { pedidos } = useMeusSaquePedidos(profile?.id);
  const { data: permissoes = [] } = useMinhasPermissoes(profile?.id);

  const activeLeads  = garbo?.leads ?? [];
  const churnedLeads = garbo?.churnedLeads ?? [];

  const etiquetasMap = useMemo(
    () =>
      buildPrestadorLeadEtiquetasMap(
        activeLeads,
        sumSaquesPendentes(pedidos),
        garbo?.totalRetirado ?? 0,
      ),
    [activeLeads, pedidos, garbo?.totalRetirado],
  );

  const getPerm = (leadId: number) => {
    const p = normalizePermissao(
      permissoes.find((perm) => perm.lead_id === leadId),
      leadId,
      profile?.id ?? '',
    );
    return {
      pode_ver_detalhes: p.pode_ver_detalhes,
      pode_ver_lousa: p.pode_ver_lousa,
      pode_ver_fotos: p.pode_ver_fotos,
      pode_ver_pdfs: p.pode_ver_pdfs,
      pode_ver_orcamento: p.pode_ver_orcamento,
      pode_ver_anotacoes: p.pode_ver_anotacoes,
      pode_abrir:
        p.pode_ver_detalhes ||
        p.pode_ver_lousa ||
        podeVerAlgumAnexo(p) ||
        p.pode_ver_orcamento,
    };
  };

  const totalLeads = activeLeads.length + churnedLeads.length;

  return (
    <div
      className="relative z-10 flex flex-col gap-6 px-6 md:px-14 py-10"
      style={{ minHeight: 'calc(100dvh - 80px)', overflowY: 'auto', paddingBottom: 120 }}
    >
      {/* Section heading */}
      <div>
        <div className="h-px bg-amber-400/30 mb-5" style={{ width: '2.5rem' }} />
        <h2 className="font-display text-white text-3xl md:text-4xl tracking-wide">Clientes</h2>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 4, letterSpacing: '0.05em' }}>
          Seus leads indicados
        </p>
      </div>

      {(profileLoading || garboLoading) && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div
            className="h-8 w-8 rounded-full border-2 border-amber-400/40 border-t-amber-400 animate-spin"
            aria-hidden
          />
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, fontFamily: 'Raleway, sans-serif' }}>
            Carregando seus clientes...
          </p>
        </div>
      )}

      {garboError && !garboLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3 px-4">
          <p style={{ color: 'rgba(239,68,68,0.8)', fontSize: 13, fontFamily: 'Raleway, sans-serif' }}>
            Não foi possível carregar seus clientes. Atualize a página ou tente novamente em instantes.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!profileLoading && !garboLoading && !garboError && totalLeads === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <Users size={32} style={{ color: 'rgba(255,255,255,0.08)' }} />
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontFamily: 'Raleway, sans-serif' }}>
            Nenhum cliente indicado ainda
          </p>
        </div>
      )}

      {/* Active leads */}
      {activeLeads.length > 0 && (
        <div className="flex flex-col gap-2">
          <p
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.3)',
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 600,
            }}
          >
            Ativos ({activeLeads.length})
          </p>
          {activeLeads.map((lead) => {
            const perm = getPerm(lead.leadId);
            return (
              <LeadCard
                key={`${lead.leadId}-${lead.fieldId}`}
                lead={lead}
                etiquetas={getPrestadorLeadEtiquetas(lead, etiquetasMap)}
                podeAbrir={perm.pode_abrir}
                podeVerDetalhes={perm.pode_ver_detalhes}
                podeVerLousa={perm.pode_ver_lousa}
                podeVerFotos={perm.pode_ver_fotos}
                podeVerPdfs={perm.pode_ver_pdfs}
                podeVerOrcamento={perm.pode_ver_orcamento}
                podeVerAnotacoes={perm.pode_ver_anotacoes}
                onOpenDetalhes={onOpenDetalhes}
                onSemPermissao={onSemPermissao}
              />
            );
          })}
        </div>
      )}

      {/* Churned leads */}
      {churnedLeads.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={11} style={{ color: 'rgba(239,68,68,0.55)' }} />
            <p
              style={{
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(239,68,68,0.5)',
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 600,
              }}
            >
              Não convertidos ({churnedLeads.length})
            </p>
          </div>
          {churnedLeads.map((lead) => {
            const perm = getPerm(lead.leadId);
            return (
              <LeadCard
                key={`${lead.leadId}-${lead.fieldId}`}
                lead={lead}
                etiquetas={getPrestadorLeadEtiquetas(lead, etiquetasMap)}
                podeAbrir={perm.pode_abrir}
                podeVerDetalhes={perm.pode_ver_detalhes}
                podeVerLousa={perm.pode_ver_lousa}
                podeVerFotos={perm.pode_ver_fotos}
                podeVerPdfs={perm.pode_ver_pdfs}
                podeVerOrcamento={perm.pode_ver_orcamento}
                podeVerAnotacoes={perm.pode_ver_anotacoes}
                onOpenDetalhes={onOpenDetalhes}
                onSemPermissao={onSemPermissao}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
