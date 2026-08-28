import type { BibliotecaMedia } from '@/hooks/useBibliotecaMedias';
import { formatBibliotecaFileSize, getBibliotecaOrigemLabel } from '@/lib/biblioteca-utils';
import { cn } from '@/lib/utils';
import { Check, Eye, FileText, Music, Play, Trash2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BibliotecaMediaCardProps {
  media: BibliotecaMedia;
  canDelete: boolean;
  canSelect?: boolean;
  selected?: boolean;
  onOpen: (media: BibliotecaMedia) => void;
  onDelete: (media: BibliotecaMedia) => void;
  onToggleSelect?: (media: BibliotecaMedia) => void;
  index: number;
}

function MediaThumbnail({ media }: { media: BibliotecaMedia }) {
  if (media.tipo === 'imagem') {
    return (
      <img
        src={media.file_url}
        alt={media.titulo}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    );
  }

  if (media.tipo === 'video') {
    return (
      <>
        <video src={media.file_url} className="h-full w-full object-cover" muted />
        <div className="absolute inset-0 flex items-center justify-center bg-black/35">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
            <Play className="h-5 w-5 fill-white text-white" />
          </div>
        </div>
      </>
    );
  }

  if (media.tipo === 'audio') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-900/40 to-amber-900/30">
        <Music className="h-10 w-10 text-amber-200/70" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-800/80 to-amber-950/40">
      <FileText className="h-10 w-10 text-amber-200/70" />
    </div>
  );
}

export function BibliotecaMediaCard({
  media,
  canDelete,
  canSelect = false,
  selected = false,
  onOpen,
  onDelete,
  onToggleSelect,
  index,
}: BibliotecaMediaCardProps) {
  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-white/[0.03] shadow-lg transition-all duration-300',
        'hover:-translate-y-1 hover:shadow-amber-500/10',
        'animate-in fade-in slide-in-from-bottom-3 fill-mode-both',
        selected
          ? 'border-amber-400/60 ring-2 ring-amber-400/30'
          : 'border-white/8 hover:border-amber-500/30',
      )}
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
    >
      {canSelect && onToggleSelect && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(media);
          }}
          className={cn(
            'absolute left-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-md border transition',
            selected
              ? 'border-amber-400 bg-amber-500 text-black'
              : 'border-white/30 bg-black/50 text-white/80 hover:border-amber-300 hover:bg-black/70',
          )}
          aria-label={selected ? 'Desmarcar arquivo' : 'Selecionar arquivo'}
          aria-pressed={selected}
        >
          {selected ? <Check className="h-4 w-4" /> : null}
        </button>
      )}

      <button
        type="button"
        onClick={() => onOpen(media)}
        className="relative block aspect-[4/3] w-full overflow-hidden"
      >
        <MediaThumbnail media={media} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="absolute bottom-3 left-3 right-3 flex translate-y-2 items-end justify-between opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
          <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/80 backdrop-blur-sm">
            {media.tipo}
          </span>
          <span className="rounded-full bg-amber-500/90 p-1.5 text-black">
            <Eye className="h-3.5 w-3.5" />
          </span>
        </div>
      </button>

      <div className="space-y-2 p-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap gap-1">
            {media.origem !== 'biblioteca' && (
              <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-200 ring-1 ring-sky-400/20">
                {getBibliotecaOrigemLabel(media.origem)}
              </span>
            )}
          </div>
          <h3 className="truncate text-sm font-semibold text-foreground" title={media.titulo}>
            {media.titulo}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {formatBibliotecaFileSize(media.file_size)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 flex-1 text-xs"
            onClick={() => onOpen(media)}
          >
            {media.tipo === 'video' ? (
              <>
                <Video className="mr-1 h-3.5 w-3.5" />
                Assistir
              </>
            ) : (
              <>
                <Eye className="mr-1 h-3.5 w-3.5" />
                Detalhes
              </>
            )}
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(media)}
              title="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
