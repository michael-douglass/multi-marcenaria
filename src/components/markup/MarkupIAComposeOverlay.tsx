import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Loader2,
  MinusCircle,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { MarkupIAComposeEvent } from '@/lib/markup-compose-api';
import type {
  MarkupIAVerificacaoCategoriaResultado,
  MarkupIAVerificacaoItemStatus,
} from '@/lib/markup-ia-verificacao';
import type { LeadAIAnalysisItemPayload } from '@/lib/lead-ai-media-sources';
import { MarkupIAFluxoVerificacao } from '@/components/markup/MarkupIAFluxoVerificacao';
import { MarkupIAAgentesStrip } from '@/components/markup/MarkupIAAgentesStrip';
import { MarkupIAProjetistaPanel } from '@/components/markup/MarkupIAProjetistaPanel';
import { MarkupIAMoveisMarkers } from '@/components/markup/MarkupIAMoveisMarkers';
import { MarkupIAFidelidadePanel } from '@/components/markup/MarkupIAFidelidadePanel';
import { MarkupIAKitScene } from '@/components/markup/MarkupIAKitScene';
import { agenteAtivoFromComposeEvents } from '@/lib/markup-ia-prompts';
import type { MarkupIAFidelidadeInventario } from '@/lib/markup-ia-fidelidade';
import type { MarkupIAProjetistaResult } from '@/lib/markup-types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const CATEGORIAS_CRITICAS = new Set(['chapas_mdf', 'ferragens_corr_dobr', 'fita_borda']);

type CategoriaEstado = 'idle' | 'scanning' | 'done' | 'warning';

interface CategoriaUI {
  id: string;
  nome: string;
  estado: CategoriaEstado;
  resultados?: MarkupIAVerificacaoCategoriaResultado;
}

interface MarkupIAComposeOverlayProps {
  open: boolean;
  events: MarkupIAComposeEvent[];
  categoriaIds: string[];
  categoriaNomes: Record<string, string>;
  onCancel?: () => void;
  error?: string | null;
  /** Mesmos anexos enviados pra IA — usado só para desenhar os móveis marcados sobre a imagem/página. */
  itens?: LeadAIAnalysisItemPayload[];
}

function etapaFromEvent(
  type: MarkupIAComposeEvent['type'],
  message?: string,
): string | undefined {
  switch (type) {
    case 'log': {
      const msg = message?.toLowerCase() ?? '';
      if (msg.includes('preparando anexos') || msg.includes('texto nativo') || msg.includes('extraindo')) {
        return 'anexos';
      }
      if (msg.includes('confer')) return 'validacao';
      return undefined;
    }
    case 'media_ready':
    case 'cortecloud_mode':
      return 'anexos';
    case 'fidelidade_scanning':
    case 'fidelidade_result':
      return 'fidelidade';
    case 'projetista_scanning':
    case 'projetista_reconcile':
    case 'projetista_result':
      return 'projetista';
    case 'category_scanning':
    case 'category_result':
      return 'inventariante';
    case 'auditor_inventario':
    case 'validating':
    case 'auditor_projetista':
      return 'auditor';
    case 'inventariante_retry':
    case 'retry':
      return 'retry';
    case 'catalogo':
    case 'composing':
      return 'precificador';
    case 'complete':
      return 'validacao';
    case 'error':
      return undefined;
    default:
      return undefined;
  }
}

function statusIcon(status: MarkupIAVerificacaoItemStatus) {
  switch (status) {
    case 'encontrado':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
    case 'ausente_documento':
      return <XCircle className="h-3.5 w-3.5 text-orange-500 shrink-0" />;
    case 'inventado':
      return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
    case 'referencia_apenas':
    case 'nao_aplicavel':
      return <MinusCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-slate-500 shrink-0" />;
  }
}

