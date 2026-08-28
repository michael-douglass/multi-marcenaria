import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTabelaOrigemConfig } from '@/hooks/useTabelaOrigemConfig';

interface EditOrigemNomeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  nomeTabela: string;
  nomeAmigavelAtual: string;
}

export function EditOrigemNomeDialog({
  isOpen,
  onClose,
  nomeTabela,
  nomeAmigavelAtual,
}: EditOrigemNomeDialogProps) {
  const [novoNomeAmigavel, setNovoNomeAmigavel] = useState(nomeAmigavelAtual);
  const { updateNomeAmigavel } = useTabelaOrigemConfig();

  useEffect(() => {
    setNovoNomeAmigavel(nomeAmigavelAtual);
  }, [nomeAmigavelAtual, isOpen]);

  const handleSave = async () => {
    if (!novoNomeAmigavel.trim()) return;
    
    await updateNomeAmigavel.mutateAsync({
      nomeTabela,
      novoNomeAmigavel: novoNomeAmigavel.trim(),
    });
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Nome da Região</DialogTitle>
          <DialogDescription>
            Altere o nome amigável exibido para esta tabela de origem.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="nomeTabela" className="text-muted-foreground">
              Tabela (não editável)
            </Label>
            <Input
              id="nomeTabela"
              value={nomeTabela}
              disabled
              className="bg-muted"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="nomeAmigavel">Nome Amigável</Label>
            <Input
              id="nomeAmigavel"
              value={novoNomeAmigavel}
              onChange={(e) => setNovoNomeAmigavel(e.target.value)}
              placeholder="Ex: Minas Gerais, São Paulo..."
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!novoNomeAmigavel.trim() || updateNomeAmigavel.isPending}
          >
            {updateNomeAmigavel.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
