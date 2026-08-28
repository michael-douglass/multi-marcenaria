import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MarketingTask } from '@/hooks/useMarketingTasks';
import { MarketingContentCard } from '@/hooks/useMarketingConteudo';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Megaphone, Send } from 'lucide-react';

interface User {
  id: string;
  nome: string;
  avatar_url?: string | null;
}

interface MarketingTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: MarketingTask | null;
  cards: MarketingContentCard[];
  users: User[];
  selectedDate: Date;
  defaultCardId?: string; // Para pré-selecionar um card quando aberto de dentro de um card
  onSave: (taskData: any) => Promise<void>;
  /** Mantém o diálogo acima do painel da agenda flutuante. */
  floatingLayer?: boolean;
}

export function MarketingTaskDialog({
  open,
  onOpenChange,
  task,
  cards,
  users,
  selectedDate,
  defaultCardId,
  onSave,
  floatingLayer = false,
}: MarketingTaskDialogProps) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [contentCardId, setContentCardId] = useState<string>('none');
  const [destinatarioId, setDestinatarioId] = useState('');
  const [tipo, setTipo] = useState<'produzir' | 'postar'>('produzir');
  const [horaAgendada, setHoraAgendada] = useState('');
  const [status, setStatus] = useState<'pendente' | 'em_andamento' | 'concluido' | 'cancelado'>('pendente');
  const [isSaving, setIsSaving] = useState(false);
  const [dataAgendada, setDataAgendada] = useState('');

  useEffect(() => {
    if (!open) return; // Só executa quando o dialog abre
    
    if (task) {
      setTitulo(task.titulo);
      setDescricao(task.descricao || '');
      setContentCardId(task.content_card_id || 'none');
      setDestinatarioId(task.destinatario_id);
      setTipo(task.tipo);
      setHoraAgendada(task.hora_agendada || '');
      setStatus(task.status);
    } else {
      setTitulo('');
      setDescricao('');
      // Use defaultCardId se fornecido, senão 'none'
      setContentCardId(defaultCardId || 'none');
      setDestinatarioId(users[0]?.id || '');
      setTipo('produzir');
      setHoraAgendada('09:00');
      setStatus('pendente');
    }

    if (task?.data_agendada) {
      setDataAgendada(task.data_agendada);
    } else {
      setDataAgendada(format(selectedDate, 'yyyy-MM-dd'));
    }
  }, [open]); // Executa apenas quando open muda

  const handleSave = async () => {
    if (!titulo.trim() || !destinatarioId) return;
    
    setIsSaving(true);
    try {
      await onSave({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        content_card_id: contentCardId !== 'none' ? contentCardId : null,
        destinatario_id: destinatarioId,
        tipo,
        hora_agendada: horaAgendada || null,
        status,
        data_agendada: dataAgendada,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" floatingLayer={floatingLayer}>
        <DialogHeader>
          <DialogTitle>
            {task ? 'Editar Tarefa' : 'Nova Tarefa de Marketing'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Data */}
          <div className="space-y-2">
            <Label htmlFor="data">Data</Label>
            <Input
              id="data"
              type="date"
              value={dataAgendada}
              onChange={(e) => setDataAgendada(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {dataAgendada
                ? format(
                    parseISO(dataAgendada),
                    "dd 'de' MMMM 'de' yyyy",
                    { locale: ptBR },
                  )
                : format(
                    selectedDate,
                    "dd 'de' MMMM 'de' yyyy",
                    { locale: ptBR },
                  )}
            </p>
          </div>

          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Criar post sobre promoção"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes da tarefa..."
              className="min-h-[80px]"
            />
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo de Tarefa *</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={tipo === 'produzir' ? 'default' : 'outline'}
                className={tipo === 'produzir' ? 'bg-purple-600 hover:bg-purple-700' : ''}
                onClick={() => setTipo('produzir')}
              >
                <Megaphone className="h-4 w-4 mr-2" />
                Produzir
              </Button>
              <Button
                type="button"
                variant={tipo === 'postar' ? 'default' : 'outline'}
                className={tipo === 'postar' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                onClick={() => setTipo('postar')}
              >
                <Send className="h-4 w-4 mr-2" />
                Postar
              </Button>
            </div>
          </div>

          {/* Hora */}
          <div className="space-y-2">
            <Label htmlFor="hora">Horário</Label>
            <Input
              id="hora"
              type="time"
              value={horaAgendada}
              onChange={(e) => setHoraAgendada(e.target.value)}
            />
          </div>

          {/* Conteúdo Vinculado */}
          <div className="space-y-2">
            <Label>Conteúdo Vinculado</Label>
            <Select value={contentCardId} onValueChange={setContentCardId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um conteúdo (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {cards.map((card) => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destinatário */}
          <div className="space-y-2">
            <Label>Responsável *</Label>
            <Select value={destinatarioId} onValueChange={setDestinatarioId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {user.nome?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {user.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status (apenas na edição) */}
          {task && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!titulo.trim() || !destinatarioId || isSaving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSaving ? 'Salvando...' : task ? 'Salvar' : 'Criar Tarefa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
