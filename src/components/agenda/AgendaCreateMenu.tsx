import { useState } from 'react';
import { Bell, Calendar, ChevronDown, ListTodo, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { floatingNestedOverlayClass } from '@/lib/overlay-z-index';
import { CreateReuniaoDialog } from './CreateReuniaoDialog';
import { CreateTarefaPessoalDialog } from './CreateTarefaPessoalDialog';
import { SelectLeadDialog } from './SelectLeadDialog';
import { LeadLembreteDialog } from './LeadLembreteDialog';
import { useAgenda } from '@/hooks/useAgenda';

export type AgendaCreateType = 'tarefa' | 'lembrete' | 'reuniao';
export type AgendaCreateMenuVariant = 'default' | 'fab';

interface AgendaCreateMenuProps {
  initialDate?: Date;
  /** Esconde o dropdown e mostra só o botão do tipo. */
  singleType?: AgendaCreateType;
  className?: string;
  /** `fab` = botão circular flutuante com menu de criação. */
  variant?: AgendaCreateMenuVariant;
}

export function AgendaCreateMenu({
  initialDate,
  singleType,
  className,
  variant = 'default',
}: AgendaCreateMenuProps) {
  const { createReuniao } = useAgenda();

  const [showReuniao, setShowReuniao] = useState(false);
  const [showTarefa, setShowTarefa] = useState(false);
  const [showSelectLead, setShowSelectLead] = useState(false);
  const [showLembrete, setShowLembrete] = useState(false);
  const [selectedLead, setSelectedLead] = useState<{ id: number; nome: string } | null>(null);

  const openType = (type: AgendaCreateType) => {
    if (type === 'reuniao') setShowReuniao(true);
    if (type === 'tarefa') setShowTarefa(true);
    if (type === 'lembrete') setShowSelectLead(true);
  };

  const handleCreateReuniao = async (data: {
    titulo: string;
    data_hora_inicio: string;
    duracao_minutos: number;
    convidado_nome?: string;
    convidado_whatsapp?: string;
    link_video_conferencia?: string;
    observacoes?: string;
  }) => {
    const dataInicio = new Date(data.data_hora_inicio);
    const dataFim = new Date(dataInicio.getTime() + data.duracao_minutos * 60 * 1000);

    await createReuniao.mutateAsync({
      ...data,
      data_hora_fim: dataFim.toISOString(),
      tipo: 'interno',
      status: 'pendente',
    });
  };

  const handleLeadSelected = (lead: { id: number; nome: string }) => {
    setSelectedLead(lead);
    setShowLembrete(true);
  };

  const isFloatingFab = variant === 'fab';

  const dialogs = (
    <>
      <CreateReuniaoDialog
        open={showReuniao}
        onOpenChange={setShowReuniao}
        onSubmit={handleCreateReuniao}
        initialDate={initialDate}
        floatingLayer={isFloatingFab}
      />

      <CreateTarefaPessoalDialog
        open={showTarefa}
        onOpenChange={setShowTarefa}
        initialDate={initialDate}
        floatingLayer={isFloatingFab}
      />

      <SelectLeadDialog
        open={showSelectLead}
        onOpenChange={setShowSelectLead}
        onSelect={handleLeadSelected}
        title="Novo lembrete de lead"
        description="Escolha o lead para o qual deseja criar o lembrete."
        floatingLayer={isFloatingFab}
      />

      {selectedLead && (
        <LeadLembreteDialog
          open={showLembrete}
          onOpenChange={(open) => {
            setShowLembrete(open);
            if (!open) setSelectedLead(null);
          }}
          leadId={selectedLead.id}
          leadName={selectedLead.nome}
          initialDate={initialDate}
          floatingLayer={isFloatingFab}
        />
      )}
    </>
  );

  if (singleType) {
    const labels: Record<AgendaCreateType, { label: string; icon: typeof Plus }> = {
      tarefa: { label: 'Nova Tarefa', icon: ListTodo },
      lembrete: { label: 'Novo Lembrete', icon: Bell },
      reuniao: { label: 'Nova Reunião', icon: Calendar },
    };
    const { label, icon: Icon } = labels[singleType];

    return (
      <>
        <Button onClick={() => openType(singleType)} className={className}>
          <Icon className="h-4 w-4 mr-2" />
          {label}
        </Button>
        {dialogs}
      </>
    );
  }

  return (
    <>
      <DropdownMenu modal={!isFloatingFab}>
        <DropdownMenuTrigger asChild>
          {isFloatingFab ? (
            <Button
              type="button"
              size="icon"
              className={cn(
                'h-11 w-11 rounded-full shadow-lg shadow-primary/25 ring-2 ring-background',
                className,
              )}
              aria-label="Criar na agenda"
            >
              <Plus className="h-5 w-5" />
            </Button>
          ) : (
            <Button type="button" className={className}>
              <Plus className="h-4 w-4 mr-2" />
              Criar
              <ChevronDown className="h-4 w-4 ml-1 opacity-70" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className={cn('w-52', isFloatingFab && floatingNestedOverlayClass)}
        >
          <DropdownMenuItem onClick={() => openType('tarefa')}>
            <ListTodo className="h-4 w-4 mr-2" />
            Tarefa pessoal
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openType('lembrete')}>
            <Bell className="h-4 w-4 mr-2" />
            Lembrete de lead
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openType('reuniao')}>
            <Calendar className="h-4 w-4 mr-2" />
            Reunião
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialogs}
    </>
  );
}
