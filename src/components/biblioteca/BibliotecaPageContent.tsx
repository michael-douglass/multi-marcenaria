import { useMemo, useState } from 'react';
import { useBibliotecaMedias, type BibliotecaMedia } from '@/hooks/useBibliotecaMedias';
import {
  useMarketingMediaFolders,
  type MarketingMediaFolder,
} from '@/hooks/useMarketingMediaFolders';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { BibliotecaUploadZone } from '@/components/biblioteca/BibliotecaUploadZone';
import { BibliotecaMediaCard } from '@/components/biblioteca/BibliotecaMediaCard';
import { BibliotecaDetailDialog } from '@/components/biblioteca/BibliotecaDetailDialog';
import { BibliotecaFoldersBar } from '@/components/biblioteca/BibliotecaFoldersBar';
import {
  BIBLIOTECA_CATEGORIAS,
  type BibliotecaCategoria,
  countFolderItems,
  countMediasByCategoria,
  filterMediasByCategoria,
  filterMediasByFolder,
} from '@/lib/biblioteca-utils';
import { downloadLeadFotosPdf } from '@/lib/lead-fotos-pdf-export';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BibliotecaPageAura } from '@/components/biblioteca/BibliotecaPageAura';
import {
  Archive,
  ArrowLeft,
  Download,
  FileStack,
  FileText,
  FolderOpen,
  ImageIcon,
  Images,
  Loader2,
  Search,
  Shield,
  Video,
  X,
} from 'lucide-react';

const CATEGORIA_ICONS: Record<BibliotecaCategoria, typeof Archive> = {
  todas: Archive,
  imagens: ImageIcon,
  videos: Video,
  arquivos: FileStack,
};

