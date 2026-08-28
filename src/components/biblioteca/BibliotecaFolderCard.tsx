import type { MarketingMediaFolder } from '@/hooks/useMarketingMediaFolders';
import { cn } from '@/lib/utils';
import { Folder, FolderOpen, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  onOpen: (folder: MarketingMediaFolder) => void;
  onEdit: (folder: MarketingMediaFolder) => void;
  onDelete: (folder: MarketingMediaFolder) => void;
}

export function BibliotecaFolderCard({
  folder,
  itemCount,
  index,
  canManage,
  onOpen,
  onEdit,
  onDelete,
}: BibliotecaFolderCardProps) {
  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.08] to-orange-500/[0.04]',
        'transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/40 hover:shadow-lg hover:shadow-amber-500/10',
        'animate-in fade-in slide-in-from-bottom-3 fill-mode-both',
      )}
      style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
    >
      <button
        type="button"
        onClick={() => onOpen(folder)}
        className="flex w-full flex-col items-center px-4 pb-3 pt-5 text-center"
      >
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 ring-1 ring-amber-400/25 transition group-hover:bg-amber-500/25">
          <Folder className="h-7 w-7 text-amber-300 transition group-hover:hidden" />
          <FolderOpen className="hidden h-7 w-7 text-amber-200 group-hover:block" />
        </div>
        <h3 className="w-full truncate text-sm font-semibold text-amber-50" title={folder.nome}>
          {folder.nome}
        </h3>
        {folder.descricao && (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-white/45">{folder.descricao}</p>
        )}
        <p className="mt-2 text-[11px] font-medium text-amber-400/80">
          {itemCount} {itemCount === 1 ? 'arquivo' : 'arquivos'}
        </p>
      </button>

      {canManage && (
        <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 bg-black/30 text-white/80 backdrop-blur-sm hover:bg-black/50"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
