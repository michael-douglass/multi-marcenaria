import type { ButtonHTMLAttributes } from 'react';
import type { MarketingMediaFolder } from '@/hooks/useMarketingMediaFolders';
import { cn } from '@/lib/utils';
import { Folder, FolderOpen, GripVertical, MoreVertical, Pencil, Pin, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BibliotecaPinButton } from '@/components/biblioteca/BibliotecaPinButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface BibliotecaFolderCardProps {
  folder: MarketingMediaFolder;
  itemCount: number;
  index: number;
  canManage: boolean;
  dragHandleProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
  onOpen: (folder: MarketingMediaFolder) => void;
  onEdit: (folder: MarketingMediaFolder) => void;
  onDelete: (folder: MarketingMediaFolder) => void;
  onPin?: (folder: MarketingMediaFolder) => void;
}

export function BibliotecaFolderCard({
  folder,
  itemCount,
  index,
  canManage,
  dragHandleProps,
  isDragging = false,
  onOpen,
  onEdit,
  onDelete,
  onPin,
}: BibliotecaFolderCardProps) {
  return (
    <article
      className={cn(
        'biblioteca-folder-tab group relative overflow-hidden rounded-sm',
        'transition-transform duration-300 hover:-translate-y-0.5',
        'animate-in fade-in slide-in-from-bottom-3 fill-mode-both',
        folder.fixado && 'is-pinned',
        isDragging && 'scale-[1.02] ring-2 ring-[#6b3f12]/35',
      )}
      style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
    >
      {folder.fixado && (
        <>
          <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-[#6b3f12]" />
          <span className="pointer-events-none absolute right-2 top-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#6b3f12]">
            No topo
          </span>
        </>
      )}
      <span
        className="pointer-events-none absolute left-4 top-0 h-2 w-14 rounded-b-sm bg-[#6b3f12]/80"
        aria-hidden
      />

      {canManage && onPin && (
        <div className="absolute left-2 top-2 z-20">
          <BibliotecaPinButton
            pinned={folder.fixado}
            onToggle={() => onPin(folder)}
            label={folder.fixado ? 'Tirar das favoritas' : 'Fixar nas favoritas'}
          />
        </div>
      )}

      {canManage && folder.fixado && dragHandleProps && (
        <button
          type="button"
          className="absolute left-11 top-2 z-20 inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-full text-[#6b5244] hover:bg-[#f4e4c4] hover:text-[#6b3f12] active:cursor-grabbing"
          aria-label="Arrastar ordem das favoritas"
          {...dragHandleProps}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      <button
        type="button"
        onClick={() => onOpen(folder)}
        className="flex w-full flex-col items-center px-4 pb-3 pt-10 text-center"
      >
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-sm bg-[#f4e4c4] ring-1 ring-[rgba(107,63,18,0.28)] transition group-hover:bg-[#ead6b0]">
          <Folder className="h-7 w-7 text-[#6b3f12] transition group-hover:hidden" />
          <FolderOpen className="hidden h-7 w-7 text-[#6b3f12] group-hover:block" />
        </div>
        <h3 className="w-full truncate text-sm font-semibold text-[#1a100c]" title={folder.nome}>
          {folder.nome}
        </h3>
        {folder.descricao && (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-[#6b5244]">{folder.descricao}</p>
        )}
        <p className="mt-2 text-[11px] font-medium text-[#6b3f12]">
          {itemCount} {itemCount === 1 ? 'arquivo' : 'arquivos'}
        </p>
      </button>

      {canManage && (
        <div className="absolute right-2 top-2 z-20 opacity-0 transition group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 bg-[#fffaf4]/90 text-[#4a3428] hover:bg-[#f4e4c4]"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onPin && (
                <DropdownMenuItem onClick={() => onPin(folder)}>
                  <Pin className="mr-2 h-4 w-4" />
                  {folder.fixado ? 'Tirar das favoritas' : 'Fixar nas favoritas'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onEdit(folder)}>
                <Pencil className="mr-2 h-4 w-4" />
                Renomear
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(folder)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir pasta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </article>
  );
}
