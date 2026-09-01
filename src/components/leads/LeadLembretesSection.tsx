import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bell,
  CheckCircle2,
  Edit2,
  Plus,
  AlertCircle,
  Clock,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  LeadLembrete,
  isLembreteAtrasado,
  useLeadLembretes,
} from '@/hooks/useLeadLembretes';
import { LeadLembreteDialog } from '@/components/agenda/LeadLembreteDialog';
import { LeadModalSection } from '@/components/leads/LeadModalSection';

interface LeadLembretesSectionProps {
  leadId: number;
  leadName: string;
}

/** Lista de lembretes em aberto dentro do modal do lead. */
export function LeadLembretesSection({ leadId, leadName }: LeadLembretesSectionProps) {
  const { lembretes, isLoading, completeLembrete, deleteLembrete } = useLeadLembretes(leadId);
  const [editing, setEditing] = useState<LeadLembrete | null>(null);
  const [creating, setCreating] = useState(false);

  const ativos = lembretes.filter(
    (l) => l.status !== 'concluido' && l.status !== 'cancelado',
  );

  return (
    <>
      <LeadModalSection
        variant="alert"
        title="Lembretes em aberto"
        icon={Bell}
        badge={
          !isLoading ? (
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/15 text-[10px] text-amber-800 dark:text-amber-100"
            >
              {ativos.length}
            </Badge>
          ) : undefined
        }
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs border-amber-500/40 text-amber-800 hover:bg-amber-500/10 dark:text-amber-100"
            onClick={() => setCreating(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Novo
          </Button>
        }
        className="[&>div:last-child]:py-3 [&>header]:py-2.5"
      >
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-lg bg-mahogany-muted/40" />
            <Skeleton className="h-14 w-full rounded-lg bg-mahogany-muted/40" />
          </div>
        ) : ativos.length === 0 ? (
          <p className="text-xs text-cream-muted py-1 text-center">
            Nenhum lembrete em aberto para este lead.
          </p>
        ) : (
          <ul className="space-y-2">
            {ativos.map((l) => {
              const atrasado = isLembreteAtrasado(l);
              const dt = parseISO(l.data_hora);
              return (
                <li
                  key={l.id}
                  className={cn(
                    'flex items-start justify-between gap-2 rounded-lg border p-2.5 transition-colors',
                    atrasado
                      ? 'border-destructive/45 bg-destructive/5'
                      : 'border-gold-border-subtle/20 bg-mahogany-muted/20 hover:border-gold-border-subtle/35',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex flex-wrap items-center gap-1">
                      {atrasado && (
                        <Badge variant="destructive" className="px-1 py-0 text-[9px]">
                          <AlertCircle className="mr-0.5 h-2.5 w-2.5" />
                          Atrasado
                        </Badge>
                      )}
                      <span className="flex items-center gap-1 text-[10px] text-cream-muted">
                        <Clock className="h-3 w-3 shrink-0" />
                        {format(dt, "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="truncate text-sm font-medium text-foreground">{l.titulo}</p>
                    {l.descricao && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-cream-muted">
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
                            className="h-7 w-7 rounded-[2px] object-cover ring-1 ring-[#f2d892]/40"
                          />
                        ))}
                        {l.anexos.length > 3 && (
                          <span className="text-[10px] text-[#f2d892]">+{l.anexos.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-emerald-600 hover:bg-emerald-500/10"
                      onClick={() => completeLembrete.mutate(l.id)}
                      title="Concluir"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 hover:text-gold"
                      onClick={() => setEditing(l)}
                      title="Editar"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => deleteLembrete.mutate(l.id)}
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </LeadModalSection>

      {creating && (
        <LeadLembreteDialog
          open={creating}
          onOpenChange={(o) => !o && setCreating(false)}
          leadId={leadId}
          leadName={leadName}
          nested
        />
      )}

      {editing && (
        <LeadLembreteDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          leadId={editing.lead_id}
          leadName={editing.lead?.nome || leadName}
          lembrete={editing}
          nested
        />
      )}
    </>
  );
}
