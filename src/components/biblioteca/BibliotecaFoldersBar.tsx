import type { MarketingMediaFolder } from '@/hooks/useMarketingMediaFolders';
import { BibliotecaFolderCard } from '@/components/biblioteca/BibliotecaFolderCard';
import { Button } from '@/components/ui/button';
import { FolderPlus } from 'lucide-react';

interface BibliotecaFoldersBarProps {
  folders: MarketingMediaFolder[];
  getItemCount: (folderId: string) => number;
  canManage: boolean;
  onCreateFolder: () => void;
  onOpenFolder: (folder: MarketingMediaFolder) => void;
  onEditFolder: (folder: MarketingMediaFolder) => void;
  onDeleteFolder: (folder: MarketingMediaFolder) => void;
}

export function BibliotecaFoldersBar({
  folders,
  getItemCount,
  canManage,
  onCreateFolder,
  onOpenFolder,
  onEditFolder,
  onDeleteFolder,
}: BibliotecaFoldersBarProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg tracking-wide text-amber-100">Pastas</h2>
          <p className="text-xs text-white/45">Organize seus arquivos em pastas</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 border-amber-500/30 bg-amber-500/8 text-amber-100 hover:bg-amber-500/15"
          onClick={onCreateFolder}
        >
          <FolderPlus className="mr-2 h-4 w-4" />
          Nova pasta
        </Button>
      </div>

      {folders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-500/20 bg-amber-500/[0.03] px-4 py-6 text-center">
          <p className="text-sm text-white/50">Nenhuma pasta ainda</p>
          <Button
            variant="link"
            size="sm"
            className="mt-1 text-amber-400"
            onClick={onCreateFolder}
          >
            Criar a primeira pasta
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {folders.map((folder, index) => (
            <BibliotecaFolderCard
              key={folder.id}
              folder={folder}
              itemCount={getItemCount(folder.id)}
              index={index}
              canManage={canManage}
              onOpen={onOpenFolder}
              onEdit={onEditFolder}
              onDelete={onDeleteFolder}
            />
          ))}
        </div>
      )}
    </section>
  );
}
