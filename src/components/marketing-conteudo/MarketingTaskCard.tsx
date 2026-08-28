import { MarketingTask } from '@/hooks/useMarketingTasks';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Megaphone, 
  Send, 
  CheckCircle2, 
  Clock, 
  Edit2, 
  Trash2,
  FileText
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface MarketingTaskCardProps {
  task: MarketingTask;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
}

export function MarketingTaskCard({ task, onEdit, onComplete, onDelete }: MarketingTaskCardProps) {
  const getStatusBadge = () => {
    switch (task.status) {
      case 'pendente':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'em_andamento':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300"><Megaphone className="h-3 w-3 mr-1" />Em Andamento</Badge>;
      case 'concluido':
        return <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300"><CheckCircle2 className="h-3 w-3 mr-1" />Concluído</Badge>;
      case 'cancelado':
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Cancelado</Badge>;
      default:
        return null;
    }
  };

  const getTipoBadge = () => {
    if (task.tipo === 'produzir') {
      return <Badge className="bg-purple-600 hover:bg-purple-700"><Megaphone className="h-3 w-3 mr-1" />Produzir</Badge>;
    }
    return <Badge className="bg-emerald-600 hover:bg-emerald-700"><Send className="h-3 w-3 mr-1" />Postar</Badge>;
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow border-l-4 border-l-emerald-500">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {getTipoBadge()}
            {getStatusBadge()}
            {task.hora_agendada && (
              <span className="text-sm text-muted-foreground">
                às {task.hora_agendada.slice(0, 5)}
              </span>
            )}
          </div>
          
          <h4 className="font-semibold truncate">{task.titulo}</h4>
          
          {task.descricao && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {task.descricao}
            </p>
          )}

          {/* Content Card Link */}
          {task.content_card && (
            <div className="flex items-center gap-2 mt-2 text-sm text-primary">
              <FileText className="h-4 w-4" />
              <span>{task.content_card.titulo}</span>
            </div>
          )}

          {/* Destinatário */}
          {task.destinatario && (
            <div className="flex items-center gap-2 mt-3">
              <Avatar className="h-6 w-6">
                <AvatarImage src={task.destinatario.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {task.destinatario.nome?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                {task.destinatario.nome}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1">
          {task.status !== 'concluido' && task.status !== 'cancelado' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              onClick={onComplete}
              title="Marcar como concluído"
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onEdit}
            title="Editar"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDelete}
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
