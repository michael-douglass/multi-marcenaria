import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LeadAIRender } from '@/hooks/useLeadAIRenders';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, Loader2, Maximize2, Trash2 } from 'lucide-react';

interface LeadAIRenderHistoryPanelProps {
  historico: LeadAIRender[];
  selectedId: string;
  onSelect: (render: LeadAIRender) => void;
  onFullscreen: (render: LeadAIRender) => void;
  onDelete: (render: LeadAIRender) => void;
  deletingId?: string | null;
  className?: string;
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
  maxHeightClassName?: string;
  showProjectLabel?: boolean;
  originBadgeLabel?: string;
}

export function LeadAIRenderHistoryPanel({
  historico,
  selectedId,
  onSelect,
  onFullscreen,
  onDelete,
  deletingId = null,
  className,
  title = 'Histórico de versões',
  subtitle,
  emptyMessage = 'Nenhuma versão salva ainda.',
  maxHeightClassName = 'max-h-[220px]',
  showProjectLabel = false,
  originBadgeLabel = 'Original',
}: LeadAIRenderHistoryPanelProps) {
  if (historico.length === 0) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-gold-border-subtle/30 bg-mahogany-base/40 px-4 py-6 text-center',
          className,
        )}
      >
        <History className="mx-auto mb-2 h-5 w-5 text-cream-faint" />
        <p className="text-xs text-cream-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-gold-border-subtle/25 bg-mahogany-card/40',
        className,
      )}
    >
      <div className="border-b border-gold-border-subtle/20 bg-mahogany-elevated/40 px-3 py-2.5">
        <div className="flex items-center gap-2 text-gold">
          <History className="h-3.5 w-3.5" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
            {title}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] text-cream-faint">
          {subtitle ?? `Clique para exibir · ${historico.length} ${historico.length === 1 ? 'item' : 'itens'}`}
        </p>
      </div>

      <ScrollArea className={maxHeightClassName}>
        <ul className="relative space-y-0 p-2">
          <span
            className="pointer-events-none absolute bottom-3 left-[27px] top-3 w-px bg-gradient-to-b from-gold/40 via-gold/20 to-transparent"
            aria-hidden
          />
          {historico.map((entry, index) => {
            const isActive = entry.id === selectedId;
            const isDeleting = deletingId === entry.id;

            return (
              <li
                key={entry.id}
                className={cn(
                  'relative animate-in fade-in slide-in-from-left-1 duration-300 fill-mode-both',
                )}
                style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
              >
                <div
                  className={cn(
                    'group flex items-stretch gap-1 rounded-lg border transition-all',
                    isActive
                      ? 'border-gold/45 bg-gold/10 shadow-inner shadow-gold/5'
                      : 'border-transparent bg-transparent hover:border-gold-border-subtle/30 hover:bg-mahogany-elevated/50',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(entry)}
                    className="flex min-w-0 flex-1 items-start gap-2.5 px-2 py-2 text-left"
                  >
                    <span
                      className={cn(
                        'relative z-[1] mt-0.5 shrink-0 overflow-hidden rounded-md border',
                        isActive
                          ? 'border-gold/50 ring-2 ring-gold/25'
                          : 'border-gold-border-subtle/25',
                      )}
                    >
                      <img
                        src={entry.outputPublicUrl}
                        alt=""
                        className="h-11 w-14 object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'text-[11px] font-medium tabular-nums',
                            isActive ? 'text-gold' : 'text-cream-secondary',
                          )}
                        >
                          {format(new Date(entry.criadoEm), "dd/MM/yy · HH:mm", { locale: ptBR })}
                        </span>
                        {entry.parentRenderId ? (
                          <Badge
                            variant="outline"
                            className="h-4 border-gold/35 bg-gold/10 px-1 text-[9px] text-gold"
                          >
                            Edição
                          </Badge>
                        ) : entry.inputSnapshot?.mode === 'ambiente' ? (
                          <Badge
                            variant="outline"
                            className="h-4 border-gold/40 bg-gold/10 px-1 text-[9px] text-gold"
                          >
                            Ambiente
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="h-4 border-cream-faint/30 px-1 text-[9px] text-cream-muted"
                          >
                            {originBadgeLabel}
                          </Badge>
                        )}
                      </span>
                      {showProjectLabel && entry.inputSnapshot?.label && (
                        <span className="mt-0.5 block truncate text-[10px] text-cream-faint">
                          {entry.inputSnapshot.label}
                        </span>
                      )}
                      {entry.editNotas && (
                        <span className="mt-0.5 block line-clamp-2 text-[10px] leading-snug text-cream-muted">
                          {entry.editNotas}
                        </span>
                      )}
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-col justify-center gap-0.5 pr-1.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-cream-muted hover:text-gold"
                      aria-label="Ver em tela cheia"
                      onClick={() => onFullscreen(entry)}
                    >
                      <Maximize2 className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-cream-muted hover:text-destructive"
                      aria-label="Excluir versão"
                      disabled={Boolean(deletingId)}
                      onClick={() => onDelete(entry)}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );
}
