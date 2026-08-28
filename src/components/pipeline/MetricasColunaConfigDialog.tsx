import { useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMetricasColunaConfig } from '@/hooks/useMetricasColunaConfig';
import { usePipelineStatusSelectOptions } from '@/hooks/usePipelineStatusSelectOptions';
import { toast } from 'sonner';

interface MetricasColunaConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título exibido no diálogo (ex.: Aulas Experimentais) */
  cardTitle?: string;
}

export function MetricasColunaConfigDialog({
  open,
  onOpenChange,
  cardTitle = 'Aulas Experimentais',
}: MetricasColunaConfigDialogProps) {
  const { config, saveConfig, isLoading } = useMetricasColunaConfig();
  const statusOpcoes = usePipelineStatusSelectOptions([config.statusColuna]);

  const [statusColuna, setStatusColuna] = useState(config.statusColuna);

  useEffect(() => {
    if (open) {
      setStatusColuna(config.statusColuna);
    }
  }, [open, config.statusColuna]);

  const handleSave = async () => {
    if (!statusColuna.trim()) {
      toast.error('Escolha a coluna do pipeline');
      return;
    }
    try {
      await saveConfig.mutateAsync({
        id: config.id,
        statusColuna: statusColuna.trim(),
      });
      toast.success('Coluna do card atualizada');
      onOpenChange(false);
    } catch (err) {
      toast.error('Não foi possível salvar', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-warning" />
            {cardTitle} — qual coluna medir?
          </DialogTitle>
          <DialogDescription>
            Escolha a coluna do pipeline. Cada vez que um lead <strong>entrar</strong> nessa coluna,
            o sistema registra um ponto no gráfico do mês em que isso aconteceu (ex.: &quot;Visita
            Feita&quot;).
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
        ) : (
          <div className="space-y-2">
            <Label>Coluna do pipeline</Label>
            <Select value={statusColuna} onValueChange={setStatusColuna}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a coluna" />
              </SelectTrigger>
              <SelectContent>
                {statusOpcoes.map((nome) => (
                  <SelectItem key={nome} value={nome}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Arrastar um card para essa coluna ou marcar venda que move o lead para ela também
              conta.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saveConfig.isPending || isLoading}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