async function downloadMediaFile(media: BibliotecaMedia): Promise<void> {
  const response = await fetch(media.file_url);
  if (!response.ok) throw new Error('Falha no download');
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = media.file_name || `${media.titulo}.${media.tipo}`;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function BibliotecaPageContent() {
  const { medias, isLoading, uploadFile, deleteMedia } = useBibliotecaMedias();
  const {
    folders,
    isLoading: foldersLoading,
    createFolder,
    updateFolder,
    deleteFolder,
  } = useMarketingMediaFolders();
  const { userRole } = useAuth();
  const { isSuperAdmin, empresa } = useEmpresa();

  /** Admin e vendedor podem gerenciar, baixar e exportar PDF. */
  const canManage =
    userRole === 'admin' || userRole === 'vendedor' || isSuperAdmin;
  const canDelete = canManage;
  const canDownload = canManage;
  const canExportPdf = canManage;

  const [categoria, setCategoria] = useState<BibliotecaCategoria>('todas');
  const [busca, setBusca] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<BibliotecaMedia | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BibliotecaMedia | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editFolderDialogOpen, setEditFolderDialogOpen] = useState(false);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<MarketingMediaFolder | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<MarketingMediaFolder | null>(null);
  const [folderNome, setFolderNome] = useState('');
  const [folderDescricao, setFolderDescricao] = useState('');

  const currentFolder = folders.find((f) => f.id === currentFolderId) ?? null;
  const loading = isLoading || foldersLoading;

  const counts = useMemo(() => countMediasByCategoria(medias), [medias]);

  const getFolderItemCount = (folderId: string) => countFolderItems(medias, folderId);

  const filteredMedias = useMemo(() => {
    let list = filterMediasByCategoria(medias, categoria);
    list = filterMediasByFolder(list, currentFolderId);

    const term = busca.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (m) =>
        m.titulo.toLowerCase().includes(term) ||
        m.file_name.toLowerCase().includes(term) ||
        (m.lead_id != null && String(m.lead_id).includes(term)),
    );
  }, [medias, categoria, busca, currentFolderId]);

  const selectedMedias = useMemo(
    () => filteredMedias.filter((m) => selectedIds.has(m.id)),
    [filteredMedias, selectedIds],
  );

  const selectedImages = useMemo(
    () => selectedMedias.filter((m) => m.tipo === 'imagem'),
    [selectedMedias],
  );

  const clearSelection = () => setSelectedIds(new Set());

  const handleUpload = async (file: File, titulo: string) => {
    setUploading(true);
    try {
      await uploadFile(file, titulo, currentFolderId);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (media: BibliotecaMedia) => {
    if (!canDownload) {
      toast({
        title: 'Download não permitido',
        description: 'Seu perfil não tem permissão para baixar arquivos.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await downloadMediaFile(media);
      toast({ title: 'Download iniciado' });
    } catch {
      toast({ title: 'Erro ao baixar arquivo', variant: 'destructive' });
    }
  };

  const handleToggleSelect = (media: BibliotecaMedia) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(media.id)) next.delete(media.id);
      else next.add(media.id);
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedIds(new Set(filteredMedias.map((m) => m.id)));
  };

  const handleSelectAllImages = () => {
    setSelectedIds(
      new Set(filteredMedias.filter((m) => m.tipo === 'imagem').map((m) => m.id)),
    );
  };

  const handleDownloadSelected = async () => {
    if (!canDownload || selectedMedias.length === 0) return;
    setBatchBusy(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const media of selectedMedias) {
        try {
          await downloadMediaFile(media);
          ok += 1;
          // Pequena pausa para o navegador não bloquear vários downloads seguidos
          await sleep(250);
        } catch {
          fail += 1;
        }
      }
      if (fail === 0) {
        toast({
          title: ok === 1 ? 'Download iniciado' : `${ok} downloads iniciados`,
        });
      } else {
        toast({
          title: `${ok} baixados, ${fail} falharam`,
          variant: 'destructive',
        });
      }
    } finally {
      setBatchBusy(false);
    }
  };

  const handleExportSelectedPdf = async () => {
    if (!canExportPdf) return;
    if (selectedImages.length === 0) {
      toast({
        title: 'Selecione fotos',
        description: 'O PDF só inclui imagens. Marque pelo menos uma foto.',
        variant: 'destructive',
      });
      return;
    }
    setBatchBusy(true);
    try {
      await downloadLeadFotosPdf({
        imageUrls: selectedImages.map((m) => m.file_url),
        imageLabels: selectedImages.map((m) => m.titulo),
        logoUrl: empresa?.logo_url,
        nomeEmpresa: empresa?.nome,
        cnpj: empresa?.cnpj,
        leadName: currentFolder?.nome ? `Biblioteca · ${currentFolder.nome}` : 'Biblioteca',
      });
      toast({
        title:
          selectedImages.length === 1
            ? 'PDF baixado'
            : `PDF com ${selectedImages.length} fotos baixado`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao gerar PDF',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setBatchBusy(false);
    }
  };

  const handleOpenDetail = (media: BibliotecaMedia) => {
    setSelectedMedia(media);
    setDetailOpen(true);
  };

  const handleDeleteRequest = (media: BibliotecaMedia) => {
    setDeleteTarget(media);
    setDetailOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteMedia(deleteTarget);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(deleteTarget.id);
      return next;
    });
    setDeleteTarget(null);
    setSelectedMedia(null);
  };

  const openCreateFolderDialog = () => {
    setFolderNome('');
    setFolderDescricao('');
    setFolderDialogOpen(true);
  };

  const handleCreateFolder = async () => {
    if (!folderNome.trim()) return;
    await createFolder({
      nome: folderNome.trim(),
      descricao: folderDescricao.trim() || null,
    });
    setFolderDialogOpen(false);
    setFolderNome('');
    setFolderDescricao('');
  };

  const handleEditFolder = (folder: MarketingMediaFolder) => {
    setSelectedFolder(folder);
    setFolderNome(folder.nome);
    setFolderDescricao(folder.descricao || '');
    setEditFolderDialogOpen(true);
  };

  const handleSaveEditFolder = async () => {
    if (!selectedFolder || !folderNome.trim()) return;
    await updateFolder({
      id: selectedFolder.id,
      nome: folderNome.trim(),
      descricao: folderDescricao.trim() || null,
    });
    setEditFolderDialogOpen(false);
    setSelectedFolder(null);
    setFolderNome('');
    setFolderDescricao('');
  };

  const handleDeleteFolderConfirm = async () => {
    if (!deleteFolderTarget) return;
    await deleteFolder(deleteFolderTarget.id);
    if (currentFolderId === deleteFolderTarget.id) {
      setCurrentFolderId(null);
    }
    setDeleteFolderTarget(null);
  };

  const filesSectionLabel = currentFolderId
    ? `Arquivos em "${currentFolder?.nome}"`
    : 'Arquivos e imagens de leads';

  return (
    <div className="cobrancas-page-shell fade-in relative -mx-2 -mt-2 min-h-[calc(100svh-4.25rem)] px-3 pb-10 sm:-mx-3 sm:-mt-3 sm:px-4 md:px-8">
      <BibliotecaPageAura />
      <div className="relative z-[1] mx-auto max-w-6xl space-y-6 pt-4 md:pt-8">
      <header className="cobrancas-masthead relative overflow-hidden rounded-2xl border border-[rgba(26,16,12,0.12)] bg-[#fffaf4]/92 px-5 py-6 shadow-[0_12px_32px_rgba(42,24,18,0.06)] sm:px-8 sm:py-8">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6b3f12]">
              <Images className="h-3.5 w-3.5" aria-hidden />
              Álbum do ateliê
            </p>
            <h1 className="mt-2 font-display text-3xl italic leading-tight text-[#1a100c] sm:text-5xl">
              Biblioteca
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[#4a3428] sm:text-base">
              Fotos dos leads, vídeos e arquivos do CRM — no mesmo papel da casa.
            </p>
            <p className="section-label mt-3">
              {filteredMedias.length}{' '}
              {filteredMedias.length === 1 ? 'peça na mesa' : 'peças na mesa'}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BIBLIOTECA_CATEGORIAS.map((cat) => {
          const Icon = CATEGORIA_ICONS[cat.id];
          const active = categoria === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setCategoria(cat.id);
                clearSelection();
              }}
              aria-pressed={active}
              className="text-left"
            >
              <Card
                className={cn(
                  'cobrancas-kpi-tile border-[rgba(26,16,12,0.14)] bg-[#fffaf4] shadow-[0_12px_32px_rgba(42,24,18,0.07)] transition',
                  active && 'border-[rgba(107,63,18,0.4)] ring-1 ring-[rgba(107,63,18,0.18)]',
                )}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#4a3428]">
                    <Icon className="h-4 w-4 text-[#6b3f12]" aria-hidden />
                    {cat.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-2xl font-semibold text-[#6b3f12] sm:text-3xl">
                    {counts[cat.id]}
                  </p>
                  <p className="mt-1 text-xs text-[#6b5244]">{cat.description}</p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="hidden lg:block lg:w-52 lg:shrink-0">
          <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {BIBLIOTECA_CATEGORIAS.map((cat) => {
              const Icon = CATEGORIA_ICONS[cat.id];
              const active = categoria === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setCategoria(cat.id);
                    clearSelection();
                  }}
                  className={cn(
                    'biblioteca-cat-btn flex min-w-[140px] items-center gap-3 rounded-sm border px-4 py-3 text-left transition-all lg:min-w-0 lg:w-full',
                    active
                      ? 'border-[rgba(107,63,18,0.45)] bg-[#f4e4c4] text-[#6b3f12]'
                      : 'border-[rgba(26,16,12,0.14)] bg-[#fffaf4] text-[#4a3428] hover:border-[rgba(107,63,18,0.28)] hover:bg-[#f8efe3]',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[#6b3f12]' : 'text-[#6b5244]')} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{cat.label}</p>
                    <p className="truncate text-[11px] text-[#6b5244]">{cat.description}</p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      active ? 'bg-[#6b3f12]/15 text-[#6b3f12]' : 'bg-[#efe4d4] text-[#6b5244]',
                    )}
                  >
                    {counts[cat.id]}
                  </span>
                </button>
              );
            })}
          </nav>

          {canManage && (
            <div className="mt-4 hidden rounded-sm border border-[rgba(107,63,18,0.22)] bg-[#f8efe3] p-3 lg:block">
              <div className="flex items-center gap-2 text-xs text-[#6b3f12]">
                <Shield className="h-3.5 w-3.5" />
                Você pode inserir, excluir, baixar e exportar PDF
              </div>
            </div>
          )}
        </aside>

        <main className="min-w-0 flex-1 space-y-5">
          {currentFolderId && currentFolder && (
            <div className="flex items-center gap-2 rounded-sm border border-[rgba(107,63,18,0.22)] bg-[#fffaf4] px-4 py-3">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-[#6b3f12] hover:bg-[#f4e4c4] hover:text-[#5a340e]"
                onClick={() => {
                  setCurrentFolderId(null);
                  clearSelection();
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <span className="text-[#6b5244]/50">/</span>
              <div className="flex min-w-0 items-center gap-2">
                <FolderOpen className="h-4 w-4 shrink-0 text-[#6b3f12]" />
                <span className="truncate font-medium text-[#1a100c]">{currentFolder.nome}</span>
              </div>
            </div>
          )}

          <BibliotecaUploadZone onUpload={handleUpload} uploading={uploading} />

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b5244]" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou número do lead..."
              className="border-[rgba(26,16,12,0.2)] bg-white pl-10 text-[#1a100c] placeholder:text-[#6b5244]"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-[#6b3f12]" />
            </div>
          ) : (
            <>
              {!currentFolderId && (
                <BibliotecaFoldersBar
                  folders={folders}
                  getItemCount={getFolderItemCount}
                  canManage={canManage}
                  onCreateFolder={openCreateFolderDialog}
                  onOpenFolder={(folder) => {
                    setCurrentFolderId(folder.id);
                    clearSelection();
                  }}
                  onEditFolder={handleEditFolder}
                  onDeleteFolder={setDeleteFolderTarget}
                />
              )}

              <section className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="font-display text-lg tracking-wide text-[#1a100c]">
                      {filesSectionLabel}
                    </h2>
                    <p className="text-xs text-[#6b5244]">
                      {filteredMedias.length}{' '}
                      {filteredMedias.length === 1 ? 'arquivo encontrado' : 'arquivos encontrados'}
                      {selectedIds.size > 0 && (
                        <span className="text-[#6b3f12]">
                          {' '}
                          · {selectedIds.size} selecionado{selectedIds.size === 1 ? '' : 's'}
                        </span>
                      )}
                    </p>
                  </div>

                  {canManage && filteredMedias.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-[rgba(26,16,12,0.18)] bg-[#fffaf4] text-[#4a3428] hover:bg-[#f4e4c4]"
                        onClick={handleSelectAllImages}
                        disabled={batchBusy}
                      >
                        Marcar fotos
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-[rgba(26,16,12,0.18)] bg-[#fffaf4] text-[#4a3428] hover:bg-[#f4e4c4]"
                        onClick={handleSelectAllVisible}
                        disabled={batchBusy}
                      >
                        Marcar todos
                      </Button>
                    </div>
                  )}
                </div>

                {canManage && selectedIds.size > 0 && (
                  <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-sm border border-[rgba(107,63,18,0.28)] bg-[#fffaf4]/95 px-3 py-2 shadow-lg backdrop-blur-md">
                    <span className="mr-1 text-xs text-[#1a100c]">
                      {selectedIds.size} selecionado{selectedIds.size === 1 ? '' : 's'}
                      {selectedImages.length > 0 && selectedImages.length !== selectedIds.size
                        ? ` (${selectedImages.length} foto${selectedImages.length === 1 ? '' : 's'})`
                        : ''}
                    </span>
                    {canDownload && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-[rgba(26,16,12,0.18)] bg-white text-[#4a3428]"
                        onClick={() => void handleDownloadSelected()}
                        disabled={batchBusy}
                      >
                        {batchBusy ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        Baixar
                      </Button>
                    )}
                    {canExportPdf && (
                      <Button
                        type="button"
                        size="sm"
                        className="bg-[#6b3f12] text-[#fffaf4] hover:bg-[#5a340e]"
                        onClick={() => void handleExportSelectedPdf()}
                        disabled={batchBusy || selectedImages.length === 0}
                        title={
                          selectedImages.length === 0
                            ? 'Selecione pelo menos uma foto para gerar PDF'
                            : undefined
                        }
                      >
                        {batchBusy ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="mr-2 h-4 w-4" />
                        )}
                        Exportar PDF
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-[#6b5244] hover:bg-[#f4e4c4] hover:text-[#1a100c]"
                      onClick={clearSelection}
                      disabled={batchBusy}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Limpar
                    </Button>
                  </div>
                )}

                {filteredMedias.length === 0 ? (
                  <div className="rounded-sm border border-dashed border-[rgba(26,16,12,0.18)] bg-[#fffaf4] py-16 text-center">
                    <Archive className="mx-auto mb-3 h-10 w-10 text-[#6b5244]/50" />
                    <p className="font-medium text-[#1a100c]">Nenhum arquivo aqui</p>
                    <p className="mt-1 text-sm text-[#6b5244]">
                      {currentFolderId
                        ? 'Envie imagens para esta pasta usando a área acima'
                        : categoria === 'imagens'
                          ? 'As fotos dos leads aparecerão aqui automaticamente'
                          : 'Os arquivos aparecerão aqui quando forem adicionados'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                    {filteredMedias.map((media, index) => (
                      <BibliotecaMediaCard
                        key={media.id}
                        media={media}
                        canDelete={canDelete}
                        canSelect={canManage}
                        selected={selectedIds.has(media.id)}
                        index={index}
                        onOpen={handleOpenDetail}
                        onDelete={handleDeleteRequest}
                        onToggleSelect={handleToggleSelect}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
      </div>

      <BibliotecaDetailDialog
        media={selectedMedia}
        galleryItems={filteredMedias}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canDelete={canDelete}
        canDownload={canDownload}
        onDelete={handleDeleteRequest}
        onDownload={handleDownload}
        onNavigate={setSelectedMedia}
      />

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="border-white/10 bg-[#1a1410]">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wide">Nova pasta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="folder-nome">Nome da pasta</Label>
              <Input
                id="folder-nome"
                value={folderNome}
                onChange={(e) => setFolderNome(e.target.value)}
                placeholder="Ex: Campanhas 2026"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-desc">Descrição (opcional)</Label>
              <Input
                id="folder-desc"
                value={folderDescricao}
                onChange={(e) => setFolderDescricao(e.target.value)}
                placeholder="Para que serve esta pasta?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateFolder} disabled={!folderNome.trim()}>
              Criar pasta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editFolderDialogOpen} onOpenChange={setEditFolderDialogOpen}>
        <DialogContent className="border-white/10 bg-[#1a1410]">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wide">Renomear pasta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-folder-nome">Nome</Label>
              <Input
                id="edit-folder-nome"
                value={folderNome}
                onChange={(e) => setFolderNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-folder-desc">Descrição (opcional)</Label>
              <Input
                id="edit-folder-desc"
                value={folderDescricao}
                onChange={(e) => setFolderDescricao(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFolderDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEditFolder} disabled={!folderNome.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir arquivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{deleteTarget?.titulo}&quot;?
              {deleteTarget?.origem !== 'biblioteca' && (
                <> Este arquivo também será removido do card do lead.</>
              )}{' '}
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteFolderTarget}
        onOpenChange={(open) => !open && setDeleteFolderTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a pasta &quot;{deleteFolderTarget?.nome}&quot;? Os
              arquivos dentro dela ficarão sem pasta, mas não serão apagados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFolderConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir pasta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
