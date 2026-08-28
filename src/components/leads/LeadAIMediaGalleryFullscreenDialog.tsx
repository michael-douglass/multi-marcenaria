import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Layers, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadAIMediaGalleryFullscreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName?: string;
  selectedCount: number;
  maxItems: number;
  maxImages: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onAnalyze: () => void;
  analyzeDisabled: boolean;
  analyzeLabel: ReactNode;
  itemsEmpty: boolean;
  children: ReactNode;
}

export function LeadAIMediaGalleryFullscreenDialog({
  open,
  onOpenChange,
  leadName,
  selectedCount,
  maxItems,
  maxImages,
  onSelectAll,
  onClearSelection,
  onAnalyze,
  analyzeDisabled,
  analyzeLabel,
  itemsEmpty,
  children,
}: LeadAIMediaGalleryFullscreenDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[94dvh] w-[min(1100px,calc(100vw-1rem))] flex-col gap-0 overflow-hidden p-0',
          'border-gold-border-subtle/30 bg-mahogany-panel shadow-2xl shadow-black/40',
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-gold-border-subtle/20 px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1 pr-8">
              <DialogTitle className="flex items-center gap-2 text-base text-cream-secondary">
                <Layers className="h-4 w-4 text-gold shrink-0" />
                Galeria do lead
                {leadName ? ` — ${leadName}` : ''}
              </DialogTitle>
              <DialogDescription className="text-xs text-cream-muted">
                {selectedCount} selecionado(s) · até {maxItems} arquivos · até {maxImages}{' '}
                páginas/imagens por análise
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 h-9 w-9 text-cream-muted hover:text-foreground"
              onClick={() => onOpenChange(false)}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSelectAll}
              disabled={itemsEmpty}
              className="border-gold-border-subtle/40 bg-mahogany-muted/40"
            >
              Selecionar todas
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClearSelection}
              disabled={selectedCount === 0}
              className="border-gold-border-subtle/40 bg-mahogany-muted/40"
            >
              Limpar
            </Button>
            <Button type="button" size="sm" onClick={onAnalyze} disabled={analyzeDisabled}>
              {analyzeLabel}
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4 sm:p-6">{children}</div>
        </ScrollArea>

        {selectedCount > 0 && (
          <div className="shrink-0 border-t border-gold-border-subtle/20 bg-mahogany-elevated/50 px-4 py-3 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-cream-secondary">
                {selectedCount === 1
                  ? '1 imagem selecionada — pronta para análise'
                  : `${selectedCount} imagens selecionadas — prontas para análise`}
              </p>
              <Button type="button" onClick={onAnalyze} disabled={analyzeDisabled} className="shrink-0">
                {analyzeLabel}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Altura compacta da galeria (~2 linhas de cards 4:5 em grid de 3 colunas). */
export const LEAD_AI_GALLERY_COMPACT_HEIGHT = 'min(30rem,42vh)';
