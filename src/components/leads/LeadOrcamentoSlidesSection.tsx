import { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CopyPlus, Eye, EyeOff, Link2, Loader2, Pencil, Presentation, Plus, Send, CheckCircle2, Cloud, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { GarboBrandLoader } from '@/components/ui/garbo-brand-loader';
import { useOrcamentosPorLead, useOrcamentoSlides } from '@/hooks/useOrcamentoSlides';
import type { OrcamentoSlideStatus } from '@/lib/orcamento-slide-types';
import { buildLeadCardReturnTo, withOrcamentoReturnTo } from '@/lib/orcamento-slide-navigation';
import { valorInvestimentoParaLead } from '@/lib/orcamento-slide-lead-sync';
import { BRL } from '@/lib/orcamento-slide-precificacao';
import { isLinkPublicoAtivo, linkPublicoOrcamento } from '@/lib/orcamento-slide-public-link';
import { setOrcamentoVisualizarOpenFlag } from '@/lib/dialog-outside-guard';
import { bindOrcamentoVisualizarScrollPassthrough } from '@/lib/overlay-scroll-passthrough';
import type { OrcamentoSlide } from '@/lib/orcamento-slide-types';
import type { LeadPrestadorPermissao } from '@/hooks/useLeadPrestadorPermissoes';
import { isOrcamentoVisivelParaPrestador } from '@/lib/prestador-visibilidade';

const ApresentarOrcamentoSlidePage = lazy(
  () => import('@/pages/orcamento-slides/ApresentarOrcamentoSlidePage'),
);

const STATUS_CONFIG: Record<OrcamentoSlideStatus, { label: string; color: string; icon: React.ReactNode }> = {
  rascunho: { label: 'Rascunho', color: 'bg-violet-500/15 text-violet-400 border-violet-500/30', icon: <Cloud className="h-3 w-3" /> },
  pronto:   { label: 'Pronto',   color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',    icon: <CheckCircle2 className="h-3 w-3" /> },
  enviado:  { label: 'Enviado',  color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: <Send className="h-3 w-3" /> },
};

interface LeadOrcamentoSlidesSectionProps {
  leadId: number;
  readOnly?: boolean;
  /** Modo prestador: filtra orçamentos liberados pelo admin */
  prestadorPerm?: LeadPrestadorPermissao | null;
  /**
   * Mantém a visualização se o card do lead remontar.
   * Desligue quando a seção também aparece fora do card (ex.: tela de contrato),
   * para não abrir duas apresentações ao mesmo tempo.
   */
  persistVisualizarAcrossRemount?: boolean;
}

/** Já estamos na tela de criar/editar — evita reabrir o mesmo fluxo pelo card. */
function isOrcamentoEditorPath(pathname: string): boolean {
  return /^\/orcamento-slides\/(novo|[^/]+\/editar)\/?$/.test(pathname);
}

/** Sobrevive se o card do lead remontar ao soltar o travamento de foco. */
let lastVisualizarOrcamentoId: string | null = null;

export function LeadOrcamentoSlidesSection({
  leadId,
  readOnly = false,
  prestadorPerm = null,
  persistVisualizarAcrossRemount = true,
}: LeadOrcamentoSlidesSectionProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { schemaEmpresa } = useEmpresa();
  const returnToLeadCard = buildLeadCardReturnTo(location.pathname, location.search, leadId);
  const insideOrcamentoEditor = isOrcamentoEditorPath(location.pathname);
  const { data: orcamentosRaw = [], isLoading } = useOrcamentosPorLead(leadId);
  const orcamentos = prestadorPerm
    ? orcamentosRaw.filter((o) => isOrcamentoVisivelParaPrestador(o.id, prestadorPerm))
    : orcamentosRaw;
  const isPrestadorView = !!prestadorPerm;
  const { excluirOrcamento, atualizarLinkPublico, duplicarOrcamento } = useOrcamentoSlides();
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [duplicandoId, setDuplicandoId] = useState<string | null>(null);
  const [visualizarId, setVisualizarId] = useState<string | null>(() =>
    persistVisualizarAcrossRemount ? lastVisualizarOrcamentoId : null,
  );

  const abrirVisualizacao = (id: string) => {
    if (persistVisualizarAcrossRemount) lastVisualizarOrcamentoId = id;
    setOrcamentoVisualizarOpenFlag(true);
    setVisualizarId(id);
  };

  const fecharVisualizacao = () => {
    if (persistVisualizarAcrossRemount) lastVisualizarOrcamentoId = null;
    setOrcamentoVisualizarOpenFlag(false);
    setVisualizarId(null);
  };

  useEffect(() => {
    setOrcamentoVisualizarOpenFlag(Boolean(visualizarId));
    if (!visualizarId) return () => setOrcamentoVisualizarOpenFlag(false);
    const unbindScroll = bindOrcamentoVisualizarScrollPassthrough();
    return () => {
      unbindScroll();
      setOrcamentoVisualizarOpenFlag(false);
    };
  }, [visualizarId]);

  useEffect(() => {
    if (!visualizarId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      fecharVisualizacao();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [visualizarId]);

  const getLinkPublico = (id: string) => linkPublicoOrcamento(schemaEmpresa ?? 'public', id);

  const copiarLink = (orcamento: OrcamentoSlide) => {
    const url = getLinkPublico(orcamento.id);
    navigator.clipboard.writeText(url)
      .then(() => toast.success('Link copiado!', {
        description: isLinkPublicoAtivo(orcamento)
          ? 'Envie ao cliente — qualquer pessoa com o link pode ver.'
          : 'O link está oculto. Ative-o antes de compartilhar.',
      }))
      .catch(() => toast.error('Erro ao copiar link'));
  };

  const alternarLinkPublico = (orcamento: OrcamentoSlide) => {
    const oculto = isLinkPublicoAtivo(orcamento);
    atualizarLinkPublico.mutate({
      id: orcamento.id,
      dados: orcamento.dados,
      lead_id: orcamento.lead_id,
      oculto,
    });
  };

  const handleExcluir = () => {
    if (!excluirId) return;
    excluirOrcamento.mutate(excluirId, { onSuccess: () => setExcluirId(null) });
  };

  const handleDuplicar = (orcamento: OrcamentoSlide) => {
    setDuplicandoId(orcamento.id);
    duplicarOrcamento.mutate(orcamento, {
      onSettled: () => setDuplicandoId(null),
    });
  };

  return (
    <div className="space-y-3 w-full min-w-0">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Presentation className="h-4 w-4 text-amber-400" />
          Orçamentos vinculados
          {orcamentos.length > 0 && (
            <Badge variant="secondary" className="text-xs h-5">
              {orcamentos.length}
            </Badge>
          )}
        </Label>
        {!readOnly && !isPrestadorView && !insideOrcamentoEditor && (
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
              onClick={() =>
                navigate(
                  withOrcamentoReturnTo(
                    `/orcamento-slides/novo?leadId=${leadId}&novo=1`,
                    returnToLeadCard,
                  ),
                )
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Criar orçamento
            </Button>
          </div>
        )}
        {!readOnly && !isPrestadorView && insideOrcamentoEditor && (
          <Badge variant="outline" className="h-7 text-[10px] border-amber-500/30 text-amber-200/90">
            Editando orçamento
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
        </div>
      ) : orcamentos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 py-6 px-4 text-center text-sm text-muted-foreground">
          {isPrestadorView
            ? 'Nenhum orçamento liberado para você neste lead.'
            : 'Nenhum orçamento criado para este lead.'}
          {!readOnly && !isPrestadorView && (
            <p className="text-xs mt-2">
              Clique em &quot;Criar orçamento&quot; para montar uma apresentação.
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {orcamentos.map((o) => {
            const cfg = STATUS_CONFIG[o.status];
            const investimento = valorInvestimentoParaLead(o.dados?.precificacao);
            const desconto = o.dados?.precificacao?.desconto_percent ?? 0;
            const acrescimo = o.dados?.precificacao?.acrescimo_percent ?? 0;
            const linkAtivo = isLinkPublicoAtivo(o);
            const linkUrl = getLinkPublico(o.id);
            return (
              <li
                key={o.id}
                className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 group space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Presentation className="h-4 w-4 text-amber-400 shrink-0" />
                  <button
                    type="button"
                    className="min-w-0 flex-1 rounded-md text-left hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => abrirVisualizacao(o.id)}
                    aria-label={`Ver apresentação ${o.cliente_nome || o.identificador}`}
                  >
                    <p className="text-sm font-medium truncate">{o.cliente_nome || o.identificador}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge className={`${cfg.color} gap-1 border text-[10px]`} variant="outline">
                        {cfg.icon}
                        {cfg.label}
                      </Badge>
                      {!linkAtivo && (
                        <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground gap-1">
                          <EyeOff className="h-3 w-3" />
                          Link oculto
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {o.identificador}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(o.criado_em), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                      {investimento > 0 && (
                        <p className="text-xs text-maroon font-medium">
                          Investimento: {BRL(investimento)}
                          {desconto > 0 && (
                            <span className="text-muted-foreground font-normal">
                              {' '}
                              ({desconto}% desc.)
                            </span>
                          )}
                          {acrescimo > 0 && (
                            <span className="text-muted-foreground font-normal">
                              {' '}
                              (+{acrescimo}% acrésc.)
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1 text-xs"
                      aria-label={`Ver apresentação ${o.cliente_nome || o.identificador}`}
                      onClick={() => abrirVisualizacao(o.id)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Ver</span>
                    </Button>
                    {!readOnly && !isPrestadorView && (
                      <>
                        {!insideOrcamentoEditor && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-xs"
                            onClick={() =>
                              navigate(withOrcamentoReturnTo(`/orcamento-slides/${o.id}/editar`, returnToLeadCard))
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Editar</span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 text-xs"
                          disabled={duplicandoId === o.id || duplicarOrcamento.isPending}
                          onClick={() => handleDuplicar(o)}
                          title="Duplicar orçamento com imagens, textos e preços"
                          aria-label="Duplicar orçamento"
                        >
                          {duplicandoId === o.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CopyPlus className="h-3.5 w-3.5" />
                          )}
                          <span className="hidden sm:inline">
                            {duplicandoId === o.id ? 'Duplicando…' : 'Duplicar'}
                          </span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => setExcluirId(o.id)}
                          disabled={duplicandoId === o.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-6 flex-wrap">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 rounded-md border border-amber-500/15 bg-background/40 px-2 py-1">
                    <Link2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span className="text-[11px] text-muted-foreground truncate font-mono" title={linkUrl}>
                      {linkUrl}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs border-amber-500/30 text-amber-200 hover:bg-amber-500/10"
                    onClick={() => copiarLink(o)}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Copiar link
                  </Button>
                  {!readOnly && !isPrestadorView && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => alternarLinkPublico(o)}
                      disabled={atualizarLinkPublico.isPending}
                      title={linkAtivo ? 'Ocultar link público' : 'Ativar link público'}
                    >
                      {linkAtivo ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" />
                          Ocultar
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" />
                          Mostrar
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={!!excluirId} onOpenChange={(open) => !open && setExcluirId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O orçamento e as imagens vinculadas a ele serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleExcluir}
              disabled={excluirOrcamento.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {visualizarId
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Visualizar apresentação do orçamento"
              data-nested-dialog=""
              data-orcamento-visualizar=""
              data-scroll-lock-ignore=""
              className="fixed inset-0 z-[240] flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-visible overscroll-y-contain pointer-events-auto bg-[#0a0706]"
            >
              <Suspense fallback={<GarboBrandLoader variant="fullscreen" message="Preparando apresentação…" />}>
                <ApresentarOrcamentoSlidePage
                  orcamentoId={visualizarId}
                  onVoltar={fecharVisualizacao}
                />
              </Suspense>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