export function MarkupIAComposeOverlay({
  open,
  events,
  categoriaIds,
  categoriaNomes,
  onCancel,
  error,
  itens,
}: MarkupIAComposeOverlayProps) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const [categorias, setCategorias] = useState<CategoriaUI[]>([]);

  useEffect(() => {
    if (!open) {
      setCategorias(
        categoriaIds.map((id) => ({
          id,
          nome: categoriaNomes[id] ?? id,
          estado: 'idle',
        })),
      );
    }
  }, [open, categoriaIds, categoriaNomes]);

  useEffect(() => {
    if (!open || events.length === 0) return;

    const last = events[events.length - 1];
    setCategorias((prev) => {
      const next = prev.length
        ? [...prev]
        : categoriaIds.map((id) => ({
            id,
            nome: categoriaNomes[id] ?? id,
            estado: 'idle' as CategoriaEstado,
          }));

      if (last.type === 'category_scanning') {
        const data = last.data as { categoriaId?: string } | undefined;
        const idx = next.findIndex((c) => c.id === data?.categoriaId);
        if (idx >= 0) next[idx] = { ...next[idx], estado: 'scanning' };
      }

      if (last.type === 'category_result') {
        const cat = last.data as MarkupIAVerificacaoCategoriaResultado;
        const idx = next.findIndex((c) => c.id === cat.categoria_id);
        const encontrados = cat.itens?.filter((i) => i.status === 'encontrado').length ?? 0;
        const ausentes = cat.itens?.filter((i) => i.status === 'ausente_documento').length ?? 0;
        const critica = CATEGORIAS_CRITICAS.has(cat.categoria_id);
        const estado: CategoriaEstado =
          encontrados > 0 ? 'done' : critica || ausentes > 0 ? 'warning' : 'warning';
        if (idx >= 0) {
          next[idx] = { ...next[idx], estado, resultados: cat };
        }
      }

      return next;
    });
  }, [events, open, categoriaIds, categoriaNomes]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  const etapaAtiva = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      const etapa = etapaFromEvent(ev.type, ev.message);
      if (etapa) return etapa;
    }
    return 'anexos';
  }, [events]);

  const agenteAtivo = useMemo(() => agenteAtivoFromComposeEvents(events), [events]);

  const levantamentoProjetista = useMemo((): MarkupIAProjetistaResult | null => {
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].type === 'projetista_result' && events[i].data) {
        return events[i].data as MarkupIAProjetistaResult;
      }
    }
    return null;
  }, [events]);

  const yamlFidelidade = useMemo((): MarkupIAFidelidadeInventario | null => {
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].type === 'fidelidade_result' && events[i].data) {
        return events[i].data as MarkupIAFidelidadeInventario;
      }
    }
    return null;
  }, [events]);

  const fidelidadeScanning =
    events.some((e) => e.type === 'fidelidade_scanning') && !yamlFidelidade;

  const emReconcile = events.some((e) => e.type === 'projetista_reconcile');

  const projetistaScanning =
    (events.some((e) => e.type === 'projetista_scanning') || emReconcile) &&
    !levantamentoProjetista;

  const modoCortecloud = useMemo(() => {
    const ev = events.find((e) => e.type === 'cortecloud_mode');
    return (ev?.data as { active?: boolean } | undefined)?.active === true;
  }, [events]);

  const isComplete = events.some((e) => e.type === 'complete');
  const isError = Boolean(error) || events.some((e) => e.type === 'error');

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col overflow-hidden">
      {/* Fundo esfumaçado — só durante composição IA */}
      <div className="pointer-events-none absolute inset-0 bg-slate-950/88 backdrop-blur-[6px]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(251,191,36,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.6) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative flex flex-1 flex-col gap-3 overflow-hidden p-3 sm:gap-4 sm:p-5">
        <div className="flex shrink-0 items-start justify-between gap-3 px-0.5">
          <div>
            <p
              className="text-lg tracking-wide text-amber-400"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              Oficina Íris — recriando o projeto
            </p>
            <p className="text-xs text-slate-400 sm:text-sm">
              Cada peça só entra se estiver no documento. Na dúvida, fidelidade.
            </p>
          </div>
          {!isComplete && onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} className="shrink-0 text-slate-400">
              Cancelar
            </Button>
          )}
        </div>

        {/* Fluxo flutuante esfumaçado — visível só durante composição */}
        <div className="relative z-20 mx-auto w-full max-w-4xl shrink-0 space-y-2 px-0.5">
          <MarkupIAFluxoVerificacao etapaAtiva={etapaAtiva} variant="floating" />
          <MarkupIAAgentesStrip agenteAtivo={agenteAtivo} compact />
        </div>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,1fr)] lg:gap-4">
          <div className="flex min-h-0 flex-col gap-3">
            <MarkupIAKitScene
              fidelidade={yamlFidelidade}
              scanning={fidelidadeScanning || (!yamlFidelidade && !isComplete && !isError)}
              className="h-[200px] shrink-0 lg:h-[240px]"
            />
            <MarkupIAFidelidadePanel fidelidade={yamlFidelidade} scanning={fidelidadeScanning} />
          </div>

          <div className="flex min-h-0 flex-col rounded-xl border border-amber-500/20 bg-slate-900/80">
            <div className="border-b border-amber-500/10 px-4 py-2.5 flex items-center gap-2">
              {!isComplete && !isError && (
                <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
              )}
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium text-slate-200">Log da composição</span>
            </div>
            <ScrollArea className="flex-1 p-4">
              <ul className="space-y-2 font-mono text-xs text-slate-300">
                {events.map((ev, i) => (
                  <li
                    key={`${ev.type}-${i}`}
                    className={cn(
                      'animate-in fade-in slide-in-from-left-2 duration-300',
                      ev.type === 'error' && 'text-red-400',
                      ev.type === 'complete' && 'text-emerald-400',
                    )}
                  >
                    <span className="text-amber-500/70">[{ev.type}]</span>{' '}
                    {ev.message ?? ''}
                  </li>
                ))}
                {error && <li className="text-red-400">[error] {error}</li>}
                <div ref={logEndRef} />
              </ul>
            </ScrollArea>
          </div>

          <div className="flex min-h-0 flex-col gap-3 rounded-xl border border-amber-500/20 bg-slate-900/80 p-3">
            {levantamentoProjetista && itens && itens.length > 0 && (
              <div className="rounded-lg border border-violet-500/20 bg-slate-950/40 p-2">
                <MarkupIAMoveisMarkers itens={itens} moveis={levantamentoProjetista.moveis} />
              </div>
            )}
            {(projetistaScanning || emReconcile || levantamentoProjetista) &&
              (!modoCortecloud || emReconcile || levantamentoProjetista) && (
              <MarkupIAProjetistaPanel
                levantamento={levantamentoProjetista}
                scanning={projetistaScanning}
                modoComplemento={emReconcile || levantamentoProjetista?.defaults_aplicados.some((d) =>
                  d.toLowerCase().includes('complemento'),
                )}
              />
            )}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-amber-500/10">
            <div className="border-b border-amber-500/10 px-4 py-2.5">
              <span className="text-sm font-medium text-slate-200">
                {modoCortecloud ? 'Checklist Cortecloud' : 'Inventário de materiais'}
              </span>
            </div>
            <ScrollArea className="flex-1 p-3">
              <ul className="space-y-2">
                {categorias.map((cat, index) => (
                  <li
                    key={cat.id}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 transition-all duration-300',
                      cat.estado === 'scanning' && 'border-amber-500/50 bg-amber-500/10 animate-pulse',
                      cat.estado === 'done' && 'border-emerald-500/30 bg-emerald-500/5',
                      cat.estado === 'warning' && 'border-slate-600 bg-slate-800/50',
                      cat.estado === 'idle' && 'border-slate-700/80 bg-slate-800/30 opacity-70',
                    )}
                    style={{ animationDelay: `${index * 120}ms` }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-200">{cat.nome}</span>
                      <div className="flex items-center gap-1.5">
                        {CATEGORIAS_CRITICAS.has(cat.id) && cat.estado === 'warning' && (
                          <Badge variant="destructive" className="h-5 px-1.5 text-[9px]">
                            Crítico
                          </Badge>
                        )}
                        {cat.estado === 'scanning' && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                        )}
                        {cat.estado === 'done' && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        )}
                        {cat.estado === 'warning' && (
                          <XCircle className="h-3.5 w-3.5 text-orange-500" />
                        )}
                      </div>
                    </div>
                    {cat.resultados && cat.resultados.itens.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-slate-700/50 pt-2">
                        {cat.resultados.itens
                          .filter(
                            (i) =>
                              i.status === 'encontrado' ||
                              i.status === 'inventado' ||
                              i.status === 'ausente_documento',
                          )
                          .slice(0, 8)
                          .map((item) => (
                            <li
                              key={`${item.nome}-${item.variacao}-${item.status}`}
                              className={cn(
                                'flex items-start gap-1.5 text-[11px]',
                                item.status === 'ausente_documento' && 'text-orange-400/90',
                                item.status === 'inventado' && 'text-red-400/90',
                                item.status === 'encontrado' && 'text-slate-400',
                              )}
                            >
                              {statusIcon(item.status)}
                              <span>
                                {item.nome}
                                {item.variacao ? ` (${item.variacao})` : ''}
                                {item.quantidade != null ? ` × ${item.quantidade}` : ''}
                                {item.status === 'ausente_documento' && ' — ausente'}
                                {item.status === 'inventado' && ' — inventado'}
                              </span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
