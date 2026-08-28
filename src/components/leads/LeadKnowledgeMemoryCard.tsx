import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BrainCircuit,
  Database,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { usePipelineLeadAIConfig } from '@/hooks/usePipelineLeadAIConfig';
import {
  useLeadKnowledgeAutoIndexPreference,
  useLeadKnowledgeIndexNow,
} from '@/hooks/useLeadKnowledgeIndexControl';
import { useAutoIndexLeadKnowledge } from '@/hooks/useAutoIndexLeadKnowledge';
import { useLeadKnowledgeMeta } from '@/hooks/useLeadSkyChat';

interface LeadKnowledgeMemoryCardProps {
  leadId: number;
  leadRevision?: string | null;
  /** Modal aberto — auto só roda com a chave ligada */
  indexingActive?: boolean;
  variant?: 'card' | 'compact';
  className?: string;
}

function statusLabel(meta: {
  status: string;
  chunkCount: number;
  indexedAt: string | null;
} | null | undefined) {
  if (!meta) return 'Ainda não indexado';
  if (meta.status === 'indexing') return 'Indexando documentos…';
  if (meta.status === 'error') return 'Erro na última indexação';
  if (meta.chunkCount > 0) {
    const when = meta.indexedAt
      ? formatDistanceToNow(new Date(meta.indexedAt), { addSuffix: true, locale: ptBR })
      : null;
    return `${meta.chunkCount} trecho${meta.chunkCount === 1 ? '' : 's'}${when ? ` · ${when}` : ''}`;
  }
  return 'Pronto para indexar';
}

export function LeadKnowledgeMemoryCard({
  leadId,
  leadRevision,
  indexingActive = true,
  variant = 'card',
  className,
}: LeadKnowledgeMemoryCardProps) {
  const { config, isLoading: configLoading } = usePipelineLeadAIConfig();
  const { autoIndex, setAutoIndex } = useLeadKnowledgeAutoIndexPreference(leadId);
  const { indexNow, isIndexing, mediaLoading } = useLeadKnowledgeIndexNow(leadId);
  const { data: knowledgeMeta } = useLeadKnowledgeMeta(
    config.irisSkyKnowledgeAtivo ? leadId : null,
  );

  useAutoIndexLeadKnowledge(
    leadId,
    indexingActive && autoIndex,
    leadRevision,
    autoIndex,
  );

  const knowledgeDisabled = !config.irisSkyKnowledgeAtivo;
  const busy = isIndexing || mediaLoading || knowledgeMeta?.status === 'indexing';
  const statusText = statusLabel(knowledgeMeta);

  if (configLoading) return null;

  if (knowledgeDisabled) {
    if (variant === 'compact') return null;
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-gold-border-subtle/25 bg-mahogany-muted/20 px-4 py-3',
          className,
        )}
      >
        <p className="text-xs text-cream-muted">
          A memória vetorial da Íris Sky está desativada nas configurações do pipeline.
        </p>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-lg border border-gold-border-subtle/20',
          'bg-gradient-to-r from-mahogany-elevated/80 via-mahogany-card/60 to-mahogany-elevated/40',
          'px-3 py-2',
          className,
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gold/10 border border-gold/20">
            <Database className="h-3.5 w-3.5 text-gold" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-cream-secondary truncate">Memória vetorial</p>
            <p className="text-[10px] text-cream-muted truncate">{statusText}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 pr-1">
            <Switch
              id={`iris-auto-index-${leadId}-compact`}
              checked={autoIndex}
              onCheckedChange={setAutoIndex}
              disabled={busy}
              className="scale-90 data-[state=checked]:bg-gold"
            />
            <Label
              htmlFor={`iris-auto-index-${leadId}-compact`}
              className="text-[10px] text-cream-muted cursor-pointer whitespace-nowrap"
            >
              Auto
            </Label>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void indexNow({ force: true })}
            className="h-7 gap-1 border-gold/30 bg-gold/5 text-gold hover:bg-gold/15 hover:text-gold text-[10px] px-2"
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Indexar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <section
      className={cn(
        'group relative overflow-hidden rounded-xl border border-gold-border-subtle/30',
        'bg-gradient-to-br from-mahogany-card via-mahogany-elevated/90 to-mahogany-deep/40',
        'shadow-[inset_0_1px_0_0_rgba(212,175,55,0.08)]',
        className,
      )}
      aria-labelledby={`iris-memory-title-${leadId}`}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold/5 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-amber-500/5 blur-xl"
        aria-hidden
      />

      <div className="relative p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                'bg-gradient-to-br from-gold/20 via-amber-400/10 to-transparent',
                'border border-gold/25 shadow-inner shadow-gold/10',
              )}
            >
              <BrainCircuit className="h-5 w-5 text-gold" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <h3
                id={`iris-memory-title-${leadId}`}
                className="text-sm font-semibold tracking-tight text-cream-secondary"
              >
                Memória da Íris
              </h3>
              <p className="text-xs text-cream-muted leading-relaxed">
                Transforme PDFs, fotos e dados do lead em vetores para a IA consultar no chat —
                só quando você pedir, sem gastar tokens à toa.
              </p>
            </div>
          </div>
        </div>

        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-lg border border-gold-border-subtle/20',
            'bg-mahogany-muted/30 px-3 py-2.5 transition-colors',
            autoIndex && 'border-gold/25 bg-gold/[0.04]',
          )}
        >
          <div className="space-y-0.5 min-w-0">
            <Label
              htmlFor={`iris-auto-index-${leadId}`}
              className="text-xs font-medium text-cream-secondary cursor-pointer"
            >
              Indexar automaticamente ao abrir
            </Label>
            <p className="text-[10px] text-cream-muted">
              {autoIndex
                ? 'Atualiza a memória quando você abre o card ou muda anexos.'
                : 'Desligado — use o botão abaixo quando quiser atualizar.'}
            </p>
          </div>
          <Switch
            id={`iris-auto-index-${leadId}`}
            checked={autoIndex}
            onCheckedChange={setAutoIndex}
            disabled={busy}
            className="shrink-0 data-[state=checked]:bg-gold"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button
            type="button"
            disabled={busy}
            onClick={() => void indexNow({ force: true })}
            className={cn(
              'relative flex-1 gap-2 overflow-hidden border border-gold/40',
              'bg-gradient-to-r from-gold/90 via-amber-300/90 to-gold/80',
              'text-mahogany-deep font-semibold shadow-lg shadow-gold/15',
              'hover:from-gold hover:via-amber-300 hover:to-gold hover:shadow-gold/25',
              'transition-all duration-300',
            )}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {busy ? 'Indexando documentos…' : 'Indexar memória agora'}
          </Button>
          <div className="flex items-center gap-2 text-[11px] text-cream-muted sm:max-w-[45%]">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-gold/70" aria-hidden />
            <span className="leading-snug">{statusText}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
