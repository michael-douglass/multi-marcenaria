import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePipelineCustomStages, type PipelineCustomStage } from '@/hooks/usePipelineCustomStages';
import { cn } from '@/lib/utils';

interface PipelineStagesConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COLOR_PRESETS = [
  { label: 'Padrão', value: null },
  { label: 'Primário', value: 'primary' },
  { label: 'Sucesso', value: 'success' },
  { label: 'Alerta', value: 'warning' },
  { label: 'Perigo', value: 'destructive' },
  { label: 'Secundário', value: 'secondary' },
  { label: 'Neutro', value: 'muted' },
];

export function PipelineStagesConfigDialog({ open, onOpenChange }: PipelineStagesConfigDialogProps) {
  const { stages, isLoading, createStage, updateStage, deleteStage, reorderStages, seedDefaultStages } = usePipelineCustomStages();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editColor, setEditColor] = useState<string | null>(null);
  const [stageToDelete, setStageToDelete] = useState<PipelineCustomStage | null>(null);

  // Semeia colunas padrão automaticamente se a tabela estiver vazia
  useEffect(() => {
    if (open && !isLoading && stages.length === 0 && !seedDefaultStages.isPending) {
      seedDefaultStages.mutate();
    }
  }, [open, isLoading, stages.length]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createStage.mutateAsync({ nome: newName, cor: newColor });
    setNewName('');
    setNewColor(null);
  };

  const startEdit = (stage: PipelineCustomStage) => {
    setEditingId(stage.id);
    setEditValue(stage.nome);
    setEditColor(stage.cor);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
    setEditColor(null);
  };

  const isNovoLead = (stage: PipelineCustomStage) => stage.nome === 'Novo Lead';

  const minMovableIndex = stages.findIndex((s) => !isNovoLead(s));

  const saveEdit = async (id: string, stage: PipelineCustomStage) => {
    // "Novo Lead" é fixo — só cor pode ser alterada.
    await updateStage.mutateAsync(
      isNovoLead(stage) ? { id, cor: editColor } : { id, nome: editValue, cor: editColor },
    );
    cancelEdit();
  };

  const move = async (index: number, direction: 'up' | 'down') => {
    const next = [...stages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= next.length) return;
    if (isNovoLead(next[index])) return;
    if (direction === 'up' && isNovoLead(next[targetIndex])) return;
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    await reorderStages.mutateAsync(next.map((s) => s.id));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar colunas do Pipeline</DialogTitle>
            <DialogDescription>
              Reordene e renomeie todas as colunas. Crie novas colunas personalizadas ou exclua as que não
              utilizar. A coluna <strong>Novo Lead</strong> é fixa — todos os leads novos chegam nela e ela
              não pode ser renomeada nem movida.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Nova coluna */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <Label className="text-sm font-semibold">Nova coluna personalizada</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Nome da coluna (ex.: Aguardando documentos)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                />
                <Button onClick={handleCreate} disabled={!newName.trim() || createStage.isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
              <ColorPicker value={newColor} onChange={setNewColor} />
            </div>

            {/* Lista existente */}
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {(isLoading || seedDefaultStages.isPending) && (
                <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
              )}
              {!isLoading && !seedDefaultStages.isPending && stages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma coluna cadastrada ainda.
                </p>
              )}
              {stages.map((stage, index) => {
                const isEditing = editingId === stage.id;
                const isDefault = stage.is_default;
                const fixo = isNovoLead(stage);
                return (
                  <div
                    key={stage.id}
                    className={cn(
                      'flex flex-col gap-2 rounded-lg border bg-card p-3',
                      fixo ? 'border-primary/40 bg-primary/5' : 'border-border',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'h-3 w-3 rounded-full shrink-0',
                          colorDotClass(stage.cor),
                        )}
                      />
                      {isEditing && !fixo ? (
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1"
                          autoFocus
                        />
                      ) : (
                        <span className="flex-1 text-sm font-medium truncate flex items-center gap-2">
                          {stage.nome}
                          {fixo && (
                            <span className="text-[10px] uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              fixo
                            </span>
                          )}
                        </span>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        {isEditing ? (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => saveEdit(stage.id, stage)}
                              disabled={(!fixo && !editValue.trim()) || updateStage.isPending}
                              aria-label="Salvar"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={cancelEdit} aria-label="Cancelar">
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {!fixo && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => move(index, 'up')}
                                  disabled={index <= minMovableIndex || reorderStages.isPending}
                                  aria-label="Mover para cima"
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => move(index, 'down')}
                                  disabled={index === stages.length - 1 || reorderStages.isPending}
                                  aria-label="Mover para baixo"
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => startEdit(stage)}
                              aria-label={fixo ? 'Alterar cor' : 'Editar'}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!fixo && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setStageToDelete(stage)}
                                aria-label="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {isEditing && <ColorPicker value={editColor} onChange={setEditColor} />}
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!stageToDelete} onOpenChange={(open) => !open && setStageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir coluna "{stageToDelete?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Os leads que estiverem nesta coluna manterão o status atual e poderão ficar sem coluna visível
              até serem movidos manualmente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (stageToDelete) {
                  await deleteStage.mutateAsync(stageToDelete.id);
                  setStageToDelete(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ColorPicker({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">Cor:</span>
      {COLOR_PRESETS.map((preset) => {
        const isSelected = value === preset.value;
        return (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(preset.value)}
            className={cn(
              'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
              isSelected
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-background hover:bg-muted',
            )}
            aria-pressed={isSelected}
          >
            <span className={cn('h-2.5 w-2.5 rounded-full', colorDotClass(preset.value))} />
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}

function colorDotClass(color: string | null | undefined): string {
  switch (color) {
    case 'primary':
      return 'bg-primary';
    case 'success':
      return 'bg-success';
    case 'warning':
      return 'bg-warning';
    case 'destructive':
      return 'bg-destructive';
    case 'secondary':
      return 'bg-secondary';
    case 'muted':
      return 'bg-muted-foreground/40';
    default:
      return 'bg-muted-foreground/30';
  }
}
