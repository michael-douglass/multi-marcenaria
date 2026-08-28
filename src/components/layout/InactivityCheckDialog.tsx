import { AlertTriangle, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface InactivityCheckDialogProps {
  open: boolean;
  onConfirm: () => void;
}

export function InactivityCheckDialog({ open, onConfirm }: InactivityCheckDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
        {/* Ícone pulsante + mensagem em tempo real aguardando confirmação */}
        <div className="flex flex-col items-center gap-3 py-2">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-lg animate-pulse"
            aria-hidden
          >
            <Users className="h-7 w-7 text-white" />
          </div>
          <p className="text-center text-sm font-medium text-muted-foreground">
            Aguardando confirmação do vendedor.
          </p>
        </div>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Você ainda está aí?
          </DialogTitle>
          <DialogDescription>
            Não detectamos atividade nos últimos minutos. Confirme que ainda está trabalhando.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onConfirm} className="w-full">
            Sim, estou aqui!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
