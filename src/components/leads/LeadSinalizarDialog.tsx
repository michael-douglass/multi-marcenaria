import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';
import { useLeadSinalizacoes } from '@/hooks/useLeadSinalizacoes';
import { filterLeadSinalizacaoDestinatarios } from '@/lib/lead-sinalizar-access';

interface LeadSinalizarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  leadNome: string;
  leadStatus?: string | null;
}

export function LeadSinalizarDialog({
  open,
  onOpenChange,
  leadId,
  leadNome,
  leadStatus,
}: LeadSinalizarDialogProps) {
  const { users, isLoading: isLoadingUsers } = useUsers();
  const { createSinalizacao } = useLeadSinalizacoes();
  const destinatarios = useMemo(() => filterLeadSinalizacaoDestinatarios(users), [users]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setMensagem('');
      return;
    }
  }, [open]);

  const allSelected =
    destinatarios.length > 0 && destinatarios.every((d) => selectedIds.has(d.id));

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(destinatarios.map((d) => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    await createSinalizacao.mutateAsync({
      leadId,
      leadNome,
      leadStatus,
      destinatarioIds: [...selectedIds],
      mensagem: mensagem.trim() || null,
      enviadoParaTodos: allSelected && destinatarios.length > 1,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Sinalizar lead</DialogTitle>
          <DialogDescription>
            O card <strong>{leadNome}</strong> aparecerá em popup para os colaboradores
            escolhidos, em qualquer página do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="sinalizar-mensagem" className="text-sm font-semibold">
              Mensagem (opcional)
            </Label>
            <Textarea
              id="sinalizar-mensagem"
              placeholder="Ex.: Cliente pediu retorno urgente, revisar orçamento enviado..."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={3}
              maxLength={500}
              className="resize-none text-sm"
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {mensagem.length}/500
            </p>
          </div>

          <Label className="text-sm font-semibold">Sinalizar para quem:</Label>

          {isLoadingUsers ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando colaboradores...
            </div>
          ) : destinatarios.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nenhum colaborador (administrador, vendedor ou marketing) encontrado na empresa.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                <Checkbox
                  id="sinalizar-todos"
                  checked={allSelected}
                  onCheckedChange={(v) => toggleAll(v === true)}
                />
                <Label htmlFor="sinalizar-todos" className="cursor-pointer font-medium">
                  Selecionar todos
                </Label>
              </div>

              <ScrollArea className="h-[min(280px,40vh)] rounded-md border">
                <div className="p-2 space-y-1">
                  {destinatarios.map((dest) => (
                    <div
                      key={dest.id}
                      className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50"
                    >
                      <Checkbox
                        id={`dest-${dest.id}`}
                        checked={selectedIds.has(dest.id)}
                        onCheckedChange={(v) => toggleOne(dest.id, v === true)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={dest.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {dest.nome?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <Label
                        htmlFor={`dest-${dest.id}`}
                        className="flex-1 cursor-pointer text-sm font-normal"
                      >
                        {dest.nome}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={
              selectedIds.size === 0 || createSinalizacao.isPending || destinatarios.length === 0
            }
          >
            {createSinalizacao.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Sinalizar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
