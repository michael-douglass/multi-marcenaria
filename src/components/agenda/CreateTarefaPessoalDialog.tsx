import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Repeat, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TimeInput24h } from '@/components/ui/time-input-24h';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getCurrentHora24h } from '@/lib/horarios-24h';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useUsers } from '@/hooks/useUsers';
import { useAgendaPessoal } from '@/hooks/useAgendaPessoal';
import { AgendaItemAnexosField } from '@/components/agenda/AgendaItemAnexosField';
import { useAgendaItemAnexosDraft } from '@/hooks/useAgendaItemAnexosDraft';
import { AgendaColorPicker } from '@/components/agenda/AgendaColorPicker';
import { getEventosDb, resolveEventosTables } from '@/lib/evento-db';

const DIAS_SEMANA_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const COR_EVENTO_PADRAO = '#f59e0b';

export interface CreateTarefaEventoVinculo {
  eventoId: string;
  tituloEvento: string;
}

interface CreateTarefaPessoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date;
  /** Horário inicial em 24h (ex.: "10:30") — usado ao clicar em faixa do calendário. */
  initialHora?: string;
  /** Acima do painel flutuante da agenda (z-95). */
  floatingLayer?: boolean;
  /** Se vier do Controle de Eventos: cria também no checklist da pasta. */
  eventoVinculo?: CreateTarefaEventoVinculo | null;
}

