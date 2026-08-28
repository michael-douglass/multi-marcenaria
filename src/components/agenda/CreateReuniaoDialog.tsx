import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Calendar, User, MessageSquare, Video } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { getNearestHoraSlot } from '@/lib/horarios-24h';

interface CreateReuniaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    titulo: string;
    data_hora_inicio: string;
    duracao_minutos: number;
    convidado_nome?: string;
    convidado_whatsapp?: string;
    link_video_conferencia?: string;
    observacoes?: string;
  }) => void;
  initialDate?: Date;
  /** Acima do painel flutuante da agenda (z-95). */
  floatingLayer?: boolean;
}

export function CreateReuniaoDialog({
  open,
  onOpenChange,
  onSubmit,
  initialDate,
  floatingLayer,
}: CreateReuniaoDialogProps) {
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState<Date | undefined>(undefined);
  const [hora, setHora] = useState('09:00');
  const [duracao, setDuracao] = useState('60');
  const [convidadoNome, setConvidadoNome] = useState('');
  const [convidadoWhatsapp, setConvidadoWhatsapp] = useState('');
  const [linkVideo, setLinkVideo] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitulo('');
    setData(initialDate || new Date());
    // Grade de reunião usa :00 / :30 — arredonda o horário atual
    setHora(getNearestHoraSlot(new Date(), 30));
    setDuracao('60');
    setConvidadoNome('');
    setConvidadoWhatsapp('');
    setLinkVideo('');
    setObservacoes('');
  }, [open, initialDate]);

  const handleSubmit = () => {
    if (!titulo || !data) return;

    const [h, m] = hora.split(':').map(Number);
    const dataHoraInicio = new Date(data);
    dataHoraInicio.setHours(h, m, 0, 0);

    onSubmit({
      titulo,
      data_hora_inicio: dataHoraInicio.toISOString(),
      duracao_minutos: parseInt(duracao),
      convidado_nome: convidadoNome || undefined,
      convidado_whatsapp: convidadoWhatsapp || undefined,
      link_video_conferencia: linkVideo || undefined,
      observacoes: observacoes || undefined,
    });

    onOpenChange(false);
  };

  const horariosDisponiveis = Array.from({ length: 24 }, (_, i) => {
    const h = i.toString().padStart(2, '0');
    return [`${h}:00`, `${h}:30`];
  }).flat();

  // Garante que o horário atual arredondado apareça na lista
  const horaOptions =
    hora && !horariosDisponiveis.includes(hora)
      ? [...horariosDisponiveis, hora].sort()
      : horariosDisponiveis;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" floatingLayer={floatingLayer}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Nova Reunião
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título da Reunião *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Reunião com cliente"
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
                    {data ? format(data, 'dd/MM/yyyy') : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={data}
                    onSelect={setData}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Horário *</Label>
              <Select value={hora} onValueChange={setHora}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {horaOptions.map((h) => (
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

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Convidado (opcional)</p>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="convidado-nome" className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Nome
                </Label>
                <Input
                  id="convidado-nome"
                  value={convidadoNome}
                  onChange={(e) => setConvidadoNome(e.target.value)}
                  placeholder="Nome do convidado"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="convidado-whatsapp" className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  WhatsApp
                </Label>
                <Input
                  id="convidado-whatsapp"
                  value={convidadoWhatsapp}
                  onChange={(e) => setConvidadoWhatsapp(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-video" className="flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5" />
              Link da Videoconferência
            </Label>
            <Input
              id="link-video"
              value={linkVideo}
              onChange={(e) => setLinkVideo(e.target.value)}
              placeholder="https://meet.google.com/..."
            />
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!titulo || !data}>
            Criar Reunião
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
