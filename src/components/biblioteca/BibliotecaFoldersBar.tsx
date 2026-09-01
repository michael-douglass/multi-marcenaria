import { useState } from 'react';
import type { MarketingMediaFolder } from '@/hooks/useMarketingMediaFolders';
import { BibliotecaFolderCard } from '@/components/biblioteca/BibliotecaFolderCard';
import { BibliotecaPinAura } from '@/components/biblioteca/BibliotecaPinAura';
import { Button } from '@/components/ui/button';
import { FolderPlus, Pin } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface BibliotecaFoldersBarProps {
  folders: MarketingMediaFolder[];
  favoritas: MarketingMediaFolder[];
  demais: MarketingMediaFolder[];
  getItemCount: (folderId: string) => number;
  canManage: boolean;
  onCreateFolder: () => void;
  onOpenFolder: (folder: MarketingMediaFolder) => void;
  onEditFolder: (folder: MarketingMediaFolder) => void;
  onDeleteFolder: (folder: MarketingMediaFolder) => void;
  onPinFolder: (folder: MarketingMediaFolder) => void;
  onReorderFavoritas: (orderedIds: string[]) => void;
}

function SortableLojaFolder({
  folder,
  itemCount,
  index,
  canManage,
  onOpen,
  onEdit,
  onDelete,
  onPin,
}: {
  folder: MarketingMediaFolder;
  itemCount: number;
  index: number;
  canManage: boolean;
  onOpen: (folder: MarketingMediaFolder) => void;
  onEdit: (folder: MarketingMediaFolder) => void;
  onDelete: (folder: MarketingMediaFolder) => void;
  onPin: (folder: MarketingMediaFolder) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folder.id,
    disabled: !canManage,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <BibliotecaFolderCard
        folder={folder}
        itemCount={itemCount}
        index={index}
        canManage={canManage}
        isDragging={isDragging}
        dragHandleProps={canManage ? { ...attributes, ...listeners } : undefined}
        onOpen={onOpen}
        onEdit={onEdit}
        onDelete={onDelete}
        onPin={onPin}
      />
    </div>
  );
}

export function BibliotecaFoldersBar({
  folders,
  favoritas,
  demais,
  getItemCount,
  canManage,
  onCreateFolder,
  onOpenFolder,
  onEditFolder,
  onDeleteFolder,
  onPinFolder,
  onReorderFavoritas,
}: BibliotecaFoldersBarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = favoritas.map((folder) => folder.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorderFavoritas(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg tracking-wide text-[#1a100c]">Pastas</h2>
          <p className="text-xs text-[#6b5244]">
            Gavetas da loja. Use o alfinete para deixar uma na prateleira de cima.
          </p>
        </div>
        {canManage && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-[rgba(107,63,18,0.35)] bg-[#fffaf4] text-[#6b3f12] hover:bg-[#f4e4c4]"
            onClick={onCreateFolder}
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            Nova pasta
          </Button>
        )}
      </div>

      {folders.length === 0 ? (
        <div className="rounded-sm border border-dashed border-[rgba(107,63,18,0.28)] bg-[#fffaf4] px-4 py-6 text-center">
          <p className="text-sm text-[#6b5244]">Nenhuma pasta ainda</p>
          {canManage && (
            <Button variant="link" size="sm" className="mt-1 text-[#6b3f12]" onClick={onCreateFolder}>
              Criar a primeira pasta
            </Button>
          )}
        </div>
      ) : (
        <>
          {favoritas.length > 0 && (
            <div className="biblioteca-priority-zone relative overflow-hidden rounded-sm border border-[rgba(107,63,18,0.22)] bg-[#f8efe3] p-3 sm:p-4">
              <BibliotecaPinAura />
              <div className="relative z-[1] mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b3f12]">
                <Pin className="h-3.5 w-3.5 fill-current" />
                Prioridade · Favoritas
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={(event) => setActiveId(String(event.active.id))}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setActiveId(null)}
              >
                <SortableContext items={favoritas.map((folder) => folder.id)} strategy={rectSortingStrategy}>
                  <div className="relative z-[1] grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                    {favoritas.map((folder, index) => (
                      <SortableLojaFolder
                        key={folder.id}
                        folder={folder}
                        itemCount={getItemCount(folder.id)}
                        index={index}
                        canManage={canManage}
                        onOpen={onOpenFolder}
                        onEdit={onEditFolder}
                        onDelete={onDeleteFolder}
                        onPin={onPinFolder}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              {activeId ? <span className="sr-only">Reordenando pastas favoritas</span> : null}
            </div>
          )}

          {demais.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {demais.map((folder, index) => (
                <BibliotecaFolderCard
                  key={folder.id}
                  folder={folder}
                  itemCount={getItemCount(folder.id)}
                  index={index}
                  canManage={canManage}
                  onOpen={onOpenFolder}
                  onEdit={onEditFolder}
                  onDelete={onDeleteFolder}
                  onPin={onPinFolder}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
