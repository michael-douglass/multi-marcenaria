import { useState } from 'react';
import { format, isToday, isSameDay, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AgendaReuniao } from '@/hooks/useAgenda';

interface AgendaCalendarProps {
  reunioes: AgendaReuniao[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}

export function AgendaCalendar({ reunioes, selectedDate, onSelectDate }: AgendaCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

  const getReunioesForDay = (date: Date) => {
    return reunioes.filter((r) => isSameDay(new Date(r.data_hora_inicio), date));
  };

  const getDayStatus = (date: Date) => {
    const dayReunioes = getReunioesForDay(date);
    if (dayReunioes.length === 0) return null;
    
    const hasConcluida = dayReunioes.some((r) => r.status === 'concluido');
    const hasPendente = dayReunioes.some((r) => r.status === 'pendente' || r.status === 'confirmado');
    
    if (hasPendente && hasConcluida) return 'mixed';
    if (hasConcluida) return 'concluida';
    return 'pendente';
  };

  return (
    <div className="bg-card rounded-lg border p-4">
      {/* Header com navegação */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {diasSemana.map((dia) => (
          <div
            key={dia}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {dia}
          </div>
        ))}
      </div>

      {/* Dias do mês */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const status = getDayStatus(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          return (
            <button
              key={day.toString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                'h-9 w-full rounded-md text-sm font-medium transition-colors relative',
                'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/50',
                !isCurrentMonth && 'text-muted-foreground/40',
                isToday(day) && 'bg-primary text-primary-foreground hover:bg-primary/90',
                isSelected && !isToday(day) && 'bg-accent ring-2 ring-primary',
                status === 'pendente' && 'bg-amber-100 dark:bg-amber-900/30',
                status === 'concluida' && 'bg-green-100 dark:bg-green-900/30',
                status === 'mixed' && 'bg-gradient-to-br from-amber-100 to-green-100 dark:from-amber-900/30 dark:to-green-900/30'
              )}
            >
              {format(day, 'd')}
              {getReunioesForDay(day).length > 0 && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-200 dark:bg-amber-700" />
          <span className="text-muted-foreground">Pendente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-200 dark:bg-green-700" />
          <span className="text-muted-foreground">Concluída</span>
        </div>
      </div>
    </div>
  );
}
