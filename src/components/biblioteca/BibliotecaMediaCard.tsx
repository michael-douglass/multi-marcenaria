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
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
      />
    );
  }

  if (media.tipo === 'video') {
    return (
      <>
        <video src={media.file_url} className="h-full w-full object-cover" muted />
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a100c]/35">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fffaf4]/90 ring-1 ring-[rgba(107,63,18,0.35)]">
            <Play className="h-5 w-5 fill-[#6b3f12] text-[#6b3f12]" />
          </div>
        </div>
      </>
    );
  }

  if (media.tipo === 'audio') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#f4e4c4]">
        <Music className="h-10 w-10 text-[#6b3f12]/80" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#f0e4d4]">
      <FileText className="h-10 w-10 text-[#6b3f12]/80" />
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
        'biblioteca-photo-mount group relative overflow-hidden rounded-sm p-2 pb-0',
        'transition-transform duration-300 hover:-translate-y-0.5',
        'animate-in fade-in slide-in-from-bottom-3 fill-mode-both',
        selected && 'is-selected',
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
            'absolute left-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-sm border transition',
            selected
              ? 'border-[#6b3f12] bg-[#6b3f12] text-[#fffaf4]'
              : 'border-[rgba(26,16,12,0.28)] bg-[#fffaf4]/90 text-[#4a3428] hover:border-[#6b3f12]',
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
        className="relative block aspect-[4/3] w-full overflow-hidden rounded-[2px] bg-[#efe4d4]"
      >
        <MediaThumbnail media={media} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a100c]/55 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="absolute bottom-2 left-2 right-2 flex translate-y-1 items-end justify-between opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
          <span className="rounded-full bg-[#fffaf4]/92 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#6b3f12]">
            {media.tipo}
          </span>
          <span className="rounded-full bg-[#6b3f12] p-1.5 text-[#fffaf4]">
            <Eye className="h-3.5 w-3.5" />
          </span>
        </div>
      </button>

      <div className="space-y-2 px-1 py-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap gap-1">
            {media.origem !== 'biblioteca' && (
              <span className="rounded-full bg-[#efe4d4] px-2 py-0.5 text-[10px] font-medium text-[#6b3f12] ring-1 ring-[rgba(107,63,18,0.2)]">
                {getBibliotecaOrigemLabel(media.origem)}
              </span>
            )}
          </div>
          <h3 className="truncate text-sm font-semibold text-[#1a100c]" title={media.titulo}>
            {media.titulo}
          </h3>
          <p className="text-[11px] text-[#6b5244]">
            {formatBibliotecaFileSize(media.file_size)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 flex-1 text-xs text-[#4a3428] hover:bg-[#f4e4c4] hover:text-[#6b3f12]"
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
              className="h-8 w-8 text-[#9f1239] hover:bg-[#9f1239]/10"
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
