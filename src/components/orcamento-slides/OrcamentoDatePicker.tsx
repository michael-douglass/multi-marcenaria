import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  formatarDataInicioExecucao,
  formatarDataIsoLocal,
  parseDataIsoLocal,
} from '@/lib/orcamento-slide-datas';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (isoDate: string) => void;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Seletor de data (dia / mês / ano) com ícone de calendário.
 * Valor persistido em formato ISO yyyy-MM-dd.
 */
export function OrcamentoDatePicker({
  value,
  onChange,
  id = 'orcamento-data',
  disabled,
  placeholder = 'Selecionar data…',
  className,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const selecionada = parseDataIsoLocal(value);
  const agora = new Date();
  const fromYear = agora.getFullYear() - 1;
  const toYear = agora.getFullYear() + 5;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={selecionada ? `Data: ${formatarDataInicioExecucao(value)}` : placeholder}
            className={cn(
              'h-10 w-full min-w-0 justify-start gap-2 px-3 text-left font-normal glass-input',
              'hover:bg-background/80 focus-visible:ring-amber-500/40',
              !selecionada && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
            <span className="min-w-0 truncate tabular-nums">
              {selecionada
                ? format(selecionada, 'dd/MM/yyyy', { locale: ptBR })
                : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 overscroll-contain"
          align="start"
          sideOffset={6}
        >
          <Calendar
            mode="single"
            locale={ptBR}
            selected={selecionada}
            defaultMonth={selecionada ?? agora}
            captionLayout="dropdown-buttons"
            fromYear={fromYear}
            toYear={toYear}
            onSelect={(date) => {
              if (!date) return;
              onChange(formatarDataIsoLocal(date));
              setAberto(false);
            }}
            initialFocus
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      {selecionada ? (
        <p className="text-xs text-amber-200/80" aria-live="polite">
          Selecionado: {formatarDataInicioExecucao(value)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Clique no ícone do calendário para escolher dia, mês e ano.
        </p>
      )}
    </div>
  );
}