export function CreateTarefaPessoalDialog({
  open,
  onOpenChange,
  initialDate,
  initialHora,
  floatingLayer,
  eventoVinculo,
}: CreateTarefaPessoalDialogProps) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const { users } = useUsers();
  const { createTarefa, isAdminAgendaPessoal, canAssignTarefaToOthers } = useAgendaPessoal();
  const schema = empresa?.schema_nome ?? null;
  const tables = resolveEventosTables(schema);
  const eventoDb = getEventosDb(schema);

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [hora, setHora] = useState('');
  const [titularId, setTitularId] = useState('');
  const [tipoAgendamento, setTipoAgendamento] = useState<'unica' | 'recorrente'>('unica');
  const [recorrenciaTipo, setRecorrenciaTipo] = useState<'todo_dia' | 'dias_semana' | 'mensal'>('todo_dia');
  const [recorrenciaDias, setRecorrenciaDias] = useState<number[]>([]);
  const [dataFimRecorrencia, setDataFimRecorrencia] = useState('');
  const [data, setData] = useState<Date | undefined>(undefined);
  const [ocultarDeOutrosAdmins, setOcultarDeOutrosAdmins] = useState(false);
  const [cor, setCor] = useState<string | null>(null);
  const anexosDraft = useAgendaItemAnexosDraft({
    accept: 'images-and-pdfs',
    scope: 'tarefas-pessoais',
    open,
  });

  useEffect(() => {
    if (!open) return;
    setTitulo('');
    setDescricao(
      eventoVinculo?.tituloEvento
        ? `Controle de Eventos · ${eventoVinculo.tituloEvento}`
        : '',
    );
    // Clique na faixa do calendário → horário clicado; botão Criar → horário atual
    setHora(initialHora ?? getCurrentHora24h());
    setTitularId(user?.id || '');
    setTipoAgendamento('unica');
    setRecorrenciaTipo('todo_dia');
    setRecorrenciaDias([]);
    setDataFimRecorrencia('');
    // Dia do evento (ou dia visível na agenda); se não houver, usa hoje
    setData(initialDate || new Date());
    setOcultarDeOutrosAdmins(false);
    setCor(eventoVinculo ? COR_EVENTO_PADRAO : null);
  }, [open, initialDate, initialHora, user?.id, eventoVinculo]);

  const toggleDiaSemana = (dia: number) => {
    setRecorrenciaDias((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia].sort(),
    );
  };

  const handleSubmit = async () => {
    if (!titulo.trim() || !titularId) return;

    const selectedUser = users?.find((u) => u.id === titularId);
    const dataStr = data ? format(data, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    const nome = titulo.trim();
    let eventoTarefaId: string | null = null;
    let agendaAttempted = false;

    try {
      const entityId = crypto.randomUUID();
      const anexos = await anexosDraft.flush(entityId);

      if (eventoVinculo?.eventoId) {
        const { data: maxOrdemRows } = await eventoDb
          .from(tables.tarefas)
          .select('ordem')
          .eq('evento_id', eventoVinculo.eventoId)
          .order('ordem', { ascending: false })
          .limit(1);
        const ordem =
          Array.isArray(maxOrdemRows) &&
          maxOrdemRows[0] &&
          typeof (maxOrdemRows[0] as { ordem?: unknown }).ordem === 'number'
            ? ((maxOrdemRows[0] as { ordem: number }).ordem + 1)
            : 0;

        eventoTarefaId = crypto.randomUUID();
        const { error: eventoError } = await eventoDb.from(tables.tarefas).insert({
          id: eventoTarefaId,
          evento_id: eventoVinculo.eventoId,
          titulo: nome,
          concluida: false,
          ordem,
          agenda_tarefa_id: entityId,
        });
        if (eventoError) throw eventoError;
      }

      agendaAttempted = true;
      await createTarefa.mutateAsync({
        id: entityId,
        titulo: nome,
        descricao: descricao.trim() || undefined,
        data: dataStr,
        hora: hora || undefined,
        titular_id: canAssignTarefaToOthers ? titularId : user?.id || titularId,
        titular_nome: selectedUser?.nome,
        tipo_agendamento: tipoAgendamento,
        recorrencia_tipo: tipoAgendamento === 'recorrente' ? recorrenciaTipo : undefined,
        recorrencia_dias_semana:
          tipoAgendamento === 'recorrente' && recorrenciaTipo === 'dias_semana'
            ? recorrenciaDias
            : undefined,
        data_fim_recorrencia:
          tipoAgendamento === 'recorrente' && dataFimRecorrencia ? dataFimRecorrencia : undefined,
        ocultar_de_outros_admins: isAdminAgendaPessoal ? ocultarDeOutrosAdmins : undefined,
        cor: cor ?? (eventoVinculo ? COR_EVENTO_PADRAO : null),
        anexos,
        evento_id: eventoVinculo?.eventoId ?? null,
        evento_tarefa_id: eventoTarefaId,
      });

      onOpenChange(false);
    } catch (error) {
      if (eventoTarefaId) {
        await eventoDb.from(tables.tarefas).delete().eq('id', eventoTarefaId);
      }
      // createTarefa já mostra toast no próprio onError
      if (!agendaAttempted) {
        const message = error instanceof Error ? error.message : 'Não deu para criar a tarefa';
        toast.error('Não deu para criar a tarefa', { description: message });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        nested={!floatingLayer}
        data-agenda-create-dialog=""
        className="max-w-md max-h-[90vh] overflow-y-auto"
        floatingLayer={floatingLayer}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className={eventoVinculo ? 'text-[#f0d28c]' : undefined}>
            {eventoVinculo ? 'Nova tarefa do evento' : 'Nova Tarefa Pessoal'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {eventoVinculo && (
            <p className="rounded-lg border border-[rgba(240,210,140,0.35)] bg-[rgba(240,210,140,0.08)] px-3 py-2 text-xs leading-relaxed text-[#d4c4a8]">
              Vai para a Agenda com dia e horário, e também entra no checklist da pasta{' '}
              <span className="font-semibold text-[#f0d28c]">{eventoVinculo.tituloEvento}</span>.
            </p>
          )}

          <div>
            <Label>Título *</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Ligar para fornecedor"
            />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes da tarefa..."
              rows={3}
            />
          </div>

          <AgendaColorPicker value={cor} onChange={setCor} eventType="pessoal" />

          <div>
            <Label>Data *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !data && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {data ? format(data, 'dd/MM/yyyy') : <span>Selecione a data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={data}
                  onSelect={setData}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Horário</Label>
            <TimeInput24h value={hora} onChange={setHora} optional />
          </div>

          <div>
            <Label>Titular *</Label>
            {canAssignTarefaToOthers ? (
              <Select value={titularId} onValueChange={setTitularId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o titular" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {u.nome}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                {users?.find((u) => u.id === titularId)?.nome || 'Você'}
              </div>
            )}
          </div>

          <div>
            <Label>Tipo</Label>
            <Select
              value={tipoAgendamento}
              onValueChange={(v) => setTipoAgendamento(v as 'unica' | 'recorrente')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unica">Única</SelectItem>
                <SelectItem value="recorrente">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-3.5 w-3.5" />
                    Recorrente
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isAdminAgendaPessoal && (
            <div
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 bg-muted/20',
                floatingLayer && 'relative z-10',
              )}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Checkbox
                id="ocultar-de-outros-admins-create"
                checked={ocultarDeOutrosAdmins}
                onCheckedChange={(checked) => setOcultarDeOutrosAdmins(checked === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="ocultar-de-outros-admins-create" className="cursor-pointer font-medium">
                  Ocultar tarefa dos demais usuários admin
                </Label>
                <p className="text-xs text-muted-foreground">
                  Somente você verá esta tarefa na agenda geral.
                </p>
              </div>
            </div>
          )}

          {tipoAgendamento === 'recorrente' && (
            <div
              className={cn(
                'space-y-4 border rounded-lg p-3 bg-muted/30',
                floatingLayer && 'relative z-10',
              )}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div>
                <Label>Repetição</Label>
                <Select
                  value={recorrenciaTipo}
                  onValueChange={(v) =>
                    setRecorrenciaTipo(v as 'todo_dia' | 'dias_semana' | 'mensal')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo_dia">Todo dia</SelectItem>
                    <SelectItem value="dias_semana">Dias da semana</SelectItem>
                    <SelectItem value="mensal">Mensal (mesmo dia do mês)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recorrenciaTipo === 'dias_semana' && (
                <div>
                  <Label className="mb-2 block">Dias</Label>
                  <div className="flex gap-1 flex-wrap">
                    {DIAS_SEMANA_LABELS.map((label, idx) => (
                      <Button
                        key={idx}
                        type="button"
                        variant={recorrenciaDias.includes(idx) ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 w-10 text-xs"
                        onClick={() => toggleDiaSemana(idx)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {recorrenciaTipo === 'mensal' && (
                <p className="text-xs text-muted-foreground">
                  {data
                    ? `Será lembrada todo dia ${format(data, 'd')} de cada mês, no horário informado.`
                    : 'Escolha a data acima: o dia do mês será usado na repetição (ex.: dia 10).'}
                </p>
              )}

              <div>
                <Label>Data de término (opcional)</Label>
                <Input
                  type="date"
                  value={dataFimRecorrencia}
                  onChange={(e) => setDataFimRecorrencia(e.target.value)}
                />
              </div>
            </div>
          )}

          <AgendaItemAnexosField
            draft={anexosDraft}
            accept="images-and-pdfs"
            floatingLayer={floatingLayer}
            title="Fotos e PDFs"
            hint="O PDF vira fotos, página por página. Ficam só nesta tarefa."
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              !titulo.trim() ||
              !titularId ||
              createTarefa.isPending ||
              anexosDraft.converting ||
              anexosDraft.busy
            }
          >
            {createTarefa.isPending || anexosDraft.busy ? 'Criando...' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
