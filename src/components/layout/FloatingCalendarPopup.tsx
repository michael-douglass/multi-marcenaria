import { useState, useMemo } from 'react';
import { format, addDays, subDays, isSameDay, isToday, parseISO, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Phone,
  Mail,
  Pencil,
  Check,
  Save,
  Video,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { formatFormResponseValue } from '@/lib/agenda-form-field-utils';
import { floatingPopupPositionClass } from '@/lib/floating-ui-layout';
import type { AgendaReuniao } from '@/hooks/useAgenda';
import { MetadataCapturedDisplay } from '@/components/agenda/MetadataCapturedDisplay';

interface FloatingCalendarPopupProps {
  isOpen: boolean;
  onClose: () => void;
  reunioes: AgendaReuniao[];
  onUpdateReuniao?: (id: string, updates: Partial<AgendaReuniao>) => void;
  onUpdateStatus?: (id: string, status: 'concluido' | 'cancelado') => void;
  isUpdating?: boolean;
}

// Gerar horários disponíveis
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 6; hour < 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }
  }
  return slots;
};

const timeSlots = generateTimeSlots();

const duracaoOptions = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1h 30min' },
  { value: 120, label: '2 horas' },
];

export function FloatingCalendarPopup({ 
  isOpen, 
  onClose, 
  reunioes, 
  onUpdateReuniao, 
  onUpdateStatus,
  isUpdating 
}: FloatingCalendarPopupProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedReuniao, setSelectedReuniao] = useState<AgendaReuniao | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Estados de edição
  const [editTitulo, setEditTitulo] = useState('');
  const [editData, setEditData] = useState<Date | undefined>(undefined);
  const [editHorario, setEditHorario] = useState('09:00');
  const [editDuracao, setEditDuracao] = useState(30);
  const [editConvidadoNome, setEditConvidadoNome] = useState('');
  const [editConvidadoWhatsapp, setEditConvidadoWhatsapp] = useState('');
  const [editObservacoes, setEditObservacoes] = useState('');

  // Filtrar reuniões do dia selecionado (apenas pendentes)
  const reunioesDoDia = useMemo(() => {
    return reunioes.filter((r) => {
      const reuniaoDate = parseISO(r.data_hora_inicio);
      return isSameDay(reuniaoDate, selectedDate) && r.status === 'pendente';
    }).sort((a, b) => new Date(a.data_hora_inicio).getTime() - new Date(b.data_hora_inicio).getTime());
  }, [reunioes, selectedDate]);

  const navigateDay = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => direction === 'next' ? addDays(prev, 1) : subDays(prev, 1));
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300"><AlertCircle className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'confirmado':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300"><CheckCircle2 className="h-3 w-3 mr-1" />Confirmado</Badge>;
      case 'concluido':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300"><CheckCircle2 className="h-3 w-3 mr-1" />Concluído</Badge>;
      case 'cancelado':
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300"><XCircle className="h-3 w-3 mr-1" />Cancelado</Badge>;
      default:
        return null;
    }
  };

  const handleOpenDetails = (reuniao: AgendaReuniao) => {
    setSelectedReuniao(reuniao);
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    if (!selectedReuniao) return;
    const dataInicio = parseISO(selectedReuniao.data_hora_inicio);
    setEditTitulo(selectedReuniao.titulo || '');
    setEditData(dataInicio);
    setEditHorario(format(dataInicio, 'HH:mm'));
    setEditDuracao(selectedReuniao.duracao_minutos);
    setEditConvidadoNome(selectedReuniao.convidado_nome || '');
    setEditConvidadoWhatsapp(selectedReuniao.convidado_whatsapp || '');
    setEditObservacoes(selectedReuniao.observacoes || '');
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!selectedReuniao || !editData || !onUpdateReuniao) return;
    
    const [hours, minutes] = editHorario.split(':').map(Number);
    const dataHoraInicio = new Date(editData);
    dataHoraInicio.setHours(hours, minutes, 0, 0);
    const dataHoraFim = addMinutes(dataHoraInicio, editDuracao);

    onUpdateReuniao(selectedReuniao.id, {
      titulo: editTitulo,
      data_hora_inicio: dataHoraInicio.toISOString(),
      data_hora_fim: dataHoraFim.toISOString(),
      duracao_minutos: editDuracao,
      convidado_nome: editConvidadoNome || null,
      convidado_whatsapp: editConvidadoWhatsapp || null,
      observacoes: editObservacoes || null,
    });
    setSelectedReuniao(null);
    setIsEditing(false);
  };

  const handleCloseDetails = () => {
    setSelectedReuniao(null);
    setIsEditing(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className={cn(
          floatingPopupPositionClass,
          "w-[380px] h-[500px]",
          "bg-background border rounded-lg shadow-2xl",
          "flex flex-col",
          "animate-in slide-in-from-top-2 fade-in duration-200"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30 rounded-t-lg">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Tarefas da Agenda</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navegação de data */}
        <div className="flex items-center justify-between p-3 border-b">
          <Button variant="ghost" size="icon" onClick={() => navigateDay('prev')} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {isToday(selectedDate) ? 'Hoje' : format(selectedDate, "EEEE", { locale: ptBR })}
            </span>
            <span className="text-muted-foreground text-sm">
              {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
            </span>
            {!isToday(selectedDate) && (
              <Button variant="outline" size="sm" onClick={goToToday} className="h-6 text-xs ml-2">
                Hoje
              </Button>
            )}
          </div>
          
          <Button variant="ghost" size="icon" onClick={() => navigateDay('next')} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Contador de tarefas */}
        <div className="px-4 py-2 bg-muted/20 border-b">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tarefas pendentes</span>
            <Badge variant={reunioesDoDia.length > 0 ? "destructive" : "secondary"}>
              {reunioesDoDia.length}
            </Badge>
          </div>
        </div>

        {/* Lista de tarefas - scrollable */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {reunioesDoDia.length > 0 ? (
              reunioesDoDia.map((reuniao) => (
                <div
                  key={reuniao.id}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div 
                      className="flex-1 cursor-pointer" 
                      onClick={() => handleOpenDetails(reuniao)}
                    >
                      <h4 className="font-medium text-sm line-clamp-1">{reuniao.titulo}</h4>
                    </div>
                    <div className="flex items-center gap-1">
                      {getStatusBadge(reuniao.status)}
                      {onUpdateReuniao && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReuniao(reuniao);
                            setTimeout(() => handleStartEdit(), 50);
                          }}
                          title="Editar reunião"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <div 
                    className="space-y-1 text-xs text-muted-foreground cursor-pointer"
                    onClick={() => handleOpenDetails(reuniao)}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span>
                        {format(parseISO(reuniao.data_hora_inicio), "HH:mm")} - {format(parseISO(reuniao.data_hora_fim), "HH:mm")}
                      </span>
                      <span className="text-muted-foreground/60">
                        ({reuniao.duracao_minutos} min)
                      </span>
                    </div>
                    
                    {reuniao.convidado_nome && (
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        <span>{reuniao.convidado_nome}</span>
                      </div>
                    )}
                    
                    {reuniao.convidado_whatsapp && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        <span>{reuniao.convidado_whatsapp}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">Nenhuma tarefa pendente</p>
                <p className="text-xs">para {isToday(selectedDate) ? 'hoje' : format(selectedDate, "d 'de' MMMM", { locale: ptBR })}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Dialog de detalhes/edição */}
      <Dialog open={!!selectedReuniao} onOpenChange={handleCloseDetails}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto z-[60]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              {isEditing ? 'Editar Reunião' : 'Detalhes da Reunião'}
            </DialogTitle>
          </DialogHeader>

          {selectedReuniao && !isEditing && (
            <div className="space-y-4">
              {/* Status e Tipo */}
              <div className="flex items-center gap-2">
                {getStatusBadge(selectedReuniao.status)}
                {selectedReuniao.tipo === 'publico' && (
                  <Badge variant="outline">Agendamento Público</Badge>
                )}
              </div>

              {/* Título e Descrição */}
              <div>
                <h3 className="font-semibold text-lg">{selectedReuniao.titulo}</h3>
                {selectedReuniao.descricao && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedReuniao.descricao}</p>
                )}
              </div>

              <Separator />

              {/* Data e Hora */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Data</p>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(selectedReuniao.data_hora_inicio), "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Horário</p>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(selectedReuniao.data_hora_inicio), 'HH:mm')} ({selectedReuniao.duracao_minutos}min)
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Informações do Convidado */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Informações do Convidado
                </h4>

                {selectedReuniao.convidado_nome && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedReuniao.convidado_nome}</span>
                  </div>
                )}

                {selectedReuniao.convidado_whatsapp && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={`https://wa.me/${selectedReuniao.convidado_whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {selectedReuniao.convidado_whatsapp}
                    </a>
                  </div>
                )}

                {selectedReuniao.convidado_email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${selectedReuniao.convidado_email}`} className="text-primary hover:underline">
                      {selectedReuniao.convidado_email}
                    </a>
                  </div>
                )}
              </div>

              {/* Link de Videoconferência */}
              {selectedReuniao.link_video_conferencia && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <Video className="h-4 w-4" />
                      Videoconferência
                    </h4>
                    <a
                      href={selectedReuniao.link_video_conferencia}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline break-all"
                    >
                      {selectedReuniao.link_video_conferencia}
                    </a>
                  </div>
                </>
              )}

              {/* Resposta do Formulário */}
              {selectedReuniao.resposta_formulario && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4" />
                      Respostas do Formulário
                    </h4>
                    <div className="space-y-2 bg-muted/50 rounded-lg p-3">
                      {(() => {
                        try {
                          const parsed = JSON.parse(selectedReuniao.resposta_formulario);
                          const fieldLabels: Record<string, string> = {
                            nome_aluno: 'Nome do Aluno',
                            telefone: 'Telefone (WhatsApp)',
                            email: 'E-mail',
                            idade_aluno: 'Idade do Aluno',
                            ano_escolar: 'Ano Escolar',
                            nome_responsavel: 'Nome do Responsável',
                            resposta_formulario: 'Resposta',
                          };
                          return Object.entries(parsed).map(([key, value]) => {
                            if (!value) return null;
                            return (
                              <div key={key} className="text-sm">
                                <span className="font-medium text-muted-foreground">
                                  {fieldLabels[key] || key}:
                                </span>{' '}
                                <span>{formatFormResponseValue(String(value))}</span>
                              </div>
                            );
                          });
                        } catch {
                          return <p className="text-sm">{selectedReuniao.resposta_formulario}</p>;
                        }
                      })()}
                    </div>
                  </div>
                </>
              )}

              {/* Observações */}
              {selectedReuniao.observacoes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Observações</h4>
                    <p className="text-sm text-muted-foreground">{selectedReuniao.observacoes}</p>
                  </div>
                </>
              )}

              {/* Informações Capturadas do Lead */}
              {selectedReuniao.metadata_capturada && Object.keys(selectedReuniao.metadata_capturada).length > 0 && (
                <MetadataCapturedDisplay metadata={selectedReuniao.metadata_capturada} />
              )}

              {/* Ações */}
              {(selectedReuniao.status === 'pendente' || selectedReuniao.status === 'confirmado') && (
                <>
                  <Separator />
                  <div className="flex gap-2">
                    {onUpdateReuniao && (
                      <Button variant="outline" className="flex-1" onClick={handleStartEdit}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    )}
                    {onUpdateStatus && (
                      <>
                        <Button
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={() => {
                            onUpdateStatus(selectedReuniao.id, 'concluido');
                            handleCloseDetails();
                          }}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Concluído
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            onUpdateStatus(selectedReuniao.id, 'cancelado');
                            handleCloseDetails();
                          }}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Modo de edição */}
          {selectedReuniao && isEditing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editData ? format(editData, "dd/MM/yyyy") : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[100]" align="start">
                      <Calendar
                        mode="single"
                        selected={editData}
                        onSelect={setEditData}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Horário</Label>
                  <Select value={editHorario} onValueChange={setEditHorario}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px] z-[100]">
                      {timeSlots.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Duração</Label>
                <Select value={editDuracao.toString()} onValueChange={(v) => setEditDuracao(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    {duracaoOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Nome do Convidado</Label>
                <Input value={editConvidadoNome} onChange={(e) => setEditConvidadoNome(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input value={editConvidadoWhatsapp} onChange={(e) => setEditConvidadoWhatsapp(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={editObservacoes} onChange={(e) => setEditObservacoes(e.target.value)} rows={2} />
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                <Button onClick={handleSaveEdit} disabled={isUpdating || !editTitulo}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
