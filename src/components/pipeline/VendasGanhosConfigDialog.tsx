import { useEffect, useMemo, useState } from 'react';
import { usePipelineStatusFilterOptions } from '@/hooks/usePipelineStatusSelectOptions';
import { Plus, Trash2, Settings2 } from 'lucide-react';
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
import { useVendasGanhosConfig } from '@/hooks/useVendasGanhosConfig';
import { prepareVendasGanhosConfigForSave, type VendasGanhosFonte } from '@/lib/vendas-ganhos';
import { toast } from 'sonner';

interface VendasGanhosConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VendasGanhosConfigDialog({ open, onOpenChange }: VendasGanhosConfigDialogProps) {
  const { config, saveConfig, isLoading } = useVendasGanhosConfig();

  const configExtras = useMemo(
    () => [
      config.statusDestinoAoGanhar,
      ...config.fontes.map((f) => f.valorFonte),
    ],
    [config.statusDestinoAoGanhar, config.fontes],
  );

  const statusFilterOptions = usePipelineStatusFilterOptions(configExtras);
  const statusValues = useMemo(
    () => statusFilterOptions.map((o) => o.value),
    [statusFilterOptions],
  );

  const [statusDestino, setStatusDestino] = useState(config.statusDestinoAoGanhar);
  const [fontes, setFontes] = useState<VendasGanhosFonte[]>(config.fontes);

  useEffect(() => {
    if (open) {
      const destino = config.statusDestinoAoGanhar.trim();
      const destinoValido =
        destino && statusValues.some((v) => v === destino) ? destino : statusValues[0] ?? destino;
      setStatusDestino(destinoValido);
      setFontes(config.fontes);
    }
  }, [open, config, statusValues]);

  const addFonte = () => {
    const primeiro = statusValues[0] ?? statusDestino ?? 'Venda Realizada (Matriculado)';
    setFontes((prev) => [
      ...prev,
      {
        tipoFonte: 'status',
        valorFonte: primeiro,
        filtroOrigens: [],
        filtroRegioes: [],
        ativo: true,
      },
    ]);
  };

  const handleSave = async () => {
    const ativas = fontes.filter((f) => f.ativo && f.valorFonte.trim());
    if (ativas.length === 0) {
      toast.error('Adicione pelo menos uma fonte (status) que conta como venda ganha');
      return;
    }
    if (!statusDestino.trim()) {
      toast.error('Escolha para qual coluna o lead vai ao marcar a venda');
      return;
    }
    try {
      const prepared = prepareVendasGanhosConfigForSave({
        statusDestinoAoGanhar: statusDestino.trim(),
        fontes,
      });
      await saveConfig.mutateAsync({
        id: config.id,
        ...prepared,
      });
      toast.success('Configuração de negócios ganhos salva');
      onOpenChange(false);
    } catch (err) {
      toast.error('Não foi possível salvar', {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-amber-500" />
            Negócios Ganhos — configuração
          </DialogTitle>
          <DialogDescription>
            Defina quais status contam como venda ganha no card e para qual coluna o lead deve ir ao
            marcar a venda. A lista inclui colunas do pipeline principal e das páginas Kanban (ex.:
            Orçamentos ganhos).
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Ao marcar venda como ganha, mover lead para</Label>
              <Select value={statusDestino || undefined} onValueChange={setStatusDestino}>
                <SelectTrigger>
                  <SelectValue placeholder="Coluna de destino" />
                </SelectTrigger>
                <SelectContent>
                  {statusFilterOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label !== opt.value ? `${opt.label} (${opt.value})` : opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ex.: depois de fechar a venda, o lead vai para esta coluna e também passa a contar em
                Negócios Ganhos (a coluna destino entra automaticamente nas fontes de ganho).
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Fontes de dados (o que conta como ganho)</Label>
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={addFonte}>
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Leads nestes status entram no faturamento, na lista e na taxa de conversão do card.
              </p>

              <div className="space-y-2">
                {fontes.map((fonte, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20"
                  >
                    <Select
                      value={fonte.valorFonte}
                      onValueChange={(v) =>
                        setFontes((prev) =>
                          prev.map((f, i) => (i === index ? { ...f, valorFonte: v } : f)),
                        )
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusFilterOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label !== opt.value ? `${opt.label} (${opt.value})` : opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive"
                      onClick={() => setFontes((prev) => prev.filter((_, i) => i !== index))}
                      disabled={fontes.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
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
