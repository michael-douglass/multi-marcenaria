import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, addMinutes, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, User, Phone, Mail, MessageSquare, Save, X, AlertCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import type { AgendaReuniao, AgendaConfig, BloqueioRecorrente } from '@/hooks/useAgenda';
import { useAgendaFormFields } from '@/hooks/useAgendaFormFields';
import {
  filterCustomFormFields,
  parseRespostaFormulario,
} from '@/lib/agenda-form-field-utils';
import { normalizeTitularIdsForSave } from '@/lib/agenda-reuniao-titulares';
import { AgendaReuniaoTitularesPicker } from './AgendaReuniaoTitularesPicker';

interface EditReuniaoDialogProps {
  reuniao: AgendaReuniao | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<AgendaReuniao>) => void;
  isLoading?: boolean;
  reunioes?: AgendaReuniao[];
  config?: AgendaConfig | null;
  /** Mantém o diálogo acima do painel da agenda flutuante. */
  floatingLayer?: boolean;
}

// Gerar horários disponíveis (de 30 em 30 minutos)
const generateTimeSlots = (horarioInicio: string = '06:00', horarioFim: string = '22:00') => {
  const slots: string[] = [];
  const [inicioH, inicioM] = horarioInicio.split(':').map(Number);
  const [fimH, fimM] = horarioFim.split(':').map(Number);
  
  for (let hour = inicioH; hour < fimH || (hour === fimH && 0 < fimM); hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === inicioH && minute < inicioM) continue;
      if (hour === fimH && minute >= fimM) break;
      slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }
  }
  return slots;
};

const duracaoOptions = [
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 45, label: '45 minutos' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1h 30min' },
  { value: 120, label: '2 horas' },
];

