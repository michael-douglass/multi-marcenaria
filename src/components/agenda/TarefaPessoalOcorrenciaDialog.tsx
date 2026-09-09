import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  CalendarX2,
  CheckCircle2,
  Clock,
  Pencil,
  Repeat,
  Trash2,
  User,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TimeInput24h } from '@/components/ui/time-input-24h';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { useAgendaPessoal, type TarefaPessoal } from '@/hooks/useAgendaPessoal';
import { formatRecorrenciaResumo } from '@/lib/agenda-pessoal-recorrencia';
import { AgendaItemAnexosField } from '@/components/agenda/AgendaItemAnexosField';
import { useAgendaItemAnexosDraft } from '@/hooks/useAgendaItemAnexosDraft';
import { AgendaColorPicker } from '@/components/agenda/AgendaColorPicker';

const DIAS_SEMANA_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export type PessoalAgendaEventData = TarefaPessoal & { dataOcorrencia: Date };

interface TarefaPessoalOcorrenciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventData: PessoalAgendaEventData | null;
  /** Mantém o diálogo acima do painel da agenda flutuante. */
  floatingLayer?: boolean;
}

export function TarefaPessoalOcorrenciaDialog({
  open,
  onOpenChange,
  eventData,
  floatingLayer = false,
}: TarefaPessoalOcorrenciaDialogProps) {
  const { concluirOcorrencia, updateTarefa, reagendarOcorrencia, deleteTarefa, excluirOcorrencia } =
    useAgendaPessoal();
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [hora, setHora] = useState('');
  const [data, setData] = useState<Date | undefined>();
  const [tipoAgendamento, setTipoAgendamento] = useState<'unica' | 'recorrente'>('unica');
  const [recorrenciaTipo, setRecorrenciaTipo] = useState<'todo_dia' | 'dias_semana' | 'mensal'>('todo_dia');
  const [recorrenciaDias, setRecorrenciaDias] = useState<number[]>([]);
  const [dataFimRecorrencia, setDataFimRecorrencia] = useState('');
  const [cor, setCor] = useState<string | null>(null);
  const anexosDraft = useAgendaItemAnexosDraft({
    accept: 'images-and-pdfs',
    scope: 'tarefas-pessoais',
    open,
  });
  const resetAnexos = anexosDraft.reset;

  useEffect(() => {
    if (!open || !eventData) return;
    setEditing(false);
    setShowDeleteConfirm(false);
    setTitulo(eventData.titulo);
    setDescricao(eventData.descricao || '');
    setHora(eventData.hora || '');
    setData(eventData.dataOcorrencia);
    setTipoAgendamento((eventData.tipo_agendamento as 'unica' | 'recorrente') || 'unica');
    setRecorrenciaTipo((eventData.recorrencia_tipo as 'todo_dia' | 'dias_semana' | 'mensal') || 'todo_dia');
    setRecorrenciaDias((eventData.recorrencia_dias_semana as number[]) || []);
    setDataFimRecorrencia(eventData.data_fim_recorrencia || '');
    setCor(eventData.cor ?? null);
    resetAnexos(eventData.anexos);
  }, [open, eventData, resetAnexos]);

  const recorrenciaInvalida =
    tipoAgendamento === 'recorrente' &&
    recorrenciaTipo === 'dias_semana' &&
    recorrenciaDias.length === 0;

  const toggleDiaSemana = (dia: number) => {
    setRecorrenciaDias((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia].sort(),
    );
  };

  if (!eventData) return null;

  const { dataOcorrencia } = eventData;
  const concluida =
    eventData.tipo_agendamento === 'unica'
      ? eventData.concluida
      : ((eventData.conclusoes_ocorrencias as string[] | null) || []).includes(
          format(dataOcorrencia, 'yyyy-MM-dd'),
        );

  const dateStr = format(dataOcorrencia, 'yyyy-MM-dd');

  const handleToggleConcluida = () => {
    concluirOcorrencia.mutate(
      {
        tarefa: eventData,
        dataOcorrencia: dateStr,
        concluida: !concluida,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const handleSaveEdit = async () => {
    if (!titulo.trim() || !data || recorrenciaInvalida) return;
    const newDateStr = format(data, 'yyyy-MM-dd');
    const anexos = await anexosDraft.flush(eventData.id);
    const updates = {
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      hora: hora.trim() || null,
      cor,
      anexos,
    };

    const recurrenceUpdates =
      tipoAgendamento === 'recorrente'
        ? {
            tipo_agendamento: 'recorrente' as const,
            recorrencia_tipo: recorrenciaTipo,
            recorrencia_dias_semana:
              recorrenciaTipo === 'dias_semana' ? recorrenciaDias : null,
            data_fim_recorrencia: dataFimRecorrencia || null,
            concluida: false,
          }
        : {
            tipo_agendamento: 'unica' as const,
            recorrencia_tipo: null,
            recorrencia_dias_semana: null,
            data_fim_recorrencia: null,
            exclusoes_ocorrencias: null,
            conclusoes_ocorrencias: null,
            concluida,
          };

    const estavaRecorrente = eventData.tipo_agendamento === 'recorrente';
    const permaneceRecorrente = tipoAgendamento === 'recorrente';
    const dataMudou = newDateStr !== dateStr;
    const convertendoParaUnica = estavaRecorrente && !permaneceRecorrente;
    const convertendoParaRecorrente = !estavaRecorrente && permaneceRecorrente;

    if (convertendoParaUnica) {
      await updateTarefa.mutateAsync({
        id: eventData.id,
        ...updates,
        ...recurrenceUpdates,
        data: newDateStr,
      });
    } else if (convertendoParaRecorrente) {
      await updateTarefa.mutateAsync({
        id: eventData.id,
        ...updates,
        ...recurrenceUpdates,
        data: newDateStr,
      });
    } else if (dataMudou && permaneceRecorrente) {
      await reagendarOcorrencia.mutateAsync({
        tarefa: eventData,
        dataOcorrenciaAntiga: dateStr,
        novaData: newDateStr,
        updates,
      });
      await updateTarefa.mutateAsync({
        id: eventData.id,
        ...recurrenceUpdates,
        anexos,
      });
    } else if (dataMudou && !permaneceRecorrente) {
      await reagendarOcorrencia.mutateAsync({
        tarefa: eventData,
        dataOcorrenciaAntiga: dateStr,
        novaData: newDateStr,
        updates,
      });
      await updateTarefa.mutateAsync({
        id: eventData.id,
        anexos,
      });
    } else {
      await updateTarefa.mutateAsync({
        id: eventData.id,
        ...updates,
        ...recurrenceUpdates,
      });
    }
    setEditing(false);
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (eventData.tipo_agendamento === 'recorrente') {
      setShowDeleteConfirm(true);
      return;
    }
    deleteTarefa.mutate(eventData.id, { onSuccess: () => onOpenChange(false) });
  };

  const handleDeleteSoEste = () => {
    excluirOcorrencia.mutate(
      { tarefa: eventData, dataOcorrencia: dateStr },
      {
        onSuccess: () => {
          setShowDeleteConfirm(false);
          onOpenChange(false);
        },
      },
    );
  };

  const handleDeleteTodas = () => {
    deleteTarefa.mutate(eventData.id, {
      onSuccess: () => {
        setShowDeleteConfirm(false);
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" floatingLayer={floatingLayer}>
        <DialogHeader>
          <DialogTitle className="pr-8 flex items-center gap-2 flex-wrap">
            {editing ? 'Editar tarefa pessoal' : eventData.titulo}
            {concluida && (
              <Badge variant="secondary" className="text-green-700 bg-green-100">
                Concluída
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Agenda pessoal · {format(dataOcorrencia, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div className="space-y-2">
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
                    {data ? format(data, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={data}
                    onSelect={setData}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
              {eventData.tipo_agendamento === 'recorrente' && tipoAgendamento === 'recorrente' && (
                <p className="text-xs text-muted-foreground">
                  Ao mudar a data, apenas esta ocorrência será movida para o novo dia.
                </p>
              )}
              {tipoAgendamento === 'recorrente' && eventData.tipo_agendamento === 'unica' && (
                <p className="text-xs text-muted-foreground">
                  A data selecionada será o início da recorrência.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Hora</Label>
              <TimeInput24h value={hora} onChange={setHora} optional />
            </div>

            <AgendaColorPicker value={cor} onChange={setCor} eventType="pessoal" />
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
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
                    <span className="flex items-center gap-2">
                      <Repeat className="h-3.5 w-3.5" />
                      Recorrente
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <AgendaItemAnexosField
              draft={anexosDraft}
              accept="images-and-pdfs"
              floatingLayer={floatingLayer}
              title="Fotos e PDFs"
              hint="O PDF vira fotos, página por página. Ficam só nesta tarefa."
            />

            {tipoAgendamento === 'recorrente' && (
              <div className="space-y-4 border rounded-lg p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  {eventData.tipo_agendamento === 'recorrente'
                    ? 'As alterações de recorrência valem para todas as ocorrências da série.'
                    : 'A tarefa passará a se repetir conforme a configuração abaixo.'}
                </p>
                <div className="space-y-2">
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
                  <div className="space-y-2">
                    <Label>Dias</Label>
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
                    {recorrenciaInvalida && (
                      <p className="text-xs text-destructive">Selecione ao menos um dia da semana.</p>
                    )}
                  </div>
                )}
                {recorrenciaTipo === 'mensal' && (
                  <p className="text-xs text-muted-foreground">
                    {data
                      ? `Será lembrada todo dia ${format(data, 'd')} de cada mês.`
                      : 'O dia da data selecionada será usado na repetição mensal.'}
                  </p>
                )}
                <div className="space-y-2">
                  <Label>Data de término (opcional)</Label>
                  <Input
                    type="date"
                    value={dataFimRecorrencia}
                    onChange={(e) => setDataFimRecorrencia(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {eventData.descricao && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                {eventData.descricao}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {eventData.hora && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {eventData.hora}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4" />
                {format(dataOcorrencia, 'dd/MM/yyyy', { locale: ptBR })}
              </span>
              {eventData.tipo_agendamento === 'recorrente' ? (
                <Badge variant="outline">
                  <Repeat className="h-3 w-3 mr-1" />
                  {formatRecorrenciaResumo(eventData)}
                </Badge>
              ) : (
                <Badge variant="outline">Única</Badge>
              )}
              {eventData.data_fim_recorrencia && (
                <span className="text-xs">
                  até{' '}
                  {format(
                    new Date(`${eventData.data_fim_recorrencia}T00:00:00`),
                    'dd/MM/yyyy',
                    { locale: ptBR },
                  )}
                </span>
              )}
              {eventData.titular_nome && (
                <Badge variant="secondary">
                  <User className="h-3 w-3 mr-1" />
                  {eventData.titular_nome}
                </Badge>
              )}
            </div>
            <AgendaItemAnexosField
              draft={anexosDraft}
              accept="images-and-pdfs"
              readOnly
              floatingLayer={floatingLayer}
              title="Fotos e PDFs"
              hint="Anexos só desta tarefa — toque para ampliar."
            />
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Voltar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={
                  !titulo.trim() ||
                  !data ||
                  recorrenciaInvalida ||
                  updateTarefa.isPending ||
                  reagendarOcorrencia.isPending ||
                  anexosDraft.converting ||
                  anexosDraft.busy
                }
              >
                {updateTarefa.isPending || reagendarOcorrencia.isPending
                  ? 'Salvando…'
                  : 'Salvar'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Editar
              </Button>
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={deleteTarefa.isPending || excluirOcorrencia.isPending}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Excluir
              </Button>
              <Button
                onClick={handleToggleConcluida}
                disabled={concluirOcorrencia.isPending}
                className={
                  concluida
                    ? undefined
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }
                variant={concluida ? 'secondary' : 'default'}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                {concluida ? 'Reabrir tarefa' : 'Marcar como concluída'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent floatingLayer={floatingLayer}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa recorrente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta é uma tarefa recorrente. Deseja excluir apenas esta ocorrência ou todas as
              ocorrências?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSoEste}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <CalendarX2 className="h-4 w-4 mr-2" />
              Só este dia
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleDeleteTodas}
              className="bg-destructive hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Todas as ocorrências
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
