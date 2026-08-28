import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Save } from 'lucide-react';

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (nome: string, tipo: 'comum' | 'central') => Promise<void>;
  isSaving: boolean;
}

export function SaveTemplateDialog({
  open,
  onOpenChange,
  onSave,
  isSaving,
}: SaveTemplateDialogProps) {
  const [nome, setNome] = useState('');
  const [isCentral, setIsCentral] = useState(false);

  const handleSave = async () => {
    if (!nome.trim()) return;
    await onSave(nome.trim(), isCentral ? 'central' : 'comum');
    setNome('');
    setIsCentral(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Salvar Template da Lousa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Nome do Template</Label>
            <Input
              id="template-name"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Planejamento Q1 2024"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
            <div className="space-y-0.5">
              <Label htmlFor="central-switch" className="text-sm font-medium">
                Planejamento Central
              </Label>
              <p className="text-xs text-muted-foreground">
                Templates centrais aparecem em todos os cards do Kanban
              </p>
            </div>
            <Switch
              id="central-switch"
              checked={isCentral}
              onCheckedChange={setIsCentral}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!nome.trim() || isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
