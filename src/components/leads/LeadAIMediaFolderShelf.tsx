import { ArrowLeft, Folder, FolderOpen, Images, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getFolderCoverUrls } from '@/lib/lead-media-folders';
import type { LeadMediaFolder } from '@/hooks/useLeadMediaFolders';

interface CoverItem {
  folder_id: string | null;
  tipo?: string;
  file_url: string;
}

interface LeadAIMediaFolderShelfProps {
  folders: LeadMediaFolder[];
  coverSource: CoverItem[];
  folderCounts: Map<string, number>;
  unfiledCount: number;
  showFolderShelf: boolean;
  viewingRoot: boolean;
  folderLabel: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onOpenFolder: (folderId: string) => void;
  onOpenUnfiled: () => void;
  onGoRoot: () => void;
  searchPlaceholder?: string;
  className?: string;
}

/**
 * Prateleira de pastas + busca para as galerias de IA do lead.
 * Visual de ateliê (mogno / ouro) — mesma linguagem das abas de render e análise.
 */
export function LeadAIMediaFolderShelf({
  folders,
  coverSource,
  folderCounts,
  unfiledCount,
  showFolderShelf,
  viewingRoot,
  folderLabel,
  searchQuery,
  onSearchChange,
  onOpenFolder,
  onOpenUnfiled,
  onGoRoot,
  searchPlaceholder = 'Buscar por nome da imagem ou PDF…',
  className,
}: LeadAIMediaFolderShelfProps) {
  const hasQuery = searchQuery.trim().length > 0;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#f2d892]/75"
          aria-hidden
        />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault();
          }}
          placeholder={searchPlaceholder}
          aria-label="Buscar imagens e PDFs"
          className={cn(
            'h-10 border-[#f2d892]/30 bg-[#1c100c]/90 pl-9 pr-9 text-sm text-[#fff6ea]',
            'placeholder:text-[#e2c9a8]/55',
            'focus-visible:border-[#f2d892]/55 focus-visible:ring-[#f2d892]/25',
          )}
        />
        {hasQuery && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-[#e2c9a8] hover:bg-[#3a2418] hover:text-[#fff6ea]"
            onClick={() => onSearchChange('')}
            aria-label="Limpar busca"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {!viewingRoot && !hasQuery && (
        <div className="flex items-center gap-2 rounded-lg border border-[#f2d892]/25 bg-[#241610]/90 px-2.5 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onGoRoot}
            className="h-8 shrink-0 gap-1.5 px-2 text-[#f2d892] hover:bg-[#3a2418] hover:text-[#fff6ea]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Pastas
          </Button>
          <span className="h-4 w-px bg-[#f2d892]/25" aria-hidden />
          <p className="min-w-0 truncate font-display text-[11px] uppercase tracking-[0.16em] text-[#fff6ea]">
            {folderLabel}
          </p>
        </div>
      )}

      {showFolderShelf && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {folders.map((folder, index) => (
            <LeadAIFolderTile
              key={folder.id}
              nome={folder.nome}
              fileCount={folderCounts.get(folder.id) ?? 0}
              covers={getFolderCoverUrls(coverSource, folder.id)}
              index={index}
              onOpen={() => onOpenFolder(folder.id)}
            />
          ))}
          {unfiledCount > 0 && (
            <LeadAIFolderTile
              variant="unfiled"
              nome="Sem pasta"
              fileCount={unfiledCount}
              covers={getFolderCoverUrls(coverSource, null)}
              index={folders.length}
              onOpen={onOpenUnfiled}
            />
          )}
        </div>
      )}
    </div>
  );
}

function LeadAIFolderTile({
  nome,
  fileCount,
  covers,
  index,
  onOpen,
  variant = 'folder',
}: {
  nome: string;
  fileCount: number;
  covers: string[];
  index: number;
  onOpen: () => void;
  variant?: 'folder' | 'unfiled';
}) {
  const isUnfiled = variant === 'unfiled';
  const stack = covers.slice(0, 3);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group relative overflow-hidden rounded-xl border px-2.5 pb-2.5 pt-3 text-left transition-all duration-300',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both',
        isUnfiled
          ? 'border-dashed border-[#f2d892]/35 bg-[#1c100c]/70 hover:border-[#f2d892]/55 hover:bg-[#241610]'
          : 'border-[#f2d892]/28 bg-gradient-to-b from-[#3a2418] to-[#241610] shadow-[0_10px_24px_rgba(8,3,1,0.35)] hover:-translate-y-0.5 hover:border-[#f2d892]/55 hover:shadow-[0_14px_28px_rgba(8,3,1,0.45)]',
      )}
      style={{ animationDelay: `${Math.min(index * 40, 280)}ms` }}
      title={`Abrir pasta ${nome}`}
    >
      {!isUnfiled && (
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'linear-gradient(145deg, rgba(242,216,146,0.12) 0%, transparent 48%), repeating-linear-gradient(-18deg, transparent 0 9px, rgba(242,216,146,0.04) 9px 10px)',
          }}
          aria-hidden
        />
      )}

      <div className="relative flex flex-col items-center">
        <div className="relative mb-2 h-14 w-[4.5rem]">
          {stack.length === 0 ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#2a1812] ring-1 ring-[#f2d892]/30">
              {isUnfiled ? (
                <Images className="h-6 w-6 text-[#f2d892]/85" />
              ) : (
                <>
                  <Folder className="h-6 w-6 text-[#f2d892] transition group-hover:hidden" />
                  <FolderOpen className="hidden h-6 w-6 text-[#fff1c2] group-hover:block" />
                </>
              )}
            </div>
          ) : (
            stack.map((url, coverIndex) => (
              <img
                key={`${nome}-${coverIndex}`}
                src={url}
                alt=""
                className="absolute h-12 w-10 rounded-md border border-[#f2d892]/35 object-cover shadow-md shadow-black/40"
                style={{
                  left: coverIndex * 7,
                  transform: `rotate(${[-6, 0, 6][coverIndex] ?? 0}deg)`,
                  zIndex: coverIndex,
                }}
              />
            ))
          )}
        </div>

        <h3
          className="w-full truncate text-center font-display text-[11px] uppercase tracking-[0.12em] text-[#fff6ea]"
          title={nome}
        >
          {nome}
        </h3>
        <p className="mt-0.5 text-[10px] font-medium text-[#e2c9a8]">
          {fileCount} {fileCount === 1 ? 'arquivo' : 'arquivos'}
        </p>
      </div>
    </button>
  );
}