export function EditReuniaoDialog({
  reuniao, 
  isOpen, 
  onClose, 
  onSave, 
  isLoading,
  reunioes = [],
  config,
  floatingLayer = false,
}: EditReuniaoDialogProps) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [horarioInicio, setHorarioInicio] = useState('09:00');
  const [duracao, setDuracao] = useState(30);
  const [convidadoNome, setConvidadoNome] = useState('');
  const [convidadoWhatsapp, setConvidadoWhatsapp] = useState('');
  const [convidadoEmail, setConvidadoEmail] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [titularIds, setTitularIds] = useState<string[] | null>(null);
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const { fields: formFieldDefs } = useAgendaFormFields(config?.id);

  const customFormFields = useMemo(
    () =>
      filterCustomFormFields(formFieldDefs)
        .filter((field) => field.visible !== false)
        .sort((a, b) => a.ordem - b.ordem),
    [formFieldDefs],
  );

  // Preencher os campos quando a reunião mudar
  useEffect(() => {
    if (reuniao) {
      const dataInicio = parseISO(reuniao.data_hora_inicio);
      setTitulo(reuniao.titulo || '');
      setDescricao(reuniao.descricao || '');
      setSelectedDate(dataInicio);
      setHorarioInicio(format(dataInicio, 'HH:mm'));
      setDuracao(reuniao.duracao_minutos);
      setConvidadoNome(reuniao.convidado_nome || '');
      setConvidadoWhatsapp(reuniao.convidado_whatsapp || '');
      setConvidadoEmail(reuniao.convidado_email || '');
      setObservacoes(reuniao.observacoes || '');
      setTitularIds(reuniao.titular_ids ?? null);
      setFormFields(parseRespostaFormulario(reuniao.resposta_formulario));
    }
  }, [reuniao]);

  // Verificar se um horário está disponível
  const isHorarioDisponivel = (date: Date, hora: string, duracaoMinutos: number): boolean => {
    const [hours, minutes] = hora.split(':').map(Number);
    const dataHoraInicio = new Date(date);
    dataHoraInicio.setHours(hours, minutes, 0, 0);
    const dataHoraFim = addMinutes(dataHoraInicio, duracaoMinutos);

    // Verificar conflitos com outras reuniões (exceto a atual)
    const hasConflito = reunioes.some((r) => {
      if (reuniao && r.id === reuniao.id) return false; // Ignorar a reunião atual
      if (r.status === 'cancelado' || r.status === 'concluido') return false;
      
      const rInicio = new Date(r.data_hora_inicio);
      const rFim = new Date(r.data_hora_fim);
      return dataHoraInicio < rFim && dataHoraFim > rInicio;
    });

    if (hasConflito) return false;

    // Verificar bloqueios recorrentes
    if (config?.bloqueios_recorrentes && config.bloqueios_recorrentes.length > 0) {
      const diaSemana = date.getDay();
      const hasBloqueioRecorrente = config.bloqueios_recorrentes.some((bloqueio) => {
        if (bloqueio.dia_semana !== diaSemana) return false;
        
        const [bloqueioInicioH, bloqueioInicioM] = bloqueio.hora_inicio.split(':').map(Number);
        const [bloqueioFimH, bloqueioFimM] = bloqueio.hora_fim.split(':').map(Number);
        
        const bloqueioInicio = new Date(date);
        bloqueioInicio.setHours(bloqueioInicioH, bloqueioInicioM, 0, 0);
        const bloqueioFim = new Date(date);
        bloqueioFim.setHours(bloqueioFimH, bloqueioFimM, 0, 0);
        
        return dataHoraInicio < bloqueioFim && dataHoraFim > bloqueioInicio;
      });

      if (hasBloqueioRecorrente) return false;
    }

    return true;
  };

  // Gerar lista de horários disponíveis baseado na data selecionada
  const horariosDisponiveis = useMemo(() => {
    if (!selectedDate) return [];
    
    const baseSlots = generateTimeSlots(
      config?.horario_inicio || '06:00',
      config?.horario_fim || '22:00'
    );
    
    return baseSlots.filter(slot => isHorarioDisponivel(selectedDate, slot, duracao));
  }, [selectedDate, duracao, reunioes, config, reuniao]);

  // Verificar se o horário atual está disponível
  const isCurrentHorarioValid = useMemo(() => {
    if (!selectedDate || !horarioInicio) return true;
    return isHorarioDisponivel(selectedDate, horarioInicio, duracao);
  }, [selectedDate, horarioInicio, duracao, reunioes, config, reuniao]);

  const handleSave = () => {
    if (!reuniao || !selectedDate) return;

    // Construir data/hora de início
    const [hours, minutes] = horarioInicio.split(':').map(Number);
    const dataHoraInicio = new Date(selectedDate);
    dataHoraInicio.setHours(hours, minutes, 0, 0);

    // Calcular data/hora de fim
    const dataHoraFim = addMinutes(dataHoraInicio, duracao);

    const respostaFormularioStr =
      customFormFields.length > 0
        ? (() => {
            const entries = customFormFields
              .map((field) => [field.field_key, formFields[field.field_key]?.trim() ?? ''] as const)
              .filter(([, value]) => value !== '');
            return entries.length > 0 ? JSON.stringify(Object.fromEntries(entries)) : null;
          })()
        : null;

    const updates: Partial<AgendaReuniao> = {
      titulo,
      descricao: descricao || null,
      data_hora_inicio: dataHoraInicio.toISOString(),
      data_hora_fim: dataHoraFim.toISOString(),
      duracao_minutos: duracao,
      convidado_nome: convidadoNome || null,
      convidado_whatsapp: convidadoWhatsapp || null,
      convidado_email: convidadoEmail || null,
      observacoes: observacoes || null,
      resposta_formulario: respostaFormularioStr,
      titular_ids: normalizeTitularIdsForSave(titularIds, false),
    };

    onSave(reuniao.id, updates);
  };

  if (!reuniao) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" floatingLayer={floatingLayer}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Editar Reunião
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título da reunião"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição da reunião"
              rows={2}
            />
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-4">
            {/* Data */}
            <div className="space-y-2">
              <Label>Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      // Resetar horário se não estiver disponível no novo dia
                      if (date && !isHorarioDisponivel(date, horarioInicio, duracao)) {
                        const slots = generateTimeSlots(
                          config?.horario_inicio || '06:00',
                          config?.horario_fim || '22:00'
                        );
                        const availableSlot = slots.find(slot => isHorarioDisponivel(date, slot, duracao));
                        if (availableSlot) {
                          setHorarioInicio(availableSlot);
                        }
                      }
                    }}
                    locale={ptBR}
                    initialFocus
                    disabled={(date) => {
                      // Desabilitar dias indisponíveis baseado na config
                      if (config?.dias_disponiveis && !config.dias_disponiveis.includes(date.getDay())) {
                        return true;
                      }
                      return false;
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Hora */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Horário *
                {!isCurrentHorarioValid && (
                  <Badge variant="destructive" className="text-[10px] py-0">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Ocupado
                  </Badge>
                )}
              </Label>
              <Select value={horarioInicio} onValueChange={setHorarioInicio}>
                <SelectTrigger className={cn(!isCurrentHorarioValid && "border-destructive")}>
                  <SelectValue placeholder="Horário" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {horariosDisponiveis.length > 0 ? (
                    horariosDisponiveis.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      Nenhum horário disponível
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duração */}
          <div className="space-y-2">
            <Label>Duração</Label>
            <Select value={duracao.toString()} onValueChange={(v) => setDuracao(Number(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Duração" />
              </SelectTrigger>
              <SelectContent>
                {duracaoOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Informações do Convidado */}
          <div className="space-y-3 pt-2 border-t">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Informações do Convidado
            </h4>

            <div className="space-y-2">
              <Label htmlFor="convidado_nome">Nome</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="convidado_nome"
                  value={convidadoNome}
                  onChange={(e) => setConvidadoNome(e.target.value)}
                  placeholder="Nome do convidado"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="convidado_whatsapp">WhatsApp</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="convidado_whatsapp"
                  value={convidadoWhatsapp}
                  onChange={(e) => setConvidadoWhatsapp(e.target.value)}
                  placeholder="WhatsApp do convidado"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="convidado_email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="convidado_email"
                  type="email"
                  value={convidadoEmail}
                  onChange={(e) => setConvidadoEmail(e.target.value)}
                  placeholder="E-mail do convidado"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {/* Respostas do Formulário (formulário público ou manual) */}
          <div className="space-y-3 pt-2 border-t">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Respostas do Formulário
            </h4>
            <p className="text-xs text-muted-foreground">
              Edite as perguntas configuradas no formulário da agenda.
            </p>
            <div className="space-y-3">
              {customFormFields.map((field) => (
                <div key={field.field_key} className="space-y-1.5">
                  <Label htmlFor={`form_${field.field_key}`}>{field.field_label}</Label>
                  {field.field_type === 'textarea' ? (
                    <Textarea
                      id={`form_${field.field_key}`}
                      value={formFields[field.field_key] ?? ''}
                      onChange={(e) =>
                        setFormFields((prev) => ({ ...prev, [field.field_key]: e.target.value }))
                      }
                      placeholder={field.placeholder ?? field.field_label}
                      rows={3}
                    />
                  ) : (
                    <Input
                      id={`form_${field.field_key}`}
                      value={formFields[field.field_key] ?? ''}
                      onChange={(e) =>
                        setFormFields((prev) => ({ ...prev, [field.field_key]: e.target.value }))
                      }
                      placeholder={field.placeholder ?? field.field_label}
                    />
                  )}
                </div>
              ))}
              {customFormFields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma pergunta personalizada configurada. Configure o formulário na aba Configurações da agenda.
                </p>
              )}
            </div>
          </div>

          {/* Titulares */}
          <div className="pt-2 border-t">
            <AgendaReuniaoTitularesPicker
              value={titularIds}
              onChange={setTitularIds}
              compact
            />
          </div>

          {/* Observações */}
          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="observacoes" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Observações
            </Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações adicionais"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isLoading || !titulo || !selectedDate || !isCurrentHorarioValid}
          >
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}