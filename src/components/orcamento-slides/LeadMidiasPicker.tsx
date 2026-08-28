import { useEffect, useState } from 'react';
import { Check, FileText, Image, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useLeadMidiasParaOrcamento } from '@/hooks/useLeadMidiasParaOrcamento';
import type { LeadMidiaDisponivel, MidiaTipo } from '@/lib/orcamento-slide-types';
import { isLeadMidiaPdf } from '@/lib/orcamento-slide-projeto-files';
import { renderPdfUrlToThumbnail } from '@/lib/pdf-render';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SelecaoItem {
  midia: LeadMidiaDisponivel;
  tipo: MidiaTipo;
}

interface Props {
  leadId: number;
  onImportar: (selecionadas: SelecaoItem[]) => Promise<void>;
  isImporting?: boolean;
}

function PdfThumb({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void renderPdfUrlToThumbnail(url, 320)
      .then((thumb) => {
        if (!cancelled) setSrc(thumb);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!src) {
    return (
      <div className="w-full aspect-square flex flex-col items-center justify-center gap-1 bg-muted/80 text-muted-foreground">
        <FileText className="h-8 w-8 text-amber-400/80" />
        <span className="text-[10px] font-medium">PDF</span>
      </div>
    );
  }

  return <img src={src} alt={alt} className="w-full aspect-square object-cover" />;
}

export function LeadMidiasPicker({ leadId, onImportar, isImporting = false }: Props) {
  const { data: midias = [], isLoading } = useLeadMidiasParaOrcamento(leadId);
  const [importadas, setImportadas] = useState<Set<string>>(new Set());
  const [abrindoPdfId, setAbrindoPdfId] = useState<string | null>(null);

  const handleImportarMidia = async (midia: LeadMidiaDisponivel) => {
    if (isImporting || importadas.has(midia.id) || abrindoPdfId) return;
    const isPdf = midia.tipo_arquivo === 'pdf' || isLeadMidiaPdf(midia);

    try {
      if (isPdf) setAbrindoPdfId(midia.id);
      await onImportar([{ midia, tipo: 'projeto' }]);
      setImportadas((prev) => new Set(prev).add(midia.id));
      if (!isPdf) {
        toast.success('Imagem adicionada ao orçamento');
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'PDF_CANCELLED') return;
      toast.error(
        isPdf
          ? 'Não foi possível converter o PDF em imagens'
          : 'Não foi possível importar a imagem',
      );
    } finally {
      setAbrindoPdfId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (midias.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 py-8 px-4 text-center text-sm text-muted-foreground">
        <Image className="h-8 w-8 mx-auto mb-2 opacity-40" />
        Este lead ainda não possui imagens nem PDFs nos anexos, na lousa ou em renderizações de IA.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Clique numa foto para incluir. Em um PDF, abre a tela para você marcar quais páginas quer no orçamento.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {midias.map((midia) => {
          const importada = importadas.has(midia.id);
          const isPdf = midia.tipo_arquivo === 'pdf' || isLeadMidiaPdf(midia);
          const abrindo = abrindoPdfId === midia.id;
          return (
            <button
              key={midia.id}
              type="button"
              disabled={isImporting || importada || !!abrindoPdfId}
              className={cn(
                'relative rounded-xl overflow-hidden border-2 transition-all text-left',
                importada
                  ? 'border-emerald-500 ring-2 ring-emerald-500/30 cursor-default'
                  : 'border-transparent hover:border-amber-500/60 cursor-pointer',
                (isImporting || abrindo) && 'opacity-70',
              )}
              onClick={() => void handleImportarMidia(midia)}
            >
              {isPdf ? (
                <PdfThumb url={midia.file_url} alt={midia.file_name} />
              ) : (
                <img
                  src={midia.file_url}
                  alt={midia.file_name}
                  className="w-full aspect-square object-cover"
                />
              )}
              <div className="absolute inset-0 bg-black/30 pointer-events-none" />

              <Badge
                className="absolute top-2 left-2 text-[10px] pointer-events-none"
                variant={isPdf ? 'outline' : midia.origem === 'lead_whiteboard' ? 'secondary' : 'default'}
              >
                {isPdf ? 'PDF · escolher páginas' : midia.preview_label}
              </Badge>

              {abrindo && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/55 pointer-events-none">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-300" />
                  <span className="text-[11px] font-medium text-amber-100 px-2 text-center">
                    Abrindo páginas…
                  </span>
                </div>
              )}

              {importada && (
                <div className="absolute top-2 right-2 h-6 w-6 bg-emerald-500 rounded-full flex items-center justify-center pointer-events-none">
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>
              )}

              <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-black/50 text-white text-[10px] pointer-events-none truncate">
                {isPdf ? midia.file_name : format(new Date(midia.criado_em), 'dd/MM/yy', { locale: ptBR })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
