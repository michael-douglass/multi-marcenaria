import { useEffect, useMemo, useState } from 'react';
import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bell,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  Phone,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LeadLembrete, isLembreteAtrasado, useLeadLembretes } from '@/hooks/useLeadLembretes';
import { LeadLembreteDialog } from './LeadLembreteDialog';
import { cn } from '@/lib/utils';

export function LeadLembretesTab() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { lembretes, isLoading, completeLembrete, deleteLembrete } = useLeadLembretes();
  const [editing, setEditing] = useState<LeadLembrete | null>(null);
  const editLembreteId = searchParams.get('editLembrete');

  const groups = useMemo(() => {
    const atrasados: LeadLembrete[] = [];
    const hoje: LeadLembrete[] = [];
    const proximos: LeadLembrete[] = [];
    const concluidos: LeadLembrete[] = [];
    for (const l of lembretes) {
      if (l.status === 'concluido') {
        concluidos.push(l);
        continue;
      }
      if (isLembreteAtrasado(l)) atrasados.push(l);
      else if (isToday(parseISO(l.data_hora))) hoje.push(l);
      else proximos.push(l);
    }
    return { atrasados, hoje, proximos, concluidos };
  }, [lembretes]);

  useEffect(() => {
    if (!editLembreteId || lembretes.length === 0) return;

    const lembreteToEdit = lembretes.find((l) => l.id === editLembreteId);
    if (!lembreteToEdit) return;

    setEditing(lembreteToEdit);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('editLembrete');
    setSearchParams(nextParams, { replace: true });
  }, [editLembreteId, lembretes, searchParams, setSearchParams]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  const renderItem = (l: LeadLembrete, variant: 'atrasado' | 'hoje' | 'proximo' | 'concluido') => {
    const dt = parseISO(l.data_hora);
    return (
      <Card
        key={l.id}
        className={cn(
          'transition-shadow hover:shadow-md cursor-pointer border-l-4',
          variant === 'atrasado' && 'border-l-destructive bg-destructive/5',
          variant === 'hoje' && 'border-l-primary',
          variant === 'proximo' && 'border-l-muted-foreground/30',
          variant === 'concluido' && 'border-l-emerald-500 opacity-70',
        )}
        onClick={() => setEditing(l)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {variant === 'atrasado' && (
                  <Badge variant="destructive" className="text-[10px]">
                    <AlertCircle className="h-3 w-3 mr-1" /> Atrasado
                  </Badge>
                )}
                {variant === 'hoje' && (
                  <Badge className="text-[10px] bg-primary">Hoje</Badge>
                )}
                {variant === 'concluido' && (
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                    Concluído
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(dt, "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
              <h4 className="font-semibold text-sm truncate">{l.titulo}</h4>
              {l.lead && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <Phone className="h-3 w-3" />
                  <span className="truncate">{l.lead.nome}</span>
                  {l.lead.telefone && <span>· {l.lead.telefone}</span>}
                </div>
              )}
              {l.descricao && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{l.descricao}</p>
              )}
              {(() => {
                const titulares =
                  l.titulares && l.titulares.length > 0
                    ? l.titulares
                    : l.titular
                      ? [l.titular]
                      : [];
                if (titulares.length === 0) return null;
                return (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <div className="flex -space-x-1.5">
                      {titulares.slice(0, 4).map((t) => (
                        <Avatar key={t.id} className="h-5 w-5 border border-background">
                          <AvatarImage src={t.avatar_url || undefined} />
                          <AvatarFallback className="text-[9px]">
                            {t.nome?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {titulares.map((t) => t.nome).join(', ')}
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
              {l.lead_id && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => navigate(`/pipeline?id=${l.lead_id}`)}
                  title="Abrir lead"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              {variant !== 'concluido' && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                  onClick={() => completeLembrete.mutate(l.id)}
                  title="Concluir"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setEditing(l)}
                title="Editar"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                onClick={() => deleteLembrete.mutate(l.id)}
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const Section = ({
    title,
    items,
    variant,
    emptyText,
  }: {
    title: string;
    items: LeadLembrete[];
    variant: 'atrasado' | 'hoje' | 'proximo' | 'concluido';
    emptyText?: string;
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            {variant === 'atrasado' && <AlertCircle className="h-4 w-4 text-destructive" />}
            {variant === 'hoje' && <Bell className="h-4 w-4 text-primary" />}
            {title}
          </span>
          <Badge variant="secondary">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">{emptyText || 'Nenhum lembrete.'}</p>
        ) : (
          items.map((l) => renderItem(l, variant))
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Section
          title="Atrasados"
          items={groups.atrasados}
          variant="atrasado"
          emptyText="Nenhum lembrete atrasado 🎉"
        />
        <Section
          title="Hoje"
          items={groups.hoje}
          variant="hoje"
          emptyText="Nada para hoje."
        />
      </div>
      <Section
        title="Próximos"
        items={groups.proximos}
        variant="proximo"
        emptyText="Nenhum lembrete futuro agendado."
      />
      {groups.concluidos.length > 0 && (
        <Section
          title="Concluídos recentes"
          items={groups.concluidos.slice(0, 10)}
          variant="concluido"
        />
      )}

      {editing && (
        <LeadLembreteDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          leadId={editing.lead_id}
          leadName={editing.lead?.nome || 'Lead'}
          lembrete={editing}
        />
      )}
    </div>
  );
}
