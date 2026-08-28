import { useEffect, useMemo, useState } from 'react';
import { Folder, FolderPlus, Images, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useLeadMediaFolders, type LeadMediaFolder } from '@/hooks/useLeadMediaFolders';
import { countFolderFiles, findFolderByName, getFolderCoverUrls } from '@/lib/lead-media-folders';

interface CoverItem {
  folder_id: string | null;
  tipo?: string;
  file_url: string;
}

interface LeadFolderPickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number | null | undefined;
  title?: string;
  description?: string;
  confirmLabel?: string;
  previewUrl?: string | null;
  allowUnfiled?: boolean;
  /** Acima da lousa em tela cheia (z ~9600). */
  elevated?: boolean;
  coverItems?: CoverItem[];
  /** Pede um nome para o arquivo salvo. */
  askFileName?: boolean;
  defaultFileName?: string;
  fileNameLabel?: string;
  /** Campo de nome da pasta — cria se ainda não existir. */
  askFolderName?: boolean;
  defaultFolderName?: string;
  folderNameLabel?: string;
  notesToggle?: boolean;
  notesCount?: number;
  onConfirm: (
    folderId: string | null,
    options?: { fileName: string; includeNotes: boolean },
  ) => void | Promise<void>;
}

export function LeadFolderPickDialog({
  open,
  onOpenChange,
  leadId,
  title = 'Onde guardar esta foto?',
  description = 'Escolha uma pasta do lead ou crie uma nova (sala, cozinha, fachada…).',
  confirmLabel = 'Salvar nesta pasta',
  previewUrl,
  allowUnfiled = true,
  elevated = false,
  coverItems = [],
  askFileName = false,
  defaultFileName = '',
  fileNameLabel = 'Nome da foto',
  askFolderName = false,
  defaultFolderName = '',
  folderNameLabel = 'Nome da pasta',
  notesToggle = false,
  notesCount = 0,
  onConfirm,
}: LeadFolderPickDialogProps) {
  const { folders, createFolder, isCreating } = useLeadMediaFolders(leadId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [fileName, setFileName] = useState(defaultFileName);
  const [folderNome, setFolderNome] = useState(defaultFolderName);
  const [choseUnfiled, setChoseUnfiled] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setIsCreatingNew(false);
    setNewNome('');
    setFileName(defaultFileName);
    setFolderNome(defaultFolderName);
    setChoseUnfiled(false);
    setIncludeNotes(notesCount > 0);
  }, [open, defaultFileName, defaultFolderName, notesCount]);

  const canConfirm =
    (selectedId !== null ||
      (askFolderName && folderNome.trim().length > 0) ||
      (allowUnfiled && (!askFolderName || choseUnfiled))) &&
    (!askFileName || fileName.trim().length > 0);
  const showCreateForm = !askFolderName && (isCreatingNew || folders.length === 0);
  const unfiledSelected = allowUnfiled && selectedId === null && (!askFolderName || choseUnfiled);

  const handleCreate = async () => {
    const nome = newNome.trim();
    if (!nome) return;
    const created = await createFolder({ nome });
    setSelectedId(created.id);
    setNewNome('');
    setIsCreatingNew(false);
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setIsConfirming(true);
    try {
      let folderId = selectedId;
      if (folderId == null && askFolderName && folderNome.trim()) {
        const existing = findFolderByName(folders, folderNome);
        folderId = existing
          ? existing.id
          : (await createFolder({ nome: folderNome })).id;
      }
      await onConfirm(folderId, {
        fileName: fileName.trim(),
        includeNotes: notesToggle && includeNotes && notesCount > 0,
      });
      onOpenChange(false);
      setSelectedId(null);
      setIsCreatingNew(false);
      setNewNome('');
      setFolderNome('');
      setChoseUnfiled(false);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isConfirming) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        data-lead-folder-picker=""
        overlayClassName={elevated ? 'z-[9800]' : 'z-[80]'}
        className={cn(
          'max-w-lg overflow-hidden border-amber-500/25 bg-[#1a100c] p-0 text-amber-50',
          'shadow-[0_0_80px_rgba(180,90,20,0.28),inset_0_1px_0_rgba(242,216,146,0.28)]',
          elevated ? 'z-[9801]' : 'z-[81]',
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(242,216,146,0.16),transparent_55%),radial-gradient(circle_at_90%_110%,rgba(120,40,18,0.45),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay [background-image:repeating-radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35)_0_1px,transparent_1px_3px)]" />

        <DialogHeader className="relative space-y-2 border-b border-amber-500/15 px-5 pb-4 pt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-400/80">
            Pastas do lead
          </p>
          <DialogTitle className="font-display text-xl tracking-wide text-amber-50">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-white/55">{description}</DialogDescription>
        </DialogHeader>

        <div className="relative space-y-4 px-5 py-4">
          {previewUrl && (
            <div className="mx-auto h-20 w-20 overflow-hidden rounded-xl border border-amber-400/30 shadow-[0_0_24px_rgba(242,216,146,0.18)]">
              <img src={previewUrl} alt="Prévia" className="h-full w-full object-cover" />
            </div>
          )}

          {askFolderName && (
            <div className="space-y-1.5">
              <Label htmlFor="nome-pasta-lead-upload" className="text-amber-100">
                {folderNameLabel}
              </Label>
              <Input
                id="nome-pasta-lead-upload"
                value={folderNome}
                onChange={(e) => {
                  setFolderNome(e.target.value);
                  setChoseUnfiled(false);
                  const match = findFolderByName(folders, e.target.value);
                  setSelectedId(match?.id ?? null);
                }}
                placeholder="Ex.: Sala, Cozinha, Fachada"
                className="border-amber-500/20 bg-black/30"
                aria-label={folderNameLabel}
                autoFocus={!askFileName}
              />
              <p className="text-[11px] text-white/45">
                Digite o nome. Se a pasta ainda não existir, ela é criada agora.
              </p>
            </div>
          )}

          {askFileName && (
            <div className="space-y-1.5">
              <Label htmlFor="nome-arquivo-lousa" className="text-amber-100">
                {fileNameLabel}
              </Label>
              <Input
                id="nome-arquivo-lousa"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Ex.: Cozinha parede principal"
                className="border-amber-500/20 bg-black/30"
                aria-label={fileNameLabel}
                autoFocus
              />
              <p className="text-[11px] text-white/45">
                A foto e o PDF das observações usam este mesmo nome, na pasta escolhida.
              </p>
            </div>
          )}

          {notesToggle && (
            <label className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-black/20 px-3 py-2.5">
              <Checkbox
                checked={includeNotes}
                disabled={notesCount === 0}
                onCheckedChange={(value) => setIncludeNotes(value === true)}
                className="mt-0.5 border-amber-400/70 data-[state=checked]:bg-amber-400 data-[state=checked]:text-[#1a100c]"
              />
              <span className="min-w-0 text-sm text-amber-50">
                Incluir observações no papel timbrado
                <span className="mt-0.5 block text-[11px] text-white/50">
                  {notesCount === 0
                    ? 'Ainda não há anotações desta visita.'
                    : `Gera um PDF (e uma imagem) com ${notesCount} ${notesCount === 1 ? 'observação' : 'observações'}, para baixar ou imprimir.`}
                </span>
              </span>
            </label>
          )}

          <div className="grid max-h-[40vh] grid-cols-2 gap-2 overflow-y-auto pr-0.5 sm:grid-cols-3">
            {folders.map((folder) => (
              <FolderChoiceCard
                key={folder.id}
                folder={folder}
                selected={selectedId === folder.id}
                covers={getFolderCoverUrls(coverItems, folder.id)}
                count={countFolderFiles(coverItems, folder.id)}
                onSelect={() => {
                  setSelectedId(folder.id);
                  setChoseUnfiled(false);
                  if (askFolderName) setFolderNome(folder.nome);
                }}
              />
            ))}
            {allowUnfiled && (
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setChoseUnfiled(true);
                  if (askFolderName) setFolderNome('');
                }}
                className={cn(
                  'flex min-h-[92px] flex-col items-center justify-center rounded-xl border border-dashed px-2 py-3 text-center transition',
                  unfiledSelected
                    ? 'border-amber-400/70 bg-amber-500/15 text-amber-50 shadow-[0_0_18px_rgba(245,158,11,0.2)]'
                    : 'border-white/15 bg-white/[0.03] text-white/60 hover:border-amber-500/30',
                )}
              >
                <Images className="mb-1.5 h-5 w-5" />
                <span className="text-xs font-medium">Sem pasta</span>
              </button>
            )}
          </div>

          {showCreateForm ? (
            <div className="space-y-2 rounded-xl border border-amber-500/25 bg-black/20 p-3">
              <Label htmlFor="nova-pasta-lead" className="text-amber-100">
                Nome da nova pasta
              </Label>
              <Input
                id="nova-pasta-lead"
                value={newNome}
                onChange={(e) => setNewNome(e.target.value)}
                placeholder="Ex.: Sala, Cozinha, Fachada"
                className="border-amber-500/20 bg-black/30"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleCreate();
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                {folders.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-white/70"
                    onClick={() => {
                      setIsCreatingNew(false);
                      setNewNome('');
                    }}
                  >
                    Cancelar
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  disabled={!newNome.trim() || isCreating || !leadId}
                  onClick={() => void handleCreate()}
                >
                  {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Criar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full border-amber-500/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
              onClick={() => setIsCreatingNew(true)}
              disabled={!leadId}
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              Nova pasta
            </Button>
          )}
        </div>

        <DialogFooter className="relative border-t border-amber-500/15 px-5 py-4">
          <Button type="button" variant="ghost" className="text-white/70" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!canConfirm || isConfirming} onClick={() => void handleConfirm()}>
            {isConfirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Folder className="mr-2 h-4 w-4" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FolderChoiceCard({
  folder,
  selected,
  covers,
  count,
  onSelect,
}: {
  folder: LeadMediaFolder;
  selected: boolean;
  covers: string[];
  count: number;
  onSelect: () => void;
}) {
  const stack = useMemo(() => covers.slice(0, 3), [covers]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative overflow-hidden rounded-xl border px-2 pb-2 pt-3 text-left transition',
        selected
          ? 'border-amber-400/70 bg-amber-500/15 shadow-[0_0_20px_rgba(245,158,11,0.22)]'
          : 'border-white/10 bg-white/[0.04] hover:border-amber-500/35',
      )}
    >
      <div className="relative mx-auto mb-2 h-12 w-[4.5rem]">
        {stack.length === 0 ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-400/25">
            <Folder className="h-5 w-5 text-amber-300" />
          </div>
        ) : (
          stack.map((url, index) => (
            <img
              key={`${folder.id}-${index}`}
              src={url}
              alt=""
              className="absolute h-12 w-10 rounded-md border border-black/40 object-cover shadow-md"
              style={{
                left: index * 10,
                transform: `rotate(${(index - 1) * 6}deg)`,
                zIndex: index,
              }}
            />
          ))
        )}
      </div>
      <p className="truncate text-xs font-semibold text-amber-50" title={folder.nome}>
        {folder.nome}
      </p>
      <p className="text-[10px] text-white/45">
        {count} {count === 1 ? 'arquivo' : 'arquivos'}
      </p>
    </button>
  );
}
