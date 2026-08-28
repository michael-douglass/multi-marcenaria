import { useState } from 'react';
import { Check, Film, FolderOpen, Image, Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  useBibliotecaComposicaoOrcamentoMidias,
  type BibliotecaComposicaoMidia,
} from '@/hooks/useBibliotecaComposicaoOrcamentoMidias';
import type { MidiaTipo } from '@/lib/orcamento-slide-types';
import { COMPOSICAO_ORCAMENTO_FOLDER_NAME } from '@/lib/biblioteca-composicao-orcamento';

interface SelecaoItem {
  midia: BibliotecaComposicaoMidia;
  tipo: MidiaTipo;
}

interface Props {
  onImportar: (selecionadas: SelecaoItem[]) => Promise<void>;
  isImporting?: boolean;
}

function MidiaThumb({ midia }: { midia: BibliotecaComposicaoMidia }) {
  if (midia.tipo === 'video') {
    return (
      <>
        <video
          src={midia.file_url}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent pointer-events-none" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400/90 text-black shadow-lg shadow-amber-900/40 ring-2 ring-white/20">
            <Play className="h-5 w-5 fill-current ml-0.5" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <img
        src={midia.file_url}
        alt={midia.titulo}
        className="h-full w-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />
    </>
  );
}

export function BibliotecaComposicaoPicker({ onImportar, isImporting = false }: Props) {
  const { data: midias = [], isLoading } = useBibliotecaComposicaoOrcamentoMidias();
  const [importadas, setImportadas] = useState<Set<string>>(new Set());

  const handleImportar = async (midia: BibliotecaComposicaoMidia) => {
    if (isImporting || importadas.has(midia.id)) return;
    try {
      await onImportar([{ midia, tipo: 'projeto' }]);
      setImportadas((prev) => new Set(prev).add(midia.id));
      toast.success(
        midia.tipo === 'video'
          ? `Vídeo “${midia.titulo}” adicionado ao orçamento`
          : `“${midia.titulo}” adicionada ao orçamento`,
      );
    } catch {
      toast.error(
        midia.tipo === 'video'
          ? 'Não foi possível importar o vídeo da biblioteca'
          : 'Não foi possível importar a imagem da biblioteca',
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (midias.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 py-6 px-4 text-center text-sm text-muted-foreground">
        <FolderOpen className="h-7 w-7 mx-auto mb-2 opacity-40" />
        Ainda não há mídias na pasta “{COMPOSICAO_ORCAMENTO_FOLDER_NAME}”.
        <span className="block mt-1 text-xs">
          Adicione fotos, vídeos ou PDFs em Biblioteca → essa pasta.
        </span>
      </div>
    );
  }

  const totalVideos = midias.filter((m) => m.tipo === 'video').length;
  const totalImagens = midias.length - totalVideos;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Clique numa foto ou vídeo da biblioteca para incluir no orçamento. O título aparece em cada card.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {midias.map((midia) => {
          const importada = importadas.has(midia.id);
          const isVideo = midia.tipo === 'video';
          return (
            <button
              key={midia.id}
              type="button"
              disabled={isImporting || importada}
              className={cn(
                'relative rounded-xl overflow-hidden border-2 transition-all text-left flex flex-col',
                'active:scale-[0.98]',
                importada
                  ? 'border-emerald-500 ring-2 ring-emerald-500/30 cursor-default'
                  : 'border-transparent hover:border-amber-500/60 cursor-pointer',
                isImporting && 'opacity-70',
              )}
              onClick={() => void handleImportar(midia)}
            >
              <div className="relative w-full aspect-square bg-muted">
                <MidiaThumb midia={midia} />
                <Badge
                  className="absolute top-2 left-2 text-[10px] pointer-events-none gap-1"
                  variant="secondary"
                >
                  {isVideo ? (
                    <>
                      <Film className="h-3 w-3" />
                      Vídeo
                    </>
                  ) : (
                    'Biblioteca'
                  )}
                </Badge>
                {importada && (
                  <div className="absolute top-2 right-2 h-6 w-6 bg-emerald-500 rounded-full flex items-center justify-center pointer-events-none">
                    <Check className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
              </div>
              <div className="px-2.5 py-2 bg-background/95 border-t border-border/50">
                <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">
                  {midia.titulo}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {midias.length > 0 && (
        <p className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
          {totalImagens > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Image className="h-3 w-3" />
              {totalImagens} imagem{totalImagens !== 1 ? 'ns' : ''}
            </span>
          )}
          {totalVideos > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Film className="h-3 w-3" />
              {totalVideos} vídeo{totalVideos !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-muted-foreground/70">em “{COMPOSICAO_ORCAMENTO_FOLDER_NAME}”</span>
        </p>
      )}
    </div>
  );
}
