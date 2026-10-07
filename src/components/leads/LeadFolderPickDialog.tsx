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
  defaultFolderId?: string | null;
  onConfirm: (
    folderId: string | null,
    options?: { fileName: string; includeNotes: boolean; folderName?: string },
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
  defaultFolderId = null,
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
    setSelectedId(defaultFolderId);
    setIsCreatingNew(false);
    setNewNome('');
    setFileName(defaultFileName);
    setFolderNome(defaultFolderName);
    setChoseUnfiled(false);
    setIncludeNotes(notesCount > 0);
  }, [open, defaultFileName, defaultFolderName, defaultFolderId, notesCount]);

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
    if (!canConfirm || isConfirming) return;
    setIsConfirming(true);
    try {
      let folderId = selectedId;
      if (folderId == null && askFolderName && folderNome.trim()) {
        if (!leadId) {
          await onConfirm(null, {
            fileName: fileName.trim(),
            includeNotes: notesToggle && includeNotes && notesCount > 0,
            folderName: folderNome.trim(),
          });
          onOpenChange(false);
          return;
        }
        const existing = findFolderByName(folders, folderNome);
        folderId = existing
          ? existing.id
          : (await createFolder({ nome: folderNome })).id;
      }
      await onConfirm(folderId, {
        fileName: fileName.trim(),
        includeNotes: notesToggle && includeNotes && notesCount > 0,
        folderName: folderNome.trim() || undefined,
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
          'max-w-lg overflow-hidden border-[rgba(26,16,12,0.16)] bg-[#fffaf4] p-0 text-[#1a100c]',
          'shadow-[0_24px_64px_rgba(42,24,18,0.22)]',
          elevated ? 'z-[9801]' : 'z-[81]',
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at top, rgba(180,120,60,0.12), transparent 55%), repeating-linear-gradient(0deg, transparent, transparent 11px, rgba(26,16,12,0.03) 11px, rgba(26,16,12,0.03) 12px)',
          }}
          aria-hidden
        />

        <DialogHeader className="relative space-y-2 border-b border-[rgba(26,16,12,0.12)] bg-[#f7efe4] px-5 pb-4 pt-5 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#6b3f12]">
            Pastas do lead
          </p>
          <DialogTitle className="font-display text-xl tracking-wide text-[#1a100c]">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-[#4a3428]">{description}</DialogDescription>
        </DialogHeader>

        <div className="relative space-y-4 px-5 py-4">
          {previewUrl && (
            <div className="mx-auto h-20 w-20 overflow-hidden rounded-xl border border-[rgba(26,16,12,0.18)] shadow-md">
              <img src={previewUrl} alt="Prévia" className="h-full w-full object-cover" />
            </div>
          )}

          {askFolderName && (
            <div className="space-y-1.5">
              <Label htmlFor="nome-pasta-lead-upload" className="text-[#1a100c]">
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
                className="border-[rgba(26,16,12,0.2)] bg-white text-[#1a100c] placeholder:text-[#4a3428]/70"
                aria-label={folderNameLabel}
                autoFocus={!askFileName}
              />
              <p className="text-[11px] text-[#4a3428]">
                Digite o nome. Se a pasta ainda não existir, ela é criada agora.
              </p>
            </div>
          )}

          {askFileName && (
            <div className="space-y-1.5">
              <Label htmlFor="nome-arquivo-lousa" className="text-[#1a100c]">
                {fileNameLabel}
              </Label>
              <Input
                id="nome-arquivo-lousa"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Ex.: Cozinha parede principal"
                className="border-[rgba(26,16,12,0.2)] bg-white text-[#1a100c] placeholder:text-[#4a3428]/70"
                aria-label={fileNameLabel}
                autoFocus
              />
              <p className="text-[11px] text-[#4a3428]">
                A foto e o arquivo da nota (se houver) usam este nome, na mesma pasta.
              </p>
            </div>
          )}

          {notesToggle && (
            <label className="flex items-start gap-2 rounded-xl border border-[rgba(26,16,12,0.14)] bg-white px-3 py-2.5">
              <Checkbox
                checked={includeNotes}
                disabled={notesCount === 0}
                onCheckedChange={(value) => setIncludeNotes(value === true)}
                className="mt-0.5 border-[#6b3f12]/70 data-[state=checked]:bg-[#6b3f12] data-[state=checked]:text-[#fffaf4]"
              />
              <span className="min-w-0 text-sm text-[#1a100c]">
                Incluir nota da foto na mesma pasta
                <span className="mt-0.5 block text-[11px] text-[#4a3428]">
                  {notesCount === 0
                    ? 'Escreva uma nota ao lado da foto na lousa para incluir aqui.'
                    : 'Gera um único arquivo de nota (imagem com miniatura + texto) na mesma pasta.'}
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
                    ? 'border-[#6b3f12] bg-[#f0e2cf] text-[#1a100c] ring-2 ring-[#6b3f12]/35'
                    : 'border-[rgba(26,16,12,0.28)] bg-white text-[#4a3428] hover:border-[#6b3f12]/50 hover:bg-[#f7efe4]',
                )}
              >
                <Images className="mb-1.5 h-5 w-5 text-[#6b3f12]" />
                <span className="text-xs font-semibold">Sem pasta</span>
              </button>
            )}
          </div>

          {showCreateForm ? (
            <div className="space-y-2 rounded-xl border border-[rgba(26,16,12,0.14)] bg-white p-3">
              <Label htmlFor="nova-pasta-lead" className="text-[#1a100c]">
                Nome da nova pasta
              </Label>
              <Input
                id="nova-pasta-lead"
                value={newNome}
                onChange={(e) => setNewNome(e.target.value)}
                placeholder="Ex.: Sala, Cozinha, Fachada"
                className="border-[rgba(26,16,12,0.2)] bg-[#fffaf4] text-[#1a100c] placeholder:text-[#4a3428]/70"
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
                    className="text-[#4a3428] hover:bg-[#f0e2cf] hover:text-[#1a100c]"
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
                  className="bg-[#6b3f12] text-[#fffaf4] hover:bg-[#5a340f]"
                  disabled={!newNome.trim() || isCreating || !leadId}
                  onClick={() => void handleCreate()}
                >
                  {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Criar
                </Button>
              </div>
            </div>
          ) : (
            !askFolderName && (
              <Button
                type="button"
                variant="outline"
                className="w-full border-[rgba(26,16,12,0.2)] bg-white text-[#1a100c] hover:bg-[#f7efe4]"
                onClick={() => setIsCreatingNew(true)}
                disabled={!leadId}
              >
                <FolderPlus className="mr-2 h-4 w-4 text-[#6b3f12]" />
                Nova pasta
              </Button>
            )
          )}
        </div>

        <DialogFooter className="relative border-t border-[rgba(26,16,12,0.12)] bg-[#f7efe4] px-5 py-4">
          <Button
            type="button"
            variant="ghost"
            className="text-[#4a3428] hover:bg-[#efe4d4] hover:text-[#1a100c]"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-[#6b3f12] text-[#fffaf4] hover:bg-[#5a340f]"
            disabled={!canConfirm || isConfirming}
            onClick={() => void handleConfirm()}
          >
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
          ? 'border-[#6b3f12] bg-[#f0e2cf] ring-2 ring-[#6b3f12]/30 shadow-sm'
          : 'border-[rgba(26,16,12,0.14)] bg-white hover:border-[#6b3f12]/45 hover:bg-[#f7efe4]',
      )}
    >
      <div className="relative mx-auto mb-2 h-12 w-[4.5rem]">
        {stack.length === 0 ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#efe4d4] ring-1 ring-[rgba(107,63,18,0.28)]">
            <Folder className="h-5 w-5 text-[#6b3f12]" />
          </div>
        ) : (
          stack.map((url, index) => (
            <img
              key={`${folder.id}-${index}`}
              src={url}
              alt=""
              className="absolute h-12 w-10 rounded-md border border-[rgba(26,16,12,0.2)] object-cover shadow-md"
              style={{
                left: index * 10,
                transform: `rotate(${(index - 1) * 6}deg)`,
                zIndex: index,
              }}
            />
          ))
        )}
      </div>
      <p className="truncate text-xs font-semibold text-[#1a100c]" title={folder.nome}>
        {folder.nome}
      </p>
      <p className="text-[10px] font-medium text-[#4a3428]">
        {count} {count === 1 ? 'arquivo' : 'arquivos'}
      </p>
    </button>
  );
}
