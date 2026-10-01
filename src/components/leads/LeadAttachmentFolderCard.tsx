import { useState } from 'react';
import { Folder, FolderOpen, Images, MoreVertical, Pencil, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
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
  selectionMode = false,
  selected = false,
  onToggleSelect,
  onOpen,
  onRename,
  onDelete,
  onPlay,
}: LeadAttachmentFolderCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nome);
  const isUnfiled = variant === 'unfiled';
  const stack = covers.slice(0, 3);
  const canSelect = selectionMode && !isUnfiled && Boolean(onToggleSelect);

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

  const handleActivate = () => {
    if (canSelect) {
      onToggleSelect?.();
      return;
    }
    onOpen();
  };

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-xl border px-2.5 pb-2.5 pt-3 text-left',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both',
        isUnfiled
          ? 'border-dashed border-[rgba(26,16,12,0.28)] bg-[rgba(26,16,12,0.03)]'
          : 'border-[rgba(26,16,12,0.14)] bg-[#fffaf4] shadow-[0_8px_20px_rgba(42,24,18,0.08)] hover:-translate-y-0.5 hover:border-[#6b3f12]/40 hover:shadow-[0_12px_28px_rgba(42,24,18,0.12)]',
        canSelect && selected && 'ring-2 ring-primary border-primary',
        selectionMode && isUnfiled && 'opacity-60',
      )}
      style={{ animationDelay: `${Math.min(index * 40, 280)}ms` }}
    >
      {!isUnfiled && (
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(180deg, #f7efe4 0%, transparent 55%), repeating-radial-gradient(circle at 20% 20%, rgba(196,160,112,0.35) 0 1px, transparent 1px 7px)',
          }}
          aria-hidden
        />
      )}

      {canSelect && (
        <div
          className="absolute left-1.5 top-1.5 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect?.()}
            aria-label={`Selecionar pasta ${nome}`}
            className="h-5 w-5 border-[rgba(26,16,12,0.35)] bg-white/90 data-[state=checked]:bg-primary"
          />
        </div>
      )}

      {canManage && onRename && !selectionMode && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute left-1.5 top-1.5 z-10 h-7 w-7 bg-white/80 text-[#6b3f12] hover:bg-[#f0e2cf] hover:text-[#1a100c]"
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

      {canManage && !isUnfiled && onDelete && !selectionMode && (
        <div className="absolute right-1.5 top-1.5 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 bg-white/80 text-[#6b3f12] hover:bg-[#f0e2cf] hover:text-[#1a100c]"
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

      {canManage && onPlay && stack.length > 0 && !selectionMode && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute bottom-8 right-1.5 z-10 h-7 w-7 bg-white/90 text-[#6b3f12] hover:bg-[#f0e2cf] hover:text-[#1a100c]"
          title="Slideshow das fotos"
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
        >
          <Play className="h-3.5 w-3.5 ml-0.5" />
        </Button>
      )}

      <button
        type="button"
        onClick={handleActivate}
        className="relative flex w-full flex-col items-center pt-5"
        title={
          canSelect
            ? selected
              ? 'Clique para desmarcar'
              : 'Clique para selecionar'
            : undefined
        }
      >
        <div className="relative mb-2 h-16 w-[4.75rem]">
          {stack.length === 0 ? (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#efe4d4] ring-1 ring-[rgba(107,63,18,0.28)]">
              {isUnfiled ? (
                <Images className="h-7 w-7 text-[#6b3f12]" />
              ) : (
                <>
                  <Folder className="h-7 w-7 text-[#6b3f12] transition group-hover:hidden" />
                  <FolderOpen className="hidden h-7 w-7 text-[#5a340f] group-hover:block" />
                </>
              )}
            </div>
          ) : (
            stack.map((url, coverIndex) => (
              <img
                key={`${nome}-${coverIndex}`}
                src={url}
                alt=""
                className="absolute h-14 w-11 rounded-md border border-[rgba(26,16,12,0.2)] object-cover shadow-md"
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
            className="h-8 border-[rgba(26,16,12,0.2)] bg-white text-center text-sm text-[#1a100c]"
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
          <h3 className="w-full truncate text-sm font-semibold text-[#1a100c]" title={nome}>
            {nome}
          </h3>
        )}
        <p className="mt-0.5 text-[11px] font-medium text-[#4a3428]">
          {fileCount} {fileCount === 1 ? 'arquivo' : 'arquivos'}
        </p>
      </button>
    </article>
  );
}
