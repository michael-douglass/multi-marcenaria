import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { buildHoraOptions24h } from '@/lib/horarios-24h';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const EMPTY_VALUE = '__sem_horario__';

interface TimeInput24hProps {
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  placeholder?: string;
  className?: string;
}

export function TimeInput24h({
  value,
  onChange,
  optional = false,
  placeholder = 'Selecione o horário',
  className,
}: TimeInput24hProps) {
  const horaOptions = useMemo(() => buildHoraOptions24h(value), [value]);

  return (
    <Select
      value={value || (optional ? EMPTY_VALUE : undefined)}
      onValueChange={(v) => onChange(v === EMPTY_VALUE ? '' : v)}
    >
      <SelectTrigger className={cn('w-full', className)}>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SelectValue placeholder={placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent className="max-h-[240px]">
        {optional && (
          <SelectItem value={EMPTY_VALUE}>Sem horário</SelectItem>
        )}
        {horaOptions.map((slot) => (
          <SelectItem key={slot} value={slot}>
            {slot}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
