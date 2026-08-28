import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { PdfPageImage } from '@/lib/pdf-render';
import { Check, FileText, Loader2 } from 'lucide-react';

interface OrcamentoProjetoPdfPagePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Páginas já renderizadas (prévia). */
  pages: PdfPageImage[];
  fileName?: string;
  isLoading?: boolean;
  error?: string | null;
  isSubmitting?: boolean;
  onConfirm: (pageNumbers: number[]) => void;
}

export function OrcamentoProjetoPdfPagePickerDialog({
  open,
  onOpenChange,
  pages,
  fileName,
  isLoading = false,
  error = null,
  isSubmitting = false,
  onConfirm,
}: OrcamentoProjetoPdfPagePickerDialogProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) return;
    // Começa sem seleção — o usuário marca só o que quer no orçamento.
    setSelected(new Set());
  }, [open, pages]);

  const total = pages.length;
  const selectedCount = selected.size;
  const allSelected = total > 0 && selectedCount === total;
  const noneSelected = selectedCount === 0;

  const tituloArquivo = useMemo(() => {
    const name = (fileName || 'documento.pdf').trim();
    return name.length > 48 ? `${name.slice(0, 45)}…` : name;
  }, [fileName]);

  const togglePage = (pageNumber: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pageNumber)) next.delete(pageNumber);
      else next.add(pageNumber);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(pages.map((p) => p.pageNumber)));
  };

  const handleConfirm = () => {
    if (selectedCount === 0) return;
    const ordered = pages
      .map((p) => p.pageNumber)
      .filter((n) => selected.has(n));
    onConfirm(ordered);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        floatingLayer
        className={cn(
          // h-0 + flex-1 no body: força altura limitada (max-h) para a lista rolar
          '!flex h-[min(92dvh,900px)] max-h-[min(92dvh,900px)] flex-col gap-0 overflow-hidden p-0',
          'border-gold-border-subtle/40 bg-mahogany-panel sm:max-w-3xl lg:max-w-4xl',
        )}
      >
        <DialogHeader className="shrink-0 border-b border-gold-border-subtle/20 bg-mahogany-elevated/80 px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10">
              <FileText className="h-5 w-5 text-amber-200" />
            </div>
            <div className="min-w-0 space-y-1 text-left">
              <DialogTitle className="text-base font-semibold text-cream-secondary sm:text-lg">
                Escolher páginas do PDF
              </DialogTitle>
              <DialogDescription className="text-xs text-cream-muted sm:text-sm">
                Nenhuma página está selecionada. Toque nas que deseja incluir no orçamento.
                {fileName ? (
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-amber-200/80">
                    {tituloArquivo}
                  </span>
                ) : null}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gold-border-subtle/15 px-4 py-2.5 sm:px-6">
          <p
            className={cn(
              'text-xs',
              noneSelected && !isLoading ? 'font-medium text-amber-300' : 'text-muted-foreground',
            )}
          >
            {isLoading
              ? 'Convertendo páginas…'
              : noneSelected
                ? 'Selecione ao menos 1 página'
                : `${selectedCount} de ${total} página${total === 1 ? '' : 's'} selecionada${selectedCount === 1 ? '' : 's'}`}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            disabled={isLoading || total === 0 || isSubmitting}
            onClick={toggleAll}
          >
            {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
          </Button>
        </div>

        {/* h-0 + flex-1: ocupa o espaço restante e permite scroll interno */}
        <ScrollArea className="h-0 min-h-0 flex-1">
          <div className="px-4 py-4 sm:px-6">
            {isLoading && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                <p className="text-sm">Gerando prévia de cada página…</p>
              </div>
            )}

            {!isLoading && error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
                {error}
              </div>
            )}

            {!isLoading && !error && total === 0 && (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Nenhuma página encontrada neste PDF.
              </div>
            )}

            {!isLoading && !error && total > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {pages.map((page) => {
                  const isOn = selected.has(page.pageNumber);
                  return (
                    <button
                      key={page.pageNumber}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => togglePage(page.pageNumber)}
                      aria-pressed={isOn}
                      className={cn(
                        'group relative overflow-hidden rounded-xl border-2 text-left transition-all',
                        isOn
                          ? 'border-amber-500 ring-2 ring-amber-500/40'
                          : 'border-border/50 opacity-70 hover:opacity-100 hover:border-amber-500/50',
                      )}
                    >
                      <img
                        src={page.src}
                        alt={`Página ${page.pageNumber}`}
                        className={cn(
                          'aspect-[3/4] w-full bg-white object-contain transition',
                          !isOn && 'grayscale-[40%]',
                        )}
                      />
                      <div
                        className={cn(
                          'absolute inset-0 transition-colors',
                          isOn ? 'bg-amber-500/10' : 'bg-black/25 group-hover:bg-black/10',
                        )}
                      />
                      <span
                        className={cn(
                          'absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold shadow',
                          isOn
                            ? 'border-amber-400 bg-amber-500 text-white'
                            : 'border-white/50 bg-black/60 text-white',
                        )}
                      >
                        {isOn ? <Check className="h-4 w-4" /> : page.pageNumber}
                      </span>
                      <span
                        className={cn(
                          'absolute inset-x-0 bottom-0 px-2 py-1.5 text-center text-[11px] font-medium',
                          isOn ? 'bg-amber-600/90 text-white' : 'bg-black/55 text-white/90',
                        )}
                      >
                        {isOn ? `Selecionada · pág. ${page.pageNumber}` : `Toque para selecionar · pág. ${page.pageNumber}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 gap-2 border-t border-gold-border-subtle/20 bg-mahogany-elevated/60 px-4 py-3 sm:px-6">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-amber-600 text-white hover:bg-amber-700"
            disabled={isLoading || !!error || selectedCount === 0 || isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando…
              </>
            ) : noneSelected ? (
              'Selecione páginas'
            ) : (
              `Incluir ${selectedCount} no orçamento`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
