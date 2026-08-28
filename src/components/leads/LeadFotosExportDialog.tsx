import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileDown, FileText, Loader2, Paperclip } from 'lucide-react';

export type LeadFotosExportAction = 'export' | 'attach' | 'both';

interface LeadFotosExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  canAttach: boolean;
  isProcessing: boolean;
  onConfirm: (action: LeadFotosExportAction) => void;
}

export function LeadFotosExportDialog({
  open,
  onOpenChange,
  selectedCount,
  canAttach,
  isProcessing,
  onConfirm,
}: LeadFotosExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !isProcessing && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar fotos em PDF</DialogTitle>
          <DialogDescription>
            {selectedCount} foto{selectedCount !== 1 ? 's' : ''} selecionada
            {selectedCount !== 1 ? 's' : ''}. O PDF será gerado em A4 retrato com a logo e o nome da
            empresa — uma foto por página.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start gap-3 px-4 py-3 text-left"
            disabled={isProcessing}
            onClick={() => onConfirm('export')}
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
            ) : (
              <FileDown className="h-5 w-5 shrink-0 text-primary" />
            )}
            <span>
              <span className="block font-medium">Exportar PDF</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Abre a impressão do navegador para salvar ou imprimir
              </span>
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start gap-3 px-4 py-3 text-left"
            disabled={isProcessing || !canAttach}
            onClick={() => onConfirm('attach')}
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
            ) : (
              <Paperclip className="h-5 w-5 shrink-0 text-primary" />
            )}
            <span>
              <span className="block font-medium">Anexar PDF ao lead</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {canAttach
                  ? 'Gera o PDF e adiciona aos anexos do lead'
                  : 'Você não tem permissão para anexar arquivos'}
              </span>
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start gap-3 px-4 py-3 text-left"
            disabled={isProcessing || !canAttach}
            onClick={() => onConfirm('both')}
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
            ) : (
              <FileText className="h-5 w-5 shrink-0 text-primary" />
            )}
            <span>
              <span className="block font-medium">Exportar e anexar</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {canAttach
                  ? 'Salva no lead e abre a impressão do navegador'
                  : 'Requer permissão para anexar arquivos'}
              </span>
            </span>
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={isProcessing} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
