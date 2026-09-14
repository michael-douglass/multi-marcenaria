import { useState } from 'react';
import { format, isSameDay, isToday, parseISO, addDays, isAfter, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Trash2, Clock, Pencil, Search, CheckCircle2, User, Repeat, CalendarX2, CalendarIcon, AlertCircle, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TimeInput24h } from '@/components/ui/time-input-24h';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { AgendaCalendar } from './AgendaCalendar';
import { TarefaPessoalOcorrenciaDialog, type PessoalAgendaEventData } from './TarefaPessoalOcorrenciaDialog';
import { useAgendaPessoal, TarefaPessoal } from '@/hooks/useAgendaPessoal';
import { useUsers } from '@/hooks/useUsers';
import { useTitularesAgenda } from '@/hooks/useTitularesAgenda';
import { useAuth } from '@/contexts/AuthContext';
import {
  AgendaTitularCombobox,
  findTitularAgendaNome,
} from '@/components/agenda/AgendaTitularCombobox';
import { Skeleton } from '@/components/ui/skeleton';
import { getOcorrenciasNoDia, getOcorrenciasNoMes, getOcorrenciasNoIntervalo, getRecorrenciaTipoLabel, OcorrenciaTarefa } from '@/lib/agenda-pessoal-recorrencia';
import { AgendaItemAnexosBadge, AgendaItemAnexosField, AgendaItemAnexosMiniStrip } from '@/components/agenda/AgendaItemAnexosField';
import { useAgendaItemAnexosDraft } from '@/hooks/useAgendaItemAnexosDraft';

const DIAS_SEMANA_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Adapter: expand tarefas into calendar-compatible format for the current month
function tarefasToCalendarFormat(ocorrencias: OcorrenciaTarefa[]) {
  return ocorrencias.map((o, i) => ({
    id: `${o.tarefa.id}-${i}`,
    titulo: o.tarefa.titulo,
    data_hora_inicio: o.dataOcorrencia.toISOString(),
    status: o.concluida ? ('concluido' as const) : ('pendente' as const),
    descricao: o.tarefa.descricao,
    data_hora_fim: o.dataOcorrencia.toISOString(),
    duracao_minutos: 0,
    convidado_nome: null,
    convidado_whatsapp: null,
    convidado_email: null,
    resposta_formulario: null,
    tipo: 'interno' as const,
    link_video_conferencia: null,
    observacoes: null,
    responsavel_id: null,
    lead_id: null,
    criado_em: o.tarefa.criado_em,
    atualizado_em: o.tarefa.atualizado_em,
    confirmado_em: null,
    concluido_em: null,
    cancelado_em: null,
  }));
}

