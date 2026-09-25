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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  /** Modal/aba aberta — auto só roda com a chave ligada */
  indexingActive?: boolean;
  /** `button` = controle discreto no painel da IA; `card` = painel completo (legado) */
  variant?: 'card' | 'compact' | 'button';
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
  const discrete = variant === 'compact' || variant === 'button';

  if (configLoading) return null;

  if (knowledgeDisabled) {
    if (discrete) return null;
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

  if (discrete) {
    const chunkHint =
      knowledgeMeta?.chunkCount && knowledgeMeta.chunkCount > 0
        ? `${knowledgeMeta.chunkCount}`
        : null;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            title="Memória da Íris — indexar PDFs e fotos para o chat"
            className={cn(
              'h-7 gap-1.5 px-2 text-[10px] font-normal text-cream-muted',
              'hover:bg-gold/5 hover:text-gold',
              'focus-visible:ring-1 focus-visible:ring-gold/40',
              busy && 'opacity-80',
              className,
            )}
            aria-label="Memória da Íris — indexar documentos para o chat"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-gold/80" aria-hidden />
            ) : (
              <Database className="h-3.5 w-3.5 opacity-70" aria-hidden />
            )}
            <span className="hidden sm:inline">Memória</span>
            {chunkHint && !busy ? (
              <span className="rounded bg-gold/10 px-1 py-px text-[9px] tabular-nums text-gold/80">
                {chunkHint}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-72 space-y-3 border-gold-border-subtle/30 bg-mahogany-elevated p-3 shadow-lg"
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-cream-secondary">Memória da Íris</p>
            <p className="text-[10px] leading-snug text-cream-muted">
              Transforma PDFs, fotos e dados do lead em memória para a IA consultar no chat —
              sem gastar tokens à toa.
            </p>
            <p className="flex items-center gap-1.5 pt-0.5 text-[10px] text-cream-muted">
              <Sparkles className="h-3 w-3 shrink-0 text-gold/60" aria-hidden />
              {statusText}
            </p>
          </div>

          <div
            className={cn(
              'flex items-center justify-between gap-2 rounded-md border border-gold-border-subtle/20',
              'bg-mahogany-muted/30 px-2.5 py-2',
              autoIndex && 'border-gold/20 bg-gold/[0.03]',
            )}
          >
            <Label
              htmlFor={`iris-auto-index-${leadId}-btn`}
              className="cursor-pointer text-[10px] font-normal leading-snug text-cream-muted"
            >
              Indexar ao abrir a análise
            </Label>
            <Switch
              id={`iris-auto-index-${leadId}-btn`}
              checked={autoIndex}
              onCheckedChange={setAutoIndex}
              disabled={busy}
              className="scale-90 shrink-0 data-[state=checked]:bg-gold"
            />
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void indexNow({ force: true })}
            className="h-8 w-full gap-1.5 border-gold/30 bg-gold/5 text-[11px] text-gold hover:bg-gold/15 hover:text-gold"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {busy ? 'Indexando…' : 'Indexar agora'}
          </Button>
        </PopoverContent>
      </Popover>
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

      <div className="relative space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
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
              <p className="text-xs leading-relaxed text-cream-muted">
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
          <div className="min-w-0 space-y-0.5">
            <Label
              htmlFor={`iris-auto-index-${leadId}`}
              className="cursor-pointer text-xs font-medium text-cream-secondary"
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            disabled={busy}
            onClick={() => void indexNow({ force: true })}
            className={cn(
              'relative flex-1 gap-2 overflow-hidden border border-gold/40',
              'bg-gradient-to-r from-gold/90 via-amber-300/90 to-gold/80',
              'font-semibold text-mahogany-deep shadow-lg shadow-gold/15',
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
