import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, User, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useAgenda } from '@/hooks/useAgenda';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ScheduleMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  leadName: string;
  leadPhone: string;
  onSuccess?: () => void;
}

export function ScheduleMeetingDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  leadPhone,
  onSuccess,
}: ScheduleMeetingDialogProps) {
  const { user } = useAuth();
  const { createReuniao } = useAgenda();
  
  const [titulo, setTitulo] = useState(`Reunião com ${leadName}`);
  const [data, setData] = useState<Date | undefined>(new Date());
  const [hora, setHora] = useState('09:00');
  const [duracao, setDuracao] = useState('60');
  const [observacoes, setObservacoes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!titulo || !data) {
      toast.error('Preencha o título e a data');
      return;
    }

    setIsSubmitting(true);

    try {
      const [h, m] = hora.split(':').map(Number);
      const dataHoraInicio = new Date(data);
      dataHoraInicio.setHours(h, m, 0, 0);

      const dataHoraFim = new Date(dataHoraInicio.getTime() + parseInt(duracao) * 60000);

      await createReuniao.mutateAsync({
        titulo,
        data_hora_inicio: dataHoraInicio.toISOString(),
        data_hora_fim: dataHoraFim.toISOString(),
        duracao_minutos: parseInt(duracao),
        convidado_nome: leadName,
        convidado_whatsapp: leadPhone,
        status: 'pendente',
        tipo: 'interno',
        observacoes: observacoes || undefined,
        responsavel_id: user?.id,
        lead_id: leadId,
      });

      // Reset form
      setTitulo(`Reunião com ${leadName}`);
      setData(new Date());
      setHora('09:00');
      setDuracao('60');
      setObservacoes('');
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao agendar reunião:', error);
      toast.error('Erro ao agendar reunião');
    } finally {
      setIsSubmitting(false);
    }
  };

  const horariosDisponiveis = Array.from({ length: 24 }, (_, i) => {
    const h = i.toString().padStart(2, '0');
    return [`${h}:00`, `${h}:30`];
  }).flat();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent nested className="max-w-md" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Agendar Reunião
          </DialogTitle>
          <DialogDescription>
            Agende uma reunião com o lead <strong>{leadName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Dados do Lead (readonly) */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Nome:</span>
              <span className="font-medium truncate">{leadName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Tel:</span>
              <span className="font-medium">{leadPhone || 'Não informado'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="titulo">Título da Reunião *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Reunião de apresentação"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !data && 'text-muted-foreground'
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {data ? format(data, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={data}
                    onSelect={setData}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Horário *</Label>
              <Select value={hora} onValueChange={setHora}>
                <SelectTrigger>
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {horariosDisponiveis.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Duração</Label>
            <Select value={duracao} onValueChange={setDuracao}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutos</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="45">45 minutos</SelectItem>
                <SelectItem value="60">1 hora</SelectItem>
                <SelectItem value="90">1h 30min</SelectItem>
                <SelectItem value="120">2 horas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Notas ou detalhes adicionais..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!titulo || !data || isSubmitting}>
            {isSubmitting ? 'Agendando...' : 'Agendar Reunião'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
