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
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/hooks/useUsers';
import { useAgendaPessoal } from '@/hooks/useAgendaPessoal';
import { AgendaItemAnexosField } from '@/components/agenda/AgendaItemAnexosField';
import { useAgendaItemAnexosDraft } from '@/hooks/useAgendaItemAnexosDraft';
import { AgendaColorPicker } from '@/components/agenda/AgendaColorPicker';

const DIAS_SEMANA_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface CreateTarefaPessoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date;
  /** Horário inicial em 24h (ex.: "10:30") — usado ao clicar em faixa do calendário. */
  initialHora?: string;
  /** Acima do painel flutuante da agenda (z-95). */
  floatingLayer?: boolean;
}

export function CreateTarefaPessoalDialog({
  open,
  onOpenChange,
  initialDate,
  initialHora,
  floatingLayer,
}: CreateTarefaPessoalDialogProps) {
  const { user } = useAuth();
  const { users } = useUsers();
  const { createTarefa, isAdminAgendaPessoal, canAssignTarefaToOthers } = useAgendaPessoal();

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
    setDescricao('');
    // Clique na faixa do calendário → horário clicado; botão Criar → horário atual
    setHora(initialHora ?? getCurrentHora24h());
    setTitularId(user?.id || '');
    setTipoAgendamento('unica');
    setRecorrenciaTipo('todo_dia');
    setRecorrenciaDias([]);
    setDataFimRecorrencia('');
    // Dia visível na agenda (Hoje / setas); se não houver, usa hoje
    setData(initialDate || new Date());
    setOcultarDeOutrosAdmins(false);
    setCor(null);
  }, [open, initialDate, initialHora, user?.id]);

  const toggleDiaSemana = (dia: number) => {
    setRecorrenciaDias((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia].sort(),
    );
  };

  const handleSubmit = async () => {
    if (!titulo.trim() || !titularId) return;

    const selectedUser = users?.find((u) => u.id === titularId);
    const dataStr = data ? format(data, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

    try {
      const entityId = crypto.randomUUID();
      const anexos = await anexosDraft.flush(entityId);
      await createTarefa.mutateAsync({
        id: entityId,
        titulo: titulo.trim(),
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
        cor,
        anexos,
      });

      onOpenChange(false);
    } catch {
      // Erro já tratado no onError da mutation (toast).
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
          <DialogTitle>Nova Tarefa Pessoal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
