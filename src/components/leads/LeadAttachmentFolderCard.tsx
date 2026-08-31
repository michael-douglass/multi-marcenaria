import { useMemo, useState } from 'react';
import { Folder, FolderOpen, Images, MoreVertical, Pencil, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface LeadAttachmentFolderCardProps {
  nome: string;
  fileCount: number;
  covers: string[];
  index: number;
  variant?: 'folder' | 'unfiled';
  canManage: boolean;
  onOpen: () => void;
  onRename?: (nome: string) => void;
  onDelete?: () => void;
  onPlay?: () => void;
}

export function LeadAttachmentFolderCard({
  nome,
  fileCount,
  covers,
  index,
  variant = 'folder',
  canManage,
  onOpen,
  onRename,
  onDelete,
  onPlay,
}: LeadAttachmentFolderCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nome);
  const isUnfiled = variant === 'unfiled';
  const stack = covers.slice(0, 3);

  const commitRename = () => {
    const next = draft.trim();
    if (!next) {
      setDraft(nome);
      setEditing(false);
      return;
    }
    if (next !== nome) onRename?.(next);
    setEditing(false);
  };

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-xl border px-2.5 pb-2.5 pt-3 text-left',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both',
        isUnfiled
          ? 'border-dashed border-[rgba(26,16,12,0.28)] bg-[rgba(26,16,12,0.03)]'
          : 'border-amber-500/25 bg-gradient-to-br from-[rgba(78,52,40,0.80)] to-[rgba(52,34,26,0.40)] shadow-[inset_0_1px_0_rgba(242,216,146,0.22),0_10px_24px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 hover:border-amber-400/50',
      )}
      style={{ animationDelay: `${Math.min(index * 40, 280)}ms` }}
    >
      {!isUnfiled && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'repeating-radial-gradient(circle at 20% 20%, #c4a070 0 1px, transparent 1px 7px)',
          }}
          aria-hidden
        />
      )}

      {canManage && onRename && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute left-1.5 top-1.5 z-10 h-7 w-7 bg-black/25 text-amber-50 hover:bg-black/40"
          title={isUnfiled ? 'Dar um nome à pasta' : 'Renomear pasta'}
          onClick={(e) => {
            e.stopPropagation();
            setDraft(isUnfiled ? '' : nome);
            setEditing(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}

      {canManage && !isUnfiled && onDelete && (
        <div className="absolute right-1.5 top-1.5 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 bg-black/25 text-amber-50 hover:bg-black/40"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setDraft(nome);
                  setEditing(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Renomear
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir pasta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {canManage && onPlay && stack.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute bottom-8 right-1.5 z-10 h-7 w-7 bg-black/30 text-amber-50 hover:bg-black/50"
          title="Slideshow das fotos"
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
        >
          <Play className="h-3.5 w-3.5 ml-0.5" />
        </Button>
      )}

      <button type="button" onClick={onOpen} className="relative flex w-full flex-col items-center pt-5">
        <div className="relative mb-2 h-16 w-[4.75rem]">
          {stack.length === 0 ? (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-400/30">
              {isUnfiled ? (
                <Images className="h-7 w-7 text-amber-700" />
              ) : (
                <>
                  <Folder className="h-7 w-7 text-amber-600 transition group-hover:hidden" />
                  <FolderOpen className="hidden h-7 w-7 text-amber-700 group-hover:block" />
                </>
              )}
            </div>
          ) : (
            stack.map((url, coverIndex) => (
              <img
                key={`${nome}-${coverIndex}`}
                src={url}
                alt=""
                className="absolute h-14 w-11 rounded-md border border-black/30 object-cover shadow-md"
                style={{
                  left: coverIndex * 8,
                  transform: `rotate(${[-7, 0, 7][coverIndex] ?? 0}deg)`,
                  zIndex: coverIndex,
                }}
              />
            ))
          )}
        </div>

        {editing ? (
          <Input
            value={draft}
            autoFocus
            placeholder={isUnfiled ? 'Ex.: Sala' : undefined}
            className="h-8 text-center text-sm"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitRename();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setDraft(nome);
                setEditing(false);
              }
            }}
          />
        ) : (
          <h3
            className={cn(
              'w-full truncate text-sm font-semibold',
              isUnfiled ? 'text-[#1a100c]' : 'text-amber-50',
            )}
            title={nome}
          >
            {nome}
          </h3>
        )}
        <p className={cn('mt-0.5 text-[11px]', isUnfiled ? 'text-[#6b5244]' : 'text-amber-100/70')}>
          {fileCount} {fileCount === 1 ? 'arquivo' : 'arquivos'}
        </p>
      </button>
    </article>
  );
}
