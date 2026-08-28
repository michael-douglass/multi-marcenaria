import { useState } from 'react';
import { Link2, Loader2, Search, User } from 'lucide-react';
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
import {
  useBuscaLeadsParaContrato,
  useVincularContratoLead,
} from '@/hooks/useContratosLead';

interface VincularContratoLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contratoId: string;
  contratoLabel?: string;
  onVinculado?: (leadId: number) => void;
}

export function VincularContratoLeadDialog({
  open,
  onOpenChange,
  contratoId,
  contratoLabel,
  onVinculado,
}: VincularContratoLeadDialogProps) {
  const [busca, setBusca] = useState('');
  const [leadSelecionado, setLeadSelecionado] = useState<number | null>(null);
  const { data: leads = [], isLoading } = useBuscaLeadsParaContrato(busca);
  const vincular = useVincularContratoLead();

  const handleConfirmar = () => {
    if (!leadSelecionado) return;
    vincular.mutate(
      { contratoId, leadId: leadSelecionado },
      {
        onSuccess: (data) => {
          if (data.lead_id) onVinculado?.(data.lead_id);
          onOpenChange(false);
          setBusca('');
          setLeadSelecionado(null);
        },
      },
    );
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-amber-400" />
            Vincular contrato ao lead
          </DialogTitle>
          {contratoLabel && (
            <p className="text-sm text-muted-foreground truncate">{contratoLabel}</p>
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
                <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
              </div>
            ) : leads.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">
                Nenhum lead encontrado.
              </p>
            ) : (
              <ul className="p-1">
                {leads.map((lead) => {
                  const ativo = leadSelecionado === lead.id;
                  return (
                    <li key={lead.id}>
                      <button
                        type="button"
                        className={`w-full text-left px-3 py-2.5 rounded-md flex items-start gap-2 transition-colors ${
                          ativo
                            ? 'bg-amber-500/15 border border-amber-500/35'
                            : 'hover:bg-muted/60'
                        }`}
                        onClick={() => setLeadSelecionado(lead.id)}
                      >
                        <User className="h-4 w-4 shrink-0 mt-0.5 text-amber-400/80" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{lead.nome}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {lead.telefone || 'Sem telefone'} · {lead.status}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-2"
            disabled={!leadSelecionado || vincular.isPending}
            onClick={handleConfirmar}
          >
            {vincular.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Vincular ao lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
