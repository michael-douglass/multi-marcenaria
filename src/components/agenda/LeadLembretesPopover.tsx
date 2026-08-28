import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, CheckCircle2, Edit2, Plus, AlertCircle, Clock, Trash2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  LeadLembrete,
  isLembreteAtrasado,
  useLeadLembretes,
} from '@/hooks/useLeadLembretes';
import { LeadLembreteDialog } from './LeadLembreteDialog';

interface Props {
  leadId: number;
  leadName: string;
  /** Conteúdo do trigger (geralmente o ícone do sino) */
  children: React.ReactNode;
}

/**
 * Popover acionado pelo sino do card. Mostra a lista de lembretes do lead,
 * permite editar, concluir e criar um novo lembrete.
 */
export function LeadLembretesPopover({ leadId, leadName, children }: Props) {
  const [open, setOpen] = useState(false);
  const { lembretes, completeLembrete, deleteLembrete } = useLeadLembretes(leadId, {
    enabled: open,
  });
  const [editing, setEditing] = useState<LeadLembrete | null>(null);
  const [creating, setCreating] = useState(false);

  const ativos = lembretes.filter(
    (l) => l.status !== 'concluido' && l.status !== 'cancelado',
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent
          className="w-80 p-0"
          align="end"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-3 border-b border-border bg-amber-500/10">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold">Lembretes do lead</span>
              <Badge variant="secondary" className="text-[10px]">
                {ativos.length}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setOpen(false);
                setCreating(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo
            </Button>
          </div>

          <ScrollArea className="max-h-72">
            <div className="p-2 space-y-2">
              {ativos.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-6">
                  Nenhum lembrete ativo para este lead
                </div>
              ) : (
                ativos.map((l) => {
                  const atrasado = isLembreteAtrasado(l);
                  const dt = parseISO(l.data_hora);
                  return (
                    <div
                      key={l.id}
                      className={cn(
                        'p-2 rounded-md border transition-colors',
                        atrasado
                          ? 'border-destructive/50 bg-destructive/5'
                          : 'border-border bg-background',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                            {atrasado && (
                              <Badge
                                variant="destructive"
                                className="text-[9px] px-1 py-0"
                              >
                                <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                                Atrasado
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(dt, "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-sm font-medium truncate">{l.titulo}</p>
                          {l.descricao && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                              {l.descricao}
                            </p>
                          )}
                          {(l.anexos?.length ?? 0) > 0 && (
                            <div className="mt-1.5 flex items-center gap-1">
                              {l.anexos.slice(0, 3).map((anexo) => (
                                <img
                                  key={anexo.id}
                                  src={anexo.url}
                                  alt=""
                                  className="h-6 w-6 rounded-[2px] object-cover ring-1 ring-[#f2d892]/40"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-emerald-600"
                            onClick={() => completeLembrete.mutate(l.id)}
                            title="Concluir"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => {
                              setOpen(false);
                              setEditing(l);
                            }}
                            title="Editar"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive hover:bg-destructive/10"
                            onClick={() => deleteLembrete.mutate(l.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {creating && (
        <LeadLembreteDialog
          open={creating}
          onOpenChange={(o) => !o && setCreating(false)}
          leadId={leadId}
          leadName={leadName}
        />
      )}

      {editing && (
        <LeadLembreteDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          leadId={editing.lead_id}
          leadName={editing.lead?.nome || leadName}
          lembrete={editing}
        />
      )}
    </>
  );
}
