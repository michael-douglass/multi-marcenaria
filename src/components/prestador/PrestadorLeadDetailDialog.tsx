import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { X, Phone, Mail, MapPin, Calendar, FileText, PenLine, Files, Presentation } from 'lucide-react';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { LeadWhiteboard } from '@/components/leads/LeadWhiteboard';
import { LeadPDFAttachments } from '@/components/leads/LeadPDFAttachments';
import { LeadOrcamentoSlidesSection } from '@/components/leads/LeadOrcamentoSlidesSection';
import type { ComissaoLead } from '@/hooks/usePontuaGarboFinanceiro';
import type { LeadPrestadorPermissao } from '@/hooks/useLeadPrestadorPermissoes';
import { podeVerAlgumAnexo } from '@/lib/prestador-visibilidade';

const PUBLIC_LEADS = 'CRM-multi-empresas>leads<' as const;

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type TabId = 'detalhes' | 'lousa' | 'projetos' | 'orcamentos';

interface PrestadorLeadDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: ComissaoLead | null;
  podeVerDetalhes?: boolean;
  podeVerLousa?: boolean;
  podeVerAnexos?: boolean;
  podeVerObservacoes?: boolean;
  prestadorPerm?: LeadPrestadorPermissao | null;
}

export function PrestadorLeadDetailDialog({
  open,
  onOpenChange,
  lead,
  podeVerDetalhes = false,
  podeVerLousa = false,
  podeVerAnexos = false,
  podeVerObservacoes = false,
  prestadorPerm = null,
}: PrestadorLeadDetailDialogProps) {
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const leadsTable = table('leads', PUBLIC_LEADS);

  const podeVerArquivos = prestadorPerm ? podeVerAlgumAnexo(prestadorPerm) : podeVerAnexos;
  const podeVerOrcamento = prestadorPerm?.pode_ver_orcamento ?? false;

  const tabs = useMemo(() => {
    const list: { id: TabId; label: string; icon: typeof FileText }[] = [];
    if (podeVerDetalhes) list.push({ id: 'detalhes', label: 'Detalhes', icon: FileText });
    if (podeVerLousa) list.push({ id: 'lousa', label: 'Lousa', icon: PenLine });
    if (podeVerArquivos) list.push({ id: 'projetos', label: 'Arquivos', icon: Files });
    if (podeVerOrcamento) list.push({ id: 'orcamentos', label: 'Orçamentos', icon: Presentation });
    return list;
  }, [podeVerDetalhes, podeVerLousa, podeVerArquivos, podeVerOrcamento]);

  const [activeTab, setActiveTab] = useState<TabId>('detalhes');

  const defaultTab = tabs[0]?.id ?? 'detalhes';
  const currentTab = tabs.some((t) => t.id === activeTab) ? activeTab : defaultTab;

  useEffect(() => {
    if (open && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [open, lead?.leadId, tabs]);

  const { data: detalhe, isLoading } = useQuery({
    queryKey: ['prestador-lead-detalhe', schemaEmpresa, lead?.leadId],
    enabled: open && !!lead?.leadId && podeVerDetalhes,
    queryFn: async () => {
      const { data, error } = await db
        .from(leadsTable)
        .select(
          'id, nome, empresa, email, telefone, origem, status, valor_orcamento, observacoes, data_chegada, regiao',
        )
        .eq('id', lead!.leadId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-2 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={() => onOpenChange(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col max-h-[92dvh]"
        style={{
          background: 'linear-gradient(165deg, rgba(18,16,12,0.98) 0%, rgba(8,8,8,0.99) 100%)',
          border: '1px solid rgba(240,210,140,0.25)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 40px rgba(240,210,140,0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prestador-lead-detail-title"
      >
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="min-w-0">
            <p
              id="prestador-lead-detail-title"
              className="text-white font-medium text-base truncate"
              style={{ fontFamily: 'Raleway, sans-serif' }}
            >
              {lead?.leadNome ?? 'Lead'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(240,210,140,0.7)' }}>
              {lead?.leadStatus}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-2 transition-colors hover:bg-white/5 shrink-0"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {tabs.length > 1 && (
          <div
            className="flex gap-1 px-4 pt-3 shrink-0 overflow-x-auto"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-semibold uppercase tracking-wider transition-colors shrink-0"
                  style={{
                    fontFamily: 'Raleway, sans-serif',
                    color: active ? '#f2d892' : 'rgba(255,255,255,0.4)',
                    background: active ? 'rgba(240,210,140,0.1)' : 'transparent',
                    borderBottom: active ? '2px solid #f2d892' : '2px solid transparent',
                  }}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {currentTab === 'detalhes' && podeVerDetalhes && (
            <div className="flex flex-col gap-4">
              {isLoading ? (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Carregando…
                </p>
              ) : !detalhe ? (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Não foi possível carregar os dados.
                </p>
              ) : (
                <>
                  {lead && (
                    <div
                      className="rounded-xl p-3 grid grid-cols-2 gap-3"
                      style={{
                        background: 'rgba(240,210,140,0.06)',
                        border: '1px solid rgba(240,210,140,0.18)',
                      }}
                    >
                      <div>
                        <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          Comissão
                        </p>
                        <p className="text-sm font-semibold" style={{ color: '#f2d892' }}>
                          {BRL(lead.comissao)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          Percentual
                        </p>
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                          {lead.percentual}% · {lead.fieldNome}
                        </p>
                      </div>
                    </div>
                  )}
                  {detalhe.telefone && <DetailRow icon={Phone} label="Telefone" value={detalhe.telefone} />}
                  {detalhe.email && <DetailRow icon={Mail} label="E-mail" value={detalhe.email} />}
                  {detalhe.empresa && <DetailRow label="Empresa" value={detalhe.empresa} />}
                  {detalhe.origem && <DetailRow label="Origem" value={detalhe.origem} />}
                  {detalhe.regiao && <DetailRow icon={MapPin} label="Região" value={detalhe.regiao} />}
                  {detalhe.data_chegada && (
                    <DetailRow
                      icon={Calendar}
                      label="Data de chegada"
                      value={new Date(`${detalhe.data_chegada}T12:00:00`).toLocaleDateString('pt-BR')}
                    />
                  )}
                  <DetailRow label="Orçamento" value={BRL(detalhe.valor_orcamento ?? lead?.valorOrcamento ?? 0)} />
                  {podeVerObservacoes && detalhe.observacoes?.trim() && (
                    <div>
                      <p
                        className="text-[10px] uppercase tracking-widest mb-2"
                        style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}
                      >
                        Observações
                      </p>
                      <p
                        className="text-sm leading-relaxed rounded-lg p-3 whitespace-pre-wrap"
                        style={{
                          color: 'rgba(255,255,255,0.55)',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        {detalhe.observacoes}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {currentTab === 'lousa' && podeVerLousa && lead && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <p
                className="text-xs px-3 py-2"
                style={{
                  color: 'rgba(255,255,255,0.35)',
                  background: 'rgba(255,255,255,0.03)',
                  fontFamily: 'Raleway, sans-serif',
                }}
              >
                Visualização da lousa do projeto — somente leitura
              </p>
              <div className="bg-background/95 p-2">
                <LeadWhiteboard leadId={lead.leadId} disabled />
              </div>
            </div>
          )}

          {currentTab === 'projetos' && podeVerArquivos && lead && (
            <div
              className="rounded-xl p-3"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <p
                className="text-xs mb-3"
                style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'Raleway, sans-serif' }}
              >
                Fotos e PDFs liberados pelo administrador — clique para ampliar
              </p>
              <LeadPDFAttachments leadId={lead.leadId} readOnly prestadorPerm={prestadorPerm} />
            </div>
          )}

          {currentTab === 'orcamentos' && podeVerOrcamento && lead && (
            <div
              className="rounded-xl p-3"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <LeadOrcamentoSlidesSection
                leadId={lead.leadId}
                readOnly
                prestadorPerm={prestadorPerm}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon size={14} className="shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }} />}
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {label}
        </p>
        <p className="text-sm break-words" style={{ color: 'rgba(255,255,255,0.75)' }}>
          {value}
        </p>
      </div>
    </div>
  );
}
