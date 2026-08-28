import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bell,
  X,
  CheckCircle2,
  Edit2,
  AlertCircle,
  Clock,
  Phone,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { floatingPopupPositionClass } from '@/lib/floating-ui-layout';
import {
  LeadLembrete,
  isLembreteAtrasado,
  useLeadLembretes,
} from '@/hooks/useLeadLembretes';
import { LeadLembreteDialog } from '@/components/agenda/LeadLembreteDialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function FloatingLeadLembretesPopup({ isOpen, onClose }: Props) {
  const navigate = useNavigate();
  const { lembretes, completeLembrete } = useLeadLembretes();
  const [editing, setEditing] = useState<LeadLembrete | null>(null);

  const visiveis = useMemo(() => {
    return lembretes
      .filter((l) => l.status !== 'concluido' && l.status !== 'cancelado')
      .sort((a, b) => {
        const aA = isLembreteAtrasado(a);
        const bA = isLembreteAtrasado(b);
        if (aA !== bA) return aA ? -1 : 1;
        return new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime();
      });
  }, [lembretes]);

  if (!isOpen) return null;

  const goToLead = (l: LeadLembrete) => {
    navigate(`/agenda-comercial?tab=lembretes&editLembrete=${l.id}`);
    onClose();
  };

  return (
    <>
      <div
        className={`${floatingPopupPositionClass} w-96 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-lg shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200`}
      >
        <div className="flex items-center justify-between p-3 border-b border-border bg-amber-500/10">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-600" />
            <h3 className="font-semibold text-sm">Lembretes de Leads</h3>
            <Badge variant="secondary" className="text-[10px]">
              {visiveis.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                navigate('/agenda-comercial?tab=lembretes');
                onClose();
              }}
            >
              Ver todos
              <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="p-2 space-y-2">
            {visiveis.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum lembrete ativo 🎉
              </div>
            ) : (
              visiveis.map((l) => {
                const atrasado = isLembreteAtrasado(l);
                const dt = parseISO(l.data_hora);
                return (
                  <div
                    key={l.id}
                    className={cn(
                      'p-3 rounded-md border cursor-pointer transition-colors hover:bg-accent/50',
                      atrasado
                        ? 'border-destructive/50 bg-destructive/5'
                        : isToday(dt)
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border',
                    )}
                    onClick={() => goToLead(l)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          {atrasado && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0">
                              <AlertCircle className="h-2.5 w-2.5 mr-0.5" /> Atrasado
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(dt, "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="font-medium text-sm truncate">{l.titulo}</p>
                        {l.lead && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                            <Phone className="h-3 w-3" />
                            <span className="truncate">{l.lead.nome}</span>
                            {l.lead.telefone && <span>· {l.lead.telefone}</span>}
                          </div>
                        )}
                        {l.descricao && (
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                            {l.descricao}
                          </p>
                        )}
                      </div>
                      <div
                        className="flex flex-col gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                          onClick={() => setEditing(l)}
                          title="Editar"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {editing && (
        <LeadLembreteDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          leadId={editing.lead_id}
          leadName={editing.lead?.nome || 'Lead'}
          lembrete={editing}
        />
      )}
    </>
  );
}
