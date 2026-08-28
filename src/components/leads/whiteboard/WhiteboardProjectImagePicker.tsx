import { Image, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useLeadMidiasParaOrcamento } from '@/hooks/useLeadMidiasParaOrcamento';
import type { LeadMidiaDisponivel } from '@/lib/orcamento-slide-types';
import { cn } from '@/lib/utils';

interface WhiteboardProjectImagePickerProps {
  leadId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** URLs já presentes na lousa — ocultadas no seletor */
  existingImageUrls: string[];
  onSelect: (midia: LeadMidiaDisponivel) => void | Promise<void>;
  isSelecting?: boolean;
}

export function WhiteboardProjectImagePicker({
  leadId,
  open,
  onOpenChange,
  existingImageUrls,
  onSelect,
  isSelecting = false,
}: WhiteboardProjectImagePickerProps) {
  const { data: midias = [], isLoading } = useLeadMidiasParaOrcamento(leadId);

  const existing = new Set(existingImageUrls);
  const disponiveis = midias.filter((m) => !existing.has(m.file_url));

  const handleSelect = async (midia: LeadMidiaDisponivel) => {
    if (isSelecting) return;
    await onSelect(midia);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[min(80vh,640px)] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle>Imagens do projeto</DialogTitle>
          <DialogDescription>
            Escolha uma imagem do projeto para desenhar em cima.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : disponiveis.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 py-10 px-4 text-center text-sm text-muted-foreground">
              <Image className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Não há outras imagens do projeto disponíveis para importar.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {disponiveis.map((midia) => (
                <button
                  key={`${midia.origem}-${midia.id}`}
                  type="button"
                  disabled={isSelecting}
                  className={cn(
                    'relative rounded-xl overflow-hidden border-2 border-transparent text-left transition-all',
                    'hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelecting && 'opacity-70',
                  )}
                  onClick={() => void handleSelect(midia)}
                >
                  <img
                    src={midia.file_url}
                    alt={midia.file_name}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="absolute inset-0 bg-black/20 pointer-events-none" />
                  <Badge
                    className="absolute top-2 left-2 text-[10px] pointer-events-none"
                    variant={midia.origem === 'lead_whiteboard' ? 'secondary' : 'default'}
                  >
                    {midia.preview_label}
                  </Badge>
                  <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-black/50 text-white text-[10px] pointer-events-none truncate">
                    {format(new Date(midia.criado_em), 'dd/MM/yy', { locale: ptBR })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
