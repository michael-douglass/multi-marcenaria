import { useState } from 'react';
import { Loader2, Search, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useBuscaLeads } from '@/hooks/useBuscaLeads';

interface SelectLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (lead: { id: number; nome: string }) => void;
  title?: string;
  description?: string;
  /** Acima do painel flutuante da agenda (z-95). */
  floatingLayer?: boolean;
}

export function SelectLeadDialog({
  open,
  onOpenChange,
  onSelect,
  title = 'Selecionar lead',
  description = 'Busque o lead para criar o lembrete.',
  floatingLayer,
}: SelectLeadDialogProps) {
  const [busca, setBusca] = useState('');
  const [leadSelecionado, setLeadSelecionado] = useState<number | null>(null);
  const { data: leads = [], isLoading } = useBuscaLeads(busca);

  const leadEscolhido = leads.find((l) => l.id === leadSelecionado);

  const handleConfirmar = () => {
    if (!leadEscolhido) return;
    onSelect({ id: leadEscolhido.id, nome: leadEscolhido.nome });
    onOpenChange(false);
    setBusca('');
    setLeadSelecionado(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setBusca('');
          setLeadSelecionado(null);
        }
      }}
    >
      <DialogContent className="max-w-md" floatingLayer={floatingLayer}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            {title}
          </DialogTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar lead por nome ou telefone (mín. 2 letras)"
              className="pl-9"
              autoFocus
            />
          </div>

          <ScrollArea className="h-[220px] rounded-lg border border-border/60">
            {busca.trim().length < 2 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">
                Digite pelo menos 2 caracteres para buscar.
              </p>
            ) : isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : leads.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">
                Nenhum lead encontrado.
              </p>
            ) : (
              <ul className="p-1">
                {leads.map((lead) => (
                  <li key={lead.id}>
                    <button
                      type="button"
                      onClick={() => setLeadSelecionado(lead.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-md transition-colors flex items-center justify-between gap-2 ${
                        leadSelecionado === lead.id
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{lead.nome}</p>
                        {lead.telefone && (
                          <p className="text-xs text-muted-foreground">{lead.telefone}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {lead.status}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={!leadSelecionado}>
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
