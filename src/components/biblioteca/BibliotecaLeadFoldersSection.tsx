import { useMemo } from 'react';
import type { MarketingMediaFolder } from '@/hooks/useMarketingMediaFolders';
import type { BibliotecaMedia } from '@/hooks/useBibliotecaMedias';
import { useLeadNamesByIds } from '@/hooks/useLeadNamesByIds';
import { capasDaPasta, primeiraMidiaDaPasta } from '@/lib/biblioteca-priority';
import { Folder, FolderOpen, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BibliotecaLeadFoldersSectionProps {
  folders: MarketingMediaFolder[];
  medias: BibliotecaMedia[];
  busca: string;
  onOpenFolder: (folder: MarketingMediaFolder) => void;
  onPlayFolder?: (folder: MarketingMediaFolder, first: BibliotecaMedia) => void;
}

export function BibliotecaLeadFoldersSection({
  folders,
  medias,
  busca,
  onOpenFolder,
  onPlayFolder,
}: BibliotecaLeadFoldersSectionProps) {
  const leadIds = useMemo(
    () => folders.map((folder) => folder.lead_id).filter((id): id is number => id != null),
    [folders],
  );
  const { data: names = {} } = useLeadNamesByIds(leadIds);
  const term = busca.trim().toLowerCase();

  const groups = useMemo(() => {
    const byLead = new Map<number, MarketingMediaFolder[]>();
    for (const folder of folders) {
      if (folder.lead_id == null) continue;
      const list = byLead.get(folder.lead_id) ?? [];
      list.push(folder);
      byLead.set(folder.lead_id, list);
    }

    return [...byLead.entries()]
      .map(([leadId, pastas]) => {
        const leadNome = names[leadId] ?? `Lead ${leadId}`;
        const filtered = term
          ? pastas.filter(
              (pasta) =>
                pasta.nome.toLowerCase().includes(term) ||
                leadNome.toLowerCase().includes(term) ||
                String(leadId).includes(term),
            )
          : pastas;
        return {
          leadId,
          leadNome,
          pastas: [...filtered].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
        };
      })
      .filter((group) => group.pastas.length > 0)
      .sort((a, b) => a.leadNome.localeCompare(b.leadNome, 'pt-BR'));
  }, [folders, names, term]);

  if (folders.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg tracking-wide text-[#1a100c]">Pastas de leads</h2>
        <p className="text-xs text-[#6b5244]">
          As mesmas gavetas do card do cliente. Para mudar o nome, abra o card.
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-sm border border-dashed border-[rgba(26,16,12,0.16)] bg-[#fffaf4] px-4 py-6 text-center text-sm text-[#6b5244]">
          Nenhuma pasta de lead combina com a busca.
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.leadId} className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b3f12]">
              {group.leadNome}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {group.pastas.map((folder, index) => {
                const covers = capasDaPasta(medias, folder.id);
                const first = primeiraMidiaDaPasta(medias, folder.id);
                const count = medias.filter((media) => media.folder_id === folder.id).length;
                return (
                  <article
                    key={folder.id}
                    className="biblioteca-folder-tab group relative overflow-hidden rounded-sm"
                    style={{ animationDelay: `${Math.min(index * 40, 280)}ms` }}
                  >
                    {covers.length > 0 && onPlayFolder && first && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1.5 top-1.5 z-10 h-7 w-7 bg-[#fffaf4]/90 text-[#6b3f12] hover:bg-[#f4e4c4]"
                        title="Abrir a primeira foto"
                        onClick={(event) => {
                          event.stopPropagation();
                          onPlayFolder(folder, first);
                        }}
                      >
                        <Play className="ml-0.5 h-3.5 w-3.5" />
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenFolder(folder)}
                      className="flex w-full flex-col items-center px-3 pb-3 pt-5 text-center"
                    >
                      <div className="relative mb-2 h-16 w-[4.75rem]">
                        {covers.length === 0 ? (
                          <div className="flex h-14 w-14 items-center justify-center rounded-sm bg-[#f4e4c4] ring-1 ring-[rgba(107,63,18,0.28)]">
                            <Folder className="h-7 w-7 text-[#6b3f12] transition group-hover:hidden" />
                            <FolderOpen className="hidden h-7 w-7 text-[#6b3f12] group-hover:block" />
                          </div>
                        ) : (
                          covers.map((url, coverIndex) => (
                            <img
                              key={`${folder.id}-${coverIndex}`}
                              src={url}
                              alt=""
                              className="absolute h-14 w-11 rounded-[2px] border border-[rgba(26,16,12,0.2)] object-cover shadow-md"
                              style={{
                                left: coverIndex * 8,
                                transform: `rotate(${[-7, 0, 7][coverIndex] ?? 0}deg)`,
                                zIndex: coverIndex,
                              }}
                            />
                          ))
                        )}
                      </div>
                      <h3
                        className={cn('w-full truncate text-sm font-semibold text-[#1a100c]')}
                        title={`${group.leadNome} · ${folder.nome}`}
                      >
                        {folder.nome}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-[#6b5244]">
                        {count} {count === 1 ? 'arquivo' : 'arquivos'}
                      </p>
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