export function AgendaPessoalTab() {
  const {
    tarefas,
    loading,
    createTarefa,
    updateTarefa,
    deleteTarefa,
    concluirOcorrencia,
    excluirOcorrencia,
    isAdminAgendaPessoal,
    canAssignTarefaToOthers,
    adminTitularFilter,
    saveAdminTitularFilter,
  } = useAgendaPessoal();
  const { users } = useUsers();
  const { titulares } = useTitularesAgenda();
  const { user, userRole } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<TarefaPessoal | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const anexosDraft = useAgendaItemAnexosDraft({
    accept: 'images-and-pdfs',
    scope: 'tarefas-pessoais',
    open: showCreateDialog,
  });
  const resetAnexos = anexosDraft.reset;
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Delete confirmation for recurrent
  const [deleteConfirm, setDeleteConfirm] = useState<{ tarefa: TarefaPessoal; dataOcorrencia: Date } | null>(null);
  // Popup de visualização ao clicar no card
  const [ocorrenciaPopup, setOcorrenciaPopup] = useState<PessoalAgendaEventData | null>(null);

  // Form state
  const [formTitulo, setFormTitulo] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formHora, setFormHora] = useState('');
  const [formTitularId, setFormTitularId] = useState('');
  const [formTipoAgendamento, setFormTipoAgendamento] = useState<'unica' | 'recorrente'>('unica');
  const [formRecorrenciaTipo, setFormRecorrenciaTipo] = useState<'todo_dia' | 'dias_semana' | 'mensal'>('todo_dia');
  const [formRecorrenciaDias, setFormRecorrenciaDias] = useState<number[]>([]);
  const [formDataFimRecorrencia, setFormDataFimRecorrencia] = useState('');
  const [formData, setFormData] = useState<Date | undefined>(undefined);
  const [formOcultarDeOutrosAdmins, setFormOcultarDeOutrosAdmins] = useState(false);

  const isAdmin = userRole === 'admin';

  const handleTitularidadeModeChange = (mode: 'all' | 'self' | 'provider') => {
    if (mode === 'provider') {
      const currentId = adminTitularFilter?.filter_titular_id;
      const stillValid = !!(currentId && users?.some((u) => u.id === currentId));
      const pick = stillValid
        ? currentId!
        : users?.find((u) => u.id !== user?.id)?.id ?? users?.[0]?.id;
      if (!pick) {
        return;
      }
      saveAdminTitularFilter.mutate({
        filter_mode: 'provider',
        filter_titular_id: pick,
      });
      return;
    }
    saveAdminTitularFilter.mutate({
      filter_mode: mode,
      filter_titular_id: null,
    });
  };

  const handleTitularidadePrestadorChange = (prestadorId: string) => {
    saveAdminTitularFilter.mutate({
      filter_mode: 'provider',
      filter_titular_id: prestadorId,
    });
  };

  // Expand occurrences for the calendar month
  const ocorrenciasMes = getOcorrenciasNoMes(tarefas, calendarMonth);

  // Occurrences for selected day
  const ocorrenciasDoDia = selectedDate ? getOcorrenciasNoDia(tarefas, selectedDate) : [];

  // Apply search filter
  const filteredOcorrencias = searchQuery.trim()
    ? ocorrenciasDoDia.filter(
        (o) =>
          o.tarefa.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (o.tarefa.descricao && o.tarefa.descricao.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : ocorrenciasDoDia;

  // Pendentes do dia ordenados por horário (tarefas sem hora ficam no final)
  const pendentes = [...filteredOcorrencias.filter((o) => !o.concluida)].sort((a, b) => {
    const ha = a.tarefa.hora || '';
    const hb = b.tarefa.hora || '';
    if (!ha && !hb) return 0;
    if (!ha) return 1;
    if (!hb) return -1;
    return ha.localeCompare(hb);
  });
  const concluidas = filteredOcorrencias.filter((o) => o.concluida);

  // Stats
  const hojeTarefas = getOcorrenciasNoDia(tarefas, new Date());
  const totalPendentes = getOcorrenciasNoMes(tarefas, calendarMonth).filter((o) => !o.concluida).length;
  const totalConcluidas = getOcorrenciasNoMes(tarefas, calendarMonth).filter((o) => o.concluida).length;

  // "Tarefas Pendentes" - all pending from today forward (next 30 days)
  const pendentesGerais = tarefas
    .flatMap(t => getOcorrenciasNoIntervalo(t, new Date(), addDays(new Date(), 30)))
    .filter(o => !o.concluida)
    .sort((a, b) => a.dataOcorrencia.getTime() - b.dataOcorrencia.getTime());

  // Dialog helpers
  const openCreateDialog = () => {
    setFormTitulo('');
    setFormDescricao('');
    setFormHora('');
    setFormTitularId(user?.id || '');
    setFormTipoAgendamento('unica');
    setFormRecorrenciaTipo('todo_dia');
    setFormRecorrenciaDias([]);
    setFormDataFimRecorrencia('');
    setFormData(selectedDate || new Date());
    setFormOcultarDeOutrosAdmins(false);
    setEditingTarefa(null);
    resetAnexos([]);
    setShowCreateDialog(true);
  };

  const openEditDialog = (tarefa: TarefaPessoal, dataOcorrencia?: Date) => {
    setFormTitulo(tarefa.titulo);
    setFormDescricao(tarefa.descricao || '');
    setFormHora(tarefa.hora || '');
    setFormTitularId(tarefa.titular_id);
    setFormTipoAgendamento(tarefa.tipo_agendamento as 'unica' | 'recorrente');
    setFormRecorrenciaTipo((tarefa.recorrencia_tipo as 'todo_dia' | 'dias_semana' | 'mensal') || 'todo_dia');
    setFormRecorrenciaDias((tarefa.recorrencia_dias_semana as number[]) || []);
    setFormDataFimRecorrencia(tarefa.data_fim_recorrencia || '');
    setFormData(
      dataOcorrencia ?? new Date(tarefa.data + 'T00:00:00'),
    );
    setFormOcultarDeOutrosAdmins(tarefa.ocultar_de_outros_admins ?? false);
    setEditingTarefa(tarefa);
    resetAnexos(tarefa.anexos);
    setShowCreateDialog(true);
  };

  const toggleDiaSemana = (dia: number) => {
    setFormRecorrenciaDias((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia].sort()
    );
  };

  const handleSubmit = async () => {
    if (!formTitulo.trim() || !formTitularId) return;

    const effectiveTitularId = canAssignTarefaToOthers ? formTitularId : user?.id || formTitularId;
    const selectedUser = titulares.find((u) => u.id === effectiveTitularId);

    try {
      if (editingTarefa) {
        const anexos = await anexosDraft.flush(editingTarefa.id);
        await updateTarefa.mutateAsync({
          id: editingTarefa.id,
          titulo: formTitulo,
          descricao: formDescricao || null,
          hora: formHora || null,
          data: formData ? format(formData, 'yyyy-MM-dd') : editingTarefa.data,
          titular_id: effectiveTitularId,
          titular_nome: selectedUser?.nome || null,
          tipo_agendamento: formTipoAgendamento,
          recorrencia_tipo: formTipoAgendamento === 'recorrente' ? formRecorrenciaTipo : null,
          recorrencia_dias_semana: formTipoAgendamento === 'recorrente' && formRecorrenciaTipo === 'dias_semana' ? formRecorrenciaDias : null,
          data_fim_recorrencia: formTipoAgendamento === 'recorrente' && formDataFimRecorrencia ? formDataFimRecorrencia : null,
          ocultar_de_outros_admins: isAdminAgendaPessoal ? formOcultarDeOutrosAdmins : false,
          anexos,
        });
      } else {
        const dataStr = formData
          ? format(formData, 'yyyy-MM-dd')
          : selectedDate
            ? format(selectedDate, 'yyyy-MM-dd')
            : format(new Date(), 'yyyy-MM-dd');

        const entityId = crypto.randomUUID();
        const anexos = await anexosDraft.flush(entityId);
        await createTarefa.mutateAsync({
          id: entityId,
          titulo: formTitulo,
          descricao: formDescricao || undefined,
          data: dataStr,
          hora: formHora || undefined,
          titular_id: effectiveTitularId,
          tipo_agendamento: formTipoAgendamento,
          titular_nome: selectedUser?.nome,
          recorrencia_tipo: formTipoAgendamento === 'recorrente' ? formRecorrenciaTipo : undefined,
          recorrencia_dias_semana: formTipoAgendamento === 'recorrente' && formRecorrenciaTipo === 'dias_semana' ? formRecorrenciaDias : undefined,
          data_fim_recorrencia: formTipoAgendamento === 'recorrente' && formDataFimRecorrencia ? formDataFimRecorrencia : undefined,
          ocultar_de_outros_admins: isAdminAgendaPessoal ? formOcultarDeOutrosAdmins : undefined,
          anexos,
        });
      }
      setShowCreateDialog(false);
    } catch {
      // Erro já tratado no onError da mutation (toast).
    }
  };

  const handleToggleConcluida = (ocorrencia: OcorrenciaTarefa) => {
    const dateStr = format(ocorrencia.dataOcorrencia, 'yyyy-MM-dd');
    concluirOcorrencia.mutate({
      tarefa: ocorrencia.tarefa,
      dataOcorrencia: dateStr,
      concluida: !ocorrencia.concluida,
    });
  };

  const handleDeleteOcorrencia = (ocorrencia: OcorrenciaTarefa) => {
    if (ocorrencia.tarefa.tipo_agendamento === 'recorrente') {
      setDeleteConfirm({ tarefa: ocorrencia.tarefa, dataOcorrencia: ocorrencia.dataOcorrencia });
    } else {
      deleteTarefa.mutate(ocorrencia.tarefa.id);
    }
  };

  const handleDeleteSoEste = () => {
    if (!deleteConfirm) return;
    const dateStr = format(deleteConfirm.dataOcorrencia, 'yyyy-MM-dd');
    excluirOcorrencia.mutate({ tarefa: deleteConfirm.tarefa, dataOcorrencia: dateStr });
    setDeleteConfirm(null);
  };

  const handleDeleteTodas = () => {
    if (!deleteConfirm) return;
    deleteTarefa.mutate(deleteConfirm.tarefa.id);
    setDeleteConfirm(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-bold">Agenda Pessoal</h2>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Tarefa
        </Button>
      </div>

      {isAdminAgendaPessoal && adminTitularFilter && (
        <Card className="border-dashed">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium">Filtro por titularidade (administrador)</CardTitle>
            <p className="text-xs text-muted-foreground font-normal">
              Escolha quais tarefas ver. A opção é salva automaticamente e reaparece quando você abrir o app de novo.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3 pt-0 pb-4 px-4">
            <Select
              value={adminTitularFilter.filter_mode}
              onValueChange={(v) => handleTitularidadeModeChange(v as 'all' | 'self' | 'provider')}
              disabled={saveAdminTitularFilter.isPending}
            >
              <SelectTrigger className="w-full sm:max-w-xs">
                <SelectValue placeholder="Quem titula as tarefas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as tarefas</SelectItem>
                <SelectItem value="self">Somente as minhas</SelectItem>
                <SelectItem value="provider">Somente de um prestador…</SelectItem>
              </SelectContent>
            </Select>
            {adminTitularFilter.filter_mode === 'provider' && (
              <Select
                value={adminTitularFilter.filter_titular_id ?? ''}
                onValueChange={handleTitularidadePrestadorChange}
                disabled={saveAdminTitularFilter.isPending}
              >
                <SelectTrigger className="w-full sm:max-w-md">
                  <SelectValue placeholder="Prestador titular" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {(users ?? [])
                    .slice()
                    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome}
                        {u.id === user?.id ? ' (eu)' : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tarefas por título ou descrição..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold">{hojeTarefas.length}</div>
            <div className="text-sm text-muted-foreground">Tarefas hoje</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-amber-600">{totalPendentes}</div>
            <div className="text-sm text-muted-foreground">Pendentes (mês)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-green-600">{totalConcluidas}</div>
            <div className="text-sm text-muted-foreground">Concluídas (mês)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold">{tarefas.length}</div>
            <div className="text-sm text-muted-foreground">Total tarefas</div>
          </CardContent>
        </Card>
      </div>

      {/* Layout 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <AgendaCalendar
          reunioes={tarefasToCalendarFormat(ocorrenciasMes)}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        {/* Task lists */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {selectedDate
                        ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR })
                        : 'Selecione um dia'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate || undefined}
                      onSelect={(date) => date && setSelectedDate(date)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredOcorrencias.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma tarefa neste dia
                </p>
              ) : (
                <>
                  {pendentes.length > 0 && (
                    <div className="flex flex-col h-[320px] min-h-0">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex-shrink-0">
                        Pendentes ({pendentes.length})
                      </h4>
                      <ScrollArea className="flex-1 min-h-0">
                        <div className="space-y-2 pr-2">
                          {pendentes.map((o, i) => (
                            <OcorrenciaCard
                              key={`${o.tarefa.id}-p-${i}`}
                              ocorrencia={o}
                              isAdmin={isAdmin}
                              onToggle={handleToggleConcluida}
                              onEdit={() => openEditDialog(o.tarefa, o.dataOcorrencia)}
                              onDelete={() => handleDeleteOcorrencia(o)}
                              onViewDetails={() =>
                                setOcorrenciaPopup({
                                  ...o.tarefa,
                                  dataOcorrencia: o.dataOcorrencia,
                                })
                              }
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {concluidas.length > 0 && (
                    <div className="flex flex-col h-[240px] min-h-0">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1 flex-shrink-0">
                        <CheckCircle2 className="h-3 w-3" />
                        Concluídas ({concluidas.length})
                      </h4>
                      <ScrollArea className="flex-1 min-h-0">
                        <div className="space-y-2 pr-2">
                          {concluidas.map((o, i) => (
                            <OcorrenciaCard
                              key={`${o.tarefa.id}-c-${i}`}
                              ocorrencia={o}
                              isAdmin={isAdmin}
                              onToggle={handleToggleConcluida}
                              onEdit={() => openEditDialog(o.tarefa, o.dataOcorrencia)}
                              onDelete={() => handleDeleteOcorrencia(o)}
                              onViewDetails={() =>
                                setOcorrenciaPopup({
                                  ...o.tarefa,
                                  dataOcorrencia: o.dataOcorrencia,
                                })
                              }
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tarefas Pendentes (próximos 30 dias) - tarefas do dia selecionado ficam no card ao lado do calendário */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Tarefas Pendentes ({pendentesGerais.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendentesGerais.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma tarefa pendente nos próximos 30 dias
              </p>
            ) : (
              <ScrollArea className={pendentesGerais.length > 5 ? 'h-[320px]' : ''}>
                <div className="space-y-2 pr-2">
                  {pendentesGerais.map((o, i) => (
                    <OcorrenciaCardDetailed
                      key={`pend-${o.tarefa.id}-${i}`}
                      ocorrencia={o}
                      isAdmin={isAdmin}
                      users={users}
                      showDate
                      onToggle={handleToggleConcluida}
                      onEdit={() => openEditDialog(o.tarefa, o.dataOcorrencia)}
                      onDelete={() => handleDeleteOcorrencia(o)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

      <TarefaPessoalOcorrenciaDialog
        open={!!ocorrenciaPopup}
        onOpenChange={(open) => !open && setOcorrenciaPopup(null)}
        eventData={ocorrenciaPopup}
      />

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTarefa ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                placeholder="Ex: Ligar para fornecedor"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Detalhes da tarefa..."
                rows={3}
              />
            </div>
            <div>
              <Label>Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData ? format(formData, 'dd/MM/yyyy') : <span>Selecione a data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData}
                    onSelect={setFormData}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Horário</Label>
              <TimeInput24h value={formHora} onChange={setFormHora} optional />
            </div>
            <div>
              <Label>Titular *</Label>
              {canAssignTarefaToOthers ? (
                <AgendaTitularCombobox
                  value={formTitularId}
                  onChange={setFormTitularId}
                />
              ) : (
                <div className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  {findTitularAgendaNome(titulares, formTitularId)}
                </div>
              )}
            </div>

            {/* Recurrence section */}
            <div>
              <Label>Tipo</Label>
              <Select value={formTipoAgendamento} onValueChange={(v) => setFormTipoAgendamento(v as 'unica' | 'recorrente')}>
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
              <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/20">
                <Checkbox
                  id="ocultar-de-outros-admins"
                  checked={formOcultarDeOutrosAdmins}
                  onCheckedChange={(checked) => setFormOcultarDeOutrosAdmins(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="ocultar-de-outros-admins" className="cursor-pointer font-medium">
                    Ocultar tarefa dos demais usuários admin
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Somente você verá esta tarefa. Ela não aparecerá na agenda geral para outros administradores.
                    {formTipoAgendamento === 'recorrente' && ' Em tarefas recorrentes, todas as ocorrências ficam ocultas.'}
                  </p>
                </div>
              </div>
            )}

            {formTipoAgendamento === 'recorrente' && (
              <div className="space-y-4 border rounded-lg p-3 bg-muted/30">
                <div>
                  <Label>Repetição</Label>
                  <Select
                    value={formRecorrenciaTipo}
                    onValueChange={(v) =>
                      setFormRecorrenciaTipo(v as 'todo_dia' | 'dias_semana' | 'mensal')
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

                {formRecorrenciaTipo === 'dias_semana' && (
                  <div>
                    <Label className="mb-2 block">Dias</Label>
                    <div className="flex gap-1 flex-wrap">
                      {DIAS_SEMANA_LABELS.map((label, idx) => (
                        <Button
                          key={idx}
                          type="button"
                          variant={formRecorrenciaDias.includes(idx) ? 'default' : 'outline'}
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

                {formRecorrenciaTipo === 'mensal' && (
                  <p className="text-xs text-muted-foreground">
                    {formData
                      ? `Será lembrada todo dia ${format(formData, 'd')} de cada mês, no horário informado.`
                      : 'Escolha a data acima: o dia do mês será usado na repetição (ex.: dia 10).'}
                  </p>
                )}

                <div>
                  <Label>Data de término (opcional)</Label>
                  <Input
                    type="date"
                    value={formDataFimRecorrencia}
                    onChange={(e) => setFormDataFimRecorrencia(e.target.value)}
                  />
                </div>
              </div>
            )}

            <AgendaItemAnexosField
              draft={anexosDraft}
              accept="images-and-pdfs"
              title="Fotos e PDFs"
              hint="O PDF vira fotos, página por página. Ficam só nesta tarefa."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !formTitulo.trim() ||
                !formTitularId ||
                anexosDraft.converting ||
                anexosDraft.busy
              }
            >
              {anexosDraft.busy ? 'Salvando…' : editingTarefa ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation for recurrent */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa recorrente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta é uma tarefa recorrente. Deseja excluir apenas esta ocorrência ou todas as ocorrências?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSoEste} className="bg-amber-600 hover:bg-amber-700">
              <CalendarX2 className="h-4 w-4 mr-2" />
              Só este dia
            </AlertDialogAction>
            <AlertDialogAction onClick={handleDeleteTodas} className="bg-destructive hover:bg-destructive/90">
              <Trash2 className="h-4 w-4 mr-2" />
              Todas as ocorrências
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Occurrence card component
function OcorrenciaCard({
  ocorrencia,
  isAdmin,
  onToggle,
  onEdit,
  onDelete,
  onViewDetails,
}: {
  ocorrencia: OcorrenciaTarefa;
  isAdmin: boolean;
  onToggle: (o: OcorrenciaTarefa) => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewDetails?: () => void;
}) {
  const { tarefa, concluida } = ocorrencia;
  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors',
        concluida ? 'bg-muted/50 opacity-60' : 'bg-card hover:bg-accent/30'
      )}
    >
      <Checkbox
        checked={concluida}
        onCheckedChange={() => onToggle(ocorrencia)}
        className="mt-0.5"
      />
      <div
        className={cn('flex-1 min-w-0', onViewDetails && 'cursor-pointer')}
        role={onViewDetails ? 'button' : undefined}
        tabIndex={onViewDetails ? 0 : undefined}
        onClick={onViewDetails ?? undefined}
        onKeyDown={onViewDetails ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewDetails(); } } : undefined}
      >
        <p className={cn('text-sm font-medium', concluida && 'line-through')}>
          {tarefa.titulo}
        </p>
        {tarefa.descricao && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {tarefa.descricao}
          </p>
        )}
        <AgendaItemAnexosMiniStrip urls={(tarefa.anexos ?? []).map((a) => a.url)} />
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {tarefa.hora && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {tarefa.hora}
            </span>
          )}
          <AgendaItemAnexosBadge count={(tarefa.anexos ?? []).length} />
          {tarefa.tipo_agendamento === 'recorrente' && (
            <Badge variant="outline" className="text-xs">
              <Repeat className="h-3 w-3 mr-1" />
              {getRecorrenciaTipoLabel(tarefa.recorrencia_tipo)}
            </Badge>
          )}
          {tarefa.titular_nome && (
            <Badge variant="secondary" className="text-xs">
              <User className="h-3 w-3 mr-1" />
              {tarefa.titular_nome}
            </Badge>
          )}
          {tarefa.ocultar_de_outros_admins && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              <EyeOff className="h-3 w-3 mr-1" />
              Oculta
            </Badge>
          )}
        </div>
      </div>
      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// Detailed occurrence card with date display, used in "Tarefas do Dia" and "Tarefas Pendentes"
function OcorrenciaCardDetailed({
  ocorrencia,
  isAdmin,
  users,
  showDate,
  onToggle,
  onEdit,
  onDelete,
}: {
  ocorrencia: OcorrenciaTarefa;
  isAdmin: boolean;
  users: any[] | undefined;
  showDate?: boolean;
  onToggle: (o: OcorrenciaTarefa) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { tarefa, concluida } = ocorrencia;
  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors',
        concluida ? 'bg-muted/50 opacity-60' : 'bg-card hover:bg-accent/30'
      )}
    >
      <Checkbox
        checked={concluida}
        onCheckedChange={() => onToggle(ocorrencia)}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', concluida && 'line-through')}>
          {tarefa.titulo}
        </p>
        {tarefa.descricao && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {tarefa.descricao}
          </p>
        )}
        <AgendaItemAnexosMiniStrip urls={(tarefa.anexos ?? []).map((a) => a.url)} />
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {showDate && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarIcon className="h-3 w-3" />
              {format(ocorrencia.dataOcorrencia, 'dd/MM', { locale: ptBR })}
            </span>
          )}
          {tarefa.hora && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {tarefa.hora}
            </span>
          )}
          <AgendaItemAnexosBadge count={(tarefa.anexos ?? []).length} />
          {tarefa.tipo_agendamento === 'recorrente' && (
            <Badge variant="outline" className="text-xs">
              <Repeat className="h-3 w-3 mr-1" />
              {getRecorrenciaTipoLabel(tarefa.recorrencia_tipo)}
            </Badge>
          )}
          {tarefa.titular_nome && (
            <Badge variant="secondary" className="text-xs">
              <User className="h-3 w-3 mr-1" />
              {tarefa.titular_nome}
            </Badge>
          )}
          {tarefa.ocultar_de_outros_admins && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              <EyeOff className="h-3 w-3 mr-1" />
              Oculta
            </Badge>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="Editar (data, hora, titular)">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
          title="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
