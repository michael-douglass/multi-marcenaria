import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LeadAIAnalysisReader } from '@/components/leads/LeadAIAnalysisReader';
import type { LeadAIMediaItem } from '@/lib/lead-ai-media-sources';
import { Check, Copy, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadAIAnalysisFullscreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  content: string;
  briefingContent?: string | null;
  mediaItems?: LeadAIMediaItem[];
  isLoading?: boolean;
  copied: boolean;
  onCopy: () => void;
  leadId: number;
  leadName?: string;
  leadOrigin?: string;
  analiseId?: string | null;
}

export function LeadAIAnalysisFullscreenDialog({
  open,
  onOpenChange,
  title = 'Análise IA',
  subtitle,
  content,
  briefingContent = null,
  mediaItems = [],
  isLoading = false,
  copied,
  onCopy,
  leadId,
  leadName,
  leadOrigin,
  analiseId = null,
}: LeadAIAnalysisFullscreenDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'fixed left-0 top-0 z-50 flex h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0',
          'sm:left-1/2 sm:top-1/2 sm:h-[min(94dvh,920px)] sm:w-[min(1200px,calc(100vw-1.5rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border',
          'border-gold-border-subtle/30 bg-mahogany-panel shadow-2xl shadow-black/50',
          '[&>button.absolute]:hidden',
        )}
      >
        <div className="relative shrink-0 border-b border-gold-border-subtle/30 bg-gradient-to-r from-mahogany-elevated via-mahogany-card to-mahogany-elevated px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
          <DialogHeader className="space-y-0.5 pr-0 text-left sm:pr-28">
            <div className="flex items-center gap-2 text-gold">
              <Sparkles className="h-4 w-4" aria-hidden />
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em]">
                Leitura da análise
              </span>
            </div>
            <DialogTitle className="font-display text-xl uppercase tracking-wide text-primary sm:text-2xl">
              {title}
            </DialogTitle>
            {subtitle && (
              <DialogDescription className="text-xs text-cream-muted sm:text-sm">
                {subtitle}
                {mediaItems.length > 0 && (
                  <span className="text-cream-faint">
                    {' '}
                    · {mediaItems.length} referência{mediaItems.length !== 1 ? 's' : ''}
                  </span>
                )}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="mt-3 flex items-center justify-end gap-1 sm:absolute sm:right-4 sm:top-4 sm:mt-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCopy}
              disabled={!content || isLoading}
              className="h-9 text-cream-muted hover:text-primary"
            >
              {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
              Copiar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-cream-muted hover:text-foreground"
              onClick={() => onOpenChange(false)}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 p-3 sm:p-4">
          <LeadAIAnalysisReader
            items={mediaItems}
            content={content}
            briefingContent={briefingContent}
            isLoading={isLoading}
            variant="fullscreen"
            className="h-full rounded-lg border-gold-border-subtle/25"
            leadId={leadId}
            leadName={leadName}
            leadOrigin={leadOrigin}
            analiseId={analiseId}
          />
        </div>

        {mediaItems.length > 1 && (
          <p className="shrink-0 border-t border-gold-border-subtle/20 px-4 py-2 text-center text-[11px] text-cream-faint">
            Use as setas ← → ou a faixa de miniaturas para trocar de imagem enquanto lê
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
